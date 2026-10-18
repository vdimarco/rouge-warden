// First Breath: the smoke check (design.md 17 "First 10 seconds" and "The low tier", 18; tasks.md 5.3). With the
// site served (it starts `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless
// Chromium with --disable-gpu (design.md 14.3; no SwiftShader flags), at 390 × 844 and 844 × 390 with touch and at
// 1440 × 900, it checks:
// - the first 10 seconds, in real time: Play shows the stage 1 prompt line (a drag) by 0.5 s with steering live; and
//   goto(2) has its first target by 2.7 s and the guard's prompt (keys "turn") by 9.0 s;
// - every stage by goto (and the ending) steps 120 frames, draws, shows its stage name, clock and prompt as words,
//   and its finish leads on;
// - the ending's thumb prompt names keys on the desktop ("Rest here. Hold Space if you like.") and the thumb on
//   touch ("Rest your thumb here."); so do stage 1's prompt and Birth's wave prompts (keys on the desktop, the drag on
//   touch), and a Birth wave's prompt line is never also shown as a caption;
// - the shared bot plays a whole run from Play to the run result (under ?test=1, stepped through window.__fb); then
//   a fact caption arrives with its clock label in front ("Week 10: From about now you are called a fetus. …");
// - the low tier in every stage, with ?q=low and with its alias ?gl=0 (and ?probe=1): the tier is low, the mean
//   frame luminance (lum()) is above 0.04, and in stages 1 to 8 the frame's luminance at targets().anchor is above
//   its median (the ending is left out, as in visual.e2e.mjs: it is dark shapes on light paper, 13.2);
// - in every page: no raw string id ("grow.fetus", "ui.next"), and no unfilled {var}, ever shows in a caption, the
//   HUD or a screen (a MutationObserver keeps every text those three roots ever show), and no page error, console
//   error or failed request.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/smoke.e2e.mjs        (ONLY=portrait,desktop picks layouts)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/smoke.e2e.mjs";
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
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const sizeList = () => (process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(SIZES));
const STAGE_IDS = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];
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

// ---- Chromium with --disable-gpu (Canvas 2D; WebGL is not used)
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

// Every text the HUD, the captions and the screens ever show, kept by a MutationObserver from the first frame.
function watchTexts() {
  const seen = new Set();
  window.__fbTexts = seen;
  const keep = (s) => { const t = String(s || "").replace(/\s+/g, " ").trim(); if (t) seen.add(t); };
  // each text node on its own (an element's textContent runs its children together: "an egg." + "Week 2")
  const take = (n) => {
    if (!n) return;
    if (n.nodeType === 3) { keep(n.data); return; }
    if (n.nodeType !== 1) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let e = n; e; e = w.nextNode()) {
      if (e.nodeType === 3) keep(e.data);
      else for (const a of ["aria-label", "title", "alt"]) if (e.getAttribute(a)) keep(e.getAttribute(a));
    }
  };
  const start = () => {
    for (const id of ["hud", "captions", "screens"]) {
      const root = document.getElementById(id);
      if (!root) continue;
      take(root);
      new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "characterData") keep(m.target.data);
          for (const n of m.addedNodes || []) take(n);
        }
      }).observe(root, { subtree: true, childList: true, characterData: true });
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}

async function open(size, query) {
  const ctx = await browser.newContext({ ...SIZES[size] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400 && r.request().method() !== "HEAD") errors.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => {
    if (r.method() !== "HEAD" && !/analytics|posthog/.test(r.url())) errors.push(`failed ${r.url()} ${r.failure()?.errorText || ""}`);
  });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  await page.addInitScript(watchTexts);
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 0, null, { timeout: 60000 });
  return { ctx, page, errors };
}

const S = (page) => page.evaluate(() => window.__fb.state());
const F = (page, fn, arg) => page.evaluate(fn, arg);
async function press(page, size, selector) {
  if (SIZES[size].hasTouch) await page.tap(selector, { timeout: 5000 });
  else await page.click(selector, { timeout: 5000 });
}

// A raw string id ("grow.fetus", "ui.next", "end.apgar") or an unfilled {var} in shown text.
const RAW_ID = /\b(?:swim|egg|split|root|grow|answer|turn|birth|ending|end|title|settings|tap|ui|card|almost|pause|hud|cue|grade|part|mark|result|stages|sources)\.[A-Za-z]/;
const RAW_VAR = /\{[A-Za-z]+\}/;
async function rawTexts(page) {
  const all = await F(page, () => [...(window.__fbTexts || [])]);
  return { count: all.length, bad: all.filter((t) => RAW_ID.test(t) || RAW_VAR.test(t)), all };
}

// The frame's luminance: mean, median and the value at a CSS point (2 × 2 cells of a 64-wide copy of the canvas).
function frameLum(pt) {
  const c = document.getElementById("view");
  const W = 64, H = Math.max(1, Math.round((64 * c.height) / c.width));
  const k = document.createElement("canvas");
  k.width = W; k.height = H;
  const g = k.getContext("2d");
  g.drawImage(c, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.2126 * lin(d[4 * i]) + 0.7152 * lin(d[4 * i + 1]) + 0.0722 * lin(d[4 * i + 2]);
  const sorted = Float64Array.from(L).sort();
  const r = c.getBoundingClientRect();
  let at = null;
  if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
    const cx = Math.floor(((pt.x - r.left) / r.width) * W), cy = Math.floor(((pt.y - r.top) / r.height) * H);
    let sum = 0, n = 0;
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) { sum += L[y * W + x]; n++; }
    }
    at = n ? sum / n : null;
  }
  return { mean: L.reduce((a, b) => a + b, 0) / L.length, median: sorted[Math.floor(sorted.length / 2)], at };
}

for (const size of sizeList()) {
  const tag = size;
  const touch = !!SIZES[size].hasTouch;

  // ---- 1. the first 10 seconds, in real time
  {
    const { ctx, page, errors } = await open(size, "?seed=1");
    // the stage time at which the prompt tag first shows its line, and the live gesture then (recorded in the page,
    // so the check does not depend on how fast this script polls)
    await F(page, () => {
      window.__fbFirst = null;
      const tagEl = document.querySelector('[data-hud="prompt"]');
      const look = () => {
        if (window.__fbFirst) return;
        const s = window.__fb.state();
        if (s.screen === "stage" && s.prompt && s.prompt.line && tagEl && !tagEl.hidden && tagEl.textContent.trim() === s.prompt.line) {
          window.__fbFirst = { t: s.t, prompt: s.prompt, live: s.live, line: tagEl.textContent.trim() };
        }
      };
      if (tagEl) new MutationObserver(look).observe(tagEl, { subtree: true, childList: true, characterData: true, attributes: true });
      const poll = () => { look(); if (!window.__fbFirst) requestAnimationFrame(poll); };
      requestAnimationFrame(poll);
    });
    await press(page, size, "#play");
    await page.waitForFunction(() => !!window.__fbFirst, null, { timeout: 5000, polling: 16 }).catch(() => null);
    const first0 = await F(page, () => window.__fbFirst);
    const s = await S(page);
    check(`${tag}: Play shows the stage 1 prompt line by 0.5 s`, !!first0 && s.stageId === "swim" && first0.t !== null && first0.t <= 0.5
      && first0.prompt.gesture === "drag", JSON.stringify(first0));
    check(`${tag}: steering is live by 0.5 s`, !!first0 && first0.live && first0.live.gesture === "drag" && first0.t <= 0.5,
      JSON.stringify(first0 && first0.live));
    check(`${tag}: the rAF clock runs (real time)`, s.realtime === true);
    // goto(2) in real time: the first target by 2.7 s, the guard's prompt by 9.0 s
    await F(page, () => window.__fb.goto(2, { seed: 1 }));
    const first = await F(page, () => ({ s: window.__fb.state(), next: window.__fb.nextTarget() }));
    check(`${tag}: goto(2) has its first target by 2.7 s`, first.s.stageId === "egg" && first.next && first.next.t <= 2.7,
      JSON.stringify(first.next));
    await page.waitForFunction(() => { const s = window.__fb.state(); return (s.prompt && s.prompt.keys === "turn") || s.t > 9.5; },
      null, { timeout: 15000, polling: 50 }).catch(() => null);
    const g = await S(page);
    check(`${tag}: the guard's prompt shows by 9.0 s`, g.prompt && g.prompt.keys === "turn" && g.t <= 9.0 + 0.1 && !!g.prompt.line,
      `t=${g.t} ${JSON.stringify(g.prompt)}`);
    // a hidden page pauses (visibilitychange), and so does pagehide; Resume plays on
    const hid = await F(page, () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      const a = window.__fb.state();
      const pausePanel = document.querySelector('[data-screen="pause"]');
      const shown = !!pausePanel && !pausePanel.hidden;
      delete document.visibilityState;
      window.__fb.act("resume");
      const b = window.__fb.state();
      window.dispatchEvent(new Event("pagehide"));
      const c = window.__fb.state();
      window.__fb.act("resume");
      return { a: a.paused, shown, b: b.paused, c: c.paused };
    });
    check(`${tag}: a hidden page pauses with the pause screen, and pagehide pauses`, hid.a === true && hid.shown && hid.b === false && hid.c === true,
      JSON.stringify(hid));
    // M mutes through the arcade's shared arcade.sound, and again turns it back on
    const before = await F(page, () => ({ muted: window.__fb.sound.muted, key: localStorage.getItem("arcade.sound") }));
    await page.keyboard.press("m");
    const after = await F(page, () => ({ muted: window.__fb.sound.muted, key: localStorage.getItem("arcade.sound") }));
    await page.keyboard.press("m");
    const back = await F(page, () => ({ muted: window.__fb.sound.muted, key: localStorage.getItem("arcade.sound") }));
    check(`${tag}: M toggles the sound and writes arcade.sound`, before.muted === false && after.muted === true && back.muted === false
      && after.key !== null && after.key !== back.key, `${JSON.stringify(before)} ${JSON.stringify(after)} ${JSON.stringify(back)}`);
    const raw = await rawTexts(page);
    check(`${tag}: no raw id in the real-time page's text`, raw.bad.length === 0, raw.bad.slice(0, 4).join(" | "));
    check(`${tag}: no page or console errors (real time)`, errors.length === 0, errors.slice(0, 4).join(" || "));
    await ctx.close();
  }

  // ---- 2. every stage by goto, the ending's prompt, the bot through a whole run (test mode)
  {
    const { ctx, page, errors } = await open(size, "?test=1&seed=3");
    for (const target of [1, 2, 3, 4, 5, 6, 7, 8, "ending"]) {
      const id = target === "ending" ? "ending" : STAGE_IDS[target - 1];
      const ok = await F(page, (t) => window.__fb.goto(t), target);
      const s = await F(page, () => window.__fb.step(120));
      const look = await F(page, () => {
        const txt = (k) => { const e = document.querySelector(`[data-hud="${k}"]`); return e && !e.hidden ? e.textContent.trim() : ""; };
        const hud = document.getElementById("hud");
        return { perf: window.__fb.perf, name: txt("stage"), clock: txt("clock"), prompt: txt("prompt"), hud: !!hud && !hud.hidden };
      });
      check(`${tag}: goto(${JSON.stringify(target)}) reaches ${id} and steps 120 frames`, ok === true && s.stageId === id && Math.abs(s.t - 2) < 0.02,
        `${ok} ${s.stageId} t=${s.t}`);
      check(`${tag}: ${id} draws`, look.perf.draws > 0 && look.perf.w > 0 && look.perf.h > 0, JSON.stringify(look.perf));
      check(`${tag}: ${id} shows its HUD as words`, look.hud && look.name.length > 0 && (id === "ending" ? look.clock === "" : look.clock.length > 0)
        && (!s.prompt || !s.prompt.line || s.prompt.gesture === "none" ? true : look.prompt === s.prompt.line),
        `${look.name} | ${look.clock} | ${look.prompt} | ${JSON.stringify(s.prompt)}`);
      if (id === "swim") {
        const want = touch ? "Drag to swim." : "Swim with the arrow keys, or drag with the mouse.";
        check(`${tag}: stage 1's prompt names ${touch ? "the drag" : "the keys"}`, look.prompt === want, look.prompt);
      }
      if (id === "birth") {
        // the first wave (from 2.0 s) and the Turn wave (from 26 s): the prompt in this device's words, said once
        const waves = [[0, "Hold through the wave.", "Hold Space through the wave."],
          [25.1, "Turn: drag sideways and hold.", "Turn: hold the left or right arrow."]];
        for (const [more, onTouch, onKeys] of waves) {
          const want = touch ? onTouch : onKeys;
          if (more) await F(page, (n) => window.__fb.step(n), Math.round(more * 60));
          const w = await F(page, () => {
            const e = document.querySelector('[data-hud="prompt"]');
            const caps = [...document.querySelectorAll("#captions .cap")].filter((c) => !c.hidden).map((c) => c.textContent.trim());
            return { prompt: e && !e.hidden ? e.textContent.trim() : "", caps, t: window.__fb.state().t };
          });
          check(`${tag}: birth at ${w.t.toFixed(1)} s: the prompt reads "${want}"`, w.prompt === want, w.prompt);
          check(`${tag}: birth at ${w.t.toFixed(1)} s: the prompt's line is not also a caption`, !w.caps.some((c) => c === onTouch || c === onKeys),
            JSON.stringify(w.caps));
        }
      }
      if (id === "ending") {
        await F(page, () => window.__fb.jump("thumb"));
        const e = await F(page, () => window.__fb.step(30));
        const want = touch ? "Rest your thumb here." : "Rest here. Hold Space if you like.";
        check(`${tag}: the ending's thumb prompt names ${touch ? "the thumb" : "keys"}`, e.prompt && e.prompt.line === want,
          `${e.device} ${JSON.stringify(e.prompt)}`);
      }
      await F(page, () => window.__fb.finish());
      let r = await S(page);
      for (let k = 0; k < 4 && r.screen !== "result"; k++) {
        if (r.screen === "almost") await F(page, () => window.__fb.act("goOn"));
        else if (r.screen === "overlay") await F(page, () => window.__fb.act("next"));
        else await F(page, () => window.__fb.step(10));
        r = await S(page);
      }
      check(`${tag}: ${id}: finish() leads to the result`, r.screen === "result", r.screen);
    }

    // the bot from Play to the run result
    await F(page, () => { window.__fb.act("play"); window.__fb.bot(0.7); });
    let s = await S(page);
    const startOk = s.screen === "stage" && s.stageId === "swim";
    const wall0 = Date.now();
    const seenStages = new Set();
    for (let k = 0; k < 80 && s.screen !== "result"; k++) {
      s = await F(page, () => window.__fb.step(600));
      if (s.stageId) seenStages.add(s.stageId);
    }
    const sum = await F(page, () => window.__fb.result());
    check(`${tag}: the bot plays a whole run from Play to the run result`, startOk && s.screen === "result" && sum && sum.done === true
      && sum.stages.length === 8 && sum.total > 0, `${s.screen} ${s.stageId} ${sum && sum.stages && sum.stages.length} (${((Date.now() - wall0) / 1000).toFixed(1)} s)`);
    check(`${tag}: the run went through every stage and the ending`, STAGE_IDS.every((id) => seenStages.has(id)) && seenStages.has("ending"),
      [...seenStages].join(" "));
    const shown = await F(page, () => {
      const res = document.querySelector('[data-screen="result"]');
      return { result: res && !res.hidden ? res.textContent.replace(/\s+/g, " ").trim() : "" };
    });
    check(`${tag}: the run result is on screen`, shown.result.length > 0, shown.result.slice(0, 80));
    // a fact caption, with its clock label in front: grow.fetus at week 10 (the captions queue a fact behind a line on
    // the wall clock, so this waits in real time with the run held still)
    await F(page, () => { window.__fb.goto("grow"); window.__fb.jump("beat10"); window.__fb.step(30); });
    const fetus = await page.waitForFunction(() => {
      const e = document.querySelector('#captions [data-fact="grow.fetus"], #captions [data-id="grow.fetus"]');
      return e && e.textContent.trim() ? e.textContent.trim() : false;
    }, null, { timeout: 10000, polling: 50 }).then((h) => h.jsonValue()).catch(() => null);
    check(`${tag}: a fact caption shows with its clock label in front`, typeof fetus === "string" && fetus.startsWith("Week 10: From about now"),
      String(fetus));
    const raw = await rawTexts(page);
    check(`${tag}: no raw string id or unfilled {var} in any caption, HUD or screen text (${raw.count} texts)`, raw.bad.length === 0,
      raw.bad.slice(0, 6).join(" | "));
    check(`${tag}: no page or console errors (test mode)`, errors.length === 0, errors.slice(0, 4).join(" || "));
    await ctx.close();
  }

  // ---- 3. the low tier in every stage, with ?q=low and its alias ?gl=0
  for (const q of ["q=low", "gl=0"]) {
    const { ctx, page, errors } = await open(size, `?test=1&probe=1&seed=1&${q}`);
    const dark = [], dim = [];
    let tierOk = true;
    for (const target of [1, 2, 3, 4, 5, 6, 7, 8, "ending"]) {
      await F(page, (t) => window.__fb.goto(t), target);
      const s = await F(page, () => window.__fb.step(180));
      await F(page, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await F(page, () => ({ lum: window.__fb.lum(), perf: window.__fb.perf, tier: window.__fb.state().tier }));
      const f = await F(page, frameLum, s.anchor);
      if (m.tier !== "low" || m.perf.fallback !== true) tierOk = false;
      if (!(m.lum > 0.04)) dark.push(`${s.stageId}: lum ${m.lum}`);
      // stages 1 to 8 only, as visual.e2e.mjs: the ending is dark shapes on light paper by design (13.2)
      if (target !== "ending" && !(f.at > f.median)) dim.push(`${s.stageId}: anchor ${f.at && f.at.toFixed(3)} vs median ${f.median.toFixed(3)}`);
    }
    check(`${tag}: ?${q} pins the low tier (perf.fallback)`, tierOk);
    check(`${tag}: ?${q}: every stage's frame is lit (lum() > 0.04)`, dark.length === 0, dark.join("; "));
    check(`${tag}: ?${q}: in stages 1 to 8 the subject's sheet (at targets().anchor) is brighter than the frame's median`,
      dim.length === 0, dim.join("; "));
    const raw = await rawTexts(page);
    check(`${tag}: ?${q}: no raw id in shown text`, raw.bad.length === 0, raw.bad.slice(0, 4).join(" | "));
    check(`${tag}: ?${q}: no page or console errors`, errors.length === 0, errors.slice(0, 4).join(" || "));
    await ctx.close();
  }
}

await browser.close();
if (server) server.kill();

const wallS = ((Date.now() - t0) / 1000).toFixed(1);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${FILE}: ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed (${wallS} s)`);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks (${sizeList().join(", ")}; ${wallS} s)`);
