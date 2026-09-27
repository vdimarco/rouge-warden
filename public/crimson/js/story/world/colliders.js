// js/story/world/colliders.js : everything solid in Sedona, in a 16 m spatial hash. Circles (trunks, rocks,
// posts), oriented boxes (buildings; walk:true boxes are floors and decks you stand on), segments (rails,
// fences, walls) and interior volumes (C3). resolveCircle pushes feet out, resolveOBB tells a vehicle how
// to get out, raycast finds the first thing between two points (for cameras and photo visibility).
// Heights: an item blocks only across its own y range (y0..y1, or y0..top for a box).
const CELL = 16;
const key = (i, j) => (i + 512) * 2048 + (j + 512);

export function createColliders() {
  const cells = new Map(), items = new Map(), vols = [];
  let seq = 0;
  function insert(it) {
    const i0 = Math.floor(it.minX / CELL), i1 = Math.floor(it.maxX / CELL), j0 = Math.floor(it.minZ / CELL), j1 = Math.floor(it.maxZ / CELL);
    it.cells = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(it); it.cells.push(k); }
    items.set(it.id, it);
    return it.id;
  }
  // every item whose cell lies within r of (x,z); each item once per call
  let stamp = 0;
  function near(x, z, r, fn) {
    stamp++;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = cells.get(key(i, j)); if (!l) continue;
      for (const it of l) { if (it.seen === stamp) continue; it.seen = stamp; if (fn(it) === false) return; }
    }
  }
  // a point in a box's frame
  const local = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; };
  const toWorld = (b, lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
  const vOverlap = (it, y0, y1) => y1 > it.y0 && y0 < it.y1;

  const C = {
    get count() { return items.size; },
    addCircle(x, z, r, o = {}) {
      return insert({ id: ++seq, kind: 'circle', x, z, r, y0: o.y0 ?? -Infinity, y1: o.y1 ?? Infinity, tag: o.tag || null, minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
    },
    // {x, z, w (along local x), d (along local z), yaw, y0, top, walk}
    addBox(o) {
      const yaw = o.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), hw = o.w / 2, hd = o.d / 2, ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
      return insert({ id: ++seq, kind: 'box', x: o.x, z: o.z, hw, hd, yaw, c, s, y0: o.y0 ?? -Infinity, y1: o.top ?? Infinity, top: o.top ?? Infinity, walk: !!o.walk, tag: o.tag || null, minX: o.x - ex, maxX: o.x + ex, minZ: o.z - ez, maxZ: o.z + ez });
    },
    addSegment(ax, az, bx, bz, o = {}) {
      const r = o.r ?? 0.15;
      return insert({ id: ++seq, kind: 'segment', ax, az, bx, bz, r, y0: o.y0 ?? -Infinity, y1: o.y1 ?? Infinity, tag: o.tag || null, minX: Math.min(ax, bx) - r, maxX: Math.max(ax, bx) + r, minZ: Math.min(az, bz) - r, maxZ: Math.max(az, bz) + r });
    },
    addVolume(o) { const v = { id: ++seq, kind: 'volume', ...o }; items.set(v.id, v); vols.push(v); return v.id; },
    inVolume(x, y, z) { for (const v of vols) if (x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1 && y >= v.y0 - 1 && y <= v.y1) return v; return null; },
    volumes: vols,
    remove(id) {
      const it = items.get(id); if (!it) return;
      items.delete(id);
      if (it.kind === 'volume') { vols.splice(vols.indexOf(it), 1); return; }
      for (const k of it.cells) { const l = cells.get(k); const i = l ? l.indexOf(it) : -1; if (i >= 0) l.splice(i, 1); }
    },
    removeTag(tag) { for (const it of [...items.values()]) if (it.tag === tag) C.remove(it.id); },
    query(x, z, r, cb) {
      near(x, z, r, (it) => {
        let d;
        if (it.kind === 'circle') d = Math.hypot(it.x - x, it.z - z) - it.r;
        else if (it.kind === 'box') { const [lx, lz] = local(it, x, z); d = Math.hypot(Math.max(Math.abs(lx) - it.hw, 0), Math.max(Math.abs(lz) - it.hd, 0)); }
        else d = segDist(it, x, z) - it.r;
        if (d <= r) return cb(it);
      });
    },
    // the highest walkable top at (x,z) at or below yMax (floors, decks, lots); null when none
    walkTop(x, z, yMax = Infinity) {
      let best = null;
      near(x, z, 0, (it) => {
        if (it.kind !== 'box' || !it.walk || it.top > yMax || (best != null && it.top <= best)) return;
        const [lx, lz] = local(it, x, z);
        if (Math.abs(lx) <= it.hw && Math.abs(lz) <= it.hd) best = it.top;
      });
      return best;
    },
    // push a circle of radius r (feet at yFeet, 1.8 m tall) out of everything it overlaps; p is changed
    resolveCircle(p, r, yFeet = -Infinity) {
      const y0 = yFeet + 0.35, y1 = yFeet + 1.8;
      let hit = false;
      for (let pass = 0; pass < 2; pass++) near(p.x, p.z, r + 2, (it) => {
        if (it.kind === 'volume') return;
        if (!vOverlap(it, y0, y1)) return;
        if (it.kind === 'circle') {
          const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz), m = r + it.r;
          if (d < m) { const k = d > 1e-6 ? (m - d) / d : 0; p.x += dx * k + (d > 1e-6 ? 0 : m); p.z += dz * k; hit = true; }
        } else if (it.kind === 'box') {
          if (it.walk && yFeet >= it.top - 0.4) return; // standing on it
          const [lx, lz] = local(it, p.x, p.z), qx = Math.abs(lx) - it.hw, qz = Math.abs(lz) - it.hd;
          if (qx >= r || qz >= r) return;
          if (qx > 0 && qz > 0) {
            const d = Math.hypot(qx, qz); if (d >= r) return;
            const k = (r - d) / d, nx = Math.sign(lx) * qx * k, nz = Math.sign(lz) * qz * k;
            const [wx, wz] = toWorld(it, lx + nx, lz + nz); p.x = wx; p.z = wz;
          } else if (qx > qz) { const [wx, wz] = toWorld(it, Math.sign(lx || 1) * (it.hw + r), lz); p.x = wx; p.z = wz; }
          else { const [wx, wz] = toWorld(it, lx, Math.sign(lz || 1) * (it.hd + r)); p.x = wx; p.z = wz; }
          hit = true;
        } else if (it.kind === 'segment') {
          const q = segClosest(it, p.x, p.z), dx = p.x - q[0], dz = p.z - q[1], d = Math.hypot(dx, dz), m = r + it.r;
          if (d < m && d > 1e-6) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); hit = true; }
        }
      });
      return hit;
    },
    // a vehicle footprint {x, z, hw, hd, yaw, y, h}: the deepest overlap as the way out {nx, nz, depth}
    resolveOBB(o) {
      const yaw = o.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), y0 = (o.y ?? -Infinity) + 0.3, y1 = (o.y ?? 0) + (o.h ?? 2);
      const ax = [[c, -s], [s, c]]; // the footprint's local x and z axes in world space
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [o.x + (u * o.hw) * c + (v * o.hd) * s, o.z - (u * o.hw) * s + (v * o.hd) * c]);
      let best = null;
      const take = (nx, nz, depth) => { if (depth > 0 && (!best || depth > best.depth)) best = { nx, nz, depth }; };
      const R = Math.hypot(o.hw, o.hd);
      near(o.x, o.z, R + 1, (it) => {
        if (it.kind === 'volume' || !vOverlap(it, y0, y1)) return;
        if (it.kind === 'box' && it.walk && (o.y ?? -Infinity) >= it.top - 0.5) return;
        if (it.kind === 'circle' || it.kind === 'segment') {
          // closest point of the footprint to the circle centre (or to the segment)
          const pts = it.kind === 'circle' ? [[it.x, it.z]] : [segClosestBox(it, o, c, s)];
          for (const [px, pz] of pts) {
            const dx = px - o.x, dz = pz - o.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
            const cx = Math.max(-o.hw, Math.min(o.hw, lx)), cz = Math.max(-o.hd, Math.min(o.hd, lz));
            const ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez), rr = it.r;
            if (d > 1e-6) { if (d < rr) { const wx = (ex * c + ez * s) / d, wz = (-ex * s + ez * c) / d; take(-wx, -wz, rr - d); } }
            else {
              // the centre is inside the footprint: out along the shallow axis
              const px2 = o.hw - Math.abs(lx), pz2 = o.hd - Math.abs(lz);
              if (px2 < pz2) { const sx = Math.sign(lx) || 1; take(-sx * c, sx * s, px2 + rr); } else { const sz = Math.sign(lz) || 1; take(-sz * s, -sz * c, pz2 + rr); }
            }
          }
        } else if (it.kind === 'box') {
          // separating axes: the two footprint axes and the two box axes
          const bc = [[it.c, -it.s], [it.s, it.c]], bcorn = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [it.x + u * it.hw * it.c + v * it.hd * it.s, it.z - u * it.hw * it.s + v * it.hd * it.c]);
          let min = Infinity, n = null;
          for (const a of [...ax, ...bc]) {
            const proj = (cs) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of cs) { const v = x * a[0] + z * a[1]; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
            const [a0, a1] = proj(corners), [b0, b1] = proj(bcorn), ov = Math.min(a1, b1) - Math.max(a0, b0);
            if (ov <= 0) return;
            // the way out is along the axis of least overlap, away from the box
            if (ov < min) { min = ov; const dir = (a0 + a1) / 2 < (b0 + b1) / 2 ? -1 : 1; n = [a[0] * dir, a[1] * dir]; }
          }
          if (n) take(n[0], n[1], min);
        }
      });
      return best;
    },
    // the first hit between a and b ({x,y,z}) among boxes, circles and segments: t in 0..1, or null
    raycast(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dz);
      let best = null;
      const steps = Math.max(1, Math.ceil(len / 4));
      stamp++;
      const seen = stamp;
      for (let k = 0; k <= steps; k++) {
        const t0 = k / steps, x = a.x + dx * t0, z = a.z + dz * t0;
        const l = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
        if (!l) continue;
        for (const it of l) {
          if (it.seen === seen) continue; it.seen = seen;
          let t = null;
          if (it.kind === 'box') t = rayBox(it, a, dx, dy, dz);
          else if (it.kind === 'circle') t = rayCircle(it, a, dx, dy, dz);
          else if (it.kind === 'segment') t = raySeg(it, a, dx, dy, dz);
          if (t != null && (best == null || t < best)) best = t;
        }
      }
      return best;
    },
  };
  return C;
}

function segClosest(s, x, z) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
  return [s.ax + dx * t, s.az + dz * t];
}
const segDist = (s, x, z) => { const q = segClosest(s, x, z); return Math.hypot(x - q[0], z - q[1]); };
// the point of a segment closest to a footprint (sampled along the segment)
function segClosestBox(s, o, c, sn) {
  let best = null, bd = Infinity;
  const n = Math.max(2, Math.ceil(Math.hypot(s.bx - s.ax, s.bz - s.az) / 0.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = s.ax + (s.bx - s.ax) * t, z = s.az + (s.bz - s.az) * t, dx = x - o.x, dz = z - o.z;
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c, d = Math.hypot(Math.max(Math.abs(lx) - o.hw, 0), Math.max(Math.abs(lz) - o.hd, 0));
    if (d < bd) { bd = d; best = [x, z]; }
  }
  return best;
}
// slab test in the box's frame, over its y range
function rayBox(b, a, dx, dy, dz) {
  const ox = a.x - b.x, oz = a.z - b.z, lx = ox * b.c - oz * b.s, lz = ox * b.s + oz * b.c, ldx = dx * b.c - dz * b.s, ldz = dx * b.s + dz * b.c;
  let t0 = 0, t1 = 1;
  const slab = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let u = (lo - o) / d, v = (hi - o) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); return t0 <= t1;
  };
  if (!slab(lx, ldx, -b.hw, b.hw) || !slab(lz, ldz, -b.hd, b.hd) || !slab(a.y, dy, b.y0 === -Infinity ? -1e6 : b.y0, b.top === Infinity ? 1e6 : b.top)) return null;
  return t0;
}
function rayCircle(c, a, dx, dy, dz) {
  const fx = a.x - c.x, fz = a.z - c.z, A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), Cc = fx * fx + fz * fz - c.r * c.r;
  if (Cc <= 0) return inY(c, a.y) ? 0 : null;
  if (A < 1e-9) return null;
  const disc = B * B - 4 * A * Cc; if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t < 0 || t > 1) return null;
  return inY(c, a.y + dy * t) ? t : null;
}
function raySeg(s, a, dx, dy, dz) {
  // treat the segment as a thin wall: intersect the ray's xz path with the segment line
  const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((s.ax - a.x) * ez - (s.az - a.z) * ex) / den, u = ((s.ax - a.x) * dz - (s.az - a.z) * dx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return inY(s, a.y + dy * t) ? t : null;
}
const inY = (it, y) => y >= it.y0 && y <= it.y1;
