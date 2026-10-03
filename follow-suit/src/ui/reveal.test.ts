import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { scoreChain } from '../engine';
import { buildChain, slots } from '../engine/test-helpers';
import { scaleStepHz } from './music';
import { revealBeats, revealLength, ringOffsets } from './reveal';

const F = CONFIG.feel;

describe('the major scale', () => {
  it('starts at the root and climbs the major scale', () => {
    expect(scaleStepHz(0)).toBeCloseTo(392, 6);
    expect(scaleStepHz(1)).toBeCloseTo(392 * 2 ** (2 / 12), 6);
    expect(scaleStepHz(2)).toBeCloseTo(392 * 2 ** (4 / 12), 6);
    expect(scaleStepHz(3)).toBeCloseTo(392 * 2 ** (5 / 12), 6);
  });

  it('goes up an octave after 7 steps', () => {
    expect(scaleStepHz(7)).toBeCloseTo(784, 6);
    expect(scaleStepHz(9)).toBeCloseTo(784 * 2 ** (4 / 12), 6);
  });
});

describe('the reveal timeline', () => {
  const result = scoreChain(buildChain('7S KS KH 4H 4C 7C'));

  it('plays each scoring step in order, then holds the score and counts the total up', () => {
    const beats = revealBeats(result, 0);
    expect(beats.map((beat) => beat.stage)).toEqual([
      ...result.steps.map(() => 'steps'),
      'score',
      'count',
    ]);
    expect(beats.filter((beat) => beat.stage === 'steps').map((beat) => beat.step!.kind)).toEqual(
      result.steps.map((step) => step.kind),
    );
  });

  it('gives each card about 180 ms', () => {
    const cards = revealBeats(result, 0).filter((beat) => beat.step?.kind === 'card');
    expect(cards).toHaveLength(6);
    for (const beat of cards) expect(beat.duration).toBe(F.cardMs);
    expect(F.cardMs).toBeGreaterThanOrEqual(150);
    expect(F.cardMs).toBeLessThanOrEqual(220);
  });

  it('starts each chain at the root and moves one scale step up for each switch', () => {
    const notes = revealBeats(result, 0).filter((beat) => beat.note !== null).map((beat) => beat.note);
    expect(notes).toEqual([0, 1]);
  });

  it('marks the ring beat', () => {
    const ring = revealBeats(result, 0).find((beat) => beat.step?.kind === 'ring')!;
    expect(ring.duration).toBe(F.ringMs);
    expect(ring.step!.timesMult).toBe(2);
  });

  it('adds one coin beat for each power-of-ten dollar', () => {
    const beats = revealBeats(result, 3);
    expect(beats.slice(-3).map((beat) => [beat.stage, beat.coin])).toEqual([
      ['coins', 0],
      ['coins', 1],
      ['coins', 2],
    ]);
  });

  it('times each beat after the one before it', () => {
    const beats = revealBeats(result, 2);
    for (let i = 1; i < beats.length; i += 1) expect(beats[i].at).toBe(beats[i - 1].at + beats[i - 1].duration);
    expect(revealLength(beats)).toBe(beats[beats.length - 1].at + beats[beats.length - 1].duration);
  });

  it('gives charm steps their own beats', () => {
    const charmed = scoreChain(buildChain('5H 9H'), { charms: slots({ H: 'lantern', table: 'longHaul' }) });
    const kinds = revealBeats(charmed, 0).map((beat) => `${beat.stage}:${beat.step?.source ?? beat.step?.kind ?? ''}`);
    expect(kinds).toEqual(['steps:card', 'steps:lantern', 'steps:card', 'steps:lantern', 'score:', 'count:']);
  });
});

describe('the ring shape', () => {
  it('places the cards around an ellipse, starting on the left and going over the top', () => {
    const [left, top, right, bottom] = ringOffsets(4);
    expect(left.x).toBeLessThan(0);
    expect(Math.abs(left.y)).toBeLessThan(1e-9);
    expect(top.y).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(bottom.y).toBeGreaterThan(0);
  });

  it('draws the back cards smaller and the front cards larger', () => {
    const [, top, , bottom] = ringOffsets(4);
    expect(top.scale).toBe(F.ringBackScale);
    expect(bottom.scale).toBe(F.ringFrontScale);
    expect(bottom.z).toBeGreaterThan(top.z);
  });

  it('keeps the ring inside the screen width', () => {
    for (let n = 4; n <= 12; n += 1) {
      for (const offset of ringOffsets(n)) expect(Math.abs(offset.x)).toBeLessThanOrEqual(F.ringRadiusXMax);
    }
  });
});
