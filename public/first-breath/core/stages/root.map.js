// First Breath: stage 4's lining map (design.md 5.4 of first-breath-action-genres): a seeded grid of 12 × 12 tiles of
// 25 u round your nestle point (soft tissue, open fluid, firm tissue), cut in cells of 2.5 u so a tunnel can clear
// the cells it crosses (after the destructible-terrain bitmap of Worms and Dig Dug's tunnels; the renderer bakes each
// tile and bakes it again only when a tunnel crosses it). 8 pools: 3 in open fluid near the start (open fluid runs to
// them), 3 under soft tissue, 2 in a chamber walled with firm tissue; 14 knots on tile edges. Every pool can be reached:
// through soft tissue by tunnel, and the walled ones once strong roots dig firm tissue (a flood fill checks it, and
// the firm clusters go if one is shut in). The bot's path fields (Dijkstra on a 5 u grid, soft tissue 2.5×) are here
// too. Pure: every draw comes from stream(seed, ...).
import { stream } from "../rng.js";

export const OPEN = 0, SOFT = 1, FIRM = 2, TUNNEL = 3, DUG = 4, EDGE = 5;
const TAU = Math.PI * 2;
const hyp = Math.hypot;

// Smooth value noise on a lattice of `step` u (seeded): −1..1.
function noise2(seed, step) {
  const r = stream(seed, "liningNoise");
  const N = 48, v = new Float32Array(N * N);
  for (let i = 0; i < v.length; i++) v[i] = 2 * r() - 1;
  const at = (i, j) => v[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / step, fy = y / step, i = Math.floor(fx), j = Math.floor(fy), u = sm(fx - i), w = sm(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return a + (b - a) * w;
  };
}

// Distance from (px, py) to the segment (ax, ay)-(bx, by).
function segD(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
  return hyp(px - ax - vx * t, py - ay - vy * t);
}

// makeMap(seed, origin, TUNE) → the map: { ox, oy, n, cell, tiles, tileU, grid (Uint8Array n × n), ver (Uint16Array
// tiles²: a tile's bake version), gen, pools: [{ x, y, kind }], knots: [{ x, y }], origin }.
export function makeMap(seed, origin, T) {
  const M = T.map, P = T.pools, K = T.knots;
  const half = (M.tiles * M.tileU) / 2;
  const n = Math.round((M.tiles * M.tileU) / M.cellU);
  const map = {
    ox: origin.x - half, oy: origin.y - half, n, cell: M.cellU, tiles: M.tiles, tileU: M.tileU, per: n / M.tiles,
    grid: new Uint8Array(n * n), ver: new Uint16Array(M.tiles * M.tiles), gen: 1, pools: [], knots: [],
    origin: { x: origin.x, y: origin.y },
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    const sub = attempt ? `${seed}:${attempt}` : seed;
    if (build(map, sub, origin, T)) break;
  }
  map.knots = layKnots(map, seed, origin, T);
  return map;
}

// One try at a whole map. → false when the pools did not fit (a new sub-seed tries again).
function build(map, seed, origin, T) {
  const M = T.map, P = T.pools;
  const r = stream(seed, "lining");
  const half = (M.tiles * M.tileU) / 2;
  const lim = (m) => half - m;
  // ---- the pools, relative to the origin
  const pools = [];
  const corr = [];                                   // segments of open fluid to the open pools
  const okGap = (x, y, gap) => pools.every((q) => hyp(q.x - x, q.y - y) >= gap);
  const place = (kind, [d0, d1], margin, extra) => {
    for (let gap = P.gapU; gap >= 28; gap -= 4) {
      for (let tries = 0; tries < 300; tries++) {
        const a = r() * TAU, d = d0 + (d1 - d0) * r();
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        if (Math.abs(x) > lim(margin) || Math.abs(y) > lim(margin)) continue;
        if (!okGap(x, y, gap) || (extra && !extra(x, y))) continue;
        pools.push({ x, y, kind });
        return true;
      }
    }
    return false;
  };
  const apart = (x, y) => pools.filter((q) => q.kind === "open").every((q) => {
    const da = Math.atan2(y, x) - Math.atan2(q.y, q.x);
    return Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) >= 1.0;
  });
  for (let i = 0; i < 3; i++) if (!place("open", P.open, 20, apart)) return false;
  for (const q of pools) corr.push([0, 0, q.x, q.y]);
  const offCorr = (x, y, d) => corr.every(([ax, ay, bx, by]) => segD(x, y, ax, ay, bx, by) >= d);
  for (let i = 0; i < 3; i++) if (!place("soft", P.soft, 30, (x, y) => offCorr(x, y, M.sealR + 8))) return false;
  // a walled pool never sits in the bottom 40% of a portrait screen at the start (its guard spawns with a tell)
  for (let i = 0; i < 2; i++) {
    if (!place("firm", P.firm, M.wallOut + 4, (x, y) => offCorr(x, y, M.wallOut + 8) && (y >= -30 || Math.abs(x) >= 85))) return false;
  }

  // ---- tiles: soft, open (the start, the runs to the open pools, pockets) and firm clusters
  const NT = M.tiles, tu = M.tileU;
  const tiles = new Uint8Array(NT * NT).fill(SOFT);
  const tc = (i) => -half + (i + 0.5) * tu;         // a tile's centre, relative to the origin
  const ti = (v) => Math.max(0, Math.min(NT - 1, Math.floor((v + half) / tu)));
  const nearPool = (x, y, d, kinds) => pools.some((q) => kinds.includes(q.kind) && hyp(q.x - x, q.y - y) < d);
  for (let j = NT / 2 - 1; j <= NT / 2; j++) for (let i = NT / 2 - 1; i <= NT / 2; i++) tiles[j * NT + i] = OPEN;
  for (const [, , bx, by] of corr) {
    const L = hyp(bx, by);
    for (let s = 0; s <= L; s += 4) tiles[ti((by * s) / L) * NT + ti((bx * s) / L)] = OPEN;
  }
  let open = tiles.reduce((a, v) => a + (v === OPEN), 0);
  const want = Math.round(M.open * NT * NT);
  for (let tries = 0; open < want && tries < 4000; tries++) {
    const k = Math.floor(r() * NT * NT), i = k % NT, j = Math.floor(k / NT);
    if (tiles[k] !== SOFT || nearPool(tc(i), tc(j), M.sealR + 12, ["soft", "firm"])) continue;
    const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
      const ii = i + a, jj = j + b;
      return ii >= 0 && jj >= 0 && ii < NT && jj < NT && tiles[jj * NT + ii] === OPEN;
    });
    if (!adj && r() < 0.8) continue;                 // mostly grow what is open; now and then a new pocket
    tiles[k] = OPEN;
    open++;
  }
  // firm clusters: random walks away from the start and the pools (the walled pools' rings count toward the share)
  const ringTiles = 2 * (Math.PI * (M.wallOut ** 2 - M.wallIn ** 2)) / (tu * tu);
  let firm = 0;
  const wantF = Math.max(0, Math.round(M.firm * NT * NT - ringTiles));
  for (let c = 0; c < 8 && firm < wantF; c++) {
    let i = Math.floor(r() * NT), j = Math.floor(r() * NT);
    const len = 3 + Math.floor(r() * 4);
    for (let s = 0; s < len && firm < wantF; s++) {
      const k = j * NT + i, x = tc(i), y = tc(j);
      if (tiles[k] === SOFT && hyp(x, y) >= 45 && !nearPool(x, y, 34, ["open", "soft", "firm"]) && offCorr(x, y, 16)) {
        tiles[k] = FIRM;
        firm++;
      }
      const d = Math.floor(r() * 4);
      i = Math.max(0, Math.min(NT - 1, i + (d === 0 ? 1 : d === 1 ? -1 : 0)));
      j = Math.max(0, Math.min(NT - 1, j + (d === 2 ? 1 : d === 3 ? -1 : 0)));
    }
  }

  // ---- cells: each takes its (wandering) tile's kind; then the stamps
  const { n, cell } = map;
  const g = map.grid;
  const fixed = new Uint8Array(n * n);              // stamped firm (rings, the edge): never cleared by the check
  const nx = noise2(`${seed}`, 12), ny = noise2(`${seed}:y`, 12);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * cell, y = -half + (j + 0.5) * cell;
      const wx = x + M.warpU * nx(x, y), wy = y + M.warpU * ny(x, y);
      g[j * n + i] = tiles[ti(wy) * NT + ti(wx)];
    }
  }
  const stamp = (fn) => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * cell, y = -half + (j + 0.5) * cell;
      const v = fn(x, y, g[j * n + i]);
      if (v !== undefined && v !== null) { g[j * n + i] = v; if (v === FIRM || v === EDGE) fixed[j * n + i] = 1; else fixed[j * n + i] = 0; }
    }
  };
  stamp((x, y) => (hyp(x, y) <= M.startR ? OPEN : undefined));
  stamp((x, y) => (corr.some(([ax, ay, bx, by]) => segD(x, y, ax, ay, bx, by) <= M.corridorW / 2) ? OPEN : undefined));
  for (const q of pools) {
    if (q.kind === "open") stamp((x, y) => (hyp(x - q.x, y - q.y) <= M.openR ? OPEN : undefined));
    else if (q.kind === "soft") stamp((x, y) => (hyp(x - q.x, y - q.y) <= M.sealR ? SOFT : undefined));
    else stamp((x, y) => { const d = hyp(x - q.x, y - q.y); return d <= M.wallIn ? OPEN : d <= M.wallOut ? FIRM : undefined; });
  }
  const B = M.border;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (i < B || j < B || i >= n - B || j >= n - B) { g[j * n + i] = EDGE; fixed[j * n + i] = 1; }
  }

  // ---- every open and hidden pool reachable without digging firm tissue: else the firm clusters go
  const reach = () => {
    const seen = new Uint8Array(n * n), q = new Int32Array(n * n);
    const s0 = (n / 2) * n + n / 2;
    let h = 0, t = 0;
    q[t++] = s0; seen[s0] = 1;
    while (h < t) {
      const k = q[h++], i = k % n, j = (k - i) / n;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const kk = jj * n + ii;
        if (seen[kk] || g[kk] === FIRM || g[kk] === EDGE) continue;
        seen[kk] = 1; q[t++] = kk;
      }
    }
    return pools.every((p) => p.kind === "firm" || seen[Math.floor((p.y + half) / cell) * n + Math.floor((p.x + half) / cell)]);
  };
  if (!reach()) for (let k = 0; k < n * n; k++) if (g[k] === FIRM && !fixed[k]) g[k] = SOFT;
  map.pools = pools.map((q) => ({ x: origin.x + q.x, y: origin.y + q.y, kind: q.kind }));
  return true;
}

// 14 knots on tile edges (corners and edge midpoints): first one on the near side of each hidden pool and one outside
// each walled pool's ring, then the rest seeded, at least 30 u apart, never in firm tissue or in a pool.
function layKnots(map, seed, origin, T) {
  const K = T.knots, M = T.map;
  const r = stream(seed, "knots");
  const tu = map.tileU;
  const cand = [];
  for (let j = 0; j <= map.tiles * 2; j++) {
    for (let i = 0; i <= map.tiles * 2; i++) {
      if (i % 2 && j % 2) continue;                  // a tile's centre is no edge
      const x = map.ox + (i * tu) / 2, y = map.oy + (j * tu) / 2;
      if (x < map.ox + 10 || y < map.oy + 10 || x > map.ox + map.tiles * tu - 10 || y > map.oy + map.tiles * tu - 10) continue;
      // in fluid, or in tissue within 4 u of fluid (a tendril flies only through fluid, so a knot deep in tissue
      // would be no use until you dig to it)
      const v = cellAt(map, x, y);
      if (v === FIRM || v === EDGE) continue;
      if (v === SOFT && ![[4, 0], [-4, 0], [0, 4], [0, -4]].some(([a, b]) => cellAt(map, x + a, y + b) === OPEN)) continue;
      if (hyp(x - origin.x, y - origin.y) < 22) continue;
      const clear = map.pools.every((p) => hyp(p.x - x, p.y - y) >= (p.kind === "firm" ? M.wallOut + 6 : p.kind === "open" ? M.openR + 6 : T.pools.r + 8));
      if (clear) cand.push({ x, y });
    }
  }
  const out = [];
  const spaced = (c) => out.every((k) => hyp(k.x - c.x, k.y - c.y) >= K.gapU);
  for (const p of map.pools) {
    if (p.kind === "open") continue;
    const dp = hyp(p.x - origin.x, p.y - origin.y);
    let best = null, bs = Infinity;
    for (const c of cand) {
      const d = hyp(c.x - p.x, c.y - p.y);
      if (d < 28 || d > 58 || hyp(c.x - origin.x, c.y - origin.y) > dp || !spaced(c)) continue;
      const s = Math.abs(d - 42) + 4 * r();
      if (s < bs) { bs = s; best = c; }
    }
    if (best) out.push(best);
  }
  const rest = cand.slice();
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
  for (const c of rest) { if (out.length >= K.n) break; if (spaced(c)) out.push(c); }
  return out.map((c) => ({ x: c.x, y: c.y }));
}

// ---- reading and cutting the ground

// The cell index at (x, y), or −1 off the map.
export function cellIdx(map, x, y) {
  const i = Math.floor((x - map.ox) / map.cell), j = Math.floor((y - map.oy) / map.cell);
  if (i < 0 || j < 0 || i >= map.n || j >= map.n) return -1;
  return j * map.n + i;
}
// The ground at (x, y): off the map it is edge tissue.
export function cellAt(map, x, y) {
  const k = cellIdx(map, x, y);
  return k < 0 ? EDGE : map.grid[k];
}
// Does firm tissue (or the edge) keep a body of radius rad at (x, y) out? strong: firm tissue is dug, only the edge.
export function blocked(map, x, y, rad, strong) {
  const c = map.cell, n = map.n;
  const i0 = Math.floor((x - rad - map.ox) / c - 0.5), i1 = Math.floor((x + rad - map.ox) / c + 0.5);
  const j0 = Math.floor((y - rad - map.oy) / c - 0.5), j1 = Math.floor((y + rad - map.oy) / c + 0.5);
  const lim = rad + c * 0.5;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const v = i < 0 || j < 0 || i >= n || j >= n ? EDGE : map.grid[j * n + i];
      if (v === EDGE || (v === FIRM && !strong)) {
        const cx = map.ox + (i + 0.5) * c, cy = map.oy + (j + 0.5) * c;
        if (hyp(cx - x, cy - y) < lim) return true;
      }
    }
  }
  return false;
}
// Is there tissue to dig within rad of (x, y)? → 0 none, 1 soft, 2 firm (strong only).
export function digAhead(map, x, y, rad, strong) {
  const c = map.cell, n = map.n;
  const i0 = Math.floor((x - rad - map.ox) / c), i1 = Math.floor((x + rad - map.ox) / c);
  const j0 = Math.floor((y - rad - map.oy) / c), j1 = Math.floor((y + rad - map.oy) / c);
  let out = 0;
  for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) {
    for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
      const v = map.grid[j * n + i];
      if (v !== SOFT && !(strong && v === FIRM)) continue;
      const cx = map.ox + (i + 0.5) * c, cy = map.oy + (j + 0.5) * c;
      if (hyp(cx - x, cy - y) > rad) continue;
      if (v === FIRM) return 2;
      out = 1;
    }
  }
  return out;
}
// Cut the cells within rad of (x, y): soft → tunnel, and firm → dug when strong. Bumps the bake version of each tile
// the cut shows in (a tile bakes its neighbours' cells 2 deep). → { soft, firm } cells cut.
export function carve(map, x, y, rad, strong) {
  const c = map.cell, n = map.n, per = map.per, NT = map.tiles;
  const i0 = Math.max(0, Math.floor((x - rad - map.ox) / c)), i1 = Math.min(n - 1, Math.floor((x + rad - map.ox) / c));
  const j0 = Math.max(0, Math.floor((y - rad - map.oy) / c)), j1 = Math.min(n - 1, Math.floor((y + rad - map.oy) / c));
  let soft = 0, firm = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = j * n + i, v = map.grid[k];
      if (v !== SOFT && !(strong && v === FIRM)) continue;
      const cx = map.ox + (i + 0.5) * c, cy = map.oy + (j + 0.5) * c;
      if (hyp(cx - x, cy - y) > rad) continue;
      map.grid[k] = v === SOFT ? TUNNEL : DUG;
      if (v === SOFT) soft++; else firm++;
      const ta = Math.max(0, Math.floor((i - 2) / per)), tb = Math.min(NT - 1, Math.floor((i + 2) / per));
      const ua = Math.max(0, Math.floor((j - 2) / per)), ub = Math.min(NT - 1, Math.floor((j + 2) / per));
      for (let u = ua; u <= ub; u++) for (let t = ta; t <= tb; t++) map.ver[u * NT + t]++;
    }
  }
  if (soft || firm) map.gen++;
  return { soft, firm };
}
// March from (x, y) along (ux, uy) up to len: → the distance to the first firm (or edge) cell, or Infinity.
export function rayFirm(map, x, y, ux, uy, len, strong) {
  const step = map.cell * 0.5;
  for (let s = step; s <= len; s += step) {
    const v = cellAt(map, x + ux * s, y + uy * s);
    if (v === EDGE || (v === FIRM && !strong)) return s;
  }
  return Infinity;
}
// March from (x, y) along (ux, uy) up to len: → { d, firm } for the first tissue cell (soft, firm or edge: a tendril
// flies only through fluid and your tunnels, and sticks in tissue), or { d: Infinity }.
export function rayTissue(map, x, y, ux, uy, len) {
  const step = map.cell * 0.5;
  for (let s = step; s <= len; s += step) {
    const v = cellAt(map, x + ux * s, y + uy * s);
    if (v === SOFT || v === FIRM || v === EDGE) return { d: s, firm: v !== SOFT };
  }
  return { d: Infinity, firm: false };
}
// Is the ground at (x, y) open to a germ (open fluid, a tunnel or dug firm)?
export const fluid = (v) => v === OPEN || v === TUNNEL || v === DUG;

// ---- the bot's path fields

// fieldOf(map, pool, strong, T) → { g (cells per side), cell, ox, oy, d (Float32Array: path cost to the pool, in u of
// open fluid; Infinity where shut in) }. Dijkstra on a 5 u grid with 8 neighbours: soft tissue costs 2.5×, firm
// tissue is shut (3.4× with strong roots), the edge always shut.
export function fieldOf(map, pool, strong, T) {
  const B = T.bot, cu = B.cellU, g = Math.round((map.n * map.cell) / cu), k = Math.round(cu / map.cell);
  const cost = new Float32Array(g * g);
  // a cell is shut where your body cannot stand at its centre (firm tissue keeps you solidR plus half a cell off)
  const clear = T.you.solidR + 0.4;
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      let c = 1;
      if (blocked(map, map.ox + (i + 0.5) * cu, map.oy + (j + 0.5) * cu, clear, strong)) c = Infinity;
      else for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) {
        const v = map.grid[(j * k + b) * map.n + i * k + a];
        if (v === FIRM) c = Math.max(c, B.firmCost);
        else if (v === SOFT) c = Math.max(c, B.softCost);
      }
      cost[j * g + i] = c;
    }
  }
  const d = new Float64Array(g * g).fill(Infinity);    // float64: a rounded cost would expand a cell again and again
  // a binary heap of (cost, cell) in typed arrays; a cell may sit in it more than once (the stale entry is skipped)
  const cap = g * g * 8 + 16;
  const hk = new Float64Array(cap), hv = new Int32Array(cap);
  let hn = 0;
  const push = (c, i) => {
    let k2 = hn++;
    while (k2 > 0) { const p = (k2 - 1) >> 1; if (hk[p] <= c) break; hk[k2] = hk[p]; hv[k2] = hv[p]; k2 = p; }
    hk[k2] = c; hv[k2] = i;
  };
  let popK = 0;
  const pop = () => {                                 // → the cell; its cost in popK
    const top = hv[0];
    popK = hk[0];
    const c = hk[--hn], v = hv[hn];
    let k2 = 0;
    for (;;) {
      const a = 2 * k2 + 1;
      if (a >= hn) break;
      const m = a + 1 < hn && hk[a + 1] < hk[a] ? a + 1 : a;
      if (hk[m] >= c) break;
      hk[k2] = hk[m]; hv[k2] = hv[m]; k2 = m;
    }
    hk[k2] = c; hv[k2] = v;
    return top;
  };
  const r0 = T.pools.r;
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    const x = map.ox + (i + 0.5) * cu, y = map.oy + (j + 0.5) * cu;
    if (hyp(x - pool.x, y - pool.y) <= r0) { d[j * g + i] = 0; push(0, j * g + i); }
  }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (hn > 0) {
    const idx = pop(), c0 = popK;
    if (c0 > d[idx]) continue;
    const i = idx % g, j = (idx - i) / g;
    for (const [a, b, w] of NB) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= g || jj >= g) continue;
      const kk = jj * g + ii;
      const cc = cost[kk];
      if (!Number.isFinite(cc)) continue;
      if (a && b && (!Number.isFinite(cost[j * g + ii]) || !Number.isFinite(cost[jj * g + i]))) continue;   // no corner cuts
      const nd = c0 + w * cu * 0.5 * (cc + cost[idx]);
      if (nd < d[kk]) { d[kk] = nd; push(nd, kk); }
    }
  }
  return { g, cell: cu, ox: map.ox, oy: map.oy, d };
}
// The field's value at (x, y).
export function fieldAt(F, x, y) {
  const i = Math.floor((x - F.ox) / F.cell), j = Math.floor((y - F.oy) / F.cell);
  if (i < 0 || j < 0 || i >= F.g || j >= F.g) return Infinity;
  return F.d[j * F.g + i];
}
// A point `look` cells down the field from (x, y) (greedy descent), or null when shut in.
export function fieldStep(F, x, y, look) {
  let i = Math.floor((x - F.ox) / F.cell), j = Math.floor((y - F.oy) / F.cell);
  if (i < 0 || j < 0 || i >= F.g || j >= F.g) return null;
  for (let s = 0; s < look; s++) {
    let bi = i, bj = j, bd = F.d[j * F.g + i];
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const ii = i + a, jj = j + b;
      if ((!a && !b) || ii < 0 || jj < 0 || ii >= F.g || jj >= F.g) continue;
      const v = F.d[jj * F.g + ii];
      if (v < bd) { bd = v; bi = ii; bj = jj; }
    }
    if (bi === i && bj === j) break;
    i = bi; j = bj;
  }
  if (!Number.isFinite(F.d[j * F.g + i])) return null;
  return { x: F.ox + (i + 0.5) * F.cell, y: F.oy + (j + 0.5) * F.cell };
}
