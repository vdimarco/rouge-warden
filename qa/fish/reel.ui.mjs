// Checks reel.js (the reel face, the crank, the rod pad, the gauge) in a real browser with real touch sequences.
// Run: node qa/fish/reel.ui.mjs            (serves public/ itself on a free port; exit code 1 on failure)
// Options: SHOTS=dir (where the screenshots go; default qa/fish/shots), ONLY=shots to take the screenshots only.
// The harness page mirrors index.html: the same CSS (read from the file), the same #game / #reelBox / #crankBox /
// #padBox / #gaugeBox structure, invisible switch pads like haptics.js adds, and main.js's toLocal and CSS rotation.
import { createRequire } from "module";
import { execSync, spawn } from "child_process";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import net from "net";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const req = createRequire(import.meta.url);
let pw;
try { pw = req("playwright"); } catch (e) { pw = req(path.join(execSync("npm root -g").toString().trim(), "playwright")); }
const SHOTS = process.env.SHOTS || path.join(here, "shots");
mkdirSync(SHOTS, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- serve public/ ---------- */
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: path.join(root, "public"), stdio: "ignore" });
const BASE = "http://127.0.0.1:" + port;
for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + "/fish/js/reel.js"); if (r.ok) break; } catch (e) { /* not up yet */ } await sleep(100); }

/* ---------- the harness page ---------- */
const indexHtml = readFileSync(path.join(root, "public/fish/index.html"), "utf8");
const css = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
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
for (const t of ["bail", "pin", "pinmove", "unpin"]) panel.on(t, (e) => EV.push(Object.assign({ type: t, at: performance.now() }, e)));
const crank = new Crank($("#crankBox"), { toLocal, hand: "right" });
crank.on("turn", (e) => EV.push(Object.assign({ type: "turn", at: performance.now() }, e)));
const pad = new RodPad($("#padBox"), { toLocal });
pad.on("yank", (e) => EV.push(Object.assign({ type: "yank", at: performance.now() }, e)));
const gauge = new Gauge($("#gaugeBox"));
for (const t of ["pointerdown", "pointerup", "pointercancel"]) addEventListener(t, (e) => PT.push({ type: t, id: e.pointerId, t: e.timeStamp, h: performance.now(), target: e.target.id || e.target.className || e.target.tagName }), true);
let lastMove = 0, moves = 0;
addEventListener("pointermove", (e) => { lastMove = e.timeStamp; moves++; }, true);
function mode(m, { flying = false } = {}) {
  const wide = game.clientWidth > game.clientHeight * 1.15;
  const cast = m === "cast";
  game.className = "l-" + (cast ? (wide ? "wide-cast" : "tall-cast") : (wide ? "reel" : "tall-reel")) + (flying ? " flying" : "") + " touch";
  $("#castUI").hidden = !cast;
  $("#reelUI").hidden = cast;
  panel.resize(); crank.resize(); pad.resize(); gauge.resize();
}
let last = performance.now(), sample = false, frozen = false;
function frame() {
  requestAnimationFrame(frame);
  const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (frozen) return;
  if (sample) RATES.push({ t, rate: crank.rate, ang: crank.angle });
  if (!$("#castUI").hidden) panel.draw(dt);
  if (!$("#reelUI").hidden) { crank.draw(dt); gauge.draw(dt); if (!pad.hidden) pad.draw(dt); }
}
requestAnimationFrame(frame);
window.T = { LAT, FR, panel, crank, pad, gauge, EV, PT, RATES, REEL_UI, G, applyRotation, toLocal, toClient, mode,
  sampling(b) { sample = b; if (b) RATES.length = 0; },
  // hold the last frame still while a screenshot is taken (software raster in a busy test box is slow)
  freeze(b) { frozen = b; }, get lastMove() { return lastMove; }, get moves() { return moves; }, clear() { EV.length = 0; PT.length = 0; } };
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
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 9, radiusY: 9, force: 1 })) });
  // client point for a point in an element's local css pixels
  const at = (sel, x, y) => page.evaluate(([s, x, y]) => T.toClient(x, y, document.querySelector(s)), [sel, x, y]);
  const size = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return { w: e.clientWidth, h: e.clientHeight }; }, sel);
  return { ctx, page, cdp, touch, at, size };
}
const EVS = (page, type) => page.evaluate((t) => T.EV.filter((e) => !t || e.type === t), type);

// a swipe in local coordinates of sel, from (x,y) by (dx,dy) in n steps of ms
async function swipe(P, sel, x, y, dx, dy, { n = 6, ms = 16, id = 1, hold = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(await P.at(sel, x + (dx * i) / n, y + (dy * i) / n));
  await P.touch("touchStart", [{ ...pts[0], id }]);
  if (hold) await sleep(hold);
  for (let i = 1; i <= n; i++) { await sleep(ms); await P.touch("touchMove", [{ ...pts[i], id }]); }
  await sleep(ms);
  await P.touch("touchEnd", []);
  await sleep(30);
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
  await swipe(P, "#reelBox", b.x + b.w / 2, b.y + b.h / 2, 4, -80, { n: 6, ms: 18, id: 3 });
  ev = await EVS(page);
  const types = ev.filter((e) => e.type !== "pinmove").map((e) => e.type + (e.type === "bail" ? ":" + e.open : ""));
  check(types.join(",") === "pin,bail:false,unpin", `${tag}: open bail: press pins at once, swipe up closes, lift unpins (${types.join(",")})`);
  const pt = await page.evaluate(() => T.PT.slice());
  const down = pt.find((p) => p.type === "pointerdown"), up = pt.find((p) => p.type === "pointerup");
  const pin = ev.find((e) => e.type === "pin"), unpin = ev.find((e) => e.type === "unpin");
  check(pin && down && Math.abs(pin.t - down.t) < 0.01, `${tag}: an open-bail pin carries the press time`);
  check(unpin && up && unpin.id === pin.id && Math.abs(unpin.t - up.t) < 0.01, `${tag}: unpin carries the lift's event.timeStamp and the same id`);
  check(ev.filter((e) => e.type === "pinmove").length >= 5, `${tag}: pinmove follows the finger`);

  // bail closed: a hold anywhere pins after ~90 ms, not before
  await page.evaluate(() => { T.panel.set({ bail: "closed", glow: "bail" }); T.clear(); });
  await sleep(40);
  const spot = await P.at("#reelBox", box.w * 0.12, box.h * 0.85);
  await P.touch("touchStart", [{ ...spot, id: 5 }]);
  await sleep(45);
  let early = await EVS(page, "pin");
  await sleep(160);
  ev = await EVS(page, "pin");
  const d2 = (await page.evaluate(() => T.PT.slice())).find((p) => p.type === "pointerdown");
  check(early.length === 0 && ev.length === 1 && ev[0].t - d2.t >= 85 && ev[0].t - d2.t < 180, `${tag}: closed bail: a hold pins after ~90 ms (${ev[0] ? (ev[0].t - d2.t).toFixed(0) : "none"} ms; the press reached the page ${(d2.h - d2.t).toFixed(0)} ms late)`);
  await P.touch("touchEnd", []);
  await sleep(40);
  ev = await EVS(page, "unpin");
  const up2 = (await page.evaluate(() => T.PT.slice())).find((p) => p.type === "pointerup");
  check(ev.length === 1 && Math.abs(ev[0].t - up2.t) < 0.01 && ev[0].id === up2.id, `${tag}: the hold unpins on lift with its time and id`);
  // a quick tap or a drag with the bail closed is no pin
  await page.evaluate(() => T.clear());
  await P.touch("touchStart", [{ ...spot, id: 6 }]); await sleep(40); await P.touch("touchEnd", []);
  await sleep(150);
  await swipe(P, "#reelBox", box.w * 0.12, box.h * 0.85, 60, -5, { n: 3, ms: 16, id: 7 });
  await sleep(150);
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
  await sleep(40);
  ev = await EVS(page);
  const pins = ev.filter((e) => e.type === "pin"), unpins = ev.filter((e) => e.type === "unpin");
  check(pins.length === 1 && unpins.length === 0, `${tag}: a second finger neither pins nor unpins (pins ${pins.length}, unpins ${unpins.length})`);
  await P.touch("touchEnd", []);
  await sleep(40);
  ev = await EVS(page, "unpin");
  check(ev.length === 1 && ev[0].id === pins[0].id, `${tag}: only the pinning finger unpins`);
  // controls are not pins: the HUD button and a [data-nopin] area; the invisible switch pad on the reel is
  await page.evaluate(() => T.clear());
  const hudBtn = await page.evaluate(() => { const r = document.querySelector("#pauseBtn"); return T.toClient(r.offsetWidth / 2, r.offsetHeight / 2, r); });
  await P.touch("touchStart", [{ ...hudBtn, id: 12 }]); await sleep(30); await P.touch("touchEnd", []); await sleep(30);
  const np = await P.at("#nopin", 40, 40);
  await P.touch("touchStart", [{ ...np, id: 13 }]); await sleep(30); await P.touch("touchEnd", []); await sleep(30);
  ev = await EVS(page, "pin");
  const tg = await page.evaluate(() => T.PT.filter((p) => p.type === "pointerdown").map((p) => p.target));
  check(ev.length === 0, `${tag}: presses on the HUD and on [data-nopin] are not pins (targets ${tg.join(", ")})`);
  await page.evaluate(() => T.clear());
  await P.touch("touchStart", [{ ...A, id: 14 }]); await sleep(30); await P.touch("touchEnd", []); await sleep(30);
  ev = await EVS(page);
  const tg2 = await page.evaluate(() => T.PT.filter((p) => p.type === "pointerdown").map((p) => p.target));
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "unpin").length === 1 && /qa-pad/.test(tg2.join()), `${tag}: a press that lands on the haptic switch pad still pins (target ${tg2.join()})`);
  // a press on the lake view pins too (the whole game area)
  await page.evaluate(() => T.clear());
  const lake = await page.evaluate(() => T.toClient(document.querySelector("#game").clientWidth * 0.5, 60, document.querySelector("#game")));
  await P.touch("touchStart", [{ ...lake, id: 15 }]); await sleep(30); await P.touch("touchEnd", []); await sleep(30);
  ev = await EVS(page);
  check(ev.filter((e) => e.type === "pin").length === 1 && ev.filter((e) => e.type === "unpin").length === 1, `${tag}: a press on the lake view pins (the whole game area listens)`);
  await page.evaluate(() => T.panel.set({ bail: "closed", glow: "" }));
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
  async function circle(rps, secs, id, { lift = false, hold = 0 } = {}) {
    const t0 = performance.now();
    await P.touch("touchStart", [{ ...pt(0), id }]);
    let el = 0;
    while (el < secs) {
      await sleep(14);
      el = (performance.now() - t0) / 1000;
      await P.touch("touchMove", [{ ...pt(TAU * rps * el), id }]);
    }
    if (hold) await sleep(hold);
    if (lift) await P.touch("touchEnd", []);
  }
  const TAU = Math.PI * 2;
  // a steady 2 rev/s circle
  const m0 = await page.evaluate(() => { T.sampling(true); return T.moves; });
  await circle(2, 1.6, 20, { hold: 450 });
  const log = await page.evaluate(() => ({ r: T.RATES.slice(), last: T.lastMove, moves: T.moves, pt: T.PT.slice(-4) }));
  console.log("        (" + (log.moves - m0) + " pointermoves seen, " + log.r.length + " frames; " + JSON.stringify(log.pt) + ")");
  await page.evaluate(() => T.sampling(false));
  await P.touch("touchEnd", []);
  const steady = log.r.filter((s) => s.t > log.r[0].t + 400 && s.t < log.last - 20).map((s) => s.rate);
  const mean = steady.reduce((a, b) => a + b, 0) / Math.max(1, steady.length);
  const lo = Math.min(...steady), hi = Math.max(...steady);
  check(steady.length > 20 && Math.abs(mean - 2) < 0.3 && lo > 1.7 && hi < 2.3, `${tag}: a steady 2 rev/s circle reads ${mean.toFixed(2)} rev/s (min ${lo.toFixed(2)}, max ${hi.toFixed(2)}, ${steady.length} frames)`);
  const zeroAt = log.r.find((s) => s.t > log.last && s.rate === 0);
  const stop = zeroAt ? zeroAt.t - log.last : Infinity;
  check(stop <= 260, `${tag}: the rate falls to 0 ${stop.toFixed(0)} ms after the thumb stops (want <= 250)`);
  const turns = (await EVS(page, "turn")).length;
  check(turns >= 11 && turns <= 14, `${tag}: about 4 turn events per turn (${turns} for ~3.2 turns)`);
  // the other way winds in too
  await page.evaluate(() => { T.sampling(true); T.clear(); });
  await circle(-1.5, 1.0, 21, { lift: true });
  const back = await page.evaluate(() => T.RATES.slice());
  await page.evaluate(() => T.sampling(false));
  const bm = back.filter((s, i) => i > back.length * 0.5).map((s) => s.rate);
  check(bm.length && bm.every((r) => r > 1.1 && r < 1.9), `${tag}: turning the other way also reels (${(bm.reduce((a, b) => a + b, 0) / Math.max(1, bm.length)).toFixed(2)} rev/s)`);
  // a fling keeps a little spin after the thumb lifts
  await sleep(1400);
  await page.evaluate(() => { T.sampling(true); });
  await circle(3, 0.5, 22, { lift: true });
  const liftAt = performance.now();
  await sleep(1500);
  const fl = await page.evaluate(() => ({ r: T.RATES.slice(), up: T.PT.filter((p) => p.type === "pointerup").pop() }));
  await page.evaluate(() => T.sampling(false));
  const after = fl.r.filter((s) => s.t > fl.up.t + 150 && s.t < fl.up.t + 250);
  const dead = fl.r.find((s) => s.t > fl.up.t && s.rate === 0);
  check(after.length && after.every((s) => s.rate > 0.3) && dead && dead.t - fl.up.t < 1400, `${tag}: a fling coasts (${after.length ? after[0].rate.toFixed(2) : "?"} rev/s 150 ms after the lift, stops after ${dead ? (dead.t - fl.up.t).toFixed(0) : "never"} ms)`);
  void liftAt;
  // the mouse wheel: a 100 px flick is about a quarter turn
  await page.evaluate(() => T.clear());
  const a0 = await page.evaluate(() => T.crank.angle);
  await page.evaluate(() => { T.sampling(true); T.crank.wheel(100); });
  await sleep(700);
  const wl = await page.evaluate(() => ({ r: T.RATES.slice(), a: T.crank.angle, turns: T.EV.filter((e) => e.type === "turn").length }));
  await page.evaluate(() => T.sampling(false));
  const turned = (wl.a - a0) / TAU, wmax = Math.max(...wl.r.map((s) => s.rate));
  check(Math.abs(turned - 0.25) < 0.02 && wmax > 0.8 && wl.turns === 1 && wl.r[wl.r.length - 1].rate === 0, `${tag}: wheel(100) turns ${turned.toFixed(3)} rev (peak ${wmax.toFixed(2)} rev/s, ${wl.turns} turn event)`);
  // R held: a steady 1.6 rev/s
  await page.evaluate(() => T.crank.keyHold(true));
  await sleep(500);
  const kr = await page.evaluate(() => T.crank.rate);
  await page.evaluate(() => T.crank.keyHold(false));
  await sleep(300);
  const kr0 = await page.evaluate(() => T.crank.rate);
  check(Math.abs(kr - 1.6) < 0.05 && kr0 === 0, `${tag}: keyHold gives ${kr.toFixed(3)} rev/s, then ${kr0} when let go`);
}

/* ---------- the rod pad ---------- */
async function padChecks(P, tag) {
  const { page } = P;
  await page.evaluate(() => { T.mode("reel"); T.clear(); T.pad.keys({}); });
  await sleep(80);
  const sz = await P.size("#padBox");
  const th0 = await page.evaluate(() => T.pad.theta);
  const dpp = await page.evaluate(() => (T.REEL_UI.rodMax - T.REEL_UI.rodMin) / Math.max(120, document.querySelector("#padBox").clientHeight * 0.8));
  // a slow drag up 60 px: the rod goes up and stays there; no hook set
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.6, 0, -60, { n: 12, ms: 25, id: 30 });
  await sleep(300);
  const th1 = await page.evaluate(() => T.pad.theta);
  check(Math.abs(th1 - th0 - 60 * dpp) < 3, `${tag}: drag up 60 px raises the rod ${(th1 - th0).toFixed(1)}° (want ${(60 * dpp).toFixed(1)}) and it stays`);
  check((await EVS(page, "yank")).length === 0, `${tag}: a slow drag does not set the hook`);
  // drag down lowers it, and it stops at 10
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.2, 0, sz.h * 0.75, { n: 10, ms: 25, id: 31 });
  await sleep(50);
  const th2 = await page.evaluate(() => T.pad.theta);
  check(th2 >= 10 && th2 < th1 - 20, `${tag}: drag down lowers the rod (${th2.toFixed(1)}°), never below 10`);
  // steer: a finger at the right edge steers right; it springs back after the lift
  const rp = await P.at("#padBox", sz.w - 4, sz.h * 0.5);
  await P.touch("touchStart", [{ ...rp, id: 32 }]);
  await sleep(40);
  const sr = await page.evaluate(() => T.pad.steer);
  await P.touch("touchEnd", []);
  await sleep(300);
  const s0 = await page.evaluate(() => T.pad.steer);
  const lp = await P.at("#padBox", 4, sz.h * 0.5);
  await P.touch("touchStart", [{ ...lp, id: 33 }]);
  await sleep(40);
  const sl = await page.evaluate(() => T.pad.steer);
  await P.touch("touchEnd", []);
  await sleep(300);
  check(sr > 0.9 && sl < -0.9 && s0 === 0, `${tag}: steer right ${sr.toFixed(2)}, left ${sl.toFixed(2)}, and back to ${s0} on release`);
  // a fast swipe up sets the hook, once
  await page.evaluate(() => T.clear());
  await swipe(P, "#padBox", sz.w / 2, sz.h * 0.75, 0, -Math.min(150, sz.h * 0.6), { n: 5, ms: 16, id: 34 });
  await sleep(50);
  const y = await EVS(page, "yank");
  check(y.length === 1, `${tag}: a fast swipe up sets the hook (${y.length} yank, ${y[0] ? y[0].v.toFixed(0) : "?"} px/s)`);
  // keys
  await page.evaluate(() => { T.pad.keys({}); });
  const k0 = await page.evaluate(() => T.pad.theta);
  await page.evaluate(() => T.pad.keys({ up: true }));
  await sleep(250);
  const k1 = await page.evaluate(() => { const v = T.pad.theta; T.pad.keys({}); return v; });
  check(Math.abs((k1 - k0) / 0.25 - 120) < 25 || k1 === 110, `${tag}: W raises the rod at ~120°/s (${((k1 - k0) / 0.25).toFixed(0)}°/s)`);
  await page.evaluate(() => T.pad.keys({ left: true }));
  await sleep(30);
  const kl = await page.evaluate(() => T.pad.steer);
  await page.evaluate(() => T.pad.keys({}));
  await sleep(300);
  const kl0 = await page.evaluate(() => T.pad.steer);
  check(kl === -1 && kl0 === 0, `${tag}: A holds steer at ${kl}, and it springs back to ${kl0}`);
}

/* ---------- screenshots ---------- */
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
  server.kill();
}
check(errors.length === 0, "no console or page errors" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
console.log(fails.length ? "\n" + fails.length + " FAILED" : "\nall passed");
process.exit(fails.length ? 1 : 0);
