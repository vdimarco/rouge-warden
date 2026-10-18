// First Breath: the frame cost, the scale steps and the tier switch (design.md 14.3, 16.9, 17).
//
// - Frame cost: the JS time of one frame, from the start of its fixed steps (frameStart, from main.js) to the end of
//   its draw calls (and, under ?probe=1, the 1 px readback that waits for the raster). emaMs is an EMA with α = 0.1;
//   p95Ms the 95th percentile of the last 120 frames. Frames that bake, and the first frame after a resize, are left
//   out of emaMs, p95Ms and the counters.
// - Adaptive steps use the rAF interval only: step down when the interval average is above 20 ms for 30 frames in a
//   row; step up when it is below 18 ms for 120 frames. The order: down to 0.5 (phones) or 0.35 (desktop); then the
//   tier switch (the interval average above 20 ms for 60 frames while the step is 0.5 or lower switches to the low
//   tier for the rest of the run; it never switches back); then the lower steps. ?res pins the step and ?q the tier.
// - draws counts the canvas fill, stroke, fillRect and drawImage calls of the frame on the main context (counted by
//   wrapping those methods on that one context; bake canvases are not counted).
// Source: none fit, our own; the step list and the budgets are design.md 14.3.

export const STEPS = Object.freeze([1, 0.8, 0.66, 0.5, 0.4, 0.35]);
const EMA_A = 0.1, WINDOW = 120;
const DOWN = { ms: 20, frames: 30 }, UP = { ms: 18, frames: 120 }, TIER = { ms: 20, frames: 60 };

export function pinIndex(res) {
  if (!(res > 0)) return -1;
  let best = STEPS.length - 1;
  for (let i = STEPS.length - 1; i >= 0; i--) if (STEPS[i] <= res + 1e-9) best = i;
  return best;
}

export function createPerf({ res = null, tier = null } = {}) {
  const pinned = pinIndex(res);
  const state = {
    step: pinned >= 0 ? pinned : 0,
    tierPinned: tier === "low" || tier === "full",
    low: tier === "low",
    skipNext: true,
  };
  const perf = { emaMs: 0, p95Ms: 0, scale: STEPS[state.step], w: 0, h: 0, px: 0, draws: 0, splats: 0, points: 0,
    fallback: state.low, tier: state.low ? "low" : "full", baked: 0 };
  const costs = new Float64Array(WINDOW);
  let nCost = 0, iCost = 0, lastT = null, intAvg = 1000 / 60, slow = 0, quick = 0, slowTier = 0;
  let calls = 0;

  function p95() {
    const n = Math.min(nCost, WINDOW);
    if (!n) return 0;
    const a = Array.from(costs.subarray(0, n)).sort((x, y) => x - y);
    return a[Math.min(n - 1, Math.floor(0.95 * (n - 1) + 0.5))];
  }

  // Wrap the counted calls of one context (the main canvas's).
  function count(ctx) {
    for (const name of ["fill", "stroke", "fillRect", "drawImage"]) {
      const f = ctx[name];
      if (typeof f !== "function") continue;
      ctx[name] = function () { calls++; return f.apply(this, arguments); };
    }
  }

  // The floor of the adaptive steps before the tier switch (phones 0.5, desktop 0.35).
  const floorIndex = (desktop) => STEPS.indexOf(desktop ? 0.35 : 0.5);

  // One measured frame. Returns "resize" when the step changed (the caller resizes the canvas).
  function frame({ t0, frameStart, end, baked, desktop }) {
    perf.draws = calls;
    calls = 0;
    if (baked) perf.baked++;
    const measured = Number.isFinite(frameStart);
    if (!measured) return null;
    // the rAF interval, from one measured frame's start to the next
    const gap = lastT === null ? null : Math.min(250, t0 - lastT);
    lastT = t0;
    if (state.skipNext || baked) { state.skipNext = false; return null; }
    const cost = end - frameStart;
    perf.emaMs = nCost ? perf.emaMs + EMA_A * (cost - perf.emaMs) : cost;
    costs[iCost] = cost; iCost = (iCost + 1) % WINDOW; nCost++;
    perf.p95Ms = p95();
    if (gap === null) return null;
    intAvg += EMA_A * (gap - intAvg);
    return adapt(desktop);
  }

  function adapt(desktop) {
    if (intAvg > DOWN.ms) { slow++; quick = 0; } else slow = 0;
    if (intAvg < UP.ms) quick++; else quick = 0;
    if (!state.tierPinned && !state.low && STEPS[state.step] <= 0.5 + 1e-9 && intAvg > TIER.ms) slowTier++; else slowTier = 0;
    if (pinned >= 0 && state.tierPinned) return null;
    // the tier switch, once the step is at its floor
    if (!state.tierPinned && !state.low && slowTier >= TIER.frames) {
      state.low = true; perf.fallback = true; perf.tier = "low"; slow = 0; slowTier = 0;
      return "tier";
    }
    if (pinned >= 0) return null;
    const floor = floorIndex(desktop);
    if (slow >= DOWN.frames) {
      const canLower = state.step < floor || (state.step < STEPS.length - 1 && (state.low || state.tierPinned));
      if (canLower) { state.step++; slow = 0; perf.scale = STEPS[state.step]; return "resize"; }
    } else if (quick >= UP.frames && state.step > 0) {
      state.step--; quick = 0; perf.scale = STEPS[state.step]; return "resize";
    }
    return null;
  }

  return {
    perf,
    count,
    frame,
    get step() { return STEPS[state.step]; },
    get low() { return state.low; },
    resized() { state.skipNext = true; },
    // a new run starts in the full tier unless ?q pins it (14.3)
    reset() { if (!state.tierPinned) { state.low = false; perf.fallback = false; perf.tier = "full"; } },
  };
}
