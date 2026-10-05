// The world around the stand: sky, water, land, trees, rocks, pads, reeds and the props of each place (the dock and a
// loon, a road, a wall with a lighthouse, a logjam). Every mesh is built here in code from the place's map (places/*.js),
// so the fish logic and the picture share one map. What each place looks like is in world-look.js.
import * as THREE from "three";
import { artStyle, storyMaterial } from "./art-style.js";
import { cartoonGeometry } from "./cartoon-models.js";
import { paintedTrees } from "./painted-forest.js";
import { rng, noise, capsule } from "./places/util.js";

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Uniforms that many materials share: the clock and the colours of the hour (world.js sets them).
export const U = {
  uTime: { value: 0 },
  uSkyPaint: { value: null },
  uSkyPaintReady: { value: 0 },
  uWaterPaint: { value: null },
  uWaterPaintReady: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSunVis: { value: 1 },
  uZenith: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uGlow: { value: new THREE.Color() },
  uFogCol: { value: new THREE.Color() },
  uFogNear: { value: 120 },
  uFogFar: { value: 900 },
  uNight: { value: 0 },
  uMoon: { value: 0 },
  uCloudLit: { value: new THREE.Color() },
  uCloudShade: { value: new THREE.Color() },
  uForest: { value: new THREE.Color() },
  uDeep: { value: new THREE.Color() },
  uShallow: { value: new THREE.Color() },
  uFoam: { value: new THREE.Color() },
};

// One local sky texture, requested only for the optional style. A failed image leaves
// the procedural sky active. Switching again can retry; completed loads are reused.
let storySkyLoad = null;
export function loadStorySky() {
  if (U.uSkyPaintReady.value) return Promise.resolve();
  if (storySkyLoad) return storySkyLoad;
  storySkyLoad = new Promise((resolve) => {
    new THREE.TextureLoader().load(new URL("../art/painted-sky.webp", import.meta.url).href, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      // atan wraps at the rear: implicit mip derivatives otherwise draw a seam there.
      texture.generateMipmaps = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.NoColorSpace;
      U.uSkyPaint.value = texture;
      U.uSkyPaintReady.value = 1;
      resolve();
    }, undefined, () => { storySkyLoad = null; resolve(); });
  });
  return storySkyLoad;
}

// The painted water tile. QA blocks this address to check the shader fallback.
export const WATER_ART = new URL("../art/fal-lake-water.webp", import.meta.url).href;
let waterPaintLoad = null;
export function loadPaintedWater() {
  if (U.uWaterPaintReady.value) return Promise.resolve(true);
  if (waterPaintLoad) return waterPaintLoad;
  waterPaintLoad = new Promise(resolve => {
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); waterPaintLoad = null; resolve(ok); };
    const timer = setTimeout(() => finish(false), 8000);
    new THREE.TextureLoader().load(WATER_ART, texture => {
      if (settled) { texture.dispose(); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 4;
      U.uWaterPaint.value = texture; U.uWaterPaintReady.value = 1;
      finish(true);
    }, undefined, () => finish(false));
  });
  return waterPaintLoad;
}

// Small hash noise without sin(), so it stays stable in mediump on phones.
export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
// value noise with its gradient, for cheap wave normals
vec3 vnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
`;

// The sky colour in a direction. The water uses it too, for its reflection.
export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith, uHorizon, uGlow, uSunDir, uSunCol, uFogCol;
uniform float uNight, uArtStyle, uSkyPaintReady;
uniform sampler2D uSkyPaint;
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, y), 0.6));
  float s = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - smoothstep(0.0, 0.55, y);
  c += uGlow * (pow(s, 3.0) * 0.42 * low + pow(s, 24.0) * 0.5 + pow(s, 200.0) * 0.6);
  if (uArtStyle > 0.5 && uSkyPaintReady > 0.5) {
    vec2 uv = vec2(atan(d.x, -d.z) / 6.2831853 + 0.5, 0.08 + sqrt(y) * 0.86);
    vec3 paper = texture2D(uSkyPaint, uv).rgb;
    // Fold the edge sample into the opposite edge for a soft panoramic seam.
    float seam = smoothstep(0.46, 0.5, abs(uv.x - 0.5));
    paper = mix(paper, texture2D(uSkyPaint, vec2(1.0 - uv.x, uv.y)).rgb, seam * 0.5);
    paper *= mix(uHorizon * 1.1, vec3(1.0), smoothstep(0.0, 0.65, y));
    c = mix(c, paper, 0.88 * (1.0 - uNight) * smoothstep(0.0, 0.09, y));
  }
  return c;
}
`;

/* ---------------- materials ---------------- */

// A painted look for lit materials: world-space brush strokes, warm dabs, optional wind sway and water caustics.
export function painted(mat, { strokes = 1, scale = 1, sway = 0, caustics = false, wet = false, key = "" } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uSunVis = U.uSunVis;
    const swayCode = sway ? `
      {
        #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
        #else
        vec2 ip = modelMatrix[3].xz;
        #endif
        float k = max(transformed.y, 0.0); k = k * k * ${sway.toFixed(4)};
        transformed.x += k * (sin(uTime * 1.3 + ip.x * 0.21 + ip.y * 0.17) * 0.7 + sin(uTime * 2.7 + ip.y * 0.5) * 0.3);
        transformed.z += k * sin(uTime * 1.05 + ip.x * 0.33) * 0.5;
      }` : "";
    sh.vertexShader = "uniform float uTime;\nvarying vec3 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      ${swayCode}
      vec4 wp4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      wp4 = instanceMatrix * wp4;
      #endif
      vWP = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = "uniform float uTime, uSunVis;\nvarying vec3 vWP;\n" + NOISE_GLSL + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      {
        vec2 q = vWP.xz * ${(0.11 * scale).toFixed(4)} + vWP.y * ${(0.07 * scale).toFixed(4)};
        float n1 = vnoise(q), n2 = vnoise(q * 3.3 + n1 * 2.0);
        float st = vnoise(vec2(dot(vWP.xz, vec2(0.8, 0.6)) * ${(1.1 * scale).toFixed(4)}, dot(vWP.xz, vec2(-0.6, 0.8)) * ${(0.18 * scale).toFixed(4)}) + vWP.y * 0.4);
        diffuseColor.rgb *= 1.0 + ${(0.2 * strokes).toFixed(3)} * (n1 - 0.5) + ${(0.16 * strokes).toFixed(3)} * (st - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.04, 0.82), smoothstep(0.62, 0.86, n2) * ${(0.5 * strokes).toFixed(3)});
        ${caustics ? `
        // light nets on the shallow sand under the water
        if (vWP.y < -0.02) {
          vec2 cq = vWP.xz * 1.3;
          float c1 = vnoise(cq + vec2(uTime * 0.35, uTime * 0.2)), c2 = vnoise(cq * 1.4 - vec2(uTime * 0.25, uTime * 0.31));
          float net = pow(max(0.0, 1.0 - abs(c1 - c2) * 2.2), 6.0);
          diffuseColor.rgb += net * 0.32 * uSunVis * smoothstep(-3.5, -0.2, vWP.y) * vec3(1.0, 0.96, 0.8);
          diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.0, -4.0, vWP.y));
        }` : ""}
        ${wet ? `
        // posts and stumps: green and dark where they stand in the water, bleached above it
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.66, 0.42), smoothstep(0.45, -0.05, vWP.y));
        diffuseColor.rgb *= mix(1.0, 0.6, smoothstep(0.0, -1.2, vWP.y));` : ""}
      }`);
  };
  mat.customProgramCacheKey = () => "fishpaint" + strokes + "_" + scale + "_" + sway + "_" + caustics + (wet ? "_wet" : "") + key;
  return storyMaterial(mat);
}

/* ---------------- geometry helpers ---------------- */

// Bakes a geometry into plain arrays with a colour (or a colour function), after a transform.
export function bake(geo, { color = [1, 1, 1], matrix = null, colorFn = null, uv = false } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = colorFn ? colorFn(p.getX(i), p.getY(i), p.getZ(i), i) : color;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!uv) g.deleteAttribute("uv");
  return g;
}
// Joins baked geometries (same attributes) into one, so a prop is one draw call.
export function merge(list) {
  const names = Object.keys(list[0].attributes);
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const k of names) {
    const size = list[0].attributes[k].itemSize, arr = new Float32Array(n * size);
    let o = 0;
    for (const g of list) { const a = g.attributes[k]; arr.set(a.array.subarray(0, a.count * size), o); o += a.count * size; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}
export const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const M4 = () => new THREE.Matrix4();

/* ---------------- sky ---------------- */

export function buildSky(low) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSkyPaint: U.uSkyPaint, uSkyPaintReady: U.uSkyPaintReady, uArtStyle: artStyle, uTime: U.uTime, uZenith: U.uZenith, uHorizon: U.uHorizon, uGlow: U.uGlow, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uFogCol: U.uFogCol, uNight: U.uNight, uMoon: U.uMoon, uCloudLit: U.uCloudLit, uCloudShade: U.uCloudShade },
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    defines: { OCT: low ? 3 : 5 },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uMoon; uniform vec3 uCloudLit, uCloudShade; varying vec3 vDir;
      ${SKY_GLSL}
      ${NOISE_GLSL}
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(17.1, 3.7); a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float s = dot(d, uSunDir);
        // the sun: a soft disc with a bright core (at night the moon takes its place, and its disc shows)
        col += uSunCol * (smoothstep(0.9986, 0.9994, s) * 1.6 + smoothstep(0.990, 0.9994, s) * 0.25) * clamp(1.0 - uNight + uMoon, 0.0, 1.0);
        // soft painted clouds on a high flat layer, lit from the sun side
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.14);
          uv = vec2(uv.x * 0.9 + uv.y * 0.25, uv.y * 2.1) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(uv);
          float body = smoothstep(mix(0.5, 0.42, uArtStyle), mix(0.74, 0.60, uArtStyle), n) * smoothstep(0.0, 0.2, d.y);
          body *= 1.0 - uArtStyle * uSkyPaintReady * 0.97;
          float thick = smoothstep(0.58, 0.95, n);
          thick = mix(thick, floor(thick * 4.0 + 0.5) / 4.0, uArtStyle * 0.55);
          float toward = pow(max(s, 0.0), 4.0);
          vec3 cc = mix(uCloudLit, uCloudShade, thick * 0.75);
          cc += uGlow * (toward * 0.8 + 0.12) * (1.0 - thick * 0.5);
          col = mix(col, cc, body * 0.9);
          // stars at night, only in clear sky
          vec3 q = floor(d * 260.0);
          float st = step(0.9965, hash12(q.xz + q.y * 7.13)) * uNight * smoothstep(0.08, 0.4, d.y) * (1.0 - body);
          col += st * (0.55 + 0.45 * sin(uTime * 2.3 + hash12(q.zx) * 30.0));
        }
        // haze sits on the horizon
        col = mix(col, uFogCol, (1.0 - smoothstep(-0.03, 0.1, d.y)) * 0.6);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

/* ---------------- ground ---------------- */

// Grid lines: even steps over the place, growing steps out to the far hills. With a grade the steps are finer near the
// angler (grade(d, step) is the step at distance d), so the stand and the shore at your feet are not blocky.
function axis(a, b, step, fa, fb, grade) {
  const out = [];
  if (grade) {
    out.push(0);
    for (let v = 0; v < b - 1e-6;) { v += grade(v, step); out.push(Math.min(v, b)); }
    for (let v = 0; v > a + 1e-6;) { v -= grade(-v, step); out.unshift(Math.max(v, a)); }
  } else for (let v = a; v <= b + 1e-6; v += step) out.push(v);
  let s = step, v = out[0];
  while (v > fa) { s *= 1.3; v = Math.max(fa, v - s); out.unshift(v); }
  s = step; v = out[out.length - 1];
  while (v < fb) { s *= 1.3; v = Math.min(fb, v + s); out.push(v); }
  return out;
}

export function buildTerrain(low, place, look) {
  const T = look.terrain, step = low ? T.step.low : T.step.high;
  const xs = axis(T.x[0], T.x[1], step, T.far.x[0], T.far.x[1], T.grade), zs = axis(T.z[0], T.z[1], step, T.far.z[0], T.far.z[1], T.grade);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = look.ground(xs[i], zs[j], place);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    // slope from the neighbours, for rocky steeps
    const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    const dx = (H[j * nx + i1] - H[j * nx + i0]) / (xs[i1] - xs[i0] || 1), dz = (H[j1 * nx + i] - H[j0 * nx + i]) / (zs[j1] - zs[j0] || 1);
    const ny = 1 / Math.sqrt(1 + dx * dx + dz * dz);
    const c = look.paint(x, z, h, ny, place);
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
  }
  const idx = new (nx * nz > 65535 ? Uint32Array : Uint16Array)((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}
export function terrainMaterial(low) {
  return painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.1, scale: 0.8, caustics: !low });
}

/* ---------------- water ---------------- */

// The depth of the water baked into a small texture, so the water can tint its shallows. Red: depth (0..25 m).
// Green: land. Blue: how fast the current runs (0..1.5 m/s), for the foam on a river.
export function depthTexture(place, look) {
  const B = look.depthBox, nx = B.nx, nz = B.nz, data = new Uint8Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = B.x0 + ((i + 0.5) / nx) * B.w, z = B.z0 + ((j + 0.5) / nz) * B.h;
    const h = look.ground(x, z, place), k = (j * nx + i) * 4;
    data[k] = Math.round(clamp(-h / 25, 0, 1) * 255);
    data[k + 1] = h > 0 ? 255 : 0;
    if (look.flow && h < 0) { const f = place.flow(x, z); data[k + 2] = Math.round(clamp(Math.hypot(f.x, f.z) / 1.5, 0, 1) * 255); }
    data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const RIPPLES = 16, RINGS = 6;
// The water plane. Where the shore is, how tall the waves are and how the current runs are uniforms that
// setWaterPlace sets, so a change of place needs no new shader.
export function buildWater(low, place, look) {
  const u = {
    uArtStyle: artStyle, uSkyPaint: U.uSkyPaint, uSkyPaintReady: U.uSkyPaintReady,
    uWaterPaint: U.uWaterPaint, uWaterPaintReady: U.uWaterPaintReady,
    uTime: U.uTime, uZenith: U.uZenith, uHorizon: U.uHorizon, uGlow: U.uGlow, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uFogCol: U.uFogCol, uNight: U.uNight,
    uFogNear: U.uFogNear, uFogFar: U.uFogFar, uForest: U.uForest, uDeep: U.uDeep, uShallow: U.uShallow, uFoam: U.uFoam, uSunVis: U.uSunVis,
    uDepth: { value: null }, uBox: { value: new THREE.Vector4() },
    uShoreC: { value: new THREE.Vector4() }, uShoreP: { value: new THREE.Vector4() }, uIsle: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uSwell: { value: 1 }, uFlow: { value: new THREE.Vector2() }, uCur: { value: 0 },
    uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uRing: { value: Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uAim: { value: new THREE.Vector4(0, -1, 0, -0.6) },
    uAimTo: { value: new THREE.Vector2(0, 0) },   // the aim preview: m along the line to the landing (0: none), 1 = dry land
    uLoon: { value: new THREE.Vector4(0, 0, 0, 0) },
    uLure: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, fog: false,
    defines: { LOW: low ? 1 : 0, RIPPLES, RINGS },
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime, uFogNear, uFogFar, uSunVis;
      uniform vec3 uForest, uDeep, uShallow, uFoam;
      uniform sampler2D uDepth, uWaterPaint; uniform float uWaterPaintReady; uniform vec4 uBox;
      uniform vec4 uShoreC, uShoreP, uIsle[2]; uniform float uSwell, uCur; uniform vec2 uFlow;
      uniform vec4 uRip[RIPPLES];
      uniform vec4 uRing[RINGS];
      uniform vec4 uAim, uLoon, uLure; uniform vec2 uAimTo;
      varying vec3 vW;
      ${SKY_GLSL}
      ${NOISE_GLSL}
      vec2 swell(vec2 p, vec2 dir, float k, float w, float a) { float ph = dot(p, dir) * k + uTime * w; return dir * cos(ph) * a * k; }
      // a V-shaped wake behind something moving on the surface (s = x, z, vx, vz)
      float wake(vec2 p, vec4 s, float len, vec2 fw) {
        float sp = length(s.zw); if (sp < 0.04) return 0.0;
        vec2 dir = s.zw / sp, q = p - s.xy;
        float a = dot(q, dir), b = abs(dot(q, vec2(-dir.y, dir.x)));
        float back = max(-a, 0.0);
        float arm = b - back * 0.36;
        float w = max(0.06 + back * 0.05, dot(fw, abs(vec2(-dir.y, dir.x))) * 1.2);
        float v = exp(-arm * arm / (w * w)) * exp(-back / len) * step(a, 0.25);
        return (v + exp(-dot(q, q) * 6.0) * 0.6) * min(sp * 1.5, 1.0);
      }
      // how tall the far shore (or an island) looks from p, looking along d: tan of its elevation, and how far it is.
      // The shore is an ellipse uShoreC (x, z, rx, rz) with trees uShoreP.x tall; the island is round hills uIsle (x, z, r squared, height x)
      float shoreEl(vec2 p, vec2 d, out float t) {
        vec2 o = (p - uShoreC.xy) / uShoreC.zw, v = d / uShoreC.zw;
        float a = dot(v, v), b = dot(o, v), c = dot(o, o) - 1.0;
        t = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
        // the shore forest: a ragged line of tree tops
        float az = atan(d.x, -d.y);
        float tips = abs(fract(az * uShoreP.w) - 0.5) * 2.0;
        float el = (uShoreP.x + uShoreP.z * vnoise(vec2(az * 11.0, 2.0)) - uShoreP.z * tips) / max(t, 1.0);
        // islands: a low hill under tall trees, by how far off its middle the ray passes
        for (int n = 0; n < 2; n++) {
          vec4 I = uIsle[n];
          vec2 oc = p - I.xy;
          float bi = dot(oc, d), off2 = dot(oc, oc) - bi * bi, di = I.z - off2;
          if (di > 0.0 && bi < 0.0) {
            float ti = -bi - sqrt(di), k = sqrt(max(1.0 - off2 / I.z, 0.0));
            float lat = sqrt(max(off2, 0.0)) * sign(oc.x * d.y - oc.y * d.x);
            float pine = 1.0 - abs(fract(lat * 0.2 + 0.3) - 0.5) * 2.0;
            float hgt = (8.0 * k + 14.0 * pow(k, 0.35) * (0.45 + 0.55 * pine)) * I.w;
            if (ti < t) { el = max(el, hgt / max(ti, 1.0)); t = ti; }
          }
        }
        return max(el, uShoreP.y);
      }
      void main() {
        vec2 p = vW.xz;
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        // how much lake one pixel covers here: small waves fade out before they can shimmer
        vec2 fw = fwidth(p);
        float fp = max(fw.x, fw.y) * 0.8;
        vec4 dtx = texture2D(uDepth, (p - uBox.xy) * uBox.zw);
        float depth = dtx.r * 25.0;
        vec2 g = vec2(0.0);
        float keep = 0.0;
        float s1 = 1.0 - smoothstep(0.8, 4.0, fp);
        g += (swell(p, vec2(0.83, 0.56), 0.55, 1.3, 0.05) + swell(p, vec2(0.28, 0.96), 0.9, 1.8, 0.03)) * s1 * uSwell;
        g += swell(p, vec2(-0.6, 0.8), 1.7, 2.6, 0.012) * (1.0 - smoothstep(0.3, 1.4, fp)) * uSwell;
        float s2 = 1.0 - smoothstep(0.2, 0.9, fp);
        // a river carries its small ripples downstream: one speed for the whole water
        vec2 pf = p - uFlow * uTime;
        g += vnoised(pf * 0.7 + vec2(uTime * 0.18, uTime * 0.11)).yz * 0.075 * s2;
        keep = s2;
        #if LOW == 0
        float s3 = 1.0 - smoothstep(0.06, 0.32, fp), s4 = 1.0 - smoothstep(0.025, 0.12, fp);
        g += vnoised(pf * 2.3 - vec2(uTime * 0.31, -uTime * 0.23)).yz * 0.045 * s3;
        g += vnoised(pf * 6.1 + vec2(uTime * 0.6, uTime * 0.2)).yz * 0.025 * s4;
        keep = (s2 + s3) * 0.5;
        #endif
        // one-shot ripples: a short train of rings running out
        float foam = 0.0;
        for (int i = 0; i < RIPPLES; i++) {
          vec4 r = uRip[i];
          float age = uTime - r.z, life = 1.8 + r.w * 2.2;
          if (age < 0.0 || age > life) continue;
          vec2 dv = p - r.xy; float rr = length(dv) + 1e-3;
          float R0 = age * (0.8 + r.w * 0.9);
          float w = max(0.12 + age * 0.14, dot(fw, abs(dv) / rr) * 1.4);
          float x = rr - R0;
          float env = exp(-x * x / (w * w * 1.5)) * pow(1.0 - age / life, 2.0) * min(r.w * 1.5, 1.0);
          // A weaker wave follows the crest; both perturb the reflection.
          // Pixel-sized widths prevent a flickering ring in the distant lake.
          float tailX = x + w * 2.4;
          float tailEnv = exp(-tailX * tailX / (w * w * 2.0)) * pow(1.0 - age / life, 2.0) * min(r.w * 1.5, 1.0);
          g += dv / rr * (sin(x * 9.0) * env - sin(tailX * 7.0) * tailEnv * 0.38) * 0.6 * s2;
          foam += env * mix(1.0, smoothstep(0.0, 0.35, cos(x * 9.0)), s2) * 0.5;
        }
        // the rising-fish rings: pulses that keep coming. Lines never get thinner than a pixel, so they read from the dock
        vec3 goldGlow = vec3(0.0);
        for (int i = 0; i < RINGS; i++) {
          vec4 r = uRing[i];
          if (r.w < 0.5) continue;
          vec2 dv = p - r.xy; float rr = length(dv) + 1e-3;
          if (rr > 6.0) continue;
          float w = max(0.06, dot(fw, abs(dv) / rr) * 1.1);
          for (int j = 0; j < 3; j++) {
            float age = mod(uTime * 0.8 + float(j) * 0.9 + float(i) * 0.37, 2.7);
            float x = rr - (0.25 + age * 1.6);
            float env = exp(-x * x / (w * w)) * (1.0 - age / 2.7);
            foam += env * (1.1 + r.z * 0.5);
            g += dv / rr * sin(x * 7.0) * env * 0.35 * s2;
          }
          if (r.z > 0.5) {
            float pulse = 0.7 + 0.3 * sin(uTime * 3.0 + float(i));
            float band = exp(-pow((rr - 1.3 - 0.25 * sin(uTime * 1.7)) / max(0.35, w), 2.0));
            goldGlow += vec3(1.0, 0.76, 0.26) * (band * 0.8 + exp(-rr * rr * 0.6) * 0.5) * pulse;
            vec2 cq = p * 2.5, cf = fract(cq) - 0.5;
            float sp = step(0.88, hash12(floor(cq) + floor(uTime * 5.0))) * smoothstep(0.32, 0.08, length(cf)) * exp(-rr * rr * 0.15);
            goldGlow += vec3(1.0, 0.92, 0.6) * sp * 1.2 * (1.0 - smoothstep(0.08, 0.4, fp));
          }
        }
        foam += wake(p, uLoon, 3.0, fw) * 0.4 + wake(p, uLure, 1.4, fw) * 0.35;
        #if LOW == 0
        // white streaks where a river runs fast over shallows (the blue channel of the depth texture is the current)
        if (uCur > 0.0) {
          float streak = vnoise(vec2(pf.x * 0.8, p.y * 3.2));
          foam += smoothstep(0.6, 0.85, streak) * smoothstep(0.45, 0.8, dtx.b) * (1.0 - smoothstep(0.4, 1.8, depth)) * uCur * (1.0 - smoothstep(0.3, 1.2, fp));
        }
        #endif
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        // reflect off a calmer surface than the one we shade, so the mirrored shore breaks up gently
        vec3 R = reflect(-V, normalize(vec3(-g.x * 0.55, 1.0, -g.y * 0.55))); R.y = abs(R.y);
        vec3 refl = skyColor(R);
        // the far shore mirrored in the water: where the reflected ray meets the treeline
        float hr = max(length(R.xz), 1e-3), t;
        vec2 d = R.xz / hr;
        float el = shoreEl(p, d, t);
        el *= 1.0 + 0.35 * (vnoise(vec2(atan(d.x, -d.y) * 40.0, 0.5)) - 0.5);
        float shore = smoothstep(el * 1.15 + 0.008, el * 0.85 - 0.004, R.y / hr);
        vec3 treeCol = mix(uForest, uFogCol, smoothstep(uFogNear, uFogFar, t + dist) * 0.9);
        refl = mix(refl, treeCol, shore);
        // water colour: tea-brown shallows over the sand, dark in the deep
        float dd = 1.0 - exp(-depth * 0.3);
        vec3 body = mix(uShallow, uDeep, dd);
        vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));
        // sun glitter: sharp sparkles near, a soft road of light where the waves are too small to see
        float sd = max(dot(R, uSunDir), 0.0);
        float rough = 1.0 - keep;
        float spec = pow(sd, mix(1400.0, 70.0, rough)) * mix(14.0, 1.2, rough);
        #if LOW == 0
        vec2 gq = p * 5.0;
        spec += pow(sd, 40.0) * step(0.96, hash12(floor(gq) + floor(uTime * 7.0))) * smoothstep(0.32, 0.08, length(fract(gq) - 0.5)) * 2.2 * s4;
        #endif
        spec *= uSunVis * (1.0 - shore);
        if (uArtStyle > 0.5) {
          // Cel-painted water: broad colour shapes and horizontal strokes.
          // Game rings, wakes, and the aiming dots still draw above this paint.
          float brush = vnoise(vec2(p.x * .48 + uTime * .025, p.y * 2.8 + uTime * .10 + sin(p.x * .36) * .18));
          float mass = vnoise(vec2(p.x * .065, p.y * .32 - uTime * .035));
          float wash = smoothstep(.32, .39, mass) * .11 + smoothstep(.59, .66, mass) * .10;
          // A pronounced jade depth gradient, lit by the existing day/night palette.
          float daylight = clamp(uSunVis, 0.0, 1.0);
          vec3 jade = mix(vec3(.13, .43, .32), vec3(.012, .105, .095), smoothstep(.4, 9.0, depth));
          vec3 lakePaint = mix(body, jade, .78 * daylight) * (.94 + wash);
          float reflection = smoothstep(.12, .85, fres) * .72;
          col = mix(lakePaint, refl, reflection);
          // Reflected boughs are soft painted bars, without mirror-like glare.
          col = mix(col, treeCol * vec3(.85, 1.12, 1.13), shore * (.16 + .17 * step(.49, brush)));
          float dash = smoothstep(.57, .62, brush) * (1. - smoothstep(.67, .73, brush));
          col = mix(col, uFoam, dash * .19 * (1. - smoothstep(.5, 2., fp)));
          float grain = hash12(floor(p * 17.));
          col *= .988 + grain * .024;
          if (uWaterPaintReady > .5) {
            // The painted tile supplies brush detail. Subtle distortion carries
            // the wind/current, while gameplay ripples and wakes remain live.
            vec2 paintUV = pf * vec2(.045, .045) + vec2(uTime * .0007, uTime * .00035);
            paintUV += g * .085;
            paintUV += vec2(sin(p.y * .24 + uTime * .32), sin(p.x * .17 - uTime * .23)) * .002;
            vec3 paint = texture2D(uWaterPaint, paintUV).rgb;
            vec3 drift = texture2D(uWaterPaint, paintUV * .61 + vec2(.37, -.21) - vec2(uTime * .0004, 0.)).rgb;
            paint = mix(paint, drift, .28);
            paint *= clamp(body / vec3(.24, .50, .49), vec3(.07), vec3(1.35));
            col = mix(col, paint, .12);
          }
          spec = min(spec, .3) * smoothstep(.52, .67, brush);
        }
        // Pond reference: slow cellular light under the surface, strongest
        // in shallow water. World-space scale and footprint fade prevent shimmer.
        vec2 cq = pf * .46 + g * 1.4;
        cq += vec2(sin(cq.y * .8 + uTime * .32), cos(cq.x * .7 - uTime * .27)) * .48;
        float ca = vnoise(cq + vec2(uTime * .075, uTime * .045));
        float cb = vnoise(cq * 1.21 + vec2(3.7, 8.2) - vec2(uTime * .05, uTime * .065));
        float bandWidth = max(.028, fwidth(ca - cb) * 1.5);
        float lightNet = 1.0 - smoothstep(bandWidth, bandWidth + .055, abs(ca - cb));
        float clearDepth = exp(-depth * .12) * smoothstep(.04, .55, depth);
        float netVisibility = clearDepth * (1.0 - fres) * uSunVis * (1.0 - smoothstep(.35, 1.6, fp));
        // Dark troughs and bright moving contours give the water readable volume.
        col *= 1.0 - lightNet * netVisibility * .12;
        col += vec3(.48, .86, .60) * lightNet * netVisibility * .52;
        col += uSunCol * spec;
        col += uFoam * clamp(foam, 0.0, 1.2) * 0.6;
        col += goldGlow;
        // the aim: a dotted line on the water from the dock end. With a preview it runs out to where a cast like the last
        // one lands, with a ring there; amber when that cast would land on dry land (the dots stop at the shore)
        if (uAim.z > 0.01) {
          vec2 dir = uAim.xy, q = p - vec2(0.0, uAim.w);
          float ta = dot(q, dir), sa = dot(q, vec2(-dir.y, dir.x));
          float end = uAimTo.x > 0.0 ? uAimTo.x : 14.0;
          vec3 ac = mix(vec3(1.0, 0.97, 0.86), vec3(1.0, 0.68, 0.26), uAimTo.y);
          if (ta > 3.0 && ta < end + 1.0) {
            // the dots spread out with distance (0.6 m apart near the dock), so far ones do not run together
            float sp = 0.6 + 0.016 * ta, cell = (fract(log(sp) / 0.016) - 0.5) * sp;
            float rad = 0.07 + ta * 0.012;
            float dotv = smoothstep(rad, rad * 0.55, length(vec2(cell, sa)));
            float fadeIn = smoothstep(3.0, 4.0, ta) * smoothstep(end + 0.5, end - 2.5, ta);
            col = mix(col, ac, dotv * fadeIn * uAim.z);
          }
          if (uAimTo.x > 0.0) {
            float rr = length(q - dir * uAimTo.x), rw = 0.1 + uAimTo.x * 0.008;
            col = mix(col, ac, smoothstep(rw, 0.0, abs(rr - 0.9 - uAimTo.x * 0.02)) * uAim.z);
          }
        }
        // soft edge at the shore
        float edge = smoothstep(0.02, 0.35, depth);
        float alpha = clamp(mix(0.25, 1.0, smoothstep(0.0, 5.0, depth)) + fres * 0.7 + spec + foam * 0.3 + length(goldGlow), 0.0, 1.0);
        // Let the shallow bed show through the painted surface. Deep water
        // and grazing angles keep their opacity and reflected shore.
        float paintedAlpha = clamp(.18 + .80 * smoothstep(.3, 7.0, depth) + fres * .6 + foam * .2 + spec + length(goldGlow), 0.0, 1.0);
        alpha = mix(alpha, paintedAlpha, uArtStyle);
        alpha *= edge;
        col += uFoam * (1.0 - smoothstep(0.05, 0.45, depth + (vnoise(p * 0.6 + uTime * 0.2) - 0.5) * 0.25)) * 0.35 * edge;
        float fg = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogCol, fg);
        alpha = mix(alpha, 1.0, fg * edge);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const water = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  water.renderOrder = 5;
  water.frustumCulled = false;
  setWaterPlace(water, u, place, look);
  return { water, u };
}

// Point the water at a place: its depth texture, plane, shore, waves and current.
export function setWaterPlace(water, u, place, look) {
  if (u.uDepth.value) u.uDepth.value.dispose();
  u.uDepth.value = depthTexture(place, look);
  const B = look.depthBox, W = look.water || B;
  u.uBox.value.set(B.x0, B.z0, 1 / B.w, 1 / B.h);
  const S = look.shore, c = S.c;
  u.uShoreC.value.set(c.x, c.z, c.rx, c.rz);
  u.uShoreP.value.set(S.treeH, S.minEl, S.amp, S.tips);
  for (let i = 0; i < 2; i++) { const I = S.isles[i]; u.uIsle.value[i].set(I ? I.x : 0, I ? I.z : 0, I ? I.r * I.r : 0, I ? I.h : 1); }
  u.uSwell.value = look.swell;
  u.uFlow.value.set(look.flow ? look.flow.x : 0, look.flow ? look.flow.z : 0);
  u.uCur.value = look.flow ? look.flow.foam : 0;
  const stand = place.stand.dock;
  u.uAim.value.w = stand.z0;
  const geo = new THREE.PlaneGeometry(W.w, W.h, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(W.x0 + W.w / 2, 0, W.z0 + W.h / 2);
  if (water.geometry) water.geometry.dispose();
  water.geometry = geo;
}

/* ---------------- trees ---------------- */

function pineGeo(low) {
  const parts = [];
  const seg = low ? 5 : 7, tiers = low ? [[0.3, 0.12, 0.6], [0.2, 0.46, 0.54]] : [[0.3, 0.1, 0.46], [0.24, 0.32, 0.42], [0.16, 0.54, 0.46]];
  const dark = hex("#24442a"), mid = hex("#3a6838"), tipC = hex("#6a9a48");
  const r = rng(5);
  for (const [rad, y0, h] of tiers) {
    const g = new THREE.ConeGeometry(rad, h, seg, 1, true);
    // a ragged skirt: each outer vertex at its own radius
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const k = 0.8 + r() * 0.4; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) - r() * 0.04); }
    g.computeVertexNormals();
    parts.push(bake(g, { matrix: M4().makeTranslation(0, y0 + h / 2, 0), colorFn: (x, y) => mix3(dark, y > y0 + h * 0.7 ? tipC : mid, smooth(y0, y0 + h, y)) }));
  }
  if (!low) parts.push(bake(new THREE.CylinderGeometry(0.018, 0.03, 0.2, 4, 1, true), { matrix: M4().makeTranslation(0, 0.1, 0), color: hex("#4a3626") }));
  return merge(parts);
}
function leafyGeo(low, pale) {
  const parts = [];
  const g = new THREE.IcosahedronGeometry(0.34, low ? 0 : 1);
  const p = g.attributes.position, r = rng(9);
  for (let i = 0; i < p.count; i++) { const k = 0.85 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.15, p.getZ(i) * k); }
  g.computeVertexNormals();
  const lo = hex(pale ? pale.lo : "#46652c"), hi = hex(pale ? pale.hi : "#8fae4c");
  parts.push(bake(g, { matrix: M4().makeTranslation(0, 0.62, 0), colorFn: (x, y) => mix3(lo, hi, smooth(0.35, 1.0, y)) }));
  parts.push(bake(new THREE.CylinderGeometry(0.02, 0.035, 0.36, 4, 1, true), { matrix: M4().makeTranslation(0, 0.18, 0), color: hex("#d8d2c0") }));
  return merge(parts);
}
function farPineGeo(low) {
  const g = new THREE.ConeGeometry(0.28, 1, low ? 4 : 6, 1, true);
  g.translate(0, 0.5, 0);
  return bake(g, { colorFn: (x, y) => mix3(hex("#26462c"), hex("#4a7a40"), y) });
}

// Soft, rounded canopies use a small mesh shared by all instances. The far
// forest uses one crown per tree to keep the phone's triangle count low.
function storyTreeGeo(low, broad = false, far = false, pale = null) {
  const asset = cartoonGeometry(far ? "tree_far" : "tree_" + (broad ? "leaf" : "pine") + (low ? "_low" : "_high"));
  if (asset) {
    if (pale) {
      const c = asset.attributes.color, p = asset.attributes.position;
      for (let i = 0; i < c.count; i++) if (p.getY(i) > .4) { const v = .65 + p.getY(i) * .3; c.setXYZ(i, v, v, v * .91); }
    }
    return asset;
  }
  const parts = [];
  const crowns = far ? [[0, 0.56, 0, low ? 0.44 : 0.31, 0.48, low ? 0.43 : 0.30]] : low
    ? [[0, 0.60, 0, broad ? 0.36 : 0.48, 0.42, broad ? 0.34 : 0.45]] : broad
    ? [[-0.12, 0.59, 0, 0.30, 0.32, 0.31], [0.15, 0.69, 0.02, 0.31, 0.33, 0.29]]
    : [[0, 0.41, 0, 0.34, 0.28, 0.32], [0.02, 0.71, 0.01, 0.24, 0.31, 0.23]];
  const lo = hex(pale ? pale.lo : "#346e55"), hi = hex(pale ? pale.hi : "#99b95f");
  for (const [x, y, z, sx, sy, sz] of crowns) {
    const g = new THREE.SphereGeometry(1, low ? (far ? 4 : 5) : 8, low ? (far ? 2 : 3) : (far ? 3 : 4));
    g.scale(sx, sy, sz); g.translate(x, y, z);
    parts.push(bake(g, { colorFn: (x, y) => mix3(lo, hi, smooth(0.2, 1, y)) }));
  }
  if (!far) parts.push(bake(new THREE.CylinderGeometry(0.035, 0.055, 0.48, low ? 3 : 5, 1, low), { matrix: M4().makeTranslation(0, 0.24, 0), color: hex("#8b6642") }));
  return merge(parts);
}

// Where the trees stand, from the place's look: near trees (pines and leafy ones) on a jittered grid where the forest
// mask says so, and small far cones on the hills. Sorted in a shuffled order so "low" can draw only the first part and still look even.
function treeSpots(place, look) {
  const T = look.trees, G = (x, z) => look.ground(x, z, place);
  const r = rng(T.seed);
  const near = [], leafy = [], far = [];
  const N = T.near, Lf = T.leafy, Fr = T.far;
  for (let gx = N.x[0]; gx < N.x[1]; gx += N.step) for (let gz = N.z[0]; gz < N.z[1]; gz += N.step) {
    const x = gx + (r() - 0.5) * N.jit, z = gz + (r() - 0.5) * N.jit;
    if (!N.ok(x, z, place)) continue;
    const h = G(x, z);
    if (h < 0.9 || place.onStand(x, z)) continue;
    const f = look.forest(x, z, place);
    if (r() > f * 0.95) continue;
    const s = 0.8 + r() * 0.5;
    if (r() < Lf.p(x, z) && Lf.ok(x, z, place)) leafy.push({ x, y: h - 0.2, z, s: Lf.size[0] + r() * Lf.size[1], rot: r() * 6.28 });
    else near.push({ x, y: h - 0.3, z, s: (N.size[0] + r() * N.size[1]) * s, rot: r() * 6.28 });
  }
  // the far hills: small cones, mostly where the camera looks (north, east and west)
  if (Fr) for (let gx = Fr.x[0]; gx < Fr.x[1]; gx += Fr.step) for (let gz = Fr.z[0]; gz < Fr.z[1]; gz += Fr.step) {
    const x = gx + (r() - 0.5) * Fr.jit, z = gz + (r() - 0.5) * Fr.jit;
    if (!Fr.ok(x, z, place)) continue;
    if (Fr.minH != null && G(x, z) < Fr.minH) continue;
    if (r() > Fr.keep) continue;
    far.push({ x, y: G(x, z) - 0.5, z, s: Fr.size[0] + r() * Fr.size[1], rot: r() * 6.28 });
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { near: shuffle(near), leafy: shuffle(leafy), far: shuffle(far) };
}

function instanced(geo, mat, spots, max, tint) {
  const n = Math.min(spots.length, max);
  const m = new THREE.InstancedMesh(geo, mat, n);
  const mx = M4(), q = new THREE.Quaternion(), c = new THREE.Color(), r = rng(77);
  for (let i = 0; i < n; i++) {
    const t = spots[i];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    mx.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s * (0.85 + r() * 0.3), t.s, t.s * (0.85 + r() * 0.3)));
    m.setMatrixAt(i, mx);
    const k = tint(r);
    m.setColorAt(i, c.setRGB(k[0], k[1], k[2]));
  }
  m.instanceMatrix.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

export function buildTrees(low, place, look, style = "painted") {
  const cartoon = style === "painted";
  const S = treeSpots(place, look), T = look.trees;
  if (cartoon) {
    const g = new THREE.Group(), caps = low ? T.caps.low : T.caps.high;
    const kinds = ["pine", "leaf", "far"], spots = [S.near, S.leafy, S.far];
    for (let i = 0; i < 3; i++) {
      const mesh = paintedTrees(spots[i], caps[i], kinds[i], U, i === 1 ? T.leafy.tint : T.pineTint, rng(77 + i));
      if (mesh) g.add(mesh);
    }
    if (g.children.length) return g;
  }
  // Broader crowns cover the same forest with fewer instances on phones.
  const caps = low ? T.caps.low.map((n, i) => Math.floor(n * (cartoon ? [0.4, 1, 0.5][i] : 1))) : T.caps.high;
  const mat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.9, scale: 1.4, sway: 0.012, key: "tree" });
  const leafMat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.2, scale: 2.2, sway: 0.02, key: "leaf" });
  const farMat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.8, scale: 0.6, key: "far" });
  const g = new THREE.Group();
  if (caps[0] && S.near.length) g.add(instanced(cartoon ? storyTreeGeo(low) : pineGeo(low), mat, S.near, caps[0], T.pineTint));
  if (caps[1] && S.leafy.length) g.add(instanced(cartoon ? storyTreeGeo(low, true, false, T.leafy.geo) : leafyGeo(low, T.leafy.geo), leafMat, S.leafy, caps[1], T.leafy.tint));
  if (caps[2] && S.far.length) g.add(instanced(cartoon ? storyTreeGeo(low, false, true) : farPineGeo(low), farMat, S.far, caps[2], T.pineTint));
  return g;
}

/* ---------------- rocks, pads, reeds ---------------- */

// Rocks: the place's rocks, and where the look asks for them the boulders of a river and the granite of Loon Lake's shores.
export function buildRocks(place, look) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position, r = rng(21);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.22 * noise(x * 1.7 + 3, z * 1.7 + y * 1.3) + 0.08 * (r() - 0.5);
    p.setXYZ(i, x * k, y * k * (y < 0 ? 0.7 : 1), z * k);
  }
  g.computeVertexNormals();
  const geo = bake(g, { colorFn: (x, y, z) => { const t = noise(x * 2 + 1, z * 2 + y); return y > 0.45 && t > 0.1 ? hex("#a8a66a") : mix3(hex("#8e7f78"), hex("#c2aa9c"), clamp(0.5 + t, 0, 1)); } });
  const spots = place.props.rocks.map((k) => ({ x: k.x, z: k.z, r: k.r, top: k.top }));
  // boulders stand in the current, a little taller than the stones
  if (look.props.includes("boulders")) for (const b of place.props.boulders) spots.push({ x: b.x, z: b.z, r: b.r * 1.15, top: 0.5 + 0.3 * b.r });
  const rr = rng(88);
  // granite on the point and the island shore, above the water
  if (look.props.includes("granite")) {
    const F = place.features, n = spots.length;
    for (let i = 0; spots.length < n + 60 && i < 4000; i++) {
      const onIsland = rr() < 0.3;
      const x = onIsland ? F.island.x + (rr() - 0.5) * 40 : F.point.bx - 4 + rr() * 60, z = onIsland ? F.island.z + (rr() - 0.5) * 40 : F.point.bz - 14 + rr() * 26;
      const d = onIsland ? Math.hypot(x - F.island.x, z - F.island.z) - F.island.r : capsule(x, z, F.point), h = place.height(x, z);
      if (d > 0.5 || d < -5 || h < 0) continue;
      spots.push({ x, z, r: 0.5 + rr() * 1.3, top: h + 0.3 + rr() * 0.6 });
    }
  }
  if (!spots.length) return null;
  const m = new THREE.InstancedMesh(geo, painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.2, scale: 3, key: "rock" }), spots.length);
  const mx = M4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach((s, i) => {
    e.set((rr() - 0.5) * 0.4, rr() * 6.28, (rr() - 0.5) * 0.4);
    q.setFromEuler(e);
    const sy = s.r * (0.55 + rr() * 0.3);
    mx.compose(new THREE.Vector3(s.x, s.top - sy * 0.85, s.z), q, new THREE.Vector3(s.r * (1 + rr() * 0.3), sy, s.r));
    m.setMatrixAt(i, mx);
  });
  m.frustumCulled = false;
  return m;
}

export function buildPads(low, place, look) {
  const group = new THREE.Group();
  const g = new THREE.CircleGeometry(1, low ? 9 : 14, 0.3, Math.PI * 2 - 0.6);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, d * d * 0.03); }
  g.computeVertexNormals();
  const geo = bake(g, { colorFn: (x, y, z) => mix3(hex("#8fb04a"), hex("#4f7a30"), Math.hypot(x, z)) });
  const mat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1, scale: 4, key: "pad" });
  const LILIES = place.props.lilies;
  const pads = new THREE.InstancedMesh(geo, mat, LILIES.length);
  const mx = M4(), q = new THREE.Quaternion(), c = new THREE.Color(), r = rng(3), up = new THREE.Vector3(0, 1, 0);
  LILIES.forEach((l, i) => {
    q.setFromAxisAngle(up, l.rot);
    mx.compose(new THREE.Vector3(l.x, 0.035, l.z), q, new THREE.Vector3(l.r, 1, l.r));
    pads.setMatrixAt(i, mx);
    const t = r();
    pads.setColorAt(i, t < 0.12 ? c.setRGB(1.1, 0.8, 0.6) : c.setRGB(0.85 + t * 0.3, 0.9 + t * 0.2, 0.8 + t * 0.1));
  });
  pads.frustumCulled = false;
  group.add(pads);
  // white water lilies with a yellow heart
  const parts = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const pet = new THREE.ConeGeometry(0.035, 0.13, 4, 1);
    pet.translate(0, 0.065, 0);
    pet.rotateX(-1.05);
    pet.rotateY(a);
    parts.push(bake(pet, { colorFn: (x, y) => mix3(hex("#f0d4e0"), hex("#fffaf2"), clamp(y * 12, 0, 1)) }));
  }
  parts.push(bake(new THREE.SphereGeometry(0.035, 6, 4), { matrix: M4().makeTranslation(0, 0.03, 0), color: hex("#f2c230") }));
  const fl = LILIES.filter((l) => l.flower);
  const flowers = new THREE.InstancedMesh(merge(parts), storyMaterial(new THREE.MeshLambertMaterial({ vertexColors: true })), fl.length);
  fl.forEach((l, i) => { mx.compose(new THREE.Vector3(l.x + 0.1, 0.05, l.z), q.setFromAxisAngle(up, l.rot), new THREE.Vector3(1.5, 1.5, 1.5)); flowers.setMatrixAt(i, mx); });
  flowers.frustumCulled = false;
  group.add(flowers);
  return group;
}

export function buildReeds(low, place, look) {
  const r = rng(19), stalks = [], tails = [];
  for (const c of place.props.reeds) {
    for (let i = 0; i < c.n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 0.7;
      const s = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d, h: c.h * (0.7 + r() * 0.5), rot: r() * 6.28, lean: (r() - 0.5) * 0.25 };
      (r() < 0.2 ? tails : stalks).push(s);
    }
  }
  // a thin blade that bends a little
  const blade = () => {
    const seg = 3, pos = [], col = [], nrm = [];
    const lo = hex("#4c6e2c"), hi = hex("#c9c27a");
    const pt = (t) => [0.035 * (1 - t) * 0.5, t, t * t * 0.12];
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg, a = pt(t0), b = pt(t1);
      const v = [[-a[0], a[1] - 0.35, a[2], t0], [a[0], a[1] - 0.35, a[2], t0], [b[0], b[1] - 0.35, b[2], t1], [-b[0], b[1] - 0.35, b[2], t1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(v[k][0], v[k][1], v[k][2]); const c = mix3(lo, hi, v[k][3]); col.push(c[0], c[1], c[2]); nrm.push(0, 0.3, -1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  const mat = painted(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { strokes: 0.6, scale: 3, sway: 0.09, key: "reed" });
  if (look.reedTint) mat.color.setRGB(look.reedTint[0], look.reedTint[1], look.reedTint[2]);   // dry autumn reeds
  const grp = new THREE.Group();
  const mx = M4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const fill = (geo, list) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => { e.set(s.lean, s.rot, s.lean * 0.5); q.setFromEuler(e); mx.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(1, s.h, 1)); m.setMatrixAt(i, mx); });
    m.frustumCulled = false;
    return m;
  };
  grp.add(fill(blade(), stalks));
  const cat = merge([
    bake(new THREE.CylinderGeometry(0.006, 0.008, 1.2, 3, 1, true), { matrix: M4().makeTranslation(0, 0.25, 0), color: hex("#5a7a34") }),
    bake(new THREE.CylinderGeometry(0.022, 0.022, 0.16, low ? 5 : 6, 1), { matrix: M4().makeTranslation(0, 0.72, 0), color: hex("#6a4526") }),
  ]);
  grp.add(fill(cat, tails));
  return grp;
}

/* ---------------- the dock ---------------- */

export function buildDock(place) {
  const D = place.stand.dock, parts = [], r = rng(61);
  const box = (w, h, d, x, y, z, c, ry = 0) => parts.push(bake(new THREE.BoxGeometry(w, h, d), { matrix: M4().makeRotationY(ry).setPosition(x, y, z), color: c }));
  const wood = [hex("#a39277"), hex("#8e7e66"), hex("#b3a184"), hex("#978467")];
  // deck planks across the dock
  for (let z = D.z0 + 0.075; z < D.z1; z += 0.162) {
    const c = mul3(wood[(r() * 4) | 0], 0.9 + r() * 0.2);
    box(D.x1 - D.x0 + (r() - 0.5) * 0.04, 0.04, 0.15, (r() - 0.5) * 0.02, D.deck - 0.02, z, c);
  }
  // stringers and a fascia board on each side
  for (const x of [-0.85, 0.85]) box(0.08, 0.16, D.z1 - D.z0, x, D.deck - 0.12, (D.z0 + D.z1) / 2, hex("#6a5a44"));
  for (const x of [D.x0 - 0.02, D.x1 + 0.02]) box(0.04, 0.2, D.z1 - D.z0, x, D.deck - 0.1, (D.z0 + D.z1) / 2, hex("#7d6d55"));
  box(D.x1 - D.x0 + 0.08, 0.2, 0.04, 0, D.deck - 0.1, D.z0 - 0.02, hex("#7d6d55"));
  // posts down to the lake bottom, dark and green where they stay wet
  for (let z = D.z0 + 0.15; z < D.z1 - 2; z += 2.8) for (const x of [D.x0 - 0.08, D.x1 + 0.08]) {
    const bot = Math.min(place.height(x, z), 0) - 0.3, top = D.deck + 0.12, h = top - bot;
    const g = new THREE.CylinderGeometry(0.1, 0.11, h, 7);
    parts.push(bake(g, { matrix: M4().makeTranslation(x, (top + bot) / 2, z), colorFn: (px, py) => { const y = py; return y < 0.05 ? mix3(hex("#3a4a2a"), hex("#2a3322"), smooth(0, -1, y)) : y < 0.25 ? hex("#5a5a44") : hex("#8a7a60"); } }));
  }
  // cleats, a ladder at the end, a tackle box and a minnow bucket by your feet
  box(0.22, 0.05, 0.06, D.x1 - 0.12, D.deck + 0.03, 0.6, hex("#3a3a3a"));
  box(0.22, 0.05, 0.06, D.x0 + 0.12, D.deck + 0.03, 0.6, hex("#3a3a3a"));
  for (const x of [0.62, 1.02]) box(0.05, 1.3, 0.05, x, 0.05, D.z0 - 0.08, hex("#b8b8b0"));
  for (let y = -0.4; y < 0.6; y += 0.3) box(0.42, 0.03, 0.04, 0.82, y, D.z0 - 0.08, hex("#c8c8c0"));
  box(0.42, 0.2, 0.24, 0.72, D.deck + 0.1, 0.55, hex("#3d6e4a"), 0.3);
  box(0.44, 0.04, 0.26, 0.72, D.deck + 0.21, 0.55, hex("#4a8058"), 0.3);
  box(0.08, 0.03, 0.03, 0.72, D.deck + 0.245, 0.55, hex("#d8c040"), 0.3);
  parts.push(bake(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 10), { matrix: M4().makeTranslation(-0.72, D.deck + 0.15, 0.85), colorFn: (x, y) => (y > D.deck + 0.26 ? hex("#e8e0c8") : hex("#d8d4c4")) }));
  parts.push(bake(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10), { matrix: M4().makeTranslation(-0.72, D.deck + 0.28, 0.85), color: hex("#6a8a9a") }));
  // a red Muskoka chair behind you, looking out at the lake
  const chair = (cx, cz, ry) => {
    const m = (x, y, z) => M4().makeRotationY(ry).multiply(M4().makeTranslation(x, y, z)).premultiply(M4().makeTranslation(cx, D.deck, cz));
    const red = hex("#c8452e"), red2 = hex("#b33c28");
    for (let i = 0; i < 6; i++) parts.push(bake(new THREE.BoxGeometry(0.1, 0.02, 0.55), { matrix: m(-0.28 + i * 0.112, 0.36, 0.05).multiply(M4().makeRotationX(0.12)), color: i % 2 ? red : red2 }));
    for (let i = 0; i < 6; i++) parts.push(bake(new THREE.BoxGeometry(0.09, 0.8, 0.02), { matrix: m(-0.28 + i * 0.112, 0.72, 0.4).multiply(M4().makeRotationX(0.45)), color: i % 2 ? red : red2 }));
    for (const s of [-1, 1]) { parts.push(bake(new THREE.BoxGeometry(0.14, 0.02, 0.7), { matrix: m(s * 0.38, 0.6, 0.05), color: red })); parts.push(bake(new THREE.BoxGeometry(0.04, 0.6, 0.04), { matrix: m(s * 0.38, 0.3, -0.25), color: red2 })); parts.push(bake(new THREE.BoxGeometry(0.04, 0.4, 0.5), { matrix: m(s * 0.33, 0.2, 0.2).multiply(M4().makeRotationX(-0.2)), color: red2 })); }
  };
  chair(-0.5, 2.3, 0.15);
  chair(0.5, 2.4, -0.1);
  const geo = merge(parts);
  const m = new THREE.Mesh(geo, painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.9, scale: 6, key: "dock" }));
  m.renderOrder = 1;
  return m;
}

// A little cottage on the south shore, behind the dock: only the title camera ever sees it.
export function buildCottage(place, look) {
  const parts = [], ground = (x, z) => look.ground(x, z, place);
  const x0 = -9, z0 = 34, y0 = Math.max(0.5, ground(x0, z0)) - 0.2;
  const story = artStyle.value ? cartoonGeometry("cottage") : null;
  if (story) {
    story.rotateY(Math.PI); story.translate(x0, y0, z0);
    const canoe = new THREE.SphereGeometry(1, 12, 6); canoe.scale(.45, .22, 2.4);
    const boat = bake(canoe, { matrix: M4().makeRotationY(.4).setPosition(6, Math.max(.3, ground(6, 22)) + .15, 22), color: hex("#d77a48") });
    return new THREE.Mesh(merge([story, boat]), painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: .5, scale: 3, key: "cartoon-cottage" }));
  }
  const box = (w, h, d, x, y, z, c) => parts.push(bake(new THREE.BoxGeometry(w, h, d), { matrix: M4().makeTranslation(x0 + x, y0 + y, z0 + z), color: c }));
  box(8, 3, 6, 0, 1.5, 0, hex("#7a5236"));
  box(8.2, 0.3, 6.2, 0, 0.1, 0, hex("#5a4a3a"));
  const roof = new THREE.CylinderGeometry(0.01, 4.8, 2.4, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(1.25, 1, 0.95);
  parts.push(bake(roof, { matrix: M4().makeTranslation(x0, y0 + 4.2, z0), color: hex("#3f5a4a") }));
  box(0.7, 2.2, 0.7, 2.4, 4.6, 1, hex("#8a7a70"));
  for (const x of [-2.4, 0, 2.4]) box(1.1, 1.0, 0.1, x, 1.8, -3.02, hex("#f0d890"));
  box(1.2, 2.0, 0.1, -3.4, 1.0, -3.02, hex("#4a3424"));
  // a red canoe on the beach
  const canoe = new THREE.SphereGeometry(1, 12, 6);
  canoe.scale(0.45, 0.22, 2.4);
  parts.push(bake(canoe, { matrix: M4().makeRotationY(0.4).setPosition(6, Math.max(0.3, ground(6, 22)) + 0.15, 22), color: hex("#c23b2a") }));
  return new THREE.Mesh(merge(parts), painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1, scale: 3, key: "cot" }));
}

/* ---------------- the loon ---------------- */

export function buildLoon() {
  const story = artStyle.value ? cartoonGeometry("loon") : null;
  if (story) { const m = new THREE.Mesh(story, storyMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }))); m.scale.setScalar(1.25); return m; }
  const parts = [], r = rng(8);
  const black = hex("#15181a"), white = hex("#e8ece8"), dk = hex("#243030");
  const body = new THREE.SphereGeometry(1, 18, 10);
  body.scale(0.19, 0.12, 0.44);
  parts.push(bake(body, { colorFn: (x, y, z) => (y > 0.05 && Math.abs(x) > 0.03 && r() < 0.3 && z > -0.3 ? white : y < -0.02 ? white : black) }));
  const neck = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 8);
  parts.push(bake(neck, { matrix: M4().makeRotationX(-0.35).setPosition(0, 0.14, -0.32), colorFn: (x, y) => (Math.abs(y + 0.02) < 0.018 ? white : dk) }));
  const head = new THREE.SphereGeometry(0.07, 10, 8);
  head.scale(0.9, 0.85, 1.2);
  parts.push(bake(head, { matrix: M4().makeTranslation(0, 0.25, -0.38), color: black }));
  const bill = new THREE.ConeGeometry(0.022, 0.12, 6);
  bill.rotateX(-Math.PI / 2);
  parts.push(bake(bill, { matrix: M4().makeTranslation(0, 0.24, -0.5), color: hex("#2a2a2a") }));
  const tail = new THREE.ConeGeometry(0.06, 0.12, 6);
  tail.rotateX(Math.PI / 2);
  parts.push(bake(tail, { matrix: M4().makeTranslation(0, 0.03, 0.44), color: black }));
  const m = new THREE.Mesh(merge(parts), storyMaterial(new THREE.MeshLambertMaterial({ vertexColors: true })));
  m.scale.setScalar(1.25);
  return m;
}

/* ---------------- the props of the other places ---------------- */

// Stump Bay: the end of the old road. An asphalt slab down into the water, curbs, painted lines, cracks, and a
// striped barrier across each side of the road end (the middle stays open for the angler).
export function buildRoad(place) {
  const D = place.stand.dock, parts = [], r = rng(62);
  const W = D.x1 - D.x0, len = D.z1 - D.z0, mid = (D.z0 + D.z1) / 2, top = D.deck;
  const box = (w, h, d, x, y, z, c) => parts.push(bake(new THREE.BoxGeometry(w, h, d), { matrix: M4().setPosition(x, y, z), color: c }));
  const flat = (w, d, x, z, c, ry = 0) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); parts.push(bake(g, { matrix: M4().makeRotationY(ry).setPosition(x, top + 0.006, z), color: c })); };
  box(W, top + 2.4, len, 0, (top - 2.4) / 2, mid, hex("#4a4d52"));
  for (const s of [-1, 1]) box(0.3, 0.14, len, s * (W / 2 - 0.15), top + 0.07, mid, hex("#8c8a82"));
  for (let z = 3; z < D.z1 - 4; z += 6) flat(0.16, 2.4, 0, z, hex("#d8b840"));
  for (const s of [-1, 1]) flat(0.12, len - 0.6, s * (W / 2 - 0.65), mid, hex("#d8d6cc"));
  for (let i = 0; i < 8; i++) flat(0.4 + r() * 1.6, 0.06 + r() * 0.1, (r() - 0.5) * (W - 1), 1 + r() * 50, hex("#2c2e32"), (r() - 0.5) * 0.8);
  // the barrier: two posts and two striped rails
  for (const s of [-1, 1]) {
    box(0.16, 1.15, 0.16, s * 3.25, top + 0.575, D.z0 + 0.3, hex("#e2ded2"));
    for (let k = 0; k < 4; k++) box(0.5, 0.2, 0.05, s * (3.25 - 0.45 - k * 0.5), top + 0.9, D.z0 + 0.3, k % 2 ? hex("#e2ded2") : hex("#c8302a"));
  }
  const m = new THREE.Mesh(merge(parts), painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.7, scale: 6, key: "road" }));
  m.renderOrder = 1;
  return m;
}

// Stump Bay: stumps and dead trees, one shape drawn 120 times. A flared foot on the bottom, a trunk, a broken top.
// The trunk goes down to the bed, so the part below the surface shows through the water.
export function buildStumps(place) {
  const list = place.props.stumps, seg = 6, r = rng(64);
  const ring = (y, rad, jag) => Array.from({ length: seg }, (_, i) => { const a = (i / seg) * Math.PI * 2; return [Math.cos(a) * rad * (1 + (r() - 0.5) * 0.18), y - (jag ? r() * jag : 0), Math.sin(a) * rad * (1 + (r() - 0.5) * 0.18)]; });
  const rings = [ring(0, 1.5, 0), ring(0.16, 1.0, 0), ring(1, 0.82, 0.07)];
  const pos = [], col = [];
  const put = (v, c) => { pos.push(v[0], v[1], v[2]); col.push(c[0], c[1], c[2]); };
  const bark = hex("#9a8a72"), foot = hex("#4a4638"), fresh = hex("#c8b898");
  for (let b = 0; b < 2; b++) for (let i = 0; i < seg; i++) {
    const a = rings[b][i], c = rings[b][(i + 1) % seg], d = rings[b + 1][i], e = rings[b + 1][(i + 1) % seg];
    const ca = b ? mix3(bark, fresh, 0.15 * (i % 2)) : foot, cd = b ? mix3(bark, fresh, 0.35) : bark;
    put(a, ca); put(d, cd); put(c, ca); put(c, ca); put(d, cd); put(e, cd);
  }
  const t = rings[2];
  for (let i = 1; i < seg - 1; i++) { put(t[0], fresh); put(t[i + 1], fresh); put(t[i], fresh); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.InstancedMesh(g, painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.1, scale: 4, wet: true, key: "stump" }), list.length);
  const mx = M4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  list.forEach((s, i) => {
    const bed = Math.max(1.6, place.depth(s.x, s.z));
    e.set(s.tall ? (r() - 0.5) * 0.1 : 0, r() * 6.28, s.tall ? (r() - 0.5) * 0.1 : 0);
    q.setFromEuler(e);
    mx.compose(new THREE.Vector3(s.x, -bed, s.z), q, new THREE.Vector3(s.r, s.top + bed, s.r));
    m.setMatrixAt(i, mx);
    const k = 0.8 + r() * 0.5, dark = r() < 0.2 ? 0.65 : 1;
    m.setColorAt(i, c.setRGB(k * dark, k * dark * 0.98, k * dark * 0.94));
  });
  m.frustumCulled = false;
  return m;
}

// Gull Rock: the top of the granite wall (cap blocks near the end, a plain slab behind) and the lighthouse on the headland.
export function buildWall(place, look) {
  const D = place.stand.dock, F = place.features, parts = [], r = rng(65);
  const W = D.x1 - D.x0, bottom = -3.4, cap = 0.3, rows = 12, bl = 2.2;
  const box = (w, h, d, x, y, z, c, ry = 0, rx = 0) => parts.push(bake(new THREE.BoxGeometry(w, h, d), { matrix: M4().makeRotationY(ry).premultiply(M4().makeRotationX(rx)).setPosition(x, y, z), color: c }));
  const stone = [hex("#a8a49c"), hex("#b4b0a6"), hex("#9c9890"), hex("#aaa69c")];
  // the body of the wall, and behind the cap blocks a plain top
  const zEnd = D.z0 + rows * bl;
  box(W + 0.2, D.deck - cap - bottom, zEnd - D.z0, 0, (D.deck - cap + bottom) / 2, (D.z0 + zEnd) / 2, hex("#6c6864"));
  box(W + 0.2, D.deck - bottom, D.z1 - zEnd, 0, (D.deck + bottom) / 2, (zEnd + D.z1) / 2, hex("#8c8880"));
  // cap blocks: two columns, twelve rows, each a little different
  for (let i = 0; i < rows; i++) for (const cx of [-bl / 2, bl / 2]) {
    const h = cap + r() * 0.04, c = mul3(stone[(r() * 4) | 0], 0.92 + r() * 0.16);
    box(bl - 0.07, h, bl - 0.07, cx + (r() - 0.5) * 0.03, D.deck - cap + h / 2, D.z0 + (i + 0.5) * bl + (r() - 0.5) * 0.03, c, (r() - 0.5) * 0.03);
  }
  // the lighthouse: a white tower with red bands, a gallery, a lantern, a roof and a keeper's house
  const lx = F.light.x, lz = F.light.z, ly = look.ground(lx, lz, place) - 0.5;
  const cyl = (rt, rb, h, sides, y, c, open = false, x = lx, z = lz) => parts.push(bake(new THREE.CylinderGeometry(rt, rb, h, sides, 1, open), { matrix: M4().setPosition(x, ly + y, z), colorFn: (px, py) => c(py - ly - y) }));
  const white = hex("#ece8dc"), red = hex("#b83a2e");
  const TH = 22;
  cyl(1.7, 2.6, TH, 10, TH / 2, () => white, true);
  // the red bands are short tubes a little wider than the tower there
  for (const [u0, u1] of [[0.3, 0.46], [0.62, 0.78]]) {
    const rAt = (u) => 2.6 + (1.7 - 2.6) * u + 0.04;
    cyl(rAt(u1), rAt(u0), (u1 - u0) * TH, 10, ((u0 + u1) / 2) * TH, () => red, true);
  }
  cyl(2.5, 2.5, 0.4, 8, TH + 0.2, () => hex("#3a3a3c"));
  cyl(1.1, 1.1, 2.0, 8, TH + 1.4, () => hex("#f4e8a8"), true);
  cyl(0.02, 1.7, 1.5, 8, TH + 3.15, () => red, true);
  box(6, 3.4, 4.4, lx + 5.5, ly + 1.7, lz + 1, hex("#e2dccc"));
  parts.push(bake(new THREE.CylinderGeometry(0.02, 4, 1.8, 4, 1, true), { matrix: M4().makeRotationY(Math.PI / 4).scale(new THREE.Vector3(1.06, 1, 0.78)).setPosition(lx + 5.5, ly + 4.3, lz + 1), color: hex("#6a4a3a") }));
  const m = new THREE.Mesh(merge(parts), painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.8, scale: 3, key: "wall" }));
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

// Cedar River: the logjam. Each log is a short six-sided trunk lying in the water; some have a root ball.
export function buildLogjam(place) {
  const parts = [];
  const wood = [hex("#8a7e6c"), hex("#75695a"), hex("#9a8e7a")];
  place.props.logs.forEach((l, i) => {
    const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz), phi = Math.atan2(dz, dx);
    const c = wood[i % 3], y = l.top - l.r * 0.9;
    const g = new THREE.CylinderGeometry(l.r * 0.85, l.r * 1.05, len, 6, 1);
    g.rotateZ(Math.PI / 2);
    parts.push(bake(g, { matrix: M4().makeRotationY(-phi).setPosition((l.ax + l.bx) / 2, y, (l.az + l.bz) / 2), colorFn: (px, py) => mul3(c, 0.85 + 0.3 * smooth(-l.r, l.r, py - y)) }));
    if (i % 2 === 0) {
      const ball = new THREE.IcosahedronGeometry(l.r * 1.5, 0);
      ball.scale(1, 0.8, 1);
      parts.push(bake(ball, { matrix: M4().setPosition(l.ax, y + l.r * 0.2, l.az), color: mul3(c, 0.7) }));
    }
  });
  const m = new THREE.Mesh(merge(parts), painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.2, scale: 4, wet: true, key: "logs" }));
  m.frustumCulled = false;
  return m;
}

// The props of a place that do not change with the quality (the look lists them). The loon is returned apart: it swims.
export function buildProps(place, look) {
  const group = new THREE.Group();
  let loon = null;
  const add = (m) => { if (m) group.add(m); return m; };
  for (const name of look.props) {
    if (name === "rocks") add(buildRocks(place, look));
    else if (name === "dock") add(buildDock(place));
    else if (name === "cottage") add(buildCottage(place, look));
    else if (name === "loon") loon = add(buildLoon());
    else if (name === "road") add(buildRoad(place));
    else if (name === "stumps") add(buildStumps(place));
    else if (name === "wall") add(buildWall(place, look));
    else if (name === "logjam") add(buildLogjam(place));
  }
  return { group, loon };
}
