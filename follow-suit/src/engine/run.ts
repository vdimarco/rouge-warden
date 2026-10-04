// A full run: 8 stops of 3 tables, hosts, money, the shop, charms and stamps.
//
// Phases: intro (the stop and its host) -> table -> cleared -> shop -> the next table, or the next intro
// after the host table. The host table of the last stop ends in a win. A lost table ends in a loss.

import { CONFIG } from '../config';
import { createDeck, SUITS } from './cards';
import { EMPTY_SLOTS, freeSlotFor, ownedCharmIds, sellPrice } from './charms';
import { hostScale, hostSequence } from './hosts';
import { tablePayout, type Payout } from './money';
import { createRng, seedState } from './rng';
import { rerollCost, rollOffers, type ShopState } from './shop';
import { applyStamp, canUseStamp } from './stamps';
import {
  addCard,
  playChain,
  redraw,
  startTable,
  tableRules,
  tableTarget,
  undoCard,
  type TableState,
} from './table';
import type { Card, CharmSlots, HostId, Rules, SlotId, StampUse, Suit } from './types';

export type { ShopOffer, ShopState } from './shop';
import type { ShopOffer } from './shop';

export type RunPhase = 'intro' | 'table' | 'cleared' | 'shop' | 'won' | 'lost';

export interface RunState {
  readonly seed: string;
  /** The state of the one seeded generator. */
  readonly rngState: number;
  readonly deck: readonly Card[];
  /** The number for the next card that an Eight Stamp adds. */
  readonly nextCardId: number;
  readonly money: number;
  /** 1 to 8. */
  readonly stop: number;
  /** 0 to 2. The third table is the host table. */
  readonly tableIndex: number;
  /** The host for each stop. */
  readonly hosts: readonly HostId[];
  readonly charms: CharmSlots;
  readonly phase: RunPhase;
  readonly table: TableState | null;
  readonly shop: ShopState | null;
  /** What the last cleared table paid. */
  readonly lastPayout: Payout | null;
  readonly bestChain: number;
}

export function newRun(seed: string): RunState {
  const rng = createRng(seedState(seed));
  const hosts = hostSequence(rng, CONFIG.run.stops);
  const deck = createDeck();
  return {
    seed,
    rngState: rng.state,
    deck,
    nextCardId: deck.length + 1,
    money: CONFIG.run.startMoney,
    stop: 1,
    tableIndex: 0,
    hosts,
    charms: EMPTY_SLOTS,
    phase: 'intro',
    table: null,
    shop: null,
    lastPayout: null,
    bestChain: 0,
  };
}

export function isHostTable(tableIndex: number): boolean {
  return tableIndex === CONFIG.run.tablesPerStop - 1;
}

export function stopHost(run: RunState, stop = run.stop): HostId {
  return run.hosts[stop - 1];
}

/** The 3 targets of a stop. The last one is the host table. */
export function stopTargets(stop: number, host: HostId): number[] {
  return Array.from({ length: CONFIG.run.tablesPerStop }, (_, i) => tableTarget(stop, i, hostScale(host)));
}

function assertPhase(run: RunState, phase: RunPhase): void {
  if (run.phase !== phase) throw new Error(`The run is in the ${run.phase} phase, not ${phase}`);
}

/** Shuffles the whole run deck and deals the table. */
function deal(run: RunState, tableIndex: number): RunState {
  const host = isHostTable(tableIndex) ? stopHost(run) : null;
  const rng = createRng(run.rngState);
  const target = tableTarget(run.stop, tableIndex, hostScale(host));
  const table = startTable(run.deck, { stop: run.stop, tableIndex, target, host }, rng);
  return { ...run, tableIndex, table, shop: null, phase: 'table', rngState: rng.state };
}

/** Leaves the stop intro and deals the first table of the stop. */
export function beginTable(run: RunState): RunState {
  assertPhase(run, 'intro');
  return deal(run, run.tableIndex);
}

/** The limits in play: the host of a host table and the table charm. */
export function runRules(run: RunState): Rules {
  return run.table === null ? { host: null, tableCharm: run.charms.table?.id ?? null } : tableRules(run.table, run.charms);
}

function atTable(run: RunState): TableState {
  assertPhase(run, 'table');
  return run.table!;
}

export function runAddCard(run: RunState, cardId: string, namedSuit?: Suit): RunState {
  return { ...run, table: addCard(atTable(run), cardId, namedSuit, run.charms) };
}

export function runUndo(run: RunState): RunState {
  return { ...run, table: undoCard(atTable(run)) };
}

export function runRedraw(run: RunState, cardIds: readonly string[]): RunState {
  return { ...run, table: redraw(atTable(run), cardIds) };
}

/** Plays the chain. Pays charm money at once, grows Spiral, and clears, wins or loses when that is due. */
export function runPlay(run: RunState): RunState {
  const table = playChain(atTable(run), run.charms);
  const result = table.lastPlay!.result;

  let charms = run.charms;
  if (charms.table?.id === 'spiral' && result.ring) {
    charms = { ...charms, table: { ...charms.table, stacks: charms.table.stacks + 1 } };
  }
  const played: RunState = {
    ...run,
    table,
    charms,
    money: run.money + result.money,
    bestChain: Math.max(run.bestChain, result.score),
  };

  if (table.status === 'lost') return { ...played, phase: 'lost' };
  if (table.status !== 'cleared') return played;

  const payout = tablePayout(table);
  const final = run.stop === CONFIG.run.stops && isHostTable(run.tableIndex);
  return { ...played, money: played.money + payout.total, lastPayout: payout, phase: final ? 'won' : 'cleared' };
}

/** Opens the shop after a cleared table. */
export function openShop(run: RunState): RunState {
  assertPhase(run, 'cleared');
  const rng = createRng(run.rngState);
  const offers = rollOffers(rng, ownedCharmIds(run.charms));
  return { ...run, phase: 'shop', shop: { offers, rerolls: 0 }, rngState: rng.state };
}

/** Leaves the shop for the next table, or for the next stop intro after the host table. */
export function leaveShop(run: RunState): RunState {
  assertPhase(run, 'shop');
  if (!isHostTable(run.tableIndex)) return deal(run, run.tableIndex + 1);
  return { ...run, phase: 'intro', stop: run.stop + 1, tableIndex: 0, table: null, shop: null };
}

function shopOf(run: RunState): ShopState {
  assertPhase(run, 'shop');
  return run.shop!;
}

function markSold(shop: ShopState, offerIndex: number): ShopState {
  return { ...shop, offers: shop.offers.map((offer, i) => (i === offerIndex ? { ...offer, sold: true } : offer)) };
}

/** Why an offer can or cannot be bought now. */
export type BuyStatus = 'ok' | 'sold' | 'money' | 'slot' | 'deck';

export function charmBuyStatus(run: RunState, offerIndex: number): BuyStatus {
  const offer = run.shop?.offers[offerIndex];
  if (offer === undefined || offer.kind !== 'charm' || offer.sold) return 'sold';
  if (ownedCharmIds(run.charms).includes(offer.id)) return 'sold';
  if (freeSlotFor(run.charms, offer.id) === null) return 'slot';
  if (run.money < offer.price) return 'money';
  return 'ok';
}

export function stampBuyStatus(run: RunState, offerIndex: number): BuyStatus {
  const offer = run.shop?.offers[offerIndex];
  if (offer === undefined || offer.kind !== 'stamp' || offer.sold) return 'sold';
  if (!canUseStamp(run.deck, offer.id)) return 'deck';
  if (run.money < offer.price) return 'money';
  return 'ok';
}

/** Buys a charm into the table slot or the first empty suit slot. The slot must be empty. */
export function buyCharm(run: RunState, offerIndex: number): RunState {
  const shop = shopOf(run);
  const status = charmBuyStatus(run, offerIndex);
  if (status !== 'ok') throw new Error(`That charm cannot be bought: ${status}`);
  const offer = shop.offers[offerIndex] as Extract<ShopOffer, { kind: 'charm' }>;
  const slot = freeSlotFor(run.charms, offer.id)!;
  return {
    ...run,
    money: run.money - offer.price,
    charms: { ...run.charms, [slot]: { id: offer.id, stacks: 0 } },
    shop: markSold(shop, offerIndex),
  };
}

/** Sells a charm for half its price, rounded down. */
export function sellCharm(run: RunState, slot: SlotId): RunState {
  shopOf(run);
  const charm = run.charms[slot];
  if (charm === null) throw new Error('That slot is empty');
  return { ...run, money: run.money + sellPrice(charm.id), charms: { ...run.charms, [slot]: null } };
}

/** Moves a suit charm to another suit slot. A charm already there swaps places with it. */
export function moveCharm(run: RunState, from: Suit, to: Suit): RunState {
  shopOf(run);
  if (!SUITS.includes(from) || !SUITS.includes(to)) throw new Error('Only suit charms can move');
  if (run.charms[from] === null) throw new Error('That slot is empty');
  return { ...run, charms: { ...run.charms, [from]: run.charms[to], [to]: run.charms[from] } };
}

/** Replaces every offer. The cost rises with each reroll in the same shop. */
export function reroll(run: RunState): RunState {
  const shop = shopOf(run);
  const cost = rerollCost(shop.rerolls);
  if (run.money < cost) throw new Error('Not enough money');
  const rng = createRng(run.rngState);
  const offers = rollOffers(rng, ownedCharmIds(run.charms));
  return { ...run, money: run.money - cost, shop: { offers, rerolls: shop.rerolls + 1 }, rngState: rng.state };
}

/** Buys a stamp and applies it to the run deck at once. */
export function buyStamp(run: RunState, offerIndex: number, use: StampUse): RunState {
  const shop = shopOf(run);
  const offer = shop.offers[offerIndex];
  if (offer === undefined || offer.kind !== 'stamp' || offer.id !== use.id) throw new Error('That stamp is not for sale');
  const status = stampBuyStatus(run, offerIndex);
  if (status !== 'ok') throw new Error(`That stamp cannot be bought: ${status}`);
  const { deck, nextCardId } = applyStamp(run.deck, run.nextCardId, use);
  return { ...run, deck, nextCardId, money: run.money - offer.price, shop: markSold(shop, offerIndex) };
}
