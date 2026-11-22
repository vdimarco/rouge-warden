// Gloam Downs: the lamplighter's moves in a run, on top of play.js's body and walk map: the blade's string of three hits with its
// lunge and soft aim, the dodge roll, the plunge, the flask, the push of a hit, and the last firm ground for falls. No DOM, so Node
// tests and the bot use it as it is.
// Every time is in play steps of 1/60 s (a time that is not a whole number of steps rounds to the nearest), so a move plays the same
// at any frame rate. A target is anything with { x, y, z, r, alive, hit(raw, how) }: a foe, the boss, or a training post (makePost).
// hit() takes the damage before the target's own factor and rounding, and returns what it took, or false when the blade passes.
import { PARAMS, SWINGS, shownState } from './play.js';

const S = sec => Math.round(sec * 60);
const DEG = Math.PI / 180;
const STEP = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// the camera yaw for which "forward" is the world direction (dx, dz): the renderer's eye sits at +(sin yaw, cos yaw) from the target
export const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
// a copy of a shown state (play.js shownState) that keeps two states back, for the pose's blends; null stays null
export function snap(st, depth = 2) {
  if (!st) return null;
  const c = { ...st };
  if (c.from) c.from = depth > 0 ? snap(c.from, depth - 1) : null;
  if (c.after) c.after = depth > 0 ? { ...c.after, from: snap(c.after.from, depth - 1) } : null;
  return c;
}

// the string: two cuts, then a finisher (design.md "The lamplighter's moves")
export const HITS = [
  { id: 'cut1', wind: S(0.10), act: S(0.08), rec: S(0.24), dmg: 10, reach: 1.8, arc: 45 * DEG, lunge: 0.45, push: 0.4, knock: 0, stop: 3 },
  { id: 'cut2', wind: S(0.10), act: S(0.08), rec: S(0.26), dmg: 11, reach: 1.8, arc: 50 * DEG, lunge: 0.45, push: 0.4, knock: 0, stop: 3 },
  { id: 'fin', wind: S(0.20), act: S(0.10), rec: S(0.40), dmg: 22, reach: 2.1, arc: 70 * DEG, lunge: 0.8, push: 1.2, knock: S(0.6), stop: 5, stagger: true }
];
export const MOVES = {
  buffer: S(0.15), chain: S(0.10), reset: S(0.35),
  aim: { range: 4.5, held: 70 * DEG, free: 100 * DEG, turn: 75 * DEG, keep: 0.75, perRad: 2, eye: 1.2, chest: 0.9, short: 0.25, rise: 1.6 },
  roll: { steps: S(0.36), v: 9.0, end: 4.5, safe: [S(0.02), S(0.30)], cool: S(0.25), quick: S(0.12), drop: 3 },
  plunge: { high: 0.8, hang: S(0.08), v: 16, r: 1.6, heavyR: 2.0, dmg: 16, perM: 3, max: 28, heavy: 1.5, push: 1.5, knock: S(0.6), rec: S(0.30), stop: 5, rise: 1.2 },
  drink: { steps: S(0.8), v: 1.5 },
  hurt: { lock: S(0.25), safe: S(0.9), push: 1.2, stop: 5 },
  fall: { below: -25, dmg: 10, firm: 1.0, every: 4 },
  shave: { steps: S(1.0), bonus: 0.5 },
  face: 10
};

/* ---------------- the sight test ----------------
   The line from a to b is clear when every point on it, 0.25 apart, is out of the walk map's solids: above the floor under it, and,
   where the map has a gap, below the gap's underside. walk.support() says both: it is null inside a solid (in a wall, in a roof between
   its underside and its top, or under the floor) */
export function clearLine(walk, ax, ay, az, bx, by, bz, gap = 0.25) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / gap));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (walk.support(ax + (bx - ax) * t, az + (bz - az) * t, ay + (by - ay) * t) === null) return false;
  }
  return true;
}
// can the lamplighter at s see a target: from its eye, 1.2 up, to the target's chest, 0.9 up
export const sees = (walk, s, t) => clearLine(walk, s.x, s.y + MOVES.aim.eye, s.z, t.x, t.y + MOVES.aim.chest, t.z);

// damage and heals round to the nearest whole number once, at the end (a little over, so 10 × 1.15 is 12 and not 11.499…)
export const dealt = (raw, factor = 1) => Math.round(raw * factor + 1e-9);
// the nearest live target within `range` of the lamplighter's centre (R, Look and RB), or null
export function nearest(targets, s, range = MOVES.face) {
  let best = null, bd = range;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - s.x, t.z - s.z);
    if (d <= bd) { best = t; bd = d; }
  }
  return best;
}
// the camera yaw that looks from behind the lamplighter toward a point
export const faceYaw = (s, p) => yawFor(p.x - s.x, p.z - s.z);

/* ---------------- a training post ----------------
   A stand-in target that never moves, for tests and ?test: it records each hit it takes. factor is its own damage factor (the
   Ironback's stun gives 1.5) */
export function makePost(walk, x, z, o = {}) {
  const y = walk.support(x, z, (o.y ?? walk.top(x, z)) + 1) ?? walk.top(x, z);
  const post = {
    id: o.id ?? 'post', type: 'post', x, y, z, r: o.r ?? 0.4, alive: true, light: o.light !== false, factor: o.factor ?? 1,
    hp: o.hp ?? Infinity, taken: 0, hits: [],
    hit(raw, how) {
      if (!post.alive) return false;
      const dmg = dealt(raw, post.factor);
      post.taken += dmg;
      post.hits.push({ dmg, ...how });
      if (post.taken >= post.hp) post.alive = false;
      return dmg;
    }
  };
  return post;
}

/* ---------------- the fighter ----------------
   The lamplighter's move state on top of a play.js body made with its own copy of PARAMS: a move drives the body through that copy
   (run = walk = the move's speed, accel 400, turnRate 0), so walls, slopes and ledges still hold it, and puts the copy back after.
   step(act, camYaw, targets, ev) runs one play step: act holds the held inputs (mx, mz, slow, jump, attack, roll, heal), and the step
   leaves what happened in ev: { type: 'hit' | 'stop' | 'cue' | 'drink' | 'toast' | 'ring', ... }.
   stats() gives what the run adds: { bonus, heavy, quick, shave, drink: 'ok' | 'empty' | 'full' } */
export function makeFighter(body, walk, { stats = () => ({}) } = {}) {
  if (body.P === PARAMS) throw new Error('a fighter needs a body made with its own copy of PARAMS');
  const s = body.s, P = body.P, KEEP = { run: P.run, walk: P.walk, accel: P.accel, airAccel: P.airAccel, turnRate: P.turnRate, gravity: P.gravity };
  const climb = P.stepUp + P.slope * P.radius;
  const f = {
    move: null, t: 0, hit: 0, next: 0, since: Infinity, landed: false, target: null, dir: [0, 1], lungeV: 0,
    buf: { attack: 0, roll: 0, heal: 0 }, was: { attack: false, roll: false, heal: false },
    cool: 0, safe: 0, pushV: 0, shave: 0, top: 0, firm: [s.x, s.y, s.z], firmYaw: s.yaw, firmAge: 0, queue: false, from: null
  };
  s.after = null;
  // move the body one step at speed v along (ux, uz), with no stick, no turn and (for the plunge) its own gravity
  function drive(v, ux, uz, gravity = KEEP.gravity) {
    P.run = P.walk = v; P.accel = P.airAccel = 400; P.turnRate = 0; P.gravity = gravity;
    body.step(STEP, { mz: v > 0 ? 1 : 0 }, yawFor(ux, uz));
    Object.assign(P, KEEP);
  }
  // in the air with no stick and no turn: the body falls on and its air braking holds
  function glide(camYaw) {
    P.turnRate = 0;
    body.step(STEP, {}, camYaw);
    Object.assign(P, KEEP);
  }
  // the stick or keys as a world direction, or null when nothing is held
  function heldDir(act, camYaw) {
    let mx = clamp(act.mx || 0, -1, 1), mz = clamp(act.mz || 0, -1, 1);
    const m = Math.hypot(mx, mz);
    if (m < 0.2) return null;
    mx /= m; mz /= m;
    const wx = Math.cos(camYaw) * mx - Math.sin(camYaw) * mz, wz = -Math.sin(camYaw) * mx - Math.cos(camYaw) * mz;
    return [wx, wz, Math.min(1, m)];
  }
  const inArc = (t, yaw, arc) => Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - yaw)) <= arc;
  const edge = t => Math.hypot(t.x - s.x, t.z - s.z) - t.r;
  /* soft aim at the start of a hit: the candidates within 4.5 of the edge, inside 70° of the held direction (100° of the facing with
     none), that the lamplighter can see. Score: the distance plus 2 per radian of turn. The target kept stays while its score is
     within 0.75 of the best. The lamplighter turns up to 75° toward the one chosen */
  function aim(targets, dir) {
    const A = MOVES.aim, base = dir ? Math.atan2(dir[0], dir[1]) : s.yaw, win = dir ? A.held : A.free;
    let best = null, bestScore = Infinity, keepScore = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const e = edge(t), turn = Math.abs(wrap(Math.atan2(t.x - s.x, t.z - s.z) - base));
      if (e > A.range || turn > win || Math.abs(t.y - s.y) > A.rise * 2 || !sees(walk, s, t)) continue;
      const score = Math.max(0, e) + A.perRad * turn;
      if (score < bestScore) { best = t; bestScore = score; }
      if (t === f.target) keepScore = score;
    }
    f.target = f.target && keepScore <= bestScore + A.keep ? f.target : best;
    let yaw = base;
    if (f.target) yaw = base + clamp(wrap(Math.atan2(f.target.x - s.x, f.target.z - s.z) - base), -A.turn, A.turn);
    s.yaw = yaw;
    f.dir = [Math.sin(yaw), Math.cos(yaw)];
    return f.target;
  }
  // a move begins from what the pose shows now, so the pose eases from it (play.js BLEND)
  function begin(move) { f.from = snap(shownState(s)); f.move = move; f.t = 0; }
  function startHit(i, act, camYaw, targets, ev) {
    const h = HITS[i], dir = heldDir(act, camYaw);
    begin('hit'); f.hit = i; f.landed = false; f.buf.attack = 0; f.queue = false;
    const t = aim(targets, dir);
    // the lunge: its full length over the wind-up, or to 0.25 short of the target's edge; none in the air
    let L = s.ground ? h.lunge : 0;
    if (t && L) L = clamp(edge(t) - MOVES.aim.short, 0, L);
    f.lungeV = (L * 60) / h.wind;
    if (s.ground) { s.vx = f.dir[0] * f.lungeV; s.vz = f.dir[1] * f.lungeV; }
    ev.push({ type: 'cue', cue: 'swing', hit: h.id });
  }
  function startRoll(act, camYaw, ev) {
    const dir = heldDir(act, camYaw);
    // the direction is fixed at the start: the stick or keys, or straight back from the facing (the figure keeps facing forward)
    f.dir = dir ? [dir[0], dir[1]] : [-Math.sin(s.yaw), -Math.cos(s.yaw)];
    if (dir) s.yaw = Math.atan2(dir[0], dir[1]);
    f.back = !dir;
    begin('roll'); f.buf.roll = 0; f.queue = false;
    s.vx = f.dir[0] * MOVES.roll.v; s.vz = f.dir[1] * MOVES.roll.v;
    ev.push({ type: 'cue', cue: 'roll' });
  }
  function startPlunge(ev) {
    begin('hang'); f.buf.attack = 0; f.queue = false; f.top = s.y;
    s.vx = s.vz = s.vy = 0;
    ev.push({ type: 'cue', cue: 'plunge' });
  }
  // the blade meets every live target in its reach and arc that it can see, on the first active step that meets any
  function strike(h, targets, ev, raw) {
    let any = false;
    for (const t of targets) {
      if (!t.alive || edge(t) > h.reach || Math.abs(t.y - s.y) > MOVES.aim.rise) continue;
      if (Math.hypot(t.x - s.x, t.z - s.z) > 1e-6 && !inArc(t, s.yaw, h.arc)) continue;
      if (!sees(walk, s, t)) continue;
      const dmg = t.hit(raw, { from: [s.x, s.z], push: h.push, knock: h.knock, stagger: !!h.stagger, kind: h.id });
      if (dmg === false) continue;
      any = true;
      ev.push({ type: 'hit', kind: h.id, target: t, dmg });
    }
    if (any) { f.landed = true; f.shave = 0; ev.push({ type: 'stop', n: h.stop }, { type: 'cue', cue: 'hit', hit: h.id }); }
  }
  const bonusNow = st => (st.bonus || 0) + (f.shave > 0 ? MOVES.shave.bonus : 0);
  // the plunge lands: it meets every target whose edge is within its ring of the landing point
  function land(targets, ev, st) {
    const L = MOVES.plunge, r = st.heavy ? L.heavyR : L.r, fallen = Math.max(0, f.top - s.y);
    const raw = Math.min(L.max, L.dmg + L.perM * Math.max(0, fallen - 1)) * (1 + bonusNow(st)) * (st.heavy ? L.heavy : 1);
    let any = false;
    for (const t of targets) {
      if (!t.alive || Math.hypot(t.x - s.x, t.z - s.z) - t.r > r || Math.abs(t.y - s.y) > L.rise) continue;
      const dmg = t.hit(raw, { from: [s.x, s.z], push: L.push, knock: L.knock, stagger: true, kind: 'plunge' });
      if (dmg === false) continue;
      any = true;
      ev.push({ type: 'hit', kind: 'plunge', target: t, dmg });
    }
    ev.push({ type: 'ring', x: s.x, y: s.y, z: s.z, r }, { type: 'cue', cue: 'land' });
    if (any) { f.shave = 0; ev.push({ type: 'stop', n: L.stop }); }
  }
  // the last firm ground: where the feet stand at least 1 m from a ledge (a drop of more than stepDown; a wall is no ledge)
  function firm() {
    // feet placed below the fall line (place() calls them on the ground) are a fall, never firm ground
    if (s.y < MOVES.fall.below) return false;
    const R = MOVES.fall.firm;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      for (const r of [R * 0.5, R]) if (walk.floorAt(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, s.y + climb, s.y) < s.y - P.stepDown) return false;
    }
    return true;
  }
  function step(act, camYaw, targets, ev) {
    const st = stats();
    // press edges, kept 0.15 s; a held Attack or Roll goes on as if pressed again. A press of Attack in a hit is kept until the next
    // hit can start (the string's own buffer), so presses as fast as the player likes give the string at its own pace
    if (act.attack && !f.was.attack && f.move === 'hit') f.queue = true;
    for (const k of ['attack', 'roll', 'heal']) {
      const h = !!act[k];
      f.buf[k] = h && !f.was[k] ? MOVES.buffer : Math.max(0, f.buf[k] - 1);
      f.was[k] = h;
    }
    const wantAttack = f.buf.attack > 0 || f.was.attack || f.queue, wantRoll = f.buf.roll > 0 || f.was.roll;
    if (f.cool > 0) f.cool--;
    if (f.safe > 0) f.safe--;
    if (f.shave > 0) f.shave--;
    f.since++;
    const canRoll = () => s.ground && f.cool === 0;
    // a roll cancels a wind-up (the hit is lost), a recovery or a drink, never active time
    if (wantRoll && canRoll()) {
      const h = f.move === 'hit' ? HITS[f.hit] : null;
      if (!f.move || f.move === 'drink' || (h && (f.t < h.wind || f.t >= h.wind + h.act))) {
        if (h) { f.since = 0; f.next = f.landed ? (f.hit + 1) % 3 : f.hit; }
        startRoll(act, camYaw, ev);
      }
    }
    // the next hit can start 0.10 s into the recovery of the hit before
    if (f.move === 'hit' && wantAttack) {
      const h = HITS[f.hit];
      if (f.t >= h.wind + h.act + MOVES.chain) startHit((f.hit + 1) % 3, act, camYaw, targets, ev);
    }
    if (!f.move) {
      if (wantAttack) {
        if (!s.ground && s.y - s.floor >= MOVES.plunge.high) startPlunge(ev);
        else startHit(s.ground && f.since <= MOVES.reset ? f.next : 0, act, camYaw, targets, ev);
      } else if (f.buf.heal > 0) {
        f.buf.heal = 0;
        const can = st.drink ?? 'ok';
        if (can === 'ok' && s.ground) { begin('drink'); ev.push({ type: 'cue', cue: 'drink' }); }
        else if (can !== 'ok') ev.push({ type: 'toast', what: can });
      }
    }
    const moving = !!f.move;
    switch (f.move) {
      case 'hit': {
        const h = HITS[f.hit];
        // the lunge runs over the wind-up, and stops dead at its end; a cut in the air falls on as it was falling
        if (!s.ground) glide(camYaw);
        else drive(f.t < h.wind ? f.lungeV : 0, ...f.dir);
        // the phases as cues: 'strike' as the blade leaves the wind-up's top, 'hit' on the step it meets a target, 'whiff' and
        // 'recover' as the active time ends (play.js SWINGS; design.md "The swings")
        if (f.t === SWINGS[h.id].strike) ev.push({ type: 'cue', cue: 'strike', hit: h.id });
        if (f.t >= h.wind && f.t < h.wind + h.act && !f.landed) strike(h, targets, ev, h.dmg * (1 + bonusNow(st)));
        if (f.t === h.wind + h.act) { if (!f.landed) ev.push({ type: 'cue', cue: 'whiff', hit: h.id }); ev.push({ type: 'cue', cue: 'recover', hit: h.id }); }
        if (++f.t >= h.wind + h.act + h.rec) { f.move = null; f.since = 0; f.next = (f.hit + 1) % 3; }
        break;
      }
      case 'roll': {
        const R = MOVES.roll, dir = heldDir(act, camYaw);
        // the ledge guard: a drop of more than 3 m just ahead stops the roll at its edge, unless the stick pushes over it
        let stop = false;
        if (s.ground && !(dir && dir[2] > 0.3 && dir[0] * f.dir[0] + dir[1] * f.dir[1] > 0.5))
          for (const a of [0.15, 0.3]) if (walk.floorAt(s.x + f.dir[0] * a, s.z + f.dir[1] * a, s.y + climb, s.y) < s.y - R.drop) { stop = true; break; }
        if (stop) { s.vx = s.vz = 0; drive(0, ...f.dir); }
        else drive(R.v, ...f.dir);
        if (++f.t >= R.steps || stop) {
          const v = Math.hypot(s.vx, s.vz);
          if (v > R.end) { s.vx *= R.end / v; s.vz *= R.end / v; }
          f.move = null;
          f.cool = st.quick ? R.quick : R.cool;
        }
        break;
      }
      case 'hang':
        s.vy = 0;
        drive(0, ...f.dir, 0);
        if (++f.t >= MOVES.plunge.hang) { begin('plunge'); ev.push({ type: 'cue', cue: 'drop' }); }
        break;
      case 'plunge':
        s.vy = -MOVES.plunge.v;
        drive(0, ...f.dir, 0);
        f.t++;
        if (s.ground) { land(targets, ev, st); begin('land'); }
        break;
      case 'land':
        drive(0, ...f.dir);
        if (++f.t >= MOVES.plunge.rec) f.move = null;
        break;
      case 'drink':
        P.run = P.walk = MOVES.drink.v;
        body.step(STEP, { mx: act.mx, mz: act.mz, slow: true }, camYaw);
        Object.assign(P, KEEP);
        if (++f.t >= MOVES.drink.steps) { f.move = null; ev.push({ type: 'drink' }, { type: 'cue', cue: 'heal' }); }
        break;
      case 'hurt':
        drive(f.pushV, ...f.dir);
        if (++f.t >= MOVES.hurt.lock) { s.vx = s.vz = 0; f.move = null; }
        break;
      default:
        body.step(STEP, act, camYaw);
    }
    // a move holds the jump: a press in it is not kept, and a jump held through it does not fire after
    if (moving) { s.held = !!act.jump; s.buf = 0; }
    if (s.ground && !f.move && ++f.firmAge >= MOVES.fall.every) {
      f.firmAge = 0;
      if (firm()) { f.firm = [s.x, s.y, s.z]; f.firmYaw = s.yaw; }
    }
    const was = s.act;
    s.act = pose();
    // the steps since a move ended, while the walk eases back from it
    if (s.act) s.after = null;
    else if (was) s.after = { from: snap(was), t: 1 };
    else if (s.after && ++s.after.t > 24) s.after = null;
    return ev;
  }
  // what the pose reads: the move, its phase and how far through it (0..1)
  function pose() {
    if (!f.move) return null;
    if (f.move === 'hit') {
      const h = HITS[f.hit], t = f.t;
      const ph = t < h.wind ? 'wind' : t < h.wind + h.act ? 'act' : 'rec';
      const k = ph === 'wind' ? t / h.wind : ph === 'act' ? (t - h.wind) / h.act : (t - h.wind - h.act) / h.rec;
      return { move: h.id, ph, k: clamp(k, 0, 1), t, from: f.from };
    }
    const n = { roll: MOVES.roll.steps, hang: MOVES.plunge.hang, plunge: 30, land: MOVES.plunge.rec, drink: MOVES.drink.steps, hurt: MOVES.hurt.lock }[f.move];
    return { move: f.move, ph: f.move, k: clamp(f.t / n, 0, 1), t: f.t, from: f.from, back: f.move === 'roll' && f.back };
  }
  // the hit lands on the lamplighter: no control for 0.25 s while it is pushed `dist` away from the source (walls stop the push),
  // and safe for 0.9 s. It stops any move; a drink keeps its flask
  function knock(from, dist = MOVES.hurt.push) {
    const dx = s.x - from[0], dz = s.z - from[1], l = Math.hypot(dx, dz);
    f.dir = l > 1e-6 ? [dx / l, dz / l] : [-Math.sin(s.yaw), -Math.cos(s.yaw)];
    f.pushV = (dist * 60) / MOVES.hurt.lock;
    begin('hurt');
    f.queue = false;
    f.safe = MOVES.hurt.safe;
    s.vx = s.vz = 0;
    s.act = pose();
    s.after = null;
  }
  // 'roll' in the roll's safe time, 'hurt' in the safe time after a hit, else null
  function safe() {
    const [a, b] = MOVES.roll.safe;
    if (f.move === 'roll' && f.t >= a && f.t <= b) return 'roll';
    return f.safe > 0 ? 'hurt' : null;
  }
  // the hit of the string that a press of Attack starts next (0 cut1, 1 cut2, 2 the finisher): the one after the hit that plays, or
  // after the last one while the string holds (0.35 s on the ground), else the first
  function nextHit() {
    if (f.move === 'hit') return (f.hit + 1) % 3;
    return s.ground && f.since <= MOVES.reset ? f.next : 0;
  }
  // back on the last firm ground after a fall
  function toFirm() {
    body.place(f.firm, f.firmYaw);
    f.move = null; f.t = 0; f.queue = false;
    s.act = null; s.after = null;
  }
  return { f, step, knock, safe, nextHit, toFirm, nearMiss: () => { f.shave = MOVES.shave.steps; }, body, walk };
}
