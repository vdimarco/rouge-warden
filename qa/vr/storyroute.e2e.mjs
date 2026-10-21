// Missions 2, 3 and 4 are a chase, a rescue and a fight. The clog card stays when that route is not running.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("storyroute");
watchdog(420000, "storyroute");
const out = process.env.SHOTS || "/tmp/swing-story-route";
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

  const steps = [
    { i: 0, file: "thief.png", title: /MISSION 2/, body: /thief|purse/i },
    { i: 1, file: "catch.png", title: /MISSION 3/, body: /catch|falling|edge/i },
    { i: 2, file: "brawl.png", title: /MISSION 4/, body: /brawl|wave|roof|gang/i },
  ];
  for (const s of steps) {
    const card = await page.evaluate((i) => {
      G.test.storyMission(i);
      let n = 0;
      for (; n < 120; n++) {
        G.test.step(1 / 60, 1);
        const ob = G.game.progress.objective;
        if (ob && /MISSION/.test(ob.title || "") && G.test.action().jobs.active) break;
      }
      const ob = G.game.progress.objective;
      const el = document.querySelector(".fs-mission");
      return {
        n,
        title: ob && ob.title,
        detail: ob && ob.detail,
        text: el ? el.textContent : "",
        shown: !!(el && !el.hidden),
        job: G.test.action().jobs.active && G.test.action().jobs.active.type,
        offers: G.test.action().jobs.offers.length,
      };
    }, s.i);
    await page.screenshot({ path: out + "/" + s.file });
    const blob = (card.title || "") + " " + (card.detail || "") + " " + card.text;
    check(card.shown && s.title.test(blob) && s.body.test(blob) && !/FLUSH THE CLOGS/.test(blob), s.file + " names its own mission", card);
    check(card.offers === 0, s.file + " hides odd-job markers", card.offers);
  }

  const back = await page.evaluate(() => {
    G.test.storyMission(3);
    let n = 0;
    for (; n < 90; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && /FLUSH THE CLOGS/.test(ob.title || "")) break;
    }
    const ob = G.game.progress.objective;
    return { n, title: ob && ob.title, detail: ob && ob.detail, job: G.test.action().jobs.active };
  });
  check(!back.job && /FLUSH THE CLOGS/.test(back.title || "") && /clog/.test(back.detail || ""), "after the route the clog card returns", back);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
