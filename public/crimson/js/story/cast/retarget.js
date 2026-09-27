// js/story/cast/retarget.js : play one body's clips on another body with the same 24 bones.
// Limb bones share one local-frame convention, so their rotations copy raw. The Hips frame differs between
// rig families, so four bones are corrected with the rest poses (design, CAST spec 2):
//   Hips          q' = q * inv(restSrcHips) * restDstHips
//   LeftUpLeg, RightUpLeg, Spine02 (the Hips' children)   q' = inv(restDstHips) * restSrcHips * q
// Translation and scale tracks go, except the Hips position: its y is scaled by the hip-height ratio and
// its x and z are zeroed on every key (the clips are in place; some pin the body off the root).
// Then the feet are grounded: legs of other lengths would float or sink in a crouch, so at every Hips key
// the Hips height is nudged until the lowest foot stands as high over the ground as it does on the source
// body (scaled by the same ratio). Standing clips barely change; crouches, rolls and knockdowns keep their
// feet on the floor. Results are cached per (clip, target rest pose), so every clone of a body shares them.
import * as THREE from 'three';
import { fk } from './rig.js';

const CHILDREN = new Set(['LeftUpLeg', 'RightUpLeg', 'Spine02']);
const cache = new WeakMap(); // source clip -> Map(dst rig key -> clip)
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();

const trackBone = (name) => { const i = name.lastIndexOf('.'); return [name.slice(0, i), name.slice(i + 1)]; };

export function retargetClip(clip, src, dst, name = clip.name) {
  let m = cache.get(clip);
  if (!m) cache.set(clip, (m = new Map()));
  const key = `${name}|${src.key}|${dst.key}`;
  let out = m.get(key);
  if (out) return out;
  const rsH = src.restQ.Hips, rdH = dst.restQ.Hips;
  const post = new THREE.Quaternion().copy(rsH).invert().multiply(rdH); // inv(rs) * rd
  const pre = new THREE.Quaternion().copy(rdH).invert().multiply(rsH); // inv(rd) * rs
  const ratio = dst.hipsY / src.hipsY;
  const tracks = [];
  for (const t of clip.tracks) {
    const [bone, prop] = trackBone(t.name);
    if (!(bone in dst.index)) continue;
    if (prop === 'scale') continue;
    if (prop === 'position') {
      if (bone !== 'Hips') continue;
      const v = Float32Array.from(t.values);
      for (let i = 0; i < v.length; i += 3) { v[i] = 0; v[i + 1] *= ratio; v[i + 2] = 0; }
      tracks.push(new THREE.VectorKeyframeTrack(t.name, Float32Array.from(t.times), v));
      continue;
    }
    if (prop !== 'quaternion') continue;
    const v = Float32Array.from(t.values);
    if (bone === 'Hips' || CHILDREN.has(bone)) {
      for (let i = 0; i < v.length; i += 4) {
        qa.fromArray(v, i);
        if (bone === 'Hips') qb.multiplyQuaternions(qa, post); else qb.multiplyQuaternions(pre, qa);
        qb.toArray(v, i);
      }
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(t.name, Float32Array.from(t.times), v));
  }
  ground(clip, tracks, src, dst, ratio);
  out = new THREE.AnimationClip(name, clip.duration, tracks);
  m.set(key, out);
  return out;
}

const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
const LEGS = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const fkA = { P: {}, Q: {} }, fkB = { P: {}, Q: {} }, hp = new THREE.Vector3();
// the lowest foot joint's height over its own rest height (0 when a foot is planted as at rest)
function lowFoot(rig, f) { let lo = Infinity; for (const n of FEET) lo = Math.min(lo, f.P[n].y - (rig.worldP[n].y - rig.minY)); return lo; }
function ground(clip, tracks, src, dst, ratio) {
  const hipsT = tracks.find((t) => t.name === 'Hips.position');
  if (!hipsT) return;
  const srcI = {}, dstI = {};
  for (const t of clip.tracks) { const [b, p] = trackBone(t.name); if (p === 'quaternion' && LEGS.includes(b)) srcI[b] = t.createInterpolant(); }
  for (const t of tracks) { const [b, p] = trackBone(t.name); if (p === 'quaternion' && LEGS.includes(b)) dstI[b] = t.createInterpolant(); }
  const srcPos = clip.tracks.find((t) => t.name === 'Hips.position');
  const srcPI = srcPos ? srcPos.createInterpolant() : null;
  const qs = {}, qd = {};
  for (const b of LEGS) { qs[b] = new THREE.Quaternion(); qd[b] = new THREE.Quaternion(); }
  const v = hipsT.values;
  for (let i = 0; i < hipsT.times.length; i++) {
    const t = hipsT.times[i];
    for (const b of LEGS) {
      if (srcI[b]) qs[b].fromArray(srcI[b].evaluate(t)); else qs[b].copy(src.restQ[b]);
      if (dstI[b]) qd[b].fromArray(dstI[b].evaluate(t)); else qd[b].copy(dst.restQ[b]);
    }
    const ys = srcPI ? srcPI.evaluate(t)[1] : src.hipsY;
    const a = lowFoot(src, fk(src, qs, hp.set(0, ys, 0), fkA));
    const b = lowFoot(dst, fk(dst, qd, hp.set(0, v[i * 3 + 1], 0), fkB));
    if (Number.isFinite(a) && Number.isFinite(b)) v[i * 3 + 1] += a * ratio - b;
  }
}

// no NaN or Infinity in any track (for the tests)
export function clipFinite(clip) {
  for (const t of clip.tracks) for (let i = 0; i < t.values.length; i++) if (!Number.isFinite(t.values[i])) return false;
  return true;
}
// the largest |x| or |z| of the Hips position over every key (0 when the clip has no Hips position)
export function hipsDrift(clip) {
  let d = 0;
  for (const t of clip.tracks) {
    if (t.name !== 'Hips.position') continue;
    for (let i = 0; i < t.values.length; i += 3) d = Math.max(d, Math.abs(t.values[i]), Math.abs(t.values[i + 2]));
  }
  return d;
}
