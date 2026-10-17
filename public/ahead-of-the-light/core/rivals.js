// Ahead of the Light: rivals (final.md 10): the roster and its barks, the field on the grid, perception, the modes
// (CRUISE, DRAFT, HUNT with the lean, BLOCK, WHIP, FLEE, SCATTER), mistakes, standings and the Nemesis. Rivals are
// bots that send the same intents as the player to the same stepRace: their line comes from bots.js's human() driver
// with their own knobs, and their personalities only choose where to steer, when to press, lift and burn. Nothing
// else moves them, so every change in a rival's speed and gap comes from an event the player could see.
// Pure: no clocks, no Math.random. Drivers and per-leg bookkeeping live in WeakMaps; ship.ai is plain data.
import { TUNE } from './tune.js';
import { emit, E } from './events.js';
import { createShip, bpsOf, windowOf, slamAim, sweepTime } from './handle.js';
import { resolve, wrap, psiAt, railOn, halfAt, wellCore } from './course/kinds.js';
import { beatsPerS } from './ringmath.js';
import { mulberry32, hashSeed } from '../../light-years-home/core/rng.js';
import { bossInit, bossThink, bossFast, BOSSES } from './bosses.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isOut = (s) => s.caught || s.wrecked;
const sgn = (v) => (v >= 0 ? 1 : -1);

// ---------------------------------------------------------------- the roster (10.2, 10.3)

const K = (reactMs, jitterDeg, greed, whipGreed, draftSkill, ramBias, blockBias) =>
  Object.freeze({ reactMs, jitterDeg, greed, whipGreed, draftSkill, ramBias, blockBias });
const deep = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object') deep(v); return o; };

// The 7 named ships and the drifter: kind, half-width, turn, meters, driving knobs (Act II), burn policy, band choice
// for whips, motif and silhouette (for render and sound), the rule and weakness (the chart's boss card and the log),
// and barks: { key: line }, each 2 to 5 words and 24 characters at most.
export const ROSTER = deep({
  hound: { id: 'hound', name: 'HOUND', kind: 'regular', half: 3.5, ship: 'broad-notched', motif: 'low-fifth-growl',
    knobs: K(190, 3.0, 0.4, 0.5, 0.5, 0.8, 0.2), burn: 'close', band: 'you',
    rule: 'Steers for your bearing and rams when close.', weakness: 'Target fixation: hairline a knot with it behind.',
    barks: { start: 'SAME ROAD. MY ROAD.', close: 'SMELL YOU, ROOKIE.', ram: 'MOVE.', down: 'STAY DOWN.',
      passed: 'LUCKY LINE.', downed: 'YOU\'LL KEEP.', nemesis: 'I REMEMBER FACES.', glare: 'NOT LIKE THIS.',
      eaten: 'WORTH IT.' } },
  pike: { id: 'pike', name: 'PIKE', kind: 'regular', half: 3.5, ship: 'needle', motif: 'two-high-clicks',
    knobs: K(170, 2.0, 0.5, 0.6, 0.6, 0.3, 0.9), burn: 'climb', band: 'gap',
    rule: 'Takes the gap first and copies your pull-out.', weakness: 'Commits to a block: feint.',
    barks: { start: 'INSIDE LINE\'S MINE.', gap: 'MY GAP.', block: 'DOOR\'S SHUT.', feint: 'HM. CLEAN.',
      downed: 'UNPLANNED.', nemesis: 'NOTED. TWICE.', glare: 'RECALCULATING.', eaten: 'BAD ANGLE.' } },
  remora: { id: 'remora', name: 'REMORA', kind: 'regular', half: 3.5, ship: 'ring-nose', motif: 'rising-boop',
    knobs: K(220, 3.5, 0.2, 0.4, 1.0, 0, 0), burn: 'sling', band: 'wake',
    rule: 'Rides whoever is ahead, then slingshots past.', weakness: 'Blind in a wake: dodge late.',
    barks: { start: 'MIND IF I TAG ALONG?', tuck: 'NICE WAKE, PAL.', sling: 'THANKS FOR THE TOW!',
      shaken: 'HEY, WAIT UP!', trapped: 'YOU DID THAT ON PURPOSE.', boss: 'FREE RIDE!', downed: 'OW. FAIR.',
      glare: 'PAL? PAL!', eaten: 'SHOULD\'VE LET GO.' } },
  moth: { id: 'moth', name: 'MOTH', kind: 'regular', half: 3.5, ship: 'wing-dots', motif: 'fast-trill',
    knobs: K(240, 5.0, 0.95, 0.95, 0.3, 0.1, 0), burn: 'glare', band: 'far',
    rule: 'Grazes everything and scatters up close.', weakness: 'Greed: it hits a lot and lingers near the light.',
    barks: { start: 'OOH, IT\'S SO BRIGHT.', hair: 'WHEEE!', hit: 'OW OW OW.', scatter: 'EEK! TOO CLOSE.',
      warm: 'IT\'S SO WARM...', scorch: 'SHINY. HOT.', downed: 'RUDE!', eaten: 'SO BRIGHT...' } },
  whale: { id: 'whale', name: 'WHALE', kind: 'boss', half: 10, turn: 120, ship: 'whale', motif: 'whale-song',
    knobs: K(200, 2.0, 0, 0, 0, 0, 0), burn: 'never', band: 'none', meters: { hull: 3, shield: 1, fuel: 6, fuelCap: 6 },
    card: 'BEHIND IT IS SAFE. BESIDE IT IS ROUGH.', beat: 'CROSS THE GATE LINE AHEAD OF IT.',
    rule: 'Its wake tows, its bow wave shoves, and it breaches.', weakness: 'Draft it and slingshot past.',
    barks: { start: 'LONG. WAY. HOME.', tuck: 'FOLLOW. THEN.', bow: 'MIND. THE. WASH.', passed: 'FAST. LITTLE. ONE.' } },
  mako: { id: 'mako', name: 'MAKO', kind: 'boss', half: 4.5, ship: 'dorsal-spike', motif: 'two-note-hunt',
    knobs: K(150, 1.5, 0.6, 0.7, 0.8, 1.0, 0), burn: 'hunt', band: 'safe', meters: { hull: 3, shield: 1, fuel: 4,
      fuelCap: 4 },
    card: 'IT HUNTS THE SHIP WITH THE FEWEST CELLS.', beat: 'FINISH AHEAD, OR TAKE IT DOWN TWICE.',
    rule: 'Hunts the ship with the fewest fuel cells.', weakness: 'It rolls after a ram: slam it then.',
    barks: { start: 'I COUNT CELLS.', finYou: '{N} CELLS. MINE.', finRival: '{NAME} IS BLEEDING.', ram: 'BITE.',
      downed: 'TEETH. GOOD.', backOff: 'ANOTHER DAY.', eaten: 'HUNGRY...' } },
  manta: { id: 'manta', name: 'MANTA', kind: 'boss', half: 10, ship: 'sail-arc', motif: 'airy-chord',
    knobs: K(180, 2.0, 0, 0, 0, 0, 0), burn: 'never', band: 'none', meters: { hull: 2, shield: 0, fuel: 0, fuelCap: 0 },
    card: 'IT RIDES THE LIGHT. GET BETWEEN THEM.', beat: 'REACH THE DOOR AHEAD OF IT.',
    rule: 'The light pushes its sail.', weakness: 'Sit behind it: no light reaches the sail.',
    barks: { start: 'THE LIGHT IS A WIND.', lane: 'HERE IT COMES.', passed: 'FLY WITH IT.',
      shadow: 'YOU\'RE IN MY LIGHT.', torn: 'BECALMED.', eaten: 'IT CARRIED ME.' } },
  drifter: { id: 'drifter', name: '', kind: 'drifter', half: 3.5, ship: 'dot', motif: null,
    knobs: K(300, 7, 0.2, 0, 0.2, 0, 0), burn: 'never', band: 'none', barks: {} },
});
export const REGULARS = Object.freeze(['hound', 'pike', 'remora', 'moth']);
const NUM = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
const QUIET = new Set(['hit', 'release', 'thread', 'dock', 'past', 'gateLine', 'caught']);

// The act of a leg: I for legs 1 to 3, II for 4 to 6, III for 7 and 8.
export const actOf = (legNo) => (legNo <= 2 ? 1 : legNo <= 5 ? 2 : 3);

// Three regulars race; the fourth waits in reserve. The seed fixes them, so a daily route meets the same three.
export function pickRegulars(seed) {
  const rnd = mulberry32(hashSeed('regulars', seed));
  const ids = [...REGULARS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { racing: ids.slice(0, 3), reserve: ids[3] };
}

// A rival's knobs for a leg: the roster's Act II table, Act I (+40 ms, jitter × 1.3) or Act III (−30 ms, × 0.75),
// REDSHIFT 2 (−40 ms), a Nemesis's ramBias + NEM_RAM_BIAS. Rams are off in leg 1 and half strength in legs 2 and 3.
export function knobsFor(id, legNo, { redshift = 0, nemesis = false, tune = TUNE } = {}) {
  const R = ROSTER[id] || ROSTER.drifter, k = R.knobs, act = actOf(legNo);
  let react = k.reactMs, jit = k.jitterDeg;
  if (R.kind !== 'boss' && R.kind !== 'drifter') {
    if (act === 1) { react += 40; jit *= 1.3; }
    if (act === 3) { react -= 30; jit *= 0.75; }
  }
  if (redshift >= 2) react -= 40;
  let ram = k.ramBias + (nemesis ? tune.NEM_RAM_BIAS : 0);
  if (legNo === 0) ram = 0;
  else if (legNo <= 2 && R.kind !== 'boss') ram *= 0.5;
  return { reactMs: Math.max(60, react), jitterDeg: jit, greed: k.greed, whipGreed: k.whipGreed,
    draftSkill: k.draftSkill, ramBias: ram, blockBias: legNo >= 2 ? k.blockBias : 0 };
}

// ---------------------------------------------------------------- per-race state

const RACES = new WeakMap();
const DRIVE = new WeakMap();              // ship → { variants: Map(key → driver), seed }
const SNAPS = 32;                         // the perception ring: 1.6 s of 50 ms snapshots

function stateOf(race) { return RACES.get(race) || null; }

function newState(race, rng) {
  const S = {
    rng, head: -1, lastSnap: -1e9, out: {},
    nem: {},                               // per regular: { slamsYou, slammedByYou }
    nemesis: null, newNemesis: null, settled: null, settledIds: new Set(),
    eaten: [], fed: [], takedowns: [], backedOff: false,
    bark: { last: -1e9, quiet: -1e9, used: new Set(), started: false },
    ahead: {},                             // per rival: was it ahead of you last step (for 'passed')
    cueLandmarks: [], nextLm: 0,
  };
  RACES.set(race, S);
  return S;
}

// The perception ring (18.2 race.snaps): every TICK, each ship's bearing and dist. Preallocated plain arrays.
function snapStep(race, S, T) {
  if (race.t - S.lastSnap < T.TICK - 1e-9) return;
  S.lastSnap = race.t;
  const n = race.ships.length;
  if (race.snaps.length < SNAPS) {
    for (let i = race.snaps.length; i < SNAPS; i++) race.snaps.push({ t: -1e9, b: new Array(n).fill(0), d: new Array(n).fill(0) });
  }
  S.head = (S.head + 1) % SNAPS;
  const s = race.snaps[S.head];
  s.t = race.t;
  for (let i = 0; i < n; i++) { s.b[i] = race.ships[i].bearing; s.d[i] = race.ships[i].dist; }
}

// A ship's bearing as seen `delay` seconds ago (the newest snapshot at or before then; now if none is that old).
export function perceived(race, index, delay) {
  const S = stateOf(race);
  const now = race.ships[index] ? race.ships[index].bearing : 0;
  if (!S || S.head < 0 || !(delay > 0)) return now;
  const want = race.t - delay;
  for (let k = 0; k < SNAPS; k++) {
    const s = race.snaps[(S.head - k + SNAPS) % SNAPS];
    if (!s || s.t < -1e8) break;
    if (s.t <= want + 1e-9) return s.b[index];
  }
  return now;
}

// ---------------------------------------------------------------- the field (10.1)

const secToBeats = (s, eta, T) => s * beatsPerS(eta, T);
const WHALE_AHEAD = 1.5;                  // s: the WHALE starts this far ahead of the front of the grid (rivals 2.2)
const WHALE_ETA = 1.3;                    // its launch η (its η swings between 1.3 and 1.8, 10.3)

function rivalShip({ id, roster, bearing, eta, meters, knobs, legNo, T, extra = {} }) {
  const R = ROSTER[roster];
  const s = createShip({ id, kind: R.kind, type: roster, name: R.name || '', bearing, eta, meters, tune: T });
  s.half = R.half;
  s.turnMax = R.turn || T.TURN_MAX;
  s.ai = { id: roster, knobs, act: actOf(legNo), mode: 'cruise', nextTick: 0, target: null, nemesis: false,
    intent: { target: bearing, turn: 0, action: null, burn: false }, goal: bearing,
    lean: null, flickUntil: -1, cool: -1, block: null, blockCd: -1, scatterUntil: -1, warmUntil: -1, lastBurn: -9,
    whip: null, holdUntil: -1, slingBurn: -1, hard: null, breachUntil: -1, ...extra };
  return s;
}

// The ships on the grid for a leg (not you). leg: the built leg (its field: { regulars, drifters, boss, none }); you:
// your ship (its launch speed spaces the grid). Without a run or a leg it is an empty field (a bare leg, the toy).
// Leg 1: the three regulars 0.6, 1.2 and 1.8 s ahead, passive. Later legs: the named ships in the order they crossed
// the last gate, GRID_GAP apart, you in your place, your Nemesis right behind you; each keeps its hull and gap, starts
// with its shield up and at least RIVAL_FUEL_MIN fuel (a Nemesis +1), and launches at 1.6, or docks (hull +2, η 0.8,
// 1.5 s of gap) at 1 hull. Bosses on their legs (the WHALE 1.5 s ahead of the front, MAKO 0.6 s behind you, MANTA
// behind the field near its light); at Earth, MANTA then the bosses you did not beat, your Nemesis and the regulars,
// four named ships at most. Drifters 1 to 4 s ahead with a gap of 3 to 6 s; in leg 1 the slowest meets its hard moment
// at the leg's drifter cue, so the light takes it about 25 s in on the burst ring's visible side.
export function createField({ run = null, legNo = 0, rng = null, tune = TUNE, leg = null, you = null } = {}) {
  const T = tune;
  if (!run || !leg) return [];
  const F = leg.field || { regulars: 3, drifters: 0, boss: null };
  if (F.none) return [];
  const rnd = typeof rng === 'function' ? rng : mulberry32(hashSeed('field', run.seed, legNo));
  const youEta = you ? you.eta : T.ETA0;
  const f = run.field || { racing: [], order: [], rivals: {}, bosses: {} };
  const recs = f.rivals || {};
  const ships = [];
  const nemId = Object.keys(recs).find((k) => recs[k].nemesis && recs[k].alive !== false && !recs[k].settled) || null;
  const knobOf = (id) => knobsFor(id, legNo, { redshift: run.redshift || 0, nemesis: id === nemId, tune: T });
  const regs = (f.racing || []).filter((id) => ROSTER[id] && (!recs[id] || recs[id].alive !== false));
  const count = Math.min(regs.length, finite(F.regulars) ? F.regulars : 3);

  // who lines up: at Earth MANTA, the unbeaten bosses, your Nemesis, then the regulars, four named at most
  let named = [];
  if (F.boss === 'manta') {
    named.push('manta');
    for (const b of ['whale', 'mako']) if (f.bosses && f.bosses[b] === 'lost') named.push(b);
    const order = orderOf(f, regs);
    if (nemId && regs.includes(nemId)) named.push(nemId);
    for (const id of order) if (!named.includes(id)) named.push(id);
    named = named.slice(0, 4);
  } else {
    named = orderOf(f, regs).slice(0, count);
    if (F.boss) named.push(F.boss);
  }

  // the grid: seconds ahead of you (+) or behind (−)
  const grid = new Map();
  if (legNo === 0) {
    named.filter((id) => ROSTER[id].kind === 'regular').forEach((id, i) => grid.set(id, T.LEG1_GAPS[i] ?? 0.6 * (i + 1)));
  } else {
    const line = (f.order && f.order.length ? f.order : ['you']).filter((id) => id === 'you' || named.includes(id));
    if (!line.includes('you')) line.unshift('you');
    for (const id of named) if (!line.includes(id) && ROSTER[id].kind === 'regular') line.push(id);
    if (nemId && line.includes(nemId)) {
      line.splice(line.indexOf(nemId), 1);
      line.splice(line.indexOf('you') + 1, 0, nemId);
    }
    const k = line.indexOf('you');
    line.forEach((id, i) => { if (id !== 'you' && ROSTER[id].kind === 'regular') grid.set(id, (k - i) * T.GRID_GAP); });
  }
  const front = Math.max(0, ...grid.values());
  const back = Math.min(0, ...grid.values());

  named.forEach((id, i) => {
    const R = ROSTER[id];
    const side = i % 2 ? -1 : 1;
    const bearing = wrap(side * (14 + 9 * i) + (rnd() * 2 - 1) * 4);
    if (R.kind === 'regular') {
      const rec = recs[id] || { hull: T.HULL0, fuel: T.RIVAL_FUEL_MIN, gap: T.GAP0 };
      let hull = finite(rec.hull) ? rec.hull : T.HULL0, gap = finite(rec.gap) ? rec.gap : T.GAP0;
      let eta = legNo === 0 ? T.ETA0 : T.LAUNCH_THREAD;
      if (legNo > 0 && hull <= 1) { hull = Math.min(T.HULL_MAX, hull + 2); eta = T.LAUNCH_DOCK; gap -= T.REPAIR_S; }
      const fuel = Math.max(finite(rec.fuel) ? rec.fuel : 0, T.RIVAL_FUEL_MIN) + (id === nemId ? 1 : 0);
      const s = rivalShip({ id, roster: id, bearing, eta, legNo, T, knobs: knobOf(id),
        meters: { hull, hullMax: T.HULL_MAX, shield: T.SHIELD_MAX, shieldMax: T.SHIELD_MAX, fuel: Math.min(fuel, T.FUEL_CAP),
          fuelCap: T.FUEL_CAP, gap: Math.max(0.5, gap) } });
      s.dist = secToBeats(grid.get(id) ?? 0, youEta, T);
      s.ai.nemesis = id === nemId;
      ships.push(s);
      return;
    }
    // a boss
    const M = R.meters;
    const cap = T.GAP_CAP[legNo] ?? T.GAP0;
    let at = 0, eta = T.LAUNCH_THREAD, gap = cap, b = bearing;
    if (id === 'whale') { at = front + WHALE_AHEAD; eta = WHALE_ETA; b = 0; }
    else if (id === 'mako') { at = -T.MAKO.startBehind; b = side * 8; }
    else if (id === 'manta') {
      gap = T.MANTA.startGap;
      eta = T.ETA0;
      at = Math.min(back - 1, -Math.max(1, (you ? you.gap : T.GAP0) - 0.5));
      b = side * 30;
    }
    const s = rivalShip({ id, roster: id, bearing: b, eta, legNo, T, knobs: knobOf(id),
      meters: { hull: M.hull, hullMax: M.hull, shield: M.shield, shieldMax: M.shield, fuel: M.fuel, fuelCap: M.fuelCap,
        gap } });
    s.dist = secToBeats(at, youEta, T);
    bossInit(s, T);
    ships.push(s);
  });

  // drifters: nameless, slow and new each leg
  const nd = finite(F.drifters) ? F.drifters : 0;
  const cue = legNo === 0 ? leg.items.find((it) => it.kind === 'cue' && it.name === 'drifter') : null;
  for (let i = 0; i < nd; i++) {
    const [s0, s1] = T.DRIFT_START, [g0, g1] = T.DRIFT_GAP;
    const ahead = i === 0 && cue ? s0 : s0 + rnd() * (s1 - s0);
    let gap = g0 + rnd() * (g1 - g0);
    const bearing = wrap((rnd() < 0.5 ? -1 : 1) * (25 + rnd() * 95));
    const knobs = knobsFor('drifter', legNo, { tune: T });
    let hard = null;
    if (i === 0 && cue) {
      // the slow one: it reaches the cue in the glare (TTC about 2 s), so its hard moment there is the catch
      const bps = beatsPerS(T.ETA0, T);
      const tCue = Math.max(4, (cue.beat - ahead * bps) / bps);
      gap = clamp(T.BLEED * (1 - Math.tanh(T.ETA0)) * (tCue + 2), g0, g1);
      knobs.greed = 0;
      hard = { beat: cue.beat, psi: cue.data && finite(cue.data.psi) ? cue.data.psi : bearing };
    }
    const s = rivalShip({ id: `drifter-${i + 1}`, roster: 'drifter', bearing, eta: T.ETA0, legNo, T, knobs,
      meters: { hull: T.HULL0, hullMax: T.HULL_MAX, shield: T.SHIELD_MAX, shieldMax: T.SHIELD_MAX, fuel: 0, fuelCap: 0,
        gap }, extra: { hard } });
    s.dist = secToBeats(ahead, youEta, T);
    ships.push(s);
  }

  // each rival's driver seed (its own stream, so the field replays exactly)
  for (const s of ships) {
    const seed = Math.floor(rnd() * 4294967296);
    DRIVE.set(s, { variants: new Map(), seed });
    s.ai.seed = seed;
    s.ai.rnd = null;
  }
  return ships;
}

// The named regulars in standing order (the last gate's), then any racing regular the order does not hold.
function orderOf(f, regs) {
  const out = [];
  for (const id of f.order || []) if (regs.includes(id) && !out.includes(id)) out.push(id);
  for (const id of regs) if (!out.includes(id)) out.push(id);
  return out;
}

// ---------------------------------------------------------------- the line (10.4)

// A ship's own small random stream (deterministic per race).
function rndOf(ship) {
  const A = ship.ai;
  if (!A.rnd) A.rnd = mulberry32(hashSeed('rival', A.seed || 1, ship.id));
  return A.rnd;
}
const gauss = (rnd) => {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// The rival's line, 10.4's cost search: 72 bearings 5° apart, then ±5° in 1° steps round the best. The ship's path
// to a bearing turns at PATH_RATE, so each item is judged where the ship will be when it passes (a rail at its
// bearing then, a knot met on the way). Cost: a hazard hit within LOOK +50 + 100 × urgency (× the mode's hazard
// weight); a hairline −8 × greed, a graze −4 × greed; turning +0.02 a degree; a wake 0.08 to 0.8 s ahead within 5°
// −6 × draftSkill (REMORA × 2); a fuel cell on the line −3 × need; a gate's thread, or its dock at 1 hull; and the
// mode's own pull (`want`). Allocation-light: the items are gathered once a think into a reused list.
const PATH_RATE = 480;                     // °/s a rival's line turns at, for judging where it will be
const SAMPLES = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.95, 1.3];
const LINE = new WeakMap();

function gather(race, r, T, look) {
  let L = LINE.get(r);
  if (!L) { L = { list: [] }; LINE.set(r, L); }
  const out = L.list;
  out.length = 0;
  const items = race.leg.items, bps = bpsOf(r, T), d = r.dist;
  const dropped = race.director && race.director.dropped;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'cue' || it.kind === 'fog' || (dropped && dropped[it.id])) continue;
    if (it.kind === 'pickup') {
      const w = race.wells[it.id];
      if (w && w.holder) continue;
    }
    const t = (it.beat - d) / bps;
    if (it.end !== undefined) {
      const tEnd = (it.end - d) / bps;
      if (tEnd <= 0 || t > look) continue;
      const x = { it, t: Math.max(0, t), tEnd, bps, ss: null, ps: null, near: Infinity };
      if (it.kind === 'rail') railSamples(x, r, look);
      out.push(x);
    } else if (t > 0 && t <= look) out.push({ it, t, tEnd: t, bps, ss: null, ps: null, near: nearOf(it, r, T) });
  }
  return out;
}

// A rail's samples for lineCost, the same for every bearing tried this think: the times it is judged at and its
// bearing then (NaN while it is off). Speed only: lineCost reads these instead of calling railOn and psiAt per try.
function railSamples(x, r, look) {
  const it = x.it, ss = [], ps = [];
  for (let j = -1; j < SAMPLES.length; j++) {
    const s = j < 0 ? x.t : SAMPLES[j];
    if (j < 0 && !(x.t > 0)) continue;
    if (s < x.t || s > x.tEnd || s > look) continue;
    const beat = r.dist + x.bps * s;
    ss.push(s);
    ps.push(railOn(it, beat) ? psiAt(it, beat) : NaN);
  }
  x.ss = ss;
  x.ps = ps;
}

// For an instant item, the edge gap past which it adds nothing to a line's cost (no hit, graze, hairline or margin
// term), measured as resolve does: |bearing − psi| − ship half − the mass's half. Infinity: always judge it (walls,
// gates). Speed only: lineCost skips resolve for an item it passes further off than this.
function nearOf(it, r, T) {
  if (it.kind === 'knot') return { half: it.half || 0 };
  if (it.kind === 'pulse') return { half: halfAt(it, it.beat) };
  if (it.kind === 'well') return { half: wellCore(it, T) };
  if (it.kind === 'pickup') return { half: 0, pick: true };
  return Infinity;
}

const pathAt = (cur, delta, t, rate) => cur + (delta >= 0 ? 1 : -1) * Math.min(Math.abs(delta), rate * t);

function lineCost(race, r, A, T, list, delta, o) {
  const cur = r.bearing, rate = delta >= 0 ? o.rateR : o.rateL, look = T.LOOK;
  let c = 0.02 * Math.abs(delta);
  for (let i = 0; i < list.length; i++) {
    const x = list[i], it = x.it;
    if (it.end !== undefined) {
      if (it.kind !== 'rail') continue;
      let prev = NaN, soft = 0;
      const ss = x.ss, ps = x.ps;
      for (let j = 0; j < ss.length; j++) {
        const s = ss[j], psi = ps[j];
        const b = pathAt(cur, delta, s, rate);
        if (psi !== psi) { prev = NaN; continue; }    // NaN: the rail is off then
        const dd = wrap(b - psi);
        if (s === 0) { prev = dd; continue; }          // now is not a choice: judge from the first step on
        const g = Math.abs(dd) - r.half - it.half;
        if (g < 0 || (finite(prev) && (prev < 0) !== (dd < 0) && Math.abs(dd) < 90)) {
          c += o.hazW * (50 + 100 * Math.max(0, look - s) / look);
          soft = 0;
          break;
        }
        // keep off its edge by the wobble (softly, so a narrow channel still has a middle), and skim if greedy
        if (g < o.railM) soft = Math.max(soft, 1 - g / o.railM);
        if (g <= (it.skimBand ?? T.SKIM_BAND)) c -= 1.5 * o.greed;
        prev = dd;
      }
      c += o.hazW * 30 * soft;
      continue;
    }
    const b = pathAt(cur, delta, x.t, rate);
    const nr = x.near;
    if (nr !== Infinity) {
      // too far off to count: skip resolve (the same answer, no allocation)
      const g = Math.abs(wrap(b - it.psi)) - r.half - nr.half;
      if (nr.pick ? g > (T.PICK_DEG ?? TUNE.PICK_DEG) : g >= Math.max(T.GRAZE, T.HAIR, o.margin)) continue;
    }
    const res = resolve(it, b, it.beat, T, r.half);
    if (it.kind === 'pickup') {
      if (res.take && it.type === 'fuel' && r.fuelCap > 0) c -= 3 * (1 - r.fuel / r.fuelCap);
      else if (res.take && it.type === 'patch' && r.hull < r.hullMax) c -= 3;
      continue;
    }
    if (res.hit) { c += o.hazW * (50 + 100 * Math.max(0, look - x.t) / look); continue; }
    if (o.margin > 0 && res.overlap < o.margin) c += o.hazW * 40 * (1 - o.greed) * (1 - res.overlap / o.margin);
    const gaps = res.gaps;
    for (let j = 0; j < gaps.length; j++) {
      const g = gaps[j].g;
      if (g < T.HAIR) c -= 8 * o.greed * o.hairX;
      else if (g < T.GRAZE) c -= 4 * o.greed;
    }
    if (res.thread) c -= it.pair ? 6 * (0.3 + o.greed) : o.dock ? 0 : 20;
    if (res.tag === 'dock') c -= o.dock ? 25 : 0;
  }
  const b = cur + delta;
  let waked = false;
  // the other ships, as bestLine found them this think (o.others: bearing, room, wake, half)
  const others = o.others;
  for (let i = 0; i < others.length; i++) {
    const s = others[i];
    // room: a ship abreast is a bump waiting to happen (unless it is the prey)
    if (s.room && Math.abs(wrap(b - s.bearing)) < r.half + s.half + 3) c += 12;
    if (!waked && s.wake && Math.abs(wrap(b - s.bearing)) <= 5) {
      c -= o.wakeW;
      waked = true;
    }
  }
  if (finite(o.want) && Math.abs(wrap(b - o.want)) <= o.wantDeg) c -= o.wantW;
  if (finite(o.prev) && Math.abs(wrap(b - o.prev)) <= 3) c -= 1;       // a little hold, so the line does not flap
  return c;
}

// The best bearing (unwrapped, near the ship's) and its cost. o: { greed, hazW, hairX, wakeW, dock, want, wantDeg,
// wantW, prev, rate }.
function bestLine(race, r, A, T, o) {
  const list = gather(race, r, T, T.LOOK);
  // the other ships' place in seconds does not change while the bearings are tried: find it once
  const others = [];
  for (const s of race.ships) {
    if (s === r || isOut(s) || s.whip) continue;
    const z = aheadS(r, s, T);
    const room = Math.abs(z) <= T.CONTACT_Z * 1.5 && s.id !== o.prey;
    const wake = o.wakeW > 0 && z >= T.WAKE_NEAR && z <= T.WAKE_FAR;
    if (room || wake) others.push({ bearing: s.bearing, half: s.half, room, wake });
  }
  o.others = others;
  o.rateR = guarded(race, r, T, 1) ? GUARD_RATE : o.rate;
  o.rateL = guarded(race, r, T, -1) ? GUARD_RATE : o.rate;
  let best = 0, bc = Infinity;
  for (let k = -36; k < 36; k++) {
    const d = k * 5;
    const c = lineCost(race, r, A, T, list, d, o);
    if (c < bc) { bc = c; best = d; }
  }
  const mid = best;
  for (let d = mid - 5; d <= mid + 5; d++) {
    if (d === mid) continue;
    const c = lineCost(race, r, A, T, list, d, o);
    if (c < bc) { bc = c; best = d; }
  }
  // commit: keep the line it chose last unless the new one is clearly better (no flapping between two lines)
  if (finite(o.prev)) {
    const dp = o.prev - r.bearing;
    if (Math.abs(dp) < 180) {
      const cp = lineCost(race, r, A, T, list, dp, o);
      if (cp <= bc + LINE_HOLD) return { b: o.prev, cost: cp, list };
    }
  }
  return { b: r.bearing + best, cost: bc, list };
}
const LINE_HOLD = 1.5;                     // cost a new line must win by
const BLIND_EXTRA = 0.15;                  // s: REMORA in a wake sees its leader's swerve this much after its reaction
const DRIFT_FELT = 6;                      // °: ... but feels its leader drift this far off its late view at once
const CLOSE_FROM = 3;                      // s: HOUND burns to close on you from this far behind
const REMORA_SLING = 0.12;                 // s: REMORA rides a wake to its leader's tail before it slingshots
const RAIL_M = 3;                          // ° a rival keeps off a rail's edge (a bump is 6°), plus its wobble

// ---------------------------------------------------------------- the AI step (18.3 part 8)

// Every rival's intent: { [shipId]: { target, turn, action, burn } } (reused objects). Each rival thinks on its own
// TICK (ship.ai.nextTick): its mode, its line through the driver, and the personality's overrides. Every step it
// also times its whip press and lift, its lean and flick, waits its reaction after a shove, and never turns into a
// ship beside it fast enough to SLAM without the lean (so every rival SLAM is told 0.3 s ahead). It reads this
// step's events for the Nemesis, the standings, PIKE's blocks and the barks.
export function rivalIntents(race, dt, tune = race.tune || TUNE) {
  const T = tune;
  let S = stateOf(race);
  const ships = race.ships;
  if (!S) {
    if (!ships.some((s) => s.ai && DRIVE.has(s))) return null;
    S = newState(race, null);
    initLeg(race, S, T);
  }
  if (race.phase === 'done') return S.out;
  snapStep(race, S, T);
  const you = ships[0];
  for (let i = 1; i < ships.length; i++) {
    const r = ships[i];
    if (!r.ai || !DRIVE.has(r)) continue;
    r.ai.intent.action = null;
    r.ai.intent.burn = false;
    S.out[r.id] = r.ai.intent;
  }
  readEvents(race, S, T, you);
  for (let i = 1; i < ships.length; i++) {
    const r = ships[i];
    if (!r.ai || !DRIVE.has(r) || isOut(r)) continue;
    const A = r.ai;
    if (race.t >= A.nextTick - 1e-9) {
      A.nextTick = Math.max(A.nextTick + T.TICK, race.t);
      think(race, r, i, A, T, S, you);
    }
    fast(race, r, i, A, T, S, you, dt);
  }
  barkTicks(race, S, T, you);
  return S.out;
}

function initLeg(race, S, T) {
  for (const it of race.leg.items) {
    if (it.kind === 'cue' && (it.name === 'landmark' || it.name === 'gate')) S.cueLandmarks.push(it.beat);
  }
  const you = race.ships[0];
  for (const s of race.ships) if (s !== you) S.ahead[s.id] = s.dist > you.dist;
  // stagger the ticks so the field does not think on the same step
  let k = 0;
  for (const s of race.ships) if (s.ai && DRIVE.has(s)) { s.ai.nextTick = (k++ % 6) * T.TICK / 6; }
  S.nemesis = race.ships.find((s) => s.ai && s.ai.nemesis) ? race.ships.find((s) => s.ai && s.ai.nemesis).id : null;
}

const shipIdx = (race, id) => { for (let i = 0; i < race.ships.length; i++) if (race.ships[i].id === id) return i; return -1; };
const byId = (race, id) => { const i = shipIdx(race, id); return i < 0 ? null : race.ships[i]; };
// Seconds ship b is ahead of ship a (− behind), at a's course speed.
const aheadS = (a, b, T) => (b.dist - a.dist) / bpsOf(a, T);

// ---------------------------------------------------------------- events: Nemesis, standings, blocks, barks

function readEvents(race, S, T, you) {
  const ev = race.events;
  // your moments first: a bark never plays within BARK_QUIET of your hit, release, gate or catch
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.ship === you.id && QUIET.has(e.type)) S.bark.quiet = race.t + T.BARK_QUIET;
  }
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    switch (e.type) {
      case E.contact: {
        if (e.kind !== 'slam') break;
        if (e.victim === you.id) { nemCount(race, S, T, e.by, 'slamsYou'); bark(race, S, T, e.by, 'ram'); }
        else if (e.by === you.id) nemCount(race, S, T, e.victim, 'slammedByYou');
        const r = byId(race, e.by);
        if (r && r.ai && r.type === 'mako') bossEvent(race, r, e, T);
        break;
      }
      case E.takedown: {
        S.takedowns.push({ by: e.by, victim: e.victim, trapped: Boolean(e.trapped), t: e.t });
        if (e.victim === you.id && e.by) { makeNemesis(race, S, T, e.by); bark(race, S, T, e.by, 'down'); }
        if (e.by === you.id) {
          if (S.nemesis === e.victim) settle(race, S, e.victim);
          else makeNemesis(race, S, T, e.victim);
          bark(race, S, T, e.victim, e.trapped ? 'trapped' : 'downed');
        }
        const v = byId(race, e.victim);
        if (v && v.kind === 'boss') bossEvent(race, v, e, T);
        break;
      }
      case E.eaten: {
        if (!S.eaten.includes(e.id)) S.eaten.push(e.id);
        if (e.fedBy === you.id && !S.fed.includes(e.id)) S.fed.push(e.id);
        if (S.nemesis === e.id) settle(race, S, e.id);
        bark(race, S, T, e.ship, 'eaten', true);
        break;
      }
      case E.glareIn:
        if (e.ship !== you.id) bark(race, S, T, e.ship, byId(race, e.ship)?.type === 'moth' ? 'warm' : 'glare');
        break;
      case E.wake: {
        const lead = byId(race, e.lead), r = byId(race, e.ship);
        if (e.lead === you.id && r) bark(race, S, T, r.id, 'tuck');
        else if (e.ship === you.id && lead && lead.type === 'whale') bark(race, S, T, lead.id, 'tuck');
        else if (r && r.type === 'remora' && lead && lead.kind === 'boss') bark(race, S, T, r.id, 'boss');
        break;
      }
      case E.slingshot: {
        if (e.lead === you.id) bark(race, S, T, e.ship, 'sling');
        const lead = byId(race, e.lead), r = byId(race, e.ship);
        if (lead && lead.ai && r && lead.ai.knobs.blockBias > 0) blockStart(race, lead, r, T, S);
        // REMORA burns only to finish a slingshot past you (or when its own light presses)
        if (r && r.ai && r.type === 'remora' && (e.lead === you.id || r.ttc < 8)) r.ai.slingBurn = race.t;
        break;
      }
      case E.shaken: if (e.ship === you.id) bark(race, S, T, e.by, 'shaken'); break;
      case E.hair: if (byId(race, e.ship)?.type === 'moth') bark(race, S, T, e.ship, 'hair'); break;
      case E.graze: {
        const r = byId(race, e.ship);
        if (r && r.type === 'pike' && e.kind === 'wall') {
          const z = aheadS(you, r, T);
          if (z > 0.1 && z < 1.0) bark(race, S, T, r.id, 'gap');
        }
        break;
      }
      case E.hit:
        if (e.ship === you.id) S.bark.quiet = race.t + T.BARK_QUIET;
        else if (byId(race, e.ship)?.type === 'moth' && e.cause === 'knot') bark(race, S, T, e.ship, 'hit');
        break;
      case E.scorch: if (byId(race, e.ship)?.type === 'moth') bark(race, S, T, e.ship, 'scorch'); break;
      case E.release: case E.thread: case E.dock: case E.past: case E.gateLine: case E.caught:
        if (e.ship === you.id) S.bark.quiet = race.t + T.BARK_QUIET;
        break;
      case E.block: if (e.on === you.id) bark(race, S, T, e.ship, 'block'); break;
      case E.bowWave: if (e.ship === you.id) bark(race, S, T, e.by, 'bow'); break;
      case E.fin: {
        const t = byId(race, e.target);
        if (t === you) {
          bark(race, S, T, e.ship, 'finYou', false, { N: NUM[Math.max(0, Math.min(6, Math.floor(you.fuel + 1e-9)))] });
        }
        else if (t && t.name) bark(race, S, T, e.ship, 'finRival', false, { NAME: t.name });
        break;
      }
      case E.backOff: S.backedOff = true; bark(race, S, T, e.ship, 'backOff'); break;
      case E.lane: if (e.target === you.id) bark(race, S, T, e.ship, 'lane'); break;
      case E.sailTorn: bark(race, S, T, e.ship, 'torn'); break;
      case E.shadow: if (e.on && e.by === you.id) bark(race, S, T, e.ship, 'shadow'); break;
      case E.nemesis: bark(race, S, T, e.ship, 'nemesis', true); break;
      default:
    }
  }
}

function nemCount(race, S, T, id, key) {
  const r = byId(race, id);
  if (!r || r.kind !== 'regular') return;
  const c = S.nem[id] || (S.nem[id] = { slamsYou: 0, slammedByYou: 0 });
  c[key]++;
  if (c.slamsYou >= T.NEM_RAMS || c.slammedByYou >= T.NEM_YOUR_RAMS) makeNemesis(race, S, T, id);
}

// The first regular to SLAM you twice in a leg, take you down, be taken down by you, or be slammed by you three
// times in a leg becomes your Nemesis: one at a time, never a boss, never one that was settled this run.
function makeNemesis(race, S, T, id) {
  const r = byId(race, id);
  if (!r || r.kind !== 'regular' || isOut(r) || S.nemesis || S.settledIds.has(id)) return;
  if (race.legNo === 0) return;
  S.nemesis = id;
  S.newNemesis = id;
  r.ai.nemesis = true;
  r.ai.knobs = { ...r.ai.knobs, ramBias: r.ai.knobs.ramBias + T.NEM_RAM_BIAS };
  emit(race, E.nemesis, r, { id });
}

function settle(race, S, id) {
  const r = byId(race, id);
  S.settled = id;
  S.settledIds.add(id);
  S.nemesis = null;
  if (S.newNemesis === id) S.newNemesis = null;
  if (r && r.ai) r.ai.nemesis = false;
  emit(race, E.settled, r || id, { id });
}

// Settled ships from earlier legs (run.field.rivals[id].settled) can never be your Nemesis again.
export function markSettled(race, ids) {
  const S = stateOf(race);
  if (S) for (const id of ids || []) S.settledIds.add(id);
}

// ---------------------------------------------------------------- barks (10.7)

// A bark for an event, or null: { speaker, name, text, key }. The rules: one per BARK_GAP across the field; none
// within BARK_QUIET of your hit, release, gate, a landmark or your catch; none in the first BARK_START s of leg 1;
// each line once a leg; a rival more than 1.5 s from you barks only when the light takes it or it becomes your
// Nemesis. A bark that cannot play now is dropped, never queued. event: any { type, ship } (the speaker is
// event.ship, or event.by for a contact or takedown on you); key: the roster's line key (else from the event).
export function barkFor(race, event, tune = race.tune || TUNE, key = null, fill = null) {
  const T = tune;
  const S = stateOf(race);
  if (!S || !event) return null;
  const id = key ? event.ship : event.by && event.victim === race.ships[0].id ? event.by : event.ship;
  const r = byId(race, id);
  if (!r || !r.ai || r.kind === 'drifter') return null;
  const k = key || keyOf(event);
  const R = ROSTER[r.type];
  let text = k && R && R.barks[k];
  if (!text) return null;
  if (fill) for (const [a, b] of Object.entries(fill)) text = text.replace(`{${a}}`, b);
  const B = S.bark, you = race.ships[0], now = race.t;
  if (race.legNo === 0 && now < T.BARK_START) return null;
  if (now - B.last < T.BARK_GAP - 1e-9 || now < B.quiet) return null;
  if (B.used.has(`${r.id}:${k}`)) return null;
  const always = k === 'eaten' || k === 'nemesis';
  if (!always && Math.abs(aheadS(you, r, T)) > 1.5) return null;
  if (text.length > T.BARK_CHARS) return null;
  B.last = now;
  B.used.add(`${r.id}:${k}`);
  return { speaker: r.id, name: r.name, text, key: k };
}
const keyOf = (e) => ({ eaten: 'eaten', nemesis: 'nemesis', glareIn: 'glare', sailTorn: 'torn', backOff: 'backOff',
  lane: 'lane', block: 'block', scorch: 'scorch' })[e.type] || null;

function bark(race, S, T, id, key, always = false, fill = null) {
  const b = barkFor(race, { type: 'bark', ship: id }, T, key, fill);
  if (b) emit(race, E.bark, b.speaker, b);
}

// Barks with no event of their own (a leg's opening line, HOUND closing on you, you passing a rival or MANTA passing
// you), and the landmarks' quiet windows.
function barkTicks(race, S, T, you) {
  const now = race.t, B = S.bark;
  while (S.nextLm < S.cueLandmarks.length && S.cueLandmarks[S.nextLm] <= you.dist) {
    B.quiet = now + T.BARK_QUIET;
    S.nextLm++;
  }
  if (!B.started && now >= (race.legNo === 0 ? T.BARK_START : 1.0)) {
    B.started = true;
    let pick = race.ships.find((s) => s.kind === 'boss' && !isOut(s)) || null;
    if (!pick) {
      let bd = Infinity;
      for (const s of race.ships) {
        if (s === you || s.kind !== 'regular' || isOut(s)) continue;
        const d = Math.abs(aheadS(you, s, T));
        if (d < bd) { bd = d; pick = s; }
      }
    }
    if (pick) bark(race, S, T, pick.id, 'start');
  }
  for (const s of race.ships) {
    if (s === you || !s.ai || isOut(s)) continue;
    const ahead = s.dist > you.dist;
    const was = S.ahead[s.id];
    S.ahead[s.id] = ahead;
    if (was === undefined || was === ahead) continue;
    if (was && !ahead) {
      if (s.ai.blockedYou && now - s.ai.blockedYou < 2) bark(race, S, T, s.id, 'feint');
      else bark(race, S, T, s.id, 'passed');
    } else if (s.type === 'manta') bark(race, S, T, s.id, 'passed');
    if (s.type === 'hound') {
      const z = aheadS(you, s, T);
      if (z < 0 && z > -0.3) bark(race, S, T, s.id, 'close');
    }
  }
  const h = race.ships.find((s) => s.type === 'hound' && !isOut(s));
  if (h) {
    const z = aheadS(you, h, T);
    if (z < -0.05 && z > -0.3) bark(race, S, T, h.id, 'close');
  }
}

// ---------------------------------------------------------------- thinking (every TICK)

const PERS = (r) => ROSTER[r.type] || ROSTER.drifter;

// Mode, line and personality. The line is 10.4's cost search with the mode's weights; the personality adds its pull
// (HUNT's prey, PIKE's door, MOTH's scatter), may take the steering (REMORA's blind trail, the slingshot pull-out, the
// slow drifter's hard moment), and decides the burn and the lean. A wobble from N(0, jitterDeg), held JITTER_HOLD,
// rides on top: the rival's natural misses.
function think(race, r, idx, A, T, S, you) {
  const now = race.t, k = A.knobs;
  if (A.backOff) { A.mode = 'gone'; A.goal = r.bearing; return; }
  // FLEE on its own time to catch (MOTH lingers 2 s, "so warm"; the WHALE and MANTA never flee)
  if (A.mode !== 'flee' && r.ttc < T.FLEE_IN && r.type !== 'manta' && r.type !== 'whale') {
    if (r.type === 'moth' && A.warmUntil < 0) A.warmUntil = now + 2;
    if (r.type !== 'moth' || now >= A.warmUntil) A.mode = 'flee';
  } else if (A.mode === 'flee' && r.ttc > T.FLEE_OUT) { A.mode = 'cruise'; A.warmUntil = -1; }
  const flee = A.mode === 'flee';
  if (!flee && A.mode !== 'block') A.mode = r.draft.lead ? 'draft' : 'cruise';
  const zYou = aheadS(you, r, T);                       // seconds ahead of you (− behind)
  const conserve = zYou > T.CONSERVE_AHEAD && r.ttc >= 8;
  const gamble = zYou < -T.GAMBLE_BEHIND;
  const lifted = r.gear > you.gear + 1;
  let greed = flee ? 0 : k.greed;
  if (conserve || lifted) greed *= 0.5;
  if (gamble) greed = Math.min(0.95, greed + 0.3);
  // care: with the shield down, at the last hull, or just after a hit, it drives tighter (fewer greedy lines, a
  // steadier hand), as a person does
  let shake = 1;
  if (r.shield < 1) greed *= 0.6;
  if (r.hull <= 1 && r.shield < 1) { greed *= 0.3; shake = 0.6; }
  if (r.stats.hits > (A.hitsSeen || 0)) { A.hitsSeen = r.stats.hits; A.hitAt = now; }
  if (now - (A.hitAt ?? -9) < 3) shake = Math.min(shake, 0.6);
  A.shake = shake;
  const o = { greed, hazW: flee ? 2 : 1, hairX: r.type === 'moth' ? 1.5 : 1,
    wakeW: flee ? 6 : 6 * k.draftSkill * (r.type === 'remora' ? 2 : 1), dock: r.hull <= 1, want: NaN, wantDeg: 6,
    wantW: 0, prev: A.line, rate: Math.min(PATH_RATE, r.turnMax || T.TURN_MAX), railM: RAIL_M + k.jitterDeg * (1 - 0.5 * greed),
    margin: k.jitterDeg };

  // HUNT: HOUND within NEM_RANGE of you, your Nemesis, MAKO on its fin target. It closes in its prey's wake, then
  // sits beside it, ready to lean; HOUND's target fixation halves its look at hazards meanwhile (× 0.6)
  let prey = null;
  if (!flee && race.legNo > 0) {
    if ((r.type === 'hound' || A.nemesis) && Math.abs(zYou) <= T.NEM_RANGE) prey = you;
    if (r.type === 'mako') prey = bossThink(race, r, A, T) || null;
  }
  if (prey && !isOut(prey)) {
    A.mode = 'hunt';
    A.target = prey.id;
    const z = aheadS(r, prey, T), off = wrap(prey.bearing - r.bearing);
    o.want = z > T.CONTACT_Z ? prey.bearing : prey.bearing - sgn(off) * (r.half + prey.half + 5);
    o.prey = prey.id;
    o.wantW = 8 * Math.max(0.3, k.ramBias) + 4;
    if (r.type === 'hound') o.hazW = 0.6;
  } else if (A.mode === 'hunt') A.target = null;
  // REMORA rides whoever is ahead: of the ships 0.08 to 1.2 s in front of it, the easiest host (near, near its
  // bearing, steady), and it keeps the one it rides
  if (r.type === 'remora' && !flee && !prey) {
    let lead = null, bz = Infinity;
    for (const s of race.ships) {
      if (s === r || isOut(s) || s.whip) continue;
      const z = aheadS(r, s, T);
      if (z < T.WAKE_NEAR || z > 1.2) continue;
      const sc = z + Math.abs(wrap(s.bearing - r.bearing)) / 60 + Math.abs(s.turnRate || 0) / 300
        - (s.id === A.host || s.id === r.draft.lead ? 0.3 : 0);
      if (sc < bz) { bz = sc; lead = s; }
    }
    A.host = lead ? lead.id : null;
    if (lead) { o.want = lead.bearing; o.wantDeg = 5; o.wantW = 14; }
    else if (r.ttc >= 10) o.greed = 0;              // nobody to ride: it coasts, grazing nothing, and waits for one
  }
  // PIKE takes your line first: ahead of you and close, it wants where you will be in 0.8 s
  if (r.type === 'pike' && !flee && race.legNo >= 2 && zYou > 0.08 && zYou < 0.6 && you.draft.lead !== r.id
    && you.draft.exitLead !== r.id && !A.block) {
    o.want = you.bearing + clamp(you.turnRate, -90, 90) * 0.8;
    o.wantW = 6;
  }
  // MOTH scatters from a ship close by: 60° away for 0.6 s
  if (r.type === 'moth' && !flee) {
    if (now >= A.scatterUntil) {
      for (const s of race.ships) {
        if (s === r || isOut(s)) continue;
        const z = Math.abs(aheadS(r, s, T)), off = wrap(s.bearing - r.bearing);
        if (z < 0.3 && Math.abs(off) < 15) {
          A.scatterUntil = now + 0.6;
          A.scatterTo = r.bearing - sgn(off) * 60;
          if (s === you) bark(race, S, T, r.id, 'scatter');
          break;
        }
      }
    }
    if (now < A.scatterUntil) { A.mode = 'scatter'; o.want = A.scatterTo; o.wantDeg = 12; o.wantW = 30; }
  }

  const L = bestLine(race, r, A, T, o);
  A.line = L.b;
  // the wobble: N(0, jitterDeg), held JITTER_HOLD
  if (now >= (A.jitterUntil || 0)) {
    A.jitter = gauss(rndOf(r)) * k.jitterDeg * (A.shake || 1);
    A.jitterUntil = now + T.JITTER_HOLD;
  }
  let j = A.jitter || 0;
  if (j && lineHits(race, r, L.b + j, 0.6, T, BIG)) j = lineHits(race, r, L.b + j / 2, 0.6, T, BIG) ? 0 : j / 2;
  let goal = L.b + j;

  // REMORA is blind in a wake: it feels its leader drift up to DRIFT_FELT (about the wake's width) at once, but a
  // swerve past that it sees only its reaction plus BLIND_EXTRA late, so it dodges only after its leader swerves (and
  // for its reaction after it drops out of the wake it still steers by that view)
  if (r.type === 'remora') {
    if (r.draft.lead) { A.trail = r.draft.lead; A.blindUntil = now + k.reactMs / 1000; }
    else if (now >= (A.blindUntil ?? -1)) A.trail = null;
  }
  if (r.type === 'remora' && A.trail && !flee) {
    const li = shipIdx(race, A.trail);
    if (li >= 0) {
      const react = k.reactMs / 1000, late = perceived(race, li, react + BLIND_EXTRA);
      const drift = clamp(wrap(race.ships[li].bearing - late), -DRIFT_FELT, DRIFT_FELT);
      goal = r.bearing + wrap(late + drift - r.bearing);
    }
  }
  // DRAFT: at full charge and close, pull out to a clear side for the slingshot (30° off PIKE; Act III feints 1 in 3)
  if (r.draft.lead && r.draft.charge >= T.SLING_CHARGE && !A.pull && k.draftSkill > 0) {
    const lead = byId(race, r.draft.lead);
    // REMORA rides: it slingshots past late in the leg, or when its own light presses; else it stays tucked in
    const ride = r.type === 'remora' && lead && you.dist < 0.7 * race.leg.beats && r.ttc >= 10;
    if (lead && !ride && aheadS(r, lead, T) <= (r.type === 'remora' ? REMORA_SLING : T.SLING_GAP)) {
      const pull = lead.type === 'pike' ? 30 : 15;
      let side = 0;
      const [clear, hold] = T.SLING_CLEAR;
      for (const s of [sgn(wrap(r.bearing - lead.bearing)), -sgn(wrap(r.bearing - lead.bearing))]) {
        if (!lineHits(race, r, lead.bearing + s * clear, hold, T) && !lineHits(race, r, lead.bearing + s * pull, hold, T)) {
          side = s;
          break;
        }
      }
      if (side) {
        const feint = actOf(race.legNo) === 3 && rndOf(r)() < 1 / 3;
        A.pull = { lead: lead.id, side, to: lead.bearing + side * pull, until: now + (feint ? 0.45 : 0.3),
          feintAt: feint ? now + 0.15 : -1, pull };
      }
    }
  }
  if (A.pull) {
    const P = A.pull, lead = byId(race, P.lead);
    if (now > P.until || !lead || (P.feintAt < 0 && !r.draft.lead && !r.draft.exitLead)
      || lineHits(race, r, P.to, 0.4, T)) A.pull = null;
    else {
      if (P.feintAt > 0 && now >= P.feintAt) { P.side = -P.side; P.to = lead.bearing + P.side * P.pull; P.feintAt = -1; }
      goal = r.bearing + wrap(P.to - r.bearing);
    }
  }
  // the slow drifter's hard moment (leg 1): onto the cue's line as it gets there
  if (A.hard) {
    const t = (A.hard.beat - r.dist) / bpsOf(r, T);
    if (t < 2.2 && t > -0.6) goal = r.bearing + wrap(A.hard.psi - r.bearing);
  }

  A.goal = goal;

  burnThink(race, r, A, T, you, { flee, conserve, gamble, lifted, zYou, prey });
  if (!flee && !A.lean && now >= A.cool && race.legNo > 0 && !r.whip) leanThink(race, r, A, T, S, you, prey);
}

// Does a bearing hit anything passing this ship within `look` seconds? (A rail is judged where it will be at each
// sample, so a turning filament counts.) kinds: optional, only these item kinds.
function lineHits(race, r, b, look, T, kinds = null) {
  const items = race.leg.items, bps = bpsOf(r, T);
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'cue' || it.kind === 'fog' || it.kind === 'pickup') continue;
    if (kinds && !kinds.includes(it.kind)) continue;
    if (it.end !== undefined) {
      if (it.kind !== 'rail') continue;
      for (let j = 1; j < SAMPLES.length && SAMPLES[j] <= look + 1e-9; j++) {
        const beat = r.dist + bps * SAMPLES[j];
        if (!railOn(it, beat)) continue;
        if (Math.abs(wrap(b - psiAt(it, beat))) - r.half - it.half < 0) return true;
      }
      continue;
    }
    const tA = (it.beat - r.dist) / bps;
    if (tA < 0 || tA > look) continue;
    if (resolve(it, b, it.beat, T, r.half).hit) return true;
  }
  return false;
}
const BIG = Object.freeze(['rail', 'wall', 'gate']);

function burnThink(race, r, A, T, you, m) {
  const now = race.t;
  if (r.fuel < 1 - 1e-9 || r.burn.t > 0 || now - A.lastBurn < 1.0 || r.whip || r.kind === 'drifter') return;
  const P = PERS(r);
  let want = false;
  if (m.flee) want = true;
  else if (m.gamble && r.fuel >= 2 - 1e-9) want = true;
  else if (P.burn === 'close') want = (m.zYou < -0.3 && m.zYou > -CLOSE_FROM && race.legNo > 0) || r.ttc < 8;
  else if (P.burn === 'climb') want = r.gear === 0;
  else if (P.burn === 'sling') want = A.slingBurn > 0 && now - A.slingBurn < 0.5 && r.surge.until > now;
  else if (P.burn === 'glare') want = r.light === 'glare';
  else if (P.burn === 'hunt') {
    const p = m.prey;
    if (p) { const z = aheadS(r, p, T); want = z > 0.3 && z < 1.0; }
  }
  if (!m.flee && (m.lifted || (m.conserve && r.ttc >= 8))) want = false;
  if (!want) return;
  A.intent.burn = true;
  A.lastBurn = now;
  if (P.burn === 'sling') A.slingBurn = -1;
}

// The lean (5.5): a rival abreast of a ship and in range may SLAM it, and always says so 0.3 s ahead. From leg 4 a
// hunter only slams when the shove would carry its prey into a hazard (slamAim); in legs 2 and 3 only when nothing
// lies within 30° past you (it spills your fuel but aims no takedown); never in leg 1. Others take the chance by
// ramBias, once a 2.0 s window per ship.
function leanThink(race, r, A, T, S, you, prey) {
  const k = A.knobs;
  if (!(k.ramBias > 0)) return;
  const cands = prey ? [prey] : race.ships;
  for (const v of cands) {
    if (v === r || isOut(v) || v.whip || v.kind === 'drifter' && !prey) continue;
    const z = aheadS(r, v, T);
    const dz = (bpsOf(v, T) - bpsOf(r, T)) / bpsOf(r, T);
    if (Math.abs(z) > T.CONTACT_Z * 0.8 || Math.abs(z + dz * (T.LEAN_S + 0.12)) > T.CONTACT_Z * 0.9) continue;
    const off = wrap(v.bearing - r.bearing), a = Math.abs(off);
    const near = r.half + v.half;
    if (a < near + 2 || a > 40) continue;
    const side = sgn(off);
    const delay = T.LEAN_S + (a - near) / (r.turnMax || T.TURN_MAX);
    let aimed = false;
    if (race.legNo <= 2) {
      if (v === you && hazardPast(race, v, side, T)) continue;
    } else {
      aimed = Boolean(slamAim(race, r, v, T, r.turnMax || T.TURN_MAX, delay, false,
        (v.ai ? v.ai.knobs.reactMs : 200) / 1000));
    }
    // a hunter takes an aimed takedown whenever it sees one; any SLAM otherwise is a chance, by ramBias (× 0.35 for a
    // ship it is not hunting), once a 2.0 s window per ship (it spills fuel)
    const key = `ram:${v.id}`;
    const roll = A.rolls || (A.rolls = {});
    if (!roll[key] || race.t > roll[key].until) roll[key] = { u: rndOf(r)(), until: race.t + 2.0, used: false };
    const R = roll[key];
    const chance = prey && aimed ? 1 : prey ? k.ramBias : k.ramBias * 0.35;
    if (R.used || R.u >= chance) continue;
    R.used = true;
    A.lean = { victim: v.id, side, until: race.t + T.LEAN_S, flick: false };
    emit(race, E.lean, r, { target: v.id, side, by: r.id });
    return;
  }
}

// Is there a hazard within 30° past ship v (on the far side from a rammer coming from `side`), passing in the next
// shove's reach? (Legs 2 and 3: a rival SLAMs you only when there is not.)
export function hazardPast(race, v, side, T, look = T.LEAN_S + T.TAKEDOWN_S + 0.2) {
  for (let d = 4; d <= 30; d += 4) if (lineHits(race, v, v.bearing + side * d, look, T)) return true;
  return false;
}

// ---------------------------------------------------------------- every step

function fast(race, r, idx, A, T, S, you, dt) {
  const now = race.t;
  const I = A.intent;
  // bosses' own per-step rules (MAKO's roll, MANTA's lane) may own the bearing
  if (r.kind === 'boss' && bossFast(race, r, A, T)) return;
  // after a SLAM's shove it takes its reaction to steer back
  const sh = r.shove;
  if (sh && sh.slam && sh.by !== r.id && now - sh.t0 < T.SHOVE_S + A.knobs.reactMs / 1000) {
    I.target = r.bearing;
    A.lean = null;
    return;
  }
  // the whip: plan, hook, press, hold and lift (its approach still never turns into a ship fast)
  if (whipFast(race, r, A, T, S)) { if (!r.whip) guard(race, r, A, T); return; }
  // the lean, then the flick
  if (A.lean) {
    const v = byId(race, A.lean.victim);
    if (!v || isOut(v) || Math.abs(aheadS(r, v, T)) > T.CONTACT_Z * 2) { A.lean = null; A.cool = now + 0.8; }
    else if (!A.lean.flick) {
      const off = wrap(v.bearing - r.bearing);
      if (sgn(off) !== A.lean.side) { A.lean = null; A.cool = now + 0.8; }
      else if (now >= A.lean.until - 1e-9) {
        // legs 2 and 3: the slam on you stays off if a hazard came into reach past you during the lean
        if (race.legNo <= 2 && v === you && hazardPast(race, v, A.lean.side, T)) { A.lean = null; A.cool = now + 1.0; }
        else { A.lean.flick = true; A.flickUntil = now + 0.3; }
      }
      if (A.lean && !A.lean.flick) {
        // the lean: it keeps beside its target, tilted toward it, and does not close yet
        I.target = r.bearing + wrap(v.bearing - A.lean.side * (r.half + v.half + 6) - r.bearing) * 0.5;
        guard(race, r, A, T);
        return;
      }
    }
    if (A.lean && A.lean.flick) {
      // the flick ends on time, on its SLAM, or if a knock put its target on the other side
      const off = wrap(v.bearing - r.bearing);
      if (now > A.flickUntil || (r.shove && r.shove.by === A.lean.victim) || (sgn(off) !== A.lean.side && Math.abs(off) > 2)) {
        A.lean = null;
        A.cool = now + 2.0;
      } else {
        I.target = v.bearing + A.lean.side * 14;
        guard(race, r, A, T, v.id);                    // the flick is for its target alone
        return;
      }
    }
  }
  // PIKE's block: slide toward the puller's perceived line, on the side it chose, never across
  if (A.block) {
    const B = A.block, v = byId(race, B.on);
    const live = v && !isOut(v) && now <= B.until && aheadS(v, r, T) > T.CONTACT_Z;
    if (!live) { A.block = null; A.blockCd = now + T.BLOCK_CD; A.mode = 'cruise'; }
    else if (now >= B.from) {
      if (!B.shown) { B.shown = true; emit(race, E.block, r, { on: v.id, side: B.side }); if (v === you) A.blockedYou = now; }
      A.mode = 'block';
      const vi = shipIdx(race, v.id);
      let want = perceived(race, vi, B.react);
      const rel = wrap(want - B.b0);
      if (rel * B.side < 0) want = B.b0;               // it cannot switch sides
      const step = B.rate * T.TURN_TAU;                // a target this far off steers at BLOCK_RATE
      const d = wrap(want - r.bearing);
      I.target = r.bearing + clamp(d, -step, step);
      return;
    }
  }
  I.target = finite(A.goal) ? A.goal : r.bearing;
  guard(race, r, A, T);
}

// Never turn into a ship in contact range faster than a BUMP: a rival only SLAMs after its lean. Two rivals turning
// into each other at GUARD_RATE each still close under SLAM_V.
const GUARD_RATE = 95;
function guard(race, r, A, T, except = null) {
  if (A.lean && A.lean.flick && except === null) return;
  const I = A.intent;
  if (!finite(I.target)) return;
  const want = I.target - r.bearing;
  if (Math.abs(want) < 1e-9 || !guarded(race, r, T, sgn(want), except)) return;
  I.target = r.bearing + sgn(want) * Math.min(Math.abs(want), GUARD_RATE * T.TURN_TAU);
}

// Is there a ship (but `except`) close enough on this side (+1 right) that a fast turn could SLAM it?
function guarded(race, r, T, side, except = null) {
  for (const o of race.ships) {
    if (o === r || isOut(o) || o.whip || o.id === except) continue;
    const z = Math.abs(o.dist - r.dist) / bpsOf(r, T);
    if (z > T.CONTACT_Z * 1.5) continue;
    const off = wrap(o.bearing - r.bearing);
    if (sgn(off) !== side || Math.abs(off) > r.half + o.half + 25) continue;
    return true;
  }
  return false;
}

// PIKE (and anyone with blockBias) blocks a ship that pulls out of its wake: after BLOCK_REACT it slides at BLOCK_RATE
// toward that ship's line for up to BLOCK_HOLD, on the side it first saw, then a BLOCK_CD cool-down.
function blockStart(race, r, puller, T, S) {
  const A = r.ai, now = race.t;
  if (A.block || now < A.blockCd || A.mode === 'flee' || r.whip || race.legNo < 2) return;
  const z = aheadS(puller, r, T);
  if (z < T.WAKE_NEAR - 1e-9 || z > 0.5) return;
  const bb = A.knobs.blockBias;
  if (!(bb > 0)) return;
  if (bb < 0.9 && rndOf(r)() >= bb) return;
  const act3 = actOf(race.legNo) === 3 ? 1 : 0;
  const react = T.BLOCK_REACT[act3], rate = T.BLOCK_RATE[act3];
  const side = sgn(wrap(puller.bearing - r.bearing));
  A.block = { on: puller.id, t0: now, from: now + react, until: now + react + T.BLOCK_HOLD, react, rate, side,
    b0: r.bearing, shown: false };
}

// ---------------------------------------------------------------- whips (10.4 WHIP)

// A rival tries a well with chance whipGreed (+0.2 when gambling), grabs 10° + (1 − whipGreed) × 25° off the core,
// picks a band by personality, shows its hook HOOK_LEAD before it presses, presses with an error, and lets go on the
// band with an error from N(0, reactMs ÷ 4) (or a reaction after the scorch warning; MOTH ignores one in four).
// → true when the whip owns the steering this step.
function whipFast(race, r, A, T, S) {
  const I = A.intent, P = PERS(r), k = A.knobs;
  if (r.type === 'whale' || r.kind === 'drifter' || !(k.whipGreed > 0)) return false;
  const W = r.whip;
  if (W) {
    let m = A.whip;
    if (!m || m.well !== W.well) m = A.whip = { well: W.well, band: firstBand(W), relAt: NaN, warnAt: NaN,
      relErr: 0, ignore: false, steer: false };
    if (!finite(m.relAt) && m.band >= 0 && finite(W.exitA[m.band]) && !W.latched) {
      m.relAt = race.real + sweepTime(W.angle, W.exitA[m.band], T, W.x) + T.LIFT_COMP + m.relErr;
    }
    if (m.band < 0 || !finite(W.exitA[m.band])) m.band = firstBand(W);
    if (m.band < 0) { I.action = 'up'; return true; }
    if (W.warned && !finite(m.warnAt)) m.warnAt = race.real;
    const panic = finite(m.warnAt) && !m.ignore && race.real >= m.warnAt + k.reactMs / 1000;
    if ((finite(m.relAt) && race.real >= m.relAt) || panic) I.action = 'up';
    return true;
  }
  if (A.whip && A.whip.done) A.whip = null;
  // a well coming up?
  let near = false;
  const bps = bpsOf(r, T);
  for (const it of race.leg.wells) {
    const tA = (it.beat - r.dist) / bps;
    if (tA <= 1.6 && tA >= -T.WIN_LATE) { near = true; break; }
  }
  if (!near) { if (A.whip && !A.whip.pressedT) A.whip = null; return false; }
  const win = windowOf(race, r);
  if (!win) return false;
  let m = A.whip;
  if (!m || m.well !== win.well) {
    m = A.whip = planWhip(race, r, win, A, T);
  }
  if (!m.try) return false;
  if (win.holder && win.holder !== r.id) return false;     // one tether per well: it waits
  m.steer = win.t <= 1.4;
  if (m.steer) I.target = r.bearing + wrap(m.b0 - r.bearing);
  if (!m.hooked && win.t <= m.pressErr + T.HOOK_LEAD) {
    m.hooked = true;
    emit(race, E.hook, r, { well: win.well, psi: win.item.psi });
  }
  if (!m.pressedT && win.t <= m.pressErr && win.t >= -win.late) {
    m.pressedT = race.t;
    I.action = 'down';
  }
  return m.steer;
}

function firstBand(W) {
  let k = -1;
  for (let i = 0; i < W.n; i++) if (finite(W.exitA[i]) && W.exitA[i] > W.angle && (k < 0 || W.exitA[i] < W.exitA[k])) k = i;
  return k;
}

function planWhip(race, r, win, A, T) {
  const rnd = rndOf(r), k = A.knobs, P = PERS(r), it = win.item;
  const zYou = aheadS(race.ships[0], r, T);
  const greed = Math.min(1, k.whipGreed + (zYou < -T.GAMBLE_BEHIND ? 0.2 : 0));
  const m = { well: win.well, try: rnd() < greed, side: 1, b0: it.psi, band: -1, aE: NaN, pressErr: 0.02, relErr: 0,
    relAt: NaN, warnAt: NaN, hooked: false, pressedT: 0, ignore: r.type === 'moth' && rnd() < 0.25, steer: false };
  m.pressErr = 0.02 + gauss(rnd) * k.reactMs / 4000;
  m.relErr = gauss(rnd) * k.reactMs / 4000;
  const off = Math.min(win.reach - 1.5, win.core + r.half + 10 + (1 - k.whipGreed) * 25);
  const x = win.teach ? T.TEACH_SWEEP : 1;
  const react = k.reactMs / 1000;
  let best = -Infinity;
  for (const s of [win.side, -win.side]) {
    const b0 = it.psi + s * off;
    const scorchAt = 360 - off - win.core - r.half;
    const redAt = scorchAt - ((race.leg.rules && race.leg.rules.redSpan) || T.RED_SPAN);
    let limit = scorchAt;
    while (limit > 0 && sweepTime(limit, scorchAt, T, x) < T.SCORCH_WARN + react + 0.1) limit -= 2;
    if (k.whipGreed <= 0.7) limit = Math.min(limit, redAt - 2);
    let pick = -1, pickA = NaN, pickV = -Infinity;
    (it.exits || []).forEach((e, j) => {
      const a = ((s * wrap(e - b0)) % 360 + 360) % 360;
      if (a < 25 || a > limit) return;
      let v;
      if (P.band === 'far') v = a;
      else if (P.band === 'you') v = -Math.abs(wrap(e - race.ships[0].bearing));
      else if (P.band === 'wake') v = race.ships.some((o) => o !== r && !isOut(o) && Math.abs(wrap(o.bearing - e)) < 15
        && o.dist > r.dist) ? 1000 - a : -a;
      else if (P.band === 'gap') v = -gapDist(race, r, e);
      else v = -a;
      if (v > pickV) { pickV = v; pick = j; pickA = a; }
    });
    if (pick < 0) continue;
    const score = pickV - 0.01 * Math.abs(wrap(b0 - r.bearing)) + (s === win.side ? 0.5 : 0);
    if (score > best) { best = score; m.side = s; m.b0 = b0 + gauss(rnd) * k.jitterDeg * 0.5; m.band = pick; m.aE = pickA; }
  }
  if (m.band < 0) m.try = false;
  return m;
}

// The nearest wall gap ahead to a bearing (PIKE's band: toward the next wall gap).
function gapDist(race, r, b) {
  const items = race.leg.items;
  let best = 180;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind !== 'wall' || it.beat < r.dist) continue;
    for (const g of it.gaps) best = Math.min(best, Math.abs(wrap(g.psi - b)));
    break;
  }
  return best;
}

function bossEvent(race, r, e, T) {
  const A = r.ai;
  if (r.type === 'mako') {
    if (e.type === E.contact && e.by === r.id) {
      A.rollUntil = race.t + T.MAKO.rollS;
      const v = byId(race, e.victim);
      A.rollDir = v ? -sgn(wrap(v.bearing - r.bearing)) : 1;
      emit(race, E.roll, r, { until: A.rollUntil });
    }
    if (e.type === E.takedown && e.victim === r.id) {
      A.downs = (A.downs || 0) + 1;
      if (A.downs >= T.MAKO.backOff && !A.backOff) {
        A.backOff = { t0: race.t, until: race.t + 2 };
        emit(race, E.backOff, r, { downs: A.downs });
      }
    }
  }
  if (r.type === 'manta' && e.type === E.takedown && e.victim === r.id) {
    A.tornUntil = race.t + T.MANTA.tear;
    emit(race, E.sailTorn, r, { until: A.tornUntil });
  }
}

// ---------------------------------------------------------------- standings (10.6)

// The leg's standings for the arrival line and the run: { order (ship ids through the gate line), eaten (ids the
// light took), fed (the ones you fed it), takedowns ([{ by, victim, trapped }]), nemesis (a regular that became your
// Nemesis this leg), settled (one you settled), boss: { id, beaten } }. A boss is beaten by finishing ahead of it (the
// gate line, or the door at Earth), by MAKO backing off, or by the light taking it.
export function legResult(race) {
  const S = race ? stateOf(race) : null;
  const order = race ? [...race.order] : [];
  const out = { order, eaten: S ? [...S.eaten] : [], fed: S ? [...S.fed] : [], takedowns: S ? S.takedowns.map((x) => ({
    by: x.by, victim: x.victim, trapped: x.trapped })) : [], nemesis: S ? S.newNemesis : null,
  settled: S ? S.settled : null, boss: null };
  if (!race) return out;
  for (const s of race.ships) {
    if (s.kind === 'you' || !s.caught || out.eaten.includes(s.id)) continue;
    out.eaten.push(s.id);
  }
  const boss = race.ships.find((s) => s.kind === 'boss');
  if (boss) {
    const you = race.ships[0];
    const yi = order.indexOf(you.id), bi = order.indexOf(boss.id);
    const ahead = yi >= 0 && (bi < 0 || yi < bi);
    const beaten = !isOut(you) && (ahead || isOut(boss) || Boolean(boss.ai && boss.ai.backOff));
    out.boss = { id: boss.type, beaten };
  }
  return out;
}

export { BOSSES };
