// Light Years Home: nebulae as a few soft layers. bakeNebula renders domain-warped noise once into an atlas of
// tiles (one per layer: emission light in rgb, dust that hides what is behind in alpha); createNebula stacks the
// tiles as camera-facing cards at different depths inside the nebula, so they shift against each other as you move.
// Emission (Carina orange-pink with heavy dust, Orion magenta with a pale core), reflection (the Pleiades' blue haze,
// the faint blue Witch Head) and dark (the Horsehead against its red curtain) all use the same "over" blend.
// Sources: wwwtyro's space-3d (Unlicense) for baking noise layers once, I. Quilez's "Domain warping" for the gas,
// Decaudin and Neyret's "Volumetric Billboards" (2009) for stacking slices. Ray-marched nebulae were considered and
// left out for phones.
import * as THREE from 'three';
import { GLSL_NOISE, GLSL_COLOR, artUniforms } from './galaxy.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Layers × tile size per tier (final.md 2.18).
export const NEBULA_TIERS = {
  high: { layers: 6, size: 512 }, mid: { layers: 4, size: 256 }, low: { layers: 2, size: 256 },
};

// The look of each nebula. Colours are sRGB as you would pick them on screen (converted to linear for the shader).
// gas: the main light; glow: the bright middle; rim: the colour the gas takes where it thins out; core, fil (bright
// threads), dust (dark patches), lane (a dark band across: angle in degrees, width, offset), wisp (streaks along
// stretch), stretch ([x, y] of the noise), scale (noise frequency), bright (overall), opacity (how much the dust hides
// stars behind), shape: 'cloud' | 'horse', temperature (K: the colour temperature the Doppler tint starts from).
export const NEBULAE = {
  carina: { kind: 'emission', gas: [1.0, 0.28, 0.4], glow: [1.0, 0.84, 0.88], rim: [0.88, 0.24, 0.16], core: 0.9,
    fil: 0.35, dust: 0.85, lane: [8, 0.16, -0.05], wisp: 0, stretch: [1, 0.85], scale: 1.5, bright: 1.0,
    opacity: 0.85, temperature: 9000, seed: 5 },
  'orion-nebula': { kind: 'emission', gas: [0.95, 0.22, 0.78], glow: [1.0, 0.52, 0.9], rim: [0.45, 0.32, 1.0],
    core: 1.2, fil: 0.75, dust: 0.35, lane: null, wisp: 0, stretch: [1, 1], scale: 1.4, bright: 0.75, opacity: 0.5,
    temperature: 12000, seed: 3 },
  pleiades: { kind: 'reflection', gas: [0.25, 0.45, 1.0], glow: [0.6, 0.75, 1.0], rim: [0.2, 0.3, 0.9], core: 0.25,
    fil: 0.2, dust: 0, lane: null, wisp: 0.9, stretch: [0.35, 1], scale: 1.6, bright: 0.45, opacity: 0.15,
    temperature: 14000, seed: 9 },
  'witch-head': { kind: 'reflection', gas: [0.22, 0.4, 1.0], glow: [0.45, 0.6, 1.0], rim: [0.18, 0.28, 0.85],
    core: 0, fil: 0.35, dust: 0.1, lane: null, wisp: 0.6, stretch: [0.45, 1.3], scale: 1.3, bright: 0.3,
    opacity: 0.1, temperature: 14000, seed: 7 },
  horsehead: { kind: 'dark', gas: [0.85, 0.12, 0.2], glow: [1.0, 0.45, 0.45], rim: [0.6, 0.08, 0.15], core: 0,
    fil: 0.4, dust: 0.3, lane: null, wisp: 0, stretch: [1, 1], scale: 1.6, bright: 0.7, opacity: 0.95,
    shape: 'horse', temperature: 8000, seed: 11 },
};

// Palette defaults by kind, for nebulae not in NEBULAE (render/view.js passes { kind, gas, glow, dust, seed }).
const BY_KIND = { emission: NEBULAE['orion-nebula'], reflection: NEBULAE.pleiades, dark: NEBULAE.horsehead };

const BAKE_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// One tile: Quilez's warp f(p + 4r), r = fbm(p + 4q), q = fbm(p), on a slice of 3D noise chosen by the layer, so the
// layers are related slices of one cloud. Light falls to zero at the tile's edge.
const BAKE_FS = /* glsl */ `
  ${GLSL_NOISE}
  uniform vec3 uGas, uGlow, uRim;
  uniform float uSeed, uLayer, uLayers, uCore, uFil, uDust, uWisp, uScale, uBright, uOpacity, uHorse;
  uniform vec2 uStretch;
  uniform vec3 uLane;          // angle (radians), half-width, offset; width 0 for none
  varying vec2 vUv;
  float sdEllipse(vec2 p, vec2 c, vec2 r, float a) {
    p -= c; float cs = cos(a), sn = sin(a);
    p = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y);
    return (length(p / r) - 1.0) * min(r.x, r.y);
  }
  // pow() is undefined for a negative base in GLSL ES (NaN on many phone GPUs), so squares are products.
  float sq(float x) { return x * x; }
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }
  // The Horsehead's outline (Barnard 33), like a chess knight facing left: a dark pillar rising from a cloud bank, a
  // broad neck leaning back, the head, the snout down to the left, an ear and the mane. Negative inside.
  float horse(vec2 p) {
    float bank = p.y + 0.6 + 0.05 * sin(p.x * 7.0) + 0.03 * sin(p.x * 17.0);
    float neck = sdEllipse(p, vec2(0.04, -0.3), vec2(0.2, 0.36), -0.18);
    float head = sdEllipse(p, vec2(-0.04, 0.1), vec2(0.16, 0.2), 0.25);
    float snout = sdEllipse(p, vec2(-0.21, -0.02), vec2(0.15, 0.085), 0.65);
    float ear = sdEllipse(p, vec2(0.04, 0.31), vec2(0.045, 0.1), -0.35);
    float mane = sdEllipse(p, vec2(0.13, 0.03), vec2(0.09, 0.2), -0.2);
    float d = smin(neck, head, 0.08);
    d = smin(d, snout, 0.05);
    d = smin(d, ear, 0.03);
    d = smin(d, mane, 0.05);
    return smin(d, bank, 0.1);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float zl = uLayer / max(uLayers - 1.0, 1.0);
    vec3 q3 = vec3(p * uScale / uStretch, uSeed + zl * 1.9);
    vec3 q = vec3(fbm3(q3), fbm3(q3 + vec3(5.2, 1.3, 2.1)), 0.0);
    vec3 r = vec3(fbm3(q3 + 4.0 * q + vec3(1.7, 9.2, 0.3)), fbm3(q3 + 4.0 * q + vec3(8.3, 2.8, 1.1)), 0.0);
    float f = fbm(q3 + 4.0 * r);
    float rad = length(p);
    // An uneven outline, so the cloud is not a disc.
    float fall = smoothstep(1.0, 0.3, rad + 0.45 * (fbm3(vec3(p * 1.3, uSeed * 0.7 + zl)) - 0.5))
      * smoothstep(1.0, 0.85, rad) * (0.75 + 0.25 * (1.0 - zl));
    float gas = pow(clamp(f * 1.5 - 0.32, 0.0, 1.0), 1.7) * fall;
    // Streaks for reflection nebulae: the same noise stretched, so it runs in strands.
    if (uWisp > 0.0) {
      float s = fbm(vec3(p.x * uScale * 3.5 + 2.0 * r.x, p.y * uScale * 0.9, uSeed * 1.3 + zl));
      gas = mix(gas, gas * (0.35 + 1.3 * pow(max(s, 0.0), 1.5)), uWisp);
    }
    // Bright threads: ridged noise of the warped domain.
    float rid = 1.0 - abs(2.0 * fbm(q3 * 2.3 + 2.5 * r + 4.0) - 1.0);
    float fil = pow(max(rid, 0.0), 7.0) * gas * 2.0 * uFil;
    float core = exp(-rad * rad * 16.0) * (0.5 + 0.9 * f) * uCore * (1.0 - 0.5 * zl);
    vec3 col = mix(uRim, uGas, smoothstep(0.05, 0.5, gas + 0.25 * (1.0 - rad))) * gas;
    col += mix(uGas, uGlow, 0.35) * fil + uGlow * core;
    // Dust: dark patches from a second warped noise, and an optional lane across the middle.
    float d = smoothstep(0.48, 0.72, fbm(q3 * 1.8 + 3.0 * r + 11.0)) * uDust;
    if (uLane.y > 0.0) {
      vec2 a = vec2(cos(uLane.x), sin(uLane.x));
      float across = dot(p, vec2(-a.y, a.x)) - uLane.z + 0.12 * (fbm3(vec3(p * 3.0, uSeed + 5.0)) - 0.5);
      float lane = exp(-sq(across / uLane.y)) * smoothstep(0.95, 0.2, abs(dot(p, a)));
      d = max(d, lane * (0.6 + 0.6 * fbm3(vec3(p * 6.0, uSeed + 9.0))));
    }
    if (uHorse > 0.5) {
      // Layer 0 holds the picture: the red curtain (IC 434) above a straight edge, the horse dark against it.
      // The curtain only on the first card (the others would repeat its straight lower edge at random angles).
      float curtain = smoothstep(-0.75, -0.1, p.y) * fall * (0.35 + 0.9 * f) * (zl < 0.01 ? 1.0 : 0.0);
      float edge = exp(-sq((p.x + 0.55 - 0.1 * p.y) / 0.08)) * 0.6;
      col = uGas * curtain + uGlow * edge * curtain + uGas * gas * 0.35;
      float h = horse(p + 0.04 * vec2(fbm3(vec3(p * 5.0, uSeed)) - 0.5, fbm3(vec3(p * 5.0, uSeed + 3.0)) - 0.5));
      float sil = (1.0 - smoothstep(-0.02, 0.03, h)) * (zl < 0.01 ? 1.0 : 0.0);
      d = max(d * fall, sil);
    } else {
      d *= fall;
    }
    col *= 1.0 - 0.92 * clamp(d, 0.0, 1.0);
    col *= uBright;
    // Keep the hue: compress by the brightest channel, so a tile peaks near 0.55 and the cards add up to white only
    // where several bright ones overlap (the core).
    float M = max(col.r, max(col.g, col.b));
    col *= (1.0 - exp(-M * 1.6)) / max(M, 1e-4) * 0.5;
    float alpha = clamp(d * uOpacity, 0.0, 1.0);
    gl_FragColor = vec4(sqrt(clamp(col, 0.0, 1.0)), alpha);
  }`;

// The palette for a call: a NEBULAE entry by id (it wins over the colours passed, as the look is tuned here), else
// the kind's defaults with the caller's colours (taken as linear, as render/view.js writes them). Returns linear
// colours in gasL, glowL, rimL.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function paletteOf(palette) {
  const pal = typeof palette === 'string' ? { id: palette } : { ...(palette || {}) };
  const id = pal.id && NEBULAE[pal.id] ? pal.id : null;
  let out;
  if (id && pal.preset !== false) {
    out = { ...pal, ...NEBULAE[id], ...(pal.override || {}), id };
    for (const k of ['gas', 'glow', 'rim']) out[`${k}L`] = out[k].map(toLinear);
    return out;
  }
  const base = BY_KIND[pal.kind] || BY_KIND.emission;
  out = { ...base, ...pal };
  for (const k of ['gas', 'glow', 'rim']) {
    out[`${k}L`] = Array.isArray(pal[k]) && pal[k].length === 3 ? pal[k].slice() : base[k].map(toLinear);
  }
  if (Array.isArray(pal.dust)) out.dust = base.dust;            // view.js passes a dust colour; we use a strength
  return out;
}

// Bakes `layers` tiles of size × size for a palette (a NEBULAE id, or { id, kind, gas, glow, rim, ... }). Returns
// { texture (the atlas; texture.userData.bytes), layers, cols, rows, size, palette }. Dispose with
// texture.userData.rt.dispose(). Cost: one full-tile shader pass per layer (about 75 ms per 256² tile in SwiftShader).
export function bakeNebula(renderer, palette, layers = 4, size = 256) {
  const steps = nebulaBaker(renderer, palette, layers, size);
  while (!steps.step());
  return steps.bakes;
}

// The same bake in steps, one tile per step(), for slicing across frames. step() returns true when done.
export function nebulaBaker(renderer, palette, layers = 4, size = 256) {
  const pal = paletteOf(palette);
  const L = clamp(Math.round(finite(layers) ? layers : 4), 1, 8);
  const S = clamp(Math.round(finite(size) ? size : 256), 32, 1024);
  const cols = Math.ceil(Math.sqrt(L)), rows = Math.ceil(L / cols);
  const rt = new THREE.WebGLRenderTarget(cols * S, rows * S, { type: THREE.UnsignedByteType, depthBuffer: false,
    generateMipmaps: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const lane = Array.isArray(pal.lane) ? pal.lane : [0, 0, 0];
  const material = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: BAKE_FS, depthTest: false,
    depthWrite: false, uniforms: {
      uGas: { value: new THREE.Vector3(...pal.gasL) }, uGlow: { value: new THREE.Vector3(...pal.glowL) },
      uRim: { value: new THREE.Vector3(...pal.rimL) }, uSeed: { value: (finite(pal.seed) ? pal.seed : 1) * 7.31 },
      uLayer: { value: 0 }, uLayers: { value: L }, uCore: { value: pal.core || 0 }, uFil: { value: pal.fil || 0 },
      uDust: { value: finite(pal.dust) ? pal.dust : 0 }, uWisp: { value: pal.wisp || 0 },
      uScale: { value: pal.scale || 1.5 }, uBright: { value: finite(pal.bright) ? pal.bright : 1 },
      uOpacity: { value: finite(pal.opacity) ? pal.opacity : 0.5 }, uHorse: { value: pal.shape === 'horse' ? 1 : 0 },
      uStretch: { value: new THREE.Vector2(...(pal.stretch || [1, 1])) },
      uLane: { value: new THREE.Vector3(lane[0] * Math.PI / 180, lane[1], lane[2]) },
    } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texture = rt.texture;
  texture.name = `nebula:${pal.id || pal.kind || ''}`;
  texture.userData = { rt, bytes: Math.round(cols * S * rows * S * 4 * 4 / 3) };
  const bakes = { texture, layers: L, cols, rows, size: S, palette: pal };
  let i = 0;
  const run = (fn) => {
    const prev = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
    const prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    try { fn(); } finally {
      renderer.setRenderTarget(prev);
      renderer.autoClear = prevAuto;
      renderer.setClearColor(prevColor, prevAlpha);
    }
  };
  return {
    bakes,
    step() {
      if (i > L) return true;
      run(() => {
        if (i === 0) {
          rt.viewport.set(0, 0, cols * S, rows * S);
          renderer.setRenderTarget(rt);
          renderer.setClearColor(0x000000, 0);
          renderer.clear(true, false, false);
        }
        if (i < L) {
          rt.viewport.set((i % cols) * S, Math.floor(i / cols) * S, S, S);
          material.uniforms.uLayer.value = i;
          renderer.setRenderTarget(rt);
          renderer.render(scene, cam);
        } else {
          // Last step: mipmaps for the whole atlas (tile edges are dark, so the tiles do not bleed).
          rt.viewport.set(0, 0, cols * S, rows * S);
          texture.generateMipmaps = true;
          renderer.setRenderTarget(rt);
          renderer.render(new THREE.Scene(), cam);
          material.dispose();
          quad.geometry.dispose();
        }
      });
      i++;
      return i > L;
    },
  };
}

// ---------- the layered cards ----------

const CARD_VS = /* glsl */ `
  attribute vec2 aCorner;
  uniform float uSize, uRot, uNear;
  varying vec2 vUv;
  varying float vNear;
  void main() {
    vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float scale = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    float dist = max(length(c), 1e-30);
    vec3 dir = c / dist;
    vec3 up0 = abs(dir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 bx = normalize(cross(dir, up0)), by = cross(bx, dir);
    float cr = cos(uRot), sr = sin(uRot);
    vec2 k = vec2(cr * aCorner.x - sr * aCorner.y, sr * aCorner.x + cr * aCorner.y);
    float hs = uSize * scale;
    vec3 p = c + (bx * k.x + by * k.y) * hs;
    // A flat card looks wrong once you are inside it: fade it as the camera comes within its size.
    vNear = smoothstep(uNear * 0.5, uNear * 1.5, dist / hs);
    vUv = aCorner * 0.5 + 0.5;
    gl_Position = projectionMatrix * vec4(p, 1.0);
  }`;
const CARD_FS = /* glsl */ `
  ${GLSL_COLOR}
  uniform sampler2D uMap;
  uniform vec4 uTile;
  uniform float uFade, uDoppler, uTemp, uGain;
  varying vec2 vUv;
  varying float vNear;
  void main() {
    vec4 t = texture2D(uMap, uTile.xy + clamp(vUv, 0.002, 0.998) * uTile.zw);
    float k = uFade * vNear;
    vec3 rgb = t.rgb * t.rgb * uGain;
    gl_FragColor = vec4(rgb * dopplerTint(uTemp, uDoppler) * k, t.a * k);
    #include <colorspace_fragment>
  }`;

// Total light of a nebula's cards (each card gets its share, so the sum holds at any layer count).
const CARD_GAIN = 2;

let cardGeo = null;
function cardGeometry() {
  if (cardGeo) return cardGeo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  cardGeo = g;
  return g;
}

// Small seeded random numbers for the card layout.
function rng(seed) {
  let a = (Math.floor(seed * 1e4) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The nebula: one camera-facing card per baked layer, spread through the nebula's volume, the first card the
// largest and nearest the middle (render/view.js hides cards past the tier's layer count, the last ones first; the
// others brighten to keep the total). bakes: from bakeNebula. pos: [x, y, z] (layer units; view.js passes the origin
// and places the group itself). radius: in the same units (view.js passes 1 and scales the group). opts: { order
// (renderOrder, default -10: before the stars, so stars shine over the gas) }.
// Returns a Group. Uniforms view.js feeds: uFade, uDoppler.
export function createNebula(bakes, pos = [0, 0, 0], radius = 1, opts = {}) {
  const b = bakes && bakes.texture ? bakes : { texture: bakes, layers: 1, cols: 1, rows: 1, palette: {} };
  const pal = b.palette || {};
  const group = new THREE.Group();
  group.name = `nebula:${pal.id || pal.kind || ''}`;
  if (Array.isArray(pos)) group.position.set(pos[0], pos[1], pos[2]);
  group.scale.setScalar(finite(radius) && radius > 0 ? radius : 1);
  const rnd = rng(finite(pal.seed) ? pal.seed + 0.37 : 1.37);
  const L = b.layers;
  const stretch = pal.stretch || [1, 1];
  for (let i = 0; i < L; i++) {
    // The first layers sit near the middle; later ones spread out in depth for parallax.
    const spread = i === 0 ? 0.08 : 0.25 + 0.2 * rnd();
    const v = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
    const n = Math.hypot(...v) || 1;
    const tile = [(i % b.cols) / b.cols, Math.floor(i / b.cols) / b.rows, 1 / b.cols, 1 / b.rows];
    const uniforms = artUniforms({
      uMap: { value: b.texture },
      uTile: { value: new THREE.Vector4(...tile) },
      uSize: { value: (i === 0 ? 1.15 : 0.85 + 0.4 * rnd()) * Math.max(stretch[0], stretch[1], 1) },
      // Streaky nebulae keep their cards nearly aligned (crossed streaks look woven); others turn freely.
      uRot: { value: pal.shape === 'horse' && i === 0 ? 0
        : pal.wisp > 0 ? (rnd() - 0.5) * 0.35 : rnd() * Math.PI * 2 },
      uNear: { value: 1 },
      uTemp: { value: finite(pal.temperature) ? pal.temperature : 9000 },
      uGain: { value: CARD_GAIN / L },
    });
    const material = new THREE.ShaderMaterial({ vertexShader: CARD_VS, fragmentShader: CARD_FS, uniforms,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    material.name = 'lyh-nebula';
    const card = new THREE.Mesh(cardGeometry(), material);
    card.name = `nebula-layer-${i}`;
    card.frustumCulled = false;
    card.renderOrder = finite(opts.order) ? opts.order : -10;
    card.position.set((v[0] / n) * spread, (v[1] / n) * spread, (v[2] / n) * spread);
    // Keep the total light when fewer cards show (view.js steps the layer count down on slow devices).
    card.onBeforeRender = () => {
      let shown = 0;
      for (const c of group.children) if (c.visible) shown++;
      uniforms.uGain.value = CARD_GAIN / Math.max(1, shown);
    };
    group.add(card);
  }
  group.userData = { kind: 'nebula', id: pal.id || null, layers: L };
  return group;
}
