// Checks the pinball physics of Full Tilt with no browser: node qa/lab/tilt.sim.mjs
// Fast balls never pass through a wall or a flipper, a raised flipper cradles the ball, a flip from the cradle reaches
// the top of the table, a quick tap passes the ball across, a live catch has a window, and with the kickers off the
// ball never gains energy. A soft pull of the plunger drops the ball into a top lane, and the pull picks the lane. In a
// long game played by a bot, the ball is never trapped.
// Exit code 1 on failure.
import { makeTable, inside, BALL_R } from "../../public/lab/tilt/table.js";
import { makeWorld, step, setFlip, launch, pullPower, energy, tip, H, F } from "../../public/lab/tilt/physics.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const along = (f, b) => { const [tx, ty] = tip(f); return ((b.x - f.px) * (tx - f.px) + (b.y - f.py) * (ty - f.py)) / (f.len * f.len); };
// how far the ball sinks into any wall, post or flipper (negative: the gap to the nearest one)
function sink(w) {
  const b = w.ball, t = w.table;
  let worst = -Infinity;
  for (const s of t.walls) {
    if (s.drop && !s.drop.up) continue;
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
    let u = ((b.x - s.a[0]) * dx + (b.y - s.a[1]) * dy) / (dx * dx + dy * dy);
    u = Math.max(0, Math.min(1, u));
    const d = Math.hypot(b.x - s.a[0] - u * dx, b.y - s.a[1] - u * dy);
    if (s.oneway) continue;
    worst = Math.max(worst, BALL_R - d);
  }
  for (const c of t.posts.concat(t.bumpers)) worst = Math.max(worst, BALL_R + c.r - Math.hypot(b.x - c.x, b.y - c.y));
  for (const f of w.flippers) {
    const [tx, ty] = tip(f), u = Math.max(0, Math.min(1, along(f, b)));
    const qx = f.px + u * (tx - f.px), qy = f.py + u * (ty - f.py), rc = f.r1 + (f.r2 - f.r1) * u;
    worst = Math.max(worst, BALL_R + rc - Math.hypot(b.x - qx, b.y - qy));
  }
  return worst;
}
function place(w, x, y, vx = 0, vy = 0) { Object.assign(w.ball, { x, y, vx, vy, live: true, lane: false }); }
// the slingshots are solid triangles: a ball placed inside one is not a fair start
const inTri = (x, y, [a, b, c]) => { const s = (p, q, r) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]); const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const SLINGS = [[[84, 330], [84, 230], [126, 205]], [[371, 330], [371, 230], [329, 205]]];
// a random spot on the playfield, clear of everything by at least 2 mm
function clearSpot(w, r, x0 = 30, x1 = 430, y0 = 120, y1 = 920) {
  for (let k = 0; k < 500; k++) {
    place(w, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0));
    const b = w.ball;
    if (inside(w.table.outline, b.x, b.y) && sink(w) < -2 && !SLINGS.some((t) => inTri(b.x, b.y, t)) && !(b.x < 18 && b.y > 455 && b.y < 601)) return true;
  }
  throw new Error("no clear spot");
}

/* ---------------- 1. no tunnelling ---------------- */
section("Fast balls stay on the table");
{
  const r = mulberry(11);
  let esc = 0, deep = 0, tunnels = 0, frames = 0;
  const t0 = Date.now();
  for (let shot = 0; shot < 5000; shot++) {
    const w = makeWorld(makeTable());
    clearSpot(w, r);
    const sp = 500 + r() * 7500, a = r() * Math.PI * 2;
    w.ball.vx = Math.cos(a) * sp; w.ball.vy = Math.sin(a) * sp;
    for (let i = 0; i < 120 * 5 && w.ball.live; i++) {
      if (i % 9 === 0) { setFlip(w, -1, r() < 0.5); setFlip(w, 1, r() < 0.5); }
      step(w);
      frames++;
      if (!inside(w.table.outline, w.ball.x, w.ball.y)) esc++;
      if (sink(w) > 1) deep++;
    }
    esc += w.escapes; tunnels += w.tunnels;
  }
  console.log(`  ${frames.toLocaleString()} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s; flipper guard used ${tunnels} times`);
  check(esc === 0, "5,000 random shots up to 8,000 mm/s never leave the table");
  check(deep === 0, "and never end a frame sunk into a wall, a post or a flipper");
  // straight at a swinging flipper
  let crossed = 0;
  for (let k = 0; k < 360; k++) {
    const w = makeWorld(makeTable()), f = w.flippers[0], [tx, ty] = tip(f);
    const u = 0.2 + 0.75 * ((k * 7) % 36) / 36, cx = f.px + (tx - f.px) * u, cy = f.py + (ty - f.py) * u;
    place(w, cx, cy + 120, (r() - 0.5) * 2000, -8000);
    const start = Math.sign((tx - f.px) * (w.ball.y - f.py) - (ty - f.py) * (w.ball.x - f.px));
    for (let i = 0; i < 60; i++) {
      if (i === (k % 5)) setFlip(w, -1, true);
      step(w);
      const [ux, uy] = tip(f), side = Math.sign((ux - f.px) * (w.ball.y - f.py) - (uy - f.py) * (w.ball.x - f.px)), uu = along(f, w.ball);
      if (side !== start && uu > 0.05 && uu < 0.95 && Math.abs(((ux - f.px) * (w.ball.y - f.py) - (uy - f.py) * (w.ball.x - f.px)) / f.len) < BALL_R) crossed++;
    }
  }
  check(crossed === 0, "360 shots at 8,000 mm/s into a swinging flipper never pass through it");
}

/* ---------------- 2. the flipper skills ---------------- */
function cradled(r = null) {
  const w = makeWorld(makeTable());
  setFlip(w, -1, true);
  for (let i = 0; i < 30; i++) step(w);
  const f = w.flippers[0], [tx, ty] = tip(f), j = r ? (r() - 0.5) * 20 : 0;
  place(w, f.px + (tx - f.px) * 0.7 + j, f.py + (ty - f.py) * 0.7 + 60 + j);
  return w;
}
section("The flipper skills");
{
  // a cradle: a ball dropped on a raised flipper rolls to its base and stops
  let settled = 0, times = [];
  const r = mulberry(5);
  for (let k = 0; k < 40; k++) {
    const w = cradled(r);
    let t = -1;
    for (let i = 0; i < 120 * 2.5; i++) { step(w); const v = Math.hypot(w.ball.vx, w.ball.vy); if (v < 5) { if (t < 0) t = i * H; } else t = -1; }
    if (t >= 0 && w.ball.live) { settled++; times.push(t); }
  }
  check(settled === 40, `a raised flipper cradles the ball within 2.5 s (${settled} of 40, ${times.length ? Math.max(...times).toFixed(2) : "-"} s at worst)`);

  // a flip from the cradle: drop the flipper, let the ball roll half way, flip. It must be a real shot: fast off the
  // flipper and up past the slingshots (where it goes from there, a bumper included, is aim, not power)
  let high = 0, slowest = Infinity;
  for (let k = 0; k < 40; k++) {
    const w = cradled(r);
    for (let i = 0; i < 120 * 2.5; i++) step(w);
    setFlip(w, -1, false);
    const f = w.flippers[0];
    for (let i = 0; i < 120 && along(f, w.ball) < 0.45 + r() * 0.15; i++) step(w);
    setFlip(w, -1, true);
    let top = 0, off = 0;
    for (let i = 0; i < 180; i++) { step(w); top = Math.max(top, w.ball.y); if (i < 20) off = Math.max(off, Math.hypot(w.ball.vx, w.ball.vy)); }
    slowest = Math.min(slowest, off);
    if (off >= 2400 && top > 560) high++;
  }
  check(high >= 38, `a flip from the cradle shoots the ball off at 2,400 mm/s or more, up into the bumpers or higher (${high} of 40, slowest ${slowest.toFixed(0)} mm/s)`);

  // a post pass: from the cradle, let the ball roll, then a 50 ms tap pops it across to the other flipper
  let passed = 0;
  for (let k = 0; k < 40; k++) {
    const w = cradled(r);
    for (let i = 0; i < 120 * 2.5; i++) step(w);
    setFlip(w, -1, false);
    const f = w.flippers[0], g = w.flippers[1];
    for (let i = 0; i < 120 && along(f, w.ball) < 0.3 + r() * 0.3; i++) step(w);
    setFlip(w, -1, true);
    for (let i = 0; i < 6; i++) step(w);   // 50 ms
    setFlip(w, -1, false);
    let reached = false;
    for (let i = 0; i < 180 && w.ball.live; i++) {
      step(w);
      const u = along(g, w.ball), [tx, ty] = tip(g);
      const qx = g.px + Math.max(0, Math.min(1, u)) * (tx - g.px), qy = g.py + Math.max(0, Math.min(1, u)) * (ty - g.py);
      if (Math.hypot(w.ball.x - qx, w.ball.y - qy) < BALL_R + 14) reached = true;
    }
    if (reached) passed++;
  }
  check(passed >= 28, `a 50 ms tap passes the ball to the other flipper (${passed} of 40)`);

  // a live catch: the same falling ball, flipped at different moments. Early enough, the flipper waits at its stop
  // and the ball dies on it (a catch); later, the moving flipper shoots it
  const outcomes = [];
  for (const at of [0, 10, 20, 26, 30, 34, 38, 44]) {
    const w = makeWorld(makeTable()), f = w.flippers[0], [tx, ty] = tip(f);
    place(w, f.px + (tx - f.px) * 0.75, 330, 0, -300);
    let top = 0, rest = -1;
    for (let i = 0; i < 120 * 2.5; i++) {
      if (i === at) setFlip(w, -1, true);
      step(w);
      top = Math.max(top, i > at ? w.ball.y : 0);
      const v = Math.hypot(w.ball.vx, w.ball.vy);
      if (v < 5 && rest < 0 && i > at) rest = i;
    }
    outcomes.push(rest >= 0 && top < 360 ? "catch" : top > 500 ? "shot" : "other");
  }
  console.log("  flip at frame 0, 10, 20, 26, 30, 34, 38, 44: " + outcomes.join(", "));
  check(outcomes.includes("catch") && outcomes.includes("shot"), "a live catch has a window: flip early and the ball dies on the flipper, flip late and it is shot away");
}

/* ---------------- 3. energy ---------------- */
section("Energy");
{
  const r = mulberry(21);
  let worst = 0;
  for (let k = 0; k < 300; k++) {
    const w = makeWorld(makeTable(), { kickers: false });
    clearSpot(w, r, 60, 390, 300, 900);
    const a = r() * Math.PI * 2, sp = r() * 3000;
    w.ball.vx = Math.cos(a) * sp; w.ball.vy = Math.sin(a) * sp;
    const e0 = energy(w);
    for (let i = 0; i < 120 * 3 && w.ball.live; i++) { step(w); worst = Math.max(worst, (energy(w) - e0) / e0); }
  }
  check(worst < 0.01, `with the bumpers and slingshots off, the ball never gains energy (at most ${(worst * 100).toFixed(2)}% from pushing it out of walls)`);
}

/* ---------------- 4. the plunger ---------------- */
section("The plunger");
{
  const w = makeWorld(makeTable());
  launch(w, 0.7);
  let top = 0, left = false;
  for (let i = 0; i < 120 * 2; i++) { step(w); top = Math.max(top, w.ball.y); if (!w.ball.lane) left = true; }
  check(left && top > 950, `a strong pull sends the ball up the lane and round the top (${top.toFixed(0)} mm)`);
  const soft = makeWorld(makeTable());
  launch(soft, 0.1);
  for (let i = 0; i < 120 * 3; i++) step(soft);
  check(soft.ball.lane, "a weak pull falls back into the lane");
  // the skill shot: a soft pull drops the ball into a top lane, and how far you pull picks the lane
  const firstLane = (d) => {
    const w = makeWorld(makeTable());
    launch(w, pullPower(d));
    for (let i = 0; i < 120 * 3; i++) {
      const ev = [];
      step(w, ev);
      for (const e of ev) {
        if (e.k === "lane") return e.id;
        if (e.k === "bumper" || e.k === "sling" || e.k === "drop" || e.k === "flipper") return -1;
      }
    }
    return -1;
  };
  const runs = [];
  let map = "";
  for (let d = 0; d <= 1.0001; d += 0.005) {
    const id = firstLane(d);
    map += id < 0 ? "." : id;
    const r = runs[runs.length - 1];
    if (r && r.id === id) r.n++; else runs.push({ id, n: 1, d });
  }
  console.log("  pull 0 " + map + " 1");
  const best = [2, 1, 0].map((id) => runs.filter((r) => r.id === id).reduce((a, r) => (r.n > a.n ? r : a), { n: 0, d: 0 }));
  check(best.every((r) => r.n * 0.005 >= 0.06), `each top lane has a window of 6% of the pull or more (${best.map((r) => (r.n * 0.5).toFixed(1) + "%").join(", ")})`);
  check(best[0].d < best[1].d && best[1].d < best[2].d, "a softer pull finds a lane further right");
  check(firstLane(1) < 0 && firstLane(0.9) < 0, "a full pull goes round the top and past the lanes");
}

/* ---------------- 5. a long game ---------------- */
// A bot flips when the ball comes near a flipper and launches at a random pull. The drop targets come back up as they
// do in the game (not while the ball is behind them). A ball that stays within 3 mm for 4 s is trapped.
section("A long game");
{
  let trapped = [], drains = 0, lanes = 0, drops = 0;
  for (const seed of [7, 42]) {
    const rnd = mulberry(seed), t = makeTable(), w = makeWorld(t), b = w.ball, hold = [0, 0];
    let still = 0, ax = b.x, ay = b.y, dropT = 0;
    const go = () => { Object.assign(b, { x: t.launch.x, y: t.launch.y, vx: 0, vy: 0, live: false, lane: true }); launch(w, pullPower(0.3 + 0.7 * rnd())); };
    go();
    for (let i = 0; i < 60 * 60 * 120; i++) {
      w.flippers.forEach((f, k) => {
        if (hold[k] > 0) { if ((hold[k] -= H) <= 0) setFlip(w, f.side, false); return; }
        if (Math.hypot(b.x - f.px, b.y - f.py) < f.len + 25 && b.y < f.py + 45 && b.vy < 50 && rnd() < 0.25) { setFlip(w, f.side, true); hold[k] = 0.15; }
      });
      const ev = [];
      step(w, ev);
      for (const e of ev) {
        if (e.k === "drain") { drains++; go(); }
        if (e.k === "lane") lanes++;
        if (e.k === "drop") { drops++; if (t.drops.every((d) => !d.up)) dropT = 2; }
      }
      if (dropT > 0 && (dropT -= H) <= 0) { if (b.x < 18 + BALL_R + 4 && b.y > 440 && b.y < 620) dropT = 0.1; else for (const d of t.drops) d.up = true; }
      if (b.live && b.lane && b.x > 455 && b.y < t.launch.y + 4 && Math.hypot(b.vx, b.vy) < 40) go();
      if (Math.hypot(b.x - ax, b.y - ay) > 3) { ax = b.x; ay = b.y; still = 0; }
      else if ((still += H) > 4) { trapped.push(`${b.x.toFixed(0)},${b.y.toFixed(0)}`); b.vy += 300; b.vx += 300 * (rnd() - 0.5); still = 0; }
    }
  }
  check(trapped.length === 0, `in two hours of bot play the ball is never trapped (${drains} drains, ${lanes} lanes, ${drops} drop targets${trapped.length ? "; trapped at " + trapped.slice(0, 5).join(" ") : ""})`);
}

console.log(`\ntilt.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
