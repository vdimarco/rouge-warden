// Mission 1 on a first run: the bomb clock and the runner wait while the gold-ring lesson is open,
// and a rope starts both (swing-jobs).
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("chasehold");
watchdog(240000, "chasehold");
const out = SHOTS || "/tmp/swing-chase";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&cut");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });

  const held = await page.evaluate(() => {
    for (let i = 0; i < 40 && G.test.cutscene().playing; i++) G.test.step(1 / 60, 60);
    G.test.skipIntro();
    G.test.step(1 / 60, 40);
    const runner = G.test.action().combat.list.find((g) => g.runner);
    G.rigYaw = Math.atan2(-(runner.x - G.P.pos.x), -(runner.z - G.P.pos.z));
    G.flatcam.reset(G.rigYaw, -0.55);
    G.test.step(1 / 60, 8);
    const ob = G.game.progress.objective;
    const train = G.game.progress.training;
    const t0 = G.jobs.active.timer, x = runner.x, z = runner.z;
    G.test.step(1 / 60, 180);
    const later = G.test.action().combat.list.find((g) => g.runner);
    const ob2 = G.game.progress.objective;
    return {
      tut: G.game.progress.tutorial,
      row: train && train.items[0].text,
      detail: ob2 && ob2.detail,
      title: ob2 && ob2.title,
      hold: G.jobs.active.data.hold,
      timerSame: Math.abs(G.jobs.active.timer - t0) < 1e-4,
      moved: Math.hypot(later.x - x, later.z - z),
      said: ob && ob.detail,
    };
  });
  check(held.tut === 0 && /gold ring/i.test(held.row), "the gold-ring lesson is still the first row", held);
  check(held.hold && /swing first/i.test(held.detail) && /SLUDGE RUN/.test(held.title), "the card tells you to swing first and still shows the time", held);
  check(held.timerSame && held.moved < 0.3, "three seconds later the clock and the runner have not moved", held);
  await page.screenshot({ path: out + "/clock-waits.png" });

  const ran = await page.evaluate(() => {
    const R = G.city.goldRing;
    G.test.press(1, false);
    G.test.step(1 / 60, 1);
    G.test.aimAt(1, R.x, R.y, R.z);
    G.test.press(1, true);
    let n = -1;
    for (let i = 0; i < 90; i++) {
      G.test.step(1 / 60, 1);
      if (G.test.state().ropes[1].state === "attached") { n = i; break; }
    }
    const t0 = G.jobs.active.timer;
    const g0 = G.test.action().combat.list.find((g) => g.runner);
    G.test.step(1 / 60, 90);
    const g1 = G.test.action().combat.list.find((g) => g.runner);
    G.test.step(1 / 60, 8);
    const ob = G.game.progress.objective;
    const dom = document.querySelector("[data-k=mission]").innerText.replace(/\s+/g, " ");
    return {
      n,
      tut: G.game.progress.tutorial,
      hold: G.jobs.active && G.jobs.active.data.hold,
      dropped: t0 - G.jobs.active.timer,
      moved: Math.hypot(g1.x - g0.x, g1.z - g0.z),
      detail: ob && ob.detail,
      dom,
    };
  });
  check(ran.n >= 0 && ran.tut !== 0 && ran.hold === false, "a rope on the gold ring ends the wait", ran);
  check(ran.dropped > 1 && ran.moved > 2, "the clock counts down and the runner runs", ran);
  check(/catch the runner/i.test(ran.detail) && /catch the runner/i.test(ran.dom), "the card on screen is the chase again", ran);
  await page.screenshot({ path: out + "/clock-runs.png" });
  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "the chase-hold run threw", e.stack || String(e));
}
await close();
done();
