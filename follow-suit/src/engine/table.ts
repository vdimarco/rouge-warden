// One table: deal, build a chain, play it, redraw, clear or lose.

import { CONFIG } from '../config';
import { sortCards } from './cards';
import { addToChain, legalCards, undoChain } from './chain';
import { EMPTY_SLOTS } from './charms';
import type { Rng } from './rng';
import { scoreChain, type ScoreResult } from './scoring';
import type { Card, ChainLink, CharmSlots, HostId, Rules, Suit } from './types';

export type TableStatus = 'playing' | 'cleared' | 'lost';

export interface TableSetup {
  /** 1 to 8. */
  readonly stop: number;
  /** 0 for the first table, 1 for the second, 2 for the host table. */
  readonly tableIndex: number;
  readonly target: number;
  /** The host of a host table. Null at the other tables. */
  readonly host?: HostId | null;
}

export interface PlayedChain {
  readonly links: readonly ChainLink[];
  readonly result: ScoreResult;
  /** Cards in hand when the chain was played, chain cards included. */
  readonly handSize: number;
}

export interface TableState {
  readonly stop: number;
  readonly tableIndex: number;
  readonly target: number;
  readonly host: HostId | null;
  /** The next card to draw is first. */
  readonly drawPile: readonly Card[];
  /** The whole hand, sorted. Cards in the chain in progress stay in this list. */
  readonly hand: readonly Card[];
  readonly discard: readonly Card[];
  readonly chain: readonly ChainLink[];
  readonly chainsLeft: number;
  readonly redrawsLeft: number;
  readonly total: number;
  readonly status: TableStatus;
  readonly lastPlay: PlayedChain | null;
  readonly bestChain: number;
}

/**
 * The score target for a table, rounded to a whole number.
 * `stop` is 1 to 8. `tableIndex` is 0 to 2, and 2 is the host table, which also takes the host's scale.
 */
export function tableTarget(stop: number, tableIndex: number, hostScale = 1): number {
  const base = CONFIG.run.baseTargets[stop - 1];
  const scale = CONFIG.run.tableScale[tableIndex];
  if (base === undefined || scale === undefined) throw new Error(`No table ${tableIndex + 1} at stop ${stop}`);
  const isHostTable = tableIndex === CONFIG.run.tablesPerStop - 1;
  return Math.round(base * scale * (isHostTable ? hostScale : 1));
}

/** Shuffles the deck into a draw pile and deals a hand. The generator moves on. */
export function startTable(deck: readonly Card[], setup: TableSetup, rng: Rng): TableState {
  const shuffled = rng.shuffle(deck);
  const { handSize, chains, redraws } = CONFIG.table;
  return {
    stop: setup.stop,
    tableIndex: setup.tableIndex,
    target: setup.target,
    host: setup.host ?? null,
    hand: sortCards(shuffled.slice(0, handSize)),
    drawPile: shuffled.slice(handSize),
    discard: [],
    chain: [],
    chainsLeft: chains,
    redrawsLeft: redraws,
    total: 0,
    status: 'playing',
    lastPlay: null,
    bestChain: 0,
  };
}

/** The limits in play at this table: its host and the table charm. */
export function tableRules(state: TableState, charms: CharmSlots = EMPTY_SLOTS): Rules {
  return { host: state.host ?? null, tableCharm: charms.table?.id ?? null };
}

function inChain(state: TableState, cardId: string): boolean {
  return state.chain.some((link) => link.card.id === cardId);
}

/** Hand cards that are not in the chain in progress. */
export function availableCards(state: TableState): Card[] {
  return state.hand.filter((card) => !inChain(state, card.id));
}

/** Ids of the hand cards that can join the chain next. */
export function legalCardIds(state: TableState, charms: CharmSlots = EMPTY_SLOTS): Set<string> {
  if (state.status !== 'playing') return new Set();
  const cards = legalCards(state.chain, availableCards(state), tableRules(state, charms));
  return new Set(cards.map((card) => card.id));
}

function assertPlaying(state: TableState): void {
  if (state.status !== 'playing') throw new Error(`The table is ${state.status}`);
}

export function addCard(
  state: TableState,
  cardId: string,
  namedSuit?: Suit,
  charms: CharmSlots = EMPTY_SLOTS,
): TableState {
  assertPlaying(state);
  const card = availableCards(state).find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} is not available in the hand`);
  return { ...state, chain: addToChain(state.chain, card, namedSuit, tableRules(state, charms)) };
}

export function undoCard(state: TableState): TableState {
  assertPlaying(state);
  return { ...state, chain: undoChain(state.chain) };
}

export function canPlay(state: TableState): boolean {
  return state.status === 'playing' && state.chain.length > 0;
}

/** Draws from the draw pile until the hand is full or the pile is empty. */
function refill(hand: readonly Card[], drawPile: readonly Card[]): { hand: Card[]; drawPile: Card[] } {
  const count = Math.max(0, Math.min(CONFIG.table.handSize - hand.length, drawPile.length));
  return { hand: sortCards([...hand, ...drawPile.slice(0, count)]), drawPile: drawPile.slice(count) };
}

/** Scores the chain, discards it and refills the hand. Clears or loses the table when that is due. */
export function playChain(state: TableState, charms: CharmSlots = EMPTY_SLOTS): TableState {
  if (!canPlay(state)) throw new Error('There is no chain to play');

  const result = scoreChain(state.chain, { host: state.host ?? null, charms, handSize: state.hand.length });
  const played = state.chain.map((link) => link.card);
  const kept = state.hand.filter((card) => !inChain(state, card.id));
  const { hand, drawPile } = refill(kept, state.drawPile);
  const total = state.total + result.score;
  const chainsLeft = state.chainsLeft - 1;

  let status: TableStatus = 'playing';
  if (total >= state.target) status = 'cleared';
  else if (chainsLeft === 0 || hand.length === 0) status = 'lost';

  return {
    ...state,
    hand,
    drawPile,
    discard: [...state.discard, ...played],
    chain: [],
    chainsLeft,
    total,
    status,
    lastPlay: { links: state.chain, result, handSize: state.hand.length },
    bestChain: Math.max(state.bestChain, result.score),
  };
}

export function canRedraw(state: TableState): boolean {
  return state.status === 'playing' && state.redrawsLeft > 0 && state.chain.length === 0;
}

/** Discards the selected cards and draws back to a full hand. */
export function redraw(state: TableState, cardIds: readonly string[]): TableState {
  if (!canRedraw(state)) throw new Error('A redraw is not allowed now');
  const ids = new Set(cardIds);
  if (ids.size === 0) throw new Error('Select at least one card to redraw');
  const selected = state.hand.filter((card) => ids.has(card.id));
  if (selected.length !== ids.size) throw new Error('Every selected card must be in the hand');

  const kept = state.hand.filter((card) => !ids.has(card.id));
  const { hand, drawPile } = refill(kept, state.drawPile);
  return {
    ...state,
    hand,
    drawPile,
    discard: [...state.discard, ...selected],
    redrawsLeft: state.redrawsLeft - 1,
    status: hand.length === 0 ? 'lost' : state.status,
  };
}
