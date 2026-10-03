// Checks the river and the canoe of Up the Creek with no browser: node qa/lab/creek.sim.mjs
// Strokes turn the right way, J-strokes hold a line, eddies turn the water back, a fast crossing with no brace tips
// you and a brace keeps you up, eddies can be caught, a river can be run, and nothing ends inside a rock or a bank.
// "Rocks hit" counts knocks, a swim puts you back a few metres upstream, and a capsize comes after a warning that
// leaves time to brace. A log jam stops you above the put-in, a canoe that paddles out of an eddy gets out, and the
// first eddy comes up fast. Over the ledge, straight is a boof and crooked is a swim. Exit code 1 on failure.
import { makeRiver, FINISH, JAM } from "../../public/lab/creek/river.js";
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
// Once inside, stroke the bow round to face upstream, as a paddler would. A canoe that misses the eddy and drifts on
// to the ledge at the foot of the rapid stops there: the ledge is tested on its own below.
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
    if (r.lip(c.x, c.y) > -2) return "neither";
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
  // "Rocks hit" on the end card counts the knocks you hear, not the steps the hull rests on a rock. The middle-follower
  // on #s=5 saw "Rocks hit 548" for 18 knocks before.
  const knocks = all.map((x) => x.ev.filter((e) => e.k === "rock").length);
  check(all.every((x, i) => x.c.rocks === knocks[i]), "every knock you hear counts once on the end card, and nothing else counts");
  check(runs.every((x) => x.c.rocks <= 40), `a paddler who follows the middle hits a rock ${runs.map((x) => x.c.rocks).join(", ")} times`);
  check(all.every((x) => x.nan === 0), "no NaN");
  check(all.every((x) => x.inside === 0), "the canoe never ends a step inside a rock");
  check(all.every((x) => x.outside === 0), "the canoe never ends a step outside the banks");
  const miss = closestMiss(runs[0].c, runs[0].r);
  check(miss == null || (miss.d >= 0 && miss.index >= 0), "the end card can say how close you came to an eddy you missed");
  // no dead pool at the start: the first eddy worth catching comes up fast (24 s to its zone before)
  const near = [], level = [];
  for (const seed of seeds) {
    const r = makeRiver(seed), c = newCanoe(r), p = follower(r), q = r.targets[0];
    let tz = null;
    while (c.y < q.y && c.t < 60) { for (const a of p(c)) act(c, a); step(c, r); if (tz == null && c.y >= q.y - 15) tz = c.t; }
    near.push(tz ?? 99); level.push(c.t);
  }
  check(near.every((t) => t <= 12) && level.every((t) => t <= 12),
    `a paddler who follows the middle reaches the first eddy worth catching within 12 s: 15 m above its rock in ${Math.max(...near).toFixed(0)} s at most, level with it in ${Math.max(...level).toFixed(0)} s at most`);
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
  // a swim at 200 m puts you back a few metres upstream, in open water, the bow downstream (it was 6 m before)
  const spots = [];
  let open = true;
  for (const seed of [3, 7, 11, 23, 42, 99]) {
    const rv = makeRiver(seed);
    for (const n of [-0.5, 0, 0.5]) {
      const y = 200, x = rv.c(y) + n * rv.b(y), s = newCanoe(rv, { x, y, psi: Math.atan2(...rv.tan(y)) }), e2 = [];
      s.caught.add(rv.targets[0].id); s.lastEddy = rv.targets[0];   // an eddy caught far upstream does not pull you back
      s.phi = C.CAPSIZE + 0.01;
      for (let i = 0; i < 120 * 3 && !e2.some((q) => q.k === "reset"); i++) step(s, rv, e2);
      spots.push(s.y);
      const [tx, ty] = rv.tan(s.y), sideways = Math.abs(Math.sin(s.psi) * ty - Math.cos(s.psi) * tx);
      for (const k of [-2.3, 0, 2.3]) {
        const hx = s.x + k * Math.sin(s.psi), hy = s.y + k * Math.cos(s.psi);
        if (rv.rocks.some((q) => Math.hypot(q.x - hx, q.y - hy) < q.R + C.HULL_R)) open = false;
      }
      // and clear water for 9 m ahead, so you have a moment to start
      for (const k of [4.5, 6.5, 9]) {
        const hx = s.x + k * Math.sin(s.psi), hy = s.y + k * Math.cos(s.psi);
        if (rv.rocks.some((q) => Math.hypot(q.x - hx, q.y - hy) < q.R + 1)) open = false;
      }
      if (Math.abs((s.x - rv.c(s.y)) / rv.b(s.y)) > 0.7 || sideways > 0.01 || Math.hypot(s.vx, s.vy) > 0) open = false;
    }
  }
  check(spots.every((y) => y >= 185 && y <= 200), `a swim at 200 m puts you back in between 185 and 200 m (${Math.min(...spots).toFixed(0)} to ${Math.max(...spots).toFixed(0)} m)`);
  check(open, "there you sit still in open water, clear of the rocks for 9 m ahead, the bow downstream");
}

/* ---------------- 6. fair capsizes ---------------- */
// The eddy-line set: fast unbraced crossings into every eddy worth catching, from both sides, at 1, 2 and 3 m/s.
// The warning ("tip": the roll 0.4 s ahead passes 50°) must come at least 0.3 s before the capsize.
section("Fair capsizes");
{
  function crossing(r, q, side, drive, late) {
    const down = Math.atan2(q.tx, q.ty), k = side * (q.hw + 1.5), s = q.sc - q.hl * 0.5;
    const x = q.x + s * q.tx + k * q.ty, y = q.y + s * q.ty - k * q.tx, psi = down - side * (55 / R2D);
    const c = newCanoe(r, { x, y, psi }), f = r.flow(x, y), ev = [];
    c.vx = f.vx + Math.sin(psi) * drive; c.vy = f.vy + Math.cos(psi) * drive;
    let warn = null;
    for (let i = 0; i < 120 * 4; i++) {
      // a player who braces on the low side 0.25 s after the warning
      if (late && warn != null && c.t - warn >= 0.25 && !c.brace) c.brace = Math.sign(c.phi) || 1;
      ev.length = 0;
      step(c, r, ev);
      if (warn == null && ev.some((e) => e.k === "tip")) warn = c.t;
      if (ev.some((e) => e.k === "capsize")) return { cap: true, warn, lead: warn == null ? 0 : c.t - warn };
    }
    return { cap: false, warn };
  }
  const leads = [];
  let warned = 0, saved = 0;
  for (const seed of [3, 7, 11, 23, 42, 99]) {
    const r = makeRiver(seed);
    for (const q of r.targets) for (const side of [-1, 1]) for (const drive of [1, 2, 3]) {
      const a = crossing(r, q, side, drive, false);
      if (a.cap) leads.push(a.lead);
      const b = crossing(r, q, side, drive, true);
      if (b.warn != null) { warned++; if (!b.cap) saved++; }
    }
  }
  const fair = leads.filter((l) => l >= 0.3).length, med = leads.slice().sort((a, b) => a - b)[leads.length >> 1];
  check(leads.length >= 20, `fast unbraced crossings still tip you (${leads.length} capsizes)`);
  check(fair >= 0.85 * leads.length, `${Math.round((100 * fair) / leads.length)}% of capsizes are warned at least 0.3 s ahead (median ${med.toFixed(2)} s; 12% and 0.16 s before)`);
  check(Math.min(...leads) >= 0.3, `even the shortest warning comes ${Math.min(...leads).toFixed(2)} s ahead (0.07 s before)`);
  check(saved >= 0.5 * warned, `a brace 0.25 s after the warning saves ${saved} of ${warned} warned crossings`);
}

/* ---------------- 7. the log jam above the put-in ---------------- */
section("The log jam");
{
  // turn round at the put-in and paddle upstream hard for 60 s (before, this reached y = -170 m)
  const ys = [];
  for (const seed of [3, 7, 11, 23, 42, 99]) {
    const r = makeRiver(seed), c = newCanoe(r), [tx, ty] = r.tan(c.y);
    c.psi = Math.atan2(-tx, -ty);
    let last = -9, alt = 1, minY = c.y;
    while (c.t < 60) { if (c.t - last > 0.45) { last = c.t; alt = -alt; act(c, { type: "stroke", side: alt, power: 1.2 }); } step(c, r); minY = Math.min(minY, c.y); }
    ys.push(minY);
  }
  check(ys.every((y) => y > JAM), `a canoe that paddles upstream stops at the log jam at y = ${JAM} m (it gets to ${Math.min(...ys).toFixed(1)} m)`);
}

/* ---------------- 8. eddies you can read, and no trap ---------------- */
section("Eddies");
{
  // in each target eddy, the bow downstream, strokes on both sides at full power: out past the eddy's tail in 10 s?
  let n = 0, out = 0;
  for (const seed of [3, 7, 11, 23, 42, 99, 5, 13]) {
    const r = makeRiver(seed);
    for (const q of r.targets) {
      const c = newCanoe(r, { x: q.ex, y: q.ey, psi: Math.atan2(q.tx, q.ty) });
      let last = -9, alt = 1, free = false;
      while (c.t < 10 && !free) {
        if (c.t - last > 0.5) { last = c.t; alt = -alt; act(c, { type: "stroke", side: alt, power: 1.2 }); }
        step(c, r);
        free = (c.x - q.x) * q.tx + (c.y - q.y) * q.ty > q.sc + q.hl + 1;
      }
      n++; if (free) out++;
    }
  }
  check(out >= 0.9 * n, `a canoe that faces downstream in an eddy paddles out within 10 s in ${out} of ${n} eddies (48% before)`);

  // what the ring shows: sit in an eddy core and drift with its water
  const r = makeRiver(7), q = r.targets[2];
  const sit = (psi, secs) => {
    const c = newCanoe(r, { x: q.ex, y: q.ey, psi }), f = r.flow(q.ex, q.ey), ev = [], seen = [];
    c.vx = f.vx; c.vy = f.vy;
    for (let i = 0; i < 120 * secs && !ev.some((e) => e.k === "eddy"); i++) { step(c, r, ev); seen.push({ q: c.eddyQ, bow: c.eddyBow, holding: c.holding, t: c.eddyT }); }
    return { c, ev, seen };
  };
  const down = sit(Math.atan2(q.tx, q.ty), 2), up = sit(Math.atan2(-q.tx, -q.ty), 2);
  check(!down.ev.some((e) => e.k === "eddy") && down.seen.some((s) => s.q === q && !s.bow), "with the bow downstream there is no catch, and the page is told the bow is wrong");
  const t = up.c.t, filling = up.seen.filter((s) => s.holding).map((s) => s.t);
  check(up.ev.some((e) => e.k === "eddy") && t < C.EDDY_HOLD + 0.2 && filling.every((v, i) => i === 0 || v > filling[i - 1]),
    `with the bow upstream the hold fills and the eddy is caught in ${t.toFixed(2)} s`);
  check(up.c.eddyQ === null, "a caught eddy shows no ring");

  // an eddy behind a rock in slow water (in the pool at the put-in, and in the pool at the foot) is not a target, and
  // sitting in it does not count
  let others = 0, counted = 0;
  for (const seed of [3, 7, 11, 23, 42, 99]) {
    const plain = makeRiver(seed), at = (y, n) => ({ x: plain.c(y) + n * plain.b(y), y, R: 1.4 });
    const rv = makeRiver(seed, { rocks: [at(16, 0.3), at(FINISH - 6, -0.3)] });
    for (const o of rv.rocks.filter((x) => !x.target)) {
      const c = newCanoe(rv, { x: o.ex, y: o.ey, psi: Math.atan2(-o.tx, -o.ty) }), f = rv.flow(o.ex, o.ey), ev = [];
      c.vx = f.vx; c.vy = f.vy;
      for (let i = 0; i < 240; i++) step(c, rv, ev);
      others++; if (ev.some((e) => e.k === "eddy") || c.caught.size) counted++;
    }
  }
  check(others > 0 && counted === 0, `an eddy that is not a target never counts (${others} tried; before, such an eddy counted)`);
}

/* ---------------- 9. the ledge ---------------- */
// From 3 m above the lip, in the middle, moving with the water: straight over is a boof, 60° off rolls you over.
section("The ledge");
{
  const over = (seed, offDeg, { stroke = false, late = false } = {}) => {
    const r = makeRiver(seed), L = r.ledge, ev = [];
    const c = newCanoe(r, { x: L.x - 3 * L.tx, y: L.y - 3 * L.ty, psi: Math.atan2(L.tx, L.ty) + offDeg / R2D }), f = r.flow(c.x, c.y);
    c.vx = f.vx; c.vy = f.vy;
    let warn = null, cap = null, stroked = false;
    for (let i = 0; i < 120 * 3 && cap == null; i++) {
      if (stroke && !stroked && r.lip(c.x, c.y) > -1.2) { act(c, { type: "stroke", side: 1, power: 1 }); act(c, { type: "j", side: 1, power: 1 }); stroked = true; }
      if (late && warn != null && c.t - warn >= 0.25 && !c.brace) c.brace = c.warn || Math.sign(c.phi) || 1;
      const n = ev.length;
      step(c, r, ev);
      for (const e of ev.slice(n)) { if (e.k === "tip" && warn == null) warn = c.t; if (e.k === "capsize") cap = c.t; }
    }
    // after a swim, where you get back in
    let back = null;
    if (cap != null) { for (let i = 0; i < 120 * 3 && !ev.some((e) => e.k === "reset"); i++) step(c, r, ev); back = r.lip(c.x, c.y); }
    return { ev, c, cap, lead: cap != null && warn != null ? cap - warn : 0, back };
  };
  const seeds = [3, 7, 11, 23, 42, 99];
  const straight = seeds.map((s) => over(s, 0)), clean = seeds.map((s) => over(s, 0, { stroke: true }));
  check(straight.every((o) => o.ev.some((e) => e.k === "boof") && o.cap == null), "a straight run over the ledge is a boof, and you stay up");
  check(clean.every((o) => o.ev.some((e) => e.k === "boof" && e.clean)), "with a stroke at the lip it is a clean boof");
  const crooked = seeds.flatMap((s) => [over(s, 60), over(s, -60)]);
  check(crooked.every((o) => o.ev.some((e) => e.k === "crooked") && o.cap != null), "a run 60° off rolls you over");
  check(crooked.every((o) => o.lead >= 0.3), `the warning comes at least 0.3 s before that swim (${Math.min(...crooked.map((o) => o.lead)).toFixed(2)} s at least)`);
  const saved = seeds.flatMap((s) => [over(s, 60, { late: true }), over(s, -60, { late: true })]).filter((o) => o.cap == null).length;
  check(saved >= 9, `a brace 0.25 s after the warning saves ${saved} of 12 of those runs`);
  check(crooked.every((o) => o.back <= -12), `after a swim at the ledge you get back in above it, ${Math.min(...crooked.map((o) => -o.back)).toFixed(0)} m or more`);
  const follow = seeds.map((s) => run(s, follower));
  check(follow.every((x) => x.c.ledge === "boof" || x.c.ledge === "clean"), `a paddler who follows the middle boofs the ledge (${follow.map((x) => x.c.ledge).join(", ")})`);
}

console.log(`\ncreek.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
