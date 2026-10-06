// The phone panel in Node (task B1 of openspec/changes/swing-controls): the VIEW edge, the lock-on ring and its arrow, the safe
// window, the classes on SWING and on the panel, the vibration, the catch pop, Center with motion aim, use(false) and the stub of a
// device with no touch point. The DOM is a small fake, so this needs no browser. mobile.test.mjs keeps the old checks on a poorer fake.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/mobile-panel.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------- a small fake DOM ---------------- */
const ZERO = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
class ClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  toggle(c, on) { const want = on === undefined ? !this.set.has(c) : !!on; if (want) this.set.add(c); else this.set.delete(c); return want; }
  contains(c) { return this.set.has(c); }
}
class El extends EventTarget {
  constructor() { super(); this.nodes = new Map(); this.classList = new ClassList(); this.attrs = {}; this.style = {}; this.hidden = false; this.rect = ZERO; this.textContent = ""; this.reads = 0; }
  querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new El()); return this.nodes.get(s); }
  querySelectorAll() { return []; }
  setPointerCapture() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  getBoundingClientRect() { this.reads++; return this.hidden ? ZERO : this.rect; }
}
const box = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
const win = new EventTarget(), doc = new EventTarget(), hud = new Map();
let panel, now = 0, active = true;
doc.createElement = () => (panel = new El());
doc.body = { append() {} };
doc.querySelector = (sel) => hud.get(sel) || null;
doc.hidden = false;
let touch = true, vibrated = [];
const setTouch = (on) => { touch = on; };
Object.assign(globalThis, { window: win, document: doc, matchMedia: () => ({ matches: touch }), addEventListener: win.addEventListener.bind(win), screen: { orientation: new EventTarget() } });
Object.defineProperty(globalThis, "navigator", { get: () => ({ maxTouchPoints: touch ? 1 : 0, vibrate: navigator_vibrate }), configurable: true });
let navigator_vibrate = (ms) => { vibrated.push([now, ms]); return true; };
Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true });
win.DeviceOrientationEvent = { requestPermission: async () => "granted" };
win.DeviceMotionEvent = { requestPermission: async () => "granted" };
const src = (await readFile(new URL("../../public/vr/js/mobile.js", import.meta.url), "utf8")).replace("'three'", JSON.stringify(new URL("../../public/vr/lib/three.module.min.js", import.meta.url).href));
const { createMobile } = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

const canvas = new El();
canvas.rect = box(0, 0, 400, 800);
const send = (target, type, data = {}) => { const ev = new Event(type); Object.assign(ev, data); target.dispatchEvent(ev); };
const m = createMobile(canvas, () => active);
const el = (sel) => panel.querySelector(sel);
const btn = (name) => el(`[data-action="${name}"]`);
const ring = el(".phone-target"), arrow = el(".pt-arrow"), safe = el(".phone-safe"), swing = btn("throw");
const centre = (r) => { const t = /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(r.style.transform || ""); return t ? { x: +t[1] + 28, y: +t[2] + 28 } : null; };
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} is not within ${tol} of ${b}`);

/* ---------------- the VIEW button: an edge of one sample ---------------- */
await m.start();
m.sample(0.016);
assert(btn("view") && typeof btn("view").onclick === "function", "the panel has a VIEW button");
assert.equal(m.sample(0.016).view, false, "no VIEW press, no view edge");
btn("view").onclick();
assert.equal(m.sample(0.016).view, true, "a VIEW press shows in the next sample");
assert.equal(m.sample(0.016).view, false, "the view edge lasts one sample");
active = false; btn("view").onclick(); active = true;
assert.equal(m.sample(0.016).view, false, "a VIEW press while the panel is hidden does nothing");
btn("view").onclick(); m.reset();
assert.equal(m.sample(0.016).view, false, "reset clears a view edge");

/* ---------------- Center shows only while motion aim is on ---------------- */
assert.equal(btn("center").hidden, false, "motion aim is on after PLAY, so Center shows (sensors granted)");
btn("motion").onclick();
assert.equal(btn("center").hidden, true, "Center hides when motion aim goes off");
assert.equal(btn("motion").attrs["aria-pressed"], "false");
btn("motion").onclick(); await new Promise((r) => setTimeout(r, 0));
assert.equal(btn("center").hidden, false, "Center shows again when motion aim comes back");
assert.equal(btn("motion").attrs["aria-pressed"], "true");
btn("center").onclick();
const said = el(".phone-hint").textContent;
assert(/yellow/i.test(said) && !/green/i.test(said), "the hint after Center names the yellow ring: " + said);
win.DeviceOrientationEvent.requestPermission = async () => "denied"; win.DeviceMotionEvent.requestPermission = async () => "denied";
btn("motion").onclick(); btn("motion").onclick(); await new Promise((r) => setTimeout(r, 0));
assert.equal(btn("center").hidden, true, "Center stays hidden when the sensors are denied");
win.DeviceOrientationEvent.requestPermission = async () => "granted"; win.DeviceMotionEvent.requestPermission = async () => "granted";
await m.start();

/* ---------------- the safe window and the ring ---------------- */
// a portrait phone, 400 by 800: the frame, the top buttons, the pills, a spoken line, the SWING panel
const frame = (l, t, r, b) => { safe.rect = box(l, t, r, b); };
const place = (sel, l, t, r, b, on) => { const e = hud.get(sel) || new El(); e.rect = box(l, t, r, b); e.hidden = false; if (on) e.classList.add("on"); hud.set(sel, e); return e; };
frame(8, 8, 392, 792);
el(".phone-top").rect = box(0, 0, 400, 58);
el(".phone-bottom").rect = box(16, 640, 384, 780);
const pad = el(".phone-climb"); pad.hidden = true;
place(".fs-top", 50, 74, 350, 114);
const sub = place(".fs-sub", 40, 560, 360, 600, true);
place(".fs-toast", 100, 500, 300, 540, false);
let w = { ...m.safe() };
assert.deepEqual(w, { l: 8, t: 126, r: 392, b: 552 }, "the window sits below the pills (118 + 8) and above the spoken line (560 - 8)");
assert(!(w.t < 58 + 4 + 8), "and below the top buttons");

m.marker({ x: 0.2, y: 0.3, kind: "swing", dist: 40 });
let c = centre(ring);
near(c.x, 240, 0.25, "the ring is on the target in x"); near(c.y, 280, 0.25, "the ring is on the target in y");
assert.equal(ring.hidden, false, "the ring shows");
assert.equal(ring.classList.contains("arrow"), false, "a target inside the window gets the ring, not the arrow");
assert.equal(ring.attrs["data-kind"], "swing");
assert.equal(panel.classList.contains("target-ready"), true, "the panel has the class target-ready");
assert.equal(swing.classList.contains("no-target"), false, "SWING is not dimmed");

// the ring follows a moving target and does not write when nothing moves
m.marker({ x: -0.5, y: 0.1, kind: "clog", dist: 30 });
c = centre(ring);
near(c.x, 100, 0.25, "the ring moves with the target"); near(c.y, 360, 0.25, "the ring moves with the target in y");
assert.equal(ring.attrs["data-kind"], "clog", "a clog gets the clog kind (green with points in the CSS)");
const before = ring.style.transform;
m.marker({ x: -0.5, y: 0.1, kind: "clog", dist: 30 });
assert.equal(ring.style.transform, before, "the same target writes the same transform");

// a target above the screen: the arrow, on the top border of the centre window (window top + 28), pointing up
m.marker({ x: 0.1, y: 1.4, kind: "ring", dist: 60 });
c = centre(ring);
assert.equal(ring.classList.contains("arrow"), true, "a target above the screen gets the arrow");
near(c.y, 126 + 28, 0.25, "the arrow sits on the top border of the window");
assert(c.x >= 8 + 28 && c.x <= 392 - 28, "the arrow stays inside the window sideways");
assert(/rotate\((-?\d+)deg\)/.test(arrow.style.transform), "the arrow turns toward the target");
const deg = +/rotate\((-?\d+)deg\)/.exec(arrow.style.transform)[1];
assert(Math.abs(deg) < 15, "a target almost straight above gives an arrow that points almost up: " + deg);
assert.equal(ring.attrs["data-kind"], "ring");

// a target far to the right and low: the arrow sits on the right or the bottom border, and points that way
m.marker({ x: 1.6, y: -0.2, kind: "swing", dist: 50 });
c = centre(ring);
assert.equal(ring.classList.contains("arrow"), true);
near(c.x, 392 - 28, 0.25, "the arrow sits on the right border");
const d2 = +/rotate\((-?\d+)deg\)/.exec(arrow.style.transform)[1];
assert(d2 > 45 && d2 < 135, "and it points right: " + d2);

// behind the camera: the arrow sits on the bottom border, on the target's side, and points down
m.marker({ x: -1, y: -1.5, kind: "swing", dist: 20, behind: true });
c = centre(ring);
assert.equal(ring.classList.contains("arrow"), true);
near(c.y, 552 - 28, 0.25, "a target behind the camera: the arrow sits on the bottom border");
assert(c.x < 200, "on the left side when the target is on the left: " + c.x);
assert.equal(arrow.style.transform, "rotate(180deg)", "and it points down");
m.marker({ x: 1, y: -1.5, kind: "swing", dist: 20, behind: true });
assert(centre(ring).x > 200, "on the right side when the target is on the right");

// back to the ring after an arrow
m.marker({ x: 0, y: 0.2, kind: "swing", dist: 40 });
assert.equal(ring.classList.contains("arrow"), false, "the ring comes back");

// no target: the ring hides, SWING dims, the panel loses target-ready
m.marker(null);
assert.equal(ring.hidden, true, "marker(null) hides the ring");
assert.equal(swing.classList.contains("no-target"), true, "marker(null) dims SWING");
assert.equal(panel.classList.contains("target-ready"), false, "marker(null) clears target-ready");
m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(ring.hidden, false, "the ring shows again");
assert.equal(swing.classList.contains("no-target"), false, "SWING wakes again");
m.marker({ x: NaN, y: 0 });
assert.equal(ring.hidden, true, "a target with no position hides the ring");
m.marker(undefined);
assert.equal(ring.hidden, true);

// the boxes are read at most 10 times a second, and at once on a resize
m.marker({ x: 0, y: 0.2, kind: "swing" });
const reads0 = safe.reads;
for (let i = 0; i < 60; i++) { now += 16; m.marker({ x: 0, y: 0.2 + i * 0.001, kind: "swing" }); }
const readsPerSecond = (safe.reads - reads0) / (60 * 16 / 1000);
assert(readsPerSecond <= 10.5, "the HUD boxes are read at most 10 times a second: " + readsPerSecond);
const r1 = safe.reads; send(win, "resize"); m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(safe.reads, r1 + 1, "a resize reads the boxes at once");
// a spoken line that arrives is cut out of the window, and one that fades out is not
sub.classList.remove("on"); send(win, "resize"); m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(m.safe().b, 640 - 8, "a line that is not showing does not cut the window: the SWING panel does (640 - 8)");
sub.classList.add("on");
// a toast that is showing is cut out too (its box plus 4 px of shadow), and one that is not showing is not
const toast = hud.get(".fs-toast");
assert.equal(toast.classList.contains("on"), false, "the toast starts hidden");
send(win, "resize"); m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(m.safe().b, 560 - 8, "a toast that is not showing does not cut the window: the spoken line does (560 - 8)");
toast.classList.add("on"); send(win, "resize"); m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(m.safe().b, 500 - 8, "a toast with the class on cuts the window above it (500 - 8)");
for (const ny of [0.3, 0.5, 0.9]) { m.marker({ x: 0, y: ny, kind: "swing" }); const q = centre(ring); assert(q.y + 28 <= 500 - 8 + 0.01, `the ring for NDC y ${ny} stays above the showing toast: ` + q.y); }
toast.classList.remove("on"); send(win, "resize"); m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(m.safe().b, 560 - 8, "and the toast no longer cuts the window once it fades");

// a landscape phone, 844 by 390: the spoken line is high, the SWING panel is in the right corner, the climb pad shows on the left
canvas.rect = box(0, 0, 844, 390);
frame(8, 8, 836, 382);
el(".phone-top").rect = box(0, 0, 844, 58);
el(".phone-bottom").rect = box(568, 254, 828, 378);
pad.hidden = false; pad.rect = box(16, 170, 184, 378);
place(".fs-top", 225, 74, 619, 119);
sub.rect = box(258, 118, 586, 159);
w = { ...m.safe() };
assert(w.l >= 184 + 8 && w.r <= 568 - 8 && w.t >= 159 + 27 + 8 && w.b <= 382, "landscape: the window clears the pad, the SWING panel and the spoken line with its tail: " + JSON.stringify(w));
assert(w.b - w.t >= 0.45 * 390, "landscape: the window is at least 45 percent of the height: " + (w.b - w.t) / 390);
const boxes = [el(".phone-top").rect, hud.get(".fs-top").rect, sub.rect, el(".phone-bottom").rect, pad.rect];
for (const o of boxes) assert(w.r <= o.left || w.l >= o.right || w.b <= o.top || w.t >= o.bottom, "the window overlaps no HUD box: " + JSON.stringify(o));
for (const ny of [0.3, 0.6, 0.9, 1.2, 1.5]) for (const nx of [-1.5, -0.8, 0, 0.8, 1.5]) {
  m.marker({ x: nx, y: ny, kind: "swing" });
  const q = centre(ring), half = 28;
  assert(q.x - half >= w.l - 0.01 && q.x + half <= w.r + 0.01 && q.y - half >= w.t - 0.01 && q.y + half <= w.b + 0.01, `landscape: the ring or arrow for NDC (${nx}, ${ny}) sits inside the window: ` + JSON.stringify(q));
}
pad.hidden = true;
canvas.rect = box(0, 0, 400, 800);

/* ---------------- the catch pop ---------------- */
now = 1000;
m.marker({ x: 0, y: 0.2, kind: "swing" });
m.pop();
assert.equal(ring.classList.contains("pop"), true, "pop sets its class");
now = 1119; m.sample(0.016);
assert.equal(ring.classList.contains("pop"), true, "the pop lasts 120 ms");
now = 1121; m.sample(0.016);
assert.equal(ring.classList.contains("pop"), false, "and clears its class");

/* ---------------- vibration ---------------- */
vibrated = []; now = 5000;
m.buzz(15);
assert.deepEqual(vibrated, [[5000, 15]], "buzz calls navigator.vibrate");
now = 5039; m.buzz(25);
assert.equal(vibrated.length, 1, "no second buzz within 40 ms");
now = 5041; m.buzz(25);
assert.deepEqual(vibrated[1], [5041, 25], "a buzz 41 ms later goes through");
now = 5100; doc.hidden = true; m.buzz(40);
assert.equal(vibrated.length, 2, "no buzz while the page is hidden");
doc.hidden = false;
m.buzz(0); m.buzz(NaN); m.buzz(-5);
assert.equal(vibrated.length, 2, "no buzz for no duration");
const keep = navigator_vibrate; navigator_vibrate = undefined;
now = 6000; m.buzz(15); m.pop();
assert.equal(ring.classList.contains("pop"), true, "with no vibrate (an iPhone) buzz does not throw and the pop still shows");
navigator_vibrate = () => { throw new Error("refused"); };
now = 7000; m.buzz(15);
navigator_vibrate = keep;

/* ---------------- the dead-latch safety stays in target() ---------------- */
active = true; m.reset(); btn("throw").onclick();
m.sample(0.016);
win.G = { P: { dead: { why: "test" } } };
m.target(false, false);
assert.equal(m.sample(0.016).hold, false, "a dead player with no rope leaves no latched button");
delete win.G;
assert.equal(typeof m.target(true, true), "undefined", "target() returns nothing");

/* ---------------- use(false): the player chose the mouse and keyboard ---------------- */
m.marker({ x: 0, y: 0.2, kind: "swing" });
assert.equal(m.enabled, true, "a touch device starts on the touch scheme");
m.use(false);
assert.equal(m.enabled, false, "use(false) turns the touch scheme off");
m.sample(0.016);
assert.equal(panel.hidden, true, "and hides the panel");
assert.equal(ring.hidden, true, "and the ring");
send(canvas, "pointerdown", { pointerId: 1, clientX: 300, clientY: 200, preventDefault() {} }); send(canvas, "pointerup", { pointerId: 1, clientX: 300, clientY: 200 });
const off = m.sample(0.016);
assert(!off.fire && !off.hold && off.aim === null, "a click on the canvas starts no touch swing");
// the buzz gap (40 ms) and the pop clock are long over, so only the touch scheme being off can stop them
now = 8000; vibrated = []; ring.classList.remove("pop");
m.marker({ x: 0, y: 0.2, kind: "swing" }); m.pop(); m.buzz(15);
assert.equal(ring.hidden, true, "marker does nothing while the touch scheme is off");
assert.equal(ring.classList.contains("pop"), false, "pop adds no class while the touch scheme is off");
assert.deepEqual(vibrated, [], "buzz does not vibrate while the touch scheme is off");
await m.start();
assert.equal(btn("center").hidden, true, "start() asks for no sensors while the touch scheme is off");
m.use(true);
assert.equal(m.enabled, true, "use(true) brings it back");
m.sample(0.016);
assert.equal(panel.hidden, false, "and shows the panel");
// the same calls work again, so the checks above were about the scheme and not about the clocks
now = 9000; m.marker({ x: 0, y: 0.2, kind: "swing" }); m.pop(); m.buzz(15);
assert.equal(ring.hidden, false, "marker shows the ring again after use(true)");
assert.equal(ring.classList.contains("pop"), true, "pop adds its class again after use(true)");
assert.deepEqual(vibrated, [[9000, 15]], "buzz vibrates again after use(true)");

/* ---------------- the wall line goes when the hero leaves the wall ---------------- */
// climbing(true) says how to climb. When the hero leaves the wall (JUMP, over the top, down to the street) the line of before comes
// back, and with motion aim on that is the motion line. A tap that swung the hero off has said "Swinging" first: that line stays.
// While the hero holds the wall the wall line stays against a Motion press, a Center press and a tap that finds nothing.
const said2 = () => el(".phone-hint").textContent;
win.DeviceOrientationEvent.requestPermission = async () => "denied"; win.DeviceMotionEvent.requestPermission = async () => "denied";
m.reset(); await m.start();
const resting = said2();
assert(/^Tap a building to swing\. Keep tapping/.test(resting), "with motion aim off the resting hint says to tap a building: " + resting);
m.climbing(true);
assert(/^On the wall/.test(said2()), "on a wall the hint says how to climb: " + said2());
m.climbing(false);
assert.equal(said2(), resting, "off the wall the hint goes back to the resting line");
m.climbing(true); btn("throw").onclick(); m.climbing(false);
assert(/^Swinging/.test(said2()), "a tap that swung the hero off the wall keeps the swing line: " + said2());
win.DeviceOrientationEvent.requestPermission = async () => "granted"; win.DeviceMotionEvent.requestPermission = async () => "granted";
m.reset(); await m.start();
const motion = said2();
assert(/^Point the phone/.test(motion), "with motion aim on the resting hint says to point the phone: " + motion);
m.climbing(true); m.climbing(false);
assert.equal(said2(), motion, "with motion aim on the hint goes back to the motion line off the wall");
// On the wall a line that does not come from the wall must not hide the wall line: a tap that finds nothing, a Center press and
// a Motion press. Off the wall the same calls speak as before. Motion aim is on here, and the Motion press turns it off.
m.climbing(true); btn("throw").onclick(); m.miss();
assert(/^On the wall/.test(said2()), "a tap that finds nothing on the wall keeps the wall line: " + said2());
btn("center").onclick();
assert(/^On the wall/.test(said2()), "a Center press on the wall keeps the wall line: " + said2());
btn("motion").onclick();
assert(/^On the wall/.test(said2()), "a Motion press on the wall keeps the wall line: " + said2());
m.climbing(false);
assert.equal(said2(), resting, "after Motion went off on the wall the hint goes back to the tap line");
m.miss(); assert(/^Nothing in reach/.test(said2()), "off the wall a tap that finds nothing says so: " + said2());
btn("center").onclick(); assert(/yellow/i.test(said2()), "off the wall a Center press names the yellow ring: " + said2());
m.reset();

/* ---------------- the stub of a device with no touch point ---------------- */
setTouch(false);
const stub = createMobile(canvas, () => true);
assert.equal(stub.enabled, false, "no touch point: the stub is not enabled");
for (const call of [() => stub.marker({ x: 0, y: 0, kind: "swing" }), () => stub.marker(null), () => stub.pop(), () => stub.buzz(15), () => stub.use(false), () => stub.use(true), () => stub.reset(), () => stub.miss(true), () => stub.target(true, true), () => stub.released(), () => stub.rush(0.5, 0.016), () => stub.climbing(true), () => stub.idle()]) assert.doesNotThrow(call);
await stub.start();
assert.equal(stub.enabled, false, "use(true) does not enable the stub");
const s = stub.sample(0.016);
assert.equal(s.view, false, "the stub's sample has a view field");
assert.equal(stub.safe(), null, "the stub has no window");
setTouch(true);

console.log("PASS: mobile panel: view edge, Center with motion aim, safe window, ring and arrow (up, side, behind), hide and dim, class names, box reads at 10 Hz, pop, vibration, dead-latch safety, use(false), the hint off the wall, stub");
