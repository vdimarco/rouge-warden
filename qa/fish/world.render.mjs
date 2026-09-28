// Renders the Loon Lake world in set scenes and saves screenshots, then checks for errors and broken frames.
// Run: node qa/fish/world.render.mjs   (FISH_SHOTS=dir to choose where the pictures go)
// It serves public/ itself and injects a test page at /fish/__world.html, so nothing test-only lives in public/.
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
const ONLY = process.env.ONLY || "";
fs.mkdirSync(SHOTS, { recursive: true });

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const PORT = await freePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: path.join(ROOT, "public"), stdio: "ignore" });
const stop = () => { try { server.kill(); } catch (e) { /* gone */ } };
process.on("exit", stop);
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORT}/fish/js/lake.js`); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }</script>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}#game{position:fixed;inset:0}</style></head>
<body><div id="game"></div>
<script type="module">
import { createWorld, fishMesh } from "./js/world.js";
const q = new URLSearchParams(location.search).get("q") || "high";
const W = await createWorld(document.getElementById("game"), { quality: q });
window.W = W; window.fishMesh = fishMesh;
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
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], results = [];
let failed = false;
const fail = (msg) => { failed = true; console.log("FAIL " + msg); };

async function open(width, height, q = "high") {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push("console " + m.type() + ": " + m.text()); });
  if (fs.existsSync(THREE_LOCAL)) await page.route("**/three@0.170.0/build/three.module.min.js", (r) => r.fulfill({ path: THREE_LOCAL, contentType: "application/javascript" }));
  await page.route("**/fish/__world.html*", (r) => r.fulfill({ body: HARNESS, contentType: "text/html" }));
  await page.goto(`http://localhost:${PORT}/fish/__world.html?q=${q}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  return { ctx, page };
}

async function shot(page, name, setup, arg) {
  if (ONLY && !name.includes(ONLY)) return null;
  await page.evaluate(setup, arg);
  const st = await page.evaluate(() => window.frame());
  await page.screenshot({ path: path.join(SHOTS, `world-${name}.png`) });
  results.push({ name, ...st });
  const tag = `${name}: mean ${st.mean.toFixed(2)} std ${st.std.toFixed(2)} black ${(st.black * 100).toFixed(1)}% blown ${(st.blown * 100).toFixed(1)}% calls ${st.info.calls} tris ${st.info.tris}`;
  console.log(tag);
  if (st.mean < 0.08) fail(name + " is too dark");
  if (st.std < 0.025) fail(name + " looks blank");
  if (st.black > 0.2) fail(name + " has black areas");
  if (st.blown > 0.08) fail(name + " is blown out");
  return st;
}

/* scene setups (run inside the page) */
const title = (h) => { W.hideCatch(); W.setFish(null); W.setFollower(null); W.setRings([]); W.setAim({ visible: false }); W.setLure({ visible: false }); W.setLine({ visible: false }); W.setRod({ visible: false });
  W.setView({ mode: "title" }); W.setHour(h); step(120); };
const cast = ({ portrait }) => {
  W.setHour(19.5); W.hideCatch(); W.setFish(null); W.setFollower(null);
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
const flight = () => {
  W.setHour(19.5); W.hideCatch(); W.setFish(null); W.setFollower(null); W.setAim({ visible: false });
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
const reel = () => {
  W.setHour(19.5); W.hideCatch(); W.setAim({ visible: false });
  W.setRings([{ x: 11, z: -24, gold: false }, { x: -7, z: -36, gold: true }]);
  const fish = { id: "pike", x: 3.5, y: -0.2, z: -15, heading: 1.3, len: 0.85, jump: 0.42, thrash: 0.8, near: 1 };
  W.setView({ mode: "reel", look: { x: 2, y: 0, z: -13 } });
  for (let i = 0; i < 90; i++) {
    W.setFish({ ...fish, jump: i < 80 ? 0 : 0.05 + (i - 80) * 0.04 });
    W.setFollower({ id: "largemouth", x: -1.6, y: -0.5, z: -7.2, heading: 0.3, len: 0.45 });
    // rod low while it jumps, loaded toward the fish
    const tip = W.setRod({ theta: 34, yaw: 8, steer: 0.1, bend: 0.8, pull: { x: fish.x, y: 0, z: fish.z }, visible: true });
    W.setLure({ x: fish.x, y: 0.7, z: fish.z, visible: false });
    W.setLine({ from: tip, to: { x: fish.x, y: 0.75, z: fish.z }, slack: 0.02 });
    W.update(1 / 30);
  }
  // the fish is in the air now
  W.setFish({ ...fish, jump: 0.42 });
  W.update(1 / 30);
};
const catchView = ({ id, kg, portrait }) => {
  W.setHour(19.5); W.setFish(null); W.setFollower(null); W.setRings([]); W.setAim({ visible: false }); W.setLure({ visible: false }); W.setLine({ visible: false });
  W.setRod({ visible: false });
  W.setView({ mode: "catch", portrait });
  W.showCatch(id, kg);
  step(60);
};

try {
  // landscape phone: title at four hours, cast, flight, reel, catch
  {
    const { ctx, page } = await open(844, 390);
    for (const h of [6, 12, 19.5, 21]) await shot(page, "title-" + String(h).replace(".", "_"), title, h);
    await shot(page, "cast-landscape", cast, { portrait: false });
    await shot(page, "flight", flight);
    const lp = await page.evaluate(() => window.lastLure);
    if (lp) console.log(`flight: lure at ${(-lp.z).toFixed(1)} m out, ${lp.y.toFixed(1)} m high`);
    const high = await shot(page, "reel", reel);
    for (const [id, kg] of [["pike", 4.2], ["perch", 0.35], ["golden", 3.4], ["plunger", 0.5]]) await shot(page, "catch-" + id, catchView, { id, kg, portrait: false });
    if (process.env.ALL) for (const id of ["pumpkinseed", "rockbass", "smallmouth", "largemouth", "walleye", "laketrout", "muskie", "boot", "frisbee"]) await shot(page, "catch-" + id, catchView, { id, kg: null, portrait: false });
    if (high) console.log(`INFO high (reel): calls ${high.info.calls}, tris ${high.info.tris}`);
    await ctx.close();
  }
  // portrait phone: cast, and one catch card
  {
    const { ctx, page } = await open(390, 844);
    await shot(page, "cast-portrait", cast, { portrait: true });
    await shot(page, "catch-portrait-pike", catchView, { id: "pike", kg: 4.2, portrait: true });
    await ctx.close();
  }
  // the API holds up: every species and junk builds, junk rides the line, quality switches both ways
  {
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
      W.setFish({ id: "boot", x: 1, y: -1, z: -8, heading: 0, len: 0.3, jump: 0, thrash: 0, near: 0.6 });
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
      return { bad, lo, hi };
    });
    for (const b of r.bad) fail(b);
    console.log(`api: quality switch low ${r.lo.calls} calls ${r.lo.tris} tris, high ${r.hi.calls} calls ${r.hi.tris} tris`);
    if (!(r.lo.tris < r.hi.tris)) fail("low quality should draw fewer triangles");
    await ctx.close();
  }
  // low quality: the same busy scenes, for the draw call and triangle budget
  {
    const { ctx, page } = await open(844, 390, "low");
    const t = await shot(page, "low-title", title, 19.5);
    const r = await shot(page, "low-reel", reel);
    const c = await shot(page, "low-cast", cast, { portrait: false });
    for (const s of [t, r, c]) if (s && (s.info.calls > 120 || s.info.tris > 200000)) fail(`low quality over budget: ${s.info.calls} calls, ${s.info.tris} tris`);
    if (r) console.log(`INFO low (reel): calls ${r.info.calls}, tris ${r.info.tris}`);
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
