// js/story/world/bridge.js : Midgley Bridge, a steel deck arch over Wilson Canyon (two ribbed arches, 22
// spandrel posts, the deck, rails, abutments and approach piers), and the three small creek bridges. Each
// deck is a walk:true box (the Midgley deck's top is y 62) and each rail a segment collider.
// bridgeSilhouette() returns a low-poly near-black copy for far views in world scenes.
import { Geo } from './town.js';

const STEEL = [0.44, 0.47, 0.48], CONCRETE = [0.62, 0.6, 0.56], DECK = [0.5, 0.49, 0.47], RAIL = [0.7, 0.7, 0.68];

// Midgley in its own frame: u along the deck from the south end (0) to the north end (L), v across, y up
function midgleyGeo(THREE, L, deckY, groundAt, lod = 0) {
  const g = new Geo();
  const span0 = 16, span1 = L - 16, crown = deckY - 1.6, spring = deckY - 27, half = (span1 - span0) / 2, mid = (span0 + span1) / 2;
  const archY = (u) => crown - (crown - spring) * Math.pow((u - mid) / half, 2);
  const sides = lod ? 4 : 7;
  // the deck slab, its edge girders and the road surface
  g.box(L / 2, deckY - 1.25, 0, 9.2, 1.25, L, Math.PI / 2, DECK, { top: [0.3, 0.3, 0.31] });
  for (const v of [-4.1, 4.1]) g.box(L / 2, deckY - 2.1, v, 0.5, 0.9, L, Math.PI / 2, STEEL);
  // two arch ribs, each two chords tied by struts
  for (const v of [-3.2, 3.2]) {
    const n = lod ? 12 : 24;
    for (const dy of [0, 1.8]) for (let k = 0; k < n; k++) {
      const u0 = span0 + (span1 - span0) * k / n, u1 = span0 + (span1 - span0) * (k + 1) / n;
      g.cyl([u0, archY(u0) + dy, v], [u1, archY(u1) + dy, v], 0.42, 0.42, sides, STEEL);
      if (!lod && k % 2 === 0) g.cyl([u0, archY(u0), v], [u1, archY(u1) + 1.8, v], 0.14, 0.14, 4, STEEL);
    }
    // 11 spandrel posts a side (22 in all) from the arch up to the deck
    for (let k = 1; k <= 11; k++) { const u = span0 + (span1 - span0) * k / 12, y = archY(u) + 1.8; if (deckY - 2.5 - y > 0.3) g.cyl([u, y, v], [u, deckY - 2.5, v], 0.26, 0.26, sides, STEEL); }
  }
  // cross bracing between the ribs
  for (let k = 0; k <= 6; k++) { const u = span0 + (span1 - span0) * k / 6; g.cyl([u, archY(u) + 0.9, -3.2], [u, archY(u) + 0.9, 3.2], 0.16, 0.16, 4, STEEL); }
  // abutments and approach piers down to the canyon walls
  for (const u of [span0, span1]) { const gy = groundAt(u, 0); g.box(u, Math.min(gy, spring) - 6, 0, 4, spring - Math.min(gy, spring) + 7, 9.5, Math.PI / 2, CONCRETE); }
  for (const u of [5, L - 5]) { const gy = Math.min(groundAt(u, -3), groundAt(u, 3)); if (deckY - 2.5 - gy > 0.5) for (const v of [-3, 3]) g.cyl([u, gy - 2, v], [u, deckY - 2.5, v], 0.55, 0.55, sides, CONCRETE); }
  // rails: posts every 2.5 m and two rails a side
  for (const v of [-4.45, 4.45]) {
    for (let u = 0; u <= L; u += lod ? 10 : 2.5) g.box(u, deckY, v, 0.12, 1.05, 0.12, 0, RAIL);
    for (const h of [0.55, 1.02]) g.cyl([0, deckY + h, v], [L, deckY + h, v], 0.05, 0.05, 4, RAIL);
  }
  return { geo: g.build(THREE), archY, span0, span1 };
}

export function createBridges(S, { THREE, group, colliders, material, bridges, height }) {
  const root = new THREE.Group(); root.name = 'bridges'; group.add(root);
  const out = [];
  for (const b of bridges) {
    const dx = b.bx - b.ax, dz = b.bz - b.az, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz); // +u runs along (dx, dz)
    // frame: u along the deck, v across (to the left of +u), y up
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const toWorld = (u, v) => [b.ax + s * u - c * v, b.az + c * u + s * v];
    const groundAt = (u, v) => { const [x, z] = toWorld(u, v); return height(x, z); };
    let geo;
    if (b.id === 'midgley') geo = midgleyGeo(THREE, L, b.y, groundAt).geo;
    else {
      // a flat concrete deck on two piers, with rails
      const g = new Geo(), w = b.width + 2;
      g.box(L / 2, b.y - 0.9, 0, w, 0.9, L + 6, Math.PI / 2, CONCRETE, { top: [0.34, 0.33, 0.33] });
      for (const u of [L * 0.33, L * 0.67]) { const gy = Math.min(groundAt(u, -w / 3), groundAt(u, w / 3)); g.box(u, gy - 2, 0, 1.4, b.y - 0.9 - gy + 2, w - 1, Math.PI / 2, CONCRETE); }
      for (const v of [-w / 2 + 0.2, w / 2 - 0.2]) { for (let u = -3; u <= L + 3; u += 2.5) g.box(u, b.y, v, 0.12, 0.95, 0.12, 0, RAIL); g.cyl([-3, b.y + 0.9, v], [L + 3, b.y + 0.9, v], 0.05, 0.05, 4, RAIL); }
      geo = g.build(THREE);
    }
    const m = new THREE.Mesh(geo, material);
    // the geometry is in (u, y, v) with u along +x: turn it so +x runs along the deck
    m.position.set(b.ax, 0, b.az); m.rotation.y = yaw - Math.PI / 2;
    m.castShadow = true; m.receiveShadow = true; m.name = `bridge_${b.id}`; m.userData.kind = 'bridge';
    root.add(m);
    // the deck you drive and walk on, 1 m onto the road at each end, and the rails
    const w = b.id === 'midgley' ? 9.2 : b.width + 2, ext = b.id === 'midgley' ? 1 : 4;
    colliders.addBox({ x: (b.ax + b.bx) / 2, z: (b.az + b.bz) / 2, w, d: L + ext * 2, yaw, y0: b.y - 1.3, top: b.y, walk: true, tag: `deck:${b.id}` });
    for (const v of [-w / 2 + 0.15, w / 2 - 0.15]) {
      const [x0, z0] = toWorld(-ext, v), [x1, z1] = toWorld(L + ext, v);
      colliders.addSegment(x0, z0, x1, z1, { y0: b.y - 0.2, y1: b.y + 1.1, r: 0.12, tag: `rail:${b.id}` });
    }
    out.push({ id: b.id, mesh: m, L, yaw, deckY: b.y, a: [b.ax, b.az], b: [b.bx, b.bz] });
  }
  let silGeo = null;
  return {
    root, list: out,
    // a low-poly near-black Midgley for far views (the caller places it)
    silhouette() {
      const mb = out.find((o) => o.id === 'midgley');
      if (!silGeo) silGeo = midgleyGeo(THREE, mb ? mb.L : 110, 62, () => 30, 1).geo;
      const m = new THREE.Mesh(silGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b0c }));
      m.name = 'bridgeSilhouette';
      return m;
    },
  };
}
