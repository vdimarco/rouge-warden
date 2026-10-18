// First Breath: the visual checks of the paper renderer (design.md 13.3, 14.3, 17), in headless Chromium with
// --disable-gpu (Canvas 2D, no SwiftShader flags). With the site served (it starts the server itself when nothing
// answers), at 390 × 844 unless a row says otherwise:
// - the canvas draws no text: an init script spies on fillText and strokeText of CanvasRenderingContext2D in every
//   stage, the ending, the title and the result screen, in both tiers;
// - non-black stages: ?freeze=1 per stage and the ending, mean luminance (canvas, ?probe=1 lum()) > 0.04;
// - the brightest cue: per stage, the first frame with a cue (?test=1, the ref bot, stepped), a page screenshot (DOM
//   rings and tags included): the luminance at targets().cue (the brightest pixel within 3 px, the cue sticker's size
//   at its smallest) is at or above the frame's 95th percentile (the ending
//   is left out: its cue rings are dark on light paper, 13.2); stage 2 is taken in the guard with the arc as the cue;
// - a paper cell: ?seed=1&freeze=1&stage=3: the brightest ring within 8 px of the cell's edge is its pale cut edge,
//   and the pixels just below and right of the cell (its shadow) are darker than the back sheet;
// - light rises: frozen frames of stages 1 to 7: each mean luminance ≥ 0.9 × the one before, stage 7 ≥ 2 × stage 1;
// - the flash rule: ?test=1&probe=1, 300 frames (5 s) in stages 4, 5, 6 and 8 with the ref bot, each __fb.step(1)
//   then lum(): at most 3 swings of ≥ 10% in any 60-frame window (a swing: luminance moving ≥ 10% away from the last
//   turning point, then turning back);
// - the birth light: stage 8 from the light moment, one frame at a time through 3.5 s: luminance non-decreasing
//   (1% tolerance) and ≥ 0.95 at its end;
// - the birth opening: stage 8, the first frame of the light and a frame 1 s in, both tiers: the brightest region
//   (the top 5% of luminance) touches the bottom edge across ≥ 90% of the width; a flood fill over the top 10% of
//   luminance from the brightest pixel reaches the bottom row; the stage 8 frames are side flats (ROLES.birth.frames
//   shape "sides": each flat touches only the left or the right screen edge);
// - ending warmth: a frozen ending frame (after the white): mean R > G > B;
// - reduced motion: ?rm=1: motion.warpAmp ≤ 0.5 × the full value and bounce 0; the stage change crossfade is the
//   same 0.8 s in both modes;
// - the low tier in every stage (?q=low, and ?gl=0 its alias in stage 1): mean luminance > 0.04, and the subject's
//   sheet (the luminance at targets().anchor, the brightest pixel within 6 px) brighter than the frame's median.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/visual.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/visual.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const STAGES = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const failed = [], notes = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

async function answers() { try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; } }
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")], { stdio: "ignore" });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) { console.log(`FAIL ${FILE}: nothing answers at ${BASE}`); if (server) server.kill(); process.exit(1); }

const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ["--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// the text spy: every canvas context of every page in this context
await ctx.addInitScript(() => {
  window.__texts = 0;
  const P = CanvasRenderingContext2D.prototype;
  for (const k of ["fillText", "strokeText"]) { const f = P[k]; P[k] = function () { window.__texts++; return f.apply(this, arguments); }; }
  try { localStorage.clear(); } catch (e) { /* off */ }
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
const decoder = await ctx.newPage();
await decoder.goto("about:blank");

async function open(query) {
  await page.goto(BASE + "?mute=1&" + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames >= 1, null, { timeout: 60000 });
}
const texts = () => page.evaluate(() => window.__texts);

// Luminance stats of a page screenshot, computed in a blank page from the PNG.
async function shotStats(points = []) {
  const png = (await page.screenshot({ type: "png" })).toString("base64");
  return decoder.evaluate(async ({ png, points }) => {
    const img = new Image(); img.src = "data:image/png;base64," + png; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const N = c.width * c.height, L = new Float32Array(N);
    for (let i = 0; i < N; i++) L[i] = 0.2126 * lin(d[4 * i]) + 0.7152 * lin(d[4 * i + 1]) + 0.0722 * lin(d[4 * i + 2]);
    const sorted = Float32Array.from(L).sort();
    const at = (x, y, rad = 0) => { let m = 0; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const px = Math.round(x) + dx, py = Math.round(y) + dy; if (px >= 0 && py >= 0 && px < c.width && py < c.height) m = Math.max(m, L[py * c.width + px]); } return m; };
    return { p95: sorted[Math.floor(0.95 * (N - 1))], p50: sorted[N >> 1], mean: sorted.reduce((a, b) => a + b, 0) / N, pts: points.map(([x, y, r]) => at(x, y, r || 0)) };
  }, { png, points });
}

// The canvas's own pixels (no DOM), as luminance, plus helpers run in the page.
async function canvasPixels(fn, arg) {
  return page.evaluate(([src, arg]) => {
    const cv = document.getElementById("view");
    const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const g = c.getContext("2d"); g.drawImage(cv, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const W = c.width, H = c.height, L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = 0.2126 * lin(d[4 * i]) + 0.7152 * lin(d[4 * i + 1]) + 0.0722 * lin(d[4 * i + 2]);
    // eslint-disable-next-line no-new-func
    return new Function("L", "W", "H", "d", "arg", src)(L, W, H, d, arg);
  }, [fn, arg]);
}

// ---- 1. non-black frozen frames, and the frame means for "light rises"
const means = {};
for (const s of [...STAGES, "ending"]) {
  await open(`freeze=1&probe=1&seed=1&stage=${s}`);
  await wait(150);
  let m = await page.evaluate(() => __fb.lum());
  if (s === "ending") {
    // the ending opens on the white; take its frame once the room has faded in
    await open(`test=1&probe=1&seed=1&stage=ending`);
    m = await page.evaluate(() => { __fb.step(4 * 60); return __fb.lum(); });
    const rgb = await canvasPixels(`let r = 0, g = 0, b = 0; for (let i = 0; i < W * H; i++) { r += d[4*i]; g += d[4*i+1]; b += d[4*i+2]; } return [r / (W*H), g / (W*H), b / (W*H)];`);
    check("ending warmth: mean R > G > B", rgb[0] > rgb[1] && rgb[1] > rgb[2], rgb.map((v) => v.toFixed(1)).join(", "));
  }
  means[s] = m;
  check(`non-black: ${s} mean luminance > 0.04`, m > 0.04, m.toFixed(4));
}
for (let i = 1; i < 7; i++) {
  const a = means[STAGES[i - 1]], b = means[STAGES[i]];
  check(`light rises: ${STAGES[i]} ≥ 0.9 × ${STAGES[i - 1]}`, b >= 0.9 * a, `${b.toFixed(4)} vs ${a.toFixed(4)}`);
}
check("light rises: stage 7 ≥ 2 × stage 1", means.turn >= 2 * means.swim, `${means.turn.toFixed(4)} vs ${means.swim.toFixed(4)}`);
notes.push("frame means: " + Object.entries(means).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(", "));

// ---- 2. the brightest cue, per stage (DOM included)
for (const s of STAGES) {
  await open(`test=1&seed=1&stage=${s}`);
  const st = await page.evaluate((s) => {
    __fb.bot(1);
    for (let i = 0; i < 90 * 4; i++) {
      __fb.step(15);
      const x = __fb.state();
      if (x.screen !== "stage") return null;
      const want = s === "egg" ? x.moment === "guard" && x.t > 12 : x.t > 4;
      if (want && x.cue) return { cue: x.cue, moment: x.moment, t: x.t, by: window.__fbPaper && __fbPaper.lastCue ? __fbPaper.lastCue.by : null };
    }
    return null;
  }, s);
  if (!check(`brightest cue: ${s} has a cue in play`, !!st)) continue;
  const stats = await shotStats([[st.cue.x, st.cue.y, 3]]);
  check(`brightest cue: ${s} at the cue ≥ the frame's 95th percentile`, stats.pts[0] >= stats.p95,
    `${stats.pts[0].toFixed(3)} vs p95 ${stats.p95.toFixed(3)} (${st.moment}, t ${st.t.toFixed(1)}, ${st.by})`);
}
notes.push("the ending is left out of the brightest-cue row: its cue rings are dark on light paper (13.2)");

// ---- 3. a paper cell (stage 3, the first frame)
{
  await open("seed=1&freeze=1&stage=3");
  await wait(150);
  const cells = await page.evaluate(() => (window.__fbPaper ? __fbPaper.lastBodies.filter((b) => b.token === "cells" && b.k === "c") : []));
  if (check("a paper cell: the first frame has a cell", cells.length > 0)) {
    // the bottom-right-most cell, so its shadow falls on the back
    const c = cells.slice().sort((a, b) => (b.x + b.y) - (a.x + a.y))[0];
    const res = await canvasPixels(`
      const { x, y, r, k } = arg;
      const ring = (rr) => { let s = 0, n = 0; for (let a = 0; a < 6.283; a += 0.05) { const px = Math.round((x + Math.cos(a) * rr) * k), py = Math.round((y + Math.sin(a) * rr) * k); if (px >= 0 && py >= 0 && px < W && py < H) { s += L[py * W + px]; n++; } } return n ? s / n : 0; };
      let best = -1, bestR = 0; for (let rr = r - 8; rr <= r + 8; rr += 0.5) { const v = ring(rr); if (v > best) { best = v; bestR = rr; } }
      // the shadow: an arc below and right of the cell, just outside it
      let sh = 0, n = 0; for (let a = 0.35; a < 1.2; a += 0.05) for (const dr of [1.5, 2.5, 3.5]) { const px = Math.round((x + Math.cos(a) * (r + dr)) * k), py = Math.round((y + Math.sin(a) * (r + dr)) * k); sh += L[py * W + px]; n++; }
      return { bestR, best, shadow: sh / n };
    `, { x: c.x, y: c.y, r: c.r, k: 1 });
    const backL = await page.evaluate(async () => { const m = await import("/first-breath/render/palette.js"); const h = m.STAGES.split.tokens.back; const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); });
    check("a paper cell: the brightest ring within 8 px of its edge is its pale cut edge", res.bestR >= c.r - 4 && res.bestR <= c.r + 0.5, `ring at ${res.bestR.toFixed(1)} px, edge at ${c.r.toFixed(1)} px`);
    check("a paper cell: its shadow (below and right) is darker than the back sheet", res.shadow < backL, `${res.shadow.toFixed(4)} vs back ${backL.toFixed(4)}`);
  }
}

// ---- 4. the flash rule
function swings(series) {
  // turning points: luminance moving ≥ 10% from the last extreme in the other direction
  const marks = [];
  let ext = series[0], dir = 0;
  for (let i = 1; i < series.length; i++) {
    const v = series[i];
    if (dir >= 0 && v > ext) ext = v;
    if (dir <= 0 && v < ext) ext = v;
    if (dir >= 0 && v <= ext * 0.9) { if (dir > 0) marks.push(i); dir = -1; ext = v; }
    else if (dir <= 0 && v >= ext * 1.1) { if (dir < 0) marks.push(i); dir = 1; ext = v; }
  }
  let worst = 0;
  for (let i = 0; i < series.length; i++) worst = Math.max(worst, marks.filter((m) => m >= i && m < i + 60).length);
  return worst;
}
for (const s of ["root", "grow", "answer", "birth"]) {
  await open(`test=1&probe=1&seed=1&stage=${s}`);
  const series = await page.evaluate(() => { __fb.bot(1); const out = []; for (let i = 0; i < 300; i++) { __fb.step(1); out.push(__fb.lum()); } return out; });
  const w = swings(series);
  check(`flash rule: ${s} at most 3 swings of ≥ 10% in any 60 frames`, w <= 3, `${w} swings`);
}

// ---- 5. the birth light and the opening
for (const tier of ["full", "low"]) {
  await open(`test=1&probe=1&seed=1&stage=birth&q=${tier}`);
  const ok = await page.evaluate(() => { __fb.bot(1); return __fb.jump("light"); });
  if (!check(`birth (${tier}): jump to the light`, ok !== false)) continue;
  const opening = `
    const N = W * H, s = Float32Array.from(L).sort(), t5 = s[Math.floor(0.95 * (N - 1))], t10 = s[Math.floor(0.9 * (N - 1))];
    let bottom = 0; for (let x = 0; x < W; x++) if (L[(H - 1) * W + x] >= t5) bottom++;
    let bi = 0; for (let i = 1; i < N; i++) if (L[i] > L[bi]) bi = i;
    const seen = new Uint8Array(N), q = [bi]; seen[bi] = 1; let reach = false;
    while (q.length) { const i = q.pop(); const x = i % W, y = (i / W) | 0; if (y === H - 1) { reach = true; break; }
      for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= N || seen[j]) continue; const jx = j % W; if (Math.abs(jx - x) > 1) continue; if (L[j] >= t10) { seen[j] = 1; q.push(j); } } }
    return { frac: bottom / W, reach };`;
  const first = await canvasPixels(opening);
  check(`birth opening (${tier}, first frame): the top 5% touches ≥ 90% of the bottom edge`, first.frac >= 0.9, (first.frac * 100).toFixed(0) + "%");
  check(`birth opening (${tier}, first frame): the top 10% from the brightest pixel reaches the bottom row`, first.reach);
  const series = await page.evaluate(() => { const out = [__fb.lum()]; for (let i = 0; i < 60; i++) { __fb.step(1); out.push(__fb.lum()); } return out; });
  const later = await canvasPixels(opening);
  check(`birth opening (${tier}, 1 s in): the top 5% touches ≥ 90% of the bottom edge`, later.frac >= 0.9, (later.frac * 100).toFixed(0) + "%");
  check(`birth opening (${tier}, 1 s in): the top 10% from the brightest pixel reaches the bottom row`, later.reach);
  const rest = await page.evaluate(() => { const out = []; for (let i = 0; i < 150; i++) { __fb.step(1); out.push(__fb.lum()); } return out; });
  const all = series.concat(rest);
  let drop = 0; for (let i = 1; i < all.length; i++) if (all[i] < all[i - 1] * 0.99) drop++;
  check(`birth light (${tier}): luminance never falls through the 3.5 s light (1% tolerance)`, drop === 0, `${drop} drops`);
  check(`birth light (${tier}): ≥ 0.95 at its end`, all[all.length - 1] >= 0.95, all[all.length - 1].toFixed(3));
}
{
  const shape = await page.evaluate(async () => (await import("/first-breath/render/palette.js")).ROLES.birth.frames.shape);
  check("birth opening: the stage 8 frames are side flats", shape === "sides", shape);
}

// ---- 6. reduced motion
{
  await open("test=1&seed=1");
  const full = await page.evaluate(() => __fb.motion);
  await open("test=1&seed=1&rm=1");
  const rm = await page.evaluate(() => __fb.motion);
  check("reduced motion: warpAmp ≤ 0.5 × full, bounce 0", rm.warpAmp <= 0.5 * full.warpAmp + 1e-9 && rm.bounce === 0, `${rm.warpAmp} vs ${full.warpAmp}, bounce ${rm.bounce}`);
  const fades = [];
  for (const q of ["", "&rm=1"]) {
    // a whole run from the title, so stage 1 has a next stage and its card crossfades
    await open(`test=1&seed=1${q}`);
    const s = await page.evaluate(() => {
      __fb.act("play");
      __fb.step(30);
      __fb.finish();
      for (let i = 0; i < 400; i++) {
        const x = __fb.state().screen;
        if (x === "almost") __fb.act("goOn"); else if (x === "overlay") __fb.act("next");
        if (window.__fbPaper && __fbPaper.lastCrossfade) break;
        __fb.step(6);
      }
      return window.__fbPaper ? __fbPaper.lastCrossfade || null : null;
    });
    fades.push(s);
  }
  check("reduced motion: the stage change is the same 0.8 s crossfade", fades[0] === 0.8 && fades[1] === 0.8, JSON.stringify(fades));
}

// ---- 7. the low tier in every stage
for (const s of STAGES) {
  for (const q of s === "swim" ? ["q=low", "gl=0"] : ["q=low"]) {
    await open(`test=1&probe=1&seed=1&stage=${s}&${q}`);
    const st = await page.evaluate(() => { __fb.bot(1); __fb.step(240); return { anchor: __fb.state().anchor, lum: __fb.lum(), tier: __fbPaper.tier }; });
    check(`low tier (${q}) ${s}: the low tier draws`, st.tier === "low", st.tier);
    check(`low tier (${q}) ${s}: mean luminance > 0.04`, st.lum > 0.04, st.lum.toFixed(4));
    if (st.anchor) {
      const r = await canvasPixels(`const s = Float32Array.from(L).sort(); let m = 0; const k = W / innerWidth; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = Math.round((arg.x + dx) * k), y = Math.round((arg.y + dy) * k); if (x >= 0 && y >= 0 && x < W && y < H) m = Math.max(m, L[y * W + x]); } return { at: m, median: s[s.length >> 1] };`, st.anchor);
      check(`low tier (${q}) ${s}: the subject's sheet is brighter than the frame's median`, r.at > r.median, `${r.at.toFixed(3)} vs ${r.median.toFixed(3)}`);
    }
  }
}

// ---- 8. no text, anywhere
{
  await open("test=1&seed=1");
  let n = await texts();
  for (const q of ["full", "low"]) {
    for (const s of [...STAGES, "ending"]) {
      await open(`test=1&seed=1&stage=${s}&q=${q}`);
      await page.evaluate(() => { __fb.bot(1); for (let i = 0; i < 12; i++) __fb.step(60); });
      n += await texts();
    }
  }
  await open("test=1&seed=1&stage=birth");
  await page.evaluate(() => { __fb.finish(); for (let i = 0; i < 10; i++) __fb.step(60); });
  n += await texts();
  check("the canvas draws no text in any stage, screen or tier", n === 0, `${n} calls`);
}
check("no page errors", errors.length === 0, errors.slice(0, 4).join(" || "));

await browser.close();
if (server) server.kill();
for (const n of notes) console.log(`NOTE ${n}`);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
