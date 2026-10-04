// Drives the score reveal. The screen keeps showing the run as it was until the reveal ends, then the
// new run state from the engine takes over.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../config';
import type { ChainLink, RunState, ScoreResult, SlotId } from '../engine';
import { playCoin, playRingChord, playSwitchNote, unlockAudio } from './audio';
import { revealBeats, type Beat } from './reveal';

interface Running {
  readonly next: RunState;
  readonly links: readonly ChainLink[];
  readonly result: ScoreResult;
  readonly beats: readonly Beat[];
  readonly index: number;
  readonly startTotal: number;
  readonly endTotal: number;
  readonly startMoney: number;
}

export interface RevealView {
  readonly beat: Beat | null;
  readonly beatIndex: number;
  readonly links: readonly ChainLink[];
  readonly result: ScoreResult;
  /** Running Value and Mult after the latest step. */
  readonly value: number;
  readonly mult: number;
  /** Chain positions scored so far: cards up to this index are lit. -1 before the first card. */
  readonly scoredUpTo: number;
  readonly ringed: boolean;
  readonly lit: ReadonlySet<SlotId>;
  readonly total: number;
  readonly money: number;
  /** The chain score, once every step has played. */
  readonly score: number | null;
}

const NO_SLOTS: ReadonlySet<SlotId> = new Set();

export function useReveal(onDone: (next: RunState) => void) {
  const [running, setRunning] = useState<Running | null>(null);
  const [countTotal, setCountTotal] = useState<number | null>(null);
  // The latest callback, so a new function from the parent does not restart the beat timer.
  const done = useRef(onDone);
  done.current = onDone;

  /** Starts the reveal for `next`, which is `current` after Play chain. Call it from the tap. */
  function start(current: RunState, next: RunState) {
    unlockAudio();
    const played = next.table!.lastPlay!;
    const cleared = next.phase === 'cleared' || next.phase === 'won';
    const coins = cleared && next.lastPayout ? next.lastPayout.powerOfTen : 0;
    setCountTotal(null);
    setRunning({
      next,
      links: played.links,
      result: played.result,
      beats: revealBeats(played.result, coins),
      index: 0,
      startTotal: current.table!.total,
      endTotal: next.table!.total,
      startMoney: current.money,
    });
  }

  // Enter each beat: play its sound, then move on after its duration. The end commits the new state.
  useEffect(() => {
    if (running === null) return;
    const beat = running.beats[running.index];
    if (beat === undefined) {
      setRunning(null);
      done.current(running.next);
      return;
    }
    if (beat.note !== null) playSwitchNote(beat.note);
    if (beat.step?.kind === 'ring') playRingChord();
    if (beat.coin !== null) playCoin();
    const timer = window.setTimeout(
      () => setRunning((current) => (current === null ? null : { ...current, index: current.index + 1 })),
      beat.duration,
    );
    return () => window.clearTimeout(timer);
    // `running` changes only when the beat index moves on.
  }, [running]);

  // Count the table total up during the count beat.
  const countBeat = running?.beats[running.index]?.stage === 'count' ? running.beats[running.index] : null;
  useEffect(() => {
    if (running === null || countBeat === null) return;
    const { startTotal, endTotal } = running;
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / countBeat.duration);
      const eased = 1 - (1 - t) ** 3;
      setCountTotal(Math.round(startTotal + (endTotal - startTotal) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, countBeat]);

  const view = useMemo<RevealView | null>(() => {
    if (running === null) return null;
    const beat = running.beats[running.index] ?? null;
    const seen = running.beats.slice(0, running.index + 1);
    const steps = seen.flatMap((b) => (b.step === null ? [] : [b.step]));
    const last = steps[steps.length - 1];
    const cardIndexes = steps.filter((step) => step.kind === 'card').map((step) => step.index ?? -1);
    const stage = beat?.stage ?? 'coins';
    const total =
      stage === 'count' ? (countTotal ?? running.startTotal) : stage === 'coins' ? running.endTotal : running.startTotal;
    const coinsPlayed = beat?.coin === null || beat === null ? 0 : beat.coin + 1;
    return {
      beat,
      beatIndex: running.index,
      links: running.links,
      result: running.result,
      value: last?.value ?? CONFIG.chain.startValue,
      mult: last?.mult ?? CONFIG.chain.startMult,
      scoredUpTo: cardIndexes.length === 0 ? -1 : Math.max(...cardIndexes),
      ringed: steps.some((step) => step.kind === 'ring'),
      lit: beat?.step?.slot ? new Set([beat.step.slot]) : NO_SLOTS,
      total,
      money: running.startMoney + steps.reduce((sum, step) => sum + step.money, 0) + coinsPlayed,
      score: stage === 'steps' ? null : running.result.score,
    };
  }, [running, countTotal]);

  return { revealing: running !== null, start, view };
}
