// First Breath: the timing judge (design.md 5.2, 16.2). Every target carries its spacing P (floored at 0.5 s).
// In time is ±min(70 ms, 0.12 P), Close ±min(170 ms, 0.28 P), Off ±0.45 P; Assist widens In time and Close 1.6 times,
// with Close capped at 0.4 P. A press farther out than Off is free: it is no grade at all. Pure.
//
// Contract choices: a P that is not a finite number counts as the 0.5 s floor; Off is the same with Assist on (it
// stays wider than the capped Close); the window edges are inclusive, with 1e-9 s of slack for float error.

export const WIN = { inMs: 70, closeMs: 170, inK: 0.12, closeK: 0.28, offK: 0.45, assist: 1.6, closeCapK: 0.4, minP: 0.5 };
export const GRACE_S = 0.05;
export const CREDIT = { in: 1, close: 0.5, off: 0, miss: 0 };

const EPS = 1e-9;

// → { in, close, off } in seconds, for a target spaced P seconds from the one before.
export function windows(P, assist) {
  const p = Number.isFinite(P) ? Math.max(WIN.minP, P) : WIN.minP;
  let inS = Math.min(WIN.inMs / 1000, WIN.inK * p);
  let close = Math.min(WIN.closeMs / 1000, WIN.closeK * p);
  if (assist) {
    inS *= WIN.assist;
    close = Math.min(close * WIN.assist, WIN.closeCapK * p);
  }
  return { in: inS, close, off: WIN.offK * p };
}

// → "in" | "close" | "off" | null (a free press, too far from the target to mean anything).
export function grade(errS, P, assist) {
  if (!Number.isFinite(errS)) return null;
  const w = windows(P, assist), e = Math.abs(errS);
  if (e <= w.in + EPS) return "in";
  if (e <= w.close + EPS) return "close";
  if (e <= w.off + EPS) return "off";
  return null;
}

// The Tap test's offset: the median of a list of errors (non-numbers are skipped; an empty list gives 0).
export function median(list) {
  const xs = (list || []).filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
