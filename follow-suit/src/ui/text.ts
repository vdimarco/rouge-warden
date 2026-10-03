import { rankLabel, SUIT_NAMES, SUIT_SYMBOLS, type Card, type Rank } from '../engine';

const RANK_NAMES: Readonly<Record<number, string>> = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

export function rankName(rank: Rank): string {
  return RANK_NAMES[rank] ?? String(rank);
}

/** "King of spades". */
export function cardName(card: Card): string {
  return `${rankName(card.rank)} of ${SUIT_NAMES[card.suit]}`;
}

/** "KS", "10H": a stable label for tests and data attributes. */
export function cardCode(card: Card): string {
  return `${rankLabel(card.rank)}${card.suit}`;
}

export function suitSymbol(card: Card): string {
  return SUIT_SYMBOLS[card.suit];
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
