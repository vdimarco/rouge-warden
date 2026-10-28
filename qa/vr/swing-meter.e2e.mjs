// A played swing on software GL, driven one frame at a time after the city has compiled.
// Headless Chromium's own present clock is not the sample: the callback interval is the
// frame's main-thread cost, and input-to-submit is the press until that callback starts.
// Neither number is GPU completion or display latency. The floors are a regression gate
// for this renderer, not a console bar.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, shot, sleep, SHOTS } from "./lib.mjs";

const { check, done } = checker("swing meter");
watchdog(480000, "swing meter");
const out = SHOTS || "/tmp/swing-meter-shots";
await mkdir(out, { recursive: true });

// Floors for the play window, after a warmup that absorbs the one-time software stall.
// Measured on SwiftShader at 1280×800: input-to-submit p95 1.9 ms, frame p95 6.9 ms.
// The gates sit above that sample so a busier machine still passes, and a swing that
// stalls inside the window does not.
const FLOOR = { frames: 16, inputs: 16, medianMs: 30, p95Ms: 80, over50: 2, inputSubmitP95Ms: 32 };

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await page.route("**/vr/js/main.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    if (!source.includes("renderer.setAnimationLoop(loop);")) throw new Error("swing loop hook missing");
    await route.fulfill({
      response,
      body: source.replace("renderer.setAnimationLoop(loop);", "window.__swingLoop=loop; renderer.setAnimationLoop(loop);"),
    });
  });
  await open(page, "?nosw&skipintro&debug");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.waitForFunction(() => G.state === "play");
  await page.evaluate(() => {
    if (G.ui.paused) G.ui.closePause();
    G.game.skipTutorial();
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw;
    G.desktop.level(0);
    G.flatcam.reset(yaw);
    G.P.onGround = false;
    G.P.vel.x = -Math.sin(yaw) * 12;
    G.P.vel.z = -Math.cos(yaw) * 12;
    G.P.vel.y = 2;
  });
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyE");
  await sleep(8000);
  try {
    await Promise.race([
      shot(page, "swing-meter"),
      sleep(12000).then(() => { throw new Error("shot timed out"); }),
    ]);
  } catch (e) { console.log("INFO shot skipped " + e.message); }
  const driven = await page.evaluate(async () => {
    const drive = async (n) => {
      const costs = [];
      for (let i = 0; i < n; i++) {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit1", bubbles: true }));
        const a = performance.now();
        window.__swingLoop(a, null);
        costs.push(+(performance.now() - a).toFixed(1));
        if (G.P.ropes.some((r) => r.state !== "idle")) window.__rope = true;
        await new Promise((r) => setTimeout(r, 0));
      }
      return costs;
    };
    G.renderer.setAnimationLoop(null);
    window.__rope = false;
    const warm = await drive(36);
    G.test.resetPerformance();
    const costs = await drive(24);
    const gl = G.renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const v = G.P.vel;
    const info = (G.bloom && G.bloom.last) || G.renderer.info.render;
    return {
      warm, costs,
      metrics: G.test.performance(),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      buf: [G.renderer.domElement.width, G.renderer.domElement.height],
      scale: +G.renderer.getPixelRatio().toFixed(3),
      rope: window.__rope,
      speed: +Math.hypot(v.x, v.y, v.z).toFixed(2),
      y: +G.P.pos.y.toFixed(1),
      calls: info.calls, tris: info.triangles,
      debug: document.querySelector("#debug")?.textContent || "",
    };
  });
  console.log("INFO swing meter " + JSON.stringify(driven));
  const result = driven;
  const m = result.metrics;
  check(m && m.frames >= FLOOR.frames && m.medianMs <= FLOOR.medianMs && m.p95Ms <= FLOOR.p95Ms && m.over50 <= FLOOR.over50, "a swing's frames stay inside the software floor", m);
  check(m && m.inputs >= FLOOR.inputs && m.inputSubmitP95Ms >= 0 && m.inputSubmitP95Ms <= FLOOR.inputSubmitP95Ms, "presses land before the next submit inside the floor", m);
  check(result.rope || result.speed > 4, "the sample is a moving swing, not a menu", { rope: result.rope, speed: result.speed });
  check(result.debug.includes("input→submit") && result.debug.includes("p95"), "the overlay names the sample", result.debug);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
}
done();
