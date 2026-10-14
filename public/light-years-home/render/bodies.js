// Light Years Home v3: giant galaxies you drive round. Each is a few soft cards stacked through its body (slices of a
// 3D glow, so the light holds up as you fly in and out of the halo) plus a swarm of its own stars from
// core/gen/galaxy.js, which stream past at arm's length when you skim the core. Two draws a giant.
// Sources: Decaudin and Neyret, "Volumetric Billboards" (2009), as render/nebula.js does; the elliptical particles of
// core/gen/galaxy.js; a Plummer core with a de Vaucouleurs-like nucleus for the glow.
import * as THREE from 'three';
import { hashSeed } from '../core/rng.js';
import { createPointMaterial, createPoints } from './points.js';
import { BLACKBODY_GLSL } from './stage.js';

// Looks this module draws: temperature (K), glow gain, exponential scale and nucleus (× the drawn radius r), halo
// (× r) when the data gives none, star share and axis ratios.
export const GIANT_LOOKS = Object.freeze({
  'elliptical-warm': { T: 4300, gain: 1.2, scale: 0.3, nucleus: 2.2, nucR: 0.07, halo: 2.4, stars: 1,
    axes: [1, 0.86, 0.8] },
  elliptical: { T: 4800, gain: 1.0, scale: 0.28, nucleus: 1.8, nucR: 0.08, halo: 2.0, stars: 0.6,
    axes: [1, 0.8, 0.75] },
  'giant-warm': { T: 4200, gain: 1.25, scale: 0.32, nucleus: 2.4, nucR: 0.06, halo: 3.0, stars: 1,
    axes: [1, 0.9, 0.85] },
  udg: { T: 6200, gain: 0.3, scale: 0.6, nucleus: 0, nucR: 0.1, halo: 1.6, stars: 0.35, axes: [1, 0.85, 0.7] },
  spiral: { T: 5600, gain: 0.9, scale: 0.3, nucleus: 1.5, nucR: 0.07, halo: 1.8, stars: 0.6, axes: [1, 1, 0.25] },
});

const SLICES = 3;

const CARD_VS = /* glsl */ `
  uniform vec3 uCentre;
  uniform float uHalo, uNear, uR;
  attribute vec3 aCard;        // corner x, y and the slice's depth (−1..1 of the halo)
  varying vec3 vRel;
  varying float vViewZ, vInside, vW;
  void main() {
    vec3 toC = uCentre - cameraPosition;
    float dist = length(toC);
    vec3 f = dist > 1e-4 ? toC / dist : vec3(0.0, 1.0, 0.0);
    vec3 r = normalize(cross(f, abs(f.z) < 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
    vec3 u = cross(r, f);
    // Slices sit at depths through the halo, but never behind the camera's near distance.
    float depth = aCard.z * uHalo * 0.55;
    depth = max(depth, uNear - dist);
    float hs = sqrt(max(uHalo * uHalo - depth * depth, 0.04 * uHalo * uHalo));
    vec3 p = uCentre + f * depth + (r * aCard.x + u * aCard.y) * hs;
    vRel = p - uCentre;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vViewZ = -mv.z;
    // Close in, the glow thins, so you see the stars stream past you, not a fog.
    vInside = 0.08 + 0.92 * smoothstep(0.5 * uR, 2.4 * uR, dist);
    vW = aCard.z == 0.0 ? 0.7 : 0.15;
    gl_Position = projectionMatrix * mv;
  }`;
const CARD_FS = /* glsl */ `
  ${BLACKBODY_GLSL}
  uniform vec3 uAxisA, uAxisB, uAxisC, uAxes;
  uniform float uHalo, uR, uScale, uNucleus, uNucR, uGain, uTemp, uFade;
  varying vec3 vRel;
  varying float vViewZ, vInside, vW;
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)),
      hash13(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
      mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  void main() {
    // The point in the body's own axes, squashed by its axis ratios.
    vec3 q = vec3(dot(vRel, uAxisA) / uAxes.x, dot(vRel, uAxisB) / uAxes.y, dot(vRel, uAxisC) / uAxes.z);
    float rq = length(q);
    if (rq > uHalo) discard;
    float x = rq / uR;
    float body = 1.2 * exp(-x / uScale) + uNucleus * exp(-(x / uNucR) * (x / uNucR));
    float edge = 1.0 - smoothstep(0.55 * uHalo, uHalo, rq);
    float grain = 0.92 + 0.16 * vnoise(q * (5.0 / uR));
    float I = body * edge * grain * uGain * vW * vInside * smoothstep(0.4, 3.0, vViewZ);
    vec3 c = lyhBB(mix(uTemp, uTemp * 1.3, exp(-x * x * 40.0)));
    gl_FragColor = vec4((1.0 - exp(-I * c * 1.5)) * uFade, 1.0);
    #include <colorspace_fragment>
  }`;

function cardGeometry() {
  const pos = [], card = [], index = [];
  for (let i = 0; i < SLICES; i++) {
    const z = SLICES === 1 ? 0 : -1 + (2 * i) / (SLICES - 1);
    const b = i * 4;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(0, 0, 0); card.push(x, y, z); }
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 3));
  g.setIndex(index);
  return g;
}

// A steady orientation for a body: three axes from its id.
function axesOf(id) {
  const h = hashSeed('giant-axes', id);
  const a1 = (h % 1000) / 1000 * Math.PI * 2, a2 = ((h >>> 10) % 1000) / 1000 * 0.6 - 0.3;
  const A = new THREE.Vector3(Math.cos(a1), Math.sin(a1), a2).normalize();
  const C = new THREE.Vector3(0, 0, 1).sub(A.clone().multiplyScalar(A.z)).normalize();
  const B = new THREE.Vector3().crossVectors(C, A);
  return [A, B, C];
}

/**
 * createGiant(stage, body, stars) → Object3D (two draws). body: zone data { id, pos, r, halo?, look }. stars: the
 * swarm from core/gen/galaxy.js (positions in u round the centre), or null; userData.setStars(data) adds it later
 * (the worker makes it). userData.dispose() frees it; userData.giantStars is the star count the tier asks for.
 */
export function createGiant(stage, body, stars = null) {
  const L = GIANT_LOOKS[body.look] || GIANT_LOOKS.elliptical;
  const group = new THREE.Group();
  group.name = `giant:${body.id}`;
  const centre = new THREE.Vector3(body.pos[0], body.pos[1], body.pos[2] || 0);
  const halo = body.halo ? Math.max(body.r * 1.5, Math.min(body.halo, body.r * 4.5)) : body.r * L.halo;
  const [A, B, C] = axesOf(body.id);
  const mat = new THREE.ShaderMaterial({
    vertexShader: CARD_VS, fragmentShader: CARD_FS,
    uniforms: {
      uLUT: { value: stage.lut }, uCentre: { value: centre }, uHalo: { value: halo }, uNear: { value: 0.8 },
      uAxisA: { value: A }, uAxisB: { value: B }, uAxisC: { value: C }, uAxes: { value: new THREE.Vector3(...L.axes) },
      uR: { value: body.r }, uScale: { value: L.scale }, uNucleus: { value: L.nucleus }, uNucR: { value: L.nucR },
      uGain: { value: L.gain }, uTemp: { value: L.T }, uFade: { value: 1 },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, side: THREE.DoubleSide,
  });
  mat.name = 'lyh-giant';
  const cards = new THREE.Mesh(cardGeometry(), mat);
  cards.name = 'glow';
  cards.frustumCulled = false;
  cards.renderOrder = 1;
  group.add(cards);

  let swarm = null, swarmMat = null;
  const want = Math.round(Math.min(stage.budget.giantStars, (body.stars || stage.budget.giantStars) * L.stars
    * stage.budget.giantStars / 4000) * Math.min(1, (body.r / 9) ** 0.7 + 0.15));
  function setStars(data) {
    if (!data || swarm) return;
    const n = data.count;
    const lum = new Float32Array(n), temp = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = centre.x + data.positions[i * 3] * L.axes[0];
      pos[i * 3 + 1] = centre.y + data.positions[i * 3 + 1] * L.axes[1];
      pos[i * 3 + 2] = centre.z + data.positions[i * 3 + 2] * L.axes[2];
      lum[i] = data.flux[i];
      temp[i] = Math.min(data.temperature[i], 9000);
    }
    swarmMat = createPointMaterial({ shared: stage.relNear, falloff: 2, emax: 3.5, cull: 0.02, exposure: 9,
      maxPx: 7, near: 2.2 });
    swarmMat.name = 'lyh-giant-stars';
    swarm = createPoints({ positions: pos, temperature: temp, lum, material: swarmMat });
    swarm.name = 'stars';
    swarm.renderOrder = 2;
    group.add(swarm);
  }
  if (stars) setStars(stars);
  group.userData = {
    kind: 'giant', id: body.id, halo, giantStars: want,
    // Particle options for the worker: an elliptical swarm a little bigger than the drawn radius.
    starOpts: { seed: `giant:${body.id}`, type: 'elliptical', radius: body.r * 1.7, count: want, axes: [1, 1, 1] },
    setStars,
    setFade(f) {
      mat.uniforms.uFade.value = f;
      if (swarmMat) swarmMat.uniforms.uFade.value = f;
      group.visible = f > 0.002;
    },
    dispose() {
      cards.geometry.dispose(); mat.dispose();
      if (swarm) { swarm.geometry.dispose(); swarmMat.dispose(); }
    },
  };
  return group;
}
