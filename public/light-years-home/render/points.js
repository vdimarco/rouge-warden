// Light Years Home: the light-speed look for points. Every star and galaxy point is moved to where it is seen from a
// ship near light speed (stereographic aberration, Penrose 1959, the same maths as core/physics.aberrate and
// core/project.project), recoloured as a blackbody at D·T through the colour table (Kraus 2000), and dimmed or
// brightened by exp(lnY(DT) − lnY(T)) · D⁻². Each point is an energy-conserving sprite: a narrow core with 92 % of
// the light and a small halo with 8 % (Spencer et al. 1995), tone-mapped per sprite so bright cores go white.
// Also the headlight: the cosmic background squeezed into one blue-white glow dead ahead.
import * as THREE from 'three';
import { lutData } from '../core/physics.js';

export const LUT_SIZE = 256;
export const LUT_TMIN = 500;
export const LUT_TMAX = 200000;
const LUT_SPAN = Math.log(LUT_TMAX / LUT_TMIN);

// The blackbody colour table as a texture: sRGB-encoded bytes, decoded to linear by the GPU when sampled.
export function createLut() {
  const tex = new THREE.DataTexture(lutData(LUT_SIZE, LUT_TMIN, LUT_TMAX), LUT_SIZE, 1, THREE.RGBAFormat,
    THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Uniforms every light-speed material shares, so the view sets them once a frame:
//   uExpPhi, uExpMinusPhi   e^φ and e^−φ of the view rapidity
//   uVel                    unit direction of motion in view space ([0, 0, −1] straight ahead)
//   uLUT                    the colour table; uRatio: device px per CSS px; uPxPerRad: CSS px per radian at the centre
export function createRelativity(lut) {
  return {
    uExpPhi: { value: 1 },
    uExpMinusPhi: { value: 1 },
    uVel: { value: new THREE.Vector3(0, 0, -1) },
    uLUT: { value: lut || createLut() },
    uRatio: { value: 1 },
    uPxPerRad: { value: 500 },
  };
}

// GLSL shared by the point, sky and headlight shaders. lyhAberrate(n, ep, em, D): seen direction of a source in unit
// direction n (view space) for e^φ = ep, e^−φ = em; D is its Doppler factor. Swap ep and em to go back from a seen
// direction to the true one (then D comes out as 1 / D). Written with t = tan(θ/2), or w = 1/t behind, as in
// physics.aberrate, so nothing overflows at any rapidity.
export const RELATIVITY_GLSL = /* glsl */ `
  uniform float uExpPhi, uExpMinusPhi;
  uniform vec3 uVel;
  uniform sampler2D uLUT;
  vec3 lyhAberrate(vec3 n, float ep, float em, out float D) {
    float c = dot(n, uVel);
    vec3 p = n - c * uVel;
    float s = length(p);
    vec3 h = n + uVel;
    float onePlusC = 0.5 * dot(h, h);
    if (s < 1e-7) { D = c > 0.0 ? ep : em; return n; }
    float cosT, sinT;
    if (c >= -0.9) {
      float t = s / onePlusC, t2 = t * t;
      D = (ep + t2 * em) / (1.0 + t2);
      float tp = em * t;
      if (tp <= 1.0) { float q = tp * tp; cosT = (1.0 - q) / (1.0 + q); sinT = 2.0 * tp / (1.0 + q); }
      else { float wp = 1.0 / tp, q = wp * wp; cosT = (q - 1.0) / (q + 1.0); sinT = 2.0 * wp / (q + 1.0); }
    } else {
      float w = onePlusC / s, w2 = w * w;
      D = (ep * w2 + em) / (w2 + 1.0);
      float wp = ep * w;
      if (wp <= 1.0) { float q = wp * wp; cosT = (q - 1.0) / (q + 1.0); sinT = 2.0 * wp / (q + 1.0); }
      else { float tp = 1.0 / wp, q = tp * tp; cosT = (1.0 - q) / (1.0 + q); sinT = 2.0 * tp / (1.0 + q); }
    }
    return cosT * uVel + (sinT / s) * p;
  }
  // ln of a blackbody's brightness to the eye (Planck at 555 nm), stable at any temperature.
  float lyhLnY(float T) { float x = 25924.0 / T; return -(x + log(1.0 - exp(-x))); }
  // Linear colour of a blackbody at T from the table (texel centres, log T, clamped to its ends).
  vec3 lyhBlackbody(float T) {
    float f = clamp(log(T / ${LUT_TMIN.toFixed(1)}) / ${LUT_SPAN.toFixed(6)}, 0.0, 1.0);
    return texture2D(uLUT, vec2((f * ${(LUT_SIZE - 1).toFixed(1)} + 0.5) / ${LUT_SIZE.toFixed(1)}, 0.5)).rgb;
  }
`;

// The sprite profile, shared by stars and the headlight: 92 % of the energy in a core (sigma 0.6 device px for a
// star), 8 % in a wider halo, each a normalised Gaussian; then 1 − exp(−e · colour) per sprite, so bright cores go
// white and the halo keeps the tint. A sized point (a cloud of stars) widens its core to its own size.
const SPRITE_GLSL = /* glsl */ `
  vec3 lyhSprite(vec2 p, float energy, float core, float halo, float ratio, vec3 colour) {
    float d2 = dot(p, p);
    float c = exp(-0.5 * d2 / (core * core)) / (6.2832 * core * core);
    float h = exp(-0.5 * d2 / (halo * halo)) / (6.2832 * halo * halo);
    float e = energy * (0.92 * c + 0.08 * h) * ratio * ratio;
    return 1.0 - exp(-e * colour);
  }
`;

// A material for THREE.Points. Attributes: position (layer units), aTemp (rest temperature, K), aLum (brightness at
// 1 layer unit: the energy before Doppler is aLum · r^−falloff, r in layer units, never closer than near), and with
// sized: true, aSize (physical radius in layer units: the point spreads into a soft blob at least that big on
// screen). Options:
//   lut, maxPx (sprite cap, CSS px), ratio (device pixel ratio), shared (createRelativity() uniforms, so one update
//   reaches every material), exposure, falloff (2: stars, physical; less for galaxy points), near, emax (energy
//   cap: keeps very close points small), cull (energy under which a point is skipped), sized
// Uniforms to set per object: uFade (layer weight × fade), uExposure.
export function createPointMaterial({
  lut, maxPx = 32, ratio = 1, shared, exposure = 1, falloff = 2, near = 1e-6, emax = 40, cull = 0.004,
  sized = false, blending = THREE.AdditiveBlending,
} = {}) {
  const rel = shared || createRelativity(lut);
  if (lut && !shared) rel.uLUT.value = lut;
  const uniforms = {
    ...rel,
    uExposure: { value: exposure },
    uFade: { value: 1 },
    uFalloff: { value: falloff },
    uNear: { value: near },
    uEmax: { value: emax },
    uCull: { value: cull },
    uMaxPx: { value: maxPx },
  };
  if (!shared) uniforms.uRatio.value = ratio;
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: sized ? { LYH_SIZED: 1 } : {},
    vertexShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      uniform float uExposure, uFade, uFalloff, uNear, uEmax, uCull, uMaxPx, uRatio, uPxPerRad;
      attribute float aTemp;
      attribute float aLum;
      #ifdef LYH_SIZED
      attribute float aSize;
      #endif
      varying vec3 vColor;
      varying float vEnergy, vCore, vHalo, vSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float r = length(mv.xyz);
        float D;
        vec3 n = lyhAberrate(mv.xyz / max(r, 1e-30), uExpPhi, uExpMinusPhi, D);
        gl_Position = projectionMatrix * vec4(n * r, 1.0);
        gl_Position.z = 0.0;                         // no depth: only the w > 0 test (in front) clips a point
        float T = max(aTemp, 500.0), T2 = T * D;
        float E = aLum * pow(max(r, uNear), -uFalloff) * uExposure * uFade * exp(lyhLnY(T2) - lyhLnY(T)) / (D * D);
        E = min(E, uEmax);
        vColor = lyhBlackbody(T2);
        float core = 0.6 * (1.0 + 0.12 * log2(1.0 + E)) * uRatio;   // glare: a very bright core spreads a little
        float halo = (0.6 + 0.6 * log2(1.0 + E)) * uRatio;
        #ifdef LYH_SIZED
        float blob = 0.5 * aSize * length(modelMatrix[0].xyz) / max(r, 1e-30) / D * uPxPerRad * uRatio;
        core = max(core, blob);
        halo = max(halo, 1.6 * blob);
        #endif
        float size = min(6.0 * halo + 2.0, uMaxPx * uRatio);
        float fit = max(0.6 * uRatio, (size - 2.0) / 6.0);
        vCore = min(core, fit);
        vHalo = min(halo, fit);
        vSize = size;
        vEnergy = E;
        gl_PointSize = size;
        if (E < uCull || r <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
      }`,
    fragmentShader: /* glsl */ `
      uniform float uRatio;
      varying vec3 vColor;
      varying float vEnergy, vCore, vHalo, vSize;
      ${SPRITE_GLSL}
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * vSize;
        gl_FragColor = vec4(lyhSprite(p, vEnergy, vCore, vHalo, uRatio, vColor), 1.0);
        #include <colorspace_fragment>
      }`,
    blending, depthWrite: false, depthTest: false, transparent: true,
  });
  material.name = 'lyh-points';
  return material;
}

// THREE.Points from typed arrays: positions (Float32Array xyz, layer units), temperature (K), lum (see aLum), and
// optional size. frustumCulled is off: aberration brings points from behind into view.
export function createPoints({ positions, temperature, lum, size = null, material }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aTemp', new THREE.BufferAttribute(temperature, 1));
  geo.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
  if (size) geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

// The headlight: the cosmic background, squeezed by the ship's speed into one glow dead ahead. A quad placed in clip
// space at the seen direction of motion, so it never pops at the screen edge as a point would. A glow, not a star:
// 40 % of its energy goes to the halo. Uniforms the view sets:
//   uDir (view space, the seen direction of motion), uTemp (K: 2.7255 e^η, clamped by the table), uEnergy (follows the
//   heat ratio r), uHaloPx (CSS px), uSizePx (CSS px, half the quad), uViewport (CSS px), uRatio and uLUT (shared)
export function createHeadlight({ lut, shared } = {}) {
  const rel = shared || createRelativity(lut);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...rel,
      uDir: { value: new THREE.Vector3(0, 0, -1) },
      uTemp: { value: 100000 },
      uEnergy: { value: 0 },
      uHaloPx: { value: 4 },
      uSizePx: { value: 24 },
      uViewport: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uDir;
      uniform float uSizePx;
      uniform vec2 uViewport;
      varying vec2 vPx;
      void main() {
        vec4 c = projectionMatrix * vec4(uDir, 1.0);
        vPx = position.xy * uSizePx;
        if (c.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec2 ndc = c.xy / c.w + position.xy * uSizePx * 2.0 / uViewport;
        gl_Position = vec4(ndc, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      ${SPRITE_GLSL}
      uniform float uTemp, uEnergy, uSizePx, uHaloPx, uRatio;
      varying vec2 vPx;
      void main() {
        vec2 p = vPx * uRatio;
        float d2 = dot(p, p);
        float core = 0.9 * uRatio, halo = min(uHaloPx, uSizePx / 3.0) * uRatio;
        float e = uEnergy * (0.6 * exp(-0.5 * d2 / (core * core)) / (6.2832 * core * core)
          + 0.4 * exp(-0.5 * d2 / (halo * halo)) / (6.2832 * halo * halo)) * uRatio * uRatio;
        vec3 c = 1.0 - exp(-e * lyhBlackbody(uTemp));
        float edge = 1.0 - smoothstep(0.8, 1.0, length(vPx) / uSizePx);
        gl_FragColor = vec4(c * edge, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  material.name = 'lyh-headlight';
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
