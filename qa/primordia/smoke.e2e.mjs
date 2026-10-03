// Browser smoke test for Primordia: title, start, play with the mouse, frenzy, mutation, game over.
// Needs the static server on http://127.0.0.1:8765. Usage: NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs [outDir]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import fs from "fs";

const out = process.argv[2] || "qa/primordia/shots";
fs.mkdirSync(out, { recursive: true });
const base = process.env.PRIMORDIA_URL || "http://127.0.0.1:8765/primordia/";
const launch = async () => {
  try { return await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); }
  catch (e) { return chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }); }
};
const fail = (m) => { console.error("FAIL", m); process.exitCode = 1; };
const browser = await launch();

// wait for real animation frames; software GL in CI can run at a few frames per second
const frames = (page, n = 4) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function run(name, viewport, touch) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // web fonts come from Google; a sandbox without that host should not fail the run
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.location().url || "")) errors.push(m.text()); });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const gl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  await page.screenshot({ path: `${out}/${name}-title.png` });
  const st0 = await page.evaluate(() => ({ screen: __primordia.screen, prey: __primordia.game.prey.length, w: __primordia.game.w, h: __primordia.game.h }));
  if (st0.screen !== "title") fail(name + ": not on title");
  if (st0.prey < 3) fail(name + ": demo dish has too little life " + st0.prey);
  // start
  if (touch) await page.tap("#playBtn"); else await page.keyboard.press("Enter");
  await frames(page, 2);
  const st1 = await page.evaluate(() => __primordia.screen);
  if (st1 !== "play") fail(name + ": Enter did not start, screen=" + st1);
  // steer toward the nearest prey for a few seconds
  const steer = async (ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const tgt = await page.evaluate(() => {
        const g = __primordia.game, P = g.player;
        const list = g.frenzyT > 0 && g.hunters.length ? g.hunters : g.prey;
        let best = null, bd = 1e9;
        for (const e of list) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } }
        const c = document.querySelector("#fx").getBoundingClientRect();
        // map dish coords to screen through the same layout the game uses
        return best ? { x: best.x, y: best.y } : null;
      });
      if (tgt && !touch) {
        const pt = await page.evaluate(({ x, y }) => { const r = window.__rect(); return { x: r.x + x * r.s, y: r.y + y * r.s }; }, tgt);
        await page.mouse.move(pt.x, pt.y, { steps: 2 });
      }
      await page.waitForTimeout(120);
    }
  };
  await steer(5000);
  const st2 = await page.evaluate(() => { const g = __primordia.game; return { score: g.score, light: g.player.light, meter: g.meter, steps: g.steps, alive: g.player.alive, eaten: g.stats.prey }; });
  console.log(name, "after 5s", JSON.stringify(st2), "webgl2", gl);
  if (st2.steps < 20) fail(name + ": dish did not advance");
  await page.screenshot({ path: `${out}/${name}-play.png` });
  // a hunter appears beside the player; it stings outside Frenzy
  await page.evaluate(() => {
    const g = __primordia.game, P = g.player;
    g.pending.push({ kind: "hunter", x: (P.x + 26) % g.w, y: P.y, angle: 0, t: 0, total: 1, species: 0, name: "Paraptera" });
  });
  for (let i = 0; i < 40 && !(await page.evaluate(() => __primordia.game.hunters.length)); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-hunter.png` });
  if (!(await page.evaluate(() => __primordia.game.hunters.length))) fail(name + ": injected hunter was not tracked");
  // force frenzy readiness and trigger it
  await page.evaluate(() => { const g = __primordia.game; g.meter = 1; g.ready = true; g.player.light = g.player.maxLight; });
  if (touch) await page.tap("#frenzyBtn"); else await page.keyboard.press("Shift");
  await frames(page, 3);
  const fr = await page.evaluate(() => __primordia.game.frenzyT);
  if (!(fr > 0)) fail(name + ": frenzy did not start " + JSON.stringify(await page.evaluate(() => { const g = __primordia.game; return { screen: __primordia.screen, state: g.state, alive: g.player.alive, light: g.player.light, meter: g.meter, ready: g.ready }; })));
  // chase the hunter; on touch, drive the game directly since there is no mouse
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < 20000) {
    const done = await page.evaluate(() => {
      const g = __primordia.game, P = g.player;
      if (g.stats.hunters > 0) return true;
      g.frenzyT = Math.max(g.frenzyT, 3); P.light = P.maxLight;
      const h = g.hunters[0];
      // hunters flee in Frenzy; step onto the densest tissue (an arc's centroid is its empty hollow)
      if (h) {
        let bi = -1, bv = 0;
        for (let dy = -25; dy <= 25; dy++) for (let dx = -25; dx <= 25; dx++) {
          const x = (Math.round(h.x) + dx + g.w) % g.w, y = (Math.round(h.y) + dy + g.h) % g.h, v = g.world.B[y * g.w + x];
          if (v > bv) { bv = v; bi = y * g.w + x; }
        }
        if (bi >= 0) { P.x = bi % g.w; P.y = (bi / g.w) | 0; }
      }
      return false;
    });
    if (!shot && Date.now() - t0 > 2500) { await page.screenshot({ path: `${out}/${name}-frenzy.png` }); shot = true; }
    if (done) break;
    await page.waitForTimeout(60);
  }
  const eaten = await page.evaluate(() => __primordia.game.stats.hunters);
  console.log(name, "hunters devoured in frenzy:", eaten);
  if (!eaten) fail(name + ": could not devour a hunter during Frenzy");
  // jump to the end of the epoch and pick a card
  await page.evaluate(() => { __primordia.game.epochTime = 39.99; });
  await frames(page, 4);
  const st3 = await page.evaluate(() => __primordia.screen);
  if (st3 !== "mutate") fail(name + ": epoch end did not open mutations, screen=" + st3);
  await page.screenshot({ path: `${out}/${name}-mutate.png` });
  if (touch) await page.tap(".card >> nth=1"); else await page.keyboard.press("Digit2");
  await frames(page, 2);
  const st4 = await page.evaluate(() => ({ screen: __primordia.screen, epoch: __primordia.game.epoch }));
  if (st4.screen !== "play" || st4.epoch !== 2) fail(name + ": card pick failed " + JSON.stringify(st4));
  // pause and resume
  if (!touch) {
    await page.keyboard.press("Escape"); await frames(page, 2);
    if ((await page.evaluate(() => __primordia.screen)) !== "pause") fail(name + ": Escape did not pause");
    await page.keyboard.press("Escape"); await frames(page, 2);
  }
  // die
  await page.evaluate(() => { const g = __primordia.game; g.frenzyT = 0; g.player.light = 0.01; });
  await frames(page, 3);
  await page.waitForTimeout(1700);
  await frames(page, 2);
  const st5 = await page.evaluate(() => __primordia.screen);
  if (st5 !== "over") fail(name + ": death did not show game over, screen=" + st5);
  await page.screenshot({ path: `${out}/${name}-over.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) fail(name + ": horizontal overflow");
  if (errors.length) fail(name + ": console errors " + errors.join(" | "));
  await ctx.close();
}

await run("desktop", { width: 1280, height: 720 });
await run("phone", { width: 390, height: 844 }, true);
await browser.close();
console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE OK");
