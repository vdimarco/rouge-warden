// Light Years Home: a simple model of the gas the ship flies through inside the Milky Way, in atoms per cm³.
// It checks the authored zones of the Milky Way legs: each zone's density must match this model within a factor of 3
// over the zone's span. The model has four parts, from smallest to largest:
//   1. the Solar System: the solar wind falling as r⁻² out to the heliopause, and the asteroid belt's dust;
//   2. named clouds and bubbles (spheres, a shell and a capsule) with a density and a source each; where they overlap,
//      the smallest one wins, so a nebula inside a cloud inside a bubble reads as the nebula;
//   3. the disc: 0.1 between arms and 1 in an arm, falling as exp(−|z| / 500 ly) above the plane, with the arms
//      from Reid et al. 2019 (log spirals, Gaussian widths);
//   4. the hot halo around the galaxy.
// Positions are heliocentric galactic light-years, as in objects.js.

import { OBJECTS, AU_LY, LY_PER_PC, ECLIPTIC_POLE } from './objects.js';

const W = 'https://en.wikipedia.org/wiki/';
const REID = 'https://arxiv.org/abs/1910.03357';
const D2R = Math.PI / 180;

export const LY_PER_KPC = LY_PER_PC * 1000;
export const GC_POS = OBJECTS['galactic-centre'].pos;     // Sgr A*, 26,996 ly away
export const R0_LY = Math.hypot(...GC_POS);
export const R0_REID_KPC = 8.15;                           // the Sun's distance in Reid et al. 2019's own fit
export const ARM_SCALE = R0_LY / (R0_REID_KPC * LY_PER_KPC);   // stretch Reid's arms to the game's R0
export const Z_SUN_LY = 5.5 * LY_PER_PC;                   // the Sun sits 5.5 pc above the mid-plane (Reid 2019)
export const GAS_SCALE_LY = 500;                           // scale height of the gas layer
export const DISC_EDGE_LY = 50000;                         // the gas disc fades beyond this galactocentric radius

export const N_INTERARM = 0.1;
export const N_ARM = 1;
export const N_HALO = 1e-3;
export const N_OUTER_HALO = 1e-4;
export const N_IGM = 2.5e-7;
export const HALO_LY = 330000;                             // about 100 kpc
export const OUTER_HALO_LY = 650000;                       // about 200 kpc, the virial radius

export const HELIOPAUSE_AU = 120;
export const SOLAR_WIND_1AU = 5;                           // per cm³ at Earth's orbit
export const BELT_AU = [2.1, 3.3];
export const BELT_HALF_THICK = 0.3;                        // |height above the ecliptic| < 0.3 r
export const BELT_N = 1e4;                                 // effective: dust grains, an estimate (disclosed)

export const SOURCES = {
  halo: W + 'Galactic_corona',
  disc: W + 'Interstellar_medium',
  arms: REID,
  wind: W + 'Solar_wind',
  heliopause: W + 'Heliosphere',
  belt: W + 'Asteroid_belt',
  igm: W + 'Warm%E2%80%93hot_intergalactic_medium',
};

// Reid et al. 2019, Table 2: ln(R / R_kink) = −(β − β_kink) tan ψ, ψ = ψ< below the kink and ψ> above. R in kpc,
// angles in degrees, width = Gaussian width in kpc, fit = the azimuth range the data cover.
export const ARMS = [
  { id: '3-kpc', name: '3-kpc Arm', fit: [15, 18], kink: 15, rKink: 3.52, psiLo: -4.2, psiHi: -4.2, width: 0.18 },
  { id: 'norma', name: 'Norma Arm', fit: [5, 54], kink: 18, rKink: 4.46, psiLo: -1.0, psiHi: 19.5, width: 0.14 },
  { id: 'scutum-centaurus', name: 'Scutum–Centaurus Arm', fit: [0, 104], kink: 23, rKink: 4.91, psiLo: 14.1, psiHi: 12.1,
    width: 0.23 },
  { id: 'sagittarius-carina', name: 'Sagittarius–Carina Arm', fit: [2, 97], kink: 24, rKink: 6.04, psiLo: 17.1,
    psiHi: 1.0, width: 0.27 },
  { id: 'local', name: 'Orion Arm', fit: [-8, 34], kink: 9, rKink: 8.26, psiLo: 11.4, psiHi: 11.4, width: 0.31 },
  { id: 'perseus', name: 'Perseus Arm', fit: [-23, 115], kink: 40, rKink: 8.87, psiLo: 10.3, psiHi: 8.7, width: 0.35 },
  { id: 'outer', name: 'Outer Arm', fit: [-16, 71], kink: 18, rKink: 12.24, psiLo: 3.0, psiHi: 9.4, width: 0.65 },
];
export const ARM_REACH_DEG = 30;     // arms are drawn this far past the azimuths their data cover
export const IN_ARM = 0.3;           // weight above which a point counts as inside an arm (within 1.55 widths)

// ---------- geometry helpers ----------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Heliocentric galactic position from galactic longitude, latitude (degrees) and distance (ly).
export function fromGalactic(lDeg, bDeg, dist) {
  const l = lDeg * D2R, b = bDeg * D2R;
  return [dist * Math.cos(b) * Math.cos(l), dist * Math.cos(b) * Math.sin(l), dist * Math.sin(b)];
}

// Height above the galactic mid-plane, ly.
export function galacticHeight(pos) {
  return pos[2] + Z_SUN_LY;
}

// Distance from the Galactic Centre (Sgr A*), ly.
export function gcDistance(pos) {
  return len(sub(pos, GC_POS));
}

// Galactocentric radius in the plane (ly, game scale) and Reid's azimuth β (degrees; 0 toward the Sun, increasing
// with Galactic rotation, so toward +y).
export function galactocentric(pos) {
  const X = R0_LY - pos[0], Y = pos[1];
  return { R: Math.hypot(X, Y), beta: Math.atan2(Y, X) / D2R };
}

// ---------- named clouds and bubbles ----------
// shape: 'sphere' { centre, radius }, 'shell' { centre, radius, thick }, 'capsule' { centre (head), tail, radius }.
// size orders overlaps: the smallest containing shape wins.

const ON = OBJECTS['orion-nebula'].pos;
const HH = OBJECTS.horsehead.pos;
const ORION_HUB = [0, 1, 2].map((k) => (ON[k] + HH[k]) / 2);   // midway between the Orion Nebula and the Horsehead
export const CLOUDS = [
  { id: 'local-bubble', name: 'Local Bubble', kind: 'bubble', n: 0.005, shape: 'sphere', centre: [0, 0, 0], radius: 500,
    note: 'hot gas about 0.005 per cm³ from X-ray surveys; Wikipedia gives under 0.05 for its neutral hydrogen',
    source: W + 'Local_Bubble' },
  { id: 'orion-eridanus', name: 'Orion–Eridanus Superbubble', kind: 'bubble', n: 0.005, shape: 'sphere',
    centre: fromGalactic(205, -24, 950), radius: 600, note: 'about 1,200 ly across, blown out of Orion toward us',
    source: W + 'Orion%E2%80%93Eridanus_Superbubble' },
  { id: 'lic', name: 'Local Interstellar Cloud', kind: 'cloud', n: 0.3, shape: 'sphere', centre: fromGalactic(205, -10, 7),
    radius: 15, note: 'about 30 ly across; the Sun sits near its edge facing the G-Cloud',
    source: W + 'Local_Interstellar_Cloud' },
  { id: 'g-cloud', name: 'G-Cloud', kind: 'cloud', n: 0.1, shape: 'sphere', centre: fromGalactic(315.7, -0.7, 5.6),
    radius: 4.5, note: 'holds Alpha Centauri', source: W + 'G-Cloud' },
  { id: 'gum', name: 'Gum Nebula', kind: 'nebula', n: 10, shape: 'sphere', centre: [-298.66, -1428.64, -175.15],
    radius: 478, note: '36° across at 1,470 ly', source: W + 'Gum_Nebula' },
  { id: 'barnards-loop', name: "Barnard's Loop", kind: 'nebula', n: 10, shape: 'shell', centre: ORION_HUB, radius: 150,
    thick: 40, note: 'an arc of radius 150 ly centred on the Horsehead and the Orion Nebula',
    source: W + 'Barnard%27s_Loop' },
  { id: 'orion-a', name: 'Orion A cloud', kind: 'cloud', n: 100, shape: 'capsule', centre: ON,
    tail: fromGalactic(213, -19.8, 1530), radius: 30, note: 'head at the Orion Nebula, tail 290 ly long, out to 1,530 ly',
    source: W + 'Orion_molecular_cloud_complex' },
  { id: 'orion-nebula', name: 'Orion Nebula', kind: 'nebula', n: 1000, shape: 'sphere', centre: ON, radius: 12,
    source: W + 'Orion_Nebula' },
  { id: 'taurus', name: 'Taurus Molecular Cloud', kind: 'cloud', n: 100, shape: 'sphere', centre: [-429.69, 51.57, -123.34],
    radius: 60, note: 'about 120 ly across at 450 ly', source: W + 'Taurus_molecular_cloud' },
  { id: 'pleiades-dust', name: 'Pleiades dust', kind: 'cloud', n: 30, shape: 'sphere', centre: OBJECTS.pleiades.pos,
    radius: 10, note: 'the blue reflection haze the cluster is passing through', source: W + 'Pleiades' },
  { id: 'carina', name: 'Carina Nebula', kind: 'nebula', n: 100, shape: 'sphere', centre: OBJECTS.carina.pos, radius: 150,
    note: '2° across at 8,500 ly', source: W + 'Carina_Nebula' },
];

function cloudSize(c) {
  return c.shape === 'capsule' ? c.radius + len(sub(c.tail, c.centre)) / 2 : c.radius + (c.thick || 0) / 2;
}

function insideCloud(c, pos) {
  if (c.shape === 'sphere') return len(sub(pos, c.centre)) <= c.radius;
  if (c.shape === 'shell') return Math.abs(len(sub(pos, c.centre)) - c.radius) <= c.thick / 2;
  // capsule: distance to the segment from centre (head) to tail
  const ab = sub(c.tail, c.centre), ap = sub(pos, c.centre);
  const t = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab)));
  return len(sub(ap, ab.map((v) => v * t))) <= c.radius;
}

const BY_SIZE = [...CLOUDS].sort((a, b) => cloudSize(a) - cloudSize(b));

// The named cloud or bubble a point is in (the smallest one when they overlap), or null.
export function cloudAt(pos) {
  for (const c of BY_SIZE) if (insideCloud(c, pos)) return c;
  return null;
}

// ---------- spiral arms ----------

// Radius of an arm's centre line at azimuth β (degrees), in Reid's kpc.
export function armRadius(arm, betaDeg) {
  const psi = (betaDeg < arm.kink ? arm.psiLo : arm.psiHi) * D2R;
  return arm.rKink * Math.exp(-(betaDeg - arm.kink) * D2R * Math.tan(psi));
}

// Weight 0..1 of each arm at a point, from its in-plane position only (height is ignored here).
export function armWeights(pos) {
  const { R, beta } = galactocentric(pos);
  const rKpc = R / LY_PER_KPC / ARM_SCALE;
  return ARMS.map((arm) => {
    if (beta < arm.fit[0] - ARM_REACH_DEG || beta > arm.fit[1] + ARM_REACH_DEG) return 0;
    const psi = (beta < arm.kink ? arm.psiLo : arm.psiHi) * D2R;
    const d = Math.abs(rKpc - armRadius(arm, beta)) * Math.cos(psi);
    return Math.exp(-(d * d) / (2 * arm.width * arm.width));
  });
}

// The arm a point lies over: { id, name, weight, inArm } for the strongest arm.
export function armAt(pos) {
  const w = armWeights(pos);
  let best = 0;
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
  return { id: ARMS[best].id, name: ARMS[best].name, weight: w[best], inArm: w[best] >= IN_ARM };
}

// ---------- density ----------

// Disc gas: 0.1 between arms, 1 on an arm's centre line, falling with height and beyond the disc's edge.
export function discDensity(pos) {
  const w = Math.max(...armWeights(pos));
  const { R } = galactocentric(pos);
  const plane = N_INTERARM + (N_ARM - N_INTERARM) * w;
  const edge = R > DISC_EDGE_LY ? Math.exp(-(R - DISC_EDGE_LY) / 10000) : 1;
  return plane * edge * Math.exp(-Math.abs(galacticHeight(pos)) / GAS_SCALE_LY);
}

// The hot halo: 1e-3 within about 100 kpc of the centre, 1e-4 out to about 200 kpc, then intergalactic gas.
export function haloDensity(pos) {
  const r = gcDistance(pos);
  if (r < HALO_LY) return N_HALO;
  if (r < OUTER_HALO_LY) return N_OUTER_HALO;
  return N_IGM;
}

// Inside the asteroid belt: 2.1 to 3.3 AU from the Sun and within ±0.3 r of the ecliptic plane.
export function inAsteroidBelt(pos) {
  const r = len(pos) / AU_LY;
  if (r < BELT_AU[0] || r > BELT_AU[1]) return false;
  return Math.abs(dot(pos, ECLIPTIC_POLE)) / AU_LY < BELT_HALF_THICK * r;
}

// Gas density at a point, atoms per cm³, with what set it.
export function sampleAt(pos) {
  const rAu = len(pos) / AU_LY;
  if (rAu < HELIOPAUSE_AU) {
    if (inAsteroidBelt(pos)) return { n: BELT_N, by: 'asteroid-belt' };
    return { n: SOLAR_WIND_1AU / Math.max(rAu, 0.01) ** 2, by: 'solar-wind' };
  }
  const c = cloudAt(pos);
  if (c) return { n: c.n, by: c.id };
  return { n: haloDensity(pos) + discDensity(pos), by: 'galaxy' };
}

export function densityAt(pos) {
  return sampleAt(pos).n;
}

// ---------- along a path ----------

// Path helpers: a path is an array of positions joined by straight lines.
export function pathLength(path) {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += len(sub(path[i], path[i - 1]));
  return s;
}

export function pointAlong(path, ly) {
  let left = Math.max(0, ly);
  for (let i = 1; i < path.length; i++) {
    const seg = sub(path[i], path[i - 1]), l = len(seg);
    if (left <= l || i === path.length - 1) {
      const t = l > 0 ? Math.min(1, left / l) : 0;
      return [0, 1, 2].map((k) => path[i - 1][k] + seg[k] * t);
    }
    left -= l;
  }
  return [...path[0]];
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Median model density over [fromLy, toLy] along a path, from evenly spaced samples.
export function medianDensity(path, fromLy, toLy, samples = 41) {
  const values = [];
  for (let i = 0; i < samples; i++) {
    const s = fromLy + ((toLy - fromLy) * (i + 0.5)) / samples;
    values.push(densityAt(pointAlong(path, s)));
  }
  return median(values);
}

// Compare a leg's zones with the model. zones need ly (numbers, in order). ratio = max(n/model, model/n).
export function checkZones(path, zones, factor = 3) {
  const out = [];
  let at = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const model = medianDensity(path, at, at + z.ly);
    const ratio = Math.max(z.n / model, model / z.n);
    out.push({ index: i, label: z.label, kind: z.kind, n: z.n, model, ratio, ok: ratio <= factor, fromLy: at,
      toLy: at + z.ly });
    at += z.ly;
  }
  return out;
}

// The spiral arms a path passes over or through, in order. Each entry is where the path is most squarely over the
// arm: { id, name, at (0..1 along the path), pos, pathHeightLy (the path's height above the mid-plane),
// armAboveLy (how far the arm's mid-plane lies above you; negative means below) }.
export function armsPassed(path, samples = 4000) {
  const total = pathLength(path);
  const out = [];
  let run = null;
  for (let i = 0; i <= samples; i++) {
    const at = i / samples;
    const pos = pointAlong(path, at * total);
    const a = armAt(pos);
    const id = a.inArm ? a.id : null;
    if (run && run.id !== id) { out.push(run); run = null; }
    if (id && !run) run = { id, name: a.name, weight: -1 };
    if (id && a.weight > run.weight) Object.assign(run, { weight: a.weight, at, pos });
  }
  if (run) out.push(run);
  return out.map(({ id, name, at, pos }) => {
    const h = galacticHeight(pos);
    return { id, name, at, pos, pathHeightLy: h, armAboveLy: -h };
  });
}
