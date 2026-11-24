// Gloam Downs: the cutaway. In a nook under a roof (the Gaol's torn cell, a fallen bell) the follow camera keeps its eye TIGHT.dist back
// at the player's own yaw, behind the wall or over the roof (play.js makeCamera, "the cutaway"), and the place's splats that stand
// between that eye and the lamplighter are left out: a cone round the line from the figure's middle to the eye, CUT.near wide at the
// figure and CUT.far wide at the eye, from CUT.from out from the figure to CUT.past behind the eye. Each splat eases out over CUT.in s
// and back over CUT.out s, so a turn of the view moves the hole without a flicker. This is the cutaway of a dollhouse view (The Sims'
// walls-cutaway, Diablo's wall fade, Unreal's "camera occlusion fade" of the meshes between the camera and the player), done on the
// splats' densities as the near fade does to the figure (play.js makeFade). No DOM, so Node tests use it as it is.
export const CUT = { near: 0.7, far: 1.3, from: 0.35, past: 0.5, in: 0.15, out: 0.25, cell: 1, spread: 1.2, mid: 0.9 };

/* data, count: the place's splats as world.js loads them (16 floats each: x y z density, then the covariance); skip: [first, end) ranges
   never cut (the lamplighter's own splats, the wisps and the beacon's fire, which the page puts out and lights). Splats wider than
   CUT.spread (the sky) are never cut either, nor those in the set except (a run's veils, which veil.js fades). -> { step(eye, at, dt) -> rows changed, reset() -> rows, level(i), inside(i, eye, at) } */
export function makeCut(data, { count, skip = [], except = null } = {}) {
  const n = count ?? data.length / 16, C = CUT.cell, grid = new Map(), own = new Map(), lv = new Map(), rows = new Set();
  const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
  const skipped = i => skip.some(([a, b]) => i >= a && i < b);
  for (let i = 0; i < n; i++) {
    const o = i * 16;
    if (!(data[o + 3] > 0) || skipped(i) || except?.has(i)) continue;
    const sp = Math.sqrt(Math.max(data[o + 4], data[o + 8], data[o + 10]));
    if (sp > CUT.spread) continue;
    const k = key(Math.floor(data[o] / C), Math.floor(data[o + 1] / C), Math.floor(data[o + 2] / C));
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(i);
  }
  // is splat i in the cone from at (the figure's middle) to eye?
  function inside(i, eye, at) {
    const o = i * 16, ux = eye[0] - at[0], uy = eye[1] - at[1], uz = eye[2] - at[2], L = Math.hypot(ux, uy, uz) || 1;
    const px = data[o] - at[0], py = data[o + 1] - at[1], pz = data[o + 2] - at[2], s = (px * ux + py * uy + pz * uz) / L;
    if (s < CUT.from || s > L + CUT.past) return false;
    const r = CUT.near + (CUT.far - CUT.near) * Math.min(1, s / L), q = px * px + py * py + pz * pz - s * s;
    const sp = Math.sqrt(Math.max(data[o + 4], data[o + 8], data[o + 10]));
    return q < (r + Math.min(2 * sp, 0.3)) ** 2;
  }
  // the splats in the cone now
  function query(eye, at) {
    const out = [], R = CUT.far + 0.3;
    const lo = [0, 1, 2].map(a => Math.floor((Math.min(eye[a], at[a]) - R - CUT.past) / C)), hi = [0, 1, 2].map(a => Math.floor((Math.max(eye[a], at[a]) + R + CUT.past) / C));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      const a = grid.get(key(i, j, k));
      if (a) for (const s of a) if (inside(s, eye, at)) out.push(s);
    }
    return out;
  }
  // every indexed splat in the cells within r of the segment e..p (for checks)
  function around(e, p, r = 0.6) {
    const out = [], seen = new Set(), L = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]), n = Math.ceil(L / (C / 2));
    for (let t = 0; t <= n; t++) {
      const q = [0, 1, 2].map(a => e[a] + (p[a] - e[a]) * t / n);
      for (let i = Math.floor((q[0] - r) / C); i <= Math.floor((q[0] + r) / C); i++) for (let j = Math.floor((q[1] - r) / C); j <= Math.floor((q[1] + r) / C); j++)
        for (let k = Math.floor((q[2] - r) / C); k <= Math.floor((q[2] + r) / C); k++) {
          const kk = key(i, j, k);
          if (seen.has(kk)) continue;
          seen.add(kk);
          const a = grid.get(kk);
          if (a) for (const x of a) out.push(x);
        }
    }
    return out;
  }
  const put = (i, l) => {
    if (!own.has(i)) own.set(i, data[i * 16 + 3]);
    data[i * 16 + 3] = own.get(i) * (1 - l);
    rows.add(i >> 9);
    if (l <= 1e-6) { data[i * 16 + 3] = own.get(i); own.delete(i); lv.delete(i); } else lv.set(i, l);
  };
  /* one step: eye null when the camera does not cut. A splat in the cone eases out at 1/CUT.in a second, the others ease back at
     1/CUT.out; -> the 512-splat rows whose data changed */
  function step(eye, at, dt) {
    rows.clear();
    const now = eye ? new Set(query(eye, at)) : new Set();
    for (const i of now) { const l = lv.get(i) ?? 0; if (l < 1) put(i, Math.min(1, l + dt / CUT.in)); }
    for (const [i, l] of lv) if (!now.has(i)) put(i, Math.max(0, l - dt / CUT.out));
    return rows;
  }
  // every splat back as it was baked
  function reset() {
    rows.clear();
    for (const i of [...lv.keys()]) put(i, 0);
    return rows;
  }
  return { step, reset, inside, query, around, level: i => lv.get(i) ?? 0, get size() { return lv.size; } };
}

/* How much of a point p shows from an eye e through the place's splats (for checks): the splats near the line, each a round Gaussian of
   its widest spread at the point of the line nearest it, at its density now -> the share that shows, 0 to 1. Conservative: a flat
   splat seen edge on counts as wide as it is across. near: the line's last part (m) by p that is not counted (the figure's own floor) */
export function showing(data, grid, e, p, near = 0.25) {
  const ux = p[0] - e[0], uy = p[1] - e[1], uz = p[2] - e[2], L = Math.hypot(ux, uy, uz) || 1;
  let T = 1;
  for (const i of grid(e, p)) {
    const o = i * 16, a = data[o + 3];
    if (!(a > 0)) continue;
    const px = data[o] - e[0], py = data[o + 1] - e[1], pz = data[o + 2] - e[2], s = (px * ux + py * uy + pz * uz) / L;
    if (s < 0.05 || s > L - near) continue;
    const q = Math.max(0, px * px + py * py + pz * pz - s * s), v = Math.max(data[o + 4], data[o + 8], data[o + 10]);
    if (q > 9 * v) continue;
    T *= 1 - Math.min(0.99, a) * Math.exp(-0.5 * q / v);
    if (T < 1e-3) return 0;
  }
  return T;
}
