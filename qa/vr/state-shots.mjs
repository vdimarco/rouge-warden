// In Full Swing: the screens of the flat controls, as PNGs to read against the scenarios (task J3 of openspec/changes/swing-controls). The
// states: the start roof (the edge arrow, and the key strip or the phone top row), the lock-on ring on the target, the arrow behind the camera on
// a wall, the LET GO caption (mouse), the green ring on a clog, the dimmed SWING button (phone), and the VIEW button in first person (phone).
// Sizes: 640 by 360, 960 by 540 and 1280 by 720 with a mouse, and 844 by 390, 390 by 844 and 360 by 740 as a touch phone with motion aim on.
// For each state the script checks that the page really shows it (a ring, an arrow, a caption, a class), so a PNG is never of the wrong state.
// It does not judge the layout: qa/vr/layout.e2e.mjs does that, and a person reads the PNGs. The state has to come from play where it can
// (a real swing for the caption, a real clog, a real wall). It is a script and not a mode of layout.e2e.mjs because those states need a swing,
// a clog and a wall, and layout.e2e.mjs has to stay fast.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/state-shots.mjs   (SHOTS=dir sets the folder, SIZE=960x540 runs one size)
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { newPage, open, close, watchdog, checker, sleep } from "./lib.mjs";

watchdog(1500000, "state shots");
const { check, done } = checker("state-shots");
const out = process.env.SHOTS || path.join(os.tmpdir(), "state-shots");
await mkdir(out, { recursive: true });
const SIZES = [[640, 360, false], [960, 540, false], [1280, 720, false], [844, 390, true], [390, 844, true], [360, 740, true]];

// The device as the page sees it (as in layout.e2e.mjs): touch points and sensors on a phone, no audio, no pad, and no pointer lock request.
function device({ touch, fine }) {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
  Object.defineProperty(navigator, "maxTouchPoints", { get: () => (touch ? 5 : 0) });
  Element.prototype.requestPointerLock = function () { return undefined; };
  const listen = window.addEventListener.bind(window);
  window.addEventListener = (type, ...args) => { if (type !== "deviceorientation" && type !== "devicemotion") listen(type, ...args); };
  window.__sensors = "granted";
  window.DeviceOrientationEvent.requestPermission = () => Promise.resolve(window.__sensors);
  window.DeviceMotionEvent.requestPermission = () => Promise.resolve(window.__sensors);
  const real = window.matchMedia.bind(window);
  const fake = { "(any-pointer:fine)": !!fine, "(any-pointer:coarse)": !!touch, "(pointer:coarse)": !!touch && !fine, "(pointer:fine)": !touch || !!fine, "(hover:hover)": !touch || !!fine, "(hover:none)": !!touch && !fine };
  window.matchMedia = (q) => {
    const key = String(q).replace(/\s+/g, "").toLowerCase();
    if (key in fake) return { matches: fake[key], media: String(q), onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
    return real(q);
  };
}

// In the page: helpers for the states (copies of the ones in flat.mjs).
function install() {
  window.__s = {
    step(n) { for (let i = 0; i < n; i++) G.test.step(1 / 60, 1); },
    vis(sel) { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return !e.closest("[hidden]") && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; },
    rect(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; },
    // both ropes idle: the test override says "not pressed" for a few frames, then it goes, so that a real mouse button works again
    release() { for (const i of [0, 1]) { G.test.press(i, false); G.test.aimAt(i, null); } __s.step(4); for (const i of [0, 1]) G.test.press(i, null); },
    // the hero on the start roof, both ropes idle, the camera at the default view
    roof() { const s = G.city.start; __s.release(); G.P.frozen = false; G.test.teleport(s.x, s.y, s.z); G.rigYaw = s.yaw; G.flatcam.setFirstPerson(false); G.flatcam.reset(s.yaw); __s.step(40); },
    // a one-box building with a clear street face (+x), and flying into it: in the air 3 m off the wall at half its height, facing it
    flyIn() {
      const C = G.city;
      const B = C.colliders.find((c) => {
        if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
        if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
        const z = (c.minZ + c.maxZ) / 2;
        for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
        return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
      });
      if (!B) return false;
      const z = (B.minZ + B.maxZ) / 2;
      __s.release();
      G.test.teleport(B.maxX + 3, B.maxY / 2, z); G.rigYaw = Math.PI / 2; G.flatcam.reset(Math.PI / 2); G.P.vel.x = -8; __s.step(30);
      return !!G.P.wall;
    },
    // a spot on the roof of a clog with a clear line from the head to the bowl, and a look at the bowl
    atClog() {
      const S = 1.35, HIT = {};
      for (const c of G.city.clogs) {
        const T = { x: c.x, y: c.y + 1.9 * S, z: c.z };
        for (const r of [6, 8, 10, 13]) for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
          if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
          if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
          const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
          if (G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) continue;
          __s.release(); G.P.frozen = false; G.test.teleport(x, c.y, z);
          const yaw = Math.atan2(-dx, -dz), pitch = Math.asin(dy / d);
          G.rigYaw = yaw; G.flatcam.setFirstPerson(false); G.flatcam.reset(yaw, pitch * 0.6); __s.step(30);
          return { id: c.id, x, y: c.y, z };
        }
      }
      return null;
    },
    // open water 180 m or more from every building, for the hero to hang over (a place where the picker finds nothing)
    water() {
      const C = G.city, bs = C.colliders.filter((c) => c.type === "box");
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const c of bs) { x0 = Math.min(x0, c.minX); x1 = Math.max(x1, c.maxX); z0 = Math.min(z0, c.minZ); z1 = Math.max(z1, c.maxZ); }
      for (let x = x0 - 400; x <= x1 + 400; x += 40) for (let z = z0 - 400; z <= z1 + 400; z += 40) {
        if (!C.isWater(x, z)) continue;
        let d = 1e9;
        for (const c of bs) d = Math.min(d, Math.hypot(Math.max(c.minX - x, 0, x - c.maxX), Math.max(c.minZ - z, 0, z - c.maxZ)));
        if (d >= 180) { __s.release(); G.test.teleport(x, 30, z); G.P.frozen = true; return { x, z, d: Math.round(d) }; }
      }
      return null;
    },
    target() { const t = G.test.target(); return { on: t.on, kind: t.target && t.target.kind, behind: t.behind, ndc: t.ndc, cue: t.cue }; },
  };
}

const settle = async (page) => { await sleep(450); await page.evaluate(() => __s.step(3)); await sleep(80); };
async function shot(page, w, h, name) {
  const file = path.join(out, `${w}x${h}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("INFO: " + file);
}
async function playPage(w, h, touch) {
  const page = await newPage({ width: w, height: h });
  await page.addInitScript(device, { touch, fine: !touch });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone);
  await page.evaluate(install);
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play");
  await page.evaluate(async (touch) => {
    G.test.hold(true);
    if (touch) await G.desktop.mobile.start();
    else G.desktop.locked = true; // the lock that the click of PLAY gets in a real browser
    __s.roof();
  }, touch);
  return page;
}
// Look up in steps until the marker is a ring, with no spoken line (a line under the score row closes the top of the safe window). The
// tutorial can say a line again after a move: the loop waits until the ring shows with no line.
async function liftToRing(page, ringSel) {
  for (const up of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    await page.evaluate(() => { __s.roof(); G.ui.say("", 0); __s.step(3); });
    await sleep(300);
    await page.evaluate((u) => { G.test.look(0, u); __s.step(40); }, up);
    for (let k = 0; k < 4; k++) {
      await sleep(300);
      await page.evaluate(() => __s.step(3));
      const st = await page.evaluate((sel) => ({ ring: __s.vis(sel) && !document.querySelector(sel).classList.contains("arrow"), line: !!document.querySelector(".fs-sub.on") }), ringSel);
      if (st.ring && !st.line) return up;
      if (st.line) await page.evaluate(() => { G.ui.say("", 0); __s.step(3); });
    }
  }
  return null;
}

/* ---------------- a computer with a mouse ---------------- */
async function mouse(w, h) {
  const tag = `${w}x${h}`, page = await playPage(w, h, false);
  // 1. the start roof: the strip, the first tutorial line, the arrow
  await page.evaluate(() => __s.step(60));
  await settle(page);
  let s = await page.evaluate(() => ({ strip: __s.vis("#keyHints"), arrow: __s.vis("#lockArrow"), ring: __s.vis("#lockRing"), line: __s.vis(".fs-sub.on"), t: __s.target() }));
  check(s.strip && s.arrow && !s.ring && s.line && s.t.kind === "ring", `[${tag}] start: the key strip, the tutorial line and the edge arrow show, and the target is the gold ring`, s);
  await shot(page, w, h, "1-start");
  // 2. the lock-on ring on the target
  const up = await liftToRing(page, "#lockRing");
  s = await page.evaluate(() => ({ ring: __s.vis("#lockRing"), arrow: __s.vis("#lockArrow"), t: __s.target(), at: __s.rect("#lockRing"), line: __s.vis(".fs-sub.on") && __s.rect(".fs-sub") }));
  console.log("INFO: " + JSON.stringify(s));
  check(up !== null && s.ring && !s.arrow && !!s.t.kind, `[${tag}] ring: the lock-on ring shows on the target (view lifted ${up} rad)`, s);
  await shot(page, w, h, "2-ring");
  // 3. a wall: the target is behind the camera and the arrow sits on the bottom border
  const held = await page.evaluate(() => __s.flyIn());
  await settle(page);
  s = await page.evaluate(() => ({ wall: !!G.P.wall, arrow: __s.vis("#lockArrow"), at: __s.rect("#lockArrow"), t: __s.target(), H: innerHeight }));
  check(held && s.wall && s.t.behind && s.arrow && s.at.b >= s.H * 0.5, `[${tag}] wall: the hero holds a wall, the target is behind the camera and the arrow is on the bottom half`, s);
  await shot(page, w, h, "3-wall-arrow");
  // 4. the LET GO caption: a real swing from the roof (W and the left button), until the release cue shows
  await page.evaluate(() => { __s.roof(); G.test.look(0, 0.3); __s.step(20); });
  await page.keyboard.down("KeyW");
  await page.mouse.move(w / 2, h / 2);
  await page.mouse.down();
  let cue = null;
  for (let i = 0; i < 80 && !(cue && cue.on); i++) cue = await page.evaluate(() => { __s.step(15); return { on: G.test.target().cue, shown: __s.vis("#lockCue"), text: document.querySelector("#lockCue").textContent }; });
  await page.evaluate(() => __s.step(2));
  await sleep(120);
  cue = await page.evaluate(() => ({ on: G.test.target().cue, shown: __s.vis("#lockCue"), text: document.querySelector("#lockCue").textContent }));
  check(cue.on && cue.shown && cue.text === "LET GO", `[${tag}] cue: the LET GO caption shows during a real swing`, cue);
  await shot(page, w, h, "4-let-go");
  await page.keyboard.up("KeyW"); await page.mouse.up();
  // 5. a clog: the ring is sludge green
  const clog = await page.evaluate(() => __s.atClog());
  await settle(page);
  s = await page.evaluate(() => ({ t: __s.target(), ring: __s.vis("#lockRing"), arrow: __s.vis("#lockArrow"), cls: document.querySelector("#lockRing").className, color: getComputedStyle(document.querySelector("#lockRing")).getPropertyValue("--lock").trim() }));
  check(!!clog && s.t.kind === "clog" && s.ring && /k-clog/.test(s.cls) && s.color === "#9cff3a", `[${tag}] clog: the target is a clog and the lock-on ring is sludge green`, s);
  await shot(page, w, h, "5-clog-ring");
  check(page.errors.length === 0, `[${tag}] no console error or page error`, page.errors.slice(0, 4));
  await page.context().close();
}

/* ---------------- a phone with motion aim ---------------- */
async function phone(w, h) {
  const tag = `${w}x${h}`, page = await playPage(w, h, true);
  // 1. the start roof: the four top buttons, the arrow, SWING
  await page.evaluate(() => __s.step(60));
  await settle(page);
  let s = await page.evaluate(() => ({ top: [...document.querySelectorAll(".phone-top button")].filter((b) => !b.hidden && b.getBoundingClientRect().width > 0).map((b) => b.textContent.trim()), arrow: __s.vis(".phone-target.arrow"), swing: __s.vis("[data-action=throw]"), dim: document.querySelector("[data-action=throw]").classList.contains("no-target"), strip: __s.vis("#keyHints"), t: __s.target() }));
  check(s.top.join() === "Motion,Center,View,Pause" && s.arrow && s.swing && !s.dim && !s.strip && s.t.kind === "ring", `[${tag}] start: the four top buttons (motion aim on), the edge arrow and SWING show, SWING is not dimmed, and no key strip shows`, s);
  await shot(page, w, h, "1-start-top-row");
  // 2. the lock-on ring on the target
  const up = await liftToRing(page, ".phone-target");
  s = await page.evaluate(() => ({ ring: __s.vis(".phone-target") && !document.querySelector(".phone-target").classList.contains("arrow"), kind: document.querySelector(".phone-target").dataset.kind, t: __s.target(), at: __s.rect(".phone-target"), dim: document.querySelector("[data-action=throw]").classList.contains("no-target") }));
  check(up !== null && s.ring && !s.dim && !!s.t.kind, `[${tag}] ring: the lock-on ring shows on the target (view lifted ${up} rad)`, s);
  await shot(page, w, h, "2-ring");
  // 3. a wall: the climb pad, and the arrow on the bottom border
  const held = await page.evaluate(() => __s.flyIn());
  await settle(page);
  s = await page.evaluate(() => ({ wall: !!G.P.wall, arrow: __s.vis(".phone-target.arrow"), at: __s.rect(".phone-target"), pad: __s.vis(".phone-climb"), t: __s.target(), H: innerHeight }));
  check(held && s.wall && s.t.behind && s.arrow && s.pad && s.at.b >= s.H * 0.5, `[${tag}] wall: the hero holds a wall, the climb pad shows and the arrow is on the bottom half`, s);
  await shot(page, w, h, "3-wall-arrow");
  // 4. a clog: the ring is sludge green, with points
  const clog = await page.evaluate(() => __s.atClog());
  await settle(page);
  s = await page.evaluate(() => { const r = document.querySelector(".phone-target"); return { t: __s.target(), ring: __s.vis(".phone-target") && !r.classList.contains("arrow"), kind: r.dataset.kind, color: getComputedStyle(r).color, star: getComputedStyle(r.querySelector(".pt-star")).display }; });
  check(!!clog && s.t.kind === "clog" && s.ring && s.kind === "clog" && s.color === "rgb(156, 255, 58)" && s.star !== "none", `[${tag}] clog: the target is a clog and the ring is sludge green with points`, s);
  await shot(page, w, h, "4-clog-ring");
  // 5. no target: SWING is dimmed and still works. A place where the picker finds nothing is looked for in play (looking down at the roof, then
  // away from the city). With none, the state is the marker taken away, as the page draws it with no target.
  const found = await page.evaluate(() => {
    const none = () => { __s.step(30); return G.test.target().on && !G.test.target().target; };
    __s.roof(); G.test.look(0, -1.4); if (none()) return "looking down at the start roof";
    __s.roof(); G.test.look(Math.PI, -0.3); if (none()) return "looking away from the city";
    const w = __s.water(); if (w && none()) return "hanging over open water " + w.d + " m from every building";
    return null;
  });
  if (!found) await page.evaluate(() => { G.desktop.mobile.marker(null); });
  await sleep(200);
  s = await page.evaluate(() => { const b = document.querySelector("[data-action=throw]"), cs = getComputedStyle(b); return { how: null, dim: b.classList.contains("no-target"), opacity: cs.opacity, ring: __s.vis(".phone-target"), pointer: cs.pointerEvents, text: b.firstChild.textContent }; });
  check(s.dim && !s.ring && Number(s.opacity) < 0.8 && s.pointer === "auto" && s.text === "SWING", `[${tag}] no target (${found || "taken by hand: no place in play had no target"}): SWING is dimmed, still works, and no ring shows`, s);
  await shot(page, w, h, "5-no-target-dim");
  // 6. the VIEW button in first person: it turns yellow, and the centre ring shows
  await page.evaluate(() => { __s.roof(); G.ui.say("", 0); });
  await page.locator("[data-action=view]").click();
  await page.evaluate(() => __s.step(40));
  await settle(page);
  s = await page.evaluate(() => ({ view: document.body.dataset.view, first: G.flatcam.firstPerson, bg: getComputedStyle(document.querySelector("[data-action=view]")).backgroundColor, centre: __s.vis(".phone-crosshair") }));
  check(s.view === "first" && s.first && s.bg === "rgb(255, 216, 74)" && s.centre, `[${tag}] view: a press of VIEW gives the first-person view, the button is yellow and the centre ring shows`, s);
  await shot(page, w, h, "6-view-first");
  check(page.errors.length === 0, `[${tag}] no console error or page error`, page.errors.slice(0, 4));
  await page.context().close();
}

try {
  for (const [w, h, touch] of SIZES) if (!process.env.SIZE || process.env.SIZE === w + "x" + h) await (touch ? phone(w, h) : mouse(w, h));
  console.log("INFO: PNGs in " + out);
} catch (e) {
  check(false, "the run finished: " + e.message, String(e.stack || "").split("\n").slice(0, 4).join(" | "));
} finally {
  await close();
}
done();
