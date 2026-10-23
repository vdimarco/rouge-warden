// A mission that takes the card plays a short brass stab. A trial, and a job with no mission name, still count in.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("beatstab");
watchdog(240000, "beatstab");
const out = process.env.SHOTS || "/tmp/swing-beat-stab";
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

  const tone = await page.evaluate(async () => {
    const { renderOffline } = await import("./js/audio.js");
    const band = (buf, t0, t1) => {
      const a = buf.getChannelData(0), sr = buf.sampleRate;
      const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(a.length, Math.floor(t1 * sr));
      let e = 0;
      for (let i = i0; i < i1; i++) e += a[i] * a[i];
      return Math.sqrt(e / Math.max(1, i1 - i0));
    };
    const beat = await renderOffline("beat", 1.6, { seed: 1, at: 0 });
    const trial = await renderOffline("trialStart", 1.6, { seed: 1, at: 0 });
    return {
      beatEarly: band(beat, 0.02, 0.32), beatLate: band(beat, 0.9, 1.45),
      trialEarly: band(trial, 0.02, 0.32), trialLate: band(trial, 0.9, 1.45),
      beatHold: beat.stats && beat.stats.voiceEnd,
    };
  });
  check(tone.beatEarly > 0.02 && tone.beatLate < tone.beatEarly * 0.35, "the stab is loud at once and quiet after four fifths of a second", tone);
  check(tone.beatHold >= 0.6, "the stab's voice lasts through the second brass note", tone);
  check(tone.trialLate > 0.01 && tone.trialLate > tone.beatLate * 3, "the trial countdown is still sounding after four fifths of a second", tone);

  const played = await page.evaluate(() => {
    const calls = [];
    const f = G.audio.sfx.bind(G.audio);
    G.audio.sfx = (n, o) => { calls.push(n); return f(n, o); };
    const ids = G.game.targets().filter((t) => t.kind === "clog" && !t.done).map((t) => t.id);
    const mark = calls.length;
    G.test.clearClog(ids[0]);
    let n = 0;
    for (; n < 80; n++) {
      G.test.step(1 / 60, 1);
      const ob = G.game.progress.objective;
      if (ob && ob.n === 1 && /FLUSH THE CLOGS/.test(ob.title || "") && !G.test.action().jobs.active) break;
    }
    const one = calls.slice(mark);
    const mark2 = calls.length;
    G.test.clearClog(ids[1]);
    let m = 0;
    for (; m < 180; m++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      const ob = G.game.progress.objective;
      if (job && job.type === "catch" && ob && /OVER THE EDGE/.test(ob.title || "")) break;
    }
    G.test.step(1 / 60, 4);
    G.test.render(0);
    const two = calls.slice(mark2);
    const ob = G.game.progress.objective;
    return {
      n, m, one, two,
      title: ob && ob.title, detail: ob && ob.detail,
      job: G.test.action().jobs.active && G.test.action().jobs.active.type,
      king: G.game.progress.king,
    };
  });
  await page.screenshot({ path: out + "/stab.png" });
  check(!played.one.includes("beat") && !played.one.includes("trialStart"), "the first flush does not stab and does not count in", played.one);
  check(played.job === "catch" && /OVER THE EDGE/.test(played.title || "") && played.two.includes("beat") && !played.two.includes("trialStart") && played.king !== "awake", "the second flush stabs, and the trial countdown stays out", played);

  const odd = await page.evaluate(() => {
    const calls = [];
    const f = G.audio.sfx.bind(G.audio);
    G.audio.sfx = (n, o) => { calls.push(n); return f(n, o); };
    if (G.test.action().jobs.active) G.test.finishJob();
    for (let i = 0; i < 30; i++) G.test.step(1 / 60, 1);
    calls.length = 0;
    G.test.job("pizza");
    let n = 0;
    for (; n < 40; n++) {
      G.test.step(1 / 60, 1);
      const job = G.test.action().jobs.active;
      if (job && job.type === "pizza" && calls.includes("trialStart")) break;
    }
    const job = G.test.action().jobs.active;
    const ob = G.game.progress.objective;
    return { n, calls, job: job && job.type, title: ob && ob.title };
  });
  check(odd.job === "pizza" && /PIZZA/.test(odd.title || "") && !/OVER THE EDGE|MISSION/.test(odd.title || "") && odd.calls.includes("trialStart") && !odd.calls.includes("beat"), "a job with no mission name still counts in", odd);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
