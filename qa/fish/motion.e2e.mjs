// End-to-end check of motion.js in Chromium: node qa/fish/motion.e2e.mjs
// Chromium's CDP sensor overrides (virtual sensors) make real, trusted devicemotion and deviceorientation events.
// This serves public/ with python3 -m http.server on a free port and opens public/fish/index.html as a phone
// (390×844, touch, motion permissions granted). It drives window.FISH.Motion and checks the rod pose.
// If the real page cannot boot (a module missing, WebGL or the three.js CDN unavailable), it falls back to a tiny
// harness page that imports only motion.js, and says which path ran. Exit code 1 on failure.
// Set FISH_PAGE=harness to skip the real page, FISH_BLOCK=world.js to make that module 404 (tries the fallback),
// THREE_LOCAL = a local three.module.min.js if the CDN is blocked.
import { createRequire } from "module";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import net from "net";
import path from "path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, "../../public");
const D2R = Math.PI / 180;

// the playwright package from this project, NODE_PATH, or the global install
function loadPlaywright() {
  try { return createRequire(import.meta.url)("playwright"); } catch (e) { /* not local */ }
  const root = execSync("npm root -g").toString().trim();
  return createRequire(path.join(root, "noop.js"))("playwright");
}
const { chromium } = loadPlaywright();

/* ---------------- reporting ---------------- */
const fails = [];
let passes = 0;
function check(ok, msg) { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); }
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v));
const near = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- CDP sensor helpers (after the research brief's motion-test-helpers.mjs) ---------------- */
// Call enableVirtualSensors BEFORE page.goto: the pumps must see the overrides when the page's listeners start.
async function enableVirtualSensors(page) {
  const cdp = await page.context().newCDPSession(page);
  for (const type of ["accelerometer", "linear-acceleration", "gyroscope", "relative-orientation"]) await cdp.send("Emulation.setSensorOverrideEnabled", { enabled: true, type });
  // every overridden motion sensor needs a reading, or devicemotion never fires
  await setMotion(cdp, {});
  await setQuat(cdp, qx(90)); // upright portrait
  return cdp;
}
// gyroDeg in deg/s about phone x, y, z (CDP takes rad/s; it comes out as rotationRate alpha, beta, gamma).
// gravity = accelerationIncludingGravity (spec sign: +9.81 on the axis that points up); it follows the last attitude set
let grav = { x: 0, y: 9.81, z: 0 };
async function setMotion(cdp, { gyroDeg = { x: 0, y: 0, z: 0 }, gravity = grav }) {
  await cdp.send("Emulation.setSensorOverrideReadings", { type: "gyroscope", reading: { xyz: { x: gyroDeg.x * D2R, y: gyroDeg.y * D2R, z: gyroDeg.z * D2R } } });
  await cdp.send("Emulation.setSensorOverrideReadings", { type: "accelerometer", reading: { xyz: gravity } });
  await cdp.send("Emulation.setSensorOverrideReadings", { type: "linear-acceleration", reading: { xyz: { x: 0, y: 0, z: 0 } } });
}
// Quaternions for the phone's attitude (phone axes → earth axes: x east, y north, z up). R = A·B ↔ q = qA·qB.
const qAxis = (ax, ay, az, deg) => { const h = (deg * D2R) / 2, s = Math.sin(h); return { w: Math.cos(h), x: ax * s, y: ay * s, z: az * s }; };
const qx = (d) => qAxis(1, 0, 0, d), qy = (d) => qAxis(0, 1, 0, d), qz = (d) => qAxis(0, 0, 1, d);
const qmul = (...qs) => qs.reduce((a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
}));
async function setQuat(cdp, q) {
  await cdp.send("Emulation.setSensorOverrideReadings", { type: "relative-orientation", reading: { quaternion: { x: q.x, y: q.y, z: q.z, w: q.w } } });
}
// set the attitude, and make the accelerometer agree with it (like a real phone held still)
async function setPose(cdp, q) {
  const { w, x, y, z } = q; // up in phone axes = the third row of R(q)
  grav = { x: 9.81 * 2 * (x * z - w * y), y: 9.81 * 2 * (y * z + w * x), z: 9.81 * (1 - 2 * (x * x + y * y)) };
  await setQuat(cdp, q);
  await setMotion(cdp, {});
}
// Poses, as in motion.test.mjs. θ = rod angle; side +1 = phone turned counter-clockwise (top to the left)
const portrait = (th) => qx(th);
const landscape = (th, side = 1, roll = 0) => qmul(qy(roll), qx(th), qz(90 * side));

/* ---------------- three.js from the CDN, fetched by node ---------------- */
// Chromium's own requests through a proxy can fail at random (ERR_TOO_MANY_RETRIES); node's fetch is steadier.
// Cached per run, retried a few times; if it still fails the request goes on to the network as usual.
const cdnCache = new Map();
async function viaNode(route) {
  const url = route.request().url();
  if (!cdnCache.has(url)) {
    cdnCache.set(url, (async () => {
      for (let i = 0; i < 4; i++) {
        try {
          const r = await fetch(url);
          if (r.ok) return { body: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "application/javascript" };
        } catch (e) { /* retry */ }
        await sleep(300 * (i + 1));
      }
      return null;
    })());
  }
  const got = await cdnCache.get(url);
  if (!got) { cdnCache.delete(url); return route.continue(); }
  return route.fulfill({ status: 200, body: got.body, headers: { "content-type": got.type, "access-control-allow-origin": "*" } });
}

/* ---------------- a static server for public/ ---------------- */
async function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
}
async function serve() {
  const port = await freePort();
  const proc = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: PUBLIC, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + "/fish/js/motion.js"); if (r.ok) return { proc, base }; } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  proc.kill();
  throw new Error("the static server did not start");
}

/* ---------------- run ---------------- */
const { proc, base } = await serve();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
// serviceWorkers "block": a page in app mode registers sw.js, and a worker would answer the requests that page.route() must see
const phone = { isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, serviceWorkers: "block" };
let exitCode = 0;
try {
  const ctx = await browser.newContext({ ...phone, permissions: ["accelerometer", "gyroscope", "magnetometer"] });

  async function openPage(url, route) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    page.on("requestfailed", (r) => {
      const why = (r.failure() && r.failure().errorText) || "";
      if (!/ERR_ABORTED/.test(why)) errors.push("requestfailed: " + r.url() + " (" + why + ")"); // aborted prefetches are harmless
    });
    page.on("response", (r) => { if (r.status() >= 400 && /\/fish\//.test(r.url())) errors.push("http " + r.status() + ": " + r.url()); });
    await page.route("https://cdn.jsdelivr.net/**", viaNode);
    if (process.env.THREE_LOCAL) await page.route("**/three.module.min.js", (r) => r.fulfill({ path: process.env.THREE_LOCAL, contentType: "application/javascript" }));
    if (process.env.FISH_BLOCK) await page.route("**/fish/js/" + process.env.FISH_BLOCK, (r) => r.fulfill({ status: 404, body: "" }));
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
    if (route) await page.route(url, (r) => r.fulfill({ contentType: "text/html", body: route }));
    const cdp = await enableVirtualSensors(page);
    await page.goto(url);
    return { page, cdp, errors };
  }

  // 1. the real page, if it boots. A missing module never recovers; a network hiccup (the three.js CDN) gets one retry
  let P = null, which = "";
  for (let attempt = 1; attempt <= 2 && !P && process.env.FISH_PAGE !== "harness"; attempt++) {
    const t0 = Date.now();
    const o = await openPage(base + "/fish/index.html");
    let ok = false;
    for (let i = 0; i < 1200 && !ok; i++) {
      ok = await o.page.evaluate(() => !!(window.FISH && window.FISH.Motion)).catch(() => false);
      if (ok) break;
      if (o.errors.some((e) => /^(http 4|requestfailed|pageerror)/.test(e) || /cannot draw the lake/i.test(e))) { await sleep(300); break; }
      await sleep(100);
    }
    if (ok) { P = o; which = `the real page public/fish/index.html (booted in ${Date.now() - t0} ms${attempt > 1 ? ", second try" : ""})`; break; }
    const hard = o.errors.some((e) => /^(http 4|pageerror)/.test(e) || /requestfailed: [^ ]*\/fish\//.test(e));
    console.log(`  The real page did not boot (try ${attempt}). Why:\n    ` + (o.errors.slice(0, 6).join("\n    ") || "window.FISH never appeared"));
    await o.page.close();
    if (hard) break;
  }
  if (!P && process.env.FISH_PAGE !== "harness") console.log("  So this run uses the harness page.");
  // 2. the fallback: only motion.js, same origin and path, so the import is the real file
  if (!P) {
    const html = `<!doctype html><meta name="viewport" content="width=device-width"><body><script type="module">
      import { Motion } from "./js/motion.js";
      window.FISH = { Motion };
    </script></body>`;
    P = await openPage(base + "/fish/motion-harness.html", html);
    await P.page.waitForFunction(() => window.FISH && window.FISH.Motion, null, { timeout: 20000 });
    which = "the harness page (motion.js only, served at /fish/motion-harness.html by page.route)";
  }
  const { page, cdp, errors } = P;
  console.log("\nPath: " + which);

  // count trusted events the page gets, and the pose samples Motion hands out
  await page.evaluate(() => {
    window.__ev = { motion: 0, trusted: 0, orient: 0 };
    addEventListener("devicemotion", (e) => { __ev.motion++; if (e.isTrusted) __ev.trusted++; });
    addEventListener("deviceorientation", (e) => { if (e.isTrusted) __ev.orient++; });
    window.__minOmega = 0; window.__maxOmega = 0; window.__samples = 0;
    FISH.Motion.on((p) => { __samples++; if (p.omega < __minOmega) __minOmega = p.omega; if (p.omega > __maxOmega) __maxOmega = p.omega; });
  });
  const pose = () => page.evaluate(() => { const M = FISH.Motion, p = M.pose; return { status: M.status, live: M.live, mode: M.mode, t: p.t, theta: p.theta, omega: p.omega, yaw: p.yaw, roll: p.roll, twist: p.twist, spin: p.spin, orient: p.orient, side: p.side, up: { ...p.up } }; });
  const setMode = (m) => page.evaluate((m) => { FISH.Motion.mode = m; }, m);

  console.log("\n1. Permission and trusted events");
  const info = await page.evaluate(() => ({ available: FISH.Motion.available, needsPermission: FISH.Motion.needsPermission, status: FISH.Motion.status, hasRP: typeof DeviceMotionEvent.requestPermission }));
  check(info.available, `Motion.available ${info.available}, needsPermission ${info.needsPermission} (requestPermission is ${info.hasRP} in this Chromium), status before request: ${info.status}`);
  const st = await page.evaluate(() => FISH.Motion.request());
  await sleep(300);
  const ev = await page.evaluate(() => ({ ...__ev, samples: __samples }));
  check(st === "granted", `request() → ${st}`);
  check(ev.trusted > 5 && ev.trusted === ev.motion && ev.orient >= 1 && ev.samples > 5, `trusted events: ${ev.trusted}/${ev.motion} devicemotion, ${ev.orient} deviceorientation; ${ev.samples} pose samples`);

  console.log("\n2. Poses through the CDP sensors (hold each 600 ms)");
  const poses = [
    ["portrait upright", "portrait", portrait(90), { theta: 90, orient: "portrait" }],
    ["portrait tipped back 40° (loaded)", "portrait", portrait(130), { theta: 130, orient: "portrait" }],
    ["portrait tipped forward to 60° (11 o'clock)", "portrait", portrait(60), { theta: 60, orient: "portrait" }],
    ["landscape side +1 upright", "landscape", landscape(90, 1), { theta: 90, orient: "landscape", side: 1 }],
    ["landscape side +1 rod raised back 30°", "landscape", landscape(120, 1), { theta: 120, orient: "landscape", side: 1 }],
    ["landscape side +1 rod lowered to 50°", "landscape", landscape(50, 1), { theta: 50, orient: "landscape", side: 1 }],
    ["landscape side +1 steered 17.5° clockwise", "landscape", landscape(90, 1, 17.5), { theta: 90, orient: "landscape", side: 1, roll: 0.5 }],
    ["landscape side −1 upright", "landscape", landscape(90, -1), { theta: 90, orient: "landscape", side: -1 }],
    ["landscape side −1 steered 17.5° counter-clockwise", "landscape", landscape(90, -1, -17.5), { theta: 90, orient: "landscape", side: -1, roll: -0.5 }],
    ["back to portrait upright", "portrait", portrait(90), { theta: 90, orient: "portrait" }],
  ];
  for (const [name, mode, q, want] of poses) {
    await setMode(mode);
    await setPose(cdp, q);
    await sleep(600);
    const p = await pose();
    const ok = near(p.theta, want.theta, 1) && p.orient === want.orient && (want.side == null || p.side === want.side) && (want.roll == null || near(p.roll, want.roll, 0.03)) && p.live;
    check(ok, `${name}: θ ${f1(p.theta)} (want ${want.theta}), ${p.orient}${p.orient === "landscape" ? " side " + p.side : ""}${want.roll != null ? ", roll " + p.roll.toFixed(2) : ""}, up (${p.up.x.toFixed(2)}, ${p.up.y.toFixed(2)}, ${p.up.z.toFixed(2)})`);
  }

  console.log("\n3. Gyro through the CDP sensors");
  await setMode("portrait");
  await setPose(cdp, portrait(90));
  await sleep(600);
  await page.evaluate(() => { __minOmega = 0; __maxOmega = 0; });
  // a forward whip: rotationRate.alpha (about phone x) swings to −1400 deg/s and back
  for (let i = 0; i < 15; i++) { await setMotion(cdp, { gyroDeg: { x: -1400 * Math.sin((Math.PI * i) / 14), y: 0, z: 0 } }); await sleep(17); }
  await setMotion(cdp, {});
  await sleep(200);
  const whip = await page.evaluate(() => ({ min: __minOmega, max: __maxOmega }));
  check(whip.min < -1000 && whip.max < 50, `CDP whip about phone x: min ω ${f1(whip.min)} deg/s (large and negative: forward), max ${f1(whip.max)}`);
  // landscape: pulling the rod up turns the phone about −side·y, so rotationRate.beta is negative for side +1
  await setMode("landscape");
  await setPose(cdp, landscape(90, 1));
  await sleep(600);
  await setMotion(cdp, { gyroDeg: { x: 0, y: -600, z: 0 } });
  await sleep(120);
  const pull = await pose();
  await setMotion(cdp, {});
  check(near(pull.omega, 600, 5) && pull.side === 1, `landscape side +1, rotationRate.beta −600: ω ${f1(pull.omega)} (+ = pulling up)`);
  // the wrist twist (about the long axis) and a right turn
  await setMode("portrait");
  await setPose(cdp, portrait(90));
  await sleep(600);
  await setMotion(cdp, { gyroDeg: { x: 0, y: 500, z: 0 } });
  await sleep(120);
  const tw = await pose();
  await setMotion(cdp, {});
  check(near(tw.twist, 500, 1) && near(tw.spin, 500, 1), `wrist twist, rotationRate.beta 500: twist ${f1(tw.twist)}, spin ${f1(tw.spin)}`);
  await sleep(200);
  await page.evaluate(() => FISH.Motion.recenter());
  const tA = await page.evaluate(() => performance.now());
  // upright portrait: world up is phone +y, and turning right is clockwise from above, so rotationRate.beta is negative
  await setMotion(cdp, { gyroDeg: { x: 0, y: -90, z: 0 } });
  await sleep(500);
  await setMotion(cdp, {});
  const tB = await page.evaluate(() => performance.now());
  await sleep(150);
  const yw = await pose();
  const wantYaw = (90 * (tB - tA)) / 1000;
  check(near(yw.yaw, wantYaw, 8) && yw.yaw > 0, `turning right at 90 deg/s for ~${Math.round(tB - tA)} ms: yaw ${f1(yw.yaw)} (want about +${f1(wantYaw)}), θ stays ${f1(yw.theta)}`);

  console.log("\n4. No console errors");
  const bad = errors.filter((e) => !/favicon/i.test(e));
  check(bad.length === 0, bad.length ? "errors:\n    " + bad.join("\n    ") : "none");
  await ctx.close();

  // 5. no sensor permission: Chromium sends one all-null event and then nothing
  console.log("\n5. Blocked sensors");
  const ctx2 = await browser.newContext({ ...phone });
  const page2 = await ctx2.newPage();
  await page2.route(base + "/fish/motion-harness.html", (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><script type="module">import { Motion } from "./js/motion.js"; window.FISH = { Motion };</script>` }));
  const cdp2 = await enableVirtualSensors(page2);
  void cdp2;
  await page2.goto(base + "/fish/motion-harness.html");
  await page2.waitForFunction(() => window.FISH && window.FISH.Motion);
  const r2 = await page2.evaluate(async () => {
    const seen = [];
    addEventListener("devicemotion", (e) => seen.push(e.rotationRate && e.rotationRate.alpha));
    const t0 = performance.now(), st = await FISH.Motion.request();
    return { st, ms: Math.round(performance.now() - t0), events: seen.length, nulls: seen.filter((v) => v == null).length, live: FISH.Motion.live };
  });
  check(r2.st === "no-data" && !r2.live, `no motion permission: request() → ${r2.st} after ${r2.ms} ms (${r2.events} devicemotion events, ${r2.nulls} all-null)`);
  await ctx2.close();
  console.log("\nPath used: " + which);
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
console.log(`\n${passes} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); exitCode = 1; }
process.exit(exitCode);
