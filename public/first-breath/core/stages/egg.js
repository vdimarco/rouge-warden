// First Breath: stage 2, The Egg (`egg`): "Guard your shell." (openspec/changes/first-breath-action-genres/design.md
// 5.2; contract.md). Now you are the egg. A gold surge washes over your follicle on her beats 1 and 2; it opens by
// itself on her 3rd beat ("It opens."), and the fimbriae sweep you into the tube. Then the guard, a radial brick
// breaker with bullet-hell patterns: a glowing arc follows your drag (or the turn keys, or the mouse) round your
// shell, and a glow bounces off it into rings of rival sperm (1 to 3 hits each), which bounce off and drift away.
// From the second ring on, some rivals fire enzyme sparks (aimed streams, fans, curtains, rings, a turning stream),
// each after its telegraph; the arc blocks a spark and sends it back as one of yours. Rivals that drift off drop
// gifts (Multi, Wide, Pierce, Slow, Mend) that only the arc catches. A seal charge fills as rivals drift off and
// sparks are blocked; a press (a second finger, a quick second tap, Space, Enter or Z) releases it, and every spark
// turns to gold. A swarm comes last (a bar, three phases), then the rush: your own gold sperm comes in with 4 rivals.
// Let yours in and bounce the rest. Your sperm enters, you seal your shell (a fresh press, or by itself), and the two
// nuclei draw close. A spark on the shell, a lost last glow or a held rival costs a shell pip; at 0 your shell needs
// a rest (a knock-out: the Almost card; Go on plays the rush out with your sperm alone).
//
// Pure: no DOM, no clocks, no storage, no Math.random; every draw comes from stream(seed, name). The step never throws
// (a caught error ends the stage gracefully and is kept in state.error). The play runs on the action layer's world
// (core/lib/action.js): its clock (it holds still for a hit-stop), its foe bullets (the enzyme sparks, their cap and
// telegraphs), its hp (the shell pips, with shield sparks), juice, pops and bursts. The arc, the glows, the rivals,
// your sparks, the gifts and your sperm are this stage's own. Numbers live in egg.tune.js.
//
// Choices where the design is silent:
// - The guard's gesture is "move" with keys "turn": a drag turns the arc (its touch-down is no press), and a press is
//   the seal charge, as "move" takes a press as the dash (design.md 4.2). The seal is a "tap".
// - A knock-out does not fire `fertilized`: Go on plays your sperm in and fires it at the end of fusion, as a whole
//   stage does, so the clock's label stays "Week 2" until the nuclei touch (exactly one per run). Try again starts over.
// - After Go on, the stage keeps the Skill and Flourish it had at the knock-out and adds none.
// - Rush rivals still swimming in when your sperm enters are left out of the rush credit; a stuck one counts as held.
// - Fact pacing: egg.fimbriae in the sweep, one fact as each of waves 1 to 3 comes (egg.zona, egg.caps with the first
//   sparks, egg.corona), egg.fuse as your sperm comes in (it reads by the time it enters) and egg.block at fusion,
//   after "Your shell seals.". The others (egg.choice among them: the captions had no room for it) are "What was
//   real" facts on the result (where "result").
import { DT, mmPerShortAxis } from "../clock.js";
import { makeBeats } from "../beat.js";
import { emit } from "../events.js";
import { EMPTY_INTENTS } from "../intent.js";
import { clampScore, PARTS } from "../score.js";
import { mergeCarry } from "../carry.js";
import { emptyDraw, LIMITS } from "../draw.js";
import { subgoal, doneBy, turnToward, wrapAngle } from "../lib/goals.js";
import { rimSparks } from "../lib/sparks.js";
import { stream, gauss } from "../rng.js";
import * as X from "../lib/action.js";
import { noteCaptions as note, readBy } from "../lib/rest.js";
import { TUNE } from "./egg.tune.js";
import { FACTS } from "./egg.facts.js";
import { TEXT } from "./egg.text.js";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => (fin(v) ? Math.max(0, Math.min(1, v)) : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const angDist = (a, b) => Math.abs(wrapAngle(a - b));
const UNIT = 1 - 1e-9;   // botSteer's steer length: under 1 even after rounding

const T = TUNE, O = T.opening, AR = T.arc, FL = T.field, BL = T.ball, BR = T.brick, DV = T.dive, FI = T.fire;
const UP = T.ups, CH = T.charge, RU = T.rush, GD = T.gold, BO = T.bounce, SK = T.stick, HE = T.held, SH = T.shell;
const SW = T.swarm, SL = T.seal, FU = T.fusion, SC = T.score, SZ = T.sizes, BOT = T.bot, LK = T.look;

// The radii where things meet the arc (tune header): a glow's centre meets its outer edge at RC and has slipped by
// inside RL; a spark meets it at RS and has slipped by inside RSI; a gift is caught at RUP.
const RC = AR.r + AR.w / 2 + BL.r;
const RL = AR.r - AR.w / 2;
const RS = AR.r + AR.w / 2 + FI.r;
const RSI = AR.r - AR.w / 2 - FI.r;
const RUP = AR.r + AR.w / 2;
const RIM = FL.rim - BL.r;
const KINDS = Object.freeze({ P: "plain", T: "tough", C: "capped" });
const HITTABLE = new Set(["form", "tell", "dive"]);
const LIVE = new Set(["in", "form", "tell", "dive", "stuck"]);

// Every hit of every rival the waves and the swarm bring (design.md 5.2: 116): the bricks part's yardstick.
const hitsOf = (kinds) => [...kinds].reduce((a, c) => a + BR.hits[KINDS[c]], 0);
const PLANNED = T.waves.reduce((a, w) => a + w.forms.reduce((b, f) => b + hitsOf(f.kinds), 0), 0) + hitsOf(SW.kinds);
const PER_HIT = SC.bricks / (SC.bricksShare * PLANNED);

// One 4.1 moment: the whole stage is at gaDay 14 (Week 2), so no moment moves the clock.
const mo = (id) => Object.freeze({ id, ga: Object.freeze([14, 14]), lenS: null });

export const meta = Object.freeze({
  id: "egg", index: 1, name: "The Egg", verb: "Guard",
  orient: "long",
  families: Object.freeze(["rotate", "tap"]),
  ga: Object.freeze({ start: 14, end: 14 }), fertilized: false,
  mm: Object.freeze({ start: 0.4, end: 0.4 }),
  action: true, goOn: "guard",
  motherBpm: 72, parS: 55, capS: T.capS, canFail: true, scored: true,
  moments: Object.freeze(["surge", "open", "sweep", "guard", "enter", "seal", "fusion", "outro"].map(mo)),
});

const ORDER = meta.moments.map((m) => m.id);
const I_GUARD = ORDER.indexOf("guard"), I_ENTER = ORDER.indexOf("enter");
const NONE = Object.freeze({ gesture: "none", text: null, keys: "steer" });
const P_GUARD = Object.freeze({ gesture: "move", text: "egg.guard", keys: "turn" });
const P_SEAL = Object.freeze({ gesture: "tap", text: "egg.seal", keys: "steer" });

// ---- seeded set-up

// The 72 gold candidates (degrees, one every 5°) in the seeded order of stream(seed, "gold").
function goldOrder(seed) {
  const r = stream(seed, "gold");
  const idx = Array.from({ length: GD.candidates }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const q = Math.floor(r() * (i + 1)); const s = idx[i]; idx[i] = idx[q]; idx[q] = s; }
  return idx.map((i) => i * GD.stepDeg);
}

// The corona: 220 paper dots between 11 and 20 u (radius, angle, alpha per dot).
function coronaOf(seed) {
  const r = stream(seed, "corona");
  const [lo, hi] = SZ.corona;
  const c = new Float32Array(3 * SZ.coronaN);
  for (let i = 0; i < SZ.coronaN; i++) {
    c[3 * i] = lo + (hi - lo) * r();
    c[3 * i + 1] = r() * TAU - Math.PI;
    c[3 * i + 2] = 0.55 + 0.4 * r();
  }
  return c;
}

export function create(seed, carryIn, opts = {}) {
  const o = opts || {};
  const s = (Number(seed) >>> 0) || 0;
  const carry = mergeCarry(carryIn, null);
  const phase = fin(o.motherPhase) && o.motherPhase >= 0 ? o.motherPhase : 0;
  const assist = !!o.assist;
  const beats = makeBeats(s, [{ heart: "mother", from: 0, to: meta.capS + 30, bpm: meta.motherBpm, jitter: 0, first: phase }]);
  // her beats 1 to 3: beat 1 is her first beat at or after the lead-in (v1 5.1)
  const ob = [];
  let b = beats.next("mother", O.leadS - 1e-9);
  for (let k = 0; k < O.burstBeat; k++) { ob.push(b); b = beats.next("mother", b + 1e-6); }
  // the action layer's world: you are the egg, fixed at the centre; a spark whose centre reaches the shell hits it
  const A = X.createWorld(s, {
    arena: null, dash: null, fire: null,
    player: { x: 0, y: 0, fixed: true, r: FL.shell - FI.r, body: SZ.shell, hp: assist ? SH.pipsAssist : SH.pips,
      invS: SH.invS, mercyR: SH.mercyR, push: 0, safeR: 14, clearR: 0,
      shield: Math.min(SH.shieldMax, Math.max(0, Math.floor(fin(carry.sparks) ? carry.sparks : 0))) },
    bulletK: assist ? FI.bulletAssistK : 1, bulletCap: assist ? FI.capAssist : FI.cap,
    combo: { s: T.combo.s, step: T.combo.step, max: T.combo.max },
  });
  A.bossBar = null;
  const half = (assist ? AR.halfAssistDeg : AR.halfDeg) * RAD;
  const st = {
    id: meta.id, seed: s, t: 0, gaDay: 14, fertilized: false, events: [], beats, subgoals: {}, moment: ORDER[0],
    mi: 0, mStart: 0, done: false, doneAt: null, how: null, capped: false, error: null, goalMet: false,
    assist, lag: fin(o.lag) ? o.lag : 0, oneButton: !!o.oneButton, carry, place: carry.sperm.place, ob,
    A, phase: "play", koAt: null, koEnd: null, koed: false, wentOn: false, koScore: null, capBusy: 0, evSeen: 0,
    prompt: null,
    rng: { form: stream(s, "forms"), dive: stream(s, "dive"), fire: stream(s, "fire"), up: stream(s, "ups"),
      bounce: stream(s, "bounce"), rush: stream(s, "rush") },
    guard: {
      t0: null, w0: null, half, arc: { a: stream(s, "arc")() * TAU - Math.PI, live: false, wokeAt: null },
      order: goldOrder(s),
      bricks: [], forms: [], queue: [], nextId: 0, wi: 0, lastWave: -Infinity, swarm: null, calm: false,
      glows: [], serveAt: null, first: true, mine: [], ups: [], fx: { wide: -1, pierce: -1, slow: -1 }, slowOn: false,
      charge: 0, kept: 0, wave: null, used: 0,
      diveEvery: 0, diveAt: Infinity,
      gold: null, rushAt: null, rushT: null, enterAt: null, credit: null, counted: 0, rushN: { bounce: 0, loose: 0, held: 0 },
      hits: 0, came: 0, bricksCame: 0, offs: 0, sinceUp: 0, blocked: 0, lost: 0, returns: 0, held: 0, popped: 0, bounced: 0,
      combo: 0, comboT: 0, bestCombo: 0, cracks: [], rip: [], tags: [], tellOf: [], pipsAt: null, clean: false,
      caught: 0, mend: 0, stale: 0, mineHits: 0, waves: [], swarmAt: null, swarmOffAt: null, lastLost: -Infinity,
    },
    seal: null, fusionAt: null, drifted: false, later: [],
    score: { ticked: 0, bricks: 0, pips: 0, combo: 0, rush: 0, clean: 0, charge: 0, mend: 0, flourishSent: 0, skillSent: 0 },
    corona: coronaOf(s),
  };
  emit(st, "moment", { id: st.moment, t: 0 });
  setPrompt(st, NONE, 0);
  if (o.card !== true) emit(st, "caption", { id: "egg.now", dir: null, t: 0 });
  for (let k = 0; k < O.surgeBeats; k++) later(st, ob[k], "sfx", { id: "egg.surge", at: ob[k], pitch: 1 + 0.12 * k, gain: 0.7 });
  note(st, FACTS, TEXT);
  return st;
}

// ---- small helpers

function later(st, t, name, data) {
  st.later.push({ t, name, data });
  st.later.sort((a, b) => a.t - b.t);
}

function due(st, b) {
  while (st.later.length && st.later[0].t < b - 1e-12) {
    const x = st.later.shift();
    emit(st, x.name, { ...x.data, t: x.t });
  }
}

function setPrompt(st, p, t) {
  if (st.prompt === p) return;
  st.prompt = p;
  emit(st, "prompt", { ...p, t: fin(t) ? t : st.t });
}

const fact = (st, id, t) => emit(st, "fact", { id, where: "caption", t: fin(t) ? t : st.t });
const line = (st, id) => emit(st, "caption", { id, dir: null });
const sfx = (st, id, pitch = 1, gain = 1, x = 0, y = 0) => emit(st, "sfx", { id, pitch, gain, x, y });
// A small shake (the world's juice; at most 3 px on screen, none with reduced motion: the renderer's rule).
const jolt = (st, k) => { const J = st.A.juice; J.shake = Math.min(1, J.shake + k); };

// Sub-goal events at an exact time (goals.js stamps them with state.t).
function at(st, t, f) {
  const keep = st.t;
  st.t = t;
  try { f(); } finally { st.t = keep; }
}

const curHalf = (st) => {
  const G = st.guard;
  return G.fx.wide > st.A.t ? (st.assist ? UP.wideAssistDeg : UP.wideDeg) * RAD : G.half;
};
const slowK = (st) => (st.guard.fx.slow > st.A.t ? UP.slowK : 1);

// Is the arc over a head at angle theta, distance r? (v1: within the half-width and within 22 u)
function over(st, theta, r) {
  const G = st.guard;
  return G.arc.live && r <= AR.reach + 1e-9 && angDist(theta, G.arc.a) <= curHalf(st) + 1e-9;
}

// ---- the moments

function endTime(st) {
  switch (st.moment) {
    case "surge": return st.ob[O.surgeBeats - 1];
    case "open": return st.ob[O.burstBeat - 1];
    case "sweep": return st.mStart + O.sweepS;
    case "guard": return st.guard.enterAt !== null ? st.guard.enterAt : Infinity;
    case "enter": return st.mStart + T.enterS;
    case "seal": return st.seal && st.seal.sealAt !== null ? st.seal.sealAt : st.mStart + SL.autoS;
    case "fusion": return st.mStart + FU.s;
    case "outro": return st.mStart + T.outroS;
    default: return st.mStart;
  }
}

function startMoment(st, i, t) {
  const id = ORDER[i];
  st.mi = i;
  st.moment = id;
  st.mStart = t;
  emit(st, "moment", { id, t });
  const G = st.guard, A = st.A;
  switch (id) {
    case "open": setPrompt(st, NONE, t); break;
    case "sweep":
      fact(st, "egg.fimbriae", t);
      break;
    case "guard":
      G.t0 = t;
      G.w0 = A.t;
      G.serveAt = A.t + BL.firstS;
      setPrompt(st, st.wentOn ? NONE : P_GUARD, t);
      at(st, t, () => subgoal(st, "guard", "egg.guardGoal"));
      break;
    case "enter": setPrompt(st, NONE, t); break;
    case "seal":
      st.seal = { prompt: t, sealAt: null, auto: false };
      if (st.wentOn) { setPrompt(st, NONE, t); sealNow(st, t, true); break; }
      setPrompt(st, P_SEAL, t);
      at(st, t, () => subgoal(st, "seal", "egg.sealGoal"));
      break;
    case "fusion":
      st.fusionAt = t;
      setPrompt(st, NONE, t);
      fact(st, "egg.block", t);           // after "Your shell seals.", in the 5 s before the stage ends
      emit(st, "sfx", { id: "egg.fifth", at: t, pitch: 1, gain: 0.8, t });
      break;
    case "outro": break;
  }
}

function endMoment(st, t) {
  switch (st.moment) {
    case "open":
      emit(st, "caption", { id: "egg.opens", dir: null, t });
      emit(st, "sfx", { id: "egg.burst", at: t, pitch: 1, gain: 1, t });
      break;
    case "guard": settleEntry(st, t); break;
    case "seal": if (st.seal && st.seal.sealAt === null) sealNow(st, t, true); break;
    case "fusion": fertilize(st, t); break;
  }
}

function advance(st, t) {
  endMoment(st, t);
  if (st.mi >= ORDER.length - 1) { finish(st, st.koed ? "ko" : "end"); return; }
  startMoment(st, st.mi + 1, t);
}

function fertilize(st, t) {
  if (st.fertilized) return;
  st.fertilized = true;
  emit(st, "milestone", { id: "fertilized", t });
}

// ---- the score

function bricksPart(st) {
  const G = st.guard;
  if (!G.came) return 0;
  return Math.round(SC.bricks * Math.min(1, G.hits / (SC.bricksShare * G.came)));
}
const comboPart = (st) => Math.round(SC.combo * Math.min(1, st.guard.bestCombo / SC.comboFull));

// The bricks part ticks to the HUD with each hit (its share of the 116 planned hits); the rest comes at the end. A
// rival's points pop once, as it drifts off (so the pops stay few).
function tick(st, b) {
  const G = st.guard, S = st.score;
  if (st.koed) return 0;
  const want = Math.min(SC.bricks, Math.round(G.hits * PER_HIT));
  const add = want - S.ticked;
  if (add <= 0) return 0;
  S.ticked = want;
  S.skillSent += add;
  emit(st, "points", { part: "skill", add });
  if (b) b.pts = (b.pts || 0) + add;
  return add;
}

function skillNow(st) {
  const S = st.score;
  return Math.max(S.ticked, bricksPart(st)) + comboPart(st) + S.pips + S.rush;
}
const flourishNow = (st) => Math.min(PARTS.flourish, st.score.clean + st.score.charge + st.score.mend);

// ---- the end

function settleSubgoals(st, how) {
  for (const [id, s] of Object.entries(st.subgoals)) {
    if (s !== "shown") continue;
    const auto = id === "guard" && how === "ko" ? "egg.rest" : "egg." + id + "Auto";
    doneBy(st, id, "auto", auto);
  }
}

// The Skill and Flourish not yet sent (the bricks part's rest, the chain), so the points events add up to the result.
function sendRest(st) {
  const S = st.score;
  const skill = skillNow(st) - S.skillSent;
  if (skill > 0) { S.skillSent += skill; emit(st, "points", { part: "skill", add: skill }); }
  const fl = flourishNow(st) - S.flourishSent;
  if (fl > 0) { S.flourishSent += fl; emit(st, "points", { part: "flourish", add: fl }); }
}

function finish(st, how) {
  if (st.done) return;
  st.done = true;
  st.doneAt = st.t;
  st.how = st.capped ? "cap" : how;
  if (how === "ko") {
    // the knock-out: Goal 0, the Skill and Flourish it had (after Go on it has finished playing out)
    st.goalMet = false;
    if (!st.wentOn) { sendRest(st); st.koScore = { skill: skillNow(st), flourish: flourishNow(st) }; }
    else if (!st.fertilized) fertilize(st, st.t);
    settleSubgoals(st, "ko");
  } else {
    if (!st.fertilized) fertilize(st, st.t);
    settleSubgoals(st, how);
    sendRest(st);
    st.goalMet = true;
    emit(st, "points", { part: "goal", add: PARTS.goal });
  }
  st.later = [];
  setPrompt(st, NONE);
  emit(st, "done", {});
}

// The cap (or an error): every moment left ends now, by itself.
function forceEnd(st) {
  if (st.phase === "ko" && !st.wentOn) { finish(st, "ko"); return; }
  for (let k = 0; k < ORDER.length + 2 && !st.done; k++) advance(st, st.t);
  st.done = true;
}

// ---- rivals (the bricks)

function liveCount(G) {
  let n = 0;
  for (const b of G.bricks) if (LIVE.has(b.state)) n++;
  return n;
}

function slotAngle(b) { return b.form.ang + b.off; }

// One formation from its spec: a ring, two opposite arcs or one member orbiting; its members join the queue.
function makeForm(st, spec, swarm) {
  const G = st.guard, A = st.A;
  const F = { kind: spec.kind, R: spec.R, w: spec.w, ang: st.rng.form() * TAU, reform: !!spec.reform, swarm, members: [] };
  const n = spec.kinds.length;
  for (let i = 0; i < n; i++) {
    let off;
    if (spec.kind === "arcs") {
      const h = Math.ceil(n / 2), side = i < h ? 0 : 1, j = side ? i - h : i, m = side ? n - h : h;
      off = side * Math.PI + (j - (m - 1) / 2) * spec.spreadDeg * RAD;
    } else off = (TAU * i) / n;
    const gun = spec.guns && spec.guns[i] ? spec.guns[i] : null;
    G.queue.push({ at: A.t + i * BR.stagger, form: F, off, kind: KINDS[spec.kinds[i]], gun, swarm, idx: i });
  }
  G.forms.push(F);
  return F;
}

function spawnQueued(st) {
  const G = st.guard, A = st.A;
  let live = liveCount(G);
  while (G.queue.length && G.queue[0].at <= A.t + 1e-9 && live < BR.cap) {
    const q = G.queue.shift();
    const b = newBrick(st, q);
    q.form.members.push(b);
    live++;
  }
}

function newBrick(st, q) {
  const G = st.guard, A = st.A;
  const hits = BR.hits[q.kind];
  const th = q.form.ang + q.off, r0 = q.form.R + BR.inFrom;
  const b = {
    id: "r" + G.nextId, n: G.nextId++, kind: q.kind, hits, hitsMax: hits, form: q.form, off: q.off, offFrom: 0, offTo: 0,
    offT0: null, state: "in", x: r0 * Math.cos(th), y: r0 * Math.sin(th), theta: th, r: r0, born: A.t,
    gx0: r0 * Math.cos(th), gy0: r0 * Math.sin(th), gt0: A.t, gs: BR.inS,
    gun: gunOf(q.gun), wind: 0, flash: 0, kick: 0, swarm: !!q.swarm, rush: false, crack: false,
    p: 0, hk: 0, vx: 0, vy: 0, v: 0, dir: 1, credit: null, settle: null, near: null, tellT0: null, idx: q.idx,
  };
  G.bricks.push(b);
  G.came += hits;
  G.bricksCame++;
  return b;
}

// A formation member's gun from its spec: a pattern name, or "aimed:j" for the swarm's j-th shooter in turn.
function gunOf(spec) {
  if (!spec) return null;
  const m = /^aimed:(\d+)$/.exec(String(spec));
  if (!m) return newGun(spec);
  const j = Number(m[1]), n = SW.p1.shooters.length;
  const g = newGun("aimed", FI.aimed.first + SW.p1.every * j);
  g.every = SW.p1.every * n;
  return g;
}

function newGun(kind, cool) {
  const P = FI[kind];
  return { kind, cool: fin(cool) ? cool : P.first, told: false, bn: 0, bt: 0, once: false };
}

// Leave the formation (a dive, a drift-off): a re-forming ring spreads its others out over 2 s to close the gap.
function leaveForm(st, b) {
  const F = b.form;
  if (!F) return;
  const i = F.members.indexOf(b);
  if (i >= 0) F.members.splice(i, 1);
  b.form = null;
  if (!F.reform || !F.members.length) return;
  const A = st.A, n = F.members.length;
  const o0 = F.members.reduce((m, x) => (x.off < m.off ? x : m), F.members[0]).off;
  const rel = F.members.map((x) => ({ x, d: ((x.off - o0) % TAU + TAU) % TAU })).sort((p, q) => p.d - q.d);
  rel.forEach(({ x, d }, j) => { x.offFrom = o0 + d; x.off = x.offFrom; x.offTo = o0 + (TAU * j) / n; x.offT0 = A.t; });
}

// A member's place: its slot on its turning formation, while it glides in (or to a new ring) from where it was.
function placeMember(st, b) {
  const A = st.A, F = b.form;
  if (b.offT0 !== null) {
    const p = clamp01((A.t - b.offT0) / BR.reformS);
    b.off = b.offFrom + (b.offTo - b.offFrom) * p;
    if (p >= 1) b.offT0 = null;
  }
  const th = F.ang + b.off;
  let x = F.R * Math.cos(th), y = F.R * Math.sin(th);
  if (b.gt0 !== null) {
    const p = clamp01((A.t - b.gt0) / b.gs), e = smooth(p);
    x = b.gx0 + (x - b.gx0) * e;
    y = b.gy0 + (y - b.gy0) * e;
    if (p >= 1) { b.gt0 = null; if (b.state === "in") b.state = "form"; }
  }
  b.x = x; b.y = y; b.r = Math.hypot(x, y); b.theta = Math.atan2(y, x);
}

function glideTo(st, b, F, off, s) {
  b.form = F; b.off = off; b.offT0 = null;
  b.gx0 = b.x; b.gy0 = b.y; b.gt0 = st.A.t; b.gs = s;
  F.members.push(b);
}

// A rival with no hits left (or bounced by the arc, or popped loose) drifts off: v1's bounce outward.
function driftOff(st, b, how) {
  const G = st.guard, A = st.A;
  if (!LIVE.has(b.state)) return;
  leaveForm(st, b);
  const wasStuck = b.state === "stuck";
  const h = b.theta + (2 * st.rng.bounce() - 1) * (wasStuck ? SK.looseSpreadDeg : BO.spreadDeg) * RAD;
  const sp = wasStuck ? SK.looseSpeed : BO.speed;
  b.state = how === "loose" ? "loose" : "off";
  b.vx = sp * Math.cos(h); b.vy = sp * Math.sin(h);
  b.gun = null; b.wind = 0; b.hits = 0;
  b.settle = A.t;
  b.credit = how === "loose" ? T.credit.loose : T.credit.bounce;
  if (how === "loose") G.popped++; else G.bounced++;
  if (b.rush) { G.rushN[how === "loose" ? "loose" : "bounce"]++; }
  G.offs++;
  X.burst(A, b.x, b.y, 2.2, 0);
  if (b.pts > 0 && how !== "swarm") X.pop(A, b.x, b.y, b.pts, G.combo);
  if (how !== "swarm") jolt(st, 0.07);
  if (how === "loose") emit(st, "loose", { id: b.id });
  else emit(st, "bounce", { id: b.id, angle: b.theta, wave: Math.max(1, Math.min(8, G.combo || 1)) });
  if (how === "arc") G.rip.push({ x: AR.r * Math.cos(b.theta), y: AR.r * Math.sin(b.theta), t: A.t });
  if (!G.waving) addCharge(st, CH.perOff);             // the seal wave's own drift-offs do not fill the next charge
  if (!b.rush && how !== "swarm") dropUp(st, b);
}

// A hit off a rival (a glow, one of your sparks, the seal wave): its dots go down, the chain grows, the HUD ticks.
function hitBrick(st, b, by) {
  const G = st.guard, A = st.A;
  if (b.hits <= 0 || !LIVE.has(b.state)) return;
  b.hits--;
  b.flash = 1;
  b.kick = 1;
  if (b.kind === "capped") b.crack = true;
  if (!b.rush) G.hits++;
  G.combo = G.comboT > 0 ? G.combo + 1 : 1;
  G.comboT = T.combo.s;
  G.bestCombo = Math.max(G.bestCombo, G.combo);
  tick(st, b);
  sfx(st, "act.strike", 1, 0.8, b.x, b.y);
  if (b.hits <= 0) { driftOff(st, b, by); return; }
  if (b.state === "dive") { b.r = Math.min(b.r + 3, 60); setPolar(b); }
}

// Every hit a rival still has is taken at once (the arc bounces a diver, or pops a stuck one loose).
function takeAll(st, b, how) {
  const G = st.guard;
  if (!b.rush) { G.hits += b.hits; tick(st, b); }
  driftOff(st, b, how);
}

function setPolar(b) {
  b.x = b.r * Math.cos(b.theta);
  b.y = b.r * Math.sin(b.theta);
}

// A diver (or a rush rival) swims in: the arc bounces it; at the shell it sticks and burrows; the arc pops a stuck one
// loose; one that finishes is held, still, in the cloud (a pip), and never enters.
function moveDiver(st, b, dts) {
  const G = st.guard, A = st.A;
  switch (b.state) {
    case "tell":
      if (A.t - b.tellT0 >= DV.tellS) { b.state = "dive"; b.v = DV.speed; }
      return;
    case "dive":
      b.r -= b.v * dts;
      b.theta = wrapAngle(b.theta + DV.swirl * b.dir * dts * (b.rush ? 0 : 1));
      if (b.near === null && b.r <= AR.reach + 1e-9) b.near = A.t;
      if (over(st, b.theta, b.r)) { setPolar(b); takeAll(st, b, "arc"); return; }
      if (b.r <= SK.r) {
        b.r = SK.r;
        b.state = "stuck";
        b.p = 0;
        emit(st, "stick", { id: b.id, angle: b.theta, gold: false });
      }
      setPolar(b);
      return;
    case "stuck":
      if (over(st, b.theta, b.r)) { takeAll(st, b, "loose"); return; }
      b.p += dts / (st.assist ? SK.burrowAssistS : SK.burrowS);
      if (b.p >= 1) {
        b.p = 1;
        b.state = "held";
        b.hk = 0;
        b.settle = A.t;
        b.credit = T.credit.held;
        b.gun = null;
        G.held++;
        if (b.rush) G.rushN.held++;
        emit(st, "held", { id: b.id });
        if (!st.koed && st.moment === "guard") X.hitPlayer(st.A, 1, "held", b.x, b.y);
      }
      return;
    case "held":
      b.hk = Math.min(1, b.hk + dts / HE.moveS);
      b.r = SK.r + (HE.r - SK.r) * (1 - (1 - b.hk) * (1 - b.hk));
      setPolar(b);
      return;
    default: // off, loose: drift outward and leave past 80 u
      b.x += b.vx * dts;
      b.y += b.vy * dts;
      b.r = Math.hypot(b.x, b.y);
      b.theta = Math.atan2(b.y, b.x);
      if (b.r > FL.removeR) b.state = "gone";
  }
}

// ---- patterns: enzyme sparks with telegraphs (design.md 5.2), through the action layer's foe bullets

function sparkPat(st, kind, speed, n, extra = {}) {
  const sp = Math.min(speed, FI.maxSpeed);
  const v = Math.max(1, sp * st.A.bulletK);
  return { kind, n, speed: sp, r: FI.r, tone: "foe", life: (FL.sparkOut + 50) / v, ...extra };
}

// A tell that follows its rival (or stays put: b null) for dur world seconds.
function tellFor(st, b, kind, dur, extra = {}) {
  const A = st.A, k = slowK(st);
  const d = Math.max(FI.tellS, dur) / k;
  let spec;
  const toC = b ? Math.atan2(-b.y, -b.x) : 0;
  switch (kind) {
    case "aimed": spec = { kind: "line", x: b.x, y: b.y, ang: toC, len: Math.max(4, b.r - FL.shell), w: 1.2, dur: d }; break;
    case "fan": spec = { kind: "fan", x: b.x, y: b.y, ang: toC, r: Math.max(6, b.r - FL.shell), w: FI.fan.arcDeg * RAD + 0.08, dur: d }; break;
    case "ring": spec = { kind: "ring", x: b.x, y: b.y, r: 7, dur: d }; break;
    case "curtain": spec = { kind: "fan", x: 0, y: 0, ang: extra.ang, r: FI.curtain.from, w: (2 * FI.curtain.arcDeg + 5) * RAD, dur: d }; break;
    case "dive": spec = { kind: "line", x: b.x, y: b.y, ang: toC, len: Math.max(4, b.r - FL.shell), w: 1.6, dur: d }; break;
    default: spec = { kind: "spot", x: extra.x || 0, y: extra.y || 0, r: extra.r || 4, dur: d };
  }
  const tl = X.addTell(A, spec);
  if (b) st.guard.tellOf.push({ tl, b, kind });
  return tl;
}

// The tells that follow a rival move with it (the formation turns); one whose rival left goes.
function moveTells(st) {
  const G = st.guard, A = st.A;
  G.tellOf = G.tellOf.filter((x) => {
    if (!A.tells.includes(x.tl)) return false;
    if (!HITTABLE.has(x.b.state)) { const i = A.tells.indexOf(x.tl); if (i >= 0) A.tells.splice(i, 1); return false; }
    x.tl.x = x.b.x; x.tl.y = x.b.y;
    if (x.kind !== "ring") { x.tl.ang = Math.atan2(-x.b.y, -x.b.x); if (x.kind !== "fan") x.tl.len = Math.max(4, x.b.r - FL.shell); }
    return true;
  });
}

// A pattern from rival b (→ sparks made, or −1 when it must wait: the cap).
function firePattern(st, b, kind) {
  const A = st.A;
  const toC = Math.atan2(-b.y, -b.x);
  switch (kind) {
    case "aimed": return X.shoot(A, b.x, b.y, sparkPat(st, "aimed", FI.aimed.speed, 1), toC);
    case "fan": return X.shoot(A, b.x, b.y, sparkPat(st, "fan", FI.fan.speed, FI.fan.n, { arc: FI.fan.arcDeg * RAD }), toC);
    case "ring": {
      // one or two of the ring cross the shell: one spark aims near the centre
      const step = TAU / FI.ring.n;
      return X.shoot(A, b.x, b.y, sparkPat(st, "ring", FI.ring.speed, FI.ring.n), toC + (st.rng.fire() - 0.5) * step);
    }
    case "curtain": return curtain(st, b.theta);
    default: return 0;
  }
}

// A curtain: 5 sparks across one sector, 12° apart, closing in from 45 u.
function curtain(st, thc) {
  const A = st.A, C = FI.curtain;
  if (X.foeBullets(A) + C.n > A.bulletCap) return -1;
  const sp = Math.min(C.speed, FI.maxSpeed) * A.bulletK;
  let made = 0;
  for (let j = 0; j < C.n; j++) {
    const th = thc + (j - (C.n - 1) / 2) * C.arcDeg * RAD;
    const c = Math.cos(th), s = Math.sin(th);
    if (X.addBullet(A, 2, C.from * c, C.from * s, -c * sp, -s * sp, { r: FI.r, tone: "foe", life: (C.from + 30) / Math.max(1, sp) }) >= 0) made++;
  }
  if (made) emit(st, "sfx", { id: "act.fire", x: C.from * Math.cos(thc), y: C.from * Math.sin(thc) });
  return made;
}

// A rival's gun: its tell, then its pattern; an aimed stream is 3 sparks 0.15 s apart. A gun waits for the cap, a
// swarm phase's pause, and the calm after the swarm.
function gunStep(st, b, dts) {
  const g = b.gun, G = st.guard, A = st.A;
  if (!g) return;
  if (b.state !== "form" || G.calm) { b.wind = 0; return; }
  if (g.bn > 0) {
    g.bt -= dts;
    if (g.bt <= 0) {
      if (firePattern(st, b, "aimed") >= 0) { g.bn--; g.bt += FI.aimed.gapS; } else g.bt = 0;
      if (g.bn <= 0 && g.once) b.gun = null;
    }
    return;
  }
  g.cool -= dts;
  if (g.cool <= FI.tellS && !g.told) { g.told = true; tellFor(st, b, g.kind, Math.max(DT, g.cool)); }
  b.wind = g.told ? clamp01(1 - g.cool / FI.tellS) : 0;
  if (g.cool > 0) return;
  if (G.swarm && G.swarm.pauseUntil > A.t) { g.cool = 0; return; }
  const made = firePattern(st, b, g.kind);
  if (made < 0) { g.cool = 0; return; }                      // the cap: it waits, its tell kept
  g.told = false;
  b.wind = 0;
  if (g.kind === "aimed") { g.bn = FI.aimed.n - 1; g.bt = FI.aimed.gapS; }
  if (g.once && g.bn <= 0) { b.gun = null; return; }
  const P = FI[g.kind];
  const every = g.every || P.every;
  g.cool += (every * (1 + FI.jitter * (2 * st.rng.fire() - 1))) / (st.assist ? FI.rateAssistK : 1);
}

// ---- the waves and the swarm

function startWave(st, k) {
  const G = st.guard, A = st.A, W = T.waves[k];
  G.wi = k + 1;
  G.lastWave = A.t - G.w0;
  G.waves.push(G.lastWave);
  for (const f of W.forms) makeForm(st, f, false);
  G.diveEvery = W.dive;
  G.diveAt = W.dive > 0 ? A.t + W.dive : Infinity;
  if (W.fact) fact(st, W.fact);
}

function startSwarm(st) {
  const G = st.guard, A = st.A;
  G.wi = T.waves.length + 1;
  G.lastWave = A.t - G.w0;
  G.swarmAt = G.lastWave;
  const F = makeForm(st, { kind: "ring", R: SW.R, w: SW.w, kinds: SW.kinds, guns: {} }, true);
  G.swarm = { t0: A.t, F, phase: 1, hitsMax: hitsOf(SW.kinds), pauseUntil: 0, curtainT: 0, curtainN: 0, curtainBase: 0,
    aimT: 0, aimI: 0, streamOn: false, streamT: 0, streamAng: 0, streamGap: 0, streamDir: 1, told: false, off: false };
  // phase 1: 4 shooters round it fire aimed streams in turn, one every 1.2 s
  G.queue.forEach((q) => {
    if (q.form !== F) return;
    const j = SW.p1.shooters.indexOf(q.idx);
    if (j >= 0) q.gun = "aimed:" + j;
  });
  G.diveEvery = 0;
  G.diveAt = Infinity;
  A.bossBar = { hp: 1, phase: 0 };
  line(st, "egg.swarm");
  sfx(st, "act.phase", 1, 0.8);
}

function swarmHitsLeft(st) {
  const G = st.guard;
  let n = 0;
  for (const b of G.bricks) if (b.swarm && LIVE.has(b.state)) n += b.hits;
  for (const q of G.queue) if (q.swarm) n += BR.hits[q.kind];
  return n;
}

function swarmMembers(st) {
  const G = st.guard;
  let n = G.queue.filter((q) => q.swarm).length;
  for (const b of G.bricks) if (b.swarm && LIVE.has(b.state) && b.state !== "stuck") n++;
  return n;
}

// A phase change: a ring tell, the world holds for 8 frames, a low chord, 0.8 s with no new sparks, and the members
// left glide to their new rings.
function swarmPhase(st, ph) {
  const G = st.guard, A = st.A, S = G.swarm;
  S.phase = ph;
  S.pauseUntil = A.t + SW.pauseS;
  X.hitStop(A, A.juiceK.stopPhase);
  jolt(st, 0.55);
  X.addTell(A, { kind: "ring", x: 0, y: 0, r: S.F.R, dur: SW.pauseS });
  sfx(st, "act.phase", 1, 1);
  A.bossBar = { hp: A.bossBar ? A.bossBar.hp : 1, phase: ph - 1 };
  const left = G.bricks.filter((b) => b.swarm && (b.state === "form" || b.state === "in"));
  for (const b of left) { leaveForm(st, b); b.gun = null; b.wind = 0; if (b.state === "in") b.state = "form"; }
  if (ph === 2) {
    const inner = { kind: "ring", R: SW.p2.R[0], w: SW.p2.w, ang: S.F.ang, reform: true, swarm: true, members: [] };
    const outer = { kind: "ring", R: SW.p2.R[1], w: -SW.p2.w, ang: S.F.ang + 0.3, reform: true, swarm: true, members: [] };
    G.forms.push(inner, outer);
    const ins = left.filter((_, i) => i % 2 === 0), outs = left.filter((_, i) => i % 2 === 1);
    ins.forEach((b, j) => glideTo(st, b, inner, (TAU * j) / Math.max(1, ins.length), SW.shiftS));
    // 2 spinners in the outer ring, opposite each other, sending rings in turn
    const spin = new Set();
    for (let k = 0; k < Math.min(SW.p2.spinners, outs.length); k++) spin.add(Math.floor((k * outs.length) / SW.p2.spinners));
    outs.forEach((b, j) => {
      glideTo(st, b, outer, (TAU * j) / Math.max(1, outs.length), SW.shiftS);
      if (!spin.has(j)) return;
      b.gun = newGun("ring", SW.pauseS + SW.shiftS + 0.6 + (SW.p2.ringEvery / 2) * [...spin].indexOf(j));
      b.gun.every = SW.p2.ringEvery;
    });
    S.F = outer;
    S.curtainT = SW.pauseS + 0.8;
    G.diveEvery = SW.p2.dive;
    G.diveAt = A.t + SW.pauseS + SW.p2.dive;
  } else {
    const one = { kind: "ring", R: SW.p3.R, w: SW.p3.w, ang: S.F.ang, reform: true, swarm: true, members: [] };
    G.forms.push(one);
    left.forEach((b, j) => glideTo(st, b, one, (TAU * j) / Math.max(1, left.length), SW.shiftS));
    S.F = one;
    S.aimT = SW.pauseS + 1.2;
    S.streamOn = false;
    S.streamT = SW.pauseS + SW.shiftS;
    S.told = false;
    G.diveEvery = SW.p3.dive;
    G.diveAt = A.t + SW.pauseS + SW.p3.dive;
  }
}

// The members nearest an angle (for the turning stream) and in turn (for phase 3's aimed streams).
function swarmNearest(st, ang) {
  let best = null, bd = Infinity;
  for (const b of st.guard.bricks) {
    if (!b.swarm || b.state !== "form") continue;
    const d = angDist(b.theta, ang);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function swarmStep(st, dts) {
  const G = st.guard, A = st.A, S = G.swarm;
  if (!S || S.off) return;
  const left = swarmHitsLeft(st);
  const gone = S.hitsMax - left;
  A.bossBar = { hp: clamp01(left / S.hitsMax), phase: S.phase - 1 };
  if (S.phase === 1 && gone >= S.hitsMax / 3 - 1e-9) swarmPhase(st, 2);
  else if (S.phase === 2 && gone >= (2 * S.hitsMax) / 3 - 1e-9) swarmPhase(st, 3);
  if ((swarmMembers(st) <= SW.leaveAt) || A.t - S.t0 >= SW.maxS - 1e-9) { swarmOff(st); return; }
  if (A.t < S.pauseUntil) return;
  if (S.phase === 2) {
    S.curtainT -= dts;
    if (S.curtainT <= FI.tellS && !S.told) {
      S.told = true;
      if (S.curtainN % 2 === 0) S.curtainBase = st.rng.fire() * TAU;
      S.curtainAng = S.curtainBase + (S.curtainN % 2) * Math.PI;
      tellFor(st, null, "curtain", Math.max(DT, S.curtainT), { ang: S.curtainAng });
    }
    if (S.curtainT <= 0) {
      if (curtain(st, S.curtainAng) >= 0) { S.curtainN++; S.told = false; S.curtainT += SW.p2.curtainEvery / (st.assist ? FI.rateAssistK : 1); }
      else S.curtainT = 0;
    }
  } else if (S.phase === 3) {
    // an aimed stream every 2 s from the members in turn
    S.aimT -= dts;
    if (S.aimT <= FI.tellS + 0.05) {
      const cands = G.bricks.filter((b) => b.swarm && b.state === "form" && !b.gun);
      if (cands.length) {
        const b = cands[S.aimI++ % cands.length];
        b.gun = newGun("aimed", Math.max(DT, S.aimT));
        b.gun.once = true;
      }
      S.aimT += SW.p3.aimedEvery / (st.assist ? FI.rateAssistK : 1);
    }
    // the turning stream: 3 s on, the arrival point turning round the shell at 50°/s, then 1.5 s of rest
    const SR = FI.stream;
    S.streamT -= dts;
    if (!S.streamOn) {
      if (S.streamT <= 0.6 && !S.told) {
        S.told = true;
        S.streamAng = st.rng.fire() * TAU;
        S.streamDir = st.rng.fire() < 0.5 ? -1 : 1;
        X.addTell(A, { kind: "ring", x: 0, y: 0, r: AR.r + 2, dur: Math.max(FI.tellS, S.streamT) / slowK(st) });
        X.addTell(A, { kind: "spot", x: FL.shell * Math.cos(S.streamAng), y: FL.shell * Math.sin(S.streamAng), r: 3,
          dur: Math.max(FI.tellS, S.streamT) / slowK(st) });
      }
      if (S.streamT <= 0) { S.streamOn = true; S.streamT += SR.onS; S.streamGap = 0; S.told = false; }
    } else {
      S.streamAng = wrapAngle(S.streamAng + S.streamDir * SR.degS * RAD * dts);
      S.streamGap -= dts;
      if (S.streamGap <= 0) {
        const b = swarmNearest(st, S.streamAng);
        if (b) {
          const tx = FL.shell * Math.cos(S.streamAng), ty = FL.shell * Math.sin(S.streamAng);
          if (X.shoot(A, b.x, b.y, sparkPat(st, "aimed", SR.speed, 1), Math.atan2(ty - b.y, tx - b.x)) >= 0) S.streamGap += SR.gapS;
          else S.streamGap = 0;
        } else S.streamGap += SR.gapS;
      }
      if (S.streamT <= 0) { S.streamOn = false; S.streamT += SR.offS; }
    }
  }
}

// The swarm drifts off: every rival still on screen goes with it, and no new spark is fired after that.
function swarmOff(st) {
  const G = st.guard, A = st.A, S = G.swarm;
  S.off = true;
  G.calm = true;
  G.swarmOffAt = A.t - G.w0;
  G.queue = [];
  for (const b of G.bricks) if (LIVE.has(b.state)) driftOff(st, b, "swarm");
  A.bossBar = null;
  G.diveEvery = 0;
  G.diveAt = Infinity;
  line(st, "egg.swarmOff");
  sfx(st, "act.win", 1, 0.9);
  jolt(st, 0.3);
  G.rushAt = st.t + RU.afterS + RU.perPlaceS * Math.max(0, (fin(st.place) ? st.place : 1) - 1);   // stage seconds
}

function wavesStep(st) {
  const G = st.guard, A = st.A;
  if (G.swarm) return;
  const gt = A.t - G.w0;
  const at = G.wi < T.waves.length ? T.waves[G.wi].at : SW.at;
  const left = liveCount(G) + G.queue.length;
  const early = G.wi > 0 && left <= BR.early && gt - G.lastWave >= BR.gapS - 1e-9;
  if (gt >= at - 1e-9 || early) {
    if (G.wi < T.waves.length) startWave(st, G.wi);
    else startSwarm(st);
  }
}

// A diver every so often: a member leaves its formation with a 0.6 s tell and swims in.
function diveStep(st) {
  const G = st.guard, A = st.A;
  if (!(G.diveEvery > 0) || G.calm || A.t < G.diveAt) return;
  const cands = G.bricks.filter((b) => b.state === "form" && !b.gun && b.form && b.form.kind !== "orbit");
  G.diveAt = A.t + G.diveEvery;
  if (!cands.length) return;
  const b = cands[Math.floor(st.rng.dive() * cands.length) % cands.length];
  leaveForm(st, b);
  b.state = "tell";
  b.tellT0 = A.t;
  b.dir = st.rng.dive() < 0.5 ? -1 : 1;
  tellFor(st, b, "dive", DV.tellS);
}

// ---- the glows (the ball)

function serve(st) {
  const G = st.guard, A = st.A;
  const a = G.arc.a, sp = st.assist ? BL.speedAssist : BL.speed;
  G.glows.push({ x: (RC + 0.05) * Math.cos(a), y: (RC + 0.05) * Math.sin(a), vx: sp * Math.cos(a), vy: sp * Math.sin(a),
    s: sp, met: A.t, lost: false, stale: false, fadeAt: null, in: null });
  G.serveAt = null;
  sfx(st, "egg.pluck", 1.1, 0.6, (RC) * Math.cos(a), RC * Math.sin(a));
}

function liveGlows(G) { return G.glows.filter((g) => !g.lost && !g.stale); }

// Off the arc: out along the radius at the hit point, turned by k × 55° (k the hit's offset over the half-width).
function arcReturn(st, g, phi, d) {
  const G = st.guard, A = st.A;
  const k = clamp(d / curHalf(st), -1, 1);
  const out = phi + k * BL.retDeg * RAD;
  g.s = Math.min(st.assist ? BL.maxAssist : BL.max, g.s + BL.gain);
  g.vx = g.s * Math.cos(out); g.vy = g.s * Math.sin(out);
  g.x = (RC + 0.02) * Math.cos(phi); g.y = (RC + 0.02) * Math.sin(phi);
  g.met = A.t;
  g.k = k;
  G.returns++;
  G.rip.push({ x: AR.r * Math.cos(phi), y: AR.r * Math.sin(phi), t: A.t });
  sfx(st, "egg.pluck", 1 + 0.12 * k, 0.55, g.x, g.y);
}

// Off the rim: the mirror bounce, turned if needed so it heads within 14° of the egg's centre.
function rimBounce(st, g) {
  const r = Math.hypot(g.x, g.y) || 1, nx = g.x / r, ny = g.y / r;
  const vn = g.vx * nx + g.vy * ny;
  let vx = g.vx - 2 * vn * nx, vy = g.vy - 2 * vn * ny;
  const inA = Math.atan2(-ny, -nx);
  let rel = wrapAngle(Math.atan2(vy, vx) - inA);
  const lim = (st.assist ? BL.rimAssistDeg : BL.rimDeg) * RAD;
  if (Math.abs(rel) > lim) {
    rel = Math.sign(rel) * lim;
    vx = g.s * Math.cos(inA + rel); vy = g.s * Math.sin(inA + rel);
  }
  g.vx = vx; g.vy = vy;
  g.x = nx * (RIM - 0.02); g.y = ny * (RIM - 0.02);
}

function moveGlow(st, g, dts) {
  const G = st.guard, A = st.A;
  const n = Math.max(1, Math.ceil((g.s * dts) / 0.6));
  const h = dts / n;
  const pierce = G.fx.pierce > A.t;
  for (let i = 0; i < n; i++) {
    g.x += g.vx * h; g.y += g.vy * h;
    const r = Math.hypot(g.x, g.y);
    const inward = g.x * g.vx + g.y * g.vy < 0;
    if (g.lost) { if (r <= FL.shell) { g.vx = 0; g.vy = 0; } continue; }
    if (!inward && r >= RIM) { rimBounce(st, g); continue; }
    if (inward && r <= RC && r >= RL) {
      const phi = Math.atan2(g.y, g.x), d = wrapAngle(phi - G.arc.a);
      if (G.arc.live && Math.abs(d) <= curHalf(st) + BL.r / RC) { arcReturn(st, g, phi, d); continue; }
    }
    if (inward && r < RL) { loseGlow(st, g); continue; }
    // the rivals' heads
    let touching = null;
    for (const b of G.bricks) {
      if (!HITTABLE.has(b.state) || b.hits <= 0) continue;
      const dx = g.x - b.x, dy = g.y - b.y, rr = BR.headR + BL.r;
      if (dx * dx + dy * dy >= rr * rr) continue;
      touching = b;
      if (g.in === b.id) break;
      g.in = b.id;
      if (!pierce) {
        const d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d;
        const vn = g.vx * nx + g.vy * ny;
        if (vn < 0) { g.vx -= 2 * vn * nx; g.vy -= 2 * vn * ny; }
        g.x = b.x + nx * (rr + 0.02); g.y = b.y + ny * (rr + 0.02);
      }
      hitBrick(st, b, "hit");
      break;
    }
    if (!touching) g.in = null;
  }
  if (!g.lost && !g.stale && A.t - g.met >= BL.staleS - 1e-9) {
    // a glow that has not met the arc for 10 s fades, and serves again with no pip lost
    g.stale = true;
    g.fadeAt = A.t;
    G.stale++;
    if (!liveGlows(G).length && G.serveAt === null) G.serveAt = A.t + BL.serveS;
  }
}

// A glow slipped by the arc: it fades into the shell. The last one lost costs a pip; a new one serves 1.0 s later.
function loseGlow(st, g) {
  const G = st.guard, A = st.A;
  g.lost = true;
  g.fadeAt = A.t;
  G.lost++;
  if (liveGlows(G).length) return;
  G.combo = 0;
  G.comboT = 0;
  G.lastLost = A.t;
  if (!st.koed) X.hitPlayer(A, 1, "glow", g.x * 2, g.y * 2);
  if (G.serveAt === null) G.serveAt = A.t + BL.serveS;
}

function glowsStep(st, dts) {
  const G = st.guard, A = st.A;
  for (const g of G.glows) moveGlow(st, g, dts);
  G.glows = G.glows.filter((g) => g.fadeAt === null || A.t - g.fadeAt < BL.fadeS + (g.lost ? 0.25 : 0));
  // the first serve: when the arc wakes, or 3 s into the guard
  if (G.first && G.arc.live && G.arc.wokeAt !== null) {
    G.first = false;
    G.serveAt = Math.min(G.serveAt === null ? Infinity : G.serveAt, G.arc.wokeAt + BL.wakeS);
  }
  if (G.serveAt !== null && A.t >= G.serveAt - 1e-9 && !G.calmGlow) {
    if (liveGlows(G).length < BL.n) serve(st);
    else G.serveAt = null;
    G.first = false;
  }
}

// Multi: every glow splits into 3, ±20° apart (6 at most).
function multi(st) {
  const G = st.guard;
  const base = liveGlows(G);
  for (const g of base) {
    for (const s of [-1, 1]) {
      if (liveGlows(G).length >= BL.n) return;
      const a = Math.atan2(g.vy, g.vx) + s * UP.multiDeg * RAD;
      G.glows.push({ x: g.x, y: g.y, vx: g.s * Math.cos(a), vy: g.s * Math.sin(a), s: g.s, met: g.met, lost: false, stale: false, fadeAt: null, in: g.in });
    }
  }
}

// ---- your sparks: blocked enzyme sparks turned back

function blockStep(st) {
  const G = st.guard, A = st.A, B = A.b;
  const half = curHalf(st);
  const hit = [];
  for (let i = 0; i < B.n; i++) {
    if (B.side[i] !== 2) continue;
    const x = B.x[i], y = B.y[i];
    const r = Math.hypot(x, y);
    if (r > RS || r < RSI) continue;
    if (x * B.vx[i] + y * B.vy[i] >= 0) continue;
    if (!G.arc.live) continue;
    const phi = Math.atan2(y, x);
    if (angDist(phi, G.arc.a) > half + FI.r / RS) continue;
    hit.push(x, y, B.vx[i], B.vy[i]);
  }
  for (let j = 0; j < hit.length; j += 4) {
    const x = hit[j], y = hit[j + 1], vx = hit[j + 2], vy = hit[j + 3];
    X.clearBullets(A, 2, x, y, 0.02);
    const r = Math.hypot(x, y) || 1, nx = x / r, ny = y / r;
    const vn = vx * nx + vy * ny;
    const k = FI.blockK / slowK(st);                     // its own speed again, then 1.3 times
    G.mine.push({ x: nx * (RS + 0.05), y: ny * (RS + 0.05), vx: (vx - 2 * vn * nx) * k, vy: (vy - 2 * vn * ny) * k, age: 0 });
    G.blocked++;
    G.rip.push({ x: AR.r * nx, y: AR.r * ny, t: A.t });
    addCharge(st, CH.perBlock);
    sfx(st, "act.shot", 1, 1, x, y);
  }
  // a spark that reached the shell while it could not be hit (i-frames, the seal) fades into it
  X.clearBullets(A, 2, 0, 0, FL.shell - 0.3);
}

function mineStep(st, dts) {
  const G = st.guard;
  G.mine = G.mine.filter((m) => {
    m.x += m.vx * dts; m.y += m.vy * dts; m.age += dts;
    if (Math.hypot(m.x, m.y) >= FL.rim) return false;
    for (const b of G.bricks) {
      if (!HITTABLE.has(b.state) || b.hits <= 0) continue;
      const dx = m.x - b.x, dy = m.y - b.y, rr = BR.headR + 1.1;
      if (dx * dx + dy * dy < rr * rr) { G.mineHits++; hitBrick(st, b, "hit"); return false; }
    }
    return true;
  });
}

// ---- gifts (power-ups)

function dropUp(st, b) {
  const G = st.guard;
  G.sinceUp++;
  const key = b.swarm ? "swarm" : b.kind;
  const chance = UP.chance[key] || 0;
  const roll = st.rng.up();
  if (!(roll < chance || G.sinceUp >= UP.pity)) return;
  if (G.ups.filter((u) => !u.done).length >= UP.maxFall) return;
  let w = st.rng.up() * UP.weights.reduce((a, x) => a + x, 0), kind = UP.kinds[0];
  for (let i = 0; i < UP.kinds.length; i++) { w -= UP.weights[i]; if (w <= 0) { kind = UP.kinds[i]; break; } }
  G.sinceUp = 0;
  const r = Math.max(RUP + 4, Math.min(FL.rim, b.r));
  G.ups.push({ kind, theta: b.theta, r, t0: st.A.t, done: false, doneAt: null, caught: false });
  sfx(st, "act.tell", 1, 0.8, b.x, b.y);
}

function upsStep(st, dts) {
  const G = st.guard, A = st.A;
  const half = curHalf(st);
  for (const u of G.ups) {
    if (u.done) continue;
    u.r -= UP.speed * dts;
    if (u.r <= RUP && u.r >= RL - 1 && G.arc.live && angDist(u.theta, G.arc.a) <= half + UP.catchDeg * RAD) { catchUp(st, u); continue; }
    if (u.r < RL - 1) { u.done = true; u.doneAt = A.t; }
  }
  G.ups = G.ups.filter((u) => !u.done || A.t - u.doneAt < (u.caught ? 0.9 : 0.4));
}

function catchUp(st, u) {
  const G = st.guard, A = st.A;
  u.done = true;
  u.caught = true;
  u.doneAt = A.t;
  G.caught++;
  const x = u.r * Math.cos(u.theta), y = u.r * Math.sin(u.theta);
  X.burst(A, x, y, 2.5, 2);
  sfx(st, u.kind === "mend" ? "act.heal" : "act.up", 1, 0.9, x, y);
  switch (u.kind) {
    case "multi": multi(st); break;
    case "wide": G.fx.wide = A.t + UP.wideS; break;
    case "pierce": G.fx.pierce = A.t + UP.pierceS; break;
    case "slow": G.fx.slow = A.t + UP.slowS; break;
    case "mend":
      if (A.p.hp < A.p.hpMax) { X.heal(A, 1); G.cracks.pop(); }      // the newest crack heals
      else if (!st.koed) { st.score.mend += UP.mendPts; X.pop(A, x, y, UP.mendPts, 0); }
      break;
  }
}

// Slow: everything but the arc moves at 0.6 of its speed: the foe sparks in flight too (scaled in place).
function slowStep(st) {
  const G = st.guard, A = st.A;
  const on = G.fx.slow > A.t;
  if (on === G.slowOn) return;
  G.slowOn = on;
  const k = on ? UP.slowK : 1 / UP.slowK;
  const B = A.b;
  for (let i = 0; i < B.n; i++) if (B.side[i] === 2) { B.vx[i] *= k; B.vy[i] *= k; B.life[i] = B.age[i] + (B.life[i] - B.age[i]) / k; }
  A.bulletK = (st.assist ? FI.bulletAssistK : 1) * (on ? UP.slowK : 1);
}

// ---- the seal charge (the bomb)

function addCharge(st, n) {
  const G = st.guard;
  if (st.koed || G.calm && st.moment !== "guard") return;
  const max = CH.full * CH.keep;
  const before = Math.floor(G.charge / CH.full);
  G.charge = Math.min(max, G.charge + n);
  const now = Math.floor(G.charge / CH.full);
  if (now > before) {
    sfx(st, "act.up", 1.2, 0.7);
    if (!("charge" in st.subgoals) && st.moment === "guard") subgoal(st, "charge", "egg.chargeGoal");
  }
}

function release(st) {
  const G = st.guard, A = st.A;
  if (G.charge < CH.full - 1e-9 || G.wave || st.koed) return false;
  G.charge -= CH.full;
  G.used++;
  G.wave = { t0: A.t, hit: new Set() };
  A.p.inv = Math.max(A.p.inv, CH.invS);
  X.hitStop(A, 3);
  jolt(st, 0.4);
  emit(st, "sfx", { id: "egg.burst", pitch: 1.2, gain: 0.8 });
  if (st.subgoals.charge === "shown") doneBy(st, "charge", "you", "egg.chargeDone");
  return true;
}

// The seal wave runs from 11 u to 70 u in 0.5 s: every spark it passes turns to gold, every rival it passes loses a
// hit (a stuck one pops loose, a diver bounces). Your sperm is never touched.
function waveStep(st) {
  const G = st.guard, A = st.A, W = G.wave;
  if (!W) return;
  const p = clamp01((A.t - W.t0) / CH.waveS);
  const R = CH.from + (CH.to - CH.from) * p;
  sparkle(st, R);
  G.waving = true;
  for (const b of G.bricks) {
    if (W.hit.has(b.id) || !LIVE.has(b.state) || b.state === "in" || b.r > R) continue;
    W.hit.add(b.id);
    if (b.state === "stuck") takeAll(st, b, "loose");
    else if (b.state === "dive" || b.state === "tell") takeAll(st, b, "arc");
    else hitBrick(st, b, "hit");
  }
  G.waving = false;
  if (p >= 1) G.wave = null;
}

// Every foe spark within r turns into a gold sparkle (flecks).
function sparkle(st, r) {
  const A = st.A, B = A.b;
  let n = 0;
  for (let i = 0; i < B.n && n < 6; i++) {
    if (B.side[i] !== 2) continue;
    const x = B.x[i], y = B.y[i];
    if (x * x + y * y > r * r) continue;
    X.burst(A, x, y, 1.4, 2);
    n++;
  }
  X.clearBullets(A, 2, 0, 0, r);
}

// ---- your gold sperm (v1)

// Your sperm's angle (v1 6.2): of the 72 candidates in seeded order, drop those under the thumb (world −y), under the
// portrait caption band (world +y) and near the arc; take the one farthest from every stuck rival, the first on a tie.
function goldAngle(st) {
  const G = st.guard;
  const margin = curHalf(st) + GD.arcMarginDeg * RAD;
  const stuck = G.bricks.filter((b) => b.state === "stuck").map((b) => b.theta);
  const allowed = (c) => angDist(c, -Math.PI / 2) > GD.thumbDeg * RAD + 1e-9 && angDist(c, Math.PI / 2) > GD.captionDeg * RAD + 1e-9;
  let best = null, bestD = -1, fallback = null;
  for (const deg of G.order) {
    const c = wrapAngle(deg * RAD);
    if (!allowed(c)) continue;
    if (fallback === null) fallback = c;
    if (angDist(c, G.arc.a) < margin - 1e-9) continue;
    let dmin = Infinity;
    for (const s of stuck) dmin = Math.min(dmin, angDist(c, s));
    if (dmin > bestD) { bestD = dmin; best = c; }
  }
  return best !== null ? best : fallback !== null ? fallback : 0;
}

function spawnGold(st, from) {
  const G = st.guard, A = st.A;
  if (G.gold) return;
  const theta = goldAngle(st);
  G.gold = { id: "gold", state: "in", theta, r: from, born: A.t, p: 0, nudges: 0, prev: "in", r0: 0, nk: 0, back: false, x: 0, y: 0 };
  setPolar(G.gold);
  G.rushT = A.t;
  emit(st, "goldIn", { angle: theta });
  // Izumo1 meets Juno (egg.fuse) as your sperm comes in and works its way through: it reads while your sperm swims
  // in and burrows, and is done as it enters
  fact(st, "egg.fuse");
  if (!st.wentOn) subgoal(st, "letIn", "egg.letIn");
}

// The rush: your sperm from 75 u at 14 u/s, and 4 rivals at least 60° from it and from each other, each reaching the
// shell offsets[i] from when yours does.
function startRush(st) {
  const G = st.guard;
  G.rushAt = null;
  spawnGold(st, RU.from);
  const g = G.gold;
  for (let i = 0; i < RU.n; i++) {
    const th = g.theta + (TAU * (i + 1)) / (RU.n + 1) + (2 * st.rng.rush() - 1) * 6 * RAD;
    const off = RU.offsets[i % RU.offsets.length] + (2 * st.rng.rush() - 1) * RU.jitterS;
    const r = RU.from + RU.speed * off;
    const b = {
      id: "r" + G.nextId, n: G.nextId++, kind: "rush", hits: 1, hitsMax: 1, form: null, off: 0, offFrom: 0, offTo: 0, offT0: null,
      state: "dive", x: 0, y: 0, theta: wrapAngle(th), r, born: st.A.t, gx0: 0, gy0: 0, gt0: null, gs: 0, gun: null,
      wind: 0, flash: 0, kick: 0, swarm: false, rush: true, crack: false, p: 0, hk: 0, vx: 0, vy: 0, v: RU.speed, dir: 1,
      credit: null, settle: null, near: null, tellT0: null, idx: i,
    };
    setPolar(b);
    G.bricks.push(b);
  }
}

function moveGold(st, g, dts) {
  const G = st.guard;
  const canNudge = G.arc.live && !st.wentOn && g.nudges < GD.maxNudges;
  const nudge = (from) => {
    g.prev = from; g.state = "nudge"; g.r0 = g.r; g.nk = 0; g.back = false; g.nudges++;
    emit(st, "nudge", { n: g.nudges });
  };
  switch (g.state) {
    case "in":
      g.r -= GD.speed * dts;
      if (canNudge && over(st, g.theta, g.r)) nudge("in");
      else if (g.r <= SK.r) {
        g.r = SK.r;
        g.state = "stuck";
        emit(st, "stick", { id: "gold", angle: g.theta, gold: true });
      }
      break;
    case "stuck":
      if (canNudge && over(st, g.theta, g.r)) { nudge("stuck"); break; }
      g.p = Math.min(1, g.p + dts / GD.burrowS);
      if (g.p >= 1 && G.enterAt === null) G.enterAt = st.t;
      break;
    case "nudge":                                      // out 6 u over 0.3 s, then back at 8 u/s; the arc is ignored
      if (!g.back) {
        g.nk = Math.min(1, g.nk + dts / GD.nudgeS);
        g.r = g.r0 + GD.nudgeOut * (1 - (1 - g.nk) * (1 - g.nk));
        if (g.nk >= 1) g.back = true;
      } else {
        g.r -= GD.returnSpeed * dts;
        if (g.r <= g.r0) { g.r = g.r0; g.state = g.prev; }
      }
      break;
  }
  setPolar(g);
}

// Your sperm enters at tE (once per stage): the rush credit over the rivals that came and were settled, the share of
// pips left, a clean pick; the glows and any spark left turn to gold.
function settleEntry(st, tE) {
  const G = st.guard, A = st.A, S = st.score;
  if (!G.gold) spawnGold(st, SK.r);
  if (G.enterAt === null) G.enterAt = tE;
  const g = G.gold;
  g.state = "entered";
  g.r = SK.r;
  g.p = 1;
  setPolar(g);
  let n = 0, sum = 0;
  for (const b of G.bricks) {
    if (!b.rush) continue;
    if (b.state === "stuck") { b.credit = T.credit.held; b.settle = A.t; G.rushN.held++; }
    if (b.settle === null) continue;
    n++;
    sum += b.credit;
  }
  G.counted = n;
  G.credit = n ? sum / n : 0;
  G.pipsAt = A.p.hp;
  G.clean = !st.wentOn && G.arc.live && g.nudges === 0 && G.rushN.held === 0;
  if (!st.wentOn) {
    S.pips = Math.round(SC.pips * clamp01(A.p.hp / A.p.hpMax));
    S.rush = Math.round(SC.rush * G.credit);
    S.clean = G.clean ? SC.clean : 0;
    sendRest(st);
  }
  emit(st, "enter", { angle: g.theta, t: tE });
  emit(st, "sfx", { id: "egg.enter", at: tE, pitch: 1, gain: 0.9, t: tE });
  // the play settles: glows turn to gold, the sparks too; the stuck rivals wait for the seal
  for (const gl of G.glows) X.burst(A, gl.x, gl.y, 2, 2);
  G.glows = [];
  G.mine = [];
  sparkle(st, Infinity);
  for (const u of G.ups) if (!u.done) { u.done = true; u.doneAt = A.t; }
  A.tells.length = 0;
  G.tellOf = [];
  G.wave = null;
  A.bossBar = null;
  if (!st.wentOn) {
    at(st, tE, () => {
      doneBy(st, "guard", G.arc.live ? "you" : "auto", G.arc.live ? "egg.guardDone" : "egg.guardAuto");
      if (st.subgoals.letIn === "shown") doneBy(st, "letIn", G.clean ? "you" : "auto", G.clean ? "egg.letInDone" : "egg.letInAuto");
    });
  }
}

// ---- the seal

function sealNow(st, t, auto) {
  const S_ = st.seal, G = st.guard, S = st.score;
  if (!S_ || S_.sealAt !== null) return;
  S_.sealAt = t;
  S_.auto = !!auto;
  const kept = Math.min(CH.keep, Math.floor(G.charge / CH.full + 1e-9));
  G.kept = kept;
  if (!st.wentOn) {
    S.charge = Math.min(SC.chargeMax, SC.charge * kept);
    sendRest(st);
  }
  emit(st, "seal", { auto: !!auto, kept, t });
  if (st.subgoals.seal === "shown") at(st, t, () => doneBy(st, "seal", auto ? "auto" : "you", auto ? "egg.sealAuto" : "egg.sealDone"));
}

// The wave has met on the far side: every other sperm, held or swimming, drifts off.
function driftAll(st) {
  st.drifted = true;
  for (const b of st.guard.bricks) {
    if (b.state === "gone") continue;
    const h = b.state === "off" || b.state === "loose" ? Math.atan2(b.vy, b.vx) : b.theta;
    b.state = "off";
    b.vx = SL.driftSpeed * Math.cos(h);
    b.vy = SL.driftSpeed * Math.sin(h);
  }
}

// ---- the knock-out

function knockOut(st) {
  const G = st.guard, A = st.A;
  st.phase = "ko";
  st.koAt = st.t;
  st.koed = true;
  for (const b of G.bricks) {
    if (!LIVE.has(b.state) && b.state !== "held") continue;
    leaveForm(st, b);
    const h = b.theta + (2 * st.rng.bounce() - 1) * 0.3;
    b.state = "off";
    b.vx = SL.driftSpeed * Math.cos(h); b.vy = SL.driftSpeed * Math.sin(h);
    b.gun = null; b.wind = 0;
  }
  G.queue = [];
  sparkle(st, Infinity);
  for (const g of G.glows) X.burst(A, g.x, g.y, 2, 2);
  G.glows = [];
  G.mine = [];
  G.ups = [];
  G.wave = null;
  G.serveAt = null;
  G.gold = null;
  G.rushAt = null;
  A.tells.length = 0;
  G.tellOf = [];
  A.bossBar = null;
  if (st.subgoals.guard === "shown") doneBy(st, "guard", "auto", "egg.rest");
  setPrompt(st, NONE);
}

// ---- the step

function arcStep(st, it, dt) {
  const arc = st.guard.arc;
  const aimRate = AR.aimRateDeg * RAD;
  const turnRate = (st.assist ? AR.turnRateAssistDeg : AR.turnRateDeg) * RAD;
  const turn = it.turn > 0 ? 1 : it.turn < 0 ? -1 : 0;
  const s = it.steer && fin(it.steer.x) && fin(it.steer.y) ? it.steer : { x: 0, y: 0 };
  const aim = it.aim && fin(it.aim.x) && fin(it.aim.y) && Math.hypot(it.aim.x, it.aim.y) > 1e-6 ? it.aim : null;
  let moved = false;
  if (turn !== 0) {                                    // turn +1 is clockwise as seen: it decreases the angle
    arc.a = wrapAngle(arc.a - turn * turnRate * dt);
    moved = true;
  } else if (aim) {
    arc.a = wrapAngle(turnToward(arc.a, Math.atan2(aim.y, aim.x), aimRate, dt));
    moved = true;
  } else if (Math.hypot(s.x, s.y) >= AR.stickMin) {
    arc.a = wrapAngle(turnToward(arc.a, Math.atan2(s.y, s.x), aimRate, dt));
    moved = true;
  }
  if (moved && !arc.live) { arc.live = true; arc.wokeAt = st.A.t; }
}

function presses(it) {
  return (Array.isArray(it.presses) ? it.presses : []).filter((p) => p && fin(p.t));
}

// One step of the guard's play (the world moved: no hit-stop).
function guardStep(st) {
  const G = st.guard, A = st.A;
  const dts = DT * slowK(st);
  slowStep(st);
  if (!G.calm) wavesStep(st);
  spawnQueued(st);
  for (const F of G.forms) F.ang += F.w * dts;
  G.forms = G.forms.filter((F) => F.members.length || G.queue.some((q) => q.form === F));
  for (const b of G.bricks) {
    if ((b.state === "in" || b.state === "form") && b.form) placeMember(st, b);
    else if (b.state !== "gone") moveDiver(st, b, dts);
    if (b.flash > 0) b.flash = Math.max(0, b.flash - DT / LK.flashS);
    if (b.kick > 0) b.kick = Math.max(0, b.kick - DT * LK.kickEase);
    if (b.gun) gunStep(st, b, dts);
  }
  if (G.swarm) swarmStep(st, dts);
  diveStep(st);
  moveTells(st);
  if (G.rushAt !== null && st.t >= G.rushAt - 1e-9) startRush(st);
  if (G.gold && G.gold.state !== "entered") moveGold(st, G.gold, dts);
  glowsStep(st, dts);
  blockStep(st);
  mineStep(st, dts);
  upsStep(st, dts);
  waveStep(st);
  if (G.comboT > 0) { G.comboT -= DT; if (G.comboT <= 0) { G.comboT = 0; G.combo = 0; } }
  G.bricks = G.bricks.filter((b) => b.state !== "gone");
  G.cracks = G.cracks.filter((c) => A.t - c.t < LK.crackS);
  G.rip = G.rip.filter((f) => A.t - f.t < BO.ringS + 0.1);
  // your sperm enters by 60 s into the guard at the latest
  if (G.enterAt === null && A.t - G.w0 >= GD.latestS - 1e-9) G.enterAt = st.t;
}

// A pip lost: the chain ends, and a crack shows on the shell where it came from (the world's hit does not say where).
function noteCrack(st, x, y) {
  st.guard.combo = 0;
  st.guard.comboT = 0;
  if (!fin(x) || !fin(y) || (x === 0 && y === 0)) return;
  const G = st.guard, A = st.A;
  const a = Math.atan2(y, x);
  G.cracks.push({ a, t: A.t });
  X.burst(A, FL.shell * Math.cos(a), FL.shell * Math.sin(a), 2, 1);
}

// Afterwards (enter, the seal, fusion, the outro, the rest after a knock-out): the rivals drift, your sperm settles.
function restStep(st) {
  const G = st.guard;
  for (const b of G.bricks) {
    if (b.state === "off" || b.state === "loose") moveDiver(st, b, DT);
    if (b.state === "held") moveDiver(st, b, DT);
    if (b.flash > 0) b.flash = Math.max(0, b.flash - DT / LK.flashS);
  }
  G.bricks = G.bricks.filter((b) => b.state !== "gone");
  G.rip = G.rip.filter((f) => st.A.t - f.t < BO.ringS + 0.1);
}

function stepBody(st, it) {
  const a = st.t, b = a + DT;
  const A = st.A, G = st.guard;
  due(st, b);
  const inGuard = st.moment === "guard" && st.phase !== "ko";
  const live = inGuard && !st.wentOn;
  if (live) arcStep(st, it, DT);
  // the shell's pips before the world steps: a spark that lands this step leaves a crack where it came from
  const hp0 = A.p.hp + A.p.shield;
  let nx = NaN, ny = NaN, nd = Infinity;
  if (inGuard && A.p.inv <= 0) {
    const B = A.b;
    for (let i = 0; i < B.n; i++) {
      if (B.side[i] !== 2) continue;
      const r = Math.hypot(B.x[i], B.y[i]);
      if (r < nd) { nd = r; nx = B.x[i]; ny = B.y[i]; }
    }
  }
  const moved = X.stepWorld(A, EMPTY_INTENTS);
  if (A.p.hp + A.p.shield < hp0) noteCrack(st, nx, ny);
  X.emitOut(A, st);
  if (A.ko && !st.koed) knockOut(st);
  if (st.phase === "ko" && !st.wentOn) {
    if (moved) restStep(st);
    note(st, FACTS, TEXT);
    if (st.koEnd === null) st.koEnd = readBy(st, st.koAt + T.ko.restS + 0.3);
    if (st.t + DT >= st.koEnd - 1e-9) finish(st, "ko");
    return;
  }
  if (moved) {
    if (inGuard) {
      const hp1 = A.p.hp + A.p.shield;
      guardStep(st);
      if (A.p.hp + A.p.shield < hp1) {
        const g = G.glows.find((x) => x.lost && x.fadeAt === A.t);
        const h = G.bricks.find((x) => x.state === "held" && x.settle === A.t);
        if (g) noteCrack(st, g.x, g.y); else if (h) noteCrack(st, h.x, h.y); else noteCrack(st, NaN, NaN);
      }
      if (A.ko && !st.koed) knockOut(st);
    } else restStep(st);
  }
  // a press: the seal charge in the guard, the seal after your sperm enters (only a press after the prompt counts)
  const ps = presses(it);
  if (live && ps.length && st.phase !== "ko") release(st);
  if (st.moment === "seal" && st.seal && st.seal.sealAt === null && !st.wentOn) {
    const p = ps.find((x) => x.t >= st.seal.prompt - 1e-9);
    if (p) sealNow(st, Math.max(a, Math.min(p.t, b)), false);
  }
  if (st.fusionAt !== null && !st.drifted && b >= st.fusionAt + SL.waveS - 1e-9) driftAll(st);
  // the moments that end inside this step: the next starts there
  for (let k = 0; k < 8 && !st.done && st.phase !== "ko"; k++) {
    const e = endTime(st);
    if (e < b - 1e-12) advance(st, Math.max(a, e));
    else break;
  }
  note(st, FACTS, TEXT);
}

export function step(st, intents) {
  if (!st || typeof st !== "object") return;
  if (st.done) { st.t += DT; return; }
  try {
    stepBody(st, intents && typeof intents === "object" ? intents : EMPTY_INTENTS);
  } catch (e) {
    st.error = String((e && e.stack) || e);
    try { forceEnd(st); } catch (e2) { st.done = true; }
  }
  st.t += DT;
  if (!st.done && st.t >= meta.capS - 1e-9) {
    st.capped = true;
    try { forceEnd(st); } catch (e) { st.error = st.error || String(e); st.done = true; }
  }
}

// ---- the interface

export function prompt(st) {
  if (!st || st.done || !st.prompt) return { ...NONE };
  return { ...st.prompt };
}

export function targets() {
  return [];
}

// The time a mover at (x, y) with velocity (vx, vy) reaches radius R going in, or null.
function timeTo(x, y, vx, vy, R) {
  const a = vx * vx + vy * vy;
  if (a < 1e-9) return null;
  const bq = 2 * (x * vx + y * vy), c = x * x + y * y - R * R;
  if (c <= 0) return bq < 0 ? 0 : null;
  const disc = bq * bq - 4 * a * c;
  if (disc < 0 || bq >= 0) return null;
  const t = (-bq - Math.sqrt(disc)) / (2 * a);
  return t >= 0 ? t : null;
}

// The bot's arc (design.md 5.2): (1) the glow that reaches the arc soonest within 1.2 s, aimed at the most rival hits
// within 20° at skill 0.7 or more; (2) a spark that will reach the shell within 0.8 s when no glow is due first (or
// both fit under the arc); (3) a falling gift within 40° when nothing is due within 0.8 s; (4) the v1 target (divers,
// stuck rivals). It never turns into the gold zone. Noise σ = 25° × (1 − skill), lag 0.15 s × (1 − skill), kept in
// r.mem; at skill 1 its answer depends on the state alone. dash: a seal charge (skill 0.5 or more) or the seal.
export function botSteer(st, skill, r) {
  const still = { steer: { x: 0, y: 0 }, dir: null, hold: false, dash: false };
  if (!st || st.done || st.phase === "ko" || st.wentOn) return still;
  const sk = clamp01(skill);
  const mem = r && r.mem && typeof r.mem === "object" ? r.mem : null;
  if (st.moment === "seal") {
    if (!st.seal || st.seal.sealAt !== null || sk <= 0) return still;
    let wait = 0;
    if (sk < BOT.chargeSkill) {
      if (mem && mem.sealFor !== st.seal.prompt) { mem.sealFor = st.seal.prompt; mem.sealWait = BOT.sealS + (typeof r === "function" ? (2 * r() - 1) : 0) * BOT.sealJitter * (1 - sk); }
      wait = mem ? mem.sealWait : BOT.sealS;
    }
    return { ...still, dash: st.t - st.seal.prompt >= wait - 1e-9 };
  }
  if (st.moment !== "guard" || st.guard.t0 === null) return still;
  const G = st.guard, A = st.A;
  const a = G.arc.a, half = curHalf(st);
  const g = G.gold && G.gold.state !== "entered" ? G.gold : null;
  const Z = half + BOT.zoneMarginDeg * RAD;
  const inZone = (x) => g !== null && angDist(x, g.theta) < Z;
  const turnS = (x) => angDist(x, a) / (AR.aimRateDeg * RAD);

  // what is coming: { id, ang, t, w }
  const due = [];
  for (let i = 0; i < G.glows.length; i++) {
    const gl = G.glows[i];
    if (gl.lost || gl.stale) continue;
    const tt = timeTo(gl.x, gl.y, gl.vx * slowK(st), gl.vy * slowK(st), RC);
    if (tt === null || tt > BOT.glowS) continue;
    const hx = gl.x + gl.vx * slowK(st) * tt, hy = gl.y + gl.vy * slowK(st) * tt;
    due.push({ id: "g" + i, ang: Math.atan2(hy, hx), t: tt, w: 3, glow: gl });
  }
  const B = A.b;
  let near = 0;
  for (let i = 0; i < B.n; i++) {
    if (B.side[i] !== 2) continue;
    const x = B.x[i], y = B.y[i], vx = B.vx[i], vy = B.vy[i];
    if (x * x + y * y < 30 * 30) near++;
    const sp = Math.hypot(vx, vy) || 1;
    if (Math.abs(x * vy - y * vx) / sp > FL.shell + FI.r) continue;      // it misses the shell
    const tt = timeTo(x, y, vx, vy, RS);
    if (tt === null || tt > BOT.sparkS) continue;
    due.push({ id: "s" + i, ang: Math.atan2(y + vy * tt, x + vx * tt), t: tt, w: 2, spark: true });
  }
  for (const b of G.bricks) {
    if (b.state === "dive" && !inZone(b.theta)) {
      const tt = Math.max(0, (b.r - AR.reach) / Math.max(1, b.v * slowK(st)));
      if (tt <= BOT.diveS + 0.5) due.push({ id: b.id, ang: b.theta, t: tt, w: 2 });
    } else if (b.state === "stuck" && !inZone(b.theta)) {
      due.push({ id: b.id, ang: b.theta, t: (1 - b.p) * (st.assist ? SK.burrowAssistS : SK.burrowS), w: 1.5 });
    }
  }
  due.sort((p, q) => p.t - q.t);
  let pick = null, ang = null;
  if (due.length) {
    // the glow first; a spark or a rival only when the arc can still reach the glow after it, or both fit
    const glow = due.find((x) => x.glow);
    const first = due[0];
    pick = glow || first;
    if (glow && first !== glow) {
      const both = angDist(first.ang, glow.ang) <= 2 * half * 0.8;
      const room = first.t + angDist(first.ang, glow.ang) / (AR.aimRateDeg * RAD) + 0.08 < glow.t;
      if (both) { pick = glow; ang = glow.ang + wrapAngle(first.ang - glow.ang) / 2; }
      else if (room && turnS(first.ang) <= first.t) pick = first;
    } else if (!glow && due.length > 1) {
      const second = due[1];
      if (angDist(first.ang, second.ang) <= 2 * half * 0.8) ang = first.ang + wrapAngle(second.ang - first.ang) / 2;
    }
    if (ang === null) ang = pick.ang;
    // aim the glow: the hit offset that sends it toward the most rival hits within 20°
    if (pick.glow && ang === pick.ang && sk >= BOT.aimSkill && pick.t > 0.12) {
      const phi = pick.ang, hx = RC * Math.cos(phi), hy = RC * Math.sin(phi);
      const kMax = sk >= 1 ? 0.7 : 0.5;
      let bestK = 0, bestN = 0;
      for (let k = -kMax; k <= kMax + 1e-9; k += kMax / 3) {
        const out = phi + k * BL.retDeg * RAD;
        let n = 0;
        for (const b of G.bricks) {
          if (!HITTABLE.has(b.state) || b.hits <= 0) continue;
          if (angDist(Math.atan2(b.y - hy, b.x - hx), out) <= BOT.aimDeg * RAD) n += b.hits;
        }
        if (n > bestN + 1e-9 || (n === bestN && Math.abs(k) < Math.abs(bestK))) { bestN = n; bestK = k; }
      }
      ang = phi - bestK * half;
    }
  } else {
    // a falling gift within 40°, or the next glow, or stay
    const u = G.ups.find((x) => !x.done && angDist(x.theta, a) <= BOT.upDeg * RAD);
    if (u) { pick = { id: "u" + u.t0, ang: u.theta }; ang = u.theta; }
    else {
      const gl = G.glows.find((x) => !x.lost && !x.stale && x.x * x.vx + x.y * x.vy < 0);
      if (gl) { const tt = timeTo(gl.x, gl.y, gl.vx, gl.vy, RC); if (tt !== null) { pick = { id: "gl", ang: Math.atan2(gl.y + gl.vy * tt, gl.x + gl.vx * tt) }; ang = pick.ang; } }
    }
  }
  if (!G.arc.live && ang === null) ang = a + 0.6;              // wake the arc
  let id = pick ? pick.id : ang !== null ? "wake" : null;

  if (mem && sk < 1) {
    const lag = BOT.lagS * (1 - sk);
    if (!("cur" in mem)) { mem.cur = id; mem.curAng = ang; mem.next = null; }
    if (id !== mem.cur) {
      if (!mem.next || mem.next.id !== id) mem.next = { id, ang, t: st.t };
      if (st.t - mem.next.t >= lag - 1e-12) { mem.cur = id; mem.curAng = ang; mem.next = null; }
    } else { mem.curAng = ang; mem.next = null; }
    id = mem.cur;
    ang = mem.curAng;
    const sigma = BOT.sigmaDeg * RAD * (1 - sk);
    if (id !== null && ang !== null && sigma > 0 && typeof r === "function") {
      if (mem.errFor !== id) { mem.errFor = id; mem.err = gauss(r) * sigma; }
      ang += mem.err;
    }
  }

  // the seal charge: crowded, or a spark about to land where the arc cannot reach; at skill 1 one is kept from phase 3
  let dash = false;
  if (sk >= BOT.chargeSkill && G.charge >= CH.full && !G.wave) {
    const keep = sk >= 1 && G.swarm && (G.swarm.phase >= 3 || G.swarm.off) ? 1 : 0;
    if (Math.floor(G.charge / CH.full) > keep) {
      if (near >= BOT.chargeN) dash = true;
      for (const x of due) {
        if (!x.spark || x.t > BOT.chargeSoonS) continue;
        const target = ang !== null ? ang : a;
        if (angDist(x.ang, target) > half && turnS(x.ang) > x.t) dash = true;
      }
    }
  }

  if (ang === null) return { ...still, dash };
  const way = BOT.wayDeg * RAD;
  let w;
  if (g && angDist(a, g.theta) < Z) {
    w = a + (wrapAngle(a - g.theta) >= 0 ? 1 : -1) * way;      // inside the zone: turn away from the gold first
  } else {
    let bAng = ang;
    if (g && angDist(bAng, g.theta) < Z) bAng = g.theta + (wrapAngle(bAng - g.theta) >= 0 ? 1 : -1) * Z;
    let d;
    if (g) {                                                    // the way round that stays out of the zone
      const base = g.theta + Z;
      const s = (x) => (((x - base) % TAU) + TAU) % TAU;
      d = s(bAng) - s(a);
    } else d = wrapAngle(bAng - a);
    w = Math.abs(d) <= way ? a + d : a + Math.sign(d) * way;
  }
  return { steer: { x: UNIT * Math.cos(w), y: UNIT * Math.sin(w) }, dir: null, hold: false, dash };
}

// The guard shape (v1 16.9), in world units and radians.
export function probe(st) {
  const G = st.guard;
  const g = G.gold;
  return {
    arc: { angle: G.arc.a, half: curHalf(st), r: AR.r, live: G.arc.live },
    egg: { x: 0, y: 0, r: SZ.cell, shell: SZ.shell },
    sperm: G.bricks.filter((b) => b.state !== "gone").map((b) => ({
      id: b.id, state: b.state === "off" ? "loose" : b.state === "form" || b.state === "in" || b.state === "tell" ? "ring" : b.state === "dive" ? "in" : b.state,
      angle: b.theta, r: b.r, progress: b.state === "stuck" || b.state === "held" ? b.p : 0, x: b.x, y: b.y,
      hits: b.hits, kind: b.kind, rush: b.rush,
    })),
    gold: g ? { state: g.state, angle: g.theta, r: g.r, nudges: g.nudges, progress: g.p, x: g.x, y: g.y } : null,
    entered: !!(g && g.state === "entered"),
    glows: G.glows.filter((x) => !x.lost && !x.stale).map((x) => ({ x: x.x, y: x.y })),
    charge: G.charge,
    rim: FL.rim,
  };
}

export function result(st) {
  const G = st.guard, S = st.score, A = st.A;
  const done = !!st.done;
  const goalMet = done && st.goalMet;
  let skill, flourish;
  if (st.koScore) { skill = st.koScore.skill; flourish = st.koScore.flourish; }
  else { skill = done ? skillNow(st) : S.skillSent; flourish = done ? flourishNow(st) : S.flourishSent; }
  const score = clampScore({ goal: goalMet ? PARTS.goal : 0, skill, flourish });
  const br = st.koScore ? Math.max(S.ticked, bricksPart(st)) : done ? Math.max(S.ticked, bricksPart(st)) : S.ticked;
  return {
    done,
    goalMet,
    score,
    parts: [
      { id: "goal", label: "part.goal", value: score.goal, max: PARTS.goal },
      { id: "hits", label: "egg.part.hits", value: Math.min(SC.bricks, br), max: SC.bricks },
      { id: "shell", label: "egg.part.shell", value: S.pips, max: SC.pips },
      { id: "chain", label: "egg.part.chain", value: done ? comboPart(st) : 0, max: SC.combo },
      { id: "rush", label: "egg.part.rush", value: S.rush, max: SC.rush },
      { id: "pick", label: "egg.part.pick", value: score.flourish, max: PARTS.flourish },
    ],
    metrics: {
      moment: st.moment, how: st.how, place: st.place, error: st.error, ko: st.koed, koAt: st.koAt,
      almost: st.koed ? "almost.ko" : null, wentOn: st.wentOn,
      hits: G.hits, hitsCame: G.came, planned: PLANNED, bricks: G.bricksCame, offs: G.offs, bounced: G.bounced, popped: G.popped,
      held: G.held, blocked: G.blocked, mineHits: G.mineHits, stale: G.stale, returns: G.returns, lostGlows: G.lost, bestCombo: G.bestCombo, caught: G.caught,
      charges: G.used, kept: G.kept, pips: A.p.hp, pipsMax: A.p.hpMax, pipsAtEnter: G.pipsAt, shieldHits: A.shieldHits || 0,
      nudges: G.gold ? G.gold.nudges : 0, rushCredit: G.credit === null ? 0 : G.credit, counted: G.counted, clean: G.clean,
      waves: G.waves.slice(), swarmAt: G.swarmAt, swarmOffAt: G.swarmOffAt,
      goldIn: G.rushT !== null && G.w0 !== null ? G.rushT - G.w0 : null,
      enterIn: G.enterAt !== null && G.t0 !== null ? G.enterAt - G.t0 : null,
      sealAuto: st.seal ? st.seal.auto : null, length: st.doneAt,
    },
    carryOut: {},
  };
}

// Fair resume: 1.2 s in which the shell cannot be hit, so a pause never ends in a pip.
export function resume(st) {
  if (!st || st.done || !st.A) return 0;
  st.A.p.inv = Math.max(st.A.p.inv, 1.2);
  return 0;
}

// Skip ahead to a named moment (tests and ?moment=): the moments between end now, by themselves. After a knock-out,
// jump(st, "guard") is Go on (meta.goOn): the rush with no rivals; your sperm swims in within 2 s, enters, and the
// shell seals by itself, with input ignored.
export function jump(st, id) {
  const i = ORDER.indexOf(id);
  if (!st || i < 0) return false;
  if (st.koed && id === meta.goOn) {
    if (st.wentOn) return false;
    const G = st.guard, A = st.A;
    st.wentOn = true;
    st.done = false;
    st.how = null;
    st.phase = "goOn";
    G.arc.live = false;
    G.calm = true;
    G.calmGlow = true;
    if (G.swarm) G.swarm.off = true;
    G.glows = []; G.mine = []; G.ups = []; G.queue = []; G.wave = null; G.serveAt = null;
    for (const b of G.bricks) if (LIVE.has(b.state) || b.state === "held") { b.state = "off"; const h = b.theta; b.vx = SL.driftSpeed * Math.cos(h); b.vy = SL.driftSpeed * Math.sin(h); }
    X.clearBullets(A, 0);
    A.tells.length = 0;
    G.tellOf = [];
    A.bossBar = null;
    A.p.inv = 1e6;
    G.gold = null;
    G.enterAt = null;
    setPrompt(st, NONE);
    spawnGold(st, GD.goOnFrom);
    return true;
  }
  if (st.done || i < st.mi || st.phase === "ko") return false;
  try {
    for (let k = 0; k < ORDER.length && st.mi < i && !st.done; k++) advance(st, st.t);
  } catch (e) {
    st.error = String((e && e.stack) || e);
    return false;
  }
  return st.mi === i;
}

// ---- the draw list

function tailOf(x, y, ang, len, phase, hue, ring, extra) {
  return { x, y, ang, len, phase: ((phase % 1) + 1) % 1, hue, ring, ...(extra || {}) };
}

export function view(st) {
  const d = emptyDraw(meta.id);
  const t = st.t, span = T.span, G = st.guard, S_ = st.seal, H = T.hue, L = T.light, R = T.rings, A = st.A;
  const mm = mmPerShortAxis(meta, st.gaDay);
  d.camera = { x: 0, y: 0, span, rot: 0, orient: meta.orient, mmPerU: mm / span };
  d.scale = { you: T.you };
  const herPh = clamp01(st.beats.phase("mother", t));
  const pulse = Math.exp(-6 * herPh);
  const goldHue = fin(st.carry.sperm.hue) ? st.carry.sperm.hue : 0.11;
  const goldGlow = clamp01(st.carry.sperm.glow);
  const mi = st.mi;
  const inPlay = G.t0 !== null;

  // light: the gold surge washes on beats 1 and 2, a flash as it opens, a little more light through fusion
  let level = L.level, surgeW = 0;
  for (let k = 0; k < O.surgeBeats; k++) {
    const dk = t - st.ob[k];
    if (dk >= 0 && dk < 0.8) surgeW = Math.max(surgeW, 1 - dk / 0.8);
  }
  level += 0.12 * surgeW;
  const burstAt = st.ob[O.burstBeat - 1];
  if (t >= burstAt && t - burstAt < 0.6) level += 0.15 * (1 - (t - burstAt) / 0.6);
  if (st.fusionAt !== null) level += 0.08 * clamp01((t - st.fusionAt) / FU.s);
  d.light = { level, warm: L.warm, exposure: 1, white: 0, vignette: L.vignette, tint: Math.min(0.06, L.tintMax * surgeW) };
  d.warp = L.warp;
  d.caustics = 0;

  // the follicle swells with her surge, then slides away in the sweep
  const splats = d.splats;
  if (mi <= 2) {
    const p = mi === 2 ? clamp01((t - st.mStart) / O.sweepS) : 0;
    const open = clamp01((t - st.ob[0]) / Math.max(0.3, burstAt - st.ob[0]));
    const r = (SZ.follicle + SZ.followSwell * 2 * open + (mi <= 1 ? 0.8 * pulse : 0)) * (1 + 0.25 * p);
    splats.push({ k: "c", x: 0, y: -70 * p * p, r, m: 0.2, n: 0, v: 0, hue: H.follicle });
  }
  splats.push({ k: "c", x: 0, y: 0, r: SZ.shell, m: 0.6, n: 0, v: 0, hue: H.shell });
  splats.push({ k: "c", x: 0, y: 0, r: SZ.cell, m: 0.8, n: 0, v: 0, hue: H.cell });
  const g = G.gold;
  const e = g ? g.theta : Math.PI / 2;
  const ux = Math.cos(e), uy = Math.sin(e);
  if (st.fusionAt === null) {
    splats.push({ k: "c", x: 0, y: 0, r: SZ.inner, m: 0.9, n: 0.35, v: 0, hue: H.inner });
  } else {
    const ft = t - st.fusionAt;
    splats.push({ k: "c", x: 0, y: 0, r: SZ.inner, m: 0.9, n: 0, v: 0, hue: H.inner });
    const pin = clamp01(ft / FU.inS), pclose = clamp01((ft - FU.beadS) / (FU.s - FU.beadS));
    const ease = (q) => q * q * (3 - 2 * q);
    const bR = 9 - 2 * ease(pin), bFinal = 2.5;
    const bAt = bR + (bFinal - bR) * ease(pclose);
    const aAt = -1 - 0.5 * ease(pclose);
    splats.push({ k: "c", x: aAt * ux, y: aAt * uy, r: 2, m: 1, n: 0, v: 0, hue: H.nucleus });
    splats.push({ k: "c", x: bAt * ux, y: bAt * uy, r: 1.6 + 0.4 * pin, m: 1, n: 0, v: 0, hue: goldHue });
    const pb = clamp01((ft - FU.inS) / (FU.beadS - FU.inS));
    if (pb > 0) {
      const ba = e + Math.PI / 2;
      splats.push({ k: "c", x: (SZ.cell + 0.6) * Math.cos(ba), y: (SZ.cell + 0.6) * Math.sin(ba), r: 0.2 + 1.2 * pb, m: 0.7, n: 0, v: 0, hue: H.cell });
    }
  }

  // the corona: a cloud of paper dots, darker along your sperm's path; held rivals rest in it as dim points
  const held = G.bricks.filter((b) => b.state === "held");
  const N = SZ.coronaN, n = N + Math.min(held.length, LIMITS.points - N);
  const xy = new Float32Array(2 * n), al = new Float32Array(n), id = new Float32Array(n);
  const breath = 1 + 0.02 * pulse;
  for (let i = 0; i < N; i++) {
    const r = st.corona[3 * i] * breath, th = st.corona[3 * i + 1];
    xy[2 * i] = r * Math.cos(th);
    xy[2 * i + 1] = r * Math.sin(th);
    al[i] = st.corona[3 * i + 2] * (g && angDist(th, g.theta) < GD.pathDeg * RAD ? 0.5 : 1);
    id[i] = i;
  }
  for (let j = 0; j < n - N; j++) {
    const b = held[j];
    xy[2 * (N + j)] = b.x; xy[2 * (N + j) + 1] = b.y; al[N + j] = 0.35;
    id[N + j] = 10000 + b.n;
  }
  d.points = { n, xy, a: al, id, hue: H.corona };

  // the sperm: yours first, then the rivals (diving and stuck, the rings, then those drifting off), in two strips
  const items = [];
  if (g && (g.state !== "entered" || mi === I_ENTER)) {
    let r = g.r, len = SZ.spermLen;
    if (g.state === "entered") {
      const q = clamp01((t - G.enterAt) / T.enterS);
      r = SK.r - (SK.r - SZ.cell) * q;
      len = Math.max(1, SZ.spermLen * (1 - q));
    }
    items.push(tailOf(r * ux, r * uy, e + Math.PI, len, t * (2 + goldGlow), goldHue, "dashed"));
  }
  const rank = (b) => (b.state === "stuck" || b.state === "dive" || b.state === "tell" ? 0 : b.state === "form" || b.state === "in" ? 1 : 2);
  const vis = G.bricks.filter((b) => b.state !== "held" && b.state !== "gone").sort((p, q) => rank(p) - rank(q) || p.r - q.r);
  for (const b of vis) {
    if (items.length >= 2 * LIMITS.tails) break;
    const drifting = b.state === "off" || b.state === "loose";
    let ang = drifting ? Math.atan2(b.vy, b.vx) : b.theta + Math.PI;
    let x = b.x, y = b.y;
    if (b.state === "tell") ang += 0.35 * Math.sin((A.t - b.tellT0) * 40);
    if (b.kick > 0 && !drifting) { x += Math.cos(b.theta) * LK.kick * b.kick; y += Math.sin(b.theta) * LK.kick * b.kick; }
    const born = b.state === "in" ? clamp01((A.t - b.born) / BR.inS) : 1;
    const fade = drifting ? clamp01(1 - (b.r - 40) / (FL.removeR - 40)) : 1;
    const len = LK.len * Math.max(0.15, born * Math.max(0.2, fade));
    const shooter = !!b.gun;
    items.push(tailOf(x, y, ang, len, t * (b.state === "stuck" ? 4 : 2.5) + b.n * 0.618, H.rival, null, {
      head: LK.head * (0.5 + 0.5 * born) * (drifting ? 0.85 : 1),
      dots: drifting ? 0 : b.hits, cap: b.kind === "capped" && !drifting ? (b.crack ? 2 : 1) : 0,
      gun: shooter && !drifting ? 1 : 0, wind: clamp01(b.wind), flash: clamp01(b.flash),
    }));
  }
  const strips = [];
  if (items.length) strips.push({ kind: "tails", items: items.slice(0, LIMITS.tails) });
  if (items.length > LIMITS.tails) strips.push({ kind: "tails", items: items.slice(LIMITS.tails, 2 * LIMITS.tails) });
  if (mi >= I_GUARD && inPlay) {
    let glow = G.arc.live ? 1 : AR.sleepGlow;
    if (G.enterAt !== null && mi > I_GUARD) glow *= 1 - clamp01((t - G.enterAt) / AR.fadeS);
    if (st.phase === "ko") glow *= 0.4;
    const h = curHalf(st);
    if (glow > 0) strips.push({ kind: "arc", x: 0, y: 0, r: AR.r, a0: G.arc.a - h, a1: G.arc.a + h, w: AR.w, glow });
  }
  if (S_ && S_.sealAt !== null) {
    const phi = Math.PI * clamp01((t - S_.sealAt) / SL.waveS);
    const glow = 1 - 0.6 * clamp01((t - S_.sealAt - SL.waveS) / 2);
    strips.push({ kind: "arc", x: 0, y: 0, r: SZ.shell, a0: e - phi, a1: e + phi, w: 2.2, glow });
  }
  // ripples: the field's rim (a dotted pale ring), the seal wave, the arc's touches, the cracks, her surge
  const rip = [];
  if (mi === I_GUARD && inPlay && st.phase !== "ko" && !st.wentOn) rip.push({ x: 0, y: 0, r: FL.rim, a: 0.3, dashed: true });
  else { rip.push({ x: 0, y: 0, r: 44, a: 0.18, dashed: false }, { x: 0, y: 0, r: 62, a: 0.12, dashed: false }); }
  for (let k = 0; k < O.surgeBeats; k++) {
    const dk = t - st.ob[k];
    if (dk >= 0 && dk < 0.9) rip.push({ x: 0, y: 0, r: 70 - 44 * (dk / 0.9), a: 0.5 * (1 - dk / 0.9), dashed: false });
  }
  {
    const dk = t - burstAt;
    if (dk >= 0 && dk < 0.8) rip.push({ x: 0, y: 0, r: 26 + 38 * (dk / 0.8), a: 0.6 * (1 - dk / 0.8), dashed: false });
  }
  if (G.wave) {
    const p = clamp01((A.t - G.wave.t0) / CH.waveS);
    rip.push({ x: 0, y: 0, r: CH.from + (CH.to - CH.from) * p, a: 0.85 * (1 - 0.6 * p), dashed: false });
  }
  for (const f of G.rip) {
    const dk = A.t - f.t;
    if (dk >= 0 && dk < BO.ringS) rip.push({ x: f.x, y: f.y, r: 1.5 + 3 * (dk / BO.ringS), a: 0.9 * (1 - dk / BO.ringS), dashed: false });
  }
  for (const c of G.cracks) {
    const k = 1 - clamp01((A.t - c.t) / LK.crackS);
    rip.push({ x: FL.shell * Math.cos(c.a), y: FL.shell * Math.sin(c.a), r: 1.6, a: 0.9 * k, dashed: true });
  }
  strips.push({ kind: "ripples", items: rip });
  rimSparks({ strips }, st.carry.sparks, 0, 0, SZ.shell + 1, { t, span });   // rim sparks (v1 5.5): you are the egg
  if (mi <= 2) {
    const p = mi === 2 ? clamp01((t - st.mStart) / O.sweepS) : 1;
    const x = 70 - 16 * p, amp = mi === 2 ? 1 : 0.4;
    const ph = (t * (mi === 2 ? 2.4 : 1.2)) % 1;
    strips.push({ kind: "cilia", a: [-x, -150], b: [-x, 150], count: 18, phase: ph, amp });
    strips.push({ kind: "cilia", a: [x, -150], b: [x, 150], count: 18, phase: (ph + 0.5) % 1, amp });
  }
  d.strips = strips.slice(0, LIMITS.strips);

  // marks: the follicle's glow, the surge, each glow's gold halo, the next serve, the gifts, a shell blink, your sperm
  const marks = d.marks;
  if (mi <= 1) marks.push({ kind: "glow", x: 0, y: 0, r: 34, on: 0.5 + 0.4 * pulse, pulse });
  if (surgeW > 0) marks.push({ kind: "glow", x: 0, y: 0, r: 60, on: surgeW });
  for (const gl of G.glows) {
    if (marks.length >= 14) break;
    const f = gl.fadeAt === null ? 1 : 1 - clamp01((A.t - gl.fadeAt) / BL.fadeS);
    if (f > 0) marks.push({ kind: "glow", x: gl.x, y: gl.y, r: 5.5, on: 0.9 * f });
  }
  if (G.serveAt !== null && inPlay && st.moment === "guard" && st.phase !== "ko" && !G.calmGlow) {
    const p = clamp01(1 - (G.serveAt - A.t) / BL.serveTellS);
    if (p > 0) marks.push({ kind: "glow", x: AR.r * Math.cos(G.arc.a), y: AR.r * Math.sin(G.arc.a), r: 3 + 3 * p, on: 0.4 + 0.5 * p });
  }
  for (const u of G.ups) {
    if (marks.length >= 18) break;
    const f = u.done ? 1 - clamp01((A.t - u.doneAt) / 0.4) : 1;
    if (f > 0) marks.push({ kind: "glow", x: u.r * Math.cos(u.theta), y: u.r * Math.sin(u.theta), r: 4, on: 0.6 * f });
  }
  if (A.p.inv > 0 && inPlay && st.moment === "guard" && st.phase !== "ko" && !st.wentOn && A.p.inv < A.p.invS + 0.01) {
    // a crack blinks the shell by brightness only
    const on = Math.cos(A.t * 26) > 0 ? 0.55 : 0.15;
    marks.push({ kind: "glow", x: 0, y: 0, r: SZ.shell + 2, on: on * clamp01(A.p.inv / A.p.invS) });
  }
  if (mi === I_ENTER && g) {
    const tx = -uy * 1.6, ty = ux * 1.6, rr = SZ.cell + 0.4;
    marks.push({ kind: "glow", x: rr * ux + tx, y: rr * uy + ty, r: 1.8, on: 1 });
    marks.push({ kind: "glow", x: rr * ux - tx, y: rr * uy - ty, r: 1.8, on: 1 });
  }
  if (st.fusionAt !== null) marks.push({ kind: "glow", x: 0, y: 0, r: 8, on: 0.5 + 0.5 * clamp01((t - st.fusionAt) / FU.s) });
  if (g && g.state !== "entered") marks.push({ kind: "glow", x: g.x, y: g.y, r: 5, on: 0.25 + 0.5 * goldGlow });
  d.marks = marks.slice(0, LIMITS.marks);

  // rings (DOM, at most 8): her beat, the seal charge (filling, and the ones kept), the burrow rings
  const rings = d.rings;
  rings.push({ id: "mother", kind: "mother", x: 0, y: 0, r: R.mother, progress: herPh });
  if (inPlay && st.moment === "guard" && st.phase !== "ko" && !st.wentOn) {
    const kept = Math.floor(G.charge / CH.full + 1e-9);
    const frac = kept >= CH.keep ? 1 : (G.charge - kept * CH.full) / CH.full;
    rings.push({ id: "charge", kind: "burrow", x: 0, y: 0, r: R.charge, progress: clamp01(frac), dashed: true });
    if (kept > 0) rings.push({ id: "kept", kind: "hold", x: 0, y: 0, r: R.kept, progress: 1, grade: kept >= 2 ? "in" : null });
  }
  if (g && (g.state === "stuck" || (g.state === "nudge" && g.prev === "stuck"))) {
    rings.push({ id: "b:gold", kind: "burrow", x: g.x, y: g.y, r: R.burrow, progress: clamp01(g.p), dashed: true });
  }
  const stuck = G.bricks.filter((b) => b.state === "stuck").sort((p, q) => q.p - p.p);
  for (const b of stuck) {
    if (rings.length >= LIMITS.rings) break;
    rings.push({ id: "b:" + b.id, kind: "burrow", x: b.x, y: b.y, r: R.burrow, progress: clamp01(b.p), dotted: true });
  }

  // the action layer: the sparks (and yours, and the glows), the gifts, the telegraphs, pops, flecks, the shell pips;
  // only in the guard (once your sperm enters, the pips have done their work and the HUD gives the captions room)
  if (inPlay && st.moment === "guard") {
    const av = X.actionView(A, { player: false });
    const fb = av.bullets, nm = G.mine.length;
    const ng = G.glows.filter((x) => x.fadeAt === null || A.t - x.fadeAt < BL.fadeS).length;
    const nb = Math.min(LIMITS.bullets, fb.n + nm + ng);
    const bx = new Float32Array(2 * nb), br = new Float32Array(nb), bt = new Uint8Array(nb), ba = new Float32Array(nb);
    let j = 0;
    for (const gl of G.glows) {
      if (j >= nb) break;
      if (gl.fadeAt !== null && A.t - gl.fadeAt >= BL.fadeS) continue;
      const f = gl.fadeAt === null ? 1 : 1 - clamp01((A.t - gl.fadeAt) / BL.fadeS);
      bx[2 * j] = gl.x; bx[2 * j + 1] = gl.y; br[j] = BL.drawR * (0.4 + 0.6 * f); bt[j] = 0; ba[j] = Math.atan2(gl.vy, gl.vx); j++;
    }
    for (const m of G.mine) {
      if (j >= nb) break;
      bx[2 * j] = m.x; bx[2 * j + 1] = m.y; br[j] = 1.1; bt[j] = 0; ba[j] = Math.atan2(m.vy, m.vx); j++;
    }
    for (let i = 0; i < fb.n && j < nb; i++, j++) {
      bx[2 * j] = fb.xy[2 * i]; bx[2 * j + 1] = fb.xy[2 * i + 1]; br[j] = fb.r[i]; bt[j] = fb.tone[i]; ba[j] = fb.ang[i];
    }
    const ups = G.ups.filter((u) => !u.done);
    const ku = new Float32Array(2 * ups.length), kk = new Uint8Array(ups.length), ka = new Float32Array(ups.length);
    ups.forEach((u, i) => { ku[2 * i] = u.r * Math.cos(u.theta); ku[2 * i + 1] = u.r * Math.sin(u.theta); kk[i] = 2; ka[i] = 1; });
    const pops = av.pops.slice();
    for (const u of G.ups) {
      const x = u.r * Math.cos(u.theta), y = u.r * Math.sin(u.theta);
      const a = u.done ? (u.caught ? 1 - clamp01((A.t - u.doneAt) / 0.9) : 0) : 1;
      if (a > 0) pops.push({ x: x + 3.5, y: y + (u.caught ? 2 + 6 * clamp01((A.t - u.doneAt) / 0.9) : 0), v: 0, a, combo: 0, word: "egg.up." + u.kind });
    }
    d.action = { ...av, bullets: { n: j, xy: bx.subarray(0, 2 * j), r: br.subarray(0, j), tone: bt.subarray(0, j), ang: ba.subarray(0, j) },
      foes: [], pickups: { n: ups.length, xy: ku, kind: kk, a: ka }, pops: pops.slice(-LIMITS.pops), arena: null, zone: null,
      combo: G.combo };
  }

  d.anchor = { x: 0, y: 0 };
  if (st.done) d.cue = null;
  else if (st.moment === "guard" && g && g.state !== "entered" && !st.wentOn) d.cue = { x: g.x, y: g.y };
  else if (st.moment === "guard" && st.phase !== "ko" && !st.wentOn) d.cue = { x: AR.r * Math.cos(G.arc.a), y: AR.r * Math.sin(G.arc.a) };
  else if (st.moment === "enter" || st.moment === "seal") d.cue = { x: SZ.shell * ux, y: SZ.shell * uy };
  else if (mi <= 1) d.cue = { x: 0, y: 0 };
  else d.cue = null;
  return d;
}

export const TOTALS = Object.freeze({ planned: PLANNED, perHit: PER_HIT });
