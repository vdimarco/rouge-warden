// First Breath: stage 7, Third Trimester (`turn`): "Turn and breathe." A survivor-style auto-shooter on the shared
// action layer (core/lib/action.js; openspec/changes/first-breath-action-genres/design.md 5.7 and contract.md).
// {Carer}'s antibodies cross the placenta and guard you: they fly as Y darts at the nearest germ by themselves. You
// drag anywhere (or WASD / the arrows) to dodge the horde and sweep up the sparkles each popped germ leaves; a second
// tap (or Space) kicks, knocking the germs round you back. Sparkles fill the grow meter: at each of six levels three
// gift bubbles appear round you and the world slows to a quarter while you swim into one (after 3 s the middle one
// picks itself): more darts, a ring of antibodies round you, clumps that pop, a pulse on her heartbeat, a pip more,
// a bigger kick, a stronger pull. The womb gets snug (the arena eases from 54 to 38 u), the waves rise, and at 48 s
// the Big Germ comes with its rings and swarmers. At 60 s her antibodies clear every germ left and pull every
// sparkle to you; then you turn head-down (drag down, or by yourself at 6 s), rest while your song is hummed, and
// the outro says you are ready. At 0 hp you rest ("You need a rest."): never a game over; the Almost card offers Try
// again or Go on, and Go on plays the turn and the rest by themselves. Pure: every draw is seeded; step() never throws.
//
// Contract choices (design.md 5.7 leaves room):
// - Moments: waves (gaDay 196 to 245 over 60 s of the world clock, then a 1.4 s clear at 245), turn (245 to 252 at
//   head-down), rest (259 to 280, 10 s), outro (280, 3 s). The wave table, the arena's easing, the calms, the Big
//   Germ and the captions run on the world clock (A.t): it holds under a hit-stop and runs at 0.25× while the gift
//   bubbles show; her heartbeat, the gift timer and the cap run on the stage clock.
// - While the bubbles show you move at full speed (the stage moves you between the world's quarter steps) and cannot
//   kick; taking a gift gives 0.5 s of i-frames, so the world's return to full speed never lands a hit at once.
// - A drifter wanders until you are within 40 u, then chases. From 24 s drifters come in pairs, side by side from one
//   place on the wall, so the horde peaks near 30 germs. A swarmer ring's members past the wall are left out (the
//   wall is an escape gap). Germs wait for room under the cap of 40.
// - Each offer of three gifts holds at least one of Darts, Ring, Clump and Beat while one of them can still grow. While
//   the bubbles show, the view shows their words and no number pops.
// - The Big Germ: 72 hp; at half hp a second phase (its foe shots cleared, a hit-stop, a swell) sends its ring every
//   2.2 s as two rings 0.3 s apart. It sheds 2 swarmers every 4 s. Popping it drops 12 sparkles (Flourish 1,000).
// - Big kick: the kick's knock-back is 20 u × (1 + level) and its cooldown 1.4 s − 0.3 s a level.
// - The grow meter is a cream sweep round you (a DOM ring) that fills toward the next level; her antibodies stream
//   down the cord to you as small paper Ys while the germs come. A puffer leaves a heal 30% of the time ("Snug!").
// - Score: Goal 3,000; Skill 2,500 × germs you popped / germs that came (ticked at each pop at 2,000 / the planned
//   count, the rest at 60 s), 250 a level (1,500 for 6), 1,000 × pips left at 60 s / your max pips, 1,000 if you turn
//   yourself; Flourish 1,000 when the Big Germ pops before 60 s. The points events add up to the total. The rest is
//   not judged and the score does not change in it.
// - The clear's pops and the sparkles they would leave do not count; a level the clear's sparkles reach counts, with
//   no gift. A knock-out keeps its Skill and Flourish (pips 0) and ends with gaDay 280 and headDown fired; Go on
//   (jump "turn") plays the turn by itself, the rest and the outro with input ignored.
import { DT, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream } from "../rng.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS, makeIntents } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { figure } from "../lib/figure.js";
import { rimSparks } from "../lib/sparks.js";
import * as X from "../lib/action.js";
import { noteCaptions as note, readBy } from "../lib/rest.js";
import { actionSteer, goalSteer } from "../lib/actionbot.js";
import { TUNE } from "./turn.tune.js";
import { FACTS } from "./turn.facts.js";
import { TEXT } from "./turn.text.js";

const TAU = Math.PI * 2;
const EPS = 1e-9;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(fin(v) ? v : 0, 0, 1);
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const frac = (v) => v - Math.floor(v);

// ---- the moments
const mo = (id, from, to, lenS) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });
const MOMENTS = [
  mo("waves", 196, 245, TUNE.waveS),
  mo("turn", 245, 252, TUNE.turn.maxS),
  mo("rest", 259, 280, TUNE.rest.s),
  mo("outro", 280, 280, TUNE.outroS),
];
const IDS = MOMENTS.map((m) => m.id);
const HEAD_DOWN_GA = 252;

export const meta = Object.freeze({
  id: "turn", index: 6, name: "Third Trimester", verb: "Turn",
  orient: "fit",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 196, end: 280 }), fertilized: true,
  mm: Object.freeze({ start: 600, end: 700 }),
  action: true, goOn: "turn",
  motherBpm: TUNE.motherBpm,
  parS: Math.round(TUNE.waveS + TUNE.clearS + 2 + TUNE.rest.s + TUNE.outroS),
  capS: TUNE.capS, canFail: true, scored: true,
  moments: Object.freeze(MOMENTS),
});

const END_S = meta.capS + 40;
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const P_MOVE = Object.freeze({ gesture: "move", text: "turn.prompt.move", keys: "steer" });
const P_GIFT = Object.freeze({ gesture: "move", text: "turn.prompt.gift", keys: "steer" });
const P_FREE = Object.freeze({ gesture: "move", text: null, keys: "steer" });
const P_TURN = Object.freeze({ gesture: "move", text: "turn.turn", keys: "steer" });
const P_REST = Object.freeze({ gesture: "hold", text: "turn.rest", keys: "steer" });
const P_OUTRO = Object.freeze({ gesture: "none", text: "turn.outro", keys: "steer" });

// The facts and lines on the world clock of the waves (seconds into them): the first darts, then each wave's calm.
const CAPTIONS = Object.freeze([
  [1.0, "fact", "turn.antibody"],
  [3.0, "sub", "grow"],
  [12.2, "fact", "turn.lungs"],
  [20.0, "line", "turn.snug"],
  [24.2, "fact", "turn.focus"],
  [36.2, "fact", "turn.months"],
  [48.4, "fact", "turn.practice"],
]);

// The planned germs (Assist: 0.75× as many) and the yardstick of the pop ticks.
function planRows(k) {
  const rows = [];
  for (const w of TUNE.waves) {
    for (const kind of ["drifter", "puffer"]) {
      if (!w[kind]) continue;
      const every = w[kind] / k, n = kind === "drifter" ? w.pack || 1 : 1;
      for (let t = w.from; t < w.to - EPS; t += every) rows.push({ at: t, kind, n });
    }
    for (const at of w.rings || []) rows.push({ at, kind: "ring" });
  }
  rows.push({ at: TUNE.bigAt, kind: "big" });
  rows.sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  return rows;
}
const planCount = (rows, k) => rows.reduce((a, r) => a + (r.kind === "ring" ? Math.ceil(TUNE.ringN * k) : r.n || 1), 0);

// ---- small helpers

function caption(st, id) {
  emit(st, "fact", { id, where: "caption" });
  emit(st, "caption", { id, dir: null });
}
function line(st, id) { emit(st, "caption", { id, dir: null }); }
function sfx(st, id, x, y, extra = {}) { emit(st, "sfx", { id, x, y, ...extra }); }
function points(st, part, add) {
  const n = Math.round(add);
  if (n > 0) emit(st, "points", { part, add: n });
  return n > 0 ? n : 0;
}
function setPrompt(st, p) {
  if (st.prompt === p) return;
  st.prompt = p;
  emit(st, "prompt", { ...p });
}
function tag(st, x, y, word, dur = 1.1) {
  st.tags.push({ x, y, word, t0: st.t, dur });
  if (st.tags.length > 6) st.tags.shift();
}
function fx(st, kind, x, y, r, dur, extra = {}) {
  st.fx.push({ kind, x, y, r, t0: st.t, dur, ...extra });
  if (st.fx.length > 12) st.fx.shift();
}
const levelAt = (st, i) => Math.ceil(TUNE.levels[i] * (st.assist ? TUNE.assist.levelK : 1));
const lvOf = (st, id) => st.gifts[id] || 0;
// How full the grow meter is toward the next level (0 to 1; 1 once every level is reached).
function growFill(st) {
  if (st.level >= TUNE.levels.length) return 1;
  const lo = st.level > 0 ? levelAt(st, st.level - 1) : 0, hi = levelAt(st, st.level);
  return clamp01((st.sparkles - lo) / Math.max(1, hi - lo));
}

// The arena's radius at world time tw into the waves: 54 u, easing to 38 u from 20 to 55 s.
function arenaR(tw) {
  const a = TUNE.arena;
  return a.r0 + (a.r1 - a.r0) * smooth((tw - a.t0) / (a.t1 - a.t0));
}

// The placenta disc's angle on the wall: up, and toward the side you nestled (carry nestleX).
const discAngle = (carry) => Math.PI / 2 - 0.6 * clamp(fin(carry.nestleX) ? carry.nestleX : 0, -1, 1);
// ... and where it sits now: on the wall, coming in as the womb gets snug.
function discXY(st) {
  const a = st.disc.ang, d = st.A.arena.r + TUNE.view.disc.out;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: st.disc.r };
}

// ---- the score
const poppedPart = (st) => Math.round(TUNE.score.popped * Math.min(1, st.popped / Math.max(1, st.A.spawned)));
const levelsPart = (st) => Math.round((TUNE.score.levels * Math.min(6, st.level)) / 6);

// ---- spawning

function spawnRow(st, row) {
  const A = st.A, F = TUNE.foes, p = A.p;
  if (row.kind === "big") return spawnBig(st);
  if (A.foes.length >= TUNE.foeCap) return false;
  if (row.kind === "ring") {
    const n = Math.ceil(TUNE.ringN * st.assistK), a0 = st.rWave() * TAU, R = A.arena.r - 3;
    for (let k = 0; k < n; k++) {
      if (A.foes.length >= TUNE.foeCap + 4) break;
      const a = a0 + (k * TAU) / n, ux = Math.cos(a), uy = Math.sin(a);
      const b = p.x * ux + p.y * uy, c = p.x * p.x + p.y * p.y - R * R;
      const d = -b + Math.sqrt(Math.max(0, b * b - c));               // to the wall along this ray
      const rr = Math.min(TUNE.ringR, d);
      if (rr < p.clearR + 1) continue;                                 // the wall is close: a gap in the ring
      X.spawnFoe(A, { ...F.swarmer, x: p.x + ux * rr, y: p.y + uy * rr });
    }
    sfx(st, "act.tell", p.x, p.y);
    return true;
  }
  // a pack comes in from one place on the wall, side by side along it
  const a = st.rWave() * TAU, n = row.n || 1;
  for (let k = 0; k < n; k++) {
    const q = X.rimPoint(A, a + (k - (n - 1) / 2) * (TUNE.packGap / A.arena.r), 4);
    X.spawnFoe(A, { ...F[row.kind], x: q.x, y: q.y });
  }
  return true;
}

function spawnBig(st) {
  const A = st.A, p = A.p, B = TUNE.foes.big;
  const d = Math.hypot(p.x, p.y);
  const a = d > 0.5 ? Math.atan2(-p.y, -p.x) : Math.PI / 2 + (st.rWave() - 0.5);    // the far edge from you
  const q = X.rimPoint(A, a, B.r + 2);
  const f = X.spawnFoe(A, { ...B, hp: st.assist ? TUNE.assist.bigHp : B.hp, x: q.x, y: q.y, anywhere: true });
  st.big = { id: f ? f.id : 0, addT: TUNE.big.addEvery, phase: 0, t0: A.t };
  A.juice.shake = Math.min(1, A.juice.shake + 0.5);
  sfx(st, "act.phase", q.x, q.y, { pitch: 0 });
  subgoal(st, "big", "turn.sub.big");
  return true;
}

function bigStep(st) {
  const A = st.A, b = st.big;
  if (!b || st.bigPopped) return;
  const f = A.foes.find((g) => g.id === b.id);
  if (!f || f.in > 0) return;
  const G = TUNE.big;
  if (b.phase === 0 && f.hp <= f.hpMax * G.phase2) {
    b.phase = 1;
    f.phase = 1;
    f.gun = { ...f.gun, every: G.every2, burst: 2, gap: G.gap2, spin: TAU / 24 };
    f.cool = Math.max(f.cool, 1.0);
    f.aim = null;
    X.clearBullets(A, 2);
    A.tells.length = 0;
    X.hitStop(A, A.juiceK.stopPhase);
    A.juice.shake = Math.min(1, A.juice.shake + 0.8);
    sfx(st, "act.phase", f.x, f.y, { pitch: 1 });
  }
  b.addT -= DT;
  if (b.addT <= 0) {
    b.addT += G.addEvery;
    for (let k = 0; k < G.adds; k++) {
      if (A.foes.length >= TUNE.foeCap) break;
      const a = A.rnd() * TAU;
      X.spawnFoe(A, { ...TUNE.foes.swarmer, x: f.x + Math.cos(a) * (f.r + 3), y: f.y + Math.sin(a) * (f.r + 3) });
    }
  }
}

// ---- your antibodies: the gifts

function offerOf(st) {
  const ids = TUNE.gifts.filter((g) => lvOf(st, g.id) < g.max).map((g) => g.id);
  const r = st.rGift;
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
  // a few strong antibody picks (20 Minutes Till Dawn): while one can still grow, each offer holds at least one of
  // Darts, Ring, Clump and Beat
  const out = ids.slice(0, 3), arms = ids.slice(3).filter((id) => TUNE.arms.includes(id));
  if (out.length === 3 && arms.length && !out.some((id) => TUNE.arms.includes(id))) out[2] = arms[0];
  return out;
}

function startOffer(st) {
  const A = st.A, p = A.p, G = TUNE.gift;
  const ids = offerOf(st);
  if (!ids.length) { st.levelsDue = 0; return; }
  // up from you, or toward the middle when you are high in the womb; each bubble kept inside the wall
  const base = p.y <= 0 || Math.hypot(p.x, p.y) < 8 ? Math.PI / 2 : Math.atan2(-p.y, -p.x);
  const lim = A.arena.r - G.bubbleR - G.wallPad;
  st.offer = ids.map((id, k) => {
    const a = base + (G.angs[Math.min(k, 2)] - Math.PI / 2);
    let x = p.x + Math.cos(a) * G.bubbleD, y = p.y + Math.sin(a) * G.bubbleD;
    const d = Math.hypot(x, y);
    if (d > lim) { x *= lim / d; y *= lim / d; }
    return { id, x, y, t0: st.t };
  });
  st.pickT0 = st.t;
  st.slowAcc = 0;
  setPrompt(st, P_GIFT);
  sfx(st, "sparkle", p.x, p.y);
}

function applyGift(st, id) {
  const A = st.A, lv = (st.gifts[id] = lvOf(st, id) + 1);
  if (id === "darts") {
    A.fire.spread = lv;
    A.fire.rate = TUNE.fire.rate * Math.pow(TUNE.darts.rateK, lv - 1);
  } else if (id === "clump") {
    if (lv === 1) st.clumpT = A.t + 1.0;
  } else if (id === "snug") {
    A.p.hpMax += 1;
    A.p.hp = A.p.hpMax;
    sfx(st, "act.heal", A.p.x, A.p.y);
  } else if (id === "kick") {
    A.dash.cdS = Math.max(0.3, (TUNE.kick.cdS - TUNE.kickGift.cdLess * lv) * (st.assist ? TUNE.assist.dashCdK : 1));
  } else if (id === "grow") {
    A.pick.magnet = TUNE.pickup.magnet * (1 + TUNE.growGift.magnetK * lv);
  }
}

function take(st, k, how) {
  const A = st.A, b = st.offer[k], G = TUNE.gift;
  applyGift(st, b.id);
  st.picks++;
  st.taken.push({ id: b.id, how, level: st.picks });
  st.levelsDue = Math.max(0, st.levelsDue - 1);
  X.burst(A, b.x, b.y, G.bubbleR * 1.3, 2);
  fx(st, "ring", b.x, b.y, G.bubbleR, 0.5);
  tag(st, b.x - G.bubbleR - 1, b.y + G.bubbleR + 1, "turn.gift." + b.id, 1.2);
  sfx(st, "act.up", b.x, b.y);
  if (b.id === "beat") sfx(st, "turn.beat", A.p.x, A.p.y, { pitch: lvOf(st, "beat") });   // her heartbeat louder (5.7)
  A.p.inv = Math.max(A.p.inv, 0.5);
  st.offer = null;
  st.nextOfferS = st.t + G.gapS;
  setPrompt(st, P_MOVE);
}

function pickStep(st) {
  const p = st.A.p, G = TUNE.gift;
  for (let k = 0; k < st.offer.length; k++) {
    const b = st.offer[k];
    if (Math.hypot(b.x - p.x, b.y - p.y) < p.body + G.bubbleR) { take(st, k, "you"); return; }
  }
  if (st.t - st.pickT0 >= G.pickS - EPS) take(st, Math.min(1, st.offer.length - 1), "auto");
}

// You move at full speed while the world runs at a quarter (the layer's own movement, the wall included).
function moveOnly(A, it) {
  const p = A.p;
  p.inv = Math.max(0, p.inv - DT * TUNE.gift.slowK);
  if (A.ko || p.fixed) return;
  const m = X.moveOf(it);
  p.mx = m.x; p.my = m.y;
  if (Math.hypot(m.x, m.y) > 0.15) p.face = Math.atan2(m.y, m.x);
  const k = Math.min(1, p.accel * DT);
  p.vx += (m.x * p.speed - p.vx) * k;
  p.vy += (m.y * p.speed - p.vy) * k;
  p.x += p.vx * DT; p.y += p.vy * DT;
  const ar = A.arena, dx = p.x - ar.x, dy = p.y - ar.y, d = Math.hypot(dx, dy), lim = ar.r - p.body * 0.8;
  if (d > lim && d > EPS) {
    p.x = ar.x + (dx / d) * lim; p.y = ar.y + (dy / d) * lim;
    const vn = (p.vx * dx + p.vy * dy) / d;
    if (vn > 0) { p.vx -= (vn * dx) / d; p.vy -= (vn * dy) / d; }
  }
}

// The Tag ring: antibodies circling you pop what they touch (1 a touch, once a germ each 0.4 s).
function ringSpots(st) {
  const lv = lvOf(st, "ring"), R = TUNE.ring, p = st.A.p, out = [];
  if (!lv) return out;
  const n = R.n0 + R.nK * (lv - 1), r = R.r0 + R.rK * (lv - 1);
  for (let k = 0; k < n; k++) {
    const a = st.ringA + (k * TAU) / n;
    out.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, ang: a + Math.PI / 2 });
  }
  return out;
}

function ringStep(st) {
  if (!lvOf(st, "ring")) return;
  const A = st.A, R = TUNE.ring;
  st.ringA += R.w * DT;
  for (const o of ringSpots(st)) {
    for (const f of A.foes.slice()) {
      if (f.in > 0 || f.hp <= 0 || (f.tagT || 0) > A.t) continue;
      const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
      if (d > f.r + R.hitR) continue;
      f.tagT = A.t + R.perS;
      const ex = f.x - A.p.x, ey = f.y - A.p.y, e = Math.hypot(ex, ey) || 1;
      X.damageFoe(A, f, R.dmg, (ex / e) * R.push * 3, (ey / e) * R.push * 3);
    }
  }
}

// Clump: every few seconds the densest group within 50 u is pulled together, then pops for 3 in 12 u.
function clumpStep(st) {
  const lv = lvOf(st, "clump");
  if (!lv) return;
  const A = st.A, C = TUNE.clump, p = A.p;
  if (st.clump) {
    const c = st.clump, k = A.t - c.t0;
    if (k < C.pullS) {
      for (const f of A.foes) {
        if (f.in > 0 || f.boss) continue;
        const dx = c.x - f.x, dy = c.y - f.y, d = Math.hypot(dx, dy);
        if (d > C.r * 1.7 || d < 0.5) continue;
        f.vx = (dx / d) * C.pull; f.vy = (dy / d) * C.pull;
      }
      return;
    }
    for (const f of A.foes.slice()) {
      if (f.in > 0) continue;
      const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d > C.r + f.r) continue;
      X.damageFoe(A, f, C.dmg, (dx / d) * 30, (dy / d) * 30);
    }
    X.burst(A, c.x, c.y, C.r * 0.6, 2);
    fx(st, "pop", c.x, c.y, C.r, 0.35);
    A.juice.shake = Math.min(1, A.juice.shake + 0.22);
    sfx(st, "root.snap", c.x, c.y, { pitch: 1 });
    st.clump = null;
    st.clumps++;
    return;
  }
  if (A.t < st.clumpT) return;
  let best = null, bn = 0;
  for (const f of A.foes) {
    if (f.in > 0 || Math.hypot(f.x - p.x, f.y - p.y) > C.range) continue;
    let n = 0;
    for (const g of A.foes) if (g.in <= 0 && Math.hypot(g.x - f.x, g.y - f.y) <= C.r) n++;
    if (n > bn) { bn = n; best = f; }
  }
  if (!best) { st.clumpT = A.t + 0.5; return; }
  st.clump = { x: best.x, y: best.y, t0: A.t };
  st.clumpT = A.t + C.every[Math.min(lv, 3) - 1];
  fx(st, "clump", best.x, best.y, C.r * 1.7, C.pullS);
}

// {Carer}'s beat: every 4 of her beats a warm ring pulse pushes the germs round you back and does 1.
function beatStep(st) {
  const m = st.beats.mother;
  while (st.beatI < m.length && m[st.beatI] <= st.t + EPS) {
    st.beatI++;
    st.beatN++;
    const lv = lvOf(st, "beat");
    if (!lv || st.phase !== "waves" || st.A.ko || st.beatN % TUNE.beat.every !== 0) continue;
    const A = st.A, p = A.p, B = TUNE.beat, R = B.r[Math.min(lv, 3) - 1];
    for (const f of A.foes.slice()) {
      if (f.in > 0) continue;
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > R + f.r) continue;
      X.damageFoe(A, f, B.dmg, (dx / d) * B.push * 4, (dy / d) * B.push * 4);
    }
    fx(st, "beat", p.x, p.y, R, B.showS);
    sfx(st, "root.linkBeat", p.x, p.y, { pitch: 1 });
    st.pulses++;
  }
}

// The kick (the layer's dash): germs within 14 u are knocked back and take 1.
function kick(st) {
  const A = st.A, p = A.p, K = TUNE.kick, push = K.push * (1 + lvOf(st, "kick"));
  let n = 0;
  for (const f of A.foes.slice()) {
    if (f.in > 0) continue;
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d > K.r + f.r) continue;
    n++;
    X.damageFoe(A, f, K.dmg, (dx / d) * push * 3.5, (dy / d) * push * 3.5);
  }
  st.kicks++;
  fx(st, "kick", p.x, p.y, K.r, 0.3);
  if (n > 0) { X.hitStop(A, 2); A.juice.shake = Math.min(1, A.juice.shake + 0.18 + 0.04 * n); }
}

// ---- the grow meter

function levelCheck(st) {
  const A = st.A;
  while (st.level < TUNE.levels.length && st.sparkles >= levelAt(st, st.level)) {
    st.level++;
    st.parts.levels += points(st, "skill", levelsPart(st) - st.parts.levels);
    if (st.phase === "waves" && !A.ko) st.levelsDue++;
    st.grewAt = st.t;
    tag(st, A.p.x - 2, A.p.y + A.p.body + 2, "turn.pop.level", 0.9);
    if (st.level === 1 && st.subgoals.grow === "shown") doneBy(st, "grow", "you", "turn.sub.growDone");
  }
}

// ---- the outcomes of a world step

function outcomes(st) {
  const A = st.A;
  for (const o of A.out) {
    if (o.type === "clear" && st.phase === "waves") {
      st.popped++;
      const room = Math.max(0, TUNE.score.popped - st.parts.popped);
      const add = Math.min(room, Math.floor(TUNE.score.popTick / st.plan));
      st.parts.popped += points(st, "skill", add);
      X.pop(A, o.x, o.y, add, o.combo);
      X.drop(A, "up", o.x, o.y, o.boss ? TUNE.foes.big.sparkles : 1, 1);
      if (o.boss) bigPopped(st, o);
    } else if (o.type === "pick" && o.kind === "up") {
      st.sparkles += o.v;
      levelCheck(st);
    } else if (o.type === "pick" && o.kind === "heal") {
      sfx(st, "act.heal", o.x, o.y);
      tag(st, o.x - 2, o.y + 4, "turn.pop.heal", 0.8);
    } else if (o.type === "dash") {
      kick(st);
    }
  }
  X.emitOut(A, st);
}

function bigPopped(st, o) {
  const A = st.A;
  st.bigPopped = true;
  st.bigAt = A.t;
  if (A.t - st.w0 < TUNE.waveS) st.parts.flourish += points(st, "flourish", TUNE.score.flourish);
  X.clearBullets(A, 2);
  A.tells.length = 0;
  X.hitStop(A, A.juiceK.stopPhase);
  A.juice.shake = 1;
  st.booms = { x: o.x, y: o.y, n: 0, t0: A.t };
  sfx(st, "act.win", o.x, o.y);
  if (st.subgoals.big === "shown") doneBy(st, "big", "you", "turn.sub.bigDone");
}

// ---- moments

function enterMoment(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = Math.max(st.gaDay, MOMENTS[i].ga[0]);
  emit(st, "moment", { id: st.moment });
}

// The waves end: every germ left pops (a sweep out from the placenta), every sparkle is pulled to you.
function startClear(st) {
  const A = st.A;
  st.phase = "clear";
  st.c0 = A.t;
  st.ri = st.rows.length;
  st.offer = null;
  st.levelsDue = 0;
  const d = discXY(st);
  st.sweep = A.foes.map((f) => ({ id: f.id, at: A.t + 0.15 + 0.7 * clamp01(Math.hypot(f.x - d.x, f.y - d.y) / (2 * TUNE.arena.r0)) }));
  const B = A.b, step = Math.max(1, Math.ceil(B.n / 8));
  for (let i = 0; i < B.n; i += step) if (B.side[i] === 2) X.burst(A, B.x[i], B.y[i], 2, 2);
  X.clearBullets(A, 2);
  A.tells.length = 0;
  X.vacuum(A, TUNE.clearS);
  A.p.inv = Math.max(A.p.inv, TUNE.clearS + 1);
  A.juice.shake = Math.min(1, A.juice.shake + 0.4);
  st.clump = null;
  // the pips you kept, and the rest of the popped share, at 60 s
  st.parts.pips += points(st, "skill", (TUNE.score.pips * Math.max(0, A.p.hp)) / Math.max(1, A.p.hpMax));
  st.parts.popped += points(st, "skill", poppedPart(st) - st.parts.popped);
  st.poppedFinal = true;
  if (st.subgoals.grow === "shown") doneBy(st, "grow", "auto", "turn.sub.growAuto");
  if (st.subgoals.big === "shown") doneBy(st, "big", "auto", "turn.clear");
  else line(st, "turn.clear");
  sfx(st, "act.win", A.p.x, A.p.y);
  setPrompt(st, P_FREE);
}

function clearStep(st) {
  const A = st.A;
  for (const s of st.sweep) {
    if (s.done || A.t < s.at) continue;
    s.done = true;
    const f = A.foes.find((g) => g.id === s.id);
    if (!f) continue;
    X.burst(A, f.x, f.y, f.r * 1.2, f.boss ? 0 : 2);
    if (f.boss) A.juice.shake = Math.min(1, A.juice.shake + 0.5);
    X.removeFoe(A, f.id);
  }
}

function startTurn(st, auto) {
  const A = st.A;
  enterMoment(st, 1);
  st.phase = "turn";
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 2); X.removeFoe(A, f.id); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  A.p.fixed = true;
  A.p.vx = 0; A.p.vy = 0;
  st.offer = null;
  st.clump = null;
  st.T = { t0: st.t, held: 0, ang: 0, by: null, doneAt: null, auto: null, x0: A.p.x, y0: A.p.y };
  if (auto) { startAuto(st); setPrompt(st, NONE); }
  else setPrompt(st, P_TURN);
}

function startAuto(st) {
  const T = st.T;
  if (T.auto || T.by) return;
  T.auto = { t0: st.t, from: T.ang };
  st.gaDay = Math.max(st.gaDay, HEAD_DOWN_GA);
  caption(st, "turn.head");
  line(st, "turn.auto");
  sfx(st, "roomy", st.A.p.x, st.A.p.y, { pitch: 1, gain: 0.5 });
  if (!st.wentOn) setPrompt(st, NONE);
}

// You are head-down: by you (the stick held down 1.0 s in all) or by itself (the 6 s turn has ended).
function headDown(st, by) {
  const T = st.T;
  if (T.by) return;
  T.by = by;
  T.doneAt = st.t;
  st.gaDay = Math.max(st.gaDay, HEAD_DOWN_GA);
  if (by === "you") {
    caption(st, "turn.head");
    st.parts.turn += points(st, "skill", TUNE.score.turn);
  }
  if (!st.fired.headDown) { st.fired.headDown = true; emit(st, "milestone", { id: "headDown" }); }
  sfx(st, "headDown", st.A.p.x, st.A.p.y, { pitch: 1, gain: 0.7 });
  setPrompt(st, NONE);
}

function turnStep(st, it) {
  const T = st.T, U = TUNE.turn, A = st.A, el = st.t - T.t0;
  // you drift to the middle of the snug womb as you grow into it
  const g = smooth(el / U.growS);
  A.p.x = T.x0 * (1 - g); A.p.y = T.y0 * (1 - g);
  if (!T.by && !T.auto) {
    const s = it && it.steer;
    const y = s && fin(s.y) ? s.y : 0;
    if (!st.wentOn && y < -U.deflect) {
      if (T.held === 0) sfx(st, "roomy", A.p.x, A.p.y, { pitch: 1, gain: 0.5 });     // a slow whoosh as you start to turn
      T.held += DT;
    }
    T.ang = Math.PI * smooth(T.held / U.holdS);
    if (T.held >= U.holdS - EPS) headDown(st, "you");
    else if (el >= U.maxS - EPS) startAuto(st);
  } else if (T.auto && !T.by) {
    const k = (st.t - T.auto.t0) / U.autoS;
    T.ang = T.auto.from + (Math.PI - T.auto.from) * smooth(k);
    if (k >= 1 - EPS) headDown(st, "auto");
  } else {
    T.ang += (Math.PI - T.ang) * Math.min(1, 8 * DT);
    if (st.t - T.doneAt >= U.settleS - EPS) startRest(st);
  }
}

function startRest(st) {
  const A = st.A;
  st.T.ang = Math.PI;
  enterMoment(st, 2);
  st.phase = "rest";
  st.rest = { t0: st.t, warm: 0 };
  st.held = false;                     // a hold needs a fresh press (5.3)
  const song = st.carry.song;
  emit(st, "song", { notes: song.notes.slice(), lit: song.lit, at: st.t + TUNE.rest.noteLeadS, noteS: TUNE.rest.noteGapS, muffled: true });
  caption(st, "turn.curl");
  setPrompt(st, st.wentOn ? NONE : P_REST);
  A.p.inv = 99;
}

function startOutro(st) {
  enterMoment(st, 3);
  st.phase = "outro";
  st.outroT0 = st.t;
  st.held = false;
  setPrompt(st, st.wentOn ? NONE : P_OUTRO);
}

// Presses and releases in time order: a press starts a hold, a release ends it.
function holds(st, it) {
  const evs = [];
  for (const p of Array.isArray(it.presses) ? it.presses : []) if (p && fin(p.t)) evs.push([p.t, 1]);
  for (const r of Array.isArray(it.releases) ? it.releases : []) if (r && fin(r.t)) evs.push([r.t, 0]);
  evs.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  for (const [, down] of evs) st.held = !!down;
}

// ---- the end

function settle(st, how) {
  if (st.subgoals.grow === "shown") doneBy(st, "grow", "auto", "turn.sub.growAuto");
  if (st.subgoals.big === "shown") doneBy(st, "big", "auto", how === "ko" ? "turn.sub.rest" : "turn.clear");
}

// A knock-out: you rest. The germs drift off, and the stage holds until what was said is read, then ends with its
// goal unmet (core/run.js shows the Almost card).
function knockOut(st) {
  const A = st.A;
  st.phase = "ko";
  st.koAt = st.t;
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 0); X.removeFoe(A, f.id); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  st.offer = null;
  st.clump = null;
  const open = st.subgoals.big === "shown";
  settle(st, "ko");
  if (!open) line(st, "turn.sub.rest");
  setPrompt(st, NONE);
}

function finish(st, how) {
  if (st.done) return;
  const A = st.A;
  st.done = true;
  st.doneT = st.t;
  st.how = how;
  const met = how === "end" || (how === "cap" && !A.ko && !st.wentOn);
  st.goalMet = met;
  st.gaDay = meta.ga.end;
  if (!st.fired.headDown) { st.fired.headDown = true; emit(st, "milestone", { id: "headDown" }); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  settle(st, how);
  if (!st.poppedFinal) { st.parts.popped += points(st, "skill", poppedPart(st) - st.parts.popped); st.poppedFinal = true; }
  if (met) points(st, "goal", TUNE.score.goal);
  st.held = false;
  setPrompt(st, NONE);
  emit(st, "done", {});
}

// ---- the Stage interface

export function create(seed, carryIn, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const carry = mergeCarry(carryIn, null);
  const s = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 0;
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const assist = !!o.assist;
  const As = TUNE.assist, K = TUNE.kick;
  const dAng = discAngle(carry);
  const A = X.createWorld(s, {
    arena: { x: 0, y: 0, r: TUNE.arena.r0 },
    player: { ...TUNE.player, x: 0, y: -4, hp: TUNE.player.hp + (assist ? As.hpPlus : 0),
      shield: Math.min(2, Math.max(0, carry.sparks | 0)) },
    dash: { speed: K.speed, s: K.s, invS: K.invS, cdS: K.cdS * (assist ? As.dashCdK : 1), bufferS: K.bufferS },
    fire: { ...TUNE.fire },
    pickup: { ...TUNE.pickup },
    bulletK: assist ? As.bulletK : 1,
    bulletCap: TUNE.bulletCap,
    keepOut: [{ ang: dAng, half: TUNE.keepOut * TAU }],
    wallCull: 0,                                   // darts and sparks end at the soft womb wall
  });

  // the placenta disc on the wall where you nestled; its lobes echo your root tree (treeSeed, else the stage seed)
  const V = TUNE.view;
  const disc = { ang: dAng, r: V.disc.r, lobes: [] };
  const rl = stream(carry.treeSeed === null ? s : carry.treeSeed, "turn:disc");
  for (let k = 0; k < 3; k++) {
    disc.lobes.push({ a: Math.PI + (k - 1) * 0.9 + (rl() - 0.5) * 0.5, d: V.disc.r * (0.55 + 0.25 * rl()), r: V.disc.r * (0.42 + 0.2 * rl()) });
  }
  const assistK = assist ? As.foesK : 1;
  const rows = planRows(assistK);

  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.ga.start, fertilized: true,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    assist, lag: fin(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    A, mi: 0, phase: "waves", w0: 0, c0: 0, rows, ri: 0, plan: planCount(rows, assistK), assistK,
    rWave: stream(s, "waves"), rGift: stream(s, "gifts"),
    disc, popped: 0, sparkles: 0, level: 0, levelsDue: 0, grewAt: -Infinity,
    gifts: { darts: 1 }, offer: null, pickT0: 0, nextOfferS: 0, slowAcc: 0, picks: 0, taken: [],
    ringA: 0, clumpT: Infinity, clump: null, clumps: 0, beatI: 0, beatN: 0, pulses: 0, kicks: 0,
    calmI: 0, big: null, bigPopped: false, bigAt: null, booms: null, sweep: [],
    T: null, rest: { t0: null, warm: 0 }, held: false, outroT0: null, wentOn: false,
    parts: { popped: 0, levels: 0, pips: 0, turn: 0, flourish: 0 }, poppedFinal: false,
    capQ: CAPTIONS.map(([at, kind, id]) => ({ at, kind, id })), prompt: null, tags: [], fx: [],
    done: false, doneT: 0, how: null, goalMet: false, koAt: null, koEnd: null, capBusy: 0, evSeen: 0, fired: {}, faults: 0,
  };
  st.beats = makeBeats(s, [
    { heart: "mother", from: 0, to: END_S, bpm: TUNE.motherBpm, jitter: 0, first: phase },
    { heart: "you", from: 0, to: 85, bpm: [140, 130], jitter: 0 },
    { heart: "you", from: 85, to: END_S, bpm: 130, jitter: 0 },
  ]);
  enterMoment(st, 0);
  setPrompt(st, P_MOVE);
  note(st, FACTS, TEXT);
  return st;
}

function wavesStep(st) {
  const A = st.A, tw = A.t - st.w0;
  A.arena.r = arenaR(tw);
  // each wave's 1 s calm opens on a soft swell
  while (st.calmI < TUNE.calms.length && tw >= TUNE.calms[st.calmI] - EPS) { sfx(st, "swell", A.p.x, A.p.y, { pitch: 1, gain: 0.5 }); st.calmI++; }
  while (st.ri < st.rows.length && st.rows[st.ri].at <= tw + EPS) {
    if (!spawnRow(st, st.rows[st.ri])) break;                       // no room: it waits
    st.ri++;
  }
  for (const f of A.foes) {                                         // a drifter chases once you are near
    if (f.ai === "wander" && f.in <= 0 && Math.hypot(f.x - A.p.x, f.y - A.p.y) < TUNE.foes.drifter.chaseR) f.ai = "chase";
  }
  bigStep(st);
  ringStep(st);
  clumpStep(st);
  if (st.booms && st.booms.n < 4 && A.t - st.booms.t0 >= 0.1 * (st.booms.n + 1)) {
    const b = st.booms, a = A.rnd() * TAU, d = 3 + 2.5 * b.n;
    X.burst(A, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 8 - b.n, b.n % 2 ? 2 : 0);
    b.n++;
  }
  if (tw >= TUNE.waveS - EPS) startClear(st);
}

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  if (st.done) { st.t += DT; return; }
  const t1 = (fin(st.t) ? st.t : 0) + DT;
  try {
    const it = intents && typeof intents === "object" ? makeIntents(intents) : EMPTY_INTENTS;
    const A = st.A;
    let moved;
    if (st.offer && st.phase === "waves") {
      // the gift bubbles show: the world at a quarter, you at full speed, no kick
      const calm = { ...it, presses: [] };
      st.slowAcc += TUNE.gift.slowK;
      if (st.slowAcc >= 1 - EPS) { st.slowAcc -= 1; moved = X.stepWorld(A, calm); }
      else { A.out.length = 0; moveOnly(A, it); moved = false; }
    } else {
      moved = X.stepWorld(A, st.phase === "waves" ? it : { ...it, presses: [] });
    }
    outcomes(st);
    if (A.ko && st.phase === "waves") knockOut(st);
    st.t = t1;
    beatStep(st);
    if (st.phase === "waves") {
      if (moved) wavesStep(st);
      if (st.phase === "waves" && st.offer) pickStep(st);
      if (st.phase === "waves" && !st.offer && st.levelsDue > 0 && st.t >= st.nextOfferS && !A.ko) startOffer(st);
    } else if (st.phase === "clear") {
      if (moved) clearStep(st);
      if (A.t - st.c0 >= TUNE.clearS - EPS) startTurn(st, false);
    } else if (st.phase === "turn") {
      turnStep(st, it);
    } else if (st.phase === "rest") {
      holds(st, it);
      const w = st.rest.warm;
      st.rest.warm = st.held && !st.wentOn ? Math.min(1, w + DT / TUNE.rest.warmUpS) : Math.max(0, w - DT / TUNE.rest.warmDownS);
      if (st.t - st.rest.t0 >= TUNE.rest.s - EPS) startOutro(st);
    } else if (st.phase === "outro") {
      if (st.t - st.outroT0 >= TUNE.outroS - EPS) finish(st, st.wentOn ? "goOn" : "end");
    }
    // the captions on the world clock of the waves
    while (st.phase === "waves" && st.capQ.length && st.capQ[0].at <= A.t - st.w0 + EPS) {
      const q = st.capQ.shift();
      if (q.kind === "fact") caption(st, q.id);
      else if (q.kind === "line") line(st, q.id);
      else if (q.id === "grow" && st.level === 0) subgoal(st, "grow", "turn.sub.grow");
    }
    // the clock: weeks 28 to 35 over the waves, 35 to 36 in the turn (36 at head-down), 37 to 40 in the rest
    const m = MOMENTS[st.mi];
    let g = st.gaDay;
    if (st.phase === "waves") g = m.ga[0] + (m.ga[1] - m.ga[0]) * clamp01((A.t - st.w0) / TUNE.waveS);
    else if (st.phase === "clear") g = m.ga[1];
    else if (st.phase === "turn") g = st.T.by || st.T.auto ? HEAD_DOWN_GA : m.ga[0] + 6.9 * clamp01((st.t - st.T.t0) / TUNE.turn.maxS);
    else if (st.phase === "rest") g = m.ga[0] + (m.ga[1] - m.ga[0]) * clamp01((st.t - st.rest.t0) / TUNE.rest.s);
    else if (st.phase === "outro") g = meta.ga.end;
    if (st.phase !== "ko") st.gaDay = Math.max(st.gaDay, Math.min(meta.ga.end, g));
    note(st, FACTS, TEXT);                                  // what was said, for a knock-out's rest (core/lib/rest.js)
    if (st.phase === "ko") {
      if (st.koEnd === null) st.koEnd = readBy(st, st.koAt + TUNE.koS);
      if (st.t >= st.koEnd - EPS || st.t >= meta.capS - EPS) finish(st, "ko");
      return;
    }
    if (!st.done && st.t >= meta.capS - EPS) finish(st, "cap");
  } catch (e) {
    // never throw (16.4): count it, keep time moving, and end at the cap as usual
    st.faults = (st.faults || 0) + 1;
    if (!(st.t >= t1)) st.t = t1;
    if (st.t >= meta.capS - EPS && !st.done) { st.done = true; st.how = "cap"; emit(st, "done", {}); }
  }
}

// ---- the picture

// The scale bar's round length: the largest of 0.1 mm, 1 mm, 1 cm, 10 cm and 1 m within 30% of the short axis.
function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

// Your figure's length head to bottom (u): small in the waves (room to play), then filling the snug womb.
function sizeOf(st) {
  const V = TUNE.view;
  const base = V.sizeU[0] + (V.sizeU[1] - V.sizeU[0]) * clamp01((st.gaDay - 196) / 49);
  if (!st.T) return base;
  return base + (V.snugU - base) * smooth((st.t - st.T.t0) / TUNE.turn.growS);
}

// The pose: a kick while you kick, a startle when you are hit, the thumb in the rest, else the curl.
function poseOf(st) {
  const p = st.A.p;
  if (st.phase === "rest" || st.phase === "outro" || (st.done && st.how === "end")) return { name: "thumb", p: smooth((st.t - (st.rest.t0 ?? st.t)) / 0.8) };
  if (st.T) return "curl";
  if (p.dashT > 0) return { name: "kick", p: 1 };
  if (p.inv > 0 && p.inv > p.invS - 0.35 && !st.offer) return { name: "startle", p: smooth((p.invS - p.inv) / 0.15) };
  return "curl";
}

export function view(st) {
  const V = TUNE.view, A = st.A, p = A.p, t = st.t;
  const d = emptyDraw(meta.id);
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: V.camY, span: V.span, rot: 0, orient: meta.orient, mmPerU: mm / V.span };
  d.scale = { mm: bar(mm) };
  const warm = st.rest.warm;
  const calm = st.phase === "rest" || st.phase === "outro" || st.done;
  d.light = { level: clamp01(V.light.level + 0.05 * warm), warm: clamp01(V.light.warm + (calm ? 0.12 : 0) + 0.1 * warm),
    exposure: 1, white: 0, vignette: clamp01(V.light.vignette + V.light.snugK * smooth((TUNE.arena.r0 - A.arena.r) / (TUNE.arena.r0 - TUNE.arena.r1)) + (calm ? 0.08 : 0)), tint: 0.03 };
  d.warp = V.warp;
  d.caustics = 1;

  // the placenta disc on the wall (it comes in as the womb gets snug), its lobes toward you
  const R = A.arena.r, da = st.disc.ang;
  const disc = discXY(st);
  d.splats.push({ k: "c", x: disc.x, y: disc.y, r: disc.r, x2: disc.x, y2: disc.y, m: 0.8, n: 0, v: 0.35, hue: 0.0 });
  for (const l of st.disc.lobes) {
    const a = da + l.a, x = disc.x + Math.cos(a) * l.d, y = disc.y + Math.sin(a) * l.d;
    d.splats.push({ k: "c", x, y, r: l.r, x2: x, y2: y, m: 0.7, n: 0, v: 0.3, hue: 0.01 });
  }

  // you: the figure, leaning a little into your move; turned by the turn
  const S = sizeOf(st);
  const rot = st.T ? st.T.ang : -0.3 * p.mx;
  const fig = figure(poseOf(st), S, st.gaDay, { x: p.x, y: p.y, rot });
  const youPulse = Math.max(0, 1 - st.beats.phase("you", t) / 0.35) ** 2;
  for (const s of fig) if (s.v === 1) s.r *= 1 + 0.25 * youPulse;
  d.splats.push(...fig);
  const root = fig[fig.length - 1];

  // the cord: from the disc to your cord root; her antibodies ride it to you as beads
  const L = Math.max(1e-6, Math.hypot(root.x - disc.x, root.y - disc.y));
  const p0x = disc.x + ((root.x - disc.x) * disc.r * 0.6) / L, p0y = disc.y + ((root.y - disc.y) * disc.r * 0.6) / L;
  const mx = (p0x + root.x) / 2, my = (p0y + root.y) / 2, len = Math.max(1e-6, Math.hypot(root.x - p0x, root.y - p0y));
  const bow = 8 + 2 * Math.sin(0.7 * t);
  const cx = mx + (-(root.y - p0y) / len) * bow, cy = my + ((root.x - p0x) / len) * bow;
  const pts = [];
  for (let k = 0; k < 12; k++) {
    const u = k / 11, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    pts.push(a * p0x + b * cx + c * root.x, a * p0y + b * cy + c * root.y);
  }
  const flow = st.phase === "waves" ? 0.55 : 0.25;
  d.strips.push({ kind: "cord", pts, lights: [0, 1, 2, 3].map((k) => frac(k / 4 + flow * t)) });
  // her antibodies stream down the cord to you as small paper Ys (design.md 5.7), while the germs come
  const cordYs = [];
  if ((st.phase === "waves" || st.phase === "clear") && !A.ko) {
    for (let k = 0; k < 3; k++) {
      const u = frac(t / V.cordS + k / 3), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      const x = a * p0x + b * cx + c * root.x, y = a * p0y + b * cy + c * root.y;
      const tx = 2 * (1 - u) * (cx - p0x) + 2 * u * (root.x - cx), ty = 2 * (1 - u) * (cy - p0y) + 2 * u * (root.y - cy);
      cordYs.push({ x, y, ang: Math.atan2(ty, tx), r: 1.1 });
    }
  }

  // ripples: her beat's pulse, your kick, a clump closing and popping, a level, a gift taken
  const items = [];
  for (const e of st.fx) {
    const q = (t - e.t0) / e.dur;
    if (q < 0 || q >= 1) continue;
    if (e.kind === "beat") items.push({ x: p.x, y: p.y, r: Math.max(2, e.r * smooth(q * 1.4)), a: 0.75 * (1 - q), dashed: false });
    else if (e.kind === "kick") items.push({ x: p.x, y: p.y, r: Math.max(2, e.r * (0.4 + 0.6 * q)), a: 0.8 * (1 - q), dashed: true });
    else if (e.kind === "clump") items.push({ x: e.x, y: e.y, r: Math.max(2, e.r * (1 - 0.8 * q)), a: 0.4 + 0.5 * q, dashed: true });
    else if (e.kind === "pop") items.push({ x: e.x, y: e.y, r: Math.max(2, e.r * (0.5 + 0.8 * q)), a: 0.8 * (1 - q), dashed: false });
    else items.push({ x: e.x, y: e.y, r: Math.max(2, e.r * (1 + 2 * q)), a: 0.7 * (1 - q), dashed: false });
  }
  const gq = (t - st.grewAt) / 0.6;
  if (gq >= 0 && gq < 1) items.push({ x: p.x, y: p.y, r: 4 + 20 * gq, a: 0.8 * (1 - gq), dashed: false });
  if (st.phase === "rest" || st.phase === "outro") {
    // her voice hums your song: soft rings from the wall away from the disc
    const va = da + Math.PI * 0.8, vx = Math.cos(va) * (R - 6), vy = Math.sin(va) * (R - 6);
    const noteT = st.rest.t0 === null ? -1 : t - st.rest.t0 - TUNE.rest.noteLeadS;
    const k = noteT >= 0 ? Math.floor(noteT / TUNE.rest.noteGapS) : -1;
    for (let q = Math.max(0, k - 2); q <= k && q < 16; q++) {
      const age = noteT - q * TUNE.rest.noteGapS;
      if (age < 0 || age > 1.6) continue;
      const lit = (st.carry.song.lit >> q) & 1;
      items.push({ x: vx, y: vy, r: 3 + 12 * age, a: clamp01((lit ? 0.6 : 0.4) * (1 - age / 1.6)), dashed: false });
    }
    d.marks.push({ kind: "glow", x: vx, y: vy, r: 9, on: 0.6, pulse: 0.3 });
  }
  if (items.length) d.strips.push({ kind: "ripples", items: items.slice(-16) });
  rimSparks(d, st.carry.sparks, p.x, p.y, 0.5 * S, { t, span: V.span });

  // marks: the amber light through the wall, your soft light, the disc's glow on her beat
  const her = Math.max(0, 1 - st.beats.phase("mother", t) / 0.35) ** 2;
  d.marks.push({ kind: "glow", x: -30, y: 50, r: 46, on: 0.3, pulse: 0 });
  d.marks.push({ kind: "glow", x: p.x, y: p.y, r: 0.8 * S, on: A.ko ? 0 : 0.7, pulse: youPulse });
  d.marks.push({ kind: "glow", x: disc.x, y: disc.y, r: disc.r * 1.4, on: 0.45, pulse: her });

  // the action layer: the snug wall, germs, your antibodies (darts and the tag ring), sparkles, telegraphs, pops, hp
  const live = st.phase === "waves" || st.phase === "clear";
  const av = X.actionView(A, { player: live });
  const ring = [...(st.phase === "waves" && !A.ko ? ringSpots(st) : []), ...cordYs];
  if (ring.length) {
    const b = av.bullets, n = Math.min(b.n + ring.length, 640);
    const xy = new Float32Array(2 * n), r = new Float32Array(n), tone = new Uint8Array(n), ang = new Float32Array(n);
    xy.set(b.xy.subarray(0, 2 * b.n)); r.set(b.r.subarray(0, b.n)); tone.set(b.tone.subarray(0, b.n)); ang.set(b.ang.subarray(0, b.n));
    for (let i = b.n, k = 0; i < n; i++, k++) {
      xy[2 * i] = ring[k].x; xy[2 * i + 1] = ring[k].y; r[i] = ring[k].r || 1.6; tone[i] = 0; ang[i] = ring[k].ang;
    }
    av.bullets = { n, xy, r, tone, ang };
  }
  const words = [];
  for (const g of st.tags) {
    const q = (t - g.t0) / g.dur;
    if (q < 0 || q >= 1) continue;
    words.push({ x: g.x, y: g.y + 6 * q, v: 0, a: clamp01(1 - q), combo: 0, word: g.word });
  }
  const gifts = [];
  if (st.offer && st.phase === "waves") {
    const G = TUNE.gift, left = clamp01(1 - (t - st.pickT0) / G.pickS), mid = Math.min(1, st.offer.length - 1);
    st.offer.forEach((b, k) => {
      const a = clamp01((t - b.t0) / 0.25);
      const bob = Math.sin(t * 3 + k * 2) * 0.6;
      const icon = (TUNE.gifts.find((x) => x.id === b.id) || {}).icon || "star";
      gifts.push({ x: b.x, y: b.y + bob, r: G.bubbleR * (0.6 + 0.4 * a), icon, a, on: k === mid ? 1 - left : 0, lv: lvOf(st, b.id) });
      words.push({ x: b.x - G.bubbleR - 1, y: b.y + bob + G.bubbleR + 1, v: 0, a, combo: 0, word: "turn.gift." + b.id });
    });
  }
  // while the bubbles show, only their words (and Grow!): no number pops over the gift tags
  const nums = gifts.length ? [] : av.pops.slice(-Math.max(0, 12 - words.length));
  av.pops = [...nums, ...words.slice(-12)];
  d.action = { ...av, arena: { ...A.arena }, gifts, ys: true };

  // rings (DOM): her beat round the disc; in the rest, the warm ring you hold
  d.rings.push({ id: "mother", kind: "mother", x: disc.x, y: disc.y, r: disc.r + V.disc.ringR, progress: clamp01(st.beats.phase("mother", t)) });
  // the grow meter: a cream sweep round you that fills with the sparkles you gather (full at the next level), with a
  // dotted track under it
  if (st.phase === "waves" && !A.ko && !st.offer && st.level < TUNE.levels.length) {
    const gr = 0.5 * S + 3;
    d.rings.push({ id: "growTrack", kind: "burrow", x: p.x, y: p.y, r: gr, progress: 0.25 });
    d.rings.push({ id: "grow", kind: "burrow", dashed: true, x: p.x, y: p.y, r: gr, progress: growFill(st) });
  }
  let cue = { x: p.x, y: p.y };
  if (st.phase === "rest") {
    const rr = 0.55 * S + 4 * warm;
    d.rings.push({ id: "rest", kind: "rest", x: p.x, y: p.y, r: rr, progress: clamp01(warm) });
    if (st.held && !st.wentOn) d.rings.push({ id: "held", kind: "hold", x: p.x, y: p.y, r: Math.max(1, rr - 3), progress: clamp01(warm) });
    cue = { x: p.x + rr, y: p.y };
  } else if (st.phase === "turn" && st.T && !st.T.by && !st.T.auto) {
    d.marks.push({ kind: "spot", x: p.x, y: p.y - 0.62 * S, r: 5, on: 0.6 + 0.4 * smooth(st.T.held / TUNE.turn.holdS), pulse: her });
    const a0 = Math.PI / 2, a1 = Math.PI / 2 + st.T.ang;
    d.strips.push({ kind: "arc", x: p.x, y: p.y, r: 0.62 * S, a0: Math.min(a0, a1), a1: Math.max(a0, a1) + 1e-3, w: 2.5, glow: smooth(st.T.held / TUNE.turn.holdS) });
    cue = { x: p.x, y: p.y - 0.62 * S };
  }
  d.anchor = { x: p.x, y: p.y };
  d.cue = cue;
  return d;
}

export function prompt(st) {
  if (!st || st.done || !st.prompt) return { ...NONE };
  return { ...st.prompt };
}

export function targets() {
  return [];
}

// The gift the bot takes: the first in its preference (the middle one below skill 0.5).
function pickFor(st, skill) {
  if (!st.offer) return 1;
  const mid = Math.min(1, st.offer.length - 1);
  if (skill < 0.5) return mid;
  for (const id of TUNE.prefer) { const k = st.offer.findIndex((b) => b.id === id); if (k >= 0) return k; }
  return mid;
}

// The action bot (core/lib/actionbot.js) at this skill: dodge and keep range while it kites round the womb at 60% of
// its radius (sweeping up sparkles when it is calm; the path flattened top to bottom, with a soft floor, so it keeps
// to the middle band of a portrait screen), kick with 3 or more germs within 14 u, swim into its gift, drag down at
// the turn, and hold its thumb down in the rest.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done || !st.A) return zero;
  const s = clamp01(skill), A = st.A, p = A.p, B = TUNE.bot;
  if (st.phase === "rest") return { ...zero, hold: s > 0 && !st.wentOn };
  if (st.phase === "turn") return st.T && !st.T.by && !st.T.auto && s > 0 ? { ...zero, steer: { x: 0, y: -0.99 } } : zero;
  if (A.ko || st.phase !== "waves") return zero;
  if (st.offer) {
    const g = st.offer[pickFor(st, s)];
    // the goal's lag runs on the world clock, which crawls while the bubbles show: the gift gets its own memory (in
    // r.mem, fresh for each offer), so the bot heads for its bubble at once rather than for its old kite point
    let rg = r;
    if (typeof r === "function") {
      if (!r.mem || typeof r.mem !== "object") r.mem = {};
      if (r.mem.giftAt !== st.pickT0) { r.mem.giftAt = st.pickT0; r.mem.gift = {}; }
      rg = () => r();
      rg.mem = r.mem.gift;
    }
    const a = goalSteer(A, actionSteer(A, s, r, { keep: false, picks: false }), g, s, rg, { weight: B.giftWeight, slowR: 2 });
    return { steer: a.steer, dir: null, hold: false, dash: false };
  }
  // the kite path is flattened top to bottom, so the bot keeps to the middle band of a portrait screen (clear of the
  // HUD above and the thumb and the caption band below)
  const th = Math.atan2(p.y / B.flatK, p.x) + B.lead, kr = B.kiteK * A.arena.r;
  const goal = { x: Math.cos(th) * kr, y: Math.sin(th) * kr * B.flatK };
  const a = goalSteer(A, actionSteer(A, s, r), goal, s, r, { weight: B.weight });
  // ... and it keeps off the bottom of the womb, a soft floor at 45% of the radius below the middle
  const fy = -B.floorK * A.arena.r;
  if (p.y < fy + 6) {
    const sx = a.steer.x, sy = a.steer.y + B.floorW * Math.min(1, (fy + 6 - p.y) / 6), m = Math.hypot(sx, sy);
    a.steer = m > 0.99 ? { x: (sx * 0.99) / m, y: (sy * 0.99) / m } : { x: sx, y: sy };
  }
  let near = 0;
  for (const f of A.foes) if (f.in <= 0 && Math.hypot(f.x - p.x, f.y - p.y) < TUNE.kick.r + f.r) near++;
  const kickNow = near >= B.kickN && p.dashCd <= 0;
  const dash = a.dash || (kickNow && (s >= 1 || typeof r !== "function" || r() < s));
  return { steer: a.steer, dir: null, hold: false, dash };
}

export function probe() {
  return null;
}

// The score's mood (openspec/changes/first-breath-score/contract.md, "Mood"), by the swarm's size in the waves: 0
// under 8 germs, 1 from 8, 2 from 20; the Big Germ is 2 and the boss while it lives; the clear is 1; the turn, the
// rest (your song is hummed), the outro and a knock-out are 0. These thresholds (8 and 20 germs) stay here as
// literals on purpose: they set only the music, so they sit beside the state they read and not in turn.tune.js
// (first-breath-score design 4). Pure and cheap (main.js reads it every 100 ms); it changes nothing.
export function mood(st) {
  const A = st && st.A;
  if (!A || st.done || st.phase === "ko" || A.ko) return { level: 0 };
  if (st.phase === "clear") return { level: 1 };
  if (st.phase !== "waves") return { level: 0 };
  if (st.big && !st.bigPopped) return { level: 2, boss: true };
  const n = A.foes.length;
  return { level: n >= 20 ? 2 : n >= 8 ? 1 : 0 };
}

export function result(st) {
  const A = st.A, P = st.parts;
  const goalMet = !!st.done && !!st.goalMet;
  const skill = P.popped + P.levels + P.pips + P.turn;
  const score = clampScore({ goal: goalMet ? TUNE.score.goal : 0, skill, flourish: P.flourish });
  return {
    done: !!st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "popped", label: "turn.part.popped", value: P.popped, max: TUNE.score.popped },
      { id: "levels", label: "turn.part.levels", value: P.levels, max: TUNE.score.levels },
      { id: "pips", label: "turn.part.pips", value: P.pips, max: TUNE.score.pips },
      { id: "turn", label: "turn.part.turn", value: P.turn, max: TUNE.score.turn },
      { id: "flourish", label: "turn.part.big", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      popped: st.popped, came: A.spawned, plan: st.plan, levels: st.level, sparkles: st.sparkles, gifts: { ...st.gifts },
      taken: st.taken.map((x) => ({ ...x })), hits: A.hits, hp: A.p.hp, hpMax: A.p.hpMax, kicks: st.kicks, clumps: st.clumps,
      pulses: st.pulses, bigPopped: st.bigPopped, bigAt: st.bigAt, turnedBy: st.T ? st.T.by : null, moment: st.moment,
      how: st.how, gaDay: st.gaDay, ko: A.ko, koAt: st.koAt, almost: A.ko ? "almost.ko" : null, wentOn: st.wentOn,
      shieldHits: A.shieldHits || 0, faults: st.faults,
    },
    carryOut: {},
  };
}

// Fair resume (5.2): 1.2 s of i-frames after Resume, so a pause never ends in a hit.
export function resume(st) {
  if (!st || st.done || !st.A) return 0;
  st.A.p.inv = Math.max(st.A.p.inv, 1.2);
  return 0;
}

// Skip to a moment, starting now: forward only (an earlier moment returns false). After a knock-out, Go on (core/run.js
// calls jump with meta.goOn, "turn") plays the turn by itself, the rest and the outro with input ignored.
export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (!st || typeof st !== "object" || !st.A || i < 0 || i < st.mi) return false;
  const A = st.A;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  st.offer = null;
  st.levelsDue = 0;
  st.sweep = [];
  if (st.done && A.ko) st.wentOn = true;
  st.done = false;
  st.how = null;
  if (!st.poppedFinal && !A.ko) { st.parts.popped += points(st, "skill", poppedPart(st) - st.parts.popped); st.poppedFinal = true; }
  if (i === 0) {
    if (st.phase !== "waves") return false;
    return true;
  }
  if (i === 1) { startTurn(st, st.wentOn); return true; }
  if (!st.T) startTurn(st, true);
  if (!st.T.by) { st.T.ang = Math.PI; if (!st.T.auto) startAuto(st); headDown(st, "auto"); }
  if (i === 2) { startRest(st); return true; }
  startOutro(st);
  return true;
}

export const TOTALS = Object.freeze({ plan: planCount(planRows(1), 1) });
