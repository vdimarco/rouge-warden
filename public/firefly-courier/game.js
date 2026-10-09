import * as piece from "./vendor/misty-forest.js";
import { mount } from "../last-light/vendor/mount.js";
import { create, act, step, trail, shrines } from "./engine.js";
const $ = (id) => document.getElementById(id),
  scene = $("scene"),
  canvas = $("play"),
  ctx = canvas.getContext("2d"),
  card = $("card");
let state = create(),
  last = 0,
  time = 0,
  shown = "ready",
  best = 0;
const bestKey = "warden-" + location.pathname.split("/")[1] + "-best";
try {
  const saved = Number(localStorage.getItem(bestKey));
  if (Number.isSafeInteger(saved) && saved >= 0 && saved <= 1000000)
    best = saved;
} catch {}
$("best").textContent = "Best " + best;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
mount(scene, piece, { fps: reduced ? 0 : 8 });
document.body.style.background = piece.meta.ground;
function size() {
  canvas.width = 1000;
  canvas.height = 500;
}
size();
function dots(x, y, r, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let yy = -r; yy <= r; yy += 5)
    for (let xx = -r; xx <= r; xx += 5) {
      const d = Math.hypot(xx, yy);
      if (d > r) continue;
      ctx.beginPath();
      ctx.arc(
        Math.floor((x + xx) / 5) * 5 + 2.5,
        Math.floor((y + yy) / 5) * 5 + 2.5,
        1 - d / r > 0.65 ? 2 : 1 - d / r > 0.3 ? 1.2 : 0.6,
        0,
        7,
      );
      ctx.fill();
    }
  ctx.globalAlpha = 1;
}
function dottedLine(x1, y1, x2, y2, color, alpha = 0.45) {
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
  for (let i = 0; i < n; i++)
    dots(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, 2, color, alpha);
}
function start() {
  state = create();
  state.phase = "playing";
  card.hidden = true;
  shown = "playing";
  canvas.focus();
  render();
}
function pause() {
  if (state.phase === "playing") {
    state.phase = "paused";
    card.hidden = false;
    $("heading").textContent = "Journey paused";
    $("description").textContent = "Your journey will wait here.";
    $("start").textContent = "Continue";
    $("pause").textContent = "Continue";
  } else if (state.phase === "paused") {
    state.phase = "playing";
    card.hidden = true;
    $("pause").textContent = "Pause";
  }
}
$("start").onclick = () => (state.phase === "paused" ? pause() : start());
$("pause").onclick = pause;
$("action").onclick = () => act(state, " ");
for (const b of document.querySelectorAll("[data-key]"))
  b.onpointerdown = (e) => {
    e.preventDefault();
    act(state, b.dataset.key);
  };
addEventListener("keydown", (e) => {
  if (e.key === " " && e.target.closest("button")) return;
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      " ",
      "w",
      "a",
      "s",
      "d",
      "p",
      "P",
      "Enter",
      "Escape",
    ].includes(e.key)
  ) {
    e.preventDefault();
    if (e.key === "p" || e.key === "P" || e.key === "Escape") pause();
    else if (e.key === "Enter" && state.phase !== "playing") {
      if (state.phase === "paused") pause();
      else start();
    } else act(state, e.key);
  }
});
addEventListener("pagehide", () => {
  if (state.phase === "playing") pause();
});
addEventListener("blur", () => {
  if (state.phase === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.phase === "playing") pause();
});
document.querySelector("[data-switch]").addEventListener("click", () => {
  if (state.phase === "playing") pause();
});
function update() {
  if (
    (state.phase === "won" || state.phase === "lost") &&
    shown !== state.phase
  ) {
    shown = state.phase;
    best = Math.max(best, state.score);
    try {
      localStorage.setItem(bestKey, String(best));
    } catch {}
    $("best").textContent = "Best " + best;
    card.hidden = false;
    $("heading").textContent =
      state.phase === "won" ? "Journey complete" : "Try another route";
    $("description").textContent =
      state.message + " Score " + state.score + ".";
    $("start").textContent = "Play again";
  }
  $("message").textContent = state.message;
  render();
}
function tick(now) {
  const dt = last ? Math.min(0.08, (now - last) / 1000) : 0;
  last = now;
  if (!reduced) time += dt;
  step(state, dt);
  update();
  requestAnimationFrame(tick);
}
window.__sceneGame = {
  get state() {
    return state;
  },
  start,
  act: (key) => act(state, key),
  step: (dt) => {
    step(state, dt);
    update();
  },
  pause,
};
requestAnimationFrame(tick);

function project(x, y) {
  const depth = (y + 1) / 5;
  return {
    x: 700 + (x - 3) * (21 + depth * 48),
    y: 309 + depth * 169,
    r: 5 + depth * 9,
  };
}
function render() {
  ctx.clearRect(0, 0, 1000, 500);
  const reveal = state.released || state.reveal > 0;
  for (let i = 0; i < trail.length; i++) {
    const [x, y] = trail[i],
      p = project(x, y);
    if (reveal) {
      dots(p.x, p.y, p.r, "#a4a35a", 0.65);
      if (i) {
        const q = project(...trail[i - 1]);
        dottedLine(p.x, p.y, q.x, q.y, "#a4a35a", 0.35);
      }
    }
  }
  shrines.forEach(([x, y], i) => {
    const p = project(x, y),
      done = state.delivered.includes(i);
    dots(
      p.x,
      p.y - 5,
      p.r * 0.5,
      done ? "#fff0c8" : "#b9834a",
      done ? 0.9 : 0.75,
    );
    dots(p.x, p.y, p.r * 1.6, done ? "#f2c97e" : "#6d7440", 0.15);
  });
  const p = project(state.x, state.y);
  dots(p.x, p.y, 6, "#cbe0dc", 0.85);
  const count = Math.max(1, Math.ceil(state.light / 10));
  for (let i = 0; i < count; i++) {
    const a = time * 0.6 + i * 2.4,
      r = state.released ? 27 + (i % 3) * 16 : 8 + (i % 3) * 4;
    dots(
      p.x + Math.cos(a) * r,
      p.y - 10 + Math.sin(a * 0.8) * r * 0.45,
      3,
      "#fff0c8",
      0.8,
    );
  }
  $("progress").textContent =
    `Lanterns ${state.delivered.length}/5 · Score ${state.score}`;
  $("resource").textContent =
    `Light ${Math.max(0, Math.ceil(state.light))}% · ${state.released ? "Swarm released" : "Swarm gathered"}`;
}
