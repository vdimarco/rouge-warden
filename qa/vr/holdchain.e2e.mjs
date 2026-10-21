// A held swing button lets go on the GO cue and catches the next building. Letting go early does not.
import { mkdir } from "node:fs/promises";
import { newPage, open, close, enterXR, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("holdchain");
watchdog(240000, "holdchain");
const out = SHOTS || "/tmp/swing-holdchain";
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

  await page.evaluate(() => {
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
    G.P.vel.x = -Math.sin(yaw) * 8; G.P.vel.z = -Math.cos(yaw) * 8; G.P.vel.y = -4; G.P.onGround = false;
    G.test.step(1 / 60, 10);
  });
  await page.keyboard.down("KeyE");
  const held = await page.evaluate(() => {
    const before = G.test.events().length;
    let n = 0, first = null;
    for (; n < 180; n++) {
      G.test.step(1 / 60, 1);
      const r = G.P.ropes.find((q) => q.state === "attached" && q.target && q.target.tag === "building");
      if (r) { first = r.target.id; break; }
    }
    let second = null, frames = 0, ups = 0, drys = 0, fires = 0;
    const start = G.test.events().length;
    for (; frames < 420 && second == null; frames++) {
      G.test.step(1 / 60, 1);
      const ev = G.test.events();
      for (let i = start; i < ev.length; i++) {
        const e = ev[i];
        if (e.type === "input" && e.edge === "triggerUp") ups++;
        if (e.type === "dry") drys++;
        if (e.type === "fire") fires++;
        if (e.type === "attach" && e.target && e.target.tag === "building" && e.target.id !== first) second = e.target.id;
      }
    }
    G.test.render(0);
    const ropes = G.test.state().ropes.map((r) => ({ state: r.state, tag: r.tag, id: r.id }));
    return { n, frames, first, second, ups, drys, fires, ropes, air: !G.P.onGround, before };
  });
  await page.screenshot({ path: out + "/chain.png" });
  check(held.first != null && held.second != null && held.second !== held.first, "holding E through the cue catches a different building", held);
  check(held.ups === 0 && held.drys === 0 && held.fires >= 1, "the next web is not a new press and not a dry fire", held);

  await page.keyboard.up("KeyE");
  await page.evaluate(() => {
    G.test.step(1 / 60, 5);
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
    G.P.vel.x = -Math.sin(yaw) * 8; G.P.vel.z = -Math.cos(yaw) * 8; G.P.vel.y = -4; G.P.onGround = false;
    G.test.step(1 / 60, 5);
  });
  await page.keyboard.down("KeyE");
  const letGo = await page.evaluate(() => {
    let n = 0;
    for (; n < 90 && !G.P.ropes.some((r) => r.state === "attached"); n++) G.test.step(1 / 60, 1);
    const attached = G.P.ropes.some((r) => r.state === "attached");
    const cue = !!G.test.action().cueAir[0] || !!G.test.action().cueAir[1];
    return { n, attached, cue };
  });
  await page.keyboard.up("KeyE");
  const after = await page.evaluate((letGo) => {
    const mark = G.test.events().length;
    G.test.step(1 / 60, 45);
    const ev = G.test.events().slice(mark);
    return {
      attached: letGo.attached, cue: letGo.cue,
      fires: ev.filter((e) => e.type === "fire").length,
      idle: G.test.state().ropes.every((r) => r.state === "idle"),
    };
  }, letGo);
  check(after.attached && after.idle && after.fires === 0, "letting E up lets the rope go and does not catch another building", after);
  check(page.errors.length === 0, "no page errors", page.errors);
} catch (e) {
  check(false, "the hold-chain run threw", e.stack || String(e));
} finally {
  await close();
  done();
}
