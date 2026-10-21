// The job sticker in flat play: it names the Sludge Run runner, stays on screen when he is behind you,
// and says when you are closing or falling behind (swing-jobs).
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("goalmark");
watchdog(240000, "goalmark");
const out = SHOTS || "/tmp/swing-goal";
await mkdir(out, { recursive: true });

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1 / 60, 20); });

  const idle = await page.evaluate(() => G.test.action().hud.goal);
  check(idle === "", "with no job the sticker is hidden", idle);

  const on = await page.evaluate(() => {
    G.test.job("sludge");
    const runner = G.test.action().combat.list.find((g) => g.runner);
    G.rigYaw = Math.atan2(-(runner.x - G.P.pos.x), -(runner.z - G.P.pos.z));
    G.flatcam.reset(G.rigYaw, -0.55);
    G.test.step(1 / 60, 8);
    const el = document.querySelector("#actGoal");
    const r = el.getBoundingClientRect();
    return { text: el.innerText.replace(/\n/g, " "), hidden: el.hidden, off: el.classList.contains("off"), box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, w: innerWidth, h: innerHeight, tag: G.jobs.card && G.jobs.card.tag, title: document.querySelector("[data-k=compassBox]").title };
  });
  check(on.tag === "sludge" && /RUNNER/.test(on.text) && /\d+ m/.test(on.text) && !on.hidden && !on.off, "looking at the runner shows RUNNER and the distance on him", on);
  check(on.box.l >= -2 && on.box.t >= -2 && on.box.r <= on.w + 2 && on.box.b <= on.h + 2, "the on-screen sticker stays inside the window", on.box);
  check(on.title === "Your job", "the compass names the job, not a clog", on.title);
  await page.screenshot({ path: out + "/goal-on-runner.png" });

  const away = await page.evaluate(() => {
    G.rigYaw += Math.PI;
    G.flatcam.reset(G.rigYaw, -0.35);
    G.test.step(1 / 60, 5);
    const el = document.querySelector("#actGoal");
    const r = el.getBoundingClientRect();
    return { text: el.innerText.replace(/\n/g, " "), off: el.classList.contains("off"), box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, w: innerWidth, h: innerHeight };
  });
  check(away.off && /RUNNER/.test(away.text), "with the runner behind you the sticker stays up and marks the edge", away);
  check(away.box.l >= 8 && away.box.t >= 8 && away.box.r <= away.w - 8 && away.box.b <= away.h - 8, "the edge sticker stays inside the window", away.box);
  await page.screenshot({ path: out + "/goal-offscreen.png" });

  const trend = await page.evaluate(() => {
    const runner = G.test.action().combat.list.find((g) => g.runner);
    const toward = () => {
      const dx = runner.x - G.P.pos.x, dz = runner.z - G.P.pos.z, d = Math.hypot(dx, dz) || 1;
      G.test.teleport(G.P.pos.x + dx / d * 8, G.P.pos.y, G.P.pos.z + dz / d * 8);
      G.test.step(1 / 60, 20);
    };
    toward(); toward();
    const closing = document.querySelector("#actGoal").innerText;
    const dx = G.P.pos.x - runner.x, dz = G.P.pos.z - runner.z, d = Math.hypot(dx, dz) || 1;
    G.test.teleport(runner.x + dx / d * 80, G.P.pos.y, runner.z + dz / d * 80);
    G.test.step(1 / 60, 40);
    return { closing: closing.replace(/\n/g, " "), behind: document.querySelector("#actGoal").innerText.replace(/\n/g, " ") };
  });
  check(/CLOSING/.test(trend.closing), "moving toward the runner says CLOSING", trend);
  check(/FALLING BEHIND/.test(trend.behind), "leaving the runner says FALLING BEHIND", trend);

  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "goalmark threw", e.stack || String(e));
}
await close();
done();
