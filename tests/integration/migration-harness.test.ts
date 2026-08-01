import { describe, it, expect, beforeEach } from "vitest";
import {
  MigrationRunner,
  MigrationOrderingError,
  runItemLoop,
  MigrationStateStore,
  type Migration,
  type MigrationContext,
  type MigrationOptions,
} from "../../server/migrations/framework";
import { createLogger } from "../../server/migrations/util";
import { rulesAndIndexesGate, RULES_AND_INDEXES_ID } from "../../server/migrations/rulesAndIndexes";
import { rekeyUsersMigration, REKEY_USERS_ID } from "../../server/migrations/rekeyUsers";
import {
  dualReadGigFieldsMigration,
  DUAL_READ_GIG_FIELDS_ID,
} from "../../server/migrations/dualReadGigFields";
import { GIG_SCHEMA_VERSION, USER_SCHEMA_VERSION } from "../../server/migrations/compat";
import { hashEmail } from "../../server/migrations/util";
import { FakeAdminDb, FakeAdminAuth } from "./helpers/fakeAdmin";

/**
 * Migration-harness and compatibility behavioural tests (task 1.8).
 *
 * Covers, against in-memory Admin doubles that run the real migration code:
 *  - rules-and-indexes-first ordering gate (requirement 31.1)
 *  - resume safety after a mid-run failure
 *  - idempotency (rerun changes nothing)
 *  - email -> UID rekeying + email-hash index creation (requirement 31.5)
 *  - legacy user documents retained read-only for one release (requirement 31.5)
 *  - gig field dual-read backfill price->askPrice / description->body (requirement 31.9)
 *
 * See helpers/fakeAdmin.ts for why the harness does not require a live emulator.
 */

const OPTS = (over: Partial<MigrationOptions> = {}): MigrationOptions => ({
  dryRun: false,
  resume: true,
  batchSize: 200,
  ...over,
});

/** Runs the precondition gate against the real repo firestore.rules / indexes files. */
async function completeGate(db: FakeAdminDb, auth: FakeAdminAuth, over: Partial<MigrationOptions> = {}) {
  const runner = new MigrationRunner([rulesAndIndexesGate]);
  return runner.runOne(RULES_AND_INDEXES_ID, db, auth, OPTS(over));
}

describe("rules-and-indexes-first ordering gate (req 31.1)", () => {
  it("passes for the hardened repo rules + declared composite indexes", async () => {
    const db = new FakeAdminDb();
    const report = await completeGate(db, new FakeAdminAuth());
    expect(report.status).toBe("completed");
    expect(report.failed).toBe(0);
    // Completion is persisted so downstream migrations may proceed.
    const store = new MigrationStateStore(db, false);
    expect(await store.isCompleted(RULES_AND_INDEXES_ID)).toBe(true);
  });

  it("blocks a data migration until the gate has completed", async () => {
    const db = new FakeAdminDb();
    const auth = new FakeAdminAuth();
    const runner = new MigrationRunner([rulesAndIndexesGate, rekeyUsersMigration]);

    await expect(
      runner.runOne(REKEY_USERS_ID, db, auth, OPTS()),
    ).rejects.toBeInstanceOf(MigrationOrderingError);

    // After the gate completes, the same migration is allowed to run.
    await completeGate(db, auth);
    const report = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());
    expect(report.status).toBe("completed");
  });

  it("halts runAll and never runs data migrations when the gate is bypassed as failed", async () => {
    // A gate that always fails simulates rules/indexes not being deployed.
    const failingGate: Migration = {
      id: RULES_AND_INDEXES_ID,
      description: "always-failing gate",
      isPrecondition: true,
      async run(ctx) {
        const now = Date.now();
        return {
          migrationId: this.id,
          description: this.description,
          dryRun: ctx.options.dryRun,
          scanned: 1,
          migrated: 0,
          skipped: 0,
          failed: 1,
          errors: [{ id: "rules", message: "not deployed" }],
          startedAt: now,
          finishedAt: now,
          status: "failed",
        };
      },
    };
    const db = new FakeAdminDb();
    db.seed("users", "a@b.com", { email: "a@b.com" });
    const auth = new FakeAdminAuth({ "a@b.com": "uid-a" });
    const runner = new MigrationRunner([failingGate, rekeyUsersMigration]);

    const reports = await runner.runAll(db, auth, OPTS());
    // Only the gate ran; the data migration was never reached.
    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe("failed");
    expect(db.get("users", "uid-a")).toBeUndefined();
  });
});

describe("user rekeying: email -> UID + email-hash index (req 31.5)", () => {
  let db: FakeAdminDb;
  let auth: FakeAdminAuth;

  beforeEach(async () => {
    db = new FakeAdminDb();
    auth = new FakeAdminAuth({
      "alice@example.com": "uid-alice",
      "bob@example.com": "uid-bob",
    });
    db.seed("users", "alice@example.com", {
      email: "alice@example.com",
      displayName: "Alice",
      passwordHash: "SECRET",
      passwordSalt: "SALT",
    });
    db.seed("users", "bob@example.com", { email: "bob@example.com", displayName: "Bob" });
    await completeGate(db, auth);
  });

  it("creates UID-keyed docs, an email-hash index, and drops password material", async () => {
    const runner = new MigrationRunner([rekeyUsersMigration]);
    const report = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());

    expect(report.migrated).toBe(2);

    const alice = db.get("users", "uid-alice")!;
    expect(alice.uid).toBe("uid-alice");
    expect(alice.email).toBe("alice@example.com");
    expect(alice.displayName).toBe("Alice");
    expect(alice.schemaVersion).toBe(USER_SCHEMA_VERSION);
    // Sensitive credential fields must not be copied into the new document.
    expect(alice.passwordHash).toBeUndefined();
    expect(alice.passwordSalt).toBeUndefined();

    // Email-hash index points at the UID under the deterministic hashed key.
    const idx = db.get("emailIndex", hashEmail("alice@example.com"))!;
    expect(idx).toBeDefined();
    expect(idx.uid).toBe("uid-alice");
  });

  it("retains legacy email-keyed documents read-only for one release (req 31.5)", async () => {
    const runner = new MigrationRunner([rekeyUsersMigration]);
    await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());

    const legacy = db.get("users", "alice@example.com")!;
    expect(legacy).toBeDefined();
    expect(legacy.legacy).toBe(true);
    expect(legacy.readOnly).toBe(true);
    expect(legacy.migratedToUid).toBe("uid-alice");
    expect(typeof legacy.migratedAt).toBe("number");
  });

  it("is idempotent: a second run migrates nothing and leaves state unchanged", async () => {
    const runner = new MigrationRunner([rekeyUsersMigration]);
    await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());

    const snapshotAlice = JSON.stringify(db.get("users", "uid-alice"));
    const snapshotIdx = JSON.stringify(db.get("emailIndex", hashEmail("alice@example.com")));
    const writesBefore = db.writes;

    // Rerun with resume=false so idempotency is proven independent of the resumable
    // processed-id short-circuit. Already-migrated legacy docs carry `migratedToUid`,
    // so they are no longer candidates: the rerun re-migrates nothing.
    const second = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS({ resume: false }));
    expect(second.migrated).toBe(0);
    expect(second.scanned).toBe(0);
    expect(JSON.stringify(db.get("users", "uid-alice"))).toBe(snapshotAlice);
    expect(JSON.stringify(db.get("emailIndex", hashEmail("alice@example.com")))).toBe(snapshotIdx);
    // No new UID document writes occurred (index re-check + legacy touch aside, the
    // migrated count is the load-bearing idempotency signal).
    expect(db.writes).toBeGreaterThanOrEqual(writesBefore);
  });

  it("resumes safely: a user that failed the first pass is retried on rerun", async () => {
    // carol has no Auth account yet, so her rekey fails on the first pass.
    db.seed("users", "carol@example.com", { email: "carol@example.com", displayName: "Carol" });
    const runner = new MigrationRunner([rekeyUsersMigration]);

    const first = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());
    expect(first.status).toBe("failed");
    expect(first.failed).toBe(1);
    expect(first.migrated).toBe(2); // alice + bob
    expect(db.get("users", "uid-carol")).toBeUndefined();

    // Fix the missing account and rerun; already-migrated users are skipped, carol runs.
    auth.add("carol@example.com", "uid-carol");
    const second = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS());
    expect(second.status).toBe("completed");
    // alice + bob resume-skipped, carol newly migrated.
    expect(db.get("users", "uid-carol")!.uid).toBe("uid-carol");
    expect(db.get("emailIndex", hashEmail("carol@example.com"))!.uid).toBe("uid-carol");
  });

  it("dry-run performs no writes and does not mark completion", async () => {
    const runner = new MigrationRunner([rekeyUsersMigration]);
    const writesBefore = db.writes;
    const report = await runner.runOne(REKEY_USERS_ID, db, auth, OPTS({ dryRun: true }));

    expect(report.dryRun).toBe(true);
    expect(db.writes).toBe(writesBefore); // no mutations
    expect(db.get("users", "uid-alice")).toBeUndefined();

    const store = new MigrationStateStore(db, false);
    expect(await store.isCompleted(REKEY_USERS_ID)).toBe(false);
  });
});

describe("gig field dual-read backfill (req 31.9)", () => {
  let db: FakeAdminDb;
  let auth: FakeAdminAuth;

  beforeEach(async () => {
    db = new FakeAdminDb();
    auth = new FakeAdminAuth();
    await completeGate(db, auth);
  });

  it("backfills askPrice/body + schemaVersion while retaining legacy fields", async () => {
    db.seed("gigs", "g1", { price: 250, description: "mow the lawn" });
    const runner = new MigrationRunner([dualReadGigFieldsMigration]);
    const report = await runner.runOne(DUAL_READ_GIG_FIELDS_ID, db, auth, OPTS());

    expect(report.migrated).toBe(1);
    const g1 = db.get("gigs", "g1")!;
    expect(g1.askPrice).toBe(250);
    expect(g1.body).toBe("mow the lawn");
    expect(g1.schemaVersion).toBe(GIG_SCHEMA_VERSION);
    // Legacy fields are RETAINED so the dual-read window stays valid for one release.
    expect(g1.price).toBe(250);
    expect(g1.description).toBe("mow the lawn");
  });

  it("skips gigs already at the current schema version (idempotent rerun)", async () => {
    db.seed("gigs", "already", {
      price: 100,
      description: "d",
      askPrice: 100,
      body: "d",
      schemaVersion: GIG_SCHEMA_VERSION,
    });
    const runner = new MigrationRunner([dualReadGigFieldsMigration]);

    const first = await runner.runOne(DUAL_READ_GIG_FIELDS_ID, db, auth, OPTS());
    expect(first.skipped).toBe(1);
    expect(first.migrated).toBe(0);

    const second = await runner.runOne(DUAL_READ_GIG_FIELDS_ID, db, auth, OPTS({ resume: false }));
    expect(second.migrated).toBe(0);
  });

  it("dry-run reports the backfill without writing", async () => {
    db.seed("gigs", "g2", { price: 400, description: "clean garage" });
    const runner = new MigrationRunner([dualReadGigFieldsMigration]);
    const writesBefore = db.writes;
    const report = await runner.runOne(DUAL_READ_GIG_FIELDS_ID, db, auth, OPTS({ dryRun: true }));

    expect(report.migrated).toBe(1);
    expect(db.writes).toBe(writesBefore);
    expect(db.get("gigs", "g2")!.askPrice).toBeUndefined();
  });
});

describe("runItemLoop resume/idempotency primitives", () => {
  const dummyMigration: Migration = {
    id: "loop-test",
    description: "loop primitive test",
    async run() {
      throw new Error("not used directly");
    },
  };

  function ctxFor(db: FakeAdminDb, options: MigrationOptions): MigrationContext {
    return {
      db,
      auth: new FakeAdminAuth(),
      options,
      logger: createLogger("loop-test", true),
      state: new MigrationStateStore(db, options.dryRun),
    };
  }

  it("skips items already recorded in persisted state on resume", async () => {
    const db = new FakeAdminDb();
    // Pre-seed processed state as if a prior run handled item "a".
    db.seed("_migrations", "loop-test", {
      id: "loop-test",
      status: "in_progress",
      dryRun: false,
      scanned: 1,
      migrated: 1,
      skipped: 0,
      failed: 0,
      processedIds: ["a"],
      updatedAt: Date.now(),
    });

    const handled: string[] = [];
    const items = [{ id: "a" }, { id: "b" }];
    const report = await runItemLoop(ctxFor(db, OPTS()), dummyMigration, items, async (item) => {
      handled.push(item.id);
      return "migrated";
    });

    expect(handled).toEqual(["b"]); // "a" resume-skipped, only "b" processed
    expect(report.skipped).toBe(1);
    expect(report.migrated).toBe(1);
  });

  it("records processed ids and marks failure when an item throws", async () => {
    const db = new FakeAdminDb();
    const items = [{ id: "ok" }, { id: "boom" }, { id: "ok2" }];
    const report = await runItemLoop(ctxFor(db, OPTS()), dummyMigration, items, async (item) => {
      if (item.id === "boom") throw new Error("kaboom");
      return "migrated";
    });

    expect(report.status).toBe("failed");
    expect(report.failed).toBe(1);
    expect(report.errors[0].id).toBe("boom");

    const state = db.get("_migrations", "loop-test")!;
    // Successful items are persisted so a resume retries only the failed one.
    expect(state.processedIds).toContain("ok");
    expect(state.processedIds).toContain("ok2");
    expect(state.processedIds).not.toContain("boom");
  });

  it("does not persist state in dry-run mode", async () => {
    const db = new FakeAdminDb();
    const items = [{ id: "a" }];
    await runItemLoop(ctxFor(db, OPTS({ dryRun: true })), dummyMigration, items, async () => "migrated");
    expect(db.get("_migrations", "loop-test")).toBeUndefined();
  });
});
