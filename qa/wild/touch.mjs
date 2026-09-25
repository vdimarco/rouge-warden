// Phone controls: the left-thumb stick moves the hero, the right side turns the camera, and the buttons work.
import { open, newGame, frames } from "./lib.mjs";

const { browser, page, errors } = await open({ width: 390, height: 844, touch: true });
await newGame(page);
// face west, along the shore, so the walk test does not end in the lake
await page.evaluate(() => { G.paused = false; G.cam.yaw = Math.PI / 2; G.cam.idle = 0; });
const fails = [];
const touch = (type, id, x, y) => page.evaluate(([type, id, x, y]) => {
  const el = document.elementFromPoint(x, y) || window;
  el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
}, [type, id, x, y]);
const vis = await page.evaluate(() => !document.querySelector("#touch").hidden);
if (!vis) fails.push("touch controls hidden on a phone");
// the stick: press on the left, push up
const p0 = await page.evaluate(() => G.player.pos.toArray());
await touch("pointerdown", 1, 90, 650);
for (let k = 1; k <= 6; k++) await touch("pointermove", 1, 90, 650 - k * 10);
await frames(page, 12);
const p1 = await page.evaluate(() => G.player.pos.toArray());
await touch("pointerup", 1, 90, 590);
if (Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.5) fails.push("the stick did not move the hero");
const st = await page.evaluate(() => G.player.state);
if (st !== "ground") fails.push("after walking, the hero is " + st);
// the camera: drag on the right
const y0 = await page.evaluate(() => G.cam.yaw);
await touch("pointerdown", 2, 300, 400);
for (let k = 1; k <= 6; k++) await touch("pointermove", 2, 300 - k * 15, 400);
await touch("pointerup", 2, 210, 400);
await frames(page, 3);
const y1 = await page.evaluate(() => G.cam.yaw);
if (Math.abs(y1 - y0) < 0.05) fails.push("dragging did not turn the camera ");
// the attack and jump buttons
const press = (name, id, test) => page.evaluate(async ([name, id, test]) => {
  const until = (f) => new Promise((res) => { const f0 = G.frame; const k = setInterval(() => { if (eval(test) || G.frame > f0 + 8) { clearInterval(k); res(eval(test)); } }, 30); });
  const f0 = G.frame; while (G.frame < f0 + 1) await new Promise((r) => setTimeout(r, 30));
  const b = document.querySelector('[data-b="' + name + '"]');
  b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: id, pointerType: "touch", bubbles: true }));
  const ok = await until();
  b.dispatchEvent(new PointerEvent("pointerup", { pointerId: id, pointerType: "touch", bubbles: true }));
  return ok;
}, [name, id, test]);
const swung = await press("attack", 3, "!!G.player.attack");
if (!swung) fails.push("the attack button did not swing");
await page.waitForFunction(() => !G.player.attack, null, { timeout: 300000 });
const jumped = await press("jump", 4, "G.player.state === 'air'");
if (!jumped) fails.push("the jump button did not jump");
// nothing on the HUD overlaps the buttons
const overlap = await page.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const out = [];
  for (const b of ['[data-b="attack"]', '[data-b="jump"]', '[data-b="roll"]']) for (const h of ["#wslot", "#fslot", "#mini"]) if (hit(r(b), r(h))) out.push(b + " over " + h);
  return out;
});
if (overlap.length) fails.push("overlaps: " + overlap.join(", "));
if (errors.length) fails.push("errors: " + errors.join(" | "));
await browser.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS: touch");
process.exit(fails.length ? 1 : 0);
