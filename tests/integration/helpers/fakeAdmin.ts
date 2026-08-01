import type { AdminAuthLike, AdminDbLike } from "../../../server/migrations/framework";

/**
 * In-memory Admin-Firestore / Admin-Auth doubles for the migration harness tests
 * (task 1.8). The migration harness is written against the narrow {@link AdminDbLike}
 * and {@link AdminAuthLike} surfaces (see server/migrations/framework.ts), so these
 * in-memory stores exercise the REAL migration logic end-to-end without a network
 * dependency. They faithfully implement merge/overwrite `set`, `update`, `get`, and
 * auto-id semantics so resume/idempotency behaviour is genuinely observed rather than
 * stubbed.
 *
 * NOTE ON EMULATORS: The rules-unit-testing security-rule suites (task 1.10) require a
 * running Firestore emulator. The migration harness itself talks to Admin SDK surfaces
 * that are trivially satisfied in-memory, so these behavioural tests do not need the
 * emulator. An emulator-backed variant would swap `FakeAdminDb`/`FakeAdminAuth` for the
 * real Admin SDK pointed at `FIRESTORE_EMULATOR_HOST`; the assertions below are written
 * to remain valid against such a backend.
 */

type DocData = Record<string, any>;

export class FakeAdminDb implements AdminDbLike {
  /** collectionName -> (docId -> data). Public so tests can inspect final state. */
  readonly store: Record<string, Map<string, DocData>> = {};
  /** Count of write operations, so tests can assert dry-run performs none. */
  writes = 0;
  private autoSeq = 0;

  private coll(name: string): Map<string, DocData> {
    if (!this.store[name]) this.store[name] = new Map();
    return this.store[name];
  }

  /** Convenience read accessor for assertions. */
  get(collectionName: string, id: string): DocData | undefined {
    return this.store[collectionName]?.get(id);
  }

  /** Convenience seeding accessor for arranging test fixtures. */
  seed(collectionName: string, id: string, data: DocData): void {
    this.coll(collectionName).set(id, { ...data });
  }

  collection(name: string) {
    const map = this.coll(name);
    const self = this;
    return {
      doc: (id?: string) => {
        const docId = id ?? `auto_${name}_${self.autoSeq++}`;
        return {
          id: docId,
          async get() {
            const exists = map.has(docId);
            return {
              exists,
              data: () => (exists ? { ...map.get(docId)! } : undefined),
            };
          },
          async set(data: DocData, options?: { merge?: boolean }) {
            self.writes++;
            if (options?.merge && map.has(docId)) {
              map.set(docId, { ...map.get(docId)!, ...data });
            } else {
              map.set(docId, { ...data });
            }
          },
          async update(data: DocData) {
            self.writes++;
            map.set(docId, { ...(map.get(docId) ?? {}), ...data });
          },
        };
      },
      async get() {
        const docs = Array.from(map.entries()).map(([id, data]) => ({
          id,
          data: () => ({ ...data }),
        }));
        return { size: docs.length, docs };
      },
    };
  }
}

export class FakeAdminAuth implements AdminAuthLike {
  /** normalisedEmail -> uid. Mutable so tests can add accounts between runs. */
  readonly emailToUid = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [email, uid] of Object.entries(initial)) {
      this.emailToUid.set(email.toLowerCase().trim(), uid);
    }
  }

  add(email: string, uid: string): void {
    this.emailToUid.set(email.toLowerCase().trim(), uid);
  }

  async getUserByEmail(email: string): Promise<{ uid: string; email?: string }> {
    const uid = this.emailToUid.get(email.toLowerCase().trim());
    if (!uid) {
      const err: any = new Error(`no user for ${email}`);
      err.code = "auth/user-not-found";
      throw err;
    }
    return { uid, email };
  }
}
