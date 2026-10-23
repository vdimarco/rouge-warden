// The ninth-flush getaway drives faster than an odd-job getaway. The card names the mission.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("fastcar");
watchdog(420000, "fastcar");
const out = process.env.SHOTS || "/tmp/swing-fastcar";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); G.game.skipTutorial(); G.test.step(1 / 60, 8); });

  const odd = await page.evaluate(() => {
    G.test.job("getaway");
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    return { pace: G.test.jobPace(), title: ob && ob.title, detail: ob && ob.detail };
  });
  check(odd.pace === 17 && /GETAWAY/.test(odd.title || "") && !/STOP THAT CAR/.test(odd.title || ""), "an odd-job getaway keeps 17 m/s", odd);

  const late = await page.evaluate(() => {
    G.test.job("getaway", "STOP THAT CAR");
    G.test.step(1 / 60, 4);
    G.test.render(0);
    const ob = G.game.progress.objective;
    return { pace: G.test.jobPace(), title: ob && ob.title, detail: ob && ob.detail, timer: G.test.action().jobs.active && G.test.action().jobs.active.timer };
  });
  await page.screenshot({ path: out + "/car.png" });
  check(late.pace === 24 && /STOP THAT CAR/.test(late.title || "") && /GETAWAY/.test(late.title || "") && /Rope the car/.test(late.detail || ""), "the ninth-flush car drives at 24 m/s", late);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
