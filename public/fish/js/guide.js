// Small motion lessons, driven by the existing game clock. Each scene can be
// scrubbed with seek(t), including during frame-by-frame video export.
const KEY = "reel-it-in-guide-v1";
export const INTRO = ["hold", "back", "cast", "reel", "hook", "pump", "land"];
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

export function lesson(kind, motion, touch = true) {
  return ({
    hold: ["Hold the reel", "Press and keep your thumb down."],
    back: [motion ? "Tip the phone back" : "Drag down", "Keep your thumb on the reel."],
    cast: [motion ? "Flick forward. Lift thumb." : "Flick up. Let go.", motion ? "Keep a firm grip on the phone." : "Release during the flick."],
    flight: ["Your lure is flying", "Touch the reel to stop it short."],
    reel: ["Turn the crank", "Reel slowly. Pause now and then."],
    hook: [motion ? "Snap the phone up" : touch ? "Swipe rod pad up" : "Press Space", "Set the hook when the fish strikes."],
    pump: ["Lift. Lower + reel.", "Reel as you lower the rod."],
    strength: ["Tip back as you reel", "Bring the top of the phone toward you for extra reel power."],
    stop: ["Stop turning the crank", "Let the fish run."],
    low: [motion ? "Lower the phone" : "Drag the rod pad down", "Lower the rod."],
    turn: [motion ? "Tilt to steer" : "Drag the rod pad sideways", "Keep the fish clear of cover."],
    land: [motion ? "Lift the phone. Hold." : "Rod pad up. Hold.", "Lift the fish out of the water."],
    raise: [motion ? "Hold the phone up" : "Hold the rod pad up", "Keep the rod raised."],
    drag: ["Tap + to tighten drag", "Keep some line on the spool."],
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

export function createGuide(game, button) {
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
  let dismissed = false;
  try { dismissed = localStorage.getItem(KEY) === "hidden"; } catch (_) { /* storage may be disabled */ }
  let state = null, key = "", started = 0, lastDraw = -Infinity, layoutKey = "", nextLayout = 0, kindNow = "hold", parts = [];
  let videoMode = "", videoFailed = false, playPending = false;
  video.addEventListener("error", () => { videoFailed = true; });
  let lastPhase = "", lastStep = "", now = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let buttonState = "";
  const title = () => {
    const next = `${dismissed}:${panel.hidden}`;
    if (next === buttonState) return;
    buttonState = next;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    button.setAttribute("aria-label", dismissed ? "Show animated guide" : panel.hidden ? "Guide hidden while screen is busy" : "Hide animated guide");
  };
  button.addEventListener("click", () => {
    dismissed = !dismissed;
    try { localStorage.setItem(KEY, dismissed ? "hidden" : "shown"); } catch (_) { /* storage may be disabled */ }
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
      .map(id => game.querySelector("#" + id)).filter(el => el && el.getClientRects().length && (el.id !== "toast" || el.classList.contains("on"))).map(rect);
    // Stay in the lake and on the left. A short landscape screen can use the
    // space immediately beside the gauge; the controls keep their hit areas.
    const xs = [10 + (parseFloat(getComputedStyle(game).getPropertyValue("--sal")) || 0)];
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
    const pose = poseAt(kindNow, reduced.matches ? 1.3 : t);
    for (const [el, cls] of parts) for (const [name, value] of Object.entries(pose[cls])) el.setAttribute(name, value);
  }
  function update(s, t) {
    state = s; now = t;
    const visible = !s.paused && !document.body.dataset.screen && !document.hidden && ["cast", "reel"].includes(s.phase);
    if (!visible || dismissed) { if (!panel.hidden) panel.hidden = true; video.pause(); title(); return; }
    if (s.phase !== lastPhase || s.step !== lastStep) { started = t; lastPhase = s.phase; lastStep = s.step; }
    const intro = s.phase === "cast" && (s.step === "ready" || s.step === "open");
    const mode = s.motion ? "motion" : "touch";
    if (intro && videoMode !== mode) {
      videoMode = mode; videoFailed = false;
      video.src = new URL(`../clips/guide-${mode}.mp4`, import.meta.url).href;
    }
    const useVideo = intro && !reduced.matches && !videoFailed;
    video.hidden = !useVideo || video.readyState < 2; art.hidden = useVideo && video.readyState >= 2;
    if (useVideo && video.paused && !playPending) {
      playPending = true;
      video.play().catch(e => { if (e.name !== "AbortError") videoFailed = true; }).finally(() => { playPending = false; });
    }
    if (!useVideo) video.pause();
    const elapsed = useVideo && video.readyState >= 2 ? video.currentTime : Math.max(0, t - started);
    const index = intro ? reduced.matches ? 0 : Math.floor(elapsed / LENGTH) % INTRO.length : INTRO.indexOf(activeLesson(s));
    const kind = intro ? INTRO[index] : activeLesson(s);
    const nextKey = kind + ":" + s.motion + ":" + s.touch + ":" + intro + ":" + s.cue.text;
    if (nextKey !== key) {
      key = nextKey; lastDraw = -Infinity;
      kindNow = kind;
      art.innerHTML = sceneMarkup(kind, s.motion);
      const [label, detail] = lesson(kind, s.motion, s.touch);
      caption.textContent = label;
      panel.setAttribute("aria-label", (intro ? "Preview: " : "Now: ") + label + ". " + detail);
      panel.dataset.lesson = kind;
      panel.dataset.mode = s.motion ? "motion" : "touch";
      panel.dataset.tone = intro ? "" : s.cue.tone;
      panel.dataset.still = String(kind === "stop");
      kicker.textContent = intro ? "WATCH + TRY" : "YOUR MOVE";
      count.textContent = intro ? (index + 1) + " / " + INTRO.length : s.motion ? "MOTION" : "TOUCH";
      [...panel.querySelectorAll(".guide-track i")].forEach((el, i) => el.classList.toggle("on", i === index));
      panel.hidden = false;
      parts = Object.keys(poseAt(kind, 0)).flatMap(cls => [...art.querySelectorAll("." + cls)].map(el => [el, cls]));
      layoutKey = "";
    }
    const nextLayoutKey = [game.className, game.clientWidth, game.clientHeight, s.cue.text, game.querySelector("#report").hidden, game.querySelector("#toast").className].join(":");
    if (nextLayoutKey !== layoutKey || t >= nextLayout) {
      layoutKey = nextLayoutKey; nextLayout = t + .5; place();
    }
    if (!panel.hidden && t - lastDraw >= 1 / 30) {
      seek(intro ? elapsed % LENGTH : t - started); lastDraw = t;
    }
  }
  return { update, seek };
}
