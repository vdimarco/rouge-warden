// The ways a game can get into a bad state outside the level itself: broken saves, double clicks,
// dying in the middle of a conversation, menus on top of menus, travel in a boss fight, and a graphics reset.
import { open, newGame } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// 1. damaged saves load, or fall back to a clean one, without an error
for (const bad of ["{not json", JSON.stringify({ v: 1 }), JSON.stringify({ v: 1, friend: 9, towers: "x", weapons: [{ id: "laser" }], pos: [1e9, NaN, 3], food: { apple: -5 } }), JSON.stringify({ v: 2, foo: 1 }), "null"]) {
  const { browser, page, errors } = await open({ clear: false });
  await page.evaluate((b) => { localStorage.setItem("plungerd.wild.v1", b); }, bad);
  await page.reload(); await page.waitForSelector("#title:not([hidden])");
  const hasCont = await page.evaluate(() => !document.querySelector("#contBtn").hidden);
  if (hasCont) { await page.click("#contBtn"); } else { await page.click("#newBtn"); }
  await page.waitForFunction(() => window.G && G.started, null, { timeout: 60000 }).catch(() => fails.push("save " + bad.slice(0, 30) + ": game did not start"));
  const st = await page.evaluate(() => ({ p: G.player.pos.toArray(), hp: G.player.hp, w: G.inv.weapons.length }));
  check(st.p.every(Number.isFinite) && Math.abs(st.p[0]) < 780, "save " + bad.slice(0, 30) + ": bad start position " + st.p);
  check(errors.length === 0, "save " + bad.slice(0, 30) + ": " + errors.join(" | "));
  await browser.close();
}

const { browser, page, errors } = await open();
// 2. double-clicking New game starts one game, not two
await page.evaluate(() => { const b = document.querySelector("#newBtn"); b.click(); b.click(); });
await page.waitForFunction(() => window.G && G.started, null, { timeout: 60000 });
const heroes = await page.evaluate(() => G.scene.children.filter((o) => o === G.player.rig.root).length + G.scene.children.filter((o) => o.userData && o.userData.hero).length);
check(heroes === 1, "double click made " + heroes + " heroes");
// finish the intro and install the test helpers without clicking New game again
await page.evaluate(async () => { for (let k = 0; k < 40 && !G.save.intro; k++) { for (let i = 0; i < 80 && G.ui.modal === "dialog"; i++) G.ui.advance(); await new Promise((r) => setTimeout(r, 200)); } });
await newGame(page, { skipClick: true });

const r = await page.evaluate(async () => {
  const out = [], P = G.player, wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // 3. die in the middle of a conversation
  G.ui.say([["Test", "A long line that is still typing when you die."], ["Test", "Second line."]]);
  P.hp = 1; P.invuln = 0; P.roll = 0; if (G.abilities.grit) G.abilities.grit.charges = 0;
  P.hurt(8, P.x + 1, P.z);
  await wait(1800);
  out.push(["death card shows over a dialog (modal=" + G.ui.modal + " dead=" + P.dead + " hp=" + P.hp + ")", G.ui.modal === "choice"]);
  if (G.ui.modal !== "choice") return out;
  document.querySelector("#choice button").click(); await wait(300);
  out.push(["back on your feet", !P.dead && P.hp === P.maxHp && G.ui.modal === null]);
  // 4. pause, map, and help on top of each other, then Escape out of all of them
  G.paused = false;
  document.querySelector("#pauseBtn").click();
  document.querySelector("#pmapBtn").click();
  for (let i = 0; i < 4; i++) document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));
  await wait(100);
  out.push(["menus close", !document.querySelector("#map").hidden === false]);
  G.ui.closeAll(); G.paused = true;
  // 5. travel away in the middle of a boss fight
  const b = G.bosses[0]; P.place(b.center.x + 8, b.center.z + 8); P.hp = P.maxHp;
  for (let i = 0; i < 60; i++) G.test.step(1 / 30);
  out.push(["boss woke up", b.active]);
  QA.closeModals();
  G.travel({ kind: "home", x: G.world.cottage.x, z: G.world.cottage.z });
  for (let i = 0; i < 5; i++) G.test.step(1 / 30);
  out.push(["boss reset after travel", !b.active && b.hp === b.maxHp && document.querySelector("#bossbar").hidden]);
  // 6. start a trial and walk away
  const s = G.world.shrines[1]; P.place(s.x + Math.sin(s.rot) * 2.2, s.z + Math.cos(s.rot) * 2.2);
  G.inp.interact = true; G.test.step(1 / 30); G.inp.interact = false;
  out.push(["trial started", !!G.trial]);
  P.place(G.world.cottage.x, G.world.cottage.z - 20); G.test.step(1 / 30);
  out.push(["trial ended when you left", !G.trial]);
  // 7. praying with too few orbs does nothing
  G.save.orbs = 2; P.place(G.world.statue.x + 2, G.world.statue.z); G.inp.interact = true; G.test.step(1 / 30); G.inp.interact = false;
  out.push(["no prayer without 4 orbs", G.ui.modal !== "choice"]);
  // 7b. fishing: a catch adds fish; moving reels the line in; a hit ends it; the kayak goes home when you travel
  const W = G.world, f = W.fishSpots[0];
  P.place(W.cottage.x, W.cottage.z - 20); QA.closeModals(); f.rest = 0;
  const fish0 = G.inv.food.fish || 0;
  G.fishing.start(f); G.fishing.s.wait = 0.1;
  for (let i = 0; i < 60 && G.fishing.s.phase !== "bite"; i++) G.test.step(1 / 30);
  G.inp.attack = true; G.test.step(1 / 30); G.inp.attack = false;
  out.push(["hooked a fish (" + (G.fishing.s && G.fishing.s.phase) + ")", G.fishing.s && G.fishing.s.phase === "reel"]);
  for (let i = 0; i < 1500 && G.fishing.s && G.fishing.s.phase === "reel"; i++) { const s = G.fishing.s; G.inp.attackHeld = s.z + s.zv * 0.25 < s.f; G.test.step(1 / 30); }
  G.inp.attackHeld = false;
  for (let i = 0; i < 90; i++) G.test.step(1 / 30);
  out.push(["caught a fish (" + fish0 + " -> " + G.inv.food.fish + ")", (G.inv.food.fish || 0) > fish0 && !G.fishing.active && P.weaponMesh.visible]);
  f.rest = 0; G.fishing.start(f); G.test.step(1 / 30); G.inp.move.x = 1; G.test.step(1 / 30); G.inp.move.x = 0;
  out.push(["moving reels the line in", !G.fishing.active]);
  f.rest = 0; G.fishing.start(f); P.invuln = 0; P.roll = 0; if (G.abilities.grit) G.abilities.grit.charges = 0; P.hurt(1, P.x + 1, P.z);
  out.push(["a hit ends fishing", !G.fishing.active && !P.fishing]);
  P.hp = P.maxHp;
  const K = W.kayak; P.place(K.x - 1.5, K.z + 2); P.boardKayak(); for (let i = 0; i < 90; i++) { G.inp.move.y = 1; G.test.step(1 / 30); } G.inp.move.y = 0;
  G.travel({ kind: "home", x: W.cottage.x, z: W.cottage.z }); for (let i = 0; i < 5; i++) G.test.step(1 / 30);
  out.push(["travel from the kayak puts you on land (" + P.state + ")", P.state === "ground" && !K.rider]);
  P.place(W.towers[0].x + 5, W.towers[0].z + 5); G.test.step(1 / 30);
  out.push(["the kayak drifts home when you are far away", Math.hypot(K.x - K.home.x, K.z - K.home.z) < 0.01]);
  // 8. a whole day and night passes; critters come back; no leaks
  const n0 = G.scene.children.length;
  for (let i = 0; i < 600 * 30 + 30; i++) { G.test.step(1 / 30); if (G.ui.modal) QA.closeModals(); if (P.hp < 4) P.hp = P.maxHp; if (i % 2000 === 0) await wait(0); }
  out.push(["a day passed", G.save.day >= 2]);
  out.push(["scene did not grow by more than 60 objects in a day: " + (G.scene.children.length - n0), G.scene.children.length - n0 < 60]);
  return out;
});
for (const [m, ok] of r) check(ok, m);
// 9. resize a lot while playing
await page.evaluate(() => { G.paused = false; });
for (const [w, h] of [[390, 844], [1280, 720], [320, 480], [1920, 1080], [640, 360]]) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); }
// 10. the graphics card resets
const lost = await page.evaluate(() => { const ext = G.renderer.getContext().getExtension("WEBGL_lose_context"); if (!ext) return false; ext.loseContext(); return true; });
if (lost) { await page.waitForTimeout(500); check(await page.evaluate(() => !document.querySelector("#loading").hidden), "no message after the graphics reset"); }
check(errors.length === 0, "errors: " + errors.join(" | "));
await browser.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS: flows");
process.exit(fails.length ? 1 : 0);
