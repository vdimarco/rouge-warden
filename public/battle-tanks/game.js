import * as engine from "./engine.js";
import { createDepthRenderer } from "./dot-render.js";
const $ = (id) => document.getElementById(id),
  arena = $("action-arena"),
  keys = new Set(),
  pointers = new Map(),
  preference = matchMedia("(prefers-reduced-motion:reduce)");
let state = engine.create(),
  renderer = null,
  loaded = false,
  last = 0,
  lastSave = 0,
  shooting = false,
  aimPoint = null,
  reduced = preference.matches,
  graphicsError = false,
  visualTime = 0,
  accumulator = 0,
  sound = false,
  audio = null;
try {
  const saved = engine.restore(localStorage.getItem(engine.SAVE_KEY));
  if (saved) {
    state = saved;
    loaded = true;
  }
} catch {}
function save() {
  try {
    localStorage.setItem(engine.SAVE_KEY, engine.serialize(state));
  } catch {}
}
function clear() {
  keys.clear();
  pointers.clear();
  shooting = false;
  aimPoint = null;
}
function inputs() {
  const h = new Set([...keys, ...pointers.values()]);
  return {
    throttle:
      Number(h.has("w") || h.has("arrowup") || h.has("up")) -
      Number(h.has("s") || h.has("arrowdown") || h.has("down")),
    turn:
      Number(h.has("d") || h.has("arrowright") || h.has("right")) -
      Number(h.has("a") || h.has("arrowleft") || h.has("left")),
    fire: shooting || h.has(" "),
    autoAim: h.has(" ") || !aimPoint,
    aim: aimPoint,
  };
}
function text(id, value) {
  const n = $(id);
  if (n.textContent !== String(value)) n.textContent = String(value);
}
function sync() {
  if (graphicsError) return;
  const dead = state.relays.filter((r) => r.hp <= 0).length;
  text("action-place", `${state.name} · ${state.missionIndex + 1}/3`);
  text(
    "action-goal",
    dead === 3
      ? "Drive into the cyan extraction zone"
      : "Disable all three relay guns",
  );
  text("action-progress", `Relays ${dead}/3`);
  text("action-health", `Health ${Math.ceil(state.hp)}`);
  $("action-health").style.setProperty("--health", state.hp + "%");
  text("action-score", "Score " + state.score);
  const charge = Math.min(100, state.charge || 0);
  text(
    "tank-charge",
    charge >= 100
      ? "PIERCING SHOT READY"
      : `Drive charge ${Math.floor(charge)}%`,
  );
  $("tank-charge").style.setProperty("--charge", charge + "%");
  $("tank-charge").classList.toggle("ready", charge >= 100);
  $("action-fire").classList.toggle("charged", charge >= 100);
  const boost = state.weaponBoost || state.boostRemaining || 0;
  text(
    "action-tip",
    boost > 0
      ? `OVERDRIVE · ${Math.ceil(boost)}s · keep firing`
      : charge >= 100
        ? "Next shot pierces armor. Line up two targets."
        : "Keep moving to charge a piercing shot. Break relays to power up.",
  );
  text("action-message", state.message);
  text("action-pause", state.phase === "paused" ? "Resume" : "Pause");
  text("action-motion", reduced ? "Motion low" : "Motion full");
  $("action-motion").setAttribute("aria-pressed", String(reduced));
  $("action-pause").disabled = !["playing", "paused"].includes(state.phase);
  $("action-dodge").querySelector("span:last-child").textContent =
    state.smokeCooldown > 0 ? Math.ceil(state.smokeCooldown) + "s" : "Smoke";
  $("tank-artillery").querySelector("span:last-child").textContent =
    state.artilleryCooldown > 0
      ? Math.ceil(state.artilleryCooldown) + "s"
      : "Strike";
  const overlay = state.phase !== "playing";
  $("action-overlay").hidden = !overlay;
  $("action-restart").hidden = !["paused", "lost", "won"].includes(state.phase);
  if (overlay) {
    const labels = {
      ready: [
        "Break their command.",
        "Drive to charge piercing shots. Break three relay guns to light up the sector and power your cannon, then reach cyan extraction. Cover stops shells.",
        loaded ? "Continue mission" : "Begin mission",
      ],
      paused: [
        "Hold position.",
        "Your mission is paused. Return when ready.",
        "Resume",
      ],
      lost: [
        "Tank disabled.",
        "Retry with a fresh vehicle. Earlier secured sectors remain yours.",
        "Retry mission",
      ],
      "region-complete": [
        "Sector secured.",
        "Three relay guns are down. Your next mission has a new layout and stronger patrols.",
        "Next mission",
      ],
      won: [
        "Command broken.",
        "All three sectors are secured. Extraction is complete.",
        "New campaign",
      ],
    }[state.phase];
    if (labels) {
      text("action-title", labels[0]);
      text("action-description", labels[1]);
      text("action-begin", labels[2]);
    }
  }
}
const labelNodes = new Map();
function guidance() {
  if (!renderer) return;
  const live = state.relays.filter((r) => r.hp > 0),
    items = [
      {
        id: "you",
        x: state.x,
        y: state.y,
        height: 7,
        text: "YOU",
        color: "#ffe4a3",
      },
      ...live.map((r, i) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        height: 9,
        text: `RELAY ${state.relays.indexOf(r) + 1} · ${r.hp}/3`,
        color: "#ffa48d",
      })),
      {
        id: "extract",
        x: state.beacon.x,
        y: state.beacon.y,
        height: 6,
        text: live.length ? "EXTRACT · LOCKED" : "EXTRACT →",
        color: "#81fff0",
      },
    ];
  const active = new Set();
  for (const item of items) {
    active.add(item.id);
    let n = labelNodes.get(item.id);
    if (!n) {
      n = document.createElement("span");
      n.className = "tank-world-label";
      $("tank-world-labels").append(n);
      labelNodes.set(item.id, n);
    }
    const p = renderer.project(item.x, item.y, item.height);
    n.hidden = state.phase === "ready";
    n.textContent = item.text;
    n.style.left = Math.max(35, Math.min(innerWidth - 70, p.x)) + "px";
    n.style.top =
      Math.max(innerWidth < 700 ? 150 : 120, Math.min(innerHeight - 120, p.y)) +
      "px";
    n.style.color = item.color;
    n.classList.toggle("offscreen", !p.visible);
  }
  for (const [id, n] of labelNodes)
    if (!active.has(id)) {
      n.remove();
      labelNodes.delete(id);
    }
  const radar = $("tank-radar"),
    c = radar.getContext("2d");
  c.clearRect(0, 0, 200, 100);
  c.fillStyle = "#08160fe6";
  c.fillRect(0, 0, 200, 100);
  c.strokeStyle = "#80bca1";
  c.strokeRect(1, 1, 198, 98);
  for (const b of state.cover)
    if (b.hp > 0) {
      c.fillStyle = "#768c70";
      c.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }
  const dot = (x, y, color, r = 3) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  for (const e of state.enemies) if (e.hp > 0) dot(e.x, e.y, "#c895ff", 2);
  for (const r of live) {
    dot(r.x, r.y, "#ff897c", 4);
    c.fillStyle = "#fff";
    c.font = "9px monospace";
    c.fillText(state.relays.indexOf(r) + 1, r.x + 5, r.y + 3);
  }
  dot(state.beacon.x, state.beacon.y, "#6cffe3", 5);
  dot(state.x, state.y, "#ffe299", 4);
  c.strokeStyle = "#ffe299";
  c.beginPath();
  c.moveTo(state.x, state.y);
  c.lineTo(
    state.x + Math.cos(state.turretAngle) * 17,
    state.y + Math.sin(state.turretAngle) * 17,
  );
  c.stroke();
  const target = aimPoint || {
    x: state.x + Math.cos(state.turretAngle) * 30,
    y: state.y + Math.sin(state.turretAngle) * 30,
  };
  const p = renderer.project(target.x, target.y, 0.5),
    reticle = $("tank-reticle");
  reticle.classList.toggle(
    "out-of-range",
    Math.hypot(target.x - state.x, target.y - state.y) > 70,
  );
  reticle.hidden = state.phase !== "playing" || !p.visible;
  reticle.style.left = p.x + "px";
  reticle.style.top = p.y + "px";
}
function start() {
  clear();
  if (state.phase === "ready") engine.start(state);
  else if (state.phase === "paused") engine.resume(state);
  else if (state.phase === "lost") engine.retry(state);
  else if (state.phase === "region-complete") engine.advance(state);
  else if (state.phase === "won") state = engine.start(engine.create());
  loaded = false;
  sync();
  save();
  arena.focus({ preventScroll: true });
}
function toggle() {
  clear();
  if (state.phase === "playing") engine.pause(state);
  else if (state.phase === "paused") engine.resume(state);
  sync();
  save();
}
function restart() {
  state = engine.start(engine.create());
  clear();
  sync();
  save();
  arena.focus({ preventScroll: true });
}
function deploySmoke() {
  engine.smoke(state);
  sync();
}
function strike() {
  engine.artillery(state, aimPoint ?? undefined);
  sync();
}
$("action-begin").onclick = start;
$("action-restart").onclick = restart;
$("action-pause").onclick = toggle;
$("action-dodge").onclick = deploySmoke;
$("tank-artillery").onclick = strike;
$("action-motion").onclick = () => {
  reduced = !reduced;
  renderer?.setReducedMotion(reduced);
  sync();
};
$("action-sound").onclick = () => {
  sound = !sound;
  text("action-sound", sound ? "Sound on" : "Sound off");
  $("action-sound").setAttribute("aria-pressed", String(sound));
  if (sound) {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
  }
};
const heard = new WeakSet();
function feedback() {
  for (const e of state.effects) {
    if (heard.has(e)) continue;
    heard.add(e);
    if (
      !sound ||
      !audio ||
      !["muzzle", "impact", "artillery", "relay", "destroy"].includes(e.kind)
    )
      continue;
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    const large = e.kind !== "muzzle",
      t = audio.currentTime;
    osc.type = large ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(large ? 140 : 240, t);
    osc.frequency.exponentialRampToValueAtTime(large ? 24 : 70, t + 0.12);
    gain.gain.setValueAtTime(large ? 0.045 : 0.018, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (large ? 0.3 : 0.14));
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }
}
for (const b of document.querySelectorAll("[data-move]")) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, b.dataset.move);
    b.classList.add("held");
  };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(ev, (e) => {
      pointers.delete(e.pointerId);
      b.classList.remove("held");
    });
}
$("action-fire").onclick = () => {
  engine.fire(state, true);
  sync();
};
$("action-fire").onpointerdown = (e) => {
  e.preventDefault();
  $("action-fire").setPointerCapture(e.pointerId);
  shooting = true;
  aimPoint = null;
};
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
  $("action-fire").addEventListener(ev, () => (shooting = false));
function aimAt(e) {
  if (renderer) {
    const p = renderer.aim(e.clientX, e.clientY, state);
    if (p) {
      aimPoint = p;
      engine.aim(state, p.x, p.y);
    }
  }
}
$("action-scene").onpointerdown = (e) => {
  if (state.phase !== "playing") return;
  aimAt(e);
  shooting = true;
  $("action-scene").setPointerCapture(e.pointerId);
  arena.focus({ preventScroll: true });
};
$("action-scene").onpointermove = aimAt;
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
  $("action-scene").addEventListener(ev, () => (shooting = false));
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.target.closest("button,a") && [" ", "enter"].includes(k)) return;
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "shift",
      "e",
      "p",
      "escape",
      "enter",
    ].includes(k)
  )
    e.preventDefault();
  if (!e.repeat) {
    if (k === "p" || k === "escape") toggle();
    else if (k === "enter" && state.phase !== "playing") start();
    else if (k === "shift") deploySmoke();
    else if (k === "e") strike();
  }
  keys.add(k);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function suspend() {
  clear();
  engine.pause(state);
  sync();
  save();
}
addEventListener("blur", suspend);
addEventListener("pagehide", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
});
document.querySelector("[data-switch]").addEventListener("click", suspend);
try {
  renderer = createDepthRenderer($("action-scene"), { reducedMotion: reduced });
  renderer.resize(innerWidth, innerHeight);
} catch (error) {
  graphicsError = true;
  text("action-title", "Graphics could not start.");
  text(
    "action-description",
    "Reload to retry the 3D renderer, or open Afterlight Classic below.",
  );
  text("action-begin", "Retry graphics");
  $("action-begin").onclick = () => location.reload();
  console.error(error);
}
addEventListener("resize", () => renderer?.resize(innerWidth, innerHeight));
preference.addEventListener("change", (e) => {
  reduced = e.matches;
  renderer?.setReducedMotion(reduced);
  sync();
});
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    engine.update(state, inputs(), 1 / 60);
    accumulator -= 1 / 60;
  }
  if (!["paused", "lost"].includes(state.phase)) visualTime += dt;
  renderer?.render(state, visualTime);
  feedback();
  guidance();
  sync();
  if (state.phase === "playing" && now - lastSave > 1800) {
    save();
    lastSave = now;
  }
}
window.__battleTanks = {
  get state() {
    return state;
  },
  get renderer() {
    return renderer;
  },
  start,
  pause: () => {
    engine.pause(state);
    clear();
    sync();
  },
  resume: () => {
    engine.resume(state);
    sync();
  },
  step: (input, dt) => {
    engine.update(state, input, dt);
    sync();
    renderer?.render(state, state.time);
    guidance();
  },
  fire: (auto) => engine.fire(state, auto),
  aim: (x, y) => engine.aim(state, x, y),
  smoke: deploySmoke,
  artillery: (target) => engine.artillery(state, target),
  retry: () => {
    engine.retry(state);
    sync();
  },
  advance: () => {
    engine.advance(state);
    sync();
  },
  save,
};
sync();
requestAnimationFrame(frame);
