// Checks the rules of Threadwake with no browser: node qa/lab/worlds.threadwake.sim.mjs
// The rope swing, the reach ring, the seeded tower, the rising mist, crowns, lights and the ghost.
// Scripted players: an expert who plans each release, a player who never lets go, and an idle player. Exit code 1 on failure.
import createGame, { grabTarget, makeTower, RULES } from "../../public/lab/worlds/games/threadwake.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const H = 1 / 120, { G, REACH, PX, CROWN, START } = RULES;
const speed = (p) => Math.hypot(p.vx, p.vy);

// A store in memory, so the ghost can be saved and read back as in a browser.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() };

// The shell's api with no screen and no sound. It keeps the status, the metric, the finish and each call to slow().
function game(seed, best = 0) {
  const log = { slow: [] };
  const api = { W: 420, H: 680, rng: mulberry(seed), seed, daily: false, best, status: (s) => (log.status = s), metric: (s) => (log.metric = s), finish: (o) => (log.finish = o),
    tone() {}, burst() {}, noise() {}, chord() {}, slow: (f, s) => log.slow.push([f, s]), shake() {}, buzz() {} };
  return { g: createGame(api), log };
}

/* ---------------- players ---------------- */
// Predicts a free flight the way the game moves it: gravity, light air drag and soft walls.
function flight(p, secs = 1.4) {
  const q = { ...p }, out = [];
  for (let t = 0; t < secs; t += H) {
    q.vy += G * H; q.vx *= Math.exp(-0.02 * H); q.x += q.vx * H; q.y += q.vy * H;
    if ((q.x < 14 && q.vx < 0) || (q.x > 406 && q.vx > 0)) { q.vx = -q.vx * 0.5; q.x = Math.max(14, Math.min(406, q.x)); }
    out.push({ ...q });
  }
  return out;
}
// The flower a hold would grab at q, looked up among the flowers near the current one.
function grabNear(q, s, skip) {
  const lo = Math.max(0, s.attached - 3), near = s.flowers.slice(lo, s.attached + 7), i = grabTarget(q, near, REACH - 25, skip - lo);
  return i < 0 ? -1 : i + lo;
}
// An expert: it lets go when the predicted flight brings a higher flower into the ring, then grabs that flower.
function expert() {
  let target = -1, n = 0;
  return (g, s) => {
    const p = s.player;
    if (!s.holding && (s.ground || s.attached < 0)) {
      const i = grabTarget(p, s.flowers, REACH, s.skip);
      if (s.ground || (i >= 0 && (i === target || p.vy > 350))) { g.pointer("down"); target = -1; }
      return;
    }
    if (s.holding && s.attached >= 0 && s.taut && ++n % 2 === 0) {
      const path = flight(p);
      for (let k = 0; k < path.length; k += 2) {
        const q = path[k], i = grabNear(q, s, q.vy < 0 ? s.attached : -1);
        if (i > s.attached && s.flowers[i].y < s.flowers[s.attached].y - 40) { target = i; g.pointer("up"); return; }
      }
    }
  };
}
const never = () => (g, s) => { if (!s.holding) g.pointer("down"); };
const idle = () => () => {};
// Plays one run. It notes when the mist warning starts, the first crown, and each light.
function play(seed, policy, max = 600) {
  const { g, log } = game(seed);
  let t = 0, warnAt = null, crown = null, lightPush = [];
  while (!log.finish && t < max) {
    const s = g.getState();
    policy(g, s, t);
    g.update(H); t += H;
    const s2 = g.getState();
    if (s2.warn > 0 && warnAt === null) warnAt = t;
    if (s2.warn === 0) warnAt = null;
    if (s2.crowns === 1 && s.crowns === 0) crown = { mistGap: s2.mist - (START.y - CROWN), slow: log.slow.length, time: s2.splits[0], ghostSplit: s2.split };
    if (s2.lights > s.lights) lightPush.push(s2.mist - s.mist);
  }
  return { g, log, t, s: g.getState(), warnLead: log.finish && warnAt !== null ? t - warnAt : null, crown, lightPush };
}

/* ---------------- checks ---------------- */
section("One seed, one tower");
{
  const a = makeTower(mulberry(1)), b = makeTower(mulberry(1)), c = makeTower(mulberry(2));
  for (const t of [a, b, c]) t.ensure(-8000);
  check(JSON.stringify([a.flowers, a.lights]) === JSON.stringify([b.flowers, b.lights]), `the same seed gives the same tower (${a.flowers.length} flowers, ${a.lights.length} lights)`);
  const same = a.flowers.slice(0, 30).filter((f, i) => Math.abs(f.x - c.flowers[i].x) < 1).length;
  check(same < 5, `two seeds give different towers (${same} of 30 flowers line up)`);
  const g1 = game(4242).g.getState().flowers, g2 = game(4242).g.getState().flowers, g3 = game(4243).g.getState().flowers;
  check(JSON.stringify(g1) === JSON.stringify(g2) && JSON.stringify(g1) !== JSON.stringify(g3), "the game takes its tower from the seeded api.rng");
  const gaps = a.flowers.slice(1).map((f, i) => Math.hypot(f.x - a.flowers[i].x, f.y - a.flowers[i].y));
  check(Math.min(...gaps) > REACH, `every gap is wider than the reach ring, so each climb needs a release (narrowest ${Math.min(...gaps).toFixed(0)} px)`);
  check(a.flowers.every((f) => f.x >= 64 && f.x <= 356), "every flower leaves room for a swing beside it");
  const crowns = a.flowers.filter((f) => f.crown > 0);
  check(crowns.length >= 6 && crowns.every((f) => f.y <= START.y - f.crown * CROWN && f.y > START.y - f.crown * CROWN - 300), `a crown flower about every ${CROWN / PX} m (${crowns.length} crowns in ${((START.y - a.flowers.at(-1).y) / PX).toFixed(0)} m)`);
  check(a.lights.length > a.flowers.length * 0.35, `lights hang between the flowers (${a.lights.length})`);
}

section("A rope you swing on");
{
  const { g } = game(4242);
  g.pointer("down");
  let s = g.getState();
  check(s.attached === 0 && s.taut, "a hold on the island grabs the first flower");
  const f = s.flowers[0], rope = s.rope;
  let crossings = 0, side = s.player.x > f.x, drift = 0;
  for (let t = 0; t < 3; t += H) {
    g.update(H); s = g.getState();
    if (s.player.x > f.x !== side) { crossings++; side = !side; }
    if (s.taut) drift = Math.max(drift, Math.abs(Math.hypot(s.player.x - f.x, s.player.y - f.y) - rope));
  }
  check(crossings >= 2, `held with no other input, the creature swings across the flower's x ${crossings} times in 3 s`);
  check(drift < 1, `the thread keeps its length while it is tight (it drifts ${drift.toFixed(2)} px)`);
}
{
  const { g } = game(4242);
  g.pointer("down");
  let s = g.getState(), side = s.player.x > s.flowers[0].x;
  for (let k = 0; k < 600; k++) { g.update(H); s = g.getState(); if (s.player.x > s.flowers[0].x !== side) break; }
  const before = { ...s.player };
  g.pointer("up"); g.update(H); s = g.getState();
  check(s.attached < 0 && speed(s.player) > 300, `a release at the bottom of the swing leaves at ${speed(s.player).toFixed(0)} px/s`);
  check(Math.abs(s.player.vx - before.vx) < 1 && Math.abs(s.player.vy - before.vy - G * H) < 1, "the release keeps the swing's velocity");
}

section("The reach ring");
{
  const o = { x: 0, y: 0 };
  check(grabTarget(o, [{ x: 300, y: 0 }]) === -1, "a flower 300 px away cannot be grabbed");
  check(grabTarget(o, [{ x: 0, y: 199 }]) === 0, "a flower 199 px away can be grabbed");
  check(grabTarget(o, [{ x: 150, y: 0 }, { x: 0, y: -120 }]) === 1, "a hold grabs the nearest flower in the ring");
  check(grabTarget(o, [{ x: 150, y: 0 }, { x: 0, y: -120 }], REACH, 1) === 0, "a hold skips the flower you let go of");
  // In a run: wait for a moment in the air when the nearest flower is between 200 and 300 px away, then hold.
  const { g } = game(99), bot = expert();
  let s = g.getState(), found = null;
  for (let t = 0; t < 120 && !found; t += H) {
    bot(g, s, t); g.update(H); s = g.getState();
    const d = s.flowers.map((f) => Math.hypot(f.x - s.player.x, f.y - s.player.y)), near = Math.min(...d);
    if (!s.holding && s.attached < 0 && !s.ground && near > REACH + 2 && near < 300) found = near;
  }
  check(found !== null, `the run reaches a point in the air where the nearest flower is ${found?.toFixed(0)} px away`);
  if (found) {
    g.pointer("down"); const t0 = g.getState().time; g.update(H); s = g.getState();
    check(s.attached < 0 && s.reaching, "a hold there grabs nothing, and the reach ring waits for a flower");
    check(Math.abs(s.time - t0 - 0.35 * H) < 1e-9, "time slows to 35% while the hold waits");
    let grabbed = -1;
    for (let k = 0; k < 400 && grabbed < 0; k++) { g.update(H); grabbed = g.getState().attached; }
    s = g.getState();
    const d = grabbed >= 0 ? Math.hypot(s.flowers[grabbed].x - s.player.x, s.flowers[grabbed].y - s.player.y) : 0;
    check(grabbed < 0 || d <= REACH + 1, `the held grab happens only once a flower is in reach (${grabbed < 0 ? "none came" : d.toFixed(0) + " px"})`);
  }
}
{
  // Let go slowly, high on the side away from the next flower, and hold again at once. The hold skips the flower you
  // let go of while the creature rises, and grabs it again as the creature falls back into reach.
  const tries = [];
  for (const seed of [1, 2, 3, 7, 99, 4242]) {
    const { g } = game(seed);
    g.pointer("down");
    let s = g.getState();
    const old = s.attached, f = s.flowers[old], away = Math.sign(f.x - s.flowers[old + 1].x);
    let k = 0;
    for (; k < 2400; k++) { g.update(H); s = g.getState(); if (k > 60 && s.player.vy < -30 && s.player.vy > -280 && s.player.y < f.y + 120 && Math.sign(s.player.x - f.x) === away) break; }
    if (k === 2400) continue;
    g.pointer("up"); g.update(H); g.pointer("down"); s = g.getState();
    const skipped = s.attached < 0 && s.skip === old && s.reaching;
    let vyAtGrab = null;
    for (let j = 0; j < 2400 && s.attached < 0 && !s.ended; j++) { g.update(H); s = g.getState(); if (s.attached >= 0) vyAtGrab = s.player.vy; }
    tries.push({ seed, skipped, regrab: s.attached === old, vyAtGrab });
  }
  check(tries.length >= 2 && tries.every((r) => r.skipped), `while you rise from the flower you let go of, a hold does not grab it again (${tries.length} seeds)`);
  check(tries.some((r) => r.regrab) && tries.filter((r) => r.regrab).every((r) => r.vyAtGrab >= 0), `once the creature falls, the same hold grabs that flower again (seeds ${tries.filter((r) => r.regrab).map((r) => r.seed).join(", ")})`);
}

section("A climb that can end");
{
  const n = play(4242, never());
  check(n.log.finish && n.t < 60, `a player who never lets go ends in ${n.t.toFixed(1)} s`);
  check(n.log.finish?.unit === "m" && n.log.finish.score === n.s.height && n.s.height > 0, `the score is the height in metres (${n.log.finish?.score} m), and getState reports it`);
  check(/next crown was \d+ m above you/.test(n.log.finish?.detail || ""), `the end says how close the next crown was ("${n.log.finish?.detail}")`);
  check(n.warnLead >= 0.3, `the mist warning starts ${n.warnLead?.toFixed(2)} s before the end`);
  const i = play(4242, idle());
  check(i.log.finish && i.t < 60, `an idle player ends in ${i.t.toFixed(1)} s, when the mist covers the island`);
}
const runs = [1, 4242, 99].map((seed) => ({ seed, ...play(seed, expert()) }));
for (const r of runs) {
  check(r.s.crowns >= 1 && r.log.finish && r.t >= 60 && r.t <= 400, `seed ${r.seed}: an expert climbs ${r.s.height} m past ${r.s.crowns} crowns, and the mist ends the run at ${(r.t / 60).toFixed(1)} min`);
  check(r.warnLead >= 0.3, `seed ${r.seed}: the warning starts ${r.warnLead?.toFixed(2)} s before the mist takes the creature`);
  check(r.crown && r.crown.mistGap >= 600 && r.crown.slow >= 1, `seed ${r.seed}: the first crown pushes the mist ${(r.crown?.mistGap / PX).toFixed(0)} m below it and slows time for the peak`);
  check(/^\d+ m · \d+ lights?$/.test(r.log.metric) && r.log.metric.startsWith(`${r.s.height} m`), `seed ${r.seed}: the metric at the end is current ("${r.log.metric}")`);
}
{
  const pushes = runs.flatMap((r) => r.lightPush), lights = runs.reduce((n, r) => n + r.s.lights, 0);
  check(lights >= 3, `the expert catches ${lights} lights in three runs`);
  check(pushes.length > 0 && pushes.every((d) => d > 60 && d <= 70), `each light pushes the mist down (${pushes.map((d) => d.toFixed(0)).join(", ")} px)`);
}

section("Your ghost");
{
  const r = runs.find((x) => x.seed === 4242), saved = JSON.parse(mem.get("threadwake-ghosts") || "{}")["s4242"];
  check(saved && saved.m === r.s.height && saved.splits.length === r.s.crowns, `the best run on a seed is kept (${saved?.m} m, ${saved?.splits.length} crown splits)`);
  check(saved && Math.abs(saved.pts.length / 2 - r.t / 0.1) < 3, `its position is kept every 0.1 s (${saved ? saved.pts.length / 2 : 0} points in ${r.t.toFixed(1)} s)`);
  check(game(4242).g.getState().ghost === true && game(4243).g.getState().ghost === false, "a new run on the same seed races that ghost, and another seed has none");
  play(4242, never());
  check(JSON.parse(mem.get("threadwake-ghosts"))["s4242"].m === r.s.height, "a lower run does not replace the ghost");
  check(r.crown.ghostSplit === null, "a run with no ghost splits shows no split at the crown");
  const again = play(4242, expert());
  check(again.crown && Math.abs(again.crown.ghostSplit) < 0.01, `the same climb again reaches the first crown ${Math.abs(again.crown?.ghostSplit ?? NaN).toFixed(2)} s from its ghost`);
  for (const seed of [11, 12, 13, 14, 15]) play(seed, never());
  check(Object.keys(JSON.parse(mem.get("threadwake-ghosts"))).length <= 4, "the store keeps the ghosts of the four latest seeds only");
}

section("Restarts");
{
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) game(4242);
  const ms = (performance.now() - t0) / 20;
  check(ms < 20, `a new run starts in ${ms.toFixed(1)} ms`);
}

console.log(`\nworlds.threadwake.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
