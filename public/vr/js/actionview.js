// In Full Swing: what the city action draws. The cars you can drive (three models made with Higgsfield image-to-3D, see
// models/cars/CREDITS.md, each an instanced mesh with its ink hull; a box-built car stands in until they load or if they fail),
// the job markers (a
// light beam and a ground ring per marker, coloured by job, and a gold beam over the running job's goal), and the balloon of the
// balloon chase. The people of the jobs and the Sludge Gang are figures (streetview.js createFigures).
import * as THREE from "three";
import { toonify, outlineOf } from "./comic.js";
import { CAR } from "./cars.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// marker colours (linear, a little over 1 so the bloom picks them out)
const JOB_COL = { catch: [2.2, 0.5, 0.4], washer: [0.4, 1.4, 2.4], pizza: [2.4, 1.3, 0.3], balloon: [2.3, 0.4, 1.6], brawl: [0.7, 2.2, 0.4], taxi: [2.5, 2.2, 0.2], thief: [1.6, 0.5, 2.4], sludge: [0.9, 2.4, 0.4], goal: [2.6, 2.0, 0.4] };
const MAX_MARK = 8;
const CAR_REACH = 90; // cars drawn within this of the camera
const MODEL_N = 3, MODEL_REACH = 50; // the nearest cars show their model (1,200 to 1,900 triangles, twice with its ink); the rest a box car

function carGeometry() {
  const parts = [], paint = [1, 1, 1], glass = [0.14, 0.17, 0.24], tyre = [0.07, 0.07, 0.08], lamp = [1.6, 1.5, 1.1], tail = [1.4, 0.15, 0.1];
  const box = (w, h, d, x, y, z, c) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(c, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const L = CAR.half.l, W = CAR.half.w;
  box(W * 2, 0.62, L * 2, 0, 0.62, 0, paint); // the body (front is -z)
  box(W * 1.8, 0.5, L * 1.05, 0, 1.18, 0.25, glass); // the cabin glass
  box(W * 1.84, 0.08, L * 1.1, 0, 1.46, 0.25, paint); // the roof
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
    g.rotateZ(Math.PI / 2); g.translate(sx * (W - 0.05), 0.36, sz * (L - 0.75));
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(tyre, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.deleteAttribute("uv");
    parts.push(g);
    box(0.36, 0.16, 0.05, sx * (W - 0.32), 0.72, sz * L, sz < 0 ? lamp : tail); // lamps
  }
  for (const p of parts) p.deleteAttribute("uv");
  return mergeGeometries(parts);
}

export function createActionView(scene, { cars, jobs }) {
  const root = new THREE.Group();
  root.name = "action";
  scene.add(root);

  /* ---- cars ---- */
  const cg = carGeometry();
  const cm = toonify(new THREE.MeshLambertMaterial({ vertexColors: true }), { dots: 0 });
  const carMesh = new THREE.InstancedMesh(cg, cm, cars.cars.length);
  carMesh.name = "cars";
  carMesh.frustumCulled = false;
  carMesh.count = 0;
  carMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cars.cars.length * 3), 3);
  root.add(carMesh);
  carMesh.add(outlineOf(carMesh, { width: 0.03 }));
  // The models: front to -z (they come facing +z), scaled into the game's car (4.4 m long, 2 m wide at most), wheels on the ground.
  // Each parked car keeps a model by its id. The paint tints the near-white body texture.
  const MODELS = [{ src: "muscle", len: 4.5 }, { src: "hatchback", len: 4.0 }, { src: "van", len: 5.0 }];
  const models = [];
  (async () => {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      await Promise.all(MODELS.map(async (m, k) => {
        const gltf = await loader.loadAsync("models/cars/" + m.src + ".glb");
        let src = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
        if (!src) throw new Error(m.src + ": no mesh");
        const g = src.geometry.clone();
        g.applyMatrix4(src.matrixWorld);
        g.computeBoundingBox();
        const b = g.boundingBox, len = b.max.z - b.min.z, wid = b.max.x - b.min.x;
        const k2 = Math.min(m.len / len, (CAR.half.w * 2 + 0.2) / wid);
        g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
        g.scale(k2, k2, k2);
        g.rotateY(Math.PI);
        if (!g.attributes.normal) g.computeVertexNormals();
        const map = src.material.map || null;
        if (map) { map.colorSpace = THREE.NoColorSpace; map.anisotropy = 4; }
        const mat = toonify(new THREE.MeshLambertMaterial({ map, color: 0xffffff }), { dots: 0 });
        const im = new THREE.InstancedMesh(g, mat, cars.cars.length);
        im.name = "car-" + m.src; im.frustumCulled = false; im.count = 0;
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cars.cars.length * 3), 3);
        im.add(outlineOf(im, { width: 0.03 }));
        root.add(im);
        models[k] = im;
      }));
      modelsOk = true;
    } catch (e) {
      console.info("the car models did not load, using the built-in cars:", e && e.message);
      for (const im of models) if (im) { root.remove(im); im.geometry.dispose(); }
      models.length = 0;
    }
  })();
  let modelsOk = false;
  const near = [];
  const counts = [0, 0, 0];

  /* ---- markers: beams and rings ---- */
  const beamGeo = new THREE.CylinderGeometry(0.7, 0.7, 70, 10, 1, true);
  beamGeo.translate(0, 35, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute vec3 aCol; varying vec3 vC; varying float vY; uniform float uTime;
      void main() { vC = aCol; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vY; uniform float uTime;
      void main() { float a = (1.0 - smoothstep(4.0, 70.0, vY)) * (0.55 + 0.15 * sin(uTime * 3.0 - vY * 0.25)); gl_FragColor = vec4(vC * a, a); }`,
  });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, MAX_MARK);
  beams.name = "job-beams";
  beams.frustumCulled = false;
  beams.count = 0;
  const bCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARK * 3), 3);
  beamGeo.setAttribute("aCol", bCol);
  root.add(beams);
  const ringGeo = new THREE.RingGeometry(3.6, 4.5, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = beamMat.clone();
  ringMat.vertexShader = beamMat.vertexShader; ringMat.uniforms = beamMat.uniforms;
  ringMat.fragmentShader = `varying vec3 vC; uniform float uTime; void main() { gl_FragColor = vec4(vC * (0.7 + 0.3 * sin(uTime * 4.0)), 1.0); }`;
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, MAX_MARK);
  rings.name = "job-rings";
  rings.frustumCulled = false;
  rings.count = 0;
  ringGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARK * 3), 3));
  root.add(rings);

  /* ---- the balloon ---- */
  const balloon = new THREE.Group();
  const bm = toonify(new THREE.MeshLambertMaterial({ color: 0xe0283c }), { dots: 0 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), bm);
  ball.scale.set(1, 1.2, 1);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0x140a18 }));
  str.position.y = -1.2;
  balloon.add(ball, str);
  ball.add(outlineOf(ball, { width: 0.02 }));
  balloon.visible = false;
  root.add(balloon);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Pv = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  const V = {
    root,
    update(dt, time, opts = {}) {
      beamMat.uniforms.uTime.value = time;
      // cars: into their model's mesh (or the built-in box car)
      let n = 0;
      counts[0] = counts[1] = counts[2] = 0;
      const cam = opts.cam, R2 = CAR_REACH * CAR_REACH;
      // the nearest MODEL_N cars within MODEL_REACH (and the one you drive) show their model; the others the built-in box car
      near.length = 0;
      for (const c of cars.cars) if (c.on && (c === cars.driving || !cam || (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 < MODEL_REACH * MODEL_REACH)) near.push(c);
      if (cam) near.sort((a, b) => (a === cars.driving ? -1 : b === cars.driving ? 1 : (a.x - cam.x) ** 2 + (a.z - cam.z) ** 2 - (b.x - cam.x) ** 2 - (b.z - cam.z) ** 2));
      near.length = Math.min(near.length, MODEL_N);
      let nb = 0;
      for (const c of cars.cars) {
        if (!c.on) continue;
        if (cam && (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 > R2 && c !== cars.driving) continue; // far cars are not drawn
        Q.setFromAxisAngle(UP, c.yaw);
        M.compose(Pv.set(c.x, c.y, c.z), Q, S1);
        if (modelsOk && near.includes(c)) {
          const k = c.id % models.length, im = models[k], i = counts[k]++;
          im.setMatrixAt(i, M); im.instanceColor.setXYZ(i, c.paint[0], c.paint[1], c.paint[2]);
        } else {
          carMesh.setMatrixAt(nb, M);
          carMesh.instanceColor.setXYZ(nb, c.paint[0], c.paint[1], c.paint[2]);
          nb++;
        }
        n++;
      }
      if (modelsOk) for (let k = 0; k < models.length; k++) { const im = models[k]; im.count = counts[k]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
      carMesh.count = nb; carMesh.visible = nb > 0; carMesh.instanceMatrix.needsUpdate = true; carMesh.instanceColor.needsUpdate = true;
      // markers: the offers, or the running job's goal
      let m = 0;
      const put = (x, y, z, col) => {
        if (m >= MAX_MARK) return;
        M.makeTranslation(x, y + 0.05, z);
        beams.setMatrixAt(m, M); rings.setMatrixAt(m, M);
        bCol.setXYZ(m, col[0], col[1], col[2]); rings.geometry.attributes.aCol.setXYZ(m, col[0], col[1], col[2]);
        m++;
      };
      if (opts.markers !== false) {
        if (!jobs.active) for (const o of jobs.offers) put(o.x, o.y, o.z, JOB_COL[o.type] || JOB_COL.goal);
        else if (jobs.card && jobs.card.goal) { const g = jobs.card.goal; put(g.x, g.y, g.z, JOB_COL.goal); }
      }
      beams.count = rings.count = m;
      beams.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = true;
      bCol.needsUpdate = true; rings.geometry.attributes.aCol.needsUpdate = true;
      // the balloon
      const b = jobs.balloons && jobs.balloons[0];
      balloon.visible = !!b;
      if (b) { balloon.position.set(b.x, b.y, b.z); balloon.rotation.z = Math.sin(time * 1.7) * 0.15; }
    },
    setVisible(v) { root.visible = !!v; },
    info: () => ({ cars: counts.reduce((a, b) => a + b, 0) + carMesh.count, modelCars: modelsOk ? counts.reduce((a, b) => a + b, 0) : 0, models: modelsOk ? MODELS.map((m) => m.src) : null, markers: beams.count, balloon: balloon.visible }),
  };
  return V;
}
