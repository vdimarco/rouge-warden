// First Breath: sub-goals and small geometry for the stages (design.md 5.4, 16.2). Every sub-goal is shown, then
// confirmed when done by you ("done") or by itself ("auto"); none passes silently, so each change emits a subgoal
// event { id, text, state }. Angles are radians, counterclockwise from world +x. Pure.
//
// Contract choices: subgoal() does nothing to a sub-goal that is already shown or settled, and doneBy() nothing to
// one already settled (each returns true when it changed something); points are { x, y } or [x, y]; heldIntervals
// are [start, end] pairs or { t0, t1 }, with an end of null for a hold still down; turnToward() returns an unwrapped
// angle (it never jumps by 2π), so a stage can add up how far it turned. Extra export: wrapAngle(a) into (−π, π].
import { emit } from "../events.js";

const TAU = Math.PI * 2;

export function wrapAngle(a) {
  const w = a - TAU * Math.floor((a + Math.PI) / TAU);
  return w <= -Math.PI ? w + TAU : w;
}

export function subgoal(state, id, textId) {
  if (!state.subgoals) state.subgoals = {};
  if (state.subgoals[id]) return false;
  state.subgoals[id] = "shown";
  emit(state, "subgoal", { id, text: textId, state: "shown" });
  return true;
}

export function doneBy(state, id, how, textId) {
  if (!state.subgoals) state.subgoals = {};
  const now = state.subgoals[id];
  if (now === "done" || now === "auto") return false;
  const s = how === "you" ? "done" : "auto";
  state.subgoals[id] = s;
  emit(state, "subgoal", { id, text: textId, state: s });
  return true;
}

const px = (p) => (Array.isArray(p) ? p[0] : p.x);
const py = (p) => (Array.isArray(p) ? p[1] : p.y);

// Is point p within r of centre c?
export function reach(p, c, r) {
  const dx = px(p) - px(c), dy = py(p) - py(c);
  return dx * dx + dy * dy <= r * r;
}

// The share of [t0, t1] covered by the held intervals (overlaps count once): 0..1.
export function holdOverlap(heldIntervals, t0, t1) {
  if (!(t1 > t0)) return 0;
  const spans = [];
  for (const h of heldIntervals || []) {
    const a = Array.isArray(h) ? h[0] : h && h.t0;
    let b = Array.isArray(h) ? h[1] : h && h.t1;
    if (!Number.isFinite(a)) continue;
    if (b === null || b === undefined) b = t1;
    const lo = Math.max(a, t0), hi = Math.min(b, t1);
    if (hi > lo) spans.push([lo, hi]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  let covered = 0, end = t0;
  for (const [lo, hi] of spans) {
    const from = Math.max(lo, end);
    if (hi > from) { covered += hi - from; end = hi; }
  }
  return Math.min(1, covered / (t1 - t0));
}

// Turn `angle` toward `target` the short way, by at most rateRadS × dt.
export function turnToward(angle, target, rateRadS, dt) {
  const d = wrapAngle(target - angle);
  const max = Math.abs(rateRadS * dt);
  return angle + Math.max(-max, Math.min(max, d));
}
