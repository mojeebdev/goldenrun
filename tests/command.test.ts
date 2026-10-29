import { describe, expect, it } from 'vitest';
import { CANONICAL_SHOT, RULESET_VERSION, makeCommand, quantizeField, simulateShot, validateShotCommand } from '../src/shared/rules';

describe('ShotCommand validation', () => {
  it('accepts a well-formed command', () => {
    expect(validateShotCommand(CANONICAL_SHOT)).toEqual({ ok: true, command: CANONICAL_SHOT });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'shoot'],
    ['wrong ruleset', { ...CANONICAL_SHOT, rulesetVersion: 'gr-0.0.1' }],
    ['unknown scenario', { ...CANONICAL_SHOT, scenarioId: 'practice.moon-99.rookie' }],
    ['NaN power', { ...CANONICAL_SHOT, power: Number.NaN }],
    ['Infinity aimX', { ...CANONICAL_SHOT, aimX: Number.POSITIVE_INFINITY }],
    ['fractional spin', { ...CANONICAL_SHOT, spin: 10.5 }],
    ['string aimY', { ...CANONICAL_SHOT, aimY: '500' }],
    ['power too high', { ...CANONICAL_SHOT, power: 1001 }],
    ['aimY negative', { ...CANONICAL_SHOT, aimY: -1 }],
    ['spin too low', { ...CANONICAL_SHOT, spin: -1001 }],
    ['missing field', { rulesetVersion: RULESET_VERSION, scenarioId: CANONICAL_SHOT.scenarioId, aimX: 0, aimY: 0, power: 0 }],
  ])('rejects %s', (_name, input) => {
    expect(validateShotCommand(input).ok).toBe(false);
  });

  it('simulateShot refuses invalid commands', () => {
    expect(() => simulateShot({ ...CANONICAL_SHOT, power: 5000 })).toThrow();
  });

  it('quantises and clamps raw values', () => {
    expect(quantizeField('power', 1234.6)).toBe(1000);
    expect(quantizeField('spin', -1e9)).toBe(-1000);
    expect(quantizeField('aimX', 12.49)).toBe(12);
    expect(quantizeField('aimY', Number.NaN, 500)).toBe(500);
    expect(Object.is(quantizeField('aimX', -0.2), 0)).toBe(true);
    const c = makeCommand(CANONICAL_SHOT.scenarioId, { aimX: 9999, aimY: -3, power: 500.4, spin: 0.4 });
    expect(validateShotCommand(c).ok).toBe(true);
    expect(c).toMatchObject({ aimX: 1000, aimY: 0, power: 500, spin: 0 });
  });
});
