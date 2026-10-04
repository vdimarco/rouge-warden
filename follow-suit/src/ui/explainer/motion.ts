// The motion of the explainer. Each scene is a pure function of its time, so pause, back and next only change a clock.

import { CONFIG } from '../../config';

export type Ease = (progress: number) => number;

export const linear: Ease = (p) => p;
export const easeInOut: Ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOut: Ease = (p) => 1 - (1 - p) ** 3;

/** A place on the stage grid (100 wide, 90 high), a turn in degrees, a size and an opacity. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rot: number;
  readonly scale: number;
  readonly opacity: number;
}

/** A pose at a time. A missing value repeats the key before it. The ease shapes the way from the key before. */
export interface Key extends Partial<Pose> {
  readonly at: number;
  readonly ease?: Ease;
}

type FullKey = Pose & { readonly at: number; readonly ease: Ease };

const START: Pose = { x: 50, y: 45, rot: 0, scale: 1, opacity: 1 };

function fill(keys: readonly Key[]): FullKey[] {
  const full: FullKey[] = [];
  let last: Pose = START;
  for (const key of keys) {
    const next: FullKey = {
      at: key.at,
      x: key.x ?? last.x,
      y: key.y ?? last.y,
      rot: key.rot ?? last.rot,
      scale: key.scale ?? last.scale,
      opacity: key.opacity ?? last.opacity,
      ease: key.ease ?? easeInOut,
    };
    full.push(next);
    last = next;
  }
  return full;
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const moves = (a: Pose, b: Pose) => a.x !== b.x || a.y !== b.y || a.rot !== b.rot || a.scale !== b.scale;
const only = ({ x, y, rot, scale, opacity }: Pose): Pose => ({ x, y, rot, scale, opacity });

/**
 * The pose at time t. With reduced motion a move does not travel: the card is at its new place as soon as the move
 * starts and fades in there. Fades without a move stay as they are.
 */
export function pose(keys: readonly Key[], t: number, reduced = false): Pose {
  const full = fill(keys);
  if (full.length === 0) return START;
  if (t <= full[0].at) return only(full[0]);
  for (let i = 1; i < full.length; i += 1) {
    const a = full[i - 1];
    const b = full[i];
    if (t >= b.at) continue;
    const p = b.ease((t - a.at) / (b.at - a.at));
    const opacity = lerp(a.opacity, b.opacity, p);
    if (reduced && moves(a, b)) {
      const fade = Math.min(1, (t - a.at) / Math.min(CONFIG.explainer.fadeMs, b.at - a.at));
      return { ...only(b), opacity: opacity * fade };
    }
    return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), rot: lerp(a.rot, b.rot, p), scale: lerp(a.scale, b.scale, p), opacity };
  }
  return only(full[full.length - 1]);
}

/** 0 before the start, 1 after the end, and the eased way between. */
export function progress(t: number, start: number, end: number, ease: Ease = easeInOut): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return ease((t - start) / (end - start));
}

/** The scene and the time in it. The scene after the last one is the end card, where the time stops. */
export interface ClockState {
  readonly scene: number;
  readonly t: number;
}

/** Moves the clock on by one frame. A late frame moves it by the limit only. */
export function tick(state: ClockState, dt: number, lengths: readonly number[]): ClockState {
  const length = lengths[state.scene];
  if (length === undefined) return state;
  const t = state.t + Math.min(dt, CONFIG.explainer.maxFrameMs);
  return t < length ? { scene: state.scene, t } : { scene: state.scene + 1, t: 0 };
}
