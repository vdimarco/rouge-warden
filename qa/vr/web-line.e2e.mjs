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
    let spot = null;
    for (let z = 80; z < 700 && !spot; z += 15) {
      for (let x = -300; x < 300 && !spot; x += 15) if (G.city.isWater(x, z)) spot = { x, z };
    }
    if (!spot) spot = { x: G.city.start.x, z: G.city.start.z };
    G.test.teleport(spot.x, 48, spot.z);
    G.rigYaw = 0;
    // The draw leans the camera and then puts it back. With the lean off, the pixels and the
    // projection are the same camera, so a sample lands on the thread.
    if (G.flatcam) { G.flatcam.bankOn = false; G.flatcam.shakeOn = false; G.flatcam.reset(0, -0.2); }
    G.P.vel.x = 0; G.P.vel.y = 0; G.P.vel.z = -4; G.P.onGround = false; G.P.wall = null;
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
    G.camera.updateMatrixWorld(true);
    const glc = G.renderer.getContext();
    const bw = glc.drawingBufferWidth, bh = glc.drawingBufferHeight;
    const sx = bw / innerWidth, sy = bh / innerHeight;
    const buf = new Uint8Array(4);
    const read = (x, y) => {
      const px = Math.max(0, Math.min(bw - 1, Math.round(x * sx)));
      const py = Math.max(0, Math.min(bh - 1, Math.round(bh - 1 - y * sy)));
      glc.readPixels(px, py, 1, 1, glc.RGBA, glc.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2]];
    };
    const scratch = G.camera.position.clone();
    const proj = (x, y, z) => {
      const v = scratch.set(x, y, z).project(G.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, behind: v.z > 1 };
    };
    // The drawn segments, not a second copy of the sag formula. Each instance is a unit cylinder
    // standing on its start, so local y = 0.5 is the middle of that piece of web.
    const segs = [];
    if (mesh && mesh.count > 0) {
      const M = new mesh.matrix.constructor();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, M);
        const e = M.elements;
        const wx = e[4] * 0.5 + e[12], wy = e[5] * 0.5 + e[13], wz = e[6] * 0.5 + e[14];
        segs.push({ p: proj(wx, wy, wz), dist: Math.hypot(wx - G.camera.position.x, wy - G.camera.position.y, wz - G.camera.position.z) });
      }
    }
    const widthAt = (i) => {
      const p = segs[i].p, q = segs[Math.min(segs.length - 1, i + 1)].p;
      if (p.behind || p.x < 6 || p.y < 6 || p.x > innerWidth - 6 || p.y > innerHeight - 6) return { onScreen: false, p, dist: segs[i].dist };
      let tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      let center = null, best = 1e9, width = 0, run = 0;
      for (let s = -12; s <= 12; s++) {
        const c = read(p.x - ty * s, p.y + tx * s);
        const d = Math.hypot(c[0] - 43, c[1] - 42, c[2] - 51);
        const on = d < 22;
        if (on) { run++; width = Math.max(width, run); } else run = 0;
        if (d < best) { best = d; center = c; }
      }
      return { onScreen: true, width, center, inkD: best, p, dist: segs[i].dist };
    };
    const hits = [];
    for (let i = 0; i < segs.length; i++) {
      const m = widthAt(i);
      if (m.onScreen && m.width >= 1 && m.width <= 4 && m.inkD < 22) hits.push({ onScreen: true, width: m.width, center: m.center, inkD: +m.inkD.toFixed(1), dist: +m.dist.toFixed(2), y: +m.p.y.toFixed(1) });
    }
    const near = hits[0] || { onScreen: false, width: 0, center: null, dist: 0 };
    const far = hits.length > 1 ? hits[hits.length - 1] : { onScreen: false, width: 0, center: null, dist: 0 };
    const a = proj(hand.x, hand.y, hand.z), b = proj(A.x, A.y, A.z);
    let sagPx = 0;
    if (segs.length) {
      const mid = segs[Math.floor((segs.length - 1) / 2)].p;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if (ny < 0) { nx = -nx; ny = -ny; }
      sagPx = (mid.x - a.x) * nx + (mid.y - a.y) * ny;
    }
    return {
      spot, attached, state, easy: !!r.easy, tension: r.tension, offscreen: !!(window.__test && window.__test.swing && window.__test.swing.anchor.offscreen),
      mesh: mesh ? { visible: mesh.visible, count: mesh.count, name: mesh.name } : null,
      canvasHidden: !cv || cv.hidden,
      near, far, hits: hits.length, sagPx, speed: Math.hypot(G.P.vel.x, G.P.vel.y, G.P.vel.z),
    };
  });
  console.log("INFO web-line", JSON.stringify({ near: shot.near, far: shot.far, hits: shot.hits, sagPx: shot.sagPx, speed: shot.speed, mesh: shot.mesh, offscreen: shot.offscreen, canvasHidden: shot.canvasHidden, tension: shot.tension }));
  await page.screenshot({ path: out + "/web-line-1280.png" });
  const fade = await page.evaluate(() => {
    G.test.press(0, false);
    const trace = [];
    for (let i = 0; i < 14; i++) {
      G.test.step(1 / 60, 1);
      const m = G.scene.getObjectByName("easyWeb");
      trace.push({ i, st: G.P.ropes[0].state, n: m ? m.count : -1, f: m && m.userData.fade, v: !!(m && m.visible) });
    }
    const mid = trace[3], end = trace[trace.length - 1];
    return { trace, fadeCount: mid ? mid.n : 0, goneCount: end ? end.n : -1, goneVisible: !!(end && end.v) };
  });
  console.log("INFO web-fade", JSON.stringify(fade));

  check(shot.attached && shot.easy, "the easy web attaches in the 3D scene", shot);
  check(shot.mesh && shot.mesh.visible && shot.mesh.count > 0 && shot.mesh.name === "easyWeb", "the web is the world-space mesh, not a screen stroke", shot.mesh);
  check(shot.canvasHidden || shot.speed > 12, "the overlay stays hidden until the paper speed lines come on", { hidden: shot.canvasHidden, speed: shot.speed });
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
