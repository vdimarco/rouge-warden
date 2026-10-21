// The chase bed: falling behind adds a clock to the groove, closing takes it away (swing-jobs).
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("chasebed");
watchdog(240000, "chasebed");
const out = SHOTS || "/tmp/swing-bed";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  const bed = await page.evaluate(async () => {
    const { renderOffline } = await import("./js/audio.js");
    const hi = (buf) => {
      const a = buf.getChannelData(0), b = buf.getChannelData(1);
      let y = 0, e = 0;
      for (let i = 0; i < a.length; i++) {
        const x = (a[i] + b[i]) * 0.5;
        y += 0.08 * (x - y);
        const h = x - y;
        e += h * h;
      }
      return Math.sqrt(e / a.length);
    };
    const quiet = await renderOffline("music", 4, { speed: 10, chase: 0, seed: 3 });
    const hot = await renderOffline("music", 4, { speed: 10, chase: 1, seed: 3 });
    const qa = quiet.getChannelData(0), ha = hot.getChannelData(0);
    let d = 0;
    for (let i = 0; i < qa.length; i++) { const z = ha[i] - qa[i]; d += z * z; }
    return { quiet: hi(quiet), hot: hi(hot), diff: Math.sqrt(d / qa.length) };
  });
  check(bed.hot > bed.quiet * 1.05 && bed.diff > 0.002, "falling behind brightens the groove and adds the clock", bed);

  const behind = await page.evaluate(() => {
    G.test.step(1 / 60, 10);
    const idle = G.audio.chaseOn;
    G.test.job("sludge");
    G.test.step(1 / 60, 8);
    const runner = G.test.action().combat.list.find((g) => g.runner);
    G.rigYaw = Math.atan2(-(runner.x - G.P.pos.x), -(runner.z - G.P.pos.z));
    G.flatcam.reset(G.rigYaw, -0.55);
    G.test.teleport(runner.x + 80, 0, runner.z);
    G.test.step(1 / 60, 8);
    return { idle, behind: G.audio.chaseOn, text: (document.querySelector("#actGoal") || {}).innerText || "" };
  });
  await page.screenshot({ path: out + "/falling-behind.png" });
  const after = await page.evaluate(() => {
    const runner = G.test.action().combat.list.find((g) => g.runner);
    G.test.teleport(runner.x + 4, 0, runner.z);
    G.test.step(1 / 60, 8);
    const closing = G.audio.chaseOn;
    G.jobs.holdChase(true);
    G.test.teleport(runner.x + 90, 0, runner.z);
    G.test.step(1 / 60, 8);
    return { closing, held: G.audio.chaseOn };
  });
  const live = { idle: behind.idle, behind: behind.behind, closing: after.closing, held: after.held, text: behind.text };
  check(live.idle === 0, "with no chase the clock is quiet", live);
  check(live.behind === 1, "falling behind sets the chase bed to full", live);
  check(live.closing === 0, "closing takes the clock away", live);
  check(live.held === 0, "the first-lesson hold keeps the clock quiet", live);
  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "the chase-bed run threw", e.stack || String(e));
}
await close();
done();
