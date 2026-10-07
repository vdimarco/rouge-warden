// In Full Swing: what the city action draws. The cars you can drive (three models made with Higgsfield image-to-3D, see
// models/cars/CREDITS.md, each an instanced mesh with its ink hull; a box-built car stands in until they load or if they fail),
// the job markers (a
// light beam and a ground ring per marker, coloured by job, and a gold beam over the running job's goal), and the balloon of the
// balloon chase. The people of the jobs and the Sludge Gang are figures (streetview.js createFigures).
import * as THREE from "three";
import { toonify, outlineOf } from "./comic.js";
import { CAR, trafficAt } from "./cars.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// marker colours (linear, a little over 1 so the bloom picks them out)
const JOB_COL = { catch: [2.2, 0.5, 0.4], washer: [0.4, 1.4, 2.4], pizza: [2.4, 1.3, 0.3], balloon: [2.3, 0.4, 1.6], brawl: [0.7, 2.2, 0.4], taxi: [2.5, 2.2, 0.2], thief: [1.6, 0.5, 2.4], sludge: [0.9, 2.4, 0.4], goal: [2.6, 2.0, 0.4],
  mugging: [2.6, 0.3, 0.3], getaway: [2.6, 0.3, 0.3], tanker: [2.6, 0.3, 0.3] }; // a crime: red
const MAX_MARK = 8;
const CAR_REACH = 90; // cars drawn within this of the camera
// The nearest MODEL_N cars show their model (2,500 triangles, and a 600-triangle hull for its ink); the others the built-in box car. Job cars and
// street cars share these slots by distance, so the cost stays the same in a jam. The street traffic (cityview.js, up to 1,800
// shader cars in one draw) keeps its simple body; a street car within TRAFFIC_REACH m that gets a slot has its shader car hidden.
const MODEL_N = 4, MODEL_REACH = CAR_REACH, TRAFFIC_REACH = 40;

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

export function createActionView(scene, { cars, jobs, traffic = null }) {
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
        // the body, and the coarse hull its ink outline is drawn from (pack-car.mjs, texture size 0)
        const [body, hull] = await Promise.all([m.src, m.src + "-ink"].map(async (file) => {
          const gltf = await loader.loadAsync("models/cars/" + file + ".glb");
          let src = null;
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
          if (!src) throw new Error(file + ": no mesh");
          const g = src.geometry.clone();
          // quantized attributes (KHR_mesh_quantization: normalized integers) to floats first, or the resize below would clamp them
          for (const k of Object.keys(g.attributes)) {
            const at = g.attributes[k];
            if (at.array instanceof Float32Array) continue;
            const f = new Float32Array(at.count * at.itemSize);
            const get = [at.getX, at.getY, at.getZ, at.getW];
            for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = get[c].call(at, i);
            g.setAttribute(k, new THREE.BufferAttribute(f, at.itemSize));
          }
          g.applyMatrix4(src.matrixWorld);
          return { g, src };
        }));
        const g = body.g, src = body.src;
        g.computeBoundingBox();
        const b = g.boundingBox, len = b.max.z - b.min.z, wid = b.max.x - b.min.x;
        const k2 = Math.min(m.len / len, (CAR.half.w * 2 + 0.2) / wid);
        // the hull is moved as the body is, so the two stay together
        for (const x of [g, hull.g]) {
          x.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
          x.scale(k2, k2, k2);
          x.rotateY(Math.PI);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        const map = src.material.map || null;
        if (map) { map.colorSpace = THREE.NoColorSpace; map.anisotropy = 4; }
        const mat = toonify(new THREE.MeshLambertMaterial({ map, color: 0xffffff }), { dots: 0 });
        const im = new THREE.InstancedMesh(g, mat, cars.cars.length + MODEL_N);
        // culled as a whole by a sphere round its instances (set in update), and its ink with it, so a view away from the cars skips them
        im.name = "car-" + m.src; im.count = 0; im.boundingSphere = new THREE.Sphere();
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((cars.cars.length + MODEL_N) * 3), 3);
        const ink = outlineOf(im, { width: 0.03, geometry: hull.g });
        ink.boundingSphere = im.boundingSphere;
        im.add(ink);
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
  // The nearest street cars as models: pick them (lanes on the ground, so not the expressway nor a stolen car, clear of their
  // lane's ends, where the shader shrinks them), veil their shader cars, draw the models where trafficAt puts them, and give back the ones
  // that lose their slot. The model is picked by the index, as for the parked cars.
  const promoted = new Set(), pick = [], TQ = {}, slots = [], keep = new Set(), BOX = new THREE.Box3();
  // the street cars within TRAFFIC_REACH, into pick as index, distance² pairs
  function streetNear(cam, time) {
    pick.length = 0;
    const T = traffic && traffic.cars();
    if (!T || !cam) return T;
    const L = T.lane, Mv = T.move, R = TRAFFIC_REACH;
    for (let i = 0; i < T.n; i++) {
      const o = i * 4, y = L[o + 1];
      if (Math.abs(y) > 1 || !(Mv[o] > 20)) continue; // the expressway, and a stolen car's sunken lane (it is a real car now)
      const alongX = L[o + 3] < 1.5;
      if (Math.abs(alongX ? cam.z - L[o + 2] : cam.x - L[o]) > R) continue;
      trafficAt(T, i, time, TQ);
      if (TQ.s < 8 || TQ.len - TQ.s < 8) continue;
      const d = (TQ.x - cam.x) ** 2 + (TQ.z - cam.z) ** 2;
      if (d < R * R) pick.push(i, d);
    }
    return T;
  }
  function streetModels(T, time) {
    for (const i of promoted) if (!keep.has(i)) { traffic.hide(i, false); promoted.delete(i); }
    for (const i of keep) {
      if (!promoted.has(i)) { traffic.hide(i, true); promoted.add(i); }
      trafficAt(T, i, time, TQ);
      Q.setFromAxisAngle(UP, TQ.yaw);
      M.compose(Pv.set(TQ.x, 0, TQ.z), Q, S1);
      const k = i % models.length, im = models[k], n = counts[k]++;
      im.setMatrixAt(n, M); im.instanceColor.setXYZ(n, TQ.paint[0], TQ.paint[1], TQ.paint[2]);
    }
  }
  const V = {
    root,
    update(dt, time, opts = {}) {
      if (!opts.cam && promoted.size && traffic) { for (const i of promoted) traffic.hide(i, false); promoted.clear(); }
      beamMat.uniforms.uTime.value = time;
      // cars: into their model's mesh (or the built-in box car)
      let n = 0;
      counts[0] = counts[1] = counts[2] = 0;
      const cam = opts.cam, R2 = CAR_REACH * CAR_REACH;
      // the nearest MODEL_N cars, job cars and street cars together (the one you drive first), show their model
      near.length = 0; slots.length = 0; keep.clear();
      const T = modelsOk && cam ? streetNear(cam, time) : null;
      for (const c of cars.cars) if (c.on && (c === cars.driving || !cam || (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 < MODEL_REACH * MODEL_REACH))
        slots.push({ c, d: !cam || c === cars.driving ? -1 : (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 });
      for (let k = 0; k < pick.length; k += 2) slots.push({ i: pick[k], d: pick[k + 1] });
      slots.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(MODEL_N, slots.length); k++) if (slots[k].c) near.push(slots[k].c); else keep.add(slots[k].i);
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
      if (modelsOk && traffic) streetModels(T, time);
      if (modelsOk) for (let k = 0; k < models.length; k++) {
        const im = models[k];
        im.count = counts[k]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
        BOX.makeEmpty();
        for (let i = 0; i < im.count; i++) BOX.expandByPoint(Pv.fromArray(im.instanceMatrix.array, i * 16 + 12));
        if (im.count) BOX.getBoundingSphere(im.boundingSphere).radius += 4; // half a van and its ink
        else im.boundingSphere.set(Pv.set(0, -1e4, 0), 0);
      }
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
    info: () => ({ cars: counts.reduce((a, b) => a + b, 0) + carMesh.count, modelCars: modelsOk ? counts.reduce((a, b) => a + b, 0) : 0, models: modelsOk ? MODELS.map((m) => m.src) : null, streetModels: promoted.size, markers: beams.count, balloon: balloon.visible }),
  };
  return V;
}
