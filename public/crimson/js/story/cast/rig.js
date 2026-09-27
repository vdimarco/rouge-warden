// js/story/cast/rig.js : what a body's skeleton looks like at rest. Every body in the game (the arena GLBs,
// the wild crew GLBs and the code-built bodies) uses the same 24-bone Meshy skeleton, but the rest frames
// differ: the Hips frame falls into families (A: about identity, B: tipped over, the ronin its own). The
// rest comes from the bind pose (skeleton.boneInverses), so it is right even while the body is animated.
// Units: rig space, the Armature's (centimetres, +y up, the body faces +z, the soles at y 0).
import * as THREE from 'three';

export const BONES = Object.freeze(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  'Spine02', 'Spine01', 'Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'neck', 'Head', 'head_end', 'headfront']);
// the parent of each bone (the Meshy hierarchy)
export const PARENT = Object.freeze({
  Hips: null, LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot', RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
  Spine02: 'Hips', Spine01: 'Spine02', Spine: 'Spine01', LeftShoulder: 'Spine', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', neck: 'Spine', Head: 'neck', head_end: 'Head', headfront: 'Head',
});
const FAMILY_B = new THREE.Quaternion(0.5, -0.3, 0.55, 0.55).normalize();

const cache = new WeakMap(); // boneInverses array (shared by every clone of a template) -> rig
export function findSkinned(root) { let m = null; root.traverse((o) => { if (!m && o.isSkinnedMesh && !o.userData.hull) m = o; }); return m; }
// the rig of a skinned mesh, or of the first skinned mesh under an object
export function rigOf(obj) {
  const mesh = obj && obj.isSkinnedMesh ? obj : obj ? findSkinned(obj) : null;
  if (!mesh) return null;
  const inv = mesh.skeleton.boneInverses;
  let r = cache.get(inv);
  if (!r) { r = rigInfo(mesh); cache.set(inv, r); }
  return r;
}

// Rest local quaternions and positions, rest frames in rig space, the Hips height, the family, the bind
// height of the mesh and the bone lengths. Rig space is the Armature's (centimetres) with the soles at y 0
// and the Hips over x = z = 0. The skin's own space can differ: a quantized GLB (KHR_mesh_quantization)
// keeps its vertices in [-1, 1] with the scale and offset folded into the inverse bind matrices, so the
// Hips frame's scale s and the mesh's lowest point map it back to centimetres.
export function rigInfo(mesh) {
  const sk = mesh.skeleton, names = sk.bones.map((b) => b.name);
  const bindInv = new THREE.Matrix4().copy(mesh.bindMatrix).invert();
  const world = {}, restQ = {}, restP = {}, worldQ = {}, worldP = {}, index = {}, gp = {};
  const m = new THREE.Matrix4(), sc = new THREE.Vector3();
  names.forEach((n, i) => { index[n] = i; world[n] = new THREE.Matrix4().copy(bindInv).multiply(m.copy(sk.boneInverses[i]).invert()); });
  for (const n of names) {
    const p = PARENT[n];
    restP[n] = new THREE.Vector3(); restQ[n] = new THREE.Quaternion();
    if (p && world[p]) new THREE.Matrix4().copy(world[p]).invert().multiply(world[n]).decompose(restP[n], restQ[n], sc);
    gp[n] = new THREE.Vector3(); worldQ[n] = new THREE.Quaternion(); world[n].decompose(gp[n], worldQ[n], sc);
    if (!p) restQ[n].copy(worldQ[n]);
  }
  const s = new THREE.Vector3().setFromMatrixScale(world.Hips).x || 1;
  // the mesh at bind, in skin space
  const pos = mesh.geometry.attributes.position, box = new THREE.Box3(), v = new THREE.Vector3();
  const topV = new THREE.Vector3(0, -Infinity, 0);
  for (let i = 0; i < pos.count; i++) { box.expandByPoint(v.fromBufferAttribute(pos, i)); if (v.y > topV.y) topV.copy(v); }
  const hipsY = (gp.Hips.y - box.min.y) / s;
  restP.Hips.set(0, hipsY, 0);
  for (const n of names) worldP[n] = gp[n].clone().sub(gp.Hips).divideScalar(s).add(restP.Hips);
  const hq = restQ.Hips, angA = 2 * Math.acos(Math.min(1, Math.abs(hq.w))), angB = hq.angleTo(FAMILY_B);
  const family = angA < 0.45 ? 'A' : angB < 0.45 ? 'B' : 'C';
  const key = names.map((n) => `${n}:${restQ[n].toArray().map((x) => x.toFixed(3)).join(',')}:${restP[n].toArray().map((x) => x.toFixed(1)).join(',')}`).join('|');
  const len = {};
  for (const n of names) len[n] = restP[n].length();
  const rbox = new THREE.Box3(box.min.clone().sub(gp.Hips).divideScalar(s).add(restP.Hips), box.max.clone().sub(gp.Hips).divideScalar(s).add(restP.Hips));
  // the top of the head (the highest point of the mesh at bind), in rig space
  const headTop = topV.clone().sub(gp.Hips).divideScalar(s).add(restP.Hips);
  return {
    names, index, restQ, restP, worldQ, worldP, hipsY, family, key, len, skinScale: s, headTop,
    height: rbox.max.y - rbox.min.y, minY: rbox.min.y, maxY: rbox.max.y, box: rbox,
  };
}

// Forward kinematics at rest proportions: world (mesh space) positions and rotations of every bone for a
// set of local quaternions (missing bones use rest) and a Hips position. out: {P:{}, Q:{}}.
const tv = new THREE.Vector3();
export function fk(rig, localQ, hipsPos, out = { P: {}, Q: {} }) {
  for (const n of BONES) {
    const p = PARENT[n];
    const q = localQ[n] || rig.restQ[n];
    if (!out.P[n]) { out.P[n] = new THREE.Vector3(); out.Q[n] = new THREE.Quaternion(); }
    if (!p) { out.Q[n].copy(q); out.P[n].copy(hipsPos || rig.restP[n]); continue; }
    out.Q[n].multiplyQuaternions(out.Q[p], q);
    tv.copy(rig.restP[n]).applyQuaternion(out.Q[p]);
    out.P[n].copy(out.P[p]).add(tv);
  }
  return out;
}
// the bone names a rig must have (for the bone test)
export const missingBones = (names) => BONES.filter((b) => !names.includes(b));
