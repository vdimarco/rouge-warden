// Light Years Home: galaxies as particles, made from a seed. A spiral is log-spiral arms (theta = k ln(r / r0)), with
// an optional bar whose ends start the arms, a bulge and an exponential disc. This is the "galaxy generator" pattern
// with an explicit bar; Ingo Berg's density-wave method was considered and not used. Pass Reid et al. 2019 (ApJ
// 885:131) pitch angles and Wegg, Gerhard and Portail 2015 (MNRAS 450:4050) bar values for the Milky Way.
// Also: an elliptical, a dust-lane elliptical (like Centaurus A) and an irregular (star clouds, like the Magellanic
// Clouds). Dust and H II knots come as separate lists, since they are drawn with other blending.
// Frame: the galaxy's own, in light-years. Centre at the origin, disc in the x-y plane, z along the spin axis; angles
// are counter-clockwise seen from +z. winding +1 gives trailing arms for a disc that turns clockwise seen from +z, as
// the Milky Way does seen from the north galactic pole (galactic axes: then its bar angle is about -30 degrees).
// Pure and deterministic per seed; any prefix of the stars is a fair sample.
import { mulberry32, hashSeed } from '../rng.js';
import { gaussFrom } from './web.js';

export const GALAXY_COUNTS = { high: 80000, mid: 30000, low: 15000 };   // low: for the impostor bake only
export const GALAXY_TYPES = ['spiral', 'elliptical', 'lane', 'irregular'];
export const PARTS = ['bulge', 'bar', 'arm', 'disc', 'cloud'];        // kind codes per star particle

// Dust particles and H II knots per star particle, by type, when the caller gives none.
const DUST = { spiral: 0.25, elliptical: 0, lane: 0.3, irregular: 0.1 };
const KNOTS = { spiral: 0.004, elliptical: 0, lane: 0.002, irregular: 0.01 };
const TAU = 2 * Math.PI;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, d, lo = -Infinity, hi = Infinity) => (finite(v) ? Math.min(hi, Math.max(lo, v)) : d);

// Particles for one galaxy.
//   seed, type ('spiral' | 'elliptical' | 'lane' | 'irregular'), count (default counts[tier]), tier, counts
//   radius     ly: the disc edge, or where an elliptical's light is cut off
//   thickness  ly: disc scale height z0 (density ∝ sech²(z / z0)); default 2 % of the radius
//   arms       number of arms, or a weight per arm ([1, 0.45, 1, 0.45]: 2 major and 2 minor, majors at the bar ends)
//   pitch      degrees; armWidth: radians of scatter around each arm; winding: +1 or -1, which way the arms turn
//   barLength  ly, half-length of the bar (0: no bar); barAngle: degrees from +x; barWidth: minor / major axis
//   bulge, bar, arm: shares of the star particles (the disc gets the rest)
//   patchy     0 to 1: share of arm stars gathered into star clouds, for a flocculent spiral
//   axes       elliptical and lane: body axis ratios [x, y, z]
//   clumps     irregular: number of star clouds
//   dust, knots: dust particles and H II knots per star particle; warp: lane, degrees the dust disc twists by its edge
// Returns { type, count, positions (Float32Array xyz, ly), temperature (Float32Array, K), flux (Float32Array, about 1
// per particle), size (Float32Array, ly), kind (Uint8Array, PARTS index), dust: { count, positions, size },
// hii: { count, positions, size } }.
export function galaxyParticles({
  seed = 1, type = 'spiral', count, tier = 'high', counts = GALAXY_COUNTS,
  radius = 50000, thickness, arms = 2, pitch = 13, armWidth = 0.16, winding = 1,
  barLength = 0, barAngle = 0, barWidth = 0.3, bulge = 0.1, bar = 0.15, arm = 0.55, patchy = 0,
  axes = [1, 0.8, 0.6], clumps = 5, dust, knots, warp = 15,
} = {}) {
  const kindOf = GALAXY_TYPES.includes(type) ? type : 'spiral';
  const table = counts && typeof counts === 'object' ? counts : GALAXY_COUNTS;
  const n = Math.max(0, Math.floor(finite(count) ? count : table[tier] ?? GALAXY_COUNTS[tier] ?? GALAXY_COUNTS.high));
  const R = num(radius, 50000, 1);
  const z0 = num(thickness, 0.02 * R, 0);
  const given = Array.isArray(arms) && arms.length ? arms.slice(0, 16)
    : Array.from({ length: Math.floor(num(arms, 2, 1, 16)) }, () => 1);
  const weights = given.map((w) => num(w, 1, 0));
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const k = 1 / Math.tan(num(pitch, 13, 1, 89) * Math.PI / 180);
  const wind = winding < 0 ? -1 : 1;
  const L = num(barLength, 0, 0, R);
  const bw = num(barWidth, 0.3, 0.05, 1), aw = num(armWidth, 0.16, 0, 2);
  const phi0 = num(barAngle, 0) * Math.PI / 180;
  const r0 = Math.max(L, 0.1 * R);                     // the arms start at the bar ends, or near the centre
  const ax = (Array.isArray(axes) ? axes : [1, 0.8, 0.6]).slice(0, 3).map((a) => num(a, 1, 0.05));
  while (ax.length < 3) ax.push(1);
  const axMax = Math.max(...ax);
  const spacing = 1.77 * R / Math.sqrt(Math.max(1, n));   // mean gap between particles seen face-on
  const shareBulge = num(bulge, 0.1, 0, 1);
  const shareBar = L > 0 ? num(bar, 0.15, 0, 1) : 0;
  const shareArm = num(arm, 0.55, 0, 1);
  const cloudShare = num(patchy, 0, 0, 1);

  const rnd = mulberry32(hashSeed(seed, 'galaxy', kindOf, 'stars'));
  const gauss = gaussFrom(rnd);
  const sech2 = (h) => h * Math.atanh(Math.min(0.999999, Math.max(-0.999999, 2 * rnd() - 1)));
  // Radius on an exponential disc of scale s, from r1 out to r2.
  const expR = (r1, r2, s) => r1 - s * Math.log(1 - rnd() * (1 - Math.exp(-(r2 - r1) / s)));
  const pickArm = () => {
    let u = rnd() * wSum;
    for (let a = 0; a < weights.length; a++) { u -= weights[a]; if (u <= 0) return a; }
    return weights.length - 1;
  };
  const armAngle = (a, r) => wind * k * Math.log(r / r0) + phi0 + a * TAU / weights.length;
  // A Hernquist profile (scale a = R / 6) cut off at R: M(<r) / M = r² / (r + a)².
  const hernquist = () => {
    const a = R / 6, s = Math.sqrt(rnd() * (R / (R + a)) ** 2);
    return a * s / (1 - s);
  };
  const onSphere = () => {
    const z = 2 * rnd() - 1, t = TAU * rnd(), s = Math.sqrt(1 - z * z);
    return [s * Math.cos(t), s * Math.sin(t), z];
  };

  // Star clouds: for patchy arms (placed along the arms) and for irregulars (anywhere in the inner disc).
  const rc = mulberry32(hashSeed(seed, 'galaxy', kindOf, 'clouds'));
  const clouds = [];
  if (kindOf === 'spiral' && cloudShare > 0) {
    const per = 20;
    weights.forEach((w, a) => {
      for (let j = 0; j < per; j++) {
        const r = r0 + (R - r0) * Math.sqrt(rc()), t = armAngle(a, r);
        clouds.push({ x: r * Math.cos(t), y: r * Math.sin(t), s: 0.04 * R * (0.6 + 0.8 * rc()), w: w * (0.3 + rc()) });
      }
    });
  } else if (kindOf === 'irregular') {
    const many = Math.max(1, Math.floor(num(clumps, 5, 1, 64)));
    for (let j = 0; j < many; j++) {
      const r = 0.6 * R * Math.sqrt(rc()), t = TAU * rc();
      clouds.push({ x: r * Math.cos(t), y: r * Math.sin(t), s: R * (0.08 + 0.12 * rc()), w: 0.3 + rc() });
    }
  }
  const cloudSum = clouds.reduce((a, c) => a + c.w, 0);
  const pickCloud = () => {
    let u = rnd() * cloudSum;
    for (const c of clouds) { u -= c.w; if (u <= 0) return c; }
    return clouds[clouds.length - 1];
  };

  const positions = new Float32Array(n * 3), temperature = new Float32Array(n), flux = new Float32Array(n);
  const size = new Float32Array(n), kind = new Uint8Array(n);
  const cosB = Math.cos(phi0), sinB = Math.sin(phi0);
  const put = (i, x, y, z, T, f, s, part) => {
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    temperature[i] = T; flux[i] = f; size[i] = s * spacing; kind[i] = part;
  };
  const oldT = () => 3600 + 1200 * rnd();                // old, warm stars
  const discT = () => 3500 + 3500 * rnd();
  for (let i = 0; i < n; i++) {
    if (kindOf === 'elliptical' || kindOf === 'lane') {
      if (kindOf === 'lane' && rnd() < 0.05) {          // young blue stars along the dust lane
        const r = R * (0.15 + 0.4 * Math.sqrt(rnd())), t = TAU * rnd();
        const [x, y, z] = warpPoint(r * Math.cos(t), r * Math.sin(t), sech2(0.01 * R), r, R, warp);
        put(i, x, y, z, 9000 + 16000 * rnd(), 1.6, 0.7, 3);
        continue;
      }
      const r = hernquist(), d = onSphere();
      put(i, r * d[0] * ax[0] / axMax, r * d[1] * ax[1] / axMax, r * d[2] * ax[2] / axMax,
        3700 + 1200 * rnd(), 0.8 + 0.4 * rnd(), 1, 0);
      continue;
    }
    if (kindOf === 'irregular') {
      const u = rnd();
      if (u < shareBar) {
        const bx = gauss() * 0.5 * L, by = gauss() * bw * 0.5 * L;
        put(i, bx * cosB - by * sinB, bx * sinB + by * cosB, sech2(0.5 * z0), discT() + 1000, 1, 1, 1);
      } else if (u < shareBar + 0.6 * (1 - shareBar) && clouds.length) {
        const c = pickCloud();
        const young = rnd() < 0.3;
        put(i, c.x + gauss() * c.s, c.y + gauss() * c.s, sech2(z0), young ? 9000 + 16000 * rnd() : discT() + 1500,
          young ? 1.6 : 1, young ? 0.8 : 1, 4);
      } else {
        const r = expR(0, R, R / 3), t = TAU * rnd();
        put(i, r * Math.cos(t), r * Math.sin(t), sech2(z0), discT() + 1000, 0.9, 1, 3);
      }
      continue;
    }
    // spiral
    const u = rnd();
    if (u < shareBulge) {                               // old, round, warm bulge
      put(i, gauss() * 0.08 * R, gauss() * 0.08 * R, gauss() * 0.05 * R, oldT(), 1.1, 1.2, 0);
    } else if (u < shareBulge + shareBar) {             // a flat cigar along the bar angle
      const bx = gauss() * 0.5 * L, by = gauss() * bw * 0.5 * L;
      put(i, bx * cosB - by * sinB, bx * sinB + by * cosB, gauss() * 0.12 * bw * L, 3800 + 1200 * rnd(), 1, 1, 1);
    } else if (u < shareBulge + shareBar + shareArm) {
      const young = rnd() < 0.15;                       // young blue stars live in the arms
      const T = young ? 9000 + 21000 * rnd() : 4500 + 3000 * rnd();
      if (clouds.length && rnd() < cloudShare) {
        const c = pickCloud();
        put(i, c.x + gauss() * c.s, c.y + gauss() * c.s, sech2(0.6 * z0), T, young ? 1.8 : 1, young ? 0.8 : 1, 4);
      } else {
        const r = expR(r0, R, R / 3.5), a = pickArm(), t = armAngle(a, r) + gauss() * aw;
        const rr = r * (1 + 0.04 * gauss());
        put(i, rr * Math.cos(t), rr * Math.sin(t), sech2(0.6 * z0), T, young ? 1.8 : 1, young ? 0.8 : 1, 2);
      }
    } else {                                            // smooth exponential disc
      const r = expR(0, R, R / 4), t = TAU * rnd();
      put(i, r * Math.cos(t), r * Math.sin(t), sech2(z0), discT(), 0.9, 1, 3);
    }
  }

  // ---------- dust: on the inner (concave) edge of each arm, or in the lane ----------
  const nDust = kindOf === 'elliptical' ? 0 : Math.round(n * num(dust, DUST[kindOf], 0, 4));
  const rd = mulberry32(hashSeed(seed, 'galaxy', kindOf, 'dust'));
  const gd = gaussFrom(rd);
  const dustPos = new Float32Array(nDust * 3), dustSize = new Float32Array(nDust);
  const sd = (h) => h * Math.atanh(Math.min(0.999999, Math.max(-0.999999, 2 * rd() - 1)));
  for (let i = 0; i < nDust; i++) {
    let x, y, z;
    if (kindOf === 'lane') {
      const r = R * (0.08 + 0.5 * Math.sqrt(rd())), t = TAU * rd();
      [x, y, z] = warpPoint(r * Math.cos(t), r * Math.sin(t), sd(0.006 * R), r, R, warp);
    } else if (kindOf === 'irregular') {
      const r = 0.7 * R * Math.sqrt(rd()), t = TAU * rd();
      x = r * Math.cos(t); y = r * Math.sin(t); z = sd(0.5 * z0);
    } else {
      let u = rd() * wSum, a = 0;
      for (; a < weights.length - 1; a++) { u -= weights[a]; if (u <= 0) break; }
      // A narrow lane just inside the arm's middle, on its concave side (+θ when winding is +1).
      const r = r0 - (R / 3.5) * Math.log(1 - rd() * (1 - Math.exp(-(R - r0) / (R / 3.5))));
      const t = armAngle(a, r) + wind * 0.6 * aw + gd() * 0.25 * aw;
      x = r * Math.cos(t); y = r * Math.sin(t); z = sd(0.4 * z0);
    }
    dustPos[i * 3] = x; dustPos[i * 3 + 1] = y; dustPos[i * 3 + 2] = z;
    dustSize[i] = 2 * spacing * (0.7 + 0.6 * rd());
  }

  // ---------- H II knots: pink star-forming knots strung along the arms or the clouds ----------
  const nKnots = kindOf === 'elliptical' ? 0 : Math.round(n * num(knots, KNOTS[kindOf], 0, 1));
  const rh = mulberry32(hashSeed(seed, 'galaxy', kindOf, 'hii'));
  const gh = gaussFrom(rh);
  const hiiPos = new Float32Array(nKnots * 3), hiiSize = new Float32Array(nKnots);
  for (let i = 0; i < nKnots; i++) {
    let x, y, z;
    if (kindOf === 'spiral') {
      const a = Math.floor(rh() * weights.length) % weights.length;
      const r = r0 + (R - r0) * Math.sqrt(rh()), t = armAngle(a, r) + gh() * 0.5 * aw;
      x = r * Math.cos(t); y = r * Math.sin(t); z = gh() * 0.3 * z0;
    } else if (kindOf === 'irregular' && clouds.length) {
      const c = clouds[Math.floor(rh() * clouds.length)];
      x = c.x + gh() * c.s; y = c.y + gh() * c.s; z = gh() * 0.3 * z0;
    } else {
      const r = R * (0.15 + 0.4 * Math.sqrt(rh())), t = TAU * rh();
      [x, y, z] = warpPoint(r * Math.cos(t), r * Math.sin(t), 0, r, R, warp);
    }
    hiiPos[i * 3] = x; hiiPos[i * 3 + 1] = y; hiiPos[i * 3 + 2] = z;
    hiiSize[i] = 3 * spacing * (0.6 + 0.8 * rh());
  }

  return {
    type: kindOf, count: n, positions, temperature, flux, size, kind,
    dust: { count: nDust, positions: dustPos, size: dustSize },
    hii: { count: nKnots, positions: hiiPos, size: hiiSize },
  };
}

// The lane of a dust-lane galaxy is a disc that twists about x as it goes out: warp degrees at radius 0.55 R.
function warpPoint(x, y, z, r, R, warp) {
  const a = num(warp, 15) * Math.PI / 180 * Math.min(1, r / (0.55 * R));
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

