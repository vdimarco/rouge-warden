// js/story/combat/footcam.js : the camera on foot (COMBAT spec 10), priority 40. game.js updateCamera()
// ported: an orbit behind the hero from the look input, the lock-on swing toward the target, punch and
// shake; plus Breath of the Lake's rule for walls and hills: the camera never sits behind anything solid
// (S.world.colliders.raycast, ground included). It pulls in fast and eases back out, so the view never
// jitters. A mouse flick over 60 px, or a right-stick flick, moves the lock to the next enemy.
import * as THREE from 'three';
import { CAMERA_PRIO } from '../types.js';
import { clamp, damp, angDiff, angleTo, flatDist } from './fighter.js';

export function createFootcam(K) {
  const { S } = K;
  const cam = K.cam = { yaw: 0, pitch: 0.2, dist: 4.4, punch: 0, shake: 0, idle: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), dcol: NaN, init: false, flickT: 0, rsHeld: false,
    snapTo(yaw) { cam.yaw = yaw; cam.init = false; } };
  const pivot = new THREE.Vector3(), want = new THREE.Vector3(), tgt = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  const active = () => S.hero.mode === 'foot' && S.world.visible && !!S.hero.actor;

  // a mouse flick over 60 px moves the lock (the pointer is locked by the UI while playing)
  const onMouse = (e) => {
    if (!S.api || !S.api.active || !active() || !K.lock || S.mode !== 'play') return;
    if (!document.pointerLockElement) return;
    if (Math.abs(e.movementX) > 60 && performance.now() - cam.flickT > 250) { cam.flickT = performance.now(); K.tokens.lockCycle(e.movementX > 0 ? 1 : -1); }
  };
  addEventListener('mousemove', onMouse);

  // how far the camera can sit from the pivot along a direction before something is in the way
  function free(p, dir, maxd) {
    b3.copy(p).addScaledVector(dir, maxd + 0.3);
    const t = S.world.colliders.raycast(p, b3);
    return t == null ? maxd : Math.max(0.6, t * (maxd + 0.3) - 0.3);
  }
  function update(rdt) {
    const H = S.hero, lk = S.input.axis('look');
    const fight = K.fighting();
    // right stick flick: the next lock target
    if (K.lock && Math.abs(lk.x) > 0.9) { if (!cam.rsHeld) { cam.rsHeld = true; K.tokens.lockCycle(lk.x > 0 ? 1 : -1); } }
    else if (Math.abs(lk.x) < 0.4) cam.rsHeld = false;
    const lock = K.lock && !K.lock.downed && !K.lock.gone ? K.lock : null;
    if (!lock) { cam.yaw -= lk.x * 2.6 * rdt; cam.pitch = clamp(cam.pitch + lk.y * 1.6 * rdt, -0.3, 0.9); }
    if (Math.abs(lk.x) > 0.05 || Math.abs(lk.y) > 0.05) cam.idle = 0; else cam.idle += rdt;
    if (lock) {
      cam.yaw += angDiff(cam.yaw, angleTo(H.pos, lock.pos)) * Math.min(1, rdt * 5);
      const d = flatDist(H.pos, lock.pos);
      cam.pitch = damp(cam.pitch, d < 3.5 ? 0.05 : 0.16, 3, rdt);
    } else if (cam.idle > 1.0 && H.speedNow > 2 && S.input.device !== 'key') {
      // on a pad or a phone, the view swings round behind a hero who runs
      cam.yaw += angDiff(cam.yaw, H.face) * Math.min(1, rdt * 0.9);
    } else if (cam.idle > 1.2 && H.speedNow > 2 && S.input.axis('move').y > 0.3) cam.yaw += angDiff(cam.yaw, H.face) * Math.min(1, rdt * 0.6);
    cam.punch = Math.max(0, cam.punch - rdt * 2.6);
    cam.shake = Math.max(0, cam.shake - rdt * 2.4);
    const ay = H.actor && H.state === 'grabbed' ? H.actor.root.position.y : H.pos.y;
    pivot.set(H.pos.x, ay + (H.crouch ? 1.15 : 1.55), H.pos.z);
    const dist = (fight ? 5.2 : cam.dist) * (1 - 0.3 * Math.min(1, cam.punch));
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const side = fight ? 0.75 : 0.45;
    // the camera sits behind and above the pivot, a little over the right shoulder
    a3.set(-fx * Math.cos(cam.pitch) + rx * side / dist, Math.sin(cam.pitch) + 0.3 / dist, -fz * Math.cos(cam.pitch) + rz * side / dist).normalize();
    const reach = Math.hypot(dist, 0.3);
    const hit = free(pivot, a3, reach);
    const prev = Number.isFinite(cam.dcol) ? cam.dcol : hit;
    cam.dcol = hit < prev ? hit : damp(prev, hit, 2.2, rdt);
    const d = Math.min(cam.dcol, hit);
    want.copy(pivot).addScaledVector(a3, d);
    want.y = Math.max(want.y, S.world.surface(want.x, want.z, want.y + 0.5) + 0.4);
    if (!cam.init) { cam.pos.copy(want); cam.look.copy(pivot); cam.init = true; }
    else cam.pos.lerp(want, 1 - Math.exp(-rdt * 12));
    if (lock) tgt.copy(pivot).addScaledVector(a3.set(rx, 0, rz), 0.35).lerp(a3.set(lock.pos.x, lock.pos.y + 1.4 + (lock.air || 0), lock.pos.z), 0.45);
    else tgt.set(pivot.x + fx * 4 + rx * 0.4, pivot.y - Math.sin(cam.pitch) * 2.2 + 0.2, pivot.z + fz * 4 + rz * 0.4);
    cam.look.lerp(tgt, 1 - Math.exp(-rdt * 10));
    S.camera.position.copy(cam.pos);
    if (cam.shake > 0) S.camera.position.add(a3.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(cam.shake * 0.07));
    S.camera.lookAt(cam.look);
    const fov = damp(S.camera.fov, 55 - cam.punch * 9, 14, rdt);
    if (Math.abs(fov - S.camera.fov) > 1e-3) { S.camera.fov = fov; S.camera.updateProjectionMatrix(); }
  }
  S.cameras.add('foot', CAMERA_PRIO.foot, active, (rdt) => update(rdt));
  return { cam, update, dispose: () => removeEventListener('mousemove', onMouse) };
}
