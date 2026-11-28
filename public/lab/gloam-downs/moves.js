// Gloam Downs: the lamplighter's moves in a run, on top of play.js's body and walk map: the blade's string of three hits with its
// lunge and soft aim, the dodge roll, the plunge, the flask, the push of a hit, and the last firm ground for falls. No DOM, so Node
// tests and the bot use it as it is.
// Every time is in play steps of 1/60 s (a time that is not a whole number of steps rounds to the nearest), so a move plays the same
// at any frame rate. A target is anything with { x, y, z, r, alive, hit(raw, how) }: a foe, the boss, or a training post (makePost).
// hit() takes the damage before the target's own factor and rounding, and returns what it took, or false when the blade passes.
import { PARAMS, SWINGS, shownState } from './play.js';
import { bladeHit, bladeNext, bladeHold } from './gear.js';

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
/* Rising cut (an unlock): Attack in the last 0.12 s of a roll or the 0.1 s after it. It plays as the second cut, with 14 damage, and it
   knocks a light foe down for 0.6 s. Its index is 3, after the string; the string goes on with the second cut */
export const RISE = { ...HITS[1], id: 'rise', pose: 'cut2', dmg: 14, knock: S(0.6), stagger: true };
export const hitOf = i => (i === 3 ? RISE : HITS[i]);
// the relics' changes to the blade (relics.js has the rest), and the two moves from unlocks
export const BUILD = {
  rise: { before: S(0.12), after: S(0.1) },
  parry: { steps: S(0.1), arc: 60 * DEG, near: 0.5, far: 4, stagger: S(1.0), stop: 3 },
  hooked: { range: 4, to: 1.2, arc: 60 * DEG },
  bellows: { push: 2.5, knock: S(0.2) },
  echo: { after: S(0.3), share: 0.5 },
  tinder: { steps: S(1.0) }
};
export const MOVES = {
  buffer: S(0.15), chain: S(0.10), reset: S(0.35),
  aim: { range: 4.5, held: 70 * DEG, free: 100 * DEG, turn: 75 * DEG, keep: 0.75, perRad: 2, eye: 1.2, chest: 0.9, short: 0.25, rise: 1.6 },
  roll: { steps: S(0.36), v: 9.0, end: 4.5, safe: [S(0.02), S(0.30)], cool: S(0.25), quick: S(0.12), drop: 3 },
  plunge: { high: 0.8, hang: S(0.08), v: 16, r: 1.6, heavyR: 2.0, dmg: 16, perM: 3, max: 28, heavy: 1.5, push: 1.5, knock: S(0.6), rec: S(0.30), stop: 5, rise: 1.2 },
  drink: { steps: S(0.8), v: 1.5 },
  hurt: { lock: S(0.25), safe: S(1.0), push: 1.2, stop: 5 },
  fall: { below: -25, dmg: 10, firm: 1.0, every: 4 },
  shave: { steps: S(1.0), bonus: 0.5 },
  face: 10,
  // a sure cut (build.js): 1.5 times, after the added bonuses, and 1 step more of hit stop
  sure: { k: 1.5, stop: 1 },
  // Gloam dash (the key): Roll in the air dashes 3.5 m level over 0.15 s, safe all the way, once until the feet land
  dash: { dist: 3.5, steps: S(0.15) }
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
    cool: 0, safe: 0, pushV: 0, shave: 0, top: 0, firm: [s.x, s.y, s.z], firmYaw: s.yaw, firmAge: 0, queue: false, from: null,
    // the builds: the steps since the last roll ended and the play step of the last Attack press (Rising cut), whether the first cut
    // began on its own and not in a string (Ember parry), Tinder guard's time left, and Echo blade's second hits to come
    clock: 0, rollEnd: -Infinity, pressAt: -Infinity, alone: false, tinder: 0, echoes: [],
    // Gloam dash: used until the feet land, and the way of the dash under way
    dashUsed: false
  };
  const holds = (st, k, id) => (st[k] || []).includes(id);
  // the held blade's string (gear.js): its row for hit i, or today's; it is read again at the start of each step
  let held = null;
  const hitAt = i => bladeHit(held, i, hitOf) || hitOf(i);
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
    const h = hitAt(i), dir = heldDir(act, camYaw);
    f.alone = i === 0 && f.move !== 'hit';
    begin('hit'); f.hit = i; f.landed = false; f.buf.attack = 0; f.queue = false;
    const t = aim(targets, dir);
    // the lunge: its full length over the wind-up, or to 0.25 short of the target's edge; none in the air
    let L = s.ground ? h.lunge : 0;
    if (t && L) L = clamp(edge(t) - MOVES.aim.short, 0, L);
    f.lungeV = (L * 60) / h.wind;
    if (s.ground) { s.vx = f.dir[0] * f.lungeV; s.vz = f.dir[1] * f.lungeV; }
    // the swing's sound is keyed to the move: 'swing' is the draw-back over the wind-up (it ends at the strike step), and the
    // 'strike' cue below lays the whoosh that peaks on the first active step, where the hit lands
    ev.push({ type: 'cue', cue: 'swing', hit: h.id, wind: h.wind, act: h.act, strike: SWINGS[h.pose || h.id].strike });
  }
  function startRoll(act, camYaw, ev, cut = false) {
    const dir = heldDir(act, camYaw);
    // the direction is fixed at the start: the stick or keys, or straight back from the facing (the figure keeps facing forward)
    f.dir = dir ? [dir[0], dir[1]] : [-Math.sin(s.yaw), -Math.cos(s.yaw)];
    if (dir) s.yaw = Math.atan2(dir[0], dir[1]);
    f.back = !dir;
    begin('roll'); f.buf.roll = 0; f.queue = false;
    s.vx = f.dir[0] * MOVES.roll.v; s.vz = f.dir[1] * MOVES.roll.v;
    // cut: the roll cancels a wind-up, so the swing's whoosh stops
    ev.push({ type: 'cue', cue: 'roll', ...(cut ? { cut: true } : {}) });
  }
  function startPlunge(ev) {
    begin('hang'); f.buf.attack = 0; f.queue = false; f.top = s.y;
    s.vx = s.vz = s.vy = 0;
    ev.push({ type: 'cue', cue: 'plunge', hang: MOVES.plunge.hang });
  }
  // the blade meets every live target in its reach and arc that it can see, on the first active step that meets any
  // the targets the blade meets from a point and a facing: in its reach and arc, and in sight
  function meets(h, targets, o) {
    const out = [];
    for (const t of targets) {
      if (!t.alive || Math.hypot(t.x - o.x, t.z - o.z) - t.r > h.reach || Math.abs(t.y - o.y) > MOVES.aim.rise) continue;
      if (Math.hypot(t.x - o.x, t.z - o.z) > 1e-6 && Math.abs(wrap(Math.atan2(t.x - o.x, t.z - o.z) - o.yaw)) > h.arc) continue;
      if (!clearLine(walk, o.x, o.y + MOVES.aim.eye, o.z, t.x, t.y + MOVES.aim.chest, t.z)) continue;
      out.push(t);
    }
    return out;
  }
  /* Hooked cut: the first cut pulls one light foe within 4 m of the edge, in front, to 1.2 m in front of the lamplighter (the target
     the soft aim chose, or else the nearest), before the blade meets it */
  function pull(targets) {
    const B = BUILD.hooked, light = t => t.alive && (t.T ? t.T.light : t.light !== false) && t.pull !== false;
    const cand = targets.filter(t => light(t) && edge(t) <= B.range && Math.abs(t.y - s.y) <= MOVES.aim.rise && inArc(t, s.yaw, B.arc) && sees(walk, s, t));
    const t = cand.includes(f.target) ? f.target : cand.sort((a, b) => edge(a) - edge(b))[0];
    if (!t || edge(t) <= B.to) return null;
    const d = B.to + t.r, x = s.x + Math.sin(s.yaw) * d, z = s.z + Math.cos(s.yaw) * d;
    const y = walk.support(x, z, t.y + 1) ?? t.y;
    if (Math.abs(y - t.y) > 1.2) return null;
    if (t.body) { t.body.place([x, y + 0.3, z], t.yaw ?? 0); t.x = t.body.s.x; t.y = t.body.s.y; t.z = t.body.s.z; }
    else { t.x = x; t.z = z; }
    return t;
  }
  function strike(h, targets, ev, raw, st = {}) {
    let any = false, anySure = false;
    const on = [];
    if (h.id === 'cut1' && holds(st, 'relics', 'hooked')) { const t = pull(targets); if (t) ev.push({ type: 'relic', what: 'pull', relic: 'hooked', target: t }); }
    const bellows = h.id === 'cut2' && holds(st, 'relics', 'bellows');
    for (const t of meets(h, targets, { x: s.x, y: s.y, z: s.z, yaw: s.yaw })) {
      const how = { from: [s.x, s.z], push: bellows ? BUILD.bellows.push : h.push, knock: bellows ? BUILD.bellows.knock : h.knock, stagger: !!h.stagger, kind: h.id };
      // Ember glass (run.js paneHit): its 20% adds to the blade's bonuses on a burning foe, and the damage still rounds once
      const more = st.extra ? st.extra(t) : 0;
      // a sure cut (build.js): 1.5 times the hit with its bonuses
      const sure = !!st.sure?.(t, h.id), k = sure ? MOVES.sure.k : 1;
      const dmg = t.hit((more ? raw * (1 + bonusNow(st) + more) / (1 + bonusNow(st)) : raw) * k, how);
      if (dmg === false) continue;
      any = true;
      if (sure) anySure = true;
      on.push(t.type || 'post');
      ev.push({ type: 'hit', kind: h.id, target: t, dmg, ...(sure ? { sure: true } : {}) });
    }
    // the hit's sound: the hit id, the hit stop, and the types of the targets hit (the crunch takes the first one's material); a sure
    // cut holds 1 step longer and rings its own cue over the hit
    const stop = h.stop + (anySure ? MOVES.sure.stop : 0);
    if (any) { f.landed = true; f.shave = 0; ev.push({ type: 'stop', n: stop }, { type: 'cue', cue: 'hit', hit: h.id, on, stop }); }
    if (anySure) ev.push({ type: 'cue', cue: 'sure', hit: h.id });
    // Echo blade: the finisher hits again 0.3 s later, from where it was swung, in the same arc, for half its damage
    if (any && h.id === 'fin' && holds(st, 'relics', 'echo')) f.echoes.push({ n: BUILD.echo.after, h, o: { x: s.x, y: s.y, z: s.z, yaw: s.yaw }, raw: raw * BUILD.echo.share });
  }
  function echoes(targets, ev) {
    for (const e of f.echoes.slice()) {
      if (--e.n > 0) continue;
      f.echoes.splice(f.echoes.indexOf(e), 1);
      let any = false;
      for (const t of meets(e.h, targets, e.o)) {
        const dmg = t.hit(e.raw, { from: [e.o.x, e.o.z], push: 0, knock: 0, kind: 'relic', relic: 'echo' });
        if (dmg === false) continue;
        any = true;
        ev.push({ type: 'hit', kind: 'relic', relic: 'echo', target: t, dmg });
      }
      if (any) ev.push({ type: 'stop', n: 2 }, { type: 'cue', cue: 'hit', hit: 'fin', on: ['relic'], stop: 2, relic: 'echo' });
    }
  }
  const bonusNow = st => (st.bonus || 0) + (f.shave > 0 ? MOVES.shave.bonus : 0);
  // the plunge lands: it meets every target whose edge is within its ring of the landing point
  function land(targets, ev, st) {
    const L = MOVES.plunge, r = st.heavy ? L.heavyR : L.r, fallen = Math.max(0, f.top - s.y);
    const raw = Math.min(L.max, L.dmg + L.perM * Math.max(0, fallen - 1)) * (1 + bonusNow(st)) * (st.heavy ? L.heavy : 1);
    let any = false, anySure = false;
    const on = [];
    for (const t of targets) {
      if (!t.alive || Math.hypot(t.x - s.x, t.z - s.z) - t.r > r || Math.abs(t.y - s.y) > L.rise) continue;
      const sure = !!st.sure?.(t, 'plunge');
      const dmg = t.hit(raw * (sure ? MOVES.sure.k : 1), { from: [s.x, s.z], push: L.push, knock: L.knock, stagger: true, kind: 'plunge' });
      if (dmg === false) continue;
      any = true;
      if (sure) anySure = true;
      on.push(t.type || 'post');
      ev.push({ type: 'hit', kind: 'plunge', target: t, dmg, ...(sure ? { sure: true } : {}) });
    }
    if (anySure) ev.push({ type: 'cue', cue: 'sure', hit: 'plunge' });
    ev.push({ type: 'ring', x: s.x, y: s.y, z: s.z, r }, { type: 'cue', cue: 'land', fallen: +fallen.toFixed(2), on, ...(any ? { stop: L.stop } : {}) });
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
  // the hit after hit i in the string: after the finisher the first cut, after the rising cut the second
  const nextAfter = i => bladeNext(held, i) ?? (i === 3 ? 1 : (i + 1) % 3);
  /* the hit a press of Attack starts when no move plays: Tinder guard's finisher within 1 s of a near miss; Rising cut when the press
     came in the last 0.12 s of a roll or in the 0.1 s after it; else the next hit of the string while it holds, or the first cut */
  function firstHit(st) {
    if (f.tinder > 0 && holds(st, 'relics', 'tinder')) { f.tinder = 0; return 2; }
    const R = BUILD.rise;
    if (s.ground && holds(st, 'unlocks', 'rising') && f.clock - f.rollEnd <= R.after && f.pressAt >= f.rollEnd - R.before) return 3;
    return s.ground && f.since <= MOVES.reset ? f.next : 0;
  }
  function step(act, camYaw, targets, ev) {
    const st = stats();
    held = st.blade || null;
    f.clock++;
    // press edges, kept 0.15 s; a held Attack or Roll goes on as if pressed again. A press of Attack in a hit is kept until the next
    // hit can start (the string's own buffer), so presses as fast as the player likes give the string at its own pace
    if (act.attack && !f.was.attack && f.move === 'hit') f.queue = true;
    if (act.attack && !f.was.attack) f.pressAt = f.clock;
    for (const k of ['attack', 'roll', 'heal']) {
      const h = !!act[k];
      f.buf[k] = h && !f.was[k] ? MOVES.buffer : Math.max(0, f.buf[k] - 1);
      f.was[k] = h;
    }
    const wantAttack = f.buf.attack > 0 || (f.was.attack && !bladeHold(st)) || f.queue, wantRoll = f.buf.roll > 0 || f.was.roll;
    if (f.cool > 0) f.cool--;
    if (f.safe > 0) f.safe--;
    if (f.shave > 0) f.shave--;
    if (f.tinder > 0) f.tinder--;
    f.since++;
    if (f.echoes.length) echoes(targets, ev);
    const canRoll = () => s.ground && f.cool === 0;
    if (s.ground) f.dashUsed = false;
    // Gloam dash: Roll in the air, out of no move (or a cut in the air), once until the feet land
    if (wantRoll && st.dash && !s.ground && !f.dashUsed && f.buf.roll > 0 && (!f.move || f.move === 'hit')) {
      const dir = heldDir(act, camYaw);
      f.dir = dir ? [dir[0], dir[1]] : [Math.sin(s.yaw), Math.cos(s.yaw)];
      if (dir) s.yaw = Math.atan2(dir[0], dir[1]);
      begin('dash'); f.buf.roll = 0; f.queue = false; f.dashUsed = true;
      const v = (MOVES.dash.dist * 60) / MOVES.dash.steps;
      s.vx = f.dir[0] * v; s.vz = f.dir[1] * v; s.vy = 0;
      ev.push({ type: 'cue', cue: 'dash' }, { type: 'dash', x: s.x, y: s.y, z: s.z });
    }
    // a roll cancels a wind-up (the hit is lost), a recovery or a drink, never active time
    if (wantRoll && canRoll()) {
      const h = f.move === 'hit' ? hitAt(f.hit) : null;
      if (!f.move || f.move === 'drink' || (h && (f.t < h.wind || f.t >= h.wind + h.act))) {
        if (h) { f.since = 0; f.next = f.landed ? nextAfter(f.hit) : f.hit === 3 ? 0 : f.hit; }
        startRoll(act, camYaw, ev, !!h && f.t < h.wind);
      }
    }
    // the next hit can start 0.10 s into the recovery of the hit before
    if (f.move === 'hit' && wantAttack) {
      const h = hitAt(f.hit);
      if (f.t >= h.wind + h.act + MOVES.chain) startHit(nextAfter(f.hit), act, camYaw, targets, ev);
    }
    if (!f.move) {
      if (wantAttack) {
        if (!s.ground && s.y - s.floor >= MOVES.plunge.high) startPlunge(ev);
        else startHit(firstHit(st), act, camYaw, targets, ev);
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
        const h = hitAt(f.hit);
        // the lunge runs over the wind-up, and stops dead at its end; a cut in the air falls on as it was falling
        if (!s.ground) glide(camYaw);
        else drive(f.t < h.wind ? f.lungeV : 0, ...f.dir);
        // the phases as cues: 'strike' as the blade leaves the wind-up's top, 'hit' on the step it meets a target, 'whiff' and
        // 'recover' as the active time ends (play.js SWINGS; design.md "The swings")
        // lead: the steps from the strike to the first active step, so the whoosh peaks on the hit's own step
        if (f.t === SWINGS[h.pose || h.id].strike) ev.push({ type: 'cue', cue: 'strike', hit: h.id, lead: h.wind - f.t, act: h.act });
        // Spark third: the finisher's first active step throws a spark ahead (relics.js flies it)
        if (f.t === h.wind && h.id === 'fin' && holds(st, 'relics', 'spark')) ev.push({ type: 'relic', what: 'spark', relic: 'spark', x: s.x, y: s.y, z: s.z, yaw: s.yaw });
        if (f.t >= h.wind && f.t < h.wind + h.act && !f.landed) strike(h, targets, ev, h.dmg * (1 + bonusNow(st)), f.t === h.wind ? st : { ...st, relics: (st.relics || []).filter(r => r !== 'hooked') });
        if (f.t === h.wind + h.act) { if (!f.landed) ev.push({ type: 'cue', cue: 'whiff', hit: h.id }); ev.push({ type: 'cue', cue: 'recover', hit: h.id }); }
        if (++f.t >= h.wind + h.act + h.rec) { f.move = null; f.since = 0; f.next = nextAfter(f.hit); }
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
        // Ember trail: each step of a roll on the ground lays the line of fire (relics.js keeps it)
        if (s.ground && holds(st, 'relics', 'trail')) ev.push({ type: 'relic', what: 'trail', relic: 'trail', x: s.x, y: s.y, z: s.z, first: f.t === 0 });
        if (++f.t >= R.steps || stop) {
          const v = Math.hypot(s.vx, s.vz);
          if (v > R.end) { s.vx *= R.end / v; s.vz *= R.end / v; }
          f.move = null;
          f.rollEnd = f.clock;
          f.cool = st.quick ? R.quick : R.cool;
        }
        break;
      }
      case 'dash': {
        // level: no fall while it lasts, at the speed that covers 3.5 m in 0.15 s (walls stop it)
        s.vy = 0;
        drive((MOVES.dash.dist * 60) / MOVES.dash.steps, ...f.dir, 0);
        s.vy = 0;
        if (++f.t >= MOVES.dash.steps) { f.move = null; const v = Math.hypot(s.vx, s.vz); if (v > MOVES.roll.end) { s.vx *= MOVES.roll.end / v; s.vz *= MOVES.roll.end / v; } }
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
        // Rush glass (build.js): walk and run faster while its haste lasts
        if ((st.haste ?? 1) !== 1) { P.run = KEEP.run * st.haste; P.walk = KEEP.walk * st.haste; body.step(STEP, act, camYaw); Object.assign(P, KEEP); }
        else body.step(STEP, act, camYaw);
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
      const h = hitAt(f.hit), t = f.t;
      const ph = t < h.wind ? 'wind' : t < h.wind + h.act ? 'act' : 'rec';
      const k = ph === 'wind' ? t / h.wind : ph === 'act' ? (t - h.wind) / h.act : (t - h.wind - h.act) / h.rec;
      return { move: h.pose || h.id, ph, k: clamp(k, 0, 1), t, from: f.from };
    }
    // Gloam dash shows the roll's pose, played over its 0.15 s
    if (f.move === 'dash') return { move: 'roll', ph: 'roll', k: clamp(f.t / MOVES.dash.steps, 0, 1), t: f.t, from: f.from, back: false };
    const n = { roll: MOVES.roll.steps, hang: MOVES.plunge.hang, plunge: 30, land: MOVES.plunge.rec, drink: MOVES.drink.steps, hurt: MOVES.hurt.lock }[f.move];
    return { move: f.move, ph: f.move, k: clamp(f.t / n, 0, 1), t: f.t, from: f.from, back: f.move === 'roll' && f.back };
  }
  // the hit lands on the lamplighter: no control for 0.25 s while it is pushed `dist` away from the source (walls stop the push),
  // and safe for 1.0 s. It stops any move; a drink keeps its flask
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
    // Gloam dash: safe all its 0.15 s, and a near miss in it counts as the roll's
    if (f.move === 'dash') return 'roll';
    // Smoke step (abilities.js): safe for 0.3 s, and a near miss in it counts as the roll's
    if (f.smoke > 0) return 'roll';
    return f.safe > 0 ? 'hurt' : null;
  }
  // the hit of the string that a press of Attack starts next (0 cut1, 1 cut2, 2 the finisher): the one after the hit that plays, or
  // after the last one while the string holds (0.35 s on the ground), else the first
  function nextHit() {
    if (f.move === 'hit') return nextAfter(f.hit);
    return s.ground && f.since <= MOVES.reset ? f.next : 0;
  }
  // Ember parry: open in the first 0.1 s of a first cut that began on its own, not in a string
  const parryOpen = () => f.move === 'hit' && f.hit === 0 && f.alone && f.t < BUILD.parry.steps;
  // back on the last firm ground after a fall
  function toFirm() {
    body.place(f.firm, f.firmYaw);
    f.move = null; f.t = 0; f.queue = false;
    s.act = null; s.after = null;
  }
  // Rush glass: the next roll can start at once
  const rush = () => { f.cool = 0; };
  return { f, step, knock, safe, nextHit, toFirm, nearMiss: () => { f.shave = MOVES.shave.steps; }, tinder: () => { f.tinder = BUILD.tinder.steps; }, parryOpen, rush, body, walk,
    // the Bell maul's slam (gear-play.js): it plays the plunge's landing pose where the lamplighter stands
    land: () => { begin('land'); f.queue = false; f.buf.attack = 0; s.vx = s.vz = 0; } };
}
