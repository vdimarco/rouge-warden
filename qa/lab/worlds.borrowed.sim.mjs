// Checks the rules of Borrowed Bodies with no browser: node qa/lab/worlds.borrowed.sim.mjs
// The throw that keeps each body's motion, catches and misses, the seeded climb, the light clock and the 100 m peak.
// Scripted players: an exact aimer, a human-like aimer with aim error, and an idle player. Exit code 1 on failure.
import createGame, { RULES, KINDS, hostAt, launch, makeHosts } from "../../public/lab/worlds/games/borrowed.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const H = 1 / 120, { G, K, VMAX, CATCH } = RULES, BASE = 680 - 230;

// The shell's api with no screen and no sound. It keeps the status, the metric, the finish and each call to slow().
function game(seed, best = 0) {
  const log = { slow: [] };
  const api = { W: 420, H: 680, rng: mulberry(seed), seed, daily: false, best, status: (s) => (log.status = s), metric: (s) => (log.metric = s), finish: (o) => (log.finish = o),
    tone() {}, burst() {}, noise() {}, chord() {}, slow: (f, s) => log.slow.push([f, s]), shake() {}, buzz() {} };
  return { g: createGame(api), log };
}
const screen = (s, p) => ({ x: p.x, y: BASE - (p.alt - s.cam) });
// Presses and lets go at once, with the finger at a point in the world (x, alt).
function throwAt(g, p) { const s = g.getState(), q = screen(s, p); g.pointer("down", q); g.pointer("up", q); }
const until = (g, fn, max = 2400) => { for (let k = 0; k < max; k++) { if (fn(g.getState())) return true; g.update(H); } return fn(g.getState()); };

/* ---------------- players ---------------- */
// The aim that sends the spark to body c after T seconds, offset from its centre by `off`, or null when out of range.
function solve(s, c, T, off = { x: 0, alt: 0 }) {
  const h = s.hosts[s.current], at = { x: h.x, alt: h.alt, vx: h.vx, va: h.va }, k = KINDS[h.type], g = G * k.grav, tp = hostAt(c, s.time + T);
  const vx = (tp.x + off.x - at.x) / T, va = (tp.alt + off.alt - at.alt + 0.5 * g * T * T) / T;
  const fx = (vx - at.vx * k.push) / K, fa = (va - (h.type === "seed" ? Math.max(0, at.va) : at.va) * k.carry - k.lift) / K;
  if (Math.hypot(fx, fa) * K > VMAX * 0.98 || Math.hypot(fx, fa) < 16) return null;
  for (let t = 0; t < T; t += 0.02) { const x = at.x + (fx * K + at.vx * k.push) * t; if (x < 14 || x > 406) return null; }
  return { x: at.x + fx, alt: at.alt + fa, cost: Math.hypot(fx, fa) + (c.id - s.current - 1) * 25 };
}
function bestAim(s, off) {
  const h = s.hosts[s.current]; let pick = null;
  for (const c of s.hosts.filter((c) => c.ba > h.ba + 20).slice(0, 3))
    for (let T = 0.35; T <= 1.5; T += 0.02) { const a = solve(s, c, T, off); if (a && (!pick || a.cost < pick.cost)) pick = a; }
  return pick;
}
// Throws at once with an exact aim.
const exact = () => (g, s) => { if (s.phase === "playing" && !s.aiming) { const a = bestAim(s); if (a) throwAt(g, a); } };
// Holds for a human's aim time (the world runs at a fifth meanwhile), then lets go with some aim error.
const human = (rnd, err, hold) => { let until = -1; return (g, s, t) => {
  if (s.phase !== "playing") return;
  if (!s.aiming) { until = t + hold[0] + rnd() * (hold[1] - hold[0]); g.pointer("down", { x: 210, y: 300 }); return; }
  if (t < until) return;
  const a = bestAim(s); if (!a) { until = t + 0.2; return; }
  const q = screen(s, a); g.pointer("up", { x: q.x + (rnd() - 0.5) * 2 * err, y: q.y + (rnd() - 0.5) * 2 * err }); } };
const idle = () => () => {};
function play(seed, policy, max = 600) {
  const { g, log } = game(seed);
  let t = 0, lowAt = null, milestone = null;
  while (!log.finish && t < max) {
    const s = g.getState(); policy(g, s, t); g.update(H); t += H;
    const s2 = g.getState();
    if (s2.low && lowAt === null) lowAt = t;
    if (!s2.low && s2.phase !== "ended") lowAt = null;
    if (s2.milestone === 1 && s.milestone === 0) milestone = { zoom: s2.zoom, slow: log.slow.at(-1) };
  }
  return { g, log, t, s: g.getState(), warnLead: log.finish && lowAt !== null ? t - lowAt : null, milestone };
}

/* ---------------- checks ---------------- */
section("One seed, one climb");
{
  const a = makeHosts(mulberry(1)), b = makeHosts(mulberry(1)), c = makeHosts(mulberry(2));
  for (const m of [a, b, c]) m.ensure(30000);
  check(JSON.stringify(a.hosts.slice(0, 30)) === JSON.stringify(b.hosts.slice(0, 30)), "the same seed gives the same first 30 bodies");
  const same = a.hosts.slice(1, 31).filter((h, i) => h.type === c.hosts[i + 1].type && Math.abs(h.bx - c.hosts[i + 1].bx) < 1).length;
  check(same < 5, `two seeds give different climbs (${same} of 30 bodies line up)`);
  const g1 = game(4242).g.getState().hosts.slice(0, 30), g2 = game(4242).g.getState().hosts.slice(0, 30), g3 = game(4243).g.getState().hosts.slice(0, 30);
  check(JSON.stringify(g1) === JSON.stringify(g2) && JSON.stringify(g1) !== JSON.stringify(g3), "the game takes its climb from the seeded api.rng");
  const gap = (i) => a.hosts[i].ba - a.hosts[i - 1].ba, avg = (f, lo, hi) => { let n = 0; for (let i = lo; i < hi; i++) n += f(i); return n / (hi - lo); };
  const g0 = avg(gap, 1, 21), g9 = avg(gap, 60, 80), w0 = avg((i) => a.hosts[i].w, 1, 21), w9 = avg((i) => a.hosts[i].w, 60, 80);
  check(g9 > g0 * 1.25 && w9 > w0 * 1.5, `higher up, the gaps grow (${g0.toFixed(0)} to ${g9.toFixed(0)} px) and the bodies move faster (${w0.toFixed(2)} to ${w9.toFixed(2)} rad/s)`);
  const kinds = new Set(a.hosts.map((h) => h.type));
  check(kinds.size === 3 && a.hosts.every((h, i) => i < 2 || !(h.type === a.hosts[i - 1].type && h.type === a.hosts[i - 2].type)), "beetles, moths and seeds mix, with no three of one kind in a row");
}

section("A throw that keeps the body's motion");
{
  // The same aim, 150 px straight above the beetle, at two points of its walk.
  const land = (wait) => {
    const { g } = game(4242);
    for (let k = 0; k < wait; k++) g.update(H);
    const s = g.getState(), h = s.hosts[0];
    throwAt(g, { x: h.x, alt: h.alt + 150 });
    let p = g.getState().spark; const alt0 = h.alt;
    for (let k = 0; k < 600; k++) { g.update(H); const q = g.getState().spark; if (!q) break; p = q; if (q.alt < alt0 && q.va < 0) break; }
    return { x: p.x, vx: h.vx };
  };
  const { g } = game(4242); let best = { min: null, max: null };
  for (let k = 0; k < 1200; k++) { const v = g.getState().hosts[0].vx; if (!best.min || v < best.min.v) best.min = { k, v }; if (!best.max || v > best.max.v) best.max = { k, v }; g.update(H); }
  const a = land(best.min.k), b = land(best.max.k);
  check(Math.abs(a.x - b.x) >= 40, `the same aim at two beetle phases lands ${Math.abs(a.x - b.x).toFixed(0)} px apart (beetle at ${a.vx.toFixed(0)} and ${b.vx.toFixed(0)} px/s)`);
  const at = { x: 200, alt: 0, vx: 50, va: 30 }, aim = { x: 200, alt: 150 };
  const beetle = launch({ type: "beetle" }, at, aim), still = launch({ type: "beetle" }, { ...at, vx: 0 }, aim), seed = launch({ type: "seed" }, at, aim), moth = launch({ type: "moth" }, at, aim);
  check(Math.abs(beetle.vx - still.vx - 50 * KINDS.beetle.push) < 1e-9 && beetle.va === 150 * K, `a beetle pushes the throw sideways by ${KINDS.beetle.push}× its walk`);
  check(seed.va > beetle.va + 100, `a seed lifts the throw (${seed.va.toFixed(0)} against ${beetle.va.toFixed(0)} px/s up)`);
  check(moth.grav === G / 2 && beetle.grav === G, "from a moth, the spark falls on half gravity");
  const fast = launch({ type: "beetle" }, { ...at, vx: 0 }, { x: 200, alt: 2000 });
  check(Math.abs(fast.va - VMAX) < 1e-9, `the finger's part of a throw is capped at ${VMAX} px/s`);
}
{
  // The flight is ballistic: after 0.5 s the spark is where the throw and gravity put it.
  const { g } = game(7); const s = g.getState(), h = s.hosts[0];
  throwAt(g, { x: h.x + 60, alt: h.alt + 120 }); const f0 = g.getState().spark;
  for (let k = 0; k < 60; k++) g.update(H);
  const f = g.getState().spark, t = f.t, grav = G * KINDS[h.type].grav;
  check(f && Math.abs(f.alt - (f0.alt + f0.va * t - 0.5 * grav * t * t)) < 2 && Math.abs(f.x - (f0.x + f0.vx * t)) < 1, "the spark flies a real arc, with no glide to a target");
}

section("Catches and misses");
{
  const { g, log } = game(4242); g.update(H);
  const s = g.getState(), h = s.hosts[0], l0 = s.light, t0 = s.time;
  throwAt(g, { x: h.x < 210 ? h.x - 150 : h.x + 150, alt: h.alt - 20 });
  check(g.getState().phase === "flight", "a release over empty sky throws the spark");
  until(g, (q) => q.phase === "return"); const mid = g.getState();
  check(mid.misses === 1 && mid.current === 0 && mid.label === "MISS", "it misses, and the spark goes back to the last body");
  until(g, (q) => q.phase === "playing"); const e = g.getState();
  const cost = l0 - e.light - (e.time - t0) * 3;
  check(Math.abs(cost - 15) < 0.2, `a release over empty sky costs ${cost.toFixed(1)} light, apart from the clock`);
  const tap = g.getState().light; g.pointer("down", screen(e, e.hosts[0])); g.pointer("up", screen(e, e.hosts[0])); g.update(H);
  check(g.getState().phase === "playing" && tap - g.getState().light < 0.1, "a tap with no drag throws nothing and costs nothing");
  check(/^\d+ m · Light \d+%$/.test(log.metric), `the metric shows the height and the light ("${log.metric}")`);
}
{
  // An exact throw is a centre catch: PERFECT, a hit-stop, more light, and the streak climbs.
  // Wait 20 s first, so the light is low enough that the refills are not capped at 100.
  const { g, log } = game(99); for (let k = 0; k < 2400; k++) g.update(H);
  const streaks = [], adds = [];
  for (let n = 0; n < 3; n++) {
    const before = g.getState(); throwAt(g, bestAim(before)); const l0 = g.getState().light, t0 = g.getState().time;
    until(g, (q) => q.phase !== "flight");
    const s = g.getState(); streaks.push(s.streak); adds.push(s.light - l0 + (s.time - t0) * 3);
    if (n === 0) check(s.caught === 1 && s.label === "PERFECT" && log.slow.some(([f, d]) => f <= 0.1 && d >= 0.06 && d <= 0.08), `an exact throw is caught: PERFECT, with a 70 ms hit-stop (slow ${JSON.stringify(log.slow.at(-1))})`);
  }
  check(streaks.join() === "1,2,3", `each centre catch in a row raises the streak, and the note with it (${streaks.join(", ")})`);
  check(adds.every((a) => Math.abs(a - 14) < 0.3), `a perfect catch gives 14 light (${adds.map((a) => a.toFixed(1)).join(", ")})`);
}
{
  // Throws aimed off the centre by 0 to 70 px. The test measures each closest pass itself, step by step:
  // a body catches the spark only when the spark passes within 34 px, and the label follows the distance.
  const outcomes = [];
  for (const seed of [99, 4242, 7]) for (const off of [0, 8, 14, 22, 30, 38, 50, 70]) for (const dir of [{ x: 1, alt: 0 }, { x: 0, alt: 1 }]) {
    const { g } = game(seed); g.update(H);
    const s0 = g.getState(), a = bestAim(s0, { x: dir.x * off, alt: dir.alt * off }); if (!a) continue;
    throwAt(g, a); const from = g.getState().hosts[g.getState().current].ba, near = new Map();
    for (let k = 0; k < 1200 && g.getState().phase === "flight"; k++) {
      const s = g.getState(), f = s.spark;
      for (const h of s.hosts) if (h.ba > from + 20) near.set(h.id, Math.min(near.get(h.id) ?? 1e9, Math.hypot(h.x - f.x, h.alt - f.alt)));
      g.update(H);
    }
    const e = g.getState(), closest = Math.min(...near.values());
    outcomes.push({ caught: e.caught === 1, label: e.label, d: e.catchDist, closest, byCatcher: e.caught ? near.get(e.current) : null });
  }
  const label = (d) => (d <= 10 ? "PERFECT" : d <= 16 ? "GOOD" : "CLOSE");
  const ok = outcomes.filter((o) => o.caught ? o.byCatcher < CATCH && Math.abs(o.d - o.byCatcher) < 3 && o.label === label(o.d) : o.closest > CATCH - 3 && o.label === "MISS");
  check(ok.length === outcomes.length, `in ${outcomes.length} throws, a catch happens only within ${CATCH} px, and PERFECT means 10 px or less (${outcomes.length - ok.length} wrong)`);
  const seenLabels = new Set(outcomes.map((o) => o.label));
  check(["PERFECT", "GOOD", "CLOSE", "MISS"].every((l) => seenLabels.has(l)), `the throws give every outcome: ${[...seenLabels].join(", ")}`);
}
{
  // No backward leaps: after one catch, a throw at the body below passes through it.
  const { g } = game(99); g.update(H);
  throwAt(g, bestAim(g.getState())); until(g, (q) => q.phase !== "flight");
  const s = g.getState(), below = s.hosts[0];
  let aim = null; for (let T = 0.3; T <= 1.2 && !aim; T += 0.02) { const c = { ...below }; const h = s.hosts[s.current], k = KINDS[h.type], tp = hostAt(c, s.time + T), vx = (tp.x - h.x) / T, va = (tp.alt - h.alt + 0.5 * G * k.grav * T * T) / T, fx = (vx - h.vx * k.push) / K, fa = (va - (h.type === "seed" ? Math.max(0, h.va) : h.va) * k.carry - k.lift) / K; if (Math.hypot(fx, fa) * K < VMAX * 0.95) aim = { x: h.x + fx, alt: h.alt + fa }; }
  throwAt(g, aim); until(g, (q) => q.phase !== "flight");
  check(g.getState().current === 1 && g.getState().misses === 1, "a body below cannot catch the spark, so there is no going back for light");
}
{
  // A press made while the spark flies is kept: let go after the catch, and the new body throws.
  const { g } = game(99); g.update(H);
  throwAt(g, bestAim(g.getState())); g.update(H); g.update(H);
  g.pointer("down", { x: 210, y: 200 });
  until(g, (q) => q.phase !== "flight", 4000);
  const s = g.getState(), a = bestAim(s);
  g.pointer("move", screen(s, a)); g.pointer("up", screen(s, a));
  check(s.caught === 1 && s.aiming && g.getState().phase === "flight" && g.getState().spark.from === 1, "a press during a flight is kept, and the release after the catch throws from the new body");
}

section("A real clock");
{
  const i = play(4242, idle());
  check(i.log.finish && i.t < 40, `an idle run ends in ${i.t.toFixed(1)} s`);
  check(i.warnLead >= 5, `the low-light heartbeat starts ${i.warnLead?.toFixed(1)} s before the light runs out`);
  check(i.log.finish.unit === "m" && i.log.finish.score === i.s.height && i.log.metric === `${i.s.height} m · Light 0%` && /went out at/.test(i.log.status), `the end is current: "${i.log.metric}", "${i.log.status}"`);
  const { g } = game(4242); g.update(H); const l0 = g.getState().light;
  g.pointer("down", { x: 210, y: 200 }); for (let k = 0; k < 600; k++) g.update(H);
  const held = l0 - g.getState().light;
  check(Math.abs(held - 15) < 0.2 && g.getState().time < 1.2, `holding slows the world to a fifth, but the light still drains ${(held / 5).toFixed(2)} %/s`);
  const t0 = i.s.time; for (let k = 0; k < 200; k++) i.g.update(H);
  check(i.g.getState().time > t0 && i.g.getState().phase === "ended", "after the end the scene keeps moving for the outro");
}

section("Skill matters");
{
  const rows = [1, 4242, 99].map((seed) => ({ seed, e: play(seed, exact()), h: play(seed, human(mulberry(seed * 5 + 3), 7, [0.6, 1.4])), s: play(seed, human(mulberry(seed * 11 + 7), 16, [0.9, 2.2])) }));
  for (const r of rows) {
    check(r.e.s.height >= 2 * r.s.s.height && r.e.s.height > r.h.s.height && r.h.s.height > r.s.s.height, `seed ${r.seed}: exact ${r.e.s.height} m, human ${r.h.s.height} m, sloppy ${r.s.s.height} m`);
    check([r.e, r.h, r.s].every((x) => x.log.finish && x.t >= 30 && x.t <= 400), `seed ${r.seed}: runs end in ${(r.e.t / 60).toFixed(1)}, ${(r.h.t / 60).toFixed(1)} and ${(r.s.t / 60).toFixed(1)} min`);
    check(r.h.milestone && r.h.milestone.zoom && r.h.milestone.slow[1] === 1, `seed ${r.seed}: at 100 m the view pulls back for 1 s in slow motion`);
    check(r.s.s.misses > 0 && r.s.s.caught > 5, `seed ${r.seed}: the sloppy aimer misses ${r.s.s.misses} times in ${r.s.s.caught} catches`);
    check([r.e, r.h, r.s].every((x) => x.warnLead >= 0.3), `seed ${r.seed}: the low-light heartbeat starts ${[r.e, r.h, r.s].map((x) => x.warnLead?.toFixed(1)).join(", ")} s before each end (the bar asks for 0.3 s)`);
  }
}

section("Restarts");
{
  const t0 = performance.now(); for (let k = 0; k < 20; k++) game(4242); const ms = (performance.now() - t0) / 20;
  check(ms < 20, `a new run starts in ${ms.toFixed(1)} ms`);
}

console.log(`\nworlds.borrowed.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
