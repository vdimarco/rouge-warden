// Shared setup for the Breath of the Lake QA scripts.
// Serve public/ first, for example: cd public && python3 -m http.server 8765
// Set WILD_URL to change the address, and THREE_LOCAL to a local three.module.min.js and THREE_ADDONS to a local examples/jsm folder if the CDN is blocked.
import { createRequire } from "module";
// Uses the playwright package from this project or from NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright");

export const URL = process.env.WILD_URL || "http://localhost:8765/wild/";

export async function open({ width = 640, height = 360, touch = false, clear = true } = {}) {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext(touch ? { viewport: { width, height }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true } : { viewport: { width, height }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  // software rendering is slow, and the page now loads its 3D models before the title screen
  page.setDefaultTimeout(240000);
  page.setDefaultNavigationTimeout(240000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  if (process.env.THREE_LOCAL) await page.route("**/three.module.min.js", (r) => r.fulfill({ path: process.env.THREE_LOCAL, contentType: "application/javascript" }));
  // THREE_ADDONS: a local copy of three's examples/jsm folder (GLTFLoader and SkeletonUtils are used)
  if (process.env.THREE_ADDONS) await page.route("**/examples/jsm/**", (r) => r.fulfill({ path: process.env.THREE_ADDONS + r.request().url().split("/examples/jsm")[1], contentType: "application/javascript" }));
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  if (clear) await page.addInitScript(() => { if (!sessionStorage.getItem("qa-kept")) { localStorage.clear(); sessionStorage.setItem("qa-kept", "1"); } });
  await page.goto(URL);
  await page.waitForSelector("#title:not([hidden])", { timeout: 300000 });
  return { browser, page, errors };
}

// The title waits for any button, then shows its menu.
export async function openMenu(page) {
  if (await page.evaluate(() => document.querySelector("#tmenu").hidden)) await page.click("#tpress");
  await page.waitForSelector("#tmenu:not([hidden])");
}

// Start a new game, skip the intro, and stop the real-time loop so tests drive the game by hand.
export async function newGame(page, { skipClick = false } = {}) {
  if (!skipClick) { await openMenu(page); await page.click("#newBtn"); await page.click("#pickGo"); }
  await page.waitForFunction(() => window.G && G.started, null, { timeout: 60000 });
  await page.evaluate(async () => {
    for (let k = 0; k < 40 && !G.save.intro; k++) { for (let i = 0; i < 80 && G.ui.modal === "dialog"; i++) G.ui.advance(); await new Promise((r) => setTimeout(r, 200)); }
    for (let i = 0; i < 80 && G.ui.modal === "dialog"; i++) G.ui.advance();
    G.paused = true;
  });
  await page.evaluate(installHelpers);
}

// Waits for the game to draw n more frames. Software rendering in a test browser can be very slow.
export async function frames(page, n = 3) {
  const f0 = await page.evaluate(() => G.frame || 0);
  await page.waitForFunction((t) => (G.frame || 0) >= t, f0 + n, { timeout: 300000, polling: 50 });
}

// Runs inside the page: helpers every test uses.
function installHelpers() {
  const I = G.inp, P = G.player, W = G.world;
  const QA = (window.QA = {});
  QA.clear = () => { I.move.x = I.move.y = 0; I.jump = I.attack = I.attackHeld = I.roll = I.interact = I.sprint = I.eat = I.lift = I.fury = I.next = I.prev = I.throw = false; I.slot = -1; I.look = { x: 0, y: 0 }; };
  QA.clear();
  QA.closeModals = () => {
    for (let i = 0; i < 80 && G.ui.modal === "dialog"; i++) G.ui.advance();
    const ch = document.querySelector("#choice"); if (!ch.hidden) ch.querySelector("button").click();
    for (const id of ["map", "pause", "help", "quests"]) if (G.ui.modal === id) G.ui.close(id);
    G.paused = true;
  };
  QA.step = (n = 1, each) => { for (let i = 0; i < n; i++) { if (each) each(i); G.test.step(1 / 30); I.jump = I.attack = I.roll = I.interact = I.eat = I.lift = I.fury = I.next = I.prev = I.throw = false; I.slot = -1; } };
  QA.boxAt = (x, y, z, shrink = 0.25) => {
    for (const b of W.boxes) {
      if (b.walk) continue;
      if (y <= b.y0 + 0.3 || y >= b.top - 0.3) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = (x - b.x) * c - (z - b.z) * s, lz = (x - b.x) * s + (z - b.z) * c;
      if (Math.abs(lx) < b.hw - shrink && Math.abs(lz) < b.hd - shrink) return b;
    }
    return null;
  };
  // Rules that must hold after every step.
  QA.check = () => {
    const bad = [];
    const p = P.pos;
    if (![p.x, p.y, p.z, P.vel.x, P.vel.y, P.vel.z, P.yaw].every(Number.isFinite)) bad.push("not-finite");
    const h = W.height(p.x, p.z);
    if (P.state !== "swim" && p.y < h - 0.6) bad.push("under-ground");
    if (P.state === "swim" && p.y < -2) bad.push("under-water");
    if (Math.abs(p.x) > 790 || Math.abs(p.z) > 790) bad.push("out-of-world");
    if (P.state !== "climb" && QA.boxAt(p.x, p.y + 0.5, p.z)) bad.push("inside-building");
    if (!(P.hp >= 0 && P.hp <= P.maxHp)) bad.push("bad-hp");
    if (!(P.stamina >= 0 && P.stamina <= P.staminaMax + 0.01)) bad.push("bad-stamina");
    const cam = G.camera.position;
    if (![cam.x, cam.y, cam.z].every(Number.isFinite)) bad.push("camera-not-finite");
    return bad;
  };
  QA.landSpot = (rnd) => { for (let k = 0; k < 500; k++) { const x = (rnd() - 0.5) * 1300, z = (rnd() - 0.5) * 1300; const h = W.height(x, z); if (h > 2 && h < 90 && W.normal(x, z).y > 0.85 && !QA.boxAt(x, h + 1, z)) return [x, z]; } return [0, 300]; };
  QA.rng = (s) => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
