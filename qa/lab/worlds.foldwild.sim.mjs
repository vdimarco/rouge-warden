// Checks the rules of Foldwild (Small Worlds) with no browser: node qa/lab/worlds.foldwild.sim.mjs
// The game module runs with a stub api and the shell's seeded random. Scripted players turn panels with pointer
// events, the same way a finger does. Exit code 1 on failure.
import createGame, { RULES, speedOf, waitOf } from "../../public/lab/worlds/games/foldwild.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const H = 1 / 120;
const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

// A stub of the shell api. It logs every tone with the game time, and the finish card.
function makeGame(seed) {
  const log = { tones: [], finish: null, finishAt: null, status: "", metric: "", t: 0 };
  const api = { W: 420, H: 680, rng: mulberry(seed), status: (s) => (log.status = s), metric: (s) => (log.metric = s),
    finish: (o) => { log.finish = o; log.finishAt = log.t; }, tone: (f, d, type) => log.tones.push({ t: log.t, f: Math.round(f), d, type }), burst: () => {} };
  const g = createGame(api);
  const step = (seconds = H) => { const n = Math.max(1, Math.round(seconds / H)); for (let i = 0; i < n; i++) { g.update(H); log.t += H; } };
  return { g, log, step };
}

/* ---------------- a solver that sees what a player sees ---------------- */
// It knows each panel's piece (straight or corner) and the ports of panels that the water holds. It does not read the answer.
const BASE = { straight: [1, 3], corner: [0, 1] };
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const portsOf = (kind, r) => BASE[kind].map((d) => (d + r) % 4);
function solve(s) {
  const { cols, rows, tiles, spring, home } = s, seen = new Set(), plan = [];
  const step = (i, d) => { const r = Math.floor(i / cols) + DIR[d][1], c = (i % cols) + DIR[d][0]; return r < 0 || r >= rows || c < 0 || c >= cols ? -1 : r * cols + c; };
  const go = (i, a) => {
    if (seen.has(i)) return false;
    const t = tiles[i];
    const exits = t.locked ? (t.ports.includes(a) ? [t.ports.find((p) => p !== a)] : []) : t.kind === "straight" ? [(a + 2) % 4] : [(a + 1) % 4, (a + 3) % 4];
    seen.add(i);
    for (const o of exits) { plan.push({ i, a, o }); if (i === home.cell && o === home.dir) return true; const j = step(i, o); if (j >= 0 && go(j, (o + 2) % 4)) return true; plan.pop(); }
    seen.delete(i);
    return false;
  };
  return go(spring.cell, spring.dir) ? plan : null;
}
// Clockwise turns that give a panel the two ports it needs, 0 to 3.
function turns(t, a, o) { for (let k = 0; k < 4; k++) { const p = portsOf(t.kind, t.rotation + k); if (p.includes(a) && p.includes(o)) return k; } return -1; }
const tap = (g, x, y) => { g.pointer("down", { x, y }); g.pointer("up", { x, y }); };
const turnBack = (g, x, y) => { g.pointer("down", { x, y }); g.pointer("move", { x: x - 30, y }); g.pointer("up", { x: x - 30, y }); };
// One action of a quick player: fix the first panel on the route, nearest the water first.
function act(g, s) {
  const plan = solve(s); if (!plan) return false;
  for (const p of plan) { const x = s.tiles[p.i]; if (x.locked) continue; const k = turns(x, p.a, p.o); if (k === 0) continue; if (k === 3) turnBack(g, x.x, x.y); else tap(g, x.x, x.y); return true; }
  return false;
}
// A person who works along the path: a first look at each new sheet, a glance at each panel,
// think time before a panel that needs a turn, then taps. Some turns go the wrong way.
function human({ look, glance, think, tapTime, miss, rand }) {
  let next = 0, board = -1, seen = new Set(), thought = new Set();
  return (g, s, t) => {
    if (s.board !== board) { board = s.board; seen = new Set(); thought = new Set(); next = Math.max(next, t + look); }
    if (t < next) return;
    const plan = solve(s); if (!plan) return;
    for (const p of plan) {
      const x = s.tiles[p.i]; if (x.locked) continue;
      if (!seen.has(p.i)) { seen.add(p.i); next = t + glance; return; }
      const k = turns(x, p.a, p.o); if (k === 0) continue;
      if (!thought.has(p.i)) { thought.add(p.i); next = t + think; return; }
      if (rand() < miss ? k !== 3 : k === 3) turnBack(g, x.x, x.y); else tap(g, x.x, x.y);
      next = t + tapTime; return;
    }
  };
}
function run(seed, player, maxT = 900) {
  const { g, log, step } = makeGame(seed);
  while (!log.finish && log.t < maxT) { player && player(g, g.getState(), log.t); step(); }
  return { s: g.getState(), log };
}
const routeKey = (s) => `${s.spring.cell}${s.spring.dir}:${solve(s).map((p) => p.i).join(",")}:${s.home.cell}${s.home.dir}`;

/* ---------------- 1. sheets from the seed ---------------- */
section("Sheets come from the seed (500 seeds)");
{
  let solvable = 0, broken = 0, sizes = new Set();
  const routes = new Set(), layouts = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const s = createGame({ rng: mulberry(seed), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
    if (solve(s)) { solvable++; routes.add(routeKey(s)); }
    if (!s.connected && s.end !== "home") broken++;
    layouts.add(s.tiles.map((t) => t.kind[0] + t.rotation).join("") + s.spring.cell + s.home.cell);
    sizes.add(`${s.cols}x${s.rows}`);
  }
  check(solvable === 500, `every first sheet has a route from the spring to home (${solvable}/500)`);
  check(broken === 500, `no first sheet starts joined (${broken}/500 start broken)`);
  check(routes.size >= 50, `at least 50 different routes (${routes.size})`);
  check(layouts.size === 500, `500 seeds give 500 different sheets (${layouts.size})`);
  const a = createGame({ rng: mulberry(42), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
  const b = createGame({ rng: mulberry(42), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
  check(JSON.stringify(a.tiles) === JSON.stringify(b.tiles) && a.spring.cell === b.spring.cell && a.home.cell === b.home.cell, "one seed always gives the same sheet");
  check(!("solution" in a), "the state does not give the answer");
  // The seeds that started solved before this change.
  for (const seed of [1891, 2354, 3449, 3553]) {
    const { s, log } = run(seed, null, 30);
    check(s.paths === 0 && !s.connected, `seed ${seed} does not start joined, and no path is crossed with no input (${log.t.toFixed(0)} s)`);
  }
}

/* ---------------- 2. several sheets in one run ---------------- */
section("Several sheets in one run");
{
  const { g, log, step } = makeGame(7);
  let before = null, after = null, next = 0;
  while (!log.finish && log.t < 60) {
    const s = g.getState();
    if (log.t >= next) { act(g, s); next = log.t + 0.2; }
    before = s.remaining;
    step();
    const n = g.getState();
    if (n.board === 1) { after = n; break; }
  }
  check(after && after.paths === 1 && !after.over && !log.finish, "after the first sheet the run goes on, with 1 path crossed");
  const gain = after ? after.remaining - before : NaN;
  check(after && gain > RULES.BONUS - 0.3 && gain <= RULES.BONUS, `crossing adds ${RULES.BONUS} s (remaining went up by ${gain.toFixed(2)} s)`);
  check(after && after.transition, "the next sheet slides in");
  // The player can turn a panel on the new sheet while the traveller still walks there.
  const s1 = g.getState(), x = s1.tiles.find((t) => !t.locked);
  tap(g, x.x, x.y);
  const s2 = g.getState();
  check(s2.walking && s2.tiles[x.index].rotation === (x.rotation + 1) % 4, "a tap turns a panel on the new sheet while the traveller walks");
  // The walk lasts HOP seconds of game time. A short slow-motion beat at the crossing makes it a little longer to see.
  const t0 = log.t; while (g.getState().walking) step(H);
  const walk = log.t - t0;
  check(walk >= 1.3 && walk <= 2, `the walk to the next spring takes about 1.5 s (${walk.toFixed(2)} s)`);
}
{
  // A quick player crosses many sheets. Each new sheet must also be solvable and start broken, and they grow.
  const { g, log, step } = makeGame(11);
  const seen = [];
  while (!log.finish && log.t < 400 && g.getState().board < 10) {
    const s = g.getState();
    if (!seen[s.board]) seen[s.board] = { cols: s.cols, rows: s.rows, speed: s.speed, solvable: !!solve(s), broken: s.end !== "home", wait: s.wait };
    act(g, s); step(0.15);
  }
  const ok = seen.filter(Boolean);
  check(ok.length >= 10 && ok.every((b) => b.solvable && b.broken), `sheets 1 to ${ok.length} are each solvable and start broken`);
  check(ok[9].cols * ok[9].rows > ok[0].cols * ok[0].rows, `the sheets grow from ${ok[0].cols}x${ok[0].rows} to ${ok[9].cols}x${ok[9].rows}`);
  check(ok[9].speed > ok[0].speed * 2 && speedOf(9) > speedOf(0) && waitOf(9) < waitOf(0), `the water gets faster (${ok[0].speed.toFixed(2)} to ${ok[9].speed.toFixed(2)} panels/s) and waits less`);
}

/* ---------------- 3. the water races you ---------------- */
section("The water races the player");
{
  const { g, log, step } = makeGame(3);
  const leaks = [], spills = [];
  let warnAt = null, last = g.getState();
  while (!log.finish && log.t < 200) {
    step();
    const s = g.getState();
    if (s.leak && !last.leak) warnAt = log.t;
    if (s.spills > last.spills) { spills.push({ t: log.t, drop: last.remaining - s.remaining, warned: warnAt === null ? 0 : log.t - warnAt }); warnAt = null; }
    last = s;
  }
  const s = g.getState();
  check(spills.length > 0, `with no input the water spills (${spills.length} spills)`);
  check(spills.length > 0 && Math.abs(spills[0].drop - RULES.SPILL - H) < 0.02, `a spill costs ${RULES.SPILL} s (the first one took ${spills[0] && spills[0].drop.toFixed(2)} s)`);
  check(spills.every((x) => x.warned >= RULES.WARN - 1e-9), `the edge warns at least ${RULES.WARN} s before every spill (shortest ${Math.min(...spills.map((x) => x.warned)).toFixed(3)} s)`);
  check(RULES.WARN >= 0.3, "the warning is at least 0.3 s long");
  const warnTones = log.tones.filter((x) => x.f === 988 && x.type === "square");
  check(warnTones.length >= spills.length, `each warning plays a sound (${warnTones.length} warning tones for ${spills.length} spills)`);
  check(!!log.finish && s.paths === 0 && log.finishAt <= RULES.START, `with no input the run ends with 0 paths by ${RULES.START} s (at ${log.finishAt && log.finishAt.toFixed(1)} s)`);
  check(log.finish && log.finish.score === 0 && log.finish.unit === "paths" && log.finish.win === false, "the finish card has score 0, unit 'paths' and win false");
}
{
  // A panel that holds more than half its water does not turn.
  const { g, step } = makeGame(5);
  let s = g.getState();
  for (let i = 0; i < 400 && !s.tiles.some((t) => t.water > 0.5); i++) { act(g, s); step(0.25); s = g.getState(); }
  const wet = s.tiles.find((t) => t.water > 0.5);
  check(!!wet && wet.locked, "a panel with water above 0.5 is locked");
  if (wet) {
    const r = wet.rotation, moves = s.moves;
    tap(g, wet.x, wet.y); turnBack(g, wet.x, wet.y); g.key("down", String(wet.index + 1));
    const n = g.getState();
    check(n.tiles[wet.index].rotation === r && n.moves === moves, "tap, drag and keys do not turn it");
  }
}
{
  // Each panel the water enters plays the next note of the scale.
  const { g, log, step } = makeGame(9);
  let s = g.getState();
  while (s.board === 0 && log.t < 60) { act(g, s); step(0.2); s = g.getState(); }
  const scale = SCALE.map(Math.round);
  const notes = log.tones.filter((x) => x.type === "sine" && x.d === 0.24 && scale.includes(x.f)).map((x) => x.f);
  let run = 0, best = 0;
  for (let i = 1; i < notes.length; i++) { run = notes[i] > notes[i - 1] ? run + 1 : 0; best = Math.max(best, run); }
  check(best >= 4, `the water plays rising notes as it enters panels (longest rising run ${best + 1} notes)`);
}

/* ---------------- 4. press, preview, cancel ---------------- */
section("Press to preview, lift outside to cancel");
{
  const { g } = makeGame(13);
  const s = g.getState(), t = s.tiles[4];
  g.pointer("down", { x: t.x, y: t.y });
  check(g.getState().held && g.getState().held.i === 4, "pressing a panel shows a preview of the turn");
  g.pointer("move", { x: t.x, y: t.y + t.size * 1.2 }); g.pointer("up", { x: t.x, y: t.y + t.size * 1.2 });
  let n = g.getState();
  check(n.tiles[4].rotation === t.rotation && n.moves === 0, "lifting outside the panel cancels the turn");
  tap(g, t.x, t.y); n = g.getState();
  check(n.tiles[4].rotation === (t.rotation + 1) % 4 && n.moves === 1, "a tap turns the panel clockwise");
  turnBack(g, t.x, t.y); n = g.getState();
  check(n.tiles[4].rotation === t.rotation && n.moves === 2, "a drag to the left turns it back");
  g.pointer("down", { x: t.x, y: t.y }); g.pointer("cancel", { x: t.x, y: t.y }); n = g.getState();
  check(n.tiles[4].rotation === t.rotation && !n.held, "a cancelled pointer turns nothing");
}
{
  // Joining the river and breaking it each have their own sound.
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const { g, log, step } = makeGame(seed);
    const s = g.getState(), plan = solve(s), first = plan[0], x = s.tiles[first.i], k = turns(x, first.a, first.o);
    if (s.route.length !== 0 || k !== 1) continue;
    found = true;
    tap(g, x.x, x.y); step(0.2);
    const joined = log.tones.map((t) => t.f);
    check(g.getState().route.length > 0 && joined.includes(659) && joined.includes(880), "a turn that joins the river plays a rising pair of notes");
    log.tones.length = 0;
    tap(g, x.x, x.y); step(0.2);
    const broke = log.tones.map((t) => t.f);
    check(g.getState().route.length === 0 && broke.includes(330) && broke.includes(247), "a turn that breaks the river plays a falling pair of notes");
  }
  check(found, "found a sheet to test the join and break sounds");
}

/* ---------------- 5. the last ten seconds, the end and the outro ---------------- */
section("The last ten seconds, the end, and the outro");
{
  const { g, log, step } = makeGame(21);
  while (g.getState().remaining > 10.5 && !log.finish) step(0.1);
  // Join the first part of the river so that no spill changes the clock in this window.
  const t0 = log.t; log.tones.length = 0;
  let urgentSeen = false;
  while (!log.finish) { step(); if (g.getState().urgent) urgentSeen = true; }
  const ticks = log.tones.filter((x) => x.type === "square" && (x.f === 880 || x.f === 1175));
  check(urgentSeen, "the last ten seconds show as urgent");
  check(ticks.length >= 6, `the last ten seconds tick (${ticks.length} ticks in ${(log.t - t0).toFixed(1)} s)`);
}
{
  // The finish card after a good run, and the outro: the shell keeps calling update() for 1.6 s at half speed.
  const { g, log, step } = makeGame(17);
  while (!log.finish && g.getState().paths < 3) { act(g, g.getState()); step(0.15); }
  while (!log.finish) step(0.1);
  const f = log.finish;
  check(f.score === 3 && f.unit === "paths" && f.win === true, `a run with 3 paths scores 3 paths (${f.score} ${f.unit})`);
  check(/3 paths/.test(f.detail) && /river joined/.test(f.detail), `the detail says how far the last river got: "${f.detail}"`);
  check(!/[!—]/.test(f.title + f.detail), "the finish text has no exclamation marks or long dashes");
  const s0 = g.getState(), n0 = log.tones.length;
  for (let i = 0; i < 192; i++) { g.update(H / 2); log.t += H / 2; }
  const s1 = g.getState(), song = log.tones.slice(n0).filter((x) => x.d === 0.5);
  check(s1.over && s1.outro > 0.79 && s1.camera.s < s0.camera.s * 0.6, `the outro pulls back to show every sheet (camera scale ${s0.camera.s.toFixed(2)} to ${s1.camera.s.toFixed(2)})`);
  check(song.length === 3 && song[0].f < song[1].f && song[1].f < song[2].f, `a light runs down the river and rings a rising note at each of the 3 homes (${song.map((x) => x.f).join(", ")} Hz)`);
}

/* ---------------- 6. run length for scripted people ---------------- */
section("Run length for scripted people");
{
  const people = {
    beginner: { look: 3, glance: 0.6, think: 1.5, tapTime: 0.4, miss: 0.2 },
    casual: { look: 2, glance: 0.4, think: 1, tapTime: 0.3, miss: 0.1 },
    good: { look: 1.5, glance: 0.25, think: 0.7, tapTime: 0.22, miss: 0.05 },
  };
  const results = {};
  for (const [name, p] of Object.entries(people)) {
    const rs = [1, 2, 3, 4, 5, 6].map((seed) => run(seed, human({ ...p, rand: mulberry(seed * 31) }), 900));
    results[name] = { paths: rs.map((r) => r.s.paths), time: rs.map((r) => r.log.finishAt) };
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(`       ${name}: paths ${results[name].paths.join(" ")} (mean ${avg(results[name].paths).toFixed(1)}), run ${results[name].time.map((t) => (t / 60).toFixed(1)).join(" ")} min`);
    check(results[name].time.every((t) => t >= 60 && t <= 360), `a ${name} run lasts 1 to 6 minutes`);
  }
  const mean = (n) => results[n].paths.reduce((a, b) => a + b, 0) / 6;
  check(mean("good") > mean("casual") && mean("casual") > mean("beginner"), "more skill crosses more paths");
}

/* ---------------- 7. drawing does not throw ---------------- */
section("Drawing");
{
  // A 2D context that accepts every call, so draw() runs in Node.
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k.startsWith("create") ? () => grad : () => {}), set: (o, k, v) => ((o[k] = v), true) });
  const { g, log, step } = makeGame(23);
  let ok = true;
  const draw = () => { try { g.draw(ctx, log.t); } catch (e) { ok = false; console.log("       " + e.stack.split("\n").slice(0, 3).join("\n       ")); } };
  draw();
  const s = g.getState(), x = s.tiles[0];
  g.pointer("down", { x: x.x, y: x.y }); draw(); g.pointer("move", { x: x.x - 40, y: x.y }); draw(); g.pointer("up", { x: x.x - 40, y: x.y });
  for (let i = 0; i < 300 && !log.finish; i++) { if (i % 3 === 0) act(g, g.getState()); step(0.1); draw(); }
  while (!log.finish) { step(0.5); draw(); }
  for (let i = 0; i < 20; i++) { g.update(0.05); draw(); }
  check(ok, "draw() runs at the start, during a press, the flow, a spill, a crossing, the end and the outro");
}

console.log(`\nworlds.foldwild.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
