// Checks reel.js (the reel face, the crank, the rod pad, the gauge) in a real browser with real touch sequences.
// Run: node qa/fish/reel.ui.mjs            (serves public/ itself on a free port; exit code 1 on failure)
// Options: SHOTS=dir (where the screenshots go; default a new folder <tmp>/fish-reel-shots-XXXXXX for each run),
// ONLY=shots (screenshots only), ONLY=checks (no screenshots), ONLY=landscape (the 844x390 part only), DIAG=1 (input latency and frame gaps),
// FISH_URL=http://127.0.0.1:8765/fish/ (use a server that is already up, at the root of public/).
// The checks wait for what the page did (the lift it got, a frame, game time), not for a time on the clock of this
// process: this process and the browser can be slow on a busy machine.
// The harness page mirrors index.html: the same CSS (read from the file), the same #game / #reelBox / #crankBox /
// #padBox / #gaugeBox structure, invisible switch pads like haptics.js adds, and main.js's toLocal and CSS rotation.
import { createRequire } from "module";
import { execSync, spawn } from "child_process";
import { readFileSync, mkdirSync, mkdtempSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import net from "net";
import os from "os";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const req = createRequire(import.meta.url);
let pw;
try { pw = req("playwright"); } catch (e) { pw = req(path.join(execSync("npm root -g").toString().trim(), "playwright")); }
// (a new folder for each run: two runs at the same time do not write over each other's screenshots)
const SHOTS = process.env.SHOTS || mkdtempSync(path.join(os.tmpdir(), "fish-reel-shots-"));
mkdirSync(SHOTS, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- serve public/ ---------- */
let server = null, BASE;
if (process.env.FISH_URL) BASE = new URL(process.env.FISH_URL).origin;
else {
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: path.join(root, "public"), stdio: "ignore" });
  BASE = "http://127.0.0.1:" + port;
}
for (let i = 0; i < 300; i++) { try { const r = await fetch(BASE + "/fish/js/reel.js"); if (r.ok) break; } catch (e) { /* not up yet */ } await sleep(100); }

/* ---------- the harness page ---------- */
const indexHtml = readFileSync(path.join(root, "public/fish/index.html"), "utf8");
// every style block (the first one is the boot screen's; the game's own CSS comes after it)
const css = [...indexHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const HARNESS = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<style>${css}
#view { background: linear-gradient(#f3d9a8, #9cc7d4 45%, #3f7f8c 46%, #2a5f6c); }
.qa-pad { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; }
</style></head><body>
<div id="game" class="l-tall-cast touch">
  <div id="view"></div>
  <div id="castUI"><div id="reelBox"><input type="checkbox" switch class="qa-pad" aria-hidden="true"></div></div>
  <div id="reelUI" hidden>
    <div id="gaugeBox"></div>
    <div id="dragBar"><button type="button" id="dragDown" aria-label="Less drag">−</button><b id="dragName">DRAG: MED</b><button type="button" id="dragUp" aria-label="More drag">+</button></div>
    <div id="padBox"></div>
    <div id="crankBox"><input type="checkbox" switch class="qa-pad" aria-hidden="true"></div>
  </div>
  <div id="hud"><button type="button" class="icon" id="pauseBtn" aria-label="Pause">II</button><span class="chip" id="modeChip">Free fishing · 0 fish</span><span class="grow"></span><span class="chip" id="clock">6:12 AM</span></div>
  <div id="nopin" data-nopin style="position:absolute;left:0;top:120px;width:80px;height:80px"></div>
</div>
<script type="module">
import { ReelPanel, Crank, RodPad, Gauge, REEL_UI } from "/fish/js/reel.js";
const $ = (s) => document.querySelector(s);
const game = $("#game");
const G = { rot: 0 };
// the same as main.js
function applyRotation(rot) {
  G.rot = rot;
  const W = innerWidth, H = innerHeight;
  if (rot) Object.assign(game.style, { width: H + "px", height: W + "px", left: (W - H) / 2 + "px", top: (H - W) / 2 + "px", transform: "rotate(" + rot + "deg)" });
  else Object.assign(game.style, { width: "", height: "", left: "", top: "", transform: "" });
}
function toLocal(cx, cy, el) {
  let x = cx, y = cy;
  if (G.rot) {
    const W = innerWidth, H = innerHeight, Lw = H, Lh = W, dx = cx - W / 2, dy = cy - H / 2;
    if (G.rot === 90) { x = dy + Lw / 2; y = Lh / 2 - dx; } else { x = Lw / 2 - dy; y = dx + Lh / 2; }
  }
  for (let e = el; e && e !== game && e !== document.body; e = e.offsetParent) { x -= e.offsetLeft; y -= e.offsetTop; }
  return { x, y };
}
// the inverse, for the test: a point in el's own css pixels to client (screen) pixels
function toClient(lx, ly, el) {
  let x = lx, y = ly;
  for (let e = el; e && e !== game && e !== document.body; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
  if (!G.rot) return { x, y };
  const W = innerWidth, H = innerHeight, Lw = H, Lh = W;
  let dx, dy;
  if (G.rot === 90) { dy = x - Lw / 2; dx = Lh / 2 - y; } else { dy = Lw / 2 - x; dx = y - Lh / 2; }
  return { x: W / 2 + dx, y: H / 2 + dy };
}
const EV = [], PT = [], RATES = [], LAT = [];
addEventListener("pointerdown", (e) => LAT.push(Math.round(performance.now() - e.timeStamp)), true);
const FR = []; (function fr(t) { FR.push(t); if (FR.length > 4000) FR.splice(0, 2000); requestAnimationFrame(fr); })(0);
const panel = new ReelPanel($("#reelBox"), { toLocal, hand: "right", area: game });
for (const t of ["bail", "pin", "pinmove", "unpin", "aim"]) panel.on(t, (e) => EV.push(Object.assign({ type: t, at: performance.now() }, e)));
const crank = new Crank($("#crankBox"), { toLocal, hand: "right" });
crank.on("turn", (e) => EV.push(Object.assign({ type: "turn", at: performance.now() }, e)));
const pad = new RodPad($("#padBox"), { toLocal });
pad.on("yank", (e) => EV.push(Object.assign({ type: "yank", at: performance.now() }, e)));
const gauge = new Gauge($("#gaugeBox"));
// N: how many of each pointer event the page has handled (never cleared). h: when one got to the page; c: the clock then
const N = { pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 };
for (const t of ["pointerdown", "pointerup", "pointercancel"]) addEventListener(t, (e) => { N[t]++; PT.push({ type: t, id: e.pointerId, t: e.timeStamp, h: performance.now(), c: clk(), target: e.target.id || e.target.className || e.target.tagName }); }, true);
let lastMove = 0, lastMoveAt = 0, moves = 0;
addEventListener("pointermove", (e) => { N.pointermove++; lastMove = e.timeStamp; lastMoveAt = performance.now(); moves++; }, true);
function mode(m, { flying = false } = {}) {
  const wide = game.clientWidth > game.clientHeight * 1.15;
  const cast = m === "cast";
  game.className = "l-" + (cast ? (wide ? "wide-cast" : "tall-cast") : (wide ? "reel" : "tall-reel")) + (flying ? " flying" : "") + " touch";
  $("#castUI").hidden = !cast;
  $("#reelUI").hidden = cast;
  panel.resize(); crank.resize(); pad.resize(); gauge.resize();
}
// the game's own clocks, in ms. played (T.game): the time the frames give each draw (the gauge plays at this pace). clock: the
// crank's and the pad's clock, which take at most 0.1 s in one step
let last = performance.now(), sample = false, frozen = false, played = 0, clock = 0;
function clk() { return clock + Math.min(100, performance.now() - last); }
function frame() {
  requestAnimationFrame(frame);
  const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000);
  if (!frozen) { played += dt * 1000; clock += Math.min(100, t - last); }
  last = t;
  if (frozen) return;
  if (sample) RATES.push({ t, c: clock, rate: crank.rate, ang: crank.angle, a: lastMoveAt });
  if (!$("#castUI").hidden) panel.draw(dt);
  if (!$("#reelUI").hidden) { crank.draw(dt); gauge.draw(dt); if (!pad.hidden) pad.draw(dt); }
}
requestAnimationFrame(frame);
window.T = { LAT, FR, panel, crank, pad, gauge, EV, PT, RATES, REEL_UI, G, applyRotation, toLocal, toClient, mode,
  sampling(b) { sample = b; if (b) RATES.length = 0; },
  // hold the last frame still while a screenshot is taken (software raster in a busy test box is slow)
  freeze(b) { frozen = b; }, get lastMove() { return lastMove; }, get lastMoveAt() { return lastMoveAt; }, get moves() { return moves; },
  N, get game() { return played; }, get clock() { return clk(); }, clear() { EV.length = 0; PT.length = 0; } };
window.READY = true;
</script></body></html>`;

/* ---------- the browser ---------- */
// No SwiftShader flags here (unlike the WebGL tests): this page has no WebGL, and SwiftShader turns on "GPU" 2D canvas
// in software, which is ~50x slower than plain Skia and starves the input and timers the checks measure.
const browser = await pw.chromium.launch();
const errors = [];
async function openPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.route("**/fish/qa-reel.html", (r) => r.fulfill({ body: HARNESS, contentType: "text/html" }));
  await page.goto(BASE + "/fish/qa-reel.html");
  await page.waitForFunction(() => window.READY === true);
  const cdp = await ctx.newCDPSession(page);
  // one touch event; pts = the fingers that are down after it (CDP releases any finger missing from the list)
  // at = the moment the finger was there (ms since the epoch); it becomes the event's timeStamp, so a message that
  // waits in CDP's queue still says when it happened, as a real touch would
  const touch = (type, pts, at) => cdp.send("Input.dispatchTouchEvent", Object.assign({ type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 9, radiusY: 9, force: 1 })) }, at ? { timestamp: at / 1000 } : {}));
  // client point for a point in an element's local css pixels
  const at = (sel, x, y) => page.evaluate(([s, x, y]) => T.toClient(x, y, document.querySelector(s)), [sel, x, y]);
  const size = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return { w: e.clientWidth, h: e.clientHeight }; }, sel);
  return { ctx, page, cdp, touch, at, size };
}
const EVS = (page, type) => page.evaluate((t) => T.EV.filter((e) => !t || e.type === t), type);

// waits until fn(arg) is true in the page. A timeout is a failed check that says what did not come
async function until(page, what, fn, arg, ms = 60000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) {
    if (!/timeout/i.test(e.message)) throw e;
    check(false, what + " (not seen in " + ms / 1000 + " s)");
    return false;
  }
}
// how many of each pointer event the page has handled, and a wait for k more of one type than in those counts c
const counts = (page) => page.evaluate(() => ({ ...T.N }));
const handled = (page, c, type, what, k = 1) => until(page, what + ": the page gets the " + type, ([t, n]) => T.N[t] >= n, [type, c[type] + k]);
// waits for ms of game time
async function play(page, ms, what) {
  const g = await page.evaluate(() => T.game);
  return until(page, what + ": " + ms + " ms of game time", ([g, ms]) => T.game >= g + ms, [g, ms]);
}
// the finger lifts, and the page has the lift
async function lift(P, what) { const c = await counts(P.page); await P.touch("touchEnd", []); return handled(P.page, c, "pointerup", what); }
// a press and its end ms later (end: "touchEnd" or "touchCancel"). Both have their planned times and go together, so
// the page gets the end soon after the press, as the plan says
async function tap(P, p, id, ms, end = "touchEnd") {
  const c = await counts(P.page), e0 = Date.now() - performance.now(), s = performance.now() - ms;
  await Promise.all([P.touch("touchStart", [{ ...p, id }], e0 + s), P.touch(end, [], e0 + s + ms)]);
  return handled(P.page, c, end === "touchEnd" ? "pointerup" : "pointercancel", "the end of a tap");
}
// a press that rests for ms on the page's own clock. It returns with the finger down, after a frame that came later,
// so a timer that the page set for the press had time to run
async function rest(P, p, id, ms) {
  const c = await counts(P.page);
  await P.touch("touchStart", [{ ...p, id }]);
  await handled(P.page, c, "pointerdown", "a press");
  return until(P.page, "a " + ms + " ms rest", (ms) => { const d = T.PT.filter((q) => q.type === "pointerdown").pop(); return !!d && T.FR[T.FR.length - 1] > d.h + ms; }, ms);
}

// a swipe in local coordinates of sel, from (x,y) by (dx,dy) in n steps of ms. Each touch has the time that the plan
// gives it, and a move that this busy process sends late goes at once with its planned time. The press goes together
// with the first move, so a pause that only this process made never looks like a still press to the page. The sends
// are pipelined, not awaited one by one, or CDP's round trip would slow every swipe down. steps: each move waits until
// the page has handled the move before it, so each move is its own pointermove (for a check that counts them), and
// carries the time it was sent. It returns when the page has handled the lift.
async function swipe(P, sel, x, y, dx, dy, { n = 6, ms = 16, id = 1, steps = false } = {}) {
  const { page } = P, pts = [];
  for (let i = 0; i <= n; i++) pts.push(await P.at(sel, x + (dx * i) / n, y + (dy * i) / n));
  const c = await counts(page), e0 = Date.now() - performance.now(), s = performance.now() - ms, pend = [];
  pend.push(P.touch("touchStart", [{ ...pts[0], id }], e0 + s));
  for (let i = 1; i <= n + 1; i++) {
    if (steps && i > 1) await handled(page, c, "pointermove", "a swipe step", i - 1);
    else while (performance.now() < s + i * ms) await sleep(1);
    const at = e0 + (steps ? performance.now() : s + i * ms);
    pend.push(i > n ? P.touch("touchEnd", [], at) : P.touch("touchMove", [{ ...pts[i], id }], at));
  }
  await Promise.all(pend);
  return handled(page, c, "pointerup", "the lift of a swipe");
}

/* ---------- the reel face: bail, pin, unpin ---------- */
async function panelChecks(P, tag) {
  const { page } = P;
  await page.evaluate(() => { T.mode("cast"); T.panel.set({ bail: "closed", glow: "bail", pinned: false, spool: 0, touchCast: true }); T.clear(); });
  await sleep(120);
  const box = await P.size("#reelBox");
  let b = await page.evaluate(() => T.panel.bailArea);
  check(b.w >= 100 && b.h >= 90 && b.x >= -20 && b.y >= -20 && b.x + b.w <= box.w + 20 && b.y + b.h <= box.h + 20, `${tag}: the bail target is big and inside the reel (${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}x${b.h.toFixed(0)} in ${box.w}x${box.h})`);
  // swipe the bail down: open
  await swipe(P, "#reelBox", b.x + b.w / 2, b.y + b.h / 2, 0, 80, { n: 6, ms: 18 });
  let ev = await EVS(page);
  check(ev.length === 1 && ev[0].type === "bail" && ev[0].open === true, `${tag}: a swipe down on the bail opens it (${JSON.stringify(ev.map((e) => e.type + (e.type === "bail" ? ":" + e.open : "")))})`);
  // a sideways swipe on the bail is not a bail swipe
  await page.evaluate(() => T.clear());
  await swipe(P, "#reelBox", b.x + b.w / 2 - 40, b.y + b.h / 2, 90, 10, { n: 6, ms: 18 });
  ev = await EVS(page, "bail");
  check(ev.length === 0, `${tag}: a sideways swipe does not flip the bail`);
  // open bail: a press on the bail pins at once; a swipe up closes it; lifting unpins
  await page.evaluate(() => { T.panel.set({ bail: "open", glow: "pin" }); T.clear(); });
  await sleep(60);
  b = await page.evaluate(() => T.panel.bailArea);
  await swipe(P, "#reelBox", b.x + b.w / 2, b.y + b.h / 2, 4, -80, { n: 6, ms: 18, id: 3, steps: true });
  ev = await EVS(page);
  const types = ev.filter((e) => e.type !== "pinmove").map((e) => e.type + (e.type === "bail" ? ":" + e.open : ""));
  check(types.join(",") === "pin,bail:false,unpin", `${tag}: open bail: press pins at once, swipe up closes, lift unpins (${types.join(",")})`);
  const pt = await page.evaluate(() => T.PT.slice());
  const down = pt.find((p) => p.type === "pointerdown"), up = pt.find((p) => p.type === "pointerup");
  const pin = ev.find((e) => e.type === "pin"), unpin = ev.find((e) => e.type === "unpin");
  check(pin && down && Math.abs(pin.t - down.t) < 0.01, `${tag}: an open-bail pin carries the press time`);
  check(unpin && up && unpin.id === pin.id && Math.abs(unpin.t - up.t) < 0.01, `${tag}: unpin carries the lift's event.timeStamp and the same id`);
  check(ev.filter((e) => e.type === "pinmove").length >= 5, `${tag}: pinmove follows the finger`);

  // bail closed: a hold anywhere pins after ~90 ms, not before. Timed on the page's own clock from when the press got
  // there, and in frames: the pin comes by the second frame after the hold time
  await page.evaluate(() => { T.panel.set({ bail: "closed", glow: "bail" }); T.clear(); });
  await sleep(40);
  const spot = await P.at("#reelBox", box.w * 0.12, box.h * 0.85);
  await P.touch("touchStart", [{ ...spot, id: 5 }]);
  await until(page, `${tag}: closed bail: a hold pins`, () => T.EV.some((e) => e.type === "pin"));
  const hp = await page.evaluate(() => {
    const d = T.PT.find((p) => p.type === "pointerdown"), pins = T.EV.filter((e) => e.type === "pin"), pin = pins[0];
    return { d, n: pins.length, wait: d && pin ? pin.at - d.h : NaN, late: d && pin ? T.FR.filter((t) => t > d.h + T.REEL_UI.pinHoldMs && t < pin.at).length : NaN };
  });
  check(hp.n === 1 && hp.wait >= 85 && hp.late <= 2, `${tag}: closed bail: a hold pins after ~90 ms (${hp.wait.toFixed(0)} ms after the press got to the page, ${hp.late} frames after the hold time; the press reached the page ${hp.d ? (hp.d.h - hp.d.t).toFixed(0) : "?"} ms late)`);
  await lift(P, `${tag}: the hold's lift`);
  ev = await EVS(page, "unpin");
  const up2 = (await page.evaluate(() => T.PT.slice())).find((p) => p.type === "pointerup");
  check(ev.length === 1 && Math.abs(ev[0].t - up2.t) < 0.01 && ev[0].id === up2.id, `${tag}: the hold unpins on lift with its time and id`);
  // a quick tap or a drag with the bail closed is no pin (once the page has each lift, no pin can come for it)
  await page.evaluate(() => T.clear());
  await tap(P, spot, 6, 40);
  await swipe(P, "#reelBox", box.w * 0.12, box.h * 0.85, 60, -5, { n: 3, ms: 16, id: 7 });
  ev = await EVS(page, "pin");
  check(ev.length === 0, `${tag}: a quick tap or a quick drag with the bail shut does not pin`);

  // bail open: the pinning finger holds; a palm (second finger) does not release the line
  await page.evaluate(() => { T.panel.set({ bail: "open", glow: "pin" }); T.clear(); });
  const A = await P.at("#reelBox", box.w * 0.5, box.h * 0.55), B = await P.at("#reelBox", box.w * 0.85, box.h * 0.8);
  await P.touch("touchStart", [{ ...A, id: 10 }]);
  await sleep(30);
  await P.touch("touchStart", [{ ...A, id: 10 }, { ...B, id: 11 }]);
  await sleep(30);
  await P.touch("touchMove", [{ ...A, id: 10 }, { x: B.x + 5, y: B.y + 5, id: 11 }]);
  await sleep(30);
  await P.touch("touchMove", [{ x: A.x, y: A.y + 3, id: 10 }]);   // the palm lifts
  await until(page, `${tag}: the thumb's move after the palm`, () => T.EV.some((e) => e.type === "pinmove"));
  ev = await EVS(page);
  const pins = ev.filter((e) => e.type === "pin"), unpins = ev.filter((e) => e.type === "unpin");
  check(pins.length === 1 && unpins.length === 0, `${tag}: a second finger neither pins nor unpins (pins ${pins.length}, unpins ${unpins.length})`);
  await lift(P, `${tag}: the thumb lifts`);
  ev = await EVS(page, "unpin");
  check(ev.length === 1 && pins.length === 1 && ev[0].id === pins[0].id && ev[0].cancel === false, `${tag}: only the pinning finger unpins`);
  // the browser takes the touch away (pointercancel): unpin says so, so main.js does not read it as a cast
  await page.evaluate(() => T.clear());
  await tap(P, A, 16, 30, "touchCancel");
  ev = await EVS(page);
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "unpin" && e.cancel === true).length === 1, `${tag}: a cancelled touch unpins with cancel: true`);
  // controls are not pins: the HUD button and a [data-nopin] area; the invisible switch pad on the reel is
  await page.evaluate(() => T.clear());
  const hudBtn = await page.evaluate(() => { const r = document.querySelector("#pauseBtn"); return T.toClient(r.offsetWidth / 2, r.offsetHeight / 2, r); });
  await tap(P, hudBtn, 12, 30);
  const np = await P.at("#nopin", 40, 40);
  await tap(P, np, 13, 30);
  ev = await EVS(page, "pin");
  const tg = await page.evaluate(() => T.PT.filter((p) => p.type === "pointerdown").map((p) => p.target));
  check(ev.length === 0, `${tag}: presses on the HUD and on [data-nopin] are not pins (targets ${tg.join(", ")})`);
  await page.evaluate(() => T.clear());
  await tap(P, A, 14, 30);
  ev = await EVS(page);
  const tg2 = await page.evaluate(() => T.PT.filter((p) => p.type === "pointerdown").map((p) => p.target));
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "unpin").length === 1 && /qa-pad/.test(tg2.join()), `${tag}: a press that lands on the haptic switch pad still pins (target ${tg2.join()})`);
  // a press on the lake view pins too (the whole game area)
  await page.evaluate(() => T.clear());
  const lake = await page.evaluate(() => T.toClient(document.querySelector("#game").clientWidth * 0.5, 60, document.querySelector("#game")));
  await tap(P, lake, 15, 30);
  ev = await EVS(page);
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "unpin").length === 1, `${tag}: a press on the lake view pins (the whole game area listens)`);

  // grab (the game's ready step): a press takes the line at once with the bail shut, and a drag right away is
  // still a pin (touch casting drags down at once). "panel" grabs only on the reel face: the lake is for aiming
  await page.evaluate(() => { T.panel.set({ bail: "closed", glow: "pin", grab: "all" }); T.clear(); });
  const c17 = await counts(page);
  await P.touch("touchStart", [{ ...lake, id: 17 }]);
  await handled(page, c17, "pointerdown", `${tag}: grab "all": the press`);
  ev = await EVS(page, "pin");
  const d3 = (await page.evaluate(() => T.PT.slice())).find((p) => p.type === "pointerdown");
  check(ev.length === 1 && Math.abs(ev[0].t - d3.t) < 0.01, `${tag}: grab "all": a press on the lake pins at once, with the press time`);
  await lift(P, `${tag}: grab "all": the lift`);
  await page.evaluate(() => { T.panel.set({ grab: "panel" }); T.clear(); });
  await swipe(P, "#reelBox", box.w * 0.5, box.h * 0.3, 0, 90, { n: 4, ms: 12, id: 18 });
  ev = await EVS(page);
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "bail").length === 0, `${tag}: grab "panel": a drag that starts on the reel pins at once and is no bail swipe`);
  await page.evaluate(() => T.clear());
  // a rest on the lake before an aim drag, longer than the closed-bail hold time, is still no pin
  await rest(P, lake, 19, 160);
  let early = await EVS(page, "pin");
  await lift(P, `${tag}: grab "panel": the lift`);
  check(early.length === 0, `${tag}: grab "panel": a 160 ms rest on the lake does not pin`);
  // grab "lock" (touch play's ready step): a press waits for the drag. Down takes the line where it pressed, with no bail
  // swipe; sideways aims ("aim" events, dx from the press) and takes nothing
  await page.evaluate(() => { T.panel.set({ grab: "lock" }); T.clear(); });
  await rest(P, lake, 20, 160);
  early = await EVS(page, "pin");
  await lift(P, `${tag}: grab "lock": the lift`);
  check(early.length === 0, `${tag}: grab "lock": a press that does not move takes nothing`);
  const gw = await page.evaluate(() => document.querySelector("#game").clientWidth);
  const want = await page.evaluate((x) => { const g = document.querySelector("#game"), c = T.toClient(x, 300, g); return T.toLocal(c.x, c.y, document.querySelector("#reelBox")); }, gw * 0.4);
  await page.evaluate(() => T.clear());
  await swipe(P, "#game", gw * 0.4, 300, 3, 80, { n: 6, ms: 16, id: 21 });
  ev = await EVS(page);
  const lp = ev.find((e) => e.type === "pin");
  check(!!lp && Math.abs(lp.y - want.y) < 1 && Math.abs(lp.x - want.x) < 1 && !ev.some((e) => e.type === "aim" || e.type === "bail") && ev.some((e) => e.type === "unpin"), `${tag}: grab "lock": a drag down takes the line where it pressed (${lp ? lp.y.toFixed(1) : "none"}, want ${want.y.toFixed(1)}), with no bail swipe`);
  await page.evaluate(() => T.clear());
  await swipe(P, "#game", gw * 0.3, 300, 90, 6, { n: 6, ms: 16, id: 22, steps: true });
  ev = await EVS(page);
  const aims = ev.filter((e) => e.type === "aim");
  check(!ev.some((e) => e.type === "pin") && aims.length >= 3 && aims[0].start && !aims[1].start && Math.abs(aims[aims.length - 1].dx - 90) < 2, `${tag}: grab "lock": a drag sideways aims (${aims.length} aim events, dx ${aims.length ? aims[aims.length - 1].dx.toFixed(1) : "-"}) and takes nothing`);
  await page.evaluate(() => T.panel.set({ bail: "closed", glow: "", grab: "" }));
}

/* ---------- the crank ---------- */
async function crankChecks(P, tag) {
  const { page } = P;
  if (process.env.DIAG) console.log("        latencies " + JSON.stringify(await page.evaluate(() => T.LAT.splice(0))) + " frame gaps>50: " + JSON.stringify(await page.evaluate(() => { const g = []; for (let i = 1; i < T.FR.length; i++) if (T.FR[i] - T.FR[i - 1] > 50) g.push(Math.round(T.FR[i - 1]) + "+" + Math.round(T.FR[i] - T.FR[i - 1])); T.FR.length = 0; return g; })));
  await page.evaluate(() => { T.mode("reel"); T.clear(); });
  await sleep(100);
  const sz = await P.size("#crankBox");
  const c0 = await P.at("#crankBox", sz.w / 2, sz.h / 2), cx1 = await P.at("#crankBox", sz.w / 2 + 1, sz.h / 2), cy1 = await P.at("#crankBox", sz.w / 2, sz.h / 2 + 1);
  const ux = { x: cx1.x - c0.x, y: cx1.y - c0.y }, uy = { x: cy1.x - c0.x, y: cy1.y - c0.y };
  const R = Math.min(sz.w, sz.h) * 0.3;
  const pt = (a) => ({ x: c0.x + ux.x * Math.cos(a) * R + uy.x * Math.sin(a) * R, y: c0.y + ux.y * Math.cos(a) * R + uy.y * Math.sin(a) * R });
  // a thumb going round at rps for secs: a move every 16 ms like a real 60 Hz touch screen. Each move has the place and
  // the time that the plan gives it, and a move that this busy process sends late goes at once with its planned time,
  // so the page gets every sample of a steady thumb. The sends are pipelined (not awaited one by one), or CDP's round
  // trip would set the pace instead. It returns when the page has the last move. lift: the thumb lets go one step after
  // the last move, and it returns when the page has the lift too. late: each touch gets to the page this many ms after
  // its time (it carries a time that much earlier)
  async function circle(rps, secs, id, { lift = false, late = 0 } = {}) {
    const c = await counts(page), K = Math.floor((secs * 1000) / 16), pend = [];
    const e0 = Date.now() - performance.now() - late, s = performance.now();
    pend.push(P.touch("touchStart", [{ ...pt(0), id }], e0 + s));
    for (let k = 1; k <= K + (lift ? 1 : 0); k++) {
      while (performance.now() < s + k * 16) await sleep(1);
      pend.push(k > K ? P.touch("touchEnd", [], e0 + s + k * 16) : P.touch("touchMove", [{ ...pt(TAU * rps * k * 0.016), id }], e0 + s + k * 16));
    }
    await Promise.all(pend);
    // the last move's time is the press time and K steps
    await until(page, `${tag}: the last move of a circle`, ([ms, n]) => { const d = T.PT.filter((p) => p.type === "pointerdown").pop(); return T.N.pointerdown > n && !!d && T.lastMove >= d.t + ms - 1; }, [K * 16, c.pointerdown]);
    if (lift) await handled(page, c, "pointerup", `${tag}: the lift of a circle`);
  }
  const TAU = Math.PI * 2;
  // the frames that had a steady thumb to read. A frame where the page had heard nothing from the thumb for more than
  // 50 ms (3 moves of a 60 Hz screen), and the frames in the 150 ms after it, show input that this busy test machine
  // sent late, not the crank
  const fed = (r) => { const gap = r.filter((s) => s.t - s.a > 50).map((s) => s.t); return r.filter((s) => !gap.some((g) => g <= s.t && s.t < g + 150)); };
  // a steady 2 rev/s circle, and then the thumb stays still: wait until the rate is 0, and for a frame 250 ms after the
  // page got the last move
  const m0 = await page.evaluate(() => { T.sampling(true); return T.moves; });
  await circle(2, 1.6, 20);
  await until(page, `${tag}: the rate falls to 0 after the thumb stops`, () => { const r = T.RATES; return r.length > 0 && r[r.length - 1].t >= T.lastMoveAt + 250 && r.some((s) => s.t > T.lastMoveAt && s.rate === 0); });
  const log = await page.evaluate(() => ({ r: T.RATES.slice(), at: T.lastMoveAt, moves: T.moves, pt: T.PT.slice(-4), down: T.PT.filter((p) => p.type === "pointerdown").pop() }));
  console.log("        (" + (log.moves - m0) + " pointermoves seen, " + log.r.length + " frames; " + JSON.stringify(log.pt) + ")");
  await page.evaluate(() => T.sampling(false));
  await lift(P, `${tag}: the thumb lifts off the crank`);
  // the frames from 400 ms after the press got to the page, while its moves still came in
  const inSteady = (s) => log.down && s.t > log.down.h + 400 && s.t < log.at - 20;
  const steady = fed(log.r).filter(inSteady).map((s) => s.rate), sOut = log.r.filter(inSteady).length - steady.length;
  const mean = steady.reduce((a, b) => a + b, 0) / Math.max(1, steady.length);
  // 9 frames in 10 within the band: one late delivery on a busy test box may dip a single frame
  const srt = [...steady].sort((a, b) => a - b), lo = srt[Math.floor(srt.length * 0.1)], hi = srt[Math.floor(srt.length * 0.9)];
  check(steady.length > 20 && Math.abs(mean - 2) < 0.3 && lo > 1.7 && hi < 2.3, `${tag}: a steady 2 rev/s circle reads ${mean.toFixed(2)} rev/s (10th-90th percentile ${lo?.toFixed(2)}-${hi?.toFixed(2)}, lowest ${srt[0]?.toFixed(2)}, ${steady.length} frames, ${sOut} after late input left out)`);
  // timed from when the page got the last move; the rate must be 0 by the first frame 250 ms after that
  const zeroAt = log.r.find((s) => s.t > log.at && s.rate === 0), due = log.r.find((s) => s.t >= log.at + 250);
  const stop = zeroAt ? zeroAt.t - log.at : Infinity;
  check(!!zeroAt && !!due && zeroAt.t <= due.t, `${tag}: the rate falls to 0 ${stop.toFixed(0)} ms after the thumb stops (want 0 by the first frame after 250 ms)`);
  const turns = (await EVS(page, "turn")).length;
  check(turns >= 11 && turns <= 14, `${tag}: about 4 turn events per turn (${turns} for ~3.2 turns)`);
  // a busy phone gives the touch moves to the page late: the same circle with every move 50 ms late reads the same
  await page.evaluate(() => { T.sampling(true); T.clear(); });
  await circle(2, 1.6, 23, { late: 50 });
  const lt = await page.evaluate(() => ({ r: T.RATES.slice(), at: T.lastMoveAt, down: T.PT.filter((p) => p.type === "pointerdown").pop() }));
  await page.evaluate(() => T.sampling(false));
  await lift(P, `${tag}: the thumb lifts off the crank`);
  const inLate = (s) => lt.down && s.t > lt.down.h + 400 && s.t < lt.at - 20;
  const ls = fed(lt.r).filter(inLate).map((s) => s.rate).sort((a, b) => a - b), lOut = lt.r.filter(inLate).length - ls.length;
  const lmean = ls.reduce((a, b) => a + b, 0) / Math.max(1, ls.length), llo = ls[Math.floor(ls.length * 0.1)], lhi = ls[Math.floor(ls.length * 0.9)];
  check(ls.length > 20 && Math.abs(lmean - 2) < 0.3 && llo > 1.7 && lhi < 2.3, `${tag}: the circle with each move 50 ms late reads ${lmean.toFixed(2)} rev/s (10th-90th percentile ${llo?.toFixed(2)}-${lhi?.toFixed(2)}, ${ls.length} frames, ${lOut} after late input left out; the press reached the page ${lt.down ? (lt.down.h - lt.down.t).toFixed(0) : "?"} ms late)`);
  // the other way winds in too: the second half of the turn, while its moves still came in
  await page.evaluate(() => { T.sampling(true); T.clear(); });
  await circle(-1.5, 1.0, 21, { lift: true });
  const back = await page.evaluate(() => ({ r: T.RATES.slice(), at: T.lastMoveAt, down: T.PT.filter((p) => p.type === "pointerdown").pop() }));
  await page.evaluate(() => T.sampling(false));
  const inBack = (s) => back.down && s.t > (back.down.h + back.at) / 2 && s.t < back.at - 20;
  const bm = fed(back.r).filter(inBack).map((s) => s.rate).sort((a, b) => a - b), bmean = bm.reduce((a, b) => a + b, 0) / Math.max(1, bm.length);
  const bOut = back.r.filter(inBack).length - bm.length;
  check(bm.length >= 5 && Math.abs(bmean - 1.5) < 0.3 && bm[Math.floor(bm.length * 0.1)] > 1.2, `${tag}: turning the other way also reels (${bmean.toFixed(2)} rev/s for 1.5, lowest ${bm[0]?.toFixed(2)}, ${bm.length} frames, ${bOut} after late input left out)`);
  // a fling keeps a little spin after the thumb lifts. Timed on the crank's own clock from when the page got the lift
  await until(page, `${tag}: the crank comes to rest`, () => !T.crank.drag && T.crank.coast === 0 && T.crank.out === 0);
  await page.evaluate(() => { T.sampling(true); });
  await circle(3, 0.5, 22, { lift: true });
  await until(page, `${tag}: the fling stops`, () => { const u = T.PT.filter((p) => p.type === "pointerup").pop(); return !!u && T.RATES.some((s) => s.c > u.c && s.rate === 0); });
  const fl = await page.evaluate(() => ({ r: T.RATES.slice(), up: T.PT.filter((p) => p.type === "pointerup").pop() }));
  await page.evaluate(() => T.sampling(false));
  // the frames 150 to 250 ms after the lift (at least the first frame after 150 ms, when the frames are slow)
  const after = fl.r.filter((s) => s.c >= fl.up.c + 150).filter((s, i) => i === 0 || s.c < fl.up.c + 250);
  const dead = fl.r.find((s) => s.c > fl.up.c && s.rate === 0);
  check(after.length && after.every((s) => s.rate > 0.3) && dead && dead.c - fl.up.c < 1400, `${tag}: a fling coasts (${after.length ? after[0].rate.toFixed(2) : "?"} rev/s 150 ms after the lift, stops after ${dead ? (dead.c - fl.up.c).toFixed(0) : "never"} ms)`);
  // the mouse wheel: a 100 px flick is about a quarter turn. It plays out over a few frames: wait until it has, and the
  // handle is still
  await page.evaluate(() => T.clear());
  const a0 = await page.evaluate(() => T.crank.angle);
  await page.evaluate(() => { T.sampling(true); T.crank.wheel(100); });
  await until(page, `${tag}: the wheel turn plays out`, () => { const r = T.RATES; return T.crank.bank === 0 && r.length > 0 && r[r.length - 1].rate === 0; });
  const wl = await page.evaluate(() => ({ r: T.RATES.slice(), a: T.crank.angle, turns: T.EV.filter((e) => e.type === "turn").length }));
  await page.evaluate(() => T.sampling(false));
  const turned = (wl.a - a0) / TAU, wmax = Math.max(...wl.r.map((s) => s.rate));
  check(Math.abs(turned - 0.25) < 0.02 && wmax > 0.8 && wl.turns === 1 && wl.r[wl.r.length - 1].rate === 0, `${tag}: wheel(100) turns ${turned.toFixed(3)} rev (peak ${wmax.toFixed(2)} rev/s, ${wl.turns} turn event)`);
  // R held: a steady 1.6 rev/s
  await page.evaluate(() => T.crank.keyHold(true));
  await play(page, 500, `${tag}: R held`);
  const kr = await page.evaluate(() => T.crank.rate);
  await page.evaluate(() => T.crank.keyHold(false));
  await play(page, 300, `${tag}: R let go`);
  const kr0 = await page.evaluate(() => T.crank.rate);
  check(Math.abs(kr - 1.6) < 0.05 && kr0 === 0, `${tag}: keyHold gives ${kr.toFixed(3)} rev/s, then ${kr0} when let go`);
}

/* ---------- the rod pad ---------- */
async function padChecks(P, tag) {
  const { page } = P;
  await page.evaluate(() => { T.mode("reel"); T.clear(); T.pad.keys({}); });
  await sleep(80);
  const sz = await P.size("#padBox");
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.04, 0, sz.h * 0.94, { n: 8, ms: 25, id: 29 });
  const th0 = await page.evaluate(() => T.pad.theta);
  check(th0 === 10, `${tag}: a long drag down puts the rod at the bottom of its swing (${th0.toFixed(1)}°)`);
  const dpp = await page.evaluate(() => (T.REEL_UI.rodMax - T.REEL_UI.rodMin) / Math.max(120, document.querySelector("#padBox").clientHeight * 0.8));
  // a slow drag up 60 px: the rod goes up and stays there; no hook set
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.6, 0, -60, { n: 12, ms: 25, id: 30 });
  await play(page, 300, `${tag}: the rod rests`);
  const th1 = await page.evaluate(() => T.pad.theta);
  check(Math.abs(th1 - th0 - 60 * dpp) < 3, `${tag}: drag up 60 px raises the rod ${(th1 - th0).toFixed(1)}° (want ${(60 * dpp).toFixed(1)}) and it stays`);
  check((await EVS(page, "yank")).length === 0, `${tag}: a slow drag does not set the hook`);
  // drag down lowers it, and it stops at 10
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.2, 0, sz.h * 0.75, { n: 10, ms: 25, id: 31 });
  const th2 = await page.evaluate(() => T.pad.theta);
  check(th2 >= 10 && th2 < th1 - 20, `${tag}: drag down lowers the rod (${th2.toFixed(1)}°), never below 10`);
  // steer: a finger near the right edge steers right; it springs back after the lift.
  // Not at the very edge: at 390 px wide #crankBox overlaps the pad by a few pixels, and Chrome's touch adjustment
  // (a 9 px finger) snaps a press there onto the crank's switch input.
  const rp = await P.at("#padBox", sz.w - 20, sz.h * 0.5);
  let c = await counts(page);
  await P.touch("touchStart", [{ ...rp, id: 32 }]);
  await handled(page, c, "pointerdown", `${tag}: the steer press`);
  const sr = await page.evaluate(() => T.pad.steer);
  if (!(sr > 0.8)) console.log("        (steer press landed on " + JSON.stringify(await page.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return [p, e && (e.id || e.className || e.tagName), T.PT.slice(-2)]; }, rp)) + ")");
  await lift(P, `${tag}: the steer lift`);
  await play(page, 300, `${tag}: the steer springs back`);
  const s0 = await page.evaluate(() => T.pad.steer);
  const lp = await P.at("#padBox", 20, sz.h * 0.5);
  c = await counts(page);
  await P.touch("touchStart", [{ ...lp, id: 33 }]);
  await handled(page, c, "pointerdown", `${tag}: the steer press`);
  const sl = await page.evaluate(() => T.pad.steer);
  await lift(P, `${tag}: the steer lift`);
  check(sr > 0.8 && sl < -0.8 && s0 === 0, `${tag}: steer right ${sr.toFixed(2)}, left ${sl.toFixed(2)}, and back to ${s0} on release`);
  // a fast swipe up sets the hook, once
  await page.evaluate(() => T.clear());
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.75, 0, -Math.min(150, sz.h * 0.6), { n: 5, ms: 16, id: 34 });
  const y = await EVS(page, "yank");
  check(y.length === 1, `${tag}: a fast swipe up sets the hook (${y.length} yank, ${y[0] ? y[0].v.toFixed(0) : "?"} px/s)`);
  // keys, timed on the pad's own clock
  const [k0, g0] = await page.evaluate(() => { T.pad.keys({}); const v = T.pad.theta; T.pad.keys({ up: true }); return [v, T.clock]; });
  await until(page, `${tag}: W held for 250 ms of game time`, (g) => T.clock >= g + 250, g0);
  const [k1, g1] = await page.evaluate(() => { const v = T.pad.theta, g = T.clock; T.pad.keys({}); return [v, g]; });
  const wps = (k1 - k0) / ((g1 - g0) / 1000);
  check(Math.abs(wps - 120) < 25 || k1 === 110, `${tag}: W raises the rod at ~120°/s (${wps.toFixed(0)}°/s)`);
  await page.evaluate(() => T.pad.keys({ left: true }));
  await sleep(30);
  const kl = await page.evaluate(() => T.pad.steer);
  await page.evaluate(() => T.pad.keys({}));
  await play(page, 300, `${tag}: A let go`);
  const kl0 = await page.evaluate(() => T.pad.steer);
  check(kl === -1 && kl0 === 0, `${tag}: A holds steer at ${kl}, and it springs back to ${kl0}`);
}

/* ---------- screenshots ---------- */
/* ---------- the gauge: the rub band, the red line-out text, the stage marks, the label, and its patterns ---------- */
async function gaugeChecks(P, tag) {
  const { page } = P;
  // count the pixels in a rectangle (css px of the gauge) that match a colour test, read back from the canvas
  const count = (rect, test) => page.evaluate(([r, t]) => {
    const g = T.gauge, d = g.dpr, c = g.cv.getContext("2d");
    const x0 = Math.max(0, Math.floor(r[0] * d)), y0 = Math.max(0, Math.floor(r[1] * d)), w = Math.max(1, Math.floor(r[2] * d)), h = Math.max(1, Math.floor(r[3] * d));
    const px = c.getImageData(x0, y0, w, h).data, f = new Function("r", "g", "b", "a", "return " + t);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (f(px[i], px[i + 1], px[i + 2], px[i + 3])) n++;
    return n;
  }, [rect, test]);
  const shot = async (name, sel) => {
    if (process.env.ONLY === "checks") return;
    const clip = await page.evaluate((s) => { T.freeze(true); const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, sel);
    await page.screenshot({ path: path.join(SHOTS, "reel-" + tag.replace(/\W+/g, "-") + "-" + name + ".png"), clip, timeout: 120000 });
    await page.evaluate(() => T.freeze(false));
  };
  const RED = "a > 200 && r > 165 && g < 110 && b < 100", CREAM = "a > 200 && r > 225 && g > 215 && b > 190";
  // 700 ms of game time: the gauge eases to new values at the pace of the frames
  const settle = async () => { const g = await page.evaluate(() => { T.freeze(false); return T.game; }); await until(page, `${tag}: the gauge settles`, (g) => T.game >= g + 700, g); };
  const size = await page.evaluate(() => { T.mode("reel"); T.gauge.resize(); return { w: T.gauge.w, h: T.gauge.h }; });
  const { w, h } = size, top = h - 32;
  const FISH = { tfrac: 0.3, dragFrac: 0.4, slip: 0, lineOut: 40, depth: 2, stamina: 0.7, name: "Walleye", rub: 0, spool: 0, phases: null, label: "", slack: 0, tired: null };
  const set = (o) => page.evaluate((o) => T.gauge.set(o), Object.assign({}, FISH, o));

  // set() takes the new keys, keeps the old ones, and ignores what it does not know
  const back = await page.evaluate(() => { T.gauge.set({ rub: 0.4, spool: 0.7, phases: [0.6, 0.3], label: "Big fish on!", nonsense: 5 }); T.gauge.set(null); const s = T.gauge.s; return { rub: s.rub, spool: s.spool, phases: s.phases, label: s.label, nonsense: "nonsense" in s, tfrac: s.tfrac }; });
  check(back.rub === 0.4 && back.spool === 0.7 && JSON.stringify(back.phases) === "[0.6,0.3]" && back.label === "Big fish on!" && !back.nonsense, `${tag}: gauge.set() takes rub, spool, phases and label, and ignores the rest (${JSON.stringify(back)})`);
  const bad = await page.evaluate(async () => {
    try { for (const o of [{ rub: NaN, spool: "x", phases: "no", label: null }, { phases: [NaN, -1, 0, 1, 2, 0.5] }, { rub: 9, spool: -3 }, { rub: undefined }]) { T.gauge.set(o); T.gauge.draw(0.016); } return "ok"; } catch (e) { return e.message; }
  });
  check(bad === "ok", `${tag}: nonsense values in the new fields do not break the gauge (${bad})`);

  // the rub band: red pixels in the band in the fish name row (gauge.box.rub says where it was drawn), none with a clean line
  await set({ rub: 0.8 }); await settle();
  const rb = await page.evaluate(() => T.gauge.box.rub), band = rb ? [rb.x, rb.y - 2, rb.w, rb.h + 4] : [0, 0, 1, 1];
  const r8 = await count(band, RED);
  await set({}); await settle();
  const r0 = await count(band, RED);
  await set({ rub: 0.2 }); await settle();
  const r2 = await count(band, RED);
  check(!!rb && r0 < 30 && r8 > 120 && r8 > 2.5 * r2 && r2 > r0, `${tag}: the rub band fills as the line rubs (red pixels: none ${r0}, 20% ${r2}, 80% ${r8})`);
  await set({ rub: 0.8 }); await settle();
  await shot("gauge-rub", "#gaugeBox");
  // it is a band, not a spot: it runs from its left end in
  const left = await count([band[0], band[1], band[2] * 0.5, band[3]], RED), right = await count([band[0] + band[2] * 0.6, band[1], band[2] * 0.4, band[3]], RED);
  check(left > 40 && right < left * 0.6, `${tag}: an 80% band ends before the right edge (left half ${left}, right 40% ${right})`);

  // the spool: the line-out number turns red above 0.6
  const col = [w * 0.5, 0, w * 0.5 - 4, top - 12];
  await set({ spool: 0.3 }); await settle();
  const s3 = await count(col, RED);
  await set({ spool: 0.59 }); await settle();
  const s59 = await count(col, RED);
  await set({ spool: 0.65 }); await settle();
  const s65 = await count(col, RED);
  await set({ spool: 0.9 }); await settle();
  const s9 = await count(col, RED);
  await shot("gauge-spool", "#gaugeBox");
  check(s3 < 40 && s59 < 40 && s65 > 90 && s9 > 90, `${tag}: the line out turns red above 0.6 of the spool (red pixels: 0.3 ${s3}, 0.59 ${s59}, 0.65 ${s65}, 0.9 ${s9})`);

  // the stage marks on the stamina bar: a cream tick where each next stage starts (the bar ends where FIGHT is written)
  await set({}); await settle();
  const bb = await page.evaluate(() => T.gauge.box.bar), bx = bb.x, bw = bb.w, by = h - 11;
  const m0 = (await count([bx + bw * 0.6 - 1, by - 6, 2, 3], CREAM)) + (await count([bx + bw * 0.3 - 1, by - 6, 2, 3], CREAM));
  await set({ phases: [0.6, 0.3] }); await settle();
  const m6 = await count([bx + bw * 0.6 - 1, by - 6, 2, 3], CREAM), m3 = await count([bx + bw * 0.3 - 1, by - 6, 2, 3], CREAM);
  const mMid = await count([bx + bw * 0.45 - 1, by - 6, 2, 3], CREAM);
  await shot("gauge-phases", "#gaugeBox");
  check(m0 === 0 && m6 > 0 && m3 > 0 && mMid === 0, `${tag}: a legend's stage marks show on the stamina bar at 0.6 and 0.3 (marks ${m6}/${m3}, between ${mMid}, before ${m0})`);

  // the label: red text in the strip in place of the brass name
  const strip = [12, h - 30, w - 24, 14];
  await set({}); await settle();
  const l0 = await count(strip, RED);
  await set({ label: "Big fish on!" }); await settle();
  const l1 = await count(strip, RED);
  await shot("gauge-label", "#gaugeBox");
  check(l0 < 20 && l1 > 40, `${tag}: "Big fish on!" takes the place of the name, in red (red pixels: name ${l0}, label ${l1})`);
  await set({ name: "Golden Loon Bass", rub: 0.5, spool: 0.8, phases: [0.55, 0.3], label: "" }); await settle();
  await shot("gauge-all", "#gaugeBox");

  // colour-blind safe: under a deuteranopia filter (Machado 2009) the parts still differ by pattern, not only by colour.
  // The danger zone of the arc is hatched and the safe zone is plain; the rub band is striped and the fish's bar is plain.
  // A pattern shows as a spread of brightness inside a small patch
  const spread = (rect) => page.evaluate((r) => {
    const g = T.gauge, d = g.dpr, c = g.cv.getContext("2d");
    const px = c.getImageData(Math.floor(r[0] * d), Math.floor(r[1] * d), Math.max(1, Math.floor(r[2] * d)), Math.max(1, Math.floor(r[3] * d))).data, L = [];
    for (let i = 0; i < px.length; i += 4) {
      const R = px[i], G = px[i + 1], B = px[i + 2];
      const r2 = 0.367322 * R + 0.860646 * G - 0.227968 * B, g2 = 0.280085 * R + 0.672501 * G + 0.047413 * B, b2 = -0.01182 * R + 0.04294 * G + 0.968881 * B;
      L.push(0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2);
    }
    const m = L.reduce((a, b) => a + b, 0) / L.length;
    return Math.sqrt(L.reduce((a, b) => a + (b - m) * (b - m), 0) / L.length);
  }, rect);
  await set({ tfrac: 0, rub: 0, stamina: 0.9, spool: 0, phases: null }); await settle();
  const arc = await page.evaluate(() => T.gauge.box.arc), A0 = 150 * Math.PI / 180, SW = 240 * Math.PI / 180;
  const patch = (f) => { const a = A0 + SW * f, k = arc.lw * 0.45; return [arc.cx + arc.R * Math.cos(a) - k, arc.cy + arc.R * Math.sin(a) - k, 2 * k, 2 * k]; };
  const safe = await spread(patch(0.2)), hot = await spread(patch(0.93));
  await set({ rub: 0.9, stamina: 0.9 }); await settle();
  const parts = await page.evaluate(() => ({ rub: T.gauge.box.rub, bar: T.gauge.box.bar }));
  const rubS = await spread([parts.rub.x + 2, parts.rub.y + 1, parts.rub.w * 0.6, parts.rub.h - 2]), barS = await spread([parts.bar.x + 4, parts.bar.y + 1, parts.bar.w * 0.6, parts.bar.h - 2]);
  check(hot > 2 * safe + 4 && rubS > 2 * barS + 4, `${tag}: under deuteranopia the danger zone is hatched and the safe zone plain (spread ${hot.toFixed(1)} vs ${safe.toFixed(1)}), the rub band striped and the fish's bar plain (${rubS.toFixed(1)} vs ${barS.toFixed(1)})`);
  // and every state has its own word: GOOD, TIGHT, SLIPPING, SLACK, TOO TIGHT
  const wordOf = async (o) => { await set(o); await settle(); return page.evaluate(() => T.gauge.box.word); };
  const states = [await wordOf({ tfrac: 0.3, rub: 0, slip: 0, slack: 0 }), await wordOf({ tfrac: 0.6, slip: 0 }), await wordOf({ tfrac: 0.5, slip: 0.8 }), await wordOf({ tfrac: 0.01, slip: 0, slack: 1 }), await wordOf({ tfrac: 0.95, slack: 0 })];
  check(states.join() === "GOOD,TIGHT,SLIPPING,SLACK,TOO TIGHT", `${tag}: each state has its own word (${states.join(", ")})`);
  await set({ slack: 0.2, tfrac: 0.01 }); await settle();
  check((await page.evaluate(() => T.gauge.box.word)) === "GOOD", `${tag}: SLACK waits until the line has been slack 0.3 s`);
  // the fish's bar says what it shows: FIGHT, and TIRED when the fish is beaten
  await page.evaluate(() => { const c = T.gauge.cv.getContext("2d"), f = c.fillText; window.__gt = []; c.fillText = function (t, ...a) { window.__gt.push(String(t)); return f.call(this, t, ...a); }; });
  await set({ tfrac: 0.31, stamina: 0.05, tired: true }); await settle();
  const tiredT = await page.evaluate(() => window.__gt.includes("TIRED"));
  await set({ tfrac: 0.32, stamina: 0.7, tired: false }); await settle();
  await page.evaluate(() => { window.__gt = []; });
  await set({ tfrac: 0.36, stamina: 0.7, tired: false }); await settle();
  const fightT = await page.evaluate(() => window.__gt.includes("FIGHT") && !window.__gt.includes("TIRED"));
  check(tiredT && fightT, `${tag}: the fish's bar says FIGHT, and TIRED when the fish is beaten (${tiredT}, ${fightT})`);
  await set({});
  await page.evaluate(() => T.gauge.set({ tfrac: 0, slip: 0, stamina: null, name: "", rub: 0, spool: 0, phases: null, label: "" }));
}

async function shots(P, tag) {
  const { page } = P;
  const shot = async (name, sel) => {
    const clip = await page.evaluate((s) => { T.freeze(true); const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }, sel);
    await page.screenshot({ path: path.join(SHOTS, "reel-" + tag + "-" + name + ".png"), clip, timeout: 120000 });
    await page.evaluate(() => T.freeze(false));
  };
  const full = async (name) => {
    await page.evaluate(() => T.freeze(true));
    await page.screenshot({ path: path.join(SHOTS, "reel-" + tag + "-" + name + ".png"), timeout: 120000 });
    await page.evaluate(() => T.freeze(false));
  };
  await page.evaluate(() => { T.mode("cast"); T.panel.set({ bail: "closed", glow: "bail", pinned: false, spool: 0, touchCast: false, hint: "" }); });
  await sleep(500);
  await shot("face-closed", "#reelBox");
  await full("cast-closed");
  await page.evaluate(() => T.panel.set({ bail: "open", glow: "pin", touchCast: true }));
  await sleep(600);
  await shot("face-open", "#reelBox");
  const box = await P.size("#reelBox");
  const th = await P.at("#reelBox", box.w * 0.42, box.h * 0.5);
  await P.touch("touchStart", [{ ...th, id: 40 }]);
  await page.evaluate(() => T.panel.set({ pinned: true, glow: "" }));
  await sleep(400);
  await shot("face-pinned", "#reelBox");
  await P.touch("touchEnd", []);
  await page.evaluate(() => { T.mode("cast", { flying: true }); T.panel.set({ pinned: false, glow: "", spool: 7 }); });
  await sleep(600);
  await shot("face-spinning", "#reelBox");
  await full("cast-flying");
  await page.evaluate(() => { T.mode("cast"); T.panel.set({ spool: 0, bail: "closed", glow: "bail", hint: "Swipe the bail down." }); });
  await sleep(400);
  await page.evaluate(() => T.panel.set({ hint: "" }));
  // the reel phase
  await page.evaluate(() => { T.mode("reel"); T.gauge.set({ tfrac: 0.2, dragFrac: 0.4, slip: 0, lineOut: 23.4, depth: 1.2, stamina: null, name: "" }); });
  await sleep(500);
  await full("reel-idle");
  await shot("crank", "#crankBox");
  await shot("pad", "#padBox");
  await shot("gauge-low", "#gaugeBox");
  await page.evaluate(() => { T.gauge.set({ tfrac: 0.58, dragFrac: 0.4, slip: 0.4, lineOut: 18.7, depth: 3.4, stamina: 0.72, name: "Smallmouth Bass" }); T.crank.keyHold(true); });
  await sleep(700);
  await shot("gauge-mid", "#gaugeBox");
  await shot("crank-spinning", "#crankBox");
  await full("reel-fight");
  await page.evaluate(() => { T.crank.keyHold(false); T.gauge.set({ tfrac: 0.95, slip: 0, lineOut: 9.1, depth: 0.8, stamina: 0.18, name: "Muskellunge" }); });
  await sleep(600);
  await shot("gauge-high", "#gaugeBox");
  await page.evaluate(() => T.gauge.set({ tfrac: 0, slip: 0, stamina: null, name: "" }));
}

async function run() {
  // portrait phone
  let P;
  if (process.env.ONLY !== "landscape") {
  P = await openPage(390, 844);
  if (process.env.ONLY !== "checks") await shots(P, "390x844");
  if (process.env.ONLY !== "shots") {
    await panelChecks(P, "portrait");
    await crankChecks(P, "portrait");
    await padChecks(P, "portrait");
    await gaugeChecks(P, "portrait");
    // the phone sideways with the browser locked upright: main.js turns #game with CSS
    for (const rot of [90, -90]) {
      await P.page.evaluate((r) => { T.applyRotation(r); }, rot);
      await sleep(100);
      await panelChecks(P, "rot " + rot);
      await crankChecks(P, "rot " + rot);
      await padChecks(P, "rot " + rot);
      await P.page.evaluate(() => T.applyRotation(0));
    }
  }
  await P.ctx.close();
  }
  // landscape phone
  P = await openPage(844, 390);
  if (process.env.ONLY !== "checks") await shots(P, "844x390");
  if (process.env.ONLY !== "shots") {
    await panelChecks(P, "landscape");
    await crankChecks(P, "landscape");
    await gaugeChecks(P, "landscape");
  }
  await P.ctx.close();
}

try {
  await run();
} catch (e) {
  console.error(e);
  fails.push("threw: " + e.message);
} finally {
  await browser.close();
  if (server) server.kill();
}
check(errors.length === 0, "no console or page errors" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall passed");
console.log("Screenshots in " + SHOTS);
process.exit(fails.length ? 1 : 0);
