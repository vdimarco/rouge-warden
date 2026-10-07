// The phone's move stick, its free look and its two-thumb pair, with real touch events (Chrome DevTools touch input): the stick
// walks the hero, and pushed to the rim it sprints; a drag turns the view, and in the air the view stays put for a while after
// the drag; two fingers down together throw a pair that holds both plungers, even when one lifts late; taps that do not overlap
// still hand the swing over. Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/phone-move.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("phone-move");
watchdog(600000, "phone-move");
const out = SHOTS || "/tmp/swing-qa";
await mkdir(out, { recursive: true });

try {
  const page = await newPage({ width: 844, height: 390 });
  await page.addInitScript(() => {
    window.AudioContext = window.webkitAudioContext = undefined;
    Object.defineProperty(navigator, "getGamepads", { value: () => [] });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone, null, { timeout: 300000 });
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play", null, { timeout: 120000 });
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); window.step = (n) => G.test.step(1 / 60, n); });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const roof = () => page.evaluate(() => { const S = G.city.start; G.test.teleport(S.x, S.y, S.z); G.rigYaw = S.yaw; G.flatcam.reset(S.yaw); for (const r of [0, 1]) if (G.P.ropes[r].state !== "idle") G.test.release?.(r); step(10); });

  /* ---- the move stick ---- */
  await roof();
  const box = await page.evaluate(() => { const b = document.querySelector("#actTouch .stick"); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: !b.hidden, phone: !!G.input.easySwing }; });
  check(box.phone && box.shown, "a phone shows the move stick", box);
  const p0 = await page.evaluate(() => ({ ...G.test.state().pos }));
  await touch("touchStart", [{ x: box.x, y: box.y, id: 11 }]);
  await touch("touchMove", [{ x: box.x, y: box.y - 30, id: 11 }]); // part way up
  const walk = await page.evaluate((p0) => { step(60); const p = G.test.state().pos; return { d: Math.hypot(p.x - p0.x, p.z - p0.z), sprint: G.test.action().sprinting }; }, p0);
  await touch("touchMove", [{ x: box.x, y: box.y - 60, id: 11 }]); // to the rim
  const p1 = await page.evaluate(() => ({ ...G.test.state().pos }));
  const run = await page.evaluate((p1) => { step(60); const p = G.test.state().pos; return { d: Math.hypot(p.x - p1.x, p.z - p1.z), sprint: G.test.action().sprinting }; }, p1);
  await touch("touchEnd", []);
  const stop = await page.evaluate(() => { const a = { ...G.test.state().pos }; step(40); const b = G.test.state().pos; return { d: Math.hypot(b.x - a.x, b.z - a.z), ropes: G.test.state().ropes.map((r) => r.state) }; });
  check(walk.d > 1.5 && !walk.sprint, "the stick part way walks the hero (" + walk.d.toFixed(1) + " m in 1 s)", walk);
  check(run.sprint && run.d > walk.d * 1.5, "the stick at the rim sprints (" + run.d.toFixed(1) + " m in 1 s)", run);
  check(stop.d < 1 && stop.ropes.every((s) => s === "idle"), "letting go of the stick stops the hero, and the stick fires no plunger", stop);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/phone-stick.png" });

  /* ---- free look: a drag turns the view, and in the air the view stays put after it ---- */
  const fly = () => page.evaluate(() => { const S = G.city.start; G.test.teleport(S.x, S.y + 60, S.z); G.P.vel.x = -14; G.P.vel.z = 0; G.P.vel.y = 0; G.P.onGround = false; step(2); return G.flatcam.yaw; });
  const y0 = await fly();
  await touch("touchStart", [{ x: 420, y: 200, id: 21 }]);
  for (let k = 1; k <= 10; k++) { await touch("touchMove", [{ x: 420 + k * 25, y: 200, id: 21 }]); await page.evaluate(() => step(1)); }
  await touch("touchEnd", []);
  const look = await page.evaluate(() => { const a = G.flatcam.yaw; step(90); const b = G.flatcam.yaw; return { a, b, ropes: G.test.state().ropes.map((r) => r.state) }; });
  const turned = Math.abs(Math.atan2(Math.sin(look.a - y0), Math.cos(look.a - y0)));
  const drift = Math.abs(Math.atan2(Math.sin(look.b - look.a), Math.cos(look.b - look.a)));
  check(turned > 0.5 && look.ropes.every((s) => s === "idle"), "a drag turns the view (" + turned.toFixed(2) + " rad) and throws nothing", look);
  check(drift < 0.1, "in the air the view stays where the drag left it for 1.5 s (drift " + drift.toFixed(3) + " rad)", look);

  /* ---- two thumbs ---- */
  const pairRun = async (overlap) => {
    // 30 m over the start roof, falling slowly: buildings in reach on both sides
    const f0 = await page.evaluate(() => { const S = G.city.start; G.test.teleport(S.x, S.y + 30, S.z); G.rigYaw = S.yaw; G.flatcam.reset(S.yaw); G.P.vel.x = G.P.vel.z = 0; G.P.vel.y = -3; G.P.onGround = false; step(3); return G.frame; });
    if (overlap) {
      // both fingers down, the left lifts, the right lifts 0.5 s later
      await touch("touchStart", [{ x: 200, y: 180, id: 31 }]);
      await touch("touchStart", [{ x: 200, y: 180, id: 31 }, { x: 640, y: 180, id: 32 }]);
      await touch("touchEnd", [{ x: 640, y: 180, id: 32 }]);
      await page.evaluate(() => step(30));
      await touch("touchEnd", []);
    } else {
      await touch("touchStart", [{ x: 200, y: 180, id: 33 }]); await touch("touchEnd", []);
      await page.evaluate(() => step(30));
      await touch("touchStart", [{ x: 640, y: 180, id: 34 }]); await touch("touchEnd", []);
    }
    // a handover lets the first plunger go 0.12 s after the second catches (a rope that lets go by itself at the end of its arc is
    // not a handover)
    return page.evaluate((f0) => { step(40); const ev = G.test.events().filter((e) => e.frame >= f0).map((e) => e.type); return { ev: ev.filter((t) => t !== "input"), fires: ev.filter((t) => t === "fire").length, attach: ev.filter((t) => t === "attach").length, handoff: ev.includes("handoff") }; }, f0);
  };
  const pair = await pairRun(true);
  check(pair.fires === 2 && pair.attach === 2 && !pair.handoff, "two fingers down together throw a pair: both plungers catch and neither hands over, though one lifts 0.5 s later", pair);
  const hand = await pairRun(false);
  check(hand.fires === 2 && hand.handoff, "two taps that do not overlap hand the swing over", hand);

  check(page.errors.length === 0, "no page errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the phone-move check threw", e.stack || String(e)); }
await close();
done();
