// Shared setup for the lab QA scripts that drive a real page.
// Serve public/ first, for example: cd public && python3 -m http.server 8765
// Set LAB_URL to test another address. The toys are 2D canvas, so they load nothing from a CDN.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { installPhone } from "../fish/lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");

export const BASE = (process.env.LAB_URL || "http://localhost:8765/lab/").replace(/\/?$/, "/");
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SHOTS = process.env.SHOTS || "";
export const PHONE = { width: 390, height: 844, touch: true };
export const DESK = { width: 1280, height: 800, touch: false };

// Opens a lab page. phone: true adds the virtual phone from qa/fish/lib.mjs (orientation and motion events at 60 Hz,
// steered with window.__phone.pose(theta, mode, roll)). Collects page errors and console errors.
export async function open(page_, { width = 390, height = 844, touch = true, phone = false, clear = true, hash = "", init = null, browser: shared = null } = {}) {
  const browser = shared || await chromium.launch({ args: ["--disable-accelerated-2d-canvas", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext(touch ? { viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  if (clear) await page.addInitScript(() => { if (!sessionStorage.getItem("qa-kept")) { localStorage.clear(); sessionStorage.setItem("qa-kept", "1"); } });
  if (phone) await page.addInitScript(installPhone);
  if (init) await page.addInitScript(init);
  await page.goto(BASE + page_ + hash);
  return { browser, ctx, page, errors, close: () => (shared ? ctx.close() : browser.close()) };
}

// Waits for a condition in the page, polling every 50 ms.
export const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });

// A pointer event on the element under (x, y), in client coordinates, like a finger.
export async function pointer(page, type, x, y, id = 1, kind = "touch") {
  await page.evaluate(({ type, x, y, id, kind }) => {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, buttons: type === "pointerup" ? 0 : 1 }));
  }, { type, x, y, id, kind });
}
// A drag from (x0, y0) to (x1, y1) over ms, in steps of about 16 ms.
export async function drag(page, x0, y0, x1, y1, ms = 200, id = 1) {
  await pointer(page, "pointerdown", x0, y0, id);
  const n = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    await pointer(page, "pointermove", x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, id);
    await sleep(16);
  }
  await pointer(page, "pointerup", x1, y1, id);
}
export async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + ".png") });
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reporting: check(ok, msg) prints a line; done() prints the errors and exits 1 on any failure.
export function report(name) {
  const fails = [];
  let passes = 0;
  return {
    check(ok, msg) { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); return ok; },
    section(s) { console.log("\n" + s); },
    done(errors = []) {
      for (const e of errors) { fails.push(e); console.log("  FAIL " + e); }
      console.log(`\n${name}: ${passes} passed, ${fails.length} failed`);
      process.exit(fails.length ? 1 : 0);
    },
  };
}
