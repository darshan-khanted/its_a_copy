// Permitted persisted UI preferences (design §G.3, requirements 7.4, 25.1).
// ONLY the last hood and the last Field/Board surface preference are persisted — never
// server data, never route/thread/modal state (that lives in the URL, requirement 25.5).

const LAST_HOOD_KEY = 'qwick_last_hood';
const LAST_MODE_KEY = 'qwick_last_mode';

export type FieldMode = 'field' | 'board';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode / quota) — preferences are best-effort only.
  }
}

/** The last hood pincode the user browsed, used to resolve `/` and the FIELD nav slot. */
export function readLastHood(): string {
  const raw = safeGet(LAST_HOOD_KEY) ?? '';
  return /^[1-9][0-9]{5}$/.test(raw) ? raw : '';
}

export function writeLastHood(pincode: string): void {
  if (/^[1-9][0-9]{5}$/.test(pincode)) safeSet(LAST_HOOD_KEY, pincode);
}

/** The last Field/Board surface the user chose, restored on return (requirement 7.4). */
export function readLastMode(): FieldMode {
  return safeGet(LAST_MODE_KEY) === 'board' ? 'board' : 'field';
}

export function writeLastMode(mode: FieldMode): void {
  safeSet(LAST_MODE_KEY, mode);
}

/** Build the hood surface path for a pincode honouring the persisted mode preference. */
export function hoodPathForMode(pincode: string, mode: FieldMode = readLastMode()): string {
  return mode === 'board' ? `/hood/${pincode}/board` : `/hood/${pincode}`;
}

/** Resolve where `/` and the primary FIELD slot should land given persisted preferences. */
export function preferredEntryPath(): string {
  const hood = readLastHood();
  return hood ? hoodPathForMode(hood) : '/claim';
}
