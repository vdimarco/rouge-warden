// Ahead of the Light: THE TOY (final.md 24.2), the fixed 30 s stretch that proves the handling is fun before any leg,
// card or menu exists (?toy=30). Knots to steer and skim past, a fuel cell a hairline from a knot, the light pressed
// to TTC 4 s at 9 s for the burn, Coma as a landmark well with two exits (a wall gap and REMORA's wake), REMORA to
// draft and slingshot past, then beside you with a knot just past it to slam it into; if you leave it be, it clips a
// knot at 25 s and the light takes it. Captions show the first time each thing happens; at 30 s a card shows top
// speed, grazes, the whip's grade, slingshot and takedown.
// This file holds the stretch as data (items in beats, placed for the speeds a first try reaches), the caption
// script, createToy and stepToy. REMORA here is a scripted stand-in: it keeps its lesson's place by changing its own
// speed, which a real rival never does. Pure.
import { TUNE } from './tune.js';
import { createRace, stepRace, NO_INTENT } from './race.js';
import { createShip, bpsOf } from './handle.js';
import { wrap } from './ringmath.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const TOY_S = 30;
export const TOY_TTC0 = 12;                   // s: the light at the start (TTC about 12 s)
export const TOY_TTC_DROP = 4;                // s: the script's drop at 9 s
const KP = -145;                              // the slam knot's bearing; REMORA leads you there
const SLAM_OFF = 28;                          // REMORA rides this far from it: about one SLAM's shove (up to 30°)
const COMA = { psi: 70, beat: 24.6, exits: [-100, 170] };

// The stretch, in beats (one beat is BEAT_R tube radii; about 1.9 a second at launch speed, 2.1 after a burn).
const RAW = [
  // 0 to 8 s: a pair on your line (a free zip at about 2 s), then a knot on your line to steer past and graze
  { kind: 'gate', beat: 3.8, psi: 0, gap: 22, halves: [3.5, 3.5], pair: true, soft: true },
  { kind: 'knot', beat: 5.8, psi: 0, half: 3.5, soft: true },
  { kind: 'knot', beat: 7.8, psi: -28, half: 3.5, soft: true },
  { kind: 'knot', beat: 9.4, psi: 32, half: 3.5, soft: true },
  { kind: 'gate', beat: 11.0, psi: 4, gap: 17, halves: [3.5, 3.5], pair: true, soft: true },
  { kind: 'knot', beat: 12.6, psi: -22, half: 3, soft: true, name: 'FUEL KNOT' },
  { kind: 'pickup', type: 'fuel', beat: 12.6, psi: -13.5, line: -4, slot: 'fuel' },
  { kind: 'knot', beat: 14.2, psi: 12, half: 3.5, soft: true },
  { kind: 'knot', beat: 15.8, psi: -12, half: 3.5, soft: true },
  // 9 to 11 s: the light presses; two easy knots while you burn
  { kind: 'knot', beat: 18.4, psi: 22, half: 3.5, soft: true },
  { kind: 'knot', beat: 20.6, psi: -24, half: 3.5 },
  // 11 s: Coma's reach; 12.5 s its window; exits on the wall gap and REMORA's wake
  { kind: 'cue', beat: 21.4, name: 'landmark', data: { label: 'THE COMA CLUSTER', psi: COMA.psi } },
  { kind: 'well', beat: COMA.beat, psi: COMA.psi, size: 'landmark', exits: COMA.exits, name: 'COMA' },
  // 14.5 s: the wall after the release, its gaps on the two exits
  { kind: 'wall', beat: 30.4, psi: COMA.exits[0], gaps: [{ psi: COMA.exits[0], w: 60, tag: 'exit' },
    { psi: COMA.exits[1], w: 50, tag: 'wake' }] },
  // 16 to 23 s: the draft and the slingshot behind REMORA (open road: a few far knots)
  { kind: 'knot', beat: 36, psi: KP + 90, half: 3 },
  { kind: 'knot', beat: 40, psi: KP - 80, half: 3 },
  { kind: 'knot', beat: 44, psi: KP + 70, half: 3 },
  // 23 to 26 s: the slam knot just past REMORA, then the knots REMORA clips if you leave it be
  { kind: 'knot', beat: 52.8, psi: KP, half: 3.5, name: 'SLAM KNOT', tag: 'slam' },
  { kind: 'knot', beat: 55.0, psi: KP + SLAM_OFF, half: 3, tag: 'clip' },
  { kind: 'knot', beat: 55.0, psi: KP - SLAM_OFF, half: 3, tag: 'clip' },
  // 26 to 30 s: a few last grazes as REMORA falls back to the light
  { kind: 'knot', beat: 58, psi: KP + 30, half: 3.5 },
  { kind: 'knot', beat: 60.5, psi: KP - 30, half: 3.5 },
  { kind: 'knot', beat: 63, psi: KP + 10, half: 3.5 },
];

export const TOY_BEATS = 72;

// The toy as a Leg (gen.js's shape): items numbered in beat order and frozen.
export function toyLeg(tune = TUNE) {
  const items = RAW.map((x) => ({ ...x })).sort((a, b) => a.beat - b.beat);
  items.forEach((it, i) => { it.id = i; it.piece = 'toy'; Object.freeze(it); });
  return Object.freeze({
    type: 'toy', lane: null, seed: 30, beats: TOY_BEATS, items: Object.freeze(items),
    sections: Object.freeze([]), gate: Object.freeze({ id: null, beat: TOY_BEATS + 100 }),
    pickups: Object.freeze(items.filter((i) => i.kind === 'pickup')),
    wells: Object.freeze(items.filter((i) => i.kind === 'well')), labels: Object.freeze([]),
    hash: 'toy-1', report: Object.freeze({ ok: true, errors: Object.freeze([]) }),
  });
}

// Captions (24.2): each shows once, the first time its trigger comes. on: 'start', a time { t }, or an event type
// (with `ship: 'you'` implied). desk: the desktop text where it differs.
export const TOY_CAPTIONS = Object.freeze([
  { id: 'steer', on: 'start', text: 'DRAG TO STEER', desk: '← → TO STEER' },
  { id: 'skim', on: 'graze', text: 'SKIM FOR SPEED' },
  { id: 'light', t: 9, text: 'THE LIGHT IS BEHIND YOU · FLICK UP TO BURN', desk: 'THE LIGHT IS BEHIND YOU · ↑ TO BURN' },
  { id: 'coma', t: 11, text: 'THE COMA CLUSTER' },
  { id: 'press', on: 'window', text: 'PRESS AS IT PASSES', desk: 'SPACE AS IT PASSES' },
  { id: 'hold', on: 'grab', text: 'HOLD' },
  { id: 'letgo', on: 'letgo', text: 'LET GO' },
  { id: 'tuck', t: 16, text: 'TUCK IN BEHIND REMORA' },
  { id: 'pull', on: 'draftFull', text: 'PULL OUT' },
  { id: 'sling', on: 'slingshot', text: 'SLINGSHOT' },
  { id: 'slam', t: 22.5, text: 'SLAM IT INTO THE KNOT' },
  { id: 'took', on: 'eaten', text: 'THE LIGHT TOOK REMORA', any: true },
].map(Object.freeze));

// A toy game: { race, captions: [{ id, text, t }], shown: {}, phase, sum }. The race is a bare leg (legNo 0, so the
// soft start and the first whip's teaching apply) with you and REMORA.
export function createToy({ seed = 1, tune = TUNE, desk = false } = {}) {
  const T = tune;
  const race = createRace({ leg: toyLeg(T), tune: T });
  const you = race.ships[0];
  const gap0 = TOY_TTC0 * (1 - Math.tanh(you.eta));
  you.gap = gap0;
  you.ttc = TOY_TTC0;
  you.fuel = 2;
  const remora = createShip({ id: 'remora', kind: 'regular', type: 'remora', name: 'REMORA', bearing: COMA.exits[1],
    eta: you.eta, meters: { hull: 2, fuel: 2, gap: 6 }, tune: T });
  remora.dist = 1.0 * bpsOf(you, T);
  remora.ai = { mode: 'toy', intent: { target: remora.bearing, turn: 0, action: null, burn: false }, side: 1,
    phase: 'ahead', passT: 0, seed };
  race.ships.push(remora);
  for (const it of race.leg.items) if (it.kind === 'well' && !race.wells[it.id]) race.wells[it.id] = { holder: null };
  const game = { race, desk, captions: [], shown: {}, script: { dropped: false, clipped: false }, sum: null, T };
  caption(game, 'start');
  return game;
}

function caption(game, on, t = game.race.t) {
  for (const c of TOY_CAPTIONS) {
    if (game.shown[c.id]) continue;
    const hit = c.t !== undefined ? on === 'time' && t >= c.t : c.on === on;
    if (!hit) continue;
    game.shown[c.id] = true;
    game.captions.push({ id: c.id, text: game.desk && c.desk ? c.desk : c.text, t });
  }
}

const remoraOf = (race) => race.ships.find((s) => s.id === 'remora') || null;

// REMORA's lesson-by-lesson script: ahead, then on exit B (its wake an exit band) until your whip ends, then half a
// second ahead beside the slam knot for the draft and the slingshot, then abreast of you with the knot just past it,
// then it clips a knot (if you have not taken it down) and falls back to the light. A stand-in keeps its place by
// gliding its lead (a real rival never does); its speed shadows yours, so its course speed matches.
function remoraStep(game, dt) {
  const { race } = game, T = game.T;
  const you = race.ships[0], R = remoraOf(race);
  if (!R || R.caught || R.wrecked || !(dt > 0)) return;
  const A = R.ai, t = race.t;
  const bps = bpsOf(you, T);
  const ahead = (R.dist - you.dist) / bps;
  const sideOf = () => (wrap(you.bearing - KP) >= 0 ? 1 : -1);
  let want = null, bearing = R.bearing, cruise = false;
  const whipped = (you.stats.whips > 0 && t > 15) || t > 16.5;
  if (!whipped) {
    A.phase = t < 11 ? 'ahead' : 'exit';
    want = t < 11 ? 1.0 : 0.45;
    bearing = COMA.exits[1];
  } else {
    if (A.phase === 'ahead' || A.phase === 'exit') { A.phase = 'lure'; A.side = sideOf(); A.slings = you.stats.slings; }
    if (A.phase === 'lure') {
      want = 0.5;
      bearing = KP + A.side * SLAM_OFF;
      if (you.stats.slings > A.slings) { A.phase = 'pass'; A.passT = t; }
      else if (t > 21.5) A.phase = 'slam';
    }
    if (A.phase === 'pass') {
      cruise = true;                            // you went by on the slingshot: it cruises while you pass
      bearing = KP + A.side * SLAM_OFF;
      if (t - A.passT > 1.2 || ahead < -0.1) A.phase = 'slam';
    }
    if (A.phase === 'slam') {
      // beside you, the slam knot just past it; it changes sides only if you go well round the other way
      if (wrap(you.bearing - KP) * A.side < -30) A.side = -A.side;
      want = 0;
      bearing = KP + A.side * SLAM_OFF;
      if (t > 24.8) A.phase = 'clip';
    }
    if (A.phase === 'clip') {
      want = -0.25;                             // on into the clip knot on its own line
      bearing = KP + A.side * SLAM_OFF;
      if (R.stats.hits > 0 || t > 27) {
        A.phase = 'fall';
        if (!game.script.clipped) { game.script.clipped = true; R.gap = Math.min(R.gap, 0.6); }
      }
    }
    if (A.phase === 'fall') { want = null; cruise = true; }
  }
  if (!cruise) R.eta = Math.max(T.ETA_MIN, Math.min(T.RIVAL_ETA_MAX, you.eta));
  // (it glides up to 0.6 s of lead a second; to come abreast for the slam it may close 1.5 s a second)
  const rate = A.phase === 'slam' ? 1.5 : 0.6;
  if (want !== null) R.dist += clamp((want - ahead) * 3, -rate, rate) * bps * dt;
  // after a shove it takes REMORA's reaction (220 ms) to steer back
  const sh = R.shove;
  if (sh && sh.slam && t - sh.t0 < T.SHOVE_S + 0.22) A.intent.target = R.bearing;
  else A.intent.target = R.bearing + clamp(wrap(bearing - R.bearing), -150 * dt, 150 * dt);
}

// One toy step: REMORA's script, the light's drop at 9 s, the race step, then captions. → the race's events.
export function stepToy(game, intents, dt) {
  const { race } = game, T = game.T;
  const you = race.ships[0];
  remoraStep(game, dt);
  if (!game.script.dropped && race.t >= 9) {
    game.script.dropped = true;
    you.gap = Math.min(you.gap, TOY_TTC_DROP * (1 - Math.tanh(you.eta)));
    you.ttc = you.gap / Math.max(1e-9, 1 - Math.tanh(you.eta));
  }
  const ev = race.t >= TOY_S ? [] : stepRace(race, intents, dt);
  // TTC = gap ÷ (1 − β) is a definition; keep it true while survival.js is still a stub
  for (const s of race.ships) if (!s.caught) s.ttc = s.gap / Math.max(1e-9, 1 - Math.tanh(s.eta));
  caption(game, 'time');
  for (const e of ev) {
    if (e.ship === 'you' || (e.type === 'eaten' && e.id === 'remora')) caption(game, e.type, e.t);
    if (e.type === 'release' && e.ship === 'you') {
      const rank = (g) => ['PERFECT', 'GOOD', 'WIDE'].indexOf(g);
      if (!game.grade || rank(e.grade) < rank(game.grade)) game.grade = e.grade;
    }
  }
  if (race.t >= TOY_S && !game.sum) game.sum = toySummary(game);
  return ev;
}

// The card at 30 s (24.2): top speed (gear and η), grazes, the whip's best grade, slingshot and takedown yes or no.
export function toySummary(game) {
  const you = game.race.ships[0];
  const st = you.stats;
  return { topGear: st.topGear, eta: you.eta, grazes: st.grazes + st.hairs, hairs: st.hairs, whips: st.whips,
    grade: game.grade || null, slingshot: st.slings > 0, takedown: st.takedowns > 0, hits: st.hits };
}

export { NO_INTENT };
