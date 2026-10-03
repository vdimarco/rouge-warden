// js/story/vehicles/drivecam.js : the chase camera while the hero rides (CAMERA_PRIO.drive, 50).
// 8.5 m back, 3 m up, looking 6 m ahead; FOV 60 to 70 with speed; the pitch follows the slope; the look
// stick or mouse orbits it and it swings back behind after 1.5 s; C (lookback) looks back. It keeps out of
// hills and buildings by marching toward where it wants to be (as Breath of the Lake's camera does): it
// moves in fast when something is in the way and eases back out, and never sits under the ground. In a
// drift its heading lags the van by about 0.3 s, so a slide reads as a slide.
import * as THREE from 'three';
import { CAMERA_PRIO } from '../types.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createDriveCam(S, D) {
  const C = { yaw: 0, orbit: 0, elevation: 0, idle: 9, pitch: 0, dist: 8.5, dcol: 8.5, fov: 60, init: false, blend: 1, shake: 0, from: new THREE.Vector3(), fromLook: new THREE.Vector3() };
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), pivot = new THREE.Vector3();
  const active = () => !!D.riding && S.world.visible && S.hero && (S.hero.mode === 'drive' || S.hero.mode === 'passenger');
  function update(rdt, raw) {
    const v = D.riding, dt = Math.min(0.1, raw || rdt || 1 / 60);
    const cam = S.camera;
    if (!C.init) {
      // start from wherever the camera was and blend into the chase view over 0.7 s
      C.init = true; C.yaw = v.yaw; C.orbit = 0; C.elevation = 0; C.idle = 9; C.dist = 8.5; C.dcol = 8.5; C.pitch = v.susp.slopeP; C.fov = cam.fov;
      C.from.copy(cam.position); cam.getWorldDirection(C.fromLook).multiplyScalar(10).add(cam.position); C.blend = 0;
    }
    // heading: the van's, pulled toward its travel in a slide (0.3 s lag), else 0.15 s
    const sp = v.speed, travel = Math.atan2(v.vel.x, v.vel.z), sliding = v.slip > 2 && Math.abs(sp) > 5;
    const head = sliding ? v.yaw + wrap(travel - v.yaw) * 0.5 : v.yaw;
    C.yaw += wrap(head - C.yaw) * (1 - Math.exp(-dt / (sliding ? 0.3 : 0.15)));
    // orbit with the look stick / mouse; back behind after 1.5 s idle
    const lk = S.input.axis('look');
    if (Math.abs(lk.x) > 0.05 || Math.abs(lk.y) > 0.05) { C.orbit = wrap(C.orbit - lk.x * 2.6 * dt); C.idle = 0; } else C.idle += dt;
    if (C.idle > 1.5) C.orbit *= Math.exp(-dt * 3);
    C.elevation = clamp(C.elevation - lk.y * 1.6 * dt, -0.6, 1.3);
    const back = S.input.held('lookback') ? Math.PI : 0;
    const yaw = C.yaw + C.orbit + back;
    C.pitch += (v.susp.slopeP - C.pitch) * (1 - Math.exp(-dt * 3));
    const p = C.pitch * 0.8 + (back ? 0 : 0);
    // where it wants to be: behind along the (pitched) heading, 3 m up
    // 8.5 m back and 3 m up for a car; a tall van sits the camera higher and a little farther back, so the
    // road ahead shows over its roof
    const fx = Math.sin(yaw), fz = Math.cos(yaw), cp = Math.cos(p), spd = Math.abs(sp);
    const up = 3 + Math.max(0, v.h - 1.9) * 1.4, dist = 8.5 + Math.max(0, v.hd - 2.5) + clamp(spd - 18, 0, 10) * 0.12;
    pivot.set(v.pos.x, v.pos.y + Math.min(1.9, v.h * 0.8), v.pos.z);
    want.set(v.pos.x - fx * cp * dist, v.pos.y + up - Math.sin(p) * dist, v.pos.z - fz * cp * dist);
    // keep out of the ground and buildings: march from the pivot toward the camera
    const t = S.world.colliders.raycast(pivot, want);
    const len = pivot.distanceTo(want), hit = t != null ? Math.max(2.4, t * len - 0.4) : len;
    C.dcol = hit < C.dcol ? hit : C.dcol + (hit - C.dcol) * (1 - Math.exp(-dt * 2.2));
    const d = Math.min(C.dcol, hit);
    pos.copy(pivot).addScaledVector(want.sub(pivot).normalize(), d);
    const g = S.world.surface(pos.x, pos.z, pos.y + 0.5);
    if (pos.y < g + 0.6) pos.y = g + 0.6;
    // look a little ahead of the van, along where it is going
    const vf = Math.sin(v.yaw), vz = Math.cos(v.yaw), ahead = back ? -6 : 6;
    look.set(v.pos.x + (back ? -vf : vf) * Math.abs(ahead) + v.vel.x * 0.12, v.pos.y + 1.3 + (up - 3) * 0.6 + Math.sin(v.susp.slopeP) * 6, v.pos.z + (back ? -vz : vz) * Math.abs(ahead) + v.vel.z * 0.12);
    if (Math.abs(C.elevation) > 0.01 || Math.abs(C.orbit) > 0.01) look.set(pos.x + fx * 20, pos.y + Math.tan(C.elevation) * 20, pos.z + fz * 20);
    // a knock shakes it
    if (S.time - v.contactT < 0.05 && v.lastImpact > 3) C.shake = Math.min(0.5, v.lastImpact * 0.03);
    C.shake = Math.max(0, C.shake - dt * 1.5);
    if (C.shake > 0) { pos.x += (Math.random() - 0.5) * C.shake; pos.y += (Math.random() - 0.5) * C.shake; }
    // blend in from the previous camera
    if (C.blend < 1) {
      C.blend = Math.min(1, C.blend + dt / 0.7);
      const k = C.blend * C.blend * (3 - 2 * C.blend);
      pos.lerpVectors(C.from, pos, k); look.lerpVectors(C.fromLook, look, k);
    }
    cam.position.copy(pos); cam.lookAt(look);
    const fov = 60 + 10 * clamp(spd / 28, 0, 1);
    C.fov += (fov - C.fov) * (1 - Math.exp(-dt * 2));
    if (Math.abs(cam.fov - C.fov) > 0.01) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
  }
  S.cameras.add('drive', CAMERA_PRIO.drive, () => { const a = active(); if (!a) C.init = false; return a; }, update);
  return { reset() { C.init = false; }, get state() { return C; } };
}
