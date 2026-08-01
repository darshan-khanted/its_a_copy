import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRECISION_MAP_ROUTE_PREFIXES,
  assertPrecisionMapAllowed,
  isPrecisionMapRoute,
} from './precisionMap';

describe('the Google Maps boundary (reqs 3.10, 28.8, NFR-1.1)', () => {
  it('permits only the address-picking and post-handshake routes', () => {
    expect(PRECISION_MAP_ROUTE_PREFIXES).toEqual(['/flare', '/live']);
    expect(isPrecisionMapRoute('/flare')).toBe(true);
    expect(isPrecisionMapRoute('/live/hs_123')).toBe(true);
  });

  it('rejects every browse surface, the Field above all', () => {
    for (const route of ['/hood/560102', '/hood/560102/board', '/g/gig_1', '/me', '/', '']) {
      expect(isPrecisionMapRoute(route)).toBe(false);
      expect(() => assertPrecisionMapAllowed(route)).toThrow(/precision map is not available/);
    }
  });

  it('does not treat a lookalike prefix as a precision route', () => {
    expect(isPrecisionMapRoute('/flares')).toBe(false);
    expect(isPrecisionMapRoute('/livestream')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Static guard: the Field route's module graph must contain zero Maps JavaScript.
// A regression here is worth ~90 KB on the critical path of the home screen, so it
// is checked as source text rather than left to a bundle report.
// ---------------------------------------------------------------------------

/** Repo-root-relative source tree; vitest always runs from the project root. */
const SRC = join(process.cwd(), 'src') + '/';

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no Google Maps JavaScript on the Field route (req 3.10, 28.8)', () => {
  it('keeps the Maps package out of every Field module', () => {
    const offenders = sources(join(SRC, 'features', 'field')).filter((file) =>
      /@vis\.gl|google\.maps|APIProvider/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('references the Maps package from exactly one module, as a dynamic import', () => {
    const referencing = sources(SRC)
      .filter((file) => /@vis\.gl/.test(readFileSync(file, 'utf8')))
      .sort();
    expect(referencing.map((f) => f.slice(SRC.length))).toEqual([
      'features/map/precisionMap.test.ts',
      'features/map/precisionMap.ts',
    ]);
    const loader = readFileSync(join(SRC, 'features', 'map', 'precisionMap.ts'), 'utf8');
    // dynamic only: no top-level `from '@vis.gl/...'` import
    expect(loader).not.toMatch(/^\s*import[^\n]*from\s*['"]@vis\.gl/m);
    expect(loader).toMatch(/import\(\s*['"]@vis\.gl\/react-google-maps['"]\s*\)/);
  });
});
