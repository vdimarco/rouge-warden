// Up the Creek: the river. Metres; x runs across the river (right is + when you face downstream), y runs downstream.
// A winding centerline and width, a current that is fastest in the middle, rocks that bend the flow around them, and
// behind each rock an eddy: a pocket where the water turns back upstream. The edge of an eddy is the eddy line, a
// narrow band where the water changes direction. At the foot of the rapid the river pours over a ledge. No DOM here:
// the Node tests import it.
import { mulberry } from "../kit/rng.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const LENGTH = 300;          // metres of river
export const RAPID = [40, 250];     // where the fast water runs: it starts to speed up 14 m below the put-in
export const FINISH = 285;
export const START = 6;             // the put-in
export const JAM = -10;             // a log jam across the river above the put-in: nobody paddles past it
export const LEDGE = 254;           // a ledge across the river at the foot of the rapid: no rocks from 18 m above it
                                    // to 12 m below it

// opts.still: no current at all (for tests of the canoe alone); opts.rocks: place these rocks instead
export function makeRiver(seed, opts = {}) {
  const r = mulberry(seed || 1);
  const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU;
  const c = (y) => 6 * Math.sin((TAU * y) / 120 + p1) + 3 * Math.sin((TAU * y) / 47 + p2);
  const dc = (y) => 6 * (TAU / 120) * Math.cos((TAU * y) / 120 + p1) + 3 * (TAU / 47) * Math.cos((TAU * y) / 47 + p2);
  const b = (y) => 9 + 3 * Math.sin((TAU * y) / 90 + p3);
  // speed of the water in the middle: pools, then the rapid, then a pool at the bottom
  const V = (y) => (opts.still ? 0 : 1.2 + 1.8 * (smoothstep(RAPID[0] - 20, RAPID[0] + 10, y) - smoothstep(RAPID[1] - 10, RAPID[1] + 25, y)));
  // the unit tangent of the centerline, pointing downstream
  const tan = (y) => { const d = dc(y), n = Math.sqrt(1 + d * d); return [d / n, 1 / n]; };
  // The ledge: its lip is a line across the river, square to the current there. lip() is how far past the lip a point
  // is, along the current (- above it). The water speeds up over the last 10 m to the lip, to half again as fast,
  // and slows back down in the 6 m below it.
  const [ltx, lty] = tan(LEDGE), lx = c(LEDGE);
  const lip = (x, y) => (x - lx) * ltx + (y - LEDGE) * lty;
  const pour = (d) => 1 + 0.5 * (smoothstep(-10, 0, d) - smoothstep(0, 6, d));

  const rocks = opts.rocks ? opts.rocks.map((q, i) => ({ id: i, ...q })) : [];
  if (!opts.rocks) {
    // the first rock sits at the head of the rapid, so the first eddy comes in the first few seconds
    const y0 = RAPID[0] - 4 + r() * 4, n0 = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.3);
    rocks.push({ id: 0, x: c(y0) + n0 * b(y0), y: y0, R: 1.2 + r() * 0.5 });
    const want = 10 + Math.floor(r() * 5);
    for (let tries = 0; rocks.length < want && tries < 400; tries++) {
      // most rocks sit in the rapid, a few in the pools
      const y = r() < 0.8 ? RAPID[0] + 10 + r() * (RAPID[1] - RAPID[0] - 20) : 30 + r() * (LENGTH - 60);
      const n = (r() * 2 - 1) * 0.7, R = 0.8 + r() * 1.2;
      const x = c(y) + n * b(y);
      if (rocks.some((q) => Math.hypot(q.x - x, q.y - y) < 6 + q.R + R) || (y > LEDGE - 18 && y < LEDGE + 12)) continue;
      rocks.push({ id: rocks.length, x, y, R });
    }
    rocks.sort((a, q) => a.y - q.y);
    rocks.forEach((q, i) => (q.id = i));
  }
  // each rock's frame: the local downstream direction and the speed of the water it sits in
  for (const q of rocks) {
    const [tx, ty] = tan(q.y);
    const n = (q.x - c(q.y)) / b(q.y);
    q.tx = tx; q.ty = ty;
    q.U = V(q.y) * (1 - n ** 4);
    q.sc = 3.8 * q.R; q.hl = 3 * q.R; q.hw = 1.6 * q.R;     // the eddy: centre, half length, half width
    q.ex = q.x + tx * q.sc; q.ey = q.y + ty * q.sc;           // the eddy's core, in the world
    // the speed of the plain current at the core: where the water speeds up, it is more than U
    const ne = (q.ex - c(q.ey)) / b(q.ey);
    q.Ue = V(q.ey) * Math.max(0, 1 - ne ** 4);
  }

  // The flow at a point: {vx, vy, e (how deep in an eddy, 0..1), rock (inside a rock), n (across, -1..1 is the river)}.
  function flow(x, y, out = {}) {
    const cy = c(y), by = b(y), n = (x - cy) / by;
    const [tx, ty] = tan(y);
    const u0 = V(y) * Math.max(0, 1 - n ** 4) * pour(lip(x, y));
    let vx = u0 * tx, vy = u0 * ty, e = 0, rock = null;
    for (const q of rocks) {
      const dx = x - q.x, dy = y - q.y;
      if (dy < -4.5 * q.R || dy > q.sc + q.hl + 2 || Math.abs(dx) > 5 * q.R + 2) continue;
      // in the rock's frame: s downstream, k across (k > 0 to the right)
      const s = dx * q.tx + dy * q.ty, k = dx * q.ty - dy * q.tx;
      const rho2 = s * s + k * k;
      if (rho2 < q.R * q.R) { rock = q; vx = 0; vy = 0; break; }
      const U = q.U, R2 = q.R * q.R, rho4 = rho2 * rho2;
      // the flow around a cylinder, faded out by 4 radii, as a change from the plain current
      let us = U * (1 - (R2 * (s * s - k * k)) / rho4), uk = (-2 * U * R2 * s * k) / rho4;
      const fade = 1 - smoothstep(2 * q.R, 4 * q.R, Math.sqrt(rho2));
      us = U + (us - U) * fade; uk *= fade;
      // the eddy behind the rock: the water turns back upstream in the core, in at the tail and out by the rock.
      // In the core it runs upstream at 0.3 of the plain current there.
      const es = (s - q.sc) / q.hl, ek = k / q.hw, rhoE = Math.sqrt(es * es + ek * ek);
      const ee = 1 - smoothstep(0.8, 1, rhoE);
      if (ee > 0) {
        us = U - 1.3 * q.Ue * ee;
        uk -= 0.3 * q.Ue * ee * Math.sign(k) * es;
        if (ee > e) e = ee;
      }
      // back to world axes, as a change from the plain current at this point
      const dus = us - U;
      vx += dus * q.tx + uk * q.ty;
      vy += dus * q.ty - uk * q.tx;
    }
    out.vx = vx; out.vy = vy; out.e = e; out.rock = rock; out.n = n;
    return out;
  }

  // the eddy the point is in (e > 0.6), or null
  function eddyAt(x, y) {
    for (const q of rocks) {
      const dx = x - q.x, dy = y - q.y, s = dx * q.tx + dy * q.ty, k = dx * q.ty - dy * q.tx;
      const es = (s - q.sc) / q.hl, ek = k / q.hw;
      if (es * es + ek * ek < 0.64) return q;
    }
    return null;
  }

  // the eddies worth catching: behind rocks in fast water
  const targets = rocks.filter((q) => q.U >= 1.5);
  for (const q of rocks) q.target = q.U >= 1.5;

  return { seed, rocks, targets, c, dc, b, V, tan, flow, eddyAt, lip, ledge: { x: lx, y: LEDGE, tx: ltx, ty: lty }, bank: (y) => [c(y) - b(y), c(y) + b(y)] };
}
