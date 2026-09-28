// How big the fish are: node qa/fish/size.test.mjs
// 1. The weight mix at each place's derby hour (plan 3.5). Loon Lake runs the real bite code (LakeSim chooses the fish
//    and rolls its weight); the other places use the same steps on their own maps from places.js.
// 2. The rare tail: every species has 3-5% of its fish above its usual range at no boost.
// 3. sizeRank (the catch card's "Bigger than 9 in 10") matches the weights rollWeight really rolls.
// Exit code 1 if a target is missed.
import { LakeSim, BITE, rodTip, rollWeight, sizeRank, speciesWeights } from "../../public/fish/js/fish.js";
import { SPECIES } from "../../public/fish/js/species.js";
import { fishingOf } from "../../public/fish/js/fishing.js";
import { PLACES } from "../../public/fish/js/places.js";
import { rng } from "../../public/fish/js/lake.js";

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const q = (s, p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const share = (s, f) => s.filter(f).length / s.length;
const pc = (x) => (100 * x).toFixed(0) + "%";
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };

// the first hour of each place's derby (the derby clock starts at 18.3, 20, 6 and 18: plan section 4)
const DERBY = { loon: [18.3, 19.3], stumps: [20, 21], river: [6, 7], sea: [18, 19] };
// casts land d0..d1 m out, within 70° of straight ahead, in water at least 0.6 m deep
function* casts(map, n, seed, d0 = 12, d1 = 45, hours = null) {
  const r = rng(seed);
  for (let i = 0, k = 0; k < n && i < n * 5; i++) {
    const d = d0 + r() * (d1 - d0), a = (r() * 2 - 1) * 70 * D2R, x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const hour = hours ? hours[0] + r() * (hours[1] - hours[0]) : 6 + r() * 14;
    const zn = map.zone(x, z);
    if (zn === "land" || map.depth(x, z) < 0.6) continue;
    k++;
    yield { x, z, zn, hour, i };
  }
}
// Loon Lake: the real thing. LakeSim picks the fish (or nothing, or junk) and rolls its weight in choose()
function loonMix(n, seed, d0, d1, hours) {
  const kgs = [], by = {};
  for (const c of casts(PLACES.loon, n, seed, d0, d1, hours)) {
    const sim = new LakeSim({ lure: { x: c.x, z: c.z }, tip: rodTip(40, Math.atan2(c.x, -c.z) / D2R), lineOut: Math.hypot(c.x, c.z), hour: c.hour, rng: rng(7 + c.i) });
    const P = sim.plan;
    if (!P || P.junk) continue;
    kgs.push(P.kg); by[P.id] = (by[P.id] || 0) + 1;
  }
  return { kgs: kgs.sort((a, b) => a - b), by };
}
// any place: the same steps as LakeSim.choose() (bite chance, junk, the fish, its weight with the long-cast boost)
function placeMix(place, n, seed, hours) {
  const F = fishingOf(place), r = rng(seed + 1), kgs = [], by = {};
  for (const c of casts(place, n, seed, 12, 45, hours)) {
    if (r() >= (F.goodZones.includes(c.zn) ? BITE.GOOD : BITE.OPEN)) continue;
    const dist = Math.hypot(c.x, c.z);
    if (r() < BITE.JUNK * (c.zn === "dock" || dist < F.junkR ? BITE.JUNK_DOCK : 1)) continue;
    const list = speciesWeights(c.zn, place.depth(c.x, c.z), c.hour, null, place);
    if (!list.length) continue;
    let u = r() * list.reduce((a, [, w]) => a + w, 0), sp = list[list.length - 1][0];
    for (const [s, w] of list) if ((u -= w) <= 0) { sp = s; break; }
    const kg = rollWeight(sp, r, BITE.FAR_BOOST * smooth(BITE.FAR0, BITE.FAR1, dist));
    kgs.push(kg); by[sp.id] = (by[sp.id] || 0) + 1;
  }
  return { kgs: kgs.sort((a, b) => a - b), by };
}
function show(label, m) {
  const k = m.kgs, n = k.length, mean = k.reduce((a, b) => a + b, 0) / n;
  const sp = Object.entries(m.by).sort((a, b) => b[1] - a[1]).map(([id, c]) => `${id} ${(100 * c / n).toFixed(0)}`).join(", ");
  console.log(`${label}: ${n} fish, median ${q(k, 0.5)} kg, mean ${mean.toFixed(2)} | under 0.5 ${pc(share(k, (x) => x < 0.5))}, under 1 ${pc(share(k, (x) => x < 1))}, 2+ ${pc(share(k, (x) => x >= 2))}, 5+ ${pc(share(k, (x) => x >= 5))}, 10+ ${pc(share(k, (x) => x >= 10))} | p90 ${q(k, 0.9)}\n    ${sp}`);
}

/* ---------------- 1. the mix at each place ---------------- */

console.log("The weight mix: casts 12-45 m out, within 70°, at the derby hour");
{
  const d = loonMix(20000, 11, 12, 45, DERBY.loon);
  show("Loon Lake, derby", d);
  const med = q(d.kgs, 0.5);
  check(med >= 1.7 && med <= 2.4, `Loon: the median fish is 1.7-2.4 kg (${med})`);
  check(share(d.kgs, (x) => x < 0.5) <= 0.25, `Loon: 25% or less are under 0.5 kg (${pc(share(d.kgs, (x) => x < 0.5))})`);
  const big = share(d.kgs, (x) => x >= 2);
  check(big >= 0.4 && big <= 0.6, `Loon: 40-60% are 2 kg or more (${pc(big)})`);
  const s = loonMix(20000, 12, 8, 25), l = loonMix(20000, 13, 35, 50);
  show("Loon Lake, short casts 8-25 m, all day", s);
  show("Loon Lake, long casts 35-50 m, all day", l);
  check(q(l.kgs, 0.5) >= 1.8 * q(s.kgs, 0.5), `Loon: the long-cast median is 1.8 x the short-cast median or more (${q(l.kgs, 0.5)} vs ${q(s.kgs, 0.5)} kg: ${(q(l.kgs, 0.5) / q(s.kgs, 0.5)).toFixed(2)} x)`);
  // the copy of the bite steps for the other places gives the same mix as the real code
  const c = placeMix(PLACES.loon, 20000, 11, DERBY.loon);
  show("Loon Lake, derby, by the place steps", c);
  check(Math.abs(q(c.kgs, 0.5) / med - 1) < 0.06, `the place steps match LakeSim at Loon (median ${q(c.kgs, 0.5)} vs ${med} kg)`);
}
{
  // [id, median range, under 1 kg range, 10 kg or more range]
  const T = [["stumps", [2.3, 3.4], [0.15, 0.3], null], ["river", [3.0, 4.3], [0.08, 0.2], null], ["sea", [4.0, 5.8], [0.15, 0.3], [0.1, 0.2]]];
  for (const [id, [m0, m1], [u0, u1], ten] of T) {
    const P = PLACES[id], d = placeMix(P, 20000, 21, DERBY[id]);
    show(`${P.name}, derby`, d);
    const med = q(d.kgs, 0.5), u = share(d.kgs, (x) => x < 1);
    check(med >= m0 && med <= m1, `${id}: the median fish is ${m0}-${m1} kg (${med})`);
    check(u >= u0 && u <= u1, `${id}: ${pc(u0)}-${pc(u1)} are under 1 kg (${pc(u)})`);
    if (ten) { const t = share(d.kgs, (x) => x >= 10); check(t >= ten[0] && t <= ten[1], `${id}: ${pc(ten[0])}-${pc(ten[1])} are 10 kg or more (${pc(t)})`); }
  }
}

/* ---------------- 2. the rare tail ---------------- */

console.log("\nAbove the usual range at no boost: 40000 rolls per species (target 3-5%)");
{
  const r = rng(777), out = [], bad = [];
  for (const sp of SPECIES) {
    let over = 0;
    for (let i = 0; i < 40000; i++) if (rollWeight(sp, r) > sp.kg[1]) over++;
    const t = `${sp.id} ${(100 * over / 40000).toFixed(1)}`;
    out.push(t);
    if (over / 40000 < 0.03 || over / 40000 > 0.05) bad.push(t + "%");
  }
  console.log("    " + out.join(", "));
  check(!bad.length, `every species (${SPECIES.length}) has 3-5% of its fish above its usual range` + (bad.length ? ` (not: ${bad.join(", ")})` : ""));
}

/* ---------------- 3. sizeRank ---------------- */

console.log("\nsizeRank against the sampled weights: 40000 rolls per species at no boost");
{
  const P = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
  let worst = 0, at = "", shape = true;
  for (const sp of SPECIES) {
    const r = rng(5), xs = [];
    for (let i = 0; i < 40000; i++) xs.push(rollWeight(sp, r));
    xs.sort((a, b) => a - b);
    for (const p of P) { const e = Math.abs(sizeRank(sp, q(xs, p)) - p); if (e > worst) { worst = e; at = `${sp.id} at p${100 * p}`; } }
    // 0 at the bottom of the range, 1 at the trophy, and never down as the fish gets heavier
    let last = -1;
    for (let i = 0; i <= 200; i++) { const v = sizeRank(sp, sp.kg[0] + (sp.trophy - sp.kg[0]) * i / 200); if (!(v >= last && v >= 0 && v <= 1)) shape = false; last = v; }
    if (sizeRank(sp, sp.kg[0]) !== 0 || sizeRank(sp, sp.trophy) !== 1 || sizeRank(sp, sp.trophy * 2) !== 1) shape = false;
  }
  check(worst <= 0.03, `sizeRank is within 0.03 of the sampled quantiles for all ${SPECIES.length} species (worst ${worst.toFixed(4)}, ${at})`);
  check(shape, "sizeRank is 0 at the bottom of the range, 1 at the trophy, and grows with weight");
  // the size line on the catch card: how heavy a walleye must be for each line
  const sp = SPECIES.find((s) => s.id === "walleye");
  const kgAt = (p) => { let lo = sp.kg[0], hi = sp.trophy; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sizeRank(sp, m) < p) lo = m; else hi = m; } return lo.toFixed(2); };
  console.log(`    walleye: 3 in 4 at ${kgAt(0.75)} kg, 9 in 10 at ${kgAt(0.9)} kg, TROPHY (19 in 20) at ${kgAt(0.95)} kg, 99 in 100 at ${kgAt(0.99)} kg`);
}

console.log(fails.length ? `\n${fails.length} target(s) missed` : "\nAll size targets met");
process.exit(fails.length ? 1 : 0);
