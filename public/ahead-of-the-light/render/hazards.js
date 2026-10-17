// Ahead of the Light: every course item as points on the tube wall, in one pooled THREE.Points (sized: true, aTemp)
// refilled each frame from the race's course window (final.md 18.6, 22.2: one pooled buffer, a partial update
// range). Knots are galaxies (a soft blob and a few satellites), walls are rings of galaxies with gaps, rails are
// filaments along the course (a big half makes a sheet, the Great Wall), gates are two giants (or a mid-leg pair),
// wells are bright galaxies with a crowd of members, pulses swell on the beat, pickups are small warm glows, and dust
// fog is a faint brown haze. Inside the dust, and for the dark run-out knots, a hazard is a dim silhouette until
// SILHOUETTE seconds out (the overlay outlines it in orange). Items the director dropped are skipped. Ported from
// lab A's view.js hazards.
import * as THREE from 'three';
import { createPointMaterial, createPoints } from '../../light-years-home/render/points.js';
import { TUNE } from '../core/tune.js';
import { DEG } from '../core/ringmath.js';
import { psiAt, halfAt, railOn, inArcs, wellCore } from '../core/course/kinds.js';
import { isDropped } from '../core/course/director.js';

const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const Z_FAR = 11;              // tube radii: the course window reaches 12 beats (10.3 radii) ahead
const Z_NEAR = -2.5;           // passed items sweep out past the ring and go

// Is a bearing at a beat inside any dust fog in the window?
export function inFog(race, psi, beat) {
  const items = race.leg.items;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind === 'fog' && beat >= it.beat && beat < it.end && inArcs(it.arcs, psi)) return true;
  }
  return false;
}

export function createHazards({ shared, cap = 3000, tune = TUNE } = {}) {
  const T = tune;
  const hp = new Float32Array(cap * 3), ht = new Float32Array(cap), hl = new Float32Array(cap),
    hs = new Float32Array(cap);
  // Sized blobs spread their light, so they need far more energy than a point; uExposure scales with f² so a blob
  // looks the same on every screen.
  const mat = createPointMaterial({ shared, falloff: 2, maxPx: 240, emax: 6000, cull: 0.02, exposure: 1, near: 0.3,
    sized: true });
  const points = createPoints({ positions: hp, temperature: ht, lum: hl, size: hs, material: mat });
  for (const k of ['position', 'aTemp', 'aLum', 'aSize']) points.geometry.attributes[k].setUsage(THREE.DynamicDrawUsage);
  points.renderOrder = 4;
  points.frustumCulled = false;
  let n = 0, cam = 0;

  const put = (x, y, z, T0, L0, S0) => {
    if (n >= cap) return;
    hp[n * 3] = x; hp[n * 3 + 1] = y; hp[n * 3 + 2] = z; ht[n] = T0; hl[n] = L0; hs[n] = S0; n++;
  };
  // A point on the tube wall at bearing deg (world), depth z (tube radii ahead), radius rho (1: the wall).
  const at = (deg, z, T0, L0, S0, rho = 1) => {
    const a = (deg - cam) * DEG;
    put(Math.sin(a) * rho, -Math.cos(a) * rho, -z, T0, L0, S0);
  };

  // A galaxy knot: one soft blob and three faint satellites.
  function knot(psi, half, z, Tk, L0, seedH, dim) {
    at(psi, z, Tk, dim ? 1.2 : L0, half * DEG * 1.3);
    for (let k = 0; k < 3; k++) {
      at(psi + (hash01(seedH + k) - 0.5) * half * 2.6, z + (hash01(seedH + 7 + k) - 0.5) * 0.3, Tk - 1500,
        dim ? 0.05 : 3, 0);
    }
  }

  // fill(race, view, { exposure }): the window's items as points, seen from your ship.
  function fill(race, view, { exposure = 1 } = {}) {
    n = 0;
    cam = view.cam;
    mat.uniforms.uExposure.value = exposure;
    const you = race.ships[0];
    const dist = you.dist, bps = Math.max(1e-6, view.bps);
    const items = race.leg.items;
    let fog = false;
    for (let k = race.win.lo; k < race.win.hi; k++) if (items[k].kind === 'fog') { fog = true; break; }
    for (let k = race.win.lo; k < race.win.hi && n < cap; k++) {
      const it = items[k];
      if (it.kind === 'cue' || isDropped(race, it)) continue;
      const z = (it.beat - dist) * T.BEAT_R;
      if (z > Z_FAR) continue;
      const ttp = (it.beat - dist) / bps;
      const seedH = (typeof it.id === 'number' ? it.id : k) * 13.7;
      const Tk = 7000 + 3000 * hash01(seedH);
      const hidden = (it.dark && ttp > T.SILHOUETTE)
        || (fog && ttp > T.SILHOUETTE && it.kind !== 'rail' && it.kind !== 'fog' && inFog(race, it.psi, it.beat));
      switch (it.kind) {
        case 'knot': {
          if (z < Z_NEAR) break;
          knot(it.psi, it.half, z, Tk, it.bait ? 320 : 240, seedH, hidden);
          break;
        }
        case 'pulse': {
          if (z < Z_NEAR) break;
          // it swells on the beat: its size now, so the tick's largest size reads ahead
          const h = Math.max(0.6, halfAt(it, dist));
          knot(it.psi, h, z, Tk + 2000, 260, seedH, hidden);
          break;
        }
        case 'wall': {
          if (z < Z_NEAR) break;
          const step = 3.2;
          for (let a = -180; a < 180; a += step) {
            const jit = (hash01(seedH + a) - 0.5) * 1.6;
            const psi = a + jit;
            let open = false, edge = false;
            for (const g of it.gaps) {
              const d = Math.abs(((psi - g.psi + 540) % 360) - 180);
              if (d < g.w / 2) open = true;
              else if (d < g.w / 2 + step) edge = true;
            }
            if (open) continue;
            const dz = edge ? 0 : (hash01(seedH + 50 + a) - 0.5) * 0.18;
            at(psi, z + dz, Tk, hidden ? 0.4 : edge ? 110 : 9, edge ? 0.05 : 0.016);
          }
          break;
        }
        case 'gate': {
          if (z < Z_NEAR) break;
          const [hL, hR] = it.halves, g = it.gap / 2;
          const big = !it.pair;
          for (const sgn of [-1, 1]) {
            const half = sgn < 0 ? hL : hR;
            const c = it.psi + sgn * (g + half);
            if (big) {
              at(c, z, 5200, hidden ? 2 : 700, half * DEG * 1.25);
              for (let k = 0; k < 10; k++) {
                at(c + (hash01(seedH + sgn * k) - 0.5) * half * 2.4, z + (hash01(seedH + 30 + k * sgn) - 0.5) * 0.4,
                  5000, hidden ? 0.05 : 3, 0);
              }
            } else knot(c, half, z, Tk, 240, seedH + sgn, hidden);
          }
          break;
        }
        case 'rail': {
          const z1 = Math.min((it.end - dist) * T.BEAT_R, Z_FAR);
          if (z1 < Z_NEAR) break;
          const wide = it.half > 3;
          const dz = wide ? 0.3 : 0.16;
          const across = wide ? Math.max(1, Math.round((2 * it.half) / 6)) : 1;
          for (let zz = Math.max(z, Z_NEAR); zz <= z1 && n < cap; zz += dz) {
            const beat = dist + zz / T.BEAT_R;
            if (!railOn(it, beat)) continue;
            const c = psiAt(it, beat);
            const q = Math.round(zz / dz);
            for (let j = 0; j < across; j++) {
              const u = across === 1 ? 0 : (j + hash01(seedH + q * 7 + j)) / across - 0.5;
              const psi = c + u * 2 * it.half + (hash01(seedH + q * 3.1 + j) - 0.5) * (wide ? 3 : 1.2);
              const edge = wide && (j === 0 || j === across - 1);
              at(psi, zz + (hash01(seedH + q + j * 0.37) - 0.5) * dz, 6500, edge ? 9 : 6, wide ? 0.02 : 0.012);
            }
          }
          break;
        }
        case 'well': {
          if (z < Z_NEAR) break;
          const core = wellCore(it, T);
          // a bright galaxy: a warm core and a flattened crowd of members round it
          at(it.psi, z, 5600, hidden ? 3 : 520, core * DEG * 1.5);
          const m = it.size === 'landmark' ? 28 : it.size === 'large' ? 20 : 14;
          for (let j = 0; j < m; j++) {
            const r = core * (0.8 + 2.6 * hash01(seedH + j * 1.7));
            const a = hash01(seedH + j * 2.9) * Math.PI * 2;
            at(it.psi + Math.cos(a) * r, z + Math.sin(a) * r * DEG * 1.2, 4800 + 2500 * hash01(seedH + j),
              hidden ? 0.05 : 4 + 6 * hash01(seedH + j * 5.1), j % 4 === 0 ? 0.01 : 0);
          }
          break;
        }
        case 'pickup': {
          if (z < -0.3) break;
          // small warm glows; the overlay draws the diamond or the plus
          at(it.psi, z, it.type === 'patch' ? 9500 : 2100, it.type === 'patch' ? 5 : 6, 0);
          break;
        }
        case 'fog': {
          // a faint brown haze over the dust's arcs: rows anchored on the course, so it streams past
          const b0 = Math.max(it.beat, Math.floor((dist + Z_NEAR / T.BEAT_R) * 2) / 2);
          const b1 = Math.min(it.end, dist + Z_FAR / T.BEAT_R);
          for (let b = b0; b < b1 && n < cap; b += 0.5) {
            for (const [from, to] of it.arcs) {
              const span = to - from, m = Math.max(1, Math.round(span / 36));
              for (let j = 0; j < m; j++) {
                const u = hash01(seedH + b * 3.3 + j * 1.3 + from);
                at(from + u * span, (b + 0.5 * hash01(b * 1.9 + j) - dist) * T.BEAT_R, 2300, 1.4, 0.05,
                  1 + 0.25 * hash01(seedH + b + j * 4.1));
              }
            }
          }
          break;
        }
        default:
      }
    }
    const g = points.geometry;
    g.setDrawRange(0, n);
    for (const key of ['position', 'aTemp', 'aLum', 'aSize']) {
      const attr = g.attributes[key];
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, Math.max(1, n) * attr.itemSize);
      attr.needsUpdate = true;
    }
    return n;
  }

  return {
    points, fill, count: () => n, material: mat,
    dispose() { points.geometry.dispose(); mat.dispose(); },
  };
}
