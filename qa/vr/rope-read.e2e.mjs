// Four mid-swing frames: the rope against a building and against the sky, at 1280 and at 390.
// The verse pass stays on, so a rope drawn under the red/blue fringe would come out tinted.
// NODE_PATH=qa/browser/node_modules node qa/vr/rope-read.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, watchdog } from "./lib.mjs";

watchdog(300000, "rope-read");
const out = process.env.SHOTS || "/tmp/rope-read";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });

  for (const [w, h] of [[1280, 800], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    const building = await page.evaluate(() => {
      dispatchEvent(new Event("resize"));
      const canvas = document.querySelector("canvas");
      const up = () => document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
      const down = () => canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
      if (G.game && G.game.progress) G.game.progress.tutorial = 9;
      const b = G.city.colliders.find((c) => c.type === "box" && c.tag === "building" && c.maxY > 80);
      const x = b.minX - 18, z = (b.minZ + b.maxZ) / 2, y = b.maxY - 12;
      up();
      G.test.teleport(x, y, z);
      G.P.onGround = false;
      G.P.vel.set ? G.P.vel.set(6, 1, 0) : (G.P.vel.x = 6, G.P.vel.y = 1, G.P.vel.z = 0);
      G.test.face(b.minX, z);
      if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(G.rigYaw, -0.05); }
      for (let i = 0; i < 6; i++) G.test.step(1 / 60, 1);
      down();
      let rope = null;
      for (let n = 0; n < 40; n++) {
        G.test.step(1 / 60, 1);
        const live = G.P.ropes.find((r) => r.state === "attached");
        if (live) { rope = { tag: live.target && live.target.tag, id: live.target && live.target.id }; break; }
      }
      for (let n = 0; n < 12; n++) G.test.step(1 / 60, 1);
      const live = G.P.ropes.find((r) => r.state === "attached") || G.P.ropes[0];
      if (G.flatcam && live) {
        const dx = live.anchor.x - G.P.pos.x, dz = live.anchor.z - G.P.pos.z;
        G.flatcam.reset(Math.atan2(-dx, -dz), -0.05);
      }
      G.test.render(0);
      return { rope, w: innerWidth, h: innerHeight };
    });
    console.log(w + " building", JSON.stringify(building));
    await page.screenshot({ path: out + "/rope-building-" + w + ".png" });

    const sky = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const up = () => document.dispatchEvent(new MouseEvent("mouseup", { button: 0, bubbles: true }));
      const down = () => canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true }));
      if (G.game && G.game.progress) G.game.progress.tutorial = 9;
      up();
      G.test.teleport(0, 70, 420);
      G.P.onGround = false;
      G.P.vel.x = 0; G.P.vel.y = 2; G.P.vel.z = -14;
      G.rigYaw = 0;
      if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(0, -0.35); }
      for (let i = 0; i < 6; i++) G.test.step(1 / 60, 1);
      down();
      let rope = null;
      for (let n = 0; n < 40; n++) {
        G.test.step(1 / 60, 1);
        const live = G.P.ropes.find((r) => r.state === "attached");
        if (live) { rope = { tag: live.target && live.target.tag, id: live.target && live.target.id, y: +live.anchor.y.toFixed(1) }; break; }
      }
      for (let n = 0; n < 18; n++) G.test.step(1 / 60, 1);
      const live = G.P.ropes.find((r) => r.state === "attached") || G.P.ropes[0];
      let framed = null;
      if (G.flatcam && live) {
        const yaw = Math.atan2(-(live.anchor.x - G.P.pos.x), -(live.anchor.z - G.P.pos.z));
        G.flatcam.bankOn = false; G.flatcam.shakeOn = false;
        G.flatcam.reset(yaw, 0.35);
        G.test.step(1 / 60, 1);
      }
      G.test.render(0);
      const hand = G.hero.hand(0);
      const proj = (x, y, z) => {
        const v = G.camera.position.clone().set(x, y, z).project(G.camera);
        return { x: +((v.x * 0.5 + 0.5) * innerWidth).toFixed(0), y: +((0.5 - v.y * 0.5) * innerHeight).toFixed(0), z: +v.z.toFixed(2) };
      };
      framed = { hand: proj(hand.x, hand.y, hand.z), anchor: live ? proj(live.anchor.x, live.anchor.y, live.anchor.z) : null };
      return { rope, framed };
    });
    console.log(w + " sky", JSON.stringify(sky));
    await page.screenshot({ path: out + "/rope-sky-" + w + ".png" });
  }
} finally { await close(); }
