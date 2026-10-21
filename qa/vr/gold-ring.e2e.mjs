// The gold-ring lesson: the rope lands on the tower, the left button is the left rope, the right button
// the right rope, at 1280 and again in a phone-shaped window. 0 page errors.
// NODE_PATH=qa/browser/node_modules node qa/vr/gold-ring.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("gold-ring");
watchdog(300000, "gold-ring");
const out = process.env.SHOTS || "/opt/cursor/artifacts/easy-swing";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});

try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => {
    G.renderer.setAnimationLoop(null);
    G.test.hold(true);
    G.test.settings({ verse: "off", bloom: "off" });
  });

  const run = await page.evaluate(() => {
    const S = G.city.start, R = G.city.goldRing;
    const canvas = document.querySelector("canvas");
    const down = (button) => canvas.dispatchEvent(new MouseEvent("mousedown", { button, bubbles: true, cancelable: true }));
    const up = (button) => document.dispatchEvent(new MouseEvent("mouseup", { button, bubbles: true }));
    const place = () => {
      up(0); up(2);
      if (G.game && G.game.progress) G.game.progress.tutorial = 0;
      G.test.teleport(S.x, S.y, S.z);
      G.test.face(R.x, R.z);
      if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, -0.42); }
      G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
      for (let i = 0; i < 20; i++) {
        G.test.step(1 / 60, 1);
        if (G.P.ropes.every((r) => r.state === "idle")) break;
      }
      G.test.step(1 / 60, 6);
    };
    const shot = (button) => {
      place();
      const mark = G.frame;
      down(button);
      let rope = null;
      for (let n = 0; n < 20; n++) {
        G.test.step(1 / 60, 1);
        const live = G.P.ropes.find((r) => r.state !== "idle");
        if (live) { rope = { side: G.P.ropes.indexOf(live), tag: live.target && live.target.tag, x: live.anchor.x, y: live.anchor.y, z: live.anchor.z, state: live.state }; break; }
      }
      const fires = G.test.events().filter((e) => e.type === "fire" && e.frame > mark).map((e) => e.side);
      return { rope, fires, tut: G.game && G.game.progress && G.game.progress.tutorial };
    };
    const left = [], right = [];
    let tower = 0;
    for (let i = 0; i < 30; i++) {
      const s = shot(0);
      if (i < 10) left.push(s);
      const on = s.rope && s.rope.side === 0 && s.rope.tag === "building" && Math.abs(s.rope.x - R.x) < 2;
      if (on) tower++;
    }
    up(0);
    for (let i = 0; i < 10; i++) right.push(shot(2));
    up(2);
    place();
    down(0);
    for (let n = 0; n < 20; n++) { G.test.step(1 / 60, 1); if (G.P.ropes.some((r) => r.state === "attached")) break; }
    G.test.render(0);
    const held = G.P.ropes.map((r) => ({ state: r.state, tag: r.target && r.target.tag, x: +r.anchor.x.toFixed(2), y: +r.anchor.y.toFixed(2) }));
    return {
      w: innerWidth, h: innerHeight, tower, left, right, held, tut: G.game.progress.tutorial,
      ring: { x: R.x, y: R.y, z: R.z },
    };
  });

  await page.screenshot({ path: out + "/gold-ring-1280x800.png" });
  const leftOk = run.left.length === 10 && run.left.every((s) => s.fires.length === 1 && s.fires[0] === 0 && s.rope && s.rope.side === 0);
  const rightOk = run.right.length === 10 && run.right.every((s) => s.fires.length === 1 && s.fires[0] === 1 && s.rope && s.rope.side === 1);
  console.log("1280", JSON.stringify({ w: run.w, h: run.h, tower: run.tower, tut: run.tut, held: run.held, left0: run.left[0], right0: run.right[0] }));
  check(run.w === 1280 && run.tower === 30, "at 1280, 30 of 30 ropes from the gold-ring lesson attach to the tower", { tower: run.tower, w: run.w, held: run.held });
  check(leftOk, "the left button fires the left rope 10 of 10 at 1280", run.left.map((s) => s.fires));
  check(rightOk, "the right button fires the right rope 10 of 10 at 1280", run.right.map((s) => s.fires));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    dispatchEvent(new Event("resize"));
    const S = G.city.start, R = G.city.goldRing;
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
    if (G.game && G.game.progress) G.game.progress.tutorial = 0;
    G.test.teleport(S.x, S.y, S.z);
    G.test.face(R.x, R.z);
    if (G.flatcam) G.flatcam.reset(G.rigYaw, -0.42);
    G.test.step(1 / 60, 8);
    document.querySelector("canvas").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
    for (let n = 0; n < 20; n++) { G.test.step(1 / 60, 1); if (G.P.ropes.some((r) => r.state === "attached")) break; }
    G.test.render(0);
    return innerWidth;
  });
  await page.screenshot({ path: out + "/gold-ring-390x844.png" });
  const phone = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, ropes: G.P.ropes.map((r) => ({ state: r.state, tag: r.target && r.target.tag, x: r.anchor.x })) }));
  console.log("390", JSON.stringify(phone));
  check(phone.w === 390 && phone.ropes.some((r) => r.state === "attached" && r.tag === "building" && Math.abs(r.x - run.ring.x) < 2), "at 390 the rope is on the gold-ring tower", phone);
  check(page.errors.length === 0, "0 page errors", page.errors);
} catch (e) {
  check(false, "the gold-ring run threw", e.stack || String(e));
} finally {
  await close();
  done();
}
