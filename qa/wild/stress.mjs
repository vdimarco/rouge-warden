// Pushes on the edges of the level: runs into every building and cliff, climbs and lets go,
// jumps off towers, glides into walls, and watches for the hero or the camera getting stuck.
import { open, newGame } from "./lib.mjs";

const { browser, page, errors } = await open();
await newGame(page);
const result = await page.evaluate(async () => {
  const P = G.player, I = G.inp, W = G.world;
  const counts = {}, examples = {};
  const note = (k, extra) => { counts[k] = (counts[k] || 0) + 1; if (!examples[k]) examples[k] = { at: P.pos.toArray().map((v) => +v.toFixed(2)), state: P.state, ...extra }; };
  const rnd = QA.rng(7);
  let yieldN = 0;
  const run = async (n, each, label) => {
    let lastP = P.pos.clone(), still = 0;
    for (let i = 0; i < n; i++) {
      if (each) each(i);
      G.test.step(1 / 30);
      G.test.camera(1 / 30);
      I.jump = I.attack = I.roll = I.interact = false;
      for (const b of QA.check()) note(b, { label });
      const c = G.camera.position;
      if (c.y < W.height(c.x, c.z) + 0.2) note("camera-under-ground", { label, cam: c.toArray().map((v) => +v.toFixed(1)) });
      if (G.test.inBox(c.x, c.y, c.z) && !W.boxes.some((b) => b.walk && Math.abs(c.y - b.top) < 1)) note("camera-in-building", { label });
      // stuck: pushing a stick for 6 seconds without moving or climbing
      const pushing = Math.hypot(I.move.x, I.move.y) > 0.5 && !P.exhausted;
      if (pushing && P.pos.distanceTo(lastP) < 0.02) still++; else still = 0;
      lastP.copy(P.pos);
      if (still > 180) { note("stuck", { label }); still = 0; }
      if (G.ui.modal) QA.closeModals();
      if (P.dead) { P.dead = false; }
      if (P.hp < 4) P.hp = P.maxHp;
      if (++yieldN % 400 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  };
  const face = (tx, tz) => { G.cam.yaw = Math.atan2(P.x - tx, P.z - tz); };

  // 1. run, roll, and jump into every building from 12 sides, then strafe along it
  for (const [bi, b] of W.boxes.entries()) {
    if (b.walk) continue;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.28 + rnd() * 0.2, d = Math.max(b.hw, b.hd) + 5;
      QA.closeModals(); P.place(b.x + Math.sin(a) * d, b.z + Math.cos(a) * d); P.stamina = P.staminaMax; P.exhausted = false;
      if (P.state === "swim" || QA.boxAt(P.x, P.y + 0.5, P.z)) continue;
      QA.clear(); face(b.x, b.z); I.move.y = 1;
      const mode = k % 4;
      await run(90, (i) => { if (mode === 1 && i % 20 === 0) I.roll = true; if (mode === 2 && i % 15 === 0) I.jump = true; if (mode === 3) { I.move.x = Math.sin(i / 20); I.sprint = true; } }, "box" + bi);
      // climbing: go sideways, then let go
      await run(90, (i) => { I.move.y = 0.3; I.move.x = i < 45 ? 1 : -1; }, "box-side" + bi);
      await run(1, () => { I.roll = true; }, "let-go");
      QA.clear(); await run(60, null, "fall");
    }
  }
  // 2. walk off every side of every tower top, glide off, and glide back into the tower
  for (const t of W.towers) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.28;
      QA.closeModals(); P.place(t.x, t.z, t.y); P.stamina = P.staminaMax; P.exhausted = false;
      QA.clear(); G.cam.yaw = a + Math.PI; I.move.y = 1;
      await run(30, null, "tower-walk-off");
      await run(1, () => { I.jump = true; }, "tower-glide"); await run(10); await run(1, () => { I.jump = true; });
      await run(60, null, "tower-glide");
      G.cam.yaw = a; // turn back to the tower
      await run(240, null, "tower-glide-back");
    }
  }
  // 3. cliffs: find steep ground and climb it, jump-climb, run out of stamina, fall
  let cliffs = 0;
  for (let k = 0; k < 4000 && cliffs < 40; k++) {
    const x = (rnd() - 0.5) * 1300, z = (rnd() - 0.5) * 1300;
    if (W.normal(x, z).y > 0.65 || W.height(x, z) < 3) continue;
    cliffs++;
    const n = W.normal(x, z);
    QA.closeModals(); P.place(x + n.x * 8, z + n.z * 8); P.stamina = P.staminaMax * (k % 2 ? 1 : 0.3); P.exhausted = false;
    if (P.state === "swim") continue;
    QA.clear(); face(x, z); I.move.y = 1;
    await run(240, (i) => { if (i % 25 === 0) I.jump = true; if (i > 150) I.move.x = 1; }, "cliff");
    QA.clear(); await run(90, null, "cliff-after");
  }
  // 4. swim under the dock and out to the island, and into the island's cliffs
  QA.closeModals(); P.place(W.cottage.x + 1, W.shoreZ - 40, -1.15); P.state = "swim"; P.stamina = P.staminaMax;
  G.cam.yaw = Math.PI / 2; QA.clear(); I.move.y = 1;
  await run(300, (i) => { I.move.x = Math.sin(i / 10); P.stamina = P.staminaMax; }, "swim-dock");
  // 5. the camera in tight spots: inside the cabin porch, under the dock, next to towers
  for (const [x, z] of [[W.cottage.x, W.cottage.z - 6], [W.towers[0].x + 4, W.towers[0].z + 4], [0, -40]]) {
    QA.closeModals(); P.place(x, z);
    for (let k = 0; k < 16; k++) { G.cam.yaw = (k / 16) * 6.28; G.cam.pitch = (k % 4) * 0.4 - 0.4; await run(8, null, "camera"); }
  }
  // 6. critters and bosses stay sane
  let badFoes = 0;
  for (const f of G.foes) if (!f.gone && !(Number.isFinite(f.pos.x) && Number.isFinite(f.pos.y) && f.pos.y > W.height(f.pos.x, f.pos.z) - 1.5)) badFoes++;
  if (badFoes) note("foe-out-of-place", { n: badFoes });
  return { counts, examples, cliffs, boxes: W.boxes.length };
});
console.log(JSON.stringify(result, null, 1));
if (errors.length) console.log("ERRORS\n" + errors.slice(0, 10).join("\n"));
await browser.close();
process.exit(Object.keys(result.counts).length || errors.length ? 1 : 0);
