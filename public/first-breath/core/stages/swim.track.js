// First Breath: stage 1, The Race (`swim`), the bending track (design.md 5.1, "The track"). The race keeps its v1
// coordinates: progress p runs along the centre line and x across it (x grows to the right of forward), so the v1
// current, lane, checkpoints and glow walls work unchanged. This file lays that centre line in the world as lines and
// arcs and maps (x, p) to world points, and gives the curvature the race model needs to steer round a bend.
//
// - The womb, the gate and the fork are straight along world +y (world = (x, p) there, as in v1). The warm tube's
//   centre line is x = xc = warm × 30 (v1); from B1 on it bends. The map is world = C(p) + (x − xc) × r(p), with C the
//   centre line laid from (xc, 0) heading +y and r its right normal, so it is the v1 map wherever the track is straight.
// - Bends are { p0, turn (degrees, + left), R }: B1 a right 90° of radius 120 from 1,450 u, B2 a left 120° of 90 from
//   1,780, B3 a right hairpin of 180° of 55 from 2,250, B4 a left 90° of 100 from 2,880, B5 a right 90° of 100 from
//   3,060, B6 a left 150° of 70 from 3,620. Straights join them; the turns add to 0, so the final straight runs +y,
//   as the start does. Past the last piece and before 0 the line runs straight on.
// - k(p) is the signed curvature (1/R, + for a left bend). A sperm at x moves along the line at v cos(θ) / (1 + k u),
//   u = x − xc (the inside of a bend is shorter), and a still world heading turns against the track by −k per u of
//   progress: the race model (swim.js) adds both.
// Pure: no DOM, no clocks, no random.

const DEG = Math.PI / 180;

// The pieces of the centre line from p = 0 (lines and arcs), laid from (0, 0) heading +y. Each piece:
// { p0, p1, k (signed curvature, 0 for a line), phi0 (world heading at p0), x0, y0 (its start, from xc), deg0 }.
export function layTrack(bends) {
  const list = (Array.isArray(bends) ? bends : []).map((b) => ({ p0: b[0], turn: b[1], R: b[2] })).sort((a, b) => a.p0 - b.p0);
  const pieces = [];
  let p = 0, x = 0, y = 0, deg = 90;
  const lineTo = (p1) => {
    if (p1 <= p + 1e-9) return;
    const phi = deg * DEG, L = p1 - p;
    pieces.push({ p0: p, p1, k: 0, phi0: phi, deg0: deg, x0: x, y0: y, bend: -1 });
    x += Math.cos(phi) * L; y += Math.sin(phi) * L; p = p1;
  };
  list.forEach((b, i) => {
    lineTo(b.p0);
    const k = (b.turn > 0 ? 1 : -1) / b.R, L = Math.abs(b.turn) * DEG * b.R, phi = deg * DEG;
    pieces.push({ p0: p, p1: p + L, k, phi0: phi, deg0: deg, x0: x, y0: y, bend: i, R: b.R, turn: b.turn });
    // the end of the arc, from its centre: centre = start + (1/k)(−sin φ0, cos φ0); point = centre + (1/k)(sin φ, −cos φ)
    const phi1 = phi + k * L, cx = x - Math.sin(phi) / k, cy = y + Math.cos(phi) / k;
    x = cx + Math.sin(phi1) / k; y = cy - Math.cos(phi1) / k;
    deg += b.turn; p += L;
  });
  const end = { p0: p, p1: Infinity, k: 0, phi0: deg * DEG, deg0: deg, x0: x, y0: y, bend: -1 };
  pieces.push(end);
  return Object.freeze({
    pieces: Object.freeze(pieces.map((q) => Object.freeze(q))),
    bends: Object.freeze(pieces.filter((q) => q.bend >= 0).map((q) => Object.freeze({ i: q.bend, p0: q.p0, p1: q.p1, k: q.k, R: q.R, turn: q.turn }))),
  });
}

// The piece that holds p (the first one for p < 0).
function pieceAt(trk, p) {
  const ps = trk.pieces;
  if (!(p > ps[0].p0)) return ps[0];
  let lo = 0, hi = ps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ps[mid].p0 <= p) lo = mid; else hi = mid - 1;
  }
  return ps[lo];
}

// The centre line at p (from xc): { x, y, phi (world heading), k (curvature) }.
export function lineAt(trk, p) {
  const q = pieceAt(trk, p);
  const s = p - q.p0;
  if (q.k === 0) return { x: q.x0 + Math.cos(q.phi0) * s, y: q.y0 + Math.sin(q.phi0) * s, phi: q.phi0, k: 0 };
  const phi = q.phi0 + q.k * s;
  const cx = q.x0 - Math.sin(q.phi0) / q.k, cy = q.y0 + Math.cos(q.phi0) / q.k;
  return { x: cx + Math.sin(phi) / q.k, y: cy - Math.cos(phi) / q.k, phi, k: q.k };
}

export const curveAt = (trk, p) => pieceAt(trk, p).k;
export const headingAt = (trk, p) => lineAt(trk, p).phi;

// The world point of track point (x, p), with the tube's centre at x = xc: { x, y, phi }.
export function worldOf(trk, xc, x, p) {
  const c = lineAt(trk, p), u = x - xc;
  return { x: xc + c.x + u * Math.sin(c.phi), y: c.y - u * Math.cos(c.phi), phi: c.phi };
}

// The bend weight at p: 1 inside a bend, easing to 0 over `ramp` u before and after it, signed by the inside side
// (+1 when the inside is to the right, x+, that is a right bend). Overlapping ramps add (the chicane B4 to B5).
export function insideAt(trk, p, ramp) {
  let w = 0;
  for (const b of trk.bends) {
    let f = 0;
    if (p >= b.p0 && p <= b.p1) f = 1;
    else if (p < b.p0 && p > b.p0 - ramp) f = 1 - (b.p0 - p) / ramp;
    else if (p > b.p1 && p < b.p1 + ramp) f = 1 - (p - b.p1) / ramp;
    if (f > 0) w += (b.k < 0 ? 1 : -1) * f * f * (3 - 2 * f);
  }
  return Math.max(-1, Math.min(1, w));
}

// The bend that holds p, or the next one ahead within `ahead` u, or null.
export function bendNear(trk, p, ahead = 0) {
  for (const b of trk.bends) if (p <= b.p1 && p >= b.p0 - ahead) return b;
  return null;
}
