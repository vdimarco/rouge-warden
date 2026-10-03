import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createRng, formatSeed, normalizeSeed, seedState } from './rng';

function firstValues(seed: string, count: number): number[] {
  const rng = createRng(seedState(seed));
  return Array.from({ length: count }, () => rng.next());
}

describe('seeded generator', () => {
  it('gives the same sequence for the same seed', () => {
    expect(firstValues('K7QX2M', 20)).toEqual(firstValues('K7QX2M', 20));
  });

  it('gives a different sequence for a different seed', () => {
    expect(firstValues('K7QX2M', 5)).not.toEqual(firstValues('K7QX2N', 5));
  });

  it('gives floats from 0 up to 1', () => {
    for (const value of firstValues('RANGE', 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('gives every integer below n and none outside', () => {
    const rng = createRng(seedState('INTS'));
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const n = rng.int(5);
      expect(Number.isInteger(n)).toBe(true);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('continues the same sequence from a saved state', () => {
    const rng = createRng(seedState('SAVE'));
    rng.next();
    rng.next();
    const restored = createRng(rng.state);
    expect(restored.next()).toBe(rng.next());
    expect(restored.int(52)).toBe(rng.int(52));
  });

  it('stores its state as one whole number', () => {
    const rng = createRng(seedState('STATE'));
    rng.next();
    expect(Number.isInteger(rng.state)).toBe(true);
    expect(rng.state).toBeGreaterThanOrEqual(0);
    expect(rng.state).toBeLessThan(2 ** 32);
  });

  it('shuffles into a new array with the same items', () => {
    const items = Array.from({ length: 52 }, (_, i) => i);
    const shuffled = createRng(seedState('SHUFFLE')).shuffle(items);
    expect(shuffled).not.toBe(items);
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
  });

  it('shuffles the same way for the same seed', () => {
    const items = Array.from({ length: 52 }, (_, i) => i);
    expect(createRng(seedState('SAME')).shuffle(items)).toEqual(createRng(seedState('SAME')).shuffle(items));
  });

  it('picks an item from a list', () => {
    const rng = createRng(seedState('PICK'));
    for (let i = 0; i < 50; i += 1) expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
  });
});

describe('seeds', () => {
  it('ignores case and spaces in typed seeds', () => {
    expect(normalizeSeed('  k7qx 2m ')).toBe('K7QX2M');
  });

  it('gives an empty seed for blank input', () => {
    expect(normalizeSeed('   ')).toBe('');
  });

  it('formats random numbers as a seed from the seed alphabet', () => {
    const seed = formatSeed([0, 1, 2, 30, 31, 4_000_000_000]);
    expect(seed).toHaveLength(CONFIG.seed.length);
    for (const char of seed) expect(CONFIG.seed.alphabet).toContain(char);
    expect(seed.slice(0, 3)).toBe('234');
    expect(formatSeed([5, 6, 7, 8, 9, 10])).toBe(formatSeed([5, 6, 7, 8, 9, 10]));
  });
});
