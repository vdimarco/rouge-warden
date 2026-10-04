// The trail of places, measured: node qa/fish/journey.sim.mjs
// For each place it casts into the water 12-45 m out (within 70° of straight ahead) and asks the real LakeSim what bites,
// at the hours of free fishing and at the hours of the derby. From that:
//   1. how many casts a novice and a good player need to land a fish of goalKg and open the next place (plan section 4)
//   2. where a derby total falls on the place's ranks: the good player's median between the rank 3 and rank 4
//      thresholds, the novice's median at rank 2 or above
//   3. goalKg sits between the p70 and the p97 of the place's catches (Gull Rock has no goal: bigKg is measured)
//   4. every legend ring is 50 m or less from the angler
//   5. a beginner who casts short (8 to 25 m) at Loon Lake, with the help for short casters (goals.js ASSIST: after 20
//      casts in the water, a ring close in carries a big fish until one is landed), opens Stump Bay in 25 casts or fewer
//      (median), and 9 in 10 in 70 or fewer
//   6. the weight boost of three sweet casts (opts.boost 0.4) gives bigger fish, and a big ring is a sure bite of its fish
//   7. a beginner can do each goal of the day (goals.js DAILY) in about 10 minutes: 20 casts or fewer, median
// The players are two numbers, from the design: the share of the fish near the goal size that a player lands (good 0.85,
// novice 0.5), a little higher for small fish, a little lower for big ones. places.sim.mjs (WP2) measures the real landing
// rates with its bots; the targets there (skilled 85% or more, casual 50% or more) are where these two numbers come from.
// The goals and ranks are data in journey.js. If a target is missed, change the numbers there.
// Exit code 1 if a target is missed. N=casts per place and mode (default 12000).
import { LakeSim, Rises, rodTip } from "../../public/fish/js/fish.js";
import { fishingOf } from "../../public/fish/js/fishing.js";
import { PLACES } from "../../public/fish/js/places.js";
import * as LAKE from "../../public/fish/js/lake.js";
import { ORDER, JOURNEY } from "../../public/fish/js/journey.js";
import { ASSIST, STREAK, DAILY, assistFish, dailyText } from "../../public/fish/js/goals.js";
import { byId } from "../../public/fish/js/species.js";

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
// N water casts: what bites (kg, 0 for nothing or junk). o: the cast distances (d0 to d1 m), more LakeSim options (opts),
// a ring of rising fish at the lure (ring: its fields), and full: give the plans ({ id, kg }, null for nothing or junk)
function casts(id, mode, n, seed, o = {}) {
  const P = PLACES[id], r = rng(seed), [h0, h1] = hoursOf(id, mode), out = [], d0 = o.d0 ?? 12, d1 = o.d1 ?? 45;
  LAKE.setPlace(P);
  for (let i = 0; out.length < n && i < n * 5; i++) {
    const d = d0 + r() * (d1 - d0), a = (r() * 2 - 1) * 70 * D2R, x = Math.sin(a) * d, z = -Math.cos(a) * d;
    if (P.zone(x, z) === "land" || P.depth(x, z) < 0.6) continue;
    const hour = h0 + r() * (h1 - h0);
    const ring = o.ring ? { x, z, gold: false, ...o.ring } : null;
    const sim = new LakeSim({ place: P, lure: { x, z }, tip: rodTip(40, a / D2R, 0, P.stand.rod), lineOut: d, hour, ring, rng: rng(seed * 7 + i), easy: true, ...o.opts });
    const plan = sim.plan;
    out.push(o.full ? (plan && !plan.junk ? { id: plan.id, kg: plan.kg } : null) : plan && !plan.junk ? plan.kg : 0);
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

// 5. A beginner who casts short: 8 to 25 m at Loon Lake, in free fishing. Without help, a goal fish is rare that close in.
// The help (main.js ringNews, fish.js choose): after ASSIST.casts casts in the water, the next ring that rises within
// ASSIST.reach m while the player is casting carries a big fish, and stays up at least ASSIST.ttl s. One big ring at a
// time; the help goes on until a big ring's fish is landed. Modeled in time, with the real rings of the place (Rises):
// a cast takes 3 to 6 s to aim and throw (the rings that rise then count), and 6 to 12 s to reel in, or 15 to 40 s with a
// fish on. Told of a big ring, the player aims every cast at it until it is gone, and lands in it (within 5 m) on half
// of the tries; a cast that misses is an ordinary cast. A fish hooked from the ring takes the ring with it (rises.take)
{
  const goal = JOURNEY.loon.goalKg, HIT = 0.5;
  const short = casts("loon", "free", N, 300, { d0: 8, d1: 25 });
  const ring = casts("loon", "free", 4000, 301, { d0: 8, d1: ASSIST.reach, ring: { species: assistFish("loon"), big: true }, opts: { boost: ASSIST.boost } });
  const share = (a) => a.filter((k) => k >= goal).length / a.length;
  const open = (help, seed) => {
    const r = rng(seed), counts = [], told = [];
    for (let t = 0; t < 2000; t++) {
      const rises = new Rises(rng(seed * 31 + t), PLACES.loon);
      let hour = JOURNEY.loon.clock.free, c = 0, dry = 0, done = false, said = 0;
      // s seconds go by; while casting, a ring rising within reach turns big when the help is due
      const pass = (s, casting) => {
        for (let k = 0; k < s; k += 0.25) {
          hour = Math.min(JOURNEY.loon.clock.end - 0.01, hour + 0.25 / 75);
          for (const e of rises.step(0.25, hour)) {
            if (!casting || !help || e.gold || dry < ASSIST.casts || Math.hypot(e.x, e.z) > ASSIST.reach || rises.list.some((g) => g.big)) continue;
            const g = rises.near(e.x, e.z);
            if (g && !g.gold) { g.big = true; g.ttl = Math.max(g.ttl, ASSIST.ttl); said++; }
          }
        }
      };
      while (c < 400 && !done) {
        const big = rises.list.find((g) => g.big);
        pass(3 + r() * 3, true);
        c++; dry++;
        const hit = big && rises.list.includes(big) && r() < HIT;
        if (hit) rises.take(big);
        const kg = (hit ? ring : short)[(r() * (hit ? ring : short).length) | 0], landed = kg > 0 && r() < lands("novice", kg);
        done = landed && kg >= goal;
        if (hit && landed) dry = 0;
        pass(kg > 0 ? 15 + r() * 25 : 6 + r() * 6, false);
      }
      counts.push(c); told.push(said);
    }
    counts.sort((a, b) => a - b); told.sort((a, b) => a - b);
    return [q(counts, 0.5), q(counts, 0.9), q(told, 0.9)];
  };
  const [m0, p0] = open(false, 5), [m1, p1, t1] = open(true, 5);
  console.log(`A beginner who casts 8-25 m at Loon Lake: ${(100 * share(short)).toFixed(1)}% of casts bring a ${goal}+ kg fish; a big ring (${assistFish("loon")}, boost ${ASSIST.boost}): ${(100 * share(ring)).toFixed(0)}%`);
  console.log(`    casts to open Stump Bay: ${m0} / ${p0} with no help, ${m1} / ${p1} with the help (median / p90); 9 in 10 hear of a big ring ${t1} times or fewer`);
  check(share(ring) >= 0.85 && ring.every((k) => k > 0), `a big ring is a sure bite, and ${(100 * share(ring)).toFixed(0)}% of its fish are ${goal} kg or more (85% or more)`);
  check(m1 <= 25, `a short caster opens Stump Bay in 25 casts or fewer, median (${m1})`);
  check(p1 <= 70, `9 in 10 short casters open it in 70 casts or fewer (${p1})`);
}

// 6. Three sweet casts: the next cast in the water gets STREAK.boost. The same casts, with and without it
{
  console.log("");
  const by = (a, id) => a.filter((p) => p && p.id === id).map((p) => p.kg).sort((x, y) => x - y);
  for (const [id, sp] of [["loon", "smallmouth"], ["stumps", "catfish"], ["sea", "striper"]]) {
    const plain = casts(id, "free", 6000, 400, { full: true }), boosted = casts(id, "free", 6000, 400, { full: true, opts: { boost: STREAK.boost } });
    const a = by(plain, sp), b = by(boosted, sp), all0 = plain.filter(Boolean).map((p) => p.kg).sort((x, y) => x - y), all1 = boosted.filter(Boolean).map((p) => p.kg).sort((x, y) => x - y);
    console.log(`${JOURNEY[id].name}: ${byId(sp).name} median ${q(a, 0.5)} kg plain, ${q(b, 0.5)} kg after three sweet casts; every fish ${q(all0, 0.5)} -> ${q(all1, 0.5)} kg`);
    check(a.length > 100 && q(b, 0.5) > q(a, 0.5) && q(all1, 0.5) >= q(all0, 0.5) && b.length === a.length, `${id}: boost ${STREAK.boost} raises the median weight of ${byId(sp).name} (${q(a, 0.5)} -> ${q(b, 0.5)} kg), and the same fish bite`);
  }
}

// 7. The goals of the day: a beginner (casts 12 to 45 m, lands like the novice above) in free fishing at the place.
// A ring goal: the beginner aims at a ring on 1 cast in 4, and a ring cast is a near-sure bite (BITE.RING, 90%)
{
  console.log("");
  const pools = {}, r = rng(77);
  const bad = [];
  for (const g of DAILY) {
    const pool = (pools[g.at] ||= casts(g.at, "free", N, 500 + ORDER.indexOf(g.at), { full: true }));
    const counts = [];
    for (let t = 0; t < 2000; t++) {
      let c = 0, n = 0;
      while (c < 200 && n < g.n) {
        c++;
        if (g.kind === "ring") { if (r() < 0.25 && r() < 0.9 && r() < lands("novice", 1)) n++; continue; }
        const p = pool[(r() * pool.length) | 0];
        if (!p || !(r() < lands("novice", p.kg))) continue;
        if (g.kind === "count" || (g.kind === "fish" && p.id === g.id) || (g.kind === "kg" && p.kg >= g.kg)) n++;
      }
      counts.push(c);
    }
    counts.sort((a, b) => a - b);
    const m = q(counts, 0.5);
    console.log(`  ${dailyText(g).padEnd(52)} median ${m} casts, p90 ${q(counts, 0.9)}`);
    if (m > 20) bad.push(dailyText(g) + " (" + m + ")");
  }
  check(bad.length === 0, "a beginner does each goal of the day in 20 casts or fewer, about 10 minutes (median)" + (bad.length ? ": " + bad.join("; ") : ""));
}
console.log(fails.length ? `${fails.length} target(s) missed` : "All journey targets met");
process.exit(fails.length ? 1 : 0);
