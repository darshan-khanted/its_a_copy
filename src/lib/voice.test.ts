import { describe, it, expect } from 'vitest';
import {
  isFunctional,
  isExpressive,
  hasValidEmoji,
  emojiCount,
  namesAction,
  isNonApologetic,
  containsRealHoodName,
  isPlainTone,
  preserveUserAuthored,
} from './voice';

describe('voice constraints (§B.5)', () => {
  it('isFunctional accepts UPPERCASE mono and rejects lowercase/emoji', () => {
    expect(isFunctional('FIELD ⇄ BOARD')).toBe(true);
    expect(isFunctional('PRECISION: ON')).toBe(true);
    expect(isFunctional('Field')).toBe(false);
    expect(isFunctional('FIELD 🚀')).toBe(false);
  });

  it('isExpressive accepts lowercase voice and rejects Title-Case starts', () => {
    expect(isExpressive('your hood is quiet rn')).toBe(true);
    expect(isExpressive('e.g. HSR Layout, Sector 2')).toBe(true); // proper noun allowed
    expect(isExpressive('Oops something happened')).toBe(false);
    expect(isExpressive('SHOUTING')).toBe(false);
  });

  it('hasValidEmoji allows at most one at the end', () => {
    expect(hasValidEmoji('no emoji here')).toBe(true);
    expect(hasValidEmoji("tick this to prove you're not a menace 😤")).toBe(true);
    expect(hasValidEmoji('mid 😤 sentence emoji')).toBe(false);
    expect(hasValidEmoji('two 🚀 emoji 😤')).toBe(false);
    expect(emojiCount('a 😤 b 🚀')).toBe(2);
  });

  it('namesAction detects a next action', () => {
    expect(namesAction('tap to try again')).toBe(true);
    expect(namesAction('that is a lot of money — confirm to continue')).toBe(true);
    expect(namesAction('what do you need doing?')).toBe(true);
    expect(namesAction('this is fine')).toBe(false);
  });

  it('isNonApologetic rejects banned markers', () => {
    expect(isNonApologetic('that did not go through — tap retry')).toBe(true);
    expect(isNonApologetic('Oops!')).toBe(false);
    expect(isNonApologetic('sorry about that')).toBe(false);
    expect(isNonApologetic('something went wrong')).toBe(false);
  });

  it('containsRealHoodName checks the curated list', () => {
    expect(containsRealHoodName('search Indiranagar…')).toBe(true);
    expect(containsRealHoodName('search nowhere…')).toBe(false);
  });

  it('isPlainTone rejects humour markers and emoji', () => {
    expect(isPlainTone('meet somewhere public the first time')).toBe(true);
    expect(isPlainTone('be the menace who goes first')).toBe(false);
    expect(isPlainTone('all good 🚀')).toBe(false);
  });

  it('preserveUserAuthored is identity', () => {
    expect(preserveUserAuthored('MoVe My SoFa')).toBe('MoVe My SoFa');
  });
});
