// First Breath: stage 4, The Placenta (`root`), as the action-adventure of first-breath-action-genres (design.md 5.4;
// contract.md). Node only, no DOM. It checks:
// - meta: the moments and their gaDays, families, the action layer, Go on to the heart, the cap;
// - the lining map: the same for the same seed; 8 pools (3 in open fluid, 3 under soft tissue, 2 walled in firm
//   tissue) 40 u apart and 50 to 140 u from the start; the shares of open and firm ground; 14 knots 30 u apart, none in
//   firm tissue; every pool reachable (the open and hidden ones without digging firm tissue), over 20 seeds;
// - movement: soft tissue slows you to 16 u/s and leaves a tunnel you then swim at 40 u/s; firm tissue blocks you
//   until 5 pools, then you dig it at 12 u/s; firm tissue stops sparks;
// - the grapple: it snaps to a knot in its cone and reach and pulls you there; not to one outside the cone or past
//   the reach (60 u, 90 u after 3 pools); it sticks in tissue and pulls you to it; it comes back from open fluid;
// - pools: entering one links it (yours: 375 points, 675 for a hidden one, a glow back along the roots, "+1 root");
//   with no input every pool links by itself by 58 s ("The roots reach it anyway." each); 3 pools give the reach and
//   5 strong roots; the pools are milk-white with dotted rims in every view (never red);
// - germs: never spawn within 24 u of you or more than 40 u behind you (no spawn in the bottom 40% in portrait);
// - the heart: no input asked; the hush (her heart −8 dB, the light −10%), your heart at 110 bpm, the milestone, the
//   clock reads "Day 22 after fertilization (week 5)"; the 8 pulses pop every germ within 40 u of the tree;
// - a knock-out: the rest line, the Almost card's metrics, Go on links the pools left and plays the heart and grow,
//   with Goal 0 and the milestones once;
// - the score: the points events add up to the total; the parts; Flourish for all 8 by 40 s; the carry out;
// - facts and captions: root.hcg before root.glands, root.heart in the hush, root.frame on the result;
// - the draw list is valid every 30th view of the ref and idle runs; p99 of a step;
// - the gates (design.md 4.5): skill 1.0 Great or better in at least 18 of 20 and knocked out in at most 1, mean at
//   least 8,500; skill 0.5 not knocked out in at least 16 of 20; one-button (botSteer at skill 1 while held) completes
//   with no knock-out in at least 18 of 20; idle completes or is knocked out, never throws.
import assert from "node:assert/strict";
import * as root from "../../public/first-breath/core/stages/root.js";
import { TUNE } from "../../public/first-breath/core/stages/root.tune.js";
import { FACTS } from "../../public/first-breath/core/stages/root.facts.js";
import { TEXT } from "../../public/first-breath/core/stages/root.text.js";
import { makeMap, cellAt, fieldOf, fieldAt, OPEN, SOFT, FIRM, TUNNEL, DUG, EDGE } from "../../public/first-breath/core/stages/root.map.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { DT, label } from "../../public/first-breath/core/clock.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { validate } from "../../public/first-breath/core/draw.js";
import { grade as gradeOf } from "../../public/first-breath/core/score.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { SOURCES } from "../../public/first-breath/core/sources.js";
import * as X from "../../public/first-breath/core/lib/action.js";

const FILE = "qa/first-breath/stage-root.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const hyp = Math.hypot;
const OPTS = { motherPhase: 0 };
const SEEDS = 20;
const PERF = { p99: NaN };
const P = TUNE.pools, Y = TUNE.you, GP = TUNE.grapple, H = TUNE.heart;

// ---- runs

function play(seed, input, { carry = DEFAULT_CARRY, opts = OPTS, views = false, each = null } = {}) {
  const st = root.create(seed, carry, opts);
  const evs = [], bad = [];
  let steps = 0;
  while (!root.result(st).done && steps < (root.meta.capS + 5) / DT) {
    root.step(st, input(st));
    for (const e of st.events) evs.push({ t: st.t, ...e });
    st.events.length = 0;
    if (each) each(st);
    if (views && steps % 30 === 0) { const b = validate(root.view(st)); if (b.length) bad.push(`${st.t.toFixed(2)} ${st.moment}: ${b.slice(0, 3).join("; ")}`); }
    steps++;
  }
  return { st, res: root.result(st), evs, bad };
}
const botIn = (skill, seed) => { const b = createBot(skill, seed); return (st) => b.intents(root, st); };
const idle = () => makeIntents();
// one-button mode: botSteer at skill 1 while the button is held, its dash as a press (core/run.js)
const oneIn = (seed) => { const r = stream(seed, "one"); r.mem = {}; return (st) => {
  const a = root.botSteer(st, 1, r);
  return makeIntents({ steer: a.steer, touching: true, presses: a.dash ? [{ t: st.t, raw: st.t }] : [] });
}; };

const REF = [], MID = [], IDLE = [], ONE = [];
for (let s = 1; s <= SEEDS; s++) {
  REF.push(play(s, botIn(1, s), { views: s <= 3 }));
  MID.push(play(s, botIn(0.5, s)));
  IDLE.push(play(s, idle, { views: s <= 3 }));
  ONE.push(play(s, oneIn(s)));
}

// A state in the roots with nothing else moving: germs and guards gone, you at (x, y) in a cleared patch.
function rootsAt(seed = 3) {
  const st = root.create(seed, DEFAULT_CARRY, OPTS);
  root.jump(st, "roots");
  st.events.length = 0;
  for (const f of st.A.foes.slice()) X.removeFoe(st.A, f.id);
  st.germT = Infinity;
  st.autoK = 99;
  return st;
}
// Set the cells round (x, y) within r to v.
function paint(st, x, y, r, v) {
  const m = st.map;
  for (let j = 0; j < m.n; j++) for (let i = 0; i < m.n; i++) {
    const cx = m.ox + (i + 0.5) * m.cell, cy = m.oy + (j + 0.5) * m.cell;
    if (hyp(cx - x, cy - y) <= r && m.grid[j * m.n + i] !== EDGE) m.grid[j * m.n + i] = v;
  }
  m.gen++;
}
const steerX = (sx, sy, press = false) => makeIntents({ steer: { x: sx, y: sy }, touching: true, presses: press ? [{ t: 0, raw: 0 }] : [] });

// ---- meta

await check("meta: moments, gaDays, families, the action layer, Go on to the heart, the cap", () => {
  const m = root.meta;
  assert.equal(m.id, "root");
  assert.equal(m.index, 3);
  assert.deepEqual([...m.families], ["steer", "tap"]);
  assert.equal(m.action, true);
  assert.equal(m.goOn, "heart");
  assert.equal(m.canFail, true);
  assert.equal(m.capS, 90);
  assert.deepEqual(m.moments.map((x) => [x.id, ...x.ga]), [["nestle", 20, 23], ["roots", 25, 35], ["heart", 36, 36], ["grow", 36, 49]]);
  assert.deepEqual(root.targets(root.create(1, DEFAULT_CARRY, OPTS), 5), [], "no timed targets");
});

// ---- the map

await check("the map is the same for the same seed, and another seed gives another", () => {
  const a = makeMap(7, { x: 10, y: 40 }, TUNE), b = makeMap(7, { x: 10, y: 40 }, TUNE), c = makeMap(8, { x: 10, y: 40 }, TUNE);
  assert.deepEqual([...a.grid], [...b.grid]);
  assert.deepEqual(a.pools, b.pools);
  assert.deepEqual(a.knots, b.knots);
  assert.notDeepEqual([...a.grid], [...c.grid]);
});

await check("20 maps: 8 pools by kind, apart, at their distances; the ground shares; 14 knots; every pool reachable", () => {
  for (let s = 1; s <= SEEDS; s++) {
    const o = { x: 20, y: 50 }, m = makeMap(s, o, TUNE);
    const kinds = m.pools.map((q) => q.kind).sort();
    assert.deepEqual(kinds, ["firm", "firm", "open", "open", "open", "soft", "soft", "soft"], `seed ${s}`);
    for (let i = 0; i < 8; i++) {
      const q = m.pools[i], d = hyp(q.x - o.x, q.y - o.y);
      assert.ok(d >= 50 - 1e-6 && d <= 140 + 1e-6, `seed ${s} pool ${i} at ${d.toFixed(1)} u`);
      for (let j = i + 1; j < 8; j++) assert.ok(hyp(q.x - m.pools[j].x, q.y - m.pools[j].y) >= 28, `seed ${s}: pools ${i}, ${j} too close`);
      const v = cellAt(m, q.x, q.y);
      if (q.kind === "open") assert.equal(v, OPEN, `seed ${s}: an open pool lies in fluid`);
      if (q.kind === "soft") assert.equal(v, SOFT, `seed ${s}: a hidden pool lies under soft tissue`);
      if (q.kind === "firm") {
        assert.equal(v, OPEN, `seed ${s}: a walled pool's chamber is fluid`);
        for (let a = 0; a < 16; a++) {
          const ux = Math.cos((a / 16) * 2 * Math.PI), uy = Math.sin((a / 16) * 2 * Math.PI);
          let hit = false;
          for (let r = 0; r <= TUNE.map.wallOut + 1 && !hit; r += 1) { const w = cellAt(m, q.x + ux * r, q.y + uy * r); hit = w === FIRM || w === EDGE; }
          assert.ok(hit, `seed ${s}: the wall round pool ${i} is shut`);
        }
      }
    }
    let open = 0, firm = 0;
    for (const v of m.grid) { if (v === OPEN) open++; else if (v === FIRM) firm++; }
    const n = m.grid.length;
    assert.ok(open / n > 0.12 && open / n < 0.45, `seed ${s}: open share ${(open / n).toFixed(2)}`);
    assert.ok(firm / n > 0.03 && firm / n < 0.25, `seed ${s}: firm share ${(firm / n).toFixed(2)}`);
    assert.ok(m.knots.length >= 12 && m.knots.length <= 14, `seed ${s}: ${m.knots.length} knots`);
    for (const k of m.knots) {
      assert.notEqual(cellAt(m, k.x, k.y), FIRM, `seed ${s}: a knot in firm tissue`);
      for (const k2 of m.knots) if (k2 !== k) assert.ok(hyp(k.x - k2.x, k.y - k2.y) >= 30 - 1e-6, `seed ${s}: knots too close`);
    }
    // every pool reachable: the open and hidden ones without digging firm tissue, the walled ones with strong roots
    m.pools.forEach((q, i) => {
      const F = fieldOf(m, q, q.kind === "firm", TUNE);
      assert.ok(Number.isFinite(fieldAt(F, o.x, o.y)), `seed ${s}: pool ${i} (${q.kind}) cannot be reached`);
    });
  }
});

// ---- movement

await check("soft tissue slows you to 16 u/s and leaves a tunnel, which you then swim at 40 u/s", () => {
  const st = rootsAt(3), p = st.A.p;
  paint(st, p.x + 80, p.y, 62, SOFT);
  paint(st, p.x, p.y, 12, OPEN);
  const x0 = p.x;
  // into the soft tissue
  for (let i = 0; i < 90; i++) root.step(st, steerX(1, 0));
  const startDig = p.x;
  for (let i = 0; i < 60; i++) root.step(st, steerX(1, 0));
  near((p.x - startDig) / 1.0, Y.digUS, 2.5, "the speed through soft tissue");
  assert.equal(cellAt(st.map, p.x - 6, p.y), TUNNEL, "a tunnel behind you");
  // back along the tunnel
  for (let i = 0; i < 20; i++) root.step(st, steerX(-1, 0));
  const back0 = p.x;
  for (let i = 0; i < 30; i++) root.step(st, steerX(-1, 0));
  near((back0 - p.x) / 0.5, Y.swimUS, 3, "the speed in your tunnel");
  assert.ok(p.x < x0 + 60, "you came back");
});

await check("firm tissue blocks you until 5 pools; then you dig it at 12 u/s; it stops sparks", () => {
  const st = rootsAt(4), p = st.A.p;
  paint(st, p.x, p.y, 14, OPEN);
  paint(st, p.x + 30, p.y, 12, FIRM);
  for (let i = 0; i < 120; i++) root.step(st, steerX(1, 0));
  assert.ok(p.x < st.origin.x + 30 - 12 - 2, `firm tissue held you at ${(p.x - st.origin.x).toFixed(1)} u`);
  assert.equal(st.strong, false);
  // 5 pools linked (open and hidden ones first): strong roots
  const five = st.pools.map((q, i) => i).filter((i) => st.pools[i].kind !== "firm").slice(0, 5);
  for (const i of five) { p.x = st.pools[i].x; p.y = st.pools[i].y; for (let k = 0; k < 10; k++) root.step(st, makeIntents()); }
  assert.equal(st.strong, true, "strong roots at 5 pools");
  assert.equal(st.reach, true, "the reach at 3");
  p.x = st.origin.x + 10; p.y = st.origin.y; p.vx = 0; p.vy = 0;
  paint(st, p.x, p.y, 8, OPEN);
  paint(st, p.x + 20, p.y, 12, FIRM);
  for (let i = 0; i < 60; i++) root.step(st, steerX(1, 0));
  const x1 = p.x;
  for (let i = 0; i < 60; i++) root.step(st, steerX(1, 0));
  near(p.x - x1, Y.firmUS, 3, "the speed through firm tissue with strong roots");
  assert.equal(cellAt(st.map, p.x - 6, p.y), DUG, "dug firm tissue behind you");
  // a foe spark in firm tissue is gone next step
  const fx = p.x + 30, fy = p.y + 30;
  paint(st, fx, fy, 6, FIRM);
  X.addBullet(st.A, 2, fx, fy, 0, 0, { r: 1, life: 5 });
  const before = X.foeBullets(st.A);
  root.step(st, makeIntents()); root.step(st, makeIntents());
  assert.equal(X.foeBullets(st.A), before - 1, "the spark in firm tissue is gone");
});

// ---- the grapple

function grappleCase(seed, dx, dy, { reach = false } = {}) {
  const st = rootsAt(seed), p = st.A.p;
  paint(st, p.x, p.y, 110, OPEN);
  st.knots = [{ x: p.x + dx, y: p.y + dy }];
  st.pools.forEach((q) => { q.x += 1000; });            // no pool rim in the way
  if (reach) st.reach = true;
  st.A.t += 1;
  root.step(st, steerX(1, 0, true));
  for (let i = 0; i < 70; i++) root.step(st, makeIntents());
  return { st, d: hyp(p.x - st.knots[0].x, p.y - st.knots[0].y) };
}

await check("the grapple snaps to a knot in its cone and reach and pulls you there; not outside the cone or past the reach", () => {
  const a = grappleCase(5, 50, 6);
  assert.ok(a.d <= GP.stopU + 1.5, `pulled to the knot (${a.d.toFixed(1)} u off)`);
  assert.ok(a.st.grapples === 1);
  const b = grappleCase(5, 40, 40 * Math.tan(0.6));    // 34° off the aim
  assert.ok(b.d > 30, `no snap outside the cone (${b.d.toFixed(1)} u off)`);
  const c = grappleCase(5, 75, 0);
  assert.ok(c.d > 60, `no snap past 60 u (${c.d.toFixed(1)} u off)`);
  const d = grappleCase(5, 75, 0, { reach: true });
  assert.ok(d.d <= GP.stopU + 1.5, `after 3 pools it reaches 90 u (${d.d.toFixed(1)} u off)`);
});

await check("the tendril sticks in tissue and pulls you to it; from open fluid it comes back", () => {
  const st = rootsAt(6), p = st.A.p;
  paint(st, p.x, p.y, 40, OPEN);
  paint(st, p.x + 30, p.y, 6, SOFT);
  st.knots = [];
  st.pools.forEach((q) => { q.x += 1000; });
  st.A.t += 1;
  const x0 = p.x;
  root.step(st, steerX(1, 0, true));
  for (let i = 0; i < 40; i++) root.step(st, makeIntents());
  assert.ok(p.x - x0 > 15, `pulled toward the tissue (${(p.x - x0).toFixed(1)} u)`);
  assert.ok(p.x < x0 + 26, "and stopped at it");
  const st2 = rootsAt(6), p2 = st2.A.p;
  paint(st2, p2.x, p2.y, 110, OPEN);
  st2.knots = [];
  st2.pools.forEach((q) => { q.x += 1000; });
  st2.A.t += 1;
  root.step(st2, steerX(1, 0, true));
  assert.equal(st2.gr.kind, "miss");
  for (let i = 0; i < 40; i++) root.step(st2, makeIntents());
  assert.equal(st2.gr, null, "it came back");
  assert.ok(Math.abs(p2.x - st2.origin.x) < 3, "and pulled nothing");
});

// ---- pools and the clock

await check("entering a pool links it: points (675 for a hidden one), a glow back along the roots, +1 root", () => {
  const st = rootsAt(7), p = st.A.p;
  const i = st.pools.findIndex((q) => q.kind === "soft");
  p.x = st.pools[i].x; p.y = st.pools[i].y;
  root.step(st, makeIntents());
  assert.equal(st.pools[i].linked, true);
  assert.equal(st.pools[i].by, "you");
  const pts = st.events.filter((e) => e.name === "points");
  assert.deepEqual(pts.map((e) => [e.part, e.add]), [["skill", 675]]);
  assert.equal(st.glows.length, 1);
  assert.ok(st.glows[0].pts.length >= 4, "the glow runs along a path of the roots");
  assert.ok(st.tags.some((g) => g.word === "root.plusRoot"));
  assert.ok(st.events.some((e) => e.name === "sfx" && e.id === "root.link"));
});

await check("with no input every pool links by itself by 58 s, with \"The roots reach it anyway.\" for each", () => {
  for (const r of IDLE) {
    if (r.res.metrics.ko) continue;
    const roots0 = r.res.metrics.times.roots, heart0 = r.res.metrics.times.heart;
    assert.ok(heart0 - roots0 <= TUNE.roots.lenS + 0.1, `roots took ${(heart0 - roots0).toFixed(1)} s`);
    assert.equal(r.res.metrics.auto, 8);
    assert.equal(r.evs.filter((e) => e.name === "caption" && e.id === "root.anyway").length, 8);
    assert.ok(r.res.goalMet, "idle completes");
  }
  assert.ok(IDLE.filter((r) => !r.res.metrics.ko).length >= 1, "some idle runs complete");
});

await check("the pools are milk-white with dotted rims in every view, never red", () => {
  const st = root.create(2, DEFAULT_CARRY, OPTS), bot = createBot(1, 2);
  let n = 0;
  while (!root.result(st).done) {
    root.step(st, bot.intents(root, st)); st.events.length = 0;
    if (Math.round(st.t / DT) % 20) continue;
    for (const m of root.view(st).marks) if (m.kind === "pool") { assert.equal(m.rim, "dotted"); n++; }
  }
  assert.ok(n > 100);
});

await check("germs never spawn within 24 u of you or more than 40 u behind you", () => {
  for (const s of [1, 2, 3, 4, 5]) {
    const seen = new Set();
    play(s, botIn(0.7, s), { each: (st) => {
      if (st.moment !== "roots" || !st.A) return;
      const p = st.A.p;
      for (const f of st.A.foes) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        if (f.kind !== "germ") continue;
        assert.ok(hyp(f.x - p.x, f.y - p.y) >= 24 - 1e-6, `seed ${s}: a germ ${hyp(f.x - p.x, f.y - p.y).toFixed(1)} u from you`);
        assert.ok(f.y - p.y >= -TUNE.germs.behindU - 1e-6, `seed ${s}: a germ ${(p.y - f.y).toFixed(1)} u behind you`);
      }
    } });
    assert.ok(seen.size >= 5, `seed ${s}: only ${seen.size} foes`);
  }
});

// ---- the heart

await check("the heart: no input, the hush, 110 bpm, the milestone, Day 22 (week 5), pulses pop every germ near the tree", () => {
  const st = root.create(9, DEFAULT_CARRY, OPTS), bot = createBot(1, 9);
  while (st.moment !== "heart") { st.events.length = 0; root.step(st, bot.intents(root, st)); }
  const h0 = st.t;
  assert.equal(root.prompt(st).gesture, "none");
  assert.equal(label(st.gaDay, { fertilized: true }), "Day 22 after fertilization (week 5)");
  const hush = st.events.find((e) => e.name === "sfx" && e.id === "root.hush");
  assert.ok(hush && hush.gain === -8, "her heart 8 dB down");
  const lv = root.view(st).light.level;
  let milestone = null, pops = 0;
  const pulses = [];
  while (st.moment === "heart") {
    const before = st.A.foes.length;
    root.step(st, makeIntents({ steer: { x: 1, y: 0 }, touching: true, presses: [{ t: st.t, raw: st.t }] }));
    for (const e of st.events) { if (e.name === "milestone" && e.id === "heart") milestone = st.t - h0; if (e.name === "sfx" && e.id === "act.clear") pops++; }
    st.events.length = 0;
    if (st.heart.pulses.length > pulses.length) pulses.push(st.t - h0);
    if (st.t - h0 > 0.2 && st.t - h0 < 1.4) assert.ok(root.view(st).light.level < lv / 0.9 * 0.91 + 1e-9, "the light is down in the hush");
    if (pulses.length === 8 && st.t - h0 >= H.hushS + 7 * 60 / H.bpm + H.pulseMaxS + 0.05 && st.moment === "heart") {
      const nd = st.tree.nodes;
      for (const f of st.A.foes) {
        for (let i = 0; i < st.tree.n; i++) assert.ok(hyp(nd[4 * i] - f.x, nd[4 * i + 1] - f.y) > H.popR, "a germ near the tree after the 8th pulse");
      }
    }
    void before;
  }
  near(milestone, H.hushS, DT * 1.5, "the heart milestone at the end of the hush");
  assert.equal(pulses.length, 8);
  for (let k = 0; k < 8; k++) near(pulses[k], H.hushS + k * 60 / H.bpm, DT * 1.5, `pulse ${k + 1} on your beat`);
  near(60 / (st.beats.bpm("you", h0 + 3)), 60 / 110, 1e-6, "your heart at 110 bpm");
  assert.ok(pops >= 6, `${pops} germs popped`);
  assert.equal(st.A.p.hp, root.result(st).metrics.hp);
});

// ---- a knock-out and Go on

await check("a knock-out rests, ends with Goal 0, and Go on links the rest and plays the heart and grow", () => {
  const st = root.create(11, DEFAULT_CARRY, OPTS), bot = createBot(0.7, 11);
  const evs = [];
  while (!root.result(st).done) {
    if (st.moment === "roots" && st.t - st.m0 > 6 && !st.A.ko) { st.A.p.inv = 0; st.A.p.shield = 0; st.A.p.hp = 1; X.hitPlayer(st.A, 1, "test", st.A.p.x + 1, st.A.p.y); }
    root.step(st, bot.intents(root, st));
    evs.push(...st.events); st.events.length = 0;
  }
  const r = root.result(st);
  assert.equal(r.goalMet, false);
  assert.equal(r.metrics.ko, true);
  assert.equal(r.metrics.almost, "almost.ko");
  assert.ok(Number.isFinite(r.metrics.koAt));
  assert.equal(r.score.goal, 0);
  assert.ok(evs.some((e) => e.name === "subgoal" && e.text === "root.rest"), "You need a rest.");
  assert.equal(root.prompt(st).gesture, "none");
  assert.equal(root.jump(st, "heart"), true);
  assert.equal(st.moment, "heart");
  assert.ok(st.pools.every((q) => q.linked), "the pools left link");
  assert.ok(st.events.some((e) => e.name === "caption" && e.id === "root.anywayAll"));
  let saw = new Set();
  while (!root.result(st).done) { root.step(st, makeIntents()); saw.add(st.moment); evs.push(...st.events); st.events.length = 0; }
  assert.ok(saw.has("grow"), "grow plays");
  const r2 = root.result(st);
  assert.equal(r2.goalMet, false);
  assert.equal(r2.score.goal, 0);
  assert.equal(r2.metrics.ko, true);
  assert.equal(st.gaDay, 49);
  for (const id of ["implanted", "heart"]) assert.equal(evs.filter((e) => e.name === "milestone" && e.id === id).length, 1, id);
  assert.deepEqual(Object.keys(r2.carryOut).sort(), ["nestleX", "treeSeed"]);
});

// ---- score, facts, carry

await check("the score: points add up to the total; the parts; Goal on the goal; Flourish only for all 8 by 40 s", () => {
  for (const r of [...REF, ...MID, ...IDLE]) {
    const sum = r.evs.filter((e) => e.name === "points").reduce((a, e) => a + e.add, 0);
    assert.equal(sum, r.res.score.total, `seed: points ${sum} vs total ${r.res.score.total}`);
    const parts = r.res.parts.reduce((a, p) => a + p.value, 0);
    assert.equal(parts, r.res.score.total);
    assert.equal(r.res.score.goal, r.res.goalMet ? 3000 : 0);
    const m = r.res.metrics;
    assert.equal(r.res.score.flourish > 0, m.you === 8 && m.lastYouS < 40 && !m.ko);
  }
});

await check("captions in priority order (root.hcg, root.glands, root.heart); root.frame on the result; the sources", () => {
  for (const r of REF.slice(0, 5)) {
    const f = r.evs.filter((e) => e.name === "fact").map((e) => e.id);
    assert.deepEqual(f, ["root.hcg", "root.glands", "root.heart"]);
  }
  const frame = FACTS.find((x) => x.id === "root.frame");
  assert.ok(frame && frame.where === "result" && frame.checked);
  for (const x of FACTS) for (const k of x.src) assert.ok(SOURCES[k] || (SOURCES.get && SOURCES.get(k)) || Object.values(SOURCES).some((s) => s && s.key === k), `${x.id}: source ${k}`);
  for (const id of ["root.move", "root.move.keys", "root.move.one", "root.rest", "root.anyway", "root.anywayAll", "root.reachPop", "root.strongPop", "root.yours"]) assert.ok(TEXT[id], id);
});

await check("carry out: nestleX in −1..1 and treeSeed, the same for the same play", () => {
  const a = REF[0].res.carryOut, b = play(1, botIn(1, 1)).res.carryOut;
  assert.deepEqual(a, b);
  assert.ok(a.nestleX >= -1 && a.nestleX <= 1);
  assert.ok(Number.isInteger(a.treeSeed) && a.treeSeed >= 0);
});

await check("Assist: hp 8, pools of 16 u, the roots reach by themselves from 22 s", () => {
  const st = root.create(3, DEFAULT_CARRY, { ...OPTS, assist: true });
  assert.equal(st.A.p.hp, 8);
  root.jump(st, "roots");
  const v = root.view(st).marks.find((m) => m.kind === "pool");
  assert.ok(v.r >= 16 - 1e-6);
  let first = null;
  while (st.moment === "roots" && first === null) {
    root.step(st, makeIntents());
    if (st.events.some((e) => e.name === "caption" && e.id === "root.anyway")) first = st.t - st.m0;
    st.events.length = 0;
  }
  near(first, 22, DT * 2, "the first link by itself");
});

await check("resume gives 1.2 s of i-frames; the same seed and bot play the same stage", () => {
  const st = rootsAt(2);
  root.resume(st);
  assert.ok(st.A.p.inv >= 1.2);
  const a = play(5, botIn(0.7, 5)), b = play(5, botIn(0.7, 5));
  assert.deepEqual(a.res, b.res);
});

await check("the draw list is valid every 30th view of the ref and idle runs; the lining strip shows in the roots", () => {
  for (const r of [...REF.slice(0, 3), ...IDLE.slice(0, 3)]) assert.deepEqual(r.bad, []);
  const st = rootsAt(1);
  const d = root.view(st);
  const ln = d.strips.find((s) => s.kind === "lining");
  assert.ok(ln && ln.grid.length === ln.n * ln.n && ln.knots.length >= 12);
  assert.notEqual(ln.grid, st.map.grid, "the view hands out a copy of the ground");
});

await check("p99 of a step stays under 1 ms", () => {
  const st = root.create(4, DEFAULT_CARRY, OPTS), bot = createBot(1, 4);
  const ts = [];
  while (!root.result(st).done) {
    const it = bot.intents(root, st);
    const t0 = process.hrtime.bigint();
    root.step(st, it);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
    st.events.length = 0;
  }
  ts.sort((a, b) => a - b);
  PERF.p99 = ts[Math.floor(ts.length * 0.99)];
  assert.ok(PERF.p99 < 1, `p99 ${PERF.p99.toFixed(3)} ms`);
});

// ---- the gates

await check("gates: skill 1.0 Great or better in 18 of 20, at most 1 knock-out, mean at least 8,500", () => {
  const great = REF.filter((r) => ["Great", "Glowing"].includes(gradeOf(r.res.score.total, r.res.goalMet))).length;
  assert.ok(great >= 18, `Great or better in ${great} of 20`);
  assert.ok(REF.filter((r) => r.res.metrics.ko).length <= 1);
  const mean = REF.reduce((a, r) => a + r.res.score.total, 0) / REF.length;
  assert.ok(mean >= 8500, `mean ${Math.round(mean)}`);
});

await check("gates: skill 0.5 not knocked out in 16 of 20; one-button completes with no knock-out in 18 of 20; idle completes or rests", () => {
  assert.ok(MID.filter((r) => !r.res.metrics.ko).length >= 16, `skill 0.5 knocked out in ${MID.filter((r) => r.res.metrics.ko).length}`);
  const one = ONE.filter((r) => r.res.goalMet && !r.res.metrics.ko).length;
  assert.ok(one >= 18, `one-button completes in ${one} of 20`);
  for (const r of IDLE) {
    assert.ok(r.res.done, "idle ends");
    assert.ok(r.res.goalMet || r.res.metrics.ko, "idle completes or is knocked out");
    assert.equal(r.res.metrics.err, null);
  }
  assert.ok(MID.reduce((a, r) => a + r.res.score.total, 0) > IDLE.reduce((a, r) => a + r.res.score.total, 0), "skill 0.5 outscores idle");
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  const mean = (list) => Math.round(list.reduce((a, r) => a + r.res.score.total, 0) / list.length);
  const meanT = (list) => (list.reduce((a, r) => a + r.st.t, 0) / list.length).toFixed(1);
  const ko = (list) => list.filter((r) => r.res.metrics.ko).length;
  console.log(`PASS ${FILE}: ${passed} checks (ref ${mean(REF)} in ${meanT(REF)} s, 0.5 ${mean(MID)} in ${meanT(MID)} s with ${ko(MID)} KO, one-button ${mean(ONE)}, idle ${mean(IDLE)} in ${meanT(IDLE)} s with ${ko(IDLE)} KO; p99 step ${PERF.p99.toFixed(3)} ms)`);
}
