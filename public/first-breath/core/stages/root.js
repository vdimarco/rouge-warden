// First Breath: stage 4, The Placenta (`root`): "Grow roots." An action-adventure on the shared action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres design.md 5.4 and contract.md). Pure: no DOM, no
// clocks, no storage, no Math.random; every draw comes from stream(seed, name). step() never throws.
//
// Moment by moment:
// 1. nestle (Days 20 to 23, up to 8 s, drag): you drift over the soft lining while it slides by (v1). Touch one of 3
//    soft spots and you sink in; idle (or still drifting) at 5 s and the nearest draws you in over 3 s.
// 2. roots (Days 25 to 35, up to 58 s, move): the lining map round your spot (core/stages/root.map.js): soft tissue
//    you tunnel through slowly, open fluid and your tunnels you swim fast, firm tissue that blocks you until strong
//    roots. The press is the grapple: a root tendril fires the way you move, snaps to the nearest knot or pool rim in
//    its cone and reach, and pulls you there (through soft tissue, cutting a tunnel; firm tissue stops it). Follow
//    the compass ping (every 4 of her beats, from the nearest pool; an edge arrow when it is off screen) to 8 pools:
//    3 in open fluid, 3 under soft tissue, 2 walled in firm tissue with a guard germ. Enter one and it links: a glow
//    runs back along your roots. 3 pools: a longer reach; 5: strong roots that dig firm tissue. A few germs wander in;
//    your root sparks pop them. From 30 s the nearest pool links by itself every 4 s, so all 8 link by 58 s. The tree
//    of your roots follows your path and reaches each pool.
// 3. heart (Day 22, 6 s, none): the world hushes for 1.5 s (germs freeze and gather near the roots, her heart 8 dB
//    down, the light 10% down); then your heart beats by itself at 110 bpm and each of its first 8 beats sends a
//    bright pulse down the root tree that pops every germ within 40 u of it. "This beat is yours."
// 4. grow (7 s, Day 36 to week 7, none): v1: you grow from 2 to 10 mm, the camera pulls back over the whole map, the
//    tree thickens into a disc ("This will become your placenta.").
// A knock-out (hp 0, in the roots) rests until the captions are read, then ends the stage with its goal unmet; Go on
// (meta.goOn "heart") links the pools left ("The roots reach them anyway.") and plays the heart and grow by themselves.
//
// Score (5.4): Goal 3,000; Skill 3,000 × pools you linked / 8, 1,500 × hidden pools you linked / 5 (ticked at each
// link), 1,500 × pips left at the heart / 5; Flourish 1,000 for all 8 yourself before 40 s into the roots. Builder
// changes from the design are listed in root.tune.js.
import { DT, gaAt, mmPerShortAxis, bpmYou } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { stream } from "../rng.js";
import { figure } from "../lib/figure.js";
import { rimSparks } from "../lib/sparks.js";
import { createTree, addNode, nearestNode } from "../lib/colonize.js";
import * as X from "../lib/action.js";
import { actionSteer, goalSteer } from "../lib/actionbot.js";
import { noteCaptions as note, readBy } from "../lib/rest.js";
import { makeMap, cellAt, blocked, digAhead, carve, rayFirm, rayTissue, fluid, fieldOf, fieldAt, fieldStep, FIRM, EDGE, SOFT } from "./root.map.js";
import { TUNE } from "./root.tune.js";
import { FACTS } from "./root.facts.js";
import { TEXT } from "./root.text.js";

const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });
const N = TUNE.nestle, PL = TUNE.pools, KN = TUNE.knots, Y = TUNE.you, GP = TUNE.grapple, R = TUNE.roots;
const GE = TUNE.germs, GU = TUNE.guard, H = TUNE.heart, GR = TUNE.grow, S = TUNE.score, BT = TUNE.bot, MP = TUNE.map;

export const meta = Object.freeze({
  id: "root", index: 3, name: "The Placenta", verb: "Root",
  orient: "long",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 20, end: 49 }), fertilized: true,
  mm: Object.freeze({ start: 0.6, end: 30 }),
  action: true, goOn: "heart",
  motherBpm: TUNE.motherBpm, parS: 62, capS: TUNE.capS, canFail: true, scored: true,
  moments: Object.freeze([
    mo("nestle", 20, 23, N.lenS),
    mo("roots", 25, 35, R.lenS),
    mo("heart", 36, 36, H.lenS),
    mo("grow", 36, 49, GR.lenS),
  ]),
});

const TAU = Math.PI * 2;
const ORDER = ["nestle", "roots", "heart", "grow"];
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const P_DRIFT = Object.freeze({ gesture: "drag", text: "root.drift", keys: "steer" });
const P_MOVE = Object.freeze({ gesture: "move", text: "root.move", keys: "steer" });
const P_LISTEN = Object.freeze({ gesture: "none", text: "root.listen", keys: "steer" });
const P_SHAPE = Object.freeze({ gesture: "none", text: "root.shape", keys: "steer" });
const YOU_P = 60 / H.bpm;
const CONE = Math.tan((GP.coneDeg * Math.PI) / 180);
const MAG_SAFE = 1 - 1e-9;
const END_S = meta.capS + 30;
const EPS = 1e-9;

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const hyp = Math.hypot;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const mmAt = (g) => mmPerShortAxis(meta, g);

// ---- nestle layout (v1, seeded)

function laySpots(seed) {
  const r = stream(seed, "spots");
  const side = r() < 0.5 ? -1 : 1;
  const x = (s) => s * lerp(N.spotSide[0], N.spotSide[1], r());
  const a = { x: x(side), y: lerp(N.spotAhead[0], N.spotAhead[0] + 20, r()) };
  const b = { x: x(-side), y: lerp(N.spotAhead[0] + 10, N.spotAhead[1], r()) };
  const s2 = r() < 0.5 ? -1 : 1;
  const near = s2 === side ? a : b;
  const c = { x: x(s2), y: near.y + 34 + 10 * r() };
  return [a, b, c];
}
function layGlands(seed) {
  const r = stream(seed, "glands");
  const out = [];
  for (let i = 0; i < N.glands; i++) out.push({ x: lerp(-N.halfW, N.halfW, r()), y: 140 * (i + r()) / N.glands });
  return out;
}
function nearestSpot(st, x, y) {
  let best = 0, bd = Infinity;
  st.spots.forEach((s, i) => { const d = hyp(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ---- small helpers

// 1 on a beat of `heart`, easing to 0 over pulseS.
function pulse(st, heart, t) {
  const b = st.beats;
  if (heart === "you" && !(st.heart && t >= st.heart.first)) return 0;
  const per = 60 / b.bpm(heart, t);
  if (!(per > 0)) return 0;
  const since = clamp01(b.phase(heart, t)) * per;
  const k = clamp01(1 - since / PL.pulseS);
  return k * k;
}
const poolBase = (st) => (st.assist ? PL.assistR : PL.r);
const poolR = (st, t) => poolBase(st) * (1 + PL.swell * pulse(st, "mother", t));

function setPrompt(st, p) {
  if (st.prompt === p) return;
  st.prompt = p;
  emit(st, "prompt", { ...p });
}
function fact(st, id) {
  if (st.said[id]) return;
  st.said[id] = true;
  emit(st, "fact", { id, where: "caption" });
}
function caption(st, id) { emit(st, "caption", { id, dir: null }); }
function points(st, part, add) {
  if (!(add > 0)) return;
  st.pts[part] += add;
  emit(st, "points", { part, add });
}
function sfx(st, id, x, y, extra = {}) { emit(st, "sfx", { id, x, y, ...extra }); }
// a word pop (a DOM tag) at (x, y) for dur seconds
function tag(st, x, y, word, v = 0, dur = 1.0) {
  st.tags.push({ x, y, word, v, t0: st.t, dur });
  if (st.tags.length > 4) st.tags.shift();
}
function fx(st, kind, x, y, r = 10) {
  st.fx.push({ kind, x, y, r, t0: st.A.t });
  if (st.fx.length > 8) st.fx.shift();
}
function crumb(st, x, y, n, firm, ux = 0, uy = 0) {
  const r = st.rFx;
  for (let k = 0; k < n; k++) {
    const a = r() * TAU, s = 8 + 14 * r();
    st.crumbs.push({ x, y, vx: Math.cos(a) * s + ux * 10, vy: Math.sin(a) * s + uy * 10, t0: st.A.t, r: 0.5 + 0.6 * r(), firm: !!firm });
  }
  while (st.crumbs.length > 28) st.crumbs.shift();
}
function milestone(st, id) {
  if (st.fired[id]) return;
  st.fired[id] = true;
  emit(st, "milestone", { id });
}

// The pool the compass points at: the nearest unlinked one you can reach now (a walled one once your roots are
// strong), else the nearest unlinked one. −1 when all are linked.
function compassPool(st) {
  if (!st.A || !st.pools.length) return -1;
  const p = st.A.p;
  let best = -1, bd = Infinity, any = -1, ad = Infinity;
  st.pools.forEach((q, i) => {
    if (q.linked) return;
    const d = hyp(q.x - p.x, q.y - p.y);
    if (d < ad) { ad = d; any = i; }
    if (q.kind === "firm" && !st.strong) return;
    if (d < bd) { bd = d; best = i; }
  });
  return best >= 0 ? best : any;
}

// ---- the grapple

// The snap target for a tendril from (x, y) along (ux, uy): the nearest knot or pool rim within the reach and the
// cone (±15°, widened by the target's radius and some slack). → { kind, i, x, y } or null.
function snapTarget(st, x, y, ux, uy) {
  const reach = st.reach ? GP.reach3 : GP.reach;
  let best = null, bd = Infinity;
  const test = (cx, cy, rt) => {
    const vx = cx - x, vy = cy - y, proj = vx * ux + vy * uy;
    if (proj <= 0) return -1;
    const lat = Math.abs(vx * uy - vy * ux);
    if (lat > proj * CONE + rt + GP.slack) return -1;
    return hyp(vx, vy);
  };
  st.knots.forEach((k, i) => {
    const d = test(k.x, k.y, KN.r);
    if (d < 0 || d > reach + KN.r || d >= bd) return;
    bd = d; best = { kind: "knot", i, x: k.x, y: k.y };
  });
  const pr = poolBase(st);
  st.pools.forEach((q, i) => {
    const dc = hyp(q.x - x, q.y - y);
    if (dc <= pr) return;                            // you are in it
    const d = test(q.x, q.y, pr);
    if (d < 0) return;
    const rim = dc - pr;
    if (rim > reach || rim >= bd) return;
    bd = rim; best = { kind: "pool", i, x: q.x - ((q.x - x) / dc) * pr, y: q.y - ((q.y - y) / dc) * pr };
  });
  return best;
}

function aimOf(st, m) {
  const p = st.A.p, mm = hyp(m.x, m.y);
  const a = mm > 0.15 ? Math.atan2(m.y, m.x) : p.face;
  return { ux: Math.cos(a), uy: Math.sin(a) };
}

function fireGrapple(st, m) {
  const A = st.A, p = A.p, map = st.map;
  const { ux, uy } = aimOf(st, m);
  const reach = st.reach ? GP.reach3 : GP.reach;
  st.cdUntil = A.t + GP.cdS * (st.assist ? TUNE.assist.dashCdK || 0.7 : 1);
  st.grapples++;
  // the tendril flies through fluid and your tunnels; it sticks in tissue (soft or firm) and pulls you to it
  const tg = snapTarget(st, p.x, p.y, ux, uy);
  let g;
  if (tg) {
    const dx = tg.x - p.x, dy = tg.y - p.y, d = hyp(dx, dy) || 1e-6, vx = dx / d, vy = dy / d;
    const w = rayTissue(map, p.x, p.y, vx, vy, Math.max(0, d - (tg.kind === "knot" ? KN.r : 0)));
    g = w.d < d ? { kind: "wall", firm: w.firm, ux: vx, uy: vy, tx: p.x + vx * w.d, ty: p.y + vy * w.d }
      : { kind: tg.kind, i: tg.i, ux: vx, uy: vy, tx: tg.x, ty: tg.y };
  } else {
    const w = rayTissue(map, p.x, p.y, ux, uy, reach);
    g = w.d <= reach ? { kind: "wall", firm: w.firm, ux, uy, tx: p.x + ux * w.d, ty: p.y + uy * w.d }
      : { kind: "miss", ux, uy, tx: p.x + ux * reach, ty: p.y + uy * reach, dist: reach };
  }
  g.state = "shoot";
  g.len = 0;
  g.t0 = A.t;
  st.gr = g;
  sfx(st, "root.shoot", p.x, p.y);
}

function startPull(st, g) {
  const A = st.A, p = A.p;
  const dx = g.tx - p.x, dy = g.ty - p.y, d = hyp(dx, dy) || 1e-6;
  g.ux = dx / d; g.uy = dy / d;
  if (g.kind === "knot") g.left = Math.max(0, d - GP.stopU);
  else if (g.kind === "pool") g.left = d + poolBase(st) * 0.55;
  else g.left = Math.max(0, d - (Y.solidR + 1.6));
  g.state = "pull";
  g.p0 = A.t;
  p.fixed = true;
  p.vx = 0; p.vy = 0;
  X.hitStop(A, 2);
  A.juice.shake = Math.min(1, A.juice.shake + 0.18);
  sfx(st, "root.snap", g.tx, g.ty, { pitch: g.kind === "wall" ? 0 : 1 });
  sfx(st, "act.dash", p.x, p.y);
  if (g.kind === "wall") crumb(st, g.tx, g.ty, 4, g.firm);
}

function endPull(st, g) {
  const A = st.A, p = A.p;
  p.fixed = false;
  p.vx = g.ux * Y.swimUS * 0.5; p.vy = g.uy * Y.swimUS * 0.5;
  st.gr = null;
  A.juice.shake = Math.min(1, A.juice.shake + 0.22);
  crumb(st, p.x + g.ux * 3, p.y + g.uy * 3, 5, false, g.ux, g.uy);
}

function stepGrapple(st) {
  const g = st.gr;
  if (!g) return;
  const A = st.A, p = A.p;
  if (g.state === "shoot") {
    g.len += GP.shootUS * DT;
    if (g.kind === "miss") {
      if (g.len >= g.dist) { g.len = g.dist; g.state = "back"; g.b0 = A.t; }
      return;
    }
    if (g.len >= hyp(g.tx - p.x, g.ty - p.y)) startPull(st, g);
  } else if (g.state === "pull") {
    const stepU = Math.min(g.left, GP.pullUS * DT);
    const nx = p.x + g.ux * stepU, ny = p.y + g.uy * stepU;
    if (blocked(st.map, nx, ny, Y.solidR, st.strong)) { endPull(st, g); return; }
    p.x = nx; p.y = ny;
    g.left -= stepU;
    p.inv = Math.max(p.inv, 0.12);
    dig(st, p.x, p.y);
    if (g.left <= 1e-6) endPull(st, g);
  } else if (g.state === "back") {
    if (A.t - g.b0 >= GP.retractS) st.gr = null;
  }
}

// ---- the ground

function dig(st, x, y) {
  const c = carve(st.map, x, y, Y.carveR, st.strong);
  const n = c.soft + c.firm;
  if (!n) return 0;
  st.dug += n;
  const A = st.A, p = A.p;
  if (A.t - st.digSfx >= 0.13) { st.digSfx = A.t; sfx(st, "root.dig", x, y, { pitch: c.firm ? 1 : 0 }); }
  if (A.t - st.crumbT >= 0.07) {
    st.crumbT = A.t;
    const a = p.face;
    crumb(st, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, c.firm ? 2 : 1, c.firm > 0, Math.cos(a), Math.sin(a));
  }
  return n;
}

// Your speed from the ground ahead: soft tissue to dig 16 u/s, firm (strong roots) 12 u/s, else 40 u/s.
function groundSpeed(st, m) {
  const p = st.A.p, mm = hyp(m.x, m.y);
  let ux, uy;
  if (mm > 0.05) { ux = m.x / mm; uy = m.y / mm; } else {
    const v = hyp(p.vx, p.vy);
    if (v < 1) return Y.swimUS;
    ux = p.vx / v; uy = p.vy / v;
  }
  // the ground just past the tunnel you cut (a disc of carveR round you): tissue there means you are digging
  const k = digAhead(st.map, p.x + ux * Y.carveR, p.y + uy * Y.carveR, Y.carveR * 0.6, st.strong);
  return k === 2 ? Y.firmUS : k === 1 ? Y.digUS : Y.swimUS;
}

// Firm tissue keeps you out: slide along it.
function solidYou(st, x0, y0) {
  const p = st.A.p, map = st.map, rad = Y.solidR, s = st.strong;
  if (!blocked(map, p.x, p.y, rad, s)) return;
  if (!blocked(map, p.x, y0, rad, s)) { p.y = y0; p.vy = 0; return; }
  if (!blocked(map, x0, p.y, rad, s)) { p.x = x0; p.vx = 0; return; }
  p.x = x0; p.y = y0; p.vx = 0; p.vy = 0;
}

// Germs live in fluid: soft tissue slows them (softK), firm tissue turns them back.
function confineFoes(st) {
  const map = st.map;
  for (const f of st.A.foes) {
    if (f.in > 0 || !fin(f.px)) continue;
    const v = cellAt(map, f.x, f.y);
    if (v === FIRM || v === EDGE) { f.x = f.px; f.y = f.py; f.vx *= -0.6; f.vy *= -0.6; f.wob += Math.PI; }
    else if (v === SOFT) { f.x = f.px + (f.x - f.px) * GE.softK; f.y = f.py + (f.y - f.py) * GE.softK; }
  }
}

// Firm tissue stops sparks, both sides.
function wallBullets(st) {
  const B = st.A.b, map = st.map;
  for (let i = 0; i < B.n; i++) {
    if (B.age[i] >= B.life[i]) continue;
    const v = cellAt(map, B.x[i], B.y[i]);
    if (v !== FIRM && v !== EDGE) continue;
    B.age[i] = B.life[i];
    if (B.side[i] === 2 && st.A.t - st.plinkT > 0.1) { st.plinkT = st.A.t; crumb(st, B.x[i], B.y[i], 2, true); }
  }
}

// Hold fire at a germ behind firm tissue (your sparks would only hit the wall).
function holdFire(st) {
  const A = st.A, p = A.p, F = A.fire;
  if (!F) return;
  const f = X.nearestFoe(A, p.x, p.y, F.range);
  if (!f) return;
  const dx = f.x - p.x, dy = f.y - p.y, d = hyp(dx, dy);
  if (d > 1e-3 && rayFirm(st.map, p.x, p.y, dx / d, dy / d, d, false) < d) F.cool = Math.max(F.cool, 2 * DT);
}

// ---- germs

function germCount(st) { let n = 0; for (const f of st.A.foes) if (f.kind === "germ" && !f.frozen) n++; return n; }

// A germ in fluid, spawnU from you (or near `at`, for a pack that comes together).
function spawnGerm(st, at = null) {
  const A = st.A, p = A.p, map = st.map, r = st.rGerm;
  for (let tries = 0; tries < 40; tries++) {
    const a = r() * TAU, d = at ? 4 + 5 * r() : GE.spawnU[0] + (GE.spawnU[1] - GE.spawnU[0]) * r();
    const x = (at ? at.x : p.x) + Math.cos(a) * d, y = (at ? at.y : p.y) + Math.sin(a) * d;
    if (y - p.y < -GE.behindU) continue;
    if (!fluid(cellAt(map, x, y)) || blocked(map, x, y, GE.r, false)) continue;
    if (st.pools.some((q) => q.kind === "firm" && hyp(q.x - x, q.y - y) < MP.wallOut + 2)) continue;
    return X.spawnFoe(A, { kind: "germ", ai: "wander", x, y, r: GE.r, hp: GE.hp, speed: GE.wanderUS, value: GE.value,
      touch: GE.touch, drops: { heal: GE.heal }, spawnS: 0.6 });
  }
  return null;
}

function spawnGuard(st, i) {
  const q = st.pools[i], a = st.rGerm() * TAU;
  const f = X.spawnFoe(st.A, { kind: "guard", ai: "still", x: q.x + Math.cos(a) * GU.orbitR, y: q.y + Math.sin(a) * GU.orbitR,
    r: GU.r, hp: GU.hp, speed: 0, value: GU.value, touch: 1, mass: 3, anywhere: true, spawnS: 0.6, drops: { heal: 1 },
    gun: { pattern: GU.fan, every: GU.every, tellS: GU.tellS, first: 1.6, jitter: 0.1 } });
  if (f) { f.pool = i; f.orb = a; q.guard = f.id; }
}

function germAi(st) {
  const A = st.A, p = A.p;
  for (const f of A.foes) {
    f.px = f.x; f.py = f.y;
    if (f.in > 0 || f.frozen) continue;
    if (f.kind === "germ") {
      if (!A.ko && hyp(f.x - p.x, f.y - p.y) < GE.chaseR) { f.ai = "chase"; f.speed = GE.chaseUS; }
      else {
        f.ai = "wander"; f.speed = GE.wanderUS;
        const a = Math.atan2(p.y - f.y, p.x - f.x) - f.wob;      // its wander bends toward you
        f.wob += GE.driftW * DT * Math.sin(a);
      }
    } else if (f.kind === "guard") {
      const q = st.pools[f.pool];
      f.orb += GU.orbitW * DT;
      const tx = q.x + Math.cos(f.orb) * GU.orbitR, ty = q.y + Math.sin(f.orb) * GU.orbitR;
      f.vx = clamp((tx - f.x) * 3, -10, 10); f.vy = clamp((ty - f.y) * 3, -10, 10);
      if (hyp(f.x - p.x, f.y - p.y) > GU.wakeU && f.aim === null) f.cool = Math.max(f.cool, GU.tellS + 0.25);
    }
  }
}

// ---- the tree of your roots

// It follows your path: a node every D u, joined to the last, reusing a node you pass close to.
function trail(st) {
  const tr = st.tree, p = st.A.p, D = TUNE.tree.D;
  const k = st.trailNode;
  if (hyp(p.x - tr.nodes[4 * k], p.y - tr.nodes[4 * k + 1]) < D) return;
  const j = nearestNode(tr, p.x, p.y);
  if (j >= 0 && hyp(p.x - tr.nodes[4 * j], p.y - tr.nodes[4 * j + 1]) < 0.6 * D) { st.trailNode = j; return; }
  const n = addNode(tr, p.x, p.y, k);
  if (n >= 0) st.trailNode = n;
}
// A straight run of nodes from the nearest node to (x, y). → the last node.
function reachTree(st, x, y) {
  const tr = st.tree, D = TUNE.tree.D;
  let j = Math.max(0, nearestNode(tr, x, y));
  const jx = tr.nodes[4 * j], jy = tr.nodes[4 * j + 1], d = hyp(x - jx, y - jy);
  const steps = Math.floor(d / D);
  for (let s = 1; s <= steps; s++) {
    const k = addNode(tr, jx + ((x - jx) * s) / steps, jy + ((y - jy) * s) / steps, j);
    if (k < 0) break;
    j = k;
  }
  return j;
}
// The path of a node back to the root, as [x, y, ...], and its length.
function chainOf(tr, k) {
  const pts = [];
  let len = 0, i = k, guard = 0;
  while (i >= 0 && guard++ < 400) {
    const x = tr.nodes[4 * i], y = tr.nodes[4 * i + 1];
    if (pts.length) len += hyp(x - pts[pts.length - 2], y - pts[pts.length - 1]);
    pts.push(x, y);
    i = tr.nodes[4 * i + 2];
  }
  return { pts, len };
}
// Path lengths along the tree from node `from` to every node.
function treeDepth(tr, from) {
  const n = tr.n, nd = tr.nodes;
  const head = new Int32Array(n).fill(-1), next = new Int32Array(n).fill(-1);
  for (let i = 1; i < n; i++) { const pa = nd[4 * i + 2]; if (pa >= 0) { next[i] = head[pa]; head[pa] = i; } }
  const depth = new Float32Array(n).fill(Infinity), q = new Int32Array(n);
  let h = 0, t = 0;
  depth[from] = 0; q[t++] = from;
  while (h < t) {
    const i = q[h++];
    const go = (j) => {
      if (j < 0 || depth[j] !== Infinity) return;
      depth[j] = depth[i] + hyp(nd[4 * j] - nd[4 * i], nd[4 * j + 1] - nd[4 * i + 1]);
      q[t++] = j;
    };
    go(nd[4 * i + 2]);
    for (let c = head[i]; c >= 0; c = next[c]) go(c);
  }
  return depth;
}

// ---- linking

// Your roots grow stronger: a word pop by you (not a caption: the caption band is kept for the facts), a chime, a
// marigold ring, a short hold.
function upgrade(st, word, pitch, r) {
  const A = st.A;
  tag(st, A.p.x, A.p.y + 9, word, 0, 1.6);
  sfx(st, "act.up", A.p.x, A.p.y, { pitch });
  fx(st, "up", A.p.x, A.p.y, r);
  X.hitStop(A, R.upStop);
  A.juice.shake = Math.min(1, A.juice.shake + 0.3);
}

function link(st, i, by, quiet = false) {
  const q = st.pools[i];
  if (!q || q.linked) return;
  const A = st.A;
  q.linked = true; q.by = by; q.at = st.t;
  if (by === "you") { st.counts.you++; if (q.kind !== "open") st.counts.hidden++; } else st.counts.auto++;
  st.order.push((by === "you" ? "y" : "a") + i);
  const end = reachTree(st, q.x, q.y);
  const ch = chainOf(st.tree, end);
  st.glows.push({ t0: A.t, pts: ch.pts, len: ch.len, you: by === "you" });
  if (st.glows.length > PL.n) st.glows.shift();
  const total = st.counts.you + st.counts.auto;
  if (by === "you") {
    const add = Math.round(S.pools / PL.n) + (q.kind !== "open" ? Math.round(S.hidden / S.hiddenN) : 0);
    points(st, "skill", add);
    X.pop(A, q.x, q.y, add, 0);
    tag(st, A.p.x, A.p.y + 5, "root.plusRoot");
  }
  if (!quiet) {
    sfx(st, "root.link", q.x, q.y, { pitch: 1 + 0.06 * total, gain: by === "you" ? 1 : 0.6 });
    X.burst(A, q.x, q.y, poolBase(st), 2);
    fx(st, "link", q.x, q.y, poolBase(st));
    A.juice.shake = Math.min(1, A.juice.shake + (by === "you" ? 0.3 : 0.12));
    if (by === "auto") { caption(st, "root.anyway"); tag(st, q.x, q.y, "root.plusRoot"); }
    if (!st.said["root.glands"]) { fact(st, "root.hcg"); fact(st, "root.glands"); }   // in priority order
  }
  // a walled pool's guard drifts off once its pool is linked
  if (q.guard) {
    const f = A.foes.find((g) => g.id === q.guard);
    if (f) { X.burst(A, f.x, f.y, f.r, 2); X.removeFoe(A, f.id); }
    q.guard = 0;
  }
  if (!st.reach && total >= R.reachAt) {
    st.reach = true;
    if (!quiet) { upgrade(st, "root.reachPop", 1, 14); }
  }
  if (!st.strong && total >= R.strongAt) {
    st.strong = true;
    if (!quiet) { upgrade(st, "root.strongPop", 2, 18); }
  }
}

// ---- moments

function startMoment(st, i) {
  st.mi = i;
  st.moment = ORDER[i];
  st.m0 = st.t;
  st.gaDay = Math.max(st.gaDay, meta.moments[i].ga[0]);
  st.times[st.moment] = st.t;
  emit(st, "moment", { id: st.moment });
  if (st.moment === "nestle") {
    setPrompt(st, P_DRIFT);
    subgoal(st, "nestle", "root.goalSpot");
  } else if (st.moment === "roots") startRoots(st);
  else if (st.moment === "heart") startHeart(st);
  else if (st.moment === "grow") startGrow(st);
}

function startRoots(st) {
  const sp = st.spots[st.nest.spot];
  const o = { x: sp.x, y: sp.y };
  st.origin = o;
  // the map was laid out at create (round 0, 0): it moves to your spot
  const m = st.map0 || makeMap(st.seed, { x: 0, y: 0 }, TUNE);
  st.map0 = null;
  m.ox += o.x; m.oy += o.y;
  m.origin = { x: o.x, y: o.y };
  m.pools = m.pools.map((q) => ({ ...q, x: q.x + o.x, y: q.y + o.y }));
  m.knots = m.knots.map((k) => ({ x: k.x + o.x, y: k.y + o.y }));
  m.gen++;
  st.map = m;
  st.pools = st.map.pools.map((q) => ({ x: q.x, y: q.y, kind: q.kind, linked: false, by: null, at: null, guard: 0 }));
  st.knots = st.map.knots;
  st.tree = createTree({ seed: st.seed, root: o, points: [], maxNodes: TUNE.tree.maxNodes, D: TUNE.tree.D });
  st.trailNode = 0;
  const A = st.A, p = A.p;
  p.x = o.x; p.y = o.y; p.vx = 0; p.vy = 0; p.face = Math.PI / 2; p.fixed = false;
  st.cdUntil = A.t;
  st.germT = A.t + GE.everyS;
  st.herK = 0;
  for (let k = 0; k < Math.ceil(GE.start * st.assistK); k++) spawnGerm(st);
  st.pools.forEach((q, i) => { if (q.kind === "firm") spawnGuard(st, i); });
  setPrompt(st, P_MOVE);
  subgoal(st, "pools", "root.goalPools");
}

function startHeart(st) {
  const A = st.A, p = A.p;
  const h0 = st.t, first = h0 + H.hushS, g0 = h0 + H.lenS;
  st.gr = null;
  p.fixed = true; p.vx = 0; p.vy = 0;
  st.beats = makeBeats(st.seed, [
    { heart: "mother", from: 0, to: END_S, bpm: meta.motherBpm, jitter: 0, first: st.phaseIn },
    { heart: "you", from: first, to: g0, bpm: H.bpm, jitter: 0, first },
    { heart: "you", from: g0, to: g0 + GR.lenS, gaFrom: 36, gaTo: 49, jitter: 0 },
    { heart: "you", from: g0 + GR.lenS, to: END_S, bpm: bpmYou(49), jitter: 0 },
  ]);
  // germs freeze; foe sparks turn to sparkles
  for (const f of A.foes) { f.frozen = true; f.ai = "still"; f.touch = 0; f.gun = null; f.aim = null; f.vx *= 0.2; f.vy *= 0.2; }
  const B = A.b;
  for (let i = 0; i < B.n; i += Math.max(1, Math.ceil(B.n / 6))) if (B.side[i] === 2) X.burst(A, B.x[i], B.y[i], 2, 2);
  X.clearBullets(A, 0);
  A.tells.length = 0;
  const from = Math.max(0, nearestNode(st.tree, p.x, p.y));
  const depth = treeDepth(st.tree, from);
  let maxD = 0;
  for (let i = 0; i < depth.length; i++) if (depth[i] !== Infinity) maxD = Math.max(maxD, depth[i]);
  // the roots near you (within gatherU), by their path length from your heart: the pulses reach evenly over them
  const near = [];
  for (let i = 0; i < st.tree.n; i++) {
    const x = st.tree.nodes[4 * i], y = st.tree.nodes[4 * i + 1], dd = hyp(x - p.x, y - p.y);
    if (depth[i] !== Infinity && dd >= H.gatherU[0] && dd <= H.gatherU[1]) near.push(i);
  }
  near.sort((a, b) => depth[a] - depth[b]);
  let nearD = 0;
  for (const i of near) nearD = Math.max(nearD, depth[i]);
  // the camera drifts a little toward the middle of your roots (never more than camLagU off you)
  let cx = 0, cy = 0;
  for (let i = 0; i < st.tree.n; i++) { cx += st.tree.nodes[4 * i]; cy += st.tree.nodes[4 * i + 1]; }
  cx /= Math.max(1, st.tree.n); cy /= Math.max(1, st.tree.n);
  const cd = hyp(cx - p.x, cy - p.y), ck = cd > R.camLagU ? R.camLagU / cd : 1;
  st.heart = { h0, first, g0, k: 0, pulses: [], depth, maxD, from, near, nearD: Math.max(60, nearD),
    look: { x: p.x + (cx - p.x) * ck, y: p.y + (cy - p.y) * ck } };
  gather(st, H.gatherAt, 0.6);
  setPrompt(st, P_LISTEN);
  sfx(st, "root.hush", p.x, p.y, { pitch: 1, gain: H.hushDb });
  if (!A.ko && !st.wentOn) {
    st.pipsPart = Math.round((S.pips * Math.min(S.pipsN, Math.max(0, p.hp))) / S.pipsN);
    points(st, "skill", st.pipsPart);
  }
}

// Germs gather near the roots, frozen: one by each node at these shares (0..1) of the near roots' path lengths (in
// fluid, 4 to 16 u off the node), so the growing pulses pop some on every beat.
function gather(st, shares, spawnS) {
  const A = st.A, tr = st.tree, r = st.rHeart, h = st.heart;
  if (!tr || !h || !h.near.length) return;
  for (const share of shares) {
    for (let tries = 0; tries < 40; tries++) {
      const q = clamp(share + (tries ? (r() - 0.5) * 0.2 : 0), 0, 1);
      const j = h.near[Math.min(h.near.length - 1, Math.floor(q * h.near.length))], a = r() * TAU, off = 4 + 12 * r();
      const x = tr.nodes[4 * j] + Math.cos(a) * off, y = tr.nodes[4 * j + 1] + Math.sin(a) * off;
      if (!fluid(cellAt(st.map, x, y))) continue;
      const f = X.spawnFoe(A, { kind: "germ", ai: "still", x, y, r: GE.r, hp: GE.hp, speed: 0, value: GE.value, touch: 0, spawnS, anywhere: true });
      if (f) f.frozen = true;
      break;
    }
  }
}

function startGrow(st) {
  const A = st.A;
  setPrompt(st, P_SHAPE);
  sfx(st, "root.swell", A.p.x, A.p.y, { pitch: 1, gain: 1 });
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 2); X.removeFoe(A, f.id); }   // what is left drifts off
  let cx = st.origin.x, cy = st.origin.y;
  for (const q of st.pools) { cx += q.x; cy += q.y; }
  cx /= st.pools.length + 1; cy /= st.pools.length + 1;
  let r = 0;
  for (const q of st.pools) r = Math.max(r, hyp(q.x - cx, q.y - cy));
  st.disc = { x: cx, y: cy, r: Math.max(20, r * 0.9) };
}

// End the current moment (by itself, by a jump or at the cap): settle what it owes, gaDay to its end.
function endMoment(st) {
  const id = st.moment;
  if (id === "nestle") {
    const n = st.nest;
    if (n.state === "drift") { n.spot = nearestSpot(st, n.x, n.y); n.by = "auto"; }
    const sp = st.spots[n.spot];
    n.x = sp.x; n.y = sp.y; n.state = "in"; n.p = 1;
    doneBy(st, "nestle", n.by === "you" ? "you" : "auto", n.by === "you" ? "root.nestled" : "root.nestledAuto");
    milestone(st, "implanted");
  } else if (id === "roots") {
    for (let i = 0; i < st.pools.length; i++) if (!st.pools[i].linked) link(st, i, "auto", true);
    st.gr = null;
    fact(st, "root.hcg");
    const you = st.counts.you >= S.youDone;
    if (st.subgoals.pools === "shown") doneBy(st, "pools", you ? "you" : "auto", you ? "root.poolsDone" : "root.poolsAuto");
    if (!st.wentOn && st.counts.you === PL.n && st.lastYouS !== null && st.lastYouS < S.flourishS) {
      st.quick = true;
      points(st, "flourish", S.flourish);
    }
  } else if (id === "heart") {
    fact(st, "root.heart");
    milestone(st, "heart");
  } else if (id === "grow") {
    if (!st.said.placenta) { st.said.placenta = true; caption(st, "root.placenta"); }
  }
  st.gaDay = Math.max(st.gaDay, meta.moments[st.mi].ga[1]);
}

function finish(st, how) {
  if (st.done) return;
  if (how === "ko") {
    st.done = true; st.how = "ko"; st.goalMet = false; st.doneT = st.t;
    st.times.end = st.t;
    st.gaDay = Math.max(st.gaDay, meta.moments[1].ga[1]);
    milestone(st, "implanted");
    milestone(st, "heart");
    setPrompt(st, NONE);
    emit(st, "done", {});
    return;
  }
  while (st.mi < ORDER.length - 1) { endMoment(st); startMoment(st, st.mi + 1); }
  endMoment(st);
  st.done = true;
  st.how = st.wentOn ? "goOn" : how;
  st.goalMet = !st.wentOn && how !== "error";
  st.doneT = st.t;
  st.times.end = st.t;
  if (st.goalMet) points(st, "goal", S.goal);
  setPrompt(st, NONE);
  emit(st, "done", {});
}

// A knock-out: you rest. The germs drift off and the stage holds still until what was said has been read.
function knockOut(st) {
  const A = st.A;
  st.phase = "ko";
  st.koAt = st.t;
  st.gr = null;
  A.p.fixed = true;
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 0); X.removeFoe(A, f.id); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  if (st.subgoals.pools === "shown") doneBy(st, "pools", "auto", "root.rest");
  setPrompt(st, NONE);
}

// ---- one step of each moment

function readIntents(intents) {
  const it = intents || EMPTY_INTENTS;
  const s = it.steer && fin(it.steer.x) && fin(it.steer.y) ? it.steer : { x: 0, y: 0 };
  const m = hyp(s.x, s.y);
  return { steer: m > 1 ? { x: s.x / m, y: s.y / m } : { x: s.x, y: s.y }, touching: !!it.touching };
}

function stepNestle(st, it) {
  const n = st.nest, t1 = st.t + DT;
  if (n.state === "drift") {
    const s = it.steer;
    if (hyp(s.x, s.y) > 0.05 || it.touching) n.lastIn = st.t;
    const k = 1 - Math.exp(-N.ease * DT);
    n.vx += (N.driftUS * s.x - n.vx) * k;
    n.vy += (N.slideUS + N.driftUS * s.y - n.vy) * k;
    n.x = clamp(n.x + n.vx * DT, -N.halfW, N.halfW);
    n.y += n.vy * DT;
    for (let i = 0; i < st.spots.length; i++) {
      const sp = st.spots[i];
      if (hyp(sp.x - n.x, sp.y - n.y) <= N.spotR + N.youR) {
        Object.assign(n, { state: "sink", spot: i, by: "you", from: { x: n.x, y: n.y }, s0: t1, len: N.sinkS });
        break;
      }
    }
    const s0 = t1 - st.m0;
    if (n.state === "drift" && (t1 - n.lastIn >= N.idleS - EPS || s0 >= N.forceS - EPS)) {
      const i = nearestSpot(st, n.x, n.y);
      Object.assign(n, { state: "sink", spot: i, by: "auto", from: { x: n.x, y: n.y }, s0: t1, len: N.drawS });
    }
  }
  if (n.state === "sink") {
    const p = ease((t1 - n.s0) / n.len), sp = st.spots[n.spot];
    n.p = clamp01((t1 - n.s0) / n.len);
    n.x = lerp(n.from.x, sp.x, p);
    n.y = lerp(n.from.y, sp.y, p);
  }
}

// The world steps on with no input (the heart, grow and a knock-out's rest): bursts, pops and frozen germs. The
// caller sends A.out (X.emitOut) once its own pops are in.
function worldIdle(st) {
  const A = st.A;
  A.p.fixed = true;
  if (A.fire) A.fire.cool = Math.max(A.fire.cool, 1);
  return X.stepWorld(A, EMPTY_INTENTS);
}

function outcomes(st) {
  const A = st.A;
  for (const o of A.out) {
    if (o.type === "clear") { st.popped++; if (o.kind === "guard") { X.burst(A, o.x, o.y, 5, 2); A.juice.shake = Math.min(1, A.juice.shake + 0.3); } }
    else if (o.type === "pick" && o.kind === "heal") sfx(st, "act.heal", o.x, o.y);
  }
  X.emitOut(A, st);
}

function stepRoots(st, it) {
  const A = st.A, p = A.p, map = st.map;
  if (st.phase === "ko") { worldIdle(st); X.emitOut(st.A, st); return; }
  const m = X.moveOf(it);
  const pulling = st.gr && st.gr.state === "pull";
  p.fixed = !!pulling;
  if (!pulling) p.speed = groundSpeed(st, m);
  holdFire(st);
  germAi(st);
  const x0 = p.x, y0 = p.y;
  const moved = X.stepWorld(A, it);
  outcomes(st);
  if (A.ko) { knockOut(st); return; }
  if (!moved) return;
  if (!pulling) { solidYou(st, x0, y0); dig(st, p.x, p.y); }
  confineFoes(st);
  wallBullets(st);
  if (X.wantsDash(it) && !st.gr && A.t >= st.cdUntil - EPS) fireGrapple(st, m);
  stepGrapple(st);
  // links: you enter a pool
  const rr = poolR(st, st.t);
  for (let i = 0; i < st.pools.length; i++) {
    const q = st.pools[i];
    if (!q.linked && hyp(q.x - p.x, q.y - p.y) <= rr) { link(st, i, "you"); st.lastYouS = st.t + DT - st.m0; }
  }
  trail(st);
  // germs come: 2 more every 7 s up to 6, and from 24 s every 5 s up to 8
  if (A.t >= st.germT) {
    const late = st.t - st.m0 >= GE.lateS;
    st.germT += late ? GE.lateEveryS : GE.everyS;
    const cap = Math.ceil((late ? GE.lateMax : GE.max) * st.assistK);
    let first = null;
    for (let k = 0; k < (late ? GE.latePack : GE.pack) && germCount(st) < cap; k++) {
      const f = spawnGerm(st, first);
      if (!first && f) first = { x: f.x, y: f.y };
    }
  }
  // the compass: every 4 of her beats a ping from the pool it points at
  const b = st.beats.next("mother", st.t - EPS);
  if (fin(b) && b < st.t + DT - EPS && b > st.lastBeat + 0.1) {
    st.lastBeat = b;
    if (st.herK++ % R.pingBeats === 0) {
      const i = compassPool(st);
      if (i >= 0) { st.pings.push({ i, t0: A.t }); if (st.pings.length > 4) st.pings.shift(); sfx(st, "root.ping", st.pools[i].x, st.pools[i].y); }
    }
  }
  // the roots reach by themselves: from 30 s, the nearest pool every 4 s
  const s1 = st.t + DT - st.m0;
  const from = st.assist ? R.assistAutoFromS : R.autoFromS;
  while (st.autoK < PL.n && s1 >= from + R.autoEveryS * st.autoK - EPS) {
    st.autoK++;
    let best = -1, bd = Infinity;
    st.pools.forEach((q, i) => { if (!q.linked) { const d = hyp(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } } });
    if (best >= 0) link(st, best, "auto");
  }
  if (s1 >= R.hcgS) fact(st, "root.hcg");
}

// How far down the tree pulse k (0..7) runs: (k + 1) / 8 of the roots near you, and the last one the whole tree.
function pulseReach(h, k) {
  return k >= H.pulses - 1 ? h.maxD + H.popR : Math.min(h.maxD + H.popR, (h.nearD + H.popR) * ((k + 1) / H.pulses));
}
// How far down the tree pulse k has run at world time t: at least pulseUS, and at most pulseMaxS to its reach.
function pulseFront(h, k, t) {
  const reach = pulseReach(h, k);
  const speed = Math.max(H.pulseUS, reach / H.pulseMaxS);
  return Math.min(reach, speed * (t - h.pulses[k]));
}

function stepHeart(st) {
  const A = st.A, h = st.heart, p = A.p;
  const s1 = st.t + DT - h.h0;
  if (s1 >= H.heartCapS) fact(st, "root.heart");
  if (s1 >= H.hushS) milestone(st, "heart");
  while (h.k < H.pulses && st.t + DT >= h.first + h.k * YOU_P - EPS) {
    h.pulses.push(A.t);
    h.k++;
    A.juice.shake = Math.min(1, A.juice.shake + 0.3);
    fx(st, "beat", p.x, p.y, Math.max(16, 0.5 * sizeU(st)));
    for (const [after, shares] of H.gatherMore) if (h.k === after) gather(st, shares, 0.35);
  }
  // each pulse runs out along the tree from your heart, a little further each beat (the 8th the whole tree), and
  // pops the germs within 40 u of the part it has passed
  if (h.pulses.length) {
    const front = pulseFront(h, h.pulses.length - 1, A.t);
    const tr = st.tree, nd = tr.nodes;
    for (const f of A.foes.slice()) {
      if (f.in > 0) continue;
      if (f.popD === undefined) {
        let best = Infinity;
        for (let i = 0; i < tr.n && i < h.depth.length; i++) {
          if (h.depth[i] >= best) continue;
          if (hyp(nd[4 * i] - f.x, nd[4 * i + 1] - f.y) <= H.popR) best = h.depth[i];
        }
        f.popD = best;
      }
      if (f.popD <= front) { X.burst(A, f.x, f.y, f.r * 1.5, 2); X.damageFoe(A, f, f.hp + 99, 0, 0); }
    }
  }
  yours(st);
}

// "This beat is yours.": once your heart has beaten a while and the caption band is free (root.heart read whole).
function yours(st) {
  if (st.said.yours || !st.heart || st.t + DT - st.heart.h0 < H.yoursS || st.t + DT < (st.capBusy || 0)) return;
  st.said.yours = true;
  caption(st, "root.yours");
}

function stepGrow(st) {
  yours(st);
  const g = gaAt(meta.moments[3], st.t + DT - st.m0);
  if (g >= GR.placentaGa && !st.said.placenta) { st.said.placenta = true; caption(st, "root.placenta"); }
}

function ends(st) {
  const s = st.t - st.m0;
  switch (st.moment) {
    case "nestle": return st.nest.state === "sink" && st.t >= st.nest.s0 + st.nest.len - EPS;
    case "roots": return st.phase !== "ko" && st.pools.every((q) => q.linked);
    case "heart": return s >= H.lenS - EPS;
    case "grow": return s >= GR.lenS - EPS;
    default: return false;
  }
}

// ---- your size and the camera

function lenMm(g) {
  const L = GR.mm;
  if (g <= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) if (g <= L[i][0]) return lerp(L[i - 1][1], L[i][1], (g - L[i - 1][0]) / (L[i][0] - L[i - 1][0]));
  return L[L.length - 1][1];
}
const growP = (st) => (st.heart && st.mi >= 3 ? clamp01((st.t - st.heart.g0) / GR.lenS) : 0);
const heartSpan = (st) => (st.heart ? lerp(H.span, H.spanTo, ease((st.t - st.heart.h0) / H.lenS)) : H.span);
const growSpan = (st) => lerp(H.spanTo, GR.spanTo, ease(growP(st)));
function sizeU(st) {
  if (st.mi < 2 || !st.heart) return Y.figU;
  const full = (g, span) => (lenMm(g) * span) / mmAt(g);
  if (st.mi === 2) return lerp(Y.figU, full(36, H.span), ease((st.t - st.heart.h0) / H.hushS));
  return full(st.gaDay, lerp(H.span, GR.spanTo, ease(growP(st))));
}
function figAt(st) {
  const p = st.A.p;
  return { x: p.x, y: p.y, s: sizeU(st) };
}

function camTarget(st) {
  if (st.mi === 0) return { x: st.nest.x * 0.5, y: st.nest.y, span: N.span };
  const p = st.A.p;
  if (st.mi === 1) return { x: p.x, y: p.y, span: R.span };
  const lk = st.heart ? st.heart.look : p, hk = st.heart ? ease((st.t - st.heart.h0) / H.lenS) : 0;
  const hx = lerp(p.x, lk.x, hk), hy = lerp(p.y, lk.y, hk);
  if (st.mi === 2) return { x: hx, y: hy, span: heartSpan(st) };
  return { x: hx, y: hy, span: growSpan(st) };
}
function camera(st, snap = false) {
  const c = camTarget(st);
  if (snap || !st.cam) { st.cam = { ...c }; return; }
  const kp = 1 - Math.exp(-DT / (st.mi === 0 ? 0.45 : R.camS)), ks = 1 - Math.exp(-DT / 0.6);
  st.cam.x += (c.x - st.cam.x) * kp;
  st.cam.y += (c.y - st.cam.y) * kp;
  const dx = st.cam.x - c.x, dy = st.cam.y - c.y, d = hyp(dx, dy);
  if (st.mi >= 1 && d > R.camLagU) { st.cam.x = c.x + (dx * R.camLagU) / d; st.cam.y = c.y + (dy * R.camLagU) / d; }
  st.cam.span += (c.span - st.cam.span) * ks;
}

// ---- the Stage interface

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const carry = mergeCarry(carryIn, null);
  const assist = !!o.assist, As = TUNE.assist;
  const A = X.createWorld(s, {
    arena: null,
    player: { x: 0, y: 0, r: Y.r, body: Y.body, speed: Y.swimUS, accel: Y.accel, fixed: true,
      hp: Y.hp + (assist ? As.hpPlus : 0), shield: Math.min(2, Math.max(0, carry.sparks | 0)) },
    dash: null,
    fire: TUNE.fire,
    bulletK: assist ? As.bulletK : 1, bulletCap: TUNE.bulletCap,
  });
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.ga.start, fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: "nestle",
    mi: 0, m0: 0, done: false, how: null, err: null, assist, lag: fin(o.lag) ? o.lag : 0, oneButton: !!o.oneButton,
    carry, phaseIn: phase, prompt: null, phase: "play", goalMet: false, doneT: 0,
    spots: laySpots(s), glands: layGlands(s),
    nest: { x: 0, y: 0, vx: 0, vy: N.slideUS, lastIn: 0, state: "drift", spot: -1, by: null, from: null, s0: 0, len: 0, p: 0 },
    A, origin: null, map: null, map0: makeMap(s, { x: 0, y: 0 }, TUNE), pools: [], knots: [], tree: null, trailNode: 0, gr: null, cdUntil: 0,
    reach: false, strong: false, autoK: 0, germT: 0, herK: 0, lastBeat: -Infinity,
    counts: { you: 0, auto: 0, hidden: 0 }, order: [], lastYouS: null, quick: false, pipsPart: 0,
    pts: { goal: 0, skill: 0, flourish: 0 },
    glows: [], pings: [], crumbs: [], fx: [], tags: [], disc: null, dug: 0, grapples: 0, popped: 0,
    digSfx: -1, crumbT: -1, plinkT: -1,
    rGerm: stream(s, "germs"), rFx: stream(s, "rootFx"), rHeart: stream(s, "heartGather"),
    heart: null, said: {}, fired: {}, times: {}, cam: null,
    capBusy: 0, evSeen: 0, koAt: null, koEnd: null, wentOn: false, assistK: assist ? As.foesK : 1,
  };
  st.beats = makeBeats(s, [{ heart: "mother", from: 0, to: END_S, bpm: meta.motherBpm, jitter: 0, first: phase }]);
  startMoment(st, 0);
  camera(st, true);
  note(st, FACTS, TEXT);
  return st;
}

export function step(st, intents) {
  if (!st || st.done) { if (st) st.t += DT; return; }
  try {
    const it = intents || EMPTY_INTENTS;
    if (st.moment === "nestle") stepNestle(st, readIntents(it));
    else if (st.moment === "roots") stepRoots(st, it);
    else if (st.moment === "heart") { worldIdle(st); stepHeart(st); X.emitOut(st.A, st); }
    else { worldIdle(st); stepGrow(st); X.emitOut(st.A, st); }
    st.t += DT;
    note(st, FACTS, TEXT);
    if (st.phase === "ko") {
      if (st.koEnd === null) st.koEnd = readBy(st, st.koAt + TUNE.koS);
      if (st.t >= st.koEnd - EPS || st.t >= meta.capS - EPS) finish(st, "ko");
      camera(st);
      return;
    }
    while (!st.done && ends(st)) {
      if (st.mi >= ORDER.length - 1) finish(st, "end");
      else { endMoment(st); startMoment(st, st.mi + 1); }
    }
    if (!st.done) {
      st.gaDay = Math.max(st.gaDay, gaAt(meta.moments[st.mi], st.t - st.m0));
      if (st.t >= meta.capS - EPS) finish(st, "cap");
    }
    note(st, FACTS, TEXT);
    camera(st);
  } catch (e) {
    st.err = String((e && e.stack) || e);
    try { finish(st, "error"); } catch (e2) { st.done = true; }
  }
}

// ---- the picture

function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// The ground's snapshot for the draw list: a fresh copy each time the ground changes (the view never hands out the
// state's own arrays).
const SNAP = new WeakMap();
function groundSnap(st) {
  let s = SNAP.get(st);
  if (!s || s.map !== st.map || s.gen !== st.map.gen) {
    s = { map: st.map, gen: st.map.gen, grid: st.map.grid.slice(), ver: st.map.ver.slice() };
    SNAP.set(st, s);
  }
  return s;
}

// The lining strip: the ground, knots, the tendril, the aim, pings, glows, heart pulses, crumbs, rings, the compass.
function liningView(st) {
  const A = st.A, p = A.p, map = st.map, t = A.t;
  const g = groundSnap(st);
  const roots = st.mi === 1 && st.phase !== "ko";
  // the aim: what a press now would snap to
  let aim = null;
  if (roots && !st.gr && t >= st.cdUntil - EPS) {
    const a = aimOf(st, { x: p.mx, y: p.my });
    const tg = snapTarget(st, p.x, p.y, a.ux, a.uy);
    if (tg) aim = { x: tg.x, y: tg.y, r: tg.kind === "knot" ? KN.r + 2.5 : 4 };
  }
  const knots = st.knots.map((k) => ({ x: k.x, y: k.y, r: KN.r, hot: aim && hyp(aim.x - k.x, aim.y - k.y) < 0.5 ? 1 : 0 }));
  let tendril = null;
  const gr = st.gr;
  if (gr) {
    let x1 = gr.tx, y1 = gr.ty, k = 1;
    if (gr.state === "shoot") {
      const dx = gr.tx - p.x, dy = gr.ty - p.y, d = hyp(dx, dy) || 1e-6, l = Math.min(gr.len, d);
      x1 = p.x + (dx / d) * l; y1 = p.y + (dy / d) * l;
    } else if (gr.state === "back") {
      k = 1 - clamp01((t - gr.b0) / GP.retractS);
      x1 = p.x + (gr.tx - p.x) * k; y1 = p.y + (gr.ty - p.y) * k;
    }
    tendril = { x0: p.x, y0: p.y, x1, y1, state: gr.state === "pull" ? 2 : gr.state === "back" ? 0 : 1, snap: gr.kind === "miss" ? 0 : 1 };
  }
  const pings = [];
  for (const q of st.pings) {
    const a = (t - q.t0) / R.pingS, pool = st.pools[q.i];
    if (a < 0 || a >= 1 || !pool) continue;
    pings.push({ x: pool.x, y: pool.y, r: poolBase(st) * (0.6 + 2.6 * a), a: 1 - a });
  }
  const glows = [];
  for (const gl of st.glows) {
    const a = (t - gl.t0) / R.glowS;
    if (a < 0 || a >= 1 || gl.pts.length < 4) continue;
    for (let tail = 0; tail < 3; tail++) {
      const u = clamp01(a - tail * 0.06), want = u * gl.len;
      let acc = 0, x = gl.pts[0], y = gl.pts[1];
      for (let i = 2; i < gl.pts.length; i += 2) {
        const sx = gl.pts[i - 2], sy = gl.pts[i - 1], ex = gl.pts[i], ey = gl.pts[i + 1], l = hyp(ex - sx, ey - sy);
        if (acc + l >= want) { const f = l > 0 ? (want - acc) / l : 0; x = sx + (ex - sx) * f; y = sy + (ey - sy) * f; break; }
        acc += l; x = ex; y = ey;
      }
      glows.push({ x, y, r: 2.6 - 0.6 * tail, a: (1 - a * 0.5) * (1 - 0.3 * tail) });
    }
  }
  const beads = [], lit = [];
  const h = st.heart;
  if (h && h.pulses.length && st.tree) {
    const nd = st.tree.nodes;
    // the roots the latest pulse is lighting: each segment just behind its front glows, fading behind it
    const kk = h.pulses.length - 1, fr = pulseFront(h, kk, t), age = t - h.pulses[kk];
    const fade = clamp01(1 - (age - H.pulseMaxS) / 0.35);
    for (let i = 1; i < st.tree.n && i < h.depth.length && lit.length < 160 && fade > 0; i++) {
      const dd = fr - h.depth[i];
      if (dd < 0 || dd > H.litU) continue;
      const pa = nd[4 * i + 2];
      if (pa < 0) continue;
      lit.push({ x: nd[4 * i], y: nd[4 * i + 1], px: nd[4 * pa], py: nd[4 * pa + 1], a: fade * (1 - dd / H.litU) });
    }
    for (let k = 0; k < h.pulses.length; k++) {
      const front = pulseFront(h, k, t), reach = pulseReach(h, k);
      if (front >= reach - 1e-6 && t - h.pulses[k] > H.pulseMaxS + 0.25) continue;
      for (let i = 0; i < st.tree.n && i < h.depth.length && beads.length < 120; i++) {
        const dd = front - h.depth[i];
        if (dd < 0 || dd > 14) continue;
        beads.push({ x: nd[4 * i], y: nd[4 * i + 1], a: 1 - dd / 14 });
      }
    }
  }
  const crumbs = [];
  for (const c of st.crumbs) {
    const age = t - c.t0;
    if (age < 0 || age >= 0.5) continue;
    const k = (1 - Math.exp(-4 * age)) / 4;
    crumbs.push({ x: c.x + c.vx * k, y: c.y + c.vy * k - 6 * age * age, r: c.r, a: 1 - age / 0.5, firm: c.firm ? 1 : 0 });
  }
  const rings = [];
  for (const q of st.fx) {
    const life = q.kind === "beat" ? 0.5 : 0.7, a = (t - q.t0) / life;
    if (a < 0 || a >= 1) continue;
    rings.push({ x: q.x, y: q.y, r: q.r * (0.6 + 1.6 * a), a: 1 - a, kind: q.kind === "up" ? 1 : q.kind === "beat" ? 2 : 0 });
  }
  let compass = null;
  if (roots) {
    const i = compassPool(st);
    if (i >= 0) {
      const last = st.pings.length ? st.pings[st.pings.length - 1] : null;
      const ping = last && last.i === i ? clamp01(1 - (t - last.t0) / R.pingS) : 0;
      compass = { x: st.pools[i].x, y: st.pools[i].y, a: 1, ping };
    }
  }
  return {
    kind: "lining", a: st.mi === 1 ? clamp01((st.t - (st.times.roots || 0)) / 0.6) : 1,
    ox: map.ox, oy: map.oy, n: map.n, cell: map.cell, tiles: map.tiles, gen: g.gen, grid: g.grid, ver: g.ver,
    strong: st.strong ? 1 : 0, knots, aim, tendril, pings, glows, beads, lit, crumbs, rings, compass,
  };
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const c = st.cam, mm = mmAt(st.gaDay), t = st.t;
  const herPh = clamp01(st.beats.phase("mother", t)), herPulse = pulse(st, "mother", t);
  d.camera = { x: c.x, y: c.y, span: c.span, rot: 0, orient: meta.orient, mmPerU: mm / c.span };
  d.scale = { mm: bar(mm) };
  const hush = st.mi === 2 && st.heart && t - st.heart.h0 < H.hushS;
  d.light = { level: (0.52 + 0.08 * growP(st)) * (hush ? H.hushLight : 1), warm: 0.72, exposure: 1, white: 0, vignette: 0.45, tint: 0 };
  d.warp = 0.15;
  d.caustics = 0;

  if (st.mi === 0) {
    const n = st.nest;
    const tile = 140;
    for (const g of st.glands) {
      const y = g.y + tile * Math.round((c.y - g.y) / tile);
      d.marks.push({ kind: "glow", x: g.x, y, r: 2.5, on: false, pulse: herPulse });
    }
    st.spots.forEach((s, i) => d.marks.push({ kind: "spot", x: s.x, y: s.y, r: N.spotR, rim: "solid", on: i === n.spot, pulse: herPulse }));
    const r = lerp(N.youR, N.youR * 0.75, n.p);
    d.splats.push({ k: "c", x: n.x, y: n.y, r, m: 1, n: 0.35, v: 0, hue: 0.04 });
    d.splats.push({ k: "c", x: n.x + 0.25 * r, y: n.y + 0.25 * r, r: 0.4 * r, m: 0.6, n: 1, v: 0, hue: 0.06 });
    d.rings.push({ id: "mother", kind: "mother", x: n.x, y: n.y, r: c.span * 0.1, progress: herPh });
    if (n.state === "sink") {
      const sp = st.spots[n.spot];
      d.rings.push({ id: "burrow", kind: "burrow", x: sp.x, y: sp.y, r: N.spotR + 6 * (1 - n.p), progress: n.p, dotted: true });
    }
    rimSparks(d, st.carry.sparks, n.x, n.y, r + 1, { t, span: c.span });
    d.anchor = { x: n.x, y: n.y };
    const cue = st.spots[n.spot >= 0 ? n.spot : nearestSpot(st, n.x, n.y)];
    d.cue = { x: cue.x, y: cue.y };
    return d;
  }

  const A = st.A, p = A.p;
  // the ground under everything: your home spot, the pools (under the tissue sheets), the placenta disc
  d.marks.push({ kind: "spot", x: st.origin.x, y: st.origin.y, r: 7, rim: "solid", on: true, pulse: herPulse });
  const re = poolR(st, t);
  st.pools.forEach((q) => d.marks.push({ kind: "pool", x: q.x, y: q.y, r: re, rim: "dotted", on: q.linked, pulse: herPulse }));
  if (st.disc && st.mi === 3) {
    d.marks.push({ kind: "lake", x: st.disc.x, y: st.disc.y, r: Math.max(1, st.disc.r * ease(growP(st) * 1.4)), rim: "solid", on: true, pulse: herPulse });
  }
  const f = figAt(st);
  const youPulse = pulse(st, "you", t);
  d.marks.push({ kind: "glow", x: f.x, y: f.y, r: Math.max(5, 0.6 * f.s), on: A.ko ? 0 : 0.7, pulse: st.mi >= 2 ? youPulse : herPulse });
  if (st.tree.n >= 2) d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: st.mi >= 2 ? youPulse : herPh });
  d.strips.push(liningView(st));
  rimSparks(d, st.carry.sparks, f.x, f.y, 0.55 * f.s, { t, span: c.span });

  // you: the curl, leaning a little into your move
  const lean = st.mi === 1 ? -0.3 * p.mx : 0;
  d.splats.push(...figure("curl", f.s, st.gaDay, { x: f.x, y: f.y, rot: lean }));
  d.rings.push({ id: "mother", kind: "mother", x: f.x, y: f.y, r: Math.max(8, f.s * 0.75), progress: herPh });
  if (st.mi >= 2 && st.heart && t >= st.heart.first) {
    const chest = { x: f.x + 0.02 * f.s, y: f.y - 0.02 * f.s };
    d.marks.push({ kind: "glow", x: chest.x, y: chest.y, r: f.s * 0.08 * (1 + youPulse), on: true, pulse: youPulse });
    d.rings.push({ id: "you", kind: "you", x: chest.x, y: chest.y, r: f.s * 0.16, progress: clamp01(st.beats.phase("you", t)), dashed: true });
  }

  // the action layer: germs, sparks, heals, telegraphs, pops, your hitbox and hp
  const av = { ...X.actionView(A, { player: st.mi === 1 }), arena: null };
  const words = [];
  for (const g of st.tags) {
    const q = (t - g.t0) / g.dur;
    if (q < 0 || q >= 1) continue;
    words.push({ x: g.x, y: g.y + 6 * q, v: g.v, a: clamp01(1 - q), combo: 0, word: g.word });
  }
  av.pops = [...av.pops.slice(-Math.max(0, 12 - words.length)), ...words.slice(-12)];
  d.action = av;
  d.anchor = { x: f.x, y: f.y };
  d.cue = { x: f.x, y: f.y };
  return d;
}

export function prompt(st) {
  return st.done || !st.prompt ? { ...NONE } : { ...st.prompt };
}

export function targets() {
  return [];
}

// ---- the bot

// Path fields per map and pool (a memo: the same map and pool always give the same field).
const FIELDS = new WeakMap();
function fieldFor(st, i) {
  let m = FIELDS.get(st.map);
  if (!m) { m = {}; FIELDS.set(st.map, m); }
  const key = i + (st.strong ? "s" : "w");
  return m[key] || (m[key] = fieldOf(st.map, st.pools[i], st.strong, TUNE));
}

// The pool the bot goes for: the nearest it can reach now (a walled one once strong), by plain distance, so the answer
// never depends on which path fields were worked out before (one-button mode asks at skill 1 every step).
function botPool(st) {
  const p = st.A.p;
  let best = -1, bd = Infinity, near = -1, nd = Infinity;
  st.pools.forEach((q, i) => {
    if (q.linked) return;
    const d = hyp(q.x - p.x, q.y - p.y);
    if (d < nd) { nd = d; near = i; }
    if (q.kind === "firm" && !st.strong) return;
    if (d < bd) { bd = d; best = i; }
  });
  return best >= 0 ? best : near;
}

// A grapple that saves path: a knot, or the goal pool's rim, in reach, with no firm tissue in the way.
function botGrapple(st, F, gi) {
  const A = st.A, p = A.p;
  const here = fieldAt(F, p.x, p.y);
  if (!fin(here)) return null;
  const reach = st.reach ? GP.reach3 : GP.reach;
  let best = null, bg = BT.gain;
  const consider = (ax, ay, vx, vy) => {
    const dx = ax - p.x, dy = ay - p.y, d = hyp(dx, dy);
    if (d > reach || d < 8) return;
    if (rayTissue(st.map, p.x, p.y, dx / d, dy / d, Math.max(0, d - KN.r)).d < d - KN.r) return;
    const gain = here - fieldAt(F, vx, vy);
    if (gain > bg) { bg = gain; best = { x: ax, y: ay }; }
  };
  for (const k of st.knots) consider(k.x, k.y, k.x, k.y);
  const q = st.pools[gi], dc = hyp(q.x - p.x, q.y - p.y), pr = poolBase(st);
  if (dc > pr + 2) consider(q.x - ((q.x - p.x) / dc) * pr, q.y - ((q.y - p.y) / dc) * pr, q.x, q.y);
  return best;
}

export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done) return zero;
  const sk = clamp01(fin(skill) ? skill : 0);
  if (st.mi === 0) {
    const n = st.nest;
    if (n.state !== "drift") return zero;
    const sp = st.spots[nearestSpot(st, n.x, n.y)];
    const dx = sp.x - n.x, dy = sp.y - n.y - 0.4 * N.slideUS, d = hyp(dx, dy), m = (0.4 + 0.6 * sk) * MAG_SAFE;
    return d < 1e-9 ? zero : { steer: { x: (dx / d) * m, y: (dy / d) * m }, dir: null, hold: false, dash: false };
  }
  if (st.mi !== 1 || st.phase === "ko" || !st.A || st.A.ko) return zero;
  const A = st.A, p = A.p;
  const gi = botPool(st);
  if (gi < 0) return zero;
  const F = fieldFor(st, gi), q = st.pools[gi];
  // the grapple: when it is ready and saves path (below skill 1, only now and then)
  if (!st.gr && A.t >= st.cdUntil - EPS) {
    let go = sk >= 1;
    if (!go && typeof r === "function") {
      if (!r.mem || typeof r.mem !== "object") r.mem = {};
      if (!(A.t < (r.mem.gNext ?? -1))) { r.mem.gNext = A.t + 0.5; go = r() < 0.15 + 0.85 * sk; }
    }
    if (go) {
      const g = botGrapple(st, F, gi);
      if (g) {
        const dx = g.x - p.x, dy = g.y - p.y, d = hyp(dx, dy);
        return { steer: { x: (dx / d) * MAG_SAFE, y: (dy / d) * MAG_SAFE }, dir: null, hold: false, dash: true };
      }
    }
  }
  if (st.gr) return zero;
  const dq = hyp(q.x - p.x, q.y - p.y);
  const wp = dq < poolBase(st) + 14 ? { x: q.x, y: q.y } : fieldStep(F, p.x, p.y, BT.look) || { x: q.x, y: q.y };
  const a = actionSteer(A, sk, r, { keep: false, picks: false });   // heals come by the magnet; the pools are the goal
  const b = goalSteer(A, a, wp, sk, r, { weight: BT.goalW, slowR: 3 });
  return { steer: b.steer, dir: null, hold: false, dash: false };
}

export function probe() {
  return null;
}

// Fair resume (5.2): 1.2 s of i-frames after Resume, so a pause never ends in a hit.
export function resume(st) {
  if (!st || st.done || !st.A) return 0;
  st.A.p.inv = Math.max(st.A.p.inv, 1.2);
  return 0;
}

export function result(st) {
  const A = st.A;
  const goalMet = st.done && st.goalMet;
  const score = clampScore({ goal: goalMet ? S.goal : 0, skill: st.pts.skill, flourish: st.pts.flourish });
  const nestleX = st.origin ? Math.round(clamp(st.origin.x / 50, -1, 1) * 100) / 100
    : st.nest.spot >= 0 ? Math.round(clamp(st.spots[st.nest.spot].x / 50, -1, 1) * 100) / 100 : 0;
  const order = st.order.join(",");
  const poolsPart = st.counts.you * Math.round(S.pools / PL.n), hiddenPart = st.counts.hidden * Math.round(S.hidden / S.hiddenN);
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "pools", label: "root.part.pools", value: poolsPart, max: S.pools },
      { id: "hidden", label: "root.part.hidden", value: hiddenPart, max: S.hidden },
      { id: "pips", label: "root.part.pips", value: st.pipsPart, max: S.pips },
      { id: "quick", label: "root.part.quick", value: score.flourish, max: S.flourish },
    ],
    metrics: {
      linked: st.counts.you + st.counts.auto, you: st.counts.you, auto: st.counts.auto, hidden: st.counts.hidden,
      grapples: st.grapples, dug: st.dug, popped: st.popped, hits: A.hits, hp: A.p.hp, hpMax: A.p.hpMax,
      reach: st.reach, strong: st.strong, quick: st.quick, lastYouS: st.lastYouS,
      nestled: st.nest.by, nestleX, nodes: st.tree ? st.tree.n : 1, moment: st.moment, how: st.how,
      times: { ...st.times }, err: st.err, gaDay: st.gaDay,
      ko: !!A.ko, koAt: st.koAt, almost: A.ko ? "almost.ko" : null, shieldHits: A.shieldHits || 0,
    },
    carryOut: { nestleX, treeSeed: (stream(st.seed + ":" + order, "treeSeed")() * 4294967296) >>> 0 },
  };
}

// Skip forward to a named moment (tests, ?moment= and Go on): what the skipped moments owe is settled by itself. After
// a knock-out, "heart" links the pools left ("The roots reach them anyway.") and plays the heart and grow, input none.
export function jump(st, id) {
  const i = ORDER.indexOf(id);
  if (!st || i < 0) return false;
  try {
    if (st.done && st.how === "ko" && id === "heart") {
      st.done = false; st.how = null; st.wentOn = true; st.phase = "play";
      let any = false;
      for (let k = 0; k < st.pools.length; k++) if (!st.pools[k].linked) { link(st, k, "auto", true); any = true; }
      if (any) caption(st, "root.anywayAll");
      while (st.mi < i) { endMoment(st); startMoment(st, st.mi + 1); }
      camera(st, true);
      return true;
    }
    if (st.done || i <= st.mi) return false;
    while (st.mi < i) { endMoment(st); startMoment(st, st.mi + 1); }
    camera(st, true);
    return true;
  } catch (e) {
    st.err = String((e && e.stack) || e);
    return false;
  }
}
