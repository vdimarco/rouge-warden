// Small effects on the water: spray droplets, gold sparkles, and the dark shadow of a fish following the lure.
import * as THREE from "three";
import { U } from "./world-env.js";

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
