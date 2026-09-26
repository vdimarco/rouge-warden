// Side quests: friendly critters around the valley who need a hand, and what they give you for it.
// Friendly critters wear something (a bandana, a cap, a whistle) so you can tell them from the ones that bite.
import * as THREE from "three";
import * as M from "./models.js";

export const QUESTS = {
  frisbee: { name: "Pip's Frisbee", giver: "pip", icon: "🥏" },
  fort: { name: "The Bandit Fort", giver: "rocco", icon: "👑" },
  fish: { name: "Bruno's Supper", giver: "bruno", icon: "🐟" },
  rings: { name: "The Glide Course", giver: "gus", icon: "⭕" },
  alpha: { name: "The Moose Alpha", giver: "marge", icon: "🦌" },
};
const NPCS = {
  pip: { name: "Pip", model: "goose", scale: 0.6, hat: "cap", col: 0xe0602a, hs: 0.8 },
  rocco: { name: "Rocco", model: "raccoon", scale: 1, hat: "bandana", hs: 1 },
  bruno: { name: "Bruno", model: "bear", scale: 0.9, hat: "cap", col: 0x3a7a4a, hs: 1.6 },
  gus: { name: "Coach Gus", model: "goose", scale: 1.1, hat: "whistle", hs: 0.9 },
  marge: { name: "Marge", model: "moose", scale: 0.85, hat: "flower", hs: 2.2 },
  chip: { name: "Chip", model: "raccoon", scale: 0.55, hat: "bandana", col: 0xf2c230, tint: 0xffd890, hs: 1 },
};
// Chip makes your pouch bigger for Loonies: this many for each new slot
export const SLOT_COST = [2, 3, 4, 5];
const RING_TIME = 40;

// a speech mark over a critter's head: ! when it has a job for you, ? when you can finish one
function bubbleTex(ch, fill) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const k = c.getContext("2d");
  k.fillStyle = "#fff8ea"; k.strokeStyle = "#3a2a1a"; k.lineWidth = 4;
  k.beginPath(); k.arc(32, 28, 22, 0, 7); k.fill(); k.stroke();
  k.beginPath(); k.moveTo(24, 46); k.lineTo(32, 60); k.lineTo(38, 46); k.closePath(); k.fill(); k.stroke();
  k.fillStyle = "#fff8ea"; k.fillRect(25, 42, 12, 6);
  k.fillStyle = fill; k.font = "900 32px sans-serif"; k.textAlign = "center"; k.textBaseline = "middle"; k.fillText(ch, 32, 30);
  return new THREE.CanvasTexture(c);
}

export class Quests {
  constructor(G) {
    this.G = G;
    this.npcs = []; this.rings = []; this.ring = null; this.bosses = {};
    this.tex = { "!": bubbleTex("!", "#e0602a"), "?": bubbleTex("?", "#2a8a4a") };
  }
  get S() { return this.G.save; }
  state(id) { return (this.S.quests && this.S.quests[id]) || 0; }
  set(id, v) { this.S.quests[id] = v; }
  // a flat, open spot of dry land near (x, z)
  spot(x, z, r = 1.2) {
    const w = this.G.world, N = new THREE.Vector3();
    for (let k = 0; k < 240; k++) {
      const a = k * 2.4, d = k * 0.35, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = w.height(px, pz);
      if (h < 1.2 || w.normal(px, pz, N).y < 0.85) continue;
      let hit = false; w.near(px, pz, (c) => { if (Math.hypot(c.x - px, c.z - pz) < c.r + r) hit = true; });
      if (!hit && !this.G.test.inBox(px, h + 1, pz)) return { x: px, z: pz };
    }
    return { x, z };
  }
  build() {
    const G = this.G, w = G.world, c = w.cottage, st = w.statue;
    const fort = w.camps[7], east = w.towers.find((t) => t.id === "east");
    // where each friend waits
    const at = {
      pip: this.spot(c.x + 20, c.z - 22),
      chip: this.spot(st.x + 6.5, st.z + 4),
      rocco: this.spot(c.x + (fort.x - c.x) * 0.45 + 8, c.z + (fort.z - c.z) * 0.45),
      gus: this.spot(east.x + 9, east.z + 6),
      marge: this.spot(east.x - 20, east.z + 70),
    };
    // Bruno sits on the shore by a fishing spot, away from the cottage
    const fs = [...w.fishSpots].filter((f) => Math.hypot(f.x - c.x, f.z - c.z) > 90).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
    at.bruno = null;
    if (fs) for (let d = 3; d < 40 && !at.bruno; d += 1.5) for (let a = 0; a < 6.28; a += 0.3) { const x = fs.x + Math.cos(a) * d, z = fs.z + Math.sin(a) * d; if (w.height(x, z) > 1.6) { at.bruno = this.spot(x + Math.cos(a) * 2, z + Math.sin(a) * 2); break; } }
    if (!at.bruno) at.bruno = this.spot(c.x - 90, c.z - 10);
    for (const [id, D] of Object.entries(NPCS)) {
      const p = at[id], rig = M.critter(D.model);
      rig.root.scale.setScalar(D.scale);
      if (D.tint) M.tint(rig.root, D.tint);
      const top = M.headTop(rig.root), hat = M.hat(D.hat, D.col);
      hat.position.copy(top); if (D.hat === "whistle") hat.position.y -= 0.35; hat.scale.setScalar(D.hs);
      rig.root.add(hat);
      const y = G.groundAt(p.x, p.z, 999);
      rig.root.position.set(p.x, y, p.z);
      rig.root.rotation.y = Math.atan2(c.x - p.x, c.z - p.z);
      G.scene.add(rig.root);
      const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex["!"], depthTest: false }));
      bub.scale.set(0.9, 0.9, 1); bub.renderOrder = 6; bub.position.set(p.x, y + top.y * D.scale + 1.3, p.z); G.scene.add(bub);
      w.addCircle(p.x, p.z, 0.6 * Math.max(1, D.scale * 1.5), "npc");
      this.npcs.push({ id, ...D, x: p.x, z: p.z, y, rig, bub, yaw0: rig.root.rotation.y, h: top.y * D.scale, ph: Math.random() * 6 });
    }
    // Pip's frisbee landed on the cottage roof
    const fx = c.x + 3.2, fz = c.z + 1.6, fy = w.cabinTop;
    const fr = M.weaponMesh("frisbee"); fr.rotation.x = -Math.PI / 2 + 0.2; fr.position.set(fx, fy + 0.05, fz);
    G.scene.add(fr);
    this.frisbee = { x: fx, z: fz, y: fy, obj: fr, t: 0 };
    // Coach Gus's course: five rings down the hill from the top of his lookout
    let dir = 0, low = Infinity;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; let s = 0; for (let q = 1; q <= 5; q++) s += w.height(east.x + Math.sin(a) * q * 30, east.z + Math.cos(a) * q * 30); if (s < low) { low = s; dir = a; } }
    for (let k = 0; k < 5; k++) {
      const d = 24 + k * 30, x = east.x + Math.sin(dir) * d + Math.sin(dir + 1.57) * Math.sin(k * 1.3) * 8, z = east.z + Math.cos(dir) * d + Math.cos(dir + 1.57) * Math.sin(k * 1.3) * 8;
      const y = Math.max(east.y - 1 - k * 7, w.height(x, z) + 5);
      const o = M.hoop(); o.position.set(x, y, z); o.rotation.y = dir; o.visible = false; G.scene.add(o);
      this.rings.push({ x, y, z, obj: o });
    }
    this.east = east;
    this.alphaAt = this.spot(560, 120, 3);
  }
  // match the world to a save: finished quests hide what they used
  sync() {
    const S = this.S;
    S.quests = S.quests || {}; S.qd = S.qd || {};
    this.frisbee.obj.visible = this.state("frisbee") < 2 && !S.qd.frisbee;
    for (const k of Object.keys(this.bosses)) { const f = this.bosses[k]; if (f && f.alive) { f.alive = false; f.gone = true; f.rig.root.visible = false; } }
    this.bosses = {};
    this.ring = null;
  }

  /* ---------------- talking ---------------- */
  async talk(n) {
    const G = this.G, S = this.S, say = (lines) => G.ui.say(lines.map((l) => [n.name, l]));
    const q = Object.keys(QUESTS).find((k) => QUESTS[k].giver === n.id), st = q ? this.state(q) : 0;
    G.sfx(n.model === "goose" ? "honk" : "talk");
    if (n.id === "chip") return this.chip(n);
    if (q === "frisbee") {
      if (st === 0 && !S.qd.frisbee) { await say(["Honk! I threw my frisbee way too hard. It's up on the cottage roof!", "I'm too small to climb up there. Can you get it back for me?", "Walk right into the wall and you'll climb. Watch your stamina!"]); this.start(q); }
      else if (st < 2 && S.qd.frisbee) { await say(["My frisbee! You found it!", "You know what? Keep it. Throw it with T and it comes right back to you!"]); this.finish(q, () => G.loot.give("frisbee")); }
      else if (st === 1) await say(["It's up on the cottage roof. Look for something orange!"]);
      else await say(["Throw it at a goose. It comes back every time!"]);
    } else if (q === "fort") {
      if (st === 0) { await say(["Psst. I used to run with the bandits at the fort south of the cottage.", "Their boss wears a crown now. Calls himself the Raccoon King. He took my lunch.", "Knock him off his throne and I'll give you something shiny."]); this.start(q); }
      else if (st === 1 && S.qd.fort) { await say(["You did it! The fort is ours! I mean, it's nobody's.", "Here. I, uh, found this. It's shiny."]); this.finish(q, () => G.loot.give("golden", "mighty")); }
      else if (st === 1) await say(["The fort is the camp south of the cottage. He jumps at you. When he lands, jump the ring!"]);
      else await say(["I'm going straight now. Mostly."]);
    } else if (q === "fish") {
      const have = G.inv.food.fish || 0;
      if (st === 0) { await say(["Hrrm. I'm a big bear, and I'm hungry. But my paws are too big for a fishing rod.", "Bring me three fish? Look for rings on the water and press E to cast."]); this.start(q); }
      else if (st === 1 && have >= 3) { G.inv.food.fish -= 3; await say(["Fish! Real fish! Mmm.", "Take my old pitchfork. I use it to scratch my back, but it's better for poking."]); this.finish(q, () => { G.loot.give("fork", "sturdy"); G.inv.food.syrup += 2; }); }
      else if (st === 1) await say([`Three fish, friend. You have ${have}.`]);
      else await say(["Still thinking about those fish."]);
    } else if (q === "rings") {
      if (st === 0) { await say(["HONK! You there! You call that gliding?", "Climb my lookout and jump off. Fly through all five rings in forty seconds.", "Do it and I'll train your lungs. More stamina for climbing and gliding!"]); this.start(q); }
      else if (st === 1) await say(["Top of the tower. Jump. Open the umbrella. Five rings, forty seconds. GO!"]);
      else await say([S.qd.ringBest ? `Your best is ${S.qd.ringBest.toFixed(1)} seconds. Beat it!` : "Keep flapping, champ."]);
    } else if (q === "alpha") {
      if (st === 0) { await say(["Oh dear. There's a huge moose in the meadow. He calls himself the Alpha.", "He charges anyone who comes near, and when he stomps the whole meadow shakes.", "Could you teach him some manners? Jump over his stomp, then hit him while he rests."]); this.start(q); }
      else if (st === 1 && S.qd.alpha) { await say(["Oh, thank you! The meadow is quiet again.", "He left an antler behind. I had it made into an axe for you. And eat this clover. It makes you stronger."]); this.finish(q, () => { G.loot.give("antler", "mighty"); const P = G.player; P.maxHp += 4; P.hp = P.maxHp; G.ui.toast("You got a Heart Container!"); }); }
      else if (st === 1) await say(["The Alpha roams the east meadow. Be careful, dear."]);
      else await say(["Come by any time. The clover is lovely today."]);
    }
  }
  async chip(n) {
    const G = this.G, S = this.S, have = S.loonies.length - (S.spent || 0), k = (S.slots || 5) - 5;
    const say = (lines) => G.ui.say(lines.map((l) => [n.name, l]));
    if (k >= SLOT_COST.length) { await say(["Your pouch is as big as it gets! Chip-chip!"]); return; }
    const cost = SLOT_COST[k];
    if (have < cost) { await say([`Chip-chip! A bigger weapon pouch costs ${cost} Loonies. You have ${have}.`, "My cousins hide under odd rocks with flowers on top. Lift them!"]); return; }
    await say(["Chip-chip! Loonies! I can sew you a bigger pouch."]);
    const c = await G.ui.choose("Chip's Pouches", `Pay ${cost} Loonies for one more weapon slot? You have ${have}.`, [`Pay ${cost} Loonies`, "Not now"]);
    if (c !== 0) return;
    S.spent = (S.spent || 0) + cost; S.slots = (S.slots || 5) + 1;
    G.sfx("get"); G.ui.got(null, null, { icon: "🎒", name: "A bigger pouch", line: `You can carry ${S.slots - 1} weapons and your plunger` });
    G.writeSave();
  }
  start(q) {
    const G = this.G;
    this.set(q, 1); G.sfx("quest"); G.ui.pop("New quest", "blue");
    G.ui.toast(QUESTS[q].name + ": check the quest log in the pause menu");
    G.writeSave();
  }
  finish(q, reward) {
    const G = this.G;
    this.set(q, 2); reward();
    G.sfx("victory"); G.ui.pop("Quest complete!", "gold");
    if (q === "frisbee") this.frisbee.obj.visible = false;
    G.writeSave();
  }
  // a mini-boss went down
  onKill(f) {
    const S = this.S;
    for (const [q, b] of Object.entries(this.bosses)) if (b === f) { S.qd[q] = 1; this.G.ui.toast("Go tell " + NPCS[QUESTS[q].giver].name + "!", 3); this.G.writeSave(); }
  }

  /* ---------------- every frame ---------------- */
  update(dt) {
    const G = this.G, P = G.player, S = this.S;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - P.x, n.z - P.z);
      n.rig.root.visible = d < 200;
      if (d > 200) { n.bub.visible = false; continue; }
      const want = d < 9 ? Math.atan2(P.x - n.x, P.z - n.z) : n.yaw0, r = n.rig.root;
      r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 4);
      n.ph += dt;
      // a happy bounce when you come close, slow breathing otherwise
      const hop = d < 6 ? Math.max(0, Math.sin(n.ph * 5)) * 0.12 : 0;
      r.position.y = n.y + hop;
      n.rig.body.scale.y = 1 + Math.sin(n.ph * 2) * 0.02;
      const b = this.mark(n);
      n.bub.visible = !!b && d < 90;
      if (b) { n.bub.material.map = this.tex[b]; n.bub.position.y = n.y + n.h + 1.1 + Math.sin(G.time * 3) * 0.12; }
    }
    // the frisbee glints on its ledge
    const fr = this.frisbee;
    if (fr.obj.visible && (fr.t -= dt) <= 0) { fr.t = 1.2; G.fx.flare(fr.x, fr.y + 0.3, fr.z, 0xffb04a, 1.4, 0.5); }
    // mini-bosses come out when their quest is on and you are far enough away not to see them pop in
    this.keepBoss("fort", () => { const c = G.world.camps[7]; return { type: "raccoonKing", x: c.x + 6, z: c.z - 4, home: { x: c.x, z: c.z } }; });
    this.keepBoss("alpha", () => { const p = this.alphaAt; return { type: "mooseAlpha", x: p.x, z: p.z, home: { x: p.x, z: p.z } }; });
    this.updateRings(dt);
    void S;
  }
  keepBoss(q, where) {
    const G = this.G, P = G.player, S = this.S;
    const want = this.state(q) === 1 && !S.qd[q];
    const f = this.bosses[q];
    if (!want) return;
    if (f && (f.alive || !f.gone)) return;
    const w = where();
    if (Math.hypot(w.x - P.x, w.z - P.z) < 70) return;
    this.bosses[q] = G.spawnFoe(w.type, w.x, w.z, w.home);
  }
  // which mark to show over a friend's head
  mark(n) {
    const S = this.S;
    if (n.id === "chip") { const k = (S.slots || 5) - 5; return k < SLOT_COST.length && S.loonies.length - (S.spent || 0) >= SLOT_COST[k] ? "!" : null; }
    const q = Object.keys(QUESTS).find((k) => QUESTS[k].giver === n.id), st = this.state(q);
    if (st === 0) return "!";
    if (st === 1 && this.ready(q)) return "?";
    return null;
  }
  ready(q) {
    const S = this.S, G = this.G;
    if (q === "frisbee") return !!S.qd.frisbee;
    if (q === "fish") return (G.inv.food.fish || 0) >= 3;
    if (q === "fort" || q === "alpha") return !!S.qd[q];
    return false;
  }
  // Coach Gus's course: the clock starts at the first ring
  updateRings(dt) {
    const G = this.G, P = G.player, S = this.S;
    const on = this.state("rings") >= 1;
    const R = this.ring;
    for (let k = 0; k < this.rings.length; k++) {
      const r = this.rings[k], next = R ? R.n : 0;
      r.obj.visible = on && Math.hypot(r.x - P.x, r.z - P.z) < 400;
      if (!r.obj.visible) continue;
      const lit = k === next, done = R && k < R.n;
      r.obj.userData.ring.material.emissiveIntensity = lit ? 0.9 + Math.sin(G.time * 6) * 0.3 : done ? 0.1 : 0.4;
      r.obj.userData.inner.material.opacity = lit ? 0.25 : done ? 0.04 : 0.1;
      r.obj.userData.ring.rotation.z += dt * (lit ? 1.5 : 0.3);
    }
    if (!on) return;
    const next = R ? R.n : 0, r = this.rings[next];
    if (r && Math.hypot(P.x - r.x, P.y + 1 - r.y, P.z - r.z) < 3.4) {
      if (!R) this.ring = { n: 1, t: 0 }; else R.n++;
      G.sfx("ring"); G.fx.spark(r.x, r.y, r.z, 0xffe08a, 12, 1.4);
      if (this.ring.n >= this.rings.length) {
        const t = this.ring.t; this.ring = null;
        const best = S.qd.ringBest;
        if (!best || t < best) S.qd.ringBest = t;
        if (this.state("rings") === 1) { G.ui.say([["Coach Gus", `HONK! ${t.toFixed(1)} seconds! Now that's gliding!`], ["Coach Gus", "Here, breathe like a goose. Your stamina wheel just got bigger."]]).then(() => this.finish("rings", () => { P.staminaMax += 20; P.stamina = P.staminaMax; G.ui.toast("Your stamina wheel grew!"); })); }
        else G.ui.pop(t < (best || 1e9) ? "New best! " + t.toFixed(1) + " s" : t.toFixed(1) + " s", "gold");
        G.writeSave();
      }
      return;
    }
    if (this.ring) {
      this.ring.t += dt;
      // out of time, or back on the ground: the course resets
      if (this.ring.t > RING_TIME || (P.state === "ground" || P.state === "swim")) { this.ring = null; G.sfx("tired"); G.ui.toast("Missed it! Climb back up and try again."); }
    }
  }
  // interaction choices near the hero
  options(opts, d2) {
    const P = this.G.player, S = this.S;
    for (const n of this.npcs) { const d = d2(n.x, n.z); if (d < 2.6 + n.scale) opts.push({ d, label: "Talk to " + n.name, go: () => this.talk(n) }); }
    const fr = this.frisbee;
    if (fr.obj.visible && d2(fr.x, fr.z) < 2 && Math.abs(fr.y - P.y) < 2) opts.push({ d: 0, label: "Pick up Pip's frisbee", go: () => { S.qd.frisbee = 1; fr.obj.visible = false; this.G.sfx("pickup"); this.G.ui.toast("Got Pip's frisbee. Take it back to Pip!"); this.G.writeSave(); } });
  }
  // the mini-boss you are fighting, if any, for the boss bar
  engaged() {
    const P = this.G.player;
    for (const f of this.G.foes) if (f.T.mini && f.alive && f.state !== "idle" && f.state !== "return" && Math.hypot(f.x - P.x, f.z - P.z) < 45) return f;
    return null;
  }
  // one short line for the HUD: the course clock, or the nearest thing to do
  hudLine() {
    const S = this.S, G = this.G;
    if (this.ring) return `⭕ Ring ${this.ring.n + 1} of 5 · ${Math.max(0, RING_TIME - this.ring.t).toFixed(1)} s`;
    for (const q of Object.keys(QUESTS)) {
      if (this.state(q) !== 1) continue;
      if (this.ready(q)) return `${QUESTS[q].icon} ${QUESTS[q].name}: go back to ${NPCS[QUESTS[q].giver].name}`;
      if (q === "fish") return `🐟 ${QUESTS[q].name}: ${G.inv.food.fish || 0} of 3 fish`;
    }
    return "";
  }
  // the quest log: every quest you know about, what to do next, and what you have finished
  log() {
    const S = this.S, out = [];
    for (const [q, Q] of Object.entries(QUESTS)) {
      const st = this.state(q), who = NPCS[Q.giver].name;
      if (st === 0) continue;
      let step = "";
      if (st === 2) step = "Done. " + (q === "rings" && S.qd.ringBest ? `Best time ${S.qd.ringBest.toFixed(1)} s.` : "");
      else if (this.ready(q)) step = `Go back to ${who}.`;
      else step = { frisbee: "Get Pip's frisbee off the cottage roof.", fort: "Beat the Raccoon King at the camp south of the cottage.", fish: `Catch 3 fish for Bruno. You have ${this.G.inv.food.fish || 0}.`, rings: "Climb the Loonie Meadows lookout, jump, and glide through all five rings in 40 seconds.", alpha: "Beat the Moose Alpha in the east meadow. Jump his stomp." }[q];
      out.push({ icon: Q.icon, name: Q.name, who, done: st === 2, step });
    }
    const left = Object.keys(QUESTS).filter((q) => this.state(q) === 0).length;
    return { list: out, left };
  }
  // map markers: friends, and the places active quests send you
  markers(out) {
    const S = this.S, G = this.G;
    for (const n of this.npcs) { const m = this.mark(n); out.push({ kind: "npc", on: !!m, x: n.x, z: n.z, name: n.name, mark: m }); }
    if (this.state("fort") === 1 && !S.qd.fort) { const c = G.world.camps[7]; out.push({ kind: "quest", x: c.x, z: c.z, name: "The Bandit Fort" }); }
    if (this.state("alpha") === 1 && !S.qd.alpha) { const f = this.bosses.alpha; out.push({ kind: "quest", x: f ? f.x : 560, z: f ? f.z : 120, name: "The Moose Alpha" }); }
    if (this.state("frisbee") === 1 && !S.qd.frisbee) out.push({ kind: "quest", x: this.frisbee.x, z: this.frisbee.z, name: "Pip's frisbee" });
    if (this.state("rings") === 1) out.push({ kind: "quest", x: this.east.x, z: this.east.z, name: "The Glide Course" });
  }
  // for the QA scripts
  describe() { return { npcs: this.npcs.map((n) => ({ id: n.id, x: n.x, z: n.z })), rings: this.rings.map((r) => ({ x: r.x, y: r.y, z: r.z })), frisbee: { x: this.frisbee.x, z: this.frisbee.z, y: this.frisbee.y } }; }
}
