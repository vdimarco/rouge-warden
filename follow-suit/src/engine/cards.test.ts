import { describe, expect, it } from 'vitest';
import {
  cardColor,
  cardLabel,
  cardPoints,
  createDeck,
  isFaceCard,
  rankLabel,
  sortCards,
} from './cards';
import { card, cards } from './test-helpers';

describe('the standard deck', () => {
  const deck = createDeck();

  it('has 52 cards with unique ids', () => {
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('has 13 cards of each suit and 4 of each rank', () => {
    for (const suit of ['S', 'H', 'D', 'C']) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
    for (let rank = 2; rank <= 14; rank += 1) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
  });

  it('has one card of each suit and rank', () => {
    const keys = new Set(deck.map((c) => `${c.rank}${c.suit}`));
    expect(keys.size).toBe(52);
  });
});

describe('card points', () => {
  it('counts 2 to 10 as their number', () => {
    for (const [label, points] of [['2S', 2], ['5H', 5], ['8D', 8], ['9C', 9], ['10S', 10]] as const) {
      expect(cardPoints(card(label))).toBe(points);
    }
  });

  it('counts face cards as 10', () => {
    for (const label of ['JS', 'QH', 'KD']) expect(cardPoints(card(label))).toBe(10);
  });

  it('counts an A as 11', () => {
    expect(cardPoints(card('AC'))).toBe(11);
  });

  it('counts the whole deck as 380', () => {
    expect(createDeck().reduce((sum, c) => sum + cardPoints(c), 0)).toBe(380);
  });
});

describe('ranks and colors', () => {
  it('orders ranks from 2 low to A high', () => {
    const ordered = cards('2S 3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS');
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].rank).toBeGreaterThan(ordered[i - 1].rank);
    }
  });

  it('makes hearts and diamonds red, and spades and clubs black', () => {
    expect(cardColor(card('4H'))).toBe('red');
    expect(cardColor(card('4D'))).toBe('red');
    expect(cardColor(card('4S'))).toBe('black');
    expect(cardColor(card('4C'))).toBe('black');
  });

  it('treats J, Q and K as face cards, and not A or 10', () => {
    expect(cards('JS QH KD').every(isFaceCard)).toBe(true);
    expect(cards('AS 10H 8D').some(isFaceCard)).toBe(false);
  });
});

describe('labels and order', () => {
  it('labels ranks and cards', () => {
    expect(rankLabel(10)).toBe('10');
    expect(rankLabel(11)).toBe('J');
    expect(rankLabel(14)).toBe('A');
    expect(cardLabel(card('QH'))).toBe('Q♥︎');
  });

  it('sorts by suit, then by rank', () => {
    const sorted = sortCards(cards('KH 2S AD 9C 4H 10S'));
    expect(sorted.map((c) => `${c.rank}${c.suit}`)).toEqual(['2S', '10S', '4H', '13H', '9C', '14D']);
  });
});
