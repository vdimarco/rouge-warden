// First Breath: the one clock (design.md section 4 and 4.1). gaDay is days since the first day of the last period;
// fertilization is gaDay 14 and full term gaDay 280. This is the only place labels are made. Pure.
//
// Contract choices (16.2 left these open):
// - label() of a gaDay below 14 reads "Week N" even when fertilized is true (no negative days).
// - range() picks its form from gaFrom: before 14 or from 42 it reads in weeks, else in days after fertilization.
//   One week in the weeks form reads "Week N". A span never crosses 42 (facts.test checks it).
// - gaAt() of a moment with no positive lenS returns its `from` (those moments have from === to in 4.1).
// - mmPerShortAxis() clamps gaDay to meta.ga, so the scale holds still outside the stage's span.
// - bpmYou() holds 130 after gaDay 280.

export const DT = 1 / 60;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Completed weeks, as midwives and doctors count.
export function week(gaDay) {
  return Math.floor(gaDay / 7);
}

// "Week 2" before fertilization; "Day N after fertilization (week M)" after it while gaDay < 42; "Week N" from 42.
export function label(gaDay, { fertilized = true } = {}) {
  const d = Math.floor(gaDay);
  if (!fertilized || d < 14 || d >= 42) return "Week " + week(d);
  return "Day " + (d - 14) + " after fertilization (week " + week(d) + ")";
}

// A span: "Days 6 to 9 after fertilization (weeks 2 to 3)" for range(20, 23), "Weeks 31 to 34" for range(217, 238).
export function range(gaFrom, gaTo) {
  const a = Math.floor(Math.min(gaFrom, gaTo)), b = Math.floor(Math.max(gaFrom, gaTo));
  const wa = week(a), wb = week(b);
  if (a < 14 || a >= 42) return wa === wb ? "Week " + wa : "Weeks " + wa + " to " + wb;
  if (a === b) return label(a);
  const weeks = wa === wb ? "(week " + wa + ")" : "(weeks " + wa + " to " + wb + ")";
  return "Days " + (a - 14) + " to " + (b - 14) + " after fertilization " + weeks;
}

// gaDay while a moment runs: from + (to − from) × clamp(seconds / lenS, 0, 1) (4.1).
export function gaAt(moment, secondsInMoment) {
  const [from, to] = moment.ga;
  const len = moment.lenS;
  if (!(len > 0) || !Number.isFinite(len)) return from;
  return from + (to - from) * clamp(secondsInMoment / len, 0, 1);
}

// Real mm across the short screen axis: a log-lerp from meta.mm.start to meta.mm.end by gaDay across meta.ga.
export function mmPerShortAxis(meta, gaDay) {
  const { start: g0, end: g1 } = meta.ga;
  const { start: m0, end: m1 } = meta.mm;
  if (!(g1 > g0) || m0 === m1) return m0;
  const p = clamp((gaDay - g0) / (g1 - g0), 0, 1);
  return Math.exp(Math.log(m0) + (Math.log(m1) - Math.log(m0)) * p);
}

// Your heart (5.1): piecewise-linear in gaDay through these points; NaN before Day 22 after fertilization (gaDay 36).
const YOU = [[36, 110], [42, 110], [63, 170], [70, 170], [98, 150], [140, 140], [196, 140], [280, 130]];

export function bpmYou(gaDay) {
  if (!(gaDay >= YOU[0][0])) return NaN;
  for (let i = 1; i < YOU.length; i++) {
    const [g1, b1] = YOU[i];
    if (gaDay <= g1) {
      const [g0, b0] = YOU[i - 1];
      return b0 + (b1 - b0) * ((gaDay - g0) / (g1 - g0));
    }
  }
  return YOU[YOU.length - 1][1];
}
