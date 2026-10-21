// The easy web in the 3D scene: a world-space ink line, about 2 CSS px wide at 1280 both near the hand
// and farther along, sagging at the start, fading over 150 ms. The paper speed lines stay on the overlay.
// Run from the repo root: NODE_PATH=qa/browser/node_modules node qa/vr/web-line.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("web-line");
watchdog(300000, "web-line");
const out = process.env.SHOTS || "/tmp/swing-qa";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.settings({ verse: "off", bloom: "off" }); });

  const shot = await page.evaluate(() => {
    const ink = (c) => Math.hypot(c[0] - 43, c[1] - 42, c[2] - 51) < 48;
    let spot = null;
    for (let z = 80; z < 700 && !spot; z += 15) {
      for (let x = -300; x < 300 && !spot; x += 15) if (G.city.isWater(x, z)) spot = { x, z };
    }
    if (!spot) spot = { x: G.city.start.x, z: G.city.start.z };
    G.test.teleport(spot.x, 48, spot.z);
    G.rigYaw = 0;
    if (G.flatcam) G.flatcam.reset(0, -0.2);
    G.P.vel.x = 0; G.P.vel.y = 0; G.P.vel.z = -12; G.P.onGround = false; G.P.wall = null;
    G.test.press(0, true);
    let attached = false, state = "";
    for (let n = 0; n < 20; n++) {
      G.test.step(1 / 60, 1);
      state = G.P.ropes[0].state;
      if (state === "attached" && G.P.ropes[0].easy) { attached = true; break; }
    }
    G.test.render(1 / 60);
    const mesh = G.scene.getObjectByName("easyWeb");
    const cv = document.getElementById("webLine");
    const hand = G.hero.hand(0);
    const r = G.P.ropes[0];
    const A = r.anchor;
    const dx = A.x - hand.x, dy = A.y - hand.y, dz = A.z - hand.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const cx = dx / len, cy = dy / len, cz = dz / len;
    let gx = -cx * cy, gy = -1 - cy * cy, gz = -cz * cy;
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    const e5 = G.camera.projectionMatrix.elements[5];
    const pix = (2 / e5) / innerHeight;
    const mid = { x: hand.x + dx * 0.5, y: hand.y + dy * 0.5, z: hand.z + dz * 0.5 };
    const dist = Math.hypot(mid.x - G.camera.position.x, mid.y - G.camera.position.y, mid.z - G.camera.position.z);
    const sag = (1 - Math.min(1, Math.max(0, r.tension))) * 16 * pix * Math.max(0.5, dist);
    const glc = G.renderer.getContext();
    const buf = new Uint8Array(4);
    const read = (x, y) => {
      const gx = Math.max(0, Math.min(glc.drawingBufferWidth - 1, Math.round(x)));
      const gy = Math.max(0, Math.min(glc.drawingBufferHeight - 1, Math.round(glc.drawingBufferHeight - 1 - y)));
      glc.readPixels(gx, gy, 1, 1, glc.RGBA, glc.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2]];
    };
    const proj = (x, y, z) => {
      const v = G.camera.position.clone().set(x, y, z).project(G.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, behind: v.z > 1, ndcY: v.y };
    };
    const widthAt = (u) => {
      const drop = 4 * sag * u * (1 - u);
      const p = proj(hand.x + dx * u + gx * drop, hand.y + dy * u + gy * drop, hand.z + dz * u + gz * drop);
      const q = proj(hand.x + dx * (u + 0.04) + gx * 4 * sag * (u + 0.04) * (1 - (u + 0.04)), hand.y + dy * (u + 0.04) + gy * 4 * sag * (u + 0.04) * (1 - (u + 0.04)), hand.z + dz * (u + 0.04) + gz * 4 * sag * (u + 0.04) * (1 - (u + 0.04)));
      if (p.behind || p.x < 8 || p.y < 8 || p.x > innerWidth - 8 || p.y > innerHeight - 8) return { u, onScreen: false, p };
      let tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const samples = [];
      for (let s = -10; s <= 10; s++) samples.push(ink(read(p.x - ty * s, p.y + tx * s)));
      const center = read(p.x, p.y);
      return { u, onScreen: true, width: samples.filter(Boolean).length ? (() => { let b = 0, run = 0; for (const on of samples) { if (on) { run++; b = Math.max(b, run); } else run = 0; } return b; })() : 0, center, p, dist: Math.hypot(hand.x + dx * u - G.camera.position.x, hand.y + dy * u - G.camera.position.y, hand.z + dz * u - G.camera.position.z) };
    };
    const near = widthAt(0.12);
    const far = widthAt(0.42);
    const chord = proj(mid.x, mid.y, mid.z);
    const hung = proj(mid.x + gx * sag, mid.y + gy * sag, mid.z + gz * sag);
    return {
      spot, attached, state, easy: !!r.easy, tension: r.tension, sag, offscreen: !!(window.__test && window.__test.swing && window.__test.swing.anchor.offscreen),
      mesh: mesh ? { visible: mesh.visible, count: mesh.count, name: mesh.name } : null,
      canvasHidden: !cv || cv.hidden,
      near, far, sagPx: hung.y - chord.y,
    };
  });
  console.log("INFO web-line", JSON.stringify({ near: shot.near, far: shot.far, sagPx: shot.sagPx, mesh: shot.mesh, offscreen: shot.offscreen, canvasHidden: shot.canvasHidden, tension: shot.tension, spot: shot.spot }));
  await page.screenshot({ path: out + "/web-line-1280.png" });
  const fade = await page.evaluate(() => {
    G.test.press(0, false);
    G.test.step(1 / 60, 4);
    G.test.render(1 / 60);
    const mid = G.scene.getObjectByName("easyWeb");
    G.test.step(1 / 60, 12);
    G.test.render(1 / 60);
    const gone = G.scene.getObjectByName("easyWeb");
    return { fadeCount: mid ? mid.count : 0, goneCount: gone ? gone.count : 0, goneVisible: !!(gone && gone.visible) };
  });
  console.log("INFO web-fade", JSON.stringify(fade));

  check(shot.attached && shot.easy, "the easy web attaches in the 3D scene", shot);
  check(shot.mesh && shot.mesh.visible && shot.mesh.count > 0 && shot.mesh.name === "easyWeb", "the web is the world-space mesh, not a screen stroke", shot.mesh);
  check(shot.canvasHidden, "the overlay canvas stays hidden while only the web is out", shot.canvasHidden);
  check(shot.offscreen, "the sky anchor is off the screen", shot.offscreen);
  check(shot.near.onScreen && shot.near.width >= 1 && shot.near.width <= 5, "near the hand the line is about 2 px (" + (shot.near.width) + ")", shot.near);
  check(shot.far.onScreen && shot.far.width >= 1 && shot.far.width <= 5, "farther along, the line is still about 2 px (" + (shot.far.width) + ")", shot.far);
  check(shot.near.onScreen && shot.far.onScreen && Math.abs(shot.near.width - shot.far.width) <= 2, "the width does not change with distance", { near: shot.near.width, far: shot.far.width });
  check(shot.sagPx > 8 && shot.sagPx < 28, "the line sags about 16 px at the start (" + shot.sagPx.toFixed(1) + ")", shot.sagPx);
  const nearInk = shot.near.center && Math.hypot(shot.near.center[0] - 43, shot.near.center[1] - 42, shot.near.center[2] - 51) < 36;
  check(nearInk, "the line is ink #2B2A33", shot.near.center);
  check(fade.fadeCount > 0 && (fade.goneCount === 0 || !fade.goneVisible), "the line is still out 4 frames after release and gone after 150 ms", fade);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
}
done();
