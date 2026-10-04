import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config';
import { linear, pose, tick, type Key } from './motion';

const MOVE: Key[] = [
  { at: 0, x: 10, y: 20 },
  { at: 1_000, x: 10, y: 20 },
  { at: 2_000, x: 90, y: 60, ease: linear },
];

describe('pose', () => {
  it('holds the first key before it and the last key after it', () => {
    expect(pose(MOVE, -50)).toMatchObject({ x: 10, y: 20, rot: 0, scale: 1, opacity: 1 });
    expect(pose(MOVE, 5_000)).toMatchObject({ x: 90, y: 60 });
  });

  it('moves between keys with their ease', () => {
    expect(pose(MOVE, 1_500)).toMatchObject({ x: 50, y: 40 });
    expect(pose(MOVE, 1_250).x).toBeCloseTo(30);
  });

  it('fills a key from the key before it', () => {
    const keys: Key[] = [
      { at: 0, x: 0, y: 0, scale: 2, opacity: 0.5 },
      { at: 100, x: 10 },
    ];
    expect(pose(keys, 100)).toMatchObject({ x: 10, y: 0, scale: 2, opacity: 0.5 });
  });

  it('with reduced motion jumps to the next place and fades in there, so the card never travels', () => {
    const fade = CONFIG.explainer.fadeMs;
    expect(pose(MOVE, 999, true)).toMatchObject({ x: 10, y: 20, opacity: 1 });
    const start = pose(MOVE, 1_000, true);
    expect(start).toMatchObject({ x: 90, y: 60 });
    expect(start.opacity).toBeCloseTo(0);
    expect(pose(MOVE, 1_000 + fade / 2, true).opacity).toBeCloseTo(0.5);
    expect(pose(MOVE, 1_500, true)).toMatchObject({ x: 90, y: 60, opacity: 1 });
    for (let t = 0; t <= 2_200; t += 50) expect([10, 90]).toContain(pose(MOVE, t, true).x);
  });

  it('with reduced motion still fades a card that does not move', () => {
    const keys: Key[] = [
      { at: 0, x: 50, y: 50, opacity: 0 },
      { at: 400, x: 50, y: 50, opacity: 1, ease: linear },
    ];
    expect(pose(keys, 200, true).opacity).toBeCloseTo(0.5);
  });
});

describe('tick', () => {
  const lengths = [1_000, 2_000];

  it('moves the time on within a scene', () => {
    expect(tick({ scene: 0, t: 100 }, 50, lengths)).toEqual({ scene: 0, t: 150 });
  });

  it('starts the next scene at the end of a scene, and stops on the end card', () => {
    expect(tick({ scene: 0, t: 990 }, 20, lengths)).toEqual({ scene: 1, t: 0 });
    expect(tick({ scene: 1, t: 1_999 }, 5, lengths)).toEqual({ scene: 2, t: 0 });
    expect(tick({ scene: 2, t: 0 }, 500, lengths)).toEqual({ scene: 2, t: 0 });
  });

  it('moves a late frame by no more than the limit', () => {
    expect(tick({ scene: 0, t: 0 }, 5_000, lengths)).toEqual({ scene: 0, t: CONFIG.explainer.maxFrameMs });
  });
});
