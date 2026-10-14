// Light Years Home v3: the Tern and the other ships. A low-poly hull built in code (flat shaded, a fresnel rim so the
// silhouette reads on black), the orange nose, red and green wingtip lights, and engines that glow as blackbodies
// (3,000 K coasting to 30,000 K on boost) through the same colour table as the stars. The same builder makes Vela's
// Swift (dark, sickle wings), Ferro's Pelican (a heavy tug) and the Magpies (small, pied, long tail). Drift sparks
// and wingtip trails go to fx.js when update() gets the fx object. Model axes: +y forward, +x right, +z up, 1 u long.
// Sources: design-handling.md section 1 (the look); none fit better than a hand-made hull.
import * as THREE from 'three';
import { basisFrom } from '../core/vec.js';
import { TUNE } from '../core/tune.js';
import { BLACKBODY_GLSL, blackbody } from './stage.js';

const lin = (hex) => new THREE.Color(hex);

// Paint and shape per kind. span: wingtip x; sweep: how far back the tip sits; sickle: forward bend of the outer
// wing; body: half-width; len: body scale along y; tail: 'fork' | 'spike' | 'box'; scale: overall size in u.
const KINDS = {
  tern: { scale: 1, span: 0.55, tipY: -0.42, sickle: 0, body: 1, tail: 'fork', hull: '#eef1f5', belly: '#9aa1ab',
    nose: '#f08a2c', canopy: '#202a38', accent: null, engines: [[-0.045, -0.37], [0.045, -0.37]], rim: 0.9 },
  swift: { scale: 1.05, span: 0.66, tipY: -0.30, sickle: 0.16, body: 0.9, tail: 'spike', dihedral: 0.06,
    hull: '#2a2e37',
    belly: '#16181d', nose: '#3fd6c8', canopy: '#0b0d10', accent: '#3fd6c8', engines: [[0, -0.40]], rim: 1.2 },
  pelican: { scale: 2.2, span: 0.42, tipY: -0.22, sickle: 0, body: 2.1, tail: 'box', dihedral: 0, hull: '#c9cbc4',
    belly: '#7b7e78', nose: '#d9a441', canopy: '#1d232b', accent: '#d9a441',
    engines: [[-0.12, -0.42], [-0.04, -0.42], [0.04, -0.42], [0.12, -0.42]], rim: 0.7 },
  magpie: { scale: 0.85, span: 0.5, tipY: -0.32, sickle: 0.05, body: 0.85, tail: 'long', hull: '#101216',
    belly: '#0a0b0d', nose: '#f4f6f8', canopy: '#2a6f8f', accent: '#f4f6f8', wing: '#f4f6f8',
    engines: [[0, -0.36]], rim: 1.3 },
};
export const HULL_KINDS = Object.freeze(Object.keys(KINDS));

// ---------- the hull ----------

// Flat-shaded triangles with a colour each. Faces are listed for the right side (x ≥ 0) and mirrored. stripe: a
// cosmetic colour for the accent panels (the Tern has none by default: the nose is its only colour).
function buildHull(k, stripe = null) {
  const P = [], C = [];
  const col = { hull: lin(k.hull), belly: lin(k.belly), nose: lin(k.nose), canopy: lin(k.canopy),
    accent: lin(stripe || k.accent || k.hull), wing: lin(k.wing || k.hull), dark: lin('#0d0f12') };
  const tri = (a, b, c, colour) => {
    P.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) C.push(colour.r, colour.g, colour.b);
  };
  const both = (a, b, c, colour) => {
    tri(a, b, c, colour);
    const m = (p) => [-p[0], p[1], p[2]];
    tri(m(a), m(c), m(b), colour);                       // mirrored, winding reversed
  };
  const w = k.body;
  const box = k.tail === 'box';
  // Body cross-sections: [y, top z, upper (x, z), side (x, z), bottom z]. A tug is a deep box with a pouch.
  const S = box ? [
    [0.30, 0.10, [0.10, 0.10], [0.14, 0.0], -0.12],
    [0.10, 0.16, [0.14, 0.14], [0.17, 0.0], -0.20],
    [-0.20, 0.15, [0.14, 0.13], [0.17, 0.0], -0.19],
    [-0.40, 0.11, [0.11, 0.10], [0.15, 0.0], -0.10],
  ] : [
    [0.26, 0.062, [0.03, 0.055], [0.055, 0.0], -0.038],
    [0.04, 0.110, [0.05, 0.090], [0.095 * w, 0.014], -0.060],
    [-0.20, 0.095, [0.05, 0.080], [0.105 * w, 0.010], -0.055],
    [-0.36, 0.060, [0.04, 0.050], [0.100 * w, 0.005], -0.045],
  ];
  const sec = S.map(([y, top, up, side, bot]) => ({
    top: [0, y, top], up: [up[0], y, up[1]], side: [side[0], y, side[1]], bot: [0, y, bot],
  }));
  // Nose: a cone to the tip.
  const tip = [0, box ? 0.36 : 0.5, box ? 0.02 : 0];
  const s0 = sec[0];
  both(tip, s0.top, s0.up, col.nose);
  both(tip, s0.up, s0.side, col.nose);
  both(tip, s0.side, s0.bot, box ? col.belly : col.nose);
  // Body panels between sections.
  for (let i = 0; i < sec.length - 1; i++) {
    const a = sec[i], b = sec[i + 1];
    const canopy = !box && i === 0;
    const top = canopy ? col.canopy : col.hull;
    both(a.top, b.top, b.up, top);
    both(a.top, b.up, a.up, top);
    both(a.up, b.up, b.side, i === 1 && !box ? col.accent : col.hull);
    both(a.up, b.side, a.side, col.hull);
    both(a.side, b.side, b.bot, col.belly);
    both(a.side, b.bot, a.bot, col.belly);
  }
  // Tail plate.
  const e = sec[sec.length - 1];
  both(e.top, e.side, e.up, col.dark);
  both(e.top, e.bot, e.side, col.dark);
  // Wings: a fan round an upper and a lower spine point. Planform: root leading edge, a mid point (bent forward on a
  // sickle wing), the tip, a trailing point and the root trailing edge.
  const span = k.span, ty = k.tipY;
  // A little dihedral, so the wings read as a shallow V from the chase camera behind.
  const dh = k.dihedral ?? 0.16;
  const rootL = [box ? 0.16 : 0.075, box ? 0.0 : 0.14, 0.005];
  const mid = [span * 0.55, (rootL[1] + ty) * 0.5 + k.sickle, 0.018 + span * 0.55 * dh * 0.8];
  const wtip = [span, ty, 0.03 + span * dh];
  const trail = [span * 0.5, ty + 0.09 + k.sickle * 0.6, 0.012 + span * 0.5 * dh * 0.8];
  const rootT = [box ? 0.16 : 0.11, box ? -0.30 : -0.29, 0.0];
  const upS = [span * 0.38, (rootL[1] + ty) * 0.42, 0.045 + span * 0.38 * dh * 0.8];
  const loS = [span * 0.38, (rootL[1] + ty) * 0.42, -0.016 + span * 0.38 * dh * 0.8];
  const ring = [rootL, mid, wtip, trail, rootT];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const lead = i < 2;
    both(a, b, upS, lead && k.wing ? col.wing : i === 1 ? col.accent : k.wing ? col.wing : col.hull);
    both(b, a, loS, col.belly);
  }
  // Tail: a fork (the Tern), a spike (the Swift), a long magpie tail, or nothing (the tug).
  if (k.tail === 'fork') {
    const a = [0.085, -0.30, 0.012], b = [0.03, -0.36, 0.012], f = [0.15, -0.62, 0.0];
    const a2 = [0.085, -0.30, -0.008], b2 = [0.03, -0.36, -0.008];
    both(a, f, b, col.hull);
    both(a2, b2, f, col.belly);
    both(a, a2, f, col.belly);
  } else if (k.tail === 'spike' || k.tail === 'long') {
    const L = k.tail === 'long' ? -0.95 : -0.62;
    const a = [0.04, -0.34, 0.03], f = [0, L, 0.01], b = [0, -0.34, 0.05], d = [0, -0.34, -0.02];
    both(a, f, b, k.tail === 'long' ? col.canopy : col.hull);
    both(a, d, f, col.belly);
  }
  const g = new THREE.BufferGeometry();
  const s = k.scale;
  for (let i = 0; i < P.length; i++) P[i] *= s;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return {
    geometry: g,
    tips: [[-span * s, ty * s, wtip[2] * s], [span * s, ty * s, wtip[2] * s]],
    engines: k.engines.map(([x, y]) => [x * s, y * s, 0]),
    tail: [0, -0.36 * s, 0],
    scale: s,
  };
}

// One hull geometry per kind and stripe, shared by every ship and ghost that looks the same.
const HULLS = new Map();
export function hullOf(kind = 'tern', stripe = null) {
  const id = KINDS[kind] ? kind : 'tern';
  const key = `${id}:${stripe || ''}`;
  if (!HULLS.has(key)) HULLS.set(key, buildHull(KINDS[id], stripe));
  return HULLS.get(key);
}

const HULL_VS = /* glsl */ `
  attribute vec3 color;
  varying vec3 vN, vV, vC;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    vC = color;
    gl_Position = projectionMatrix * mv;
  }`;
const HULL_FS = /* glsl */ `
  uniform vec3 uKey, uGlow;
  uniform float uRim, uFlash, uFade;
  varying vec3 vN, vV, vC;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vV);
    float key = max(dot(n, uKey), 0.0);
    float sky = 0.5 + 0.5 * n.y;                    // brighter faces turned up in the view
    float rim = pow(1.0 - abs(dot(n, v)), 3.0);
    vec3 c = vC * (0.10 + 0.62 * key + 0.30 * sky) + vec3(uRim * rim * 0.8);
    c += uGlow * (0.25 + 0.75 * rim);                 // the engine's own light on the hull
    c = mix(c, vec3(1.0), uFlash);
    gl_FragColor = vec4(c * uFade, uFade);
    #include <colorspace_fragment>
  }`;

// ---------- engine flames, the nozzle stars and the navigation lights: one additive draw ----------

const GLOW_VS = /* glsl */ `
  uniform float uLen, uWidth, uPxPerRad, uRatio, uTime, uBlink;
  attribute vec3 aAt;          // the nozzle or the light, model space
  attribute vec2 aCorner;      // beam: along 0..1, side -1..1; sprite: corner -1..1
  attribute float aKind;       // 0 beam, 1 nozzle star, 2 red, 3 green, 4 white strobe
  varying vec2 vUv;
  varying float vKind, vAmp;
  void main() {
    vKind = aKind;
    vUv = aCorner;
    vec4 c = modelViewMatrix * vec4(aAt, 1.0);
    vAmp = 1.0;
    if (aKind < 0.5) {
      vec4 e = modelViewMatrix * vec4(aAt + vec3(0.0, -uLen, 0.0), 1.0);
      vec3 p = mix(c.xyz, e.xyz, aCorner.x);
      vec3 axis = e.xyz - c.xyz;
      vec3 side = normalize(cross(axis, p));
      float w = uWidth * (1.0 - 0.75 * aCorner.x);
      p += side * aCorner.y * w;
      gl_Position = projectionMatrix * vec4(p, 1.0);
    } else {
      float depth = max(-c.z, 0.05);
      float px = aKind < 1.5 ? 10.0 : aKind > 3.5 ? 12.0 : 7.0;
      float world = aKind < 1.5 ? uWidth * 2.2 : 0.06;
      float size = max(world, px * depth / uPxPerRad);
      if (aKind > 3.5) vAmp = step(0.9, fract(uTime * 0.8 + 0.3));
      else if (aKind > 1.5) vAmp = 0.75 + 0.25 * uBlink;
      c.xy += aCorner * size;
      gl_Position = projectionMatrix * c;
    }
  }`;
const GLOW_FS = /* glsl */ `
  ${BLACKBODY_GLSL}
  uniform float uTemp, uHeat, uFade, uLights;
  varying vec2 vUv;
  varying float vKind, vAmp;
  void main() {
    vec3 col;
    if (vKind < 0.5) {
      float along = vUv.x, side = vUv.y;
      float I = pow(1.0 - along, 1.6) * exp(-side * side * 3.5) * uHeat * 2.2;
      col = 1.0 - exp(-I * lyhBB(uTemp * (1.0 - 0.45 * along)));
    } else {
      float r2 = dot(vUv, vUv);
      if (r2 > 1.0) discard;
      float core = exp(-r2 * 18.0), halo = exp(-r2 * 4.0) * (1.0 - r2);
      if (vKind < 1.5) {
        col = 1.0 - exp(-(3.5 * core + 0.9 * halo) * uHeat * lyhBB(uTemp));
      } else {
        vec3 tint = vKind < 2.5 ? vec3(1.0, 0.08, 0.05) : vKind < 3.5 ? vec3(0.1, 1.0, 0.25) : vec3(1.0);
        col = (tint * (1.6 * core + 0.8 * halo) + vec3(0.6) * core) * vAmp * uLights;
      }
    }
    gl_FragColor = vec4(col * uFade, 1.0);
    #include <colorspace_fragment>
  }`;

function buildGlow(hull) {
  const at = [], corner = [], kind = [], index = [];
  const quad = (p, k, beam) => {
    const b = at.length / 3;
    const cs = beam ? [[0, -1], [1, -1], [1, 1], [0, 1]] : [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const c of cs) { at.push(...p); corner.push(...c); kind.push(k); }
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (const e of hull.engines) quad(e, 0, true);
  for (const e of hull.engines) quad(e, 1, false);
  quad(hull.tips[0], 2, false);
  quad(hull.tips[1], 3, false);
  quad([0, hull.tail[1] + 0.02, 0.09 * hull.scale], 4, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3));
  g.setAttribute('aAt', new THREE.Float32BufferAttribute(at, 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4 * hull.scale);
  return g;
}

// ---------- a ship ----------

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
// Drift sparks heat up through star colours (final.md 2.2): charging, then red, white and blue by tier.
export const SPARK_T = Object.freeze([1900, 3200, 5800, 20000]);

/**
 * createTern(stage, { stripe, trail, kind, scene }) → ship view. kind: 'tern' | 'swift' | 'pelican' | 'magpie'.
 * update(pose, alpha, fx): pose is game.ship (interpolated with its prev by alpha) or an actor ({ pos, yaw, speed,
 * vel? }); fx (from createFx) receives the drift sparks and the wingtip trail. dispose() removes it.
 */
export function createTern(stage, { stripe = null, trail = null, kind = 'tern', scene = null, tune = TUNE } = {}) {
  const hull = hullOf(kind, stripe);
  const k = KINDS[kind] || KINDS.tern;
  const root = new THREE.Group();
  root.name = `ship:${kind}`;
  const hullMat = new THREE.ShaderMaterial({
    vertexShader: HULL_VS, fragmentShader: HULL_FS,
    uniforms: {
      uKey: { value: new THREE.Vector3(-0.35, 0.78, 0.52).normalize() }, uGlow: { value: new THREE.Vector3() },
      uRim: { value: k.rim }, uFlash: { value: 0 }, uFade: { value: 1 },
    },
    side: THREE.DoubleSide,
  });
  hullMat.name = 'lyh-hull';
  const mesh = new THREE.Mesh(hull.geometry, hullMat);
  mesh.name = 'hull';
  mesh.renderOrder = 1;
  root.add(mesh);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
    uniforms: {
      uLUT: { value: stage.lut }, uLen: { value: 0.4 }, uWidth: { value: 0.035 * hull.scale },
      uPxPerRad: { value: 500 }, uRatio: { value: 1 }, uTime: { value: 0 }, uBlink: { value: 1 },
      uTemp: { value: 6500 }, uHeat: { value: 1 }, uFade: { value: 1 }, uLights: { value: 1 },
    },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  glowMat.name = 'lyh-engine';
  const glow = new THREE.Mesh(buildGlow(hull), glowMat);
  glow.name = 'engine';
  glow.frustumCulled = false;
  glow.renderOrder = 6;
  root.add(glow);
  (scene || stage.scenes.zone).add(root);

  const S = tune.SHIP, FX = tune.FX;
  const st = { t: 0, temp: 3000, len: 0.3, boost: 0, emit: 0, bankShow: 0, prevYaw: null, lastSpeed: null, cool: 0 };
  const F = [0, 1, 0], R = [1, 0, 0], U = [0, 0, 1];
  const m4 = new THREE.Matrix4(), qBank = new THREE.Quaternion(), qPitch = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0), yAxis = new THREE.Vector3(0, 1, 0);
  const vF = new THREE.Vector3(), vR = new THREE.Vector3(), vU = new THREE.Vector3();
  const tipW = [new THREE.Vector3(), new THREE.Vector3()];
  const tmp = new THREE.Vector3();

  function update(pose, alpha = 1, fx = null, dt = 1 / 60) {
    if (!pose) { root.visible = false; return; }
    root.visible = true;
    st.t += dt;
    const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
    const prev = pose.prev;
    const p = pose.pos;
    let x = p[0], y = p[1], z = p[2], yaw = pose.yaw ?? 0, pitch = pose.pitch ?? 0, bank = pose.bank;
    if (prev && prev.pos) {
      x = prev.pos[0] + (p[0] - prev.pos[0]) * a;
      y = prev.pos[1] + (p[1] - prev.pos[1]) * a;
      z = prev.pos[2] + (p[2] - prev.pos[2]) * a;
      yaw = lerpAngle(prev.yaw ?? yaw, yaw, a);
      pitch = (prev.pitch ?? pitch) + (pitch - (prev.pitch ?? pitch)) * a;
      if (Number.isFinite(bank) && Number.isFinite(prev.bank)) bank = prev.bank + (bank - prev.bank) * a;
    }
    // Actors carry no bank: show one from their turn rate.
    if (!Number.isFinite(bank)) {
      const rate = st.prevYaw === null ? 0 : Math.atan2(Math.sin(yaw - st.prevYaw), Math.cos(yaw - st.prevYaw))
        / Math.max(dt, 1e-3);
      bank = clamp(rate * 0.25, -0.7, 0.7);
      st.bankShow += (bank - st.bankShow) * (1 - Math.exp(-dt / 0.15));
      bank = st.bankShow;
    }
    st.prevYaw = yaw;
    const up = pose.up || U;
    basisFrom(up, yaw, F, R);
    vF.set(F[0], F[1], F[2]);
    vR.set(R[0], R[1], R[2]);
    vU.set(up[0], up[1], up[2]);
    m4.makeBasis(vR, vF, vU);
    root.quaternion.setFromRotationMatrix(m4);
    qPitch.setFromAxisAngle(xAxis, pitch);
    qBank.setFromAxisAngle(yAxis, bank);
    root.quaternion.multiply(qPitch).multiply(qBank);
    const hop = pose.hop || 0;
    root.position.set(x + up[0] * hop, y + up[1] * hop, z + up[2] * hop);

    // Engine: a blackbody that heats with speed (design-handling.md 1).
    const speed = pose.speed ?? Math.hypot(...(pose.vel || [0, 0, 0]));
    const boosting = !!pose.boosting;
    const db = pose.db && pose.db.t > 0 ? pose.db.tier || 1 : 0;
    st.boost += ((boosting ? 1 : db ? 0.6 : 0) - st.boost) * (1 - Math.exp(-dt / (boosting ? 0.08 : 0.25)));
    const cruise = S.S_CRUISE, top = S.S_TOP;
    let T = speed < cruise ? 3000 + 3500 * smooth(cruise * 0.5, cruise, speed)
      : 6500 + 5500 * clamp((speed - cruise) / Math.max(1, top - cruise), 0, 1);
    let len = speed < cruise ? 0.15 + 0.25 * speed / cruise
      : 0.4 + 0.4 * clamp((speed - cruise) / (top - cruise), 0, 1);
    // Slowing hard (the brake, a hit) cools the engine to a coasting orange.
    const accel = st.lastSpeed === null || dt <= 0 ? 0 : (speed - st.lastSpeed) / dt;
    st.lastSpeed = speed;
    st.cool += ((accel < -8 ? 1 : 0) - st.cool) * (1 - Math.exp(-dt / 0.12));
    T += (3000 - T) * st.cool;
    len += (0.15 - len) * st.cool;
    T = T + (30000 - T) * st.boost;
    len = len + (1.6 - len) * st.boost;
    st.temp += (T - st.temp) * (1 - Math.exp(-dt / 0.1));
    st.len += (len - st.len) * (1 - Math.exp(-dt / 0.08));
    const flicker = 0.9 + 0.1 * Math.sin(st.t * 61) * Math.sin(st.t * 37);
    const u = glowMat.uniforms;
    u.uTemp.value = st.temp;
    u.uLen.value = st.len * hull.scale * flicker;
    u.uHeat.value = 0.7 + 0.5 * st.boost;
    u.uTime.value = st.t;
    u.uPxPerRad.value = stage.relNear.uPxPerRad.value;
    u.uRatio.value = stage.ratio;
    const c = blackbody(st.temp);
    hullMat.uniforms.uGlow.value.set(c[0], c[1], c[2]).multiplyScalar(0.06 + 0.12 * st.boost);
    const hit = (pose.flickerT || 0) > 0 || (pose.stunT || 0) > 0;
    hullMat.uniforms.uFlash.value = hit && Math.sin(st.t * 40) > 0 ? 0.55 : 0;

    // Wingtip trails and drift sparks.
    if (fx) {
      root.updateMatrixWorld(true);
      tipW[0].set(...hull.tips[0]).applyMatrix4(root.matrixWorld);
      tipW[1].set(...hull.tips[1]).applyMatrix4(root.matrixWorld);
      const slip = Math.abs(pose.slip || 0);
      const slipAmt = smooth(FX.SLIP_SHOW * DEG, 35 * DEG, slip);
      fx.trails?.sample(tipW[0], tipW[1], slipAmt, trail);
      const drift = pose.drift;
      if (drift && drift.on && fx.sparks) {
        const tier = drift.tier || 0;
        const rate = [40, 70, 110, 160][tier];
        st.emit += rate * dt;
        // Sparks fly from the outside of the turn at the tail.
        const outSide = -(drift.dir || 1);
        const vel = pose.vel || [vF.x * speed, vF.y * speed, vF.z * speed];
        while (st.emit >= 1) {
          st.emit -= 1;
          tmp.set(outSide * (0.12 + 0.2 * Math.random()) * hull.scale, (-0.3 - 0.15 * Math.random()) * hull.scale,
            -0.02).applyMatrix4(root.matrixWorld);
          const kick = 4 + 6 * Math.random();
          fx.sparks.emit(tmp, [vel[0] * 0.55 + vR.x * outSide * kick - vF.x * 3 + (Math.random() - 0.5) * 3,
            vel[1] * 0.55 + vR.y * outSide * kick - vF.y * 3 + (Math.random() - 0.5) * 3,
            vel[2] * 0.55 + vR.z * outSide * kick + (Math.random() - 0.2) * 2.5],
          SPARK_T[tier] * (0.85 + 0.3 * Math.random()), 0.22 + 0.25 * Math.random(), tier >= 2 ? 1.4 : 1);
        }
      } else st.emit = 0;
    }
  }

  function dispose() {
    root.removeFromParent();
    glow.geometry.dispose();
    glowMat.dispose();
    hullMat.dispose();
  }

  return {
    object: root, kind, update, dispose,
    set visible(v) { root.visible = !!v; },
    get visible() { return root.visible; },
    setFade(f) { hullMat.uniforms.uFade.value = f; glowMat.uniforms.uFade.value = f; root.visible = f > 0.002; },
  };
}
