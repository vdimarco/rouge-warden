// First Breath: a track of timed targets and its judge (design.md 5.2, 16.2, 16.3). A stage builds one track per
// group of targets and feeds it each step's intents (stage seconds). Tap and press targets read `presses`; release
// targets read `releases`. Each press or release judges at most one target: the open one nearest its time. In time
// and Close close the target; Off is reported (for its faint dotted ring) and leaves the target open; a press farther
// out is free and reports nothing. A target is missed once the step's end passes t + close + GRACE_S. Pure.
//
// Contract choices (16.2 left these open):
// - The track is { targets (sorted copies), assist, wins (the windows per target), results } where results[i] is
//   null while target i is open, else { grade, errMs, rawMs }. A miss reports errMs and rawMs as null.
// - Inside one feed, events are judged in time order, and a target whose miss time is before an event's time is
//   missed first, so a late event never earns an Off on a target that has already passed.
// - A target with `free: true` (after a resume, 5.2) is judged as usual but left out of accuracy() and streak().
//   freeUntil(track, until) makes every open target before `until` free; a stage calls it from its resume(state).
//   counted(track, group) lists the targets that count; when all of a group are free they all count again.
// - createTrack(targets, { assist, lag }): lag (s, 0 to 0.15) is the input's lag, max(0, offsetMs / 1000) from
//   lagOf(); it pushes every miss back by that much, because a press made on time reaches the page that late.
//   relag(state, lag) sets it again on every track of a stage state (at Resume, after Settings).
// - accuracy() divides by every counted target in the group, judged or not (5.2: Σ credit / the number of targets),
//   and gives 0 for a group with none.
// - feed() never throws on odd input: intents that are null, or whose presses or releases are not arrays, judge
//   nothing (misses still fall due by tEnd).
// - Extra exports: SPACING_MIN_S, PREVIEW_MIN_S, previewS(beatS) and check(targets), for stages and their tests.
import { windows, grade, GRACE_S, CREDIT } from "../judge.js";

export const SPACING_MIN_S = 0.5;
export const PREVIEW_MIN_S = 1.2;

// How long before its time a target must be in view: max(2 beats of its heart, 1.2 s).
export function previewS(beatS) {
  return Number.isFinite(beatS) ? Math.max(2 * beatS, PREVIEW_MIN_S) : PREVIEW_MIN_S;
}

const KINDS = new Set(["tap", "press", "release"]);

// Problems with a target list, as plain lines (an empty list means it is fine): every target has an id, a time,
// a kind and its P (≥ 0.5 s), the list is sorted, and no two targets are closer than 0.5 s.
export function check(targets) {
  const bad = [];
  const list = targets || [];
  const ids = new Set();
  list.forEach((x, i) => {
    const name = `target ${x && x.id !== undefined ? x.id : i}`;
    if (!x || typeof x !== "object") { bad.push(`${name} is not an object`); return; }
    if (x.id === undefined || x.id === null) bad.push(`${name} has no id`);
    else if (ids.has(x.id)) bad.push(`${name} repeats an id`);
    ids.add(x.id);
    if (!Number.isFinite(x.t)) bad.push(`${name} has no time`);
    if (!KINDS.has(x.kind)) bad.push(`${name} has kind ${x.kind}`);
    if (!Number.isFinite(x.P)) bad.push(`${name} has no P`);
    else if (x.P < SPACING_MIN_S - 1e-9) bad.push(`${name} has P ${x.P} under 0.5 s`);
    if (i > 0 && list[i - 1] && Number.isFinite(x.t) && Number.isFinite(list[i - 1].t)) {
      const gap = x.t - list[i - 1].t;
      if (gap < 0) bad.push(`${name} comes before the target ahead of it`);
      else if (gap < SPACING_MIN_S - 1e-9) bad.push(`${name} is ${gap.toFixed(3)} s after the one before`);
    }
  });
  return bad;
}

// The input's lag (s): with a positive timing offset a press reaches the page offsetMs after its corrected time, so
// the judge waits that much longer before a target is missed (5.2). Never negative, never past the offset's range.
export const LAG_MAX_S = 0.15;
export const lagOf = (offsetMs) => (Number.isFinite(offsetMs) ? Math.max(0, Math.min(LAG_MAX_S, offsetMs / 1000)) : 0);
const lagS = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(LAG_MAX_S, v)) : 0);

export function createTrack(targets, { assist = false, lag = 0 } = {}) {
  const list = (targets || []).filter((x) => x && Number.isFinite(x.t)).map((x) => ({ ...x })).sort((a, b) => a.t - b.t);
  return {
    targets: list,
    assist: !!assist,
    lag: lagS(lag),
    wins: list.map((x) => windows(x.P, assist)),
    results: list.map(() => null),
  };
}

// A new timing offset (set in Settings while paused) takes effect at Resume: the stage state's lag and the lag of
// every track it holds (its fields and their fields: st.track, st.rel, st.open.track, st.seal.track) change to it.
const isTrack = (v) => !!v && Array.isArray(v.targets) && Array.isArray(v.wins) && Array.isArray(v.results);
export function relag(st, lag) {
  if (!st || typeof st !== "object") return 0;
  const l = lagS(lag);
  let n = 0;
  const visit = (v) => { if (isTrack(v)) { v.lag = l; n++; } };
  for (const v of Object.values(st)) {
    visit(v);
    if (v && typeof v === "object" && !Array.isArray(v) && !isTrack(v)) for (const w of Object.values(v)) visit(w);
  }
  if ("lag" in st) st.lag = l;
  return n;
}

// The time a target is missed: t + close + 50 ms grace + the input's lag.
const deadline = (track, i) => track.targets[i].t + track.wins[i].close + GRACE_S + (track.lag || 0);
export const missAt = (track, x) => {
  const i = track.targets.indexOf(x);
  return i < 0 ? NaN : deadline(track, i);
};

// Fair resume (5.2): every target still open whose time is before `until` (resume + 1.2 s) is made free, so it is
// left out of accuracy() and streak() whatever the player does. → the number made free.
export const RESUME_FREE_S = 1.2;
export function freeUntil(track, until) {
  let n = 0;
  if (!track || !Array.isArray(track.targets) || !Number.isFinite(until)) return 0;
  track.targets.forEach((x, i) => {
    if (track.results[i] === null && x.t < until && !x.free) { x.free = true; n++; }
  });
  return n;
}
const reads = (kind, input) => (input === "release" ? kind === "release" : kind === "tap" || kind === "press");

// Judge one step: → [{ target, grade, errMs, rawMs }] in time order.
export function feed(track, intents, tEnd) {
  const out = [];
  const n = track.targets.length;
  const missBefore = (t) => {
    for (let i = 0; i < n; i++) {
      if (track.results[i] === null && deadline(track, i) < t) {
        track.results[i] = { grade: "miss", errMs: null, rawMs: null };
        out.push({ target: track.targets[i], grade: "miss", errMs: null, rawMs: null });
      }
    }
  };
  const evs = [];
  const list = (k) => (intents && Array.isArray(intents[k]) ? intents[k] : []);   // a missing or odd list reads as none
  for (const p of list("presses")) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, input: "press" });
  for (const p of list("releases")) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, input: "release" });
  evs.sort((a, b) => a.t - b.t);
  for (const ev of evs) {
    missBefore(ev.t);
    let best = -1, bestErr = Infinity, bestGrade = null;
    for (let i = 0; i < n; i++) {
      if (track.results[i] !== null) continue;
      const x = track.targets[i];
      if (!reads(x.kind, ev.input)) continue;
      const err = ev.t - x.t;
      const g = grade(err, x.P, track.assist);
      if (g !== null && Math.abs(err) < Math.abs(bestErr)) { best = i; bestErr = err; bestGrade = g; }
    }
    if (best < 0) continue;                                   // a free press: nothing happens
    const x = track.targets[best];
    const r = { grade: bestGrade, errMs: bestErr * 1000, rawMs: (ev.raw - x.t) * 1000 };
    if (bestGrade !== "off") track.results[best] = r;          // Off changes nothing; the target stays open
    out.push({ target: x, ...r });
  }
  if (Number.isFinite(tEnd)) {
    for (let i = 0; i < n; i++) {
      if (track.results[i] === null && tEnd > deadline(track, i)) {
        track.results[i] = { grade: "miss", errMs: null, rawMs: null };
        out.push({ target: track.targets[i], grade: "miss", errMs: null, rawMs: null });
      }
    }
  }
  return out;
}

// Open targets from now until now + horizonS (a target stays listed until it is judged or missed).
export function upcoming(track, t, horizonS) {
  const out = [];
  for (let i = 0; i < track.targets.length; i++) {
    const x = track.targets[i];
    if (x.t > t + horizonS) break;
    if (track.results[i] === null && deadline(track, i) >= t) out.push(x);
  }
  return out;
}

// The indices of the targets that count (5.2): those of the group (a group id, a test (target, i) → boolean, or
// undefined for all), the free ones left out; when every one of them is free, they all count, so a stage paused
// before each of its targets scores as if it was never paused.
export function counted(track, group) {
  const all = [];
  if (!track || !Array.isArray(track.targets)) return all;
  track.targets.forEach((x, i) => {
    if (group === undefined || group === null || (typeof group === "function" ? group(x, i) : x.group === group)) all.push(i);
  });
  const kept = all.filter((i) => !track.targets[i].free);
  return kept.length ? kept : all;
}

// Σ credit / the number of targets (In time 1, Close 0.5, Off and miss 0).
export function accuracy(track, group) {
  const idx = counted(track, group);
  if (!idx.length) return 0;
  let sum = 0;
  for (const i of idx) { const r = track.results[i]; if (r) sum += CREDIT[r.grade] || 0; }
  return sum / idx.length;
}

// In-time streaks over the judged targets, in order: → { current, best }.
export function streak(track, group) {
  let current = 0, best = 0;
  for (const i of counted(track, group)) {
    const r = track.results[i];
    if (!r) continue;
    if (r.grade === "in") { current++; if (current > best) best = current; } else current = 0;
  }
  return { current, best };
}
