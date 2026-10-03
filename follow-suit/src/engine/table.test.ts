import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createDeck, sortCards } from './cards';
import { createRng, seedState } from './rng';
import {
  addCard,
  availableCards,
  canPlay,
  canRedraw,
  legalCardIds,
  playChain,
  redraw,
  startTable,
  tableTarget,
  undoCard,
  type TableState,
} from './table';
import { cards } from './test-helpers';
import type { Card } from './types';

const SETUP = { stop: 1, tableIndex: 0, target: 150 };

function dealt(seed: string): TableState {
  return startTable(createDeck(), SETUP, createRng(seedState(seed)));
}

/** A table with a known hand and draw pile. */
function table(hand: string, draw = '', overrides: Partial<TableState> = {}): TableState {
  return {
    ...SETUP,
    host: null,
    hand: sortCards(cards(hand)),
    drawPile: draw ? cards(draw) : [],
    discard: [],
    chain: [],
    chainsLeft: CONFIG.table.chains,
    redrawsLeft: CONFIG.table.redraws,
    total: 0,
    status: 'playing',
    lastPlay: null,
    bestChain: 0,
    ...overrides,
  };
}

function id(state: TableState, label: string): string {
  const [rankText, suit] = [label.slice(0, -1), label.slice(-1)];
  const rank = { J: 11, Q: 12, K: 13, A: 14 }[rankText] ?? Number(rankText);
  const found = state.hand.find((c: Card) => c.suit === suit && c.rank === rank);
  if (!found) throw new Error(`${label} is not in the hand`);
  return found.id;
}

function labels(list: readonly Card[]): string[] {
  return list.map((c) => `${c.rank}${c.suit}`);
}

describe('targets', () => {
  const base = CONFIG.run.baseTargets;

  it('uses the stop base, 1.5 times the base, then 2 times the base', () => {
    expect([0, 1, 2].map((t) => tableTarget(1, t))).toEqual([base[0], Math.round(base[0] * 1.5), base[0] * 2]);
    expect([0, 1, 2].map((t) => tableTarget(8, t))).toEqual([base[7], Math.round(base[7] * 1.5), base[7] * 2]);
  });

  it('multiplies only the host table by the host scale and rounds to whole numbers', () => {
    expect(tableTarget(2, 1, 1.5)).toBe(Math.round(base[1] * 1.5));
    expect(tableTarget(2, 2, 1.25)).toBe(Math.round(base[1] * 2 * 1.25));
    expect(tableTarget(1, 2, 0.123)).toBe(Math.round(base[0] * 2 * 0.123));
    expect(Number.isInteger(tableTarget(3, 1, 1))).toBe(true);
  });

  it('keeps 8 base targets that rise from stop to stop', () => {
    expect(base).toHaveLength(8);
    for (let i = 1; i < base.length; i += 1) expect(base[i]).toBeGreaterThan(base[i - 1]);
  });
});

describe('dealing', () => {
  it('shuffles the deck into a draw pile and deals a hand of 8', () => {
    const state = dealt('DEAL01');
    expect(state.hand).toHaveLength(8);
    expect(state.drawPile).toHaveLength(44);
    expect(state.discard).toHaveLength(0);
    expect(new Set([...state.hand, ...state.drawPile].map((c) => c.id)).size).toBe(52);
  });

  it('starts with 3 chains, 2 redraws, a total of 0 and the target', () => {
    const state = dealt('DEAL02');
    expect(state.chainsLeft).toBe(3);
    expect(state.redrawsLeft).toBe(2);
    expect(state.total).toBe(0);
    expect(state.target).toBe(SETUP.target);
    expect(state.status).toBe('playing');
    expect(state.chain).toEqual([]);
  });

  it('deals the same hand for the same seed and a new hand for a new seed', () => {
    expect(labels(dealt('SAME01').hand)).toEqual(labels(dealt('SAME01').hand));
    expect(labels(dealt('SAME01').hand)).not.toEqual(labels(dealt('SAME02').hand));
  });

  it('keeps the hand sorted by suit, then rank', () => {
    const state = dealt('SORT01');
    expect(state.hand).toEqual(sortCards(state.hand));
  });

  it('draws from the generator it is given and moves it on', () => {
    const rng = createRng(seedState('MOVE01'));
    const before = rng.state;
    startTable(createDeck(), SETUP, rng);
    expect(rng.state).not.toBe(before);
  });
});

describe('building a chain', () => {
  it('makes every card legal for an empty chain', () => {
    const state = table('4S KS KH 8D 5H 2C 9C AD');
    expect(legalCardIds(state).size).toBe(8);
  });

  it('marks only the cards that can follow the last card', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    state = addCard(state, id(state, 'KS'));
    const legal = legalCardIds(state);
    expect([...legal].sort()).toEqual([id(state, '4S'), id(state, 'KH'), id(state, '8D')].sort());
  });

  it('keeps chain cards in the hand list but not in the available cards', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    state = addCard(state, id(state, 'KS'));
    expect(state.hand).toHaveLength(8);
    expect(availableCards(state)).toHaveLength(7);
    expect(legalCardIds(state).has(id(state, 'KS'))).toBe(false);
  });

  it('rejects a card that cannot follow', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    state = addCard(state, id(state, 'KS'));
    expect(() => addCard(state, id(state, '5H'))).toThrow();
  });

  it('rejects a card that is not in the hand', () => {
    const state = table('4S KS KH 8D 5H 2C 9C AD');
    expect(() => addCard(state, 'not-a-card')).toThrow();
  });

  it('needs a named suit for an 8', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    state = addCard(state, id(state, 'KS'));
    expect(() => addCard(state, id(state, '8D'))).toThrow();
    state = addCard(state, id(state, '8D'), 'H');
    expect(state.chain[1].suit).toBe('H');
    expect(legalCardIds(state).has(id(state, '5H'))).toBe(true);
  });

  it('undoes the last card', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    state = addCard(state, id(state, 'KS'));
    state = addCard(state, id(state, '8D'), 'H');
    state = undoCard(state);
    expect(state.chain).toHaveLength(1);
    expect(legalCardIds(state).has(id(state, '5H'))).toBe(false);
    expect(legalCardIds(state).has(id(state, '4S'))).toBe(true);
  });

  it('can play only when the chain has a card', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD');
    expect(canPlay(state)).toBe(false);
    expect(() => playChain(state)).toThrow();
    state = addCard(state, id(state, 'KS'));
    expect(canPlay(state)).toBe(true);
  });
});

describe('playing a chain', () => {
  const start = () => table('4S KS KH 8D 5H 2C 9C AD', '3S 3H 3D 3C 6S 6H 6D 6C 7S 7H');

  it('scores the chain, discards its cards and refills the hand from the draw pile', () => {
    let state = start();
    state = addCard(state, id(state, 'KS'));
    state = addCard(state, id(state, 'KH'));
    state = addCard(state, id(state, '5H'));
    state = playChain(state);

    // 10 + 10 + 5 = 25, one switch: Mult 2.
    expect(state.lastPlay?.result.score).toBe(50);
    expect(state.total).toBe(50);
    expect(state.chainsLeft).toBe(2);
    expect(state.chain).toEqual([]);
    expect(labels(state.discard)).toEqual(['13S', '13H', '5H']);
    expect(state.hand).toHaveLength(8);
    expect(labels(state.hand)).toEqual(expect.arrayContaining(['3S', '3H', '3D']));
    expect(state.drawPile).toHaveLength(7);
    expect(state.bestChain).toBe(50);
  });

  it('keeps the played chain for the reveal', () => {
    let state = start();
    state = addCard(state, id(state, '4S'));
    state = playChain(state);
    expect(state.lastPlay?.links.map((link) => link.card.rank)).toEqual([4]);
    expect(state.lastPlay?.handSize).toBe(8);
  });

  it('clears the table at once when the total reaches the target', () => {
    let state = table('7S KS KH 4H 4C 7C 2D 3D', '5S 5H 5D 5C 6S 6H', { target: 252 });
    for (const label of ['7S', 'KS', 'KH', '4H', '4C', '7C']) state = addCard(state, id(state, label));
    state = playChain(state);
    expect(state.total).toBe(252);
    expect(state.status).toBe('cleared');
    expect(state.chainsLeft).toBe(2);
  });

  it('ends in a loss after the last chain when the total is below the target', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD', '3S 3H 3D 3C 6S 6H', { target: 10_000, chainsLeft: 1 });
    state = addCard(state, id(state, '2C'));
    state = playChain(state);
    expect(state.chainsLeft).toBe(0);
    expect(state.status).toBe('lost');
  });

  it('stops all actions once the table is over', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD', '3S 3H', { target: 2 });
    state = addCard(state, id(state, '4S'));
    state = playChain(state);
    expect(state.status).toBe('cleared');
    expect(() => addCard(state, state.hand[0].id)).toThrow();
    expect(() => redraw(state, [state.hand[0].id])).toThrow();
  });

  it('leaves the hand smaller when the draw pile runs out', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD', '3S');
    state = addCard(state, id(state, 'KS'));
    state = addCard(state, id(state, '4S'));
    state = playChain(state);
    expect(state.hand).toHaveLength(7);
    expect(state.drawPile).toHaveLength(0);
    expect(state.status).toBe('playing');
  });

  it('loses when the hand is empty and the target is not reached', () => {
    let state = table('2S 3S', '', { target: 1_000 });
    state = addCard(state, id(state, '2S'));
    state = addCard(state, id(state, '3S'));
    state = playChain(state);
    expect(state.hand).toHaveLength(0);
    expect(state.chainsLeft).toBe(2);
    expect(state.status).toBe('lost');
  });
});

describe('redraws', () => {
  const start = () => table('4S KS KH 8D 5H 2C 9C AD', '3S 3H 3D 3C 6S 6H 6D 6C');

  it('discards the selected cards and draws back to 8', () => {
    let state = start();
    state = redraw(state, [id(state, '2C'), id(state, '9C')]);
    expect(state.redrawsLeft).toBe(1);
    expect(state.hand).toHaveLength(8);
    expect(labels(state.discard)).toEqual(['2C', '9C']);
    expect(labels(state.hand)).toEqual(expect.arrayContaining(['3S', '3H']));
    expect(labels(state.hand)).not.toEqual(expect.arrayContaining(['2C']));
    expect(state.drawPile).toHaveLength(6);
    expect(state.chainsLeft).toBe(3);
  });

  it('allows no redraw after the last one', () => {
    const state = start();
    const once = redraw(state, [id(state, '2C')]);
    const twice = redraw(once, [once.hand[0].id]);
    expect(twice.redrawsLeft).toBe(0);
    expect(canRedraw(twice)).toBe(false);
    expect(() => redraw(twice, [twice.hand[0].id])).toThrow();
  });

  it('allows no redraw while a chain is in progress', () => {
    let state = start();
    state = addCard(state, id(state, 'KS'));
    expect(canRedraw(state)).toBe(false);
    expect(() => redraw(state, [id(state, '2C')])).toThrow();
  });

  it('needs at least one selected card from the hand', () => {
    const state = start();
    expect(() => redraw(state, [])).toThrow();
    expect(() => redraw(state, ['not-a-card'])).toThrow();
  });

  it('draws only what is left in the draw pile', () => {
    let state = table('4S KS KH 8D 5H 2C 9C AD', '3S');
    state = redraw(state, [id(state, '2C'), id(state, '9C')]);
    expect(state.hand).toHaveLength(7);
  });
});

describe('the same seed and the same actions', () => {
  it('give the same table', () => {
    const run = () => {
      let state = dealt('REPLAY');
      state = redraw(state, [state.hand[0].id, state.hand[1].id]);
      state = addCard(state, [...legalCardIds(state)][0]);
      return playChain(state);
    };
    expect(run()).toEqual(run());
  });
});
