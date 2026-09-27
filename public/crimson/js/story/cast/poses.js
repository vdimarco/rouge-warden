// js/story/cast/poses.js : the 'lib:' clips, built in code for each rig (AMENDMENTS A2, A5: there is no
// anim.glb). Each is a pose function of time in the stand-in joints of locomotion.js, baked into an
// AnimationClip with all 24 bone rotations and the Hips position, so the mixer blends it with any other clip.
// Static poses carry a slow breath so they never look frozen. The seated poses put the seat surface at the
// actor's root (the Hips sit 12% of their standing height above it); every other pose puts the feet (or a
// knee, or the back) on the ground at the root.
import * as THREE from 'three';
import { BONES } from './rig.js';
import { solve, stride, strideRate } from './locomotion.js';

const TAU = Math.PI * 2;
const breath = (t, T = 4) => Math.sin(t / T * TAU);
const stand = (t) => ({ torso: { x: 0.02 + 0.012 * breath(t) }, head: { x: 0.02 * breath(t, 4), y: 0.08 * Math.sin(t / 8 * TAU) }, arms: [{ x: 0.02, out: 0.03 }, { x: 0.02, out: 0.03 }], elbows: [0.15, 0.15] });
const cyc = (sp, o) => TAU / strideRate(sp); // one stride cycle in seconds

// name -> { dur, loop, keys, pose(t) }. The locomotion cycles are one stride long at a set speed; the
// driver in locomotion.js does any other speed live.
export const LIB = {
  idle: { dur: 4, keys: 17, pose: stand },
  walk: { dur: cyc(1.4), keys: 25, pose: (t, d) => stride(t / d * TAU, 1.4) },
  jog: { dur: cyc(3.2), keys: 21, pose: (t, d) => stride(t / d * TAU, 3.2) },
  run: { dur: cyc(5.4), keys: 19, pose: (t, d) => stride(t / d * TAU, 5.4) },
  crouchWalk: { dur: cyc(1.1), keys: 25, pose: (t, d) => stride(t / d * TAU, 1.1, { crouch: 1 }) },
  turn: { dur: 1, keys: 17, pose: (t, d) => stride(t / d * TAU, 0, { turn: 1.5 }) },
  crouch: { dur: 3, keys: 13, pose: (t) => ({ hips: { x: 0.05 }, torso: { x: 0.5 + 0.02 * breath(t, 3) }, head: { x: -0.35 }, legs: [{ x: -0.95, out: 0.12 }, { x: -0.55, out: 0.1 }], knees: [1.75, 1.45], arms: [{ x: -0.35, out: 0.12 }, { x: -0.5, out: 0.1 }], elbows: [0.9, 1.0] }) },
  // seated: thighs level (-1.45 rad as in wild), shins down, arms forward to the wheel
  sitDrive: { dur: 4, keys: 9, pose: (t) => ({ hips: { seat: true, x: -0.08 }, torso: { x: -0.06 + 0.01 * breath(t) }, head: { x: 0.08 }, legs: [{ x: -1.45, out: 0.08 }, { x: -1.4, out: 0.06 }], knees: [1.35, 1.2], arms: [{ x: -0.85, out: 0.14 }, { x: -0.85, out: 0.14 }], elbows: [0.9, 0.9], level: 0.9 }) },
  sitPass: { dur: 4, keys: 9, pose: (t) => ({ hips: { seat: true, x: -0.12 }, torso: { x: -0.1 + 0.012 * breath(t) }, head: { x: 0.05, y: 0.15 * Math.sin(t / 4 * TAU) }, legs: [{ x: -1.4, out: 0.12 }, { x: -1.45, out: 0.1 }], knees: [1.4, 1.45], arms: [{ x: -0.25, out: 0.1 }, { x: -0.3, out: 0.1 }], elbows: [1.1, 1.0], level: 0.9 }) },
  sit: { dur: 4, keys: 9, pose: (t) => ({ hips: { seat: true, x: -0.05 }, torso: { x: 0.08 + 0.012 * breath(t) }, head: { x: 0.08 }, legs: [{ x: -1.5, out: 0.14 }, { x: -1.5, out: 0.12 }], knees: [1.5, 1.5], arms: [{ x: -0.35, out: 0.08 }, { x: -0.35, out: 0.08 }], elbows: [1.2, 1.2], level: 0.95 }) },
  // one knee down, the other foot flat (Gabe's yield, Tank Top at the van door)
  kneel: { dur: 4, keys: 9, pose: (t) => ({ hips: { x: 0.05 }, torso: { x: 0.25 + 0.015 * breath(t) }, head: { x: 0.35 }, legs: [{ x: -1.45, out: 0.08 }, { x: 0.1, out: 0.04 }], knees: [1.5, 1.65], feet: [0, 0.9], arms: [{ x: -0.55, out: 0.02 }, { x: -0.1, out: 0.1 }], elbows: [1.2, 0.35] }) },
  kneelOpen: { dur: 4, keys: 9, pose: (t) => ({ hips: { x: 0.05 }, torso: { x: 0.1 + 0.015 * breath(t) }, head: { x: 0.1 }, legs: [{ x: -1.45, out: 0.08 }, { x: 0.1, out: 0.04 }], knees: [1.5, 1.65], feet: [0, 0.9], arms: [{ x: -0.75, out: 0.45 }, { x: -0.75, out: 0.45 }], elbows: [0.45, 0.45], hands: [{ z: -0.4 }, { z: -0.4 }] }) },
  photo: { dur: 3, keys: 9, pose: (t) => ({ torso: { x: 0.04 + 0.01 * breath(t, 3) }, head: { x: 0.05 }, legs: [{ x: -0.12, out: 0.06 }, { x: 0.1, out: 0.06 }], knees: [0.12, 0.08], arms: [{ x: -0.55, out: -0.35 }, { x: -0.55, out: -0.4 }], elbows: [2.1, 2.15] }) },
  phone: { dur: 3, keys: 9, pose: (t) => ({ torso: { x: 0.03 + 0.01 * breath(t, 3) }, head: { x: 0.12, z: 0.12 }, arms: [{ x: 0.05, out: 0.04 }, { x: -0.55, out: 0.18 }], elbows: [0.2, 2.35], hands: [{}, { x: 0.3 }] }) },
  handsOpen: { dur: 3, keys: 9, pose: (t) => ({ torso: { x: 0.08 + 0.01 * breath(t, 3) }, head: { x: 0.12 }, arms: [{ x: -0.65, out: 0.5 }, { x: -0.65, out: 0.5 }], elbows: [0.4, 0.4], hands: [{ z: -0.4 }, { z: -0.4 }] }) },
  // sitting on the ground, dazed: hands behind, the head rolls
  dazed: { dur: 3, keys: 13, pose: (t) => ({ hips: { seat: true, x: -0.35 }, torso: { x: 0.1 + 0.05 * breath(t, 3) }, head: { x: 0.45, z: 0.18 * Math.sin(t / 3 * TAU), y: 0.12 * Math.cos(t / 3 * TAU) }, legs: [{ x: -1.25, out: 0.2 }, { x: -1.1, out: 0.18 }], knees: [0.5, 0.9], arms: [{ x: 0.55, out: 0.3 }, { x: 0.5, out: 0.3 }], elbows: [0.1, 0.15], level: 0.4 }) },
  // down on the back, knocked out cold (no one is hurt on screen: a slow breath)
  knocked: { dur: 4, keys: 9, pose: (t) => ({ hips: { x: -1.52, h: 0.13 }, torso: { x: 0.08 + 0.02 * breath(t) }, head: { x: -0.1, y: 0.35 }, legs: [{ x: -0.05, out: 0.1 }, { x: -0.25, out: 0.06 }], knees: [0.05, 0.5], arms: [{ x: 0.12, out: 0.62 }, { x: 0.15, out: 0.3 }], elbows: [0.05, 0.12], level: 0 }) },
  cheer: { dur: 1.2, keys: 13, pose: (t, d) => { const u = Math.sin(t / d * TAU); return { torso: { x: -0.05 }, head: { x: -0.2 }, legs: [{ x: -0.05, out: 0.08 }, { x: 0.05, out: 0.08 }], knees: [0.1 + 0.1 * Math.max(0, u), 0.1 + 0.1 * Math.max(0, -u)], arms: [{ x: -2.7 - 0.25 * u, out: 0.35 }, { x: -2.7 + 0.25 * u, out: 0.35 }], elbows: [0.35 + 0.3 * Math.max(0, u), 0.35 + 0.3 * Math.max(0, -u)], hips: { dy: 0.02 * Math.abs(u) } }; } },
  talk: { dur: 4, keys: 25, pose: (t) => { const g = Math.max(0, Math.sin(t / 4 * TAU * 2)); return { torso: { x: 0.03, y: 0.07 * Math.sin(t / 4 * TAU) }, head: { x: 0.06 * Math.sin(t * 2.5), y: 0.12 * Math.sin(t / 4 * TAU + 1) }, arms: [{ x: -0.1, out: 0.05 }, { x: -0.35 * g, out: 0.12 * g }], elbows: [0.3, 0.4 + 1.1 * g] }; } },
};
// the fall to the ground (lib:knock), played once: standing, then the knees go, then flat on the back
function knockPose(t, d) {
  const u = Math.min(1, t / (d * 0.85)), a = stand(0), b = LIB.knocked.pose(0);
  const k = u * u * (3 - 2 * u), mid = Math.sin(u * Math.PI);
  return {
    hips: { x: b.hips.x * k, h: 1 - (1 - b.hips.h) * k - 0.08 * mid },
    torso: { x: a.torso.x * (1 - k) + b.torso.x * k + 0.35 * mid }, head: { x: 0.3 * mid + b.head.x * k, y: b.head.y * k },
    legs: [{ x: b.legs[0].x * k - 0.5 * mid, out: 0.1 }, { x: b.legs[1].x * k - 0.3 * mid, out: 0.06 }], knees: [0.8 * mid + b.knees[0] * k, 0.9 * mid + b.knees[1] * k],
    arms: [{ x: -0.9 * mid + b.arms[0].x * k, out: 0.3 * mid + b.arms[0].out * k }, { x: -0.7 * mid + b.arms[1].x * k, out: 0.3 * mid + b.arms[1].out * k }],
    elbows: [0.6 * mid + b.elbows[0] * k, 0.6 * mid + b.elbows[1] * k], level: 0.85 * (1 - k),
  };
}
LIB.knock = { dur: 1.6, keys: 25, once: true, pose: knockPose };
// the pose names S.cast.pose takes, and the clip each plays ('talk' is also an additive sway, see cast.pose)
export const POSE_CLIPS = Object.freeze({ sitDrive: 'lib:sitDrive', sitPass: 'lib:sitPass', sit: 'lib:sit', kneel: 'lib:kneel', kneelOpen: 'lib:kneelOpen', crouch: 'lib:crouch', photo: 'lib:photo', phone: 'lib:phone', talk: 'lib:talk', handsOpen: 'lib:handsOpen', dazed: 'lib:dazed', knocked: 'lib:knocked', cheer: 'lib:cheer', idle: 'lib:idle', knock: 'lib:knock' });
// clip name -> seconds, for placeholders (D2)
export const LIB_DURATIONS = Object.freeze(Object.fromEntries(Object.entries(LIB).map(([k, v]) => [`lib:${k}`, v.dur])));

// Bake one pose into a clip for a rig. All 24 bones get a rotation track, the Hips a position track.
const cache = new Map(); // rig key -> Map(name -> clip)
export function libClip(rig, name) {
  let m = cache.get(rig.key);
  if (!m) cache.set(rig.key, (m = new Map()));
  let clip = m.get(name);
  if (clip) return clip;
  const def = LIB[name];
  if (!def) return null;
  const n = def.keys, times = new Float32Array(n), qv = {}, hv = new Float32Array(n * 3);
  for (const b of BONES) qv[b] = new Float32Array(n * 4);
  const out = { q: {}, hips: new THREE.Vector3() }, prev = {};
  for (let i = 0; i < n; i++) {
    const t = def.dur * i / (n - 1);
    times[i] = t;
    // a looping clip's last key repeats its first exactly
    const pose = def.pose(def.once ? t : (i === n - 1 ? 0 : t), def.dur);
    solve(rig, pose, out);
    for (const b of BONES) {
      const q = out.q[b];
      if (prev[b] && prev[b].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep neighbouring keys on one side
      (prev[b] || (prev[b] = new THREE.Quaternion())).copy(q);
      q.toArray(qv[b], i * 4);
    }
    out.hips.toArray(hv, i * 3);
  }
  const tracks = BONES.map((b) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, qv[b]));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hv));
  clip = new THREE.AnimationClip(`lib:${name}`, def.dur, tracks);
  m.set(name, clip);
  return clip;
}
export const LIB_NAMES = Object.freeze(Object.keys(LIB));
// replace a pose (a content tweak, or tuning): the next libClip bakes it again on every rig
export function definePose(name, def) { LIB[name] = def; for (const m of cache.values()) m.delete(name); }
