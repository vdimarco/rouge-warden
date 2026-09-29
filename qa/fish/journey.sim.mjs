// The trail of places, measured: node qa/fish/journey.sim.mjs
// For each place it casts into the water 12-45 m out (within 70° of straight ahead) and asks the real LakeSim what bites,
// at the hours of free fishing and at the hours of the derby. From that:
//   1. how many casts a novice and a good player need to land a fish of goalKg and open the next place (plan section 4)
//   2. where a derby total falls on the place's ranks: the good player's median between the rank 3 and rank 4
//      thresholds, the novice's median at rank 2 or above
//   3. goalKg sits between the p70 and the p97 of the place's catches (Gull Rock has no goal: bigKg is measured)
//   4. every legend ring is 50 m or less from the angler
// The players are two numbers, from the design: the share of the fish near the goal size that a player lands (good 0.85,
// novice 0.5), a little higher for small fish, a little lower for big ones. places.sim.mjs (WP2) measures the real landing
// rates with its bots; the targets there (skilled 85% or more, casual 50% or more) are where these two numbers come from.
// The goals and ranks are data in journey.js. If a target is missed, change the numbers there.
// Exit code 1 if a target is missed. N=casts per place and mode (default 12000).
import { LakeSim, rodTip } from "../../public/fish/js/fish.js";
import { fishingOf } from "../../public/fish/js/fishing.js";
import { PLACES } from "../../public/fish/js/places.js";
import * as LAKE from "../../public/fish/js/lake.js";
import { ORDER, JOURNEY } from "../../public/fish/js/journey.js";

const D2R = Math.PI / 180;
const N = +(process.env.N || 12000);
const q = (s, p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

// the hours a cast can fall in: free fishing runs from its start to the end of the day; a derby of 10 casts is about one
// hour of its clock (400 s per hour)
const hoursOf = (id, mode) => { const c = JOURNEY[id].clock; return mode === "derby" ? [c.derby, c.derby + 1] : [c.free, c.end]; };
// The chance that a player lands a fish of kg: `conv` for a fish near the goal size, more for a small one, less for a
// big one (the design's numbers). Good: 0.85, novice: 0.5.
const CONV = { good: 0.85, novice: 0.5 };
const lands = (who, kg) => Math.min(0.98, CONV[who] * (kg > 5 ? 0.85 : 1) + (who === "good" ? 0.1 : 0.2) * (kg < 1));

// A seeded random
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// N water casts: what bites (kg, 0 for nothing or junk)
function casts(id, mode, n, seed) {
  const P = PLACES[id], r = rng(seed), [h0, h1] = hoursOf(id, mode), out = [];
  LAKE.setPlace(P);
  for (let i = 0; out.length < n && i < n * 5; i++) {
    const d = 12 + r() * 33, a = (r() * 2 - 1) * 70 * D2R, x = Math.sin(a) * d, z = -Math.cos(a) * d;
    if (P.zone(x, z) === "land" || P.depth(x, z) < 0.6) continue;
    const hour = h0 + r() * (h1 - h0);
    const sim = new LakeSim({ place: P, lure: { x, z }, tip: rodTip(40, a / D2R, 0, P.stand.rod), lineOut: d, hour, rng: rng(seed * 7 + i), easy: true });
    const plan = sim.plan;
    out.push(plan && !plan.junk ? plan.kg : 0);
  }
  return out;
}
// how many casts until a player lands a fish of `goal` kg or more: median and p90 over many trials. A fish this heavy is
// a fish near the goal size: the plain CONV applies
function castsToOpen(free, goal, who, seed) {
  const r = rng(seed), counts = [];
  for (let t = 0; t < 3000; t++) {
    let c = 0;
    while (c < 400) { c++; const kg = free[(r() * free.length) | 0]; if (kg >= goal && r() < CONV[who]) break; }
    counts.push(c);
  }
  counts.sort((a, b) => a - b);
  return [q(counts, 0.5), q(counts, 0.9)];
}
// a derby total: 10 casts
function derbies(derby, who, seed) {
  const r = rng(seed), tot = [];
  for (let k = 0; k < 4000; k++) {
    let s = 0;
    for (let c = 0; c < 10; c++) { const kg = derby[(r() * derby.length) | 0]; if (kg && r() < lands(who, kg)) s += kg; }
    tot.push(s);
  }
  return tot.sort((a, b) => a - b);
}

console.log(`The trail, measured with the real bite code: ${N} water casts per place and mode\n`);
for (const [k, id] of ORDER.entries()) {
  const J = JOURNEY[id], F = fishingOf(id), P = PLACES[id];
  const free = casts(id, "free", N, 100 + k), derby = casts(id, "derby", N, 200 + k);
  const fish = derby.filter((x) => x > 0).sort((a, b) => a - b);
  console.log(`${J.name}: ${(100 * fish.length / derby.length).toFixed(0)}% of derby-hour casts bring a fish; the fish: median ${q(fish, 0.5)} kg, p70 ${q(fish, 0.7)}, p90 ${q(fish, 0.9)}, p97 ${q(fish, 0.97)}`);

  // 1. casts to open the next place
  if (J.goalKg != null) {
    const [gm, g9] = castsToOpen(free, J.goalKg, "good", 1), [nm, n9] = castsToOpen(free, J.goalKg, "novice", 2);
    console.log(`    goal ${J.goalKg} kg: casts to open, good ${gm} / ${g9}, novice ${nm} / ${n9} (median / p90)`);
    check(nm <= (id === "loon" ? 12 : 16), `${id}: a novice opens ${JOURNEY[ORDER[k + 1]].short} in ${id === "loon" ? 12 : 16} casts or fewer, median (${nm})`);
    check(n9 <= 50, `${id}: a novice's p90 is 50 casts or fewer (${n9})`);
  }

  // 2. the ranks
  const R = J.ranks, good = derbies(derby, "good", 3), novice = derbies(derby, "novice", 4);
  const gm = q(good, 0.5), nm = q(novice, 0.5);
  console.log(`    derby total (10 casts): good median ${gm.toFixed(1)} kg (p10 ${q(good, 0.1).toFixed(1)}, p90 ${q(good, 0.9).toFixed(1)}), novice median ${nm.toFixed(1)} kg; ranks at ${R.map((x) => x[0]).join(" / ")} kg`);
  check(gm >= R[3][0] && gm < R[4][0], `${id}: the good player's median derby (${gm.toFixed(1)} kg) is between ranks 3 and 4 (${R[3][1]} ${R[3][0]} kg, ${R[4][1]} ${R[4][0]} kg)`);
  check(nm >= R[2][0], `${id}: the novice's median derby (${nm.toFixed(1)} kg) is at rank 2 (${R[2][1]}, ${R[2][0]} kg) or above`);
  check(q(good, 0.9) >= R[4][0], `${id}: a good player's best derbies (p90 ${q(good, 0.9).toFixed(1)} kg) reach ${R[4][1]} (${R[4][0]} kg)`);

  // 3. the goal against the catches
  const goal = J.goalKg != null ? J.goalKg : J.bigKg, p70 = q(fish, 0.7), p97 = q(fish, 0.97);
  check(goal >= p70 && goal <= p97, `${id}: ${J.goalKg != null ? "goalKg" : "bigKg"} ${goal} kg is between the p70 (${p70}) and the p97 (${p97}) of the catches`);
  check(J.bigKg <= goal || J.goalKg == null, `${id}: bigKg (${J.bigKg}) is not above the goal`);

  // 4. the rings
  check(F.legend.ring[1] <= 50 && F.rings[1] <= 50, `${id}: the legend ring is ${F.legend.ring.join("-")} m out and the rings ${F.rings.join("-")} m (50 m or less)`);
  void P;
  console.log("");
}
console.log(fails.length ? `${fails.length} target(s) missed` : "All journey targets met");
process.exit(fails.length ? 1 : 0);
