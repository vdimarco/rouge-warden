// Renders the world of every place in set scenes and saves screenshots, then checks for errors and broken frames.
// Run: node qa/fish/world.render.mjs   (FISH_SHOTS=dir to choose where the pictures go, ONLY=text to run only the shots with that text in the name,
//   WORLD_PLACES=loon,sea to run only those places, SITE=dir to serve another copy of public/)
// It serves public/ itself and injects a test page at /fish/__world.html, so nothing test-only lives in public/.
// The page takes ?q=low|high and ?place=loon|stumps|river|sea. Checks:
//  - frame checks (not too dark, not blank, no black areas, not blown out) on every scene of every place
//  - the phone budget at low quality: the reel scene at 76k triangles and 22 draw calls at most, the catch at 24 calls, for every place;
//    also the plain retrieve (lure, line, a follower and a gold ring), where a gold ring adds no draw call
//  - a short portrait phone (375 x 667) with the catch card over the bottom half: every legend, and a usual catch, fit in the free top part
//  - Stump Bay at night (23.0) is not too dark; the legend of each place fits the catch view (the 2 m tuna too), portrait and landscape
//  - loon -> stumps -> river -> sea -> loon leaks no more than 5% of the geometries and textures; the setPlace times are logged
import { createRequire } from "module";
import { spawn } from "child_process";
import net from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SITE = process.env.SITE || path.join(ROOT, "public");   // SITE: serve another copy of public/ (to compare with an older build)
const SHOTS = process.env.FISH_SHOTS || path.join(os.tmpdir(), "fish-shots");
const THREE_LOCAL = process.env.THREE_LOCAL || path.join(ROOT, "public/crimson/lib/three.module.min.js");
const ONLY = process.env.ONLY || "";
const PLACES_ONLY = (process.env.WORLD_PLACES || "").split(",").filter(Boolean);
fs.mkdirSync(SHOTS, { recursive: true });

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: SITE, stdio: "ignore" });
const stop = () => { try { server.kill(); } catch (e) { /* gone */ } };
process.on("exit", stop);
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/fish/js/lake.js`); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}#game{position:fixed;inset:0}</style></head>
<body><div id="game"></div>
<script type="module">
import * as THREE from "three";
import { createWorld, fishMesh } from "./js/world.js";
import { PLACES } from "./js/places.js";
const P = new URLSearchParams(location.search);
const q = P.get("q") || "high", place = P.get("place") || "loon";
const W = await createWorld(document.getElementById("game"), { quality: q, place: PLACES[place] });
window.W = W; window.fishMesh = fishMesh; window.PLACES = PLACES; window.PLACE = place; window.THREE = THREE;
W.resize(innerWidth, innerHeight);
// render, then read the frame back in the same task (before the browser clears the buffer)
window.frame = () => {
  W.render();
  const src = W.renderer.domElement, c = document.createElement("canvas");
  c.width = 120; c.height = Math.max(1, Math.round(120 * src.height / src.width));
  const x = c.getContext("2d"); x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, sum2 = 0, black = 0, blown = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; sum += l; sum2 += l * l; if (l < 0.03) black++; if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250) blown++; }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), black: black / n, blown: blown / n, info: W.info() };
};
window.step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) W.update(dt); };
// a picture from any point (to look at a prop close up): the world drawn once through a camera of our own
window.snap = (pos, target, fov = 60) => {
  const cam = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.08, 1400);
  cam.position.set(...pos); cam.lookAt(...target); cam.updateMatrixWorld();
  W.scene.children.find((o) => o.renderOrder === -10).position.copy(cam.position);
  W.renderer.render(W.scene, cam);
};
// does the catch fit the view? The box round the fish and its board, seen through the camera (in screen units, -1..1 is the whole view)
window.fits = () => {
  const stage = W.scene.children.find((o) => o.userData && o.userData.trophy);
  if (!stage) return null;
  W.camera.updateMatrixWorld();
  stage.updateMatrixWorld(true);
  let lo = [1e9, 1e9], hi = [-1e9, -1e9], ymin = 1e9;
  stage.traverse((o) => {
    if (!o.geometry) return;
    o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox;
    for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) {
      const w = new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);
      ymin = Math.min(ymin, w.y);
      const p = w.project(W.camera);
      lo = [Math.min(lo[0], p.x), Math.min(lo[1], p.y)]; hi = [Math.max(hi[0], p.x), Math.max(hi[1], p.y)];
    }
  });
  return { lo, hi, ymin };
};
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], results = [];
let failed = false;
const fail = (msg) => { failed = true; console.log("FAIL " + msg); };

async function open(width, height, q = "high", place = "loon") {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push("console " + m.type() + ": " + m.text()); });
  if (fs.existsSync(THREE_LOCAL)) await page.route("**/three@0.170.0/build/three.module.min.js", (r) => r.fulfill({ path: THREE_LOCAL, contentType: "application/javascript" }));
  await page.route("**/fish/__world.html*", (r) => r.fulfill({ body: HARNESS, contentType: "text/html" }));
  await page.goto(`http://localhost:${PORT}/fish/__world.html?q=${q}&place=${place}&debug`);   // debug: three checks each shader and reports errors
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  return { ctx, page };
}

const wanted = (name) => !ONLY || name.includes(ONLY);
async function shot(page, name, setup, arg, { minMean = 0.08 } = {}) {
  if (!wanted(name)) return null;
  await page.evaluate(setup, arg);
  const st = await page.evaluate(() => window.frame());
  await page.screenshot({ path: path.join(SHOTS, `world-${name}.png`) });
  results.push({ name, ...st });
  const tag = `${name}: mean ${st.mean.toFixed(2)} std ${st.std.toFixed(2)} black ${(st.black * 100).toFixed(1)}% blown ${(st.blown * 100).toFixed(1)}% calls ${st.info.calls} tris ${st.info.tris}`;
  console.log(tag);
  if (st.mean < minMean) fail(name + " is too dark");
  if (st.std < 0.025) fail(name + " looks blank");
  if (st.black > 0.2) fail(name + " has black areas");
  if (st.blown > 0.08) fail(name + " is blown out");
  return st;
}

/* scene setups (run inside the page) */
const title = (h) => { W.hideCatch(); W.setFish(null); W.setFollower(null); W.setRings([]); W.setAim({ visible: false }); W.setLure({ visible: false }); W.setLine({ visible: false }); W.setRod({ visible: false });
  W.setView({ mode: "title" }); W.setHour(h); step(120); };
const cast = ({ portrait, hour }) => {
  W.setHour(hour); W.hideCatch(); W.setFish(null); W.setFollower(null);
  W.setView({ mode: "cast", yaw: 0, portrait });
  W.setRings([{ x: -14, z: -22, gold: false }, { x: 9, z: -34, gold: false }, { x: -4, z: -47, gold: true }]);
  W.setAim({ yaw: -6, visible: true });
  for (let i = 0; i < 90; i++) {
    const tip = W.setRod({ theta: 78, yaw: -6, visible: true, bend: 0.05 });
    const lure = { x: tip.x, y: tip.y - 0.55, z: tip.z };
    W.setLure({ ...lure, visible: true });
    W.setLine({ from: tip, to: lure, slack: 0 });
    W.update(1 / 30);
  }
};
const flight = (hour) => {
  W.setHour(hour); W.hideCatch(); W.setFish(null); W.setFollower(null); W.setAim({ visible: false });
  W.setRings([{ x: 4, z: -44, gold: false }]);
  // a lure thrown at 35 degrees, followed until it is 40 m out and still in the air
  let p = null;
  const v = { x: 0.6, y: 12.5, z: -20.5 };
  for (let i = 0; i < 400; i++) {
    const dt = 1 / 60;
    W.setView({ mode: "flight", yaw: 0 });
    const tip = W.setRod({ theta: 22, yaw: 1.5, visible: true, bend: 0.1, pull: p });
    if (!p) p = { ...tip };
    const s = Math.hypot(v.x, v.y, v.z), k = 0.012 * s;
    v.x -= v.x * k * dt; v.y -= (9.8 + v.y * k) * dt; v.z -= v.z * k * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    W.setLure({ ...p, visible: true, spin: 0 });
    W.setLine({ from: tip, to: p, slack: 0.3, flying: true });
    W.update(dt);
    if (-p.z >= 40) break;
  }
  window.lastLure = p;
};
// a fish of the place in the air, on the line, and another following the lure
const reel = ({ hour, fish, follower }) => {
  W.setHour(hour); W.hideCatch(); W.setAim({ visible: false });
  W.setRings([{ x: 11, z: -24, gold: false }, { x: -7, z: -36, gold: true }]);
  const f = { id: fish, x: 3.5, y: -0.2, z: -15, heading: 1.3, len: 0.85, jump: 0.42, thrash: 0.8, roll: 0.3, near: 1 };
  W.setView({ mode: "reel", look: { x: 2, y: 0, z: -13 } });
  for (let i = 0; i < 90; i++) {
    W.setFish({ ...f, jump: i < 80 ? 0 : 0.05 + (i - 80) * 0.04 });
    W.setFollower({ id: follower, x: -1.6, y: -0.5, z: -7.2, heading: 0.3, len: 0.45 });
    // rod low while it jumps, loaded toward the fish
    const tip = W.setRod({ theta: 34, yaw: 8, steer: 0.1, bend: 0.8, pull: { x: f.x, y: 0, z: f.z }, visible: true });
    W.setLure({ x: f.x, y: 0.7, z: f.z, visible: false });
    W.setLine({ from: tip, to: { x: f.x, y: 0.75, z: f.z }, slack: 0.02 });
    W.update(1 / 30);
  }
  // the fish is in the air now
  W.setFish({ ...f, jump: 0.42 });
  W.update(1 / 30);
};
const catchView = ({ id, kg, portrait, hour, photo, inset, bottom }) => {
  W.setHour(hour); W.setFish(null); W.setFollower(null); W.setRings([]); W.setAim({ visible: false }); W.setLure({ visible: false }); W.setLine({ visible: false });
  W.setRod({ visible: false });
  W.setView({ mode: "catch", portrait, inset: inset || 0, bottom: bottom || 0 });
  W.showCatch(id, kg, { photo });
  step(60);
  // for the picture: a shade over the part that the card covers
  document.getElementById("cardShade")?.remove();
  if (bottom) { const d = document.createElement("div"); d.id = "cardShade"; d.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:" + bottom * 100 + "%;background:rgba(9,34,41,.85);border-top:2px solid #e8b64a"; document.body.appendChild(d); }
};
// the plain retrieve: the lure on the water, the line to it, a gold ring (or an ordinary one) in the lake and a fish following. No fish on the line
const retrieve = ({ hour, follower, gold }) => {
  W.setHour(hour); W.hideCatch(); W.setFish(null); W.setAim({ visible: false });
  W.setRings([{ x: 11, z: -24, gold: false }, { x: -7, z: -36, gold }]);
  W.setView({ mode: "reel", look: { x: 2, y: 0, z: -13 } });
  const L = { x: 2, y: 0, z: -13 };
  for (let i = 0; i < 90; i++) {
    W.setFollower(follower ? { id: follower, x: -1.6, y: -0.5, z: -7.2, heading: 0.3, len: 0.45 } : null);
    const tip = W.setRod({ theta: 40, yaw: 8, steer: 0.1, bend: 0.15, visible: true });
    W.setLure({ ...L, visible: true, spin: 0.5 });
    W.setLine({ from: tip, to: L, slack: 0.2 });
    W.update(1 / 30);
  }
};

// what each place shows: its derby hour, a fish and a follower that exist in it, its legend (the biggest catch), other catches
const SCENES = {
  loon: { hour: 18.3, fish: "pike", follower: "largemouth", legend: ["golden", 3.4], trophy: 7, catches: [["pike", 4.2], ["perch", 0.35], ["plunger", 0.5]] },
  stumps: { hour: 20, fish: "largemouth", follower: "crappie", legend: ["whiskers", 22], trophy: 32, catches: [["largemouth", 3.1], ["gar", 4]] },
  river: { hour: 6, fish: "steelhead", follower: "brooktrout", legend: ["hookjaw", 25], trophy: 38, catches: [["steelhead", 3.4], ["brooktrout", 0.6]] },
  sea: { hour: 18, fish: "striper", follower: "mackerel", legend: ["bigblue", 110], trophy: 160, catches: [["striper", 8], ["mackerel", 0.5]] },
};
const HOURS_SHOWN = { loon: [6, 12, 19.5, 21], stumps: [18.5, 20, 21.5, 23, 24], river: [5.2, 6, 8, 12, 19], sea: [5.5, 7, 12, 18, 20.5] };
const IDS = Object.keys(SCENES).filter((id) => !PLACES_ONLY.length || PLACES_ONLY.includes(id));
const budget = { reel: { tris: 76000, calls: 22 }, catch: { calls: 24 } };

// does the legend fit the catch view? lo and hi are the corners of the box round it, in screen units (-1..1 is the whole view)
function fitsOrFail(name, lid, f, freeRight, freeBottom = -1) {
  if (!f) { fail(`${name}: no catch to measure`); return; }
  console.log(`${name}: the ${lid} spans x ${f.lo[0].toFixed(2)}..${f.hi[0].toFixed(2)}, y ${f.lo[1].toFixed(2)}..${f.hi[1].toFixed(2)} of a view that is -1..${freeRight.toFixed(2)} wide and ${freeBottom.toFixed(2)}..1 high; lowest point ${f.ymin.toFixed(2)} m above the water`);
  if (f.lo[0] < -1 || f.hi[0] > freeRight + 0.02 || f.lo[1] < freeBottom || f.hi[1] > 1) fail(`${name}: the ${lid} does not fit the view`);
  if (f.ymin < 0.15) fail(`${name}: the ${lid} hangs down into the water (${f.ymin.toFixed(2)} m)`);
}

try {
  for (const id of IDS) {
    const S = SCENES[id];
    const [lid, lkg] = S.legend;
    // landscape phone, high quality: title at several hours, cast, flight, reel, catch
    {
      const { ctx, page } = await open(844, 390, "high", id);
      for (const h of HOURS_SHOWN[id]) await shot(page, `${id}-title-${String(h).replace(".", "_")}`, title, h);
      await shot(page, `${id}-cast-landscape`, cast, { portrait: false, hour: S.hour });
      await shot(page, `${id}-flight`, flight, S.hour);
      await shot(page, `${id}-reel`, reel, { hour: S.hour, fish: S.fish, follower: S.follower });
      for (const [fid, kg] of S.catches) await shot(page, `${id}-catch-${fid}`, catchView, { id: fid, kg, portrait: false, hour: S.hour });
      await ctx.close();
    }
    // portrait phone: cast, and the catch of the legend (the biggest fish must fit)
    {
      const { ctx, page } = await open(390, 844, "high", id);
      await shot(page, `${id}-cast-portrait`, cast, { portrait: true, hour: S.hour });
      await shot(page, `${id}-catch-legend-portrait`, catchView, { id: lid, kg: lkg, portrait: true, hour: S.hour });
      if (wanted(`${id}-catch-legend-portrait`)) fitsOrFail(`${id} portrait`, lid, await page.evaluate(() => window.fits()), 1);
      // the rarest size of the legend (its trophy weight), the biggest fish there is, on a narrow phone
      const big = await page.evaluate(({ id, kg }) => { W.resize(320, 640); W.hideCatch(); W.setView({ mode: "catch", portrait: true }); W.showCatch(id, kg); step(60); return window.fits(); }, { id: lid, kg: S.trophy });
      if (wanted(`${id}-catch-legend-portrait`)) fitsOrFail(`${id} trophy weight on a narrow phone`, lid, big, 1);
      await ctx.close();
    }
    // landscape catch of the legend with a card over the right 40% of the view; then the photo beat
    {
      const { ctx, page } = await open(844, 390, "high", id);
      await shot(page, `${id}-catch-legend`, catchView, { id: lid, kg: lkg, portrait: false, hour: S.hour, inset: 0.4 });
      if (wanted(`${id}-catch-legend`)) fitsOrFail(`${id} landscape with a card`, lid, await page.evaluate(() => window.fits()), 1 - 2 * 0.4);
      if (wanted(`${id}-photo`)) {
        // the photo beat runs on the wall clock (world.js beatT), so the push-in ends after 1.2 s of real time, not of steps
        const r = await page.evaluate(async ({ id, kg }) => {
          W.hideCatch(); W.setView({ mode: "catch", inset: 0 }); W.showCatch(id, kg, { photo: true }); step(2); const a = window.fits();
          await new Promise((done) => setTimeout(done, 1300));
          step(60); const b = window.fits(); return { a, b };
        }, { id: lid, kg: lkg });
        if (!(r.a && r.b)) fail(`${id}: photo catch did not show`);
        else {
          const wa = r.a.hi[0] - r.a.lo[0], wb = r.b.hi[0] - r.b.lo[0];
          console.log(`${id}: photo push-in, width ${wa.toFixed(2)} -> ${wb.toFixed(2)}`);
          if (!(wb > wa * 1.15)) fail(`${id}: the photo push-in does not grow the fish (${wa.toFixed(2)} -> ${wb.toFixed(2)})`);
        }
      }
      await ctx.close();
    }
  }
  // a short portrait phone with the catch card over the bottom half (main.js sends the share of the height the card covers): the fish and its board
  // fit in the free top part. The legend, its trophy weight and a usual catch of each place. In screen units the free part is -1 + 2 * share .. 1
  for (const id of IDS) {
    const S = SCENES[id];
    const [lid, lkg] = S.legend;
    const share = 0.5, freeBottom = -1 + 2 * share;
    const { ctx, page } = await open(375, 667, "high", id);
    for (const [fid, kg, tag] of [[lid, lkg, "legend"], [lid, S.trophy, "trophy"], [S.catches[0][0], S.catches[0][1], "usual"]]) {
      await shot(page, `${id}-catch-card-${tag}`, catchView, { id: fid, kg, portrait: true, hour: S.hour, bottom: share });
      if (wanted(`${id}-catch-card-${tag}`)) fitsOrFail(`${id} ${tag} on 375 x 667 with the card over the bottom half`, fid, await page.evaluate(() => window.fits()), 1, freeBottom);
    }
    // the view offset follows the share, is capped at 0.62, and only the catch view has one
    if (id === "loon" && wanted("card-offset")) {
      const r = await page.evaluate(({ id, kg }) => {
        const H = innerHeight, bad = [], off = () => (W.camera.view && W.camera.view.enabled ? W.camera.view.offsetY / H : 0);
        const at = (view) => { W.setView(view); step(2); return off(); };
        W.hideCatch(); W.showCatch(id, kg);
        const half = at({ mode: "catch", portrait: true, bottom: 0.5 });
        if (Math.abs(half - 0.25) > 1e-6) bad.push("a card over half the height should shift the picture by 0.25 of the height, not " + half.toFixed(3));
        const capped = at({ mode: "catch", portrait: true, bottom: 0.9 });
        if (Math.abs(capped - 0.31) > 1e-6) bad.push("a share of 0.9 should be capped at 0.62 (shift 0.31), not " + capped.toFixed(3));
        step(60);
        const f = window.fits();
        if (!f || f.lo[1] < -1 + 2 * 0.62 || f.hi[1] > 1) bad.push("with the cap the catch should sit in the top 38% of the view");
        const cast = at({ mode: "cast", portrait: true, bottom: 0.5 });
        if (cast !== 0) bad.push("the cast view has no card, but is shifted by " + cast.toFixed(3));
        const none = at({ mode: "catch", portrait: true, bottom: 0 });
        if (none !== 0) bad.push("no card over the bottom, but the picture is shifted by " + none.toFixed(3));
        return { bad, half, capped };
      }, { id: lid, kg: lkg });
      for (const b of r.bad) fail("card offset: " + b);
      console.log(`card offset: shift ${r.half.toFixed(3)} of the height for a share of 0.5, ${r.capped.toFixed(3)} for 0.9 (capped)`);
    }
    await ctx.close();
  }
  // the API holds up: every species and junk builds, junk rides the line, quality switches both ways
  if (wanted("api")) {
    const { ctx, page } = await open(640, 360);
    const r = await page.evaluate(() => {
      const bad = [];
      for (const id of ["pumpkinseed", "perch", "rockbass", "smallmouth", "largemouth", "walleye", "pike", "laketrout", "muskie", "golden", "boot", "plunger", "frisbee"]) {
        const m = fishMesh(id);
        if (!m || !m.isObject3D || !m.userData.fx) bad.push("fishMesh " + id);
      }
      if (fishMesh("nope") !== null) bad.push("fishMesh unknown should be null");
      W.hideCatch(); W.hideCatch();
      W.setView({ mode: "reel", look: null });
      W.setFish({ id: "boot", x: 1, y: -1, z: -8, heading: 0, len: 0.3, jump: 0, thrash: 0, roll: 0.5, near: 0.6 });
      const tip = W.setRod({ theta: 40, yaw: 0, bend: 0.4, pull: { x: 1, y: -1, z: -8 } });
      if (![tip.x, tip.y, tip.z].every(Number.isFinite)) bad.push("tip not finite");
      const t2 = W.tip(); if (Math.abs(t2.x - tip.x) > 1e-9) bad.push("tip() differs from setRod()");
      W.setLure({ x: 1, y: -1, z: -8, spin: 3 });
      W.setLine({ from: tip, to: { x: 1, y: -1, z: -8 }, slack: 0.5 });
      W.ripple(0, -5, 0.5); W.splash(2, -6, 1); W.rise(-3, -9);
      for (let i = 0; i < 30; i++) W.update(1 / 30);
      W.setQuality("low"); W.update(1 / 30); W.render();
      const lo = W.info();
      W.setQuality("high"); W.update(1 / 30); W.render();
      const hi = W.info();
      W.resize(333, 517); W.update(1 / 30); W.render();
      W.resize(640, 360);
      const info = W.info();
      if (!info.mem || !(info.mem.geometries > 0) || !(info.mem.textures > 0)) bad.push("info().mem missing: " + JSON.stringify(info.mem));
      return { bad, lo, hi };
    });
    for (const b of r.bad) fail(b);
    console.log(`api: quality switch low ${r.lo.calls} calls ${r.lo.tris} tris, high ${r.hi.calls} calls ${r.hi.tris} tris`);
    if (!(r.lo.tris < r.hi.tris)) fail("low quality should draw fewer triangles");
    await ctx.close();
  }
  // low quality (what phones get): the busy scenes of every place, for the draw call and triangle budget
  for (const id of IDS) {
    const S = SCENES[id];
    const { ctx, page } = await open(844, 390, "low", id);
    const t = await shot(page, `${id}-low-title`, title, S.hour);
    const r = await shot(page, `${id}-low-reel`, reel, { hour: S.hour, fish: S.fish, follower: S.follower });
    const c = await shot(page, `${id}-low-cast`, cast, { portrait: false, hour: S.hour });
    const k = await shot(page, `${id}-low-catch`, catchView, { id: S.catches[0][0], kg: S.catches[0][1], portrait: false, hour: S.hour });
    const kl = await shot(page, `${id}-low-catch-legend`, catchView, { id: S.legend[0], kg: S.legend[1], portrait: false, hour: S.hour });
    for (const s of [t, r, c]) if (s && (s.info.calls > budget.reel.calls || s.info.tris > budget.reel.tris)) fail(`${id}: low quality over the reel budget: ${s.info.calls} calls, ${s.info.tris} tris (at most ${budget.reel.calls} calls, ${budget.reel.tris} tris)`);
    for (const s of [k, kl]) if (s && s.info.calls > budget.catch.calls) fail(`${id}: low quality catch over budget: ${s.info.calls} calls (at most ${budget.catch.calls})`);
    // the plain retrieve: the lure on the water, the line, a follower and a gold ring in the lake. The ring's glow sprite is hidden in the reel
    // (the water ring and the sparkles still show it), so Loon Lake stays inside the 22 draw calls at the hours where the glow made it 23
    for (const hr of id === "loon" ? [S.hour, 6.5] : [S.hour]) {
      const g = await shot(page, `${id}-low-retrieve-${String(hr).replace(".", "_")}`, retrieve, { hour: hr, follower: S.follower, gold: true });
      if (g && (g.info.calls > budget.reel.calls || g.info.tris > budget.reel.tris)) fail(`${id}: low quality retrieve with a gold ring over the reel budget at ${hr} h: ${g.info.calls} calls, ${g.info.tris} tris (at most ${budget.reel.calls} calls, ${budget.reel.tris} tris)`);
      if (g) console.log(`INFO ${id} low: retrieve with a gold ring at ${hr} h ${g.info.calls} calls ${g.info.tris} tris`);
    }
    if (r) console.log(`INFO ${id} low: reel ${r.info.calls} calls ${r.info.tris} tris; catch ${k && k.info.calls} calls; legend catch ${kl && kl.info.calls} calls`);
    await ctx.close();
  }
  // the night at Stump Bay must not be too dark
  if (IDS.includes("stumps")) {
    const { ctx, page } = await open(844, 390, "low", "stumps");
    for (const h of [21.5, 23, 24.4]) {
      await shot(page, `stumps-night-title-${String(h).replace(".", "_")}`, title, h);
      await shot(page, `stumps-night-cast-${String(h).replace(".", "_")}`, cast, { portrait: false, hour: h });
      await shot(page, `stumps-night-reel-${String(h).replace(".", "_")}`, reel, { hour: h, fish: "largemouth", follower: "crappie" });
    }
    await ctx.close();
  }
  // travel: loon -> stumps -> river -> sea -> loon leaks nothing, and each trip is timed
  if (wanted("travel") || !ONLY) {
    const { ctx, page } = await open(844, 390, "low", "loon");
    const r = await page.evaluate(async () => {
      const out = { times: [], mem: [], bad: [] };
      const mem = () => { W.setView({ mode: "title" }); W.setHour(W.place().id === "stumps" ? 20 : 12); W.update(1 / 30); W.render(); return { ...W.info().mem }; };
      out.mem.push({ at: "loon", ...mem() });
      for (const id of ["stumps", "river", "sea", "loon", "stumps", "river", "sea", "loon"]) {
        const t = await W.setPlace(PLACES[id]);
        out.times.push({ id, ms: Math.round(t.ms) });
        if (W.place().id !== id) out.bad.push("place is " + W.place().id + " after setPlace(" + id + ")");
        out.mem.push({ at: id, ...mem() });
      }
      return out;
    });
    for (const b of r.bad) fail(b);
    console.log("setPlace times (ms): " + r.times.map((t) => `${t.id} ${t.ms}`).join(", "));
    console.log("memory: " + r.mem.map((m) => `${m.at} ${m.geometries}g/${m.textures}t`).join(", "));
    const first = r.mem[0];
    for (const m of r.mem.filter((m) => m.at === "loon")) {
      if (m.geometries > first.geometries * 1.05 || m.textures > first.textures * 1.05) fail(`leak: back at Loon Lake ${m.geometries} geometries, ${m.textures} textures (first: ${first.geometries}, ${first.textures})`);
    }
    // the quality can change after a trip: the ground and trees are rebuilt for the place we are at
    const q = await page.evaluate(async () => {
      const out = [];
      for (const id of ["stumps", "river", "sea", "loon"]) {
        await W.setPlace(id);   // a place id works too
        W.setQuality("high"); W.setHour(W.place().id === "stumps" ? 20 : 12); W.update(1 / 30); W.render(); const hi = W.info();
        W.setQuality("low"); W.update(1 / 30); W.render(); const lo = W.info();
        out.push({ id, place: W.place().id, hi: hi.tris, lo: lo.tris });
      }
      return out;
    });
    for (const e of q) {
      console.log(`quality switch after travel, ${e.id}: high ${e.hi} tris, low ${e.lo} tris`);
      if (e.place !== e.id || !(e.lo < e.hi)) fail(`quality switch after travel to ${e.id}: place ${e.place}, ${e.lo} tris low, ${e.hi} high`);
    }
    // after travelling the low-quality budget still holds at every place, and the picture is right
    for (const id of IDS) {
      const S = SCENES[id];
      await page.evaluate((id) => W.setPlace(PLACES[id]), id);
      const t = await shot(page, `${id}-travel-title`, title, S.hour);
      const rr = await shot(page, `${id}-travel-reel`, reel, { hour: S.hour, fish: S.fish, follower: S.follower });
      for (const s of [t, rr]) if (s && (s.info.calls > budget.reel.calls || s.info.tris > budget.reel.tris)) fail(`${id}: after travel over budget: ${s.info.calls} calls, ${s.info.tris} tris`);
    }
    await ctx.close();
  }
} catch (e) {
  fail("exception: " + (e && e.stack || e));
}
await browser.close();
stop();
const bad = errors.filter((e) => !/GPU stall due to ReadPixels|Automatic fallback to software WebGL|GroupMarkerNotSet/.test(e));
if (bad.length) { fail("console errors:\n  " + bad.join("\n  ")); }
console.log(failed ? "world.render: FAILED" : `world.render: OK (${results.length} shots in ${SHOTS})`);
process.exit(failed ? 1 : 0);

