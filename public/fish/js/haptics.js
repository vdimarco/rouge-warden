// The feel of the rod in your hand.
// Android (Chrome and friends): navigator.vibrate. It works only after the first finger lift on the page, a new call
// cancels the pattern that plays, and the motor has no strength control. So this module keeps priorities and a rate
// limit, and it turns the fight into pulse trains: the pulse rate tells you how hard the fish pulls.
// iPhone: there is no vibrate. Since iOS 26.5 only a real finger on an <input type="checkbox" switch> ticks, so the calls
// below are silent there; attachPad and attachCrank put hidden switches under the thumb instead.
// Everything is a safe no-op in node, when the browser cannot buzz, and when the player turns it off.

const TUNE = {
  TICK_MS: 8,           // one gear tooth: the shortest pulse a linear motor feels well
  MIN_PULSE: 6,         // ms: shorter "on" segments are not sent
  MAX_PER_SEC: 30,      // vibrate calls in any 1 s window, all kinds together
  CONT_PER_SEC: 26,     // what the continuous trains may use of that (leaves room for bites and strikes)
  CONT_GAP: 28,         // ms between two calls of the continuous trains
  TICK_GAP: 66,         // ms between ticks: a 10 ms pulse rings 20-50 ms more, so ~15/s is the most that stays crisp
  TICKS_PER_TURN: 4,    // gear ticks per crank turn
  WHIRR_EVERY: 130,     // ms: above 15 ticks/s the crank sends one light whirr burst this often instead
  WHIRR: [5, 28, 5, 28, 5, 28, 5],
  BUZZ_GAP: 50,         // ms: pulses closer than this blur into one continuous buzz
  BUZZ_MAX: 1500,       // ms: the longest continuous buzz (drag, whirr, top tension)
  BUZZ_REST: 450,       // ms of rest after a long buzz, so the hand does not go numb
  SNAP_QUIET: 600,      // ms of silence after the line snaps: the sudden loss of feel is the message
  TENSION_MIN: 0.06,    // below this the line is slack, and slack has no feel
  SLIP_MIN: 0.05,       // m/s: below this the drag holds
  SLIP_FULL: 2.5,       // m/s: the drag screams flat out
};

// A pattern may cut one of the same or a lower priority, never a higher one.
const PRIO = { tick: 0, tension: 1, drag: 2, bail: 3, bump: 3, splash: 3, load: 3, hookset: 4, thump: 5, land: 5, jolt: 6 };

const HAS_DOM = typeof window !== "undefined" && typeof document !== "undefined";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const sum = (p) => p.reduce((a, b) => a + b, 0);

function nav() { return typeof navigator !== "undefined" ? navigator : null; }
function readStore(k) { try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; } catch (e) { return null; } }
function writeStore(k, v) { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (e) { /* storage off */ } }

function detect() {
  const n = nav();
  if (!n) return "none";
  const ua = n.userAgent || "";
  // desktop Chrome has vibrate() too, but nothing to shake: only count it on a touch device
  if (typeof n.vibrate === "function" && ((n.maxTouchPoints || 0) > 0 || /Android/i.test(ua))) return "vibrate";
  // iPad has no Taptic Engine, so only an iPhone gets the switch trick
  const sw = typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype;
  return /iPhone|iPod/.test(ua) && sw ? "ios" : "none";
}
// Before Safari 26.5 a script click on a switch label still ticked (inside a gesture); after it, never
function legacyIOS() {
  const m = /Version\/(\d+)\.(\d+)/.exec((nav() || {}).userAgent || "");
  return !m || +m[1] < 26 || (+m[1] === 26 && +m[2] < 5);
}

const S = {
  kind: detect(),
  enabled: readStore("fish.haptics") !== "false",
  clock: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  gesture: false,        // a pointerup/touchend/key was seen (for browsers without navigator.userActivation)
  muteUntil: 0,
  busyUntil: 0, busyPrio: -1, playingUntil: 0,
  calls: [], lastCont: -1e9, lastTick: -1e9,
  train: "", trainLast: -1e9, jit: 1,
  crankT: -1, crankPhase: 0.5, whirrLast: -1e9,
  buzzStart: -1e9, buzzEnd: -1e9, restUntil: 0,
  seed: 0x2f6b1d3,
  legacy: null, legacyLast: -1e9,
  pads: [],
};

// Sticky activation comes from the first finger lift (not touchstart), a mouse press, or a key
if (HAS_DOM && typeof window.addEventListener === "function") {
  const seen = () => { S.gesture = true; };
  for (const t of ["pointerup", "touchend", "mousedown", "keydown"]) window.addEventListener(t, seen, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") resetTrains(); });
}

// a tiny seeded random, so the jitter is the same in every test run
function rnd() { S.seed = (S.seed * 1664525 + 1013904223) >>> 0; return S.seed / 4294967296; }

function activated() {
  const ua = (nav() || {}).userActivation;
  if (ua && typeof ua.hasBeenActive === "boolean") return ua.hasBeenActive;
  return S.gesture;
}
function hidden() { return typeof document !== "undefined" && document.visibilityState === "hidden"; }
function canBuzz() { return S.kind === "vibrate" && S.enabled && activated() && !hidden(); }
function vib(p) {
  try { return nav().vibrate(p) !== false; } catch (e) { return false; }
}
function prune(t) { while (S.calls.length && t - S.calls[0] >= 1000) S.calls.shift(); }

// the one place that makes the motor run
function emit(pattern, prio, cont = false) {
  if (S.kind === "ios") { if (!cont) legacyTick(prio); return false; }
  if (!canBuzz()) return false;
  const t = S.clock();
  if (t < S.muteUntil) return false;
  if (t < S.busyUntil && prio < S.busyPrio) return false;
  prune(t);
  if (S.calls.length >= (cont ? TUNE.CONT_PER_SEC : TUNE.MAX_PER_SEC)) return false;
  if (cont && t - S.lastCont < TUNE.CONT_GAP) return false;
  // [on, off, on ...]: keep it short (the spec allows 10 entries) and odd, since Chrome drops a trailing pause
  const p = pattern.slice(0, 9).map((v, i) => (i % 2 ? Math.max(1, Math.round(v)) : Math.max(TUNE.MIN_PULSE, Math.round(v))));
  if (!vib(p)) return false;
  S.calls.push(t);
  if (cont) S.lastCont = t;
  const len = sum(p);
  S.playingUntil = t + len;
  S.busyUntil = t + len + (prio === PRIO.jolt ? TUNE.SNAP_QUIET : 0);
  S.busyPrio = prio;
  // pulses closer than BUZZ_GAP feel like one long buzz: remember where this buzz began
  if (t - S.buzzEnd > TUNE.BUZZ_GAP) S.buzzStart = t;
  S.buzzEnd = Math.max(S.buzzEnd, t + len);
  return true;
}
// continuous trains may not stretch one buzz past BUZZ_MAX; then they rest
function buzzRoom(t, len) {
  if (t < S.restUntil) return false;
  if (t - S.buzzEnd <= TUNE.BUZZ_GAP && t + len - S.buzzStart > TUNE.BUZZ_MAX) {
    S.restUntil = t + TUNE.BUZZ_REST;
    return false;
  }
  return true;
}
function cancel() {
  const t = S.clock();
  if (S.kind === "vibrate" && S.playingUntil > t && activated() && !hidden()) { vib(0); S.calls.push(t); }
  S.playingUntil = 0; S.busyUntil = 0; S.busyPrio = -1;
}
function resetTrains() {
  S.train = ""; S.trainLast = -1e9; S.crankT = -1; S.crankPhase = 0.5; S.whirrLast = -1e9;
}
function tickPulse(cont) {
  const t = S.clock();
  if (t - S.lastTick < TUNE.TICK_GAP) return false;
  if (cont && !buzzRoom(t, TUNE.TICK_MS)) return false;
  if (!emit([TUNE.TICK_MS], PRIO.tick, cont)) return false;
  S.lastTick = t;
  return true;
}

// iOS before 26.5 only: a script click on a hidden switch label ticks, if it runs inside a real gesture.
// Harmless (and silent) on newer iOS, so it is kept as a best effort for the one-shot events.
function legacyTick(prio) {
  if (!S.enabled || !HAS_DOM || prio < PRIO.bail || !legacyIOS()) return;
  const t = S.clock();
  if (t - S.legacyLast < 90) return;
  S.legacyLast = t;
  try {
    const label = legacyRig(), sw = label.control, prev = document.activeElement;
    label.click();
    // some engines focus a clicked label's checkbox: give the focus back, so nothing scrolls or steals the keys
    if (sw && document.activeElement === sw) { sw.blur(); if (prev && prev !== document.body && prev.focus) prev.focus({ preventScroll: true }); }
  } catch (e) { /* ignore */ }
}
function legacyRig() {
  if (S.legacy) return S.legacy;
  const sw = document.createElement("input");
  sw.type = "checkbox"; sw.setAttribute("switch", ""); sw.id = "fishHxLegacy";
  sw.setAttribute("aria-hidden", "true");                    // no tabindex: it must never take focus
  const label = document.createElement("label");
  label.htmlFor = sw.id; label.setAttribute("aria-hidden", "true");
  for (const el of [sw, label]) {
    el.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;margin:0;opacity:0;pointer-events:none;";
    el.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(el);
  }
  S.legacy = label;
  return label;
}

/* ---------- iPhone: switches under the thumb ---------- */
function makeSwitch() {
  const sw = document.createElement("input");
  sw.type = "checkbox";
  sw.setAttribute("switch", "");
  sw.setAttribute("aria-hidden", "true");                     // never a tabindex: a focusable switch can scroll the page
  sw.className = "hx-switch";
  // the game reads the pointer events that bubble up from the switch; only its own click/change stay inside
  for (const t of ["click", "input", "change"]) sw.addEventListener(t, (e) => e.stopPropagation());
  return sw;
}
const SWITCH_CSS = "position:absolute;margin:0;padding:0;border:0;opacity:0;touch-action:none;box-sizing:border-box;" +
  "-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;";
function syncPads() { for (const p of S.pads) p.el.style.pointerEvents = S.enabled ? "auto" : "none"; }
function watchSize(el, fn) {
  let ro = null;
  if (typeof ResizeObserver === "function") { ro = new ResizeObserver(fn); ro.observe(el); }
  window.addEventListener("resize", fn);
  return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", fn); };
}

export const Haptics = {
  get kind() { return S.kind; },
  get enabled() { return S.enabled; },
  set enabled(b) { this.setEnabled(b); },
  setEnabled(b) {
    S.enabled = !!b;
    writeStore("fish.haptics", JSON.stringify(S.enabled));
    if (!S.enabled) this.stop();
    syncPads();
  },
  // call inside the first user gesture
  unlock() {
    S.gesture = true;
    if (S.kind === "ios" && HAS_DOM && legacyIOS()) legacyRig();
  },

  tick() { return tickPulse(false); },
  // open: true = the bail flips open, false = it snaps shut; left out = a click-clack that fits both
  bail(open) { return emit(open === true ? [18] : open === false ? [12, 40, 22] : [12, 36, 20], PRIO.bail); },
  bump(s) {
    s = clamp(num(s, 0.5), 0, 1);
    const w = 6 + 12 * s;
    return emit(s > 0.55 ? [w, 90, w * 0.6] : [w], PRIO.bump);
  },
  thump() { return emit([45, 25, 90], PRIO.thump); },
  hookset() { return emit([34], PRIO.hookset); },
  jolt() {
    // the snap cuts everything, then a hard silence
    resetTrains();
    const ok = emit([140], PRIO.jolt);
    if (ok) S.restUntil = S.clock() + 140 + TUNE.SNAP_QUIET;
    return ok;
  },
  land() { return emit([25, 70, 25, 70, 60], PRIO.land); },
  splash(s) {
    s = clamp(num(s, 0.5), 0, 1);
    const w = 10 + 22 * s;
    return emit(s > 0.7 ? [w, 40, w * 0.5] : [w], PRIO.splash);
  },
  load() { return emit([14], PRIO.load); },

  // Every frame during the fight. Tension is rate-coded: the pulse rate rises with the load (a cheap motor cannot
  // show strength, but everyone feels a rate). When the drag slips, a fast ratchet train takes over.
  setTension(frac, slip, on) {
    if (S.kind !== "vibrate") return;
    const t = S.clock();
    frac = clamp(num(frac), 0, 1);
    slip = Math.max(0, num(slip));
    const mode = !on || !S.enabled ? "" : slip > TUNE.SLIP_MIN ? "drag" : frac > TUNE.TENSION_MIN ? "tension" : "";
    if (mode !== S.train) { S.train = mode; S.trainLast = -1e9; S.jit = 1; }
    if (!mode || t < S.muteUntil) return;
    let every, pat, prio;
    if (mode === "drag") {
      const k = Math.pow(clamp(slip / TUNE.SLIP_FULL, 0, 1), 0.7);
      const gap = clamp((80 - 50 * k) * S.jit, 30, 80), w = 8 + 4 * k;
      // a fast ratchet sends two clicks per call, so it stays under the call limit and leaves room for bites
      if (gap < 45) { pat = [w, gap - w, w]; every = 2 * gap; } else { pat = [w]; every = gap; }
      prio = PRIO.drag;
    } else {
      const w = 6 + 18 * frac;
      const warn = frac > 0.85;                  // near the break: a double "creak" pulse, a little uneven
      every = (600 - 520 * Math.pow(frac, 1.5)) * (warn ? S.jit : 1);
      pat = warn ? [w, 30, w] : [w];
      prio = PRIO.tension;
    }
    if (t - S.trainLast < every) return;
    if (!buzzRoom(t, sum(pat))) return;
    if (emit(pat, prio, true)) {
      S.trainLast = t;
      S.jit = mode === "drag" ? 0.9 + 0.2 * rnd() : 0.8 + 0.4 * rnd();
    }
  },
  // Every frame while reeling: about 4 gear ticks per crank turn, at most ~15 a second. Faster than that, a light whirr.
  setCrank(revPerSec) {
    if (S.kind !== "vibrate") return;
    const t = S.clock();
    const dt = S.crankT < 0 ? 0 : clamp((t - S.crankT) / 1000, 0, 0.1);
    S.crankT = t;
    const rps = Math.max(0, num(revPerSec));
    if (rps < 0.05 || !S.enabled) { S.crankPhase = 0.5; return; }
    const rate = rps * TUNE.TICKS_PER_TURN;
    if (rate <= 1000 / TUNE.TICK_GAP) {
      S.crankPhase += rate * dt;
      if (S.crankPhase >= 1 && tickPulse(true)) S.crankPhase = Math.min(S.crankPhase - 1, 0.5);
    } else if (t - S.whirrLast >= TUNE.WHIRR_EVERY && buzzRoom(t, sum(TUNE.WHIRR)) && emit(TUNE.WHIRR, PRIO.tick, true)) {
      S.whirrLast = t;
    }
  },
  // cancel everything (pause, page hidden, back to the title)
  stop() { cancel(); resetTrains(); S.restUntil = 0; },
  // no vibration for ms: the motor shakes the gyro, so main.js mutes from the pin to the release. mute(0) unmutes.
  mute(ms) {
    ms = num(ms);
    if (ms <= 0) { S.muteUntil = 0; return; }
    const t = S.clock();
    S.muteUntil = t + ms;
    // a tick that is ending anyway may finish; anything longer stops now
    if (S.playingUntil - t > 30) cancel();
    resetTrains();
  },

  // iPhone only (null elsewhere): an invisible switch that fills el. A real finger lifting off a switch makes iOS
  // play its system tick, after a tap or a hold of any length. It stays unchecked at each touch, so a pinned thumb
  // does not flip it early (a flip mid-hold needs a slide of 40% of its width to the right).
  // The game still gets the pointer events: they bubble up from the switch. Nobody may preventDefault() them.
  attachPad(el, { onToggle } = {}) {
    if (S.kind !== "ios" || !HAS_DOM || !el) return null;
    const sw = makeSwitch();
    sw.style.cssText = SWITCH_CSS + "left:0;top:0;width:100%;height:100%;z-index:2;";
    sw.addEventListener("change", () => { if (onToggle) onToggle(sw.checked); });
    sw.addEventListener("touchstart", () => { if (sw.checked) sw.checked = false; }, { passive: true });
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(sw);
    const pad = { el: sw };
    S.pads.push(pad);
    syncPads();
    return {
      el: sw,
      dispose() { sw.remove(); S.pads = S.pads.filter((p) => p !== pad); },
    };
  },

  // iPhone only, EXPERIMENTAL (turn off with localStorage "fish.iosCrank" = "0"). A square switch on the crank hub.
  // While a finger drags on it, WebKit ticks each time the finger crosses the switch's centre line (no gesture check on
  // that path). After each crossing we turn the switch so the next crossing lies degPerTick further round: ~6 ticks a
  // turn. Angles come from toLocal, so it works when main.js turns #game with CSS. Returns { forceTick(), dispose() }.
  attachCrank(el, { toLocal = null, degPerTick = 60, onTick = null } = {}) {
    if (S.kind !== "ios" || !HAS_DOM || !el || readStore("fish.iosCrank") === "0") return null;
    // a round window, so only touches on the crank circle land on the switch (a turned square pokes out at the corners)
    const wrap = document.createElement("div");
    wrap.className = "hx-crank";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute;border-radius:50%;overflow:hidden;pointer-events:none;z-index:2;";
    const sw = makeSwitch();
    wrap.appendChild(sw);
    let theta = 0, pending = null, raf = 0, id = null, t0 = 0, lastPhi = 0, dir = 1, on = true;
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight, d = Math.min(w, h), s = Math.ceil(d * 1.42);
      return { w, h, d, s };
    };
    const place = () => {
      const { w, h, d, s } = size();
      wrap.style.left = (w - d) / 2 + "px"; wrap.style.top = (h - d) / 2 + "px";
      wrap.style.width = d + "px"; wrap.style.height = d + "px";
      sw.style.cssText = SWITCH_CSS + `left:${(d - s) / 2}px;top:${(d - s) / 2}px;width:${s}px;height:${s}px;` +
        `transform:rotate(${theta}deg);pointer-events:${S.enabled ? "auto" : "none"};`;
    };
    // turn it on the next frame, never inside WebKit's own handling of this touchmove
    const turnTo = (a) => {
      pending = ((a % 360) + 360) % 360;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending !== null) { theta = pending; pending = null; place(); } });
    };
    // the finger's angle round the hub, in el's own (unrotated) pixels; screen y points down, like CSS rotate()
    const angle = (touch) => {
      let x, y;
      if (toLocal) ({ x, y } = toLocal(touch.clientX, touch.clientY, el));
      else { const r = el.getBoundingClientRect(); x = touch.clientX - r.left; y = touch.clientY - r.top; }
      const { w, h } = size();
      return Math.atan2(y - h / 2, x - w / 2) * 180 / Math.PI;
    };
    const find = (list) => { for (const t of list) if (t.identifier === id) return t; return null; };
    const start = (e) => {
      if (e.targetTouches.length !== 1) return;
      const touch = e.targetTouches[0];
      id = touch.identifier; t0 = e.timeStamp;
      lastPhi = angle(touch);
      // checked + square: WebKit flips (and ticks) when the finger crosses the centre line. Face the finger now,
      // so both lines are 90 degrees away when tracking starts
      if (!sw.checked) sw.checked = true;
      on = true;
      theta = lastPhi; pending = null;
      place();
    };
    const move = (e) => {
      const touch = find(e.targetTouches || []);
      if (!touch) return;
      const phi = angle(touch);
      let d = phi - lastPhi;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      if (Math.abs(d) > 0.5) dir = d > 0 ? 1 : -1;
      lastPhi = phi;
      if (e.timeStamp - t0 < 200) return;           // WebKit starts to track the finger 200 ms after touchstart
      const side = Math.cos((phi - theta) * Math.PI / 180) >= 0;
      if (side === on) return;
      on = side;                                     // WebKit ticks on this same touchmove
      if (onTick) onTick();
      turnTo(phi + dir * degPerTick - dir * 90 + (side ? 0 : 180));
    };
    const end = (e) => { if (!find(e.targetTouches || [])) id = null; };
    sw.addEventListener("touchstart", start, { passive: true });
    sw.addEventListener("touchmove", move, { passive: true });
    sw.addEventListener("touchend", end, { passive: true });
    sw.addEventListener("touchcancel", end, { passive: true });
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    place();
    el.appendChild(wrap);
    const unwatch = watchSize(el, place);
    const pad = { el: sw };
    S.pads.push(pad);
    return {
      el: sw,
      // a bite while the thumb is on the crank: flip the switch round, so the next touchmove ticks
      forceTick() { if (id !== null) turnTo((pending ?? theta) + 180); },
      dispose() {
        unwatch(); if (raf) cancelAnimationFrame(raf);
        wrap.remove(); S.pads = S.pads.filter((p) => p !== pad);
      },
    };
  },

  /* ---------- test hooks (not for the game) ---------- */
  _forcePlatform(kind) { S.kind = kind === "vibrate" || kind === "ios" ? kind : kind === "auto" ? detect() : "none"; resetTrains(); },
  _clock(fn) { S.clock = typeof fn === "function" ? fn : () => performance.now(); },
  _reset() {
    Object.assign(S, { gesture: false, muteUntil: 0, busyUntil: 0, busyPrio: -1, playingUntil: 0, calls: [], lastCont: -1e9, lastTick: -1e9,
      buzzStart: -1e9, buzzEnd: -1e9, restUntil: 0, seed: 0x2f6b1d3, legacyLast: -1e9 });
    resetTrains();
  },
  _tune: TUNE,
};
