const NAMES = {
  forest: "Focus the grove light",
  city: "Reconnect the power line",
  coast: "Bring the crew into harbor",
  fjord: "Read the echo beneath the ice",
  desert: "Find the true bearing",
  moon: "Help the garden take root",
};
const TIPS = {
  forest:
    "Turn the beam toward the marked angle, then focus. Each lock wakes another part of the grove.",
  city: "Choose a connector, turn it into place, then test the line. Connected cells carry the light onward.",
  coast:
    "Attach the towline, then move together toward the harbor. Signal to calm the water; release at the pier.",
  fjord:
    "Choose a channel and listen for its return. Catch the matching echo while the signal is clear.",
  desert:
    "Read the wind, turn your compass, and align with the true bearing. Wind changes the route.",
  moon: "Follow the garden’s changing needs. Water, roots and light must arrive in the order shown.",
};
const SYMBOLS = {
  water: "≈",
  root: "⋮",
  light: "☼",
  low: "▁",
  mid: "▃",
  high: "▆",
};
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setText(node, text) {
  const value = String(text ?? "");
  if (node.textContent !== value) node.textContent = value;
}
function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function wrapAngle(value) {
  return ((number(value) % 360) + 360) % 360;
}
function labelKey(key) {
  return (
    {
      ArrowLeft: "←",
      ArrowRight: "→",
      ArrowUp: "↑",
      ArrowDown: "↓",
      " ": "space",
      Enter: "enter",
    }[key] ?? key
  );
}
function keyMatches(key, candidate) {
  if (!candidate) return false;
  return (
    key.toLowerCase() === String(candidate).toLowerCase() ||
    labelKey(key) === String(candidate).toLowerCase()
  );
}
/** Compact operation controls. All state changes go through the campaign callbacks. */
export function createInteractionUI({ getState, onAction, onCancel }) {
  if (
    typeof getState !== "function" ||
    typeof onAction !== "function" ||
    typeof onCancel !== "function"
  ) {
    throw new TypeError(
      "Interaction UI requires getState, onAction and onCancel callbacks.",
    );
  }
  const aside = document.querySelector("aside");
  if (!aside)
    throw new Error("Afterlight interaction UI needs the adventure sidebar.");
  const panel = element("section", "operation-panel");
  panel.id = "operation-panel";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("aria-labelledby", "operation-title");
  const top = element("div", "operation-top");
  const title = element("h3", "", "Operate the landmark");
  title.id = "operation-title";
  const cancel = element("button", "operation-cancel", "[ leave ]");
  cancel.type = "button";
  cancel.dataset.challengeCancel = "";
  cancel.setAttribute(
    "aria-label",
    "Leave operation without spending supplies",
  );
  top.append(title, cancel);
  const instruction = element("p", "operation-instruction");
  instruction.id = "operation-instruction";
  const instrument = element("div", "operation-instrument");
  instrument.setAttribute("role", "img");
  const readout = element("p", "operation-readout");
  const stage = element("div", "operation-stage");
  const progress = element("progress", "operation-progress");
  progress.max = 1;
  progress.setAttribute("aria-label", "Operation progress");
  const stepLabel = element("span", "operation-step");
  stage.append(progress, stepLabel);
  const choices = element("div", "operation-choices");
  const status = element("p", "operation-status");
  status.id = "operation-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const footnote = element(
    "p",
    "operation-footnote",
    "Supplies are spent only when the operation succeeds.",
  );
  panel.append(
    top,
    instruction,
    instrument,
    readout,
    stage,
    choices,
    status,
    footnote,
  );
  aside.insertBefore(panel, aside.querySelector(".context"));
  let lastId = null,
    choiceSignature = "",
    disposed = false;
  const buttons = new Map();

  function active() {
    const state = getState();
    return state?.challenge && !["ready", "lost", "won"].includes(state.phase)
      ? state.challenge
      : null;
  }
  function act(id) {
    if (!active() || getState().phase !== "playing") return;
    onAction(id);
    sync();
  }
  function leave() {
    if (!active()) return;
    onCancel();
    sync();
    document.querySelector("#arena")?.focus({ preventScroll: true });
  }
  cancel.addEventListener("click", leave);

  function angleInstrument(challenge) {
    const scale = challenge.type === "forest" ? 90 : 45;
    const angle = wrapAngle(number(challenge.angle) * scale);
    const target = wrapAngle(
      number(
        challenge.targets?.[number(challenge.step)],
        number(challenge.target) * (challenge.type === "forest" ? 3 : 7),
      ) * scale,
    );
    const revealed = challenge.type !== "desert" || Boolean(challenge.read);
    const ticks = element("div", "operation-dial");
    for (let i = 0; i < 24; i++) {
      const dot = element("span", "dial-dot", "·");
      dot.style.setProperty("--bearing", `${i * 15}deg`);
      ticks.append(dot);
    }
    const marker = element("span", "dial-target", "●");
    marker.style.setProperty("--bearing", `${target}deg`);
    const needle = element("span", "dial-needle", "•");
    needle.style.setProperty("--bearing", `${angle}deg`);
    if (revealed) ticks.append(marker);
    ticks.append(needle, element("span", "dial-center", "·"));
    instrument.append(ticks);
    setText(
      readout,
      revealed
        ? `bearing ${Math.round(angle)}° · target ${Math.round(target)}°`
        : `bearing ${Math.round(angle)}° · read the wind to reveal the target`,
    );
    instrument.setAttribute("aria-label", readout.textContent);
  }
  function cityInstrument(challenge) {
    const cells = challenge.cells ?? [];
    const grid = element("div", "operation-circuit");
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i],
        item = element("div", "circuit-cell");
      if (i === challenge.selected) item.classList.add("selected");
      if (cell.connected) item.classList.add("connected");
      const direction = wrapAngle(
        number(cell.rotation) * (number(cell.rotation) <= 3 ? 90 : 1),
      );
      const pipe = element("span", "circuit-pipe", "└");
      pipe.style.transform = `rotate(${direction}deg)`;
      item.append(
        pipe,
        element(
          "small",
          "",
          cell.connected
            ? "lit"
            : `${["N", "E", "S", "W"][number(cell.rotation)]} → ${["N", "E", "S", "W"][number(cell.target)]}`,
        ),
      );
      grid.append(item);
      if (i < cells.length - 1)
        grid.append(element("span", "circuit-link", "···"));
    }
    instrument.append(grid);
    const connected = cells.filter((cell) => cell.connected).length;
    setText(
      readout,
      `${connected} / ${cells.length || 3} connectors carry power`,
    );
    instrument.setAttribute("aria-label", readout.textContent);
  }
  function fjordInstrument(challenge) {
    const tracks = element("div", "operation-echoes");
    const channel = String(challenge.channel ?? challenge.selected ?? "");
    for (const [i, name] of ["low", "mid", "high"].entries()) {
      const row = element("div", "echo-track");
      if (channel === name || channel === String(i))
        row.classList.add("selected");
      row.append(element("span", "", name));
      const signal = element("span", "echo-signal");
      const value = number(challenge.value ?? challenge.progress);
      for (let j = 0; j < 24; j++)
        signal.append(
          element("i", "", Math.abs(Math.sin(j * 0.7 + i)) > 0.75 ? "•" : "·"),
        );
      signal.style.setProperty(
        "--signal",
        String(Math.max(0, Math.min(1, value))),
      );
      row.append(signal);
      tracks.append(row);
    }
    const gauge = element("div", "echo-window");
    const safe = element("span", "echo-safe");
    safe.style.left = `${number(challenge.window?.[0], 0.3) * 100}%`;
    safe.style.width = `${(number(challenge.window?.[1], 0.7) - number(challenge.window?.[0], 0.3)) * 100}%`;
    const cursor = element("span", "echo-cursor", "•");
    cursor.style.left = `${Math.max(0, Math.min(1, number(challenge.value))) * 100}%`;
    gauge.append(safe, cursor);
    instrument.append(tracks, gauge);
    setText(
      readout,
      challenge.locked
        ? "Echo held in the clear band · catch when ready"
        : challenge.mode === "returning"
          ? `return ${Math.round(number(challenge.value) * 100)}% · clear band 30–70%`
          : `channel ${channel || "not selected"} · choose, ping, listen`,
    );
    instrument.setAttribute("aria-label", readout.textContent);
  }
  function coastInstrument(challenge) {
    if (challenge.variant !== "escort") {
      const signals = element("div", "operation-growth operation-signals");
      (challenge.pattern ?? []).forEach((color, i) => {
        const signal = element("span", "garden-need");
        if (i === number(challenge.step)) signal.classList.add("selected");
        if (i < number(challenge.step)) signal.classList.add("complete");
        const light = element("b", "", "••");
        light.style.color =
          { amber: "#ebce8b", blue: "#89c8d2", white: "#e5e7d7" }[color] ??
          "inherit";
        signal.append(light, element("small", "", color));
        signals.append(signal);
      });
      instrument.append(signals);
      setText(
        readout,
        `Signal ${(challenge.pattern ?? [])[number(challenge.step)] ?? "complete"} to reconnect the harbor lamp.`,
      );
      instrument.setAttribute("aria-label", readout.textContent);
      return;
    }
    const escort = challenge.escort ?? {};
    const mode = challenge.mode ?? escort.phase ?? "attach";
    const lane = element("div", "operation-towline");
    lane.append(element("span", "tow-harbor", "pier"));
    const track = element("span", "tow-track", "····················");
    const boat = element("span", "tow-boat", "••");
    const amount = escort.tethered
      ? Math.max(
          0,
          Math.min(
            1,
            1 -
              number(escort.distance) /
                Math.max(1, number(escort.startDistance, 1)),
          ),
        )
      : 0;
    boat.style.left = `${Math.max(0, 90 - amount * 90)}%`;
    track.append(boat);
    lane.append(track);
    instrument.append(lane);
    setText(
      readout,
      `${mode} · ${["escort", "escorting"].includes(mode) ? "move with the crew toward the harbor" : challenge.hint || "keep the towline close"}`,
    );
    instrument.setAttribute(
      "aria-label",
      `Towline ${Math.round(amount * 100)} percent complete. ${readout.textContent}`,
    );
  }
  function moonInstrument(challenge) {
    const row = element("div", "operation-growth");
    const pattern = challenge.pattern ?? [];
    pattern.forEach((need, i) => {
      const text = typeof need === "object" ? (need.id ?? need.type) : need;
      const item = element("span", "garden-need");
      if (i < number(challenge.step)) item.classList.add("complete");
      if (i === number(challenge.step)) item.classList.add("selected");
      item.append(
        element("b", "", SYMBOLS[text] ?? "•"),
        element("small", "", text),
      );
      row.append(item);
    });
    instrument.append(row);
    const current = pattern[number(challenge.step)];
    setText(
      readout,
      current
        ? `The garden needs ${typeof current === "object" ? (current.id ?? current.type) : current}.`
        : "Follow the needs shown by the growing garden.",
    );
    instrument.setAttribute("aria-label", readout.textContent);
  }
  function drawInstrument(challenge) {
    instrument.replaceChildren();
    if (challenge.type === "forest" || challenge.type === "desert")
      angleInstrument(challenge);
    else if (challenge.type === "city") cityInstrument(challenge);
    else if (challenge.type === "fjord") fjordInstrument(challenge);
    else if (challenge.type === "coast") coastInstrument(challenge);
    else if (challenge.type === "moon") moonInstrument(challenge);
    else {
      setText(readout, challenge.hint ?? "Follow the landmark’s instructions.");
      instrument.setAttribute("aria-label", readout.textContent);
    }
  }
  function sync() {
    if (disposed) return;
    const state = getState(),
      challenge = active();
    panel.hidden = !challenge;
    document.body.classList.toggle("has-operation", Boolean(challenge));
    document.body.classList.toggle(
      "has-spatial-operation",
      challenge?.type === "coast" && challenge?.variant === "escort",
    );
    if (!challenge) {
      lastId = null;
      choiceSignature = "";
      return;
    }
    panel.dataset.challengeType = challenge.type;
    panel.dataset.challengePhase = challenge.phase ?? "active";
    setText(
      title,
      challenge.title ?? NAMES[challenge.type] ?? "Operate the landmark",
    );
    setText(
      instruction,
      challenge.hint ??
        TIPS[challenge.type] ??
        "Follow the signal and choose an action.",
    );
    const steps = Math.max(1, number(challenge.steps, 3));
    const step = Math.max(0, Math.min(steps, number(challenge.step)));
    progress.value = Math.max(
      0,
      Math.min(1, number(challenge.progress, step / steps)),
    );
    setText(
      stepLabel,
      challenge.type === "city"
        ? `${(challenge.cells ?? []).filter((cell) => cell.connected).length} / ${steps} aligned`
        : `${Math.min(step + 1, steps)} / ${steps}`,
    );
    setText(
      status,
      state.phase === "paused"
        ? "Operation paused. Resume when ready."
        : (challenge.feedback ??
            challenge.message ??
            challenge.status ??
            `${Math.round(progress.value * 100)}% complete`),
    );
    drawInstrument(challenge);
    const signature = JSON.stringify([
      challenge.id,
      challenge.choices,
      state.phase,
    ]);
    if (signature !== choiceSignature) {
      const focused = document.activeElement?.dataset?.challengeAction;
      choiceSignature = signature;
      choices.replaceChildren();
      buttons.clear();
      for (const choice of challenge.choices ?? []) {
        const button = element(
          "button",
          "operation-action",
          choice.label ?? choice.id,
        );
        button.type = "button";
        button.dataset.challengeAction = choice.id;
        button.disabled = Boolean(choice.disabled) || state.phase !== "playing";
        button.classList.toggle("selected", Boolean(choice.selected));
        if (choice.selected !== undefined)
          button.setAttribute("aria-pressed", String(Boolean(choice.selected)));
        if (choice.key) {
          const key = element("kbd", "", labelKey(choice.key));
          button.append(key);
        }
        button.addEventListener("click", () => act(choice.id));
        choices.append(button);
        buttons.set(choice.id, button);
      }
      if (focused && buttons.has(focused))
        buttons.get(focused).focus({ preventScroll: true });
    }
    cancel.disabled = state.phase !== "playing";
    if (lastId !== challenge.id) {
      lastId = challenge.id;
      panel.focus({ preventScroll: true });
    }
  }
  function keyboard(event) {
    const challenge = active();
    if (
      !challenge ||
      getState().phase !== "playing" ||
      document.querySelector("dialog[open]")
    )
      return;
    if (
      event.target.closest("button,input,select,textarea,a") &&
      (event.key === " " || event.key === "Enter")
    )
      return;
    const choice = (challenge.choices ?? []).find(
      (choice) => !choice.disabled && keyMatches(event.key, choice.key),
    );
    if (!choice) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    act(choice.id);
  }
  document.addEventListener("keydown", keyboard, true);
  sync();
  return {
    sync,
    destroy() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("keydown", keyboard, true);
      panel.remove();
      document.body.classList.remove("has-operation", "has-spatial-operation");
    },
  };
}
