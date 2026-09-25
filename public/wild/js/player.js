// The hero: runs, jumps, climbs anything, glides under a beach umbrella, swims, and swings a plunger.
import * as THREE from "three";
import * as M from "./models.js";
import { clamp, lerp } from "./noise.js";

export const WEAPONS = {
  plunger: { name: "Plunger", dmg: 4, reach: 2.3, arc: 1.7, time: 0.3, dur: Infinity, knock: 5 },
  paddle: { name: "Canoe Paddle", dmg: 9, reach: 2.9, arc: 2.5, time: 0.52, dur: 24, knock: 10 },
  stick: { name: "Hockey Stick", dmg: 6, reach: 2.6, arc: 1.9, time: 0.24, dur: 30, knock: 6 },
  rod: { name: "Fishing Rod", dmg: 5, reach: 3.6, arc: 1.2, time: 0.32, dur: 28, knock: 4 },
  pan: { name: "Frying Pan", dmg: 12, reach: 2.1, arc: 1.7, time: 0.48, dur: 18, knock: 8, stun: true },
  golden: { name: "Golden Plunger", dmg: 16, reach: 2.6, arc: 2.1, time: 0.28, dur: 50, knock: 9 },
};
export const PERKS = [
  { name: "Tank Top", perk: "Hits 20% harder" },
  { name: "Fifty-One", perk: "One extra heart" },
  { name: "Shades", perk: "12% crit chance" },
  { name: "New Balance", perk: "25% more stamina" },
  { name: "Red Jersey", perk: "Runs 12% faster" },
];

const V = new THREE.Vector3(), N = new THREE.Vector3();

export class Player {
  constructor(G, friend) {
    this.G = G;
    this.friend = friend;
    this.rig = M.person(M.LOOKS[friend]);
    G.scene.add(this.rig.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.state = "ground";
    this.stamina = 100;
    this.staminaMax = 100;
    this.exhausted = false;
    this.staminaIdle = 0;
    this.maxHp = 12;
    this.hp = 12;
    this.bonusHp = 0;
    this.invuln = 0;
    this.roll = 0;
    this.lastRoll = -9;
    this.attack = null;
    this.combo = 0;
    this.comboT = 0;
    this.charge = 0;
    this.airT = 0;
    this.phase = 0;
    this.climb = null;
    this.lastSafe = new THREE.Vector3();
    this.safeT = 0;
    this.dmgMult = friend === 0 ? 1.2 : 1;
    this.crit = friend === 2 ? 0.12 : 0;
    this.speedMult = friend === 4 ? 1.12 : 1;
    this.weaponMesh = null;
    this.setWeapon("plunger");
  }
  get x() { return this.pos.x; } get y() { return this.pos.y; } get z() { return this.pos.z; }
  rigR() { return 0.45; }

  setWeapon(id) {
    if (this.weaponMesh) this.rig.grip.remove(this.weaponMesh);
    this.weaponMesh = M.weaponMesh(id);
    this.weaponMesh.rotation.x = Math.PI / 2;
    this.rig.grip.add(this.weaponMesh);
    this.weaponId = id;
  }
  get weapon() { return WEAPONS[this.weaponId]; }

  place(x, z, y) {
    const w = this.G.world;
    this.pos.set(x, y ?? this.G.groundAt(x, z, 999), z);
    this.vel.set(0, 0, 0);
    this.state = this.pos.y < -1.2 ? "swim" : "ground";
    if (this.pos.y > 0.5) this.lastSafe.copy(this.pos);
    this.climb = null;
    this.rig.glider.visible = false;
    this.roll = 0; this.attack = null;
    void w;
  }

  useStamina(n) {
    if (this.exhausted) return false;
    this.stamina -= n;
    this.staminaIdle = 0;
    if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.G.sfx("tired"); }
    return true;
  }

  hurt(q, fx, fz, knock = 6) {
    const G = this.G;
    if (this.invuln > 0 || G.cutscene || this.dead) return false;
    if (this.roll > 0) { G.perfectDodge(); return false; }
    if (G.abilities.grit && G.abilities.grit.charges > 0) {
      G.abilities.grit.charges--; G.sfx("block"); G.ui.toast("Gabe's Grit blocked it");
      if (G.abilities.grit.charges === 0) G.abilities.grit.cd = 60;
      this.invuln = 0.5; return false;
    }
    let dmg = q;
    if (this.bonusHp > 0) { const b = Math.min(this.bonusHp, dmg); this.bonusHp -= b; dmg -= b; }
    this.hp -= dmg;
    this.invuln = 0.9;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    this.vel.x = (dx / d) * knock; this.vel.z = (dz / d) * knock;
    if (this.state === "ground") { this.vel.y = 4; this.state = "air"; }
    if (this.state === "climb" || this.state === "glide") { this.state = "air"; this.climb = null; }
    this.attack = null; this.charge = 0;
    G.sfx("hurt"); G.shake(0.35); G.ui.flash();
    if (this.hp <= 0) { this.hp = 0; G.die(); }
    return true;
  }
  heal(q) { this.hp = Math.min(this.maxHp, this.hp + q); }

  update(dt, inp) {
    const G = this.G;
    if (this.dead) return;
    this.invuln = Math.max(0, this.invuln - dt);
    const cy = G.cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    let mx = inp.move.x, my = inp.move.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    const dx = rx * mx + fx * my, dz = rz * mx + fz * my;
    const dl = Math.hypot(dx, dz) || 1;
    const dir = { x: dx / dl, z: dz / dl, mag };
    if (G.cutscene || G.ui.modal) { dir.mag = 0; }

    // stamina comes back on the ground
    this.staminaIdle += dt;
    if ((this.state === "ground" || this.state === "roll") && this.staminaIdle > 0.45) {
      this.stamina = Math.min(this.staminaMax, this.stamina + dt * (this.exhausted ? 22 : 40));
      if (this.exhausted && this.stamina >= this.staminaMax) this.exhausted = false;
    }
    const act = !G.cutscene && !G.ui.modal;
    if (this.state === "ground") this.ground(dt, dir, inp, act);
    else if (this.state === "air") this.air(dt, dir, inp, act);
    else if (this.state === "glide") this.glide(dt, dir, inp, act);
    else if (this.state === "climb") this.climbing(dt, dir, inp, act);
    else if (this.state === "swim") this.swim(dt, dir, inp, act);
    this.animate(dt, dir);
  }

  canMove(nx, nz) {
    // push out of trees, rocks, buildings
    const G = this.G, r = 0.45;
    G.world.near(nx, nz, (c) => {
      const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), m = c.r + r;
      if (d < m && d > 0.0001) { nx = c.x + (ddx / d) * m; nz = c.z + (ddz / d) * m; }
    });
    let hitBox = null;
    for (const b of G.world.boxes) {
      if (b.walk && this.pos.y >= b.top - 0.7) continue;
      if (this.pos.y >= b.top - 0.25 || this.pos.y + 1.8 < b.y0) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = (nx - b.x) * c - (nz - b.z) * s, lz = (nx - b.x) * s + (nz - b.z) * c;
      const ex = b.hw + r, ez = b.hd + r;
      if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
        if (b.walk && b.top - this.pos.y < 0.7) continue;
        let px = lx, pz = lz;
        if (ex - Math.abs(lx) < ez - Math.abs(lz)) px = Math.sign(lx) * ex; else pz = Math.sign(lz) * ez;
        nx = b.x + px * c + pz * s; nz = b.z - px * s + pz * c;
        hitBox = b;
      }
    }
    return { x: nx, z: nz, box: hitBox };
  }

  startClimb(box) {
    if (this.exhausted || this.stamina <= 0) return false;
    this.state = "climb";
    this.climb = box ? { box } : { terrain: true };
    this.vel.set(0, 0, 0);
    this.attack = null;
    this.G.sfx("grab");
    return true;
  }

  ground(dt, dir, inp, act) {
    const G = this.G, w = G.world;
    if (this.roll > 0) {
      this.roll -= dt;
      this.vel.x = Math.sin(this.yaw) * 11; this.vel.z = Math.cos(this.yaw) * 11;
      if (this.roll <= 0) this.roll = 0;
    } else {
      const sprinting = act && inp.sprint && dir.mag > 0.2 && !this.exhausted && !this.attack && this.charge <= 0;
      if (sprinting) this.useStamina(dt * 22);
      let speed = (sprinting ? 10.5 : 6) * dir.mag * this.speedMult;
      if (this.attack) speed *= 0.25;
      if (this.charge > 0) speed *= 0.4;
      const k = 1 - Math.exp(-dt * 12);
      this.vel.x = lerp(this.vel.x, dir.x * speed, k);
      this.vel.z = lerp(this.vel.z, dir.z * speed, k);
      if (dir.mag > 0.1 && !this.attack) this.yaw = turn(this.yaw, Math.atan2(dir.x, dir.z), dt * 12);
    }
    this.sprinting = act && inp.sprint && dir.mag > 0.2 && !this.exhausted;
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const res = this.canMove(nx, nz);
    // steep ground ahead: grab on and climb
    w.normal(res.x, res.z, N);
    const uphill = -(N.x * dir.x + N.z * dir.z);
    if (N.y < 0.72 && dir.mag > 0.3 && act && this.roll <= 0) {
      if (uphill > 0.25 && this.startClimb(null)) return;
      if (uphill > 0) { res.x = this.pos.x; res.z = this.pos.z; }
    }
    if (res.box && res.box.climb && dir.mag > 0.4 && act && this.roll <= 0 && !this.attack) {
      const toBox = (res.box.x - this.pos.x) * dir.x + (res.box.z - this.pos.z) * dir.z;
      if (toBox > 0 && this.startClimb(res.box)) return;
    }
    this.pos.x = res.x; this.pos.z = res.z;
    const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y);
    // slide down very steep slopes
    if (N.y < 0.62 && g <= this.pos.y + 0.1) { this.vel.x += N.x * 20 * dt; this.vel.z += N.z * 20 * dt; }
    if (g < this.pos.y - 0.9) { this.state = "air"; this.airT = 0; this.vel.y = 0; return; }
    this.pos.y = g;
    if (g < -1.2) { this.enterSwim(); return; }
    this.safeT += dt;
    if (this.safeT > 1 && N.y > 0.8 && g > 0.5) { this.lastSafe.copy(this.pos); this.safeT = 0; }
    if (!act) return;
    if (inp.jump && this.roll <= 0 && !this.attack) { this.vel.y = 9.5; this.state = "air"; this.airT = 0; G.sfx("jump"); return; }
    if (inp.roll && this.roll <= 0 && !this.attack) { this.roll = 0.42; this.lastRoll = G.time; if (dir.mag > 0.1) this.yaw = Math.atan2(dir.x, dir.z); G.sfx("roll"); }
    this.combat(dt, inp, dir);
  }

  combat(dt, inp, dir) {
    const G = this.G, W = this.weapon;
    this.comboT -= dt;
    if (this.attack) {
      const a = this.attack;
      a.t += dt / (a.spin ? 0.5 : W.time);
      if (!a.hit && a.t > 0.35) { a.hit = true; G.meleeHit(this, a.spin); }
      if (a.t >= 1) { this.attack = null; this.comboT = 0.35; }
      return;
    }
    if (inp.attackHeld && this.charge >= 0) this.charge += dt; else if (!inp.attackHeld && this.charge > 0.5 && !this.exhausted) {
      this.charge = 0;
      if (this.useStamina(25)) { this.attack = { t: 0, spin: true, hit: false }; G.sfx("spin"); }
      return;
    } else this.charge = 0;
    if (inp.attack) {
      const t = G.autoAim(this, dir);
      if (t) this.yaw = Math.atan2(t.x - this.pos.x, t.z - this.pos.z);
      this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
      this.attack = { t: 0, spin: false, hit: false, n: this.combo };
      G.sfx("swing");
    }
  }

  air(dt, dir, inp, act) {
    const G = this.G;
    this.airT += dt;
    this.vel.y -= 26 * dt;
    const want = Math.max(5.5, Math.hypot(this.vel.x, this.vel.z));
    const k = 1 - Math.exp(-dt * 3);
    if (dir.mag > 0.1) { this.vel.x = lerp(this.vel.x, dir.x * want * dir.mag, k); this.vel.z = lerp(this.vel.z, dir.z * want * dir.mag, k); this.yaw = turn(this.yaw, Math.atan2(dir.x, dir.z), dt * 6); }
    const res = this.canMove(this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt);
    if (res.box && res.box.climb && act && dir.mag > 0.3 && this.vel.y < 4 && this.startClimb(res.box)) return;
    this.pos.x = res.x; this.pos.z = res.z;
    this.pos.y += this.vel.y * dt;
    const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    G.world.normal(this.pos.x, this.pos.z, N);
    if (N.y < 0.72 && this.pos.y - g < 0.6 && act && dir.mag > 0.3 && -(N.x * dir.x + N.z * dir.z) > 0.2 && this.startClimb(null)) return;
    if (this.pos.y <= g) {
      if (g < -1.2) { this.enterSwim(); return; }
      const vy = -this.vel.y;
      this.pos.y = g; this.state = "ground"; this.vel.y = 0;
      if (vy > 23) { const q = Math.min(40, Math.floor((vy - 23) / 3) + 2); G.sfx("thud"); this.hurt(q, this.pos.x, this.pos.z, 0); }
      else G.sfx("land");
      return;
    }
    if (this.pos.y < -1.0 && g < -1.2) { this.enterSwim(); return; }
    if (act && inp.jump && this.airT > 0.12 && !this.exhausted && this.stamina > 0) { this.state = "glide"; this.rig.glider.visible = true; G.sfx("glide"); }
  }

  glide(dt, dir, inp, act) {
    const G = this.G;
    let up = false;
    for (const u of G.world.updraft) if (Math.hypot(this.pos.x - u.x, this.pos.z - u.z) < u.r + 1.5 && this.pos.y < G.world.height(u.x, u.z) + 60) up = true;
    if (G.abilityLift > 0) up = true;
    this.vel.y = up ? Math.min(14, this.vel.y + 40 * dt) : Math.max(-2.6, this.vel.y - 20 * dt);
    const f = dir.mag > 0.1 ? dir : { x: Math.sin(this.yaw), z: Math.cos(this.yaw), mag: 0.6 };
    const sp = 9.5 * (0.5 + f.mag * 0.5);
    const k = 1 - Math.exp(-dt * 2.2);
    this.vel.x = lerp(this.vel.x, f.x * sp, k); this.vel.z = lerp(this.vel.z, f.z * sp, k);
    this.yaw = turn(this.yaw, Math.atan2(this.vel.x, this.vel.z), dt * 3);
    if (!up) this.useStamina(dt * 4.5);
    const res = this.canMove(this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt);
    this.pos.x = res.x; this.pos.z = res.z;
    this.pos.y += this.vel.y * dt;
    const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    const drop = () => { this.rig.glider.visible = false; };
    if (this.pos.y <= g) { drop(); if (g < -1.2) { this.enterSwim(); return; } this.pos.y = g; this.state = "ground"; this.vel.y = 0; G.sfx("land"); return; }
    if (this.pos.y < -1.0) { drop(); this.enterSwim(); return; }
    if (res.box && res.box.climb && dir.mag > 0.3) { drop(); if (this.startClimb(res.box)) return; }
    if ((act && inp.jump) || this.exhausted) { drop(); this.state = "air"; this.airT = 0.2; }
  }

  climbing(dt, dir, inp, act) {
    const G = this.G, w = G.world, c = this.climb;
    const up = act ? inp.move.y : 0, side = act ? inp.move.x : 0;
    const moving = Math.hypot(up, side) > 0.15;
    if (moving) this.useStamina(dt * 6);
    const letGo = () => { this.state = "air"; this.airT = 0.3; this.climb = null; };
    if (this.exhausted) { letGo(); this.vel.set(-Math.sin(this.yaw) * 2, 0, -Math.cos(this.yaw) * 2); return; }
    if (act && inp.roll) { letGo(); this.vel.set(-Math.sin(this.yaw) * 3, 0, -Math.cos(this.yaw) * 3); return; }
    // camera right, flattened onto the wall, decides which way "right" goes
    const cr = { x: Math.cos(G.cam.yaw), z: -Math.sin(G.cam.yaw) };
    const jumpBoost = act && inp.jump && this.useStamina(18) ? 2.4 : 0;
    if (jumpBoost) G.sfx("jump");
    if (c.terrain) {
      w.normal(this.pos.x, this.pos.z, N);
      let wx = -N.x, wz = -N.z; const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
      let sx = wz, sz = -wx; if (sx * cr.x + sz * cr.z < 0) { sx = -sx; sz = -sz; }
      const sp = 2.6 * (1 + jumpBoost);
      const vy = up + jumpBoost;
      let nx = this.pos.x + (wx * vy + sx * side) * sp * dt, nz = this.pos.z + (wz * vy + sz * side) * sp * dt;
      const res = this.canMove(nx, nz);
      this.pos.x = res.x; this.pos.z = res.z;
      this.pos.y = w.height(this.pos.x, this.pos.z);
      this.yaw = Math.atan2(wx, wz);
      w.normal(this.pos.x, this.pos.z, N);
      if (N.y > 0.76) { this.state = "ground"; this.climb = null; return; }
      if (this.pos.y < -1.2) { this.enterSwim(); return; }
    } else {
      const b = c.box, co = Math.cos(b.rot), si = Math.sin(b.rot);
      let lx = (this.pos.x - b.x) * co - (this.pos.z - b.z) * si, lz = (this.pos.x - b.x) * si + (this.pos.z - b.z) * co;
      // which face are we on
      const fxn = Math.abs(lx) / b.hw > Math.abs(lz) / b.hd;
      const off = 0.5;
      let tside;
      if (fxn) { lx = Math.sign(lx) * (b.hw + off); tside = { x: 0, z: -Math.sign(lx) }; } else { lz = Math.sign(lz) * (b.hd + off); tside = { x: Math.sign(lz), z: 0 }; }
      // tangent in world space
      let tx = tside.x * co + tside.z * si, tz = -tside.x * si + tside.z * co;
      if (tx * cr.x + tz * cr.z < 0) { tx = -tx; tz = -tz; }
      const sp = 3;
      this.pos.y += (up * sp + jumpBoost * 2.2) * dt * (jumpBoost ? 1.8 : 1);
      const wx = b.x + lx * co + lz * si, wz = b.z - lx * si + lz * co;
      this.pos.x = wx + tx * side * sp * dt; this.pos.z = wz + tz * side * sp * dt;
      // clamp to the face
      let cx = (this.pos.x - b.x) * co - (this.pos.z - b.z) * si, cz = (this.pos.x - b.x) * si + (this.pos.z - b.z) * co;
      if (fxn) cz = clamp(cz, -b.hd, b.hd); else cx = clamp(cx, -b.hw, b.hw);
      this.pos.x = b.x + cx * co + cz * si; this.pos.z = b.z - cx * si + cz * co;
      const nX = fxn ? Math.sign(cx) : 0, nZ = fxn ? 0 : Math.sign(cz);
      const onx = nX * co + nZ * si, onz = -nX * si + nZ * co;
      this.yaw = Math.atan2(-onx, -onz);
      if (this.pos.y >= b.top - 0.15) {
        // pull up onto the top
        this.pos.x -= onx * 1.4; this.pos.z -= onz * 1.4; this.pos.y = b.top;
        this.state = "ground"; this.climb = null; G.sfx("land");
        if (b.tower) G.reachedTowerTop(b.tower);
        return;
      }
      const g = w.height(this.pos.x, this.pos.z);
      if (this.pos.y <= g) { this.pos.y = g; this.state = "ground"; this.climb = null; }
    }
  }

  enterSwim() {
    this.state = "swim"; this.rig.glider.visible = false; this.climb = null; this.attack = null;
    this.vel.y = 0; this.G.sfx("splash");
  }
  swim(dt, dir, inp, act) {
    const G = this.G;
    const fast = act && inp.sprint && dir.mag > 0.2 && !this.exhausted;
    if (dir.mag > 0.2) this.useStamina(dt * (fast ? 16 : 4.5));
    if (this.exhausted) { G.drown(); return; }
    const sp = (fast ? 5.5 : 3.2) * dir.mag;
    const k = 1 - Math.exp(-dt * 4);
    this.vel.x = lerp(this.vel.x, dir.x * sp, k); this.vel.z = lerp(this.vel.z, dir.z * sp, k);
    if (dir.mag > 0.1) this.yaw = turn(this.yaw, Math.atan2(dir.x, dir.z), dt * 6);
    const res = this.canMove(this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt);
    this.pos.x = res.x; this.pos.z = res.z;
    const g = G.groundAt(this.pos.x, this.pos.z, 1.5);
    this.pos.y = -1.15 + Math.sin(G.time * 2) * 0.06;
    if (g > -1.1) { this.pos.y = g; this.state = "ground"; }
  }

  animate(dt, dir) {
    const r = this.rig, G = this.G;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (this.state === "swim" ? 5 : 3 + sp * 1.25);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const [lL, lR] = r.legs, [aL, aR] = r.arms;
    r.body.rotation.set(0, 0, 0); r.body.position.set(0, 0, 0);
    r.torso.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
    aL.rotation.set(0, 0, -0.18); aR.rotation.set(0, 0, 0.18);
    lL.rotation.set(0, 0, 0); lR.rotation.set(0, 0, 0);
    if (this.state === "ground") {
      if (this.roll > 0) {
        const t = 1 - this.roll / 0.42;
        r.body.rotation.x = t * Math.PI * 2; r.body.position.y = Math.sin(t * Math.PI) * 0.5 + 0.2;
        lL.rotation.x = lR.rotation.x = -1.2; aL.rotation.x = aR.rotation.x = -1.2;
      } else {
        const a = Math.min(1, sp / 6);
        lL.rotation.x = s * 0.9 * a; lR.rotation.x = -s * 0.9 * a;
        aL.rotation.x = -s * 0.8 * a; aR.rotation.x = s * 0.8 * a;
        r.body.position.y = Math.abs(c) * 0.08 * a + Math.sin(G.time * 2) * 0.01;
        r.torso.rotation.x = a * (this.sprinting ? 0.35 : 0.12);
      }
    } else if (this.state === "air") {
      lL.rotation.x = -0.6; lR.rotation.x = 0.3; aL.rotation.z = -1.2; aR.rotation.z = 1.2;
    } else if (this.state === "glide") {
      aL.rotation.z = -2.7; aR.rotation.z = 2.7; aL.rotation.x = aR.rotation.x = 0.2;
      lL.rotation.x = Math.sin(G.time * 3) * 0.2 + 0.2; lR.rotation.x = -Math.sin(G.time * 3) * 0.2 + 0.2;
      r.glider.rotation.z = Math.sin(G.time * 1.3) * 0.08;
    } else if (this.state === "climb") {
      const m = Math.hypot(this.vel.x, this.vel.z) + 1;
      const t = G.time * 5;
      aL.rotation.x = -2.6 + Math.sin(t) * 0.4 * m * 0.3; aR.rotation.x = -2.6 - Math.sin(t) * 0.4 * m * 0.3;
      lL.rotation.x = -0.5 + Math.sin(t) * 0.3; lR.rotation.x = -0.5 - Math.sin(t) * 0.3;
      r.torso.rotation.x = -0.1;
    } else if (this.state === "swim") {
      r.body.rotation.x = 1.1; r.body.position.y = 0.5;
      aL.rotation.x = -2 + s * 1.2; aR.rotation.x = -2 - s * 1.2;
      lL.rotation.x = c * 0.5; lR.rotation.x = -c * 0.5;
    }
    if (this.attack) {
      const t = this.attack.t, e = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      if (this.attack.spin) {
        r.body.rotation.y = t * Math.PI * 2; aR.rotation.set(-1.5, 0, 1.4);
      } else {
        const n = this.attack.n;
        if (n === 0) { aR.rotation.x = -2.6 + e * 3.4; aR.rotation.z = 0.4; }
        else if (n === 1) { aR.rotation.x = -1.4; aR.rotation.z = 1.8 - e * 3.4; r.torso.rotation.y = 0.6 - e * 1.2; }
        else { aR.rotation.x = -3 + e * 4; r.torso.rotation.x = e * 0.4; r.body.position.y += Math.sin(t * Math.PI) * 0.4; }
      }
    } else if (this.charge > 0.1) {
      aR.rotation.set(-1.4, 0, 1.6); r.torso.rotation.y = -0.8;
    }
    // blink while hurt
    r.root.visible = !(this.invuln > 0 && this.invuln < 0.9 && Math.floor(this.invuln * 20) % 2 === 0 && this.roll <= 0);
  }
}

function turn(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
