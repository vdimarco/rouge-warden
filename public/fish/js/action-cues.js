// The corner card uses the guide's timed gestures, with a larger movement mark and
// one or two short visible words. The full prompt stays in the DOM for assistive
// technology and game diagnostics.
import { sceneMarkup, poseAt, LENGTH } from "./guide.js";
import { isCalm } from "./calm.js";

export function selectAction({ text = "", sub = "", icon = "", phase = "", step = "", fishPhase = "" }) {
  const words = `${text} ${sub}`;
  if (/motion sensors stopped/i.test(words)) return { kind: "tap", side: 0 };
  if (icon === "upright") return { kind: "upright", side: 0 };
  if (phase === "cast") {
    const kind = step === "flight" ? (/thumb slows|stop the lure|touch the rod|click the lake/i.test(words) ? "feather" : "flight") : step === "loaded" ? "cast" : step === "pinned" ? "back" : "hold";
    return { kind, side: 0 };
  }
  if (/nibbling|feel for the bite/i.test(words)) return { kind: "nibble", side: 0 };
  if (/tighten the drag/i.test(words)) return { kind: "drag", side: 0 };
  if (icon === "stop" || /stop reeling|let it (run|go)|stop for a moment|rest your arm/i.test(words)) return { kind: "stop", side: 0 };
  if (icon === "low") return { kind: "low", side: 0 };
  if (icon === "turn") return { kind: "turn", side: /\bright\b|hold D\b/i.test(words) ? 1 : /\bleft\b|hold A\b/i.test(words) ? -1 : 0 };
  if (fishPhase === "strike" || /set the hook/i.test(words)) return { kind: "hook", side: 0 };
  if (fishPhase === "land" || /lift it out|bring it to the wall/i.test(words)) return { kind: "land", side: 0 };
  if (/hold (the|your) rod up|keep (the|your) rod up|rod is too low/i.test(words)) return { kind: "raise", side: 0 };
  if (/pump and reel|tip back as you reel|holds on the bottom/i.test(words)) return { kind: "pump", side: 0 };
  if (icon === "pull") return { kind: "raise", side: 0 };
  if (icon === "thumb") return { kind: "hold", side: 0 };
  return { kind: "reel", side: 0 };
}

const KEY = { hold: "SPACE", back: "SPACE", cast: "SPACE", reel: "R", hook: "SPACE", pump: "W · S+R", low: "S", raise: "W", turn: "A · D", land: "W", drag: "+" };
const SPEED = { slow: .55, steady: 1, faster: 1.35, fast: 1.8 };
const LABEL = {
  hold: "HOLD", back: "BACK", cast: "FLICK", flight: "WATCH", feather: "TAP",
  upright: "UPRIGHT", tap: "TAP", reel: "REEL", nibble: "WAIT", hook: "SNAP!",
  pump: "PUMP", raise: "RAISE", low: "LOWER", turn: "TURN", stop: "PAUSE",
  drag: "TIGHTEN", land: "LIFT",
};

export function cueCaption(kind, side = 0, pace = "") {
  const detail = kind === "turn" ? side < 0 ? "LEFT" : side > 0 ? "RIGHT" : "SIDEWAYS"
    : kind === "reel" ? { slow: "SLOW", steady: "STEADY", faster: "FASTER", fast: "FAST" }[pace] || ""
    : { nibble: "FOR STRIKE", pump: "REEL", land: "HOLD", feather: "TO STOP", drag: "DRAG" }[kind] || "";
  return { label: LABEL[kind] || "REEL", detail };
}

function motionMark(kind, side) {
  if (["back", "low"].includes(kind)) return `<g class="cue-vector g-down"><path d="M104 17v38m-10-11 10 11 10-11"/></g>`;
  if (["cast", "hook", "raise", "land", "pump"].includes(kind)) return `<g class="cue-vector g-up"><path d="M104 61V24m-10 11 10-11 10 11"/></g>`;
  if (kind === "turn") {
    const right = `<path d="M85 41h42m-10-10 10 10-10 10"/>`;
    const left = `<path d="M37 41H9m10-10L9 41l10 10"/>`;
    return `<g class="cue-vector cue-lateral">${side < 0 ? left : side > 0 ? right : left + right}</g>`;
  }
  if (["hold", "tap", "feather"].includes(kind)) {
    const x = kind === "feather" ? 86 : 53, y = kind === "feather" ? 39 : 47;
    return `<g class="cue-halo g-tap"><circle cx="${x}" cy="${y}" r="15"/><circle cx="${x}" cy="${y}" r="22"/></g>`;
  }
  if (kind === "reel") return `<circle class="cue-reel-ring" cx="62" cy="41" r="31"/>`;
  return "";
}

export function createActionCue(prompt) {
  const art = prompt.querySelector(".cue-art");
  const caption = prompt.querySelector(".cue-caption");
  let kind = "", side = 0, parts = [], started = 0, speed = 1;

  function set({ text, sub, icon, tone, phase, step, fishPhase, input, pace = "" }) {
    const action = selectAction({ text, sub, icon, phase, step, fishPhase });
    kind = action.kind;
    side = action.side;
    started = performance.now() / 1000;
    speed = SPEED[pace] || (/reel slower/i.test(text) ? SPEED.slow : /reel fast/i.test(text) ? SPEED.fast : 1);
    prompt.dataset.action = kind;
    prompt.dataset.side = action.side < 0 ? "left" : action.side > 0 ? "right" : "either";
    prompt.dataset.pace = pace || "steady";
    const words = cueCaption(kind, action.side, pace);
    caption.querySelector("strong").textContent = words.label;
    caption.querySelector("span").textContent = words.detail;
    caption.querySelector("span").hidden = !words.detail;
    const markup = sceneMarkup(kind, input === "motion").replace("</svg>", `${motionMark(kind, action.side)}</svg>`);
    const key = input === "keys" ? KEY[kind] : "";
    const wheel = input === "mouse" && kind === "reel";
    const pointer = input === "mouse" && kind !== "reel";
    const bars = kind === "reel" && pace ? { slow: 1, steady: 2, faster: 3, fast: 4 }[pace] || 0 : 0;
    art.innerHTML = markup + (key ? `<b class="cue-key">${kind === "turn" && action.side ? action.side > 0 ? "D" : "A" : key}</b>` : "")
      + (wheel ? `<b class="cue-wheel" aria-hidden="true"><i></i></b>` : "")
      + (pointer ? `<b class="cue-pointer" aria-hidden="true"></b>` : "")
      + (bars ? `<b class="cue-speed" aria-hidden="true">${"<i></i>".repeat(bars)}</b>` : "")
      + (tone === "hot" ? `<b class="cue-urgent" aria-hidden="true"></b>` : "");
    parts = Object.keys(poseAt(kind, 0)).flatMap(cls => [...art.querySelectorAll("." + cls)].map(el => [el, cls]));
    update(started);
  }

  function update(t) {
    if (prompt.hidden || !kind) return;
    const calm = isCalm(), clock = calm ? 1.3 : (t - started) * speed;
    const pose = poseAt(kind, clock);
    if (kind === "turn" && side && pose["g-steer"]) {
      const pulse = calm ? 1 : (1 - Math.cos(2 * Math.PI * (clock % LENGTH) / LENGTH)) / 2;
      pose["g-steer"] = { transform: `rotate(${(side * (8 + 16 * pulse)).toFixed(3)} 53 70)` };
    }
    for (const [el, cls] of parts) for (const [name, value] of Object.entries(pose[cls])) el.setAttribute(name, value);
  }

  return { set, update };
}
