// In Full Swing: the flat HUD, a two-line toast, the phone buttons and the pause menu lie inside the window (task J3 of
// openspec/changes/swing-controls, and "The flat HUD, the toast and the pause menu inside the window" of openspec/changes/swing-hero-comic).
// On a flat screen and on a phone all of this is DOM (ui.js builds #fsHud and #fsMenu, desktop.js builds the ring, the arrow, the caption and the
// key strip, mobile.js builds #phoneControls), so the boxes come from getBoundingClientRect. A box counts with its hard shadow. The spoken line
// counts with its tail, which hangs 27 px under it. Sizes: 640 by 360, 960 by 540 and 1280 by 720 with a mouse, and 844 by 390, 390 by 844 and
// 360 by 740 as a touch phone with motion aim on (four top buttons). The suite opens one page for each size and plays about two seconds.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/layout.e2e.mjs   (SIZE=960x540 runs one size, SHOTS=dir keeps pictures)
import { newPage, open, close, watchdog, checker, shot, sleep } from "./lib.mjs";
watchdog(1200000, "layout");
const { check, done } = checker("layout");

const SIZES = [[640, 360, false], [960, 540, false], [1280, 720, false], [844, 390, true], [390, 844, true], [360, 740, true]];

// The device as the page sees it. A phone has touch points, no fine pointer and sensors that say granted. A computer has a mouse. Both have
// no audio device and no game pad, and the pointer lock is never asked for (a real lock can turn the view at a time nobody knows).
// (matchMedia answers for the pointer queries, as in phone-controls.e2e.mjs.)
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

/* ---------------- in the page ---------------- */
// install() runs in the page and puts the helpers on window.LAY.
function install() {
  // The box of an element with its hard shadow, from the computed box-shadow: "rgb(..) 4px 4px 0px 0px" is x, y, blur and spread.
  function grow(e, b) {
    const m = getComputedStyle(e).boxShadow;
    if (!m || m === "none") return b;
    const o = { l: b.l, t: b.t, r: b.r, b: b.b };
    for (const s of m.split(/,(?![^(]*\))/)) {
      if (/inset/.test(s)) continue;
      const [x = 0, y = 0, blur = 0, spread = 0] = (s.replace(/rgba?\([^)]*\)/g, "").match(/-?[\d.]+px/g) || []).map(parseFloat);
      o.l = Math.min(o.l, b.l + x - spread - blur); o.r = Math.max(o.r, b.r + x + spread + blur);
      o.t = Math.min(o.t, b.t + y - spread - blur); o.b = Math.max(o.b, b.b + y + spread + blur);
    }
    return o;
  }
  const seen = (e) => {
    if (e.closest("[hidden]")) return false;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.02;
  };
  const boxOf = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };

  // Every named part of the flat screen that shows now: { name: box with its shadow }. The name is the element, so a check names it.
  function scan() {
    const NAMED = [
      [".fs-top", () => "score row"],
      [".fs-top .fs-pill", (e) => "score pill " + (e.dataset.k || e.title || "?")],
      [".fs-train", () => "training card"],
      [".fs-pump", () => "pump sticker"],
      [".fs-cross", () => "crosshair"],
      [".fs-sub", () => "spoken line with its tail"],
      [".fs-toast", () => "toast"],
      ["#lookHint", () => "look hint"],
      ["#keyHints", () => "key strip"],
      ["#lockRing", () => "lock-on ring"],
      ["#lockArrow", () => "edge arrow"],
      ["#lockCue", () => "LET GO caption"],
      [".phone-top button", (e) => "top button " + e.textContent.trim().toUpperCase()],
      [".phone-target", () => "phone ring or arrow"],
      [".phone-crosshair", () => "centre ring"],
      [".phone-hint", () => "hint over SWING"],
      ["[data-action=throw]", () => "SWING button"],
      [".phone-bottom", () => "SWING panel"],
      [".phone-climb button", (e) => "climb pad " + (e.dataset.climb || e.dataset.action)],
    ];
    const items = {};
    for (const [sel, name] of NAMED) {
      for (const e of document.querySelectorAll(sel)) {
        if (!seen(e)) continue;
        let b = grow(e, boxOf(e));
        if (e.matches(".fs-sub")) b = { ...b, b: b.b + 27 }; // the tail of the speech balloon hangs 27 px under its box (ui.js)
        items[name(e)] = b;
      }
    }
    // every visible element under the HUD, the strip, the marker and the phone panel, with no shadow. The speed lines of the phone (.phone-rush) fill
    // the screen and reach past it on purpose; they are clear at rest.
    const W = innerWidth, H = innerHeight, out = [], cut = [];
    let count = 0;
    for (const e of document.querySelectorAll("#fsHud, #fsHud *, #phoneControls *, #lookHint, #lookHint *, #keyHints, #keyHints *, #lockRing, #lockRing *, #lockArrow, #lockArrow *, #lockCue")) {
      if (e.matches(".phone-rush") || !seen(e)) continue;
      count++;
      // text that runs out of the box of its element (the range of a text node has the box of its words; a glyph box may be a few px taller than a short line box)
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const r = document.createRange(); r.selectNode(n);
        const q = r.getBoundingClientRect(), eb = e.getBoundingClientRect();
        if (q.right > eb.right + 1 || q.left < eb.left - 1 || q.bottom > eb.bottom + 8 || q.top < eb.top - 8) cut.push((e.id || e.className.baseVal || e.className || e.tagName) + " " + JSON.stringify({ text: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)], box: [Math.round(eb.left), Math.round(eb.top), Math.round(eb.right), Math.round(eb.bottom)] }));
      }
      const b = boxOf(e);
      if (b.l < -0.5 || b.t < -0.5 || b.r > W + 0.5 || b.b > H + 0.5) out.push((e.id || e.className.baseVal || e.className || e.tagName) + " " + JSON.stringify({ l: Math.round(b.l), t: Math.round(b.t), r: Math.round(b.r), b: Math.round(b.b) }));
    }
    // the page and the HUD layer: a fixed layer scrolls nothing by itself, but its scroll size shows a child that runs past the window
    const de = document.documentElement, bo = document.body, hud = document.querySelector("#fsHud");
    return { items, sweep: { count, out: out.slice(0, 6), n: out.length, cut: cut.slice(0, 6) }, scroll: { w: Math.max(de.scrollWidth, bo.scrollWidth, hud.scrollWidth), h: Math.max(de.scrollHeight, bo.scrollHeight, hud.scrollHeight) }, W, H, touch: !!document.querySelector("#phoneControls:not([hidden])") };
  }
  // How many lines does a text have in an element? (a text range has one box for each line)
  function lineCount(e) {
    const r = document.createRange(); r.selectNodeContents(e);
    const tops = [];
    for (const q of r.getClientRects()) if (!tops.some((t) => Math.abs(t - q.top) < 8)) tops.push(q.top);
    return tops.length;
  }
  // The pause menu: the panel, each button, and whether anything in it scrolls or is cut off.
  function menuScan() {
    const m = document.querySelector("#fsMenu"), W = innerWidth, H = innerHeight;
    const buttons = [...m.querySelectorAll("button")].map((b) => ({ name: b.textContent.trim(), box: grow(b, boxOf(b)), cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 }));
    const heading = m.querySelector("h2");
    return { open: m.open, panel: grow(m, boxOf(m)), heading: heading && { text: heading.textContent.trim(), box: grow(heading, boxOf(heading)) }, buttons, scroll: { v: m.scrollHeight - m.clientHeight, h: m.scrollWidth - m.clientWidth }, W, H };
  }
  // One building with a clear street face (+x), and a way to fly into it so that the hero holds the wall (a copy of the helper of phone-controls.e2e.mjs).
  function wallSetup() {
    const C = G.city;
    const B = C.colliders.find((c) => {
      if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
      if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
      const z = (c.minZ + c.maxZ) / 2;
      for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
      return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
    });
    if (!B) return false;
    G.test.teleport(B.maxX + 3, B.maxY / 2, (B.minZ + B.maxZ) / 2); G.rigYaw = Math.PI / 2; G.desktop.level(0); G.P.vel.x = -8; G.test.step(1 / 60, 30);
    return !!G.P.wall;
  }
  window.LAY = { scan, lineCount, menuScan, wallSetup };
}

/* ---------------- the checks ---------------- */
const inside = (b, W, H) => !!b && b.l >= -0.5 && b.t >= -0.5 && b.r <= W + 0.5 && b.b <= H + 0.5;
const round = (b) => b && { l: Math.round(b.l), t: Math.round(b.t), r: Math.round(b.r), b: Math.round(b.b) };
const hit = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
// one check for each named element that must show, and one more for each other element that shows
function checkBoxes(tag, S, must) {
  for (const name of must) check(!!S.items[name] && inside(S.items[name], S.W, S.H), `[${tag}] ${name} shows and lies inside the window (box, border and shadow)`, S.items[name] ? { box: round(S.items[name]), window: [S.W, S.H] } : "it does not show");
  for (const [name, b] of Object.entries(S.items)) if (!must.includes(name)) check(inside(b, S.W, S.H), `[${tag}] ${name} lies inside the window (box, border and shadow)`, { box: round(b), window: [S.W, S.H] });
  check(S.sweep.n === 0, `[${tag}] all ${S.sweep.count} visible elements of the HUD and the phone panel lie inside the window`, S.sweep.out);
  check(S.sweep.cut.length === 0, `[${tag}] no text runs out of its box in the HUD and the phone panel`, S.sweep.cut);
  check(S.scroll.w <= S.W && S.scroll.h <= S.H, `[${tag}] the page and the HUD layer do not scroll (${S.scroll.w} by ${S.scroll.h} in a window of ${S.W} by ${S.H})`);
}

async function run(w, h, touch) {
  const tag = `${w}x${h}`;
  const page = await newPage({ width: w, height: h });
  await page.addInitScript(device, { touch, fine: !touch });
  await open(page, "?nosw&skipintro");
  await page.waitForFunction(() => G.viewDone);
  await page.evaluate(install);
  await page.locator("#playFlat").click();
  await page.waitForFunction(() => G.state === "play");
  await page.evaluate(async (touch) => {
    G.test.hold(true);
    const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.rigYaw = s.yaw; G.flatcam.reset(s.yaw);
    if (touch) await G.desktop.mobile.start();
    G.test.step(1 / 60, 90);
  }, touch);

  // the longest spoken line of the device, and a two-line toast built from the words of the unlock toasts of game.js
  const words = await page.evaluate(async (touch) => {
    const C = await import("./js/config.js"), table = touch ? C.LINES_PHONE : C.LINES_DESKTOP;
    const longest = [...new Set(Object.values(table).flat())].reduce((a, b) => (b.length > a.length ? b : a));
    const toastEl = document.querySelector(".fs-toast"), probe = toastEl.cloneNode(false);
    toastEl.parentNode.appendChild(probe);
    const all = "Loonie bank 120. Your plunger cups are gold. Every flush has fireworks. You have the Golden Plunger. Keep swinging, there are more clogs.".split(" ");
    let text = "";
    for (let n = 1; n <= all.length; n++) { probe.textContent = text = all.slice(0, n).join(" "); if (LAY.lineCount(probe) >= 2) break; }
    const lines = LAY.lineCount(probe);
    probe.remove();
    return { longest, toast: text, lines };
  }, touch).catch(() => null);
  if (!words) throw new Error("the words of the page could not be read at " + tag);
  await page.evaluate(({ longest, toast }) => { G.ui.say(longest, 60); G.ui.toast(toast); G.test.step(1 / 60, 20); }, words);
  await page.waitForFunction(() => [".fs-sub", ".fs-toast"].every((s) => getComputedStyle(document.querySelector(s)).opacity === "1"));
  await sleep(160); // the marker reads the HUD at most 10 times a second in real time
  await page.evaluate(() => G.test.step(1 / 60, 3));
  const lines = await page.evaluate(() => LAY.lineCount(document.querySelector(".fs-toast")));
  check(lines === 2, `[${tag}] the toast has two lines`, { lines, text: words.toast });

  /* ---------------- the HUD with a spoken line and a two-line toast ---------------- */
  let S = await page.evaluate(() => LAY.scan());
  check(S.W === w && S.H === h, `[${tag}] the window is ${w} by ${h}`, { W: S.W, H: S.H });
  check(S.touch === touch, `[${tag}] the phone panel ${touch ? "shows" : "is hidden"}`);
  const must = ["score row", "score pill Loonies", "score pill Clogs", "spoken line with its tail", "toast"];
  if (touch) must.push("top button MOTION", "top button CENTER", "top button VIEW", "top button PAUSE", "SWING button", "SWING panel", "hint over SWING", "phone ring or arrow");
  else must.push("key strip");
  checkBoxes(tag, S, must);
  if (!touch) check(!!(S.items["lock-on ring"] || S.items["edge arrow"]), `[${tag}] the lock-on ring or the edge arrow shows`);
  if (touch) {
    const row = ["top button MOTION", "top button CENTER", "top button VIEW", "top button PAUSE"].map((n) => S.items[n]);
    check(row.every(Boolean) && Math.max(...row.map((b) => b.t)) - Math.min(...row.map((b) => b.t)) < 2, `[${tag}] the four top buttons are one row`, row.map(round));
    // the spec: the text does not overlap the SWING button (the line and its tail, and the toast)
    for (const name of ["spoken line with its tail", "toast"]) check(!!S.items[name] && !!S.items["SWING panel"] && !hit(S.items[name], S.items["SWING panel"]), `[${tag}] the ${name.replace(" with its tail", "")} does not overlap the SWING panel`, { [name]: round(S.items[name]), panel: round(S.items["SWING panel"]) });
  } else {
    check(!!S.items["toast"] && !!S.items["key strip"] && !hit(S.items["toast"], S.items["key strip"]), `[${tag}] the toast does not overlap the key strip`, { toast: round(S.items["toast"]), strip: round(S.items["key strip"]) });
    // the caption of the release cue: shown by hand and read in the same turn, as flat.mjs does (a game frame would clear it)
    S = await page.evaluate(() => { G.desktop.marker({ x: 0.2, y: 0.4, kind: "swing", dist: 30, behind: false, go: true }); G.desktop.cue(true); const s = LAY.scan(); G.desktop.cue(false); G.desktop.marker(null); return s; });
    checkBoxes(tag + " with the LET GO caption", S, ["LET GO caption"]);
  }
  await shot(page, "layout-" + tag + "-hud");

  /* ---------------- a wall: the climb pad of the phone, and the arrow behind the camera ---------------- */
  // On a wall in third person the target lies behind the camera: the marker is an arrow on the bottom border of the safe window. The training card
  // and the spoken line draw over the marker, so the arrow must not lie under one of them.
  const held = await page.evaluate(() => LAY.wallSetup());
  check(held, `[${tag}] the hero holds a wall`);
  if (held) {
    await page.evaluate(({ longest, toast }) => { G.ui.say(longest, 60); G.ui.toast(toast); G.test.step(1 / 60, 20); }, words);
    await page.waitForFunction(() => [".fs-sub", ".fs-toast"].every((s) => getComputedStyle(document.querySelector(s)).opacity === "1"));
    await sleep(160);
    await page.evaluate(() => G.test.step(1 / 60, 3));
    S = await page.evaluate(() => LAY.scan());
    checkBoxes(tag + " on a wall", S, touch ? ["climb pad up", "climb pad down", "climb pad left", "climb pad right", "climb pad hop", "SWING button"] : ["edge arrow"]);
    const arrow = S.items[touch ? "phone ring or arrow" : "edge arrow"];
    // (the spec keeps the marker clear of the pills, the top buttons, the spoken line, the SWING panel and the climb pad, and the code also keeps it out of the training card and the key strip: the toast is in none of these lists)
    const over = Object.entries(S.items).filter(([name, b]) => /^(score pill|training card|spoken line|key strip|climb pad|SWING panel|hint over SWING|top button)/.test(name) && arrow && hit(b, arrow)).map(([name]) => name);
    check(!!arrow && over.length === 0, `[${tag} on a wall] the arrow behind the camera shows and no HUD box covers it`, { arrow: round(arrow), under: over });
    await shot(page, "layout-" + tag + "-wall");
  }
  await page.evaluate(() => { const s = G.city.start; G.test.teleport(s.x, s.y, s.z); G.test.step(1 / 60, 5); });

  /* ---------------- the pause menu ---------------- */
  await page.evaluate(() => { G.ui.openPause(); G.test.step(1 / 60, 3); });
  let M = await page.evaluate(() => LAY.menuScan());
  check(M.open && M.buttons.length >= 4, `[${tag}] the pause menu is open and has its buttons`, { open: M.open, buttons: M.buttons.map((b) => b.name) });
  check(inside(M.panel, M.W, M.H), `[${tag}] pause menu panel lies inside the window (box, border and shadow)`, { panel: round(M.panel), window: [M.W, M.H] });
  check(!!M.heading && inside(M.heading.box, M.W, M.H), `[${tag}] pause menu title lies inside the window`, M.heading && round(M.heading.box));
  for (const b of M.buttons) check(inside(b.box, M.W, M.H), `[${tag}] pause menu button ${b.name} lies inside the window (box, border and shadow)`, { box: round(b.box), window: [M.W, M.H] });
  check(M.buttons.every((b) => !b.cut), `[${tag}] no pause menu button cuts off its words`, M.buttons.filter((b) => b.cut).map((b) => b.name));
  check(M.scroll.v <= 1 && M.scroll.h <= 1, `[${tag}] the pause menu panel does not scroll inside (${M.scroll.v} px too tall, ${M.scroll.h} px too wide)`);
  await shot(page, "layout-" + tag + "-pause");
  // The Comfort page is the longest page of the same panel. On a small window it may scroll up and down inside its panel (the panel keeps its
  // maximum height). It must never run sideways: its buttons stay between the edges of the window, and the panel has no sideways scroll.
  await page.evaluate(() => { document.querySelector("#fsMenu button[data-id=comfort]").click(); G.test.step(1 / 60, 2); });
  M = await page.evaluate(() => LAY.menuScan());
  check(M.open && inside(M.panel, M.W, M.H), `[${tag}] pause menu Comfort page panel lies inside the window (box, border and shadow)`, { panel: round(M.panel), window: [M.W, M.H] });
  const wide = M.buttons.filter((b) => b.box.l < -0.5 || b.box.r > M.W + 0.5);
  check(M.buttons.length >= 6 && wide.length === 0, `[${tag}] the ${M.buttons.length} buttons of the pause menu Comfort page lie between the left and right edges of the window`, wide.map((b) => b.name + " " + JSON.stringify(round(b.box))));
  check(M.scroll.h <= 1, `[${tag}] the pause menu Comfort page does not scroll sideways inside its panel (${M.scroll.h} px too wide)`);
  check(M.buttons.every((b) => !b.cut), `[${tag}] no Comfort page button cuts off its words`, M.buttons.filter((b) => b.cut).map((b) => b.name));
  console.log(`INFO: [${tag}] the Comfort page scrolls ${Math.max(0, M.scroll.v)} px up and down inside its panel`);
  await shot(page, "layout-" + tag + "-comfort");
  await page.evaluate(() => { G.ui.closePause(); G.test.step(1 / 60, 3); });
  check(page.errors.length === 0, `[${tag}] no console error or page error`, page.errors.slice(0, 4));
  await page.context().close();
}

try {
  for (const [w, h, touch] of SIZES) if (!process.env.SIZE || process.env.SIZE === w + "x" + h) await run(w, h, touch);
} catch (e) {
  check(false, "the run finished: " + e.message, String(e.stack || "").split("\n").slice(0, 4).join(" | "));
} finally {
  await close();
}
done();
