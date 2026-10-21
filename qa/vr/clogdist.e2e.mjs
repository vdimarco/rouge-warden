// The clog card's distance drops on the next frames of a move, not half a second later.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("clogdist");
watchdog(240000, "clogdist");
const out = process.env.SHOTS || "/tmp/swing-clogdist";
await mkdir(out, { recursive: true });

const metres = (detail) => {
  const m = /clog, (\d+) m/.exec(detail || "");
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

  const moved = await page.evaluate(() => {
    let n = 0;
    for (; n < 90; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      const g = G.game.progress.goal;
      if (ob && ob.title === "FLUSH THE CLOGS" && g && g.kind === "clog" && /clog, \d+ m/.test(ob.detail || "")) break;
    }
    const before = G.game.progress.objective.detail;
    const g = G.game.progress.goal;
    const p = G.P.pos;
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
    const step = Math.min(24, d * 0.4);
    G.test.teleport(p.x + (dx / d) * step, p.y, p.z + (dz / d) * step);
    G.test.step(1 / 60, 3);
    G.test.render(0);
    const ob = G.game.progress.objective;
    const box = document.querySelector("[data-k=compassBox]");
    return {
      n, before, after: ob && ob.detail, title: ob && ob.title,
      name: g.name, compass: box.title, step: +step.toFixed(1),
    };
  });
  await page.screenshot({ path: out + "/closer.png" });
  const was = metres(moved.before), now = metres(moved.after);
  check(moved.title === "FLUSH THE CLOGS" && was != null && now != null && was - now > 8, "three frames closer and the card distance has already dropped", { ...moved, was, now });
  check(moved.compass === moved.name + " clog" && moved.after.indexOf("Next: " + moved.name + " clog") === 0, "the compass still names that same clog", moved);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
