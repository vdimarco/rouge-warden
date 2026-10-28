// A flat-play win hops the hero off the street. A miss, and reduced motion, do not.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("winlaunch");
watchdog(420000, "winlaunch");
const out = process.env.SHOTS || "/tmp/swing-winlaunch";
await mkdir(out, { recursive: true });

async function boot(page) {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone && G.fx && G.fx.info().ready, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });
}

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await boot(page);
  const played = await page.evaluate(() => {
    function untilThief() {
      G.test.storyMission(0);
      let n = 0;
      for (; n < 180; n++) {
        G.test.step(1 / 60, 1);
        const job = G.test.action().jobs.active;
        if (job && job.type === "thief") return n;
      }
      return n;
    }
    const missAt = untilThief();
    const before = G.test.state();
    const failed = G.test.failJob();
    let mf = 0;
    for (; mf < 40; mf++) {
      G.test.step(1 / 60, 1);
      if (G.test.action().miss) break;
    }
    G.test.step(1 / 60, 6);
    const missed = G.test.state();
    const miss = G.test.action().miss;
    const winDuringMiss = G.test.action().win;
    const obMiss = G.game.progress.objective;

    const winAt = untilThief();
    const stood = G.test.state();
    const killed = G.test.finishJob();
    let wf = 0;
    for (; wf < 40; wf++) {
      G.test.step(1 / 60, 1);
      if (G.test.action().win) break;
    }
    const atWin = G.test.state();
    // near the top of the hop, while the win card is still up (the hold is 1.35 s)
    G.test.step(1 / 60, 24);
    const risen = G.test.state();
    const a = G.test.action();
    const ob = G.game.progress.objective;
    G.test.render(0.4);
    return {
      missAt, failed, mf,
      miss: miss && { why: miss.why, job: miss.job, hold: miss.hold },
      winDuringMiss: !!winDuringMiss,
      missTitle: obMiss && obMiss.title,
      y0: before.pos.y, yMiss: missed.pos.y, vy0: before.vel.y, vyMiss: missed.vel.y,
      winAt, killed, wf,
      win: a.win, pose: a.hero,
      yWin: atWin.pos.y, yHop: risen.pos.y, vyHop: risen.vel.y,
      groundWin: atWin.onGround, groundHop: risen.onGround,
      title: ob && ob.title, detail: ob && ob.detail,
      job: a.jobs.active && a.jobs.active.type,
    };
  });
  await page.screenshot({ path: out + "/hop.png" });
  check(played.failed && played.miss && played.miss.why === "away" && !played.winDuringMiss, "a miss is not a win", played.miss);
  check(played.yMiss - played.y0 < 0.25 && played.vyMiss < played.vy0 + 3, "a miss does not launch the hero", { y0: played.y0, yMiss: played.yMiss, vy0: played.vy0, vyMiss: played.vyMiss });
  check(played.killed && played.win && played.win.job === "thief" && played.win.word === "KASPLASH" && played.win.up > 6, "catching the thief launches upward", played.win);
  check(played.yHop - played.yWin > 0.4 && !played.groundHop && (played.pose === "jump" || played.pose === "fall"), "the hero rises off the street", { yWin: played.yWin, yHop: played.yHop, vy: played.vyHop, pose: played.pose, ground: played.groundHop });
  check(!played.job && played.title === "GOT IT" && !/MISSION 3/.test((played.title || "") + " " + (played.detail || "")), "Mission 3 waits during the hop", played);

  const quiet = await newPage({ width: 1280, height: 800 });
  await quiet.emulateMedia({ reducedMotion: "reduce" });
  await quiet.addInitScript(() => {
    window.AudioContext = window.webkitAudioContext = undefined;
    Object.defineProperty(navigator, "getGamepads", { value: () => [] });
  });
  await boot(quiet);
  const reduced = await quiet.evaluate(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)").matches;
    G.test.storyMission(0);
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    const stood = G.test.state();
    const killed = G.test.finishJob();
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      if (G.test.action().win) break;
    }
    const at = G.test.state();
    G.test.step(1 / 60, 8);
    const later = G.test.state();
    const a = G.test.action();
    return { media, n, killed, win: a.win, y0: stood.pos.y, yAt: at.pos.y, yLater: later.pos.y, pose: a.hero, ground: later.onGround };
  });
  check(reduced.media && reduced.killed && reduced.win && reduced.win.word === "KASPLASH" && reduced.win.up === 0, "reduced motion keeps the word and does not launch", reduced);
  check(reduced.yLater - reduced.yAt < 0.25, "reduced motion stays on the street", { yAt: reduced.yAt, yLater: reduced.yLater, pose: reduced.pose });
  check(page.errors.length === 0 && quiet.errors.length === 0, "no page errors", page.errors.concat(quiet.errors));
} finally {
  await close();
  done();
}
