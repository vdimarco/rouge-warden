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
    if (this.state === "kayak") this.leaveKayak();
    if (this.fishing && this.G.fishing) this.G.fishing.end();
    this.pos.set(x, y ?? this.G.groundAt(x, z, 999), z);
    this.vel.set(0, 0, 0);
    this.state = this.pos.y < -1.2 ? "swim" : "ground";
    if (this.pos.y > 0.5) this.lastSafe.copy(this.pos);
    this.climb = null;
    this.rig.glider.visible = false;
    this.roll = 0; this.attack = null;
    // after a teleport the camera jumps too, so it never sweeps through hills or buildings
    if (this.G.cam) this.G.cam.snap = true;
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
    if (this.fishing && G.fishing) G.fishing.end("The fish got away");
    const dx = this.pos.x - fx, dz = this.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    if (this.state === "kayak") knock = 0;
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
    if ((this.state === "ground" || this.state === "roll" || this.state === "kayak") && this.staminaIdle > 0.45) {
      this.stamina = Math.min(this.staminaMax, this.stamina + dt * (this.exhausted ? 22 : 40));
      if (this.exhausted && this.stamina >= this.staminaMax) this.exhausted = false;
    }
    const act = !G.cutscene && !G.ui.modal;
    // while fishing you stand (or sit) still
    if (this.fishing) {
      this.vel.set(0, 0, 0); this.kSpeed = 0;
      if (this.state === "kayak") this.floatKayak(dt);
      this.safety(); this.animate(dt, dir); return;
    }
    if (this.state === "ground") this.ground(dt, dir, inp, act);
    else if (this.state === "air") this.air(dt, dir, inp, act);
    else if (this.state === "glide") this.glide(dt, dir, inp, act);
    else if (this.state === "climb") this.climbing(dt, dir, inp, act);
    else if (this.state === "swim") this.swim(dt, dir, inp, act);
    else if (this.state === "kayak") this.paddle(dt, dir, inp, act);
    this.safety();
    this.animate(dt, dir);
  }

  // Safety nets, so a bug elsewhere can never leave you in a broken spot.
  safety() {
    const G = this.G, w = G.world, p = this.pos;
    if (![p.x, p.y, p.z, this.vel.x, this.vel.y, this.vel.z, this.yaw].every(Number.isFinite)) {
      this.vel.set(0, 0, 0); this.yaw = 0; this.place(this.lastSafe.x, this.lastSafe.z); return;
    }
    // an invisible wall at the edge of the world
    const E = 770;
    if (Math.abs(p.x) > E || Math.abs(p.z) > E) { p.x = Math.max(-E, Math.min(E, p.x)); p.z = Math.max(-E, Math.min(E, p.z)); this.vel.x *= -0.2; this.vel.z *= -0.2; }
    // never under the ground
    if (this.state === "kayak") { if (p.y < -0.3 || p.y > 0.3) p.y = 0; }
    else if (this.state !== "swim") {
      const h = w.height(p.x, p.z);
      if (p.y < h - 0.3) { p.y = h; if (this.state === "air" || this.state === "glide") { this.state = "ground"; this.vel.y = 0; this.rig.glider.visible = false; } }
    } else if (p.y < -1.3) p.y = -1.15;
    // never inside a building: push out through the nearest side
    if (this.state !== "climb") for (const b of G.world.boxes) {
      if (b.walk || p.y + 0.5 <= b.y0 + 0.3 || p.y + 0.5 >= b.top - 0.3) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = (p.x - b.x) * c - (p.z - b.z) * s, lz = (p.x - b.x) * s + (p.z - b.z) * c;
      if (Math.abs(lx) >= b.hw || Math.abs(lz) >= b.hd) continue;
      let px = lx, pz = lz;
      if (b.hw - Math.abs(lx) < b.hd - Math.abs(lz)) px = Math.sign(lx || 1) * (b.hw + 0.5); else pz = Math.sign(lz || 1) * (b.hd + 0.5);
      p.x = b.x + px * c + pz * s; p.z = b.z - px * s + pz * c;
      p.y = Math.max(p.y, w.height(p.x, p.z));
    }
    this.stamina = Math.max(0, Math.min(this.staminaMax, this.stamina));
    this.hp = Math.max(0, Math.min(this.maxHp, this.hp));
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
      // too steep to walk up and not facing it head-on: slide along the slope instead of stopping dead
      if (uphill > 0) {
        const ul = Math.hypot(N.x, N.z) || 1, ux = -N.x / ul, uz = -N.z / ul;
        const mx = res.x - this.pos.x, mz = res.z - this.pos.z, into = mx * ux + mz * uz;
        if (into > 0) { const r2 = this.canMove(this.pos.x + mx - ux * into, this.pos.z + mz - uz * into); res.x = r2.x; res.z = r2.z; }
      }
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
    if (N.y < 0.72 && this.pos.y - g < 0.6 && act && dir.mag > 0.3 && -(N.x * dir.x + N.z * dir.z) > 0.2 && this.startClimb(null)) { this.pos.y = G.world.height(this.pos.x, this.pos.z); return; }
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
    // climbing comes in pulls: the body moves most while a hand pulls down, and slows as the next hand reaches
    this.climbPh = (this.climbPh || 0) + dt * (moving ? 6.2 : 0);
    const pulse = 0.35 + 1.3 * Math.pow(Math.abs(Math.sin(this.climbPh)), 1.5);
    const letGo = () => { this.state = "air"; this.airT = 0.3; this.climb = null; };
    if (this.exhausted) { letGo(); this.vel.set(-Math.sin(this.yaw) * 2, 0, -Math.cos(this.yaw) * 2); return; }
    if (act && inp.roll) { letGo(); this.vel.set(-Math.sin(this.yaw) * 3, 0, -Math.cos(this.yaw) * 3); return; }
    // camera right, flattened onto the wall, decides which way "right" goes
    const cr = { x: Math.cos(G.cam.yaw), z: -Math.sin(G.cam.yaw) };
    const jumpBoost = act && inp.jump && this.useStamina(18) ? 2.4 : 0;
    if (jumpBoost) { G.sfx("jump"); this.lungeT = 0.35; }
    this.climbSide = side; this.climbUp = up;
    if (c.terrain) {
      w.normal(this.pos.x, this.pos.z, N);
      let wx = -N.x, wz = -N.z; const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
      let sx = wz, sz = -wx; if (sx * cr.x + sz * cr.z < 0) { sx = -sx; sz = -sz; }
      const sp = 2.6 * (jumpBoost ? 1 + jumpBoost : pulse);
      const vy = up + jumpBoost;
      let nx = this.pos.x + (wx * vy + sx * side) * sp * dt, nz = this.pos.z + (wz * vy + sz * side) * sp * dt;
      const res = this.canMove(nx, nz);
      this.pos.x = res.x; this.pos.z = res.z;
      this.pos.y = w.height(this.pos.x, this.pos.z);
      this.yaw = Math.atan2(wx, wz);
      w.normal(this.pos.x, this.pos.z, N);
      if (N.y > 0.76) { this.mantleFrom = this.pos.clone(); this.mantleFrom.y -= 0.5; this.mantleT = 0.3; this.state = "ground"; this.climb = null; return; }
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
      const sp = 3 * (jumpBoost ? 1 : pulse);
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
        // pull up onto the top, with a short mantle so it reads as a climb and not a jump cut
        this.mantleFrom = this.pos.clone(); this.mantleT = 0.42;
        this.pos.x -= onx * 1.4; this.pos.z -= onz * 1.4; this.pos.y = b.top;
        this.state = "ground"; this.climb = null; G.sfx("land");
        if (b.tower) G.reachedTowerTop(b.tower);
        return;
      }
      // climbing down onto the ground, or onto a lower roof
      const g = G.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.2);
      if (this.pos.y <= g) { this.pos.y = g; this.state = "ground"; this.climb = null; }
    }
  }

  /* ---------------- the kayak ---------------- */
  boardKayak() {
    const G = this.G, K = G.world.kayak;
    this.state = "kayak"; K.rider = true; this.kSpeed = 0; this.stroke = 0;
    this.pos.set(K.x, 0, K.z); this.yaw = K.yaw; this.vel.set(0, 0, 0);
    this.attack = null; this.charge = 0; this.climb = null; this.roll = 0; this.rig.glider.visible = false;
    if (!this.paddleMesh) { this.paddleMesh = M.paddle(); this.rig.root.add(this.paddleMesh); }
    this.paddleMesh.visible = true; this.weaponMesh.visible = false;
    G.sfx("paddle"); G.cam.snap = false;
  }
  // step out onto land, or with no spot given, slip into the water
  leaveKayak(spot) {
    const G = this.G, K = G.world.kayak;
    K.rider = false; K.x = this.pos.x; K.z = this.pos.z; K.yaw = this.yaw;
    if (this.paddleMesh) this.paddleMesh.visible = false;
    this.weaponMesh.visible = true;
    this.kSpeed = 0; this.vel.set(0, 0, 0);
    if (spot) { this.pos.set(spot.x, spot.y, spot.z); this.state = "ground"; G.sfx("land"); }
    else { this.state = "swim"; this.pos.y = -1.15; }
  }
  // somewhere dry within reach of the kayak: a dock first, then solid, gentle ground
  landingSpot() {
    const G = this.G, w = G.world, p = this.pos;
    for (const b of w.boxes) {
      if (!b.dock) continue;
      const x = clamp(p.x, b.x - b.hw + 0.4, b.x + b.hw - 0.4), z = clamp(p.z, b.z - b.hd + 0.4, b.z + b.hd - 0.4);
      if (Math.hypot(x - p.x, z - p.z) < 3.4) return { x, z, y: b.top };
    }
    let best = null, bd = 9;
    for (let a = 0; a < 16; a++) for (const r of [1.5, 2.5, 3.5]) {
      const x = p.x + Math.sin(a * 0.3927) * r, z = p.z + Math.cos(a * 0.3927) * r, h = w.height(x, z);
      if (h < 0.35 || h > 2.5 || w.normal(x, z, N).y < 0.72 || r >= bd) continue;
      const q = this.canMove(x, z);
      if (Math.hypot(q.x - x, q.z - z) > 0.05) continue;
      bd = r; best = { x, z, y: G.groundAt(x, z, h + 1) };
    }
    return best;
  }
  floatKayak() { this.pos.y = Math.sin(this.G.time * 1.7) * 0.05; }
  paddle(dt, dir, inp, act) {
    const G = this.G, w = G.world, K = w.kayak;
    const steer = act && dir.mag > 0.1;
    const head = Math.atan2(dir.x, dir.z);
    if (steer) this.yaw = turn(this.yaw, head, dt * 1.9);
    const face = steer ? Math.max(0, Math.cos(head - this.yaw)) : 0;
    const fast = steer && inp.sprint && !this.exhausted;
    if (fast) this.useStamina(dt * 9);
    const want = steer ? (fast ? 11 : 7.5) * dir.mag * (0.25 + 0.75 * face) : 0;
    this.kSpeed = lerp(this.kSpeed || 0, want, 1 - Math.exp(-dt * (want > this.kSpeed ? 1.1 : 0.6)));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let nx = this.pos.x + fx * this.kSpeed * dt, nz = this.pos.z + fz * this.kSpeed * dt;
    // the bow runs aground in shallow water
    const lead = Math.sign(this.kSpeed || 1) * 2.3;
    if (w.height(nx + fx * lead, nz + fz * lead) > -0.45 || w.height(nx, nz) > -0.45) {
      if (Math.abs(this.kSpeed) > 3) G.sfx("thud");
      this.kSpeed *= -0.15; nx = this.pos.x; nz = this.pos.z;
    }
    const res = this.canMove(nx, nz);
    if (res.box && Math.abs(this.kSpeed) > 3) { G.sfx("thud"); this.kSpeed *= -0.2; }
    this.pos.x = res.x; this.pos.z = res.z;
    this.floatKayak();
    this.vel.set(fx * this.kSpeed, 0, fz * this.kSpeed);
    K.x = this.pos.x; K.z = this.pos.z; K.yaw = this.yaw;
    const was = Math.sin(this.stroke || 0);
    this.stroke = (this.stroke || 0) + dt * (steer ? 2.2 + Math.abs(this.kSpeed) * 0.35 : 0.4);
    if (steer && Math.sign(Math.sin(this.stroke)) !== Math.sign(was)) G.sfx("paddle");
    // jump to slip out into the water
    if (act && inp.jump) { this.leaveKayak(); G.sfx("splash"); }
  }

  enterSwim() {
    this.state = "swim"; this.rig.glider.visible = false; this.climb = null; this.attack = null;
    this.vel.y = 0; this.pos.y = -1.15; this.G.sfx("splash");
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
    const r = this.rig, G = this.G, t = G.time;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (this.state === "swim" ? 5 : 3 + sp * 1.25);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const [lL, lR] = r.legs, [aL, aR] = r.arms;
    // how fast we are turning, for a lean into the turn
    const dyaw = Math.atan2(Math.sin(this.yaw - (this.lastYaw ?? this.yaw)), Math.cos(this.yaw - (this.lastYaw ?? this.yaw)));
    this.lastYaw = this.yaw;
    this.turnLean = lerp(this.turnLean || 0, clamp(dyaw / Math.max(dt, 1e-3), -4, 4), 1 - Math.exp(-dt * 6));
    // a short squash after landing
    if (this.lastState === "air" && this.state === "ground") this.landT = 0.22;
    this.lastState = this.state;
    this.landT = Math.max(0, (this.landT || 0) - dt);
    this.lungeT = Math.max(0, (this.lungeT || 0) - dt);
    this.mantleT = Math.max(0, (this.mantleT || 0) - dt);
    r.body.rotation.set(0, 0, 0); r.body.position.set(0, 0, 0);
    r.torso.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
    aL.rotation.set(0, 0, -0.18); aR.rotation.set(0, 0, 0.18);
    lL.rotation.set(0, 0, 0); lR.rotation.set(0, 0, 0);
    if (this.paddleMesh) this.paddleMesh.visible = this.state === "kayak" && !this.fishing;
    let rate = 14;
    if (this.state === "ground") {
      if (this.roll > 0) {
        const u = 1 - this.roll / 0.42;
        r.body.rotation.x = u * Math.PI * 2; r.body.position.y = Math.sin(u * Math.PI) * 0.5 + 0.2;
        lL.rotation.x = lR.rotation.x = -1.2; aL.rotation.x = aR.rotation.x = -1.2;
        rate = 30;
      } else {
        const a = Math.min(1, sp / 6), run = this.sprinting ? 1 : 0;
        lL.rotation.x = s * 0.9 * a; lR.rotation.x = -s * 0.9 * a;
        aL.rotation.x = -s * (0.7 + run * 0.3) * a; aR.rotation.x = s * (0.7 + run * 0.3) * a;
        aL.rotation.z = -0.18 - a * 0.08; aR.rotation.z = 0.18 + a * 0.08;
        // the shoulders turn against the hips, and the head stays steady
        r.torso.rotation.y = -s * 0.14 * a; r.head.rotation.y = s * 0.1 * a;
        r.body.position.y = Math.abs(c) * (0.07 + run * 0.05) * a;
        r.torso.rotation.x = a * (this.sprinting ? 0.32 : 0.1) + Math.abs(c) * 0.04 * a;
        r.body.rotation.z = -this.turnLean * 0.05 * a;
        // standing still: slow breathing, a weight shift, and a look around now and then
        const idle = 1 - a;
        r.torso.rotation.x += Math.sin(t * 1.7) * 0.03 * idle;
        r.body.rotation.z += Math.sin(t * 0.45) * 0.02 * idle;
        aL.rotation.z -= Math.sin(t * 1.7) * 0.03 * idle; aR.rotation.z += Math.sin(t * 1.7) * 0.03 * idle;
        r.head.rotation.y += Math.sin(t * 0.37) * Math.max(0, Math.sin(t * 0.13)) * 0.45 * idle;
        r.head.rotation.x += Math.sin(t * 0.5 + 1) * 0.05 * idle;
        if (this.landT > 0) { const q = this.landT / 0.22; r.body.position.y -= q * 0.18; lL.rotation.x = lR.rotation.x = -0.45 * q; r.torso.rotation.x += 0.3 * q; }
      }
    } else if (this.state === "air") {
      const up = clamp(this.vel.y / 9, -1, 1);
      lL.rotation.x = -0.7 + up * 0.2; lR.rotation.x = 0.25 - up * 0.2; aL.rotation.z = -1.0 - up * 0.3; aR.rotation.z = 1.0 + up * 0.3;
      aL.rotation.x = aR.rotation.x = -0.3 * up;
      r.torso.rotation.x = -0.1 * up;
    } else if (this.state === "glide") {
      aL.rotation.z = -2.7; aR.rotation.z = 2.7; aL.rotation.x = aR.rotation.x = 0.2;
      lL.rotation.x = Math.sin(t * 3) * 0.2 + 0.2; lR.rotation.x = -Math.sin(t * 3) * 0.2 + 0.2;
      r.body.rotation.z = -this.turnLean * 0.15;
      r.glider.rotation.z = Math.sin(t * 1.3) * 0.08 - this.turnLean * 0.1;
      rate = 8;
    } else if (this.state === "climb") {
      // hand over hand: one arm reaches high while the other pulls down, and the opposite knee drives up
      const moving = Math.hypot(this.climbUp || 0, this.climbSide || 0) > 0.15;
      const q = moving ? Math.sin(this.climbPh || 0) : Math.sin(t * 1.4) * 0.12;
      const dirUp = (this.climbUp || 0) < -0.15 ? -1 : 1;
      aL.rotation.x = -2.35 - 0.62 * q * dirUp; aR.rotation.x = -2.35 + 0.62 * q * dirUp;
      aL.rotation.z = -0.38 - Math.max(0, -(this.climbSide || 0)) * 0.5; aR.rotation.z = 0.38 + Math.max(0, this.climbSide || 0) * 0.5;
      lL.rotation.x = -0.75 + 0.55 * q * dirUp; lR.rotation.x = -0.75 - 0.55 * q * dirUp;
      lL.rotation.z = -0.22; lR.rotation.z = 0.22;
      r.torso.rotation.x = 0.12; r.head.rotation.x = -0.35 + q * 0.05;
      r.body.rotation.z = q * 0.07; r.body.position.x = q * 0.05;
      r.body.position.y = moving ? Math.abs(q) * 0.06 : 0;
      if (this.lungeT > 0) { aL.rotation.x = aR.rotation.x = -3.0; lL.rotation.x = lR.rotation.x = -0.2; r.head.rotation.x = -0.5; }
      // on sloped rock, lean into the slope instead of standing upright with the feet in the ground
      if (this.climb && this.climb.terrain) {
        G.world.normal(this.pos.x, this.pos.z, N);
        const steep = Math.acos(clamp(N.y, 0, 1));
        r.body.rotation.x = (Math.PI / 2 - steep) * 0.8;
        r.root.position.x += N.x * 0.25; r.root.position.y += 0.1; r.root.position.z += N.z * 0.25;
      }
      rate = 11;
    } else if (this.state === "swim") {
      r.body.rotation.x = 1.1; r.body.position.y = 0.5;
      aL.rotation.x = -2 + s * 1.2; aR.rotation.x = -2 - s * 1.2;
      lL.rotation.x = c * 0.5; lR.rotation.x = -c * 0.5;
      rate = 10;
    } else if (this.state === "kayak") {
      // sit in the cockpit with the legs forward; the paddle dips on one side, then the other
      const st = this.stroke || 0, ps = Math.sin(st), work = Math.min(1, Math.abs(this.kSpeed || 0) / 3 + 0.25);
      r.body.position.y = -0.68;
      lL.rotation.x = lR.rotation.x = -1.45; lL.rotation.z = -0.1; lR.rotation.z = 0.1;
      aL.rotation.x = -1.15 + ps * 0.35 * work; aR.rotation.x = -1.15 - ps * 0.35 * work;
      aL.rotation.z = -0.35; aR.rotation.z = 0.35;
      r.torso.rotation.y = ps * 0.32 * work; r.torso.rotation.x = 0.12;
      r.body.rotation.z = -this.turnLean * 0.05 + Math.sin(t * 1.3) * 0.02;
      if (this.paddleMesh) { this.paddleMesh.position.set(0, 0.62, 0.42); this.paddleMesh.rotation.set(0, ps * 0.35 * work, ps * 0.5 * work); }
    }
    if (this.fishing && G.fishing && G.fishing.s) {
      const f = G.fishing.s;
      rate = 12;
      if (f.phase === "cast") { const u = f.t; aR.rotation.x = u < 0.4 ? -1.2 - u * 4.5 : -3 + Math.min(1, (u - 0.4) * 4) * 2.1; r.torso.rotation.x = u < 0.4 ? -0.12 : 0.1; rate = 22; }
      else if (f.phase === "wait") { aR.rotation.x = -0.9 + Math.sin(t * 1.2) * 0.04; aL.rotation.x = -0.6; aL.rotation.z = 0.2; }
      else if (f.phase === "bite" || f.phase === "reel") { aR.rotation.x = -1.6 + Math.sin(t * 22) * 0.07; aL.rotation.x = -1.1 + Math.sin(t * 9) * 0.1; aL.rotation.z = 0.3; r.torso.rotation.x = -0.18; }
      else if (f.phase === "caught") { aL.rotation.x = aR.rotation.x = -3.0; aL.rotation.z = 0.1; aR.rotation.z = -0.1; r.head.rotation.x = -0.25; }
      if (this.state === "kayak") { lL.rotation.x = lR.rotation.x = -1.45; r.body.position.y = -0.68; }
    } else if (this.attack) {
      const u = this.attack.t, e = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
      rate = 26;
      if (this.attack.spin) {
        r.body.rotation.y = u * Math.PI * 2; aR.rotation.set(-1.5, 0, 1.4);
      } else {
        const n = this.attack.n;
        if (n === 0) { aR.rotation.x = -2.6 + e * 3.4; aR.rotation.z = 0.4; r.torso.rotation.y = -0.3 + e * 0.5; }
        else if (n === 1) { aR.rotation.x = -1.4; aR.rotation.z = 1.8 - e * 3.4; r.torso.rotation.y = 0.6 - e * 1.2; }
        else { aR.rotation.x = -3 + e * 4; r.torso.rotation.x = e * 0.4; r.body.position.y += Math.sin(u * Math.PI) * 0.4; }
      }
    } else if (this.charge > 0.1) {
      aR.rotation.set(-1.4, 0, 1.6); r.torso.rotation.y = -0.8;
    }
    // mantle: the body rises over the edge, then swings forward onto the top
    if (this.mantleT > 0 && this.mantleFrom && this.state === "ground") {
      const u = 1 - this.mantleT / 0.42, up = Math.min(1, u * 1.8), fw = Math.max(0, (u - 0.35) / 0.65);
      r.root.position.set(lerp(this.mantleFrom.x, this.pos.x, fw), lerp(this.mantleFrom.y, this.pos.y, up), lerp(this.mantleFrom.z, this.pos.z, fw));
      aL.rotation.set(-0.7 + fw * 0.5, 0, -0.3); aR.rotation.set(-0.7 + fw * 0.5, 0, 0.3);
      lL.rotation.x = -1.3 * (1 - fw); lR.rotation.x = -0.4 * (1 - fw);
      r.torso.rotation.x = 0.5 * (1 - fw);
      rate = 18;
    }
    // blink while hurt
    r.root.visible = !r.root.userData.camHide && !(this.invuln > 0 && this.invuln < 0.9 && Math.floor(this.invuln * 20) % 2 === 0 && this.roll <= 0);
    // painted 3D models: turn the pose into bone rotations, easing between poses
    if (r.apply) r.apply(dt, rate);
  }
}

function turn(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
