// Critters, the three sludge-sick friends, and the Porcelain King. Also their shots, shockwaves, and sludge puddles.
import * as THREE from "three";
import * as M from "./models.js";
import { clamp, lerp, rng } from "./noise.js";

export const TYPES = {
  raccoon: { name: "Raccoon", hp: 14, speed: 3.2, run: 6.4, r: 0.7, dmg: 2, reach: 1.7, sight: 22, windup: 0.45, cd: 1.1, h: 1.3, drops: [["apple", 0.3], ["shroom", 0.15]] },
  goose: { name: "Goose", hp: 9, speed: 2.4, run: 7.6, r: 0.55, dmg: 1, reach: 1.4, sight: 16, windup: 0.3, cd: 0.8, h: 1.4, drops: [["apple", 0.2]] },
  bear: { name: "Black Bear", hp: 44, speed: 2.8, run: 7, r: 1.3, dmg: 4, reach: 2.8, sight: 24, windup: 0.6, cd: 1.5, h: 2.4, drops: [["berry", 0.6], ["syrup", 0.2]] },
  moose: { name: "Moose", hp: 80, speed: 3, run: 15, r: 1.7, dmg: 6, reach: 3, sight: 30, windup: 0.9, cd: 2.2, h: 4, charge: true, drops: [["syrup", 0.8]] },
  skeeter: { name: "Skeeter", hp: 3, speed: 5, run: 8.5, r: 0.45, dmg: 1, reach: 1.3, sight: 16, windup: 0.25, cd: 0.9, h: 1.8, fly: true, drops: [] },
};

const TMPV = new THREE.Vector3();

export class Foe {
  constructor(G, type, x, z, home) {
    this.G = G;
    this.type = type;
    this.T = TYPES[type];
    this.hp = this.T.hp;
    const m = M.critter(type);
    this.rig = m;
    G.scene.add(m.root);
    this.pos = new THREE.Vector3(x, G.groundAt(x, z, 999), z);
    this.home = home || { x, z };
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * 6.28;
    this.state = "idle";
    this.t = Math.random() * 3;
    this.target = null;
    this.phase = Math.random() * 6;
    this.alive = true;
    this.flash = 0;
    this.stun = 0;
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  dist() { const p = this.G.player.pos; return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  hurt(dmg, fx, fz, knock, stun) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.15; this.squash = 0.22;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    const k = knock / (this.type === "moose" ? 3 : this.type === "bear" ? 2 : 1);
    this.vel.x = (dx / d) * k; this.vel.z = (dz / d) * k;
    if (this.state === "idle" || this.state === "notice") this.alert();
    if (this.state !== "strike" || this.type !== "moose") { this.state = "hurt"; this.t = stun ? 1.2 : 0.35; }
    if (this.hp <= 0) this.die();
  }
  alert() { this.state = "notice"; this.t = 0.5; this.G.fx.bang(this.pos.x, this.pos.y + this.T.h + 0.8, this.pos.z); if (this.type === "goose") this.G.sfx("honk"); }
  die() {
    this.alive = false; this.state = "dead"; this.t = 1.2;
    this.G.sfx("pop");
    for (const [id, p] of this.T.drops) if (Math.random() < p) { this.G.dropFood(id, this.pos.x + (Math.random() - 0.5) * 2, this.pos.z + (Math.random() - 0.5) * 2); break; }
    if (Math.random() < 0.08) this.G.dropFood("heart", this.pos.x, this.pos.z);
    this.G.onKill(this);
  }

  update(dt) {
    const G = this.G, T = this.T, P = G.player;
    this.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    const d = this.dist();
    const face = (x, z, k = 8) => { this.yaw = turnTo(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), dt * k); };
    let speed = 0;
    switch (this.state) {
      case "idle": {
        if (this.t <= 0) { this.t = 2 + Math.random() * 4; const a = Math.random() * 6.28, r = Math.random() * 9; this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
        if (this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) > 1) { face(this.target.x, this.target.z, 3); speed = T.speed * 0.5; }
        const seen = d < T.sight * (P.sprinting ? 1.3 : 1) * (G.night ? 0.7 : 1);
        if (seen && !P.dead && !G.cutscene) this.alert();
        break;
      }
      case "notice": face(P.x, P.z, 10); if (this.t <= 0) this.state = "chase"; break;
      case "chase": {
        face(P.x, P.z, 7);
        speed = T.run;
        const leash = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
        if (leash > 55 || d > T.sight * 2.2 || P.dead) { this.state = "return"; break; }
        const want = T.charge ? 14 : T.reach + P.rigR();
        if (d < want && (!T.charge || d > 5)) { this.state = "windup"; this.t = T.windup; }
        else if (T.charge && d < 5) { this.state = "windup"; this.t = 0.5; }
        break;
      }
      case "windup": face(P.x, P.z, T.charge ? 4 : 10); if (this.t <= 0) { this.state = "strike"; this.t = T.charge ? 1.1 : 0.25; this.hitDone = false; if (this.type === "bear") G.sfx("growl"); } break;
      case "strike": {
        if (T.charge) {
          speed = T.run;
          if (!this.hitDone && d < T.r + 1.3 && Math.abs(P.y - this.pos.y) < 3) { this.hitDone = true; P.hurt(T.dmg, this.pos.x, this.pos.z, 14); }
        } else {
          speed = T.run * 1.3;
          if (!this.hitDone && d < T.reach + 0.6 && Math.abs(P.y - this.pos.y) < 2.2) { this.hitDone = true; P.hurt(T.dmg, this.pos.x, this.pos.z, 7); }
        }
        if (this.t <= 0) { this.state = "recover"; this.t = T.cd; }
        break;
      }
      case "recover": face(P.x, P.z, 3); speed = -T.speed * 0.3; if (this.t <= 0) this.state = d < T.sight * 1.5 ? "chase" : "return"; break;
      case "hurt": if (this.t <= 0) this.state = "chase"; break;
      case "return": face(this.home.x, this.home.z, 5); speed = T.run * 0.7; this.hp = Math.min(T.hp, this.hp + dt * 5); if (Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) < 3) this.state = "idle"; break;
      case "dead": break;
    }
    if (this.state === "dead") {
      this.rig.root.rotation.z = lerp(this.rig.root.rotation.z, Math.PI / 2, dt * 6);
      this.rig.root.scale.setScalar(Math.max(0.01, this.t / 1.2));
      if (this.t <= 0) { this.rig.root.visible = false; this.gone = true; }
      return;
    }
    // move
    const k = 1 - Math.exp(-dt * 6);
    this.vel.x = lerp(this.vel.x, Math.sin(this.yaw) * speed, this.state === "hurt" ? 0.02 : k);
    this.vel.z = lerp(this.vel.z, Math.cos(this.yaw) * speed, this.state === "hurt" ? 0.02 : k);
    let nx = this.pos.x + this.vel.x * dt * G.foeTime, nz = this.pos.z + this.vel.z * dt * G.foeTime;
    G.world.near(nx, nz, (c) => { const ddx = nx - c.x, ddz = nz - c.z, dd = Math.hypot(ddx, ddz), m = c.r + T.r * 0.6; if (dd < m && dd > 0.001) { nx = c.x + (ddx / dd) * m; nz = c.z + (ddz / dd) * m; } });
    const g = G.groundAt(nx, nz, this.pos.y + 1);
    if (g < 0.2 && !T.fly) { nx = this.pos.x; nz = this.pos.z; this.target = null; if (this.state === "strike" && T.charge) { this.state = "recover"; this.t = T.cd; } }
    else { this.pos.x = nx; this.pos.z = nz; }
    const gy = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 1);
    this.pos.y = T.fly ? Math.max(gy, 0) + 0.2 + Math.sin(G.time * 3 + this.phase) * 0.3 : gy;
    this.animate(dt, speed);
  }
  animate(dt, speed) {
    const r = this.rig, G = this.G;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    this.phase += dt * (2 + Math.abs(speed) * 1.6);
    r.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * Math.min(0.8, Math.abs(speed) * 0.15)));
    r.body.position.y = Math.abs(Math.sin(this.phase)) * Math.min(0.12, Math.abs(speed) * 0.02);
    if (!r.glb) r.body.rotation.x = this.state === "windup" ? -0.35 : this.state === "strike" ? 0.3 : 0;
    if (r.root.userData.wings) r.root.userData.wings.forEach((w, i) => (w.rotation.z = Math.sin(G.time * (this.type === "skeeter" ? 60 : 8)) * 0.6 * (i ? 1 : -1) * (this.type === "goose" && this.state !== "chase" && this.state !== "strike" ? 0.1 : 1)));
    if (r.root.userData.tail) r.root.userData.tail.rotation.y = Math.sin(G.time * 4 + this.phase) * 0.3;
    // painted models are one piece: they waddle, bob, and lean instead of moving each leg
    if (r.glb) {
      // a soft waddle and bob when moving, slow breathing when still, a squash before a strike and a stretch into it
      const m = Math.min(1, Math.abs(speed) * 0.2), k = 1 - Math.exp(-dt * 10);
      const wind = this.state === "windup", hit = this.state === "strike";
      const lean = wind ? -0.22 : hit ? 0.28 : m * 0.1, sy = wind ? 0.88 : hit ? 1.08 : 1 + Math.sin(G.time * 2.2 + this.phase) * 0.018 * (1 - m);
      r.body.rotation.x += (lean - r.body.rotation.x) * k;
      r.body.rotation.z = Math.sin(this.phase) * 0.09 * m;
      this.squash = Math.max(0, (this.squash || 0) - dt);
      r.body.scale.y += (sy - this.squash * 1.2 - r.body.scale.y) * k; r.body.scale.x = r.body.scale.z = 1 + (1 - r.body.scale.y) * 0.5;
      r.body.position.y += Math.abs(Math.sin(this.phase)) * 0.05 * m;
    }
    if (r.head && this.type === "goose") r.head.rotation.x = this.state === "chase" || this.state === "strike" ? 0.9 : Math.sin(G.time + this.phase) * 0.2;
    tint(r.root, this.flash > 0);
  }
}

// flash white when hit
function tint(root, on) {
  if (root.userData.lit === on) return;
  root.userData.lit = on;
  // the white copy of each material is made once and kept, so a flurry of hits makes no garbage
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline || !(o.material.emissive || o.userData.m0)) return;
    if (on) { if (!o.userData.mw) { o.userData.m0 = o.material; o.userData.mw = o.material.clone(); o.userData.mw.emissive.set(0xffffff); o.userData.mw.emissiveIntensity = 0.8; } o.material = o.userData.mw; }
    else if (o.userData.m0) o.material = o.userData.m0;
  });
}
// The King's lid is part of one painted model. Find the lid by where it sits, and swing it on its hinge in the
// vertex shader, so the King can snap it shut, chatter, and talk.
function kingLid(rig) {
  let mesh = null;
  rig.body.traverse((o) => { if (!mesh && o.isMesh && !o.userData.outline) mesh = o; });
  if (!mesh || !rig.glb) return null;
  rig.root.updateMatrixWorld(true);
  const toBody = new THREE.Matrix4().copy(rig.body.matrixWorld).invert().multiply(mesh.matrixWorld), fromBody = toBody.clone().invert();
  const g = mesh.geometry, p = g.attributes.position, w = new Float32Array(p.count), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(toBody);
    if (v.y < 3.22 || v.y > 5.35 || Math.abs(v.x) > 1.4) continue;
    // the lid leans forward from its hinge at the back of the bowl; the tank is just behind it
    if (v.z - (-0.85 + (v.y - 3.3) * (0.75 / 1.8)) > -0.12) w[i] = Math.min(1, (v.y - 3.22) / 0.25);
  }
  g.setAttribute("aLid", new THREE.BufferAttribute(w, 1));
  const U = { uLid: { value: 0 }, uHinge: { value: new THREE.Vector3(0, 3.3, -0.8).applyMatrix4(fromBody) }, uAxis: { value: new THREE.Vector3(1, 0, 0).transformDirection(fromBody) } };
  const patch = (mat) => {
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey.bind(mat);
    mat.onBeforeCompile = (s, r) => {
      if (prev) prev.call(mat, s, r);
      Object.assign(s.uniforms, U);
      s.vertexShader = "attribute float aLid; uniform float uLid; uniform vec3 uHinge, uAxis;\nvec3 lidRot(vec3 v, float a) { float c = cos(a), s = sin(a); return v * c + cross(uAxis, v) * s + uAxis * dot(uAxis, v) * (1.0 - c); }\n" + s.vertexShader
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = lidRot(objectNormal, uLid * aLid);")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = uHinge + lidRot(transformed - uHinge, uLid * aLid);");
    };
    mat.customProgramCacheKey = () => key() + "|kinglid";
    mat.needsUpdate = true;
  };
  rig.body.traverse((o) => { if (o.isMesh && o.geometry === g) patch(o.material); });
  return U;
}
function turnTo(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); }

/* ---------------- shots, markers, shockwaves, and puddles ---------------- */
// The shapes are shared. Each hazard gets its own small material, so it can fill up or fade on its own.
const FLAT_VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const HT = { value: 0 }; // one clock for every hazard shader
const GEO = {
  flat: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
  wave: new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0),
  glob: new THREE.SphereGeometry(1, 14, 10),
};
// a ring on the ground where something will land; the inside fills up until the moment it hits
const MARK_FS = `uniform vec3 uColor; uniform float uFill, uTime, uAlpha; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float edge = smoothstep(0.84, 0.92, r) * (1.0 - smoothstep(0.96, 1.0, r));
  float fill = 1.0 - smoothstep(uFill - 0.03, uFill, r);
  float front = smoothstep(uFill - 0.14, uFill, r) * fill;
  float pulse = 0.7 + 0.3 * sin(uTime * (9.0 + uFill * 16.0));
  float a = max(edge * pulse, fill * 0.3 + front * 0.55) * uAlpha;
  gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.95, 0.85), front * 0.45 + edge * 0.15), a);
}`;
// a shockwave: a low wall of sludge with a bright crest. Jump it.
const WAVE_FS = `uniform vec3 uColor; uniform float uTime, uAlpha; varying vec2 vUv;
void main() {
  float h = vUv.y;
  float body = (1.0 - h) * 0.55;
  float crest = smoothstep(0.5, 0.88, h) * (1.0 - smoothstep(0.9, 1.0, h));
  float ripple = 0.8 + 0.2 * sin(vUv.x * 150.0 + uTime * 9.0);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), crest * 0.6), (body + crest * 1.3) * ripple * uAlpha);
}`;
// a puddle of sludge: a wobbly edge, a gloss, and slow bubbles
const POOL_FS = `uniform vec3 uColor; uniform float uTime, uAlpha, uSeed; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
  float er = 0.86 + 0.07 * sin(a * 5.0 + uSeed) + 0.04 * sin(a * 9.0 - uSeed * 2.0 + uTime * 1.5);
  if (r > er) discard;
  float rim = smoothstep(er - 0.14, er, r);
  vec3 c = mix(uColor * (0.75 + 0.3 * (1.0 - r)), uColor * 0.45, rim);
  float hl = smoothstep(0.28, 0.0, length(p - vec2(-0.3, 0.35))) * 0.3;
  float b = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k), ph = fract(uTime * 0.6 + fk * 0.33 + uSeed);
    vec2 bp = vec2(sin(uSeed * 3.1 + fk * 2.4), cos(uSeed * 1.7 + fk * 1.9)) * 0.45;
    float d = length(p - bp); b += (smoothstep(0.1 * ph + 0.02, 0.08 * ph + 0.01, d) - smoothstep(0.08 * ph, 0.06 * ph, d)) * (1.0 - ph);
  }
  gl_FragColor = vec4(c + vec3(0.9, 0.75, 1.0) * (hl + b * 0.8), uAlpha * (0.94 - rim * 0.2));
}`;
// the Royal Flush: a whirlpool that turns around a dark drain
const SWIRL_FS = `uniform float uTime, uAlpha; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float arms = smoothstep(0.1, 0.9, sin(atan(p.y, p.x) * 3.0 + r * 16.0 - uTime * 7.0));
  vec3 c = mix(vec3(0.18, 0.05, 0.24), vec3(0.66, 0.36, 0.86), arms);
  c = mix(c, vec3(0.04, 0.0, 0.07), smoothstep(0.28, 0.0, r));
  gl_FragColor = vec4(c, uAlpha * (0.45 + 0.4 * arms) * smoothstep(1.0, 0.82, r));
}`;

export class Hazards {
  constructor(G) {
    this.G = G; this.shots = []; this.rings = []; this.pools = []; this.marks = [];
    this.globMat = M.toon(0x7a3a9a, { emissive: 0x3a0a4a, emissiveIntensity: 0.5 });
  }
  mat(fs, u) {
    return new THREE.ShaderMaterial({ uniforms: { uTime: HT, uAlpha: { value: 1 }, ...u }, vertexShader: FLAT_VS, fragmentShader: fs, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // take a hazard out of the world and free what it owns
  drop(m) {
    if (!m) return;
    this.G.scene.remove(m);
    if (m.userData.shared) return;
    if (m.material && (m.material.isShaderMaterial || m.material.isMeshBasicMaterial)) m.material.dispose();
    if (m.geometry && !Object.values(GEO).includes(m.geometry)) m.geometry.dispose();
  }
  mark(x, z, r, color = 0xff4a2a, time = 0) {
    const m = new THREE.Mesh(GEO.flat, this.mat(MARK_FS, { uColor: { value: new THREE.Color(color) }, uFill: { value: time ? 0 : 1 } }));
    m.scale.set(r, 1, r); m.position.set(x, this.G.groundAt(x, z, 999) + 0.06, z); m.renderOrder = 2;
    m.userData.T = time; m.userData.age = 0;
    this.marks.push(m); this.G.scene.add(m);
    return m;
  }
  unmark(m) { const i = this.marks.indexOf(m); if (i >= 0) this.marks.splice(i, 1); this.drop(m); }
  swirl(x, z, r) {
    const m = new THREE.Mesh(GEO.flat, this.mat(SWIRL_FS, {}));
    m.scale.set(r, 1, r); m.position.set(x, this.G.groundAt(x, z, 999) + 0.05, z); m.renderOrder = 1;
    this.marks.push(m); this.G.scene.add(m);
    return m;
  }
  shot(o) {
    let m = o.mesh;
    if (!m) { m = new THREE.Mesh(GEO.glob, this.globMat); m.scale.setScalar(o.r); m.userData.shared = true; m.castShadow = true; }
    m.position.copy(o.pos); this.G.scene.add(m);
    const s = { gravity: 0, life: 6, ...o, mesh: m };
    if (o.gravity && o.target) {
      // how long until it lands, so the marker fills up right on time
      const gy = this.G.groundAt(o.target.x, o.target.z, 999), vy = o.vel.y;
      s.T = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * o.gravity * (o.pos.y - gy)))) / o.gravity;
      s.markObj = this.mark(o.target.x, o.target.z, o.r * 1.9, o.markColor || 0xff5a2a, s.T);
    }
    this.shots.push(s);
    return s;
  }
  ring(x, z, o = {}) {
    const m = new THREE.Mesh(GEO.wave, new THREE.ShaderMaterial({ uniforms: { uTime: HT, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(o.color || 0xffe08a) } }, vertexShader: FLAT_VS, fragmentShader: WAVE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const y = this.G.groundAt(x, z, 999); m.position.set(x, y, z); m.scale.set(1, o.h || 1, 1); m.renderOrder = 2;
    this.G.scene.add(m);
    this.rings.push({ x, z, y, r: 1, speed: o.speed || 14, max: o.max || 22, dmg: o.dmg ?? 4, h: o.h || 1, knock: o.knock || 9, mesh: m, hit: false, dust: o.color || 0xd8ccb0 });
    if (!o.quiet) { this.G.sfx("slam"); this.G.shake(0.5); }
  }
  pool(x, z, r = 2.2, life = 8) {
    // never more than ten puddles: the oldest dries up first
    if (this.pools.length >= 10) { const p = this.pools.shift(); this.drop(p.mesh); }
    const m = new THREE.Mesh(GEO.flat, this.mat(POOL_FS, { uColor: { value: new THREE.Color(0x6a2a7a) }, uSeed: { value: Math.random() * 6.28 } }));
    m.scale.set(r, 1, r); m.position.set(x, this.G.groundAt(x, z, 999) + 0.04, z); m.renderOrder = 1;
    this.G.scene.add(m);
    this.pools.push({ x, z, r, life, max: life, mesh: m, tick: 0 });
  }
  clear() {
    for (const s of this.shots) { this.drop(s.mesh); this.drop(s.markObj); }
    for (const r of this.rings) this.drop(r.mesh);
    for (const p of this.pools) this.drop(p.mesh);
    for (const m of this.marks) this.drop(m);
    this.shots.length = this.rings.length = this.pools.length = this.marks.length = 0;
  }
  update(dt) {
    const G = this.G, P = G.player, ft = G.foeTime;
    HT.value = G.time;
    for (const m of this.marks) if (m.userData.T) { m.userData.age += dt * ft; m.material.uniforms.uFill.value = Math.min(1, m.userData.age / m.userData.T); }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      let done = s.life <= 0, landed = false;
      if (s.spiral) {
        // sludge caught in the flush: it circles in toward the drain
        const q = s.spiral;
        q.a += q.w * dt * ft; q.r -= q.vr * dt * ft;
        s.pos.set(q.cx + Math.cos(q.a) * q.r, q.y + Math.sin(G.time * 6 + q.a) * 0.3, q.cz + Math.sin(q.a) * q.r);
        if (q.r < 2.5) done = true;
      } else {
        s.vel.y -= s.gravity * dt * ft;
        s.pos.addScaledVector(s.vel, dt * ft);
      }
      s.mesh.position.copy(s.pos);
      if (s.spin) s.mesh.rotation.y += dt * 12;
      if (s.mesh.userData.shared && Math.random() < dt * 22) G.fx.drip(s.pos.x, s.pos.y, s.pos.z, 0x6a2a7a);
      const hitP = Math.hypot(P.x - s.pos.x, P.z - s.pos.z) < s.r + 0.5 && s.pos.y > P.y - 0.3 && s.pos.y < P.y + 2.2;
      if (hitP) { P.hurt(s.dmg, s.pos.x - (s.vel ? s.vel.x : 0), s.pos.z - (s.vel ? s.vel.z : 0), 8); done = true; }
      if (!s.spiral && s.pos.y <= G.groundAt(s.pos.x, s.pos.z, s.pos.y + 1)) { done = true; landed = true; if (s.onLand) s.onLand(s.pos.x, s.pos.z); }
      if (done) {
        if (s.mesh.userData.shared) G.fx.splash(s.pos.x, s.pos.y + 0.2, s.pos.z, 0x7a3a9a, landed ? 10 : 6, 0.7);
        else G.fx.puff(s.pos.x, s.pos.y, s.pos.z, s.color || 0x6a2a7a);
        this.drop(s.mesh); this.unmark(s.markObj); this.shots.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt * ft;
      const u = r.r / r.max;
      r.mesh.scale.set(r.r, r.h * (1 - 0.5 * u), r.r);
      r.mesh.material.uniforms.uAlpha.value = 1 - u * u;
      // dust kicked up along the front of the wave
      if (Math.random() < dt * 30 * (1 - u)) { const a = Math.random() * 6.28; G.fx.kick(r.x + Math.cos(a) * r.r, r.y + 0.2, r.z + Math.sin(a) * r.r, Math.cos(a), Math.sin(a), r.dust); }
      const d = Math.hypot(P.x - r.x, P.z - r.z);
      const grounded = P.state === "ground" && P.y - r.y < 0.9;
      if (!r.hit && Math.abs(d - r.r) < 0.9 && grounded) { r.hit = true; P.hurt(r.dmg, r.x, r.z, r.knock); }
      if (r.r >= r.max) { this.drop(r.mesh); this.rings.splice(i, 1); }
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt; p.tick -= dt;
      // the last third of its life, a puddle shrinks and fades away
      const f = Math.min(1, p.life / (p.max * 0.3)), rr = p.r * (0.55 + 0.45 * f);
      p.mesh.scale.set(rr, 1, rr); p.mesh.material.uniforms.uAlpha.value = f;
      if (p.tick <= 0 && Math.hypot(P.x - p.x, P.z - p.z) < rr * 0.85 && P.state === "ground" && P.y < p.mesh.position.y + 1) { p.tick = 1; P.hurt(1, p.x, p.z, 2); }
      if (p.life <= 0) { this.drop(p.mesh); this.pools.splice(i, 1); }
    }
  }
}

/* ---------------- bosses ---------------- */
export const BOSS_STATS = {
  gabe: { hp: 220, r: 1.6, lines: ["You hear that? That's my buddy.", "These are MY mountains.", "Bears listen to me. You don't."] },
  christian: { hp: 180, r: 1.4, lines: ["Pick a card. Any card.", "Now you see me.", "The cards told me you'd lose."] },
  ryu: { hp: 160, r: 1.4, lines: ["My turn.", "You call that a plunger?", "Down here, I make the rules."] },
  king: { hp: 480, r: 4.5, lines: ["Who clogged me?", "Bow to the throne.", "Flush. FLUSH."] },
};

export class Boss {
  constructor(G, def) {
    this.G = G; this.def = def; this.id = def.id;
    this.S = BOSS_STATS[def.id];
    this.maxHp = this.S.hp; this.hp = this.maxHp;
    this.rig = M.boss(def.id);
    G.scene.add(this.rig.root);
    this.center = { x: def.x, z: def.z };
    this.pos = new THREE.Vector3(def.x, G.groundAt(def.x, def.z, 999), def.z);
    this.yaw = 0; this.state = "wait"; this.t = 0; this.phase = 0; this.active = false; this.alive = true;
    this.flash = 0; this.cycle = 0; this.clones = []; this.summoned = false; this.vy = 0;
    this.r = this.S.r;
    this.hitsTaken = 0;
    if (def.id === "king") this.kingSetup();
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  get T() { return { h: this.id === "king" ? 9 : 4, r: this.r }; }
  reset() {
    this.hp = this.maxHp; this.active = false; this.state = "wait"; this.pos.set(this.center.x, this.G.groundAt(this.center.x, this.center.z, 999), this.center.z);
    this.clones.forEach((c) => this.G.scene.remove(c.rig.root)); this.clones = []; this.summoned = false;
    this.G.hazards.clear();
    if (this.line) { this.G.scene.remove(this.line); this.line = null; }
    if (this.id === "king") this.kingReset();
    this.G.bossLeft(this);
  }
  hurt(dmg, fx, fz, knock, stun, o = {}) {
    if (!this.alive || !this.active) return false;
    if (this.state === "vanish") return false;
    if (this.id === "king") {
      // he shrugs off hits while he roars; the plunge has its own damage
      if (["intro", "rage", "plunged"].includes(this.state)) { this.G.sfx("clink"); return false; }
      dmg *= this.exposed ? 1.5 : this.state === "stuck" ? 1.3 : 1;
      if (!this.exposed) this.poise += Math.min(12, dmg * 1.3) * (o.poise || 1);
      this.poiseT = 0;
      this.sqv -= 2.4; this.flinchT = 0.18;
    }
    this.hp -= dmg; this.flash = 0.15; this.hitsTaken++;
    this.G.sfx("bonk");
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.exposed = false; this.G.bossDown(this); }
    if (this.id === "king" && this.alive) {
      const f = this.hp / this.maxHp, want = f <= 0.33 ? 3 : f <= 0.66 ? 2 : 1;
      if (want > this.phaseN) this.pendingPhase = Math.max(this.pendingPhase, want);
    }
    // after a few hits, get out of the way
    if (this.id === "christian" && this.hitsTaken % 4 === 0 && this.alive) { this.state = "vanish"; this.t = 0.5; }
    if (this.id === "ryu" && this.hitsTaken % 5 === 0 && this.state === "idle") { this.state = "backstep"; this.t = 0.5; }
    return true;
  }
  update(dt) {
    const G = this.G, P = G.player;
    if (!this.alive) { if (this.id === "king") this.kingDeath(dt); else this.rig.root.rotation.x = lerp(this.rig.root.rotation.x, -1.4, dt * 3); return; }
    const dC = Math.hypot(P.x - this.center.x, P.z - this.center.z);
    if (!this.active) {
      this.idleAnim(dt);
      // the King waits until you step onto his court; the others notice you from a little way off
      if (dC < this.def.r + (this.def.seal ? -1.5 : 6) && !P.dead && Math.abs(P.y - this.pos.y) < 15) { this.active = true; this.state = "intro"; this.t = 2.6; G.bossIntro(this); }
      return;
    }
    if (dC > this.def.r + 60 || P.dead) { this.reset(); return; }
    this.t -= dt * G.foeTime;
    this.flash = Math.max(0, this.flash - dt);
    const half = this.hp < this.maxHp / 2;
    const d = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    const face = (k = 6) => { this.yaw = turnTo(this.yaw, Math.atan2(P.x - this.pos.x, P.z - this.pos.z), dt * k); };
    this.moving = 0;
    this[this.id](dt, d, half, face);
    // keep inside the arena and on the ground
    const cx = this.pos.x - this.center.x, cz = this.pos.z - this.center.z, cd = Math.hypot(cx, cz), lim = this.def.r + (this.id === "king" ? -5 : 4);
    if (cd > lim) { this.pos.x = this.center.x + (cx / cd) * lim; this.pos.z = this.center.z + (cz / cd) * lim; }
    const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 2);
    this.pos.y = g;
    // the King is solid: you bump off him. He only hurts you with his moves.
    if (this.id === "king") {
      const dd = Math.hypot(P.x - this.pos.x, P.z - this.pos.z), R = this.r + 0.4;
      if (dd < R && dd > 0.01 && this.hopY < 2.5 && !G.plunge) { P.pos.x = this.pos.x + ((P.x - this.pos.x) / dd) * R; P.pos.z = this.pos.z + ((P.z - this.pos.z) / dd) * R; }
    }
    // bump the player
    else if (d < this.r + 0.6 && this.state !== "vanish" && !(this.id === "ryu" && (this.state === "dash" || this.state === "tired"))) P.hurt(this.id === "ryu" ? 1 : 2, this.pos.x, this.pos.z, 10);
    this.draw(dt);
  }
  idleAnim(dt) { this.phase += dt; this.draw(dt); }
  draw(dt) {
    if (this.id === "king") return this.drawKing(dt);
    const r = this.rig;
    r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
    const t = this.G.time;
    if (r.legs.length) {
      // how fast the boss really moves, for a stride that matches the ground
      const sp = this.lastPos ? Math.min(14, Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / Math.max(dt, 1e-3)) : 0;
      (this.lastPos = this.lastPos || new THREE.Vector3()).copy(this.pos);
      this.spd = lerp(this.spd || 0, sp, 1 - Math.exp(-dt * 8));
      const moving = this.spd > 0.4;
      if (r.knees) { r.knees[0].rotation.x = r.knees[1].rotation.x = 0; r.elbows[0].rotation.x = r.elbows[1].rotation.x = 0; }
      r.body.rotation.x = 0;
      if (moving) { this.phase += dt * M.strideRate(this.spd); M.stridePose(r, this.phase, this.spd); }
      else {
        r.legs[0].rotation.x = r.legs[1].rotation.x = 0;
        r.arms[0].rotation.set(Math.sin(t * 2) * 0.1, 0, -0.3);
        r.arms[1].rotation.set(0, 0, 0.3);
      }
      if (this.state === "windup" || this.state === "raise") r.arms[1].rotation.set(-2.8, 0, 0.2);
      if (this.state === "slam" || this.state === "strike") r.arms[1].rotation.set(-0.3, 0, 0.2);
      if (this.state === "throw") r.arms[1].rotation.set(-2.2 + Math.max(0, this.t) * 4, 0, 0.2);
      if (this.state === "cast") { r.arms[0].rotation.set(-1.5, 0, -0.2); r.arms[1].rotation.set(-1.5, 0, 0.2); }
      if (!moving) r.body.position.y = Math.sin(t * 2) * 0.04;
    }
    r.root.visible = this.state !== "vanish" || Math.floor(t * 20) % 2 === 0;
    if (this.id === "ryu" && this.active && this.alive) this.ryuPose();
    if (r.apply) r.apply(dt, this.spd > 0.4 ? 24 : 12);
    tint(r.root, this.flash > 0);
  }

  // Gabe: slow, heavy. Axe slams send shockwaves you must jump. Throws boulders from far away. Calls bears when hurt.
  gabe(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards;
    if (this.state === "intro") { face(); if (this.t <= 0) { this.state = "walk"; this.t = 2; } return; }
    if (half && !this.summoned) { this.summoned = true; for (const s of [-1, 1]) G.spawnFoe("bear", this.pos.x + s * 6, this.pos.z + 4); G.say(this, "Get 'em, buddy."); }
    if (this.state === "walk") { face(); if (d > 5) this.stepToward(dt, half ? 4.5 : 3.4); if (this.t <= 0) { this.state = d < 9 ? "raise" : "throw"; this.t = d < 9 ? 0.8 : 0.7; } }
    else if (this.state === "raise") { face(3); if (this.t <= 0) { this.state = "slam"; this.t = half ? 1.4 : 0.8; H.ring(this.pos.x + Math.sin(this.yaw) * 3, this.pos.z + Math.cos(this.yaw) * 3, { dmg: 4, max: 24, speed: 13 }); this.second = half; } }
    else if (this.state === "slam") { if (this.second && this.t < 0.7) { this.second = false; H.ring(this.pos.x, this.pos.z, { dmg: 4, max: 26, speed: 17 }); } if (this.t <= 0) { this.state = "walk"; this.t = 1.6 + Math.random(); } }
    else if (this.state === "throw") {
      face(8);
      if (this.t <= 0) {
        for (let k = 0; k < (half ? 3 : 1); k++) {
          const tx = P.x + P.vel.x * 0.9 + (k ? (Math.random() - 0.5) * 10 : 0), tz = P.z + P.vel.z * 0.9 + (k ? (Math.random() - 0.5) * 10 : 0);
          const from = TMPV.set(this.pos.x, this.pos.y + 6, this.pos.z).clone();
          const T = 1.3, vel = new THREE.Vector3((tx - from.x) / T, 0, (tz - from.z) / T);
          const gy = G.groundAt(tx, tz, 999); vel.y = (gy - from.y + 0.5 * 26 * T * T) / T;
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), M.toon(0x8a8a86));
          H.shot({ pos: from, vel, r: 1.2, dmg: 4, gravity: 26, mesh: rock, color: 0x8a8a86, target: { x: tx, z: tz }, spin: true });
        }
        G.sfx("throw");
        this.state = "walk"; this.t = 2;
      }
    }
  }
  // Christian: blinks around the stone circle and throws fans of cards. Makes copies of himself when hurt.
  christian(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards;
    if (this.state === "intro") { face(); if (this.t <= 0) { this.state = "cast"; this.t = 0.8; } return; }
    if (this.state === "vanish") {
      if (this.t <= 0) {
        const a = Math.random() * 6.28, r = 8 + Math.random() * (this.def.r - 10);
        G.fx.puff(this.pos.x, this.pos.y + 2, this.pos.z, 0xa060ff, 16);
        this.pos.x = this.center.x + Math.cos(a) * r; this.pos.z = this.center.z + Math.sin(a) * r;
        G.fx.puff(this.pos.x, this.pos.y + 2, this.pos.z, 0xa060ff, 16); G.sfx("poof");
        this.state = "cast"; this.t = half ? 0.55 : 0.8;
        if (half && this.clones.length === 0) this.makeClones();
      }
      return;
    }
    face(8);
    if (this.state === "cast" && this.t <= 0) {
      this.throwCards(this, half ? 7 : 5);
      this.clones.forEach((c) => c.alive && this.throwCards(c, 3));
      this.state = "idle"; this.t = half ? 1.2 : 1.8; this.cycle++;
    } else if (this.state === "idle" && this.t <= 0) { this.state = this.cycle % 2 ? "vanish" : "cast"; this.t = 0.5; }
    // stay close too long and he blinks away
    this.close = d < 4 ? (this.close || 0) + dt : 0;
    if (this.close > 1.6 && this.state === "idle") { this.close = 0; this.state = "vanish"; this.t = 0.3; }
    for (const c of this.clones) if (c.alive) { c.yaw = turnTo(c.yaw, Math.atan2(P.x - c.pos.x, P.z - c.pos.z), dt * 6); c.rig.root.position.copy(c.pos); c.rig.root.rotation.y = c.yaw; if (c.rig.apply) c.rig.apply(dt, 12); }
  }
  makeClones() {
    const G = this.G;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * 6.28, r = 10 + Math.random() * 10;
      const rig = M.boss("christian");
      const pos = new THREE.Vector3(this.center.x + Math.cos(a) * r, 0, this.center.z + Math.sin(a) * r); pos.y = G.groundAt(pos.x, pos.z, 999);
      rig.root.traverse((o) => { if (o.isMesh && !o.userData.outline) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; } });
      G.scene.add(rig.root);
      const c = { rig, pos, yaw: 0, alive: true, clone: true, T: { h: 4, r: 1.2 }, get x() { return this.pos.x; }, get z() { return this.pos.z; },
        hurt: () => { if (!c.alive) return; c.alive = false; G.scene.remove(rig.root); G.fx.puff(pos.x, pos.y + 2, pos.z, 0xa060ff, 20); G.sfx("poof"); } };
      this.clones.push(c);
      G.fx.puff(pos.x, pos.y + 2, pos.z, 0xa060ff, 16);
    }
  }
  throwCards(from, n) {
    const G = this.G, P = G.player;
    const base = Math.atan2(P.x - from.pos.x, P.z - from.pos.z);
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * 0.16;
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.9), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffffff : 0xe8303a }));
      G.hazards.shot({ pos: new THREE.Vector3(from.pos.x + Math.sin(a) * 2, from.pos.y + 2.2, from.pos.z + Math.cos(a) * 2), vel: new THREE.Vector3(Math.sin(a) * 15, 0, Math.cos(a) * 15), r: 0.55, dmg: 2, mesh: card, spin: true, color: 0xffffff, life: 3 });
    }
    G.sfx("cards");
  }
  // Ryu: fast. Dashes in a straight line, throws a fireball, and fights up close with his own plunger.
  // Ryu fights like a martial artist: he circles in a guard, and every attack has a clear wind-up and a
  // recovery you can punish. Punches lunge forward smoothly, the dash is slower with a long warning and
  // leaves him winded, and the fireball takes a moment to charge.
  ryu(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards, ft = G.foeTime;
    const toP = Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    if (this.state === "intro") { face(); if (this.t <= 0) { this.state = "idle"; this.t = 1.2; } return; }
    if (this.state === "idle") {
      face(5);
      // keep a fighting distance, and circle slowly to one side
      this.circle = this.circle || (Math.random() < 0.5 ? 1 : -1);
      const want = d > 8 ? 3.2 : d < 4.5 ? -2.4 : 0;
      this.pos.x += (Math.sin(toP) * want + Math.cos(toP) * this.circle * 1.4) * dt * ft;
      this.pos.z += (Math.cos(toP) * want - Math.sin(toP) * this.circle * 1.4) * dt * ft;
      this.moving = Math.abs(want) + 1.4;
      if (this.t <= 0) {
        const roll = Math.random();
        this.circle = -this.circle;
        if (d < 5.5) { this.state = "windup"; this.t = half ? 0.4 : 0.5; this.combo = 0; }
        else if (roll < 0.45) { this.state = "aim"; this.t = half ? 0.75 : 0.95; this.dashDir = toP; this.telegraph(); }
        else { this.state = "cast"; this.t = half ? 0.7 : 0.9; }
      }
    } else if (this.state === "windup") {
      face(6);
      if (this.t <= 0) { this.state = "strike"; this.t = 0.22; this.hitDone = false; G.sfx("swing"); }
    } else if (this.state === "strike") {
      // a smooth lunge, and one hit at the middle of it
      this.pos.x += Math.sin(this.yaw) * 9 * dt * ft; this.pos.z += Math.cos(this.yaw) * 9 * dt * ft;
      if (!this.hitDone && this.t < 0.12) { this.hitDone = true; if (d < 3.2) P.hurt(2, this.pos.x, this.pos.z, 6); }
      if (this.t <= 0) { this.combo++; if (this.combo < 2 && d < 5) { this.state = "windup"; this.t = 0.32; } else { this.state = "recover"; this.t = 0.9; } }
    } else if (this.state === "recover") {
      if (this.t <= 0) { this.state = "idle"; this.t = half ? 1.1 : 1.5; }
    } else if (this.state === "aim") {
      face(2);
      if (this.t <= 0) { G.scene.remove(this.line); this.state = "dash"; this.t = 0.5; this.yaw = this.dashDir; this.dashHit = false; G.sfx("dash"); }
    } else if (this.state === "dash") {
      this.pos.x += Math.sin(this.dashDir) * 24 * dt * ft; this.pos.z += Math.cos(this.dashDir) * 24 * dt * ft;
      if (!this.dashHit && d < 2.2) { this.dashHit = true; P.hurt(3, this.pos.x, this.pos.z, 11); }
      if (this.t <= 0) { this.state = "tired"; this.t = half ? 1.1 : 1.5; }
    } else if (this.state === "tired") {
      // winded after the dash: your chance to hit back
      if (this.t <= 0) { this.state = "idle"; this.t = 0.8; }
    } else if (this.state === "cast") {
      face(5);
      if (this.t <= 0) {
        const a = this.yaw;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), new THREE.MeshBasicMaterial({ color: 0x5ad8ff }));
        H.shot({ pos: new THREE.Vector3(this.pos.x + Math.sin(a) * 2.2, this.pos.y + 1.6, this.pos.z + Math.cos(a) * 2.2), vel: new THREE.Vector3(Math.sin(a) * 12, 0, Math.cos(a) * 12), r: 0.9, dmg: 3, mesh: ball, color: 0x5ad8ff, life: 3 });
        G.sfx("hadoken"); if (Math.random() < 0.5) G.say(this, "HA-DOKEN!");
        this.state = "release"; this.t = 0.5;
      }
    } else if (this.state === "release") {
      if (this.t <= 0) { this.state = "idle"; this.t = half ? 1.1 : 1.5; }
    } else if (this.state === "backstep") {
      // a light hop back, not a slide
      const u = 1 - Math.max(0, this.t) / 0.5;
      this.pos.x -= Math.sin(toP) * 9 * dt * ft; this.pos.z -= Math.cos(toP) * 9 * dt * ft;
      this.hop = Math.sin(u * Math.PI) * 0.7;
      if (this.t <= 0) { this.hop = 0; this.state = "idle"; this.t = 0.6; }
    }
  }
  // Ryu's stances, eased by the skeleton blend
  ryuPose() {
    const r = this.rig, [aL, aR] = r.arms, [lL, lR] = r.legs, t = this.G.time, st = this.state;
    const u = this.t;
    aL.rotation.set(-1.25, 0, -0.55); aR.rotation.set(-1.0, 0, 0.5);
    r.torso.rotation.set(0.08, -0.25, 0); r.head.rotation.set(0, 0.2, 0);
    r.body.rotation.set(0, 0, 0);
    if (!this.moving) { lL.rotation.set(-0.35, 0, -0.18); lR.rotation.set(0.25, 0, 0.18); r.body.position.y = -0.1 + Math.sin(t * 5) * 0.03; }
    if (st === "windup") { aR.rotation.set(0.5, 0, 0.6); r.torso.rotation.y = -0.7; r.torso.rotation.x = -0.05; }
    else if (st === "strike") { aR.rotation.set(-1.6, 0, 0.05); aL.rotation.set(-0.3, 0, -0.4); r.torso.rotation.y = 0.5; r.torso.rotation.x = 0.2; }
    else if (st === "recover") { aR.rotation.set(-1.1, 0, 0.3); r.torso.rotation.y = 0.1; }
    else if (st === "aim") { r.body.rotation.x = 0.2; r.body.position.y = -0.25; lL.rotation.set(-0.8, 0, -0.2); lR.rotation.set(0.6, 0, 0.2); aL.rotation.set(0.4, 0, -0.4); aR.rotation.set(0.4, 0, 0.4); }
    else if (st === "dash") { r.body.rotation.x = 0.55; aL.rotation.set(0.9, 0, -0.3); aR.rotation.set(0.9, 0, 0.3); lL.rotation.set(-1.1, 0, 0); lR.rotation.set(0.8, 0, 0); }
    else if (st === "tired") { r.torso.rotation.x = 0.6; r.head.rotation.x = 0.2; aL.rotation.set(-0.6, 0, -0.1); aR.rotation.set(-0.6, 0, 0.1); lL.rotation.set(-0.4, 0, -0.1); lR.rotation.set(-0.4, 0, 0.1); r.body.position.y = -0.2 + Math.sin(t * 7) * 0.04; }
    else if (st === "cast") { const c = 1 - Math.max(0, u) / 0.9; aL.rotation.set(-0.5 - c * 0.2, 0, 0.35); aR.rotation.set(-0.5 - c * 0.2, 0, -0.35); r.torso.rotation.y = -0.8 * c; r.torso.rotation.x = 0.1; r.body.position.y = -0.2 * c; }
    else if (st === "release") { aL.rotation.set(-1.55, 0, 0.12); aR.rotation.set(-1.55, 0, -0.12); r.torso.rotation.y = 0.25; }
    if (this.hop) r.body.position.y += this.hop;
  }
  telegraph() {
    const G = this.G;
    if (this.line) G.scene.remove(this.line);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.55, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -this.dashDir;
    m.position.set(this.pos.x + Math.sin(this.dashDir) * 8, this.pos.y + 1.15, this.pos.z + Math.cos(this.dashDir) * 8);
    G.scene.add(m); this.line = m;
  }
  // The Porcelain King fights in three rounds. He belly-flops, lobs sludge, and snaps his lid at you.
  // From round two he also whips toilet paper across the floor, flushes the whole court, and calls
  // raccoons out of the pipes. Every big move ends with an opening. Hit him enough and he reels: plunge him.
  kingSetup() {
    const r = this.rig;
    this.phaseN = 1; this.poise = 0; this.hopY = 0; this.vy = 0; this.sq = 1; this.sqv = 0; this.rise = 0; this.mt = 0;
    this.flushCd = 6; this.summonCd = 10; this.streamLen = 0; this.exposed = false; this.pendingPhase = 0; this.talk = 0; this.flinchT = 0;
    this.lidU = kingLid(r) || { uLid: { value: 0 } };
    this.kmats = [];
    r.body.traverse((o) => { if (o.isMesh && !o.userData.outline && o.material.emissive) this.kmats.push(o.material); });
    // two rolls of toilet paper and the long streamers he whips around
    const paper = M.toon(0xf6f3ec);
    const rollGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 18), coreGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.92, 12);
    this.rolls = [-1, 1].map((s) => {
      const g = new THREE.Group();
      const roll = new THREE.Mesh(rollGeo, paper); roll.rotation.x = Math.PI / 2; g.add(roll);
      const core = new THREE.Mesh(coreGeo, M.toon(0x9a7a5a)); core.rotation.x = Math.PI / 2; g.add(core);
      g.position.set(s * 2.5, 0.9, 0.4); g.visible = false; r.root.add(g);
      return g;
    });
    const sg = new THREE.PlaneGeometry(1, 0.75, 24, 1).translate(0.5, 0, 0);
    this.streams = [-1, 1].map((s) => {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      m.position.set(s * 2.5, 0.55, 0.4); m.rotation.y = s > 0 ? 0 : Math.PI; m.visible = false; r.root.add(m);
      return m;
    });
    // dizzy stars over the crown
    this.stars = new THREE.Group(); this.stars.position.y = 7.7; this.stars.visible = false; r.root.add(this.stars);
    const starMat = M.toon(0xffe04a, { emissive: 0xffb000, emissiveIntensity: 0.9 }), starGeo = new THREE.OctahedronGeometry(0.3);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(starGeo, starMat); const a = (k / 3) * Math.PI * 2; s.position.set(Math.cos(a) * 1.5, Math.sin(k * 2) * 0.2, Math.sin(a) * 1.5); this.stars.add(s); }
    // a soft shadow on the floor while he is in the air, so you can see where he will come down
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0a20, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.visible = false; this.shadow.renderOrder = 1; this.G.scene.add(this.shadow);
  }
  kingReset() {
    const G = this.G;
    this.phaseN = 1; this.poise = 0; this.hopY = 0; this.vy = 0; this.rise = 0; this.streamLen = 0; this.exposed = false; this.pendingPhase = 0;
    this.flushCd = 6; this.summonCd = 10; this.last = null; this.hopMark = this.swirlM = this.sweepMark = null; this.yaw = 0;
    // his raccoons go home too
    for (const f of G.foes) if (f.boss === this && f.alive) { f.alive = false; f.gone = true; f.rig.root.visible = false; }
    if (G.plunge && G.plunge.b === this) { G.plunge = null; G.player.cine = null; }
  }
  poiseMax() { return [110, 130, 150][this.phaseN - 1]; }
  go(s, t) { this.state = s; this.t = t; this.mt = 0; }
  king(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards, ft = G.foeTime, ph = this.phaseN, st = this.state;
    const toP = Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    const front = Math.cos(toP - this.yaw) > 0.3;
    this.mt += dt * ft; this.flushCd -= dt * ft; this.summonCd -= dt * ft;
    this.talk = Math.max(0, this.talk - dt);
    // stop hitting him and he steadies himself again
    this.poiseT = (this.poiseT || 0) + dt;
    if (this.poiseT > 1.5 && !this.exposed) this.poise = Math.max(0, this.poise - 12 * dt);
    // a new round: he stops whatever he was doing and roars
    if (this.pendingPhase && !["air", "plunged", "rage", "intro"].includes(st)) {
      this.phaseN = this.pendingPhase; this.pendingPhase = 0;
      this.endMove(); this.exposed = false; this.roared = false; this.go("rage", 2.2);
      G.say(this, this.phaseN === 2 ? "You'll pay for that plumbing!" : "I AM THE THRONE!");
      G.kingPhase && G.kingPhase(this.phaseN);
      return;
    }
    // enough hits and he reels
    if (this.poise >= this.poiseMax() && ["idle", "recover", "gargle", "rear", "crouch", "stuck", "summon", "unroll"].includes(st)) {
      this.endMove(); this.stagger(2.8); G.ui.pop("Stagger!");
      return;
    }
    switch (st) {
      case "intro": face(2); this.talk = 1; if (this.t <= 0) this.go("idle", 0.8); break;
      case "idle":
        face(3.5);
        // he waddles after you between moves
        if (d > 10) this.stepToward(dt, 2.2 + ph * 0.5);
        if (this.t <= 0) this.pick(d, front);
        break;
      case "recover": face(2); if (this.t <= 0) this.go("idle", [0.7, 0.5, 0.35][ph - 1]); break;
      case "crouch": face(9); if (this.t <= 0) this.leap(); break;
      case "air":
        this.pos.x += this.hopVx * dt * ft; this.pos.z += this.hopVz * dt * ft;
        this.hopY += this.vy * dt * ft; this.vy -= 34 * dt * ft;
        if (this.hopY <= 0 && this.vy < 0) this.land();
        break;
      case "gargle":
        face(6);
        if (Math.random() < dt * 30) this.bowlFX("bubble");
        if (this.t <= 0) { this.go("volley", 0); this.left = [3, 5, 7][ph - 1]; this.shotN = 0; }
        break;
      case "volley":
        face(4);
        if (this.t <= 0 && this.left > 0) { this.spitOne(this.shotN++); this.left--; this.t = 0.13; }
        else if (this.left <= 0 && this.t <= 0) this.go("recover", [1.0, 0.8, 0.65][ph - 1]);
        break;
      case "rear":
        face(9);
        if (!this.glint && this.t < 0.24) { this.glint = true; const p = this.local(0, 5.4, 0.3); G.fx.spark(p.x, p.y, p.z, 0xffffff, 4, 1.6); G.sfx("glint"); }
        if (this.t <= 0) { this.go("lunge", 0.24); this.hitDone = false; G.sfx("chomp"); }
        break;
      case "lunge": {
        const sp = d > this.r + 1.2 ? 20 : 0;
        this.pos.x += Math.sin(this.yaw) * sp * dt * ft; this.pos.z += Math.cos(this.yaw) * sp * dt * ft;
        if (!this.hitDone && this.mt > 0.1) {
          this.hitDone = true;
          const f = this.local(0, 0, this.r * 0.8);
          if (Math.hypot(P.x - f.x, P.z - f.z) < 3.4 && Math.abs(P.y - this.pos.y) < 3) P.hurt(4, this.pos.x, this.pos.z, 13);
          G.shake(0.35); G.fx.dust(f.x, this.pos.y + 0.2, f.z, 10, 1.5);
        }
        if (this.t <= 0) this.go("stuck", [1.5, 1.25, 1.05][ph - 1]);
        break;
      }
      case "stuck": if (this.t <= 0) { G.sfx("pop"); this.go("recover", 0.35); } break;
      case "unroll":
        face(3);
        if (this.t <= 0) {
          this.go("whirl", ph === 3 ? 5.6 : 4.6);
          this.spinW = (ph === 3 ? 2.0 : 1.5) * (Math.random() < 0.5 ? 1 : -1); this.flipped = false; this.pauseT = 0;
          this.sweepMark = H.mark(this.pos.x, this.pos.z, 17.5, 0xfff2e0);
        }
        break;
      case "whirl": {
        // round three: he stops for a beat, then spins the other way
        if (ph === 3 && !this.flipped && this.t < 2.8) { this.flipped = true; this.pauseT = 0.5; this.spinW = -this.spinW; G.sfx("glint"); }
        if (this.pauseT > 0) this.pauseT -= dt * ft; else this.yaw += this.spinW * dt * ft;
        if (ph === 3 && d > 6) this.stepToward(dt, 1.6);
        this.streamLen = 15 * Math.min(1, this.mt / 0.6) * Math.min(1, this.t / 0.4);
        if (this.sweepMark) this.sweepMark.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z);
        // the paper hits anyone on the ground as it sweeps past. Jump it.
        if (this.streamLen > 3 && d > 2.5 && d < this.streamLen + 2.6 && P.state === "ground") {
          for (const s of [1, -1]) {
            const a = this.yaw + s * Math.PI / 2, off = Math.atan2(Math.sin(toP - a), Math.cos(toP - a));
            if (Math.abs(off) * d < 0.75) P.hurt(2, this.pos.x, this.pos.z, 8);
          }
        }
        if (this.t <= 0) { this.endMove(); this.stagger(2.0); G.say(this, "Whoa… the room is spinning…"); }
        break;
      }
      case "flushUp": face(2); if (this.t <= 0) { this.go("flush", 4.4); this.swirlM = H.swirl(this.pos.x, this.pos.z, 17); this.orbT = 0; } break;
      case "flush": {
        this.yaw += dt * 3 * ft;
        // everything gets pulled toward the drain; sprint or roll to get away
        const pull = 2.6 + 4.2 * Math.max(0, 1 - d / 22);
        if ((P.state === "ground" || P.state === "swim") && !G.plunge && d > 0.1) { P.pos.x -= Math.sin(toP) * pull * dt; P.pos.z -= Math.cos(toP) * pull * dt; }
        this.orbT -= dt * ft;
        if (this.orbT <= 0) {
          this.orbT = ph === 3 ? 0.28 : 0.4;
          H.shot({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.6, dmg: 1, life: 8, spiral: { cx: this.pos.x, cz: this.pos.z, y: this.pos.y + 0.9, a: Math.random() * 6.28, r: 16, w: 1.4, vr: 3.4 } });
        }
        if (Math.random() < dt * 20) this.bowlFX("bubble");
        if (d < this.r + 1.4) { P.hurt(4, this.pos.x, this.pos.z, 16); this.t = 0; }
        if (this.t <= 0) {
          this.endMove();
          H.ring(this.pos.x, this.pos.z, { dmg: 4, max: 26, speed: 13, h: 1.5, color: 0xb070ff });
          G.fx.splash(this.pos.x, this.pos.y + 3.5, this.pos.z, 0x7a3a9a, 40, 1.6);
          this.stagger(3.4); G.say(this, "Blub… I'm… clogged…");
        }
        break;
      }
      case "summon": face(3); if (this.t <= 0) { this.callRaccoons(); this.go("recover", 0.6); } break;
      case "dizzy": if (this.t <= 0) { this.exposed = false; this.poise = 0; this.go("recover", 0.5); } break;
      case "rage":
        if (!this.roared && this.mt > 0.9) {
          this.roared = true;
          H.ring(this.pos.x, this.pos.z, { dmg: 2, max: 22, speed: 17, h: 0.8, color: 0xff7a6a, knock: 12 });
          G.sfx("roar"); G.shake(0.9); G.punch(0.7);
          G.fx.splash(this.pos.x, this.pos.y + 3.5, this.pos.z, 0x7a3a9a, 30, 1.5);
        }
        if (this.t <= 0) this.go("idle", 0.4);
        break;
      case "plunged": break;
    }
  }
  // choose the next move: never the same one twice in a row, and the big ones come on a clock
  pick(d, front) {
    const ph = this.phaseN, G = this.G;
    if (ph >= 2 && this.flushCd <= 0 && this.last !== "flushUp") { this.flushCd = ph === 3 ? 20 : 26; return this.begin("flushUp"); }
    if (ph >= 2 && this.summonCd <= 0 && G.foes.filter((f) => f.alive && f.boss === this).length < 2) { this.summonCd = 28; return this.begin("summon"); }
    const opts = [["hop", d > 12 ? 4 : 2], ["spit", d > 7 ? 3 : 1.2]];
    if (d < 8.5 && front) opts.push(["rear", 4]);
    if (ph >= 2) opts.push(["unroll", 1.7]);
    const ok = opts.filter((o) => o[0] !== this.last);
    let roll = Math.random() * ok.reduce((s, o) => s + o[1], 0);
    for (const o of ok) { roll -= o[1]; if (roll <= 0) return this.begin(o[0]); }
    this.begin(ok[0][0]);
  }
  begin(m) {
    const ph = this.phaseN, G = this.G;
    this.last = m;
    if (m === "hop") { this.chain = ph; this.crouch(); }
    else if (m === "spit") { this.go("gargle", [0.85, 0.72, 0.6][ph - 1]); G.sfx("gargle"); }
    else if (m === "rear") { this.go("rear", [0.6, 0.52, 0.44][ph - 1]); this.glint = false; G.sfx("creak"); }
    else if (m === "unroll") { this.go("unroll", 0.8); G.sfx("tp"); G.say(this, "Two-ply!"); }
    else if (m === "flushUp") { this.go("flushUp", 1.0); G.say(this, "FLUSH. FLUSH."); G.sfx("flush"); }
    else if (m === "summon") { this.go("summon", 0.9); G.sfx("gurgle"); }
  }
  // stop a move cleanly: take away its markers and paper
  endMove() {
    const H = this.G.hazards;
    for (const k of ["hopMark", "swirlM", "sweepMark"]) if (this[k]) { H.unmark(this[k]); this[k] = null; }
    this.streamLen = 0;
    if (this.state === "air" || this.hopY > 0) { this.hopY = 0; this.vy = 0; }
  }
  stagger(t) { this.go("dizzy", t); this.exposed = true; this.poise = 0; this.G.sfx("stagger"); }
  // a point on the King, from his own left/up/forward
  local(x, y, z) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    return { x: this.pos.x + c * x + s * z, y: this.pos.y + this.hopY + (this.rise || 0) + y, z: this.pos.z - s * x + c * z };
  }
  bowlFX(kind) {
    const p = this.local((Math.random() - 0.5) * 1.6, 3.3, 1.1 + Math.random() * 0.6), G = this.G;
    if (kind === "bubble") G.fx.blobs.add(p.x, p.y, p.z, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 3, (Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.4, G.fx.col.set(0x9a5aba), 0.9, 0.5, 6);
  }
  crouch() {
    const G = this.G, P = G.player, C = this.center, lim = this.def.r - 5, ph = this.phaseN;
    let tx = P.x + P.vel.x * 0.35, tz = P.z + P.vel.z * 0.35;
    // no farther than one big hop, and never off the court
    let dx = tx - this.pos.x, dz = tz - this.pos.z; const dd = Math.hypot(dx, dz);
    if (dd > 20) { tx = this.pos.x + (dx / dd) * 20; tz = this.pos.z + (dz / dd) * 20; }
    dx = tx - C.x; dz = tz - C.z; const cd = Math.hypot(dx, dz);
    if (cd > lim) { tx = C.x + (dx / cd) * lim; tz = C.z + (dz / cd) * lim; }
    this.hopTo = { x: tx, z: tz };
    // hops in a chain wind up faster than the first
    const t = this.chain < ph ? 0.32 : [0.6, 0.5, 0.42][ph - 1];
    this.go("crouch", t);
    if (this.hopMark) G.hazards.unmark(this.hopMark);
    this.hopMark = G.hazards.mark(tx, tz, this.r + 1.2, 0xff4a2a, t + 1.0);
    G.sfx("gurgle");
  }
  leap() {
    const G = this.G, T = 1.0;
    this.vy = 17; this.hopY = 0.01;
    this.hopVx = (this.hopTo.x - this.pos.x) / T; this.hopVz = (this.hopTo.z - this.pos.z) / T;
    this.go("air", 0); this.sqv = 7;
    G.sfx("jump"); G.fx.dust(this.pos.x, this.pos.y + 0.2, this.pos.z, 12, this.r * 0.8);
  }
  land() {
    const G = this.G, P = G.player, H = G.hazards, ph = this.phaseN;
    this.hopY = 0; this.vy = 0;
    if (this.hopTo) { this.pos.x = this.hopTo.x; this.pos.z = this.hopTo.z; }
    if (this.hopMark) { H.unmark(this.hopMark); this.hopMark = null; }
    H.ring(this.pos.x, this.pos.z, { dmg: 4, max: 16 + ph * 3, speed: 12 + ph, h: 1.1, color: 0xd8a0ff });
    G.fx.dust(this.pos.x, this.pos.y + 0.2, this.pos.z, 26, this.r, 0xd8ccb0);
    G.fx.splash(this.pos.x, this.pos.y + 2.8, this.pos.z, 0x7a3a9a, 16, 1.1);
    this.sqv = -9;
    if (Math.hypot(P.x - this.pos.x, P.z - this.pos.z) < this.r + 0.8 && P.state === "ground") P.hurt(5, this.pos.x, this.pos.z, 14);
    this.chain--;
    if (this.chain > 0) this.crouch(); else this.go("recover", ph === 1 ? 1.1 : 1.35);
  }
  spitOne(k) {
    const G = this.G, P = G.player, H = G.hazards, C = this.center, lim = this.def.r - 1.5;
    let tx, tz;
    if (k === 0) { tx = P.x + P.vel.x * 0.9; tz = P.z + P.vel.z * 0.9; }
    else { const a = Math.random() * 6.28, rr = 2.5 + Math.random() * 6; tx = P.x + Math.cos(a) * rr; tz = P.z + Math.sin(a) * rr; }
    const dx = tx - C.x, dz = tz - C.z, cd = Math.hypot(dx, dz);
    if (cd > lim) { tx = C.x + (dx / cd) * lim; tz = C.z + (dz / cd) * lim; }
    const from = new THREE.Vector3().copy(this.local(0, 3.6, 1.6));
    const T = 1.05 + k * 0.07, g = 24, vel = new THREE.Vector3((tx - from.x) / T, 0, (tz - from.z) / T);
    vel.y = (G.groundAt(tx, tz, 999) - from.y + 0.5 * g * T * T) / T;
    H.shot({ pos: from, vel, r: 0.75, dmg: 2, gravity: g, target: { x: tx, z: tz }, onLand: (x, z) => H.pool(x, z, 2.1, 6) });
    G.sfx("spit"); G.fx.splash(from.x, from.y, from.z, 0x7a3a9a, 5, 0.5); this.sqv -= 2.5;
  }
  callRaccoons() {
    const G = this.G, C = G.world.court, n = this.phaseN === 3 ? 3 : 2;
    const alive = G.foes.filter((f) => f.alive && f.boss === this).length;
    for (let k = 0; k < Math.min(n, 3 - alive); k++) {
      const p = C.pipes[(Math.random() * C.pipes.length) | 0];
      const a = Math.atan2(p.x - C.x, p.z - C.z), x = C.x + Math.sin(a) * (C.r - 2.5), z = C.z + Math.cos(a) * (C.r - 2.5);
      const f = G.spawnFoe("raccoon", x, z, { x: C.x, z: C.z }); f.boss = this; f.alert();
      G.fx.splash(p.mx, p.my, p.mz, 0x7a3a9a, 14, 0.8); G.fx.puff(x, f.pos.y + 0.8, z, 0x9a6aba, 10);
    }
    G.say(this, "Servants! Unclog me!");
  }
  // the plunge: each pump takes a chunk; the last one spits you out
  plungeHit(dmg, last) {
    const G = this.G;
    this.hp -= dmg; this.flash = 0.12; this.sqv = last ? -12 : -7;
    const p = this.local(0, 3.4, 1.2);
    G.fx.splash(p.x, p.y, p.z, 0x7a3a9a, last ? 40 : 14, last ? 1.8 : 1);
    G.fx.spark(p.x, p.y + 0.6, p.z, 0xfff0c0, 8, last ? 2 : 1.3);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.exposed = false; G.bossDown(this); return; }
    const f = this.hp / this.maxHp, want = f <= 0.33 ? 3 : f <= 0.66 ? 2 : 1;
    if (want > this.phaseN) this.pendingPhase = Math.max(this.pendingPhase, want);
  }
  plungeEnd() { this.exposed = false; this.poise = 0; this.go("recover", 0.9); }
  kingDeath(dt) {
    const G = this.G, r = this.rig;
    this.deathT = (this.deathT || 0) + dt;
    const u = this.deathT;
    this.endMove(); this.stars.visible = this.shadow.visible = false;
    for (const s of this.streams) s.visible = false;
    for (const g of this.rolls) g.visible = false;
    if (u < 1.7) {
      // he shakes, cracks, and flashes
      r.root.position.set(this.pos.x + (Math.random() - 0.5) * 0.25, this.pos.y + this.rise, this.pos.z + (Math.random() - 0.5) * 0.25);
      r.body.rotation.z = Math.sin(u * 40) * 0.06;
      this.lidU.uLid.value = 0.3 + Math.abs(Math.sin(u * 18)) * 0.6;
      for (const m of this.kmats) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.2 + u * 0.35; }
      if (Math.random() < dt * 14) { const p = this.local((Math.random() - 0.5) * 3, 1 + Math.random() * 5, (Math.random() - 0.5) * 3); G.fx.spark(p.x, p.y, p.z, 0xffffff, 5, 1.2); G.sfx("crack"); }
    } else if (!this.burst) {
      this.burst = true;
      const p = this.local(0, 3.5, 0);
      G.fx.splash(p.x, p.y, p.z, 0x7a3a9a, 70, 2.2); G.fx.puff(p.x, p.y, p.z, 0xf4f4f4, 30); G.fx.spark(p.x, p.y, p.z, 0xffffff, 24, 3);
      G.shake(1); G.sfx("shatter"); G.punch(1);
    } else {
      // and then he flushes himself away
      const k = Math.min(1, (u - 1.7) / 1.1);
      r.root.rotation.y += dt * (4 + k * 16);
      r.root.scale.setScalar(Math.max(0.001, 1 - k));
      r.root.position.y = this.pos.y - k * 2;
      for (const m of this.kmats) m.emissiveIntensity = Math.max(0, 0.8 - k);
      if (k >= 1) r.root.visible = false;
    }
  }
  drawKing(dt) {
    const r = this.rig, G = this.G, t = G.time, st = this.state, ph = this.phaseN, U = this.lidU.uLid;
    let sq = 1 + Math.sin(t * 2.2) * 0.02, lean = 0, roll = Math.sin(t * 1.1) * 0.03, lid = 0.06 + Math.sin(t * 2.6) * 0.05, rise = 0, lidRate = 10;
    if (this.talk > 0) lid = 0.25 + Math.abs(Math.sin(t * 13)) * 0.35;
    switch (st) {
      case "crouch": sq = 0.74; lean = 0.12; lid = 0.35; break;
      case "air": sq = this.vy > 0 ? 1.14 : 1.04; lean = 0.18; lid = 0.1; break;
      case "gargle": lean = -0.3; lid = 0.18 + Math.sin(t * 34) * 0.14; sq = 1.05; break;
      case "volley": lean = -0.15; lid = -0.02; break;
      case "rear": lean = -0.34; sq = 1.1; lid = -0.04; rise = 0.3; break;
      case "lunge": lean = 0.32; sq = 0.95; lid = 1.2; lidRate = 40; break;
      case "stuck": lean = 0.36; lid = 1.2; lidRate = 40; roll = Math.sin(t * 40) * 0.035; sq = 0.96; break;
      case "unroll": rise = 0.6 * Math.min(1, this.mt / 0.8); sq = 1.06; break;
      case "whirl": rise = 0.6; lean = 0.05; roll = 0.05; lid = 0.3 + Math.sin(t * 8) * 0.2; break;
      case "flushUp": rise = 0.8 * Math.min(1, this.mt); lid = 0.4 + Math.sin(t * 20) * 0.3; sq = 1.08; break;
      case "flush": rise = 0.8; lid = 0.3 + Math.sin(t * 9) * 0.3; roll = Math.sin(t * 5) * 0.06; break;
      case "dizzy": lean = 0.12 + Math.sin(t * 2.3) * 0.06; roll = Math.sin(t * 3.1) * 0.14; lid = 0.55 + Math.sin(t * 1.7) * 0.1; sq = 0.94; break;
      case "rage": sq = 1.12 + Math.sin(t * 30) * 0.03; roll = Math.sin(t * 37) * 0.05; lean = -0.2; lid = 0.3 + Math.abs(Math.sin(t * 16)) * 0.6; rise = 0.4; break;
      case "plunged": lid = -0.02; break;
      case "summon": lean = -0.15; lid = 0.4 + Math.sin(t * 18) * 0.3; break;
    }
    if (this.flinchT > 0) { this.flinchT -= dt; lean += 0.12 * (this.flinchT / 0.18); }
    // a springy squash: landings and hits make him wobble like jelly
    this.sqv += ((sq - this.sq) * 240 - this.sqv * 13) * dt;
    this.sq = clamp(this.sq + this.sqv * dt, 0.55, 1.4);
    const k = 1 - Math.exp(-dt * 10), side = 1 / Math.sqrt(this.sq);
    r.body.scale.set(side, this.sq, side);
    r.body.rotation.x += (lean - r.body.rotation.x) * k; r.body.rotation.z += (roll - r.body.rotation.z) * k;
    U.value += (lid - U.value) * (1 - Math.exp(-dt * lidRate));
    this.rise = lerp(this.rise, rise, k);
    r.root.position.set(this.pos.x, this.pos.y + this.hopY + this.rise, this.pos.z);
    r.root.rotation.y = this.yaw;
    // white when hit, a red glow when he is angry
    const glow = this.flash > 0 ? 0.7 : st === "rage" ? 0.35 + Math.sin(t * 20) * 0.2 : ph === 3 ? 0.1 + Math.sin(t * 4) * 0.08 : 0;
    for (const m of this.kmats) { m.emissive.setHex(this.flash > 0 ? 0xffffff : 0xff2a1a); m.emissiveIntensity = Math.max(0, glow); }
    this.stars.visible = st === "dizzy";
    if (this.stars.visible) { this.stars.rotation.y = t * 3; this.stars.children.forEach((s, i) => { s.rotation.y = t * 5 + i; s.position.y = Math.sin(t * 4 + i * 2) * 0.2; }); }
    const tp = st === "unroll" || st === "whirl";
    for (const g of this.rolls) { g.visible = tp; g.children[0].rotation.y = g.children[1].rotation.y = t * 9; }
    this.streams.forEach((s, i) => { s.visible = this.streamLen > 0.3; s.scale.x = Math.max(0.01, this.streamLen); s.position.y = 0.55 - this.rise; s.rotation.x = Math.sin(t * 9 + i) * 0.15; });
    this.shadow.visible = this.hopY > 0.3;
    if (this.shadow.visible) { const s = this.r * Math.max(0.4, 1 - this.hopY / 14); this.shadow.scale.set(s, 1, s); this.shadow.position.set(this.pos.x, this.pos.y + 0.07, this.pos.z); }
  }
  stepToward(dt, sp) {
    const P = this.G.player, a = Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    this.pos.x += Math.sin(a) * sp * dt * this.G.foeTime; this.pos.z += Math.cos(a) * sp * dt * this.G.foeTime;
    this.moving = sp;
  }
}

/* ---------------- effects ---------------- */
// Every puff, splash, and spark comes from two fixed pools of painted points, so a big fight makes no garbage.
const PVERT = `attribute vec4 aCol; attribute float aSize; attribute float aKind; uniform float uScale;
varying vec4 vCol; varying float vKind;
void main() {
  vCol = aCol; vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.2, -mv.z);
}`;
const PFRAG = `varying vec4 vCol; varying float vKind;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y;
  float r = length(p), a; vec3 c = vCol.rgb;
  if (vKind < 0.5) {
    // a round blob, shaded like a little painted ball lit from above
    if (r > 1.0) discard;
    vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
    c *= 0.62 + 0.5 * max(0.0, dot(n, normalize(vec3(-0.35, 0.7, 0.6))));
    c += vec3(0.22) * pow(max(0.0, dot(n, normalize(vec3(-0.4, 0.55, 0.75)))), 12.0);
    a = smoothstep(1.0, 0.82, r);
  } else if (vKind < 1.5) {
    // a spark: a bright four-point star
    float s = max(1.0 - abs(p.x) * 7.0 - abs(p.y) * 0.9, 1.0 - abs(p.y) * 7.0 - abs(p.x) * 0.9);
    a = clamp(max(s, 1.0 - r * 2.2), 0.0, 1.0); c = mix(c, vec3(1.0), a * 0.5);
  } else {
    // a soft glow
    a = pow(max(0.0, 1.0 - r), 2.0);
  }
  a *= vCol.a;
  if (a < 0.02) discard;
  gl_FragColor = vec4(c, a);
}`;
class Pool {
  constructor(scene, n, blending) {
    this.n = n; this.i = 0; this.busy = false;
    this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 4); this.s = new Float32Array(n); this.k = new Float32Array(n);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.g = new Float32Array(n); this.s0 = new Float32Array(n); this.a0 = new Float32Array(n); this.grow = new Float32Array(n); this.drag = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    const at = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    this.attrs = [at(this.p, 3), at(this.c, 4), at(this.s, 1), at(this.k, 1)];
    ["position", "aCol", "aSize", "aKind"].forEach((name, j) => geo.setAttribute(name, this.attrs[j]));
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending });
    this.obj = new THREE.Points(geo, this.mat);
    this.obj.frustumCulled = false; this.obj.renderOrder = 3;
    scene.add(this.obj);
  }
  add(x, y, z, vx, vy, vz, size, col, alpha, life, grav = 0, kind = 0, grow = 0, drag = 0) {
    const i = this.i, j = i * 3, q = i * 4;
    this.i = (i + 1) % this.n;
    this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z;
    this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz;
    this.c[q] = col.r; this.c[q + 1] = col.g; this.c[q + 2] = col.b; this.c[q + 3] = alpha;
    this.s[i] = this.s0[i] = size; this.a0[i] = alpha; this.life[i] = this.max[i] = life;
    this.g[i] = grav; this.k[i] = kind; this.grow[i] = grow; this.drag[i] = drag;
    this.busy = true;
  }
  update(dt) {
    if (!this.busy) return;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      const L = (this.life[i] -= dt);
      if (L <= 0) { this.s[i] = 0; this.c[i * 4 + 3] = 0; continue; }
      any = true;
      const j = i * 3, dg = Math.exp(-this.drag[i] * dt);
      this.v[j] *= dg; this.v[j + 2] *= dg; this.v[j + 1] = this.v[j + 1] * dg - this.g[i] * dt;
      this.p[j] += this.v[j] * dt; this.p[j + 1] += this.v[j + 1] * dt; this.p[j + 2] += this.v[j + 2] * dt;
      const u = L / this.max[i];
      this.s[i] = this.s0[i] * (this.grow[i] ? 1 + (1 - u) * this.grow[i] : 0.35 + 0.65 * u);
      this.c[i * 4 + 3] = this.a0[i] * Math.min(1, u * 2.5);
    }
    for (const a of this.attrs) a.needsUpdate = true;
    this.busy = any;
  }
}
const R = Math.random;
export class FX {
  constructor(G) {
    this.G = G; this.list = [];
    this.blobs = new Pool(G.scene, 900, THREE.NormalBlending);
    this.glow = new Pool(G.scene, 400, THREE.AdditiveBlending);
    this.col = new THREE.Color(); this.size = new THREE.Vector2();
  }
  // a little cloud of dust or smoke
  puff(x, y, z, color = 0xffffff, n = 8) {
    const c = this.col.set(color);
    for (let k = 0; k < n; k++) this.blobs.add(x, y, z, (R() - 0.5) * 6, R() * 5, (R() - 0.5) * 6, 1.1 + R() * 0.9, c, 0.95, 0.6 + R() * 0.3, 6, 2, 0.6, 1.5);
  }
  // sludge flung up and out; it falls back fast
  splash(x, y, z, color = 0x7a3a9a, n = 12, power = 1) {
    const c = this.col.set(color);
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, h = (2 + R() * 4) * power;
      this.blobs.add(x, y, z, Math.cos(a) * h, (4 + R() * 6) * power, Math.sin(a) * h, (0.35 + R() * 0.55) * Math.sqrt(power), c, 1, 0.7 + R() * 0.4, 22);
    }
  }
  // one drop falling from something wet
  drip(x, y, z, color) { this.blobs.add(x, y, z, (R() - 0.5) * 0.6, -0.5, (R() - 0.5) * 0.6, 0.18 + R() * 0.15, this.col.set(color), 0.9, 0.4, 14); }
  // a puff of dust pushed along the ground in one direction
  kick(x, y, z, dx, dz, color = 0xd8ccb0) { this.blobs.add(x, y, z, dx * 3, 1 + R() * 1.5, dz * 3, 1.3 + R() * 1.0, this.col.set(color), 0.7, 0.45 + R() * 0.2, 2, 2, 1.2, 3); }
  // dust thrown out in a ring, for landings and slams
  dust(x, y, z, n = 12, r = 1, color = 0xd8ccb0) {
    const c = this.col.set(color);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.28 + R() * 0.4, s = 3 + R() * 4;
      this.blobs.add(x + Math.cos(a) * r, y, z + Math.sin(a) * r, Math.cos(a) * s, 0.6 + R() * 1.4, Math.sin(a) * s, 1.8 + R() * 1.4, c, 0.8, 0.6 + R() * 0.3, 1.5, 2, 1.4, 3);
    }
  }
  // the hit: a flash where the blow lands, and fast little stars
  spark(x, y, z, color = 0xfff2c0, n = 6, power = 1) {
    const c = this.col.set(color);
    this.glow.add(x, y, z, 0, 0, 0, 2.4 * power, c, 1, 0.12, 0, 1, 0.8);
    this.glow.add(x, y, z, 0, 0, 0, 3.4 * power, c, 0.5, 0.2, 0, 2, 0.5);
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, e = (R() - 0.3) * 1.8, s = (7 + R() * 7) * power;
      this.glow.add(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s, 0.35 + R() * 0.3, c, 1, 0.18 + R() * 0.14, 10, 1, 0, 5);
    }
  }
  // a soft light that swells and fades
  flare(x, y, z, color, size = 3, life = 0.3) { this.glow.add(x, y, z, 0, 0, 0, size, this.col.set(color), 0.8, life, 0, 2, 0.6); }
  bang(x, y, z) {
    if (!this.bangTex) {
      const c = document.createElement("canvas"); c.width = 32; c.height = 64;
      const k = c.getContext("2d"); k.fillStyle = "#ffd84a"; k.strokeStyle = "#3a1a00"; k.lineWidth = 5; k.font = "bold 56px sans-serif"; k.textAlign = "center"; k.strokeText("!", 16, 54); k.fillText("!", 16, 54);
      this.bangTex = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bangTex, depthTest: false }));
    s.scale.set(0.6, 1.2, 1); s.position.set(x, y, z); this.G.scene.add(s);
    this.list.push({ m: s, v: new THREE.Vector3(0, 1.5, 0), life: 0.7 });
  }
  update(dt) {
    // points are sized in world units: turn that into pixels for this screen
    const G = this.G;
    G.renderer.getDrawingBufferSize(this.size);
    const sc = this.size.y / (2 * Math.tan((G.camera.fov * Math.PI) / 360));
    this.blobs.mat.uniforms.uScale.value = this.glow.mat.uniforms.uScale.value = sc;
    this.blobs.update(dt); this.glow.update(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.life <= 0) { G.scene.remove(p.m); p.m.material.dispose(); this.list.splice(i, 1); }
    }
  }
}

export function spawnPlan(world) {
  // where critters live
  const r = rng(404), out = [];
  world.camps.forEach((c, i) => {
    const north = c.z < -250;
    const n = 3 + (i % 2);
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; out.push({ type: "raccoon", x: c.x + Math.cos(a) * 6, z: c.z + Math.sin(a) * 6, home: { x: c.x, z: c.z }, camp: i }); }
    if (north || i % 3 === 2) out.push({ type: "bear", x: c.x + 10, z: c.z - 6, home: { x: c.x, z: c.z }, camp: i });
  });
  // geese along the shore
  let geese = 0;
  for (let t = 0; t < 400 && geese < 7; t++) {
    const a = r() * 6.28, d = 230 + r() * 110, x = Math.cos(a) * d, z = -40 + Math.sin(a) * d, h = world.height(x, z);
    if (h > 1.8 && h < 4 && Math.hypot(x - world.cottage.x, z - world.cottage.z) > 70) { geese++; for (let k = 0; k < 3; k++) out.push({ type: "goose", x: x + (r() - 0.5) * 6, z: z + (r() - 0.5) * 6, home: { x, z } }); }
  }
  // bears in the north and west, moose in the meadows
  for (const [x, z] of [[-250, -250], [250, -420], [-460, -330], [-640, 120]]) out.push({ type: "bear", x, z, home: { x, z } });
  for (const [x, z] of [[420, 320], [560, 120], [300, -80], [-100, -300]]) if (world.height(x, z) > 2) out.push({ type: "moose", x, z, home: { x, z } });
  return out;
}
