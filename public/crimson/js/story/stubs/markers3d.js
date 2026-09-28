// Stub MARKERS3D (frozen; the missions package replaces missions/markers3d.js, not this file).
// The objective marker in the world: a ground ring and a tall pillar. (The real one is crimson and keyed.)
export function createMarkers3D(S) {
  const { THREE } = S;
  const ringGeo = new THREE.RingGeometry(0.88, 1, 48), pillarGeo = new THREE.CylinderGeometry(0.6, 0.6, 1, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xd2263f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const byId = new Map(), list = [];
  const api = {
    list,
    add(id, o) {
      api.remove(id);
      const g = new THREE.Group(), r = o.r || 4, y = o.y ?? S.world.surface(o.x, o.z);
      if (o.kind !== 'pillar') { const ring = new THREE.Mesh(ringGeo, mat); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(r); ring.position.y = 0.06; g.add(ring); }
      if (o.kind !== 'ring') { const p = new THREE.Mesh(pillarGeo, mat); p.scale.set(1, 60, 1); p.position.y = 30; g.add(p); }
      g.position.set(o.x, y, o.z); g.name = `marker:${id}`;
      (S.world.group || S.scene).add(g);
      const m = { id, ...o, obj: g }; byId.set(id, m); list.push(m);
      return m;
    },
    remove(id) { const m = byId.get(id); if (!m) return; m.obj.removeFromParent(); byId.delete(id); list.splice(list.indexOf(m), 1); },
    clear() { for (const id of [...byId.keys()]) api.remove(id); },
  };
  return api;
}
