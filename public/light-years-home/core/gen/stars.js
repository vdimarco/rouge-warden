// Light Years Home: stars, made from a seed. A field with the mix of star types near the Sun, where about 3 stars in 4
// are red dwarfs (the RECONS census of stars within 10 parsecs: 248 M, 44 K, 20 G, 6 F, 4 A and 20 white dwarfs;
// https://www.recons.org/census.posted.htm), plus a few rarer B stars and giants from wider volumes. And the members
// of an open cluster such as the Pleiades or the Hyades: masses from the Kroupa (2001, MNRAS 322:231) initial mass
// function up to the turn-off mass for the cluster's age, positions in a Plummer sphere, and giants for older clusters.
// Units: light-years, in the caller's frame. Pure and deterministic per seed.
import { mulberry32, hashSeed } from '../rng.js';

export const STAR_COUNTS = { high: 20000, mid: 10000, low: 5000 };   // the generated field, named stars come on top

// Share of stars, temperature range (K, hot end first) and absolute visual magnitude range (bright end first) per
// class. Within a class, temperature and magnitude move together along the main sequence.
export const SPECTRAL_MIX = [
  { cls: 'B', share: 0.001, t: [30000, 10000], mv: [-3.5, 0.6] },
  { cls: 'A', share: 0.0117, t: [10000, 7500], mv: [0.6, 2.6] },
  { cls: 'F', share: 0.0175, t: [7500, 6000], mv: [2.6, 4.4] },
  { cls: 'G', share: 0.0585, t: [6000, 5300], mv: [4.4, 5.9] },
  { cls: 'K', share: 0.129, t: [5200, 3900], mv: [5.9, 8.8] },
  { cls: 'M', share: 0.72, t: [3800, 2400], mv: [8.8, 16.5] },
  { cls: 'giant', share: 0.005, t: [5100, 3800], mv: [1.2, -1] },
  { cls: 'WD', share: 0.0575, t: [25000, 4500], mv: [10.5, 15.5] },
];

export const SUN_MV = 4.83;                    // absolute visual magnitude of the Sun
export const PC_LY = 3.261564;                 // light-years per parsec
const T_SUN = 5772;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const vec3 = (v) => Array.isArray(v) && v.length >= 3 && finite(v[0]) && finite(v[1]) && finite(v[2]);
const lerp = (a, b, s) => a + (b - a) * s;

// Visual luminosity (Sun = 1) from an absolute visual magnitude, and the flux at distance d (ly) on a scale where a
// magnitude-0 star gives 1.
export const lumFromMag = (mv) => 10 ** (-0.4 * (mv - SUN_MV));
export function fluxAt(mv, d) {
  const m = mv + 5 * Math.log10(Math.max(0.01, d) / (10 * PC_LY));
  return 10 ** (-0.4 * m);
}

// Normal deviates (Box-Muller), as in web.js but kept local so this file stands alone.
function gaussFrom(rnd) {
  let spare = 0, has = false;
  return () => {
    if (has) { has = false; return spare; }
    const r = Math.sqrt(-2 * Math.log(1 - rnd())), a = 2 * Math.PI * rnd();
    spare = r * Math.sin(a); has = true;
    return r * Math.cos(a);
  };
}

// A field of stars spread evenly through a sphere.
//   seed, count (default STAR_COUNTS[tier]), tier
//   centre    [x, y, z] ly; radius ly (default 100: at 20,000 stars that is about the real density near the Sun)
//   avoid     [{ pos, radius }]: keep generated stars out of these spheres (around named stars, or the Sun)
//   mix       a list like SPECTRAL_MIX to use instead
//   observer  where flux is measured from (default the centre)
// Returns { count, positions (Float32Array xyz, ly), temperature (Float32Array, K), absMag (Float32Array, M_V),
// lum (Float32Array, visual, Sun = 1), flux (Float32Array, magnitude 0 = 1, from the observer), cls (Uint8Array,
// index into the mix) }.
export function starField({
  seed = 1, count, tier = 'high', centre = [0, 0, 0], radius = 100, avoid = [], mix = SPECTRAL_MIX, observer,
} = {}) {
  const n = Math.max(0, Math.floor(finite(count) ? count : STAR_COUNTS[tier] ?? STAR_COUNTS.high));
  const c = vec3(centre) ? centre : [0, 0, 0];
  const R = finite(radius) && radius > 0 ? radius : 100;
  const eye = vec3(observer) ? observer : c;
  const holes = (Array.isArray(avoid) ? avoid : []).filter((h) => h && vec3(h.pos) && finite(h.radius) && h.radius > 0);
  const classes = (Array.isArray(mix) && mix.length ? mix : SPECTRAL_MIX)
    .map((m, index) => ({ ...m, index }))
    .filter((m) => finite(m.share) && m.share > 0 && Array.isArray(m.t) && Array.isArray(m.mv));
  if (!classes.length) classes.push(...SPECTRAL_MIX.map((m, index) => ({ ...m, index })));
  const total = classes.reduce((a, m) => a + m.share, 0);
  const rnd = mulberry32(hashSeed(seed, 'stars', 'field'));
  const gauss = gaussFrom(rnd);
  const positions = new Float32Array(n * 3), temperature = new Float32Array(n), absMag = new Float32Array(n);
  const lum = new Float32Array(n), flux = new Float32Array(n), cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let x, y, z, tries = 0;
    do {                                               // a uniform point in the sphere, outside every hole
      const r = R * Math.cbrt(rnd()), u = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), s = Math.sqrt(1 - u * u);
      x = c[0] + r * s * Math.cos(t); y = c[1] + r * s * Math.sin(t); z = c[2] + r * u;
    } while (++tries < 32 && holes.some((h) => (x - h.pos[0]) ** 2 + (y - h.pos[1]) ** 2 + (z - h.pos[2]) ** 2
      < h.radius * h.radius));
    let u = rnd() * total, k = 0;
    while (k < classes.length - 1 && u >= classes[k].share) { u -= classes[k].share; k++; }
    const m = classes[k];
    // Where the star sits inside its class: red dwarfs bunch in the middle (the local luminosity function peaks near
    // M_V 12), white dwarfs toward their cool, faint end, giants toward the red clump (about 5,000 K), the rest evenly.
    const s = m.cls === 'M' ? (rnd() + rnd()) / 2 : m.cls === 'WD' ? Math.sqrt(rnd()) : m.cls === 'giant'
      ? rnd() ** 1.5 : rnd();
    const T = lerp(m.t[0], m.t[1], s), mv = lerp(m.mv[0], m.mv[1], s) + 0.3 * gauss();
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    temperature[i] = T; absMag[i] = mv; lum[i] = lumFromMag(mv); cls[i] = m.index;
    flux[i] = fluxAt(mv, Math.hypot(x - eye[0], y - eye[1], z - eye[2]));
  }
  return { count: n, positions, temperature, absMag, lum, flux, cls };
}

// ---------- open clusters ----------

// Main-sequence lifetime ≈ 10 Gyr × M^−2.9 (M in solar masses), so the turn-off mass for an age in years.
export const turnOffMass = (age) => (Math.max(1e5, age) / 1e10) ** (-1 / 2.9);

// A main-sequence star of mass M: luminosity (Duric 2004 mass-luminosity steps), radius (M^0.8 below 1 solar mass,
// M^0.57 above), temperature from L = R² T⁴, and the absolute visual magnitude from the share of a blackbody's light
// near 555 nm (Planck there, over σT⁴), relative to the Sun.
export function mainSequence(M) {
  const m = Math.max(0.08, M);
  const L = m < 0.43 ? 0.23 * m ** 2.3 : m < 2 ? m ** 4 : 1.4 * m ** 3.5;
  const Rs = m < 1 ? m ** 0.8 : m ** 0.57;
  const T = T_SUN * (L / (Rs * Rs)) ** 0.25;
  const vShare = (t) => 1 / (Math.expm1(25924 / t) * t ** 4);
  const mv = SUN_MV - 2.5 * Math.log10(L * vShare(T) / vShare(T_SUN));
  return { L, R: Rs, T, mv };
}

// Members of an open cluster.
//   seed, centre [x, y, z] ly, count (members, default 500)
//   core      ly: Plummer scale radius; tidal: ly, members stop here
//   age       years: sets the turn-off mass, so a young cluster keeps its hot blue stars and an old one loses them
//   giants    how many evolved giants, or a list of [x, y, z] positions (ly) to put them at (for a known shape)
//   giantT    K, giantMag: M_V of the giants; whiteDwarfs: how many
//   minMass   solar masses, the faintest members made
//   observer  where flux is measured from (default [0, 0, 0], the Sun)
// Returns { count, positions, temperature, absMag, lum, flux (as starField), mass (Float32Array, solar masses),
// giant (Uint8Array: 0 main sequence, 1 giant, 2 white dwarf), turnOff }.
export function openCluster({
  seed = 1, centre = [0, 0, 0], count = 500, core = 8, tidal = 40, age = 1e8, giants = 0,
  giantT = 4900, giantMag = 0.4, whiteDwarfs = 0, minMass = 0.1, observer = [0, 0, 0],
} = {}) {
  const n = Math.max(0, Math.floor(finite(count) ? count : 500));
  const c = vec3(centre) ? centre : [0, 0, 0];
  const a = finite(core) && core > 0 ? core : 8;
  const rt = finite(tidal) && tidal > 0 ? tidal : 5 * a;
  const eye = vec3(observer) ? observer : [0, 0, 0];
  const mTop = Math.max(0.2, turnOffMass(finite(age) ? age : 1e8));
  const mLow = Math.min(mTop * 0.9, Math.max(0.08, finite(minMass) ? minMass : 0.1));
  const giantList = Array.isArray(giants) ? giants.filter(vec3) : [];
  const nGiants = Math.min(n, giantList.length || Math.max(0, Math.floor(finite(giants) ? giants : 0)));
  const nWd = Math.min(n - nGiants, Math.max(0, Math.floor(finite(whiteDwarfs) ? whiteDwarfs : 0)));
  const rnd = mulberry32(hashSeed(seed, 'stars', 'cluster'));
  const gauss = gaussFrom(rnd);

  // Kroupa IMF: ξ ∝ m^−1.3 below 0.5 solar masses and 0.5 m^−2.3 above (the 2 pieces meet at 0.5).
  const pieces = [[mLow, Math.min(0.5, mTop), 1.3, 1], [Math.max(0.5, mLow), mTop, 2.3, 0.5]]
    .filter(([lo, hi]) => hi > lo)
    .map(([lo, hi, al, kf]) => ({ lo, hi, al, w: kf * (lo ** (1 - al) - hi ** (1 - al)) / (al - 1) }));
  const wAll = pieces.reduce((s, p) => s + p.w, 0);
  const drawMass = () => {
    let u = rnd() * wAll, p = pieces[0];
    for (const q of pieces) { p = q; if (u < q.w) break; u -= q.w; }
    const e = 1 - p.al, v = rnd();
    return (p.lo ** e + v * (p.hi ** e - p.lo ** e)) ** (1 / e);
  };
  // Plummer sphere cut off at the tidal radius: M(<r) / M = r³ / (r² + a²)^1.5.
  const uMax = rt ** 3 / (rt * rt + a * a) ** 1.5;
  const offset = () => {
    const u = Math.max(1e-12, rnd() * uMax);
    const r = a / Math.sqrt(u ** (-2 / 3) - 1);
    const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z);
    return [r * s * Math.cos(t), r * s * Math.sin(t), r * z];
  };

  const positions = new Float32Array(n * 3), temperature = new Float32Array(n), absMag = new Float32Array(n);
  const lum = new Float32Array(n), flux = new Float32Array(n), mass = new Float32Array(n), giant = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let p, T, mv, M;
    if (i < nGiants) {                                // evolved stars just above the turn-off
      p = giantList.length ? giantList[i].map((v, j) => v - c[j]) : offset();
      T = giantT * (1 + 0.02 * gauss()); mv = giantMag + 0.25 * gauss(); M = mTop * 1.05; giant[i] = 1;
    } else if (i < nGiants + nWd) {                   // white dwarfs left by the stars that were heavier still
      p = offset(); T = 8000 + 12000 * rnd(); mv = 11 + 1.5 * rnd(); M = 0.6 + 0.2 * rnd(); giant[i] = 2;
    } else {
      p = offset(); M = drawMass();
      const ms = mainSequence(M);
      T = ms.T; mv = ms.mv + 0.1 * gauss();
    }
    const x = c[0] + p[0], y = c[1] + p[1], z = c[2] + p[2];
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    temperature[i] = T; absMag[i] = mv; lum[i] = lumFromMag(mv); mass[i] = M;
    flux[i] = fluxAt(mv, Math.hypot(x - eye[0], y - eye[1], z - eye[2]));
  }
  return { count: n, positions, temperature, absMag, lum, flux, mass, giant, turnOff: mTop };
}
