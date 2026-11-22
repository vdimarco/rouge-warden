// Gloam Downs: the place's veils in a run. Barrow Crown's ghost fog, the fen's water mist and the Crow Wall's haze are big, flat,
// see-through glow splats. The renderer draws each splat whole, in front of or behind a figure by the depth of its centre alone, so a
// sheet whose centre is nearer the eye than a foe is drawn over the whole foe wherever the sheet covers it on the screen, though the
// sheet lies round the foe's feet: its tells and its hit flash take the colour of the mist, and the resolve snaps them to the place's
// pale greys. In a run, a sheet that covers an awake figure on the screen and is drawn after it fades out over 0.25 s of game time,
// and fades back when it no longer does. The explorer never uses this, so the places look as they were baked. No DOM, so Node tests
// use it as it is. Below the veils: the scenery that fades in front of a boss marker (makeOccluders).
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

/* ---------------- the scenery in front of a boss marker ----------------
   From the south of Barrow Crown's arena, the yew at (17, −13.5) covered the near half of the west shard ring, and no pitch the boss
   camera may take (to 1.1) clears it: the walk map's sight test says the eye sees that rim only from a pitch of 1.4, nearly straight
   down. So while the boss's marker is laid, a piece of scenery that covers a point of it on the screen, and stands nearer the eye than
   that point, fades out over 0.25 s of game time, and fades back when it no longer does (as a veil does over a figure). A piece is a
   group of the place's own opaque splats that stand more than 1.2 m over the low ground round them (the lowest walk-map top at the
   splat and at 8 points 2 m round it), joined where they touch on a grid of 0.5 m: a yew's crown, the head of a grave stone. The
   splats from 0.4 to 1.2 m up in the same columns join it, or the crown's underside stays as a dark disc over the marker. Its foot
   stays, so the player still sees where it stands. A piece more than 4 m across from its middle is the ground of a slope or a barrow,
   not a thing standing on it, and never fades. Fading the thing that blocks the view, and not moving the camera, is the remedy
   for an occluder in John Nesky's "50 Game Camera Mistakes" (GDC 2014); the fade itself is the veils' own, above.
   -> [{ ids: [splat index], a: [density], c: [x, y, z], r, k }] for the place splats within r of centre */
const RISE = 1.2, UNDER = 0.4, CELL = 0.5, NEAR = 2.0, WIDEST = 4;
export function findOccluders(world, walk, { count = world.count, skip = [], shared = [], centre = [0, 0, 0], r = 20 } = {}) {
  const d = world.data, lights = new Set(shared), skipped = i => skip.some(([a, b]) => i >= a && i < b);
  const low = (x, z) => { let m = walk.top(x, z); for (let k = 0; k < 8; k++) m = Math.min(m, walk.top(x + Math.cos(k * Math.PI / 4) * NEAR, z + Math.sin(k * Math.PI / 4) * NEAR)); return m; };
  const cells = new Map(), under = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  for (let i = 0; i < count; i++) {
    const o = i * 16, x = d[o], y = d[o + 1], z = d[o + 2];
    if (!(d[o + 3] >= 1) || lights.has(d[o + 7]) || skipped(i) || Math.hypot(x - centre[0], z - centre[2]) > r) continue;
    const up = y - low(x, z);
    if (up <= UNDER) continue;
    if (up <= RISE) { const col = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; if (!under.has(col)) under.set(col, []); under.get(col).push(i); continue; }
    const c = key(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c).push(i);
  }
  // the pieces: cells joined to their 26 neighbours
  const seen = new Set(), out = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const ids = [], todo = [start];
    seen.add(start);
    while (todo.length) {
      const c = todo.pop(), [ci, cj, ck] = c.split(',').map(Number);
      ids.push(...cells.get(c));
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
        const n = key(ci + a, cj + b, ck + e);
        if (cells.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); }
      }
    }
    // the underside: splats from 0.4 to 1.2 m up in the piece's own columns (a yew's crown hangs down to about 1 m over the ground)
    for (const col of new Set(ids.map(i => `${Math.floor(d[i * 16] / CELL)},${Math.floor(d[i * 16 + 2] / CELL)}`))) {
      const u = under.get(col);
      if (u) { ids.push(...u); under.delete(col); }
    }
    const c = [0, 1, 2].map(k => ids.reduce((s, i) => s + d[i * 16 + k], 0) / ids.length);
    let rad = 0;
    for (const i of ids) rad = Math.max(rad, Math.hypot(d[i * 16] - c[0], d[i * 16 + 1] - c[1], d[i * 16 + 2] - c[2]) + 3 * Math.sqrt(Math.max(d[i * 16 + 4], d[i * 16 + 8], d[i * 16 + 10])));
    if (rad <= WIDEST) out.push({ ids, a: ids.map(i => d[i * 16 + 3]), c, r: rad, k: FADE });
  }
  return out;
}
/* step(view, focal, points): points are the marker's ground points (boss.js markPoints). A piece fades out while one of its splats
   covers a point on the screen (within about 1.7 spreads of its centre) from more than 0.3 m nearer the eye; otherwise it fades back.
   Returns the rows whose data changed */
export const OCCLUDE = { FADE, RISE, UNDER, CELL, NEAR, WIDEST, power: -1.5, gap: 0.3 };
export function makeOccluders(world, list) {
  const d = world.data, rows = new Set();
  function covers(V, focal, o, pts) {
    const c = screenOf(V, focal, o.c);
    if (!c) return false;
    const R = (focal * o.r) / Math.max(0.4, c.z);
    const near = pts.filter(s => Math.hypot(s.x - c.x, s.y - c.y) <= R && s.z > c.z - o.r);
    if (!near.length) return false;
    for (const i of o.ids) {
      const v = { p: [d[i * 16], d[i * 16 + 1], d[i * 16 + 2]], cov: [d[i * 16 + 4], d[i * 16 + 5], d[i * 16 + 6], d[i * 16 + 8], d[i * 16 + 9], d[i * 16 + 10]] };
      const q = conicOf(V, focal, v);
      if (!q) continue;
      for (const s of near) {
        if (q.z >= s.z - OCCLUDE.gap) continue;
        const dx = s.x - q.x, dy = s.y - q.y;
        if (-0.5 * (q.ia * dx * dx + 2 * q.ib * dx * dy + q.ic * dy * dy) > OCCLUDE.power) return true;
      }
    }
    return false;
  }
  function step(V, focal, points) {
    rows.clear();
    const pts = points.length ? points.map(p => screenOf(V, focal, p)).filter(Boolean) : [];
    for (const o of list) {
      if (!pts.length && o.k === FADE) continue;
      const hide = pts.length > 0 && covers(V, focal, o, pts);
      const k = Math.max(0, Math.min(FADE, o.k + (hide ? -1 : 1)));
      if (k === o.k) continue;
      o.k = k;
      o.ids.forEach((i, n) => { d[i * 16 + 3] = (o.a[n] * k) / FADE; rows.add(i >> 9); });
    }
    return rows;
  }
  function reset() {
    rows.clear();
    for (const o of list) if (o.k !== FADE) { o.k = FADE; o.ids.forEach((i, n) => { d[i * 16 + 3] = o.a[n]; rows.add(i >> 9); }); }
    return rows;
  }
  // the pieces faded now, wholly or in part
  const faded = () => list.filter(o => o.k < FADE).map(o => ({ c: o.c.map(v => Math.round(v * 100) / 100), n: o.ids.length, k: o.k }));
  return { list, step, reset, rows, faded };
}
