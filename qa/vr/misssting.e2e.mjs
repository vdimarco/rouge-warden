// A steady gap while the runner is pulling away keeps the fast clock, and a miss is a low sting, not the win.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("misssting");
watchdog(420000, "misssting");
const out = process.env.SHOTS || "/tmp/swing-misssting";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  const tone = await page.evaluate(async () => {
    const { renderOffline } = await import("./js/audio.js");
    const split = (buf) => {
      const a = buf.getChannelData(0);
      let y = 0, low = 0, high = 0, e = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        e += x * x;
        y += 0.02 * (x - y);
        low += y * y;
        const h = x - y;
        high += h * h;
      }
      const n = a.length || 1;
      return { rms: Math.sqrt(e / n), low: Math.sqrt(low / n), high: Math.sqrt(high / n) };
    };
    const miss = split(await renderOffline("miss", 1.2, { seed: 1 }));
    const win = split(await renderOffline("trialEnd", 1.6, { seed: 1 }));
    return { miss, win, ratioMiss: miss.low / Math.max(1e-6, miss.high), ratioWin: win.low / Math.max(1e-6, win.high) };
  });
  check(tone.miss.rms > 0.01 && tone.win.rms > 0.01, "the miss and the win both make a sound", tone);
  check(tone.ratioMiss > tone.ratioWin * 1.3, "the miss sits lower than the win fanfare", tone);

  const hot = await page.evaluate(() => {
    G.test.storyMission(0);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    const runner = () => G.test.action().combat.list.find((g) => g.runner && g.hp > 0);
    for (let i = 0; i < 140; i++) {
      const g = runner();
      if (!g) break;
      G.test.teleport(g.x + 40, g.y + 0.2, g.z);
      G.test.step(1 / 60, 1);
    }
    const g = runner();
    if (g) {
      G.test.teleport(g.x + 40, g.y + 0.2, g.z);
      G.test.face(g.x, g.z);
      G.test.step(1 / 60, 3);
    }
    const a = G.test.action();
    const ob = G.game.progress.objective;
    G.test.render(0);
    return {
      n,
      job: a.jobs.active && a.jobs.active.type,
      heat: a.jobs.active && a.jobs.active.data.heat,
      run: a.jobs.active && a.jobs.active.data.run,
      chase: G.audio.chaseOn,
      title: ob && ob.title,
      detail: ob && ob.detail,
    };
  });
  await page.screenshot({ path: out + "/clock.png" });
  check(hot.job === "thief" && hot.heat >= 0.55 && hot.run > 8, "the purse snatcher is pulling away on a steady gap", hot);
  check(hot.chase === 1 && /pulling away/i.test(hot.detail || ""), "the fast clock stays on while the gap holds", hot);

  const eased = await page.evaluate(() => {
    const runner = () => G.test.action().combat.list.find((g) => g.runner && g.hp > 0);
    for (let i = 0; i < 30; i++) {
      const g = runner();
      if (!g) break;
      G.test.teleport(g.x + 2, g.y + 0.2, g.z);
      G.test.step(1 / 60, 1);
    }
    const a = G.test.action();
    return { heat: a.jobs.active && a.jobs.active.data.heat, chase: G.audio.chaseOn, run: a.jobs.active && a.jobs.active.data.run };
  });
  check(eased.heat < 0.55 && eased.chase === 0, "closing, back on the jog, the fast clock drops", eased);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
