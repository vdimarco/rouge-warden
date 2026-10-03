// Turns the engine's scoring steps into a timed reveal. Pure functions, so tests can check the order.

import { CONFIG } from '../config';
import type { ScoreResult, ScoreStep } from '../engine';

export type RevealStage = 'steps' | 'score' | 'count' | 'coins';

export interface Beat {
  readonly stage: RevealStage;
  /** The scoring step that this beat shows. Null after the steps. */
  readonly step: ScoreStep | null;
  /** When the beat starts, in ms from the tap on Play chain. */
  readonly at: number;
  readonly duration: number;
  /** The scale step to play for a switch: 0 for the first switch of the chain, then 1, 2 and up. */
  readonly note: number | null;
  /** The number of a coin beat, from 0. */
  readonly coin: number | null;
}

const F = CONFIG.feel;

function stepDuration(step: ScoreStep): number {
  switch (step.kind) {
    case 'card':
      return F.cardMs;
    case 'switch':
      return F.switchMs;
    case 'ring':
      return F.ringMs;
    case 'host':
      return F.hostMs;
    case 'charm':
      if (step.timesMult !== 1) return F.multiplyMs;
      return step.index === null ? F.endCharmMs : F.cardCharmMs;
  }
}

/** Every beat of the reveal: the scoring steps, the score, the count-up and one coin per bonus dollar. */
export function revealBeats(result: ScoreResult, coins: number): Beat[] {
  const beats: Beat[] = [];
  let at = 0;
  let switches = 0;
  const push = (stage: RevealStage, step: ScoreStep | null, duration: number, note: number | null, coin: number | null) => {
    beats.push({ stage, step, at, duration, note, coin });
    at += duration;
  };

  for (const step of result.steps) {
    const note = step.kind === 'switch' ? switches++ : null;
    push('steps', step, stepDuration(step), note, null);
  }
  push('score', null, F.scoreHoldMs, null, null);
  push('count', null, F.countUpMs, null, null);
  for (let coin = 0; coin < coins; coin += 1) push('coins', null, F.coinGapMs, null, coin);
  return beats;
}

export function revealLength(beats: readonly Beat[]): number {
  const last = beats[beats.length - 1];
  return last === undefined ? 0 : last.at + last.duration;
}

export interface RingOffset {
  /** Horizontal place in px from the row center. */
  readonly x: number;
  /** Vertical place from -1 (top) to 1 (bottom). CSS multiplies it by the vertical radius. */
  readonly y: number;
  readonly scale: number;
  readonly z: number;
}

/**
 * Where each card of a ring sits, relative to the center of the chain row. The cards go around an
 * ellipse from the left, over the top and back along the bottom, so the ring looks like a loop on the table.
 */
export function ringOffsets(count: number): RingOffset[] {
  const rx = Math.min(F.ringRadiusXMax, Math.max(F.ringRadiusXMin, count * F.ringRadiusXPerCard));
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI + (2 * Math.PI * i) / count;
    const y = Math.abs(Math.sin(angle)) < 1e-9 ? 0 : Math.sin(angle);
    return {
      x: rx * Math.cos(angle),
      y,
      scale: y > 0 ? F.ringFrontScale : y < 0 ? F.ringBackScale : 1,
      z: y > 0 ? 3 : y < 0 ? 1 : 2,
    };
  });
}
