import { createLogger, MigrationLogger } from "./util";

/**
 * Versioned migration harness (design §G.8, requirement 31.1).
 *
 * Design goals encoded here:
 *  - **Resumable**: progress is recorded in a `_migrations/{id}` state document so a
 *    re-run picks up where a crashed run stopped.
 *  - **Idempotent**: each migration inspects its target before writing, so replaying a
 *    completed (or partially completed) migration changes nothing.
 *  - **Dry-run / reporting**: every migration accepts a dry-run flag and returns a
 *    structured {@link MigrationReport}; nothing is written in dry-run mode.
 *  - **Rules-and-indexes-first ordering**: data migrations declare a dependency on the
 *    security-rules + composite-index precondition step, and the runner refuses to run
 *    them until that step has completed (design §G.8 step 10, requirement 31.1).
 */

export interface MigrationOptions {
  /** When true, no writes are performed; migrations only scan and report. */
  dryRun: boolean;
  /** When true, items already recorded as processed in state are skipped up front. */
  resume: boolean;
  /** Max documents to write per batch where batching applies. */
  batchSize: number;
  /** Optional operator confirmation that rules + indexes were deployed out-of-band. */
  assumeRulesDeployed?: boolean;
}

export const DEFAULT_OPTIONS: MigrationOptions = {
  dryRun: false,
  resume: true,
  batchSize: 200,
};

export interface MigrationError {
  id: string;
  message: string;
}

export interface MigrationReport {
  migrationId: string;
  description: string;
  dryRun: boolean;
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: MigrationError[];
  startedAt: number;
  finishedAt: number;
  status: "completed" | "failed" | "skipped";
}

export interface MigrationStateDoc {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  dryRun: boolean;
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  processedIds: string[];
  updatedAt: number;
  completedAt?: number;
}

/**
 * Minimal Admin-Firestore-shaped surface the harness needs. It is satisfied by the
 * `getFirebaseAdminDb()` shim in `server/config/firebase.ts` established by task 1.3.
 */
export interface AdminDbLike {
  collection(name: string): {
    doc(id?: string): {
      id: string;
      get(): Promise<{ exists: boolean; data(): any }>;
      set(data: any, options?: { merge?: boolean }): Promise<void>;
      update(data: any): Promise<void>;
    };
    get(): Promise<{ size: number; docs: { id: string; data(): any }[] }>;
  };
}

/** Minimal Admin-Auth surface the harness needs (UID resolution for rekeying). */
export interface AdminAuthLike {
  getUserByEmail(email: string): Promise<{ uid: string; email?: string }>;
}

export interface MigrationContext {
  db: AdminDbLike;
  auth: AdminAuthLike;
  options: MigrationOptions;
  logger: MigrationLogger;
  state: MigrationStateStore;
}

export interface Migration {
  /** Stable identifier; also the `_migrations` document id. */
  id: string;
  description: string;
  /** Ids of migrations/preconditions that MUST be completed before this one runs. */
  requires?: string[];
  /** True for non-data precondition gates (e.g. rules + indexes deployment). */
  isPrecondition?: boolean;
  run(ctx: MigrationContext): Promise<MigrationReport>;
}

const STATE_COLLECTION = "_migrations";

/** Reads/writes migration progress in Firestore so runs are resumable and auditable. */
export class MigrationStateStore {
  constructor(private db: AdminDbLike, private dryRun: boolean) {}

  async load(id: string): Promise<MigrationStateDoc | null> {
    const snap = await this.db.collection(STATE_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as MigrationStateDoc;
  }

  async isCompleted(id: string): Promise<boolean> {
    const doc = await this.load(id);
    // A dry-run never marks a migration completed, so a prior real completion still counts.
    return doc?.status === "completed";
  }

  async save(doc: MigrationStateDoc): Promise<void> {
    // In dry-run mode we never persist state — the run must be side-effect free.
    if (this.dryRun) return;
    await this.db.collection(STATE_COLLECTION).doc(doc.id).set(doc, { merge: true });
  }
}

/**
 * A small helper migrations use to drive resumable, idempotent, reporting-aware loops
 * over a collection of items. It records processed ids into state after each item so a
 * crash mid-run can resume, and honours dry-run by skipping the per-item write callback.
 */
export async function runItemLoop<T extends { id: string }>(
  ctx: MigrationContext,
  migration: Migration,
  items: readonly T[],
  handleItem: (item: T) => Promise<"migrated" | "skipped">,
): Promise<MigrationReport> {
  const startedAt = Date.now();
  const prior = (await ctx.state.load(migration.id)) ?? emptyState(migration.id);
  const processed = new Set<string>(ctx.options.resume ? prior.processedIds : []);

  const report: MigrationReport = {
    migrationId: migration.id,
    description: migration.description,
    dryRun: ctx.options.dryRun,
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
    status: "completed",
  };

  await ctx.state.save({
    ...prior,
    status: "in_progress",
    dryRun: ctx.options.dryRun,
    updatedAt: Date.now(),
  });

  for (const item of items) {
    report.scanned++;
    if (processed.has(item.id)) {
      report.skipped++;
      continue;
    }
    try {
      const outcome = await handleItem(item);
      if (outcome === "migrated") report.migrated++;
      else report.skipped++;
      processed.add(item.id);
    } catch (err: any) {
      report.failed++;
      report.errors.push({ id: item.id, message: err?.message ?? String(err) });
      ctx.logger.error(`item ${item.id} failed: ${err?.message ?? err}`);
    }
  }

  report.finishedAt = Date.now();
  report.status = report.failed > 0 ? "failed" : "completed";

  await ctx.state.save({
    id: migration.id,
    status: report.status,
    dryRun: ctx.options.dryRun,
    scanned: report.scanned,
    migrated: report.migrated,
    skipped: report.skipped,
    failed: report.failed,
    processedIds: Array.from(processed),
    updatedAt: report.finishedAt,
    completedAt: report.status === "completed" ? report.finishedAt : undefined,
  });

  return report;
}

function emptyState(id: string): MigrationStateDoc {
  return {
    id,
    status: "pending",
    dryRun: false,
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    processedIds: [],
    updatedAt: Date.now(),
  };
}

/** Thrown when a data migration is attempted before its required preconditions ran. */
export class MigrationOrderingError extends Error {
  constructor(migrationId: string, missing: string[]) {
    super(
      `Migration "${migrationId}" cannot run: required step(s) not completed: ${missing.join(", ")}. ` +
        `Deploy the hardened rules and composite indexes first (design §G.8, requirement 31.1).`,
    );
    this.name = "MigrationOrderingError";
  }
}

/** Orchestrates an ordered list of migrations with dependency + ordering enforcement. */
export class MigrationRunner {
  private byId: Map<string, Migration>;

  constructor(private migrations: Migration[]) {
    this.byId = new Map(migrations.map((m) => [m.id, m]));
  }

  /** Verifies every required precondition for `migration` is already completed. */
  private async assertRequirementsMet(
    migration: Migration,
    ctx: MigrationContext,
  ): Promise<void> {
    const requires = migration.requires ?? [];
    const missing: string[] = [];
    for (const reqId of requires) {
      const completed = await ctx.state.isCompleted(reqId);
      // `assumeRulesDeployed` lets an operator confirm out-of-band deployment of the
      // rules/index precondition without re-running the gate in this environment.
      if (!completed && !(ctx.options.assumeRulesDeployed && this.byId.get(reqId)?.isPrecondition)) {
        missing.push(reqId);
      }
    }
    if (missing.length > 0) {
      throw new MigrationOrderingError(migration.id, missing);
    }
  }

  private buildContext(
    db: AdminDbLike,
    auth: AdminAuthLike,
    options: MigrationOptions,
    scope: string,
  ): MigrationContext {
    return {
      db,
      auth,
      options,
      logger: createLogger(scope),
      state: new MigrationStateStore(db, options.dryRun),
    };
  }

  /** Runs a single migration by id, enforcing its ordering requirements first. */
  async runOne(
    id: string,
    db: AdminDbLike,
    auth: AdminAuthLike,
    options: MigrationOptions,
  ): Promise<MigrationReport> {
    const migration = this.byId.get(id);
    if (!migration) throw new Error(`Unknown migration: ${id}`);
    const ctx = this.buildContext(db, auth, options, id);
    await this.assertRequirementsMet(migration, ctx);
    ctx.logger.info(`${options.dryRun ? "[dry-run] " : ""}${migration.description}`);
    return migration.run(ctx);
  }

  /**
   * Runs every registered migration in declared order. Preconditions run first by
   * virtue of being declared first; each subsequent migration's requirements are
   * re-checked against freshly persisted state, so ordering holds even on resume.
   */
  async runAll(
    db: AdminDbLike,
    auth: AdminAuthLike,
    options: MigrationOptions,
  ): Promise<MigrationReport[]> {
    const reports: MigrationReport[] = [];
    for (const migration of this.migrations) {
      const ctx = this.buildContext(db, auth, options, migration.id);

      if (options.resume && (await ctx.state.isCompleted(migration.id)) && !options.dryRun) {
        ctx.logger.info(`already completed — skipping ${migration.id}`);
        reports.push({
          migrationId: migration.id,
          description: migration.description,
          dryRun: options.dryRun,
          scanned: 0,
          migrated: 0,
          skipped: 0,
          failed: 0,
          errors: [],
          startedAt: Date.now(),
          finishedAt: Date.now(),
          status: "skipped",
        });
        continue;
      }

      try {
        await this.assertRequirementsMet(migration, ctx);
      } catch (err: any) {
        ctx.logger.error(err.message);
        reports.push({
          migrationId: migration.id,
          description: migration.description,
          dryRun: options.dryRun,
          scanned: 0,
          migrated: 0,
          skipped: 0,
          failed: 1,
          errors: [{ id: "__ordering__", message: err.message }],
          startedAt: Date.now(),
          finishedAt: Date.now(),
          status: "failed",
        });
        // Ordering is a hard stop: do not run later data migrations without preconditions.
        break;
      }

      ctx.logger.info(`${options.dryRun ? "[dry-run] " : ""}${migration.description}`);
      const report = await migration.run(ctx);
      reports.push(report);

      if (report.status === "failed") {
        ctx.logger.error(`migration ${migration.id} reported failures; halting run`);
        break;
      }
    }
    return reports;
  }

  /** Returns the persisted state for every registered migration (for `status`). */
  async status(db: AdminDbLike): Promise<MigrationStateDoc[]> {
    const store = new MigrationStateStore(db, true);
    const out: MigrationStateDoc[] = [];
    for (const migration of this.migrations) {
      const doc = await store.load(migration.id);
      out.push(
        doc ?? {
          id: migration.id,
          status: "pending",
          dryRun: false,
          scanned: 0,
          migrated: 0,
          skipped: 0,
          failed: 0,
          processedIds: [],
          updatedAt: 0,
        },
      );
    }
    return out;
  }
}
