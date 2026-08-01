import crypto from "crypto";

/**
 * Shared helpers for the migration harness (design §G.8, requirements 31.1/31.5/31.9).
 * These are intentionally dependency-free so they can be reused by the harness, the
 * compatibility layer, and the migration tests (task 1.8).
 */

export interface MigrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Prefixes every line with the migration/runner scope so operator logs stay readable. */
export function createLogger(scope: string, silent = false): MigrationLogger {
  const tag = `[migrate:${scope}]`;
  return {
    info: (m) => {
      if (!silent) console.log(`${tag} ${m}`);
    },
    warn: (m) => {
      if (!silent) console.warn(`${tag} ${m}`);
    },
    error: (m) => {
      if (!silent) console.error(`${tag} ${m}`);
    },
  };
}

/** Normalises an email the same way the auth routes do (lowercase + trim). */
export function normalizeEmail(email: string): string {
  return String(email || "").toLowerCase().trim();
}

/**
 * Deterministic email-hash index key (requirement 31.5). SHA-256 of the normalised
 * email keeps PII out of document paths while remaining a stable lookup key across
 * runs — which is also what makes the `emailIndex` write idempotent.
 */
export function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

/** True when a `users` document id is a legacy email key rather than a Firebase UID. */
export function looksLikeEmail(value: string): boolean {
  return typeof value === "string" && value.includes("@");
}

/** Splits an array into fixed-size chunks for batched writes. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
