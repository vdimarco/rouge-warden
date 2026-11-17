// Splat Isle's painter. An object is written as signed distance shapes (spheres, boxes, capsules, cones...), joined
// with a smooth minimum. The painter lays Gaussian splats on the zero surface of that field like brush strokes, each one
// flat along the surface, and bakes the light into its colour. Nothing here draws: the page hands the result to Spark.
// The distance functions, the smooth minimum, the soft shadow and the ambient occlusion follow Inigo Quilez's articles
// (iquilezles.org/articles/distfunctions, /smin, /rmshadows, and his "outdoors lighting" notes).
// Pure JavaScript with no imports, so node can test it: qa/lab/splat-isle.test.mjs.

export const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

// The primitives, each in its own frame: y is up, and the shape is centred on the origin.
export const PRIMS = {
  sphere: ([r]) => (x, y, z) => len3(x, y, z) - r,
  // An ellipsoid's true distance has no closed form; this is Quilez's bound, good near the surface.
  ellipsoid: ([a, b, c]) => (x, y, z) => { const k0 = len3(x / a, y / b, z / c), k1 = len3(x / (a * a), y / (b * b), z / (c * c)); return k1 > 0 ? k0 * (k0 - 1) / k1 : -Math.min(a, b, c); },
  box: ([bx, by, bz, round = 0]) => (x, y, z) => { const qx = Math.abs(x) - bx + round, qy = Math.abs(y) - by + round, qz = Math.abs(z) - bz + round; return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round; },
  capsule: ([h, r]) => (x, y, z) => len3(x, y - clamp(y, -h / 2, h / 2), z) - r,
  cylinder: ([h, r]) => (x, y, z) => { const dx = Math.hypot(x, z) - r, dy = Math.abs(y) - h / 2; return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)); },
  // A capped cone: radius r1 at the bottom, r2 at the top, height h.
  cone: ([h, r1, r2]) => (x, y, z) => {
    const hh = h / 2, qx = Math.hypot(x, z), qy = y, k1x = r2, k1y = hh, k2x = r2 - r1, k2y = 2 * hh;
    const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - hh;
    const t = clamp(((k1x - qx) * k2x + (k1y - qy) * k2y) / (k2x * k2x + k2y * k2y), 0, 1), cbx = qx - k1x + k2x * t, cby = qy - k1y + k2y * t;
    const s = cbx < 0 && cay < 0 ? -1 : 1; return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
  },
  torus: ([R, r]) => (x, y, z) => Math.hypot(Math.hypot(x, z) - R, y) - r,
};
// A bounding radius for each primitive, for the box the painter samples in.
const REACH = { sphere: ([r]) => r, ellipsoid: s => Math.max(...s), box: ([a, b, c]) => len3(a, b, c), capsule: ([h, r]) => h / 2 + r, cylinder: ([h, r]) => Math.hypot(h / 2, r), cone: ([h, a, b]) => Math.hypot(h / 2, Math.max(a, b)), torus: ([R, r]) => R + r };

// Quilez's polynomial smooth minimum: k is the width of the blend, in metres.
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// Rotation from Euler angles (x, then y, then z), as a 3x3 matrix in rows.
function rotation([rx = 0, ry = 0, rz = 0] = []) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz, cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz, -sy, sx * cy, cx * cy];
}
// A shape, ready to evaluate: { type, size, at, rot, k (blend into the shapes before it), cut, mat }.
export function prepare(shape) {
  const m = rotation(shape.rot), at = shape.at || [0, 0, 0], f = PRIMS[shape.type](shape.size);
  if (!f) throw new Error('unknown shape ' + shape.type);
  // the local point is the transpose of the rotation times (p - at)
  const local = (x, y, z) => { const dx = x - at[0], dy = y - at[1], dz = z - at[2]; return f(m[0] * dx + m[3] * dy + m[6] * dz, m[1] * dx + m[4] * dy + m[7] * dz, m[2] * dx + m[5] * dy + m[8] * dz); };
  return { ...shape, at, f: local, reach: REACH[shape.type](shape.size) };
}
// The distance to a part: its shapes joined in order, each with its own blend, and the cut shapes taken away.
export function field(shapes) {
  const add = shapes.filter(s => !s.cut), cut = shapes.filter(s => s.cut);
  return (x, y, z) => { let d = Infinity; for (const s of add) d = d === Infinity ? s.f(x, y, z) : smin(d, s.f(x, y, z), s.k || 0); for (const s of cut) d = Math.max(d, -s.f(x, y, z)); return d; };
}
export const gradient = (f, x, y, z, e = 0.004) => {
  const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), l = len3(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
};
export function bounds(shapes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const s of shapes) if (!s.cut) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], s.at[i] - s.reach); hi[i] = Math.max(hi[i], s.at[i] + s.reach); }
  return { lo, hi };
}

// Paint one part. Random points in the part's box are kept when they fall in a thin shell round the surface, so the
// kept points are spread evenly over the surface whatever its shape; each one is then pulled onto the surface along
// the gradient. density is splats per square metre. The result is flat arrays, one entry (or three, or four) per splat.
export function paint(part, { density = 400, rand = rng(1), shell = 0.05, size = 1, most = 6e6 } = {}) {
  const shapes = part.shapes.map(prepare), f = field(shapes), { lo, hi } = bounds(shapes), cuts = shapes.filter(s => s.cut), adds = shapes.filter(s => !s.cut);
  // a part can clip its box: the island's ground stops at the water line, so no strokes go under the sea
  if (part.clip) for (let i = 0; i < 3; i++) { if (part.clip.lo?.[i] != null) lo[i] = Math.max(lo[i], part.clip.lo[i]); if (part.clip.hi?.[i] != null) hi[i] = Math.min(hi[i], part.clip.hi[i]); }
  const vol = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), tries = Math.min(most, Math.ceil(vol * density / (2 * shell)));
  const out = { pos: [], nrm: [], mat: [] };
  for (let i = 0; i < tries; i++) {
    let x = lo[0] + rand() * (hi[0] - lo[0]), y = lo[1] + rand() * (hi[1] - lo[1]), z = lo[2] + rand() * (hi[2] - lo[2]), d = f(x, y, z);
    if (Math.abs(d) >= shell) continue;
    for (let k = 0; k < 3; k++) { const g = gradient(f, x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; d = f(x, y, z); }
    if (Math.abs(d) > shell * 0.1) continue;
    const n = gradient(f, x, y, z);
    // the shape that owns this point gives its material: a cut shape when the point is on its face
    let owner = null, best = Infinity; for (const s of cuts) { const e = Math.abs(s.f(x, y, z)); if (e < shell * 0.5 && e < best) { best = e; owner = s; } }
    if (!owner) for (const s of adds) { const e = s.f(x, y, z); if (e < best) { best = e; owner = s; } }
    out.pos.push(x, y, z); out.nrm.push(n[0], n[1], n[2]); out.mat.push(owner.mat || part.mat);
  }
  return strokes(out, part, density, rand, size);
}
// Paint a part that is a scatter of points, not a surface: points(rand) gives [x, y, z, nx, ny, nz, mat] lists.
export function scatter(part, { density = 400, rand = rng(1), size = 1 } = {}) {
  const out = { pos: [], nrm: [], mat: [] };
  for (const p of part.points(rand, density)) { out.pos.push(p[0], p[1], p[2]); out.nrm.push(p[3], p[4], p[5]); out.mat.push(p[6] || part.mat); }
  return strokes(out, part, density, rand, size);
}
// Shape each splat as a brush stroke: flat along the surface, longer one way than the other. The long way runs
// along the part's stroke direction (up, for grass and bark) or a random way. The material gives the albedo.
function strokes({ pos, nrm, mat }, part, density, rand, size) {
  const n = mat.length, sigma = (part.stroke?.size ?? 1) * size * 0.62 / Math.sqrt(part.density ? density * part.density : density);
  const P = new Float32Array(pos), N = new Float32Array(nrm), S = new Float32Array(n * 3), Q = new Float32Array(n * 4), C = new Float32Array(n * 3), A = new Float32Array(n), G = new Uint8Array(n);
  const along = part.stroke?.along, stretch = part.stroke?.stretch ?? 1.6;
  for (let i = 0; i < n; i++) {
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    // the long way: the stroke direction, or a random one, made flat on the surface
    let rx, ry, rz; if (along) [rx, ry, rz] = along; else { rx = rand() - 0.5; ry = rand() - 0.5; rz = rand() - 0.5; }
    const dot = rx * nx + ry * ny + rz * nz; let tx = rx - nx * dot, ty = ry - ny * dot, tz = rz - nz * dot, tl = len3(tx, ty, tz);
    if (tl < 1e-4) { tx = ny; ty = -nx; tz = 0; tl = len3(tx, ty, tz) || 1; if (tl < 1e-4) { tx = 1; ty = 0; tz = 0; tl = 1; } }
    tx /= tl; ty /= tl; tz /= tl; const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const s = sigma * (0.75 + 0.5 * rand());
    S.set([s * stretch, s * (2 - stretch * 0.6), s * 0.2], i * 3);
    Q.set(quaternion(tx, ty, tz, bx, by, bz, nx, ny, nz), i * 4);
    const m = mat[i], c = typeof m.paint === 'function' ? m.paint(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], nx, ny, nz, rand) : m.color, j = m.jitter ?? 0.06;
    C.set([clamp(c[0] + (rand() - 0.5) * j, 0, 1), clamp(c[1] + (rand() - 0.5) * j, 0, 1), clamp(c[2] + (rand() - 0.5) * j, 0, 1)], i * 3);
    A[i] = m.alpha ?? 0.92; G[i] = m.glow ? 1 : 0;
  }
  return { count: n, pos: P, nrm: N, scale: S, quat: Q, albedo: C, color: new Float32Array(C), alpha: A, glow: G };
}
// The rotation whose columns are the given axes, as a quaternion [x, y, z, w].
function quaternion(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const tr = ax + by + cz; let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (bz - cy) / s; y = (cx - az) / s; z = (ay - bx) / s; }
  else if (ax > by && ax > cz) { const s = Math.sqrt(1 + ax - by - cz) * 2; w = (bz - cy) / s; x = 0.25 * s; y = (bx + ay) / s; z = (cx + az) / s; }
  else if (by > cz) { const s = Math.sqrt(1 + by - ax - cz) * 2; w = (cx - az) / s; x = (bx + ay) / s; y = 0.25 * s; z = (cy + bz) / s; }
  else { const s = Math.sqrt(1 + cz - ax - by) * 2; w = (ay - bx) / s; x = (cx + az) / s; y = (cy + bz) / s; z = 0.25 * s; }
  return [x, y, z, w];
}

// A grid of distances over a box, read with trilinear blending: the scene's shadows and occlusion march through it,
// which is far quicker than evaluating every shape of the scene at every step. Outside the box it gives the distance
// to the box, so a march leaves it quickly.
export class Grid {
  constructor(lo, hi, cell, f) {
    this.lo = lo; this.cell = cell; this.n = [0, 1, 2].map(i => Math.max(2, Math.ceil((hi[i] - lo[i]) / cell) + 1)); this.hi = [0, 1, 2].map(i => lo[i] + (this.n[i] - 1) * cell);
    const [nx, ny, nz] = this.n; this.d = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) this.d[(k * ny + j) * nx + i] = f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  }
  at(x, y, z) {
    const { lo, hi, cell, n: [nx, ny, nz], d } = this;
    const ox = Math.max(lo[0] - x, x - hi[0], 0), oy = Math.max(lo[1] - y, y - hi[1], 0), oz = Math.max(lo[2] - z, z - hi[2], 0); if (ox || oy || oz) return len3(ox, oy, oz) + cell;
    const fx = Math.min((x - lo[0]) / cell, nx - 1.0001), fy = Math.min((y - lo[1]) / cell, ny - 1.0001), fz = Math.min((z - lo[2]) / cell, nz - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k, at = (a, b, c) => d[((k + c) * ny + j + b) * nx + i + a];
    const x00 = at(0, 0, 0) * (1 - u) + at(1, 0, 0) * u, x10 = at(0, 1, 0) * (1 - u) + at(1, 1, 0) * u, x01 = at(0, 0, 1) * (1 - u) + at(1, 0, 1) * u, x11 = at(0, 1, 1) * (1 - u) + at(1, 1, 1) * u;
    return (x00 * (1 - v) + x10 * v) * (1 - w) + (x01 * (1 - v) + x11 * v) * w;
  }
}
// Quilez's soft shadow: the march toward the sun keeps the closest pass of any surface, as a fraction of the way.
export function softShadow(sdf, x, y, z, lx, ly, lz, k = 10, far = 24) {
  let res = 1, t = 0.06;
  for (let i = 0; i < 48 && t < far; i++) { const h = sdf(x + lx * t, y + ly * t, z + lz * t); if (h < 0.002) return 0; res = Math.min(res, k * h / t); t += clamp(h, 0.04, 0.6); }
  return clamp(res, 0, 1);
}
// Ambient occlusion: how much of the space out along the normal is taken by nearby surfaces.
export function occlusion(sdf, x, y, z, nx, ny, nz) {
  let occ = 0, w = 1;
  for (let i = 1; i <= 5; i++) { const h = 0.07 * i; occ += (h - sdf(x + nx * h, y + ny * h, z + nz * h)) * w; w *= 0.6; }
  return clamp(1 - 2.2 * occ, 0, 1);
}
// Bake the light into each splat's colour: a warm low sun with a soft shadow, a blue sky from above, and a little bounce
// from the ground, all darkened by the occlusion. A glowing material keeps its own colour. at maps a splat's place to
// the world, for a part that sits away from the origin.
export function bake(splats, { sun = [0.55, 0.52, 0.65], sunColor = [1.25, 0.95, 0.68], sky = [0.32, 0.4, 0.62], bounce = [0.2, 0.14, 0.1], sdf = null, at = [0, 0, 0], shadows = true } = {}) {
  const l = len3(...sun), lx = sun[0] / l, ly = sun[1] / l, lz = sun[2] / l, { count, pos, nrm, albedo, color, glow } = splats;
  for (let i = 0; i < count; i++) {
    const a = albedo[i * 3], b = albedo[i * 3 + 1], c = albedo[i * 3 + 2];
    if (glow[i]) { color.set([a, b, c], i * 3); continue; }
    const x = pos[i * 3] + at[0], y = pos[i * 3 + 1] + at[1], z = pos[i * 3 + 2] + at[2], nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const lambert = Math.max(0, nx * lx + ny * ly + nz * lz), sh = sdf && shadows && lambert > 0 ? softShadow(sdf, x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, lx, ly, lz) : 1, ao = sdf ? occlusion(sdf, x, y, z, nx, ny, nz) : 1;
    const up = 0.5 + 0.5 * ny, down = 1 - up;
    for (let k = 0; k < 3; k++) color[i * 3 + k] = clamp([a, b, c][k] * (sunColor[k] * lambert * sh + (sky[k] * up + bounce[k] * down) * (0.35 + 0.65 * ao)), 0, 1);
  }
  return splats;
}
