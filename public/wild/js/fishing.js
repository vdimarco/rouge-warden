// Fishing: cast at a ring of rising fish, wait for a bite, hook it, then keep the fish inside your reel zone.
// You can fish from the shore, from a dock, or from the kayak.
import * as THREE from "three";
import * as M from "./models.js";

export const FISH = [
  { id: "perch", name: "Yellow Perch", color: 0xd8b84a, chance: 0.45, zone: 0.32, speed: 0.7, count: 1 },
  { id: "trout", name: "Lake Trout", color: 0x8a9a5a, chance: 0.3, zone: 0.26, speed: 1.0, count: 1 },
  { id: "walleye", name: "Walleye", color: 0xa8a070, chance: 0.2, zone: 0.22, speed: 1.35, count: 2 },
  { id: "golden", name: "Golden Loon Bass", color: 0xffc830, chance: 0.05, zone: 0.17, speed: 1.8, count: 3 },
];
export const REACH = 15;
const TV = new THREE.Vector3();
const $ = (s) => document.querySelector(s);

export class Fishing {
  constructor(G) {
    this.G = G;
    this.s = null;
    this.bob = M.bobber();
    this.bob.visible = false;
    G.scene.add(this.bob);
    const pts = new Float32Array(10 * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.7 }));
    this.line.frustumCulled = false; this.line.visible = false;
    G.scene.add(this.line);
    this.rod = M.rod();
    this.held = null;
  }
  get active() { return !!this.s; }
  // the nearest spot you can cast at, or null
  spotNear() {
    const P = this.G.player, w = this.G.world;
    if (!w.fishSpots || this.s) return null;
    if (P.state !== "ground" && P.state !== "kayak") return null;
    let best = null, bd = REACH;
    for (const f of w.fishSpots) { const d = Math.hypot(f.x - P.x, f.z - P.z); if (f.rest <= 0 && d < bd) { bd = d; best = f; } }
    return best;
  }
  start(spot) {
    const G = this.G, P = G.player;
    if (P.dead) return;
    P.yaw = Math.atan2(spot.x - P.x, spot.z - P.z);
    P.fishing = true; P.attack = null; P.charge = 0;
    P.weaponMesh.visible = false;
    if (P.paddleMesh) P.paddleMesh.visible = false;
    P.rig.grip.add(this.rod);
    this.rod.rotation.set(0, 0, 0);
    // roll the fish now, so a hard fish can be felt in how it bites
    let r = Math.random(), f = FISH[0];
    for (const q of FISH) { if (r < q.chance) { f = q; break; } r -= q.chance; }
    this.s = { spot, phase: "cast", t: 0, fish: f, wait: 2 + Math.random() * 3.5, nib: 0.6 + Math.random(), from: new THREE.Vector3(), to: new THREE.Vector3(spot.x + (Math.random() - 0.5) * 1.5, 0.02, spot.z + (Math.random() - 0.5) * 1.5) };
    G.sfx("cast");
  }
  end(msg) {
    const G = this.G, P = G.player;
    if (!this.s) return;
    this.s = null;
    P.fishing = false;
    if (this.rod.parent) this.rod.parent.remove(this.rod);
    if (this.held) { this.held.parent.remove(this.held); this.held = null; }
    P.weaponMesh.visible = P.state !== "kayak";
    if (P.paddleMesh) P.paddleMesh.visible = P.state === "kayak";
    this.bob.visible = false; this.line.visible = false;
    $("#fishing").hidden = true;
    if (msg) G.ui.toast(msg);
  }
  tipPos(out) { this.rod.userData.tip.getWorldPosition(out); return out; }
  update(dt, inp) {
    const G = this.G, s = this.s, P = G.player;
    if (!s) return;
    if (P.dead || (P.state !== "ground" && P.state !== "kayak")) { this.end(); return; }
    s.t += dt;
    const pull = inp.attack || inp.interact;
    const moved = Math.hypot(inp.move.x, inp.move.y) > 0.5;
    if ((moved || inp.roll || inp.jump) && s.phase !== "caught" && s.phase !== "reel") { this.end("You reeled in the line"); inp.roll = inp.jump = false; return; }
    const tip = this.tipPos(TV);
    if (s.phase === "cast") {
      if (s.t < 0.45) { this.bob.visible = false; s.from.copy(tip); }
      else {
        const u = Math.min(1, (s.t - 0.45) / 0.55);
        this.bob.visible = true;
        this.bob.position.lerpVectors(s.from, s.to, u);
        this.bob.position.y += Math.sin(u * Math.PI) * 3;
        if (u >= 1) { s.phase = "wait"; s.t = 0; G.sfx("plop"); G.fx.puff(s.to.x, 0.1, s.to.z, 0xffffff, 6); }
      }
    } else if (s.phase === "wait") {
      this.bob.position.copy(s.to);
      this.bob.position.y = 0.02 + Math.sin(G.time * 2.4) * 0.02;
      // small nibbles before the real bite
      s.nib -= dt;
      if (s.nib < 0) { s.nib = 0.7 + Math.random() * 1.2; s.dip = 0.15; }
      if (s.dip > 0) { s.dip -= dt; this.bob.position.y -= 0.05; }
      if (pull) { this.end("Too soon. It swam off."); return; }
      if (s.t > s.wait) { s.phase = "bite"; s.t = 0; G.sfx("bite"); G.fx.puff(s.to.x, 0.1, s.to.z, 0xffffff, 10); G.ui.toast("!", 0.8); }
    } else if (s.phase === "bite") {
      this.bob.position.set(s.to.x + Math.sin(G.time * 40) * 0.05, -0.12, s.to.z);
      if (pull) { this.startReel(); return; }
      if (s.t > 0.95) { this.end("It stole the bait"); return; }
    } else if (s.phase === "reel") {
      this.reel(dt, inp);
      if (!this.s) return;
      const u = Math.max(0, Math.min(1, s.prog));
      this.bob.position.lerpVectors(s.to, TV.set(P.x + Math.sin(P.yaw) * 1.5, 0, P.z + Math.cos(P.yaw) * 1.5), u * 0.8);
      this.bob.position.y = -0.08 + Math.sin(G.time * 18) * 0.04;
      if (Math.random() < dt * 3) G.fx.puff(this.bob.position.x, 0.1, this.bob.position.z, 0xffffff, 2);
    } else if (s.phase === "caught") {
      this.bob.visible = false;
      if (s.t > 1.9) this.end();
      return this.drawLine(tip, false);
    }
    this.drawLine(this.tipPos(TV.clone()), true);
  }
  startReel() {
    const s = this.s, G = this.G;
    s.phase = "reel"; s.t = 0; s.prog = 0.35; s.f = 0.5; s.ft = 0.5; s.fT = 0; s.z = 0.5; s.zv = 0; s.sound = 0;
    G.sfx("grab");
    $("#fishing").hidden = false;
    $("#fishZone").style.height = s.fish.zone * 100 + "%";
  }
  reel(dt, inp) {
    const s = this.s, G = this.G, F = s.fish;
    // the fish darts to a new depth every so often; harder fish dart farther and faster
    s.fT -= dt;
    if (s.fT <= 0) { s.fT = (0.35 + Math.random() * 0.9) / F.speed; s.ft = Math.max(0.03, Math.min(0.97, s.f + (Math.random() - 0.5) * 0.9 * F.speed)); }
    s.f += (s.ft - s.f) * (1 - Math.exp(-dt * 3 * F.speed));
    // holding Swing lifts your zone, letting go lets it sink
    s.zv += (inp.attackHeld ? 3.4 : -2.8) * dt;
    s.zv = Math.max(-1.0, Math.min(1.0, s.zv));
    s.z += s.zv * dt;
    const h = F.zone / 2;
    if (s.z < h) { s.z = h; s.zv = Math.max(0, s.zv) * 0.3; }
    if (s.z > 1 - h) { s.z = 1 - h; s.zv = Math.min(0, s.zv) * 0.3; }
    const inside = Math.abs(s.f - s.z) < h;
    s.prog += (inside ? 0.32 : -0.13) * dt;
    s.sound -= dt;
    if (inside && s.sound <= 0) { s.sound = 0.14; G.sfx("reel"); }
    $("#fishZone").style.bottom = (s.z - h) * 100 + "%";
    $("#fishZone").classList.toggle("on", inside);
    $("#fishIcon").style.bottom = s.f * 100 + "%";
    $("#fishFill").style.height = Math.max(0, Math.min(1, s.prog)) * 100 + "%";
    if (s.prog >= 1) this.caught();
    else if (s.prog <= 0 || s.t > 40) this.end("The line went slack. It got away.");
  }
  caught() {
    const s = this.s, G = this.G, P = G.player, F = s.fish;
    s.phase = "caught"; s.t = 0;
    $("#fishing").hidden = true;
    G.inv.food.fish = (G.inv.food.fish || 0) + F.count;
    s.spot.rest = 90;
    G.save.fish = (G.save.fish || 0) + 1;
    G.sfx("catch");
    G.ui.toast("Caught a " + F.name + "!" + (F.count > 1 ? "  +" + F.count + " fish" : ""), 2.4);
    // hold it up over your head
    this.held = M.fish(F.color);
    this.held.scale.setScalar(F.id === "golden" ? 1.3 : 1);
    this.held.position.set(0, 2.45, 0.1);
    this.held.rotation.set(0, Math.PI / 2, 0.35);
    P.rig.root.add(this.held);
    G.fx.puff(P.x, P.y + 2.4, P.z, F.id === "golden" ? 0xffd84a : 0xffffff, 12);
    G.writeSave();
  }
  // a line from the rod tip to the bobber, sagging a little when slack
  drawLine(tip, show) {
    const a = this.line.geometry.attributes.position, b = this.bob.position, s = this.s;
    this.line.visible = show && this.bob.visible;
    if (!this.line.visible) return;
    const tight = s && (s.phase === "reel" || s.phase === "bite") ? 0.1 : 1;
    for (let k = 0; k < 10; k++) {
      const u = k / 9;
      a.setXYZ(k, tip.x + (b.x - tip.x) * u, tip.y + (b.y - tip.y) * u - Math.sin(u * Math.PI) * 0.6 * tight, tip.z + (b.z - tip.z) * u);
    }
    a.needsUpdate = true;
  }
}
