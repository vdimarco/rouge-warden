// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginTable, newRun, runAddCard, runPlay, sortCards, type RunState } from '../engine';
import { cards } from '../engine/test-helpers';
import * as audio from './audio';
import { revealBeats, revealLength } from './reveal';
import { useReveal } from './useReveal';

vi.mock('./audio', () => ({
  unlockAudio: vi.fn(),
  playSwitchNote: vi.fn(),
  playRingChord: vi.fn(),
  playCoin: vi.fn(),
}));

/** A run at a table with a known hand and target. */
function atTable(hand: string, target: number): RunState {
  const run = beginTable(newRun('HOOK01'));
  return {
    ...run,
    table: { ...run.table!, hand: sortCards(cards(hand)), drawPile: cards('2S 3S 4S 5S 6S 7S'), target },
  };
}

function play(run: RunState, codes: string): RunState {
  let state = run;
  for (const code of codes.split(' ')) {
    const rank = { J: 11, Q: 12, K: 13, A: 14 }[code.slice(0, -1)] ?? Number(code.slice(0, -1));
    const card = state.table!.hand.find((c) => c.rank === rank && c.suit === code.slice(-1))!;
    state = runAddCard(state, card.id);
  }
  return runPlay(state);
}

/** Moves fake time on in small steps, so each beat can schedule the next one. */
async function runFor(ms: number, each?: () => void) {
  for (let t = 0; t < ms; t += 20) {
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    each?.();
  }
}

const RING_HAND = '7S KS KH 4H 4C 7C 2D 3D';
const RING_CHAIN = '7S KS KH 4H 4C 7C';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the score reveal', () => {
  it('plays a note for each switch from the root up, then the ring chord, then commits the new run', async () => {
    const current = atTable(RING_HAND, 100_000);
    const next = play(current, RING_CHAIN);
    const onDone = vi.fn();
    const { result } = renderHook(() => useReveal(onDone));

    act(() => result.current.start(current, next));
    expect(result.current.revealing).toBe(true);
    expect(audio.unlockAudio).toHaveBeenCalledTimes(1);

    const length = revealLength(revealBeats(next.table!.lastPlay!.result, 0));
    await runFor(length / 2);
    expect(onDone).not.toHaveBeenCalled();

    await runFor(length);
    expect(vi.mocked(audio.playSwitchNote).mock.calls).toEqual([[0], [1]]);
    expect(audio.playRingChord).toHaveBeenCalledTimes(1);
    expect(audio.playCoin).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(next);
    expect(result.current.revealing).toBe(false);
  });

  it('shows the running Value and Mult, then the chain score, and counts the total up', async () => {
    const current = atTable(RING_HAND, 100_000);
    const next = play(current, RING_CHAIN);
    const { result } = renderHook(() => useReveal(() => {}));
    act(() => result.current.start(current, next));

    const mults = new Set<number>();
    const totals = new Set<number>();
    const scores = new Set<number | null>();
    await runFor(6_000, () => {
      const view = result.current.view;
      if (view === null) return;
      mults.add(view.mult);
      totals.add(view.total);
      scores.add(view.score);
    });

    expect([...mults]).toEqual([1, 2, 3, 6]);
    expect(scores.has(252)).toBe(true);
    expect(totals.has(0)).toBe(true);
    expect(totals.has(252)).toBe(true);
    expect([...totals].some((total) => total > 0 && total < 252)).toBe(true);
  });

  it('plays one coin for each power-of-ten dollar when the table clears', async () => {
    // 252 against a target of 1 beats it by 2 powers of ten.
    const current = atTable(RING_HAND, 1);
    const next = play(current, RING_CHAIN);
    expect(next.phase).toBe('cleared');
    expect(next.lastPayout!.powerOfTen).toBe(2);

    const onDone = vi.fn();
    const { result } = renderHook(() => useReveal(onDone));
    act(() => result.current.start(current, next));
    await runFor(8_000);

    expect(audio.playCoin).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith(next);
  });
});
