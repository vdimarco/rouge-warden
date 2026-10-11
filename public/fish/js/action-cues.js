// The small action picture in the corner uses the same timed gestures as the moves guide.
// Keep the prompt's words in the DOM for assistive technology and game diagnostics; only
// the picture is visible during play.
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

export function createActionCue(prompt) {
  const art = prompt.querySelector(".cue-art");
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
    let markup = sceneMarkup(kind, input === "motion");
    if (kind === "turn" && action.side) {
      const arrow = action.side > 0
        ? `<path class="cue-dir" d="M104 70h25m-7-7 7 7-7 7"/>`
        : `<path class="cue-dir" d="M34 70H9m7-7-7 7 7 7"/>`;
      markup = markup.replace("</svg>", `${arrow}</svg>`);
    }
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
