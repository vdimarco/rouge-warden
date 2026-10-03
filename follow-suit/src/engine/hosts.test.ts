import { describe, expect, it } from 'vitest';
import { addToChain, canFollow, eightsAreWild, followVia, legalCards, namedSuitOptions, needsNamedSuit, NO_RULES } from './chain';
import { HOST_IDS, HOSTS, hostSequence } from './hosts';
import { createRng, seedState } from './rng';
import { scoreChain } from './scoring';
import { buildChain, card, cards, rules } from './test-helpers';

const codes = (list: { rank: number; suit: string }[]) => list.map((c) => `${c.rank}${c.suit}`);

describe('host list', () => {
  it('has the 5 hosts with a name and a rule', () => {
    expect(HOST_IDS).toEqual(['purist', 'zebra', 'climber', 'miser', 'jeweler']);
    expect(HOSTS.purist.name).toBe('The Purist');
    expect(HOSTS.zebra.name).toBe('The Zebra');
    expect(HOSTS.climber.name).toBe('The Climber');
    expect(HOSTS.miser.name).toBe('The Miser');
    expect(HOSTS.jeweler.name).toBe('The Jeweler');
    for (const id of HOST_IDS) expect(HOSTS[id].rule.length).toBeGreaterThan(10);
  });
});

describe('The Purist: no switches, and an 8 must name the current suit', () => {
  const purist = rules('purist');

  it('stops a card that follows by rank into a new suit', () => {
    const chain = buildChain('KS', purist);
    expect(canFollow(chain, card('KH'), purist)).toBe(false);
    expect(canFollow(chain, card('4S'), purist)).toBe(true);
  });

  it('lets an 8 follow, but only naming the current suit', () => {
    const chain = buildChain('KS', purist);
    expect(canFollow(chain, card('8D'), purist)).toBe(true);
    expect(namedSuitOptions(chain, card('8D'), purist)).toEqual(['S']);
    expect(() => addToChain(chain, card('8D'), 'H', purist)).toThrow();
    expect(addToChain(chain, card('8D'), 'S', purist)[1].suit).toBe('S');
  });

  it('lets an 8 that starts the chain name any suit', () => {
    expect(namedSuitOptions([], card('8D'), purist).sort()).toEqual(['C', 'D', 'H', 'S']);
  });

  it('never scores a switch', () => {
    const chain = buildChain('KS 4S 8D>S 9S', purist);
    expect(scoreChain(chain, { host: 'purist' }).switches).toBe(0);
  });
});

describe('The Zebra: each card must be the opposite color of the previous card', () => {
  const zebra = rules('zebra');

  it('allows the opposite color and stops the same color', () => {
    const chain = buildChain('KS', zebra);
    expect(canFollow(chain, card('KH'), zebra)).toBe(true);
    expect(canFollow(chain, card('KC'), zebra)).toBe(false);
    expect(canFollow(chain, card('4S'), zebra)).toBe(false);
  });

  it('applies to 8s too, by their printed color', () => {
    const chain = buildChain('KS', zebra);
    expect(canFollow(chain, card('8D'), zebra)).toBe(true);
    expect(canFollow(chain, card('8C'), zebra)).toBe(false);
  });

  it('uses the printed color of an 8 for the next card', () => {
    // 8C is black and names hearts. The next card must be red and follow hearts.
    const chain = buildChain('KD 8C>H', zebra);
    expect(canFollow(chain, card('4H'), zebra)).toBe(true);
    expect(canFollow(chain, card('8S'), zebra)).toBe(false);
  });
});

describe('The Climber: each card must outrank the previous card', () => {
  const climber = rules('climber');

  it('allows a higher card and stops a lower or equal card', () => {
    const chain = buildChain('9S', climber);
    expect(canFollow(chain, card('JS'), climber)).toBe(true);
    expect(canFollow(chain, card('4S'), climber)).toBe(false);
    expect(canFollow(chain, card('9H'), climber)).toBe(false);
  });

  it('makes 8s obey the rule too', () => {
    expect(canFollow(buildChain('9S', climber), card('8D'), climber)).toBe(false);
    expect(canFollow(buildChain('5S', climber), card('8D'), climber)).toBe(true);
    expect(canFollow(buildChain('5S 8D>S', climber), card('7S'), climber)).toBe(false);
    expect(canFollow(buildChain('5S 8D>S', climber), card('9S'), climber)).toBe(true);
  });

  it('lets an A follow anything lower in its suit', () => {
    expect(canFollow(buildChain('KS', climber), card('AS'), climber)).toBe(true);
  });
});

describe('The Miser: 8s are not wild', () => {
  const miser = rules('miser');

  it('lets an 8 follow only by suit or rank', () => {
    const chain = buildChain('KS', miser);
    expect(followVia(chain, card('8S'), miser)).toBe('suit');
    expect(canFollow(chain, card('8D'), miser)).toBe(false);
  });

  it('asks for no named suit, and the 8 keeps its printed suit', () => {
    expect(needsNamedSuit(card('8S'), miser)).toBe(false);
    expect(namedSuitOptions([], card('8S'), miser)).toEqual([]);
    const chain = addToChain(buildChain('KS', miser), card('8S'), undefined, miser);
    expect(chain[1].suit).toBe('S');
    expect(() => addToChain(buildChain('KS', miser), card('8S'), 'H', miser)).toThrow();
  });

  it('tells the screen that 8s are not wild here', () => {
    expect(eightsAreWild(miser)).toBe(false);
    expect(eightsAreWild(NO_RULES)).toBe(true);
    expect(eightsAreWild(rules('zebra'))).toBe(true);
  });

  it('lets another 8 follow an 8 by rank, with a switch', () => {
    const chain = buildChain('KS 8S 8D', miser);
    expect(chain.map((link) => link.suit)).toEqual(['S', 'S', 'D']);
    expect(scoreChain(chain, { host: 'miser' }).switches).toBe(1);
  });
});

describe('The Jeweler: only rings score', () => {
  it('scores 0 for a chain that is not a ring', () => {
    const result = scoreChain(buildChain('5H 9H 9C'), { host: 'jeweler' });
    expect(result.score).toBe(0);
    expect(result.steps[result.steps.length - 1].source).toBe('jeweler');
  });

  it('scores a ring as usual', () => {
    expect(scoreChain(buildChain('7S KS KH 4H 4C 7C'), { host: 'jeweler' }).score).toBe(252);
  });

  it('does not change the follow rules', () => {
    const hand = cards('4S KH 8D 5H');
    expect(codes(legalCards(buildChain('KS'), hand, rules('jeweler')))).toEqual(['4S', '13H', '8D']);
  });
});

describe('host order', () => {
  const sequence = (seed: string) => hostSequence(createRng(seedState(seed)), 8);

  it('picks a host for each of the 8 stops', () => {
    expect(sequence('HOSTS1')).toHaveLength(8);
  });

  it('uses all 5 hosts before any host appears twice', () => {
    for (const seed of ['HOSTS1', 'HOSTS2', 'HOSTS3', 'K7QX2M']) {
      expect(new Set(sequence(seed).slice(0, 5)).size).toBe(5);
    }
  });

  it('gives the same order for the same seed', () => {
    expect(sequence('HOSTS1')).toEqual(sequence('HOSTS1'));
  });

  it('gives different orders for different seeds', () => {
    const orders = new Set(['A', 'B', 'C', 'D', 'E', 'F'].map((seed) => sequence(seed).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});
