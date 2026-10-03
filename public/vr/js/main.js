// In Full Swing: the game loop. It boots the page (the 2D title over a live city, or straight into the headset when
// the app starts from its icon), owns the rig and the body, runs the 14 steps of every frame, routes events to the
// portal, the game and the feedback table, saves, and exposes window.G and G.test (spec §6 and §12).
import * as THREE from "three";
import { VERSION, SAVE_KEY, WORLD, SWING, COMFORT, PERF, COLORS } from "./config.js";
import { generate } from "./city.js";
import { createPlayer, fire, release, step, teleport } from "./physics.js";
import { createXR } from "./xr.js";
import { createDesktop } from "./desktop.js";
import { createCityView } from "./cityview.js";
import { createRopes } from "./rope.js";
import { createHands } from "./hands.js";
import { createComfort } from "./comfort.js";
import { createGame } from "./game.js";
import { createUI } from "./ui.js";
import { createPortal } from "./portal.js";
import { createAudio } from "./audio.js";
import { createFX } from "./fx.js";
import { createHero } from "./hero.js";
import { createFlatCam } from "./flatcam.js";

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const QS = new URLSearchParams(location.search);
const ROOMS = ["office_small", "living_room", "meeting_room", "music_room", "office_large"];
const FLAGS = {
  god: QS.has("god"), skipintro: QS.has("skipintro"), nomv: QS.has("nomv"), debug: QS.has("debug"), nosw: QS.has("nosw"),
  emulate: QS.has("emulate") ? (QS.get("emulate") === "ar" ? "ar" : "vr") : null,
  room: ROOMS.includes(QS.get("room")) ? QS.get("room") : "office_small",
  pwa: QS.get("source") === "pwa",
};
const TOUCH_ONLY = navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- save and settings ---------------- */
// Only main writes localStorage. ui and game change G.save / G.settings and call G.saveNow().
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } },
};
function defaultSettings() {
  const p = COMFORT.presets[COMFORT.defaultPreset];
  return { preset: COMFORT.defaultPreset, vignette: p.vignette, turn: p.turn, snap: p.snap, aim: p.aim, vignetteLook: "room", seated: false, height: 0, hand: "right", hold: "hold", hz: PERF.hz, foveation: PERF.foveation, music: true, speedLines: true };
}
function blankSave() { return { v: 1, intro: false, tutorial: false, clogs: [], loonies: [], bonus: 0, king: "sleeping", pipes: [], best: {}, settings: defaultSettings() }; }
function loadSave() {
  const s = blankSave(), raw = store.get(SAVE_KEY, null);
  if (!raw || typeof raw !== "object" || raw.v !== 1) return s;
  const ints = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => Number.isInteger(x) && x >= 0))] : []);
  s.intro = raw.intro === true; s.tutorial = raw.tutorial === true;
  s.clogs = ints(raw.clogs); s.loonies = ints(raw.loonies); s.pipes = ints(raw.pipes);
  s.bonus = Number.isFinite(raw.bonus) && raw.bonus >= 0 ? raw.bonus : 0;
  s.king = ["sleeping", "awake", "beaten"].includes(raw.king) ? raw.king : "sleeping";
  if (raw.best && typeof raw.best === "object") for (const [k, v] of Object.entries(raw.best)) if (Number.isFinite(v) && v > 0) s.best[k] = v;
  const r = raw.settings && typeof raw.settings === "object" ? raw.settings : {}, t = s.settings;
  if (COMFORT.presets[r.preset] && r.preset !== "desktop") t.preset = r.preset;
  if (r.vignette in COMFORT.vignetteMinFov) t.vignette = r.vignette;
  if (r.turn === "snap" || r.turn === "smooth") t.turn = r.turn;
  if ([30, 45, 90].includes(r.snap)) t.snap = r.snap;
  if (r.aim in SWING.aimCone) t.aim = r.aim;
  if (r.vignetteLook === "room" || r.vignetteLook === "black") t.vignetteLook = r.vignetteLook;
  if (typeof r.seated === "boolean") t.seated = r.seated;
  if (Number.isFinite(r.height) && r.height >= 0 && r.height < 3) t.height = r.height;
  if (r.hand === "left" || r.hand === "right") t.hand = r.hand;
  if (r.hold === "hold" || r.hold === "toggle") t.hold = r.hold;
  if (r.hz === 72 || r.hz === 90) t.hz = r.hz;
  if (Number.isFinite(r.foveation)) t.foveation = clamp(r.foveation, 0, 1);
  for (const k of ["sound", "music", "stance", "speedLines"]) if (k in r && (typeof r[k] === "boolean" || typeof r[k] === "string")) t[k] = r[k];
  return s;
}
const save = loadSave();
const settings = save.settings;
// While flat play borrows the "desktop" comfort preset (applyComfort), the save keeps the headset's own fields.
let headsetComfort = null;
function saveNow() {
  save.settings = settings;
  if (!headsetComfort) { store.set(SAVE_KEY, save); return; }
  const now = { vignette: settings.vignette, turn: settings.turn, snap: settings.snap, aim: settings.aim };
  Object.assign(settings, headsetComfort);
  store.set(SAVE_KEY, save);
  Object.assign(settings, now);
}

/* ---------------- G ---------------- */
const G = (window.G = {
  version: VERSION, mode: "title", state: "title", ready: false, flags: FLAGS,
  renderer: null, scene: null, camera: null, rig: null, rigYaw: 0, bodyLocal: { x: 0, z: 0 }, prevHeadLocal: new THREE.Vector3(), seatedOffset: 0,
  input: null, xr: null, desktop: null, city: null, view: null, P: null, ropes: null, hands: null, comfort: null, game: null, ui: null, portal: null, audio: null, fx: null, hero: null, flatcam: null,
  save, settings, frame: 0, time: 0, dt: 0, viewDone: false, titleShows: 0, held: false,
  placeRig, saveNow, setWorldVisible, haptic, test: null,
});

// The Quest emulator for tests and development (spec §12): it must be installed before createXR looks at navigator.xr.
async function installEmulator() {
  const { XRDevice, metaQuest3 } = await import("iwer");
  const dev = new XRDevice(metaQuest3, { stereoEnabled: false });
  dev.installRuntime({ forceInstall: true });
  window.xrDevice = dev;
  if (FLAGS.emulate === "ar") {
    // "iwer" resolves to the same URL for SEM, so its planes and meshes are the page's own classes
    const { SyntheticEnvironmentModule } = await import("@iwer/sem");
    dev.installSEM(SyntheticEnvironmentModule);
    await dev.sem.loadDefaultEnvironment(FLAGS.room);
  }
}

/* ---------------- renderer, scene, rig (spec §2) ---------------- */
let renderer, scene, camera, rig, X, D, audio;
let city, P, view, ropes, hands, comfort, game, ui, portal, fx, hero, flatcam;
let loadRing = null;
function createRenderer() {
  THREE.ColorManagement.enabled = false;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, multiviewStereo: !FLAGS.nomv, powerPreference: "high-performance" });
  r.outputColorSpace = THREE.LinearSRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;
  r.setClearColor(COLORS.fog, 1);
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(innerWidth, innerHeight);
  r.xr.enabled = true;
  $("#view").appendChild(r.domElement);
  return r;
}
function createStage() {
  renderer = G.renderer = createRenderer();
  scene = G.scene = new THREE.Scene();
  scene.background = null; // AR needs the clear to stay transparent; VR and desktop use the fog clear colour
  rig = G.rig = new THREE.Group();
  rig.name = "rig";
  scene.add(rig);
  camera = G.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, PERF.cameraNear, PERF.cameraFar);
  rig.add(camera);
  // a small spinning ring while the PWA builds the city behind a started session
  loadRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 32, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xffc27a, fog: false, depthTest: false }));
  loadRing.position.set(0, 0, -1.2);
  loadRing.renderOrder = 999;
  loadRing.visible = false;
  camera.add(loadRing);
  X = G.xr = createXR(renderer, rig, camera, settings);
  D = G.desktop = createDesktop(renderer.domElement, camera, settings);
  G.input = D.input;
  audio = G.audio = createAudio(settings);
}
// Everything that needs the city. Normal boot does it before the title; the PWA does it after the session starts.
function createWorld() {
  city = G.city = generate(WORLD.seed);
  P = G.P = createPlayer(city);
  view = G.view = createCityView(renderer, scene, city, { low: false });
  ropes = G.ropes = createRopes(scene, city, settings);
  hands = G.hands = createHands(rig, scene, settings);
  comfort = G.comfort = createComfort(camera, rig, settings);
  fx = G.fx = createFX(scene, renderer); // the comic sound words; game.js reaches it as G.fx
  hero = G.hero = createHero(scene, renderer); // flat play: the hero and the chase camera (hidden and unused in XR)
  flatcam = G.flatcam = createFlatCam(camera, city);
  ui = G.ui = createUI({ scene, camera, rig, renderer, city, view, save, settings, comfort, audio, xr: X, hands, saveNow, haptic, setWorldVisible });
  game = G.game = createGame({ scene, city, view, ropes, hands, ui, audio, P, save, settings, saveNow, haptic });
  portal = G.portal = createPortal({ scene, rig, camera, renderer, xr: X, city, view, ropes, audio, ui, P, placeRig, haptic });
  portal.onDone(handOff);
  ui.onExit(exitPlay);
  ui.onRestart(resetProgress);
  if (ui.onTravel) ui.onTravel((s) => travel(s));
  ropes.onValid && ropes.onValid((side) => haptic(side, 0.1, 10));
  applyComfort(settings.preset);
  hands.setVisible(false);
}

/* ---------------- rig ownership (spec §6) ---------------- */
// Only main writes rig and rigYaw. Ry is three's rotation about +Y; yaw 0 faces −z.
const T = { x: 0, z: 0 };
function rotY(yaw, x, z, out) { const c = Math.cos(yaw), s = Math.sin(yaw); out.x = x * c + z * s; out.z = -x * s + z * c; return out; }
// Puts the rig so the current head is over (x, z) with the tracking floor at y + seatedOffset.
function placeRig(yaw, x, y, z) {
  const hl = G.input.head.local.pos;
  G.rigYaw = yaw;
  G.bodyLocal.x = hl.x; G.bodyLocal.z = hl.z;
  rotY(yaw, hl.x, hl.z, T);
  rig.position.set(x - T.x, y + G.seatedOffset, z - T.z);
  rig.rotation.set(0, yaw, 0);
  rig.updateMatrixWorld(true);
}
// rig = P.pos − Ry(rigYaw)·bodyLocal, floor at P.pos.y + seatedOffset
function syncRig() {
  rotY(G.rigYaw, G.bodyLocal.x, G.bodyLocal.z, T);
  rig.position.set(P.pos.x - T.x, P.pos.y + G.seatedOffset, P.pos.z - T.z);
  rig.rotation.set(0, G.rigYaw, 0);
  rig.updateMatrixWorld(true);
}
const QY = new THREE.Quaternion(), YAXIS = new THREE.Vector3(0, 1, 0);
// Fills the world head and hand poses from the local ones and the current rig.
function toWorld(inp) {
  const c = Math.cos(G.rigYaw), s = Math.sin(G.rigYaw), R = rig.position;
  QY.setFromAxisAngle(YAXIS, G.rigYaw);
  const hp = inp.head.local.pos;
  inp.head.pos.set(R.x + hp.x * c + hp.z * s, R.y + hp.y, R.z - hp.x * s + hp.z * c);
  inp.head.quat.copy(QY).multiply(inp.head.local.quat);
  for (const h of inp.hands) {
    const g = h.gripLocal.pos, a = h.aimLocal.pos, d = h.aimLocal.dir;
    h.gripPos.set(R.x + g.x * c + g.z * s, R.y + g.y, R.z - g.x * s + g.z * c);
    h.gripQuat.copy(QY).multiply(h.gripLocal.quat);
    h.aimPos.set(R.x + a.x * c + a.z * s, R.y + a.y, R.z - a.x * s + a.z * c);
    h.aimDir.set(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
  }
}
// yaw of a quaternion's forward (−z) direction
function yawOfQuat(q) { return Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)); }

/* ---------------- world visibility, haptics, comfort ---------------- */
let worldVisible = true, handsVisible = false;
function setWorldVisible(v) {
  worldVisible = !!v;
  if (view) view.root.visible = worldVisible;
  if (game && game.root && gameStarted) game.root.visible = worldVisible;
  if (ropes) ropes.setVisible(worldVisible);
  if (fx) fx.setVisible(worldVisible);
}
function haptic(side, intensity, ms) {
  if (!X || !X.session) return;
  const h = X.input.hands[side === "right" || side === 1 ? 1 : 0];
  if (h.connected) h.pulse(intensity, ms);
}
function showHands(v) { handsVisible = !!v; if (hands) hands.setVisible(handsVisible); }
// A preset sets the body's speed caps. Its vignette, turning and aim fields are written when you pick the preset (the title
// page or the pause menu) and are yours to change after that, so starting a session leaves them alone. Flat play borrows the
// "desktop" preset and puts your headset fields back when it ends.
function applyComfort(name) {
  const p = COMFORT.presets[name] || COMFORT.presets[COMFORT.defaultPreset];
  if (name === "desktop") {
    if (!headsetComfort) headsetComfort = { vignette: settings.vignette, turn: settings.turn, snap: settings.snap, aim: settings.aim };
    comfort.applyPreset(name);
  } else if (headsetComfort) { Object.assign(settings, headsetComfort); headsetComfort = null; }
  P.speedCap = p.speedCap; P.fallCap = p.fallCap;
}

/* ---------------- states ---------------- */
let gameStarted = false, resumable = false, lastMode = null, pendingStart = false, pendingPlace = false, pendingReset = false;
let respawning = false, resumeGrace = 0, headInside = false, compiledXR = false, viewShotBefore = null, audioStarted = false;
const isXR = () => G.mode === "ar" || G.mode === "vr";

function beginIntro(mode) {
  G.state = "intro";
  release(P, 0); release(P, 1);
  P.frozen = true;
  P.events.length = 0;
  ropes.setMode("special");
  portal.begin(mode, !save.intro);
  if (FLAGS.skipintro || (mode === "desktop" && D.mobile.enabled)) portal.skip();
}
// Portal done: the body starts where the head is, on the start roof. The rig does not move.
function handOff() {
  if (G.state !== "intro" && !(G.state === "paused" && G.pausedFrom === "intro")) return;
  const inp = G.input, S = city.start;
  toWorld(inp);
  const hx = inp.head.pos.x, hz = inp.head.pos.z;
  P.frozen = false;
  teleport(P, hx, S.y, hz);
  G.bodyLocal.x = inp.head.local.pos.x; G.bodyLocal.z = inp.head.local.pos.z;
  ropes.setMode("all");
  if (G.state === "paused") G.pausedFrom = "play"; else G.state = "play";
  // phone: start facing the gold ring and with the motion aim centred. Only the yaw turns: the view keeps its chase pitch (the aim
  // comes from the view, see flatInput), so the camera never tips up into the roof
  if (G.mode === "desktop" && D.mobile.enabled) {
    G.rigYaw = Math.atan2(-(city.goldRing.x - P.pos.x), -(city.goldRing.z - P.pos.z));
    D.mobile.reset();
  }
  if (flatOn) { flatcam.settle(); hero.setYaw(G.rigYaw); } // the camera pulls out of the eyes and tips down to the chase view
  syncRig();
  // stepped off the roof in the real room: fade and start on the roof proper
  const tb = city.topBelow(hx, S.y + 0.1, hz, 0.25);
  if (!tb || tb.y < S.y - 0.5) fadeMove(S.x, S.y, S.z);
  const first = !save.intro;
  save.intro = true;
  gameStarted = true;
  game.start(first);
  if (!worldVisible && game.root) game.root.visible = false;
  resumable = true;
  saveNow();
}
// Fade out, move the body and the rig, fade in. Used by respawns, travel and the hand-off check.
function fadeMove(x, y, z) {
  if (respawning) return;
  respawning = true;
  const look = G.mode === "ar" ? "room" : "black";
  Promise.resolve(ui.fade(1, 0.3, look)).then(() => {
    teleport(P, x, y, z);
    placeRig(G.rigYaw, x, y, z);
    respawning = false;
    return ui.fade(0, 0.4, look);
  }).catch((e) => { respawning = false; console.error(e); });
}
function respawn() { D.mobile.reset(); const L = P.lastSafe, s = city.nearestSafe(L.x, L.y, L.z); fadeMove(s.x, s.y, s.z); }
function travel(s) { if (s && Number.isFinite(s.x)) fadeMove(s.x, s.y, s.z); }

function syncPauseState() {
  if (ui.paused && (G.state === "play" || G.state === "intro")) { G.pausedFrom = G.state; G.state = "paused"; onPause(); }
  else if (!ui.paused && G.state === "paused") { G.state = G.pausedFrom || "play"; onResume(); }
}
function onPause() {
  D.mobile.reset();
  ropes.setMode("special");
  if (G.mode === "ar") setWorldVisible(false); // passthrough around the pause panel and the diorama
  audio.duck(true);
}
function onResume() {
  ropes.setMode(G.state === "intro" ? "special" : "all");
  if (!worldVisible) setWorldVisible(true);
  // fade the city back in, and keep hold of the ropes for a moment while the hands find the triggers again
  const look = G.mode === "ar" ? "room" : "black";
  Promise.resolve(ui.fade(1, 0, look)).then(() => ui.fade(0, 0.4, look)).catch(() => {});
  resumeGrace = 0.3;
  audio.duck(false);
  if (G.mode === "desktop") D.lock();
}

/* ---------------- entering and leaving play ---------------- */
async function startXR(mode) {
  if (!G.ready || X.session || starting) return;
  starting = true;
  setBusy(true);
  try { await X.start(mode); }
  catch (e) { console.warn("XR session did not start:", e && e.message); note(mode === "ar" ? "Mixed reality did not start. Try again, or use ENTER VR." : "VR did not start. Try again."); }
  finally { starting = false; setBusy(false); }
}
let starting = false;
function onSessionStart(session) {
  G.mode = X.mode;
  lastMode = G.mode;
  settings.easySwing = false;
  compiledXR = false;
  D.active = false;
  flatView(false);
  hideTitle();
  if (FLAGS.pwa) {
    // no click on a PWA launch: wake the audio on the first trigger or grip press
    const wake = () => { audioStarted = true; audio.resume(); session.removeEventListener("selectstart", wake); session.removeEventListener("squeezestart", wake); };
    session.addEventListener("selectstart", wake);
    session.addEventListener("squeezestart", wake);
  }
  if (!G.ready) { pendingStart = true; loadRing.visible = true; return; }
  enterPlay(G.mode);
}
function enterPlay(mode) {
  loadRing.visible = false; // from here the portal shows its own progress
  applyComfort(mode === "desktop" ? "desktop" : settings.preset);
  showHands(isXR());
  setWorldVisible(true);
  G.seatedOffset = comfort.seatedOffset || 0;
  // the rope pulls on the chest: a constant, scaled by the calibrated head height (never tracked, so crouching works)
  P.chest = SWING.chestH * clamp((settings.height > 0 ? settings.height : COMFORT.standingHead) / COMFORT.standingHead, 0.8, 1.2);
  if (resumable) {
    // back from a session that ended mid-play: carry on where you were, facing the same way
    G.state = "play";
    P.frozen = false;
    ropes.setMode("all");
    pendingPlace = true;
  } else beginIntro(mode);
}
function onSessionEnd() {
  const was = G.state;
  saveNow();
  if (ui && ui.paused) ui.closePause();
  if (was === "intro" || (was === "paused" && G.pausedFrom === "intro")) resumable = false;
  G.mode = "title"; G.state = "title";
  showHands(false);
  setWorldVisible(true);
  if (ropes) ropes.setVisible(false); // the attract camera flies the city, not your last rope
  renderer.setClearColor(COLORS.fog, 1);
  audio.duck(false);
  flatView(false);
  flatCamera(70);
  showTitle(true);
}
function startDesktop() {
  if (!G.ready || X.session) return;
  G.mode = "desktop";
  lastMode = "desktop";
  hideTitle();
  D.active = true;
  settings.easySwing = D.mobile.enabled;
  D.level();
  D.lock();
  flatCamera(75);
  enterPlay("desktop");
  flatView(true);
}
// Pause menu Exit: end the session (the title comes back with RE-ENTER), or leave flat play.
function exitPlay() {
  if (X.session) { X.end(); return; }
  if (G.mode !== "desktop") return;
  saveNow();
  if (G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro")) resumable = false;
  D.active = false;
  D.unlock();
  ropes.setVisible(false);
  G.mode = "title"; G.state = "title";
  flatView(false);
  flatCamera(70);
  showTitle(true);
}
function resetProgress() {
  const fresh = blankSave();
  for (const k of Object.keys(fresh)) if (k !== "settings") save[k] = fresh[k];
  saveNow();
  if (X.session) X.end().then(() => location.reload()); else location.reload();
}
function flatCamera(fov) {
  camera.fov = fov;
  camera.aspect = innerWidth / innerHeight;
  camera.near = PERF.cameraNear; camera.far = PERF.cameraFar;
  camera.updateProjectionMatrix();
}

/* ---------------- the third-person view (flat play) ---------------- */
// Flat play shows the hero and a chase camera (flatcam.js). The camera is a child of the scene there, placed in world
// coordinates; the rig still carries the body and the yaw, so the physics, the input and every G.test hook work as before.
// The intro stays first person (the cottage room is small); the camera pulls out at the hand-off. V (or input.viewDown) toggles.
let flatOn = false, lastPitchIn = 0, flatDy = 0, viewAttr = "";
const FLAT_LOOK = { dx: 0, dy: 0 }, FLAT_FLAGS = { swinging: false, forceFirst: false }, FLAT_VIEW = { pos: null, quat: null };
const FLAT_E = new THREE.Euler(0, 0, 0, "YXZ");
function flatView(on) {
  if (!hero || on === flatOn) return;
  flatOn = on;
  flatcam.active = on;
  if (on) {
    scene.add(camera);
    const intro = G.state === "intro";
    flatcam.reset(G.rigYaw, intro ? 0 : undefined, intro);
    if (!intro) hero.setYaw(G.rigYaw);
    hero.setVisible(true);
    lastPitchIn = 0; flatDy = 0; // startDesktop has just levelled the input's pitch
    if (!document.getElementById("flatview-css")) {
      // the crosshair of the first-person view would sit on the hero's neck; the target reticle marks the aim instead
      const st = document.createElement("style");
      st.id = "flatview-css";
      st.textContent = 'body[data-view="third"] .fs-cross { display: none; }';
      document.head.appendChild(st);
    }
  } else {
    rig.add(camera);
    camera.position.set(0, 0, 0); camera.quaternion.identity();
    hero.setVisible(false);
    viewAttr = ""; delete document.body.dataset.view;
  }
}
// The world direction the head aims along for a screen position (NDC x and y; 0, 0 is the middle): toward the point where that
// pixel's ray from the camera lands, so the rope goes where the view shows. The head is not where the camera is (the chase camera
// sits up to 5 m behind it), so the aim runs from the head to that point and not parallel to the view. In third person a view of
// only ground (a roof or street below the head, or water) is no anchor, and the default view looks down at the hero's feet: the
// aim then goes ahead along that bearing, AIM_UP above the horizon. Result in AIM_D.
const AIM_FAR = 400, AIM_UP = (20 * Math.PI) / 180;
const AIM_D = new THREE.Vector3(), AIM_HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
function viewAim(nx, ny, hx, hy, hz, third) {
  const f = Math.tan((camera.fov * Math.PI) / 360), c = camera.position;
  AIM_D.set(nx * f * camera.aspect, ny * f, -1).normalize().applyQuaternion(camera.quaternion);
  const h = city.raycast(c.x, c.y, c.z, AIM_D.x, AIM_D.y, AIM_D.z, AIM_FAR, AIM_HIT);
  if (third && (h ? h.ny > 0.7 && h.y < hy - 0.3 : AIM_D.y < 0)) {
    const l = Math.hypot(AIM_D.x, AIM_D.z) || 1, k = Math.cos(AIM_UP);
    return AIM_D.set((AIM_D.x / l) * k, Math.sin(AIM_UP), (AIM_D.z / l) * k);
  }
  const tx = h ? h.x : c.x + AIM_D.x * AIM_FAR, ty = h ? h.y : c.y + AIM_D.y * AIM_FAR, tz = h ? h.z : c.z + AIM_D.z * AIM_FAR;
  AIM_D.set(tx - hx, ty - hy, tz - hz);
  return AIM_D.lengthSq() > 1e-6 ? AIM_D.normalize() : AIM_D.set(0, 0, -1).applyQuaternion(camera.quaternion);
}
// After the input is read: the camera's pitch is the view, so the head, the muzzles and the aim rays follow it. The input's own
// pitch only brings the change (flatDy). A phone tap aims through its own pixel for the frame it fires (inp.phoneAim).
const FLAT_Q = new THREE.Quaternion(), XAXIS = new THREE.Vector3(1, 0, 0);
function flatInput(inp) {
  flatcam.restore(); // the input wrote the camera as the head; put the view back
  flatDy += inp.pitch - lastPitchIn;
  const p = flatcam.pitch, hp = inp.head.local.pos;
  // the input built the muzzles at its own pitch: turn them about the head to the view's, so they stay low in the first-person view
  FLAT_Q.setFromAxisAngle(XAXIS, p - inp.pitch);
  for (const h of inp.hands) { h.gripLocal.pos.sub(hp).applyQuaternion(FLAT_Q).add(hp); h.gripLocal.quat.premultiply(FLAT_Q); }
  // the input follows the view, so its own pitch limits never hold the camera back
  D.setPitch(p);
  lastPitchIn = inp.pitch = p;
  inp.head.local.quat.setFromEuler(FLAT_E.set(p, 0, 0));
  const c = Math.cos(G.rigYaw), s = Math.sin(G.rigYaw), R = rig.position;
  const hx = R.x + hp.x * c + hp.z * s, hy = R.y + hp.y, hz = R.z - hp.x * s + hp.z * c; // the head in the world (toWorld, which runs next)
  const third = flatcam.opacity > 0.5, tap = inp.phoneAim;
  viewAim(0, 0, hx, hy, hz, third);
  rotY(-G.rigYaw, AIM_D.x, AIM_D.z, T);
  inp.hands[0].aimLocal.dir.set(T.x, AIM_D.y, T.z);
  if (!tap) { inp.hands[1].aimLocal.dir.copy(inp.hands[0].aimLocal.dir); return; }
  viewAim(tap.x, tap.y, hx, hy, hz, third);
  rotY(-G.rigYaw, AIM_D.x, AIM_D.z, T);
  inp.hands[1].aimLocal.dir.set(T.x, AIM_D.y, T.z);
}
// The hero's pose and the camera, once the body has moved. In play the camera owns the yaw (it may turn toward your travel).
function flatFrame(dt, inp, yawDelta) {
  if (!flatOn || isXR()) return;
  const play = G.state === "play";
  const key = flatcam.takeKey();
  if (play && (inp.viewDown || key)) flatcam.toggle();
  flatcam.setYaw(G.rigYaw - (play ? yawDelta : 0));
  FLAT_LOOK.dx = (play ? yawDelta : 0) + ov.lookX;
  FLAT_LOOK.dy = (G.state === "paused" ? 0 : flatDy) + ov.lookY;
  ov.lookX = ov.lookY = 0; flatDy = 0;
  FLAT_FLAGS.swinging = P.ropes[0].state === "attached" || P.ropes[1].state === "attached";
  FLAT_FLAGS.forceFirst = G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro");
  hero.setVisible(!shot);
  hero.update(dt, P, ropes, inp);
  flatcam.update(dt, P, hero, FLAT_LOOK, FLAT_FLAGS);
  // body[data-view] tells the page (the crosshair, the touch buttons) which view is on
  const va = flatcam.opacity < 0.5 ? "first" : "third";
  if (va !== viewAttr) document.body.dataset.view = viewAttr = va;
  if (play && G.rigYaw !== flatcam.yaw) { G.rigYaw = flatcam.yaw; syncRig(); toWorld(inp); }
}
// The pose the ears, the comic words and the far city follow: the camera in flat play, the head otherwise.
function viewHead(inp) {
  if (!flatOn) return inp.head;
  FLAT_VIEW.pos = camera.position; FLAT_VIEW.quat = camera.quaternion;
  return FLAT_VIEW;
}

/* ---------------- the frame (spec §6, 14 steps) ---------------- */
const physIn = { move: { x: 0, z: 0 }, jump: false, hands: [0, 1].map(() => ({ pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false })) };
const lastAim = [null, null], fireWait = [0, 0], hapT = [0, 0], TIPS = [null, null], toggled = [false, false];
const prevVel = new THREE.Vector3(), accelV = new THREE.Vector3(), comfortIn = { vel: null, speed: 0, accel: 0, yawRate: 0, snapped: false, play: false, ar: false, mode: "xr" };
const ring = [];
let ringAt = 0;
function pushRing(ev) {
  const e = { ...ev, frame: G.frame, time: +G.time.toFixed(4) };
  if (ring.length < 128) ring.push(e); else ring[ringAt] = e;
  ringAt = (ringAt + 1) % 128;
}

function tick(dt, frame, time) {
  // 1. time
  G.dt = dt; G.time += dt; G.frame++;
  if (!G.ready) return;
  if (G.mode === "title") { tickTitle(dt); return; }
  // 2. input
  const inp = (G.input = isXR() ? X.update(frame, time) : D.update(dt));
  if (flatOn && !isXR()) flatInput(inp);
  // 3. test overrides
  applyOverrides(inp);
  // the raw edges go in the event ring before the UI can claim them, so a test sees each edge even when the test
  // clock releases several frames at once
  for (const h of inp.hands) {
    if (h.triggerDown) pushRing({ type: "input", side: h.index, edge: "triggerDown", value: h.trigger });
    if (h.triggerUp) pushRing({ type: "input", side: h.index, edge: "triggerUp", value: h.trigger });
    if (h.gripDown) pushRing({ type: "input", side: h.index, edge: "gripDown", value: h.grip });
    if (h.gripUp) pushRing({ type: "input", side: h.index, edge: "gripUp", value: h.grip });
  }
  // 4. world poses from the current rig
  toWorld(inp);
  const hl = inp.head.local.pos;
  G.seatedOffset = comfort.seatedOffset || 0;
  if (pendingPlace) {
    pendingPlace = false;
    placeRig(G.rigYaw, P.pos.x, P.pos.y, P.pos.z);
    G.prevHeadLocal.copy(hl);
    toWorld(inp);
  }
  if (pendingReset) {
    // the headset recentred: keep the body, its speed and the yaw; only the head's tracking origin moved
    pendingReset = false;
    G.bodyLocal.x = hl.x; G.bodyLocal.z = hl.z;
    G.prevHeadLocal.copy(hl);
    if (G.state === "play" || (G.state === "paused" && G.pausedFrom === "play")) syncRig();
    toWorld(inp);
  }
  // 5. a hidden or blurred session: nothing moves, but the loop keeps rendering
  if (!inp.visible) { G.prevHeadLocal.copy(hl); return; }
  // 6. ui (it may take the trigger edges of a hand that points at a panel, and it sets menuDown for the wrist button)
  ui.update(dt, inp, P, game.progress);
  // 7. menu and map
  if (inp.menuDown && (G.state === "play" || G.state === "intro" || G.state === "paused")) { if (ui.paused) ui.closePause(); else ui.openPause(); }
  if (inp.mapDown && G.state === "play") ui.openMap();
  syncPauseState();
  const paused = G.state === "paused";
  if (resumeGrace > 0 && !paused) resumeGrace -= dt;
  // 8. the opening (it may place the rig: then the world poses follow at once)
  if (G.state === "intro") { portal.update(dt, G.time, G.frame, inp); toWorld(inp); }
  // 9. aim and fire
  if (!paused && (G.state === "play" || G.state === "intro")) aimAndFire(dt, inp);
  // 10. the body follows the head, then the physics substeps
  if (G.state === "intro") {
    P.pos.x = inp.head.pos.x; P.pos.y = city.start.y; P.pos.z = inp.head.pos.z;
    P.vel.x = P.vel.y = P.vel.z = 0;
  } else if (G.state === "play") couple(inp);
  if (!paused && (G.state === "play" || G.state === "intro")) physics(dt, inp);
  // 11. events
  drainEvents();
  // 12. turning, the rig, world poses again
  let yawDelta = 0;
  if (G.state === "play") {
    yawDelta = inp.mode === "desktop" ? inp.turn : comfort.turn(inp, dt);
    G.rigYaw += yawDelta;
    syncRig();
    toWorld(inp);
  }
  G.prevHeadLocal.copy(hl);
  // 13. the rest of the world
  after(dt, inp, yawDelta);
}

// Title: build the city under the loading bar and fly the attract camera.
function tickTitle(dt) {
  buildView();
  if (!shot) attract(G.time);
  view.update(dt, G.time, camera.position);
}
function buildView() {
  if (G.viewDone) return;
  G.viewDone = !!view.build(PERF.buildBudgetMs);
  loadBar(G.viewDone ? 1 : typeof view.progress === "number" ? view.progress : 0);
  if (G.viewDone) loadRing.visible = false;
}

// Coupling (spec §6): on the ground the body follows the head; in the air the head leans freely.
function couple(inp) {
  const hl = inp.head.local.pos, pv = G.prevHeadLocal;
  if (!P.onGround) return;
  const dx = hl.x - pv.x, dz = hl.z - pv.z;
  if (dx * dx + dz * dz <= 0.25) {
    G.bodyLocal.x += dx; G.bodyLocal.z += dz;
    rotY(G.rigYaw, dx, dz, T);
    P.pos.x += T.x; P.pos.z += T.z;
  } else { G.bodyLocal.x = hl.x; G.bodyLocal.z = hl.z; }
}

// 9. Every connected hand with an idle rope aims (that drives its reticle). A trigger press fires at a valid target;
// a held trigger still fires if a target shows up within SWING.fireHold; with none it is a dry fire.
function aimAndFire(dt, inp) {
  for (let i = 0; i < 2; i++) {
    const h = inp.hands[i], r = P.ropes[i];
    // A tap on a new building switches anchors without a separate release step.
    if (inp.easySwing && i === 1 && inp.phoneFire && r.state !== "idle") {
      const next = ropes.aim(i, h.aimPos, h.aimDir, P.vel);
      if (next?.valid && !ui.blocking(i)) shoot(i, h, next);
      else D.mobile.miss(true);
      continue;
    }
    if (!h.connected || r.state !== "idle") {
      // "toggle" hold (a pause option): the next press lets go instead of the trigger opening
      if (r.state !== "idle" && h.triggerDown && settings.hold === "toggle") toggled[i] = false;
      lastAim[i] = null; fireWait[i] = 0;
      continue;
    }
    const a = (lastAim[i] = ropes.aim(i, h.aimPos, h.aimDir, P.vel));
    const blocked = ui.blocking(i), ok = !!a && a.valid && !blocked;
    if (inp.easySwing && i === 1) D.mobile.target(ok, false);
    if (h.triggerDown && !blocked) {
      if (ok) shoot(i, h, a); else fireWait[i] = SWING.fireHold;
    } else if (fireWait[i] > 0) {
      if (blocked) fireWait[i] = 0;
      else if (ok && h.holding) { shoot(i, h, a); fireWait[i] = 0; }
      else if (!h.holding || (fireWait[i] -= dt) <= 0) { dryFire(i, h); fireWait[i] = 0; }
    }
  }
}
function shoot(i, h, a) {
  fire(P, i, h.aimPos, a);
  toggled[i] = true;
  if (G.input.easySwing && P.onGround) {
    // Launch only after a valid attach target is found. A miss never jumps off a roof.
    G.input.jumpDown = true;
    const dx = a.x - P.pos.x, dz = a.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > .01) { P.vel.x += dx / d * 5; P.vel.z += dz / d * 5; }
  }
  audio.sfx("fire", { pos: h.aimPos });
  haptic(i, 0.2, 20);
  pushRing({ type: "fire", side: i, target: { tag: a.tag, id: a.id } });
  wordAtHand("THWIP", i);
}
function dryFire(i, h) {
  if (G.input.easySwing && i === 1) D.mobile.miss();
  ropes.dryFire(i, h.aimPos, h.aimDir);
  audio.sfx("dry", { pos: h.aimPos });
  haptic(i, 0.15, 30);
  pushRing({ type: "dry", side: i });
}

// 10. n = ceil(dt / fixedDt) equal substeps (no accumulator, so no judder between frames).
function physics(dt, inp) {
  const n = Math.min(SWING.maxSubsteps, Math.max(1, Math.ceil(dt / SWING.fixedDt - 1e-9))), h = dt / n;
  const intro = G.state === "intro";
  // move: the stick (or WASD) relative to where the head looks, flattened
  const yaw = G.rigYaw + yawOfQuat(inp.head.local.quat), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let mx = 0, mz = 0;
  if (!intro) { mx = -fz * inp.move.x + fx * inp.move.y; mz = fx * inp.move.x + fz * inp.move.y; }
  const ml = Math.sqrt(mx * mx + mz * mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  physIn.move.x = mx; physIn.move.z = mz;
  // desktop Space: a jump on the ground, a yank on every rope in the air
  const airYank = inp.mode === "desktop" && inp.jumpDown && !P.onGround;
  physIn.jump = !intro && inp.jumpDown && !airYank;
  for (let i = 0; i < 2; i++) {
    const src = inp.hands[i], o = physIn.hands[i];
    o.pos.x = src.gripPos.x; o.pos.y = src.gripPos.y; o.pos.z = src.gripPos.z;
    // velRel is tracking space; physics dots it with world directions, so turn it by the rig's yaw
    rotY(G.rigYaw, src.velRel.x, src.velRel.z, T);
    o.velRel.x = T.x; o.velRel.y = src.velRel.y; o.velRel.z = T.z;
    o.yank = airYank ? Math.max(src.yank, 2.5) : src.yank;
    const r = P.ropes[i];
    const autoPull = inp.easySwing && i === 1 && src.holding && r.state === "attached" && r.len > 14 && !r.sticky && r.tension < .65;
    o.grip = Math.max(src.grip, autoPull ? .72 : 0);
    o.holding = (!inp.easySwing && settings.hold === "toggle" ? toggled[i] && P.ropes[i].state !== "idle" : src.holding) || resumeGrace > 0;
    o.reeling = false;
  }
  const wasGround = P.onGround;
  for (let k = 0; k < n; k++) step(P, h, physIn);
  if (!intro && !wasGround && P.onGround && !P.dead) {
    // landing: the body goes under the head, in the same frame, so the camera does not move
    const hl = inp.head.local.pos;
    rotY(G.rigYaw, hl.x - G.bodyLocal.x, hl.z - G.bodyLocal.z, T);
    P.pos.x += T.x; P.pos.z += T.z;
    G.bodyLocal.x = hl.x; G.bodyLocal.z = hl.z;
  }
}

// 11. One drain per frame: the portal hears them in the intro, the game in play; main plays the feedback.
function drainEvents() {
  const evs = P.events;
  if (!evs.length) return;
  const intro = G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro");
  for (let k = 0; k < evs.length; k++) {
    const ev = evs[k];
    pushRing(ev);
    try { if (intro) portal.onEvent(ev); else game.onEvent(ev, P); } catch (e) { console.error(e); }
    feedback(ev);
  }
  evs.length = 0;
}
function feedback(ev) {
  const i = ev.side === 1 || ev.side === "right" ? 1 : 0, r = P.ropes[i];
  switch (ev.type) {
    case "attach": audio.sfx("stick", { pos: r.anchor }); haptic(i, 0.5, 30); fx.word("THUCK", r.anchor, { dir: r.normal }); break;
    case "detach": audio.sfx("release", { pos: G.input.hands[i].gripPos }); break;
    case "yank":
      audio.sfx(ev.pump ? "pump" : "yank", { pos: G.input.hands[i].gripPos }); haptic(i, 0.6, 40);
      if (ev.pump) fx.word("SPLORT", r.anchor, { dir: FX_UP, scale: 1.2 }); else wordAtHand("YANK", i);
      break;
    case "land": audio.sfx("land", { vol: clamp(ev.speed / 10, 0.3, 1.5) }); break;
    case "splash": audio.sfx("splash"); wordAhead("KASPLASH", P.pos, 2.6, 1, 1.5); respawn(); break;
    case "oob": respawn(); break;
    case "bump": audio.sfx("bump", { vol: clamp(ev.speed / 10, 0.3, 1.5) }); haptic(0, Math.min(1, ev.speed / 10), 50); haptic(1, Math.min(1, ev.speed / 10), 50); wordAtBump(ev); break;
    case "snap": if (G.input.easySwing && i === 1) D.mobile.miss(); audio.sfx("snap", { pos: r.anchor }); break;
  }
}

/* ---------------- comic words (fx.js) ---------------- */
// fx.js skips a word closer than 1.2 m to the head, so the words for your own body go out along the line to the hand or
// ahead of you, never on you. Sizes come from fx.js (8 to 12 degrees across); scale makes the big moments bigger.
const FX_UP = { x: 0, y: 1, z: 0 }, FXP = new THREE.Vector3(), FXD = new THREE.Vector3(), FXQ = new THREE.Vector3();
let whooshAt = -99, whooshArmed = true;
// on the line from the head through the hand's muzzle, 1.7 m from the head
function wordAtHand(name, i) {
  const hp = G.input.head.pos, t = TIPS[i] || hands.tip(i);
  FXD.set(t.x - hp.x, t.y - hp.y, t.z - hp.z);
  const l = FXD.length();
  if (l < 1e-3) return;
  FXD.multiplyScalar(1.7 / l);
  // 0.35 m outboard (away from the rope, which runs toward the middle of the view), and it keeps pace with you (vel),
  // or a swing would leave it behind in 0.1 s
  FXQ.set(i === 1 ? 0.35 : -0.35, 0, 0).applyQuaternion(G.input.head.quat);
  fx.word(name, FXP.set(hp.x + FXD.x + FXQ.x, hp.y + FXD.y + 0.25, hp.z + FXD.z + FXQ.z), { vel: P.vel, scale: 1.5 });
}
// dist metres ahead of `from` along where the head looks (flat), and up metres higher
function wordAhead(name, from, dist, up, scale) {
  FXD.set(0, 0, -1).applyQuaternion(G.input.head.quat);
  FXD.y = 0;
  if (FXD.lengthSq() < 1e-4) FXD.set(0, 0, -1); else FXD.normalize();
  fx.word(name, FXP.set(from.x + FXD.x * dist, from.y + up, from.z + FXD.z * dist), { scale });
}
// on the wall you hit, 1.3 m along it to the side you face, so it is not on top of your own head
function wordAtBump(ev) {
  const nx = ev.nx || 0, nz = ev.nz || 0, hp = G.input.head.pos, l = Math.sqrt(nx * nx + nz * nz);
  const cx = P.pos.x - nx * 0.35, cy = P.pos.y + P.chest - (ev.ny || 0) * 0.35, cz = P.pos.z - nz * 0.35;
  FXD.set(0, 0, -1).applyQuaternion(G.input.head.quat);
  if (l < 0.3) { fx.word("BONK", FXP.set(hp.x + FXD.x * 1.6, hp.y + FXD.y * 1.6, hp.z + FXD.z * 1.6), { scale: 1.4 }); return; }
  // a tangent along the wall (flat), turned to the side the head faces
  let tx = nz / l, tz = -nx / l;
  if (tx * FXD.x + tz * FXD.z < 0) { tx = -tx; tz = -tz; }
  fx.word("BONK", FXP.set(cx + tx * 1.3, cy + 0.2, cz + tz * 1.3), { dir: { x: nx, y: 0, z: nz }, scale: 1.4 });
}

// 13. Everything that draws or sounds.
function after(dt, inp, yawDelta) {
  buildView();
  const inPlay = G.state === "play";
  flatFrame(dt, inp, yawDelta); // flat play: the hero's pose, then the chase camera
  const vh = viewHead(inp);
  hands.update(inp, P, dt);
  TIPS[0] = hands.tip(0); TIPS[1] = hands.tip(1);
  // third person: the ropes leave the hero's own hands (the old muzzles stay for first person)
  if (flatOn && flatcam.opacity > 0.5) { TIPS[0] = hero.hand(0); TIPS[1] = hero.hand(1); }
  ropes.update(dt, P, TIPS, G.time);
  game.update(dt, G.time, P, inp); // before the hand-off it only lets the sleeping King breathe
  view.update(dt, G.time, vh.pos);
  // comfort: the 50 ms low-passed acceleration, the smooth-turn rate, and whether a snap happened
  const speed = Math.sqrt(P.vel.x * P.vel.x + P.vel.y * P.vel.y + P.vel.z * P.vel.z);
  // WHOOSH: once as you cross 20 m/s, 14 m ahead along your path, at most every 4 s
  if (inPlay && speed >= 20 && whooshArmed && G.time - whooshAt >= 4) {
    whooshAt = G.time; whooshArmed = false;
    const hp = inp.head.pos, k = 14 / speed;
    fx.word("WHOOSH", FXP.set(hp.x + P.vel.x * k, hp.y + P.vel.y * k + 1.2, hp.z + P.vel.z * k), { vel: P.vel, scale: 1.3 });
  } else if (speed < 17) whooshArmed = true;
  fx.update(dt, vh.pos, vh.quat);
  if (dt > 0) {
    const k = 1 - Math.exp(-dt / 0.05);
    accelV.x += ((P.vel.x - prevVel.x) / dt - accelV.x) * k; accelV.y += ((P.vel.y - prevVel.y) / dt - accelV.y) * k; accelV.z += ((P.vel.z - prevVel.z) / dt - accelV.z) * k;
  }
  prevVel.set(P.vel.x, P.vel.y, P.vel.z);
  comfortIn.vel = P.vel; comfortIn.speed = speed; comfortIn.accel = inPlay ? accelV.length() : 0;
  const smooth = settings.turn === "smooth" && inp.mode === "xr";
  comfortIn.yawRate = smooth && dt > 0 ? (Math.abs(yawDelta) / dt) * (180 / Math.PI) : 0;
  comfortIn.snapped = !smooth && inp.mode === "xr" && yawDelta !== 0;
  // the vignette only works in play; in AR it shows the real room; flat play has no seated offset
  comfortIn.play = inPlay; comfortIn.ar = G.mode === "ar"; comfortIn.mode = inp.mode;
  comfort.update(dt, comfortIn);
  if (G.mode === "ar" && inPlay) comfort.reality(X, inp.head.local.pos, inp.hands, P);
  // the head inside a wall: fade to the fog colour (to passthrough in AR). The head is never pushed.
  if (inPlay) {
    const inside = city.collideSphere(inp.head.pos.x, inp.head.pos.y, inp.head.pos.z, 0.12);
    if (inside !== headInside && !respawning) { headInside = inside; ui.fade(inside ? 1 : 0, 0.1, G.mode === "ar" ? "room" : "fog"); }
  }
  // desktop: a wider view at speed (75° plus up to 12° from 15 to 35 m/s)
  if (G.mode === "desktop" && !shot && !flatOn) { // (the flat camera sets its own field of view)
    const want = 75 + 12 * clamp((speed - 15) / 20, 0, 1);
    if (Math.abs(want - camera.fov) > 0.01) { camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
  }
  audio.setListener(vh.pos, vh.quat);
  audio.setWind(inPlay ? speed : 0, P.pos.y);
  for (let i = 0; i < 2; i++) {
    const r = P.ropes[i], on = r.state === "attached";
    audio.setRope(i, on ? r.tension : 0);
    // rope tension in the hand: a light pulse every 50 ms while attached
    if (on && isXR()) { hapT[i] -= dt; if (hapT[i] <= 0) { hapT[i] = 0.05; haptic(i, 0.05 + 0.35 * r.tension, 40); } } else hapT[i] = 0;
  }
  audio.update(dt);
}

/* ---------------- the loop ---------------- */
let lastTime = -1, fps = 60, titleCompiled = false;
const lastInfo = { calls: 0, tris: 0, views: 1 };
const samples = [];
const errSeen = new Set();
function loop(time, frame) {
  try {
    const raw = lastTime < 0 ? 1 / 60 : (time - lastTime) / 1000;
    lastTime = time;
    if (raw > 0 && raw < 1) fps += (1 / raw - fps) * 0.1;
    const dt = raw > 0 ? Math.min(raw, 1 / 30) : 1 / 1000;
    if (!G.held) tick(dt, frame, time);
    render(frame);
  } catch (e) {
    // an exception in the XR callback would stop three's loop for good: report it once and keep going
    const k = String(e && e.message);
    if (!errSeen.has(k)) { errSeen.add(k); console.error(e); }
  }
}
function render(frame) {
  const xr = renderer.xr.isPresenting;
  if (loadRing.visible) loadRing.rotation.z -= 0.08;
  if (shot && !xr) applyShot();
  if (xr && frame && !compiledXR) {
    // multiview programs differ from the flat ones: compile them now, with the XR target bound
    renderer.compile(scene, camera);
    compiledXR = true;
  }
  // The title covers the canvas with the key art (index.html sets data-art when it has loaded), so nothing behind it needs
  // drawing: that saves a full city render on the headset's browser. Once the city is built, its programs compile once
  // without a draw, so the first frame of play does not stall on them.
  if (G.mode === "title" && !shot && !samples.length && !FLAGS.debug && document.documentElement.hasAttribute("data-art")) {
    if (G.viewDone && !titleCompiled) { titleCompiled = true; renderer.compile(scene, camera); }
    return;
  }
  renderer.render(scene, camera);
  const info = renderer.info.render;
  lastInfo.calls = info.calls; lastInfo.tris = info.triangles;
  lastInfo.views = xr ? renderer.xr.getCamera().cameras.length || 1 : 1;
  if (samples.length) readSamples();
  if (FLAGS.debug) debugTick();
}
// Pixels must be read in the same task as the draw (the XR framebuffer is gone after the callback).
function readSamples() {
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
  const read = ([fx, fy]) => { gl.readPixels(clamp(Math.floor(w * fx), 0, w - 1), clamp(Math.floor(h * (1 - fy)), 0, h - 1), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0], px[1], px[2], px[3]]; };
  for (const q of samples.splice(0)) {
    try { q.resolve(Array.isArray(q.points) ? q.points.map(read) : Object.fromEntries(Object.entries(q.points).map(([k, p]) => [k, read(p)]))); } catch (e) { q.reject(e); }
  }
}

/* ---------------- the attract camera and named shots ---------------- */
// Over the lake at golden hour, looking north at the skyline and the Needle; it drifts slowly left and right.
function attract(t) {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.updateMatrixWorld(true);
  const a = REDUCED ? 0.15 : Math.sin(t * 0.035);
  camera.position.set(-90 + 330 * a, 62 + (REDUCED ? 0 : 18 * Math.sin(t * 0.05)), 560 - (REDUCED ? 0 : 50 * Math.cos(t * 0.035)));
  camera.lookAt(-90 + 140 * a, 105, 40);
}
let shot = null, diorama = null;
function shotPose(name) {
  const c = city, S = c.start, N = c.needle;
  switch (name) {
    case "start": return { pos: [S.x, S.y + COMFORT.standingHead, S.z], at: [S.x - Math.sin(S.yaw) * 100, S.y + 10, S.z - Math.cos(S.yaw) * 100] };
    case "needle": return { pos: [N.x + 45, 190, N.z - 256], at: [N.x, 230, N.z] }; // a clear line to the whole Needle, the sunset behind it
    case "canyon": return { pos: [-18, 24, -60], at: [-18, 60, -400] };
    case "harbour": return { pos: [-90, 28, 470], at: [-90, 80, 150] };
    case "aerial": return { pos: [120, 720, 640], at: [-40, 0, -200] };
    case "street": return { pos: [-154.5, 1.7, 30.5], at: [-162, 8, -300] }; // the sidewalk corner, clear of the traffic
    case "diorama": return { pos: [0, 1.65, 0], at: [0, 1.0, -1.1], diorama: true };
    default: return null;
  }
}
function applyShot() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.updateMatrixWorld(true);
  camera.position.fromArray(shot.pos);
  camera.lookAt(shot.at[0], shot.at[1], shot.at[2]);
  if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
}
function setShot(name) {
  if (diorama) { diorama.removeFromParent(); diorama = null; }
  if (viewShotBefore) { setWorldVisible(viewShotBefore.world); renderer.setClearColor(COLORS.fog, 1); viewShotBefore = null; }
  shot = name ? shotPose(name) : null;
  if (hero && flatOn) hero.setVisible(!shot); // a named shot is the city, not the hero (flatFrame keeps it in step)
  if (!shot) return null;
  if (shot.diorama) {
    viewShotBefore = { world: worldVisible };
    setWorldVisible(false);
    renderer.setClearColor(0x1a1020, 1);
    diorama = view.makeDiorama(1.0);
    diorama.position.set(0, 1.0, -1.1);
    scene.add(diorama);
  }
  applyShot();
  return { pos: shot.pos.slice(), at: shot.at.slice() };
}

/* ---------------- the 2D page ---------------- */
function showTitle(reenter) {
  G.titleShows++;
  document.documentElement.removeAttribute("data-pwa");
  document.body.dataset.mode = "title";
  const t = $("#title");
  t.hidden = false;
  const re = $("#reenter");
  if (reenter && lastMode) {
    re.hidden = false;
    $("#reenterBtn").textContent = lastMode === "ar" ? "RE-ENTER MIXED REALITY" : lastMode === "vr" ? "RE-ENTER VR" : "RE-ENTER ON THIS SCREEN";
    $("#reenterBtn").focus({ preventScroll: true });
  } else re.hidden = true;
  const sp = $("#stubPause");
  if (sp) sp.hidden = true;
}
function hideTitle() {
  document.body.dataset.mode = G.mode;
  $("#title").hidden = true;
  for (const d of document.querySelectorAll("dialog[open]")) d.close();
}
let lastPct = -1;
function loadBar(p) {
  const pct = Math.round(clamp(p, 0, 1) * 100);
  if (pct === lastPct) return;
  lastPct = pct;
  const bar = $("#load");
  bar.setAttribute("aria-valuenow", String(pct));
  $("#loadFill").style.transform = "scaleX(" + pct / 100 + ")";
  $("#loadText").textContent = pct >= 100 ? "The city is ready." : "Building the city… " + pct + " %";
  bar.classList.toggle("done", pct >= 100);
}
function setBusy(on) { for (const b of document.querySelectorAll("[data-enter]")) b.disabled = on; }
function note(text) { const n = $("#note"); n.textContent = text; n.hidden = !text; }

function wireTitle() {
  const enter = (mode) => {
    // the click is the user activation: wake the audio now, before anything waits
    audio.init();
    audioStarted = true;
    note("");
    if (mode === "desktop") { D.mobile.start(); startDesktop(); } else startXR(mode);
  };
  $("#enterAR").addEventListener("click", () => enter("ar"));
  $("#enterVR").addEventListener("click", () => enter("vr"));
  $("#playFlat").addEventListener("click", () => enter("desktop"));
  $("#reenterBtn").addEventListener("click", () => enter(lastMode || "desktop"));
  for (const [btn, dlg] of [["#howBtn", "#how"], ["#comfortBtn", "#comfort"]]) {
    $(btn).addEventListener("click", () => { const d = $(dlg); if (d.showModal) d.showModal(); else d.setAttribute("open", ""); });
  }
  for (const b of document.querySelectorAll("dialog [data-close]")) b.addEventListener("click", () => b.closest("dialog").close());
  for (const d of document.querySelectorAll("dialog")) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  // the comfort preset: saved at once, and used from the next time you enter
  for (const r of document.querySelectorAll("input[name=preset]")) {
    r.checked = r.value === settings.preset;
    r.addEventListener("change", () => {
      if (!r.checked) return;
      comfort.applyPreset(r.value);
      settings.preset = r.value;
      if (isXR()) applyComfort(r.value);
      saveNow();
    });
  }
  if (TOUCH_ONLY) { $("#playFlat").textContent = "PLAY ON PHONE"; $("#touchNote").hidden = false; }
  const quest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  if (quest && !matchMedia("(display-mode: standalone)").matches) $("#installHint").hidden = false;
  X.supported.then(({ vr, ar }) => {
    $("#enterAR").hidden = !ar;
    $("#enterVR").hidden = !vr;
    if (!vr && !ar && !TOUCH_ONLY) $("#noXR").hidden = false;
    document.body.dataset.xr = ar ? "ar" : vr ? "vr" : "none";
    G.supported = { vr, ar };
  });
  // flat play: a click on the city while paused goes back to play
  renderer.domElement.addEventListener("pointerdown", () => {
    if (G.mode !== "desktop") return;
    if (G.state === "paused") { ui.closePause(); D.lock(); }
    else if (!D.locked) D.lock();
  });
  D.onUnlock(() => { if (G.mode === "desktop" && (G.state === "play" || G.state === "intro")) { ui.openPause(); syncPauseState(); } });
  $("#version").textContent = "v" + VERSION;
  setBusy(false);
}

/* ---------------- test overrides and G.test (spec §12) ---------------- */
const ov = { press: [null, null], grip: [null, null], yank: [0, 0], aim: [null, null], lookX: 0, lookY: 0 };
const ovOn = [false, false], ovGrip = [false, false];
function applyOverrides(inp) {
  const c = Math.cos(G.rigYaw), s = Math.sin(G.rigYaw), R = rig.position;
  for (let i = 0; i < 2; i++) {
    const h = inp.hands[i];
    if (ov.press[i] === true) {
      h.trigger = 1; h.triggerDown = !ovOn[i]; h.triggerUp = false; h.holding = true; ovOn[i] = true;
    } else if (ov.press[i] === false) {
      h.trigger = 0; h.triggerUp = ovOn[i]; h.triggerDown = false; h.holding = false; ovOn[i] = false; ov.press[i] = null;
    }
    if (ov.grip[i] != null) {
      const v = ov.grip[i], on = v >= 0.7;
      h.grip = v; h.gripDown = on && !ovGrip[i]; h.gripUp = !on && ovGrip[i] && v < 0.4; ovGrip[i] = on;
    }
    if (ov.yank[i]) { h.yank = ov.yank[i]; ov.yank[i] = 0; }
    const t = ov.aim[i];
    if (t) {
      // aim at a world point from the hand's current aim origin: store it as a tracking-space direction
      const a = h.aimLocal.pos;
      const ax = R.x + a.x * c + a.z * s, ay = R.y + a.y, az = R.z - a.x * s + a.z * c;
      let dx = t.x - ax, dy = t.y - ay, dz = t.z - az;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      rotY(-G.rigYaw, dx, dz, T);
      h.aimLocal.dir.set(T.x, dy, T.z);
    }
  }
}
const v3 = (v) => ({ x: +v.x, y: +v.y, z: +v.z });
const q4 = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
function inputSnapshot() {
  const inp = G.input;
  return {
    mode: inp.mode, kind: inp.kind, visible: inp.visible,
    head: { local: { pos: v3(inp.head.local.pos), quat: q4(inp.head.local.quat) }, pos: v3(inp.head.pos), quat: q4(inp.head.quat) },
    move: { ...inp.move }, turn: inp.turn, pitch: inp.pitch, jumpDown: inp.jumpDown, menuDown: inp.menuDown, mapDown: inp.mapDown,
    hands: inp.hands.map((h) => ({
      side: h.side, index: h.index, connected: h.connected, kind: h.kind,
      gripLocal: { pos: v3(h.gripLocal.pos), quat: q4(h.gripLocal.quat) }, aimLocal: { pos: v3(h.aimLocal.pos), dir: v3(h.aimLocal.dir) },
      gripPos: v3(h.gripPos), gripQuat: q4(h.gripQuat), aimPos: v3(h.aimPos), aimDir: v3(h.aimDir),
      trigger: h.trigger, triggerDown: h.triggerDown, triggerUp: h.triggerUp, grip: h.grip, gripDown: h.gripDown, gripUp: h.gripUp,
      holding: h.holding, velRel: v3(h.velRel), yank: h.yank, palmUp: h.palmUp, joints: h.joints ? Array.from(h.joints) : null,
    })),
  };
}
G.test = {
  // logic without rendering; while held the loop only renders, so step owns time
  step(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) tick(dt, null, null); return G.test.state(); },
  hold(on = true) { G.held = !!on; return G.held; },
  state() {
    const inp = G.input, S = X && X.session;
    return {
      mode: G.mode, state: G.state, frame: G.frame, time: G.time, ready: G.ready, viewDone: G.viewDone,
      pos: P ? v3(P.pos) : null, vel: P ? v3(P.vel) : null, onGround: P ? P.onGround : false, dead: P ? P.dead : null, frozen: P ? P.frozen : false,
      ropes: P ? P.ropes.map((r) => ({ state: r.state, len: r.len, lenTarget: r.lenTarget, tag: r.target ? r.target.tag : null, id: r.target ? r.target.id : null, tension: r.tension, anchor: v3(r.anchor) })) : [],
      progress: game ? JSON.parse(JSON.stringify(game.progress)) : null,
      rig: { x: rig.position.x, y: rig.position.y, z: rig.position.z, yaw: G.rigYaw },
      head: v3(inp.head.pos), headLocal: v3(inp.head.local.pos), bodyLocal: { ...G.bodyLocal },
      portalPhase: portal ? portal.phase : null, paused: G.state === "paused", visible: inp.visible, handsVisible, fps: +fps.toFixed(1),
      xr: { session: !!S, mode: X ? X.mode : null, multiview: !!renderer.xr.isMultiview, blend: S ? S.environmentBlendMode : null, frameRate: X ? X.frameRate : null, requestedFrameRate: X ? X.requestedFrameRate : null, features: X ? X.features.slice() : [] },
    };
  },
  teleport(x, y, z) { teleport(P, x, y, z); placeRig(G.rigYaw, x, y, z); return v3(P.pos); },
  toLocal(x, y, z) { const R = rig.position; rotY(-G.rigYaw, x - R.x, z - R.z, T); return { x: T.x, y: y - R.y, z: T.z }; },
  toWorld(x, y, z) { const R = rig.position; rotY(G.rigYaw, x, z, T); return { x: R.x + T.x, y: R.y + y, z: R.z + T.z }; },
  aimAt(side, x, y, z) { ov.aim[side] = x == null ? null : { x, y, z }; },
  aim(side) { const a = lastAim[side]; return a ? { ...a } : null; },
  press(side, on) { ov.press[side] = on == null ? null : !!on; },
  grip(side, v) { ov.grip[side] = v == null ? null : +v; },
  yank(side, speed) { ov.yank[side] = +speed || 0; },
  events: () => JSON.parse(JSON.stringify(ring.length < 128 ? ring : ring.slice(ringAt).concat(ring.slice(0, ringAt)))),
  input: () => inputSnapshot(),
  skipIntro() { if (portal && (G.state === "intro" || G.pausedFrom === "intro")) portal.skip(); },
  wakeKing() { if (game && game.wakeKing) game.wakeKing(); },
  clearClog(id) { if (game && game.clearClog) game.clearClog(id); },
  portal: () => (portal ? portal.info() : null),
  ui: () => (ui && ui.info ? ui.info() : { paused: !!(ui && ui.paused), panel: null, buttons: [] }),
  uiPress(id) { if (ui && ui.press) ui.press(id); },
  reality: () => (comfort && comfort.realityInfo ? comfort.realityInfo() : { planes: X.planes.size, meshes: X.meshes.size, maxFade: 0 }),
  camera: (name) => setShot(name),
  // flat play: turn the view by dx (yaw, left is +) and dy (pitch, up is +) radians at the next frame, like a mouse move
  look(dx = 0, dy = 0) { ov.lookX += +dx || 0; ov.lookY += +dy || 0; },
  // flat play: where the camera is and what the hero does ({ on: false } everywhere else)
  flat: () => (flatcam && flatOn ? { on: true, camera: v3(camera.position), quat: q4(camera.quaternion), fov: camera.fov, ...flatcam.info(), forward: v3(flatcam.forward), hero: hero.info() } : { on: false }),
  renderInfo: () => ({ ...lastInfo }),
  sample: (points) => new Promise((resolve, reject) => samples.push({ points, resolve, reject })),
};

/* ---------------- debug ---------------- */
let dbgEl = null, dbgT = 0;
function debugTick() {
  if (!dbgEl) { dbgEl = document.createElement("pre"); dbgEl.id = "debug"; document.body.appendChild(dbgEl); }
  const now = performance.now();
  if (now - dbgT < 500) return;
  dbgT = now;
  const p = P ? P.pos : { x: 0, y: 0, z: 0 };
  dbgEl.textContent = `${fps.toFixed(0)} fps  ${lastInfo.calls} calls  ${(lastInfo.tris / 1000).toFixed(0)}k tris  ${lastInfo.views} view(s)\n${G.mode} / ${G.state}  pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`;
}

/* ---------------- boot ---------------- */
function onResize() {
  if (!renderer || renderer.xr.isPresenting) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
async function boot() {
  if (FLAGS.emulate) {
    try { await installEmulator(); } catch (e) { console.error("The Quest emulator did not load:", e); }
  }
  createStage();
  X.onStart(onSessionStart);
  X.onEnd(onSessionEnd);
  X.onReset(() => { pendingReset = true; });
  X.onVisibility((state) => {
    const vis = state === "visible";
    if (!vis) {
      // hidden or blurred (a system menu): freeze, hide the hands, quiet the sound, keep the ropes
      showHands(false);
      audio.duck(true);
      if (state === "hidden") audio.suspend();
      saveNow();
    } else {
      showHands(isXR());
      if (audioStarted) audio.resume(); // never create the sound outside a user gesture
      audio.duck(G.state === "paused");
      if (G.state === "play") { ui.openPause(); syncPauseState(); }
    }
  });
  renderer.setAnimationLoop(loop);
  addEventListener("resize", onResize);
  addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveNow();
    // on the phone (flat) the page itself hides; in a headset session the XR visibility callback above does this
    if (!isXR()) { if (document.hidden) audio.suspend(); else if (audioStarted) audio.resume(); }
  });

  // PWA launch (spec §6): the icon tap is the user activation, so ask for the session before building the city
  let launched = false;
  if (FLAGS.pwa) {
    // no audio.init() here: with no click it would only warn. The first trigger or grip press wakes it (onSessionStart)
    for (const m of ["ar", "vr"]) {
      try { await X.start(m); launched = true; break; } catch (e) { /* that mode is not here: try the next */ }
    }
  }
  if (!launched) showTitle(false);
  createWorld();
  wireTitle();
  G.ready = true;
  if (pendingStart && X.session) { pendingStart = false; enterPlay(G.mode); }
}
boot().catch((e) => { console.error(e); note("The game did not start. Reload the page."); });
