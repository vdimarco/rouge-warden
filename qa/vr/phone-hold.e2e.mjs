// The phone's three gestures with real touch events (Chrome DevTools touch input): a tap throws and its rope lets go by itself;
// a finger held still throws while it is still down, its rope holds past the bottom of the arc while the finger stays, and the lift
// lets go with a fling; a drag looks and throws nothing. A ring shows under each finger, and the gesture card shows until the first
// touch. The press times are real time (the browser's event clock), so the test waits in real time where a finger must be held.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/phone-hold.e2e.mjs
import { mkdir } from "node:fs/promises";
import { newPage, open, close, checker, watchdog, SHOTS } from "./lib.mjs";

const { check, done } = checker("phone-hold");
watchdog(600000, "phone-hold");
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
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); window.step = (n) => G.test.step(1 / 60, n); step(2); });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });

  /* ---- the gesture card ---- */
  const card = await page.evaluate(() => ({ shown: G.desktop.mobile.coach(), text: document.querySelector(".phone-coach").textContent, seen: G.save.seen.phoneCoach }));
  check(card.shown && /TAP/.test(card.text) && /HOLD/.test(card.text) && /DRAG/.test(card.text) && !card.seen, "phone play opens with the gesture card: TAP, HOLD, DRAG", card);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/phone-coach.png" });

  // 30 m over the start roof, falling slowly, facing the city: buildings in reach ahead
  const fly = () => page.evaluate(() => {
    const S = G.city.start;
    for (const r of [0, 1]) if (G.P.ropes[r].state !== "idle") G.test.release?.(r);
    G.test.teleport(S.x, S.y + 30, S.z); G.rigYaw = S.yaw; G.flatcam.reset(S.yaw);
    G.P.vel.x = G.P.vel.z = 0; G.P.vel.y = -3; G.P.onGround = false; step(3); return G.frame;
  });
  const events = (f0) => page.evaluate((f0) => G.test.events().filter((e) => e.frame >= f0 && e.type !== "input").map((e) => e.type), f0);
  const ropes = () => page.evaluate(() => G.test.state().ropes.map((r) => r.state));

  /* ---- a tap: the rope lets go by itself ---- */
  let f0 = await fly();
  await touch("touchStart", [{ x: 640, y: 170, id: 1 }]); await touch("touchEnd", []);
  const after = await page.evaluate(() => G.desktop.mobile.coach());
  check(!after, "the first touch on the city puts the card away", after);
  // up to 8 s: a swing slowed by a bump takes longer to reach the far side of its arc
  await page.evaluate(() => { step(12); for (let k = 0; k < 40 && G.P.ropes[1].state !== "idle"; k++) step(12); });
  const tapEv = await events(f0);
  check(tapEv.includes("fire") && tapEv.includes("attach") && tapEv.includes("fling"), "a tap throws, catches, and its rope lets go by itself with a fling", tapEv);

  /* ---- a hold: the rope stays while the finger does, and the lift lets go ---- */
  f0 = await fly();
  await touch("touchStart", [{ x: 640, y: 170, id: 2 }]);
  const before = await page.evaluate(() => { step(1); return { ev: G.test.events().filter((e) => e.type === "fire").length }; });
  await page.waitForTimeout(200); // still for more than 0.12 s: it throws while down
  const thrown = await page.evaluate(() => { step(1); return { dots: G.desktop.mobile.dots(), hint: document.querySelector(".phone-hint").textContent }; });
  await page.evaluate(() => step(20));
  const ev1 = await events(f0);
  check(ev1.includes("fire") && thrown.dots.length === 1 && thrown.dots[0].mode === "rope" && thrown.dots[0].side === "1", "a finger held still throws while it is down, with a yellow R ring under it", { ev1, thrown, before });
  await page.waitForTimeout(250); // past 0.35 s: a hold
  await page.evaluate(() => step(220)); // 3.7 s of swinging: a tap's rope would have let go by now
  const mid = await page.evaluate(() => ({ ropes: G.test.state().ropes.map((r) => r.state), hint: document.querySelector(".phone-hint").textContent, held: G.input.phoneHeld }));
  const ev2 = await events(f0);
  check(mid.ropes[1] === "attached" && !ev2.includes("fling") && mid.held[1], "while the finger stays down the rope holds past the bottom of the arc", { mid, ev2 });
  check(/Lift your thumb/.test(mid.hint), "the hint says to lift the thumb to let go: " + mid.hint, mid);
  await page.evaluate(() => G.test.render());
  await page.screenshot({ path: out + "/phone-hold.png" });
  const f1 = await page.evaluate(() => G.frame);
  await touch("touchEnd", []);
  await page.evaluate(() => step(3));
  const ev3 = await events(f1), r3 = await ropes();
  check(ev3.includes("letgo") && r3[1] === "idle", "the lift lets go of the rope", { ev3, r3 });
  check(ev3.includes("fling"), "the lift in the air flings the hero on", ev3);

  /* ---- a drag: it looks and throws nothing ---- */
  f0 = await fly();
  const y0 = await page.evaluate(() => G.flatcam.yaw);
  await touch("touchStart", [{ x: 600, y: 200, id: 3 }]);
  for (let k = 1; k <= 8; k++) await touch("touchMove", [{ x: 600 - k * 25, y: 200, id: 3 }]);
  const dragDot = await page.evaluate(() => { step(1); return G.desktop.mobile.dots(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => step(10));
  await touch("touchEnd", []);
  const drag = await page.evaluate((y0) => { step(5); return { turn: Math.abs(Math.atan2(Math.sin(G.flatcam.yaw - y0), Math.cos(G.flatcam.yaw - y0))) }; }, y0);
  const ev4 = await events(f0);
  check(drag.turn > 0.3 && !ev4.includes("fire") && dragDot.length === 1 && dragDot[0].mode === "look", "a drag turns the view with a blue LOOK ring and throws nothing, however long it stays down", { drag, ev4, dragDot });

  /* ---- the card stays away once seen ---- */
  const seen = await page.evaluate(() => G.save.seen.phoneCoach);
  check(seen === true, "the save remembers the card was seen", seen);
  check(page.errors.length === 0, "no page errors", page.errors);
  await page.context().close();
} catch (e) { check(false, "the phone-hold check threw", e.stack || String(e)); }
await close();
done();
