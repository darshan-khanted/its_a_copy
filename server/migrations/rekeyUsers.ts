import { Migration, MigrationContext, MigrationReport, runItemLoop } from "./framework";
import { RULES_AND_INDEXES_ID } from "./rulesAndIndexes";
import { USER_SCHEMA_VERSION, buildEmailIndexEntry } from "./compat";
import { looksLikeEmail, normalizeEmail } from "./util";

/**
 * Rekey users from email-as-doc-id to Firebase UID (design §G.8 step 1, requirement 31.5).
 *
 * For each legacy `users/{email}` document:
 *   1. Resolve the Firebase Auth UID for the email.
 *   2. Write `users/{uid}` with `uid`, `homeless legacy fields preserved`, and
 *      `schemaVersion: 2` — idempotent: an existing v2 doc is left untouched.
 *   3. Create `emailIndex/{sha256(email)} -> { uid }` for lookup (create-once/idempotent).
 *   4. Leave the legacy `users/{email}` document in place but mark it read-only
 *      (`legacy: true`, `readOnly: true`, `migratedToUid`) for one release.
 *
 * The whole migration is resumable and idempotent: rerunning skips users whose UID
 * document already exists at the current schema version.
 */

export const REKEY_USERS_ID = "rekey-users-to-uid";

interface RawUserDoc {
  id: string;
  data: any;
}

export const rekeyUsersMigration: Migration = {
  id: REKEY_USERS_ID,
  description: "Rekey users from email to Firebase UID, add email-hash index, retain legacy docs read-only",
  requires: [RULES_AND_INDEXES_ID],
  async run(ctx: MigrationContext): Promise<MigrationReport> {
    const snap = await ctx.db.collection("users").get();

    // Only legacy email-keyed docs that have not already been marked migrated are candidates.
    const candidates: RawUserDoc[] = snap.docs
      .filter((d) => looksLikeEmail(d.id))
      .filter((d) => !(d.data() && d.data().migratedToUid))
      .map((d) => ({ id: d.id, data: d.data() }));

    ctx.logger.info(`found ${candidates.length} legacy email-keyed user document(s) to rekey`);

    return runItemLoop(ctx, this, candidates, async (item) => {
      const email = normalizeEmail(item.data?.email || item.id);
      const now = Date.now();

      // 1. Resolve the Firebase Auth UID.
      let uid: string;
      try {
        const record = await ctx.auth.getUserByEmail(email);
        uid = record.uid;
      } catch (err: any) {
        // No Auth account → cannot rekey. Surface as an error so the operator can triage
        // (e.g. run legacy-user migration first) rather than silently dropping the user.
        throw new Error(`no Firebase Auth user for ${email}: ${err?.message ?? err}`);
      }

      const uidDocRef = ctx.db.collection("users").doc(uid);
      const existing = await uidDocRef.get();
      const alreadyRekeyed =
        existing.exists && (existing.data()?.schemaVersion === USER_SCHEMA_VERSION);

      if (ctx.options.dryRun) {
        ctx.logger.info(
          `[dry-run] would rekey ${email} -> users/${uid}` +
            (alreadyRekeyed ? " (already present, would skip)" : ""),
        );
        return alreadyRekeyed ? "skipped" : "migrated";
      }

      if (!alreadyRekeyed) {
        // 2. Write the UID-keyed document, preserving existing fields.
        const { passwordHash, passwordSalt, ...safeFields } = item.data ?? {};
        await uidDocRef.set(
          {
            ...safeFields,
            uid,
            email,
            schemaVersion: USER_SCHEMA_VERSION,
            migratedFromEmailDoc: item.id,
            rekeyedAt: now,
          },
          { merge: true },
        );
      }

      // 3. Email-hash index (create-once; merge keeps it idempotent).
      const { key, entry } = buildEmailIndexEntry(email, uid, now);
      const indexRef = ctx.db.collection("emailIndex").doc(key);
      const indexSnap = await indexRef.get();
      if (!indexSnap.exists) {
        await indexRef.set(entry);
      }

      // 4. Retain the legacy document read-only for one release.
      await ctx.db
        .collection("users")
        .doc(item.id)
        .set(
          { legacy: true, readOnly: true, migratedToUid: uid, migratedAt: now },
          { merge: true },
        );

      return alreadyRekeyed ? "skipped" : "migrated";
    });
  },
};
