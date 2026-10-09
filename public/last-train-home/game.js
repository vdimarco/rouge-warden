import * as piece from "./vendor/tokyo-rain.js";
import { mount } from "../last-light/vendor/mount.js";
import { create, act, step, routes } from "./engine.js";
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

function project(lane, depth) {
  return { x: 500 + (lane - 1) * (25 + depth * 210), y: 253 + depth * 222 };
}
function render() {
  ctx.clearRect(0, 0, 1000, 500);
  const progress = state.travel / 4,
    reveal = state.light > 0 || progress > 0.52,
    correct = routes[state.leg] ?? 1;
  for (let lane = 0; lane < 3; lane++) {
    const p = project(lane, progress);
    const color = reveal
      ? lane === correct
        ? "#ffe2a0"
        : lane === (correct + 1) % 3
          ? "#ff85c6"
          : "#28d2e2"
      : "#6a64c4";
    const r = 3 + progress * 16;
    dots(p.x, p.y, r, color, reveal ? 0.9 : 0.4);
    for (let n = 1; n < 5; n++)
      dots(
        p.x + Math.sin(time * 3 + n) * n,
        p.y + n * (2 + progress * 3),
        r * 0.7,
        color,
        0.16 / n,
      );
    if (reveal && lane === correct) {
      dottedLine(p.x, p.y, p.x, p.y + 35 * progress, "#ffe2a0", 0.25);
    }
  }
  const p = project(state.lane, 0.89);
  dots(p.x, p.y - 11, 12, "#ffc4e3", 0.7);
  dots(p.x, p.y - 2, 7, "#e4ecfb");
  for (let n = 1; n < 6; n++)
    dots(p.x + Math.sin(time * 5 + n) * 2, p.y + n * 4, 7, "#b4649c", 0.11);
  if (state.light > 0) {
    for (let i = 0; i < 22; i++) {
      const depth = i / 22;
      const a = project(0, depth),
        b = project(2, depth);
      dottedLine(a.x, a.y, b.x, b.y, "#fff4d8", 0.03);
    }
  }
  $("progress").textContent = `Route ${state.leg}/7 · Score ${state.score}`;
  $("resource").textContent =
    `${Math.max(0, Math.ceil(90 - state.elapsed))}s · ${state.lives} crossings left`;
}
