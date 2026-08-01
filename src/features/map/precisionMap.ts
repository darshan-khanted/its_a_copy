/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE Google Maps boundary (design §C.1, §I.6; reqs 3.10, 28.8, NFR-1.1).
 *
 * The custom Field is the primary browse surface; Google Maps is demoted to a
 * *precision layer* used in exactly two places:
 *
 *   1. `/flare` — address picking while posting, where the poster needs a real
 *      map with real search to pin their actual location.
 *   2. `/live/:handshakeId` — the post-handshake location reveal, where both
 *      parties have consented to the exact point.
 *
 * Everywhere else, and above all on the Field route, Maps JavaScript is 0 KB
 * (req 3.10, NFR-1.1). Two mechanisms enforce that:
 *
 * - **Only a dynamic import.** `@vis.gl/react-google-maps` is referenced nowhere
 *   in this repository except inside {@link loadPrecisionMap}, so the bundler
 *   emits it as a separate chunk that the Field's module graph never pulls in.
 * - **A route guard.** {@link assertPrecisionMapAllowed} throws if the loader is
 *   called from any other route, so an accidental import from a browse surface
 *   fails loudly in development and in tests rather than silently costing ~90 KB
 *   on the critical path of the home screen.
 *
 * This module itself imports nothing from Maps at module scope, so importing it
 * is free.
 */

/** Route prefixes permitted to load the precision map (design §C.1). */
export const PRECISION_MAP_ROUTE_PREFIXES: readonly string[] = ['/flare', '/live'];

/** Whether a pathname is one of the two precision-map routes. */
export function isPrecisionMapRoute(pathname: string): boolean {
  if (typeof pathname !== 'string' || pathname === '') return false;
  return PRECISION_MAP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Guard the boundary. Throws on any route that is not an address-picking or
 * post-handshake reveal route — which includes every browse surface, and the
 * Field above all (reqs 3.10, 28.8).
 */
export function assertPrecisionMapAllowed(pathname: string): void {
  if (!isPrecisionMapRoute(pathname)) {
    throw new Error(
      `precision map is not available on ${pathname || '(unknown route)'}: ` +
        `Google Maps loads only on ${PRECISION_MAP_ROUTE_PREFIXES.join(' and ')}`,
    );
  }
}

/** The lazily-loaded Maps binding. Kept structural so no Maps type is imported here. */
export type PrecisionMapModule = Record<string, unknown>;

let cached: Promise<PrecisionMapModule> | null = null;

/**
 * Load the Maps binding on demand, once per session. The dynamic `import()` is
 * the *only* reference to the Maps package in the client, which is what keeps it
 * out of the Field route's chunk.
 */
export async function loadPrecisionMap(pathname: string): Promise<PrecisionMapModule> {
  assertPrecisionMapAllowed(pathname);
  if (!cached) {
    cached = import('@vis.gl/react-google-maps') as Promise<PrecisionMapModule>;
  }
  return cached;
}

/** Test seam: forget the cached module so loader behaviour can be re-exercised. */
export function resetPrecisionMapCache(): void {
  cached = null;
}
