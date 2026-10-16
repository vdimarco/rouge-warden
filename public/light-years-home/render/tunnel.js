// Light Years Home v3: the jump view (final.md 11, decisions.md 2). The corridor is its own scene (x across, y ahead,
// z up): the ship flies along y at the core's corridor speed, so the speed dust, the wingtip trails and the sparks
// stream past as they do in a zone. Around it a tube of light: a glowing wall of streaming lanes, crisp streaks and
// ribs, all coloured by the real Doppler factor seen from the ship (blue ahead, white beside you, reddening behind).
// Hazards are what the jump's data says they are: galaxy groups drawn with the zones' own galaxy impostors, sheets
// of galaxies with a gap, cluster rings, filament rails and light pads. One screen quad draws the punch's flash and
// rush, the hit pulse, the shade ahead and the red rim from 0.99c. The far sky is the backdrop at the jump's rapidity:
// render/points.js swings the stars forward into the aberration ring and recolours them (Penrose 1959, Kraus 2000).
// The camera frames the ship as the chase camera does, so the ship keeps its place from the zone into the jump and out.
// Sources: lab A on main, after Tempest (1981), for the tube; lab B's rush lines; Eiserloh, GDC 2016, for the shake;
// render/traffic.js's impostor atlas (render/galaxy.js bakeImpostor) for the galaxies; Quilez's distance functions
// for the rings (render/gates.js). None fit better for the tube's lanes than a procedural cylinder.
import * as THREE from 'three';
import { TUNE } from '../core/tune.js';
import { HAZ, RES, NINE2, NINE3, railAt, gateKnots, gateKnotAt } from '../core/jump.js';
import { zoneById } from '../core/game.js';
import { BLACKBODY_GLSL } from './stage.js';
import { createHeadlight } from './points.js';
import { createGates } from './gates.js';
import { createTern } from './tern.js';
import { createFx } from './fx.js';
import { bakeAtlas } from './traffic.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, tc) => (tc > 0 ? 1 - Math.exp(-dt / tc) : 1);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const LOOP = 360;            // u of tube pattern before it repeats
const LANES = 40, DASHES = 4, RIBS = 10, RIB_SEG = 48;
const FAR = 330;             // u ahead the tube fades into the light
const PTS_CAP = 4096, IMP_CAP = 512;
const MARGIN = 1.12;         // the atlas's tile margin (render/traffic.js)

// Doppler factor of light from a direction at angle θ to the motion (c = cos θ), at rapidity φ (lab A's dopplerAt).
const DOPPLER_GLSL = /* glsl */ `
  float lyhDoppler(float c, float phi) {
    float t2 = (1.0 - c) / max(1e-4, 1.0 + c);
    return (exp(phi) + t2 * exp(-phi)) / (1.0 + t2);
  }
`;

// ---------------------------------------------------------------- the tube's wall: glowing lanes, one cylinder

const WALL_VS = /* glsl */ `
  varying vec3 vP;
  varying float vA;
  void main() {
    vP = position;
    vA = atan(position.z, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const WALL_FS = /* glsl */ `
  ${BLACKBODY_GLSL}
  ${DOPPLER_GLSL}
  uniform float uS, uPhi, uGain, uFar, uLanes, uWall;
  uniform vec3 uOrigin;
  varying vec3 vP;
  varying float vA;
  float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
  void main() {
    float a = (vA / 6.28318 + 0.5) * uLanes;
    float lane = floor(a);
    float f = fract(a);
    float w = fwidth(a);
    // A thin lane line, antialiased; once a lane is under a few pixels wide it fades rather than turning grey.
    float line = (1.0 - smoothstep(0.0, max(0.05, w * 1.1), abs(f - 0.5) - 0.015))
      * clamp(0.1 / max(w, 1e-4), 0.0, 1.0);
    float sp = 0.7 + 0.6 * h1(lane);
    float len = 14.0 + 30.0 * h1(lane + 3.3);
    float ph = fract((vP.y + uS * sp + h1(lane + 7.1) * 400.0) / len);
    float dash = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.18, 0.5, ph));
    // Only some lanes carry light, and a lane fades with distance so the far end stays a clean point of light.
    float on = step(0.62, h1(lane + 1.7));
    float weight = on * (0.5 + 0.5 * h1(lane + 9.1));
    vec3 d = vP - uOrigin;
    float D = lyhDoppler(d.y / max(1e-3, length(d)), uPhi);
    vec3 col = lyhBB(6500.0 * D);
    float fade = smoothstep(150.0, 20.0, vP.y) * smoothstep(-28.0, -6.0, vP.y);
    // The lit lanes, and the dashes streaming along them.
    float I = (0.12 * line * weight + 1.5 * line * dash * weight) * fade * uGain
      * clamp(0.3 + 0.7 * D, 0.2, 2.0);
    I *= 1.0 + uWall * 1.5 * smoothstep(8.0, 0.0, abs(d.y));
    gl_FragColor = vec4(1.0 - exp(-col * I), 1.0);
    #include <colorspace_fragment>
  }`;

function createWall(stage, R) {
  const geo = new THREE.CylinderGeometry(R, R, LOOP, 96, 1, true);
  geo.translate(0, LOOP / 2 - 30, 0);          // the cylinder's axis is y: from 30 u behind to the far end
  const mat = new THREE.ShaderMaterial({
    vertexShader: WALL_VS, fragmentShader: WALL_FS,
    uniforms: { uLUT: { value: stage.lut }, uS: { value: 0 }, uPhi: { value: 1 }, uGain: { value: 1 },
      uFar: { value: FAR }, uLanes: { value: 96 }, uWall: { value: 0 }, uOrigin: { value: new THREE.Vector3() } },
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  mat.name = 'lyh-tube-wall';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'tube-wall';
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return { object: mesh, material: mat };
}

// ---------------------------------------------------------------- crisp streaks and ribs, one draw

const TUBE_VS = /* glsl */ `
  ${BLACKBODY_GLSL}
  ${DOPPLER_GLSL}
  attribute float aA, aY, aP, aK, aW;
  uniform float uS, uLen, uR, uPhi, uAlpha, uRibAlpha, uFar;
  uniform vec3 uOrigin;
  varying vec3 vC;
  varying float vA;
  void main() {
    float y = mod(aP - uS, ${LOOP.toFixed(1)}) - 30.0;
    float streak = 1.0 - aK;
    y += aY * uLen * streak;
    vec3 p = vec3(cos(aA) * uR, y, sin(aA) * uR);
    vec3 d = p - uOrigin;
    float D = lyhDoppler(d.y / max(1e-3, length(d)), uPhi);
    vC = lyhBB(6500.0 * D) * min(2.2, 0.35 + 0.65 * D);
    // Far streaks fade early: the middle of the view, where hazards come from, stays dark enough to read them.
    float fade = smoothstep(uFar * 0.75, uFar * 0.3, y) * smoothstep(-30.0, -8.0, y);
    vA = fade * aW * mix(uAlpha * mix(1.0, 0.1, aY), uRibAlpha, aK);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const TUBE_FS = /* glsl */ `
  varying vec3 vC;
  varying float vA;
  void main() {
    gl_FragColor = vec4(1.0 - exp(-vC * vA * 1.6), 1.0);
    #include <colorspace_fragment>
  }`;

function createTube(stage) {
  const n = LANES * DASHES * 2 + RIBS * RIB_SEG * 2;
  const aA = new Float32Array(n), aY = new Float32Array(n), aP = new Float32Array(n), aK = new Float32Array(n),
    aW = new Float32Array(n);
  let v = 0;
  for (let l = 0; l < LANES; l++) {
    const a = hash(l * 1.37) * 2 * Math.PI;
    for (let d = 0; d < DASHES; d++) {
      const p = (d / DASHES) * LOOP + hash(l * 7 + d) * (LOOP / DASHES) * 0.8;
      const w = 0.4 + 0.6 * hash(l * 13 + d * 3) ** 2;
      for (let e = 0; e < 2; e++) { aA[v] = a; aY[v] = e; aP[v] = p; aK[v] = 0; aW[v] = w; v++; }
    }
  }
  for (let r = 0; r < RIBS; r++) {
    const p = (r / RIBS) * LOOP;
    for (let s = 0; s < RIB_SEG; s++) {
      for (let e = 0; e < 2; e++) {
        aA[v] = ((s + e) / RIB_SEG) * 2 * Math.PI; aY[v] = 0; aP[v] = p; aK[v] = 1; aW[v] = 1; v++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (const [k, a] of Object.entries({ aA, aY, aP, aK, aW })) g.setAttribute(k, new THREE.BufferAttribute(a, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: TUBE_VS, fragmentShader: TUBE_FS,
    uniforms: {
      uLUT: { value: stage.lut }, uS: { value: 0 }, uLen: { value: 4 }, uR: { value: 10 }, uPhi: { value: 1 },
      uAlpha: { value: 0.7 }, uRibAlpha: { value: 0.18 }, uFar: { value: FAR },
      uOrigin: { value: new THREE.Vector3() },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  mat.name = 'lyh-tube';
  const lines = new THREE.LineSegments(g, mat);
  lines.name = 'tube';
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  return { object: lines, material: mat };
}

// ---------------------------------------------------------------- galaxies: impostors from the zones' atlas

const IMP_VS = /* glsl */ `
  ${BLACKBODY_GLSL}
  ${DOPPLER_GLSL}
  attribute vec2 aCorner;
  attribute vec4 iPos;        // xyz, radius (u)
  attribute vec4 iLook;       // tile (4: a smooth elliptical), spin, temperature, flash (−1 red .. 1 white)
  uniform float uPhi, uFar;
  uniform vec3 uOrigin;
  varying vec2 vUv, vC;
  varying vec3 vTint;
  varying float vTile, vFade, vFlash;
  void main() {
    float cs = cos(iLook.y), sn = sin(iLook.y);
    vec2 c = vec2(cs * aCorner.x - sn * aCorner.y, sn * aCorner.x + cs * aCorner.y);
    vTile = iLook.x;
    vUv = (aCorner * 0.5 + 0.5) * 0.5 + vec2(mod(vTile, 2.0), floor(vTile / 2.0)) * 0.5;
    vC = aCorner * ${MARGIN.toFixed(2)};
    vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
    mv.xy += c * iPos.w * ${MARGIN.toFixed(2)};
    gl_Position = projectionMatrix * mv;
    vec3 d = iPos.xyz - uOrigin;
    float D = lyhDoppler(d.y / max(1e-3, length(d)), uPhi);
    vTint = lyhBB(iLook.z * D) * clamp(0.55 + 0.4 * D, 0.4, 1.35);
    vFade = smoothstep(uFar, uFar * 0.7, iPos.y);
    vFlash = iLook.w;
    if (iPos.w <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const IMP_FS = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGain;
  varying vec2 vUv, vC;
  varying vec3 vTint;
  varying float vTile, vFade, vFlash;
  void main() {
    vec3 rgb; float a;
    float x = length(vC);
    if (vTile > 3.5) {
      // An elliptical: a bright nucleus in a smooth glow.
      if (x > 1.12) discard;
      float I = 0.9 * exp(-x / 0.2) + 1.4 * exp(-(x / 0.06) * (x / 0.06));
      I *= 1.0 - smoothstep(0.75, 1.12, x);
      rgb = (1.0 - exp(-I * vec3(1.0, 0.86, 0.7) * 1.5));
      a = 0.0;
    } else {
      vec4 t = texture2D(uMap, vUv);
      rgb = t.rgb * t.rgb * 1.6;
      a = t.a * 0.6;
    }
    // A glow round every galaxy so it reads at speed against the tube.
    float glow = exp(-x * x * 6.0);
    rgb += vec3(0.12) * glow;
    float mask = clamp(max(rgb.r, max(rgb.g, rgb.b)) * 1.5, 0.0, 1.0);
    vec3 c = rgb * vTint;
    // A graze or a thread flashes it white-hot; a hit flashes it red.
    c += vec3(0.9, 0.95, 1.0) * mask * clamp(vFlash, 0.0, 1.0) * 0.6;
    c = mix(c, vec3(1.0, 0.15, 0.06) * mask * 1.4, clamp(-vFlash, 0.0, 1.0) * 0.85);
    gl_FragColor = vec4(c * uGain * vFade, a * vFade);
    #include <colorspace_fragment>
  }`;

function createImpostors(stage) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(IMP_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iLook = new THREE.InstancedBufferAttribute(new Float32Array(IMP_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', iPos);
  g.setAttribute('iLook', iLook);
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: IMP_VS, fragmentShader: IMP_FS,
    uniforms: { uLUT: { value: stage.lut }, uMap: { value: null }, uGain: { value: 1.3 }, uPhi: { value: 1 },
      uFar: { value: FAR }, uOrigin: { value: new THREE.Vector3() } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  mat.name = 'lyh-tunnel-galaxies';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'galaxies';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  let n = 0, ready = false;
  bakeAtlas(stage).then((tex) => { mat.uniforms.uMap.value = tex; ready = true; })
    .catch((err) => console.warn('tunnel: atlas', err));
  return {
    object: mesh, material: mat,
    get ready() { return ready; },
    begin() { n = 0; },
    // tile: 0..3 from the atlas, 4 an elliptical; spin in rad; T the galaxy's colour temperature.
    put(x, y, z, r, tile, spin, T, flash = 0) {
      if (n >= IMP_CAP) return;
      iPos.array[n * 4] = x; iPos.array[n * 4 + 1] = y; iPos.array[n * 4 + 2] = z; iPos.array[n * 4 + 3] = r;
      iLook.array[n * 4] = ready ? tile : 4; iLook.array[n * 4 + 1] = spin; iLook.array[n * 4 + 2] = T;
      iLook.array[n * 4 + 3] = flash;
      n++;
    },
    end() {
      g.instanceCount = n;
      iPos.needsUpdate = true; iLook.needsUpdate = true;
      mesh.visible = n > 0;
    },
    get count() { return n; },
  };
}

// ---------------------------------------------------------------- small galaxies as glowing points, one draw

const HAZ_VS = /* glsl */ `
  ${BLACKBODY_GLSL}
  ${DOPPLER_GLSL}
  attribute float aSize, aTemp, aLum, aFlash;
  uniform float uPhi, uPx, uRatio, uMaxPx, uFar;
  uniform vec3 uOrigin;
  varying vec3 vC;
  varying float vE, vF;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(0.5, -mv.z);
    vec3 d = position - uOrigin;
    float D = lyhDoppler(d.y / max(1e-3, length(d)), uPhi);
    vec3 col = lyhBB(aTemp * D);
    col = mix(col, vec3(1.0), clamp(aFlash, 0.0, 1.0) * 0.8);
    col = mix(col, vec3(1.0, 0.18, 0.08), clamp(-aFlash, 0.0, 1.0));
    vC = col;
    // Fade in far off; fade out once passed, so a sheet you fly through does not snow over the camera.
    float fade = smoothstep(uFar, uFar * 0.7, position.y) * smoothstep(-5.0, 1.5, position.y);
    vE = aLum * fade * clamp(0.4 + 0.6 * D, 0.25, 2.2) * (1.0 + 1.5 * abs(aFlash));
    float px = aSize * uPx / dist;
    vF = clamp(px / 4.0, 0.0, 1.0);
    gl_PointSize = clamp(px * 2.6 + 2.0, 2.0, uMaxPx) * uRatio;
    gl_Position = projectionMatrix * mv;
  }`;
const HAZ_FS = /* glsl */ `
  varying vec3 vC;
  varying float vE, vF;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p) * 4.0;
    if (r2 > 1.0) discard;
    float core = exp(-r2 * mix(30.0, 9.0, vF));
    float halo = exp(-r2 * 4.0) * (1.0 - r2);
    float I = vE * (core * 1.4 + halo * 0.3);
    gl_FragColor = vec4(1.0 - exp(-vC * I), 1.0);
    #include <colorspace_fragment>
  }`;

function createHazPoints(stage) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(PTS_CAP * 3), size = new Float32Array(PTS_CAP), temp = new Float32Array(PTS_CAP),
    lum = new Float32Array(PTS_CAP), flash = new Float32Array(PTS_CAP);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aTemp', new THREE.BufferAttribute(temp, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aLum', new THREE.BufferAttribute(lum, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    vertexShader: HAZ_VS, fragmentShader: HAZ_FS,
    uniforms: { uLUT: { value: stage.lut }, uPhi: { value: 1 }, uPx: { value: 500 }, uRatio: { value: 1 },
      uMaxPx: { value: 160 }, uFar: { value: FAR }, uOrigin: { value: new THREE.Vector3() } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  mat.name = 'lyh-tunnel-points';
  const pts = new THREE.Points(g, mat);
  pts.name = 'hazard-points';
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  let n = 0;
  return {
    object: pts, material: mat,
    begin() { n = 0; },
    put(x, y, z, s, T, L, f = 0) {
      if (n >= PTS_CAP) return;
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      size[n] = s; temp[n] = T; lum[n] = L; flash[n] = f;
      n++;
    },
    end() {
      g.setDrawRange(0, n);
      for (const k of ['position', 'aSize', 'aTemp', 'aLum', 'aFlash']) g.attributes[k].needsUpdate = true;
      pts.visible = n > 0;
    },
    get count() { return n; },
  };
}

// ---------------------------------------------------------------- the screen quad: flash, rush, shade, rim, hit

const SCREEN_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const SCREEN_FS = /* glsl */ `
  uniform vec2 uCentre, uAspect;
  uniform float uFlash, uRush, uRim, uHit, uTime, uWhite;
  varying vec2 vUv;
  float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
  void main() {
    vec2 q = (vUv - uCentre) * uAspect;
    float r = length(q);
    float a = atan(q.y, q.x);
    vec3 col = vec3(0.0);
    // The rush: thin blue-white lines flying in to the point you head for (lab B).
    if (uRush > 0.001) {
      float u = (a + 3.14159) / 6.28318 * 140.0;
      float k = floor(u);
      float on = step(0.55, h1(k));
      float sp = 0.6 + h1(k + 3.1) * 1.2;
      float ph = fract(h1(k + 7.7) - uTime * sp * 0.9 + r * 0.6);
      float band = smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.15, 0.45, ph));
      float thin = 1.0 - smoothstep(0.08, 0.32, abs(fract(u) - 0.5));
      col += vec3(0.75, 0.86, 1.0) * on * band * thin * smoothstep(0.06, 0.3, r) * (0.4 + 0.6 * h1(k + 1.3)) * uRush;
    }
    // The red rim once past 0.99c: what is behind you, reddened.
    col += vec3(0.55, 0.04, 0.0) * uRim * smoothstep(0.85, 1.45, r);
    // A hit: a red pulse from the edges.
    col += vec3(0.8, 0.05, 0.02) * uHit * smoothstep(0.3, 1.2, r);
    // The punch, the nines and the drop-out: white.
    col = mix(col, vec3(1.0), uFlash);
    col += vec3(1.0) * uWhite * (1.0 - 0.6 * smoothstep(0.0, 1.2, r));
    gl_FragColor = vec4(col, 0.0);
    #include <colorspace_fragment>
  }`;

// The shade sits under the corridor (after the sky, before the hazards): it dims the glare ahead, not the hazards.
const SHADE_FS = /* glsl */ `
  uniform vec2 uCentre, uAspect;
  uniform float uShade, uShadeR;
  varying vec2 vUv;
  void main() {
    float r = length((vUv - uCentre) * uAspect);
    gl_FragColor = vec4(0.0, 0.0, 0.0, uShade * (1.0 - smoothstep(uShadeR * 0.4, uShadeR, r)));
  }`;

function createShade() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SCREEN_VS, fragmentShader: SHADE_FS,
    uniforms: { uCentre: { value: new THREE.Vector2() }, uAspect: { value: new THREE.Vector2(1, 1) },
      uShade: { value: 0 }, uShadeR: { value: 0.3 } },
    blending: THREE.NormalBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  mat.name = 'lyh-tunnel-shade';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'shade';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { object: mesh, material: mat };
}

function createScreen() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS,
    uniforms: {
      uCentre: { value: new THREE.Vector2() }, uAspect: { value: new THREE.Vector2(1, 1) }, uFlash: { value: 0 },
      uRush: { value: 0 }, uRim: { value: 0 }, uHit: { value: 0 },
      uTime: { value: 0 }, uWhite: { value: 0 },
    },
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false, depthTest: false, transparent: true,
  });
  mat.name = 'lyh-tunnel-screen';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'screen';
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return { object: mesh, material: mat };
}

// ---------------------------------------------------------------- labels in the video's style

const FONT = '700 26px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
function createLabel(text, { colour = '#ffffff', left = false } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = FONT;
  const tw = Math.ceil(ctx.measureText(text).width);
  const lead = 28;
  c.width = tw + lead + 16; c.height = 64;
  ctx.font = FONT;
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 2;
  // A diagonal leader from the anchor (a bottom corner) up to a rule under the text; left: the text sits to its left.
  const W = c.width;
  ctx.beginPath();
  if (left) { ctx.moveTo(W - 2, 62); ctx.lineTo(W - lead, 36); ctx.lineTo(4, 36); }
  else { ctx.moveTo(2, 62); ctx.lineTo(lead, 36); ctx.lineTo(W - 4, 36); }
  ctx.stroke();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, left ? 6 : lead + 4, 30);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false,
    sizeAttenuation: false });
  const sp = new THREE.Sprite(mat);
  sp.center.set(left ? 1 : 0, 0);
  sp.renderOrder = 15;
  sp.userData = { w: c.width / 2, h: c.height / 2, text };
  return sp;
}

// ---------------------------------------------------------------- the run-up's rings, for zoneview.setRings

/** runupRings(jump) → gates.js items for the launch rings: the next one orange, the later ones white, the last one
 * passed dim. */
export function runupRings(jump, tune = TUNE) {
  const R = jump?.runup;
  if (!R || R.wait || !R.placed) return [];
  const out = [];
  for (let k = 0; k < 3; k++) {
    if (k < R.done - 1) continue;
    out.push({ id: `runup:${k}`, pos: R.rings[k], normal: R.normals[k], r: tune.JUMP.RING_R,
      state: k < R.done ? 'dim' : k === R.done ? 'orange' : 'white' });
  }
  return out;
}

// ---------------------------------------------------------------- the view

/**
 * createTunnel(stage, { backdrop, tune, kind, reduced, tier }) → { scene, camera, pass, update(view), setKind(kind),
 * setReduced(v), dispose(), state }. view = { game, dt (real s), alpha (between core steps), events (this frame's
 * core events), zoneCam (stage.cameras.zone after chase.update: the punch swings the sky from it, the drop-out
 * draws through it) }. update drives the backdrop at the jump's rapidity and returns { passes } for stage.draw:
 * [backdrop, corridor] in the punch and the run, [backdrop, zone, corridor] in the drop-out (the corridor fading).
 */
export function createTunnel(stage, { backdrop = null, tune = TUNE, kind = 'desktop', reduced = false,
  tier = stage?.tier || 'mid' } = {}) {
  const JT = tune.JUMP;
  const scene = new THREE.Scene();
  scene.name = 'tunnel';
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2000);
  camera.up.set(0, 0, 1);
  const pass = { scene, camera };
  // Things that ride with the ship (the tube, the hazards, rings and labels) live in a group at the ship's distance.
  const world = new THREE.Group();
  world.name = 'corridor';
  const wall = createWall(stage, JT.TUBE_R);
  const tube = createTube(stage);
  const imp = createImpostors(stage);
  const haz = createHazPoints(stage);
  const rings = createGates(stage, 160, { scene: world });
  const screen = createScreen();
  const shade = createShade();
  world.add(wall.object, tube.object, imp.object, haz.object);
  scene.add(shade.object, world, screen.object);
  const tern = createTern(stage, { kind: 'tern', scene, tune });
  const fx = createFx(stage, tier, { scene, tune });
  const headlight = createHeadlight({ shared: stage.rel });
  headlight.visible = false;
  headlight.renderOrder = 12;
  scene.add(headlight);
  let K = tune.CAM[kind] || tune.CAM.desktop;
  const st = {
    id: null, init: false, t: 0, cam: [0, -8, 2], fov: K.FOV, roll: 0, flash: 0, white: 0, hit: 0, rush: 0,
    punchAt: -99, q0: new THREE.Quaternion(), hasQ0: false, hl: 0, labels: new Map(), fade: 1, kick: 0, wall: 0,
    behind: null,
  };
  const pose = { pos: [0, 0, 0], prev: null, yaw: 0, pitch: 0, bank: 0, hop: 0, vel: [0, 60, 0], speed: 60,
    up: [0, 0, 1], drift: { on: false, dir: 1, tier: 0 }, db: { t: 0, tier: 0 }, boosting: false, slip: 0,
    flickerT: 0, stunT: 0 };
  const qCorr = new THREE.Quaternion(), qSky = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const m4 = new THREE.Matrix4(), vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3();
  const v3 = new THREE.Vector3(), vVel = [0, 0, -1], skyCam = { pos: [0, 0, 0], quat: [0, 0, 0, 1], fov: 70 };
  const corridorDir = [0, 1, 0], startPos = [0, 0, 0];
  const items = [];
  const knot = [0, 0];
  let base = 0;

  // The corridor's axes in the departure zone's map: ahead toward the target, up as near the plane's up as it goes.
  function frameFor(J) {
    const d = J.runup?.dir || [0, 1, 0];
    vF.set(d[0], d[1], d[2]).normalize();
    vU.set(0, 0, 1);
    if (Math.abs(vF.dot(vU)) > 0.95) vU.set(0, 1, 0);
    vU.addScaledVector(vF, -vF.dot(vU)).normalize();
    vR.crossVectors(vF, vU).normalize();
    m4.makeBasis(vR, vF, vU);
    qCorr.setFromRotationMatrix(m4);
    corridorDir[0] = vF.x; corridorDir[1] = vF.y; corridorDir[2] = vF.z;
  }

  function reset(game) {
    const J = game.jump;
    st.id = J.id; st.init = false; st.t = 0; st.flash = 0; st.white = 0; st.hit = 0; st.rush = 0; st.hl = 0;
    st.punchAt = -99; st.hasQ0 = false; st.fade = 1; st.kick = 0; st.behind = null;
    for (const sp of st.labels.values()) { sp.removeFromParent(); sp.material.map.dispose(); sp.material.dispose(); }
    st.labels.clear();
    frameFor(J);
    startPos[0] = game.ship.pos[0]; startPos[1] = game.ship.pos[1]; startPos[2] = game.ship.pos[2];
    fx.trails.clear();
  }

  function label(key, text, colour, left = false) {
    let sp = st.labels.get(key);
    if (!sp) {
      sp = createLabel(text, { colour, left });
      st.labels.set(key, sp);
      world.add(sp);
    }
    sp.visible = true;
    return sp;
  }
  function hideLabel(key) {
    for (const k of [key, `${key}<`]) { const sp = st.labels.get(k); if (sp) sp.visible = false; }
  }
  // A label on the side that stays on screen (its text runs left of the anchor, or right of it), moved down past any
  // label already placed this frame so two never cover each other.
  const placed = [];
  const vUp = new THREE.Vector3(), vP = new THREE.Vector3();
  function fitLabel(key, text, colour, left, x, y, z, alpha) {
    vP.set(x, y + world.position.y, z);
    v3.copy(vP).project(camera);
    if (v3.z > 1) { hideLabel(key); return; }
    const W = stage.size.w, Hs = stage.size.h;
    const px = ((v3.x + 1) / 2) * W;
    let py = ((1 - v3.y) / 2) * Hs;
    const w = 13 * text.length * 0.62 + 34, h = 30;
    if (left && px - w < 4) left = false;
    else if (!left && px + w > W - 4) left = true;
    const x0 = left ? px - w : px;
    let drop = 0;
    for (let tries = 0; tries < 4; tries++) {
      const hit = placed.some((r) => x0 < r[0] + r[2] && r[0] < x0 + w && py - h < r[1] + r[3] && r[1] < py);
      if (!hit) break;
      drop += h + 4; py += h + 4;
    }
    placed.push([x0, py - h, w, h]);
    if (drop > 0) {
      // Move the anchor down the screen by drop pixels at its own depth.
      const depth = Math.max(1, vP.clone().applyMatrix4(camera.matrixWorldInverse).z * -1);
      const perPx = (2 * depth * Math.tan((camera.fov * DEG) / 2)) / Hs;
      vUp.setFromMatrixColumn(camera.matrixWorld, 1);
      x -= vUp.x * drop * perPx; y -= vUp.y * drop * perPx; z -= vUp.z * drop * perPx;
    }
    const show = `${key}${left ? '<' : ''}`, hide = `${key}${left ? '' : '<'}`;
    const other = st.labels.get(hide);
    if (other) other.visible = false;
    placeLabel(label(show, text, colour, left), x, y, z, alpha);
  }
  // Put a label's anchor at a corridor point, at its pixel size on this screen.
  function placeLabel(sp, x, y, z, alpha = 1) {
    const P = camera.projectionMatrix.elements[5];
    const H = Math.max(1, stage.size.h);
    const s = (2 * sp.userData.h) / (P * H);
    sp.scale.set(s * (sp.userData.w / sp.userData.h), s, 1);
    sp.position.set(x, y, z);
    sp.material.opacity = alpha;
  }

  // ---------- the camera: behind and above the ship, as the chase camera frames it

  function vertical(fovSet) {
    if (kind === 'portrait') return fovSet;
    const aspect = stage.size.w / Math.max(1, stage.size.h);
    return (2 * Math.atan(Math.tan((fovSet * DEG) / 2) / Math.max(0.2, aspect))) / DEG;
  }

  function cameraStep(J, dt, ship, reducedNow) {
    const R = JT.TUBE_R;
    const dist = K.DIST * 1.15, height = K.HEIGHT;
    // Follow the ship across the tube a little behind its move: the ship swings on screen and the tube slides.
    const follow = 0.72;
    const tx = ship[0] * follow, tz = ship[2] * follow + height;
    const k = ease(dt, 0.09);
    if (!st.init) { st.cam[0] = tx; st.cam[2] = tz; st.init = true; }
    st.cam[0] += (tx - st.cam[0]) * k;
    st.cam[2] += (tz - st.cam[2]) * k;
    const lim = R - 1.2, rr = Math.hypot(st.cam[0], st.cam[2]);
    if (rr > lim) { st.cam[0] *= lim / rr; st.cam[2] *= lim / rr; }
    // FOV: wider with η, kicked by the punch, boosts and nines; a hit pulls it in.
    const etaK = clamp((J.eta - JT.ETA_ENTRY) / (JT.ETA_CAP - JT.ETA_ENTRY), 0, 1);
    let want = K.FOV + 4 + 12 * etaK + st.kick;
    if (J.boosting) want += 6;
    if (J.headlight) want += 4;
    if (reducedNow) want = Math.min(want, K.FOV + tune.FX.REDUCED_KICK + 8);
    st.fov += (want - st.fov) * ease(dt, 0.22);
    st.kick *= Math.exp(-dt / 0.3);
    // Roll a little into a move across the tube; none under reduced motion.
    const rollT = reducedNow ? 0 : clamp(-J.vel[0] * 0.006, -0.16, 0.16);
    st.roll += (rollT - st.roll) * ease(dt, 0.15);
    camera.position.set(st.cam[0], ship[1] - dist, st.cam[2]);
    const vf = vertical(st.fov);
    const wantDown = Math.atan((1 - 2 * K.SHIP_Y) * Math.tan((vf * DEG) / 2));
    const lx = ship[0] * 0.85 + J.vel[0] * 0.05, lz = ship[2] * 0.85 + J.vel[1] * 0.05;
    camera.up.set(Math.sin(st.roll), 0, Math.cos(st.roll));
    camera.lookAt(lx, ship[1] + 40, lz);
    camera.updateMatrixWorld();
    // Pitch so the ship lands at its screen height (SHIP_Y).
    const sv = v3.set(ship[0], ship[1], ship[2]).applyMatrix4(camera.matrixWorldInverse);
    camera.rotateX(Math.atan2(sv.y, -sv.z) - wantDown);
    camera.fov = vf;
    camera.aspect = stage.size.w / Math.max(1, stage.size.h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // ---------- events: kicks, flashes and sparks

  function onEvents(J, events, shipW) {
    const each = (fn) => {
      if (!events) return;
      if (Array.isArray(events)) { for (const e of events) if (e) fn(e); return; }
      for (let i = 0; i < events.n; i++) if (events.list[i]) fn(events.list[i]);
    };
    each((e) => {
      switch (e.type) {
        case 'punch':
          st.flash = reduced ? tune.FX.REDUCED_FLASH : JT.PUNCH_FLASH;
          st.punchAt = st.t; st.rush = 1; st.kick = JT.PUNCH_FOV;
          fx.shake.add(tune.FX.TRAUMA.punch);
          break;
        case 'jGraze': case 'jHairline': {
          const hair = e.type === 'jHairline';
          fx.shake.add(hair ? 0.16 : 0.09);
          st.kick = Math.max(st.kick, hair ? 3 : 1.5);
          // Streaks whip past on the side it passed: still in space, so the ship leaves them behind.
          const sx = Number.isFinite(e.x) ? e.x : e.side, sy = Number.isFinite(e.y) ? e.y : 0;
          const l = Math.hypot(sx, sy) || 1;
          for (let k = 0; k < (hair ? 22 : 12); k++) {
            const o = 0.7 + Math.random() * 0.9;
            v3.set(shipW[0] + (sx / l) * o, shipW[1] + 0.5 + Math.random() * 1.5, shipW[2] + (sy / l) * o);
            fx.sparks.emit(v3, [(sx / l) * 4 + (Math.random() - 0.5) * 3, J.speed * (0.05 + Math.random() * 0.15),
              (sy / l) * 4 + (Math.random() - 0.5) * 3], hair ? 14000 : 9000, 0.2 + Math.random() * 0.15, 1.5, 1);
          }
          break;
        }
        case 'jThread':
          fx.shake.add(0.14); st.kick = Math.max(st.kick, 5);
          fx.sparks.burst(v3.set(shipW[0], shipW[1] + 1, shipW[2]), [0, J.speed * 0.2, 0], 30, 10, 16000, 0.5, 1.4);
          break;
        case 'jPad':
          st.kick = Math.max(st.kick, 3);
          fx.sparks.burst(v3.set(shipW[0], shipW[1] + 0.5, shipW[2]), [0, J.speed * 0.2, 0], 18, 6, 14000, 0.4, 1.2);
          break;
        case 'jSkim': fx.shake.add(0.05); break;
        case 'jHit':
          if (!e.soft) {
            fx.shake.add(0.55); st.hit = 1; st.kick = -6;
            fx.sparks.burst(v3.set(shipW[0], shipW[1] + 0.6, shipW[2]), [0, J.speed * 0.1, 0], 44, 14, 4200, 0.6, 1.5);
          } else {
            fx.shake.add(0.2);
            fx.sparks.burst(v3.set(shipW[0], shipW[1] + 0.6, shipW[2]), [0, J.speed * 0.2, 0], 14, 6, 6000, 0.35, 1);
          }
          break;
        case 'nine':
          fx.shake.add(e.n === 3 ? 0.35 : 0.2);
          st.kick = Math.max(st.kick, e.n === 3 ? 10 : 6);
          st.white = Math.max(st.white, reduced ? 0.12 : e.n === 3 ? 0.4 : 0.22);
          break;
        case 'driftBoost':
          fx.shake.add(tune.FX.TRAUMA.driftBoost[clamp((e.tier || 1) - 1, 0, 2)]);
          st.kick = Math.max(st.kick, tune.CAM.DB_KICK[clamp((e.tier || 1) - 1, 0, 2)]);
          break;
        case 'boostStart': fx.shake.add(tune.FX.TRAUMA.boostStart); break;
        case 'vista': st.white = Math.max(st.white, reduced ? 0.15 : 0.3); break;
        case 'fork':
          if (e.taken) { st.white = Math.max(st.white, reduced ? 0.08 : 0.15); st.kick = Math.max(st.kick, 4); }
          break;
        case 'setPiece': if (e.kind === 'behind') st.behind = { label: e.label, t0: st.t }; break;
        case 'drop': st.white = Math.max(st.white, reduced ? 0.25 : 0.7); break;
        default: break;
      }
    });
  }

  // ---------- hazards, rings and labels (group-local: the ship at y = 0)

  const KNOT_T = 5400, SHEET_T = 6200, RAIL_T = 7000;
  function buildHazards(J, dAlpha, danger) {
    const Hz = J.haz;
    imp.begin();
    haz.begin();
    items.length = 0;
    placed.length = 0;
    for (let i = 0; i < Hz.n; i++) {
      if (!Hz.state[i]) continue;
      const kind = Hz.kind[i], id = Hz.id[i];
      const d = Hz.d[i] + dAlpha;
      if (d > FAR + 20) continue;
      const since = J.t - Hz.t[i], res = Hz.res[i];
      // Feedback: what you grazed or threaded flashes white-hot, what you hit flashes red.
      let flash = 0;
      if (Hz.state[i] === 2 && since < 0.5) {
        const k = 1 - since / 0.5;
        if (res === RES.graze || res === RES.hairline || res === RES.thread || res === RES.pad) flash = k;
        else if (res === RES.hit) flash = -k;
      }
      const hot = danger === id;
      const x = Hz.x[i], z = Hz.y[i];
      if (kind === HAZ.knot) {
        // A galaxy group: a big one and a few small ones round it.
        const r = Hz.r[i];
        const tile = hash(id * 1.7) < 0.3 ? 4 : Math.floor(hash(id * 2.3) * 3.99);
        // Drawn half again as big as before, so a knot reads over the streaks well before it arrives.
        imp.put(x, d, z, r * 1.5, tile, hash(id) * 6.28, KNOT_T + 1500 * hash(id * 3.1), hot ? 0.3 : flash);
        const nk = 2 + Math.floor(hash(id * 5.3) * 3);
        for (let k = 0; k < nk; k++) {
          const a = hash(id * 3 + k) * 6.283, m = r * (0.85 + 0.6 * hash(id * 5 + k));
          imp.put(x + Math.cos(a) * m, d + (hash(id + k) - 0.5) * r, z + Math.sin(a) * m,
            r * (0.28 + 0.22 * hash(id * 9 + k)), hash(id * 7 + k) < 0.5 ? 4 : 3, hash(id * 11 + k) * 6.28,
            KNOT_T - 600 + 2400 * hash(id * 13 + k), flash);
        }
        if (hot) items.push({ id: `h${id}`, pos: [x, d, z], normal: [0, 1, 0], r: r + 0.45, state: 'orange' });
      } else if (kind === HAZ.wall || kind === HAZ.fork) {
        // A sheet of galaxies across the tube with its gap (the fork has two), each gap ringed.
        const hole = Hz.r[i], x1 = Hz.x1[i], z1 = Hz.y1[i];
        for (let k = 0; k < 260; k++) {
          const a = hash(id * 11 + k) * 6.283, m = (JT.TUBE_R + 1.5) * Math.sqrt(hash(id * 13 + k));
          const px = Math.cos(a) * m, pz = Math.sin(a) * m;
          const g1 = Math.hypot(px - x, pz - z) - hole;
          const g2 = kind === HAZ.fork ? Math.hypot(px - x1, pz - z1) - hole : 9;
          if (g1 < 0.25 || g2 < 0.25) continue;
          const edge = Math.min(g1, g2) < 1.2 ? 1.7 : 1;
          haz.put(px, d + (hash(id * 17 + k) - 0.5) * 0.8, pz, 0.05 + 0.12 * hash(id * 19 + k),
            SHEET_T + 2000 * (hash(id + k * 3) - 0.5), 1.3 * edge, flash * 0.6);
        }
        const s1 = Hz.state[i] === 2 ? 'dim' : hot ? 'orange' : 'white';
        items.push({ id: `w${id}`, pos: [x, d, z], normal: [0, 1, 0], r: hole, state: s1 });
        if (kind === HAZ.fork) {
          items.push({ id: `wb${id}`, pos: [x1, d, z1], normal: [0, 1, 0], r: hole, state: s1 });
          if (d > -2 && d < FAR * 0.95) {
            const k = smooth(FAR * 0.95, FAR * 0.65, d);
            // Each gap's name on its own side: a to the left, b to the right.
            const la = x <= x1, ax = la ? -0.72 : 0.72;
            fitLabel(`fa${id}`, J.fork?.a || '', '#ffffff', la, x + hole * ax, d, z + hole * 0.72, k);
            fitLabel(`fb${id}`, J.fork?.b || '', '#f08a2c', !la, x1 - hole * ax, d, z1 + hole * 0.72, k);
          } else { hideLabel(`fa${id}`); hideLabel(`fb${id}`); }
        }
      } else if (kind === HAZ.gate) {
        // A cluster ring: big galaxies round a ring you can fly through.
        const n = gateKnots(Hz, i), kr = Hz.w[i];
        for (let k = 0; k < n; k++) {
          gateKnotAt(Hz, i, k, knot);
          imp.put(knot[0], d, knot[1], kr * 1.6, hash(id + k * 0.7) < 0.5 ? 4 : Math.floor(hash(id * 2 + k) * 3.99),
            hash(id * 3 + k) * 6.28, KNOT_T + 1200 * hash(id + k), flash);
        }
        const done = Hz.state[i] === 2;
        items.push({ id: `g${id}`, pos: [x, d, z], normal: [0, 1, 0], r: Hz.r[i],
          state: done ? (res === RES.thread ? 'white' : 'dim') : hot ? 'orange' : 'white' });
        if (Hz.tag[i]) {
          const pc = J.pieces[Hz.tag[i] - 1];
          if (pc && d > -4 && d < FAR) {
            fitLabel(`p${id}`, pc.label, '#ffffff', x < 0, x + Hz.r[i] * (x < 0 ? -0.75 : 0.75), d, z + Hz.r[i] * 0.75,
              smooth(FAR, FAR * 0.7, d) * smooth(-4, 6, d));
          } else hideLabel(`p${id}`);
        }
      } else if (kind === HAZ.pad) {
        items.push({ id: `p${id}`, pos: [x, d, z], normal: [0, 1, 0], r: Hz.r[i],
          state: Hz.state[i] === 2 ? (res === RES.pad ? 'white' : 'dim') : 'padNext' });
        haz.put(x, d, z, Hz.r[i] * 0.3, 15000, 1.2, flash);
      } else if (kind === HAZ.rail) {
        // A filament strand: a string of small galaxies along the corridor, drifting across it.
        const len = Hz.w[i] * J.speed;
        const riding = res === RES.skim && Hz.state[i] === 2;
        for (let s = Math.max(0, -d - 40); s <= len && d + s < FAR; s += 1.4) {
          const p = railAt(Hz, i, Hz.tp[i] + (s / Math.max(1, len)) * Hz.w[i], knot);
          const j = hash(id * 23 + Math.floor(s));
          haz.put(p[0] + (j - 0.5) * 0.3, d + s, p[1] + (hash(id + s) - 0.5) * 0.3, 0.1 + 0.2 * j, RAIL_T,
            riding ? 1.8 : 1.1, riding ? 0.45 : flash * 0.5);
        }
      }
    }
    imp.end();
    haz.end();
  }

  // Something behind you, seen at light speed: aberration brings light from 140° behind to a ring round the view
  // (tan(θ′/2) = e^−φ tan(θ/2)), reddened. Its label sits where that light lands, up and to the left.
  function behindLabel(J) {
    const b = st.behind;
    const age = b ? st.t - b.t0 : 99;
    if (!b || age > 4) { hideLabel('behind'); if (b && age > 4) st.behind = null; return; }
    const th = 2 * Math.atan(Math.exp(-Math.max(0.5, J.phiSky)) * Math.tan((140 * DEG) / 2));
    const az = 0.7 * Math.PI;
    // A direction in the camera's frame (−z ahead), turned into the corridor group's frame.
    v3.set(Math.cos(az) * Math.sin(th), Math.sin(az) * Math.sin(th), -Math.cos(th)).applyQuaternion(camera.quaternion);
    const k = smooth(0, 0.4, age) * (1 - smooth(3.2, 4, age));
    fitLabel('behind', b.label, '#ff9a7a', false, camera.position.x + v3.x * 160,
      camera.position.y - base + v3.y * 160, camera.position.z + v3.z * 160, k);
  }

  // ---------- one frame

  function update(view) {
    const game = view.game, J = game?.jump;
    const dt = clamp(Number.isFinite(view.dt) ? view.dt : 1 / 60, 0, 0.1);
    const reducedNow = reduced || !!game?.settings?.reducedMotion;
    if (!J) return { passes: null };
    if (J.id !== st.id || (J.part === 'punch' && st.punchAt < 0 && !st.hasQ0)) reset(game);
    st.t += dt;
    const mode = game.mode;
    const alpha = clamp(Number.isFinite(view.alpha) ? view.alpha : 1, 0, 1);
    const stepDt = (1 / 120) * (game.timeScale || 0);
    const back = J.speed * stepDt * (1 - alpha);            // the last step's motion not yet shown
    base = J.s - back;
    world.position.y = base;
    const sx = J.prev[0] + (J.pos[0] - J.prev[0]) * alpha, sy = J.prev[1] + (J.pos[1] - J.prev[1]) * alpha;
    const shipW = [sx, base, sy];

    // The punch's hand-over: the zone camera's turn in the sky, kept to swing the sky from.
    if (mode === 'punch' && !st.hasQ0 && view.zoneCam) { st.q0.copy(view.zoneCam.quaternion); st.hasQ0 = true; }
    onEvents(J, view.events, shipW);

    // The ship: banked into its move across the tube, its nose leaning the way it slides.
    const LR = JT.LAT_RATE;
    pose.pos[0] = sx; pose.pos[1] = base; pose.pos[2] = sy;
    pose.yaw = clamp(J.vel[0] / LR, -1, 1) * 0.32;
    pose.pitch = clamp(J.vel[1] / LR, -1, 1) * 0.3;
    pose.bank = clamp(J.vel[0] / LR, -1.3, 1.3) * 0.75;
    pose.vel[0] = J.vel[0]; pose.vel[1] = J.speed; pose.vel[2] = J.vel[1];
    pose.speed = Math.min(J.speed, tune.SHIP.S_BOOST);
    pose.boosting = J.boosting || J.dbT > 0;
    pose.drift.on = J.slide; pose.drift.tier = J.tier; pose.drift.dir = J.vel[0] >= 0 ? -1 : 1;
    pose.db.t = J.dbT; pose.db.tier = J.dbT > 0 ? 2 : 0;
    pose.slip = J.slide ? 0.6 : clamp(Math.hypot(J.vel[0], J.vel[1]) / LR, 0, 1) * 0.2;
    pose.flickerT = J.flickerT;

    cameraStep(J, dt, pose.pos, reducedNow);

    // The tube.
    const live = mode === 'punch' ? smooth(0.1, 1.1, J.t) : 1;
    const etaK = clamp((J.eta - JT.ETA_ENTRY) / 2, 0, 1);
    const phiNear = 0.9 + 0.4 * etaK;
    const nearWall = Math.hypot(sx, sy) > JT.TUBE_R - JT.SHIP_R - 0.3 ? 1 : 0;
    st.wall += (nearWall - st.wall) * ease(dt, 0.08);
    const wu = wall.material.uniforms;
    wu.uS.value = J.s % 10000; wu.uPhi.value = phiNear; wu.uOrigin.value.set(sx, 0, sy);
    wu.uGain.value = live * (0.75 + 0.6 * etaK) * (J.boosting ? 1.25 : 1); wu.uWall.value = st.wall;
    const tu = tube.material.uniforms;
    tu.uS.value = ((J.s % LOOP) + LOOP) % LOOP;
    tu.uLen.value = clamp(J.speed * 0.08, 2, 10);
    tu.uR.value = JT.TUBE_R - 0.05;
    tu.uPhi.value = phiNear;
    tu.uOrigin.value.set(sx, 0, sy);
    tu.uAlpha.value = 0.9 * live * (0.8 + 0.4 * etaK);
    tu.uRibAlpha.value = 0.2 * live;

    // Hazards and rings.
    for (const m of [haz.material, imp.material]) {
      m.uniforms.uPhi.value = phiNear;
      m.uniforms.uOrigin.value.set(sx, 0, sy);
    }
    const hu = haz.material.uniforms;
    hu.uPx.value = stage.pxPerRad(camera);
    hu.uRatio.value = stage.ratio;
    hu.uMaxPx.value = (stage.budget?.spritePx || 24) * 2;
    buildHazards(J, back, J.danger > 0 ? J.dangerId : -1);
    // The vista: the destination's ring and its name dead ahead.
    if (J.part === 'vista' || J.part === 'dropout') {
      const k = J.part === 'vista' ? smooth(0, 0.4, J.partT) : 1 - smooth(0, 0.4, J.partT);
      if (k > 0.01) {
        const dz = 300;
        items.push({ id: 'vista', pos: [0, dz, 0], normal: [0, 1, 0], r: 26, state: 'orange' });
        const name = (zoneById(J.from)?.exit?.label || zoneById(J.to)?.name || J.to).toUpperCase().split(' · ')[0];
        fitLabel('vista', name, '#ffffff', false, 19, dz, 19, k);
      } else hideLabel('vista');
    }
    behindLabel(J);
    rings.set(items);
    rings.update(st.t);

    // The ship, its trails and sparks, the dust and the shake.
    tern.update(pose, 1, fx, dt);
    fx.update({ cam: camera, ship: pose, events: null, reduced: reducedNow, planeZ: sy }, dt);

    // The headlight: the cosmic background squeezed ahead, from THREE NINES.
    st.hl += ((J.headlight ? 1 : 0) - st.hl) * ease(dt, J.headlight ? 0.25 : 0.5);
    headlight.visible = st.hl > 0.01;
    if (headlight.visible) {
      const u = headlight.material.uniforms;
      v3.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
      u.uDir.value.copy(v3);
      u.uTemp.value = 30000;
      u.uEnergy.value = 160 * st.hl;
      u.uHaloPx.value = 3 + 4 * st.hl;
      u.uSizePx.value = 3.5 * u.uHaloPx.value;
      u.uViewport.value.set(stage.size.w, stage.size.h);
    }

    // The screen quad.
    st.flash *= Math.exp(-dt / (st.t - st.punchAt < JT.PUNCH_FLASH_T ? 10 : 0.18));
    st.white *= Math.exp(-dt / 0.22);
    st.hit *= Math.exp(-dt / 0.25);
    st.rush = Math.max(0, st.rush - dt / JT.RUSH_T);
    const su = screen.material.uniforms;
    v3.set(0, base + 300, 0).project(camera);
    su.uCentre.value.set(v3.x, v3.y);
    const asp = stage.size.w / Math.max(1, stage.size.h);
    su.uAspect.value.set(asp >= 1 ? 1 : asp, asp >= 1 ? 1 / asp : 1);
    su.uFlash.value = st.flash;
    su.uWhite.value = st.white;
    su.uRush.value = (reducedNow ? 0.5 : 1) * Math.max(st.rush, J.part === 'punch' ? 0.3 : 0);
    // Shade the glare ahead in dense stretches (lab A's fix), and a red rim from 0.99c.
    const hu2 = shade.material.uniforms;
    hu2.uCentre.value.copy(su.uCentre.value); hu2.uAspect.value.copy(su.uAspect.value);
    hu2.uShade.value = J.part === 'run' ? 0.6 * smooth(1.5, 4, J.haz.live) : 0;
    hu2.uShadeR.value = 0.2;
    shade.object.visible = hu2.uShade.value > 0.004;
    su.uRim.value = J.part === 'run' || J.part === 'vista' ? 0.16 * smooth(NINE2, NINE3, J.eta) : 0;
    su.uHit.value = (reducedNow ? 0.25 : 0.6) * st.hit;
    su.uTime.value = st.t;
    screen.object.visible = st.flash > 0.004 || st.white > 0.004 || su.uRush.value > 0.004 || su.uRim.value > 0.004
      || su.uHit.value > 0.004;

    // The sky: the backdrop at the jump's rapidity, turned down the corridor, flying the real way.
    updateSky(game, J, view);

    if (mode === 'dropout') {
      // The zone swells in front; the corridor fades out over the first second.
      st.fade = 1 - smooth(0, 0.9, J.partT);
      wu.uGain.value *= st.fade;
      tu.uAlpha.value *= st.fade;
      tu.uRibAlpha.value *= st.fade;
      imp.material.uniforms.uGain.value = 1.3 * st.fade;
      haz.object.visible = imp.object.visible = rings.object.visible = st.fade > 0.02;
      wall.object.visible = tube.object.visible = st.fade > 0.02;
      tern.visible = false;
      for (const sp of st.labels.values()) sp.material.opacity *= st.fade;
      return { passes: [stage.pass.backdrop, stage.pass.zone, pass], pass };
    }
    imp.material.uniforms.uGain.value = 1.3;
    wall.object.visible = tube.object.visible = true;
    tern.visible = true;
    rings.object.visible = true;
    return { passes: [stage.pass.backdrop, pass], pass };
  }

  function updateSky(game, J, view) {
    if (!backdrop) return;
    const phi = Math.max(0, J.phiSky || 0);
    if (game.mode === 'dropout' && view.zoneCam) {
      // The drop-out: main.js has put the destination's frame on the backdrop; the zone camera, φ falling.
      v3.set(game.ship.vel[0], game.ship.vel[1], game.ship.vel[2]);
      if (v3.lengthSq() < 1e-6) v3.set(0, 1, 0);
      v3.normalize().transformDirection(view.zoneCam.matrixWorldInverse);
      vVel[0] = v3.x; vVel[1] = v3.y; vVel[2] = v3.z;
      backdrop.update(view.zoneCam, phi, vVel);
      return;
    }
    // The corridor's turn in the departure zone's map, swung in from the zone camera over the punch.
    qSky.copy(qCorr).multiply(camera.quaternion);
    if (st.hasQ0) {
      qTmp.copy(st.q0).slerp(qSky, smooth(0, JT.PUNCH_CAM_T, J.t));
      qSky.copy(qTmp);
    }
    // Fly the real way: from the departure toward the target, all of it by the drop-out.
    const from = zoneById(J.from);
    const scale = from?.scaleLy || 50000;
    const frac = smooth(0, Math.max(1, J.Lr - JT.DROP_AT), J.t);
    const travel = (J.distanceLy * frac) / scale;
    skyCam.pos[0] = startPos[0] + corridorDir[0] * travel;
    skyCam.pos[1] = startPos[1] + corridorDir[1] * travel;
    skyCam.pos[2] = startPos[2] + corridorDir[2] * travel;
    skyCam.quat[0] = qSky.x; skyCam.quat[1] = qSky.y; skyCam.quat[2] = qSky.z; skyCam.quat[3] = qSky.w;
    skyCam.fov = camera.fov;
    v3.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    vVel[0] = v3.x; vVel[1] = v3.y; vVel[2] = v3.z;
    backdrop.update(skyCam, phi, vVel);
  }

  function setKind(k) { if (tune.CAM[k]) { kind = k; K = tune.CAM[k]; } }
  function setReduced(v) { reduced = !!v; }

  function dispose() {
    for (const sp of st.labels.values()) { sp.material.map.dispose(); sp.material.dispose(); }
    for (const o of [wall, tube, imp, haz, screen, shade]) { o.object.geometry.dispose(); o.material.dispose(); }
    headlight.geometry.dispose(); headlight.material.dispose();
    rings.dispose(); tern.dispose(); fx.dispose();
    scene.clear();
  }

  return {
    scene, camera, pass, update, setKind, setReduced, dispose, runupRings,
    get state() {
      return { fov: st.fov, roll: st.roll, flash: st.flash, white: st.white, fade: st.fade, base, galaxies: imp.count,
        points: haz.count, rings: items.length };
    },
  };
}
