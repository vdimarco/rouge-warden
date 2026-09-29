// Full Tilt: the page. The physics in physics.js runs at 120 frames a second; this file adds the game (three balls, a
// skill shot, a ball save, drop targets, top lanes you can shift with the flippers, a multiplier), the plunger,
// nudging and tilt, the drawing, sound and buzz. The celestial table rotates as a unit in landscape; physics always stays in table coordinates.
import { makeTable, BALL_R } from "./table.js";
import { makeWorld, step, setFlip, serve, launch, pullPower, nudge, tip, H } from "./physics.js";
import { startLoop, fitCanvas } from "../kit/loop.js";
import { Sfx, hiss, tone } from "../kit/sfx.js";
import { labBar, startCard, endCard, toast, onUi } from "../kit/start.js";
import { stats } from "../kit/stats.js";
import { Haptics } from "/fish/js/haptics.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#view"), g = canvas.getContext("2d");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const buzz = (fn, ...a) => { try { Haptics[fn](...a); } catch (e) { /* no buzz here */ } };
const S = stats("tilt");
const PULL_TIME = 1.2;     // seconds to a full pull with a key held
const TRAVEL = 30;         // how far the plunger moves back, in mm

/* ---------------- the game ---------------- */
let table = makeTable(), w = makeWorld(table);
let phase = "title";   // title, play, end
let game = null;
function newGame() {
  table = makeTable();
  w = makeWorld(table);
  game = {
    ball: 1, balls: 3, score: 0, mult: 1,
    save: 0, saved: false,                       // the ball save: 8 s after a launch, once a ball
    pull: 0, pulling: null,                      // null, "key", or a finger's start: { y }
    skill: 0, skillOn: false, launchT: 0,        // the skill shot lane, and whether it can still score
    danger: 0, warnings: 0, tilted: false,       // the tilt bob
    flash: {}, dropT: 0, msg: "", msgT: 0,
    n: { flips: 0, nudges: 0, skills: 0 },
  };
  serveBall();
}
function serveBall() {
  serve(w);
  game.pull = 0;
  game.skill = Math.floor(Math.random() * 3);
  game.skillOn = false;
}
const waiting = () => w.ball.lane && !w.ball.live;
function add(points, why) {
  if (game.tilted) return;
  game.score += points * game.mult;
  if (why) say(why);
}
function say(m, t = 1.6) { game.msg = m; game.msgT = t; }

const ev = [];
function frame() {
  if (phase !== "play") return;
  const b = w.ball;
  // a key held pulls the plunger back over PULL_TIME
  if (game.pulling === "key" && waiting()) game.pull = Math.min(1, game.pull + H / PULL_TIME);
  ev.length = 0;
  step(w, ev);
  for (const e of ev) happen(e);
  // a launch too soft to leave the lane rolls back onto the plunger: serve it again
  if (b.live && b.lane && b.x > 455 && b.y < table.launch.y + 4 && Math.hypot(b.vx, b.vy) < 40) { serve(w); game.pull = 0; }
  if (game.skillOn && w.t - game.launchT > 4) game.skillOn = false;
  game.danger = Math.max(0, game.danger - 0.6 * H);
  if (game.msgT > 0) game.msgT -= H;
  for (const k in game.flash) if (game.flash[k] > 0) game.flash[k] -= H;
  // the drop targets come back up 2 s after the last one falls, once the ball is clear of them
  if (game.dropT > 0 && (game.dropT -= H) <= 0) {
    if (b.x < 18 + BALL_R + 4 && b.y > 440 && b.y < 620) game.dropT = 0.1;
    else for (const d of table.drops) d.up = true;
  }
}
function happen(e) {
  switch (e.k) {
    case "bumper": add(100); game.flash["b" + e.id] = 0.12; Sfx.play(sndBumper); buzz("bump", 0.5); game.skillOn = false; break;
    case "sling": add(10); game.flash["s" + e.side] = 0.1; Sfx.play(sndSling); buzz("bump", 0.4); game.skillOn = false; break;
    case "drop": {
      add(500);
      Sfx.play(sndDrop); buzz("bump", 0.7);
      game.skillOn = false;
      if (table.drops.every((d) => !d.up)) {
        game.mult = Math.min(5, game.mult + 1);
        add(2500, "DROPS DOWN: MULTIPLIER UP");
        game.dropT = 2;
        Sfx.play(sndBig);
      }
      break;
    }
    case "lane": {
      const L = table.lanes[e.id];
      if (game.skillOn && e.id === game.skill) { add(5000, "SKILL SHOT"); game.n.skills++; Sfx.play(sndBig); buzz("jolt"); }
      game.skillOn = false;
      if (!L.lit) { L.lit = true; add(250); Sfx.play(sndLane); }
      if (table.lanes.every((l) => l.lit)) {
        for (const l of table.lanes) l.lit = false;
        game.mult = Math.min(5, game.mult + 1);
        add(1000, "LANES: MULTIPLIER UP");
        Sfx.play(sndBig);
      }
      break;
    }
    case "flipper": if (e.v > 600) Sfx.play(sndTick, 0.6); break;
    case "wall": case "post": if (e.v > 700) Sfx.play(sndTick, 0.4); break;
    case "drain": drain(); break;
  }
}
function drain() {
  if (game.save > w.t && !game.saved && !game.tilted) {
    game.saved = true;
    say("BALL SAVED");
    Sfx.play(sndSave);
    serveBall();
    return;
  }
  Sfx.play(sndDrain);
  buzz("thump");
  game.skillOn = false;
  const bonus = 1000 * game.mult;
  if (game.tilted) say("TILT"); else { game.score += bonus; say(`BONUS ${bonus.toLocaleString("en-US")}`); }
  game.tilted = false; game.warnings = 0; game.danger = 0; game.mult = 1;
  w.kickers = true;
  for (const l of table.lanes) l.lit = false;
  if (game.ball >= game.balls) return over();
  game.ball++;
  game.saved = false;
  serveBall();
}

/* ---------------- the plunger, the flippers, the nudge ---------------- */
function pullStart(how) {
  if (phase !== "play" || !waiting() || game.pulling) return false;
  game.pulling = how;
  game.pull = 0;
  Sfx.play(sndPull);
  return true;
}
function pullTo(d) { if (game && game.pulling && game.pulling !== "key") game.pull = clamp(d, 0, 1); }
function pullEnd() {
  if (!game || !game.pulling) return;
  game.pulling = null;
  const d = game.pull;
  game.pull = 0;
  if (launch(w, pullPower(d))) {
    game.save = w.t + 8;
    game.skillOn = true;
    game.launchT = w.t;
    Sfx.play(sndLaunch, d);
    buzz("thump");
    S.act("launch");
  }
}
function flip(side, on) {
  if (phase !== "play") return;
  if (game.tilted) { setFlip(w, side, false); return; }
  const f = w.flippers.find((q) => q.side === side);
  if (on && !f.held) {
    Sfx.play(sndFlip);
    buzz("tick");
    S.act("flip");
    game.n.flips++;
    // the lane change: a flip shifts the lit top lanes toward its side
    const lit = table.lanes.map((l) => l.lit);
    if (lit.some((x) => x) && !lit.every((x) => x)) table.lanes.forEach((l, i) => (l.lit = lit[(i - side + 3) % 3]));
  }
  setFlip(w, side, on);
}
// a nudge: the table jumps, so the ball moves against it. The tilt bob swings with each one; too much, and it tilts
function bump(dvx, dvy) {
  if (phase !== "play" || !w.ball.live || game.tilted) return;
  const m = Math.hypot(dvx, dvy), k = m > 450 ? 450 / m : 1;
  nudge(w, dvx * k, dvy * k);
  shake = 0.5;
  game.n.nudges++;
  buzz("thump");
  Sfx.play(sndNudge);
  game.danger += Math.min(450, m) / 450;
  if (game.danger > 1.2) {
    game.warnings++;
    game.danger = 0.5;
    if (game.warnings >= 3) {
      game.tilted = true;
      w.kickers = false;
      setFlip(w, -1, false);
      setFlip(w, 1, false);
      say("TILT", 4);
      Sfx.play(sndTilt, 0.9);
      buzz("jolt");
    } else {
      say(game.warnings === 1 ? "DANGER" : "DANGER DANGER");
      Sfx.play(sndTilt, 0.35);
    }
  }
}

/* ---------------- input ---------------- */
// fingers: each pointer is a flipper side (-1 or 1) or the plunger
const fingers = new Map();
const landscape = () => innerWidth > innerHeight;
const pullSpan = () => Math.min(220, (landscape() ? innerWidth : innerHeight) * 0.25);
canvas.addEventListener("pointerdown", (e) => {
  if (onUi(e) || phase !== "play") return;
  e.preventDefault();
  const side = landscape() ? (e.clientY < innerHeight / 2 ? -1 : 1) : (e.clientX < innerWidth / 2 ? -1 : 1);
  // while the ball waits, the right half is the plunger: slide down to pull it back
  if (side === 1 && waiting() && pullStart({ y: e.clientY, x: e.clientX, wide: landscape() })) {
    fingers.set(e.pointerId, "plunger");
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no capture */ }
    return;
  }
  fingers.set(e.pointerId, side);
  flip(side, true);
});
window.addEventListener("pointermove", (e) => {
  if (fingers.get(e.pointerId) !== "plunger" || !game.pulling || game.pulling === "key") return;
  pullTo((game.pulling.wide ? game.pulling.x - e.clientX : e.clientY - game.pulling.y) / pullSpan());
});
const lift = (e) => {
  const f = fingers.get(e.pointerId);
  if (f == null) return;
  fingers.delete(e.pointerId);
  if (f === "plunger") return pullEnd();
  if (![...fingers.values()].includes(f)) flip(f, false);
};
window.addEventListener("pointerup", lift);
window.addEventListener("pointercancel", lift);
const FLIP_KEYS = { z: -1, arrowleft: -1, shiftleft: -1, "/": 1, arrowright: 1, shiftright: 1 };
const PULL_KEYS = new Set([" ", "arrowdown", "enter"]);
const keyName = (e) => (e.code === "ShiftLeft" ? "shiftleft" : e.code === "ShiftRight" ? "shiftright" : e.key.toLowerCase());
window.addEventListener("keydown", (e) => {
  if (phase !== "play") return;
  const k = keyName(e);
  if (k in FLIP_KEYS) { e.preventDefault(); if (!e.repeat) flip(FLIP_KEYS[k], true); return; }
  if (PULL_KEYS.has(k)) { e.preventDefault(); if (!e.repeat) pullStart("key"); return; }
  if (e.repeat) return;
  if (k === "a") bump(-320, 140);
  else if (k === "l") bump(320, 140);
  else if (k === "arrowup") { e.preventDefault(); bump(0, 380); }
});
window.addEventListener("keyup", (e) => {
  const k = keyName(e);
  if (k in FLIP_KEYS) flip(FLIP_KEYS[k], false);
  if (PULL_KEYS.has(k) && game && game.pulling === "key") pullEnd();
});
// a jolt of the phone: the table jumps under the ball, so the ball moves the other way
let lastJolt = 0;
window.addEventListener("devicemotion", (e) => {
  const a = e.acceleration;
  if (!a || a.x == null || phase !== "play") return;
  const now = performance.now(), m = Math.hypot(a.x, a.y || 0);
  if (m < 6 || now - lastJolt < 250) return;
  lastJolt = now;
  bump(-60 * a.x, -60 * (a.y || 0));
});

/* ---------------- sounds ---------------- */
function sndFlip(e, t) { tone(e, t, { f: 160, f2: 85, glide: 0.05, dur: 0.07, peak: 0.25 }); hiss(e, t, { type: "bandpass", f: 500, dur: 0.05, peak: 0.12 }); }
function sndBumper(e, t) { tone(e, t, { f: 540, f2: 300, glide: 0.06, dur: 0.12, peak: 0.22 }); hiss(e, t, { type: "bandpass", f: 2200, dur: 0.05, peak: 0.1 }); }
function sndSling(e, t) { tone(e, t, { f: 1300, f2: 900, dur: 0.05, peak: 0.15 }); hiss(e, t, { type: "highpass", f: 2500, dur: 0.04, peak: 0.08 }); }
function sndDrop(e, t) { tone(e, t, { f: 320, f2: 200, dur: 0.09, peak: 0.2 }); }
function sndLane(e, t) { tone(e, t, { f: 1760, dur: 0.3, peak: 0.08, wave: "triangle", send: 0.3 }); }
function sndTick(e, t, v = 0.5) { tone(e, t, { f: 900, dur: 0.02, peak: 0.05 * v }); }
function sndPull(e, t) { hiss(e, t, { type: "bandpass", f: 700, f2: 300, dur: 0.6, peak: 0.05, att: 0.1 }); }
function sndLaunch(e, t, d = 1) { hiss(e, t, { type: "bandpass", f: 300, f2: 2200, dur: 0.25, peak: 0.08 + 0.12 * d }); tone(e, t, { f: 180, f2: 420, dur: 0.12, peak: 0.12 }); }
function sndDrain(e, t) { tone(e, t, { f: 140, f2: 55, glide: 0.5, dur: 0.6, peak: 0.25 }); }
function sndSave(e, t) { tone(e, t, { f: 880, dur: 0.15, peak: 0.1, wave: "triangle" }); tone(e, t + 0.12, { f: 1320, dur: 0.25, peak: 0.1, wave: "triangle" }); }
function sndBig(e, t) { [523, 659, 784, 1047].forEach((f, i) => tone(e, t + i * 0.08, { f, dur: 0.2, peak: 0.09, wave: "square", lp: 3000 })); }
function sndNudge(e, t) { tone(e, t, { f: 70, f2: 50, dur: 0.12, peak: 0.3 }); }
function sndTilt(e, t, len = 0.4) { tone(e, t, { f: 110, dur: len, peak: 0.12, wave: "square", lp: 1200 }); }

/* ---------------- start and end ---------------- */
const bar = labBar();
const full = document.createElement("button");
full.type = "button"; full.textContent = "Full screen";
full.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast("Use your browser’s full-screen option."); }
});
bar.insertBefore(full, bar.lastChild);
document.addEventListener("fullscreenchange", () => { full.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen"; });
for (const side of [-1, 1]) {
  const button = document.createElement("button");
  button.className = "ui flipper-control " + (side === -1 ? "left-flip" : "right-flip");
  button.textContent = side === -1 ? "FLIP · Z" : "FLIP · /";
  button.setAttribute("aria-label", side === -1 ? "Left flipper" : "Right flipper");
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault(); button.setPointerCapture(e.pointerId); fingers.set(e.pointerId, side); flip(side, true);
  });
  document.body.append(button);
}
// Release held controls on focus loss or rotation; keep the current ball and score.
function releaseControls() {
  fingers.clear();
  if (game) { game.pulling = null; game.pull = 0; }
  setFlip(w, -1, false); setFlip(w, 1, false);
}
window.addEventListener("blur", releaseControls);
window.addEventListener("resize", releaseControls);
const dmd = $("#dmd");
const card = startCard({
  title: "Full Tilt · Celestial",
  pitch: "Fire a silver comet through a clockwork star atlas. Turn your phone sideways to open the full table.",
  how: [
    "<b>Flip:</b> hold the marked flipper pads. You can also hold each screen half: left/right upright, top/bottom sideways. Keys: Z and /.",
    "<b>Launch:</b> slide down on the right half. Sideways: slide left on the bottom half. Release to fire. Keyboard: hold Space, then release.",
    "<b>Skill shot:</b> a soft launch drops the ball into a top lane. The green lane gives 5,000.",
    "<b>Nudge:</b> jolt the phone, or push A, L or ↑. Too many hard nudges tilt the table.",
    "Try a cradle: hold a flipper up and let the ball stop on it. Then let go, and flip as the ball rolls down.",
  ],
  button: "Play",
  motion: true,     // for the nudge; the game does not wait for it
  wait: false,
  onStart: () => begin(),
});
const endC = endCard({ onAgain: () => begin() });
function begin() {
  newGame();
  fingers.clear();
  phase = "play";
  dmd.hidden = false;
  document.body.classList.add("playing");
  S.play();
  S.run();
  card.hide();
  if (matchMedia("(pointer: coarse)").matches) toast(landscape() ? "Slide left on the bottom half, then release." : "Slide down on the right half, then release.", 2600);
}
function over() {
  phase = "end";
  document.body.classList.remove("playing");
  S.stop();
  const prev = S.data.best, isBest = S.best(game.score);
  setTimeout(() => endC.show({
    title: `${game.score.toLocaleString("en-US")} points`,
    line: isBest ? (prev == null ? "Your first game on this table." : "A new high score for this browser.") : `Your best here is ${prev.toLocaleString("en-US")}.`,
    rows: [["Skill shots", String(game.n.skills)], ["Flips", String(game.n.flips)], ["Nudges", String(game.n.nudges)]],
  }), 700);
}

/* ---------------- drawing ---------------- */
let W = 1, Hh = 1, DPR = 1, shake = 0, clock = 0;
fitCanvas(canvas, (w_, h, r) => { W = w_; Hh = h; DPR = r; });
const view = { s: 1, ox: 0, oy: 0, wide: false };
function layout() {
  view.wide = W > Hh;
  const top = (view.wide ? 46 : 104) * DPR, bottom = 12 * DPR;
  const width = view.wide ? 1060 : 500, height = view.wide ? 500 : 1060;
  view.s = Math.max(0.01, Math.min((W - 24 * DPR) / width, (Hh - top - bottom) / height));
  view.ox = (W - width * view.s) / 2;
  view.oy = top + (Hh - top - bottom - height * view.s) / 2;
  if (!view.wide) view.oy += height * view.s;
}
// Rigid rotation keeps the ball circular and collision geometry aligned with the art.
function world() {
  const j = shake > 0 ? (Math.random() - 0.5) * shake * 8 * DPR : 0;
  if (view.wide) g.setTransform(0, view.s, view.s, 0, view.ox + j, view.oy);
  else g.setTransform(view.s, 0, 0, -view.s, view.ox + j, view.oy);
}
// text on the table, the right way up
function label(text, x, y, size, color) {
  g.save();
  g.translate(x, y);
  if (view.wide) { g.rotate(Math.PI / 2); g.scale(1, -1); }
  else g.scale(1, -1);
  g.font = `800 ${size}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.restore();
}

function draw(alpha, dt) {
  clock += dt;
  shake = Math.max(0, shake - dt * 3);
  layout();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#040a13";
  g.fillRect(0, 0, W, Hh);
  // Stars outside the cabinet continue its atlas across the viewport.
  for (let i = 0; i < 90; i++) {
    const x = ((i * 137.508) % 997) / 997 * W, y = ((i * 71.73) % 991) / 991 * Hh;
    g.fillStyle = `rgba(145,201,212,${0.12 + 0.16 * Math.sin(i + clock * 0.4) ** 2})`;
    g.fillRect(x, y, DPR, DPR);
  }
  world();
  playfield();
  inserts();
  targets();
  walls();
  bumpers();
  flippers();
  plunger();
  ball();
  g.setTransform(1, 0, 0, 1, 0, 0);
  panel();
  rolling();
}
function outlinePath() {
  const o = table.outline;
  g.beginPath();
  g.moveTo(o[0][0], o[0][1]);
  for (const p of o) g.lineTo(p[0], p[1]);
  g.closePath();
}
function playfield() {
  outlinePath();
  const gr = g.createLinearGradient(0, 0, 500, 1040);
  gr.addColorStop(0, "#102b34"); gr.addColorStop(0.45, "#091827"); gr.addColorStop(1, "#26364a");
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  // Engraved meridians, constellations, and a large astrolabe beneath the targets.
  g.lineWidth = 0.7; g.strokeStyle = "#98c9c51c";
  for (let y = 80; y < 1060; y += 40) { g.beginPath(); g.moveTo(0,y); g.lineTo(500,y); g.stroke(); }
  for (let x = 20; x < 500; x += 40) { g.beginPath(); g.moveTo(x,40); g.lineTo(x,1040); g.stroke(); }
  for (let i = 0; i < 160; i++) {
    const x = 24 + ((i * 137.508) % 425), y = 300 + ((i * 71.731) % 710);
    g.fillStyle = i % 7 ? "#c0e8e380" : "#f2d397";
    g.beginPath(); g.arc(x,y,i % 7 ? 0.8 : 1.8,0,Math.PI*2); g.fill();
    if (i % 7 === 0) { g.strokeStyle = "#9cbbca30"; g.beginPath(); g.moveTo(x,y); g.lineTo(24+(((i+1)*137.508)%425),300+(((i+1)*71.731)%710)); g.stroke(); }
  }
  for (const r of [80, 120, 174, 183, 196]) {
    g.beginPath(); g.arc(228,660,r,0,Math.PI*2); g.strokeStyle = r > 174 ? "#d0ac6655" : "#68cfc137"; g.lineWidth = r === 183 ? 2 : 1; g.stroke();
  }
  for (let i=0;i<60;i++) {
    const a=i*Math.PI/30, r=i%5===0?173:180;
    g.beginPath(); g.moveTo(228+Math.cos(a)*r,660+Math.sin(a)*r); g.lineTo(228+Math.cos(a)*193,660+Math.sin(a)*193); g.strokeStyle="#bfa47475"; g.stroke();
  }
  // Crescent moon with a luminous rim, drawn into the atlas rather than over the ball.
  g.beginPath(); g.arc(228,868,40,0,Math.PI*2); g.fillStyle="#dfc88a"; g.fill();
  g.beginPath(); g.arc(244,878,38,0,Math.PI*2); g.fillStyle="#152938"; g.fill();
  label("C E L E S T I A L",228,425,22,"#d9c799");
  label("THE COMET ENGINE",228,392,10,"#8ebcb8");
  g.strokeStyle="#d6b97655"; g.lineWidth=1;
  g.beginPath(); g.moveTo(120,373); g.lineTo(335,373); g.stroke();
  g.restore();
  const lane = g.createLinearGradient(455,0,500,0);
  lane.addColorStop(0,"#153d45"); lane.addColorStop(.5,"#08141e"); lane.addColorStop(1,"#183f45");
  g.fillStyle=lane; g.fillRect(455,0,45,760);
  for(let y=100;y<750;y+=24) { g.fillStyle="#72dbc230"; g.fillRect(470,y,15,2); }
}
function lamp(x, y, r, on, col) {
  if (on) {
    g.beginPath();
    g.arc(x, y, r * 1.9, 0, Math.PI * 2);
    g.fillStyle = `rgba(${col},0.2)`;
    g.fill();
  }
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = on ? `rgb(${col})` : "rgba(255,255,255,0.08)";
  g.fill();
}
const blink = (hz = 2) => Math.floor(clock * hz * 2) % 2 === 0;
function inserts() {
  const amber = "255,170,60", gold = "255,215,90", green = "120,255,160", blue = "120,200,255";
  // the multiplier
  for (let i = 2; i <= 5; i++) {
    const x = 158 + (i - 2) * 46;
    lamp(x, 262, 11, game && game.mult >= i, amber);
    label(i + "X", x, 238, 13, game && game.mult >= i ? "#ffd9a0" : "rgba(255,255,255,0.25)");
  }
  // the top lanes: gold once the ball rolls through; the skill-shot lane is green until the shot is made or missed
  for (const L of table.lanes) {
    const skill = game && game.skill === L.id && (waiting() || game.skillOn);
    lamp(L.x, L.y - 16, 9, skill ? blink() : L.lit, skill ? green : gold);
  }
  // the drop targets: lit while some are down
  lamp(52, 530, 8, !!game && table.drops.some((d) => !d.up), blue);
  // shoot again, while the ball save is on
  const saveOn = game && !game.saved && (waiting() || game.save > w.t);
  lamp(227.5, 72, 8, saveOn && (waiting() || game.save - w.t > 2 || blink(3)), amber);
  label("SHOOT AGAIN", 227.5, 52, 10, saveOn ? "#ffd9a0" : "rgba(255,255,255,0.22)");
}
function targets() {
  for (const d of table.drops) {
    g.fillStyle = d.up ? "#f2c640" : "rgba(242,198,64,0.18)";
    g.fillRect(12, d.a[1], 9, d.b[1] - d.a[1]);
  }
}
function walls() {
  g.lineCap = "round";
  g.lineJoin = "round";
  // the slingshots: coloured plastic, white rubber on the kicking face
  for (const [side, pts] of [["L", [[84, 330], [84, 230], [126, 205]]], ["R", [[371, 330], [371, 230], [329, 205]]]]) {
    g.beginPath();
    g.moveTo(...pts[0]);
    g.lineTo(...pts[1]);
    g.lineTo(...pts[2]);
    g.closePath();
    g.fillStyle = game && game.flash["s" + side] > 0 ? "#ffe07a" : "#236b72";
    g.fill();
  }
  for (const s of table.walls) {
    if (s.drop) continue;
    g.beginPath();
    g.moveTo(s.a[0], s.a[1]);
    // the floor stops at the shooter lane (the ball rides back with the plunger, below it)
    g.lineTo(s.a[1] === 40 && s.b[1] === 40 ? 455 : s.b[0], s.b[1]);
    g.strokeStyle = s.kick ? "#f4f4f4" : s.oneway ? "rgba(200,200,210,0.5)" : "#b9c0cc";
    g.lineWidth = s.kick ? 7 : s.oneway ? 3 : 6;
    if (!s.oneway) { g.strokeStyle = "#071019"; g.lineWidth += 7; g.stroke(); g.lineWidth -= 7; }
    g.strokeStyle = s.kick ? "#8affdf" : s.oneway ? "#8098a080" : "#bea577";
    g.stroke();
  }
  g.beginPath();
  g.moveTo(455, 40);
  g.lineTo(455, 0);
  g.moveTo(500, 40);
  g.lineTo(500, 0);
  g.strokeStyle = "#b9c0cc";
  g.lineWidth = 6;
  g.stroke();
  for (const p of table.posts) {
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fillStyle = "#e8e8ec";
    g.fill();
  }
}
function bumpers() {
  const colors = ["#69e5ca", "#e8ad74", "#bda8ff"];
  for (const b of table.bumpers) {
    const hot = game && game.flash["b" + b.id] > 0;
    g.save(); g.translate(b.x,b.y);
    const halo=g.createRadialGradient(0,0,15,0,0,53);
    halo.addColorStop(0,colors[b.id]+"70"); halo.addColorStop(1,colors[b.id]+"00");
    g.fillStyle=halo; g.beginPath(); g.arc(0,0,53,0,Math.PI*2); g.fill();
    g.strokeStyle=colors[b.id]; g.lineWidth=1.5;
    g.beginPath(); g.ellipse(0,0,46,18,clock*.25+b.id,0,Math.PI*2); g.stroke();
    const body=g.createRadialGradient(-9,10,2,0,0,b.r);
    body.addColorStop(0,hot?"#ffffff":"#d3eee7"); body.addColorStop(.35,colors[b.id]); body.addColorStop(1,"#102c39");
    g.beginPath(); g.arc(0,0,b.r,0,Math.PI*2); g.fillStyle=body; g.fill();
    g.strokeStyle="#e6d5ab"; g.lineWidth=2; g.stroke();
    g.beginPath(); g.arc(0,0,b.r+5,-clock-b.id,-clock-b.id+Math.PI*1.35); g.strokeStyle=colors[b.id]; g.lineWidth=2; g.stroke();
    if(hot) { g.beginPath(); g.arc(0,0,b.r+10+(1-game.flash["b"+b.id]/.12)*30,0,Math.PI*2); g.strokeStyle="#d9fff0"; g.stroke(); }
    g.restore();
  }
}
function flippers() {
  for (const f of w.flippers) {
    const [tx, ty] = tip(f), a = Math.atan2(ty - f.py, tx - f.px), n = [-Math.sin(a), Math.cos(a)];
    g.beginPath();
    g.moveTo(f.px + n[0] * f.r1, f.py + n[1] * f.r1);
    g.lineTo(tx + n[0] * f.r2, ty + n[1] * f.r2);
    g.arc(tx, ty, f.r2, a + Math.PI / 2, a - Math.PI / 2, true);
    g.lineTo(f.px - n[0] * f.r1, f.py - n[1] * f.r1);
    g.arc(f.px, f.py, f.r1, a - Math.PI / 2, a + Math.PI / 2, true);
    g.closePath();
    g.fillStyle = game && game.tilted ? "#8a8a8a" : "#f7f7f7";
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "#53d4bc";
    g.stroke();
    g.beginPath();
    g.arc(f.px, f.py, 4, 0, Math.PI * 2);
    g.fillStyle = "#888";
    g.fill();
  }
}
// the plunger: a rod, a spring, a knob below the table. It moves back as you pull
function plunger() {
  const pull = game ? game.pull : 0, x = table.launch.x, head = table.launch.y - BALL_R - pull * TRAVEL;
  g.fillStyle = "#c9ced8";
  g.fillRect(x - 9, head - 7, 18, 7);
  g.fillRect(x - 3, head - 44, 6, 44);
  g.strokeStyle = "#8b93a3";
  g.lineWidth = 2.5;
  g.beginPath();
  const top = head - 8, bot = 1;
  for (let i = 0; i <= 10; i++) g.lineTo(x + (i % 2 ? 8 : -8), top - ((top - bot) * i) / 10);
  g.stroke();
  // a hint while the ball waits and nobody pulls
  if (game && waiting() && !game.pulling) {
    const k = (clock * 1.5) % 1;
    for (let i = 0; i < 3; i++) {
      const y = 330 - i * 40 - k * 40;
      g.globalAlpha = 0.18 + 0.5 * (1 - Math.abs(i - 1 + k - 0.5) / 1.5);
      g.beginPath();
      g.moveTo(x - 12, y + 10);
      g.lineTo(x, y);
      g.lineTo(x + 12, y + 10);
      g.strokeStyle = "#ffd07a";
      g.lineWidth = 4;
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}
function ball() {
  const b = w.ball;
  if (!b.live && !b.lane) return;
  // on the plunger, the ball rides back with it
  const y = waiting() && game ? b.y - game.pull * TRAVEL : b.y;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 400) {
    // a short streak behind a fast ball
    g.strokeStyle = "rgba(104,255,216,0.5)";
    g.lineWidth = BALL_R * 1.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(b.x, y);
    g.lineTo(b.x - b.vx * 0.025, y - b.vy * 0.025);
    g.stroke();
  }
  const gr = g.createRadialGradient(b.x - 4, y + 4, 1, b.x, y, BALL_R);
  gr.addColorStop(0, "#ffffff");
  gr.addColorStop(0.35, "#c9ced8");
  gr.addColorStop(1, "#5b6170");
  g.beginPath();
  g.arc(b.x, y, BALL_R, 0, Math.PI * 2);
  g.fillStyle = gr;
  g.fill();
}
let dmdLast = "";
function panel() {
  if (!game) return;
  const msg = game.msgT > 0 ? game.msg : waiting() ? (game.pulling ? `POWER ${Math.round(game.pull * 100)}` : "PULL THE PLUNGER") : game.warnings ? "CAREFUL" : "";
  const s = `BALL ${game.ball}|X${game.mult}|${game.score.toLocaleString("en-US")}|${msg}`;
  if (s !== dmdLast) {
    dmdLast = s;
    const [a, b, c, d] = s.split("|");
    $("#dBall").textContent = a;
    $("#dMult").textContent = b;
    $("#dScore").textContent = c;
    $("#dMsg").textContent = d;
  }
  if (game.tilted) {
    g.font = `900 ${64 * DPR}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = `rgba(255,60,50,${0.6 + 0.4 * Math.sin(clock * 10)})`;
    g.fillText("TILT", W / 2, Hh / 2);
  }
}
function rolling() {
  const b = w.ball, sp = b.live ? Math.hypot(b.vx, b.vy) : 0;
  Sfx.bed("roll", "brown", "lowpass", 500, 0.7).set(phase === "play" ? clamp(sp / 4000, 0, 1) * 0.3 : 0, 300 + sp * 0.12, 0.05);
}

startLoop({ step: frame, draw, h: H, maxSteps: 8 });

// hooks for the tests in qa/lab/
window.QA = {
  get view() { return { ...view, W, Hh, DPR }; },
  get w() { return w; },
  get game() { return game; },
  get phase() { return phase; },
  get table() { return table; },
  waiting, flip, bump, pullStart, pullTo, pullEnd,
  step(n = 1) { for (let i = 0; i < n; i++) frame(); },
  begin,
};
