// Checks every place in the level: can you climb each tower from every side, reach each outhouse door,
// open each cooler, pick up each item, and reach each Loonie?
import { open, newGame } from "./lib.mjs";

const { browser, page, errors } = await open();
await newGame(page);
const report = await page.evaluate(() => {
  const W = G.world, P = G.player, I = G.inp, out = { fails: [], notes: [] };
  const fail = (m) => out.fails.push(m);
  const solidNear = (x, z, r) => { let hit = null; W.near(x, z, (c) => { if (Math.hypot(c.x - x, c.z - z) < c.r + r) hit = c; }); return hit; };

  // 1. every tower, from 8 sides, with normal stamina
  for (const t of W.towers) {
    let ok = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      P.place(t.x + Math.sin(a) * 10, t.z + Math.cos(a) * 10);
      P.stamina = P.staminaMax; P.exhausted = false; P.hp = P.maxHp;
      G.cam.yaw = a; // forward points at the tower
      QA.clear(); I.move.y = 1;
      let top = false, n = 0;
      QA.step(1500, () => { n++; if (P.state === "ground" && P.y > t.y - 0.6) top = true; if (top) I.move.y = 0; });
      if (top) ok++; else fail(`tower ${t.id} side ${k}: stuck at y=${P.y.toFixed(1)} state=${P.state} stamina=${P.stamina.toFixed(0)}`);
    }
    out.notes.push(`tower ${t.id}: climbed from ${ok}/8 sides`);
    // the pedestal can be used from the top
    P.place(t.x + 1, t.z + 1, t.y); QA.clear();
    const was = G.save.towers.includes(t.id);
    QA.step(1, () => { I.interact = true; }); QA.closeModals();
    if (!was && !G.save.towers.includes(t.id)) fail(`tower ${t.id}: pedestal did not light`);
  }
  // 2. outhouse doors: dry, flat, and free of rocks and trees
  for (const s of W.shrines) {
    const fx = s.x + Math.sin(s.rot) * 2.2, fz = s.z + Math.cos(s.rot) * 2.2;
    const h = W.height(fx, fz), n = W.normal(fx, fz).y;
    if (h < 1) fail(`shrine ${s.id}: door is in water (h=${h.toFixed(1)})`);
    if (n < 0.8) fail(`shrine ${s.id}: door is on a slope (ny=${n.toFixed(2)})`);
    const c = solidNear(fx, fz, 0.5); if (c) fail(`shrine ${s.id}: a ${c.kind} blocks the door`);
    // trial critters must spawn on dry land
    const list = 5;
    for (let k = 0; k < list; k++) { const a = s.rot + (k / list) * 6.28 + 1, x = s.x + Math.sin(a) * 11, z = s.z + Math.cos(a) * 11; if (W.height(x, z) < 0.5) fail(`shrine ${s.id}: trial critter ${k} would spawn in water`); }
  }
  // 3. coolers and campfires
  for (const c of W.camps) {
    const x = c.cooler.position.x, z = c.cooler.position.z;
    if (W.height(x, z) < 1) fail(`camp ${c.i}: cooler in water`);
    const s = solidNear(x, z, 1.2); if (s) fail(`camp ${c.i}: cooler blocked by a ${s.kind}`);
  }
  // 4. food: not in water, not inside a rock or tree
  let badFood = 0;
  for (const it of G.items) { if (it.y < 1 || solidNear(it.x, it.z, 0.3)) badFood++; }
  if (badFood) fail(`${badFood} food items sit in water or inside a rock or tree`);
  // 5. Loonies: rocks on dry land and not buried; floating ones close to something you can stand on
  G.loonies.forEach((l, i) => {
    if (l.kind === "rock") { if (l.y < 1.5) fail(`loonie ${i}: rock in water`); const s = solidNear(l.x, l.z, 1.4); if (s && s.kind !== "secret") fail(`loonie ${i}: rock blocked by a ${s.kind}`); }
    else { const g = G.groundAt(l.x, l.z, l.y + 0.5); if (l.y - g > 2.6) fail(`loonie ${i}: floats ${(l.y - g).toFixed(1)} above the ground`); if (g < -0.5) fail(`loonie ${i}: over water`); }
  });
  // 6. the crew at the cottage do not stand inside things
  for (const n of G.npcs) { if (QA.boxAt(n.x, n.y + 1, n.z)) fail(`npc ${n.name} inside a building`); }
  // 7. boss arenas are flat and dry
  for (const b of G.bosses) {
    let steep = 0, wet = 0;
    for (let a = 0; a < 6.28; a += 0.4) for (const r of [4, 10, 16]) { const x = b.center.x + Math.cos(a) * r, z = b.center.z + Math.sin(a) * r; if (W.normal(x, z).y < 0.8 && !QA.boxAt(x, W.height(x, z) + 1, z)) steep++; if (G.groundAt(x, z, 99) < 0.5) wet++; }
    if (steep > 3) fail(`boss ${b.id}: ${steep} steep spots in the arena`);
    if (wet) fail(`boss ${b.id}: ${wet} wet spots in the arena`);
  }
  // 8. walk down the short dock, get in the kayak, paddle to the island, get out, and walk up
  const c = W.cottage, K = W.kayak; P.place(c.x, W.shoreZ + 4); G.cam.yaw = 0; QA.clear(); I.move.y = 1;
  QA.step(600, () => { if (P.z <= K.z + 0.3) I.move.y = 0; });
  QA.clear(); I.interact = true; QA.step(1);
  if (P.state !== "kayak") fail(`kayak: could not get in from the dock end (${P.x.toFixed(1)}, ${P.z.toFixed(1)}), ${Math.hypot(P.x - K.x, P.z - K.z).toFixed(1)} m away`);
  else {
    let landed = false, reached = false, k = 0;
    QA.step(3600, () => {
      k++;
      if (!landed) { I.move.y = 1; if (P.state === "kayak" && P.z < -2 && k % 10 === 0) I.interact = true; if (P.state === "ground") landed = true; }
      else { I.move.y = reached ? 0 : 1; if (P.state === "ground" && P.y > 5) reached = true; }
    });
    if (!landed) fail(`kayak: paddled to (${P.x.toFixed(0)}, ${P.z.toFixed(0)}) state ${P.state} but found nowhere to get out`);
    else if (!reached) fail(`kayak: got out at the island but could not walk up, at (${P.x.toFixed(0)}, ${P.y.toFixed(1)}, ${P.z.toFixed(0)}) state ${P.state}`);
    else out.notes.push("kayak: paddled to the island and walked up");
  }
  // 9. every fishing spot is in water deep enough, and you can reach it from land or the kayak
  for (const f of W.fishSpots) {
    if (W.height(f.x, f.z) > -1.5) fail(`fish spot ${f.id}: too shallow`);
    let fromLand = false;
    for (let a = 0; a < 6.28 && !fromLand; a += 0.2) for (const r of [4, 7, 10, 13]) { const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r; if (G.groundAt(x, z, 99) > 0.5 && W.normal(x, z).y > 0.72) fromLand = true; }
    if (!fromLand && W.height(f.x, f.z) > -0.6) fail(`fish spot ${f.id}: no way to reach`);
  }
  out.notes.push("fish spots: " + W.fishSpots.length);
  return out;
});
console.log(report.notes.join("\n"));
console.log(report.fails.length ? "FAIL\n" + report.fails.join("\n") : "PASS: level checks");
if (errors.length) console.log("ERRORS\n" + errors.join("\n"));
await browser.close();
process.exit(report.fails.length || errors.length ? 1 : 0);
