// A headless harness for the bites and fights in fish.js at Loon Lake: node qa/fish/fight.sim.mjs
// Scripted players (qa/fish/fightlib.mjs) fish every Loon Lake fish, and the golden bass, over many seeds. It prints land / snap /
// thrown rates, fight times, bite rates by zone and the weight spread, then checks the targets. Exit code 1 if a target is missed.
// The other three places are in qa/fish/places.sim.mjs. N=40 node qa/fish/fight.sim.mjs runs a quicker, noisier pass.
import { LakeSim, Rises, REEL, BITE, rodTip, rollWeight, speciesWeights, firstBite } from "../../public/fish/js/fish.js";
import { SPECIES } from "../../public/fish/js/species.js";
import { FISHING } from "../../public/fish/js/fishing.js";
import { rng, zone, depth } from "../../public/fish/js/lake.js";
import { runCast, DT, D2R, headingDeg } from "./fightlib.mjs";

const N = Math.max(10, +process.env.N || 120); // casts per species per policy
const pct = (a, b) => (b ? (100 * a / b).toFixed(0).padStart(3) + "%" : "   -");
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
// Loon Lake's fish, and the golden bass (the legend of Loon Lake)
const LOON = SPECIES.filter((s) => FISHING.loon.fish[s.id] || s.id === FISHING.loon.legend.id);

/* ---------------- where to cast for each fish ---------------- */

function spotsFor(sp, n, seed) {
  const r = rng(seed), out = [];
  const top = Math.max(...Object.values(sp.zones), 0);
  for (let i = 0; out.length < n && i < 200000; i++) {
    // most casts land 12..45 m out (see cast.sim: 300..1000 °/s strokes); the golden bass rises in its ring
    const d = sp.legend ? FISHING.loon.legend.ring[0] + r() * (FISHING.loon.legend.ring[1] - FISHING.loon.legend.ring[0]) : 12 + r() * 33, a = (r() * 2 - 1) * 70 * D2R;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const zn = zone(x, z);
    if (zn === "land" || depth(x, z) < 0.6) continue;
    if (!sp.legend && r() * top > (sp.zones[zn] || 0)) continue;
    out.push({ x, z, zn });
  }
  return out;
}

/* ---------------- run everything ---------------- */

// TRACE=species:seed:policy prints one cast frame by frame and exits
if (process.env.TRACE) {
  const [id, seed, pol = "good"] = process.env.TRACE.split(":");
  const sp = SPECIES.find((q) => q.id === id);
  const spots = spotsFor(sp, N, 1000 + sp.id.length * 31 + sp.id.charCodeAt(0));
  const i = +seed - 1, s = spots[i % spots.length];
  const ring = sp.legend ? { x: s.x, z: s.z, ttl: 20, species: id, gold: true } : null;
  const o = runCast({ policy: pol, seed: +seed, spot: s, species: id, hour: sp.legend ? 6.5 : 12, ring, trace: true });
  console.log(o);
  process.exit(0);
}
// FIND=policy:outcome lists the seeds that ended that way
const t0 = Date.now();
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
// the five players from the brief, and three that each break one rule of good play:
// good = the skilled player of fightlib.mjs: it reads every tell (steers a cover run and a rub, rod up for a thrash, reels fast
// for a charge, pumps a sulk, rod at 60° while a legend rests). horse = a good retrieve, then winds flat out with the rod low;
// rodhigh = good, but keeps the rod up when the fish jumps; grinder = good, but keeps cranking while the drag slips
const POLICIES = ["good", "greedy", "idle", "late", "early", "horse", "rodhigh", "grinder"];
const ONLY = { rodhigh: ["smallmouth", "largemouth", "muskie", "golden"], grinder: ["walleye", "pike", "laketrout", "muskie", "golden"] };
const res = {};
for (const pol of POLICIES) res[pol] = {};
for (const sp of LOON) {
  const spots = spotsFor(sp, N, 1000 + sp.id.length * 31 + sp.id.charCodeAt(0));
  for (const pol of POLICIES) {
    if (ONLY[pol] && !ONLY[pol].includes(sp.id)) continue;
    const list = [];
    for (let i = 0; i < N; i++) {
      const s = spots[i % spots.length];
      const ring = sp.legend ? { x: s.x, z: s.z, ttl: 20, species: sp.id, gold: true } : null;
      list.push(runCast({ policy: pol, seed: i + 1, spot: s, species: sp.id, hour: sp.legend ? 6.5 : 12, ring }));
    }
    res[pol][sp.id] = list;
  }
}

if (process.env.FIND) {
  const [pol, outc] = process.env.FIND.split(":");
  for (const sp of LOON) (res[pol][sp.id] || []).forEach((o, i) => { if (o.outcome === outc) console.log(`${sp.id}:${i + 1}:${pol}  kg ${o.kg} fight ${o.fightT.toFixed(1)} s`); });
}

function summary(list) {
  const struck = list.filter((o) => o.struck), hooked = list.filter((o) => o.hooked);
  const landed = hooked.filter((o) => o.outcome === "caught");
  const n = (k) => hooked.filter((o) => o.outcome === k).length;
  return {
    n: list.length, struck: struck.length, hooked: hooked.length, landed: landed.length,
    snap: n("snap"), thrown: n("thrown"), cover: n("weeds") + n("rocks"), timeout: n("timeout"),
    spat: struck.filter((o) => o.outcome === "spat").length, spooked: list.filter((o) => o.outcome === "spooked").length,
    nibbled: list.filter((o) => o.nibbled).length, yanked: list.filter((o) => o.yankedEarly).length,
    home: list.filter((o) => o.outcome === "home").length,
    times: landed.map((o) => o.fightT), maxT: mean(hooked.map((o) => o.maxT)),
  };
}

console.log(`\nFights: ${N} casts per species per policy, medium drag (${REEL.DRAG_N[1]} N, the line breaks at ${REEL.BREAK_N} N), easy mode. Rates of landed / snap / thrown / cut are out of hooked fish.`);
for (const pol of POLICIES) {
  console.log(`\n[${pol}]`);
  console.log("species        strike hooked landed  snap thrown   cut  t/o  spat spook  home  | fight s: mean  med  p10-p90   | peak N");
  for (const sp of LOON) {
    if (!res[pol][sp.id]) continue;
    const s = summary(res[pol][sp.id]);
    const ts = [...s.times].sort((a, b) => a - b);
    const p10 = ts[Math.floor(ts.length * 0.1)], p90 = ts[Math.floor(ts.length * 0.9)];
    console.log(`${sp.id.padEnd(14)} ${pct(s.struck, s.n)}  ${pct(s.hooked, s.struck)}  ${pct(s.landed, s.hooked)}  ${pct(s.snap, s.hooked)}  ${pct(s.thrown, s.hooked)}  ${pct(s.cover, s.hooked)} ${pct(s.timeout, s.hooked)} ${pct(s.spat, s.struck)} ${pct(s.spooked, s.n)} ${pct(s.home, s.n)}  |  ${mean(s.times).toFixed(1).padStart(6)} ${median(s.times).toFixed(1).padStart(5)} ${String(p10 ? p10.toFixed(0) : "-").padStart(4)}-${String(p90 ? p90.toFixed(0) : "-").padEnd(4)}  | ${s.maxT.toFixed(0).padStart(4)}`);
  }
  const all = summary(Object.values(res[pol]).flat());
  console.log(`${"ALL".padEnd(14)} ${pct(all.struck, all.n)}  ${pct(all.hooked, all.struck)}  ${pct(all.landed, all.hooked)}  ${pct(all.snap, all.hooked)}  ${pct(all.thrown, all.hooked)}  ${pct(all.cover, all.hooked)} ${pct(all.timeout, all.hooked)} ${pct(all.spat, all.struck)} ${pct(all.spooked, all.n)} ${pct(all.home, all.n)}`);
}

// how lively the good fights are: moves per fight
console.log("\nWhat a good player feels, per fight: moves (run / shake / jump / dive / surge), and drag and slack alerts per minute");
for (const sp of LOON) {
  const h = res.good[sp.id].filter((o) => o.hooked);
  const m = (k) => (h.reduce((a, o) => a + (o.moves[k] || 0), 0) / Math.max(1, h.length)).toFixed(1);
  const mins = h.reduce((a, o) => a + o.fightT, 0) / 60 || 1;
  const perMin = (k) => (h.reduce((a, o) => a + (o.events[k] || 0), 0) / mins).toFixed(1);
  console.log(`  ${sp.id.padEnd(13)} ${m("run")} / ${m("shake")} / ${m("jump")} / ${m("dive")} / ${m("surge")} / ${m("charge")} / ${m("sulk")} / ${m("walk")} / ${m("thrash")} / ${m("cover")}   drag ${perMin("drag")}/min  slack ${perMin("slack")}/min`);
}

/* ---------------- bites by zone: casts anywhere, nothing forced ---------------- */

console.log("\nBites by zone: random casts 8..45 m out, good player, hours 6..20. 'fish' = a fish or junk chose the lure; 'strike' = it took it.");
const zoneStats = {}, zoneSpecies = {};
{
  const r = rng(4242);
  for (let i = 0; i < 2500; i++) {
    const d = 8 + r() * 37, a = (r() * 2 - 1) * 70 * D2R, x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const zn = zone(x, z);
    if (zn === "land" || depth(x, z) < 0.6) continue;
    const hour = 6 + r() * 14;
    const o = runCast({ policy: "good", seed: 50000 + i, spot: { x, z }, hour });
    const key = ["sand", "deep"].includes(zn) ? zn + " (open)" : zn;
    const q = zoneStats[key] || (zoneStats[key] = { n: 0, chosen: 0, struck: 0, junk: 0 });
    q.n++; if (o.chosen) q.chosen++; if (o.struck) q.struck++; if (["boot", "plunger", "frisbee"].includes(o.id)) q.junk++;
    if (o.id) { const zs = zoneSpecies[key] || (zoneSpecies[key] = {}); zs[o.id] = (zs[o.id] || 0) + 1; }
  }
  // casts into rings
  const q = zoneStats["in a ring"] = { n: 0, chosen: 0, struck: 0, junk: 0 };
  const rises = new Rises(rng(99));
  for (let i = 0; i < 400; i++) {
    rises.step(3, 6 + (i % 15));
    const g = rises.list[i % rises.list.length];
    const o = runCast({ policy: "good", seed: 90000 + i, spot: { x: g.x + (r() - 0.5) * 3, z: g.z + (r() - 0.5) * 3 }, hour: 6 + (i % 15), ring: g });
    q.n++; if (o.chosen) q.chosen++; if (o.struck) q.struck++;
    const zs = zoneSpecies["in a ring"] || (zoneSpecies["in a ring"] = {}); if (o.id) zs[o.id] = (zs[o.id] || 0) + 1;
  }
}
console.log("zone              casts   fish strike  junk | what bites");
for (const [k, q] of Object.entries(zoneStats)) {
  const zs = zoneSpecies[k] || {}, tot = Object.values(zs).reduce((a, b) => a + b, 0);
  const top = Object.entries(zs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, c]) => `${id} ${(100 * c / tot).toFixed(0)}%`).join(", ");
  console.log(`${k.padEnd(16)} ${String(q.n).padStart(6)}  ${pct(q.chosen, q.n)}  ${pct(q.struck, q.n)} ${pct(q.junk, q.chosen)} | ${top}`);
}

/* ---------------- weights ---------------- */

console.log("\nWeights: 6000 rolls per species. 'over' = above the top of the usual range (target about 1 in 25)");
const overs = [];
{
  const r = rng(777);
  console.log("species        range kg       mean   median  over   max");
  for (const sp of LOON) {
    const w = []; for (let i = 0; i < 6000; i++) w.push(rollWeight(sp, r));
    const over = w.filter((x) => x > sp.kg[1]).length / w.length;
    overs.push(over);
    console.log(`${sp.id.padEnd(14)} ${(sp.kg[0] + "-" + sp.kg[1]).padEnd(12)} ${mean(w).toFixed(2).padStart(6)} ${median(w).toFixed(2).padStart(7)} ${(100 * over).toFixed(1).padStart(5)}% ${Math.max(...w).toFixed(2).padStart(6)} (trophy ${sp.trophy})`);
  }
}

/* ---------------- the targets ---------------- */

console.log("\nTargets");
const good = summary(Object.values(res.good).flat());
check(good.landed / good.hooked >= 0.85, `good lands >= 85% of hooked fish overall (${pct(good.landed, good.hooked)})`);
const mus = summary(res.good.muskie);
check(mus.landed / mus.hooked >= 0.7, `good lands >= 70% of muskie (${pct(mus.landed, mus.hooked)})`);
for (const sp of LOON) {
  const s = summary(res.good[sp.id]);
  check(s.hooked >= N * 0.5 && s.landed / s.hooked >= 0.7, `good lands >= 70% of every species: ${sp.id} ${pct(s.landed, s.hooked)} of ${s.hooked}`);
}
const big = Object.values(res.greedy).flat().filter((o) => o.hooked && o.kg > 2);
const bigSnap = big.filter((o) => o.outcome === "snap").length;
check(big.length > N / 3 && bigSnap / big.length >= 0.5, `greedy snaps >= 50% of hooked fish over 2 kg (${pct(bigSnap, big.length)} of ${big.length})`);
const horseBig = Object.values(res.horse).flat().filter((o) => o.hooked && o.kg > 2);
const horseSnap = horseBig.filter((o) => o.outcome === "snap").length;
check(horseBig.length > N / 3 && horseSnap / horseBig.length >= 0.5, `winding flat out with the rod low (after a good retrieve) snaps >= 50% of fish over 2 kg (${pct(horseSnap, horseBig.length)} of ${horseBig.length})`);
const horseSmall = Object.values(res.horse).flat().filter((o) => o.hooked && o.kg < 0.6);
check(horseSmall.filter((o) => o.outcome === "caught").length / horseSmall.length >= 0.7, `...but it still lands most small fish (${pct(horseSmall.filter((o) => o.outcome === "caught").length, horseSmall.length)} under 0.6 kg)`);
for (const id of ONLY.rodhigh) {
  const g = summary(res.good[id]), h = summary(res.rodhigh[id]);
  if (id === "smallmouth" || id === "golden") check(h.thrown / h.hooked >= 0.2 && h.thrown / h.hooked > 2 * g.thrown / g.hooked + 0.05, `a rod held high through the jumps throws the hook: ${id} ${pct(h.thrown, h.hooked)} vs ${pct(g.thrown, g.hooked)} with the rod low`);
}
{
  const g = summary(ONLY.grinder.flatMap((id) => res.good[id])), h = summary(ONLY.grinder.flatMap((id) => res.grinder[id]));
  check(h.snap / h.hooked >= 0.25 && h.snap / h.hooked > 3 * g.snap / g.hooked, `cranking through the drag snaps big fish: ${pct(h.snap, h.hooked)} vs ${pct(g.snap, g.hooked)} when you stop`);
  // ...but the drag gives first: the line goes only after the drag has slipped a while, time enough to stop reeling
  const slips = ONLY.grinder.flatMap((id) => res.grinder[id]).filter((o) => o.slipFor != null).map((o) => o.slipFor);
  check(slips.length > 0 && median(slips) >= 0.5, `the drag gives before the line breaks: a steady crank into a run snaps it ${median(slips).toFixed(2)} s (median) after the drag starts to slip (0.5 s or more)`);
  // ...and not only at the median: three in four of those snaps come 0.45 s or more after the slip
  const p25 = slips.slice().sort((a, b) => a - b)[Math.floor(slips.length / 4)];
  check(slips.length > 0 && p25 >= 0.45, `and a quarter of them at most come sooner than 0.45 s (p25 ${p25.toFixed(2)} s, p10 ${slips.slice().sort((a, b) => a - b)[Math.floor(slips.length / 10)].toFixed(2)} s)`);
}
{
  const all = POLICIES.flatMap((pol) => Object.values(res[pol]).flat()), n = all.reduce((a, o) => a + o.beatenTricks, 0);
  check(n === 0, `a beaten fish starts no trick move: no jump, tail walk, charge, shake or thrash (${n} in ${all.length} casts)`);
}
const idle = summary(Object.values(res.idle).flat());
check((idle.hooked - idle.landed) / idle.hooked >= 0.8, `idle loses >= 80% of hooked fish (${pct(idle.hooked - idle.landed, idle.hooked)}; ${pct(idle.timeout, idle.hooked)} by timeout)`);
const late = summary(Object.values(res.late).flat());
check(late.spat / late.struck >= 0.5, `late misses most strikes (${pct(late.spat, late.struck)} spat)`);
const early = summary(Object.values(res.early).flat());
const eRate = early.spooked / Math.max(1, early.yanked);
check(eRate >= 0.35 && eRate <= 0.65, `early spooks about half of the fish it yanks at (${pct(early.spooked, early.yanked)} of ${early.yanked})`);
check(good.struck / good.n >= 0.8, `a forced fish usually strikes a good retrieve (${pct(good.struck, good.n)})`);
// fight times for good play (median of landed fish, with 15% tolerance): plan section 3.5.
// Compressed game time (the fishing brief): short enough to keep an arm up, long enough to feel the fish. The fish are bigger
// and the fights longer than the first version: pike 20-35 s, lake trout 28-45 s, muskie 30-50 s, the golden bass (three phases) 45-70 s
const RANGES = { pumpkinseed: [3, 8], perch: [3, 8], rockbass: [6, 14], smallmouth: [12, 24], largemouth: [12, 24], walleye: [12, 24], pike: [20, 35], laketrout: [28, 45], muskie: [30, 50], golden: [45, 70] };
for (const sp of LOON) {
  const m = median(summary(res.good[sp.id]).times), [a, b] = RANGES[sp.id];
  check(m >= a * 0.85 && m <= b * 1.15, `${sp.id} fight time ${m.toFixed(1)} s is in ${a}-${b} s`);
}
// bites
const zq = (k) => zoneStats[k] || { n: 0, chosen: 0 };
const goodW = ["pads", "weeds", "rocks", "dropoff", "dock"].map(zq).reduce((a, q) => ({ n: a.n + q.n, chosen: a.chosen + q.chosen }), { n: 0, chosen: 0 });
check(Math.abs(goodW.chosen / goodW.n - BITE.GOOD) < 0.07, `about 70% of casts into good water get a bite (${pct(goodW.chosen, goodW.n)})`);
check(zq("in a ring").chosen / zq("in a ring").n >= 0.85, `about 90% inside a ring (${pct(zq("in a ring").chosen, zq("in a ring").n)})`);
const open = ["sand (open)", "deep (open)"].map(zq).reduce((a, q) => ({ n: a.n + q.n, chosen: a.chosen + q.chosen }), { n: 0, chosen: 0 });
check(open.n > 0 && open.chosen / open.n < goodW.chosen / goodW.n, `open sand and deep water bite less (${pct(open.chosen, open.n)})`);
const junkAll = Object.values(zoneStats).reduce((a, q) => a + q.junk, 0), fishAll = Object.values(zoneStats).reduce((a, q) => a + q.chosen, 0);
check(junkAll / fishAll > 0.03 && junkAll / fishAll < 0.12 && zq("dock").junk / Math.max(1, zq("dock").chosen) > junkAll / fishAll, `junk is ~5% of bites, more by the dock (${pct(junkAll, fishAll)} overall, ${pct(zq("dock").junk, zq("dock").chosen)} by the dock)`);
check(overs.every((o) => o > 0.02 && o < 0.05), "about 1 in 25 fish is above the usual range");

/* ---------------- rings ---------------- */

console.log("\nRings");
{
  let ok = true, goldDay = 0, goldDawn = 0, far = true;
  for (const hour of [12, 6.5]) {
    const R = new Rises(rng(5));
    for (let i = 0; i < 3000; i++) {
      R.step(1, hour);
      if (R.list.length < 2 || R.list.length > 4) ok = false;
      for (const g of R.list) {
        const d = Math.hypot(g.x, g.z);
        if (g.gold) { if (hour === 12) goldDay++; else goldDawn++; if (d < 40 || d > 55) far = false; }
        else if (d < 8 || d > 45 || zone(g.x, g.z) === "land") far = false;
        if (!g.gold && !speciesWeights(zone(g.x, g.z), depth(g.x, g.z), hour).some(([s]) => s.id === g.species)) far = false;
      }
    }
  }
  check(ok, "there are always 2..4 rings");
  check(far, "rings sit 8..45 m out in water their species likes; gold rings 40..55 m out");
  check(goldDay === 0 && goldDawn > 0, `gold rings only at dawn and dusk (${goldDawn} ring-seconds at dawn, ${goldDay} at noon)`);
  const R = new Rises(rng(3)); R.step(0.1, 12);
  const g = R.list[0];
  check(R.near(g.x + 3, g.z + 3) === g && R.near(g.x + 6, g.z) !== g, "near() finds a ring within 5 m");
}

/* ---------------- the first fish of a new player ---------------- */

// main.js: a fresh save's first cast in the water gets firstBite(): a small pumpkinseed or perch with a sure bite.
// The casual and the novice player land it within 25 s of the splash, from a short cast (8 to 25 m) anywhere at Loon Lake,
// and so does a novice who cranks the retrieve fast (2.4 turns a second, as when the crank key is held or the crank spun)
// and never slows down for the fish: the first fish does not mind a fast lure
console.log("\nThe first fish");
{
  const r = rng(31), casts = [];
  for (let i = 0; casts.length < 80 && i < 5000; i++) {
    const d = 8 + r() * 17, a = (r() * 2 - 1) * 70 * D2R, x = Math.sin(a) * d, z = -Math.cos(a) * d, zn = zone(x, z);
    if (zn === "land" || depth(x, z) < 0.6) continue;
    casts.push({ x, z, fb: firstBite(zn, r) });
  }
  for (const [name, pol, rps] of [["casual", "casual", 0], ["novice", "novice", 0], ["fast", "novice", 2.4]]) {
    const list = casts.map((c, i) => runCast({ policy: pol, seed: 3000 + i, spot: c, species: c.fb.species, kg: c.fb.kg, bite: true, eager: c.fb.eager, hour: 6.5, rps }));
    const quick = list.filter((o) => o.outcome === "caught" && o.endT <= 25).length, ts = list.filter((o) => o.outcome === "caught").map((o) => o.endT);
    console.log(`  ${name.padEnd(7)} struck ${pct(list.filter((o) => o.struck).length, list.length)}, landed ${pct(ts.length, list.length)}, in 25 s ${pct(quick, list.length)}; splash to landing: median ${median(ts).toFixed(1)} s, max ${Math.max(...ts).toFixed(1)} s`);
    check(list.every((o) => o.struck) && casts.every((c) => c.fb.kg < 0.5 && c.fb.eager && ["pumpkinseed", "perch"].includes(c.fb.species)), `${name}: the first fish is a small, eager pumpkinseed or perch, and it always strikes`);
    check(quick >= list.length * (pol === "casual" ? 0.95 : 0.85), `${name}: lands the first fish within 25 s of the splash (${pct(quick, list.length)})`);
  }
}

/* ---------------- robustness and determinism ---------------- */

console.log("\nRules");
{
  // hard mode: a shorter window and no free hook-ups
  const n = 150, casts = (pol, easy) => SPECIES.slice(0, 8).flatMap((sp) => { const sp8 = spotsFor(sp, 20, 77); return Array.from({ length: n / 8 | 0 }, (_, i) => runCast({ policy: pol, seed: 700 + i, spot: sp8[i % sp8.length], species: sp.id, easy })); });
  const lateHard = summary(casts("late", false)), goodHard = summary(casts("good", false));
  check(lateHard.spat === lateHard.struck, `hard mode: a late hook set always misses (${pct(lateHard.spat, lateHard.struck)})`);
  check(goodHard.hooked === goodHard.struck, `hard mode: a hook set 0.25 s after the strike still hooks (${pct(goodHard.hooked, goodHard.struck)})`);
  // junk: it hooks itself, has no moves, pulls steadily and comes in
  const junk = ["boot", "plunger", "frisbee"].flatMap((id) => Array.from({ length: 10 }, (_, i) => runCast({ policy: "good", seed: 800 + i, spot: { x: 3, z: -18 - i }, species: id })));
  const moves = junk.reduce((a, o) => a + Object.values(o.moves).reduce((x, y) => x + y, 0), 0);
  check(junk.every((o) => o.events.snag === 1 && o.hooked && !o.events.strike), "junk snags and hooks itself with no strike to answer");
  check(moves === 0 && junk.every((o) => o.outcome === "caught"), `junk has no moves and always comes in (${junk.filter((o) => o.outcome === "caught").length} of ${junk.length})`);
  // a steady crank on junk feels like a steady heavy weight
  const cv = [], means = [];
  for (const id of ["boot", "plunger", "frisbee"]) {
    const sim = new LakeSim({ lure: { x: 2, z: -25 }, tip: rodTip(45, 5), lineOut: 26, rng: rng(5), species: id });
    const ts = [];
    for (let t = 0; t < 120 && !["caught", "lost", "home"].includes(sim.state.phase); t += DT) {
      const S = sim.state, land = S.phase === "land";
      sim.step(DT, { crank: land ? 0 : 1.2, theta: land ? 80 : 45, tip: rodTip(land ? 80 : 45, headingDeg(S.lure.x, S.lure.z)), lift: land });
      sim.events.length = 0;
      if (S.phase === "fight" && S.fightT > 1.5 && Math.hypot(S.lure.x, S.lure.z) > 8) ts.push(S.tension);
    }
    const m = mean(ts), sd = Math.sqrt(mean(ts.map((x) => (x - m) ** 2)));
    cv.push(sd / m); means.push(m);
  }
  check(cv.every((x) => x < 0.15) && means.every((m) => m > 2 && m < 20), `junk on a steady crank pulls a steady weight (${means.map((m, i) => m.toFixed(1) + " N ±" + (100 * cv[i]).toFixed(0) + "%").join(", ")})`);
  const R = new Rises(rng(8)); R.step(0.1, 12);
  const g = R.list[0]; R.take(g);
  check(!R.list.includes(g), "Rises.take removes a ring");
}

console.log("\nRobustness");
{
  const a = runCast({ policy: "good", seed: 5, spot: { x: -20, z: -15 }, species: "pike" });
  const b = runCast({ policy: "good", seed: 5, spot: { x: -20, z: -15 }, species: "pike" });
  check(a.outcome === b.outcome && a.fightT === b.fightT && a.kg === b.kg, `the same seed gives the same fight (${a.outcome} ${a.fightT.toFixed(2)} s both times)`);
  const sim = new LakeSim({ lure: { x: -20, z: -15 }, tip: rodTip(40, -50), lineOut: 26, rng: rng(2), species: "muskie" });
  const junk = [{}, null, { crank: NaN, theta: NaN, tip: { x: NaN }, steer: Infinity, drag: 7, omega: -Infinity }, { crank: -5, theta: 1e9, hookset: 1, lift: "yes" }];
  let fine = true;
  for (let i = 0; i < 4000; i++) {
    const dt = i % 97 === 0 ? 5 : i % 89 === 0 ? NaN : i % 83 === 0 ? -1 : 1 / 60;
    const inp = i % 13 === 0 ? junk[i % 4] : { crank: 1.2, theta: 40 + 30 * Math.sin(i / 50), tip: rodTip(40 + 30 * Math.sin(i / 50), -50), steer: 0, hookset: i % 200 === 0 };
    sim.step(dt, inp);
    sim.events.length = 0;
    const s = sim.state, f = s.fish;
    const nums = [s.lineOut, s.tension, s.tfrac, s.slip, s.lure.x, s.lure.y, s.lure.z, s.lure.speed, ...(f ? [f.x, f.y, f.z, f.heading, f.stamina, f.speed] : [])];
    if (!nums.every(Number.isFinite)) { fine = false; console.log("  bad state at", i, s.phase, nums); break; }
    if (["caught", "lost", "home"].includes(s.phase)) break;
  }
  check(fine, "NaN, missing and huge inputs and big dt never make NaN");
}

console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(fails.length ? `${fails.length} target(s) missed` : "All fight targets met");
process.exit(fails.length ? 1 : 0);
