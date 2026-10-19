// First Breath: keys, focus and the pause button in the browser (design.md 5.3, 8, 9, 16.3; the input spec). With the
// site served (it starts `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless
// Chromium with --disable-gpu, it checks:
// - a key held from play never clicks the button a new screen focuses: Space or Enter held (with its OS repeats)
//   from the ending into the run result leaves Play again alone, and Space held from the stage 7 rest into the
//   overlay leaves Next alone; a fresh press still clicks (review F7);
// - the pause button shows over the overlay and the Almost card and takes the tap or click there, at 390 × 844 with
//   touch and at 1440 × 900, while a tap on a HUD tag still reaches the screen under it (review F6);
// - with the game switcher open over Pause, a click on its heading (the focus leaves it) and then P or Esc never
//   resumes the run: P does nothing, Esc closes the switcher, and the run stays paused (review F8);
// - Space let go while paused, or while the page is hidden, still ends the hold at Resume: Birth's first wave is the
//   same as with no pause (review F9);
// - in Birth on a desktop many keys make one hold: Left then Right (Left let go) holds the turn wave all through,
//   and Space then Down (Space let go) holds the tuck wave with the tuck (review F12);
// - Tab to the HUD's pause button in play, then Space or Enter: no pause, and the press is the stage's; over the
//   overlay, where it is a button like Next, Enter on it pauses (review F16);
// - the prompt line names keys on a desktop (stage 3: "Press Space as the ring closes."), touch on a phone, and the
//   button in one-button mode (stage 2 guard: "Hold to guard your shell."); the stage 7 rest asks for a touch, not
//   the thumb kept from the turn (review F13, F15, F17).
// - the three devices (tasks.md 5.5): at 390 × 844 and 844 × 390 with touch, a tap on Play starts the run, and at
//   1440 × 900 a click or Enter does; in each of stages 1 to 8, reached by goto, the first prompt that asks for a
//   gesture gets it from that device's control (a real CDP touch, the keys, and on the desktop also a mouse drag in
//   stage 1 and a click in stage 3), and the stage's result, probe or subject then differ from an idle twin that
//   takes the same steps (two idle twins of each stage are the same, the control); in one-button mode, Space held on
//   the desktop, or one touch held in portrait, takes stage 1 to the meeting place in the top 3.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/input.e2e.mjs        (BASE_URL=http://host:port for another server)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/input.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const SIZES = {
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();

let passed = 0;
const failed = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

// ---- the server
async function answers() {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; }
}
let server = null;
if (!(await answers()) && !process.env.BASE_URL) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")],
    { stdio: "ignore", detached: false });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) {
  console.log(`FAIL ${FILE}: nothing answers at ${BASE}`);
  if (server) server.kill();
  process.exit(1);
}

const exe = process.env.CHROMIUM || process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ["--disable-gpu"] });

async function open(size, query) {
  const ctx = await browser.newContext({ ...SIZES[size] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* off */ } });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state && window.__fb.state().frames > 0, null, { timeout: 60000 });
  return { ctx, page, errors };
}

const S = (page) => page.evaluate(() => {
  const s = window.__fb.state(), a = document.activeElement;
  return { screen: s.screen, stageId: s.stageId, moment: s.moment, t: s.t, paused: s.paused, prompt: s.prompt && s.prompt.line,
    judges: s.judges.length, active: a ? a.id || (a.dataset && a.dataset.act) || a.tagName : null };
});
const stepTo = (page, t) => page.evaluate((t) => { let n = 0; while (window.__fb.state().t < t - 1e-6 && n++ < 20000) window.__fb.step(1); }, t);
const stepWhile = (page, screen) => page.evaluate((screen) => { let n = 0; while (window.__fb.state().screen === screen && n++ < 6000) window.__fb.step(1); }, screen);
const wave = (page, n) => page.evaluate((n) => window.__fb.result().metrics.waves[n - 1], n);
const settle = () => wait(60);
const hidden = (page, on) => page.evaluate((on) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
  if (on) document.dispatchEvent(new Event("visibilitychange"));
}, on);
// What a tap at the pause button's centre lands on.
const pauseHit = (page) => page.evaluate(() => {
  const b = document.getElementById("pause"), r = b.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
  return { x, y, shown: !document.getElementById("hud").hidden && r.width > 0, onPause: !!(e && e.closest && e.closest("#pause")),
    hit: e ? `${e.tagName}${e.id ? "#" + e.id : ""}${e.dataset && e.dataset.screen ? "[" + e.dataset.screen + "]" : ""}` : null };
});
async function tapAt(page, size, x, y) {
  if (SIZES[size].hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

// ---- 1. a key held from play never clicks the button a new screen focuses (F7)
for (const key of ["Space", "Enter"]) {
  const { ctx, page, errors } = await open("desktop", "?test=1&stage=ending");
  await page.evaluate(() => { let n = 0; while (window.__fb.state().moment !== "time" && n++ < 6000) window.__fb.step(1); });
  await page.keyboard.down(key);
  await stepWhile(page, "ending");
  const up1 = await S(page);
  await page.keyboard.down(key);                 // the OS repeats of a held key (repeat: true)
  await page.keyboard.down(key);
  await settle();
  const mid = await S(page);
  await page.keyboard.up(key);
  await settle();
  const after = await S(page);
  check(`desktop: ${key} held from the ending into the result leaves Play again alone`,
    up1.screen === "result" && mid.screen === "result" && after.screen === "result" && after.active === "again",
    `${JSON.stringify(up1)} → ${JSON.stringify(after)}`);
  await page.keyboard.press(key);                // a fresh press still clicks Play again
  await settle();
  const fresh = await S(page);
  check(`desktop: a fresh ${key} on Play again starts a new run`, fresh.screen !== "result", JSON.stringify(fresh));
  check(`desktop: no page errors (${key} held into the result)`, errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open("desktop", "?test=1&stage=7");
  await page.evaluate(() => window.__fb.jump("rest"));
  await page.keyboard.down("Space");
  await stepWhile(page, "stage");
  const up1 = await S(page);
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await settle();
  const after = await S(page);
  check("desktop: Space held from the stage 7 rest into the overlay leaves Next alone",
    up1.screen === "overlay" && after.screen === "overlay" && after.active === "next", `${JSON.stringify(up1)} → ${JSON.stringify(after)}`);
  check("desktop: no page errors (Space held into the overlay)", errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 2. the pause button takes the tap over the overlay and the Almost card (F6)
for (const size of Object.keys(SIZES)) {
  const { ctx, page, errors } = await open(size, "?test=1&seed=7&mute=1");
  await page.evaluate(() => {
    window.__fb.act("play"); window.__fb.step(60); window.__fb.finish();
    if (window.__fb.state().screen === "almost") window.__fb.act("goOn");
  });
  const ov = await S(page);
  const hit = await pauseHit(page);
  check(`${size}: over the overlay the pause button is the thing under its centre`, ov.screen === "overlay" && hit.shown && hit.onPause,
    `${ov.screen}: ${JSON.stringify(hit)}`);
  // a HUD tag lets a tap through to the screen under it
  const tag = await page.evaluate(() => {
    const p = document.querySelector("#hud [data-hud=score]"), r = p.getBoundingClientRect();
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 ? !!(e && e.closest && e.closest("#screens")) : true;
  });
  check(`${size}: over the overlay a tap on a HUD tag still reaches the screen`, tag);
  await tapAt(page, size, hit.x, hit.y);
  await settle();
  const p1 = await S(page);
  check(`${size}: a ${SIZES[size].hasTouch ? "tap" : "click"} on the pause button over the overlay pauses`, p1.paused === true, JSON.stringify(p1));
  await page.evaluate(() => window.__fb.act("resume"));
  if (!SIZES[size].hasTouch) {
    // over the overlay the focused pause button is a button like Next: Enter pauses
    await page.focus("#pause");
    await page.keyboard.press("Enter");
    await settle();
    const pk = await S(page);
    check(`${size}: Enter on the focused pause button over the overlay pauses`, pk.paused === true, JSON.stringify(pk));
    await page.evaluate(() => window.__fb.act("resume"));
  }
  await page.evaluate(() => { window.__fb.goto("swim"); window.__fb.step(60 * 130); });
  const al = await S(page);
  const hit2 = await pauseHit(page);
  check(`${size}: over the Almost card the pause button is the thing under its centre`, al.screen === "almost" && hit2.shown && hit2.onPause,
    `${al.screen}: ${JSON.stringify(hit2)}`);
  await tapAt(page, size, hit2.x, hit2.y);
  await settle();
  const p2 = await S(page);
  check(`${size}: a ${SIZES[size].hasTouch ? "tap" : "click"} on the pause button over the Almost card pauses`, p2.paused === true, JSON.stringify(p2));
  check(`${size}: no page errors (pause button)`, errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 3. the game switcher over Pause takes the keys (F8)
{
  const { ctx, page, errors } = await open("desktop", "?stage=1&mute=1");
  await wait(800);
  await page.keyboard.press("Escape");
  await wait(100);
  const paused = await S(page);
  await page.click("section[data-screen=pause] [data-switch]", { timeout: 5000 });
  await wait(300);
  await page.click(".gsw-card h2", { timeout: 5000 });   // not focusable: the focus leaves the dialog
  await wait(100);
  const open1 = await page.evaluate(() => ({ open: !!(window.GameSwitch && window.GameSwitch.isOpen), active: document.activeElement && document.activeElement.tagName }));
  await page.keyboard.press("KeyP");
  await wait(300);
  const afterP = await S(page);
  const openP = await page.evaluate(() => !!window.GameSwitch.isOpen);
  await page.keyboard.press("Escape");
  await wait(300);
  const afterEsc = await S(page);
  const openEsc = await page.evaluate(() => !!window.GameSwitch.isOpen);
  await wait(700);
  const later = await S(page);
  check("desktop: the switcher opens over Pause and the focus can leave it", paused.paused && open1.open && open1.active === "BODY",
    JSON.stringify({ paused, open1 }));
  check("desktop: P with the switcher open does not resume the run", afterP.paused === true && openP === true, JSON.stringify({ afterP, openP }));
  check("desktop: Esc with the focus outside the switcher closes it and the run stays paused",
    afterEsc.paused === true && openEsc === false && later.paused === true && Math.abs(later.t - paused.t) < 1e-6,
    JSON.stringify({ paused: paused.t, afterEsc, openEsc, later }));
  check("desktop: no page errors (switcher)", errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 4. a release made while paused or hidden still ends the hold (F9)
{
  const runs = {};
  for (const mode of ["none", "pause", "hidden"]) {
    const { ctx, page, errors } = await open("desktop", "?test=1&stage=8&mute=1");
    await stepTo(page, 3.0);
    await page.keyboard.down("Space");
    await stepTo(page, 4.0);
    let wasPaused = true, resumed = true;
    if (mode === "none") await page.keyboard.up("Space");
    else {
      if (mode === "pause") await page.keyboard.press("Escape");
      else await hidden(page, true);
      wasPaused = (await S(page)).paused;
      await page.keyboard.up("Space");
      if (mode === "hidden") await hidden(page, false);
      await page.keyboard.press("Escape");
      resumed = !(await S(page)).paused;
    }
    await stepTo(page, 11.5);
    runs[mode] = { w: await wave(page, 1), wasPaused, resumed, errors };
    await ctx.close();
  }
  const base = runs.none.w;
  for (const mode of ["pause", "hidden"]) {
    const r = runs[mode];
    check(`desktop: Space let go while ${mode === "pause" ? "paused" : "the page is hidden"} still ends Birth's first hold`,
      r.wasPaused && r.resumed && r.w && base && r.w.rested === base.rested && Math.abs(r.w.overlap - base.overlap) < 0.05,
      JSON.stringify({ base, got: r.w, wasPaused: r.wasPaused, resumed: r.resumed }));
  }
  const errs = [...runs.none.errors, ...runs.pause.errors, ...runs.hidden.errors];
  check("desktop: no page errors (pause and release)", errs.length === 0, errs.slice(0, 3).join(" || "));
}

// ---- 5. one hold from many keys in a drag-and-hold moment (F12)
for (const mode of ["left-right", "space-down"]) {
  const { ctx, page, errors } = await open("desktop", "?test=1&stage=8&mute=1");
  const wn = mode === "space-down" ? 2 : 4;
  const sw = 3 + 8 * (wn - 1);                    // the swell of wave n
  await stepTo(page, sw - 0.1);
  if (mode === "left-right") {
    await page.keyboard.down("ArrowLeft");
    await stepTo(page, sw + 2.4);
    await page.keyboard.down("ArrowRight");
    await page.keyboard.up("ArrowLeft");
    await stepTo(page, sw + 5.1);
    await page.keyboard.up("ArrowRight");
  } else {
    await page.keyboard.down("Space");
    await stepTo(page, sw + 1.0);
    await page.keyboard.down("ArrowDown");
    await page.keyboard.up("Space");
    await stepTo(page, sw + 5.1);
    await page.keyboard.up("ArrowDown");
  }
  await stepTo(page, sw + 6);
  const w = await wave(page, wn);
  if (mode === "left-right") {
    check("desktop: Birth's turn wave held with Left, then Right (Left let go), is held all through",
      w && w.move === "turn" && w.overlap > 0.95 && w.right > 0.95, JSON.stringify(w));
  } else {
    check("desktop: Birth's tuck wave held with Space, then Down (Space let go), is held all through with the tuck",
      w && w.move === "tuck" && w.overlap > 0.95 && w.right > 0.7, JSON.stringify(w));
  }
  check(`desktop: no page errors (${mode})`, errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 6. Tab to the pause button: Space and Enter stay game keys (F16)
for (const key of ["Space", "Enter"]) {
  const { ctx, page, errors } = await open("desktop", "?test=1&stage=3&mute=1");
  await page.evaluate(() => window.__fb.step(30));
  await page.keyboard.press("Tab");
  const focus = await S(page);
  // step to the next target, then press on it with the focus on the pause button
  await page.evaluate(() => {
    const x = window.__fb.nextTarget();
    let n = 0;
    while (x && window.__fb.state().t < x.t - 0.004 && n++ < 6000) window.__fb.step(1);
  });
  const before = await S(page);
  await page.keyboard.press(key);
  await settle();
  await page.evaluate(() => window.__fb.step(20));
  const after = await S(page);
  check(`desktop: Tab focuses the pause button, and ${key} there does not pause`, focus.active === "pause" && after.paused === false,
    JSON.stringify({ focus: focus.active, after }));
  check(`desktop: ${key} on the focused pause button is the stage's press`, after.judges > before.judges,
    JSON.stringify({ before: before.judges, after: after.judges }));
  if (after.paused) await page.keyboard.press("Escape");
  let clicked = true;
  try { await page.click("#pause", { timeout: 3000 }); } catch (e) { clicked = false; }   // the pause button still works by click
  check("desktop: a click on the pause button still pauses", clicked && (await S(page)).paused === true);
  check(`desktop: no page errors (Tab, ${key})`, errors.length === 0, errors.slice(0, 3).join(" || "));
  await ctx.close();
}

// ---- 7. the prompt words for each way to play (F13, F15, F17)
{
  const words = [
    ["desktop", "?test=1&stage=3", null, "Press Space as the ring closes."],
    ["portrait", "?test=1&stage=3", null, "Tap as the ring closes."],
    ["desktop", "?test=1&stage=4", null, "Drift with the arrow keys, or drag with the mouse."],
    ["desktop", "?test=1&one=1&stage=2", "guard", "Hold to guard your shell."],
    ["portrait", "?test=1&one=1&stage=2", "guard", "Hold to guard your shell."],
    ["desktop", "?test=1&stage=2", "guard", "Turn with the arrow keys, or point with the mouse."],
    ["portrait", "?test=1&stage=7", "rest", "Rest. Touch and hold if you like."],
    ["desktop", "?test=1&stage=7", "rest", "Rest. Hold Space if you like."],
  ];
  for (const [size, q, moment, want] of words) {
    const { ctx, page, errors } = await open(size, q);
    await page.evaluate((m) => { if (m) window.__fb.jump(m); window.__fb.step(10); }, moment);
    const s = await S(page);
    check(`${size} ${q}${moment ? " " + moment : ""}: the prompt reads "${want}"`, s.prompt === want, String(s.prompt));
    check(`${size} ${q}: no page errors (prompt)`, errors.length === 0, errors.slice(0, 3).join(" || "));
    await ctx.close();
  }
}

// ---- 8. the three devices: Play, each stage's own gesture, and one-button mode (tasks.md 5.5)
{
  const DEVICES = {
    portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
    desktop: { viewport: { width: 1440, height: 900 } },
  };
  for (const [name, opts] of Object.entries(DEVICES)) SIZES[name] = SIZES[name] || opts;
  const touchOf = async (page) => {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    return {
      down: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x, y) }),
      move: (x, y) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) }),
      up: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  };
  // What the stage made of the steps since goto: its result, its probe and the subject's place.
  const sig = (page) => page.evaluate(() => {
    const s = window.__fb.state(), g = window.__fb.guard(), r = window.__fb.race();
    return JSON.stringify({ t: s.t, r: window.__fb.result(), a: s.anchor, j: s.judges, sub: s.subgoals, m: s.moment,
      g: g && { arc: g.arc, gold: g.gold && g.gold.angle }, you: r && r.you });
  });
  const live = (page, stage, seed) => page.evaluate(({ stage, seed }) => {
    window.__fb.goto(stage, { seed });
    let n = 0;
    while (window.__fb.state().prompt && window.__fb.state().prompt.gesture === "none" && n++ < 1500) window.__fb.step(1);
    const s = window.__fb.state();
    return { t: s.t, moment: s.moment, gesture: s.prompt && s.prompt.gesture, keys: s.prompt && s.prompt.keys, next: window.__fb.nextTarget() };
  }, { stage, seed });
  const stepS = (page, s) => page.evaluate((s) => window.__fb.step(Math.round(s * 60)), s);
  const stepTill = (page, t) => page.evaluate((t) => { let n = 0; while (window.__fb.state().t < t - 1e-6 && n++ < 20000) window.__fb.step(1); }, t);

  // One stage's gesture, from the first moment that asks for one, by touch, keys or the mouse: a drag held 2 s; a tap
  // or a press at the next target (a press held 0.5 s); a hold let go at a release target.
  // With dry set it takes the same steps with no input: the idle twin.
  async function gesture(page, size, at, T, how, dry = false) {
    const W = SIZES[size].viewport.width, H = SIZES[size].viewport.height;
    const cx = W / 2, cy = H / 2;
    const x = at.next && at.next.t < at.t + 6 ? at.next : null;
    const key = at.gesture === "dragHold" ? "ArrowDown" : "Space";
    const dn = async (dx = 0, dy = 0) => {
      if (dry) return;
      if (how === "touch") { await T.down(cx, cy); if (dx || dy) await T.move(cx + dx, cy + dy); }
      else if (how === "mouse") { await page.mouse.move(cx, cy); await page.mouse.down(); if (dx || dy) await page.mouse.move(cx + dx, cy + dy, { steps: 4 }); }
      else await page.keyboard.down(key);
    };
    const up = async () => { if (dry) return; if (how === "touch") await T.up(); else if (how === "mouse") await page.mouse.up(); else await page.keyboard.up(key); };
    if (at.gesture === "drag") {
      if (how === "keys") {
        const ks = at.keys === "turn" ? ["ArrowRight"] : ["ArrowUp", "ArrowRight"];
        for (const k of ks) if (!dry) await page.keyboard.down(k);
        await stepS(page, 2.2);
        for (const k of ks) if (!dry) await page.keyboard.up(k);
      } else {
        await dn(30, -40); await stepS(page, 0.1);
        if (dry) { /* no input */ } else if (how === "touch") await T.move(cx + 70, cy - 80); else await page.mouse.move(cx + 70, cy - 80, { steps: 4 });
        await stepS(page, 2.1); await up();
      }
    } else if (x && x.kind === "release") {
      await dn(); await stepTill(page, x.t); await up();
    } else if (x) {
      await stepTill(page, x.t - 0.01); await dn(0, at.gesture === "dragHold" ? 60 : 0);
      await stepS(page, x.kind === "tap" ? 0.08 : 0.5); await up();
    } else {
      await dn(); await stepS(page, 2.2); await up();
    }
    await stepS(page, 0.3);
  }

  for (const size of ["portrait", "landscape", "desktop"]) {
    const touch = !!SIZES[size].hasTouch;
    // Play starts with a tap, a click or Enter
    const ways = touch ? ["tap"] : ["click", "Enter"];
    for (const way of ways) {
      const { ctx, page, errors } = await open(size, "?test=1&mute=1");
      const before = await S(page);
      if (way === "tap") await page.tap("#play");
      else if (way === "click") await page.click("#play");
      else await page.keyboard.press("Enter");
      await settle();
      await page.evaluate(() => window.__fb.step(90));
      const after = await S(page);
      check(`${size}: ${way === "Enter" ? "Enter" : "a " + way} on Play starts the run`, before.screen === "title" && after.screen !== "title" && (after.screen === "card" || after.screen === "stage"),
        `${before.screen} → ${after.screen}`);
      check(`${size}: no page errors (Play by ${way})`, errors.length === 0, errors.slice(0, 3).join(" || "));
      await ctx.close();
    }
    // each stage's own gesture moves the game
    const { ctx, page, errors } = await open(size, "?test=1&mute=1");
    const T = touch ? await touchOf(page) : null;
    const tries = [1, 2, 3, 4, 5, 6, 7, 8].map((stage) => [stage, touch ? "touch" : "keys"]);
    if (!touch) tries.push([1, "mouse"], [3, "mouse"]);
    for (const [stage, how] of tries) {
      const at0 = await live(page, stage, 11);
      await gesture(page, size, at0, T, how, true);           // the idle twin first: the same steps, no input
      const idle = await sig(page);
      const at = await live(page, stage, 11);
      await gesture(page, size, at, T, how);
      const moved = await sig(page);
      const same = JSON.parse(idle).t === JSON.parse(moved).t;
      check(`${size}: stage ${stage} (${at.moment}, ${at.gesture}): the prompt's gesture by ${how} moves the game`,
        !!at.gesture && at.gesture !== "none" && same && moved !== idle, `${JSON.stringify(at)}${moved === idle ? " (the same as idle)" : ""}`);
    }
    if (size === "portrait") {
      // the control: two idle twins of each stage are the same, so a difference above is the gesture's
      const same = [];
      for (const stage of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const a = [];
        for (let k = 0; k < 2; k++) { const at = await live(page, stage, 11); await gesture(page, size, at, T, "touch", true); a.push(await sig(page)); }
        if (a[0] !== a[1]) same.push(stage);
      }
      check(`${size}: two idle twins of each stage are the same (the control)`, same.length === 0, `stages ${same.join(", ")} differ`);
    }
    check(`${size}: no page errors (each stage's gesture)`, errors.length === 0, errors.slice(0, 3).join(" || "));
    await ctx.close();
  }
  // one-button mode completes a stage: stage 1 with one key or one touch held from the start, top 3 at the meeting place
  for (const size of ["desktop", "portrait"]) {
    const touch = !!SIZES[size].hasTouch;
    const { ctx, page, errors } = await open(size, "?test=1&mute=1&one=1");
    const T = touch ? await touchOf(page) : null;
    await page.evaluate(() => { window.__fb.goto(1, { seed: 7 }); window.__fb.step(30); });
    const W = SIZES[size].viewport.width, H = SIZES[size].viewport.height;
    if (touch) await T.down(W / 2, H / 2); else await page.keyboard.down("Space");
    const end = await page.evaluate(() => {
      let n = 0;
      while (window.__fb.state().screen === "stage" && n++ < 200) window.__fb.step(60);
      const r = window.__fb.result();
      return { screen: window.__fb.state().screen, goalMet: r && r.goalMet, place: r && r.metrics && r.metrics.place, t: r && r.metrics && r.metrics.arrivedS };
    });
    if (touch) await T.up(); else await page.keyboard.up("Space");
    check(`${size}: in one-button mode ${touch ? "one touch" : "Space"} held through stage 1 reaches the meeting place in the top 3`,
      end.goalMet === true && end.place >= 1 && end.place <= 3, JSON.stringify(end));
    check(`${size}: no page errors (one-button stage 1)`, errors.length === 0, errors.slice(0, 3).join(" || "));
    await ctx.close();
  }
}

await browser.close();
if (server) server.kill();

const wallS = ((Date.now() - t0) / 1000).toFixed(1);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${FILE}: ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed (${wallS} s)`);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks (${wallS} s)`);
