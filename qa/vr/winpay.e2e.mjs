// A won job hangs on a big comic word before the next mission card.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("winpay");
watchdog(420000, "winpay");
const out = process.env.SHOTS || "/tmp/swing-winpay";
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

  const won = await page.evaluate(() => {
    G.test.storyMission(0);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    const started = G.test.action().jobs.active && G.test.action().jobs.active.type;
    const killed = G.test.finishJob();
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      if (G.test.action().win) break;
    }
    // the word pops over 0.12 s; the impact frame is a few hundredths
    G.test.step(1 / 60, 8);
    const a = G.test.action();
    const wordName = a.win && a.win.word;
    const w = G.fx.info().words.find((q) => q.name === wordName);
    const cam = G.camera;
    let part = 0;
    if (w) {
      const d = Math.hypot(w.x - cam.position.x, w.y - cam.position.y, w.z - cam.position.z);
      const view = 2 * d * Math.tan(Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect));
      part = view > 0 ? w.w / view : 0;
    }
    const ob = G.game.progress.objective;
    // clear the impact frame before the picture; the word itself does not age in a render
    G.test.render(0.4);
    return {
      n, m, started, killed,
      win: a.win, slowT: a.slowT, hitStop: a.hitStop,
      job: a.jobs.active, title: ob && ob.title, detail: ob && ob.detail,
      part, life: w ? w.life : 0, word: w ? w.name : "",
      words: G.fx.info().words.map((q) => q.name),
    };
  });
  await page.screenshot({ path: out + "/gotcha.png" });
  check(won.started === "thief" && won.killed && won.win && won.win.job === "thief" && won.win.word === "KASPLASH" && won.win.shown, "catching the thief pays off with KASPLASH", won);
  check(won.part > 0.45, "the word is wider than a finisher (" + (won.part * 100).toFixed(0) + "% of the view)", won.part);
  check(won.life > 2, "the word stays through the moment", won.life);
  check(won.slowT > 0.4 && won.hitStop > 0, "the world hangs for a moment", { slowT: won.slowT, hitStop: won.hitStop });
  check(!won.job && won.title === "GOT IT" && !/MISSION 3|FLUSH THE CLOGS/.test((won.title || "") + " " + (won.detail || "")), "the next mission card waits", won);

  const next = await page.evaluate(() => {
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      if (job && job.type === "catch" && ob && /MISSION 3/.test(ob.title || "")) break;
    }
    const ob = G.game.progress.objective;
    const win = G.test.action().win;
    return { n, title: ob && ob.title, job: G.test.action().jobs.active && G.test.action().jobs.active.type, hold: win && win.hold };
  });
  check(next.job === "catch" && /MISSION 3/.test(next.title || ""), "after the payoff, Mission 3 starts", next);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
