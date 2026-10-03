import { CONFIG } from '../config';
import type { Card, Color, Rank, Suit } from './types';

/** Display order. Colors alternate so that a sorted hand is easy to read. */
export const SUITS: readonly Suit[] = ['S', 'H', 'C', 'D'];

export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_NAMES: Readonly<Record<Suit, string>> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

/** U+FE0E asks for the text form, so that phones do not draw the suits as emoji. */
export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = {
  S: '♠︎',
  H: '♥︎',
  D: '♦︎',
  C: '♣︎',
};

const FACE_LABELS: Readonly<Record<number, string>> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** A fresh 52-card deck. Ids are `c1` to `c52`. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ id: `c${deck.length + 1}`, suit, rank });
  }
  return deck;
}

export function rankPoints(rank: Rank): number {
  if (rank === 14) return CONFIG.cards.acePoints;
  if (rank > 10) return CONFIG.cards.facePoints;
  return rank;
}

export function cardPoints(card: Card): number {
  return rankPoints(card.rank);
}

export function suitColor(suit: Suit): Color {
  return suit === 'H' || suit === 'D' ? 'red' : 'black';
}

export function cardColor(card: Card): Color {
  return suitColor(card.suit);
}

/** J, Q and K. */
export function isFaceCard(card: Card): boolean {
  return card.rank >= 11 && card.rank <= 13;
}

export function rankLabel(rank: Rank): string {
  return FACE_LABELS[rank] ?? String(rank);
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOLS[card.suit]}`;
}

/** Sorts by suit in display order, then by rank. Returns a new array. */
export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank);
}
