// Up the Creek: the page. The river and the canoe step at 120 Hz (river.js, canoe.js). You paddle with the phone
// (paddle.js reads the pose from /fish/js/motion.js), with your thumbs (drag down on the side you want to turn to), or
// with keys. The view looks down on the river and turns with the canoe, so its right side stays on the right of the
// screen.
import { makeRiver, FINISH, START, JAM } from "./river.js";
import { newCanoe, act, step, H, C, closestMiss } from "./canoe.js";
import { createPaddle, steer } from "./paddle.js";
import { daySeed, hashParams } from "../kit/rng.js";
import { startLoop, fitCanvas } from "../kit/loop.js";
import { Sfx, hiss, tone, splash as splashSound, loonTremolo } from "../kit/sfx.js";
import { labBar, startCard, endCard, toast, onUi, shareLink } from "../kit/start.js";
import { stats } from "../kit/stats.js";
import { Motion } from "/fish/js/motion.js";
import { Haptics } from "/fish/js/haptics.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#view"), g = canvas.getContext("2d");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const buzz = (fn, ...a) => { try { Haptics[fn](...a); } catch (e) { /* no buzz here */ } };
const R2D = 180 / Math.PI;

/* ---------------- the river of the day, and the run ---------------- */
const P = hashParams(location.hash);
const seed = P.s && /^\d+$/.test(P.s) ? Number(P.s) >>> 0 : daySeed("creek");
const today = seed === daySeed("creek");
const river = makeRiver(seed);
// a link to this river: a friend who opens it paddles the same rocks
const riverUrl = () => `${location.origin}${location.pathname}#s=${seed}`;
const S = stats("creek");
let phase = "title";   // title, calibrate, play, end
let canoe = newCanoe(river);
const ev = [];
let mode = "touch";    // "motion" once the sensors are on
let strokeAnim = null, braceSide = 0, keyBrace = 0, touchBrace = 0;

/* ---------------- the phone as a paddle ---------------- */
let pull = -1;
try { const v = Number(localStorage.getItem("lab.creek.pull")); if (v === 1 || v === -1) pull = v; } catch (e) { /* storage off */ }
const paddle = createPaddle({ pull, onAction: (a) => { if (phase === "play") doAction(a, "motion"); } });
Motion.mode = "portrait";
Motion.on((pose) => {
  if (phase === "calibrate") return calibrate(pose);
  if (mode === "motion") paddle.feed(pose);
});

let lastAct = null;
function doAction(a, from) {
  if (a.type === "brace") { if (from === "motion") braceSide = a.on ? a.side : 0; if (a.on) Sfx.play(sndBrace); return; }
  act(canoe, a);
  lastAct = { ...a, from };
  if (a.type === "stroke" || a.type === "back") {
    strokeAnim = { side: a.side, t: 0, back: a.type === "back", power: a.power ?? 1 };
    Sfx.play(sndStroke, a.power ?? 1);
    buzz("bump", 0.35 + 0.3 * (a.power ?? 1));
    spray(a.side, a.power ?? 1);
    S.act(a.type);
  } else if (a.type === "j") { Sfx.play(sndJ); S.act("j"); }
}

/* ---------------- thumbs: drag down on the side you want to turn to, hook out for a J, drag up to back-paddle, hold to brace ---------------- */
// The side you drag is the way the bow turns (paddle.js steer()): a new player expects that, and a bot that drags the
// other way stalls near the top (qa/lab/creek.thumbs.mjs). The paddle then goes in on the other side, as it must.
const touches = new Map();
canvas.addEventListener("pointerdown", (e) => {
  if (onUi(e) || phase !== "play") return;
  e.preventDefault();
  const side = e.clientX < innerWidth / 2 ? -1 : 1;
  touches.set(e.pointerId, { side, x0: e.clientX, y0: e.clientY, t0: performance.now(), px: e.clientX, py: e.clientY, pt: performance.now(), stroked: false, hooked: false, bracing: false, moved: 0 });
});
canvas.addEventListener("pointermove", (e) => {
  const q = touches.get(e.pointerId);
  if (!q || phase !== "play") return;
  const now = performance.now(), dy = e.clientY - q.y0, dx = e.clientX - q.x0;
  q.moved = Math.max(q.moved, Math.hypot(dx, dy));
  const v = Math.hypot(e.clientX - q.px, e.clientY - q.py) / Math.max(8, now - q.pt);   // px per ms
  q.px = e.clientX; q.py = e.clientY; q.pt = now;
  if (q.bracing) return;
  if (!q.stroked && dy > 28) { q.stroked = true; doAction(steer("stroke", q.side, clamp(v / 0.9, 0.35, 1.4)), "touch"); }
  else if (!q.stroked && dy < -28) { q.stroked = true; doAction(steer("back", q.side, clamp(v / 0.9, 0.35, 1.2)), "touch"); }
  else if (q.stroked && !q.hooked && q.side * dx > 26 && dy > 20) { q.hooked = true; doAction(steer("j", q.side, 1), "touch"); }
});
const lift = (e) => { const q = touches.get(e.pointerId); if (q && q.bracing) touchBrace = 0; touches.delete(e.pointerId); };
window.addEventListener("pointerup", lift);
window.addEventListener("pointercancel", lift);
// a finger held still is a brace on its side
setInterval(() => {
  const now = performance.now();
  for (const q of touches.values()) {
    if (!q.bracing && !q.stroked && q.moved < 10 && now - q.t0 > 220) { q.bracing = true; touchBrace = q.side; Sfx.play(sndBrace); buzz("splash", 0.4); }
  }
}, 40);

/* ---------------- keys: A and D turn, W paddles straight, Q and E J-stroke, S backs, hold Z or C to brace ---------------- */
// Like thumbs, a key turns the bow toward its side. W and S take turns on the two sides, so they go straight.
const held = new Set();
let wSide = 1, sSide = 1;
window.addEventListener("keydown", (e) => {
  if (phase !== "play" || e.repeat) return;
  const k = e.key.toLowerCase();
  const stroke = (toward, j) => { doAction(steer("stroke", toward, 1), "key"); if (j) setTimeout(() => doAction(steer("j", toward, 1), "key"), 150); };
  if (k === "a" || k === "arrowleft") stroke(-1, false);
  else if (k === "d" || k === "arrowright") stroke(1, false);
  else if (k === "w" || k === "arrowup") { wSide = -wSide; doAction({ type: "stroke", side: wSide, power: 1 }, "key"); }
  else if (k === "q") stroke(-1, true);
  else if (k === "e") stroke(1, true);
  else if (k === "s" || k === "arrowdown") { sSide = -sSide; doAction({ type: "back", side: sSide, power: 1 }, "key"); }
  else if (k === "z") { held.add("z"); keyBrace = -1; Sfx.play(sndBrace); }
  else if (k === "c") { held.add("c"); keyBrace = 1; Sfx.play(sndBrace); }
  else if (k === "r") begin();
  else return;
  e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "z" || k === "c") { held.delete(k); keyBrace = held.has("z") ? -1 : held.has("c") ? 1 : 0; }
});

/* ---------------- calibration: learn which way this player rocks the phone for a stroke ---------------- */
let calibT = 0;
function calibrate(pose) {
  if (Math.abs(pose.omega) >= 150 && Math.abs(pose.omega) >= 0.6 * Math.max(pose.spin, Math.abs(pose.omega))) {
    pull = pose.omega > 0 ? 1 : -1;
    paddle.pull = pull;
    try { localStorage.setItem("lab.creek.pull", String(pull)); } catch (e) { /* storage off */ }
    toast("Got it. That is a stroke.");
    begin("motion");
  }
}
$("#calibSkip").addEventListener("click", () => begin("touch"));

/* ---------------- the step ---------------- */
let finishedAt = 0;
function tick() {
  if (phase !== "play") return;
  const motionLive = mode === "motion" && Motion.live;
  canoe.brace = keyBrace || touchBrace || (motionLive ? paddle.brace : 0);
  canoe.lean = motionLive ? paddle.lean : 0;
  ev.length = 0;
  step(canoe, river, ev);
  lostStep();
  for (const e of ev) happen(e);
}
function happen(e) {
  switch (e.k) {
    case "eddy": {
      // a gold ring and sparks from the canoe, two notes and a loon, a thump in the hand
      rings.push({ x: canoe.x, y: canoe.y, t: 0 });
      sparkle(canoe.x, canoe.y);
      toast(`Eddy ${canoe.caught.size} of ${river.targets.length}`);
      Sfx.play(sndEddy);
      buzz("thump");
      S.act("eddy");
      break;
    }
    case "rock": Sfx.play(sndRock, e.v); buzz("bump", 1); shake = Math.min(1, 0.3 + e.v * 0.2); break;
    case "bank": Sfx.play(sndBank); break;
    case "jam": Sfx.play(sndJam, e.v); buzz("bump", 0.8); shake = Math.min(1, 0.3 + e.v * 0.2); break;
    // the roll 0.4 s ahead passes 50°: a rising whoop on that side, a wobble in the hand, and the red edge
    case "tip": Sfx.play(sndTip, e.side); buzz("thrash"); tickT = 0.12; break;
    case "capsize": Sfx.play((en, t) => splashSound(en, t, 1)); buzz("jolt"); toast("Swim. Back in a few metres up."); shake = 1; S.act("swim"); break;
    case "finish": finish(); break;
  }
}

/* ---------------- sounds ---------------- */
function sndStroke(e, t, p) { hiss(e, t, { type: "bandpass", f: 900, f2: 300, sweep: 0.22, q: 0.9, dur: 0.24, peak: 0.08 + 0.08 * p, att: 0.02 }); }
function sndJ(e, t) { tone(e, t, { f: 1250, f2: 1650, dur: 0.07, peak: 0.035, wave: "triangle" }); }
function sndBrace(e, t) { hiss(e, t, { type: "lowpass", f: 950, dur: 0.12, peak: 0.2 }); tone(e, t, { f: 190, f2: 120, dur: 0.1, peak: 0.12 }); }
function sndRock(e, t, v = 1) { tone(e, t, { f: 120, f2: 70, glide: 0.1, dur: 0.16, peak: 0.25 + 0.15 * Math.min(1, v) }); hiss(e, t, { type: "lowpass", f: 1400, dur: 0.1, peak: 0.12 }); }
function sndBank(e, t) { hiss(e, t, { type: "lowpass", f: 600, dur: 0.18, peak: 0.12 }); }
// a hollow knock on wet logs
function sndJam(e, t, v = 1) { tone(e, t, { f: 210, f2: 150, glide: 0.08, dur: 0.14, peak: 0.18 + 0.1 * Math.min(1, v), wave: "triangle" }); tone(e, t + 0.05, { f: 320, f2: 240, dur: 0.08, peak: 0.08, wave: "triangle" }); }
function sndEddy(e, t) {
  tone(e, t, { f: 660, dur: 0.4, peak: 0.12, wave: "triangle", send: 0.4 });
  tone(e, t + 0.14, { f: 990, dur: 0.6, peak: 0.12, wave: "triangle", send: 0.4 });
  if (canoe.caught.size % 3 === 1) loonTremolo(e, t + 0.5, { gain: 0.12, dur: 1, send: 0.9 });
}
function sndTick(e, t) { tone(e, t, { f: 1800, dur: 0.02, peak: 0.05 }); }
function sndTip(e, t, side = 0) {
  tone(e, t, { f: 420, f2: 780, glide: 0.2, dur: 0.24, peak: 0.12, wave: "square", lp: 1600, pan: side * 0.6 });
  hiss(e, t, { type: "lowpass", f: 700, dur: 0.22, peak: 0.1, pan: side * 0.6 });
}
let tickT = 0;
const fl = {};
function sounds(dt) {
  const play = phase === "play";
  river.flow(canoe.x, canoe.y, fl);
  const V = river.V(canoe.y), calm = fl.e > 0.5 ? 0.45 : 1;
  Sfx.bed("river", "brown", "lowpass", 700, 0.7).set(play ? (0.16 + 0.13 * V) * calm : 0.05, 450 + 160 * V, 0.25);
  // the gurgle of an eddy line just ahead of the bow: the water there runs the other way
  const sp = Math.sin(canoe.psi), cp = Math.cos(canoe.psi), ahead = river.flow(canoe.x + sp * 3.8, canoe.y + cp * 3.8);
  const seam = play && canoe.swim <= 0 && fl.vx * ahead.vx + fl.vy * ahead.vy < -0.1 ? 1 : 0;
  Sfx.bed("gurgle", "pink", "bandpass", 900, 7).set(seam * 0.3, 700 + 400 * Math.random(), 0.05);
  // ticks while the capsize warning is on
  if (play && canoe.warn && canoe.swim <= 0) {
    tickT -= dt;
    if (tickT <= 0) { tickT = 0.12; Sfx.play(sndTick); }
  }
}

/* ---------------- start, calibrate, end ---------------- */
const bar = labBar();
const hud = $("#hud"), calib = $("#calib");
// Restart, in the top bar during a run (R does the same on keys)
const restart = document.createElement("button");
restart.type = "button"; restart.className = "restart"; restart.textContent = "↻ Restart"; restart.hidden = true;
bar.insertBefore(restart, bar.querySelector(".snd"));
restart.addEventListener("click", () => { if (phase === "play") begin(); });
// the run from the put-in to the finish, with a dot for each eddy worth catching
const prog = $("#prog"), progFill = prog.querySelector("i"), progMe = prog.querySelector("b");
const along = (y) => clamp((y - START) / (FINISH - START), 0, 1) * 100;
const dots = river.targets.map((q) => { const d = document.createElement("em"); d.style.left = along(q.ey).toFixed(1) + "%"; prog.append(d); return d; });
// the start card says only what you need for your device; the game shows the rest when you need it
const coarse = matchMedia("(pointer: coarse)").matches;
const card = startCard({
  title: "Up the Creek",
  pitch: `${today ? "Today's river" : "A shared river"}. Run the rapid, and catch the eddies: the calm water behind the rocks.`,
  how: coarse ? [
    "<b>Thumbs:</b> drag down on the side you want to turn to. Hold a thumb still to brace.",
    "<b>Phone:</b> tip it to a side and rock it like a paddle. Tip it hard and hold to brace.",
  ] : [
    "<b>Keys:</b> A and D turn, W paddles straight. Hold Z or C to brace.",
  ],
  button: "Paddle",
  motion: true,
  onStart: (st) => {
    if (st === "granted" && Motion.live !== false) {
      phase = "calibrate";
      calib.hidden = false;
      calibT = setTimeout(() => { if (phase === "calibrate") { toast("Rock the top of the phone away from you to stroke."); begin("motion"); } }, 9000);
    } else begin("touch");
  },
});
let shareText = "";
const endC = endCard({ onAgain: () => begin(), onShare: () => shareLink(riverUrl(), shareText) });

function begin(m) {
  if (m) mode = m;
  clearTimeout(calibT);
  calib.hidden = true;
  canoe = newCanoe(river);
  braceSide = keyBrace = touchBrace = 0;
  touches.clear();
  foam.length = 0;
  rings.length = 0;
  sparks.length = 0;
  phase = "play";
  hud.hidden = false;
  restart.hidden = false;
  hudLast = "";
  lostT = 0;
  S.play(); S.run();
  card.hide();
  endC.hide();
  cam.init = false;
  if (mode === "touch") toast(coarse ? "Drag down on a side to turn that way." : "A and D turn. W paddles straight.", 2400);
}
function finish() {
  phase = "end";
  restart.hidden = true;
  S.stop();
  const n = river.targets.length, got = canoe.caught.size, mm = Math.floor(canoe.t / 60), ss = Math.floor(canoe.t % 60);
  const time = `${mm}:${String(ss).padStart(2, "0")}`;
  S.best(got * 1000 - canoe.t, (a, b) => a > b);
  const miss = closestMiss(canoe, river);
  const ord = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "13th", "14th"];
  const name = today ? "Today's river" : `River ${seed}`;
  let line = `${name}: ${got} of ${n} eddies, ${canoe.swims} ${canoe.swims === 1 ? "swim" : "swims"}.`;
  if (miss && miss.d < 6) line += ` Missed the ${ord[miss.index] || "last"} by ${miss.d.toFixed(1)} m.`;
  shareText = `Up the Creek, ${today ? "today's river" : "river " + seed}: ${got} of ${n} eddies in ${time}.`;
  setTimeout(() => endC.show({
    title: `Down the creek in ${time}`,
    line,
    canShare: true,
    rows: [
      ["Eddies caught", `${got} of ${n}`],
      ["Swims", String(canoe.swims)],
      ["Strokes", String(canoe.strokes)],
      ["J-strokes", String(canoe.js)],
      ["Rocks hit", String(canoe.rocks)],
      ["Paddled with", mode === "motion" ? "the phone" : "thumbs and keys"],
    ],
  }), 600);
}

/* ---------------- drawing: from above, turned with the canoe ---------------- */
let W = 1, Hh = 1, DPR = 1, shake = 0, clock = 0;
fitCanvas(canvas, (w, h, r) => { W = w; Hh = h; DPR = r; });
const cam = { x: 0, y: 0, psi: 0, k: 20, init: false };
const foam = [], rings = [], sprays = [];

function view(dt) {
  const sp = Math.sin(canoe.psi), cp = Math.cos(canoe.psi);
  const tx = canoe.x + sp * 5, ty = canoe.y + cp * 5;
  const k = Hh > W ? W / 22 : Math.min(W / 42, Hh / 24);
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.psi = canoe.psi; cam.k = k; cam.init = true; }
  const e = 1 - Math.exp(-dt / 0.5);
  cam.psi += wrap(canoe.psi - cam.psi) * e;
  cam.x += (tx - cam.x) * Math.min(1, e * 3);
  cam.y += (ty - cam.y) * Math.min(1, e * 3);
  cam.k += (k - cam.k) * e;
}
// world to screen: the canoe's forward is up, its right is right
function setWorld() {
  const k = cam.k, s = Math.sin(cam.psi), c = Math.cos(cam.psi), ox = W / 2 + (shake ? (Math.random() - 0.5) * shake * 10 * DPR : 0), oy = Hh * 0.6;
  g.setTransform(k * c, -k * s, -k * s, -k * c, ox - k * (c * cam.x - s * cam.y), oy + k * (s * cam.x + c * cam.y));
}
// a point in the world on the screen, in canvas pixels (the same transform as setWorld, with no shake)
function toScreen(x, y) {
  const k = cam.k, s = Math.sin(cam.psi), c = Math.cos(cam.psi), dx = x - cam.x, dy = y - cam.y;
  return [W / 2 + k * (c * dx - s * dy), Hh * 0.6 - k * (s * dx + c * dy)];
}
// the world box the screen shows (a little generous)
function visible() {
  const s = Math.sin(cam.psi), c = Math.cos(cam.psi), k = cam.k, ox = W / 2, oy = Hh * 0.6;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [sx, sy] of [[0, 0], [W, 0], [0, Hh], [W, Hh]]) {
    const a = (sx - ox) / k, b = (oy - sy) / k;
    const x = cam.x + a * c + b * s, y = cam.y - a * s + b * c;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0: x0 - 4, x1: x1 + 4, y0: y0 - 4, y1: y1 + 4 };
}

const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function draw(alpha, dt) {
  clock += dt;
  shake = Math.max(0, shake - dt * 3);
  view(dt);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#1c2a20";
  g.fillRect(0, 0, W, Hh);
  setWorld();
  const vis = visible();
  shore(vis);
  water(vis);
  logJam(vis);
  eddies(vis);
  foamFlow(vis, dt);
  rocks(vis);
  finishLine(vis);
  effects(dt);
  boat();
  g.setTransform(1, 0, 0, 1, 0, 0);
  holdUi();
  lostUi();
  warnEdge();
  hudText();
  sounds(dt);
}

function shore(vis) {
  // trees and granite on the banks, placed by a hash of the metre, so they never swim about
  for (let y = Math.floor(vis.y0 / 3) * 3; y < vis.y1; y += 3) {
    const [L, R] = river.bank(y);
    for (const side of [-1, 1]) {
      const h1 = hash(y, side), h2 = hash(y + 0.5, side * 3);
      const x = side < 0 ? L - 1 - h1 * 7 : R + 1 + h1 * 7;
      if (h2 < 0.35) { g.fillStyle = "#6a6e67"; g.beginPath(); g.arc(x, y, 0.6 + h2 * 1.5, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = h2 < 0.7 ? "#233b27" : "#2c4a2e"; g.beginPath(); g.arc(x, y, 1.2 + h2 * 1.6, 0, Math.PI * 2); g.fill(); }
    }
  }
}
function water(vis) {
  const y0 = Math.max(JAM - 45, vis.y0), y1 = vis.y1;
  const band = (n0, n1, col) => {
    g.beginPath();
    for (let y = y0; y <= y1; y += 1) g.lineTo(river.c(y) + n0 * river.b(y), y);
    for (let y = y1; y >= y0; y -= 1) g.lineTo(river.c(y) + n1 * river.b(y), y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
  };
  band(-1.06, 1.06, "#8a7f63");        // gravel at the edge
  band(-1, 1, "#1d5563");              // the river
  band(-0.55, 0.55, "rgba(60,130,145,0.35)");   // the tongue: the fast middle
}
// the log jam above the put-in: still, dark water behind it, and logs piled across the river at y = JAM
function logJam(vis) {
  if (vis.y0 > JAM + 3 || vis.y1 < JAM - 45) return;
  const L = river.bank(JAM)[0], R = river.bank(JAM)[1];
  // the pool behind the logs: the river, darker
  g.beginPath();
  for (let y = JAM - 45; y <= JAM; y += 1) g.lineTo(river.c(y) - river.b(y), y);
  for (let y = JAM; y >= JAM - 45; y -= 1) g.lineTo(river.c(y) + river.b(y), y);
  g.closePath();
  g.fillStyle = "rgba(4,18,24,0.55)";
  g.fill();
  // two rows of logs, 3 to 7 m long, at odd angles, from bank to bank
  for (let i = 0; i < 16; i++) {
    const h1 = hash(i, 7), h2 = hash(i, 13), h3 = hash(i, 29);
    const len = 3 + 4 * h1, r = 0.22 + 0.16 * h2, x = L - 1 + ((i % 8) + h3 * 0.8) * ((R - L + 2) / 8), y = JAM - 0.5 - (i < 8 ? 0 : 1.4) - h2 * 0.6;
    g.save();
    g.translate(x, y); g.rotate((h3 - 0.5) * 0.9);
    g.fillStyle = i % 3 ? "#5d4a3a" : "#76624d";
    g.beginPath(); g.rect(-len / 2 + r, -r, len - 2 * r, 2 * r);
    g.moveTo(-len / 2 + 2 * r, 0); g.arc(-len / 2 + r, 0, r, 0, Math.PI * 2);
    g.moveTo(len / 2, 0); g.arc(len / 2 - r, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,240,215,0.14)";
    g.fillRect(-len / 2 + r, -r * 0.6, len - 2 * r, r * 0.35);
    g.fillStyle = "#b39a76";
    g.beginPath(); g.ellipse(len / 2 - r * 0.4, 0, r * 0.45, r * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // white water where the river pours out from under the logs
  g.fillStyle = "rgba(230,245,245,0.3)";
  g.fillRect(L, JAM - 0.1, R - L, 0.6);
}
function eddies(vis) {
  for (const q of river.rocks) {
    if (q.ey < vis.y0 - 10 || q.ey > vis.y1 + 10) continue;
    const target = river.targets.includes(q), got = canoe.caught.has(q.id);
    g.beginPath();
    g.ellipse(q.ex, q.ey, q.hw, q.hl, Math.atan2(-q.tx, q.ty), 0, Math.PI * 2);
    g.fillStyle = got ? "rgba(240,190,80,0.18)" : "rgba(10,40,48,0.45)";
    g.fill();
    if (target) {
      const here = canoe.eddyQ === q;
      g.setLineDash([0.5, 0.5]);
      g.lineWidth = here ? 0.2 : 0.12;
      g.strokeStyle = got ? "rgba(255,210,110,0.9)" : here ? "rgba(255,236,190,0.85)" : "rgba(220,240,240,0.35)";
      g.stroke();
      g.setLineDash([]);
    }
  }
}
// foam that rides the current: it shows where the water goes, and the seam where it turns back at an eddy line
const ff = {};
function foamFlow(vis, dt) {
  const want = 320;
  const top = Math.max(vis.y0, JAM + 0.5);
  if (top >= vis.y1) return;
  const spawn = (p) => {
    for (let i = 0; i < 8; i++) {
      p.y = top + Math.random() * (vis.y1 - top);
      p.x = river.c(p.y) + (Math.random() * 2 - 1) * river.b(p.y) * 0.96;
      river.flow(p.x, p.y, ff);
      if (!ff.rock) break;
    }
    p.life = 0; p.max = 2 + Math.random() * 3;
  };
  while (foam.length < want) { const p = {}; spawn(p); p.life = Math.random() * p.max; foam.push(p); }
  g.lineCap = "round";
  for (const p of foam) {
    river.flow(p.x, p.y, ff);
    p.x += ff.vx * dt; p.y += ff.vy * dt; p.life += dt;
    if (ff.rock || p.life > p.max || p.y < top || p.y > vis.y1 || p.x < vis.x0 || p.x > vis.x1 || Math.abs(ff.n) > 1) { spawn(p); continue; }
    const v = Math.hypot(ff.vx, ff.vy), a = clamp(0.1 + v * 0.14, 0, 0.6) * Math.min(1, p.life * 3, (p.max - p.life) * 2);
    g.strokeStyle = `rgba(235,248,250,${a})`;
    g.lineWidth = 0.09 + v * 0.03;
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - ff.vx * 0.3, p.y - ff.vy * 0.3); g.stroke();
  }
}
function rocks(vis) {
  for (const q of river.rocks) {
    if (q.y < vis.y0 - 5 || q.y > vis.y1 + 5) continue;
    // the pillow: water piling up on the upstream face
    g.beginPath();
    g.arc(q.x - q.tx * 0.25, q.y - q.ty * 0.25, q.R + 0.25 + 0.1 * q.U, 0, Math.PI * 2);
    g.fillStyle = `rgba(230,245,245,${0.18 + 0.08 * q.U})`;
    g.fill();
    g.beginPath(); g.arc(q.x + q.tx * 0.3, q.y + q.ty * 0.3, q.R * 1.02, 0, Math.PI * 2); g.fillStyle = "rgba(0,0,0,0.3)"; g.fill();
    g.beginPath(); g.arc(q.x, q.y, q.R, 0, Math.PI * 2); g.fillStyle = "#737770"; g.fill();
    g.beginPath(); g.arc(q.x - q.R * 0.25, q.y - q.R * 0.2, q.R * 0.55, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.12)"; g.fill();
  }
}
function finishLine(vis) {
  if (FINISH < vis.y0 || FINISH > vis.y1) return;
  const [L, R] = river.bank(FINISH);
  for (let x = L, i = 0; x < R; x += 0.8, i++) { g.fillStyle = i % 2 ? "#f3ecd8" : "#1b1b1b"; g.fillRect(x, FINISH - 0.3, 0.8, 0.6); }
}
function spray(side, power) {
  const sp = Math.sin(canoe.psi), cp = Math.cos(canoe.psi), rx = cp, ry = -sp;
  for (let i = 0; i < 6 + power * 6; i++) {
    const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 1.5 * power;
    sprays.push({ x: canoe.x + side * rx * 0.9 - sp * 0.3, y: canoe.y + side * ry * 0.9 - cp * 0.3, vx: Math.cos(a) * s + side * rx, vy: Math.sin(a) * s + side * ry, t: 0 });
  }
}
// gold sparks when you catch an eddy
const sparks = [];
function sparkle(x, y) {
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + Math.random() * 0.2, s = 4 + Math.random() * 5;
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.8 + Math.random() * 0.5 });
  }
}
function effects(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.t += dt;
    if (p.t > p.max) { sparks.splice(i, 1); continue; }
    const k = Math.exp(-dt * 3);
    p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    g.fillStyle = `rgba(255,214,110,${1 - p.t / p.max})`;
    g.beginPath(); g.arc(p.x, p.y, 0.22 * (1 - 0.5 * (p.t / p.max)), 0, Math.PI * 2); g.fill();
  }
  for (let i = sprays.length - 1; i >= 0; i--) {
    const p = sprays[i];
    p.t += dt;
    if (p.t > 0.5) { sprays.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    g.fillStyle = `rgba(230,248,252,${0.8 * (1 - p.t / 0.5)})`;
    g.beginPath(); g.arc(p.x, p.y, 0.07, 0, Math.PI * 2); g.fill();
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    if (r.t > 1.2) { rings.splice(i, 1); continue; }
    g.strokeStyle = `rgba(255,220,130,${1 - r.t / 1.2})`;
    g.lineWidth = 0.15;
    g.beginPath(); g.arc(r.x, r.y, 0.5 + r.t * 5, 0, Math.PI * 2); g.stroke();
  }
}

function boat() {
  const c = canoe;
  g.save();
  g.translate(c.x, c.y);
  g.rotate(-c.psi);
  if (c.swim > 0) {
    // upside down, and you beside it
    const fade = clamp(c.swim / 0.4, 0, 1);
    g.globalAlpha = fade;
    hull("#3b2a24", "#3b2a24");
    g.fillStyle = "#f0c9a0";
    g.beginPath(); g.arc(1.1, -0.4, 0.24, 0, Math.PI * 2); g.fill();
    g.restore();
    return;
  }
  // roll: the hull looks narrower, and the low side darker
  const roll = c.phi, squash = Math.cos(roll);
  g.save();
  g.scale(squash, 1);
  hull("#c8452c", "#d9b27a");
  if (Math.abs(roll) > 0.05) {
    g.fillStyle = `rgba(0,0,0,${clamp(Math.abs(roll) * 0.8, 0, 0.5)})`;
    g.beginPath(); g.ellipse(Math.sign(roll) * 0.25, 0, 0.2, 2, 0, 0, Math.PI * 2); g.fill();
  }
  // the capsize warning: the low gunwale flashes red
  if (c.warn) {
    const s = c.warn;
    g.strokeStyle = `rgba(255,70,50,${0.65 + 0.35 * Math.sin(clock * 30)})`;
    g.lineWidth = 0.16; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 2.3); g.quadraticCurveTo(s * 0.52, 1.1, s * 0.44, 0); g.quadraticCurveTo(s * 0.52, -1.1, 0, -2.3); g.stroke();
  }
  g.restore();
  // the paddler
  g.fillStyle = "#2f4f6f";
  g.beginPath(); g.ellipse(0, -0.35, 0.34, 0.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f0c9a0";
  g.beginPath(); g.arc(0, -0.35, 0.17, 0, Math.PI * 2); g.fill();
  // the paddle: a stroke sweeps the blade back, a brace lays it flat out to the side, else it rests across
  g.strokeStyle = "#d8b27c"; g.lineWidth = 0.07; g.lineCap = "round";
  const bs = c.brace;
  if (bs) {
    g.beginPath(); g.moveTo(0, -0.3); g.lineTo(bs * 1.9, -0.2); g.stroke();
    g.fillStyle = "#d8b27c"; g.beginPath(); g.ellipse(bs * 1.9, -0.2, 0.28, 0.12, 0, 0, Math.PI * 2); g.fill();
  } else if (strokeAnim && strokeAnim.t < 0.35) {
    const s = strokeAnim.side, u = strokeAnim.t / 0.35, y = strokeAnim.back ? -1 + 2 * u : 1 - 2 * u;
    g.beginPath(); g.moveTo(0, -0.3); g.lineTo(s * 0.75, y * 0.9); g.stroke();
    g.fillStyle = "#d8b27c"; g.beginPath(); g.ellipse(s * 0.75, y * 0.9, 0.1, 0.3, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.beginPath(); g.moveTo(-0.6, -0.1); g.lineTo(0.6, -0.5); g.stroke();
  }
  if (strokeAnim) strokeAnim.t += 1 / 60;
  g.restore();
}
function hull(out, inside) {
  g.fillStyle = out;
  g.beginPath();
  g.moveTo(0, 2.3);
  g.quadraticCurveTo(0.52, 1.1, 0.44, 0);
  g.quadraticCurveTo(0.52, -1.1, 0, -2.3);
  g.quadraticCurveTo(-0.52, -1.1, -0.44, 0);
  g.quadraticCurveTo(-0.52, 1.1, 0, 2.3);
  g.fill();
  g.fillStyle = inside;
  g.beginPath();
  g.moveTo(0, 2.0);
  g.quadraticCurveTo(0.4, 1.0, 0.34, 0);
  g.quadraticCurveTo(0.4, -1.0, 0, -2.0);
  g.quadraticCurveTo(-0.4, -1.0, -0.34, 0);
  g.quadraticCurveTo(-0.4, 1.0, 0, 2.0);
  g.fill();
  g.strokeStyle = "rgba(60,30,20,0.8)"; g.lineWidth = 0.05;
  for (const y of [0.9, -0.9]) { g.beginPath(); g.moveTo(-0.36, y); g.lineTo(0.36, y); g.stroke(); }
}
// In an eddy you can still catch: a ring round the canoe that fills over EDDY_HOLD while you hold the catch, with a
// rising note at each quarter. When the bow points the wrong way, an arrow shows the turn to upstream.
let holdNote = 0;
const HOLD_NOTES = [392, 440, 494, 587];
function sndHold(e, t, f) { tone(e, t, { f, dur: 0.1, peak: 0.08, wave: "triangle", send: 0.25 }); }
function holdFill() { const c = canoe; return c.eddyQ && c.inEddy === c.eddyQ ? clamp(c.eddyT / C.EDDY_HOLD, 0, 1) : 0; }
function holdUi() {
  const c = canoe;
  if (!c.eddyQ || c.swim > 0 || phase !== "play") { holdNote = 0; return; }
  const fill = holdFill(), [sx, sy] = toScreen(c.x, c.y), R = 3.1 * cam.k;
  if (!c.holding && fill < 0.01) holdNote = 0;
  if (c.holding && holdNote < Math.min(4, Math.floor(fill * 4) + 1)) Sfx.play(sndHold, HOLD_NOTES[holdNote++]);
  g.lineCap = "round";
  g.lineWidth = 5 * DPR;
  g.strokeStyle = "rgba(240,248,250,0.22)";
  g.beginPath(); g.arc(sx, sy, R, 0, Math.PI * 2); g.stroke();
  if (fill > 0) {
    g.strokeStyle = c.holding ? "#f0b848" : "rgba(240,184,72,0.5)";
    g.beginPath(); g.arc(sx, sy, R, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2); g.stroke();
  }
  let label = "";
  if (!c.eddyBow) {
    // the bow and upstream on the screen; a turn to the right is clockwise there
    const [tx, ty] = river.tan(c.y), [bx, by] = toScreen(c.x + Math.sin(c.psi), c.y + Math.cos(c.psi)), [ux, uy] = toScreen(c.x - tx, c.y - ty);
    const a0 = Math.atan2(by - sy, bx - sx), turn = wrap(Math.atan2(uy - sy, ux - sx) - a0), a1 = a0 + turn, r = R * 1.28;
    g.strokeStyle = "#ffe7a8"; g.fillStyle = "#ffe7a8"; g.lineWidth = 6 * DPR;
    g.beginPath(); g.arc(sx, sy, r, a0, a1, turn < 0); g.stroke();
    const hx = sx + r * Math.cos(a1), hy = sy + r * Math.sin(a1), d = a1 + Math.sign(turn) * Math.PI / 2, hs = 16 * DPR;
    g.beginPath();
    g.moveTo(hx + Math.cos(d) * hs, hy + Math.sin(d) * hs);
    g.lineTo(hx + Math.cos(d + 2.4) * hs * 0.8, hy + Math.sin(d + 2.4) * hs * 0.8);
    g.lineTo(hx + Math.cos(d - 2.4) * hs * 0.8, hy + Math.sin(d - 2.4) * hs * 0.8);
    g.closePath(); g.fill();
    label = "Face upstream";
  } else if (!c.eddySlow) label = "Sit still";
  if (label) {
    g.font = `800 ${Math.round(17 * DPR)}px system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "bottom";
    g.fillStyle = "#fff6dc"; g.shadowColor = "rgba(0,20,25,0.9)"; g.shadowBlur = 6 * DPR;
    g.fillText(label, sx, sy - R * 1.28 - 12 * DPR);
    g.shadowBlur = 0;
  }
}
// Lost: out of the eddies with the bow more than 90° off downstream for 0.8 s. An arrow at the edge of the screen
// points down the river.
let lostT = 0;
const lf = {};
function lostStep() {
  const c = canoe, [tx, ty] = river.tan(c.y);
  const off = Math.sin(c.psi) * tx + Math.cos(c.psi) * ty < 0;
  lostT = c.swim <= 0 && off && river.flow(c.x, c.y, lf).e < 0.3 ? lostT + H : 0;
}
function lostUi() {
  if (phase !== "play" || lostT <= 0.8) return;
  const c = canoe, [tx, ty] = river.tan(c.y);
  const [sx, sy] = toScreen(c.x, c.y), [ex, ey] = toScreen(c.x + tx, c.y + ty), a = Math.atan2(ey - sy, ex - sx);
  const ca = Math.cos(a), sa = Math.sin(a), m = 46 * DPR, top = 150 * DPR;
  // from the canoe along the arrow to the first edge of a box inside the screen
  let t = Infinity;
  if (ca > 1e-6) t = Math.min(t, (W - m - sx) / ca); else if (ca < -1e-6) t = Math.min(t, (m - sx) / ca);
  if (sa > 1e-6) t = Math.min(t, (Hh - m - sy) / sa); else if (sa < -1e-6) t = Math.min(t, (top - sy) / sa);
  if (!(t > 0)) t = 0;
  const px = sx + ca * t, py = sy + sa * t, s = (26 + 4 * Math.sin(clock * 6)) * DPR;
  g.fillStyle = "#ffe7a8"; g.shadowColor = "rgba(0,20,25,0.9)"; g.shadowBlur = 8 * DPR;
  g.beginPath();
  g.moveTo(px + ca * s, py + sa * s);
  g.lineTo(px + Math.cos(a + 2.5) * s, py + Math.sin(a + 2.5) * s);
  g.lineTo(px - ca * s * 0.35, py - sa * s * 0.35);
  g.lineTo(px + Math.cos(a - 2.5) * s, py + Math.sin(a - 2.5) * s);
  g.closePath(); g.fill();
  g.font = `800 ${Math.round(17 * DPR)}px system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff6dc";
  g.fillText("Downstream", clamp(px - ca * s * 2.6, 70 * DPR, W - 70 * DPR), clamp(py - sa * s * 2.2, top, Hh - 20 * DPR));
  g.shadowBlur = 0;
}
// While the capsize warning is on: a red edge on the side you tip toward, and "Brace" there. It grows as you tip.
function warnEdge() {
  if (!canoe.warn || canoe.swim > 0 || phase !== "play") return;
  const a = clamp(Math.abs(canoe.phi) / C.CAPSIZE, 0, 1) * 0.55 + 0.3 + 0.1 * Math.sin(clock * 30);
  const right = canoe.warn > 0, w = W * 0.25;
  const gr = g.createLinearGradient(right ? W : 0, 0, right ? W - w : w, 0);
  gr.addColorStop(0, `rgba(230,50,40,${a})`); gr.addColorStop(1, "rgba(230,50,40,0)");
  g.fillStyle = gr;
  g.fillRect(right ? W - w : 0, 0, w, Hh);
  const fs = Math.round(22 * DPR);
  g.font = `800 ${fs}px system-ui, sans-serif`;
  g.textAlign = right ? "right" : "left";
  g.textBaseline = "middle";
  g.fillStyle = "#fff3ea";
  g.shadowColor = "rgba(90,0,0,0.8)"; g.shadowBlur = 8 * DPR;
  g.fillText(right ? "Brace ▶" : "◀ Brace", right ? W - 14 * DPR : 14 * DPR, Hh * 0.6);
  g.shadowBlur = 0;
}
// the counts and the clock, and the bar from the put-in to the finish: how far you are, and each eddy as a dot
// (gold when caught, dim when passed)
let hudLast = "";
function hudText() {
  const t = canoe.t, p = along(canoe.y).toFixed(1);
  const s = `Eddies ${canoe.caught.size}/${river.targets.length}|Swims ${canoe.swims}|${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}|${p}`;
  if (s === hudLast) return;
  hudLast = s;
  const [a, b, c] = s.split("|");
  $("#hEddies").textContent = a; $("#hSwims").textContent = b; $("#hTime").textContent = c;
  progFill.style.width = p + "%";
  progMe.style.left = p + "%";
  river.targets.forEach((q, i) => {
    const got = canoe.caught.has(q.id);
    dots[i].className = got ? "got" : canoe.y > q.ey + 6 ? "gone" : "";
  });
}

startLoop({ step: tick, draw, h: H, maxSteps: 8 });

// hooks for the tests in qa/lab/
window.QA = {
  get c() { return canoe; },
  river,
  get phase() { return phase; },
  get mode() { return mode; },
  get pull() { return paddle.pull; },
  paddle,
  act: (a) => doAction(a, "qa"),
  step(n = 1) { for (let i = 0; i < n; i++) tick(); },
  // put the camera on the canoe at once (after a test moves the canoe)
  snap() { cam.init = false; },
  // the eddy you sit in, as the ring shows it: how full, and what the catch still needs
  get hold() { const c = canoe; return { id: c.eddyQ ? c.eddyQ.id : null, fill: holdFill(), bow: c.eddyBow, slow: c.eddySlow, holding: c.holding, caught: c.caught.size }; },
  // the last paddle action: {type, side, power, from}
  get lastAct() { return lastAct; },
  // the arrow to downstream is on (or comes on with the next frame)
  get lost() { return phase === "play" && lostT > 0.8; },
  seed,
  shareUrl: riverUrl,
  begin,
  finish() { canoe.swim = 0; canoe.y = FINISH + 0.1; canoe.x = river.c(canoe.y); canoe.phi = 0; canoe.dphi = 0; },
};
