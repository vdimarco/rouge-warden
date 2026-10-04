import { describe, expect, it } from 'vitest';
import { addToChain, followVia, namedSuitOptions, NO_RULES } from './chain';
import { createDeck } from './cards';
import { createRng, seedState } from './rng';
import { scoreChain } from './scoring';
import { bestChain } from './solver';
import { cards, rules, slots } from './test-helpers';
import type { Card, ChainLink, CharmSlots, Rules } from './types';

/** Every legal chain, scored with the real scoring code. Slow, but plainly correct. */
function bruteBest(hand: readonly Card[], ruleSet: Rules, charms?: CharmSlots): number {
  let best = -1;
  const visit = (chain: ChainLink[]) => {
    if (chain.length > 0) {
      best = Math.max(best, scoreChain(chain, { host: ruleSet.host, charms, handSize: hand.length }).score);
    }
    for (const card of hand) {
      if (chain.some((link) => link.card.id === card.id) || followVia(chain, card, ruleSet) === null) continue;
      const options = namedSuitOptions(chain, card, ruleSet);
      for (const suit of options.length > 0 ? options : [undefined]) visit(addToChain(chain, card, suit, ruleSet));
    }
  };
  visit([]);
  return best;
}

function randomHands(seed: string, count: number, size: number): Card[][] {
  const rng = createRng(seedState(seed));
  return Array.from({ length: count }, () => rng.shuffle(createDeck()).slice(0, size));
}

describe('best chain', () => {
  it('finds nothing in an empty hand', () => {
    expect(bestChain([])).toBeNull();
  });

  it('plays a lone card', () => {
    const result = bestChain(cards('AS'))!;
    expect(result.score).toBe(11);
    expect(result.links).toHaveLength(1);
  });

  it('beats the 252 order of the brief test cards with a 3-switch ring', () => {
    // 7S 7C 4C 4H KH KS: Value 42, Mult (1 + 3) x 2.
    const result = bestChain(cards('7S KS KH 4H 4C 7C'))!;
    expect(result.score).toBe(336);
    expect(scoreChain(result.links).score).toBe(336);
  });

  it('returns a chain that the follow rules accept', () => {
    for (const hand of randomHands('LEGAL', 20, 8)) {
      const result = bestChain(hand)!;
      let chain: ChainLink[] = [];
      for (const link of result.links) chain = addToChain(chain, link.card, link.card.rank === 8 ? link.suit : undefined);
      expect(scoreChain(chain).score).toBe(result.score);
    }
  });

  it('matches a brute-force search with no host and no charms', () => {
    for (const hand of randomHands('BRUTE', 25, 6)) {
      expect(bestChain(hand)!.score).toBe(bruteBest(hand, NO_RULES));
    }
  });

  it('matches a brute-force search under each host', () => {
    for (const host of ['purist', 'zebra', 'climber', 'miser', 'jeweler'] as const) {
      for (const hand of randomHands(`HOST-${host}`, 8, 6)) {
        expect(bestChain(hand, rules(host))!.score).toBe(bruteBest(hand, rules(host)));
      }
    }
  });

  it('matches a brute-force search with charms', () => {
    const sets = [
      slots({ H: 'lantern', table: 'turncoat' }),
      slots({ S: 'hinge', D: 'crown', table: 'bridge' }),
      slots({ C: 'pawnbroker', table: 'knot' }),
      slots({ table: 'luckyEight' }),
      slots({ table: 'tidy' }),
      slots({ table: 'pocket' }),
    ];
    sets.forEach((charms, i) => {
      for (const hand of randomHands(`CHARM${i}`, 6, 6)) {
        const ruleSet = rules(null, charms.table?.id ?? null);
        expect(bestChain(hand, ruleSet, { charms })!.score).toBe(bruteBest(hand, ruleSet, charms));
      }
    });
  });

  it('handles a hand full of 8s quickly', () => {
    const started = Date.now();
    const result = bestChain(cards('8S 8H 8D 8C 2S 3H 4D 5C'))!;
    expect(result.score).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
