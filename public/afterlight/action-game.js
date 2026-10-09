import * as engine from "./action-engine.js";
import { createActionArt } from "./action-art.js";
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
  return followers
    ? "Lead your survivors to the golden beacon"
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
      "Blast the shadows. Lead three survivors to the beacon. Defend it until the rescue route opens.",
    );
    text(
      "action-overlay-hint",
      "Move with WASD or arrows. Aim and hold click, or hold Space to fire at nearby shadows. Shift dodges.",
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
  if (!scene || !art) return;
  const w = Math.max(320, game.scale.width),
    h = Math.max(240, game.scale.height),
    rw = Math.min(w, 960),
    rh = Math.round((rw * h) / w);
  scene.textures.get("living-action").setSize(rw, rh);
  art.resize(rw, rh);
  scene.picture.setSize(rw, rh).setOrigin(0.5, 0.5);
  scene.picture.setDisplaySize(w, h);
  scene.picture.setPosition(w / 2, h / 2);
}
class ActionScene extends Phaser.Scene {
  constructor() {
    super("action");
  }
  create() {
    scene = this;
    this.game.canvas.id = "action-canvas";
    const texture = this.textures.createCanvas(
      "living-action",
      innerWidth,
      innerHeight,
    );
    art = createActionArt(texture.canvas, { reducedMotion });
    this.picture = this.add.image(
      innerWidth / 2,
      innerHeight / 2,
      "living-action",
    );
    this.scale.on("resize", resize);
    resize();
    const point = (p) => ({
      x: (p.x / this.scale.width) * 200,
      y: (p.y / this.scale.height) * 100,
    });
    this.input.on("pointerdown", (p) => {
      if (state.phase !== "playing") return;
      pointerFire = true;
      pointerAim = point(p);
      focus();
    });
    this.input.on("pointermove", (p) => {
      if (pointerFire) pointerAim = point(p);
    });
    this.input.on("pointerup", () => {
      pointerFire = false;
      pointerAim = null;
    });
    this.input.on("gameout", () => {
      pointerFire = false;
      pointerAim = null;
    });
    sync();
    this.renderWorld();
  }
  renderWorld() {
    if (!art) return;
    art.render(state, visualTime);
    const texture = this.textures.get("living-action");
    texture.refresh();
    Object.assign(this.game.canvas.dataset, texture.canvas.dataset, {
      engine: "Phaser 3.90.0",
      region: state.region,
      phase: state.phase,
    });
  }
  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.08);
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      engine.updateAction(state, input(), 1 / 60);
      accumulator -= 1 / 60;
    }
    if (!["paused", "lost"].includes(state.phase)) visualTime += dt;
    feedback();
    this.renderWorld();
    sync();
    if (lastPhase !== state.phase) {
      lastPhase = state.phase;
      save();
    }
    if (state.phase === "playing" && state.time - lastSaved > 3) save();
  }
}
$("action-begin").onclick = start;
$("action-restart").onclick = restart;
$("action-pause").onclick = togglePause;
$("action-dodge").onclick = dodge;
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
game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "action-scene",
  width: innerWidth,
  height: innerHeight,
  backgroundColor: "#030b14",
  banner: false,
  audio: { noAudio: true },
  render: { antialias: true },
  scale: { mode: Phaser.Scale.RESIZE },
  input: { keyboard: { capture: [] }, activePointers: 4 },
  scene: ActionScene,
  fps: { target: 60 },
});
window.__afterlightAction = {
  get state() {
    return state;
  },
  get game() {
    return game;
  },
  engine,
  render() {
    scene?.renderWorld();
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
