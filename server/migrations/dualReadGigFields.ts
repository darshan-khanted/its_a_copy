import { Migration, MigrationContext, MigrationReport, runItemLoop } from "./framework";
import { RULES_AND_INDEXES_ID } from "./rulesAndIndexes";
import { computeGigBackfill } from "./compat";

/**
 * Backfill the renamed gig fields and enable schema-versioned dual reads
 * (design §G.8 step 2, requirement 31.9): `price -> askPrice`, `description -> body`.
 *
 * The legacy `price`/`description` fields are intentionally RETAINED so the
 * compatibility layer in `compat.ts` can dual-read for one release while the running
 * application is upgraded. Only the v2 fields + `schemaVersion: 2` are written.
 *
 * Idempotent: gigs already at the current schema version with both renamed fields are
 * skipped (see {@link computeGigBackfill}). Resumable via the shared item loop.
 */

export const DUAL_READ_GIG_FIELDS_ID = "backfill-gig-field-renames";

interface RawGigDoc {
  id: string;
  data: any;
}

export const dualReadGigFieldsMigration: Migration = {
  id: DUAL_READ_GIG_FIELDS_ID,
  description: "Backfill askPrice/body from price/description and set schemaVersion for dual reads",
  requires: [RULES_AND_INDEXES_ID],
  async run(ctx: MigrationContext): Promise<MigrationReport> {
    const snap = await ctx.db.collection("gigs").get();
    const gigs: RawGigDoc[] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

    ctx.logger.info(`scanning ${gigs.length} gig document(s) for the v1 -> v2 field rename`);

    return runItemLoop(ctx, this, gigs, async (item) => {
      const patch = computeGigBackfill(item.data ?? {});
      if (!patch) {
        return "skipped"; // already at current schema with both renamed fields
      }

      if (ctx.options.dryRun) {
        ctx.logger.info(
          `[dry-run] would backfill gig ${item.id}: askPrice=${patch.askPrice}, body(len)=${patch.body.length}, schemaVersion=${patch.schemaVersion}`,
        );
        return "migrated";
      }

      await ctx.db.collection("gigs").doc(item.id).set(patch, { merge: true });
      return "migrated";
    });
  },
};
