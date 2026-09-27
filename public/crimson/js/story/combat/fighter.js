// js/story/combat/fighter.js : one fighter of the story (the hero, a driver, a guard, a boss). The arena's
// boss logic in game.js (updateBoss, startBossAttack, hitShapeHits, breakPosture, endBossAttack,
// updateCharge) ported to work on any fighter passed in, so many enemies can fight at once. The tables
// stay in js/moves.js and foes.js; timing always comes from the tables, never from the body (D2).
import * as THREE from 'three';
import { TUNE } from '../../moves.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

let seq = 0;
// A Fighter: the contract fields (id, a, pos, face, hp, maxHp, posture, state, team, def, group, alert,
// tied, downed, nextHit) and the state the ported logic needs.
export function makeFighter(o) {
  const f = {
    id: o.id || `fighter${++seq}`, a: o.a || null, pos: new THREE.Vector3(), face: o.face || 0, yaw: o.face || 0,
    hp: o.hp ?? 100, maxHp: o.hp ?? 100, posture: 0, maxPosture: o.posture ?? 100, state: 'idle', team: o.team || 'foe',
    def: o.def || { id: 'driver' }, group: o.group || 'main', alert: o.alert ?? true, tied: false, downed: false, nextHit: null,
    name: o.name || '', kanji: o.kanji || '', boss: !!o.boss, radius: o.radius ?? 0.5, phase: 1,
    t: 0, atk: null, clipT: 0, hitsDone: new Set(), snd: new Set(), told: false, impacted: false, charged: false,
    queue: [], last: '', lastLast: '', cooldown: 1, strafe: 1, strafeT: 0, speedNow: 0, flinch: 0, air: 0,
    leapFrom: new THREE.Vector3(), leapTo: new THREE.Vector3(), postureT: 0, dodging: false, glow: 0,
    token: false, idleT: 0, ring: 0, ringR: 4.5, stunT: 0, downT: 0, vel: new THREE.Vector3(), moved: 0,
  };
  if (o.pos) f.pos.set(o.pos.x, o.pos.y ?? 0, o.pos.z);
  return f;
}

// the clip time of a fighter's current move, in seconds of the source clip (the arena's spec.from + actor.t)
export const clipTime = (f, spec) => (spec.from || 0) + (f.a ? f.a.t : 0);

// a hit shape (reach and arc, or an area of effect) from att against target (hitShapeHits, per entity)
export function hitShapeHits(att, target, shape) {
  if (!shape) return false;
  if (shape.aoe) {
    const cx = att.pos.x + Math.sin(att.face) * shape.aoe[0], cz = att.pos.z + Math.cos(att.face) * shape.aoe[0];
    return Math.hypot(target.pos.x - cx, target.pos.z - cz) <= shape.aoe[1] + 0.35;
  }
  return flatDist(att.pos, target.pos) <= shape.reach + (target.radius ?? 0.4) + 0.35 && Math.abs(angDiff(att.face, angleTo(att.pos, target.pos))) <= shape.arc;
}

// start a move from a table (startBossAttack, per entity). The body plays the move's clip; its hits,
// tells and lunges are read from the table against the clip time.
export function startAttack(K, f, name, spec) {
  f.state = 'attack'; f.t = 0; f.atk = { name, spec }; f.hitsDone = new Set(); f.snd = new Set();
  f.told = false; f.impacted = false; f.charged = false; f.air = 0; f.dashed = 0;
  f.leapFrom.copy(f.pos); f.idleT = 0;
  const speed = (spec.speed || 1) * TUNE.atkSpeed * (f.speedK || 1);
  if (spec.unblock) K.danger(f);
  if (spec.charge) { if (f.a) f.a.play(spec.windClip || 'bear:roar', { loop: false, speed: 1.6, fade: 0.15, at: spec.windAt ?? 1.0, restart: true }); K.sfx(spec.windSnd || 'growl', f.pos); }
  else if (f.a && spec.clip) f.a.play(spec.clip, { loop: false, speed, fade: 0.12, restart: true, at: spec.at || 0 });
}
// back to idle, or on to the next move in the queue (endBossAttack)
export function endAttack(K, f, stagger) {
  if (f.queue.length && !K.heroDown()) { const n = f.queue.shift(); startAttack(K, f, n, f.moves[n]); return; }
  f.state = 'idle'; f.t = 0; f.atk = null; f.air = 0;
  const r = f.rest || TUNE.rest;
  f.cooldown = K.arand(r[0], r[1]) + (stagger ? 0.6 : 0);
  f.lastAtk = K.S.time;
}
// posture broken: open for a deathblow or a TAKEDOWN (breakPosture)
export function breakPosture(K, f) {
  f.state = 'broken'; f.t = 0; f.atk = null; f.queue = []; f.air = 0;
  if (f.a) f.a.play('gabe:hit', { loop: false, speed: 0.5, fade: 0.1, restart: true });
  K.sfx('broken', f.pos);
  K.S.hitstop = Math.max(K.S.hitstop, 0.14); K.flash(0.25); K.cam.punch = Math.max(K.cam.punch, 0.8);
  K.toast(f.boss ? 'POSTURE BROKEN. STRIKE.' : 'POSTURE BROKEN', true);
  K.emit('broken', f);
}
// posture drains back when the fighter is left alone (the arena rule, scaled to each posture bar)
export function decayPosture(f, dt) {
  f.postureT += dt;
  if (f.state !== 'broken' && f.postureT > 1.4) f.posture = Math.max(0, f.posture - dt * 11 * (f.maxPosture / 100) * (0.35 + 0.65 * f.hp / f.maxHp));
}
// turn toward a heading at a limited rate (bossTurn)
export function turn(f, target, rate, dt) { f.face += clamp(angDiff(f.face, target), -rate * dt, rate * dt); }

// Step a fighter's current move: tracking, tells, lunges, leaps, impacts and hit windows (the 'attack'
// case of updateBoss). onHit(f, i) is called once per hit window that lands. Returns the forward speed the
// move asks for this tick (lunges).
export function stepAttack(K, f, dt, target, onHit) {
  const a = f.atk, s = a.spec;
  let move = 0;
  const toT = angleTo(f.pos, target.pos), dist = flatDist(f.pos, target.pos) - f.radius;
  const ct = clipTime(f, s); f.clipT = ct;
  if (s.track && ct < s.track) turn(f, toT, f.trackRate || 6, dt);
  if (s.tell != null && !f.told && ct >= s.tell) { f.told = true; K.sfx(s.tellSnd || 'glint', f.pos); if (s.onTell) s.onTell(K, f); }
  f.nextHit = null;
  for (let i = 0; i < s.hits.length; i++) if (!f.hitsDone.has(i) && ct < s.hits[i][1]) { f.nextHit = s.hits[i][0]; break; }
  f.dodging = !!(s.dodge && ct >= s.dodge[0] && ct <= s.dodge[1]);
  if (s.lunges) for (const l of s.lunges) if (ct >= l[0] && ct <= l[1] && dist > 1.3) move = l[2];
  if (s.leap) {
    const [t0, t1] = s.leap, maxD = s.leapMax || 8;
    if (ct < t0) {
      // land just short of the target, never farther than the move allows
      const d = Math.min(maxD, Math.max(0, flatDist(f.pos, target.pos) - 1.4));
      f.leapTo.set(f.pos.x + Math.sin(toT) * d, f.pos.y, f.pos.z + Math.cos(toT) * d);
      f.leapFrom.copy(f.pos);
    }
    if (ct >= t0 && ct <= t1) { const k = (ct - t0) / (t1 - t0); f.pos.lerpVectors(f.leapFrom, f.leapTo, k * k * (3 - 2 * k)); f.air = Math.sin(k * Math.PI) * (s.leapH ?? 1.4); }
    else f.air = 0;
  }
  if (s.impact && !f.impacted && ct >= s.impact) { f.impacted = true; K.impact(f, s); }
  for (let i = 0; i < s.hits.length; i++) {
    if (f.hitsDone.has(i)) continue;
    const [t0, t1, shape] = s.hits[i];
    if (ct >= t0 - 0.12 && !f.snd.has(i)) { f.snd.add(i); K.sfx(s.snd || 'bossSwing', f.pos); }
    if (ct >= t0 && ct <= t1 && target.state !== 'dead' && target.state !== 'grabbed' && target.state !== 'downed' && hitShapeHits(f, target, shape)) { f.hitsDone.add(i); onHit(f, i); if (f.state !== 'attack') return 0; }
    else if (ct > t1) f.hitsDone.add(i);
  }
  // the move is over at the end of its cut (or at its own end time, for a move cut from a longer clip)
  if (f.state === 'attack' && ((f.a ? f.a.done : f.t > 3) || (s.end != null && ct >= s.end))) endAttack(K, f);
  return move;
}

// the bear's charge (updateCharge), with a maximum distance and a stop at anything solid in the way
export function stepCharge(K, f, dt, target, onHit) {
  const s = f.atk.spec, toT = angleTo(f.pos, target.pos);
  f.nextHit = null;
  if (f.t < s.windup) { turn(f, toT, 3, dt); return; }
  if (!f.charged) { f.charged = true; if (f.a) f.a.play(s.runClip || 'bear:charge', { speed: 1.3, fade: 0.1 }); K.sfx(s.runSnd || 'roar', f.pos); f.dashed = 0; }
  const k = f.t - s.windup;
  f.face += clamp(angDiff(f.face, toT), -(s.steer ?? 0.9) * dt, (s.steer ?? 0.9) * dt);
  const v = (s.speed || TUNE.chargeSpeed) * dt;
  const px = f.pos.x, pz = f.pos.z;
  f.pos.x += Math.sin(f.face) * v; f.pos.z += Math.cos(f.face) * v;
  const blocked = K.solid(f);
  f.dashed += Math.hypot(f.pos.x - px, f.pos.z - pz);
  f.nextHit = 0; f.clipT = 0;
  if (Math.random() < 0.6) K.dust(f.pos, 1, 0.6);
  if (!f.hitsDone.has(0) && flatDist(f.pos, target.pos) < f.radius + 0.8 && target.state !== 'dead' && target.state !== 'downed') { f.hitsDone.add(0); onHit(f, 0); }
  const maxD = s.maxDist ?? 12;
  if (k > s.run || blocked || f.dashed >= maxD) {
    if (blocked) { K.cam.shake = Math.max(K.cam.shake, 0.8); K.sfx('slam', f.pos); K.dust(f.pos, 16, 1.6); }
    endAttack(K, f, true);
  }
}
