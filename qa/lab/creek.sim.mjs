// Checks the river and the canoe of Up the Creek with no browser: node qa/lab/creek.sim.mjs
// Strokes turn the right way, J-strokes hold a line, eddies turn the water back, a fast crossing with no brace tips
// you and a brace keeps you up, eddies can be caught, a river can be run, and nothing ends inside a rock or a bank.
// Exit code 1 on failure.
import { makeRiver, FINISH } from "../../public/lab/creek/river.js";
import { newCanoe, act, step, H, C, closestMiss } from "../../public/lab/creek/canoe.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const R2D = 180 / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------- 1. strokes in still water ---------------- */
section("Strokes, in still water");
const still = makeRiver(1, { still: true, rocks: [] });
function paddle(n, { j = 0, alt = false, side = 1, every = 1 } = {}) {
  const c = newCanoe(still, { x: 0, y: 50, psi: 0 });
  for (let i = 0; i < n; i++) {
    const s = alt ? (i % 2 ? -1 : 1) : side;
    act(c, { type: "stroke", side: s, power: 1 });
    for (let k = 0; k < 120 * every; k++) { step(c, still); if (j && k === 18) act(c, { type: "j", side: s, power: j }); }
  }
  return c;
}
{
  const one = paddle(1);
  check(one.psi * R2D < -8 && one.psi * R2D > -12, `one stroke on the right turns the bow 8° to 12° left (${(one.psi * R2D).toFixed(1)}°)`);
  const ten = paddle(10);
  check(ten.psi * R2D <= -60, `ten strokes on the right turn it 60° or more to the left (${(ten.psi * R2D).toFixed(0)}°)`);
  const left = paddle(1, { side: -1 });
  check(left.psi * R2D > 8, "a stroke on the left turns the bow right");
  const jay = paddle(10, { j: 1 });
  check(Math.abs(jay.psi * R2D) < 10 && jay.y - 50 > 10, `with a J after each stroke it holds within 10° and moves on (${(jay.psi * R2D).toFixed(1)}°, ${(jay.y - 50).toFixed(1)} m)`);
  const alt = paddle(10, { alt: true });
  check(Math.abs(alt.psi * R2D) < 5 && Math.hypot(alt.vx, alt.vy) > 1.8, `strokes on both sides go straight at ${Math.hypot(alt.vx, alt.vy).toFixed(1)} m/s`);
  const back = newCanoe(still, { x: 0, y: 50, psi: 0 });
  act(back, { type: "back", side: 1, power: 1 });
  for (let k = 0; k < 60; k++) step(back, still);
  check(back.vy < 0 && back.psi > 0, "a back stroke on the right moves you back and turns the bow right");
}

/* ---------------- 2. the river ---------------- */
section("The river");
{
  const r = makeRiver(7), f = {};
  check(r.rocks.length >= 10 && r.targets.length >= 6, `${r.rocks.length} rocks, ${r.targets.length} eddies worth catching`);
  let upstream = 0, around = true;
  for (const q of r.targets) {
    r.flow(q.ex, q.ey, f);
    if (f.vx * q.tx + f.vy * q.ty < -0.2 * q.U) upstream++;
    r.flow(q.x + (q.R + 0.3) * q.ty, q.y - (q.R + 0.3) * q.tx, f);
    if (f.vx * q.tx + f.vy * q.ty < q.U) around = false;
  }
  check(upstream === r.targets.length, "in every eddy's core the water runs back upstream");
  check(around, "beside every rock the water runs faster than the current");
  r.flow(r.targets[0].x, r.targets[0].y, f);
  check(f.rock && f.vx === 0 && f.vy === 0, "inside a rock there is no flow");
}

/* ---------------- 3. eddy lines ---------------- */
// Drive into the eddy behind rock q from one side, at `drive` m/s through the water, with or without a brace.
// Once inside, stroke the bow round to face upstream, as a paddler would.
function entry(r, q, side, brace, drive) {
  const down = Math.atan2(q.tx, q.ty), k = side * (q.hw + 1.5), s = q.sc - q.hl * 0.5;
  const x = q.x + s * q.tx + k * q.ty, y = q.y + s * q.ty - k * q.tx, psi = down - side * (55 / R2D);
  const c = newCanoe(r, { x, y, psi }), f = r.flow(x, y), ev = [], up = Math.atan2(-q.tx, -q.ty);
  c.vx = f.vx + Math.sin(psi) * drive; c.vy = f.vy + Math.cos(psi) * drive;
  let last = -9;
  for (let i = 0; i < 120 * 6; i++) {
    const inside = r.eddyAt(c.x, c.y) === q;
    c.brace = inside ? 0 : brace;
    if (inside && c.t - last > 0.5) {
      const err = wrap(up - c.psi);
      if (Math.abs(err) > 0.4) { act(c, { type: "stroke", side: err > 0 ? -1 : 1, power: 0.8 }); last = c.t; }
    }
    step(c, r, ev);
    if (ev.some((e) => e.k === "capsize")) return "capsize";
    if (ev.some((e) => e.k === "eddy")) return "caught";
  }
  return "neither";
}
section("Eddy lines");
{
  const n = { none: 0, braced: 0 }, cap = { none: 0, braced: 0 }, got = { none: 0, braced: 0 };
  for (const seed of [3, 7, 11, 23, 42, 99]) {
    const r = makeRiver(seed);
    for (const q of r.targets) for (const side of [-1, 1]) {
      const a = entry(r, q, side, 0, 2), b = entry(r, q, side, -side, 2);
      n.none++; n.braced++;
      if (a === "capsize") cap.none++; if (a === "caught") got.none++;
      if (b === "capsize") cap.braced++; if (b === "caught") got.braced++;
    }
  }
  const pc = (a, b) => Math.round((100 * a) / b);
  console.log(`  ${n.none} fast entries each: no brace ${pc(cap.none, n.none)}% capsize, ${pc(got.none, n.none)}% caught; braced ${pc(cap.braced, n.braced)}% capsize, ${pc(got.braced, n.braced)}% caught`);
  check(cap.none >= 3 * Math.max(1, cap.braced) && pc(cap.none, n.none) >= 15, "a fast crossing with no brace tips you at least three times as often as a braced one");
  check(pc(cap.braced, n.braced) <= 8, "a brace keeps you up");
  check(pc(got.braced, n.braced) >= 20, "a braced entry catches the eddy at least one time in five");
}

/* ---------------- 4. runs ---------------- */
// follows the middle of the river: aim 10 m ahead, stroke on the side that turns you there
function follower(river) {
  let last = -9, alt = 1;
  return (c) => {
    if (c.t - last < 0.5) return [];
    last = c.t;
    const ty = c.y + 10, tx = river.c(ty), err = wrap(Math.atan2(tx - c.x, ty - c.y) - c.psi);
    if (Math.abs(err) > 0.25) return [{ type: "stroke", side: err > 0 ? -1 : 1, power: 1 }];
    alt = -alt;
    return [{ type: "stroke", side: alt, power: 0.8 }];
  };
}
function strokesOnly() {
  let last = -9, alt = 1;
  return (c) => { if (c.t - last < 0.5) return []; last = c.t; alt = -alt; return [{ type: "stroke", side: alt, power: 1 }]; };
}
function run(seed, pilot, maxS = 300) {
  const r = makeRiver(seed), c = newCanoe(r), p = pilot(r), ev = [];
  let inside = 0, outside = 0, nan = 0;
  while (!c.done && c.t < maxS) {
    for (const a of p(c)) act(c, a);
    step(c, r, ev);
    if (!Number.isFinite(c.x + c.y + c.vx + c.vy + c.psi + c.phi)) { nan++; break; }
    if (c.swim > 0) continue;
    for (const q of r.rocks) if (Math.hypot(c.x - q.x, c.y - q.y) < q.R - 0.05) inside++;
    if (Math.abs((c.x - r.c(c.y)) / r.b(c.y)) > 1.02) outside++;
  }
  return { r, c, ev, inside, outside, nan };
}
section("Running the river");
{
  const seeds = [3, 7, 11, 23, 42, 99, 2026, 5];
  const runs = seeds.map((s) => run(s, follower));
  const done = runs.filter((x) => x.c.done);
  console.log("  " + runs.map((x) => `${x.c.done ? Math.round(x.c.t) + " s" : "stuck"}/${x.c.swims} swims`).join(", "));
  check(done.length >= 6, `a paddler who follows the middle gets down ${done.length} of ${seeds.length} rivers`);
  check(done.every((x) => x.c.t < 180), "each of those runs takes under 3 minutes");
  const sOnly = seeds.map((s) => run(s, strokesOnly));
  check(sOnly.every((x) => x.c.caught.size <= 1), `strokes with no steering catch at most one eddy (${sOnly.map((x) => x.c.caught.size).join(", ")})`);
  const all = runs.concat(sOnly);
  check(all.every((x) => x.nan === 0), "no NaN");
  check(all.every((x) => x.inside === 0), "the canoe never ends a step inside a rock");
  check(all.every((x) => x.outside === 0), "the canoe never ends a step outside the banks");
  const miss = closestMiss(runs[0].c, runs[0].r);
  check(miss == null || (miss.d >= 0 && miss.index >= 0), "the end card can say how close you came to an eddy you missed");
}

/* ---------------- 5. capsize and reset ---------------- */
section("Capsize and reset");
{
  const r = makeRiver(7), c = newCanoe(r), ev = [];
  c.phi = C.CAPSIZE + 0.01;
  step(c, r, ev);
  check(ev.some((e) => e.k === "capsize") && c.swim > 0, "past 50° of roll you capsize");
  let t = 0;
  while (c.swim > 0 && t < 5) { step(c, r, ev); t += H; }
  check(ev.some((e) => e.k === "reset") && c.phi === 0 && t < 2, `you are back in the canoe in ${t.toFixed(1)} s`);
}

console.log(`\ncreek.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
