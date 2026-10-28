// Falling behind turns the mission card hot. Closing the gap brings the ink pill back.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("pullheat");
watchdog(420000, "pullheat");
const out = process.env.SHOTS || "/tmp/swing-pullheat";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  const hot = await page.evaluate(() => {
    G.test.storyMission(0);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    const runner = () => G.test.action().combat.list.find((g) => g.runner && g.hp > 0);
    let frames = 0, seen = null;
    for (; frames < 160; frames++) {
      const g = runner();
      if (!g) break;
      G.test.teleport(g.x + 40, g.y + 0.2, g.z);
      G.test.face(g.x, g.z);
      G.test.step(1 / 60, 1);
      const el = document.querySelector(".fs-mission");
      const ob = G.game.progress.objective;
      if (el && el.classList.contains("fs-pull") && ob && /pulling away/i.test(ob.detail || "")) { seen = frames; break; }
    }
    G.test.render(0);
    const el = document.querySelector(".fs-mission");
    const s = el ? getComputedStyle(el) : null;
    const a = G.test.action();
    const ob = G.game.progress.objective;
    return {
      n, frames, seen,
      pull: !!(el && el.classList.contains("fs-pull")),
      border: s ? s.borderTopColor : "",
      bg: s ? s.backgroundColor : "",
      title: ob && ob.title,
      detail: ob && ob.detail,
      heat: a.jobs.active && a.jobs.active.data && a.jobs.active.data.heat,
      run: a.jobs.active && a.jobs.active.data && a.jobs.active.data.run,
    };
  });
  await page.screenshot({ path: out + "/hot.png" });
  check(hot.pull && hot.heat >= 0.55 && hot.run > 7.4 && /pulling away/i.test(hot.detail || ""), "falling behind turns the card hot", hot);
  check(/216,\s*69,\s*122/.test(hot.border) && /255,\s*214,\s*196/.test(hot.bg), "the hot card is a warm fill with a magenta edge", hot);

  const calm = await page.evaluate(() => {
    const runner = () => G.test.action().combat.list.find((g) => g.runner && g.hp > 0);
    let frames = 0;
    for (; frames < 80; frames++) {
      const g = runner();
      if (!g) break;
      G.test.teleport(g.x + 2, g.y + 0.2, g.z);
      G.test.step(1 / 60, 1);
      const el = document.querySelector(".fs-mission");
      const ob = G.game.progress.objective;
      if (el && !el.classList.contains("fs-pull") && ob && /run him down/i.test(ob.detail || "")) break;
    }
    const el = document.querySelector(".fs-mission");
    const s = el ? getComputedStyle(el) : null;
    const a = G.test.action();
    const ob = G.game.progress.objective;
    return {
      frames,
      pull: !!(el && el.classList.contains("fs-pull")),
      border: s ? s.borderTopColor : "",
      detail: ob && ob.detail,
      heat: a.jobs.active && a.jobs.active.data && a.jobs.active.data.heat,
    };
  });
  check(!calm.pull && calm.heat < 0.55 && /run him down/i.test(calm.detail || "") && !/216,\s*69,\s*122/.test(calm.border), "closing the gap brings the ink pill back", calm);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
