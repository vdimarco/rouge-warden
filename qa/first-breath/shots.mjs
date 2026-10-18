// First Breath: screenshots for review and the PR (design.md 13.3, 17). Headless Chromium with --disable-gpu. With
// the site served (it starts the server itself when nothing answers), into the folder SHOTS (default: the system's
// temp folder, first-breath-shots/, so nothing lands in the repository):
// - every stage and the ending at the three layouts (390 × 844 and 844 × 390 with touch, 1440 × 900), in both tiers
//   (?q=full and ?q=low), each at a moment where the stage is in play (?test=1, the ref bot, stepped): files
//   <layout>-<tier>-<n>-<stage>.png, and a contact sheet per layout and tier, sheet-<layout>-<tier>.png;
// - stage 8 also in its light (birth-light), at the three layouts, full tier;
// - a 1 s strip of stage 1 at ?res=0.5 in real time (10 frames, 100 ms apart) to review the sway's sub-pixel steps
//   by eye: strip-sway.png.
//   SHOTS=/tmp/fb-shots NODE_PATH=qa/browser/node_modules node qa/first-breath/shots.mjs   (ONLY=portrait TIERS=full)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/shots.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const OUT = path.resolve(process.env.SHOTS || path.join(os.tmpdir(), "first-breath-shots"));
fs.mkdirSync(OUT, { recursive: true });
const LAYOUTS = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
// stage, seconds of ref-bot play before the shot
const PLAN = [["swim", 22], ["egg", 33], ["split", 14], ["root", 26], ["grow", 40], ["answer", 30], ["turn", 33], ["birth", 30], ["ending", 22]];
const only = process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(LAYOUTS);
const tiers = process.env.TIERS ? process.env.TIERS.split(",") : ["full", "low"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function answers() { try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; } }
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")], { stdio: "ignore" });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) { console.log(`FAIL ${FILE}: nothing answers at ${BASE}`); if (server) server.kill(); process.exit(1); }

const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ["--disable-gpu"] });
const errors = [];
const sheetPage = await (await browser.newContext()).newPage();
await sheetPage.goto("about:blank");

// Compose PNG files into one sheet (in a blank page, so no image library is needed).
async function sheet(files, cols, scale, out) {
  const imgs = files.map((f) => fs.readFileSync(f).toString("base64"));
  const b64 = await sheetPage.evaluate(async ({ imgs, cols, scale }) => {
    const els = await Promise.all(imgs.map(async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; }));
    const w = Math.round(els[0].width * scale), h = Math.round(els[0].height * scale), gap = 6;
    const rows = Math.ceil(els.length / cols);
    const c = document.createElement("canvas"); c.width = cols * (w + gap) + gap; c.height = rows * (h + gap) + gap;
    const g = c.getContext("2d"); g.fillStyle = "#14060f"; g.fillRect(0, 0, c.width, c.height);
    els.forEach((e, i) => g.drawImage(e, gap + (i % cols) * (w + gap), gap + Math.floor(i / cols) * (h + gap), w, h));
    return c.toDataURL("image/png").split(",")[1];
  }, { imgs, cols, scale });
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
}

let count = 0;
for (const lay of only) {
  const ctx = await browser.newContext({ ...LAYOUTS[lay] });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${lay}: ${(e.stack || e.message).split("\n")[0]}`));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  for (const tier of tiers) {
    const files = [];
    for (let i = 0; i < PLAN.length; i++) {
      const [s, secs] = PLAN[i];
      await page.goto(`${BASE}?test=1&mute=1&seed=1&q=${tier}&stage=${s}`);
      await page.waitForFunction(() => window.__fb && __fb.state().frames >= 1, null, { timeout: 60000 });
      await page.evaluate((n) => { __fb.bot(1); for (let k = 0; k < n; k += 30) __fb.step(Math.min(30, n - k)); }, Math.round(secs * 60));
      const f = path.join(OUT, `${lay}-${tier}-${i + 1}-${s}.png`);
      await page.screenshot({ path: f });
      files.push(f); count++;
    }
    if (tier === "full") {
      await page.goto(`${BASE}?test=1&mute=1&seed=1&q=full&stage=birth`);
      await page.waitForFunction(() => window.__fb && __fb.state().frames >= 1, null, { timeout: 60000 });
      await page.evaluate(() => { __fb.jump("light"); __fb.step(40); });
      const f = path.join(OUT, `${lay}-full-${PLAN.length + 1}-birth-light.png`);
      await page.screenshot({ path: f });
      files.push(f); count++;
    }
    await sheet(files, lay === "portrait" ? 5 : 3, lay === "portrait" ? 0.5 : lay === "landscape" ? 0.5 : 0.3, path.join(OUT, `sheet-${lay}-${tier}.png`));
  }
  // the sway strip: stage 1 at step 0.5, in real time, 10 frames over 1 s
  if (lay === "portrait") {
    await page.goto(`${BASE}?mute=1&seed=1&res=0.5&q=full&stage=swim`);
    await page.waitForFunction(() => window.__fb && __fb.state().frames > 2, null, { timeout: 60000 });
    await page.evaluate(() => __fb.bot(1));
    await wait(1500);
    const strip = [];
    for (let k = 0; k < 10; k++) {
      const f = path.join(OUT, `sway-${k}.png`);
      await page.screenshot({ path: f, clip: { x: 95, y: 280, width: 200, height: 240 } });
      strip.push(f);
      await wait(100);
    }
    await sheet(strip, 10, 1, path.join(OUT, "strip-sway.png"));
    for (const f of strip) fs.unlinkSync(f);
  }
  await ctx.close();
}
await browser.close();
if (server) server.kill();
if (errors.length) { for (const e of errors) console.log(`FAIL ${e}`); console.log(`FAIL ${FILE}: page errors`); process.exitCode = 1; }
else console.log(`PASS ${FILE}: ${count} screenshots, the contact sheets and the sway strip in ${OUT}`);
