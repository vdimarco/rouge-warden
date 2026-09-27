// Measures where the time goes in Breath of the Lake. For each graphics setting and a few places on the map it reports
// draw calls, triangles, and the main-thread time of the game step, the world update and the draw. It also reports
// load times and the page weight, and writes a CPU profile summary of a short run.
// Software rendering in a test browser is slow, so compare runs with each other, not with a real graphics card.
// Usage: node perf.mjs [quality ...]   (default: low high)
import { open, newGame, URL } from "./lib.mjs";

const qualities = process.argv.slice(2).length ? process.argv.slice(2) : ["low", "high"];
const out = { load: null, spots: {}, profile: null };

for (const q of qualities) {
  const t0 = Date.now();
  const { browser, page, errors } = await open({ width: 960, height: 540 });
  await page.addInitScript((qq) => localStorage.setItem("plungerd.wild.gfx", qq), q);
  let bytes = 0;
  page.on("response", async (r) => { try { const b = await r.body(); bytes += b.length; } catch (e) { /* redirect */ } });
  await page.reload();
  await page.waitForSelector("#title:not([hidden])", { timeout: 300000 });
  const titleMs = Date.now() - t0;
  const t1 = Date.now();
  await newGame(page);
  const startMs = Date.now() - t1;
  await page.evaluate((qq) => G.setGraphics(qq), q);
  if (!out.load) out.load = { titleMs, startMs, bytes };

  // time the parts of a frame by hand: the loop stays paused and each sample runs step, world.update and draw once
  out.spots[q] = await page.evaluate(async () => {
    const P = G.player, W = G.world, R = G.renderer;
    const tw = (id) => G.world.towers ? G.world.towers.find((t) => t.id === id) : null;
    const b = (id) => G.bosses.find((x) => x.id === id);
    const spots = {
      cottage: [W.cottage.x - 4, W.cottage.z - 18],
      forest: [b("christian").center.x + 40, b("christian").center.z + 10],
      meadow: [b("ryu").center.x - 40, b("ryu").center.z + 30],
      mountain: [b("gabe").center.x, b("gabe").center.z + 45],
      court: [G.world.court.x, G.world.court.z + G.world.court.r - 3],
    };
    const res = {};
    const draw = G.painter.render.bind(G.painter);
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    for (const [name, [x, z]] of Object.entries(spots)) {
      P.place(x, z); G.cam.yaw = Math.atan2(-x, -z); QA.clear();
      for (let i = 0; i < 4; i++) { G.test.step(1 / 60); await frame(); }
      const s = { step: 0, world: 0, draw: 0, calls: 0, tris: 0, frameMs: 0 };
      const N = 12;
      let last = performance.now();
      for (let i = 0; i < N; i++) {
        let a = performance.now(); G.test.step(1 / 60); s.step += performance.now() - a;
        a = performance.now(); W.update(1 / 60, G.time, G.camera, P); s.world += performance.now() - a;
        R.info.reset(); R.info.autoReset = false;
        a = performance.now(); draw(G.scene, G.camera, G.look); s.draw += performance.now() - a;
        s.calls += R.info.render.calls; s.tris += R.info.render.triangles; R.info.autoReset = true;
        await frame(); const now = performance.now(); s.frameMs += now - last; last = now;
      }
      for (const k in s) s[k] = Math.round((s[k] / N) * 100) / 100;
      res[name] = s;
    }
    res.memory = { geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs.length, sceneChildren: G.scene.children.length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
    return res;
  });

  // a CPU profile of real play: the loop runs, the hero runs in a circle near the cottage
  if (q === qualities[qualities.length - 1]) {
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => { const c = G.world.cottage; G.player.place(c.x - 4, c.z - 18); G.paused = false; });
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    await page.evaluate(async () => { const I = G.inp; for (let i = 0; i < 90; i++) { I.move.x = Math.cos(i / 15); I.move.y = Math.sin(i / 15); await new Promise((r) => requestAnimationFrame(r)); } I.move.x = I.move.y = 0; });
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map(), dt = profile.timeDeltas || [];
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    (profile.samples || []).forEach((id, i) => { const n = byId.get(id); const cf = n.callFrame; const key = (cf.functionName || "(anon)") + " " + cf.url.split("/").pop() + ":" + (cf.lineNumber + 1); self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    out.profile = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => [k, Math.round((v / total) * 1000) / 10 + "%"]);
  }
  if (errors.length) out.errors = errors.slice(0, 5);
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
