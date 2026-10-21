// A clock about to run out, a falling person, and a balloon getting away use the same hot card as a chase that is pulling away.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("clockheat");
watchdog(420000, "clockheat");
const out = process.env.SHOTS || "/tmp/swing-clockheat";
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
    window.__pill = () => {
      const el = document.querySelector(".fs-mission");
      const s = el ? getComputedStyle(el) : null;
      const ob = G.game.progress.objective;
      const job = G.test.action().jobs.active;
      return {
        pull: !!(el && el.classList.contains("fs-pull")),
        border: s ? s.borderTopColor : "",
        bg: s ? s.backgroundColor : "",
        title: ob && ob.title,
        detail: ob && ob.detail,
        hot: !!(ob && ob.hot),
        type: job && job.type,
        timer: job && job.timer,
      };
    };
  });

  const calm = await page.evaluate(() => {
    const home = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z };
    G.test.job("brawl");
    G.test.teleport(home.x, home.y + 30, home.z);
    G.test.step(1 / 60, 4);
    return window.__pill();
  });
  check(calm.type === "brawl" && calm.timer > 100 && !calm.pull && !calm.hot && /BRAWL/.test(calm.title || ""), "a two-minute fight is the ink pill", calm);

  const hot = await page.evaluate(() => {
    G.test.jobClock(7);
    G.test.step(1 / 60, 4);
    G.test.render(0);
    return window.__pill();
  });
  await page.screenshot({ path: out + "/hot.png" });
  check(hot.pull && hot.hot && hot.type === "brawl" && /BRAWL/.test(hot.title || "") && /7 s/.test(hot.title || ""), "seven seconds left turns the card hot", hot);
  check(/216,\s*69,\s*122/.test(hot.border) && /255,\s*214,\s*196/.test(hot.bg), "the hot card is a warm fill with a magenta edge", hot);

  const back = await page.evaluate(() => {
    G.test.jobClock(30);
    G.test.step(1 / 60, 4);
    return window.__pill();
  });
  check(!back.pull && !back.hot && /30 s/.test(back.title || "") && !/216,\s*69,\s*122/.test(back.border), "time put back brings the ink pill", back);

  const won = await page.evaluate(() => {
    const killed = G.test.finishJob();
    let n = 0;
    for (; n < 40; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT IT") break;
    }
    return { n, killed, card: window.__pill() };
  });
  check(won.killed && won.card.title === "GOT IT" && !won.card.pull && !won.card.hot, "a won job stays the ink pill", won);

  const balloon = await page.evaluate(() => {
    G.test.teleport(G.P.pos.x, Math.max(0, G.P.pos.y - 30), G.P.pos.z);
    G.test.job("balloon");
    let n = 0;
    for (; n < 120; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "balloon" && job.timer <= 0) break;
    }
    G.test.step(1 / 60, 4);
    const low = window.__pill();
    const rose = G.test.jobFloat(140);
    G.test.step(1 / 60, 4);
    const high = window.__pill();
    G.test.jobFloat(40);
    G.test.step(1 / 60, 4);
    const down = window.__pill();
    return { n, rose, low, high, down };
  });
  check(balloon.low.type === "balloon" && balloon.low.timer <= 0 && !balloon.low.pull && !balloon.low.hot && /floats away/i.test(balloon.low.detail || ""), "a balloon still low stays the ink pill", balloon.low);
  check(balloon.rose === 140 && balloon.high.pull && balloon.high.hot && /140/.test(balloon.high.detail || ""), "a balloon at 140 m turns the card hot", balloon.high);
  check(!balloon.down.pull && !balloon.down.hot && /floats away/i.test(balloon.down.detail || ""), "bringing the balloon back down brings the ink pill", balloon.down);

  const fall = await page.evaluate(() => {
    G.test.storyMission(1);
    let n = 0;
    for (; n < 360; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "catch") break;
    }
    const started = window.__pill();
    if (started.type !== "catch") return { n, started, falling: null };
    const p = G.P.pos;
    G.test.teleport(p.x + 40, p.y, p.z);
    const fell = G.test.jobFall();
    G.test.step(1 / 60, 4);
    return { n, fell, started, falling: window.__pill() };
  });
  check(fall.started.type === "catch" && !fall.started.hot && !fall.started.pull, "the edge wait is the ink pill", fall.started);
  check(fall.fell && fall.falling.hot && fall.falling.pull && /hit the street/i.test(fall.falling.detail || ""), "a falling person turns the card hot", fall.falling);

  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
