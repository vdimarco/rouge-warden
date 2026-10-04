// Checks flat play with a mouse, a keyboard and a game pad (js/desktop.js, js/target.js and their wiring in js/main.js): the opening
// with the exact aim, the swing input (left button, E, right trigger; right button, Q, left trigger), a quick click, the second rope,
// the hand, the kick and the latch, Space, F, Shift and the wheel, modifier keys, Tab and the map, the Rope trigger setting, the resume
// click and the lock click, page keys in a pause, the lock-on ring and its arrow, the LET GO cue, the key strip, the view lift and the
// turn from a wall, the fake pad for every button and axis, a title for a touch device with a fine pointer, and a first-time bot with
// real inputs. SHOTS=<dir> saves pictures. Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/flat.mjs
// ONLY=<part,part> (opening, swing, pad, marker = sizes + extras, camera, title, bot, vr) runs some of the parts. SIZE=640x360 limits sizes.
import { newPage, open, close, enterXR, waitState, waitFor, checker, watchdog, shot, sleep } from "./lib.mjs";
import { WORLD, TARGET, PAD, DESKTOP, FLATCAM, HINT, LINES_PAD, LINES_DESKTOP } from "../../public/vr/js/config.js";
import { generate } from "../../public/vr/js/city.js";

const { check, done } = checker("flat");
watchdog(3300000, "flat");
const ONLY = process.env.ONLY || "";
const want = (part) => !ONLY || ONLY.split(",").includes(part);
const city = generate(WORLD.seed), S0 = city.start;
const DEG = Math.PI / 180;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const log = (m) => console.log("INFO: " + m);

/* ---------------- the fake pad, and helpers that run in the page ---------------- */
// A pad that the page reads through navigator.getGamepads: __f.btn and __f.axis set a button or an axis, and __rumble collects the effects.
const FAKE = () => {
  window.AudioContext = window.webkitAudioContext = undefined; // no audio device here; the sound has its own tests
  const mk = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { id: "Fake Pad (standard)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: mk(), vibrationActuator: { playEffect(type, o) { (window.__rumble = window.__rumble || []).push({ type, ...o }); return Promise.resolve("complete"); } } };
  window.__padOn = false;
  Object.defineProperty(navigator, "getGamepads", { value: () => (window.__padOn ? [window.__pad] : []), configurable: true });
  window.__f = {
    step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) G.test.step(dt, 1); },
    // the events since a frame, as "type:side" (or "type" when it has no side)
    ev(from) { return G.test.events().filter((e) => e.frame > from && e.type !== "input").map((e) => e.type + (e.side != null ? ":" + e.side : "")); },
    evs(from) { return G.test.events().filter((e) => e.frame > from && e.type !== "input"); },
    btn(i, v) { window.__padOn = true; const b = window.__pad.buttons[i]; b.value = v; b.pressed = v >= 0.5; },
    axis(i, v) { window.__padOn = true; window.__pad.axes[i] = v; },
    padOff() { window.__padOn = false; for (const b of window.__pad.buttons) { b.value = 0; b.pressed = false; } window.__pad.axes.fill(0); },
    px(ndc) { return { x: (ndc.x * 0.5 + 0.5) * innerWidth, y: (0.5 - ndc.y * 0.5) * innerHeight }; },
    // a world point on the screen of the camera now, in pixels
    toScreen(p) { G.camera.updateMatrixWorld(true); const v = new G.camera.position.constructor(p.x, p.y, p.z).project(G.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, z: v.z }; },
    rect(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; },
    vis(sel) { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return !e.closest("[hidden]") && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; },
    // the hero on the start roof, both ropes idle, the camera at the default view
    roof() { const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.P.frozen = false; G.rigYaw = s.yaw; G.flatcam.reset(s.yaw); __f.step(30); },
    bid(i) { const r = G.test.state().ropes[i]; return r.state !== "idle" && typeof r.id === "number" ? G.city.colliders[r.id].bid : null; },
    // a one-box building with a clear street face (+x), and flying into it: in the air 3 m off the wall at half its height, facing it
    wall() {
      const C = G.city;
      const B = C.colliders.find((c) => {
        if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
        if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
        const z = (c.minZ + c.maxZ) / 2;
        for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
        return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
      });
      window.__B = B;
      return B ? { maxX: B.maxX, maxY: B.maxY, z: (B.minZ + B.maxZ) / 2 } : null;
    },
    flyIn() {
      const B = window.__B, z = (B.minZ + B.maxZ) / 2;
      G.test.teleport(B.maxX + 3, B.maxY / 2, z); G.rigYaw = Math.PI / 2; G.flatcam.reset(Math.PI / 2);
      G.P.vel.x = -8; __f.step(30);
      return !!G.P.wall;
    },
    // a spot on a clog's roof with a clear line from the head to the bowl
    clogSpot(c) {
      const S = 1.35, T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, HIT = {};
      for (const r of [6, 8, 10, 13]) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
        if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
        if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
        const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
        if (G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) continue;
        return { x, y: c.y, z, T };
      }
      return null;
    },
    // stand near clog id and look at its bowl
    atClog(id) {
      const c = G.city.clogs[id], sp = __f.clogSpot(c);
      if (!sp) return null;
      G.test.teleport(sp.x, sp.y, sp.z);
      const dx = sp.T.x - sp.x, dy = sp.T.y - (sp.y + 1.65), dz = sp.T.z - sp.z, yaw = Math.atan2(-dx, -dz), pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
      G.rigYaw = yaw; G.flatcam.reset(yaw, pitch * 0.6); __f.step(30);
      return { x: sp.x, y: sp.y, z: sp.z, T: sp.T };
    },
  };
};
const ev = (page, from) => page.evaluate((f) => __f.ev(f), from);
const evs = (page, from) => page.evaluate((f) => __f.evs(f), from);
const frame = (page) => page.evaluate(() => G.frame);
const step = (page, n = 1) => page.evaluate((n) => { __f.step(n); return G.frame; }, n);
const st = (page) => page.evaluate(() => G.test.state());
const tgt = (page) => page.evaluate(() => G.test.target());
const has = (list, type) => list.some((e) => e === type || e.startsWith(type + ":"));
const count = (list, type) => list.filter((e) => e === type || e.startsWith(type + ":")).length;
const speed = (v) => Math.hypot(v.x, v.y, v.z);

// a page in flat play on the start roof, the loop held so that G.test.step owns time
// A real pointer lock can send a stray mouse move a little after it is granted, which turns the view by an unknown amount at an
// unknown time, and a headless browser may refuse it. So a page gets no lock (the flag G.desktop.locked stands in for it), or an
// emulated one that behaves like the browser's (fakeLock: it grants after the request, lets go on exitPointerLock, and
// window.__lock.refuse makes it refuse with a pointerlockerror), and never the real one.
const NOLOCK = () => { Element.prototype.requestPointerLock = function () { return undefined; }; };
const FAKELOCK = () => {
  let el = null;
  window.__lock = { refuse: false, requests: 0 };
  Object.defineProperty(Document.prototype, "pointerLockElement", { get: () => el, configurable: true });
  Element.prototype.requestPointerLock = function () {
    const me = this; window.__lock.requests++;
    return Promise.resolve().then(() => {
      if (window.__lock.refuse) { document.dispatchEvent(new Event("pointerlockerror")); return; }
      if (el !== me) { el = me; document.dispatchEvent(new Event("pointerlockchange")); }
    });
  };
  Document.prototype.exitPointerLock = function () { if (el) { el = null; Promise.resolve().then(() => document.dispatchEvent(new Event("pointerlockchange"))); } };
};
const held = (page) => page.waitForFunction(() => G.desktop.locked && document.pointerLockElement === document.querySelector("#view canvas"), null, { timeout: 15000 });
async function playPage(width, height, { flags = "nosw&skipintro", init = null, afterLoad = null, enter = true, fakeLock = false } = {}) {
  const page = await newPage({ width, height });
  await page.addInitScript(FAKE);
  await page.addInitScript(fakeLock ? FAKELOCK : NOLOCK);
  for (const f of [].concat(init || [])) await page.addInitScript(f);
  await open(page, flags);
  if (afterLoad) await afterLoad(page);
  if (!enter) return page;
  await enterXR(page, "desktop");
  await waitState(page, { mode: "desktop", state: "play" }, 240000);
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); __f.roof(); });
  return page;
}
const mid = (page) => page.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
// the real pointer lock may or may not be granted here: the game knows the lock only by this flag
const lock = (page) => page.evaluate(() => { G.desktop.locked = true; });
const render = (page) => page.evaluate(() => { G.renderer.render(G.scene, G.camera); });

/* ================= the opening: the exact aim, the real left button and a fake pad ================= */
async function opening(pad) {
  const page = await newPage({ width: 960, height: 540 });
  await page.addInitScript(FAKE);
  await page.addInitScript(NOLOCK);
  await open(page, "nosw");
  await enterXR(page, "desktop");
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); });
  const label = pad ? "a fake right trigger" : "the left mouse button";
  // the opening runs on its own clock until the crack is there to shoot
  let phase = "";
  for (let i = 0; i < 80 && phase !== "shoot"; i++) phase = await page.evaluate(() => { __f.step(30); return G.test.portal().phase; });
  check(phase === "shoot", "the opening reaches the phase where you shoot the crack (" + label + ")", phase);
  const info = await page.evaluate(() => ({ mode: G.ropes.mode, state: G.state, on: G.test.target().on }));
  check(info.state === "intro" && info.mode === "special" && info.on === false, "in the opening the picker is off and only the crack, clogs and pipes take a cup", info);
  const hud = await page.evaluate(() => ({ ring: __f.vis("#lockRing"), arrow: __f.vis("#lockArrow"), strip: __f.vis("#keyHints"), cue: __f.vis("#lockCue") }));
  check(!hud.ring && !hud.arrow && !hud.strip && !hud.cue, "in the opening no ring, arrow, caption or key strip shows", hud);
  await lock(page);
  // the crosshair on the sky: the swing input does not bend the aim toward a building
  await page.evaluate(() => { G.test.look(0, 0.7); __f.step(4); });
  let f0 = await frame(page);
  if (pad) await page.evaluate(() => { __f.btn(7, 1); __f.step(40); __f.btn(7, 0); __f.step(30); });
  else { const m = await mid(page); await page.mouse.move(m.x, m.y); await page.mouse.down(); await step(page, 40); await page.mouse.up(); await step(page, 30); }
  let s = await st(page), e = await ev(page, f0);
  check(s.ropes[0].state === "idle" && s.ropes[1].state === "idle" && !has(e, "attach") && has(e, "dry"), "the crosshair on the sky: " + label + " fires a dry cup and no rope attaches (the aim is not bent toward a building)", { e, ropes: s.ropes.map((r) => r.state) });
  // the crosshair on the crack
  const aimed = await page.evaluate(() => {
    const t = G.ropes.targets().find((q) => q.id === "crack").pos, h = G.test.state().head, f = G.test.flat();
    const dx = t.x - h.x, dy = t.y - h.y, dz = t.z - h.z, l = Math.hypot(dx, dy, dz), want = Math.asin(dy / l);
    G.test.look(0, want - f.pitch); __f.step(4);
    const p = __f.toScreen(t);
    return { x: p.x, y: p.y, w: innerWidth, h: innerHeight, dist: l };
  });
  check(Math.abs(aimed.x - aimed.w / 2) < aimed.w * 0.12 && Math.abs(aimed.y - aimed.h / 2) < aimed.h * 0.1, "the crosshair rests on the crack (" + Math.round(aimed.x) + ", " + Math.round(aimed.y) + " of " + aimed.w + " by " + aimed.h + ")", aimed);
  f0 = await frame(page);
  await page.evaluate(() => { window.__rumble = []; });
  if (pad) await page.evaluate(() => { __f.btn(7, 1); __f.step(40); });
  else { await page.mouse.down(); await step(page, 40); }
  s = await st(page); e = await ev(page, f0);
  check(s.ropes[0].state === "attached" && s.ropes[0].tag === "crack" && has(e, "fire:0"), "holding " + label + " with the crosshair on the crack attaches the left rope to the crack (the old hand mapping)", { rope: s.ropes[0], e });
  check(!has(e, "kick") && !has(e, "hop"), "the opening gives no kick and no hop");
  if (pad) {
    const r = await page.evaluate(() => window.__rumble);
    check(r.length >= 1 && r[0].type === "dual-rumble" && near(r[0].strongMagnitude, PAD.rumble.attach[0], 1e-9) && near(r[0].duration, PAD.rumble.attach[1], 1e-9), "an attach rumbles the pad: 0.3 for 30 ms", r.slice(0, 2));
  }
  // F (or the right bumper) pumps the crack
  const f1 = await frame(page);
  await page.evaluate(() => { window.__rumble = []; });
  if (pad) await page.evaluate(() => { __f.btn(5, 1); __f.step(2); __f.btn(5, 0); __f.step(40); });
  else { await page.keyboard.press("KeyF"); await step(page, 40); }
  e = await ev(page, f1);
  const ph = await page.evaluate(() => G.test.portal().phase);
  check(e.some((x) => x.startsWith("yank")) && ph !== "yank" && ph !== "shoot", (pad ? "the right bumper" : "F") + " yanks, the crack takes the pump and the opening goes on (phase " + ph + ")", { e: e.slice(0, 8), ph });
  if (pad) {
    const r = await page.evaluate(() => window.__rumble);
    check(r.some((x) => near(x.strongMagnitude, PAD.rumble.pump[0], 1e-9) && near(x.duration, PAD.rumble.pump[1], 1e-9)), "a pump rumbles the pad: 0.6 for 60 ms", r.slice(0, 3));
    await page.evaluate(() => __f.btn(7, 0));
  } else await page.mouse.up();
  check(page.errors.length === 0, "no page errors in the opening (" + label + ")", page.errors);
  await page.context().close();
}

/* ================= the swing input, in play with the mouse and the keyboard ================= */
async function swing() {
  const page = await playPage(960, 540, { fakeLock: true }); // the emulated lock: Tab, Tab and the resume click are about it
  await held(page);
  const m = await mid(page); await page.mouse.move(m.x, m.y);
  const R = async (f = () => {}) => { await page.evaluate(() => __f.roof()); return frame(page); };
  /* ---- hold the left button ---- */
  let f0 = await R();
  const t0 = await tgt(page);
  check(t0.on && t0.target && t0.target.kind === "ring", "on the start roof, in the tutorial, the target is the gold ring", t0.target);
  await page.mouse.down();
  await step(page, 36);
  let s = await st(page), e = await ev(page, f0);
  const rp = s.ropes[0];
  check(rp.state === "attached" && rp.tag === "building" && rp.anchor.y - S0.y >= 10 && Math.abs(rp.anchor.x - city.goldRing.x) < 2, "holding the left button: the left rope attaches within 0.6 s to the tower face at the gold ring, over 10 m above the roof", rp);
  check(has(e, "fire:0") && has(e, "kick:0") && !has(e, "hop"), "the left rope fires (the target is on the left), the attach gets a kick and there is no hop by default", e);
  const hand = await page.evaluate(() => { const ri = G.ropes.info(), h = G.hero.hand(0), from = ri.ropes[0].to; return Math.hypot(from[0] - h.x, from[1] - h.y, from[2] - h.z); });
  check(hand < 0.02, "the rope starts at the hero's left hand", hand);
  await page.mouse.up();
  await step(page, 3);
  s = await st(page); e = await ev(page, f0);
  check(s.ropes[0].state === "idle" && has(e, "detach:0"), "letting go of the button lets go of the rope");
  /* ---- E, and Q ---- */
  f0 = await R();
  await page.keyboard.down("KeyE"); await step(page, 36);
  s = await st(page); e = await ev(page, f0);
  check(s.ropes[0].state === "attached" || s.ropes[1].state === "attached", "holding E fires the same rope", s.ropes.map((r) => r.state));
  await page.keyboard.up("KeyE"); await step(page, 3);
  s = await st(page);
  check(s.ropes[0].state === "idle" && s.ropes[1].state === "idle", "letting go of E lets go of the rope");
  f0 = await R();
  await page.keyboard.down("KeyQ"); await step(page, 36);
  s = await st(page);
  check(s.ropes[1].state === "attached" && s.ropes[0].state === "idle", "with both ropes idle, Q fires the right hand at the target", s.ropes.map((r) => r.state));
  await page.keyboard.up("KeyQ"); await step(page, 3);
  f0 = await R();
  await page.mouse.down({ button: "right" }); await step(page, 36);
  s = await st(page);
  check(s.ropes[1].state === "attached" && s.ropes[0].state === "idle", "with both ropes idle, the right button fires the right hand at the target", s.ropes.map((r) => r.state));
  await page.mouse.up({ button: "right" }); await step(page, 3);
  /* ---- a quick click, and a quick click before the cup lands ---- */
  f0 = await R();
  await page.mouse.down(); await step(page, 5); await page.mouse.up(); await step(page, 40);
  s = await st(page); const evl = await evs(page, f0);
  const order = evl.map((x) => x.type).filter((x) => /^(fire|attach|detach)$/.test(x));
  const att = evl.find((x) => x.type === "attach"), det = evl.find((x) => x.type === "detach");
  check(JSON.stringify(order) === JSON.stringify(["fire", "attach", "detach"]) && det.frame - att.frame <= 1 && s.ropes[0].state === "idle", "an 80 ms click still lands the cup (65 m away) and the rope lets go on the first frame after the attach", { order, att: att && att.frame, det: det && det.frame });
  /* ---- the second rope ---- */
  f0 = await R();
  await page.mouse.down(); await step(page, 36);
  const a0 = await page.evaluate(() => __f.bid(0));
  const mk = await tgt(page);
  await page.mouse.down({ button: "right" }); await step(page, 40);
  s = await st(page); e = await ev(page, f0);
  const a1 = await page.evaluate(() => __f.bid(1));
  check(s.ropes[0].state === "attached" && s.ropes[1].state === "attached" && a1 !== a0 && a1 != null, "with a rope on building A, the right button fires the idle hand at a different building", { a0, a1, marker: mk.target && mk.target.bid });
  check(!has(e, "kick:1"), "no kick for the second rope");
  const fe = await frame(page);
  await page.keyboard.down("KeyE"); await step(page, 10);
  e = await ev(page, fe);
  check(!has(e, "fire") && !has(e, "dry"), "with both ropes out another press fires nothing and shows no dry fire", e);
  await page.keyboard.up("KeyE");
  await page.mouse.up({ button: "right" }); await step(page, 3);
  s = await st(page);
  check(s.ropes[1].state === "idle" && s.ropes[0].state === "attached", "letting go of the right button lets go of the second rope only");
  await page.mouse.up(); await step(page, 3);
  /* ---- the hand follows the side of the target ---- */
  const sides = [];
  for (const yawOff of [0.5, -0.5, 0]) {
    await R();
    await page.evaluate((y) => { G.test.look(y, 0); __f.step(10); }, yawOff);
    // the ring is not a target after the first swing: whatever the picker marks now
    const t1 = await tgt(page);
    if (!t1.target) { sides.push({ yawOff, none: true }); continue; }
    const f1 = await frame(page);
    await page.mouse.down(); await step(page, 36);
    s = await st(page);
    const fired = s.ropes[0].state === "attached" ? 0 : s.ropes[1].state === "attached" ? 1 : -1;
    sides.push({ yawOff, side: t1.side, hand: t1.hand, fired });
    await page.mouse.up(); await step(page, 3);
  }
  const ok = sides.filter((q) => !q.none && Math.abs(q.side) > 8).every((q) => q.fired === (q.side > 0 ? 0 : 1));
  check(sides.filter((q) => !q.none && Math.abs(q.side) > 8).length >= 1 && ok, "the hand on the side of the target fires: left for a target to the left, right for one to the right", sides);
  /* ---- Space in each state ---- */
  await R();
  await page.keyboard.press("Space"); await step(page, 1);
  s = await st(page);
  check(s.vel.y > 4.5 && !s.onGround, "Space on a roof jumps (about 5.2 m/s up)", s.vel);
  await step(page, 120);
  const fr = await frame(page);
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 40, s.z); __f.step(10); });
  s = await st(page);
  const v0 = s.vel.y;
  await page.keyboard.press("Space"); await step(page, 1);
  s = await st(page); e = await ev(page, fr);
  check(!s.onGround && s.vel.y < v0 + 0.1 && !has(e, "yank"), "Space in the air with no rope does nothing", { v0, v1: s.vel.y, e });
  // a rope in the air: Space yanks it
  await R();
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y + 30, s.z); G.P.vel.y = -5; G.P.onGround = false; __f.step(2); });
  await page.mouse.down(); await step(page, 40);
  s = await st(page);
  const airRope = s.ropes.some((r) => r.state === "attached") && !s.onGround;
  const f2 = await frame(page);
  await page.keyboard.press("Space"); await step(page, 2);
  e = await ev(page, f2);
  check(airRope && has(e, "yank"), "Space in the air with a rope out yanks the rope", { airRope, e });
  await page.mouse.up(); await step(page, 3);
  // Leaving the start roof at hop 0 (decision D1): with W held, the hero walks while the rope pulls, and the rope takes him off the roof
  // after 3.1 to 3.3 s (measured on this build; the bound is 4 s). The swing input alone kicks him across the roof, and the roof is
  // big and the physics has friction, so he stops on it: that is why the first tutorial line and the key strip say W and the button.
  // (Walking off the edge with the rope on also ends the drag cue: the first frame in the air gives no LET GO.)
  for (const w of [true, false]) {
    await R();
    if (w) await page.keyboard.down("KeyW");
    await page.mouse.down();
    const t = await page.evaluate(() => {
      let n = 0, dragCue = false, airCue = null;
      for (; n < 360 && (G.P.onGround || n < 40); n++) { G.test.step(1 / 60, 1); if (G.P.onGround && n > 40) dragCue = dragCue || G.test.target().cue; }
      if (!G.P.onGround) airCue = G.test.target().cue;
      return { secs: n / 60, ground: G.P.onGround, rope: G.test.state().ropes.some((r) => r.state === "attached"), dragCue, airCue };
    });
    log("from the start roof with" + (w ? "" : "out") + " W the swing input alone: " + (t.ground ? "still on the roof after 6 s" : "airborne after " + t.secs.toFixed(2) + " s") + " (rope " + (t.rope ? "attached" : "not attached") + ")");
    if (w) {
      check(!t.ground && t.rope && t.secs <= 4, "holding W and the left button on the start roof takes the hero off the roof within 4 s (measured 3.1 to 3.3 s; this run " + t.secs.toFixed(2) + " s)", t);
      check(t.dragCue === true && t.airCue === false, "while the rope drags the hero along the roof the LET GO cue shows, and the first frame in the air after the roof gives none (the drag case ends with the ground)", { dragCue: t.dragCue, airCue: t.airCue });
    }
    await page.mouse.up(); if (w) await page.keyboard.up("KeyW");
    await step(page, 3);
  }
  /* ---- F yanks, Shift reels, the wheel reels ---- */
  await R();
  await page.mouse.down(); await step(page, 36);
  const f3 = await frame(page);
  const before = await page.evaluate(() => ({ len: G.P.ropes[0].lenTarget, vel: { ...G.P.vel } }));
  await page.keyboard.press("KeyF"); await step(page, 3);
  e = await ev(page, f3);
  const after = await page.evaluate(() => ({ len: G.P.ropes[0].lenTarget, vel: { ...G.P.vel } }));
  check(has(e, "yank:0") && after.len < before.len - 0.5, "F yanks the attached rope: a yank event, and the rope is shorter", { e, before: before.len, after: after.len });
  await step(page, 30);
  const l0 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  await page.keyboard.down("Shift"); await step(page, 30); await page.keyboard.up("Shift");
  const l1 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  check(l0 - l1 > 3, "Shift reels the rope in (0.5 s: " + (l0 - l1).toFixed(1) + " m shorter)", { l0, l1 });
  await step(page, 30);
  const w0 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  await page.mouse.wheel(0, 100); await step(page, 15);
  const w1 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  check(w0 - w1 > 0.8, "one notch of the mouse wheel reels for 0.15 s (" + (w0 - w1).toFixed(2) + " m)", { w0, w1 });
  // a pinch is a wheel event with Ctrl: it reels nothing. A flick, a stream of events, reels at most 0.3 s in any 0.5 s
  await step(page, 30);
  const p0 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  await page.keyboard.down("Control"); await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100); await page.keyboard.up("Control"); await step(page, 15);
  const p1 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  check(near(p0, p1, 1e-6), "a wheel event with Ctrl held (a pinch) reels nothing", { p0, p1 });
  const stream = await page.evaluate(() => {
    const cv = document.querySelector("#view canvas");
    let reeling = 0;
    for (let i = 0; i < 60; i++) { cv.dispatchEvent(new WheelEvent("wheel", { deltaY: 40, cancelable: true, bubbles: true })); G.test.step(1 / 60, 1); if (G.P.ropes[0].reeling) reeling++; }
    return reeling;
  });
  check(stream > 0 && stream / 60 <= 0.6 + 2 / 60, "60 wheel events in 1 s reel for at most 0.6 s (" + (stream / 60).toFixed(2) + " s)", stream);
  await page.mouse.up(); await step(page, 3);
  /* ---- keys with Ctrl, Meta or Alt do nothing ---- */
  await R();
  await page.mouse.down(); await step(page, 36);
  const f4 = await frame(page), pos0 = (await st(page)).pos;
  await page.keyboard.down("Control"); await page.keyboard.press("KeyF"); await page.keyboard.press("KeyW"); await page.keyboard.press("Space"); await page.keyboard.up("Control");
  await page.keyboard.down("Meta"); await page.keyboard.press("KeyF"); await page.keyboard.press("KeyV"); await page.keyboard.up("Meta");
  await page.keyboard.down("Alt"); await page.keyboard.press("KeyF"); await page.keyboard.press("Tab"); await page.keyboard.up("Alt");
  await step(page, 10);
  e = await ev(page, f4);
  const ui0 = await page.evaluate(() => ({ view: G.test.flat().firstPerson, panel: G.test.ui().panel, state: G.state }));
  check(!has(e, "yank") && ui0.view === false && ui0.panel === null && ui0.state === "play", "Ctrl, Meta and Alt keys do nothing: no yank, no jump, no view switch, no map", { e, ui0 });
  await page.keyboard.down("Control"); await page.keyboard.down("KeyW"); await step(page, 30); await page.keyboard.up("KeyW"); await page.keyboard.up("Control");
  await page.mouse.up(); await step(page, 3);
  /* ---- the kick, the latch and a test hook ---- */
  f0 = await R();
  await page.evaluate(() => { const T = G.test.target().target; G.test.aimAt(1, T.x, T.y, T.z); G.test.press(1, true); __f.step(30); });
  e = await ev(page, f0);
  check(has(e, "attach:1") && !has(e, "kick") && !has(e, "hop"), "a rope that G.test.press fires gets no kick and no hop (only a real input does)", e);
  await page.evaluate(() => { G.test.press(1, false); G.test.aimAt(1, null); __f.step(3); });
  // a hop only when tuned
  f0 = await R();
  await page.evaluate(async () => { (await import("./js/config.js")).DESKTOP.hop = 3; });
  await page.mouse.down(); await step(page, 3);
  s = await st(page); e = await ev(page, f0);
  check(has(e, "hop") && s.vel.y > 3, "with DESKTOP.hop above 0 a real swing from the roof hops toward the target", { e, vy: s.vel.y });
  await page.mouse.up(); await step(page, 3);
  await page.evaluate(async () => { (await import("./js/config.js")).DESKTOP.hop = 0; });
  // a swing in the air: the kick leaves at least 10 m/s across the rope toward the view one frame after the attach
  f0 = await R();
  const air = await page.evaluate(async () => {
    const s = G.city.start; G.test.teleport(s.x, s.y + 30, s.z); G.P.vel.y = -5; G.P.onGround = false;
    const rope = () => G.test.state().ropes[0];
    const across = () => {
      const r = G.P.ropes[0], A = r.anchor, n = { x: G.P.pos.x - A.x, y: G.P.pos.y + G.P.chest - A.y, z: G.P.pos.z - A.z }, nl = Math.hypot(n.x, n.y, n.z);
      const yaw = G.rigYaw; let t = { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
      const k = (t.x * n.x + t.z * n.z) / nl; t = { x: t.x - (k * n.x) / nl, y: t.y - (k * n.y) / nl, z: t.z - (k * n.z) / nl };
      const tl = Math.hypot(t.x, t.y, t.z);
      return { v: (G.P.vel.x * t.x + G.P.vel.y * t.y + G.P.vel.z * t.z) / tl, tl };
    };
    __f.step(2);
    const ok = !!G.test.target().target;
    document.querySelector("#view canvas").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    let f = 0, got = null;
    for (; f < 60; f++) { G.test.step(1 / 60, 1); if (G.P.ropes[0].state === "attached") { G.test.step(1 / 60, 1); got = across(); break; } }
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    return { ok, got, kicks: G.test.events().filter((e) => e.type === "kick").length };
  });
  check(air.ok && air.got && (air.got.v >= 9.9 || air.got.tl < 0.31) && air.kicks >= 1, "falling at 5 m/s with a target ahead: a frame after the attach the speed across the rope toward the view is at least 10 m/s", air);
  await step(page, 3);
  /* ---- a clog: no kick and no hop, three pumps flush it ---- */
  let flushed = null;
  for (const id of [0, 1, 2, 3, 4, 5]) {
    f0 = await frame(page);
    const spot = await page.evaluate((id) => __f.atClog(id), id);
    if (!spot) continue;
    const t = await tgt(page);
    if (!t.target || t.target.kind !== "clog") { flushed = { id, kind: t.target && t.target.kind }; continue; }
    await page.mouse.down(); await step(page, 36);
    s = await st(page); e = await ev(page, f0);
    const tag = s.ropes[0].tag || s.ropes[1].tag;
    for (let i = 0; i < 3; i++) { await page.keyboard.press("KeyF"); await step(page, 25); }
    const done = await page.evaluate((id) => G.game.info().clogs[id].done, id);
    flushed = { id, tag, done, hop: has(e, "hop"), kick: has(e, "kick") };
    await page.mouse.up(); await step(page, 3);
    break;
  }
  check(flushed && flushed.tag === "clog" && flushed.done && !flushed.hop && !flushed.kick, "a clog in view is the target: the swing input plunges it with no hop and no kick, and three presses of F (0.4 s apart) flush it", flushed);
  /* ---- Tab opens the map and closes it, M is the sound ---- */
  await R(); await held(page);
  await page.keyboard.press("Tab"); await step(page, 3);
  let ui = await page.evaluate(() => ({ panel: G.test.ui().panel, state: G.state }));
  check(ui.panel === "map" && ui.state === "paused", "Tab opens the map", ui);
  await page.keyboard.press("Tab"); await step(page, 3);
  ui = await page.evaluate(() => ({ panel: G.test.ui().panel, state: G.state }));
  check(ui.panel === null && ui.state === "play", "Tab again closes the map and play goes on", ui);
  await held(page); // the lock is held, or comes back at once
  // the first mouse move after a grant is skipped (the browser makes one up), so two moves: the view turns for the second
  const turned = await page.evaluate(() => {
    const y0 = G.test.flat().yaw;
    window.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 0 }));
    window.dispatchEvent(new MouseEvent("mousemove", { movementX: -100, movementY: 0 })); __f.step(3);
    return Math.abs(Math.atan2(Math.sin(G.test.flat().yaw - y0), Math.cos(G.test.flat().yaw - y0)));
  });
  check(turned > 0.1, "after Tab, Tab the lock is held and the mouse still turns the view (" + turned.toFixed(2) + " rad)", turned);
  const snd = await page.evaluate(() => G.audio.isOn);
  await page.keyboard.press("KeyM"); await step(page, 3);
  ui = await page.evaluate(() => ({ panel: G.test.ui().panel, on: G.audio.isOn, state: G.state }));
  check(ui.panel === null && ui.state === "play" && ui.on !== snd, "M turns the sound off or on and does not open the map", { ui, was: snd });
  await page.keyboard.press("KeyM"); await step(page, 3);
  /* ---- the Rope trigger setting ---- */
  await R();
  await page.evaluate(() => { G.settings.hold = "toggle"; });
  await page.mouse.down(); await step(page, 5); await page.mouse.up(); await step(page, 40);
  s = await st(page);
  check(s.ropes[0].state === "attached" || s.ropes[1].state === "attached", "Toggle: a press and the button going up leaves the rope on", s.ropes.map((r) => r.state));
  await page.mouse.down(); await step(page, 3); await page.mouse.up(); await step(page, 3);
  s = await st(page);
  check(s.ropes[0].state === "idle" && s.ropes[1].state === "idle", "Toggle: the next press of that input lets go", s.ropes.map((r) => r.state));
  await page.evaluate(() => { G.settings.hold = "hold"; });
  await R();
  await page.mouse.down(); await step(page, 5); await page.mouse.up(); await step(page, 3);
  /* ---- the resume click and the lock click ---- */
  // Esc with the lock held: the browser lets go of the lock (and keeps the key), the game pauses at that
  await R(); await held(page);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => G.state === "paused", null, { timeout: 5000 });
  await step(page, 3);
  ui = await page.evaluate(() => ({ state: G.state, open: document.querySelector("#fsMenu").open, locked: G.desktop.locked }));
  check(ui.state === "paused" && ui.open && !ui.locked, "when the browser lets go of the pointer lock (Esc) the game pauses with the menu open", ui);
  // page keys keep their page meaning while paused: Tab moves the focus, and the key is not stopped
  await page.evaluate(() => { window.__keys = []; window.addEventListener("keydown", (e) => window.__keys.push({ code: e.code, prevented: e.defaultPrevented })); });
  await page.keyboard.press("Tab");
  const focus1 = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
  const keys = await page.evaluate(() => window.__keys);
  check(keys.filter((k) => ["Tab", "Space", "ArrowDown"].includes(k.code)).every((k) => !k.prevented) && focus1 === "BUTTON", "in a pause Tab, Space and the arrows keep their page meaning (Tab moves the focus to a menu button)", { keys, focus1 });
  await step(page, 3);
  ui = await page.evaluate(() => ({ state: G.state }));
  check(ui.state === "paused", "and the pause is still there after those keys", ui);
  // (Space may have pressed a menu button: start the next pause clean)
  await page.evaluate(() => { G.ui.closePause(); __f.step(3); });
  await R(); await held(page);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => G.state === "paused", null, { timeout: 5000 });
  await step(page, 3);
  // the click that resumes asks for the lock and swings nothing
  const fp = await frame(page);
  await page.mouse.click(40, m.y); await step(page, 5); // beside the pause card: the click lands on the city
  s = await st(page); e = await ev(page, fp);
  check(s.state === "play" && s.ropes.every((r) => r.state === "idle") && !has(e, "fire") && !has(e, "dry") && s.onGround, "the click that resumes from a pause starts no swing: both ropes idle, the hero on the roof", { state: s.state, e });
  await held(page);
  const fr2 = await frame(page);
  await page.mouse.down(); await step(page, 36);
  s = await st(page); e = await ev(page, fr2);
  check(s.ropes[0].state === "attached" || s.ropes[1].state === "attached", "the lock is back and the next press after the resume click fires a rope", { ropes: s.ropes.map((r) => r.state), state: s.state, e, tgt: (await tgt(page)).target });
  await page.mouse.up(); await step(page, 3);
  // a pause that kept the lock (the pad's Start, a key): the click resumes and swings nothing too
  // (the pause menu lets go of the lock itself, so the emulated browser grants it again here: the lock is held at the click)
  await R(); await held(page);
  await page.evaluate(() => { G.ui.openPause(); __f.step(3); });
  await page.waitForFunction(() => !G.desktop.locked, null, { timeout: 5000 });
  await page.evaluate(() => document.querySelector("#view canvas").requestPointerLock());
  await held(page);
  const kept = await page.evaluate(() => ({ state: G.state, lock: document.pointerLockElement === document.querySelector("#view canvas") }));
  const f6 = await frame(page);
  await page.mouse.click(40, m.y); await step(page, 5);
  s = await st(page); e = await ev(page, f6);
  check(kept.state === "paused" && kept.lock && s.state === "play" && s.ropes.every((r) => r.state === "idle") && !has(e, "fire") && !has(e, "dry"), "with the lock still held at the click that resumes (a slow release), no swing starts either", { kept, state: s.state, e });
  // a browser that refuses the lock every time: the click that resumes asks for it and swings nothing
  await R(); await held(page);
  await page.evaluate(() => { window.__lock.refuse = true; document.exitPointerLock(); });
  await page.waitForFunction(() => G.state === "paused", null, { timeout: 5000 });
  await step(page, 2);
  await page.mouse.move(40, m.y);
  const fired = [];
  for (let i = 0; i < 3; i++) {
    const fi = await frame(page);
    await page.mouse.down(); await step(page, 12);
    const ei = await ev(page, fi);
    fired.push(has(ei, "fire") || has(ei, "dry"));
    await page.mouse.up(); await step(page, 3);
  }
  // every refused request counts (the resume asks once itself), so the clicks lost are two at most, and the click that resumes is one
  check(!fired[0] && fired.filter((f) => !f).length <= 2 && fired[2], "a browser that refuses the pointer lock: the click that resumes swings nothing, at most two clicks are lost, then clicks swing again", fired);
  await page.evaluate(() => { window.__lock.refuse = false; });
  check(page.errors.length === 0, "no page errors in the swing checks", page.errors);
  await page.context().close();
}

/* ================= the game pad ================= */
async function padPart() {
  const page = await playPage(960, 540);
  await lock(page);
  const R = async () => { await page.evaluate(() => { __f.padOff(); __f.roof(); }); return frame(page); };
  const press = (i, n = 2) => page.evaluate(([i, n]) => { __f.btn(i, 1); __f.step(n); __f.btn(i, 0); __f.step(2); }, [i, n]);
  let f0 = await R();
  let k = await page.evaluate(() => G.test.input().kind);
  check(k === "mouse", "before the pad is used the input kind is mouse", k);
  // B has no action, but it tells the game that the pad is in use
  await page.evaluate(() => { __f.btn(1, 1); __f.step(2); });
  k = await page.evaluate(() => ({ kind: G.test.input().kind, hand: G.test.input().hands[1].kind }));
  check(k.kind === "pad" && k.hand === "pad", "a pad button makes the input kind pad", k);
  await page.evaluate(() => { __f.btn(1, 0); __f.step(2); });
  // the buttons with no action: B, Back, the stick buttons and the D-pad
  const none0 = await page.evaluate(() => ({ view: G.test.flat().firstPerson, state: G.state, panel: G.test.ui().panel, pos: G.test.state().pos }));
  const fn = await frame(page);
  for (const i of [1, 8, 10, 11, 12, 13, 14, 15]) await press(i, 3);
  const none1 = await page.evaluate(() => ({ view: G.test.flat().firstPerson, state: G.state, panel: G.test.ui().panel, pos: G.test.state().pos }));
  const eNone = await ev(page, fn);
  check(none1.view === none0.view && none1.state === "play" && none1.panel === null && !has(eNone, "fire") && !has(eNone, "yank") && !has(eNone, "dry") && near(none0.pos.x, none1.pos.x, 1e-6), "B, Back, the stick buttons and the D-pad do nothing: no swing, no view, no map, no pause", { none0, none1, e: eNone });
  // RT swings, a quick tap still attaches
  f0 = await R();
  await page.evaluate(() => { __f.btn(7, 1); __f.step(36); });
  let s = await st(page), e = await ev(page, f0);
  check((s.ropes[0].state === "attached" || s.ropes[1].state === "attached") && has(e, "kick"), "RT held with a target in view: a rope attaches and gets a kick", { e, ropes: s.ropes.map((r) => r.state) });
  await page.evaluate(() => { __f.btn(7, 0); __f.step(3); });
  s = await st(page);
  check(s.ropes.every((r) => r.state === "idle"), "letting go of RT lets go of the rope");
  f0 = await R();
  await page.evaluate(() => { __f.btn(7, 1); __f.step(5); __f.btn(7, 0); __f.step(40); });
  const evl = await evs(page, f0);
  const order = evl.map((x) => x.type).filter((x) => /^(fire|attach|detach)$/.test(x));
  const att = evl.find((x) => x.type === "attach"), det = evl.find((x) => x.type === "detach");
  check(JSON.stringify(order) === JSON.stringify(["fire", "attach", "detach"]) && det.frame - att.frame <= 1, "an 80 ms tap of RT still lands the cup and the rope lets go on the first frame after the attach", { order });
  // the first pad line: hold the left stick up and the right trigger. The stick walks the hero while the rope pulls, as W does
  f0 = await R();
  const leave = await page.evaluate(() => {
    __f.axis(1, -1); __f.btn(7, 1);
    let n = 0;
    for (; n < 360 && (G.P.onGround || n < 40); n++) G.test.step(1 / 60, 1);
    const out = { secs: n / 60, ground: G.P.onGround, rope: G.test.state().ropes.some((r) => r.state === "attached") };
    __f.padOff(); __f.step(3);
    return out;
  });
  log("from the start roof with the left stick up and RT: " + (leave.ground ? "still on the roof after 6 s" : "airborne after " + leave.secs.toFixed(2) + " s"));
  check(!leave.ground && leave.rope && leave.secs <= 4, "holding the left stick up and RT on the start roof takes the hero off the roof within 4 s (measured 3.1 to 3.3 s; this run " + leave.secs.toFixed(2) + " s)", leave);
  // trigger hysteresis: down at 0.5, up below 0.3
  f0 = await R();
  await page.evaluate(() => { __f.btn(7, 0.9); __f.step(36); });
  const hyst = await page.evaluate(() => { const out = []; for (let i = 0; i < 30; i++) { __f.btn(7, i % 2 ? 0.45 : 0.6); __f.step(1); out.push(G.test.state().ropes.some((r) => r.state === "attached")); } return out; });
  check(hyst.every(Boolean), "RT wandering between 0.45 and 0.6 for 30 frames keeps the rope attached (no flutter)", hyst.join());
  await page.evaluate(() => { __f.btn(7, 0.25); __f.step(3); });
  s = await st(page);
  check(s.ropes.every((r) => r.state === "idle"), "RT below 0.3 lets go");
  await page.evaluate(() => { __f.btn(7, 0); __f.step(3); });
  // LT is the second rope; LB reels; RB and X yank; A jumps
  f0 = await R();
  await page.evaluate(() => { __f.btn(7, 1); __f.step(36); __f.btn(6, 1); __f.step(40); });
  s = await st(page);
  const b0 = await page.evaluate(() => __f.bid(0)), b1 = await page.evaluate(() => __f.bid(1));
  check(s.ropes[0].state === "attached" && s.ropes[1].state === "attached" && b0 !== b1, "RT holds a rope and LT fires the idle hand at a different building", { b0, b1 });
  const len0 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  await page.evaluate(() => { __f.btn(4, 1); __f.step(30); });
  const len1 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  check(len0 - len1 > 3, "LB reels the rope in (" + (len0 - len1).toFixed(1) + " m in 0.5 s)", { len0, len1 });
  await page.evaluate(() => { __f.btn(4, 0); __f.step(30); });
  const lenR = await page.evaluate(() => G.P.ropes[0].lenTarget);
  const fy = await frame(page);
  await press(5, 2); await page.evaluate(() => __f.step(30));
  const ey = await ev(page, fy);
  const lenR2 = await page.evaluate(() => G.P.ropes[0].lenTarget);
  check(has(ey, "yank") && lenR2 < lenR - 0.5, "RB yanks and does not reel", { ey, lenR, lenR2 });
  const fx = await frame(page);
  await press(2, 2); await page.evaluate(() => __f.step(30));
  const ex = await ev(page, fx);
  check(has(ex, "yank"), "X yanks too", ex);
  await page.evaluate(() => { __f.btn(7, 0); __f.btn(6, 0); __f.step(3); });
  // A: jump on a roof, yank in the air with a rope, jump off a wall
  await R();
  await press(0, 2);
  s = await st(page);
  check(s.vel.y > 4.5 && !s.onGround, "A on a roof jumps", s.vel);
  await page.evaluate(() => { __f.step(120); });
  await R();
  // the first cling of this page (the hint is said once) in the words of a pad
  const wallOk = await page.evaluate(() => { const B = __f.wall(); if (!B || !__f.flyIn()) return null; return document.querySelector(".fs-sub").textContent; });
  check(wallOk === LINES_PAD.wall[0], "the first time a pad player holds a wall the line reads: " + LINES_PAD.wall[0], wallOk);
  const fw = await frame(page);
  await press(0, 2);
  s = await st(page); e = await ev(page, fw);
  const onWall = await page.evaluate(() => !!G.P.wall);
  check(!onWall && s.vel.x > 4 && s.vel.y > 3 && has(e, "unclimb"), "A on a wall jumps off it (6 m/s out and up)", { vel: s.vel, e });
  // the left stick climbs and goes along the wall; the pad wall line comes the first time you hold a wall
  await R();
  await page.evaluate(() => { __f.flyIn(); });
  await page.evaluate(() => { __f.axis(1, -1); });
  const y0 = (await st(page)).pos.y;
  await page.evaluate(() => { __f.step(30); });
  const y1 = (await st(page)).pos.y;
  check(Math.abs(y1 - y0 - 3) < 0.3, "the left stick up climbs the wall: 6 m/s, 3 m in 0.5 s (" + (y1 - y0).toFixed(2) + ")", { y0, y1 });
  await page.evaluate(() => { __f.axis(1, 0); __f.axis(0, 1); });
  const z0 = (await st(page)).pos.z;
  await page.evaluate(() => { __f.step(30); });
  const z1 = (await st(page)).pos.z;
  check(Math.abs(Math.abs(z1 - z0) - 3) < 0.4, "the left stick to the right goes along the wall 3 m in 0.5 s (" + Math.abs(z1 - z0).toFixed(2) + " m)", { z0, z1 });
  await page.evaluate(() => { __f.axis(0, 0); });
  // sticks: the radial dead zone, the diagonal, the look curve and the look rate
  await R();
  await page.evaluate(() => { __f.axis(0, 0.1); __f.axis(1, -0.1); __f.step(2); });
  let inp = await page.evaluate(() => G.test.input());
  check(inp.move.x === 0 && inp.move.y === 0, "the left stick at (0.1, 0.1) is inside the dead zone: the move input is zero", inp.move);
  await page.evaluate(() => { __f.axis(0, 0.14); __f.axis(1, -0.9); __f.step(2); });
  inp = await page.evaluate(() => G.test.input());
  const ang = Math.atan2(inp.move.x, inp.move.y) / DEG;
  check(Math.abs(ang - 8.84) < 1 && inp.move.y > 0.5, "the left stick at (0.14, 0.9) keeps its angle of 8.8 degrees from straight ahead (" + ang.toFixed(2) + ")", inp.move);
  await page.evaluate(() => { __f.axis(0, 0); __f.axis(1, 0); __f.step(3); });
  await page.evaluate(() => { __f.axis(2, 0.5); __f.step(1); });
  inp = await page.evaluate(() => G.test.input());
  const want1 = PAD.lookRate * Math.pow((0.5 - PAD.dead) / (1 - PAD.dead), PAD.curve) / 60;
  check(Math.abs(Math.abs(inp.turn) - want1) / want1 < 0.01, "the right stick at 0.5 turns PAD.lookRate times ((0.5 - dead) / (1 - dead)) ^ curve (" + Math.abs(inp.turn).toFixed(5) + " rad a frame, want " + want1.toFixed(5) + ")", { turn: inp.turn, want1 });
  await page.evaluate(() => { __f.axis(2, 0); __f.step(2); });
  const yaw0 = await page.evaluate(() => G.test.flat().yaw);
  await page.evaluate(() => { __f.axis(2, 1); __f.step(30); __f.axis(2, 0); __f.step(2); });
  const yaw1 = await page.evaluate(() => G.test.flat().yaw);
  const turnd = Math.abs(wrapA(yaw1 - yaw0)), wantT = PAD.lookRate * 0.5;
  check(Math.abs(turnd - wantT) / wantT < 0.01, "the right stick fully right for 0.5 s turns the view by PAD.lookRate times 0.5 (" + turnd.toFixed(4) + " rad, want " + wantT.toFixed(4) + ")", { turnd, wantT });
  // Y switches the view once, a held Y does not switch it again; Start pauses and resumes
  await R();
  await page.evaluate(() => { __f.btn(3, 1); __f.step(20); });
  let fp = await page.evaluate(() => G.test.flat().firstPerson);
  await page.evaluate(() => { __f.btn(3, 0); __f.step(30); });
  check(fp === true, "Y switches to first person once, and a held Y does not switch it back", fp);
  await page.evaluate(() => { __f.btn(3, 1); __f.step(3); __f.btn(3, 0); __f.step(60); });
  fp = await page.evaluate(() => G.test.flat().firstPerson);
  check(fp === false, "Y again returns to third person");
  // the phone's VIEW button reaches the game as mobile.sample().view. A computer has the stub, which has no button: a stand-in sample
  // says it for one frame here, and the title checks below press the real VIEW button of the phone panel
  await R();
  const vw = await page.evaluate(() => {
    const m = G.desktop.mobile, orig = m.sample; let on = true;
    m.sample = (dt) => Object.assign({}, orig.call(m, dt), { view: on });
    __f.step(1);
    const down = G.test.input().viewDown, fp1 = G.test.flat().firstPerson;
    on = false; __f.step(30);
    const fp2 = G.test.flat().firstPerson, down2 = G.test.input().viewDown;
    m.sample = orig;
    return { down, fp1, fp2, down2 };
  });
  check(vw.down && vw.fp1 === true && vw.fp2 === true && vw.down2 === false, "a view edge from mobile.sample() is viewDown for that one frame and switches the view once", vw);
  await page.evaluate(() => { __f.btn(9, 1); __f.step(2); __f.btn(9, 0); __f.step(3); });
  let ui = await page.evaluate(() => ({ state: G.state, open: document.querySelector("#fsMenu").open }));
  check(ui.state === "paused" && ui.open, "Start opens the pause menu", ui);
  await page.evaluate(() => { __f.btn(9, 1); __f.step(2); __f.btn(9, 0); __f.step(3); });
  ui = await page.evaluate(() => ({ state: G.state, open: document.querySelector("#fsMenu").open }));
  check(ui.state === "play" && !ui.open, "Start again closes it and play goes on", ui);
  // rumble: a yank (0.4 for 40 ms), and no error when the pad has no actuator
  await R();
  await page.evaluate(() => { __f.btn(7, 1); __f.step(36); window.__rumble = []; __f.btn(5, 1); __f.step(2); __f.btn(5, 0); __f.step(5); });
  const rum = await page.evaluate(() => window.__rumble);
  check(rum.some((x) => x.type === "dual-rumble" && near(x.strongMagnitude, PAD.rumble.yank[0], 1e-9) && near(x.duration, PAD.rumble.yank[1], 1e-9)), "a yank rumbles the pad: 0.4 for 40 ms", rum.slice(0, 3));
  await page.evaluate(() => { __f.btn(7, 0); __f.step(3); });
  await R();
  await page.evaluate(() => { window.__pad.vibrationActuator = undefined; __f.btn(7, 1); __f.step(36); __f.btn(7, 0); __f.step(3); });
  check(page.errors.length === 0, "a pad with no actuator causes no error", page.errors);
  await page.evaluate(() => { window.__pad.vibrationActuator = { playEffect() { return Promise.resolve("complete"); } }; });
  // the pad words follow the kind: a key press brings the mouse words back
  await page.evaluate(() => { __f.btn(1, 1); __f.step(2); __f.btn(1, 0); __f.step(2); });
  const words = await page.evaluate(() => ({ pad: G.ui.sayLine("tutorial", 3), kind: G.test.input().kind, strip: document.querySelector("#keyHints") && document.querySelector("#keyHints").textContent }));
  check(words.kind === "pad" && words.pad === LINES_PAD.tutorial[3] && /RIGHT TRIGGER/.test(words.strip || "") && /RIGHT STICK/.test(words.strip || "") && /LEFT STICK/.test(words.strip || ""), "with the pad in use the tutorial lines come from LINES_PAD and the key strip names the right trigger, the right stick and the left stick", words);
  const padFirst = await page.evaluate(() => G.ui.sayLine("tutorial", 0));
  check(padFirst === "Look at the gold ring. Hold the left stick up and the right trigger.", "the first pad line tells the player to hold the left stick up and the right trigger", padFirst);
  await page.evaluate(() => { __f.padOff(); window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyJ" })); __f.step(3); });
  const back = await page.evaluate(() => ({ kind: G.test.input().kind, say: G.ui.sayLine("tutorial", 3), strip: document.querySelector("#keyHints").textContent }));
  const mouseFirst = await page.evaluate(() => G.ui.sayLine("tutorial", 0));
  check(back.kind === "mouse" && back.say === LINES_DESKTOP.tutorial[3] && /LEFT MOUSE/.test(back.strip) && /W AND LEFT MOUSE/.test(back.strip), "a key press brings the mouse words back", back);
  check(mouseFirst === "Look at the gold ring. Hold W and the left mouse button.", "the first mouse line tells the player to hold W and the left mouse button", mouseFirst);
  // a pad whose mapping is not standard is ignored
  await R();
  await page.evaluate(() => { __f.padOff(); window.__pad.mapping = ""; __f.btn(7, 1); __f.btn(1, 1); __f.step(40); });
  s = await st(page);
  k = await page.evaluate(() => G.test.input().kind);
  check(s.ropes.every((r) => r.state === "idle") && k === "mouse", "a pad with no standard mapping is ignored: no action fires and the kind stays mouse", { k, ropes: s.ropes.map((r) => r.state) });
  await page.evaluate(() => { __f.padOff(); window.__pad.mapping = "standard"; });
  check(page.errors.length === 0, "no page errors with the pad", page.errors);
  await page.context().close();
}

/* ================= the lock-on ring, its arrow, the cue and the key strip ================= */
async function markerAt(width, height) {
  const tag = width + "x" + height;
  const page = await playPage(width, height);
  await lock(page);
  const R = async () => { await page.evaluate(() => { __f.padOff(); __f.roof(); }); };
  await R();
  // the strip, the spoken line, its tail and the score pills: nothing overlaps
  await page.evaluate((line) => { G.ui.say(line, 60); G.ui.toast("+5"); __f.step(2); }, LINES_DESKTOP.tutorial[0]);
  const lay = await page.evaluate(() => {
    const sub = __f.rect(".fs-sub"), strip = __f.rect("#keyHints"), toast = __f.rect(".fs-toast"), pills = [...document.querySelectorAll(".fs-top .fs-pill")].filter((p) => p.getBoundingClientRect().width > 0).map((p) => { const r = p.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    const tip = sub ? { x: sub.l + sub.w * 0.2, y: sub.b + 27 } : null; // the tail of the speech bubble hangs 27 px under its box
    const hints = document.querySelector("#keyHints");
    return { sub, strip, toast, pills, tip, text: hints.textContent, clipped: hints.scrollWidth > hints.clientWidth + 1, shown: __f.vis("#keyHints"), body: document.body.classList.contains("keyhints") };
  });
  const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  check(lay.shown && lay.body && lay.strip.h <= 36.5 && lay.strip.w <= width * 0.96 + 1, "[" + tag + "] the key strip shows at the bottom, at most 36 px high (" + (lay.strip && lay.strip.h.toFixed(0)) + " px)", lay.strip);
  check(/HOLD W AND LEFT MOUSE \(OR E\): SWING\./.test(lay.text) && /LET GO WHEN THE RING SAYS GO\./.test(lay.text) && /MOUSE: LOOK\./.test(lay.text), "[" + tag + "] it reads HOLD W AND LEFT MOUSE (OR E): SWING. LET GO WHEN THE RING SAYS GO. MOUSE: LOOK.", lay.text);
  check(!lay.clipped, "[" + tag + "] the text of the strip is not cut off (it fits inside the strip)", { clipped: lay.clipped, w: lay.strip.w });
  const tailBox = { l: lay.tip.x - 14, r: lay.tip.x + 14, t: lay.sub.b, b: lay.tip.y };
  check(!hit(lay.strip, lay.sub) && !hit(lay.strip, tailBox) && (!lay.toast || lay.toast.w === 0 || !hit(lay.strip, lay.toast)) && lay.pills.every((p) => !hit(lay.strip, { l: p.l, r: p.r, t: p.t, b: p.b })), "[" + tag + "] the strip does not overlap the spoken line, its tail, the toast or the score pills", { strip: lay.strip, sub: lay.sub, tip: lay.tip });
  await render(page); await shot(page, "flat-strip-" + tag);
  // the arrow at the start roof: the target (the ring) is above the top edge
  // (the marker reads the HUD at most 10 times a second in real time, and 30 frames can run in less than that: let it see the line gone
  // and the pills as they are now, as the checks below do)
  await page.evaluate(() => { G.ui.say("", 0); __f.step(3); });
  await sleep(160);
  await page.evaluate(() => { __f.step(30); });
  let t = await tgt(page);
  let box = await page.evaluate(() => ({ ring: __f.vis("#lockRing"), arrow: __f.vis("#lockArrow"), a: __f.rect("#lockArrow"), top: __f.rect(".fs-top"), cls: document.querySelector("#lockArrow").className }));
  check(t.target && t.target.kind === "ring" && t.ndc.y > 1 && box.arrow && !box.ring, "[" + tag + "] at the start roof the ring is above the top edge (NDC y " + t.ndc.y.toFixed(2) + "): the marker is an arrow, not a ring", { ndc: t.ndc, box });
  check(box.a.t >= box.top.b + 8 - 1 && box.a.l >= 0 && box.a.r <= width && box.a.b <= height, "[" + tag + "] the arrow sits on the top border of the safe window, below the score pills", { a: box.a, topB: box.top.b });
  const dirOk = await page.evaluate(() => {
    const t = G.test.target(), a = __f.rect("#lockArrow"), p = __f.px(t.ndc), cx = innerWidth / 2, cy = innerHeight / 2;
    const m = new DOMMatrix(getComputedStyle(document.querySelector("#lockArrow")).transform);
    const rot = Math.atan2(m.b, m.a) * 180 / Math.PI, want = Math.atan2(p.x - cx, -(p.y - cy)) * 180 / Math.PI;
    return { rot, want, side: Math.sign(a.cx - cx) === Math.sign(p.x - cx) || Math.abs(a.cx - cx) < 8 };
  });
  check(Math.abs(wrapA((dirOk.rot - dirOk.want) * DEG)) / DEG < 8 && dirOk.side, "[" + tag + "] the arrow points at the target and sits on its side", dirOk);
  await render(page); await shot(page, "flat-arrow-" + tag);
  // look up: the target comes into the safe window and the ring takes the arrow's place
  let ringOk = null;
  const tries = [];
  for (const up of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    await R();
    // no spoken line: on a small window it leaves the safe window only a thin band (the sweep below runs with a line)
    // (the marker reads the HUD at most 10 times a second in real time: let it see the line gone)
    await page.evaluate(() => { G.ui.say("", 0); __f.step(3); });
    await sleep(160);
    await page.evaluate((u) => { G.test.look(0, u); __f.step(40); }, up);
    box = await page.evaluate(() => ({ ring: __f.vis("#lockRing"), r: __f.rect("#lockRing"), t: G.test.target(), sub: __f.vis(".fs-sub.on"), pitch: G.test.flat().pitch, arrow: __f.vis("#lockArrow") }));
    tries.push({ up, pitch: +box.pitch.toFixed(2), ndcY: box.t.ndc && +box.t.ndc.y.toFixed(2), ring: box.ring, arrow: box.arrow, sub: box.sub });
    if (box.ring) { ringOk = box; break; }
  }
  check(!!ringOk && ringOk.t.target, "[" + tag + "] with the view lifted the ring shows on the target", tries);
  if (ringOk) {
    const p = await page.evaluate(() => { const t = G.test.target(), px = __f.px(t.ndc), rets = G.ropes.info().reticles.filter((r) => r.visible).map((r) => __f.toScreen({ x: r.pos[0], y: r.pos[1], z: r.pos[2] })); return { px, rets, ring: __f.rect("#lockRing") }; });
    const d = Math.hypot(p.ring.cx - p.px.x, p.ring.cy - p.px.y);
    check(near(p.ring.w, 44, 1.5) && d <= 3, "[" + tag + "] the lock-on ring is 44 px across and its centre is within 3 px of the target on the screen (" + d.toFixed(1) + " px)", { w: p.ring.w, d });
    check(p.rets.length >= 1 && p.rets.every((r) => Math.hypot(r.x - p.ring.cx, r.y - p.ring.cy) <= 3), "[" + tag + "] the world reticle of rope.js sits on the same point (" + p.rets.map((r) => Math.hypot(r.x - p.ring.cx, r.y - p.ring.cy).toFixed(1)).join(", ") + " px)", p);
    await render(page); await shot(page, "flat-ring-" + tag);
  }
  // a swing in the air: the ring still marks the next target while a rope holds, and it hides when both ropes are out
  await R();
  await page.evaluate(() => { G.test.look(0, 0.4); __f.step(30); });
  await page.mouse.down(); await step(page, 40);
  const mid1 = await page.evaluate(() => ({ t: G.test.target(), ropes: G.test.state().ropes.map((r) => r.state), vis: __f.vis("#lockRing") || __f.vis("#lockArrow") }));
  check(mid1.ropes.filter((s) => s === "attached").length === 1 && (!mid1.t.target || mid1.t.target.bid !== mid1.t.avoid), "[" + tag + "] with one rope attached the marker is the next building, not the one the rope holds", { avoid: mid1.t.avoid, target: mid1.t.target && mid1.t.target.bid });
  await page.mouse.down({ button: "right" }); await step(page, 40);
  const mid2 = await page.evaluate(() => ({ ropes: G.test.state().ropes.map((r) => r.state), vis: __f.vis("#lockRing"), arrow: __f.vis("#lockArrow") }));
  check(mid2.ropes.every((s) => s === "attached") && !mid2.vis && !mid2.arrow, "[" + tag + "] with both ropes out no marker shows", mid2);
  await page.mouse.up({ button: "right" }); await page.mouse.up(); await step(page, 3);
  // the safe window: a marker anywhere on or off the screen stays clear of the score pills, the spoken line and the strip
  await R();
  await page.evaluate(() => { G.ui.say("Swing out. Let go when the ring says GO.", 60); __f.step(3); });
  await sleep(160); // the marker reads the HUD at most 10 times a second in real time
  const sweep = await page.evaluate(() => {
    const hit = (a, b) => a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const pills = [...document.querySelectorAll(".fs-top .fs-pill")].map((p) => { const r = p.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }).filter((r) => r.r > r.l);
    const others = [__f.rect(".fs-sub") && (({ l, t, r, b }) => ({ l, t, r, b }))(__f.rect(".fs-sub")), __f.rect("#keyHints") && (({ l, t, r, b }) => ({ l, t, r, b }))(__f.rect("#keyHints"))].filter(Boolean).concat(pills);
    const bad = []; let n = 0, rings = 0, arrows = 0;
    for (let y = 0.3; y <= 1.501; y += 0.1) for (let x = -1.5; x <= 1.501; x += 0.3) {
      G.desktop.marker({ x, y, kind: "swing", dist: 30, behind: false, go: false });
      const ring = __f.vis("#lockRing") ? __f.rect("#lockRing") : null, arrow = __f.vis("#lockArrow") ? __f.rect("#lockArrow") : null;
      const b = ring || arrow; n++;
      if (ring) rings++; if (arrow) arrows++;
      if (!b) { bad.push({ x, y, none: true }); continue; }
      const box = { l: b.l, t: b.t, r: b.r, b: b.b };
      if (others.some((o) => hit(box, o)) || box.l < 0 || box.t < 0 || box.r > innerWidth || box.b > innerHeight) bad.push({ x: +x.toFixed(1), y: +y.toFixed(1), box, ring: !!ring });
    }
    G.desktop.marker({ x: 0.5, y: -1.5, kind: "swing", dist: 30, behind: true, go: false });
    const behind = __f.vis("#lockArrow") ? __f.rect("#lockArrow") : null;
    // the height of the safe window (32 px from the edges and from the HUD, at least 40 px: see desktop.js)
    const top = __f.rect(".fs-top"), sub = __f.rect(".fs-sub"), strip = __f.rect("#keyHints");
    const t0 = Math.max(32, top ? top.b + 32 : 0);
    let b0 = innerHeight - 32;
    if (sub) b0 = Math.min(b0, sub.t - 32);
    if (strip) b0 = Math.min(b0, strip.t - 32);
    return { n, rings, arrows, bad: bad.slice(0, 4), nbad: bad.length, behind, h: innerHeight, winH: Math.max(40, b0 - t0) };
  });
  // a window under 80 px high (a 640 by 360 screen with the pills in two rows and a spoken line) may show arrows only
  check(sweep.nbad === 0 && (sweep.winH < 80 || sweep.rings > 5) && sweep.arrows > 20, "[" + tag + "] a marker at every NDC y from 0.3 to 1.5 and x from -1.5 to 1.5 stays clear of the score pills, the spoken line and the strip (" + sweep.n + " places: " + sweep.rings + " rings, " + sweep.arrows + " arrows, window " + Math.round(sweep.winH) + " px high)", sweep.bad);
  check(sweep.behind && sweep.behind.b >= sweep.h * 0.4, "[" + tag + "] a target behind the camera shows its arrow on the bottom border", sweep.behind);
  check(page.errors.length === 0, "[" + tag + "] no page errors", page.errors);
  await page.context().close();
}
async function markerExtra() {
  // the pop (and reduced motion), and the LET GO cue, on one page
  const page = await playPage(960, 540);
  await lock(page);
  await page.evaluate(() => { __f.roof(); G.test.look(0, 0.45); __f.step(40); });
  const ring = await page.evaluate(() => __f.vis("#lockRing"));
  check(ring, "(the ring shows for the pop check)");
  const pop = await page.evaluate(async () => {
    const r = document.querySelector("#lockRing"), svg = r.querySelector("svg");
    svg.style.transition = "none";
    G.desktop.pop();
    const during = { cls: r.classList.contains("pop"), scale: new DOMMatrix(getComputedStyle(svg).transform).a };
    await new Promise((res) => setTimeout(res, 220));
    const after = { cls: r.classList.contains("pop"), scale: new DOMMatrix(getComputedStyle(svg).transform).a };
    return { during, after };
  });
  check(pop.during.cls && near(pop.during.scale, 1.4, 0.01) && !pop.after.cls && near(pop.after.scale, 1, 0.01), "the catch pop grows the ring to 1.4 times for 120 ms and returns", pop);
  const attachPop = await page.evaluate(async () => {
    const r = document.querySelector("#lockRing"); let seen = false;
    const mo = new MutationObserver(() => { if (r.classList.contains("pop")) seen = true; }); mo.observe(r, { attributes: true, attributeFilter: ["class"] });
    document.querySelector("#view canvas").dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })); __f.step(40);
    await new Promise((res) => setTimeout(res, 50)); mo.disconnect();
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 })); __f.step(3);
    return seen;
  });
  check(attachPop, "a real attach pops the ring");
  // the cue: a swing past the bottom of the arc shows LET GO and pulses the ring (the rope was held from the roof, with W)
  await page.evaluate(() => { __f.roof(); G.test.look(0, 0.3); __f.step(20); });
  await page.keyboard.down("KeyW");
  await page.mouse.move(480, 270); await page.mouse.down();
  let cue = null;
  for (let i = 0; i < 80 && !(cue && cue.on); i++) {
    cue = await page.evaluate(() => { __f.step(15); const t = G.test.target(); return { on: t.cue, shown: __f.vis("#lockCue"), text: document.querySelector("#lockCue").textContent, go: document.querySelector("#lockRing").classList.contains("go") || document.querySelector("#lockArrow").classList.contains("go"), air: !G.P.onGround, rope: G.test.state().ropes.some((r) => r.state === "attached") }; });
  }
  check(cue && cue.on && cue.shown && cue.text === "LET GO" && cue.go, "past the bottom of the arc the caption reads LET GO and the marker pulses", cue);
  await render(page); await shot(page, "flat-letgo");
  const off = await page.evaluate(() => { G.settings.cue = false; __f.step(2); return { shown: __f.vis("#lockCue"), on: G.test.target().cue }; });
  check(!off.shown && !off.on, "with the Release cue setting Off no cue shows", off);
  await page.evaluate(() => { G.settings.cue = true; __f.step(2); });
  await page.keyboard.up("KeyW"); await page.mouse.up();
  await page.evaluate(() => __f.step(3));
  // dragged along a roof for 0.6 s with the rope attached
  await page.evaluate(() => { __f.roof(); });
  await page.mouse.down(); await step(page, 36);
  const noCue = await page.evaluate(() => ({ on: G.test.target().cue, ropes: G.test.state().ropes.map((r) => r.state), ground: G.P.onGround }));
  await step(page, 50);
  const dragCue = await page.evaluate(() => ({ on: G.test.target().cue, shown: __f.vis("#lockCue"), ground: G.P.onGround, ropes: G.test.state().ropes.map((r) => r.state) }));
  check(dragCue.ground && dragCue.on && dragCue.shown, "dragged along a roof with the rope attached for 0.5 s the cue shows (the body on the roof, the rope held)", { noCue, dragCue });
  await page.mouse.up(); await step(page, 3);
  // the release cue never shows on a clog
  const atClog = await page.evaluate(() => __f.atClog(0) || __f.atClog(1) || __f.atClog(2) || __f.atClog(3));
  if (atClog) {
    await page.mouse.down(); await step(page, 100);
    const cc = await page.evaluate(() => ({ kind: G.test.target().target && G.test.target().target.kind, cue: G.test.target().cue, shown: __f.vis("#lockCue"), tag: G.test.state().ropes.map((r) => r.tag) }));
    check(cc.tag.includes("clog") && !cc.cue && !cc.shown, "a rope on a clog never gives the LET GO cue", cc);
    await render(page); await shot(page, "flat-clog-ring");
    await page.mouse.up(); await step(page, 3);
  }
  check(page.errors.length === 0, "no page errors in the pop and cue checks", page.errors);
  await page.context().close();
  // reduced motion: the ring does not change size, and flips to its brighter colour
  const page2 = await newPage({ width: 960, height: 540 });
  await page2.emulateMedia({ reducedMotion: "reduce" });
  await page2.addInitScript(FAKE);
  await page2.addInitScript(NOLOCK);
  await open(page2, "nosw&skipintro");
  await enterXR(page2, "desktop");
  await waitState(page2, { mode: "desktop", state: "play" }, 240000);
  await page2.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); __f.roof(); G.test.look(0, 0.45); __f.step(40); });
  const rp = await page2.evaluate(async () => {
    const r = document.querySelector("#lockRing"), svg = r.querySelector("svg");
    if (!__f.vis("#lockRing")) return null;
    G.desktop.pop();
    const cs = getComputedStyle(svg);
    return { cls: r.classList.contains("pop") && r.classList.contains("still"), scale: new DOMMatrix(cs.transform).a, filter: cs.filter };
  });
  check(rp && rp.cls && near(rp.scale, 1, 0.01) && /brightness/.test(rp.filter), "under reduced motion the ring does not change size and flips to its brighter colour", rp);
  await page2.context().close();
}
async function stripGone() {
  // the strip is gone after a minute of play, and for a returning player; it hides in a pause
  const page = await playPage(960, 540);
  await lock(page);
  const shown = () => page.evaluate(() => __f.vis("#keyHints"));
  const first = await page.evaluate(() => ({ shown: __f.vis("#keyHints"), tut: G.save.tutorial }));
  check(first.shown && first.tut === false, "a first run (the tutorial is not finished) shows the strip", first);
  await page.evaluate(() => { G.ui.openPause(); __f.step(3); });
  check(!(await shown()), "the strip hides in a pause");
  await page.evaluate(() => { G.ui.closePause(); __f.step(3); });
  check(await shown(), "and it is back after the pause");
  await page.evaluate(() => { __f.step(58, 1); });
  check(await shown(), "58 s of play time in, the strip still shows");
  await page.evaluate(() => { __f.step(4, 1); });
  check(!(await shown()), "62 s of play time in, the strip is gone");
  await page.context().close();
  const page2 = await playPage(960, 540, { init: () => { try { localStorage.setItem("plungerd.vr.v1", JSON.stringify({ v: 1, intro: true, tutorial: true, clogs: [], loonies: [], bonus: 0, king: "sleeping", pipes: [], best: {}, settings: {} })); } catch (e) { /* storage off */ } } });
  await lock(page2);
  const ret = await page2.evaluate(() => ({ tut: G.save.tutorial, shown: __f.vis("#keyHints"), ring: __f.vis("#lockRing") || __f.vis("#lockArrow") }));
  check(ret.tut === true && !ret.shown && ret.ring, "a returning player (the tutorial finished in the save) sees no strip, and the marker still shows", ret);
  await page2.context().close();
}

/* ================= the camera: the lift, the turn from a wall ================= */
async function cameraPart() {
  const page = await playPage(960, 540);
  await lock(page);
  const R = async () => { await page.evaluate(() => { __f.padOff(); __f.roof(); }); };
  // the lift: a swing with no look input raises the pitch
  await page.mouse.move(480, 270); // a mouse move is a look input: it goes before the reset, not into the swing
  await R();
  await page.keyboard.down("KeyW"); await page.mouse.down();
  const rise = await page.evaluate(() => { const out = []; for (let i = 0; i < 6; i++) { __f.step(15); out.push(G.test.flat()); } return out.map((f) => ({ pitch: +f.pitch.toFixed(3), lifting: f.lifting, hold: +f.hold.toFixed(2) })); });
  const maxP = Math.max(...rise.map((r) => r.pitch));
  check(maxP >= 0.12, "a swing with no look input raises the pitch from -0.27 to at least +0.12 rad within 1.5 s (" + maxP + ")", rise);
  check(rise.every((r, i) => i === 0 || r.pitch >= rise[i - 1].pitch - 1e-6), "the lift only raises the pitch (it never lowers)", rise.map((r) => r.pitch));
  // never lowers: a high pitch stays
  const hi = await page.evaluate(() => { G.flatcam.setPitch(0.52); __f.step(30); return G.test.flat().pitch; });
  check(hi >= 0.52 - 1e-6, "with the pitch at +30 degrees the lift leaves it there (" + hi.toFixed(3) + ")", hi);
  // a look input pauses the lift for 0.7 s
  const look = await page.evaluate(() => { G.flatcam.setPitch(-0.1); G.test.look(0, 0); G.test.look(0.01, 0); __f.step(1); const p0 = G.test.flat().pitch; __f.step(36); const p1 = G.test.flat(); __f.step(40); const p2 = G.test.flat(); return { p0, p1: p1.pitch, l1: p1.lifting, p2: p2.pitch, l2: p2.lifting }; });
  check(look.p1 - look.p0 < 0.02 && look.p2 > look.p1 + 0.03, "after a look input the lift waits 0.7 s (pitch " + look.p0.toFixed(3) + " then " + look.p1.toFixed(3) + "), then raises the pitch again (" + look.p2.toFixed(3) + ")", look);
  await page.keyboard.up("KeyW"); await page.mouse.up(); await step(page, 3);
  // the follow turn still runs with the lift on: a rope held at 20 m/s heading west turns the view toward the heading with no look input
  const turn = await page.evaluate(() => {
    const s = G.city.start; G.test.teleport(s.x, s.y + 60, s.z); G.P.onGround = false; G.P.vel.x = -20; G.P.vel.y = 0; G.P.vel.z = 0;
    G.rigYaw = 0; G.flatcam.reset(0); __f.step(2);
    const T = G.test.target().target; if (!T) return null;
    G.test.aimAt(0, T.x, T.y, T.z); G.test.press(0, true);
    const y0 = G.test.flat().yaw; let following = 0, lifting = 0;
    for (let i = 0; i < 150; i++) { __f.step(1); const f = G.test.flat(); if (f.following) following++; if (f.lifting) lifting++; }
    const f = G.test.flat();
    G.test.press(0, false); G.test.aimAt(0, null); __f.step(3);
    return { turned: Math.abs(Math.atan2(Math.sin(f.yaw - y0), Math.cos(f.yaw - y0))), following, lifting, pitch: f.pitch };
  });
  check(turn && turn.following >= 20 && turn.turned > 0.3, "with a rope held and no look input the follow turn runs (" + (turn && turn.following) + " frames) and turns the view by " + (turn && turn.turned.toFixed(2)) + " rad, while the lift runs too (" + (turn && turn.lifting) + " frames)", turn);
  // a clog 20 m below stays the target through a 3 s swing, and the lift does not pull it off the screen
  let clog = null;
  for (let id = 0; id < 12 && !clog; id++) {
    const spot = await page.evaluate(({ id }) => {
      const C = G.city, c = C.clogs[id], T = { x: c.x, y: c.y + 1.9 * 1.35, z: c.z };
      for (let a = 0; a < 16; a++) for (const d of [12, 16]) {
        const x = c.x + Math.cos((a / 16) * Math.PI * 2) * d, z = c.z + Math.sin((a / 16) * Math.PI * 2) * d, y = c.y + 20;
        if (C.collideSphere(x, y + 1.25, z, 0.6) || C.collideSphere(x, y + 1.65, z, 0.4)) continue;
        const dx = T.x - x, dy = T.y - (y + 1.65), dz = T.z - z, l = Math.hypot(dx, dy, dz);
        if (C.raycast(x, y + 1.65, z, dx, dy, dz, l - 0.6, {})) continue;
        return { x, y, z, T };
      }
      return null;
    }, { id });
    if (spot) clog = { id, spot };
  }
  if (clog) {
    const r = await page.evaluate(({ spot }) => {
      G.test.teleport(spot.x, spot.y, spot.z); G.P.onGround = false;
      const T = spot.T, dx = T.x - spot.x, dz = T.z - spot.z, yaw = Math.atan2(-dx, -dz);
      G.rigYaw = yaw; G.flatcam.reset(yaw, -0.3); G.P.vel.x = G.P.vel.y = G.P.vel.z = 0; __f.step(3);
      // point the camera itself at the bowl (it sits behind and above the hero): a few corrections
      for (let k = 0; k < 4; k++) {
        const c = G.camera.position, f = new c.constructor(0, 0, -1).applyQuaternion(G.camera.quaternion), ex = T.x - c.x, ey = T.y - c.y, ez = T.z - c.z;
        G.flatcam.setPitch(G.flatcam.pitch + (Math.asin(ey / Math.hypot(ex, ey, ez)) - Math.asin(f.y))); G.P.vel.y = 0; __f.step(5);
      }
      return G.test.flat().pitch;
    }, clog);
    const p0 = r;
    await page.mouse.down();
    // the real fall of 20 m takes 2 s, so the body is held in place: the 3 s are about the picker and the camera, which is the point
    const run = await page.evaluate(({ spot }) => {
      const out = [];
      for (let i = 0; i < 6; i++) {
        for (let k = 0; k < 30; k++) { G.P.vel.x = G.P.vel.y = G.P.vel.z = 0; G.P.pos.y = spot.y; __f.step(1); }
        const t = G.test.target();
        out.push({ kind: t.target && t.target.kind, pitch: G.test.flat().pitch, rope: G.test.state().ropes.map((q) => q.tag) });
      }
      return out;
    }, clog);
    await page.mouse.up(); await step(page, 3);
    check(run.every((q) => q.kind === "clog") && Math.max(...run.map((q) => q.pitch)) < p0 + 0.02, "a clog 20 m below stays the target through a 3 s swing, and the view does not lift off it (pitch " + p0.toFixed(2) + " to " + Math.max(...run.map((q) => q.pitch)).toFixed(2) + ")", run);
  } else log("no spot 20 m over a clog: skipped");
  // a cling, a swing off the wall, the view turns toward the swing
  const B = await page.evaluate(() => __f.wall());
  const held = await page.evaluate(() => __f.flyIn());
  check(!!B && held, "a one-box tower with a clear street face lets the hero cling to it (the set-up for the wall checks)", { B, held });
  const wallInfo = await page.evaluate(() => { __f.step(3); const t = G.test.target(); return { t, yaw: G.test.flat().yaw, on: t.on, behind: t.behind, ndc: t.ndc, arrow: __f.vis("#lockArrow"), arrowRect: __f.rect("#lockArrow"), h: innerHeight, cls: document.querySelector("#lockArrow").className }; });
  check(wallInfo.t.target && wallInfo.t.behind && wallInfo.arrow && wallInfo.arrowRect.b >= wallInfo.h * 0.5, "on a wall with the view into it the target is behind the camera and the marker is an arrow on the bottom border", { behind: wallInfo.t.behind, arrow: wallInfo.arrow, rect: wallInfo.arrowRect });
  await render(page); await shot(page, "flat-wall-arrow");
  await page.mouse.down();
  const tw = await page.evaluate(() => { const T = G.test.target().target; __f.step(2); const y = []; for (let i = 0; i < 40; i++) { __f.step(1); y.push(G.test.flat().yaw); } return { T, y, p: { x: G.P.pos.x, z: G.P.pos.z }, wall: !!G.P.wall, ropes: G.test.state().ropes.map((q) => q.state) }; });
  const bearing = Math.atan2(-(tw.T.x - tw.p.x), -(tw.T.z - tw.p.z));
  const gap = (i) => Math.abs(wrapA(tw.y[i] - bearing)) / DEG;
  check(!tw.wall && gap(30) <= 20, "a swing from a wall turns the view: 0.5 s later the camera yaw is within 20 degrees of the bearing of the target (" + gap(30).toFixed(1) + " degrees)", { gap30: gap(30), gap0: gap(0), bearing });
  const after = await page.evaluate(() => { __f.step(5); const t = G.test.target(); return { onScreen: t.inView, behind: t.behind, arrow: __f.vis("#lockArrow"), ring: __f.vis("#lockRing") }; });
  check(after.onScreen || after.arrow || after.ring, "and the marker is on the screen or shows an arrow on its border", after);
  await page.mouse.up(); await step(page, 3);
  // first person: a swing from a wall does not turn the view
  await page.evaluate(() => { __f.flyIn(); G.flatcam.setFirstPerson(true); __f.step(40); });
  const fpYaw0 = await page.evaluate(() => G.test.flat().yaw);
  await page.mouse.down(); await step(page, 30);
  const fpYaw1 = await page.evaluate(() => G.test.flat().yaw);
  check(Math.abs(wrapA(fpYaw1 - fpYaw0)) < 0.05, "in first person a swing from a wall does not turn the view", { fpYaw0, fpYaw1 });
  await page.mouse.up(); await step(page, 3);
  check(page.errors.length === 0, "no page errors in the camera checks", page.errors);
  await page.context().close();
}

/* ================= exact aim first in first person, and a picker that finds nothing ================= */
async function exactAim() {
  const page = await playPage(960, 540);
  await lock(page);
  // first person: the crosshair on a building makes that building the target, at the exact point
  const found = await page.evaluate(() => {
    __f.roof(); G.flatcam.setFirstPerson(true); __f.step(40);
    const C = G.city, S = C.start, out = [];
    for (let yaw = -0.6; yaw <= 0.61; yaw += 0.2) for (let pitch = 0.1; pitch <= 0.7; pitch += 0.1) {
      G.rigYaw = S.yaw + yaw; G.flatcam.reset(S.yaw + yaw, pitch); G.flatcam.setFirstPerson(true); __f.step(20);
      const c = G.camera.position, d = new c.constructor(0, 0, -1).applyQuaternion(G.camera.quaternion);
      const h = C.raycast(c.x, c.y, c.z, d.x, d.y, d.z, 400, {});
      if (!h || h.ny > 0.7 || h.collider.tag === "antenna") continue;
      const hd = G.test.state().head, dist = Math.hypot(h.x - hd.x, h.y - hd.y, h.z - hd.z);
      if (dist < 12 || dist > 80 || h.y - (G.P.pos.y + G.P.chest) < 5) continue;
      const t = G.test.target();
      out.push({ yaw, pitch, hit: { x: h.x, y: h.y, z: h.z, id: h.collider.id }, target: t.target, tier: t.tier, dist });
      if (out.length >= 3) return out;
    }
    return out;
  });
  const exact = found.filter((f) => f.target && Math.hypot(f.target.x - f.hit.x, f.target.y - f.hit.y, f.target.z - f.hit.z) < 0.01);
  check(found.length >= 1 && exact.length === found.length && found.every((f) => f.tier === 3), "in first person the point under the crosshair is the target (the exact ray comes first) (" + exact.length + " of " + found.length + " views)", found.slice(0, 2));
  if (found.length) {
    const f = found[0];
    await page.evaluate((f) => { const S = G.city.start; G.rigYaw = S.yaw + f.yaw; G.flatcam.reset(S.yaw + f.yaw, f.pitch); G.flatcam.setFirstPerson(true); __f.step(20); }, f);
    await page.mouse.move(480, 270); await page.mouse.down(); await step(page, 40);
    const s = await st(page), r = s.ropes.find((q) => q.state === "attached");
    check(r && Math.hypot(r.anchor.x - f.hit.x, r.anchor.y - f.hit.y, r.anchor.z - f.hit.z) < 8, "the swing input attaches the rope within 8 m of the crosshair point", { anchor: r && r.anchor, hit: f.hit });
    await page.mouse.up(); await step(page, 3);
  }
  // first person, the crosshair on the roof at the hero's feet: the rope goes to the auto target, a building more than 5 m above the roof
  const roofAim = await page.evaluate(() => {
    __f.roof(); G.flatcam.setFirstPerson(true); G.flatcam.reset(G.city.start.yaw, -0.9); G.flatcam.setFirstPerson(true); __f.step(30);
    const t = G.test.target();
    return { t: t.target, tier: t.tier, y: G.city.start.y };
  });
  check(roofAim.t && roofAim.t.y > roofAim.y + 5 && roofAim.tier !== 3, "first person with the crosshair on the roof at the hero's feet: the target is a building more than 5 m above the roof", roofAim);
  // third person, the camera looks down at the hero: the target is never the roof at the hero's feet
  const down = await page.evaluate(() => { __f.roof(); G.flatcam.reset(G.city.start.yaw, -0.9); __f.step(40); const t = G.test.target(); return { t: t.target, y: G.city.start.y }; });
  check(down.t && down.t.y > down.y + 5, "third person with the camera looking down at the hero: the target is a building, never the roof at the feet", down);
  // a picker that finds nothing: a real roof in view fires nothing, and the line shows once
  await page.evaluate(() => { __f.roof(); });
  const none = await page.evaluate(() => {
    const rc = G.city.raycast; window.__rc = rc; G.city.raycast = () => null;
    __f.step(5);
    const t = G.test.target();
    return { target: t.target, on: t.on };
  });
  check(none.on && none.target === null, "a city that answers no ray gives no target", none);
  const f0 = await frame(page);
  await page.mouse.move(480, 270); await page.mouse.down(); await step(page, 30);
  let s = await st(page), e = await ev(page, f0);
  const line1 = await page.evaluate(() => document.querySelector(".fs-sub").textContent);
  check(s.ropes.every((r) => r.state === "idle") && has(e, "dry") && !has(e, "attach"), "with no target the swing input waits 0.3 s, then dry-fires along the view and no rope attaches", { e, ropes: s.ropes.map((r) => r.state) });
  check(line1 === "No building to swing from here. Face the city, or step off the edge.", "the line reads: No building to swing from here. Face the city, or step off the edge.", line1);
  await page.mouse.up(); await step(page, 3);
  await page.evaluate(() => { G.ui.say("", 0); __f.step(5); });
  await page.evaluate(() => { __f.step(3 * 60); });
  const f1 = await frame(page);
  await page.mouse.down(); await step(page, 30); await page.mouse.up(); await step(page, 3);
  e = await ev(page, f1);
  const line2 = await page.evaluate(() => document.querySelector(".fs-sub").textContent);
  check(has(e, "dry") && line2 !== "No building to swing from here. Face the city, or step off the edge.", "a second press 3 s later shows no new line (at most once every 10 s)", { line2 });
  // a target that shows up within 0.3 s is fired at
  await page.evaluate(() => { __f.step(12, 1); }); // past the 10 s that the line waits
  const f2 = await frame(page);
  await page.mouse.down(); await step(page, 6);
  await page.evaluate(() => { G.city.raycast = window.__rc; __f.step(2); });
  await step(page, 40);
  s = await st(page); e = await ev(page, f2);
  check(has(e, "attach"), "a held press that sees a target within 0.3 s fires at it", { e, ropes: s.ropes.map((r) => r.state) });
  await page.mouse.up(); await step(page, 3);
  check(page.errors.length === 0, "no page errors in the exact aim checks", page.errors);
  await page.context().close();
}

/* ================= the title on a touch device with a fine pointer ================= */
async function titles() {
  const touch = () => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");
  };
  // the title markup is the page's own (#playMouse, #deskNote, #hybridNote, #touchNote, data-label-touch of #playFlat) and mobile.use is
  // the real one: a spy records each call and passes it on, so what the call does is checked on the real phone panel
  const spy = (p) => p.evaluate(() => { const m = G.desktop.mobile, orig = m.use; window.__useCalls = []; m.use = (on) => { window.__useCalls.push(on); return orig.call(m, on); }; });
  const read = (page) => page.evaluate(() => ({ label: document.querySelector("#playFlat").textContent.trim(), labelTouch: document.querySelector("#playFlat").dataset.labelTouch, mouse: __f.vis("#playMouse"), mouseLabel: (document.querySelector("#playMouse") || {}).textContent || null, hybrid: __f.vis("#hybridNote"), desk: __f.vis("#deskNote"), touchNote: __f.vis("#touchNote"), fine: matchMedia("(any-pointer: fine)").matches, device: document.body.dataset.device }));
  const state = (page) => page.evaluate(() => ({ kind: G.test.input().kind, easy: G.input.easySwing, panel: __f.vis("#phoneControls"), enabled: G.desktop.mobile.enabled, device: document.body.dataset.device, useCalls: window.__useCalls || null }));
  const play = async (page) => {
    await page.waitForFunction(() => G.mode === "desktop" && G.state !== "title", null, { timeout: 60000 });
    await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); __f.step(30); });
  };
  // a computer: no touch point
  let page = await playPage(960, 540, { enter: false });
  let t = await read(page);
  check(t.label === "PLAY ON THIS SCREEN" && t.desk && !t.touchNote && !t.hybrid && !t.mouse && t.device === "mouse", "a computer: the title reads PLAY ON THIS SCREEN, shows the desktop note and no mouse button", t);
  await page.context().close();
  // a touch device with a fine pointer: both buttons
  page = await playPage(960, 540, { init: touch, afterLoad: spy, enter: false });
  t = await read(page);
  check(t.fine && t.label === "PLAY WITH TOUCH" && t.labelTouch === "PLAY WITH TOUCH" && t.mouse && t.mouseLabel === "PLAY WITH MOUSE AND KEYBOARD" && t.hybrid && !t.desk && !t.touchNote && t.device === "touch", "a touch device with a fine pointer shows PLAY WITH TOUCH and PLAY WITH MOUSE AND KEYBOARD, and the note for both", t);
  await page.click("#playMouse");
  await play(page);
  let m = await state(page);
  check(m.kind === "mouse" && !m.easy && !m.panel && m.enabled === false && JSON.stringify(m.useCalls) === "[false]", "the mouse button calls mobile.use(false) once and starts the mouse scheme: the kind is mouse, the phone panel is hidden and the phone scheme is off", m);
  const mouseOnly = await page.evaluate(() => { const s = G.desktop.mobile.sample(0.016); return { hold: s.hold, panelHidden: document.querySelector("#phoneControls").hidden }; });
  check(mouseOnly.panelHidden && !mouseOnly.hold, "the phone panel element is hidden after mobile.use(false), and a sample holds nothing", mouseOnly);
  await page.evaluate(() => { __f.btn(1, 1); __f.step(3); __f.btn(1, 0); __f.step(2); });
  m = await page.evaluate(() => ({ kind: G.test.input().kind, device: document.body.dataset.device }));
  check(m.kind === "pad" && m.device === "pad", "a fake pad press moves the kind to pad", m);
  // then back to the title (Exit), and PLAY WITH TOUCH on the same device: it turns touch back on (D.mobile.use(true))
  await page.evaluate(() => { __f.padOff(); G.ui.openPause(); __f.step(3); });
  await page.click("#fsMenu button[data-id=exit]");
  await page.waitForFunction(() => G.mode === "title", null, { timeout: 60000 });
  await page.evaluate(() => __f.step(3));
  await page.click("#playFlat");
  await play(page);
  m = await state(page);
  check(m.kind === "touch" && m.easy && m.panel && m.enabled === true && m.device === "touch" && JSON.stringify(m.useCalls) === "[false,true]", "after PLAY WITH MOUSE AND KEYBOARD, PLAY WITH TOUCH turns touch back on: the kind is touch, the phone panel shows, use(true) was called", m);
  check(page.errors.length === 0, "no page errors when the same device plays with the mouse and then with touch", page.errors);
  await page.context().close();
  // the same title, touch chosen
  page = await playPage(960, 540, { init: touch, enter: false });
  await page.click("#playFlat");
  await play(page);
  m = await page.evaluate(() => ({ kind: G.test.input().kind, panel: __f.vis("#phoneControls"), strip: __f.vis("#keyHints"), ring: __f.vis("#lockRing"), enabled: G.desktop.mobile.enabled }));
  check(m.kind === "touch" && m.enabled === true && m.panel && !m.strip && !m.ring, "the touch button starts the phone scheme: the kind is touch, the phone panel shows, and there is no key strip or desktop ring", m);
  // the real VIEW button of the phone panel reaches the game through mobile.sample().view: one press, one switch
  await page.evaluate(() => { G.flatcam.setFirstPerson(false); __f.step(30); });
  await page.click("[data-action=view]");
  await step(page, 3);
  const v1 = await page.evaluate(() => G.test.flat().firstPerson);
  await step(page, 30);
  const v2 = await page.evaluate(() => G.test.flat().firstPerson);
  check(v1 === true && v2 === true, "the real VIEW button switches the view once (it stays switched on the frames after the press)", { v1, v2 });
  check(page.errors.length === 0, "no page errors on the touch title", page.errors);
  await page.context().close();
}

/* ================= a first-time bot with real events ================= */
async function botPart() {
  for (const dh of [-10, 0, 10]) {
    const page = await playPage(960, 540);
    await lock(page);
    const res = await page.evaluate(async ({ dh }) => {
      const S = G.city.start, rnd = (() => { let a = 12345 + dh; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
      const cv = document.querySelector("#view canvas");
      const down = () => cv.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })), up = () => window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
      const key = (code, on) => window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code }));
      G.test.teleport(S.x, S.y, S.z); G.rigYaw = S.yaw + (dh * Math.PI) / 180; G.flatcam.reset(G.rigYaw); __f.step(30);
      key("KeyW", true);
      const seen = new Set(); let t3 = null, press = false, relAt = -1, nextAt = 0.3, ropeT = 0, dragT = 0, fromFrame = G.frame, died = null, presses = 0;
      for (let f = 0; f < 1800 && t3 === null && !died; f++) {
        const now = f / 60, t = G.test.target(), s = G.test.state();
        if (!press) {
          if (now >= nextAt && t.target && s.ropes.every((r) => r.state === "idle")) { down(); press = true; relAt = -1; ropeT = dragT = 0; presses++; }
        } else {
          const r = s.ropes.find((q) => q.state === "attached");
          if (r) {
            ropeT += 1 / 60; if (G.P.onGround) dragT += 1 / 60;
            if (relAt < 0) { if (ropeT >= 4.5 || (dragT >= 0.5 && r.tag !== "clog")) relAt = now; else if (t.cue) relAt = now + 0.2 + 0.2 * rnd(); }
            if (relAt >= 0 && now >= relAt) { up(); press = false; nextAt = now + 0.2 + 0.2 * rnd(); }
          } else if (s.ropes.every((q) => q.state === "idle")) { up(); press = false; nextAt = now + 0.2 + 0.2 * rnd(); }
        }
        G.test.step(1 / 60, 1);
        for (const e of G.test.events()) {
          if (e.frame <= fromFrame) continue;
          if (e.type === "attach" && e.target && typeof e.target.id === "number") { const b = G.city.colliders[e.target.id].bid; seen.add(b >= 0 ? b : 1e6 + e.target.id); if (seen.size >= 3 && t3 === null) t3 = now; }
          if (e.type === "respawn" || e.type === "splash" || e.type === "oob") died = e.type;
        }
        fromFrame = G.frame;
      }
      key("KeyW", false); up();
      return { t3, buildings: seen.size, died, presses };
    }, { dh });
    check(res.t3 !== null && !res.died && res.t3 <= 30, "the browser bot (real mouse and key events) starting at " + (dh >= 0 ? "+" : "") + dh + " degrees reaches three buildings in " + (res.t3 !== null ? res.t3.toFixed(1) : "never") + " s (30 s at most)", res);
    await page.context().close();
  }
}

/* ================= the headset: no picker, no ring, no strip, no rumble ================= */
async function vrPart() {
  const page = await newPage({ width: 640, height: 360 });
  await page.addInitScript(FAKE);
  await open(page, "emulate&skipintro&nosw");
  await page.evaluate(() => { window.__padOn = true; });
  await enterXR(page, "vr");
  await waitFor(page, () => G.state === "play", null, 240000);
  await sleep(500);
  const r = await page.evaluate(() => { __f.btn(7, 1); __f.btn(1, 1); return { on: G.test.target().on, ring: __f.vis("#lockRing"), arrow: __f.vis("#lockArrow"), strip: __f.vis("#keyHints"), cue: __f.vis("#lockCue") }; });
  check(r.on === false && !r.ring && !r.arrow && !r.strip && !r.cue, "in VR no picker runs and no ring, arrow, caption or strip shows", r);
  // a rope that attaches in VR never rumbles a pad
  const rum = await page.evaluate(async () => {
    window.__rumble = [];
    const S = G.city.start, T = G.city.goldRing;
    G.test.aimAt(1, T.x, T.y, T.z); G.test.press(1, true);
    for (let i = 0; i < 90; i++) await new Promise((res) => setTimeout(res, 16));
    return { rumble: window.__rumble.length, rope: G.test.state().ropes[1].state };
  });
  // the check means something only when a rope really attached: an attach is what rumbles a pad on a computer
  check(rum.rope === "attached" && rum.rumble === 0, "a rope attaches in the headset session and it never rumbles a pad (the rope is " + rum.rope + ", " + rum.rumble + " effects)", rum);
  check(page.errors.length === 0, "no page errors in VR", page.errors);
  await page.context().close();
}

if (want("opening")) { await opening(false); await opening(true); }
if (want("swing")) await swing();
if (want("pad")) await padPart();
if (want("marker") || want("sizes")) for (const [w, h] of [[640, 360], [960, 540], [1280, 720]]) if (!process.env.SIZE || process.env.SIZE === w + "x" + h) await markerAt(w, h);
if (want("marker") || want("extras")) { await markerExtra(); await stripGone(); await exactAim(); }
if (want("camera")) await cameraPart();
if (want("title")) await titles();
if (want("bot")) await botPart();
if (want("vr")) await vrPart();

await close();
done();
