// Shared setup for the Reel It In QA scripts that drive the real page.
// Serve public/ first, for example: cd public && python3 -m http.server 8765
// Set FISH_URL to test another address. three.js is served from the repo's own copy (public/crimson/lib), so no CDN is needed.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

export const URL = process.env.FISH_URL || "http://localhost:8765/fish/";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SHOTS = process.env.SHOTS || "";

// save: a save file (an object) to start with, put in localStorage on the first load only (clear must be on)
export async function open({ width = 390, height = 844, touch = true, phone = true, clear = true, query = "", save = null } = {}) {
  // WebGL runs on SwiftShader; the 2D canvases (the reel, the gauge) stay on the CPU, which is far faster than an emulated GPU
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-accelerated-2d-canvas"] });
  const ctx = await browser.newContext(touch ? { viewport: { width, height }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true } : { viewport: { width, height }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_TOO_MANY|ERR_CERT/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/three.module.min.js", (r) => r.fulfill({ path: path.join(ROOT, "public/crimson/lib/three.module.min.js"), contentType: "application/javascript" }));
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  if (clear) await page.addInitScript((save) => { if (!sessionStorage.getItem("qa-kept")) { localStorage.clear(); if (save) localStorage.setItem("fish.v1", JSON.stringify(save)); sessionStorage.setItem("qa-kept", "1"); } }, save);
  if (phone) await page.addInitScript(installPhone);
  await page.goto(URL + query);
  await page.waitForSelector("#title:not([hidden])", { timeout: 180000 });
  return { browser, page, errors };
}

// Runs in the page before any script: a virtual phone that sends orientation and motion events at 60 Hz.
// Tests move it by setting a pose (an "up" vector in device coordinates); the gyro reading is worked out
// from how that up vector turns between frames, so the orientation and the gyro always agree.
function installPhone() {
  const D = 180 / Math.PI;
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  // beta/gamma for an up vector, keeping gamma in [-90, 90) like a real browser
  function euler(u) {
    let beta = Math.atan2(u.y, Math.hypot(u.x, u.z)) * D, gamma = Math.atan2(-u.x, u.z) * D;
    if (gamma >= 90 || gamma < -90) { beta = 180 - beta; gamma = gamma >= 90 ? gamma - 180 : gamma + 180; if (beta >= 180) beta -= 360; }
    return { beta, gamma };
  }
  const P = (window.__phone = { up: { x: 0, y: 1, z: 0 }, spin: { x: 0, y: 0, z: 0 }, on: true, prev: null, sent: 0 });
  // a pose from the rod angle: portrait (rod = device +y) or landscape (rod = device +x, phone turned counter-clockwise)
  P.pose = (theta, mode = "portrait", roll = 0) => {
    const t = theta / D, r = roll / D;
    let u = mode === "portrait" ? { x: 0, y: Math.sin(t), z: Math.cos(t) } : { x: Math.sin(t), y: 0, z: Math.cos(t) };
    // steering: tilting the phone clockwise (as you look at it) turns "up", seen in device coordinates, the other way about the screen normal
    if (r) u = { x: u.x * Math.cos(r) - u.y * Math.sin(r), y: u.x * Math.sin(r) + u.y * Math.cos(r), z: u.z };
    P.up = norm(u);
  };
  if (window.DeviceMotionEvent) Object.defineProperty(DeviceMotionEvent, "requestPermission", { value: () => Promise.resolve("granted"), configurable: true });
  if (window.DeviceOrientationEvent) Object.defineProperty(DeviceOrientationEvent, "requestPermission", { value: () => Promise.resolve("granted"), configurable: true });
  function tick() {
    if (!P.on) return;
    const u = P.up, now = performance.now();
    let rr = { alpha: P.spin.x, beta: P.spin.y, gamma: P.spin.z };
    if (P.prev) {
      // device angular velocity from the change of the up vector: d(up)/dt = -w x up
      const a = P.prev.u, dt = Math.max(0.005, (now - P.prev.t) / 1000);
      const c = { x: a.y * u.z - a.z * u.y, y: a.z * u.x - a.x * u.z, z: a.x * u.y - a.y * u.x };
      const s = Math.hypot(c.x, c.y, c.z), ang = Math.atan2(s, a.x * u.x + a.y * u.y + a.z * u.z);
      if (s > 1e-9) { const k = (-ang / dt) * D / s; rr = { alpha: c.x * k + P.spin.x, beta: c.y * k + P.spin.y, gamma: c.z * k + P.spin.z }; }
    }
    P.prev = { u, t: now };
    const e = euler(u);
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: e.beta, gamma: e.gamma, absolute: false }));
    window.dispatchEvent(new DeviceMotionEvent("devicemotion", { acceleration: { x: 0, y: 0, z: 0 }, accelerationIncludingGravity: { x: u.x * 9.81, y: u.y * 9.81, z: u.z * 9.81 }, rotationRate: rr, interval: 16 }));
    P.sent++;
  }
  setInterval(tick, 16);
}

// Waits for a condition in the page (a function body returning truthy), polling every 50 ms.
export async function until(page, fn, arg, timeout = 60000) {
  return page.waitForFunction(fn, arg, { timeout, polling: 50 });
}

// A pointer on an element, in client coordinates. Synthetic events bubble like real ones, and carry
// an exact timeStamp, which the cast release needs.
export async function pointer(page, type, x, y, id = 1) {
  await page.evaluate(({ type, x, y, id }) => {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, buttons: type === "pointerup" ? 0 : 1 }));
  }, { type, x, y, id });
}
export const center = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
export async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
