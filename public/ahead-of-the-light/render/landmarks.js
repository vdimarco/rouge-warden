// Ahead of the Light: each leg's backdrop (final.md 18.6). A backdrop is the sky sphere for the region you cross (the
// cosmic web, a cluster's crowd, the Milky Way's band, the stars round the Sun) and the bodies you fly past on the
// way to the leg's gate: Coma's knot and its two giants, Virgo and M87 with its one-sided jet, Andromeda and
// Triangulum, the galactic bulge with dust lanes, the Orion Nebula, the Sun's neighbours, and Saturn with its rings,
// Jupiter, the Moon and Earth. Bodies sit at real depths along the route, so they loom, slide out past the ring as
// you pass them (aberration puts "beside you" on the ring) and redden behind. Everything is made from the shared
// generators (core/gen/web.js, galaxy.js, stars.js) and drawn with render/points.js' relativity. One backdrop lives at
// a time: scene.setBackdrop disposes the last. createBuilder builds one in idle slices during the break.
import * as THREE from 'three';
import { createGlowMaterial } from '../../light-years-home/render/points.js';
import { cosmicWeb, gaussFrom } from '../../light-years-home/core/gen/web.js';
import { galaxyParticles } from '../../light-years-home/core/gen/galaxy.js';
import { starField, openCluster } from '../../light-years-home/core/gen/stars.js';
import { mulberry32, hashSeed } from '../../light-years-home/core/rng.js';
import { DEG } from '../core/ringmath.js';
import { STOP, lyText } from '../core/route.js';
import { createFloorMaterial, createDarkMaterial, TIERS } from './scene.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const SKY_R = 1000;            // the sky sphere's radius (layer units); its points are directions
export const ROUTE_Z = 100;    // route units a leg flies; bodies sit at depths along it

// ---------- small builders ----------

// Growable typed arrays for one Points object.
function bag(n, { size = false, tint = false } = {}) {
  return { n: 0, cap: n, pos: new Float32Array(n * 3), temp: new Float32Array(n), lum: new Float32Array(n),
    size: size ? new Float32Array(n) : null, tint: tint ? new Float32Array(n * 3) : null };
}
function push(b, x, y, z, T, L, S = 0, tint = null) {
  if (b.n >= b.cap) return false;
  const i = b.n++;
  b.pos[i * 3] = x; b.pos[i * 3 + 1] = y; b.pos[i * 3 + 2] = z; b.temp[i] = T; b.lum[i] = L;
  if (b.size) b.size[i] = S;
  if (b.tint) {
    const t = tint || [1, 1, 1];
    b.tint[i * 3] = t[0]; b.tint[i * 3 + 1] = t[1]; b.tint[i * 3 + 2] = t[2];
  }
  return true;
}
function pointsOf(b, material, order = 0, sizeName = 'aSize') {
  const g = new THREE.BufferGeometry();
  const n = b.n;
  g.setAttribute('position', new THREE.BufferAttribute(b.pos.subarray(0, n * 3), 3));
  g.setAttribute('aTemp', new THREE.BufferAttribute(b.temp.subarray(0, n), 1));
  g.setAttribute('aLum', new THREE.BufferAttribute(b.lum.subarray(0, n), 1));
  if (b.size) g.setAttribute(sizeName, new THREE.BufferAttribute(b.size.subarray(0, n), 1));
  if (b.tint) g.setAttribute('aTint', new THREE.BufferAttribute(b.tint.subarray(0, n * 3), 3));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.renderOrder = order;
  return p;
}
// Even directions on the sphere, so there is sky behind you to redden (lab A's shell).
function shell(b, rnd, n, { t0 = 4500, t1 = 8000, l0 = 0.7, l1 = 2 } = {}) {
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    push(b, q * Math.cos(a) * SKY_R, q * Math.sin(a) * SKY_R, u * SKY_R, t0 + (t1 - t0) * rnd(), l0 + l1 * rnd() ** 3);
  }
}
// A point at distance d in direction (x, y, z) from the observer, pushed onto the sky sphere.
function dir(b, x, y, z, T, L) {
  const r = Math.hypot(x, y, z) || 1;
  return push(b, (x / r) * SKY_R, (y / r) * SKY_R, (z / r) * SKY_R, T, L);
}
// Rotate a point about x (tilt) then z (spin).
function orient(p, tilt, spin) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), cs = Math.cos(spin), ss = Math.sin(spin);
  const y1 = p[1] * ct - p[2] * st, z1 = p[1] * st + p[2] * ct;
  return [p[0] * cs - y1 * ss, p[0] * ss + y1 * cs, z1];
}
// A Plummer-like crowd of galaxies (a cluster) round (cx, cy, cz), radius rad (route units).
function crowd(b, rnd, n, { c, rad, core = 0.25, t0 = 4300, t1 = 7200, l0 = 0.5, l1 = 5, flat = 1 }) {
  const a = rad * core;
  const uMax = rad ** 3 / (rad * rad + a * a) ** 1.5;
  for (let i = 0; i < n; i++) {
    const u = Math.max(1e-9, rnd() * uMax);
    const r = a / Math.sqrt(u ** (-2 / 3) - 1);
    const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z);
    push(b, c[0] + r * s * Math.cos(t), c[1] + r * s * Math.sin(t) * flat, c[2] + r * z, t0 + (t1 - t0) * rnd(),
      l0 + l1 * rnd() ** 4);
  }
}
// A galaxy from galaxyParticles placed at c, radius rad (route units), tilted and spun; dust to a dark bag.
function galaxy(b, dark, { seed, type = 'spiral', n, rad, c, tilt = 0, spin = 0, opts = {}, lumK = 1, darkN = 0 }) {
  const g = galaxyParticles({ seed, type, count: n, radius: 50000, ...opts });
  const k = rad / 50000;
  for (let i = 0; i < g.count; i++) {
    const p = orient([g.positions[i * 3] * k, g.positions[i * 3 + 1] * k, g.positions[i * 3 + 2] * k], tilt, spin);
    push(b, c[0] + p[0], c[1] + p[1], c[2] + p[2], g.temperature[i], lumK * Math.min(3, g.flux[i]));
  }
  if (dark && darkN > 0 && g.dust) {
    const m = Math.min(darkN, g.dust.count);
    for (let i = 0; i < m; i++) {
      const p = orient([g.dust.positions[i * 3] * k, g.dust.positions[i * 3 + 1] * k, g.dust.positions[i * 3 + 2] * k],
        tilt, spin);
      push(dark, c[0] + p[0], c[1] + p[1], c[2] + p[2], 0, 0.55, Math.max(rad * 0.02, (g.dust.size[i] || 600) * k));
    }
  }
  return g.count;
}
// A planet as a lit hemisphere of points facing the way you come (+z): sun is the unit direction of its light.
function planet(b, rnd, n, { c, rad, sun = [0.6, 0.3, 0.75], temp = 5600, bands = null, tint = null, lumK = 1 }) {
  for (let i = 0; i < n; i++) {
    const u = rnd(), a = rnd() * Math.PI * 2;
    const zc = Math.sqrt(u), q = Math.sqrt(1 - zc * zc);           // cosine-weighted toward the viewer
    const nx = q * Math.cos(a), ny = q * Math.sin(a), nz = zc;
    const lit = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
    const lat = ny;
    const T = bands ? bands(lat) : temp;
    push(b, c[0] + nx * rad, c[1] + ny * rad, c[2] + nz * rad, T, lumK * (0.04 + 1.6 * lit ** 1.2), 0,
      typeof tint === 'function' ? tint(nx, ny, nz, rnd) : tint);
  }
}

// ---------- the leg backdrops ----------
// Each is a generator: it yields between pieces of work (so a build can run in idle slices) and returns
// { sky: bag, bodies: [{ id, name, c: [x, y, z], rad, label }], parts: [{ bag, kind }] }. c is a body's place at the
// leg's start: z negative ahead (a depth of −c[2] route units).

const nameOf = (id) => (STOP[id] ? STOP[id].name : id.toUpperCase());
const label = (id, text = null) => text || `${nameOf(id)} · ${lyText(STOP[id] ? STOP[id].ly : 0)}`;

// The cosmic web as directions, with the shell (lab A's sky).
// The web is centred on you, so the sky is even all round at rest and aberration alone gathers it ahead as you
// speed up. Most galaxies are faint and a few are bright (the video's black space and white points), and a galaxy
// close to you is brighter.
function webSky(b, seed, n, { clusters = [], centre = [0, 0, 0], box = 900, cells = 70, near = 160 } = {}) {
  const rnd = mulberry32(hashSeed(seed, 'aotl-shell'));
  const nShell = Math.round(n * 0.15);
  const web = cosmicWeb({ seed: hashSeed(seed, 'aotl-web'), count: n - nShell, centre, box, cells, clusters });
  for (let i = 0; i < web.count; i++) {
    const x = web.positions[i * 3], y = web.positions[i * 3 + 1], z = web.positions[i * 3 + 2];
    const r = Math.hypot(x, y, z) || 1;
    const f = Math.min(web.flux[i], 2.5);
    dir(b, x, y, z, web.temperature[i], 0.25 + 1.6 * (f / 2.5) ** 2 * clamp(near / r, 0.35, 1.6));
  }
  shell(b, rnd, nShell, { l0: 0.3, l1: 1.6 });
}

// Stars round the observer as directions (the Milky Way's legs).
function starSky(b, seed, n, { radius = 120, band = 0, bandSeed = 1 } = {}) {
  const nb = Math.round(n * band);
  const f = starField({ seed: hashSeed(seed, 'aotl-stars'), count: n - nb, radius });
  for (let i = 0; i < f.count; i++) {
    const x = f.positions[i * 3], y = f.positions[i * 3 + 1], z = f.positions[i * 3 + 2];
    dir(b, x, y, z, f.temperature[i], clamp(Math.sqrt(f.flux[i]) * 2.2, 0.25, 5));
  }
  if (nb > 0) mwBand(b, bandSeed, nb, { faint: 0.6 });
}

// The Milky Way's band seen from inside the disc: galaxyParticles round an observer 26,000 ly out, as directions.
// The disc's plane holds the way you fly (−z), so the band runs through the centre of the screen.
function mwBand(b, seed, n, { at = 26000, faint = 1, toward = 0.5 } = {}) {
  const g = galaxyParticles({ seed: hashSeed(seed, 'aotl-mw'), type: 'spiral', count: n, radius: 50000, arms:
    [1, 0.45, 1, 0.45], pitch: 12, barLength: 15000, barAngle: -30, bulge: 0.14, bar: 0.18 });
  const ox = at, oy = 0;
  for (let i = 0; i < g.count; i++) {
    // disc (x, y) → our (x, −z): the disc plane is our x–z plane; its spin axis is our y
    const dx = g.positions[i * 3] - ox, dy = g.positions[i * 3 + 1] - oy, dz = g.positions[i * 3 + 2];
    const d = Math.hypot(dx, dy, dz) || 1;
    // turn so the centre lies `toward` of the way round from ahead (0 ahead, 0.5 to the side)
    const a = toward * Math.PI * 0.5;
    const X = dx * Math.cos(a) - dy * Math.sin(a), Z = dx * Math.sin(a) + dy * Math.cos(a);
    dir(b, X, dz, -Z, g.temperature[i], faint * clamp(0.45 + 1.6 * g.flux[i] * (12000 / d) ** 0.7, 0.4, 4));
  }
  return g;
}

const BUILDERS = {
  // THE WEB: the filaments all round; Coma's dense knot ahead, its two giants as soft glows.
  *web(seed, tier) {
    const sky = bag(tier.sky);
    webSky(sky, seed, tier.sky);
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-coma'));
    const nC = Math.min(1100, Math.round(tier.land * 0.12));
    const land = bag(nC);
    const zc = -ROUTE_Z * 0.97;
    crowd(land, rnd, nC, { c: [0, 1.2, zc], rad: 7, core: 0.32, l1: 6 });
    const glow = bag(2, { size: true });
    push(glow, -0.9, 1.4, zc + 0.4, 5600, 4200, 7);       // NGC 4874
    push(glow, 0.8, 1.0, zc - 0.3, 5400, 3800, 7);        // NGC 4889
    return { sky, parts: [{ bag: land, kind: 'crowd' }, { bag: glow, kind: 'glow' }],
      bodies: [{ id: 'coma', name: 'COMA', c: [0, 1.2, zc], rad: 7, label: label('coma'), ahead: true, glare: 0.9 }] };
  },

  // COMA: you start inside the cluster (its crowd behind you reddens away); Virgo grows ahead.
  *coma(seed, tier) {
    const sky = bag(tier.sky);
    webSky(sky, seed + 11, tier.sky, { centre: [0, 0, -60], box: 600 });
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-coma2'));
    const land = bag(Math.min(3200, Math.round(tier.land * 0.36)));
    crowd(land, rnd, Math.round(land.cap * 0.55), { c: [0, 0, 4], rad: 14, core: 0.2, l1: 5 });
    const zv = -ROUTE_Z * 0.97;
    crowd(land, rnd, land.cap - land.n, { c: [2, -1, zv], rad: 9, core: 0.3, l1: 5 });
    const glow = bag(4, { size: true });
    push(glow, -0.8, 0.4, 3.6, 5600, 300, 6);             // Coma's giants, behind you
    push(glow, 0.9, -0.2, 4.4, 5400, 280, 6);
    push(glow, 1.0, -0.6, zv, 5300, 3600, 5);             // M84
    push(glow, 3.1, -1.2, zv - 0.5, 5300, 3300, 5);       // M86
    return { sky, parts: [{ bag: land, kind: 'crowd' }, { bag: glow, kind: 'glow' }],
      bodies: [{ id: 'virgo', name: 'VIRGO', c: [2, -1, zv], rad: 9, label: label('virgo'), ahead: true, glare: 0.8 }] };
  },

  // VIRGO: the cluster's crowd all round, M87's glow passing on one side with its jet (one-sided: the counter-jet
  // is beamed away, Biretta, Sparks and Macchetto 1999), and the Local Group ahead.
  *virgo(seed, tier) {
    const sky = bag(tier.sky);
    webSky(sky, seed + 23, tier.sky, { centre: [0, 0, -40], box: 500 });
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-virgo'));
    const land = bag(Math.min(5200, Math.round(tier.land * 0.55)));
    crowd(land, rnd, Math.round(land.cap * 0.45), { c: [0, 0, -30], rad: 34, core: 0.35, l1: 4 });
    const m87 = [-9, 3, -ROUTE_Z * 0.42];
    galaxy(land, null, { seed: hashSeed(seed, 'm87'), type: 'elliptical', n: Math.round(land.cap * 0.1), rad: 4.5,
      c: m87, opts: { axes: [1, 0.9, 0.85] }, lumK: 0.8 });
    // the jet: 600 points from the core, beamed toward its side
    const jet = bag(600, { size: false });
    const jd = [0.55, 0.62, 0.56];
    const jn = Math.hypot(...jd);
    for (let i = 0; i < 600; i++) {
      const s = rnd() ** 1.4 * 9, w = 0.12 + 0.025 * s;
      const knot = Math.sin(s * 3.1) > 0.75 ? 3 : 1;
      push(jet, m87[0] + (jd[0] / jn) * s + (rnd() - 0.5) * w, m87[1] + (jd[1] / jn) * s + (rnd() - 0.5) * w,
        m87[2] + (jd[2] / jn) * s + (rnd() - 0.5) * w, 16000 + 12000 * rnd(), (2.2 + knot) * (1 - s / 11));
    }
    const glow = bag(1, { size: true });
    push(glow, m87[0], m87[1], m87[2], 5200, 9000, 12);
    const zl = -ROUTE_Z * 1.15;
    crowd(land, rnd, land.cap - land.n, { c: [4, -2, zl], rad: 6, core: 0.4, l1: 3 });
    return { sky, parts: [{ bag: land, kind: 'crowd' }, { bag: jet, kind: 'jet' }, { bag: glow, kind: 'glow' }],
      bodies: [{ id: 'm87', name: 'M87', c: m87, rad: 5.5, label: label('m87') },
        { id: 'local-group', name: 'THE LOCAL GROUP', c: [4, -2, zl], rad: 6, label: label('local-group'), ahead: true,
          glare: 0.4 }] };
  },

  // THE LOCAL GROUP: the Local Sheet on one side, the empty Local Void on the other; Andromeda and Triangulum as
  // discs you pass, the Milky Way and the Magellanic Clouds ahead.
  *local(seed, tier) {
    const sky = bag(tier.sky);
    {
      const rnd = mulberry32(hashSeed(seed, 'aotl-sheet'));
      const nS = Math.round(tier.sky * 0.25);
      const web = cosmicWeb({ seed: hashSeed(seed, 'aotl-lg-web'), count: tier.sky - nS, centre: [0, 0, 0], box: 500,
        cells: 50 });
      for (let i = 0; i < web.count; i++) {
        const x = web.positions[i * 3], y = web.positions[i * 3 + 1], z = web.positions[i * 3 + 2];
        // the Local Void: the half of the sky above the sheet holds a tenth of the galaxies
        if (y > 30 && rnd() > 0.1) continue;
        dir(sky, x, y, z, web.temperature[i], Math.min(web.flux[i], 2) * 0.9);
      }
      shell(sky, rnd, sky.cap - sky.n, { l0: 0.5, l1: 1.4 });
    }
    yield;
    const land = bag(tier.land), dark = bag(Math.round(tier.land * 0.08), { size: true });
    const andromeda = [16, 2, -ROUTE_Z * 0.5];
    galaxy(land, dark, { seed: hashSeed(seed, 'm31'), n: Math.round(tier.land * 0.42), rad: 14, c: andromeda,
      tilt: 77 * DEG, spin: 38 * DEG, opts: { arms: 2, pitch: 9, bulge: 0.18, barLength: 4000 }, darkN: dark.cap / 2,
      lumK: 1.1 });
    yield;
    const triangulum = [-12, -4, -ROUTE_Z * 0.32];
    galaxy(land, dark, { seed: hashSeed(seed, 'm33'), n: Math.round(tier.land * 0.18), rad: 6, c: triangulum,
      tilt: 50 * DEG, spin: -20 * DEG, opts: { arms: 2, pitch: 16, bulge: 0.04, patchy: 0.5 }, darkN: dark.cap / 4 });
    const mw = [0, -6, -ROUTE_Z * 1.08];
    galaxy(land, dark, { seed: hashSeed(seed, 'mw-lg'), n: Math.round(tier.land * 0.26), rad: 16, c: mw,
      tilt: 62 * DEG, spin: 10 * DEG, opts: { arms: [1, 0.45, 1, 0.45], pitch: 12, barLength: 15000, barAngle: -30 },
      darkN: dark.cap - dark.n });
    const rnd = mulberry32(hashSeed(seed, 'aotl-mc'));
    crowd(land, rnd, Math.round((land.cap - land.n) * 0.6), { c: [7, -9, -ROUTE_Z * 0.97], rad: 1.6, core: 0.5,
      t0: 6500, t1: 11000, l1: 3 });
    crowd(land, rnd, land.cap - land.n, { c: [5.5, -10.5, -ROUTE_Z * 0.95], rad: 1.0, core: 0.5, t0: 6500, t1: 11000,
      l1: 3 });
    return { sky, parts: [{ bag: land, kind: 'disc' }, { bag: dark, kind: 'dark' }],
      bodies: [{ id: 'andromeda', name: 'ANDROMEDA', c: andromeda, rad: 14, label: label('andromeda') },
        { id: 'triangulum', name: 'TRIANGULUM', c: triangulum, rad: 6, label: label('triangulum') },
        { id: 'milky-way', name: 'THE MILKY WAY', c: mw, rad: 16, label: 'THE MILKY WAY · HOME GALAXY', ahead: true,
          glare: 0.6 }] };
  },

  // THE MILKY WAY: stars all round and the disc's band through the centre of the screen, dust lanes darkening it,
  // the bulge and bar glowing off to one side, the Orion Arm's star clouds ahead.
  *milkyway(seed, tier) {
    const sky = bag(Math.round(tier.sky * 1.1));
    const g = mwBand(sky, seed, Math.round(sky.cap * 0.62), { at: 14000, toward: 0.35 });
    yield;
    starSky(sky, seed + 5, sky.cap - sky.n, { radius: 150 });
    // the dust lanes along the band, as directions with their own sizes
    const dark = bag(Math.round(tier.land * 0.22), { size: true });
    if (g.dust) {
      const a = 0.35 * Math.PI * 0.5;
      for (let i = 0; i < g.dust.count && dark.n < dark.cap; i++) {
        const dx = g.dust.positions[i * 3] - 14000, dy = g.dust.positions[i * 3 + 1], dz = g.dust.positions[i * 3 + 2];
        const d = Math.hypot(dx, dy, dz) || 1;
        if (d > 30000) continue;
        const X = dx * Math.cos(a) - dy * Math.sin(a), Z = dx * Math.sin(a) + dy * Math.cos(a);
        const s = (SKY_R * (g.dust.size[i] || 600)) / d;
        push(dark, (X / d) * SKY_R, (dz / d) * SKY_R, (-Z / d) * SKY_R, 0, 0.5 + 0.4 * clamp(4000 / d, 0, 1),
          clamp(s, 4, 60));
      }
    }
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-bulge'));
    const land = bag(Math.round(tier.land * 0.6));
    const bulge = [-22, 0, -ROUTE_Z * 0.45];
    crowd(land, rnd, Math.round(land.cap * 0.5), { c: bulge, rad: 12, core: 0.3, t0: 3800, t1: 5200, l1: 3, flat: 0.45 });
    // the Orion Arm's mouth: two star clouds either side of the way ahead
    crowd(land, rnd, Math.round((land.cap - land.n) / 2), { c: [-6, 0, -ROUTE_Z * 0.97], rad: 4, core: 0.6, t0: 7000,
      t1: 16000, l1: 4, flat: 0.5 });
    crowd(land, rnd, land.cap - land.n, { c: [6, 0, -ROUTE_Z * 0.97], rad: 4, core: 0.6, t0: 7000, t1: 16000, l1: 4,
      flat: 0.5 });
    const glow = bag(1, { size: true });
    push(glow, bulge[0], bulge[1], bulge[2], 4200, 40000, 34);
    return { sky, skyDark: dark, parts: [{ bag: land, kind: 'crowd' }, { bag: glow, kind: 'glow' }],
      bodies: [{ id: 'galactic-centre', name: 'THE GALACTIC CENTRE', c: bulge, rad: 12, label: label('galactic-centre') },
        { id: 'orion-arm', name: 'THE ORION ARM', c: [0, 0, -ROUTE_Z * 0.97], rad: 8, label: label('orion-arm'),
          ahead: true, glare: 0.5 }] };
  },

  // ORION: a field of stars and the faint band; the Orion Nebula as glowing gas round the Trapezium, the Belt's three
  // blue supergiants and red Betelgeuse; the Local Bubble's wall ahead.
  *orion(seed, tier) {
    const sky = bag(tier.sky);
    starSky(sky, seed + 7, tier.sky, { radius: 140, band: 0.3, bandSeed: seed + 3 });
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-orion'));
    const gauss = gaussFrom(rnd);
    const neb = bag(Math.round(tier.land * 0.5), { tint: true });
    const M42 = [6, 3, -ROUTE_Z * 0.45];
    for (let i = 0; i < neb.cap; i++) {
      // a lumpy cloud: hydrogen red outside, oxygen teal in the hot middle
      const r = Math.abs(gauss()) * 3.2 + rnd() * 1.2;
      const a = rnd() * Math.PI * 2, e = (rnd() * 2 - 1) * 0.8;
      const lump = 1 + 0.6 * Math.sin(a * 3 + r * 1.7);
      const x = Math.cos(a) * r * lump, y = Math.sin(a) * r * 0.8, z = e * r * 0.6;
      const hot = r < 1.4;
      const tint = hot ? [0.45, 1.25, 1.2] : rnd() < 0.7 ? [1.8, 0.35, 0.75] : [1.5, 0.5, 1.1];
      push(neb, M42[0] + x, M42[1] + y, M42[2] + z, 9000, (hot ? 1.6 : 0.9) * (0.4 + rnd()), 0, tint);
    }
    yield;
    const stars = bag(16, { size: true });
    const trap = [[0, 0.2, 0], [0.25, -0.1, 0.1], [-0.2, -0.15, 0], [0.05, -0.35, -0.1]];
    for (const p of trap) push(stars, M42[0] + p[0], M42[1] + p[1], M42[2] + p[2], 32000, 500, 3);
    const belt = [[-14, 10], [-11, 8.5], [-8, 7]];
    for (const [x, y] of belt) push(stars, x, y, -ROUTE_Z * 0.6, 27000, 4000, 5);
    push(stars, -18, 20, -ROUTE_Z * 0.75, 3500, 6000, 8);            // Betelgeuse
    push(stars, 14, -16, -ROUTE_Z * 0.7, 12000, 4000, 5);            // Rigel
    // the Local Bubble's wall ahead: a thin shell of warm gas points
    const wall = bag(Math.round(tier.land * 0.3));
    for (let i = 0; i < wall.cap; i++) {
      const a = rnd() * Math.PI * 2, r = 6 + rnd() * 9;
      push(wall, Math.cos(a) * r, Math.sin(a) * r * 0.7, -ROUTE_Z * 1.0 - rnd() * 6, 5000 + 3000 * rnd(),
        0.3 + 0.8 * rnd() ** 2);
    }
    return { sky, parts: [{ bag: neb, kind: 'nebula' }, { bag: stars, kind: 'glow' }, { bag: wall, kind: 'crowd' }],
      bodies: [{ id: 'orion-nebula', name: 'THE ORION NEBULA', c: M42, rad: 4, label: label('orion-nebula') },
        { id: 'betelgeuse', name: 'BETELGEUSE', c: [-18, 20, -ROUTE_Z * 0.75], rad: 1, label: label('betelgeuse') },
        { id: 'bubble', name: 'THE LOCAL BUBBLE', c: [0, 0, -ROUTE_Z * 1.0], rad: 12, label: 'THE LOCAL BUBBLE',
          ahead: true, glare: 0.3 }] };
  },

  // THE SUN'S NEIGHBOURS: the stars round the Sun; the Hyades and orange Aldebaran (a foreground star, 67 ly
  // against the cluster's 153), Sirius and its white dwarf, Alpha Centauri A and B with Proxima, the Sun ahead.
  *neighbours(seed, tier) {
    const sky = bag(tier.sky);
    starSky(sky, seed + 13, tier.sky, { radius: 90, band: 0.25, bandSeed: seed + 9 });
    yield;
    const land = bag(Math.round(tier.land * 0.45));
    const hy = openCluster({ seed: hashSeed(seed, 'hyades'), count: land.cap, core: 2.7, tidal: 10, age: 6.25e8,
      giants: 4 });
    const hyC = [-10, 4, -ROUTE_Z * 0.28];
    for (let i = 0; i < hy.count; i++) {
      push(land, hyC[0] + hy.positions[i * 3] * 0.45, hyC[1] + hy.positions[i * 3 + 1] * 0.45,
        hyC[2] + hy.positions[i * 3 + 2] * 0.45, hy.temperature[i], clamp(Math.sqrt(hy.lum[i]) * 0.9, 0.08, 5));
    }
    const stars = bag(12, { size: true });
    push(stars, -6.5, 3.2, -ROUTE_Z * 0.24, 3900, 3000, 6);          // Aldebaran
    push(stars, 9, -3, -ROUTE_Z * 0.55, 9900, 5000, 7);              // Sirius A
    push(stars, 9.25, -2.9, -ROUTE_Z * 0.55, 25000, 60, 2);          // Sirius B
    const ac = [-4, -2, -ROUTE_Z * 0.82];
    push(stars, ac[0], ac[1], ac[2], 5790, 3000, 6);                // Alpha Centauri A
    push(stars, ac[0] + 0.35, ac[1] + 0.1, ac[2], 5260, 1600, 4);    // B
    push(stars, ac[0] - 2.2, ac[1] - 1.4, ac[2] + 1, 3040, 80, 2);   // Proxima
    push(stars, 0, 0, -ROUTE_Z * 1.04, 5772, 30000, 6);              // the Sun
    return { sky, parts: [{ bag: land, kind: 'stars' }, { bag: stars, kind: 'glow' }],
      bodies: [{ id: 'hyades', name: 'THE HYADES', c: hyC, rad: 4, label: label('hyades') },
        { id: 'sirius', name: 'SIRIUS', c: [9, -3, -ROUTE_Z * 0.55], rad: 0.6, label: label('sirius') },
        { id: 'alpha-centauri', name: 'ALPHA CENTAURI', c: ac, rad: 0.8, label: label('alpha-centauri') },
        { id: 'sun', name: 'THE SUN', c: [0, 0, -ROUTE_Z * 1.04], rad: 2, label: 'THE SUN · HOME STAR', ahead: true,
          glare: 0.7 }] };
  },

  // EARTH: a dark sky of stars; Saturn with its rings and their real gaps (the PDS Rings Node radii), Jupiter with
  // its belts, the Sun beyond, then the Moon and Earth ahead as shaded discs.
  *earth(seed, tier) {
    const sky = bag(Math.round(tier.sky * 0.4));
    starSky(sky, seed + 17, sky.cap, { radius: 60, band: 0.3, bandSeed: seed + 1 });
    yield;
    const rnd = mulberry32(hashSeed(seed, 'aotl-solar'));
    const land = bag(Math.round(tier.land * 0.5), { tint: true });
    const sun = [0.55, 0.35, 0.76];
    const sat = [9, 2.5, -ROUTE_Z * 0.24];
    planet(land, rnd, Math.round(land.cap * 0.14), { c: sat, rad: 2.2, sun, bands: (l) => 5200 + 500 * Math.cos(l * 9) });
    // the rings: D, C, B, the Cassini Division, A with the Encke and Keeler gaps, F (radii in Saturn radii)
    const zones = [[1.24, 1.53, 0.35], [1.53, 1.95, 1.0], [2.03, 2.21, 0.75], [2.217, 2.262, 0.7], [2.268, 2.27, 0.5],
      [2.32, 2.33, 0.6]];
    const nR = Math.round(land.cap * 0.42);
    const tilt = 0.42;
    for (let i = 0; i < nR; i++) {
      const zk = zones[Math.min(zones.length - 1, Math.floor(rnd() ** 0.7 * zones.length))];
      const r = (zk[0] + (zk[1] - zk[0]) * rnd()) * 2.2, a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * Math.sin(tilt), z = Math.sin(a) * r * Math.cos(tilt);
      // the near half of the rings crosses in front of the planet; behind it they are hidden
      if (Math.hypot(x, y) < 2.2 && z < 0) continue;
      push(land, sat[0] + x, sat[1] + y, sat[2] + z, 5600, zk[2] * (0.5 + 0.6 * rnd()), 0, [1.05, 0.98, 0.85]);
    }
    const jup = [-10, -3, -ROUTE_Z * 0.42];
    planet(land, rnd, Math.round(land.cap * 0.16), { c: jup, rad: 2.8, sun,
      bands: (l) => (Math.sin(l * 11) > 0.2 ? 4600 : 6200) });
    yield;
    const earth = [1.5, -0.8, -ROUTE_Z * 1.0];
    planet(land, rnd, Math.round(land.cap * 0.14), { c: earth, rad: 1.6, sun, temp: 9000, lumK: 1.2,
      tint: (nx, ny) => (Math.abs(ny) > 0.85 ? [1.1, 1.1, 1.1] : Math.sin(nx * 7 + ny * 4) > 0.35
        ? [0.7, 0.85, 0.55] : [0.35, 0.6, 1.4]) });
    const moon = [-1.2, 1.1, -ROUTE_Z * 0.94];
    planet(land, rnd, land.cap - land.n, { c: moon, rad: 0.45, sun, temp: 5400, tint: [0.85, 0.85, 0.85] });
    const glow = bag(1, { size: true });
    push(glow, 30, 18, -ROUTE_Z * 1.7, 5772, 400000, 14);              // the Sun beyond
    return { sky, parts: [{ bag: land, kind: 'planets' }, { bag: glow, kind: 'glow' }],
      bodies: [{ id: 'saturn', name: 'SATURN', c: sat, rad: 5, label: label('saturn') },
        { id: 'jupiter', name: 'JUPITER', c: jup, rad: 2.8, label: label('jupiter') },
        { id: 'moon', name: 'THE MOON', c: moon, rad: 0.45, label: 'THE MOON' },
        { id: 'earth', name: 'EARTH', c: earth, rad: 1.6, label: 'EARTH · HOME', ahead: true, glare: 0.2 }] };
  },
};

export const BACKDROP_TYPES = Object.freeze(Object.keys(BUILDERS));

// ---------- materials per part ----------

// Bodies behind you fade with their Doppler dimming (a small floor only): the sky keeps its floor, a planet you
// passed does not hang beside the ring.
function materialFor(kind, rel) {
  switch (kind) {
    case 'glow': return createGlowMaterial({ shared: rel.land, exposure: 1, eref: 4, maxPx: 64, near: 0.5 });
    case 'jet': return createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 4, emax: 8, cull: 0.01,
      exposure: 1.6, floor: 0.05 });
    case 'nebula': return createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 7, emax: 2.2, cull: 0.01,
      exposure: 0.42, floor: 0.05, tint: true });
    case 'planets': return createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 4, emax: 8, cull: 0.01,
      exposure: 2.2, floor: 0.05, tint: true });
    case 'dark': return createDarkMaterial({ shared: rel.land, opacity: 0.55, minPx: 3, maxPx: 40 });
    case 'stars': return createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 4, emax: 6, cull: 0.02,
      exposure: 1.2, floor: 0.05 });
    default: return createFloorMaterial({ shared: rel.land, falloff: 0, maxPx: 4, emax: 6, cull: 0.03,
      exposure: 1.1, floor: 0.05 });
  }
}

// ---------- projection (for the overlay's rings and labels) ----------

// Where a body's centre and edge draw on screen at progress p: { x, y, r, theta (true angle from ahead, degrees),
// depth (route units ahead) }, or null when it is behind you or off screen. Aberration at phi (the landmarks' φ).
export function projectBody(body, p, view, phi) {
  const c = Math.cos(-view.cam * DEG), s = Math.sin(-view.cam * DEG);
  const x = body.c[0] * c - body.c[1] * s, y = body.c[0] * s + body.c[1] * c;
  const z = body.c[2] + p * ROUTE_Z;
  const d = Math.hypot(x, y, z) || 1e-9;
  const th = Math.acos(clamp(-z / d, -1, 1));
  const ab = (t) => 2 * Math.atan(Math.exp(-phi) * Math.tan(t / 2));
  const t1 = ab(th);
  if (t1 > 80 * DEG) return null;
  const az = Math.atan2(y, x);
  const rr = view.fPx * Math.tan(t1);
  const alpha = Math.asin(clamp(body.rad / d, 0, 1));
  const out = ab(Math.min(th + alpha, 179 * DEG)), inn = ab(Math.max(0, th - alpha));
  const R = th < alpha ? view.fPx * Math.tan(Math.min(out, 80 * DEG))
    : 0.5 * (view.fPx * Math.tan(Math.min(out, 80 * DEG)) - view.fPx * Math.tan(inn));
  return { x: view.cx + Math.cos(az) * rr, y: view.cy - Math.sin(az) * rr, r: R, theta: th / DEG, depth: -z };
}

// ---------- the backdrop object ----------

function assemble(type, made, { rel, tierDef }) {
  const group = new THREE.Group();
  group.name = `backdrop-${type}`;
  // faint points are culled rather than drawn as grey discs, so the sky stays black with crisp white points
  const skyMat = createFloorMaterial({ shared: rel.sky, falloff: 0, maxPx: 3, emax: 1.8, cull: 0.075, exposure: 0.24,
    floor: 0, floorAbs: 0.4 });
  const sky = pointsOf(made.sky, skyMat, 0);
  group.add(sky);
  let skyDark = null;
  if (made.skyDark && made.skyDark.n) {
    skyDark = pointsOf(made.skyDark, createDarkMaterial({ shared: rel.sky, opacity: 0.6, minPx: 3, maxPx: 50 }), 0.5);
    group.add(skyDark);
  }
  const land = new THREE.Group();
  group.add(land);
  const parts = [];
  for (const part of made.parts) {
    if (!part.bag.n) continue;
    const mat = materialFor(part.kind, rel);
    // the landmarks draw over the shade behind the hazards (scene.js), so a galaxy you pass stays bright; only the
    // sky and the dust are dimmed there
    const pts = pointsOf(part.bag, mat, part.kind === 'dark' ? 3.3 : part.kind === 'glow' ? 3.4 : 3.2,
      part.kind === 'glow' ? 'aMin' : 'aSize');
    land.add(pts);
    parts.push({ kind: part.kind, pts, mat, base: mat.uniforms.uExposure ? mat.uniforms.uExposure.value : 1 });
  }
  const count = made.sky.n + (made.skyDark ? made.skyDark.n : 0) + made.parts.reduce((a, q) => a + q.bag.n, 0);
  const bodies = made.bodies;
  const ahead = bodies.find((b) => b.ahead) || bodies[bodies.length - 1];
  let fade = 1;

  return {
    type, group, sky, parts, bodies, ahead, points: count, calls: 1 + (skyDark ? 1 : 0) + parts.length,
    tier: tierDef.name,
    // Per frame: the sky's exposure follows the eye's adaptation (lab A); the bodies move toward you with the leg's
    // progress. Returns how bright the centre is (0..1), for the shade behind the hazards.
    update({ phiS, progress = 0, title = false }) {
      const exp = 0.2 * Math.pow(1 + 0.6 * Math.max(0, phiS - 1), -0.8) * Math.exp(-1.4 * Math.max(0, phiS - 3));
      skyMat.uniforms.uExposure.value = exp;
      skyMat.uniforms.uFade.value = fade;
      land.position.z = clamp(progress, 0, 1.3) * ROUTE_Z;
      const k = title ? 0.7 : 1;
      for (const q of parts) if (q.mat.uniforms.uFade) q.mat.uniforms.uFade.value = k * fade;
      const p = clamp(progress, 0, 1);
      return (ahead.glare || 0.5) * smooth(0.3, 0.95, p);
    },
    // The bodies' rings and labels on screen now, nearest first: [{ id, text, x, y, r, ahead }].
    marks(view, progress, phi) {
      const out = [];
      for (const b of bodies) {
        const q = projectBody(b, clamp(progress, 0, 1.3), view, phi);
        if (!q || q.depth < 0.5) continue;
        if (q.x < -q.r || q.x > view.w + q.r || q.y < -q.r || q.y > view.h + q.r) continue;
        out.push({ id: b.id, text: b.label, x: q.x, y: q.y, r: Math.max(4, q.r), ahead: Boolean(b.ahead),
          depth: q.depth });
      }
      out.sort((a, z) => a.depth - z.depth);
      return out;
    },
    // The vista borrows the main landmark's geometry with its own material.
    vistaParts() { return parts.filter((q) => q.kind !== 'dark').map((q) => ({ kind: q.kind, geometry: q.pts.geometry })); },
    setFade(f) { fade = clamp(f, 0, 1); },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      group.clear();
    },
  };
}

// Build a leg's backdrop now. type: a ROUTE leg type; rel: scene.rel; tier: a TIERS key.
export function buildBackdrop(type, { seed = 1, tier = 'low', rel } = {}) {
  const b = createBuilder(type, { seed, tier, rel });
  while (!b.done) b.step(Infinity);
  return b.result;
}

// Build a backdrop in slices: step(ms) works until ms have passed or the next yield, and returns true when done.
// result is the backdrop once done. (The cosmic web's generator runs in one slice of its own.)
export function createBuilder(type, { seed = 1, tier = 'low', rel } = {}) {
  const tierDef = TIERS[tier] || TIERS.low;
  const make = BUILDERS[type] || BUILDERS.web;
  const it = make(Number(seed) || hashSeed(seed), tierDef);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const b = {
    done: false, result: null, type,
    step(ms = 4) {
      if (b.done) return true;
      const t0 = now();
      do {
        const r = it.next();
        if (r.done) {
          b.result = assemble(type, r.value, { rel, tierDef });
          b.done = true;
          return true;
        }
      } while (now() - t0 < ms);
      return false;
    },
  };
  return b;
}
