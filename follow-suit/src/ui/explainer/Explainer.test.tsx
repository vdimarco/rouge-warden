// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../config';
import * as audio from '../audio';
import { Explainer } from './Explainer';
import { INTRO_SEEN_KEY } from './seen';
import { SCENES } from './story';

vi.mock('../audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../audio')>()),
  unlockAudio: vi.fn(),
  playSwitchNote: vi.fn(),
  playRingChord: vi.fn(),
}));
vi.mock('../useReducedMotion', () => ({ useReducedMotion: () => false }));

/** Moves fake time on in animation-frame steps. */
async function runFor(ms: number) {
  for (let t = 0; t < ms; t += 20) {
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
  }
}

const title = () => screen.getByTestId('ex-title').textContent;
const press = (key: string) => fireEvent.keyDown(window, { key });

function show(exit: 'play' | 'back' = 'play') {
  const onClose = vi.fn();
  const onPlay = vi.fn();
  render(<Explainer exit={exit} onClose={onClose} onPlay={onPlay} />);
  return { onClose, onPlay };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('the explainer', () => {
  it('plays its scenes in order by itself, then shows the end card and counts as seen', async () => {
    show();
    expect(title()).toBe(SCENES[0].title);
    await runFor(SCENES[0].ms + 40);
    expect(title()).toBe(SCENES[1].title);
    const rest = CONFIG.explainer.sceneMs.slice(1).reduce((sum, ms) => sum + ms, 0);
    await runFor(rest + 200);
    expect(title()).toBe('Ready to play?');
    expect(screen.getByTestId('ex-end')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Watch again' })).toBeTruthy();
    expect(window.localStorage.getItem(INTRO_SEEN_KEY)).toBe('1');
  });

  it('goes forward and back with the buttons and the arrow keys, and Escape closes it', async () => {
    const { onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(title()).toBe(SCENES[1].title);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(title()).toBe(SCENES[0].title);
    press('ArrowRight');
    press('ArrowRight');
    expect(title()).toBe(SCENES[2].title);
    press('ArrowLeft');
    expect(title()).toBe(SCENES[1].title);
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pauses while a finger holds the animation, and with Space', async () => {
    show();
    fireEvent.pointerDown(screen.getByTestId('ex-stage'));
    await runFor(SCENES[0].ms + 500);
    expect(title()).toBe(SCENES[0].title);
    expect(screen.getByText('Paused')).toBeTruthy();
    fireEvent.pointerUp(screen.getByTestId('ex-stage'));
    await runFor(SCENES[0].ms + 40);
    expect(title()).toBe(SCENES[1].title);

    press(' ');
    await runFor(SCENES[1].ms + 500);
    expect(title()).toBe(SCENES[1].title);
    press(' ');
    await runFor(SCENES[1].ms + 40);
    expect(title()).toBe(SCENES[2].title);
  });

  it('plays a note for each change of suit in the scoring scene, and the ring chord in the ring scene', async () => {
    show();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(title()).toBe('Value and Mult');
    await runFor(SCENES[3].ms - 100);
    expect(vi.mocked(audio.playSwitchNote).mock.calls).toEqual([[0], [1], [2]]);
    expect(screen.getByTestId('ex-value').textContent).toContain('45');
    expect(screen.getByTestId('ex-mult').textContent).toContain('4');
    await runFor(200 + SCENES[4].ms / 2);
    expect(title()).toBe('Close a ring');
    expect(audio.playRingChord).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ex-mult').textContent).toContain('8');
  });

  it('offers Play on the end card from the start screen, and Back to the game during a run', () => {
    const first = show('play');
    for (let i = 0; i < SCENES.length; i += 1) fireEvent.click(screen.getByRole('button', { name: /Next|Finish/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(first.onPlay).toHaveBeenCalledTimes(1);
    cleanup();

    const during = show('back');
    for (let i = 0; i < SCENES.length; i += 1) fireEvent.click(screen.getByRole('button', { name: /Next|Finish/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the game' }));
    expect(during.onClose).toHaveBeenCalledTimes(1);
    expect(during.onPlay).not.toHaveBeenCalled();
  });
});
