import { mount } from "../last-light/vendor/mount.js";
import * as scene from "./vendor/earthrise.js";
import { createGame, start, step } from "./engine.js";
const desert = false,
  state = createGame(),
  input = {},
  arena = document.querySelector("#arena"),
  canvas = document.querySelector("#play"),
  ctx = canvas.getContext("2d"),
  primary = document.querySelector("#primary"),
  retry = document.querySelector("#retry"),
  status = document.querySelector("#status"),
  stats = document.querySelector("#stats"),
  motion = matchMedia("(prefers-reduced-motion: reduce)");
let stopScene = mount(document.querySelector("#scene"), scene, {
    fps: motion.matches ? 0 : 12,
  }),
  best = 0,
  last = 0,
  drawLast = 0;
try {
  const n = Number(localStorage.getItem("orbital-gardener-best"));
  if (Number.isSafeInteger(n) && n >= 0 && n <= 1000000) best = n;
} catch {}
motion.addEventListener("change", () => {
  stopScene();
  stopScene = mount(document.querySelector("#scene"), scene, {
    fps: motion.matches ? 0 : 12,
  });
});
window.__sceneGame = { state };
function fit() {
  const r = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * r);
  canvas.height = Math.round(canvas.clientHeight * r);
  render();
}
new ResizeObserver(fit).observe(canvas);
function dot(x, y, level = 2, color = scene.meta.palette[12], alpha = 1) {
  const unit = canvas.width / 200;
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= 200 || y < 0 || y >= 100) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${unit / 0.6}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    " ·•●"[Math.max(1, Math.min(3, level))],
    (x + 0.5) * unit,
    (y + 0.5) * unit,
  );
  ctx.globalAlpha = 1;
}
function line(x, y, x2, y2, color, alpha = 1) {
  const n = Math.ceil(Math.hypot(x2 - x, y2 - y));
  for (let i = 0; i <= n; i++)
    dot(
      x + ((x2 - x) * i) / Math.max(n, 1),
      y + ((y2 - y) * i) / Math.max(n, 1),
      1,
      color,
      alpha,
    );
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.phase === "ready") return;
  if (desert) {
    for (const o of state.objects) {
      const p = project(o);
      if (o.kind === "rock") {
        for (let yy = 0; yy < p.size; yy++)
          for (let xx = -p.size; xx <= p.size; xx++)
            if (Math.abs(xx) < p.size - yy * 0.65)
              dot(p.x + xx, p.y - yy, yy % 2 ? 1 : 2, scene.meta.palette[22]);
        line(
          p.x,
          p.y,
          p.x - p.size * 1.8,
          p.y + p.size * 0.5,
          scene.meta.palette[20],
          0.65,
        );
      } else {
        const warm = scene.meta.palette[o.real ? 14 : 10],
          size = p.size;
        for (let k = 0; k < size * 2; k++) {
          dot(p.x, p.y - k, 2, warm, p.fade);
          if (k > size) dot(p.x + size * 0.7, p.y - k, 2, warm, p.fade);
        }
        for (let k = 1; k < 6; k++)
          dot(p.x, p.y + k * p.size * 0.55, 1, warm, p.fade * 0.3);
        if (!o.real && p.fade > 0)
          dot(
            p.x + (motion.matches ? 0 : Math.sin(state.time * 9)) * size,
            p.y - size * 2,
            1,
            warm,
            p.fade * 0.6,
          );
      }
    }
    const x = 100 + state.x * 91,
      y = 92;
    for (let i = -4; i <= 4; i++) {
      dot(x + i, y - Math.abs(i) * 0.2, 2, scene.meta.palette[15]);
      dot(x + i, y + 1, 1, scene.meta.palette[19]);
    }
    line(x, y, x, y - 7, scene.meta.palette[14]);
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < j * 0.6; i++)
        dot(x + i, y - 7 + j, 2, scene.meta.palette[17]);
    for (let i = 0; i < 8; i++)
      dot(
        x - state.wind * i * 4,
        y + 2 + i * 0.7,
        1,
        scene.meta.palette[25],
        0.45,
      );
  } else {
    for (const p of state.plants) {
      const age = motion.matches ? 1 : Math.min(1, (state.time - p.born) / 2),
        color = scene.meta.palette[29];
      line(p.x, p.y, p.x, p.y - 4 * age, color);
      for (let j = 0; j < 5; j++) {
        const a = j * Math.PI * 0.4;
        line(
          p.x,
          p.y - 3 * age,
          p.x + Math.cos(a) * 4 * age,
          p.y - 3 * age + Math.sin(a) * 2 * age,
          color,
        );
      }
      for (let j = 0; j < 18; j++) {
        const a = (j * Math.PI) / 9;
        dot(
          p.x + Math.cos(a) * 12,
          p.y + Math.sin(a) * 6,
          1,
          scene.meta.palette[23],
          0.25,
        );
      }
    }
    for (const z of state.seeds) {
      dot(z.x, z.y, 3, scene.meta.palette[24]);
      dot(z.x - z.vx * 0.35, z.y - z.vy * 0.35, 1, scene.meta.palette[21], 0.7);
    }
    for (const d of state.debris) {
      dot(d.x, d.y, 2, scene.meta.palette[7]);
      dot(d.x + 1, d.y, 1, scene.meta.palette[4]);
    }
    if (
      !state.cooldown ||
      motion.matches ||
      Math.floor(state.time * 8) % 2 === 0
    ) {
      const c = scene.meta.palette[24];
      dot(state.x, state.y, 3, c);
      dot(state.x - 2, state.y, 2, c);
      dot(state.x + 2, state.y, 2, c);
      dot(state.x, state.y - 1, 1, c);
      for (let i = 0; i < state.cargo; i++)
        dot(state.x - 2 + i * 2, state.y + 2, 2, scene.meta.palette[30]);
    }
  }
}
function hud() {
  stats.textContent = desert
    ? `beacons ${state.score}/6 · hull ${state.health}/3 · wind ${state.wind < -0.04 ? "←" : state.wind > 0.04 ? "→" : "·"} · route ${state.passed}/12`
    : `gardens ${state.plants.length}/6 · seeds ${state.cargo}/3 · hull ${state.health}/3 · ${Math.max(0, Math.ceil(100 - state.time))}s`;
  status.textContent =
    state.phase === "paused"
      ? "Paused. Resume when you are ready."
      : state.message;
  primary.textContent =
    state.phase === "ready"
      ? "[ begin ]"
      : state.phase === "playing"
        ? "[ pause ]"
        : state.phase === "paused"
          ? "[ resume ]"
          : "[ play again ]";
  retry.hidden = state.phase === "ready";
  document.querySelector("#record").textContent = desert
    ? `best crossing ${best} true beacons`
    : `best garden ${best} points`;
}
function clear() {
  for (const k of Object.keys(input)) input[k] = false;
  document.querySelectorAll(".held").forEach((b) => b.classList.remove("held"));
}
function pause() {
  if (state.phase === "playing") {
    state.phase = "paused";
    clear();
    hud();
  }
}
function toggle() {
  clear();
  if (state.phase === "playing") pause();
  else if (state.phase === "paused") state.phase = "playing";
  else start(state);
  hud();
  arena.focus({ preventScroll: true });
}
primary.addEventListener("click", toggle);
retry.addEventListener("click", () => {
  clear();
  start(state);
  hud();
  arena.focus({ preventScroll: true });
});
const map = {
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  " ": "action",
};
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLButtonElement && e.key === " ") return;
  if (e.key.toLowerCase() === "p") {
    if (!e.repeat) toggle();
    return;
  }
  const k = map[e.key] || map[e.key.toLowerCase()];
  if (k) {
    e.preventDefault();
    input[k] = true;
  }
});
addEventListener("keyup", (e) => {
  const k = map[e.key] || map[e.key.toLowerCase()];
  if (k) input[k] = false;
});
for (const b of document.querySelectorAll("[data-key]")) {
  if (desert && ["up", "down", "action"].includes(b.dataset.key)) {
    b.hidden = true;
    continue;
  }
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    input[b.dataset.key] = true;
    b.classList.add("held");
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(ev, () => {
      input[b.dataset.key] = false;
      b.classList.remove("held");
    });
}
document.querySelector("[data-switch]").addEventListener("click", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
addEventListener("blur", pause);
addEventListener("pagehide", pause);
function tick(now) {
  requestAnimationFrame(tick);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  const before = state.phase;
  step(state, dt, input);
  if (before === "playing" && state.phase !== "playing") {
    const score = state.score;
    best = Math.max(best, score);
    try {
      localStorage.setItem("orbital-gardener-best", String(best));
    } catch {}
  }
  if (now - drawLast > 50) {
    render();
    hud();
    drawLast = now;
  }
}
fit();
hud();
requestAnimationFrame(tick);
