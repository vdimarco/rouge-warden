// Gloam Downs: the parts every place shares. A place is built in four steps, in this order:
//   1. scenery: hills, terrain tiles, buildings and props (solids), lamps; then one bake
//   2. the walk map, read from the baked distance field (S.sdf) on a grid
//   3. what must not block the feet (water, hanging cloth), then the lamplighter, each with its own bake
//   4. what glows (flames, wisps, the beacon's fire, motes, the sky dome, the moon), then finish
// The page gets the splat rows, the walk map and a small JSON file; it never runs the toolkit.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ink = require('@shapeshift-labs/ink-studio');
export const lib = ink.load();
export const K = lib.KIT;
export const INK_VERSION = ink.version;

/* ---------------- palette ----------------
   48 colours at most (the WebGL resolve loops over 48). Index 0 is the background. A place names its own colours in slots 1..31;
   slots 32..47 are the same in every place, so the lamplighter, fire and wisps look the same everywhere. */
export const SHARED = [
  ['fire', [0x3a0f0c, 0x8a2814, 0xd2551c, 0xff9a32, 0xffd77a, 0xfff4cc]], // 32..37
  ['wisp', [0x2a6e6a, 0x8cf0cc, 0xeefff6]], // 38..40
  ['cloak', [0x1c0e14, 0x461a1e, 0x7a2a24]], // 41..43
  ['iron', [0x24222e, 0x5a5868]], // 44..45
  ['lamp', [0xffbe4a, 0xfff0b4]] // 46..47
];
export function palette(own) {
  const pal = [], at = {};
  const put = (name, cols) => {
    at[name] = [];
    for (const c of cols) { at[name].push(pal.length); pal.push(c); }
  };
  for (const [name, cols] of own) put(name, Array.isArray(cols) ? cols : [cols]);
  if (pal.length > 32) throw new Error(`a place may name 32 colours (slots 0..31), this one names ${pal.length}`);
  while (pal.length < 32) pal.push(pal[pal.length - 1]);
  for (const [name, cols] of SHARED) put(name, cols);
  if (pal.length !== 48) throw new Error('palette must be 48 colours');
  return { pal, at, ramp: name => { if (!at[name]) throw new Error('no colour named ' + name); return at[name]; } };
}

/* ---------------- hills ----------------
   Height = base + compact bumps h·(1−r²/R²)³ + sine swells + fBm (gain 0.5) of a warped point + taller hills far out,
   then flats (plateaus and terraces) and paths pressed in. After Inigo Quilez's fBm and domain-warping articles. */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const segDist = (x, z, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9,
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};
export const polyDist = (x, z, pts) => {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, pts[i], pts[i + 1]));
  return d;
};
export function hills(B, spec) {
  const { base = 0, bumps = [], swell, fbm, warp, far, flats = [], paths = [], pits = [] } = spec;
  const warpAt = (x, z) => {
    if (!warp) return [x, z];
    const f = warp.freq || 1 / 22;
    return [x + warp.amp * (B.fbm(x * f + 1.7, z * f + 9.2, 0.5, 2) - 0.5) * 2, z + warp.amp * (B.fbm(x * f + 5.2, z * f + 1.3, 0.5, 2) - 0.5) * 2];
  };
  const raw = (x0, z0) => {
    const [x, z] = warpAt(x0, z0);
    let y = base;
    for (const [bx, bz, R, H] of bumps) {
      const q = ((x - bx) ** 2 + (z - bz) ** 2) / (R * R);
      if (q < 1) y += H * (1 - q) ** 3;
    }
    if (swell) y += swell.amp * Math.sin(x * swell.fx + (swell.px || 0)) * Math.cos(z * swell.fz + (swell.pz || 0));
    if (fbm) y += fbm.amp * (B.fbm(x * fbm.freq + 3.1, z * fbm.freq + 7.7, 0.5, fbm.oct || 3) - 0.5) * 2;
    if (far) y += far.amp * smooth(far.start, far.end, Math.hypot(x0 - (far.cx || 0), z0 - (far.cz || 0))) * B.fbm(x * 0.03 + 9, z * 0.03 + 2, 0.5, 2);
    for (const [px, pz, R, depth] of pits) {
      const q = ((x0 - px) ** 2 + (z0 - pz) ** 2) / (R * R);
      if (q < 1) y -= depth * (1 - q) ** 2;
    }
    return y;
  };
  const shaped = (x, z) => {
    let y = raw(x, z);
    // a flat: { at: [x, z], r (flat radius), blend (width of the slope into it), y (its height) or lift (above the raw height at its centre), box: [hx, hz] }
    for (const f of flats) {
      const d = f.box ? Math.max(Math.abs(x - f.at[0]) - f.box[0], Math.abs(z - f.at[1]) - f.box[1], 0) : Math.max(0, Math.hypot(x - f.at[0], z - f.at[1]) - f.r);
      const k = 1 - smooth(0, f.blend || 2, d);
      if (k > 0) y += (f._y - y) * k;
    }
    for (const p of paths) {
      const d = polyDist(x, z, p.pts);
      if (d < p.w * 1.6) y -= (p.depth ?? 0.1) * (1 - smooth(p.w * 0.5, p.w * 1.5, d));
    }
    return y;
  };
  for (const f of flats) f._y = f.y ?? raw(f.at[0], f.at[1]) + (f.lift || 0);
  const box = spec.box || [-100, 100, -100, 100];
  const h = K.tab2(shaped, box, spec.cell || 0.25);
  h.pathDist = (x, z) => { let d = 1e9; for (const p of paths) d = Math.min(d, polyDist(x, z, p.pts) - p.w * 0.5); return d; };
  return h;
}

/* ---------------- terrain ----------------
   Bounded tiles on Ink Studio's staggered world lattice: a near square at fine spacing, then rings with a hole, coarser each time out
   (after geometry clipmaps). A tile clipped to its own rectangle keeps its own material; S.terrain's field is unbounded, and the first
   one added would own every point. */
export function tile(S, h, mat, { x0, x1, z0, z1, hole = 0, hc = [0, 0], res }) {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const y = h(x0 + (x1 - x0) * i / 24, z0 + (z1 - z0) * j / 24);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  lo -= 1; hi += 1;
  const plan = (x, z) => Math.max(x0 - x, x - x1, z0 - z, z - z1),
    inHole = (x, z) => hole > 0 && Math.max(Math.abs(x - hc[0]), Math.abs(z - hc[1])) < hole;
  return S.add({
    bc: [(x0 + x1) / 2, (lo + hi) / 2, (z0 + z1) / 2],
    br: Math.hypot((x1 - x0) / 2, (hi - lo) / 2, (z1 - z0) / 2),
    sd: (x, y, z) => {
      let d = Math.max((y - h(x, z)) * 0.7, plan(x, z));
      if (hole > 0) d = Math.max(d, hole - Math.max(Math.abs(x - hc[0]), Math.abs(z - hc[1])));
      return d;
    },
    sample(f) {
      const r = this.res, dz = r * 0.87;
      for (let j = Math.ceil(z0 / dz); j * dz < z1; j++) {
        const z = j * dz, off = (((j % 2) + 2) % 2) * r * 0.5;
        for (let i = Math.ceil((x0 - off) / r); i * r + off < x1; i++) {
          const x = i * r + off;
          if (!inHole(x, z)) f(x, h(x, z), z);
        }
      }
    }
  }, mat, { res });
}
// near: half size of the fine square; rings: [[half size, spacing, material?], ...]
export function terrain(S, h, mat, { near = 26, res = 0.24, rings = [[52, 0.5], [104, 1.0]], c = [0, 0] } = {}) {
  tile(S, h, mat, { x0: c[0] - near, x1: c[0] + near, z0: c[1] - near, z1: c[1] + near, res });
  let inner = near;
  for (const [half, r, m] of rings) {
    tile(S, h, m || { ...mat, fat: (mat.fat || 0.46) * 1.3 }, { x0: c[0] - half, x1: c[0] + half, z0: c[1] - half, z1: c[1] + half, hole: inner, hc: c, res: r });
    inner = half;
  }
}

/* ---------------- the walk map ----------------
   For each cell of a grid: the top surface (T), and where a gap of at least `clear` opens under it, the floor below the gap (G). A cell
   with no gap has G = T. Read from the scenery's own distance field after its bake, so what you see is what you stand on. */
export function walkMap(S, h, { x0, x1, z0, z1, step = 0.25, above = 10, clear = 1.8 }) {
  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const T = new Int16Array(nx * nz), G = new Int16Array(nx * nz);
  const cm = v => Math.max(-32000, Math.min(32000, Math.round(v * 100)));
  const sdf = S.sdf;
  let gaps = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step, hy = h(x, z), top = hy + above;
    let y = top, d = sdf(x, y, z), t;
    if (d <= 0) t = top; // solid all the way up: a tall wall or tower
    else {
      for (let k = 0; k < 200; k++) {
        if (d < 0.006) break;
        y -= Math.max(d * 0.9, 0.01);
        if (y < hy - 3) { y = hy; break; }
        d = sdf(x, y, z);
      }
      t = y;
    }
    let g = t;
    if (t > hy + clear * 0.5) {
      // walk down through what lies under the top: find its underside, then the next floor
      let yy = t - 0.05, inside = true, under = null;
      for (; yy > hy - 1; yy -= 0.05) {
        const dd = sdf(x, yy, z);
        if (inside && dd > 0.02) { inside = false; under = yy; }
        else if (!inside && dd < 0.006) break;
      }
      if (under !== null && under - yy >= clear) { g = Math.max(yy, hy - 0.2); gaps++; }
    }
    T[j * nx + i] = cm(t);
    G[j * nx + i] = cm(g);
  }
  return { x0, z0, step, nx, nz, T, G, gaps };
}

/* ---------------- the lamplighter ----------------
   A round hooded figure with a lantern, sculpted facing +z at REST (high above the map, so no shadow of the place falls on it).
   Seven bones: body, head, legL, legR, armL (the lantern arm), armR, shadow. Pivots are in the rest frame. */
export const REST = [0, 80, 0];
export const BONES = ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'shadow'];
export function lamplighter(S, P) {
  const [x0, y0, z0] = REST;
  const at = (x, y, z) => [x0 + x, y0 + y, z0 + z];
  const tag = (name, o) => ({ tag: name, ...o });
  const cloak = { r: P.ramp('cloak') }, iron = { r: P.ramp('iron') }, face = { r: [P.ramp('cloak')[0]] };
  const glow = { r: P.ramp('lamp'), em: true }, eye = { r: [P.ramp('lamp')[1]], em: true };
  // body: a bell of cloak, a rope belt, a rag down the back
  S.ball(at(0, 0.5, 0), [0.36, 0.42, 0.34], cloak, tag('body', { res: 0.045 }));
  S.ball(at(0, 0.24, 0), [0.4, 0.2, 0.38], cloak, tag('body', { res: 0.045 }));
  S.tube([at(-0.33, 0.52, 0.06), at(0, 0.48, 0.34), at(0.33, 0.52, 0.06)], 0.035, 0.035, iron, tag('body', { res: 0.03 }));
  S.box(at(0.12, 0.34, -0.34), [0.07, 0.18, 0.03], { r: [P.ramp('cloak')[1], P.ramp('cloak')[2]] }, tag('body', { res: 0.035, rd: 0.02 }));
  // head: a deep hood with a dark face and two lit eyes, its tip folded back
  S.ball(at(0, 1.0, 0), [0.27, 0.28, 0.27], cloak, tag('head', { res: 0.04 }));
  S.ball(at(0, 1.27, -0.12), [0.1, 0.14, 0.1], cloak, tag('head', { res: 0.035 }));
  S.ball(at(0, 0.97, 0.16), [0.17, 0.17, 0.1], face, tag('head', { res: 0.03 }));
  for (const s of [-1, 1]) S.ball(at(0.065 * s, 1.0, 0.245), 0.035, eye, tag('head', { res: 0.02 }));
  // legs: iron boots under the hem
  for (const s of [-1, 1]) S.ball(at(0.15 * s, 0.09, 0.04), [0.12, 0.1, 0.16], iron, tag(s < 0 ? 'legR' : 'legL', { res: 0.035 }));
  // arms: sleeves; the left hand holds the lantern out in front
  // the lantern hangs out to the side, so the camera behind sees its light
  S.ball(at(0.37, 0.62, 0.06), [0.11, 0.16, 0.11], cloak, tag('armL', { res: 0.035 }));
  // the lantern: a lit glass between an iron cap and base, with four thin corner bars
  S.ball(at(0.56, 0.35, 0.14), [0.1, 0.12, 0.1], glow, tag('armL', { res: 0.02 }));
  S.ball(at(0.56, 0.48, 0.14), [0.09, 0.035, 0.09], iron, tag('armL', { res: 0.02 }));
  S.box(at(0.56, 0.22, 0.14), [0.085, 0.025, 0.085], iron, tag('armL', { res: 0.02, rd: 0.01 }));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.tube([at(0.56 + dx * 0.085, 0.23, 0.14 + dz * 0.085), at(0.56 + dx * 0.075, 0.47, 0.14 + dz * 0.075)], 0.012, 0.012, iron, tag('armL', { res: 0.012 }));
  S.tube([at(0.56, 0.5, 0.14), at(0.47, 0.6, 0.1)], 0.018, 0.018, iron, tag('armL', { res: 0.015 }));
  // a satchel on the back and a coil of rope at the belt: something to read from behind
  S.box(at(0.0, 0.62, -0.33), [0.15, 0.14, 0.06], { r: [P.ramp('cloak')[0], P.ramp('iron')[0], P.ramp('iron')[1]] }, tag('body', { res: 0.035, rd: 0.05 }));
  S.torus?.(at(-0.24, 0.42, -0.18), 0.09, 0.03, { r: P.ramp('iron') }, tag('body', { res: 0.02, ax: [[1, 0, 0], [0, 0.3, 0.95], [0, -0.95, 0.3]] }));
  S.ball(at(-0.37, 0.62, 0), [0.11, 0.16, 0.11], cloak, tag('armR', { res: 0.035 }));
  return {
    rest: REST,
    pivots: {
      body: at(0, 0.1, 0), head: at(0, 0.82, 0), legL: at(0.15, 0.24, 0), legR: at(-0.15, 0.24, 0),
      armL: at(0.33, 0.72, 0.04), armR: at(-0.33, 0.72, 0), shadow: [x0, y0 + 40, z0]
    }
  };
}
// the round shadow: a flat dark disc under the feet, sculpted at its own rest place
export function shadowDisc(S, P, dark) {
  const [x0, y0, z0] = REST;
  S.ball([x0, y0 + 40, z0], [0.36, 0.015, 0.36], { r: [dark], em: true }, { tag: 'shadow', res: 0.05 });
}

/* ---------------- what glows ---------------- */
// a wisp: a few soft pale splats that bob together, and a faint halo
export function wisp(B, P, [x, y, z], ph = 0) {
  const n0 = B.count(), [w0, w1, w2] = P.ramp('wisp');
  const an = k => ({ em: true, nd: true, k: 6, ph, sp: 2.2, rg: 0.12 * k });
  B.iso(x, y, z, 0.16, B.P[w1], 3, an(1));
  B.iso(x, y + 0.02, z, 0.09, B.P[w2], 3, an(1));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.iso(x + Math.cos(a) * 0.2, y + Math.sin(a * 2) * 0.08, z + Math.sin(a) * 0.2, 0.05, B.P[i % 2 ? w1 : w0], 2.5, { em: true, nd: true, k: 6, ph: ph + i, sp: 3.1, rg: 0.08 });
  }
  B.iso(x, y, z, 0.55, B.P[w0], 0.22, { em: true, nd: true, k: 7, ph, sp: 4 });
  return [n0, B.count()];
}
// a fire: Ink Studio's flame, in the shared fire colours; s is its size
export function fire(B, P, [x, y, z], s = 1) {
  const n0 = B.count(), f = P.ramp('fire');
  lib.flame(B, x, y, z, s, [f[2], f[3], f[5]]);
  return [n0, B.count()];
}
// embers that rise from a fire
export function embers(B, P, [x, y, z], n = 8, spread = 0.4, height = 2.4) {
  const f = P.ramp('fire');
  for (let i = 0; i < n; i++)
    B.iso(x + B.rr(-spread, spread), y + B.rr(0, 0.3), z + B.rr(-spread, spread), 0.03, B.P[B.pick([f[3], f[4]])], 2.5,
      { em: true, nd: true, k: 3, ph: B.rr(0, 1), sp: B.rr(0.4, 0.9), rg: height, ex: 0.4 });
}
