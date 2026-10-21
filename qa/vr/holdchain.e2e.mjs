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

  const held = await page.evaluate(() => {
    const S = G.city.start, yaw = S.yaw;
    G.test.teleport(S.x, S.y + 30, S.z);
    G.rigYaw = yaw; G.desktop.level(0); G.flatcam.reset(yaw);
    G.P.onGround = false;
    G.P.vel.x = -Math.sin(yaw) * 8; G.P.vel.z = -Math.cos(yaw) * 8; G.P.vel.y = -4;
    G.test.step(1 / 60, 15);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
    const mark = G.frame;
    const log = [], seen = new Set();
    const take = () => {
      for (const e of G.test.events()) {
        if (!(e.frame > mark)) continue;
        if (e.type !== "attach" && e.type !== "fire" && e.type !== "detach" && e.type !== "dry" && !(e.type === "input" && e.edge === "triggerUp")) continue;
        const key = e.frame + ":" + e.type + ":" + (e.side ?? "") + ":" + (e.target && e.target.id);
        if (seen.has(key)) continue;
        seen.add(key);
        log.push({ t: e.type, tag: e.target && e.target.tag, id: e.target && e.target.id, frame: e.frame });
      }
    };
    let frames = 0, cue = 0, wallAt = -1;
    for (; frames < 500; frames++) {
      G.test.step(1 / 60, 1);
      take();
      const act = G.test.action();
      if (act.cueAir[0] || act.cueAir[1]) cue++;
      if (G.P.wall && wallAt < 0) wallAt = frames;
      const builds = log.filter((e) => e.t === "attach" && e.tag === "building");
      const ids = [...new Set(builds.map((e) => e.id))];
      if (ids.length >= 2 && log.some((e) => e.t === "detach")) break;
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" }));
    G.test.render(0);
    const attaches = log.filter((e) => e.t === "attach");
    const first = attaches[0] || null;
    const building = attaches.find((e) => e.tag === "building" && first && e.id !== first.id) || null;
    return {
      frames, cue, wallAt, first, building,
      ups: log.filter((e) => e.t === "input").length,
      drys: log.filter((e) => e.t === "dry").length,
      fires: log.filter((e) => e.t === "fire").length,
      log: log.slice(0, 14),
      air: !G.P.onGround, wall: !!G.P.wall,
      y: +G.P.pos.y.toFixed(1),
    };
  });
  await page.screenshot({ path: out + "/chain.png" });
  console.log("chain", JSON.stringify({ frames: held.frames, cue: held.cue, wallAt: held.wallAt, first: held.first, building: held.building, fires: held.fires, y: held.y, log: held.log }));
  const gap = held.building && held.log ? held.building.frame - (held.log.find((e) => e.t === "detach") || {}).frame : null;
  check(held.first && held.building && held.building.id !== held.first.id && gap != null && gap < 90, "holding E through the cue catches a different building", { ...held, gap });
  check(held.ups === 0 && held.drys === 0 && held.fires >= 2, "the next web is not a new press and not a dry fire", held);

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
