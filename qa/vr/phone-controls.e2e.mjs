// In Full Swing: the phone panel and the page, in a real browser (tasks B2 and B3 of openspec/changes/swing-controls).
// It checks the lock-on ring and its arrow, the safe window, the touch size of every button, the top row, the title labels and notes,
// How to play and its order, vibration and the catch pop, a tap on a clog on a lower roof, a tap with the only building held, and
// the first-time bot that only taps. Sizes: 390 by 844, 844 by 390 and 360 by 740, with motion aim on and off.
// A check marked [join] needs the wiring of agent A in main.js and desktop.js (the marker each frame, G.test.target, the VIEW press,
// the buzz, the title labels). It fails on a branch that has only agent B's files, and it must pass after the join.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/phone-controls.e2e.mjs   (SHOTS=dir keeps screenshots)
import { readFile } from "node:fs/promises";
import { newPage, open, close, watchdog, checker, shot } from "./lib.mjs";
watchdog(1500000, "phone controls");
const { check, done } = checker("phone-controls");
const joinFails = [];
const join = (ok, msg, detail) => { if (!check(ok, "[join] " + msg, detail)) joinFails.push(msg); return ok; };

// A phone as the page sees it: touch points, the sensors answer what window.__sensors says, vibrate is a spy, no audio device.
// matchMedia answers for the pointer queries: a phone has no fine pointer, a touch laptop has both, a computer has no touch.
function phone({ touch, fine }) {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
  Object.defineProperty(navigator, "maxTouchPoints", { get: () => (touch ? 5 : 0) });
  const listen = window.addEventListener.bind(window);
  window.addEventListener = (type, ...args) => { if (type !== "deviceorientation" && type !== "devicemotion") listen(type, ...args); };
  window.__sensors = "denied";
  window.DeviceOrientationEvent.requestPermission = () => Promise.resolve(window.__sensors);
  window.DeviceMotionEvent.requestPermission = () => Promise.resolve(window.__sensors);
  window.__buzz = [];
  Object.defineProperty(navigator, "vibrate", { value: (ms) => { window.__buzz.push(ms); return true; }, configurable: true, writable: true });
  const real = window.matchMedia.bind(window);
  const fake = { "(any-pointer:fine)": !!fine, "(any-pointer:coarse)": !!touch, "(pointer:coarse)": !!touch && !fine, "(pointer:fine)": !touch || !!fine, "(hover:hover)": !touch || !!fine, "(hover:none)": !!touch && !fine };
  window.matchMedia = (q) => {
    const key = String(q).replace(/\s+/g, "").toLowerCase();
    if (key in fake) return { matches: fake[key], media: String(q), onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
    return real(q);
  };
}
async function phonePage(kind, size = [390, 844]) {
  const page = await newPage({ width: size[0], height: size[1] });
  await page.addInitScript(phone, kind === "desktop" ? { touch: false, fine: true } : kind === "hybrid" ? { touch: true, fine: true } : { touch: true, fine: false });
  await open(page, "?nosw");
  return page;
}
const text = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }, sel);

/* ---------------- in the page: what the layout looks like now ---------------- */
// Every box the ring and the arrow must keep clear of, and the size of every button's touch area (found by asking the page which
// element answers a touch at points around the middle of each button, so a hit area that reaches past the border counts).
function layout() {
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const seen = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const reach = (el) => {
    const r = el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const ok = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && el.contains(h); };
    const run = (dx, dy) => { let n = 0; while (n < 30 && ok(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
    return { w: run(1, 0) + run(-1, 0) + 1, h: run(0, 1) + run(0, -1) + 1 };
  };
  const buttons = [...document.querySelectorAll("#phoneControls button")].filter(seen);
  const top = [...document.querySelectorAll(".phone-top button")].filter(seen);
  // does a touch 1 px outside each side of the visible box (in the middle of that side) still reach the button?
  const outside = (el) => {
    const r = el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const ok = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && el.contains(h); };
    return { left: ok(r.left - 1, cy), right: ok(r.right + 1, cy), top: ok(cx, r.top - 1), bottom: ok(cx, r.bottom + 1) };
  };
  const pills = [...document.querySelectorAll(".fs-top .fs-pill")].filter((e) => !e.hidden && seen(e));
  // A spoken line that is hidden (visibility, as on a wall in portrait) covers nothing. One that shows has a tail: it hangs 27 px under
  // the box, 20 percent in from the left and 28 px wide (ui.js), so the tail is measured with the box.
  const subEl = document.querySelector(".fs-sub"), sub = subEl && subEl.classList.contains("on") && seen(subEl) && getComputedStyle(subEl).visibility !== "hidden" ? box(subEl) : null;
  const tail = sub ? { l: sub.l + sub.w * 0.2 - 2, r: sub.l + sub.w * 0.2 + 30, t: sub.b, b: sub.b + 27 } : null;
  const bottom = box(document.querySelector(".phone-bottom")), padEl = document.querySelector(".phone-climb"), pad = seen(padEl) ? box(padEl) : null;
  const t = top.map(box), p = pills.map(box);
  const overlaps = [];
  for (const a of t) for (const b of p) if (hit(a, b)) overlaps.push("a top button covers a score pill");
  if (sub && hit(sub, bottom)) overlaps.push("the spoken line covers the SWING panel");
  if (tail && hit(tail, bottom)) overlaps.push("the tail of the spoken line pokes into the SWING panel (its hint)");
  if (pad && hit(pad, bottom)) overlaps.push("the climb pad covers the SWING panel");
  for (const a of t) for (const b of t) if (a !== b && hit(a, b)) overlaps.push("two top buttons overlap");
  const hints = document.querySelector("#keyHints");
  return {
    w: innerWidth, h: innerHeight,
    buttons: buttons.map((b) => ({ name: b.dataset.action || b.dataset.climb || "?", top: !!b.closest(".phone-top"), box: box(b), touch: reach(b), outside: outside(b) })),
    topLabels: top.map((b) => b.textContent.trim()), topCount: top.length,
    topRow: t.length ? { one: Math.max(...t.map((b) => b.t)) - Math.min(...t.map((b) => b.t)) < 2, left: Math.min(...t.map((b) => b.l)), right: Math.max(...t.map((b) => b.r)), bottom: Math.max(...t.map((b) => b.b)) } : null,
    pillRow: p.length ? { count: p.length, spread: Math.max(...p.map((b) => b.t)) - Math.min(...p.map((b) => b.t)), left: Math.min(...p.map((b) => b.l)), right: Math.max(...p.map((b) => b.r)), bottom: Math.max(...p.map((b) => b.b)) } : null,
    overlaps, wide: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
    card: /turn (your|the) (phone|device)|rotate (your|the) (phone|device)/i.test(document.body.innerText),
    keyHints: !!hints && hints.getBoundingClientRect().width > 0 && getComputedStyle(hints).visibility !== "hidden",
  };
}
// Put the marker at many targets, with a spoken line showing: the ring or the arrow must sit inside the window, clear of the HUD, the
// ring on the target and the arrow on the border of the window, pointing at it.
function sweep() {
  const M = G.desktop.mobile, ring = document.querySelector(".phone-target"), arrow = ring.querySelector(".pt-arrow");
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const seen = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const hud = () => {
    const out = [];
    for (const sel of [".phone-top button", ".fs-top .fs-pill", ".phone-bottom", ".phone-climb"]) for (const e of document.querySelectorAll(sel)) if (!e.hidden && seen(e)) out.push([sel, box(e)]);
    // the spoken line with its tail, which hangs 27 px under the box
    const sub = document.querySelector(".fs-sub");
    if (sub && sub.classList.contains("on") && seen(sub)) { const b = box(sub); out.push([".fs-sub and its tail", { ...b, b: b.b + 27 }]); }
    return out;
  };
  const bad = [], seenRing = { ring: 0, arrow: 0 }, W = innerWidth, H = innerHeight;
  const xs = [], ys = [];
  for (let x = -1.5; x <= 1.501; x += 0.25) xs.push(+x.toFixed(2));
  for (let y = 0.3; y <= 1.501; y += 0.1) ys.push(+y.toFixed(1));
  ys.push(-0.4, -1);
  let win = null;
  for (const ny of ys) for (const nx of xs) {
    win = M.safe();
    M.marker({ x: nx, y: ny, kind: "swing", dist: 40 });
    const r = box(ring), cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2, isArrow = ring.classList.contains("arrow");
    const tag = `NDC (${nx}, ${ny})`;
    if (ring.hidden) { bad.push(tag + ": the ring is hidden"); continue; }
    if (Math.abs(r.r - r.l - 56) > 0.01 || Math.abs(r.b - r.t - 56) > 0.01) bad.push(tag + ": the box is not 56 px across");
    if (r.l < win.l - 0.5 || r.r > win.r + 0.5 || r.t < win.t - 0.5 || r.b > win.b + 0.5) bad.push(tag + ": outside the window " + JSON.stringify({ r, win }));
    for (const [sel, o] of hud()) if (hit(r, o)) bad.push(tag + ": covers " + sel);
    const px = (nx * 0.5 + 0.5) * W, py = (0.5 - ny * 0.5) * H;
    if (!isArrow) {
      seenRing.ring++;
      if (Math.hypot(cx - px, cy - py) > 2) bad.push(tag + ": the ring is " + Math.hypot(cx - px, cy - py).toFixed(1) + " px from the target");
    } else {
      seenRing.arrow++;
      const onBorder = Math.min(Math.abs(r.l - win.l), Math.abs(r.r - win.r), Math.abs(r.t - win.t), Math.abs(r.b - win.b));
      if (onBorder > 1) bad.push(tag + ": the arrow is " + onBorder.toFixed(1) + " px off the border of the window");
      const turn = +/rotate\((-?[\d.]+)deg\)/.exec(arrow.style.transform || "")?.[1];
      const want = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
      const gap = Math.abs(((turn - want + 540) % 360) - 180);
      if (!(gap <= 4)) bad.push(tag + ": the arrow turns " + turn + " but the target is at " + want.toFixed(1));
    }
  }
  // behind the camera: the arrow sits on the bottom border of the window, on the target's side, and points down
  for (const nx of [-1, 0, 1]) {
    win = M.safe();
    M.marker({ x: nx, y: -1.5, kind: "swing", dist: 20, behind: true });
    const r = box(ring), cx = (r.l + r.r) / 2, tag = `behind the camera on side ${nx}`;
    if (!ring.classList.contains("arrow")) bad.push(tag + ": no arrow");
    if (Math.abs(r.b - win.b) > 1) bad.push(tag + ": the arrow is " + (win.b - r.b).toFixed(1) + " px above the bottom border");
    if (r.l < win.l - 0.5 || r.r > win.r + 0.5) bad.push(tag + ": outside the window sideways");
    if (arrow.style.transform !== "rotate(180deg)") bad.push(tag + ": the arrow does not point down: " + arrow.style.transform);
    if (nx !== 0 && Math.sign(cx - (win.l + win.r) / 2) !== Math.sign(nx)) bad.push(tag + ": the arrow is on the wrong side");
    for (const [sel, o] of hud()) if (hit(r, o)) bad.push(tag + ": covers " + sel);
  }
  M.marker(null);
  return { bad, n: xs.length * ys.length + 3, ...seenRing, win: { ...win }, fraction: (win.b - win.t) / H };
}

// A one-box building with a clear street face (+x), and a way to fly into it so that the hero really holds the wall (main.js shows the
// climb pad every frame from P.wall, so the pad cannot be faked). This is a copy of the helper of climb.e2e.mjs.
function wallSetup() {
  const C = G.city;
  const B = C.colliders.find((c) => {
    if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
    if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
    const z = (c.minZ + c.maxZ) / 2;
    for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
    return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
  });
  window.QA = {
    B, z: B && (B.minZ + B.maxZ) / 2,
    flyIn() { G.test.teleport(B.maxX + 3, B.maxY / 2, QA.z); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.P.vel.x = -8; G.test.step(1 / 60, 30); return !!G.P.wall; },
  };
  return !!B;
}

// Every spoken line of the phone tutorial and clog tables, one after the other: how much of the height does the safe window keep?
async function lineWindows() {
  const C = await import("./js/config.js");
  const need = innerWidth > innerHeight ? 0.45 : 0.55, bad = [];
  for (const line of new Set(Object.values(C.LINES_PHONE).flat())) {
    G.ui.say(line, 60); G.test.step(1 / 60, 2);
    const w = G.desktop.mobile.safe(), f = (w.b - w.t) / innerHeight;
    if (f < need) bad.push(f.toFixed(3) + " " + line);
    G.ui.say("", 0);
  }
  return { bad, need, count: new Set(Object.values(C.LINES_PHONE).flat()).size };
}

// Every line the hint over SWING can say, with a spoken line showing. The tail of the spoken line hangs 27 px under its box and the
// spoken line has room for one line of hint: a hint that wraps to a second line lifts the SWING panel into the tail. (The wall line
// is not here: on a wall in portrait the spoken lines are hidden, and in landscape they sit at the top.) No game frame runs after a
// button is pressed, so nothing fires.
async function hintStates() {
  const M = G.desktop.mobile, hint = document.querySelector(".phone-hint"), bottom = document.querySelector(".phone-bottom"), sub = document.querySelector(".fs-sub"), btn = document.querySelector("[data-action=throw]");
  const out = [];
  G.ui.say("Tap the next building while you fly.", 60); G.test.step(1 / 60, 3);
  const read = (name) => {
    const s = sub.getBoundingClientRect(), b = bottom.getBoundingClientRect(), h = hint.getBoundingClientRect();
    out.push({ name, text: hint.textContent, lines: Math.round((h.height - 14) / 18.4), gap: +(b.top - (s.bottom + 27)).toFixed(1) });
  };
  window.__sensors = "granted"; await M.start(); read("motion aim on");
  window.__sensors = "denied"; await M.start(); read("motion aim off");
  M.miss(true); read("the rope is kept"); M.miss(false); read("nothing in reach");
  const center = document.querySelector("[data-action=center]"); center.hidden = false; center.click(); read("centered"); center.hidden = true;
  M.released(); read("flying");
  btn.onclick(); read("swinging"); btn.onclick(); read("let go");
  M.reset(); G.ui.say("", 0);
  return out;
}

/* ---------------- the title: labels, notes and the words of the page ---------------- */
let main;
try {
  main = await phonePage("touch");
  await main.waitForFunction(() => G.viewDone);
  // static parts, which agent B owns
  const meta = await main.evaluate(() => {
    const p = document.querySelector("#playFlat"), m = document.querySelector("#playMouse");
    const notes = ["#touchNote", "#deskNote", "#hybridNote"].map((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; });
    return { labelTouch: p && p.getAttribute("data-label-touch"), mouse: m && { text: m.textContent.trim(), enter: m.hasAttribute("data-enter") }, notes, em: /—/.test(document.body.textContent) };
  });
  check(meta.labelTouch === "PLAY WITH TOUCH", "#playFlat carries data-label-touch=\"PLAY WITH TOUCH\"", meta.labelTouch);
  check(meta.mouse && meta.mouse.text === "PLAY WITH MOUSE AND KEYBOARD" && meta.mouse.enter, "#playMouse reads PLAY WITH MOUSE AND KEYBOARD and is an enter button", meta.mouse);
  check(meta.notes.every((n) => n) && /Tap a building/.test(meta.notes[0]) && /SWING/.test(meta.notes[0]), "#touchNote tells a phone player to tap a building or press SWING", meta.notes[0]);
  check(/left mouse button/.test(meta.notes[1]) && /\bW\b/.test(meta.notes[1]) && /game pad/i.test(meta.notes[1]), "#deskNote names the left mouse button, W and the game pad", meta.notes[1]);
  check(/touch/i.test(meta.notes[2]) && /mouse/i.test(meta.notes[2]), "#hybridNote speaks to a device with touch and a mouse", meta.notes[2]);
  check(!meta.em, "no em dash on the page");
  // the behaviour, which agent A wires in wireTitle (a phone has no fine pointer here)
  join((await text(main, "#playFlat")) === "PLAY WITH TOUCH", "on a touch device with no fine pointer the play button reads PLAY WITH TOUCH", await text(main, "#playFlat"));
  join((await shown(main, "#touchNote")) && !(await shown(main, "#deskNote")) && !(await shown(main, "#hybridNote")) && !(await shown(main, "#playMouse")), "the title shows the touch note only, and no mouse button");

  // How to play: five sections, the right words, and the section for the device in use first
  await main.click("#howBtn");
  const how = await main.evaluate(() => {
    const d = document.querySelector("#how"), secs = [...d.querySelectorAll(".cols section")];
    const kbd = (s) => [...s.querySelectorAll("kbd")].map((k) => k.textContent.trim());
    const by = (k) => secs.find((s) => s.dataset.for === k);
    const first = () => [...d.querySelectorAll("h3")].map((h) => { const b = h.getBoundingClientRect(); return { t: Math.round(b.top), l: Math.round(b.left), name: h.textContent.trim() }; }).sort((a, b) => a.t - b.t || a.l - b.l)[0].name;
    const order = {};
    for (const dev of ["", "touch", "mouse", "pad"]) { if (dev) document.body.dataset.device = dev; else delete document.body.dataset.device; order[dev || "none"] = first(); }
    delete document.body.dataset.device;
    return {
      open: d.open, heads: secs.map((s) => s.querySelector("h3").textContent.trim()), keys: kbd(by("mouse")), text: d.textContent,
      kbdText: by("mouse").textContent, padText: by("pad").textContent, touchText: by("touch").textContent, order,
      wide: d.scrollWidth > d.clientWidth + 1,
    };
  });
  check(how.open && JSON.stringify(how.heads) === JSON.stringify(["Headset controllers", "Hands", "Keyboard and mouse", "Game pad", "Phone and touch"]), "How to play has five sections: headset controllers, hands, keyboard and mouse, game pad, phone and touch", how.heads);
  check(["Shift", "F", "Space", "E", "Q", "V", "Tab", "M"].every((k) => how.keys.includes(k)), "the keyboard section names Shift, F, Space, E, Q, V, Tab and M", how.keys);
  check(/pinch/i.test(how.text) && /Shift/.test(how.text), "the dialog still has the words pinch and Shift (boot.mjs needs them)");
  check(!/A game pad works too/.test(how.text) && !/<h3>Controllers<\/h3>/.test(how.text) && !how.heads.includes("Controllers"), "the old line A game pad works too is gone, and Controllers is now Headset controllers");
  check(/right trigger/.test(how.padText) && /left bumper/.test(how.padText) && /Triangle/.test(how.padText) && /Options/.test(how.padText), "the game pad section names the triggers, the bumpers, Triangle and Options", how.padText.slice(0, 160));
  check(/VIEW/.test(how.touchText) && /SWING/.test(how.touchText) && /JUMP/.test(how.touchText) && !/mouse|Shift|trigger|pinch|grip/i.test(how.touchText), "the phone section names SWING, VIEW and JUMP and no mouse, key, trigger, pinch or grip");
  check(how.order.none === "Headset controllers" && how.order.touch === "Phone and touch" && how.order.mouse === "Keyboard and mouse" && how.order.pad === "Game pad", "the section for the device in use comes first (body[data-device])", how.order);
  check(!how.wide, "the dialog does not scroll sideways at 390 px");
  await shot(main, "phone-controls-how-390");
  await main.click("#how [data-close]");

  /* ---------------- into play ---------------- */
  await main.evaluate(() => { window.__sensors = "granted"; });
  await main.locator("#playFlat").click();
  await main.waitForFunction(() => G.state === "play");
  await main.locator("#phoneControls").waitFor({ state: "visible" });
  // the words: the first line the tutorial speaks is the one in design.md ("Words"), and no phone line names a mouse, Shift, a key, a
  // trigger, a pinch or a grip (read before any frame runs, so the line on the screen is the one the tutorial said first)
  const design = await readFile(new URL("../../openspec/changes/swing-controls/design.md", import.meta.url), "utf8");
  const wantFirst = (/`LINES_PHONE` changes tutorial 0 to "([^"]+)"/.exec(design) || [])[1];
  const words = await main.evaluate(async () => {
    const C = await import("./js/config.js"), sub = document.querySelector(".fs-sub");
    return { spoken: sub.textContent, on: sub.classList.contains("on"), said: G.ui.sayLine("tutorial", 0), table: C.LINES_PHONE.tutorial[0], all: Object.entries(C.LINES_PHONE).flatMap(([k, v]) => v.map((l) => k + ": " + l)) };
  });
  join(!!wantFirst && words.on && words.spoken === wantFirst && words.said === wantFirst && words.table === wantFirst, `the first phone tutorial line is the one in design.md ("${wantFirst}"): on the screen, from sayLine and in LINES_PHONE`, { wantFirst, spoken: words.spoken, said: words.said, table: words.table });
  const badWords = words.all.filter((l) => /mouse|shift|\bkeys?\b|keyboard|trigger|bumper|pinch|grip|\bpress\b/i.test(l));
  join(words.all.length >= 20 && badWords.length === 0, `none of the ${words.all.length} phone lines names a mouse, Shift, a key, a trigger, a pinch or a grip`, badWords);
  await main.evaluate(() => { G.test.hold(true); const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.test.step(1 / 60, 90); });
  join((await main.evaluate(() => document.body.dataset.device)) === "touch", "play on a touch device sets body[data-device] to touch");
  // the Comfort page: a phone lets go by itself, so it shows no Rope trigger and no Release cue (a mouse and a pad do: ui.mjs)
  const comfort = await main.evaluate(() => {
    G.ui.openPause(); G.test.step(1 / 60, 3);
    document.querySelector("#fsMenu button[data-id=comfort]").click(); G.test.step(1 / 60, 2);
    const ids = [...document.querySelectorAll("#fsMenu button[data-id]")].map((b) => b.dataset.id), text = document.querySelector("#fsMenu").textContent, panel = G.test.ui().panel;
    G.ui.closePause(); G.test.step(1 / 60, 3);
    return { ids, text, panel, state: G.state };
  });
  join(comfort.panel === "comfort" && comfort.ids.some((i) => i.startsWith("aim:")) && !/Rope trigger|Release cue/.test(comfort.text) && !comfort.ids.some((i) => /^(hold|cue):/.test(i)) && comfort.state === "play", "the Comfort page on a phone keeps Aim assist and shows no Rope trigger and no Release cue", comfort);

  /* ---------------- sizes, both layouts, motion aim on and off ---------------- */
  const SIZES = [[390, 844, "portrait"], [844, 390, "landscape"], [360, 740, "narrow portrait"]];
  for (const [w, h, name] of SIZES) {
    await main.setViewportSize({ width: w, height: h });
    await main.waitForFunction((a) => Math.abs(G.camera.aspect - a) < 0.01, w / h);
    for (const sensors of ["granted", "denied"]) {
      const tag = `${w}x${h} ${name}, motion aim ${sensors === "granted" ? "on" : "off"}`;
      await main.evaluate(async (s) => { window.__sensors = s; await G.desktop.mobile.start(); G.ui.say("Tap the next building while you fly.", 60); G.test.step(1 / 60, 3); }, sensors);
      const L = await main.evaluate(layout);
      const small = L.buttons.filter((b) => b.touch.w < 48 || b.touch.h < 48);
      check(small.length === 0, `${tag}: every visible button has a touch area of 48 by 48 or more`, small.map((b) => b.name + " " + b.touch.w + "x" + b.touch.h));
      const narrow = L.buttons.filter((b) => b.box.w < 46 || b.box.h < 46);
      check(narrow.length === 0, `${tag}: no button box is under 46 px`, narrow.map((b) => b.name + " " + Math.round(b.box.w) + "x" + Math.round(b.box.h)));
      // The requirement: every touch area is 48 by 48 or more. The top row keeps boxes 46 px high (phone-swing.e2e.mjs reads a taller
      // one as a second row) and gets its 48 px from a hit area that reaches past the box. Every other button box is 48 or more itself.
      const tops = L.buttons.filter((b) => b.top), rest = L.buttons.filter((b) => !b.top);
      const tall = tops.filter((b) => Math.abs(b.box.h - 46) > 0.5);
      check(tops.length === L.topCount && tall.length === 0, `${tag}: the top row buttons are 46 px tall`, tops.map((b) => b.name + " " + b.box.h));
      const missed = tops.filter((b) => !(b.outside.left && b.outside.right && b.outside.top && b.outside.bottom));
      check(tops.length > 0 && missed.length === 0, `${tag}: a touch 1 px outside the box of a top button, on any side, still hits that button (hit area of 48 px or more)`, missed.map((b) => b.name + " " + JSON.stringify(b.outside)));
      const thin = rest.filter((b) => b.box.w < 48 || b.box.h < 48);
      check(rest.length >= 1 && thin.length === 0, `${tag}: every other visible button box is 48 by 48 or more (${rest.map((b) => b.name).join(", ")})`, thin.map((b) => b.name + " " + Math.round(b.box.w) + "x" + Math.round(b.box.h)));
      check(L.topCount === (sensors === "granted" ? 4 : 3), `${tag}: the top row has ${sensors === "granted" ? "four buttons" : "three buttons (Center hides)"}`, L.topLabels);
      check(L.topRow && L.topRow.one && L.topRow.left >= 0 && L.topRow.right <= L.w, `${tag}: the top row is one line inside the screen`, L.topRow);
      check(L.topRow && /^(MOTION|Motion)$/i.test(L.topLabels[0]) && L.topLabels.every((s) => s.length <= 6), `${tag}: the labels are six letters or fewer`, L.topLabels);
      check(L.pillRow && L.pillRow.spread < 8 && L.pillRow.left >= 0 && L.pillRow.right <= L.w, `${tag}: the score pills are one row inside the screen`, L.pillRow);
      check(L.overlaps.length === 0, `${tag}: the top buttons, pills, spoken line and SWING panel do not overlap`, L.overlaps);
      check(!L.wide, `${tag}: the page does not scroll sideways`);
      check(!L.card, `${tag}: no card asks the player to turn the phone`);
      check(!L.keyHints, `${tag}: #keyHints is not visible on touch in play with an unfinished tutorial`);
      const S = await main.evaluate(sweep);
      check(S.bad.length === 0, `${tag}: ${S.n} targets (NDC y 0.3 to 1.5, x -1.5 to 1.5, two below the middle, three behind the camera): the ring or arrow sits in the window, clear of the HUD, the ring within 2 px of its target, the arrow on the border and pointing at it (${S.ring} rings, ${S.arrow} arrows)`, S.bad.slice(0, 6));
      const need = w > h ? 0.45 : 0.55;
      check(S.fraction >= need, `${tag}: the safe window is ${(S.fraction * 100).toFixed(1)} percent of the height (at least ${need * 100})`, S.win);
      if (sensors === "granted") await shot(main, `phone-controls-${w}x${h}`);
    }
    const hs = await main.evaluate(hintStates);
    check(hs.length === 8 && hs.every((q) => q.gap >= 0), `${w}x${h} ${name}: with a spoken line showing, its tail (27 px) clears the SWING panel for each of the ${hs.length} hint lines`, hs.filter((q) => q.gap < 0));
    if (w < h) check(hs.every((q) => q.lines === 1), `${w}x${h} ${name}: each hint line fits on one line`, hs.filter((q) => q.lines !== 1));
    const lw = await main.evaluate(lineWindows);
    check(lw.bad.length === 0, `${w}x${h} ${name}: the safe window keeps ${lw.need * 100} percent of the height or more for each of the ${lw.count} phone spoken lines, the longest too`, lw.bad);
    // a trial (with its compass) or the King's hearts make four pills: on a narrow portrait screen the row still fits
    if (w < 480) {
      for (const [what, trial, hearts] of [["a trial time", true, false], ["three hearts", false, true]]) {
        await main.evaluate(([trial, hearts]) => {
          const t = document.querySelector("[data-k=trialBox]"), hh = document.querySelector("[data-k=heartBox]");
          t.hidden = !trial; document.querySelector("[data-k=trial]").textContent = "123.4";
          hh.hidden = !hearts; hh.innerHTML = hearts ? '<span class="fs-heart">♥</span>'.repeat(3) : "";
          document.querySelector("[data-k=compassBox]").hidden = false;
          window.__bank = document.querySelector("[data-k=bank]").textContent; document.querySelector("[data-k=bank]").textContent = "BANK 120";
        }, [trial, hearts]);
        const four = await main.evaluate(layout);
        await main.evaluate(() => {
          document.querySelector("[data-k=trialBox]").hidden = true; const hh = document.querySelector("[data-k=heartBox]"); hh.hidden = true; hh.innerHTML = "";
          document.querySelector("[data-k=bank]").textContent = window.__bank;
        });
        check(four.pillRow.count === 4 && four.pillRow.spread < 8 && four.pillRow.left >= 0 && four.pillRow.right <= four.w && !four.wide && four.overlaps.length === 0, `${w}x${h}: four score pills (loonies, clogs, the compass and ${what}) stay in one row inside the screen`, four.pillRow);
      }
    }
  }

  // the climb pad shows on a wall: its buttons are 48 or more, and the ring and arrow keep clear of it
  check(await main.evaluate(wallSetup), "a building to climb was found");
  for (const [w, h] of [[390, 844], [844, 390]]) {
    await main.setViewportSize({ width: w, height: h });
    await main.waitForFunction((a) => Math.abs(G.camera.aspect - a) < 0.01, w / h);
    check(await main.evaluate(() => { const ok = QA.flyIn(); G.ui.say("Tap the next building while you fly.", 60); G.test.step(1 / 60, 3); return ok && !!G.P.wall; }), `${w}x${h}: the hero holds the wall`);
    const L = await main.evaluate(layout);
    const pads = L.buttons.filter((b) => /^(up|down|left|right|hop)$/.test(b.name));
    check(pads.length === 5 && pads.every((b) => b.touch.w >= 48 && b.touch.h >= 48), `${w}x${h}: the five climb pad buttons show, each 48 by 48 or more`, pads.map((b) => b.name + " " + b.touch.w + "x" + b.touch.h));
    check(L.overlaps.length === 0 && !L.wide, `${w}x${h}: on a wall nothing overlaps`, L.overlaps);
    const S = await main.evaluate(sweep);
    check(S.bad.length === 0, `${w}x${h}: on a wall the ring and arrow keep clear of the climb pad and every other HUD box (${S.ring} rings, ${S.arrow} arrows)`, S.bad.slice(0, 6));
    if (w === 390) await shot(main, "phone-controls-wall-390");
    await main.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.test.step(1 / 60, 3); });
    check(await main.evaluate(() => document.querySelector(".phone-climb").hidden), `${w}x${h}: the pad hides off the wall`);
  }

  /* ---------------- turn the phone during play ---------------- */
  await main.setViewportSize({ width: 390, height: 844 });
  await main.waitForFunction(() => Math.abs(G.camera.aspect - 390 / 844) < 0.01);
  const turn1 = await main.evaluate(() => ({ state: G.state, aspect: G.camera.aspect }));
  await main.setViewportSize({ width: 844, height: 390 });
  await main.waitForFunction(() => G.camera.aspect > 2);
  const turn2 = await main.evaluate(() => { G.test.step(1 / 60, 5); return { state: G.state, aspect: G.camera.aspect, card: /turn (your|the) (phone|device)/i.test(document.body.innerText), pressed: !!document.querySelector("[data-action=throw]") }; });
  check(turn1.state === "play" && turn2.state === "play" && Math.abs(turn2.aspect - 844 / 390) < 0.01 && !turn2.card, "turning the phone from portrait to landscape during play goes on playing: the camera aspect follows, no card shows", { turn1, turn2 });
  await main.setViewportSize({ width: 390, height: 844 });
  await main.waitForFunction(() => Math.abs(G.camera.aspect - 390 / 844) < 0.01);
  await main.evaluate(async () => { window.__sensors = "denied"; await G.desktop.mobile.start(); G.test.step(1 / 60, 3); });

  /* ---------------- the marker: colours, hiding, the dim, the centre ring ---------------- */
  const look = await main.evaluate(() => {
    const M = G.desktop.mobile, ring = document.querySelector(".phone-target"), btn = document.querySelector("[data-action=throw]"), cross = document.querySelector(".phone-crosshair");
    const css = (e, k) => getComputedStyle(e)[k];
    const out = {};
    M.safe(); M.marker({ x: 0.2, y: 0.4, kind: "swing", dist: 30 });
    out.swing = { color: css(ring, "color"), star: css(ring.querySelector(".pt-star"), "display"), ringShape: css(ring.querySelector(".pt-ring"), "display"), shown: css(ring, "display"), ready: document.querySelector("#phoneControls").classList.contains("target-ready"), dim: btn.classList.contains("no-target"), opacity: css(btn, "opacity") };
    M.marker({ x: 0.2, y: 0.4, kind: "clog", dist: 30 });
    out.clog = { color: css(ring, "color"), star: css(ring.querySelector(".pt-star"), "display"), ringShape: css(ring.querySelector(".pt-ring"), "display") };
    M.marker({ x: 0.2, y: 0.4, kind: "pipe", dist: 30 }); out.pipe = { color: css(ring, "color") };
    M.marker({ x: 0.2, y: 0.4, kind: "ring", dist: 30 }); out.gold = { color: css(ring, "color") };
    M.marker({ x: 0.2, y: 0.4, kind: "crack", dist: 30 }); out.crack = { color: css(ring, "color") };
    M.marker(null);
    out.none = { shown: css(ring, "display"), hidden: ring.hidden, dim: btn.classList.contains("no-target"), opacity: css(btn, "opacity"), pointer: css(btn, "pointerEvents"), text: btn.firstChild.textContent, ready: document.querySelector("#phoneControls").classList.contains("target-ready") };
    out.crossThird = css(cross, "display"); out.viewBtnThird = css(document.querySelector("[data-action=view]"), "backgroundColor");
    G.flatcam.setFirstPerson(true); G.test.step(1 / 60, 40);
    out.crossFirst = css(cross, "display"); out.view = document.body.dataset.view;
    out.viewBtn = css(document.querySelector("[data-action=view]"), "backgroundColor");
    G.flatcam.setFirstPerson(false); G.test.step(1 / 60, 40);
    out.viewBack = document.body.dataset.view;
    return out;
  });
  check(look.swing.color === "rgb(255, 216, 74)" && look.swing.star === "none" && look.swing.ringShape !== "none", "a building gets the yellow ring", look.swing);
  check(look.clog.color === "rgb(156, 255, 58)" && look.clog.star !== "none" && look.clog.ringShape === "none", "a clog gets the sludge green ring with points", look.clog);
  check(look.pipe.color === "rgb(156, 255, 58)", "a pipe gets the green ring too", look.pipe);
  check(look.gold.color === "rgb(255, 179, 42)" && look.crack.color === "rgb(255, 179, 42)", "the gold ring and the crack get the gold ring", [look.gold, look.crack]);
  check(look.swing.ready && !look.swing.dim, "with a target the panel has target-ready and SWING is not dimmed");
  check(look.none.hidden && look.none.shown === "none" && look.none.dim && !look.none.ready && Number(look.none.opacity) < 0.8 && look.none.pointer === "auto" && look.none.text === "SWING", "with no target the ring is hidden and SWING is dimmed but still works", look.none);
  check(look.crossThird === "none" && look.crossFirst !== "none" && look.view === "first" && look.viewBack === "third", "the centre ring shows only in first person", look);
  check(look.viewBtn === "rgb(255, 216, 74)" && look.viewBtnThird !== look.viewBtn, "the VIEW button turns yellow in the first-person view", [look.viewBtnThird, look.viewBtn]);

  /* ---------------- vibration and the catch pop ---------------- */
  const buzz = await main.evaluate(async () => {
    const M = G.desktop.mobile, ring = document.querySelector(".phone-target"), out = {};
    window.__buzz.length = 0;
    M.buzz(15); out.first = [...window.__buzz];
    await new Promise((r) => setTimeout(r, 60)); M.buzz(25); M.buzz(40); out.after = [...window.__buzz]; // the 40 comes inside the 40 ms gap
    M.safe(); M.marker({ x: 0.1, y: 0.3, kind: "swing" });
    M.pop(); out.pop = { on: ring.classList.contains("pop"), anim: getComputedStyle(ring.querySelector(".pt-body")).animationName };
    await new Promise((r) => setTimeout(r, 160)); G.test.step(1 / 60, 1);
    out.popOff = !ring.classList.contains("pop");
    // an iPhone has no navigator.vibrate
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true, writable: true });
    let err = null; try { M.buzz(15); M.pop(); } catch (e) { err = String(e); }
    out.noVibrate = { err, pop: ring.classList.contains("pop") };
    await new Promise((r) => setTimeout(r, 160)); G.test.step(1 / 60, 1);
    Object.defineProperty(navigator, "vibrate", { value: (ms) => { window.__buzz.push(ms); return true; }, configurable: true, writable: true });
    M.marker(null);
    return out;
  });
  check(buzz.first.length === 1 && buzz.first[0] === 15, "buzz(15) calls navigator.vibrate(15)", buzz.first);
  check(buzz.after.length === 2 && buzz.after[1] === 25, "a buzz 60 ms later goes through, and one straight after it does not (at most one in 40 ms)", buzz.after);
  check(buzz.pop.on && /pt-pop/.test(buzz.pop.anim) && buzz.popOff, "the ring pops for 120 ms and the pop clears", buzz.pop);
  check(buzz.noVibrate.err === null && buzz.noVibrate.pop, "with no navigator.vibrate buzz does not throw and the ring still pops", buzz.noVibrate);
  await main.emulateMedia({ reducedMotion: "reduce" });
  const calm = await main.evaluate(() => {
    const M = G.desktop.mobile, ring = document.querySelector(".phone-target"); M.safe(); M.marker({ x: 0.1, y: 0.3, kind: "swing" }); M.pop();
    const b = getComputedStyle(ring.querySelector(".pt-body")); const r = { anim: b.animationName, filter: b.filter }; M.marker(null); return r;
  });
  await main.emulateMedia({ reducedMotion: "no-preference" });
  check(calm.anim === "none" && /brightness/.test(calm.filter), "with reduced motion the pop does not scale: the ring turns brighter instead", calm);

  /* ---------------- words of the hint line ---------------- */
  const hints = await main.evaluate(() => {
    const M = G.desktop.mobile, h = document.querySelector(".phone-hint"), out = {};
    M.miss(true); out.kept = h.textContent; M.miss(false); out.none = h.textContent;
    document.querySelector("[data-action=center]").hidden = false; document.querySelector("[data-action=center]").click(); out.center = h.textContent;
    M.reset(); return out;
  });
  check(/Keeping this rope/.test(hints.kept) && /Nothing in reach/.test(hints.none) && /yellow/.test(hints.center) && !/green/i.test(hints.center), "the hints say the rope is kept, that nothing is in reach, and that the ring is yellow", hints);

  /* ---------------- a tap on a clog on a lower roof reaches the clog ---------------- */
  // The hero stands on a roof (a safe spot or the middle of any box building) that is 4 m or more above a clog, 15 to 100 m from it, with
  // a clear line to it and the clog on the screen. The pixel of the clog must show the roof behind it: the ray through that pixel passes
  // over the clog and lands on the clog's own roof, so a plain exact-point tap would take the roof, and only the clog rule reaches the clog.
  const spot = await main.evaluate(() => {
    const C = G.city, cam = G.camera, V3 = cam.position.constructor, S = 1.35, HIT = {}, found = [];
    const roofs = C.colliders.filter((c) => c.type === "box" && c.tag === "building" && c.maxY > 10 && c.maxY < 200 && c.maxX - c.minX > 8 && c.maxZ - c.minZ > 8).map((c) => ({ x: (c.minX + c.maxX) / 2, y: c.maxY, z: (c.minZ + c.maxZ) / 2 }));
    for (const c of C.clogs) for (const s of [{ ...C.start }, ...C.safe, ...roofs]) {
      const dy = s.y - c.y, d = Math.hypot(c.x - s.x, c.z - s.z);
      if (dy >= 4 && d >= 15 && d <= 100) found.push({ s, c, dy, d, k: -Math.atan2(dy, d) });
    }
    found.sort((a, b) => a.k - b.k);
    for (const { s, c, dy: rise, d: far } of found.slice(0, 250)) {
      G.desktop.mobile.reset(); G.test.aimAt(1, null); G.test.teleport(s.x, s.y, s.z);
      if (Math.abs(G.P.pos.y - s.y) > 0.05) continue; // not a place to stand
      G.rigYaw = Math.atan2(-(c.x - s.x), -(c.z - s.z)); G.flatcam.reset(G.rigYaw, -Math.min(1.1, Math.atan2(rise, far) * 0.85)); G.test.step(1 / 60, 40); // look down at it
      cam.updateMatrixWorld(true);
      const T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, head = G.test.state().head;
      const dx = T.x - head.x, dyy = T.y - head.y, dz = T.z - head.z, dist = Math.hypot(dx, dyy, dz);
      if (C.raycast(head.x, head.y, head.z, dx, dyy, dz, dist - 0.7, HIT)) continue; // a wall in the way
      const v = new V3(T.x, T.y, T.z).project(cam);
      if (!(v.z < 1) || Math.abs(v.x) > 0.8 || v.y < -0.7 || v.y > 0.5) continue;
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (0.5 - v.y * 0.5) * innerHeight;
      if (document.elementFromPoint(px, py) !== G.renderer.domElement) continue;
      const d = new V3(v.x, v.y, 0.5).unproject(cam).sub(cam.position).normalize();
      const behind = C.raycast(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, 400, {});
      if (!behind || behind.ny < 0.7 || Math.abs(behind.y - c.y) > 2.5) continue; // the ray must land on the clog's own roof
      return { id: c.id, px, py, ndc: { x: v.x, y: v.y }, rise: Math.round(s.y - c.y), dist: Math.round(Math.hypot(c.x - s.x, c.z - s.z)), hitTag: behind.collider.tag, hitY: behind.y, clogY: c.y };
    }
    return null;
  });
  if (!check(!!spot, "a roof with a clog on a lower roof in view was found")) throw new Error("no clog on a lower roof");
  await main.mouse.click(spot.px, spot.py);
  const tapped = await main.evaluate((id) => {
    let tag = null, att = false;
    for (let k = 0; k < 90; k++) { G.test.step(1 / 60, 1); const r = G.test.state().ropes[1]; if (r.state === "attached") { att = true; tag = r.tag; if (tag === "clog") break; } }
    for (let k = 0; k < 240 && !G.game.info().clogs[id].done; k++) G.test.step(1 / 60, 1);
    const i = G.game.info().clogs[id];
    return { att, tag, done: i.done, pumps: i.pumps };
  }, spot.id);
  check(tapped.att && tapped.tag === "clog" && tapped.done, "a tap on the pixel of a clog on a lower roof attaches to the clog and plunges it (three pumps)", { spot, tapped });

  /* ---------------- a tap with the only building held keeps the rope ---------------- */
  // SWING catches a building. Then the city is changed so that the held building is the only one any ray can hit, and the player taps
  // the sky with a finger (a real click on the canvas: a second press of the SWING button would be LET GO, not a tap).
  const hold = await main.evaluate(() => {
    const s = G.city.start, R = G.city.goldRing, C = G.city, M = G.desktop.mobile;
    G.test.press(1, false); G.test.aimAt(1, null); M.reset(); G.test.teleport(s.x, s.y, s.z); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z)); G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.step(1 / 60, 30);
    document.querySelector("[data-action=throw]").onclick();
    let held = null;
    for (let k = 0; k < 40 && !held; k++) { G.test.step(1 / 60, 1); const r = G.test.state().ropes[1]; if (r.state === "attached") held = { id: r.id, anchor: { ...r.anchor } }; }
    if (!held) return { held: null };
    const raw = C.raycast; G.QA_ray = raw; G.QA_held = held;
    C.raycast = function (...a) { const h = raw.apply(this, a); return h && h.collider && h.collider.id === held.id ? h : null; };
    G.QA_fires = G.test.events().filter((e) => e.type === "fire").length;
    return { held };
  });
  if (hold.held) await main.mouse.click(195, 160);
  const only = await main.evaluate(() => {
    if (!G.QA_held) return { held: null };
    G.test.step(1 / 60, 3);
    const held = G.QA_held, r = G.test.state().ropes[1], fires = G.test.events().filter((e) => e.type === "fire").length - G.QA_fires;
    const out = { held, state: r.state, id: r.id, same: Math.hypot(r.anchor.x - held.anchor.x, r.anchor.y - held.anchor.y, r.anchor.z - held.anchor.z) < 0.01, newFires: fires, hint: document.querySelector(".phone-hint").textContent };
    G.city.raycast = G.QA_ray; G.QA_held = null;
    return out;
  });
  join(only.held && only.state === "attached" && only.same && only.newFires === 0 && /Keeping this rope/.test(only.hint), "a tap with the only building held keeps the rope, fires nothing and says so", only);
  await main.evaluate(() => { G.test.press(1, false); G.desktop.mobile.reset(); G.test.step(1 / 60, 20); });

  /* ---------------- join: VIEW, the ring against the picker, vibration on a real catch ---------------- */
  await main.evaluate(() => { const s = G.city.start; G.test.aimAt(1, null); G.desktop.mobile.reset(); G.test.teleport(s.x, s.y, s.z); G.flatcam.setFirstPerson(false); G.test.step(1 / 60, 60); });
  const seq = [];
  for (let i = 0; i < 2; i++) {
    await main.locator("[data-action=view]").click();
    await main.evaluate(() => G.test.step(1 / 60, 3));
    seq.push(await main.evaluate(() => G.flatcam.firstPerson));
  }
  join(seq[0] === true && seq[1] === false, "VIEW switches to first person once, and a second press switches back", seq);
  await main.evaluate(() => { G.flatcam.setFirstPerson(false); G.test.step(1 / 60, 40); });

  const agree = await main.evaluate(() => {
    if (!G.test.target) return { error: "G.test.target is not there yet" };
    const out = [], M = G.desktop.mobile, ring = document.querySelector(".phone-target"), s = G.city.start, R = G.city.goldRing;
    for (const [yawOff, lift] of [[0, 0.45], [0.35, 0.3], [-0.35, 0.3], [0.2, 0.15]]) {
      M.reset(); G.test.teleport(s.x, s.y, s.z); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z)) + yawOff; G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.look(0, lift); G.test.step(1 / 60, 40);
      const t = G.test.target(), r = ring.getBoundingClientRect();
      if (!t || !t.on || !t.ndc || ring.hidden) { out.push({ yawOff, lift, why: "no target or ring", t: t && { on: t.on, ndc: t.ndc }, hidden: ring.hidden }); continue; }
      if (ring.classList.contains("arrow")) { out.push({ yawOff, lift, why: "arrow" }); continue; }
      const nx = Array.isArray(t.ndc) ? t.ndc[0] : t.ndc.x, ny = Array.isArray(t.ndc) ? t.ndc[1] : t.ndc.y;
      const px = (nx * 0.5 + 0.5) * innerWidth, py = (0.5 - ny * 0.5) * innerHeight;
      out.push({ yawOff, lift, gap: Math.hypot((r.left + r.right) / 2 - px, (r.top + r.bottom) / 2 - py) });
    }
    return out;
  });
  const gaps = Array.isArray(agree) ? agree.filter((a) => a.gap !== undefined) : [];
  join(gaps.length >= 1 && gaps.every((a) => a.gap <= 3), "the ring and G.test.target().ndc agree within 3 px", agree);

  const caught = await main.evaluate(() => {
    const s = G.city.start, R = G.city.goldRing, M = G.desktop.mobile;
    G.test.aimAt(1, null); M.reset(); G.test.teleport(s.x, s.y, s.z); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z)); G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.step(1 / 60, 30);
    window.__buzz.length = 0;
    document.querySelector("[data-action=throw]").onclick();
    for (let k = 0; k < 40 && G.test.state().ropes[1].state !== "attached"; k++) G.test.step(1 / 60, 1);
    const attach = [...window.__buzz], pop = document.querySelector(".phone-target").classList.contains("pop");
    return { attach, attached: G.test.state().ropes[1].state === "attached", pop };
  });
  join(caught.attached && caught.attach.includes(15) && caught.pop, "a real attach vibrates for 15 ms and pops the ring", caught);
  // a buzz comes at most once in 40 ms of real time, and G.test.step runs frames much faster than that, so the loop waits between frames
  const pumped = await main.evaluate(async () => {
    const c = G.city.clogs.find((q) => !G.game.info().clogs[q.id].done), S = 1.35, T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, HIT = {};
    let sp = null;
    for (const r of [4.5, 6, 8, 10, 13]) for (let k = 0; k < 16 && !sp; k++) {
      const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
      if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
      if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
      const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
      if (!G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) sp = { x, y: c.y, z };
    }
    if (!sp) return { error: "no spot" };
    G.test.press(1, false); G.desktop.mobile.reset(); G.test.teleport(sp.x, sp.y, sp.z); G.test.step(1 / 60, 3);
    G.test.aimAt(1, T.x, T.y, T.z); window.__buzz.length = 0;
    document.querySelector("[data-action=throw]").onclick();
    for (let k = 0; k < 160 && !window.__buzz.includes(40); k++) { G.test.step(1 / 60, 1); await new Promise((r) => setTimeout(r, 45)); }
    const buzz = [...window.__buzz];
    G.test.step(1 / 60, 200);
    G.test.aimAt(1, null);
    return { buzz, done: G.game.info().clogs[c.id].done };
  });
  join(pumped.done && pumped.buzz.includes(40), "a real pump on a clog vibrates for 40 ms", pumped);

  /* ---------------- the first-time bot: it only taps ---------------- */
  // 30 s of game time from the start roof, facing the gold ring at -10, 0 and +10 degrees. It taps the SWING button every 10 frames
  // while the rope is idle. Pass: three different buildings (by bid) and no respawn.
  const botRuns = [];
  for (const deg of [-10, 0, 10]) {
    const run = await main.evaluate((deg) => {
      G.test.press(1, false); G.test.aimAt(1, null); G.desktop.mobile.reset();
      const C = G.city, s = C.start, R = C.goldRing, btn = document.querySelector("[data-action=throw]");
      G.test.teleport(s.x, s.y, s.z); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z)) + (deg * Math.PI) / 180;
      G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.step(1 / 60, 2); G.desktop.level(0.35); G.test.step(1 / 60, 2);
      const byId = new Map(C.colliders.map((c) => [c.id, c]));
      const keys = new Set(), log = [];
      let respawn = false, prev = { ...G.P.pos }, last = null;
      for (let f = 0; f < 1800; f++) {
        const rope = G.P.ropes[1];
        if (rope.state === "idle" && f % 10 === 0) btn.onclick();
        G.test.step(1 / 60, 1);
        const p = G.P.pos;
        if (Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) > 8 || G.P.dead) respawn = true;
        prev = { x: p.x, y: p.y, z: p.z };
        if (rope.state === "attached" && rope.target && rope.target.tag === "building") {
          const c = byId.get(rope.target.id), key = c && c.bid !== undefined && c.bid >= 0 ? "b" + c.bid : "c" + rope.target.id;
          if (key !== last) { last = key; log.push({ t: +(f / 60).toFixed(1), key }); }
          keys.add(key);
        }
        if (keys.size >= 3 && f >= 60) { return { deg, buildings: keys.size, at: +(f / 60).toFixed(1), respawn, log }; }
      }
      return { deg, buildings: keys.size, at: null, respawn, log };
    }, deg);
    botRuns.push(run);
  }
  join(botRuns.every((r) => r.buildings >= 3 && !r.respawn), "the bot that only taps SWING reaches three different buildings in 30 s at -10, 0 and +10 degrees, with no respawn", botRuns.map((r) => ({ deg: r.deg, n: r.buildings, at: r.at, respawn: r.respawn })));
  console.log("INFO: bot " + JSON.stringify(botRuns.map((r) => ({ deg: r.deg, buildings: r.buildings, at: r.at }))));

  await shot(main, "phone-controls-end");
  check(main.errors.length === 0, "no console error or page error", main.errors.slice(0, 5));
  await main.context().close();

  /* ---------------- the title on other devices (join: agent A wires the labels in wireTitle) ---------------- */
  const hybrid = await phonePage("hybrid");
  const hy = { label: await text(hybrid, "#playFlat"), mouse: await shown(hybrid, "#playMouse"), mouseText: await text(hybrid, "#playMouse"), hybridNote: await shown(hybrid, "#hybridNote"), touchNote: await shown(hybrid, "#touchNote"), deskNote: await shown(hybrid, "#deskNote") };
  join(hy.label === "PLAY WITH TOUCH" && hy.mouse && hy.mouseText === "PLAY WITH MOUSE AND KEYBOARD" && hy.hybridNote && !hy.touchNote && !hy.deskNote, "a touch device with a fine pointer shows both buttons and the hybrid note", hy);
  await shot(hybrid, "phone-controls-title-hybrid");
  check(hybrid.errors.length === 0, "the hybrid title loads with no console error", hybrid.errors.slice(0, 3));
  await hybrid.context().close();
  const desk = await phonePage("desktop", [960, 540]);
  const dk = { label: await text(desk, "#playFlat"), mouse: await shown(desk, "#playMouse"), deskNote: await shown(desk, "#deskNote"), touchNote: await shown(desk, "#touchNote"), hybridNote: await shown(desk, "#hybridNote") };
  join(dk.label === "PLAY ON THIS SCREEN" && !dk.mouse && dk.deskNote && !dk.touchNote && !dk.hybridNote, "a computer with no touch point reads PLAY ON THIS SCREEN and shows the desktop note", dk);
  await shot(desk, "phone-controls-title-desktop");
  check(desk.errors.length === 0, "the computer title loads with no console error", desk.errors.slice(0, 3));
  await desk.context().close();
} catch (e) {
  check(false, "the run finished: " + e.message, String(e.stack || "").split("\n").slice(0, 4).join(" | "));
} finally {
  await close();
}
done();
if (joinFails.length) console.log(`JOIN: ${joinFails.length} check(s) need agent A's wiring (main.js, desktop.js) and fail on a branch with only agent B's files:\n - ${joinFails.join("\n - ")}`);
