// First Breath: the renderer, the WAVE-0 STUB (design.md 14.3, 16.2, 16.12; tasks.md 1.10). It draws each draw list
// with render/debug.js on a Canvas 2D context, sizes the canvas (phones at 1.0 × CSS px with DPR ignored, desktop
// capped at 0.6 MP, times the scale step), keeps the frame-cost numbers of 14.3 with the adaptive step rules, mixes
// the old frame out over a crossfade, and measures the mean luminance under ?probe=1. The wave-1 renderer (the Canvas
// 2D paper-cut look) fills this file behind the same signature and draws the same list.
//
// Contract choices (16.2 gives createRenderer(canvas, { gl, res, probe, motion }) → { draw, resize, perf, lum,
// crossfade, dispose }):
// - draw(drawList, { frameStart }) takes an optional second argument: the performance.now() at the start of the
//   frame's fixed steps, so perf.emaMs and perf.p95Ms cover the steps and the draw (14.3). A draw without it (the
//   test hook's synchronous present) draws but leaves the frame numbers and the step rules alone.
// - The stub always draws plain shapes, so perf.fallback is true and `gl` is only kept for wave 1; perf.draws counts
//   the non-empty layers drawn.
// - lum() returns null without ?probe=1; with it, the mean relative luminance (sRGB decoded, WCAG weights) of the
//   last frame, read from a 24 × 24 copy.
// - crossfade(seconds) copies the last frame now and mixes it out over `seconds` of wall time (the same in reduced
//   motion, 12). motion is kept for wave 1 (warp and bounce).
// - perf.scale is the step (per axis); res pins it to the nearest step at or below it.
import { drawDebug } from "./debug.js";
import { makeCamera, layoutOf } from "./camera.js";

export const STEPS = Object.freeze([1, 0.8, 0.66, 0.5, 0.4, 0.35]);
const DESKTOP_MAX_PX = 600000;
const EMA_A = 0.1;
const WINDOW = 120;
const DOWN = { emaMs: 14, intervalMs: 20, frames: 30 };
const UP = { emaMs: 8, intervalMs: 18, frames: 120 };

const now = () => performance.now();

function pinIndex(res) {
  if (!(res > 0)) return -1;
  let best = STEPS.length - 1;
  for (let i = STEPS.length - 1; i >= 0; i--) if (STEPS[i] <= res + 1e-9) best = i;
  return best;
}

export function createRenderer(canvas, { gl = true, res = null, probe = false, motion = null } = {}) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const pinned = pinIndex(res);
  let step = pinned >= 0 ? pinned : 0;
  let cssW = Math.max(1, canvas.clientWidth || 1), cssH = Math.max(1, canvas.clientHeight || 1);
  const perf = { emaMs: 0, p95Ms: 0, scale: STEPS[step], w: 0, h: 0, px: 0, draws: 0, splats: 0, points: 0, fallback: true };
  const costs = new Float64Array(WINDOW);
  let nCost = 0, iCost = 0, slow = 0, quick = 0, lastFrame = null, intervalAvg = 1000 / 60;
  let fade = null;
  let probeCanvas = null;

  function size() {
    const phone = layoutOf(cssW, cssH) !== "desktop";
    const cap = phone ? 1 : Math.min(1, Math.sqrt(DESKTOP_MAX_PX / (cssW * cssH)));
    const w = Math.max(1, Math.round(cssW * cap * STEPS[step]));
    const h = Math.max(1, Math.round(cssH * cap * STEPS[step]));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    perf.scale = STEPS[step];
    perf.w = w; perf.h = h; perf.px = w * h;
  }
  size();

  function p95() {
    const n = Math.min(nCost, WINDOW);
    if (!n) return 0;
    const a = Array.from(costs.subarray(0, n)).sort((x, y) => x - y);
    return a[Math.min(n - 1, Math.floor(0.95 * (n - 1) + 0.5))];
  }

  // 14.3: down after 30 slow frames in a row, up after 120 quick ones; never while ?res pins the step
  function adapt(cost) {
    if (pinned >= 0) return;
    if (perf.emaMs > DOWN.emaMs || intervalAvg > DOWN.intervalMs) { slow++; quick = 0; } else slow = 0;
    if (perf.emaMs < UP.emaMs && intervalAvg < UP.intervalMs) quick++; else quick = 0;
    if (slow >= DOWN.frames && step < STEPS.length - 1) { step++; slow = 0; size(); }
    else if (quick >= UP.frames && step > 0) { step--; quick = 0; size(); }
  }

  function draw(drawList, { frameStart } = {}) {
    const t0 = now();
    ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);
    const cam = makeCamera(cssW, cssH, drawList && drawList.camera);
    const s = drawDebug(ctx, drawList, cam);
    perf.draws = s.draws;
    perf.splats = s.splats;
    perf.points = s.points;
    if (fade) {
      const p = (t0 - fade.t0) / (fade.s * 1000);
      if (p >= 1) fade = null;
      else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(fade.img, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        perf.draws++;
      }
    }
    if (Number.isFinite(frameStart)) {
      const end = now();
      const cost = end - frameStart;
      perf.emaMs = nCost ? perf.emaMs + EMA_A * (cost - perf.emaMs) : cost;
      costs[iCost] = cost;
      iCost = (iCost + 1) % WINDOW;
      nCost++;
      perf.p95Ms = p95();
      if (lastFrame !== null) intervalAvg += EMA_A * (Math.min(250, t0 - lastFrame) - intervalAvg);
      lastFrame = t0;
      adapt(cost);
    }
  }

  function resize(w, h) {
    cssW = Math.max(1, Math.round(w));
    cssH = Math.max(1, Math.round(h));
    size();
  }

  function crossfade(seconds) {
    const s = Number(seconds);
    if (!(s > 0)) return;
    const img = document.createElement("canvas");
    img.width = canvas.width;
    img.height = canvas.height;
    const c = img.getContext("2d");
    c.drawImage(canvas, 0, 0);
    fade = { img, t0: now(), s };
  }

  // mean relative luminance of the canvas, 0..1 (?probe=1 only)
  function lum() {
    if (!probe) return null;
    if (!probeCanvas) { probeCanvas = document.createElement("canvas"); probeCanvas.width = 24; probeCanvas.height = 24; }
    const c = probeCanvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(canvas, 0, 0, 24, 24);
    const px = c.getImageData(0, 0, 24, 24).data;
    const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
    return sum / (px.length / 4);
  }

  function dispose() {
    fade = null;
    probeCanvas = null;
  }

  return { draw, resize, perf, lum, crossfade, dispose };
}
