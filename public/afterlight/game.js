import {
  createJourney,
  start,
  update,
  interact,
  useTool,
  travel,
  pause,
  resume,
  recover,
  getContext,
  getObjectives,
  serialize,
  restore,
  actionChallenge,
  cancelChallenge,
  terrainAt,
  dodge,
  isSpatialChallenge,
} from "./engine.js";
import { WORLDS } from "./worlds.js";
import { getMission } from "./missions.js";
import { createWorldRuntime } from "./phaser-world.js";
import { createInteractionUI } from "./interaction-ui.js";
const $ = (id) => document.getElementById(id),
  arena = $("arena"),
  motion = matchMedia("(prefers-reduced-motion: reduce)"),
  saveKey = "afterlight:journey:v1";
let state = createJourney(37),
  loaded = false,
  renderer = null,
  operationUI = null,
  lastDraw = 0,
  lastSave = 0,
  choiceSignature = "",
  modalKind = "",
  target = null,
  menuResume = false,
  missionSignature = "";
const pointers = new Map();
try {
  const raw = localStorage.getItem(saveKey);
  if (raw) {
    const saved = restore(raw);
    if (saved) {
      state = saved;
      if (!["lost", "won"].includes(state.phase)) state.phase = "ready";
      loaded = true;
    }
  }
} catch {}
function clearInputs() {
  pointers.clear();
  target = null;
  renderer?.clearDestination();
  document.querySelectorAll(".held").forEach((b) => b.classList.remove("held"));
}
function save() {
  try {
    localStorage.setItem(saveKey, serialize(state));
    $("saved").textContent = "journey saved";
  } catch {
    $("saved").textContent = "journey continues on this page";
  }
}
function focusArena() {
  arena.focus({ preventScroll: true });
}
function begin() {
  clearInputs();
  if (state.phase === "lost") recover(state);
  else if (state.phase === "won") state = createJourney(Date.now() >>> 0);
  start(state);
  loaded = false;
  sync();
  save();
  focusArena();
}
function togglePause() {
  if (state.phase === "playing") {
    pause(state);
    clearInputs();
  } else if (state.phase === "paused") resume(state);
  sync();
  save();
  focusArena();
}
function action(choice) {
  if (state.phase !== "playing") return;
  const pending = state.challenge;
  interact(state, choice);
  if (Boolean(pending) !== Boolean(state.challenge)) clearInputs();
  sync();
  save();
}
function operate(id) {
  const pending = state.challenge;
  actionChallenge(state, id);
  if (pending && !state.challenge) clearInputs();
  sync();
  save();
  renderer?.render();
}
function tool() {
  if (state.phase !== "playing") return;
  useTool(state);
  sync();
}
function objectiveText() {
  const items = getObjectives(state);
  if (typeof items === "string") return items;
  if (Array.isArray(items)) {
    const item =
      items.find(
        (x) =>
          typeof x === "object" &&
          !x.done &&
          (x.region === state.region || x.region === undefined),
      ) ??
      items.find((x) => typeof x === "object" && !x.done) ??
      items[0];
    return typeof item === "string"
      ? item
      : (item?.text ??
          item?.description ??
          item?.title ??
          "Explore landmarks and restore the network.");
  }
  return "Explore landmarks and restore the network.";
}
function setText(id, text) {
  const e = $(id);
  if (e.textContent !== String(text)) e.textContent = String(text);
}
function restorationCount() {
  return Object.values(state.worlds).filter(
    (w) => w.restored >= 1 || w.flags?.restored,
  ).length;
}
function sync() {
  operationUI?.sync();
  const mission = getMission(state);
  syncMission(mission);
  const world = WORLDS[state.region],
    ctx = getContext(state);
  setText("place", world.name);
  const ground = terrainAt(state),
    weather = state.environment?.weather || "";
  const surface = ground.kinds.length
    ? ground.kinds.join(" / ")
    : ["coast", "fjord"].includes(state.region)
      ? "open water"
      : "open ground";
  setText(
    "conditions",
    `${weather} · ${surface}${ground.friction < 0.9 ? " slows your pace" : ground.friction > 1.05 ? " carries you onward" : ""}`,
  );
  setText("chapter", world.name);
  setText("objective", mission.steps[0]?.label || mission.heading);
  setText(
    "vitals",
    `health ${Math.ceil(state.hull)} · energy ${Math.ceil(state.energy)}/${state.maxEnergy ?? 100}`,
  );
  setText(
    "supplies",
    Object.entries(state.inventory)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · "),
  );
  setText(
    "network",
    `${mission.rescued}/3 crews home · ${restorationCount()}/6 beacons`,
  );
  setText("message", state.message || "");
  setText("context-title", ctx?.title ?? "Along the way");
  setText(
    "context-text",
    ctx?.text ??
      "Explore the marked landmarks. Get close to interact. Rest at a camp when light or hull runs low.",
  );
  const signature = JSON.stringify([
    state.phase,
    ctx?.landmarkId,
    ctx?.choices,
  ]);
  if (signature !== choiceSignature) {
    choiceSignature = signature;
    $("choices").replaceChildren();
    for (const c of ctx?.choices ?? []) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.label;
      b.disabled = state.phase !== "playing" || Boolean(c.disabled);
      b.dataset.choice = c.id;
      b.addEventListener("click", () => action(c.id));
      $("choices").append(b);
    }
  }
  $("interact").disabled =
    state.phase !== "playing" || !(ctx?.choices ?? []).some((c) => !c.disabled);
  $("tool").disabled = state.phase !== "playing";
  $("guide").disabled = state.phase !== "playing" || !mission.steps[0]?.target;
  $("dodge").disabled =
    state.phase !== "playing" ||
    (state.dodge?.cooldown || 0) > 0 ||
    (state.challenge && !isSpatialChallenge(state));
  setText(
    "dodge",
    (state.dodge?.cooldown || 0) > 0
      ? "[ dodge recovering ]"
      : "[ dodge · Shift ]",
  );
  setText(
    "tool",
    `[ ${state.region === "fjord" && state.tools.sonar ? "sonar" : state.region === "desert" && state.tools.compass ? "compass" : ["moon", "city"].includes(state.region) ? "inspect" : "lantern"} · Space ]`,
  );
  $("tool").title = ctx?.toolHint ?? "Use the tool for this place";
  $("pause").disabled = ["ready", "won", "lost"].includes(state.phase);
  setText("pause", state.phase === "paused" ? "[ resume ]" : "[ pause ]");
  const intro = ["ready", "lost", "won"].includes(state.phase);
  $("intro").hidden = !intro;
  $("explore").hidden = state.phase !== "won";
  if (intro) {
    $("intro").querySelector("h1").textContent =
      state.phase === "won"
        ? "The rescue route is open."
        : state.phase === "lost"
          ? "Rest, then return."
          : "Afterlight";
    $("intro").querySelector("p").innerHTML =
      state.phase === "won"
        ? "All three crews are home.<br>Six beacons guide the rescue route again."
        : state.phase === "lost"
          ? "The expedition exhausted you.<br>Your restored places will remain."
          : "You are the rescue courier.<br>Three boat crews are stranded. Repair six beacons and bring them home.";
    setText(
      "begin",
      state.phase === "won"
        ? "[ begin a new journey ]"
        : state.phase === "lost"
          ? "[ recover at camp ]"
          : loaded
            ? "[ continue your journey ]"
            : "[ start the rescue ]",
    );
    setText(
      "save-hint",
      state.phase === "won"
        ? "Explore what changed, or begin again with different choices."
        : loaded
          ? "Your inventory, routes and restored places are remembered."
          : "First: collect the courier pack. Then catch fireflies to power the forest beacon.",
    );
  }
}
function syncMission(mission) {
  setText("mission-heading", mission.heading);
  setText("mission-summary", mission.summary);
  const signature = JSON.stringify([
    state.region,
    state.phase,
    mission.steps.map((t) => [t.id, t.label, t.reason, t.done]),
  ]);
  if (signature === missionSignature) return;
  missionSignature = signature;
  $("mission-steps").replaceChildren();
  for (const task of mission.steps.slice(0, 3)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mission = task.id;
    button.textContent = task.label;
    button.title = task.reason;
    if (task === mission.steps[0]) {
      const detail = document.createElement("small");
      detail.textContent = task.reason;
      button.append(detail);
    }
    button.disabled = state.phase !== "playing" || task.done;
    button.onclick = () =>
      guide(getMission(state).steps.find((current) => current.id === task.id));
    $("mission-steps").append(button);
  }
}
function guide(task = getMission(state).steps[0]) {
  if (state.phase !== "playing" || !task?.target) return;
  if (task.target.region !== state.region) {
    openMenu("map");
    return;
  }
  target = { x: task.target.x, y: task.target.y };
  renderer?.setDestination(target);
  focusArena();
}
function burst() {
  if (state.phase !== "playing") return;
  const steering = input();
  dodge(state, steering.dx, steering.dy);
  sync();
  renderer?.render();
  focusArena();
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function openMenu(kind) {
  if (["lost", "won"].includes(state.phase)) return;
  menuResume = state.phase === "playing" || state.phase === "paused";
  pause(state);
  clearInputs();
  modalKind = kind;
  save();
  $("menu-content").replaceChildren();
  setText(
    "menu-title",
    kind === "map" ? "Routes through the afterlight" : "Your journey",
  );
  if (kind === "map") {
    for (const [id, w] of Object.entries(WORLDS)) {
      const row = element("div", undefined, "route"),
        left = element("div");
      left.append(
        element("strong", w.name),
        element(
          "p",
          id === state.region
            ? "You are here."
            : state.unlocked.includes(id)
              ? "Route open · progress stays when you return."
              : "Restore earlier beacons to discover this passage.",
        ),
      );
      row.append(left);
      const b = element(
        "button",
        id === state.region
          ? "[ here ]"
          : state.unlocked.includes(id)
            ? "[ travel ]"
            : "[ uncharted ]",
      );
      b.dataset.travel = id;
      b.disabled = !state.unlocked.includes(id) || id === state.region;
      b.onclick = () => {
        resume(state);
        travel(state, id);
        closeMenu();
      };
      row.append(b);
      $("menu-content").append(row);
    }
  } else {
    const lead = element(
      "p",
      "Tools and supplies travel with you. Restoration changes the terrain, opens routes, and reveals what the next place needs.",
    );
    $("menu-content").append(lead);
    for (const [id, w] of Object.entries(WORLDS)) {
      const item = element("div", undefined, "journal-item");
      item.append(
        element("strong", w.name),
        element(
          "p",
          state.worlds[id]?.restored
            ? "Beacon restored · revisit to see the changed world."
            : state.unlocked.includes(id)
              ? "Open for exploration. Follow local landmarks and their requests."
              : "A route still to discover.",
        ),
      );
      $("menu-content").append(item);
    }
    const tools = element(
      "p",
      "Tools: " +
        Object.entries(state.tools)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(" · "),
    );
    $("menu-content").append(tools);
    for (const obj of getObjectives(state) ?? []) {
      if (typeof obj === "string") $("menu-content").append(element("p", obj));
      else if (obj && typeof obj === "object")
        $("menu-content").append(
          element("p", obj.text ?? obj.description ?? obj.title ?? ""),
        );
    }
    const fresh = element("button", "[ start a new journey ]");
    fresh.dataset.newJourney = "";
    fresh.onclick = () => {
      closeMenu(false);
      state = createJourney(Date.now() >>> 0);
      loaded = false;
      sync();
    };
    $("menu-content").append(fresh);
  }
  if (!$("menu").open) $("menu").showModal();
  sync();
}
function closeMenu(shouldResume = true) {
  $("menu").close();
  modalKind = "";
  if (shouldResume && menuResume) resume(state);
  clearInputs();
  sync();
  save();
  focusArena();
}
$("begin").onclick = begin;
$("explore").onclick = () => {
  state.phase = "paused";
  openMenu("map");
};
$("interact").onclick = () => action();
$("tool").onclick = tool;
$("guide").onclick = () => guide();
$("dodge").onclick = burst;
$("pause").onclick = togglePause;
$("map").onclick = () => openMenu("map");
$("journal").onclick = () => openMenu("journal");
$("close-menu").onclick = () => closeMenu();
$("menu").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeMenu();
});
for (const button of document.querySelectorAll("[data-direction]")) {
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, button.dataset.direction);
    button.classList.add("held");
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(ev, (e) => {
      pointers.delete(e.pointerId);
      button.classList.remove("held");
    });
}
addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (
    e.target.closest("button,a,input,select,textarea") &&
    ["enter", " "].includes(key)
  )
    return;
  if ($("menu").open) return;
  // The operation panel owns its declared shortcuts. Do not also trigger the
  // generic interact/tool action for the same key.
  if (
    state.challenge &&
    state.challenge.choices?.some(
      (c) =>
        String(c.key || "").toLowerCase() === (key === " " ? "space" : key),
    )
  )
    return;
  if (state.challenge && ["e", "enter", " "].includes(key)) {
    e.preventDefault();
    return;
  }
  if ([" ", "e", "p", "m", "j", "enter", "escape"].includes(key))
    e.preventDefault();
  if (!e.repeat) {
    if (key === "shift") {
      e.preventDefault();
      burst();
    } else if (key === "p" || key === "escape") togglePause();
    else if (key === "m") openMenu("map");
    else if (key === "j") openMenu("journal");
    else if (key === "e" || key === "enter") {
      if (state.phase === "ready") begin();
      else action();
    } else if (key === " ") tool();
  }
  target = null;
});
function suspend() {
  if (state.phase === "playing") pause(state);
  clearInputs();
  save();
  sync();
}
addEventListener("blur", suspend);
addEventListener("pagehide", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
});
document.querySelector("[data-switch]").addEventListener("click", suspend);
motion.addEventListener("change", () => {
  renderer.dispose();
  renderer = makeRuntime();
});
new ResizeObserver(() => renderer?.resize()).observe(arena);
function input() {
  const held = new Set(pointers.values());
  const engineInput = renderer?.movement() || { dx: 0, dy: 0 };
  let dx =
      Number(engineInput.dx > 0 || held.has("right")) -
      Number(engineInput.dx < 0 || held.has("left")),
    dy =
      Number(engineInput.dy > 0 || held.has("down")) -
      Number(engineInput.dy < 0 || held.has("up"));
  if (target && !dx && !dy) {
    dx = target.x - state.x;
    dy = target.y - state.y;
    if (Math.hypot(dx, dy) < 1) {
      target = null;
      dx = dy = 0;
    }
  }
  return { dx, dy };
}
function tick(dt, now) {
  update(state, input(), dt);
  if (now - lastDraw > 75) {
    sync();
    lastDraw = now;
  }
  if (state.phase === "playing" && now - lastSave > 1800) {
    save();
    lastSave = now;
  }
}
function makeRuntime() {
  return createWorldRuntime({
    parent: $("scene"),
    getState: () => state,
    step: tick,
    onDestination: (p) => {
      target = p;
      focusArena();
    },
    reducedMotion: motion.matches,
    getMission: () => getMission(state),
  });
}
operationUI = createInteractionUI({
  getState: () => state,
  onAction: operate,
  onCancel: () => {
    cancelChallenge(state);
    clearInputs();
    sync();
    save();
    focusArena();
  },
});
renderer = makeRuntime();
window.__afterlight = {
  get state() {
    return state;
  },
  start: begin,
  move: (dx, dy, dt) => {
    update(state, { dx, dy }, dt);
    sync();
    renderer.render(state, state.time);
  },
  interact: (choice) => action(choice),
  travel: (region) => {
    travel(state, region);
    sync();
    renderer.render(state, state.time);
  },
  useTool: tool,
  pause: () => {
    pause(state);
    clearInputs();
    sync();
  },
  resume: () => {
    resume(state);
    sync();
  },
  recover: () => {
    recover(state);
    start(state);
    sync();
  },
  render: () => {
    renderer.render(state, state.time);
    sync();
  },
  save,
  actionChallenge: operate,
  guide: () => guide(),
  dodge: burst,
  get mission() {
    return getMission(state);
  },
  cancelChallenge: () => {
    cancelChallenge(state);
    sync();
  },
  get game() {
    return renderer.game;
  },
};
sync();
renderer.render(state, state.time);
