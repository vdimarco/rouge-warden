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
// - accuracy() divides by every counted target in the group, judged or not (5.2: Σ credit / the number of targets),
//   and gives 0 for a group with none.
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

export function createTrack(targets, { assist = false } = {}) {
  const list = (targets || []).filter((x) => x && Number.isFinite(x.t)).map((x) => ({ ...x })).sort((a, b) => a.t - b.t);
  return {
    targets: list,
    assist: !!assist,
    wins: list.map((x) => windows(x.P, assist)),
    results: list.map(() => null),
  };
}

const deadline = (track, i) => track.targets[i].t + track.wins[i].close + GRACE_S;
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
  for (const p of (intents && intents.presses) || []) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, input: "press" });
  for (const p of (intents && intents.releases) || []) if (p && Number.isFinite(p.t)) evs.push({ t: p.t, raw: Number.isFinite(p.raw) ? p.raw : p.t, input: "release" });
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

const counted = (track, group) => track.targets
  .map((x, i) => i)
  .filter((i) => !track.targets[i].free && (group === undefined || track.targets[i].group === group));

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
