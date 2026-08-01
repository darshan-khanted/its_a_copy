import { describe, it, expect } from 'vitest';
import { errors } from './errors';
import { loading } from './loading';
import { empty, authGate } from './empty';
import { labels, showingOf, hoodProgress } from './labels';
import { placeholders } from './placeholders';
import { safety } from './safety';
import {
  validateError,
  validateExpressive,
  validateFunctional,
  validateSafety,
  validateLocationPlaceholder,
} from '@/lib/voice';

/** Collect every leaf string from a nested record. */
function leaves(obj: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out.push([k, v]);
    else if (Array.isArray(v)) v.forEach((s, i) => typeof s === 'string' && out.push([`${k}[${i}]`, s]));
    else if (v && typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        if (typeof v2 === 'string') out.push([`${k}.${k2}`, v2]);
      }
    }
  }
  return out;
}

describe('copy module voice compliance (req 2.1–2.8)', () => {
  it('errors are expressive, actionable, and non-apologetic (req 2.2, 2.7)', () => {
    const violations = leaves(errors).flatMap(([k, s]) => validateError(k, s));
    expect(violations).toEqual([]);
  });

  it('loading states are expressive (req 2.2)', () => {
    const violations = leaves(loading).flatMap(([k, s]) => validateExpressive(k, s));
    expect(violations).toEqual([]);
  });

  it('empty states are expressive (req 2.2)', () => {
    const violations = leaves(empty).flatMap(([k, s]) => validateExpressive(k, s));
    expect(violations).toEqual([]);
  });

  it('auth-gate prompts are expressive (req 2.2, 23.3)', () => {
    const violations = leaves(authGate).flatMap(([k, s]) => validateExpressive(k, s));
    expect(violations).toEqual([]);
  });

  it('labels are UPPERCASE MONO with no emoji (req 2.3, 2.5)', () => {
    const violations = leaves(labels).flatMap(([k, s]) => validateFunctional(k, s));
    expect(violations).toEqual([]);
  });

  it('label templates are functional', () => {
    expect(validateFunctional('showingOf', showingOf(60, 143))).toEqual([]);
    expect(validateFunctional('hoodProgress', hoodProgress(12, 50))).toEqual([]);
  });

  it('safety copy is plain and non-humorous (req 2.6)', () => {
    const violations = leaves(safety).flatMap(([k, s]) => validateSafety(k, s));
    expect(violations).toEqual([]);
  });

  it('location placeholders use real hood names; others are expressive (req 2.8)', () => {
    const locationKeys = new Set(['areaName', 'pincode', 'boardSearch']);
    const violations = leaves(placeholders).flatMap(([k, s]) =>
      locationKeys.has(k) ? validateLocationPlaceholder(k, s) : validateExpressive(k, s),
    );
    expect(violations).toEqual([]);
  });

  it('no user-facing string is empty (req 2.2)', () => {
    const all = [
      ...leaves(errors),
      ...leaves(loading),
      ...leaves(empty),
      ...leaves(labels),
      ...leaves(placeholders),
      ...leaves(safety),
    ];
    for (const [k, s] of all) {
      expect(s.trim(), `${k} must not be empty`).not.toBe('');
    }
  });
});
