// Chains: follow rules, 8s and named suits, switches and rings.

import { CONFIG } from '../config';
import { SUITS } from './cards';
import type { Card, ChainLink, FollowVia, Suit } from './types';

/** The suit that the next card must match, or null for an empty chain. */
export function currentSuit(chain: readonly ChainLink[]): Suit | null {
  return chain.length === 0 ? null : chain[chain.length - 1].suit;
}

/** A wild card follows any card and names the next current suit. */
export function isWild(card: Card): boolean {
  return card.rank === CONFIG.cards.wildRank;
}

export function needsNamedSuit(card: Card): boolean {
  return isWild(card);
}

/** The suits the player can name for this card. Empty when the card names no suit. */
export function namedSuitOptions(_chain: readonly ChainLink[], card: Card): Suit[] {
  return needsNamedSuit(card) ? [...SUITS] : [];
}

/** How the card can follow the chain, or null if it cannot. */
export function followVia(chain: readonly ChainLink[], card: Card): FollowVia | null {
  if (chain.length === 0) return 'first';
  const last = chain[chain.length - 1];
  if (card.suit === last.suit) return 'suit';
  if (card.rank === last.card.rank) return 'rank';
  if (isWild(card)) return 'eight';
  return null;
}

function inChain(chain: readonly ChainLink[], card: Card): boolean {
  return chain.some((link) => link.card.id === card.id);
}

export function canFollow(chain: readonly ChainLink[], card: Card): boolean {
  return !inChain(chain, card) && followVia(chain, card) !== null;
}

/** The cards that can join the chain next, in the order given. */
export function legalCards(chain: readonly ChainLink[], cards: readonly Card[]): Card[] {
  return cards.filter((card) => canFollow(chain, card));
}

/** Adds a card to a new copy of the chain. Throws if the card cannot join. */
export function addToChain(chain: readonly ChainLink[], card: Card, namedSuit?: Suit): ChainLink[] {
  if (inChain(chain, card)) throw new Error(`Card ${card.id} is already in the chain`);
  const via = followVia(chain, card);
  if (via === null) throw new Error(`Card ${card.id} cannot follow the chain`);

  let suit: Suit = card.suit;
  if (needsNamedSuit(card)) {
    if (namedSuit === undefined || !namedSuitOptions(chain, card).includes(namedSuit)) {
      throw new Error(`Card ${card.id} needs one of these named suits: ${namedSuitOptions(chain, card).join(', ')}`);
    }
    suit = namedSuit;
  } else if (namedSuit !== undefined) {
    throw new Error(`Card ${card.id} cannot name a suit`);
  }

  return [...chain, { card, suit, via }];
}

/** Removes the last card. An empty chain stays empty. */
export function undoChain(chain: readonly ChainLink[]): ChainLink[] {
  return chain.slice(0, -1);
}

/** True when the card at this position changed the current suit. The first card never does. */
export function causesSwitch(chain: readonly ChainLink[], index: number): boolean {
  return index > 0 && chain[index].suit !== chain[index - 1].suit;
}

export function countSwitches(chain: readonly ChainLink[]): number {
  let switches = 0;
  for (let i = 1; i < chain.length; i += 1) if (causesSwitch(chain, i)) switches += 1;
  return switches;
}

/** 4 or more cards, and the last card shares a printed suit or rank with the first. 8s are not wild here. */
export function isRing(chain: readonly ChainLink[]): boolean {
  if (chain.length < CONFIG.chain.ringMinCards) return false;
  const first = chain[0].card;
  const last = chain[chain.length - 1].card;
  return first.suit === last.suit || first.rank === last.rank;
}
