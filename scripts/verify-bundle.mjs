#!/usr/bin/env node
// Bundle-integrity guard for CI (Phase 0, task 1.9).
//
// Static, dependency-free checks that fail the build on:
//   1. Umbrella Firebase imports  (import ... from 'firebase')      — Req 28.2
//   2. Unresolved '@/' path aliases                                 — Req 30.2, 30.3
//   3. Missing/dangling relative server modules                     — Req 30.9
//   4. The '@/' alias being declared in only one of vite/tsconfig   — Req 30.3
//
// The check is intentionally pure text analysis so it runs in milliseconds and
// requires no runtime, transpile, or network access. It complements — never
// replaces — the production build and type-check steps in the CI workflow.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = join(repoRoot, 'src');
const SERVER_ROOT = join(repoRoot, 'server');

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
// Order matters: try the bare path, then extensions, then directory index files.
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const INDEX_FILES = SOURCE_EXTS.map((e) => `index${e}`);

/** Recursively collect source files under `root`. */
function collectSources(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectSources(full));
    else if (SOURCE_EXTS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Extract module specifiers from import/export/require/dynamic-import statements.
 * Returns [{ spec, line }].
 */
function extractSpecifiers(code) {
  const specs = [];
  const patterns = [
    // import ... from '<spec>'   |   export ... from '<spec>'   |   import '<spec>'
    /(?:import|export)\b[^;'"]*?from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    // dynamic import('<spec>')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require('<spec>')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const spec = m[1];
      const line = code.slice(0, m.index).split('\n').length;
      specs.push({ spec, line });
    }
  }
  return specs;
}

/** Resolve a file-ish path by trying extensions and directory index files. */
function resolveModulePath(basePath) {
  for (const ext of RESOLVE_EXTS) {
    const candidate = basePath + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  if (existsSync(basePath) && statSync(basePath).isDirectory()) {
    for (const idx of INDEX_FILES) {
      const candidate = join(basePath, idx);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const errors = [];

// ---- Check 4: alias declared in BOTH bundler and TS config (Req 30.3) ----
const viteConfig = existsSync(join(repoRoot, 'vite.config.ts'))
  ? readFileSync(join(repoRoot, 'vite.config.ts'), 'utf8')
  : '';
const tsConfig = existsSync(join(repoRoot, 'tsconfig.json'))
  ? readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')
  : '';
const viteHasAlias = /['"]@['"]\s*:/.test(viteConfig);
const tsHasAlias = /['"]@\/\*['"]\s*:/.test(tsConfig);
if (!viteHasAlias) {
  errors.push(`vite.config.ts: missing '@' resolve.alias declaration (Req 30.3).`);
}
if (!tsHasAlias) {
  errors.push(`tsconfig.json: missing '@/*' paths declaration (Req 30.3).`);
}

// ---- Walk every client + server source file ----
const clientFiles = collectSources(SRC_ROOT);
const serverFiles = collectSources(SERVER_ROOT);

for (const file of [...clientFiles, ...serverFiles]) {
  const code = readFileSync(file, 'utf8');
  const rel = relative(repoRoot, file);
  for (const { spec, line } of extractSpecifiers(code)) {
    // ---- Check 1: umbrella Firebase import (Req 28.2) ----
    if (spec === 'firebase') {
      errors.push(
        `${rel}:${line} umbrella Firebase import 'firebase' — use modular 'firebase/app', 'firebase/auth', 'firebase/firestore', etc. (Req 28.2).`
      );
      continue;
    }

    // ---- Check 2: '@/' alias resolution (Req 30.2, 30.3) ----
    if (spec.startsWith('@/')) {
      const target = join(SRC_ROOT, spec.slice(2));
      if (!resolveModulePath(target)) {
        errors.push(`${rel}:${line} unresolved '@/' alias import '${spec}' — no matching file under src/ (Req 30.2).`);
      }
      continue;
    }

    // ---- Check 3: relative module resolution (Req 30.9 for server) ----
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const target = resolve(dirname(file), spec);
      if (!resolveModulePath(target)) {
        const isServer = file.startsWith(SERVER_ROOT);
        const label = isServer ? 'missing server module' : 'missing module';
        errors.push(`${rel}:${line} ${label}: relative import '${spec}' does not resolve to a file (Req 30.9).`);
      }
    }
    // Bare package specifiers (react, express, firebase/*, ...) are left to the
    // type-check and production build, which already fail on a missing package.
  }
}

const scanned = clientFiles.length + serverFiles.length;
if (errors.length > 0) {
  console.error(`\n✗ Bundle verification failed (${errors.length} issue(s) across ${scanned} files):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ Bundle verification passed: ${scanned} source files, no umbrella Firebase imports, all '@/' aliases and server modules resolve.`);
