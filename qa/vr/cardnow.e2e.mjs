// The score-row card is painted after the objective, so one frame is enough for a new clock, the hot card, and a closer clog.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("cardnow");
watchdog(420000, "cardnow");
const out = process.env.SHOTS || "/tmp/swing-cardnow";
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
  await page.evaluate(() => {
    G.renderer.setAnimationLoop(null);
    G.test.hold(true);
    G.test.step(1 / 60, 20);
    G.game.skipTutorial();
    G.test.step(1 / 60, 8);
    window.__card = () => {
      const el = document.querySelector(".fs-mission");
      const b = el && el.querySelector("b");
      const sm = el && el.querySelector("small");
      const ob = G.game.progress.objective;
      const want = ob ? ob.title + (ob.of ? " " + ob.n + "/" + ob.of : "") : "";
      return {
        domTitle: b ? b.textContent : "",
        domDetail: sm ? sm.textContent : "",
        pull: !!(el && el.classList.contains("fs-pull")),
        want,
        detail: ob ? ob.detail : "",
        hot: !!(ob && ob.hot),
        title: ob && ob.title,
      };
    };
  });

  const closer = await page.evaluate(() => {
    const before = window.__card();
    const g = G.game.progress.goal;
    const dx = g.x - G.P.pos.x, dz = g.z - G.P.pos.z, d = Math.hypot(dx, dz);
    G.test.teleport(G.P.pos.x + (dx / d) * 40, G.P.pos.y, G.P.pos.z + (dz / d) * 40);
    G.test.step(1 / 60, 1);
    const after = window.__card();
    return { before, after, from: d };
  });
  const was = /([\d.]+) m/.exec(closer.before.domDetail || "");
  const now = /([\d.]+) m/.exec(closer.after.domDetail || "");
  check(was && now && now[1] < was[1] - 5, "one step toward a clog shortens the metres on the pill", { was: closer.before.domDetail, now: closer.after.domDetail });
  check(closer.after.domTitle === closer.after.want && closer.after.domDetail === closer.after.detail, "that pill matches the objective from the same frame", closer.after);

  const calm = await page.evaluate(() => {
    G.test.job("brawl");
    const g = G.test.action().combat.list.find((q) => q.group === "job");
    if (g) G.test.teleport(g.x + 80, g.y, g.z);
    G.test.step(1 / 60, 4);
    return window.__card();
  });
  check(/120 s/.test(calm.domTitle) && calm.domTitle === calm.want && !calm.pull, "a two-minute fight is the ink pill", calm);

  const hot = await page.evaluate(() => {
    G.test.jobClock(7);
    G.test.step(1 / 60, 1);
    G.test.render(0);
    return window.__card();
  });
  await page.screenshot({ path: out + "/now.png" });
  check(/7 s/.test(hot.domTitle) && hot.pull && hot.hot && hot.domTitle === hot.want && hot.domDetail === hot.detail, "one frame paints 7 s and the hot card", hot);

  check(!page.errors.length, "no page errors", page.errors);
} finally {
  await close();
}
done();
