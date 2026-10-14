// Light Years Home v3: traffic galaxies. Near ones (within 200 u, the nearest few hundred) are instanced impostors from
// one 2 × 2 atlas baked at boot (three spirals and an elliptical, render/galaxy.js bakeImpostor): discs lie in their
// own plane, ellipticals and dwarfs face the camera. Every body is also a sized point (render/points.js), which takes
// over from 200 to 250 u and shows alone until the atlas lands. Positions come from core/traffic.js every frame, so
// what you see is what you hit. Also the road curve that render/roads.js and the sparks share.
// Sources: render/galaxy.js (the log-spiral generator, Hildebrand et al. 2006 dust); three.js instancing.
import * as THREE from 'three';
import { fillPositions } from '../core/traffic.js';
import { bakeImpostor } from './galaxy.js';
import { createPointMaterial, createPoints } from './points.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- the road curve ----------

// A road as WP1's core/traffic.js builds it: uniform Catmull-Rom through pts (the end points doubled), by arc length.
// Used when no traffic tables are at hand.
function localCurve(pts) {
  const P0 = pts.map((p) => [p[0], p[1], p[2] || 0]);
  const P = [P0[0], ...P0, P0[P0.length - 1]];
  const dense = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
    const n = Math.max(4, Math.ceil(seg / 1));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2
        + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  dense.push(P0[P0.length - 1]);
  return tableCurve(dense);
}

// A curve over a list of points by arc length.
function tableCurve(samples) {
  const cum = [0];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const length = cum[cum.length - 1] || 1;
  function locate(s) {
    const L = clamp(s, 0, 1) * length;
    let lo = 0, hi = Math.max(1, cum.length - 1);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= L) lo = m; else hi = m; }
    const f = (L - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return [lo, Math.min(hi, samples.length - 1), f];
  }
  return {
    length,
    at(s, out = [0, 0, 0]) {
      const [a, b, f] = locate(s);
      for (let c = 0; c < 3; c++) out[c] = samples[a][c] + (samples[b][c] - samples[a][c]) * f;
      return out;
    },
    tangent(s, out = [0, 0, 0]) {
      const [a, b] = locate(s);
      const d = [samples[b][0] - samples[a][0], samples[b][1] - samples[a][1], samples[b][2] - samples[a][2]];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      out[0] = d[0] / l; out[1] = d[1] / l; out[2] = d[2] / l;
      return out;
    },
  };
}

/**
 * roadCurve(road, traffic?) → { length, at(s, out), tangent(s, out) }: a zone road ({ kind: 'road', pts }), s 0..1 by
 * arc length along pts. With core/traffic.js's tables (traffic.roads, matched by id) the river, the sparks and the
 * traffic ride one curve; without them the same spline is made here.
 */
export function roadCurve(road, traffic = null) {
  const t = traffic?.roads?.find?.((r) => r.id === road.id);
  if (t && t.n > 1) {
    const samples = [];
    for (let i = 0; i < t.n; i++) samples.push([t.x[i], t.y[i], t.z[i]]);
    return tableCurve(samples);
  }
  return localCurve(road.pts);
}

// The tube radius of a road at s (a number, or [[from, to, r], ...]).
export function tubeAt(road, s) {
  const t = road.tube;
  if (Array.isArray(t)) {
    for (const [a, b, r] of t) if (s >= a && s <= b) return r;
    return t[t.length - 1][2];
  }
  return Number.isFinite(t) ? t : 12;
}

// ---------- the atlas ----------

// Tiles: 0 grand spiral, 1 barred spiral, 2 flocculent spiral, 3 an irregular dwarf. Ellipticals need no tile: a
// smooth profile in the shader looks better than baked points.
export const ATLAS_TILES = Object.freeze(['wp-grand', 'wp-barred', 'wp-flocculent', 'dwarf']);
const DWARF = { preset: false, seed: 'lyh3-dwarf', type: 'irregular', radius: 9000, clumps: 6, knots: 0.012,
  look: { knots: 1.5, stretch: [1, 0.75], temperature: 6800 } };
const MARGIN = 1.12;

const COPY_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COPY_FS = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(uMap, vUv); }`;

/**
 * bakeAtlas(stage, tile = stage.budget.tile) → Promise<texture>: the four traffic faces in one 2 × 2 atlas, one bake
 * per frame slice. Cached in stage.cache; lost with the context and baked again on the next call.
 */
export function bakeAtlas(stage, tile = stage.budget.tile) {
  const key = `atlas:${tile}`;
  if (stage.cache.has(key)) return stage.cache.get(key);
  const renderer = stage.renderer;
  const S = tile * 2;
  const rt = new THREE.WebGLRenderTarget(S, S, { type: THREE.UnsignedByteType, depthBuffer: false,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.name = 'traffic-atlas';
  rt.texture.userData = { rt, bytes: Math.round(S * S * 4 * 4 / 3), tiles: ATLAS_TILES.slice(), margin: MARGIN };
  const copy = new THREE.ShaderMaterial({ vertexShader: COPY_VS, fragmentShader: COPY_FS,
    uniforms: { uMap: { value: null } }, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  let i = 0;
  const job = () => {
    const id = ATLAS_TILES[i];
    const tex = id === 'dwarf' ? bakeImpostor(renderer, DWARF, tile) : bakeImpostor(renderer, { id }, tile);
    const prev = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(rt);
    if (i === 0) { renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); }
    rt.viewport.set((i % 2) * tile, Math.floor(i / 2) * tile, tile, tile);
    rt.scissor.set((i % 2) * tile, Math.floor(i / 2) * tile, tile, tile);
    rt.scissorTest = true;
    copy.uniforms.uMap.value = tex;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    rt.scissorTest = false;
    rt.viewport.set(0, 0, S, S);
    renderer.setRenderTarget(prev);
    renderer.autoClear = prevAuto;
    renderer.setClearColor(0x000000, 1);
    tex.userData.rt?.dispose();
    i++;
    if (i < ATLAS_TILES.length) return false;
    copy.dispose();
    quad.geometry.dispose();
    stage.track(rt.texture);
    return rt.texture;
  };
  const p = stage.slice(30, job);
  stage.cache.set(key, p);
  return p;
}

// ---------- impostors ----------

const IMP_VS = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec4 iPos;         // xyz, radius (u)
  attribute vec4 iLook;        // tile (4: a smooth elliptical), fade, spin, temperature
  attribute vec3 iNormal;      // discs: the normal; facing: x is the axis ratio
  uniform float uMargin, uFacing;
  varying vec2 vUv, vC;
  varying float vFade, vTemp, vTile;
  void main() {
    float s = iPos.w * uMargin;
    float cs = cos(iLook.z), sn = sin(iLook.z);
    vec2 c = vec2(cs * aCorner.x - sn * aCorner.y, sn * aCorner.x + cs * aCorner.y);
    float tile = iLook.x;
    vTile = tile;
    vUv = (aCorner * 0.5 + 0.5) * 0.5 + vec2(mod(tile, 2.0), floor(tile / 2.0)) * 0.5;
    vC = vec2(aCorner.x, aCorner.y / max(0.3, uFacing > 0.5 ? iNormal.x : 1.0)) * uMargin;
    vFade = iLook.y;
    vTemp = iLook.w;
    if (uFacing > 0.5) {
      vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
      mv.xy += c * s;
      gl_Position = projectionMatrix * mv;
    } else {
      vec3 n = normalize(iNormal);
      vec3 t1 = normalize(cross(n, abs(n.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(n, t1);
      vec3 p = iPos.xyz + (t1 * c.x + t2 * c.y) * s;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
    if (vFade < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const IMP_FS = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGain;
  varying vec2 vUv, vC;
  varying float vFade, vTemp, vTile;
  void main() {
    // A light tint by temperature: warm ellipticals, cool dwarfs.
    vec3 tint = vTemp < 5500.0 ? mix(vec3(1.12, 0.92, 0.75), vec3(1.0), (vTemp - 4000.0) / 1500.0)
      : mix(vec3(1.0), vec3(0.8, 0.92, 1.15), clamp((vTemp - 5500.0) / 4000.0, 0.0, 1.0));
    if (vTile > 3.5) {
      // An elliptical: a bright nucleus in a smooth exponential glow, warm.
      float x = length(vC);
      if (x > 1.12) discard;
      float I = 0.8 * exp(-x / 0.17) + 1.2 * exp(-(x / 0.05) * (x / 0.05));
      I *= 1.0 - smoothstep(0.75, 1.12, x);
      vec3 c = (1.0 - exp(-I * vec3(1.0, 0.82, 0.62) * 1.4)) * tint;
      gl_FragColor = vec4(c * uGain * 0.5 * vFade, 0.0);
    } else {
      vec4 t = texture2D(uMap, vUv);
      vec3 rgb = t.rgb * t.rgb;
      gl_FragColor = vec4(rgb * tint * uGain * vFade, t.a * vFade);
    }
    #include <colorspace_fragment>
  }`;

function impostorMesh(cap, atlas, facing) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iLook = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iNormal = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', iPos);
  g.setAttribute('iLook', iLook);
  g.setAttribute('iNormal', iNormal);
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: IMP_VS, fragmentShader: IMP_FS,
    uniforms: { uMap: { value: atlas }, uMargin: { value: MARGIN }, uFacing: { value: facing ? 1 : 0 },
      uGain: { value: 1.25 } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  mat.name = facing ? 'lyh-traffic-facing' : 'lyh-traffic-disc';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = facing ? 'traffic-facing' : 'traffic-discs';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return { mesh, g, iPos, iLook, iNormal, mat, n: 0 };
}

// Per-body look, steady for a body: tile, spin, temperature, a disc normal and a brightness.
function hash(i, k) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const IMP_NEAR = 200, IMP_FAR = 250;        // u: impostors within, points beyond, a crossfade between

/**
 * createTrafficView(stage, zoneData, traffic, atlas) → { update(t, camPos), setAtlas(texture), dispose(), object }.
 * traffic: core/traffic.js buildTraffic's tables (n, size, mix, variant). atlas: bakeAtlas's texture, or null until
 * it lands (points only). update(t, camPos): t is the zone clock (game.zoneT), camPos the camera position.
 */
export function createTrafficView(stage, zoneData, traffic, atlas = null, { scene = null } = {}) {
  const n = traffic ? (traffic.n ?? traffic.size?.length ?? 0) : 0;
  const group = new THREE.Group();
  group.name = 'traffic';
  (scene || stage.scenes.zone).add(group);
  const N = Math.max(1, n);
  const pos = new Float32Array(N * 3), fade = new Float32Array(N);
  const size = new Float32Array(N), kind = new Uint8Array(N);       // kind: 0 spiral disc, 1 elliptical, 2 dwarf
  const baseLum = new Float32Array(N), lum = new Float32Array(N);
  const temp = new Float32Array(N), tile = new Uint8Array(N);
  const spin = new Float32Array(N), normal = new Float32Array(N * 3), ratio = new Float32Array(N);
  for (let i = 0; i < n; i++) {
    size[i] = traffic.size?.[i] ?? 1.5;
    // core/traffic.js MIXES: spiral, elliptical, dwarf, big, mixed. variant picks within a mix.
    const mix = traffic.mix?.[i] ?? 0, v = traffic.variant?.[i] ?? Math.floor(hash(i, 7) * 256);
    const K = mix === 1 ? 1 : mix === 2 ? 2 : mix === 3 ? (v % 2 ? 1 : 0) : mix === 4 ? (v % 5 < 2 ? 1 : 0) : 0;
    kind[i] = K;
    tile[i] = K === 0 ? v % 3 : 3;
    spin[i] = hash(i, 2) * Math.PI * 2;
    ratio[i] = K === 1 ? 0.62 + 0.36 * hash(i, 8) : 0.85;
    const tint = zoneData?.art?.tint || {};
    temp[i] = K === 1 ? (tint.elliptical ?? 4300) + 600 * hash(i, 3) : K === 2 ? 7000 + 3000 * hash(i, 3)
      : (tint.spiral ?? 5400) + 1400 * hash(i, 3);
    baseLum[i] = (K === 2 ? 0.45 : 1) * (0.6 + 0.8 * hash(i, 4)) * size[i] * size[i];
    // Discs tilt up to 60° from the plane's up, so few are seen edge-on from the chase camera.
    const tilt = Math.acos(1 - hash(i, 5) * 0.5), az = hash(i, 6) * Math.PI * 2;
    normal[i * 3] = Math.sin(tilt) * Math.cos(az);
    normal[i * 3 + 1] = Math.sin(tilt) * Math.sin(az);
    normal[i * 3 + 2] = Math.cos(tilt);
  }

  // Every body as a sized point.
  // A slow falloff, so every galaxy of the zone still shows as a point across it ("each point here is a galaxy").
  const pointMat = createPointMaterial({ shared: stage.relNear, falloff: 0.85, emax: 1.6, cull: 0.02, exposure: 26,
    maxPx: 10, near: 4, sized: true });
  pointMat.name = 'lyh-traffic-points';
  const pts = createPoints({ positions: pos, temperature: temp, lum, size, material: pointMat });
  pts.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  pts.geometry.attributes.aLum.setUsage(THREE.DynamicDrawUsage);
  pts.geometry.setDrawRange(0, n);
  pts.name = 'traffic-points';
  pts.renderOrder = 3;
  group.add(pts);

  const cap = Math.max(16, stage.TIERS.high.impostors);
  let discs = null, facing = null;
  function setAtlas(tex) {
    if (!tex) return;
    if (discs) { discs.mat.uniforms.uMap.value = tex; facing.mat.uniforms.uMap.value = tex; return; }
    discs = impostorMesh(cap, tex, false);
    facing = impostorMesh(cap, tex, true);
    group.add(discs.mesh, facing.mesh);
  }
  if (atlas) setAtlas(atlas);

  const order = new Int32Array(Math.max(1, n)), dist = new Float32Array(Math.max(1, n));

  function update(t, camPos) {
    if (!n) return;
    fillPositions(traffic, t, pos, fade);
    const cx = camPos.x ?? camPos[0], cy = camPos.y ?? camPos[1], cz = camPos.z ?? camPos[2];
    let m = 0;
    for (let i = 0; i < n; i++) {
      const dx = pos[i * 3] - cx, dy = pos[i * 3 + 1] - cy, dz = pos[i * 3 + 2] - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dist[i] = d;
      lum[i] = baseLum[i] * fade[i];
      if (d < IMP_FAR && discs) order[m++] = i;
    }
    // The nearest within the budget get impostors.
    const budget = Math.min(cap, stage.budget.impostors);
    if (m > budget) {
      const idx = Array.from(order.subarray(0, m));
      idx.sort((a, b) => dist[a] - dist[b]);
      for (let k = 0; k < budget; k++) order[k] = idx[k];
      m = budget;
    }
    if (discs) {
      let nd = 0, nf = 0;
      const dp = discs.iPos.array, dl = discs.iLook.array, dn = discs.iNormal.array;
      const fp = facing.iPos.array, fl = facing.iLook.array;
      for (let k = 0; k < m; k++) {
        const i = order[k];
        const d = dist[i], r = size[i];
        const far = 1 - smoothstep(IMP_NEAR, IMP_FAR, d);
        const near = smoothstep(r * 0.4, r * 1.6, d);          // fade a card the camera flies through
        const f = far * near * fade[i];
        lum[i] = baseLum[i] * fade[i] * (1 - far) * (0.25 + 0.75 * near);
        if (f < 0.003) continue;
        if (tile[i] < 3) {
          dp.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], r], nd * 4);
          dl.set([tile[i], f, spin[i], temp[i]], nd * 4);
          dn.set([normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]], nd * 3);
          nd++;
        } else {
          fp.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], r], nf * 4);
          fl.set([kind[i] === 2 ? 3 : 4, f * (kind[i] === 2 ? 0.55 : 1), spin[i], temp[i]], nf * 4);
          facing.iNormal.array[nf * 3] = ratio[i];
          nf++;
        }
      }
      discs.g.instanceCount = nd;
      facing.g.instanceCount = nf;
      discs.iPos.needsUpdate = discs.iLook.needsUpdate = discs.iNormal.needsUpdate = nd > 0;
      facing.iPos.needsUpdate = facing.iLook.needsUpdate = facing.iNormal.needsUpdate = nf > 0;
      discs.mesh.visible = nd > 0;
      facing.mesh.visible = nf > 0;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.aLum.needsUpdate = true;
  }

  function dispose() {
    group.removeFromParent();
    pts.geometry.dispose();
    pointMat.dispose();
    for (const x of [discs, facing]) if (x) { x.g.dispose(); x.mat.dispose(); }
  }

  return { update, setAtlas, dispose, object: group, count: n, positions: pos };
}
