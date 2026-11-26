// Gloam Downs: the foes of a run. Their minds and moves, and the rules of the zones they stand in: noticing, the leash and the way
// home, the attack tokens, the wind-up rule, the flinch and the knock-down, the rise and the sink, the guard zones that keep a beacon
// dark, the cap of six awake, foes put out and their glim, and the glim motes that fly in. No DOM: the page (fight.js) poses the pool
// from what is here, and the Node tests and the bot step it as it is.
// Every time is in play steps of 1/60 s: a foe thinks and moves only on play steps, and its hit flash and shake count game steps.
// A foe is also a target of the blade ({ x, y, z, r, alive, hit(raw, how) }, as moves.js wants one).
import { makeBody, PARAMS } from './play.js';
import { clearLine, dealt, yawFor } from './moves.js';
import { stream } from './run.js';
import { eliteKit } from './elites.js';
import { mixWave, WAVE } from './mix.js';
import { STAGGER, poiseOf } from './feel.js';
import { specialPhase } from './elites.js';
import { heavyOf } from './status.js';
import { comboGlim } from './combo.js';
import { statusStep, statusTick, statusOut, blindMiss, markHit } from './status.js';

const S = sec => Math.round(sec * 60);
const STEP = 1 / 60, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const LAMP_R = PARAMS.radius;

/* ---------------- the four foes ----------------
   design.md "The foes". range is to the lamplighter's centre; a hook's reach is to the lamplighter's edge; a ring or lane hits only a
   lamplighter whose centre is inside it. ring is the marker's radius at the end of the wind-up (as baked); ring0 where it starts */
export const TYPES = {
  S: {
    code: 'S', title: 'Snuffer', light: true, weight: 'medium', stun: S(0.35), knock: 0.4, r: 0.4, hp: 50, walk: 1.6, close: 3.4, turn: 6, glim: 3, cool: [0.8, 1.4], eye: 1.2, chest: 0.9,
    moves: { hook: { kind: 'melee', range: 3.2, wind: S(0.55), act: S(0.15), rec: S(0.7), dmg: 16, reach: 2.2, step: 1.0, arc: 60 * DEG, track: 1.2, cue: 'scrape' } }
  },
  P: {
    code: 'P', title: 'Pitchrook', light: true, weight: 'light', stun: S(0.45), knock: 0.6, r: 0.4, hp: 30, walk: 1.6, close: 1.6, turn: 2.5, glim: 4, cool: [1.6, 2.2], eye: 1.5, chest: 1.1, keep: [5, 9], back: 3.5,
    moves: { lob: { kind: 'coal', min: 3, range: 11, wind: S(0.8), act: S(0.15), rec: S(0.4), release: 4, flight: S(0.65), dmg: 18, ring: 1.4, ring0: 0.2, rise: 1.6, cue: 'whistle' } }
  },
  M: {
    code: 'M', title: 'Mirelight', light: true, weight: 'light', stun: S(0.5), knock: 0.8, fly: true, r: 0.35, hp: 14, walk: 2.6, close: 2.6, turn: 6, glim: 2, cool: [1.6, 1.6], eye: 1.3, chest: 1.3,
    moves: { pulse: { kind: 'melee', range: 2.0, wind: S(0.7), act: S(0.15), rec: S(0.6), dmg: 18, ring: 2.2, ring0: 0, rise: 1.8, drift: 3, cue: 'hum' } }
  },
  I: {
    code: 'I', title: 'Ironback', light: false, weight: 'heavy', stun: 0, knock: 0, r: 0.7, hp: 120, walk: 1.2, close: 1.2, turn: 3, glim: 8, cool: [1.0, 1.6], eye: 1.2, chest: 1.0, stunned: 1.5,
    moves: {
      // the lane follows the aim for its first 0.6 s, growing to 7 m, and stands still for the last 0.3 s before the run
      charge: { kind: 'melee', min: 3, range: 9, wind: S(0.9), grow: S(0.6), act: S(0.7), rec: S(1.4), dmg: 24, push: 3, v: 10, width: 1.6, len: 7, past: 3, drop: 0.6, stun: S(2.0), cue: 'paw' },
      slam: { kind: 'melee', range: 2.8, wind: S(0.75), act: S(0.12), rec: S(1.1), dmg: 20, ring: 3.0, ring0: 0, rise: 1.8, cue: 'rear' }
    }
  }
};
// the markers as baked (lib/foes.mjs): a ring's radius at k = 1, and the Ironback's lane: width, piece length, pieces
/* Ember 0 (gloam-downs-fair-fight design.md "A natural curve"): every foe's blow deals `dmg` times its number, and every foe has `hp`
   times its health. The Ember 4 factor multiplies on top (the second pass of the pacing tune set 1.25 and 1.3) */
export const FOE_HARD = { dmg: 1.25, hp: 1.3 };
export const MARKERS = { P: { ring: 1.4 }, M: { ring: 2.2 }, I: { ring: 3.0, lane: [1.6, 1.4, 5] } };

export const RULES = {
  wake: 10, sleep: 16, cap: 6, notice: 8, near: 3, chase: 8, home: S(4), off: S(4), below: 2, outBelow: 6, fall: -25,
  cracks: S(0.6), rise: S(0.9), sink: S(0.6), dying: S(0.6), melee: 1,
  hold: 3.5, band: 0.3, spread: 50 * DEG, probe: 0.7, pushSteps: 8, homeGap: 1.2, sight: 6,
  glimWait: S(0.4), glimReach: 6, glimTake: 0.35, flash: 3, shake: 6, spawnLeash: 4
};
/* the fair fight (gloam-downs-fair-fight design.md): after a cancel a foe waits 0.6 s past its stun; a hit in the active time or the
   recovery adds 0.2 s to the recovery, at most 0.4 s a move; three flinches in 3 s brace a foe for 1.5 s; two blows land at least 0.6 s
   apart; no wind-up starts for 1.0 s after a hurt; the foe that hit steps back 1.0 m over 0.4 s and waits 1.2 s; waiting foes circle
   at 0.8 m/s; a foe off screen winds up 0.25 s longer */
export const FAIR = {
  stunWait: S(0.6), recAdd: S(0.2), recMax: S(0.4), braceN: 3, braceIn: S(3.0), brace: S(1.5), gap: S(0.6), hurtWait: S(1.0),
  // a braced foe is not knocked down by the finisher or the plunge: it takes the blow and can answer
  braceHolds: true,
  back: 1.0, backSteps: S(0.4), backWait: S(1.2), circle: 0.8, offWind: S(0.25), snapStop: 5,
  // a foe cut out of its attack comes back steeled: its next wind-up begun within 4 s is armored (gloam-downs-fair-fight "Steeled")
  steel: S(4.0),
  // the hits that interrupt: the blade's cuts, its finisher, the Rising cut and the plunge (an ability says so on its own hit)
  blade: ['cut1', 'cut2', 'fin', 'rise', 'plunge']
};
// the rim of a heavy foe (fight.js draws it): one dab in slot 39 for each 10 poise left, rounded up; a braced foe shows 4, a steeled
// one 2 until its steel is spent or lapses
export const ARMOR = { per: 10, slot: 39, braced: 4, steeled: 2 };
/* the armored wind-ups: every wind-up of a heavy foe (the Ironback's, and every elite's, its special move's too), and a light or
   medium foe's wind-up begun braced or steeled. A hit does not cancel one; a heavy foe's poise still wears, and a break still cancels */
export function armored(f) {
  if (!f) return false;
  if (f.state === 'move' && f.move && phaseOf(f.T.moves[f.move], f.mt) === 'wind') return heavyOf(f) || f.braced > 0 || !!f.armorMove;
  const sp = f.special;
  if (!sp) return false;
  return specialPhase(sp.def, sp.t).ph === 'w';
}
// steeled now: cut out of an attack in the last 4 s, its next wind-up not yet begun
export const steeled = (f, step) => !!f && !heavyOf(f) && step < (f.steelTo ?? -1);
// in a wind-up now: its own move's, or an elite's special move's
export function winding(f) {
  if (f.state === 'move' && f.move) return phaseOf(f.T.moves[f.move], f.mt) === 'wind';
  return !!f.special && specialPhase(f.special.def, f.special.t).ph === 'w';
}
/* the rim's dabs now: n dabs, and armor true in an armored wind-up (the count doubles). A heavy foe's poise refills 3 s after its
   last hit, so the count reads it as full then. -> { n, armor, k } (k: how far into the wind-up, 0..1) or null */
export function rimOf(f, step) {
  if (!f || f.out) return null;
  const arm = armored(f);
  if (heavyOf(f) && f.state !== 'stagger' && f.state !== 'stun') {
    const max = poiseOf(f);
    if (!max) return null;
    const left = f.poise === undefined || step - (f.poiseAt ?? -1e9) >= STAGGER.refill ? max : f.poise;
    const n = Math.ceil(left / ARMOR.per - 1e-9);
    return n > 0 ? { n: arm ? n * 2 : n, armor: arm, k: windK(f) } : null;
  }
  if (f.braced > 0 || (arm && f.armorMove)) return { n: arm ? ARMOR.braced * 2 : ARMOR.braced, armor: arm, k: windK(f) };
  if (steeled(f, step)) return { n: ARMOR.steeled, armor: false, k: 0 };
  return null;
}
// in a hook's wind-up (a Snuffer's, or the Wardmother's hooks): how far into it, 0..1, else null (fight.js lays the ground tell from it)
export function hookWind(f) {
  if (!f || f.out) return null;
  if (f.state === 'move' && f.move === 'hook') return phaseOf(f.T.moves.hook, f.mt) === 'wind' ? windK(f) : null;
  if (f.special?.def.kind === 'hooks') { const P = specialPhase(f.special.def, f.special.t); return P.ph === 'w' ? clamp(P.at / P.n, 0, 1) : null; }
  return null;
}
function windK(f) {
  if (f.state === 'move' && f.move) { const M = f.T.moves[f.move]; return clamp((f.mt + (f.windAdd | 0)) / (M.wind + (f.windAdd | 0)), 0, 1); }
  if (f.special) { const P = specialPhase(f.special.def, f.special.t); return P.ph === 'w' ? clamp(P.at / P.n, 0, 1) : 0; }
  return 0;
}

/* ---------------- the zone rules ----------------
   The page and the zone check (qa/lab/gloam-downs-zones.mjs) share these. A zone here is { c, foes } with foes a string of types
   (its living foes); pool is the count of slots of each type ({ S: 5 }). fits: the zone's foes and the awake foes come to 6 or fewer,
   and there is a free slot of the right type for each of its foes. makeRoom: the zones that give up their slots for a guard zone, the
   farthest from (x, z) first, and only those whose slots help (a type the guard is short of, or the cap); null when even all of them
   do not make room */
export const foesOf = z => [...(z.foes || '')].filter(t => 'SPMI'.includes(t));
const distTo = (z, x, y) => Math.hypot(z.c[0] - x, z.c[2] - y);
export function freeSlots(pool, awake) {
  const free = { ...pool };
  for (const z of awake) for (const t of foesOf(z)) free[t] = (free[t] || 0) - 1;
  return free;
}
export function fits(zone, awake, pool) {
  const n = awake.reduce((s, z) => s + foesOf(z).length, 0) + foesOf(zone).length;
  if (n > RULES.cap) return false;
  const free = freeSlots(pool, awake), need = {};
  for (const t of foesOf(zone)) need[t] = (need[t] || 0) + 1;
  return Object.entries(need).every(([t, k]) => (free[t] || 0) >= k);
}
export function makeRoom(guard, awake, pool, x, z) {
  let keep = awake.slice();
  const gone = [];
  const short = () => {
    const free = freeSlots(pool, keep), need = {};
    for (const t of foesOf(guard)) need[t] = (need[t] || 0) + 1;
    const types = Object.entries(need).filter(([t, k]) => (free[t] || 0) < k).map(([t]) => t);
    const capped = keep.reduce((s, q) => s + foesOf(q).length, 0) + foesOf(guard).length > RULES.cap;
    return { types, capped };
  };
  for (const q of keep.slice().sort((a, b) => distTo(b, x, z) - distTo(a, x, z))) {
    if (fits(guard, keep, pool)) break;
    const s = short();
    if (!(s.capped || foesOf(q).some(t => s.types.includes(t)))) continue;
    keep = keep.filter(k => k !== q);
    gone.push(q);
  }
  return fits(guard, keep, pool) ? { gone, keep } : null;
}
export const poolCounts = codes => [...codes].filter(t => 'SPMI'.includes(t)).reduce((n, t) => ((n[t] = (n[t] || 0) + 1), n), {});

// a ring's hit: the lamplighter's centre inside the ring, within rise of its height
export const inRing = (s, x, y, z, R, rise) => Math.hypot(s.x - x, s.z - z) <= R && Math.abs(s.y - y) <= rise;
/* the lamplighter at s against a body at (x, y, z) of radius r: it loses its speed into it, and gets the overlap × 6 m/s outward, as a
   velocity before the next step. -> [ux, uz, overlap] when they overlap, else null */
export function pushOut(s, x, y, z, r) {
  const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz), min = r + LAMP_R;
  if (d >= min || d < 1e-6 || Math.abs(s.y - y) > 1.5) return null;
  const ux = dx / d, uz = dz / d, over = min - d, vin = s.vx * ux + s.vz * uz;
  if (vin < 0) { s.vx -= vin * ux; s.vz -= vin * uz; }
  s.vx += ux * over * 6; s.vz += uz * over * 6;
  return [ux, uz, over];
}

// where a guard zone's keepers stand, as a toast says it: a landmark the player can see, never a compass word
const STAND = { 'the keep': 'in the keep', 'the mill': 'at the mill', 'the terrace': 'on the terrace' };
export const keeperLine = keeper => `The beacon will not catch while its keepers stand ${STAND[keeper] || keeper}.`;

/* home spots 1.2 m apart within 1.5 m of the zone's centre, on its floor: one at the centre, or n on a ring turned until each is on
   floor within 0.6 m of the centre's height */
export function homeSpots(walk, zone, n) {
  const [cx, cy, cz] = zone.c, floor = (x, z) => walk.support(x, z, cy + 1.2);
  const at = (x, z) => [x, floor(x, z) ?? cy, z];
  if (n <= 1) return [at(cx, cz)];
  const r = RULES.homeGap / (2 * Math.sin(Math.PI / n));
  for (let turn = 0; turn < 12; turn++) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (turn * Math.PI) / 6 + (k * 2 * Math.PI) / n, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, y = floor(x, z);
      if (y === null || Math.abs(y - cy) > 0.6) break;
      pts.push([x, y, z]);
    }
    if (pts.length === n) return pts;
  }
  return Array.from({ length: n }, (_, k) => at(cx + (k - (n - 1) / 2) * 0.3, cz));
}

// the phase of a move at mt steps: wind-up, active, recovery, or done
export function phaseOf(M, mt) {
  if (mt < M.wind) return 'wind';
  if (mt < M.wind + M.act) return 'act';
  if (mt < M.wind + M.act + M.rec) return 'rec';
  return 'end';
}
// the marker's size over a wind-up: a ring grows from ring0 to ring, a lane to its length over its first 0.6 s
export const ringAt = (M, mt) => M.ring0 + (M.ring - M.ring0) * clamp(mt / M.wind, 0, 1);
export const laneAt = (M, mt) => M.len * clamp((mt + 1) / M.grow, 0, 1);

/* ---------------- the foes of one place ----------------
   makeFoes({ walk, meta, slots, seed, runner, onScreen, water }): meta.zones are the place's zones (the boss's arena is left to stage
   3). slots is the pool's slot codes in order ('SSSSP' or pool.slots' codes): a foe takes the slot of its type that is free when it
   rises, and gives it back when it sleeps or goes out. runner is the run's runner (run.js makeRunner; bind() may set it later):
   the foes hurt the lamplighter through runner.hurt, and a foe put out counts through runner.foeOut. onScreen(x, y, z) says whether
   a point is in the view (the page projects it; a foe off screen winds up 0.25 s longer, and starts only when tellFree(f) says its tell
   can be heard). tokens is the melee tokens of the place (run.js tokensOf). water is the place's water surface, or undefined: the
   Mirelight floats over it.
   think(ev, play) runs on every game step after the lamplighter, as the runner's think; ev gets the cues and what the page draws:
   { type: 'cracks', pts }, 'rise', 'burst' (a coal, a pulse, a slam or a charge into a wall), 'foeOut', 'glim', 'stagger' and 'snap'
   (a hit that stopped an attack or broke a poise, with a hit stop of 5 steps). */
export function makeFoes({ walk, meta = {}, slots = '', seed = 1, runner = null, onScreen = () => true, water, place = meta.id || 'place', bounds = meta.bounds ?? 34, combo = null, scale = null, tokens = RULES.melee, tellFree = () => true }) {
  // the run's later places: foes hit harder and have more health (run.js foeScale)
  const SC = { dmg: scale?.dmg ?? 1, hp: scale?.hp ?? 1 };
  const rng = stream(seed, `foes/${place}`);
  const codes = [...slots], holders = codes.map(() => null), counts = poolCounts(codes);
  const lim = bounds - 0.6;
  const F = {
    zones: [], foes: [], melee: new Set(), coal: null, coals: [], motes: [], pending: [], step: 0, game: 0, runner, spawned: 0,
    codes, holders, counts, water, combo,
    // the melee tokens (run.js tokensOf: 1 in the first two places, 2 after), the steps before any foe may start a wind-up (a hurt),
    // and the steps of the blows that have landed, for the spacing
    tokens: Math.max(1, tokens | 0), hurtWait: 0, blows: []
  };
  const lamp = () => F.runner?.fighter.body.s;
  const coolOf = T => S(T.cool[0] + (T.cool[1] - T.cool[0]) * rng());

  function makeFoe(zone, type, k, home) {
    const T = TYPES[type];
    const f = {
      id: `${zone.id}.${k}`, type, T, zone, k, home, hp: Math.round(T.hp * FOE_HARD.hp * SC.hp), out: false, state: 'asleep', t: 0, aware: false, away: 0, offT: 0,
      move: null, mt: 0, landed: false, cool: 0, ready: 0, flinch: 0, downFor: 0, stunned: false, hold: null, slot: -1,
      wait: 0, windAdd: 0, recAdd: 0, recLeft: 0, flinches: [], braced: 0, cancels: 0, back: 0, backDir: null, orbit: k % 2 ? -1 : 1,
      flash: 0, shake: 0, shakeDir: [1, 0], push: null, shove: null, marker: null, aim: null, lane: null, prog: 0, firm: home.slice(),
      yaw: 0, x: home[0], y: home[1], z: home[2], r: T.r, alive: false, vx: 0, vz: 0, walking: 0, diedAt: null,
      hit: (raw, how) => hitFoe(f, raw, how),
      // poise worn with no damage (Bell toll): n off a heavy foe's poise, at once -> true when it broke
      wear: n => (hittable(f) && poiseOf(f) > 0 ? breakPoise(f, n, true) : false)
    };
    if (!T.fly) f.body = makeBody(walk, { p: [home[0], home[1] + 0.5, home[2]], yaw: 0 }, bounds, { ...PARAMS, radius: T.r, walk: T.walk, run: T.close, accel: 18, jumpV: 0, stepUp: 0.35, turnRate: 0 });
    return f;
  }
  function addZone(z, spawned = false) {
    const Z = { id: z.id, name: z.name, c: z.c.slice(), leash: z.leash, foes: z.foes, guard: !!z.guard, keeper: z.keeper, boss: !!z.boss, awake: false, spawned, members: [] };
    // the seed's mix (mix.js): the foes as baked, for the guard's second wave, and the index of the elite in this zone's foes
    Z.baked = z.baked ?? z.foes; Z.elite = Number.isInteger(z.elite) ? z.elite : null;
    if (!Z.boss) {
      const types = foesOf(Z), spots = homeSpots(walk, Z, types.length);
      Z.members = types.map((t, k) => makeFoe(Z, t, k, spots[k]));
      // a home faces the zone's centre's way out to the lamplighter's side: at rest it faces the place's start
      for (const f of Z.members) { f.yaw = Math.atan2((meta.spawn?.p[0] ?? 0) - f.x, (meta.spawn?.p[2] ?? 0) - f.z); f.body && (f.body.s.yaw = f.yaw); }
      F.foes.push(...Z.members);
    }
    F.zones.push(Z);
    return Z;
  }
  for (const z of meta.zones || []) addZone(z);

  /* ---------------- small rules ---------------- */
  const gone = f => f.out;
  const live = Z => Z.members.filter(f => !gone(f)).map(f => f.type).join('');
  const awakeList = () => F.zones.filter(Z => Z.awake).map(Z => ({ c: Z.c, foes: live(Z), ref: Z }));
  const atHome = f => Math.hypot(f.x - f.home[0], f.z - f.home[2]) < 0.35 && Math.abs(f.y - f.home[1]) < 0.6;
  const shown = f => ['rise', 'idle', 'chase', 'home', 'move', 'down', 'stun', 'stagger', 'sink', 'dying'].includes(f.state);
  const solid = f => ['idle', 'chase', 'home', 'move', 'down', 'stun', 'stagger'].includes(f.state);
  const hittable = f => solid(f) && !f.out && f.state !== 'out';
  const sees = (f, s) => clearLine(walk, f.x, f.y + f.T.eye, f.z, s.x, s.y + 0.9, s.z);
  const towards = (f, x, z, v) => { const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz); return d < 0.05 ? null : [(dx / d) * v * Math.min(1, d * 4), (dz / d) * v * Math.min(1, d * 4)]; };
  // a point the foe may walk to: inside its leash (a foe never walks out of it)
  function inLeash(f, x, z) {
    const c = f.zone.c, dx = x - c[0], dz = z - c[2], d = Math.hypot(dx, dz), L = f.zone.leash - 0.1;
    return d <= L ? [x, z] : [c[0] + (dx / d) * L, c[2] + (dz / d) * L];
  }
  function turnTo(f, yaw, rate = f.T.turn) { f.yaw += clamp(wrap(yaw - f.yaw), -rate * STEP, rate * STEP); }
  const faceLamp = (f, s, rate) => turnTo(f, Math.atan2(s.x - f.x, s.z - f.z), rate);
  const groundY = (x, z, y) => { let g = walk.support(x, z, y + 2.5); if (g === null) g = walk.top(x, z); return water !== undefined ? Math.max(g, water) : g; };
  const queue = e => F.pending.push(e);

  /* ---------------- slots ---------------- */
  function takeSlot(f) {
    if (f.slot >= 0) return true;
    const i = codes.findIndex((c, k) => c === f.type && !holders[k]);
    if (i < 0) return false;
    holders[i] = f;
    f.slot = i;
    return true;
  }
  function freeSlot(f) { if (f.slot >= 0 && holders[f.slot] === f) holders[f.slot] = null; f.slot = -1; }
  // the slots of a type that are not held and not promised to a foe in the ground, waiting to rise
  const freeOf = type => codes.filter((c, k) => c === type && !holders[k]).length - F.foes.filter(f => f.type === type && f.state === 'cracks' && f.slot < 0).length;
  // the place's elite (elites.js), in the zone the seed picks, and the Ember rules on every foe
  const EK = eliteKit(F, { walk, meta, seed, placeId: meta.id || 'place', lamp, mayAttack, strike, groundY, faceLamp, turnTo, towards, inLeash, sees, hookReaches, coolOf, inRing, makeFoe, homeSpots, placeFoe: place, freeOf, putOut });

  /* ---------------- the tokens ----------------
   At most F.tokens melee attacks at once (from the wind-up to the end of the recovery), and 1 coal (from the lob's wind-up to the
   coal's landing). No foe starts a wind-up within 1.0 s of a hurt, or before its own wait; and none whose blow would land within 0.6 s
   of another blow (landed, or on its way). A foe off screen starts only when its tell can be heard (tellFree), and winds up 0.25 s
   longer. hitIn: the steps from the wind-up's start to its blow, on screen */
  const offOf = f => !onScreen(f.x, f.y + f.T.chest, f.z);
  /* the steps of the blows on their way: each melee move's first active step and each coal's landing (a lob until its coal leaves the
     hand), every active phase of an elite's special move still to come, and the coals in the air. A foe put out or held has none */
  function blowsDue() {
    const out = F.blows.slice();
    for (const g of F.foes) {
      if (g.out || g.hold) continue;
      if (g.state === 'move' && g.move) {
        const M = g.T.moves[g.move];
        if (M.kind === 'coal') { if (g.mt < M.wind + M.release) out.push(F.step + (M.wind + M.release - g.mt) + M.flight); }
        else if (g.mt < M.wind) out.push(F.step + (M.wind - g.mt));
      } else if (g.special) {
        const d = g.special.def;
        let t = 0;
        for (const [ph, n] of d.phases) {
          if (ph === 'a') {
            const at = d.kind === 'coals' ? t + d.release : t;
            if (g.special.t < at) out.push(F.step + (at - g.special.t) + (d.kind === 'coals' ? d.flight : 0));
          }
          t += n;
        }
      }
    }
    for (const c of F.coals) out.push(F.step + (c.n - c.t));
    return out;
  }
  F.due = blowsDue;
  function mayAttack(f, kind, hitIn = 0) {
    // Shutter (abilities.js): while the lamplighter is unseen no foe starts at it
    if (unseen()) return false;
    if (kind === 'coal' ? F.coal : F.melee.size >= F.tokens) return false;
    if (F.step < F.hurtWait || F.step < f.wait) return false;
    const off = offOf(f);
    if (off && !tellFree(f)) return false;
    const at = F.step + hitIn + (off ? FAIR.offWind : 0);
    return !blowsDue().some(t => Math.abs(t - at) < FAIR.gap);
  }
  const unseen = () => !!F.runner && F.runner.clock.play < (F.runner.unseenUntil ?? -1);
  // a blow has landed (a melee attack's first active step, a coal's landing): the spacing counts from it
  const blowNow = () => { F.blows.push(F.step); while (F.blows.length > 6) F.blows.shift(); };
  F.offOf = offOf;
  F.blowNow = blowNow;
  function release(f) {
    F.melee.delete(f);
    if (F.coal === f && !F.coals.some(c => c.f === f)) F.coal = null;
  }

  /* ---------------- moves ---------------- */
  function lay(f, name) {
    const s = lamp(), M = f.T.moves[name];
    f.marker = null;
    if (name === 'lob') {
      f.aim = [s.x, groundY(s.x, s.z, s.y), s.z];
      f.marker = { kind: 'ring', x: f.aim[0], y: f.aim[1], z: f.aim[2], full: M.ring };
    } else if (name === 'pulse' || name === 'slam') {
      f.marker = { kind: 'ring', x: f.x, y: groundY(f.x, f.z, f.y), z: f.z, full: M.ring };
    } else if (name === 'charge') {
      f.lane = { x: f.x, y: f.y, z: f.z, yaw: f.yaw };
      f.marker = { kind: 'lane', x: f.x, y: f.y, z: f.z, yaw: f.yaw, full: M.len };
    }
  }
  /* a move starts at mt 0, or at mt -15 off screen: its wind-up is 0.25 s longer, and its tell plays at its first step on a voice the
     sound keeps for it (off: true) */
  function startMove(f, name, ev) {
    const M = f.T.moves[name], off = offOf(f);
    if (M.kind === 'melee') F.melee.add(f);
    else F.coal = f;
    f.windAdd = off ? FAIR.offWind : 0;
    f.state = 'move'; f.move = name; f.mt = -f.windAdd; f.landed = false; f.ready = 0; f.prog = 0; f.wall = false; f.recAdd = 0; f.recLeft = 0;
    // blind (status.js): this attack plays and deals 0
    f.miss = blindMiss(f);
    // a wind-up begun braced, or steeled (the first after a cancel, within 4 s), stays armored to its end; the steel is spent
    f.armorMove = f.braced > 0 || steeled(f, F.step);
    f.steelTo = -1;
    lay(f, name);
    ev.push({ type: 'cue', cue: M.cue, foe: f.id, ...(off ? { off: true } : {}) });
  }
  function clearMove(f) { f.move = null; f.mt = 0; f.lane = null; f.windAdd = 0; f.recAdd = 0; f.recLeft = 0; f.armorMove = false; f.miss = false; }
  /* an attack cut off (a hit, a break, a parry, a stun or a hold, a death, a sink): an elite's special move ends too, and the token
     goes back at once */
  function cancelMove(f) {
    if (f.special) EK.end(f);
    if (f.move) release(f);
    if (!F.coals.some(c => c.f === f)) f.marker = null;
    clearMove(f);
    if (f.state === 'move') f.state = f.aware ? 'chase' : 'idle';
  }
  function endMove(f) {
    release(f);
    if (!F.coals.some(c => c.f === f)) f.marker = null;
    clearMove(f);
    f.state = 'chase';
    f.cool = coolOf(f.T);
  }
  // a hit on the lamplighter: true once it has landed (in a safe time it passes, and the attack tests its later active steps)
  function strike(f, dmg, from, ev, o = {}) {
    if (f.hold || !F.runner) return false;
    // a blind foe's attack plays and deals 0 (an elite's special move is read as its first blow comes); a coal keeps its thrower's miss
    const miss = o.miss ?? (f.special ? (f.special.miss ??= blindMiss(f)) : f.miss);
    if (miss) { if (!o.coal) ev.push({ type: 'blindMiss', foe: f.id }); return true; }
    const r = F.runner.hurt(dmg * FOE_HARD.dmg * SC.dmg, from, o, ev);
    // a hurt: no foe starts a wind-up for 1.0 s, and this one waits 1.2 s; a melee foe steps back 1.0 m over 0.4 s
    if (r === 'hit' || r === 'dead') {
      F.hurtWait = F.step + FAIR.hurtWait;
      f.wait = Math.max(f.wait, F.step + FAIR.backWait);
      const s = lamp();
      if (!o.coal && s && f.move !== 'charge' && !(f.special && f.special.def.kind === 'bent')) {
        const dx = f.x - s.x, dz = f.z - s.z, l = Math.hypot(dx, dz) || 1;
        f.back = FAIR.backSteps; f.backDir = [dx / l, dz / l];
      }
    }
    return r === 'hit' || r === 'dead' || r === 'none';
  }
  // a step of backing off, when one is under way: the velocity 1.0 m over 0.4 s away from the lamplighter, inside the leash
  function backOff(f) {
    if (!(f.back > 0) || !f.backDir) return null;
    f.back--;
    const v = (FAIR.back * 60) / FAIR.backSteps, c = f.zone.c, nx = f.x + f.backDir[0] * v * STEP, nz = f.z + f.backDir[1] * v * STEP;
    if (Math.hypot(nx - c[0], nz - c[2]) > f.zone.leash) { f.back = 0; return { hard: [0, 0] }; }
    return { hard: [f.backDir[0] * v, f.backDir[1] * v] };
  }
  F.backOff = backOff;
  function hookReaches(f, M, s) {
    const d = Math.hypot(s.x - f.x, s.z - f.z);
    if (d - LAMP_R > M.reach || Math.abs(s.y - f.y) > 1.6) return false;
    if (d > f.T.r && Math.abs(wrap(Math.atan2(s.x - f.x, s.z - f.z) - f.yaw)) > M.arc) return false;
    return clearLine(walk, f.x, f.y + 0.9, f.z, s.x, s.y + 0.9, s.z);
  }
  /* one play step of a move: what the foe does in its wind-up, active time and recovery. -> the velocity it wants, [vx, vz], or
     { hard: [vx, vz] } for a drive that brakes and turns at once (the charge, the hook's step) */
  function runMove(f, ev) {
    const s = lamp(), T = f.T, M = T.moves[f.move];
    // a hit in the active time or the recovery holds the recovery 0.2 s longer (the pose holds where it is)
    if (f.recLeft > 0 && phaseOf(M, f.mt) === 'rec') { f.recLeft--; return backOff(f) || { hard: [0, 0] }; }
    f.mt++;
    const ph = phaseOf(M, f.mt), at = f.mt - (ph === 'act' ? M.wind : ph === 'rec' ? M.wind + M.act : 0);
    if (ph === 'end') { endMove(f); return null; }
    // the token is held to the end of the recovery (endMove gives it back); a melee blow's first active step counts for the spacing
    if (ph === 'act' && at === 0 && M.kind === 'melee') blowNow();
    // the foe that hit steps back (the charge runs on)
    if (f.back > 0 && f.move !== 'charge' && f.move !== 'lob' && (ph === 'rec' || (ph === 'act' && f.landed))) return backOff(f);
    switch (f.move) {
      case 'hook': {
        if (ph === 'wind') {
          faceLamp(f, s);
          const d = Math.hypot(s.x - f.x, s.z - f.z);
          return d > T.r + LAMP_R + 1.0 ? towards(f, ...inLeash(f, s.x, s.z), M.track) : null;
        }
        if (ph === 'act') {
          // the step: 1.0 m forward over the active time, on the facing it had when the wind-up ended
          if (!f.landed && hookReaches(f, M, s)) f.landed = strike(f, M.dmg, [f.x, f.z], ev);
          const v = (M.step * 60) / M.act, ux = Math.sin(f.yaw), uz = Math.cos(f.yaw), c = f.zone.c;
          // the step stops at the leash: only a charge and a push carry a foe past it
          if (Math.hypot(f.x + ux * v * STEP - c[0], f.z + uz * v * STEP - c[2]) > f.zone.leash) return { hard: [0, 0] };
          return { hard: [ux * v, uz * v] };
        }
        return { hard: [0, 0] };
      }
      case 'lob': {
        if (ph === 'wind') { turnTo(f, Math.atan2(f.aim[0] - f.x, f.aim[2] - f.z)); return null; }
        if (ph === 'act' && at === M.release) {
          const hand = [f.x + Math.sin(f.yaw) * 0.25, f.y + 1.55, f.z + Math.cos(f.yaw) * 0.25];
          F.coals.push({ f, from: hand, to: f.aim.slice(), t: 0, n: M.flight, R: M.ring, dmg: M.dmg, rise: M.rise, miss: !!f.miss });
        }
        return null;
      }
      case 'pulse': {
        if (ph === 'act') {
          const m = f.marker;
          if (at === 0) ev.push({ type: 'burst', kind: 'pulse', x: m.x, y: m.y, z: m.z, r: M.ring }, { type: 'cue', cue: 'pulse', foe: f.id });
          if (!f.landed && inRing(s, m.x, m.y, m.z, M.ring, M.rise)) f.landed = strike(f, M.dmg, [f.x, f.z], ev);
          if (at === M.act - 1) f.marker = null;
          return null;
        }
        if (ph === 'rec') {
          // it drifts back 3 m from the lamplighter over its recovery
          const dx = f.x - s.x, dz = f.z - s.z, d = Math.hypot(dx, dz) || 1, v = (M.drift * 60) / M.rec;
          return towards(f, ...inLeash(f, f.x + (dx / d) * v, f.z + (dz / d) * v), v);
        }
        return null;
      }
      case 'slam': {
        if (ph === 'act') {
          const m = f.marker;
          if (at === 0) ev.push({ type: 'burst', kind: 'slam', x: m.x, y: m.y, z: m.z, r: M.ring }, { type: 'cue', cue: 'slam', foe: f.id });
          if (!f.landed && inRing(s, m.x, m.y, m.z, M.ring, M.rise)) f.landed = strike(f, M.dmg, [f.x, f.z], ev);
          if (at === M.act - 1) f.marker = null;
        }
        return { hard: [0, 0] };
      }
      case 'charge': return charge(f, M, ph, at, s, ev);
    }
    return null;
  }
  function charge(f, M, ph, at, s, ev) {
    if (ph === 'wind') {
      if (f.mt < M.grow) {
        faceLamp(f, s);
        Object.assign(f.lane, { x: f.x, y: f.y, z: f.z, yaw: f.yaw });
        Object.assign(f.marker, f.lane);
      }
      return { hard: [0, 0] };
    }
    if (ph === 'act') {
      const ux = Math.sin(f.lane.yaw), uz = Math.cos(f.lane.yaw), b = f.body.s;
      if (at === 0) ev.push({ type: 'cue', cue: 'charge', foe: f.id });
      // it stops dead at a wall, at the edge of a drop of more than 0.6 m, or 3 m past its leash
      const ahead = f.T.r + 0.15 + M.v * STEP, px = b.x + ux * ahead, pz = b.z + uz * ahead;
      const fl = walk.floorAt(px, pz, b.y + 0.35 + 0.3, b.y), c = f.zone.c;
      const wall = fl > b.y + M.drop, drop = fl < b.y - M.drop, past = Math.hypot(b.x + ux * M.v * STEP - c[0], b.z + uz * M.v * STEP - c[2]) > f.zone.leash + M.past;
      if (wall || drop || past) return stopCharge(f, M, wall, ev);
      // how far the charge has come along its lane: it lands when its front reaches the lamplighter
      f.prog = Math.max(f.prog, (b.x - f.lane.x) * ux + (b.z - f.lane.z) * uz);
      if (!f.landed) {
        const dx = s.x - f.lane.x, dz = s.z - f.lane.z, along = dx * ux + dz * uz, across = -dx * uz + dz * ux;
        if (along >= -0.3 && along <= M.len + 0.3 && Math.abs(across) <= M.width / 2 && along <= f.prog + f.T.r + LAMP_R && Math.abs(s.y - f.y) <= 1.6)
          f.landed = strike(f, M.dmg, [f.x, f.z], ev, { push: M.push });
      }
      if (at === M.act - 1) { f.marker = null; b.vx = b.vz = 0; return { hard: [0, 0] }; }
      return { hard: [ux * M.v, uz * M.v], wall: true };
    }
    return { hard: [0, 0] };
  }
  function stopCharge(f, M, wall, ev) {
    const b = f.body.s;
    b.vx = b.vz = 0;
    f.marker = null;
    if (wall) {
      F.melee.delete(f);
      f.state = 'stun'; f.t = 0; f.stunned = true; clearMove(f); f.marker = null;
      ev.push({ type: 'burst', kind: 'clang', x: b.x + Math.sin(f.yaw) * f.T.r, y: b.y + 1.2, z: b.z + Math.cos(f.yaw) * f.T.r, r: 0.8 }, { type: 'cue', cue: 'clang', foe: f.id });
      return { hard: [0, 0] };
    }
    f.mt = M.wind + M.act - 1; // on into the recovery
    return { hard: [0, 0] };
  }

  /* ---------------- the mind: noticing, the leash, the way home, holding back, and when to attack ---------------- */
  // a point on the ring 3.5 m round the lamplighter, along the foe's bearing from it, pushed away from the other foes' bearings
  function holdRing(f, s) {
    const b = Math.atan2(f.x - s.x, f.z - s.z);
    let push = 0;
    for (const o of F.foes) {
      if (o === f || !solid(o)) continue;
      const d = wrap(b - Math.atan2(o.x - s.x, o.z - s.z));
      if (Math.abs(d) < RULES.spread) push += Math.sign(d || (f.k - o.k) || 1) * (RULES.spread - Math.abs(d)) * 0.5;
    }
    const [x, z] = inLeash(f, s.x + Math.sin(b + push) * RULES.hold, s.z + Math.cos(b + push) * RULES.hold);
    /* in the band (3.2 to 3.8 m) it circles the lamplighter at 0.8 m/s, turning the way that keeps its 50° from the others, and turns
       back at its leash; out of the band it walks to its spot on the ring */
    if (push) f.orbit = Math.sign(push);
    const r = Math.hypot(f.x - s.x, f.z - s.z);
    if (Math.abs(r - RULES.hold) < RULES.band) {
      const v = FAIR.circle, c = f.zone.c, k = clamp((RULES.hold - r) * 2, -0.6, 0.6);
      const vx = Math.cos(b) * f.orbit * v + Math.sin(b) * k, vz = -Math.sin(b) * f.orbit * v + Math.cos(b) * k;
      if (Math.hypot(f.x + vx * 0.5 - c[0], f.z + vz * 0.5 - c[2]) > f.zone.leash - 0.1) { f.orbit = -f.orbit; return null; }
      return [vx, vz];
    }
    return towards(f, x, z, f.T.walk);
  }
  function approach(f, s, want, v) {
    const dx = f.x - s.x, dz = f.z - s.z, d = Math.hypot(dx, dz) || 1;
    if (d <= want) return null;
    return towards(f, ...inLeash(f, s.x + (dx / d) * want, s.z + (dz / d) * want), v);
  }
  function mind(f, ev) {
    const em = EK.think(f, ev); if (em) return em.want;
    const T = f.T, s = lamp(), c = f.zone.c;
    const d = Math.hypot(s.x - f.x, s.z - f.z), inChase = Math.hypot(s.x - c[0], s.z - c[2]) <= f.zone.leash + RULES.chase;
    if (!f.aware) {
      if (inChase && (d <= RULES.near || (d <= RULES.notice && (F.step + f.k) % RULES.sight === 0 && sees(f, s)))) { f.aware = true; f.away = 0; }
    } else if (!inChase) {
      if (++f.away >= RULES.home) { f.aware = false; f.away = 0; f.state = 'home'; }
    } else f.away = 0;
    if (F.calm) f.aware = false;
    if (f.flinch > 0) return { hard: [0, 0] };
    if (!f.aware) {
      if (atHome(f)) { f.state = 'idle'; return null; }
      f.state = 'home';
      turnTo(f, Math.atan2(f.home[0] - f.x, f.home[2] - f.z));
      return towards(f, f.home[0], f.home[2], T.walk);
    }
    f.state = 'chase';
    faceLamp(f, s);
    // a foe on its cooldown, or waiting after a cancel or a blow it landed, holds back
    const off = f.cool > 0 || F.step < f.wait;
    switch (f.type) {
      case 'S': case 'M': {
        const M = T.moves[f.type === 'S' ? 'hook' : 'pulse'], name = f.type === 'S' ? 'hook' : 'pulse';
        if (!off && d <= M.range && Math.abs(s.y - f.y) < 1.6 && sees(f, s)) {
          f.ready++;
          /* a Snuffer that comes in from the circle (3.2 to 3.8 m) steps in to 2.9 m first, so its hook can reach: it starts at the
             edge of its range only when it has stood there 20 steps and cannot come nearer */
          const close = f.type !== 'S' || d <= M.range - 0.3 || f.ready >= 20;
          if (close && mayAttack(f, 'melee', M.wind)) { startMove(f, name, ev); return null; }
        } else f.ready = 0;
        if (!off && F.melee.size < F.tokens) return approach(f, s, M.range - 0.4, T.close);
        return holdRing(f, s);
      }
      case 'P': {
        const M = T.moves.lob;
        if (!off && d >= M.min && d <= M.range && sees(f, s)) {
          f.ready++;
          if (mayAttack(f, 'coal', M.wind + M.release + M.flight)) { startMove(f, 'lob', ev); return null; }
        } else f.ready = 0;
        if (d < T.back) { const dx = f.x - s.x, dz = f.z - s.z, l = d || 1; return towards(f, ...inLeash(f, s.x + (dx / l) * T.keep[0], s.z + (dz / l) * T.keep[0]), T.walk); }
        if (d > T.keep[1]) return approach(f, s, T.keep[1] - 0.5, T.walk);
        return null;
      }
      case 'I': {
        const C = T.moves.charge, Sl = T.moves.slam;
        const want = d <= Sl.range && Math.abs(s.y - f.y) < 1.6 ? 'slam' : d >= C.min && d <= C.range && Math.abs(s.y - f.y) < 1.6 && sees(f, s) ? 'charge' : null;
        if (!off && want) {
          f.ready++;
          if (mayAttack(f, 'melee', T.moves[want].wind)) { startMove(f, want, ev); return null; }
        } else f.ready = 0;
        if (!off && F.melee.size < F.tokens && d > C.range) return approach(f, s, C.range - 1, T.walk);
        return holdRing(f, s);
      }
    }
    return null;
  }

  /* ---------------- the body ----------------
   A walker is a play.js body with its own PARAMS (radius, speed, accel 18, no jump, a step of 0.35, no turn: the facing is the foe's
   own). Its ledge probe looks 0.7 m ahead and stops it dead before a drop of more than 0.6 m; a push or a charge has no probe. The
   Mirelight flies: over water and pits at its zone's height or above, never through a wall more than 1 m above its float */
  function physics(f, want) {
    let hard = false, v = want, pushEnds = false;
    if (f.push) { const p = f.push; v = [p.ux * p.v, p.uz * p.v]; hard = true; if (--p.n <= 0) { f.push = null; pushEnds = true; } }
    else if (want && want.hard) { v = want.hard; hard = true; }
    let vx = v ? v[0] : 0, vz = v ? v[1] : 0;
    if (f.shove && !hard) { vx += f.shove[0]; vz += f.shove[1]; }
    f.shove = null;
    if (f.T.fly) { fly(f, vx, vz, hard); if (pushEnds) f.vx = f.vz = 0; return; }
    const b = f.body, s = b.s, P = b.P;
    let sp = Math.hypot(vx, vz);
    if (sp > 1e-3 && s.ground && !hard) {
      const fl = walk.floorAt(s.x + (vx / sp) * RULES.probe, s.z + (vz / sp) * RULES.probe, s.y + P.stepUp, s.y);
      if (fl < s.y - P.stepDown) { s.vx = s.vz = 0; vx = vz = 0; sp = 0; }
    }
    P.run = P.walk = Math.max(sp, 0.01);
    if (hard) P.accel = P.airAccel = 400;
    const x0 = s.x, z0 = s.z;
    b.step(STEP, sp > 1e-3 ? { mz: 1 } : {}, sp > 1e-3 ? yawFor(vx / sp, vz / sp) : 0);
    P.accel = 18; P.airAccel = PARAMS.airAccel;
    s.yaw = f.yaw;
    // a push ends dead, as the lamplighter's does: a plain velocity would slide on (5 m/s slides 0.31 m)
    if (pushEnds && s.ground) s.vx = s.vz = 0;
    f.walking = Math.hypot(s.x - x0, s.z - z0) / STEP;
    // a charge that a wall stops before the probe sees it (a corner, a post) is a charge into a wall too
    if (want && want.wall && f.walking < 0.4 * sp) stopCharge(f, f.T.moves.charge, true, F.out);
    f.x = s.x; f.y = s.y; f.z = s.z;
  }
  function fly(f, vx, vz, hard) {
    if (hard) { f.vx = vx; f.vz = vz; }
    else {
      const dvx = vx - f.vx, dvz = vz - f.vz, dl = Math.hypot(dvx, dvz), k = dl > 0 ? Math.min(1, (18 * STEP) / dl) : 0;
      f.vx += dvx * k; f.vz += dvz * k;
    }
    const nx = f.x + f.vx * STEP, nz = f.z + f.vz * STEP;
    if (Math.abs(nx) < lim && Math.abs(nz) < lim && walk.support(nx, nz, f.y + 1.0) !== null) { f.x = nx; f.z = nz; }
    else f.vx = f.vz = 0;
    const fl = walk.support(f.x, f.z, f.y + 1.0) ?? f.y;
    const want = Math.max(fl, water ?? -Infinity, f.zone.c[1] - 2);
    f.y += clamp(want - f.y, -2 * STEP, 3 * STEP);
    f.walking = Math.hypot(f.vx, f.vz);
  }
  const floorUnder = f => (f.T.fly ? walk.support(f.x, f.z, f.y + 1.0) ?? f.y : f.body.s.floor);

  /* ---------------- one foe, one play step ---------------- */
  function stepFoe(f, ev) {
    // the ticking states (status.js): Char, Soot and a state's burn deal their share, and Char, Soot, Blind and Mark count down
    statusTick(f, { ev });
    if (f.hold) return;
    // the states abilities put on a foe (status.js): a stun or a hold stops it where it stands, and its wind-up; a slow halves its walk
    // and its wind-up
    const st = statusStep(f);
    // a hit lands in the blade's step, before this think: its flinch or knock-down counts from the next play step
    const fresh = f.hitAt === F.step;
    if (f.cool > 0) f.cool--;
    // the flinch and the brace count on in a stun or a hold too; the brace counts while the foe stands (not while it is down), so a
    // braced foe gets up still braced and can answer
    if (f.flinch > 0 && !fresh) f.flinch--;
    if (f.braced > 0 && !fresh && f.state !== 'down') f.braced--;
    if (st.stop && ['idle', 'chase', 'home', 'move'].includes(f.state)) {
      if (f.state === 'move' || f.special) cancelMove(f);
      physics(f, { hard: [0, 0] });
      return;
    }
    let want = null;
    switch (f.state) {
      case 'asleep': case 'out': return;
      case 'cracks': if (++f.t >= RULES.cracks) startRise(f, ev); return;
      case 'rise': if (++f.t >= RULES.rise) { f.state = f.aware ? 'chase' : 'idle'; f.t = 0; f.alive = true; } return;
      case 'sink': if (++f.t >= RULES.sink) endSink(f, ev); return;
      case 'dying': if (++f.t >= RULES.dying) { f.state = 'out'; freeSlot(f); } return;
      case 'down': if (!fresh && ++f.t >= f.downFor) { f.state = 'chase'; f.aware = true; f.cool = Math.max(f.cool, S(f.T.cool[0])); } break;
      case 'stun': if (++f.t >= f.T.moves.charge.stun) { f.state = 'chase'; f.stunned = false; f.cool = coolOf(f.T); } break;
      // a broken poise: it stands where it is for 1.2 s, then fights on
      case 'stagger': want = { hard: [0, 0] }; if (++f.t >= (f.staggerFor ?? STAGGER.steps)) { f.state = 'chase'; f.aware = true; if (!f.staggerFor) f.staggerEnd = F.step; f.staggerFor = null; f.cool = Math.max(f.cool, S(f.T.cool[0])); } break;
      case 'move': {
        // slowed: a wind-up counts on only on the share of steps the slow leaves
        if (st.speed < 1 && phaseOf(f.T.moves[f.move], f.mt) === 'wind' && (f.slowAcc = (f.slowAcc || 0) + st.speed) < 1) { want = { hard: [0, 0] }; break; }
        if (st.speed < 1) f.slowAcc = Math.max(0, (f.slowAcc || 0) - 1);
        want = runMove(f, ev);
        break;
      }
      default: want = mind(f, ev);
    }
    if (f.state === 'out' || f.state === 'dying') return;
    // a slow also slows a drive that brakes and turns at once: an Ironback's charge through a snare or Rime's cone, a hook's step
    if (st.speed < 1 && Array.isArray(want)) want = [want[0] * st.speed, want[1] * st.speed];
    else if (st.speed < 1 && want?.hard) want = { ...want, hard: [want.hard[0] * st.speed, want.hard[1] * st.speed] };
    physics(f, want);
    if (f.state === 'out' || f.state === 'dying') return;
    // off the edge: more than 6 m below its zone, or under y -25, it is put out, and its glim drops on its last firm ground
    const c = f.zone.c;
    if (f.y < RULES.fall || f.y < c[1] - RULES.outBelow) { putOut(f, ev, f.firm); return; }
    // off its ground: outside the leash or more than 2 m below the centre. 4 s on, if it is not home, it sinks and rises at home
    const offG = Math.hypot(f.x - c[0], f.z - c[2]) > f.zone.leash + 0.25 || f.y < c[1] - RULES.below;
    if (offG && !atHome(f)) {
      if (++f.offT >= RULES.off) { cancelMove(f); f.state = 'sink'; f.t = 0; f.sinkTo = 'home'; f.alive = false; }
    } else f.offT = 0;
    const grounded = f.T.fly || f.body.s.ground;
    if (grounded && !offG) f.firm = [f.x, f.y, f.z];
  }
  function startRise(f, ev) {
    if (!takeSlot(f)) return; // its slot is still sinking: wait a step
    place(f, f.home);
    f.state = 'rise'; f.t = 0;
    ev.push({ type: 'cue', cue: 'rise', foe: f.id });
  }
  function endSink(f, ev) {
    place(f, f.home);
    f.offT = 0; f.push = null;
    if (f.sinkTo === 'sleep') { f.state = 'asleep'; f.aware = false; freeSlot(f); }
    else { f.state = 'rise'; f.t = 0; ev.push({ type: 'cue', cue: 'rise', foe: f.id }); }
  }
  function place(f, p) {
    if (f.body) { f.body.place([p[0], p[1] + 0.3, p[2]], f.yaw); f.x = f.body.s.x; f.y = f.body.s.y; f.z = f.body.s.z; }
    else { f.x = p[0]; f.z = p[2]; f.y = Math.max(p[1], water ?? -Infinity); f.vx = f.vz = 0; }
    f.firm = [f.x, f.y, f.z];
  }

  /* ---------------- hits on a foe ----------------
   By weight (design.md "What a hit does, by state"). A light or medium foe: the finisher and the plunge (how.knock) knock it down,
   which stops anything. Any other hit that interrupts (the blade's, or an ability's with how.interrupt) flinches it for its hit stun
   with its knock back while it chases, and in its wind-up cancels the attack: no blow, its token back at once, and a wait of 0.6 s
   past the stun. A blow in its active time goes on, and a hit there or in the recovery holds the recovery 0.2 s longer, at most 0.4 s
   a move. Three flinches in 3 s (a cancel and a knock-down count) brace it for 1.5 s: no flinch, no knock-down and no cancel. A heavy
   foe (the Ironback, or any elite) never flinches: its poise wears, twice as fast in a wind-up, and breaks into a stagger. A stunned
   Ironback takes 50% more. A held foe takes the damage and holds its pose. */
  function hitFoe(f, raw, how = {}) {
    if (!hittable(f)) return false;
    // a tick (status.js tickHit: Char, Soot, a burn, a moth of the swarm): the damage and a short flash, and nothing else. No flinch, no
    // poise worn, no wind-up stopped, and it does not make the foe aware
    if (how.tick) {
      const n = dealt(raw);
      f.hp = Math.max(0, f.hp - n);
      f.flashTo = Math.max(f.flashTo ?? 0, F.game + 2);
      if (f.hp <= 0) kill(f);
      return n;
    }
    const dmg = dealt(raw, (f.stunned ? f.T.stunned : 1) * (f.state === 'stagger' ? STAGGER.take : 1));
    f.hp = Math.max(0, f.hp - dmg);
    // bright on the step of the hit and the two after it (think counts the game step on after the blade's step)
    f.flashTo = F.game + 1 + RULES.flash;
    f.shakeTo = F.game + 1 + RULES.shake;
    f.flash = RULES.flash; f.shake = RULES.shake;
    const fx = how.from ? f.x - how.from[0] : Math.sin(f.yaw), fz = how.from ? f.z - how.from[1] : Math.cos(f.yaw), fl = Math.hypot(fx, fz) || 1;
    f.shakeDir = [fx / fl, fz / fl];
    if (f.hp <= 0) { kill(f); return dmg; }
    // a Mark (status.js): this hit bursts it for 22, a hit of its own, after this one's rules
    if (f.status?.mark > 0 && !how.state && !how.parry) { const r = hitRules(f, dmg, how); markHit(f, how, F.pending); return r; }
    return hitRules(f, dmg, how);
  }
  // what a hit does by the foe's state, after its damage is taken (hitFoe)
  function hitRules(f, dmg, how) {
    if (breakPoise(f, dmg)) return dmg;
    const heavy = heavyOf(f);
    // Ember parry: a light foe is knocked down below; a heavy foe (an Ironback, an elite) staggers for the parry's time, whatever its
    // poise, and its blow is cut off. The run's parry has its own clang, so no cue here
    if (how.parry && heavy) {
      cancelMove(f);
      f.hold = null; f.push = null; f.flinch = 0;
      f.state = 'stagger'; f.t = 0; f.staggerFor = how.knock || STAGGER.steps; f.aware = true;
      f.hitAt = F.step + 1;
      queue({ type: 'stagger', foe: f.id, x: f.x, y: f.y + f.T.chest, z: f.z, parry: true });
      return dmg;
    }
    if (f.hold || heavy) return dmg;
    const ph = f.state === 'move' ? phaseOf(f.T.moves[f.move], f.mt) : null, T = f.T;
    const interrupt = how.interrupt ?? FAIR.blade.includes(how.kind);
    f.hitAt = F.step + 1;
    f.aware = true;
    let push = 0;
    if (how.knock && !(FAIR.braceHolds && f.braced > 0)) {
      // the finisher and the plunge knock it down unless it is braced; one in a wind-up is a cancel, and steels the foe
      if (ph === 'wind') { snap(f, 'knock'); f.cancels++; f.steelTo = F.step + FAIR.steel; }
      cancelMove(f);
      f.state = 'down'; f.t = 0; f.downFor = how.knock; f.flinch = 0;
      flinched(f);
      push = how.push || 0;
    } else if (!interrupt || f.state === 'down') {
      // a tick (burn, pitch), or a foe already down: the damage only
    } else if (f.braced > 0 || (f.armorMove && ph === 'wind')) {
      // braced: the damage and the knock back, but no flinch and no cancel (none in a wind-up or active time, which would carry the
      // blow out of reach)
      if (ph !== 'wind' && ph !== 'act') push = T.knock;
    } else if (ph === 'act' || ph === 'rec') {
      const add = Math.max(0, Math.min(FAIR.recAdd, FAIR.recMax - f.recAdd));
      f.recAdd += add; f.recLeft += add;
    } else {
      if (ph === 'wind') {
        cancelMove(f);
        f.cancels++;
        f.wait = Math.max(f.wait, F.step + 1 + T.stun + FAIR.stunWait);
        // steeled: its next wind-up begun within 4 s is armored (the rim shows 2 dabs until then)
        f.steelTo = F.step + FAIR.steel;
        snap(f, 'cancel');
      }
      f.flinch = T.stun;
      flinched(f);
      push = T.knock;
    }
    // (a push under way, as the Crook line's pull, is not cut short)
    if (push > 0 && !f.push) f.push = { ux: f.shakeDir[0], uz: f.shakeDir[1], v: (push * 60) / RULES.pushSteps, n: RULES.pushSteps };
    return dmg;
  }
  // a flinch counts toward the brace: the third in 3 s braces the foe for 1.0 s
  function flinched(f) {
    f.flinches = f.flinches.filter(t => F.step - t < FAIR.braceIn);
    f.flinches.push(F.step);
    if (f.flinches.length >= FAIR.braceN) { f.braced = FAIR.brace; f.flinches = []; }
  }
  /* a cancel or a poise break: a hit stop of 5 steps, the snap (sound.js) and its sparks and kick (fight.js) */
  /* the hit stop, the cue and the kick come once a step at most, however many foes a hit stops (a Lantern bomb, a cut that meets two
     wind-ups); every foe it stops gets its sparks (first: false on the others) */
  function snap(f, why) {
    const first = F.snapAt !== F.step;
    F.snapAt = F.step;
    if (first) queue({ type: 'stop', n: FAIR.snapStop });
    queue({ type: 'snap', foe: f.id, kind: f.type, why, x: f.x, y: f.y + f.T.chest * (f.size || 1), z: f.z, gy: f.y, first });
    if (first) queue({ type: 'cue', cue: 'snap', foe: f.id, kind: f.type, why });
  }
  /* the poise (feel.js STAGGER): the damage comes off it too, twice over in a wind-up, and at 0 the foe staggers, its wind-up ended.
     -> true when the foe is in a stagger now (a hit in a stagger takes 25% more and does nothing else) */
  function breakPoise(f, dmg, exact = false) {
    if (f.state === 'stagger') return true;
    const max = poiseOf(f);
    if (!max || f.state === 'stun' || f.state === 'down') return false;
    if (f.poise === undefined || F.step - (f.poiseAt ?? -1e9) >= STAGGER.refill) f.poise = max;
    f.poiseAt = F.step;
    // in the 4 s after a stagger the poise holds full: the foe cannot break again, and its rim says so
    if (F.step < (f.staggerEnd ?? -1e9) + STAGGER.gap) { f.poise = max; return false; }
    f.poise = Math.max(0, f.poise - dmg * (winding(f) && !exact ? STAGGER.wind : 1));
    if (f.poise > 0) return false;
    const was = winding(f);
    cancelMove(f);
    f.hold = null; f.push = null; f.flinch = 0;
    f.state = 'stagger'; f.t = 0; f.poise = max; f.aware = true; f.staggerFor = null;
    f.hitAt = F.step + 1;
    if (was) f.cancels++;
    // the event the fight feels and draws (fight.js), and its sound: the clang of a broken guard (sound.js), marked as a stagger
    queue({ type: 'stagger', foe: f.id, x: f.x, y: f.y + f.T.chest, z: f.z });
    queue({ type: 'cue', cue: 'clang', foe: f.id, stagger: true });
    snap(f, 'break');
    return true;
  }
  // put out: its glim drops (on its last firm ground when it is off its ground or in the air), and its slot frees after its parts fall
  function kill(f, ev = null) {
    const grounded = f.T.fly || f.body?.s.ground, c = f.zone.c;
    const onGround = grounded && Math.hypot(f.x - c[0], f.z - c[2]) <= f.zone.leash + 0.25 && f.y >= c[1] - RULES.below;
    // a flier's drops fall to the ground (or the water) under it, so a pattern or an ability lamp can be touched
    let at = onGround ? [f.x, f.y, f.z] : f.firm;
    if (f.T.fly) at = [at[0], groundY(at[0], at[2], at[1]), at[2]];
    putOut(f, ev, at);
  }
  function putOut(f, ev, at) {
    if (f.out || f.state === 'dying') return;
    const was = f.state;
    cancelMove(f);
    f.alive = false; f.hold = null; f.push = null;
    f.diedAt = { x: f.x, y: f.y, z: f.z, yaw: f.yaw, step: F.game };
    f.out = true;
    if (shown({ state: was }) && was !== 'sink') { f.state = 'dying'; f.t = 0; } else { f.state = 'out'; freeSlot(f); }
    (ev ? e => ev.push(e) : queue)({ type: 'foeOut', foe: f.id, x: f.x, y: f.y, z: f.z, burning: f.status?.burn > 0 });
    (ev ? e => ev.push(e) : queue)({ type: 'cue', cue: 'out', foe: f.id });
    // a sooted foe passes its Soot on (status.js); the last foe of a zone clears it (the Shell wick, the Ward set)
    if (statusOut(f, F.foes).length) (ev ? e => ev.push(e) : queue)({ type: 'cue', cue: 'soot', foe: f.id });
    if (f.zone.members.every(gone)) (ev ? e => ev.push(e) : queue)({ type: 'zoneClear', zone: f.zone.id });
    F.runner?.foeOut(comboGlim(f.T.glim, F.combo?.tier ?? 0), at, f);
  }

  /* ---------------- zones ---------------- */
  function wakeZone(Z, ev) {
    Z.awake = true;
    const pts = [];
    for (const f of Z.members) {
      if (gone(f) || f.state !== 'asleep') continue;
      f.state = 'cracks'; f.t = 0; f.aware = false; f.offT = 0;
      place(f, f.home);
      pts.push(f.home.slice());
    }
    ev.push({ type: 'cracks', zone: Z.id, pts }, { type: 'cue', cue: 'cracks', zone: Z.id });
  }
  // an elite that falls asleep wakes with its toast and its drone again (elites.js K.think reads alerted)
  function sleepZone(Z) {
    Z.awake = false;
    for (const f of Z.members) if (!gone(f)) { cancelMove(f); f.state = 'asleep'; f.aware = false; f.alive = false; f.alerted = false; freeSlot(f); place(f, f.home); }
  }
  // a zone that gives up its slots for a guard: it sleeps, and its foes sink over 0.6 s with their health
  function giveUp(Z) {
    Z.awake = false;
    for (const f of Z.members) {
      if (gone(f)) continue;
      f.alerted = false;
      if (f.state === 'cracks' || f.state === 'asleep') { f.state = 'asleep'; freeSlot(f); continue; }
      cancelMove(f);
      f.state = 'sink'; f.t = 0; f.sinkTo = 'sleep'; f.alive = false; f.aware = false; f.hold = null;
    }
  }
  /* the guard's second wave (mix.js mixWave): 1.5 s after its last foe goes out, the wave's foes rise at the first homes of the guard,
     with the ember cracks first; it keeps the beacon dark until it is put out too */
  function waves(ev) {
    for (const Z of F.zones) {
      if (Z.waveAt !== undefined) { if (F.step >= Z.waveAt) riseWave(Z, ev); continue; }
      if (!Z.guard || Z.boss || !Z.members.length || !Z.members.every(gone)) continue;
      const w = mixWave(Z);
      Z.waved = true;
      if (w) { Z.wave = w; Z.waveAt = F.step + WAVE.wait; }
    }
  }
  function riseWave(Z, ev) {
    const types = foesOf({ foes: Z.wave }), homes = Z.members.map(f => f.home), n0 = Z.members.length;
    delete Z.waveAt;
    Z.members = types.map((t, k) => makeFoe(Z, t, n0 + k, (homes[k] || homes[0]).slice()));
    for (const f of Z.members) { f.yaw = Math.atan2((meta.spawn?.p[0] ?? 0) - f.x, (meta.spawn?.p[2] ?? 0) - f.z); f.body && (f.body.s.yaw = f.yaw); }
    F.foes.push(...Z.members);
    Z.awake = false;
    wakeZone(Z, ev);
    ev.push({ type: 'wave', zone: Z.id, n: types.length });
  }
  function zones(ev) {
    const s = lamp();
    if (!F.calm) waves(ev);
    for (const Z of F.zones) {
      if (!Z.awake || Z.spawned || Z.boss || distTo(Z, s.x, s.z) <= RULES.sleep) continue;
      if (Z.members.every(f => gone(f) || f.state === 'asleep' || (f.state === 'idle' && atHome(f)))) sleepZone(Z);
    }
    if (F.calm || F.quiet) return;
    for (const Z of F.zones) {
      if (Z.awake || Z.boss || !live(Z) || Z.members.some(f => f.state === 'sink') || distTo(Z, s.x, s.z) >= RULES.wake) continue;
      const awake = awakeList(), me = { c: Z.c, foes: live(Z) };
      if (fits(me, awake, counts)) { wakeZone(Z, ev); continue; }
      if (!Z.guard) continue;
      const room = makeRoom(me, awake, counts, s.x, s.z);
      if (!room) continue;
      for (const g of room.gone) giveUp(g.ref);
      wakeZone(Z, ev);
    }
  }

  /* ---------------- the coal in the air ---------------- */
  function coals(ev) {
    const s = lamp();
    for (const c of F.coals.slice()) {
      if (++c.t < c.n) continue;
      F.coals.splice(F.coals.indexOf(c), 1);
      if (F.coal === c.f) F.coal = null;
      c.f.marker = c.f.move === 'lob' && phaseOf(c.f.T.moves.lob, c.f.mt) === 'wind' ? c.f.marker : null;
      ev.push({ type: 'burst', kind: 'coal', x: c.to[0], y: c.to[1], z: c.to[2], r: c.R }, { type: 'cue', cue: 'coal' });
      if (!F.blows.includes(F.step)) blowNow();
      if (s && inRing(s, c.to[0], c.to[1], c.to[2], c.R, c.rise) && !c.f.hold) strike(c.f, c.dmg, [c.to[0], c.to[2]], ev, { coal: true, miss: c.miss });
    }
  }
  // where a coal is in its flight: an arc from the hand to the ring's centre
  F.coalAt = c => {
    const u = c.t / c.n, h = 1.2 + 0.18 * Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]);
    return [c.from[0] + (c.to[0] - c.from[0]) * u, c.from[1] + (c.to[1] + 0.15 - c.from[1]) * u + h * 4 * u * (1 - u), c.from[2] + (c.to[2] - c.from[2]) * u];
  };

  /* ---------------- glim ----------------
   drop(n, at): n motes lie where they fell. After 0.4 s, a mote within 6 m of the lamplighter flies to it, and gives 1 glim when it
   arrives. A mote out of reach waits for the lamplighter. bank(): when a beacon lights, every mote not yet taken counts as carried */
  F.drop = (n, at) => {
    const p = at || [lamp().x, lamp().y, lamp().z];
    for (let k = 0; k < n; k++) {
      // a little apart, but on the ground they fell on (none over a ledge's edge)
      const a = (k / Math.max(1, n)) * Math.PI * 2 + 0.7, f = walk.support(p[0] + Math.sin(a) * 0.3, p[2] + Math.cos(a) * 0.3, p[1] + 0.5);
      const r = f !== null && Math.abs(f - p[1]) < 0.4 ? 0.3 : 0;
      F.motes.push({ x: p[0] + Math.sin(a) * r, y: p[1] + 0.35, z: p[2] + Math.cos(a) * r, base: p[1] + 0.35, t: 0, fly: false, vx: 0, vy: 0, vz: 0, k });
    }
  };
  function motes(ev) {
    const s = lamp(), run = F.runner?.rs.run;
    if (!s || !run) return;
    for (const m of F.motes.slice()) {
      m.t++;
      const dx = s.x - m.x, dy = s.y + 0.9 - m.y, dz = s.z - m.z, d = Math.hypot(dx, dy, dz);
      if (!m.fly && m.t >= RULES.glimWait && d <= RULES.glimReach) m.fly = true;
      if (!m.fly) { m.y = m.base + 0.06 * Math.sin((m.t + m.k * 9) * 0.11); continue; }
      const v = Math.min(14, 3 + (m.t - RULES.glimWait) * 0.35);
      if (d <= Math.max(RULES.glimTake, v * STEP)) {
        F.motes.splice(F.motes.indexOf(m), 1);
        run.carried += 1;
        ev.push({ type: 'glim', n: 1 }, { type: 'cue', cue: 'glim' });
        continue;
      }
      m.vx = (dx / d) * v; m.vy = (dy / d) * v; m.vz = (dz / d) * v;
      m.x += m.vx * STEP; m.y += m.vy * STEP; m.z += m.vz * STEP;
    }
  }
  F.bank = () => {
    const run = F.runner?.rs.run;
    if (run) run.carried += F.motes.length;
    F.motes.length = 0;
  };

  /* ---------------- bodies push apart ----------------
   As a velocity before the next step: the lamplighter loses its speed into a foe and gets a little away from it (not in a roll, which
   passes through, and not against a charging Ironback); a light foe gets the rest, and foes push each other apart */
  function apart() {
    const s = lamp(), rolling = F.runner?.fighter.f.move === 'roll';
    const list = F.foes.filter(f => solid(f) && !f.hold);
    for (const f of list) {
      if (rolling || (f.move === 'charge' && phaseOf(f.T.moves.charge, f.mt) === 'act')) continue;
      const p = pushOut(s, f.x, f.y, f.z, f.T.r);
      if (p && f.T.light) f.shove = [-p[0] * p[2] * 6, -p[1] * p[2] * 6];
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.T.r + b.T.r;
      if (d >= min || d < 1e-6 || Math.abs(a.y - b.y) > 1.5) continue;
      const ux = dx / d, uz = dz / d, k = (min - d) * 5;
      if (a.T.light) a.shove = [(a.shove?.[0] || 0) - ux * k, (a.shove?.[1] || 0) - uz * k];
      if (b.T.light) b.shove = [(b.shove?.[0] || 0) + ux * k, (b.shove?.[1] || 0) + uz * k];
    }
  }

  /* ---------------- each game step ----------------
   The flash and the shake count game steps, also in hit stop. The rest runs on play steps. With the lamplighter dead, the run over,
   or the beacon lit, the foes stop choosing attacks (calm) */
  F.think = (ev, play) => {
    F.game++;
    for (const f of F.foes) { f.flash = Math.max(0, (f.flashTo ?? 0) - F.game); f.shake = Math.max(0, (f.shakeTo ?? 0) - F.game); }
    if (F.pending.length) { ev.push(...F.pending); F.pending.length = 0; }
    if (!play || !lamp()) return;
    F.step++;
    F.out = ev;
    const R = F.runner;
    F.calm = !R || R.dead || R.lit || !R.rs.run;
    // the coal in the air before the foes, so a coal thrown this step flies its whole 0.65 s; the zones after them, so a zone that wakes
    // shows its cracks for 36 whole steps, and a guard rises as the zones that gave up their slots finish sinking
    coals(ev);
    for (const f of F.foes) stepFoe(f, ev);
    zones(ev);
    motes(ev);
    apart();
    if (F.pending.length) { ev.push(...F.pending); F.pending.length = 0; }
  };
  F.bind = r => { F.runner = r; return F; };
  /* the boss fight (boss.js): every awake zone gives up its slots, its foes sinking over 0.6 s with their health, and no zone wakes
     again in this visit of the place, so only the boss is awake in the fight and no zone wakes after its fall */
  F.hush = () => {
    F.quiet = true;
    for (const Z of F.zones) if (Z.awake && !Z.boss) giveUp(Z);
  };

  /* ---------------- what the run and the page ask ---------------- */
  // the targets of the blade, soft aim, R, Look and RB: the foes that can be hit (not rising, sinking or going out)
  F.targets = () => F.foes.filter(hittable);
  // the guard rule: the beacon lights only when its guard zone is clear. -> { ok, why, at } (at: where the keepers stand)
  F.lightable = () => {
    const g = F.zones.find(Z => Z.guard && !Z.boss);
    if (!g || (g.members.every(gone) && g.waveAt === undefined && !mixWave(g))) return { ok: true };
    return { ok: false, why: keeperLine(g.keeper), at: g.c.slice(), zone: g.id };
  };
  // the awake foes, for the cameras and the notches: home is a foe standing at home, homing one walking home
  F.awake = () => F.foes.filter(f => shown(f) && f.state !== 'dying').map(f => ({
    id: f.id, type: f.type, zone: f.zone.id, x: f.x, y: f.y, z: f.z, r: f.T.r, chest: f.T.chest, state: f.state,
    home: f.state === 'idle' && atHome(f), homing: f.state === 'home', rising: f.state === 'rise', move: f.move
  }));
  // the foe the blade's soft aim is on, or null
  F.target = () => { const t = F.runner?.fighter.f.target; return t && F.foes.includes(t) && hittable(t) ? t.id : null; };
  // the wind-ups under way, for the off-screen notches: how full each notch is
  F.windups = () => F.foes.filter(f => f.state === 'move' && phaseOf(f.T.moves[f.move], f.mt) === 'wind').map(f => ({
    id: f.id, type: f.type, x: f.x, y: f.y + f.T.chest, z: f.z, fill: clamp((f.mt + f.windAdd) / (f.T.moves[f.move].wind + f.windAdd), 0, 1)
  }));
  F.find = q => (typeof q === 'number' ? F.list()[q]?.ref : F.foes.find(f => f.id === q)) || null;
  // the ?test view of each awake foe: id, type, zone, x, y, z, hp, move (its move, or its state), t (seconds in the move), flash
  F.list = () => F.foes.filter(f => shown(f)).map(f => ({
    ref: f, id: f.id, type: f.type, zone: f.zone.id, x: f.x, y: f.y, z: f.z, yaw: f.yaw, hp: f.hp, state: f.state,
    move: f.move || f.state, t: (f.move ? f.mt : f.t) / 60, flash: f.flash, held: !!f.hold, stunned: f.stunned, cool: f.cool,
    elite: !!f.elite, poise: poiseOf(f) ? (f.poise === undefined || F.step - (f.poiseAt ?? -1e9) >= STAGGER.refill ? poiseOf(f) : f.poise) : null,
    stagger: f.state === 'stagger' ? (f.staggerFor ?? STAGGER.steps) - f.t : 0,
    weight: f.elite ? 'heavy' : f.T.weight, stun: f.flinch, braced: f.braced, armor: armored(f), cancels: f.cancels, wait: Math.max(0, f.wait - F.step),
    rec: f.recAdd, off: f.windAdd > 0, rim: rimOf(f, F.step)
  }));
  // the tokens, for ?test: melee held of max, the coal held, and the steps before any foe may start a wind-up
  F.tokenView = () => ({ melee: F.melee.size, max: F.tokens, coal: F.coal ? 1 : 0, wait: Math.max(0, F.hurtWait - F.step) });

  /* ---------------- ?test hooks ---------------- */
  // wake a zone now, in free slots (a guard takes the room it needs). -> { ok, why }
  F.wake = id => {
    const Z = F.zones.find(z => z.id === id);
    if (!Z || Z.boss) return { ok: false, why: `no zone ${id}` };
    if (Z.awake) return { ok: true, already: true };
    if (!live(Z)) return { ok: false, why: `${id} is cleared` };
    const s = lamp(), awake = awakeList(), me = { c: Z.c, foes: live(Z) }, ev = [];
    if (!fits(me, awake, counts)) {
      const room = Z.guard && makeRoom(me, awake, counts, s?.x ?? Z.c[0], s?.z ?? Z.c[2]);
      if (!room) return { ok: false, why: 'no free slot' };
      for (const g of room.gone) giveUp(g.ref);
    }
    wakeZone(Z, ev);
    F.pending.push(...ev);
    return { ok: true };
  };
  /* one foe now, in a free slot: already risen, with no cracks and no cooldown, aware of the lamplighter. It is an awake zone of its
     own, with its home at its spawn point and a leash of 4 m. -> { ok, id } or { ok: false, why } */
  F.spawn = (type, x, z, yaw = 0) => {
    const T = TYPES[type];
    if (!T) return { ok: false, why: `no foe type ${type}` };
    const awake = awakeList();
    if (freeOf(type) < 1) return { ok: false, why: 'no free slot' };
    if (awake.reduce((n, q) => n + foesOf(q).length, 0) + 1 > RULES.cap) return { ok: false, why: 'six foes are awake' };
    const y = walk.support(x, z, walk.top(x, z) + 0.01) ?? walk.top(x, z);
    const Z = addZone({ id: `X${++F.spawned}`, name: 'spawned', c: [x, y, z], leash: RULES.spawnLeash, foes: type }, true);
    const f = Z.members[0];
    Z.awake = true;
    f.yaw = yaw;
    place(f, [x, y, z]);
    takeSlot(f);
    f.state = 'chase'; f.aware = true; f.alive = true; f.cool = 0;
    return { ok: true, id: f.id };
  };
  /* keep a foe's pose and place at t seconds of a move while the game steps; a held foe does not hit. hold(foe, null) lets it go on
     from there. -> the foe's id, or null */
  F.hold = (q, move, t = 0) => {
    const f = typeof q === 'object' && q ? q : F.find(q);
    if (!f || !hittable(f) && !f.hold) return null;
    if (move === null || move === undefined) { f.hold = null; return f.id; }
    const M = f.T.moves[move];
    if (!M) return null;
    if (f.move !== move) { cancelMove(f); f.state = 'move'; f.move = move; lay(f, move); }
    f.mt = clamp(Math.round(t * 60), 0, M.wind + M.act + M.rec - 1);
    if (move === 'charge') { f.marker = { kind: 'lane', ...f.lane, full: M.len }; }
    f.hold = { move, mt: f.mt };
    return f.id;
  };
  // put out one foe, or every foe of a zone, as a death does: its glim drops. A zone put out whole has no second wave. -> how many went out
  F.putOut = q => {
    const Z = F.zones.find(z => z.id === q), list = Z ? Z.members : [F.find(q)].filter(Boolean);
    if (Z) { Z.waved = true; delete Z.waveAt; }
    let n = 0;
    for (const f of list) {
      if (gone(f)) continue;
      const at = f.state === 'asleep' || f.state === 'cracks' ? f.home : [f.x, f.y, f.z];
      if (f.state === 'cracks') f.state = 'asleep';
      putOut(f, null, at);
      n++;
    }
    return n;
  };
  F.atHome = atHome;
  F.shown = shown;
  F.floorUnder = floorUnder;
  return F;
}

/* ---------------- the pose of a foe ----------------
   Which clip and time the page poses a foe with, from its state. time is the game's time in seconds, for the clips that loop */
export function poseOf(f, time = 0) {
  const T = f.T;
  switch (f.state) {
    case 'rise': return { clip: 'rise', t: f.t / 60 };
    case 'sink': return { clip: 'rise', t: 0.9 * Math.max(0, 1 - f.t / 36) };
    case 'down': return { clip: T.light ? 'down' : 'rest', t: f.t / 60 };
    case 'stun': return { clip: 'stun', t: f.t / 60 };
    // a stagger holds a clear pose: the Ironback's stun, a light foe's flinch held at its deepest, rocking a little
    case 'stagger': return T.light ? { clip: 'hurt', t: 0.12 + 0.03 * Math.sin(f.t * 0.35) } : { clip: 'stun', t: Math.min(f.t, 60) / 60 };
    case 'move': {
      const M = T.moves[f.move], ph = phaseOf(M, f.mt);
      if (ph === 'wind') return { clip: `${f.move}.windup`, t: Math.max(0, f.mt) / 60 };
      if (ph === 'act') return { clip: `${f.move}.attack`, t: (f.mt - M.wind) / 60 };
      return { clip: `${f.move}.recover`, t: (f.mt - M.wind - M.act) / 60 };
    }
    default:
      // stunned by a Flare or held by a snare (status.js): it stands in a stagger's pose, rocking a little, until the state ends
      if (f.status && (f.status.stun > 0 || f.status.hold > 0)) return T.light ? { clip: 'hurt', t: 0.12 + 0.03 * Math.sin(time * 6) } : { clip: 'stun', t: 0.5 };
      // the flinch of every light and medium foe: the hurt clip over its hit stun
      if (f.flinch > 0 && T.light) return { clip: 'hurt', t: Math.max(0, (T.stun || 21) - f.flinch) / 60 };
      return f.walking > 0.3 ? { clip: 'walk', t: time } : { clip: 'rest', t: time + f.k * 0.7 };
  }
}
