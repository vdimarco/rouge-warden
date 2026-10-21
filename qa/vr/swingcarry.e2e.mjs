// A fast let-go outside the GO cue still carries the swing. A slow drop does not. The cue let-go stays the flip.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog } from "./lib.mjs";

const { check, done } = checker("swingcarry");
watchdog(420000, "swingcarry");
const out = process.env.SHOTS || "/tmp/swing-carry";
await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, "getGamepads", { value: () => [] }); };

const page = await newPage({ width: 1280, height: 800 });
await page.addInitScript(quiet);
try {
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => window.G && G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  await page.mouse.move(640, 400);

  const carry = await page.evaluate(() => {
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
    G.P.vel.x = -Math.sin(yaw) * 10; G.P.vel.z = -Math.cos(yaw) * 10; G.P.vel.y = -4; G.P.onGround = false;
    G.test.step(1 / 60, 20);
    return { yaw };
  });
  await page.mouse.down();
  const armed = await page.evaluate((yaw) => {
    let n = 0, attached = false;
    for (; n < 90; n++) {
      G.test.step(1 / 60, 1);
      if (G.P.ropes[0].state === "attached") { attached = true; break; }
    }
    // falling, and fast across the rope: outside the GO window, which needs a rise. Along the rope the web would eat the speed.
    const A = G.P.ropes[0].anchor, cx = G.P.pos.x - A.x, cz = G.P.pos.z - A.z, d = Math.hypot(cx, cz) || 1;
    G.P.vel.x = -cz / d * 14; G.P.vel.z = cx / d * 14; G.P.vel.y = -8; G.P.onGround = false;
    G.test.step(1 / 60, 1);
    const cue = !!G.test.action().cueAir[0];
    const before = G.test.events().length;
    const hs0 = Math.hypot(G.P.vel.x, G.P.vel.z), vy0 = G.P.vel.y;
    return { n, attached, cue, before, hs0, vy0, pose0: G.test.action().hero };
  }, carry.yaw);
  await page.mouse.up();
  const flew = await page.evaluate((armed) => {
    G.test.step(1 / 60, 3);
    G.test.render(0.05);
    const ev = G.test.events().slice(armed.before);
    const b = ev.find((e) => e.type === "boost");
    return {
      attached: armed.attached, cue: armed.cue, n: armed.n,
      boost: !!b, perfect: b ? !!b.perfect : null, added: b ? b.added : 0,
      hs0: armed.hs0, hs1: Math.hypot(G.P.vel.x, G.P.vel.z),
      vy0: armed.vy0, vy1: G.P.vel.y,
      pose: G.test.action().hero, air: !G.P.onGround,
    };
  }, armed);
  await page.screenshot({ path: out + "/carry.png" });
  check(flew.attached && flew.cue === false, "the let-go is outside the GO cue", flew);
  check(flew.boost && flew.perfect === false && flew.added > 1 && flew.added < 3.5, "a fast let-go outside the cue still carries", flew);
  check(flew.pose !== "flip" && flew.air && flew.vy1 < -1 && flew.hs1 > 10, "the fall continues and the hero does not flip", flew);

  const drop = await page.evaluate(() => {
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
    G.P.onGround = false; G.P.vel.x = G.P.vel.y = G.P.vel.z = 0;
    G.test.step(1 / 60, 5);
    return { yaw };
  });
  await page.mouse.down();
  await page.evaluate(() => {
    for (let n = 0; n < 90 && G.P.ropes[0].state !== "attached"; n++) G.test.step(1 / 60, 1);
    G.P.vel.x = G.P.vel.z = 0; G.P.vel.y = -4; G.P.onGround = false;
    G.test.step(1 / 60, 1);
  });
  await page.mouse.up();
  const still = await page.evaluate(() => {
    const before = G.test.events().length;
    const hs0 = Math.hypot(G.P.vel.x, G.P.vel.z);
    G.test.step(1 / 60, 2);
    const b = G.test.events().slice(before).some((e) => e.type === "boost");
    return { hs0, boost: b, cue: !!G.test.action().cueAir[0] };
  });
  check(still.hs0 < 8 && !still.boost, "a slow drop does not carry", still);
  check(page.errors.length === 0, "no page errors", page.errors);
} finally {
  await close();
  done();
}
