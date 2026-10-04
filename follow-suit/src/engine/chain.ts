// Chains: follow rules, 8s and named suits, switches and rings.
// Host limits and the once-per-chain charm follows (Turncoat, Bridge) come in through `rules`.

import { CONFIG } from '../config';
import { cardColor, SUITS } from './cards';
import type { Card, ChainLink, FollowVia, Rules, Suit } from './types';

export const NO_RULES: Rules = { host: null, tableCharm: null };

/** The suit that the next card must match, or null for an empty chain. */
export function currentSuit(chain: readonly ChainLink[]): Suit | null {
  return chain.length === 0 ? null : chain[chain.length - 1].suit;
}

/** A wild card follows any card and names the next current suit. Under The Miser, 8s are not wild. */
export function isWild(card: Card, rules: Rules = NO_RULES): boolean {
  return card.rank === CONFIG.cards.wildRank && eightsAreWild(rules);
}

/** True when 8s are wild under these rules. The Miser makes them plain cards. */
export function eightsAreWild(rules: Rules = NO_RULES): boolean {
  return rules.host !== 'miser';
}

export function needsNamedSuit(card: Card, rules: Rules = NO_RULES): boolean {
  return isWild(card, rules);
}

/** The suits the player can name for this card. Empty when the card names no suit. */
export function namedSuitOptions(chain: readonly ChainLink[], card: Card, rules: Rules = NO_RULES): Suit[] {
  if (!needsNamedSuit(card, rules)) return [];
  const suit = currentSuit(chain);
  if (rules.host === 'purist' && suit !== null) return [suit];
  return [...SUITS];
}

/** The host's limit between the previous card and the next one. A card must pass it and the follow rules. */
function passesHost(last: ChainLink, card: Card, rules: Rules): boolean {
  switch (rules.host) {
    case 'purist':
      // No switches: a card that names no suit must keep the current suit.
      return isWild(card, rules) || card.suit === last.suit;
    case 'zebra':
      return cardColor(card) !== cardColor(last.card);
    case 'climber':
      return card.rank > last.card.rank;
    default:
      return true;
  }
}

function used(chain: readonly ChainLink[], via: FollowVia): boolean {
  return chain.some((link) => link.via === via);
}

/** How the card can follow the chain, or null if it cannot. The normal rules come before the charms. */
export function followVia(chain: readonly ChainLink[], card: Card, rules: Rules = NO_RULES): FollowVia | null {
  if (chain.length === 0) return 'first';
  const last = chain[chain.length - 1];
  if (!passesHost(last, card, rules)) return null;
  if (card.suit === last.suit) return 'suit';
  if (card.rank === last.card.rank) return 'rank';
  if (isWild(card, rules)) return 'eight';
  if (rules.tableCharm === 'turncoat' && !used(chain, 'turncoat') && cardColor(card) === cardColor(last.card)) {
    return 'turncoat';
  }
  if (rules.tableCharm === 'bridge' && !used(chain, 'bridge') && card.rank === 14) return 'bridge';
  return null;
}

function inChain(chain: readonly ChainLink[], card: Card): boolean {
  return chain.some((link) => link.card.id === card.id);
}

export function canFollow(chain: readonly ChainLink[], card: Card, rules: Rules = NO_RULES): boolean {
  return !inChain(chain, card) && followVia(chain, card, rules) !== null;
}

/** The cards that can join the chain next, in the order given. */
export function legalCards(chain: readonly ChainLink[], cards: readonly Card[], rules: Rules = NO_RULES): Card[] {
  return cards.filter((card) => canFollow(chain, card, rules));
}

/** Adds a card to a new copy of the chain. Throws if the card cannot join. */
export function addToChain(
  chain: readonly ChainLink[],
  card: Card,
  namedSuit?: Suit,
  rules: Rules = NO_RULES,
): ChainLink[] {
  if (inChain(chain, card)) throw new Error(`Card ${card.id} is already in the chain`);
  const via = followVia(chain, card, rules);
  if (via === null) throw new Error(`Card ${card.id} cannot follow the chain`);

  let suit: Suit = card.suit;
  if (needsNamedSuit(card, rules)) {
    const options = namedSuitOptions(chain, card, rules);
    if (namedSuit === undefined || !options.includes(namedSuit)) {
      throw new Error(`Card ${card.id} needs one of these named suits: ${options.join(', ')}`);
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
