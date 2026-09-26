// Loot: the weapon pouch, weapons lying in the world, weapons you throw, what critters drop,
// treasure chests on the hilltops, and the coolers at critter camps.
import * as THREE from "three";
import * as M from "./models.js";
import { WEAPONS, MODS, weaponStats, maxDur, KIND_NAME } from "./player.js";
import { ISLAND, BOSSES } from "./world.js";
import { rng } from "./noise.js";

export const WICO = { plunger: "🪠", paddle: "🛶", stick: "🏒", rod: "🎣", pan: "🍳", golden: "🏆", branch: "🍁", lacrosse: "🥍", torch: "🔥", frisbee: "🥏", broom: "🧹", antler: "🦌", pole: "⛺", fork: "🔱" };
export const MOD_COL = { sturdy: 0x7ac8ff, mighty: 0xff6a4a, keen: 0xffd84a };
// what each critter may drop when it goes down: a chance, and a list to pick from
const DROPS = {
  raccoon: [0.22, ["branch", "branch", "stick", "lacrosse", "pole", "torch"]],
  goose: [0.05, ["branch"]],
  bear: [0.4, ["paddle", "pan", "fork", "broom"]],
  moose: [0.65, ["antler", "antler", "fork"]],
};
// what is in each treasure chest; each one is opened once
const CHEST_LOOT = [
  { id: "antler", mod: "mighty" }, { id: "fork", mod: "sturdy" }, { id: "lacrosse", mod: "keen" }, { id: "broom", mod: "sturdy" },
  { id: "torch", mod: "mighty" }, { id: "golden" }, { food: { syrup: 3 } }, { id: "paddle", mod: "mighty" },
  { id: "pole", mod: "keen" }, { id: "pan", mod: "mighty" }, { id: "stick", mod: "keen" }, { food: { stew: 2 } },
  { id: "antler", mod: "keen" }, { id: "fork", mod: "mighty" }, { id: "golden", mod: "sturdy" }, { id: "broom", mod: "mighty" },
];
export const FOOD_ICON = { apple: "🍎", berry: "🫐", shroom: "🍄", syrup: "🍯", fish: "🐟", stew: "🍲" };
const FOOD_NAMES = { apple: "Apple", berry: "Blueberries", shroom: "Toadstool", syrup: "Maple Syrup", fish: "Fish", stew: "Cottage Stew" };

// a beam of light over a chest you have not opened, so you can spot it from far away
const BEAM_VS = `varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FS = `uniform float uTime; uniform float uAlpha; varying float vY;
void main() { float a = pow(1.0 - vY, 2.2) * (0.3 + 0.12 * sin(uTime * 3.0 - vY * 30.0)); gl_FragColor = vec4(1.0, 0.84, 0.42, a * uAlpha); }`;

export class Loot {
  constructor(G) {
    this.G = G;
    this.ground = []; this.flying = []; this.chests = []; this.spots = [];
    this.beamMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.beamGeo = new THREE.CylinderGeometry(0.25, 0.7, 70, 10, 1, true); this.beamGeo.translate(0, 35, 0);
    this.v = new THREE.Vector3();
  }

  /* ---------------- the pouch ---------------- */
  get inv() { return this.G.inv; }
  cap() { return this.G.save.slots || 5; }
  slot() { return this.inv.weapons[this.inv.cur]; }
  // hold the weapon in pouch slot k
  equip(k) {
    const W = this.inv.weapons;
    if (k < 0 || k >= W.length) return;
    this.inv.cur = k;
    const P = this.G.player;
    P.setWeapon(W[k].id, W[k].mod);
    // a frisbee in the air is not in your hand yet
    if (this.flying.some((f) => f.slot === W[k])) P.weaponMesh.visible = false;
    this.G.ui.pouchShow();
  }
  // the strongest weapon left in the pouch, for when the one you hold breaks or flies away
  equipBest() {
    const W = this.inv.weapons; let best = 0;
    for (let k = 1; k < W.length; k++) if (weaponStats(W[k].id, W[k].mod).dmg > weaponStats(W[best].id, W[best].mod).dmg) best = k;
    this.equip(best);
  }
  full() { return this.inv.weapons.length >= this.cap(); }
  // add a weapon to the pouch and hold it; false when the pouch is full
  add(id, mod = null, dur) {
    if (this.full()) return false;
    this.inv.weapons.push({ id, mod: mod || null, dur: dur ?? (WEAPONS[id].dur === Infinity ? Infinity : maxDur(id, mod)) });
    this.equip(this.inv.weapons.length - 1);
    return true;
  }
  // a full pouch: put down the weakest weapon (never the plunger) where you stand, and take the new one
  swapIn(id, mod, dur, x, z) {
    const W = this.inv.weapons;
    let k = this.inv.cur;
    if (k === 0 || W[k].id === "plunger") { k = 1; for (let q = 2; q < W.length; q++) if (weaponStats(W[q].id, W[q].mod).dmg < weaponStats(W[k].id, W[k].mod).dmg) k = q; }
    const old = W.splice(k, 1)[0];
    this.drop(old.id, old.mod, old.dur, x, z);
    this.G.ui.toast("Put down your " + weaponStats(old.id, old.mod).name);
    this.add(id, mod, dur);
  }
  // give a weapon from a chest, a quest, or a cooler; if the pouch is full it lands at your feet
  give(id, mod = null, x, z) {
    if (this.add(id, mod)) return true;
    const P = this.G.player;
    this.drop(id, mod, undefined, x ?? P.x + Math.sin(P.yaw) * 1.2, z ?? P.z + Math.cos(P.yaw) * 1.2);
    this.G.ui.toast("Your pouch is full. It's on the ground.");
    return false;
  }
  // a weapon in your hand is worn down by one hit; true when that hit broke it
  wear(n = 1) {
    const s = this.slot();
    if (!s || s.dur === Infinity) return false;
    s.dur -= n;
    const W = weaponStats(s.id, s.mod);
    if (s.dur > 0 && s.dur / maxDur(s.id, s.mod) <= 0.2 && !s.warned) { s.warned = true; this.G.ui.toast("Your " + W.name + " is badly worn!"); }
    if (s.dur > 0) return false;
    this.shatter(W);
    this.inv.weapons.splice(this.inv.cur, 1);
    this.equipBest();
    return true;
  }
  // a weapon breaking: splinters fly, and the last blow hits twice as hard (the caller doubles it)
  shatter(W) {
    const G = this.G, P = G.player;
    const x = P.x + Math.sin(P.yaw) * 1.2, z = P.z + Math.cos(P.yaw) * 1.2;
    G.sfx("break"); G.sfx("crack");
    G.fx.splash(x, P.y + 1.3, z, 0x9a6a3a, 14, 0.6);
    G.fx.spark(x, P.y + 1.3, z, 0xfff0c0, 12, 1.3);
    G.ui.pop("Broke!", "red");
    G.ui.toast("Your " + W.name + " broke!");
  }

  /* ---------------- weapons on the ground ---------------- */
  drop(id, mod, dur, x, z, world = false) {
    const G = this.G;
    // never into the lake: onto the shore by the hero instead
    if (G.groundAt(x, z, 999) < 0.4) { x = G.player.x; z = G.player.z; }
    const y = G.groundAt(x, z, 999);
    const obj = new THREE.Group();
    const m = M.weaponMesh(id); m.rotation.z = Math.PI / 2; m.position.set(0.5, 0.12, 0); obj.add(m);
    obj.position.set(x, y, z); obj.rotation.y = Math.random() * 6.28;
    G.scene.add(obj);
    const it = { id, mod: mod || null, dur: dur ?? (WEAPONS[id].dur === Infinity ? Infinity : maxDur(id, mod)), obj, x, y, z, world, t: Math.random() * 2 };
    this.ground.push(it);
    // too many dropped weapons: the oldest ones fade away
    const dropped = this.ground.filter((g) => !g.world);
    if (dropped.length > 30) this.take(dropped[0]);
    return it;
  }
  take(it) { const i = this.ground.indexOf(it); if (i >= 0) this.ground.splice(i, 1); this.G.scene.remove(it.obj); if (it.spot) it.spot.it = null; }
  pickUp(it) {
    const G = this.G;
    if (this.full()) this.swapIn(it.id, it.mod, it.dur, it.x, it.z); else this.add(it.id, it.mod, it.dur);
    if (it.spot) it.spot.taken = G.save.day;
    this.take(it);
    G.sfx("pickup");
    G.ui.toast("Got a " + weaponStats(it.id, it.mod).name);
  }
  // weapons that are part of the world: branches under trees, tent poles at camp sites
  buildSpots() {
    const w = this.G.world, r = rng(515);
    const trees = [];
    for (const list of w.colliders.values()) for (const t of list) if (t.kind === "tree") trees.push(t);
    for (let k = 0; k < 800 && this.spots.length < 34; k++) {
      const t = trees[(r() * trees.length) | 0]; if (!t) break;
      const a = r() * 6.28, x = t.x + Math.cos(a) * (t.r + 1.4), z = t.z + Math.sin(a) * (t.r + 1.4);
      if (w.height(x, z) < 1.5 || this.spots.some((s) => Math.hypot(s.x - x, s.z - z) < 40)) continue;
      this.spots.push({ id: r() < 0.85 ? "branch" : "torch", x, z });
    }
    w.camps.forEach((c, i) => this.spots.push({ id: ["pole", "torch", "lacrosse", "pole", "fork"][i % 5], x: c.x - 3, z: c.z - 3.5 }));
  }
  // put back world weapons that were taken, once a new day has come and you are far away
  refill(force) {
    const P = this.G.player, day = this.G.save.day;
    for (const s of this.spots) {
      if (s.it) continue;
      if (!force && (s.taken === day || Math.hypot(s.x - P.x, s.z - P.z) < 90)) continue;
      s.it = this.drop(s.id, null, undefined, s.x, s.z, true); s.it.spot = s; s.taken = null;
    }
  }
  // a critter may drop a weapon when it goes down; better ones later in the game
  dropFrom(f) {
    const D = DROPS[f.type]; if (!D || Math.random() > D[0]) return;
    const id = D[1][(Math.random() * D[1].length) | 0];
    const day = this.G.save.day, mods = Object.keys(MODS);
    const mod = Math.random() < Math.min(0.35, 0.06 + day * 0.03 + this.G.save.bosses.length * 0.04) ? mods[(Math.random() * 3) | 0] : null;
    const it = this.drop(id, mod, undefined, f.x + (Math.random() - 0.5) * 1.5, f.z + (Math.random() - 0.5) * 1.5);
    it.pop = 0.5;
  }

  /* ---------------- throwing ---------------- */
  canThrow() { const s = this.slot(); return !!s && s.id !== "plunger" && !this.flying.some((f) => f.slot === s); }
  throw(P) {
    const G = this.G, s = this.slot();
    if (!s || s.id === "plunger") return;
    const W = weaponStats(s.id, s.mod);
    const mesh = M.weaponMesh(s.id);
    const hand = P.weaponMesh ? P.weaponMesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(P.x, P.y + 1.4, P.z);
    const t = G.autoAim(P, { x: Math.sin(P.yaw), z: Math.cos(P.yaw), mag: 1 });
    const dir = new THREE.Vector3(Math.sin(P.yaw), 0.04, Math.cos(P.yaw));
    if (t) { const ty = (t.pos ? t.pos.y : P.y) + (t.T && t.T.h ? t.T.h * 0.5 : 1.2); dir.set(t.x - hand.x, ty - hand.y, t.z - hand.z).normalize(); }
    const speed = W.boomerang ? 22 : 24;
    const f = { slot: s, id: s.id, mod: s.mod, dur: s.dur, W, mesh, pos: hand.clone(), vel: dir.multiplyScalar(speed), t: 0, hits: new Set(), back: false, spinAxis: W.boomerang ? "y" : "x" };
    if (W.boomerang) { mesh.rotation.x = 0; P.weaponMesh.visible = false; }
    G.scene.add(mesh);
    mesh.position.copy(f.pos);
    this.flying.push(f);
    // a thrown weapon leaves your hand; a frisbee stays yours and comes back
    if (!W.boomerang) { this.inv.weapons.splice(this.inv.weapons.indexOf(s), 1); this.equipBest(); }
    G.sfx("throw");
  }
  updateFlying(dt) {
    const G = this.G, P = G.player;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i], W = f.W;
      f.t += dt;
      if (W.boomerang) {
        if (!f.back && f.t > 0.6) f.back = true;
        if (f.back) {
          const to = this.v.set(P.x - f.pos.x, P.y + 1.3 - f.pos.y, P.z - f.pos.z), d = to.length();
          if (d < 1.3 || f.t > 4 || P.dead) { this.catchBack(f); this.flying.splice(i, 1); continue; }
          f.vel.lerp(to.multiplyScalar(26 / d), 1 - Math.exp(-dt * 8));
        }
        f.mesh.rotation.y += dt * 30;
      } else {
        f.vel.y -= 9 * dt;
        f.mesh.rotation.x += dt * 22;
      }
      f.pos.addScaledVector(f.vel, dt);
      f.mesh.position.copy(f.pos);
      if (W.fire && Math.random() < dt * 30) G.fx.flare(f.pos.x, f.pos.y, f.pos.z, 0xff8a2a, 1.2, 0.25);
      // hits
      let hit = null;
      for (const q of G.targets()) {
        if (f.hits.has(q)) continue;
        const r = (q.T ? q.T.r : q.r || 1) + 0.7, qy = q.pos ? q.pos.y : P.y, h = q.T && q.T.h ? q.T.h : 3;
        if (Math.hypot(q.x - f.pos.x, q.z - f.pos.z) > r || f.pos.y < qy - 0.5 || f.pos.y > qy + h + 0.8) continue;
        hit = q; break;
      }
      if (hit) {
        f.hits.add(hit);
        const crit = G.slowmo > 0 || Math.random() < P.crit + (W.crit || 0);
        const dmg = W.dmg * 2 * P.dmgMult * (crit ? 2 : 1);
        const ok = hit.hurt(dmg, f.pos.x - f.vel.x, f.pos.z - f.vel.z, W.knock * 1.5, true, { poise: 1.4 });
        if (ok !== false && W.fire && hit.burn) hit.burn(4);
        G.fx.spark(f.pos.x, f.pos.y, f.pos.z, crit ? 0xffd84a : 0xfff4d0, crit ? 12 : 8, 1.4);
        G.sfx(crit ? "crit" : "smash"); G.hitstop = 0.06; G.shake(0.2);
        if (W.boomerang) { f.back = true; continue; }
        // it bounces off and falls, a little more worn
        if (f.dur !== Infinity) f.dur -= 1;
        f.vel.set(-f.vel.x * 0.15, 5, -f.vel.z * 0.15);
        if (f.dur <= 0) { G.fx.splash(f.pos.x, f.pos.y, f.pos.z, 0x9a6a3a, 12, 0.6); G.sfx("break"); this.done(f, i); continue; }
      }
      const g = G.groundAt(f.pos.x, f.pos.z, f.pos.y + 0.5);
      if (f.pos.y <= g + 0.15 || f.t > 3) {
        if (W.boomerang) { f.back = true; f.pos.y = Math.max(f.pos.y, g + 0.3); f.vel.y = Math.abs(f.vel.y); continue; }
        if (g < 0.2) { G.fx.splash(f.pos.x, 0.1, f.pos.z, 0xdff4ff, 10, 0.6); G.sfx("plop"); G.ui.toast("It sank in the lake"); this.done(f, i); continue; }
        this.done(f, i);
        this.drop(f.id, f.mod, f.dur, f.pos.x, f.pos.z);
        G.fx.dust(f.pos.x, g, f.pos.z, 6, 0.3);
        G.sfx("land");
        continue;
      }
      // it hit a wall or a tree
      if (G.test.inBox(f.pos.x, f.pos.y, f.pos.z) && !W.boomerang) { f.vel.set(-f.vel.x * 0.2, 2, -f.vel.z * 0.2); G.sfx("bonk"); }
    }
  }
  done(f, i) { this.G.scene.remove(f.mesh); this.flying.splice(i, 1); }
  catchBack(f) {
    const G = this.G, P = G.player;
    G.scene.remove(f.mesh);
    if (P.weaponMesh && this.slot() === f.slot) P.weaponMesh.visible = true;
    G.sfx("grab");
  }
  // clear everything in the air (travel, death)
  clearFlying() { for (const f of this.flying) { this.G.scene.remove(f.mesh); if (f.W.boomerang) this.catchBack(f); } this.flying.length = 0; }

  /* ---------------- treasure chests ---------------- */
  // where the chests sit: hilltops with a view first, then quiet places in the woods and by the water
  buildChests() {
    const G = this.G, w = G.world, r = rng(777), N = new THREE.Vector3(), cand = [];
    const c = w.cottage;
    const free = (x, z, rad) => { if (!w.clearOf(x, z, rad) || G.test.inBox(x, w.height(x, z) + 1, z)) return false; let hit = false; w.near(x, z, (q) => { if (Math.hypot(q.x - x, q.z - z) < q.r + rad) hit = true; }); return !hit; };
    for (let k = 0; k < 7000; k++) {
      const x = (r() - 0.5) * 1340, z = (r() - 0.5) * 1340, h = w.height(x, z);
      if (h < 3 || h > 160) continue;
      if (Math.hypot(x - c.x, z - c.z) < 60 || Math.hypot(x - ISLAND.x, z - ISLAND.z) < 160) continue;
      if (BOSSES.some((b) => Math.hypot(x - b.x, z - b.z) < (b.r || 30) + 12)) continue;
      if (w.normal(x, z, N).y < 0.9 || !free(x, z, 2.2)) continue;
      let around = 0; for (let q = 0; q < 8; q++) { const a = q * 0.785; around += w.height(x + Math.cos(a) * 22, z + Math.sin(a) * 22); }
      cand.push({ x, z, h, prom: h - around / 8 });
    }
    cand.sort((a, b) => b.prom - a.prom);
    // four in each lookout's land: two hilltops with a view, then two quiet places
    const pick = [], far = (p, d) => pick.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > d);
    for (const t of ["south", "east", "west", "north"]) {
      const mine = cand.filter((p) => w.towerOf(p.x, p.z) === t), n0 = pick.length;
      for (const p of mine) { if (pick.length - n0 >= 2) break; if (p.prom > 2 && far(p, 120)) pick.push(p); }
      for (let k = mine.length - 1; k >= 0 && pick.length - n0 < 4; k--) if (far(mine[k], 100)) pick.push(mine[k]);
    }
    pick.forEach((p, i) => {
      const obj = M.chest(); const y = w.height(p.x, p.z);
      obj.position.set(p.x, y, p.z); obj.rotation.y = r() * 6.28; G.scene.add(obj);
      w.addCircle(p.x, p.z, 0.8, "chest");
      const beam = new THREE.Mesh(this.beamGeo, this.beamMat); beam.position.set(p.x, y + 0.6, p.z); beam.frustumCulled = false; beam.renderOrder = 5; G.scene.add(beam);
      this.chests.push({ i, x: p.x, z: p.z, y, obj, beam, loot: CHEST_LOOT[i % CHEST_LOOT.length], open: false, t: 0 });
    });
  }
  // match the chests to a save: opened ones stay open
  sync(S) {
    for (const c of this.chests) { c.open = S.chests.includes(c.i); c.obj.userData.lid.rotation.x = c.open ? -1.9 : 0; c.beam.visible = !c.open; c.t = 0; }
  }
  openChest(c) {
    const G = this.G, S = G.save;
    if (c.open) return;
    c.open = true; c.t = 0.0001; S.chests.push(c.i);
    G.sfx("chest");
    G.fx.flare(c.x, c.y + 1, c.z, 0xffe08a, 5, 0.6);
    setTimeout(() => {
      G.fx.spark(c.x, c.y + 1.2, c.z, 0xffe08a, 14, 1.5);
      const L = c.loot;
      if (L.id) { this.give(L.id, L.mod, c.x, c.z); G.ui.got(L.id, L.mod); }
      else { for (const [k, n] of Object.entries(L.food)) G.inv.food[k] = (G.inv.food[k] || 0) + n; const [k, n] = Object.entries(L.food)[0]; G.ui.got(null, null, { icon: FOOD_ICON[k], name: n + " " + FOOD_NAMES[k], line: "Stored in your food pouch" }); }
      G.writeSave();
    }, 650);
  }
  // the coolers at critter camps stay shut while any critter of that camp is still up
  campLeft(i) { return (this.G.plan || []).filter((p) => p.camp === i && p.foe && p.foe.alive).length; }
  campCleared(i) {
    const G = this.G, c = G.world.camps[i];
    if (!c || (G.save.coolers[i] != null && G.save.coolers[i] >= G.save.day)) return;
    G.sfx("unlock"); G.ui.pop("Camp cleared!", "gold");
    G.fx.flare(c.cooler.position.x, c.cooler.position.y + 1.2, c.cooler.position.z, 0xffe08a, 4, 0.8);
    G.ui.toast("The cooler at this camp is open");
  }

  /* ---------------- every frame ---------------- */
  update(dt) {
    const G = this.G, P = G.player;
    this.beamMat.uniforms.uTime.value = G.time;
    this.updateFlying(dt);
    for (const it of this.ground) {
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      it.obj.visible = d < 150;
      if (d > 150) continue;
      // a fresh drop pops out of the critter and lands
      if (it.pop > 0) { it.pop -= dt; it.obj.position.y = it.y + Math.sin((1 - it.pop / 0.5) * Math.PI) * 1.2; }
      it.t -= dt;
      if (it.t <= 0) { it.t = it.world ? 3 + Math.random() * 3 : 1.4 + Math.random(); G.fx.flare(it.x, it.y + 0.3, it.z, it.mod ? MOD_COL[it.mod] : 0xfff4d0, it.mod ? 1.6 : 0.9, 0.5); }
    }
    for (const c of this.chests) {
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      c.beam.visible = !c.open && d < 420 && d > 6;
      if (c.t > 0 && c.t < 1) { c.t = Math.min(1, c.t + dt * 1.6); const u = c.t; c.obj.userData.lid.rotation.x = -1.9 * (1 - Math.pow(1 - u, 3)) - Math.sin(u * Math.PI) * 0.15; }
    }
  }
  // interaction choices near the hero: weapons to pick up, chests to open
  options(opts, d2) {
    const P = this.G.player;
    for (const it of this.ground) {
      const d = d2(it.x, it.z);
      if (d > 2 || Math.abs(it.y - P.y) > 2) continue;
      const name = weaponStats(it.id, it.mod).name;
      opts.push({ d: d - 0.2, label: (this.full() ? "Swap for " : "Pick up ") + name, go: () => this.pickUp(it) });
    }
    for (const c of this.chests) if (!c.open && d2(c.x, c.z) < 2.4 && Math.abs(c.y - P.y) < 2) opts.push({ d: d2(c.x, c.z), label: "Open the chest", go: () => this.openChest(c) });
  }
  // a line that says what a weapon is good at
  static describe(id, mod) {
    const W = weaponStats(id, mod);
    return KIND_NAME[W.kind] + " · " + Math.round(W.dmg) + " damage" + (W.dur === Infinity ? " · never breaks" : "") + (W.fire ? " · sets critters on fire" : "") + (W.boomerang ? " · comes back when thrown" : "") + (W.stun ? " · stuns" : "") + (mod ? " · " + MODS[mod].text : "");
  }
}
