// Measures where the time goes in Breath of the Lake. For each graphics setting and a few places on the map it reports
// draw calls, triangles, and the main-thread time of the game step, the world update and the draw. It also reports
// load times, and the top functions of a CPU profile of a short run.
// Software rendering in a test browser is slow, so compare runs with each other, not with a real graphics card.
// Usage: node perf.mjs [quality ...]   (default: low high)
// PERF_PHONE=1 copies an iPhone screen (390x844, touch, pixel ratio 3). PERF_FRAMES sets the frames per place (default 6).
import { open, newGame } from "./lib.mjs";

const qualities = process.argv.slice(2).length ? process.argv.slice(2) : ["low", "high"];
const phone = !!process.env.PERF_PHONE;
const FR = +process.env.PERF_FRAMES || 6;
const say = (...a) => console.log(...a);

for (const q of qualities) {
  const t0 = Date.now();
  const { browser, page, errors } = await open(phone ? { width: 390, height: 844, touch: true } : { width: 640, height: 360 });
  if (phone) { const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }); }
  await page.addInitScript((qq) => localStorage.setItem("plungerd.wild.gfx", qq), q);
  await page.reload();
  await page.waitForSelector("#title:not([hidden])", { timeout: 300000 });
  const titleMs = Date.now() - t0;
  const t1 = Date.now();
  await newGame(page);
  // reset the setting, so every run draws at the same size whatever the dynamic resolution did during loading
  await page.evaluate((qq) => G.setGraphics(qq), q);
  say(JSON.stringify({ quality: q, phone, titleMs, startMs: Date.now() - t1, pixelRatio: await page.evaluate(() => G.renderer.getPixelRatio()) }));

  const spots = await page.evaluate(() => {
    const W = G.world, b = (id) => G.bosses.find((x) => x.id === id);
    return {
      cottage: [W.cottage.x - 4, W.cottage.z - 18],
      forest: [b("christian").center.x + 40, b("christian").center.z + 10],
      meadow: [b("ryu").center.x - 40, b("ryu").center.z + 30],
      mountain: [b("gabe").center.x, b("gabe").center.z + 45],
      court: [W.court.x, W.court.z + W.court.r - 3],
    };
  });
  // the loop stays paused; each sample runs step, world.update and draw once and times each
  for (const [name, [x, z]] of Object.entries(spots)) {
    const s = await page.evaluate(async ({ x, z, N }) => {
      const P = G.player, W = G.world, R = G.renderer;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      P.place(x, z); G.cam.yaw = Math.atan2(-x, -z); QA.clear();
      for (let i = 0; i < 3; i++) { G.test.step(1 / 60); await frame(); }
      const s = { step: 0, world: 0, draw: 0, calls: 0, tris: 0, frameMs: 0 };
      let last = performance.now();
      for (let i = 0; i < N; i++) {
        let a = performance.now(); G.test.step(1 / 60); s.step += performance.now() - a;
        a = performance.now(); W.update(1 / 60, G.time, G.camera, P); s.world += performance.now() - a;
        R.info.autoReset = false; R.info.reset();
        a = performance.now(); G.painter.render(G.scene, G.camera, G.look); R.getContext().finish(); s.draw += performance.now() - a;
        s.calls += R.info.render.calls; s.tris += R.info.render.triangles; R.info.autoReset = true;
        await frame(); const now = performance.now(); s.frameMs += now - last; last = now;
      }
      for (const k in s) s[k] = Math.round((s[k] / N) * 100) / 100;
      return s;
    }, { x, z, N: FR });
    say(JSON.stringify({ quality: q, spot: name, ...s }));
  }
  say(JSON.stringify({ quality: q, memory: await page.evaluate(() => { const R = G.renderer; return { geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs.length, sceneChildren: G.scene.children.length, meshes: (() => { let n = 0; G.scene.traverse((o) => { if (o.isMesh) n++; }); return n; })(), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }; }) }));

  // a CPU profile of real play on the last setting: the loop runs, the hero runs in a circle near the cottage
  if (q === qualities[qualities.length - 1] && !process.env.PERF_NOPROFILE) {
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => { const c = G.world.cottage; G.player.place(c.x - 4, c.z - 18); G.paused = false; });
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    await cdp.send("Profiler.start");
    await page.evaluate(async (N) => { const I = G.inp; for (let i = 0; i < N; i++) { I.move.x = Math.cos(i / 8); I.move.y = Math.sin(i / 8); await new Promise((r) => requestAnimationFrame(r)); } I.move.x = I.move.y = 0; G.paused = true; }, FR * 5);
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map(), dt = profile.timeDeltas || [];
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    (profile.samples || []).forEach((id, i) => { const cf = byId.get(id).callFrame; const key = (cf.functionName || "(anon)") + " " + cf.url.split("/").pop() + ":" + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    say(JSON.stringify({ quality: q, profile: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + " " + Math.round((v / total) * 1000) / 10 + "%") }, null, 1));
  }
  if (errors.length) say(JSON.stringify({ quality: q, errors: errors.slice(0, 5) }));
  await browser.close();
}
