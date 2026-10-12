import * as scene from "../last-light/vendor/night-coast.js";
import {
  createWatch as create,
  step,
  select,
  visible,
  clamp,
} from "./engine.js";
import { mount } from "../last-light/vendor/mount.js";
const $ = (id) => document.getElementById(id),
  water = $("water"),
  canvas = $("overlay"),
  ctx = canvas.getContext("2d");
mount($("scene"), scene, {
  fps: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 12,
});
let state = null,
  last = 0,
  sound = false,
  audio = null,
  keys = new Set(),
  target = null;
function resize() {
  canvas.width = 1000;
  canvas.height = 500;
}
resize();
function dot(x, y, color, size = 1) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(
    Math.round(x) * 5 + 2.5,
    Math.round(y) * 5 + 2.5,
    size * 2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
function sprite(x, y, pattern, color, scale = 1) {
  for (let r = 0; r < pattern.length; r++)
    for (let c = 0; c < pattern[r].length; c++)
      if (pattern[r][c] !== " ")
        dot(
          x + (c - (pattern[r].length - 1) / 2) * scale,
          y + r * scale,
          color,
          pattern[r][c] === "." ? 0.5 : 0.95,
        );
}
function ring(x, y, r, color) {
  for (let a = 0; a < 6.28; a += 0.12)
    dot(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3, color, 0.6);
}
function tone(n = 0) {
  if (!sound) return;
  audio ??= new AudioContext();
  audio.resume();
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "sine";
  o.frequency.value = 220 * Math.pow(2, n / 12);
  g.gain.setValueAtTime(0.09, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.8);
}
let best = 0;
try {
  const n = Number(localStorage.getItem("coastal-best:" + location.pathname));
  best = Number.isSafeInteger(n) && n >= 0 && n <= 8 ? n : 0;
} catch {}
$("best").textContent = `Best ${best}`;
function record() {
  if (!state.recorded && ["won", "lost"].includes(state.phase)) {
    state.recorded = true;
    best = Math.max(best, state.saved ?? state.collected);
    $("best").textContent = `Best ${best}`;
    try {
      localStorage.setItem("coastal-best:" + location.pathname, String(best));
    } catch {}
  }
}
function begin() {
  state = create();
  target = null;
  keys.clear();
  $("start").textContent = "Restart";
  $("pause").disabled = false;
  $("pause").textContent = "Pause";
  water.focus();
  updateText();
}
function pause() {
  if (!state || !["playing", "paused"].includes(state.phase)) return;
  keys.clear();
  target = null;
  state.phase = state.phase === "playing" ? "paused" : "playing";
  $("pause").textContent = state.phase === "paused" ? "Resume" : "Pause";
  updateText();
}
document.querySelector("[data-switch]").addEventListener("click", () => {
  if (state?.phase === "playing") pause();
});
$("start").onclick = begin;
$("pause").onclick = pause;
$("mute").onclick = () => {
  sound = !sound;
  $("mute").textContent = sound ? "Sound on" : "Sound off";
  $("mute").setAttribute("aria-pressed", String(!sound));
  if (sound) tone();
};
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "BUTTON" && e.key === " ") return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "p") pause();
  if (e.key.toLowerCase() === "r") begin();
  handleKey(e);
});
window.addEventListener("pagehide", () => {
  if (state?.phase === "playing") pause();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  if (state?.phase === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state?.phase === "playing") pause();
});
function point(e) {
  const r = water.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * 200,
    y: ((e.clientY - r.top) / r.height) * 100,
  };
}
water.addEventListener("pointerdown", (e) => {
  water.setPointerCapture(e.pointerId);
  water.focus();
  pointer(point(e), true);
});
water.addEventListener("pointermove", (e) =>
  pointer(point(e), false, e.buttons),
);
water.addEventListener("pointerup", () => {
  target = null;
});
water.addEventListener("pointercancel", () => {
  target = null;
  keys.clear();
});
window.__coastal = {
  get state() {
    return state;
  },
  begin,
  pause,
};
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0);
  last = t;
  ctx.clearRect(0, 0, 1000, 500);
  if (state) {
    if (state.phase === "playing") advance(dt);
    draw();
    updateText();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function handleKey(e) {
  if (!state || state.phase !== "playing") return;
  if (e.key.toLowerCase() === "n" && document.activeElement === water) {
    let boats = state.boats.filter((b) => !b.done && visible(state, b));
    let i = boats.findIndex((b) => b.id === state.selected);
    if (boats.length) state.selected = boats[(i + 1) % boats.length].id;
  }
  if (
    e.key === "Enter" &&
    document.activeElement === water &&
    state.selected !== null
  ) {
    select(state, 36, 91);
  }
}
function pointer(p, down) {
  if (!state || state.phase !== "playing") return;
  state.beam = clamp(p.x, 40, 190);
  if (down) select(state, p.x, p.y);
}
$("action").onclick = () => {
  if (!state) begin();
  else {
    state.beam = state.beam >= 175 ? 45 : state.beam + 25;
  }
};
function advance(dt) {
  state.beam = clamp(
    state.beam +
      ((keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0)) *
        55 *
        dt,
    40,
    190,
  );
  const b = state.boats.find((b) => b.id === state.selected && !b.done);
  if (b) {
    let dx = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0),
      dy = (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0);
    if (dx || dy) {
      b.tx = clamp(b.x + dx * 15, 35, 190);
      b.ty = clamp(b.y + dy * 15, 62, 97);
    }
  }
  let saved = state.saved;
  step(state, dt);
  if (state.saved > saved) tone(7);
}
function draw() {
  for (let y = 61; y < 97; y += 2) {
    const spread = 2 + (y - 60) * 0.36;
    for (let x = state.beam - spread; x < state.beam + spread; x += 2)
      if ((x + y) % 3 < 1) dot(x, y, "#ffd27c", 0.35);
  }
  for (let x = 33; x < 48; x += 2) ring(x, 91, 1.3, "#ffd27c");
  sprite(98, 80, [" .•. ", "•••••", " ••• "], "#555d6c", 1.8);
  ring(98, 84, 8, "#7089c0");
  for (const b of state.boats) {
    if (b.done) continue;
    let scale = 0.4 + (b.y - 60) / 35;
    if (visible(state, b)) {
      sprite(
        b.x,
        b.y,
        ["  •  ", " ••• ", "•••••", " ••• "],
        b.id === state.selected ? "#ffd27c" : "#bec9dc",
        scale,
      );
      ring(b.x, b.y + 4 * scale, 4 * scale, "#445f9f");
      if (b.id === state.selected) {
        ring(b.tx, b.ty, 3, "#ffd27c");
        for (let t = 0.1; t < 1; t += 0.13)
          dot(b.x + (b.tx - b.x) * t, b.y + (b.ty - b.y) * t, "#f3a64a", 0.4);
      }
    } else dot(b.x, b.y, "#7089c0", 0.5);
  }
}
function updateText() {
  record();
  $("progress").textContent = `Harbor ${state.saved} / 8`;
  $("resource").textContent = `Wrecks ${state.wrecks} / 3`;
  $("clock").textContent = `Watch ${Math.floor(state.time)}s`;
  $("message").textContent =
    state.phase === "won"
      ? `Watch complete. ${state.saved} boats reached harbor. Begin another watch?`
      : state.phase === "lost"
        ? "Three boats lost. The coast needs another keeper. Restart your watch."
        : state.phase === "paused"
          ? "Watch paused. Resume when ready."
          : "Sweep to reveal boats. Select one, then chart a course around the reef to the golden harbor. N selects · Enter sends to harbor · arrows steer.";
  if (["won", "lost"].includes(state.phase)) $("pause").disabled = true;
}
