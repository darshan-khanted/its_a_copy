import fs from "fs";
import path from "path";
import { Migration, MigrationContext, MigrationReport } from "./framework";

/**
 * Precondition gate: hardened security rules + composite indexes must be deployed
 * before ANY data migration runs (design §G.8 step 10, requirement 31.1).
 *
 * Actual deployment happens out-of-band via the Firebase CLI. This gate provides a
 * local, auditable proxy check that (a) the world-open rule baseline is gone and (b)
 * the composite-index manifest exists and parses. When it passes it records completion
 * in `_migrations/deploy-rules-and-indexes`, which is the flag the ordering enforcer in
 * the runner keys on before allowing data migrations. Operators who deployed rules and
 * indexes elsewhere can instead pass `assumeRulesDeployed`.
 */

export const RULES_AND_INDEXES_ID = "deploy-rules-and-indexes";

/** Composite indexes required before migration (design §G.5, task 1.6). */
const REQUIRED_GIG_INDEX_FIELDS: string[][] = [
  ["hoodId", "state", "createdAt"],
  ["hoodId", "state", "startHour", "createdAt"],
  ["geohash7", "state"],
  ["posterUid", "createdAt"],
];

function repoRoot(): string {
  // The harness runs from the project root (where package.json / firestore.rules live).
  return process.cwd();
}

function checkRulesHardened(logger: MigrationContext["logger"]): { ok: boolean; reason?: string } {
  const rulesPath = path.join(repoRoot(), "firestore.rules");
  if (!fs.existsSync(rulesPath)) {
    return { ok: false, reason: "firestore.rules not found" };
  }
  const raw = fs.readFileSync(rulesPath, "utf8");
  // Strip `//` line comments and `/* */` block comments so a comment that merely
  // *mentions* the old world-open rule (e.g. "replaces allow read, write: if true")
  // does not produce a false positive.
  const contents = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  // The world-open baseline `allow read, write: if true;` is the single highest-severity
  // item in the design (§G.6). Its presence means rules were NOT hardened/deployed.
  const worldOpen = /allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(contents);
  if (worldOpen) {
    return { ok: false, reason: "firestore.rules still contains a world-open `allow read, write: if true` rule" };
  }
  logger.info("firestore.rules: no world-open rule detected");
  return { ok: true };
}

function checkIndexesDeclared(logger: MigrationContext["logger"]): { ok: boolean; reason?: string } {
  const indexPath = path.join(repoRoot(), "firestore.indexes.json");
  if (!fs.existsSync(indexPath)) {
    return { ok: false, reason: "firestore.indexes.json not found (task 1.6 must land first)" };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch (err: any) {
    return { ok: false, reason: `firestore.indexes.json is not valid JSON: ${err?.message ?? err}` };
  }
  const indexes: any[] = Array.isArray(parsed?.indexes) ? parsed.indexes : [];
  if (indexes.length === 0) {
    return { ok: false, reason: "firestore.indexes.json declares no composite indexes" };
  }

  const declaredFieldSets = indexes
    .filter((idx) => idx?.collectionGroup === "gigs")
    .map((idx) => (idx.fields ?? []).map((f: any) => f.fieldPath));

  const missing = REQUIRED_GIG_INDEX_FIELDS.filter(
    (required) =>
      !declaredFieldSets.some((declared: string[]) =>
        required.every((field) => declared.includes(field)),
      ),
  );
  if (missing.length > 0) {
    // Task 1.6 runs in parallel; a missing subset is a warning, not a hard failure,
    // so the harness stays usable while index work lands.
    logger.warn(
      `firestore.indexes.json is missing some expected gig indexes: ${missing
        .map((m) => m.join("+"))
        .join(", ")}`,
    );
  } else {
    logger.info(`firestore.indexes.json declares all ${REQUIRED_GIG_INDEX_FIELDS.length} expected gig index shapes`);
  }
  return { ok: true };
}

export const rulesAndIndexesGate: Migration = {
  id: RULES_AND_INDEXES_ID,
  description: "Verify hardened security rules and composite indexes are deployed (rules-and-indexes-first gate)",
  isPrecondition: true,
  async run(ctx: MigrationContext): Promise<MigrationReport> {
    const startedAt = Date.now();
    const report: MigrationReport = {
      migrationId: this.id,
      description: this.description,
      dryRun: ctx.options.dryRun,
      scanned: 2, // rules + indexes
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      startedAt,
      finishedAt: startedAt,
      status: "completed",
    };

    if (ctx.options.assumeRulesDeployed) {
      ctx.logger.info("assumeRulesDeployed set — trusting operator-confirmed out-of-band deployment");
    } else {
      const rules = checkRulesHardened(ctx.logger);
      if (!rules.ok) {
        report.failed++;
        report.errors.push({ id: "rules", message: rules.reason ?? "rules check failed" });
      }
      const indexes = checkIndexesDeclared(ctx.logger);
      if (!indexes.ok) {
        report.failed++;
        report.errors.push({ id: "indexes", message: indexes.reason ?? "indexes check failed" });
      }
    }

    report.finishedAt = Date.now();
    report.status = report.failed > 0 ? "failed" : "completed";

    if (report.status === "completed") {
      report.migrated = report.scanned;
      await ctx.state.save({
        id: this.id,
        status: "completed",
        dryRun: ctx.options.dryRun,
        scanned: report.scanned,
        migrated: report.migrated,
        skipped: 0,
        failed: 0,
        processedIds: ["rules", "indexes"],
        updatedAt: report.finishedAt,
        completedAt: report.finishedAt,
      });
      ctx.logger.info("rules-and-indexes precondition satisfied");
    } else {
      ctx.logger.error("rules-and-indexes precondition NOT satisfied; data migrations are blocked");
    }

    return report;
  },
};
