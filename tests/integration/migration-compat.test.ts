import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  readGigAskPrice,
  readGigBody,
  normalizeGigForRead,
  computeGigBackfill,
  buildEmailIndexEntry,
  GIG_SCHEMA_VERSION,
  type DualReadGigFields,
} from "../../server/migrations/compat";
import { hashEmail, normalizeEmail, looksLikeEmail, chunk } from "../../server/migrations/util";

/**
 * Pure compatibility-layer + util tests (task 1.8, requirement 31.9 / 31.5).
 *
 * These need no Firebase backend at all: they validate the schema-versioned dual-read
 * resolution, the idempotent backfill patch computation, and the deterministic
 * email-hash keying that makes the rekey index create-once.
 */

describe("dual-read field resolution (req 31.9)", () => {
  it("prefers v2 askPrice/body over legacy v1 fields", () => {
    const gig: DualReadGigFields = { askPrice: 300, body: "new", price: 100, description: "old" };
    expect(readGigAskPrice(gig)).toBe(300);
    expect(readGigBody(gig)).toBe("new");
  });

  it("falls back to legacy v1 price/description when v2 fields are absent", () => {
    const gig: DualReadGigFields = { price: 150, description: "legacy body" };
    expect(readGigAskPrice(gig)).toBe(150);
    expect(readGigBody(gig)).toBe("legacy body");
  });

  it("defaults to 0 / empty string when neither version is present", () => {
    expect(readGigAskPrice({})).toBe(0);
    expect(readGigBody({})).toBe("");
  });

  it("normalizeGigForRead always surfaces populated v2 fields", () => {
    const legacy = normalizeGigForRead({ price: 99, description: "x" });
    expect(legacy.askPrice).toBe(99);
    expect(legacy.body).toBe("x");
    expect(legacy.schemaVersion).toBe(1); // default when unversioned
  });

  it("property: dual read always prefers a present v2 value, else v1, else default", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
        (askPrice, price) => {
          const resolved = readGigAskPrice({ askPrice, price });
          if (typeof askPrice === "number") expect(resolved).toBe(askPrice);
          else if (typeof price === "number") expect(resolved).toBe(price);
          else expect(resolved).toBe(0);
        },
      ),
    );
  });
});

describe("computeGigBackfill idempotency (req 31.9)", () => {
  it("returns a v2 patch for a legacy gig", () => {
    const patch = computeGigBackfill({ price: 200, description: "help move" });
    expect(patch).toEqual({ askPrice: 200, body: "help move", schemaVersion: GIG_SCHEMA_VERSION });
  });

  it("returns null when the gig is already current (rerun is a no-op)", () => {
    expect(
      computeGigBackfill({
        price: 200,
        description: "help move",
        askPrice: 200,
        body: "help move",
        schemaVersion: GIG_SCHEMA_VERSION,
      }),
    ).toBeNull();
  });

  it("property: applying the patch once makes the second computation a no-op", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.string(),
        (price, description) => {
          const gig: DualReadGigFields = { price, description };
          const patch = computeGigBackfill(gig);
          expect(patch).not.toBeNull();
          const upgraded = { ...gig, ...patch! };
          // Second pass over an upgraded gig yields no further work: idempotent.
          expect(computeGigBackfill(upgraded)).toBeNull();
        },
      ),
    );
  });
});

describe("email-hash index keying (req 31.5)", () => {
  it("hashEmail is deterministic and case/whitespace-insensitive", () => {
    expect(hashEmail("Alice@Example.com")).toBe(hashEmail("  alice@example.com "));
  });

  it("buildEmailIndexEntry produces the hashed key + uid payload", () => {
    const { key, entry } = buildEmailIndexEntry("Bob@Example.com", "uid-bob", 1234);
    expect(key).toBe(hashEmail("bob@example.com"));
    expect(entry).toEqual({ uid: "uid-bob", createdAt: 1234 });
  });

  it("normalizeEmail / looksLikeEmail behave as the rekey migration expects", () => {
    expect(normalizeEmail("  FOO@Bar.COM ")).toBe("foo@bar.com");
    expect(looksLikeEmail("someone@host")).toBe(true);
    expect(looksLikeEmail("a-firebase-uid-1234")).toBe(false);
  });

  it("property: distinct normalised emails never collide to the same hash key", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.emailAddress(),
        (a, b) => {
          fc.pre(normalizeEmail(a) !== normalizeEmail(b));
          expect(hashEmail(a)).not.toBe(hashEmail(b));
        },
      ),
    );
  });
});

describe("chunk util", () => {
  it("splits into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns a single batch for non-positive sizes", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});
