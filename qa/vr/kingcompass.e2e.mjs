// While the King is awake the card and the compass name the same pipe, and the metres drop on the next frames.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("kingcompass");
watchdog(240000, "kingcompass");
const out = process.env.SHOTS || "/tmp/swing-king-compass";
await mkdir(out, { recursive: true });

const metres = (detail) => {
  const m = /Next pipe, (\d+) m/.exec(detail || "");
  return m ? +m[1] : null;
};

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
    G.test.wakeKing();
    let n = 0;
    for (; n < 90; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const g = G.game.progress.goal;
      const title = document.querySelector("[data-k=compassBox]").title;
      if (ob && ob.title === "FLUSH THE KING" && g && g.kind === "pipe" && /Next pipe, \d+ m/.test(ob.detail || "") && title === "The King's pipe") break;
    }
    const before = G.game.progress.objective && G.game.progress.objective.detail;
    const g = G.game.progress.goal;
    const p = G.P.pos;
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
    const step = Math.min(40, d * 0.35);
    G.test.teleport(p.x + (dx / d) * step, p.y, p.z + (dz / d) * step);
    G.test.step(1 / 60, 3);
    G.test.render(0);
    const ob = G.game.progress.objective;
    const box = document.querySelector("[data-k=compassBox]");
    const pipes = G.game.info().pipes.filter((q) => !q.ripped);
    const hit = pipes.filter((q) => Math.hypot(q.tip[0] - g.x, q.tip[2] - g.z) < 2);
    return {
      n, before, after: ob && ob.detail, title: ob && ob.title, count: ob && ob.n, of: ob && ob.of,
      king: G.game.progress.king,
      goal: g && { kind: g.kind, x: g.x, z: g.z },
      compass: box.title, hidden: box.hidden, dist: document.querySelector("[data-k=dist]").textContent,
      hits: hit.length, pipes: pipes.length, step: +step.toFixed(1),
    };
  });
  await page.screenshot({ path: out + "/pipe.png" });
  const was = metres(card.before), now = metres(card.after);
  check(card.king === "awake" && card.title === "FLUSH THE KING" && card.count === 0 && card.of === 3 && card.goal && card.goal.kind === "pipe" && card.hits === 1, "the card names a pipe that is still on the King", card);
  check(card.compass === "The King's pipe" && !card.hidden && /\d+ m/.test(card.dist || "") && was != null && now != null && was - now > 8, "the compass names that pipe, and the metres drop within three frames", { ...card, was, now });
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
