// The lake around the dock: sky, water, land, trees, rocks, pads, reeds, the dock and a loon.
// Every mesh is built here in code from lake.js, so the fish logic and the picture share one map.
import * as THREE from "three";
import * as L from "./lake.js";

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Uniforms that many materials share: the clock and the colours of the hour (world.js sets them).
export const U = {
  uTime: { value: 0 },
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
  uCloudLit: { value: new THREE.Color() },
  uCloudShade: { value: new THREE.Color() },
  uForest: { value: new THREE.Color() },
  uDeep: { value: new THREE.Color() },
  uShallow: { value: new THREE.Color() },
  uFoam: { value: new THREE.Color() },
  uLight: { value: 1 },
};

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
uniform float uNight;
vec3 skyColor(vec3 d) {
  float y = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, y), 0.6));
  float s = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - smoothstep(0.0, 0.55, y);
  c += uGlow * (pow(s, 3.0) * 0.42 * low + pow(s, 24.0) * 0.5 + pow(s, 200.0) * 0.6);
  return c;
}
`;

/* ---------------- materials ---------------- */

// A painted look for lit materials: world-space brush strokes, warm dabs, optional wind sway and water caustics.
export function painted(mat, { strokes = 1, scale = 1, sway = 0, caustics = false, key = "" } = {}) {
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
          float net = pow(1.0 - abs(c1 - c2) * 2.2, 6.0);
          diffuseColor.rgb += net * 0.32 * uSunVis * smoothstep(-3.5, -0.2, vWP.y) * vec3(1.0, 0.96, 0.8);
          diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.0, -4.0, vWP.y));
        }` : ""}
      }`);
  };
  mat.customProgramCacheKey = () => "fishpaint" + strokes + "_" + scale + "_" + sway + "_" + caustics + key;
  return mat;
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
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const M4 = () => new THREE.Matrix4();

/* ---------------- sky ---------------- */

export function buildSky(low) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uZenith: U.uZenith, uHorizon: U.uHorizon, uGlow: U.uGlow, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uFogCol: U.uFogCol, uNight: U.uNight, uCloudLit: U.uCloudLit, uCloudShade: U.uCloudShade },
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    defines: { OCT: low ? 3 : 5 },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCloudLit, uCloudShade; varying vec3 vDir;
      ${SKY_GLSL}
      ${NOISE_GLSL}
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(17.1, 3.7); a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float s = dot(d, uSunDir);
        // the sun: a soft disc with a bright core
        col += uSunCol * (smoothstep(0.9986, 0.9994, s) * 1.6 + smoothstep(0.990, 0.9994, s) * 0.25) * (1.0 - uNight);
        // soft painted clouds on a high flat layer, lit from the sun side
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.14);
          uv = vec2(uv.x * 0.9 + uv.y * 0.25, uv.y * 2.1) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
          float n = fbm(uv);
          float body = smoothstep(0.5, 0.74, n) * smoothstep(0.0, 0.2, d.y);
          float thick = smoothstep(0.58, 0.95, n);
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

// How far out a point is from the middle of the bay: 1 is about the shore line.
export const bayE = (x, z) => Math.hypot((x - 5) / 140, (z + 95) / 115);
// The ground: lake.js near the dock and in the water. Beyond the reach of a cast the shore rises gently into
// rolling far hills instead (lake.js climbs steeply, which reads as a wall from the dock). Only the picture uses this.
export function ground(x, z) {
  const h = L.height(x, z);
  if (h <= 0) return h;
  const e = bayE(x, z);
  if (e < 1) return h;  // the point and Clog Island
  const r = e - 1;  // bayE is already the square root of lake.js's bay()
  let v = 0.4 + r * 30 + 2.5 * L.noise(x / 17, z / 17) * smooth(0, 0.05, r);
  v += smooth(0.15, 1.1, r) * (8 + 26 * (0.5 + 0.5 * L.noise(x / 170 + 4, z / 170 - 2)) + 7 * L.noise(x / 55, z / 55));
  v = Math.max(0.15, v);
  return lerp(h, v, smooth(55, 95, Math.hypot(x, z - 10)));
}
// Where the forest grows (0..1): the same mask colours the ground and places the trees.
export function forest(x, z) {
  const e = bayE(x, z);
  let f = 0.55 + 0.45 * L.noise(x / 26 + 7, z / 26 - 3) + 0.2 * L.noise(x / 9, z / 9);
  if (Math.abs(x) < 18 && z > 14 && z < 70) f -= 1.2 * (1 - smooth(10, 18, Math.abs(x)));   // the cottage lawn
  if (L.pointDist(x, z) < 0) f -= 0.8 * (1 - smooth(6, 26, Math.hypot(x - L.POINT.bx, z - L.POINT.bz))); // bare rock at the tip
  if (L.islandDist(x, z) < 0) f = 0.9;
  if (e > 1.5) f = Math.max(f, 0.75);
  return clamp(f, 0, 1);
}

const PAL = {
  sand: hex("#d9c28c"), wet: hex("#a8956a"), bed1: hex("#b5a47a"), bed2: hex("#7c7a52"), bed3: hex("#3e4a36"), weed: hex("#46602f"),
  grass: hex("#8fa650"), meadow: hex("#a8b45c"), forest: hex("#34502a"), far: hex("#3a5a34"), granite: hex("#b39c90"), graniteDk: hex("#7e726c"), lichen: hex("#a7a468"),
};

function groundColor(x, z, h, ny) {
  const n1 = L.noise(x / 7.3, z / 7.3), n2 = L.noise(x / 2.1 + 3, z / 2.1);
  if (h < 0) {
    const d = -h;
    let c = d < 1.2 ? mix3(PAL.sand, PAL.bed1, smooth(0.1, 1.2, d)) : d < 5 ? mix3(PAL.bed1, PAL.bed2, smooth(1.2, 5, d)) : mix3(PAL.bed2, PAL.bed3, smooth(5, 14, d));
    const inWeeds = x > L.WEEDS.x0 && x < L.WEEDS.x1 && z > L.WEEDS.z0 && z < L.WEEDS.z1;
    if (inWeeds && d > 0.5) c = mix3(c, PAL.weed, clamp(0.55 + 0.5 * n1, 0, 1));
    if (L.pointDist(x, z) < 12 || L.islandDist(x, z) < 8) c = mix3(c, PAL.graniteDk, clamp(0.5 + n1, 0, 0.8));
    return mul3(c, 1 + 0.1 * n2);
  }
  const e = bayE(x, z), rocky = L.pointDist(x, z) < 1.5 || (L.islandDist(x, z) < 0 && L.islandDist(x, z) > -4);
  if (h < 0.75) {
    let c = mix3(PAL.wet, PAL.sand, smooth(0.15, 0.6, h));
    if (rocky) c = mix3(PAL.granite, PAL.graniteDk, 0.5 + 0.5 * n2);
    return mul3(c, 1 + 0.08 * n2);
  }
  let c = mix3(PAL.grass, PAL.meadow, clamp(0.5 + n1, 0, 1));
  c = mix3(c, PAL.forest, forest(x, z) * 0.9);
  if (rocky) c = mix3(c, mix3(PAL.granite, PAL.lichen, clamp(0.3 + n1, 0, 1)), 0.75);
  if (ny < 0.72) c = mix3(c, mix3(PAL.granite, PAL.graniteDk, 0.4 + 0.4 * n2), smooth(0.72, 0.5, ny) * 0.8);
  if (e > 1.5) {
    // far hills read as forest canopy: dark with lighter crowns
    const crown = L.noise(x / 11, z / 11), big = L.noise(x / 70, z / 70);
    c = mix3(c, mul3(PAL.far, 0.9 + 0.3 * crown + 0.12 * big), smooth(1.5, 1.8, e));
  }
  return mul3(c, 1 + 0.07 * n2);
}

// Grid lines: even steps over the bay, growing steps out to the far hills.
function axis(a, b, step, fa, fb) {
  const out = [];
  for (let v = a; v <= b + 1e-6; v += step) out.push(v);
  let s = step, v = out[0];
  while (v > fa) { s *= 1.3; v = Math.max(fa, v - s); out.unshift(v); }
  s = step; v = out[out.length - 1];
  while (v < fb) { s *= 1.3; v = Math.min(fb, v + s); out.push(v); }
  return out;
}

export function buildTerrain(low) {
  const step = low ? 4.4 : 2.8;
  const xs = axis(-175, 190, step, -620, 640), zs = axis(-255, 55, step, -700, 380);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = ground(xs[i], zs[j]);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    // slope from the neighbours, for rocky steeps
    const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j + 1);
    const dx = (H[j * nx + i1] - H[j * nx + i0]) / (xs[i1] - xs[i0] || 1), dz = (H[j1 * nx + i] - H[j0 * nx + i]) / (zs[j1] - zs[j0] || 1);
    const ny = 1 / Math.sqrt(1 + dx * dx + dz * dz);
    const c = groundColor(x, z, h, ny);
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

// The lake depth baked into a small texture, so the water can tint its shallows.
export const DEPTH_BOX = { x0: -150, z0: -235, w: 310, h: 280 };
function depthTexture() {
  const N = 256, data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = DEPTH_BOX.x0 + ((i + 0.5) / N) * DEPTH_BOX.w, z = DEPTH_BOX.z0 + ((j + 0.5) / N) * DEPTH_BOX.h;
    const h = L.height(x, z), k = (j * N + i) * 4;
    data[k] = Math.round(clamp(-h / 25, 0, 1) * 255);
    data[k + 1] = h > 0 ? 255 : 0;
    data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const RIPPLES = 16, RINGS = 6;
export function buildWater(low) {
  const u = {
    uTime: U.uTime, uZenith: U.uZenith, uHorizon: U.uHorizon, uGlow: U.uGlow, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uFogCol: U.uFogCol, uNight: U.uNight,
    uFogNear: U.uFogNear, uFogFar: U.uFogFar, uForest: U.uForest, uDeep: U.uDeep, uShallow: U.uShallow, uFoam: U.uFoam, uSunVis: U.uSunVis,
    uDepth: { value: depthTexture() }, uBox: { value: new THREE.Vector4(DEPTH_BOX.x0, DEPTH_BOX.z0, 1 / DEPTH_BOX.w, 1 / DEPTH_BOX.h) },
    uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uRing: { value: Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uAim: { value: new THREE.Vector4(0, -1, 0, 0) },
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
      uniform sampler2D uDepth; uniform vec4 uBox;
      uniform vec4 uRip[RIPPLES];
      uniform vec4 uRing[RINGS];
      uniform vec4 uAim, uLoon, uLure;
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
      // how tall the far shore (or Clog Island) looks from p, looking along d: tan of its elevation, and how far it is
      float shoreEl(vec2 p, vec2 d, out float t) {
        vec2 o = (p - vec2(5.0, -95.0)) / vec2(140.0, 115.0), v = d / vec2(140.0, 115.0);
        float a = dot(v, v), b = dot(o, v), c = dot(o, o) - 1.0;
        t = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
        float el = 16.0 / max(t, 1.0);
        vec2 oc = p - vec2(34.0, -128.0);
        float bi = dot(oc, d), di = bi * bi - dot(oc, oc) + 225.0;
        if (di > 0.0) { float ti = -bi - sqrt(di); if (ti > 0.0 && ti < t) { el = max(el, 21.0 / ti); t = ti; } }
        return max(el, 0.07);
      }
      void main() {
        vec2 p = vW.xz;
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        // how much lake one pixel covers here: small waves fade out before they can shimmer
        vec2 fw = fwidth(p);
        float fp = max(fw.x, fw.y) * 0.8;
        float depth = texture2D(uDepth, (p - uBox.xy) * uBox.zw).r * 25.0;
        vec2 g = vec2(0.0);
        float keep = 0.0;
        float s1 = 1.0 - smoothstep(0.8, 4.0, fp);
        g += (swell(p, vec2(0.83, 0.56), 0.55, 1.3, 0.05) + swell(p, vec2(0.28, 0.96), 0.9, 1.8, 0.03)) * s1;
        g += swell(p, vec2(-0.6, 0.8), 1.7, 2.6, 0.012) * (1.0 - smoothstep(0.3, 1.4, fp));
        float s2 = 1.0 - smoothstep(0.2, 0.9, fp);
        g += vnoised(p * 0.7 + vec2(uTime * 0.18, uTime * 0.11)).yz * 0.13 * s2;
        keep = s2;
        #if LOW == 0
        float s3 = 1.0 - smoothstep(0.06, 0.32, fp), s4 = 1.0 - smoothstep(0.025, 0.12, fp);
        g += vnoised(p * 2.3 - vec2(uTime * 0.31, -uTime * 0.23)).yz * 0.07 * s3;
        g += vnoised(p * 6.1 + vec2(uTime * 0.6, uTime * 0.2)).yz * 0.035 * s4;
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
          float env = exp(-x * x / (w * w * 4.0)) * pow(1.0 - age / life, 2.0) * min(r.w * 1.5, 1.0);
          g += dv / rr * sin(x * 9.0) * env * 0.9 * s2;
          foam += env * mix(1.0, smoothstep(0.0, 0.35, cos(x * 9.0)), s2) * 0.8;
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
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyColor(R);
        // the far shore mirrored in the water: where the reflected ray meets the treeline
        float hr = max(length(R.xz), 1e-3), t;
        vec2 d = R.xz / hr;
        float el = shoreEl(p, d, t);
        el *= 1.0 + 0.35 * (vnoise(vec2(atan(d.x, -d.y) * 40.0, 0.5)) - 0.5);
        float shore = smoothstep(el * 1.04 + 0.004, el * 0.96 - 0.002, R.y / hr);
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
        spec += pow(sd, 40.0) * step(0.965, hash12(floor(p * 5.0) + floor(uTime * 7.0))) * 1.6 * s4;
        #endif
        spec *= uSunVis * (1.0 - shore);
        col += uSunCol * spec;
        col += uFoam * clamp(foam, 0.0, 1.2) * 0.6;
        col += goldGlow;
        // the aim: a dotted line on the water from the dock end
        if (uAim.z > 0.01) {
          vec2 dir = uAim.xy, q = p - vec2(0.0, -0.6);
          float ta = dot(q, dir), sa = dot(q, vec2(-dir.y, dir.x));
          if (ta > 3.0 && ta < 14.0) {
            float cell = (fract(ta / 0.8) - 0.5) * 0.8;
            float rad = 0.07 + ta * 0.012;
            float dotv = smoothstep(rad, rad * 0.55, length(vec2(cell, sa)));
            float fadeIn = smoothstep(3.0, 4.0, ta) * smoothstep(14.0, 11.5, ta);
            col = mix(col, vec3(1.0, 0.97, 0.86), dotv * fadeIn * uAim.z);
          }
        }
        // soft edge at the shore
        float edge = smoothstep(0.02, 0.35, depth);
        float alpha = clamp(mix(0.25, 1.0, smoothstep(0.0, 5.0, depth)) + fres * 0.7 + spec + foam * 0.3 + length(goldGlow), 0.0, 1.0);
        alpha *= edge;
        col += uFoam * (1.0 - smoothstep(0.05, 0.45, depth + (vnoise(p * 0.6 + uTime * 0.2) - 0.5) * 0.25)) * 0.35 * edge;
        float fg = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogCol, fg);
        alpha = mix(alpha, 1.0, fg * edge);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const geo = new THREE.PlaneGeometry(DEPTH_BOX.w, DEPTH_BOX.h, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(DEPTH_BOX.x0 + DEPTH_BOX.w / 2, 0, DEPTH_BOX.z0 + DEPTH_BOX.h / 2);
  const water = new THREE.Mesh(geo, mat);
  water.renderOrder = 5;
  water.frustumCulled = false;
  return { water, u };
}

/* ---------------- trees ---------------- */

function pineGeo(low) {
  const parts = [];
  const seg = low ? 5 : 7, tiers = low ? [[0.3, 0.12, 0.6], [0.2, 0.46, 0.54]] : [[0.3, 0.1, 0.46], [0.24, 0.32, 0.42], [0.16, 0.54, 0.46]];
  const dark = hex("#24442a"), mid = hex("#3a6838"), tipC = hex("#6a9a48");
  const r = L.rng(5);
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
function leafyGeo(low) {
  const parts = [];
  const g = new THREE.IcosahedronGeometry(0.34, low ? 0 : 1);
  const p = g.attributes.position, r = L.rng(9);
  for (let i = 0; i < p.count; i++) { const k = 0.85 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.15, p.getZ(i) * k); }
  g.computeVertexNormals();
  const lo = hex("#46652c"), hi = hex("#8fae4c");
  parts.push(bake(g, { matrix: M4().makeTranslation(0, 0.62, 0), colorFn: (x, y) => mix3(lo, hi, smooth(0.35, 1.0, y)) }));
  parts.push(bake(new THREE.CylinderGeometry(0.02, 0.035, 0.36, 4, 1, true), { matrix: M4().makeTranslation(0, 0.18, 0), color: hex("#d8d2c0") }));
  return merge(parts);
}
function farPineGeo(low) {
  const g = new THREE.ConeGeometry(0.28, 1, low ? 4 : 6, 1, true);
  g.translate(0, 0.5, 0);
  return bake(g, { colorFn: (x, y) => mix3(hex("#26462c"), hex("#4a7a40"), y) });
}

// Where the trees stand. Sorted in a shuffled order so "low" can draw only the first part and still look even.
function treeSpots() {
  const r = L.rng(404);
  const near = [], leafy = [], far = [];
  for (let gx = -230; gx < 250; gx += 4.6) for (let gz = -310; gz < 90; gz += 4.6) {
    const x = gx + (r() - 0.5) * 4, z = gz + (r() - 0.5) * 4;
    const e = bayE(x, z);
    if (e > 1.62) continue;
    const h = ground(x, z);
    if (h < 0.9 || L.onDock(x, z)) continue;
    const f = forest(x, z);
    if (r() > f * 0.95) continue;
    const s = 0.8 + r() * 0.5;
    if (r() < 0.2 + 0.12 * L.noise(x / 40, z / 40) && L.islandDist(x, z) > 0) leafy.push({ x, y: h - 0.2, z, s: 8 + r() * 5, rot: r() * 6.28 });
    else near.push({ x, y: h - 0.3, z, s: (10 + r() * 9) * s, rot: r() * 6.28 });
  }
  // the far hills: small cones, mostly where the camera looks (north, east and west)
  for (let gx = -560; gx < 580; gx += 7.5) for (let gz = -640; gz < 160; gz += 7.5) {
    const x = gx + (r() - 0.5) * 7, z = gz + (r() - 0.5) * 7;
    const e = bayE(x, z);
    if (e < 1.58 || e > 3.9) continue;
    if (z > 60 && e > 1.9) continue;
    if (r() > 0.78) continue;
    far.push({ x, y: ground(x, z) - 0.5, z, s: 12 + r() * 9, rot: r() * 6.28 });
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { near: shuffle(near), leafy: shuffle(leafy), far: shuffle(far) };
}

function instanced(geo, mat, spots, max, tint) {
  const n = Math.min(spots.length, max);
  const m = new THREE.InstancedMesh(geo, mat, n);
  const mx = M4(), q = new THREE.Quaternion(), c = new THREE.Color(), r = L.rng(77);
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

export function buildTrees(low) {
  const S = treeSpots();
  const mat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.9, scale: 1.4, sway: 0.012, key: "tree" });
  const leafMat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1.2, scale: 2.2, sway: 0.02, key: "leaf" });
  const farMat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 0.8, scale: 0.6, key: "far" });
  const g = new THREE.Group();
  const pineTint = (r) => { const k = 0.8 + r() * 0.35, b = r(); return [k * (0.95 + b * 0.1), k, k * (0.9 + (1 - b) * 0.2)]; };
  g.add(instanced(pineGeo(low), mat, S.near, low ? 1100 : 2300, pineTint));
  g.add(instanced(leafyGeo(low), leafMat, S.leafy, low ? 260 : 560, (r) => { const t = r(); return t < 0.15 ? [1.25, 1.0, 0.62] : [0.85 + t * 0.3, 0.9 + t * 0.2, 0.85]; }));
  g.add(instanced(farPineGeo(low), farMat, S.far, low ? 2600 : 5200, pineTint));
  return g;
}

/* ---------------- rocks, pads, reeds ---------------- */

export function buildRocks() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position, r = L.rng(21);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.22 * L.noise(x * 1.7 + 3, z * 1.7 + y * 1.3) + 0.08 * (r() - 0.5);
    p.setXYZ(i, x * k, y * k * (y < 0 ? 0.7 : 1), z * k);
  }
  g.computeVertexNormals();
  const geo = bake(g, { colorFn: (x, y, z) => { const t = L.noise(x * 2 + 1, z * 2 + y); return y > 0.45 && t > 0.1 ? hex("#a8a66a") : mix3(hex("#8e7f78"), hex("#c2aa9c"), clamp(0.5 + t, 0, 1)); } });
  const spots = L.ROCKS.map((k) => ({ x: k.x, z: k.z, r: k.r, top: k.top }));
  // granite on the point and the island shore, above the water
  const rr = L.rng(88);
  for (let i = 0; spots.length < L.ROCKS.length + 40 && i < 3000; i++) {
    const onIsland = rr() < 0.4;
    const x = onIsland ? L.ISLAND.x + (rr() - 0.5) * 40 : L.POINT.bx - 4 + rr() * 60, z = onIsland ? L.ISLAND.z + (rr() - 0.5) * 40 : L.POINT.bz - 14 + rr() * 26;
    const d = onIsland ? L.islandDist(x, z) : L.pointDist(x, z), h = L.height(x, z);
    if (d > 0.5 || d < -5 || h < 0) continue;
    spots.push({ x, z, r: 0.5 + rr() * 1.3, top: h + 0.3 + rr() * 0.6 });
  }
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

export function buildPads(low) {
  const group = new THREE.Group();
  const g = new THREE.CircleGeometry(1, low ? 9 : 14, 0.3, Math.PI * 2 - 0.6);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, d * d * 0.03); }
  g.computeVertexNormals();
  const geo = bake(g, { colorFn: (x, y, z) => mix3(hex("#8fb04a"), hex("#4f7a30"), Math.hypot(x, z)) });
  const mat = painted(new THREE.MeshLambertMaterial({ vertexColors: true }), { strokes: 1, scale: 4, key: "pad" });
  const pads = new THREE.InstancedMesh(geo, mat, L.LILIES.length);
  const mx = M4(), q = new THREE.Quaternion(), c = new THREE.Color(), r = L.rng(3), up = new THREE.Vector3(0, 1, 0);
  L.LILIES.forEach((l, i) => {
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
  const fl = L.LILIES.filter((l) => l.flower);
  const flowers = new THREE.InstancedMesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true }), fl.length);
  fl.forEach((l, i) => { mx.compose(new THREE.Vector3(l.x + 0.1, 0.05, l.z), q.setFromAxisAngle(up, l.rot), new THREE.Vector3(1.5, 1.5, 1.5)); flowers.setMatrixAt(i, mx); });
  flowers.frustumCulled = false;
  group.add(flowers);
  return group;
}

export function buildReeds(low) {
  const r = L.rng(19), stalks = [], tails = [];
  for (const c of L.REEDS) {
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

export function buildDock() {
  const D = L.DOCK, parts = [], r = L.rng(61);
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
    const bot = Math.min(L.height(x, z), 0) - 0.3, top = D.deck + 0.12, h = top - bot;
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
export function buildCottage() {
  const parts = [];
  const x0 = -9, z0 = 34, y0 = Math.max(0.5, ground(x0, z0)) - 0.2;
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
  const parts = [], r = L.rng(8);
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
  const m = new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.scale.setScalar(1.25);
  return m;
}
