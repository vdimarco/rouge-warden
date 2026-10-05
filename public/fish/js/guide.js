// Small motion lessons, driven by the existing game clock. Each scene can be
// scrubbed with seek(t), including during frame-by-frame video export.
import { isCalm } from "./calm.js";
const KEY = "reel-it-in-guide-v1";
// the preview on the cast screen (WATCH + TRY) and its clips: the cast moves only. The reel moves show live (YOUR MOVE)
// once the lure lands. After a change here, make the clips again with scripts/render-fish-guide.mjs
export const INTRO = ["hold", "back", "cast"];
export const LENGTH = 2.6;
const PHONE = `<rect x="36" y="9" width="34" height="61" rx="7" fill="#174a55" stroke="#f6efd9" stroke-width="2.5"/><rect x="41" y="17" width="24" height="40" rx="3" fill="#0a2933"/><path d="M48 13h10M49 64h8" stroke="#b9c9c4" stroke-width="2" stroke-linecap="round"/>`;
const HAND = `<path d="M38 65l-7-16q-3-8 2-9q3 0 6 7l3 6V43q0-6 5-6q5 0 5 6v5q13-4 18 5l-2 21H44Z" fill="#d6b796" stroke="#f6efd9" stroke-width="1.5"/>`;
const DOT = `<circle class="g-dot" cx="53" cy="47" r="7"/>`;
const UP = `<path class="g-trail" d="M89 65V16m-6 6 6-6 6 6"/>`;
const DOWN = `<path class="g-trail" d="M89 16V65m-6-6 6 6 6-6"/>`;
const CRANK = `<circle cx="62" cy="41" r="26" fill="#174a55" stroke="#f6efd9" stroke-width="2.5"/><circle cx="62" cy="41" r="17" fill="#0a2933" stroke="#658a8c"/><circle cx="62" cy="41" r="5" fill="#e8b64a"/><g class="g-crank"><path d="M62 41L82 23" stroke="#e8b64a" stroke-width="5" stroke-linecap="round"/><circle cx="82" cy="23" r="7" fill="#e0453a" stroke="#ffb0a8" stroke-width="2"/><circle cx="82" cy="23" r="11" fill="none" stroke="#f6efd9" stroke-width="2"/></g>`;
const PAD = `<rect x="32" y="8" width="43" height="65" rx="12" fill="#174a55" stroke="#b9c9c4" stroke-width="2"/><path d="M53 18v44M40 40h27" stroke="#e8b64a66" stroke-width="2"/>`;

export function sceneMarkup(kind, motion) {
  let body;
  if (kind === "strength") {
    body = `<circle cx="17" cy="23" r="9" fill="#d6b796"/><path d="M6 70V47q0-15 13-15q11 0 15 15l7 12h27" fill="none" stroke="#658a8c" stroke-width="9" stroke-linecap="round"/>
      <rect x="58" y="8" width="26" height="48" rx="5" fill="none" stroke="#658a8c" stroke-dasharray="3 4"/>
      <g class="g-strength-phone"><rect x="58" y="8" width="26" height="48" rx="5" fill="#174a55" stroke="#f6efd9" stroke-width="2"/><circle cx="71" cy="35" r="8" fill="#092229" stroke="#e8b64a"/><g class="g-strength-crank"><path d="M71 35l5-5" stroke="#e8b64a" stroke-width="2"/><circle cx="76" cy="30" r="3" fill="#ff7866"/></g><path d="M61 57l-5-13q-1-4 2-4l7 9 12-2 5 7-5 11H65Z" fill="#d6b796" stroke="#f6efd9"/></g>
      <path d="M72 4Q44-2 39 24m-2-8 2 8 8-4" fill="none" stroke="#e8b64a" stroke-width="2.5" stroke-linecap="round"/>
      <text x="94" y="30" font-size="8" font-family="sans-serif" fill="#f6efd9">REEL</text><text x="94" y="42" font-size="8" font-family="sans-serif" fill="#e8b64a">POWER</text><rect x="93" y="50" width="38" height="8" rx="3" fill="#174a55"/><g transform="translate(93 50)"><rect class="g-strength-bar" width="38" height="8" rx="3" fill="#e8b64a"/></g>`;
  } else if (kind === "drag") {
    body = `<rect x="20" y="23" width="98" height="36" rx="10" fill="#174a55" stroke="#b9c9c4" stroke-width="2"/><path d="M32 41h14M91 41h14M98 34v14" stroke="#e8b64a" stroke-width="3"/><text x="58" y="45" fill="#f6efd9" font-size="12" font-family="sans-serif">DRAG</text><circle cx="98" cy="41" r="17" fill="none" stroke="#e8b64a" stroke-width="2"/>`;
  } else if (kind === "reel" || kind === "stop") {
    body = CRANK + (kind === "stop" ? `<g class="g-pause"><rect x="105" y="26" width="6" height="24" rx="2"/><rect x="116" y="26" width="6" height="24" rx="2"/></g>` : `<path class="g-trail" d="M101 23q13 20-4 35m0-8v8h8"/>`);
  } else if (kind === "flight") {
    body = `<path d="M9 62q12-5 24 0t24 0t24 0t24 0t24 0" fill="none" stroke="#658a8c" stroke-width="2"/><path class="g-trail" d="M17 53Q62-9 107 53"/><g class="g-flight"><circle cx="17" cy="53" r="5" fill="#e8b64a"/><path d="M17 58v6q0 6 5 2" fill="none" stroke="#f6efd9" stroke-width="2"/></g>`;
  } else {
    const cls = { back: "g-back", cast: "g-flick", hook: "g-lift", pump: "g-pump", land: "g-lift", raise: "g-lift", low: "g-low", turn: "g-steer" }[kind] || "";
    if (motion) body = `<g class="g-phone ${cls}">${PHONE}${HAND}${kind === "hold" || kind === "back" ? `<g class="g-tap">${DOT}</g>` : ""}</g>`;
    else body = (kind === "hold" || kind === "back" || kind === "cast" ? PHONE : PAD) + `<g class="${kind === "back" || kind === "low" ? "g-down" : kind === "hold" || kind === "turn" ? "g-tap" : "g-up"}">${DOT}</g>`;
    if (kind === "back" || kind === "low") body += DOWN;
    if (["cast", "hook", "pump", "land"].includes(kind)) body += UP;
    if (kind === "turn") body += `<path class="g-trail" d="M86 41h36m-6-6 6 6-6 6M26 41H9m6-6-6 6 6 6"/>`;
    if (kind === "pump") body += `<circle cx="106" cy="49" r="14" fill="#174a55" stroke="#b9c9c4"/><g class="g-pump-reel"><path d="M106 49l9-9" stroke="#e8b64a" stroke-width="3"/><circle cx="115" cy="40" r="4" fill="#ff7866"/></g>`;
  }
  return `<svg viewBox="0 0 138 82" aria-hidden="true">${body}</svg>`;
}

// A frame is a pure function of time. Shared by the inline gestures and the
// encoded intro clips, so their timing and controls cannot drift apart.
export function poseAt(kind, time) {
  const p = ((time % LENGTH) + LENGTH) % LENGTH / LENGTH;
  const track = keys => {
    for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) {
      let v = Math.max(0, (p - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
      v = v * v * (3 - 2 * v);
      return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * v;
    }
    return keys[keys.length - 1][1];
  };
  const turn = (angle, x = 53, y = 70) => `rotate(${angle.toFixed(3)} ${x} ${y})`;
  const travel = n => `translate(0 ${n.toFixed(3)})`;
  const lift = track([[0, 24], [.15, 24], [.45, -18], [.72, -18], [1, 24]]);
  const flight = track([[0, 0], [.1, 0], [.75, 1], [1, 1]]);
  const strength = track([[0, 0], [.15, 0], [.5, 1], [.82, 1], [1, 0]]);
  return {
    "g-strength-phone": { transform: turn(-32 * strength, 71, 59) },
    "g-strength-crank": { transform: turn(p * 720, 71, 35) },
    "g-strength-bar": { transform: `scale(${strength.toFixed(3)} 1)` },
    "g-tap": { opacity: track([[0, .25], [.18, 1], [.7, 1], [.85, .25], [1, .25]]) },
    "g-down": { transform: travel(track([[0, -17], [.15, -17], [.55, 15], [.82, 15], [1, -17]])) },
    "g-up": { transform: travel(track([[0, 16], [.22, 16], [.43, -20], [.86, -20], [1, 16]])), opacity: track([[0, 1], [.7, 1], [.86, 0], [1, 0]]) },
    "g-back": { transform: turn(track([[0, 0], [.15, 0], [.5, 35], [.8, 35], [1, 0]])) },
    "g-flick": { transform: turn(track([[0, 35], [.22, 35], [.44, -28], [.78, -28], [1, 35]])) },
    "g-lift": { transform: turn(lift) }, "g-pump": { transform: turn(lift) },
    "g-low": { transform: turn(6 - lift) },
    "g-steer": { transform: turn(track([[0, -20], [.5, 20], [1, -20]])) },
    "g-crank": { transform: turn(kind === "stop" ? 0 : Math.min(1, p / .7) * 360, 62, 41) },
    "g-flight": { transform: `translate(${(flight * 90).toFixed(3)} ${(-Math.sin(flight * Math.PI) * 30).toFixed(3)})`, opacity: track([[0, 0], [.08, 1], [.8, 1], [.96, 0], [1, 0]]) },
    "g-pump-reel": { transform: turn(track([[0, 0], [.48, 0], [.95, 360], [1, 360]]), 106, 49) },
  };
}

export function sceneFrame(kind, motion, time) {
  const pose = poseAt(kind, time);
  return sceneMarkup(kind, motion).replace(/class="([^"]+)"/g, (all, classes) => {
    const attrs = Object.assign({}, ...classes.split(" ").map(c => pose[c] || {}));
    return all + Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
  });
}

// One set of words for each fight move and each input: the fight prompt (main.js), the guide caption (lesson below) and the
// rod cue (rod-cues.js) all read this, so a move is never written two ways at once. Inputs: motion (the phone is the rod),
// touch, and on a computer with no touch screen the mouse or the keys (the one the player used last); an input that is
// left out uses the touch words (the mouse drags the rod as a finger does).
// strength is the motion pump: tipping the phone back as you crank is what pulls the fish in.
export const MOVE_WORDS = {
  reel: { touch: "Turn the crank to reel.", keys: "Hold R to reel." },
  hook: { motion: "Snap it up!", touch: "Swipe it up!", mouse: "Drag the rod up fast!", keys: "Press Space!" },
  pump: { motion: "Tip back as you reel.", touch: "Drag the rod up. Reel as it comes down.", keys: "Hold W. Then hold S and R." },
  strength: { motion: "Tip back as you reel.", touch: "Drag the rod up. Reel as it comes down." },
  stop: { touch: "Stop reeling." },
  low: { motion: "Lower the phone.", touch: "Drag the rod down.", keys: "Hold S." },
  raise: { touch: "Hold the rod up.", keys: "Hold W to keep the rod up." },
  turn: { motion: "Tilt the phone left or right.", touch: "Drag the rod sideways.", keys: "Hold A or D." },
  land: { motion: "Lift the phone and hold.", touch: "Drag the rod up and hold.", keys: "Hold W." },
  drag: { touch: "Tap + to tighten the drag.", mouse: "Click + to tighten the drag.", keys: "Click + to tighten the drag." },
};
// the hold cast (Space, or a mouse button held still): the rod moves by itself, so the guide caption and the rod cue say to
// wait, then to let go
export const HOLD_WORDS = { back: "Keep holding", cast: "Let go in the green" };
// the way to steer when the side is known: "Tilt the phone right." / "Drag the rod left." / "Hold D."
export const STEER_WORDS = { motion: "Tilt the phone ", touch: "Drag the rod " };
const STEER_KEYS = { left: "Hold A.", right: "Hold D." };
// the crank as fast as the prompt says: the reel move's words when the prompt gives a pace (main.js fightCue passes it with
// the cue), so the guide caption and the rod cue say "Reel fast." together. With no pace the reel move is MOVE_WORDS.reel
export const REEL_PACE = { slow: "Reel slowly.", fast: "Reel fast.", faster: "Reel a little faster.", steady: "Reel steadily." };
// the input of a player: "motion", "touch", or on a computer desk: "mouse" or "keys" (main.js keeps the last one used)
export const inputOf = (motion, touch = true, desk = "keys") => (motion ? "motion" : touch ? "touch" : desk === "mouse" ? "mouse" : "keys");
// the words for a move. side: -1 left, 1 right, for the steer. pace: "slow" | "fast" | "faster" | "steady" for the reel
export function moveWords(kind, input = "touch", side = 0, pace = "") {
  if (kind === "turn" && side && input === "keys") return STEER_KEYS[side > 0 ? "right" : "left"];
  if (kind === "turn" && side) return (STEER_WORDS[input] || STEER_WORDS.touch) + (side > 0 ? "right." : "left.");
  if (kind === "reel" && REEL_PACE[pace]) return REEL_PACE[pace];
  const w = MOVE_WORDS[kind];
  return w ? w[input] || w.touch : "";
}

// hold: the hold cast (Space, or a mouse button held still). desk: the input on a computer, "mouse" or "keys"
export function lesson(kind, motion, touch = true, pace = "", hold = false, desk = "keys") {
  const w = (k) => moveWords(k, inputOf(motion, touch, desk), 0, pace);
  return ({
    hold: ["Hold the rod", "Press and keep your thumb down."],
    back: hold ? [HOLD_WORDS.back, "The rod tips back by itself."] : [motion ? "Tip the phone back" : "Drag down", "Keep your thumb on the rod."],
    cast: hold ? [HOLD_WORDS.cast, "The rod swings forward by itself."] : [motion ? "Flick forward. Lift thumb." : "Flick up. Let go.", motion ? "Keep a firm grip on the phone." : "Release during the flick."],
    flight: ["Your lure is flying", touch ? "Touch the rod to stop it short." : "Click the lake to stop it short."],
    reel: [w("reel"), "Reel slowly. Pause now and then."],
    hook: [w("hook"), "Set the hook when the fish strikes."],
    pump: [w("pump"), motion ? "Ease forward to rest." : "Pump the fish in."],
    strength: [w("strength"), "Bring the top of the phone toward you for extra reel power."],
    stop: [w("stop"), "Let the fish run."],
    low: [w("low"), "Lower the rod."],
    turn: [w("turn"), "Keep the fish clear of cover."],
    land: [w("land"), "Lift the fish out of the water."],
    raise: [w("raise"), "Keep the rod raised."],
    drag: [w("drag"), "Keep some line on the spool."],
  })[kind] || ["Watch the line", "Follow the prompt."];
}

// Use the same cue as the main prompt, including urgent fight instructions.
// This avoids teaching a pump or a crank while the game asks the player to stop.
export function activeLesson({ phase, step, fishPhase, cue, motion, pullAvailable }) {
  if (phase === "cast") return ({ pinned: "back", loaded: "cast", flight: "flight" })[step] || "hold";
  if (fishPhase === "strike") return "hook";
  if (fishPhase === "land") return "land";
  if (/Tighten the drag/i.test(cue.text + " " + cue.sub)) return "drag";
  if (cue.icon === "stop" || /Stop reeling|Let it run|Let it go|rests\.|Rest your arm|following|nibbling/i.test(cue.text + " " + cue.sub)) return "stop";
  if (cue.icon === "low") return "low";
  if (cue.icon === "turn") return "turn";
  if (motion && pullAvailable && fishPhase === "fight") return "strength";
  if (cue.icon === "crank") return "reel";
  if (/Hold the rod up|Keep your rod up|Keep the rod up/i.test(cue.text + " " + cue.sub)) return "raise";
  return fishPhase === "fight" ? "pump" : "reel";
}

// The guide shows on the cast and the reel. A new player sees it until the first fish is landed (caught() gives the fish
// landed), unless they turned it off; after that it stays off unless they turned it on. A tap on the button is the
// player's choice, kept in storage ("shown" or "hidden")
export function createGuide(game, button, { caught = () => 0 } = {}) {
  const panel = document.createElement("aside");
  panel.id = "fishGuide";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Animated fishing guide");
  panel.setAttribute("data-nopin", "");
  panel.innerHTML = `<div class="guide-heading"><span class="guide-kicker">WATCH + TRY</span><span class="guide-count"></span></div><div class="guide-art"></div><p class="guide-caption"></p><div class="guide-track" aria-hidden="true">${INTRO.map(() => "<i></i>").join("")}</div>`;
  game.append(panel);
  const art = panel.querySelector(".guide-art"), caption = panel.querySelector(".guide-caption");
  const video = document.createElement("video");
  video.muted = true; video.loop = true; video.playsInline = true;
  video.preload = "none"; video.setAttribute("aria-hidden", "true");
  video.className = "guide-video";
  art.before(video);
  const count = panel.querySelector(".guide-count"), kicker = panel.querySelector(".guide-kicker");
  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch (_) { /* storage may be disabled */ }
  if (choice !== "shown" && choice !== "hidden") choice = null;
  const off = () => (choice ? choice === "hidden" : caught() > 0);
  let dismissed = off();
  let state = null, key = "", started = 0, lastDraw = -Infinity, layoutKey = "", nextLayout = 0, kindNow = "hold", parts = [];
  let videoMode = "", videoFailed = false, playPending = false;
  video.addEventListener("error", () => { videoFailed = true; });
  let lastPhase = "", lastStep = "", now = 0;
  let buttonState = "";
  const title = () => {
    const next = `${dismissed}:${panel.hidden}`;
    if (next === buttonState) return;
    buttonState = next;
    // the button says what a tap does (the panel may be away a moment, on a screen with no room for it)
    const label = dismissed ? "Show the moves guide" : "Hide the moves guide";
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  button.addEventListener("click", () => {
    choice = dismissed ? "shown" : "hidden";
    dismissed = off();
    try { localStorage.setItem(KEY, choice); } catch (_) { /* storage may be disabled */ }
    started = now; key = ""; layoutKey = "";
    if (dismissed) { panel.hidden = true; video.pause(); }
    else if (video.readyState >= 1) video.currentTime = 0;
    title();
  });
  // Space on the guide button must not set the hook through the game's keys.
  button.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") e.stopPropagation(); });
  button.setAttribute("aria-controls", panel.id);

  const rect = el => {
    let x = 0, y = 0;
    for (let p = el; p && p !== game; p = p.offsetParent) { x += p.offsetLeft; y += p.offsetTop; }
    // The game's prompt/report use a translateX(-50%) layout.
    if (["prompt", "report", "toast"].includes(el.id)) x -= el.offsetWidth / 2;
    if (el.id === "report") y -= el.offsetHeight / 2;
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const overlaps = (a, b) => a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 6 && a.y + a.h + 6 > b.y;
  function place() {
    panel.hidden = false;
    const view = game.querySelector("#view"), W = game.clientWidth, H = game.clientHeight;
    const blocks = ["hud", "prompt", "report", "toast", "gaugeBox", "dragBar", "padBox", "crankBox", "reelBox", "pullStrength"]
      // (a toast counts while it fades out too, so the panel never slides under it)
      .map(id => game.querySelector("#" + id)).filter(el => el && el.getClientRects().length && (el.id !== "toast" || el.classList.contains("on") || +getComputedStyle(el).opacity > 0.05)).map(rect);
    // the touch cast rail and its words beside the finger, while it holds the line: the rail comes first, and the panel
    // goes small or away (its caption says what the prompt says then)
    for (const el of game.querySelectorAll("#castRail, #castRail span")) if (el.getClientRects().length) blocks.push(rect(el));
    // Stay in the lake and on the left. A short landscape screen can use the
    // space immediately beside the gauge; the controls keep their hit areas.
    // the left edge: the HUD's own inset, which is 10 px past the safe area
    const hud = game.querySelector("#hud");
    const xs = [hud && parseFloat(getComputedStyle(hud).paddingLeft) || 10];
    if (W > H * 1.15 && state.phase === "reel") xs.push(Math.min(W * .38, game.querySelector("#gaugeBox").offsetWidth + 24));
    let found = null;
    for (const compact of [false, true, "tiny"]) {
      panel.dataset.compact = String(compact);
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const bottom = Math.min(H, view.offsetHeight) - h - (compact === "tiny" ? 4 : 10);
      for (const x of xs) {
        for (let y = bottom; y >= 54; y -= 8) {
          const r = { x, y, w, h };
          if (x + w <= W - 8 && !blocks.some(b => overlaps(r, b))) { found = r; break; }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (found) { panel.style.left = found.x + "px"; panel.style.top = found.y + "px"; }
    else panel.hidden = true; // Keep every control usable on very small screens.
    title();
  }

  function seek(t) {
    const pose = poseAt(kindNow, isCalm() ? 1.3 : t);
    for (const [el, cls] of parts) for (const [name, value] of Object.entries(pose[cls])) el.setAttribute(name, value);
  }
  function update(s, t) {
    state = s; now = t;
    // the first fish landed turns off a guide the player never chose
    dismissed = off();
    const visible =!s.paused && !document.body.dataset.screen && !document.hidden && ["cast", "reel"].includes(s.phase);
    if (!visible || dismissed) { if (!panel.hidden) panel.hidden = true; video.pause(); title(); return; }
    if (s.phase !== lastPhase || s.step !== lastStep) { started = t; lastPhase = s.phase; lastStep = s.step; }
    const intro = s.phase === "cast" && (s.step === "ready" || s.step === "open");
    const mode = s.motion ? "motion" : "touch";
    if (intro && videoMode !== mode) {
      videoMode = mode; videoFailed = false;
      video.src = new URL(`../clips/guide-${mode}.mp4`, import.meta.url).href;
    }
    // calm effects (the setting, or the phone's reduced motion): a still pose, with no clip and no cycling steps. A computer
    // (the mouse or the keys) gets the still pose too: the touch clip shows a finger that drags
    const calm = isCalm(), still = calm || (!s.motion && !s.touch), input = inputOf(s.motion, s.touch, s.desk);
    const useVideo = intro && !still && !videoFailed;
    video.hidden = !useVideo || video.readyState < 2; art.hidden = useVideo && video.readyState >= 2;
    if (useVideo && video.paused && !playPending) {
      playPending = true;
      video.play().catch(e => { if (e.name !== "AbortError") videoFailed = true; }).finally(() => { playPending = false; });
    }
    if (!useVideo) video.pause();
    const elapsed = useVideo && video.readyState >= 2 ? video.currentTime : Math.max(0, t - started);
    const index = intro ? still ? 0 : Math.floor(elapsed / LENGTH) % INTRO.length : INTRO.indexOf(activeLesson(s));
    const kind = intro ? INTRO[index] : activeLesson(s);
    const nextKey = kind + ":" + input + ":" + !!s.hold + ":" + intro + ":" + s.cue.text + ":" + (s.cue.pace || "");
    if (nextKey !== key) {
      key = nextKey; lastDraw = -Infinity;
      kindNow = kind;
      art.innerHTML = sceneMarkup(kind, s.motion);
      const [label, detail] = lesson(kind, s.motion, s.touch, intro ? "" : s.cue.pace, !!s.hold, s.desk);
      caption.textContent = label;
      panel.setAttribute("aria-label", (intro ? "Preview: " : "Now: ") + label + ". " + detail);
      panel.dataset.lesson = kind;
      panel.dataset.mode = s.motion ? "motion" : "touch";
      panel.dataset.tone = intro ? "" : s.cue.tone;
      panel.dataset.still = String(kind === "stop");
      kicker.textContent = intro ? "WATCH + TRY" : "YOUR MOVE";
      count.textContent = intro ? (index + 1) + " / " + INTRO.length : { motion: "MOTION", touch: "TOUCH", mouse: "MOUSE", keys: "KEYS" }[input];
      [...panel.querySelectorAll(".guide-track i")].forEach((el, i) => el.classList.toggle("on", i === index));
      // the bars are the steps of the cast: a reel move (or the flight) has no step, so the bars hide
      panel.dataset.track = String(index >= 0);
      panel.hidden = false;
      parts = Object.keys(poseAt(kind, 0)).flatMap(cls => [...art.querySelectorAll("." + cls)].map(el => [el, cls]));
      layoutKey = "";
    }
    const rail = game.querySelector("#castRail");
    const nextLayoutKey = [game.className, game.clientWidth, game.clientHeight, s.cue.text, game.querySelector("#report").hidden, game.querySelector("#toast").className, rail ? rail.hidden + rail.style.left + rail.style.top : ""].join(":");
    if (nextLayoutKey !== layoutKey || t >= nextLayout) {
      layoutKey = nextLayoutKey; nextLayout = t + .5; place();
    }
    if (!panel.hidden && t - lastDraw >= 1 / 30) {
      seek(intro ? (still ? 1.3 : elapsed % LENGTH) : t - started); lastDraw = t;
    }
  }
  return { update, seek };
}
