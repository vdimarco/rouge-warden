// Light Years Home v3: filament roads as rivers of white points. Thousands of faint galaxies fill each road's tube,
// thickest along its spine, and drift with the flow: each point slides a few u along the road and fades out as the
// next fades in, so the river moves without the CPU touching it. Orbits (ring roads round a node) are rings of the
// same points. One draw for every road of a zone. The curve is the one the traffic rides (core/traffic.js tables).
// Sources: the video's look (fields of white points); none fit better than plain sprites with a moving phase.
import * as THREE from 'three';
import { hashSeed, mulberry32 } from '../core/rng.js';
import { BLACKBODY_GLSL } from './stage.js';
import { roadCurve, tubeAt } from './traffic.js';

const RIVER_VS = /* glsl */ `
  uniform float uTime, uRatio, uPxPerRad, uExposure, uLoop, uMaxPx;
  attribute vec3 aFlow;        // u/s along the road
  attribute vec3 aInfo;        // luminosity, temperature, phase
  varying vec3 vC;
  varying float vE, vCore, vHalo, vSize;
  ${BLACKBODY_GLSL}
  void main() {
    float s = length(aFlow);
    float ph = fract(uTime * s / uLoop + aInfo.z);
    vec3 p = position + (s > 0.0 ? aFlow / s : vec3(0.0)) * (ph - 0.5) * uLoop;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float r = length(mv.xyz);
    float life = sin(3.14159 * ph);
    float E = aInfo.x * uExposure * pow(max(r, 3.0), -1.45) * (0.35 + 0.65 * life) * smoothstep(1.0, 4.0, r);
    vE = E;
    vC = lyhBB(aInfo.y);
    float core = 0.62 * uRatio, halo = (0.7 + 0.5 * log2(1.0 + E)) * uRatio;
    float size = min(6.0 * halo + 2.0, uMaxPx * uRatio);
    vSize = size;
    vCore = core;
    vHalo = min(halo, (size - 2.0) / 6.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
    if (E < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  }`;
const RIVER_FS = /* glsl */ `
  uniform float uRatio;
  varying vec3 vC;
  varying float vE, vCore, vHalo, vSize;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * vSize;
    float d2 = dot(p, p);
    float c = exp(-0.5 * d2 / (vCore * vCore)) / (6.2832 * vCore * vCore);
    float h = exp(-0.5 * d2 / (vHalo * vHalo)) / (6.2832 * vHalo * vHalo);
    float e = vE * (0.9 * c + 0.1 * h) * uRatio * uRatio;
    gl_FragColor = vec4(1.0 - exp(-e * vC), 1.0);
    #include <colorspace_fragment>
  }`;

const LOOP = 9;               // u a point slides before it fades

// Gaussian deviates from a uniform source.
function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r() * 0.999999)) * Math.cos(2 * Math.PI * r()); }

/**
 * createRoads(stage, zoneData, built) → Object3D (one Points draw). built: core's builtOf(game) or
 * { traffic } (its road tables give the curve). The object's userData.update(t) moves the flow (zone clock, s);
 * userData.setBudget(points) draws a prefix.
 */
export function createRoads(stage, zoneData, built = null, { seed = 1, share = 0.24 } = {}) {
  const roads = (zoneData.roads || []).filter((r) => r && (r.kind === 'road' || r.kind === 'orbit'));
  const traffic = built?.traffic || null;
  // How many points each road gets: by its tube area along its length.
  const weights = roads.map((r) => {
    if (r.kind === 'orbit') {
      const [a, b] = Array.isArray(r.r) ? r.r : [r.r * 0.8, r.r * 1.2];
      return Math.PI * (a + b) * (b - a) * 0.6;
    }
    const c = roadCurve(r, traffic);
    let area = 0;
    for (let k = 0; k < 20; k++) area += tubeAt(r, (k + 0.5) / 20);
    return c.length * (area / 20) * 1.4;
  });
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const total = Math.round((stage.TIERS[stage.tier] || stage.TIERS.mid).points * share);
  const pos = new Float32Array(total * 3), flow = new Float32Array(total * 3), info = new Float32Array(total * 3);
  // Interleave the roads so any prefix is a fair sample of every road (a lower budget draws a prefix).
  const counts = weights.map((w) => Math.round(total * w / wSum));
  const taken = counts.map(() => 0);
  const rnds = roads.map((r) => mulberry32(hashSeed('river', zoneData.id, r.id || 'road', seed)));
  const curves = roads.map((r) => (r.kind === 'road' ? roadCurve(r, traffic) : null));
  const p = [0, 0, 0], t = [0, 0, 0];
  let k = 0;
  while (k < total) {
    let best = -1, bestF = Infinity;
    for (let j = 0; j < roads.length; j++) {
      if (taken[j] >= counts[j]) continue;
      const f = (taken[j] + 0.5) / counts[j];
      if (f < bestF) { bestF = f; best = j; }
    }
    if (best < 0) break;
    taken[best]++;
    const r = roads[best], rnd = rnds[best];
    const speed = Array.isArray(r.speed) ? (r.speed[0] + r.speed[1]) / 2 : r.speed ?? 6;
    if (r.kind === 'orbit') {
      const [a, b] = Array.isArray(r.r) ? r.r : [r.r * 0.8, r.r * 1.2];
      const rad = a + (b - a) * Math.sqrt(rnd()), ang = rnd() * Math.PI * 2;
      const c = r.centre || [0, 0];
      pos[k * 3] = c[0] + rad * Math.cos(ang);
      pos[k * 3 + 1] = c[1] + rad * Math.sin(ang);
      pos[k * 3 + 2] = gauss(rnd) * 0.35 * (r.height ?? 6);
      const dir = r.dir === -1 ? -1 : 1;
      flow[k * 3] = -Math.sin(ang) * dir * speed;
      flow[k * 3 + 1] = Math.cos(ang) * dir * speed;
      flow[k * 3 + 2] = 0;
    } else {
      const s = rnd();
      const curve = curves[best];
      curve.at(s, p);
      curve.tangent(s, t);
      const tube = tubeAt(r, s);
      // Across the tube: a Gaussian in the plane, flatter in height (the wall is a sheet).
      const h = Math.hypot(t[0], t[1]) || 1;
      const rx = t[1] / h, ry = -t[0] / h;
      const lat = gauss(rnd) * 0.42 * tube, up = gauss(rnd) * 0.2 * tube;
      pos[k * 3] = p[0] + rx * lat;
      pos[k * 3 + 1] = p[1] + ry * lat;
      pos[k * 3 + 2] = p[2] + up;
      const f = (r.flow === -1 ? -1 : 1) * speed * (0.8 + 0.4 * rnd());
      flow[k * 3] = t[0] * f; flow[k * 3 + 1] = t[1] * f; flow[k * 3 + 2] = t[2] * f;
    }
    // Most river points are faint; a few are brighter galaxies.
    const bright = 0.5 + 2.5 * rnd() ** 4;
    info[k * 3] = bright;
    info[k * 3 + 1] = r.mix === 'elliptical' ? 4600 + 900 * rnd() : 5400 + 2600 * rnd();
    info[k * 3 + 2] = rnd();
    k++;
  }
  const n = k;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.BufferAttribute(flow, 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: RIVER_VS, fragmentShader: RIVER_FS,
    uniforms: {
      uLUT: { value: stage.lut }, uTime: { value: 0 }, uRatio: { value: stage.ratio }, uPxPerRad: { value: 500 },
      uExposure: { value: 30 }, uLoop: { value: LOOP }, uMaxPx: { value: 5 },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  mat.name = 'lyh-river';
  const pts = new THREE.Points(g, mat);
  pts.name = 'roads';
  pts.frustumCulled = false;
  pts.renderOrder = 2;
  const setBudget = (points) => {
    // Rivers take a share of the frame's points; the step-down draws a prefix.
    g.setDrawRange(0, Math.min(n, Math.round(points * share)));
  };
  setBudget(stage.budget.points);
  pts.userData = {
    count: n,
    setBudget,
    update(time) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uRatio.value = stage.ratio;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
  return pts;
}
