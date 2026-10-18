// First Breath: the two hearts' beat times (design.md 5.1, 16.2). A stage lays its beats once, in create(), from a
// list of segments; every time is in stage seconds. Her beats start at opts.motherPhase (the segment's `first`), so
// the beat never jumps at a stage start. Jitter is seeded beat to beat; tracks use 0. Pure.
//
// Contract choices (16.2 left these open):
// - A segment's bpm is a number, or [from, to] for a linear glide over the segment (labour's 76 → 92). With no bpm,
//   gaFrom/gaTo give your heart's rate from clock.bpmYou along the segment; with neither, her rate is 72.
// - Beats fall in [from, to). A segment with no `first` carries on with the beat the same heart's last segment
//   would have laid next (so the gap across the join is the old period), stepping on by its own period if that
//   beat falls before `from`; with no earlier segment it starts at `from`. Beats never fall before `from`.
// - bpm(heart, t) is the nominal rate (no jitter): the segment's at t, else the nearest segment's edge rate; NaN for
//   a heart with no segments. next(heart, t) is the first beat at or after t; past the last laid beat it goes on at
//   the last rate, so the run can keep her clock going. between(heart, t0, t1) lists laid beats in [t0, t1).
import { stream } from "./rng.js";
import { bpmYou } from "./clock.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MAX_BEATS = 20000;

// The nominal rate of one segment at time t.
function rateOf(s, t) {
  const p = s.to > s.from ? clamp((t - s.from) / (s.to - s.from), 0, 1) : 0;
  if (Array.isArray(s.bpm)) return s.bpm[0] + (s.bpm[1] - s.bpm[0]) * p;
  if (Number.isFinite(s.bpm)) return s.bpm;
  if (Number.isFinite(s.gaFrom)) {
    const g1 = Number.isFinite(s.gaTo) ? s.gaTo : s.gaFrom;
    return bpmYou(s.gaFrom + (g1 - s.gaFrom) * p);
  }
  return s.heart === "you" ? NaN : 72;
}

// First index whose time is ≥ t.
function lowerBound(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function makeBeats(seed, segments) {
  const segs = { mother: [], you: [] };
  for (const raw of segments || []) {
    if (!raw || !(raw.to > raw.from)) continue;
    const heart = raw.heart === "you" ? "you" : "mother";
    segs[heart].push({ ...raw, heart, jitter: clamp(Number(raw.jitter) || 0, 0, 0.03) });
  }
  const lay = (heart) => {
    const list = segs[heart].sort((a, b) => a.from - b.from);
    const r = stream(seed, "beat:" + heart);
    const out = [];
    let pending = NaN;                       // the beat the last segment would have laid next
    for (const s of list) {
      const per0 = 60 / rateOf(s, s.from);
      if (!(per0 > 0.05) || !Number.isFinite(per0)) continue;
      let b;
      if (Number.isFinite(s.first)) b = s.first;
      else if (Number.isFinite(pending)) b = pending;
      else b = s.from;
      while (b < s.from) b += per0;
      while (b < s.to && out.length < MAX_BEATS) {
        out.push(b);
        let per = 60 / rateOf(s, b);
        if (!(per > 0.05) || !Number.isFinite(per)) break;
        if (s.jitter > 0) per *= 1 + s.jitter * (2 * r() - 1);
        b += per;
      }
      pending = b;
    }
    return Float64Array.from(out);
  };
  const mother = lay("mother");
  const you = segs.you.length ? lay("you") : null;
  const arr = (heart) => (heart === "you" ? you : mother) || new Float64Array(0);
  const listOf = (heart) => (heart === "you" ? segs.you : segs.mother);

  // The nominal rate at t: inside a segment its own, else the edge of the nearest one before (or the first).
  function bpm(heart, t) {
    const list = listOf(heart);
    if (!list.length) return NaN;
    let last = null;
    for (const s of list) {
      if (t < s.from) return last ? rateOf(last, last.to) : rateOf(s, s.from);
      if (t < s.to) return rateOf(s, t);
      last = s;
    }
    return rateOf(last, last.to);
  }

  function next(heart, t) {
    const a = arr(heart);
    if (!a.length) return NaN;
    const i = lowerBound(a, t);
    if (i < a.length) return a[i];
    const last = a[a.length - 1], per = 60 / bpm(heart, last);
    if (!(per > 0) || !Number.isFinite(per)) return NaN;
    return last + Math.max(1, Math.ceil((t - last) / per - 1e-9)) * per;
  }

  // 0 on a beat, rising to 1 just before the next one.
  function phase(heart, t) {
    const a = arr(heart);
    if (!a.length) return 0;
    const i = lowerBound(a, t);
    if (i < a.length && a[i] === t) return 0;
    if (i > 0 && i < a.length) return (t - a[i - 1]) / (a[i] - a[i - 1]);
    const ref = i === 0 ? a[0] : a[a.length - 1];
    const per = 60 / bpm(heart, ref);
    if (!(per > 0) || !Number.isFinite(per)) return 0;
    const x = (t - ref) / per;
    return ((x % 1) + 1) % 1;
  }

  function between(heart, t0, t1) {
    const a = arr(heart);
    const out = [];
    for (let i = lowerBound(a, t0); i < a.length && a[i] < t1; i++) out.push(a[i]);
    return out;
  }

  return { mother, you, bpm, phase, next, between };
}
