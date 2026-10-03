// The one seeded generator. Every random choice in a run comes from it.
// It is mulberry32, so its whole state is one 32-bit number that the run state can store.

import { CONFIG } from '../config';

export interface Rng {
  /** A float from 0 up to 1. */
  next(): number;
  /** A whole number from 0 up to n - 1. */
  int(n: number): number;
  /** One item from a list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy of a list. */
  shuffle<T>(items: readonly T[]): T[];
  /** The current state. `createRng(state)` continues the same sequence. */
  readonly state: number;
}

export function createRng(state: number): Rng {
  let s = state >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const int = (n: number): number => Math.floor(next() * n);

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[int(items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    get state() {
      return s;
    },
  };
}

/** Hashes seed text to a start state (FNV-1a, then a murmur3 finish to spread the bits). */
export function seedState(seed: string): number {
  let h = 0x811c9dc5;
  for (const char of seed) {
    h ^= char.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Cleans typed seed text: no spaces, upper case. Any other text is a valid seed. */
export function normalizeSeed(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Turns random whole numbers into a seed from the seed alphabet. */
export function formatSeed(values: readonly number[]): string {
  const { alphabet, length } = CONFIG.seed;
  return values
    .slice(0, length)
    .map((value) => alphabet[Math.abs(Math.trunc(value)) % alphabet.length])
    .join('');
}
