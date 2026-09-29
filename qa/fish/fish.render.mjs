// Checks the fish bodies (world-fish.js): every species and junk id builds, each fish costs 3 draw calls and few triangles,
// the shapes have the parts that make them (beak, flat head, barbels, hooked jaw), the eye colours come from the look data,
// the new fish show up in the catch view, and releaseFish frees the skins.
// Run: node qa/fish/fish.render.mjs   (FISH_SHOTS=dir to choose where the pictures go)
// It serves public/ itself and injects two test pages at /fish/__fishbody.html and /fish/__fishworld.html, so nothing test-only lives in public/.
import { createRequire } from "module";
import { spawn } from "child_process";
import net from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = process.env.FISH_SHOTS || path.join(os.tmpdir(), "fish-shots");
const THREE_LOCAL = process.env.THREE_LOCAL || path.join(ROOT, "public/crimson/lib/three.module.min.js");
fs.mkdirSync(SHOTS, { recursive: true });

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(ROOT, "public"), stdio: "ignore" });
const stop = () => { try { server.kill(); } catch (e) { /* gone */ } };
process.on("exit", stop);
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/fish/js/lake.js`); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }

const IMPORTMAP = `<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>`;

// Page 1: the fish alone, no world. Its own small renderer counts draw calls, triangles and textures.
const BODY = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${IMPORTMAP}
<style>html,body{margin:0;background:#334;}</style></head><body><canvas id="c" width="96" height="64"></canvas>
<script type="module">
import * as THREE from "three";
import { fishMesh, releaseFish, FORMS, JUNK_LEN } from "./js/world-fish.js";
import { SPECIES, JUNK, byId } from "./js/species.js";
const cv = document.getElementById("c");
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
R.setSize(96, 64, false);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xbcd8f4, 0x5e6e3a, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-2, 3, 2); scene.add(sun);
const cam = new THREE.OrthographicCamera(-0.7, 0.7, 0.47, -0.47, 0.01, 20);
cam.position.set(-3, 0, 0); cam.lookAt(0, 0, 0);
const triCount = (m) => { let n = 0, calls = 0; m.traverse((o) => { if (o.isMesh) { calls++; const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { tris: n, calls }; };
// draw one mesh alone and read the renderer's own counts
const drawOne = (m) => { scene.add(m); R.info.reset(); R.render(scene, cam); const r = { calls: R.info.render.calls, tris: R.info.render.triangles }; scene.remove(m); return r; };
window.T = { THREE, R, scene, cam, fishMesh, releaseFish, FORMS, JUNK_LEN, SPECIES, JUNK, byId, triCount, drawOne };

// per id: mesh facts. geometry z and y extents (nose at -z), draw calls and triangles, both counted and measured
window.facts = () => {
  const out = [];
  for (const s of [...SPECIES, ...JUNK]) {
    const t0 = performance.now();
    const m = fishMesh(s.id);
    const ms = performance.now() - t0;
    if (!m) { out.push({ id: s.id, missing: true }); continue; }
    const box = new THREE.Box3().setFromObject(m), c = triCount(m), d = drawOne(m);
    let finite = true;
    m.traverse((o) => { if (o.isMesh) for (const k of ["position", "normal", "uv"]) { const a = o.geometry.attributes[k]; if (a) for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) finite = false; } });
    out.push({ id: s.id, ms, finite, kind: m.userData.kind, hasFx: !!m.userData.fx, mats: m.userData.mats.length, uid: m.userData.id, minZ: box.min.z, maxZ: box.max.z, minY: box.min.y, maxY: box.max.y, minX: box.min.x, maxX: box.max.x, tris: c.tris, calls: c.calls, drawCalls: d.calls, drawTris: d.tris, shape: s.look.shape, formOk: !!FORMS[s.look.shape] });
  }
  return out;
};
// the part of a geometry that lies in a z band: vertex count and y and x extents
window.band = (id, part, z0, z1) => {
  const m = fishMesh(id), idx = { body: 0, eyes: 1, fins: 2 }[part];
  const g = m.children[idx].geometry, p = g.attributes.position;
  const r = { n: 0, maxY: -9, minY: 9, maxAbsX: 0 };
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z < z0 || z > z1) continue; r.n++; r.maxY = Math.max(r.maxY, p.getY(i)); r.minY = Math.min(r.minY, p.getY(i)); r.maxAbsX = Math.max(r.maxAbsX, Math.abs(p.getX(i))); }
  return r;
};
// the iris colour painted in the eye texture, read back as [r,g,b]
window.iris = (id) => { const m = fishMesh(id), cv = m.userData.mats[2].map.image, d = cv.getContext("2d").getImageData(4, 20, 1, 1).data; return [d[0], d[1], d[2]]; };
window.glassy = (id) => { const m = fishMesh(id), cv = m.userData.mats[2].map.image, d = cv.getContext("2d").getImageData(4, 6, 1, 1).data; return [d[0], d[1], d[2]]; };
// a contact sheet of every fish, side view
window.sheet = (cols, cw, ch) => {
  const ids = [...SPECIES, ...JUNK].map((s) => s.id), rows = Math.ceil(ids.length / cols);
  const r2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r2.setSize(cols * cw, rows * ch, false); r2.setScissorTest(true); r2.setClearColor(0x3a4a52);
  const stats = [];
  ids.forEach((id, i) => {
    const m = fishMesh(id);
    for (const mt of m.userData.mats) if (!mt.userData.fin) mt.transparent = false;
    m.userData.fx.uKey.value = 1;
    scene.add(m);
    const col = i % cols, row = Math.floor(i / cols), x = col * cw, y = (rows - 1 - row) * ch;
    r2.setViewport(x, y, cw, ch); r2.setScissor(x, y, cw, ch);
    const box = new THREE.Box3().setFromObject(m), mid = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const asp = cw / ch, w = Math.max(size.z, size.y * asp) * 0.56 + 0.02, h = w / asp;
    const oc = new THREE.OrthographicCamera(-w, w, h, -h, 0.01, 20);
    oc.position.set(-3, mid.y, mid.z); oc.lookAt(0, mid.y, mid.z);
    r2.render(scene, oc);
    scene.remove(m);
  });
  const url = r2.domElement.toDataURL("image/png");
  r2.dispose();
  return url;
};
// releaseFish: build everything, draw it (so the GPU has it), then release and count
window.release = () => {
  const mem = () => ({ textures: R.info.memory.textures, geometries: R.info.memory.geometries });
  const res = { start: mem() };
  const all = [...SPECIES, ...JUNK].map((s) => s.id);
  for (const id of all) drawOne(fishMesh(id));
  res.full = mem();
  const perchMap = fishMesh("perch").userData.mats[0].map, codMap = fishMesh("cod").userData.mats[0].map;
  const freed = releaseFish(["perch", "boot"]);
  res.freed = freed;
  res.kept = mem();
  res.perchSame = fishMesh("perch").userData.mats[0].map === perchMap;
  res.codNew = fishMesh("cod").userData.mats[0].map !== codMap;
  // a released species draws again and gets its texture back
  const d = drawOne(fishMesh("cod"));
  res.codAgain = { calls: d.calls, tris: d.tris, mem: mem() };
  releaseFish([]);
  res.none = mem();
  // and again with nothing left: no throw, and building still works
  releaseFish(); releaseFish(["nope", "perch"]);
  const d2 = drawOne(fishMesh("bigblue"));
  res.rebuilt = { calls: d2.calls, mem: mem() };
  // a mesh made before a release draws again as well (three.js uploads its textures and buffers once more)
  const stale = fishMesh("walleye"); releaseFish(["perch", "boot"]); const ds = drawOne(stale);
  res.stale = { calls: ds.calls };
  return res;
};
window.ready = true;
</script></body></html>`;

// Page 2: the game world, for the catch view of each new fish
const WORLD = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${IMPORTMAP}
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}#game{position:fixed;inset:0}</style></head>
<body><div id="game"></div>
<script type="module">
import * as THREE from "three";
import { createWorld } from "./js/world.js";
const q = new URLSearchParams(location.search).get("q") || "high";
const W = await createWorld(document.getElementById("game"), { quality: q });
window.W = W;
W.resize(innerWidth, innerHeight);
window.step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) W.update(dt); };
// the frame as a small luminance grid, read back in the same task as the draw
const grab = () => {
  W.render();
  const src = W.renderer.domElement, c = document.createElement("canvas");
  c.width = 120; c.height = Math.max(1, Math.round(120 * src.height / src.width));
  const x = c.getContext("2d"); x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, lum = new Float32Array(d.length / 4);
  let sum = 0, sum2 = 0, black = 0, blown = 0; const n = lum.length;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; lum[i / 4] = l; sum += l; sum2 += l * l; if (l < 0.03) black++; if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250) blown++; }
  const mean = sum / n;
  return { lum, stats: { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), black: black / n, blown: blown / n, info: W.info() } };
};
const scene0 = (portrait) => {
  W.setHour(19.5); W.setFish(null); W.setFollower(null); W.setRings([]); W.setAim({ visible: false }); W.setLure({ visible: false }); W.setLine({ visible: false });
  W.setRod({ visible: false });
  W.setView({ mode: "catch", portrait });
};
// the catch view of one fish: stats, how much of the frame changed against the empty view, and whether the fish is inside the frame
window.catchFrame = ({ id, kg, portrait }) => {
  scene0(portrait);
  W.hideCatch(); step(30);
  const empty = grab();
  W.showCatch(id, kg);
  step(60);
  const withFish = grab();
  let changed = 0; const n = withFish.lum.length;
  for (let i = 0; i < n; i++) if (Math.abs(withFish.lum[i] - empty.lum[i]) > 0.05) changed++;
  // the stage is the newest scene child that holds this fish; project its box to the screen
  let fit = null;
  const stage = W.scene.children.find((o) => o.children && o.children[0] && o.children[0].userData && o.children[0].userData.id === id && o.children[0].userData.kind);
  if (stage) {
    stage.updateWorldMatrix(true, true);
    W.camera.updateMatrixWorld(true);
    // every vertex of the shown fish, projected to the screen
    const p = new THREE.Vector3();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    stage.traverse((o) => {
      if (!o.isMesh) return;
      const ps = o.geometry.attributes.position;
      for (let i = 0; i < ps.count; i++) { p.fromBufferAttribute(ps, i).applyMatrix4(o.matrixWorld).project(W.camera); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    });
    fit = { x0, x1, y0, y1 };
  }
  return { stats: withFish.stats, changed: changed / n, fit, size: stage ? new THREE.Box3().setFromObject(stage, true).getSize(new THREE.Vector3()).toArray() : null };
};
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
let failed = false, checks = 0;
const fail = (msg) => { failed = true; console.log("FAIL " + msg); };
const check = (ok, msg) => { checks++; if (!ok) fail(msg); return ok; };

async function open(pageName, html, width, height, query = "") {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push("console " + m.type() + ": " + m.text()); });
  if (fs.existsSync(THREE_LOCAL)) await page.route("**/three@0.170.0/build/three.module.min.js", (r) => r.fulfill({ path: THREE_LOCAL, contentType: "application/javascript" }));
  await page.route(`**/fish/${pageName}*`, (r) => r.fulfill({ body: html, contentType: "text/html" }));
  await page.goto(`http://localhost:${PORT}/fish/${pageName}${query}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  return { ctx, page };
}

const NEW = ["crappie", "bowfin", "gar", "catfish", "whiskers", "mackerel", "pollock", "striper", "bluefish", "cod", "bigblue", "steelhead", "chinook", "browntrout", "brooktrout", "hookjaw"];
const JUNKS = ["boot", "plunger", "frisbee"];
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

try {
  /* ---------------- page 1: the bodies ---------------- */
  {
    const { ctx, page } = await open("__fishbody.html", BODY, 400, 300);
    const specs = await page.evaluate(() => window.T.SPECIES.map((s) => ({ id: s.id, look: s.look, kg: s.kg, cm: s.cm })));
    check(specs.length === 26, `26 species expected, found ${specs.length}`);
    const facts = await page.evaluate(() => window.facts());
    check(facts.length === 29, `29 ids (26 species and 3 junk) expected, found ${facts.length}`);
    const by = Object.fromEntries(facts.map((f) => [f.id, f]));
    for (const f of facts) {
      if (f.missing) { fail("fishMesh " + f.id + " returned null"); continue; }
      const fish = f.kind === "fish";
      check(f.hasFx && f.uid === f.id, "fishMesh " + f.id + ": userData.fx and id");
      check(f.finite, f.id + ": every vertex value is a finite number");
      if (fish) {
        check(f.formOk, f.id + ": shape " + f.shape + " has no FORM (it would draw as a bass)");
        check(f.calls === 3 && f.drawCalls === 3, `${f.id}: 3 draw calls expected, counted ${f.calls}, drawn ${f.drawCalls}`);
        check(f.mats === 3, f.id + ": 3 materials");
        // 1 unit long, nose toward -z, tail at +z
        check(f.maxZ - f.minZ > 0.97 && f.maxZ - f.minZ < 1.1, `${f.id}: length ${(f.maxZ - f.minZ).toFixed(3)} should be about 1`);
        check(f.minZ < -0.47 && f.maxZ > 0.47, `${f.id}: nose at ${f.minZ.toFixed(3)}, tail at ${f.maxZ.toFixed(3)}`);
        check(f.drawTris === f.tris, `${f.id}: renderer drew ${f.drawTris} triangles, geometry has ${f.tris}`);
      } else check(f.calls === 1, `${f.id}: junk should be 1 draw call, counted ${f.calls}`);
    }
    const base = by.smallmouth.tris, cap = Math.floor(base * 1.3);
    let worst = { id: "", tris: 0 };
    for (const f of facts) if (f.kind === "fish") { if (f.tris > worst.tris) worst = f; check(f.tris <= cap, `${f.id}: ${f.tris} triangles, over 1.3 x smallmouth (${base}) = ${cap}`); }
    console.log(`INFO triangles: smallmouth ${base}, limit ${cap}, most ${worst.id} ${worst.tris}; ` + facts.filter((f) => f.kind === "fish" && NEW.includes(f.id)).map((f) => `${f.id} ${f.tris}`).join(", "));
    const build = facts.filter((f) => f.kind === "fish").map((f) => f.ms), slow = facts.filter((f) => f.ms > 500);
    console.log(`INFO first build of a fish (skin, geometry, materials): mean ${(build.reduce((a, b) => a + b, 0) / build.length).toFixed(0)} ms, max ${Math.max(...build).toFixed(0)} ms`);
    check(!slow.length, "a fish takes over 500 ms to build: " + slow.map((f) => f.id + " " + f.ms.toFixed(0)).join(", "));
    check((await page.evaluate(() => window.T.fishMesh("nope"))) === null, "fishMesh of an unknown id should be null");

    // shape parts
    const catB = await page.evaluate(() => ({ cat: window.band("catfish", "fins", -0.6, -0.38), whisk: window.band("whiskers", "fins", -0.6, -0.38), cod: window.band("cod", "fins", -0.6, -0.38), bass: window.band("smallmouth", "fins", -0.6, -0.38), pike: window.band("pike", "fins", -0.6, -0.38) }));
    check(catB.cat.n >= 8 * 6 * 3 && catB.whisk.n >= 8 * 6 * 3, `catfish barbels: 8 strips of 6 triangles expected in the fins mesh (vertices near the nose: ${catB.cat.n} and ${catB.whisk.n})`);
    check(catB.cod.n >= 6 * 3 && catB.cod.n < catB.cat.n, `cod has one barbel (vertices near the nose: ${catB.cod.n})`);
    check(catB.bass.n === 0 && catB.pike.n === 0, "a fish with no barbels has no fin parts at the nose");
    const kyp = await page.evaluate(() => ({ hook: window.band("hookjaw", "body", -0.6, -0.525), chin: window.band("chinook", "body", -0.6, -0.525) }));
    check(kyp.hook.n > 0 && kyp.chin.n === 0, `hookjaw has a hooked jaw ahead of the nose (${kyp.hook.n} vertices); chinook has none (${kyp.chin.n})`);
    const gar = await page.evaluate(() => ({ beak: window.band("gar", "body", -0.5, -0.36), pike: window.band("pike", "body", -0.5, -0.36) }));
    check(gar.beak.maxAbsX < 0.024 && gar.beak.maxY < 0.024, `the gar beak is thin: half width ${gar.beak.maxAbsX.toFixed(3)}, height ${gar.beak.maxY.toFixed(3)}`);
    const flat = await page.evaluate(() => ({ cat: window.band("catfish", "body", -0.42, -0.33), bass: window.band("smallmouth", "body", -0.42, -0.33) }));
    check(flat.cat.maxAbsX / Math.max(flat.cat.maxY, 1e-6) > flat.bass.maxAbsX / flat.bass.maxY + 0.3, `the catfish head is wide and flat: x/y ${(flat.cat.maxAbsX / flat.cat.maxY).toFixed(2)} against the bass ${(flat.bass.maxAbsX / flat.bass.maxY).toFixed(2)}`);
    // the tuna is deep, the mackerel is slim (girth)
    const dep = async (id) => { const b = await page.evaluate((id) => window.band(id, "body", -1, 1), id); return b.maxY - b.minY; };
    const dBlue = await dep("bigblue"), dMack = await dep("mackerel"), dBlueFish = await dep("bluefish");
    check(dBlue > dBlueFish * 1.05 && dBlueFish > dMack * 1.1, `girth: body depth bigblue ${dBlue.toFixed(3)} > bluefish ${dBlueFish.toFixed(3)} > mackerel ${dMack.toFixed(3)}`);

    // eye colours come from look.iris (and look.eyeshine), not from the id
    const near = (a, b, t = 6) => a.every((v, i) => Math.abs(v - b[i]) <= t);
    for (const s of specs) {
      const want = hexRgb(s.look.iris || "#d0a038");
      const got = await page.evaluate((id) => window.iris(id), s.id);
      check(near(got, want), `${s.id}: iris ${got} should be ${want}`);
      const gl = await page.evaluate((id) => window.glassy(id), s.id);
      const glassy = near(gl, [0x6a, 0x70, 0x70]);
      check(glassy === !!s.look.eyeshine, `${s.id}: eyeshine ${s.look.eyeshine ? "on" : "off"} but the eye is ${glassy ? "glassy" : "dark"}`);
    }

    // the contact sheet
    const url = await page.evaluate(() => window.sheet(6, 420, 190));
    fs.writeFileSync(path.join(SHOTS, "fish-sheet.png"), Buffer.from(url.split(",")[1], "base64"));

    // releaseFish
    const r = await page.evaluate(() => window.release());
    console.log("INFO release:", JSON.stringify(r));
    check(r.full.textures >= 26 + 1, `all fish drawn: ${r.full.textures} textures on the GPU`);
    check(r.freed.skins === 25 && r.freed.geometries > 0, `releaseFish(["perch","boot"]) should free 25 skins, freed ${r.freed.skins}`);
    // kept: the perch skin, its eye, the fin ray texture. The boot has no texture
    check(r.kept.textures <= 3, `after the release ${r.kept.textures} textures are left (perch skin, perch eye, fin rays)`);
    check(r.kept.geometries <= 4, `after the release ${r.kept.geometries} geometries are left (perch 3, boot 1)`);
    check(r.perchSame, "a kept species keeps its skin texture");
    check(r.codNew, "a released species gets a new skin the next time it is built");
    check(r.codAgain.calls === 3, "a released species draws again");
    check(r.stale.calls === 3, "a mesh made before the release still draws");
    check(r.none.textures === 0 && r.none.geometries === 0, `releaseFish([]) frees everything: ${r.none.textures} textures, ${r.none.geometries} geometries left`);
    check(r.rebuilt.calls === 3 && r.rebuilt.mem.textures >= 2, "after freeing everything a fish builds and draws again");
    await ctx.close();
  }

  /* ---------------- page 2: the catch view of the new fish ---------------- */
  {
    const { ctx, page } = await open("__fishworld.html", WORLD, 844, 390, "?q=high");
    const cases = [];
    const sp = await page.evaluate(async () => { const m = await import("./js/species.js"); return m.SPECIES.map((s) => ({ id: s.id, kg: s.kg, trophy: s.trophy, cm: s.cm })); });
    const byId = Object.fromEntries(sp.map((s) => [s.id, s]));
    for (const id of NEW) { const s = byId[id]; cases.push({ id, kg: +(((s.kg[0] + s.kg[1]) / 2).toFixed(2)), portrait: false, name: id }); }
    cases.push({ id: "bigblue", kg: 110, portrait: false, name: "bigblue-2m" }, { id: "bigblue", kg: 160, portrait: false, name: "bigblue-trophy" }, { id: "bigblue", kg: 85, portrait: true, name: "bigblue-portrait" });
    cases.push({ id: "catfish", kg: 4.5, portrait: true, name: "catfish-portrait" }, { id: "brooktrout", kg: 0.25, portrait: false, name: "brooktrout-small" });
    for (const c of cases) {
      if (c.portrait) await page.setViewportSize({ width: 390, height: 844 }); else await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(([w, h]) => window.W.resize(w, h), c.portrait ? [390, 844] : [844, 390]);
      const r = await page.evaluate((a) => window.catchFrame(a), c);
      await page.screenshot({ path: path.join(SHOTS, `fish-catch-${c.name}.png`) });
      const st = r.stats;
      console.log(`catch ${c.name}: mean ${st.mean.toFixed(2)} std ${st.std.toFixed(2)} black ${(st.black * 100).toFixed(1)}% blown ${(st.blown * 100).toFixed(1)}% changed ${(r.changed * 100).toFixed(1)}% calls ${st.info.calls} tris ${st.info.tris}` + (r.fit ? ` box x ${r.fit.x0.toFixed(2)}..${r.fit.x1.toFixed(2)} y ${r.fit.y0.toFixed(2)}..${r.fit.y1.toFixed(2)}` : "") + (r.size ? ` size ${r.size.map((v) => v.toFixed(2)).join("x")} m` : ""));
      check(st.mean >= 0.08, c.name + " catch view is too dark");
      check(st.std >= 0.025, c.name + " catch view looks blank");
      check(st.black <= 0.2, c.name + " catch view has black areas");
      check(st.blown <= 0.08, c.name + " catch view is blown out");
      check(r.changed >= 0.05, `${c.name}: the fish should show in the catch view (${(r.changed * 100).toFixed(1)}% of the frame changed)`);
      check(st.info.calls <= 40, `${c.name}: ${st.info.calls} draw calls in the catch view`);
      if (r.fit) check(r.fit.x0 >= -1 && r.fit.x1 <= 1 && r.fit.y0 >= -1 && r.fit.y1 <= 1, `${c.name}: the fish does not fit the view: x ${r.fit.x0.toFixed(2)}..${r.fit.x1.toFixed(2)}, y ${r.fit.y0.toFixed(2)}..${r.fit.y1.toFixed(2)}`);
      else fail(c.name + ": the shown fish was not found in the scene");
    }
    await ctx.close();
  }
} catch (e) {
  fail("exception: " + (e && e.stack || e));
}
await browser.close();
stop();
const bad = errors.filter((e) => !/GPU stall due to ReadPixels|Automatic fallback to software WebGL|GroupMarkerNotSet|Multiple readback operations using getImageData/.test(e));
if (bad.length) fail("console errors:\n  " + bad.join("\n  "));
console.log(failed ? `fish.render: FAILED (${checks} checks)` : `fish.render: OK (${checks} checks, pictures in ${SHOTS})`);
process.exit(failed ? 1 : 0);
