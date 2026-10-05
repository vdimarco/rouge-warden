// Shared helpers for the In Full Swing browser tests (spec §12): a static server for public/ on a random port (unless
// VR_URL is set), headless Chromium on SwiftShader, the jsDelivr relay, error collection, the page and XR helpers,
// IWER drivers, the fake clock, screenshots and PASS/FAIL reporting.
// Run a test from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/<name>.mjs
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { readFile, mkdir } from "fs/promises";
import http from "http";
import path from "path";

const { chromium } = createRequire(import.meta.url)("playwright");
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PUB = path.join(ROOT, "public");
export const SHOTS = process.env.SHOTS || "";
// Messages that are not ours: SEM bundles its own three.js, and SwiftShader warns on every pixel read.
export const IGNORE = [/Multiple instances of Three\.js/i, /GPU stall due to ReadPixels/i, /Service Worker registration blocked by Playwright/i];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- reporting ---------------- */
// checker(name) → { check(ok, msg), done() }. Each check prints a PASS or FAIL line; done() prints the summary
// and sets the exit code. Call done() once at the end (after close()).
export function checker(name) {
  const fails = [];
  let passes = 0;
  const check = (ok, msg, detail) => {
    if (ok) { passes++; console.log("PASS: " + msg); }
    else { fails.push(msg); console.log("FAIL " + msg + (detail !== undefined ? "\n  " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : "")); }
    return !!ok;
  };
  const done = () => {
    if (fails.length) { console.log("FAIL: " + name + " (" + fails.length + " failed, " + passes + " passed)"); process.exitCode = 1; }
    else console.log("PASS: " + name);
    return fails.length === 0;
  };
  return { check, done, fails };
}
// Fails the whole run if it takes longer than ms (software rendering can hang on a bad frame).
export function watchdog(ms, name) {
  const t = setTimeout(() => { console.log("FAIL: " + name + " (timed out after " + Math.round(ms / 1000) + " s)"); process.exit(1); }, ms);
  t.unref();
  return t;
}

/* ---------------- server ---------------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".css": "text/css", ".ico": "image/x-icon", ".md": "text/plain", ".mp3": "audio/mpeg", ".webm": "video/webm", ".mp4": "video/mp4" };
let server = null, sockets = new Set(), pageURL = null, browser = null;
export async function serve() {
  if (pageURL) return pageURL;
  if (process.env.VR_URL) return (pageURL = process.env.VR_URL.replace(/\/?$/, "/"));
  server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(PUB, p);
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (e) { res.writeHead(404); res.end("not found"); }
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return (pageURL = "http://127.0.0.1:" + server.address().port + "/vr/");
}
export async function launch() {
  if (browser) return browser;
  browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  return browser;
}
// Closes the browser and our server (never anything else that runs on this machine).
export async function close() {
  if (browser) { await browser.close().catch(() => {}); browser = null; }
  if (server) { await new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); }); server = null; pageURL = null; }
}

/* ---------------- the CDN relay ---------------- */
// Chromium here does not trust the proxy's CA. Playwright's Node-side fetch does (NODE_EXTRA_CA_CERTS), so jsDelivr
// requests go through it, cached in memory for the whole run. TLS checks stay on.
const cdnCache = new Map();
async function relay(route) {
  const url = route.request().url();
  let hit = cdnCache.get(url);
  if (!hit) {
    let r = null, err = null;
    for (let i = 0; i < 3 && !r; i++) { try { r = await route.fetch(); } catch (e) { err = e; await sleep(500 * (i + 1)); } }
    if (!r) { console.log("INFO: CDN relay failed for " + url + ": " + (err && err.message)); return route.abort(); }
    hit = { status: r.status(), headers: { "content-type": r.headers()["content-type"] || "text/javascript", "access-control-allow-origin": "*" }, body: await r.body() };
    if (hit.status === 200) cdnCache.set(url, hit);
  }
  return route.fulfill(hit);
}

/* ---------------- pages ---------------- */
// newPage({ width, height, clock, clear, sw }) → a page with page.errors collecting page errors and console errors
// and warnings (except IGNORE). clock: true installs Playwright's fake clock before any script runs.
export async function newPage({ width = 640, height = 360, clock = false, clear = true, sw = false } = {}) {
  await serve();
  await launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: sw ? "allow" : "block" });
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//, relay);
  // the page's display fonts: an empty stylesheet, so no test waits on the network for them
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n")));
  page.on("console", (m) => {
    const t = m.type(), text = m.text();
    if ((t === "error" || t === "warning") && !IGNORE.some((r) => r.test(text))) page.errors.push(t + ": " + text);
  });
  if (clear) await page.addInitScript(() => { if (!sessionStorage.getItem("qa-kept")) { try { localStorage.clear(); } catch (e) { /* storage off */ } sessionStorage.setItem("qa-kept", "1"); } });
  if (clock) await page.clock.install({ time: 0 });
  page.clock_ = { installed: clock, paused: false };
  return page;
}
// open(page, flags) loads /vr/ with the flags ("?emulate&skipintro") and waits until G is ready.
export async function open(page, flags = "", { wait = true } = {}) {
  // the comic scenes (cutscene.js) stop the game for a while: a test plays none unless it asks for them with "cut"
  if (!/(^|[?&])cut(&|$)/.test(flags)) flags = flags ? flags + (flags.endsWith("?") ? "" : "&") + "nocut" : "?nocut";
  const url = (await serve()) + (flags && !flags.startsWith("?") ? "?" + flags : flags);
  await page.goto(url);
  if (wait) await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 180000, polling: 100 });
  return page;
}
// A new page with the game loaded: start(flags, pageOpts)
export async function start(flags = "", opts = {}) { const page = await newPage(opts); await open(page, flags); return page; }

export const state = (page) => page.evaluate(() => G.test.state());
export const input = (page) => page.evaluate(() => G.test.input());
export const events = (page) => page.evaluate(() => G.test.events());
// waitFor(page, fn, arg, timeout): polls fn in the page until it returns truthy
export const waitFor = (page, fn, arg, timeout = 120000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
// waitState(page, { mode, state }): both must match (either can be left out)
export async function waitState(page, want, timeout = 120000) {
  if (page.clock_ && page.clock_.paused) {
    const t0 = Date.now();
    for (;;) {
      const s = await state(page);
      if ((!want.mode || s.mode === want.mode) && (!want.state || s.state === want.state)) return s;
      if (Date.now() - t0 > timeout) throw new Error("waitState timed out: " + JSON.stringify(want) + " now " + s.mode + "/" + s.state);
      await page.clock.runFor(16);
    }
  }
  try { await page.waitForFunction((w) => (!w.mode || G.mode === w.mode) && (!w.state || G.state === w.state), want, { timeout, polling: 50 }); }
  catch (e) {
    // say where the game stands: a timeout alone does not tell a pause from a slow opening
    const s = await state(page).catch(() => null);
    throw new Error("waitState timed out: " + JSON.stringify(want) + " now " + (s ? s.mode + "/" + s.state + " frame " + s.frame + " time " + s.time.toFixed(2) : "unknown"));
  }
  return state(page);
}

// enterXR(page, mode): clicks the right title button ("ar" | "vr" | "desktop") and waits for the session (or flat play).
export async function enterXR(page, mode = "vr") {
  const id = mode === "ar" ? "#enterAR" : mode === "vr" ? "#enterVR" : "#playFlat";
  await page.waitForSelector(id + ":not([hidden]):not([disabled])", { timeout: 120000 });
  await page.click(id);
  if (mode === "desktop") await page.waitForFunction(() => G.mode === "desktop", null, { timeout: 60000 });
  else await page.waitForFunction((m) => G.mode === m && G.xr && G.xr.session, mode, { timeout: 60000, polling: 50 });
  return state(page);
}

/* ---------------- time ---------------- */
// With newPage({ clock: true }): freeze() stops time (and XR frames), then frames(n) and run(ms) move it exactly.
// The fake clock flows with real time until then, so the pause point must lie a little ahead of the page's time.
export async function freeze(page) {
  for (let i = 0; ; i++) {
    const now = await page.evaluate(() => Date.now());
    try { await page.clock.pauseAt(now + 250 * (i + 1)); break; }
    catch (e) { if (i >= 4 || !/past/i.test(e.message)) throw e; }
  }
  page.clock_.paused = true;
  // the first frames after a pause can come late: step until they come every 16 ms
  await frames(page, 3);
}
export async function run(page, ms) {
  if (page.clock_ && page.clock_.paused) await page.clock.runFor(ms);
  else await sleep(ms);
}
// Waits for n more game frames (G.frame). Under a frozen clock it steps 16 ms at a time and stops as soon as the n-th
// frame has run, so frames(page, 1) is exactly one XR frame (the edge tests rely on it).
export async function frames(page, n = 1) {
  const f0 = await page.evaluate(() => G.frame);
  if (page.clock_ && page.clock_.paused) {
    for (let i = 0; i < n * 40; i++) {
      if ((await page.evaluate(() => G.frame)) >= f0 + n) return;
      await page.clock.runFor(16);
    }
    throw new Error("frames(" + n + "): the XR loop did not advance");
  }
  await page.waitForFunction((t) => G.frame >= t, f0 + n, { timeout: 120000, polling: 16 });
}

// Pixels from the first frame that the game draws after change(arg) ran. The page runs change and queues the read in one task,
// so no frame can draw between them, and the frame that answers the read shows the new state. A wait of a set time cannot promise
// this. Under load a frame can draw before the read is queued, and the vignette and the speed lines draw only on the first frame
// after a comfort.update. change runs in the page, so it must not use variables of the test.
// Under a frozen clock this steps 16 ms at a time until that frame has drawn. Otherwise it waits for the frame.
export async function sampleAfter(page, points, change, arg) {
  await page.evaluate(`(() => {
    const q = (window.__sampleAfter = { done: false });
    (${change})(${JSON.stringify(arg)});
    G.test.sample(${JSON.stringify(points)}).then((px) => { q.px = px; q.done = true; }, (e) => { q.error = String(e); q.done = true; });
  })()`);
  const done = () => page.evaluate(() => window.__sampleAfter);
  let q = await done();
  if (page.clock_ && page.clock_.paused) {
    for (let i = 0; i < 40 && !q.done; i++) { await page.clock.runFor(16); q = await done(); }
  } else {
    await page.waitForFunction(() => window.__sampleAfter.done, null, { timeout: 120000, polling: 16 });
    q = await done();
  }
  if (!q.done) throw new Error("sampleAfter: the game drew no frame in 40 steps");
  if (q.error) throw new Error("sampleAfter: " + q.error);
  return q.px;
}

/* ---------------- IWER (window.xrDevice) ---------------- */
// Poses are tracking space (local-floor). pos [x, y, z], quat [x, y, z, w]. Values apply at the next XR frame.
export const device = (page, fn, arg) => page.evaluate(fn, arg);
export async function head(page, { pos, quat } = {}) {
  await page.evaluate(({ pos, quat }) => { const d = window.xrDevice; if (pos) d.position.set(...pos); if (quat) d.quaternion.set(...quat); }, { pos, quat });
}
// controller(page, "left" | "right", { pos, quat, trigger, squeeze, stick: [x, y], buttons: { "a-button": 1, ... } })
export async function controller(page, side, o = {}) {
  await page.evaluate(({ side, o }) => {
    const c = window.xrDevice.controllers[side];
    if (o.pos) c.position.set(...o.pos);
    if (o.quat) c.quaternion.set(...o.quat);
    if (o.trigger != null) c.updateButtonValue("trigger", o.trigger);
    if (o.squeeze != null) c.updateButtonValue("squeeze", o.squeeze);
    if (o.stick) c.updateAxes("thumbstick", o.stick[0], o.stick[1]);
    if (o.buttons) for (const [id, v] of Object.entries(o.buttons)) c.updateButtonValue(id, v);
  }, { side, o });
}
// hand(page, "left" | "right", { pos, quat, pose: "default" | "pinch" | "point", pinch: 0..1 })
export async function hand(page, side, o = {}) {
  await page.evaluate(({ side, o }) => {
    const h = window.xrDevice.hands[side];
    if (o.pos) h.position.set(...o.pos);
    if (o.quat) h.quaternion.set(...o.quat);
    if (o.pose) h.poseId = o.pose;
    if (o.pinch != null) h.updatePinchValue(o.pinch);
  }, { side, o });
}
export const inputMode = (page, mode) => page.evaluate((m) => { window.xrDevice.primaryInputMode = m; }, mode);
export const visibility = (page, s) => page.evaluate((v) => window.xrDevice.updateVisibilityState(v), s);
export const recenter = (page) => page.evaluate(() => window.xrDevice.recenter());
// The RemoteControlInterface (the API IWSDK's agent tools use). Its commands run at the next frame start, so under a
// frozen clock this steps time until the command resolves.
export async function remote(page, method, params = {}) {
  await page.evaluate(({ method, params }) => { window.__remote = { done: false }; window.xrDevice.remote.dispatch(method, params).then((r) => { window.__remote = { done: true, r }; }, (e) => { window.__remote = { done: true, error: String(e) }; }); }, { method, params });
  for (let i = 0; i < 400; i++) {
    const r = await page.evaluate(() => window.__remote);
    if (r.done) { if (r.error) throw new Error(r.error); return r.r; }
    await run(page, 16);
  }
  throw new Error("remote " + method + " did not finish");
}

/* ---------------- maths for poses ---------------- */
// The quaternion that turns −z (a controller's pointing direction) to dir.
export function lookQuat(dir) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1, b = [dir[0] / l, dir[1] / l, dir[2] / l];
  const d = -b[2]; // dot((0, 0, −1), b)
  if (d < -0.999999) return [0, 1, 0, 0];
  // axis = (0, 0, −1) × b
  const q = [b[1], -b[0], 0, 1 + d], n = Math.hypot(...q);
  return q.map((v) => v / n);
}
export const axisQuat = (axis, angle) => { const s = Math.sin(angle / 2), l = Math.hypot(...axis); return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(angle / 2)]; };
export function mulQuat(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ---------------- screenshots ---------------- */
// shot(page, name): saves SHOTS/<name>.png when SHOTS is set. Returns the path or null.
export async function shot(page, name) {
  if (!SHOTS) return null;
  await mkdir(SHOTS, { recursive: true });
  const file = path.join(SHOTS, name + ".png");
  await page.screenshot({ path: file });
  return file;
}
