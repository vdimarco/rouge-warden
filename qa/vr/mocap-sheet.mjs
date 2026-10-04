// Contact sheets for the baked locomotion (public/vr/anim/locomotion.json) on crew5.glb: per clip, 12 evenly spaced moments of one
// cycle from the side (the floor's ticks scroll back at the clip's speed; a red dot marks a planted foot) and from the chase camera's
// direction (zoomed in). The pose is written the way hero.js writes it (setBone, the hips offset). It also measures, from the posed
// bones, each foot's world speed while planted.
// Run from the repo root: NODE_PATH=<playwright> node qa/vr/mocap-sheet.mjs [out.png] [all | clip,clip] [tile px] [moments] [close]
import { writeFile, readFile } from "fs/promises";
import { newPage, serve, close, checker, watchdog } from "./lib.mjs";

const OUT = process.argv[2] || "mocap-sheet.png";
const ONLY = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : null;
const TILE = +(process.argv[4] || 150), COLS = +(process.argv[5] || 12), CLOSE = process.argv[6] === "close"; // bigger tiles, fewer moments, the arms
const { check, done } = checker("mocap-sheet");
watchdog(1500000, "mocap-sheet");

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"./lib/three.module.min.js","three/addons/":"./lib/addons/"}}</script>
<style>body{margin:0;background:#fff}</style></head><body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
window.sheet = async function (only, W = 150, COLS = 12, close = false) {
  const anim = await (await fetch("anim/locomotion.json", { cache: "no-store" })).json();
  const gltf = await new GLTFLoader().loadAsync("/wild/models/crew5.glb");
  const model = gltf.scene;
  let skinned = null;
  model.traverse((o) => { if (o.isSkinnedMesh) { skinned = skinned || o; o.frustumCulled = false; } });
  skinned.material = new THREE.MeshLambertMaterial({ map: skinned.material.map });
  const holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.add(model);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf2efe8);
  scene.add(holder, new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
  // the rig, as hero.js makeRig: rest turn, parent's world turn and its inverse
  model.updateMatrixWorld(true);
  const by = {}; model.traverse((o) => { if (o.isBone) by[o.name] = o; });
  const T1 = new THREE.Vector3(), TS = new THREE.Vector3();
  const I = {};
  for (const n of anim.bones) {
    const b = by[n], pq = new THREE.Quaternion();
    b.parent.matrixWorld.decompose(T1, pq, TS);
    I[n] = { b, rest: b.quaternion.clone(), Pw: pq.clone(), Pi: pq.clone().invert() };
  }
  const hips = by.Hips, hipsRest = hips.position.clone(), armInv = new THREE.Matrix3().setFromMatrix4(hips.parent.matrixWorld).invert();
  const QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), V = new THREE.Vector3();
  function pose(clip, phase) {
    const n = clip.frames, x = (((phase % 1) + 1) % 1) * n, k = Math.floor(x), j = (k + 1) % n, u = x - k;
    for (const name of anim.bones) {
      const t = clip.tracks[name], d = I[name];
      QA.fromArray(t, k * 4); QB.fromArray(t, j * 4); QA.slerp(QB, u);
      d.b.quaternion.copy(d.Pi).multiply(QA).multiply(d.Pw).multiply(d.rest);
    }
    const h = clip.hips;
    V.set(h[k * 3] + (h[j * 3] - h[k * 3]) * u, h[k * 3 + 1] + (h[j * 3 + 1] - h[k * 3 + 1]) * u, h[k * 3 + 2] + (h[j * 3 + 2] - h[k * 3 + 2]) * u);
    hips.position.copy(hipsRest).add(V.applyMatrix3(armInv));
    holder.updateMatrixWorld(true);
  }
  // the floor: a line, ticks every 0.25 m that move back with the floor, and a red dot under each planted foot
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0xd9d3c7 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const tickGeo = new THREE.BoxGeometry(0.9, 0.006, 0.03), tickMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const ticks = Array.from({ length: 33 }, () => { const m = new THREE.Mesh(tickGeo, tickMat); scene.add(m); return m; });
  const dotGeo = new THREE.SphereGeometry(0.035, 10, 6), dotMat = new THREE.MeshBasicMaterial({ color: 0xe0302a });
  const dots = [0, 1].map(() => { const m = new THREE.Mesh(dotGeo, dotMat); scene.add(m); return m; });
  // cameras: the side (orthographic, from the hero's right; the hero faces screen right) and the chase direction
  const side = new THREE.OrthographicCamera(-0.95, 0.95, 1.33, -1.33, 0.1, 20); side.position.set(6, 1.08 + 6 * Math.tan(0.1), 0); side.lookAt(0, 1.08, 0);
  const chase = new THREE.PerspectiveCamera(30, 1, 0.1, 40); chase.position.set(0, 2.7, 4.34); chase.lookAt(0, 1.0, 0);
  if (close) {
    // a closer look at the arms and hands: the side camera frames the upper body, the other looks from ahead and to the left
    side.position.set(6, 1.15, 0); side.lookAt(0, 1.15, 0); side.zoom = 2.2;
    chase.position.set(-1.6, 1.5, -2.2); chase.lookAt(0, 1.15, 0); chase.fov = 26;
  }
  const clips = anim.clips.filter((c) => !only || only.includes(c.name));
  const HS = Math.round(W * 1.4), HC = Math.round(W * 1.13), LAB = 20, BLOCK = LAB + HS + HC;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W * COLS, BLOCK * clips.length); renderer.setScissorTest(true);
  const H = BLOCK * clips.length;
  const out = document.createElement("canvas"); out.width = W * COLS; out.height = H;
  const g = out.getContext("2d");
  const stats = [];
  const foot = (s) => by[s + "Foot"], toe = (s) => by[s + "ToeBase"];
  clips.forEach((clip, ci) => {
    const y0 = ci * BLOCK;
    for (let i = 0; i < COLS; i++) {
      const ph = i / COLS, t = ph * clip.duration, fr = Math.floor(ph * clip.frames + 1e-6) % clip.frames;
      pose(clip, ph);
      const shift = (clip.speed * t) % 0.25;
      ticks.forEach((m, k) => m.position.set(0, 0.003, -4 + k * 0.25 + shift));
      ["Left", "Right"].forEach((s, si) => {
        const on = clip.contacts[s[0]][fr] === "1";
        dots[si].visible = on;
        foot(s).getWorldPosition(V); dots[si].position.set(V.x, 0.0, V.z);
      });
      // side tile (y measured from the bottom in WebGL)
      renderer.setViewport(i * W, H - (y0 + LAB + HS), W, HS); renderer.setScissor(i * W, H - (y0 + LAB + HS), W, HS);
      side.top = 0.95 * (HS / W); side.bottom = -side.top; side.updateProjectionMatrix();
      renderer.render(scene, side);
      renderer.setViewport(i * W, H - (y0 + BLOCK), W, HC); renderer.setScissor(i * W, H - (y0 + BLOCK), W, HC);
      chase.aspect = W / HC; chase.updateProjectionMatrix();
      renderer.render(scene, chase);
    }
    // planted feet: world speed of the ankle and toe from the posed bones (the floor moves back at the clip's speed)
    const N = clip.frames * 4, dt = clip.duration / N, prev = {}, s = { name: clip.name, L: { n: 0, sum: 0, max: 0 }, R: { n: 0, sum: 0, max: 0 } };
    for (let k = 0; k <= N; k++) {
      pose(clip, k / N);
      for (const side of ["Left", "Right"]) {
        const key = side[0], a = foot(side).getWorldPosition(new THREE.Vector3()), b = toe(side).getWorldPosition(new THREE.Vector3());
        // the model faces -z in the world here, so the floor moves toward +z
        a.z -= clip.speed * k * dt; b.z -= clip.speed * k * dt;
        // only between two planted keys (the last planted key lifts off toward the next)
        const fr = Math.floor((k / N) * clip.frames - 1e-9) % clip.frames, planted = (f) => clip.contacts[key][(f + clip.frames) % clip.frames] === "1";
        if (prev[key] && planted(fr) && planted(fr + 1) && planted(prev[key].fr) && planted(prev[key].fr + 1)) {
          // the planted point is the stiller of ankle (on the heel) and toe base (on the ball)
          const pa = prev[key].a, pb = prev[key].b;
          const va = Math.hypot(a.x - pa.x, a.z - pa.z) / dt, vb = Math.hypot(b.x - pb.x, b.z - pb.z) / dt;
          const v = Math.min(va, vb);
          s[key].n++; s[key].sum += v; s[key].max = Math.max(s[key].max, v);
        }
        prev[key] = { a, b, fr };
      }
    }
    stats.push(s);
  });
  g.drawImage(renderer.domElement, 0, 0);
  g.font = "bold 13px sans-serif"; g.fillStyle = "#222";
  clips.forEach((clip, ci) => {
    const y0 = ci * BLOCK;
    g.fillStyle = "#fff"; g.fillRect(0, y0, W * COLS, LAB); g.fillStyle = "#222";
    g.fillText(clip.name + "  (" + clip.source + ")  " + clip.duration.toFixed(3) + " s cycle, " + clip.speed.toFixed(2) + " m/s, " + clip.frames + " frames; side view, then the chase direction. Red dot: planted foot", 6, y0 + 15);
    for (let i = 0; i < COLS; i++) { g.fillStyle = "#666"; g.font = "11px sans-serif"; g.fillText((i / COLS).toFixed(2), i * W + 4, y0 + LAB + 12); g.fillStyle = "#bbb"; g.fillRect(i * W, y0 + LAB, 1, HS + HC); }
  });
  return { png: out.toDataURL("image/png"), stats };
};
window.sheetReady = true;
</script></body></html>`;

let page = null;
try {
  page = await newPage({ width: 400, height: 300 });
  const base = await serve();
  await page.route(base + "__sheet.html", (r) => r.fulfill({ status: 200, contentType: "text/html", body: PAGE }));
  // MOCAP_JSON=<file> draws a trial bake (bake-mocap.mjs --out=) instead of the committed one
  if (process.env.MOCAP_JSON) {
    const body = await readFile(process.env.MOCAP_JSON);
    await page.route(base + "anim/locomotion.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body }));
  }
  await page.goto(base + "__sheet.html");
  await page.waitForFunction(() => window.sheetReady, null, { timeout: 120000 });
  const res = await page.evaluate(([only, w, cols, cl]) => window.sheet(only, w, cols, cl), [ONLY, TILE, COLS, CLOSE]);
  await writeFile(OUT, Buffer.from(res.png.split(",")[1], "base64"));
  console.log("INFO: wrote " + OUT);
  for (const s of res.stats) {
    for (const k of ["L", "R"]) {
      const m = s[k].n ? s[k].sum / s[k].n : 0;
      console.log(`INFO: ${s.name} ${k} foot planted: ${s[k].n} samples, world speed mean ${m.toFixed(3)} m/s, max ${s[k].max.toFixed(3)} m/s`);
      const lim = s.name === "idle" ? 0.05 : 0.08; // m/s; a moving clip blends keys 33 ms apart, which bends the planted foot's path a little
      check(m < lim, `${s.name} ${k} planted foot holds still (mean world speed under ${lim} m/s)`, m);
    }
  }
  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "sheet rendered", e && e.stack);
} finally {
  await close();
  done();
}
