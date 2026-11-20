// Gloam Downs: the spark pool. A port of Ink Studio's K.play.fx (siliconjungle/shapeshift-labs-ink-studio, src/kit/kg-play.js): a
// fixed block of bright short-lived splats at the end of the world's data, for sparks, flashes, rings and drops, here with the ember
// cracks of a zone that wakes and the glim motes. Each splat is a plain emissive dab that no outline takes (kind 0, flags em and nd),
// coloured from the place's palette, so the resolve snaps it like the rest. No DOM: write() fills the world's rows and says which
// 512-splat rows changed.
import { mulberry } from '../kit/rng.js';

const TAU = Math.PI * 2;
const KIND = 0 + 16 + 32; // plain, left out of outlines (nd), glows (em)
// over the walk map's floor: the places' ground splats stand up to about 0.1 m over it (the markers' lift, fight.js MARK_LIFT)
export const OVER = 0.14;
export const SPARK_SLOTS = { ember: 33, fire: 34, flame: 35, gold: 36, white: 37, lamp: 46, lampPale: 47 };

/* makeSparks(world, first, n, pal): splats first .. first + n of world.data are the pool (the pool.js reserve). glim is how many of
   them are kept for glim motes, which the page sets each frame with motes(); the rest take the bursts, oldest first */
export function makeSparks(world, first, n, pal, { glim = 64, seed = 9 } = {}) {
  const D = () => world.data;
  const PK = pal.map(c => ((c >> 16) & 255) + ((c >> 8) & 255) * 256 + (c & 255) * 65536);
  const N = n - glim, ps = Array.from({ length: N }, () => ({ life: 0 })), rnd0 = mulberry(seed);
  const rnd = (a, b) => a + (b - a) * rnd0();
  let next = 0, live = 0, dirty = true;
  const get = () => {
    for (let k = 0; k < N; k++) {
      const p = ps[(next + k) % N];
      if (p.life <= 0) { next = (next + k + 1) % N; return p; }
    }
    const p = ps[next];
    next = (next + 1) % N;
    return p;
  };
  const fresh = p => { live++; dirty = true; p.keep = false; p.grow = 0; return p; };
  const api = {
    total: n, first,
    // streaks thrown outward; (dx, dz) leans them one way
    sparks(x, y, z, ci, count, speed, dx, dz) {
      for (let i = 0; i < count; i++) {
        const p = fresh(get()), a = rnd(0, TAU), v = rnd(0.5, 1) * speed, k = dx === undefined ? 0 : 0.7;
        Object.assign(p, { type: 1, life: rnd(0.14, 0.3), p: [x, y, z], g: 9, s: rnd(0.035, 0.06), l: rnd(0.12, 0.26), col: PK[ci] });
        p.max = p.life;
        p.v = [(Math.cos(a) * (1 - k) + (dx || 0) * k) * v, rnd(-0.2, 0.9) * v * 0.6, (Math.sin(a) * (1 - k) + (dz || 0) * k) * v];
      }
    },
    // a round burst of light that is biggest at once and gone in a blink
    flash(x, y, z, ci, size, life = 0.12) {
      const p = fresh(get());
      Object.assign(p, { type: 0, life, max: life, p: [x, y, z], v: [0, 0, 0], g: 0, s: size, grow: -1, col: PK[ci] });
    },
    // grit thrown up, falling back
    drops(x, y, z, ci, count, speed, up = 3) {
      for (let i = 0; i < count; i++) {
        const p = fresh(get()), a = rnd(0, TAU), v = rnd(0.3, 1) * speed;
        Object.assign(p, { type: 0, life: rnd(0.3, 0.55), p: [x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1], g: 12, s: rnd(0.035, 0.06), grow: -0.5, col: PK[ci] });
        p.max = p.life;
        p.v = [Math.cos(a) * v, rnd(0.6, 1) * up, Math.sin(a) * v];
      }
    },
    // a ring spreading flat from a point: the shock of a landing, a slam, a coal or a pulse
    ring(x, y, z, ci, r0, r1, life, count, w = 0.035) {
      const ph = rnd(0, TAU);
      for (let i = 0; i < count; i++) {
        const p = fresh(get());
        Object.assign(p, { type: 2, life, max: life, p: [x, y, z], a: ph + (i / count) * TAU, r0, r1, n: count, s: w, col: PK[ci] });
      }
    },
    /* ember cracks where a foe will rise: count short strokes lying on the ground in a rough star round (x, z), in fire slots 34 and
       35, that flicker and fade over life seconds. ground(x, z) gives the floor there */
    cracks(x, y, z, ground, count = 24, life = 0.6) {
      for (let i = 0; i < count; i++) {
        const p = fresh(get()), a = (i / count) * TAU + rnd(-0.2, 0.2), r = rnd(0.12, 0.75), l = rnd(0.12, 0.22);
        const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, gy = ground(px, pz) ?? y;
        Object.assign(p, { type: 3, life, max: life, p: [px, gy + OVER, pz], a: a + rnd(-0.5, 0.5), s: rnd(0.03, 0.05), l, col: PK[i % 3 ? 34 : 35], ph: rnd(0, TAU), keep: true });
      }
    },
    clear() { for (const p of ps) p.life = 0; live = 0; dirty = true; },
    alive: () => ps.filter(p => p.life > 0).length,
    // one game step of the bursts
    update(dt) {
      if (!live && !dirty) return;
      live = 0;
      for (const p of ps) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life > 0) live++;
        if (p.type === 0 || p.type === 1) { p.v[1] -= p.g * dt; p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt; }
      }
      dirty = true;
    },
    /* write the pool into the world's data; motes are the glim motes as [{ x, y, z }], each a small lamp-coloured mote that glints.
       -> true when the rows changed */
    write(motes = [], time = 0) {
      const d = D();
      const was = api.moteCount || 0;
      if (!dirty && !motes.length && !was) return false;
      for (let i = 0; i < N; i++) put(d, (first + i) * 16, ps[i], time);
      for (let i = 0; i < glim; i++) {
        const o = (first + N + i) * 16, m = motes[i];
        if (!m) { park(d, o); continue; }
        const glint = 0.75 + 0.25 * Math.sin(time * 9 + i * 1.7), s = 0.055 * glint;
        d[o] = m.x; d[o + 1] = m.y; d[o + 2] = m.z; d[o + 3] = 3;
        d[o + 4] = d[o + 8] = d[o + 10] = s * s; d[o + 5] = d[o + 6] = d[o + 9] = 0;
        d[o + 7] = PK[i % 3 ? 46 : 47]; d[o + 11] = KIND; d[o + 12] = d[o + 13] = d[o + 14] = 0; d[o + 15] = -100;
      }
      api.moteCount = motes.length;
      dirty = false;
      return true;
    },
    // park every splat of the pool for one draw (a picture with no foes); the next write() puts them back
    hide() { const d = D(); for (let i = 0; i < n; i++) park(d, (first + i) * 16); dirty = true; api.moteCount = n; },
    // the 512-splat rows of the pool
    rows: () => { const r = []; for (let k = first >> 9; k <= (first + n - 1) >> 9; k++) r.push(k); return r; }
  };
  const park = (d, o) => { d[o] = 0; d[o + 1] = -50; d[o + 2] = 0; d[o + 3] = 0; d[o + 11] = KIND; d[o + 15] = -100; };
  function put(d, o, p, time) {
    if (p.life <= 0) { park(d, o); return; }
    const u = Math.min(1, 1 - p.life / p.max);
    d[o + 3] = 3; d[o + 7] = p.col; d[o + 11] = KIND; d[o + 12] = d[o + 13] = d[o + 14] = 0; d[o + 15] = -100;
    if (p.type === 2) {
      const e = 1 - (1 - u) * (1 - u), r = p.r0 + (p.r1 - p.r0) * e, c = Math.cos(p.a), s = Math.sin(p.a);
      const w = p.s * (1 - u * 0.85), l = Math.max(w, ((r * TAU) / p.n) * 0.36), q = l * l - w * w;
      d[o] = p.p[0] + c * r; d[o + 1] = p.p[1]; d[o + 2] = p.p[2] + s * r;
      d[o + 4] = w * w + q * s * s; d[o + 5] = 0; d[o + 6] = -q * s * c; d[o + 8] = w * w * 0.3; d[o + 9] = 0; d[o + 10] = w * w + q * c * c;
      return;
    }
    if (p.type === 3) {
      // a crack: a flat stroke along its angle, flickering, thinning as it fades
      const f = 0.55 + 0.45 * Math.abs(Math.sin(time * 23 + p.ph)), w = p.s * f * (1 - u * 0.6), l = p.l * (1 - u * 0.3), ax = Math.sin(p.a), az = Math.cos(p.a), q = l * l - w * w;
      d[o] = p.p[0]; d[o + 1] = p.p[1]; d[o + 2] = p.p[2];
      d[o + 4] = w * w + q * ax * ax; d[o + 5] = 0; d[o + 6] = q * ax * az; d[o + 8] = w * w * 0.2; d[o + 9] = 0; d[o + 10] = w * w + q * az * az;
      return;
    }
    d[o] = p.p[0]; d[o + 1] = p.p[1]; d[o + 2] = p.p[2];
    if (p.type === 0) {
      const s = p.s * (p.grow < -0.9 ? (1 - u) * (1 - u) : 1 - u * 0.8), v = s * s;
      d[o + 4] = v; d[o + 5] = 0; d[o + 6] = 0; d[o + 8] = v; d[o + 9] = 0; d[o + 10] = v;
      return;
    }
    const vl = Math.hypot(p.v[0], p.v[1], p.v[2]) || 1, ax = p.v[0] / vl, ay = p.v[1] / vl, az = p.v[2] / vl;
    const w = p.keep ? p.s : p.s * (1 - u), l = p.keep ? p.l : Math.max(w, p.l * (1 - u * 0.5)), q = l * l - w * w;
    d[o + 4] = w * w + q * ax * ax; d[o + 5] = q * ax * ay; d[o + 6] = q * ax * az; d[o + 8] = w * w + q * ay * ay; d[o + 9] = q * ay * az; d[o + 10] = w * w + q * az * az;
  }
  return api;
}
