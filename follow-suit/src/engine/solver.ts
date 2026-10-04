// The best legal chain in a hand, by depth-first search. The simulator and the browser check use it.

import { CONFIG } from '../config';
import { cardPoints } from './cards';
import { followVia, isRing, namedSuitOptions, needsNamedSuit, NO_RULES } from './chain';
import { EMPTY_SLOTS, SLOT_IDS } from './charms';
import { scoreChain } from './scoring';
import type { Card, ChainLink, CharmSlots, Rules, Suit } from './types';

export interface BestChain {
  readonly links: readonly ChainLink[];
  readonly score: number;
}

interface SolveContext {
  readonly charms?: CharmSlots;
  /** Cards in hand, for Pocket and Tidy. Defaults to the size of the given hand. */
  readonly handSize?: number;
}

/**
 * Searches every legal chain and returns the highest score. Ties keep the first chain found.
 *
 * An 8 can name 4 suits. Two named suits score the same when neither is the current suit, no card left in
 * the hand has that suit, and no suit charm sits in its slot. The search tries only one suit of each such
 * group, which keeps hands with many 8s fast.
 */
export function bestChain(hand: readonly Card[], rules: Rules = NO_RULES, context: SolveContext = {}): BestChain | null {
  const charms = context.charms ?? EMPTY_SLOTS;
  const handSize = context.handSize ?? hand.length;
  const anyCharm = SLOT_IDS.some((slot) => charms[slot] !== null);
  const chain: ChainLink[] = [];
  const used = hand.map(() => false);
  let best: BestChain | null = null;
  let value = 0;
  let switches = 0;

  const score = (): number => {
    if (anyCharm) return scoreChain(chain, { host: rules.host, charms, handSize }).score;
    const ring = isRing(chain);
    if (rules.host === 'jeweler' && !ring) return 0;
    const mult = (CONFIG.chain.startMult + switches * CONFIG.chain.switchMult) * (ring ? CONFIG.chain.ringMult : 1);
    return Math.floor(value * mult);
  };

  const suitChoices = (card: Card, index: number): Suit[] => {
    const current = chain.length === 0 ? null : chain[chain.length - 1].suit;
    const live = (suit: Suit) =>
      suit === current || charms[suit] !== null || hand.some((other, i) => !used[i] && i !== index && other.suit === suit);
    const options = namedSuitOptions(chain, card, rules);
    const dead = options.find((suit) => !live(suit));
    return options.filter((suit) => live(suit) || suit === dead);
  };

  const visit = () => {
    if (chain.length > 0) {
      const total = score();
      if (best === null || total > best.score) best = { links: [...chain], score: total };
    }
    for (let i = 0; i < hand.length; i += 1) {
      if (used[i]) continue;
      const card = hand[i];
      const via = followVia(chain, card, rules);
      if (via === null) continue;
      const suits = needsNamedSuit(card, rules) ? suitChoices(card, i) : [card.suit];
      for (const suit of suits) {
        const switched = chain.length > 0 && chain[chain.length - 1].suit !== suit;
        chain.push({ card, suit, via });
        used[i] = true;
        value += cardPoints(card);
        if (switched) switches += 1;
        visit();
        chain.pop();
        used[i] = false;
        value -= cardPoints(card);
        if (switched) switches -= 1;
      }
    }
  };

  visit();
  return best;
}
