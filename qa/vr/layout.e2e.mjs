// In Full Swing: the flat HUD, a two-line toast, the phone buttons and the pause menu lie inside the window (task J3 of
// openspec/changes/swing-controls, and "The flat HUD, the toast and the pause menu inside the window" of openspec/changes/swing-hero-comic).
// On a flat screen and on a phone all of this is DOM (ui.js builds #fsHud and #fsMenu, desktop.js builds the ring, the arrow, the caption and the
// key strip, mobile.js builds #phoneControls), so the boxes come from getBoundingClientRect. A box counts with its hard shadow. The spoken line
// counts with its tail, which hangs 27 px under it. The toast lies under that tail. On a computer the look hint ("Click to look around") draws
// under the spoken line, the toast and the edge arrow, and it fades out while the line or the toast is over its place. Sizes: 640 by 360, 960 by 540 and 1280 by 720 with a mouse, and 844 by 390, 390 by 844 and
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
      [".phone-hint", () => "hint"],
      [".phone-bottom", () => "hint panel"],
      [".phone-side", (e) => "plunger badge " + e.textContent.trim()],
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
  // The look hint with its shadow, and its opacity (it fades out while the spoken line or the toast is over its place). null when the game does not show it.
  function hintNow() {
    const hint = document.querySelector("#lookHint");
    return !hint || hint.hidden ? null : { box: grow(hint, boxOf(hint)), opacity: Number(getComputedStyle(hint).opacity) };
  }
  // Does the look hint draw over a part of the HUD? { n, over }: n is how many of 12 by 8 points in the common box of the two lie inside both,
  // over is how many of those the hint draws on top of. This is the order of the layers, so the fade of the hint does not count (a hint with no opacity
  // still takes the points). Pointer events are on while the probe runs, so that elementsFromPoint lists the parts that have none (all of the HUD),
  // from the top down. null when the game does not show the hint or the part does not show.
  function covers(sel) {
    const hint = document.querySelector("#lookHint"), part = document.querySelector(sel);
    if (!hint || hint.hidden || !part || !seen(part)) return null;
    const a = hint.getBoundingClientRect(), b = part.getBoundingClientRect();
    const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), d = Math.min(a.bottom, b.bottom);
    const out = { n: 0, over: 0, hint: boxOf(hint), part: boxOf(part) };
    if (l >= r || t >= d) return out;
    const probe = document.createElement("style");
    probe.textContent = "* { pointer-events: auto !important; }";
    document.head.append(probe);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
      const stack = document.elementsFromPoint(l + ((r - l) * (i + 0.5)) / 12, t + ((d - t) * (j + 0.5)) / 8);
      const h = stack.findIndex((e) => hint.contains(e)), p = stack.findIndex((e) => part.contains(e));
      if (h < 0 || p < 0) continue;
      out.n++;
      if (h < p) out.over++;
    }
    probe.remove();
    return out;
  }
  window.LAY = { scan, lineCount, menuScan, wallSetup, covers, hintNow };
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

// On a computer the look hint shows, unless the spoken line (with its tail) or the toast is over its place: then it is faded out, and nobody reads
// half of it. The edge arrow is not in this rule: it stays for minutes, and it draws over the hint (a few letters at most). The boxes count with their
// shadows. tally counts the times a part was over the place of the hint (see the end of the run).
async function hintState(page, tag, state, tally) {
  // the marker reads the HUD at most 10 times a second in real time, the game decides about the fade a few times a second (0.2 s of play is enough),
  // and the fade itself takes 0.25 s of real time
  await sleep(250);
  await page.evaluate(() => G.test.step(1 / 60, 12));
  await page.waitForFunction(() => { const e = document.querySelector("#lookHint"); return getComputedStyle(e).opacity === (e.classList.contains("covered") ? "0" : "1"); });
  const [H, S] = await page.evaluate(() => [LAY.hintNow(), LAY.scan()]);
  const line = S.items["spoken line with its tail"], toast = S.items["toast"];
  const meets = { line: !!(H && line && hit(H.box, line)), toast: !!(H && toast && hit(H.box, toast)) };
  for (const part of Object.keys(tally)) tally[part] += +meets[part];
  const covered = meets.line || meets.toast, shows = !!H && H.opacity === 1;
  check(!!H && shows === !covered, `[${tag}] ${state}: the look hint ${covered ? "is faded out" : "shows"} (the spoken line or the toast ${covered ? "is" : "is not"} over its place)`, { hint: H && { box: round(H.box), opacity: H.opacity }, line: round(line), toast: round(toast), meets });
  if (shows) check(inside(H.box, S.W, S.H), `[${tag}] ${state}: the look hint lies inside the window (box, border and shadow)`, { box: round(H.box), window: [S.W, S.H] });
}
const tally = { line: 0, toast: 0 }, shared = { "spoken line": 0, toast: 0, "edge arrow": 0 };

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
  if (!touch) {
    // nothing over the place of the hint: it shows. Then the spoken line alone (it reaches the hint on a low window only).
    // (the game asks for the pointer lock for 2 s first: the hint shows after that, and the first line of the game fades out in real time)
    await page.evaluate(async () => {
      G.ui.say("");
      for (let i = 0; i < 60 && (document.querySelector("#lookHint").hidden || getComputedStyle(document.querySelector(".fs-sub")).opacity !== "0"); i++) { await new Promise((r) => setTimeout(r, 100)); G.test.step(1 / 60, 2); }
    });
    await hintState(page, tag, "with no line and no toast", tally);
    await page.evaluate((longest) => { G.ui.say(longest, 60); G.test.step(1 / 60, 20); }, words.longest);
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".fs-sub")).opacity === "1");
    await sleep(160);
    await page.evaluate(() => G.test.step(1 / 60, 3));
    await hintState(page, tag, "with the spoken line", tally);
  }
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
  if (touch) must.push("top button MOTION", "top button CENTER", "top button VIEW", "top button PAUSE", "hint panel", "hint", "plunger badge L", "plunger badge R", "phone ring or arrow");
  else must.push("key strip");
  checkBoxes(tag, S, must);
  // the toast starts under the tail of the spoken line (the tail hangs 27 px under the box of the line, and the toast is tilted a little)
  const line = S.items["spoken line with its tail"], toast = S.items["toast"];
  check(!!line && !!toast && !hit(line, toast), `[${tag}] the toast does not overlap the spoken line or its tail`, line && toast && { line: round(line), toast: round(toast), toastCoversTail: Math.round(line.b - toast.t) });
  if (line && toast) console.log(`INFO: [${tag}] the toast starts ${Math.round(toast.t - line.b)} px under the tail of the spoken line` + (S.items["training card"] && hit(S.items["training card"], toast) ? `, and covers ${Math.round(toast.b - S.items["training card"].t)} px of the training card` : ""));
  if (!touch) check(!!(S.items["lock-on ring"] || S.items["edge arrow"]), `[${tag}] the lock-on ring or the edge arrow shows`);
  if (touch) {
    const row = ["top button MOTION", "top button CENTER", "top button VIEW", "top button PAUSE"].map((n) => S.items[n]);
    check(row.every(Boolean) && Math.max(...row.map((b) => b.t)) - Math.min(...row.map((b) => b.t)) < 2, `[${tag}] the four top buttons are one row`, row.map(round));
    // the spec: the text does not overlap the hint panel (the line and its tail, and the toast)
    for (const name of ["spoken line with its tail", "toast"]) check(!!S.items[name] && !!S.items["hint panel"] && !hit(S.items[name], S.items["hint panel"]), `[${tag}] the ${name.replace(" with its tail", "")} does not overlap the hint panel`, { [name]: round(S.items[name]), panel: round(S.items["hint panel"]) });
  } else {
    check(!!S.items["toast"] && !!S.items["key strip"] && !hit(S.items["toast"], S.items["key strip"]), `[${tag}] the toast does not overlap the key strip`, { toast: round(S.items["toast"]), strip: round(S.items["key strip"]) });
    // the look hint fades out while the line or the toast is over its place, and it lies under the spoken line, the toast and the edge arrow (the pointer
    // is free here, so the game shows the hint). The arrow is shown by hand at the top of the window, where the lock-on marker puts it for a target above
    // the screen, and read in the same turn.
    await hintState(page, tag, "with the spoken line and the toast", tally);
    const under = await page.evaluate(() => {
      G.desktop.marker({ x: 0, y: 2, kind: "swing", dist: 30, behind: false, go: false });
      const c = { "spoken line": LAY.covers(".fs-sub"), toast: LAY.covers(".fs-toast"), "edge arrow": LAY.covers("#lockArrow") };
      G.desktop.marker(null);
      return c;
    });
    for (const [name, c] of Object.entries(under)) {
      shared[name] += c ? c.n : 0;
      check(!!c && c.over === 0, `[${tag}] the look hint does not draw over the ${name}`, c && { ...c, hint: round(c.hint), part: round(c.part) });
    }
    console.log(`INFO: [${tag}] the look hint shares ${Object.entries(under).map(([name, c]) => (c ? c.n : "?") + " of 96 points with the " + name).join(", ")}`);
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
    checkBoxes(tag + " on a wall", S, touch ? ["climb pad up", "climb pad down", "climb pad left", "climb pad right", "climb pad hop", "hint panel"] : ["edge arrow"]);
    if (touch) check(!S.items["plunger badge L"] && !S.items["plunger badge R"], `[${tag} on a wall] the plunger badges hide while the climb pad shows`, Object.keys(S.items).filter((n) => /badge/.test(n)));
    const wallLine = S.items["spoken line with its tail"], wallToast = S.items["toast"];
    check(!!wallLine && !!wallToast && !hit(wallLine, wallToast), `[${tag} on a wall] the toast does not overlap the spoken line or its tail`, wallLine && wallToast && { line: round(wallLine), toast: round(wallToast), toastCoversTail: Math.round(wallLine.b - wallToast.t) });
    const arrow = S.items[touch ? "phone ring or arrow" : "edge arrow"];
    // (the spec keeps the marker clear of the pills, the top buttons, the spoken line, the hint panel and the climb pad, and the code also keeps it out of the training card and the key strip: the toast is in none of these lists)
    const over = Object.entries(S.items).filter(([name, b]) => /^(score pill|training card|spoken line|key strip|climb pad|hint panel|hint|plunger badge|top button)/.test(name) && arrow && hit(b, arrow)).map(([name]) => name);
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
  // The checks of the look hint need a part over its place to be able to fail. A part is over it at some sizes only (the line at 640 by 360, the toast
  // and the arrow at the two larger ones), so this counts over all three sizes of a computer.
  if (!process.env.SIZE) {
    check(tally.line > 0, "[all sizes] the spoken line is over the place of the look hint at one size at least, so the fade check can fail", tally);
    check(tally.toast > 0, "[all sizes] the toast is over the place of the look hint at one size at least, so the fade check can fail", tally);
    for (const [name, n] of Object.entries(shared)) check(n > 0, `[all sizes] the ${name} meets the look hint at one size at least, so the check of the order of the layers can fail`, shared);
  }
} catch (e) {
  check(false, "the run finished: " + e.message, String(e.stack || "").split("\n").slice(0, 4).join(" | "));
} finally {
  await close();
}
done();
