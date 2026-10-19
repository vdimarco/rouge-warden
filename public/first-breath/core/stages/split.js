// First Breath: stage 3, The Embryo: first cells (`split`): "Split." A roguelike on the shared action layer
// (core/lib/action.js; openspec/changes/first-breath-action-genres/design.md 5.3 and contract.md). You are a ball of
// new cells in its clear shell, carried down the tube. Each day (Days 1 to 4) is one room of germs: your cells fire by
// themselves at the nearest germ, you drag anywhere (or WASD / the arrows) to move, and a second tap (or Space)
// dashes, with a moment of i-frames. Clear the room and its exit opens ("Clear!"); at the room timer the germs left
// drift off and the tube carries you on. Then you split (2, 4, 8, then 16 cells: each split adds a shot to a volley;
// after Day 4 the cells pack tight) while the tube carries you to the next room, and three gift bubbles appear round
// you: swim into one to take it (after 3 s the middle one picks itself). Gifts stack into a build. Day 5 is the Knot,
// a big clump at the tube's end, in three phases, while the hollow fills inside your ball; on Day 6 you hatch. At 0 hp
// your cells rest: never a game over; the run's Almost card offers Try again or Go on, and Go on plays the splits
// left and the hatch by themselves. Pure: no DOM, no clocks, no storage, no Math.random.
//
// Contract choices:
// - Moments: day1 to day4 (gaDay 15 to 19: a day's room runs its first 0.6 of a day, the split the rest; the pick is
//   the next day's start, so its caption fact is on its day), bloom (the Knot, 19 to 20), hatch and outro (20).
// - Rooms are boxes in the world (x ±48 u, 40 u back and 60 u forward of the room's subject point), one every 140 u
//   down the tube; the camera holds a room still and glides to the next during the split. The layer has a round
//   arena or none, so this stage has none and keeps you, the germs and the shots in the box itself after each step
//   (a shot past a wall is spent, or bounces with the Bounce gift: a spark of yours keeps its bounces left in the
//   bullet pool's `wf`, which only a foe's wave pattern uses).
// - Timers run on the world clock (A.t, which holds still under a hit-stop); the pick's 3 s and the cap on the
//   stage clock.
// - The score (design.md 5.3): Goal 3,000; Skill 3,000 × germs popped / germs that came (the Knot counts as 10; the
//   share's floor is the whole schedule, so a knock-out keeps only what it popped), ticked at each pop (the pop
//   shows those points, the rest at the end); 300 a room cleared before its timer (the Knot's room too), at the clear;
//   1,500 × pips left at the hatch / 4, at the hatch; Flourish 1,000 when the Knot pops within 12 s.
// - Chasers walk, wobble with a line tell, then lunge along it (the stage sets their speed and turns them "still"
//   for the lunge, so it commits). Splitters pop into two small chasers. Puffers fire sticky spores that slow down
//   and linger.
// - Gift bubbles are an action item (core/draw.js action.gifts, drawn by render/action.js) with their one-word tags
//   as DOM pops (a pop with a word).
import { DT, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { stream } from "../rng.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw } from "../draw.js";
import { subgoal, doneBy } from "../lib/goals.js";
import { rimSparks } from "../lib/sparks.js";
import * as X from "../lib/action.js";
import { noteCaptions as note, readBy } from "../lib/rest.js";
import { actionSteer, goalSteer } from "../lib/actionbot.js";
import { TUNE } from "./split.tune.js";
import { FACTS } from "./split.facts.js";
import { TEXT } from "./split.text.js";

const TAU = Math.PI * 2;
const EPS = 1e-9;
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const lerp = (a, b, q) => a + (b - a) * q;
const KN = TUNE.knot, G = TUNE.gift, R = TUNE.room;

// ---- the moments
const DAY_S = TUNE.roomS + TUNE.clearS + TUNE.splitS + TUNE.pickS;
const mo = (id, from, to, lenS) => Object.freeze({ id, ga: Object.freeze([from, to]), lenS });
const MOMENTS = [
  mo("day1", 15, 16, DAY_S), mo("day2", 16, 17, DAY_S), mo("day3", 17, 18, DAY_S), mo("day4", 18, 19, DAY_S),
  mo("bloom", 19, 20, KN.leaveS), mo("hatch", 20, 20, TUNE.hatchS), mo("outro", 20, 20, TUNE.outroS),
];
const IDS = MOMENTS.map((m) => m.id);
const BLOOM = 4, HATCH = 5, OUTRO = 6;
const NOMINAL_S = MOMENTS.reduce((a, m) => a + m.lenS, 0);

export const meta = Object.freeze({
  id: "split", index: 2, name: "The Embryo: first cells", verb: "Split",
  orient: "long",
  families: Object.freeze(["steer", "tap"]),
  ga: Object.freeze({ start: 15, end: 20 }), fertilized: true,
  mm: Object.freeze({ start: 0.45, end: 0.45 }),
  action: true, goOn: "hatch",
  motherBpm: TUNE.motherBpm,
  parS: Math.round(NOMINAL_S), capS: TUNE.capS, canFail: true, scored: true,
  moments: Object.freeze(MOMENTS),
});

const END_S = meta.capS + 30;
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const P_MOVE = Object.freeze({ gesture: "move", text: "split.prompt.move", keys: "steer" });
const P_GIFT = Object.freeze({ gesture: "move", text: "split.prompt.gift", keys: "steer" });
const P_KNOT = Object.freeze({ gesture: "move", text: "split.prompt.knot", keys: "steer" });
const P_FREE = Object.freeze({ gesture: "move", text: null, keys: "steer" });
const P_SPLIT = Object.freeze({ gesture: "none", text: "split.prompt.split", keys: "steer" });
const P_PACK = Object.freeze({ gesture: "none", text: "split.prompt.pack", keys: "steer" });
const P_CARRIED = Object.freeze({ gesture: "none", text: "split.prompt.carried", keys: "steer" });
const P_HATCH = Object.freeze({ gesture: "none", text: "split.prompt.hatch", keys: "steer" });
const P_OUTRO = Object.freeze({ gesture: "none", text: "split.prompt.outro", keys: "steer" });
// the phases where you steer (the others are input none)
const LIVE = new Set(["room", "clear", "pick", "knot", "win"]);

// the caption facts at the picks after Days 1, 2 and 3 (the Day 2, 3 and 4 picks); split.inner as the Knot's room
// starts; split.frame is a "What was real" fact on the result
const PICK_FACT = Object.freeze(["split.small", "split.carried", "split.morula"]);

// The whole schedule's germs (Assist counts), and an upper bound with every splitter's kids and the Knot's adds: the
// popped share's floor, and the per-pop tick that never passes it.
function counts(assistK) {
  let rooms = 0, kids = 0;
  for (const rows of TUNE.rooms) for (const [, foe, n0] of rows) {
    const n = Math.ceil(n0 * assistK);
    rooms += n;
    if (TUNE.foes[foe].kids) kids += n * TUNE.foes[foe].kids;
  }
  const adds = KN.p1.adds * (Math.floor(KN.leaveS / KN.p1.addEvery) + 1);
  return { expect: rooms + KN.countAs, ub: rooms + kids + adds + KN.countAs };
}

// ---- small helpers

function caption(st, id) {
  emit(st, "fact", { id, where: "caption" });
  emit(st, "caption", { id, dir: null });
}

function setPrompt(st, p) {
  if (st.prompt === p) return;
  st.prompt = p;
  emit(st, "prompt", { ...p });
}

function sfx(st, id, x, y, pitch) {
  emit(st, "sfx", pitch === undefined ? { id, x, y } : { id, x, y, pitch });
}

// a word pop (a DOM tag) at (x, y) for dur seconds: "Clear! +300", a gift's name
function tag(st, x, y, word, v = 0, dur = 1.0) {
  st.tags.push({ x, y, word, v, t0: st.t, dur });
  if (st.tags.length > 6) st.tags.shift();
}

const roomBox = (st) => ({ x0: R.x0, x1: R.x1, y0: st.roomY + R.y0, y1: st.roomY + R.y1 });
const knotOf = (st) => (st.knot ? st.A.foes.find((f) => f.id === st.knot.id) || null : null);

// ---- the score

const popPart = (st) => Math.round(TUNE.score.popped * Math.min(1, st.popped / Math.max(1, st.came, st.expect)));
const roomsPart = (st) => Math.round((TUNE.score.rooms * Math.min(st.roomsClear, TUNE.score.roomsN)) / TUNE.score.roomsN);

function points(st, part, add) {
  if (add > 0) emit(st, "points", { part, add });
}

// A germ popped (the Knot counts as countAs): the tick to the HUD and its pop.
function popped(st, x, y, n, combo) {
  st.popped += n;
  const add = st.per * n;
  st.ticked += add;
  points(st, "skill", add);
  X.pop(st.A, x, y, add, combo);
}

// ---- the cells' layouts (built once from the seed: the first cleavage axis is seeded)

function relax(cells, r, Rr) {
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const want = 1.55 * r;
        if (d >= want) continue;
        if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
        const push = (want - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
    const lim = Rr - 0.85 * r;
    for (const c of cells) {
      const d = Math.hypot(c.x, c.y);
      if (d > lim) { c.x *= lim / d; c.y *= lim / d; }
    }
  }
  return cells;
}

function layouts(seed) {
  const r0 = stream(seed, "cleave");
  const axis0 = r0() * Math.PI;
  const Rr = TUNE.cellsR, k0 = Rr / 13.2;
  const L = [[{ x: 0, y: 0, r: TUNE.cellR[0] }]];
  for (let k = 1; k <= 4; k++) {
    const r = TUNE.cellR[k];
    const out = [];
    L[k - 1].forEach((p, i) => {
      const a = axis0 + k * (Math.PI / 2) + i * 0.7 + (r0() - 0.5) * 0.3;
      const s = r * 0.8;
      out.push({ x: p.x + Math.cos(a) * s, y: p.y + Math.sin(a) * s, r });
      out.push({ x: p.x - Math.cos(a) * s, y: p.y - Math.sin(a) * s, r });
    });
    L.push(relax(out, r, Rr));
  }
  // the blastocyst: an outer ring of 11 cells round the hollow, and 5 inner cells at the back (world −y)
  const morula = L[4];
  const order = morula.map((c, i) => ({ i, d: Math.hypot(c.x, c.y), a: Math.atan2(c.y, c.x) })).sort((p, q) => q.d - p.d || p.i - q.i);
  const outer = order.slice(0, 11).sort((p, q) => p.a - q.a), inner = order.slice(11).sort((p, q) => p.a - q.a);
  const ring = [];
  for (let k = 0; k < 11; k++) { const a = -Math.PI + (TAU * (k + 0.5)) / 11; ring.push({ x: 10.6 * k0 * Math.cos(a), y: 10.6 * k0 * Math.sin(a), r: 3.3 * k0 }); }
  const icm = [[0, -5.6], [-3.1, -6.6], [3.1, -6.6], [-1.7, -3.2], [1.7, -3.2]].map(([x, y]) => ({ x: x * k0, y: y * k0, r: 3.1 * k0, a: Math.atan2(y, x) }));
  icm.sort((p, q) => p.a - q.a);
  const assign = (cells, slots) => {
    let best = 0, bestCost = Infinity;
    for (let s = 0; s < slots.length; s++) {
      let cost = 0;
      cells.forEach((c, j) => { const sl = slots[(j + s) % slots.length], m = morula[c.i]; cost += Math.hypot(sl.x - m.x, sl.y - m.y); });
      if (cost < bestCost - 1e-9) { bestCost = cost; best = s; }
    }
    return cells.map((c, j) => ({ i: c.i, slot: slots[(j + best) % slots.length] }));
  };
  const blast = new Array(morula.length);
  for (const { i, slot } of [...assign(outer, ring), ...assign(inner, icm)]) blast[i] = { x: slot.x, y: slot.y, r: slot.r };
  return { L, blast };
}

// ---- the moments' starts

function enterMoment(st, i) {
  st.mi = i;
  st.moment = IDS[i];
  st.gaDay = Math.max(st.gaDay, MOMENTS[i].ga[0]);
  emit(st, "moment", { id: st.moment });
}

// What a day's room spawns: [{ at, foe, n }] (Assist: fewer).
function roomRows(st, i) {
  return TUNE.rooms[i].map(([at, foe, n0]) => ({ at, foe, n: Math.ceil(n0 * st.assistK) }));
}

function startRoom(st, i) {
  const A = st.A;
  enterMoment(st, i);
  st.phase = "room";
  st.day = i;
  st.roomY = i * TUNE.roomL;
  st.camY = st.roomY;
  st.roomT0 = A.t;
  st.spawnAdv = 0;
  st.rows = roomRows(st, i);
  st.ri = 0;
  st.exitOpen = 0;
  st.exitT0 = null;
  st.doorT0 = A.t;
  setPrompt(st, P_MOVE);
  if (i === 0) subgoal(st, "rooms", "split.sub.rooms");
}

// A spawn point in the room, at least spawnMin from you (puffers by a side wall or the far wall).
function spawnPoint(st, spec) {
  const A = st.A, p = A.p, r = st.rRoom, b = roomBox(st);
  let best = null, bd = -1;
  for (let k = 0; k < 24; k++) {
    let x, y;
    if (spec.wall) {
      const u = r();
      if (u < 0.7) { x = (u < 0.35 ? -1 : 1) * (b.x1 - 7); y = lerp(st.roomY - 6, b.y1 - 8, r()); }
      else { x = lerp(b.x0 + 12, b.x1 - 12, r()); y = b.y1 - 7; }
    } else { x = lerp(b.x0 + 8, b.x1 - 8, r()); y = lerp(st.roomY - 18, b.y1 - 8, r()); }
    const d = Math.hypot(x - p.x, y - p.y);
    if (d >= TUNE.spawnMin) return { x, y };
    if (d > bd) { bd = d; best = { x, y }; }
  }
  return best;
}

function spawnGerm(st, key, at = null) {
  const A = st.A, spec = TUNE.foes[key];
  const q = at || spawnPoint(st, spec);
  const f = X.spawnFoe(A, { ...spec, x: q.x, y: q.y, anywhere: true });
  if (!f) return null;
  f.key = key;
  f.base = spec.speed;
  f.lunge = !!spec.lunge;
  f.home = spec.home || 0;
  f.lt0 = A.t + f.in + A.rnd() * 0.6;            // its lunge cycle starts after its spawn tell
  f.lp = 0;
  st.came += 1;
  return f;
}

function spawnRows(st) {
  const A = st.A;
  // waves on time, or sooner when the room is clear before the next one
  if (A.foes.length === 0 && st.ri < st.rows.length) {
    const tIn = A.t - st.roomT0 + st.spawnAdv, ahead = st.rows[st.ri].at - tIn;
    if (ahead > 0.4) st.spawnAdv += ahead - 0.4;
  }
  const tIn = A.t - st.roomT0 + st.spawnAdv;
  while (st.ri < st.rows.length && st.rows[st.ri].at <= tIn + EPS) {
    const row = st.rows[st.ri++];
    for (let k = 0; k < row.n; k++) spawnGerm(st, row.foe);
  }
}

// The room ends: cleared (the exit opens, "Clear!" and 300 points) or at its timer (what is left drifts off).
function endRoom(st, cleared) {
  const A = st.A, p = A.p;
  st.phase = "clear";
  st.c0 = A.t;
  st.exitT0 = A.t;
  st.carried = !cleared;
  if (cleared) {
    st.roomsClear++;
    const add = TUNE.score.rooms / TUNE.score.roomsN;
    points(st, "skill", add);
    tag(st, p.x - 7, p.y + 7, "split.pop.clear", add, 1.1);
    sfx(st, "sparkle", p.x, p.y, 1);
    A.juice.shake = Math.min(1, A.juice.shake + 0.25);
  } else {
    for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r * 0.7, 2); X.removeFoe(A, f.id); }
  }
  st.rows = [];
  X.clearBullets(A, 2);
  A.tells.length = 0;
  X.vacuum(A, TUNE.clearS + TUNE.splitS);
}

// The split (Days 1 to 3: the cells pinch in two; Day 4: they pack tight), while the tube carries you on to the
// next room. Input none.
function startSplit(st) {
  const A = st.A, p = A.p;
  st.phase = "split";
  st.s0 = A.t;
  st.from = { x: p.x, y: p.y };
  const next = (st.day + 1) * TUNE.roomL;
  st.to = { x: TUNE.pickTo.x, y: next + TUNE.pickTo.y };
  st.cam0 = st.camY;
  st.cam1 = next;
  st.pinch = st.day < 3;
  p.vx = 0; p.vy = 0;
  p.inv = Math.max(p.inv, TUNE.splitS + 0.3);
  setPrompt(st, st.carried ? P_CARRIED : st.pinch ? P_SPLIT : P_PACK);
  sfx(st, "pling", p.x, p.y, st.day + 1);
}

function splitStep(st) {
  const A = st.A, p = A.p, u = smooth((A.t - st.s0) / TUNE.splitS);
  p.x = lerp(st.from.x, st.to.x, u); p.y = lerp(st.from.y, st.to.y, u);
  p.vx = 0; p.vy = 0;
  st.camY = lerp(st.cam0, st.cam1, u);
  const m = MOMENTS[st.mi];
  st.gaDay = Math.max(st.gaDay, m.ga[0] + 0.7 + 0.3 * clamp01((A.t - st.s0) / TUNE.splitS));
  if (A.t - st.s0 >= TUNE.splitS - EPS) {
    if (st.pinch) {
      st.splits = Math.min(3, st.splits + 1);
      st.splitFx.push(st.t);
    }
    st.roomY = st.cam1;
    st.camY = st.cam1;
    st.gaDay = Math.max(st.gaDay, m.ga[1]);
    startPick(st);
  }
}

// ---- gifts

// Three distinct gifts, none at its top level, seeded (stream "gifts").
function offerOf(st) {
  const ids = TUNE.gifts.filter((g) => (st.gifts[g.id] || 0) < g.max).map((g) => g.id);
  const r = st.rGift;
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
  return ids.slice(0, 3);
}

function startPick(st) {
  const A = st.A, p = A.p;
  st.phase = "pick";
  st.pickT0 = st.t;
  st.offer = offerOf(st).map((id, k) => ({ id, x: p.x + Math.cos(G.angs[k]) * G.bubbleD, y: p.y + Math.sin(G.angs[k]) * G.bubbleD, t0: st.t }));
  setPrompt(st, P_GIFT);
  if (st.picks === 0) subgoal(st, "gift", "split.sub.gift");
  if (PICK_FACT[st.day]) caption(st, PICK_FACT[st.day]);
}

function applyGift(st, id) {
  const A = st.A;
  const lv = (st.gifts[id] = (st.gifts[id] || 0) + 1);
  if (id === "shell") { A.p.hpMax += 1; X.heal(A, 1); }
  else if (id === "dash") {
    A.dash.s = st.dash0.s * (1 + G.dashFar * lv);
    A.dash.cdS = Math.max(0.2, st.dash0.cdS - G.dashCd * lv);
  } else if (id === "magnet") A.pick.magnet = G.magnet[Math.min(lv, G.magnet.length - 1)];
  fireOf(st);
}

function take(st, k, how) {
  const A = st.A, b = st.offer[k];
  applyGift(st, b.id);
  st.picks++;
  st.taken.push({ id: b.id, how, day: st.day });
  X.burst(A, b.x, b.y, G.bubbleR * 1.2, 2);
  st.ringFx.push({ x: b.x, y: b.y, t: st.t });
  tag(st, b.x - G.bubbleR - 1, b.y + G.bubbleR + 1, "split.gift." + b.id, 0, 1.2);
  sfx(st, "act.up", b.x, b.y);
  if (st.picks === 1) doneBy(st, "gift", how, how === "you" ? "split.sub.giftDone" : "split.sub.giftAuto");
  else if (how !== "you") { subgoal(st, "gift" + st.picks, "split.sub.gift"); doneBy(st, "gift" + st.picks, "auto", "split.sub.giftAuto"); }
  st.offer = null;
  if (st.day < 3) startRoom(st, st.day + 1);
  else startKnot(st);
}

function pickStep(st) {
  const p = st.A.p;
  for (let k = 0; k < st.offer.length; k++) {
    const b = st.offer[k];
    if (Math.hypot(b.x - p.x, b.y - p.y) < p.body + G.bubbleR) { take(st, k, "you"); return; }
  }
  if (st.t - st.pickT0 >= TUNE.pickS - EPS) take(st, 1, "auto");
}

// Your shots this step: shots by cells, Spread, Quick.
function fireOf(st) {
  const A = st.A;
  if (!A.fire) return;
  A.fire.spread = TUNE.shots[Math.min(3, st.splits)] + G.spread * (st.gifts.spread || 0);
  A.fire.rate = TUNE.fire.rate * (1 + G.quick * (st.gifts.quick || 0));
}

// ---- the room's box, lunges, Sticky, Orbit, Bounce

// Speeds for the next step (after this one, so a lunge's tell is in this step's outcomes): chasers walk, wobble (a
// line tell) and lunge along it; Sticky slows a germ a while.
function drive(st) {
  const A = st.A, L = TUNE.lunge, cyc = L.walkS + L.wobS + L.goS, p = A.p;
  for (const f of A.foes) {
    if (f.in > 0 || f.boss) continue;
    const slow = f.slowT > A.t ? G.stickyK : 1;
    if (!f.lunge) {
      f.speed = f.base * slow;
      if (f.home) {                                          // a drifter's wander leans toward you
        const want = Math.atan2(p.y - f.y, p.x - f.x), dw = Math.atan2(Math.sin(want - f.wob), Math.cos(want - f.wob));
        f.wob += Math.max(-1, Math.min(1, dw)) * f.home * DT;
      }
      continue;
    }
    const u = A.t - f.lt0;
    if (u < 0) continue;
    const ph = u % cyc;
    let lp = ph < L.walkS ? 0 : ph < L.walkS + L.wobS ? 1 : 2;
    if (lp === 1 && f.lp === 0 && Math.hypot(p.x - f.x, p.y - f.y) > L.range) { f.lt0 += DT; lp = 0; }   // it lunges only when near
    if (lp !== f.lp) {
      f.lp = lp;
      if (lp === 1) {
        f.aimA = Math.atan2(p.y - f.y, p.x - f.x);
        X.addTell(A, { kind: "line", x: f.x, y: f.y, ang: f.aimA, len: 16 + f.r, w: f.r * 0.8, dur: L.wobS, foe: f.id });
      } else if (lp === 2) {
        f.ai = "still";
        f.vx = Math.cos(f.aimA) * L.go * slow; f.vy = Math.sin(f.aimA) * L.go * slow;
      } else f.ai = "chase";
    }
    if (lp === 0) { f.speed = L.walk * slow; f.steer = 4; }
    else if (lp === 1) { f.speed = 1; f.steer = 6; }
  }
}

// After the step: you, the germs and the shots stay in the room's box.
function box(st) {
  const A = st.A, b = roomBox(st), p = A.p;
  if (LIVE.has(st.phase)) {
    const pad = p.body * 0.8;
    if (p.x < b.x0 + pad) { p.x = b.x0 + pad; if (p.vx < 0) p.vx = 0; }
    if (p.x > b.x1 - pad) { p.x = b.x1 - pad; if (p.vx > 0) p.vx = 0; }
    if (p.y < b.y0 + pad) { p.y = b.y0 + pad; if (p.vy < 0) p.vy = 0; }
    if (p.y > b.y1 - pad) { p.y = b.y1 - pad; if (p.vy > 0) p.vy = 0; }
  }
  for (const f of A.foes) {
    const pad = f.r * 0.6;
    let hit = false;
    if (f.x < b.x0 + pad) { f.x = b.x0 + pad; if (f.vx < 0) f.vx = -f.vx; hit = true; }
    if (f.x > b.x1 - pad) { f.x = b.x1 - pad; if (f.vx > 0) f.vx = -f.vx; hit = true; }
    if (f.y < b.y0 + pad) { f.y = b.y0 + pad; if (f.vy < 0) f.vy = -f.vy; hit = true; }
    if (f.y > b.y1 - pad) { f.y = b.y1 - pad; if (f.vy > 0) f.vy = -f.vy; hit = true; }
    if (hit && f.ai === "wander") f.wob += Math.PI;
  }
  const B = A.b, bounce = st.gifts.bounce || 0;
  for (let i = 0; i < B.n; i++) {
    if (B.age[i] >= B.life[i]) continue;
    const mine = B.side[i] === 1;
    if (mine && B.wf[i] === 0) B.wf[i] = 1 + bounce;          // a new spark of yours: its bounces left, plus 1
    const x = B.x[i], y = B.y[i];
    const outX = x < b.x0 ? -1 : x > b.x1 ? 1 : 0, outY = y < b.y0 ? -1 : y > b.y1 ? 1 : 0;
    if (!outX && !outY) continue;
    if (mine && B.wf[i] >= 2) {
      B.wf[i] -= 1;
      if (outX) { B.vx[i] = -B.vx[i]; B.x[i] = outX < 0 ? 2 * b.x0 - x : 2 * b.x1 - x; }
      if (outY) { B.vy[i] = -B.vy[i]; B.y[i] = outY < 0 ? 2 * b.y0 - y : 2 * b.y1 - y; }
      B.age[i] = Math.min(B.age[i], B.life[i] * 0.4);          // a bounce gives it a fresh run
      B.last[i] = 0;
    } else {
      B.x[i] = Math.max(b.x0, Math.min(b.x1, x)); B.y[i] = Math.max(b.y0, Math.min(b.y1, y));
      B.age[i] = B.life[i];                                    // spent at the wall (gone next step)
    }
  }
}

// The Orbit gift: cells circling you pop what they touch (1 damage per 0.4 s a germ).
function orbitCells(st) {
  const n = 2 * (st.gifts.orbit || 0), A = st.A, p = A.p, out = [];
  for (let k = 0; k < n; k++) {
    const a = A.t * G.orbitW + (k * TAU) / n;
    out.push({ x: p.x + Math.cos(a) * G.orbitR, y: p.y + Math.sin(a) * G.orbitR });
  }
  return out;
}
function orbitStep(st) {
  const A = st.A;
  if (!st.gifts.orbit || A.ko || !LIVE.has(st.phase)) return;
  for (const c of orbitCells(st)) {
    for (const f of A.foes.slice()) {
      if (f.in > 0 || f.orbT > A.t) continue;
      const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
      if (d > f.r + G.orbitCellR) continue;
      f.orbT = A.t + G.orbitEvery;
      X.damageFoe(A, f, 1, (dx / d) * 8, (dy / d) * 8);
    }
  }
}

// ---- the outcomes of a world step

function outcomes(st) {
  const A = st.A;
  for (let i = 0; i < A.out.length; i++) {
    const o = A.out[i];
    if (o.type === "clear") {
      if (o.boss) { st.knotPopped = true; st.knotAt = A.t - st.k0; st.knotXY = { x: o.x, y: o.y }; popped(st, o.x, o.y, KN.countAs, o.combo); continue; }
      popped(st, o.x, o.y, 1, o.combo);
      const ch = st.gifts.chain || 0;
      if (ch > 0) X.shoot(A, o.x, o.y, { kind: "ring", n: G.chain * ch, speed: G.chainSpeed, r: 1, tone: "you", life: G.chainLife, dmg: 1, side: 1 }, A.rnd() * TAU);
      if (o.kind === "cell") {                                 // a splitter pops into two small chasers
        for (const s of [-1, 1]) {
          const b = roomBox(st);
          const x = Math.max(b.x0 + 3, Math.min(b.x1 - 3, o.x + s * 2.5)), y = Math.max(b.y0 + 3, Math.min(b.y1 - 3, o.y));
          spawnGerm(st, "kid", { x, y });
        }
      }
    } else if (o.type === "pick" && o.kind === "up") {
      st.sparkles++;
      if (st.sparkles % TUNE.mendEvery === 0 && X.heal(A, 1) > 0) { st.mends++; sfx(st, "act.heal", A.p.x, A.p.y); }
    } else if (o.type === "strike" && !o.boss && st.gifts.sticky) {
      const f = A.foes.find((g) => g.id === o.id);
      if (f) f.slowT = A.t + G.stickyS;
    }
  }
  X.emitOut(A, st);
}

// ---- the Knot

function startKnot(st) {
  const A = st.A;
  if (st.subgoals.rooms === "shown") {
    if (st.roomsClear >= 3) doneBy(st, "rooms", "you", "split.sub.roomsDone");
    else doneBy(st, "rooms", "auto", "split.sub.roomsAuto");
  }
  enterMoment(st, BLOOM);
  st.phase = "knot";
  st.day = 4;
  st.roomY = 4 * TUNE.roomL;
  st.camY = st.roomY;
  st.k0 = A.t;
  st.exitOpen = 0;
  st.exitT0 = null;
  st.doorT0 = A.t;
  const hp = Math.round(KN.spec.hp * (st.assist ? TUNE.assist.knotK : 1));
  const f = X.spawnFoe(A, { ...KN.spec, hp, x: KN.at.x, y: st.roomY + KN.at.y, spawnS: KN.inS, anywhere: true });
  st.came += KN.countAs;
  st.knot = { id: f ? f.id : 0, phase: 0, pause: 0, ringT: 1.6, told: false, addT: 2.5, spT: 0, spin: 0, fanT: 2.2, fanTold: false,
    aim: 0, puffT: 1.0, puffTold: false, gapT: 0 };
  subgoal(st, "knot", "split.sub.knot");
  setPrompt(st, P_KNOT);
  // split.inner at the Knot's room (design.md 5.3 asks for its first phase change, if it fits: it does not, the
  // ref bot pops the Knot about 5 s after it); the hollow that fills is the inner and outer cells' story
  if (!st.innerSaid) { st.innerSaid = true; caption(st, "split.inner"); }
}

function knotStep(st) {
  const A = st.A, b = st.knot, p = A.p, f = knotOf(st);
  if (!f) return;
  if (A.t - st.k0 >= KN.leaveS - EPS) { knotLeaves(st, f); return; }
  if (f.in > 0) return;
  const Y = st.roomY, share = f.hp / f.hpMax;
  const phase = share > KN.phaseAt[0] ? 0 : share > KN.phaseAt[1] ? 1 : 2;
  const aimP = () => Math.atan2(p.y - f.y, p.x - f.x);
  if (phase !== b.phase) {
    b.phase = phase; f.phase = phase;
    b.pause = KN.pauseS;
    X.clearBullets(A, 2);
    A.tells.length = 0;
    X.hitStop(A, A.juiceK.stopPhase);
    A.juice.shake = Math.min(1, A.juice.shake + 0.8);
    sfx(st, "act.phase", f.x, f.y, phase);
    if (phase === 1) X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: KN.pauseS, foe: f.id });
    else X.addTell(A, { kind: "charge", x: f.x, y: f.y, ang: aimP(), len: 30, w: f.r * 0.8, dur: KN.pauseS, foe: f.id });
    b.ringT = 1.2; b.told = false; b.spT = 0; b.fanT = 1.6; b.fanTold = false; b.puffT = 0.8; b.puffTold = false;
  }
  const toward = (x, y, k) => { f.vx += ((x - f.x) * k - f.vx) * Math.min(1, 4 * DT); f.vy += ((y - f.y) * k - f.vy) * Math.min(1, 4 * DT); };
  if (b.pause > 0) { b.pause -= DT; f.vx *= 0.85; f.vy *= 0.85; return; }
  const tk = A.t - st.k0;
  if (phase === 0) {
    const P1 = KN.p1;
    toward(P1.sway * Math.sin(P1.swayW * tk), Y + KN.at.y, 2);
    b.ringT -= DT;
    if (!b.told && b.ringT <= P1.tellS) { b.told = true; X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: Math.max(DT, b.ringT), foe: f.id }); }
    if (b.ringT <= 0 && X.shoot(A, f.x, f.y, P1.ring, A.rnd() * TAU) >= 0) { b.ringT = P1.every; b.told = false; }
    b.addT -= DT;
    if (b.addT <= 0) {
      b.addT += P1.addEvery;
      const box0 = roomBox(st);
      for (let k = 0; k < P1.adds; k++) {
        const x = Math.max(box0.x0 + 5, Math.min(box0.x1 - 5, f.x + (k ? 1 : -1) * (f.r + 6)));
        spawnGerm(st, "drifter", { x, y: f.y - 4 });
      }
    }
  } else if (phase === 1) {
    const P2 = KN.p2;
    toward(P2.sway * Math.sin(P2.swayW * tk), Y + KN.at.y, 2);
    // the spiral: a ring tell, then 3 s of two arms turning, then 2 s off
    const cyc = P2.tellS + P2.onS + P2.offS;
    const before = b.spT;
    b.spT += DT;
    if (before === 0) X.addTell(A, { kind: "ring", x: f.x, y: f.y, r: f.r + 6, dur: P2.tellS, foe: f.id });
    if (b.spT >= P2.tellS && b.spT < P2.tellS + P2.onS) {
      b.gapT -= DT;
      if (b.gapT <= 0 && X.shoot(A, f.x, f.y, P2.spiral, b.spin) >= 0) { b.spin += P2.spin; b.gapT = P2.gap; }
    }
    if (b.spT >= cyc) b.spT = 0;
    // an aimed fan of 5 every 3 s, after its fan tell
    b.fanT -= DT;
    if (!b.fanTold && b.fanT <= P2.fanTellS) {
      b.fanTold = true; b.aim = aimP();
      X.addTell(A, { kind: "fan", x: f.x, y: f.y, ang: b.aim, r: 34, w: 2 * P2.fan.arc + 0.08, dur: Math.max(DT, b.fanT), foe: f.id });
    }
    if (b.fanT <= 0 && X.shoot(A, f.x, f.y, P2.fan, b.aim) >= 0) { b.fanT = P2.fanEvery; b.fanTold = false; }
  } else {
    const P3 = KN.p3;
    // it rolls toward you, and puffs a fan of 3 after its tell
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1e-6;
    f.vx = (dx / d) * P3.roll; f.vy = (dy / d) * P3.roll;
    st.knotRoll = (st.knotRoll || 0) + P3.roll * DT;
    b.puffT -= DT;
    if (!b.puffTold && b.puffT <= P3.tellS) {
      b.puffTold = true; b.aim = aimP();
      X.addTell(A, { kind: "fan", x: f.x, y: f.y, ang: b.aim, r: 30, w: P3.fan.arc + 0.08, dur: Math.max(DT, b.puffT), foe: f.id });
    }
    if (b.puffT <= 0 && X.shoot(A, f.x, f.y, P3.fan, b.aim) >= 0) { b.puffT = P3.every; b.puffTold = false; }
  }
}

// At 18 s the Knot loosens and drifts off by itself (no score).
function knotLeaves(st, f) {
  const A = st.A;
  X.burst(A, f.x, f.y, f.r, 2);
  X.burst(A, f.x, f.y + 6, f.r * 0.7, 2);
  X.removeFoe(A, f.id);
  for (const g of A.foes.slice()) { X.burst(A, g.x, g.y, g.r * 0.7, 2); X.removeFoe(A, g.id); }
  X.clearBullets(A, 2);
  A.tells.length = 0;
  st.knotLeft = true;
  doneBy(st, "knot", "auto", "split.sub.knotAuto");
  startWin(st, false);
}

// The Knot pops (or leaves): a short beat before the hatch. When it pops, the germs left pop too and the spores turn
// to sparkles; you can still move; the hollow fills.
function startWin(st, won) {
  const A = st.A, at = st.knotXY || { x: 0, y: st.roomY + KN.at.y };
  st.phase = "win";
  st.w0 = A.t;
  st.won = won;
  st.booms = 0;
  st.fill0 = st.fill;
  if (won) {
    for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 0); X.removeFoe(A, f.id); popped(st, f.x, f.y, 1, 0); }
    const B = A.b, step = Math.max(1, Math.ceil(B.n / 8));
    for (let i = 0; i < B.n; i += step) if (B.side[i] === 2) X.burst(A, B.x[i], B.y[i], 2, 2);
    X.clearBullets(A, 2);
    A.tells.length = 0;
    X.vacuum(A, KN.winS);
    A.juice.shake = Math.min(1, A.juice.shake + 0.6);
    sfx(st, "act.win", at.x, at.y);
    if (st.knotAt < KN.flourishS) { st.flourish = TUNE.score.flourish; points(st, "flourish", st.flourish); }
    st.roomsClear++;
    const add = TUNE.score.rooms / TUNE.score.roomsN;
    points(st, "skill", add);
    tag(st, at.x, at.y + 4, "split.pop.clear", add, 1.1);
    doneBy(st, "knot", "you", "split.sub.knotDone");
  }
  st.exitT0 = A.t;
  setPrompt(st, P_FREE);
}

function winStep(st) {
  const A = st.A, at = st.knotXY || { x: 0, y: st.roomY + KN.at.y }, k = A.t - st.w0;
  st.fill = Math.max(st.fill, lerp(st.fill0, 1, clamp01(k / KN.winS)));
  if (st.won) {
    while (st.booms < 4 && k >= 0.12 * (st.booms + 1)) {
      const a = A.rnd() * TAU, d = KN.spec.r * (0.3 + 0.2 * st.booms);
      X.burst(A, at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, KN.spec.r * (0.7 - 0.1 * st.booms), st.booms % 2 ? 2 : 0);
      A.juice.shake = Math.min(1, A.juice.shake + 0.25);
      st.booms++;
    }
  }
  if (k >= (st.won ? KN.winS : 0.6) - EPS) startHatch(st);
}

// ---- the hatch and the outro (input none)

function startHatch(st) {
  const A = st.A, p = A.p;
  if (st.mi !== HATCH) enterMoment(st, HATCH);
  st.phase = "hatch";
  st.h0 = A.t;
  st.cracked = false;
  st.fill = 1;
  st.shellXY = { x: p.x, y: p.y };
  st.hFrom = { x: p.x, y: p.y };
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  X.clearBullets(A, 0);
  A.tells.length = 0;
  p.vx = 0; p.vy = 0;
  if (!A.ko) {
    st.pipsPart = Math.round(TUNE.score.pips * Math.min(1, p.hp / TUNE.score.pipsN));
    points(st, "skill", st.pipsPart);
  }
  subgoal(st, "hatch", "split.sub.hatch");
  setPrompt(st, P_HATCH);
  sfx(st, "tone", p.x, p.y);
}

function hatchStep(st) {
  const A = st.A, p = A.p, k = A.t - st.h0;
  if (!st.cracked && k >= TUNE.crackS - EPS) {
    st.cracked = true;
    st.crackT = st.t;
    const s = st.shellXY;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; X.burst(A, s.x + Math.cos(a) * TUNE.ballR, s.y + Math.sin(a) * TUNE.ballR, 2.2, 1); }
    A.juice.shake = Math.min(1, A.juice.shake + 0.35);
    sfx(st, "slip", s.x, s.y);
    doneBy(st, "hatch", "auto", "split.sub.hatched");
  }
  const u = smooth((k - TUNE.crackS) / (TUNE.hatchS - TUNE.crackS));
  p.x = st.hFrom.x * (1 - u); p.y = st.hFrom.y + TUNE.slipU * u;
  p.vx = 0; p.vy = 0;
  st.camY = lerp(st.roomY, Math.max(st.roomY, p.y - 4), u);
  if (k >= TUNE.hatchS - EPS) startOutro(st);
}

function startOutro(st) {
  const A = st.A, p = A.p;
  enterMoment(st, OUTRO);
  st.phase = "outro";
  st.o0 = A.t;
  st.oFrom = { x: p.x, y: p.y };
  st.camO = st.camY;
  setPrompt(st, P_OUTRO);
}

function outroStep(st) {
  const A = st.A, p = A.p, k = A.t - st.o0, u = smooth(k / TUNE.outroS);
  p.y = st.oFrom.y + TUNE.outroU * u;
  p.x = st.oFrom.x;
  st.camY = st.camO + TUNE.outroU * u;
  if (k >= TUNE.outroS - EPS) finish(st, st.wentOn ? "goOn" : "hatch");
}

// After a knock-out and Go on: the splits left play by themselves (0.7 s each), the hollow fills, then the hatch.
function goOnStep(st) {
  const A = st.A, p = A.p;
  if (st.g0 === null) { st.g0 = A.t; st.gFrom = { x: p.x, y: p.y }; }
  const k = A.t - st.g0;
  const left = st.goLeft;
  if (left > 0 && k >= TUNE.goOnSplitS - EPS) {
    st.splits = Math.min(3, st.splits + 1);
    st.splitFx.push(st.t);
    st.goLeft--;
    sfx(st, "pling", p.x, p.y, st.splits + 1);
    st.g0 = A.t;
    return;
  }
  if (left > 0) return;
  st.fill = Math.max(st.fill, clamp01(k / TUNE.goOnFillS));
  if (k >= TUNE.goOnFillS - EPS) startHatch(st);
}

// ---- the end

// Every sub-goal shown and not settled settles now (a knock-out: the first one with the rest line).
function settle(st, how) {
  let rest = how === "ko";
  const line = (auto) => { if (rest) { rest = false; return "split.sub.rest"; } return auto; };
  if (st.subgoals.rooms === "shown") {
    if (how !== "ko" && st.roomsClear >= 3) doneBy(st, "rooms", "you", "split.sub.roomsDone");
    else doneBy(st, "rooms", "auto", line("split.sub.roomsAuto"));
  }
  if (st.subgoals.gift === "shown") doneBy(st, "gift", "auto", line("split.sub.giftAuto"));
  if (st.subgoals.knot === "shown") doneBy(st, "knot", "auto", line("split.sub.knotAuto"));
  if (st.subgoals.hatch === "shown") doneBy(st, "hatch", "auto", "split.sub.hatched");
}

// A knock-out: your cells rest. The germs drift off and the stage holds still until what was said has been read,
// then it ends with its goal unmet (finish "ko"; core/run.js shows the Almost card).
function knockOut(st) {
  const A = st.A;
  st.phase = "ko";
  st.koAt = st.t;
  for (const f of A.foes.slice()) { X.burst(A, f.x, f.y, f.r, 2); X.removeFoe(A, f.id); }
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  st.offer = null;
  settle(st, "ko");
  setPrompt(st, NONE);
}

function finish(st, how) {
  if (st.done) return;
  const A = st.A;
  st.done = true;
  st.doneT = st.t;
  st.how = how;
  const met = how === "hatch" || how === "cap";
  st.goalMet = met;
  st.gaDay = meta.ga.end;
  X.clearBullets(A, 0);
  A.tells.length = 0;
  settle(st, how);
  if (how !== "goOn") {
    const rest = popPart(st) - st.ticked;
    if (rest > 0) { points(st, "skill", rest); st.ticked += rest; }
    if (met) points(st, "goal", TUNE.score.goal);
  }
  sfx(st, "toneEnd", A.p.x, A.p.y);
  setPrompt(st, NONE);
  emit(st, "done", {});
}

// ---- the Stage interface

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const carry = mergeCarry(carryIn, null);
  const phase = Number.isFinite(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const s = seed >>> 0;
  const assist = !!o.assist;
  const As = TUNE.assist;
  const dash = assist ? { ...TUNE.dash, cdS: TUNE.dash.cdS * As.dashCdK } : { ...TUNE.dash };
  const A = X.createWorld(s, {
    arena: null,
    player: { ...TUNE.player, x: TUNE.pickTo.x, y: TUNE.pickTo.y, shield: Math.min(2, Math.max(0, carry.sparks | 0)),
      ...(assist ? { hp: TUNE.player.hp + As.hpPlus } : {}) },
    dash, fire: TUNE.fire, pickup: TUNE.pickup,
    bulletK: assist ? As.bulletK : 1, bulletCap: TUNE.bulletCap,
  });
  const assistK = assist ? As.foesK : 1;
  const c = counts(assistK);
  const motes = [];
  const rm = stream(s, "motes");
  for (let i = 0; i < TUNE.motes; i++) motes.push({ x: (rm() - 0.5) * (TUNE.tubeW - 8), y: rm() * 290, a: 0.35 + 0.45 * rm() });
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: meta.ga.start, fertilized: true,
    events: [], beats: null, subgoals: {}, moment: IDS[0],
    assist, lag: Number.isFinite(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry,
    A, mi: 0, phase: "room", day: 0, roomY: 0, camY: 0, roomT0: 0, spawnAdv: 0, rows: [], ri: 0,
    exitOpen: 0, exitT0: null, doorT0: 0, carried: false, c0: 0, s0: 0, from: null, to: null, cam0: 0, cam1: 0, pinch: true,
    splits: 0, gifts: {}, offer: null, pickT0: 0, picks: 0, taken: [], dash0: { ...dash },
    came: 0, popped: 0, ticked: 0, expect: c.expect, per: Math.floor(TUNE.score.popped / c.ub),
    roomsClear: 0, pipsPart: 0, flourish: 0, sparkles: 0, mends: 0,
    knot: null, knotPopped: false, knotAt: null, knotLeft: false, knotXY: null, k0: 0, innerSaid: false, w0: 0, won: false, booms: 0,
    fill: 0, fill0: 0, h0: 0, cracked: false, crackT: null, shellXY: null, hFrom: null, o0: 0, oFrom: null, camO: 0,
    g0: null, goLeft: 0, gFrom: null, wentOn: false,
    tags: [], splitFx: [], ringFx: [], motes, lay: layouts(s),
    rRoom: stream(s, "rooms"), rGift: stream(s, "gifts"),
    capQ: [], prompt: null, done: false, doneT: 0, how: null, goalMet: false, capBusy: 0, evSeen: 0, koAt: null, koEnd: null,
    assistK,
  };
  st.beats = makeBeats(s, [{ heart: "mother", from: 0, to: END_S, bpm: meta.motherBpm, jitter: 0, first: phase }]);
  fireOf(st);
  startRoom(st, 0);
  note(st, FACTS, TEXT);
  return st;
}

export function step(st, intents) {
  if (st.done) { st.t += DT; return; }
  const A = st.A;
  const it = LIVE.has(st.phase) ? intents || EMPTY_INTENTS : EMPTY_INTENTS;
  fireOf(st);
  const moved = X.stepWorld(A, it);
  if (moved) { box(st); orbitStep(st); drive(st); }
  outcomes(st);
  if (A.ko && st.phase !== "ko" && LIVE.has(st.phase)) knockOut(st);
  if (!moved) { /* a hit-stop holds the world and its timers */ }
  else if (st.phase === "room") {
    spawnRows(st);
    const tIn = A.t - st.roomT0;
    if (st.ri >= st.rows.length && A.foes.length === 0 && tIn > 0.5) endRoom(st, true);
    else if (tIn >= TUNE.roomS - EPS) endRoom(st, false);
  } else if (st.phase === "clear") {
    if (A.t - st.c0 >= TUNE.clearS - EPS) startSplit(st);
  } else if (st.phase === "split") splitStep(st);
  else if (st.phase === "pick") pickStep(st);
  else if (st.phase === "knot") {
    st.fill = Math.max(st.fill, 0.8 * clamp01((A.t - st.k0) / KN.leaveS));
    knotStep(st);
    if (st.knotPopped && st.phase === "knot") startWin(st, true);
  } else if (st.phase === "win") winStep(st);
  else if (st.phase === "hatch") hatchStep(st);
  else if (st.phase === "outro") outroStep(st);
  else if (st.phase === "goOn") goOnStep(st);
  if (st.exitT0 !== null) st.exitOpen = clamp01((A.t - st.exitT0) / 0.5);
  st.t += DT;
  // the clock: a day's room runs its first 0.6 (the split the rest, splitStep); the Knot's room 19 to 20
  const m = MOMENTS[st.mi];
  if (st.phase === "room") st.gaDay = Math.max(st.gaDay, m.ga[0] + 0.6 * clamp01((A.t - st.roomT0) / TUNE.roomS));
  else if (st.phase === "knot") st.gaDay = Math.max(st.gaDay, Math.min(m.ga[1], m.ga[0] + 0.95 * clamp01((A.t - st.k0) / KN.leaveS)));
  else if (st.phase === "hatch" || st.phase === "outro" || st.phase === "win") st.gaDay = Math.max(st.gaDay, meta.ga.end);
  note(st, FACTS, TEXT);                                    // what was said, for a knock-out's rest (core/lib/rest.js)
  if (st.phase === "ko") {
    if (st.koEnd === null) st.koEnd = readBy(st, st.koAt + TUNE.koS);
    if (st.t >= st.koEnd - EPS || st.t >= meta.capS - EPS) finish(st, "ko");
    return;
  }
  if (st.t >= meta.capS - EPS) finish(st, st.wentOn ? "goOn" : "cap");
}

// ---- the picture

// The cells as splats round (bx, by): 2, 4, 8 or 16 discs; two discs parting with a shrinking bridge in a split; the
// morula packing tight; the blastocyst opening round its hollow as it fills.
function cellSplats(st, bx, by, out) {
  const { L, blast } = st.lay, A = st.A;
  const k = Math.min(4, st.splits + 1);
  const t = st.t;
  const slip = st.cracked && st.crackT !== null ? 1 + 0.1 * smooth((t - st.crackT) / 1.2) : 1;
  const cell = (x, y, r) => out.push({ k: "c", x: bx + x * slip, y: by + y * slip, r: Math.max(0.3, r * slip), m: 1, n: 0.35, v: 0, hue: 0.02 });
  if (st.phase === "split" && st.pinch && k < 4) {
    const q = smooth((A.t - st.s0) / TUNE.splitS);
    const kids = L[k + 1];
    L[k].forEach((p, i) => {
      const a = kids[2 * i], b = kids[2 * i + 1];
      const ax = lerp(p.x, a.x, q), ay = lerp(p.y, a.y, q), bxx = lerp(p.x, b.x, q), byy = lerp(p.y, b.y, q);
      const r = lerp(p.r * 0.92, a.r, q);
      cell(ax, ay, r);
      cell(bxx, byy, r);
      const rb = a.r * 0.7 * (1 - q);
      if (rb > 0.3) out.push({ k: "s", x: bx + ax, y: by + ay, r: rb, x2: bx + bxx, y2: by + byy, m: 0.9, n: 0, v: 0, hue: 0.02 });
    });
    return;
  }
  const pack = st.phase === "split" && !st.pinch ? 1 - 0.12 * Math.sin(Math.PI * clamp01((A.t - st.s0) / TUNE.splitS)) : 1;
  if (k < 4) { for (const c of L[k]) cell(c.x * pack, c.y * pack, c.r); return; }
  const e = smooth(st.fill);
  if (e > 0.02) out.push({ k: "c", x: bx, y: by + 1.3 * slip, r: Math.max(0.3, 3.4 * e * slip), m: 0.5, n: 0, v: 0, hue: 0.09 });
  L[4].forEach((c, i) => {
    const s = blast[i];
    cell(lerp(c.x * pack, s.x, e), lerp(c.y * pack, s.y, e), lerp(c.r, s.r, e));
  });
}

function bar(mm) {
  let best = 0.1;
  for (const v of [0.1, 1, 10, 100, 1000]) if (v <= mm * 0.3) best = v;
  return best;
}

const swell = (phase) => { const u = Math.max(0, 1 - phase / 0.35); return u * u; };

// A squeeze of the tube that closes a room: two paper lips that slide to the walls as it opens.
function door(d, y, open, pulse) {
  const o = smooth(open);
  for (const s of [-1, 1]) {
    d.marks.push({ kind: "band", x: s * (24 + 20 * o), y, r: 24 * (1 - 0.6 * o), w: 12 * (1 - 0.3 * o), rim: "wavy", on: 1, pulse, ang: Math.PI / 2 });
  }
}

export function view(st) {
  const A = st.A, p = A.p, t = st.t;
  const d = emptyDraw(meta.id);
  const camY = st.camY;
  const span = TUNE.span;
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: camY, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { mm: bar(mm) };
  const outroP = st.phase === "outro" ? clamp01((A.t - st.o0) / TUNE.outroS) : st.done && st.how !== "ko" ? 1 : 0;
  d.light = { level: 0.46 + 0.08 * outroP, warm: 0.6, exposure: 1, white: 0, vignette: 0.42, tint: 0 };
  d.warp = 0.2;
  d.caustics = 0;
  const her = swell(st.beats.phase("mother", t));

  // the tube: its floor, cilia along both walls, and fluid motes flowing past
  const y0 = Math.floor((camY - 150) / 10) * 10;
  const pts = [], w = [];
  for (let i = 0; i < 32; i++) { pts.push(0, y0 + 10 * i); w.push(TUNE.tubeW); }
  d.strips.push({ kind: "course", pts, w, tone: "womb" });
  const c0 = Math.floor((camY - 150) / 5) * 5, wall = TUNE.tubeW / 2 - 1.5, cph = (t * 1.5) % 1;
  d.strips.push({ kind: "cilia", a: [-wall, c0], b: [-wall, c0 + 305], count: 62, phase: cph, amp: 0.55 });
  d.strips.push({ kind: "cilia", a: [wall, c0], b: [wall, c0 + 305], count: 62, phase: (cph + 0.5) % 1, amp: 0.55 });
  const n = st.motes.length;
  const xy = new Float32Array(2 * n), al = new Float32Array(n), id = new Float32Array(n);
  st.motes.forEach((m, i) => {
    const wy = m.y - 2.6 * t;
    const rel = (((wy - (camY - 140)) % 290) + 290) % 290;
    xy[2 * i] = m.x; xy[2 * i + 1] = camY - 140 + rel; al[i] = m.a; id[i] = i;
  });
  d.points = { n, xy, a: al, id, hue: 0.08 };

  // the rooms' squeezes: each room's back closes as it starts; its exit opens when it is clear (or at its timer)
  const doorOpen = clamp01((A.t - st.doorT0) / 0.5);
  for (let r = 0; r <= 4; r++) {
    const ry = r * TUNE.roomL;
    if (ry + R.y1 + 2 < camY - 150 || ry + R.y0 - 4 > camY + 160) continue;
    const back = r < st.day ? 0 : r === st.day ? 1 - doorOpen : 1;
    door(d, ry + R.y0 - 4, back, her * 0.5);
    if (r < 4) door(d, ry + TUNE.exitY + 2, r < st.day ? 1 : r === st.day ? st.exitOpen : 0, her * 0.5);
  }
  if (outroP > 0) d.marks.push({ kind: "spot", x: 0, y: camY + 70, r: 20 + 30 * outroP, on: outroP, pulse: 0 });

  // you: the ball in its shell, its cells, the hollow; the cells that orbit you
  const bx = p.x, by = p.y;
  d.marks.push({ kind: "glow", x: bx, y: by, r: TUNE.ballR * 1.6, on: A.ko ? 0.2 : 0.6, pulse: her * 0.4 });
  const splats = [];
  cellSplats(st, bx, by, splats);
  if (LIVE.has(st.phase)) for (const c of orbitCells(st)) splats.push({ k: "c", x: c.x, y: c.y, r: G.orbitCellR, m: 1, n: 0.35, v: 0, hue: 0.02 });
  d.splats = splats.slice(0, 32);
  const sh = st.cracked ? st.shellXY : { x: bx, y: by };
  if (st.cracked && st.crackT !== null) {
    const q = smooth((t - st.crackT) / 0.8);
    const gap = 1.6 * q;
    if (q < 1) d.strips.push({ kind: "arc", x: sh.x, y: sh.y, r: TUNE.ballR + 1.5 * q, a0: Math.PI / 2 + gap / 2, a1: Math.PI / 2 - gap / 2 + TAU, w: TUNE.shellW * (1 - 0.6 * q), glow: 0 });
  } else {
    const thin = st.phase === "hatch" ? 0.4 * smooth((A.t - st.h0) / TUNE.crackS) : 0;
    d.strips.push({ kind: "arc", x: sh.x, y: sh.y, r: TUNE.ballR, a0: 0, a1: TAU, w: TUNE.shellW * (1 - thin), glow: 0 });
  }

  // rings of light: a split, a gift taken, the shield sparks round the shell
  const items = [];
  for (const t0 of st.splitFx) {
    const q = clamp01((t - t0) / 0.8);
    if (q < 1) items.push({ x: bx, y: by, r: TUNE.ballR + 1 + 9 * q, a: 0.7 * (1 - q), dashed: true });
  }
  for (const f of st.ringFx) {
    const q = clamp01((t - f.t) / 0.6);
    if (q < 1) items.push({ x: f.x, y: f.y, r: G.bubbleR + 8 * q, a: 0.8 * (1 - q), dashed: false });
  }
  if (items.length) d.strips.push({ kind: "ripples", items });
  rimSparks(d, st.carry.sparks, bx, by, TUNE.ballR + 0.8, { t, span });

  // the action layer: germs, spores, your shots, sparkles, telegraphs, pops, your hp; the gift bubbles
  const av = X.actionView(A, { player: LIVE.has(st.phase) || st.phase === "split" });     // no hitbox bead once you hatch
  const L = TUNE.lunge;
  av.foes.forEach((f, i) => {
    const g = A.foes[i];
    if (!g || g.boss) {
      if (g && g.boss) {
        f.look = "clump";                                    // the Knot: stacked paper discs (render/action.js)
        if (st.knot && st.knot.pause > 0) f.charge = clamp01(1 - st.knot.pause / KN.pauseS);
      }
      return;
    }
    if (g.lunge && g.lp === 1) {
      f.charge = clamp01((((A.t - g.lt0) % (L.walkS + L.wobS + L.goS)) - L.walkS) / L.wobS);
      f.x += Math.sin(t * 55 + i) * 0.5;
    }
  });
  const words = [];
  for (const g of st.tags) {
    const q = (t - g.t0) / g.dur;
    if (q < 0 || q >= 1) continue;
    words.push({ x: g.x, y: g.y + 6 * q, v: g.v, a: clamp01(1 - q), combo: 0, word: g.word });
  }
  const gifts = [];
  if (st.offer && st.phase === "pick") {
    const left = clamp01(1 - (t - st.pickT0) / TUNE.pickS);
    st.offer.forEach((b, k) => {
      const a = clamp01((t - b.t0) / 0.25);
      const bob = Math.sin(t * 3 + k * 2) * 0.6;
      gifts.push({ x: b.x, y: b.y + bob, r: G.bubbleR * (0.6 + 0.4 * a), icon: b.id, a, on: k === 1 ? 1 - left : 0, lv: st.gifts[b.id] || 0 });
      // its tag up and back of it in world terms: above it on screen in portrait and in landscape alike
      words.push({ x: b.x - G.bubbleR - 1, y: b.y + bob + G.bubbleR + 1, v: 0, a, combo: 0, word: "split.gift." + b.id });
    });
  }
  av.pops = [...av.pops.slice(-Math.max(0, 12 - words.length)), ...words.slice(-12)];
  d.action = { ...av, arena: null, gifts };
  d.anchor = { x: bx, y: by };
  d.cue = { x: bx, y: by };
  return d;
}

export function prompt(st) {
  if (st.done || !st.prompt) return { ...NONE };
  return { ...st.prompt };
}

export function targets() {
  return [];
}

// The gift the bot takes: the first in its preference (the middle one below skill 0.5).
function pickFor(st, skill) {
  if (!st.offer) return 1;
  if (skill < 0.5) return 1;
  for (const id of TUNE.prefer) { const k = st.offer.findIndex((b) => b.id === id); if (k >= 0) return k; }
  return 1;
}

// The room's walls push the bot back in (the layer's own wall push needs a round arena).
function wallPush(st, a) {
  const p = st.A.p, b = roomBox(st), pad = 10;
  let sx = a.steer.x, sy = a.steer.y;
  if (p.x < b.x0 + pad) sx += ((b.x0 + pad - p.x) / pad) * 2.2;
  if (p.x > b.x1 - pad) sx -= ((p.x - (b.x1 - pad)) / pad) * 2.2;
  if (p.y < b.y0 + pad) sy += ((b.y0 + pad - p.y) / pad) * 2.2;
  if (p.y > b.y1 - pad) sy -= ((p.y - (b.y1 - pad)) / pad) * 2.2;
  const m = Math.hypot(sx, sy);
  if (m > 0.9999) { sx *= 0.9999 / m; sy *= 0.9999 / m; }
  return { steer: { x: sx, y: sy }, dash: a.dash };
}

// The action bot (core/lib/actionbot.js) at this skill: dodge and keep range in a room, near its middle; swim into
// its gift; circle the Knot below it at 35 u.
export function botSteer(st, skill, r) {
  const zero = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done || st.A.ko || !LIVE.has(st.phase)) return zero;
  const A = st.A, p = A.p, b = roomBox(st);
  let goal = null, weight = 1, keep = true;
  if (st.phase === "pick" && st.offer) { goal = st.offer[pickFor(st, skill)]; weight = 2; }
  else if (st.phase === "knot") {
    const f = knotOf(st);
    if (f) {
      const a = -Math.PI / 2 + 0.9 * Math.sin(0.45 * A.t);
      goal = { x: f.x + Math.cos(a) * 35, y: f.y + Math.sin(a) * 35 };
      keep = false;
      weight = 2;                                            // stay in reach through its spiral
    }
  } else if (st.phase === "room" || st.phase === "clear") {
    goal = { x: 0, y: Math.max(st.roomY - 22, Math.min(st.roomY + 25, p.y)) };
    weight = 0.4;
  }
  if (goal) goal = { x: Math.max(b.x0 + 9, Math.min(b.x1 - 9, goal.x)), y: Math.max(b.y0 + 9, Math.min(b.y1 - 9, goal.y)) };
  const a = goalSteer(A, wallPush(st, actionSteer(A, skill, r, { keep })), goal, skill, r, { weight });
  return { steer: a.steer, dir: null, hold: false, dash: a.dash };
}

export function probe() {
  return null;
}

export function result(st) {
  const A = st.A;
  const goalMet = st.done && st.goalMet;
  const pop = st.done ? popPart(st) : st.ticked;
  const rooms = roomsPart(st);
  const pips = st.pipsPart;
  const score = clampScore({ goal: goalMet ? TUNE.score.goal : 0, skill: pop + rooms + pips, flourish: st.flourish });
  return {
    done: st.done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "popped", label: "split.part.popped", value: pop, max: TUNE.score.popped },
      { id: "rooms", label: "split.part.rooms", value: rooms, max: TUNE.score.rooms },
      { id: "pips", label: "split.part.pips", value: pips, max: TUNE.score.pips },
      { id: "knot", label: "split.part.knot", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      cells: 2 ** (Math.min(3, st.splits) + 1), splits: st.splits, came: st.came, popped: st.popped, roomsClear: st.roomsClear,
      gifts: { ...st.gifts }, taken: st.taken.map((x) => ({ ...x })), hits: A.hits, hp: A.p.hp, hpMax: A.p.hpMax,
      bestCombo: A.bestCombo, sparkles: st.sparkles, mends: st.mends, dashes: A.dashes,
      knot: st.knotPopped ? "popped" : st.knotLeft ? "left" : null, knotAt: st.knotPopped ? st.knotAt : null,
      moment: st.moment, how: st.how, gaDay: st.gaDay, ko: A.ko, koAt: st.koAt, almost: A.ko ? "almost.ko" : null,
      shieldHits: A.shieldHits || 0,
    },
    carryOut: {},
  };
}

// Fair resume (5.2): 1.2 s of i-frames after Resume, so a pause never ends in a hit.
export function resume(st) {
  if (!st || st.done) return 0;
  st.A.p.inv = Math.max(st.A.p.inv, 1.2);
  return 0;
}

// Skip to a named moment, starting now (for tests, the test hook and Go on): the germs and shots go, the cells are
// the ones of that day, and the clock moves on to that moment's start (never back). After a knock-out, "hatch" plays
// the splits left and the hollow first (Go on), with input none.
export function jump(st, id) {
  const i = IDS.indexOf(id);
  if (i < 0 || !st || typeof st !== "object" || !st.A) return false;
  const A = st.A;
  for (const f of A.foes.slice()) X.removeFoe(A, f.id);
  X.clearBullets(A, 0);
  A.tells.length = 0;
  st.capQ = [];
  st.offer = null;
  st.done = false;
  st.how = null;
  st.knotPopped = false;
  if (i <= 3) {
    st.splits = Math.max(st.splits, i);
    A.p.x = TUNE.pickTo.x; A.p.y = i * TUNE.roomL + TUNE.pickTo.y;
    startRoom(st, i);
  } else if (i === BLOOM) {
    st.splits = 3;
    A.p.x = TUNE.pickTo.x; A.p.y = 4 * TUNE.roomL + TUNE.pickTo.y;
    startKnot(st);
  } else if (i === HATCH) {
    if (A.ko) {
      enterMoment(st, HATCH);
      st.wentOn = true;
      st.phase = "goOn";
      st.goLeft = 3 - Math.min(3, st.splits);
      st.g0 = null;
      setPrompt(st, P_HATCH);
    } else { st.splits = 3; startHatch(st); }
  } else {
    st.splits = 3; st.fill = 1; st.cracked = true; st.crackT = st.t - 2; st.shellXY = { x: A.p.x, y: A.p.y };
    startOutro(st);
  }
  return true;
}
