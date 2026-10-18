// First Breath: currents (design.md 6.1, 14.2). curl() turns a scalar potential ψ into a divergence-free flow,
// v = (∂ψ/∂y, −∂ψ/∂x), so drifting things never clump or vanish; wallRamp() is the ramp that makes a flow slide
// along a wall instead of entering it (multiply ψ by wallRamp(distance to the wall / d0)). Both after Bridson,
// Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007). tubeFlow() is the stage 1 tube
// current's profile across the tube. Pure.
//
// Contract choices (16.2 names only the functions): curl(psi, x, y, h = 0.5) takes ψ as a function and uses central
// differences; tubeFlow(r, peak = 22) takes r = the distance from the centre over the half-width and gives
// peak × (0.3 + 0.7 (1 − r²)) toward you, with |r| clamped to 1; wallRamp(r) is odd and ±1 outside (−1, 1). Extra
// export: makeNoise(seed, scale) → a seeded, smooth value noise ψ(x, y) in −1..1, for a gentle drift.
import { hash01 } from "../../../lab/kit/rng.js";

// Bridson's ramp: 15/8 r − 10/8 r³ + 3/8 r⁵ inside (−1, 1).
export function wallRamp(r) {
  if (r >= 1) return 1;
  if (r <= -1) return -1;
  const r2 = r * r;
  return r * (15 / 8 - (10 / 8) * r2 + (3 / 8) * r2 * r2);
}

// The flow of a potential ψ at (x, y).
export function curl(psi, x, y, h = 0.5) {
  const dy = (psi(x, y + h) - psi(x, y - h)) / (2 * h);
  const dx = (psi(x + h, y) - psi(x - h, y)) / (2 * h);
  return { x: dy, y: -dx };
}

// The tube current toward you, by the offset across the tube (22 u/s at the centre, 9.5 u/s at r = 0.9).
export function tubeFlow(r, peak = 22) {
  const a = Math.min(1, Math.abs(r));
  return peak * (0.3 + 0.7 * (1 - a * a));
}

// A seeded value noise with a quintic fade: smooth, −1..1, one lattice cell per `scale` u.
export function makeNoise(seed, scale = 40) {
  const s = seed >>> 0;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const u = fade(fx - ix), v = fade(fy - iy);
    const a = hash01(ix, iy, s), b = hash01(ix + 1, iy, s), c = hash01(ix, iy + 1, s), d = hash01(ix + 1, iy + 1, s);
    const top = a + (b - a) * u, bottom = c + (d - c) * u;
    return 2 * (top + (bottom - top) * v) - 1;
  };
}
