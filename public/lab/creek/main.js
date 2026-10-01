// Up the Creek: the page. The river and the canoe step at 120 Hz (river.js, canoe.js). You paddle with the phone
// (paddle.js reads the pose from /fish/js/motion.js), with your thumbs (drag down on a side), or with keys. The view
// looks down on the river and turns with the canoe, so its right side stays on the right of the screen.
import { makeRiver, FINISH } from "./river.js";
import { newCanoe, act, step, H, C, closestMiss } from "./canoe.js";
import { createPaddle } from "./paddle.js";
import { daySeed, hashParams } from "../kit/rng.js";
import { startLoop, fitCanvas } from "../kit/loop.js";
import { Sfx, hiss, tone, splash as splashSound, loonTremolo } from "../kit/sfx.js";
import { labBar, startCard, endCard, toast, onUi } from "../kit/start.js";
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
const river = makeRiver(seed);
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

function doAction(a, from) {
  if (a.type === "brace") { if (from === "motion") braceSide = a.on ? a.side : 0; if (a.on) Sfx.play(sndBrace); return; }
  act(canoe, a);
  if (a.type === "stroke" || a.type === "back") {
    strokeAnim = { side: a.side, t: 0, back: a.type === "back", power: a.power ?? 1 };
    Sfx.play(sndStroke, a.power ?? 1);
    buzz("bump", 0.35 + 0.3 * (a.power ?? 1));
    spray(a.side, a.power ?? 1);
    S.act(a.type);
  } else if (a.type === "j") { Sfx.play(sndJ); S.act("j"); }
}

/* ---------------- thumbs: drag down on a side to stroke, hook out for a J, drag up to back-paddle, hold to brace ---------------- */
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
  if (!q.stroked && dy > 28) { q.stroked = true; doAction({ type: "stroke", side: q.side, power: clamp(v / 0.9, 0.35, 1.4) }, "touch"); }
  else if (!q.stroked && dy < -28) { q.stroked = true; doAction({ type: "back", side: q.side, power: clamp(v / 0.9, 0.35, 1.2) }, "touch"); }
  else if (q.stroked && !q.hooked && q.side * dx > 26 && dy > 20) { q.hooked = true; doAction({ type: "j", side: q.side, power: 1 }, "touch"); }
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

/* ---------------- keys ---------------- */
const held = new Set();
window.addEventListener("keydown", (e) => {
  if (phase !== "play" || e.repeat) return;
  const k = e.key.toLowerCase();
  const stroke = (side, j) => { doAction({ type: "stroke", side, power: 1 }, "key"); if (j) setTimeout(() => doAction({ type: "j", side, power: 1 }, "key"), 150); };
  if (k === "a" || k === "arrowleft") stroke(-1, false);
  else if (k === "d" || k === "arrowright") stroke(1, false);
  else if (k === "q") stroke(-1, true);
  else if (k === "e") stroke(1, true);
  else if (k === "s" || k === "arrowdown") doAction({ type: "back", side: paddle.side, power: 1 }, "key");
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
  for (const e of ev) happen(e);
}
function happen(e) {
  switch (e.k) {
    case "eddy": {
      const q = river.rocks.find((r) => r.id === e.id);
      rings.push({ x: q.ex, y: q.ey, t: 0 });
      toast(`Eddy! ${canoe.caught.size} of ${river.targets.length}`);
      Sfx.play(sndEddy);
      buzz("thump");
      S.act("eddy");
      break;
    }
    case "rock": Sfx.play(sndRock, e.v); buzz("bump", 1); shake = Math.min(1, 0.3 + e.v * 0.2); break;
    case "bank": Sfx.play(sndBank); break;
    case "tip": buzz("tick"); break;
    case "capsize": Sfx.play((en, t) => splashSound(en, t, 1)); buzz("jolt"); toast("Swim! Back to your last eddy."); shake = 1; S.act("swim"); break;
    case "finish": finish(); break;
  }
}

/* ---------------- sounds ---------------- */
function sndStroke(e, t, p) { hiss(e, t, { type: "bandpass", f: 900, f2: 300, sweep: 0.22, q: 0.9, dur: 0.24, peak: 0.08 + 0.08 * p, att: 0.02 }); }
function sndJ(e, t) { tone(e, t, { f: 1250, f2: 1650, dur: 0.07, peak: 0.035, wave: "triangle" }); }
function sndBrace(e, t) { hiss(e, t, { type: "lowpass", f: 950, dur: 0.12, peak: 0.2 }); tone(e, t, { f: 190, f2: 120, dur: 0.1, peak: 0.12 }); }
function sndRock(e, t, v = 1) { tone(e, t, { f: 120, f2: 70, glide: 0.1, dur: 0.16, peak: 0.25 + 0.15 * Math.min(1, v) }); hiss(e, t, { type: "lowpass", f: 1400, dur: 0.1, peak: 0.12 }); }
function sndBank(e, t) { hiss(e, t, { type: "lowpass", f: 600, dur: 0.18, peak: 0.12 }); }
function sndEddy(e, t) {
  tone(e, t, { f: 660, dur: 0.4, peak: 0.12, wave: "triangle", send: 0.4 });
  tone(e, t + 0.14, { f: 990, dur: 0.6, peak: 0.12, wave: "triangle", send: 0.4 });
  if (canoe.caught.size % 3 === 1) loonTremolo(e, t + 0.5, { gain: 0.12, dur: 1, send: 0.9 });
}
function sndTick(e, t) { tone(e, t, { f: 1800, dur: 0.02, peak: 0.05 }); }
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
  // ticks while you tip past 35°
  if (play && Math.abs(canoe.phi) > C.TIP_WARN && canoe.swim <= 0) {
    tickT -= dt;
    if (tickT <= 0) { tickT = 0.12; Sfx.play(sndTick); }
  }
}

/* ---------------- start, calibrate, end ---------------- */
labBar();
const hud = $("#hud"), calib = $("#calib");
const card = startCard({
  title: "Up the Creek",
  pitch: "Your phone is the paddle. Run the rapid, and catch the eddies behind the rocks: the calm water where the river turns back.",
  how: [
    "<b>Phone:</b> tip it to a side and rock its top edge to stroke on that side. Twist at the end for a J-stroke. Tip it hard and hold it still to brace.",
    "<b>Thumbs:</b> drag down on a side to stroke there, hook out at the end for a J, drag up to back-paddle, hold still to brace.",
    "<b>Keys:</b> A and D stroke, Q and E J-stroke, S back, hold Z or C to brace.",
    "A stroke on the right turns the bow left. Crossing into an eddy fast can tip you: brace as you cross.",
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
const endC = endCard({ onAgain: () => begin() });

function begin(m) {
  if (m) mode = m;
  clearTimeout(calibT);
  calib.hidden = true;
  canoe = newCanoe(river);
  braceSide = keyBrace = touchBrace = 0;
  touches.clear();
  foam.length = 0;
  rings.length = 0;
  phase = "play";
  hud.hidden = false;
  S.play(); S.run();
  card.hide();
  endC.hide();
  cam.init = false;
  if (mode === "touch" && matchMedia("(pointer: coarse)").matches) toast("Drag down on a side to paddle.", 2200);
}
function finish() {
  phase = "end";
  S.stop();
  const n = river.targets.length, got = canoe.caught.size, mm = Math.floor(canoe.t / 60), ss = Math.floor(canoe.t % 60);
  const time = `${mm}:${String(ss).padStart(2, "0")}`;
  S.best(got * 1000 - canoe.t, (a, b) => a > b);
  const miss = closestMiss(canoe, river);
  const ord = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "13th", "14th"];
  let line = `${got} of ${n} eddies, ${canoe.swims} ${canoe.swims === 1 ? "swim" : "swims"}.`;
  if (miss && miss.d < 6) line += ` Missed the ${ord[miss.index] || "last"} by ${miss.d.toFixed(1)} m.`;
  setTimeout(() => endC.show({
    title: `Down the creek in ${time}`,
    line,
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
  eddies(vis);
  foamFlow(vis, dt);
  rocks(vis);
  finishLine(vis);
  effects(dt);
  boat();
  g.setTransform(1, 0, 0, 1, 0, 0);
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
  const y0 = Math.max(-40, vis.y0), y1 = vis.y1;
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
function eddies(vis) {
  for (const q of river.rocks) {
    if (q.ey < vis.y0 - 10 || q.ey > vis.y1 + 10) continue;
    const target = river.targets.includes(q), got = canoe.caught.has(q.id);
    g.beginPath();
    g.ellipse(q.ex, q.ey, q.hw, q.hl, Math.atan2(-q.tx, q.ty), 0, Math.PI * 2);
    g.fillStyle = got ? "rgba(240,190,80,0.18)" : "rgba(10,40,48,0.45)";
    g.fill();
    if (target) {
      g.setLineDash([0.5, 0.5]);
      g.lineWidth = 0.12;
      g.strokeStyle = got ? "rgba(255,210,110,0.9)" : "rgba(220,240,240,0.35)";
      g.stroke();
      g.setLineDash([]);
    }
  }
}
// foam that rides the current: it shows where the water goes, and the seam where it turns back at an eddy line
const ff = {};
function foamFlow(vis, dt) {
  const want = 320;
  const spawn = (p) => {
    for (let i = 0; i < 8; i++) {
      p.y = vis.y0 + Math.random() * (vis.y1 - vis.y0);
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
    if (ff.rock || p.life > p.max || p.y < vis.y0 || p.y > vis.y1 || p.x < vis.x0 || p.x > vis.x1 || Math.abs(ff.n) > 1) { spawn(p); continue; }
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
function effects(dt) {
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
// a red edge on the side you are tipping toward, past 35°
function warnEdge() {
  const r = canoe.phi;
  if (Math.abs(r) < C.TIP_WARN || canoe.swim > 0 || phase !== "play") return;
  const a = clamp((Math.abs(r) - C.TIP_WARN) / (C.CAPSIZE - C.TIP_WARN), 0, 1) * 0.7 + 0.2;
  const right = r > 0, w = W * 0.25;
  const gr = g.createLinearGradient(right ? W : 0, 0, right ? W - w : w, 0);
  gr.addColorStop(0, `rgba(230,50,40,${a})`); gr.addColorStop(1, "rgba(230,50,40,0)");
  g.fillStyle = gr;
  g.fillRect(right ? W - w : 0, 0, w, Hh);
}
let hudLast = "";
function hudText() {
  const t = canoe.t, s = `Eddies ${canoe.caught.size}/${river.targets.length}|Swims ${canoe.swims}|${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  if (s === hudLast) return;
  hudLast = s;
  const [a, b, c] = s.split("|");
  $("#hEddies").textContent = a; $("#hSwims").textContent = b; $("#hTime").textContent = c;
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
  begin,
  finish() { canoe.swim = 0; canoe.y = FINISH + 0.1; canoe.x = river.c(canoe.y); canoe.phi = 0; canoe.dphi = 0; },
};
