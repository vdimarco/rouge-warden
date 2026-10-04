// The 4 stamps. A stamp changes the run deck at once.

import { CONFIG } from '../config';
import type { Card, StampId, StampUse, Suit } from './types';

export interface StampDef {
  readonly id: StampId;
  readonly name: string;
  readonly text: string;
  /** How many deck cards the player picks. */
  readonly cards: number;
  /** True when the player also picks a suit. */
  readonly suit: boolean;
}

export const STAMPS: Readonly<Record<StampId, StampDef>> = {
  suit: { id: 'suit', name: 'Suit Stamp', text: 'Change one card to a suit you pick.', cards: 1, suit: true },
  copy: {
    id: 'copy',
    name: 'Copy Stamp',
    text: 'Pick two cards. The second card takes the rank of the first and keeps its own suit.',
    cards: 2,
    suit: false,
  },
  eight: { id: 'eight', name: 'Eight Stamp', text: 'Add a new 8 in a suit you pick.', cards: 0, suit: true },
  burn: {
    id: 'burn',
    name: 'Burn Stamp',
    text: `Remove one card. The deck cannot go below ${CONFIG.stamps.minDeckSize} cards.`,
    cards: 1,
    suit: false,
  },
};

/** The stamp use for the picked cards and suit, or null until every target is picked. */
export function stampUse(id: StampId, cardIds: readonly string[], suit: Suit | null): StampUse | null {
  const def = STAMPS[id];
  if (cardIds.length !== def.cards || (def.suit && suit === null)) return null;
  switch (id) {
    case 'suit':
      return { id, cardId: cardIds[0], suit: suit! };
    case 'copy':
      return { id, fromId: cardIds[0], toId: cardIds[1] };
    case 'eight':
      return { id, suit: suit! };
    case 'burn':
      return { id, cardId: cardIds[0] };
  }
}

export const STAMP_IDS: readonly StampId[] = ['suit', 'copy', 'eight', 'burn'];

/** The Burn Stamp needs a deck above the minimum size. The other stamps always work. */
export function canUseStamp(deck: readonly Card[], id: StampId): boolean {
  return id !== 'burn' || deck.length > CONFIG.stamps.minDeckSize;
}

/** Applies a stamp to a copy of the deck. `nextCardId` numbers the card that an Eight Stamp adds. */
export function applyStamp(
  deck: readonly Card[],
  nextCardId: number,
  use: StampUse,
): { deck: Card[]; nextCardId: number } {
  const find = (id: string): Card => {
    const card = deck.find((c) => c.id === id);
    if (!card) throw new Error(`Card ${id} is not in the deck`);
    return card;
  };
  const replace = (id: string, change: Partial<Card>) => deck.map((c) => (c.id === id ? { ...c, ...change } : c));

  switch (use.id) {
    case 'suit':
      return { deck: replace(find(use.cardId).id, { suit: use.suit }), nextCardId };
    case 'copy': {
      if (use.fromId === use.toId) throw new Error('The Copy Stamp needs two different cards');
      const from = find(use.fromId);
      return { deck: replace(find(use.toId).id, { rank: from.rank }), nextCardId };
    }
    case 'eight':
      return {
        deck: [...deck, { id: `c${nextCardId}`, suit: use.suit, rank: CONFIG.cards.wildRank }],
        nextCardId: nextCardId + 1,
      };
    case 'burn': {
      if (!canUseStamp(deck, 'burn')) throw new Error(`The deck cannot go below ${CONFIG.stamps.minDeckSize} cards`);
      const target = find(use.cardId);
      return { deck: deck.filter((c) => c.id !== target.id), nextCardId };
    }
  }
}
