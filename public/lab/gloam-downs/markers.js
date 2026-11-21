// Gloam Downs: ground markers laid on the walk map. A ring is six slices of 60°, a lane pieces of 1.4 m, each on its own bone; each
// piece tilts to the plane that best fits the ground under its rim, and lies 0.05 m over it. The ground is the floor met from 2.5 m
// over the marker's foot (walk.support), or the water's surface where that is higher: nothing under the water is drawn. A projected
// decal would be the usual answer, but the renderer has no decal pass, so each piece is a plane (design.md "Ground markers").
// No DOM: the page poses the pieces with pool.marker(), and the Node test measures the fit on the baked walk maps.

// the water's surface of each place that has water (games/gloam-downs/biomes/fen.mjs, W)
export const WATER = { fen: 0 };
const TILT = 1.2; // the steepest a piece may tilt: past that it would stand up like a sign
const NEAR = 0.15; // a rim point this close to the ground is on it (the spec's measure)

export function groundAt(walk, x, z, y0, water) {
  let g = walk.support(x, z, y0 + 2.5);
  if (g === null) g = walk.top(x, z);
  return water !== undefined && water > g ? water : g;
}
// the plane y = a + bx·x + bz·z through points [x, y, z] by least squares, each point weighted by w (or 1)
export function fitPlane(pts, w = null) {
  let n = 0, sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
  pts.forEach(([x, y, z], i) => { const k = w ? w[i] : 1; n += k; sx += k * x; sz += k * z; sy += k * y; sxx += k * x * x; szz += k * z * z; sxz += k * x * z; sxy += k * x * y; szy += k * z * y; });
  const M = [[n, sx, sz], [sx, sxx, sxz], [sz, sxz, szz]], v = [sy, sxy, szy];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-9) return [sy / Math.max(1e-9, n), 0, 0];
  return [0, 1, 2].map(k => det(M.map((r, i) => r.map((c, j) => (j === k ? v[i] : c)))) / D);
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* one piece: its plane through its sample points, reweighted three times toward the points it already meets (where a rim crosses a
   boardwalk or a porch edge, no plane follows both, so it lies on the ground most of the rim is on). -> { y: the plane's height at
   (px, pz), tilt: [dy/dx, dy/dz] } */
function piece(pts, px, pz) {
  let [a, bx, bz] = fitPlane(pts);
  for (let it = 0; it < 3; it++) [a, bx, bz] = fitPlane(pts, pts.map(([x, y, z]) => 1 / Math.max(0.04, Math.abs(y - (a + bx * x + bz * z)))));
  bx = clamp(bx, -TILT, TILT); bz = clamp(bz, -TILT, TILT);
  return { y: a + bx * px + bz * pz, tilt: [bx, bz] };
}
const heightOn = (p, cx, cz, x, z) => p.y + p.tilt[0] * (x - cx) + p.tilt[1] * (z - cz);
/* a ring of radius R round (cx, cz): its six slices, slice q from q·60° to (q+1)·60° past the ring's yaw (the angle from +z toward
   +x, as the bake lays them). Each is fitted to 5 points on its rim and 3 at 0.55 R. A ring is round, so it is laid at the turn of
   0°, 10°, ... 50° whose slices meet the most rim points, read every 5°: a slice's edge then falls where the ground breaks. yaw, when
   given, is the one turn to lay it at (radians): the boss's sweeps show the three slices in front of its facing.
   -> the six slices, with .yaw */
export function fitRing(walk, cx, cz, R, y0, water, yaw = null) {
  const g = (x, z) => [x, groundAt(walk, x, z, y0, water), z];
  const rad = d => (d * Math.PI) / 180;
  let best = null;
  for (const turn of Number.isFinite(yaw) ? [(yaw * 180) / Math.PI] : [0, 10, 20, 30, 40, 50]) {
    let score = 0;
    const slices = Array.from({ length: 6 }, (_, q) => {
      const pts = [];
      for (let k = 0; k <= 4; k++) { const a = rad(turn + q * 60 + k * 15); pts.push(g(cx + Math.sin(a) * R, cz + Math.cos(a) * R)); }
      for (const k of [1, 2, 3]) { const a = rad(turn + q * 60 + k * 15); pts.push(g(cx + Math.sin(a) * R * 0.55, cz + Math.cos(a) * R * 0.55)); }
      const p = piece(pts, cx, cz);
      for (let k = 0; k < 12; k++) {
        const a = rad(turn + q * 60 + k * 5 + 2.5), [x, y, z] = g(cx + Math.sin(a) * R, cz + Math.cos(a) * R);
        if (Math.abs(y - heightOn(p, cx, cz, x, z)) <= NEAR) score++;
      }
      return p;
    });
    if (!best || score > best.score) best = { score, slices, yaw: rad(turn) };
  }
  best.slices.yaw = best.yaw;
  return best.slices;
}
/* a lane from (x0, z0) along yaw, width w, in n pieces of length L (the far ones shorter, or not out yet, while it grows to len):
   each piece is fitted to its two edges at 5 points and its middle at 3. -> [{ x, z, y, tilt, k }] with (x, z) the middle of its
   near end, and k its length as a share of a whole piece (0 when it is not out yet) */
export function fitLane(walk, x0, z0, yaw, len, w, L, n, y0, water) {
  const ux = Math.sin(yaw), uz = Math.cos(yaw), rx = uz, rz = -ux;
  const g = (x, z) => [x, groundAt(walk, x, z, y0, water), z];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * L, k = clamp((len - a) / L, 0, 1), px = x0 + ux * a, pz = z0 + uz * a;
    if (k <= 0) { out.push({ x: px, z: pz, y: y0, tilt: [0, 0], k: 0 }); continue; }
    const pts = [], l = L * k;
    for (let j = 0; j <= 4; j++) for (const s of [-1, 1]) { const t = a + (l * j) / 4; pts.push(g(x0 + ux * t + rx * s * w * 0.5, z0 + uz * t + rz * s * w * 0.5)); }
    for (const j of [1, 2, 3]) { const t = a + (l * j) / 4; pts.push(g(x0 + ux * t, z0 + uz * t)); }
    out.push({ x: px, z: pz, ...piece(pts, px, pz), k });
  }
  return out;
}
// how far a ring's rim is from the ground under the slices laid on it, at 36 points between the points the fit used: the test's measure
export function ringResiduals(walk, cx, cz, R, y0, water, slices = fitRing(walk, cx, cz, R, y0, water)) {
  const res = [];
  for (let k = 0; k < 36; k++) {
    const a = (slices.yaw || 0) + ((k + 0.5) * 10 * Math.PI) / 180, p = slices[Math.min(5, Math.floor((k + 0.5) / 6))];
    const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R;
    res.push(Math.abs(groundAt(walk, x, z, y0, water) - heightOn(p, cx, cz, x, z)));
  }
  return res;
}
// the same for a lane: 7 points along each edge of each piece that is out
export function laneResiduals(walk, x0, z0, yaw, len, w, L, n, y0, water, pieces = fitLane(walk, x0, z0, yaw, len, w, L, n, y0, water)) {
  const ux = Math.sin(yaw), uz = Math.cos(yaw), rx = uz, rz = -ux, res = [];
  pieces.forEach((p, i) => {
    if (!p.k) return;
    for (let j = 0; j < 7; j++) for (const s of [-1, 1]) {
      const t = i * L + (L * p.k * (j + 0.5)) / 7, x = x0 + ux * t + rx * s * w * 0.5, z = z0 + uz * t + rz * s * w * 0.5;
      res.push(Math.abs(groundAt(walk, x, z, y0, water) - heightOn(p, p.x, p.z, x, z)));
    }
  });
  return res;
}
