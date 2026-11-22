// Gloam Downs: the Barrow Reeve, the boss of Barrow Crown. Its mind and moves: it waits in its arena, rises at the intro, fights in
// three phases with a stumble at each change, chooses each of its five attacks from where the lamplighter stands, walks back to the
// arena's centre when the lamplighter leaves, and falls. Then its caged light rises and rides at the lantern, until the last beacon
// takes it. No DOM: the page (fight.js) poses the boss slot, its ground markers, its shards and the light from what is here, and the
// Node test (qa/lab/gloam-downs-boss.test.mjs) steps it as it is.
// Every time is in play steps of 1/60 s: the boss thinks and moves on play steps only, and its flash and shake count game steps.
// The boss is also a target of the blade ({ x, y, z, r, alive, hit(raw, how) }, as moves.js wants one).
import { makeBody, PARAMS } from './play.js';
import { dealt, yawFor } from './moves.js';
import { inRing, pushOut } from './foes.js';
import { stream, BASE } from './run.js';

const S = sec => Math.round(sec * 60);
const STEP = 1 / 60, DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const ease = u => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };
const LAMP_R = PARAMS.radius, BOSS_LOOK = 0.6;

/* ---------------- the numbers ----------------
   design.md "The boss: the Barrow Reeve". The arena: its centre, the leash the boss never walks out of, the 7.0 m inside which the
   lamplighter is in the arena, the 11 m of the intro (and of the pause for the boss files), the 13 m that Step back goes back to, and
   the ring of the 12 grave candles */
export const REEVE = {
  hp: 1300, phases: [800, 350], r: 0.9, chest: 1.7, height: 3.4, turn: 1.2, walk: [1.8, 1.8, 2.4], near: 2.6, reachY: 2.5,
  gap: [S(1.0), S(0.75), S(0.55)], intro: S(2.4), rise: S(0.9), stumble: S(2.0), fall: S(0.6), parts: S(0.6), stop: 9, kick: 0.2,
  arena: { c: [18, 0.68, -22], leash: 6.5, in: 7.0, intro: 11, back: 13, candles: 7.0, camera: 16 },
  light: { rise: S(0.5), fly: S(0.5), up: 1.2, over: 0.32, beacon: S(0.5) },
  flash: 3, shake: 6
};
/* what the player reads: the intro's card, the toast at the dark beacon (it names the arena zone's landmark, its keeper in
   lib/zones.mjs, and never a compass word), and the toast at the fall */
export const darkLine = keeper => `The Barrow Reeve holds its light on ${keeper}.`;
export const REEVE_TEXT = {
  card: ['V · The last light of the downs', 'The Barrow Reeve', 'It holds that light in a cage of ribs.'],
  dark: darkLine('the open ground below the standing stones'),
  carry: 'Carry the light to the beacon',
  notYet: 'The light has not come to the lantern yet.'
};
/* The five attacks, each a list of segments (a wind-up, its hit, a recovery; the double sweep has two of each), with the clips that
   pose them. from is the phase that adds it. The sweeps hit inside the front three slices of a ring of 4.0 m (±90°); the slam inside
   its ring of 3.4 m at its feet; each lamp-shard inside its ring of 1.3 m; the lunge inside its lane of 1.6 × 9 m, once the boss has
   reached the lamplighter. cue is the wind-up's sound, hitCue the hit's (stage 3 makes the sound) */
const seg = (kind, sec, clip) => ({ kind, n: S(sec), clip });
const SWEEP = { reach: 4.0, arc: 90 * DEG, front: 100 * DEG, turn: 1.5, hold: S(0.3), rise: 1.6, cue: 'crook', hitCue: 'sweep' };
export const ATTACKS = {
  sweep: { ...SWEEP, from: 1, dmg: 18, segs: [seg('wind', 0.8, 'sweep.windup'), seg('act', 0.2, 'sweep.attack'), seg('rec', 1.0, 'sweep.recover')] },
  slam: { from: 1, dmg: 22, ring: 3.4, range: 3.5, rise: 1.8, kick: 0.25, stop: 6, open: 1.5, cue: 'cage', hitCue: 'slam',
    segs: [seg('wind', 1.0, 'slam.windup'), seg('act', 0.15, 'slam.attack'), seg('rec', 1.5, 'slam.recover')] },
  shards: { from: 2, dmg: 14, ring: 1.3, ring0: 0.2, side: 2.5, fix: S(0.6), flight: S(0.6), min: 3.5, range: 9, rise: 1.6, cue: 'chime', hitCue: 'shard',
    segs: [seg('wind', 0.9, 'shards.windup'), seg('act', 0.2, 'shards.attack'), seg('rec', 0.8, 'shards.recover')] },
  lunge: { from: 2, dmg: 20, v: 13, width: 1.6, len: 9, fix: S(0.4), min: 6, rise: 1.6, turn: 1.5, cue: 'crouch', hitCue: 'lunge',
    segs: [seg('wind', 0.7, 'lunge.windup'), seg('act', 0.69, 'lunge.attack'), seg('rec', 1.0, 'lunge.recover')] },
  dsweep: { ...SWEEP, from: 3, dmg: 16,
    segs: [seg('wind', 0.8, 'sweep.windup'), seg('act', 0.2, 'sweep.attack'), seg('wind', 0.6, 'dsweep.windup'), seg('act', 0.2, 'dsweep.attack'), seg('rec', 1.2, 'dsweep.recover')] }
};
export const lengthOf = A => A.segs.reduce((n, g) => n + g.n, 0);
// the segment of an attack at mt play steps from its start: { kind, n, clip, i, at } (at: steps into it), or null when it is over
export function segAt(A, mt) {
  let a = 0;
  for (let i = 0; i < A.segs.length; i++) {
    const g = A.segs[i];
    if (mt < a + g.n) return { ...g, i, at: mt - a };
    a += g.n;
  }
  return null;
}
// the first play step of segment i, from the attack's start
export const segStart = (A, i) => A.segs.slice(0, i).reduce((n, g) => n + g.n, 0);
// phase 1 down to 800, phase 2 down to 350, phase 3 down to 0
export const phaseFor = hp => (hp >= REEVE.phases[0] ? 1 : hp >= REEVE.phases[1] ? 2 : 3);

/* ---------------- the choice ----------------
   From where the lamplighter stands: d is its distance from the boss's centre, ang its bearing from the boss's facing. Behind the boss
   within 3.5 m, the cage slam. In front within 4.0 m (±100°), a sweep (or, in phase 3, the double sweep), or the slam when the sweeps
   have had their two turns. From 3.5 to 9 m in phase 2 the lamp-shards, and over 6 m the stalking lunge; beyond 9 m only the lunge. No
   attack comes three times in a row. rnd picks between choices of the same place. -> an attack's name, or null (walk on) */
export function choose(phase, d, ang, last = [], rnd = Math.random) {
  const can = n => ATTACKS[n].from <= phase && !(last.length >= 2 && last[last.length - 1] === n && last[last.length - 2] === n);
  const one = l => (l.length > 1 ? l[Math.min(l.length - 1, Math.floor(rnd() * l.length))] : l[0] ?? null);
  const front = Math.abs(ang) <= SWEEP.front;
  if (!front && d <= ATTACKS.slam.range && can('slam')) return 'slam';
  if (front && d <= SWEEP.reach) {
    const sw = ['sweep', 'dsweep'].filter(can);
    if (sw.length) return one(sw);
    if (d <= ATTACKS.slam.range && can('slam')) return 'slam';
  }
  const far = [];
  if (d >= ATTACKS.shards.min && d <= ATTACKS.shards.range && can('shards')) far.push('shards');
  if (d > ATTACKS.lunge.min && can('lunge')) far.push('lunge');
  return one(far);
}

/* ---------------- the hit tests ----------------
   Each hits only a lamplighter whose centre is inside its marker, as the marker stood when it stopped */
// the sweeps' three slices: within R of the centre, and within ±90° of the facing held at the hit
export function inSlices(s, m, rise = SWEEP.rise) {
  const d = Math.hypot(s.x - m.x, s.z - m.z);
  if (d > m.R || Math.abs(s.y - m.y) > rise) return false;
  return d < 1e-6 || Math.abs(wrap(Math.atan2(s.x - m.x, s.z - m.z) - m.face)) <= SWEEP.arc;
}
// the lunge's lane: inside its width, along its length, and no farther along than the boss has come (prog) plus the two radii
export function inLane(s, m, prog, A = ATTACKS.lunge) {
  const ux = Math.sin(m.yaw), uz = Math.cos(m.yaw), dx = s.x - m.x, dz = s.z - m.z, along = dx * ux + dz * uz, across = -dx * uz + dz * ux;
  return along >= -0.3 && along <= A.len + 0.3 && Math.abs(across) <= A.width / 2 && along <= prog + REEVE.r + LAMP_R && Math.abs(s.y - m.y) <= A.rise;
}
// the three shard rings: one at the lamplighter, one 2.5 m to each side of it as the boss sees it
export function ringsAt(B, s, ground) {
  const dx = s.x - B.x, dz = s.z - B.z, d = Math.hypot(dx, dz) || 1, rx = dz / d, rz = -dx / d, k = ATTACKS.shards.side;
  return [[s.x, s.z], [s.x + rx * k, s.z + rz * k], [s.x - rx * k, s.z - rz * k]].map(([x, z]) => [x, ground(x, z, s.y), z]);
}

/* ---------------- the light after the fall ----------------
   It rises out of the broken cage (rise), flies to the lantern (fly), rides just over it (carried), and at the last beacon flies into
   the fire (beacon) and is gone. -> where it is, for the lantern at `lantern` and the beacon's fire at `fire` */
export function lightAt(L, lantern, fire = null) {
  const R = REEVE.light, over = [lantern[0], lantern[1] + R.over + 0.04 * Math.sin(L.t * 0.09), lantern[2]];
  const top = L.from ? [L.from[0], L.from[1] + R.up, L.from[2]] : over;
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  switch (L.state) {
    case 'rise': return mix(L.from, top, ease(L.t / R.rise));
    case 'fly': return mix(top, over, ease(L.t / R.fly));
    case 'carried': return over;
    case 'beacon': return mix(L.at || over, fire || over, ease(L.t / R.beacon));
    default: return null;
  }
}
// the lantern of a lamplighter at s, from its rest place on the lantern arm (lib/common.mjs lamplighter), turned by its facing
export const lanternOf = s => [s.x + Math.cos(s.yaw) * 0.56 + Math.sin(s.yaw) * 0.14, s.y + 0.35, s.z - Math.sin(s.yaw) * 0.56 + Math.cos(s.yaw) * 0.14];

/* ---------------- the boss of one visit to Barrow Crown ----------------
   makeBoss({ walk, arena, seed, runner, bounds, down, water }): arena is Barrow Crown's 'arena' zone ({ c, leash }); runner the run's
   runner (bind() may set it later): the boss hurts the lamplighter through runner.hurt, and its fall puts its 30 glim into the glim
   carried. down: the run's bossDown (a reload after the fall): the boss stays down, and the light rides at the lantern from the start.
   B.ready is set by the page when the boss files have loaded: until then the arena sleeps, and the intro waits.
   think(ev, play) runs on every game step after the lamplighter, as part of the runner's think; ev gets the cues, the stops, the bursts
   and { type: 'boss', what: 'intro' | 'start' | 'phase' | 'slam' | 'fall' | 'light' | 'hp' } for the page. */
export function makeBoss({ walk, arena = null, seed = 1, runner = null, bounds = 34, down = false, water } = {}) {
  const rng = stream(seed, 'boss');
  const c = (arena?.c || REEVE.arena.c).slice(), leash = arena?.leash ?? REEVE.arena.leash, dark = arena?.keeper ? darkLine(arena.keeper) : REEVE_TEXT.dark;
  const ground = (x, z, y = c[1]) => { let g = walk.support(x, z, y + 2.5); if (g === null) g = walk.top(x, z); return water !== undefined ? Math.max(g, water) : g; };
  const y0 = ground(c[0], c[2]);
  const B = {
    id: 'reeve', type: 'B', code: 'B', zone: 'arena', c, leash, hp: REEVE.hp, max: REEVE.hp, phase: 1, state: down ? 'down' : 'wait', t: 0,
    move: null, mt: 0, landed: false, last: [], gap: 0, prog: 0, started: false, up: !down, ready: false, hold: null, mk: null, shards: [],
    x: c[0], y: y0, z: c[2], yaw: 0, r: REEVE.r, alive: false, walking: 0, flash: 0, shake: 0, shakeDir: [1, 0], flashTo: 0, shakeTo: 0,
    game: 0, step: 0, pending: [], falling: false, stumbleNext: false, diedAt: null, runner,
    light: { state: down ? 'carried' : 'cage', t: 0, from: null, at: null },
    T: { chest: REEVE.chest, height: REEVE.height },
    hit: (raw, how) => hitBoss(raw, how)
  };
  B.body = makeBody(walk, { p: [B.x, y0 + 0.3, B.z], yaw: 0 }, bounds, { ...PARAMS, radius: REEVE.r, walk: REEVE.walk[0], run: ATTACKS.lunge.v, accel: 18, jumpV: 0, stepUp: 0.35, turnRate: 0 });
  const R = () => B.runner;
  const lamp = () => R()?.fighter.body.s;
  const fromCentre = (x, z) => Math.hypot(x - c[0], z - c[2]);
  const inArena = s => fromCentre(s.x, s.z) <= REEVE.arena.in;
  const faceOf = s => Math.atan2(s.x - B.x, s.z - B.z);
  const turnTo = (yaw, rate) => { B.yaw += clamp(wrap(yaw - B.yaw), -rate * STEP, rate * STEP); };
  const walkV = () => REEVE.walk[B.phase - 1];
  const calm = () => { const r = R(); return !r || r.dead || r.lit || !r.rs.run; };
  // a point the boss may walk to: inside its leash
  function inLeash(x, z) {
    const dx = x - c[0], dz = z - c[2], d = Math.hypot(dx, dz), L = leash - 0.1;
    return d <= L ? [x, z] : [c[0] + (dx / d) * L, c[2] + (dz / d) * L];
  }
  const towards = (x, z, v) => { const dx = x - B.x, dz = z - B.z, d = Math.hypot(dx, dz); return d < 0.05 ? null : [(dx / d) * v * Math.min(1, d * 4), (dz / d) * v * Math.min(1, d * 4)]; };
  const hittable = () => B.up && B.started && ['idle', 'home', 'move', 'stumble'].includes(B.state);
  const shown = () => ['intro', 'idle', 'home', 'move', 'stumble', 'fall', 'parts'].includes(B.state);
  // a hit on the lamplighter: true once it has landed (in a safe time it passes, and the attack tests its later active steps)
  function strike(dmg, from, ev, o = {}) {
    if (B.hold || !R()) return false;
    const r = R().hurt(dmg, from, o, ev);
    return r === 'hit' || r === 'dead' || r === 'none';
  }
  const place = (x, z, yaw) => { B.body.place([x, ground(x, z) + 0.3, z], yaw); B.x = B.body.s.x; B.y = B.body.s.y; B.z = B.body.s.z; B.yaw = yaw; };

  /* ---------------- moves ---------------- */
  function lay(name) {
    const s = lamp(), A = ATTACKS[name], gy = ground(B.x, B.z, B.y);
    if (name === 'sweep' || name === 'dsweep') B.mk = { kind: 'slices', x: B.x, y: gy, z: B.z, face: B.yaw, R: 0, full: A.reach };
    else if (name === 'slam') B.mk = { kind: 'ring', x: B.x, y: gy, z: B.z, R: 0, full: A.ring };
    else if (name === 'shards') B.mk = { kind: 'shards', rings: ringsAt(B, s, ground), done: [false, false, false], R: A.ring0, full: A.ring };
    else if (name === 'lunge') B.mk = { kind: 'lane', x: B.x, y: gy, z: B.z, yaw: B.yaw, len: 0, full: A.len };
  }
  function startMove(name, ev) {
    B.state = 'move'; B.move = name; B.mt = 0; B.landed = false; B.prog = 0; B.shards = [];
    B.last = [...B.last, name].slice(-2);
    lay(name);
    ev.push({ type: 'cue', cue: ATTACKS[name].cue, foe: B.id });
  }
  function endMove() {
    B.move = null; B.mt = 0; B.mk = B.shards.length ? B.mk : null;
    B.state = 'idle';
    B.gap = REEVE.gap[B.phase - 1];
  }
  const hard0 = { hard: [0, 0] };
  // one play step of a move -> the velocity it wants, or { hard } for a drive that brakes and turns at once
  function runMove(ev) {
    const A = ATTACKS[B.move];
    B.mt++;
    const g = segAt(A, B.mt), s = lamp();
    if (!g) { endMove(); return null; }
    switch (B.move) {
      case 'sweep': case 'dsweep': return sweep(A, g, s, ev);
      case 'slam': return slam(A, g, s, ev);
      case 'shards': return shards(A, g, s, ev);
      case 'lunge': return lunge(A, g, s, ev);
    }
    return null;
  }
  /* a sweep: in its wind-up the boss turns toward the lamplighter at 1.5 rad/s at most, and holds its facing for the last 0.3 s; its
     three slices grow to 4.0 m with it and stop with it. The hit tests its active steps until it lands once */
  function sweep(A, g, s, ev) {
    if (g.kind === 'wind') {
      if (g.at === 0 && g.i > 0) ev.push({ type: 'cue', cue: A.cue, foe: B.id });
      if (g.at < g.n - A.hold) turnTo(faceOf(s), A.turn);
      B.mk = { kind: 'slices', x: B.x, y: ground(B.x, B.z, B.y), z: B.z, face: B.yaw, R: A.reach * Math.min(1, (g.at + 1) / g.n), full: A.reach };
      return hard0;
    }
    if (g.kind === 'act') {
      if (g.at === 0) { B.landed = false; ev.push({ type: 'cue', cue: A.hitCue, foe: B.id }); }
      if (B.mk) B.mk.R = A.reach;
      if (!B.landed && B.mk && inSlices(s, B.mk, A.rise)) B.landed = strike(A.dmg, [B.x, B.z], ev);
      if (g.at === g.n - 1) B.mk = null;
      return hard0;
    }
    B.mk = null;
    return hard0;
  }
  // the cage slam: it rears up as a ring grows to 3.4 m at its feet, slams (a stop of 6 steps and a kick), then kneels open for 1.5 s
  function slam(A, g, s, ev) {
    const m = B.mk;
    if (g.kind === 'wind' && m) m.R = A.ring * Math.min(1, (g.at + 1) / g.n);
    else if (g.kind === 'act') {
      if (g.at === 0 && m) {
        m.R = A.ring;
        ev.push({ type: 'burst', kind: 'slam', x: m.x, y: m.y, z: m.z, r: A.ring }, { type: 'stop', n: A.stop }, { type: 'boss', what: 'slam', kick: A.kick }, { type: 'cue', cue: A.hitCue, foe: B.id });
      }
      if (!B.landed && m && inRing(s, m.x, m.y, m.z, A.ring, A.rise)) B.landed = strike(A.dmg, [B.x, B.z], ev);
      if (g.at === g.n - 1) B.mk = null;
    }
    return hard0;
  }
  /* the lamp-shards: three rings of 1.3 m grow over the wind-up, at the lamplighter and 2.5 m to each side, following it for 0.6 s and
     then still. The shards leave the cage at the end of the wind-up and fly 0.6 s, each into its ring */
  function shards(A, g, s, ev) {
    const m = B.mk;
    if (g.kind === 'wind' && m) {
      turnTo(faceOf(s), REEVE.turn);
      if (g.at < A.fix) m.rings = ringsAt(B, s, ground);
      m.R = A.ring0 + (A.ring - A.ring0) * Math.min(1, (g.at + 1) / g.n);
    } else if (g.kind === 'act' && g.at === 0 && m) {
      m.R = A.ring;
      const from = cageOf();
      B.shards = m.rings.map((to, k) => ({ k, from, to: to.slice(), t: 0, n: A.flight }));
      ev.push({ type: 'cue', cue: 'shards', foe: B.id });
    }
    return hard0;
  }
  function flyShards(ev, s) {
    const A = ATTACKS.shards;
    for (const sh of B.shards.slice()) {
      if (++sh.t < sh.n) continue;
      B.shards.splice(B.shards.indexOf(sh), 1);
      if (B.mk?.kind === 'shards') B.mk.done[sh.k] = true;
      ev.push({ type: 'burst', kind: 'shard', x: sh.to[0], y: sh.to[1], z: sh.to[2], r: A.ring }, { type: 'cue', cue: A.hitCue, foe: B.id });
      if (s && inRing(s, sh.to[0], sh.to[1], sh.to[2], A.ring, A.rise)) strike(A.dmg, [sh.to[0], sh.to[2]], ev);
    }
    if (B.mk?.kind === 'shards' && !B.shards.length && B.mk.done.every(Boolean)) B.mk = null;
  }
  // where a shard is in its flight: an arc from the cage to its ring's centre
  B.shardAt = sh => {
    const u = sh.t / sh.n, h = 1.0 + 0.12 * Math.hypot(sh.to[0] - sh.from[0], sh.to[2] - sh.from[2]);
    return [sh.from[0] + (sh.to[0] - sh.from[0]) * u, sh.from[1] + (sh.to[1] + 0.1 - sh.from[1]) * u + h * 4 * u * (1 - u), sh.from[2] + (sh.to[2] - sh.from[2]) * u];
  };
  /* the stalking lunge: a crouch as a lane of 1.6 × 9 m grows toward the lamplighter, following it for 0.4 s; then 13 m/s along the
     lane for 0.69 s. It stops dead at the leash, or where the ground holds it */
  function lunge(A, g, s, ev) {
    const m = B.mk;
    if (g.kind === 'wind' && m) {
      if (g.at < A.fix) { turnTo(faceOf(s), A.turn); Object.assign(m, { x: B.x, y: ground(B.x, B.z, B.y), z: B.z, yaw: B.yaw }); }
      m.len = A.len * Math.min(1, (g.at + 1) / g.n);
      return hard0;
    }
    if (g.kind === 'act' && m) {
      if (g.at === 0) { m.len = A.len; ev.push({ type: 'cue', cue: A.hitCue, foe: B.id }); }
      const ux = Math.sin(m.yaw), uz = Math.cos(m.yaw);
      if (fromCentre(B.x + ux * A.v * STEP, B.z + uz * A.v * STEP) > leash) return stopLunge(A);
      if (!B.landed && inLane(s, m, B.prog, A)) B.landed = strike(A.dmg, [B.x, B.z], ev);
      if (g.at === g.n - 1) { B.mk = null; return hard0; }
      return { hard: [ux * A.v, uz * A.v], lunge: true };
    }
    B.mk = null;
    return hard0;
  }
  function stopLunge(A) {
    B.mk = null;
    B.body.s.vx = B.body.s.vz = 0;
    B.mt = segStart(A, 2) - 1; // on into the recovery
    return hard0;
  }
  // the cage's place in the world, near enough for the shards' start and the light's (the page poses the real bone)
  function cageOf() { return [B.x + Math.sin(B.yaw) * 0.3, B.y + 2.12, B.z + Math.cos(B.yaw) * 0.3]; }

  /* ---------------- the mind: the way back to the centre, the gap, the choice, the walk ---------------- */
  function mind(ev) {
    const s = lamp();
    if (!s || calm()) { B.state = 'idle'; return null; }
    if (!inArena(s)) {
      // the lamplighter has left the arena: back to the centre, and the damage it took stays
      if (fromCentre(B.x, B.z) > 0.3) { B.state = 'home'; turnTo(Math.atan2(c[0] - B.x, c[2] - B.z), REEVE.turn); return towards(c[0], c[2], walkV()); }
      B.state = 'idle';
      turnTo(faceOf(s), REEVE.turn);
      return null;
    }
    B.state = 'idle';
    turnTo(faceOf(s), REEVE.turn);
    const d = Math.hypot(s.x - B.x, s.z - B.z), ang = wrap(faceOf(s) - B.yaw);
    if (B.gap > 0) B.gap--;
    else if (Math.abs(s.y - B.y) < REEVE.reachY) {
      const pick = choose(B.phase, d, ang, B.last, rng);
      if (pick) { startMove(pick, ev); return hard0; }
    }
    if (d <= REEVE.near) return null;
    return towards(...inLeash(s.x + ((B.x - s.x) / d) * REEVE.near, s.z + ((B.z - s.z) / d) * REEVE.near), walkV());
  }
  /* ---------------- the body ----------------
   A play.js body of radius 0.9 with its own PARAMS: it walks at the phase's speed, stands still in its attacks, and drives the lunge
   at 13 m/s with no easing. A lunge that the ground stops (it moves less than 40% of its speed) stops dead */
  function physics(want) {
    const b = B.body, s = b.s, P = b.P, hard = !!want?.hard, v = hard ? want.hard : want || [0, 0], sp = Math.hypot(v[0], v[1]);
    P.run = P.walk = Math.max(sp, 0.01);
    P.accel = P.airAccel = hard ? 400 : 18;
    const x0 = s.x, z0 = s.z;
    b.step(STEP, sp > 1e-3 ? { mz: 1 } : {}, sp > 1e-3 ? yawFor(v[0] / sp, v[1] / sp) : 0);
    P.accel = 18; P.airAccel = PARAMS.airAccel;
    s.yaw = B.yaw;
    B.walking = Math.hypot(s.x - x0, s.z - z0) / STEP;
    B.x = s.x; B.y = s.y; B.z = s.z;
    if (want?.lunge) {
      B.prog = Math.hypot(B.x - B.mk.x, B.z - B.mk.z);
      if (B.walking < 0.4 * sp) stopLunge(ATTACKS.lunge);
    }
  }
  // the lamplighter does not walk through the boss: it is pushed out, as from a heavy foe (not in a roll, and not by the lunge)
  function apart(s) {
    if (!s || !hittable() || R()?.fighter.f.move === 'roll') return;
    if (B.move === 'lunge' && segAt(ATTACKS.lunge, B.mt)?.kind === 'act') return;
    pushOut(s, B.x, B.y, B.z, B.r);
  }

  /* ---------------- hits on the boss ----------------
   No flinch and no push. In a stumble the hits do no damage. In the 1.5 s after the cage slam it is open and takes 50% more. A hit
   that crosses 800 or 350 brings on the next phase with its stumble; one that takes the last health brings the fall. A held boss
   takes the damage and holds its pose. */
  function hitBoss(raw) {
    if (!B.alive || !hittable()) return false;
    B.flashTo = B.game + 1 + REEVE.flash;
    B.shakeTo = B.game + 1 + REEVE.shake;
    B.flash = REEVE.flash; B.shake = REEVE.shake;
    const s = lamp();
    if (s) { const dx = B.x - s.x, dz = B.z - s.z, l = Math.hypot(dx, dz) || 1; B.shakeDir = [dx / l, dz / l]; }
    if (B.state === 'stumble') return 0;
    const g = B.move === 'slam' ? segAt(ATTACKS.slam, B.mt) : null, dmg = dealt(raw, g?.kind === 'rec' ? ATTACKS.slam.open : 1);
    setHp(B.hp - dmg);
    return dmg;
  }
  // the boss's health set at once: the phase of that health, with one stop of 9 steps and one stumble however many thresholds it
  // crossed; at 0 the fall. Before the fight has started there is no stumble
  function setHp(hp) {
    B.hp = clamp(Math.round(hp), 0, REEVE.hp);
    B.pending.push({ type: 'boss', what: 'hp', hp: B.hp });
    if (B.hp <= 0 && B.up) { B.falling = true; B.alive = false; return; }
    const ph = phaseFor(B.hp);
    if (ph !== B.phase) { B.phase = ph; if (B.started && B.up) B.stumbleNext = true; }
  }
  B.setHp = setHp;
  function stumble(ev) {
    B.stumbleNext = false;
    B.move = null; B.mt = 0; B.mk = null; B.shards = []; B.hold = null;
    B.state = 'stumble'; B.t = 0;
    ev.push({ type: 'stop', n: REEVE.stop }, { type: 'boss', what: 'phase', phase: B.phase, kick: REEVE.kick }, { type: 'cue', cue: 'stumble', foe: B.id });
  }
  // the fall: a stop of 9 steps, the fall onto its knees, then its parts; its 30 glim into the glim carried, and the run stored
  function fall(ev) {
    B.falling = false;
    B.state = 'fall'; B.t = 0; B.up = false; B.alive = false; B.move = null; B.mk = null; B.shards = []; B.hold = null;
    B.diedAt = { x: B.x, y: B.y, z: B.z, yaw: B.yaw, step: B.game };
    ev.push({ type: 'stop', n: REEVE.stop }, { type: 'boss', what: 'fall', x: B.x, y: B.y, z: B.z }, { type: 'cue', cue: 'fall', foe: B.id });
    const run = R()?.rs.run;
    if (run) {
      run.carried += BASE.boss;
      run.foes += 1;
      run.bossDown = true;
      ev.push({ type: 'glim', n: BASE.boss }, { type: 'store' });
    }
  }
  function introStart(ev) {
    const s = lamp();
    B.state = 'intro'; B.t = 0;
    place(c[0], c[2], Math.atan2(s.x - c[0], s.z - c[2]));
    ev.push({ type: 'boss', what: 'intro' }, { type: 'cue', cue: 'reeve', foe: B.id });
  }
  function stepLight(ev) {
    const L = B.light, Q = REEVE.light;
    L.t++;
    if (L.state === 'rise' && L.t >= Q.rise) { L.state = 'fly'; L.t = 0; }
    else if (L.state === 'fly' && L.t >= Q.fly) { L.state = 'carried'; L.t = 0; ev.push({ type: 'boss', what: 'light' }, { type: 'cue', cue: 'light' }); }
    else if (L.state === 'beacon' && L.t >= Q.beacon) { L.state = 'gone'; L.t = 0; }
  }

  /* ---------------- each game step ---------------- */
  B.think = (ev, play) => {
    B.game++;
    B.flash = Math.max(0, B.flashTo - B.game); B.shake = Math.max(0, B.shakeTo - B.game);
    if (B.pending.length) { ev.push(...B.pending); B.pending.length = 0; }
    if (B.falling) fall(ev);
    else if (B.stumbleNext) stumble(ev);
    if (!play) return;
    B.step++;
    stepLight(ev);
    const s = lamp();
    // the shards in the air before the boss moves, so a shard thrown this step flies its whole 0.6 s
    if (B.shards.length) flyShards(ev, s);
    let want = null;
    switch (B.state) {
      case 'wait':
        // the intro: the first time in this visit that the lamplighter comes within 11 m, once the boss files are in
        if (B.ready && s && !calm() && fromCentre(s.x, s.z) <= REEVE.arena.intro) introStart(ev);
        break;
      case 'intro':
        if (s) turnTo(faceOf(s), REEVE.turn);
        if (++B.t >= REEVE.intro) { B.state = 'idle'; B.t = 0; B.started = true; B.gap = REEVE.gap[0]; ev.push({ type: 'boss', what: 'start' }, { type: 'cue', cue: 'bossBar' }); }
        break;
      case 'stumble':
        if (++B.t >= REEVE.stumble) { B.state = 'idle'; B.t = 0; B.gap = REEVE.gap[B.phase - 1]; }
        want = hard0;
        break;
      case 'fall':
        if (++B.t >= REEVE.fall) {
          B.state = 'parts'; B.t = 0;
          // the caged light rises out of the broken cage
          Object.assign(B.light, { state: 'rise', t: 0, from: B.lightFrom || [B.x, B.y + 1.6, B.z] });
        }
        break;
      case 'parts': if (++B.t >= REEVE.parts) { B.state = 'down'; B.t = 0; } break;
      case 'move':
        if (B.hold) { B.mt = B.hold.mt; want = hard0; }
        else want = runMove(ev);
        break;
      case 'idle': case 'home': want = mind(ev); break;
    }
    if (['intro', 'idle', 'home', 'move', 'stumble'].includes(B.state)) physics(want);
    B.alive = hittable();
    apart(s);
  };
  B.bind = r => { B.runner = r; return B; };

  /* ---------------- what the run and the page ask ---------------- */
  // the beacon of Barrow Crown lights only with the light carried to it
  B.lightable = () => {
    if (B.up) return { ok: false, why: dark, at: c.slice(), zone: 'arena' };
    if (B.light.state !== 'carried') return { ok: false, why: REEVE_TEXT.notYet };
    return { ok: true };
  };
  // the last beacon takes the light: it flies from the lantern into the fire
  B.toBeacon = at => { if (B.light.state === 'carried') Object.assign(B.light, { state: 'beacon', t: 0, at: at.slice() }); };
  B.shown = shown;
  B.fighting = () => B.started && B.up;
  // what the boss camera and the combat camera read. marks: the far points of the marker laid, 0.3 m over the ground, which the boss
  // camera keeps in sight: the shard rings' centres and four points on each rim at its full size, the lane's far end, the sweeps' two
  // side ends and front at their full reach, and four points round the slam's ring. With the centres alone, the ground hid part of a
  // rim at 254 of 2928 rim points over the arena at 390x844 and 211 at 1280x720 (a ring half over a rise); with the rims, at 44 and 33
  // (gloam-downs-boss.test.mjs)
  const at = (m, a, r) => [m.x + Math.sin(a) * r, m.y + 0.3, m.z + Math.cos(a) * r];
  const rim = (r, a) => { const x = r[0] + Math.sin(a) * ATTACKS.shards.ring, z = r[2] + Math.cos(a) * ATTACKS.shards.ring; return [x, ground(x, z, r[1]) + 0.3, z]; };
  const marksOf = m => !m ? [] : m.kind === 'shards' ? m.rings.flatMap(r => [[r[0], r[1] + 0.3, r[2]], ...[0, 1, 2, 3].map(k => rim(r, (k * Math.PI) / 2))])
    : m.kind === 'lane' ? [at(m, m.yaw, m.full)]
    : m.kind === 'slices' ? [-1, 0, 1].map(k => at(m, m.face + k * SWEEP.arc, m.full * 0.85))
    : m.kind === 'ring' ? [0, 1, 2, 3].map(k => at(m, (k * Math.PI) / 2, m.full * 0.85)) : [];
  // look: the least pitch for the marker laid: the lunge's lane runs straight at the lamplighter and on toward the camera, and seen
  // from the layout's pitch (about 0.3) it shrinks to a strip behind the two figures, so the camera looks down on it from 0.6
  // busy: an attack under way (its marker stands, or its shards fly), which keeps the boss camera on out to 16 m from the centre
  B.camView = () => ({ id: B.id, x: B.x, y: B.y, z: B.z, up: B.up, started: B.started, busy: B.state === 'move' || !!B.mk || B.shards.length > 0,
    marks: marksOf(B.mk), look: B.mk?.kind === 'lane' ? BOSS_LOOK : 0 });
  /* the marker laid, as points on the ground at its full size, 0.1 m up, for the page's fade of the scenery in front of it (veil.js
     makeOccluders): each shard ring's centre and 8 points on its rim, the lane's middle line every 1.5 m and its four corners, the
     sweeps' front slices at 0.5, 0.85 and 1.0 of their reach every 22.5°, and the slam's ring at 0.85 and 1.0 every 45° */
  const flat = (x, z, y) => [x, ground(x, z, y) + 0.1, z];
  B.markPoints = () => {
    const m = B.mk;
    if (!m) return [];
    const out = [];
    if (m.kind === 'shards') for (const r of m.rings) {
      out.push(flat(r[0], r[2], r[1]));
      for (let k = 0; k < 8; k++) out.push(flat(r[0] + Math.sin(k * Math.PI / 4) * m.full, r[2] + Math.cos(k * Math.PI / 4) * m.full, r[1]));
    } else if (m.kind === 'lane') {
      const ux = Math.sin(m.yaw), uz = Math.cos(m.yaw), w = ATTACKS.lunge.width / 2;
      for (let a = 0; a <= m.full + 1e-9; a += Math.min(1.5, m.full)) out.push(flat(m.x + ux * a, m.z + uz * a, m.y));
      for (const a of [0, m.full]) for (const k of [-1, 1]) out.push(flat(m.x + ux * a + uz * w * k, m.z + uz * a - ux * w * k, m.y));
    } else if (m.kind === 'slices') {
      for (const f of [0.5, 0.85, 1]) for (let k = -4; k <= 4; k++) { const a = m.face + k * SWEEP.arc / 4; out.push(flat(m.x + Math.sin(a) * m.full * f, m.z + Math.cos(a) * m.full * f, m.y)); }
    } else if (m.kind === 'ring') {
      for (const f of [0.85, 1]) for (let k = 0; k < 8; k++) out.push(flat(m.x + Math.sin(k * Math.PI / 4) * m.full * f, m.z + Math.cos(k * Math.PI / 4) * m.full * f, m.y));
    }
    return out;
  };
  // the wind-up under way, for an off-screen notch
  B.windups = () => {
    if (B.state !== 'move') return [];
    const g = segAt(ATTACKS[B.move], B.mt);
    return g?.kind === 'wind' ? [{ id: B.id, type: 'B', x: B.x, y: B.y + REEVE.chest, z: B.z, fill: clamp(g.at / g.n, 0, 1) }] : [];
  };
  B.seg = () => (B.move ? segAt(ATTACKS[B.move], B.mt) : null);
  // the ?test view: the state, the phase, the health, the move and its segment, the marker and the light
  B.view = () => {
    const g = B.seg();
    return {
      id: B.id, state: B.state, phase: B.phase, hp: B.hp, max: B.max, started: B.started, up: B.up, ready: B.ready, x: B.x, y: B.y, z: B.z, yaw: B.yaw,
      move: B.move, seg: g ? g.kind : null, t: B.move ? B.mt / 60 : B.t / 60, held: !!B.hold, gap: B.gap, last: B.last.slice(), open: g?.kind === 'rec' && B.move === 'slam',
      marker: B.mk ? JSON.parse(JSON.stringify(B.mk)) : null, shards: B.shards.length, light: { state: B.light.state, t: B.light.t }, flash: B.flash
    };
  };
  /* ?test: keep the boss's pose and place at t s of an attack while the game steps (a held boss does not hit). hold(null) lets it go on
     from there. A hold lays the attack's markers where they would be laid at its start, grown to t */
  B.holdAt = (move, t = 0) => {
    if (move === null || move === undefined) { B.hold = null; return B.id; }
    const A = ATTACKS[move];
    if (!A || !B.started || !B.up) return null;
    if (B.move !== move || B.state !== 'move') { B.state = 'move'; B.move = move; B.landed = false; B.prog = 0; B.shards = []; lay(move); }
    const mt = clamp(Math.round(t * 60), 0, lengthOf(A) - 1), g = segAt(A, mt);
    B.mt = mt;
    if (B.mk && g) {
      const k = Math.min(1, (g.at + 1) / g.n);
      if (B.mk.kind === 'slices') B.mk.R = g.kind === 'wind' ? B.mk.full * k : B.mk.full;
      else if (B.mk.kind === 'ring') B.mk.R = g.kind === 'wind' ? B.mk.full * k : B.mk.full;
      else if (B.mk.kind === 'shards') B.mk.R = g.kind === 'wind' ? A.ring0 + (A.ring - A.ring0) * k : A.ring;
      else if (B.mk.kind === 'lane') B.mk.len = g.kind === 'wind' ? A.len * k : A.len;
    }
    B.hold = { move, mt };
    return B.id;
  };
  return B;
}

/* ---------------- the pose of the boss ----------------
   Which clip and time the page poses the boss with, from its state, and how far it stands under the ground (it rises out of the
   barrow over the first 0.9 s of the intro). time is the game's time in seconds, for the clips that loop */
export function poseOfBoss(B, time = 0) {
  switch (B.state) {
    case 'intro': return { clip: 'intro', t: B.t / 60, dy: -1.8 * (1 - ease(B.t / REEVE.rise)) };
    case 'stumble': return { clip: 'stumble', t: B.t / 60, dy: 0 };
    case 'fall': return { clip: 'fall', t: B.t / 60, dy: 0 };
    case 'move': {
      const g = segAt(ATTACKS[B.move], B.mt);
      return g ? { clip: g.clip, t: g.at / 60, dy: 0 } : { clip: 'rest', t: time, dy: 0 };
    }
    default: return B.walking > 0.3 ? { clip: 'walk', t: time, dy: 0 } : { clip: 'rest', t: time, dy: 0 };
  }
}
