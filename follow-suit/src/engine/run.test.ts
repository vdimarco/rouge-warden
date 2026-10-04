import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { sortCards } from './cards';
import {
  beginTable,
  buyCharm,
  buyStamp,
  charmBuyStatus,
  stampBuyStatus,
  leaveShop,
  moveCharm,
  newRun,
  openShop,
  reroll,
  runAddCard,
  runPlay,
  runRedraw,
  runRules,
  runUndo,
  sellCharm,
  stopTargets,
  type RunState,
  type ShopOffer,
} from './run';
import { namedSuitOptions } from './chain';
import { cards, slots } from './test-helpers';
import type { Card, CharmId, Suit } from './types';

const SEED = 'K7QX2M';

/** A run at a table with a known hand and draw pile. */
function atTable(run: RunState, hand: string, draw = '3S 3H 3D 3C 6S 6H 6D 6C', target = 150, extra: object = {}): RunState {
  const started = run.phase === 'table' ? run : beginTable(run);
  return {
    ...started,
    table: {
      ...started.table!,
      hand: sortCards(cards(hand)),
      drawPile: draw ? cards(draw) : [],
      discard: [],
      chain: [],
      target,
      ...extra,
    },
  };
}

function find(run: RunState, code: string): Card {
  const [rankText, suit] = [code.slice(0, -1), code.slice(-1)];
  const rank = { J: 11, Q: 12, K: 13, A: 14 }[rankText] ?? Number(rankText);
  const card = run.table!.hand.find((c) => c.suit === suit && c.rank === rank);
  if (!card) throw new Error(`${code} is not in the hand`);
  return card;
}

/** Adds cards by code (`8D>H` names a suit) and plays the chain. */
function play(run: RunState, codes: string): RunState {
  let state = run;
  for (const token of codes.split(' ')) {
    const [code, named] = token.split('>');
    state = runAddCard(state, find(state, code).id, named as Suit | undefined);
  }
  return runPlay(state);
}

/** Clears the current table with one card against a target of 0, which even The Jeweler allows. */
function clearTable(run: RunState): RunState {
  const started = run.phase === 'intro' ? beginTable(run) : run;
  const first = started.table!.hand[0];
  const named = namedSuitOptions([], first, runRules(started))[0];
  return runPlay(runAddCard({ ...started, table: { ...started.table!, target: 0 } }, first.id, named));
}

function inShop(offers: ShopOffer[], money = 20, charms = slots({})): RunState {
  return { ...newRun(SEED), phase: 'shop', money, charms, shop: { offers, rerolls: 0 } };
}

const charmOffer = (id: CharmId, price: number): ShopOffer => ({ kind: 'charm', id, price, sold: false });

describe('a new run', () => {
  const run = newRun(SEED);

  it('starts at the stop 1 intro with $4, a 52-card deck and empty charm slots', () => {
    expect(run.phase).toBe('intro');
    expect(run.stop).toBe(1);
    expect(run.tableIndex).toBe(0);
    expect(run.money).toBe(4);
    expect(run.deck).toHaveLength(52);
    expect(run.seed).toBe(SEED);
    expect(Object.values(run.charms).every((charm) => charm === null)).toBe(true);
    expect(run.table).toBeNull();
    expect(run.bestChain).toBe(0);
  });

  it('picks a host for each of the 8 stops from the seed', () => {
    expect(run.hosts).toHaveLength(8);
    expect(new Set(run.hosts.slice(0, 5)).size).toBe(5);
    expect(newRun(SEED).hosts).toEqual(run.hosts);
  });

  it('deals the same first hand for the same seed', () => {
    const hand = (seed: string) => beginTable(newRun(seed)).table!.hand.map((c) => `${c.rank}${c.suit}`);
    expect(hand(SEED)).toEqual(hand(SEED));
    expect(hand(SEED)).not.toEqual(hand('OTHER1'));
  });
});

describe('tables and targets', () => {
  it('starts the first table with the stop 1 base target and no host', () => {
    const run = beginTable(newRun(SEED));
    expect(run.phase).toBe('table');
    expect(run.table!.target).toBe(CONFIG.run.baseTargets[0]);
    expect(run.table!.host).toBeNull();
    expect(run.table!.hand).toHaveLength(8);
  });

  it('lists the 3 targets of a stop', () => {
    const [b1, b2] = CONFIG.run.baseTargets;
    const { purist, zebra } = CONFIG.run.hostScale;
    expect(stopTargets(1, 'purist')).toEqual([b1, Math.round(b1 * 1.5), Math.round(b1 * 2 * purist)]);
    expect(stopTargets(2, 'zebra')).toEqual([b2, Math.round(b2 * 1.5), Math.round(b2 * 2 * zebra)]);
  });

  it('puts the stop host at the third table', () => {
    let run = newRun(SEED);
    run = leaveShop(openShop(clearTable(run)));
    run = leaveShop(openShop(clearTable(run)));
    expect(run.tableIndex).toBe(2);
    expect(run.table!.host).toBe(run.hosts[0]);
    expect(run.table!.target).toBe(Math.round(CONFIG.run.baseTargets[0] * 2 * CONFIG.run.hostScale[run.hosts[0]]));
    expect(runRules(run)).toEqual({ host: run.hosts[0], tableCharm: null });
  });

  it('shuffles the whole run deck for each table', () => {
    const run = leaveShop(openShop(clearTable(newRun(SEED))));
    expect(run.table!.hand.length + run.table!.drawPile.length).toBe(52);
  });
});

describe('clearing and losing', () => {
  it('pays the player at once when a table clears, then opens the shop', () => {
    const cleared = clearTable(newRun(SEED));
    expect(cleared.phase).toBe('cleared');
    expect(cleared.lastPayout).toMatchObject({ table: 3, unusedChains: 2 });
    expect(cleared.money).toBe(4 + cleared.lastPayout!.total);

    const shop = openShop(cleared);
    expect(shop.phase).toBe('shop');
    expect(shop.shop!.offers).toHaveLength(4);
    expect(shop.shop!.rerolls).toBe(0);
  });

  it('moves to the next stop intro after the host table', () => {
    let run = newRun(SEED);
    for (let i = 0; i < 3; i += 1) run = leaveShop(openShop(clearTable(run)));
    expect(run.phase).toBe('intro');
    expect(run.stop).toBe(2);
    expect(run.tableIndex).toBe(0);
    expect(beginTable(run).table!.target).toBe(CONFIG.run.baseTargets[1]);
  });

  it('wins the run when the host table of stop 8 clears, with no shop after it', () => {
    let run: RunState = { ...newRun(SEED), stop: 8, tableIndex: 2, phase: 'intro' };
    run = clearTable(run);
    expect(run.phase).toBe('won');
    expect(run.shop).toBeNull();
  });

  it('ends the run when the last chain leaves the total below the target', () => {
    const run = play(atTable(newRun(SEED), '2C 9S KH 4D 5D 6D 7D 9D', '', 10_000, { chainsLeft: 1 }), '2C');
    expect(run.phase).toBe('lost');
  });

  it('remembers the best chain', () => {
    let run = atTable(newRun(SEED), '7S KS KH 4H 4C 7C 2D 3D', undefined, 100_000);
    run = play(run, '7S KS KH 4H 4C 7C');
    expect(run.bestChain).toBe(252);
    run = play(run, '3S');
    expect(run.bestChain).toBe(252);
  });
});

describe('charms during play', () => {
  it('pays charm money when the chain is played', () => {
    let run = { ...newRun(SEED), charms: slots({ H: 'pawnbroker' }) };
    run = play(atTable(run, 'KS KH 4H 2C 9C 5D 6D 7D', undefined, 10_000), 'KS KH');
    expect(run.money).toBe(5);
  });

  it('uses the table charm for the follow rules', () => {
    let run = { ...newRun(SEED), charms: slots({ table: 'bridge' }) };
    run = atTable(run, '5H AC 2C 9S KD 4D 6D 7D', undefined, 10_000);
    run = runAddCard(run, find(run, '5H').id);
    expect(runAddCard(run, find(run, 'AC').id).table!.chain).toHaveLength(2);
    expect(() => runAddCard(run, find(run, '9S').id)).toThrow();
    expect(runUndo(run).table!.chain).toHaveLength(0);
  });

  it('gives Spiral 1 Mult for each ring', () => {
    let run = { ...newRun(SEED), charms: slots({ table: 'spiral' }) };
    run = play(atTable(run, '2S 3S 4S 5S 9H 9C 9D KD', undefined, 100_000), '2S 3S 4S 5S');
    expect(run.charms.table).toEqual({ id: 'spiral', stacks: 1 });
    run = play(run, '9H');
    expect(run.charms.table!.stacks).toBe(1);
  });

  it('scores with every charm in the slots', () => {
    let run = { ...newRun(SEED), charms: slots({ S: 'lantern', table: 'knot' }) };
    run = play(atTable(run, '7S KS KH 4H 4C 7C 2D 3D', undefined, 100_000), '7S KS KH 4H 4C 7C');
    // Value 42 + 4 + 4 for the two spades. Mult (1 + 2) x 3 for the Knot ring.
    expect(run.table!.total).toBe(50 * 9);
  });

  it('allows a redraw through the run', () => {
    let run = atTable(newRun(SEED), '5H AC 2C 9S KD 4D 6D 7D');
    run = runRedraw(run, [find(run, '2C').id]);
    expect(run.table!.redrawsLeft).toBe(1);
  });
});

describe('buying and selling charms', () => {
  it('buys a suit charm into the first empty suit slot', () => {
    const run = buyCharm(inShop([charmOffer('lantern', 4)], 10), 0);
    expect(run.money).toBe(6);
    expect(run.charms.S).toEqual({ id: 'lantern', stacks: 0 });
    expect(run.shop!.offers[0].sold).toBe(true);
    expect(() => buyCharm(run, 0)).toThrow();
  });

  it('skips full suit slots', () => {
    const run = buyCharm(inShop([charmOffer('lantern', 4)], 10, slots({ S: 'crown', H: 'hinge' })), 0);
    expect(run.charms.C).toEqual({ id: 'lantern', stacks: 0 });
  });

  it('needs the money', () => {
    expect(() => buyCharm(inShop([charmOffer('knot', 8)], 7), 0)).toThrow();
  });

  it('needs the old charm sold first when the slot is full', () => {
    const full = inShop([charmOffer('knot', 8)], 20, slots({ table: 'tidy' }));
    expect(() => buyCharm(full, 0)).toThrow();
    const sold = sellCharm(full, 'table');
    expect(sold.money).toBe(23);
    expect(buyCharm(sold, 0).charms.table).toEqual({ id: 'knot', stacks: 0 });

    const suitsFull = inShop([charmOffer('lantern', 4)], 20, slots({ S: 'crown', H: 'hinge', C: 'pawnbroker', D: 'lantern' }));
    expect(() => buyCharm(suitsFull, 0)).toThrow();
  });

  it('sells a charm for half its price, rounded down', () => {
    const run = sellCharm(inShop([], 0, slots({ H: 'hinge' })), 'H');
    expect(run.money).toBe(3);
    expect(run.charms.H).toBeNull();
    expect(() => sellCharm(run, 'H')).toThrow();
  });

  it('moves a suit charm to another suit slot, and swaps with a charm already there', () => {
    const run = inShop([], 0, slots({ S: 'lantern', H: 'crown' }));
    expect(moveCharm(run, 'S', 'D').charms).toMatchObject({ S: null, D: { id: 'lantern' } });
    expect(moveCharm(run, 'S', 'H').charms).toMatchObject({ S: { id: 'crown' }, H: { id: 'lantern' } });
  });

  it('keeps charms out of the shop once they are owned', () => {
    let run = clearTable({ ...newRun(SEED), charms: slots({ S: 'lantern', H: 'crown', table: 'knot' }) });
    run = openShop(run);
    for (const offer of run.shop!.offers) {
      if (offer.kind === 'charm') expect(['lantern', 'crown', 'knot']).not.toContain(offer.id);
    }
  });
});

describe('rerolls and stamps', () => {
  it('rerolls for $2, then $3, and needs the money', () => {
    let run = openShop(clearTable(newRun(SEED)));
    run = { ...run, money: 5 };
    run = reroll(run);
    expect(run.money).toBe(3);
    expect(run.shop!.rerolls).toBe(1);
    run = reroll(run);
    expect(run.money).toBe(0);
    expect(() => reroll(run)).toThrow();
  });

  it('uses a stamp on the run deck at once', () => {
    const run = buyStamp(inShop([{ kind: 'stamp', id: 'eight', price: 3, sold: false }], 5), 0, { id: 'eight', suit: 'H' });
    expect(run.money).toBe(2);
    expect(run.deck).toHaveLength(53);
    expect(run.nextCardId).toBe(54);
    expect(run.shop!.offers[0].sold).toBe(true);
  });

  it('refuses a stamp that does not match the offer', () => {
    const run = inShop([{ kind: 'stamp', id: 'eight', price: 3, sold: false }], 5);
    expect(() => buyStamp(run, 0, { id: 'burn', cardId: run.deck[0].id })).toThrow();
  });

  it('carries the stamped deck into the next table', () => {
    let run = openShop(clearTable(newRun(SEED)));
    run = { ...run, money: 10, shop: { offers: [{ kind: 'stamp', id: 'eight', price: 3, sold: false }], rerolls: 0 } };
    run = leaveShop(buyStamp(run, 0, { id: 'eight', suit: 'C' }));
    expect(run.table!.hand.length + run.table!.drawPile.length).toBe(53);
  });
});

describe('replay', () => {
  it('gives the same run for the same seed and the same actions', () => {
    const go = () => {
      let run = beginTable(newRun(SEED));
      run = runAddCard(run, run.table!.hand.find((c) => c.rank !== 8)!.id);
      run = runPlay(run);
      return run;
    };
    expect(go()).toEqual(go());
  });
});

describe('what the shop allows', () => {
  it('says why a charm cannot be bought', () => {
    const offers = [charmOffer('lantern', 4), charmOffer('knot', 8)];
    expect(charmBuyStatus(inShop(offers, 10), 0)).toBe('ok');
    expect(charmBuyStatus(inShop(offers, 7), 1)).toBe('money');
    expect(charmBuyStatus(inShop(offers, 10, slots({ table: 'tidy' })), 1)).toBe('slot');
    expect(charmBuyStatus(buyCharm(inShop(offers, 10), 0), 0)).toBe('sold');
  });

  it('says why a stamp cannot be bought', () => {
    const offers: ShopOffer[] = [
      { kind: 'stamp', id: 'burn', price: 3, sold: false },
      { kind: 'stamp', id: 'eight', price: 3, sold: false },
    ];
    expect(stampBuyStatus(inShop(offers, 3), 1)).toBe('ok');
    expect(stampBuyStatus(inShop(offers, 2), 1)).toBe('money');
    const small = { ...inShop(offers, 10), deck: newRun(SEED).deck.slice(0, 20) };
    expect(stampBuyStatus(small, 0)).toBe('deck');
    expect(stampBuyStatus(small, 1)).toBe('ok');
  });
});
