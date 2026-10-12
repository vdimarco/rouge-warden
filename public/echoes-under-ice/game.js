import * as scene from "../last-light/vendor/aurora-fjord.js";
import { createDive as create, step, sonar } from "./engine.js";
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

function pulse() {
  if (state && sonar(state)) tone(-5);
}
function handleKey(e) {
  if (e.key === " ") pulse();
}
function pointer(p, down, buttons) {
  if (state?.phase === "playing" && (down || buttons)) target = p;
}
$("action").textContent = "Sonar · Space";
$("action").onclick = () => {
  if (!state) begin();
  pulse();
};
function advance(dt) {
  let dx =
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
    dy =
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
      (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  if (target) {
    dx = target.x - state.x;
    dy = (target.y - state.y) * 1.55;
    if (Math.hypot(dx, dy) < 1) dx = dy = 0;
  }
  let got = state.collected;
  step(state, dt, dx, dy);
  if (state.collected > got) tone([0, 2, 4, 7, 9, 12][state.collected - 1]);
}
function draw() {
  for (let x = 40; x < 165; x += 3) dot(x, 68, "#3ccb73", 0.45);
  if (state.pulse > 0) {
    const r = (2.4 - state.pulse) * 36;
    ring(state.x, state.y, r, "#7fe6d6");
    ring(state.x, state.y, r * 0.97, "#167a4c");
  }
  for (const b of state.bells) {
    if (b.got) {
      dot(b.x, b.y, "#22a05c", 0.4);
      continue;
    }
    if (state.revealed > 0) {
      sprite(b.x, b.y, [" • ", "•••", "•••", " • "], "#ffd27c", 0.8);
      ring(b.x, b.y + 4, 3, "#16877f");
    }
  }
  let scale = 0.7 + (state.y - 62) / 40;
  sprite(state.x, state.y, ["  •  ", "•••••", " ••• "], "#7fe6d6", scale);
  ring(state.x, state.y + 4, 5 * scale, "#167a4c");
  for (let i = 0; i < 4; i++)
    dot(
      state.x - 5 - i * 2,
      state.y +
        (matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : Math.sin(state.time * 3 + i)),
      "#11573f",
      0.5,
    );
}
function updateText() {
  record();
  $("progress").textContent = `Bells ${state.collected} / 6`;
  $("resource").textContent = `Oxygen ${Math.ceil(state.oxygen)}%`;
  $("clock").textContent = `Dive ${Math.max(0, 150 - Math.floor(state.time))}s`;
  $("message").textContent =
    state.phase === "won"
      ? "Six bells recovered. Their song rises into the aurora. Dive again?"
      : state.phase === "lost"
        ? "The dive is over. Return to the surface sooner next time. Restart to try again."
        : state.phase === "paused"
          ? "Dive paused. Resume when ready."
          : "Pulse sonar to reveal bells, then swim close. Return to the green surface strip to refill oxygen.";
  if (["won", "lost"].includes(state.phase)) $("pause").disabled = true;
}
