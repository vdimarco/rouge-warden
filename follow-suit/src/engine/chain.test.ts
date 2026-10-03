import { describe, expect, it } from 'vitest';
import {
  addToChain,
  canFollow,
  causesSwitch,
  countSwitches,
  currentSuit,
  followVia,
  isRing,
  legalCards,
  namedSuitOptions,
  needsNamedSuit,
  undoChain,
} from './chain';
import { buildChain, card, cards } from './test-helpers';

describe('follow rules', () => {
  it('lets any card start a chain', () => {
    for (const c of cards('2S 9H QD AC')) {
      expect(followVia([], c)).toBe('first');
    }
  });

  it('follows by the current suit', () => {
    expect(followVia(buildChain('KS'), card('4S'))).toBe('suit');
  });

  it('follows by the same rank as the previous card', () => {
    expect(followVia(buildChain('KS'), card('KH'))).toBe('rank');
  });

  it('lets an 8 follow any card', () => {
    expect(followVia(buildChain('KS'), card('8D'))).toBe('eight');
    expect(followVia(buildChain('2H'), card('8C'))).toBe('eight');
  });

  it('stops a card with another suit and another rank', () => {
    expect(followVia(buildChain('KS'), card('5H'))).toBeNull();
    expect(canFollow(buildChain('KS'), card('5H'))).toBe(false);
  });

  it('compares with the last card only', () => {
    // 7S is the first card. After KS KH, a 7 does not follow by rank.
    expect(canFollow(buildChain('7S KS KH'), card('7C'))).toBe(false);
    expect(canFollow(buildChain('7S KS KH'), card('4H'))).toBe(true);
  });

  it('lists the legal cards in a hand', () => {
    const hand = cards('4S KH 8D 5H');
    expect(legalCards(buildChain('KS'), hand).map((c) => c.id)).toEqual([hand[0].id, hand[1].id, hand[2].id]);
  });

  it('makes every card legal for an empty chain', () => {
    const hand = cards('4S KH 8D 5H');
    expect(legalCards([], hand)).toHaveLength(4);
  });
});

describe('8s and named suits', () => {
  it('needs a named suit for an 8 and for no other card', () => {
    expect(needsNamedSuit(card('8S'))).toBe(true);
    expect(needsNamedSuit(card('9S'))).toBe(false);
  });

  it('offers all 4 suits for an 8', () => {
    expect(namedSuitOptions(buildChain('KS'), card('8D')).sort()).toEqual(['C', 'D', 'H', 'S']);
  });

  it('offers no suits for other cards', () => {
    expect(namedSuitOptions(buildChain('KS'), card('KD'))).toEqual([]);
  });

  it('rejects an 8 with no named suit', () => {
    expect(() => addToChain(buildChain('KS'), card('8D'))).toThrow();
  });

  it('rejects a named suit on a card that is not an 8', () => {
    expect(() => addToChain(buildChain('KS'), card('4S'), 'H')).toThrow();
  });

  it('makes the named suit the current suit', () => {
    const chain = buildChain('KS 8D>H');
    expect(currentSuit(chain)).toBe('H');
    expect(chain[1].suit).toBe('H');
  });

  it('lets cards follow the named suit and not the printed suit of the 8', () => {
    const chain = buildChain('KS 8D>H');
    expect(followVia(chain, card('3H'))).toBe('suit');
    expect(canFollow(chain, card('3D'))).toBe(false);
    expect(canFollow(chain, card('KS'))).toBe(false);
  });

  it('lets another 8 follow an 8 by rank', () => {
    expect(followVia(buildChain('KS 8D>H'), card('8C'))).toBe('rank');
  });

  it('names a suit for an 8 that starts the chain', () => {
    const chain = buildChain('8C>D');
    expect(currentSuit(chain)).toBe('D');
    expect(canFollow(chain, card('2D'))).toBe(true);
    expect(canFollow(chain, card('2C'))).toBe(false);
  });

  it('names a suit for an 8 that follows by suit', () => {
    const chain = buildChain('5S 8S>H');
    expect(chain[1].via).toBe('suit');
    expect(currentSuit(chain)).toBe('H');
  });
});

describe('adding cards', () => {
  it('records how each card followed', () => {
    expect(buildChain('7S KS KH 8D>H').map((link) => link.via)).toEqual(['first', 'suit', 'rank', 'eight']);
  });

  it('rejects a card that cannot follow', () => {
    expect(() => addToChain(buildChain('KS'), card('5H'))).toThrow();
  });

  it('rejects a card that is already in the chain', () => {
    const king = card('KS');
    const chain = addToChain([], king);
    expect(() => addToChain(chain, king)).toThrow();
  });

  it('does not change the chain it was given', () => {
    const chain = buildChain('KS');
    addToChain(chain, card('4S'));
    expect(chain).toHaveLength(1);
  });
});

describe('switches', () => {
  it('counts each change of the current suit', () => {
    expect(countSwitches(buildChain('7S KS KH 4H 4C 7C'))).toBe(2);
  });

  it('never counts the first card', () => {
    expect(causesSwitch(buildChain('7S KS'), 0)).toBe(false);
    expect(countSwitches(buildChain('8H>D'))).toBe(0);
  });

  it('marks the cards that cause a switch', () => {
    const chain = buildChain('7S KS KH 4H 4C 7C');
    expect(chain.map((_, i) => causesSwitch(chain, i))).toEqual([false, false, true, false, true, false]);
  });

  it('counts an 8 that names a new suit', () => {
    expect(countSwitches(buildChain('5S 8S>H'))).toBe(1);
  });

  it('does not count an 8 that names the current suit', () => {
    expect(countSwitches(buildChain('5S 8H>S'))).toBe(0);
  });

  it('counts a switch after an 8 when the next card leaves the named suit', () => {
    // 8 names hearts, then 8C follows by rank and names clubs.
    expect(countSwitches(buildChain('KS 8D>H 8C>C'))).toBe(2);
  });
});

describe('rings', () => {
  it('closes a ring when the last card shares a rank with the first', () => {
    expect(isRing(buildChain('7S KS KH 4H 4C 7C'))).toBe(true);
  });

  it('closes a ring when the last card shares a suit with the first', () => {
    expect(isRing(buildChain('5H 9H 9S 2S 2H'))).toBe(true);
  });

  it('needs 4 or more cards', () => {
    expect(isRing(buildChain('7S 9S 2S'))).toBe(false);
    expect(isRing(buildChain('7S 9S 2S 4S'))).toBe(true);
  });

  it('needs the last card to match the first', () => {
    expect(isRing(buildChain('5H 9H 9S 2S'))).toBe(false);
  });

  it('ignores the named suit of an 8', () => {
    expect(isRing(buildChain('5H 9H 9S 8C>H'))).toBe(false);
  });

  it('uses the printed suit of an 8', () => {
    expect(isRing(buildChain('5H 9H 9S 8H>S'))).toBe(true);
    expect(isRing(buildChain('8H>S 9S 9C 2C 2H'))).toBe(true);
  });

  it('does not treat 8s as wild for the ring check', () => {
    expect(isRing(buildChain('5H 9H 9S 2S 8D>S'))).toBe(false);
    expect(isRing(buildChain('8C>H 9H 9S 2S 8D>S'))).toBe(true);
  });
});

describe('undo', () => {
  it('removes the last card', () => {
    const chain = buildChain('KS 4S');
    expect(undoChain(chain)).toEqual(chain.slice(0, 1));
  });

  it('gives back the current suit from before an 8', () => {
    const chain = undoChain(buildChain('KS 8D>H'));
    expect(currentSuit(chain)).toBe('S');
    expect(canFollow(chain, card('4S'))).toBe(true);
    expect(canFollow(chain, card('4H'))).toBe(false);
  });

  it('leaves an empty chain empty', () => {
    expect(undoChain([])).toEqual([]);
    expect(currentSuit([])).toBeNull();
  });
});
