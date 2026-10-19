// First Breath: the draw list (design.md 16.5, 14.3). validate() passes an empty list and a full one with every
// strip, mark and ring kind, and names each problem in bad lists (budgets, kinds, ranges, shapes). The shared lib's
// draw-list parts are checked too: the baby figure (at most 14 splats, buds before week 8, limbs after, head down
// when asked) and the villous tree (its caps, pipe widths, a valid tree strip), plus the world-space helpers (sub-
// goals, steering, currents). Once core/stages/index.js exists, every 30th view of each stage's idle run (and its
// ref run, once core/bots.js exists) must validate against LIMITS, and core/ending.js's too.
// node qa/first-breath/draw.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LIMITS, emptyDraw, validate } from "../../public/first-breath/core/draw.js";
import { figure, POSES } from "../../public/first-breath/core/lib/figure.js";
import { createTree, growTree, addNode, TREE } from "../../public/first-breath/core/lib/colonize.js";
import { subgoal, doneBy, reach, turnToward, wrapAngle } from "../../public/first-breath/core/lib/goals.js";
import { steerBody, STEER } from "../../public/first-breath/core/lib/steer.js";
import { curl, tubeFlow, wallRamp, makeNoise } from "../../public/first-breath/core/lib/flow.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";

const FILE = "qa/first-breath/draw.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

// A list with one of everything, inside every budget.
function full() {
  const d = emptyDraw("egg");
  d.camera = { x: 0, y: 0, span: 140, rot: 0, orient: "long", mmPerU: 0.4 / 140 };
  d.scale = { you: "0.1 mm" };
  d.light = { level: 0.8, warm: 0.6, exposure: 1.2, white: 0, vignette: 0.4, tint: 0.03 };
  d.warp = 0.3; d.caustics = 0;
  d.splats = Array.from({ length: 32 }, (_, i) => (i % 2
    ? { k: "c", x: i, y: 0, r: 2, m: 1, n: 0, v: 0, hue: 0.1 }
    : { k: "s", x: i, y: 0, r: 1.5, x2: i + 2, y2: 1, m: 1, n: 0.2, v: 0, hue: 0.1 }));
  const n = 600;
  d.points = { n, xy: new Float32Array(2 * n), a: new Float32Array(n).fill(0.5), hue: 0.08 };
  d.strips = [
    { kind: "tails", items: Array.from({ length: 25 }, (_, i) => ({ x: i, y: 1, ang: 0, len: 10, phase: 0.1 * i, hue: 0.1, ring: i === 0 ? "dashed" : null })) },
    { kind: "cilia", a: [-20, -10], b: [20, -10], count: 24, phase: 0.2, amp: 1 },
    { kind: "arc", x: 0, y: 0, r: 16, a0: -0.6, a1: 0.6, w: 3, glow: 1 },
    { kind: "ripples", items: [{ x: 3, y: 3, r: 2, a: 0.5, dashed: false }] },
    { kind: "cord", pts: [0, 0, 5, 5, 10, 8], lights: [0.2, 0.7] },
    { kind: "course", pts: [0, 0, 0, 50, 10, 100], w: [160, 120, 40], tone: "womb" },
  ];
  d.marks = Array.from({ length: 24 }, (_, i) => ({ kind: i === 0 ? "band" : i === 1 ? "meet" : "pool", x: i, y: i, r: 16, w: 8, rim: "dotted", on: true, pulse: 0.5, ang: 0 }));
  d.rings = Array.from({ length: 8 }, (_, i) => ({ id: "r" + i, kind: i === 0 ? "mother" : "burrow", x: 0, y: 0, r: 4, progress: 0.5, dashed: i === 1, dotted: i > 1, grade: null }));
  d.anchor = { x: 0, y: 0 };
  d.cue = { x: 16, y: 0 };
  return d;
}
// Each bad list must produce a problem matching its pattern.
function bad(mutate, pattern) {
  const d = full();
  mutate(d);
  const out = validate(d);
  assert.ok(out.some((l) => pattern.test(l)), `expected ${pattern} in [${out.join("; ")}]`);
}

await check("LIMITS are the 16.5 and 14.3 budgets", () => {
  assert.deepEqual({ ...LIMITS }, { splats: 32, points: 600, strips: 6, marks: 24, rings: 8, tails: 25, cordPts: 16, coursePts: 32, treeNodes: 260,
    laneNotes: 24, bullets: 640, foes: 48, pickups: 96, tells: 16, pops: 12, bursts: 16, hp: 12 });
});

// The action layer's part (contract.md): a full one inside every budget, and bad ones named.
function fullAction() {
  const nb = 640, nk = 96;
  return {
    bullets: { n: nb, xy: new Float32Array(2 * nb), r: new Float32Array(nb).fill(1.2), tone: new Uint8Array(nb).map((_, i) => i % 4) },
    foes: Array.from({ length: 48 }, (_, i) => ({ kind: ["germ", "blob", "spore", "ring", "boss", "rival", "cell", "drop", "guard"][i % 9],
      x: i, y: -i, r: 2 + (i % 3), ang: 0.1 * i, hp: (i % 5) / 4, flash: 0, born: 1, boss: i === 4, phase: 0 })),
    pickups: { n: nk, xy: new Float32Array(2 * nk), kind: new Uint8Array(nk).map((_, i) => i % 3), a: new Float32Array(nk).fill(1) },
    player: { x: 0, y: 0, r: 1.7, body: 3, ang: 0, inv: 0.5, dash: 0, ready: 1 },
    arena: { x: 0, y: 0, r: 46 },
    zone: { x: 0, y: 0, r: 30, next: { x: 2, y: 1, r: 12 } },
    tells: ["line", "fan", "ring", "spot", "charge"].map((kind, i) => ({ kind, x: i, y: 0, ang: 0, r: 6, len: 40, w: 1.2, p: i / 4 })),
    pops: Array.from({ length: 12 }, (_, i) => ({ x: i, y: 0, v: 10 * i, a: 1 - i / 12, combo: i })),
    hp: { n: 3, max: 5 }, shake: 0.4, flash: 0.2,
  };
}
await check("action: a full action part validates, and bad ones are named", () => {
  const d = emptyDraw("grow");
  assert.equal(d.action, null, "an empty list has no action part");
  d.action = fullAction();
  assert.deepEqual(validate(d), []);
  const bad = (edit, want) => {
    const x = emptyDraw("grow");
    x.action = fullAction();
    edit(x.action);
    const got = validate(x);
    assert.ok(got.some((m) => m.includes(want)), `${want}: ${JSON.stringify(got)}`);
  };
  bad((a) => { a.bullets = { n: 641, xy: new Float32Array(1282), r: new Float32Array(641).fill(1), tone: new Uint8Array(641) }; }, "641 (max 640)");
  bad((a) => { a.bullets.tone[3] = 4; }, "tone[3] is 4");
  bad((a) => { a.bullets.xy = new Float32Array(4); }, "action.bullets.xy is not a Float32Array of 2n");
  bad((a) => { a.foes.push({ kind: "germ", x: 0, y: 0, r: 1 }); }, "49 foes (max 48)");
  bad((a) => { a.foes[0].kind = "monster"; }, "action.foes[0].kind is monster");
  bad((a) => { a.foes[1].hp = 2; }, "action.foes[1].hp is not in 0..1");
  bad((a) => { a.pickups.kind[0] = 3; }, "action.pickups.kind[0] is 3");
  bad((a) => { a.player.r = 0; }, "action.player.r is not > 0");
  bad((a) => { a.zone.next.r = -1; }, "action.zone.next.r is not > 0");
  bad((a) => { a.tells[0].kind = "laser"; }, "action.tells[0].kind is laser");
  bad((a) => { a.tells[1].p = 1.5; }, "action.tells[1].p is not in 0..1");
  bad((a) => { a.pops.push({ x: 0, y: 0, v: 1, a: 1 }); }, "13 pops (max 12)");
  bad((a) => { a.hp = { n: 6, max: 5 }; }, "action.hp is not");
  bad((a) => { a.shake = 2; }, "action.shake is not in 0..1");
});

await check("an empty list and a full list both validate", () => {
  assert.deepEqual(validate(emptyDraw()), []);
  assert.equal(emptyDraw().stage, "swim");
  assert.equal(emptyDraw("ending").stage, "ending");
  assert.deepEqual(validate(full()), []);
  const other = full();
  other.strips = [
    { kind: "chevrons", pts: [0, 0, 0, 10, 0, 20], w: 6, phase: 0.3 },
    { kind: "tree", nodes: new Float32Array([0, 0, -1, 2, 0, 6, 0, 1]), version: 1, pulse: 0.2 },
  ];
  other.points = null; other.cue = null; other.scale = { mm: 1 };
  assert.deepEqual(validate(other), []);
});

await check("budgets: splats, points, strips, marks, rings, tails, cord and course points", () => {
  bad((d) => d.splats.push({ k: "c", x: 0, y: 0, r: 1, m: 1, n: 0, v: 0, hue: 0 }), /33 splats/);
  bad((d) => { d.points = { n: 601, xy: new Float32Array(1202), a: new Float32Array(601), hue: 0 }; }, /601 points/);
  bad((d) => d.strips.push({ kind: "ripples", items: [] }), /7 strips/);
  bad((d) => d.marks.push({ kind: "glow", x: 0, y: 0, r: 2 }), /25 marks/);
  bad((d) => d.rings.push({ id: "x", kind: "you", x: 0, y: 0, r: 2 }), /9 rings/);
  bad((d) => d.strips[0].items.push({ x: 0, y: 0, ang: 0, len: 1, phase: 0, hue: 0, ring: null }), /26 items/);
  bad((d) => { d.strips[4].pts = Array.from({ length: 34 }, (_, i) => i); d.strips[4].lights = []; }, /17 points \(max 16\)/);
  bad((d) => { d.strips[5].pts = Array.from({ length: 66 }, (_, i) => i); d.strips[5].w = new Array(33).fill(10); }, /33 points \(max 32\)/);
  bad((d) => { d.strips[1] = { kind: "tree", nodes: new Float32Array(4 * 261).fill(0), version: 0, pulse: 0 }; }, /261 nodes/);
});

await check("shapes, kinds and ranges", () => {
  assert.deepEqual(validate(null), ["the draw list is not an object"]);
  bad((d) => { d.stage = ""; }, /stage/);
  bad((d) => { delete d.camera; }, /camera is missing/);
  bad((d) => { d.camera.span = 0; }, /camera\.span/);
  bad((d) => { d.camera.orient = "wide"; }, /camera\.orient/);
  bad((d) => { d.camera.mmPerU = NaN; }, /mmPerU/);
  bad((d) => { d.scale = {}; }, /scale has neither/);
  bad((d) => { d.light.exposure = 7; }, /exposure/);
  bad((d) => { d.light.white = 1.5; }, /light\.white/);
  bad((d) => { d.warp = -0.1; }, /warp/);
  bad((d) => { d.splats[0].k = "blob"; }, /splats\[0\]\.k/);
  bad((d) => { d.splats[0].x2 = undefined; }, /splats\[0\]\.x2/);
  bad((d) => { d.splats[1].r = -1; }, /splats\[1\]\.r/);
  bad((d) => { d.points.xy = [0, 0]; }, /Float32Array/);
  bad((d) => { d.points.xy[3] = NaN; }, /points\.xy\[3\]/);
  bad((d) => { d.points.id = [0, 1]; }, /points\.id is not a Float32Array/);
  bad((d) => { d.points.id = new Float32Array(d.points.n).fill(0.5); }, /points\.id\[0\]/);
  bad((d) => { d.strips[0].kind = "spiral"; }, /strips\[0\]\.kind is spiral/);
  bad((d) => { d.strips[0].items[0].ring = "gold"; }, /ring is gold/);
  bad((d) => { d.strips[1].a = [0]; }, /\.a is not \[x, y\]/);
  bad((d) => { d.strips[2].r = 0; }, /arc\)\.r/);
  bad((d) => { d.strips[4].lights = [2]; }, /lights are not 0\.\.1/);
  bad((d) => { d.strips[5].w = [1, 2]; }, /one width per point/);
  bad((d) => { d.strips[5].tone = "hot"; }, /tone is hot/);
  bad((d) => { d.strips[5].pts = [0, 0, 1]; }, /odd length/);
  bad((d) => { d.strips[1] = { kind: "tree", nodes: new Float32Array([0, 0, -1, 1, 1, 1, 5, 1]), version: 0, pulse: 0 }; }, /parent 5/);
  bad((d) => { d.marks[0].w = undefined; }, /marks\[0\]\.w/);
  bad((d) => { d.marks[2].kind = "rock"; }, /marks\[2\]\.kind/);
  bad((d) => { d.marks[2].rim = "zigzag"; }, /rim is zigzag/);
  bad((d) => { d.rings[0].kind = "star"; }, /rings\[0\]\.kind/);
  bad((d) => { d.rings[1].id = "r0"; }, /repeats/);
  bad((d) => { d.rings[0].progress = 2; }, /progress/);
  bad((d) => { d.rings[0].grade = "great"; }, /grade is great/);
  bad((d) => { d.anchor = null; }, /anchor/);
  bad((d) => { d.cue = { x: 1 }; }, /cue/);
});

// The baby figure (14.4).
const inList = (splats, stage = "grow") => { const d = emptyDraw(stage); d.splats = splats; return validate(d); };
await check("figure: at most 14 valid splats for every pose, size and gaDay", () => {
  for (const pose of [...POSES, "unknown", { name: "kick", p: 0.5 }, { name: "headDown", p: 0.3 }]) {
    for (const g of [36, 40, 42, 49, 55, 56, 63, 70, 91, 140, 200, 252, 280]) {
      for (const size of [2, 20, 60]) {
        const s = figure(pose, size, g, { x: 5, y: -3, rot: 0.4 });
        assert.ok(s.length <= 14, `${JSON.stringify(pose)} at ${g}: ${s.length} splats`);
        assert.deepEqual(inList(s), [], `${JSON.stringify(pose)} at ${g}`);
      }
    }
  }
});

await check("figure: buds before week 8 grow from nothing, two capsules per limb after, the heart from Day 22", () => {
  const caps = (g) => figure("curl", 10, g).filter((p) => p.k === "s").length;   // body + limb capsules
  assert.equal(caps(37), 1, "no buds before gaDay 38");
  assert.equal(caps(42), 5, "4 buds at week 6");
  assert.equal(caps(56), 9, "8 limb capsules from week 8");
  const bud = (g) => { const b = figure("curl", 10, g).filter((p) => p.k === "s")[1]; return Math.hypot(b.x2 - b.x, b.y2 - b.y); };
  assert.ok(bud(42) < bud(49) && bud(49) < bud(55), "the buds grow");
  const heart = (g) => figure("curl", 10, g).some((p) => p.v === 1);
  assert.equal(heart(35), false);
  assert.equal(heart(36), true);
  const head = figure("curl", 10, 140)[0], body = figure("curl", 10, 140)[1];
  assert.ok(head.y > body.y, "head up");
  const down = figure("headDown", 10, 250);
  assert.ok(down[0].y < down[1].y, "headDown puts the head below the body");
  const f = figure("curl", 10, 140, { x: 100, y: 50 });
  near(f[0].x - figure("curl", 10, 140)[0].x, 100, 1e-9, "at.x moves it");
  const round = (g) => figure("curl", 10, g)[1].r;
  assert.ok(round(252) > round(190), "the body rounds out from week 28");
  assert.equal(new Set(figure("thumb", 10, 91).map((p) => p.k)).size, 2, "only circles and capsules");
});

// The villous tree (6.4).
await check("colonize: deterministic growth within its caps, with pipe widths and a valid tree strip", () => {
  const make = () => createTree({ seed: 9, root: { x: 0, y: 0 }, region: { x: 0, y: 60, r: 90 } });
  const a = make(), b = make();
  assert.equal(a.n, 1);
  assert.equal(TREE.maxNodes, 260);
  const first = growTree(a);
  assert.ok(first <= 3, `one call is at most 2 iterations from the root: grew ${first}`);
  growTree(b);
  let steps = 0;
  while (steps++ < 400) { const x = growTree(a); growTree(b); if (!x && steps > 5) break; }
  assert.deepEqual(Array.from(a.view), Array.from(b.view), "the same seed grows the same tree");
  assert.ok(a.n > 40 && a.n <= 260, `${a.n} nodes`);
  assert.ok(a.version > 0);
  assert.equal(a.view.length, 4 * a.n);
  for (let i = 1; i < a.n; i++) {
    const p = a.view[4 * i + 2];
    assert.ok(p >= 0 && p < i, `node ${i} parent ${p}`);
    const d = Math.hypot(a.view[4 * i] - a.view[4 * p], a.view[4 * i + 1] - a.view[4 * p + 1]);
    near(d, 6, 1e-3, `node ${i} is D from its parent`);
  }
  const widths = Array.from({ length: a.n }, (_, i) => a.view[4 * i + 3]);
  assert.ok(widths.every((w) => w >= 1 - 1e-6), "leaves are at least leafW");
  assert.equal(Math.max(...widths), widths[0], "the root is the widest");
  const d = emptyDraw("root");
  d.strips = [{ kind: "tree", nodes: a.view, version: a.version, pulse: 0.3 }];
  assert.deepEqual(validate(d), []);
  // keep growing with plenty of points: never past 260 nodes
  const big = createTree({ seed: 2, region: { x: 0, y: 0, r: 400 }, dk: 2, D: 3 });
  for (let i = 0; i < 400; i++) growTree(big);
  assert.ok(big.n <= 260, `cap: ${big.n}`);
  assert.equal(growTree(big, { iterations: 50 }), 0, "full: no more nodes");
  assert.ok(createTree({ N: 5000 }).px.length <= 400, "at most 400 points");
});

await check("colonize: active discs limit growth, and addNode places the stage's own node", () => {
  const t = createTree({ seed: 4, root: { x: 0, y: 0 }, region: { x: 0, y: 0, r: 150 } });
  for (let i = 0; i < 100; i++) growTree(t, { active: [{ x: 60, y: 0, r: 60 }] });
  let far = 0;
  for (let i = 1; i < t.n; i++) if (t.view[4 * i] < -60) far++;
  assert.equal(far, 0, "nothing grows toward points outside the active disc");
  const v = t.version, i = addNode(t, -2, -1);
  assert.equal(i, t.n - 1);
  assert.ok(t.version > v);
  assert.equal(t.view[4 * i + 2], 0, "joined to the nearest node (the root)");
});

// World-space helpers.
await check("goals: sub-goals are shown, then done or auto, each once, each with an event", () => {
  const st = { t: 3, events: [], subgoals: {} };
  assert.equal(subgoal(st, "warm", "swim.warmWay"), true);
  assert.equal(subgoal(st, "warm", "swim.warmWay"), false, "shown once");
  assert.equal(doneBy(st, "warm", "you", "swim.warmDone"), true);
  assert.equal(doneBy(st, "warm", "auto", "x"), false, "settled once");
  doneBy(st, "rest", "auto", "swim.restAuto");
  assert.deepEqual(st.subgoals, { warm: "done", rest: "auto" });
  assert.deepEqual(st.events.map((e) => [e.name, e.id, e.state, e.text, e.t]), [
    ["subgoal", "warm", "shown", "swim.warmWay", 3], ["subgoal", "warm", "done", "swim.warmDone", 3],
    ["subgoal", "rest", "auto", "swim.restAuto", 3]]);
  assert.equal(reach({ x: 3, y: 4 }, { x: 0, y: 0 }, 5), true);
  assert.equal(reach([3, 4.1], [0, 0], 5), false);
});

await check("goals.turnToward turns the short way at its rate; wrapAngle", () => {
  near(turnToward(0, Math.PI / 2, Math.PI, 0.25), Math.PI / 4, 1e-12, "capped by the rate");
  near(turnToward(0, 0.1, 10, 1), 0.1, 1e-12, "arrives");
  near(turnToward(3, -3, 1, 0.1), 3.1, 1e-12, "across ±π the short way, unwrapped");
  near(wrapAngle(3 * Math.PI), Math.PI, 1e-12);
  near(wrapAngle(-Math.PI), Math.PI, 1e-12);
  near(wrapAngle(0.5 - 4 * Math.PI), 0.5, 1e-12);
});

await check("steer: 6.1's swim (55 u/s at full stick, accel 120, drag 1.8, turn 3 rad/s, ready ×1.6)", () => {
  assert.deepEqual({ ...STEER }, { top: 55, accel: 120, drag: 1.8, turn: 3.0 });
  const b = { ang: Math.PI / 2, speed: 0 };
  let v;
  for (let i = 0; i < 30; i++) v = steerBody(b, { x: 0, y: 1 }, DT);
  near(b.speed, 55, 1e-9, "at the top after 0.5 s (0.46 s at 120 u/s²)");
  near(v.y, 55, 1e-9, "forward is +y");
  for (let i = 0; i < 60; i++) steerBody(b, { x: 0, y: 1 }, DT, { mult: 1.6 });
  near(b.speed, 88, 1e-9, "ready: ×1.6 on the stick term");
  steerBody(b, { x: 0, y: 0 }, DT);
  near(b.speed, 88 * Math.exp(-1.8 * DT), 1e-9, "let go: eases down with drag");
  const t = { ang: 0, speed: 0 };
  steerBody(t, { x: -1, y: 0.0001 }, DT);
  near(t.ang, 3 * DT, 1e-9, "turns at 3 rad/s");
  const half = { ang: 0, speed: 0 };
  for (let i = 0; i < 120; i++) steerBody(half, { x: 0.5, y: 0 }, DT);
  near(half.speed, 27.5, 1e-9, "half stick, half speed");
});

await check("flow: tube current profile, Bridson's wall ramp, a divergence-free curl, seeded noise", () => {
  assert.equal(tubeFlow(0), 22);
  near(tubeFlow(0.9), 9.526, 1e-3, "9.5 u/s at r = 0.9");
  near(tubeFlow(1), 6.6, 1e-9, "the wall"); near(tubeFlow(-2), 6.6, 1e-9, "clamped");
  assert.equal(wallRamp(0), 0); assert.equal(wallRamp(1), 1); assert.equal(wallRamp(-3), -1);
  let prev = -1;
  for (let r = -1; r <= 1; r += 0.05) { const w = wallRamp(r); assert.ok(w >= prev - 1e-12); prev = w; }
  near(wallRamp(0.999), 1, 1e-6, "smooth into 1");
  const psi = makeNoise(7, 30);
  assert.equal(psi(12.5, -4), makeNoise(7, 30)(12.5, -4), "seeded");
  assert.notEqual(psi(12.5, -4), makeNoise(8, 30)(12.5, -4));
  for (let i = 0; i < 50; i++) { const v = psi(i * 7.3, i * -3.1); assert.ok(v >= -1 && v <= 1); }
  const field = (x, y) => curl(psi, x, y, 0.5);
  const h = 0.5;                                  // the same stencil as the curl: the differences cancel exactly
  for (const [x, y] of [[3, 4], [40, -12], [-70, 33]]) {
    const div = (field(x + h, y).x - field(x - h, y).x) / (2 * h) + (field(x, y + h).y - field(x, y - h).y) / (2 * h);
    assert.ok(Math.abs(div) < 1e-12, `divergence ${div}`);
    assert.ok(Math.hypot(field(x, y).x, field(x, y).y) > 0, "a real flow");
  }
});

// Every stage's views, once the stages exist.
const CORE = new URL("../../public/first-breath/core/", import.meta.url);
const has = (p) => existsSync(fileURLToPath(new URL(p, CORE)));
if (has("stages/index.js")) {
  const { STAGES } = await import(new URL("stages/index.js", CORE).href);
  const { DEFAULT_CARRY } = await import(new URL("carry.js", CORE).href);
  const bots = has("bots.js") ? await import(new URL("bots.js", CORE).href) : null;
  const mods = [...(STAGES || [])];
  if (has("ending.js")) mods.push(await import(new URL("ending.js", CORE).href));
  for (const mod of mods) {
    const id = mod.meta.id;
    for (const who of bots ? ["idle", "ref"] : ["idle"]) {
      await check(`${id}: every 30th view of the ${who} run validates`, () => {
        const st = mod.create(1, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
        const bot = who === "ref" ? bots.createBot(1, 1) : null;
        const maxSteps = Math.ceil(((mod.meta.capS || 120) + 5) / DT);
        let views = 0;
        for (let i = 0; i <= maxSteps && !mod.result(st).done; i++) {
          if (i % 30 === 0) {
            const out = validate(mod.view(st));
            assert.deepEqual(out, [], `step ${i} (t ${st.t.toFixed(2)} s, moment ${st.moment})`);
            views++;
          }
          mod.step(st, bot ? bot.intents(mod, st) : makeIntents());
          st.events.length = 0;
        }
        assert.deepEqual(validate(mod.view(st)), [], "the last view");
        assert.ok(views > 0);
      });
    }
  }
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks${has("stages/index.js") ? "" : " (no core/stages/index.js yet: the per-stage views wait for it)"}`);
}
