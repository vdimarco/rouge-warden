// Light Years Home: galaxies. bakeImpostor draws a galaxy's particles (core/gen/galaxy.js) face-on into a texture
// once; createImpostor shows that texture as a disc with a bulge billboard for far views; createMilkyWayParticles
// draws the Milky Way as particles for the fly-in, with a dust pass that darkens what lies behind it.
// This file also holds what the art modules share: value noise, the blackbody table and Doppler tint, and the
// uniforms render/view.js feeds every frame (uFade, uDoppler, uTime, uPxPerRad, uRatio, and uSun for planets).
// view.js places each object at its aberrated centre and shrinks it by 1/D, so mesh shaders here do not aberrate.
// Sources: the log-spiral "galaxy generator" pattern with an explicit bar (Wegg, Gerhard and Portail 2015 for the
// Milky Way's); dust as darkening, after Hildebrand, Magnor and Fröhlich (WSCG 2006); spiral dust threads from
// I. Quilez's domain warping in unwound polar coordinates; orientations from each galaxy's Wikipedia infobox.
import * as THREE from 'three';
import { galaxyParticles, GALAXY_COUNTS } from '../core/gen/galaxy.js';
import { blackbodyRGB, lutData, LNY_K } from '../core/physics.js';
import { OBJECTS } from '../core/objects.js';
import { mulberry32, hashSeed } from '../core/rng.js';

const D2R = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- shared shader pieces ----------

// Value noise and fbm with a hash that has no sin (Dave Hoskins, "Hash without Sine"), safe at mediump.
export const GLSL_NOISE = /* glsl */ `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)),
      hash13(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
      mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1;
    a *= 0.5; } return s; }
  float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1;
    a *= 0.5; } return s / 0.875; }
`;

// The blackbody table (core/physics.js lutData), the same one render/points.js builds.
const LUT_SIZE = 256, LUT_TMIN = 500, LUT_TMAX = 200000;
let lutTexture = null;
export function artLut() {
  if (lutTexture) return lutTexture;
  lutTexture = new THREE.DataTexture(lutData(LUT_SIZE, LUT_TMIN, LUT_TMAX), LUT_SIZE, 1, THREE.RGBAFormat,
    THREE.UnsignedByteType);
  lutTexture.colorSpace = THREE.SRGBColorSpace;
  lutTexture.minFilter = lutTexture.magFilter = THREE.LinearFilter;
  lutTexture.wrapS = lutTexture.wrapT = THREE.ClampToEdgeWrapping;
  lutTexture.generateMipmaps = false;
  lutTexture.needsUpdate = true;
  return lutTexture;
}

// Colour of temperature T, and the Doppler tint of a glow: new hue over old, times the brightness change of a diffuse
// source, exp(lnY(DT) − lnY(T)) (no solid-angle term), clamped so a blueshifted galaxy does not burn the screen out.
export const GLSL_COLOR = /* glsl */ `
  uniform sampler2D uLUT;
  float lnYb(float T) { float x = ${LNY_K.toFixed(1)} / T; return -(x + log(1.0 - exp(-x))); }
  vec3 bbRGB(float T) {
    float u = clamp(log(T / ${LUT_TMIN.toFixed(1)}) / log(${(LUT_TMAX / LUT_TMIN).toFixed(1)}), 0.0, 1.0);
    return texture2D(uLUT, vec2((u * ${(LUT_SIZE - 1).toFixed(1)} + 0.5) / ${LUT_SIZE.toFixed(1)}, 0.5)).rgb;
  }
  vec3 dopplerTint(float T, float D) {
    if (abs(D - 1.0) < 1e-4) return vec3(1.0);
    float TD = clamp(T * D, ${LUT_TMIN.toFixed(1)}, ${LUT_TMAX.toFixed(1)});
    vec3 tint = bbRGB(TD) / max(bbRGB(T), vec3(0.05));
    return min(tint, vec3(6.0)) * exp(clamp(lnYb(TD) - lnYb(T), -24.0, 2.0));
  }
`;

// Uniforms every art mesh declares; render/view.js sets them per object each frame (uFade: layer weight × fade,
// uDoppler: D at the centre, uTime: seconds, uPxPerRad: CSS px per radian, uRatio: device px per CSS px).
export function artUniforms(own = {}) {
  return {
    uFade: { value: 1 }, uDoppler: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 500 },
    uRatio: { value: 1 }, uLUT: { value: artLut() }, ...own,
  };
}

// Set uniform values on every material under an object, the way view.js feeds them (for use without view.js).
export function setUniforms(object, values) {
  object.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      const u = m.uniforms;
      if (!u) continue;
      for (const [k, v] of Object.entries(values)) {
        if (!u[k]) continue;
        if (u[k].value && u[k].value.isVector3 && Array.isArray(v)) u[k].value.set(v[0], v[1], v[2]);
        else if (u[k].value && u[k].value.isVector3 && v && v.isVector3) u[k].value.copy(v);
        else if (typeof v === 'number') u[k].value = v;
      }
    }
  });
  return object;
}

// Crossfade weight for anything made here (a mesh, points or a group of them).
export function setOpacity(object, w) {
  const v = clamp(finite(w) ? w : 1, 0, 1);
  setUniforms(object, { uFade: v });
  object.visible = v > 0.002;
  return object;
}

// GPU bytes of a texture baked here (own accounting, as view.js counts: width × height × 4, + 1/3 with mipmaps).
export function textureBytes(tex) {
  return tex && tex.userData && finite(tex.userData.bytes) ? tex.userData.bytes : 0;
}

// ---------- relativity for points (the Milky Way particles) ----------

// The shared light-speed uniforms in render/points.js's shape. view.js passes its own (opts.shared); without it the
// particles use these, filled by setRelativity(cam, { height, ratio }) from core/geo.cameraFor.
export const REL = {
  uExpPhi: { value: 1 }, uExpMinusPhi: { value: 1 }, uVel: { value: new THREE.Vector3(0, 0, -1) },
  uLUT: { value: null }, uRatio: { value: 1 }, uPxPerRad: { value: 500 },
};
export function setRelativity(cam = {}, view = {}) {
  REL.uExpPhi.value = finite(cam.expPhi) ? cam.expPhi : 1;
  REL.uExpMinusPhi.value = finite(cam.expMinusPhi) ? cam.expMinusPhi : 1;
  const v = cam.velocityView;
  if (Array.isArray(v) && v.every(finite) && Math.hypot(...v) > 0) REL.uVel.value.set(v[0], v[1], v[2]).normalize();
  if (finite(view.ratio)) REL.uRatio.value = view.ratio;
  if (finite(view.height) && finite(cam.fovY)) REL.uPxPerRad.value = view.height / 2 / Math.tan(cam.fovY * D2R / 2);
  return REL;
}

// Stereographic aberration, the same maths as core/physics.js aberrate: tan(θ'/2) = e^−φ tan(θ/2), and
// D = (e^φ + t² e^−φ) / (1 + t²).
const GLSL_ABERRATE = /* glsl */ `
  uniform float uExpPhi, uExpMinusPhi, uRatio, uPxPerRad;
  uniform vec3 uVel;
  vec3 aberrateDir(vec3 n, out float D) {
    D = 1.0;
    if (uExpPhi <= 1.0) return n;
    float c = dot(n, uVel);
    vec3 p = n - c * uVel;
    float s = length(p);
    if (s < 1e-7) { D = c > 0.0 ? uExpPhi : uExpMinusPhi; return n; }
    float opc = 0.5 * dot(n + uVel, n + uVel);
    float cs, sn;
    if (c >= -0.9) {
      float t = s / opc, t2 = t * t;
      D = (uExpPhi + t2 * uExpMinusPhi) / (1.0 + t2);
      float tp = uExpMinusPhi * t, q = tp * tp;
      cs = (1.0 - q) / (1.0 + q); sn = 2.0 * tp / (1.0 + q);
    } else {
      float w = opc / s, w2 = w * w;
      D = (uExpPhi * w2 + uExpMinusPhi) / (w2 + 1.0);
      float wp = uExpPhi * w, q = wp * wp;
      cs = (q - 1.0) / (q + 1.0); sn = 2.0 * wp / (q + 1.0);
    }
    return cs * uVel + sn * (p / s);
  }
`;

// ---------- orientation ----------

// J2000 equatorial to galactic rotation (Hipparcos), the same one objects.js used for positions.
const EQ_TO_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];
const toGal = (v) => EQ_TO_GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

// Disc normal in galactic axes for a galaxy at RA, Dec (degrees) whose major axis lies at position angle pa (north
// through east) and whose disc is tilted incl degrees to our line of sight (0 face-on, 90 edge-on).
export function discNormal(raDeg, decDeg, paDeg, inclDeg) {
  const a = raDeg * D2R, d = decDeg * D2R, p = (paDeg + 90) * D2R, i = inclDeg * D2R;
  const los = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const east = [-Math.sin(a), Math.cos(a), 0];
  const minor = north.map((v, k) => v * Math.cos(p) + east[k] * Math.sin(p));
  return toGal(los.map((v, k) => -v * Math.cos(i) + minor[k] * Math.sin(i)));
}

// ---------- the galaxies ----------

// Texture sizes per tier (impostorSize): big: true (the Milky Way, which fills the screen at its reveal) gets twice.
export const IMPOSTOR_SIZES = { high: { small: 512, big: 1024 }, mid: { small: 256, big: 512 },
  low: { small: 256, big: 512 } };

// How a bake looks: gain (star light), exposure (tone curve), compress (soft knee before it), white (how far the
// core burns to white), spread (sprite size × particle size), sparkle (share of hot stars drawn as fine points),
// bloom, dust (optical depth per dust point), dustSpread, dustJitter (scatters the dust lane, in particle gaps),
// wisps (spiral dust threads), knots (H II light), warm and cool (tints inside and outside warmR × radius), cover
// (alpha of the disc), margin (texture half-width / radius), tilt (degrees about x before the bake, to see a lane
// edge-on), stretch ([x, y] squash for elongated irregulars), bulge [r, g, b], bulgeR (share of the radius) and
// bulgeGain for the billboard that keeps a bulge when the disc is seen edge-on, temperature (K, for the Doppler tint).
const LOOK = { gain: 1, exposure: 2.2, compress: 1.2, white: 0.2, spread: 3, sparkle: 0.25, bloom: 1, dust: 0.3,
  dustSpread: 2.2, dustJitter: 2.5, wisps: 0.9, knots: 0.4, warm: [1.2, 0.86, 0.56], cool: [0.86, 0.96, 1.16],
  warmR: 0.45, cover: 1.6, margin: 1.12, tilt: 0, stretch: [1, 1], bulge: [1.0, 0.82, 0.62], bulgeR: 0.12,
  bulgeGain: 0.7, temperature: 5200 };

// One entry per galaxy the game draws. params go to core/gen/galaxy.js; orient is { ra, dec, pa, incl } for a disc
// seen truly in 3D, normal for a given one, or facing for a billboard (ellipticals, irregulars, Centaurus A's lane).
export const GALAXIES = {
  'milky-way': {
    big: true,
    params: { seed: 'milky-way', type: 'spiral', radius: 43700, barLength: 16300, barAngle: -30,
      arms: [1, 0.45, 1, 0.45], pitch: 13.5, armWidth: 0.22, winding: 1, bulge: 0.03, bar: 0.3, barWidth: 0.25,
      arm: 0.55, patchy: 0.1, dust: 0.35, knots: 0.004 },
    look: { bulge: [1.0, 0.86, 0.66], bulgeR: 0.13, bulgeGain: 0.9 },
    orient: { normal: [0, 0, 1] },
  },
  andromeda: {
    params: { seed: 'andromeda', type: 'spiral', radius: 75950, barLength: 9000, barAngle: 20, barWidth: 0.5,
      arms: [1, 0.6, 1, 0.6], pitch: 10, armWidth: 0.4, bulge: 0.25, bar: 0.05, arm: 0.35, patchy: 0.08, dust: 0.38,
      knots: 0.003 },
    look: { bulge: [1.0, 0.84, 0.64], bulgeR: 0.11, cool: [0.95, 0.97, 1.05], sparkle: 0.1, spread: 3.5, wisps: 1.1,
      dust: 0.45 },
    orient: { ra: 10.6847, dec: 41.2690, pa: 38, incl: 77 },
  },
  triangulum: {
    params: { seed: 'triangulum', type: 'spiral', radius: 30550, arms: 2, pitch: 21, armWidth: 0.4, bulge: 0.03,
      arm: 0.62, patchy: 0.65, dust: 0.14, knots: 0.012 },
    look: { dust: 0.18, knots: 1.6, bulge: [1.0, 0.9, 0.78], bulgeR: 0.06, bulgeGain: 0.35, temperature: 6500 },
    orient: { ra: 23.4621, dec: 30.6599, pa: 23, incl: 55 },
  },
  m32: {
    params: { seed: 'm32', type: 'elliptical', radius: 4000, axes: [1, 0.73, 0.7] },
    look: { white: 0.5, spread: 6, sparkle: 0, temperature: 4600 }, orient: { facing: true, roll: 160 },
  },
  m110: {
    params: { seed: 'm110', type: 'elliptical', radius: 8525, axes: [1, 0.5, 0.45] },
    look: { white: 0.3, spread: 6, sparkle: 0, temperature: 4800 }, orient: { facing: true, roll: 170 },
  },
  m81: {
    params: { seed: 'm81', type: 'spiral', radius: 48000, arms: 2, pitch: 14, armWidth: 0.2, bulge: 0.2, arm: 0.5,
      dust: 0.3, knots: 0.004 },
    look: { bulgeR: 0.12 },
    orient: { ra: 148.8882, dec: 69.0653, pa: 157, incl: 59 },
  },
  'cen-a': {
    params: { seed: 'cen-a', type: 'lane', radius: 61550, axes: [1, 0.9, 0.85], dust: 0.45, knots: 0.002, warp: 18 },
    look: { dust: 0.5, dustSpread: 3, dustJitter: 1.2, tilt: 82, spread: 5, sparkle: 0.1, white: 0.4,
      temperature: 4700 }, orient: { facing: true, roll: -35 },
  },
  ngc6822: {
    params: { seed: 'ngc6822', type: 'irregular', radius: 4600, barLength: 1700, barAngle: 10, barWidth: 0.35,
      bar: 0.3, clumps: 7, knots: 0.012 },
    look: { knots: 1.6, stretch: [1, 0.8], temperature: 6500 }, orient: { facing: true, roll: 5 },
  },
  lmc: {
    params: { seed: 'lmc', type: 'irregular', radius: 16100, barLength: 5200, barAngle: 15, barWidth: 0.3,
      bar: 0.28, clumps: 7, knots: 0.01 },
    look: { knots: 1.5, temperature: 6500 },
    orient: { ra: 80.8942, dec: -69.7561, pa: 170, incl: 35 },
  },
  smc: {
    params: { seed: 'smc', type: 'irregular', radius: 9450, clumps: 5, knots: 0.008 },
    look: { knots: 1.3, stretch: [1, 0.5], temperature: 6500 }, orient: { facing: true, roll: 45 },
  },
  'sgr-dwarf': {
    params: { seed: 'sgr-dwarf', type: 'elliptical', radius: 5250, axes: [1, 0.35, 0.3] },
    look: { exposure: 0.8, gain: 0.6, white: 0.3, spread: 6, sparkle: 0, temperature: 4800 },
    orient: { facing: true, roll: 100 },
  },
  // Small spirals for the waypoints on the cosmic path (not catalogue objects).
  'wp-grand': {
    params: { seed: 'wp-grand', type: 'spiral', radius: 50000, arms: 2, pitch: 15, armWidth: 0.18, bulge: 0.15,
      dust: 0.25 },
    look: {}, orient: {},
  },
  'wp-barred': {
    params: { seed: 'wp-barred', type: 'spiral', radius: 45000, barLength: 12000, barAngle: 0, arms: 2, pitch: 12,
      armWidth: 0.2, bulge: 0.04, bar: 0.25, dust: 0.25 },
    look: {}, orient: {},
  },
  'wp-flocculent': {
    params: { seed: 'wp-flocculent', type: 'spiral', radius: 35000, arms: 3, pitch: 20, armWidth: 0.35, bulge: 0.06,
      patchy: 0.5, dust: 0.15, knots: 0.008 },
    look: { bulgeR: 0.08, temperature: 6200 }, orient: {},
  },
};
export const WAYPOINT_GALAXIES = ['wp-grand', 'wp-barred', 'wp-flocculent'];

// The Milky Way's particle parameters (galactic axes, centre at Sgr A*): bar half-length 5 kpc at -30° (Wegg, Gerhard
// and Portail 2015), two major and two minor arms starting at the bar ends, pitch 13.5° (Reid et al. 2019 give 11 to
// 14°), which puts a minor arm through the Sun, as the Local (Orion) arm is. Use the same object for the particles
// and the impostor bake, so they match where one crossfades into the other.
export const MILKY_WAY = { ...GALAXIES['milky-way'].params };

// Size of the bake for a galaxy id and tier.
export function impostorSize(id, tier = 'mid') {
  const s = IMPOSTOR_SIZES[tier] || IMPOSTOR_SIZES.mid;
  return GALAXIES[id] && GALAXIES[id].big ? s.big : s.small;
}

// Particles to make for a bake: the tier's count for the Milky Way (at least 30,000), else with the texture area
// (16,000 at 256 px, so the disc is smooth; 30,000 at 512).
export function impostorCount(id, size = 256, tier = 'mid') {
  if (GALAXIES[id] && GALAXIES[id].big) return Math.max(GALAXY_COUNTS[tier] || GALAXY_COUNTS.mid, 30000);
  return clamp(Math.round(30000 * (size / 512) ** 2), 16000, 60000);
}
function bakeCount(params, size, big) {
  if (finite(params.count)) return params.count;
  if (big) return impostorCount('milky-way', size, params.tier);
  return impostorCount(null, size);
}

// Linear sRGB of temperature T from a 256-entry table (blackbodyRGB is too slow per particle).
const BB = (() => {
  const n = 256, t = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rgb = blackbodyRGB(LUT_TMIN * (LUT_TMAX / LUT_TMIN) ** (i / (n - 1)));
    t[i * 3] = rgb[0]; t[i * 3 + 1] = rgb[1]; t[i * 3 + 2] = rgb[2];
  }
  return t;
})();
const BB_K = 255 / Math.log(LUT_TMAX / LUT_TMIN);
function bbInto(out, o, T, k) {
  const f = clamp(Math.log(T / LUT_TMIN) * BB_K, 0, 254.999), i = Math.floor(f), w = f - i;
  for (let c = 0; c < 3; c++) out[o + c] = k * (BB[i * 3 + c] * (1 - w) + BB[(i + 1) * 3 + c] * w);
}

// ---------- the bake ----------

const BAKE_VS = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    vColor = aColor;
  }`;
const BAKE_FS = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(vColor * exp(-4.0 * r2), 1.0);
  }`;

// Soft photographic look: the stars plus three blurred copies from the mip chain, tinted warm inside and cool
// outside (old stars and reddening in the middle, young arms at the edge), then dimmed by the dust's optical depth,
// which is kept sharp so lanes survive the blur, plus thin dust threads along the spiral. A soft knee and an
// exponential shoulder burn the core toward white. Alpha comes from the blurred light and the dust, so lanes still
// hide what is behind. Stored with a gamma of 2 (sqrt) so faint outer arms keep their steps in 8 bits.
const COMPOSITE_FS = /* glsl */ `
  ${GLSL_NOISE}
  uniform sampler2D uAcc, uDust;
  uniform float uExposure, uBloom, uWhite, uCover, uMargin, uWarmR, uDustK, uWisps, uPitchK, uR0, uSeed, uCompress;
  uniform vec3 uWarm, uCool;
  varying vec2 vUv;
  void main() {
    vec3 a0 = textureLod(uAcc, vUv, 0.0).rgb;
    vec3 a1 = textureLod(uAcc, vUv, 1.3).rgb;
    vec3 a2 = textureLod(uAcc, vUv, 2.6).rgb;
    vec3 a3 = textureLod(uAcc, vUv, 4.0).rgb;
    vec3 c = (a0 * 0.22 + a1 * 0.38 + (a2 * 0.26 + a3 * 0.14) * uBloom) * uExposure;
    vec2 q = (vUv * 2.0 - 1.0) * uMargin;
    float r = length(q);
    c *= mix(uWarm, uCool, smoothstep(uWarmR * 0.35, uWarmR * 1.4, r));
    vec3 tau = textureLod(uDust, vUv, 0.4).rgb * uDustK;
    // Dust threads that follow the spiral: noise in unwound polar coordinates (θ − k ln r), ridged so it makes thin
    // dark lines, strongest in the inner and middle disc.
    if (uWisps > 0.0) {
      float th = atan(q.y, q.x) - uPitchK * log(max(r, 1e-3) / uR0);
      vec3 sp = vec3(cos(th) * 2.2, sin(th) * 2.2, log(max(r, 1e-3)) * 5.0 + uSeed);
      float w = fbm(sp + 1.7 * vec3(fbm(sp * 1.9 + 3.1), fbm(sp * 1.9 + 7.7), 0.0));
      float ridge = pow(max(1.0 - abs(2.0 * w - 1.0), 0.0), 5.0);
      float zone = smoothstep(0.06, 0.2, r) * (1.0 - smoothstep(0.55, 0.95, r));
      tau += vec3(0.8, 1.0, 1.2) * ridge * zone * uWisps;
    }
    c *= exp(-tau);
    c /= 1.0 + c * uCompress;
    vec3 m = 1.0 - exp(-c);
    float L = dot(m, vec3(0.2126, 0.7152, 0.0722));
    m = mix(m, vec3(L) * 1.04, smoothstep(0.6, 1.0, L) * uWhite);
    float edge = smoothstep(1.0, 0.86, length(vUv * 2.0 - 1.0));
    m *= edge;
    float glow = dot(a3 + a2, vec3(0.2126, 0.7152, 0.0722)) * uExposure * uCover;
    float alpha = clamp(max(glow + tau.g * 0.5, L * 1.4), 0.0, 0.97) * edge;
    gl_FragColor = vec4(sqrt(clamp(m, 0.0, 1.0)), alpha);
  }`;
const QUAD_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Bakes a galaxy seen face-on (or from the side with look.tilt) into a texture of size × size (impostorSize(id, tier)
// gives the size for a tier).
// params: core/gen/galaxy.js params plus look (see LOOK) and data (particles already made). With an id from GALAXIES
// the preset's shape and look win over the caller's (the art is tuned here); pass preset: false to use the caller's
// params alone, or override: { ... } to change a few. Returns the texture; texture.userData holds { rt, bytes, margin,
// look, id, radius, facing, type }. Dispose with texture.userData.rt.dispose(). Cost: one particle pass, one dust
// pass and one full-screen pass (40 to 250 ms in SwiftShader, a few ms on a GPU), after making the particles.
export function bakeImpostor(renderer, params = {}, size = 512) {
  const preset = params.id && GALAXIES[params.id] && params.preset !== false ? GALAXIES[params.id] : null;
  const p = { ...params, ...(preset ? preset.params : {}), ...(params.override || {}) };
  const look = { ...LOOK, ...(preset ? preset.look : {}), ...(params.look || {}) };
  const big = Boolean(preset && preset.big);
  const S = clamp(Math.round(finite(size) ? size : 512), 32, 1024);
  const data = p.data || galaxyParticles({ ...p, count: bakeCount(p, S, big) });
  const R = finite(p.radius) ? p.radius : 50000;
  const E = R * look.margin;
  const pxPerLy = S / (2 * E);
  const n = data.count;
  const tilt = (look.tilt || 0) * D2R, ct = Math.cos(tilt), st = Math.sin(tilt);
  const [sx, sy] = look.stretch || [1, 1];
  const place = (src, i, out) => {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
    out[i * 3] = x * sx;
    out[i * 3 + 1] = (y * ct - z * st) * sy;
    out[i * 3 + 2] = y * st + z * ct;
  };
  // Light per particle: count-independent, and per texel the same at any bake size. A sprite of s px spreads its
  // light as exp(-4 r²), whose sum over the sprite is about 0.19 s².
  const norm = look.gain * (30000 / Math.max(n, 1)) * (S / 512) ** 2;
  // Most particles are broad soft sprites (the unresolved light); some hot stars are fine sparkles.
  const rnd = mulberry32(hashSeed(p.seed ?? 1, 'bake'));
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n);
  const fine = Math.max(1.5, S / 340);
  for (let i = 0; i < n; i++) {
    place(data.positions, i, pos);
    const T = data.temperature[i];
    const sparkle = T > 8500 && rnd() < look.sparkle;
    siz[i] = sparkle ? fine : clamp(data.size[i] * pxPerLy * look.spread, 1.5, 64);
    bbInto(col, i * 3, T, (norm * data.flux[i] * (sparkle ? 0.6 : 1)) / (0.19 * siz[i] * siz[i]));
  }
  const light = new THREE.Scene(), shade = new THREE.Scene();
  const mats = [], geos = [];
  const points = (scene, positions, colors, sizes) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: BAKE_FS, depthTest: false,
      depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    scene.add(o);
    mats.push(m); geos.push(g);
  };
  points(light, pos, col, siz);
  if (data.hii && data.hii.count && look.knots > 0) {
    const m = data.hii.count, hp = new Float32Array(m * 3), hc = new Float32Array(m * 3), hs = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      place(data.hii.positions, i, hp);
      hs[i] = clamp(data.hii.size[i] * pxPerLy * 0.45, 1.5, 24);
      const k = (look.knots * 6 * norm) / (0.19 * hs[i] * hs[i]);
      hc[i * 3] = k; hc[i * 3 + 1] = k * 0.3; hc[i * 3 + 2] = k * 0.45;
    }
    points(light, hp, hc, hs);
  }
  // Dust: optical depth, slightly larger in blue so it reddens what it dims, as real dust does.
  let hasDust = false;
  if (data.dust && data.dust.count && look.dust > 0) {
    const m = data.dust.count, dp = new Float32Array(m * 3), dc = new Float32Array(m * 3), ds = new Float32Array(m);
    const jitter = look.dustJitter * 1.77 * R / Math.sqrt(Math.max(n, 1));
    const g = () => (rnd() + rnd() + rnd() - 1.5) * 1.4;
    for (let i = 0; i < m; i++) {
      place(data.dust.positions, i, dp);
      dp[i * 3] += g() * jitter; dp[i * 3 + 1] += g() * jitter;
      ds[i] = clamp(data.dust.size[i] * pxPerLy * look.dustSpread, 1.5, 64);
      const k = look.dust * (S / 512) ** 2 * (30000 / Math.max(n, 1)) * 6 / (0.19 * ds[i] * ds[i]);
      dc[i * 3] = k * 0.8; dc[i * 3 + 1] = k; dc[i * 3 + 2] = k * 1.2;
    }
    points(shade, dp, dc, ds);
    hasDust = true;
  }
  const ext = renderer.extensions;
  const hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
  const target = () => new THREE.WebGLRenderTarget(S, S, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter });
  const acc = target(), dust = target();
  const out = new THREE.WebGLRenderTarget(S, S, { type: THREE.UnsignedByteType, depthBuffer: false,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.OrthographicCamera(-E, E, E, -E, -1e9, 1e9);
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(acc);
  renderer.render(light, cam);
  renderer.setRenderTarget(dust);
  renderer.render(shade, cam);
  const comp = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: COMPOSITE_FS, depthTest: false,
    depthWrite: false, uniforms: {
      uAcc: { value: acc.texture }, uDust: { value: dust.texture },
      uExposure: { value: look.exposure * (hdr ? 1 : 0.25) }, uBloom: { value: look.bloom },
      uWhite: { value: look.white }, uCover: { value: look.cover }, uMargin: { value: look.margin },
      uWarmR: { value: look.warmR }, uWarm: { value: new THREE.Vector3(...look.warm) },
      uCool: { value: new THREE.Vector3(...look.cool) }, uDustK: { value: hasDust ? (hdr ? 1 : 4) : 0 },
      uWisps: { value: p.type === 'spiral' || !p.type ? look.wisps : 0 },
      uPitchK: { value: (p.winding < 0 ? -1 : 1) / Math.tan(clamp(finite(p.pitch) ? p.pitch : 13, 1, 89) * D2R) },
      uR0: { value: Math.max(finite(p.barLength) ? p.barLength : 0, 0.1 * R) / R },
      uSeed: { value: hashUnit(String(p.seed ?? 1)) * 50 }, uCompress: { value: look.compress },
    } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
  quad.frustumCulled = false;
  const qs = new THREE.Scene();
  qs.add(quad);
  renderer.setRenderTarget(out);
  renderer.render(qs, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.autoClear = prevAuto;
  for (const m of mats) m.dispose();
  for (const g of geos) g.dispose();
  comp.dispose(); quad.geometry.dispose(); acc.dispose(); dust.dispose();
  const tex = out.texture;
  tex.name = `impostor:${params.id || p.seed || ''}`;
  tex.userData = { rt: out, bytes: Math.round(S * S * 4 * 4 / 3), margin: look.margin, look, id: params.id || null,
    radius: R, facing: Boolean(preset && preset.orient.facing), type: p.type || 'spiral' };
  return tex;
}

// ---------- impostors ----------

// One mesh, three quads: 0 the disc in the object's x-y plane; 1 the bulge billboard (it keeps a bulge, crossed by
// the dust lane, when the disc is seen edge-on); 2 a camera-facing card (ellipticals, irregulars, and the soft dot a
// galaxy becomes when it is under uMinPx on screen).
const IMPOSTOR_VS = /* glsl */ `
  attribute vec2 aCorner;
  attribute float aPart;
  uniform float uBulgeR, uMinPx, uRoll, uLaneR, uFacing, uPxPerRad, uRatio;
  varying vec2 vUv, vB;
  varying float vPart, vEdge, vDot, vLane;
  void main() {
    vec3 centre = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float scale = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    float dist = max(length(centre), 1e-30);
    vec3 dir = centre / dist;
    vec3 nv = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
    vEdge = 1.0 - abs(dot(dir, nv));
    // Axes at right angles to the line of sight, x to the right on screen.
    vec3 up0 = abs(dir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 bx = normalize(cross(dir, up0)), by = cross(bx, dir);
    float rPx = scale / dist * uPxPerRad * uRatio;   // the galaxy's radius on screen, device px
    float minPx = uMinPx * uRatio;
    bool small = rPx < minPx;
    vDot = 0.0;
    vPart = aPart;
    vUv = aCorner * 0.5 + 0.5;
    vB = aCorner;
    vLane = 0.0;
    vec3 offset;
    if (aPart < 0.5) {
      offset = (modelViewMatrix * vec4(aCorner, 0.0, 0.0)).xyz;
    } else {
      float s = aPart < 1.5 ? uBulgeR * scale : scale;
      float cr = cos(uRoll), sr = sin(uRoll);
      vec2 c = aPart < 1.5 ? aCorner : vec2(cr * aCorner.x - sr * aCorner.y, sr * aCorner.x + cr * aCorner.y);
      if (small && aPart > 1.5) { s *= minPx / max(rPx, 1e-6); vDot = 1.0; }
      offset = (bx * c.x + by * c.y) * s;
      if (aPart < 1.5) {
        // Where the line of sight through this point of the bulge crosses the disc plane: in front of the bulge and
        // inside the dust disc, the lane darkens it.
        float dn = dot(dir, nv);
        float t = -dot(offset, nv) / (abs(dn) < 1e-3 ? (dn < 0.0 ? -1e-3 : 1e-3) : dn);
        float hit = length(offset + t * dir) / scale;
        vLane = t < 0.0 ? exp(-(hit / uLaneR) * (hit / uLaneR)) : 0.0;
      }
    }
    // A small disc galaxy draws only its dot; a big one never draws the facing card.
    if ((aPart < 1.5 && small) || (aPart > 1.5 && uFacing < 0.5 && !small)) offset *= 0.0;
    gl_Position = projectionMatrix * vec4(centre + offset, 1.0);
  }`;

const IMPOSTOR_FS = /* glsl */ `
  ${GLSL_COLOR}
  uniform sampler2D uMap;
  uniform float uTemp, uBulgeGain, uLane, uHasDisc, uFade, uDoppler;
  uniform vec3 uBulgeColor, uDotColor;
  varying vec2 vUv, vB;
  varying float vPart, vEdge, vDot, vLane;
  void main() {
    vec3 rgb; float a;
    if (vPart < 0.5 || (vPart > 1.5 && vDot < 0.5)) {
      vec4 t = texture2D(uMap, vUv);
      rgb = t.rgb * t.rgb; a = t.a;
    } else if (vPart > 1.5) {
      float g = max(exp(-dot(vB, vB) * 4.0) - 0.0183, 0.0);
      rgb = uDotColor * g; a = g * 0.6;
    } else {
      float r2 = dot(vB, vB);
      float g = max(exp(-r2 * 4.0) - 0.0183, 0.0) * uBulgeGain * (0.08 + 0.92 * pow(max(vEdge, 0.0), 1.5)) * uHasDisc;
      float lane = clamp(vLane * uLane * vEdge * 1.6, 0.0, 0.92);
      rgb = uBulgeColor * g * (1.0 - lane);
      a = min(1.0, g * 0.7 + lane * smoothstep(1.0, 0.3, r2) * 0.9);
    }
    gl_FragColor = vec4(rgb * dopplerTint(uTemp, uDoppler) * uFade, a * uFade);
    #include <colorspace_fragment>
  }`;

let impostorGeo = null, facingGeo = null;
function impostorGeometry(facing) {
  if (!impostorGeo) {
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const c = [], part = [];
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 4; j++) { c.push(corners[j * 2], corners[j * 2 + 1]); part.push(k); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array(c), 2));
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(part), 1));
    facingGeo = g.clone();
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
    facingGeo.setIndex([8, 9, 10, 8, 10, 11]);
    for (const x of [g, facingGeo]) x.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    impostorGeo = g;
  }
  return facing ? facingGeo : impostorGeo;
}

// Rotation that takes the object's z axis to the disc normal (galactic axes), its x axis toward galactic x as far
// as possible, then spins it by spin degrees about the normal.
function discQuaternion(normal, spinDeg = 0) {
  const z = new THREE.Vector3(...normal).normalize();
  const ref = Math.abs(z.z) > 0.99 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, 1);
  const x = new THREE.Vector3().crossVectors(z, ref).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spinDeg * D2R));
}

// A number in [0, 1) from a string (FNV-1a).
function hashUnit(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// The normal a preset's orientation gives (galactic axes), or null for a facing card or when none is known.
export function presetNormal(id, incl) {
  const o = GALAXIES[id] && GALAXIES[id].orient;
  if (!o || o.facing) return null;
  if (Array.isArray(o.normal)) return o.normal;
  if (!finite(o.ra) || !finite(o.dec)) return null;
  return discNormal(o.ra, o.dec, finite(o.pa) ? o.pa : 0, finite(incl) ? incl : o.incl);
}

// A far view of one galaxy. tex: from bakeImpostor. With no opts it is built the way render/view.js wants it: in its
// own frame, the disc in the x-y plane with normal +z, radius 1 (the galaxy's radius; the quad reaches the bake's
// margin), at the origin; view.js orients, places and scales it, and incl is unused. opts, for use without view.js:
// { pos ([x, y, z] in the layer's unit), radius (the galaxy's radius in that unit), id (a GALAXIES entry), normal, or
// incl degrees from the line of sight from `from` (default the origin) about a seeded axis, spin (degrees), roll
// (degrees, facing cards), minPx (CSS px: below this the galaxy is a soft dot), temperature (K) }.
// Returns a Mesh (one draw call). Uniforms view.js feeds: uFade, uDoppler, uPxPerRad, uRatio.
export function createImpostor(tex, incl, opts = {}) {
  const ud = (tex && tex.userData) || {};
  const id = opts.id || ud.id;
  const preset = id && GALAXIES[id] ? GALAXIES[id] : null;
  const look = { ...LOOK, ...(preset ? preset.look : {}), ...(ud.look || {}) };
  const orient = { ...(preset ? preset.orient : {}), ...opts };
  const facing = Boolean(orient.facing ?? ud.facing);
  const margin = ud.margin || look.margin;
  const hasDisc = !facing && ud.type !== 'elliptical';
  const uniforms = artUniforms({
    uMap: { value: tex },
    uTemp: { value: finite(opts.temperature) ? opts.temperature : look.temperature },
    uBulgeR: { value: look.bulgeR / margin },
    uBulgeGain: { value: look.bulgeGain },
    uBulgeColor: { value: new THREE.Color(...look.bulge) },
    uDotColor: { value: new THREE.Color(...look.bulge.map((v) => v * 0.9)) },
    uLane: { value: hasDisc ? Math.min(1, (look.dust || 0) * 3) : 0 },
    uLaneR: { value: 0.8 },
    uHasDisc: { value: hasDisc ? 1 : 0 },
    uMinPx: { value: finite(opts.minPx) ? opts.minPx : 1.5 },
    uRoll: { value: (finite(orient.roll) ? orient.roll : 0) * D2R },
    uFacing: { value: facing ? 1 : 0 },
  });
  const material = new THREE.ShaderMaterial({ vertexShader: IMPOSTOR_VS, fragmentShader: IMPOSTOR_FS, uniforms,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  material.name = 'lyh-impostor';
  const mesh = new THREE.Mesh(impostorGeometry(facing), material);
  mesh.name = `impostor:${id || ''}`;
  mesh.frustumCulled = false;
  const radius = finite(opts.radius) ? opts.radius : 1;
  mesh.scale.setScalar(radius * margin);
  const placed = Array.isArray(opts.pos) || Array.isArray(opts.normal);
  let normal = null;
  if (placed && !facing) {
    const pos = opts.pos || [0, 0, 0];
    normal = Array.isArray(opts.normal) ? opts.normal : presetNormal(id, finite(incl) && incl !== 0 ? incl : undefined);
    if (!normal) {
      // No sky orientation known: tilt incl degrees from the line of sight about an axis set by the seed.
      const from = opts.from || [0, 0, 0];
      const los = new THREE.Vector3(pos[0] - from[0], pos[1] - from[1], pos[2] - from[2]);
      if (los.lengthSq() === 0) los.set(0, 0, -1);
      los.normalize();
      const side = new THREE.Vector3(0, 0, 1).applyAxisAngle(los, hashUnit(String(opts.seed ?? id ?? 'g')) * 6.2832);
      side.addScaledVector(los, -side.dot(los));
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0).addScaledVector(los, -los.x);
      side.normalize();
      const inc = (finite(incl) ? incl : 60) * D2R;
      const n = los.clone().multiplyScalar(-Math.cos(inc)).addScaledVector(side, Math.sin(inc));
      normal = [n.x, n.y, n.z];
    }
    mesh.quaternion.copy(discQuaternion(normal, finite(orient.spin) ? orient.spin : 0));
  }
  if (Array.isArray(opts.pos)) mesh.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  mesh.userData = { kind: 'impostor', id, facing, normal };
  return mesh;
}

// Bake and place one catalogue galaxy (or a waypoint preset) in a layer, without view.js. opts: { tier, size, unit
// (ly per layer unit, group: 1000), pos (ly; default the catalogue position), radius (ly), cache (a Map of bakes by id
// and size, shared between calls), normal, incl, seed }. Returns the mesh; mesh.userData.texture is its bake.
export function galaxyImpostor(renderer, id, opts = {}) {
  const preset = GALAXIES[id];
  if (!preset) throw new Error(`galaxy: unknown id ${id}`);
  const size = opts.size || impostorSize(id, opts.tier || 'mid');
  const unit = opts.unit || 1;
  const key = `${id}@${size}`;
  let tex = opts.cache && opts.cache.get(key);
  if (!tex) {
    tex = bakeImpostor(renderer, { id, tier: preset.big ? opts.tier : undefined }, size);
    if (opts.cache) opts.cache.set(key, tex);
  }
  const o = OBJECTS[id];
  const posLy = opts.pos || (o ? o.pos : [0, 0, 0]);
  const radiusLy = finite(opts.radius) ? opts.radius : preset.params.radius;
  const mesh = createImpostor(tex, opts.incl, { ...opts, id, pos: posLy.map((v) => v / unit),
    radius: radiusLy / unit });
  mesh.userData.texture = tex;
  return mesh;
}

// ---------- the Milky Way as particles ----------

// render/points.js's relativistic material, loaded when present (guarded, as it is written alongside this file).
let pointsModule;
const pointsReady = import('./points.js').then((m) => { pointsModule = m; return m; })
  .catch(() => { pointsModule = null; return null; });
export function loadPointMaterial() { return pointsReady; }

// How bright the particles are, by kind (core/gen/galaxy.js PARTS: bulge, bar, arm, disc, cloud), how much the light
// of dense places is held down (each particle's light × (local surface density / median)^-squash, a soft knee like
// the impostor's, so the bar and inner arms do not burn white), and how big each one spreads (× its own size, about
// the gap between particles).
export const MW_LIGHT = { lum: 0.06, kinds: [0.6, 0.6, 1.2, 1, 1.2], squash: 0.55, size: 2, exposure: 1, dust: 0.025,
  dustSize: 2.2, knots: 0.08 };

// Surface density (particles per cell of a grid over the disc, seen face-on) at each particle, over its median.
function densityRatio(data, grid = 48) {
  const n = data.count, P = data.positions;
  let R = 1;
  for (let i = 0; i < n; i++) R = Math.max(R, Math.abs(P[i * 3]), Math.abs(P[i * 3 + 1]));
  const cells = new Uint32Array(grid * grid), at = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const gx = clamp(Math.floor((P[i * 3] / R * 0.5 + 0.5) * grid), 0, grid - 1);
    const gy = clamp(Math.floor((P[i * 3 + 1] / R * 0.5 + 0.5) * grid), 0, grid - 1);
    at[i] = gy * grid + gx;
    cells[at[i]]++;
  }
  const used = [...cells].filter((c) => c > 0).sort((a, b) => a - b);
  const median = used.length ? used[used.length >> 1] : 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = cells[at[i]] / median;
  return out;
}

// Fallback star shader with the same attributes and uniforms as points.js (aTemp, aLum, aSize; shared uniforms),
// used when that module is missing: aberration, Doppler colour, sprites that spread to the particle's size.
const MW_VS = /* glsl */ `
  ${GLSL_ABERRATE}
  ${GLSL_COLOR}
  attribute float aTemp, aLum, aSize;
  uniform float uExposure, uMaxPx, uFade, uFalloff, uNear;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float r = length(mv.xyz);
    float D;
    vec3 n = aberrateDir(mv.xyz / max(r, 1e-30), D);
    gl_Position = projectionMatrix * vec4(n * r, 1.0);
    gl_Position.z = 0.0;
    float px = 2.0 * aSize * length(modelMatrix[0].xyz) / max(r, 1e-30) / D * uPxPerRad * uRatio;
    float s = clamp(px, 1.5 * uRatio, uMaxPx * uRatio);
    float T = aTemp * D;
    float E = aLum * pow(max(r, uNear), -uFalloff) * uExposure * uFade
      * exp(clamp(lnYb(T) - lnYb(aTemp), -24.0, 2.0)) / (D * D);
    vColor = bbRGB(T) * E * 40.0 / (s * s);
    gl_PointSize = s;
    if (E <= 1e-4) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
  }`;
const MW_FS = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(1.0 - exp(-vColor * exp(-3.0 * r2)), 1.0);
    #include <colorspace_fragment>
  }`;
// Dust and H II knots: dust darkens what is drawn before it (dst · (1 − src)), knots add pink light.
const MW_EXTRA_VS = /* glsl */ `
  ${GLSL_ABERRATE}
  attribute float aSize;
  uniform float uMaxPx, uStrength, uFade;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float r = length(mv.xyz);
    float D;
    vec3 n = aberrateDir(mv.xyz / max(r, 1e-30), D);
    gl_Position = projectionMatrix * vec4(n * r, 1.0);
    gl_Position.z = 0.0;
    float px = 2.0 * aSize * length(modelMatrix[0].xyz) / max(r, 1e-30) / D * uPxPerRad * uRatio;
    float s = clamp(px, 1.5 * uRatio, uMaxPx * uRatio);
    vA = uStrength * uFade * min(1.0, px * px / (s * s));
    gl_PointSize = s;
    if (vA <= 0.002) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }
  }`;
const MW_DUST_FS = /* glsl */ `
  uniform vec3 uTint;
  varying float vA;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uTint * vA * exp(-2.5 * r2), 1.0);
  }`;
const MW_KNOT_FS = /* glsl */ `
  uniform vec3 uTint;
  varying float vA;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uTint * vA * exp(-4.0 * r2), 1.0);
    #include <colorspace_fragment>
  }`;

// The Milky Way for the fly-in. data: galaxyParticles({ ...MILKY_WAY, count }) in its own frame (disc in x-y,
// galactic axes, centre at Sgr A*, ly). opts: { shared (points.js createRelativity() uniforms; default REL), lut,
// ratio, maxPx (CSS px), tier, unit (ly per layer unit, default 1), pos (layer units; view.js sets the position
// itself), material (a star material to use instead), exposure, dust (false to skip the dust pass) }.
// Returns a Group of Points: stars (points.js material, sized), dust (darkening) and H II knots; each is a prefix
// sample, so setDrawRange(0, n) thins it. Uniforms view.js feeds: uFade (and uTime).
export function createMilkyWayParticles(data, opts = {}) {
  const shared = opts.shared || REL;
  if (!shared.uLUT.value) shared.uLUT.value = opts.lut || artLut();
  if (!opts.shared && finite(opts.ratio)) REL.uRatio.value = opts.ratio;
  const unit = opts.unit || 1;
  const maxPx = finite(opts.maxPx) ? opts.maxPx : 24;
  const group = new THREE.Group();
  group.name = 'milky-way';
  if (Array.isArray(opts.pos)) group.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  group.userData = { kind: 'milky-way', count: data.count, points: 0 };
  const scaled = (src, k = 1 / unit) => {
    if (k === 1) return src;
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) out[i] = src[i] * k;
    return out;
  };
  const n = data.count;
  const lum = new Float32Array(n), size = new Float32Array(n);
  const kinds = MW_LIGHT.kinds || [];
  const dens = MW_LIGHT.squash > 0 ? densityRatio(data) : null;
  for (let i = 0; i < n; i++) {
    const k = data.kind ? kinds[data.kind[i]] ?? 1 : 1;
    const q = dens ? clamp(dens[i], 0.05, 1e4) ** -MW_LIGHT.squash : 1;
    lum[i] = data.flux[i] * MW_LIGHT.lum * k * clamp(q, 0.08, 4);
    size[i] = data.size[i] * MW_LIGHT.size / unit;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(scaled(data.positions), 3));
  g.setAttribute('aTemp', new THREE.BufferAttribute(data.temperature, 1));
  g.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const exposure = finite(opts.exposure) ? opts.exposure : MW_LIGHT.exposure;
  let material = opts.material || null;
  if (!material && pointsModule && typeof pointsModule.createPointMaterial === 'function') {
    try {
      material = pointsModule.createPointMaterial({ shared, lut: shared.uLUT.value, maxPx, ratio: opts.ratio || 1,
        exposure, falloff: 0, emax: 60, cull: 0.002, sized: true });
    } catch { material = null; }
  }
  if (!material) {
    material = new THREE.ShaderMaterial({ vertexShader: MW_VS, fragmentShader: MW_FS,
      uniforms: { ...shared, uExposure: { value: exposure }, uMaxPx: { value: maxPx }, uFade: { value: 1 },
        uFalloff: { value: 0 }, uNear: { value: 1e-6 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    material.name = 'lyh-milky-way-fallback';
  }
  const stars = new THREE.Points(g, material);
  stars.frustumCulled = false;
  stars.name = 'milky-way-stars';
  group.add(stars);
  group.userData.points += n;
  const extra = (part, fs, blending, strength, tint, order, sizeK, capK) => {
    if (!part || !part.count) return null;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(scaled(part.positions), 3));
    pg.setAttribute('aSize', new THREE.BufferAttribute(scaled(part.size, sizeK / unit), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: MW_EXTRA_VS, fragmentShader: fs,
      uniforms: { ...shared, uMaxPx: { value: maxPx * capK }, uStrength: { value: strength },
        uTint: { value: new THREE.Vector3(...tint) }, uFade: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false, ...blending });
    const pts = new THREE.Points(pg, m);
    pts.frustumCulled = false;
    pts.renderOrder = order;
    group.add(pts);
    group.userData.points += part.count;
    return pts;
  };
  if (opts.dust !== false) {
    const d = extra(data.dust, MW_DUST_FS, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor }, MW_LIGHT.dust, [0.8, 1.0, 1.15], 1,
      MW_LIGHT.dustSize, 1.5);
    if (d) d.name = 'milky-way-dust';
  }
  const k = extra(data.hii, MW_KNOT_FS, { blending: THREE.AdditiveBlending }, MW_LIGHT.knots, [1.0, 0.3, 0.48], 2,
    0.4, 0.35);
  if (k) k.name = 'milky-way-knots';
  return group;
}
