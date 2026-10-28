// First Breath: the frame budgets of the paper renderer (design.md 14.3, 17), in headless Chromium with --disable-gpu
// (software raster, a stand-in for a phone short of GPU time; never the SwiftShader flags). With the site served (it
// starts the server itself when nothing answers):
// - frame cost: ?probe=1 (each frame ends with a 1 px readback that waits for the raster), the pinned step (?res=0.5
//   at 390 × 844 and 844 × 390, ?res=0.35 at 1440 × 900), every stage and the ending by ?stage= with the ref bot
//   driving, after 3 s, over the next 120 frames, with no lum() calls: the full tier (?q=full) p95Ms ≤ 16 ms and the
//   low tier (?q=low) p95Ms ≤ 10 ms. A measure over budget is taken once more after a pause, and the better of the two
//   counts, because the browser checks may share the machine with other runs (both numbers are printed);
// - draw budget: perf.splats ≤ 32, perf.points ≤ 750 (600 from the stage, 150 motes), perf.draws ≤ DRAWS_CAP (the cap
//   measured here, task 3.7: the most a frame drew in these runs was about 310, in stage 2 with its 220 corona dots);
// - adaptive scale and the tier switch: no ?res, no ?q, stage 2, after 6 s: the settled step ≥ 0.5 in portrait and
//   landscape, ≥ 0.35 on desktop; once perf.fallback is true it stays true for the run.
// - course chunk bakes (K1): at 1440 × 900 from a Play click, 30 s of stage 1 with the ref bot: after the stage's first
//   frame no frame bakes a whole chunk, the rescale comes in, no frame takes 200 ms or more, and no heartbeat drops
//   (CHUNKS=0 skips it).
// - stage 5 at its busiest with the score playing (first-breath-score, "The score costs little"): at 390 × 844 with
//   ?probe=1, the full tier, the sound and the score started by a Play tap, stage 5 opened as Stages opens it and its
//   big germ brought in by the hook (the boss moment), the ref bot driving: once the score plays level 2 with the boss
//   layer, after 3 s, over the next 120 frames: p95Ms ≤ 16 ms (taken again after a pause when over, as above); the
//   score still at level 2 with the boss; at most 48 voices sounding at every sample (__fb.music.voices, every 40 ms);
//   no held note cut by the voice cap (the cap lets a voice go with setTargetAtTime(0, t, 0.008) right after
//   cancelAndHoldAtTime(t); that voice was held when t comes before its envelope's hold end, on an instrument that
//   holds, attack 5 ms or longer); the 25 ms sound timer's callback (main.js scheduleSound: the mood, the score's
//   tick and her beats) averaging 0.5 ms or less, an upper bound on the score's tick (SCORE=0 skips it).
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/perf.e2e.mjs        (ONLY=portrait,desktop TIERS=full)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/perf.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
export const DRAWS_CAP = 400;
const BUDGET = { full: 16, low: 10 };
const LAYOUTS = {
  portrait: { ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, res: 0.5, floor: 0.5 },
  landscape: { ctx: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, res: 0.5, floor: 0.5 },
  desktop: { ctx: { viewport: { width: 1440, height: 900 } }, res: 0.35, floor: 0.35 },
};
const STAGES = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth", "ending"];
const only = process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(LAYOUTS);
const tiers = process.env.TIERS ? process.env.TIERS.split(",") : ["full", "low"];
const stages = process.env.STAGES ? process.env.STAGES.split(",") : STAGES;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const failed = [], rows = [];
function check(name, ok, detail = "") { if (ok) passed++; else failed.push(`${name}${detail ? ` (${detail})` : ""}`); return ok; }

async function answers() { try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; } }
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")], { stdio: "ignore" });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) { console.log(`FAIL ${FILE}: nothing answers at ${BASE}`); if (server) server.kill(); process.exit(1); }

const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ["--disable-gpu"] });

async function measure(page, query) {
  await page.goto(BASE + "?mute=1&seed=1&probe=1&" + query);
  await page.waitForFunction(() => window.__fb && __fb.state().screen !== "title" && __fb.state().frames > 2, null, { timeout: 60000 });
  await page.evaluate(() => __fb.bot(1));
  await wait(3000);
  const f0 = await page.evaluate(() => __fb.state().frames);
  const peak = { splats: 0, points: 0, draws: 0 };
  // sample the per-frame counters while the 120 frames run
  for (;;) {
    const s = await page.evaluate(() => ({ f: __fb.state().frames, p: __fb.perf }));
    peak.splats = Math.max(peak.splats, s.p.splats); peak.points = Math.max(peak.points, s.p.points); peak.draws = Math.max(peak.draws, s.p.draws);
    if (s.f >= f0 + 120) break;
    await wait(40);
  }
  const p = await page.evaluate(() => __fb.perf);
  return { p95: p.p95Ms, ema: p.emaMs, tier: p.tier, w: p.w, h: p.h, scale: p.scale, ...peak, moment: await page.evaluate(() => __fb.state().moment) };
}

for (const lay of only) {
  const L = LAYOUTS[lay];
  const ctx = await browser.newContext({ ...L.ctx });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push((e.stack || e.message).split("\n")[0]));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  for (const tier of tiers) {
    for (const s of stages) {
      const q = `res=${L.res}&q=${tier}&stage=${s}`;
      let m = await measure(page, q), again = null;
      if (m.p95 > BUDGET[tier]) { await wait(1500); again = await measure(page, q); }
      const best = again && again.p95 < m.p95 ? again : m;
      rows.push(`${lay.padEnd(9)} ${tier.padEnd(4)} ${s.padEnd(7)} p95 ${m.p95.toFixed(1).padStart(5)}${again ? ` / ${again.p95.toFixed(1)}` : ""} ms  ema ${best.ema.toFixed(1)}  draws ≤ ${best.draws}  splats ≤ ${best.splats}  points ≤ ${best.points}  ${best.w}×${best.h}  (${best.moment})`);
      check(`${lay} ${tier} ${s}: the ${tier} tier draws`, best.tier === tier, best.tier);
      check(`${lay} ${tier} ${s}: p95Ms ≤ ${BUDGET[tier]}`, best.p95 <= BUDGET[tier], `${m.p95.toFixed(1)}${again ? ` then ${again.p95.toFixed(1)}` : ""} ms`);
      check(`${lay} ${tier} ${s}: splats ≤ 32, points ≤ 750, draws ≤ ${DRAWS_CAP}`, best.splats <= 32 && best.points <= 750 && best.draws <= DRAWS_CAP,
        `splats ${best.splats}, points ${best.points}, draws ${best.draws}`);
    }
  }
  // adaptive scale and the tier switch (no ?res, no ?q)
  await page.goto(BASE + "?mute=1&seed=1&stage=egg");
  await page.waitForFunction(() => window.__fb && __fb.state().frames > 2, null, { timeout: 60000 });
  await page.evaluate(() => __fb.bot(1));
  let fell = false, back = false, last = null;
  for (let i = 0; i < 12; i++) {
    await wait(500);
    last = await page.evaluate(() => __fb.perf);
    if (last.fallback) fell = true; else if (fell) back = true;
  }
  rows.push(`${lay.padEnd(9)} adaptive  step ${last.scale}  tier ${last.tier}  p95 ${last.p95Ms.toFixed(1)} ms  ${last.w}×${last.h}`);
  check(`${lay}: the settled step ≥ ${L.floor} after 6 s`, last.scale >= L.floor - 1e-9, `step ${last.scale}`);
  check(`${lay}: once the low tier is on it stays on`, !back);
  check(`${lay}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// Course chunk bakes (K1): at 1440 × 900, from a Play click in real time, the ref bot swims stage 1 for 30 s, through
// the span's settle (its rescale). After the stage's first frame no frame bakes a whole course chunk (render/
// renderer.js drawCourse bakes them ahead of need, in slices), the rescale comes in, no frame takes 200 ms or more
// (a chunk baked whole took 60 to 150 ms, and the rescale of every chunk on screen 330 to 400 ms), and her beats keep
// an even spacing: none is dropped by a stalled frame. CHUNKS=0 skips it.
if (only.includes("desktop") && process.env.CHUNKS !== "0") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push((e.stack || e.message).split("\n")[0]));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto(BASE + "?mute=1&seed=1");
  await page.waitForFunction(() => window.__fb && __fb.state().frames > 2, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__k1 = { frames: [], beats: new Set() };
    let last = null;
    const tick = (ts) => {
      const s = __fb.state(), b = window.__fbPaper && __fbPaper.bakes;
      window.__k1.frames.push({ gap: last === null ? 0 : ts - last, screen: s.screen, stage: s.stageId, t: s.t, whole: b ? b.frame.whole : null, rescaled: b ? b.rescaled : null, bakes: !!b });
      last = ts;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setInterval(() => { for (const t of __fb.sound.beats.mother) window.__k1.beats.add(Math.round(t * 1e6) / 1e6); }, 40);
  });
  await page.click("#play");
  await page.evaluate(() => __fb.bot(1));
  await wait(30000);
  const k1 = await page.evaluate(() => ({ frames: window.__k1.frames, beats: [...window.__k1.beats].sort((a, b) => a - b), ss: __fb.state().stageStart }));
  const swim = k1.frames.filter((f) => f.screen === "stage" && f.stage === "swim");
  const after = swim.slice(2);                         // the stage's first frame bakes what is on screen
  // stage 1 now cuts its bending course live (render/race.js) and bakes no course chunks: the chunk checks hold for
  // whatever it bakes, the frame and beat checks stay
  const baking = swim.some((f) => f.bakes && f.rescaled !== null);
  const whole = after.filter((f) => f.bakes && f.whole > 0);
  const longest = Math.max(0, ...after.map((f) => f.gap));
  const rescaled = swim.length ? swim[swim.length - 1].rescaled : null;
  const beats = k1.beats.filter((t) => t >= k1.ss);
  const iv = beats.slice(1).map((b, i) => b - beats[i]);
  const odd = iv.map((d, i) => [i, d]).filter(([, d]) => d < 0.9 * 60 / 72 || d > 1.1 * 60 / 72);
  rows.push(`desktop   chunks    ${swim.length} stage 1 frames, longest ${longest.toFixed(0)} ms, ${whole.length} with a whole chunk, ${rescaled} rescaled, ${beats.length} beats`);
  check("desktop stage 1: after its first frame no frame bakes a whole course chunk", swim.length > 600 && whole.length === 0,
    `${whole.length} of ${after.length}: ${whole.slice(0, 4).map((f) => (f.t || 0).toFixed(2) + " s").join(", ")}`);
  if (baking) check("desktop stage 1: the rescale after the span settles comes in", rescaled > 0, String(rescaled));
  check("desktop stage 1: no frame takes 200 ms or more", longest < 200, `${longest.toFixed(0)} ms`);
  check("desktop stage 1: her beats keep an even spacing (none dropped)", beats.length >= 30 && odd.length === 0,
    `${beats.length} beats; ${odd.slice(0, 4).map(([i, d]) => `#${i}: ${(d * 1000).toFixed(0)} ms`).join(", ")}`);
  check("desktop stage 1: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// Stage 5 at its busiest with the score playing (see the header).
const SCORE_HOOKS = () => {
  // the voice cap's releases, and whether each one cut a held note
  const env = new WeakMap();
  const P = AudioParam.prototype;
  const rawSV = P.setValueAtTime, rawLR = P.linearRampToValueAtTime, rawST = P.setTargetAtTime, rawCH = P.cancelAndHoldAtTime;
  window.__cap = { steals: 0, held: 0 };
  P.setValueAtTime = function (v, t) {
    const e = env.get(this) || {};
    if (v === 0) { e.t0 = t; e.attack = null; e.hold = null; e.peakAt = null; } else e.peakAt = t;
    env.set(this, e);
    return rawSV.call(this, v, t);
  };
  P.linearRampToValueAtTime = function (v, t) { const e = env.get(this); if (e && e.t0 !== undefined && e.attack === null && v > 0) e.attack = t - e.t0; return rawLR.call(this, v, t); };
  P.cancelAndHoldAtTime = function (t) { const e = env.get(this) || {}; e.cancelAt = t; env.set(this, e); return rawCH.call(this, t); };
  P.setTargetAtTime = function (v, t, tc) {
    const e = env.get(this);
    if (e && v === 0) {
      if (e.peakAt !== null && e.peakAt !== undefined && Math.abs(e.peakAt - t) < 1e-9 && e.hold === null) e.hold = t;
      else if (tc === 0.008 && e.cancelAt !== undefined && Math.abs(e.cancelAt - t) < 1e-9) {
        window.__cap.steals++;
        if (e.attack !== null && e.attack >= 0.005 && e.hold !== null && t < e.hold - 1e-3) window.__cap.held++;
      }
    }
    return rawST.call(this, v, t, tc);
  };
  // the sound timer's callback (main.js sets it up with 25 ms)
  window.__ticks = [];
  const rawSI = window.setInterval;
  window.setInterval = function (fn, ms, ...rest) {
    if (ms === 25 && typeof fn === "function") {
      return rawSI.call(window, () => { const t0 = performance.now(); try { fn(); } finally { window.__ticks.push(performance.now() - t0); } }, ms, ...rest);
    }
    return rawSI.call(window, fn, ms, ...rest);
  };
};
if (only.includes("portrait") && process.env.SCORE !== "0") {
  const L = LAYOUTS.portrait;
  const ctx = await browser.newContext({ ...L.ctx });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  await ctx.addInitScript(SCORE_HOOKS);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push((e.stack || e.message).split("\n")[0]));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  const busiest = async () => {
    await page.goto(BASE + `?seed=1&probe=1&res=${L.res}&q=full`);
    await page.waitForFunction(() => window.__fb && __fb.state().frames > 2, null, { timeout: 60000 });
    await page.tap("#play");
    await page.waitForFunction(() => __fb.music && __fb.music.loaded, null, { timeout: 30000 });
    await page.evaluate(() => { __fb.bot(1); __fb.act("practice", "grow"); __fb.jump("boss"); });
    const on = await page.waitForFunction(() => { const m = __fb.music; return m.cue === "grow" && m.level === 2 && m.boss; }, null, { timeout: 10000 }).then(() => true, () => false);
    await wait(3000);
    await page.evaluate(() => { window.__ticks.length = 0; window.__cap.steals = 0; window.__cap.held = 0; });
    const f0 = await page.evaluate(() => __fb.state().frames);
    let vmax = 0, samples = 0;
    for (;;) {
      const s = await page.evaluate(() => ({ f: __fb.state().frames, v: __fb.music.voices }));
      vmax = Math.max(vmax, s.v); samples++;
      if (s.f >= f0 + 120) break;
      await wait(40);
    }
    const out = await page.evaluate(() => {
      const t = window.__ticks, m = __fb.music;
      return { p: __fb.perf, tick: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null, ticks: t.length, cap: { ...window.__cap },
        level: m.level, boss: m.boss, cue: m.cue, loaded: m.loaded, fallback: m.fallback.length, ctx: __fb.sound.state, muted: __fb.sound.muted };
    });
    return { on, vmax, samples, ...out };
  };
  let m = await busiest(), again = null;
  if (m.p.p95Ms > BUDGET.full) { await wait(1500); again = await busiest(); }
  const best = again && again.p.p95Ms < m.p.p95Ms ? again : m;
  rows.push(`portrait  score     grow boss p95 ${m.p.p95Ms.toFixed(1)}${again ? ` / ${again.p.p95Ms.toFixed(1)}` : ""} ms  voices ≤ ${best.vmax}  steals ${best.cap.steals}, held ${best.cap.held}  timer ${best.tick === null ? "?" : best.tick.toFixed(3)} ms over ${best.ticks}`);
  check("portrait stage 5 with the score: the score plays level 2 with the boss layer (samples loaded, sound on)",
    best.on && best.cue === "grow" && best.level === 2 && best.boss && best.loaded && best.fallback === 0 && best.ctx === "running" && !best.muted,
    JSON.stringify({ on: best.on, cue: best.cue, level: best.level, boss: best.boss, fallback: best.fallback, ctx: best.ctx, muted: best.muted }));
  check(`portrait stage 5 with the score: p95Ms ≤ ${BUDGET.full}`, best.p.p95Ms <= BUDGET.full && best.p.tier === "full", `${m.p.p95Ms.toFixed(1)}${again ? ` then ${again.p.p95Ms.toFixed(1)}` : ""} ms, tier ${best.p.tier}`);
  check("portrait stage 5 with the score: at most 48 voices sounding at every sample", best.samples >= 10 && best.vmax <= 48, `${best.vmax} at most over ${best.samples} samples`);
  check("portrait stage 5 with the score: no held note cut by the voice cap", best.cap.held === 0, `${best.cap.steals} voices let go by the cap, ${best.cap.held} of them held`);
  check("portrait stage 5 with the score: the sound timer (the score's tick with the mood and her beats) averages 0.5 ms or less",
    best.tick !== null && best.ticks >= 40 && best.tick <= 0.5, `${best.tick === null ? "no" : best.tick.toFixed(3) + " ms over " + best.ticks} ticks`);
  check("portrait stage 5 with the score: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
if (server) server.kill();
for (const r of rows) console.log(r);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
