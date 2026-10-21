// A won job plays a sting that fits it. A ring trial keeps the longer fanfare. A miss plays neither.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("wincue");
watchdog(240000, "wincue");
const out = process.env.SHOTS || "/tmp/swing-win-cue";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
const WINS = ["winWet", "winFight", "winDash", "winLift"];
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); G.game.skipTutorial(); G.test.step(1 / 60, 10); });

  const tone = await page.evaluate(async (wins) => {
    const { renderOffline } = await import("./js/audio.js");
    const band = (buf, t0, t1) => {
      const a = buf.getChannelData(0), sr = buf.sampleRate;
      const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(a.length, Math.floor(t1 * sr));
      let e = 0;
      for (let i = i0; i < i1; i++) e += a[i] * a[i];
      return Math.sqrt(e / Math.max(1, i1 - i0));
    };
    const cosine = (a, b) => {
      const x = a.getChannelData(0), y = b.getChannelData(0), n = Math.min(x.length, y.length);
      let dot = 0, nx = 0, ny = 0;
      for (let i = 0; i < n; i++) { dot += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; }
      return dot / Math.sqrt(Math.max(1e-12, nx * ny));
    };
    const bufs = {};
    for (const name of wins) bufs[name] = await renderOffline(name, 1.4, { seed: 1, at: 0 });
    bufs.trialEnd = await renderOffline("trialEnd", 1.4, { seed: 1, at: 0 });
    const row = (buf) => ({ early: band(buf, 0.02, 0.2), late: band(buf, 0.8, 1.2), hold: buf.stats && buf.stats.voiceEnd });
    const out = {};
    for (const name of Object.keys(bufs)) out[name] = row(bufs[name]);
    let same = 0;
    for (let i = 0; i < wins.length; i++) for (let j = i + 1; j < wins.length; j++) {
      const c = Math.abs(cosine(bufs[wins[i]], bufs[wins[j]]));
      if (c > same) same = c;
    }
    out.same = same;
    return out;
  }, WINS);
  const quiet = WINS.every((n) => tone[n].late < tone[n].early * 0.45 && tone[n].early > 0.01);
  const held = WINS.every((n) => tone[n].hold >= 0.4);
  check(quiet && tone.trialEnd.late > 0.01 && WINS.every((n) => tone.trialEnd.late > tone[n].late * 3), "the job stings go quiet while the ring fanfare is still sounding", tone);
  check(held && tone.same < 0.85, "the four stings are not the same shape, and each voice lasts through its note", tone);

  await page.evaluate(() => {
    window.__sfx = [];
    const f = G.audio.sfx.bind(G.audio);
    G.audio.sfx = (n, o) => { window.__sfx.push(n); return f(n, o); };
    G.test.storyMission(0);
  });

  const purse = await page.evaluate(() => {
    let n = 0;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    window.__sfx.length = 0;
    const killed = G.test.finishJob();
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT IT") break;
    }
    G.test.step(1 / 60, 4);
    G.test.render(0);
    const ob = G.game.progress.objective;
    return { n, m, killed, calls: window.__sfx.slice(), title: ob && ob.title, detail: ob && ob.detail };
  });
  await page.screenshot({ path: out + "/got.png" });
  check(purse.killed && purse.title === "GOT IT" && purse.calls.includes("winDash") && purse.calls.includes("cheer") && !purse.calls.includes("trialEnd") && !purse.calls.some((n) => n === "winWet" || n === "winFight" || n === "winLift"), "winning the purse snatcher plays the dash", purse);

  const rescue = await page.evaluate(() => {
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "catch") break;
    }
    window.__sfx.length = 0;
    const killed = G.test.finishJob();
    if (G.P) G.P.onGround = true;
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT IT") break;
    }
    return { n, m, killed, calls: window.__sfx.slice(), title: G.game.progress.objective && G.game.progress.objective.title, job: G.test.action().win && G.test.action().win.job };
  });
  check(rescue.job === "catch" && rescue.calls.includes("winLift") && !rescue.calls.includes("winDash") && !rescue.calls.includes("trialEnd"), "winning the falling rescue plays the lift", rescue);

  const roof = await page.evaluate(() => {
    let n = 0;
    for (; n < 240; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "brawl") break;
    }
    window.__sfx.length = 0;
    const killed = G.test.finishJob();
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT IT") break;
    }
    return { n, m, killed, calls: window.__sfx.slice(), title: G.game.progress.objective && G.game.progress.objective.title, job: G.test.action().win && G.test.action().win.job };
  });
  check(roof.job === "brawl" && roof.calls.includes("winFight") && !roof.calls.includes("trialEnd"), "winning the roof fight plays the hit", roof);

  const flush = await page.evaluate(() => {
    if (G.test.action().jobs.active) G.test.finishJob();
    for (let i = 0; i < 20; i++) G.test.step(1 / 60, 1);
    window.__sfx.length = 0;
    G.test.job("sludge");
    let n = 0;
    for (; n < 40; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "sludge") break;
    }
    window.__sfx.length = 0;
    const killed = G.test.finishJob();
    let m = 0;
    for (; m < 50; m++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT IT") break;
    }
    return { n, m, killed, calls: window.__sfx.slice(), title: G.game.progress.objective && G.game.progress.objective.title, job: G.test.action().win && G.test.action().win.job };
  });
  check(flush.job === "sludge" && flush.calls.includes("winWet") && !flush.calls.includes("trialEnd"), "winning the sludge run plays the wet sting", flush);

  const miss = await page.evaluate(() => {
    G.test.job("thief");
    let n = 0;
    for (; n < 40; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "thief") break;
    }
    window.__sfx.length = 0;
    const failed = G.test.failJob();
    let m = 0;
    for (; m < 40; m++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.title === "GOT AWAY") break;
    }
    return { n, m, failed, calls: window.__sfx.slice(), title: G.game.progress.objective && G.game.progress.objective.title };
  });
  check(miss.title === "GOT AWAY" && miss.calls.includes("miss") && !miss.calls.some((n) => n === "trialEnd" || n.startsWith("win")), "a miss plays none of the win stings", miss);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
