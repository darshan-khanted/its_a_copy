/**
 * Cloud Storage security-rule regression tests (Task 1.10, Phase 0).
 *
 * Proves the default-deny baseline in `storage.rules` (Task 1.5):
 *   - No client (anonymous or authenticated) can write to Storage, because all
 *     uploads flow through the authenticated server route (req 21.8, NFR-3.1).
 *   - Identity documents under uploads/aadhars/** are unreachable for read or
 *     write by any client (req 21.9, NFR-3.6).
 *   - Display assets (avatars, gig photos) remain publicly readable so their
 *     download URLs render, while writes stay server-only.
 *
 * Requires the Storage emulator (see firebase.json). Run via `npm run
 * test:rules` under `firebase emulators:exec`.
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  getBytes,
  ref,
  uploadString,
  type FirebaseStorage,
} from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, '../../storage.rules');

const USER = 'user_uid_1';

let testEnv: RulesTestEnvironment;

const anon = (): FirebaseStorage => testEnv.unauthenticatedContext().storage();
const as = (uid: string): FirebaseStorage =>
  testEnv.authenticatedContext(uid).storage();

beforeAll(async () => {
  const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '').split(
    ':',
  );
  testEnv = await initializeTestEnvironment({
    projectId: 'qwick-gig-rules-test',
    storage: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: host || '127.0.0.1',
      port: Number(port || 9199),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
  // Seed a display asset with rules disabled so the public-read control has a
  // real object to fetch.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const storage = ctx.storage();
    await uploadString(ref(storage, 'uploads/avatars/a.txt'), 'avatar-bytes');
    await uploadString(
      ref(storage, 'uploads/aadhars/secret.txt'),
      'kyc-bytes',
    );
  });
});

describe('clients can never write to Storage', () => {
  it('an anonymous client cannot upload an avatar', async () => {
    await assertFails(
      uploadString(ref(anon(), 'uploads/avatars/hack.txt'), 'x'),
    );
  });

  it('an authenticated client cannot upload a gig photo', async () => {
    await assertFails(
      uploadString(ref(as(USER), 'uploads/gigs/hack.txt'), 'x'),
    );
  });

  it('an authenticated client cannot upload to an unknown path', async () => {
    await assertFails(
      uploadString(ref(as(USER), 'uploads/anything/hack.txt'), 'x'),
    );
  });
});

describe('identity documents are unreachable by any client', () => {
  it('an authenticated client cannot read an identity document', async () => {
    await assertFails(getBytes(ref(as(USER), 'uploads/aadhars/secret.txt')));
  });

  it('an anonymous client cannot read an identity document', async () => {
    await assertFails(getBytes(ref(anon(), 'uploads/aadhars/secret.txt')));
  });

  it('a client cannot write an identity document', async () => {
    await assertFails(
      uploadString(ref(as(USER), 'uploads/aadhars/forged.txt'), 'x'),
    );
  });
});

describe('unspecified storage paths are denied', () => {
  it('a client cannot read an arbitrary path', async () => {
    await assertFails(getBytes(ref(as(USER), 'random/thing.txt')));
  });

  it('a client cannot write an arbitrary path', async () => {
    await assertFails(uploadString(ref(as(USER), 'random/thing.txt'), 'x'));
  });
});

describe('display assets stay publicly readable', () => {
  it('anyone can read an avatar', async () => {
    await assertSucceeds(getBytes(ref(anon(), 'uploads/avatars/a.txt')));
  });
});
