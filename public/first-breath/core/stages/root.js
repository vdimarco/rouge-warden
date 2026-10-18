// First Breath: stage 4, The Placenta (`root`): "Grow roots." (design.md 6.4; build contract 16.4 to 16.7). Pure: no
// DOM, no clocks, no storage, no Math.random; every draw comes from stream(seed, name). step() never throws.
//
// The v1 form, moment by moment (4.1: nestle, roots, heart, grow):
// 1. nestle (Days 6 to 9, up to 12 s, drag): you drift over the soft red lining at 30 u/s while it slides by at 8 u/s.
//    Touch any of the 3 soft spots (24 u wide) and you sink in over 2 s by itself. Idle for 8 s (or still drifting at
//    9 s) and the nearest spot draws you in over 3 s. Milestone `implanted` at the end; carry out `nestleX`.
// 2. roots (Days 11 to 21, up to 40 s, drag): you steer the growing tip (40 u/s, 2.6 rad/s, core/lib/steer.js) and the
//    villous tree fills in behind it (core/lib/colonize.js: the tip's path plus space colonization within 60 u of the
//    tip or of a pool being reached by itself). 8 gland pools (radius 16 u) swell 1 + 0.12 × pulse on her beat.
//    Entering one links it, and a glow runs back to you; entering within the Close window of her beat is an on-beat
//    link. From 12 s (Assist 8 s) the tree reaches the nearest unlinked pool by itself every 3.5 s ("The roots reach it
//    anyway."), so all 8 link by 40 s at the latest. The tip slides along the firm edge and never leaves it; a pool
//    simply waits (the miss of 6.4). The moment ends when all 8 are linked (gaDay jumps to 35).
// 3. heart (Day 22, tap): a 1.5 s hush (sfx root.hush, light −10%) with root.heart. Your heart beats by itself at
//    110 bpm from the end of the hush (milestone `heart`); at 3.5 s "This beat is yours. Tap with it."; 8 tap targets
//    on your 7th to 14th beats (P = 0.545 s); then 3 s of both hearts together and root.tube.
// 4. grow (7 s, Day 22 to week 7, none): core/lib/figure.js buds grow from 2 to 10 mm, the camera pulls back, the tree
//    thickens into a disc ("This will become your placenta."), root.size and root.buds. Carry out `treeSeed`.
//
// Score (6.4): Goal 3,000; Skill 3,000 × pools you linked / 8 + 1,000 × on-beat links / 8 + 2,000 × heart accuracy;
// Flourish 1,000 × heart taps In time / 8. The bot (botSteer) seeks the nearest spot, then the nearest unlinked pool,
// and times its arrival to her next beat by easing speed in the last 20 u; its only memory is r.mem (aim noise per
// pool, drawn only below skill 1, so one-button mode at skill 1 never depends on r).
//
// Contract gaps, handled here (for the lead to note in tasks.md 2d): 6.4 gives no accel or drag for the tip, no layout
// for spots and pools beyond 6.4's ranges, no rule for a player who drifts but never touches a spot (drawn in from
// 9 s, so nestle ends by 12 s), and no auto-reach speed (52 u/s, so the 8th reach, started at 36.5 s, links by 40 s).
// Her beats keep 0% jitter through the stage (the on-beat links and the heart targets both read them). Caption facts
// are emitted as `fact` events; stage captions that are not facts as `caption` events.
import { DT, gaAt, mmPerShortAxis, bpmYou } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { CREDIT, windows } from "../judge.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { createTrack, feed, upcoming, accuracy, previewS } from "../lib/track.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { stream, gauss } from "../rng.js";
import { figure } from "../lib/figure.js";
import { createTree, growTree, addNode, nearestNode } from "../lib/colonize.js";
import { steerBody } from "../lib/steer.js";
import { TUNE } from "./root.tune.js";

// One 4.1 moment: gaDay from → to while it runs, and the lenS that gaDay follows (null where 4.1 gives none).
const mo = (id, from, to, lenS = null) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });

export const meta = Object.freeze({
  id: "root", index: 3, name: "The Placenta", verb: "Root",
  orient: "long",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 20, end: 49 }), fertilized: true,
  mm: Object.freeze({ start: 0.6, end: 30 }),
  motherBpm: 72, parS: 45, capS: 75, canFail: false, scored: true,
  moments: Object.freeze([
    mo("nestle", 20, 23, TUNE.nestle.lenS),
    mo("roots", 25, 35, TUNE.roots.lenS),
    mo("heart", 36, 36),
    mo("grow", 36, 49, TUNE.grow.lenS),
  ]),
});

const N = TUNE.nestle, R = TUNE.roots, T = TUNE.tree, H = TUNE.heart, G = TUNE.grow, S = TUNE.score, B = TUNE.bot;
const ORDER = ["nestle", "roots", "heart", "grow"];
const GESTURE = { nestle: "drag", roots: "drag", heart: "tap", grow: "none" };
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const HER_P = 60 / meta.motherBpm;
const YOU_P = 60 / H.bpm;
const LAST_TARGET_S = H.hushS + (H.leadBeats + H.targets - 1) * YOU_P;   // from the heart's start
const HEART_LEN = LAST_TARGET_S + H.tailS;
const TIP = Object.freeze({ top: R.tipUS, turn: R.turnRadS, accel: R.accel, drag: R.drag });
const MAG_SAFE = 1 - 1e-9;   // keeps |steer| ≤ 1 after float rounding, so the run never rescales it
const FAN = (R.fanDeg * Math.PI) / 180;

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = (p) => { const x = clamp01(p); return x * x * (3 - 2 * x); };
const hyp = Math.hypot;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const mmAt = (g) => mmPerShortAxis(meta, g);

// ---- layout (seeded) ----

// 3 soft spots off your start line (so an idle drift never touches one), each side at least once.
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

// Gland mouths on the lining: texture that shows the slide (fixed in the lining, tiled every 140 u).
function layGlands(seed) {
  const r = stream(seed, "glands");
  const out = [];
  for (let i = 0; i < N.glands; i++) out.push({ x: lerp(-N.halfW, N.halfW, r()), y: 140 * (i + r()) / N.glands });
  return out;
}

// 8 pools, 60 to 150 u from the root inside the forward fan, at least 40 u apart (relative to the root).
function layPools(seed) {
  const r = stream(seed, "pools");
  for (let gap = R.poolGapU; gap >= 24; gap -= 4) {
    const out = [];
    for (let tries = 0; tries < 4000 && out.length < R.pools; tries++) {
      const a = (2 * r() - 1) * FAN;
      const d = Math.sqrt(R.poolMinU ** 2 + (R.poolMaxU ** 2 - R.poolMinU ** 2) * r());
      const p = { dx: d * Math.sin(a), dy: d * Math.cos(a) };
      if (out.every((q) => hyp(q.dx - p.dx, q.dy - p.dy) >= gap)) out.push(p);
    }
    if (out.length === R.pools) return out;
  }
  // never reached in practice: a fixed fan
  return Array.from({ length: R.pools }, (_, i) => {
    const a = lerp(-FAN, FAN, i / (R.pools - 1)), d = i % 2 ? R.poolMaxU : (R.poolMinU + R.poolMaxU) / 2;
    return { dx: d * Math.sin(a), dy: d * Math.cos(a) };
  });
}

// The tree's attraction points: a spread over the fan ahead of the root, and a cluster round each pool.
function treePoints(seed, root, pools) {
  const r = stream(seed, "treePts");
  const out = [];
  for (let i = 0; i < T.fanPts; i++) {
    const a = (2 * r() - 1) * (FAN + 0.15), d = lerp(10, R.poolMaxU + 12, Math.sqrt(r()));
    out.push({ x: root.x + d * Math.sin(a), y: root.y + d * Math.cos(a) });
  }
  const per = Math.floor((T.N - T.fanPts) / pools.length);
  for (const p of pools) {
    for (let i = 0; i < per; i++) {
      const a = 2 * Math.PI * r(), d = T.poolPtsR * Math.sqrt(r());
      out.push({ x: p.x + d * Math.cos(a), y: p.y + d * Math.sin(a) });
    }
  }
  return out;
}

// ---- small helpers ----

// 1 on a beat of `heart`, easing to 0 over pulseS.
function pulse(st, heart, t) {
  const b = st.beats;
  if (heart === "you" && !(st.heart && t >= st.heart.first)) return 0;
  const per = 60 / b.bpm(heart, t);
  if (!(per > 0)) return 0;
  const since = clamp01(b.phase(heart, t)) * per;
  const k = clamp01(1 - since / R.pulseS);
  return k * k;
}

const poolBase = (st) => R.poolR * (st.assist ? R.assistPoolK : 1);
const poolR = (st, t) => poolBase(st) * (1 + R.swell * pulse(st, "mother", t));

function nearestSpot(st, x, y) {
  let best = 0, bd = Infinity;
  st.spots.forEach((s, i) => { const d = hyp(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}

// The cue in roots: the nearest unlinked pool to the tip (−1 when none).
function nearestPool(st, x, y, skip = null) {
  let best = -1, bd = Infinity;
  st.pools.forEach((p, i) => {
    if (p.linked || (skip && skip(i))) return;
    const d = hyp(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// Your size in u: the tiny curl while the roots grow; then the figure grows with the real scale (2 → 10 mm).
function lenMm(g) {
  const L = G.mm;
  if (g <= L[0][0]) return L[0][1];
  for (let i = 1; i < L.length; i++) if (g <= L[i][0]) return lerp(L[i - 1][1], L[i][1], (g - L[i - 1][0]) / (L[i][0] - L[i - 1][0]));
  return L[L.length - 1][1];
}
const CURL_U = 12;
const growP = (st) => (st.heart && st.mi >= 3 ? clamp01((st.t - st.heart.g0) / G.lenS) : 0);
const growSpan = (st) => lerp(H.span, G.spanTo, ease(growP(st)));
function sizeU(st) {
  if (st.mi < 2 || !st.heart) return CURL_U;
  const full = (g, span) => (lenMm(g) * span) / mmAt(g);
  if (st.mi === 2) return lerp(CURL_U, full(36, H.span), ease((st.t - st.heart.h0) / H.hushS));
  return full(st.gaDay, growSpan(st));
}
function figAt(st) {
  const s = sizeU(st);
  return { x: st.root.x, y: st.root.y - (st.mi < 2 ? 4 : 0.35 * s), s };
}

// ---- events ----

function prompt_(st, text) {
  st.prompt = { gesture: GESTURE[st.moment], text, keys: "steer" };
  emit(st, "prompt", { ...st.prompt });
}
function fact(st, id) {
  if (st.said[id]) return;
  st.said[id] = true;
  emit(st, "fact", { id, where: "caption" });
}
function caption(st, id, once = true) {
  if (once && st.said[id]) return;
  st.said[id] = true;
  emit(st, "caption", { id, dir: null });
}

function judged(st, r) {
  const x = r.target;
  emit(st, "judge", { target: x.id, grade: r.grade, errMs: r.errMs, rawMs: r.rawMs, heart: x.heart,
    t: Number.isFinite(r.errMs) ? x.t + r.errMs / 1000 : st.t });
  const c = CREDIT[r.grade] || 0;
  if (c > 0) emit(st, "points", { part: "skill", add: Math.round((S.heart * c) / H.targets), t: x.t + r.errMs / 1000 });
  if (r.grade === "in") emit(st, "points", { part: "flourish", add: Math.round(S.inTime / H.targets), t: x.t + r.errMs / 1000 });
}

// ---- links ----

function link(st, i, by, te, quiet = false) {
  const p = st.pools[i];
  if (!p || p.linked) return;
  const close = windows(HER_P, st.assist).close;
  const b = st.beats.next("mother", te - close - 1e-9);
  p.linked = true;
  p.by = by;
  p.at = te;
  p.onBeat = by === "you" && fin(b) && b <= te + close + 1e-9;
  if (by === "you") st.counts.you++; else st.counts.auto++;
  if (p.onBeat) st.counts.onBeat++;
  st.order.push((by === "you" ? "y" : "a") + i);
  st.reaches = st.reaches.filter((h) => h.pool !== i);
  st.glows.push({ pool: i, t0: te, onBeat: p.onBeat });
  if (st.glows.length > R.pools) st.glows.shift();
  const n = st.counts.you + st.counts.auto;
  if (!quiet) emit(st, "sfx", { id: p.onBeat ? "root.linkBeat" : "root.link", at: te, pitch: 1 + 0.06 * n, gain: by === "you" ? 1 : 0.6, t: te });
  if (by === "you") {
    emit(st, "points", { part: "skill", add: Math.round(S.pools / R.pools), t: te });
    if (p.onBeat) emit(st, "points", { part: "skill", add: Math.round(S.onBeat / R.pools), t: te });
  } else if (!quiet) caption(st, "root.anyway", false);
}

// A head (the tip or a reach) lays the tree behind it: a node every D u, joined to the last one, reusing a node it
// passes close to. At the 260-node cap the head still moves; the tree just stops growing.
function trail(st, head) {
  const tr = st.tree;
  const nx = tr.nodes[4 * head.node], ny = tr.nodes[4 * head.node + 1];
  if (hyp(head.x - nx, head.y - ny) < T.D) return;
  const j = nearestNode(tr, head.x, head.y);
  if (j >= 0 && hyp(head.x - tr.nodes[4 * j], head.y - tr.nodes[4 * j + 1]) < 0.6 * T.D) { head.node = j; return; }
  const k = addNode(tr, head.x, head.y, head.node);
  if (k >= 0) head.node = k;
}

// The auto reach: the nearest unlinked pool to the root that no reach is after yet.
function startReach(st) {
  let best = -1, bd = Infinity;
  st.pools.forEach((p, i) => {
    if (p.linked || st.reaches.some((h) => h.pool === i)) return;
    const d = hyp(p.x - st.root.x, p.y - st.root.y);
    if (d < bd) { bd = d; best = i; }
  });
  if (best < 0) return;
  const p = st.pools[best];
  const j = Math.max(0, nearestNode(st.tree, p.x, p.y));
  st.reaches.push({ pool: best, x: st.tree.nodes[4 * j], y: st.tree.nodes[4 * j + 1], node: j });
}

// ---- moments ----

function startMoment(st, i) {
  st.mi = i;
  st.moment = ORDER[i];
  st.m0 = st.t;
  st.gaDay = Math.max(st.gaDay, meta.moments[i].ga[0]);
  st.times[st.moment] = st.t;
  emit(st, "moment", { id: st.moment });
  if (st.moment === "nestle") {
    prompt_(st, "root.drift");
    subgoal(st, "nestle", "root.goalSpot");
  } else if (st.moment === "roots") {
    const sp = st.spots[st.nest.spot];
    st.root = { x: sp.x, y: sp.y };
    st.pools = st.poolOff.map((o) => ({ x: st.root.x + o.dx, y: st.root.y + o.dy, linked: false, by: null, at: null, onBeat: false }));
    st.tree = createTree({ seed: st.seed, root: st.root, points: treePoints(st.seed, st.root, st.pools),
      D: T.D, di: T.di, dk: T.dk, maxNodes: T.maxNodes });
    st.tip = { x: st.root.x, y: st.root.y, ang: Math.PI / 2, speed: 0, node: 0, moving: false };
    prompt_(st, "root.grow");
    subgoal(st, "pools", "root.goalPools");
  } else if (st.moment === "heart") {
    const h0 = st.t, first = h0 + H.hushS, g0 = h0 + HEART_LEN;
    st.heart = { h0, first, g0 };
    st.beats = makeBeats(st.seed, [
      { heart: "mother", from: 0, to: meta.capS + 30, bpm: meta.motherBpm, jitter: 0, first: st.phase },
      { heart: "you", from: first, to: g0, bpm: H.bpm, jitter: 0, first },
      { heart: "you", from: g0, to: g0 + G.lenS, gaFrom: 36, gaTo: 49, jitter: 0 },
      { heart: "you", from: g0 + G.lenS, to: meta.capS + 30, bpm: bpmYou(49), jitter: 0 },
    ]);
    const yb = st.beats.between("you", first - 1e-6, g0);
    const list = [];
    for (let k = 0; k < H.targets && H.leadBeats + k < yb.length; k++) {
      const t = yb[H.leadBeats + k];
      list.push({ id: "heart." + (k + 1), t, P: k ? t - list[k - 1].t : YOU_P, kind: "tap", heart: "you", group: "heart" });
    }
    st.track = createTrack(list, { assist: st.assist });
    prompt_(st, "root.listen");
    emit(st, "sfx", { id: "root.hush", at: h0, pitch: 1, gain: H.hushDb });
  } else if (st.moment === "grow") {
    prompt_(st, "root.shape");
    fact(st, "root.size");
    emit(st, "sfx", { id: "root.swell", at: st.t, pitch: 1, gain: 1 });
    let cx = st.root.x, cy = st.root.y;
    for (const p of st.pools) { cx += p.x; cy += p.y; }
    cx /= st.pools.length + 1; cy /= st.pools.length + 1;
    let r = 0;
    for (const p of st.pools) r = Math.max(r, hyp(p.x - cx, p.y - cy));
    st.disc = { x: cx, y: cy, r: Math.max(20, r * 0.9) };
  }
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
    emit(st, "milestone", { id: "implanted" });
  } else if (id === "roots") {
    for (let i = 0; i < st.pools.length; i++) if (!st.pools[i].linked) link(st, i, "auto", st.t, true);
    st.reaches = [];
    if (st.tip.moving) { st.tip.moving = false; emit(st, "sfx", { id: "root.tipOff", at: st.t, pitch: 1, gain: 1 }); }
    for (const f of ["root.hcg", "root.grows", "root.glands"]) fact(st, f);
    const you = st.counts.you >= S.youDone;
    doneBy(st, "pools", you ? "you" : "auto", you ? "root.poolsDone" : "root.poolsAuto");
  } else if (id === "heart") {
    for (const r of feed(st.track, EMPTY_INTENTS, st.t + 3600)) judged(st, r);
    fact(st, "root.heart");
    if (!st.said.heartFirst) { st.said.heartFirst = true; emit(st, "milestone", { id: "heart" }); }
    subgoal(st, "heart", "root.yours");
    fact(st, "root.tube");
    const you = accuracy(st.track) >= S.heartDone;
    doneBy(st, "heart", you ? "you" : "auto", you ? "root.heartDone" : "root.heartAuto");
  } else if (id === "grow") {
    fact(st, "root.buds");
    caption(st, "root.placenta");
  }
  st.gaDay = Math.max(st.gaDay, meta.moments[st.mi].ga[1]);
}

function finish(st, how) {
  if (st.done) return;
  while (st.mi < ORDER.length - 1) { endMoment(st); startMoment(st, st.mi + 1); }
  endMoment(st);
  st.done = true;
  st.how = how;
  st.times.end = st.t;
  st.prompt = { ...NONE };
  emit(st, "prompt", { ...NONE });
  emit(st, "done", {});
}

// One step of each moment, from st.t to st.t + DT.
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
    if (n.state === "drift" && (t1 - n.lastIn >= N.idleS - 1e-9 || s0 >= N.forceS - 1e-9)) {
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

function stepRoots(st, it) {
  const tip = st.tip, t1 = st.t + DT, s1 = t1 - st.m0;
  const s = it.steer, live = hyp(s.x, s.y) > 1e-3;
  const v = steerBody(tip, live ? s : { x: 0, y: 0 }, DT, TIP);
  let nx = tip.x + v.x * DT, ny = tip.y + v.y * DT;
  const dx = nx - st.root.x, dy = ny - st.root.y, d = hyp(dx, dy);
  if (d > R.firmR) { nx = st.root.x + (dx * R.firmR) / d; ny = st.root.y + (dy * R.firmR) / d; }
  if (ny < st.root.y - R.backU) ny = st.root.y - R.backU;
  const re = poolR(st, t1);
  for (let i = 0; i < st.pools.length; i++) {
    const p = st.pools[i];
    if (p.linked) continue;
    const d1 = hyp(p.x - nx, p.y - ny);
    if (d1 > re) continue;
    const d0 = hyp(p.x - tip.x, p.y - tip.y);
    const f = d0 > d1 ? clamp01((d0 - re) / (d0 - d1)) : 1;
    link(st, i, "you", st.t + f * DT);
  }
  tip.x = nx; tip.y = ny;
  const moving = tip.speed > 5;
  if (moving !== tip.moving) { tip.moving = moving; emit(st, "sfx", { id: moving ? "root.tipOn" : "root.tipOff", at: t1, pitch: 1, gain: 1 }); }
  trail(st, tip);

  // the reaches grow toward their pools and link them by themselves
  for (const h of st.reaches.slice()) {
    const p = st.pools[h.pool];
    const hx = p.x - h.x, hy = p.y - h.y, hd = hyp(hx, hy);
    const stepU = Math.min(hd, R.reachUS * DT);
    if (hd > 1e-9) { h.x += (hx / hd) * stepU; h.y += (hy / hd) * stepU; }
    trail(st, h);
    if (hyp(p.x - h.x, p.y - h.y) <= re) link(st, h.pool, "auto", t1);
  }
  const from = st.assist ? R.assistAutoFromS : R.autoFromS;
  while (st.autoK < R.pools && s1 >= from + R.autoEveryS * st.autoK - 1e-9) { st.autoK++; startReach(st); }
  if (s1 >= R.lenS - 1e-9) for (let i = 0; i < st.pools.length; i++) link(st, i, "auto", t1);

  if (st.tree.n < T.colonizeMax) {
    const active = [{ x: tip.x, y: tip.y, r: T.activeR }];
    for (const h of st.reaches) active.push({ x: st.pools[h.pool].x, y: st.pools[h.pool].y, r: T.activeR });
    growTree(st.tree, { active, iterations: T.iters });
  }

  // caption facts as the clock reaches them
  if (s1 >= 0.8) fact(st, "root.hcg");
  if (s1 >= 4.5) fact(st, "root.grows");
  if (gaAt(meta.moments[1], s1) >= 28) fact(st, "root.glands");
}

function stepHeart(st) {
  const s1 = st.t + DT - st.heart.h0;
  if (s1 >= H.heartCapS) fact(st, "root.heart");
  if (s1 >= H.hushS && !st.said.heartFirst) {
    st.said.heartFirst = true;
    emit(st, "milestone", { id: "heart", t: st.heart.first });
  }
  if (s1 >= H.yoursS && !st.said.yours) {
    st.said.yours = true;
    prompt_(st, "root.tapHeart");
    subgoal(st, "heart", "root.yours");
  }
  if (s1 >= LAST_TARGET_S + 0.6) fact(st, "root.tube");
}

function stepGrow(st) {
  const g = gaAt(meta.moments[3], st.t + DT - st.m0);
  if (g >= 42) fact(st, "root.buds");
  if (g >= G.placentaGa) caption(st, "root.placenta");
}

// Does the current moment end now (after st.t moved on)?
function ends(st) {
  const s = st.t - st.m0;
  switch (st.moment) {
    case "nestle": return st.nest.state === "sink" && st.t >= st.nest.s0 + st.nest.len - 1e-9;
    case "roots": return st.pools.every((p) => p.linked);
    case "heart": return s >= HEART_LEN - 1e-9;
    case "grow": return s >= G.lenS - 1e-9;
    default: return false;
  }
}

// The camera keeps you (in roots, you at the spot the roots grow from) on the layout's subject point (5.6, 9): the
// look-aheads are 0, so in portrait you sit at 45% of the height, above the caption band, and the pools ahead
// (within 166 u) still fit the free screen in every layout.
function camTarget(st) {
  if (st.mi === 0) return { x: st.nest.x * 0.5, y: st.nest.y + N.lookU, span: N.span };
  if (st.mi === 1) return { x: st.root.x, y: st.root.y + R.aheadU, span: R.span };
  const f = figAt(st);
  if (st.mi === 2) return { x: f.x, y: f.y + H.lookU, span: H.span };
  return { x: f.x, y: f.y + G.lookU, span: growSpan(st) };
}

function camera(st, snap = false) {
  const c = camTarget(st);
  if (snap || !st.cam) { st.cam = { ...c }; return; }
  const kp = 1 - Math.exp(-DT / 0.45), ks = 1 - Math.exp(-DT / 0.6);
  st.cam.x += (c.x - st.cam.x) * kp;
  st.cam.y += (c.y - st.cam.y) * kp;
  st.cam.span += (c.span - st.cam.span) * ks;
}

// ---- the Stage interface ----

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.moments[0].ga[0], fertilized: meta.fertilized,
    events: [], beats: null, subgoals: {}, moment: "nestle",
    mi: 0, m0: 0, done: false, how: null, err: null, assist: !!o.assist, oneButton: !!o.oneButton,
    carry: mergeCarry(carryIn, null), phase, prompt: { ...NONE },
    spots: laySpots(s), glands: layGlands(s), poolOff: layPools(s),
    nest: { x: 0, y: 0, vx: 0, vy: N.slideUS, lastIn: 0, state: "drift", spot: -1, by: null, from: null, s0: 0, len: 0, p: 0 },
    root: null, pools: [], tree: null, tip: null, reaches: [], autoK: 0, glows: [], disc: null,
    counts: { you: 0, auto: 0, onBeat: 0 }, order: [],
    heart: null, track: createTrack([]), said: {}, times: {}, cam: null,
  };
  st.beats = makeBeats(s, [{ heart: "mother", from: 0, to: meta.capS + 30, bpm: meta.motherBpm, jitter: 0, first: phase }]);
  startMoment(st, 0);
  camera(st, true);
  return st;
}

function readIntents(intents) {
  const it = intents || EMPTY_INTENTS;
  const s = it.steer && fin(it.steer.x) && fin(it.steer.y) ? it.steer : { x: 0, y: 0 };
  const m = hyp(s.x, s.y);
  return {
    steer: m > 1 ? { x: s.x / m, y: s.y / m } : { x: s.x, y: s.y },
    touching: !!it.touching,
    presses: Array.isArray(it.presses) ? it.presses : [],
    releases: Array.isArray(it.releases) ? it.releases : [],
  };
}

export function step(st, intents) {
  if (!st || st.done) { if (st) st.t += DT; return; }
  try {
    const it = readIntents(intents);
    for (const r of feed(st.track, it, st.t + DT)) judged(st, r);
    if (st.moment === "nestle") stepNestle(st, it);
    else if (st.moment === "roots") stepRoots(st, it);
    else if (st.moment === "heart") stepHeart(st);
    else stepGrow(st);
    st.t += DT;
    while (!st.done && ends(st)) {
      if (st.mi >= ORDER.length - 1) finish(st, "end");
      else { endMoment(st); startMoment(st, st.mi + 1); }
    }
    if (!st.done) {
      st.gaDay = Math.max(st.gaDay, gaAt(meta.moments[st.mi], st.t - st.m0));
      if (st.t >= meta.capS - 1e-9) finish(st, "cap");
    }
    camera(st);
  } catch (e) {
    st.err = String((e && e.stack) || e);
    try { finish(st, "error"); } catch (e2) { st.done = true; }
  }
}

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
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
    d.anchor = { x: n.x, y: n.y };
    const cue = st.spots[n.spot >= 0 ? n.spot : nearestSpot(st, n.x, n.y)];
    d.cue = { x: cue.x, y: cue.y };
    return d;
  }

  // the lining spot you rest in, the pools, the tree and the link glows
  d.marks.push({ kind: "spot", x: st.root.x, y: st.root.y, r: N.spotR, rim: "solid", on: true, pulse: herPulse });
  const re = poolR(st, t);
  st.pools.forEach((p) => d.marks.push({ kind: "pool", x: p.x, y: p.y, r: re, rim: "dotted", on: p.linked, pulse: herPulse }));
  if (st.disc && st.mi === 3) {
    d.marks.push({ kind: "lake", x: st.disc.x, y: st.disc.y, r: Math.max(1, st.disc.r * ease(growP(st) * 1.4)), rim: "solid", on: true, pulse: herPulse });
  }
  d.strips.push({ kind: "tree", nodes: st.tree.view, version: st.tree.version, pulse: herPh });
  const items = [];
  for (const g of st.glows) {
    const a = (t - g.t0) / R.glowS;
    if (!(a >= 0 && a < 1)) continue;
    const p = st.pools[g.pool];
    items.push({ x: lerp(p.x, st.root.x, a), y: lerp(p.y, st.root.y, a), r: 3, a: 1 - 0.6 * a, dashed: false });
    items.push({ x: p.x, y: p.y, r: re * (1 + 0.6 * a), a: (1 - a) * (g.onBeat ? 1 : 0.5), dashed: !g.onBeat });
  }
  if (items.length) d.strips.push({ kind: "ripples", items });

  const f = figAt(st);
  if (st.mi === 1) {
    d.splats.push(...figure("curl", f.s, st.gaDay, { x: f.x, y: f.y }));
    const tip = st.tip;
    d.splats.push({ k: "c", x: tip.x, y: tip.y, r: 2.6, m: 0.4, n: 0, v: 0.8, hue: 0.09 });
    for (const h of st.reaches) d.splats.push({ k: "c", x: h.x, y: h.y, r: 1.8, m: 0.4, n: 0, v: 0.6, hue: 0.07 });
    const i = nearestPool(st, tip.x, tip.y);
    d.anchor = { x: tip.x, y: tip.y };
    d.cue = i >= 0 ? { x: st.pools[i].x, y: st.pools[i].y } : { x: tip.x, y: tip.y };
    const ring = i >= 0 ? st.pools[i] : tip;
    d.rings.push({ id: "mother", kind: "mother", x: ring.x, y: ring.y, r: poolBase(st) * 1.5, progress: herPh });
    return d;
  }

  // heart and grow: you, with your heart
  d.splats.push(...figure("curl", f.s, st.gaDay, { x: f.x, y: f.y }));
  const chest = { x: f.x + 0.02 * f.s, y: f.y - 0.02 * f.s };
  const youOn = st.heart && t >= st.heart.first;
  const youPulse = pulse(st, "you", t);
  d.rings.push({ id: "mother", kind: "mother", x: f.x, y: f.y, r: f.s * 0.75, progress: herPh });
  if (youOn) {
    d.marks.push({ kind: "glow", x: chest.x, y: chest.y, r: f.s * 0.08 * (1 + youPulse), on: true, pulse: youPulse });
    d.rings.push({ id: "you", kind: "you", x: chest.x, y: chest.y, r: f.s * 0.16, progress: clamp01(st.beats.phase("you", t)), dashed: true });
  }
  if (!st.done && st.mi === 2) {
    const pre = previewS(YOU_P);
    for (const x of targets(st, pre).slice(0, 2)) {
      const p = clamp01(1 - (x.t - t) / pre);
      d.rings.push({ id: "t:" + x.id, kind: "approach", x: chest.x, y: chest.y, r: f.s * 0.16 * (1 + 2 * (1 - p)), progress: p });
    }
  }
  d.anchor = { x: f.x, y: f.y };
  d.cue = st.mi === 2 ? chest : { x: f.x, y: f.y };
  return d;
}

export function prompt(st) {
  return st.done ? { ...NONE } : { ...st.prompt };
}

export function targets(st, horizonS) {
  if (st.done) return [];
  return upcoming(st.track, st.t, horizonS).map((x) => ({ id: x.id, t: x.t, P: x.P, kind: x.kind, heart: x.heart, group: x.group }));
}

// Seek the nearest spot; then the nearest unlinked pool (one no reach is after, if there is one), easing speed in the
// last 20 u so the tip enters on her next beat. Below skill 1 the arrival aim gets a seeded error per pool, kept in
// r.mem; at skill 1 r is never touched.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false };
  if (!st || st.done) return zero;
  const sk = clamp01(fin(skill) ? skill : 0);
  const m = (0.4 + 0.6 * sk) * MAG_SAFE;
  const toward = (dx, dy, mag) => {
    const d = hyp(dx, dy);
    return d < 1e-9 ? zero : { steer: { x: (dx / d) * mag, y: (dy / d) * mag }, dir: null, hold: false };
  };
  if (st.mi === 0) {
    const n = st.nest;
    if (n.state !== "drift") return zero;
    const sp = st.spots[nearestSpot(st, n.x, n.y)];
    return toward(sp.x - n.x, sp.y - n.y - 0.4 * N.slideUS, m);
  }
  if (st.mi !== 1) return zero;
  const tip = st.tip;
  let i = nearestPool(st, tip.x, tip.y, (j) => st.reaches.some((h) => h.pool === j));
  if (i < 0) i = nearestPool(st, tip.x, tip.y);
  if (i < 0) return zero;
  const p = st.pools[i];
  const dx = p.x - tip.x, dy = p.y - tip.y, d = hyp(dx, dy);
  const toEnter = Math.max(0, d - poolBase(st) * (1 + R.swell * 0.9));
  let mag = m;
  if (toEnter <= B.easeU) {
    let err = 0;
    if (sk < 1 && r) {
      const mem = r.mem || (r.mem = {});
      const aims = mem.aims || (mem.aims = {});
      if (!fin(aims[i])) aims[i] = gauss(r) * 0.135 * (1 - sk);
      err = aims[i];
    }
    // the beat whose (aimed) arrival is still reachable; locked once chosen, even after the beat itself passes
    const b = st.beats.next("mother", st.t + toEnter / (R.tipUS * m) - err);
    const want = b - st.t + err;
    mag = want > 1e-3 ? clamp(toEnter / want / R.tipUS, B.minMag, m) : m;
  }
  return toward(dx, dy, mag);
}

export function probe(st) {
  return null;
}

function inTimeCount(st) {
  let n = 0;
  st.track.targets.forEach((x, i) => { const r = st.track.results[i]; if (r && r.grade === "in" && !x.free) n++; });
  return n;
}

export function result(st) {
  const acc = st.track.targets.length ? accuracy(st.track) : 0;
  const inTime = inTimeCount(st);
  const goalMet = st.done;
  const pools = (S.pools * st.counts.you) / R.pools;
  const onBeat = (S.onBeat * st.counts.onBeat) / R.pools;
  const heart = S.heart * acc;
  const score = clampScore({ goal: goalMet ? PARTS.goal : 0, skill: pools + onBeat + heart, flourish: (S.inTime * inTime) / H.targets });
  const nestleX = st.root ? Math.round(clamp(st.root.x / 50, -1, 1) * 100) / 100 : 0;
  const order = st.order.join(",");
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "pools", label: "root.part.pools", value: Math.round(pools), max: S.pools },
      { id: "onBeat", label: "root.part.onBeat", value: Math.round(onBeat), max: S.onBeat },
      { id: "heart", label: "root.part.heart", value: Math.round(heart), max: S.heart },
      { id: "inTime", label: "root.part.inTime", value: score.flourish, max: S.inTime },
    ],
    metrics: {
      linked: st.counts.you + st.counts.auto, you: st.counts.you, auto: st.counts.auto, onBeat: st.counts.onBeat,
      heartAccuracy: acc, heartInTime: inTime, targets: st.track.targets.length, nestled: st.nest.by,
      nestleX, nodes: st.tree ? st.tree.n : 1, moment: st.moment, how: st.how, capped: st.how === "cap",
      times: { ...st.times }, err: st.err,
    },
    carryOut: { nestleX, treeSeed: (stream(st.seed + ":" + order, "treeSeed")() * 4294967296) >>> 0 },
  };
}

// Skip forward to a named moment (tests and ?moment=): what the skipped moments owe is settled by itself.
export function jump(st, id) {
  const i = ORDER.indexOf(id);
  if (!st || st.done || i < 0 || i <= st.mi) return false;
  try {
    while (st.mi < i) { endMoment(st); startMoment(st, st.mi + 1); }
    camera(st, true);
    return true;
  } catch (e) {
    st.err = String((e && e.stack) || e);
    return false;
  }
}
