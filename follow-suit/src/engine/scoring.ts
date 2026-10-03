// Scores a chain in the brief's order and records each step, so the UI can replay the reveal.
//
// 1. Value 0, Mult 1.
// 2. For each card: add its points, fire its suit charm, add Mult for a switch, fire per-card table effects.
// 3. End-of-chain effects that add Value or Mult.
// 4. Effects that multiply Mult, such as the ring.
// 5. Score = Value times Mult, rounded down.

import { CONFIG } from '../config';
import { cardPoints } from './cards';
import { causesSwitch, countSwitches, isRing } from './chain';
import type { ChainLink } from './types';

export type ScoreStepKind = 'card' | 'switch' | 'ring';

export interface ScoreStep {
  readonly kind: ScoreStepKind;
  /** The chain position that the step belongs to. Null for end-of-chain steps. */
  readonly index: number | null;
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

interface Change {
  addValue?: number;
  addMult?: number;
  timesMult?: number;
  money?: number;
}

export function scoreChain(chain: readonly ChainLink[]): ScoreResult {
  let value: number = CONFIG.chain.startValue;
  let mult: number = CONFIG.chain.startMult;
  let money = 0;
  const steps: ScoreStep[] = [];

  const step = (kind: ScoreStepKind, index: number | null, change: Change) => {
    const { addValue = 0, addMult = 0, timesMult = 1, money: earned = 0 } = change;
    value += addValue;
    mult = (mult + addMult) * timesMult;
    money += earned;
    steps.push({ kind, index, addValue, addMult, timesMult, money: earned, value, mult });
  };

  chain.forEach((link, index) => {
    step('card', index, { addValue: cardPoints(link.card) });
    if (causesSwitch(chain, index)) step('switch', index, { addMult: CONFIG.chain.switchMult });
  });

  const ring = isRing(chain);
  if (ring) step('ring', null, { timesMult: CONFIG.chain.ringMult });

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

/** Live numbers for the chain in progress, from the base rules only. */
export function previewChain(chain: readonly ChainLink[]): ChainPreview {
  const switches = countSwitches(chain);
  return {
    value: chain.reduce<number>((sum, link) => sum + cardPoints(link.card), CONFIG.chain.startValue),
    mult: CONFIG.chain.startMult + switches * CONFIG.chain.switchMult,
    switches,
    ring: isRing(chain),
  };
}
