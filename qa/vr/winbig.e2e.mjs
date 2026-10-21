// A roof fight hops higher and hangs longer than catching the purse snatcher. A miss still does not hop.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("winbig");
watchdog(420000, "winbig");
const out = process.env.SHOTS || "/tmp/swing-winbig";
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); G.game.skipTutorial(); G.test.step(1 / 60, 8); });

  const played = await page.evaluate(() => {
    const home = { x: G.P.pos.x, y: G.P.pos.y, z: G.P.pos.z };
    function plant() {
      G.test.teleport(home.x, home.y, home.z);
      G.test.step(1 / 60, 6);
    }
    function pop(type) {
      plant();
      if (type === "thief") G.test.storyMission(0);
      else G.test.job(type);
      let n = 0;
      for (; n < 180; n++) {
        G.test.step(1 / 60, 1);
        const job = G.test.action().jobs.active;
        if (job && job.type === type) break;
      }
      if (type === "brawl") {
        const g = G.test.action().combat.list.find((q) => q.group === "job");
        if (g) G.test.teleport(g.x + 80, g.y, g.z);
        G.test.step(1 / 60, 2);
      }
      plant();
      const before = G.test.state();
      const killed = G.test.finishJob();
      let m = 0;
      for (; m < 40; m++) {
        G.test.step(1 / 60, 1);
        const w = G.test.action().win;
        if (w && w.job === type) break;
      }
      const at = G.test.state();
      const win = G.test.action().win;
      const slow = G.test.action().slowT;
      G.test.step(1 / 60, 18);
      const hop = G.test.state();
      return {
        n, m, killed, slow,
        up: win && win.up, big: !!(win && win.big), hold: win && win.hold, job: win && win.job, word: win && win.word,
        y0: before.pos.y, yAt: at.pos.y, yHop: hop.pos.y, ground: before.onGround, air: !hop.onGround,
      };
    }
    const thief = pop("thief");
    const brawl = pop("brawl");
    G.test.render(0);
    return { thief, brawl };
  });
  await page.screenshot({ path: out + "/hop.png" });
  const thief = played.thief, brawl = played.brawl;
  check(thief.killed && thief.job === "thief" && thief.up === 8 && !thief.big && thief.hold > 1.2 && thief.hold < 1.5, "catching the purse snatcher is the shorter hop", thief);
  check(brawl.killed && brawl.job === "brawl" && brawl.up === 14 && brawl.big && brawl.word === "KASPLASH" && brawl.hold > 1.7, "the roof fight hops higher and hangs longer", brawl);
  check(brawl.yHop - brawl.yAt > thief.yHop - thief.yAt + 1 && brawl.air, "the hero is higher after the roof fight than after the chase", { thief: thief.yHop - thief.yAt, brawl: brawl.yHop - brawl.yAt, air: brawl.air });
  check(brawl.slow > thief.slow + 0.2, "the roof fight keeps the slow moment longer", { thief: thief.slow, brawl: brawl.slow });
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
