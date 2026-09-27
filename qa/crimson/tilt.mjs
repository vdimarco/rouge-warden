// Tilt look on a phone (844x390, touch), with deviceorientation events made in the page:
// 1. TILT shows in free roam, off by default; tilting does nothing while it is off.
// 2. A tap turns it on (remembered in localStorage); turning the phone (alpha) turns the camera the same
//    way, and tilting it back (beta) tilts the view; the lock flick never fires from tilt alone.
// 3. A double tap recentres: the pitch clamp starts again from the new pose, and tilt stays on.
// 4. Landscape: with the screen at 90 and at 270 degrees, the screen's top edge going back looks down in
//    both (opposite gamma changes) and moves no yaw; alpha still turns the view the same way.
// 5. Nothing goes out in the menu; the touch drag still turns the camera with tilt on.
// 6. One tap turns it off and tilting stops; iOS: a denied permission turns it back off with a message.
// 7. A desktop (no touch points) never shows TILT, even with the touch class, and never listens.
// No page errors.
import { open, step, stepUntil, finish, freeRoam, storyReady } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const W = 844, H = 390;
// the screen angle is the test's to set (window.__qaAngle)
const before = (page) => page.addInitScript(() => {
  window.__qaAngle = 0;
  try { if (screen.orientation) Object.defineProperty(screen.orientation, "angle", { get: () => window.__qaAngle, configurable: true }); } catch (e) { /* none */ }
  try { Object.defineProperty(window, "orientation", { get: () => window.__qaAngle, configurable: true }); } catch (e) { /* none */ }
});
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: W, height: H, touch: true, before });
const cdp = await page.context().newCDPSession(page);
const T = (fn, arg) => page.evaluate(fn, arg);
const touchPts = (pts) => pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 }));
const tap = async (x, y) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPts([[x, y]]) }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
const center = (sel) => T((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const orient = (a, b, g) => T(([a, b, g]) => { window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: a, beta: b, gamma: g, absolute: false })); }, [a, b, g]);
const cam = () => T(() => { const c = __crimson.story.S.test.combat.cam; return { yaw: c.yaw, pitch: c.pitch }; });
const tilt = () => T(() => __crimson.story.S.test.ui.pieces.touch.tilt.state);
const btnOn = () => T(() => { const e = document.getElementById("st_tilt"); return { shown: __crimson.story.S.test.ui.visible("st_tilt"), on: e.classList.contains("on") }; });
const stored = () => T(() => { try { return localStorage.getItem("crimson.tilt"); } catch (e) { return "blocked"; } });
const angle = (a) => T((a) => { window.__qaAngle = a; }, a);
const wrapd = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// set a pose and let it settle (the low-pass is 50 ms)
const pose = async (a, b, g, sec = 0.4) => { await orient(a, b, g); await step(page, sec); };

check((await storyReady(page)).ok, "the story is ready");
const r = await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
check(r.ok, "the story reaches f1 on a phone");
check((await freeRoam(page)).ok, "free roam: nothing modal");
await step(page, 0.3);

/* ---------------- 1: off by default ---------------- */
let b = await btnOn();
check(b.shown && !b.on, `TILT shows and is off (${JSON.stringify(b)})`);
check((await stored()) === null && !(await tilt()).on && !(await tilt()).listening, "off by default: nothing stored, not listening");
check(!(await T(() => __crimson.story.S.test.ui.touchButtons)).includes("tilt"), "TILT is not an action button (the 7-button rule is untouched)");
let c0 = await cam();
await pose(0, 60, 0); await pose(30, 60, 0);
let c1 = await cam();
check(Math.abs(wrapd(c1.yaw - c0.yaw)) < 0.01, `off: turning the phone does nothing (${(c1.yaw - c0.yaw).toFixed(3)} rad)`);

/* ---------------- 2: on; alpha turns, beta tilts ---------------- */
const [tx, ty] = await center("#st_tilt");
await tap(tx, ty); await step(page, 0.5);
b = await btnOn();
check(b.on && (await tilt()).on && (await tilt()).listening, "a tap turns it on");
check((await stored()) === "on", "the choice is stored");
await pose(0, 60, 0);
c0 = await cam();
await T(() => { window.__flick = 0; const K = __crimson.story.S.test.combat; window.__lockCycle = K.cam.rsHeld; });
await pose(20, 60, 0, 0.6);
c1 = await cam();
const dyaw = wrapd(c1.yaw - c0.yaw);
check(dyaw > 0.3 && dyaw < 0.8, `turning the phone left (alpha +20 deg) turns the view left (yaw ${dyaw.toFixed(3)} rad, about 0.52 wanted)`);
await pose(0, 60, 0, 0.6);
const c2 = await cam();
check(Math.abs(wrapd(c2.yaw - c0.yaw)) < 0.06, `and back again (${wrapd(c2.yaw - c0.yaw).toFixed(3)} rad)`);
await pose(0, 50, 0, 0.6);
const p0 = (await cam()).pitch;
await pose(0, 62, 0, 0.6);
const p1 = (await cam()).pitch;
check(p1 < p0 - 0.1, `raising the phone (beta 50 -> 62) tilts the view up (pitch ${p0.toFixed(3)} -> ${p1.toFixed(3)})`);
// tremor under the dead zone moves nothing
let s0 = await tilt();
for (let i = 0; i < 12; i++) await pose(i % 2 ? 0.4 : -0.4, 62 + (i % 2 ? 0.3 : -0.3), 0, 1 / 30);
await step(page, 0.3);
let s1 = await tilt();
check(Math.abs(s1.yaw - s0.yaw) < 0.012 && Math.abs(s1.pitch - s0.pitch) < 0.012, `tremor under the dead zone is ignored (${(s1.yaw - s0.yaw).toFixed(4)}, ${(s1.pitch - s0.pitch).toFixed(4)})`);
// a fast turn with no lock never flicks one; the look rate from tilt alone stays under 0.9
const maxLook = await T(() => {
  const S = __crimson.story.S; let m = 0;
  window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 90, beta: 62, gamma: 0 }));
  for (let i = 0; i < 30; i++) { __crimson.step(1 / 60, false); m = Math.max(m, Math.abs(S.input.axis("look").x)); }
  return m;
});
check(maxLook > 0.5 && maxLook <= 0.851, `a fast turn stays under the lock-flick line (look x peaks at ${maxLook.toFixed(3)})`);
await pose(90, 62, 0, 1.5);

/* ---------------- 3: recentre ---------------- */
await pose(0, 60, 0, 1.2);
s0 = await tilt();
await pose(0, 110, 0, 0.6);
s1 = await tilt();
check(s1.pitch - s0.pitch > 0.55 && s1.pitch - s0.pitch < 0.62, `the pitch offset is clamped (${(s1.pitch - s0.pitch).toFixed(3)} rad for 50 deg)`);
await pose(0, 125, 0, 0.4);
const s2 = await tilt();
check(Math.abs(s2.pitch - s1.pitch) < 0.01, "past the clamp nothing more goes out");
await pose(0, 110, 0, 0.4);
// double tap
const sBefore = await tilt();
await tap(tx, ty); await step(page, 0.1); await tap(tx, ty); await step(page, 0.6);
const sAfter = await tilt();
check(sAfter.on && (await btnOn()).on, "a double tap leaves tilt on");
check(sAfter.ref && sBefore.ref && Math.abs(sAfter.ref.p - sBefore.ref.p) > 0.5, `a double tap takes a new reference pose (ref pitch ${sBefore.ref && sBefore.ref.p.toFixed(2)} -> ${sAfter.ref && sAfter.ref.p.toFixed(2)})`);
check(await T(() => /CENTRED/.test(document.getElementById("sToast").textContent)), "it says TILT CENTRED");
const s3 = await tilt();
await pose(0, 125, 0, 0.6);
const s4 = await tilt();
check(s4.pitch - s3.pitch > 0.2, `after the recentre the same tilt goes out again (${(s4.pitch - s3.pitch).toFixed(3)} rad)`);
check((await stored()) === "on", "still stored on");

/* ---------------- 4: landscape ---------------- */
// the screen's top edge is the device's right edge at 90, its left edge at 270
async function landscape(ang, g0, g1) {
  await angle(ang);
  await pose(0, 0, g0, 0.6);
  const a = await tilt(), ca = await cam();
  await pose(0, 0, g1, 0.6);
  const bb = await tilt();
  await pose(20, 0, g1, 0.6);
  const cc = await tilt(), cb = await cam();
  return { dp: bb.pitch - a.pitch, dy: cc.yaw - bb.yaw, dyTilt: bb.yaw - a.yaw, dcam: wrapd(cb.yaw - ca.yaw) };
}
// held 45 deg back; the top edge goes back by 15 deg
const L90 = await landscape(90, -45, -30);
check(L90.dp < -0.15, `landscape 90: the top edge going back looks down (pitch ${L90.dp.toFixed(3)})`);
check(L90.dy > 0.2 && L90.dcam > 0.2, `landscape 90: alpha +20 turns left (${L90.dy.toFixed(3)}, camera ${L90.dcam.toFixed(3)})`);
const L270 = await landscape(270, 45, 30);
check(L270.dp < -0.15, `landscape 270: the top edge going back looks down (pitch ${L270.dp.toFixed(3)})`);
check(L270.dy > 0.2, `landscape 270: alpha +20 turns left (${L270.dy.toFixed(3)})`);
// a pure tilt of the screen's top edge moves no yaw, in both landscapes; read as portrait (angle 0) the
// same poses would swing the heading, so the screen angle is what makes this right
check(Math.abs(L90.dyTilt) < 0.03 && Math.abs(L270.dyTilt) < 0.03, `landscape: tilting back moves no yaw (${L90.dyTilt.toFixed(3)}, ${L270.dyTilt.toFixed(3)})`);
const Lwrong = await landscape(0, -45, -30);
check(Math.abs(Lwrong.dyTilt) > 0.1, `(read as portrait, the same landscape tilt would swing the yaw by ${Lwrong.dyTilt.toFixed(3)})`);
// portrait: gamma is a roll; it barely moves the pitch
await angle(0); await pose(0, 60, 0, 0.6); const x0 = await tilt(); await pose(0, 60, 15, 0.6); const x1 = await tilt();
check(Math.abs(x1.pitch - x0.pitch) < 0.1, `portrait: gamma (a roll) barely moves the pitch (${(x1.pitch - x0.pitch).toFixed(3)})`);
await pose(0, 60, 0, 0.6);

/* ---------------- 5: the menu, the drag ---------------- */
await T(() => __crimson.story.S.ui.menu.open()); await step(page, 0.2);
const ctlText = await T(() => { document.querySelector('#sMenu [data-a="controls"]').click(); const t = document.querySelector("#sMenu .mBody").textContent; document.querySelector('#sMenu [data-a="back"]').click(); return t; });
check(/Tilt camera/.test(ctlText) && /TILT/.test(ctlText), "the pause menu's CONTROLS has the tilt line");
c0 = await cam();
const look = await T(() => { window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 40, beta: 60, gamma: 0 })); let m = 0; for (let i = 0; i < 30; i++) { __crimson.step(1 / 60, false); m = Math.max(m, Math.abs(__crimson.story.S.input.axis("look").x)); } return m; });
check(look === 0, `in the menu tilt sends no look (the map pans with it) (${look})`);
await T(() => __crimson.story.S.ui.menu.close()); await step(page, 0.4);
c1 = await cam();
check(Math.abs(wrapd(c1.yaw - c0.yaw)) < 0.05, `closing the menu does not jump the view (${wrapd(c1.yaw - c0.yaw).toFixed(3)})`);
const d0 = (await cam()).yaw;
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPts([[620, 200]]) });
for (let k = 1; k <= 6; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPts([[620 - 20 * k, 200]]) });
await step(page, 0.2);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await step(page, 0.2);
const d1 = (await cam()).yaw;
check(Math.abs(wrapd(d1 - d0)) > 0.15, `the touch drag still turns the camera with tilt on (${wrapd(d1 - d0).toFixed(3)})`);

/* ---------------- 6: off; iOS denial ---------------- */
await tap(tx, ty); await step(page, 0.6);
check(!(await tilt()).on && !(await btnOn()).on && !(await tilt()).listening, "one tap turns it off (after the double-tap window)");
check((await stored()) === "off", "off is stored");
c0 = await cam();
await pose(80, 60, 0, 0.6);
c1 = await cam();
check(Math.abs(wrapd(c1.yaw - c0.yaw)) < 0.01, `off: turning the phone does nothing (${wrapd(c1.yaw - c0.yaw).toFixed(3)})`);
await T(() => { window.__asked = 0; DeviceOrientationEvent.requestPermission = () => { window.__asked++; return Promise.resolve("denied"); }; });
await tap(tx, ty); await step(page, 0.1); await page.waitForTimeout(50); await step(page, 0.5);
check((await T(() => window.__asked)) === 1, "iOS: a tap asks for motion access");
check(!(await tilt()).on && !(await btnOn()).on && (await stored()) === "off", "iOS: denied turns TILT back off");
check(await T(() => /MOTION/.test(document.getElementById("sToast").textContent)), "and says why");
await T(() => { DeviceOrientationEvent.requestPermission = () => { window.__asked++; return Promise.resolve("granted"); }; });
await tap(tx, ty); await step(page, 0.1); await page.waitForTimeout(50); await step(page, 0.5);
check((await tilt()).on && (await tilt()).listening, "iOS: granted turns it on");
await tap(tx, ty); await step(page, 0.6);
check(!(await tilt()).on, "and off again");

const phoneErrors = errors.slice();
await browser.close();

/* ---------------- 7: a desktop ---------------- */
{
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 1280, height: 720 });
  const T = (fn, arg) => page.evaluate(fn, arg);
  check((await storyReady(page)).ok, "desktop: the story is ready");
  await stepUntil(page, () => __crimson.story && __crimson.story.chapter === "f1" && __crimson.story.mode === "play" && !__crimson.story.S.test.ui.card, { maxSec: 60 });
  check((await freeRoam(page)).ok, "desktop: free roam");
  await step(page, 0.3);
  check(!(await T(() => __crimson.story.S.test.ui.visible("st_tilt"))), "desktop: no TILT");
  // even with the touch class and a stored ON: no touch points, no tilt
  await T(() => { try { localStorage.setItem("crimson.tilt", "on"); } catch (e) { /* none */ } document.body.classList.add("touch"); });
  await step(page, 0.3);
  const st = await T(() => ({ shown: __crimson.story.S.test.ui.visible("st_tilt"), layer: __crimson.story.S.test.ui.visible("stouch"), supported: __crimson.story.S.test.ui.pieces.touch.tilt.supported }));
  check(st.layer && !st.shown && !st.supported, `desktop with the touch class: the layer shows, TILT does not (${JSON.stringify(st)})`);
  const y0 = await T(() => __crimson.story.S.test.combat.cam.yaw);
  await T(() => { window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: 60, gamma: 0 })); });
  await step(page, 0.3);
  await T(() => { window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 40, beta: 60, gamma: 0 })); });
  await step(page, 0.5);
  const y1 = await T(() => __crimson.story.S.test.combat.cam.yaw);
  const s = await T(() => __crimson.story.S.test.ui.pieces.touch.tilt.state);
  check(!s.listening && Math.abs(y1 - y0) < 0.01, `desktop: never listens, the view does not turn (${(y1 - y0).toFixed(3)})`);
  const ctl = await T(() => { const S = __crimson.story.S; S.ui.menu.open(); document.querySelector('#sMenu [data-a="controls"]').click(); return document.querySelector("#sMenu .mBody").textContent; });
  check(!/Tilt/i.test(ctl), "desktop: CONTROLS has no tilt line");
  await browser.close();
  await finish("tilt", fails, null, [...phoneErrors, ...errors]);
}
