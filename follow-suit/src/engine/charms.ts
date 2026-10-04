// The 13 charms, their slots, rarities, prices and texts. Their effects live in chain.ts and scoring.ts.

import { CONFIG } from '../config';
import { SUITS } from './cards';
import type { CharmId, CharmSlots, Rarity, SlotId, Suit } from './types';

export interface CharmDef {
  readonly id: CharmId;
  readonly name: string;
  /** A suit charm sits in a suit slot. A table charm sits in the table slot. */
  readonly slot: 'suit' | 'table';
  readonly rarity: Rarity;
  readonly text: string;
}

const C = CONFIG.charms;

export const CHARMS: Readonly<Record<CharmId, CharmDef>> = {
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    slot: 'suit',
    rarity: 'common',
    text: `Each card of this suit adds +${C.lanternValue} Value.`,
  },
  crown: {
    id: 'crown',
    name: 'Crown',
    slot: 'suit',
    rarity: 'common',
    text: `Each face card of this suit adds +${C.crownValue} Value.`,
  },
  pawnbroker: {
    id: 'pawnbroker',
    name: 'Pawnbroker',
    slot: 'suit',
    rarity: 'common',
    text: `Earn $${C.pawnbrokerMoney} for each switch into this suit.`,
  },
  hinge: {
    id: 'hinge',
    name: 'Hinge',
    slot: 'suit',
    rarity: 'uncommon',
    text: `A switch into this suit adds +${C.hingeSwitchMult} Mult instead of +${CONFIG.chain.switchMult}.`,
  },
  luckyEight: {
    id: 'luckyEight',
    name: 'Lucky Eight',
    slot: 'table',
    rarity: 'common',
    text: `Each 8 in the chain adds +${C.luckyEightMult} Mult.`,
  },
  longHaul: {
    id: 'longHaul',
    name: 'Long Haul',
    slot: 'table',
    rarity: 'common',
    text: `Add +${C.longHaulMult} Mult for every ${C.longHaulCards} cards in the chain, rounded down.`,
  },
  pocket: {
    id: 'pocket',
    name: 'Pocket',
    slot: 'table',
    rarity: 'common',
    text: `Add +${C.pocketValue} Value for each card left in hand after the chain.`,
  },
  turncoat: {
    id: 'turncoat',
    name: 'Turncoat',
    slot: 'table',
    rarity: 'uncommon',
    text: 'Once per chain, a card can follow the previous card by color.',
  },
  bridge: {
    id: 'bridge',
    name: 'Bridge',
    slot: 'table',
    rarity: 'uncommon',
    text: 'Once per chain, an A can follow any card.',
  },
  tidy: {
    id: 'tidy',
    name: 'Tidy',
    slot: 'table',
    rarity: 'uncommon',
    text: `If the chain uses every card in hand, multiply Mult by ${C.tidyMult}.`,
  },
  ledger: {
    id: 'ledger',
    name: 'Ledger',
    slot: 'table',
    rarity: 'uncommon',
    text: `Earn $${C.ledgerMoney} for each chain of ${C.ledgerMinCards} or more cards.`,
  },
  knot: {
    id: 'knot',
    name: 'Knot',
    slot: 'table',
    rarity: 'rare',
    text: `A ring multiplies Mult by ${C.knotRingMult} instead of ${CONFIG.chain.ringMult}.`,
  },
  spiral: {
    id: 'spiral',
    name: 'Spiral',
    slot: 'table',
    rarity: 'rare',
    text: `After each ring, gain +${C.spiralMult} Mult for the rest of the run. Every chain adds that Mult.`,
  },
};

export const CHARM_IDS = Object.keys(CHARMS) as CharmId[];

export const EMPTY_SLOTS: CharmSlots = { S: null, H: null, D: null, C: null, table: null };

/** Slots in display order: the 4 suits, then the table. */
export const SLOT_IDS: readonly SlotId[] = [...SUITS, 'table'];

export function charmPrice(id: CharmId): number {
  return CONFIG.shop.charmPrices[CHARMS[id].rarity];
}

export function sellPrice(id: CharmId): number {
  return Math.floor(charmPrice(id) / CONFIG.shop.sellDivisor);
}

export function ownedCharmIds(slots: CharmSlots): CharmId[] {
  return SLOT_IDS.flatMap((slot) => {
    const charm = slots[slot];
    return charm === null ? [] : [charm.id];
  });
}

/** The slot a new charm would go to: the table slot, or the first empty suit slot. Null when full. */
export function freeSlotFor(slots: CharmSlots, id: CharmId): SlotId | null {
  if (CHARMS[id].slot === 'table') return slots.table === null ? 'table' : null;
  return SUITS.find((suit: Suit) => slots[suit] === null) ?? null;
}
