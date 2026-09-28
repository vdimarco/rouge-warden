// STUB: cityview (replaced by the view agent)
// A bare city view with the exact API of spec §9: every Box collider as a plain box (merged in batches,
// MeshLambertMaterial, vertex colours), a ground plane, the water, and fog in the sunset colour.
import * as THREE from "three";
import { COLORS, PERF, SUN_DIR } from "./config.js";

const BATCH = 120; // boxes per merged mesh (and per build step)
const MAX_STEPS = 3; // hard cap per build() call: performance.now() stands still under a paused test clock

const KIND_COLOR = { building: 0xb8a58c, needle: 0xd8d0c4, dome: 0x9fb3bf, expressway: 0x8a8378, prop: 0x9a8f80 };

export function createCityView(renderer, scene, city, opts = {}) {
  const root = new THREE.Group();
  root.name = "cityview";
  scene.add(root);
  scene.fog = new THREE.Fog(COLORS.fog, PERF.fogNear, PERF.fogFar);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x5a4a60, 1.6);
  const sun = new THREE.DirectionalLight(0xffd0a0, 2.2);
  sun.position.set(SUN_DIR.x * 100, SUN_DIR.y * 100, SUN_DIR.z * 100);
  root.add(hemi, sun);

  // the ground stops at the shore; the water sits a little lower so the two never fight
  const B = city.bounds;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(B.maxX - B.minX + 400, city.shoreZ - B.minZ + 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6a5a58 }));
  ground.position.set((B.minX + B.maxX) / 2, 0, (B.minZ - 200 + city.shoreZ) / 2);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: COLORS.water }));
  water.position.set(0, PERF.waterY, city.shoreZ + 2000);
  root.add(ground, water);

  const boxes = city.colliders.filter((c) => c.type === "box");
  const meshes = [];
  const col = new THREE.Color();
  let next = 0, tris = 4;

  function buildBatch() {
    const list = boxes.slice(next, next + BATCH);
    next += list.length;
    const n = list.length, pos = new Float32Array(n * 24 * 3), nor = new Float32Array(n * 24 * 3), clr = new Float32Array(n * 24 * 3), idx = new Uint32Array(n * 36);
    const tmp = new THREE.BoxGeometry(1, 1, 1);
    const tp = tmp.attributes.position.array, tn = tmp.attributes.normal.array, ti = tmp.index.array;
    list.forEach((b, k) => {
      const sx = b.maxX - b.minX, sy = b.maxY - b.minY, sz = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, cz = (b.minZ + b.maxZ) / 2;
      col.setHex(KIND_COLOR[b.tag] || 0xb0a090);
      const shade = 0.85 + 0.3 * (((b.id * 2654435761) >>> 0) / 4294967296);
      for (let v = 0; v < 24; v++) {
        const o = (k * 24 + v) * 3;
        pos[o] = cx + tp[v * 3] * sx; pos[o + 1] = cy + tp[v * 3 + 1] * sy; pos[o + 2] = cz + tp[v * 3 + 2] * sz;
        nor[o] = tn[v * 3]; nor[o + 1] = tn[v * 3 + 1]; nor[o + 2] = tn[v * 3 + 2];
        clr[o] = col.r * shade; clr[o + 1] = col.g * shade; clr[o + 2] = col.b * shade;
      }
      for (let i = 0; i < 36; i++) idx[k * 36 + i] = ti[i] + k * 24;
    });
    tmp.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(clr, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    root.add(m);
    meshes.push(m);
    tris += n * 12;
  }

  const V = {
    root,
    progress: 0,
    info: { meshes: 2, tris },
    // Builds a few batches per call within the budget. Returns true once everything is built.
    build(budgetMs = PERF.buildBudgetMs) {
      const t0 = performance.now();
      for (let s = 0; s < MAX_STEPS && next < boxes.length; s++) {
        buildBatch();
        if (performance.now() - t0 > budgetMs) break;
      }
      V.progress = boxes.length ? next / boxes.length : 1;
      V.info.meshes = meshes.length + 2; V.info.tris = tris;
      return next >= boxes.length;
    },
    update() {},
    setDistrictClog() {}, setKing() {}, setFinale() {},
    stencil(ref) {
      for (const m of [mat, ground.material, water.material]) {
        if (ref == null) { m.stencilWrite = false; continue; }
        m.stencilWrite = true; m.stencilRef = ref; m.stencilFunc = THREE.EqualStencilFunc;
        m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
      }
    },
    warm(r, camera) { r.compile(scene, camera); },
    makeDiorama(size = 1) {
      const g = new THREE.Group();
      const s = size / Math.max(B.maxX - B.minX, B.maxZ - B.minZ);
      const dm = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      for (const m of meshes) { const c = new THREE.Mesh(m.geometry, dm); c.matrixAutoUpdate = false; g.add(c); }
      g.scale.setScalar(s);
      g.position.set(-((B.minX + B.maxX) / 2) * s, 0, -((B.minZ + B.maxZ) / 2) * s);
      const holder = new THREE.Group();
      holder.add(g);
      return holder;
    },
    skyColorAt() { return new THREE.Color(COLORS.fog); },
  };
  return V;
}
