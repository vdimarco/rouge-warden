// Checks the city view's budgets (spec §9): the incremental build (start-view chunks first, a cap per call by time and
// by count, V.progress), the real time of every V.build call, and the draw calls and triangles per view at every
// named camera shot, on the title and in flat play (the ink outline twins of the trees, cars and landmarks count).
// It also checks that the comic art is loaded and that its textures stay a handful. Prints the numbers.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/perf.mjs
import { checker, watchdog, newPage, open, close, waitFor, waitState, freeze, frames } from "./lib.mjs";

const { check, done } = checker("perf");
watchdog(20 * 60 * 1000, "perf");
const SHOTS = ["start", "needle", "canyon", "harbour", "aerial", "street"];

// Wraps V.build before its first call (main keeps its own reference to the view object, so the wrapper must be
// on that object): every call's real time, the progress after it, and when the start view was ready.
const WRAP = () => {
  let g;
  Object.defineProperty(window, "G", {
    configurable: true, get() { return g; },
    set(v) {
      g = v;
      let view = v.view;
      Object.defineProperty(v, "view", {
        configurable: true, enumerable: true, get() { return view; },
        set(x) {
          view = x;
          if (!x || !x.build || x.__wrapped) return;
          const b = x.build.bind(x);
          window.__build = { ms: [], progress: [], startAt: -1, doneAt: -1 };
          x.build = (ms) => {
            const t = performance.now();
            const r = b(ms);
            const B = window.__build;
            B.ms.push(performance.now() - t);
            B.progress.push(x.progress);
            if (x.startReady && B.startAt < 0) B.startAt = B.ms.length;
            if (r && B.doneAt < 0) B.doneAt = B.ms.length;
            return r;
          };
          x.__wrapped = true;
        },
      });
    },
  });
};

async function measure(page, names) {
  const out = {};
  for (const n of names) {
    await page.evaluate((n) => G.test.camera(n), n);
    const f0 = await page.evaluate(() => G.frame);
    await page.waitForFunction((f) => G.frame > f + 2, f0, { timeout: 120000, polling: 50 });
    out[n] = await page.evaluate(() => G.test.renderInfo());
  }
  await page.evaluate(() => G.test.camera(null));
  return out;
}

/* ---------------- the build, in real time ---------------- */
try {
  // a small window keeps the software renderer from taking the CPU away from the build
  const page = await newPage({ width: 320, height: 180 });
  await page.addInitScript(WRAP);
  await open(page, "");
  await waitFor(page, () => G.viewDone, null, 300000);
  const PERF = await page.evaluate(async () => (await import("./js/config.js")).PERF);
  const B = await page.evaluate(() => window.__build);
  const v = await page.evaluate(() => ({ progress: G.view.progress, startReady: G.view.startReady, info: G.view.info, stats: G.view.stats }));
  const max = Math.max(...B.ms), total = B.ms.reduce((a, b) => a + b, 0);
  console.log("INFO: V.build: " + B.ms.length + " calls, " + total.toFixed(0) + " ms in all, the longest " + max.toFixed(1) + " ms; the start view was ready after call " + B.startAt + " of " + B.doneAt);
  console.log("INFO: longest unit per kind (ms): " + JSON.stringify(Object.fromEntries(Object.entries(v.stats.units).map(([k, x]) => [k, +x.toFixed(1)]))));
  console.log("INFO: the view holds " + v.info.meshes + " meshes and " + v.info.tris + " triangles");
  check(B.ms.length > 3 && B.doneAt > 0, "the city builds in steps and finishes (" + B.ms.length + " calls)", B);
  check(max <= 3 * PERF.buildBudgetMs, "no V.build call takes more than 3 x PERF.buildBudgetMs (" + max.toFixed(1) + " ms, limit " + 3 * PERF.buildBudgetMs + " ms)", B.ms.map((x) => +x.toFixed(1)));
  let mono = true;
  for (let i = 1; i < B.progress.length; i++) if (B.progress[i] < B.progress[i - 1] - 1e-9) mono = false;
  check(mono && B.progress[B.progress.length - 1] === 1 && v.progress === 1, "V.progress climbs from 0 to 1", B.progress);
  check(B.startAt > 0 && B.startAt < B.doneAt && B.progress[B.startAt - 1] < 0.7, "the start view is ready first (at " + (B.progress[B.startAt - 1] * 100).toFixed(0) + " % of the build)", { startAt: B.startAt, doneAt: B.doneAt });
  check(page.errors.length === 0, "no errors while the city builds", page.errors);

  /* ---------------- the art and its textures ---------------- */
  await waitFor(page, () => G.view.art && G.view.art.loaded, null, 120000);
  const mem = await page.evaluate(() => ({ art: G.view.art, textures: G.renderer.info.memory.textures, geometries: G.renderer.info.memory.geometries }));
  console.log("INFO: art " + JSON.stringify(mem.art) + ", " + mem.textures + " textures and " + mem.geometries + " geometries on the GPU");
  check(mem.art.sky && mem.art.windows, "the comic art (sky strip, window atlas) is loaded and uploaded", mem);
  check(mem.textures <= 16, "the art keeps the texture count small (" + mem.textures + " textures)", mem);

  /* ---------------- budgets per view, on the title ---------------- */
  const t = await measure(page, SHOTS.concat(["diorama"]));
  for (const n of SHOTS) console.log("INFO: title  " + n.padEnd(8) + " " + String(t[n].calls).padStart(4) + " draws " + String(t[n].tris).padStart(8) + " triangles");
  console.log("INFO: title  diorama  " + String(t.diorama.calls).padStart(4) + " draws " + String(t.diorama.tris).padStart(8) + " triangles");
  check(SHOTS.every((n) => t[n].views === 1 && t[n].calls <= PERF.drawsPerViewMax && t[n].tris <= PERF.trisPerViewMax), "every shot stays within " + PERF.drawsPerViewMax + " draws and " + PERF.trisPerViewMax / 1000 + "k triangles per view", t);
  check(t.start.calls <= 60, "the start view takes at most 60 draws (" + t.start.calls + ")", t.start);
  check(t.diorama.calls <= PERF.drawsPerViewMax && t.diorama.tris <= PERF.trisPerViewMax, "the diorama stays within the budget", t.diorama);

  /* ---------------- the same shots in flat play (the game, ropes and hands draw too) ---------------- */
  // the click starts the intro, which compiles the room and hand-off programs: minutes on a loaded software renderer, so click
  // from the page (no auto-wait) and give the state change a long time
  await page.waitForSelector("#playFlat:not([hidden]):not([disabled])", { timeout: 120000 });
  await page.evaluate(() => document.querySelector("#playFlat").click());
  await waitFor(page, () => G.mode === "desktop", null, 600000);
  await page.evaluate(() => G.test.skipIntro());
  await waitState(page, { mode: "desktop", state: "play" }, 600000);
  const p = await measure(page, SHOTS);
  for (const n of SHOTS) console.log("INFO: play   " + n.padEnd(8) + " " + String(p[n].calls).padStart(4) + " draws " + String(p[n].tris).padStart(8) + " triangles");
  check(SHOTS.every((n) => p[n].calls <= PERF.drawsPerViewMax && p[n].tris <= PERF.trisPerViewMax), "in flat play every shot stays within the budget too", p);
  check(page.errors.length === 0, "no errors in flat play", page.errors);
  await page.context().close();
} catch (e) { check(false, "the real-time build threw", e.stack || String(e)); }

/* ---------------- a frozen clock: the count cap still ends each call ---------------- */
try {
  const page = await newPage({ width: 320, height: 180, clock: true });
  await page.addInitScript(WRAP);
  await open(page, "");
  await freeze(page);
  const f0 = await page.evaluate(() => G.frame);
  let n = 0;
  while (!(await page.evaluate(() => G.viewDone)) && n < 600) { await frames(page, 1); n++; }
  const B = await page.evaluate(() => window.__build);
  const steps = B.progress.filter((x, i) => i === 0 || x > B.progress[i - 1]).length;
  check(await page.evaluate(() => G.viewDone), "with time standing still the build still finishes, a few units a frame (" + n + " frames)", { frames: n, calls: B.ms.length });
  check(steps === B.progress.length, "under a frozen clock every V.build call moves the progress on", B.progress);
  check(page.errors.length === 0, "no errors under the frozen clock", page.errors);
  await page.context().close();
} catch (e) { check(false, "the frozen-clock build threw", e.stack || String(e)); }

await close();
done();
