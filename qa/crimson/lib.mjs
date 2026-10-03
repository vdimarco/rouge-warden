// Shared setup for the Crimson Rouge QA scripts.
// Serve public/ first, for example: cd public && python3 -m http.server 8765
// Run a script with: NODE_PATH=/opt/node22/lib/node_modules node qa/crimson/<name>.mjs
// Set CRIMSON_URL to change the address (a git worktree serves its own public/ on its own port).
import { createRequire } from "module";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import zlib from "zlib";
// Uses the playwright package from this project or from NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright");

export const URL_BASE = process.env.CRIMSON_URL || "http://localhost:8765/crimson/";
export const UPDATE = process.argv.includes("--update");
export const here = (p) => new URL(p, import.meta.url).pathname;

// Open the game at URL_BASE + query, wait until the models are loaded, and take manual control:
// from then on nothing moves unless the test steps it.
export async function open({ query = "", width = 640, height = 360, touch = false, dpr = 1, clear = true, blockFilm = true, manual = true, autoplay = "no-user-gesture-required", before = null } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CRIMSON_CHROMIUM || undefined, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=" + autoplay] });
  const ctx = await browser.newContext(touch ? { viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: dpr, ignoreHTTPSErrors: true } : { viewport: { width, height }, deviceScaleFactor: dpr, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  // software rendering is slow, and the page loads its 3D models before the title screen
  page.setDefaultTimeout(240000);
  page.setDefaultNavigationTimeout(240000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR_|ERR_FAILED|ERR_BLOCKED/.test(m.text())) errors.push("console: " + m.text()); });
  // Only the local server is reached. Google Fonts gets empty CSS; SoundCloud and every other outside host are cut off.
  const origin = new URL(URL_BASE).origin;
  await page.route((u) => u.origin !== origin, (r) => {
    const u = r.request().url();
    if (u.startsWith("https://fonts.googleapis.com/")) return r.fulfill({ body: "", contentType: "text/css" });
    return r.abort();
  });
  // the transform film would hand time to a real video; the tests run the change in the engine
  if (blockFilm) await page.route("**/clips/**", (r) => r.abort());
  // (inside a try: a blocked or opaque frame has no storage)
  if (clear) await page.addInitScript(() => { try { if (!sessionStorage.getItem("qa-kept")) { localStorage.clear(); sessionStorage.setItem("qa-kept", "1"); } } catch (e) { /* no storage here */ } });
  // a test's own routes go last, so they win over the ones above
  if (before) await before(page);
  await page.goto(URL_BASE + query);
  await page.waitForFunction(() => window.__crimson && __crimson.game.ready, null, { timeout: 300000, polling: 100 });
  if (manual) await page.evaluate(() => __crimson.step(0, false));
  return { browser, page, errors };
}

// Step the game by sec seconds of game time (60 ticks a second), in chunks so no single call runs too long.
export async function step(page, sec, { draw = false } = {}) {
  let n = Math.round(sec * 60);
  while (n > 0) {
    const k = Math.min(n, 600); n -= k;
    await page.evaluate(([k, d]) => __crimson.step(k / 60, d), [k, n === 0 && draw]);
  }
}

// Run fn(arg, tick) in the page before each tick, for up to `ticks` ticks, 600 ticks per evaluate.
// fn runs inside the page (it cannot see Node variables); it returns true to stop.
// Returns { ticks, stopped }.
export async function loop(page, ticks, fn, arg = null, { chunk = 600 } = {}) {
  let done = 0;
  while (done < ticks) {
    const n = Math.min(chunk, ticks - done);
    const r = await page.evaluate(([src, n, arg, base]) => {
      const f = (0, eval)("(" + src + ")");
      for (let i = 0; i < n; i++) { if (f(arg, base + i)) return { i, stopped: true }; __crimson.step(1 / 60, false); }
      return { i: n, stopped: false };
    }, [fn.toString(), n, arg, done]);
    done += r.i;
    if (r.stopped) return { ticks: done, stopped: true };
  }
  return { ticks: done, stopped: false };
}

// Leave the chapter's mission for free roam (the sandbox the package tests play in): read every line
// through, skip the cine, quit the mission, and step until play goes on with nothing modal or locked.
// (With the real MISSIONS and content, ?chapter=f1 opens on F1's chapter card, intro cine and talk.)
export async function freeRoam(page, { maxSec = 10 } = {}) {
  await page.evaluate(() => { const S = __crimson.story.S; S.ui.advanceAll(); if (S.cine.active) S.cine.skip(); S.missions.quit(); });
  return stepUntil(page, () => { const S = __crimson.story.S; if (S.modal) S.ui.advanceAll(); return S.mode === "play" && !S.freeze && !S.modal && !S.cine.active && !S.lockControl && S.world.visible && !S.missions.active; }, { maxSec });
}

// Step game time until pred() is true in the page, letting real time pass between chunks (the story
// module and its assets load on real time). Returns { ok, sec } with the seconds of game time stepped.
export async function stepUntil(page, pred, { maxSec = 60, chunk = 0.25, realMs = 25 } = {}) {
  const src = pred.toString();
  for (let t = 0; ; t += chunk) {
    if (await page.evaluate((src) => !!(0, eval)("(" + src + ")")(), src)) return { ok: true, sec: t };
    if (t >= maxSec) return { ok: false, sec: t };
    await step(page, chunk);
    if (realMs) await page.waitForTimeout(realMs);
  }
}
// Step until the story says it is ready (S.ready: the world is built and the core cast is loaded).
export const storyReady = (page, opts = {}) => stepUntil(page, () => !!(window.__crimson.story && __crimson.story.ready), { maxSec: 30, ...opts });
// Count single ticks until pred() is true (for exact timing). Returns the ticks stepped, or -1.
export async function ticksUntil(page, pred, max = 3600) {
  const r = await page.evaluate(([src, max]) => {
    const f = (0, eval)("(" + src + ")");
    for (let i = 0; i <= max; i++) { if (f()) return i; __crimson.step(1 / 60, false); }
    return -1;
  }, [pred.toString(), max]);
  return r;
}

// Wait for the page to paint n frames (DOM set in a requestAnimationFrame callback, like the credits roll).
export const nextFrames = (page, n = 2) => page.evaluate((n) => new Promise((res) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : res()); f(n); }), n);
// The story's invariants: hero and camera finite, the hero on or above the ground and inside the world,
// hp in range, vehicles finite. Returns the problems (an empty list when all hold).
export const invariants = (page) => page.evaluate(() => {
  const S = window.__crimson && __crimson.story && __crimson.story.S, bad = [];
  if (!S) return ["no story"];
  const H = S.hero, p = H.pos, c = S.camera.position, fin = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  if (!fin(p)) bad.push("hero position is not finite");
  else {
    if (Math.abs(p.x) > S.world.HALF || Math.abs(p.z) > S.world.HALF) bad.push(`hero outside the world at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    const g = S.world.surface(p.x, p.z, p.y + 1);
    if (p.y < g - 0.2) bad.push(`hero under the ground (${p.y.toFixed(2)} below ${g.toFixed(2)})`);
  }
  if (!(H.hp >= 0 && H.hp <= H.maxHp)) bad.push(`hero hp ${H.hp} outside 0..${H.maxHp}`);
  if (!fin(c)) bad.push("camera position is not finite");
  for (const v of S.vehicles.list) if (!fin(v.pos) || !Number.isFinite(v.speed)) bad.push(`vehicle ${v.id} is not finite`);
  return bad;
});

// Wait for the game to run n more ticks (live mode, after __crimson.live()).
export async function frames(page, n = 3) {
  const f0 = await page.evaluate(() => __crimson.frame);
  await page.waitForFunction((t) => __crimson.frame >= t, f0 + n, { timeout: 300000, polling: 50 });
}
// Draw one frame at post-effect time t.
export const draw = (page, t = 0) => page.evaluate((t) => __crimson.draw(t), t);

// Save a screenshot of the whole page (with the DOM on top of the canvas).
export async function shot(page, path) { mkdirSync(dirname(path), { recursive: true }); await page.screenshot({ path, timeout: 240000 }); }

// Read the WebGL canvas back as raw RGBA. The read happens in the same task as the draw inside `before`
// (the drawing buffer is cleared once the page composites). before is an async page function run first.
export async function canvasRGBA(page, before = null, arg = null) {
  const r = await page.evaluate(async ([src, arg]) => {
    if (src) await (0, eval)("(" + src + ")")(arg);
    const v = document.getElementById("view"), c = document.createElement("canvas");
    c.width = v.width; c.height = v.height;
    const g = c.getContext("2d"); g.drawImage(v, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return { width: c.width, height: c.height, b64: btoa(s) };
  }, [before ? before.toString() : null, arg]);
  return { width: r.width, height: r.height, data: Buffer.from(r.b64, "base64") };
}

/* ---------------- PNG, no dependencies ---------------- */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// 8-bit RGBA, filter 0 on every row
export function encodePNG({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// 8-bit gray, gray+alpha, RGB or RGBA, not interlaced, any filter; returns RGBA
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let o = 8, width = 0, height = 0, depth = 0, type = 0, inter = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString("ascii", o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") { width = d.readUInt32BE(0); height = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === "IDAT") idat.push(d);
    else if (t === "IEND") break;
    o += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !ch || inter) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${inter})`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * ch, px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[row + x - ch] : 0, b = y ? px[up + x] : 0, c = x >= ch && y ? px[up + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * ch, d = i * 4;
    if (ch === 1 || ch === 2) { data[d] = data[d + 1] = data[d + 2] = px[s]; data[d + 3] = ch === 2 ? px[s + 1] : 255; }
    else { data[d] = px[s]; data[d + 1] = px[s + 1]; data[d + 2] = px[s + 2]; data[d + 3] = ch === 4 ? px[s + 3] : 255; }
  }
  return { width, height, data };
}
export const readPNG = (path) => decodePNG(readFileSync(path));
export function writePNG(path, img) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, encodePNG(img)); }

// Compare two RGBA images: mean absolute difference over the RGB channels, and the 99th percentile
// of each pixel's largest channel difference, both on 0-255.
export function imageDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { mean: 255, p99: 255, max: 255, sizeMismatch: true };
  const n = a.width * a.height, hist = new Uint32Array(256); let sum = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4; let m = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[o + c] - b.data[o + c]); sum += d; if (d > m) m = d; }
    hist[m]++; if (m > max) max = m;
  }
  let acc = 0, p99 = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.99) { p99 = v; break; } }
  return { mean: sum / (n * 3), p99, max };
}

// Print PASS or FAIL with the reasons, close the browser, and exit 1 on failure.
export async function finish(name, fails, browser, errors = []) {
  if (errors.length) fails.push("page errors: " + errors.slice(0, 5).join(" | "));
  if (browser) await browser.close();
  console.log(fails.length ? `FAIL: ${name}\n` + fails.map((f) => "  " + f).join("\n") : `PASS: ${name}`);
  process.exit(fails.length ? 1 : 0);
}
