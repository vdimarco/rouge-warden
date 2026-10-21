// The fourth flush is a balloon, the eighth is a washer, and the clog card comes back after.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("clogbeat");
watchdog(420000, "clogbeat");
const out = process.env.SHOTS || "/tmp/swing-clogbeat";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); G.game.skipTutorial(); G.test.step(1 / 60, 10); });

  const early = await page.evaluate(() => {
    const ids = G.game.targets().filter((t) => t.kind === "clog" && !t.done).map((t) => t.id);
    for (let i = 0; i < 3; i++) G.test.clearClog(ids[i]);
    let n = 0;
    for (; n < 80; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 3 && /FLUSH THE CLOGS/.test(ob.title || "")) break;
    }
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    return { n, title: ob && ob.title, count: ob && ob.n, of: ob && ob.of, job: job && job.type, left: ids.length };
  });
  check(early.left >= 8 && !early.job && early.title === "FLUSH THE CLOGS" && early.count === 3 && early.of === 12, "three flushes are still the clog card", early);

  const air = await page.evaluate(() => {
    const id = G.game.targets().find((t) => t.kind === "clog" && !t.done);
    G.test.clearClog(id.id);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "balloon" && ob && /BALLOON/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type };
  });
  await page.screenshot({ path: out + "/balloon.png" });
  check(air.job === "balloon" && /UP FOR AIR/.test(air.title || "") && /BALLOON/.test(air.title || "") && !/FLUSH THE CLOGS/.test((air.title || "") + " " + (air.detail || "")), "the fourth flush is a balloon, not another clog", air);

  const back = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (!job && ob && /FLUSH THE CLOGS/.test(ob.title || "") && ob.n === 4) break;
    }
    const ob = G.game.progress.objective;
    return { n, killed, title: ob && ob.title, count: ob && ob.n, job: G.test.action().jobs.active && G.test.action().jobs.active.type };
  });
  check(back.killed && !back.job && back.title === "FLUSH THE CLOGS" && back.count === 4, "after the balloon the clog card returns", back);

  const down = await page.evaluate(() => {
    let ids = G.game.targets().filter((t) => t.kind === "clog" && !t.done).map((t) => t.id);
    for (let i = 0; i < 3; i++) G.test.clearClog(ids[i]);
    let calm = 0;
    for (; calm < 80; calm++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 7 && /FLUSH THE CLOGS/.test(ob.title || "") && !G.test.action().jobs.active) break;
    }
    const held = G.game.progress.objective;
    ids = G.game.targets().filter((t) => t.kind === "clog" && !t.done).map((t) => t.id);
    G.test.clearClog(ids[0]);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "washer" && ob && /WASHER|GET HIM DOWN/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    const ob = G.game.progress.objective;
    const job = G.test.action().jobs.active;
    G.test.render(0);
    return {
      calm, held: held && held.title, heldN: held && held.n, heldJob: false,
      n, title: ob && ob.title, detail: ob && ob.detail, job: job && job.type,
      timer: job && job.timer,
    };
  });
  await page.screenshot({ path: out + "/washer.png" });
  check(down.held === "FLUSH THE CLOGS" && down.heldN === 7, "seven flushes are still the clog card", down);
  check(down.job === "washer" && /GET HIM DOWN/.test(down.title || "") && /WASHER/.test(down.title || "") && !/FLUSH THE CLOGS|BALLOON/.test((down.title || "") + " " + (down.detail || "")), "the eighth flush is a carry down, not the balloon", down);
  check(down.timer <= 36 && down.timer > 34 && /3[4-6] s/.test(down.title || "") && !/60 s/.test(down.title || ""), "the eighth flush counts from 36 s, not a minute", down);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
