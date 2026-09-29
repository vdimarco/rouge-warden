// Small effects on the water: spray droplets, gold sparkles, the dark shadow of a fish following the lure, and the
// things that belong to a place's air: fireflies over Stump Bay at night and the gulls of Gull Rock. Also the
// measuring board that lies behind a fish in the catch view.
import * as THREE from "three";
import { U } from "./world-env.js";
import { rng } from "./places/util.js";

// One pool of soft round droplets, drawn in one call. Sizes are in meters and turn into pixels in the shader.
export class Spray {
  constructor(max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.gold = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aGold", new THREE.BufferAttribute(this.gold, 1).setUsage(THREE.DynamicDrawUsage));
    this.u = { uScale: { value: 400 }, uCol: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSize, aAlpha, aGold; uniform float uScale; varying float vA, vG;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 0.0, 48.0); vA = aAlpha * smoothstep(0.0, 1.5, gl_PointSize); vG = aGold; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA, vG;
        void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * vA; if (a < 0.01) discard;
          vec3 c = mix(uCol, vec3(1.0, 0.82, 0.35) * 1.3, vG); gl_FragColor = vec4(c * (1.0 + 0.4 * (0.25 - d)), a); }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
  }
  emit(x, y, z, vx, vy, vz, size, life, gold = 0, grav = 1) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0; this.size[i] = size; this.gold[i] = gold; this.grav[i] = grav; this.alpha[i] = 1;
  }
  // a splash: droplets thrown up and out in a crown
  burst(x, z, s, rnd = Math.random) {
    const n = Math.round(8 + s * 36);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, out = (0.4 + rnd() * 1.4) * (0.6 + s), up = (1.2 + rnd() * 2.6) * (0.55 + s * 0.8);
      this.emit(x + Math.cos(a) * 0.1 * s, 0.02, z + Math.sin(a) * 0.1 * s, Math.cos(a) * out, up, Math.sin(a) * out, 0.05 + rnd() * 0.09 * (0.5 + s), 0.5 + rnd() * 0.6);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.alpha[i] <= 0) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const k = i * 3;
      this.vel[k + 1] -= 9.8 * this.grav[i] * dt;
      const drag = Math.exp(-dt * 0.8);
      this.vel[k] *= drag; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0 && this.grav[i] > 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.alpha[i] = (1 - t) * (1 - t) * 0.95;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aGold.needsUpdate = true;
  }
}

// The dark shape of a fish under the water, soft at the edges. Drawn after the water so it darkens it.
export function followerShadow() {
  const u = { uAlpha: { value: 0 }, uFogCol: U.uFogCol, uFogNear: U.uFogNear, uFogFar: U.uFogFar };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vD; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha, uFogNear, uFogFar; varying vec2 vUv; varying float vD;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;            // x across, y from tail (-1) to nose (+1)
        float body = length(vec2(p.x / (0.34 * (1.0 - 0.45 * max(-p.y, 0.0))), (p.y - 0.12) / 0.72));
        float tail = length(vec2(p.x / (0.1 + 0.3 * smoothstep(-0.6, -0.95, p.y)), (p.y + 0.8) / 0.2));
        float a = max(1.0 - smoothstep(0.55, 1.0, body), (1.0 - smoothstep(0.5, 1.0, tail)) * 0.8);
        a *= uAlpha * (1.0 - smoothstep(uFogNear, uFogFar, vD));
        if (a < 0.005) discard;
        gl_FragColor = vec4(0.03, 0.07, 0.07, a);
      }`,
  });
  const g = new THREE.PlaneGeometry(0.62, 1.3);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 6;
  m.userData.u = u;
  m.visible = false;
  return m;
}

// Fireflies over the cove and the road: soft points that drift a little and blink. Drawn only at night (world.js shows them).
export function fireflies(place, n = 60) {
  const r = rng(66), pos = new Float32Array(n * 3), ph = new Float32Array(n * 4);
  const F = place.features.cove;
  for (let i = 0; i < n; i++) {
    const cove = r() < 0.6;
    pos[i * 3] = cove ? F.x0 + r() * (F.x1 - F.x0) : -30 + r() * 62;
    pos[i * 3 + 1] = 0.4 + r() * 2.0;
    pos[i * 3 + 2] = cove ? F.z0 + r() * (F.z1 - F.z0) : -22 + r() * 30;
    ph[i * 4] = r(); ph[i * 4 + 1] = 0.4 + r() * 0.6; ph[i * 4 + 2] = 0.5 + r() * 1.2; ph[i * 4 + 3] = 1.2 + r() * 1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aP", new THREE.BufferAttribute(ph, 4));
  const u = { uTime: U.uTime, uScale: { value: 400 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aP; uniform float uTime, uScale; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * aP.y + aP.x * 6.28), sin(uTime * aP.y * 1.3 + aP.x * 12.0) * 0.4, cos(uTime * aP.y * 0.9 + aP.x * 9.0)) * aP.z;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = pow(0.5 + 0.5 * sin(uTime * aP.w + aP.x * 40.0), 2.0);
        vA = blink;
        gl_PointSize = clamp(0.3 * uScale / max(-mv.z, 0.1), 3.5, 20.0) * (0.55 + 0.45 * blink);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * (0.25 + 0.75 * vA); if (a < 0.02) discard; gl_FragColor = vec4(vec3(0.85, 1.0, 0.35) * a * 1.4, a); }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 15;
  points.visible = false;
  points.userData.u = u;
  return points;
}

// Gulls: 14 of them, six triangles each, circling over the rising fish. The wings beat in the shader; the gulls fly
// in circles around the centres they are given (the rings, or a few far spots when there are none).
export class Gulls {
  constructor(n = 14) {
    this.n = n;
    const r = rng(67);
    this.g = Array.from({ length: n }, (_, k) => ({ R: 4 + r() * 6, H: 5 + r() * 6, w: (0.45 + r() * 0.35) * (k % 2 ? 1 : -1), a: r() * 6.28, ph: r() * 6.28, cx: 0, cz: -50, k }));
    // one gull, wings out: body (2 triangles) and two wings (2 triangles each); the wing weight makes the tips beat
    const v = [], w = [], c = [];
    const body = [[0, 0, -0.4], [0.1, 0, 0.05], [0, 0, 0.32], [-0.1, 0, 0.05]];
    const wing = (s) => [[0.06 * s, 0, -0.14], [0.06 * s, 0, 0.14], [0.95 * s, 0.16, 0.2], [0.95 * s, 0.16, -0.04]];   // the tips a little raised, a shallow V
    const tri = (a, b, d, wa, wb, wd, ca, cb, cd) => { v.push(...a, ...b, ...d); w.push(wa, wb, wd); c.push(...ca, ...cb, ...cd); };
    const white = [0.95, 0.95, 0.93], grey = [0.72, 0.74, 0.76], tip = [0.14, 0.15, 0.17];
    tri(body[0], body[1], body[2], 0, 0, 0, white, white, white); tri(body[0], body[2], body[3], 0, 0, 0, white, white, white);
    for (const s of [-1, 1]) {
      const q = wing(s), col = (i) => (i > 1 ? tip : grey);
      tri(q[0], q[1], q[2], 0, 0, 1, col(0), col(1), col(2)); tri(q[0], q[2], q[3], 0, 1, 1, col(0), col(2), col(3));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute("aWing", new THREE.Float32BufferAttribute(w, 1));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    geo.setAttribute("aPh", new THREE.InstancedBufferAttribute(new Float32Array(this.g.map((q) => q.ph)), 1));
    const u = { uTime: U.uTime, uFogCol: U.uFogCol, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uSunVis: U.uSunVis };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexColors: true, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aWing, aPh; uniform float uTime; varying vec3 vCol; varying float vD;
        void main() {
          vec3 p = position; p.y += aWing * (0.3 * sin(uTime * 6.0 + aPh) + 0.08);
          vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
          vCol = color; vD = -mv.z; gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogCol; uniform float uFogNear, uFogFar, uSunVis; varying vec3 vCol; varying float vD;
        void main() { vec3 c = vCol * (0.6 + 0.4 * uSunVis); gl_FragColor = vec4(mix(c, uFogCol, smoothstep(uFogNear, uFogFar, vD)), 1.0); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.u = u;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(0.85, 0.85, 0.85);
    this.update(0, []);
  }
  // centres: [{x, z}]; each gull follows the centre of its ring, and moves over to a new one smoothly
  update(dt, centres) {
    const k = 1 - Math.exp(-dt * 0.8);
    for (const q of this.g) {
      const c = centres.length ? centres[q.k % centres.length] : DEFAULT_SPOTS[q.k % DEFAULT_SPOTS.length];
      if (!q.init) { q.cx = c.x; q.cz = c.z; q.init = true; } else { q.cx += (c.x - q.cx) * k; q.cz += (c.z - q.cz) * k; }
      q.a += q.w * dt;
      const x = q.cx + Math.cos(q.a) * q.R, z = q.cz + Math.sin(q.a) * q.R, y = q.H + Math.sin(q.a * 2.3 + q.ph) * 0.8;
      // along the circle, banked into the turn
      const sg = Math.sign(q.w), th = Math.atan2(sg * Math.sin(q.a), -sg * Math.cos(q.a));
      this.e.set(0, th, -0.18 * sg, "YXZ");
      this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(x, y, z), this.q, this.s);
      this.mesh.setMatrixAt(q.k, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const DEFAULT_SPOTS = [{ x: -8, z: -60 }, { x: 30, z: -75 }, { x: -30, z: -40 }];

// The measuring board of the catch view: a strip with cm marks, nose of the fish at 0. `bl` is its length in cm.
// One quad and one 512 x 48 texture. The strip is as tall as the picture is (48 of 512 parts of its length).
export const BOARD_LENGTHS = [30, 60, 100, 150, 250];
const BOARD_TICKS = { 30: [1, 5, 10, 10], 60: [2, 10, 10, 10], 100: [5, 10, 10, 10], 150: [5, 25, 50, 25], 250: [10, 50, 50, 50] };  // minor, mid, major, label step (cm)
export function boardTexture(bl) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 48;
  const x = cv.getContext("2d");
  x.fillStyle = "#e4d8b8"; x.fillRect(0, 0, 512, 48);
  x.fillStyle = "#c9b98c"; x.fillRect(0, 0, 512, 5); x.fillRect(0, 43, 512, 5);
  const [minor, mid, major, step] = BOARD_TICKS[bl] || BOARD_TICKS[100];
  const px = (cm) => 4 + (cm / bl) * 504;
  x.fillStyle = "#2a2418"; x.strokeStyle = "#2a2418"; x.textAlign = "center"; x.font = "bold 21px sans-serif";
  for (let cm = 0; cm <= bl + 1e-6; cm += minor) {
    const isMajor = cm % major === 0, isMid = cm % mid === 0;
    const h = isMajor ? 17 : isMid ? 12 : 8;
    x.fillRect(Math.round(px(cm)) - 1, 43 - h, 2, h);
    if (cm % step === 0) { const t = String(cm); x.fillText(t, Math.min(498 - 10 * t.length, Math.max(4 + 6 * t.length, px(cm))), 22); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}
export function boardMesh(bl) {
  const mat = new THREE.MeshBasicMaterial({ map: boardTexture(bl), fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(bl / 100, (bl / 100) * (48 / 512)), mat);
  m.renderOrder = 29;
  m.userData.board = true;
  return m;
}
