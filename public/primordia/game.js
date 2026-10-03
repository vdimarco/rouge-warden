// Primordia browser shell: input, rendering, effects, menus and saved progress.
// Game rules live in core.js; the Lenia dish lives in lenia.js.

import { Game, MUTATIONS, SPECIES, SP, PREY_NAME, EPOCH_LENGTH, TUNE, wrap, wdelta } from "./core.js";
import { FieldRenderer, FlatRenderer } from "./render.js";
import { Sound } from "./audio.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
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
  hud: $("#hud"), lightBar: $("#lightBar"), burstBar: $("#burstBar"), burstMeter: $("#burstMeter"), epochLabel: $("#epochLabel"), epochBar: $("#epochBar"),
  waveDots: $$("#waveDots i"), waveLabel: $("#waveLabel"), pips: $$("#dashBtn .pips i"), burstBtn: $("#burstBtn"),
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
  if (!game || game.w !== w || game.h !== h || game.compact !== (touchMode || h > w)) game = new Game(w, h, undefined, { touch: touchMode });
  game.rand = Math.random;
  game.freezeScale = reduceMotion ? 0.5 : 1;
  game.reset(mode);
  particles.length = 0; popups.length = 0; trail.length = 0; arcs.length = 0; hits.length = 0; rings.length = 0;
  stasisEase = 0; cutCounts.clear();
  sound.hunting = false; sound.stasis(false);
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
const input = { mx: 0, my: 0, target: null, dash: false, burst: false, assist: false };
let pointer = { x: 0, y: 0, active: false, lastMove: 0 };
let touchMode = false;
const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
let padPrev = {};
let overAt = 0; // when the game-over screen appeared; a restart needs a fresh press after it

const canRetry = () => screen === "over" && performance.now() - overAt > 150;

addEventListener("keydown", (e) => {
  if (e.repeat && ["Space", "ShiftLeft", "ShiftRight", "KeyX", "KeyZ", "KeyR", "Enter"].includes(e.code)) { e.preventDefault(); return; }
  keys.add(e.code);
  sound.init();
  const k = e.code;
  if (screen === "title" && ["Enter", "Digit1", "Numpad1", "Space"].includes(k)) { e.preventDefault(); startRun(); return; }
  if (screen === "over" && ["Enter", "Digit1", "Numpad1", "KeyR"].includes(k)) { e.preventDefault(); if (canRetry()) startRun(); return; }
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
    if (k === "ShiftLeft" || k === "ShiftRight" || k === "KeyX" || k === "KeyK" || k === "KeyF") input.burst = true;
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
  if (e.button === 2) input.burst = true; else input.dash = true;
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
ui.burstBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); sound.init(); input.burst = true; });
// tap anywhere on the game-over screen (outside its buttons) to swim again
ui.over.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; if (canRetry()) startRun(); });

function setTouchMode(on) {
  touchMode = on;
  ui.touch.hidden = !(on && screen === "play");
  $("#retryHint").textContent = on ? "Tap to swim again" : "Press R or Enter to swim again";
  if (on) { pointer.active = false; showTipOnce("touch", "Drag anywhere to swim. Tap <kbd>DASH</kbd> to cut through hunters."); }
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
  const left = edge(14) || edge(4), right = edge(15);
  if (screen === "title") { if (a || start) startRun(); return null; }
  if (screen === "over") { if ((a || start) && canRetry()) startRun(); return null; }
  if (screen === "mutate") { if (left) moveCard(-1); if (right || b) moveCard(1); if (a) pickCard(cardSel); return null; }
  if (screen === "pause") { if (start || a) setPause(false); return null; }
  if (start) { setPause(true); return null; }
  if (a) input.dash = true;
  if (b) input.burst = true;
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
  input.assist = touchMode;
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
  banner("EPOCH I", "Cut, bite, survive", "#9ffff1");
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
    $(".keys").innerHTML = "<div><dt>Swim</dt><dd>Drag anywhere</dd></div><div><dt>Dash, cut, parry</dt><dd>DASH button</dd></div><div><dt>Burst</dt><dd>BURST button, when it glows</dd></div>";
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
  rend: '<path d="M4 30 L36 10" stroke="#9ffff1" stroke-width="4" stroke-linecap="round"/><path d="M14 30 L40 14" stroke="#ff2f74" stroke-width="2" stroke-dasharray="3 3"/>',
  flagellum: '<circle cx="14" cy="22" r="8" fill="#3ff0e0"/><path d="M22 18 q5 -8 10 0 t10 0 M22 26 q5 -8 10 0 t10 0" fill="none" stroke="#9ffff1" stroke-width="2.5"/>',
  sporeburst: '<circle cx="22" cy="22" r="6" fill="#ff2f74"/><circle cx="22" cy="22" r="14" fill="none" stroke="#ffc94a" stroke-width="2" stroke-dasharray="4 3"/><circle cx="8" cy="10" r="2.5" fill="#ffc94a"/><circle cx="37" cy="12" r="2.5" fill="#ffc94a"/><circle cx="34" cy="36" r="2.5" fill="#ffc94a"/>',
  nerve: '<circle cx="8" cy="30" r="5" fill="#ff2f74"/><circle cx="36" cy="12" r="5" fill="#ff2f74"/><path d="M12 27 L20 20 L18 16 L26 14 L32 13" stroke="#ffffff" stroke-width="2" fill="none"/>',
  razor: '<circle cx="22" cy="22" r="10" fill="#3ff0e0"/><path d="M22 4 l3 7 h-6 z M22 40 l3 -7 h-6 z M4 22 l7 3 v-6 z M40 22 l-7 3 v-6 z" fill="#ff8fb2"/>',
  stasis: '<circle cx="22" cy="22" r="15" fill="none" stroke="#b49cff" stroke-width="3"/><path d="M22 12 V22 L29 27" stroke="#b49cff" stroke-width="3" fill="none" stroke-linecap="round"/>',
  spores: '<circle cx="15" cy="22" r="9" fill="#3ff0e0"/><circle cx="31" cy="15" r="5" fill="#3ff0e0" opacity=".7"/><circle cx="33" cy="30" r="4" fill="#3ff0e0" opacity=".5"/>',
  gorge: '<circle cx="22" cy="22" r="15" fill="#ffc94a"/><path d="M22 22 L38 14 L38 30 Z" fill="#04030a"/>',
  echo: '<circle cx="22" cy="22" r="6" fill="#ffc94a"/><circle cx="22" cy="22" r="12" fill="none" stroke="#ffc94a" stroke-opacity=".6" stroke-width="2"/><circle cx="22" cy="22" r="18" fill="none" stroke="#ffc94a" stroke-opacity=".3" stroke-width="2"/>',
  maw: '<circle cx="22" cy="22" r="15" fill="none" stroke="#3ff0e0" stroke-width="3"/><path d="M22 22 L38 12 L38 32 Z" fill="#04030a"/>',
  flagella: '<circle cx="14" cy="22" r="8" fill="#3ff0e0"/><path d="M22 22 q5 -8 10 0 t10 0" fill="none" stroke="#9ffff1" stroke-width="3"/>',
  heart: '<path d="M22 37 C6 26 6 12 15 10 C19 9 22 13 22 15 C22 13 25 9 29 10 C38 12 38 26 22 37 Z" fill="#ff8fb2"/>',
  symbiont: '<circle cx="22" cy="22" r="8" fill="#3ff0e0"/><circle cx="22" cy="22" r="16" fill="none" stroke="#3ff0e0" stroke-opacity=".35" stroke-width="2"/><circle cx="36" cy="18" r="4" fill="#c6fff4"/>',
  chainbloom: '<circle cx="12" cy="28" r="7" fill="none" stroke="#ffc94a" stroke-width="2"/><circle cx="30" cy="16" r="9" fill="none" stroke="#ffc94a" stroke-width="2"/><path d="M17 24 L24 20" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="28" r="3" fill="#ff2f74"/><circle cx="30" cy="16" r="3" fill="#ff2f74"/>',
  bladedance: '<path d="M6 34 L30 10 M14 36 L38 12" stroke="#9ffff1" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="22" r="17" fill="none" stroke="#b49cff" stroke-width="2" stroke-dasharray="3 4"/>',
  thornheart: '<path d="M22 37 C6 26 6 12 15 10 C19 9 22 13 22 15 C22 13 25 9 29 10 C38 12 38 26 22 37 Z" fill="#ff8fb2"/><path d="M22 6 l2 5 h-4 z M8 20 l5 2 v-4 z M36 20 l-5 2 v-4 z" fill="#ffffff"/>',
  gutpull: '<circle cx="12" cy="22" r="6" fill="#d8fff7"/><circle cx="34" cy="14" r="4" fill="#3ff0e0"/><circle cx="34" cy="30" r="4" fill="#3ff0e0"/><path d="M30 15 L20 20 M30 29 L20 24" stroke="#3ff0e0" stroke-width="2" stroke-dasharray="2 3"/>',
};
let cardSel = 0;
function showCards() {
  const offer = game.offer || [];
  $("#mutateKicker").textContent = "EPOCH " + roman(game.epoch) + " SURVIVED";
  ui.cards.innerHTML = offer.map((m, i) => {
    const lvl = game.mut[m.id], max = MUTATIONS.find((x) => x.id === m.id).max;
    const kind = m.kind === "duo" ? "" : `<span class="kind">${m.kind === "build" ? "BUILD" : "EXTRA"}</span>`;
    const tag = m.kind === "duo" ? '<span class="duo-tag">DUO</span>' : "";
    return `<button class="card${m.kind === "duo" ? " duo" : ""}" type="button" data-i="${i}"><span class="k">${i + 1}</span>${tag}<svg viewBox="0 0 44 44" aria-hidden="true">${ICONS[m.id] || ""}</svg>${kind}<b>${m.name}</b><p>${m.text}</p><span class="lvl">${"●".repeat(lvl + 1)}${"○".repeat(Math.max(0, max - lvl - 1))}</span></button>`;
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
function waveLabel(text) {
  const el = ui.waveLabel;
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}

// ---------- effects ----------
const particles = [], popups = [], trail = [], arcs = [], hits = [], rings = [];
const kick = { x: 0, y: 0 };
let shake = 0, flash = 0, slowmo = 0, slowFactor = 1, stasisEase = 0, lungesSeen = 0, readyShown = 0;
const cutCounts = new Map();
const rnd = (a, b) => a + Math.random() * (b - a);

function burst(x, y, n, color, speed = 20, life = 0.8, size = 1) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * rnd(0.6, 1.4), home: false });
  }
}
// a cone of chunks along a direction
function cone(x, y, dx, dy, n, color, spread = 0.44, v0 = 30, v1 = 60, life = 0.5) {
  if (reduceMotion) n = Math.ceil(n / 3);
  const a0 = Math.atan2(dy, dx);
  for (let i = 0; i < n; i++) {
    const a = a0 + (Math.random() - 0.5) * spread, v = rnd(v0, v1);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rnd(0.6, 1.3), home: false });
  }
}
function absorb(x, y, n, color) {
  for (let i = 0; i < n; i++) particles.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.6, max: 0.6, color, size: rnd(0.5, 1), home: true });
}
function popup(x, y, text, color, big = false) { popups.push({ x, y, text, color, life: 1.2, big }); }
function addShake(a) { if (!reduceMotion) shake = Math.min(14, shake + a); }
// a directional kick of the whole view, in pixels
function addKick(dx, dy, px) {
  if (reduceMotion) return;
  const l = Math.hypot(dx, dy) || 1;
  kick.x = Math.max(-14, Math.min(14, kick.x + (dx / l) * px));
  kick.y = Math.max(-14, Math.min(14, kick.y + (dy / l) * px));
}
const hunterById = (id) => game.hunters.find((h) => h.id === id);

function handleEvents() {
  const P = game.player;
  for (const e of game.events) {
    switch (e.type) {
      case "nibble":
        absorb(e.x, e.y, 3, e.kind === "prey" ? "#7ffff0" : "#ffb070");
        sound.nibble();
        break;
      case "devour": {
        if (e.kind === "prey") {
          const color = e.golden ? "#ffd86a" : "#3ff0e0";
          burst(e.x, e.y, 28, color, 22, 0.7, 1);
          popup(e.x, e.y - 3, "+" + fmt(e.points) + (e.mult > 1 ? "  ×" + e.mult : ""), color, e.golden);
          sound.devour(Math.min(12, e.combo), e.golden);
          if (e.golden) { sound.golden(); banner("GOLDEN ORBIUM", "Full light · half a Burst", "#ffd86a"); flash = 0.5; }
          break;
        }
        const big = e.boss || e.species === SP.HEXA;
        if (e.how === "glory") {
          burst(e.x, e.y, 60, "#ff3d7f", 34, 1.0, 1.4);
          burst(e.x, e.y, 20, "#ffd86a", 50, 0.6, 0.9);
          addKick(e.x - P.x, e.y - P.y, 6);
          flash = Math.max(flash, 0.15);
          sound.glory(big);
          popup(e.x, e.y - 3, "+" + fmt(e.points) + (e.mult > 1 ? "  ×" + e.mult : ""), "#ffd86a", true);
          if (e.boss) { slowmo = 0.8; slowFactor = 0.25; addShake(14); flash = 0.4; banner("LEVIATHAN DEVOURED", "+" + fmt(e.points), "#ffd86a"); }
          else if (e.species !== SP.DISC) { slowmo = 0.18; slowFactor = 0.35; }
        } else {
          burst(e.x, e.y, 40, "#ff3d7f", 28, 0.8, 1.1);
          sound.devour(Math.min(12, e.combo), true);
          const label = e.how === "bleed" ? "BLED OUT  +" : e.how === "rupture" ? "RUPTURED  +" : "+";
          popup(e.x, e.y - 3, label + fmt(e.points), "#ff8fb2", e.how === "burst");
        }
        ui.combo.classList.remove("pop"); void ui.combo.offsetWidth; ui.combo.classList.add("pop");
        break;
      }
      case "hurt":
        sound.hurt(); addShake(2); burst(P.x, P.y, 8, "#ff3d7f", 18, 0.4, 0.8);
        break;
      case "dash":
        sound.dash();
        cone(P.x, P.y, -e.dx, -e.dy, 6, "#bff7f0", 0.6, 10, 25, 0.35);
        if (game.hunters.some((h) => h.nd < 26 && !h.egg)) showTipOnce("cut", touchMode ? "Tap <kbd>DASH</kbd> to cut through a hunter." : "Dash through a hunter to cut it.");
        break;
      case "refill": sound.refill(); break;
      case "windup": {
        const h = hunterById(e.id);
        sound.windup(e.sec);
        if (h && h.nd < 40) showTipOnce("lane", "A hunter is about to lunge. Move out of its lane.");
        break;
      }
      case "glint":
        sound.glint();
        if (lungesSeen >= 3) showTipOnce("parry", touchMode ? "Tap <kbd>DASH</kbd> at the flash to parry." : "Dash into the flash to parry.");
        break;
      case "lunge": {
        lungesSeen++;
        sound.lunge();
        cone(e.x, e.y, -e.ux, -e.uy, 12, "#6a0f24", 0.9, 8, 20, 0.6);
        break;
      }
      case "lungeHit":
        sound.hit(); addKick(e.dx, e.dy, 5);
        burst(P.x, P.y, 14, "#ff3d7f", 24, 0.5, 1);
        if (e.multFrom > e.multTo) popup(P.x, P.y - 5, "×" + e.multFrom + " → ×" + e.multTo, "#ff8fb2");
        showTipOnce("hit", "Out of dashes? Keep one to escape.");
        break;
      case "graze":
        sound.graze();
        popup(e.x, e.y - 4, "CLOSE +150", "#ffffff");
        cone(e.x, e.y, e.dx, e.dy, 8, "#ffffff", 0.3, 30, 50, 0.3);
        break;
      case "tissueHit":
        hits.push({ x: e.x, y: e.y, r: 10, s: e.s, at: performance.now() });
        if (hits.length > 8) hits.shift();
        break;
      case "cut": {
        const c = cutCounts.get(e.id), now = performance.now();
        const n = c && now - c.at < 1200 ? c.n + 1 : 1;
        cutCounts.set(e.id, { n, at: now });
        sound.cut(n);
        addKick(e.dx, e.dy, 3);
        cone(e.x, e.y, e.dx, e.dy, 24, "#ff3d7f", 0.44, 30, 60, 0.5);
        cone(e.x, e.y, e.dx, e.dy, 6, "#ffffff", 0.3, 40, 70, 0.3);
        if (e.frac >= 0.04) popup(e.x, e.y - 4, Math.round(Math.min(e.frac, TUNE.cutCap * TUNE.exposed) * 100) + "%", "#ffb0c4");
        break;
      }
      case "stagger":
        sound.stagger(); addShake(4);
        popup(e.x, e.y - 6, e.boss ? "WING TORN" : "STAGGER", "#ffd86a", true);
        rings.push({ x: e.x, y: e.y, r0: 4, r1: 18, at: performance.now(), dur: 400, color: "255,216,106" });
        if (!e.boss) showTipOnce("glory", touchMode ? "Swim into the gold hunter to finish it." : "Bite the gold hunter to finish it.");
        break;
      case "parry":
        sound.parry(); addKick(P.dashX, P.dashY, 5);
        if (!reduceMotion) burst(P.x, P.y, 30, "#b49cff", 40, 0.6, 1);
        popup(P.x, P.y - 6, "PARRY", "#d8c8ff", true);
        break;
      case "stasis": sound.stasis(true); break;
      case "stasisEnd": sound.stasis(false); break;
      case "burstReady":
        sound.burstReady();
        if (readyShown++ < 3) banner("BURST READY", touchMode ? "Tap BURST near hunters" : "Shift · Right-click · Ⓑ", "#ffc94a");
        showTipOnce("burst", touchMode ? "Tap <kbd>BURST</kbd> when hunters are close." : "Press <kbd>Shift</kbd> when hunters are close.");
        break;
      case "burst":
        sound.burst(); sound.hunting = true; addShake(10); flash = 0.5;
        burst(P.x, P.y, 80, "#ffd86a", 45, 0.7);
        rings.push({ x: P.x, y: P.y, r0: 0, r1: TUNE.burst.r, at: performance.now(), dur: 250, color: "255,201,74", shader: true });
        if (e.caught >= 2) popup(P.x, P.y - 8, "BURST ×" + e.caught + " = " + fmt(e.points), "#ffd86a", true);
        else if (e.caught === 1) popup(P.x, P.y - 8, "BURST", "#ffd86a", true);
        break;
      case "burstEnd": sound.hunting = false; break;
      case "remains":
        burst(e.x, e.y, 10, "#7ffff0", 10, 0.6, 0.8);
        sound.bubble();
        showTipOnce("remains", "Catch the prey it dropped.");
        break;
      case "pop":
        sound.pop(); burst(e.x, e.y, 16, "#ff8fb2", 24, 0.5, 0.9);
        popup(e.x, e.y - 3, "+" + fmt(e.points), "#ff8fb2");
        break;
      case "crack": sound.crack(); break;
      case "hatch": burst(e.x, e.y, 10, "#ff3d7f", 18, 0.5, 1); break;
      case "wave": waveLabel("WAVE " + e.wave); break;
      case "waveClear":
        banner("WAVE CLEAR", "+" + fmt(e.bonus), "#b49cff");
        sound.epoch();
        break;
      case "bossPhase":
        sound.bossPhase(e.phase - 1); addShake(8);
        burst(e.x, e.y, 40, "#ff3d7f", 34, 0.8, 1.2); burst(e.x, e.y, 20, "#ffd86a", 40, 0.6, 1);
        banner("WING TORN", "The Leviathan shrinks", "#ffd86a");
        break;
      case "collapse":
        sound.stagger(); addShake(6);
        banner("COLLAPSE", "Bite it now", "#ffd86a");
        break;
      case "rupture": burst(e.x, e.y, 30, "#ff3d7f", 30, 0.7, 1.2); break;
      case "dissolve": burst(e.x, e.y, 6, "#7a2240", 8, 0.6, 0.8); break;
      case "proc":
        if (e.kind === "nerve") arcs.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, at: performance.now() });
        else rings.push({ x: e.x, y: e.y, r0: 2, r1: e.r || 6, at: performance.now(), dur: 300, color: e.kind === "spore" ? "255,201,74" : "255,143,178" });
        break;
      case "rally": popup(e.x, e.y - 5, "+" + Math.round(e.amount) + " LIGHT", "#9ffff1"); break;
      case "warn": if (e.role !== "egg") sound.spawn(true); if (e.boss) banner("LEVIATHAN", "Heptapteryx approaches", "#ff5c8f"); break;
      case "spawn":
        if (e.kind === "prey") { if (e.golden) { sound.spawn(false); tip("A golden Orbium appeared. Catch it!", 2600); } }
        else {
          if (e.fresh && !e.boss) banner("NEW SPECIES", e.name, "#ff8fb2");
          if (e.role === "egg") showTipOnce("egg", "Pop eggs before they hatch.");
          best.species.add(e.name); store.set("primordia.species", [...best.species]);
        }
        break;
      case "bloom": banner("BLOOM", "The dish overflows · feast!", "#9ffff1"); break;
      case "tide": banner("RED TIDE", "Hunter tissue is spreading", "#ff5c8f"); break;
      case "comboEnd": if (e.combo >= 6) popup(P.x, P.y - 6, e.combo + " CHAIN", "#ffc94a", true); break;
      case "epochEnd":
        sound.epoch(); sound.hunting = false; sound.stasis(false);
        showCards();
        show("mutate");
        break;
      case "epochStart":
        banner("EPOCH " + roman(e.epoch), e.mutation.name + " · the dish speeds up", "#b49cff");
        sound.tempo = 1 + (e.epoch - 1) * 0.05;
        break;
      case "death":
        sound.death(); sound.hunting = false; sound.stasis(false); addShake(12); flash = 0.4;
        burst(e.x, e.y, 90, "#c6fff4", 30, 1.6, 1.2);
        setTimeout(gameOver, 600);
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
    ["EPOCH", roman(game.epoch)], ["HUNTERS EATEN", st.hunters], ["GLORY BITES", st.glory],
    ["PARRIES", st.parries], ["BEST CHAIN", st.bestCombo], ["BEST", fmt(best.score)],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  show("over");
  overAt = performance.now();
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

// a hunter's lunge lane: the true footprint its body will sweep
function drawLane(c, e, t, s) {
  const locked = !!e.lane;
  const L = e.lane || { ux: e.aimX || 1, uy: e.aimY || 0, L: 18, back: -8, front: 8, left: -8, right: 8, x0: e.x, y0: e.y };
  const glint = e.glinted && (e.state === "windup" || e.state === "reaim");
  const lunging = e.state === "lunge";
  const len = L.front + L.L - L.back, wid = L.right - L.left;
  const margin = Math.max(Math.abs(L.back), L.front + L.L) + Math.max(Math.abs(L.left), Math.abs(L.right));
  wrapped(L.x0, L.y0, margin, (X, Y) => {
    c.save();
    c.translate(X, Y); c.rotate(Math.atan2(L.uy, L.ux));
    c.lineWidth = Math.max(3, 0.8 * s);
    if (!locked) {
      c.setLineDash([6, 6]); c.strokeStyle = "rgba(255,60,110,0.4)";
      c.strokeRect(L.back * s, L.left * s, len * s, wid * s);
    } else {
      c.fillStyle = lunging ? "rgba(255,60,110,0.08)" : "rgba(255,60,110,0.14)";
      c.fillRect(L.back * s, L.left * s, len * s, wid * s);
      c.strokeStyle = glint ? "rgba(255,255,255,0.95)" : lunging ? "rgba(255,60,110,0.35)" : "rgba(255,60,110,0.85)";
      c.strokeRect(L.back * s, L.left * s, len * s, wid * s);
      if (!lunging) {
        // chevrons running toward the front
        c.strokeStyle = "rgba(255,120,150,0.7)"; c.lineWidth = 2;
        const step = 8, off = ((t * 2) % 1) * step;
        for (let a = L.front + off; a < L.front + L.L; a += step) {
          c.beginPath(); c.moveTo((a - 2.5) * s, -3 * s); c.lineTo(a * s, 0); c.lineTo((a - 2.5) * s, 3 * s); c.stroke();
        }
      }
    }
    c.restore();
  });
  if (glint) {
    wrapped(e.nx, e.ny, 6, (X, Y) => {
      const r = Math.max(14, 3.5 * s);
      c.fillStyle = "#ffffff";
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + t * 3, rr = i % 2 ? r * 0.25 : r; c.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr); }
      c.closePath(); c.fill();
    });
  }
}

function drawFx(t, dt) {
  const c = fx, s = rect.s, P = game.player, now = performance.now();
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
      const role = SPECIES[p.species].role, pulse = 0.5 + 0.5 * Math.sin(t * 14);
      const R = (p.boss ? 30 : role === "egg" ? 8 : role === "swarm" ? 12 : 18) * s;
      wrapped(p.x, p.y, 36, (X, Y) => {
        c.strokeStyle = role === "egg" ? `rgba(255,170,200,${0.3 + pulse * 0.4})` : `rgba(255,47,116,${0.35 + pulse * 0.5})`; c.lineWidth = 2;
        c.beginPath(); c.arc(X, Y, R * (1.25 - 0.25 * k), 0, Math.PI * 2); c.stroke();
        if (role !== "egg") {
          c.beginPath(); c.moveTo(X - R, Y); c.lineTo(X - R * 0.5, Y); c.moveTo(X + R * 0.5, Y); c.lineTo(X + R, Y);
          c.moveTo(X, Y - R); c.lineTo(X, Y - R * 0.5); c.moveTo(X, Y + R * 0.5); c.lineTo(X, Y + R); c.stroke();
          c.fillStyle = "#ff5c8f"; c.font = `700 ${Math.max(11, s * 3)}px Space Grotesk, sans-serif`; c.textAlign = "center";
          c.fillText((p.boss ? "LEVIATHAN · " : "") + p.name.toUpperCase(), X, Y - R * 1.35);
        }
      });
    }
  }

  // golden prey, and Remains that are about to fade
  for (const e of game.prey) {
    if (e.golden) {
      wrapped(e.x, e.y, 14, (X, Y) => {
        const R = (e.size + 3.5) * s;
        c.strokeStyle = "rgba(255,216,106,0.9)"; c.lineWidth = 2.5; c.setLineDash([6, 6]); c.lineDashOffset = -t * 30;
        c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        const g = c.createRadialGradient(X, Y, 0, X, Y, R * 1.4);
        g.addColorStop(0, "rgba(255,216,106,0.35)"); g.addColorStop(1, "rgba(255,216,106,0)");
        c.fillStyle = g; c.beginPath(); c.arc(X, Y, R * 1.4, 0, Math.PI * 2); c.fill();
      });
      if (Math.random() < 0.3) particles.push({ x: e.x + rnd(-5, 5), y: e.y + rnd(-5, 5), vx: 0, vy: -6, life: 0.6, max: 0.6, color: "#ffe39a", size: 0.6, home: false });
    } else if (e.remains && game.time > e.fadeAt - 1.5 && Math.floor(t * 8) % 2 === 0) {
      wrapped(e.x, e.y, 14, (X, Y) => {
        c.strokeStyle = "rgba(127,255,240,0.6)"; c.lineWidth = 2;
        c.beginPath(); c.arc(X, Y, (e.size + 3) * s, 0, Math.PI * 2); c.stroke();
      });
    }
  }

  // hunters: lanes, stagger rings, egg timers, names, boss pips
  for (const e of game.hunters) {
    if (e.state === "windup" || e.state === "reaim" || e.state === "lunge") drawLane(c, e, t, s);
    if (e.state === "stagger" || e.state === "collapse") {
      const gold = e.state === "collapse" ? 0.6 + 0.4 * Math.sin(t * 19) : 0.6 + 0.4 * Math.sin(t * 38);
      const R = Math.max(game.reachOf(e) - 6, 8) * s;
      wrapped(e.x, e.y, 40, (X, Y) => {
        c.strokeStyle = `rgba(255,216,106,${gold})`; c.lineWidth = Math.max(3, 0.6 * s);
        c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.stroke();
        if (e.state === "collapse") {
          const left = Math.max(0, 1 - (game.time - e.stateAt) / 2.5);
          c.strokeStyle = "rgba(255,255,255,0.8)";
          c.beginPath(); c.arc(X, Y, R + 6, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); c.stroke();
        }
      });
      if (Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2, r = game.reachOf(e) * 0.6;
        particles.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: -Math.sin(a) * 12, vy: Math.cos(a) * 12, life: 0.5, max: 0.5, color: "#ffd86a", size: 0.7, home: false });
      }
    }
    if (e.egg) {
      const left = Math.max(0, (e.hatchAt ?? e.born + TUNE.egg.hatch) - game.time), frac = 1 - left / TUNE.egg.hatch;
      const blink = e.cracked && Math.floor(t * 14) % 2 === 0;
      wrapped(e.x, e.y, 14, (X, Y) => {
        c.strokeStyle = blink ? "rgba(255,255,255,0.9)" : "rgba(255,170,200,0.55)"; c.lineWidth = 2;
        c.beginPath(); c.arc(X, Y, 9 * s, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); c.stroke();
      });
    }
    if (!e.name || e.egg || (!e.boss && t - (e.seenAt ??= t) > 3)) continue;
    wrapped(e.x, e.y, 40, (X, Y) => {
      c.textAlign = "center"; c.font = `700 ${Math.max(11, s * 2.6)}px Space Grotesk, sans-serif`;
      c.fillStyle = e.boss ? "#ffd0dd" : "rgba(255,170,200,0.8)";
      const top = Y - (game.reachOf(e) - 2) * s;
      c.fillText(e.boss ? "LEVIATHAN" : e.name, X, top);
      if (e.boss) {
        // three phase pips: one goes dark with each torn wing
        for (let i = 0; i < 3; i++) {
          c.beginPath(); c.arc(X - 14 + i * 14, top + 10, 4.5, 0, Math.PI * 2);
          c.fillStyle = i >= (e.phase || 1) - 1 ? "#ff2f74" : "rgba(255,255,255,0.18)"; c.fill();
        }
      }
    });
  }

  // nerve arcs between hunters
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i], age = (now - a.at) / 250;
    if (age > 1) { arcs.splice(i, 1); continue; }
    const dx = wdelta(a.x1 - a.x0, game.w), dy = wdelta(a.y1 - a.y0, game.h);
    c.strokeStyle = `rgba(255,255,255,${1 - age})`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(sx(a.x0), sy(a.y0));
    for (let k = 1; k < 6; k++) c.lineTo(sx(a.x0 + (dx * k) / 6 + rnd(-2, 2)), sy(a.y0 + (dy * k) / 6 + rnd(-2, 2)));
    c.lineTo(sx(a.x0 + dx), sy(a.y0 + dy)); c.stroke();
  }
  // expanding rings (Burst, stagger, procs)
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], age = (now - r.at) / r.dur;
    if (age > 1) { rings.splice(i, 1); continue; }
    const rad = (r.r0 + (r.r1 - r.r0) * age) * s;
    wrapped(r.x, r.y, r.r1 + 2, (X, Y) => {
      c.strokeStyle = `rgba(${r.color},${1 - age})`; c.lineWidth = 3;
      c.beginPath(); c.arc(X, Y, rad, 0, Math.PI * 2); c.stroke();
    });
  }

  // symbionts
  for (const sm of game.symbionts) {
    wrapped(sm.x, sm.y, 4, (X, Y) => {
      c.fillStyle = "rgba(160,255,240,0.25)"; c.beginPath(); c.arc(X, Y, 3 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#c6fff4"; c.beginPath(); c.arc(X, Y, 1.1 * s, 0, Math.PI * 2); c.fill();
    });
  }

  // the Burst reach while the meter is full
  if (P.alive && game.ready && game.burstT <= 0) {
    wrapped(P.x, P.y, TUNE.burst.r + 2, (X, Y) => {
      c.strokeStyle = `rgba(255,201,74,${0.22 + 0.12 * Math.sin(t * 5)})`; c.lineWidth = 2; c.setLineDash([4, 6]);
      c.beginPath(); c.arc(X, Y, TUNE.burst.r * s, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    });
  }

  // player trail (flagellum)
  if (P.alive) {
    trail.unshift({ x: P.x, y: P.y });
    if (trail.length > 14) trail.length = 14;
  }
  if (P.alive) drawPlayer(c, t, s);

  // particles (additive); they crawl during hit-stop
  const pdt = game.hitstop > 0 ? dt * 0.25 : dt;
  c.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= pdt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.home && P.alive) {
      const dx = wdelta(P.x - p.x, game.w), dy = wdelta(P.y - p.y, game.h), d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * 140 * pdt; p.vy += (dy / d) * 140 * pdt;
      p.vx *= 0.9; p.vy *= 0.9;
      if (d < 1.5) p.life = 0;
    } else { p.vx *= 0.94; p.vy *= 0.94; }
    p.x = wrap(p.x + p.vx * pdt, game.w); p.y = wrap(p.y + p.vy * pdt, game.h);
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
    c.strokeStyle = game.burstT > 0 ? "rgba(255,216,106,0.8)" : "rgba(180,255,240,0.7)"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(pointer.x, pointer.y, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(pointer.x, pointer.y, 1.5, 0, Math.PI * 2); c.fillStyle = c.strokeStyle; c.fill();
  }

  // dish frame
  c.strokeStyle = "rgba(120,255,230,0.14)"; c.lineWidth = 1;
  c.strokeRect(rect.x - 0.5, rect.y - 0.5, rect.w + 1, rect.h + 1);
}

function drawPlayer(c, t, s) {
  const P = game.player;
  const fr = game.burstT > 0;
  const flick = P.iframes > 0 && P.dashT <= 0 && Math.floor(t * 30) % 2 === 0;
  const R = P.r * s * 1.3;
  const ang = Math.atan2(P.dirY, P.dirX);
  const chomp = P.eating > 0.05 ? 0.15 + 0.5 * Math.abs(Math.sin(t * 16)) : 0.12 + 0.06 * Math.sin(t * 3);
  const body = fr ? "#ffd86a" : P.hurt > 0.3 ? "#ffb0c4" : "#d8fff7";
  const glow = fr ? "rgba(255,201,74," : "rgba(120,255,235,";
  wrapped(P.x, P.y, 8, (X, Y) => {
    const g = c.createRadialGradient(X, Y, 0, X, Y, R * (fr ? 6 : 4.2));
    g.addColorStop(0, glow + (fr ? "0.55)" : "0.4)")); g.addColorStop(1, glow + "0)");
    c.fillStyle = g; c.beginPath(); c.arc(X, Y, R * (fr ? 6 : 4.2), 0, Math.PI * 2); c.fill();
  });
  // flagellum: a whip that follows the recent path
  if (trail.length > 3) {
    c.strokeStyle = fr ? "rgba(255,216,106,0.7)" : P.dashT > 0 ? "rgba(255,255,255,0.85)" : "rgba(180,255,240,0.6)";
    c.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      if (Math.abs(a.x - b.x) > 20 || Math.abs(a.y - b.y) > 20) continue;
      const k = i / trail.length;
      const nx = -P.dirY, ny = P.dirX, wob = Math.sin(t * 22 - i * 0.9) * k * 1.1;
      c.lineWidth = Math.max(0.5, (1 - k) * R * (P.dashT > 0 ? 0.8 : 0.45));
      c.beginPath();
      c.moveTo(sx(a.x + nx * wob), sy(a.y + ny * wob));
      c.lineTo(sx(b.x + nx * wob), sy(b.y + ny * wob));
      c.stroke();
    }
  }
  // dash charges: small arcs behind the player
  const max = game.maxCharges();
  wrapped(P.x, P.y, 10, (X, Y) => {
    const base = ang + Math.PI, spread = 0.42;
    for (let i = 0; i < max; i++) {
      const a = base + (i - (max - 1) / 2) * spread;
      c.strokeStyle = i < P.charges ? "rgba(255,216,106,0.95)" : "rgba(255,255,255,0.18)";
      c.lineWidth = 3;
      c.beginPath(); c.arc(X, Y, R * 2.1, a - 0.15, a + 0.15); c.stroke();
    }
  });
  if (flick) return;
  wrapped(P.x, P.y, 8, (X, Y) => {
    c.save();
    c.translate(X, Y); c.rotate(ang);
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
    c.fillStyle = fr ? "#b86a00" : "#2a8f86";
    c.beginPath(); c.arc(-R * 0.25, 0, R * 0.32, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#04030a";
    c.beginPath(); c.arc(R * 0.3, -R * 0.42, R * 0.15, 0, Math.PI * 2); c.fill();
    c.restore();
  });
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
  const bz = game.burstT > 0 ? game.burstT / (game.burstCap || TUNE.burst.max) : game.meter;
  setHud("burst", bz.toFixed(3), (v) => { ui.burstBar.style.transform = `scaleX(${Math.min(1, v)})`; });
  setHud("ready", game.ready ? "r" : game.burstT > 0 ? "o" : "", (v) => {
    ui.burstMeter.classList.toggle("ready", v === "r"); ui.burstMeter.classList.toggle("on", v === "o");
    ui.burstBtn.classList.toggle("ready", v === "r");
  });
  setHud("epoch", game.epoch, (v) => { ui.epochLabel.textContent = "EPOCH " + roman(v); });
  setHud("eb", (1 - game.epochTime / EPOCH_LENGTH).toFixed(3), (v) => { ui.epochBar.style.transform = `scaleX(${Math.max(0, v)})`; });
  setHud("waves", game.director.cleared.map(Number).join(""), (v) => { ui.waveDots.forEach((d, i) => d.classList.toggle("on", v[i] === "1")); });
  const max = game.maxCharges();
  setHud("pips", P.charges + "/" + max, () => { ui.pips.forEach((d, i) => { d.hidden = i >= max; d.classList.toggle("on", i < P.charges); }); });
  setHud("score", game.score, (v) => { ui.score.textContent = fmt(v); });
  const m = game.multiplier();
  setHud("combo", game.combo > 1 ? "×" + m + " · " + game.combo : "", (v) => { ui.combo.textContent = v; });
}

// shader marks for up to 8 hunters, nearest first
const MARK = { windup: 1, glint: 2, stagger: 3, exposed: 4, collapse: 5, crack: 6 };
function buildMarks() {
  const out = [];
  const list = [...game.hunters].sort((a, b) => (a.nd ?? 1e9) - (b.nd ?? 1e9));
  for (const e of list) {
    let code = 0, p = 0;
    if (e.state === "collapse") code = MARK.collapse;
    else if (e.state === "stagger") code = MARK.stagger;
    else if ((e.state === "windup" || e.state === "reaim") && e.glinted) code = MARK.glint;
    else if (e.state === "windup") { code = MARK.windup; p = Math.min(0.99, 1 - Math.max(0, e.steps) / (e.windupTotal || 1)); }
    else if (e.exposed) code = MARK.exposed;
    else if (e.egg && e.cracked) { code = MARK.crack; p = Math.min(0.99, 1 - Math.max(0, (e.hatchAt ?? 0) - game.time) / TUNE.egg.crack); }
    if (!code) continue;
    out.push({ x: e.x, y: e.y, r: game.reachOf(e), code, p });
    if (out.length >= 8) break;
  }
  return out;
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
    input.dash = false; input.burst = false;
    if (game.steps !== before) renderer.upload(game.world, "step");
    else if (game.player.eating > 0.9 || game.burstT > 0 || game.player.dashT > 0) renderer.upload(game.world, "touch");
    handleEvents();
    simTime += dt;
  } else {
    pollPad();
    input.dash = input.burst = false;
  }
  if (screen === "play" || screen === "pause" || screen === "mutate" || screen === "over") updateHud();
  const near = game.hunters.filter((h) => h.nd < 40 && !h.egg).length;
  const intensity = screen === "play" ? Math.min(1, near * 0.25 + game.player.hurt * 0.5 + game.combo * 0.04) : 0.1;
  sound.tick(intensity);

  // shake: a directional kick plus a little random jitter, both decaying
  const decay = Math.pow(0.02, dt);
  shake *= decay; kick.x *= decay; kick.y *= decay;
  flash = Math.max(0, flash - dt * 1.8);
  stasisEase += ((game.stasisT > 0 ? 1 : 0) - stasisEase) * Math.min(1, dt / 0.1);
  const ox = kick.x + (shake > 0.3 ? rnd(-shake, shake) : 0), oy = kick.y + (shake > 0.3 ? rnd(-shake, shake) : 0);
  const r0 = rect;
  rect = { ...rect, x: rect.x + ox, y: rect.y + oy };
  const P = game.player;
  const nowMs = performance.now();
  const ringNow = rings.find((r) => r.shader && nowMs - r.at < r.dur);
  const ring = ringNow
    ? { x: ringNow.x, y: ringNow.y, r: ringNow.r1 * Math.min(1, (nowMs - ringNow.at) / ringNow.dur), s: 1 }
    : P.alive && game.ready && game.burstT <= 0 ? { x: P.x, y: P.y, r: TUNE.burst.r, s: 0.3 } : null;
  renderer.draw(rect, view, Math.min(1, game.simAcc), simTime, {
    frenzy: game.burstT > 0 ? 1 : 0, hurt: P.hurt, flash: reduceMotion ? flash * 0.3 : flash,
    px: P.x / game.w, py: P.y / game.h, light: P.alive ? 1 : 0,
    marks: buildMarks(),
    hits: hits.filter((h) => nowMs - h.at < 70),
    stasis: stasisEase,
    ring,
  });
  drawFx(t, dt);
  rect = r0;
}

// ---------- boot ----------
if (matchMedia("(pointer: coarse)").matches) touchMode = true;
if (touchMode) $("#retryHint").textContent = "Tap to swim again";
layout();
toTitle();
requestAnimationFrame((n) => { last = n; frame(n); });
// let the browser QA reach in
window.__primordia = { get game() { return game; }, get screen() { return screen; }, startRun, pickCard, setPause, TUNE };
window.__rect = () => rect;
