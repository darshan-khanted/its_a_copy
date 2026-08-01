import { Migration, MigrationRunner } from "./framework";
import { rulesAndIndexesGate } from "./rulesAndIndexes";
import { rekeyUsersMigration } from "./rekeyUsers";
import { dualReadGigFieldsMigration } from "./dualReadGigFields";

/**
 * Ordered migration registry (design §G.8).
 *
 * Order matters: the rules-and-indexes precondition gate MUST be first so the runner
 * can enforce "rules and indexes before any data migration" (requirement 31.1). The
 * data migrations that follow each declare `requires: [deploy-rules-and-indexes]`.
 *
 * NOTE: This registry contains ONLY the migrations owned by task 1.7. The rating
 * recompute + rep replay (31.2/31.8, task 7.7), coordinate fuzzing/privacy (31.3/31.4,
 * task 9.1), and interestedUsers/proposal conversions (31.6/31.7, task 5.16) are added
 * by their respective later tasks.
 */
export const MIGRATIONS: Migration[] = [
  rulesAndIndexesGate,
  rekeyUsersMigration,
  dualReadGigFieldsMigration,
];

export function createRunner(): MigrationRunner {
  return new MigrationRunner(MIGRATIONS);
}
