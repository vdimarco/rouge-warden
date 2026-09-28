// STUB: rope (replaced by the swing agent)
// Bare ropes with the exact API of spec §8: aim is city.raycast only (no cone, no special targets), a small
// reticle per hand, and a straight line from each muzzle to its cup.
import * as THREE from "three";
import { SWING, COLORS } from "./config.js";

export function createRopes(scene, city, settings) {
  let mode = "all";
  const range = SWING.ropeRange * SWING.rangeGrace;
  const targets = new Map();
  const validFns = [];
  const HIT = [{}, {}];
  const res = [0, 1].map(() => ({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, tag: "", id: null, dist: 0, valid: false }));
  const wasValid = [false, false];

  // one line segment per rope, both in one draw
  const pos = new Float32Array(4 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLORS.rope }));
  lines.frustumCulled = false;
  scene.add(lines);
  const reticles = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    m.visible = false;
    scene.add(m);
    return m;
  });
  let visible = true;

  const R = {
    aim(side, origin, dir, vel) {
      const ret = reticles[side];
      if (mode === "special") { ret.visible = false; wasValid[side] = false; return null; }
      const h = city.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range * 1.5, HIT[side]);
      if (!h) { ret.visible = false; wasValid[side] = false; return null; }
      const r = res[side];
      r.x = h.x; r.y = h.y; r.z = h.z; r.nx = h.nx; r.ny = h.ny; r.nz = h.nz;
      r.tag = h.collider.tag; r.id = h.collider.id; r.dist = h.t; r.valid = h.t <= range;
      // a constant 1.5° on screen, filled when in range
      ret.visible = visible;
      ret.position.set(h.x, h.y, h.z);
      ret.scale.setScalar(Math.max(0.02, h.t * Math.tan((0.75 * Math.PI) / 180)));
      ret.material.wireframe = !r.valid;
      if (r.valid && !wasValid[side]) for (const f of validFns) f(side, r);
      wasValid[side] = r.valid;
      return r;
    },
    onValid: (fn) => validFns.push(fn),
    setMode(m) { mode = m === "special" ? "special" : "all"; if (mode === "special") for (const r of reticles) r.visible = false; },
    addTarget(t) { targets.set(t.id, t); },
    removeTarget(id) { targets.delete(id); },
    dryFire() {},
    update(dt, P, tips) {
      let n = 0;
      for (let i = 0; i < 2; i++) {
        const r = P.ropes[i];
        if (r.state === "idle") continue;
        if (r.state !== "idle") reticles[i].visible = false;
        const t = tips[i], k = r.state === "flying" && r.flyDur > 0 ? Math.min(1, r.flyT / r.flyDur) : 1;
        pos[n * 6] = t.x; pos[n * 6 + 1] = t.y; pos[n * 6 + 2] = t.z;
        pos[n * 6 + 3] = r.from.x + (r.anchor.x - r.from.x) * k; pos[n * 6 + 4] = r.from.y + (r.anchor.y - r.from.y) * k; pos[n * 6 + 5] = r.from.z + (r.anchor.z - r.from.z) * k;
        n++;
      }
      geo.setDrawRange(0, n * 2);
      geo.attributes.position.needsUpdate = true;
      lines.visible = visible && n > 0;
    },
    setVisible(v) { visible = !!v; lines.visible = visible; if (!visible) for (const r of reticles) r.visible = false; },
    setStyle() {},
  };
  return R;
}
