// js/story/cast/lod.js : actor level of detail (design 3.7, D4). Per actor, by distance to the camera:
// - the outline hull goes beyond 25 m (12 m on Q1 and Q0; 12 m for crowd actors and for the arena Gabe,
//   whose hull is 31k triangles)
// - the mixer steps at 15 Hz beyond 30 m (10 Hz for crowd actors beyond 12 m)
// - the body hides beyond 120 m
// - story bodies frustum-cull with a padded bounding sphere (arena actors keep their own settings)
// - past the tier's budget of full actors (10 / 6 / 4), the farthest also lose their hull and step at 10 Hz
// - on Q1 and Q0 the heavy GLB bodies (over 8k triangles) draw no hull at all
// - a heavy body (a GLB of 8k triangles or more, not the hero's) draws a coarse copy of its mesh beyond
//   the tier's body distance (5 / 8 / 14 m), or beyond 3.5 m when past the nearest 2 / 2 / 4 heavy bodies
//   or the budget of full actors: the same skinned vertices,
//   about a third of the triangles (a fight's five gang bodies cost 78k triangles in full)
// It also runs each actor's update at its rate, so the 'anim' phase calls lod.step(actor, dt).
import * as THREE from 'three';

export const LOD = Object.freeze({ hull: 25, hullLow: 12, hullCrowd: 12, hullArena: 12, slow: 30, slowHz: 15, crowdHz: 10, crowdNear: 12, hide: 120, budget: [4, 6, 10], body: [5, 8, 14], bodyFull: [2, 2, 4], bodyMin: 3.5, bodyK: 0.34 });

// A coarse index for a mesh: vertex clustering on a grid (split by the normal's main direction, so the two
// faces of a thin part stay apart), sized so about k of the triangles remain. Every vertex is kept, so the
// skin, the uvs and the morphs still apply; only the index changes. Cached on the geometry.
export function coarseGeometry(g, k = LOD.bodyK) {
  if (g.userData.coarse) return g.userData.coarse;
  const P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const idx = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i);
  const tris = idx.length / 3, want = Math.max(1, Math.round(tris * k));
  g.computeBoundingBox();
  const bb = g.boundingBox, span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n), dir = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = P.getX(i) - bb.min.x; py[i] = P.getY(i) - bb.min.y; pz[i] = P.getZ(i) - bb.min.z;
    if (N) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z); dir[i] = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5); }
  }
  const build = (cells) => {
    const c = span / cells, rep = new Int32Array(n), seen = new Map();
    for (let i = 0; i < n; i++) {
      const key = ((Math.floor(px[i] / c) * 4096 + Math.floor(py[i] / c)) * 4096 + Math.floor(pz[i] / c)) * 6 + dir[i];
      const r = seen.get(key);
      if (r === undefined) { seen.set(key, i); rep[i] = i; } else rep[i] = r;
    }
    const out = [], faces = new Set();
    for (let t = 0; t < idx.length; t += 3) {
      const a = rep[idx[t]], b = rep[idx[t + 1]], d = rep[idx[t + 2]];
      if (a === b || b === d || a === d) continue;
      const lo = Math.min(a, b, d), hi = Math.max(a, b, d), key = lo * 1e7 + hi * 7 + (a + b + d - lo - hi) % 7;
      if (faces.has(key)) continue;
      faces.add(key); out.push(a, b, d);
    }
    return out;
  };
  // the grid that lands nearest the wanted count (a few tries, coarse to fine)
  let lo = 8, hi = 400, best = null;
  for (let it = 0; it < 9; it++) {
    const mid = Math.round((lo + hi) / 2), out = build(mid), m = out.length / 3;
    if (!best || Math.abs(m - want) < Math.abs(best.length / 3 - want)) best = out;
    if (m > want) hi = mid; else lo = mid;
    if (hi - lo <= 1) break;
  }
  // (the attributes are shared with the full geometry, not copied)
  const c = new THREE.BufferGeometry();
  for (const [name, at] of Object.entries(g.attributes)) c.setAttribute(name, at);
  c.morphAttributes = g.morphAttributes; c.morphTargetsRelative = g.morphTargetsRelative;
  c.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(best, 1) : new THREE.Uint16BufferAttribute(best, 1));
  if (g.boundingBox) c.boundingBox = g.boundingBox.clone();
  if (g.boundingSphere) c.boundingSphere = g.boundingSphere.clone();
  c.userData = { ...g.userData, coarseOf: g };
  delete c.userData.coarse;
  g.userData.coarse = c;
  return c;
}

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
    const qi = Math.max(0, Math.min(2, q));
    let heavyN = 0;
    vis.forEach((e, i) => {
      const a = e.a, over = e.kind !== 'arena' && i >= budget;
      const lim = e.kind === 'crowd' ? LOD.hullCrowd : e.kind === 'arena' ? LOD.hullArena : hullFar;
      // on Q1 and Q0 a heavy body (a wild crew GLB, 12k triangles, whose hull costs as much again) keeps
      // only the post pass's ink edges: the hull would double the phone's biggest actor cost
      const heavyOff = q < 2 && a.heavy && e.kind !== 'arena';
      setHull(a, !over && !heavyOff && e.d <= lim);
      if (a.heavy && e.kind !== 'arena' && !(S.hero && S.hero.actor === a)) {
        const near = LOD.body[qi], full = heavyN++ < LOD.bodyFull[qi];
        setCoarse(a, (over || !full) && e.d > LOD.bodyMin || e.d > (a.coarseOn ? near : near + 1));
      } else if (a.coarseOn) setCoarse(a, false);
      a.lodHz = over ? LOD.crowdHz : e.kind === 'crowd' ? (e.d > LOD.crowdNear ? LOD.crowdHz : 0) : e.d > LOD.slow ? LOD.slowHz : 0;
    });
    for (const e of list) if (e.a && e.a.lodHidden) setHull(e.a, false);
    return vis.length;
  }
  // the coarse copy of each skinned mesh of the body, or the full one back
  function setCoarse(a, on) {
    if (!!a.coarseOn === on) return;
    a.coarseOn = on;
    a.root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (on) { if (!o.userData.fullGeo) o.userData.fullGeo = o.geometry; o.geometry = coarseGeometry(o.userData.fullGeo); }
      else if (o.userData.fullGeo) o.geometry = o.userData.fullGeo;
    });
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
  function restore(a) { setCoarse(a, false); setHull(a, true); a.hullOn = undefined; a.lodHz = 0; a.lodAcc = 0; if (a.lodHidden && a.model) a.model.visible = true; a.lodHidden = false; }
  return { update, step, setHull, setCoarse, restore, hullsOf };
}
