// Primordia browser shell: input, rendering, effects, menus and saved progress.
// Game rules live in core.js; the Lenia dish lives in lenia.js.

import { Game, MUTATIONS, SPECIES, PREY_NAME, EPOCH_LENGTH, wrap, wdelta } from "./core.js";
import { FieldRenderer, FlatRenderer } from "./render.js";
import { Sound } from "./audio.js";

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const roman = (n) => ROMAN[n] || String(n);
const fmt = (n) => Math.round(n).toLocaleString("en-US");

// ---------- setup ----------
const fieldCanvas = $("#field"), fxCanvas = $("#fx");
let renderer = new FieldRenderer(fieldCanvas);
if (!renderer.ok) { renderer = new FlatRenderer(fieldCanvas); $("#nogl").hidden = false; }
const fx = fxCanvas.getContext("2d");
const sound = new Sound();
sound.on = store.get("primordia.sound", true);

const ui = {
  hud: $("#hud"), lightBar: $("#lightBar"), frenzyBar: $("#frenzyBar"), frenzyMeter: $("#frenzyMeter"), epochLabel: $("#epochLabel"), epochBar: $("#epochBar"),
  score: $("#score"), combo: $("#combo"), banner: $("#banner"), tip: $("#tip"), touch: $("#touch"), stick: $("#stick"),
  title: $("#titleScreen"), mutate: $("#mutateScreen"), pause: $("#pauseScreen"), over: $("#overScreen"), cards: $("#cards"),
};

const view = { w: innerWidth, h: innerHeight, dpr: 1 };
let rect = { x: 0, y: 0, w: 1, h: 1, s: 1 };
let game = null;
let screen = "title"; // title | play | mutate | pause | over
const best = { score: store.get("primordia.best", 0), species: new Set(store.get("primordia.species", [PREY_NAME])) };
const tips = store.get("primordia.tips", {});

function dishSize() { return innerHeight > innerWidth * 1.15 ? [128, 256] : [256, 128]; }

function newGame(mode) {
  const [w, h] = dishSize();
  if (!game || game.w !== w || game.h !== h) game = new Game(w, h);
  game.rand = Math.random;
  game.reset(mode);
  particles.length = 0; popups.length = 0; trail.length = 0;
  renderer.upload(game.world, "reset");
  layout();
}

function layout() {
  view.w = innerWidth; view.h = innerHeight;
  view.dpr = Math.min(devicePixelRatio || 1, 2);
  const glDpr = Math.min(devicePixelRatio || 1, 1.5);
  fieldCanvas.width = Math.round(view.w * glDpr); fieldCanvas.height = Math.round(view.h * glDpr);
  fxCanvas.width = Math.round(view.w * view.dpr); fxCanvas.height = Math.round(view.h * view.dpr);
  if (!game) return;
  const top = screen === "title" ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-h")) || 52;
  const pad = screen === "title" ? 0 : 8;
  const aw = view.w - pad * 2, ah = view.h - top - pad * 2;
  // the title screen fills the window; play fits the whole dish
  const s = screen === "title" ? Math.max(view.w / game.w, view.h / game.h) : Math.min(aw / game.w, ah / game.h);
  const w = game.w * s, h = game.h * s;
  rect = { x: (view.w - w) / 2, y: screen === "title" ? (view.h - h) / 2 : top + pad + (ah - h) / 2, w, h, s };
}
addEventListener("resize", () => {
  const [w, h] = dishSize();
  if (screen === "title" && game && (game.w !== w || game.h !== h)) newGame("demo");
  layout();
});

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, my: 0, target: null, dash: false, frenzy: false };
let pointer = { x: 0, y: 0, active: false, lastMove: 0 };
let touchMode = false;
const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
let padPrev = {};

addEventListener("keydown", (e) => {
  if (e.repeat && ["Space", "ShiftLeft", "ShiftRight", "KeyX", "KeyZ"].includes(e.code)) { e.preventDefault(); return; }
  keys.add(e.code);
  sound.init();
  const k = e.code;
  if (screen === "title" && ["Enter", "Digit1", "Numpad1", "Space"].includes(k)) { e.preventDefault(); startRun(); return; }
  if (screen === "over" && ["Enter", "Digit1", "Numpad1"].includes(k)) { e.preventDefault(); startRun(); return; }
  if (screen === "mutate") {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[k];
    if (n !== undefined) { pickCard(n); return; }
    if (k === "ArrowLeft" || k === "ArrowUp") moveCard(-1);
    if (k === "ArrowRight" || k === "ArrowDown") moveCard(1);
    if (k === "Enter" || k === "Space") { e.preventDefault(); pickCard(cardSel); }
    return;
  }
  if (screen === "play") {
    if (k === "Space" || k === "KeyZ" || k === "KeyJ") { e.preventDefault(); input.dash = true; }
    if (k === "ShiftLeft" || k === "ShiftRight" || k === "KeyX" || k === "KeyK" || k === "KeyF") input.frenzy = true;
    if (k === "Escape" || k === "KeyP") setPause(true);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(k)) { pointer.active = false; e.preventDefault(); }
  } else if (screen === "pause" && (k === "Escape" || k === "KeyP")) setPause(false);
  if (k === "KeyM") toggleSound();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => { keys.clear(); if (screen === "play") setPause(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden && screen === "play") setPause(true); });

const toDish = (cx, cy) => ({ x: (cx - rect.x) / rect.s, y: (cy - rect.y) / rect.s });

fxCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !touchMode) setTouchMode(true); }, true);
fxCanvas.addEventListener("pointerdown", (e) => {
  sound.init();
  if (e.pointerType === "touch") {
    setTouchMode(true);
    if (screen !== "play") return;
    if (stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0; ui.stick.style.left = e.clientX + "px"; ui.stick.style.top = e.clientY + "px"; ui.stick.classList.add("on"); }
    return;
  }
  if (screen !== "play") return;
  pointer.active = true; pointer.x = e.clientX; pointer.y = e.clientY;
  if (e.button === 2) input.frenzy = true; else input.dash = true;
});
addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") {
    if (e.pointerId === stick.id) {
      const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy), max = 46;
      const k = l > max ? max / l : 1;
      stick.dx = (dx * k) / max; stick.dy = (dy * k) / max;
      ui.stick.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    }
    return;
  }
  if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 3) pointer.active = true;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
const endStick = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; ui.stick.classList.remove("on"); ui.stick.firstElementChild.style.transform = ""; } };
addEventListener("pointerup", endStick);
addEventListener("pointercancel", endStick);
$("#dashBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); sound.init(); input.dash = true; });
$("#frenzyBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); sound.init(); input.frenzy = true; });

function setTouchMode(on) {
  touchMode = on;
  ui.touch.hidden = !(on && screen === "play");
  if (on) { pointer.active = false; showTipOnce("touch", "Drag anywhere to swim. Tap <kbd>DASH</kbd> to burst away."); }
}

function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = [...pads].find((g) => g && g.connected);
  if (!p) return null;
  const pressed = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  const edge = (i) => { const now = pressed(i), was = padPrev[i]; padPrev[i] = now; return now && !was; };
  const st = { x: p.axes[0] || 0, y: p.axes[1] || 0 };
  if (pressed(14)) st.x = -1; if (pressed(15)) st.x = 1; if (pressed(12)) st.y = -1; if (pressed(13)) st.y = 1;
  const a = edge(0), b = edge(1) || edge(2) || edge(5), start = edge(9);
  const left = edge(14) || edge(4), right = edge(15) || edge(5);
  if (screen === "title" || screen === "over") { if (a || start) startRun(); return null; }
  if (screen === "mutate") { if (left) moveCard(-1); if (right) moveCard(1); if (a) pickCard(cardSel); return null; }
  if (screen === "pause") { if (start || a) setPause(false); return null; }
  if (start) { setPause(true); return null; }
  if (a) input.dash = true;
  if (b) input.frenzy = true;
  if (Math.hypot(st.x, st.y) > 0.18) { pointer.active = false; return st; }
  return null;
}

function readInput() {
  const pad = pollPad();
  let mx = 0, my = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) mx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) mx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) my -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) my += 1;
  if (pad) { mx = pad.x; my = pad.y; }
  if (stick.id !== null) { mx = stick.dx; my = stick.dy; }
  input.mx = mx; input.my = my;
  input.target = pointer.active && !touchMode && !mx && !my ? toDish(pointer.x, pointer.y) : null;
}

// ---------- screens ----------
function show(name) {
  screen = name;
  ui.title.hidden = name !== "title";
  ui.mutate.hidden = name !== "mutate";
  ui.pause.hidden = name !== "pause";
  ui.over.hidden = name !== "over";
  ui.hud.hidden = name === "title";
  ui.touch.hidden = !(touchMode && name === "play");
  document.body.classList.toggle("playing", name === "play" && !touchMode);
  layout();
}

function startRun() {
  sound.init();
  sound.pick();
  newGame("play");
  show("play");
  hudCache = {};
  banner("EPOCH I", "Eat the glowing life", "#9ffff1");
  showTipOnce("eat", touchMode ? "Swim into the glowing cyan creatures to eat them." : "Swim into the glowing cyan creatures to eat them. Your mouse leads the way.");
}

function setPause(on) {
  if (on && screen !== "play") return;
  if (!on && screen !== "pause") return;
  show(on ? "pause" : "play");
  if (on) $("#resumeBtn").focus();
}
$("#playBtn").onclick = startRun;
$("#againBtn").onclick = startRun;
$("#resumeBtn").onclick = () => setPause(false);
$("#restartBtn").onclick = startRun;
$("#quitBtn").onclick = toTitle;
$("#titleBtn").onclick = toTitle;
$("#pauseBtn").onclick = () => (screen === "play" ? setPause(true) : setPause(false));
$("#soundBtn").onclick = toggleSound;
function toggleSound() {
  sound.init();
  sound.setOn(!sound.on);
  store.set("primordia.sound", sound.on);
  $("#soundBtn").setAttribute("aria-pressed", String(sound.on));
  $("#soundBtn").setAttribute("aria-label", sound.on ? "Sound on" : "Sound off");
}
$("#soundBtn").setAttribute("aria-pressed", String(sound.on));

function toTitle() {
  newGame("demo");
  show("title");
  drawTitle();
  $("#playBtn").focus();
}

function drawTitle() {
  if (touchMode) {
    $(".keys").innerHTML = "<div><dt>Swim</dt><dd>Drag anywhere</dd></div><div><dt>Dash</dt><dd>DASH button</dd></div><div><dt>Frenzy</dt><dd>FRENZY button, when it glows</dd></div>";
    $("#playBtn").innerHTML = "PLAY";
  }
  $("#bestLine").textContent = best.score > 0 ? "BEST " + fmt(best.score) : "";
  const all = [PREY_NAME, ...SPECIES.map((s) => s.name)];
  $("#bestiary").innerHTML = all.map((n, i) => best.species.has(n)
    ? `<span class="${i ? "hunter" : "prey"}">${n}</span>`
    : `<span class="unknown">? ? ?</span>`).join("");
}

// mutation cards
const ICONS = {
  maw: '<circle cx="22" cy="22" r="15" fill="none" stroke="#3ff0e0" stroke-width="3"/><path d="M22 22 L38 12 L38 32 Z" fill="#04030a"/>',
  flagella: '<circle cx="14" cy="22" r="8" fill="#3ff0e0"/><path d="M22 22 q5 -8 10 0 t10 0" fill="none" stroke="#9ffff1" stroke-width="3"/>',
  chloro: '<ellipse cx="22" cy="22" rx="15" ry="10" fill="none" stroke="#7dffa0" stroke-width="3"/><circle cx="16" cy="22" r="3" fill="#7dffa0"/><circle cx="24" cy="20" r="3" fill="#7dffa0"/><circle cx="30" cy="24" r="3" fill="#7dffa0"/>',
  membrane: '<circle cx="22" cy="22" r="10" fill="#3ff0e0"/><circle cx="22" cy="22" r="17" fill="none" stroke="#c6fff4" stroke-width="4" stroke-dasharray="4 3"/>',
  vacuole: '<circle cx="28" cy="22" r="9" fill="#3ff0e0"/><path d="M4 16 h12 M2 22 h14 M4 28 h12" stroke="#9ffff1" stroke-width="3" stroke-linecap="round"/>',
  gorge: '<circle cx="22" cy="22" r="15" fill="#ffc94a"/><path d="M22 22 L38 14 L38 30 Z" fill="#04030a"/>',
  spores: '<circle cx="15" cy="22" r="9" fill="#3ff0e0"/><circle cx="31" cy="15" r="5" fill="#3ff0e0" opacity=".7"/><circle cx="33" cy="30" r="4" fill="#3ff0e0" opacity=".5"/>',
  symbiont: '<circle cx="22" cy="22" r="8" fill="#3ff0e0"/><circle cx="22" cy="22" r="16" fill="none" stroke="#3ff0e0" stroke-opacity=".35" stroke-width="2"/><circle cx="36" cy="18" r="4" fill="#c6fff4"/>',
  barbed: '<path d="M4 22 L30 22" stroke="#9ffff1" stroke-width="3"/><path d="M30 12 L40 22 L30 32 Z" fill="#ff2f74"/><path d="M12 16 l4 6 l-4 6 M20 16 l4 6 l-4 6" stroke="#ff8fb2" stroke-width="2" fill="none"/>',
  heart: '<path d="M22 37 C6 26 6 12 15 10 C19 9 22 13 22 15 C22 13 25 9 29 10 C38 12 38 26 22 37 Z" fill="#ff8fb2"/>',
  echo: '<circle cx="22" cy="22" r="6" fill="#ffc94a"/><circle cx="22" cy="22" r="12" fill="none" stroke="#ffc94a" stroke-opacity=".6" stroke-width="2"/><circle cx="22" cy="22" r="18" fill="none" stroke="#ffc94a" stroke-opacity=".3" stroke-width="2"/>',
};
let cardSel = 0;
function showCards() {
  const offer = game.offer || [];
  $("#mutateKicker").textContent = "EPOCH " + roman(game.epoch) + " SURVIVED";
  ui.cards.innerHTML = offer.map((m, i) => {
    const lvl = game.mut[m.id], max = MUTATIONS.find((x) => x.id === m.id).max;
    return `<button class="card" type="button" data-i="${i}"><span class="k">${i + 1}</span><svg viewBox="0 0 44 44" aria-hidden="true">${ICONS[m.id] || ""}</svg><b>${m.name}</b><p>${m.text}</p><span class="lvl">${"●".repeat(lvl + 1)}${"○".repeat(Math.max(0, max - lvl - 1))}</span></button>`;
  }).join("");
  ui.cards.querySelectorAll(".card").forEach((c) => {
    c.onclick = () => pickCard(+c.dataset.i);
    c.onmouseenter = () => { cardSel = +c.dataset.i; markCard(); };
  });
  cardSel = 0;
  markCard();
}
function markCard() { ui.cards.querySelectorAll(".card").forEach((c, i) => c.classList.toggle("sel", i === cardSel)); }
function moveCard(d) { const n = (game.offer || []).length || 1; cardSel = (cardSel + d + n) % n; markCard(); sound.move(); }
function pickCard(i) {
  if (screen !== "mutate" || !game.choose(i)) return;
  sound.pick();
  show("play");
}

// ---------- banners and tips ----------
let bannerTimer = 0;
function banner(text, sub = "", color = "#e9fbf7") {
  const b = ui.banner;
  b.innerHTML = text + (sub ? `<small>${sub}</small>` : "");
  b.style.color = color;
  b.classList.remove("show");
  void b.offsetWidth;
  b.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove("show"), 2000);
}
let tipTimer = 0;
function tip(html, ms = 4200) {
  ui.tip.innerHTML = html;
  ui.tip.classList.add("show");
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => ui.tip.classList.remove("show"), ms);
}
function showTipOnce(id, html) {
  if (tips[id]) return;
  tips[id] = 1;
  store.set("primordia.tips", tips);
  tip(html);
}

// ---------- effects ----------
const particles = [], popups = [], trail = [];
let shake = 0, flash = 0, slowmo = 0, slowFactor = 1;
const rnd = (a, b) => a + Math.random() * (b - a);

function burst(x, y, n, color, speed = 20, life = 0.8, size = 1) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * rnd(0.6, 1.4), home: false });
  }
}
function absorb(x, y, n, color) {
  for (let i = 0; i < n; i++) particles.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.6, max: 0.6, color, size: rnd(0.5, 1), home: true });
}
function popup(x, y, text, color, big = false) { popups.push({ x, y, text, color, life: 1.2, big }); }
function addShake(a) { if (!reduceMotion) shake = Math.min(14, shake + a); }

function handleEvents() {
  const P = game.player;
  for (const e of game.events) {
    switch (e.type) {
      case "nibble":
        absorb(e.x, e.y, 3, e.kind === "prey" ? "#7ffff0" : "#ffb070");
        sound.nibble();
        break;
      case "devour": {
        const big = e.kind === "hunter";
        const color = e.golden ? "#ffd86a" : big ? "#ff3d7f" : "#3ff0e0";
        burst(e.x, e.y, big ? 70 : 28, color, big ? 34 : 22, big ? 1.1 : 0.7, big ? 1.4 : 1);
        if (big) burst(e.x, e.y, 30, "#ffd86a", 50, 0.6, 0.8);
        popup(e.x, e.y - 3, "+" + fmt(e.points) + (e.mult > 1 ? "  ×" + e.mult : ""), color, big || e.golden);
        sound.devour(Math.min(12, e.combo), big || e.golden);
        if (e.golden) { sound.golden(); banner("GOLDEN ORBIUM", "Full light · Frenzy charged", "#ffd86a"); flash = 0.5; }
        if (big) { addShake(e.boss ? 14 : 7); slowmo = e.boss ? 0.8 : 0.18; slowFactor = e.boss ? 0.25 : 0.35; flash = Math.max(flash, 0.25); }
        if (e.boss) banner("LEVIATHAN DEVOURED", "+" + fmt(e.points), "#ffd86a");
        ui.combo.classList.remove("pop"); void ui.combo.offsetWidth; ui.combo.classList.add("pop");
        break;
      }
      case "hurt":
        sound.hurt(); addShake(4); burst(P.x, P.y, 8, "#ff3d7f", 18, 0.4, 0.8);
        showTipOnce("hurt", touchMode ? "Red hunters sting. Tap <kbd>DASH</kbd> to slip through them." : "Red hunters sting. <kbd>Space</kbd> or click to dash through them.");
        break;
      case "dash": sound.dash(); break;
      case "ready":
        sound.ready2();
        banner("FRENZY READY", touchMode ? "Tap FRENZY" : "Shift · Right-click · Ⓑ", "#ffc94a");
        showTipOnce("frenzy", touchMode ? "Tap <kbd>FRENZY</kbd>, then chase the red hunters and eat them." : "Press <kbd>Shift</kbd> or right-click, then chase the red hunters and eat them.");
        break;
      case "frenzy":
        sound.frenzyStart(); sound.frenzy = true; addShake(6); flash = 0.35;
        burst(P.x, P.y, 40, "#ffd86a", 40, 0.7);
        banner("FRENZY!", "Eat the hunters", "#ffc94a");
        break;
      case "frenzyEnd": sound.frenzy = false; break;
      case "warn": sound.spawn(true); if (e.boss) banner("LEVIATHAN", "Heptapteryx approaches", "#ff5c8f"); break;
      case "spawn":
        if (e.kind === "prey") { if (e.golden) { sound.spawn(false); tip("A golden Orbium appeared. Catch it!", 2600); } }
        else if (e.fresh && !e.boss) banner("NEW SPECIES", e.name, "#ff8fb2");
        if (e.kind === "hunter") { best.species.add(e.name); store.set("primordia.species", [...best.species]); }
        break;
      case "bloom": banner("BLOOM", "The dish overflows · feast!", "#9ffff1"); break;
      case "tide": banner("RED TIDE", "Hunter tissue is spreading", "#ff5c8f"); break;
      case "comboEnd": if (e.combo >= 6) popup(P.x, P.y - 6, e.combo + " CHAIN", "#ffc94a", true); break;
      case "epochEnd":
        sound.epoch(); sound.frenzy = false;
        showCards();
        show("mutate");
        break;
      case "epochStart":
        banner("EPOCH " + roman(e.epoch), e.mutation.name + " · the dish speeds up", "#b49cff");
        sound.tempo = 1 + (e.epoch - 1) * 0.05;
        break;
      case "death":
        sound.death(); sound.frenzy = false; addShake(12); flash = 0.4;
        burst(e.x, e.y, 90, "#c6fff4", 30, 1.6, 1.2);
        setTimeout(gameOver, 1400);
        break;
    }
  }
  game.events.length = 0;
}

function gameOver() {
  if (screen !== "play") return;
  const s = game.score, isBest = s > best.score;
  if (isBest) { best.score = s; store.set("primordia.best", s); }
  $("#finalScore").textContent = fmt(s);
  $("#newBest").hidden = !isBest;
  const st = game.stats;
  $("#stats").innerHTML = [
    ["EPOCH", roman(game.epoch)], ["PREY EATEN", st.prey], ["HUNTERS EATEN", st.hunters],
    ["BEST CHAIN", st.bestCombo], ["GOLDEN", st.golden], ["BEST", fmt(best.score)],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  show("over");
  $("#againBtn").focus();
}

// ---------- drawing ----------
function sx(x) { return rect.x + x * rect.s; }
function sy(y) { return rect.y + y * rect.s; }

// draw fn at (x, y) and at the wrapped copies near the dish edges
function wrapped(x, y, margin, fn) {
  const W = game.w, H = game.h;
  const xs = [x], ys = [y];
  if (x < margin) xs.push(x + W); if (x > W - margin) xs.push(x - W);
  if (y < margin) ys.push(y + H); if (y > H - margin) ys.push(y - H);
  for (const a of xs) for (const b of ys) fn(sx(a), sy(b));
}

let hudCache = {};
function setHud(key, value, apply) { if (hudCache[key] !== value) { hudCache[key] = value; apply(value); } }

function drawFx(t, dt) {
  const c = fx, s = rect.s, P = game.player;
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  c.clearRect(0, 0, view.w, view.h);
  c.save();
  c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip();

  // spawn warnings
  for (const p of game.pending) {
    const k = 1 - p.t / p.total;
    if (p.kind === "prey") {
      wrapped(p.x, p.y, 10, (X, Y) => {
        c.strokeStyle = p.golden ? `rgba(255,216,106,${0.3 + k * 0.6})` : `rgba(63,240,224,${0.2 + k * 0.5})`;
        c.lineWidth = 1.5; c.setLineDash([3, 4]);
        c.beginPath(); c.arc(X, Y, (10 - 7 * k) * s, 0, Math.PI * 2); c.stroke();
        c.setLineDash([]);
      });
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(t * 14);
      const R = (p.boss ? 30 : 18) * s;
      wrapped(p.x, p.y, 36, (X, Y) => {
        c.strokeStyle = `rgba(255,47,116,${0.35 + pulse * 0.5})`; c.lineWidth = 2;
        c.beginPath(); c.arc(X, Y, R * (1.25 - 0.25 * k), 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(X - R, Y); c.lineTo(X - R * 0.5, Y); c.moveTo(X + R * 0.5, Y); c.lineTo(X + R, Y);
        c.moveTo(X, Y - R); c.lineTo(X, Y - R * 0.5); c.moveTo(X, Y + R * 0.5); c.lineTo(X, Y + R); c.stroke();
        c.fillStyle = "#ff5c8f"; c.font = `700 ${Math.max(11, s * 3)}px Space Grotesk, sans-serif`; c.textAlign = "center";
        c.fillText((p.boss ? "LEVIATHAN · " : "") + p.name.toUpperCase(), X, Y - R * 1.35);
      });
    }
  }

  // golden prey and boss marks
  for (const e of game.prey) {
    if (!e.golden) continue;
    wrapped(e.x, e.y, 14, (X, Y) => {
      const R = (e.size + 3.5) * s;
      c.strokeStyle = "rgba(255,216,106,0.9)"; c.lineWidth = 2.5; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30;
      c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      const g = c.createRadialGradient(X, Y, 0, X, Y, R * 1.4);
      g.addColorStop(0, "rgba(255,216,106,0.35)"); g.addColorStop(1, "rgba(255,216,106,0)");
      c.fillStyle = g; c.beginPath(); c.arc(X, Y, R * 1.4, 0, Math.PI * 2); c.fill();
    });
    if (Math.random() < 0.3) particles.push({ x: e.x + rnd(-5, 5), y: e.y + rnd(-5, 5), vx: 0, vy: -6, life: 0.6, max: 0.6, color: "#ffe39a", size: 0.6, home: false });
  }
  for (const e of game.hunters) {
    if (!e.name || (!e.boss && t - (e.seenAt ??= t) > 3)) continue;
    wrapped(e.x, e.y, 40, (X, Y) => {
      c.textAlign = "center"; c.font = `700 ${Math.max(11, s * 2.6)}px Space Grotesk, sans-serif`;
      c.fillStyle = e.boss ? "#ffd0dd" : "rgba(255,170,200,0.8)";
      const top = Y - (e.size + 5) * s;
      c.fillText(e.boss ? "LEVIATHAN" : e.name, X, top);
      if (e.boss) {
        const bw = 26 * s, f = Math.max(0, Math.min(1, e.mass / e.peak));
        c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(X - bw / 2, top + 5, bw, 4);
        c.fillStyle = "#ff2f74"; c.fillRect(X - bw / 2, top + 5, bw * f, 4);
      }
    });
  }

  // symbionts
  for (const sm of game.symbionts) {
    wrapped(sm.x, sm.y, 4, (X, Y) => {
      c.fillStyle = "rgba(160,255,240,0.25)"; c.beginPath(); c.arc(X, Y, 3 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#c6fff4"; c.beginPath(); c.arc(X, Y, 1.1 * s, 0, Math.PI * 2); c.fill();
    });
  }

  // player trail (flagellum)
  if (P.alive) {
    trail.unshift({ x: P.x, y: P.y });
    if (trail.length > 14) trail.length = 14;
  }
  if (P.alive) drawPlayer(c, t, s);

  // particles (additive)
  c.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.home && P.alive) {
      const dx = wdelta(P.x - p.x, game.w), dy = wdelta(P.y - p.y, game.h), d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * 140 * dt; p.vy += (dy / d) * 140 * dt;
      p.vx *= 0.9; p.vy *= 0.9;
      if (d < 1.5) p.life = 0;
    } else { p.vx *= 0.94; p.vy *= 0.94; }
    p.x = wrap(p.x + p.vx * dt, game.w); p.y = wrap(p.y + p.vy * dt, game.h);
    const a = p.life / p.max;
    c.fillStyle = p.color; c.globalAlpha = a;
    c.beginPath(); c.arc(sx(p.x), sy(p.y), Math.max(1, p.size * s * 0.7 * (0.5 + a)), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";

  // popups
  c.textAlign = "center";
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= dt; p.y -= dt * 5;
    if (p.life <= 0) { popups.splice(i, 1); continue; }
    c.globalAlpha = Math.min(1, p.life * 2);
    c.font = `800 ${p.big ? 22 : 15}px Syne, sans-serif`;
    c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,0.6)";
    c.strokeText(p.text, sx(p.x), sy(p.y)); c.fillStyle = p.color; c.fillText(p.text, sx(p.x), sy(p.y));
  }
  c.globalAlpha = 1;
  c.restore();

  // the pointer the creature swims toward
  if (screen === "play" && pointer.active && !touchMode) {
    const r = 7 + Math.sin(t * 6);
    c.strokeStyle = game.frenzyT > 0 ? "rgba(255,216,106,0.8)" : "rgba(180,255,240,0.7)"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(pointer.x, pointer.y, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(pointer.x, pointer.y, 1.5, 0, Math.PI * 2); c.fillStyle = c.strokeStyle; c.fill();
  }

  // dish frame
  c.strokeStyle = "rgba(120,255,230,0.14)"; c.lineWidth = 1;
  c.strokeRect(rect.x - 0.5, rect.y - 0.5, rect.w + 1, rect.h + 1);
}

function drawPlayer(c, t, s) {
  const P = game.player;
  const fr = game.frenzyT > 0;
  const flick = P.iframes > 0 && Math.floor(t * 30) % 2 === 0;
  const R = P.r * s * 1.3;
  const ang = Math.atan2(P.dirY, P.dirX);
  const chomp = P.eating > 0.05 ? 0.15 + 0.5 * Math.abs(Math.sin(t * 16)) : 0.12 + 0.06 * Math.sin(t * 3);
  const body = fr ? "#ffd86a" : P.hurt > 0.3 ? "#ffb0c4" : "#d8fff7";
  const glow = fr ? "rgba(255,201,74," : "rgba(120,255,235,";
  wrapped(P.x, P.y, 8, (X, Y) => {
    // glow
    const g = c.createRadialGradient(X, Y, 0, X, Y, R * (fr ? 6 : 4.2));
    g.addColorStop(0, glow + (fr ? "0.55)" : "0.4)")); g.addColorStop(1, glow + "0)");
    c.fillStyle = g; c.beginPath(); c.arc(X, Y, R * (fr ? 6 : 4.2), 0, Math.PI * 2); c.fill();
  });
  // flagellum: a whip that follows the recent path
  if (trail.length > 3) {
    c.strokeStyle = fr ? "rgba(255,216,106,0.7)" : "rgba(180,255,240,0.6)";
    c.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      if (Math.abs(a.x - b.x) > 20 || Math.abs(a.y - b.y) > 20) continue;
      const k = i / trail.length;
      const nx = -P.dirY, ny = P.dirX, wob = Math.sin(t * 22 - i * 0.9) * k * 1.1;
      c.lineWidth = Math.max(0.5, (1 - k) * R * 0.45);
      c.beginPath();
      c.moveTo(sx(a.x + nx * wob), sy(a.y + ny * wob));
      c.lineTo(sx(b.x + nx * wob), sy(b.y + ny * wob));
      c.stroke();
    }
  }
  if (flick) return;
  wrapped(P.x, P.y, 8, (X, Y) => {
    c.save();
    c.translate(X, Y); c.rotate(ang);
    // membrane with a mouth wedge
    c.beginPath();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = chomp + (i / n) * (Math.PI * 2 - chomp * 2);
      const wob = 1 + 0.07 * Math.sin(a * 5 + t * 7) + (fr ? 0.12 * Math.max(0, Math.sin(a * 9 - t * 20)) : 0);
      const r = R * wob;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.lineTo(R * 0.15, 0);
    c.closePath();
    c.fillStyle = body; c.fill();
    c.lineWidth = Math.max(1, R * 0.12); c.strokeStyle = fr ? "#fff4c0" : "#ffffff"; c.stroke();
    // nucleus and eye
    c.fillStyle = fr ? "#b86a00" : "#2a8f86";
    c.beginPath(); c.arc(-R * 0.25, 0, R * 0.32, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#04030a";
    c.beginPath(); c.arc(R * 0.3, -R * 0.42, R * 0.15, 0, Math.PI * 2); c.fill();
    c.restore();
  });
  // maw reach ring while eating
  if (P.eating > 0.2 || fr) {
    wrapped(P.x, P.y, 10, (X, Y) => {
      c.strokeStyle = fr ? "rgba(255,216,106,0.35)" : "rgba(160,255,240,0.18)";
      c.lineWidth = 1;
      c.beginPath(); c.arc(X, Y, game.mawRadius() * s, 0, Math.PI * 2); c.stroke();
    });
  }
}

function updateHud() {
  const P = game.player;
  const lf = Math.max(0, P.light / P.maxLight);
  setHud("light", lf.toFixed(3), (v) => { ui.lightBar.style.transform = `scaleX(${v})`; });
  setHud("low", lf < 0.25, (v) => ui.lightBar.parentElement.parentElement.classList.toggle("low", v));
  const fz = game.frenzyT > 0 ? game.frenzyT / (7 + 2 * game.mut.gorge) : game.meter;
  setHud("frenzy", fz.toFixed(3), (v) => { ui.frenzyBar.style.transform = `scaleX(${Math.min(1, v)})`; });
  setHud("ready", game.ready ? "r" : game.frenzyT > 0 ? "o" : "", (v) => {
    ui.frenzyMeter.classList.toggle("ready", v === "r"); ui.frenzyMeter.classList.toggle("on", v === "o");
    $("#frenzyBtn").classList.toggle("ready", v === "r");
  });
  setHud("epoch", game.epoch, (v) => { ui.epochLabel.textContent = "EPOCH " + roman(v); });
  setHud("eb", (1 - game.epochTime / EPOCH_LENGTH).toFixed(3), (v) => { ui.epochBar.style.transform = `scaleX(${Math.max(0, v)})`; });
  setHud("score", game.score, (v) => { ui.score.textContent = fmt(v); });
  const m = game.multiplier();
  setHud("combo", game.combo > 1 ? "×" + m + " · " + game.combo : "", (v) => { ui.combo.textContent = v; });
}

// ---------- main loop ----------
let last = performance.now(), simTime = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (screen === "play" || screen === "title" || screen === "over") {
    readInput();
    if (slowmo > 0) { slowmo -= dt; dt *= slowFactor; }
    const before = game.steps;
    game.update(dt, screen === "play" ? input : {});
    input.dash = false; input.frenzy = false;
    if (game.steps !== before) renderer.upload(game.world, "step");
    else if (game.player.eating > 0.9 || game.frenzyT > 0) renderer.upload(game.world, "touch");
    handleEvents();
    simTime += dt;
  } else {
    pollPad();
    input.dash = input.frenzy = false;
  }
  if (screen === "play" || screen === "pause" || screen === "mutate" || screen === "over") updateHud();
  const intensity = screen === "play" ? Math.min(1, (game.hunters.length * 0.2) + (game.player.hurt * 0.5) + game.combo * 0.04) : 0.1;
  sound.tick(intensity);

  shake *= Math.pow(0.02, dt);
  flash = Math.max(0, flash - dt * 1.8);
  const ox = shake > 0.3 ? rnd(-shake, shake) : 0, oy = shake > 0.3 ? rnd(-shake, shake) : 0;
  const r0 = rect;
  rect = { ...rect, x: rect.x + ox, y: rect.y + oy };
  const P = game.player;
  renderer.draw(rect, view, Math.min(1, game.simAcc), simTime, {
    frenzy: game.frenzyT > 0 ? 1 : 0, hurt: P.hurt, flash: reduceMotion ? flash * 0.3 : flash,
    px: P.x / game.w, py: P.y / game.h, light: P.alive ? 1 : 0,
  });
  drawFx(t, dt);
  rect = r0;
}

// ---------- boot ----------
if (matchMedia("(pointer: coarse)").matches) touchMode = true;
layout();
toTitle();
requestAnimationFrame((n) => { last = n; frame(n); });
// let the browser QA reach in
window.__primordia = { get game() { return game; }, get screen() { return screen; }, startRun, pickCard, setPause };
window.__rect = () => rect;
