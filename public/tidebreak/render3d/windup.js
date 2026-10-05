// Windup clips for the 3D heroes: the anticipation pose between the first cue of a cast and its hit. They are additive,
// so they layer on top of whatever the hero already plays (the cast clip's lead-in, idle or run) and work for every
// weapon. The clip time is the windup progress: 0 is the hero's own pose, 1 is the full anticipation.
// - windup (casts and ultimates): the torso leans back and coils away from the target, the arms draw back and out.
// - crouch (leap and charge engages): the torso drops forward, the head stays up, the arms swing back.
// Each turn is given in the rig's model space (the auto-rig is +Y up, +Z forward, +X the hero's left) and moved into
// each bone's own frame from that hero's bind pose, so it bends the same way on every skeleton.
import * as THREE from 'three';
import { bindPose } from '../hero-rig.js';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
// Degrees per bone, applied in order. Spine02 is the lowest spine bone; the arms hang from Spine.
export const WINDUP_POSES = {
  windup: {
    Spine02: [['x', -8]], Spine01: [['x', -8]], Spine: [['x', -9], ['y', -14]],
    neck: [['x', 4]], Head: [['y', 9]],
    LeftArm: [['x', 35], ['z', 15]], RightArm: [['x', 35], ['z', -15]],
  },
  crouch: {
    Spine02: [['x', 8]], Spine01: [['x', 8]], Spine: [['x', 8]],
    neck: [['x', -12]], Head: [['x', -6]],
    LeftArm: [['x', 30], ['z', 10]], RightArm: [['x', 30], ['z', -10]],
  },
};
// How much of the full pose each kind of cast reaches: an ultimate winds up all the way.
export const WINDUP_WEIGHT = { cast: .75, ultimate: 1, engage: 1 };
export const windupClipFor = kind => kind === 'engage' ? 'crouch' : 'windup';

// The local-space turn that rotates a bone by `turn` in model space about its own pivot: W^-1 * R * W.
export function localTurn(bindRotation, turn) { return bindRotation.clone().invert().multiply(turn).multiply(bindRotation); }
export function modelTurn(steps) {
  const r = new THREE.Quaternion(), step = new THREE.Quaternion();
  for (const [axis, degrees] of steps) r.premultiply(step.setFromAxisAngle(AXES[axis], THREE.MathUtils.degToRad(degrees)));
  return r;
}
// Clips are cached per hero model, like the retargeted clips: clones of one hero share the bind pose.
const cache = new Map();
export function windupClips(key, mesh) {
  if (cache.has(key)) return cache.get(key);
  const bind = bindPose(mesh), clips = {};
  for (const [name, pose] of Object.entries(WINDUP_POSES)) {
    const tracks = [];
    for (const [bone, steps] of Object.entries(pose)) {
      if (!bind[bone]) continue;
      const d = localTurn(bind[bone].rotation, modelTurn(steps));
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, d.x, d.y, d.z, d.w]));
    }
    clips[name] = new THREE.AnimationClip(name, 1, tracks, THREE.AdditiveAnimationBlendMode);
  }
  cache.set(key, clips); return clips;
}
