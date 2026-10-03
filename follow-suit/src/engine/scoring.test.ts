import { describe, expect, it } from 'vitest';
import { previewChain, scoreChain } from './scoring';
import { buildChain } from './test-helpers';

describe('scoring with no charms', () => {
  it('scores the brief test case: 7S KS KH 4H 4C 7C is 42 times 6, which is 252', () => {
    const result = scoreChain(buildChain('7S KS KH 4H 4C 7C'));
    expect(result.value).toBe(42);
    expect(result.mult).toBe(6);
    expect(result.score).toBe(252);
    expect(result.switches).toBe(2);
    expect(result.ring).toBe(true);
    expect(result.money).toBe(0);
  });

  it('scores a chain with no ring as Value times 1 plus the switches', () => {
    const result = scoreChain(buildChain('5H 9H 9C'));
    expect(result.value).toBe(23);
    expect(result.mult).toBe(2);
    expect(result.score).toBe(46);
    expect(result.ring).toBe(false);
  });

  it('scores one card as its points', () => {
    expect(scoreChain(buildChain('AS')).score).toBe(11);
  });

  it('adds a switch for an 8 that names a new suit', () => {
    const result = scoreChain(buildChain('5S 8H>D 9D'));
    expect(result.value).toBe(22);
    expect(result.mult).toBe(2);
    expect(result.score).toBe(44);
  });

  it('adds no switch for an 8 that names the current suit', () => {
    const result = scoreChain(buildChain('5S 8H>S 9S'));
    expect(result.mult).toBe(1);
    expect(result.score).toBe(22);
  });

  it('applies the ring after the switches', () => {
    const result = scoreChain(buildChain('7S 9S 9H 7H'));
    expect(result.value).toBe(32);
    expect(result.mult).toBe(4);
    expect(result.score).toBe(128);
  });

  it('gives no ring to a chain of 3', () => {
    const result = scoreChain(buildChain('7S 9S 2S'));
    expect(result.ring).toBe(false);
    expect(result.score).toBe(18);
  });

  it('scores an empty chain as 0', () => {
    const result = scoreChain([]);
    expect(result.score).toBe(0);
    expect(result.steps).toEqual([]);
  });
});

describe('scoring steps', () => {
  const result = scoreChain(buildChain('7S KS KH 4H 4C 7C'));

  it('adds card points in chain order', () => {
    const cardSteps = result.steps.filter((step) => step.kind === 'card');
    expect(cardSteps.map((step) => step.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cardSteps.map((step) => step.addValue)).toEqual([7, 10, 10, 4, 4, 7]);
  });

  it('adds Mult for each switch, right after the card that caused it', () => {
    const kinds = result.steps.map((step) => `${step.kind}${step.index ?? ''}`);
    expect(kinds).toEqual(['card0', 'card1', 'card2', 'switch2', 'card3', 'card4', 'switch4', 'card5', 'ring']);
    const switches = result.steps.filter((step) => step.kind === 'switch');
    expect(switches.map((step) => step.addMult)).toEqual([1, 1]);
  });

  it('keeps running totals that end at the final Value and Mult', () => {
    expect(result.steps.map((step) => [step.value, step.mult])).toEqual([
      [7, 1], [17, 1], [27, 1], [27, 2], [31, 2], [35, 2], [35, 3], [42, 3], [42, 6],
    ]);
  });

  it('multiplies Mult by 2 in the ring step', () => {
    const ring = result.steps[result.steps.length - 1];
    expect(ring.kind).toBe('ring');
    expect(ring.timesMult).toBe(2);
    expect(ring.index).toBeNull();
  });
});

describe('live preview', () => {
  it('shows base Value, 1 plus the switches, and the ring flag', () => {
    expect(previewChain(buildChain('7S KS KH 4H 4C 7C'))).toEqual({ value: 42, mult: 3, switches: 2, ring: true });
  });

  it('shows a short chain with no ring', () => {
    expect(previewChain(buildChain('5H 9H 9C'))).toEqual({ value: 23, mult: 2, switches: 1, ring: false });
  });

  it('shows an empty chain as Value 0 and Mult 1', () => {
    expect(previewChain([])).toEqual({ value: 0, mult: 1, switches: 0, ring: false });
  });
});
