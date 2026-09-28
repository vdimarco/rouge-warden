// js/story/combat/tokens.js : many enemies at once (COMBAT spec 4, design 4.2).
// - Attack tokens: at most 2 grunts attack at once, on every tier (C2: gameplay never reads the quality tier). A token
//   is granted at most every 0.8 s, to the best score: in front of the hero, then the longest idle. A grunt
//   gives its token back when its move ends. Bosses hold their own and never count.
// - Everyone else circles on a ring 3.5-6 m out, strafes, sometimes taunts; enemies keep 0.9 m from each
//   other and from the hero, both ways.
// - Lock-on: the nearest enemy in a 70 degree cone of the camera within 20 m; cycle by lockCycle(d) (the
//   UI's swipe, a mouse flick over 60 px, a right-stick flick). Soft aim: 3 m and 60 degrees.
// - The parry hint follows the soonest blow on its way to the hero (S.combat.parryHint, for the UI).
import { angDiff, angleTo, flatDist } from './fighter.js';

export const MAX_TOKENS = 2;
const REGRANT = 0.8, LOCK_RANGE = 20, LOCK_CONE = (70 * Math.PI / 180) / 2, SEP = 0.9;

export function createTokens(K) {
  const { S } = K;
  let grantT = 0;
  const live = (f) => !f.downed && !f.tied && !f.gone && f.alert;
  const grunts = () => K.enemies.filter((f) => live(f) && !f.boss);
  const hint = { t: null, unblock: false, from: null, soon: false };

  function holders() { let n = 0; for (const f of K.enemies) if (f.token && !f.boss) n++; return n; }
  function update(dt) {
    const H = S.hero;
    // hand back tokens that are done with (down, stunned, idle after a move)
    for (const f of K.enemies) {
      if (!f.token || f.boss) continue;
      // (a holder that never gets to swing in 5 s, blocked on its way in, lets another try)
      if (!live(f) || (f.state !== 'attack' && f.state !== 'idle' && f.state !== 'grabHold') || (f.state === 'idle' && (f.usedToken || K.ct - f.tokenAt > 5))) { f.token = false; f.usedToken = false; f.idleT = 0; }
    }
    for (const f of K.enemies) if (!f.token && live(f) && f.state === 'idle') f.idleT += dt;
    grantT -= dt;
    if (grantT <= 0 && holders() < MAX_TOKENS) {
      // the best free grunt: in front of the hero first, then the longest idle
      let best = null, bs = -Infinity;
      for (const f of grunts()) {
        if (f.token || f.state !== 'idle' || f.cooldown > 0.35) continue;
        const d = flatDist(f.pos, H.pos), front = Math.cos(angDiff(H.face, angleTo(H.pos, f.pos)));
        const score = front * 2 + Math.min(f.idleT, 6) * 0.8 - Math.max(0, d - 6) * 0.25;
        if (score > bs) { bs = score; best = f; }
      }
      if (best) { best.token = true; best.usedToken = false; best.idleT = 0; best.tokenAt = K.ct; grantT = REGRANT; }
    }
    // the ring: each grunt without a token has a slot angle around the hero
    const g = grunts().filter((f) => !f.token);
    g.forEach((f, i) => {
      const want = angleTo(H.pos, f.pos);
      f.ring = want + angDiff(want, (i / Math.max(1, g.length)) * Math.PI * 2 + K.ct * 0.05) * 0.05;
    });
    separate();
    // the parry hint: the blow that lands soonest on the hero
    hint.t = null; hint.unblock = false; hint.from = null;
    for (const f of K.enemies) {
      if (f.state !== 'attack' || f.nextHit == null || !f.atk) continue;
      const left = (f.nextHit - f.clipT) / Math.max(0.2, (f.atk.spec.speed || 1));
      if (left < -0.1) continue;
      if (hint.t == null || left < hint.t) { hint.t = left; hint.unblock = !!f.atk.spec.unblock; hint.from = f; }
    }
    hint.soon = hint.t != null && !hint.unblock && hint.t < 0.45 && hint.t > -0.1;
    if (K.lock && (!live(K.lock) || flatDist(K.lock.pos, H.pos) > LOCK_RANGE + 6)) retarget();
  }
  // keep 0.9 m between enemies, and between enemies and the hero (both move)
  function separate() {
    const H = S.hero, L = K.enemies;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.gone || a.air > 0.2) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.gone || b.air > 0.2) continue;
        const min = (a.downed || b.downed) ? 0.5 : SEP + (a.radius + b.radius) * 0.5;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) {
          const k = (min - d) / d * 0.5;
          if (!a.downed) { a.pos.x -= dx * k; a.pos.z -= dz * k; }
          if (!b.downed) { b.pos.x += dx * k; b.pos.z += dz * k; }
        }
      }
      if (a.downed || H.mode !== 'foot' || H.state === 'grabbed' || a.state === 'grabHold') continue;
      const min = a.radius + H.radius + 0.25, dx = H.pos.x - a.pos.x, dz = H.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) { const k = (min - d) / d; H.pos.x += dx * k * 0.6; H.pos.z += dz * k * 0.6; a.pos.x -= dx * k * 0.4; a.pos.z -= dz * k * 0.4; }
    }
  }

  /* ---------------- lock-on ---------------- */
  const lockable = () => K.enemies.filter((f) => live(f) && f.state !== 'vanish' && flatDist(f.pos, S.hero.pos) <= LOCK_RANGE);
  function lockOn() {
    const H = S.hero, fwd = K.cam.yaw;
    let best = null, bd = Infinity;
    for (const f of lockable()) {
      const d = flatDist(f.pos, H.pos), off = Math.abs(angDiff(fwd, angleTo(H.pos, f.pos)));
      const score = off <= LOCK_CONE ? d : d + 100; // in the cone first, else the nearest at all
      if (score < bd) { bd = score; best = f; }
    }
    setLock(best);
    return best;
  }
  function setLock(f) { K.lock = f || null; K.emit('lock', K.lock); }
  function toggleLock() { if (K.lock) setLock(null); else lockOn(); }
  // the next enemy clockwise (d > 0) or counter-clockwise around the hero, seen from the camera
  function lockCycle(d = 1) {
    const H = S.hero, L = lockable();
    if (!L.length) { setLock(null); return null; }
    if (!K.lock || !L.includes(K.lock)) return lockOn();
    const bearing = (f) => angDiff(K.cam.yaw, angleTo(H.pos, f.pos));
    L.sort((a, b) => bearing(a) - bearing(b));
    const i = L.indexOf(K.lock), n = L.length;
    // screen right is a negative bearing (yaw grows to the left): d > 0 steps right
    setLock(L[((i - Math.sign(d || 1)) % n + n) % n]);
    return K.lock;
  }
  // the lock target went down: the next nearest in the fight, if the player was locked on
  function retarget() {
    if (!K.lock) return;
    const was = K.lock; K.lock = null;
    const H = S.hero;
    let best = null, bd = Infinity;
    for (const f of lockable()) { if (f === was) continue; const d = flatDist(f.pos, H.pos); if (d < bd) { bd = d; best = f; } }
    setLock(best);
  }
  // soft aim: the live enemy within r (plus its radius) and half-angle arc of a heading that is most in
  // front and nearest (an angle of 0.5 rad counts like a metre)
  function softAim(pos, face, r, arc) {
    let best = null, bd = Infinity;
    for (const f of K.enemies) {
      if (!live(f) || f.state === 'vanish') continue;
      const d = flatDist(f.pos, pos) - f.radius, off = Math.abs(angDiff(face, angleTo(pos, f.pos)));
      if (d > r || off > arc) continue;
      const score = d + off * 2;
      if (score < bd) { bd = score; best = f; }
    }
    return best;
  }
  function brokenNear(pos, r) {
    let best = null, bd = Infinity;
    for (const f of K.enemies) if (f.state === 'broken' && !f.downed) { const d = flatDist(f.pos, pos); if (d < r && d < bd) { bd = d; best = f; } }
    return best;
  }
  // where to face while guarding with no lock: the nearest attacker
  function nearestFacing(H) {
    const f = hint.from && flatDist(hint.from.pos, H.pos) < 8 ? hint.from : softAim(H.pos, H.face, 6, Math.PI);
    return f ? angleTo(H.pos, f.pos) : null;
  }
  function reset() { grantT = 0; K.lock = null; hint.t = null; hint.from = null; hint.soon = false; }
  return { update, lockOn, toggleLock, lockCycle, retarget, softAim, brokenNear, nearestFacing, holders, hint, reset, setLock, MAX_TOKENS };
}
