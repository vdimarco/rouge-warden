// Take the Plunge: the page. It runs the exact sim in sim.js at 120 steps a second, draws a side view on a 2D canvas,
// and adds the feel: the dotted line ahead, slow motion on a rip, splashes, the V of loons, winter at your back, sound
// and buzz. A ghost from a link flies beside you in step with you.
import { makeWorld, newState, step, predict, distance, speed, H, T, AIR, WATER, SURFACE, LAKE } from "./sim.js";
import { encodeGhost, decodeGhost, Tape, Recorder } from "./ghost.js";
import { daySeed, cottageDay, hashParams } from "../kit/rng.js";
import { startLoop, fitCanvas } from "../kit/loop.js";
import { Sfx, hiss, tone, splash as splashSound, loonTremolo } from "../kit/sfx.js";
import { labBar, startCard, endCard, toast, shareLink, onUi } from "../kit/start.js";
import { stats } from "../kit/stats.js";
import { Haptics } from "/fish/js/haptics.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#view"), g = canvas.getContext("2d");
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (m) => Math.round(m).toLocaleString("en-CA") + " m";
const buzz = (fn, ...a) => { try { Haptics[fn](...a); } catch (e) { /* no buzz here */ } };

/* ---------------- the run ---------------- */
const P = hashParams(location.hash);
const ghostIn = P.g ? decodeGhost(P.g) : null;
const seedFromLink = P.s && /^\d+$/.test(P.s) ? Number(P.s) >>> 0 : null;
const seed = ghostIn ? ghostIn.seed : seedFromLink ?? daySeed("plunge");
const world = makeWorld(seed);
const S = stats("plunge");
let phase = "title";                // title, play, end
let run = null;
let best = S.data.best || 0;

function newRun() {
  const r = { s: newState(), rec: new Recorder(), ev: [], gs: null, tape: null, topV: 0, trail: [], t0: performance.now() };
  if (ghostIn) { r.gs = newState(); r.tape = new Tape(ghostIn.flips); }
  return r;
}
run = newRun();

/* ---------------- input: hold anywhere, or Space ---------------- */
const pointers = new Set();
let keyHeld = false;
const held = () => pointers.size > 0 || keyHeld;
canvas.addEventListener("pointerdown", (e) => {
  if (onUi(e) || phase !== "play") return;
  e.preventDefault();
  pointers.add(e.pointerId);
});
for (const t of ["pointerup", "pointercancel"]) window.addEventListener(t, (e) => pointers.delete(e.pointerId));
window.addEventListener("blur", () => { pointers.clear(); keyHeld = false; });
window.addEventListener("keydown", (e) => {
  if (e.key === " " && phase === "play") { e.preventDefault(); keyHeld = true; }
});
window.addEventListener("keyup", (e) => { if (e.key === " ") keyHeld = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

/* ---------------- the step: the sim, the ghost, and what happened ---------------- */
let slowT = 0, shake = 0, lastTuck = false;
const labels = [], parts = [];
function tick(tuck) {
  const s = run.s;
  if (!s.alive) return;
  run.rec.feed(s.tick + 1, tuck);
  if (tuck !== lastTuck && s.mode === AIR) Sfx.play(tuck ? sndTuck : sndOpen);
  lastTuck = tuck;
  run.ev.length = 0;
  step(s, world, tuck, run.ev);
  if (run.gs && run.gs.alive) step(run.gs, world, run.tape.at(run.gs.tick + 1));
  const v = speed(s);
  if (v > run.topV) run.topV = v;
  for (const e of run.ev) happen(e);
  if (!s.alive) end();
}

// a word over the loon; words that come close together stack instead of piling up
function label(text, color, big = false) {
  const row = labels.filter((l) => l.t < 0.8).length;
  labels.push({ x: run.s.x, y: run.s.y + 2, text, color, big, t: 0, row });
}
function burst(x, y, n, kind, speedK = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI - (kind === "bubble" ? -0.2 : 0), sp = (2 + Math.random() * 7) * speedK;
    parts.push({ x, y, vx: Math.cos(a) * sp * (kind === "feather" ? 0.5 : 1), vy: Math.sin(a) * sp + (kind === "spray" ? 2 : 0), life: 0.6 + Math.random() * 0.7, t: 0, kind, r: 0.08 + Math.random() * 0.14 });
  }
}
function happen(e) {
  const s = run.s;
  switch (e.k) {
    case "entry": {
      const big = e.cls === "perfect";
      label({ perfect: "PERFECT RIP", rip: "RIP", splash: "SPLASH", flop: "BELLY-FLOP" }[e.cls], { perfect: "#ffd766", rip: "#8ef08a", splash: "#e9f2f6", flop: "#ff7a5c" }[e.cls], big);
      if (e.cls === "perfect" || e.cls === "rip") {
        slowT = big ? 0.45 : 0.3;
        burst(e.x, 0, big ? 6 : 10, "spray", 0.6);
        Sfx.play(sndRip, big);
        buzz("splash", 0.3);
        S.act(e.cls);
      } else if (e.cls === "splash") {
        burst(e.x, 0, 24, "spray", 1);
        Sfx.play((en, t) => splashSound(en, t, 0.5));
        buzz("splash", 0.5);
      } else {
        burst(e.x, 0, 46, "spray", 1.4);
        shake = 0.6;
        Sfx.play(sndFlop);
        buzz("thump");
        S.act("flop");
      }
      break;
    }
    case "exit":
      if (e.cls === "burst") {
        label("BURST", "#7fe7ff");
        slowT = Math.max(slowT, 0.25);
        burst(e.x, 0, 30, "spray", 1.3);
        Sfx.play(sndBurst);
        buzz("bump", 0.7);
      } else burst(e.x, 0, 12, "spray", 0.8);
      break;
    case "skip": label("SKIP", "#e9f2f6"); burst(e.x, 0, 12, "spray", 0.8); Sfx.play(sndSkip); buzz("tick"); break;
    case "fish": label("+FISH", "#dfe8f0"); burst(e.x, e.y, 10, "glint", 0.6); Sfx.play(sndFish, e.n); buzz("tick"); S.act("fish"); break;
    case "thud": label(e.tumble ? "TUMBLE" : "THUD", "#ffb35c"); burst(s.x, s.y, 8, "feather", 1); shake = Math.max(shake, 0.35); Sfx.play(sndThud); buzz("bump", 0.9); break;
    case "scrape": if (Math.random() < 0.3) Sfx.play(sndScrape); break;
    case "surface": label("RUN!", "#e9f2f6"); break;
    case "takeoff": Sfx.play(sndOpen); break;
    case "breath": burst(s.x, s.y, 14, "bubble", 0.5); break;
    case "caught": shake = 1; Sfx.play(sndCaught); buzz("jolt"); break;
  }
}

/* ---------------- sounds, made in code ---------------- */
function sndTuck(e, t) { hiss(e, t, { type: "highpass", f: 2600, f2: 1200, dur: 0.08, peak: 0.07 }); }
function sndOpen(e, t) { hiss(e, t, { type: "lowpass", f: 700, dur: 0.14, peak: 0.16, att: 0.01 }); }
function sndRip(e, t, perfect) {
  tone(e, t, { f: 1500, f2: 520, glide: 0.07, dur: 0.09, peak: 0.16 });
  splashSound(e, t + 0.01, 0.12);
  if (perfect) loonTremolo(e, t + 0.15, { gain: 0.16, dur: 0.9, send: 0.8 });
}
function sndFlop(e, t) {
  splashSound(e, t, 1);
  tone(e, t, { f: 150, f2: 70, glide: 0.12, dur: 0.18, peak: 0.45 });
}
function sndBurst(e, t) {
  hiss(e, t, { type: "bandpass", f: 380, f2: 2600, sweep: 0.3, q: 1.4, dur: 0.38, peak: 0.28, att: 0.04 });
  for (let i = 0; i < 5; i++) tone(e, t + 0.08 + i * 0.05, { f: 1800 + Math.random() * 1600, f2: 2600, dur: 0.03, peak: 0.03 });
}
function sndSkip(e, t) { tone(e, t, { f: 900, f2: 650, dur: 0.06, peak: 0.12 }); splashSound(e, t, 0.15); }
function sndFish(e, t, n) {
  const f = 440 * [1, 1.26, 1.5, 2][(n - 1) % 4];
  tone(e, t, { f, f2: f * 1.5, glide: 0.08, dur: 0.12, peak: 0.12, wave: "triangle" });
}
function sndThud(e, t) {
  tone(e, t, { f: 95, f2: 55, glide: 0.1, dur: 0.14, peak: 0.5 });
  hiss(e, t, { type: "lowpass", f: 900, dur: 0.12, peak: 0.18 });
}
function sndScrape(e, t) { hiss(e, t, { type: "lowpass", f: 700, dur: 0.1, peak: 0.1 }); }
function sndCaught(e, t) {
  tone(e, t, { f: 70, f2: 40, glide: 0.5, dur: 0.7, peak: 0.5 });
  for (let i = 0; i < 6; i++) tone(e, t + 0.05 + i * 0.06, { f: 3000 + Math.random() * 2500, dur: 0.05, peak: 0.04 });
}
// the loops: wind with speed, the patter of a water run, the howl of winter, the warning whistle
function sounds(dt) {
  const s = run.s, v = speed(s), gap = s.x - s.wx;
  const inAir = s.mode === AIR && phase === "play";
  Sfx.bed("wind", "pink", "bandpass", 600, 0.8).set(inAir ? clamp((v - 6) / 40, 0, 1) * 0.55 : 0, 300 + v * 32);
  Sfx.bed("run", "brown", "lowpass", 500, 0.7).set(s.mode === SURFACE && phase === "play" ? 0.5 : 0, 500);
  const near = phase === "play" ? clamp(1 - gap / 90, 0, 1) : 0;
  Sfx.bed("howl", "pink", "bandpass", 420, 4).set(near * 0.65, 330 + near * 520, 0.3);
  Sfx.bed("warn", "white", "bandpass", 1800, 22).set(warnLevel * 0.22, 1400 + warnLevel * 1600, 0.04);
  Sfx.muffle(s.mode === WATER && phase === "play" ? 0.18 : 1);
}

/* ---------------- start, end, share ---------------- */
labBar();
const hud = $("#hud");
const pitch = ghostIn
  ? `Race ${ghostIn.name || "a friend"}'s ghost. It flew ${fmt(ghostIn.dist)} over these lakes.`
  : `You are a loon, and winter is coming. Fly south over today's lakes (${cottageDay()}).`;
const card = startCard({
  title: "Take the Plunge",
  pitch,
  how: [
    "<b>Hold</b> anywhere, or Space, to tuck your wings and dive. <b>Let go</b> to glide.",
    "Hit a lake <b>steep</b> for a rip: the dotted line turns green. Flat is a belly-flop.",
    "Under the water, let go to swoop up and burst out. Hold to go deep for fish.",
    "Stay ahead of winter. Every rip adds a loon to your V.",
    ...(matchMedia("(orientation: portrait) and (pointer: coarse)").matches ? ["Turn the phone sideways to see more of the lakes ahead."] : []),
  ],
  button: "Fly",
  onStart: () => begin(),
});
const endC = endCard({ onAgain: () => begin(), onShare: () => share() });

function begin() {
  run = newRun();
  pointers.clear(); keyHeld = false; lastTuck = false;
  labels.length = 0; parts.length = 0; slowT = 0; shake = 0;
  phase = "play";
  hud.hidden = false;
  S.play(); S.run();
  card.hide();
}
function end() {
  phase = "end";
  S.stop();
  const s = run.s, d = distance(s);
  const isBest = S.best(d);
  const prev = best;
  if (isBest) best = d;
  let line = isBest ? (prev > 0 ? `A new best, ${fmt(d - prev)} past your old one.` : "Your first flight south.") : `${fmt(prev - d)} short of your best.`;
  if (ghostIn) {
    const gd = run.gs ? distance(run.gs) : ghostIn.dist;
    line += d >= gd ? ` You beat ${ghostIn.name || "the"} ghost by ${fmt(d - gd)}.` : ` ${ghostIn.name || "The"} ghost flew ${fmt(gd - d)} farther.`;
    if (run.gs && !run.gs.alive && Math.abs(distance(run.gs) - ghostIn.dist) > 1) line += " (That ghost came from another browser, so it drifted.)";
  }
  const st = s.stats;
  setTimeout(() => endC.show({
    title: `Caught at ${fmt(d)}`,
    line,
    rows: [
      ["Time", (s.tick * H).toFixed(1) + " s"],
      ["Top speed", Math.round(run.topV * 3.6) + " km/h"],
      ["Perfect rips", String(st.perfect)],
      ["Rips", String(st.rip)],
      ["Belly-flops", String(st.flop)],
      ["Fish", String(st.fish)],
      ["Bursts", String(st.burst)],
      ["Biggest V", String(st.bestFlock + 1) + (st.bestFlock ? " loons" : " loon")],
    ],
    canShare: true,
  }), 700);
}
function ghostLink() {
  let name = "";
  try { name = localStorage.getItem("lab.name") || ""; } catch (e) { /* storage off */ }
  const s = run.s;
  const code = encodeGhost({ seed, flips: run.rec.flips, ticks: s.tick, dist: distance(s), name });
  return `${location.origin}${location.pathname}#g=${code}`;
}
async function share() {
  let name = "";
  try { name = localStorage.getItem("lab.name") || ""; } catch (e) { /* storage off */ }
  if (!name) {
    name = (window.prompt("Your initials for the ghost (up to 3 letters):", "") || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    try { localStorage.setItem("lab.name", name); } catch (e) { /* storage off */ }
  }
  return shareLink(ghostLink(), `I flew ${fmt(distance(run.s))} in Take the Plunge. Race my ghost.`);
}

/* ---------------- drawing ---------------- */
let W = 1, Hh = 1, DPR = 1;
fitCanvas(canvas, (w, h, r) => { W = w; Hh = h; DPR = r; });
const cam = { x: 0, y: 12, k: 8 };
let warnLevel = 0, clock = 0;

// the sky through a day, by distance flown: dawn, morning, afternoon, dusk, night, before dawn
const SKY = [
  [0.0, "#1f2d57", "#f2a46e", "#3b5f86", "#2f4a3a"],
  [0.18, "#3d7dc2", "#cfe7f2", "#3f84b5", "#3f6b43"],
  [0.4, "#3a78bb", "#f1dcae", "#3a7aa8", "#466d3f"],
  [0.55, "#402b63", "#f0875a", "#52506f", "#3b3f3a"],
  [0.72, "#050b18", "#14304a", "#0f2438", "#0f1c1a"],
  [0.9, "#0d1733", "#4a4f78", "#1c3150", "#1b2b28"],
  [1.0, "#1f2d57", "#f2a46e", "#3b5f86", "#2f4a3a"],
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SKYC = SKY.map((r) => [r[0], ...r.slice(1).map(hex)]);
const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
function palette(x) {
  const ph = (((x / 2600) + 0.08) % 1 + 1) % 1;
  let i = 0;
  while (i < SKYC.length - 2 && SKYC[i + 1][0] <= ph) i++;
  const a = SKYC[i], b = SKYC[i + 1], t = (ph - a[0]) / (b[0] - a[0]);
  const night = clamp(1 - Math.abs(ph - 0.74) / 0.14, 0, 1);
  return { top: mix(a[1], b[1], t), bottom: mix(a[2], b[2], t), water: mix(a[3], b[3], t), land: mix(a[4], b[4], t), night, ph };
}

const X = (x) => (x - cam.x) * cam.k + W / 2;
const Y = (y) => Hh / 2 - (y - cam.y) * cam.k;

// The camera keeps enough of the land ahead in view for the speed, puts the water low on the screen (the sky is where
// you fly), and never lets the loon leave the top. A tall phone shows less land ahead, so things stay big enough.
function updateCamera(dt) {
  const s = run.s, v = speed(s);
  const portrait = Hh > W;
  const minW = portrait ? 52 + v * 1.1 : 80 + v * 1.6;
  const low = Math.min(s.y, 0) - 13, high = Math.max(s.y, 0) + 16;
  const k = Math.min(W / minW, Hh / clamp(high - low, 34, 160));
  const e = 1 - Math.exp(-dt * 3);
  cam.k += (k - cam.k) * e;
  let ty = low + (Hh * 0.44) / cam.k;
  const keep = s.y - (Hh * 0.33) / cam.k;
  if (ty < keep) ty = keep;
  const tx = s.x + (W / cam.k) * 0.2;
  cam.x += (tx - cam.x) * Math.min(1, e * 3);
  cam.y += (ty - cam.y) * Math.min(1, e * 2);
}

function draw(alpha, dt) {
  clock += dt;
  if (slowT > 0) slowT -= dt;
  const s = run.s;
  updateCamera(dt);
  shake = Math.max(0, shake - dt * 2.2);
  const pal = palette(cam.x);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 14 * DPR : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 14 * DPR : 0;
  g.setTransform(1, 0, 0, 1, sx, sy);
  sky(pal);
  clouds(pal);
  farHills(pal);
  land(pal);
  fish();
  if (phase === "play" && s.mode === AIR) path();
  else warnLevel = 0;
  if (run.gs) loon(run.gs, true);
  flock();
  loon(s, false);
  particles(dt);
  winter(pal);
  texts(dt);
  if (s.mode === WATER) underwater();
  frost();
  hudText();
  sounds(dt);
}

function sky(pal) {
  const gr = g.createLinearGradient(0, 0, 0, Hh);
  gr.addColorStop(0, pal.top);
  gr.addColorStop(1, pal.bottom);
  g.fillStyle = gr;
  g.fillRect(-20, -20, W + 40, Hh + 40);
  if (pal.night > 0.02) {
    // stars and the northern lights
    g.globalAlpha = pal.night;
    g.fillStyle = "#fff";
    for (let i = 0; i < 90; i++) {
      const px = ((i * 137.5 + cam.x * cam.k * 0.02) % (W + 40) + W + 40) % (W + 40) - 20, py = ((i * 71.3) % (Hh * 0.55));
      g.fillRect(px, py, DPR * (i % 3 ? 1 : 2), DPR * (i % 3 ? 1 : 2));
    }
    for (let b = 0; b < 3; b++) {
      g.beginPath();
      const base = Hh * (0.16 + b * 0.07);
      for (let px = -20; px <= W + 20; px += 16 * DPR) {
        const u = px / W + cam.x * 0.0004;
        const yy = base + Math.sin(u * 5 + clock * 0.3 + b) * Hh * 0.04 + Math.sin(u * 13 - clock * 0.2) * Hh * 0.015;
        if (px === -20) g.moveTo(px, yy); else g.lineTo(px, yy);
      }
      g.lineWidth = Hh * 0.05;
      g.strokeStyle = b === 1 ? "rgba(170,110,255,0.18)" : "rgba(90,255,170,0.2)";
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // the sun, low in the morning and the evening
  const ph = pal.ph, sunUp = ph < 0.62 ? 1 - Math.abs(ph - 0.3) / 0.32 : 0;
  if (sunUp > 0) {
    const cx = W * (0.15 + ph * 1.2) % W, cy = Hh * (0.62 - 0.45 * sunUp);
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, Hh * 0.2);
    sg.addColorStop(0, "rgba(255,244,214,0.95)"); sg.addColorStop(0.12, "rgba(255,226,160,0.7)"); sg.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = sg;
    g.fillRect(cx - Hh * 0.2, cy - Hh * 0.2, Hh * 0.4, Hh * 0.4);
  }
}

// clouds at 30 to 120 m, drifting past a little slower than the land, so height and speed read at a glance
const frac = (v) => v - Math.floor(v);
const rnd1 = (i, k) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
function clouds(pal) {
  const p = 0.75, cx = cam.x * p, half = W / 2 / cam.k + 40;
  g.fillStyle = `rgba(255,255,255,${0.5 - 0.35 * pal.night})`;
  for (let i = Math.floor((cx - half) / 60); i <= Math.ceil((cx + half) / 60); i++) {
    const wx = i * 60 + rnd1(i, 1) * 35, wy = 30 + rnd1(i, 2) * 90, size = 6 + rnd1(i, 3) * 12;
    const sx = (wx - cx) * cam.k + W / 2, sy = Y(wy);
    if (sy < -size * cam.k || sy > Hh + size * cam.k) continue;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(sx + (k - 1.5) * size * 0.45 * cam.k, sy - (k % 2) * size * 0.2 * cam.k, size * 0.5 * cam.k, size * 0.28 * cam.k, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function farHills(pal) {
  const horizon = Y(0);
  for (const [p, h, col, a] of [[0.12, 34, pal.bottom, 0.55], [0.3, 18, pal.land, 0.75]]) {
    g.beginPath();
    g.moveTo(-20, Hh + 20);
    for (let px = -20; px <= W + 20; px += 10 * DPR) {
      const u = (px - W / 2) / (cam.k * 0.6) + cam.x * p;
      const hh = h * (0.55 + 0.25 * Math.sin(u * 0.012 + 1) + 0.15 * Math.sin(u * 0.031 + 2) + 0.05 * Math.sin(u * 0.09));
      g.lineTo(px, horizon - hh * cam.k * 0.6 * (p < 0.2 ? 0.8 : 1));
    }
    g.lineTo(W + 20, Hh + 20);
    g.closePath();
    g.globalAlpha = a;
    g.fillStyle = col;
    g.fill();
    g.globalAlpha = 1;
  }
}

function land(pal) {
  const s = run.s;
  const x0 = cam.x - W / 2 / cam.k - 4, x1 = cam.x + W / 2 / cam.k + 4;
  const stepM = Math.max(0.4, (3 * DPR) / cam.k);
  // the ground (lake beds too)
  g.beginPath();
  g.moveTo(X(x0), Hh + 40);
  for (let x = x0; x <= x1; x += stepM) g.lineTo(X(x), Y(world.ground(x)));
  g.lineTo(X(x1), Hh + 40);
  g.closePath();
  const lg = g.createLinearGradient(0, Y(18), 0, Y(-22));
  lg.addColorStop(0, pal.land); lg.addColorStop(0.55, "#3a3a34"); lg.addColorStop(1, "#1d1f1e");
  g.fillStyle = lg;
  g.fill();
  // pines on the ridges, behind the flight path
  let seg = world.find(x0);
  while (seg && seg.x0 < x1) {
    if (seg.kind !== LAKE) pines(seg, x0, x1);
    seg = world.find(seg.x1 + 0.01);
    if (seg.x0 > x1) break;
  }
  // the lakes: water from the surface down to the bed; frozen behind winter
  seg = world.find(x0);
  while (seg.x0 < x1) {
    if (seg.kind === LAKE) {
      const a = Math.max(seg.x0, x0), b = Math.min(seg.x1, x1);
      g.beginPath();
      g.moveTo(X(a), Y(0));
      g.lineTo(X(b), Y(0));
      for (let x = b; x >= a; x -= stepM) g.lineTo(X(x), Y(world.ground(x)));
      g.closePath();
      const wg = g.createLinearGradient(0, Y(0), 0, Y(-seg.depth));
      wg.addColorStop(0, pal.water); wg.addColorStop(1, "#06141c");
      g.fillStyle = wg;
      g.globalAlpha = 0.92;
      g.fill();
      g.globalAlpha = 1;
      if (s.mode === WATER) {
        // light shafts, only inside the water
        g.save();
        g.clip();
        g.globalAlpha = 0.1;
        g.fillStyle = "#bfefff";
        const top = Y(0), bot = Y(-seg.depth);
        for (let i = 0; i < 6; i++) {
          const x = ((i * 0.19 + clock * 0.03) % 1) * W;
          g.beginPath(); g.moveTo(x, top); g.lineTo(x + W * 0.04, top); g.lineTo(x + W * 0.1, bot); g.lineTo(x + W * 0.02, bot); g.closePath(); g.fill();
        }
        g.restore();
      }
      // the surface, with a glint
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(X(a), Y(0) - DPR, X(b) - X(a), 2 * DPR);
      // ice behind the wall
      const ice = Math.min(b, s.wx);
      if (ice > a) {
        g.fillStyle = "rgba(228,242,250,0.93)";
        g.fillRect(X(a), Y(0) - 2 * DPR, X(ice) - X(a), Math.max(3 * DPR, 0.7 * cam.k));
      }
    }
    seg = world.find(seg.x1 + 0.01);
  }
}

function pines(seg, x0, x1) {
  g.fillStyle = "rgba(14,34,26,0.85)";
  for (let x = Math.ceil(seg.x0 / 6) * 6; x < seg.x1; x += 6) {
    if (x < x0 - 6 || x > x1 + 6) continue;
    const r = Math.abs(Math.sin(x * 12.9898 + world.seed) * 43758.5453) % 1;
    if (r < 0.35) continue;
    const gy = world.ground(x);
    if (gy < 1.5) continue;
    const hh = 3.5 + r * 5, w = hh * 0.32;
    g.beginPath();
    g.moveTo(X(x - w), Y(gy - 0.3));
    g.lineTo(X(x), Y(gy + hh));
    g.lineTo(X(x + w), Y(gy - 0.3));
    g.closePath();
    g.fill();
  }
}

function fish() {
  const x0 = cam.x - W / 2 / cam.k - 4, x1 = cam.x + W / 2 / cam.k + 4;
  let seg = world.find(x0);
  while (seg.x0 < x1) {
    if (seg.kind === LAKE) for (const f of seg.fish) {
      if (run.s.taken.has(f.id)) continue;
      for (let i = 0; i < f.n; i++) {
        const a = clock * 1.4 + (i / f.n) * Math.PI * 2, rr = 0.9 + 0.3 * Math.sin(i * 1.7);
        const fx = f.x + Math.cos(a) * rr * 1.2, fy = f.y + Math.sin(a) * rr * 0.6;
        g.save();
        g.translate(X(fx), Y(fy));
        g.rotate(-a - Math.PI / 2);
        g.fillStyle = i % 3 ? "rgba(214,226,232,0.85)" : "rgba(255,238,170,0.9)";
        g.beginPath();
        g.ellipse(0, 0, Math.max(0.35 * cam.k, 3 * DPR), Math.max(0.12 * cam.k, 1.2 * DPR), 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    seg = world.find(seg.x1 + 0.01);
  }
}

// the dotted line: where you go if you keep doing what you are doing, colored by how you will hit the water
function path() {
  const s = run.s, tuck = held();
  const p = predict(s, world, tuck, 240, 5);
  const col = { perfect: "#ffd766", rip: "#8ef08a", splash: "#ffe38a", flop: "#ff7a5c", skip: "#e9f2f6", thud: "#ffb35c" }[p.end] || "rgba(255,255,255,0.5)";
  g.fillStyle = col;
  for (let i = 0; i < p.pts.length; i += 2) {
    const r = (i / p.pts.length < 0.5 ? 2.2 : 1.6) * DPR;
    g.globalAlpha = 0.85 - (i / p.pts.length) * 0.5;
    g.beginPath(); g.arc(X(p.pts[i]), Y(p.pts[i + 1]), r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // the whistle: tucked and heading for a flat entry soon
  const n = p.pts.length / 2;
  warnLevel = tuck && (p.end === "flop" || p.end === "splash") && n < 30 ? 1 - n / 30 : 0;
}

function loon(s, ghost) {
  const v = speed(s), L = Math.max(1.6 * cam.k, (Hh > W ? 38 : 30) * DPR) * (ghost ? 0.95 : 1);
  const a = Math.atan2(s.vy, s.vx);
  const x = X(s.x), y = Y(s.y);
  g.save();
  g.translate(x, y);
  g.rotate(-a);
  if (ghost) g.globalAlpha = 0.45;
  const tucked = s.tuck && s.mode !== SURFACE;
  // the far wing
  if (!tucked) {
    const flap = s.mode === SURFACE ? Math.sin(clock * 22) : v < T.V_FLAP ? Math.sin(clock * 14) * 0.8 : Math.sin(clock * 3) * 0.15;
    g.fillStyle = ghost ? "#8fb7d8" : "#15181b";
    g.beginPath();
    g.moveTo(L * 0.12, -L * 0.06);
    g.quadraticCurveTo(-L * 0.05, -L * (0.55 + 0.35 * flap), -L * 0.42, -L * (0.42 + 0.3 * flap));
    g.quadraticCurveTo(-L * 0.18, -L * 0.1, -L * 0.28, -L * 0.02);
    g.closePath();
    g.fill();
  }
  // the body, the white belly, the head and its red eye
  g.fillStyle = ghost ? "#9cc4e4" : "#121417";
  g.beginPath(); g.ellipse(0, 0, L * 0.5, L * 0.16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = ghost ? "#dbeaf5" : "#ecebe3";
  g.beginPath(); g.ellipse(-L * 0.02, L * 0.07, L * 0.36, L * 0.07, 0, 0, Math.PI * 2); g.fill();
  if (!ghost) {
    g.fillStyle = "#e8e8e0";
    for (let i = 0; i < 6; i++) g.fillRect(-L * 0.28 + i * L * 0.08, -L * 0.07 + (i % 2) * L * 0.03, L * 0.025, L * 0.025);
  }
  g.fillStyle = ghost ? "#9cc4e4" : "#0e1012";
  g.beginPath(); g.arc(L * 0.5, -L * 0.03, L * 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2a2d31";
  g.beginPath(); g.moveTo(L * 0.6, -L * 0.05); g.lineTo(L * 0.82, -L * 0.01); g.lineTo(L * 0.6, L * 0.02); g.closePath(); g.fill();
  if (!ghost) {
    g.fillStyle = "#d11f1f"; g.beginPath(); g.arc(L * 0.54, -L * 0.06, L * 0.028, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#e8e8e0"; g.lineWidth = L * 0.018;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(L * (0.36 + i * 0.025), -L * 0.12); g.lineTo(L * (0.36 + i * 0.025), -L * 0.04); g.stroke(); }
  }
  // tucked: the wing folds along the back
  if (tucked) {
    g.fillStyle = ghost ? "#7ea6c8" : "#1c2024";
    g.beginPath(); g.ellipse(-L * 0.08, -L * 0.07, L * 0.36, L * 0.06, 0.06, 0, Math.PI * 2); g.fill();
  }
  // the feet trail behind
  g.strokeStyle = ghost ? "#8fb7d8" : "#222";
  g.lineWidth = L * 0.03;
  g.beginPath(); g.moveTo(-L * 0.46, L * 0.04); g.lineTo(-L * 0.62, L * 0.06); g.stroke();
  g.restore();
  if (ghost && ghostIn && ghostIn.name) {
    g.fillStyle = "rgba(200,225,245,0.8)";
    g.font = `700 ${12 * DPR}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.fillText(ghostIn.name, x, y - L * 0.7);
  }
}

// the V: loons you earned follow your path, a little behind and to the side
function flock() {
  const s = run.s, tr = run.trail;
  tr.push(s.x, s.y, s.vx, s.vy);
  if (tr.length > 4 * 400) tr.splice(0, 4);
  const n = s.flock;
  for (let i = 0; i < n; i++) {
    const lag = 10 + i * 7, j = tr.length - 4 * (lag + 1);
    if (j < 0) break;
    const side = i % 2 ? 1 : -1, off = (1 + Math.floor(i / 2)) * 0.9 * side;
    const f = { x: tr[j] - 0.3 * (i + 1), y: tr[j + 1] + off, vx: tr[j + 2], vy: tr[j + 3], tuck: false, mode: AIR };
    // a smaller loon, drawn in place
    g.save();
    g.translate(X(f.x), Y(f.y));
    g.scale(0.7, 0.7);
    g.translate(-X(f.x), -Y(f.y));
    g.globalAlpha = 0.85;
    loon(f, false);
    g.restore();
  }
}

function particles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t > p.life) { parts.splice(i, 1); continue; }
    if (p.kind === "bubble") { p.vy += 6 * dt; p.vx *= 0.96; }
    else if (p.kind === "feather") { p.vy -= 2 * dt; p.vx *= 0.97; }
    else if (p.kind === "snow") { p.vy -= 0.5 * dt; }
    else p.vy -= 9.8 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.t / p.life;
    g.globalAlpha = a;
    g.fillStyle = p.kind === "feather" ? "#e8e4dc" : p.kind === "glint" ? "#fff3c0" : p.kind === "snow" ? "#fff" : "#dff3ff";
    g.beginPath();
    g.arc(X(p.x), Y(p.y), Math.max(p.r * cam.k, 1.5 * DPR), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function winter() {
  const s = run.s, wx = X(s.wx);
  if (wx > -W) {
    const gr = g.createLinearGradient(wx - 60 * cam.k, 0, wx + 10 * cam.k, 0);
    gr.addColorStop(0, "rgba(240,248,255,0.97)");
    gr.addColorStop(0.75, "rgba(226,240,250,0.8)");
    gr.addColorStop(1, "rgba(226,240,250,0)");
    g.fillStyle = gr;
    g.fillRect(-20, -20, wx + 10 * cam.k + 20, Hh + 40);
    // blowing snow at the front of the wall
    if (phase === "play" && parts.length < 400) for (let i = 0; i < 3; i++) parts.push({ x: s.wx - Math.random() * 12, y: cam.y + (Math.random() - 0.5) * (Hh / cam.k), vx: 8 + Math.random() * 12, vy: Math.random() * 2 - 1, life: 1 + Math.random(), t: 0, kind: "snow", r: 0.08 + Math.random() * 0.1 });
  }
}

// under the water: a blue cast over everything, and a trail of bubbles (the shafts of light are drawn in the lake)
function underwater() {
  g.fillStyle = "rgba(10,60,90,0.14)";
  g.fillRect(-20, -20, W + 40, Hh + 40);
  if (Math.random() < 0.3) parts.push({ x: run.s.x - 0.5, y: run.s.y, vx: -1 + Math.random() * 2, vy: 1, life: 1, t: 0, kind: "bubble", r: 0.05 + Math.random() * 0.08 });
}

// frost creeps in from the left when winter is close
function frost() {
  if (phase !== "play") return;
  const gap = run.s.x - run.s.wx;
  if (gap > 15) return;
  const a = clamp(1 - gap / 15, 0, 1) * 0.85;
  const gr = g.createLinearGradient(0, 0, W * 0.45, 0);
  gr.addColorStop(0, `rgba(235,246,255,${a})`); gr.addColorStop(1, "rgba(235,246,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W * 0.45, Hh);
}

function texts(dt) {
  g.textAlign = "center";
  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i];
    l.t += dt;
    if (l.t > 1.1) { labels.splice(i, 1); continue; }
    const a = l.t < 0.1 ? l.t / 0.1 : 1 - (l.t - 0.1);
    g.globalAlpha = clamp(a, 0, 1);
    g.font = `800 ${(l.big ? 26 : 19) * DPR}px system-ui, sans-serif`;
    g.lineWidth = 4 * DPR;
    g.strokeStyle = "rgba(0,0,0,0.45)";
    const x = X(l.x), y = Y(l.y) - (30 + l.t * 40 + l.row * 26) * DPR;
    g.strokeText(l.text, x, y);
    g.fillStyle = l.color;
    g.fillText(l.text, x, y);
  }
  g.globalAlpha = 1;
}

let hudLast = "";
function hudText() {
  const s = run.s;
  const t = `${fmt(distance(s))}|Best ${fmt(best)}|V ${s.flock + 1}`;
  if (t === hudLast) return;
  hudLast = t;
  const [a, b, c] = t.split("|");
  $("#hDist").textContent = a; $("#hBest").textContent = b; $("#hFlock").textContent = c;
}

/* ---------------- go ---------------- */
startLoop({ step: () => { if (phase === "play") tick(held()); }, draw, h: H, maxSteps: 8, scale: () => (slowT > 0 ? 0.35 : 1) });

// hooks for the tests in qa/lab/
window.QA = {
  get s() { return run.s; },
  get gs() { return run.gs; },
  get phase() { return phase; },
  get seed() { return seed; },
  get held() { return held(); },
  world,
  step(n = 1, tuck = false) { for (let i = 0; i < n && run.s.alive; i++) tick(tuck); },
  begin,
  ghostLink,
};
