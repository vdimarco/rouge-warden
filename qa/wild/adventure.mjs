// Checks the adventure systems: every weapon and its combo, modifiers, the break bonus, throwing and picking up,
// the frisbee that comes back, a full pouch, treasure chests, locked camp coolers, all five side quests,
// Chip's bigger pouch, the two mini-bosses, and that a save with all of this loads again.
import { open, newGame } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const { browser, page, errors } = await open({ width: 800, height: 450 });
await newGame(page);

// helpers inside the page
await page.evaluate(() => {
  const P = G.player;
  QA.tick = () => new Promise((r) => setTimeout(r, 0));
  // a critter standing still in front of the hero, far from everything else
  QA.dummy = (type = "bear", d = 2.4) => { const f = G.spawnFoe(type, P.x + Math.sin(P.yaw) * d, P.z + Math.cos(P.yaw) * d); f.hp = f.T.hp = 9999; f.update = function () { this.animate(0, 0); }; return f; };
  QA.clearFoes = () => { for (const f of G.foes) { f.alive = false; f.gone = true; f.rig.root.visible = false; } };
  QA.near = (x, z, d = 1.4) => { const w = G.world; for (let a = 0; a < 6.28; a += 0.4) { const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (w.height(px, pz) > 0.5 && !QA.boxAt(px, w.height(px, pz) + 1, pz)) { P.place(px, pz); P.yaw = Math.atan2(x - px, z - pz); return true; } } P.place(x, z + d); return false; };
  QA.talk = async (id) => { const n = G.quests.npcs.find((q) => q.id === id); QA.near(n.x, n.z, 1.6 + n.scale); G.inp.interact = true; QA.step(1); for (let k = 0; k < 6; k++) { QA.closeModals(); await QA.tick(); } };
});

/* ---------------- weapons ---------------- */
const w = await page.evaluate(async () => {
  const P = G.player, L = G.loot, out = { bad: [], combo: {} };
  P.place(G.world.cottage.x - 30, G.world.cottage.z + 30); P.yaw = 0; QA.step(2);
  QA.clearFoes();
  const list = ["plunger", "branch", "stick", "lacrosse", "pan", "torch", "frisbee", "golden", "paddle", "broom", "antler", "rod", "pole", "fork"];
  G.save.slots = 9;
  for (const id of list) {
    G.inv.weapons.length = 1; if (id !== "plunger") L.add(id); else L.equip(0);
    if (P.weaponId !== id) out.bad.push(id + ": not held");
    if (!(P.tipY > 0.3)) out.bad.push(id + ": no mesh");
    // one full combo on a dummy
    const f = QA.dummy("bear", 2.2); P.yaw = Math.atan2(f.x - P.x, f.z - P.z);
    const hp0 = f.hp; let seen = new Set();
    for (let i = 0; i < 90; i++) { G.inp.attack = i % 4 === 0; QA.step(1); if (P.attack && !P.attack.spin) seen.add(P.attack.n); }
    out.combo[id] = { n: seen.size, dmg: Math.round(hp0 - f.hp), kind: P.weapon.kind };
    f.alive = false; f.gone = true; f.rig.root.visible = false;
    QA.step(10);
  }
  // modifiers
  const { weaponStats, maxDur } = await import("./js/player.js");
  out.mighty = weaponStats("stick", "mighty").dmg / weaponStats("stick").dmg;
  out.sturdy = maxDur("stick", "sturdy") / maxDur("stick");
  out.keen = weaponStats("stick", "keen").crit;
  return out;
});
console.log(JSON.stringify(w));
check(w.bad.length === 0, "weapons: " + w.bad.join(", "));
for (const [id, c] of Object.entries(w.combo)) {
  const want = c.kind === "two" ? 2 : 3;
  check(c.n === want, `${id}: combo had ${c.n} swings, not ${want}`);
  check(c.dmg > 0, `${id}: the combo did no damage`);
}
check(w.combo.antler.dmg > w.combo.branch.dmg, "the antler axe should hit harder than a branch");
check(Math.abs(w.mighty - 1.35) < 0.01 && Math.abs(w.sturdy - 1.6) < 0.05 && w.keen === 0.15, "modifiers are wrong: " + JSON.stringify([w.mighty, w.sturdy, w.keen]));

/* ---------------- breaking, throwing, the frisbee, a full pouch ---------------- */
const t = await page.evaluate(async () => {
  const P = G.player, L = G.loot, out = {};
  QA.clearFoes(); G.inv.weapons.length = 1; G.save.slots = 5;
  // the last hit before a weapon breaks does double damage, and the best weapon left comes to hand
  L.add("pan"); L.add("stick"); G.inv.weapons[2].dur = 1;
  let f = QA.dummy("bear", 2); P.yaw = Math.atan2(f.x - P.x, f.z - P.z);
  const hp0 = f.hp; G.inp.attack = true; QA.step(20);
  out.breakDmg = hp0 - f.hp; out.afterBreak = P.weaponId; out.pouch = G.inv.weapons.map((w) => w.id).join();
  f.alive = false; f.gone = true; QA.step(5);
  // throw the pan at a critter: it hits hard, leaves the pouch, and lands on the ground
  L.equip(1); f = QA.dummy("bear", 6); P.yaw = Math.atan2(f.x - P.x, f.z - P.z);
  const hp1 = f.hp, g0 = L.ground.length; G.inp.throw = true; QA.step(60);
  out.throwDmg = hp1 - f.hp; out.thrownGone = !G.inv.weapons.some((w) => w.id === "pan"); out.landed = L.ground.length - g0;
  const pan = L.ground.find((g) => g.id === "pan");
  f.alive = false; f.gone = true;
  // walk over and pick it back up
  if (pan) { P.place(pan.x + 0.8, pan.z); QA.step(2); G.inp.interact = true; QA.step(2); }
  out.pickedUp = G.inv.weapons.some((w) => w.id === "pan");
  // the frisbee comes back
  L.add("frisbee"); f = QA.dummy("goose", 8); P.yaw = Math.atan2(f.x - P.x, f.z - P.z);
  const hp2 = f.hp; G.inp.throw = true; QA.step(10); out.frisOut = L.flying.length === 1 && !P.weaponMesh.visible;
  QA.step(120);
  out.frisHit = hp2 - f.hp; out.frisBack = G.inv.weapons.some((w) => w.id === "frisbee") && L.flying.length === 0 && P.weaponMesh.visible;
  f.alive = false; f.gone = true;
  // a full pouch: picking up swaps out a weapon, which lands on the ground
  while (!L.full()) L.add("branch");
  const n0 = G.inv.weapons.length, it = L.drop("antler", "mighty", undefined, P.x + 1, P.z);
  P.place(it.x + 0.6, it.z); QA.step(1); G.inp.interact = true; QA.step(2);
  out.swap = { n0, n1: G.inv.weapons.length, has: G.inv.weapons.some((w) => w.id === "antler" && w.mod === "mighty"), cur: P.weapon.name };
  G.ui.hud(); out.pouchBar = document.querySelectorAll("#wbar i").length;
  return out;
});
console.log(JSON.stringify(t));
check(t.breakDmg > 0 && t.afterBreak === "pan" && t.pouch === "plunger,pan", "breaking: " + JSON.stringify(t));
check(t.throwDmg >= 20 && t.thrownGone && t.landed === 1 && t.pickedUp, "throwing: " + JSON.stringify(t));
check(t.frisOut && t.frisHit > 0 && t.frisBack, "the frisbee did not fly out, hit, and come back: " + JSON.stringify(t));
check(t.swap.n1 === t.swap.n0 && t.swap.has && /Mighty Antler Axe/.test(t.swap.cur), "a full pouch did not swap: " + JSON.stringify(t.swap));
check(t.pouchBar === 5, "the pouch bar shows " + t.pouchBar + " slots");

/* ---------------- chests and camp coolers ---------------- */
const c = await page.evaluate(async () => {
  const P = G.player, L = G.loot, out = {};
  QA.clearFoes(); G.inv.weapons.length = 1; L.equip(0);
  const per = {}; for (const ch of L.chests) { const t = G.world.towerOf(ch.x, ch.z); per[t] = (per[t] || 0) + 1; }
  out.count = L.chests.length; out.per = per;
  const ch = L.chests[0];
  QA.near(ch.x, ch.z, 1.6); QA.step(1);
  out.label = document.querySelector("#ptext").textContent;
  G.inp.interact = true; QA.step(1);
  await new Promise((r) => setTimeout(r, 900)); QA.step(30);
  out.opened = G.save.chests.includes(ch.i) && ch.open;
  out.got = document.querySelector("#got").classList.contains("show") ? document.querySelector("#gotName").textContent : "";
  out.gave = ch.loot.id ? G.inv.weapons.some((w) => w.id === ch.loot.id) || L.ground.some((g) => g.id === ch.loot.id) : true;
  const lit = G.save.towers.slice(); G.save.towers.push("south", "east", "west", "north");
  out.markers = [...new Set(G.ui.markers().map((m) => m.kind))].join();
  G.save.towers = lit;
  // a camp cooler stays locked until its critters are down
  const camp = G.world.camps[0];
  for (const p of G.plan) if (p.camp === 0) { if (p.foe) { p.foe.alive = false; p.foe.gone = true; } p.foe = G.spawnFoe(p.type, p.x, p.z, p.home); }
  G.save.coolers = {};
  QA.near(camp.cooler.position.x, camp.cooler.position.z, 1.5);
  for (const f of G.foes) if (f.alive) f.state = "idle";
  QA.step(1);
  out.locked = document.querySelector("#ptext").textContent;
  for (const p of G.plan) if (p.camp === 0 && p.foe.alive) p.foe.hurt(9999, P.x, P.z, 0);
  QA.step(1);
  out.unlocked = document.querySelector("#ptext").textContent;
  G.inp.interact = true; QA.step(1);
  out.cooled = G.save.coolers[0] === G.save.day;
  return out;
});
console.log(JSON.stringify(c));
check(c.count === 16 && Object.values(c.per).every((n) => n === 4), "chests: " + JSON.stringify(c.per));
check(c.label === "Open the chest" && c.opened && c.got && c.gave, "opening a chest: " + JSON.stringify(c));
check(/Locked · \d critters? left/.test(c.locked) && c.unlocked === "Open the cooler" && c.cooled, "the camp cooler lock: " + JSON.stringify(c));
check(/chest/.test(c.markers) && /npc/.test(c.markers), "map markers: " + c.markers);

/* ---------------- side quests ---------------- */
const q = await page.evaluate(async () => {
  const P = G.player, S = G.save, Q = G.quests, out = {};
  QA.clearFoes(); G.inv.weapons.length = 1; G.save.slots = 9; G.loot.equip(0);
  // Pip: find the frisbee on the cottage roof
  await QA.talk("pip"); out.pip1 = Q.state("frisbee");
  P.place(Q.frisbee.x + 0.6, Q.frisbee.z, Q.frisbee.y); QA.step(1);
  out.roofLabel = document.querySelector("#ptext").textContent;
  G.inp.interact = true; QA.step(1);
  await QA.talk("pip"); out.pip2 = Q.state("frisbee"); out.frisbee = G.inv.weapons.some((w) => w.id === "frisbee");
  // Rocco: the Raccoon King at the fort
  await QA.talk("rocco"); out.fort1 = Q.state("fort");
  QA.step(2); const king = Q.bosses.fort; out.kingSpawned = !!(king && king.alive && king.type === "raccoonKing");
  if (king) { P.place(king.x + 3, king.z); king.hurt(king.hp * 0.5, P.x, P.z, 0); out.minions = G.foes.filter((f) => f.alive && f.type === "raccoon" && f.minion).length; king.hurt(9999, P.x, P.z, 0); QA.step(5); }
  await QA.talk("rocco"); out.fort2 = Q.state("fort"); out.golden = G.inv.weapons.some((w) => w.id === "golden" && w.mod === "mighty");
  // Bruno: three fish
  await QA.talk("bruno"); G.inv.food.fish = 3; await QA.talk("bruno"); out.fish = Q.state("fish"); out.fishLeft = G.inv.food.fish;
  // Coach Gus: five rings in order, gliding
  await QA.talk("gus"); out.rings1 = Q.state("rings");
  const st0 = P.staminaMax;
  for (const r of Q.rings) { P.pos.set(r.x, r.y - 1, r.z); P.state = "glide"; Q.updateRings(1 / 30); Q.updateRings(1 / 30); }
  for (let k = 0; k < 6; k++) { QA.closeModals(); await QA.tick(); }
  out.rings2 = Q.state("rings"); out.stamina = P.staminaMax - st0; out.best = S.qd.ringBest;
  P.place(G.world.cottage.x, G.world.cottage.z - 20); QA.step(2);
  // Marge: the Moose Alpha
  await QA.talk("marge"); out.alpha1 = Q.state("alpha");
  P.place(G.world.cottage.x, G.world.cottage.z - 20); QA.step(2);
  const alpha = Q.bosses.alpha; out.alphaSpawned = !!(alpha && alpha.type === "mooseAlpha");
  if (alpha) alpha.hurt(9999, alpha.x + 1, alpha.z, 0);
  const hp0 = P.maxHp;
  await QA.talk("marge"); out.alpha2 = Q.state("alpha"); out.heart = P.maxHp - hp0;
  // Chip: Loonies for a bigger pouch
  S.slots = 5; S.loonies = [0, 1, 2, 3]; S.spent = 0;
  await QA.talk("chip");
  out.slots = S.slots; out.spent = S.spent;
  // the quest log
  G.ui.openQuests(); out.log = document.querySelectorAll("#qlist .q").length; out.logDone = document.querySelectorAll("#qlist .q.done").length; G.ui.close("quests");
  return out;
});
console.log(JSON.stringify(q));
check(q.pip1 === 1 && q.roofLabel === "Pick up Pip's frisbee" && q.pip2 === 2 && q.frisbee, "Pip's frisbee: " + JSON.stringify(q));
check(q.fort1 === 1 && q.kingSpawned && q.minions >= 1 && q.fort2 === 2 && q.golden, "the Bandit Fort: " + JSON.stringify(q));
check(q.fish === 2 && q.fishLeft === 0, "Bruno's fish: " + JSON.stringify(q));
check(q.rings1 === 1 && q.rings2 === 2 && q.stamina === 20 && q.best > 0, "the glide course: " + JSON.stringify(q));
check(q.alpha1 === 1 && q.alphaSpawned && q.alpha2 === 2 && q.heart === 4, "the Moose Alpha: " + JSON.stringify(q));
check(q.slots === 6 && q.spent === 2, "Chip's pouch: " + JSON.stringify(q));
check(q.log === 5 && q.logDone === 5, "the quest log shows " + q.log + " quests, " + q.logDone + " done");

/* ---------------- the mini-bosses fight ---------------- */
const m = await page.evaluate(async () => {
  const P = G.player, out = { states: {} };
  QA.clearFoes(); P.maxHp = P.hp = 400;
  const spot = QA.landSpot(QA.rng(7));
  P.place(spot[0], spot[1]);
  for (const type of ["raccoonKing", "mooseAlpha"]) {
    const f = G.spawnFoe(type, P.x + 12, P.z, { x: P.x + 12, z: P.z }); f.alert();
    let rings = 0, bar = false, n = G.hazards.rings.length;
    for (let i = 0; i < 30 * 25 && f.alive; i++) { QA.step(1); out.states[type + ":" + f.state] = 1; if (G.hazards.rings.length > n) rings++; n = G.hazards.rings.length; if (!document.querySelector("#bossbar").hidden) bar = true; P.hp = P.maxHp; }
    out[type] = { rings, bar, alive: f.alive };
    f.alive = false; f.gone = true; f.rig.root.visible = false; G.hazards.clear(); QA.step(3);
  }
  return out;
});
console.log(JSON.stringify(m));
check(m.states["raccoonKing:leap"], "the Raccoon King never leapt");
check(m.raccoonKing.rings > 0 && m.mooseAlpha.rings > 0, "no landing or stomp rings: " + JSON.stringify(m));
check(m.raccoonKing.bar || m.mooseAlpha.bar, "no boss bar for a mini-boss");

/* ---------------- the save loads back ---------------- */
await page.evaluate(() => { G.loot.add("fork", "keen"); G.writeSave(); });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("plungerd.wild.v1")));
await page.reload();
await page.waitForSelector("#title:not([hidden])", { timeout: 300000 });
await page.click("#tpress"); await page.waitForSelector("#tmenu:not([hidden])");
await page.click("#contBtn");
await page.waitForFunction(() => window.G && G.started, null, { timeout: 120000 });
const back = await page.evaluate(() => ({ slots: G.save.slots, chests: G.save.chests.length, quests: Object.values(G.save.quests).filter((v) => v === 2).length, keen: G.inv.weapons.some((w) => w.id === "fork" && w.mod === "keen"), held: G.player.weapon.name, openChests: G.loot.chests.filter((c) => c.open).length, frisHidden: !G.quests.frisbee.obj.visible }));
console.log(JSON.stringify(back));
check(back.slots === saved.slots && back.chests === saved.chests.length && back.quests === 5 && back.keen && back.openChests === saved.chests.length && back.frisHidden, "the save did not load back: " + JSON.stringify(back));

check(errors.length === 0, "errors: " + errors.join(" | "));
await browser.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS: adventure");
process.exit(fails.length ? 1 : 0);
