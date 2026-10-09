import * as engine from "./action-engine.js";
import { createDepthRenderer } from "./depth-render.js";
const $ = (id) => document.getElementById(id),
  text = (id, value) => {
    const node = $(id);
    if (node.textContent !== String(value)) node.textContent = value;
  },
  storageKey = "afterlight.action.v1";
const preference = matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = preference.matches,
  sound = false,
  loaded = false,
  state = engine.createActionGame(),
  art,
  scene,
  game,
  lastSaved = 0,
  lastPhase = "",
  visualTime = 0,
  accumulator = 0,
  lastMessage = "",
  overlayPhase = "";
try {
  const saved = engine.restoreAction(localStorage.getItem(storageKey));
  if (saved) {
    state = saved;
    loaded = true;
  }
} catch {}
const keys = new Set(),
  pad = new Set();
let pointerFire = false,
  buttonFire = false,
  pointerAim = null;
const focus = () => $("action-arena").focus({ preventScroll: true });
function save() {
  try {
    localStorage.setItem(storageKey, engine.serializeAction(state));
    lastSaved = state.time;
  } catch {}
}
function clearInput() {
  keys.clear();
  pad.clear();
  pointerFire = buttonFire = false;
  pointerAim = null;
}
function input() {
  return {
    dx:
      Number(keys.has("d") || keys.has("arrowright") || pad.has("right")) -
      Number(keys.has("a") || keys.has("arrowleft") || pad.has("left")),
    dy:
      Number(keys.has("s") || keys.has("arrowdown") || pad.has("down")) -
      Number(keys.has("w") || keys.has("arrowup") || pad.has("up")),
    fire: keys.has(" ") || pointerFire || buttonFire,
    ...(pointerFire && pointerAim
      ? { aimX: pointerAim.x, aimY: pointerAim.y }
      : {}),
  };
}
let audio;
function tone(freq, duration = 0.08, volume = 0.035, type = "sine") {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(30, freq * 0.45),
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}
let lastSoundShot = 0,
  lastRescued = 0,
  lastHp = 100,
  lastKills = 0;
function feedback() {
  if (
    state.projectiles.some((p) => p.owner === "player") &&
    state.time - lastSoundShot > 0.22 &&
    input().fire
  ) {
    tone(520, 0.09, 0.018, "triangle");
    lastSoundShot = state.time;
  }
  if (state.rescued > lastRescued) {
    tone(880, 0.45, 0.055);
    lastRescued = state.rescued;
  }
  if (state.hp < lastHp - 1) {
    tone(100, 0.12, 0.025);
    lastHp = state.hp;
  }
  if (state.kills > lastKills) {
    tone(190, 0.12, 0.025, "triangle");
    lastKills = state.kills;
  }
}
function objective() {
  if (state.stage === "defend" && state.enemies.some((e) => e.elite))
    return "Defeat the guardian · dodge its attacks";
  if (state.stage === "defend")
    return "Defend the beacon · blast incoming shadows";
  if (state.stage === "restored") return "Rescue route open";
  const followers = state.survivors.filter(
    (s) => s.status === "following",
  ).length;
  const bound = state.survivors.filter(
    (s) => s.status === "stranded" && s.bound,
  ).length;
  return followers
    ? "Lead survivors to the golden beacon"
    : bound
      ? "Break violet tethers · free the survivors"
      : "Reach survivors · blast the shadows";
}
function sync() {
  const region = engine.ACTION_REGIONS[state.region];
  text("action-place", region.name);
  text("action-goal", objective());
  text(
    "action-progress",
    state.stage === "defend"
      ? `${state.defenseRemaining > 0 ? Math.ceil(state.defenseRemaining) + "s hold" : state.guardianDefeated ? "Route ready" : "Guardian remains"} · beacon ${Math.ceil(state.beacon.hp)}%`
      : `${state.rescued}/3 home · ${state.index + 1}/6 worlds`,
  );
  text("action-health", `Health ${Math.ceil(state.hp)}`);
  text(
    "action-heat",
    state.overheated
      ? "OVERHEATED · let it cool"
      : `Light heat ${Math.round((state.heat || 0) * 100)}%`,
  );
  $("action-heat").style.setProperty("--heat", `${(state.heat || 0) * 100}%`);
  $("action-pulse").disabled =
    state.phase !== "playing" || state.pulseCooldown > 0;
  const pulseLabel = $("action-pulse").querySelector("span:last-child");
  if (pulseLabel)
    pulseLabel.textContent =
      state.pulseCooldown > 0
        ? `${Math.ceil(state.pulseCooldown)}s`
        : "Pulse · E";
  $("action-health").style.setProperty("--health", `${state.hp}%`);
  text(
    "action-score",
    `${state.kills} shadows cleared${state.powerRemaining > 0 ? " · triple light active" : ""}`,
  );
  const nearest = state.survivors
    .filter((s) => s.status === "stranded")
    .sort(
      (a, b) =>
        Math.hypot(a.x - state.x, a.y - state.y) -
        Math.hypot(b.x - state.x, b.y - state.y),
    )[0];
  text(
    "action-tip",
    state.stage === "defend"
      ? state.enemies.some((e) => e.elite)
        ? "The guardian fans bolts, then charges. Dodge the violet warning."
        : "Protect the beacon. Violet lines warn of incoming attacks."
      : state.survivors.some((s) => s.status === "following")
        ? "They are following you. Head to the golden beacon."
        : nearest
          ? `Find ${nearest.name}. Survivors follow when you get close.`
          : "Light is returning to this world.",
  );
  $("action-fire").disabled = state.phase !== "playing";
  $("action-dodge").disabled =
    state.phase !== "playing" || state.dodge.cooldown > 0;
  const dodgeLabel = $("action-dodge").querySelector("span:last-child");
  const dodgeText = state.dodge.cooldown > 0 ? "Recovering" : "Dodge";
  if (dodgeLabel.textContent !== dodgeText) dodgeLabel.textContent = dodgeText;
  $("action-dodge").title =
    state.dodge.cooldown > 0 ? "Dodge is recovering" : "Dodge · Shift";
  text("action-pause", state.phase === "paused" ? "Resume" : "Pause");
  $("action-pause").disabled = !["playing", "paused"].includes(state.phase);
  if (state.message !== lastMessage) {
    lastMessage = state.message;
    text(
      "action-message",
      /^\d\/3 survivors home/.test(state.message || "")
        ? ""
        : state.message || "",
    );
  }
  const overlay = $("action-overlay");
  overlay.hidden = state.phase === "playing";
  const begin = $("action-begin"),
    restart = $("action-restart");
  restart.hidden = !["paused", "lost", "won"].includes(state.phase);
  if (state.phase === overlayPhase) return;
  overlayPhase = state.phase;
  if (state.phase === "ready") {
    text("action-title", loaded ? "The rescue continues." : "Bring them home.");
    text(
      "action-description",
      "Break the violet tethers. Lead survivors to the beacon. Defeat its guardian to open the route.",
    );
    text(
      "action-overlay-hint",
      "WASD moves · aim + click or Space fires · Shift dodges · E pulses. Pace your shots to avoid overheating.",
    );
    begin.textContent = loaded ? "Continue rescue" : "Start rescue";
  } else if (state.phase === "paused") {
    text("action-title", "Take a breath.");
    text("action-description", "Your rescue is paused. The world will wait.");
    begin.textContent = "Resume";
    text("action-overlay-hint", "Press P or Escape to return.");
  } else if (state.phase === "lost") {
    text("action-title", "A light worth keeping.");
    text(
      "action-description",
      "Try this rescue again. Your completed worlds are safe.",
    );
    begin.textContent = "Retry this world";
    text(
      "action-overlay-hint",
      "Dodge the violet warnings. Hold Space to keep firing.",
    );
  } else if (state.phase === "region-complete") {
    text("action-title", "Three lives. A world relit.");
    text(
      "action-description",
      `${region.name} is safe. Follow the rescue route into the next world.`,
    );
    begin.textContent = "Go to next world";
    text(
      "action-overlay-hint",
      `${state.completed.length}/6 worlds restored. Watch the light spread.`,
    );
  } else if (state.phase === "won") {
    text("action-title", "Everyone made it home.");
    text(
      "action-description",
      "Eighteen survivors. Six worlds alive with light. You opened the whole rescue route.",
    );
    begin.textContent = "Play again";
    text("action-overlay-hint", "A new rescue starts with a fresh world.");
  }
}
function start() {
  clearInput();
  if (state.phase === "ready") engine.startAction(state);
  else if (state.phase === "paused") engine.resumeAction(state);
  else if (state.phase === "lost") {
    engine.retryAction(state);
    engine.startAction(state);
  } else if (state.phase === "region-complete") {
    engine.advanceAction(state);
    engine.startAction(state);
  } else if (state.phase === "won") restart();
  lastRescued = state.rescued;
  lastHp = state.hp;
  lastKills = state.kills;
  sync();
  save();
  focus();
}
function restart() {
  state = engine.createActionGame(Date.now() >>> 0);
  loaded = false;
  lastRescued = lastKills = 0;
  lastHp = 100;
  engine.startAction(state);
  clearInput();
  sync();
  save();
  focus();
}
function pause() {
  if (state.phase === "playing") {
    engine.pauseAction(state);
    clearInput();
    sync();
    save();
  }
}
function resume() {
  if (state.phase === "paused") {
    engine.resumeAction(state);
    clearInput();
    sync();
    focus();
  }
}
function togglePause() {
  state.phase === "paused" ? resume() : pause();
}
function dodge() {
  if (state.phase === "playing") {
    const i = input();
    engine.dodgeAction(state, i.dx, i.dy);
    tone(240, 0.16, 0.025, "triangle");
    sync();
    focus();
  }
}
function resize() {
  art?.resize(innerWidth, innerHeight);
}
const labelNodes = new Map();
function worldGuidance() {
  if (!art) return;
  const items = [
    {
      id: "you",
      x: state.x,
      y: state.y,
      height: 6,
      text: "YOU",
      color: "#ffe4a3",
    },
    {
      id: "beacon",
      x: state.beacon.x,
      y: state.beacon.y,
      height: 28,
      text: "BEACON",
      color: "#ffd573",
    },
    ...state.survivors
      .filter((s) => s.status !== "safe")
      .map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        height: 6,
        text: s.bound
          ? "BREAK TETHER"
          : s.status === "following"
            ? "FOLLOWING"
            : "HELP",
        color: s.bound ? "#dc9fff" : "#ffc79b",
      })),
    ...state.enemies
      .filter((e) => e.elite)
      .map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        height: 10,
        text: `GUARDIAN ${Math.ceil(e.hp)}/${e.maxHp}`,
        color: "#d49aff",
      })),
  ];
  const active = new Set();
  for (const item of items) {
    active.add(item.id);
    let node = labelNodes.get(item.id);
    if (!node) {
      node = document.createElement("span");
      node.className = "depth-label";
      $("action-world-labels").append(node);
      labelNodes.set(item.id, node);
    }
    const point = art.project(item.x, item.y, item.height);
    node.hidden = !point.visible || state.phase === "ready";
    node.textContent = item.text;
    node.style.left = point.x + "px";
    node.style.top = point.y + "px";
    node.style.color = item.color;
  }
  for (const [id, node] of labelNodes)
    if (!active.has(id)) {
      node.remove();
      labelNodes.delete(id);
    }
  const radar = $("action-radar"),
    ctx = radar.getContext("2d");
  ctx.clearRect(0, 0, 200, 100);
  ctx.fillStyle = "#021913d0";
  ctx.fillRect(0, 0, 200, 100);
  ctx.strokeStyle = "#57998b";
  ctx.strokeRect(1, 1, 198, 98);
  const dot = (x, y, c, r = 3) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const e of state.enemies)
    dot(e.x, e.y, e.elite ? "#bb6dff" : "#8666ac", e.elite ? 4 : 2);
  for (const s of state.survivors)
    if (s.status !== "safe") dot(s.x, s.y, s.bound ? "#c786ff" : "#ffb98a");
  dot(state.beacon.x, state.beacon.y, "#ffd575", 5);
  dot(state.x, state.y, "#fff2b8", 4);
}
function renderWorld() {
  art?.render(state, visualTime);
  worldGuidance();
  sync();
}
let previousFrame = 0;
function frame(now) {
  const dt = Math.min(previousFrame ? (now - previousFrame) / 1000 : 0, 0.08);
  previousFrame = now;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    engine.updateAction(state, input(), 1 / 60);
    accumulator -= 1 / 60;
  }
  if (!["paused", "lost"].includes(state.phase)) visualTime += dt;
  feedback();
  renderWorld();
  if (lastPhase !== state.phase) {
    lastPhase = state.phase;
    save();
  }
  if (state.phase === "playing" && state.time - lastSaved > 3) save();
  requestAnimationFrame(frame);
}
$("action-begin").onclick = start;
$("action-restart").onclick = restart;
$("action-pause").onclick = togglePause;
$("action-dodge").onclick = dodge;
$("action-pulse").onclick = () => {
  if (engine.pulseAction?.(state)) {
    tone(160, 0.3, 0.045);
    sync();
    focus();
  }
};
for (const b of document.querySelectorAll("[data-move]")) {
  b.addEventListener("pointerdown", (e) => {
    if (state.phase !== "playing") return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    pad.add(b.dataset.move);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(event, () => pad.delete(b.dataset.move));
}
$("action-fire").addEventListener("pointerdown", (e) => {
  if (state.phase !== "playing") return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  buttonFire = true;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("action-fire").addEventListener(event, () => {
    buttonFire = false;
    focus();
  });
$("action-motion").onclick = () => {
  reducedMotion = !reducedMotion;
  art?.setReducedMotion?.(reducedMotion);
  text("action-motion", reducedMotion ? "Motion reduced" : "Motion full");
  $("action-motion").setAttribute("aria-pressed", String(reducedMotion));
};
text("action-motion", reducedMotion ? "Motion reduced" : "Motion full");
$("action-sound").onclick = () => {
  sound = !sound;
  text("action-sound", sound ? "Sound on" : "Sound off");
  $("action-sound").setAttribute("aria-pressed", String(sound));
  if (sound) tone(660, 0.15, 0.025);
};
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (
    e.target instanceof HTMLButtonElement &&
    ![" ", "shift", "p", "escape"].includes(k)
  )
    return;
  if (
    [" ", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift"].includes(
      k,
    )
  )
    e.preventDefault();
  if (e.repeat) return;
  if (k === "p" || k === "escape") {
    togglePause();
    return;
  }
  if (k === "enter" && state.phase !== "playing") {
    start();
    return;
  }
  if (k === "e") {
    engine.pulseAction?.(state);
    sync();
    return;
  }
  if (k === "shift") {
    dodge();
    return;
  }
  keys.add(k);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", pause);
addEventListener("pagehide", pause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
document.querySelector("[data-switch]")?.addEventListener("click", pause);
preference.addEventListener("change", (e) => {
  reducedMotion = e.matches;
  art?.setReducedMotion?.(reducedMotion);
  text("action-motion", reducedMotion ? "Motion reduced" : "Motion full");
});
try {
  art = createDepthRenderer($("action-scene"), { reducedMotion });
  art.canvas.id = "action-canvas";
  game = { renderer: art, scene: { isActive: () => true } };
  resize();
  const point = (e) => art.aim(e.clientX, e.clientY, state);
  art.canvas.addEventListener("pointerdown", (e) => {
    if (state.phase !== "playing") return;
    e.preventDefault();
    art.canvas.setPointerCapture(e.pointerId);
    pointerFire = true;
    pointerAim = point(e);
    focus();
  });
  art.canvas.addEventListener("pointermove", (e) => {
    if (pointerFire) pointerAim = point(e);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    art.canvas.addEventListener(ev, () => {
      pointerFire = false;
      pointerAim = null;
    });
  addEventListener("resize", resize);
  requestAnimationFrame(frame);
} catch (error) {
  text("action-title", "3D could not start.");
  text(
    "action-description",
    "Enable WebGL in your browser or open Classic to keep playing.",
  );
  text("action-overlay-hint", String(error.message || error));
  $("action-begin").disabled = true;
}
window.__afterlightAction = {
  get state() {
    return state;
  },
  get game() {
    return game;
  },
  get renderer() {
    return art;
  },
  engine,
  render() {
    renderWorld();
    sync();
  },
  start,
  pause,
  resume,
  retry() {
    engine.retryAction(state);
    sync();
  },
  advance() {
    engine.advanceAction(state);
    sync();
  },
  save,
  get reducedMotion() {
    return reducedMotion;
  },
};
