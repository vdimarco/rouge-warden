// Every sound comes from the Web Audio API. There are no audio files.

import { useSyncExternalStore } from 'react';
import { CONFIG } from '../config';
import { scaleStepHz } from './music';

const MUTED_KEY = 'follow-suit:muted';
const S = CONFIG.sound;

let context: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTED_KEY, value ? '1' : '0');
  } catch {
    // Private windows can block storage. The setting then lasts for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, isMuted);
}

/** Creates or wakes the audio context. Phones allow this only during a tap, so call it from one. */
export function unlockAudio(): void {
  if (muted) return;
  try {
    if (context === null) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context === undefined) return;
      context = new Context();
    }
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

function tone(hz: number, delayMs: number, lengthMs: number, type: OscillatorType, level: number): void {
  if (muted || context === null) return;
  const start = context.currentTime + delayMs / 1000;
  const end = start + lengthMs / 1000;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(S.volume * level, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.05);
}

/** The note for a switch. Step 0 is the root of the major scale. */
export function playSwitchNote(step: number): void {
  const hz = scaleStepHz(step);
  tone(hz, 0, S.noteMs, 'triangle', 1);
  tone(hz * 2, 0, S.noteMs * 0.6, 'sine', 0.2);
}

/** A soft rising chord when a ring closes. */
export function playRingChord(): void {
  S.ringChordSteps.forEach((step, i) => tone(scaleStepHz(step), i * S.ringNoteGapMs, S.noteMs * 1.6, 'sine', 0.75));
}

/** One coin: two short high blips. */
export function playCoin(): void {
  const [low, high] = S.coinHz;
  tone(low, 0, S.coinNoteMs, 'square', 0.3);
  tone(high, S.coinNoteMs, S.coinNoteMs * 1.6, 'square', 0.3);
}
