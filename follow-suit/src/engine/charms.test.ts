import { describe, expect, it } from 'vitest';
import { canFollow, followVia, legalCards, undoChain } from './chain';
import { CHARM_IDS, CHARMS, charmPrice, sellPrice } from './charms';
import { previewChain, scoreChain } from './scoring';
import { buildChain, card, cards, rules, slots } from './test-helpers';

const stepsFrom = (result: ReturnType<typeof scoreChain>, source: string) =>
  result.steps.filter((step) => step.source === source);

describe('charm list', () => {
  it('has the 13 charms with slot, rarity and text', () => {
    expect(CHARM_IDS).toHaveLength(13);
    const suitCharms = CHARM_IDS.filter((id) => CHARMS[id].slot === 'suit');
    expect(suitCharms.sort()).toEqual(['crown', 'hinge', 'lantern', 'pawnbroker']);
    expect(CHARMS.lantern).toMatchObject({ name: 'Lantern', rarity: 'common' });
    expect(CHARMS.hinge.rarity).toBe('uncommon');
    expect(CHARMS.knot.rarity).toBe('rare');
    expect(CHARMS.spiral.rarity).toBe('rare');
    for (const id of CHARM_IDS) expect(CHARMS[id].text.length).toBeGreaterThan(10);
  });

  it('prices charms by rarity and sells them for half, rounded down', () => {
    expect(charmPrice('lantern')).toBe(4);
    expect(charmPrice('turncoat')).toBe(6);
    expect(charmPrice('knot')).toBe(8);
    expect(sellPrice('lantern')).toBe(2);
    expect(sellPrice('turncoat')).toBe(3);
    expect(sellPrice('knot')).toBe(4);
  });
});

describe('suit charms', () => {
  it('Lantern: each card of its suit adds 4 Value', () => {
    const result = scoreChain(buildChain('5H 9H'), { charms: slots({ H: 'lantern' }) });
    expect(result.value).toBe(22);
    expect(stepsFrom(result, 'lantern')).toHaveLength(2);
    expect(stepsFrom(result, 'lantern')[0]).toMatchObject({ kind: 'charm', slot: 'H', addValue: 4, index: 0 });
  });

  it('Lantern fires only for cards of its slot suit', () => {
    expect(scoreChain(buildChain('5H 9H'), { charms: slots({ S: 'lantern' }) }).value).toBe(14);
  });

  it('Lantern uses the named suit of an 8', () => {
    const result = scoreChain(buildChain('5S 8C>H'), { charms: slots({ H: 'lantern' }) });
    expect(stepsFrom(result, 'lantern').map((step) => step.index)).toEqual([1]);
  });

  it('Crown: each face card of its suit adds 8 Value', () => {
    expect(scoreChain(buildChain('KS QS 4S'), { charms: slots({ S: 'crown' }) }).value).toBe(40);
    expect(scoreChain(buildChain('AS 10S JS'), { charms: slots({ S: 'crown' }) }).value).toBe(39);
  });

  it('Pawnbroker: earns $1 for each switch into its suit', () => {
    const result = scoreChain(buildChain('KS KH 4H 4S 8S>H'), { charms: slots({ H: 'pawnbroker' }) });
    expect(result.money).toBe(2);
    expect(stepsFrom(result, 'pawnbroker').map((step) => step.index)).toEqual([1, 4]);
  });

  it('Hinge: a switch into its suit adds 2 Mult instead of 1', () => {
    const into = scoreChain(buildChain('KS KH'), { charms: slots({ H: 'hinge' }) });
    expect(into.mult).toBe(3);
    expect(into.score).toBe(60);
    const away = scoreChain(buildChain('KH KS'), { charms: slots({ H: 'hinge' }) });
    expect(away.mult).toBe(2);
  });

  it('fires after the card points and before the switch', () => {
    const result = scoreChain(buildChain('5S 5H'), { charms: slots({ H: 'lantern' }) });
    expect(result.steps.map((step) => `${step.kind}${step.index}`)).toEqual(['card0', 'card1', 'charm1', 'switch1']);
  });
});

describe('table charms that score', () => {
  it('Lucky Eight: each 8 in the chain adds 3 Mult', () => {
    const result = scoreChain(buildChain('KS 8D>H 8C>C'), { charms: slots({ table: 'luckyEight' }) });
    const lucky = stepsFrom(result, 'luckyEight');
    expect(lucky.map((step) => step.addMult)).toEqual([3, 3]);
    expect(result.mult).toBe(9);
    expect(result.score).toBe(26 * 9);
  });

  it('Long Haul: adds 1 Mult for every 3 cards, rounded down', () => {
    const result = scoreChain(buildChain('2S 3S 4S 5S 6S 7S 9S'), { charms: slots({ table: 'longHaul' }) });
    expect(stepsFrom(result, 'longHaul')[0].addMult).toBe(2);
    expect(result.mult).toBe((1 + 2) * 2);
    expect(stepsFrom(scoreChain(buildChain('2S 3S'), { charms: slots({ table: 'longHaul' }) }), 'longHaul')).toEqual([]);
  });

  it('Pocket: adds 6 Value for each card left in hand', () => {
    const result = scoreChain(buildChain('2S 3S 4S'), { charms: slots({ table: 'pocket' }), handSize: 8 });
    expect(stepsFrom(result, 'pocket')[0].addValue).toBe(30);
    expect(result.value).toBe(39);
  });

  it('Tidy: multiplies Mult by 3 when the chain uses every card in hand', () => {
    const chain = buildChain('2S 3S 4S 5S');
    expect(scoreChain(chain, { charms: slots({ table: 'tidy' }), handSize: 4 }).mult).toBe(6);
    expect(scoreChain(chain, { charms: slots({ table: 'tidy' }), handSize: 8 }).mult).toBe(2);
  });

  it('Ledger: earns $2 for a chain of 6 or more cards', () => {
    const ledger = { charms: slots({ table: 'ledger' }) };
    expect(scoreChain(buildChain('2S 3S 4S 5S 6S 7S'), ledger).money).toBe(2);
    expect(scoreChain(buildChain('2S 3S 4S 5S 6S'), ledger).money).toBe(0);
  });

  it('Knot: a ring multiplies Mult by 3 instead of 2', () => {
    const result = scoreChain(buildChain('7S KS KH 4H 4C 7C'), { charms: slots({ table: 'knot' }) });
    expect(result.mult).toBe(9);
    expect(result.score).toBe(378);
  });

  it('Spiral: adds its gained Mult to every chain', () => {
    const result = scoreChain(buildChain('AS'), { charms: slots({ table: 'spiral' }, 2) });
    expect(result.mult).toBe(3);
    expect(result.score).toBe(33);
    expect(stepsFrom(scoreChain(buildChain('AS'), { charms: slots({ table: 'spiral' }, 0) }), 'spiral')).toEqual([]);
  });

  it('keeps charm effects out of the live preview', () => {
    expect(previewChain(buildChain('5H 9H'))).toEqual({ value: 14, mult: 1, switches: 0, ring: false });
  });
});

describe('table charms that change the follow rules', () => {
  const turncoat = rules(null, 'turncoat');
  const bridge = rules(null, 'bridge');

  it('Turncoat: once per chain, a card can follow by color', () => {
    const chain = buildChain('5H', turncoat);
    expect(followVia(chain, card('9D'), turncoat)).toBe('turncoat');
    expect(canFollow(chain, card('9S'), turncoat)).toBe(false);
    expect(canFollow(chain, card('9D'))).toBe(false);
  });

  it('Turncoat works only once in a chain, and undo gives it back', () => {
    const chain = buildChain('5H 9D', turncoat);
    expect(chain[1].via).toBe('turncoat');
    expect(canFollow(chain, card('3H'), turncoat)).toBe(false);
    expect(canFollow(chain, card('3D'), turncoat)).toBe(true);
    expect(canFollow(undoChain(chain), card('3D'), turncoat)).toBe(true);
    expect(followVia(undoChain(chain), card('JD'), turncoat)).toBe('turncoat');
  });

  it('Bridge: once per chain, an A can follow any card', () => {
    const chain = buildChain('5H', bridge);
    expect(followVia(chain, card('AC'), bridge)).toBe('bridge');
    const after = buildChain('5H AC 2C', bridge);
    expect(after[1].via).toBe('bridge');
    expect(canFollow(after, card('AS'), bridge)).toBe(false);
  });

  it('prefers the normal rules, so the charm is not spent', () => {
    expect(followVia(buildChain('5H', bridge), card('AH'), bridge)).toBe('suit');
    expect(followVia(buildChain('5H', turncoat), card('5D'), turncoat)).toBe('rank');
  });

  it('lists charm follows among the legal cards', () => {
    const hand = cards('9D 9S AC');
    expect(legalCards(buildChain('5H', turncoat), hand, turncoat).map((c) => c.rank)).toEqual([9]);
    expect(legalCards(buildChain('5H', bridge), hand, bridge).map((c) => c.rank)).toEqual([14]);
  });

  it('cannot break a host rule', () => {
    const purist = rules('purist', 'turncoat');
    expect(canFollow(buildChain('5H', purist), card('9D'), purist)).toBe(false);
    const zebra = rules('zebra', 'bridge');
    expect(canFollow(buildChain('5H', zebra), card('AD'), zebra)).toBe(false);
    expect(canFollow(buildChain('5H', zebra), card('AC'), zebra)).toBe(true);
  });
});
