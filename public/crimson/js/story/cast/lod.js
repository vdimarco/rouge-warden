// js/story/cast/lod.js : actor level of detail (design 3.7, D4). Per actor, by distance to the camera:
// - the outline hull goes beyond 25 m (12 m on Q1 and Q0; 12 m for crowd actors and for the arena Gabe,
//   whose hull is 31k triangles)
// - the mixer steps at 15 Hz beyond 30 m (10 Hz for crowd actors beyond 12 m)
// - the body hides beyond 120 m
// - story bodies frustum-cull with a padded bounding sphere (arena actors keep their own settings)
// - past the tier's budget of full actors (10 / 6 / 4), the farthest also lose their hull and step at 10 Hz
// - on Q1 and Q0 the heavy GLB bodies (over 8k triangles) draw no hull at all
// It also runs each actor's update at its rate, so the 'anim' phase calls lod.step(actor, dt).
import * as THREE from 'three';

export const LOD = Object.freeze({ hull: 25, hullLow: 12, hullCrowd: 12, hullArena: 12, slow: 30, slowHz: 15, crowdHz: 10, crowdNear: 12, hide: 120, budget: [4, 6, 10] });

// padded bounding spheres for a story body's skinned meshes (mesh space), so culling never clips a limb
export function padBounds(a, pad = 1.6) {
  a.root.updateMatrixWorld(true);
  a.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    // the skinned result's own space (a quantized mesh keeps its vertices in [-1, 1], so the geometry's
    // sphere would be wrong): measured once per geometry through the bones, then shared by every clone
    const g = o.geometry;
    if (!g.userData.castSphere) { o.computeBoundingSphere(); g.userData.castSphere = o.boundingSphere.clone(); g.userData.castSphere.radius *= pad; }
    o.boundingSphere = g.userData.castSphere.clone();
    o.frustumCulled = true;
  });
}

export function createLod(S) {
  const tmp = new THREE.Vector3();
  // actors: [{a, kind: 'story' | 'crowd' | 'arena'}]; returns the per-frame decisions for QA
  function update(list, camPos) {
    const q = S.q ?? 2, hullFar = q >= 2 ? LOD.hull : LOD.hullLow, budget = LOD.budget[Math.max(0, Math.min(2, q))];
    const vis = [];
    for (const e of list) {
      const a = e.a; if (!a || !a.root) continue;
      a.root.getWorldPosition(tmp);
      const d = tmp.distanceTo(camPos);
      e.d = d;
      if (e.kind !== 'arena') {
        const far = d > LOD.hide;
        if (a.lodHidden !== far) { a.lodHidden = far; if (a.model) a.model.visible = !far; }
      }
      if (!a.lodHidden && a.root.visible) vis.push(e);
    }
    vis.sort((x, y) => x.d - y.d);
    vis.forEach((e, i) => {
      const a = e.a, over = e.kind !== 'arena' && i >= budget;
      const lim = e.kind === 'crowd' ? LOD.hullCrowd : e.kind === 'arena' ? LOD.hullArena : hullFar;
      // on Q1 and Q0 a heavy body (a wild crew GLB, 12k triangles, whose hull costs as much again) keeps
      // only the post pass's ink edges: the hull would double the phone's biggest actor cost
      const heavyOff = q < 2 && a.heavy && e.kind !== 'arena';
      setHull(a, !over && !heavyOff && e.d <= lim);
      a.lodHz = over ? LOD.crowdHz : e.kind === 'crowd' ? (e.d > LOD.crowdNear ? LOD.crowdHz : 0) : e.d > LOD.slow ? LOD.slowHz : 0;
    });
    for (const e of list) if (e.a && e.a.lodHidden) setHull(e.a, false);
    return vis.length;
  }
  function setHull(a, on) {
    if (a.hullOn === on) return;
    a.hullOn = on;
    for (const h of hullsOf(a)) h.visible = on;
  }
  function hullsOf(a) {
    if (a.hulls) return a.hulls;
    const out = [];
    a.root.traverse((o) => { if (o.isMesh && o.material && o.material.side === THREE.BackSide && o.material.isMeshBasicMaterial) out.push(o); });
    return (a.hulls = out);
  }
  // step an actor at its LOD rate (0 = every frame)
  function step(a, dt) {
    if (a.lodHidden) { a.lodAcc = (a.lodAcc || 0) + dt; return; } // caught up when it shows again (clip time stays right)
    if (!a.lodHz) { const acc = a.lodAcc || 0; a.lodAcc = 0; a.update(dt + acc); return; }
    a.lodAcc = (a.lodAcc || 0) + dt;
    if (a.lodAcc >= 1 / a.lodHz) { a.update(a.lodAcc); a.lodAcc = 0; }
  }
  // put an arena actor back as the arena expects: hull on, full rate
  function restore(a) { setHull(a, true); a.hullOn = undefined; a.lodHz = 0; a.lodAcc = 0; if (a.lodHidden && a.model) a.model.visible = true; a.lodHidden = false; }
  return { update, step, setHull, restore, hullsOf };
}
