// Gloam Downs: the place's veils in a run. Barrow Crown's ghost fog, the fen's water mist and the Crow Wall's haze are big, flat,
// see-through glow splats. The renderer draws each splat whole, in front of or behind a figure by the depth of its centre alone, so a
// sheet whose centre is nearer the eye than a foe is drawn over the whole foe wherever the sheet covers it on the screen, though the
// sheet lies round the foe's feet: its tells and its hit flash take the colour of the mist, and the resolve snaps them to the place's
// pale greys. In a run, a sheet that covers an awake figure on the screen and is drawn after it fades out over 0.25 s of game time,
// and fades back when it no longer does. The explorer never uses this, so the places look as they were baked. No DOM, so Node tests
// use it as it is.
const FADE = 15; // steps of the game clock from shown to gone (0.25 s)
const FAINT = 0.01; // a sheet that adds less than this where a figure stands does not count
const DILATE = 0.15; // the renderer's own widening of every splat on the screen, in pixels squared

/* world is the place as world.js loads it (data, count); count is how many of its splats are the place's own (the pool comes after);
   skip is a list of [first, end) ranges to leave as they are (the beacon's fire and the wisps, which the page puts out and lights);
   shared is the packed colours of the shared slots 32 to 47, the lights. A veil is a place splat that is see-through (density under
   1), not a light, and from 0.15 to 4 m across in its widest spread (the sky dome's splats are tens of metres across) */
export function findVeils(world, { count = world.count, skip = [], shared = [] } = {}) {
  const d = world.data, lights = new Set(shared), out = [];
  const skipped = i => skip.some(([a, b]) => i >= a && i < b);
  for (let i = 0; i < count; i++) {
    const o = i * 16, a = d[o + 3];
    if (!(a > 0 && a < 1) || lights.has(d[o + 7]) || skipped(i)) continue;
    const spread = Math.sqrt(Math.max(d[o + 4], d[o + 8], d[o + 10]));
    if (spread < 0.15 || spread > 4) continue;
    // the covariance (xx, xy, xz, yy, yz, zz), as the renderer reads it
    out.push({ i, p: [d[o], d[o + 1], d[o + 2]], cov: [d[o + 4], d[o + 5], d[o + 6], d[o + 8], d[o + 9], d[o + 10]], a, k: FADE });
  }
  return out;
}

/* How much a splat covers a point on the screen, as the renderer's splat shader works it out: the splat's covariance carried to the
   screen through the camera (view: a column-major 4x4, as view.mjs makes it; focal: pixels to a unit at depth 1), then its Gaussian
   at the point. -> { depth, cover } (depth is the distance in front of the eye; cover 0 when the point is outside 3 spreads) */
const camOf = (V, p) => [V[0] * p[0] + V[4] * p[1] + V[8] * p[2] + V[12], V[1] * p[0] + V[5] * p[1] + V[9] * p[2] + V[13], V[2] * p[0] + V[6] * p[1] + V[10] * p[2] + V[14]];
export function screenOf(V, focal, p) {
  const c = camOf(V, p), z = -c[2];
  return z > 0.05 ? { x: (focal * c[0]) / z, y: (focal * c[1]) / z, z } : null;
}
export function conicOf(V, focal, v) {
  const c = camOf(V, v.p), z = -c[2];
  if (z <= 0.4) return null;
  // T = J * W (2x3): W the view's turn, J the perspective's Jacobian at the centre
  const W = [[V[0], V[4], V[8]], [V[1], V[5], V[9]], [V[2], V[6], V[10]]];
  const j = [[focal / z, 0, (focal * c[0]) / (z * z)], [0, focal / z, (focal * c[1]) / (z * z)]];
  const T = j.map(r => [0, 1, 2].map(k => r[0] * W[0][k] + r[1] * W[1][k] + r[2] * W[2][k]));
  const [xx, xy, xz, yy, yz, zz] = v.cov, S = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]];
  const TS = T.map(r => [0, 1, 2].map(k => r[0] * S[0][k] + r[1] * S[1][k] + r[2] * S[2][k]));
  const A = TS[0][0] * T[0][0] + TS[0][1] * T[0][1] + TS[0][2] * T[0][2] + DILATE;
  const B = TS[0][0] * T[1][0] + TS[0][1] * T[1][1] + TS[0][2] * T[1][2];
  const C = TS[1][0] * T[1][0] + TS[1][1] * T[1][1] + TS[1][2] * T[1][2] + DILATE;
  const det = A * C - B * B;
  if (det <= 0) return null;
  return { x: (focal * c[0]) / z, y: (focal * c[1]) / z, z, ia: C / det, ib: -B / det, ic: A / det };
}
export function coverOf(q, s, alpha) {
  const dx = s.x - q.x, dy = s.y - q.y, power = -0.5 * (q.ia * dx * dx + 2 * q.ib * dx * dy + q.ic * dy * dy);
  return power < -4.5 ? 0 : alpha * Math.exp(power);
}

/* step(view, focal, figures): figures are the points that must not be veiled (each awake figure's feet, middle and head). A veil fades
   out while it covers one of them on the screen and its centre is nearer the eye than that point; otherwise it fades back. Returns
   the rows (512 splats each) whose data changed. */
export function makeVeils(world, list) {
  const d = world.data, rows = new Set();
  function step(V, focal, figures) {
    rows.clear();
    const pts = figures.map(p => screenOf(V, focal, p)).filter(Boolean);
    for (const v of list) {
      let hide = false;
      if (pts.length) {
        const q = conicOf(V, focal, v);
        if (q) for (const s of pts) if (q.z < s.z && coverOf(q, s, v.a) > FAINT) { hide = true; break; }
      }
      const k = Math.max(0, Math.min(FADE, v.k + (hide ? -1 : 1)));
      if (k === v.k) continue;
      v.k = k;
      d[v.i * 16 + 3] = (v.a * k) / FADE;
      rows.add(v.i >> 9);
    }
    return rows;
  }
  // every veil back as it was baked
  function reset() {
    rows.clear();
    for (const v of list) if (v.k !== FADE) { v.k = FADE; d[v.i * 16 + 3] = v.a; rows.add(v.i >> 9); }
    return rows;
  }
  return { list, step, reset, rows };
}
export const VEIL = { FADE, FAINT, DILATE };
