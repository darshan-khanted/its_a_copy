import {
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from "../config/firebase";
import { DEFAULT_OPTIONS, MigrationOptions, MigrationReport } from "./framework";
import { createRunner, MIGRATIONS } from "./registry";

/**
 * CLI entry point for the versioned migration harness (design §G.8, requirement 31.1).
 *
 * Usage:
 *   tsx server/migrations/cli.ts run [--dry-run] [--only=<id>] [--no-resume] [--assume-rules-deployed]
 *   tsx server/migrations/cli.ts status
 *   tsx server/migrations/cli.ts list
 *
 * Every data migration is resumable and idempotent, and `--dry-run` performs no writes
 * while still producing a full report. Rules-and-indexes ordering is enforced by the
 * runner: data migrations refuse to run until the precondition gate has completed.
 */

interface ParsedArgs {
  command: "run" | "status" | "list";
  options: MigrationOptions;
  only?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "run", ...rest] = argv;
  const options: MigrationOptions = { ...DEFAULT_OPTIONS };
  let only: string | undefined;

  for (const arg of rest) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-resume") options.resume = false;
    else if (arg === "--assume-rules-deployed") options.assumeRulesDeployed = true;
    else if (arg.startsWith("--only=")) only = arg.slice("--only=".length);
    else if (arg.startsWith("--batch-size=")) options.batchSize = Number(arg.slice("--batch-size=".length)) || options.batchSize;
  }

  if (command !== "run" && command !== "status" && command !== "list") {
    throw new Error(`Unknown command: ${command}. Use run | status | list.`);
  }
  return { command: command as ParsedArgs["command"], options, only };
}

function printReport(report: MigrationReport): void {
  const tag = report.dryRun ? "[dry-run] " : "";
  console.log(
    `${tag}${report.migrationId}: ${report.status.toUpperCase()} ` +
      `(scanned=${report.scanned} migrated=${report.migrated} skipped=${report.skipped} failed=${report.failed})`,
  );
  for (const e of report.errors) {
    console.log(`    ! ${e.id}: ${e.message}`);
  }
}

async function main(): Promise<void> {
  const { command, options, only } = parseArgs(process.argv.slice(2));
  const runner = createRunner();

  if (command === "list") {
    console.log("Registered migrations (in order):");
    for (const m of MIGRATIONS) {
      const reqs = m.requires?.length ? ` requires=[${m.requires.join(", ")}]` : "";
      console.log(`  - ${m.id}${m.isPrecondition ? " (precondition)" : ""}${reqs}`);
      console.log(`      ${m.description}`);
    }
    return;
  }

  const db = getFirebaseAdminDb();
  const auth = getFirebaseAdminAuth();

  if (command === "status") {
    const states = await runner.status(db);
    console.log("Migration status:");
    for (const s of states) {
      const when = s.updatedAt ? new Date(s.updatedAt).toISOString() : "never";
      console.log(
        `  - ${s.id}: ${s.status} (migrated=${s.migrated} skipped=${s.skipped} failed=${s.failed}, updated ${when})`,
      );
    }
    return;
  }

  // command === "run"
  console.log(
    `Running migrations${options.dryRun ? " in DRY-RUN mode" : ""}` +
      `${only ? ` (only: ${only})` : ""} (resume=${options.resume})`,
  );

  const reports = only
    ? [await runner.runOne(only, db, auth, options)]
    : await runner.runAll(db, auth, options);

  console.log("\n=== Migration summary ===");
  reports.forEach(printReport);

  const failed = reports.some((r) => r.status === "failed");
  if (failed) {
    console.error("\nOne or more migrations failed. See errors above.");
    process.exitCode = 1;
  } else {
    console.log("\nAll migrations completed successfully.");
  }
}

main().catch((err) => {
  console.error("Migration harness crashed:", err?.message ?? err);
  process.exitCode = 1;
});
