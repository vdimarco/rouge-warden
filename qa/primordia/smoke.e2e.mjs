// Browser smoke test for Primordia: the Hunt combat (combat design section 8.5) and Eat to grow
// (growth design section 10, "Browser smoke checks").
// Three runs: desktop 1280x720 (mouse + keyboard), phone portrait 390x844 and phone landscape 844x390
// (touch). Each run: title and start, the How to play intro with its GROW scene, steering, a locked
// lunge lane (outline pixels sampled on the fx canvas), Glory Bite with Remains and its growth points,
// Burst, glint star, parry into Stasis (shader grade measured on the field canvas), dash pips (touch),
// the GROW bar (fill, 50% tick, gold when full), the dish growing (screenshots at fixed points of the
// grow clock, the player's screen position across the swap, the zoom kept inside the dish frame, the
// drawn body size), the cards and the converted prey after the pick, game over and instant retry,
// reduced motion (a fade, no zoom), console errors and horizontal overflow.
//
// Needs the static server: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Usage: node qa/primordia/smoke.e2e.mjs [outDir]
//   PRIMORDIA_URL   page under test (default http://127.0.0.1:8765/primordia/)
//   PRIMORDIA_RUNS  comma list of runs to do (default desktop,portrait,landscape)
//   PW_CHROMIUM     chromium binary (default /opt/pw-browsers/chromium when it exists)
//   PW_GL_ARGS      chromium GL flags (default: SwiftShader, see GL_ARGS)
// Playwright resolves from NODE_PATH or from qa/browser/node_modules.
//
// Software GL (SwiftShader) draws this page at 1-10 frames per second and the game caps a frame at
// 0.05 s of game time, so every wait here counts animation frames or polls a condition. Scripted fights
// go through window.__primordia.game plus a small in-page harness that wraps game.update on the
// instance: it can park and feed the player, hold the epoch clock, hold a hunter at its glint, log
// events and freeze the game (game.state = "paused", which core's update() skips) for screenshots.
// For the grow sequence it holds the grow clock at a set time (q.growStop): the update that would pass
// that time is cut short so growT lands on it, and later updates are skipped while the shell keeps
// drawing that moment. An init script records the field shader's uZoom and uConvert uniforms and the
// text drawn on the fx canvas, so the checks read what was really drawn.
// Results: one line per check (ok / FAIL / WARN / SKIP), then a table, and smoke-results.json in outDir.
// WARN marks a design deviation the spec does not require; SKIP an inconclusive timing probe. FAIL lines
// that start with "GAME BUG" are game defects, not test mistakes. Exit code 1 when anything FAILs.
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch (e) { playwright = createRequire(new URL("../browser/package.json", import.meta.url))("playwright"); }
const { chromium } = playwright;

const out = process.argv[2] || "/tmp/claude-0/-home-user-rouge-warden/7acda8a5-55dc-5499-b4d1-15b17ddc9cf3/scratchpad/qa/shots";
fs.mkdirSync(out, { recursive: true });
const base = process.env.PRIMORDIA_URL || "http://127.0.0.1:8765/primordia/";
const RUNS = {
  desktop: { viewport: { width: 1280, height: 720 }, touch: false },
  portrait: { viewport: { width: 390, height: 844 }, touch: true },
  landscape: { viewport: { width: 844, height: 390 }, touch: true },
};
const runList = (process.env.PRIMORDIA_RUNS || "desktop,portrait,landscape").split(",").map((s) => s.trim()).filter(Boolean);
const exe = process.env.PW_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const GL_ARGS = (process.env.PW_GL_ARGS || "--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist").split(/\s+/).filter(Boolean);
const SP_PARA = 0; // SP.PARA in core.js
// grow clock stops for screenshots (design: 0.15, 0.39, 0.41, 1.0, 1.59, 1.61, then the cards at 1.95)
const GROW_STOPS = [0.15, 0.39, 0.41, 1.0, 1.59, 1.61];
const RM_STOPS = [0.3, 0.41, 0.65]; // reduced motion: the fade peaks at the swap (0.40) and is gone by 0.60

// ---------- results ----------
const results = [];
function record(run, check, status, detail = "") {
  results.push({ run, check, status, detail });
  console.log(`${status.padEnd(4)} ${run.padEnd(9)} ${check}${detail ? "  | " + detail : ""}`);
}
class Check extends Error {}
const expect = (cond, msg) => { if (!cond) throw new Check(msg); };
// one named check; a failure is recorded and the run goes on to the next check
async function check(run, name, fn) {
  try {
    const detail = await fn();
    record(run, name, "ok", detail || "");
    return true;
  } catch (err) {
    record(run, name, "FAIL", String((err && err.message) || err).split("\n").slice(0, 4).join(" / "));
    return false;
  }
}

// ---------- page helpers ----------
// wait n animation frames (with a wall-clock backstop so a stalled page cannot hang the run)
const frames = (page, n = 2) => page.evaluate((n) => new Promise((res) => {
  let k = 0;
  const f = () => (++k >= n ? res(k) : requestAnimationFrame(f));
  requestAnimationFrame(f);
  setTimeout(() => res(-k), 8000 * n);
}), n);
// run a predicate after each game frame until it holds or `max` frames pass. The predicate source sees
// g (the game), q (the harness), P (the player) and a (the argument).
const until = (page, src, { max = 30, arg = null } = {}) => page.evaluate(({ src, max, arg }) => new Promise((res) => {
  const fn = new Function("g", "q", "P", "a", `return (${src});`);
  let k = 0, done = false;
  const finish = (ok) => { if (!done) { done = true; res({ ok, frames: k }); } };
  const tick = () => {
    if (done) return;
    k++;
    const g = window.__primordia.game;
    let v = false;
    try { v = fn(g, window.__qa, g.player, arg); } catch (e) { v = false; }
    if (v) return finish(true);
    if (k >= max) return finish(false);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => finish(false), 8000 * max);
}), { src, max, arg });

// The in-page harness. Idempotent; call it again after a run restarts (it wraps the game instance).
function harness() {
  const q = (window.__qa ||= { log: [], frame: 0, path: 0, park: null, feed: false, hold: false, glint: null, post: null, diedAt: 0, overAt: 0, overShown: false });
  if (!q.observer) {
    const over = document.querySelector("#overScreen");
    q.observer = new MutationObserver(() => {
      if (!over.hidden && !q.overShown) {
        q.overShown = true; q.overAt = performance.now();
        // an armed probe: a synthetic press a set time after the screen appears (tests the guard timing;
        // the game's handlers do not check isTrusted)
        const a = q.armOver; q.armOver = null;
        if (a) setTimeout(() => {
          const at = performance.now() - q.overAt;
          if (a.kind === "key") dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", key: "Enter", bubbles: true, cancelable: true }));
          else over.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true }));
          q.probe = { at: Math.round(at), screen: window.__primordia.screen };
        }, a.ms);
      }
      if (over.hidden) q.overShown = false;
    });
    q.observer.observe(over, { attributes: true, attributeFilter: ["hidden"] });
    // when real input reaches the page (for press times relative to the over screen)
    addEventListener("keydown", () => { q.inputAt = performance.now(); }, true);
    addEventListener("pointerdown", () => { q.inputAt = performance.now(); }, true);
  }
  const g = window.__primordia.game;
  if (g.__qaWrapped) return true;
  g.__qaWrapped = true;
  // game.js seeds runs with Math.random; a fixed seed makes spawn and Remains choices repeatable (the
  // frame dt is the 0.05 s cap at these frame rates, but input still lands on varying frames)
  let seed = 12345;
  g.rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const update = Object.getPrototypeOf(g).update;
  g.update = function (dt, input = {}) {
    q.frame++;
    const P = this.player;
    // hold the grow clock at q.growStop: land exactly on it, then skip updates (the shell still draws)
    if (this.state === "grow" && q.growStop != null) {
      if (this.growT >= q.growStop - 1e-9) return;
      dt = Math.min(dt, 0.05, q.growStop - this.growT);
    }
    if (q.feed && P.alive) P.light = P.maxLight;
    if (q.hold && this.state === "play") this.epochTime = Math.min(Math.max(this.epochTime, 5), 30);
    // parking applies in play only: in the grow state core moves the player into the shrunken dish
    if (q.park && this.state === "play") {
      // a parked player ignores steering, but a real dash press still goes through
      input = { ...input, mx: 0, my: 0, target: null };
      if (input.dash && q.park.untilDash) q.park = null;
      else if (!input.dash && P.dashT <= 0) {
        P.x = q.park.x; P.y = q.park.y; P.vx = 0; P.vy = 0;
        if (q.park.dx !== undefined) { P.dirX = q.park.dx; P.dirY = q.park.dy; }
      }
    }
    if (q.glint !== null) {
      if (input.dash) q.glint = null;
      else {
        // hold a windup a few steps before its lunge: lane locked, glint on, parry window open
        const e = this.hunters.find((h) => h.id === q.glint);
        if (e && e.state === "windup") { e.steps = 4; e.stateAt = Math.min(e.stateAt, this.time - 1); }
      }
    }
    const alive = P.alive, x0 = P.x, y0 = P.y;
    update.call(this, dt, input);
    if (alive) q.path += this.dist(x0, y0, P.x, P.y);
    if (alive && !P.alive) {
      // the game shows the over screen from a 600 ms timer; this twin timer measures how late the
      // busy main thread (software GL) delivers timers, so the report can separate that from the game
      q.diedAt = performance.now(); q.twinAt = 0;
      setTimeout(() => { q.twinAt = performance.now(); }, 600);
    }
    for (const v of this.events) {
      if (v.type === "step") continue;
      const o = { f: q.frame, t: performance.now() };
      for (const k in v) if (v[k] === null || typeof v[k] !== "object") o[k] = v[k];
      q.log.push(o);
    }
    if (q.log.length > 4000) q.log.splice(0, q.log.length - 4000);
    if (q.post) q.post(this);
  };
  return true;
}

// a dish with no hunters, no pending spawns and a silent Director (prey keep spawning)
function cleanDish() {
  const g = window.__primordia.game, D = g.director;
  if (g.state === "paused") g.state = "play";
  g.world.B.fill(0);
  g.hunters.length = 0;
  for (let i = g.pending.length - 1; i >= 0; i--) if (g.pending[i].kind === "hunter") g.pending.splice(i, 1);
  for (let i = g.claims.length - 1; i >= 0; i--) if (g.claims[i].kind === "hunter") g.claims.splice(i, 1);
  g.labelB = null; g.ownerOf = [];
  D.spawned = [true, true, true]; D.cleared = [true, true, true]; D.queue.length = 0; D.encoreCd = Infinity; D.relaxT = 0; D.bossOut = false;
  // an empty GROW bar, so a scripted fight never fills it and grows the dish mid-check
  g.growth = 0; g.ripe = false;
  return true;
}

// Installed before the page loads: what the field shader is told each frame (uZoom, uConvert), logged
// while the dish grows, and the text drawn on the fx canvas (labels, popups).
function pageHooks() {
  const U = (window.__glu = { last: {}, log: [] });
  const rec = (n, v) => {
    U.last[n] = v;
    const p = window.__primordia, g = p && p.game;
    if (g && g.state === "grow") { U.log.push({ n, v, growT: g.growT }); if (U.log.length > 3000) U.log.splice(0, 1500); }
  };
  const G = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
  if (G) {
    const gul = G.getUniformLocation, u1 = G.uniform1f, u4 = G.uniform4f;
    G.getUniformLocation = function (p, name) { const l = gul.call(this, p, name); if (l) { try { l.__n = name; } catch (e) { /* not tagged */ } } return l; };
    G.uniform1f = function (l, v) { if (l && l.__n === "uZoom") rec("uZoom", v); return u1.call(this, l, v); };
    G.uniform4f = function (l, a, b, c, d) { if (l && l.__n === "uConvert") rec("uConvert", [a, b, c, d]); return u4.call(this, l, a, b, c, d); };
  }
  const T = (window.__texts = []);
  const C = CanvasRenderingContext2D.prototype, ft = C.fillText;
  C.fillText = function (s, x, y, ...r) {
    if (this.canvas && this.canvas.id === "fx") { T.push({ s: String(s), x, y, t: performance.now() }); if (T.length > 800) T.splice(0, 400); }
    return ft.call(this, s, x, y, ...r);
  };
}

// The grow scene: the player parked off centre (the dish centre maps to itself, so a centred player
// would pass the swap check for free) and a Paraptera 34 cells away to turn into prey.
function growSetup() {
  const g = window.__primordia.game, q = window.__qa, P = g.player;
  const x = Math.round(g.w * 0.3), y = Math.round(g.h * 0.66), portrait = g.h > g.w;
  const hx = portrait ? x : x + 34, hy = portrait ? y - 34 : y;
  q.park = { x, y, dx: hx > x ? 1 : 0, dy: hy < y ? -1 : 0 }; q.feed = true; q.hold = true;
  P.x = P.px = x; P.y = P.py = y; P.vx = P.vy = 0;
  g.epochTime = Math.max(g.epochTime, 5);
  g.stampHunter(0, hx, hy, g.angleToward(0, hx, hy), {});
  return { x: hx, y: hy, cx: x, cy: y };
}

// One look at the dish while the grow clock is held, read right after the game draws (a rAF callback
// queued now runs after the game's). Returns the camera (the uZoom the shader got), the player's world
// and screen position, the player's body found on the fx canvas, any field or fx pixel drawn outside the
// dish frame, the fade at a dish corner, the HUD box, red and cyan pixel counts around `spots` (world
// points) and a small copy of the dish picture for frame-to-frame differences.
const growProbe = (page, spots = []) => page.evaluate((spots) => new Promise((res) => requestAnimationFrame(() => {
  const g = window.__primordia.game, P = g.player, r = window.__rect(), U = window.__glu;
  const z = typeof U.last.uZoom === "number" ? U.last.uZoom : 1;
  const SX = (x) => r.x + r.w / 2 + (x - g.w / 2) * r.s / z, SY = (y) => r.y + r.h / 2 + (y - g.h / 2) * r.s / z;
  const at = { x: SX(P.x), y: SY(P.y) };
  // the body: opaque pixels of its fill (#d8fff7, #ffb0c4 when hurt, #ffd86a in Burst) or its white rim
  // around the computed spot (the nucleus and eye are holes in every state)
  const near = (o, c) => Math.abs(fd[o] - c[0]) <= 22 && Math.abs(fd[o + 1] - c[1]) <= 22 && Math.abs(fd[o + 2] - c[2]) <= 22;
  const FILLS = [[216, 255, 247], [255, 176, 196], [255, 216, 106], [255, 255, 255]];
  const fx = document.querySelector("#fx"), k = fx.width / innerWidth, fd = fx.getContext("2d").getImageData(0, 0, fx.width, fx.height).data;
  const Rmax = Math.max(P.r, g.baseR()) * 1.3 * (r.s / z) * 1.15, half = Math.max(16, 1.8 * Rmax);
  let n = 0, bx = 0, by = 0;
  for (let y = Math.max(0, Math.round((at.y - half) * k)); y < Math.min(fx.height, Math.round((at.y + half) * k)); y++)
    for (let x = Math.max(0, Math.round((at.x - half) * k)); x < Math.min(fx.width, Math.round((at.x + half) * k)); x++) {
      const o = (y * fx.width + x) * 4;
      if (fd[o + 3] >= 200 && FILLS.some((c) => near(o, c))) { n++; bx += x; by += y; }
    }
  const body = n ? { n, x: (bx / n + 0.5) / k, y: (by / n + 0.5) / k, r: Math.sqrt(n / Math.PI) / k } : { n: 0 };
  // the field canvas, copied in the same frame it was drawn
  const f = document.querySelector("#field"), kf = f.width / innerWidth;
  const cv = document.createElement("canvas"); cv.width = f.width; cv.height = f.height;
  const cx = cv.getContext("2d"); cx.drawImage(f, 0, 0);
  const ff = cx.getImageData(0, 0, f.width, f.height).data;
  const field = (x, y) => { const o = (Math.min(f.height - 1, Math.max(0, Math.round(y * kf))) * f.width + Math.min(f.width - 1, Math.max(0, Math.round(x * kf)))) * 4; return [ff[o], ff[o + 1], ff[o + 2]]; };
  const fxa = (x, y) => fd[(Math.min(fx.height - 1, Math.max(0, Math.round(y * k))) * fx.width + Math.min(fx.width - 1, Math.max(0, Math.round(x * k)))) * 4 + 3];
  // outside the dish frame (3 px margin for the 1 px frame line): the field shows only its clear colour
  // (0.012, 0.01, 0.025) and the fx canvas nothing
  let pts = 0, fieldBad = 0, fxBad = 0, firstBad = null;
  for (let y = 1; y < innerHeight; y += 4) for (let x = 1; x < innerWidth; x += 4) {
    if (x > r.x - 3 && x < r.x + r.w + 3 && y > r.y - 3 && y < r.y + r.h + 3) continue;
    pts++;
    const c = field(x, y), a = fxa(x, y);
    const fb = Math.abs(c[0] - 3) > 10 || Math.abs(c[1] - 3) > 10 || Math.abs(c[2] - 6) > 10, xb = a > 8;
    if (fb) fieldBad++; if (xb) fxBad++;
    if ((fb || xb) && !firstBad) firstBad = { x, y, field: c, fxAlpha: a };
  }
  // red and cyan field pixels around world points (the hunter, converted prey)
  const around = spots.map((p) => {
    const X = SX(p.x), Y = SY(p.y), R = p.rad * r.s / z;
    let red = 0, cyan = 0, all = 0;
    for (let y = Y - R; y <= Y + R; y += 1) for (let x = X - R; x <= X + R; x += 1) {
      if ((x - X) ** 2 + (y - Y) ** 2 > R * R || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
      const c = field(x, y); all++;
      if (c[0] > 90 && c[0] > c[1] + 40 && c[0] > c[2]) red++;
      if (c[1] > 90 && c[1] > c[0] + 40 && c[2] > c[0] + 20) cyan++;
    }
    return { red, cyan, all, x: Math.round(X), y: Math.round(Y) };
  });
  // a small copy of the dish picture
  const SW = 96, SH = Math.max(8, Math.round((96 * r.h) / r.w)), snap = [];
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) snap.push(...field(r.x + ((i + 0.5) * r.w) / SW, r.y + ((j + 0.5) * r.h) / SH));
  const hud = document.querySelector("#hud"), hb = hud.getBoundingClientRect();
  res({
    growT: g.growT, state: g.state, epoch: g.epoch, screen: window.__primordia.screen, z, conv: U.last.uConvert || null,
    P: { x: P.x, y: P.y, r: P.r, base: g.baseR() }, at, body, rect: { x: r.x, y: r.y, w: r.w, h: r.h, s: r.s },
    out: { pts, fieldBad, fxBad, firstBad }, corner: fxa(r.x + 6, r.y + r.h - 6),
    hud: { hidden: hud.hidden, bottom: hb.bottom, top: hb.top, display: getComputedStyle(hud).display }, around, snap,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
  });
})), spots);
// mean absolute difference of two dish pictures, 0..1
const snapDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
const smootherstep = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
// the shell's camera at a grow time (growView in game.js): 2x at the swap, back to 1x by 1.60
const zoomAt = (t) => (t < 0.4 || t >= 1.6 ? 1 : 0.5 * Math.pow(2, smootherstep((t - 0.4) / 1.2)));

// colour columns along the middle of the GROW bar, from a screenshot (the HUD is DOM, not canvas)
async function barColumns(page) {
  const b = await page.locator("#growBox > i.grow").boundingBox();
  expect(b, "no GROW bar box");
  const clip = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
  const buf = await page.screenshot({ clip });
  const cols = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d");
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, bmp.width, bmp.height).data, W = bmp.width, mid = Math.floor(bmp.height / 2), out = [];
    for (let i = 0; i < W; i++) {
      const s = [0, 0, 0];
      for (const j of [mid - 1, mid, mid + 1]) for (let ch = 0; ch < 3; ch++) s[ch] += d[(j * W + i) * 4 + ch];
      out.push(s.map((v) => Math.round(v / 3)));
    }
    return out;
  }, buf.toString("base64"));
  const notch = await page.evaluate(() => { const n = document.querySelector("#growBox .notch").getBoundingClientRect(), i = document.querySelector("#growBox > i.grow").getBoundingClientRect(); return { x: n.x - i.x, w: n.width, h: n.height, barW: i.width, barH: i.height, bg: getComputedStyle(document.querySelector("#growBox .notch")).backgroundColor }; });
  return { cols, notch, clip };
}
const isCyan = (c) => c[1] >= 150 && c[2] >= 120 && c[0] <= 180;
const isGold = (c) => c[0] >= 220 && c[0] - c[2] >= 80 && c[1] >= 110;
const isDark = (c) => Math.max(...c) <= 80;

// the grow scene on a clean dish: the parked player and a tracked Paraptera that will not attack
async function growScene(page) {
  await page.evaluate(cleanDish);
  const spot = await page.evaluate(growSetup);
  const t = await until(page, TRACKED, { max: 30, arg: { ...spot, sp: SP_PARA } });
  expect(t.ok, `setup: the stamped Paraptera was not tracked in ${t.frames} frames`);
  await page.evaluate(() => { for (const e of window.__primordia.game.hunters) e.cool = 1e9; });
  return spot;
}
// Run the grow sequence, holding the grow clock at each stop for a probe and a screenshot. The bar
// must already be full (the game may be paused on it). Returns the probes and the uniform log.
async function growTo(page, stops, spots, shot, onStop) {
  const w0 = Date.now();
  await page.evaluate((s) => { window.__qa.growStop = s; window.__glu.log.length = 0; }, stops[0]);
  await unfreeze(page);
  const res = { stops: {}, log: [] };
  for (const stop of stops) {
    await page.evaluate((s) => { window.__qa.growStop = s; }, stop);
    const r = await until(page, "g.state === 'grow' && g.growT >= a - 1e-9", { max: 80, arg: stop });
    if (!r.ok) {
      const st = await page.evaluate(() => { const g = window.__primordia.game; return { state: g.state, growT: +g.growT.toFixed(3), ripe: g.ripe, ripeT: g.ripeT, hunters: g.hunters.length, screen: window.__primordia.screen }; });
      throw new Check(`the grow clock did not reach ${stop} in ${r.frames} frames: ${JSON.stringify(st)}`);
    }
    // the parked spot is an old-dish point: let go once the dish starts growing
    await page.evaluate(() => { window.__qa.park = null; });
    await frames(page, 2);
    res.stops[stop] = await growProbe(page, stop < 0.4 ? spots : []);
    await shot(`grow-${stop.toFixed(2)}`);
    if (onStop) await onStop(stop);
  }
  res.log = await page.evaluate(() => window.__glu.log.slice());
  await page.evaluate(() => { window.__qa.growStop = null; });
  res.wall = ((Date.now() - w0) / 1000).toFixed(0);
  return res;
}

// park and feed the player in the middle of the dish and stamp a hunter `off` cells away along the long
// axis, heading for the player. Returns the stamp spot.
function stampBeside({ sp, off }) {
  const g = window.__primordia.game, q = window.__qa, P = g.player;
  const cx = g.w / 2, cy = g.h / 2, portrait = g.h > g.w;
  const x = portrait ? cx : cx + off, y = portrait ? cy - off : cy;
  const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy);
  q.park = { x: cx, y: cy, dx: dx / l, dy: dy / l };
  q.feed = true; q.hold = true;
  P.x = cx; P.y = cy; P.vx = P.vy = 0;
  g.epochTime = Math.max(g.epochTime, 5);
  g.stampHunter(sp, x, y, g.angleToward(sp, x, y), {});
  return { x, y, cx, cy };
}
const TRACKED = "g.hunters.find((e) => e.species === a.sp && g.dist(e.x, e.y, a.x, a.y) < 20)";
async function injectHunter(page, off = 32) {
  await page.evaluate(cleanDish);
  const spot = await page.evaluate(stampBeside, { sp: SP_PARA, off });
  const t = await until(page, TRACKED, { max: 30, arg: { ...spot, sp: SP_PARA } });
  expect(t.ok, `setup: the stamped Paraptera was not tracked in ${t.frames} frames`);
  const e = await page.evaluate(({ src, a }) => {
    const g = window.__primordia.game, e = new Function("g", "a", `return (${src});`)(g, a);
    return { id: e.id, x: e.x, y: e.y, nd: e.nd, mass: e.mass, state: e.state };
  }, { src: TRACKED, a: { ...spot, sp: SP_PARA } });
  return { ...e, spot };
}
const freeze = (page) => page.evaluate(() => { const g = window.__primordia.game; if (g.state === "play") g.state = "paused"; return g.state; });
const unfreeze = (page) => page.evaluate(() => { const g = window.__primordia.game; if (g.state === "paused") g.state = "play"; return g.state; });
const logSince = (page, f0, types) => page.evaluate(({ f0, types }) => window.__qa.log.filter((v) => v.f > f0 && (!types || types.includes(v.type))), { f0, types });
const qaFrame = (page) => page.evaluate(() => window.__qa.frame);

// tap the centre of an element with the touchscreen (no actionability waits: the page is slow)
async function tapEl(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  expect(b, `${sel} has no box (hidden?)`);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  return b;
}
// a point that lands on the game-over screen itself, outside its panel and buttons
const overPoint = (page) => page.evaluate(() => {
  const c = [[10, innerHeight - 10], [innerWidth - 10, innerHeight - 10], [10, 10], [innerWidth / 2, innerHeight - 6], [innerWidth - 10, innerHeight / 2]];
  for (const [x, y] of c) { const el = document.elementFromPoint(x, y); if (el && el.id === "overScreen") return { x, y }; }
  return null;
});

// fx-canvas pixels along both long edges of the hunter's lane. For each of 5 points per edge, walk the
// edge normal +-8 px and measure the run of lane-coloured pixels (red, alpha >= 100: the 0.85 stroke,
// not the 0.14 fill). Popups and particles draw over the lane, so a point can be hidden by one.
function sampleLane(id) {
  const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id), L = e && e.lane, r = window.__rect();
  if (!L) return { error: "no lane" };
  const c = document.querySelector("#fx"), ctx = c.getContext("2d"), dpr = c.width / innerWidth;
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const px = (x, y) => {
    x = Math.round(x * dpr); y = Math.round(y * dpr);
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null;
    const i = (y * c.width + x) * 4;
    return [img[i], img[i + 1], img[i + 2], img[i + 3]];
  };
  const isLane = (p) => p && p[3] >= 100 && p[0] >= 170 && p[0] - p[1] >= 70;
  const s = r.s, X0 = r.x + L.x0 * s, Y0 = r.y + L.y0 * s, len = L.front + L.L - L.back;
  const pts = [];
  for (const [edge, b] of [["left", L.left], ["right", L.right]]) for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    const a = L.back + len * f;
    const x = X0 + (a * L.ux - b * L.uy) * s, y = Y0 + (a * L.uy + b * L.ux) * s;
    if (x < r.x + 6 || y < r.y + 6 || x > r.x + r.w - 6 || y > r.y + r.h - 6) { pts.push({ edge, f, skip: true }); continue; }
    let run = 0, best = 0, first = null;
    for (let d = -8; d <= 8; d += 0.5) {
      const p = px(x - L.uy * d, y + L.ux * d);
      if (isLane(p)) { run++; best = Math.max(best, run); if (!first) first = { d, p }; } else run = 0;
    }
    pts.push({ edge, f, x: Math.round(x), y: Math.round(y), ok: best > 0, width: best * 0.5, off: first && first.d, rgba: first && first.p });
  }
  return { pts, lineWidthCss: Math.max(3, 0.8 * s), s, lane: { ux: L.ux, uy: L.uy, L: L.L, back: L.back, front: L.front, left: L.left, right: L.right } };
}

// the glint star on the fx canvas: white pixels on the half facing away from the player
function sampleGlint(id) {
  const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id), r = window.__rect(), P = g.player;
  if (!e) return { error: "hunter gone" };
  const c = document.querySelector("#fx"), ctx = c.getContext("2d"), dpr = c.width / innerWidth;
  const X = r.x + e.nx * r.s, Y = r.y + e.ny * r.s;
  const W = Math.ceil(30 * dpr), x0 = Math.round(X * dpr) - W, y0 = Math.round(Y * dpr) - W;
  const img = ctx.getImageData(x0, y0, 2 * W + 1, 2 * W + 1).data;
  let px = P.x - e.nx, py = P.y - e.ny;
  px -= Math.round(px / g.w) * g.w; py -= Math.round(py / g.h) * g.h;
  let n = 0, maxD = 0;
  for (let j = 0; j <= 2 * W; j++) for (let i = 0; i <= 2 * W; i++) {
    const dx = (i - W) / dpr, dy = (j - W) / dpr;
    if (dx * px + dy * py > 0) continue;
    const k = (j * (2 * W + 1) + i) * 4;
    if (img[k] >= 235 && img[k + 1] >= 235 && img[k + 2] >= 235 && img[k + 3] >= 200) { n++; maxD = Math.max(maxD, Math.hypot(dx, dy)); }
  }
  return { n, across: 2 * maxD, glinted: e.glinted, state: e.state, starR: Math.max(14, 3.5 * r.s) };
}

// read the WebGL field right after the game draws it (a rAF callback queued now runs after the game's)
// and return the mean saturation of the lit dish pixels
const fieldStats = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
  const f = document.querySelector("#field"), r = window.__rect(), k = f.width / innerWidth;
  const flat = !document.querySelector("#nogl").hidden;
  const W = 192, H = Math.max(8, Math.round((192 * r.h) / r.w));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.drawImage(f, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  let sat = 0, n = 0, blue = 0;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx < 16) continue;
    sat += (mx - mn) / mx; blue += d[i + 2] / mx; n++;
  }
  res({ sat: n ? sat / n : 0, blue: n ? blue / n : 0, n, flat, filter: getComputedStyle(f).filter });
})));

const overflow = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

// ---------- one run ----------
async function run(browser, name) {
  const { viewport, touch } = RUNS[name];
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(pageHooks);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
  // web fonts come from Google; a sandbox without that host should not fail the run
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || "")) errors.push(m.text()); });
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const shot = (tag) => page.screenshot({ path: path.join(out, `${name}-${tag}.png`) });
  const overflows = [];
  const noteOverflow = async (where) => { const o = await overflow(page); if (o > 0) overflows.push(`${where} +${o}px`); };
  const t0 = Date.now();
  let rate = "?";

  // 1. title, start, steer
  const booted = await check(name, "1a title screen", async () => {
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => window.__primordia && window.__primordia.game, null, { timeout: 60000 });
    await frames(page, 3);
    const st = await page.evaluate(() => ({
      screen: window.__primordia.screen, prey: window.__primordia.game.prey.length, mode: window.__primordia.game.mode,
      gl2: !!document.createElement("canvas").getContext("webgl2"), flat: !document.querySelector("#nogl").hidden,
      keys: document.querySelector(".keys").textContent, tag: document.querySelector(".tag").textContent,
    }));
    await shot("title");
    await noteOverflow("title");
    expect(st.screen === "title", "screen=" + st.screen);
    expect(st.prey >= 3, "demo dish has too little life: " + st.prey);
    expect(touch ? /DASH button/.test(st.keys) && /BURST button/.test(st.keys) : /Space/.test(st.keys) && /Shift/.test(st.keys), "title keys block: " + st.keys);
    return `prey ${st.prey}, webgl2 ${st.gl2}${st.flat ? " (FLAT fallback)" : ""}`;
  });
  if (!booted) { await ctx.close(); return finishRun(name, errors, overflows, t0); }

  const introOpen = await check(name, "1b start (" + (touch ? "tap PLAY" : "Enter") + "): How to play runs first", async () => {
    if (touch) await tapEl(page, "#playBtn"); else await page.keyboard.press("Enter");
    // a fresh browser sees the intro scenes before its first run
    const i = await until(page, "window.__primordia.screen === 'intro'", { max: 6 });
    expect(i.ok, "PLAY did not open the intro; screen=" + (await page.evaluate(() => window.__primordia.screen)));
    const scene = await until(page, "window.__primordia.intro && window.__primordia.intro.k >= 1 && window.__primordia.intro.s.t > 1.2", { max: 400 });
    expect(scene.ok, "the intro did not reach its first lesson");
    const cap = (await page.evaluate(() => ({ title: document.querySelector("#introTitle").getAttribute("aria-label"), keys: document.querySelector("#introKeys").textContent, id: window.__primordia.intro.scene.id, count: window.__primordia.intro.count })));
    await shot("intro");
    await noteOverflow("intro");
    expect(cap.title && cap.keys, "intro caption missing: " + JSON.stringify(cap));
    return `scene "${cap.id}" of ${cap.count}: ${cap.title}`;
  });

  // the intro's GROW scene, jumped to directly: one meal fills the bar, the real grow sequence runs
  // (no cards in the intro), a hunter comes back as an Orbium and the player eats it
  if (introOpen) await check(name, "1b2 intro GROW scene: the dish grows and the player eats a hunter turned prey", async () => {
    const k = await page.evaluate(() => {
      const I = window.__primordia.intro, k0 = I.k;
      let k = -1;
      for (let i = 0; i < I.count; i++) { I.k = i; if (I.scene && I.scene.id === "grow") k = i; }
      I.k = k0;
      if (k >= 0) I.start(k);
      return k;
    });
    expect(k >= 0, "the intro has no scene with id grow");
    const w0 = Date.now();
    const cap = await page.evaluate(() => ({ kicker: document.querySelector("#introKicker").textContent, title: document.querySelector("#introTitle").getAttribute("aria-label"), text: document.querySelector("#introText").textContent }));
    const sceneS = "(() => { const I = window.__primordia.intro; if (!I) return null; return I.scene.id === 'grow' ? I.s : I.s.prev; })()";
    // mid pull-back
    const mid = await until(page, `(() => { const I = window.__primordia.intro; return !I || I.scene.id !== 'grow' || (g.state === 'grow' && g.growT >= 0.9); })()`, { max: 500 });
    const midSt = await page.evaluate(() => ({ state: window.__primordia.game.state, growT: window.__primordia.game.growT }));
    if (midSt.state === "grow") await shot("intro-grow");
    const end = await until(page, `(() => { const I = window.__primordia.intro; if (!I) return true; const s = ${sceneS}; return I.scene.id !== 'grow' || (s && s.ev.some((e) => e.type === 'devour' && e.kind === 'prey' && e.converted)); })()`, { max: 600 });
    const st = await page.evaluate((src) => {
      const I = window.__primordia.intro, g = window.__primordia.game, P = g.player, s = new Function(`return ${src}`)(), r = window.__rect();
      // Intro.observe() stamps each event with at = scene time, which hides zoomFinish's own list of
      // placed prey, so the count comes from the game's stats and live prey
      const ev = (s ? s.ev : []).filter((e) => ["grow", "growStart", "zoomBegin", "zoomFinish", "devour", "epochEnd"].includes(e.type)).map((e) => ({ type: e.type, at: typeof e.at === "number" ? +e.at.toFixed(2) : null, kind: e.kind, converted: e.converted, from: e.from }));
      const from = [...new Set(g.prey.filter((p) => p.converted).map((p) => p.from).concat((s ? s.ev : []).filter((e) => e.type === "devour" && e.converted).map((e) => e.from)))];
      const capBox = document.querySelector(".intro-cap").getBoundingClientRect();
      const X = r.x + r.w / 2 + (P.x - g.w / 2) * r.s, Y = r.y + r.h / 2 + (P.y - g.h / 2) * r.s;
      return { scene: I && I.scene.id, t: s && +s.t.toFixed(2), epoch: g.epoch, ev, placed: g.stats.husks || 0, from, player: { x: Math.round(X), y: Math.round(Y) }, cap: { l: capBox.left, t: capBox.top, r: capBox.right, b: capBox.bottom }, view: { w: innerWidth, h: innerHeight } };
    }, sceneS);
    await shot("intro-grown");
    await noteOverflow("intro grow");
    const has = (t, f = () => true) => st.ev.some((e) => e.type === t && f(e));
    expect(cap.kicker === "7 · GROW" && cap.title === "Eat to grow.", "GROW scene caption: " + JSON.stringify(cap));
    expect(has("grow"), "no growth point in the GROW scene; events " + st.ev.map((e) => e.type).join(","));
    expect(has("growStart") && has("zoomBegin") && has("zoomFinish"), `the dish did not grow (scene ${st.scene} at ${st.t} s); events ${st.ev.map((e) => e.type).join(",")}`);
    expect(st.placed >= 1, "the dish grew but no hunter came back as prey");
    expect(has("devour", (e) => e.kind === "prey" && e.converted), `the player did not eat a converted Orbium (scene ${st.scene} at ${st.t} s); events ${st.ev.map((e) => e.type + (e.converted ? "*" : "")).join(",")}`);
    // the action stays on screen and clear of the captions (side panel on the landscape phone)
    const P = st.player, C = st.cap;
    expect(P.x >= 0 && P.y >= 0 && P.x <= st.view.w && P.y <= st.view.h, "the player is off screen at the end of the GROW scene: " + JSON.stringify(P));
    expect(!(P.x >= C.l && P.x <= C.r && P.y >= C.t && P.y <= C.b), `the player (${P.x},${P.y}) is under the captions ${JSON.stringify(C)}`);
    return `"${cap.title}" ${cap.text}; grew at ${(st.ev.find((e) => e.type === "growStart") || {}).at} s, ${st.placed} prey from ${st.from.join("/")}, ate one at ${(st.ev.find((e) => e.type === "devour" && e.converted) || {}).at} s; player at (${P.x},${P.y}); ${((Date.now() - w0) / 1000).toFixed(0)} s wall${mid.ok && midSt.state === "grow" ? ", mid-grow shot at growT " + midSt.growT.toFixed(2) : ""}`;
  });

  await check(name, "1c Skip starts the run", async () => {
    expect(introOpen, "setup: the intro did not open");
    if (touch) await tapEl(page, "#introSkip"); else await page.keyboard.press("Escape");
    const p = await until(page, "window.__primordia.screen === 'play'", { max: 6 });
    expect(p.ok, "Skip did not start the run");
    expect(await page.evaluate(() => localStorage.getItem("primordia.intro") === "true"), "the intro was not marked as seen");
    await frames(page, 2);
    await page.evaluate(harness);
    const st = await page.evaluate(() => {
      const g = window.__primordia.game;
      return { screen: window.__primordia.screen, state: g.state, alive: g.player.alive, w: g.w, h: g.h, compact: g.compact, caps: g.caps(), touchUi: !document.querySelector("#touch").hidden, growHold: g.growHold, epoch: g.epoch, growth: g.growth, label: document.querySelector("#epochLabel").textContent };
    });
    await noteOverflow("play");
    expect(st.screen === "play" && st.state === "play" && st.alive, "did not start: " + JSON.stringify(st));
    expect(st.touchUi === touch, "touch controls shown=" + st.touchUi);
    if (name === "portrait") expect(st.w === 128 && st.h === 256, `portrait dish is ${st.w}x${st.h}`);
    else expect(st.w === 256 && st.h === 128, `dish is ${st.w}x${st.h}`);
    if (touch) expect(st.compact && st.caps.gliders === 3 && st.caps.bodies === 6, "touch caps " + JSON.stringify(st.caps));
    // the intro holds growth in its other scenes; a run after it must grow again, from Size I
    expect(st.growHold === false, "GAME BUG: growHold is still on in the run that follows the intro, so the GROW bar can never fill");
    expect(st.epoch === 1 && st.growth === 0 && st.label === "SIZE I", `the run did not start at an empty Size I: epoch ${st.epoch}, growth ${st.growth}, label "${st.label}"`);
    return `dish ${st.w}x${st.h}, caps ${st.caps.gliders}/${st.caps.bodies}, growHold ${st.growHold}`;
  });

  await check(name, "1d steer (" + (touch ? "touch stick" : "mouse + WASD") + ")", async () => {
    const s0 = await page.evaluate(() => ({ steps: window.__primordia.game.steps, path: window.__qa.path, f: window.__qa.frame, t: performance.now() }));
    // direction to the nearest prey, in dish cells
    const aim = () => page.evaluate(() => {
      const g = window.__primordia.game, P = g.player;
      let best = null, bd = 1e9;
      for (const e of g.prey) {
        let dx = e.x - P.x, dy = e.y - P.y; dx -= Math.round(dx / g.w) * g.w; dy -= Math.round(dy / g.h) * g.h;
        const d = Math.hypot(dx, dy); if (d < bd && d > 2) { bd = d; best = { dx, dy, d }; }
      }
      const r = window.__rect();
      return best ? { ...best, sx: r.x + (P.x + best.dx) * r.s, sy: r.y + (P.y + best.dy) * r.s } : { dx: 1, dy: 0, d: 1, sx: r.x + (P.x + 20) * r.s, sy: r.y + P.y * r.s };
    });
    let stickOn = null, along = 0;
    if (!touch) {
      for (let i = 0; i < 8; i++) { const a = await aim(); await page.mouse.move(a.sx, a.sy, { steps: 2 }); await frames(page, 1); }
      // the keyboard takes over from the pointer
      await page.keyboard.down("KeyD");
      await frames(page, 4);
      along = await page.evaluate(() => window.__primordia.game.player.vx);
      await page.keyboard.up("KeyD");
      await frames(page, 1);
      expect(along > 8, `holding D did not swim right (vx ${along.toFixed(1)})`);
    } else {
      const ox = Math.round(viewport.width * 0.3), oy = Math.round(viewport.height * 0.62);
      const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(ox, oy) });
      await frames(page, 1);
      for (let i = 0; i < 8; i++) {
        const a = await aim();
        const l = Math.hypot(a.dx, a.dy) || 1;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(ox + (a.dx / l) * 40, oy + (a.dy / l) * 40) });
        await frames(page, 1);
        if (i === 3) {
          const v = await page.evaluate(({ dx, dy }) => { const P = window.__primordia.game.player, l = Math.hypot(dx, dy) || 1; return { on: document.querySelector("#stick").classList.contains("on"), along: (P.vx * dx + P.vy * dy) / l }; }, a);
          stickOn = v.on; along = v.along;
        }
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await frames(page, 1);
      expect(stickOn, "the floating stick did not show while dragging");
      expect(along > 8, `the stick did not steer toward its direction (speed along it ${along.toFixed(1)})`);
    }
    const s1 = await page.evaluate(() => ({ steps: window.__primordia.game.steps, path: window.__qa.path, f: window.__qa.frame, t: performance.now(), eaten: window.__primordia.game.stats.prey, light: window.__primordia.game.player.light }));
    const fps = (s1.f - s0.f) / ((s1.t - s0.t) / 1000);
    rate = fps.toFixed(1);
    await shot("play");
    expect(s1.steps - s0.steps >= 5, `dish advanced only ${s1.steps - s0.steps} steps`);
    expect(s1.path - s0.path > 3, `player swam only ${(s1.path - s0.path).toFixed(1)} cells`);
    return `swam ${(s1.path - s0.path).toFixed(1)} cells in ${((s1.t - s0.t) / 1000).toFixed(1)} s, ${s1.steps - s0.steps} steps, ${fps.toFixed(1)} fps, speed along input ${along.toFixed(1)}`;
  });

  // 2. a Paraptera beside the parked player locks a lane; the outline is on the fx canvas
  let laneHunter = null;
  await check(name, "2 lane locks and its outline draws", async () => {
    const e = await injectHunter(page);
    laneHunter = e.id;
    // a fresh hunter waits out its 1.2 s spawn grace; this one is let off it so the windup comes now
    await page.evaluate(({ id, grace }) => {
      const g = window.__primordia.game, q = window.__qa, e = g.hunters.find((h) => h.id === id);
      e.born = g.time - grace - 0.1; e.cool = 0;
      q.lockSeen = null;
      q.post = (g) => {
        const h = g.hunters.find((x) => x.id === id);
        if (h && h.lane && h.state === "windup") { g.state = "paused"; q.lockSeen = { nd: h.nd, glinted: h.glinted, steps: h.steps, epochTime: g.epochTime }; q.post = null; }
      };
    }, { id: e.id, grace: await page.evaluate(() => window.__primordia.TUNE.spawnGrace) });
    let r = await until(page, "q.lockSeen", { max: 40 });
    let forced = false;
    if (!r.ok) {
      // no natural windup: say why, then force one (design 8.5 forces state = windup)
      const why = await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); return e ? { state: e.state, nd: e.nd && +e.nd.toFixed(1), cool: e.cool, tokens: g.hunters.filter((o) => o.token).length, relax: g.director.relaxT, epochTime: g.epochTime } : "gone"; }, e.id);
      forced = JSON.stringify(why);
      await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); if (e) { e.token = true; g.beginWindup(e); } }, e.id);
      r = await until(page, "q.lockSeen", { max: 30 });
    }
    expect(r.ok, "no lane locked" + (forced ? " even after forcing the windup; " + forced : ""));
    await frames(page, 4); // the frozen frame redraws while any shake decays
    const info = await page.evaluate((id) => {
      const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id), P = g.player, L = e.lane;
      let dx = P.x - L.x0, dy = P.y - L.y0; dx -= Math.round(dx / g.w) * g.w; dy -= Math.round(dy / g.h) * g.h;
      return { state: e.state, aim: (dx * L.ux + dy * L.uy) / (Math.hypot(dx, dy) || 1), L: L.L, wide: L.right - L.left };
    }, e.id);
    await shot("lane");
    const s = await page.evaluate(sampleLane, e.id);
    expect(!s.error, s.error);
    const live = s.pts.filter((p) => !p.skip), hit = live.filter((p) => p.ok);
    const widths = hit.map((p) => p.width).sort((a, b) => a - b), med = widths.length ? widths[widths.length >> 1] : 0;
    expect(info.aim > 0.95, `the lane does not point at the player (cos ${info.aim.toFixed(2)})`);
    const miss = live.filter((p) => !p.ok).map((p) => `${p.edge}@${p.f} (${p.x},${p.y})`);
    for (const edge of ["left", "right"]) {
      const lp = live.filter((p) => p.edge === edge), lh = lp.filter((p) => p.ok);
      expect(lp.length >= 3, `only ${lp.length} ${edge}-edge points inside the dish`);
      expect(lh.length >= 3, `${edge} edge: outline at ${lh.length} of ${lp.length} points; missing at ${miss.join(", ")}`);
    }
    expect(med >= 2.5, `outline ${med} px thick (lineWidth ${s.lineWidthCss.toFixed(1)}); spec: at least 3 px`);
    return `${forced ? "FORCED windup (" + forced + "); " : "natural windup; "}lane ${info.L.toFixed(1)} cells long, ${info.wide.toFixed(1)} wide, aim cos ${info.aim.toFixed(3)}; outline at ${hit.length}/${live.length} points${miss.length ? " (covered at " + miss.join(", ") + ")" : ""}, ${med} px thick, rgba ${JSON.stringify(hit[0].rgba)}`;
  });

  // 3. stagger the same hunter, put the mouth on its tissue: Glory Bite, then Remains
  await check(name, "3 Glory Bite and Remains", async () => {
    expect(laneHunter !== null, "setup: no hunter from step 2");
    const f0 = await qaFrame(page);
    const ok = await page.evaluate((id) => {
      const g = window.__primordia.game, q = window.__qa, e = g.hunters.find((h) => h.id === id);
      if (g.state === "paused") g.state = "play";
      if (!e) return false;
      // Remains are skipped while the dish holds more than 1200 prey mass (bloom guard); keep this
      // scripted kill clear of that rule by clearing a crowded prey channel first
      if (g.world.massA > 1000) { g.world.A.fill(0); g.prey.length = 0; for (let i = g.claims.length - 1; i >= 0; i--) if (g.claims[i].kind === "prey") g.claims.splice(i, 1); q.preyCleared = true; }
      g.stagger(e, "tear");
      // every frame, park the mouth (P + dir * 0.9) on the densest cell of the staggered body
      q.post = (g) => {
        const h = g.hunters.find((x) => x.id === id), L = g.labelB;
        if (!h || !L) return;
        q.corpse = { x: h.x, y: h.y, massA: g.world.massA, prey: g.prey.length, remains: g.prey.filter((p) => p.remains).length };
        let bi = -1, bv = -1;
        for (let i = 0; i < L.length; i++) if (L[i] === h.blob && g.world.B[i] > bv) { bv = g.world.B[i]; bi = i; }
        if (bi >= 0) q.park = { x: ((bi % g.w) - 0.9 + g.w) % g.w, y: (bi / g.w) | 0, dx: 1, dy: 0 };
      };
      q.post(g);
      return true;
    }, laneHunter);
    expect(ok, "setup: the hunter from step 2 is gone");
    const r = await until(page, "q.log.some((v) => v.f > a && v.type === 'devour' && v.kind === 'hunter')", { max: 30, arg: f0 });
    await page.evaluate(() => { window.__qa.post = null; });
    const dev = (await logSince(page, f0, ["devour", "stagger", "remains"]));
    const kill = dev.find((v) => v.type === "devour" && v.kind === "hunter");
    expect(r.ok && kill, "no hunter devoured in " + r.frames + " frames; events " + dev.map((v) => v.type).join(","));
    expect(kill.how === "glory", `GAME BUG? devoured with how "${kill.how}", expected "glory"`);
    expect(kill.species === SP_PARA, "devoured species " + kill.species);
    // Remains: live Orbium stamped at the corpse; tracked on the next prey step
    const rr = await until(page, "g.prey.some((p) => p.remains)", { max: 40 });
    const st = await page.evaluate(() => ({ remains: window.__primordia.game.prey.filter((p) => p.remains).length, massA: Math.round(window.__primordia.game.world.massA) }));
    const ev = (await logSince(page, f0, ["remains"])).length;
    await page.evaluate(() => { window.__qa.park = null; });
    await shot("glory");
    if (ev < 1) {
      // which spawnRemains() rule blocked every spot? Survey the 14-20 cell ring around the corpse
      const ring = await page.evaluate(() => {
        const g = window.__primordia.game, W = g.world, c = window.__qa.corpse, P = g.player;
        const n = { spots: 0, tissue: 0, prey: 0, agar: 0, open: 0 };
        const away = Math.atan2(c.y - P.y, c.x - P.x);
        for (let k = 0; k < 48; k++) for (const r of [14, 17, 20]) {
          const a = away + (k / 48) * Math.PI * 2, x = ((c.x + Math.cos(a) * r) % g.w + g.w) % g.w, y = ((c.y + Math.sin(a) * r) % g.h + g.h) % g.h;
          const i = (Math.round(y) % g.h) * g.w + (Math.round(x) % g.w);
          const t = W.probe(W.B, x, y, 8) >= 0.5, p = W.probe(W.A, x, y, 10) >= 3, ag = W.N[i] <= 0.5;
          n.spots++; if (t) n.tissue++; if (p) n.prey++; if (ag) n.agar++; if (!t && !p && !ag) n.open++;
        }
        return { ...n, corpse: { x: Math.round(c.x), y: Math.round(c.y) }, before: { massA: Math.round(c.massA), prey: c.prey, remains: c.remains } };
      });
      const capped = ring.before.massA > 1200 || ring.before.remains >= 4;
      expect(false, `${capped ? "by design: " : "GAME BUG? "}the Glory Bite dropped no Remains. The frame before it: massA ${ring.before.massA} (cap 1200), ${ring.before.prey} prey, ${ring.before.remains} Remains alive (max 4). Ring survey now at corpse (${ring.corpse.x},${ring.corpse.y}): ${ring.open}/${ring.spots} spots open; blocked by hunter tissue ${ring.tissue}, prey ${ring.prey}, eaten agar ${ring.agar}`);
    }
    expect(rr.ok, `a Remains prey was stamped but never tracked (${rr.frames} frames)`);
    const cleared = await page.evaluate(() => !!window.__qa.preyCleared);
    // spec (Growth): a Glory Bite on a Paraptera fills the GROW bar by 5 points
    const gp = (await logSince(page, f0, ["grow"])).map((v) => v.n);
    expect(gp.includes(5), `the Glory Bite on a Paraptera gave growth points [${gp.join(", ")}], expected 5`);
    return `glory +${kill.points} (mult ${kill.mult}) after ${r.frames} frames, +${gp.join("+")} GROW; ${st.remains} Remains prey tracked after ${rr.frames} more frames${cleared ? " (prey channel was over 1000 mass and was cleared first)" : ""}`;
  });

  // 4. Burst: meter full, Shift or the BURST button
  await check(name, "4 Burst (" + (touch ? "tap #burstBtn" : "Shift") + ")", async () => {
    const e = await injectHunter(page, 26); // close enough that the 20-cell blast should catch it
    await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); e.cool = 1e9; g.meter = 1; g.ready = true; }, e.id);
    const w = await until(page, "g.hitstop <= 0 && g.burstT <= 0", { max: 20 });
    expect(w.ok, "setup: hit-stop never ended");
    const ready = await page.evaluate(() => document.querySelector("#burstBtn").classList.contains("ready") && document.querySelector("#burstMeter").classList.contains("ready"));
    const pre = await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); return { nd: e ? e.nd : null }; }, e.id);
    let f0 = await qaFrame(page), r = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (touch) await tapEl(page, "#burstBtn"); else await page.keyboard.press("Shift");
      r = await until(page, "q.log.some((v) => v.f > a && v.type === 'burst')", { max: 4, arg: f0 });
      if (r.ok) break;
    }
    const ev = (await logSince(page, f0, ["burst"]))[0];
    const st = await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); return { burstT: g.burstT, meter: g.meter, hunterState: e ? e.state : "gone" }; }, e.id);
    await frames(page, 1);
    await shot("burst");
    expect(ready, "the BURST meter/button did not show ready with a full meter");
    expect(ev, "no burst event after the press");
    expect(st.burstT > 0, "burstT " + st.burstT);
    // the blast catches hunters whose tissue is within 20 cells; allow 2 cells of drift before the frame
    if (pre.nd !== null && pre.nd <= 18) expect(ev.caught >= 1, `hunter tissue ${pre.nd.toFixed(1)} cells away was not caught`);
    expect(st.meter === 0, `GAME BUG: the meter reads ${st.meter.toFixed(3)} right after a Burst that caught ${ev.caught} (startBurst() tears the caught hunters through tear(), which adds 0.4 x frac before burstT is set; also combat.test 33). burstT ${st.burstT.toFixed(2)} s`);
    return `burstT ${st.burstT.toFixed(2)} s, caught ${ev.caught} (hunter nd ${pre.nd && pre.nd.toFixed(1)} before, now ${st.hunterState}), +${ev.points}`;
  });
  await page.evaluate(() => { const g = window.__primordia.game; if (g.burstT > 0) g.burstT = 0.01; });
  await until(page, "g.burstT <= 0", { max: 6 });

  // 5. a hunter held at its glint; dash into it: parry and Stasis
  let parried = false;
  let glintHunter = null, baseline = null;
  await check(name, "5a glint star (spec: >= 14 px across)", async () => {
    const e = await injectHunter(page);
    glintHunter = e.id;
    await page.evaluate((id) => {
      const g = window.__primordia.game, q = window.__qa, e = g.hunters.find((h) => h.id === id);
      e.cool = 1e9; e.born = g.time - 5; e.token = true;
      g.beginWindup(e);
      q.glint = id;
    }, e.id);
    const r = await until(page, "(() => { const e = g.hunters.find((h) => h.id === a); return e && e.lane && e.glinted && e.state === 'windup'; })()", { max: 20, arg: e.id });
    expect(r.ok, "setup: the held windup never locked and glinted");
    await freeze(page);
    await frames(page, 4);
    await shot("glint");
    baseline = await fieldStats(page);
    const s = await page.evaluate(sampleGlint, e.id);
    expect(!s.error, s.error);
    expect(s.n >= 10 && s.across >= 14, `glint star ${s.across.toFixed(1)} px across from ${s.n} white px (drawn radius ${s.starR.toFixed(1)})`);
    return `${s.across.toFixed(1)} px across (half star, ${s.n} px)`;
  });
  await check(name, "5b parry into Stasis (" + (touch ? "tap #dashBtn" : "Space") + ")", async () => {
    expect(glintHunter !== null, "setup: no glinting hunter");
    const set = await page.evaluate((id) => {
      const g = window.__primordia.game, q = window.__qa, P = g.player, e = g.hunters.find((h) => h.id === id);
      if (!e) return null;
      // stand 5 cells off its nearest tissue, facing it; the first dash frame (4.6 cells) lands on it
      let dx = e.nx - P.x, dy = e.ny - P.y; dx -= Math.round(dx / g.w) * g.w; dy -= Math.round(dy / g.h) * g.h;
      const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      q.park = { x: (e.nx - ux * 5 + g.w) % g.w, y: (e.ny - uy * 5 + g.h) % g.h, dx: ux, dy: uy, untilDash: true };
      P.charges = g.maxCharges(); P.chargeT = 0;
      q.parries0 = g.stats.parries;
      q.post = (g) => { if (g.stats.parries > q.parries0) { g.state = "paused"; q.post = null; } };
      if (g.state === "paused") g.state = "play";
      return { nd: e.nd, state: e.state, glinted: e.glinted };
    }, glintHunter);
    expect(set, "setup: the glinting hunter is gone");
    await until(page, "g.hitstop <= 0 && P.dashT <= 0", { max: 10 });
    await frames(page, 2);
    const pre = await page.evaluate((id) => { const g = window.__primordia.game, e = g.hunters.find((h) => h.id === id); return e && { nd: e.nd, state: e.state, glinted: e.glinted, left: g.windupLeft(e) }; }, glintHunter);
    expect(pre && pre.state === "windup" && pre.glinted, "setup: not glinting before the dash " + JSON.stringify(pre));
    const f0 = await qaFrame(page);
    if (touch) await tapEl(page, "#dashBtn"); else await page.keyboard.press("Space");
    const r = await until(page, "g.stats.parries > q.parries0 || (q.log.some((v) => v.f > a && v.type === 'dash') && P.dashT <= 0 && g.hitstop <= 0)", { max: 12, arg: f0 });
    const ev = await logSince(page, f0, ["dash", "parry", "stasis", "stagger", "cut", "tissueHit", "lunge", "lungeHit"]);
    const st = await page.evaluate(() => { const g = window.__primordia.game; return { stasisT: g.stasisT, parries: g.stats.parries - window.__qa.parries0, charges: g.player.charges, state: g.state }; });
    expect(ev.some((v) => v.type === "dash"), `the ${touch ? "DASH tap" : "Space press"} did not dash (frames ${r.frames})`);
    expect(ev.some((v) => v.type === "parry") && st.parries === 1, `no parry: nd ${pre.nd.toFixed(1)} before the dash, windup left ${pre.left.toFixed(2)} s; events ${ev.map((v) => v.type).join(",")}`);
    expect(st.stasisT > 0, "stasisT " + st.stasisT);
    expect(ev.some((v) => v.type === "stasis"), "no stasis event");
    parried = true;
    await frames(page, 5); // stasisEase reaches the full grade
    await shot("stasis");
    const graded = await fieldStats(page);
    const ratio = baseline && baseline.sat > 0 ? graded.sat / baseline.sat : null;
    if (graded.flat) expect(/saturate/.test(graded.filter), "2D fallback: no Stasis filter on the field canvas: " + graded.filter);
    else expect(ratio !== null && ratio < 0.85, `Stasis grade not visible: field saturation ${baseline && baseline.sat.toFixed(3)} -> ${graded.sat.toFixed(3)}`);
    return `stasisT ${st.stasisT.toFixed(2)} s, charges ${st.charges}; field saturation ${baseline.sat.toFixed(3)} -> ${graded.sat.toFixed(3)} (x${ratio && ratio.toFixed(2)}), blue share ${baseline.blue.toFixed(2)} -> ${graded.blue.toFixed(2)}`;
  });
  await page.evaluate(() => { const g = window.__primordia.game, q = window.__qa; q.post = null; q.glint = null; q.park = null; if (g.state === "paused") g.state = "play"; if (g.stasisT > 0) g.stasisT = 0.01; });
  await page.evaluate(cleanDish);
  // the parry froze the game mid-dash; let that dash finish (a press during a dash is dropped)
  await until(page, "g.stasisT <= 0 && g.hitstop <= 0 && P.dashT <= 0", { max: 12 });

  // 6. touch: the DASH button's pips match the charges
  if (touch) {
    await check(name, "6 dash pips match charges", async () => {
      const read = () => page.evaluate(() => {
        const g = window.__primordia.game;
        return { on: document.querySelectorAll("#dashBtn .pips i.on").length, hidden: document.querySelectorAll("#dashBtn .pips i[hidden]").length, all: document.querySelectorAll("#dashBtn .pips i").length, charges: g.player.charges, max: g.maxCharges() };
      });
      const seen = [await read()];
      for (let k = 0; k < 2; k++) {
        await until(page, "P.dashT <= 0 && g.hitstop <= 0", { max: 12 });
        const f0 = await qaFrame(page), in0 = await page.evaluate(() => window.__qa.inputAt || 0);
        await tapEl(page, "#dashBtn");
        const r = await until(page, "q.log.some((v) => v.f > a && v.type === 'dash') && P.dashT <= 0 && g.hitstop <= 0", { max: 10, arg: f0 });
        if (!r.ok) {
          const why = await page.evaluate(({ f0, in0 }) => { const g = window.__primordia.game, P = g.player, q = window.__qa; return { reached: q.inputAt > in0, events: [...new Set(q.log.filter((v) => v.f > f0).map((v) => v.type))].join(","), dashT: P.dashT, charges: P.charges, state: g.state, screen: window.__primordia.screen, top: document.elementFromPoint(...(() => { const b = document.querySelector("#dashBtn").getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()).id }; }, { f0, in0 });
          expect(false, `DASH tap ${k + 1} did not dash: ${JSON.stringify(why)}`);
        }
        seen.push(await read());
      }
      const bad = seen.filter((s) => s.on !== s.charges || s.hidden !== s.all - s.max);
      expect(bad.length === 0, "pips disagree: " + JSON.stringify(bad));
      expect(seen.some((s) => s.charges < s.max), "setup: never saw a spent charge " + JSON.stringify(seen));
      return "on/charges " + seen.map((s) => `${s.on}/${s.charges}`).join(" -> ") + ` (max ${seen[0].max}, ${seen[0].hidden} pip hidden)`;
    });
  }

  // 7. Eat to grow: the GROW bar, the dish growing, the cards and the converted prey
  // A Paraptera is stamped beside the parked player (off centre), the bar is filled by hand, and the
  // grow clock is held at each screenshot time.
  const grown = { ready: false, ok: false, stops: {}, hunter: null, pre: null };
  await check(name, "7a GROW bar fills and shows its 50% tick", async () => {
    await page.evaluate(() => { const q = window.__qa; q.post = null; q.glint = null; });
    await growScene(page, grown);
    const f0 = await qaFrame(page);
    const s0 = await page.evaluate(() => { const g = window.__primordia.game; g.growth = 0; g.addGrowth(3, g.player.x, g.player.y); return { bar: g.bar(), growth: g.growth, hold: g.growHold }; });
    expect(s0.growth === 3, `addGrowth(3) left the bar at ${s0.growth} (growHold ${s0.hold})`);
    await frames(page, 3);
    const read = () => page.evaluate(() => {
      const m = getComputedStyle(document.querySelector("#epochBar")).transform, box = document.querySelector("#growBox");
      return { scale: m && m !== "none" ? +m.slice(7).split(",")[0] : 1, full: box.classList.contains("full"), label: document.querySelector("#epochLabel").textContent, g: window.__primordia.game.gFrac() };
    });
    const r1 = await read();
    // (the parked player may bite a passing prey meanwhile, so the bar is read against the game)
    expect(Math.abs(r1.scale - r1.g) < 0.02 && r1.g > 0, `bar drawn at ${r1.scale.toFixed(3)} for g ${r1.g.toFixed(3)} (3/${s0.bar} added)`);
    // past the half: the notch event, and the tick over the cyan fill
    await page.evaluate(() => { const g = window.__primordia.game; g.addGrowth(Math.ceil(g.bar() * 0.7) - g.growth, g.player.x, g.player.y); });
    await frames(page, 3);
    const r2 = await read();
    const ev = await logSince(page, f0, ["grow", "notch"]);
    const bc = await barColumns(page);
    await page.screenshot({ path: path.join(out, `${name}-grow-bar.png`), clip: { x: Math.max(0, bc.clip.x - 70), y: Math.max(0, bc.clip.y - 14), width: bc.clip.width + 140, height: bc.clip.height + 28 } });
    const W = bc.cols.length, mid = W / 2, dark = [];
    for (let i = Math.floor(mid - 4); i <= Math.ceil(mid + 4); i++) if (bc.cols[i] && isDark(bc.cols[i])) dark.push(i);
    const L = bc.cols[Math.round(mid - 5)], R = bc.cols[Math.round(mid + 5)];
    expect(ev.filter((v) => v.type === "grow").length >= 2, "grow events: " + ev.map((v) => v.type).join(","));
    expect(ev.some((v) => v.type === "notch"), "no notch event when the bar passed half: " + ev.map((v) => v.type).join(","));
    expect(Math.abs(r2.scale - r2.g) < 0.02 && !r2.full, `bar drawn at ${r2.scale.toFixed(3)} for g ${r2.g.toFixed(3)} (full class ${r2.full})`);
    expect(bc.notch.w >= 3 && bc.notch.h >= bc.notch.barH - 0.5, `tick box ${bc.notch.w}x${bc.notch.h} px (spec: at least 3 px thick)`);
    expect(Math.abs(bc.notch.x + bc.notch.w / 2 - bc.notch.barW / 2) <= 1.5, `tick centre at ${(bc.notch.x + bc.notch.w / 2).toFixed(1)} px, bar middle ${(bc.notch.barW / 2).toFixed(1)} px`);
    expect(dark.length >= 2, `no dark tick at the middle of the bar; columns ${JSON.stringify(bc.cols.slice(Math.floor(mid - 5), Math.ceil(mid + 6)))}`);
    expect(isCyan(L) && isCyan(R), `the fill beside the tick is not cyan: ${JSON.stringify(L)} | ${JSON.stringify(R)}`);
    grown.ready = true;
    return `3/${s0.bar} drawn at ${r1.scale.toFixed(3)} ("${r1.label}"); at g ${r2.g.toFixed(2)} drawn at ${r2.scale.toFixed(3)}; tick ${bc.notch.w}x${bc.notch.h} px at ${(bc.notch.x + bc.notch.w / 2).toFixed(1)} of ${bc.notch.barW} px, dark columns ${dark.join(",")}, fill ${JSON.stringify(L)}`;
  });

  await check(name, "7b full bar: gold, i-frames, ready to grow", async () => {
    expect(grown.ready, "setup: 7a did not finish");
    const f0 = await qaFrame(page);
    const st = await page.evaluate(() => {
      const g = window.__primordia.game;
      // own both parents of Chain Bloom and promise a Duo, so the DUO tag shows on the cards
      g.mut.sporeburst = Math.max(1, g.mut.sporeburst); g.mut.nerve = Math.max(1, g.mut.nerve); g.duoNext = true;
      g.growth = g.bar() - 1;
      g.addGrowth(1, g.player.x, g.player.y);
      g.state = "paused"; // hold the full bar for the HUD reads; core's update() skips this state
      return { growth: g.growth, bar: g.bar(), ripe: g.ripe, iframes: g.player.iframes };
    });
    await frames(page, 4);
    const hud = await page.evaluate(() => ({ full: document.querySelector("#growBox").classList.contains("full"), label: getComputedStyle(document.querySelector("#epochLabel")).color, text: document.querySelector("#epochLabel").textContent }));
    const bc = await barColumns(page);
    await page.screenshot({ path: path.join(out, `${name}-grow-full.png`), clip: { x: Math.max(0, bc.clip.x - 70), y: Math.max(0, bc.clip.y - 14), width: bc.clip.width + 140, height: bc.clip.height + 28 } });
    const hunter = await page.evaluate(() => { const g = window.__primordia.game, e = g.hunters.find((h) => h.species === 0 && !h.egg); return e ? { x: e.x, y: e.y, nx: e.nx, ny: e.ny } : null; });
    grown.hunter = hunter;
    grown.pre = await growProbe(page, hunter ? [{ x: hunter.x, y: hunter.y, rad: 10 }] : []);
    await shot("grow-ripe");
    const ev = await logSince(page, f0, ["grow", "ripe"]);
    const W = bc.cols.length, mid = W / 2, body = bc.cols.filter((c, i) => i >= 3 && i < W - 3 && Math.abs(i - mid) > 3), gold = body.filter(isGold).length;
    expect(st.growth === st.bar && st.ripe, `bar ${st.growth}/${st.bar}, ripe ${st.ripe}`);
    expect(ev.some((v) => v.type === "grow" && v.n === 1) && ev.some((v) => v.type === "ripe"), "events: " + ev.map((v) => v.type).join(","));
    expect(st.iframes >= 0.79, `i-frames ${st.iframes.toFixed(2)} s at the full bar (spec: 0.8 s)`);
    expect(hud.full, "the GROW box did not take its full state");
    expect(gold >= body.length * 0.8, `the full bar is not gold: ${gold}/${body.length} gold columns, e.g. ${JSON.stringify(body[Math.floor(body.length / 3)])}`);
    expect(hunter, "setup: the Paraptera is gone before the dish grows");
    return `${st.growth}/${st.bar}, i-frames ${st.iframes.toFixed(2)} s, ${gold}/${body.length} gold columns, label "${hud.text}" in ${hud.label}; hunter field pixels red ${grown.pre.around[0].red}, cyan ${grown.pre.around[0].cyan}`;
  });

  let pauseProbe = null;
  await check(name, "7c the dish grows: the player holds still at the swap, the zoom stays in the dish frame", async () => {
    expect(grown.ready && grown.pre, "setup: 7b did not finish");
    const dims = await page.evaluate(() => ({ w: window.__primordia.game.w, h: window.__primordia.game.h }));
    const res = await growTo(page, GROW_STOPS, grown.hunter ? [{ x: grown.hunter.x, y: grown.hunter.y, rad: 10 }] : [], shot, async (stop) => {
      if (stop === 1.0 && !touch) {
        // design: pause is off while the dish grows (a probe; the spec does not name it)
        await page.keyboard.press("Escape");
        await frames(page, 2);
        const s = await page.evaluate(() => window.__primordia.screen);
        if (s === "pause") { await page.keyboard.press("Escape"); await until(page, "window.__primordia.screen === 'play'", { max: 4 }); }
        pauseProbe = s;
      }
    });
    grown.stops = res.stops;
    const S = res.stops, a = S[0.39], b = S[0.41];
    for (const t of GROW_STOPS) if (S[t].overflow > 0) overflows.push(`grow ${t} +${S[t].overflow}px`);
    // camera: the uZoom the shader got, against the design curve; steady from 2x back to 1x
    const zBad = GROW_STOPS.filter((t) => Math.abs(S[t].z - zoomAt(t)) > 0.01).map((t) => `${t}: ${S[t].z.toFixed(3)} (want ${zoomAt(t).toFixed(3)})`);
    const zl = res.log.filter((v) => v.n === "uZoom" && v.growT >= 0.4 && v.growT < 1.6).map((v) => v.v);
    let back = 0; for (let i = 1; i < zl.length; i++) if (zl[i] < zl[i - 1] - 1e-6) back++;
    expect(zBad.length === 0, "camera off the design curve: " + zBad.join(", "));
    expect(zl.length >= 4 && back === 0 && Math.min(...zl) >= 0.5 - 1e-6, `pull-back not steady: ${zl.length} frames, ${back} steps back, min ${Math.min(...zl).toFixed(3)}`);
    // the swap: core moved the player into the shrunken old dish, the screen spot stayed put
    expect(a.epoch === 1 && b.epoch === 2, `size ${a.epoch} at 0.39, ${b.epoch} at 0.41`);
    const mx = dims.w / 4 + a.P.x / 2, my = dims.h / 4 + a.P.y / 2;
    expect(Math.hypot(b.P.x - mx, b.P.y - my) < 0.6, `the player went to (${b.P.x.toFixed(1)},${b.P.y.toFixed(1)}), the old dish maps (${a.P.x.toFixed(1)},${a.P.y.toFixed(1)}) to (${mx.toFixed(1)},${my.toFixed(1)})`);
    const dCalc = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y);
    expect(a.body.n >= 20 && b.body.n >= 20, `player body not found on the fx canvas (${a.body.n} and ${b.body.n} pixels)`);
    const dSeen = Math.hypot(b.body.x - a.body.x, b.body.y - a.body.y);
    expect(dCalc <= 2 && dSeen <= 2, `the player's screen spot moved ${dSeen.toFixed(2)} px on screen (${dCalc.toFixed(2)} px by the transform) across the swap; spec: 2 px or less`);
    const c = S[1.59], d = S[1.61], dFin = c.body.n && d.body.n ? Math.hypot(d.body.x - c.body.x, d.body.y - c.body.y) : NaN;
    // the zoom stays inside the dish frame: nothing on the field or fx canvas outside it, HUD untouched
    const outBad = GROW_STOPS.filter((t) => S[t].out.fieldBad || S[t].out.fxBad).map((t) => `${t}: field ${S[t].out.fieldBad}, fx ${S[t].out.fxBad} of ${S[t].out.pts} at ${JSON.stringify(S[t].out.firstBad)}`);
    expect(outBad.length === 0, "drawn outside the dish frame: " + outBad.join("; "));
    const hudBad = GROW_STOPS.filter((t) => S[t].hud.hidden || S[t].hud.display === "none" || S[t].rect.y < S[t].hud.bottom - 1).map((t) => `${t}: hidden ${S[t].hud.hidden}, dish top ${S[t].rect.y.toFixed(0)}, HUD bottom ${S[t].hud.bottom.toFixed(0)}`);
    expect(hudBad.length === 0, "HUD: " + hudBad.join("; "));
    const fade = GROW_STOPS.filter((t) => S[t].corner > 10).map((t) => `${t}: ${S[t].corner}`);
    expect(fade.length === 0, "a fade was drawn without reduced motion: " + fade.join(", "));
    // the picture: the swap barely changes it, the pull-back does
    const dSwap = snapDiff(a.snap, b.snap), dPull = snapDiff(a.snap, S[1.0].snap);
    expect(dSwap < dPull, `the picture changed more across the swap (${dSwap.toFixed(3)}) than during the pull-back (${dPull.toFixed(3)})`);
    // the molt wave: the hunter's red tissue takes the prey colours before the swap
    const pre = grown.pre.around[0], mo = a.around[0];
    if (pre && pre.red >= 10) expect(mo.red <= pre.red * 0.3, `hunter tissue still red at 0.39: ${mo.red} red px (was ${pre.red}), cyan ${mo.cyan}`);
    const cv = (t) => (S[t].conv ? S[t].conv.map((v) => +v.toFixed(2)) : null);
    expect(S[0.15].conv && S[0.15].conv[3] === 1 && S[0.15].conv[2] > 20 && S[0.15].conv[2] < 60, "molt wave at 0.15: uConvert " + JSON.stringify(cv(0.15)));
    expect(S[1.61].conv && S[1.61].conv[3] === 0, "molt wave still on after the swap: uConvert " + JSON.stringify(cv(1.61)));
    grown.ok = true;
    return `player (${a.P.x.toFixed(1)},${a.P.y.toFixed(1)}) -> (${b.P.x.toFixed(1)},${b.P.y.toFixed(1)}) cells; screen move ${dSeen.toFixed(2)} px seen, ${dCalc.toFixed(2)} px by transform (at 1.60 swap ${isNaN(dFin) ? "?" : dFin.toFixed(2)} px); zoom ${GROW_STOPS.map((t) => S[t].z.toFixed(3)).join("/")} over ${zl.length} pull-back frames; outside the frame 0/${a.out.pts} px; picture diff swap ${dSwap.toFixed(3)} vs pull-back ${dPull.toFixed(3)}; hunter red px ${pre ? pre.red : "?"} -> ${mo ? mo.red : "?"} (cyan ${pre ? pre.cyan : "?"} -> ${mo ? mo.cyan : "?"}); molt radius ${cv(0.15)[2]} -> ${cv(0.39) ? cv(0.39)[2] : "?"} cells; ${res.wall} s wall`;
  });
  if (!touch && pauseProbe !== null) {
    if (pauseProbe === "pause") record(name, "7d probe: Escape while the dish grows", "WARN", "the pause screen opened during the grow sequence; design section 10 says pause is off during grow (the spec does not require it). Resuming finished the sequence normally");
    else record(name, "7d probe: Escape while the dish grows", "ok", `ignored (screen stayed "${pauseProbe}")`);
  }

  await check(name, "7e cards: YOU GREW · SIZE II, then a pick (" + (touch ? "tap card 2" : "key 2") + ")", async () => {
    expect(grown.ok, "setup: the dish did not grow");
    const r = await until(page, "window.__primordia.screen === 'mutate'", { max: 30 });
    expect(r.ok, `the cards did not appear; screen ${await page.evaluate(() => window.__primordia.screen)}, state ${await page.evaluate(() => window.__primordia.game.state)}`);
    const shownAt = Date.now();
    // the bar-full i-frames (0.55 s left when the grow began) make the body blink; switch them off so
    // the body can be measured
    await page.evaluate(() => { window.__primordia.game.player.iframes = 0; });
    await frames(page, 3);
    await shot("grow-cards");
    await noteOverflow("cards");
    const ui = await page.evaluate(() => ({
      kicker: document.querySelector("#mutateKicker").textContent, note: document.querySelector("#grewNote").hidden ? null : document.querySelector("#grewNote").textContent,
      growT: window.__primordia.game.growT, epoch: window.__primordia.game.epoch,
      cards: [...document.querySelectorAll("#cards .card")].map((c) => ({ name: c.querySelector("b").textContent, kind: c.querySelector(".kind") && c.querySelector(".kind").textContent, duo: c.querySelector(".duo-tag") && c.querySelector(".duo-tag").textContent, isDuo: c.classList.contains("duo") })),
      offer: window.__primordia.game.offer.map((m) => m.id), mut: { ...window.__primordia.game.mut },
      // boxes after transforms: the selected card is raised a few pixels
      noteBottom: document.querySelector("#grewNote").getBoundingClientRect().bottom,
      cardTops: [...document.querySelectorAll("#cards .card")].map((c) => ({ top: c.getBoundingClientRect().top, sel: c.classList.contains("sel") })),
    }));
    grown.noteLayout = { bottom: ui.noteBottom, cards: ui.cardTops, shown: ui.note !== null };
    // a person reads the cards for a few seconds; measure the drawn body meanwhile
    await page.waitForTimeout(Math.max(0, 3500 - (Date.now() - shownAt)));
    grown.cards = await growProbe(page);
    const pre = await page.evaluate(() => {
      const q = window.__qa, g = window.__primordia.game, P = g.player;
      q.feed = false; q.hold = false; q.park = null; P.light = 40;
      return { light: P.light, max: P.maxLight, t: performance.now() };
    });
    grown.pickT = pre.t; grown.cardSec = (Date.now() - shownAt) / 1000;
    if (touch) await tapEl(page, "#cards .card >> nth=1"); else await page.keyboard.press("Digit2");
    const p = await until(page, "window.__primordia.screen === 'play' && g.epoch === 2 && g.state === 'play'", { max: 6 });
    const after = await page.evaluate(() => {
      const g = window.__primordia.game, P = g.player, b = document.querySelector("#banner");
      return { mut: { ...g.mut }, light: P.light, max: P.maxLight, charges: P.charges, maxCharges: g.maxCharges(), relaxT: g.director.relaxT, banner: b.textContent, bannerOn: b.classList.contains("show") };
    });
    expect(ui.kicker === "YOU GREW · SIZE II", `cards kicker reads "${ui.kicker}"`);
    expect(ui.note === "The dish grew. Old hunters are food now.", `first-time line under the kicker: ${JSON.stringify(ui.note)}`);
    expect(ui.growT >= 1.95 - 1e-6 && ui.epoch === 2, `cards at growT ${ui.growT.toFixed(2)}, size ${ui.epoch}`);
    expect(ui.cards.length === 3, `${ui.cards.length} cards`);
    const unlabeled = ui.cards.filter((c) => !(/^(BUILD|EXTRA)$/.test(c.kind || "") || c.duo === "DUO"));
    expect(unlabeled.length === 0, "cards without a kind label or DUO tag: " + unlabeled.map((c) => c.name).join(", "));
    expect(ui.cards.some((c) => c.isDuo && c.duo === "DUO"), "no DUO card although both Chain Bloom parents are owned and duoNext is set: " + JSON.stringify(ui.cards));
    expect(p.ok, "the pick did not resume play in Size II");
    const took = ui.offer[1];
    expect(after.mut[took] === ui.mut[took] + 1, `picked card 2 (${took}) but the mutation did not apply`);
    const wantMax = Math.min(150, pre.max + (took === "heart" ? 25 : 0) + 10);
    expect(after.max === wantMax, `max light ${pre.max} -> ${after.max}, want ${wantMax}`);
    if (took !== "heart") expect(Math.abs(after.light - 70) < 2, `light 40 -> ${after.light.toFixed(1)} after the pick, want 70 (+30)`);
    expect(after.charges === after.maxCharges, `charges ${after.charges}/${after.maxCharges} after the pick`);
    expect(/SIZE II/.test(after.banner) && /New hunter: Pentapteryx\. It strikes twice\./.test(after.banner), `size banner reads "${after.banner}"`);
    expect(after.relaxT >= 3.5, `no calm at the size start: relaxT ${after.relaxT.toFixed(2)} (spec: no new hunter warns in for 4 s)`);
    return ui.cards.map((c) => `${c.name} [${c.duo || c.kind}]`).join(", ") + ` -> took ${took} after ${grown.cardSec.toFixed(1)} s; light 40 -> ${after.light.toFixed(0)}, max ${pre.max} -> ${after.max}; banner "${after.banner}"; calm ${after.relaxT.toFixed(1)} s`;
  });

  await check(name, "7e2 the first-time line under the kicker is clear of the cards", async () => {
    const L = grown.noteLayout;
    expect(L && L.shown, "setup: the line was not shown");
    const top = Math.min(...L.cards.map((c) => c.top)), over = L.bottom - top;
    expect(over <= 0.5, `GAME BUG (layout): the cards cover the bottom ${over.toFixed(1)} px of "The dish grew. Old hunters are food now." (line box bottom ${L.bottom.toFixed(1)} px, top card edge ${top.toFixed(1)} px${L.cards.some((c) => c.sel && c.top === top) ? ", the selected card is raised" : ""}). #grewNote has no space below it, so the descenders hide under the card`);
    return `line ends ${(-over).toFixed(1)} px above the cards`;
  });

  await check(name, "7f after the pick: converted prey on the dish, FOOD label", async () => {
    expect(grown.pickT, "setup: no pick");
    await frames(page, 3);
    const st = await page.evaluate((t0) => {
      const g = window.__primordia.game;
      const conv = g.prey.filter((p) => p.converted).map((p) => ({ x: p.x, y: p.y, size: p.size, from: p.from }));
      const texts = window.__texts.filter((t) => t.t >= t0).map((t) => t.s);
      const zf = window.__qa.log.filter((v) => v.type === "zoomFinish").pop();
      return { conv, food: [...new Set(texts.filter((s) => /^FOOD/.test(s)))], texts: [...new Set(texts)].slice(0, 10), zooms: g.stats.zooms, husks: g.stats.husks, sinceZoom: zf ? (t0 - zf.t) / 1000 : NaN };
    }, grown.pickT);
    const p = await growProbe(page, st.conv.map((c) => ({ x: c.x, y: c.y, rad: (c.size || 6) + 2 })));
    await shot("grow-after");
    const seen = p.around.filter((a) => a.cyan >= 6).length;
    expect(st.conv.length >= 1, `no converted prey on the dish after the pick (stats: ${st.zooms} zooms, ${st.husks} husks)`);
    expect(seen >= 1, `converted prey are tracked but the field shows no prey colour at them: ${JSON.stringify(p.around)}`);
    // design 7: "a FOOD ring and label for 2 s after play resumes, the first time each species converts"
    expect(st.food.length >= 1, `GAME BUG: no FOOD label after the pick (the cards were up ${grown.cardSec.toFixed(1)} s; the pick came ${st.sinceZoom.toFixed(1)} s after zoomFinish). game.js drops husk labels 3 s after zoomFinish by performance.now() and skips them while state is not "play", so a player who reads the cards for 3 s never sees "FOOD · was Paraptera". Text drawn since the pick: ${JSON.stringify(st.texts)}`);
    return `${st.conv.length} converted prey (${st.conv.map((c) => c.from).join(", ")}), ${seen} show prey colour on the field; label ${JSON.stringify(st.food)}`;
  });

  await check(name, "7g drawn body: shrinks with the dish, then takes the new size's base", async () => {
    const S = grown.stops;
    expect(S[0.39] && S[0.41] && S[1.59] && grown.cards, "setup: the grow sequence was not measured");
    await frames(page, 20); // the drawn body eases over 0.3 s (about 17% per frame here)
    const aft = await growProbe(page);
    const r39 = S[0.39].body.r, k = (x) => (x && x.body && x.body.n ? x.body.r / r39 : NaN);
    const want = S[0.41].P.base / S[0.39].P.r; // the new base against the full Size I body
    const got = { swap: k(S[0.41]), shrunk: k(S[1.59]), cards: k(grown.cards), after: k(aft) };
    const f = (v) => (isNaN(v) ? "?" : v.toFixed(2));
    const detail = `drawn radius against growT 0.39: 0.41 x${f(got.swap)}, 1.59 x${f(got.shrunk)}, cards x${f(got.cards)}, play after the pick x${f(got.after)}; the new base is x${want.toFixed(2)} (P.r ${S[0.39].P.r.toFixed(2)} at 0.39, ${grown.cards.P.r.toFixed(2)} at the cards, ${aft.P.r.toFixed(2)} after; base ${S[0.41].P.base.toFixed(2)} cells)`;
    expect(Math.abs(got.swap - 1) <= 0.15, "the body jumps in size at the swap: " + detail);
    expect(Math.abs(got.shrunk - 0.5) <= 0.12, "the body did not shrink with the dish: " + detail);
    expect(Math.abs(got.after - want) <= 0.15, "after the pick the body is not at the new base: " + detail);
    // the cards show the body the next size starts with
    expect(Math.abs(got.cards / got.after - 1) <= 0.12, `GAME BUG: during the cards the body is drawn ${f(got.cards / got.after)}x the size it has when play resumes (spec: "1.60 s: your body pops up to the new size's base radius"). zoomBegin never sets player.r, and update() returns before "P.r = bodyR()" in the grow and mutate states, so from growT 1.60 the shell eases to the stale Size I full-bar radius, then shrinks after the pick. ` + detail);
    return detail;
  });

  if (!touch) {
    await check(name, "7h pause and resume (Escape)", async () => {
      await page.keyboard.press("Escape");
      const a = await until(page, "window.__primordia.screen === 'pause'", { max: 3 });
      await page.keyboard.press("Escape");
      const b = await until(page, "window.__primordia.screen === 'play'", { max: 3 });
      expect(a.ok && b.ok, `pause ${a.ok}, resume ${b.ok}`);
    });
  }

  // 8. death: the over screen within 0.9 s; a fresh press after the guard starts a new run
  // die() starves the player and waits for the over screen. `arm` schedules a synthetic press a set
  // time after the screen appears (from the harness's MutationObserver, so the timing is exact).
  const die = async (arm = null) => {
    await page.evaluate(harness);
    await page.evaluate((arm) => {
      const g = window.__primordia.game, q = window.__qa;
      q.feed = false; q.park = null; q.glint = null; q.post = null; q.hold = false;
      if (g.state === "paused") g.state = "play";
      q.diedAt = 0; q.overAt = 0; q.twinAt = 0; q.probe = null; q.armOver = arm;
      g.player.light = 0.01;
    }, arm);
    const r = await until(page, "q.overAt > 0 && q.twinAt > 0" + (arm ? " && q.probe" : ""), { max: 30 });
    const t = await page.evaluate(() => { const q = window.__qa; return { diedAt: q.diedAt, overAt: q.overAt, twinAt: q.twinAt, probe: q.probe, screen: window.__primordia.screen }; });
    expect(r.ok && t.diedAt > 0 && t.overAt > 0, "no game-over screen: " + JSON.stringify(t));
    return { ms: t.overAt - t.diedAt, lag: t.twinAt - t.diedAt - 600, probe: t.probe };
  };
  const waitGuard = (ms) => page.waitForFunction((ms) => performance.now() - window.__qa.overAt >= ms, ms, { polling: 20 });
  const pressAt = () => page.evaluate(() => Math.round(window.__qa.inputAt - window.__qa.overAt));
  const restarted = () => page.evaluate(() => { const g = window.__primordia.game; return window.__primordia.screen === "play" && g.state === "play" && g.player.alive && g.epoch === 1; });
  const press = async (how) => {
    if (how === "tap") { const pt = await overPoint(page); expect(pt, "no free point on #overScreen to tap"); await page.touchscreen.tap(pt.x, pt.y); }
    else await page.keyboard.press(how);
  };
  // after the guard: a real press must start a new run
  const retry = async (how) => {
    await waitGuard(700);
    await press(how);
    const at = await pressAt();
    const now = await page.evaluate(() => window.__primordia.screen); // startRun runs inside the input handler
    const r = await until(page, "window.__primordia.screen === 'play'", { max: 4 });
    expect(r.ok && (await restarted()), `${how} ${at} ms after the over screen appeared did not start a new run (screen ${now})`);
    await page.evaluate(harness);
    return `${how} at ${at} ms -> screen "${now}" in the same input handler`;
  };

  const retryKey = touch ? "tap" : "KeyR";
  let died = null;
  try {
    died = await die();
    await shot("over");
    await noteOverflow("over");
    const stats = await page.evaluate(() => document.querySelector("#stats").textContent);
    const lag = Math.max(0, died.lag), detail = `over screen ${Math.round(died.ms)} ms after the light reached 0; a twin 600 ms timer ran ${Math.round(died.lag)} ms late`;
    if (!/GLORY BITES/.test(stats) || !/PARRIES/.test(stats)) record(name, "8a death -> over screen <= 0.9 s", "FAIL", "run stats missing: " + stats);
    else if (died.ms <= 900) record(name, "8a death -> over screen <= 0.9 s", "ok", detail);
    else if (died.ms - lag <= 900) record(name, "8a death -> over screen <= 0.9 s", "WARN", detail + " (software GL kept the main thread busy; the game's own delay is within 0.9 s)");
    else record(name, "8a death -> over screen <= 0.9 s", "FAIL", detail);
  } catch (err) { record(name, "8a death -> over screen <= 0.9 s", "FAIL", String(err.message || err)); }
  if (died) await check(name, `8b ${touch ? "tap on #overScreen" : "R"} after 0.7 s restarts`, () => retry(retryKey));
  if (!touch) await check(name, "8c Enter after 0.7 s restarts", async () => { await frames(page, 2); await die(); return retry("Enter"); });

  // Design 6.6: the over screen ignores presses for its first 0.6 s, and only R, 1, Enter, pad A or a
  // tap restart. The spec scenario does not name the guard, so an early restart is a WARN. Space is
  // the dash key, so Space restarting is a FAIL.
  const guardName = `8d probe: ${touch ? "tap" : "Enter"} 0.3 s after the over screen (guard)`;
  try {
    await frames(page, 2);
    const d = await die({ ms: 300, kind: touch ? "tap" : "key" });
    if (d.probe.at >= 600) {
      // the busy main thread delivered the 300 ms timer after 0.6 s: says nothing about the guard
      record(name, guardName, "SKIP", `inconclusive: the probe landed at ${d.probe.at} ms (screen then "${d.probe.screen}")`);
      if (d.probe.screen === "play") await page.evaluate(harness); else await retry(retryKey);
    } else if (d.probe.screen === "play") {
      record(name, guardName, "FAIL", `a synthetic ${touch ? "pointerdown on #overScreen" : "Enter keydown"} at ${d.probe.at} ms started a new run: design 6.6 asks for a 0.6 s guard`);
      await page.evaluate(harness);
    } else record(name, guardName, "ok", `ignored at ${d.probe.at} ms; then ` + (await retry(retryKey)));
  } catch (err) { record(name, guardName, "FAIL", String(err.message || err)); }
  if (!touch) {
    await check(name, "8e probe: Space (the dash key) on the over screen", async () => {
      await frames(page, 2);
      await die();
      const focus = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
      await press("Space");
      const at = await pressAt();
      const now = await page.evaluate(() => window.__primordia.screen);
      if (now === "play") { await page.evaluate(harness); }
      expect(now !== "play", `GAME BUG: Space ${at} ms after the over screen appeared started a new run. Focus is on #${focus}, and a focused button takes Space as a click, which calls startRun() with no guard; design 6.6 lists only R, 1, Enter, pad A and a tap`);
      await waitGuard(700); await press("KeyR"); await until(page, "window.__primordia.screen === 'play'", { max: 4 }); await page.evaluate(harness);
      return `ignored at ${at} ms`;
    });
  }

  // 9. layout: no horizontal scroll; HUD and touch buttons on screen
  await check(name, "9a no horizontal overflow" + (touch ? ", HUD and buttons on screen" : ""), async () => {
    await frames(page, 2);
    await noteOverflow("end");
    expect(overflows.length === 0, "horizontal overflow: " + overflows.join(", "));
    if (touch) {
      const boxes = await page.evaluate(() => {
        const vis = (s) => { const el = document.querySelector(s), b = el.getBoundingClientRect(); return { s, l: b.left, t: b.top, r: b.right, b: b.bottom, over: el.scrollWidth - el.clientWidth }; };
        return { w: innerWidth, h: innerHeight, items: ["#hud", "#dashBtn", "#burstBtn"].map(vis) };
      });
      const off = boxes.items.filter((b) => b.l < -1 || b.t < -1 || b.r > boxes.w + 1 || b.b > boxes.h + 1 || (b.s === "#hud" && b.over > 1));
      expect(off.length === 0, "off screen or clipped: " + JSON.stringify(off));
    }
  });

  let rmWave = null, rmWaveAtOnce = false, rmFood = "";
  // 10. reduced motion: the page reloads with prefers-reduced-motion (game.js reads it at load). The
  // dish grows behind a short fade with no pull-back, and the hunters still come back as prey.
  await check(name, "10 reduced motion: a fade, no zoom, hunters still turn into prey", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__primordia && window.__primordia.game, null, { timeout: 60000 });
    await frames(page, 2);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "setup: reduced motion was not emulated");
    if (touch) await tapEl(page, "#playBtn"); else await page.keyboard.press("Enter");
    const p = await until(page, "window.__primordia.screen === 'play'", { max: 8 });
    expect(p.ok, "PLAY did not start a run (the intro was already seen); screen " + (await page.evaluate(() => window.__primordia.screen)));
    await frames(page, 2);
    await page.evaluate(harness);
    await growScene(page);
    const f0 = await qaFrame(page);
    await page.evaluate(() => { const g = window.__primordia.game; g.growth = g.bar() - 1; g.addGrowth(1, g.player.x, g.player.y); });
    const res = await growTo(page, RM_STOPS, [], (tag) => shot("rm-" + tag));
    const S = res.stops;
    const zl = res.log.filter((v) => v.n === "uZoom").map((v) => v.v);
    expect(zl.length >= 3 && zl.every((z) => Math.abs(z - 1) < 1e-6), `the camera zoomed with reduced motion: uZoom ${Math.min(...zl).toFixed(3)}..${Math.max(...zl).toFixed(3)} over ${zl.length} frames`);
    // the fade: rgba(4,3,10,a) over the dish, a = 0.75 at the swap (growT 0.40), 0 by 0.60
    const want = (t) => Math.max(0, 1 - Math.abs(t - 0.4) / 0.2) * 0.75 * 255;
    const fb = RM_STOPS.filter((t) => Math.abs(S[t].corner - want(t)) > 25).map((t) => `${t}: alpha ${S[t].corner}, want ${want(t).toFixed(0)}`);
    expect(fb.length === 0, "fade: " + fb.join(", "));
    const outBad = RM_STOPS.filter((t) => S[t].out.fieldBad || S[t].out.fxBad).map((t) => `${t}: field ${S[t].out.fieldBad}, fx ${S[t].out.fxBad} at ${JSON.stringify(S[t].out.firstBad)}`);
    expect(outBad.length === 0, "drawn outside the dish frame: " + outBad.join("; "));
    const c = await until(page, "window.__primordia.screen === 'mutate'", { max: 30 });
    expect(c.ok, "the cards did not appear");
    await frames(page, 2);
    await shot("rm-cards");
    const kicker = await page.evaluate(() => { const q = window.__qa; q.feed = false; q.hold = false; q.park = null; return document.querySelector("#mutateKicker").textContent; });
    if (touch) { await page.waitForTimeout(450); await tapEl(page, "#cards .card >> nth=0"); } else await page.keyboard.press("Digit1");
    const pk = await until(page, "window.__primordia.screen === 'play' && g.epoch === 2 && g.state === 'play'", { max: 6 });
    expect(pk.ok, "the pick did not resume play in Size II");
    await frames(page, 3);
    const st = await page.evaluate(() => window.__primordia.game.prey.filter((q) => q.converted).length);
    // a quick pick: does the FOOD label show when play resumes within 3 s of zoomFinish? (compare 7f)
    const quick = await page.evaluate(() => {
      const q = window.__qa, zf = q.log.filter((v) => v.type === "zoomFinish").pop(), ep = q.log.filter((v) => v.type === "epochStart").pop();
      const food = window.__texts.some((t) => ep && t.t >= ep.t && /^FOOD/.test(t.s));
      return { food, after: zf && ep ? (ep.t - zf.t) / 1000 : NaN };
    });
    rmFood = `FOOD label ${quick.food ? "shown" : "not shown"} when play resumed ${quick.after.toFixed(1)} s after zoomFinish`;
    const zf = (await logSince(page, f0, ["zoomFinish"]))[0];
    await shot("rm-after");
    // design 7: with reduced motion "the molt wave recolours at once" (a probe; the spec does not say)
    const wave = res.log.filter((v) => v.n === "uConvert" && v.growT < 0.4 && v.v[3] > 0).map((v) => v.v[2]);
    rmWave = wave.length ? `molt radius ${Math.min(...wave).toFixed(0)} to ${Math.max(...wave).toFixed(0)} cells over ${wave.length} frames before the swap` : "no molt wave frames logged";
    rmWaveAtOnce = wave.length > 0 && Math.min(...wave) >= 140;
    expect(kicker === "YOU GREW · SIZE II", `cards kicker reads "${kicker}"`);
    expect(st >= 1, `no converted prey after the pick (${zf ? "zoomFinish logged" : "no zoomFinish"})`);
    return `uZoom 1 on all ${zl.length} grow frames; ${rmWave}; fade alpha ${RM_STOPS.map((t) => `${t}: ${S[t].corner}`).join(", ")} (want ${RM_STOPS.map((t) => want(t).toFixed(0)).join("/")}); ${st} converted prey after the pick; ${rmFood}; ${res.wall} s wall`;
  });
  if (rmWave !== null) record(name, "10b probe: molt wave with reduced motion", rmWaveAtOnce ? "ok" : "WARN", rmWaveAtOnce ? rmWave : `${rmWave}: the ring still spreads out from the player; design section 7 says that with reduced motion the molt wave recolours at once (growView() in game.js ignores reduceMotion for uConvert)`);
  await ctx.close();
  return finishRun(name, errors, overflows, t0, rate);
}

function finishRun(name, errors, overflows, t0, rate = "?") {
  if (errors.length) record(name, "9b no console errors", "FAIL", errors.slice(0, 6).join(" | "));
  else record(name, "9b no console errors", "ok");
  console.log(`---- ${name} done in ${((Date.now() - t0) / 1000).toFixed(0)} s at about ${rate} fps`);
}

// ---------- main ----------
try {
  const res = await fetch(base);
  if (!res.ok) throw new Error("HTTP " + res.status);
} catch (e) {
  console.error(`FAIL cannot load ${base} (${e.message}). Start the server: python3 -m http.server 8765 --bind 0.0.0.0 --directory public`);
  process.exit(2);
}
// software GL runs the page at about 3 frames per second; one run with the grow checks takes 10-20 minutes
const watchdogMin = 30 * Math.max(1, runList.length);
const watchdog = setTimeout(() => { console.error(`FAIL smoke run took over ${watchdogMin} minutes`); process.exit(3); }, watchdogMin * 60 * 1000);
const browser = await chromium.launch({ executablePath: exe, args: GL_ARGS });
try {
  for (const name of runList) {
    if (!RUNS[name]) { console.error("unknown run " + name); continue; }
    console.log(`---- ${name} ${RUNS[name].viewport.width}x${RUNS[name].viewport.height}${RUNS[name].touch ? " touch" : ""}`);
    try { await run(browser, name); } catch (err) { record(name, "run", "FAIL", "crashed: " + String((err && err.stack) || err).split("\n").slice(0, 3).join(" / ")); }
  }
} finally {
  await browser.close();
  clearTimeout(watchdog);
}

// table
const names = [...new Set(results.map((r) => r.check))];
const runsDone = runList.filter((n) => RUNS[n]);
const cell = (run, check) => { const r = results.find((x) => x.run === run && x.check === check); return r ? r.status : "-"; };
const w0 = Math.max(...names.map((n) => n.length), 5);
console.log("\n" + "check".padEnd(w0) + "  " + runsDone.map((n) => n.padEnd(9)).join(" "));
for (const n of names) console.log(n.padEnd(w0) + "  " + runsDone.map((r) => cell(r, n).padEnd(9)).join(" "));
fs.writeFileSync(path.join(out, "smoke-results.json"), JSON.stringify(results, null, 2));
const fails = results.filter((r) => r.status === "FAIL"), warns = results.filter((r) => r.status === "WARN");
console.log(`\nscreenshots and smoke-results.json in ${out}`);
console.log(fails.length ? `SMOKE FAILED (${fails.length} failed, ${warns.length} warnings)` : `SMOKE OK (${warns.length} warnings)`);
process.exitCode = fails.length ? 1 : 0;
