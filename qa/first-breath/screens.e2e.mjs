// First Breath: the screens and captions in the page (design.md 8, 12; review F11, F18, F22, F32, F33, F35). With the
// site served (it starts `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless
// Chromium with --disable-gpu, it checks:
// - stage 8 (?test=1, no input, at 390 × 844 with touch and 1440 × 900): no caption ever repeats the prompt line's
//   words, and "Rest. Another wave will come." shows on the prompt line only (a sub-goal line the prompt line shows
//   is never also a caption, whatever its state);
// - Settings over pause: with ?mute=1 the Sound switch reads Off, and tapping it turns the sound on; on a plain page,
//   M and C update the Sound and Captions switches under an open Settings (focus kept in the panel), and the Sound
//   switch then does what it says;
// - every screen's region is named by its own words (its heading, with the kicker, or the overlay's grade line), never
//   by an internal screen id ("settings", "pause", "tapTest", "almost", "card", "overlay", "result");
// - in real time: a caption under the pause screen is still there on resume, with the time it had left (5 s paused);
// - in real time, stage 3 practice with the reference bot at 390 × 844: no fact caption flashes for under 1.4 s, and
//   every fact that shows stays for its reading time (1.5 s + 55 ms a letter, at least 4 s; 10% slack for timers).
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/screens.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/screens.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const SIZES = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();

let passed = 0;
const failed = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

// ---- the server
async function answers() {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; }
}
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")],
    { stdio: "ignore", detached: false });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) {
  console.log(`FAIL ${FILE}: nothing answers at ${BASE}`);
  if (server) server.kill();
  process.exit(1);
}

const exe = process.env.CHROMIUM_PATH || process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

async function open(size, query) {
  const ctx = await browser.newContext({ ...SIZES[size] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 0, null, { timeout: 60000 });
  return { ctx, page, errors };
}
const F = (page, fn, arg) => page.evaluate(fn, arg);
async function press(page, size, selector) {
  if (SIZES[size].hasTouch) await page.tap(selector, { timeout: 5000 });
  else await page.click(selector, { timeout: 5000 });
}

// ---- 1. F11: stage 8's rest line is said once, on the prompt line
for (const size of Object.keys(SIZES)) {
  const { ctx, page, errors } = await open(size, "?test=1&seed=1");
  const r = await F(page, () => {
    const fb = window.__fb;
    fb.goto("birth", { seed: 1 });
    const both = [], rests = [];
    for (let i = 0; i < 150; i++) {
      const s = fb.step(6);
      const p = document.querySelector('[data-hud="prompt"]');
      const prompt = p && !p.hidden ? p.textContent.trim() : "";
      const c = document.querySelector("#captions .cap");
      const cap = c ? c.textContent.trim() : "";
      if (cap && cap === prompt) both.push(`${s.t.toFixed(1)} "${cap}"`);
      if (cap === "Rest. Another wave will come.") rests.push(s.t.toFixed(1));
      if (prompt === "Rest. Another wave will come." && !rests.prompt) rests.prompt = s.t.toFixed(1);
    }
    return { both: [...new Set(both)].slice(0, 4), rests, restPrompt: rests.prompt || null };
  });
  check(`${size}: birth: the prompt line shows "Rest. Another wave will come."`, !!r.restPrompt, JSON.stringify(r));
  check(`${size}: birth: no caption repeats the prompt line, and the rest line is never a caption`,
    r.both.length === 0 && r.rests.length === 0, JSON.stringify(r));
  check(`${size}: no page errors (birth)`, errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 2. F22, F33: the Sound and Captions switches under an open Settings
const switches = (page) => F(page, () => {
  const s = document.querySelector('[data-set="sound"]'), c = document.querySelector('[data-set="captions"]');
  const a = document.activeElement;
  return { sound: s && s.getAttribute("aria-checked"), soundText: s && s.textContent.trim(), captions: c && c.getAttribute("aria-checked"),
    muted: window.__fb.sound.muted, cap: window.__fb.state().settings.captions,
    focusIn: !!(a && a.closest && a.closest('section[data-screen="settings"]')) };
});
for (const size of Object.keys(SIZES)) {
  // ?mute=1 mutes the visit while arcade.sound stays on: the switch says Off, and a tap turns the sound on
  {
    const { ctx, page, errors } = await open(size, "?seed=1&mute=1");
    await press(page, size, "#play");
    await wait(300);
    await F(page, () => { window.__fb.act("pause"); window.__fb.act("settings"); });
    const a = await switches(page);
    await press(page, size, '[data-set="sound"]');
    const b = await switches(page);
    check(`${size}: ?mute=1: Settings shows Sound Off, and its switch turns the sound on`,
      a.muted === true && a.sound === "false" && /Off$/.test(a.soundText) && b.muted === false && b.sound === "true",
      `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    check(`${size}: no page errors (?mute=1)`, errors.length === 0, errors.slice(0, 3).join(" || "));
    await ctx.close();
  }
  // M and C with Settings open
  {
    const { ctx, page, errors } = await open(size, "?seed=1");
    await press(page, size, "#play");
    await wait(300);
    await F(page, () => { window.__fb.act("pause"); window.__fb.act("settings"); });
    const a = await switches(page);
    await page.keyboard.press("KeyM");
    await page.keyboard.press("KeyC");
    const b = await switches(page);
    await press(page, size, '[data-set="sound"]');
    const c = await switches(page);
    check(`${size}: M and C update the Sound and Captions switches under Settings, focus kept`,
      a.sound === "true" && a.captions === "true" && b.muted === true && b.sound === "false" && b.cap === false && b.captions === "false" && b.focusIn,
      `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    check(`${size}: after M, the Sound switch (Off) turns the sound on`, c.muted === false && c.sound === "true", JSON.stringify(c));
    check(`${size}: no page errors (M, C)`, errors.length === 0, errors.slice(0, 3).join(" || "));
    await ctx.close();
  }
}

// ---- 3. F35: each screen's region is named by its own words
{
  const { ctx, page, errors } = await open("desktop", "?test=1&seed=1");
  const names = [];
  const read = () => F(page, () => {
    const sec = document.querySelector("#screens section.screen:not([hidden])");
    if (!sec) return null;
    const ids = (sec.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    const name = sec.getAttribute("aria-label") || ids.map((id) => (document.getElementById(id) || {}).textContent || "").join(" ").trim();
    return { screen: sec.dataset.screen, name };
  });
  for (const m of ["settings", "stages", "sources", "tapTest"]) {
    await F(page, (m) => window.__fb.act(m), m);
    names.push(await read());
    await F(page, () => window.__fb.act("back"));
  }
  await F(page, () => { window.__fb.act("play"); window.__fb.step(30); window.__fb.act("pause"); });
  names.push(await read());
  await F(page, () => { window.__fb.act("resume"); window.__fb.finish(); });
  names.push(await read());                                           // the Almost card
  await F(page, () => { window.__fb.act("goOn"); for (let i = 0; i < 60 && window.__fb.state().screen !== "overlay"; i++) window.__fb.step(10); });
  names.push(await read());                                           // the overlay
  await F(page, () => { window.__fb.act("next"); window.__fb.step(6); });
  names.push(await read());                                           // the card
  await F(page, () => { window.__fb.goto("birth"); window.__fb.finish(); });
  names.push(await read());                                           // the result
  const raw = new Set(["title", "card", "overlay", "almost", "pause", "settings", "tapTest", "stages", "sources", "result"]);
  const bad = names.filter((x) => !x || !x.name || raw.has(x.name) || /\b[a-z]+\.[a-z]/i.test(x.name));
  check(`every screen's region is named by its own words (${names.map((x) => x && `${x.screen}: "${x.name}"`).join("; ")})`,
    bad.length === 0 && names.length === 9, JSON.stringify(bad));
  const want = { settings: "Settings", pause: "Paused", tapTest: "Tap test", card: /^Stage 2 /, result: /\S/ };
  const off = names.filter((x) => x && want[x.screen] && !(want[x.screen] instanceof RegExp ? want[x.screen].test(x.name) : x.name === want[x.screen]));
  check("Settings, pause, the Tap test and the card read their headings", off.length === 0, JSON.stringify(off));
  check("no page errors (regions)", errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 4. F32: a caption under the pause screen keeps its time
{
  const { ctx, page, errors } = await open("portrait", "?seed=1&mute=1");
  await press(page, "portrait", "#play");
  await page.waitForFunction(() => !!document.querySelector("#captions .cap"), null, { timeout: 5000 }).catch(() => {});
  const before = await F(page, () => { const c = document.querySelector("#captions .cap"); return c ? c.dataset.id : null; });
  await F(page, () => window.__fb.act("pause"));
  await wait(5000);
  await F(page, () => window.__fb.act("resume"));
  const after = await F(page, () => { const c = document.querySelector("#captions .cap"); return c ? c.dataset.id : null; });
  const t1 = Date.now();
  await page.waitForFunction((id) => { const c = document.querySelector("#captions .cap"); return !c || c.dataset.id !== id; }, after, { timeout: 8000 }).catch(() => {});
  const left = Date.now() - t1;
  check("a caption under the pause screen is still there after a 5 s pause, and then goes in the time it had left",
    !!before && after === before && left <= 4000, `before ${before}, after ${after}, gone ${left} ms after resume`);
  check("no page errors (pause)", errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 5. F18: stage 3 in real time: no fact flashes, every fact that shows stays its reading time
{
  const { ctx, page, errors } = await open("portrait", "?seed=1&mute=1&q=low");
  await F(page, () => {
    window.__capLog = [];
    const root = document.getElementById("captions");
    let last = null;
    new MutationObserver(() => {
      const el = root.querySelector(".cap");
      const key = el ? `${el.dataset.id}#${el.dataset.page}#${el.textContent}` : null;
      const now = performance.now();
      if (key === (last && last.key)) return;
      if (last) last.ms = now - last.at;
      last = el ? { key, id: el.dataset.id, fact: el.dataset.fact || null, text: el.textContent, at: now, ms: null } : null;
      if (last) window.__capLog.push(last);
    }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    window.__fb.act("practice", "split");
    window.__fb.bot(1);
    window.__endAt = null;
    const look = () => { if (window.__fb.state().screen !== "stage") window.__endAt = performance.now(); else requestAnimationFrame(look); };
    requestAnimationFrame(look);
  });
  await page.waitForFunction(() => window.__endAt !== null, null, { timeout: 120000, polling: 500 }).catch(() => {});
  const { log, endAt } = await F(page, () => ({ log: window.__capLog.filter((x) => x.ms !== null && x.at < window.__endAt), endAt: window.__endAt }));
  const flashes = log.filter((x) => x.fact && x.ms > 20 && x.ms < 1400 && x.at + x.ms < endAt - 50).map((x) => `${x.id} ${Math.round(x.ms)} ms`);
  const total = new Map(), first = new Map();
  for (const x of log) if (x.fact) { total.set(x.id, (total.get(x.id) || 0) + x.ms); if (!first.has(x.id)) first.set(x.id, x); }
  const short = [];
  for (const [id, ms] of total) {
    const f = first.get(id), read = Math.max(4000, 1500 + 55 * f.text.length);
    // a fact the stage's end cut short (it had less than its reading time and a 4 s line left) is not counted
    if (f.at + read + 4000 > endAt) continue;
    if (ms < 0.9 * read - 250) short.push(`${id} ${Math.round(ms)} ms`);
  }
  check(`split in real time: no fact caption flashes for under 1.4 s (${total.size} facts)`, total.size > 0 && flashes.length === 0, flashes.join("; "));
  check("split in real time: every fact that shows stays for its reading time", short.length === 0, short.join("; "));
  check("no page errors (real time)", errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

await browser.close();
if (server) server.kill();
const wallS = ((Date.now() - t0) / 1000).toFixed(1);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${FILE}: ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed (${wallS} s)`);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks (${wallS} s)`);
