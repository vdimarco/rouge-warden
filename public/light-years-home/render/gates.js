// Light Years Home v3: every 3D ring in one instanced draw: race gates, start rings, light pads, drop rings, the exit
// gate and the launch rings. Each is a quad in the ring's own plane whose fragment shader draws an annulus of constant
// screen width (the video's thin white lines), with a faint inner glow so it reads at speed. Orange is "this one now".
// Sources: Quilez, 2D distance functions, with fwidth antialiasing (constant-width outlines).
import * as THREE from 'three';
import { ORANGE } from './stage.js';

// States: colour code and line width (device px) in the shader.
export const GATE_STATES = Object.freeze({ white: 0, orange: 1, dim: 2, grey: 3, miss: 4, pad: 5, padNext: 6 });

const VS = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec4 iPos;         // centre, radius
  attribute vec4 iNormal;      // normal, state
  attribute vec2 iTime;        // state change time, a seed
  uniform float uTime;
  varying vec2 vP;
  varying float vR, vState, vAge, vSeed;
  void main() {
    vec3 n = normalize(iNormal.xyz);
    vec3 a = normalize(cross(n, abs(n.z) < 0.95 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(n, a);
    float R = iPos.w;
    float ext = R * 1.18 + 0.6;
    vP = aCorner * ext;
    vR = R;
    vState = iNormal.w;
    vAge = uTime - iTime.x;
    vSeed = iTime.y;
    vec3 p = iPos.xyz + (a * aCorner.x + b * aCorner.y) * ext;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    if (R <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const FS = /* glsl */ `
  uniform vec3 uOrange;
  uniform float uRatio, uTime;
  varying vec2 vP;
  varying float vR, vState, vAge, vSeed;
  void main() {
    float d = length(vP);
    float px = max(fwidth(d), 1e-5);            // u per device px here
    float dr = abs(d - vR) / px;                  // device px from the ring line
    int s = int(vState + 0.5);
    vec3 col = vec3(1.0);
    float width = 1.6 * uRatio, glow = 0.18, alpha = 1.0, inner = 0.0;
    if (s == 1) {                                 // orange: the one to go through now, breathing
      col = uOrange; width = 2.6 * uRatio; glow = 0.45; inner = 0.10;
      alpha = 0.85 + 0.15 * sin(uTime * 6.0);
    } else if (s == 2) { alpha = 0.22; glow = 0.0; }
    else if (s == 3) { col = vec3(0.55); alpha = 0.6; glow = 0.05; }
    else if (s == 4) {                            // a missed gate flashes red and fades
      col = vec3(1.0, 0.15, 0.1); width = 2.4 * uRatio; alpha = exp(-vAge * 2.5); glow = 0.4;
    } else if (s == 5 || s == 6) {                // a light pad: a double ring with ripples running in to its heart
      col = s == 6 ? uOrange : vec3(0.72, 0.88, 1.0);
      width = (s == 6 ? 2.4 : 1.8) * uRatio; glow = 0.4;
      float dr2 = abs(d - vR * 0.7) / px;
      dr = min(dr, dr2 + 0.6 * uRatio);
      float k = fract(uTime * 1.6 + vSeed * 0.37);
      float rip = abs(d - vR * 0.7 * (1.0 - k)) / px;
      inner = (1.0 - smoothstep(0.5, 2.0, rip / uRatio)) * 0.55 * k * (1.0 - k) * 4.0
        + exp(-d * d / (vR * vR * 0.04)) * (s == 6 ? 0.5 : 0.3);
    }
    // A pulse when a ring changes state (passed, opened).
    float pulse = s != 4 ? exp(-vAge * 5.0) * 0.8 : 0.0;
    float line = 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.8, dr);
    // The glow stays round: it ends well inside the quad, however small the ring is on screen.
    float halo = glow * exp(-dr / (5.0 * uRatio)) * (1.0 - smoothstep(vR * 1.04, vR * 1.16, d))
      * smoothstep(vR * 0.6, vR * 0.9, d);
    float fill = inner * (1.0 - smoothstep(vR * 0.85, vR, d));
    // A ring a few px across is only its line: the glow and the fill would make it a blob.
    float big = smoothstep(5.0, 16.0, vR / px / uRatio);
    halo *= big; fill *= big; pulse *= big;
    float I = (line + halo + fill + pulse * (line + halo * 2.0)) * alpha;
    if (I < 0.003) discard;
    gl_FragColor = vec4(col * I, 1.0);
    #include <colorspace_fragment>
  }`;

/**
 * createGates(stage, cap = 256) → { set(list), update(time?), dispose(), object }. list items:
 * { pos, normal, r, state: 'white' | 'orange' | 'dim' | 'grey' | 'miss' | 'pad' | 'padNext', id? }. An item with an
 * id keeps its state-change time across set() calls, so a ring pulses when its state changes.
 */
export function createGates(stage, cap = 256, { scene = null } = {}) {
  const n = Math.max(1, cap | 0);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iNormal = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iTime = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', iPos);
  g.setAttribute('iNormal', iNormal);
  g.setAttribute('iTime', iTime);
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS,
    uniforms: { uOrange: { value: ORANGE.clone() }, uRatio: { value: stage.ratio }, uTime: { value: 0 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, side: THREE.DoubleSide,
  });
  mat.name = 'lyh-gates';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'gates';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  (scene || stage.scenes.zone).add(mesh);
  const known = new Map();                    // id → { state, t }
  let time = 0;

  function set(list) {
    const items = Array.isArray(list) ? list : [];
    let k = 0;
    for (const it of items) {
      if (k >= n) break;
      if (!it || !it.pos || !(it.r > 0)) continue;
      const code = GATE_STATES[it.state] ?? 0;
      let t0 = -99;
      if (it.id != null) {
        const was = known.get(it.id);
        if (!was) known.set(it.id, { state: code, t: -99 });
        else if (was.state !== code) { was.state = code; was.t = time; }
        t0 = known.get(it.id).t;
      }
      if (code === GATE_STATES.miss && it.id == null) t0 = it.t ?? time;
      const nrm = it.normal || [0, 1, 0];
      const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
      iPos.array.set([it.pos[0], it.pos[1], it.pos[2] || 0, it.r], k * 4);
      iNormal.array.set([nrm[0] / l, nrm[1] / l, nrm[2] / l, code], k * 4);
      iTime.array.set([t0, k], k * 2);
      k++;
    }
    g.instanceCount = k;
    iPos.needsUpdate = iNormal.needsUpdate = iTime.needsUpdate = true;
    mesh.visible = k > 0;
    return k;
  }

  function update(t = null) {
    time = Number.isFinite(t) ? t : time + 1 / 60;
    mat.uniforms.uTime.value = time;
    mat.uniforms.uRatio.value = stage.ratio;
  }

  function dispose() { mesh.removeFromParent(); g.dispose(); mat.dispose(); }

  return { set, update, dispose, object: mesh, get count() { return g.instanceCount; } };
}
