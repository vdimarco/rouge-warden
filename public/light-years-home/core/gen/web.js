// Light Years Home: the cosmic web, made from a seed. This is the Voronoi kinematic model of van de Weygaert
// ("Voronoi Tessellations and the Cosmic Web", arXiv:0707.2877). Voids are Voronoi cells. Each galaxy streams
// straight out from the centre of its void. When it reaches a wall it stops crossing it and slides inside it; at an
// edge (a filament) it slides along the edge; at a vertex (a cluster) it stops. Known clusters get dense knots at
// their real positions, filled by galaxies that reached a vertex, and a vertex is put on each so filaments run in.
// Units: Mly, in whatever frame the caller's centre and cluster positions use (the game uses heliocentric galactic
// Cartesian). Pure and deterministic per seed. Any prefix of the output is a fair sample of the whole, so a lower
// quality tier can draw the first n points of a bigger set and see the same web.
import { mulberry32, hashSeed } from '../rng.js';

export const WEB_COUNTS = { high: 40000, mid: 16000, low: 8000 };
export const STAGES = ['void', 'wall', 'filament', 'cluster'];
export const WEB_FRACTIONS = [0.18, 0.27, 0.25, 0.30];   // target mix in STAGES order; growth sets the cluster share

const MAX_NUCLEI = 4000;    // cap on void cells, so a tiny cell size cannot stall the page
const FIRST_WALLS = 40;     // walls kept per cell at first; a walk that needs farther ones lengthens the list
const SAMPLE = 2000;        // galaxies in the pre-pass that picks the growth factor
const WIDTH = [0.05, 0.026, 0.018, 0.022];   // Gaussian scatter per stage, as a share of the cell size
// Typical colour temperature per stage, K. Galaxies in clusters are mostly red ellipticals, galaxies in voids mostly
// blue star-forming spirals and dwarfs (the morphology-density relation, Dressler 1980, ApJ 236:351).
const TEMP = [7000, 6000, 5500, 4600];
const KNOT_TEMP = 4400, GIANT_TEMP = 4500;
const KNOT_MIN = 0.012;     // every known cluster gets at least this share of all points
const KNOT_EXTRA = 0.04;    // shared among the known clusters by the square root of their member counts
const KNOT_MAX = 0.27;      // cap on all knots together, so the web keeps some clusters of its own
const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const vec3 = (v) => Array.isArray(v) && v.length >= 3 && finite(v[0]) && finite(v[1]) && finite(v[2]);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// Normal deviates from uniform draws (Box-Muller; each pair of draws gives 2 deviates).
export function gaussFrom(rnd) {
  let spare = 0, has = false;
  return () => {
    if (has) { has = false; return spare; }
    const r = Math.sqrt(-2 * Math.log(1 - rnd())), a = 2 * Math.PI * rnd();
    spare = r * Math.sin(a); has = true;
    return r * Math.cos(a);
  };
}

// A uniformly random rotation as a row-major 3×3 matrix (from a random unit quaternion, Shoemake 1992).
export function randomRotation(rnd) {
  const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  const x = a * Math.sin(u2), y = a * Math.cos(u2), z = b * Math.sin(u3), w = b * Math.cos(u3);
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}

// Galaxies for the cosmic web layer.
//   seed      any number or string
//   count     points to make (default WEB_COUNTS[tier])
//   centre    [x, y, z] Mly, middle of the box the galaxies start in
//   box       edge in Mly, or [x, y, z] edges
//   cells     about how many void cells fill the box (sets the cell size); or give cell (Mly) directly. The cost
//             grows with the cell count; the default 80 is what the timing check covers (at most 4,000 are made)
//   clusters  [{ pos: [x, y, z] Mly, radius Mly, members, giants?, clumps?, share?, anchor? }]: dense knots.
//             giants: bright warm galaxies at the heart; clumps: sub-clumps for a lumpy cluster;
//             share: this knot's share of all points (else from members); anchor: false puts no vertex on it.
//             A knot goes where its cluster is, inside the box or not; a basin as big as Laniakea is not a knot
//   voids     [{ pos, radius }]: a void cell is centred here and kept at least this wide
//   growth    how far galaxies stream, in units of their start distance from the void centre; 'auto' picks it so
//             the cluster share comes out at WEB_FRACTIONS[3]
// Returns { count, positions (Float32Array xyz, Mly), stage (Uint8Array, STAGES index), temperature (Float32Array,
// K), flux (Float32Array, relative brightness, about 1), knot (Int16Array, index into clusters or -1), growth, cells,
// cell }.
export function cosmicWeb({
  seed = 1, count, tier = 'high', centre = [0, 0, 0], box = 1000, cells = 80, cell,
  clusters = [], voids = [], growth = 'auto',
} = {}) {
  const n = Math.max(0, Math.floor(finite(count) ? count : WEB_COUNTS[tier] ?? WEB_COUNTS.high));
  const c0 = vec3(centre) ? centre : [0, 0, 0];
  const raw = Array.isArray(box) ? box : [box, box, box];
  const size = [0, 1, 2].map((a) => (finite(raw[a]) && raw[a] > 0 ? raw[a] : 1000));
  const lo = [c0[0] - size[0] / 2, c0[1] - size[1] / 2, c0[2] - size[2] / 2];
  const pick = finite(cell) && cell > 0 ? cell
    : Math.cbrt((size[0] * size[1] * size[2]) / (finite(cells) && cells >= 1 ? cells : 80));
  const known = (Array.isArray(clusters) ? clusters : [])
    .filter((k) => k && vec3(k.pos))
    .map((k) => ({ ...k, radius: finite(k.radius) && k.radius > 0 ? k.radius : 0.02 * pick }));
  const holes = (Array.isArray(voids) ? voids : []).filter((v) => v && vec3(v.pos) && finite(v.radius) && v.radius > 0);

  // ---------- void centres (Voronoi nuclei) ----------
  // They fill the box plus one cell on every side, so the cells that hold galaxies are closed.
  const vol = (s) => (size[0] + 2 * s) * (size[1] + 2 * s) * (size[2] + 2 * s);
  let cellSize = pick;
  while (vol(cellSize) / cellSize ** 3 > MAX_NUCLEI) cellSize *= 1.05;
  const plo = [lo[0] - cellSize, lo[1] - cellSize, lo[2] - cellSize];
  const span = [size[0] + 2 * cellSize, size[1] + 2 * cellSize, size[2] + 2 * cellSize];
  const rn = mulberry32(hashSeed(seed, 'web', 'nuclei'));
  const pts = [];
  const total = Math.max(4, Math.round(vol(cellSize) / cellSize ** 3));
  for (let i = 0; i < total; i++) {
    pts.push({ p: [plo[0] + rn() * span[0], plo[1] + rn() * span[1], plo[2] + rn() * span[2]], fixed: false });
  }
  const clear = (p, r) => {
    for (let i = pts.length - 1; i >= 0; i--) if (!pts[i].fixed && dist2(pts[i].p, p) < r * r) pts.splice(i, 1);
  };
  // A void the caller names: one nucleus at its centre and none closer than twice its radius.
  for (const v of holes) {
    clear(v.pos, 2 * v.radius);
    pts.push({ p: [v.pos[0], v.pos[1], v.pos[2]], fixed: true });
  }
  // A known cluster becomes a vertex: 4 nuclei on a randomly turned tetrahedron around it, and none closer.
  const ra = mulberry32(hashSeed(seed, 'web', 'anchors'));
  const rT = 0.6 * cellSize, anchored = [];
  const members = (k) => (finite(k.members) ? k.members : 0);
  const order = known.map((k, i) => i).sort((a, b) => members(known[b]) - members(known[a]) || a - b);
  for (const i of order) {
    const k = known[i];
    if (k.anchor === false) continue;
    const inside = k.pos.every((c, a) => a > 2 || (c > plo[a] && c < plo[a] + span[a]));
    if (!inside || anchored.some((p) => dist2(p, k.pos) < (2 * rT) ** 2)) continue;
    if (holes.some((v) => dist2(v.pos, k.pos) < (2 * v.radius + rT) ** 2)) continue;
    anchored.push(k.pos);
    clear(k.pos, rT);
    const m = randomRotation(ra), s = rT / Math.sqrt(3);
    for (const t of TETRA) {
      const x = t[0] * s, y = t[1] * s, z = t[2] * s;
      pts.push({
        p: [
          k.pos[0] + m[0] * x + m[1] * y + m[2] * z,
          k.pos[1] + m[3] * x + m[4] * y + m[5] * z,
          k.pos[2] + m[6] * x + m[7] * y + m[8] * z,
        ],
        fixed: true,
      });
    }
  }
  const M = pts.length;
  const N = new Float64Array(M * 3);
  pts.forEach((q, i) => { N[i * 3] = q.p[0]; N[i * 3 + 1] = q.p[1]; N[i * 3 + 2] = q.p[2]; });

  // ---------- a grid over the nuclei ----------
  const gd = span.map((s) => Math.max(1, Math.ceil((2 * s) / cellSize)));
  const gs = span.map((s, a) => s / gd[a]);
  const gIndex = (p, a) => Math.min(gd[a] - 1, Math.max(0, Math.floor((p - plo[a]) / gs[a])));
  const start = new Int32Array(gd[0] * gd[1] * gd[2] + 1), items = new Int32Array(M);
  const home = new Int32Array(M);
  for (let i = 0; i < M; i++) {
    home[i] = (gIndex(N[i * 3 + 2], 2) * gd[1] + gIndex(N[i * 3 + 1], 1)) * gd[0] + gIndex(N[i * 3], 0);
    start[home[i] + 1]++;
  }
  for (let g = 0; g < start.length - 1; g++) start[g + 1] += start[g];
  const fill = start.slice(0, -1);
  for (let i = 0; i < M; i++) items[fill[home[i]]++] = i;
  const gMin = Math.min(gs[0], gs[1], gs[2]), rings = Math.max(gd[0], gd[1], gd[2]);
  // Calls fn(i) for every nucleus in the grid boxes exactly k steps (Chebyshev) from box (ix, iy, iz). Anything
  // outside rings 0..k is at least k grid steps from every point of the middle box.
  function ring(ix, iy, iz, k, fn) {
    for (let dz = -k; dz <= k; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= gd[2]) continue;
      for (let dy = -k; dy <= k; dy++) {
        const cy = iy + dy;
        if (cy < 0 || cy >= gd[1]) continue;
        const edge = Math.abs(dz) === k || Math.abs(dy) === k;
        for (let dx = -k; dx <= k; dx += edge ? 1 : 2 * k || 1) {
          const cx = ix + dx;
          if (cx < 0 || cx >= gd[0]) continue;
          const g = (cz * gd[1] + cy) * gd[0] + cx;
          for (let t = start[g]; t < start[g + 1]; t++) fn(items[t]);
        }
      }
    }
  }

  // ---------- each cell's walls, nearest first ----------
  // Made on first use. A walk that runs out of walls before it can prove it found the first one in its way asks for
  // a longer list, so the cells are exact (the intersection of all half-spaces), not a nearest-k guess.
  // wallTab[c] holds 4 numbers per wall: the unit normal from c toward the other centre, then the wall's distance.
  const wallTab = new Array(M), wallLen = new Array(M);
  const d2 = new Float64Array(M);
  function walls(c, want) {
    const have = wallLen[c] || 0;
    const L = Math.min(M - 1, Math.max(want, 2 * have, FIRST_WALLS));
    if (L <= have) return;
    const x = N[c * 3], y = N[c * 3 + 1], z = N[c * 3 + 2];
    const ix = gIndex(x, 0), iy = gIndex(y, 1), iz = gIndex(z, 2);
    const found = [];
    let cut = Infinity;
    for (let k = 0; k <= rings; k++) {               // grow rings until the L nearest are certain
      ring(ix, iy, iz, k, (j) => {
        if (j === c) return;
        d2[j] = (N[j * 3] - x) ** 2 + (N[j * 3 + 1] - y) ** 2 + (N[j * 3 + 2] - z) ** 2;
        found.push(j);
      });
      if (found.length >= L) {
        cut = Float64Array.from(found, (j) => d2[j]).sort()[L - 1];
        if (cut <= (k * gMin) ** 2) break;
      }
    }
    const near = found.filter((j) => d2[j] <= cut).sort((a, b) => d2[a] - d2[b] || a - b);
    const u = new Float64Array(near.length * 4);
    near.forEach((j, k) => {
      const l = Math.sqrt(d2[j]);
      u[k * 4] = (N[j * 3] - x) / l;
      u[k * 4 + 1] = (N[j * 3 + 1] - y) / l;
      u[k * 4 + 2] = (N[j * 3 + 2] - z) / l;
      u[k * 4 + 3] = l / 2;                           // the wall is the plane halfway between the 2 centres
    });
    wallTab[c] = u; wallLen[c] = near.length;
  }

  // ---------- the nearest-centre lookup ----------
  // Each grid box keeps the short list of nuclei that can be nearest to some point inside it, made on first use.
  const lists = new Array(gd[0] * gd[1] * gd[2]);
  function candidates(ix, iy, iz) {
    const b0 = [plo[0] + ix * gs[0], plo[1] + iy * gs[1], plo[2] + iz * gs[2]];
    const found = [], minD = [];
    let cap = Infinity;                                 // the smallest farthest-corner distance², over found nuclei
    for (let k = 0; k <= rings; k++) {
      ring(ix, iy, iz, k, (i) => {
        let near = 0, far = 0;
        for (let a = 0; a < 3; a++) {
          const p = N[i * 3 + a], l = b0[a], h = l + gs[a];
          near += p < l ? (l - p) ** 2 : p > h ? (p - h) ** 2 : 0;
          far += Math.max((p - l) ** 2, (p - h) ** 2);
        }
        found.push(i); minD.push(near);
        if (far < cap) cap = far;
      });
      if (cap <= (k * gMin) ** 2) break;               // a nucleus beyond ring k is farther than every point's nearest
    }
    return Int32Array.from(found.filter((i, j) => minD[j] <= cap));
  }
  function nearest(x, y, z) {
    const ix = gIndex(x, 0), iy = gIndex(y, 1), iz = gIndex(z, 2);
    const g = (iz * gd[1] + iy) * gd[0] + ix;
    const list = lists[g] || (lists[g] = candidates(ix, iy, iz));
    let bestD = Infinity, bestI = list[0];
    for (let t = 0; t < list.length; t++) {
      const i = list[t];
      const dd = (N[i * 3] - x) ** 2 + (N[i * 3 + 1] - y) ** 2 + (N[i * 3 + 2] - z) ** 2;
      if (dd < bestD) { bestD = dd; bestI = i; }
    }
    return bestI;
  }

  // ---------- the kinematic walk ----------
  // Walks galaxy (x, y, z) out from its void centre with a path budget, in units of its start distance (Infinity: all
  // the way to the vertex). Leaves the result in W: stage, offset from the centre, path length used, nucleus.
  const W = { stage: 0, x: 0, y: 0, z: 0, path: 0, c: 0, r: 0 };
  function walk(x, y, z, budgetFactor) {
    const c = nearest(x, y, z);
    let dx = x - N[c * 3], dy = y - N[c * 3 + 1], dz = z - N[c * 3 + 2];
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    W.c = c; W.r = r; W.stage = 0; W.path = 0; W.x = 0; W.y = 0; W.z = 0;
    if (r < 1e-12 || M < 2) return;
    dx /= r; dy /= r; dz /= r;
    if (!wallLen[c]) walls(c, FIRST_WALLS);
    let U = wallTab[c], HL = wallLen[c];
    let budget = r * budgetFactor, qx = 0, qy = 0, qz = 0, w0 = -1, w1 = -1;
    for (let s = 0; s < 3; s++) {
      // Look for the first wall within the budget. A wall at distance h from the centre can only be met at a point
      // x with |x| ≥ h, and every point on the way to the best hit so far is within lim of the centre. Walls come
      // nearest first, so once h > lim no later wall can be in the way.
      let hit = budget, hs = -1;
      const qn = Math.sqrt(qx * qx + qy * qy + qz * qz);
      let lim = Number.isFinite(hit)
        ? Math.max(qn, Math.sqrt((qx + dx * hit) ** 2 + (qy + dy * hit) ** 2 + (qz + dz * hit) ** 2)) : Infinity;
      for (let k = 0; ; k++) {
        if (k === HL) {
          if (HL >= M - 1) break;
          walls(c, 2 * HL);
          U = wallTab[c]; HL = wallLen[c];
        }
        const hk = U[k * 4 + 3];
        if (hk > lim) break;
        if (k === w0 || k === w1) continue;
        const ux = U[k * 4], uy = U[k * 4 + 1], uz = U[k * 4 + 2];
        const den = dx * ux + dy * uy + dz * uz;
        if (den <= 1e-9) continue;
        const t = (hk - (qx * ux + qy * uy + qz * uz)) / den;
        if (t >= -1e-9 && t < hit) {
          hit = Math.max(0, t); hs = k;
          lim = Math.max(qn, Math.sqrt((qx + dx * hit) ** 2 + (qy + dy * hit) ** 2 + (qz + dz * hit) ** 2));
        }
      }
      if (hs < 0) {                                   // no wall within the budget: the galaxy stops on the way
        if (Number.isFinite(hit)) { qx += dx * hit; qy += dy * hit; qz += dz * hit; W.path += hit; }
        break;
      }
      qx += dx * hit; qy += dy * hit; qz += dz * hit; budget -= hit; W.path += hit; W.stage = s + 1;
      if (s === 2) break;                             // 3 walls meet: a vertex, and the galaxy stops
      if (s === 0) {                                  // slide inside the wall
        w0 = hs;
        const d = dx * U[hs * 4] + dy * U[hs * 4 + 1] + dz * U[hs * 4 + 2];
        dx -= d * U[hs * 4]; dy -= d * U[hs * 4 + 1]; dz -= d * U[hs * 4 + 2];
      } else {                                        // slide along the edge where the 2 walls meet
        w1 = hs;
        const a = w0 * 4, b = w1 * 4;
        const ex = U[a + 1] * U[b + 2] - U[a + 2] * U[b + 1];
        const ey = U[a + 2] * U[b] - U[a] * U[b + 2];
        const ez = U[a] * U[b + 1] - U[a + 1] * U[b];
        const sg = ex * dx + ey * dy + ez * dz < 0 ? -1 : 1;
        dx = ex * sg; dy = ey * sg; dz = ez * sg;
      }
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (l < 1e-9) break;
      dx /= l; dy /= l; dz /= l;
    }
    W.x = qx; W.y = qy; W.z = qz;
  }

  // ---------- knot shares ----------
  const roots = known.map((k) => Math.sqrt(Math.max(1, finite(k.members) ? k.members : 1)));
  const rootSum = roots.reduce((a, b) => a + b, 0) || 1;
  let shares = known.map((k, i) => (finite(k.share) && k.share >= 0 ? k.share
    : KNOT_MIN + KNOT_EXTRA * roots[i] / rootSum));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  if (shareSum > KNOT_MAX) shares = shares.map((s) => s * KNOT_MAX / shareSum);
  const knotTotal = Math.min(KNOT_MAX, shareSum);
  const cumulative = [];
  shares.reduce((acc, s) => { cumulative.push(acc + s); return acc + s; }, 0);

  // ---------- growth: from a pre-pass on a fixed sample, so it does not depend on count ----------
  // A galaxy reaches its vertex when the growth is at least (path to the vertex) / (start distance), so the growth
  // that puts a share f of galaxies in clusters is the f-quantile of that ratio.
  let G = finite(growth) && growth > 0 ? growth : NaN;
  if (!Number.isFinite(G)) {
    const rs = mulberry32(hashSeed(seed, 'web', 'growth'));
    const g3 = new Float64Array(SAMPLE);
    for (let i = 0; i < SAMPLE; i++) {
      walk(lo[0] + rs() * size[0], lo[1] + rs() * size[1], lo[2] + rs() * size[2], Infinity);
      g3[i] = W.stage === 3 && W.r > 0 ? W.path / W.r : Infinity;
    }
    g3.sort();
    const q = g3[Math.floor(WEB_FRACTIONS[3] * SAMPLE)];
    G = Math.min(6, Math.max(0.5, Number.isFinite(q) ? q : 6));
  }

  // ---------- knot shapes ----------
  const knots = known.map((k, i) => {
    const rk = mulberry32(hashSeed(seed, 'web', 'knot', i));
    const gk = gaussFrom(rk);
    const clumps = Math.max(1, Math.min(64, Math.floor(finite(k.clumps) ? k.clumps : 1)));
    const centres = [];
    for (let j = 0; j < clumps; j++) {
      if (clumps === 1) { centres.push([0, 0, 0]); continue; }
      const v = [gk(), gk(), gk()], l = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) || 1;
      const rr = 0.75 * k.radius * Math.cbrt(rk());
      centres.push(v.map((c) => c / l * rr));
    }
    return { pos: k.pos, radius: k.radius, centres, sigma: 0.45 * k.radius / Math.cbrt(clumps) };
  });

  // ---------- the galaxies ----------
  const positions = new Float32Array(n * 3), stage = new Uint8Array(n);
  const temperature = new Float32Array(n), flux = new Float32Array(n), knot = new Int16Array(n).fill(-1);
  let i = 0;
  // Giants first, so every prefix keeps them.
  const rgi = mulberry32(hashSeed(seed, 'web', 'giants'));
  const gg = gaussFrom(rgi);
  known.forEach((k, j) => {
    const many = Math.max(0, Math.floor(finite(k.giants) ? k.giants : 0));
    for (let g = 0; g < many && i < n; g++, i++) {
      const s = 0.08 * k.radius;
      positions[i * 3] = k.pos[0] + gg() * s;
      positions[i * 3 + 1] = k.pos[1] + gg() * s;
      positions[i * 3 + 2] = k.pos[2] + gg() * s;
      stage[i] = 3; knot[i] = j; temperature[i] = GIANT_TEMP; flux[i] = 10 + 2 * rgi();
    }
  });
  const rnd = mulberry32(hashSeed(seed, 'web', 'galaxies'));
  const gauss = gaussFrom(rnd);
  // A galaxy that reaches a vertex lands in a known cluster's knot with probability knotTotal / (cluster share), so
  // the knots fill up from the web's own cluster galaxies and the stage mix stays as the model makes it.
  const toKnot = knotTotal / WEB_FRACTIONS[3];
  for (; i < n; i++) {
    walk(lo[0] + rnd() * size[0], lo[1] + rnd() * size[1], lo[2] + rnd() * size[2], G);
    if (W.stage === 3 && toKnot > 0) {
      const u = rnd() * knotTotal / toKnot;           // uniform in [0, cluster share); below knotTotal joins a knot
      if (u < knotTotal) {
        let j = 0;
        while (j < cumulative.length - 1 && u >= cumulative[j]) j++;
        const kn = knots[j], ctr = kn.centres[Math.floor(rnd() * kn.centres.length)];
        let ox, oy, oz;
        do {                                          // a Gaussian knot, cut off at twice the radius
          ox = ctr[0] + gauss() * kn.sigma; oy = ctr[1] + gauss() * kn.sigma; oz = ctr[2] + gauss() * kn.sigma;
        } while (ox * ox + oy * oy + oz * oz > 4 * kn.radius * kn.radius);
        positions[i * 3] = kn.pos[0] + ox; positions[i * 3 + 1] = kn.pos[1] + oy; positions[i * 3 + 2] = kn.pos[2] + oz;
        stage[i] = 3; knot[i] = j;
        temperature[i] = KNOT_TEMP * (0.9 + 0.2 * rnd());
        flux[i] = 1.2 * Math.exp(1.6 * (rnd() - 0.5));
        continue;
      }
    }
    const w = WIDTH[W.stage] * cellSize;
    positions[i * 3] = N[W.c * 3] + W.x + gauss() * w;
    positions[i * 3 + 1] = N[W.c * 3 + 1] + W.y + gauss() * w;
    positions[i * 3 + 2] = N[W.c * 3 + 2] + W.z + gauss() * w;
    stage[i] = W.stage;
    temperature[i] = TEMP[W.stage] * (0.85 + 0.3 * rnd());
    flux[i] = (W.stage === 3 ? 1.3 : 1) * Math.exp(1.6 * (rnd() - 0.5));
  }
  return { count: n, positions, stage, temperature, flux, knot, growth: G, cells: M, cell: cellSize };
}

// Share of points in each stage, in STAGES order.
export function stageFractions(stage) {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < stage.length; i++) counts[stage[i]]++;
  return counts.map((c) => (stage.length ? c / stage.length : 0));
}
