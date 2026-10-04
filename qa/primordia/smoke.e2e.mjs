// Browser smoke test for Primordia's Hunt combat (combat design section 8.5).
// Three runs: desktop 1280x720 (mouse + keyboard), phone portrait 390x844 and phone landscape 844x390
// (touch). Each run: title and start, steering, a locked lunge lane (outline pixels sampled on the fx
// canvas), Glory Bite with Remains, Burst, glint star, parry into Stasis (shader grade measured on the
// field canvas), dash pips (touch), the mutation pick, game over and instant retry, console errors and
// horizontal overflow.
//
// Needs the static server: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Usage: node qa/primordia/smoke.e2e.mjs [outDir]
//   PRIMORDIA_URL   page under test (default http://127.0.0.1:8765/primordia/)
//   PRIMORDIA_RUNS  comma list of runs to do (default desktop,portrait,landscape)
//   PW_CHROMIUM     chromium binary (default /opt/pw-browsers/chromium when it exists)
// Playwright resolves from NODE_PATH or from qa/browser/node_modules.
//
// Software GL (SwiftShader) draws this page at 1-10 frames per second and the game caps a frame at
// 0.05 s of game time, so every wait here counts animation frames or polls a condition. Scripted fights
// go through window.__primordia.game plus a small in-page harness that wraps game.update on the
// instance: it can park and feed the player, hold the epoch clock, hold a hunter at its glint, log
// events and freeze the game (game.state = "paused", which core's update() skips) for screenshots.
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
const GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const SP_PARA = 0; // SP.PARA in core.js

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
    if (q.feed && P.alive) P.light = P.maxLight;
    if (q.hold && this.state === "play") this.epochTime = Math.min(Math.max(this.epochTime, 5), 30);
    if (q.park) {
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
  return true;
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

  await check(name, "1b start (" + (touch ? "tap PLAY" : "Enter") + "): How to play runs first, Skip starts the run", async () => {
    if (touch) await tapEl(page, "#playBtn"); else await page.keyboard.press("Enter");
    // a fresh browser sees the intro scenes before its first run
    const i = await until(page, "window.__primordia.screen === 'intro'", { max: 6 });
    expect(i.ok, "PLAY did not open the intro; screen=" + (await page.evaluate(() => window.__primordia.screen)));
    const scene = await until(page, "window.__primordia.intro && window.__primordia.intro.k >= 1 && window.__primordia.intro.s.t > 1.2", { max: 400 });
    expect(scene.ok, "the intro did not reach its first lesson");
    const cap = await page.evaluate(() => ({ title: document.querySelector("#introTitle").getAttribute("aria-label"), keys: document.querySelector("#introKeys").textContent, id: window.__primordia.intro.scene.id }));
    await shot("intro");
    await noteOverflow("intro");
    expect(cap.title && cap.keys, "intro caption missing: " + JSON.stringify(cap));
    if (touch) await tapEl(page, "#introSkip"); else await page.keyboard.press("Escape");
    const p = await until(page, "window.__primordia.screen === 'play'", { max: 6 });
    expect(p.ok, "Skip did not start the run");
    expect(await page.evaluate(() => localStorage.getItem("primordia.intro") === "true"), "the intro was not marked as seen");
    await frames(page, 2);
    await page.evaluate(harness);
    const st = await page.evaluate(() => {
      const g = window.__primordia.game;
      return { screen: window.__primordia.screen, state: g.state, alive: g.player.alive, w: g.w, h: g.h, compact: g.compact, caps: g.caps(), touchUi: !document.querySelector("#touch").hidden };
    });
    await noteOverflow("play");
    expect(st.screen === "play" && st.state === "play" && st.alive, "did not start: " + JSON.stringify(st));
    expect(st.touchUi === touch, "touch controls shown=" + st.touchUi);
    if (name === "portrait") expect(st.w === 128 && st.h === 256, `portrait dish is ${st.w}x${st.h}`);
    else expect(st.w === 256 && st.h === 128, `dish is ${st.w}x${st.h}`);
    if (touch) expect(st.compact && st.caps.gliders === 3 && st.caps.bodies === 6, "touch caps " + JSON.stringify(st.caps));
    return `intro scene "${cap.id}": ${cap.title}; dish ${st.w}x${st.h}, caps ${st.caps.gliders}/${st.caps.bodies}`;
  });

  await check(name, "1c steer (" + (touch ? "touch stick" : "mouse + WASD") + ")", async () => {
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
    return `glory +${kill.points} (mult ${kill.mult}) after ${r.frames} frames; ${st.remains} Remains prey tracked after ${rr.frames} more frames${cleared ? " (prey channel was over 1000 mass and was cleared first)" : ""}`;
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

  // 7. epoch end: mutation cards with kind labels and a Duo; pick one
  await check(name, "7 mutation pick (" + (touch ? "tap card 2" : "key 2") + ")", async () => {
    await page.evaluate(() => {
      const g = window.__primordia.game, q = window.__qa;
      q.hold = false; q.park = null;
      // own both parents of Chain Bloom and promise a Duo, so the DUO tag shows
      g.mut.sporeburst = Math.max(1, g.mut.sporeburst); g.mut.nerve = Math.max(1, g.mut.nerve); g.duoNext = true;
      g.epochTime = 39.99;
    });
    const r = await until(page, "window.__primordia.screen === 'mutate'", { max: 10 });
    expect(r.ok, "epoch end did not open mutations; screen=" + (await page.evaluate(() => window.__primordia.screen)));
    await frames(page, 2);
    await shot("mutate");
    await noteOverflow("mutate");
    const cards = await page.evaluate(() => [...document.querySelectorAll("#cards .card")].map((c) => ({ name: c.querySelector("b").textContent, kind: c.querySelector(".kind") && c.querySelector(".kind").textContent, duo: c.querySelector(".duo-tag") && c.querySelector(".duo-tag").textContent, isDuo: c.classList.contains("duo") })));
    const offer = await page.evaluate(() => window.__primordia.game.offer.map((m) => m.id));
    const before = await page.evaluate(() => ({ ...window.__primordia.game.mut }));
    expect(cards.length === 3, `${cards.length} cards`);
    const unlabeled = cards.filter((c) => !(/^(BUILD|EXTRA)$/.test(c.kind || "") || c.duo === "DUO"));
    expect(unlabeled.length === 0, "cards without a kind label or DUO tag: " + unlabeled.map((c) => c.name).join(", "));
    expect(cards.some((c) => c.isDuo && c.duo === "DUO"), "no DUO card although both Chain Bloom parents are owned and duoNext is set: " + JSON.stringify(cards));
    // the cards ignore taps for their first 0.4 s, so a dash press at the epoch end cannot pick one
    if (touch) { await page.waitForTimeout(450); await tapEl(page, "#cards .card >> nth=1"); } else await page.keyboard.press("Digit2");
    const p = await until(page, "window.__primordia.screen === 'play' && g.epoch === 2 && g.state === 'play'", { max: 6 });
    const after = await page.evaluate(() => ({ ...window.__primordia.game.mut }));
    expect(p.ok, "card pick did not resume play in epoch II");
    expect(after[offer[1]] === before[offer[1]] + 1, `picked card 2 (${offer[1]}) but the mutation did not apply`);
    return cards.map((c) => `${c.name} [${c.duo || c.kind}]`).join(", ") + ` -> took ${offer[1]}`;
  });

  if (!touch) {
    await check(name, "7b pause and resume (Escape)", async () => {
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
const watchdog = setTimeout(() => { console.error("FAIL smoke run took over 30 minutes"); process.exit(3); }, 30 * 60 * 1000);
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
