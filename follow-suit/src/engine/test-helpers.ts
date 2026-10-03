// Helpers for tests. Cards come from short labels: `7S`, `10H`, `KD`, `AC`.
// A wild 8 in a chain names its suit after `>`: `8D>H` is the 8 of diamonds naming hearts.

import { addToChain } from './chain';
import type { Card, ChainLink, Rank, Suit } from './types';

const RANKS: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
};

let made = 0;

/** Makes one card with a unique id. */
export function card(label: string): Card {
  const suit = label.slice(-1) as Suit;
  const rank = RANKS[label.slice(0, -1)];
  if (rank === undefined || !'SHDC'.includes(suit)) throw new Error(`Bad card label: ${label}`);
  made += 1;
  return { id: `${label}#${made}`, suit, rank };
}

/** Makes cards from labels separated by spaces. */
export function cards(labels: string): Card[] {
  return labels.trim().split(/\s+/).map(card);
}

/** Builds a chain with the engine's own follow rules. */
export function buildChain(spec: string): ChainLink[] {
  let chain: ChainLink[] = [];
  for (const token of spec.trim().split(/\s+/)) {
    const [label, named] = token.split('>');
    chain = addToChain(chain, card(label), named as Suit | undefined);
  }
  return chain;
}
