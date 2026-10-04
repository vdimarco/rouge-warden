// Scores a chain in the brief's order and records each step, so the UI can replay the reveal.
//
// 1. Value 0, Mult 1.
// 2. For each card: add its points, fire its suit charm, add Mult for a switch, fire per-card table effects.
// 3. End-of-chain effects that add Value or Mult.
// 4. Effects that multiply Mult, such as the ring.
// 5. Score = Value times Mult, rounded down. The Jeweler zeroes a chain that is not a ring.

import { CONFIG } from '../config';
import { cardPoints, isFaceCard } from './cards';
import { causesSwitch, countSwitches, isRing } from './chain';
import { EMPTY_SLOTS } from './charms';
import type { ChainLink, CharmId, CharmSlots, HostId, SlotId } from './types';

export type ScoreStepKind = 'card' | 'charm' | 'switch' | 'ring' | 'host';

export interface ScoreStep {
  readonly kind: ScoreStepKind;
  /** The chain position that the step belongs to. Null for end-of-chain steps. */
  readonly index: number | null;
  /** The charm or host that caused the step, if any. */
  readonly source: CharmId | HostId | null;
  /** The charm slot that fired, if any. */
  readonly slot: SlotId | null;
  readonly addValue: number;
  readonly addMult: number;
  /** 1 when the step does not multiply Mult. */
  readonly timesMult: number;
  readonly money: number;
  /** Value after this step. */
  readonly value: number;
  /** Mult after this step. */
  readonly mult: number;
}

export interface ScoreResult {
  readonly value: number;
  readonly mult: number;
  readonly score: number;
  readonly switches: number;
  readonly ring: boolean;
  /** Money that the chain earns from charm effects. */
  readonly money: number;
  readonly steps: readonly ScoreStep[];
}

export interface ScoreContext {
  readonly host?: HostId | null;
  readonly charms?: CharmSlots;
  /** Cards in hand when the chain is played, chain cards included. Defaults to the chain length. */
  readonly handSize?: number;
}

interface Change {
  addValue?: number;
  addMult?: number;
  timesMult?: number;
  money?: number;
}

export function scoreChain(chain: readonly ChainLink[], context: ScoreContext = {}): ScoreResult {
  const charms = context.charms ?? EMPTY_SLOTS;
  const host = context.host ?? null;
  const handSize = context.handSize ?? chain.length;
  const tableCharm = charms.table;
  const C = CONFIG.charms;

  let value: number = CONFIG.chain.startValue;
  let mult: number = CONFIG.chain.startMult;
  let money = 0;
  const steps: ScoreStep[] = [];

  const step = (
    kind: ScoreStepKind,
    index: number | null,
    source: CharmId | HostId | null,
    slot: SlotId | null,
    change: Change,
  ) => {
    const { addValue = 0, addMult = 0, timesMult = 1, money: earned = 0 } = change;
    value += addValue;
    mult = (mult + addMult) * timesMult;
    money += earned;
    steps.push({ kind, index, source, slot, addValue, addMult, timesMult, money: earned, value, mult });
  };

  chain.forEach((link, index) => {
    step('card', index, null, null, { addValue: cardPoints(link.card) });

    // The suit charm for the card's suit. A wild 8 uses its named suit, which is `link.suit`.
    const suitCharm = charms[link.suit];
    if (suitCharm?.id === 'lantern') step('charm', index, 'lantern', link.suit, { addValue: C.lanternValue });
    if (suitCharm?.id === 'crown' && isFaceCard(link.card)) {
      step('charm', index, 'crown', link.suit, { addValue: C.crownValue });
    }

    if (causesSwitch(chain, index)) {
      const hinge = suitCharm?.id === 'hinge';
      step('switch', index, hinge ? 'hinge' : null, hinge ? link.suit : null, {
        addMult: hinge ? C.hingeSwitchMult : CONFIG.chain.switchMult,
      });
      if (suitCharm?.id === 'pawnbroker') step('charm', index, 'pawnbroker', link.suit, { money: C.pawnbrokerMoney });
    }

    if (tableCharm?.id === 'luckyEight' && link.card.rank === CONFIG.cards.wildRank) {
      step('charm', index, 'luckyEight', 'table', { addMult: C.luckyEightMult });
    }
  });

  if (chain.length === 0) {
    return { value, mult, score: 0, switches: 0, ring: false, money, steps };
  }

  // End-of-chain effects that add Value or Mult. Only one table charm can be in play.
  switch (tableCharm?.id) {
    case 'longHaul': {
      const added = Math.floor(chain.length / C.longHaulCards) * C.longHaulMult;
      if (added > 0) step('charm', null, 'longHaul', 'table', { addMult: added });
      break;
    }
    case 'pocket': {
      const left = handSize - chain.length;
      if (left > 0) step('charm', null, 'pocket', 'table', { addValue: left * C.pocketValue });
      break;
    }
    case 'spiral':
      if (tableCharm.stacks > 0) step('charm', null, 'spiral', 'table', { addMult: tableCharm.stacks * C.spiralMult });
      break;
    case 'ledger':
      if (chain.length >= C.ledgerMinCards) step('charm', null, 'ledger', 'table', { money: C.ledgerMoney });
      break;
  }

  // Effects that multiply Mult.
  const ring = isRing(chain);
  if (ring) {
    const knot = tableCharm?.id === 'knot';
    step('ring', null, knot ? 'knot' : null, knot ? 'table' : null, {
      timesMult: knot ? C.knotRingMult : CONFIG.chain.ringMult,
    });
  }
  if (tableCharm?.id === 'tidy' && chain.length === handSize) {
    step('charm', null, 'tidy', 'table', { timesMult: C.tidyMult });
  }
  if (host === 'jeweler' && !ring) step('host', null, 'jeweler', null, { timesMult: 0 });

  return {
    value,
    mult,
    score: Math.floor(value * mult),
    switches: countSwitches(chain),
    ring,
    money,
    steps,
  };
}

export interface ChainPreview {
  readonly value: number;
  /** 1 plus the switches. The ring multiplier is not included. */
  readonly mult: number;
  readonly switches: number;
  readonly ring: boolean;
}

/** Live numbers for the chain in progress, from the base rules only. Charm effects stay hidden. */
export function previewChain(chain: readonly ChainLink[]): ChainPreview {
  const switches = countSwitches(chain);
  return {
    value: chain.reduce<number>((sum, link) => sum + cardPoints(link.card), CONFIG.chain.startValue),
    mult: CONFIG.chain.startMult + switches * CONFIG.chain.switchMult,
    switches,
    ring: isRing(chain),
  };
}
