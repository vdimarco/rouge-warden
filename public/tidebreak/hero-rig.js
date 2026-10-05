// Shared animation for the 3D heroes. Every hero model is rigged by the same auto-rigger, so the skeletons share bone
// names but not proportions or rest poses. Each clip in models/clips.json keeps the bind pose of the hero it was made
// on; retarget() moves it onto another skeleton by world-space rotation deltas, which keeps the motion and fits the bones.
import * as THREE from 'three';

const q = () => new THREE.Quaternion(), m4 = () => new THREE.Matrix4(), v3 = () => new THREE.Vector3();

// The rotation part of a column-major 4x4 that may carry a uniform scale (the rig's 0.01 armature scale).
function rotationOf(elements) {
  const m = m4().fromArray(elements), p = v3(), r = q(), s = v3();
  m.decompose(p, r, s); return { rotation: r, position: p, scale: s.x };
}

// Bind pose of a loaded SkinnedMesh, in the mesh's space: world rotation and position per bone name.
export function bindPose(mesh) {
  const pose = {}, inv = m4();
  mesh.skeleton.bones.forEach((bone, i) => { inv.copy(mesh.skeleton.boneInverses[i]).invert(); const { rotation, position } = rotationOf(inv.elements); pose[bone.name] = { rotation, position }; });
  return pose;
}

// Clip entry from clips.json -> a THREE.AnimationClip for the target mesh. Only the hips keep a translation track
// (height only, scaled to the target's hip height), so no clip slides the hero away from its simulation position.
export function retarget(entry, mesh, name) {
  const bones = mesh.skeleton.bones, byName = Object.fromEntries(bones.map(b => [b.name, b]));
  const target = bindPose(mesh), source = Object.fromEntries(Object.entries(entry.bind).map(([bone, e]) => [bone, rotationOf(e)]));
  const parent = bone => { let p = byName[bone]?.parent; while (p && !byName[p.name]) p = p.parent; return p && byName[p.name] ? p.name : null; };
  const order = []; const seen = new Set();
  const visit = b => { if (seen.has(b)) return; const p = parent(b); if (p) visit(p); seen.add(b); order.push(b); };
  for (const b of bones) if (source[b.name]) visit(b.name);
  // Sample every rotation track on one shared timeline.
  const rotationTracks = Object.fromEntries(entry.tracks.filter(t => t.path === 'rotation').map(t => [t.bone, t]));
  const times = [...new Set(entry.tracks.filter(t => t.path === 'rotation').flatMap(t => t.times))].sort((a, b) => a - b);
  const sample = (track, t) => {
    const ts = track.times; let i = 0; while (i < ts.length - 2 && ts[i + 1] <= t) i++;
    const a = q().fromArray(track.values, i * 4), b = q().fromArray(track.values, Math.min(ts.length - 1, i + 1) * 4);
    const k = ts.length > 1 ? THREE.MathUtils.clamp((t - ts[i]) / Math.max(1e-6, ts[i + 1] - ts[i]), 0, 1) : 0;
    return a.slerp(b, k);
  };
  const srcParent = b => entry.parents[b] && source[entry.parents[b]] ? entry.parents[b] : null;
  const srcBindLocal = b => { const p = srcParent(b); return p ? source[p].rotation.clone().invert().multiply(source[b].rotation) : source[b].rotation.clone(); };
  const out = Object.fromEntries(order.map(b => [b, new Float32Array(times.length * 4)]));
  const srcWorld = {}, tgtWorld = {}, tmp = q();
  times.forEach((t, k) => {
    for (const b of order) {
      const p = srcParent(b), local = rotationTracks[b] ? sample(rotationTracks[b], t) : srcBindLocal(b);
      srcWorld[b] = p ? srcWorld[p].clone().multiply(local) : local;
      const delta = srcWorld[b].clone().multiply(tmp.copy(source[b].rotation).invert());
      tgtWorld[b] = delta.multiply(target[b].rotation);
      const tp = parent(b), tl = tp ? tgtWorld[tp].clone().invert().multiply(tgtWorld[b]) : tgtWorld[b].clone();
      tl.toArray(out[b], k * 4);
    }
  });
  const tracks = order.map(b => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, out[b]));
  // Hips height: the source's vertical hip motion, in proportion to the target's hip height.
  const hipsTrack = entry.tracks.find(t => t.bone === 'Hips' && t.path === 'translation'), hips = byName.Hips;
  if (hipsTrack && hips && source.Hips && target.Hips) {
    // The rest position is kept on the bone, so a clip retargeted after another clip has moved the hips still starts
    // from the rest height (userData survives a clone as plain data).
    hips.userData.restPosition ??= hips.position.toArray();
    const ratio = target.Hips.position.y / (source.Hips.position.y || 1), base = v3().fromArray(hips.userData.restPosition), restY = source.Hips.position.y / entry.armatureScale;
    const values = new Float32Array(hipsTrack.times.length * 3);
    hipsTrack.times.forEach((_, k) => { values[k * 3] = base.x; values[k * 3 + 1] = base.y + (hipsTrack.values[k * 3 + 1] - restY) * ratio; values[k * 3 + 2] = base.z; });
    tracks.push(new THREE.VectorKeyframeTrack(`Hips.position`, hipsTrack.times, values));
  }
  return new THREE.AnimationClip(name, times[times.length - 1] || 1, tracks);
}

// The SkinnedMesh of a loaded hero scene.
export const skinnedMeshOf = root => { let found = null; root.traverse(o => { if (!found && o.isSkinnedMesh) found = o; }); return found; };
