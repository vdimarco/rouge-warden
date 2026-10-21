// Falling behind speeds a chase. A miss holds a lesson, then the same mission starts again.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("chasepress");
watchdog(420000, "chasepress");
const out = process.env.SHOTS || "/tmp/swing-chasepress";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone && G.fx && G.fx.info().ready, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  const behind = await page.evaluate(() => {
    G.test.storyMission(0);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    const runner = () => G.test.action().combat.list.find((g) => g.runner && g.hp > 0);
    let frames = 0;
    for (; frames < 100; frames++) {
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
      n, frames,
      job: a.jobs.active && a.jobs.active.type,
      run: a.jobs.active && a.jobs.active.data.run,
      heat: a.jobs.active && a.jobs.active.data.heat,
      title: ob && ob.title,
      detail: ob && ob.detail,
    };
  });
  await page.screenshot({ path: out + "/pull.png" });
  check(behind.job === "thief" && behind.run > 8 && behind.heat > 0.5, "falling behind speeds the purse snatcher", behind);
  check(/pulling away/i.test(behind.detail || "") && /MISSION 2/.test(behind.title || ""), "the card says he is pulling away", behind);

  const missed = await page.evaluate(() => {
    const before = G.fx.info().words.map((q) => q.name);
    const failed = G.test.failJob();
    let n = 0;
    for (; n < 30; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT AWAY") break;
    }
    G.test.step(1 / 60, 4);
    const a = G.test.action();
    const ob = G.game.progress.objective;
    const words = G.fx.info().words.map((q) => q.name);
    G.test.render(0);
    return {
      n, failed,
      title: ob && ob.title,
      detail: ob && ob.detail,
      miss: a.miss,
      job: a.jobs.active,
      words, before,
      kasplash: words.filter((w) => w === "KASPLASH").length - before.filter((w) => w === "KASPLASH").length,
    };
  });
  await page.screenshot({ path: out + "/miss.png" });
  check(missed.failed && missed.miss && missed.miss.why === "away" && missed.miss.job === "thief", "the miss is the purse snatcher getting away", missed);
  check(missed.title === "GOT AWAY" && /swing/i.test(missed.detail || ""), "the card says to stay close with a swing", missed);
  check(missed.kasplash === 0 && !missed.job, "a miss is not a payoff, and the next card waits", missed);

  const again = await page.evaluate(() => {
    let n = 0;
    for (; n < 220; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief" && ob && /MISSION 2/.test(ob.title || "")) break;
    }
    const ob = G.game.progress.objective;
    const a = G.test.action();
    return { n, title: ob && ob.title, job: a.jobs.active && a.jobs.active.type, hold: a.miss && a.miss.hold };
  });
  check(again.job === "thief" && /MISSION 2/.test(again.title || "") && !(again.hold > 0), "after the lesson, Stop, Thief! starts again", again);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
