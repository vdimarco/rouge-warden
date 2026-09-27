// Reel It In: Loon Lake. The phone is the rod and the reel.
// This file runs the game: the title, the cast (phone upright), the reel (phone sideways), the catch, and the derby.
// The modules do the parts: motion.js reads the phone, reel.js is the reel you touch, cast.js flies the lure,
// fish.js runs the fish and the fight, world.js draws the lake, audio.js and haptics.js make the feel.
import { Motion } from "./motion.js";
import { Haptics } from "./haptics.js";
import { Sound } from "./audio.js";
import { createWorld } from "./world.js";
import { CAST, castParams, Flight } from "./cast.js";
import { Rises, LakeSim, rodTip } from "./fish.js";
import { ReelPanel, Crank, RodPad, Gauge } from "./reel.js";
import * as LAKE from "./lake.js";
import { SPECIES, JUNK, byId } from "./species.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => performance.now();
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has("debug");

/* ---------------- saving ---------------- */
const SAVE_KEY = "fish.v1";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
const blank = () => ({ v: 1, journal: {}, casts: 0, longest: 0, derbyBest: 0, biggest: null, input: null, assist: true, quality: "auto", seen: {}, caught: 0 });
let save = blank();
{
  const s = store.get(SAVE_KEY, null);
  if (s && typeof s === "object") for (const k of Object.keys(save)) if (k in s && typeof s[k] === typeof save[k]) save[k] = s[k];
  if (!save.journal || typeof save.journal !== "object" || Array.isArray(save.journal)) save.journal = {};
  if (!save.seen || typeof save.seen !== "object") save.seen = {};
  if (save.input !== "motion" && save.input !== "touch") save.input = null;
}
const persist = () => store.set(SAVE_KEY, save);

/* ---------------- state ---------------- */
const game = $("#game");
const touchDevice = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const G = {
  phase: "boot",    // boot | title | cast | turn | reel | catch | lost | results
  mode: "free",     // free | derby
  input: "touch",   // motion | touch
  paused: false,
  hour: 6.2,
  casts: 0, castsLeft: 10, bag: [],
  step: "ready",    // the cast: ready | open | pinned | loaded | flight | landed | ashore
  bail: "closed",
  pin: null,        // the finger that holds the line: { id, y0, theta }
  drop: 0,          // meters the lure slipped while the bail was open and nothing held the line
  openAt: 0, backMax: 90, whipT: 0,
  flight: null, cast: null, landing: null,
  sim: null, ring: null, drag: 1,
  aimYaw: 0,
  layout: "", rot: 0, vw: 0, vh: 0,
  turnTo: null, turnSince: 0, turnShown: 0,
  hookReq: false, lastHook: 0,
  tension: 0, lastEvent: {}, outcomeAt: 0,
  frame: 0, fps: 60, seed: 1, force: null,
  wide: false,
};
let world = null, rises = null, reelPanel = null, crank = null, rodPad = null, gauge = null, crankPad = null;

/* ---------------- icons for the prompts and the help ---------------- */
const PHONE = "<rect x='14' y='5' width='12' height='22' rx='2.5' fill='none' stroke='currentColor' stroke-width='2.4'/>";
const ICON = {
  bail: "<svg viewBox='0 0 40 40'><circle cx='20' cy='22' r='9' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M8 16 Q20 4 32 16' fill='none' stroke='#e8b64a' stroke-width='3' stroke-linecap='round'/><path d='M20 31 v6 m-3 -3 l3 3 l3 -3' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>",
  thumb: "<svg viewBox='0 0 40 40'><g transform='translate(0 4)'>" + PHONE + "</g><circle cx='20' cy='20' r='5' fill='#e0453a'/></svg>",
  back: "<svg viewBox='0 0 40 40'><g transform='rotate(35 20 30)'>" + PHONE + "</g><path d='M10 12 Q14 4 22 4' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M10 12 l-1 -5 m1 5 l5 -1' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/></svg>",
  flick: "<svg viewBox='0 0 40 40'><g transform='rotate(-30 20 30)'>" + PHONE + "</g><path d='M28 6 Q36 12 36 22' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M36 22 l-4 -3 m4 3 l2 -4' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M4 10 h6 M3 16 h5 M5 22 h4' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>",
  turn: "<svg viewBox='0 0 40 40'><rect x='5' y='13' width='30' height='16' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M12 8 Q20 2 28 8' fill='none' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/><path d='M28 8 l-4 0 m4 0 l0 -4' stroke='#e8b64a' stroke-width='2.4' stroke-linecap='round'/></svg>",
  crank: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='12' fill='none' stroke='currentColor' stroke-width='2' stroke-dasharray='3 3'/><circle cx='20' cy='20' r='3' fill='currentColor'/><path d='M20 20 L29 12' stroke='currentColor' stroke-width='3' stroke-linecap='round'/><circle cx='29' cy='12' r='4' fill='#e0453a'/></svg>",
  pull: "<svg viewBox='0 0 40 40'><g transform='rotate(-20 20 26)'><rect x='5' y='18' width='30' height='14' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/></g><path d='M20 14 V3 m-5 5 l5 -5 l5 5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  low: "<svg viewBox='0 0 40 40'><g transform='rotate(20 20 14)'><rect x='5' y='8' width='30' height='14' rx='3' fill='none' stroke='currentColor' stroke-width='2.4'/></g><path d='M20 26 V37 m-5 -5 l5 5 l5 -5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  stop: "<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='14' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M13 13 L27 27' stroke='#ff5a4a' stroke-width='3' stroke-linecap='round'/></svg>",
  fish: "<svg viewBox='0 0 40 40'><path d='M5 20 Q16 8 28 20 Q16 32 5 20 Z M28 20 L36 13 L36 27 Z' fill='#e8b64a'/><circle cx='11' cy='18' r='1.8' fill='#0d2f38'/></svg>",
  swipe: "<svg viewBox='0 0 40 40'><rect x='8' y='6' width='24' height='28' rx='3' fill='none' stroke='currentColor' stroke-width='2.2'/><path d='M20 12 V28 m-5 -5 l5 5 l5 -5' fill='none' stroke='#e8b64a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>",
};

/* ---------------- screens and messages ---------------- */
const SCREENS = ["title", "setup", "help", "journal", "settings", "pause", "catch", "results"];
let returnTo = null;
function show(id) {
  for (const s of SCREENS) $("#" + s).hidden = s !== id;
  const focus = id && $("#" + id + " .btn.go, #" + id + " button");
  if (focus && !touchDevice) focus.focus({ preventScroll: true });
}
function overlay(id) { returnTo = SCREENS.find((s) => !$("#" + s).hidden) || null; show(id); }
function closeOverlay() { show(returnTo); returnTo = null; }
for (const b of $$("[data-close]")) b.addEventListener("click", () => { Sound.sfx("uiBack"); closeOverlay(); });

let toastT = 0;
function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), ms);
}
let promptKey = "";
function prompt(text, sub = "", icon = "", tone = "") {
  const p = $("#prompt");
  if (!text) { p.hidden = true; promptKey = ""; return; }
  const key = text + "|" + sub + "|" + icon + "|" + tone;
  p.hidden = false;
  if (key === promptKey) return;
  promptKey = key;
  p.className = tone;
  p.querySelector(".p1").innerHTML = (ICON[icon] || "") + "<span></span>";
  p.querySelector(".p1 span").textContent = text;
  p.querySelector(".p2").textContent = sub;
}
function flash() { const f = $("#flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }
let reportT = 0;
function report(dist, verdict, zoneName, sweet) {
  const r = $("#report");
  r.hidden = false;
  r.querySelector(".dist").innerHTML = dist == null ? "" : dist.toFixed(1) + "<small> m</small>";
  const v = r.querySelector(".verdict");
  v.textContent = verdict;
  v.className = "verdict" + (sweet ? " sweet" : "");
  r.querySelector(".zone").textContent = zoneName || "";
  r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
  clearTimeout(reportT);
  reportT = setTimeout(() => { r.hidden = true; }, 2600);
}
const hideReport = () => { $("#report").hidden = true; };
const fmtKg = (kg) => (kg < 1 ? kg.toFixed(2) : kg.toFixed(1)) + " kg";
const fmtHour = (h) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return ((hh + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + (hh < 12 ? " AM" : " PM"); };

/* ---------------- layout and orientation ---------------- */
// The cast needs the phone upright, the reel needs it sideways. When the phone is sideways and the browser
// did not turn the page (rotation lock on), we turn #game ourselves so the reel still reads the right way up.
// the sensors drive the rod once the player chose motion and the phone sends data. A short gap in the samples
// (a slow frame) must not hand the rod to the touch fallback, or the pose would jump
const sensing = () => G.input === "motion" && (Motion.live || Motion.status === "granted");
let physLast = "portrait";
function physical() {
  if (sensing()) {
    const o = Motion.pose.orient;
    if (o === "portrait" || o === "landscape") physLast = o;
    return physLast;
  }
  return innerWidth > innerHeight ? "landscape" : "portrait";
}
function screenAngle() {
  let a = 0;
  if (screen.orientation && typeof screen.orientation.angle === "number") a = screen.orientation.angle;
  else if (typeof window.orientation === "number") a = window.orientation;
  a = ((a % 360) + 360) % 360;
  return a === 90 ? 90 : a === 270 ? -90 : a === 180 ? 180 : 0;
}
function wantedRotation() {
  if (!sensing() || !touchDevice) return 0;
  const phys = physical();
  const pa = phys === "landscape" ? (Motion.pose.side >= 0 ? 90 : -90) : 0;
  let r = pa - screenAngle();
  r = ((r + 540) % 360) - 180;
  return r === 90 || r === -90 ? r : 0;
}
function applyRotation(rot) {
  if (rot === G.rot) return;
  G.rot = rot;
  const W = innerWidth, H = innerHeight;
  if (rot) Object.assign(game.style, { width: H + "px", height: W + "px", left: (W - H) / 2 + "px", top: (H - W) / 2 + "px", transform: "rotate(" + rot + "deg)" });
  else Object.assign(game.style, { width: "", height: "", left: "", top: "", transform: "" });
  G.layout = "";
}
// client (screen) coordinates to the unrotated CSS pixels of el (or of #game)
function toLocal(cx, cy, el) {
  let x = cx, y = cy;
  if (G.rot) {
    const W = innerWidth, H = innerHeight, Lw = H, Lh = W, dx = cx - W / 2, dy = cy - H / 2;
    if (G.rot === 90) { x = dy + Lw / 2; y = Lh / 2 - dx; } else { x = Lw / 2 - dy; y = dx + Lh / 2; }
  }
  for (let e = el; e && e !== game && e !== document.body; e = e.offsetParent) { x -= e.offsetLeft; y -= e.offsetTop; }
  return { x, y };
}
function layoutFor(phase) {
  const Lw = game.clientWidth, Lh = game.clientHeight;
  G.wide = Lw > Lh * 1.15;
  if (phase === "cast" || (phase === "turn" && G.turnTo === "landscape")) return G.wide ? "wide-cast" : "tall-cast";
  if (phase === "reel" || phase === "lost" || (phase === "turn" && G.turnTo === "portrait")) return G.wide ? "reel" : "tall-reel";
  if (phase === "catch") return G.wide ? "reel" : "full";
  return "full";
}
function relayout(force) {
  applyRotation(wantedRotation());
  const L = layoutFor(G.phase);
  const flying = G.phase === "cast" && G.step === "flight";
  if (!force && L === G.layout && game.classList.contains("flying") === flying && G.vw === innerWidth && G.vh === innerHeight) return;
  G.vw = innerWidth; G.vh = innerHeight;
  G.layout = L;
  game.className = "l-" + L + (flying ? " flying" : "") + (G.input === "motion" ? " motion" : " touch");
  const inCast = L === "tall-cast" || L === "wide-cast";
  $("#castUI").hidden = !(inCast && (G.phase === "cast" || G.phase === "turn"));
  $("#reelUI").hidden = !((G.phase === "reel" || G.phase === "lost") && (L === "reel" || L === "tall-reel"));
  // the view keeps its size through the css transition; resize the drawing once it settles
  resizeView();
  setTimeout(resizeView, 380);
  if (reelPanel) reelPanel.resize();
  if (crank) crank.resize();
  if (rodPad) rodPad.resize && rodPad.resize();
  if (gauge) gauge.resize && gauge.resize();
}
function resizeView() {
  if (!world) return;
  const v = $("#view");
  world.resize(Math.max(1, v.clientWidth), Math.max(1, v.clientHeight));
}
addEventListener("resize", () => { G.layout = ""; relayout(true); });
if (screen.orientation) screen.orientation.addEventListener("change", () => { G.layout = ""; setTimeout(() => relayout(true), 60); });

/* ---------------- setup: motion or touch ---------------- */
function inputReady() { return G.input === "touch" || (G.input === "motion" && (Motion.status === "granted" || Motion.live)); }
async function chooseInput(then) {
  // desktop, or a browser with no motion sensors: touch and mouse
  if (!touchDevice || !Motion.available) { G.input = "touch"; then(); return; }
  if (save.input === "touch") { G.input = "touch"; then(); return; }
  if (save.input === "motion") {
    // a returning player: ask again inside this tap (iOS forgets between visits)
    const req = Motion.request();
    lockPortrait();
    const st = await req;
    if (st === "granted") { G.input = "motion"; then(); return; }
  }
  $("#setupNote").hidden = true;
  $("#useMotion").hidden = false;
  overlay("setup");
  setupThen = then;
}
let setupThen = null;
$("#useMotion").addEventListener("click", async () => {
  Sound.init(); Haptics.unlock();
  Sound.sfx("ui");
  const req = Motion.request();
  lockPortrait();
  const st = await req;
  if (st === "granted") {
    G.input = "motion"; save.input = "motion"; persist();
    show(null);
    const f = setupThen; setupThen = null; if (f) f();
    return;
  }
  const note = $("#setupNote");
  note.hidden = false;
  // "idle": the browser wants the question asked from a tap. Let them tap again
  if (st === "idle") { note.textContent = "Tap Use motion again."; return; }
  note.textContent = st === "denied"
    ? "The motion sensors are off for this page. On an iPhone, close Safari fully (swipe it away), then open this page again and tap Allow. On Android, allow Motion sensors in the site settings. You can play with touch now."
    : "This phone sends no motion data. You can play with touch.";
  $("#useMotion").hidden = true;
});
$("#useTouch").addEventListener("click", () => {
  Sound.init(); Haptics.unlock(); Sound.sfx("ui");
  G.input = "touch"; save.input = "touch"; persist();
  show(null);
  const f = setupThen; setupThen = null; if (f) f();
});

// Android: full screen with a portrait lock, so the browser never turns the page in the middle of a cast.
// The reel still reads sideways: we turn #game ourselves. iPhone has neither API and skips this.
function lockPortrait() {
  const el = document.documentElement;
  if (!touchDevice || !el.requestFullscreen || !screen.orientation || !screen.orientation.lock || document.fullscreenElement) return;
  try { el.requestFullscreen({ navigationUI: "hide" }).then(() => screen.orientation.lock("portrait")).catch(() => {}); } catch (e) { /* not allowed here */ }
}

/* ---------------- wake lock: the screen must not sleep while you wait for a bite ---------------- */
let wake = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && !wake && document.visibilityState === "visible") { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) { wake = null; }
}

/* ---------------- title ---------------- */
function toTitle() {
  G.phase = "title";
  G.sim = null; G.flight = null;
  $("#hud").hidden = true;
  $("#turn").hidden = true;
  prompt("");
  hideReport();
  if (world) { world.hideCatch(); world.setLure({ x: 0, y: -5, z: 0, visible: false }); world.setLine({ visible: false }); world.setFish(null); world.setFollower(null); world.setAim({ visible: false }); world.setRod({ theta: 70, yaw: 0, visible: false }); }
  Sound.stopLoops(); Haptics.stop();
  show("title");
  titleBest();
  relayout(true);
}
function titleBest() {
  const bits = [];
  if (save.derbyBest > 0) bits.push("Derby best " + fmtKg(save.derbyBest));
  if (save.biggest) { const sp = byId(save.biggest.id); if (sp) bits.push("Biggest: " + sp.name + " " + fmtKg(save.biggest.kg)); }
  if (save.longest > 0) bits.push("Longest cast " + save.longest.toFixed(1) + " m");
  $("#tbest").textContent = bits.join(" · ");
}
function begin(mode) {
  Sound.init(); Haptics.unlock(); keepAwake();
  Sound.sfx("ui");
  chooseInput(() => startMode(mode));
}
$("#derbyBtn").addEventListener("click", () => begin("derby"));
$("#freeBtn").addEventListener("click", () => begin("free"));
$("#journalBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); renderJournal(); overlay("journal"); });
$("#helpBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); overlay("help"); });
$("#setBtn").addEventListener("click", () => { Sound.init(); Sound.sfx("ui"); syncSettings(); overlay("settings"); });

function startMode(mode) {
  G.mode = mode;
  G.casts = 0; G.castsLeft = mode === "derby" ? 10 : Infinity; G.bag = [];
  G.hour = mode === "derby" ? 18.3 : 6.2;
  G.seed = (Math.random() * 1e9) | 0;
  rises = new Rises(LAKE.rng(G.seed));
  G.paused = false;
  show(null);
  $("#hud").hidden = false;
  Sound.setAmbience(true, G.hour);
  newCast(true);
}

/* ---------------- the cast ---------------- */
function newCast(first) {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  G.sim = null; G.flight = null; G.cast = null; G.landing = null; G.ring = null;
  G.step = "ready"; G.bail = "closed"; G.pin = null; G.drop = 0; G.backMax = 90;
  G.aimYaw = 0; G.tension = 0;
  if (world) { world.hideCatch(); world.setFish(null); world.setFollower(null); }
  hideReport();
  Motion.mode = "portrait";
  Motion.recenter();
  if (G.input === "motion" && touchDevice && physical() !== "portrait") { goTurn("portrait", () => enterCast()); return; }
  enterCast();
}
function enterCast() {
  G.phase = "cast";
  Motion.mode = "portrait";
  Motion.recenter();
  $("#turn").hidden = true;
  show(null);
  relayout(true);
  updateHud();
}
function openBail(how) {
  if (G.bail === "open") return;
  G.bail = "open";
  G.openAt = now();
  Sound.sfx("bailOpen"); Haptics.bail(true);
  if (G.phase === "cast" && G.step === "ready") G.step = "open";
  seen("bail");
}
function closeBail() {
  if (G.bail === "closed") return;
  G.bail = "closed";
  Sound.sfx("bailClose"); Haptics.bail(false);
  if (G.phase === "cast") {
    if (G.step === "open" || G.step === "pinned" || G.step === "loaded") { G.step = "ready"; G.pin = null; }
    else if (G.step === "landed") afterLanding();
  }
}
function pinLine(e) {
  if (G.phase !== "cast") return;
  if (G.step === "flight") { G.pin = { id: e.id, y0: e.y, theta: 90, feather: true }; return; }
  if (G.bail !== "open" || G.pin) return;
  if (G.step !== "open") return;
  G.pin = { id: e.id, y0: e.y, theta: 90 };
  G.step = "pinned";
  G.backMax = Motion.pose.theta;
  G.drop = Math.min(G.drop, 1.2);
  Sound.sfx("pin"); Haptics.tick();
  // the motor shakes the gyro: keep still until the line is released
  if (G.input === "motion") { Motion.recenter(); Haptics.mute(4000); }
}
function unpinLine(e) {
  if (!G.pin || (e.id != null && G.pin.id != null && e.id !== G.pin.id)) return;
  const wasFeather = G.pin.feather;
  G.pin = null;
  if (wasFeather || G.phase !== "cast") return;
  Haptics.mute(0);
  if (G.step !== "pinned" && G.step !== "loaded") return;
  // the browser took the touch away (often the page turning mid-swing): a fumble, not a cast
  if (e.cancel) {
    G.step = "open"; G.openAt = now() - 1000;
    Sound.sfx("slip");
    toast(touchDevice ? "The screen turned and dropped your thumb. Turn on the rotation lock." : "The line slipped.", 3200);
    return;
  }
  // with sensors, the exact input time of the lift matters; with a finger, the finger's own clock is the rod's clock
  release(sensing() ? e.t || now() : now());
}
// the finger comes off the line: was it a cast, or did the line just slip?
function release(t) {
  const s = Motion.at(t);
  const pk = Motion.peak(t - 450, t);
  const fwd = Math.max(0, -pk.minOmega, -s.omega);
  G.lastRelease = { t, theta: s.theta, omega: s.omega, minOmega: pk.minOmega, maxTheta: pk.maxTheta, fwd };
  // hand tremor alone reaches 20 to 40 deg/s: a motion release needs a real swing
  const minSpeed = sensing() ? Math.max(150, CAST.MIN_STROKE_SPEED || 0) : (CAST.MIN_STROKE_SPEED || 150);
  if (fwd < minSpeed) {
    // no swing: the line slips off your finger and the lure drops
    G.step = "open";
    G.openAt = now() - 1000;
    Sound.sfx("slip");
    toast(G.input === "motion" ? "Keep your thumb down until you swing." : "Keep holding. Drag down, then flick up and let go.");
    return;
  }
  const params = castParams({ thetaRelease: s.theta, omegaPeak: fwd, thetaBack: Math.max(G.backMax, pk.maxTheta), yaw: G.input === "motion" ? clamp(s.yaw, -75, 75) : G.aimYaw, assist: save.assist });
  G.cast = params;
  // physics uses the real rod geometry; world.tip() is the drawn, camera-held rod
  G.flight = new Flight(rodTip(clamp(s.theta, -10, 170), params.yaw), params);
  G.step = "flight";
  G.casts++;
  if (G.mode === "derby") G.castsLeft--;
  save.casts++;
  Sound.sfx("release");
  seen("cast");
  updateHud();
  relayout();
}
const VERDICT = {
  sweet: "Sweet cast!", high: "Too high. Let go a little later.", low: "Too low. Let go a little sooner.",
  slam: "Too late. Let go sooner.", behind: "Way too early!", weak: "Whip it faster.",
};
function landed(r) {
  const dist = Math.hypot(r.x, r.z);
  G.step = r.land === "water" ? "landed" : "ashore";
  const zone = LAKE.zone(r.x, r.z);
  const v = G.cast ? G.cast.verdict : "";
  if (r.land === "water") {
    world.splash(r.x, r.z, 0.5);
    Sound.sfx("splash", 0.5); Haptics.splash(0.5);
    G.landing = { x: r.x, z: r.z, dist };
    G.ring = rises ? rises.near(r.x, r.z) : null;
    // G.force lets a test pick the fish: { species, kg, bite }
    G.sim = new LakeSim(Object.assign({ lure: { x: r.x, z: r.z }, tip: rodTip(45, G.cast ? G.cast.yaw : 0), lineOut: r.lineOut, hour: G.hour, ring: G.ring, rng: LAKE.rng(G.seed + G.casts * 7919), easy: save.assist }, G.force || {}));
    G.settle = 0;
    if (dist > save.longest) { save.longest = dist; if (dist > 12) toast("Your longest cast yet!"); }
    persist();
    report(dist, VERDICT[v] || "", (G.ring ? (G.ring.gold ? "Right in the gold ring!" : "Right on the rising fish!") : LAKE.ZONE_NAMES[zone] || ""), v === "sweet");
    if (G.ring) Sound.sfx("ui");
  } else {
    Sound.sfx("plop");
    const msg = r.land === "tree" ? "You caught a pine tree." : r.land === "dock" ? "You hooked the dock." : "You cast onto the shore.";
    report(r.land === "dock" ? null : dist, VERDICT[v] || "", msg, false);
    G.outcomeAt = now();
  }
  relayout();
}
// after a landing in the water: close the bail, then turn the phone to reel
function afterLanding() {
  if (!G.sim) return;
  if (G.input === "motion" && touchDevice) {
    if (physical() === "landscape") enterReel();
    else goTurn("landscape", () => enterReel());
  } else enterReel();
}

/* ---------------- turning the phone ---------------- */
function goTurn(to, then) {
  G.phase = "turn";
  G.turnTo = to;
  G.turnThen = then;
  G.turnSince = 0;
  G.turnShown = now();
  const t = $("#turn");
  t.hidden = false;
  t.classList.toggle("up", to === "portrait");
  $("#turnText").textContent = to === "landscape" ? "Turn your phone sideways." : "Turn your phone upright to cast.";
  $("#turnSub").textContent = to === "landscape" ? "Then turn the crank to reel." : "Hold it like the handle of a rod.";
  $("#turnSkip").hidden = true;
  $("#turnSkip").textContent = to === "landscape" ? "Reel without turning" : "Cast without turning";
  prompt("");
  relayout(true);
}
$("#turnSkip").addEventListener("click", () => { G.turnForce = true; });
function turnUpdate(dt) {
  const ok = physical() === G.turnTo || G.turnForce;
  if (now() - G.turnShown > 4000) $("#turnSkip").hidden = false;
  G.turnSince = ok ? G.turnSince + dt : 0;
  if (G.turnSince > 0.25 || G.turnForce) {
    G.turnForce = false;
    $("#turn").hidden = true;
    const f = G.turnThen; G.turnThen = null;
    if (f) f();
  }
}

/* ---------------- the reel ---------------- */
function enterReel() {
  G.phase = "reel";
  G.turnTo = null;
  $("#turn").hidden = true;
  // hold the phone sideways: the top edge of the screen is the rod. If you would not turn it, the upright axis still works
  Motion.mode = G.input === "motion" && physical() !== "landscape" ? "portrait" : "landscape";
  hideReport();
  relayout(true);
  updateHud();
}
function outcome(kind, msg) {
  G.phase = "lost";
  G.outcomeAt = now();
  prompt(msg, "", kind === "home" ? "crank" : "stop", "");
  relayout();
}
function nextAfterOutcome() {
  if (G.mode === "derby" && G.castsLeft <= 0) { endDerby(); return; }
  newCast();
}

/* ---------------- the catch ---------------- */
function caught(c) {
  const sp = byId(c.id);
  const junk = !!c.junk || JUNK.some((j) => j.id === c.id);
  const j = save.journal[c.id] || { n: 0, kg: 0, cm: 0 };
  const isNew = j.n === 0;
  const record = !junk && !isNew && c.kg > j.kg;
  j.n++;
  if (c.kg > j.kg) { j.kg = c.kg; j.cm = c.cm || 0; }
  save.journal[c.id] = j;
  if (!junk) {
    save.caught++;
    if (!save.biggest || c.kg > save.biggest.kg) save.biggest = { id: c.id, kg: c.kg };
    G.bag.push({ id: c.id, kg: c.kg });
  }
  persist();
  G.phase = "catch";
  prompt("");
  world.setFish(null); world.setFollower(null);
  world.setLine({ visible: false });
  world.setLure({ x: 0, y: -5, z: 0, visible: false });
  world.showCatch(c.id, c.kg);
  Sound.sfx(junk ? "junk" : "landed");
  if (record || (isNew && sp && sp.legend)) setTimeout(() => Sound.sfx("record"), 500);
  Haptics.land();
  const badges = $("#cbadges");
  badges.innerHTML = "";
  const addBadge = (t, cls) => { const b = document.createElement("span"); b.className = "badge " + cls; b.textContent = t; badges.appendChild(b); };
  if (isNew) addBadge(junk ? "NEW FIND" : "NEW SPECIES", "new");
  if (record) addBadge("NEW RECORD", "");
  if (sp && sp.legend) addBadge("LEGEND", "");
  $("#cname").textContent = sp ? sp.name : c.name || "A fish";
  $("#ckg").innerHTML = junk ? "<small>Junk</small>" : fmtKg(c.kg) + (c.cm ? " <small>· " + c.cm + " cm</small>" : "");
  $("#cblurb").textContent = sp ? sp.blurb : "";
  $("#catchGo").textContent = G.mode === "derby" && G.castsLeft <= 0 ? "See the results" : "Cast again";
  relayout(true);
  show("catch");
  updateHud();
}
$("#catchGo").addEventListener("click", () => { Sound.sfx("ui"); show(null); world.hideCatch(); nextAfterOutcome(); });

/* ---------------- the derby ---------------- */
const RANKS = [[0, "SKUNKED"], [0.01, "DOCK ROOKIE"], [1, "WEEKEND ANGLER"], [3, "COTTAGE REGULAR"], [6, "LAKE LEGEND"], [10, "THE LOON LAKE RECORD"]];
function endDerby() {
  G.phase = "results";
  Sound.stopLoops(); Haptics.stop();
  prompt("");
  $("#turn").hidden = true;
  const total = G.bag.reduce((a, b) => a + b.kg, 0);
  const best = total > save.derbyBest;
  if (best) save.derbyBest = total;
  persist();
  $("#rtotal").textContent = fmtKg(total);
  let rank = RANKS[0][1];
  for (const [kg, name] of RANKS) if (total >= kg) rank = name;
  $("#rrank").textContent = rank;
  const ul = $("#rlist");
  ul.innerHTML = "";
  if (!G.bag.length) { const li = document.createElement("li"); li.textContent = "No fish this time."; ul.appendChild(li); }
  for (const f of [...G.bag].sort((a, b) => b.kg - a.kg)) {
    const li = document.createElement("li");
    const a = document.createElement("span"), b = document.createElement("b");
    a.textContent = (byId(f.id) || {}).name || f.id; b.textContent = fmtKg(f.kg);
    li.append(a, b); ul.appendChild(li);
  }
  $("#rbest").textContent = best && total > 0 ? "A new best derby!" : save.derbyBest > 0 ? "Your best derby: " + fmtKg(save.derbyBest) : "";
  if (best && total > 0) Sound.sfx("record");
  relayout(true);
  show("results");
}
$("#rAgain").addEventListener("click", () => { Sound.sfx("ui"); startMode("derby"); });
$("#rMenu").addEventListener("click", () => { Sound.sfx("uiBack"); toTitle(); });

/* ---------------- journal ---------------- */
function renderJournal() {
  const list = $("#jlist");
  list.innerHTML = "";
  let got = 0;
  for (const sp of [...SPECIES, ...JUNK]) {
    const j = save.journal[sp.id];
    const d = document.createElement("div");
    d.className = "jfish" + (j && j.n ? "" : " none");
    const b = document.createElement("b"), sw = document.createElement("i"), sm = document.createElement("small");
    sw.className = "sw";
    const junk = JUNK.includes(sp);
    if (j && j.n) {
      got++;
      b.textContent = sp.name;
      sw.style.background = "linear-gradient(90deg," + sp.look.back + "," + sp.look.body + "," + (sp.look.belly || sp.look.accent || sp.look.body) + ")";
      sm.textContent = junk ? "Found " + j.n + "×" : "Best " + fmtKg(j.kg) + (j.cm ? " · " + j.cm + " cm" : "") + " · caught " + j.n;
    } else {
      b.textContent = sp.legend ? "The legend" : junk ? "Something odd" : "Not caught yet";
      sw.style.background = "rgba(255,255,255,0.12)";
      sm.textContent = sp.legend ? "Look for a gold ring at dawn or dusk." : junk ? "It is on the bottom somewhere." : (zoneHint(sp) || "");
    }
    d.append(b, sw, sm);
    list.appendChild(d);
  }
  $("#jsum").textContent = got + " of " + (SPECIES.length + JUNK.length) + " found · " + save.caught + " fish landed · " + save.casts + " casts";
}
function zoneHint(sp) {
  const z = Object.entries(sp.zones || {}).sort((a, b) => b[1] - a[1])[0];
  return z ? "Try " + (LAKE.ZONE_NAMES[z[0]] || z[0]).toLowerCase() + "." : "";
}

/* ---------------- help ---------------- */
const HELP_M = [
  ["bail", "Swipe the <b>bail</b> down to open it. Or give the phone a quick <b>twist</b>."],
  ["thumb", "<b>Hold your thumb</b> on the reel. It holds the line."],
  ["back", "Tip the phone <b>back</b> over your shoulder."],
  ["flick", "<b>Whip it forward.</b> Lift your thumb just after the phone passes straight up."],
  ["swipe", "Swipe the bail <b>up</b> to close it. Or just start to reel."],
  ["turn", "Turn the phone <b>sideways</b>. Its top edge is now the rod."],
  ["crank", "Turn the <b>crank</b> with your thumb to reel."],
  ["pull", "A fish strikes? <b>Pull the phone up</b> fast to set the hook."],
  ["pull", "<b>Pump and reel:</b> pull up, then reel as you tip the phone down."],
  ["stop", "When the drag <b>buzzes</b>, stop reeling. When a fish <b>jumps</b>, tip the rod down."],
];
const HELP_T = [
  ["bail", "Swipe the <b>bail</b> down to open it. On a keyboard, press <b>E</b>."],
  ["thumb", "<b>Press and hold</b> on the reel. <b>Drag down</b> to tip the rod back."],
  ["flick", "<b>Flick up</b> and let go during the flick. Drag the lake left or right to aim."],
  ["swipe", "Swipe the bail <b>up</b> to close it."],
  ["crank", "Turn the <b>crank</b> in circles, or use the mouse wheel. Hold <b>R</b> to reel."],
  ["pull", "The <b>rod pad</b> on the left: drag up to raise the rod. A fast swipe up sets the hook. Keys: <b>W S A D</b> and <b>Space</b>."],
  ["stop", "When the drag <b>buzzes</b>, stop reeling. When a fish <b>jumps</b>, lower the rod."],
];
for (const [id, list] of [["#helpM", HELP_M], ["#helpT", HELP_T]]) $(id).innerHTML = list.map(([ic, t]) => "<li>" + ICON[ic] + "<span>" + t + "</span></li>").join("");
for (const tab of $$("#help [data-tab]")) tab.addEventListener("click", () => {
  for (const t of $$("#help [data-tab]")) t.setAttribute("aria-selected", String(t === tab));
  $("#helpM").hidden = tab.dataset.tab !== "m";
  $("#helpT").hidden = tab.dataset.tab !== "t";
});
function seen(k) { if (!save.seen[k]) { save.seen[k] = 1; persist(); } }

/* ---------------- settings ---------------- */
function syncSettings() {
  $("#optSound").checked = Sound.isOn();
  $("#optHaptics").checked = Haptics.enabled;
  $("#optHaptics").disabled = Haptics.kind === "none";
  $("#hapticNote").textContent = Haptics.kind === "none" ? "This browser cannot buzz." : Haptics.kind === "ios" ? "Light taps on iPhone." : "Buzz for bites, strikes, and line pull.";
  $("#optAssist").checked = !!save.assist;
  $("#optInput").value = G.input === "motion" || save.input === "motion" ? "motion" : "touch";
  $("#optInput").disabled = !touchDevice || !Motion.available;
  $("#inputNote").textContent = !touchDevice || !Motion.available ? "Motion needs a phone." : G.input === "motion" ? "The phone is the rod." : "Drag and flick on the screen.";
  $("#optQuality").value = save.quality;
}
$("#optSound").addEventListener("change", (e) => { if (e.target.checked !== Sound.isOn()) Sound.toggle(); });
$("#optHaptics").addEventListener("change", (e) => { Haptics.unlock(); Haptics.setEnabled(e.target.checked); if (e.target.checked) Haptics.bump(0.6); });
$("#optAssist").addEventListener("change", (e) => { save.assist = e.target.checked; persist(); });
$("#optQuality").addEventListener("change", (e) => { save.quality = e.target.value; persist(); applyQuality(); });
$("#optInput").addEventListener("change", async (e) => {
  if (e.target.value === "motion") {
    const st = await Motion.request();
    if (st === "granted") { G.input = "motion"; save.input = "motion"; }
    else { e.target.value = "touch"; G.input = "touch"; save.input = "touch"; toast(st === "denied" ? "Motion is blocked for this page." : "No motion data from this phone."); }
  } else { G.input = "touch"; save.input = "touch"; }
  persist(); syncSettings(); relayout(true);
});
function applyQuality() { if (world) world.setQuality(save.quality === "auto" ? (touchDevice ? "low" : "high") : save.quality); }

/* ---------------- pause ---------------- */
function pause() {
  if (G.paused || !(G.phase === "cast" || G.phase === "turn" || G.phase === "reel" || G.phase === "lost")) return;
  G.paused = true;
  Sound.stopLoops(); Haptics.stop();
  if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) { G.pin = null; G.step = "open"; }
  $("#pauseSum").textContent = hudText();
  show("pause");
}
function resume() { G.paused = false; show(null); Sound.sfx("ui"); keepAwake(); }
$("#pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); Sound.sfx("ui"); pause(); });
$("#resumeBtn").addEventListener("click", resume);
$("#quitBtn").addEventListener("click", () => { G.paused = false; Sound.sfx("uiBack"); toTitle(); });
$("#pHelp").addEventListener("click", () => overlay("help"));
$("#pJournal").addEventListener("click", () => { renderJournal(); overlay("journal"); });
$("#pSet").addEventListener("click", () => { syncSettings(); overlay("settings"); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { pause(); Sound.stopLoops(); Haptics.stop(); }
  else keepAwake();
});
// Safari: no pinch zoom
document.addEventListener("gesturestart", (e) => e.preventDefault());

/* ---------------- HUD ---------------- */
function hudText() {
  const kg = G.bag.reduce((a, b) => a + b.kg, 0);
  if (G.mode === "derby") return "Derby · cast " + Math.min(10, G.casts + (G.step === "flight" || G.phase !== "cast" ? 0 : 1)) + " of 10 · " + fmtKg(kg);
  return "Free fishing · " + G.bag.length + " fish · " + fmtKg(kg);
}
function updateHud() {
  $("#modeChip").textContent = hudText();
  $("#clock").textContent = fmtHour(G.hour);
}

/* ---------------- controls ---------------- */
const keys = {};
addEventListener("keydown", (e) => {
  if (e.repeat && !["KeyR", "KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) return;
  if (window.GameSwitch && GameSwitch.isOpen) return;
  keys[e.code] = true;
  if (e.code === "Escape" || e.code === "KeyP") { if (G.paused) resume(); else pause(); return; }
  if (G.paused) return;
  if (e.code === "KeyE" && G.phase === "cast") { if (G.bail === "closed" && G.step === "ready") openBail("key"); else if (G.bail === "open" && (G.step === "landed" || G.step === "open")) closeBail(); }
  if (e.code === "Space" && (G.phase === "reel")) { G.hookReq = true; e.preventDefault(); }
  if (e.code === "BracketLeft") setDrag(G.drag - 1);
  if (e.code === "BracketRight") setDrag(G.drag + 1);
  if (e.code === "Enter" && G.phase === "catch") $("#catchGo").click();
  syncPadKeys();
});
addEventListener("keyup", (e) => { keys[e.code] = false; syncPadKeys(); });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; syncPadKeys(); });
function syncPadKeys() {
  if (crank) crank.keyHold(!!keys.KeyR);
  if (rodPad) rodPad.keys({ up: keys.KeyW || keys.ArrowUp, down: keys.KeyS || keys.ArrowDown, left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight });
}
const DRAGS = ["DRAG: LIGHT", "DRAG: MED", "DRAG: HEAVY"];
function setDrag(d) {
  G.drag = clamp(d, 0, 2);
  $("#dragName").textContent = DRAGS[G.drag];
  Sound.sfx("tick"); Haptics.tick();
}
$("#dragDown").addEventListener("click", () => setDrag(G.drag - 1));
$("#dragUp").addEventListener("click", () => setDrag(G.drag + 1));
// the mouse wheel turns the crank
addEventListener("wheel", (e) => { if (G.phase === "reel" && crank && !G.paused) { crank.wheel(e.deltaY); e.preventDefault(); } }, { passive: false });
// aim with touch or mouse: drag the lake left or right before you open the bail
{
  let drag = null;
  const view = $("#view");
  view.addEventListener("pointerdown", (e) => {
    if (G.phase !== "cast" || G.input === "motion" || G.bail !== "closed") return;
    drag = { id: e.pointerId, x: toLocal(e.clientX, e.clientY).x, yaw: G.aimYaw };
  });
  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const x = toLocal(e.clientX, e.clientY).x;
    G.aimYaw = clamp(drag.yaw + (x - drag.x) * 0.2, -60, 60);
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  addEventListener("pointerup", end);
  addEventListener("pointercancel", end);
}

/* ---------------- per-frame: the cast ---------------- */
function castUpdate(dt) {
  const t = now();
  const p = Motion.pose;
  // touch mode: the finger on the reel is the rod. Drag down = rod back; flick up = forward
  if (!sensing()) {
    let th = 75;
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) th = G.pin.theta;
    else if (G.step === "flight" || G.step === "landed" || G.step === "ashore") th = lerp(p.theta || 60, 60, 1 - Math.exp(-dt * 4));
    Motion.virtual({ t, theta: th, yaw: G.aimYaw, roll: 0 });
  }
  const yaw = sensing() ? clamp(p.yaw, -75, 75) : G.aimYaw;
  const theta = p.theta;

  // the lure slips down when the bail is open and nothing holds the line
  if (G.bail === "open" && !G.pin && (G.step === "open") && t - G.openAt > 700) {
    const was = G.drop;
    G.drop = Math.min(1.2, G.drop + dt * 0.6);
    Sound.setSpool(G.drop > was ? 1.5 : 0);
  } else if (G.step !== "flight") Sound.setSpool(0);

  if (G.step === "pinned" || G.step === "loaded") {
    G.backMax = Math.max(G.backMax, theta);
    Sound.setSwish(clamp(Math.abs(p.omega) / 900, 0, 1));
    if (G.step === "pinned" && theta >= (CAST.LOAD_THETA || 105)) { G.step = "loaded"; Sound.sfx("load"); Haptics.load(); }
    // swung through with the thumb still down: nothing flies
    if (G.step === "loaded" && theta < 35 && p.omega < -250) { G.step = "pinned"; G.backMax = theta; toast("Lift your thumb during the swing."); }
  } else Sound.setSwish(0);

  let tip;
  if (G.step === "flight" && G.flight) {
    tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, visible: true });
    const r = G.flight.step(dt, !!(G.pin && G.pin.feather));
    Sound.setSpool(r.spool || 0);
    reelPanel.set({ spool: (r.spool || 0) / 0.6 });
    world.setLure({ x: r.x, y: r.y, z: r.z, visible: true, spin: 1 });
    world.setLine({ from: tip, to: { x: r.x, y: r.y, z: r.z }, slack: 0.15, visible: true, flying: true });
    world.setView({ mode: "flight", look: { x: r.x, y: Math.max(r.y, 0), z: r.z }, portrait: G.layout === "tall-cast" });
    // feathering: a finger on the reel slows the line, so the lure drops short onto a target
    if (G.pin && G.pin.feather) prompt("Feathering: the lure slows.", "", "thumb");
    else prompt(save.casts < 6 ? "Touch the reel to stop the lure short." : "", "", "thumb");
    if (r.done) { Sound.setSpool(0); prompt(""); landed(r); }
    return;
  }
  if ((G.step === "landed" || G.step === "ashore") && (G.sim || G.step === "ashore")) {
    tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: 0.05, visible: true });
    if (G.sim) {
      // the fish wait until you can reel: the lure just settles where it landed
      const L = G.sim.state.lure;
      G.settle = Math.min(1, (G.settle || 0) + dt);
      world.setLure({ x: L.x, y: -0.25 * G.settle, z: L.z, visible: true, spin: 0 });
      world.setLine({ from: tip, to: L, slack: 0.7, visible: true });
      world.setView({ mode: "cast", yaw, look: { x: L.x, y: 0, z: L.z }, portrait: G.layout === "tall-cast" });
      if (G.input === "motion" && touchDevice && physical() === "landscape") { afterLanding(); return; }
    } else {
      world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
      if (t - G.outcomeAt > 2300) { if (G.bail === "open") { G.bail = "closed"; Sound.sfx("bailClose"); } if (G.mode === "derby" && G.castsLeft <= 0) endDerby(); else newCast(); }
    }
    castPrompt();
    return;
  }
  // ready, open, pinned, loaded: the lure hangs under the tip
  tip = world.setRod({ theta: clamp(theta, -10, 170), yaw, bend: 0, visible: true });
  world.setLure({ x: tip.x, y: tip.y - 0.28 - G.drop, z: tip.z, visible: true, spin: 0 });
  world.setLine({ from: tip, to: { x: tip.x, y: tip.y - 0.28 - G.drop, z: tip.z }, slack: 0, visible: true });
  world.setView({ mode: "cast", yaw, portrait: G.layout === "tall-cast" });
  world.setAim({ yaw, visible: G.step === "pinned" || G.step === "loaded" || G.step === "open" });
  // the wrist twist flips the bail (seen by the sensor callback, so a quick twist between two frames still counts)
  if (G.twistReq) {
    G.twistReq = false;
    if (G.bail === "closed" && G.step === "ready" && !G.pin) openBail("twist");
  }
  castPrompt();
}
function castPrompt() {
  const m = G.input === "motion";
  switch (G.step) {
    case "ready": prompt("Swipe the bail down to open it.", m ? "Or give the phone a quick twist." : touchDevice ? "Drag the lake to aim." : "Or press E. Drag the lake to aim.", "bail"); break;
    case "open": prompt(m ? "Hold your thumb on the reel." : "Press and hold on the reel.", G.drop > 0.3 ? "The line is slipping! Hold it." : "Your thumb holds the line.", "thumb"); break;
    case "pinned": prompt(m ? "Tip the phone back over your shoulder." : "Drag down to tip the rod back.", m ? "Keep your thumb down." : "", "back"); break;
    case "loaded": prompt(m ? "Whip it forward. Let go!" : "Flick up and let go!", m ? "Lift your thumb just after straight up." : "", "flick", "hot"); break;
    case "landed": prompt(m ? "Close the bail. Swipe it up." : "Swipe the bail up to reel.", m ? "Or turn the phone sideways and crank." : "", "swipe"); break;
    case "ashore": prompt(""); break;
    default: prompt("");
  }
}

/* ---------------- per-frame: the reel ---------------- */
const HOOK_OMEGA = 300;
function reelUpdate(dt) {
  const sim = G.sim;
  if (!sim) return;
  const t = now();
  // touch: the rod pad is the rod
  if (!sensing()) Motion.virtual({ t, theta: rodPad.theta, roll: rodPad.steer, yaw: 0 });
  // an upright phone mid-fight: read the upright axis until it turns again
  if (sensing()) {
    const want = physical() === "landscape" ? "landscape" : "portrait";
    if (Motion.mode !== want) Motion.mode = want;
  }
  const p = Motion.pose;
  const theta = clamp(p.theta, -20, 150);
  const steer = clamp(p.roll || 0, -1, 1);
  let crankRate = crank.rate;
  // the first turn of the crank snaps the bail shut, like a real reel
  if (G.bail === "open") { if (crankRate > 0.25) closeBail(); crankRate = 0; }
  let hookset = false;
  if (G.hookReq) { hookset = true; G.hookReq = false; }
  const s = sim.state;
  const pullTo = s.fish ? { x: s.fish.x, y: Math.max(s.fish.y, -0.3), z: s.fish.z } : s.lure;
  const tip = world.setRod({ theta, yaw: 0, steer, bend: clamp(s.bend != null ? s.bend : G.tension * 1.3, 0, 1), pull: pullTo, visible: true });
  // the sim bends its own rod: give it the straight rod's tip, not the drawn one
  sim.step(dt, { crank: crankRate, tip: rodTip(theta, 0, steer), theta, omega: p.omega, steer, drag: G.drag, hookset, lift: theta > 70 });
  G.tension = lerp(G.tension, s.tfrac || 0, 1 - Math.exp(-dt * 12));
  for (const e of sim.events.splice(0)) handleEvent(e);
  // the outcome comes from the sim's phase; events only drive sound, buzz and pictures
  if (s.phase === "caught" && s.catch) { caught(s.catch); return; }
  if (s.phase === "lost") { outcome("lost", reasonText(s.reason)); return; }
  if (s.phase === "home") { outcome("home", "Nothing this time. Cast again."); return; }

  // draw
  const L = s.lure;
  if (s.fish) {
    const f = s.fish;
    world.setFish({ id: f.id, x: f.x, y: f.y, z: f.z, heading: f.heading, len: f.len || 0.4, jump: f.jump || 0, thrash: f.move === "shake" ? 1 : 0, near: f.near == null ? 0.5 : f.near });
    world.setLure({ x: L.x, y: L.y, z: L.z, visible: false });
    world.setLine({ from: tip, to: { x: f.x, y: f.jump ? f.y : Math.max(f.y, -0.25), z: f.z }, slack: s.slack ? 1 : clamp(0.5 - s.tfrac * 2, 0, 0.5), visible: true });
  } else {
    world.setFish(null);
    world.setLure({ x: L.x, y: L.y, z: L.z, visible: true, spin: clamp((L.speed || 0) * 2, 0, 1) });
    world.setLine({ from: tip, to: L, slack: s.slack ? 0.8 : clamp(0.4 - (L.speed || 0) * 0.3, 0.05, 0.4), visible: true });
  }
  world.setFollower(s.follower || null);
  const look = s.fish ? { x: s.fish.x, y: 0, z: s.fish.z } : { x: L.x, y: 0, z: L.z };
  world.setView({ mode: "reel", look, portrait: G.layout === "tall-reel" });
  const sp = s.fish ? byId(s.fish.id) : null;
  gauge.set({ tfrac: s.tfrac || 0, dragFrac: (s.dragN || 18) / (s.breakN || 45), slip: s.slip || 0, lineOut: s.lineOut || 0, depth: Math.max(0, -(s.fish ? s.fish.y : L.y)), stamina: s.fish ? s.fish.stamina : null, name: s.fish ? (s.fish.known && sp ? sp.name : "Fish on!") : "" });

  // feel
  Sound.setReel(crankRate);
  Sound.setDrag(s.slip || 0);
  Sound.setTension(s.phase === "fight" || s.phase === "land" ? G.tension : 0);
  Haptics.setCrank(crankRate);
  Haptics.setTension(G.tension, s.slip || 0, s.phase === "fight" || s.phase === "land");
  reelPrompt(s, crankRate, theta);
}
function reelPrompt(s, crankRate, theta) {
  const m = sensing();
  const t = now();
  const recent = (k, ms) => t - (G.lastEvent[k] || -1e9) < ms;
  if (G.bail === "open") return prompt("Turn the crank to close the bail.", "", "crank");
  switch (s.phase) {
    case "sink": case "retrieve":
      if (recent("nibble", 900)) return prompt("Something is nibbling...", "Wait for the strike.", "fish");
      if (s.follower) return prompt("A fish is following. Keep reeling.", "A short pause can make it bite.", "crank");
      return prompt("Turn the crank to reel.", save.seen.bite ? "" : "Stop now and then. Fish like a pause.", "crank");
    case "strike":
      return prompt(m ? "PULL UP! Set the hook!" : touchDevice ? "SWIPE UP! Set the hook!" : "PRESS SPACE! Set the hook!", "", "pull", "hot");
    case "fight": {
      const f = s.fish || {};
      if (f.move === "jump" || recent("jump", 900)) return prompt("It jumped! Lower the rod!", "", "low", "hot");
      if ((s.slip || 0) > 0.15 && crankRate > 0.3) return prompt("The drag is slipping. Stop reeling.", "Hold the rod up. Let it run.", "stop", "hot");
      if ((s.tfrac || 0) > 0.82) return prompt("Too tight! Ease off.", "Stop reeling and lower the rod a little.", "low", "hot");
      if ((s.slip || 0) > 0.15) return prompt("It is running. Let it go.", "Keep the rod up. Reel when it stops.", "pull");
      if (s.slack) return prompt("Slack line! Reel it in.", "", "crank", "hot");
      if (theta < 28) return prompt("Keep your rod up.", m ? "Tip the top of the phone back toward you." : "Drag the rod pad up.", "pull");
      return prompt("Pump and reel.", m ? "Pull up, then reel as you tip the phone down." : "Drag the rod up, then reel as it comes down.", "pull");
    }
    case "land": return prompt("Lift it out! Raise the rod and hold.", "", "pull", "good");
    default: return prompt("");
  }
}
function handleEvent(e) {
  const type = typeof e === "string" ? e : e.type;
  G.lastEvent[type] = now();
  const s = G.sim && G.sim.state;
  const fx = e.x != null ? e.x : s && s.fish ? s.fish.x : s ? s.lure.x : 0;
  const fz = e.z != null ? e.z : s && s.fish ? s.fish.z : s ? s.lure.z : 0;
  switch (type) {
    case "nibble": Sound.sfx("nibble", e.s); Haptics.bump(e.s == null ? 0.5 : e.s); if (crankPad) crankPad.forceTick(); if (s) world.ripple(s.lure.x, s.lure.z, 0.3); seen("bite"); break;
    case "strike": Sound.sfx("strike"); Haptics.thump(); flash(); if (crankPad) crankPad.forceTick(); if (s) world.splash(s.lure.x, s.lure.z, 0.35); break;
    case "hooked":
      if (e.junk) { Sound.sfx("junk"); toast("Snagged something heavy. Reel it in.", 2200); }
      else { Sound.sfx("hookset"); Haptics.hookset(); toast(e.self ? "It hooked itself! Fish on!" : "Fish on!", 1400); }
      // the ring's fish is on the line: its ring goes quiet
      if (G.ring && rises && rises.take) { rises.take(G.ring); G.ring = null; }
      break;
    case "missed": Sound.sfx("miss"); toast(G.input === "motion" ? "It spat the lure. Pull up faster next time." : "It spat the lure. Swipe up faster next time.", 2600); break;
    case "spooked": Sound.sfx("miss"); toast("Too soon! You spooked it. Wait for the strike.", 2600); break;
    case "refuse": toast("It looked, and turned away.", 1800); break;
    case "jump": Sound.sfx("jump", e.size); Haptics.splash(0.8); world.splash(fx, fz, e.size || 0.8); break;
    case "splash": world.splash(fx, fz, e.size || 0.5); Sound.sfx("splash", e.size || 0.5); break;
    case "run": case "surge": if (!save.seen.run) { toast("It is running! Let the drag work.", 2400); seen("run"); } break;
    case "shake": Haptics.bump(0.7); break;
    case "reveal": { const sp = byId(e.id || (s && s.fish && s.fish.id)); if (sp) toast("It is a " + sp.name + "!", 2000); break; }
    case "near": Haptics.bump(0.8); break;
    case "snap": Sound.sfx(e.reason === "weeds" || e.reason === "rocks" ? "thrown" : "snap"); Haptics.jolt(); flash(); break;
    case "thrown": Sound.sfx("thrown"); Haptics.jolt(); break;
    case "home": Sound.sfx("plop"); break;
  }
}
function reasonText(r) {
  return ({
    snap: "SNAP! The line broke.", thrown: "It threw the hook.", spat: "It spat the lure.", spooked: "You spooked it.",
    weeds: "It wrapped the line in the weeds.", rocks: "It cut the line on the rocks.",
  })[r] || "It got away.";
}

/* ---------------- the loop ---------------- */
let last = now(), fpsAcc = 0, fpsN = 0;
function frame() {
  requestAnimationFrame(frame);
  const t = now();
  let dt = (t - last) / 1000;
  last = t;
  if (!(dt > 0)) dt = 0.016;
  G.frame++;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  // a slow frame still moves the game on in real time, in steps of at most 50 ms; a long stall is not caught up
  dt = Math.min(dt, 0.25);
  relayout();
  if (!world) return;
  if (!G.paused) for (let left = dt; left > 1e-4; left -= 0.05) step(Math.min(left, 0.05));
  dt = Math.min(dt, 0.05);
  world.update(dt);
  world.render();
  if (reelPanel && !$("#castUI").hidden) reelPanel.draw(dt);
  if (!$("#reelUI").hidden) { crank.draw(dt); gauge.draw(dt); if (!rodPad.hidden) rodPad.draw && rodPad.draw(dt); }
  if (DEBUG) debug();
}
function step(dt) {
  const inPlay = G.phase === "cast" || G.phase === "turn" || G.phase === "reel" || G.phase === "lost";
  if (inPlay) {
    // the day goes by: an hour every 75 s in free fishing; the derby stays at golden hour
    const was = G.hour;
    G.hour += dt / (G.mode === "derby" ? 400 : 75);
    if (G.hour >= 21) { G.hour = 5; toast("A new day on Loon Lake."); }
    if (Math.floor(was * 6) !== Math.floor(G.hour * 6)) { world.setHour(G.hour); Sound.setAmbience(true, G.hour); updateHud(); }
    if (rises) {
      for (const e of rises.step(dt, G.hour) || []) if (e.type === "rise") { world.rise(e.x, e.z); if (e.gold) toast("A gold ring! Something big is rising.", 2600); }
      world.setRings(rises.list.map((r) => ({ x: r.x, z: r.z, gold: !!r.gold })));
    }
  } else if (G.phase === "title") {
    world.setView({ mode: "title" });
  }
  switch (G.phase) {
    case "cast": castUpdate(dt); reelPanel.set({ bail: G.bail, pinned: !!G.pin, line: 0.85, hint: "", glow: G.step === "ready" || G.step === "landed" ? "bail" : G.step === "open" ? "pin" : "", touchCast: !sensing() }); if (G.step !== "flight") reelPanel.set({ spool: G.drop > 0 && G.drop < 1.2 && G.bail === "open" && !G.pin ? 1.2 : 0 }); break;
    case "turn":
      turnUpdate(dt);
      if (G.sim && G.phase === "turn") {
        const tip = world.setRod({ theta: clamp(Motion.pose.theta, -10, 170), yaw: 0, bend: 0.05 });
        const L = G.sim.state.lure;
        G.settle = Math.min(1, (G.settle || 0) + dt);
        world.setLure({ x: L.x, y: -0.25 * G.settle, z: L.z, visible: true });
        world.setLine({ from: tip, to: L, slack: 0.7, visible: true });
        world.setView({ mode: "cast", look: { x: L.x, y: 0, z: L.z }, portrait: G.layout === "tall-cast" });
      }
      break;
    case "reel": reelUpdate(dt); break;
    case "lost":
      Sound.setReel(0); Sound.setDrag(0); Sound.setTension(0); Haptics.setCrank(0); Haptics.setTension(0, 0, false);
      world.setFish(null); world.setFollower(null); world.setLine({ visible: false }); world.setLure({ x: 0, y: -5, z: 0, visible: false });
      if (now() - G.outcomeAt > 2400) { prompt(""); nextAfterOutcome(); }
      break;
    case "catch": world.setView({ mode: "catch" }); break;
    case "results": world.setView({ mode: "title" }); break;
  }
}
function debug() {
  const p = Motion.pose, s = G.sim && G.sim.state;
  $("#dbg").hidden = false;
  $("#dbg").textContent = [
    "input " + G.input + " · " + Motion.status + (Motion.live ? " live" : ""),
    "θ " + (p.theta || 0).toFixed(1) + "  ω " + (p.omega || 0).toFixed(0) + "  yaw " + (p.yaw || 0).toFixed(1),
    "roll " + (p.roll || 0).toFixed(2) + "  twist " + (p.twist || 0).toFixed(0) + "  " + p.orient + " side " + p.side,
    "phase " + G.phase + " · " + G.step + " · bail " + G.bail + " · rot " + G.rot + " · " + G.layout,
    G.cast ? "cast v0 " + G.cast.v0.toFixed(1) + " pitch " + G.cast.pitch.toFixed(0) + " " + G.cast.verdict + " " + G.cast.clock : "",
    s ? "sim " + s.phase + " T " + (s.tension || 0).toFixed(1) + "N slip " + (s.slip || 0).toFixed(2) + " line " + (s.lineOut || 0).toFixed(1) : "",
    "fps " + G.fps.toFixed(0) + (world && world.info ? " · " + JSON.stringify(world.info()) : ""),
  ].filter(Boolean).join("\n");
}

/* ---------------- boot ---------------- */
async function boot() {
  try {
    world = await createWorld($("#view"), { quality: save.quality === "auto" ? (touchDevice ? "low" : "high") : save.quality });
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML("beforeend", "<p style='position:fixed;inset:auto 0 40% 0;text-align:center;font:700 16px system-ui;color:#fff'>This browser cannot draw the lake (WebGL is off).</p>");
    return;
  }
  world.setHour(G.hour);
  reelPanel = new ReelPanel($("#reelBox"), { toLocal, hand: "right", area: game });
  reelPanel.on("bail", (e) => {
    if (G.paused || G.phase !== "cast") return;
    if (e.open && G.step === "ready") openBail("swipe");
    else if (!e.open && G.bail === "open" && (G.step === "landed" || G.step === "open")) closeBail();
  });
  reelPanel.on("pin", (e) => { if (!G.paused) pinLine(e); });
  reelPanel.on("pinmove", (e) => {
    if (!G.pin || G.pin.feather || e.id !== G.pin.id) return;
    // touch casting: finger height is the rod angle. Drag down to tip it back, flick up to cast
    const h = Math.max(160, $("#reelBox").clientHeight);
    G.pin.theta = clamp(80 + ((e.y - G.pin.y0) / h) * 150, 5, 170);
    // one clock for the finger: pointer times are input times and can run behind the frame's own samples
    if (!sensing()) Motion.virtual({ t: now(), theta: G.pin.theta, yaw: G.aimYaw, roll: 0 });
  });
  reelPanel.on("unpin", (e) => unpinLine(e));
  // every sensor sample: catch quick moves that a slow frame could miss
  Motion.on((pose) => {
    if (G.input !== "motion" || G.paused) return;
    const t = pose.t || now();
    // the hook set: a real snap up, fast for a moment, and the rod rose more than 10° in the last 150 ms
    if (G.phase === "reel" && t - G.lastHook > 450 && pose.omega > HOOK_OMEGA && pose.theta - Motion.at(t - 150).theta > 10) {
      G.hookReq = true; G.lastHook = t;
      return;
    }
    if (G.phase !== "cast") return;
    // the rod loads the moment it passes back over the shoulder, even between two frames
    if (G.pin && !G.pin.feather && (G.step === "pinned" || G.step === "loaded")) {
      G.backMax = Math.max(G.backMax, pose.theta);
      if (G.step === "pinned" && pose.theta >= (CAST.LOAD_THETA || 105)) { G.step = "loaded"; Sound.sfx("load"); Haptics.load(); }
      return;
    }
    if (G.pin) return;
    if (Math.abs(pose.twist || 0) > 380 && t - (G.twistAt || 0) > 700) {
      G.twistAt = t;
      if (G.step === "ready" && G.bail === "closed") G.twistReq = true;
      else if (G.step === "landed" && G.bail === "open") closeBail();
    }
  });
  crank = new Crank($("#crankBox"), { toLocal, hand: "right" });
  rodPad = new RodPad($("#padBox"), { toLocal });
  rodPad.on("yank", () => { if (G.phase === "reel") G.hookReq = true; });
  gauge = new Gauge($("#gaugeBox"));
  // iPhone: only a real finger on a switch control can tick. The reel face and the crank carry hidden switches
  Haptics.attachPad($("#reelBox"));
  crankPad = Haptics.attachCrank($("#crankBox"), { toLocal });
  setDrag(1);
  window.FISH = { G, Motion, get world() { return world; }, get crank() { return crank; }, get sim() { return G.sim; }, get save() { return save; }, startMode, newCast, toTitle, release, openBail, closeBail, enterReel, relayout, toLocal, pinLine, unpinLine, get rises() { return rises; } };
  toTitle();
  // the lake starts to sound with the first touch on the title (browsers keep audio off until then)
  addEventListener("pointerup", () => { Sound.init(); if (G.phase === "title") Sound.setAmbience(true, G.hour); }, { once: true });
  requestAnimationFrame(frame);
}
boot();
