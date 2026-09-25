// Particles, sparks, blade trails, flashes, shock rings, and ink splats.
import * as THREE from 'three';
import { scene, renderer } from './render.js';
import { grassUniforms } from './world.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
export const NEON_RGB = [0.72, 1.0, 0.1];

function canvasTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
export const starTex = canvasTex(256, 256, (g) => {
  g.translate(128, 128);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, 128, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 6; i++) { g.rotate(TAU / 6 + (i % 2) * 0.2); g.beginPath(); g.moveTo(0, -5); g.lineTo(i % 2 ? 90 : 126, 0); g.lineTo(0, 5); g.fill(); }
});
const splatTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#000'; g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.fill();
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU, d = 50 + Math.random() * 70, r = 2 + Math.random() * 14 * (1 - d / 130);
    g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, 0, TAU); g.fill();
    g.lineWidth = r * 0.8; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * d * 0.9, 128 + Math.sin(a) * d * 0.9); g.stroke();
  }
});

const PARTICLE_VERT = /* glsl */`
  attribute float size; attribute float alpha; attribute float rot; attribute vec3 pcolor;
  uniform float uScale; varying float vA; varying float vR; varying vec3 vC;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / max(-mv.z, 0.1); vA = alpha; vR = rot; vC = pcolor; }`;
const PARTICLE_FRAG = /* glsl */`
  varying float vA; varying float vR; varying vec3 vC;
  void main(){
    vec2 c = gl_PointCoord - 0.5; float s = sin(vR), co = cos(vR); c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
    float a;
    #if SHAPE == 0
      a = smoothstep(0.5, 0.05, length(c));
    #elif SHAPE == 1
      a = step(abs(c.x), 0.05 * (1. - abs(c.y) * 1.6)) * step(abs(c.y), 0.48);
    #else
      a = step(abs(c.x) + abs(c.y) * 0.6, 0.32);
    #endif
    if (a * vA < 0.01) discard;
    gl_FragColor = vec4(vC, a * vA);
  }`;
class Particles {
  constructor(max, shape, blending) {
    this.max = max; this.p = []; for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.rot = new Float32Array(max); this.col = new Float32Array(max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, defines: { SHAPE: shape }, transparent: true, depthWrite: false, blending });
    const pts = new THREE.Points(g, this.mat); pts.frustumCulled = false; scene.add(pts);
    this.cursor = 0;
  }
  spawn(o) {
    const p = this.p[this.cursor]; this.cursor = (this.cursor + 1) % this.max;
    Object.assign(p, { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life, max: o.life, s0: o.s0, s1: o.s1 ?? o.s0, a0: o.a0 ?? 1, rot: o.rot ?? rand(0, TAU), vr: o.vr ?? 0, drag: o.drag ?? 1, grav: o.grav ?? 0, flutter: o.flutter || 0, floor: o.floor ?? 0.02, c: o.c || [1, 1, 1] });
  }
  update(dt) {
    this.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.alpha[i] = 0; continue; }
      p.life -= dt;
      const k = 1 - p.life / p.max, drag = Math.pow(p.drag, dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag; p.vy -= p.grav * dt;
      if (p.flutter) { p.vx += Math.sin(p.life * 7 + i) * p.flutter * dt; p.vz += Math.cos(p.life * 5 + i) * p.flutter * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.2; p.vx *= 0.6; p.vz *= 0.6; p.vr *= 0.5; }
      p.rot += p.vr * dt;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.size[i] = lerp(p.s0, p.s1, k);
      this.alpha[i] = p.a0 * (1 - k * k) * Math.min(1, (p.max - p.life) * 20);
      this.rot[i] = p.rot;
      this.col[i * 3] = p.c[0]; this.col[i * 3 + 1] = p.c[1]; this.col[i * 3 + 2] = p.c[2];
    }
    for (const k of ['position', 'size', 'alpha', 'rot', 'pcolor']) this.geo.attributes[k].needsUpdate = true;
  }
}
class Sparks {
  constructor(max) {
    this.max = max; this.p = []; for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    this.pos = new Float32Array(max * 6); this.col = new Float32Array(max * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    l.frustumCulled = false; scene.add(l);
    this.cursor = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, heat, tint) { const p = this.p[this.cursor]; this.cursor = (this.cursor + 1) % this.max; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, heat, tint: tint || [1, 1, 1] }); }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i], o = i * 6;
      if (p.life <= 0) { this.col.fill(0, o, o + 6); continue; }
      p.life -= dt; p.vy -= 9 * dt; p.vx *= 0.985; p.vz *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.35; }
      const k = Math.max(p.life / p.max, 0), s = 0.024 + 0.02 * k;
      this.pos.set([p.x, p.y, p.z, p.x - p.vx * s, p.y - p.vy * s, p.z - p.vz * s], o);
      const h = p.heat * k * k, t = p.tint;
      this.col.set([h * t[0], h * t[1], h * t[2], h * t[0] * 0.4, h * t[1] * 0.4, h * t[2] * 0.4], o);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
export class Trail {
  constructor(n, color, additive) {
    this.n = n; this.pts = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6); this.alpha = new Float32Array(n * 2);
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }',
    });
    const mesh = new THREE.Mesh(g, this.mat); mesh.frustumCulled = false; scene.add(mesh);
  }
  push(a, b, i) {
    const last = this.pts[0];
    if (last && last.b.distanceTo(b) > 2.5) { i = 0; for (const p of this.pts) p.i = 0; }
    if (last && (last.i > 0.01 || i > 0.01)) this.pts.unshift({ a: last.a.clone().lerp(a, 0.5), b: last.b.clone().lerp(b, 0.5), i: (last.i + i) / 2 });
    this.pts.unshift({ a: a.clone(), b: b.clone(), i });
    while (this.pts.length > this.n) this.pts.pop();
    for (let k = 0; k < this.n; k++) {
      const p = this.pts[Math.min(k, this.pts.length - 1)];
      this.pos.set([p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z], k * 6);
      const al = p.i * Math.pow(1 - k / (this.n - 1), 1.5);
      this.alpha[k * 2] = al * 0.35; this.alpha[k * 2 + 1] = al;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }
}

const FX = {
  ink: new Particles(600, 0, THREE.NormalBlending),
  bits: new Particles(500, 1, THREE.NormalBlending),
  shards: new Particles(500, 2, THREE.NormalBlending),
  glow: new Particles(300, 0, THREE.AdditiveBlending),
  sparks: new Sparks(500),
  flashes: [], rings: [], splats: [], blasts: [],
};
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false }));
  s.visible = false; s.renderOrder = 10; scene.add(s); FX.flashes.push({ s, t: 0, d: 0.2, size: 1 });
}
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); FX.rings.push({ m, t: 0, d: 0.6, r: 5 });
}
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; scene.add(m); FX.splats.push({ m, t: 0, d: 9 });
}
let splatCursor = 0, flashCursor = 0, ringCursor = 0, blastCursor = 0;

export const fx = {
  sparks(pos, dir, n, speed, heat = 5, tint) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
      if (dir) v.addScaledVector(dir, speed * 0.6);
      FX.sparks.spawn(pos.x, pos.y, pos.z, v.x, v.y, v.z, rand(0.25, 0.7), heat, tint);
    }
  },
  ink(pos, n, spread = 1, up = 1) {
    for (let i = 0; i < n; i++) FX.ink.spawn({ x: pos.x + rand(-0.2, 0.2), y: pos.y + rand(-0.2, 0.2), z: pos.z + rand(-0.2, 0.2), vx: rand(-2, 2) * spread, vy: rand(0, 2) * up, vz: rand(-2, 2) * spread, life: rand(0.5, 1.2), s0: rand(0.2, 0.4), s1: rand(0.8, 1.6), a0: 0.75, drag: 0.08, c: [0, 0, 0] });
  },
  dust(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) { const v = rand(0.5, 0.75); FX.ink.spawn({ x: pos.x + rand(-0.5, 0.5), y: 0.2 + rand(0, 0.4), z: pos.z + rand(-0.5, 0.5), vx: rand(-3, 3) * spread, vy: rand(0.3, 1.6), vz: rand(-3, 3) * spread, life: rand(0.8, 1.8), s0: rand(0.4, 0.8), s1: rand(1.6, 3), a0: 0.4, drag: 0.15, c: [v, v * 0.97, v * 0.93] }); }
  },
  neon(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) FX.shards.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-3, 3) * spread, vy: rand(1, 4.5), vz: rand(-3, 3) * spread, life: rand(0.9, 2), s0: rand(0.07, 0.14), a0: 1, vr: rand(-10, 10), drag: 0.3, grav: 4, flutter: 5, c: NEON_RGB });
    for (let i = 0; i < n / 2; i++) FX.glow.spawn({ x: pos.x + rand(-0.3, 0.3), y: pos.y + rand(-0.3, 0.3), z: pos.z + rand(-0.3, 0.3), vx: rand(-1.5, 1.5) * spread, vy: rand(0, 2), vz: rand(-1.5, 1.5) * spread, life: rand(0.4, 0.9), s0: rand(0.15, 0.3), s1: 0.05, a0: 0.9, drag: 0.2, c: [0.5, 0.8, 0.05] });
  },
  fur(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) { const v = rand(0.08, 0.2); FX.bits.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-3, 3) * spread, vy: rand(1, 4), vz: rand(-3, 3) * spread, life: rand(0.8, 1.6), s0: rand(0.15, 0.3), a0: 1, vr: rand(-10, 10), drag: 0.3, grav: 6, flutter: 3, c: [v, v, v] }); }
  },
  grass(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) { const t = rand(0.45, 0.85); FX.bits.spawn({ x: pos.x + rand(-0.4, 0.4), y: 0.2 + rand(0, 0.4), z: pos.z + rand(-0.4, 0.4), vx: rand(-3, 3) * spread, vy: rand(2, 5), vz: rand(-3, 3) * spread, life: rand(0.9, 1.8), s0: rand(0.2, 0.4), a0: 1, vr: rand(-10, 10), drag: 0.3, grav: 6, flutter: 3, c: [t, t, t * 0.96] }); }
  },
  ember(pos) { FX.glow.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-0.3, 0.3), vy: rand(0.2, 0.8), vz: rand(-0.3, 0.3), life: rand(0.3, 0.6), s0: rand(0.12, 0.22), s1: 0.02, a0: 0.8, drag: 0.5, c: [0.45, 0.75, 0.04] }); },
  flash(pos, size = 2, d = 0.18) { const f = FX.flashes[flashCursor++ % FX.flashes.length]; f.s.position.copy(pos); f.t = d; f.d = d; f.size = size; f.s.visible = true; f.s.material.rotation = rand(0, TAU); },
  ring(pos, r = 5, d = 0.6) { const g = FX.rings[ringCursor++ % FX.rings.length]; g.m.position.set(pos.x, (pos.groundY ?? 0) + 0.08, pos.z); g.t = d; g.d = d; g.r = r; g.m.visible = true; },
  splat(pos, size = 2, y = 0) { const s = FX.splats[splatCursor++ % FX.splats.length]; s.m.position.set(pos.x, y + 0.04, pos.z); s.m.scale.setScalar(size); s.m.rotation.z = rand(0, TAU); s.t = s.d; s.m.visible = true; },
  blast(pos, strength = 1) { FX.blasts[blastCursor++ % 4] = { x: pos.x, z: pos.z, t: 0, s: strength }; },
  // ambient drifting dust and ash near the camera
  ambient(cam, rage) {
    FX.bits.spawn({ x: cam.x + rand(-14, 14), y: rand(1, 6), z: cam.z + rand(-14, 14), vx: rand(0.6, 1.4), vy: rand(-0.3, -0.05), vz: rand(-0.3, 0.3), life: rand(4, 7), s0: rand(0.05, 0.1), a0: 0.5, vr: rand(-2, 2), drag: 1, flutter: 0.6, c: [0.8, 0.8, 0.8] });
    if (rage) FX.glow.spawn({ x: cam.x + rand(-12, 12), y: rand(0.5, 5), z: cam.z + rand(-12, 12), vx: rand(-0.2, 0.2), vy: rand(0.2, 0.6), vz: rand(-0.2, 0.2), life: rand(2, 4), s0: rand(0.05, 0.1), a0: 0.7, drag: 1, flutter: 0.8, c: [0.35, 0.6, 0.03] });
  },
};
export function updateFX(dt) {
  FX.ink.update(dt); FX.bits.update(dt); FX.shards.update(dt); FX.glow.update(dt); FX.sparks.update(dt);
  for (const f of FX.flashes) { if (!f.s.visible) continue; f.t -= dt; const k = 1 - f.t / f.d; f.s.scale.setScalar(f.size * (0.4 + k * 1.2)); f.s.material.opacity = Math.max(0, 1 - k) * 0.9; if (f.t <= 0) f.s.visible = false; }
  for (const g of FX.rings) { if (!g.m.visible) continue; g.t -= dt; const k = 1 - g.t / g.d; g.m.scale.setScalar(0.5 + g.r * Math.pow(k, 0.5)); g.m.material.opacity = (1 - k) * 0.85; if (g.t <= 0) g.m.visible = false; }
  for (const s of FX.splats) { if (!s.m.visible) continue; s.t -= dt; s.m.material.opacity = Math.min(1, s.t / 3) * 0.8; if (s.t <= 0) s.m.visible = false; }
  FX.blasts.forEach((b, i) => { if (!b) return; b.t += dt; grassUniforms.uBlast.value[i].set(b.x, b.z, b.t * 14, Math.max(0, 1 - b.t / 1.2) * b.s); if (b.t > 1.2) FX.blasts[i] = null; });
}
