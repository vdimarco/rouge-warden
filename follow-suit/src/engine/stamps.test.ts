import { describe, expect, it } from 'vitest';
import { createDeck } from './cards';
import { applyStamp, canUseStamp, STAMP_IDS, STAMPS, stampUse } from './stamps';
import type { Card } from './types';

const deck = createDeck();
const find = (list: readonly Card[], suit: string, rank: number) => list.find((c) => c.suit === suit && c.rank === rank)!;

describe('stamp list', () => {
  it('has the 4 stamps with a name and a text', () => {
    expect(STAMP_IDS).toEqual(['suit', 'copy', 'eight', 'burn']);
    expect(STAMPS.suit.name).toBe('Suit Stamp');
    expect(STAMPS.copy.name).toBe('Copy Stamp');
    expect(STAMPS.eight.name).toBe('Eight Stamp');
    expect(STAMPS.burn.name).toBe('Burn Stamp');
  });
});

describe('Suit Stamp', () => {
  it('changes one card to the picked suit and keeps its rank and id', () => {
    const club = find(deck, 'C', 4);
    const { deck: after, nextCardId } = applyStamp(deck, 53, { id: 'suit', cardId: club.id, suit: 'H' });
    expect(after.find((c) => c.id === club.id)).toEqual({ id: club.id, suit: 'H', rank: 4 });
    expect(after).toHaveLength(52);
    expect(nextCardId).toBe(53);
  });
});

describe('Copy Stamp', () => {
  it('gives the second card the rank of the first, and the second card keeps its suit', () => {
    const king = find(deck, 'S', 13);
    const three = find(deck, 'D', 3);
    const { deck: after } = applyStamp(deck, 53, { id: 'copy', fromId: king.id, toId: three.id });
    expect(after.find((c) => c.id === three.id)).toEqual({ id: three.id, suit: 'D', rank: 13 });
    expect(after.find((c) => c.id === king.id)).toEqual(king);
  });

  it('needs two different cards', () => {
    const king = find(deck, 'S', 13);
    expect(() => applyStamp(deck, 53, { id: 'copy', fromId: king.id, toId: king.id })).toThrow();
  });
});

describe('Eight Stamp', () => {
  it('adds a new 8 in the picked suit with a new id', () => {
    const { deck: after, nextCardId } = applyStamp(deck, 53, { id: 'eight', suit: 'D' });
    expect(after).toHaveLength(53);
    expect(after[52]).toEqual({ id: 'c53', suit: 'D', rank: 8 });
    expect(nextCardId).toBe(54);
    expect(after.filter((c) => c.suit === 'D' && c.rank === 8)).toHaveLength(2);
  });
});

describe('Burn Stamp', () => {
  it('removes one card', () => {
    const two = find(deck, 'C', 2);
    const { deck: after } = applyStamp(deck, 53, { id: 'burn', cardId: two.id });
    expect(after).toHaveLength(51);
    expect(after.some((c) => c.id === two.id)).toBe(false);
  });

  it('cannot take the deck below 20 cards', () => {
    const small = deck.slice(0, 20);
    expect(canUseStamp(small, 'burn')).toBe(false);
    expect(() => applyStamp(small, 53, { id: 'burn', cardId: small[0].id })).toThrow();
    expect(canUseStamp(deck.slice(0, 21), 'burn')).toBe(true);
  });
});

describe('stamp targets', () => {
  it('rejects a card that is not in the deck', () => {
    expect(() => applyStamp(deck, 53, { id: 'suit', cardId: 'nope', suit: 'H' })).toThrow();
    expect(() => applyStamp(deck, 53, { id: 'burn', cardId: 'nope' })).toThrow();
  });

  it('does not change the deck it was given', () => {
    applyStamp(deck, 53, { id: 'eight', suit: 'S' });
    expect(deck).toHaveLength(52);
  });

  it('lets the other stamps work on any deck', () => {
    for (const id of ['suit', 'copy', 'eight'] as const) expect(canUseStamp(deck.slice(0, 20), id)).toBe(true);
  });
});

describe('stamp targets from the picker', () => {
  it('lists how many cards and whether a suit each stamp needs', () => {
    expect([STAMPS.suit, STAMPS.copy, STAMPS.eight, STAMPS.burn].map((s) => [s.cards, s.suit])).toEqual([
      [1, true],
      [2, false],
      [0, true],
      [1, false],
    ]);
  });

  it('builds a stamp use only when every target is picked', () => {
    expect(stampUse('suit', ['c1'], null)).toBeNull();
    expect(stampUse('suit', ['c1'], 'H')).toEqual({ id: 'suit', cardId: 'c1', suit: 'H' });
    expect(stampUse('copy', ['c1'], null)).toBeNull();
    expect(stampUse('copy', ['c1', 'c2'], null)).toEqual({ id: 'copy', fromId: 'c1', toId: 'c2' });
    expect(stampUse('eight', [], 'D')).toEqual({ id: 'eight', suit: 'D' });
    expect(stampUse('burn', [], null)).toBeNull();
    expect(stampUse('burn', ['c9'], null)).toEqual({ id: 'burn', cardId: 'c9' });
  });
});
