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
    this.flash = 0.15;
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
    r.body.rotation.x = this.state === "windup" ? -0.35 : this.state === "strike" ? 0.3 : 0;
    if (r.root.userData.wings) r.root.userData.wings.forEach((w, i) => (w.rotation.z = Math.sin(G.time * (this.type === "skeeter" ? 60 : 8)) * 0.6 * (i ? 1 : -1) * (this.type === "goose" && this.state !== "chase" && this.state !== "strike" ? 0.1 : 1)));
    if (r.root.userData.tail) r.root.userData.tail.rotation.y = Math.sin(G.time * 4 + this.phase) * 0.3;
    // painted models are one piece: they waddle, bob, and lean instead of moving each leg
    if (r.glb) { const m = Math.min(1, Math.abs(speed) * 0.2); r.body.rotation.z = Math.sin(this.phase) * 0.09 * m; r.body.position.y += Math.abs(Math.sin(this.phase)) * 0.05 * m; }
    if (r.head && this.type === "goose") r.head.rotation.x = this.state === "chase" || this.state === "strike" ? 0.9 : Math.sin(G.time + this.phase) * 0.2;
    tint(r.root, this.flash > 0);
  }
}

// flash white when hit
function tint(root, on) {
  if (root.userData.lit === on) return;
  root.userData.lit = on;
  root.traverse((o) => { if (o.isMesh && !o.userData.outline && o.material.emissive) { if (on) { o.userData.m0 = o.material; o.material = o.material.clone(); o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.8; } else if (o.userData.m0) { o.material = o.userData.m0; } } });
}
function turnTo(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); }

/* ---------------- shots and shockwaves ---------------- */
export class Hazards {
  constructor(G) { this.G = G; this.shots = []; this.rings = []; this.pools = []; this.marks = []; }
  shot(o) {
    const m = o.mesh || new THREE.Mesh(new THREE.SphereGeometry(o.r, 10, 8), new THREE.MeshBasicMaterial({ color: o.color || 0x6a2a7a }));
    m.position.copy(o.pos); this.G.scene.add(m);
    const s = { gravity: 0, life: 6, ...o, mesh: m };
    this.shots.push(s);
    if (o.gravity && o.target) { const mark = this.mark(o.target.x, o.target.z, o.r * 1.6, 0xff4a2a); s.markObj = mark; }
    return s;
  }
  mark(x, z, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, this.G.groundAt(x, z, 999) + 0.15, z); this.G.scene.add(m);
    return m;
  }
  ring(x, z, o = {}) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 6, 40), new THREE.MeshBasicMaterial({ color: o.color || 0xffe08a, transparent: true, opacity: 0.85 }));
    m.rotation.x = Math.PI / 2; const y = this.G.groundAt(x, z, 999) + 0.3; m.position.set(x, y, z); this.G.scene.add(m);
    this.rings.push({ x, z, y, r: 1, speed: o.speed || 14, max: o.max || 22, dmg: o.dmg || 4, mesh: m, hit: false });
    this.G.sfx("slam"); this.G.shake(0.5);
  }
  pool(x, z, r = 2.2, life = 8) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshBasicMaterial({ color: 0x5a2a6a, transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, this.G.groundAt(x, z, 999) + 0.12, z); this.G.scene.add(m);
    this.pools.push({ x, z, r, life, mesh: m, tick: 0 });
  }
  clear() { for (const l of [this.shots, this.rings, this.pools]) { for (const s of l) { this.G.scene.remove(s.mesh); if (s.markObj) this.G.scene.remove(s.markObj); } l.length = 0; } }
  update(dt) {
    const G = this.G, P = G.player, ft = G.foeTime;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.vel.y -= s.gravity * dt * ft;
      s.pos.addScaledVector(s.vel, dt * ft);
      s.mesh.position.copy(s.pos);
      if (s.spin) s.mesh.rotation.y += dt * 12;
      const hitP = Math.hypot(P.x - s.pos.x, P.z - s.pos.z) < s.r + 0.5 && s.pos.y > P.y - 0.3 && s.pos.y < P.y + 2.2;
      const g = G.groundAt(s.pos.x, s.pos.z, s.pos.y + 1);
      let done = s.life <= 0;
      if (hitP) { P.hurt(s.dmg, s.pos.x - s.vel.x, s.pos.z - s.vel.z, 8); done = true; }
      if (s.pos.y <= g) { done = true; if (s.onLand) s.onLand(s.pos.x, s.pos.z); }
      if (done) { G.scene.remove(s.mesh); if (s.markObj) G.scene.remove(s.markObj); G.fx.puff(s.pos.x, s.pos.y, s.pos.z, s.color || 0x6a2a7a); this.shots.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt * ft;
      r.mesh.scale.set(r.r, r.r, 1);
      r.mesh.material.opacity = 0.85 * (1 - r.r / r.max);
      const d = Math.hypot(P.x - r.x, P.z - r.z);
      const grounded = P.state === "ground" && P.y - r.y < 0.9;
      if (!r.hit && Math.abs(d - r.r) < 0.9 && grounded) { r.hit = true; P.hurt(r.dmg, r.x, r.z, 9); }
      if (r.r >= r.max) { G.scene.remove(r.mesh); this.rings.splice(i, 1); }
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt; p.tick -= dt;
      p.mesh.material.opacity = Math.min(0.85, p.life);
      if (p.tick <= 0 && Math.hypot(P.x - p.x, P.z - p.z) < p.r && P.state === "ground" && P.y < p.mesh.position.y + 1) { p.tick = 1; P.hurt(1, p.x, p.z, 2); }
      if (p.life <= 0) { G.scene.remove(p.mesh); this.pools.splice(i, 1); }
    }
  }
}

/* ---------------- bosses ---------------- */
export const BOSS_STATS = {
  gabe: { hp: 220, r: 1.6, lines: ["You hear that? That's my buddy.", "These are MY mountains.", "Bears listen to me. You don't."] },
  christian: { hp: 180, r: 1.4, lines: ["Pick a card. Any card.", "Now you see me.", "The cards told me you'd lose."] },
  ryu: { hp: 200, r: 1.4, lines: ["My turn.", "You call that a plunger?", "Down here, I make the rules."] },
  king: { hp: 420, r: 4.5, lines: ["Who clogged me?", "Bow to the throne.", "Flush. FLUSH."] },
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
  }
  get x() { return this.pos.x; } get z() { return this.pos.z; }
  get T() { return { h: this.id === "king" ? 9 : 4, r: this.r }; }
  reset() {
    this.hp = this.maxHp; this.active = false; this.state = "wait"; this.pos.set(this.center.x, this.G.groundAt(this.center.x, this.center.z, 999), this.center.z);
    this.clones.forEach((c) => this.G.scene.remove(c.rig.root)); this.clones = []; this.summoned = false;
    this.G.hazards.clear();
    if (this.line) { this.G.scene.remove(this.line); this.line = null; }
    this.G.bossLeft(this);
  }
  hurt(dmg, fx, fz, knock) {
    if (!this.alive || !this.active) return;
    if (this.state === "vanish") return;
    this.hp -= dmg; this.flash = 0.15; this.hitsTaken++;
    this.G.sfx("bonk");
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.G.bossDown(this); }
    // after a few hits, get out of the way
    if (this.id === "christian" && this.hitsTaken % 4 === 0 && this.alive) { this.state = "vanish"; this.t = 0.5; }
    if (this.id === "ryu" && this.hitsTaken % 4 === 0 && this.state === "idle") { this.state = "backstep"; this.t = 0.4; }
  }
  update(dt) {
    const G = this.G, P = G.player;
    if (!this.alive) { this.rig.root.rotation.x = lerp(this.rig.root.rotation.x, -1.4, dt * 3); return; }
    const dC = Math.hypot(P.x - this.center.x, P.z - this.center.z);
    if (!this.active) {
      this.idleAnim(dt);
      if (dC < this.def.r + 6 && !P.dead && Math.abs(P.y - this.pos.y) < 15) { this.active = true; this.state = "intro"; this.t = 2.6; G.bossIntro(this); }
      return;
    }
    if (dC > this.def.r + 60 || P.dead) { this.reset(); return; }
    this.t -= dt * G.foeTime;
    this.flash = Math.max(0, this.flash - dt);
    const half = this.hp < this.maxHp / 2;
    const d = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    const face = (k = 6) => { this.yaw = turnTo(this.yaw, Math.atan2(P.x - this.pos.x, P.z - this.pos.z), dt * k); };
    this[this.id](dt, d, half, face);
    // keep inside the arena and on the ground
    const cx = this.pos.x - this.center.x, cz = this.pos.z - this.center.z, cd = Math.hypot(cx, cz), lim = this.def.r + 4;
    if (cd > lim) { this.pos.x = this.center.x + (cx / cd) * lim; this.pos.z = this.center.z + (cz / cd) * lim; }
    const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 2);
    if (this.id === "king" && this.state === "hop") { this.pos.y += this.vy * dt * G.foeTime; this.vy -= 30 * dt * G.foeTime; if (this.pos.y <= g && this.vy < 0) { this.pos.y = g; this.land(); } }
    else this.pos.y = g;
    // bump the player
    if (d < this.r + 0.6 && this.state !== "vanish") P.hurt(2, this.pos.x, this.pos.z, 10);
    this.draw(dt);
  }
  idleAnim(dt) { this.phase += dt; this.draw(dt); }
  draw(dt) {
    const r = this.rig;
    r.root.position.copy(this.pos); r.root.rotation.y = this.yaw;
    const t = this.G.time;
    if (r.legs.length) {
      const moving = ["walk", "chase", "dash"].includes(this.state);
      this.phase += dt * (moving ? 9 : 2);
      r.legs[0].rotation.x = moving ? Math.sin(this.phase) * 0.7 : 0; r.legs[1].rotation.x = moving ? -Math.sin(this.phase) * 0.7 : 0;
      r.arms[0].rotation.set(moving ? -Math.sin(this.phase) * 0.6 : Math.sin(t * 2) * 0.1, 0, -0.3);
      r.arms[1].rotation.set(0, 0, 0.3);
      if (this.state === "windup" || this.state === "raise") r.arms[1].rotation.set(-2.8, 0, 0.2);
      if (this.state === "slam" || this.state === "strike") r.arms[1].rotation.set(-0.3, 0, 0.2);
      if (this.state === "throw") r.arms[1].rotation.set(-2.2 + Math.max(0, this.t) * 4, 0, 0.2);
      if (this.state === "cast") { r.arms[0].rotation.set(-1.5, 0, -0.2); r.arms[1].rotation.set(-1.5, 0, 0.2); }
      r.body.position.y = Math.sin(t * 2) * 0.04;
    } else if (r.lid) {
      r.lid.rotation.x = -1.2 + Math.sin(t * 6) * (this.state === "spit" ? 0.5 : 0.08);
      r.body.scale.y = this.state === "hop" && this.vy > 0 ? 1.08 : this.state === "land" ? 0.9 : 1;
    }
    r.root.visible = this.state !== "vanish" || Math.floor(t * 20) % 2 === 0;
    if (r.apply) r.apply();
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
    for (const c of this.clones) if (c.alive) { c.yaw = turnTo(c.yaw, Math.atan2(P.x - c.pos.x, P.z - c.pos.z), dt * 6); c.rig.root.position.copy(c.pos); c.rig.root.rotation.y = c.yaw; if (c.rig.apply) c.rig.apply(); }
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
  ryu(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards;
    if (this.state === "intro") { face(); if (this.t <= 0) { this.state = "idle"; this.t = 0.8; } return; }
    if (this.state === "idle") {
      face(8);
      if (d > 9) this.stepToward(dt, 5); else if (d < 5) this.stepToward(dt, -3);
      if (this.t <= 0) {
        const roll = Math.random();
        if (d < 6) { this.state = "combo"; this.t = 0; this.combo = 0; }
        else if (roll < 0.5) { this.state = "aim"; this.t = half ? 0.4 : 0.6; this.dashDir = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.telegraph(); }
        else { this.state = "cast"; this.t = half ? 0.45 : 0.7; }
      }
    } else if (this.state === "aim") {
      if (this.t <= 0) { G.scene.remove(this.line); this.state = "dash"; this.t = 0.45; this.yaw = this.dashDir; this.dashHit = false; G.sfx("dash"); }
    } else if (this.state === "dash") {
      this.pos.x += Math.sin(this.dashDir) * 34 * dt * G.foeTime; this.pos.z += Math.cos(this.dashDir) * 34 * dt * G.foeTime;
      if (!this.dashHit && d < 2.4) { this.dashHit = true; P.hurt(4, this.pos.x, this.pos.z, 12); }
      if (this.t <= 0) { if (half && !this.again) { this.again = true; this.state = "aim"; this.t = 0.3; this.dashDir = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.telegraph(); } else { this.again = false; this.state = "idle"; this.t = 1.2; } }
    } else if (this.state === "cast") {
      face(10);
      if (this.t <= 0) {
        const a = this.yaw;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0x5ad8ff }));
        H.shot({ pos: new THREE.Vector3(this.pos.x + Math.sin(a) * 2.5, this.pos.y + 2.4, this.pos.z + Math.cos(a) * 2.5), vel: new THREE.Vector3(Math.sin(a) * 15, 0, Math.cos(a) * 15), r: 1.1, dmg: 4, mesh: ball, color: 0x5ad8ff, life: 3 });
        G.sfx("hadoken"); if (Math.random() < 0.5) G.say(this, "HA-DOKEN!");
        this.state = "idle"; this.t = half ? 0.9 : 1.4;
      }
    } else if (this.state === "combo") {
      face(10);
      if (this.t <= 0) {
        if (this.combo >= 3) { this.state = "idle"; this.t = 1.2; return; }
        this.combo++; this.t = half ? 0.32 : 0.45; this.state = "combo";
        this.stepToward(0.12, 20);
        if (d < 4) P.hurt(2, this.pos.x, this.pos.z, 7);
        G.sfx("swing");
      }
    } else if (this.state === "backstep") { this.stepToward(dt, -14); if (this.t <= 0) { this.state = "aim"; this.t = 0.4; this.dashDir = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.telegraph(); } }
  }
  telegraph() {
    const G = this.G;
    if (this.line) G.scene.remove(this.line);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.55, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -this.dashDir;
    m.position.set(this.pos.x + Math.sin(this.dashDir) * 8, this.pos.y + 1.15, this.pos.z + Math.cos(this.dashDir) * 8);
    G.scene.add(m); this.line = m;
  }
  // The King: hops and slams, spits sludge, calls raccoons. When hurt, he flushes: everything gets pulled in.
  king(dt, d, half, face) {
    const G = this.G, P = G.player, H = G.hazards;
    if (this.state === "intro") { face(2); if (this.t <= 0) { this.state = "idle"; this.t = 1; } return; }
    if (this.state === "idle") {
      face(3);
      if (this.t <= 0) {
        this.cycle++;
        if (half && this.cycle % 4 === 0) { this.state = "flush"; this.t = 4.5; G.say(this, "FLUSH. FLUSH."); G.sfx("flush"); this.swirl = H.mark(this.pos.x, this.pos.z, 18, 0x7a3a9a); }
        else if (this.cycle % 3 === 0 && G.foes.filter((f) => f.alive && f.boss === this).length < 4) { this.state = "summon"; this.t = 0.8; }
        else if (d > 12 || Math.random() < 0.5) { this.state = "hop"; this.vy = 16; this.hopDir = Math.atan2(P.x - this.pos.x, P.z - this.pos.z); this.hopSp = Math.min(d, 18) / 1.07; G.sfx("jump"); }
        else { this.state = "spit"; this.t = 0.7; }
      }
    } else if (this.state === "hop") {
      this.pos.x += Math.sin(this.hopDir) * this.hopSp * dt * G.foeTime; this.pos.z += Math.cos(this.hopDir) * this.hopSp * dt * G.foeTime;
    } else if (this.state === "land") { if (this.t <= 0) { this.state = "idle"; this.t = half ? 0.8 : 1.3; } }
    else if (this.state === "spit") {
      face(6);
      if (this.t <= 0) {
        for (let k = 0; k < (half ? 5 : 3); k++) {
          const tx = P.x + (Math.random() - 0.5) * 10, tz = P.z + (Math.random() - 0.5) * 10;
          const from = new THREE.Vector3(this.pos.x, this.pos.y + 5, this.pos.z);
          const T = 1.1 + k * 0.1, vel = new THREE.Vector3((tx - from.x) / T, 0, (tz - from.z) / T);
          vel.y = (G.groundAt(tx, tz, 999) - from.y + 0.5 * 24 * T * T) / T;
          H.shot({ pos: from, vel, r: 0.8, dmg: 2, gravity: 24, color: 0x6a2a7a, target: { x: tx, z: tz }, onLand: (x, z) => H.pool(x, z) });
        }
        G.sfx("spit");
        this.state = "idle"; this.t = 1.2;
      }
    } else if (this.state === "summon") {
      if (this.t <= 0) { for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28; const f = G.spawnFoe("raccoon", this.pos.x + Math.cos(a) * 9, this.pos.z + Math.sin(a) * 9); f.boss = this; f.alert(); } G.say(this, "Servants! Unclog me!"); this.state = "idle"; this.t = 1.5; }
    } else if (this.state === "flush") {
      const dx = this.pos.x - P.x, dz = this.pos.z - P.z, dd = Math.hypot(dx, dz) || 1;
      if (P.state === "ground" || P.state === "swim") { P.pos.x += (dx / dd) * 4.2 * dt; P.pos.z += (dz / dd) * 4.2 * dt; }
      this.rig.root.rotation.y += dt * 4;
      if (this.t <= 0) { if (this.swirl) G.scene.remove(this.swirl); H.ring(this.pos.x, this.pos.z, { dmg: 5, max: 30, speed: 16, color: 0xb070ff }); this.state = "idle"; this.t = 1.6; }
    }
  }
  land() { const G = this.G; this.state = "land"; this.t = 0.4; G.hazards.ring(this.pos.x, this.pos.z, { dmg: 4, max: 20, speed: 14, color: 0xc890ff }); G.hazards.pool(this.pos.x + (Math.random() - 0.5) * 8, this.pos.z + (Math.random() - 0.5) * 8, 2.6); }
  stepToward(dt, sp) {
    const P = this.G.player, a = Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    this.pos.x += Math.sin(a) * sp * dt * this.G.foeTime; this.pos.z += Math.cos(a) * sp * dt * this.G.foeTime;
  }
}

/* ---------------- effects ---------------- */
export class FX {
  constructor(G) { this.G = G; this.list = []; this.geo = new THREE.SphereGeometry(1, 6, 4); }
  puff(x, y, z, color = 0xffffff, n = 8) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      m.position.set(x, y, z); m.scale.setScalar(0.3 + Math.random() * 0.3);
      this.G.scene.add(m);
      this.list.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), life: 0.6 + Math.random() * 0.3 });
    }
  }
  bang(x, y, z) {
    const c = document.createElement("canvas"); c.width = 32; c.height = 64;
    const k = c.getContext("2d"); k.fillStyle = "#ffd84a"; k.strokeStyle = "#3a1a00"; k.lineWidth = 5; k.font = "bold 56px sans-serif"; k.textAlign = "center"; k.strokeText("!", 16, 54); k.fillText("!", 16, 54);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    s.scale.set(0.6, 1.2, 1); s.position.set(x, y, z); this.G.scene.add(s);
    this.list.push({ m: s, v: new THREE.Vector3(0, 1.5, 0), life: 0.7, keep: true });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      if (!p.keep) { p.v.y -= 6 * dt; p.m.scale.multiplyScalar(1 - dt * 1.5); p.m.material.opacity = Math.max(0, p.life); }
      if (p.life <= 0) { this.G.scene.remove(p.m); p.m.material.dispose(); this.list.splice(i, 1); }
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
