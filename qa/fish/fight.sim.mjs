// A headless harness for the bites and fights in fish.js: node qa/fish/fight.sim.mjs
// Scripted players fish every species over many seeds. It prints land / snap / thrown rates, fight times,
// bite rates by zone and the weight spread, then checks the targets. Exit code 1 if a target is missed.
// N=40 node qa/fish/fight.sim.mjs runs a quicker, noisier pass.
import { LakeSim, Rises, REEL, BITE, rodTip, rollWeight, speciesWeights } from "../../public/fish/js/fish.js";
import { SPECIES } from "../../public/fish/js/species.js";
import { rng, zone, depth } from "../../public/fish/js/lake.js";

const N = Math.max(10, +process.env.N || 120); // casts per species per policy
const DT = 1 / 60;
const LIMIT = 400; // s: a cast that has not ended by then counts as a timeout
const D2R = Math.PI / 180;
const headingDeg = (x, z) => Math.atan2(x, -z) / D2R;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pct = (a, b) => (b ? (100 * a / b).toFixed(0).padStart(3) + "%" : "   -");
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/* ---------------- players ---------------- */

// a player sees the game with a short delay, moves the rod at a human speed, and follows one policy
class Player {
  constructor(policy, r) {
    this.pol = policy; this.r = r;
    this.t = 0; this.theta = 40; this.target = 40; this.rate = 150; this.steer = 0;
    this.seen = []; this.hist = [];
    this.react = 0.22 + r() * 0.08;
    this.strikeAt = null; this.nibbleAt = null; this.yanked = false;
    this.jumpUntil = -1; this.pump = "up"; this.hooked = false;
  }
  // what the player saw about `react` seconds ago
  view() {
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= this.t - this.react) return this.hist[i];
    return this.hist[0];
  }
  act(sim, events) {
    const S = sim.state, P = this.pol;
    this.t += DT;
    const f = S.fish;
    this.hist.push({ t: this.t, phase: S.phase, slip: S.slip, slack: S.slack, tfrac: S.tfrac, move: f ? f.move : "", x: f ? f.x : S.lure.x, z: f ? f.z : S.lure.z });
    if (this.hist.length > 90) this.hist.shift();
    for (const e of events) this.seen.push({ t: this.t, e });
    let crank = 0, hookset = false, lift = false;
    const v = this.view(), vt = this.t - this.react;
    // events the player has noticed by now
    while (this.seen.length && this.seen[0].t <= vt) {
      const { e } = this.seen.shift();
      if (e.type === "strike" && this.strikeAt === null) this.strikeAt = this.t;
      if (e.type === "nibble" && this.nibbleAt === null) this.nibbleAt = this.t;
      if (e.type === "hooked") this.hooked = true;
      if (e.type === "jump") this.jumpUntil = Infinity;
      if (e.type === "splash") this.jumpUntil = this.t + 0.3;
    }
    const fighting = S.phase === "fight" || S.phase === "land";
    const setDelay = P === "late" ? 1.5 : 0.25;
    if (!fighting) {
      // the retrieve: a steady crank with the rod at 40°, then the hook set
      this.target = P === "greedy" ? 15 : 40; this.rate = 150;
      crank = S.t < 0.6 ? 0 : P === "greedy" ? 3 : 1.1;
      if (P === "early" && this.nibbleAt !== null && !this.yanked && this.t >= this.nibbleAt + 0.15 - this.react) { this.yanked = true; hookset = true; }
      // the strike was noticed `react` s after it came; the hook set lands `setDelay` s after the strike
      if (this.strikeAt !== null && !this.didSet && this.t >= this.strikeAt - this.react + setDelay) {
        this.didSet = true; hookset = true;
        if (P !== "greedy") { this.target = 85; this.rate = 500; }
      }
    } else if (P === "greedy" || P === "horse") {
      crank = 3; this.target = 15; this.rate = 200;
      if (v.phase === "land") { this.target = 82; lift = true; }
    } else if (P === "idle") {
      crank = 0; this.target = 60; this.rate = 150;
    } else {
      // good technique: pump and reel, stop cranking while the drag slips, rod low for jumps, steer against runs, lift to land
      if (v.phase === "land") {
        this.target = 82; this.rate = 150; lift = true; crank = v.slack ? 0.8 : 0;
      } else if (this.t < this.jumpUntil && P !== "rodhigh") {
        this.target = 18; this.rate = 300; crank = v.slack ? 2.4 : 0.8;
      } else if (v.slip > 0.15 && P === "grinder") {
        crank = 2.4; this.target = 72; this.rate = 150; this.pump = "up";
      } else if (v.slip > 0.15) {
        crank = 0; this.target = 72; this.rate = 150; this.pump = "up";
      } else if (v.tfrac < 0.15 && v.move !== "run" && v.move !== "surge") {
        // a light fish that comes easily: rod up and reel it in fast
        this.target = 60; this.rate = 90; crank = 3; this.pump = "up";
      } else if (this.pump === "up") {
        this.target = 80; this.rate = 70; crank = v.slack ? 2.6 : 0.2;
        if (this.theta >= 78 || v.tfrac > S.dragFrac * 0.9) this.pump = "down";
      } else {
        this.target = 30; this.rate = 90; crank = v.slack ? 3 : 2.4;
        if (this.theta <= 32) this.pump = "up";
      }
      // side pressure: swing the rod against a fish that runs sideways
      // (a fish running straight out gets turned away from its cover: the weeds are on the left, the rocks on the right)
      let want = 0;
      if (f && (v.move === "run" || v.move === "surge" || v.move === "dive") && this.hist.length > 20) {
        const a = this.hist[this.hist.length - 1], b = this.hist[this.hist.length - 16];
        const dx = a.x - b.x, dz = a.z - b.z, ln = Math.hypot(a.x, a.z) || 1;
        const lat = (dx * (-a.z / ln) + dz * (a.x / ln)) / (a.t - b.t); // + = the fish moves to the angler's right
        want = Math.abs(lat) > 0.3 ? -Math.sign(lat) : a.x < 0 ? 1 : -1;
      }
      this.steer += clamp(want - this.steer, -3 * DT, 3 * DT);
    }
    if (P === "greedy" || P === "horse" || P === "idle") this.steer = 0;
    const prev = this.theta;
    this.theta += clamp(this.target - this.theta, -this.rate * DT, this.rate * DT);
    const omega = (this.theta - prev) / DT;
    const aim = f || S.lure;
    const tip = rodTip(this.theta, headingDeg(aim.x, aim.z), this.steer);
    return { crank, tip, theta: this.theta, omega, steer: this.steer, drag: 1, hookset, lift };
  }
}

/* ---------------- one cast ---------------- */

function runCast({ policy, seed, spot, species = null, hour = 12, ring = null, bite = undefined, trace = false }) {
  const r = rng(seed * 7919 + 13);
  const pl = new Player(policy, rng(seed * 104729 + 7));
  const tip = rodTip(40, headingDeg(spot.x, spot.z));
  const sim = new LakeSim({ lure: spot, tip, lineOut: Math.hypot(spot.x - tip.x, tip.y, spot.z - tip.z) * 1.03 + 0.3, hour, ring, rng: r, easy: true, species, bite });
  const out = { chosen: !!sim.plan, id: sim.plan ? sim.plan.id : null, kg: sim.plan ? sim.plan.kg : 0, struck: false, hooked: false, nibbled: false, yankedEarly: false, fightT: 0, maxT: 0, outcome: "", moves: {}, events: {} };
  let events = [];
  for (let t = 0; t < LIMIT; t += DT) {
    const inp = pl.act(sim, events);
    if (inp.hookset && sim.state.phase !== "strike" && out.nibbled && !out.struck) out.yankedEarly = true;
    sim.step(DT, inp);
    events = sim.events.splice(0);
    if (trace) {
      const S = sim.state, f = S.fish;
      const ev = events.map((e) => e.type).join(",");
      if (process.env.SPARK) spark(S, f, ev, t);
      else if (ev || Math.abs(t % 0.5) < DT / 2) console.log(`${t.toFixed(2).padStart(7)} ${S.phase.padEnd(8)} θ${inp.theta.toFixed(0).padStart(4)} crank ${inp.crank.toFixed(1)} steer ${inp.steer.toFixed(1).padStart(4)} line ${S.lineOut.toFixed(1).padStart(5)} T ${S.tension.toFixed(1).padStart(5)} slip ${S.slip.toFixed(2)} ${S.slack ? "SLACK" : "     "} ` +
        (f ? `fish ${f.move.padEnd(5)} (${f.x.toFixed(1)}, ${f.y.toFixed(1)}, ${f.z.toFixed(1)}) d ${Math.hypot(f.x, f.z).toFixed(1).padStart(5)} v ${f.speed.toFixed(2)} stam ${f.stamina.toFixed(2)} ` : `lure (${S.lure.x.toFixed(1)}, ${S.lure.y.toFixed(1)}, ${S.lure.z.toFixed(1)}) v ${S.lure.speed.toFixed(2)} `) + ev);
    }
    for (const e of events) {
      out.events[e.type] = (out.events[e.type] || 0) + 1;
      if (e.type === "strike") out.struck = true;
      if (e.type === "nibble") out.nibbled = true;
      if (e.type === "hooked") out.hooked = true;
      if (["run", "shake", "jump", "dive", "surge"].includes(e.type)) out.moves[e.type] = (out.moves[e.type] || 0) + 1;
    }
    if (sim.state.phase === "fight" || sim.state.phase === "land") out.maxT = Math.max(out.maxT, sim.state.tension);
    const ph = sim.state.phase;
    if (ph === "caught" || ph === "lost" || ph === "home") {
      out.outcome = ph === "lost" ? sim.state.reason : ph;
      out.fightT = sim.state.fightT;
      return out;
    }
  }
  out.outcome = "timeout";
  out.fightT = sim.state.fightT;
  return out;
}

// SPARK=1 with TRACE: one character of tension per frame, a line per second, so you can see the fight
let sparkLine = "", sparkMoves = "";
function spark(S, f, ev, t) {
  if (!f) return;
  const bars = " .:-=+*#%@";
  sparkLine += S.slip > 0.2 ? "~" : bars[Math.min(9, Math.floor(S.tfrac * 10))];
  if (ev) sparkMoves += `${t.toFixed(1)}:${ev} `;
  if (sparkLine.length >= 60) {
    console.log(`${(t - 1).toFixed(0).padStart(4)}s |${sparkLine}| ${f.move.padEnd(5)} stam ${f.stamina.toFixed(2)} d ${Math.hypot(f.x, f.z).toFixed(0).padStart(3)} m  ${sparkMoves}`);
    sparkLine = ""; sparkMoves = "";
  }
}

/* ---------------- where to cast for each species ---------------- */

function spotsFor(sp, n, seed) {
  const r = rng(seed), out = [];
  const top = Math.max(...Object.values(sp.zones), 0);
  for (let i = 0; out.length < n && i < 200000; i++) {
    const gold = sp.id === "golden";
    // most casts land 12..45 m out (see cast.sim: 300..1000 °/s strokes)
    const d = gold ? 40 + r() * 15 : 12 + r() * 33, a = (r() * 2 - 1) * 70 * D2R;
    const x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const zn = zone(x, z);
    if (zn === "land" || depth(x, z) < 0.6) continue;
    if (!gold && r() * top > (sp.zones[zn] || 0)) continue;
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
  const ring = id === "golden" ? { x: s.x, z: s.z, ttl: 20, species: "golden", gold: true } : null;
  const o = runCast({ policy: pol, seed: +seed, spot: s, species: id, hour: id === "golden" ? 6.5 : 12, ring, trace: true });
  console.log(o);
  process.exit(0);
}
// FIND=policy:outcome lists the seeds that ended that way
const t0 = Date.now();
const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
// the five players from the brief, and three that each break one rule of good play:
// horse = a good retrieve, then winds flat out with the rod low; rodhigh = good, but keeps the rod up when the fish jumps;
// grinder = good, but keeps cranking while the drag slips
const POLICIES = ["good", "greedy", "idle", "late", "early", "horse", "rodhigh", "grinder"];
const ONLY = { rodhigh: ["smallmouth", "largemouth", "muskie", "golden"], grinder: ["walleye", "pike", "laketrout", "muskie", "golden"] };
const res = {};
for (const pol of POLICIES) res[pol] = {};
for (const sp of SPECIES) {
  const spots = spotsFor(sp, N, 1000 + sp.id.length * 31 + sp.id.charCodeAt(0));
  for (const pol of POLICIES) {
    if (ONLY[pol] && !ONLY[pol].includes(sp.id)) continue;
    const list = [];
    for (let i = 0; i < N; i++) {
      const s = spots[i % spots.length];
      const ring = sp.id === "golden" ? { x: s.x, z: s.z, ttl: 20, species: "golden", gold: true } : null;
      list.push(runCast({ policy: pol, seed: i + 1, spot: s, species: sp.id, hour: sp.id === "golden" ? 6.5 : 12, ring }));
    }
    res[pol][sp.id] = list;
  }
}

if (process.env.FIND) {
  const [pol, outc] = process.env.FIND.split(":");
  for (const sp of SPECIES) (res[pol][sp.id] || []).forEach((o, i) => { if (o.outcome === outc) console.log(`${sp.id}:${i + 1}:${pol}  kg ${o.kg} fight ${o.fightT.toFixed(1)} s`); });
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

console.log(`\nFights: ${N} casts per species per policy, medium drag, easy mode. Rates of landed / snap / thrown / cut are out of hooked fish.`);
for (const pol of POLICIES) {
  console.log(`\n[${pol}]`);
  console.log("species        strike hooked landed  snap thrown   cut  t/o  spat spook  home  | fight s: mean  med  p10-p90   | peak N");
  for (const sp of SPECIES) {
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
for (const sp of SPECIES) {
  const h = res.good[sp.id].filter((o) => o.hooked);
  const m = (k) => (h.reduce((a, o) => a + (o.moves[k] || 0), 0) / Math.max(1, h.length)).toFixed(1);
  const mins = h.reduce((a, o) => a + o.fightT, 0) / 60 || 1;
  const perMin = (k) => (h.reduce((a, o) => a + (o.events[k] || 0), 0) / mins).toFixed(1);
  console.log(`  ${sp.id.padEnd(13)} ${m("run")} / ${m("shake")} / ${m("jump")} / ${m("dive")} / ${m("surge")}   drag ${perMin("drag")}/min  slack ${perMin("slack")}/min`);
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

console.log("\nWeights: 6000 rolls per species. 'over' = above the top of the usual range (target about 1 in 30)");
const overs = [];
{
  const r = rng(777);
  console.log("species        range kg       mean   median  over   max");
  for (const sp of SPECIES) {
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
for (const sp of SPECIES) {
  const s = summary(res.good[sp.id]);
  check(s.hooked >= N * 0.5 && s.landed / s.hooked >= 0.7, `good lands >= 70% of every species: ${sp.id} ${pct(s.landed, s.hooked)} of ${s.hooked}`);
}
const big = Object.values(res.greedy).flat().filter((o) => o.hooked && o.kg > 2);
const bigSnap = big.filter((o) => o.outcome === "snap").length;
check(big.length > 50 && bigSnap / big.length >= 0.5, `greedy snaps >= 50% of hooked fish over 2 kg (${pct(bigSnap, big.length)} of ${big.length})`);
const horseBig = Object.values(res.horse).flat().filter((o) => o.hooked && o.kg > 2);
const horseSnap = horseBig.filter((o) => o.outcome === "snap").length;
check(horseBig.length > 50 && horseSnap / horseBig.length >= 0.5, `winding flat out with the rod low (after a good retrieve) snaps >= 50% of fish over 2 kg (${pct(horseSnap, horseBig.length)} of ${horseBig.length})`);
const horseSmall = Object.values(res.horse).flat().filter((o) => o.hooked && o.kg < 0.6);
check(horseSmall.filter((o) => o.outcome === "caught").length / horseSmall.length >= 0.7, `...but it still lands most small fish (${pct(horseSmall.filter((o) => o.outcome === "caught").length, horseSmall.length)} under 0.6 kg)`);
for (const id of ONLY.rodhigh) {
  const g = summary(res.good[id]), h = summary(res.rodhigh[id]);
  if (id === "smallmouth" || id === "golden") check(h.thrown / h.hooked >= 0.2 && h.thrown / h.hooked > 2 * g.thrown / g.hooked + 0.05, `a rod held high through the jumps throws the hook: ${id} ${pct(h.thrown, h.hooked)} vs ${pct(g.thrown, g.hooked)} with the rod low`);
}
{
  const g = summary(ONLY.grinder.flatMap((id) => res.good[id])), h = summary(ONLY.grinder.flatMap((id) => res.grinder[id]));
  check(h.snap / h.hooked >= 0.25 && h.snap / h.hooked > 3 * g.snap / g.hooked, `cranking through the drag snaps big fish: ${pct(h.snap, h.hooked)} vs ${pct(g.snap, g.hooked)} when you stop`);
}
const idle = summary(Object.values(res.idle).flat());
check((idle.hooked - idle.landed) / idle.hooked >= 0.8, `idle loses >= 80% of hooked fish (${pct(idle.hooked - idle.landed, idle.hooked)}; ${pct(idle.timeout, idle.hooked)} by timeout)`);
const late = summary(Object.values(res.late).flat());
check(late.spat / late.struck >= 0.5, `late misses most strikes (${pct(late.spat, late.struck)} spat)`);
const early = summary(Object.values(res.early).flat());
const eRate = early.spooked / Math.max(1, early.yanked);
check(eRate >= 0.35 && eRate <= 0.65, `early spooks about half of the fish it yanks at (${pct(early.spooked, early.yanked)} of ${early.yanked})`);
check(good.struck / good.n >= 0.8, `a forced fish usually strikes a good retrieve (${pct(good.struck, good.n)})`);
// fight times for good play (median of landed fish, with 15% tolerance)
// the spec gives perch 5-10, bass 20-40, pike and trout 30-60, muskie 60-120. The rest are ours:
// rock bass live at the rocky point 30-45 m out, and the reel cannot bring anything in faster than 2.25 m/s;
// the golden bass rises 40-55 m out.
const RANGES = { pumpkinseed: [5, 12], perch: [5, 10], rockbass: [8, 20], smallmouth: [20, 40], largemouth: [20, 40], walleye: [20, 45], pike: [30, 60], laketrout: [30, 60], muskie: [60, 120], golden: [30, 70] };
for (const sp of SPECIES) {
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
check(overs.every((o) => o > 0.02 && o < 0.05), "about 1 in 30 fish is above the usual range");

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

/* ---------------- robustness and determinism ---------------- */

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
