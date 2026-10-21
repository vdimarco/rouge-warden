// The clog card and the compass name the same pump. A job still names the compass as the job.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("clogcompass");
watchdog(240000, "clogcompass");
const out = process.env.SHOTS || "/tmp/swing-clogcompass";
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

  const card = await page.evaluate(() => {
    let n = 0;
    for (; n < 90; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const g = G.game.progress.goal;
      const title = document.querySelector("[data-k=compassBox]").title;
      if (ob && ob.title === "FLUSH THE CLOGS" && g && g.kind === "clog" && g.name && title === g.name + " clog") break;
    }
    G.test.step(1 / 60, 4);
    G.test.render(0);
    const ob = G.game.progress.objective;
    const g = G.game.progress.goal;
    const box = document.querySelector("[data-k=compassBox]");
    const named = G.game.targets().filter((t) => t.kind === "clog" && !t.done && Math.hypot(t.x - g.x, t.z - g.z) < 1);
    return {
      n, title: ob && ob.title, detail: ob && ob.detail, count: ob && ob.n,
      goal: g && { kind: g.kind, name: g.name, x: g.x, z: g.z },
      compass: box.title, hidden: box.hidden, dist: document.querySelector("[data-k=dist]").textContent,
      hits: named.length,
    };
  });
  await page.screenshot({ path: out + "/compass.png" });
  const named = card.detail && card.goal ? card.detail.indexOf("Next: " + card.goal.name + " clog") === 0 : false;
  check(card.title === "FLUSH THE CLOGS" && named && card.goal.kind === "clog" && card.hits === 1, "the card names the clog the compass is given", card);
  check(card.compass === card.goal.name + " clog" && !card.hidden && /\d+ m/.test(card.dist || ""), "the compass title is that district, not a different pump", card);

  const job = await page.evaluate(() => {
    G.test.job("sludge");
    let n = 0;
    for (; n < 40; n++) {
      G.test.step(1 / 60, 1);
      if (document.querySelector("[data-k=compassBox]").title === "Your job") break;
    }
    return { n, title: document.querySelector("[data-k=compassBox]").title, kind: G.game.progress.goal && G.game.progress.goal.kind };
  });
  check(job.title === "Your job" && job.kind !== "clog", "a job still names the compass as the job", job);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
