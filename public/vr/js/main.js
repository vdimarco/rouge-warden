// In Full Swing: the game loop. It boots the page (the 2D title over a live city, or straight into the headset when
// the app starts from its icon), owns the rig and the body, runs the 14 steps of every frame, routes events to the
// portal, the game and the feedback table, saves, and exposes window.G and G.test (spec §6 and §12).
import * as THREE from "three";
import { VERSION, SAVE_KEY, WORLD, SWING, COMFORT, PERF, COLORS, PHONE, CLIMB, TARGET, DESKTOP, PAD, HINT, MOVES } from "./config.js";
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
import { createCutscenes } from "./cutscene.js";
import { createStreet, STREET } from "./street.js";
import { createStreetView, createFigures } from "./streetview.js";
import { createCombat, FIGHT } from "./combat.js";
import { createCars, nearTraffic, trafficAt, CAR } from "./cars.js";
import { createJobs, JOB_NAMES } from "./jobs.js";
import { createActionView } from "./actionview.js";
import { createActionHud } from "./actionhud.js";
import { createBloom } from "./bloom.js";
import { createTarget, bidOf, project, releaseWindow, kick } from "./target.js";

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;
const QS = new URLSearchParams(location.search);
const ROOMS = ["office_small", "living_room", "meeting_room", "music_room", "office_large"];
const FLAGS = {
  god: QS.has("god"), skipintro: QS.has("skipintro"), nocut: QS.has("nocut"), nomv: QS.has("nomv"), debug: QS.has("debug"), nosw: QS.has("nosw"),
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
  return { preset: COMFORT.defaultPreset, vignette: p.vignette, turn: p.turn, snap: p.snap, aim: p.aim, vignetteLook: "room", seated: false, height: 0, hand: "right", hold: "hold", cue: true, hz: PERF.hz, foveation: PERF.foveation, music: true, speedLines: true };
}
// seen: the comic scenes already played (cutscene.js), so each plays once
function blankSave() { return { v: 1, intro: false, tutorial: false, clogs: [], loonies: [], bonus: 0, king: "sleeping", pipes: [], best: {}, seen: { opening: false, king: false, finale: false, mission2: false, districts: [] }, jobs: { sludge: false, done: {} }, settings: defaultSettings() }; }
function loadSave() {
  const s = blankSave(), raw = store.get(SAVE_KEY, null);
  if (!raw || typeof raw !== "object" || raw.v !== 1) return s;
  const ints = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => Number.isInteger(x) && x >= 0))] : []);
  s.intro = raw.intro === true; s.tutorial = raw.tutorial === true;
  s.clogs = ints(raw.clogs); s.loonies = ints(raw.loonies); s.pipes = ints(raw.pipes);
  s.bonus = Number.isFinite(raw.bonus) && raw.bonus >= 0 ? raw.bonus : 0;
  s.king = ["sleeping", "awake", "beaten"].includes(raw.king) ? raw.king : "sleeping";
  if (raw.seen && typeof raw.seen === "object") {
    for (const k of ["opening", "king", "finale", "mission2"]) s.seen[k] = raw.seen[k] === true;
    s.seen.districts = ints(raw.seen.districts).filter((d) => d < 6);
  }
  if (raw.jobs && typeof raw.jobs === "object") {
    s.jobs.sludge = raw.jobs.sludge === true;
    if (raw.jobs.done && typeof raw.jobs.done === "object") for (const [k, v] of Object.entries(raw.jobs.done)) if (JOB_NAMES[k] && Number.isInteger(v) && v > 0) s.jobs.done[k] = v;
  }
  if (raw.best && typeof raw.best === "object") for (const [k, v] of Object.entries(raw.best)) if (Number.isFinite(v) && v > 0) s.best[k] = v;
  const r = raw.settings && typeof raw.settings === "object" ? raw.settings : {}, t = s.settings;
  if (COMFORT.presets[r.preset] && r.preset !== "desktop" && r.preset !== "phone") t.preset = r.preset;
  if (r.vignette in COMFORT.vignetteMinFov) t.vignette = r.vignette;
  if (r.turn === "snap" || r.turn === "smooth") t.turn = r.turn;
  if ([30, 45, 90].includes(r.snap)) t.snap = r.snap;
  if (r.aim in SWING.aimCone) t.aim = r.aim;
  if (r.vignetteLook === "room" || r.vignetteLook === "black") t.vignetteLook = r.vignetteLook;
  if (typeof r.seated === "boolean") t.seated = r.seated;
  if (Number.isFinite(r.height) && r.height >= 0 && r.height < 3) t.height = r.height;
  if (r.hand === "left" || r.hand === "right") t.hand = r.hand;
  if (r.hold === "hold" || r.hold === "toggle") t.hold = r.hold;
  if (typeof r.cue === "boolean") t.cue = r.cue;
  if (r.hz === 72 || r.hz === 90) t.hz = r.hz;
  if (r.bloom === "off" || r.bloom === "low" || r.bloom === "high") t.bloom = r.bloom;
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
let city, P, view, ropes, hands, comfort, game, ui, portal, fx, hero, flatcam, picker, cutscenes, street, streetView, bloom;
let figures, combat, cars, jobs, actionView, actHud; // the city action (flat play): fights, cars, jobs
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
  D.chooseHand = chooseHand;
  G.input = D.input;
  audio = G.audio = createAudio(settings);
  bloom = G.bloom = createBloom(renderer); // flat play: the glow round the neon, the lamps and the sun
}
// Everything that needs the city. Normal boot does it before the title; the PWA does it after the session starts.
function createWorld() {
  city = G.city = generate(WORLD.seed);
  P = G.P = createPlayer(city);
  view = G.view = createCityView(renderer, scene, city, { low: false });
  street = G.street = createStreet(city); // people on the sidewalks and the shop signs (js/street.js)
  figures = G.figures = createFigures(scene, 240); // the people, the Sludge Gang and the job people, in two draws
  streetView = G.streetView = createStreetView(scene, street, figures);
  combat = G.combat = createCombat(city);
  cars = G.cars = createCars(city);
  jobs = G.jobs = createJobs({ city, combat, cars });
  actionView = G.actionView = createActionView(scene, { cars, jobs });
  actHud = G.actHud = createActionHud();
  ropes = G.ropes = createRopes(scene, city, settings);
  hands = G.hands = createHands(rig, scene, settings);
  comfort = G.comfort = createComfort(camera, rig, settings);
  fx = G.fx = createFX(scene, renderer); // the comic sound words; game.js reaches it as G.fx
  hero = G.hero = createHero(scene, renderer); // flat play: the hero and the chase camera (hidden and unused in XR)
  flatcam = G.flatcam = createFlatCam(camera, city);
  cutscenes = G.cutscenes = createCutscenes({ camera });
  picker = G.picker = createTarget(city); // flat play: the auto target (js/target.js)
  TCTX.specials = () => ropes.targets();
  ui = G.ui = createUI({ scene, camera, rig, renderer, city, view, save, settings, comfort, audio, xr: X, hands, saveNow, haptic, setWorldVisible });
  game = G.game = createGame({ scene, city, view, ropes, hands, ui, audio, P, save, settings, saveNow, haptic });
  game.onStory(story);
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
  if (streetView) streetView.setVisible(worldVisible);
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
// "desktop" preset (a phone: the "phone" preset, with faster physics) and puts your headset fields back when it ends.
// Flat play (a mouse or a phone) also climbs walls; a headset does not.
const FLAT_SWING = { ...SWING, climb: CLIMB, moves: MOVES }, PHONE_SWING = { ...SWING, ...PHONE.physics, climb: CLIMB, moves: MOVES };
function applyComfort(name) {
  const p = COMFORT.presets[name] || COMFORT.presets[COMFORT.defaultPreset];
  P.cfg = name === "phone" ? PHONE_SWING : name === "desktop" ? FLAT_SWING : SWING;
  if (name === "desktop" || name === "phone") {
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
  introYaw = 0;
  release(P, 0); release(P, 1);
  P.frozen = true;
  P.events.length = 0;
  ropes.setMode("special");
  portal.begin(mode, !save.intro);
  if (FLAGS.skipintro || (mode === "desktop" && D.mobile.enabled)) portal.skip();
  // flat play, first run: the comic of who the Porcelain King is comes first, then the cottage room
  if (mode === "desktop" && !save.seen.opening && !FLAGS.nocut && !FLAGS.skipintro) coldOpen();
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
  // the turn you looked around with in the opening becomes the rig's, so the view keeps facing where you look
  if (introYaw) { G.rigYaw += introYaw; introYaw = 0; }
  if (flatOn) { flatcam.settle(); hero.setYaw(G.rigYaw); } // the camera pulls out of the eyes and tips down to the chase view
  syncRig();
  // the toilet erupted (flat screen): the blast throws the hero out over the lake
  const launched = !!(portal && portal.launch);
  if (launched) { portal.launch = false; launchIntoLake(); if (flatOn) { flatcam.settle(); hero.setYaw(G.rigYaw); } syncRig(); }
  // stepped off the roof in the real room: fade and start on the roof proper
  const tb = city.topBelow(hx, S.y + 0.1, hz, 0.25);
  if (!launched && (!tb || tb.y < S.y - 0.5)) fadeMove(S.x, S.y, S.z);
  const first = !save.intro;
  save.intro = true;
  gameStarted = true;
  game.start(first);
  if (!worldVisible && game.root) game.root.visible = false;
  resumable = true;
  saveNow();
  // Mission 1, the Sludge Run, starts at once (the King's comic played before the cottage room); a returning save that has not
  // done it gets it too. The tests (?nocut, ?skipintro) start it only when they ask (G.test.job).
  if (!FLAGS.nocut && !FLAGS.skipintro) { if (lakeDrop) lakeDrop.sludge = true; else startSludge(); }
}
function coldOpen() {
  save.seen.opening = true;
  saveNow();
  const S = city.start, king = game.targets().find((t) => t.kind === "king") || { x: city.needle.x, y: 230, z: city.needle.z };
  const ctx = { city, king, clog: city.clogs[0], start: S, hero: { x: S.x, y: S.y + 1.6, z: S.z }, district: null };
  const was = G.state;
  G.state = "cutscene";
  cutscenes.play("opening", ctx, () => { if (G.state === "cutscene") G.state = was; });
}
// A comic scene (cutscene.js) in flat play, once per save: the opening after the hand-off, a district's briefing the first
// time you come near its clogs, the King waking, the finale. The game holds still while it plays (G.state "cutscene"); a
// headset plays none and shows the mission as a toast. ?skipintro and ?nocut (the tests) play none.
const STORY_TOAST = { mission2: () => "Mission 2: flush the twelve clogs.", king: () => "Mission 3: rip off the King's three pipes, then flush him.", finale: () => "All clear! Free roam: trials and Loonies." };
function story(name, arg, force) {
  if (!force && (FLAGS.nocut || FLAGS.skipintro || !save.seen)) return;
  const seen = save.seen;
  if (!force && (name === "district" ? !arg || seen.districts.includes(arg.id) : seen[name])) return;
  if (name === "district") seen.districts.push(arg.id); else seen[name] = true;
  saveNow();
  if (isXR() || !flatOn || G.state !== "play" || cutscenes.playing) { const t = STORY_TOAST[name]; if (t) ui.toast(t(arg)); return; }
  const king = game.targets().find((t) => t.kind === "king") || { x: city.needle.x, y: 230, z: city.needle.z };
  let clog = arg && arg.clog;
  if (!clog) { let bd = Infinity; for (const t of game.targets()) if (t.kind === "clog" && !t.done) { const d = Math.hypot(t.x - P.pos.x, t.z - P.pos.z); if (d < bd) { bd = d; clog = t; } } }
  if (!clog) clog = city.clogs[0];
  const head = hero.head && Number.isFinite(hero.head.x) ? hero.head : { x: P.pos.x, y: P.pos.y + COMFORT.standingHead, z: P.pos.z };
  const ctx = { city, king, clog, start: city.start, hero: { x: head.x, y: head.y, z: head.z }, district: arg || null };
  G.state = "cutscene";
  ropes.meshes.reticles.visible = false; // the aim marks of play (rope.js shows them again on its next frame)
  cutscenes.play(name, ctx, () => { if (G.state === "cutscene") G.state = "play"; flatcam.restore(); game.resay(); });
}
// The frame of a scene: the scene moves the camera; the city keeps its clock and the hero breathes; the game holds still.
function cutsceneFrame(dt, inp) {
  cutscenes.update(dt);
  if (!cutscenes.playing) { if (G.state === "cutscene") G.state = "play"; return; }
  buildView();
  if (flatOn) hero.update(dt, P, ropes, inp);
  view.update(dt, G.time, camera.position);
  streetFrame(dt, false);
  fx.update(dt, camera.position, camera.quaternion);
  // the music and the city go on under a scene (play() is not running): the ear follows the scene's camera
  audio.setListener(camera.position, camera.quaternion);
  audio.setWind(0, P.pos.y);
  audio.setRope(0, 0); audio.setRope(1, 0);
  audio.update(dt);
}
// The people on the sidewalks: they walk on round the player, and see the hero (in play only). The murmur follows them.
const CAMW = new THREE.Vector3();
const HERO_SEEN = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false };
function streetFrame(dt, inPlay) {
  street.limit = isXR() ? STREET.maxXR : STREET.max;
  HERO_SEEN.x = P.pos.x; HERO_SEEN.y = P.pos.y; HERO_SEEN.z = P.pos.z;
  HERO_SEEN.vx = P.vel.x; HERO_SEEN.vy = P.vel.y; HERO_SEEN.vz = P.vel.z; HERO_SEEN.onGround = !!P.onGround;
  const act = actionOn();
  street.update(dt, G.time, P.pos, inPlay ? HERO_SEEN : null, act ? cars.hazards() : null);
  figures.begin(camera.getWorldPosition(CAMW), G.time);
  streetView.update(dt, G.time, CAMW);
  if (act) {
    for (const g of combat.goons) if (g.on) figures.add(g, "goons");
    for (const q of jobs.people) if (q.on) figures.add(q, "jobs");
  }
  figures.end();
  actionView.setVisible(act && worldVisible);
  if (act) actionView.update(dt, G.time, { markers: G.state !== "cutscene", cam: CAMW });
  audio.setCrowd(inPlay ? street.crowd : 0);
}
/* ---------------- the city action: sprint, fights, cars and jobs (flat play) ---------------- */
// The action runs in flat play once the game has started; a headset keeps its swinging game.
let sprinting = false, energy = 1, energyWait = 0, driving = false, fightHints = 0, sludgeRetry = -1;
// The fall into the lake after the toilet erupts (flat screen): { t, sludge } while it lasts. The splash fishes the hero out on the
// start roof (respawn from lastSafe), and Mission 1 starts then, or when he lands somewhere else, or after 12 s.
let lakeDrop = null;
const LAKE_DROP = { y: 60, z: WORLD.shoreZ - 20, vy: 5, vz: 12, max: 12 };
function launchIntoLake() {
  const S = city.start;
  teleport(P, S.x, LAKE_DROP.y, LAKE_DROP.z);
  P.vel.x = 0; P.vel.y = LAKE_DROP.vy; P.vel.z = LAKE_DROP.vz;
  P.lastSafe.x = S.x; P.lastSafe.y = S.y; P.lastSafe.z = S.z;
  G.rigYaw = Math.PI; // facing the lake (+z)
  lakeDrop = { t: 0, sludge: false };
  wordAhead("WHOOOA!", P.pos, 3, 1, 1.2);
}
function endLakeDrop() {
  if (!lakeDrop) return;
  if (lakeDrop.sludge) sludgeRetry = 1.2;
  lakeDrop = null;
}
const HERO_FACE = { x: 0, z: -1 }, HERO_FIGHT = { x: 0, y: 0, z: 0, yaw: 0, onGround: false, safe: false, hidden: false, perch: false };
const ropeIds = new Set(), GOON_POS = new Map(), firePerch = [false, false];
function actionOn() { return flatOn && !isXR() && gameStarted && G.mode === "desktop"; }
// Shift on the ground with no rope out and a direction held: sprint while the energy lasts; the gauge fills again after a pause
function sprintFrame(dt, inp, moving) {
  const rope = P.ropes[0].state !== "idle" || P.ropes[1].state !== "idle";
  const want = actionOn() && G.state === "play" && !!inp.sprintHeld && P.onGround && !rope && !P.wall && moving > 0.3;
  if (want && energy > (sprinting ? 1e-3 : MOVES.minEnergy)) { sprinting = true; energy = Math.max(0, energy - MOVES.drain * dt); energyWait = MOVES.wait; if (energy <= 1e-3) { energy = 0; sprinting = false; } }
  else { sprinting = false; if ((energyWait -= dt) <= 0) energy = Math.min(1, energy + MOVES.fill * dt); }
}
function heroFight() {
  const H = HERO_FIGHT;
  H.x = P.pos.x; H.y = P.pos.y; H.z = P.pos.z; H.yaw = hero.yaw || 0; H.onGround = !!P.onGround;
  H.safe = driving || P.roll > 0 || G.state !== "play" || respawning; H.hidden = driving || respawning;
  H.perch = !!(P.onGround || P.wall) && P.ropes[0].state !== "attached" && P.ropes[1].state !== "attached";
  H.vx = P.vel.x; H.vy = P.vel.y; H.vz = P.vel.z; H.busy = driving || G.state !== "play"; H.driving = driving && G.state === "play";
  return H;
}
// a swing press with a goon in reach: the hero punches (or kicks) him
function tryAttack() {
  if (driving) return false;
  const a = combat.attack(heroFight());
  if (!a) return false;
  hero.attack(a.kind, a.side);
  audio.sfx(a.kind === "kick" ? "kick" : "punch", { pos: a.goon });
  fx.word("BONK", FXP.set(a.goon.x, a.goon.y + 2.1, a.goon.z), { scale: a.kind === "kick" ? 1.5 : 1.1 });
  haptic(1, 0.5, 30);
  catchFeedback(1, "yank");
  return true;
}
// a rope caught a goon (he is yanked off his feet), a falling person or the balloon (caught)
function ropeCatch(i, r) {
  const tag = r.target.tag, id = String(r.target.id);
  if (tag === "goon") {
    const hf = heroFight();
    hf.perch = firePerch[i];
    const how = combat.pull(+id.slice(5), hf);
    if (how === "takedown") { audio.sfx("yank", { pos: r.anchor, vol: 0.5 }); fx.word("THWIP", r.anchor, { scale: 1.3 }); haptic(i, 0.5, 40); }
    else if (how) { audio.sfx("yank", { pos: r.anchor }); fx.word("YANK", r.anchor, { scale: 1.3 }); }
  } else if (jobs.ropeCaught(tag)) {
    audio.sfx(tag === "getaway" ? "bump" : "stick", { pos: r.anchor });
    fx.word(tag === "getaway" ? "THUCK" : tag === "leak" ? "SPLORT" : "THWIP", r.anchor, { scale: 1.3 });
  }
  release(P, i);
}
// The rope targets: the fighting goons near the hero and a job's falling person or balloon. They are added and taken away as
// they come and go; a goon's target point is his chest.
function syncRopeTargets() {
  const want = new Map();
  if (actionOn() && G.state === "play" && !driving) {
    for (const g of combat.targets(heroFight())) {
      let q = GOON_POS.get(g.id);
      if (!q) { q = { x: 0, y: 0, z: 0 }; GOON_POS.set(g.id, q); }
      q.x = g.x; q.y = g.y + 1.1; q.z = g.z;
      want.set("goon:" + g.id, { id: "goon:" + g.id, tag: "goon", pos: q, radius: 1.3 });
    }
    for (const t of jobs.ropeTargets(P.pos)) want.set(t.id, t);
  }
  for (const id of ropeIds) if (!want.has(id)) { ropes.removeTarget(id); ropeIds.delete(id); if (id.startsWith("goon:")) GOON_POS.delete(+id.slice(5)); }
  for (const [id, t] of want) if (!ropeIds.has(id)) { ropes.addTarget(t); ropeIds.add(id); }
}
function enterCar(c) {
  release(P, 0); release(P, 1);
  cars.enter(c);
  driving = true; sprinting = false;
  hero.setHidden(true);
  P.vel.x = P.vel.y = P.vel.z = 0;
  audio.sfx("door", { pos: c }); audio.sfx("engine", { pos: c });
  ui.say(G.input.easySwing ? "GAS and BRAKE to drive, the arrows to steer. OUT to get out." : G.input.kind === "pad" ? "Stick to drive and steer, A for the handbrake. B to get out." : "W and S to drive, A and D to steer, Space for the handbrake. R to get out.", 4);
}
// Car theft: the street car in reach of the hero (on the ground, or just above it, off the walls), from the traffic shader's lanes
function canSteal() { return !P.wall && (P.onGround || P.pos.y < CAR.stealUp); }
function trafficNear() { return canSteal() ? nearTraffic(view.traffic && view.traffic(), P.pos.x, P.pos.z, G.time) : null; }
// the closest car in reach: { car } a parked one (or a stolen one left), { traffic } a street car, or null
function carInReach() {
  const c = P.onGround && !P.wall ? cars.near(P.pos.x, P.pos.y, P.pos.z) : null, t = trafficNear();
  if (c && (!t || Math.hypot(c.x - P.pos.x, c.z - P.pos.z) - CAR.half.w <= t.dist)) return { car: c };
  return t ? { traffic: t } : null;
}
// The street car stops and becomes the hero's car; its instance leaves the traffic; the driver jumps out and runs off shouting.
let shoutT = -1;
const SHOUT = { x: 0, y: 0, z: 0 };
function stealCar(t) {
  const c = cars.steal(t, P.pos);
  if (!c) return false;
  view.hideTraffic(t.i, true); // a reused slot's old traffic car comes back with the release event in actionFrame
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); // the driver's door is on the car's left
  const dx = c.x + fz * 1.4, dz = c.z - fx * 1.4;
  const d = street.bail(dx, dz, P.pos.x, P.pos.z, Math.abs(fx) > Math.abs(fz) ? "x" : "z");
  enterCar(c);
  SHOUT.x = d ? d.x : dx; SHOUT.y = 0; SHOUT.z = d ? d.z : dz; SHOUT.who = d;
  audio.sfx("gasp", { pos: SHOUT });
  shoutT = 2.4;
  return true;
}
// the driver's shout: a speech bubble over the driver, "HEY!" and then "MY CAR!", for 2.4 s (actionhud.js draws it)
const SHOUT_V = new THREE.Vector3(), SHOUT_OUT = { text: "", x: 0, y: 0 };
function shoutFrame(dt) {
  if (shoutT <= 0) return null;
  shoutT -= dt;
  const p = SHOUT.who;
  if (p && p.on) { SHOUT.x = p.x; SHOUT.z = p.z; }
  SHOUT_V.set(SHOUT.x, (p ? p.y : 0) + 2.2, SHOUT.z).project(camera);
  if (shoutT <= 0 || SHOUT_V.z > 1 || Math.abs(SHOUT_V.x) > 1.1 || Math.abs(SHOUT_V.y) > 1.1) return null;
  SHOUT_OUT.text = shoutT > 1.3 ? "HEY!" : "MY CAR!";
  SHOUT_OUT.x = (SHOUT_V.x * 0.5 + 0.5) * innerWidth; SHOUT_OUT.y = (0.5 - SHOUT_V.y * 0.5) * innerHeight;
  return SHOUT_OUT;
}
function exitCar() {
  const o = cars.exit();
  driving = false;
  hero.setHidden(false);
  if (!o) return;
  teleport(P, o.x, o.y, o.z);
  P.vel.x = o.vx; P.vel.z = o.vz;
  placeRig(G.rigYaw, o.x, o.y, o.z);
  audio.sfx("door", { pos: o });
}
const DRIVE_IN = { throttle: 0, steer: 0, handbrake: false };
let carWant = 0; // a car press with no car in reach waits this long (s) for one to come
// the car key, or a press still waiting: get into a parked car or steal a street car
function tryCar() {
  const r = carInReach();
  if (!r) return false;
  if (r.traffic) return stealCar(r.traffic); // ropes out too: enterCar lets them go
  if (P.ropes[0].state !== "idle" || P.ropes[1].state !== "idle") return false;
  enterCar(r.car);
  return true;
}
// 11b. After the physics and its events: the cars, the fights, the jobs, the rope targets and the screen bits
function actionFrame(dt, inp) {
  if (!actionOn()) return;
  const tc = actHud.takeCar(), T = actHud.touch;
  if (inp.carDown || tc) {
    if (driving) { exitCar(); carWant = 0; }
    else carWant = tryCar() ? 0 : CAR.stealBuffer;
  } else if (carWant > 0) {
    carWant = driving || G.state !== "play" ? 0 : Math.max(0, carWant - dt);
    if (carWant > 0 && tryCar()) carWant = 0;
  }
  if (driving) {
    DRIVE_IN.throttle = (inp.move.y || 0) + (T.gas ? 1 : 0) - (T.brake ? 1 : 0);
    DRIVE_IN.steer = -(inp.move.x || 0) + (T.left ? 1 : 0) - (T.right ? 1 : 0);
    DRIVE_IN.handbrake = !!inp.jumpHeld;
  }
  cars.update(dt, P.pos, driving ? DRIVE_IN : null);
  const car = cars.driving;
  if (driving && car) {
    // the body rides in the car: the camera, the people and the gang all see the car's place
    P.pos.x = car.x; P.pos.y = car.y; P.pos.z = car.z; P.vel.x = car.vx; P.vel.y = 0; P.vel.z = car.vz;
    P.onGround = true; P.lastSafe.x = car.x; P.lastSafe.y = 0; P.lastSafe.z = car.z;
    hero.setYaw(car.yaw);
    syncRig();
    if (combat.carHit(car.x, car.z, car.vx, car.vz)) { audio.sfx("bump", { vol: 1.2 }); fx.word("BONK", FXP.set(car.x, 2.5, car.z), { scale: 1.5 }); }
  } else if (driving) { driving = false; hero.setHidden(false); }
  for (const e of cars.events) {
    if (e.type === "bump") { audio.sfx("bump", { vol: Math.min(1.5, e.speed / 8) }); haptic(0, 0.6, 60); }
    else if (e.type === "release") view.hideTraffic(e.traffic, false); // a stolen car is gone: its traffic car drives again
  }
  cars.events.length = 0;
  // the gang guards the clogs once Mission 1 is done
  if (save.jobs.sludge) guardClogs();
  const hf = heroFight();
  combat.update(dt, hf);
  jobs.offersOn = save.jobs.sludge; // while driving only a taxi marker starts (jobs.js)
  jobs.crimesOn = save.jobs.sludge; // crimes start near the hero after Mission 1
  jobs.update(dt, G.time, hf);
  throwFrame(dt);
  audio.fight(combat.fighting > 0 && G.state === "play");
  hero.setCarry(jobs.carrying());
  for (const e of combat.events) combatEvent(e);
  combat.events.length = 0;
  for (const e of jobs.events) jobEvent(e);
  jobs.events.length = 0;
  game.setJob(jobs.card);
  syncRopeTargets();
  if (lakeDrop && ((lakeDrop.t += dt) > LAKE_DROP.max || (lakeDrop.t > 0.5 && P.onGround && !respawning))) endLakeDrop();
  if (sludgeRetry > 0 && (sludgeRetry -= dt) <= 0) { sludgeRetry = -1; startSludge(); }
  hudFrame(dt, inp);
}
// two goons on each clogged roof near the hero, once (they come back after a reload)
const guarded = new Set();
function guardClogs() {
  for (const t of game.targets()) {
    if (t.kind !== "clog" || t.done || guarded.has(t.id)) continue;
    if (Math.hypot(t.x - P.pos.x, t.z - P.pos.z) > 140) continue;
    guarded.add(t.id);
    for (let k = 0; k < 2; k++) combat.spawn(t.x + (k ? 4 : -4), t.y, t.z + (k ? -3 : 3), "clog:" + t.id);
  }
}
function combatEvent(e) {
  switch (e.type) {
    case "hurt": {
      const dx = P.pos.x - e.fromX, dz = P.pos.z - e.fromZ, d = Math.hypot(dx, dz) || 1;
      hero.hit(dx / d, dz / d);
      if (P.onGround) { P.vel.x += (dx / d) * 4; P.vel.z += (dz / d) * 4; }
      actHud.flash(); audio.sfx("hurt"); haptic(0, 0.9, 80); haptic(1, 0.9, 80);
      if (G.input.easySwing) D.mobile.buzz?.([60, 40, 60]);
      break;
    }
    case "knockout":
      ui.toast("Knocked out! You wake up on a safe roof.");
      jobs.knockedOut();
      respawn();
      combat.heal();
      for (const g of combat.goons) g.aggro = false;
      break;
    case "ko": if (!e.quiet) { audio.sfx("goonDown", { pos: e }); fx.word("SPLORT", FXP.set(e.x, e.y + 1.6, e.z), { scale: 1.2 }); } break;
    case "dodge": fx.word("WHOOSH", FXP.set(e.x, e.y + 2, e.z), { scale: e.perfect ? 1.4 : 1 }); audio.sfx("release", { vol: 0.7 }); break;
    case "finisher": fx.word("KASPLASH", FXP.set(e.x, e.y + 2.4, e.z), { scale: 2 }); audio.sfx("kick", { vol: 1.5 }); haptic(0, 1, 120); haptic(1, 1, 120); break;
    case "windup": if (fightHints < 1 && !G.input.easySwing) { fightHints++; ui.say("A goon! Get close and press " + (G.input.kind === "pad" ? "RT" : "the left mouse button") + " to punch. When he winds up, press " + (G.input.kind === "pad" ? "A" : "Space") + " to dodge.", 4); } break;
  }
}
const FAIL_LINES = {
  drain: "The Market drain blew! Sludge everywhere. Try again!",
  time: "Out of time!", dumpster: "Ouch! A dumpster broke the fall. They are fine, but you missed.",
  drainpipe: "The washer slid down a drainpipe. Safe, but shaken.", cold: "Cold pizza. No tip.", gone: "The balloon is gone. The kid will get over it.",
  knockout: "You were knocked out. The job is lost.", left: "You left the job behind.",
  walked: "The fare got bored and walked off.", late: "Too slow! The fare jumped out at a red light.", away: "They got away. Next time!",
  flood: "The tanker burst! Sludge everywhere. Next time!",
};
function jobEvent(e) {
  switch (e.type) {
    case "start": ui.toast(e.line); audio.sfx("trialStart"); break;
    case "say": ui.say(e.line, 2.5); break;
    // a crime near the hero: the hero's shout, and a marker (actionview draws the offer)
    case "crime": ui.say(e.line, 3); ui.toast("Crime: " + JOB_NAMES[e.job] + ". Swing over there!"); audio.sfx("trialStart"); break;
    case "crimeover": ui.toast("Too late: the " + JOB_NAMES[e.job] + " is over."); break;
    case "leak": fx.word("GLUG", FXP.set(e.x, e.y + 1, e.z), { scale: 1.1 }); break;
    case "seal": fx.word("SPLORT", FXP.set(e.x, e.y + 0.6, e.z), { scale: 1.3 }); audio.sfx("pump"); if (e.n >= e.of) ui.toast("Leak sealed!"); break;
    case "caught": audio.sfx("unlock"); haptic(1, 0.6, 50); break;
    case "done": {
      audio.sfx("trialEnd");
      game.reward(e.reward);
      if (e.job === "sludge") {
        save.jobs.sludge = true;
        ui.toast("Bomb defused! +" + e.reward + " Loonies");
        story("mission2");
      } else ui.toast(JOB_NAMES[e.job] + " done! +" + e.reward + " Loonies");
      save.jobs.done[e.job] = (save.jobs.done[e.job] || 0) + 1;
      saveNow();
      break;
    }
    case "failed":
      ui.toast(FAIL_LINES[e.why] || "Job failed.");
      if (e.job === "sludge") sludgeRetry = 3.5;
      break;
  }
}
// Mission 1: the gang runner and his clog bomb (the story's fast start)
function startSludge() {
  if (!actionOn() || save.jobs.sludge) return;
  jobs.start("sludge", null, heroFight());
}
function hudFrame(dt, inp) {
  const phone = !!inp.easySwing, near = !driving ? carInReach() : null;
  const key = (k, m, t) => "<b>" + (phone ? t : inp.kind === "pad" ? k : m) + "</b>";
  let prompt = "";
  // in a fight, the dodge and the finisher come before a car in reach
  if (driving) prompt = phone ? "" : key("B", "R", "") + "GET OUT";
  else if (combat.threat(heroFight())) prompt = phone ? "" : key("A", "SPACE", "") + "DODGE"; // (a phone shows its DODGE button)
  else if (combat.focus >= 1 && combat.inReach(heroFight()) && !phone) prompt = key("RB", "F", "") + "FINISH";
  else if (near) prompt = phone ? "" : key("B", "R", "") + (near.traffic ? "STEAL" : "GET IN");
  else if (takedownAim()) prompt = key("RT", "CLICK", "TAP") + "TAKEDOWN";
  else if (combat.throwTarget(throwFrom()) && combat.fighting > 0 && !phone) prompt = key("D-PAD UP", "G", "") + "THROW";
  else if (combat.inReach(heroFight()) && fightHints < 3) prompt = key("RT", "CLICK", "TAP") + "PUNCH";
  const fight = combat.hits > 0 || combat.focus > 0 || combat.fighting > 0;
  actHud.update(dt, { on: G.state === "play" || G.state === "paused", hp: combat.hp, max: FIGHT.hp, energy: energy < 0.999 || sprinting ? energy : -1, prompt, phone, nearCar: !!near, driving, shout: shoutFrame(dt),
    combo: combat.hits, focus: fight ? combat.focus : -1, warn: warnFrame(),
    air: G.state === "play" && !P.onGround && !P.wall && !driving && P.ropes[0].state !== "attached" && P.ropes[1].state !== "attached",
    throwable: combat.fighting > 0 && !!combat.throwTarget(throwFrom()) });
}
// the warning: a red mark on the screen over the goon who winds up near the hero (the prompt line says how to dodge)
const WARN_V = new THREE.Vector3(), WARN_OUT = { x: 0, y: 0 };
function warnFrame() {
  const g = combat.threat(heroFight());
  if (!g) return null;
  WARN_V.set(g.x, g.y + 2.3, g.z).project(camera);
  if (WARN_V.z > 1 || Math.abs(WARN_V.x) > 1.1 || Math.abs(WARN_V.y) > 1.1) return null;
  WARN_OUT.x = (WARN_V.x * 0.5 + 0.5) * innerWidth; WARN_OUT.y = (0.5 - WARN_V.y * 0.5) * innerHeight;
  return WARN_OUT;
}
// the swing marker is on a guard the hero can take down from above
function takedownAim() {
  const res = pickerOn ? picker.result() : null;
  if (!res || !res.valid || res.tag !== "goon") return false;
  const g = combat.goons.find((q) => "goon:" + q.id === String(res.id));
  return combat.perched(g, heroFight());
}

// The glow of flat play: the saved choice, else Low with a mouse or a pad and Off on a phone. A headset has none.
function bloomLevel() {
  if (G.mode !== "desktop" || renderer.xr.isPresenting) return "off";
  return settings.bloom || (G.input && G.input.easySwing ? "off" : "low");
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
function travel(s) { if (!s || !Number.isFinite(s.x)) return; if (driving) exitCar(); fadeMove(s.x, s.y, s.z); }

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
  if (G.mode === "desktop") takeLook(false);
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
  applyComfort(mode === "desktop" ? (D.mobile.enabled ? "phone" : "desktop") : settings.preset);
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
// Flat play fills the screen at once (the click allows it). Esc leaves full screen with the pointer lock; wantFs remembers that
// flat play asked for it, so the click or key that resumes asks again. Leaving to the title leaves it. A browser without the
// API (an iPhone) plays in the page as before.
let wantFs = false;
// The pointer lock first, then full screen: full screen uses up the click's permission, and a lock asked for after it may be
// refused (Firefox, Safari). When full screen has come on, D.relock makes sure the lock holds the cursor. click: in a click.
function takeLook(click = true) { D.lock(click); if (wantFs) goFullscreen(); }
function onFullscreen() {
  fsAt = 0;
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (on && G.mode === "desktop" && D.active && (G.state === "play" || G.state === "intro")) D.relock();
}
// one request at a time: the change animates, and the frame that resumes after a click asks again
let fsAt = 0;
function goFullscreen() {
  const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fs || document.fullscreenElement || document.webkitFullscreenElement || performance.now() - fsAt < 1500) return;
  fsAt = performance.now();
  try { const p = fs.call(el, { navigationUI: "hide" }); if (p && p.catch) p.catch(() => { fsAt = 0; /* refused: play in the page */ }); } catch (e) { fsAt = 0; }
}
function leaveFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit || !(document.fullscreenElement || document.webkitFullscreenElement)) return;
  try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* already out */ }
}
function startDesktop() {
  if (!G.ready || X.session) return;
  G.mode = "desktop";
  lastMode = "desktop";
  hideTitle();
  D.active = true;
  if (!FLAGS.nocut) cutscenes.preload(); // the comic scenes' pictures, ready by the time the opening ends
  settings.easySwing = D.mobile.enabled;
  D.level();
  picker.reset(); // (the PLAY click took the pointer lock before full screen: see takeLook)
  flatCamera(75);
  enterPlay("desktop");
  flatView(true);
}
// Pause menu Exit: end the session (the title comes back with RE-ENTER), or leave flat play.
function exitPlay() {
  if (X.session) { X.end(); return; }
  if (G.mode !== "desktop") return;
  saveNow();
  if (driving) exitCar();
  if (G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro")) resumable = false;
  D.active = false;
  D.unlock();
  wantFs = false; leaveFullscreen();
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
let flatOn = false, lastPitchIn = 0, flatDy = 0, viewAttr = "", introYaw = 0; // introYaw: the head's turn in the desktop opening
const FLAT_LOOK = { dx: 0, dy: 0 }, FLAT_FLAGS = { swinging: false, lift: false, forceFirst: false, drive: null }, FLAT_VIEW = { pos: null, quat: null };
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
    pickerOn = false;
    D.marker(null); D.cue(false); D.hints(false);
    if (D.mobile.marker) D.mobile.marker(null);
  }
}
// The world direction the head aims along for a screen position (NDC x and y; 0, 0 is the middle): toward the point where that
// pixel's ray from the camera lands. It is the exact ray, with no help: the opening and the pause aim with it, first person
// (V) aims with it, and the picker takes the point it hits as one of its tiers. The head is not where the camera is (the chase
// camera sits up to 5 m behind it), so the aim runs from the head to that point and not parallel to the view. Result in AIM_D;
// the hit, if the ray hit anything, in AIM_HIT (AIM_HAS says so).
const AIM_FAR = 400;
const AIM_D = new THREE.Vector3(), AIM_HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
let AIM_HAS = false;
function viewAim(nx, ny, hx, hy, hz) {
  const f = Math.tan((camera.fov * Math.PI) / 360), c = camera.position;
  AIM_D.set(nx * f * camera.aspect, ny * f, -1).normalize().applyQuaternion(camera.quaternion);
  const h = city.raycast(c.x, c.y, c.z, AIM_D.x, AIM_D.y, AIM_D.z, AIM_FAR, AIM_HIT);
  AIM_HAS = !!h;
  const tx = h ? h.x : c.x + AIM_D.x * AIM_FAR, ty = h ? h.y : c.y + AIM_D.y * AIM_FAR, tz = h ? h.z : c.z + AIM_D.z * AIM_FAR;
  AIM_D.set(tx - hx, ty - hy, tz - hz);
  return AIM_D.lengthSq() > 1e-6 ? AIM_D.normalize() : AIM_D.set(0, 0, -1).applyQuaternion(camera.quaternion);
}
// The picker (target.js) decides every flat swing in play. Its context: one object, filled each frame and never kept by the picker.
let pickerOn = false; // true in flat play with the state "play"; false in the opening, in a pause and in a headset
const TCTX = {
  head: { x: 0, y: 0, z: 0 }, cam: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, fov: 70, aspect: 1, vel: null, chestY: 0, onGround: false, wall: null, time: 0,
  specials: null, ring: null, avoidBid: null, avoidBid2: null, exact: null, first: false, aimWidth: TARGET.fan.az.med, high: null,
};
const ropeBid = (r) => (r.state !== "idle" && r.target && !SPECIAL_TAGS[r.target.tag] && typeof r.target.id === "number" ? bidOf(city.colliders[r.target.id]) : null);
function fillContext(hx, hy, hz) {
  const c = TCTX, cp = camera.position;
  c.head.x = hx; c.head.y = hy; c.head.z = hz;
  c.cam.x = cp.x; c.cam.y = cp.y; c.cam.z = cp.z;
  c.yaw = flatcam.yaw; c.pitch = flatcam.pitch; c.fov = camera.fov; c.aspect = camera.aspect;
  c.vel = P.vel; c.chestY = P.pos.y + P.chest; c.onGround = P.onGround; c.wall = P.wall; c.time = G.time;
  // the gold ring is the first target of the tutorial (step 0)
  c.ring = game && game.progress && game.progress.tutorial === 0 ? city.goldRing : null;
  const a = ropeBid(P.ropes[0]), b = ropeBid(P.ropes[1]);
  c.avoidBid = a != null ? a : b; c.avoidBid2 = a != null ? b : null;
  c.exact = AIM_HAS ? AIM_HIT : null;
  c.first = flatcam.opacity <= 0.5;
  c.aimWidth = TARGET.fan.az[settings.aim] || TARGET.fan.az.med;
  c.high = G.input.easySwing ? PHONE.high : null;
  return c;
}
// A phone tap: the ray from the camera through the tapped pixel (NDC), or toward a point a test aims at. TAPR is a unit direction.
const TAPR = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
function tapRay(nx, ny) {
  const f = Math.tan((camera.fov * Math.PI) / 360), c = camera.position;
  AIM_D.set(nx * f * camera.aspect, ny * f, -1).normalize().applyQuaternion(camera.quaternion);
  TAPR.x = c.x; TAPR.y = c.y; TAPR.z = c.z; TAPR.dx = AIM_D.x; TAPR.dy = AIM_D.y; TAPR.dz = AIM_D.z;
  return TAPR;
}
function pointRay(p, from) {
  const dx = p.x - from.x, dy = p.y - from.y, dz = p.z - from.z, l = Math.hypot(dx, dy, dz) || 1;
  TAPR.x = from.x; TAPR.y = from.y; TAPR.z = from.z; TAPR.dx = dx / l; TAPR.dy = dy / l; TAPR.dz = dz / l;
  return TAPR;
}
// Aim a hand at a world point (or straight up, so its reticle hides) from the head.
function aimHandAt(h, p, hx, hy, hz) {
  if (!p) { h.aimLocal.dir.set(0, 1, 0); return; }
  const dx = p.x - hx, dy = p.y - hy, dz = p.z - hz, l = Math.hypot(dx, dy, dz) || 1;
  rotY(-G.rigYaw, dx / l, dz / l, T);
  h.aimLocal.dir.set(T.x, dy / l, T.z);
}
// After the input is read: the camera's pitch is the view, so the head, the muzzles and the aim rays follow it. The input's own
// pitch only brings the change (flatDy). In play the picker marks one target, and both hands aim at it (straight up when there is
// none, so no reticle shows); in the opening and in a pause the hands aim along the exact centre ray.
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
  inp.head.local.quat.setFromEuler(FLAT_E.set(p, introYaw, 0));
  // in the opening the mouse turns the head inside the room (the room hangs from the rig), so the muzzles turn with it
  if (introYaw) {
    FLAT_Q.setFromAxisAngle(YAXIS, introYaw);
    for (const h of inp.hands) { h.gripLocal.pos.sub(hp).applyQuaternion(FLAT_Q).add(hp); h.gripLocal.quat.premultiply(FLAT_Q); }
  }
  const c = Math.cos(G.rigYaw), s = Math.sin(G.rigYaw), R = rig.position;
  const hx = R.x + hp.x * c + hp.z * s, hy = R.y + hp.y, hz = R.z - hp.x * s + hp.z * c; // the head in the world (toWorld, which runs next)
  viewAim(0, 0, hx, hy, hz);
  rotY(-G.rigYaw, AIM_D.x, AIM_D.z, T);
  inp.hands[0].aimLocal.dir.set(T.x, AIM_D.y, T.z);
  inp.hands[1].aimLocal.dir.copy(inp.hands[0].aimLocal.dir);
  pickerOn = G.state === "play";
  if (!pickerOn) return;
  const res = picker.update(fillContext(hx, hy, hz));
  aimHandAt(inp.hands[0], res, hx, hy, hz);
  aimHandAt(inp.hands[1], res, hx, hy, hz);
}
// The hero's pose and the camera, once the body has moved. In play the camera owns the yaw (it may turn toward your travel).
function flatFrame(dt, inp, yawDelta) {
  if (!flatOn || isXR()) return;
  const play = G.state === "play";
  const key = flatcam.takeKey();
  if (play && (inp.viewDown || key)) flatcam.toggle();
  flatcam.setYaw(G.rigYaw + introYaw - (play ? yawDelta : 0));
  FLAT_LOOK.dx = (play ? yawDelta : 0) + ov.lookX;
  FLAT_LOOK.dy = (G.state === "paused" ? 0 : flatDy) + ov.lookY;
  ov.lookX = ov.lookY = 0; flatDy = 0;
  FLAT_FLAGS.swinging = P.ropes[0].state === "attached" || P.ropes[1].state === "attached";
  FLAT_FLAGS.lift = pickerOn && !inp.easySwing && !picker.specialNear; // the phone has its own follow; a clog in view stays in view
  FLAT_FLAGS.forceFirst = G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro");
  FLAT_FLAGS.drive = driving && cars.driving ? cars.driving.yaw : null; // behind the car, further back
  hero.setVisible(!shot);
  hero.setGlide(P.gliding);
  hero.update(dt, P, ropes, inp);
  flatcam.update(dt, P, hero, FLAT_LOOK, FLAT_FLAGS);
  // body[data-view] tells the page (the crosshair, the touch buttons) which view is on
  const va = flatcam.opacity < 0.5 ? "first" : "third";
  if (va !== viewAttr) document.body.dataset.view = viewAttr = va;
  if (play && G.rigYaw !== flatcam.yaw) { G.rigYaw = flatcam.yaw; syncRig(); toWorld(inp); }
}
// The marker (the world reticle is rope.js; this is the ring on the screen), the release cue and the key strip. The marker shows the
// point the next swing will use, also while a rope holds (then it marks the next building); it hides when both ropes are out, in the
// opening, in a pause and with no target. The screen position comes from the camera of this frame, after it moved.
const MK = { x: 0, y: 0, kind: "swing", dist: 0, behind: false, go: false }, DRAG = [0, 0], cueAir = [false, false];
let hintT = 0, lastKind = "";
function flatHud(dt, inp) {
  if (!flatOn || isXR()) return;
  const play = G.state === "play", phone = inp.easySwing;
  if (play) hintT += dt;
  // how long each rope has dragged the body along a roof or a street since it caught (the release cue). It starts again from 0
  // whenever the body is off the ground: a swing that follows a drag must not keep the cue on
  for (let i = 0; i < 2; i++) { const r = P.ropes[i]; DRAG[i] = r.state !== "attached" || !P.onGround ? 0 : DRAG[i] + dt; }
  // each rope's cue in the air, for the release boost (it works with the cue drawing off too)
  for (let i = 0; i < 2; i++) cueAir[i] = play && !phone && !P.onGround && releaseWindow(P, P.ropes[i], 0);
  const cue = pickerOn && !phone && settings.cue !== false && (releaseWindow(P, P.ropes[0], DRAG[0]) || releaseWindow(P, P.ropes[1], DRAG[1]));
  const res = pickerOn ? picker.result() : null, both = P.ropes[0].state !== "idle" && P.ropes[1].state !== "idle";
  let m = null;
  if (res && res.valid && !both && !(phone && res.same)) {
    const c = TCTX, cp = camera.position;
    c.cam.x = cp.x; c.cam.y = cp.y; c.cam.z = cp.z; c.yaw = flatcam.yaw; c.pitch = flatcam.pitch; c.fov = camera.fov; c.aspect = camera.aspect;
    project(c, res.x, res.y, res.z, PROJ);
    MK.x = PROJ.x; MK.y = PROJ.y; MK.kind = res.kind; MK.dist = res.dist; MK.behind = PROJ.behind; MK.go = cue;
    m = MK;
  }
  // the device in use (How to play puts its section first): also for touch, so a player who chose the mouse and then touch gets it back
  if (inp.kind !== lastKind) { lastKind = inp.kind; document.body.dataset.device = inp.kind; }
  if (phone) { D.marker(null); D.cue(false); D.hints(false); D.mobile.marker(m); return; }
  D.marker(m);
  D.cue(cue);
  D.hints(play && !save.tutorial && hintT < HINT.seconds);
}
// Which hand a swing input fires (desktop.js asks when the input goes down): the free hand on the side of the target, or the right
// hand for the second-rope input. With one rope out, the idle hand fires. In the opening there is no answer: the old mapping holds.
// "Toggle": the next press of an input lets go of its own rope.
function chooseHand(which, last, busy) {
  if (G.state !== "play" || !flatOn || D.mobile.enabled) return undefined;
  if (settings.hold === "toggle" && last >= 0 && P.ropes[last].state !== "idle") return last;
  const f0 = !busy[0] && P.ropes[0].state === "idle", f1 = !busy[1] && P.ropes[1].state === "idle";
  if (f0 && f1) return which === 1 ? 1 : picker.hand(picker.result(), TCTX);
  return f0 ? 0 : f1 ? 1 : -1;
}
// The pose the ears, the comic words and the far city follow: the camera in flat play, the head otherwise.
function viewHead(inp) {
  if (!flatOn) return inp.head;
  FLAT_VIEW.pos = camera.position; FLAT_VIEW.quat = camera.quaternion;
  return FLAT_VIEW;
}

/* ---------------- the frame (spec §6, 14 steps) ---------------- */
const physIn = { move: { x: 0, z: 0 }, climb: { up: 0, x: 0, z: 0 }, jump: false, hands: [0, 1].map(() => ({ pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false })) };
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
  // a comic scene holds the game still
  if (G.state === "cutscene") { cutsceneFrame(dt, inp); return; }
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
  if (inp.mapDown) {
    if (G.state === "play") ui.openMap();
    else if (G.state === "paused" && G.mode === "desktop" && ui.info().map.open) { ui.closePause(); D.lock(); } // Tab again closes the map
  }
  // M: the sound on or off (flat play)
  if (inp.muteDown && G.mode === "desktop") {
    // a sound that is on but not playing starts again (the key's own retry may have done it): M does not turn it off then
    if (audio.isOn && (audio.stalled || audio.restarted)) audio.resume(); else audio.toggle();
    saveNow();
    ui.say(audio.isOn ? "Sound on." : "Sound off. Press M to turn it on.", 2.5);
    if (audio.isOn) audio.sfx("ui");
    if (G.soundLabel) G.soundLabel();
    if (ui.paused && ui.refresh) ui.refresh(); // the pause menu's own Sound button shows the new state
  }
  syncPauseState();
  const paused = G.state === "paused";
  lookHint(G.mode === "desktop" && !paused && D.active && !D.mobile.enabled && D.free && !shot);
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
  if (G.state === "play" && !paused) actionFrame(dt, inp);
  // 12. turning, the rig, world poses again
  let yawDelta = 0;
  if (G.state === "play") {
    yawDelta = inp.mode === "desktop" ? inp.turn : comfort.turn(inp, dt);
    if (inp.easySwing) yawDelta += phoneFollow(dt, inp);
    G.rigYaw += yawDelta;
    syncRig();
    toWorld(inp);
  } else if (G.state === "intro" && flatOn && !isXR() && inp.mode === "desktop" && inp.turn) {
    // a flat screen looks around the room in the opening: the turn goes to the head, as a headset's would
    const a = introYaw + inp.turn;
    introYaw = Math.atan2(Math.sin(a), Math.cos(a));
  }
  G.prevHeadLocal.copy(hl);
  // 13. the rest of the world
  after(dt, inp, yawDelta);
}

// Phone: in the air at speed, and with no drag or tilt for a moment, the view turns toward where you fly and looks a
// little up, where the next buildings to swing from are. Returns the yaw to add this frame.
function phoneFollow(dt, inp) {
  const F = PHONE.follow, v = P.vel, hs = Math.hypot(v.x, v.z);
  if (P.onGround || P.wall || hs < F.speed || D.mobile.idle() < F.idle) return 0;
  const want = Math.atan2(-v.x, -v.z), now = G.rigYaw + yawOfQuat(inp.head.local.quat);
  const diff = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  D.nudgePitch((F.pitch - inp.pitch) * (1 - Math.exp(-F.pitchRate * dt)));
  return diff * (1 - Math.exp(-F.yawRate * dt));
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

// 9. Every connected hand with an idle rope aims (that drives its reticle). In flat play the picker (target.js) has marked one
// target and both hands aim at it: a mouse or pad press fires at it, and a phone tap goes through the tap rules. A held press
// still fires if a target shows up within SWING.fireHold; with none it is a dry fire along the view. A test aim override on a hand
// wins: for that hand ropes.aim decides, as before.
const latch = [false, false], realWait = [false, false];
let noneAt = -99;
const PICK_OPTS = { avoidBid: -1 }; // reused: the options of the second pick when both swing inputs go down in one frame
const PHONE_DIR = new THREE.Vector3(), PROJ = { x: 0, y: 0, depth: 0, behind: false, inView: false };
function aimAndFire(dt, inp) {
  if (driving) return;
  for (let i = 0; i < 2; i++) {
    const h = inp.hands[i], r = P.ropes[i];
    // a goon in reach: the swing input punches (punch, punch, kick) instead of firing a rope
    const tap = tapped(inp, i);
    if (actionOn() && G.state === "play" && (inp.easySwing ? tap : h.triggerDown) && tryAttack()) { h.triggerDown = false; fireWait[i] = 0; continue; }
    // phone: a tap on a side with that side's rope out moves it to the tapped building, or the next one ahead: one tap, one swing,
    // with no let-go between. With nothing new in reach the rope stays. A tap while the cup still flies (0.3 s at most) does
    // nothing: a new shot would cancel the cup before it lands.
    if (tap && r.state !== "idle") {
      if (r.state === "flying") continue;
      const next = phoneAim(i, h, inp);
      if (next?.valid && !next.same && !ui.blocking(i)) shoot(i, h, next);
      else D.mobile.miss(i, true);
      continue;
    }
    if (tap && h.connected && !ui.blocking(i)) {
      const a = (lastAim[i] = phoneAim(i, h, inp));
      D.mobile.target(!!a?.valid && !a.same, false);
      if (a?.valid && !a.same) shoot(i, h, a); else dryFire(i, h, PHONE_DIR);
      fireWait[i] = 0;
      continue;
    }
    if (!h.connected || r.state !== "idle") {
      // "toggle" hold (a pause option): the next press lets go instead of the trigger opening
      if (r.state !== "idle" && h.triggerDown && settings.hold === "toggle") toggled[i] = false;
      lastAim[i] = null; fireWait[i] = 0; realWait[i] = false;
      continue;
    }
    latch[i] = false; // an idle rope has nothing to keep
    const pk = pickerOn && !ov.aim[i];
    let a;
    if (pk) { ropes.aim(i, h.aimPos, h.aimDir, P.vel); a = picker.result(); } // the reticle follows the aim; the picker decides
    else a = ropes.aim(i, h.aimPos, h.aimDir, P.vel);
    lastAim[i] = a;
    const blocked = ui.blocking(i), ok = !!a && a.valid && !blocked && !(inp.easySwing && a.same);
    if (inp.easySwing && i === 1) D.mobile.target(ok, false);
    if (h.triggerDown && !blocked) {
      if (ok) {
        const bid = a.bid;
        shoot(i, h, a);
        // The other hand fires in this same frame (two swing inputs went down together). The picker learns of this rope only next
        // frame, so ask it again for a building that does not hold it. pick() rewrites the result in place: after shoot, never in it.
        if (pk && i === 0 && bid >= 0 && inp.hands[1].triggerDown && P.ropes[1].state === "idle") { PICK_OPTS.avoidBid = bid; picker.pick(TCTX, PICK_OPTS); }
      } else { fireWait[i] = SWING.fireHold; realWait[i] = !!h.swingDown; }
    } else if (fireWait[i] > 0) {
      if (blocked) fireWait[i] = 0;
      else if (ok && h.holding) { shoot(i, h, a); fireWait[i] = 0; }
      else if (!h.holding || (fireWait[i] -= dt) <= 0) {
        dryFire(i, h, pk ? flatcam.forward : null);
        if (pk && !inp.easySwing) noBuilding();
        fireWait[i] = 0; realWait[i] = false;
      }
    }
  }
}
// a phone tap on side i (0 the left half of the screen, 1 the right) this frame
const tapped = (inp, i) => !!(inp.easySwing && inp.phoneFire && inp.phoneFire[i]);
// "No building to swing from here", at most once every 10 s (a mouse or a pad; the phone dims its SWING button)
function noBuilding() {
  if (G.time - noneAt < TARGET.noneLine) return;
  noneAt = G.time;
  ui.say("No building to swing from here. Face the city, or step off the edge.", 4);
}
// A phone shot: the tap rules of the picker (a clog or pipe near the tapped ray, the exact point, the marked target, a search that
// leans toward the tap). A test aim override on the hand acts as a tap at that point. The result says same when only the building
// that holds the rope qualifies: the rope stays. PHONE_DIR is the way a dry fire flies.
function phoneAim(i, h, inp) {
  const o = ov.aim[i], ray = o ? pointRay(o, h.aimPos) : inp.phoneAim && inp.phoneAim[i] ? tapRay(inp.phoneAim[i].x, inp.phoneAim[i].y) : null;
  if (ray) PHONE_DIR.set(ray.dx, ray.dy, ray.dz); else PHONE_DIR.copy(flatcam.forward);
  return pickerOn ? picker.tap(TCTX, ray, null) : null;
}
// A swing from a wall in third person turns the view toward the swing when the target is off the screen or behind the camera
function turnToSwing(a) {
  project(TCTX, a.x, a.y, a.z, PROJ);
  if (PROJ.behind || Math.abs(PROJ.x) > 1 || Math.abs(PROJ.y) > 1) flatcam.turnTo(Math.atan2(-(a.x - P.pos.x), -(a.z - P.pos.z)));
}
function shoot(i, h, a) {
  const phone = G.input.easySwing, real = !phone && !!(h.swingDown || realWait[i]);
  realWait[i] = false;
  if (flatOn && pickerOn && P.wall && flatcam.opacity > 0.5 && (phone || real)) turnToSwing(a); // before fire: it lets go of the wall
  firePerch[i] = heroFight().perch; // a rope fired from a roof or a wall: the takedown is judged from here, not where the cup lands
  fire(P, i, h.aimPos, a);
  toggled[i] = true;
  if (phone) { firedAt[i] = G.time; handoffT[i] = -1; } // a rope thrown again is not the one that lets go
  latch[i] = real; // a real press keeps the cup in flight, and earns the kick
  if (real) picker.fired(i);
  if (phone && P.onGround) {
    // Launch only after a valid attach target is found. A miss never jumps off a roof.
    G.input.jumpDown = true;
    const dx = a.x - P.pos.x, dz = a.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > .01) { P.vel.x += dx / d * 5; P.vel.z += dz / d * 5; }
  } else if (real && DESKTOP.hop > 0 && P.onGround && !a.special && flatOn) {
    // a hop off the roof toward the target (a tuning value: it starts at 0)
    G.input.jumpDown = true;
    const dx = a.x - P.pos.x, dz = a.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > .01) { P.vel.x += dx / d * DESKTOP.hop; P.vel.z += dz / d * DESKTOP.hop; }
    pushRing({ type: "hop", side: i, speed: DESKTOP.hop });
  }
  audio.sfx("fire", { pos: h.aimPos });
  haptic(i, 0.2, 20);
  pushRing({ type: "fire", side: i, target: { tag: a.tag, id: a.id } });
  wordAtHand("THWIP", i);
}
function dryFire(i, h, dir) {
  if (G.input.easySwing) D.mobile.miss(i);
  ropes.dryFire(i, h.aimPos, dir || h.aimDir);
  audio.sfx("dry", { pos: h.aimPos });
  haptic(i, 0.15, 30);
  pushRing({ type: "dry", side: i });
}

// 10. n = ceil(dt / fixedDt) equal substeps (no accumulator, so no judder between frames).
function physics(dt, inp) {
  if (driving) return; // in a car the car moves the body (actionFrame)
  const n = Math.min(SWING.maxSubsteps, Math.max(1, Math.ceil(dt / SWING.fixedDt - 1e-9))), h = dt / n;
  const intro = G.state === "intro";
  // move: the stick (or WASD) relative to where the head looks, flattened
  const yaw = G.rigYaw + yawOfQuat(inp.head.local.quat), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let mx = 0, mz = 0;
  if (!intro) { mx = -fz * inp.move.x + fx * inp.move.y; mz = fx * inp.move.x + fz * inp.move.y; }
  const ml = Math.sqrt(mx * mx + mz * mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  physIn.move.x = mx; physIn.move.z = mz;
  // on a wall: W/S (or the phone's arrows) climb, and A/D go along it, toward the view's right
  physIn.climb.up = intro ? 0 : inp.move.y;
  physIn.climb.x = intro ? 0 : -fz * inp.move.x; physIn.climb.z = intro ? 0 : fx * inp.move.x;
  fightKeys(inp, mx, mz);
  // desktop Space: a jump on the ground or off a wall, a yank on every rope in the air
  const airYank = inp.mode === "desktop" && inp.jumpDown && !P.onGround && !P.wall;
  physIn.jump = !intro && inp.jumpDown && !airYank;
  // the glide: jump held (pad A, the phone's GLIDE button) in the air with no rope out; physics waits a moment after the take-off
  physIn.glide = !intro && flatOn && !isXR() && G.state === "play" && !P.onGround && !P.wall && (!!inp.jumpHeld || !!actHud.touch.glide);
  if (physIn.glide && !P.gliding && G.time - glideAt > 3 && P.ropes[0].state !== "attached" && P.ropes[1].state !== "attached") { glideAt = G.time; wordAhead("WHOOSH", P.pos, 5, 1.2, 1); }
  for (let i = 0; i < 2; i++) {
    const src = inp.hands[i], o = physIn.hands[i];
    o.pos.x = src.gripPos.x; o.pos.y = src.gripPos.y; o.pos.z = src.gripPos.z;
    // velRel is tracking space; physics dots it with world directions, so turn it by the rig's yaw
    rotY(G.rigYaw, src.velRel.x, src.velRel.z, T);
    o.velRel.x = T.x; o.velRel.y = src.velRel.y; o.velRel.z = T.z;
    o.yank = airYank ? Math.max(src.yank, 2.5) : src.yank;
    const r = P.ropes[i];
    const autoPull = inp.easySwing && src.holding && r.state === "attached" && r.len > 14 && !r.sticky && r.tension < .65;
    o.grip = Math.max(src.grip, autoPull ? .72 : 0);
    // a phone rope on a clog or a pipe pumps by itself (physics lets one yank through per cooldown)
    if (inp.easySwing && src.holding && r.state === "attached" && SPECIAL_TAGS[r.target.tag]) o.yank = Math.max(o.yank, PHONE.pumpYank);
    // the cup of a real press always lands: while it flies the rope stays held, and after it lands the rope follows the button
    o.holding = (!inp.easySwing && settings.hold === "toggle" ? toggled[i] && P.ropes[i].state !== "idle" : src.holding) || resumeGrace > 0 || (latch[i] && r.state === "flying");
    o.reeling = false;
  }
  // flat play: Shift sprints on the ground with no rope out, while the energy lasts; a landing from a dive rolls
  sprintFrame(dt, inp, ml);
  physIn.sprint = sprinting;
  P.rollReady = flatOn && !isXR() && hero.diving;
  P.face = HERO_FACE; HERO_FACE.x = -Math.sin(hero.yaw || 0); HERO_FACE.z = -Math.cos(hero.yaw || 0);
  const wasGround = P.onGround;
  for (let k = 0; k < n; k++) step(P, h, physIn);
  if (!intro && inp.easySwing) phoneRelease(dt);
  if (!intro && !wasGround && P.onGround && !P.dead) {
    // landing: the body goes under the head, in the same frame, so the camera does not move
    const hl = inp.head.local.pos;
    rotY(G.rigYaw, hl.x - G.bodyLocal.x, hl.z - G.bodyLocal.z, T);
    P.pos.x += T.x; P.pos.z += T.z;
    G.bodyLocal.x = hl.x; G.bodyLocal.z = hl.z;
  }
}

// Phone: a rope lets go by itself once you swing past the bottom of the arc, and flings you on. Each plunger keeps its own clock.
// When a new plunger catches, the other one lets go PHONE.handoff s later (no fling: the new rope carries the swing), so taps on
// alternate sides chain from building to building. Two plungers thrown within PHONE.pair s of each other hold together.
const phoneRopeT = [0, 0], phoneGroundT = [0, 0], phoneSlowT = [0, 0], handoffT = [-1, -1], firedAt = [-99, -99];
let fovKick = 0, climbTold = false;
function phoneRelease(dt) {
  for (let i = 0; i < 2; i++) phoneReleaseRope(i, dt);
}
function phoneClear(i) { phoneRopeT[i] = phoneGroundT[i] = phoneSlowT[i] = 0; handoffT[i] = -1; }
function phoneReleaseRope(i, dt) {
  const r = P.ropes[i], R = PHONE.release;
  if (r.state !== "attached" || r.sticky || SPECIAL_TAGS[r.target.tag]) { phoneClear(i); return; }
  if (handoffT[i] >= 0 && (handoffT[i] -= dt) <= 0) { release(P, i); phoneClear(i); D.mobile.released(i); return; }
  phoneRopeT[i] += dt;
  if (P.onGround) phoneGroundT[i] += dt; // all the time on roofs since the rope caught: a rope that drags you over them lets go
  phoneSlowT[i] = Math.hypot(P.vel.x, P.vel.y, P.vel.z) < R.stallSpeed ? phoneSlowT[i] + dt : 0;
  // landed on a roof, or hanging still: let go with no fling, so the next tap jumps and swings at once
  if (phoneRopeT[i] >= R.minT && (phoneGroundT[i] >= R.ground || phoneSlowT[i] >= R.stall)) {
    release(P, i); phoneClear(i); D.mobile.released(i); return;
  }
  if (phoneRopeT[i] < R.minT || P.onGround) return;
  const A = r.anchor, cx = P.pos.x - A.x, cy = P.pos.y + P.chest - A.y, cz = P.pos.z - A.z;
  const d = Math.sqrt(cx * cx + cy * cy + cz * cz), v = P.vel;
  if (d < 1e-3) return;
  // past the bottom: rising, and moving away from the point under the anchor
  const away = cx * v.x + cz * v.z > 0 && v.y > 0;
  const past = Math.acos(clamp(-cy / d, -1, 1)) / DEG; // degrees from straight down
  const vault = d < R.close;
  if (!vault && !(away && past >= R.angle) && !(cy > -R.overTop && v.y > 0)) return;
  release(P, i);
  phoneClear(i);
  D.mobile.released(i);
  // the other plunger still holds (a double swing): it carries you on, and flings when it lets go
  if (P.ropes[1 - i].state === "attached") return;
  const f = PHONE.fling;
  if (vault) {
    // reeled right up to the anchor (a wall ahead): up and over, on the way you look
    const yaw = G.rigYaw + yawOfQuat(G.input.head.local.quat);
    v.x = -Math.sin(yaw) * f.forward; v.z = -Math.cos(yaw) * f.forward; v.y = Math.max(v.y, 0) + R.vault;
  } else {
    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.5) { v.x += (v.x / hs) * f.forward; v.z += (v.z / hs) * f.forward; }
    v.y = Math.max(v.y, 0) + f.up;
  }
  P.pullVel.x = P.pullVel.y = P.pullVel.z = 0;
  fovKick = f.kick;
  if (G.time - whooshAt >= 2) { whooshAt = G.time; wordAhead("WHOOSH", P.pos, 6, 1.6, 1.2); }
  pushRing({ type: "fling", side: i, speed: Math.hypot(v.x, v.y, v.z) });
}
// Mouse and pad: a real let-go while the GO cue showed on that rope (last frame) boosts the hero forward and up with a flip
let boostAt = -9;
function releaseBoost(i) {
  const B = MOVES.release;
  if (!cueAir[i] || G.input.easySwing || !flatOn || G.state !== "play" || P.onGround || P.wall || G.time - boostAt < B.cool) return;
  if (P.ropes[1 - i].state === "attached") return; // the other rope still holds: it carries you on
  boostAt = G.time;
  const v = P.vel, hs = Math.hypot(v.x, v.z);
  if (hs > 0.5) { v.x += (v.x / hs) * B.forward; v.z += (v.z / hs) * B.forward; }
  v.y = Math.max(v.y, 0) + B.up;
  fovKick = B.kick;
  hero.flip(B.flip);
  if (G.time - whooshAt >= 2) { whooshAt = G.time; wordAhead("WHOOSH", P.pos, 6, 1.6, 1.2); }
  pushRing({ type: "boost", side: i, speed: Math.hypot(v.x, v.y, v.z) });
}
// A new phone plunger on side i caught a building: the other one lets go soon, unless the two were thrown as a pair
function phoneHandoff(i) {
  const j = 1 - i, o = P.ropes[j];
  if (o.state !== "attached" || o.sticky || SPECIAL_TAGS[o.target.tag] || Math.abs(firedAt[i] - firedAt[j]) <= PHONE.pair) return;
  handoffT[j] = PHONE.handoff;
}
// A rope that catches gives at least `speed` across the rope, toward where you look: the phone's PHONE.attachSpeed, or the
// DESKTOP.attachSpeed of a real mouse or pad swing (target.js holds the maths). A "kick" in the event ring lets a test see it.
function boost(i, speed) {
  const yaw = G.rigYaw + yawOfQuat(G.input.head.local.quat);
  if (kick(P, P.ropes[i], yaw, speed)) pushRing({ type: "kick", side: i, speed });
}
// Phone: a rope that catches keeps your speed. The part that flies away from the anchor (the rope would stop it) turns into swing
// across the rope, toward where you look. The rope is also short enough that the lowest point of its arc stays PHONE.catch.clear m
// over the street (the length moves there at PHONE.catch.rate: it pulls you up fast, with no pop).
function phoneCatch(r) {
  const A = r.anchor, v = P.vel, cx = P.pos.x - A.x, cy = P.pos.y + P.chest - A.y, cz = P.pos.z - A.z, d = Math.hypot(cx, cy, cz);
  if (d < 1e-3) return;
  const nx = cx / d, ny = cy / d, nz = cz / d, out = v.x * nx + v.y * ny + v.z * nz;
  if (out > 0) {
    const yaw = G.rigYaw + yawOfQuat(G.input.head.local.quat);
    let tx = -Math.sin(yaw), ty = 0, tz = -Math.cos(yaw);
    const k = tx * nx + tz * nz;
    tx -= k * nx; ty -= k * ny; tz -= k * nz;
    const tl = Math.hypot(tx, ty, tz);
    v.x -= nx * out; v.y -= ny * out; v.z -= nz * out;
    if (tl > 0.3) { v.x += (tx / tl) * out; v.y += (ty / tl) * out; v.z += (tz / tl) * out; }
  }
  const most = A.y - P.chest - PHONE.catch.clear;
  if (most > PHONE.catch.min && r.lenTarget > most) { r.lenTarget = most; r.rate = PHONE.catch.rate; } // (a low point cannot keep you off the street: no change)
}
const SPECIAL_TAGS = { clog: true, pipe: true, crack: true, goon: true, person: true, balloon: true, getaway: true, leak: true };
// a rope that catches one of these does not stay: it yanks a goon off his feet, catches a falling person or the balloon, plunges
// the windscreen of a getaway car or plugs a tanker's leak
const CATCH_TAGS = { goon: true, person: true, balloon: true, getaway: true, leak: true };

// 11. One drain per frame: the portal hears them in the intro, the game in play; main plays the feedback.
function drainEvents() {
  const evs = P.events;
  if (!evs.length) return;
  const intro = G.state === "intro" || (G.state === "paused" && G.pausedFrom === "intro");
  for (let k = 0; k < evs.length; k++) {
    const ev = evs[k];
    pushRing(ev);
    try { if (intro) portal.onEvent(ev); else game.onEvent(ev, P); } catch (e) { console.error(e); }
    // one bad event must not stop the drain: the queue would replay every frame and the picture would freeze
    try { feedback(ev); } catch (e) { console.error(e); }
  }
  evs.length = 0;
}
function feedback(ev) {
  const i = ev.side === 1 || ev.side === "right" ? 1 : 0, r = P.ropes[i];
  switch (ev.type) {
    case "attach":
      if (r.target && CATCH_TAGS[r.target.tag]) { ropeCatch(i, r); break; }
      audio.sfx("stick", { pos: r.anchor }); haptic(i, 0.5, 30); fx.word("THUCK", r.anchor, { dir: r.normal });
      // the rope can already be gone in the same step (the chest grabbed a wall and let go of the ropes): no kick then
      if (G.state === "play" && r.state === "attached" && !SPECIAL_TAGS[r.target.tag] && !r.sticky) {
        if (G.input.easySwing) { phoneRopeT[i] = 0; phoneCatch(r); boost(i, PHONE.attachSpeed); phoneHandoff(i); }
        else if (latch[i] && flatOn) boost(i, DESKTOP.attachSpeed); // a real press only: a test hook gets no kick
      }
      catchFeedback(i, "attach");
      break;
    case "detach": audio.sfx("release", { pos: G.input.hands[i].gripPos }); if (latch[i]) releaseBoost(i); latch[i] = false; break;
    case "yank":
      audio.sfx(ev.pump ? "pump" : "yank", { pos: G.input.hands[i].gripPos }); haptic(i, 0.6, 40);
      if (ev.pump) fx.word("SPLORT", r.anchor, { dir: FX_UP, scale: 1.2 }); else wordAtHand("YANK", i);
      catchFeedback(i, ev.pump ? "pump" : "yank");
      break;
    case "roll":
      hero.roll(MOVES.roll.time);
      audio.sfx("land", { vol: 0.5 });
      // a dive into the gang flattens the goons round you (a plain hard landing, a smaller ring)
      if (actionOn() && combat.slam(P.pos.x, P.pos.y, P.pos.z, ev.dive ? FIGHT.slam.r : 3)) { fx.word("BONK", { x: P.pos.x, y: P.pos.y + 2, z: P.pos.z }, { scale: 1.6 }); haptic(0, 0.8, 80); }
      break;
    case "land": {
      audio.sfx("land", { vol: clamp(ev.speed / 10, 0.3, 1.5) });
      // the people near see it: a cheer, and a gasp first from the ones a hard landing made jump back
      const re = G.state === "play" ? street.land(P.pos.x, P.pos.y, P.pos.z, -ev.speed) : null;
      if (re && re.gasp) audio.sfx("gasp", { pos: re });
      if (re && re.cheer) audio.sfx("cheer", { pos: re, vol: clamp(re.n / 6, 0.4, 1.2) });
      break;
    }
    case "splash":
      audio.sfx("splash"); wordAhead("KASPLASH", P.pos, 2.6, 1, 1.5); respawn();
      if (lakeDrop) { ui.say("KASPLOOSH! Fished out of the lake. Port Loon. Go get him.", 3); endLakeDrop(); }
      break;
    case "oob": respawn(); break;
    case "bump": audio.sfx("bump", { vol: clamp(ev.speed / 10, 0.3, 1.5) }); haptic(0, Math.min(1, ev.speed / 10), 50); haptic(1, Math.min(1, ev.speed / 10), 50); wordAtBump(ev); break;
    case "snap": if (G.input.easySwing) D.mobile.miss(i); audio.sfx("snap", { pos: r.anchor }); break;
    case "cling":
      audio.sfx("land", { vol: 0.5 }); haptic(0, 0.3, 30); haptic(1, 0.3, 30);
      if (G.input.easySwing) D.mobile.released();
      else if (!climbTold) { climbTold = true; ui.sayLine("wall", 0); } // the first wall line, in the words of the device in use
      break;
    case "mantle": audio.sfx("land", { vol: 0.6 }); break;
    case "unclimb": if (ev.why === "jump" || ev.why === "leap") audio.sfx("release", { pos: G.input.head.pos }); if (ev.why === "leap") { fovKick = 6; hero.flip(0.6); } break;
    case "wallrun": audio.sfx("land", { vol: 0.4 }); if (G.time - whooshAt >= 2) { whooshAt = G.time; wordAhead("WHOOSH", P.pos, 3, 1.5, 1); } break;
    case "leap": audio.sfx("release", { vol: 1 }); fovKick = 8; hero.flip(0.6); wordAhead("WHOOSH", P.pos, 3, 2.5, 1.3); break;
  }
}

// A catch, a yank or a pump in flat play: the ring pops on every device, a phone vibrates (where the browser can), and a pad rumbles.
function catchFeedback(i, what) {
  if (!flatOn || isXR()) return;
  const inp = G.input;
  if (inp.easySwing) { D.mobile.pop?.(); D.mobile.buzz?.(PHONE.buzz[what]); return; }
  D.pop();
  if (inp.mode === "desktop" && inp.kind === "pad") { const r = PAD.rumble[what]; D.rumble(r[0], r[1]); }
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
  flatHud(dt, inp); // the lock-on ring, the LET GO caption and the first-minute strip
  const vh = viewHead(inp);
  hands.update(inp, P, dt);
  TIPS[0] = hands.tip(0); TIPS[1] = hands.tip(1);
  // third person: the ropes leave the hero's own hands (the old muzzles stay for first person)
  if (flatOn && flatcam.opacity > 0.5) { TIPS[0] = hero.hand(0); TIPS[1] = hero.hand(1); }
  ropes.update(dt, P, TIPS, G.time);
  game.update(dt, G.time, P, inp); // before the hand-off it only lets the sleeping King breathe
  view.update(dt, G.time, vh.pos);
  streetFrame(dt, inPlay);
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
  fovKick *= Math.exp(-dt * 3);
  if (G.mode === "desktop" && !shot) {
    const Fv = PHONE.fov;
    if (inp.easySwing) {
      // the phone's faster view: wider with speed, and a kick on a fling; the chase camera takes it as its target
      const want = Fv.base + Fv.wide * clamp((speed - Fv.from) / (Fv.to - Fv.from), 0, 1) + fovKick;
      if (flatOn) flatcam.fovWant = want;
      else if (Math.abs(want - camera.fov) > 0.01) { camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
    } else if (!flatOn) { // (the flat camera sets its own field of view)
      const want = 75 + 12 * clamp((speed - 15) / 20, 0, 1);
      if (Math.abs(want - camera.fov) > 0.01) { camera.fov += (want - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
    }
  }
  if (inp.easySwing) { D.mobile.rush(inPlay ? (speed - PHONE.lines.from) / (PHONE.lines.to - PHONE.lines.from) : 0, dt); D.mobile.climbing(inPlay && !!P.wall); }
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

// The fight keys of flat play. Space (pad A, the phone's DODGE button) with a goon winding up near: a dodge, not a jump. F (pad RB) with a
// full focus meter, a goon in reach and no rope out: the finisher, not a yank. Each one eats the press it used.
let slowT = 0, glideAt = -9;
// the things the hero throws: a toilet lid that spins along an arc to its goon (one mesh each, made on the first throw)
const flying = [], lidPool = [];
function lidMesh() {
  let m = lidPool.find((q) => !q.visible);
  if (!m) {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.07, 18), new THREE.MeshBasicMaterial({ color: COLORS.porcelain }));
    const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.33, 0.05, 18), new THREE.MeshBasicMaterial({ color: 0x140a18, side: THREE.BackSide }));
    m.add(ink);
    scene.add(m); lidPool.push(m);
  }
  m.visible = true;
  return m;
}
// a throw goes where you look (the view's yaw in flat play), not where the hero's body happens to face
function throwFrom() { const hf = heroFight(); if (flatOn) hf.yaw = flatcam.yaw; return hf; }
function throwFrame(dt) {
  for (let k = flying.length - 1; k >= 0; k--) {
    const f = flying[k], g = combat.goons.find((q) => q.id === f.id);
    if (!f.mesh) f.mesh = lidMesh();
    f.t += dt;
    const u = Math.min(1, f.t / f.dur), tx = g ? g.x : f.x0, ty = g ? g.y + 1.2 : f.y0, tz = g ? g.z : f.z0;
    f.mesh.position.set(f.x0 + (tx - f.x0) * u, f.y0 + (ty - f.y0) * u + Math.sin(Math.PI * u) * 1.5, f.z0 + (tz - f.z0) * u);
    f.mesh.rotation.set(0.4, f.t * 18, 0);
    if (u >= 1 || !g) {
      if (g && combat.landThrow(g.id, f.fromX, f.fromZ)) { audio.sfx("punch", { pos: g }); fx.word("BONK", FXP.set(g.x, g.y + 2.1, g.z), { scale: 1.4 }); }
      f.mesh.visible = false; flying.splice(k, 1);
    }
  }
}
function fightKeys(inp, mx, mz) {
  if (!actionOn() || G.state !== "play" || driving || P.wall) return;
  const dodgeTap = actHud.takeDodge();
  if (inp.jumpDown || dodgeTap) {
    const d = combat.dodge(heroFight(), mx, mz);
    if (d) {
      inp.jumpDown = false;
      const D = FIGHT.dodge;
      P.vel.x = d.dx * D.speed; P.vel.z = d.dz * D.speed; P.vel.y = Math.max(P.vel.y, D.hop);
      P.onGround = false; P.ground = null;
      hero.roll(D.time);
      if (d.perfect) slowT = Math.max(slowT, 0.35); // a perfect dodge: a short slow moment
      pushRing({ type: "dodge", perfect: d.perfect });
    }
  }
  if ((inp.throwDown || actHud.takeThrow()) && !driving) {
    const t = combat.throw(throwFrom());
    if (t) {
      const g = t.goon;
      flying.push({ id: g.id, t: 0, dur: t.time, x0: P.pos.x, y0: P.pos.y + 1.4, z0: P.pos.z, fromX: P.pos.x, fromZ: P.pos.z });
      hero.attack("punch", 1);
      audio.sfx("release", { vol: 0.8 });
      pushRing({ type: "throw", id: g.id });
    }
  }
  const yank = inp.hands[0].yank > 0 || inp.hands[1].yank > 0;
  if (yank && combat.focus >= 1 && P.ropes[0].state === "idle" && P.ropes[1].state === "idle") {
    const hit = combat.finish(heroFight());
    if (hit) {
      inp.hands[0].yank = inp.hands[1].yank = 0;
      hero.attack("kick", 1);
      slowT = MOVES.finisher.time; fovKick = -MOVES.finisher.zoom;
      pushRing({ type: "finisher", n: hit.length });
    }
  }
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
    // a finisher runs the world slowly for a moment (real time)
    const slow = slowT > 0 && G.state === "play" ? MOVES.finisher.slow : 1;
    slowT = Math.max(0, slowT - dt);
    if (!G.held) tick(dt * slow, frame, time);
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
  if (!xr) bloom.render(scene, camera, bloomLevel()); else renderer.render(scene, camera);
  const info = xr ? renderer.info.render : bloom.last;
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
// Flat play with no pointer lock (refused, or lost without a pause): how to get the mouse look back
let hintOn = false;
function lookHint(on) { if (on !== hintOn) $("#lookHint").hidden = !(hintOn = on); }
function showTitle(reenter) {
  G.titleShows++;
  lookHint(false);
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
  const enter = (mode, mouse) => {
    // the click is the user activation: wake the audio now, before anything waits
    audio.init();
    audioStarted = true;
    note("");
    // a click you can hear, or a word on how to turn the sound on (it may be off from the arcade's speaker button); a toast,
    // so the opening's own lines do not cover it
    if (audio.isOn) audio.sfx("ui"); else setTimeout(() => ui.toast(mode === "desktop" && !D.mobile.enabled ? "Sound is off. Press M to turn it on." : "Sound is off. Turn it on in the pause menu."), 900);
    if (mode === "desktop") { wantFs = true; if (!mouse) D.mobile.start(); takeLook(false); startDesktop(); } else startXR(mode);
  };
  $("#enterAR").addEventListener("click", () => enter("ar"));
  $("#enterVR").addEventListener("click", () => enter("vr"));
  // PLAY WITH TOUCH turns the touch scheme back on, also after PLAY WITH MOUSE AND KEYBOARD turned it off (no-op on a computer)
  $("#playFlat").addEventListener("click", () => { D.mobile.use(true); enter("desktop"); });
  // a touch device with a fine pointer (a touch laptop, a 2-in-1) chooses its scheme: touch, or the mouse and keyboard
  const playMouse = $("#playMouse");
  if (playMouse) playMouse.addEventListener("click", () => { D.mobile.use(false); enter("desktop", true); });
  $("#reenterBtn").addEventListener("click", () => enter(lastMode || "desktop"));
  // SOUND on the title: the arcade's speaker button (or another game) may have turned it off for every game here
  const soundBtn = $("#soundBtn");
  // "ON" only while the sound plays (or will at the first click): a sound that failed to start, or that the browser stopped,
  // says so, and a press of it starts it again instead of turning it off
  const soundLabel = () => { soundBtn.textContent = "SOUND: " + (!audio.isOn ? "OFF" : audio.running ? "ON" : "ON, NOT PLAYING"); soundBtn.setAttribute("aria-pressed", String(audio.isOn)); };
  soundBtn.addEventListener("click", () => {
    audioStarted = true;
    if (audio.isOn && (audio.stalled || audio.restarted)) audio.resume(); else { audio.init(); audio.toggle(); }
    saveNow(); soundLabel(); if (audio.isOn) audio.sfx("ui");
  });
  soundLabel();
  G.soundLabel = soundLabel;
  // a browser that stopped the sound gets it back on the next tap or key (both count as a user gesture)
  const retry = () => { if (audioStarted && audio.stalled) { audio.resume(); soundLabel(); } };
  addEventListener("pointerdown", retry, true);
  addEventListener("keydown", retry, true);
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
  // the title for the device: a computer, a phone or a tablet (touch only), or a touch device with a fine pointer (both buttons)
  const FINE = matchMedia("(any-pointer: fine)").matches, hide = (id, on) => { const e = $(id); if (e) e.hidden = !on; };
  if (TOUCH_ONLY) { const b = $("#playFlat"); b.textContent = b.dataset.labelTouch || "PLAY WITH TOUCH"; }
  hide("#touchNote", TOUCH_ONLY && !FINE); hide("#hybridNote", TOUCH_ONLY && FINE); hide("#deskNote", !TOUCH_ONLY); hide("#playMouse", TOUCH_ONLY && FINE);
  document.body.dataset.device = TOUCH_ONLY ? "touch" : "mouse";
  // the pad is the device in use once it connects (How to play puts its section first)
  addEventListener("gamepadconnected", () => { if (!TOUCH_ONLY && G.mode === "title") document.body.dataset.device = "pad"; });
  const quest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  if (quest && !matchMedia("(display-mode: standalone)").matches) $("#installHint").hidden = false;
  X.supported.then(({ vr, ar }) => {
    $("#enterAR").hidden = !ar;
    $("#enterVR").hidden = !vr;
    if (!vr && !ar && !TOUCH_ONLY) $("#noXR").hidden = false;
    document.body.dataset.xr = ar ? "ar" : vr ? "vr" : "none";
    G.supported = { vr, ar };
  });
  // flat play: a click on the city while paused goes back to play (the menu closes first, so the city takes the lock), and a
  // click with no lock takes it back (desktop.js fires no rope with it)
  renderer.domElement.addEventListener("pointerdown", () => {
    if (G.mode !== "desktop") return;
    // the click that resumes, or that asks for the lock, starts no swing (D.lock(true) tells desktop.js); the lock comes before
    // full screen (takeLook)
    if (G.state === "paused") { ui.closePause(); takeLook(); }
    else if (!D.locked) takeLook();
  });
  // a pause-menu button that ends the pause (RESUME) takes the lock inside its own click: the frame that resumes is too
  // late for a browser that allows it only in the click
  document.addEventListener("click", (e) => {
    if (G.mode === "desktop" && G.state === "paused" && !ui.paused && e.target.closest && e.target.closest("#fsMenu button")) takeLook();
  });
  document.addEventListener("onfullscreenchange" in document ? "fullscreenchange" : "webkitfullscreenchange", onFullscreen);
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
    move: { ...inp.move }, turn: inp.turn, pitch: inp.pitch, jumpDown: inp.jumpDown, menuDown: inp.menuDown, mapDown: inp.mapDown, viewDown: !!inp.viewDown,
    hands: inp.hands.map((h) => ({
      side: h.side, index: h.index, connected: h.connected, kind: h.kind,
      gripLocal: { pos: v3(h.gripLocal.pos), quat: q4(h.gripLocal.quat) }, aimLocal: { pos: v3(h.aimLocal.pos), dir: v3(h.aimLocal.dir) },
      gripPos: v3(h.gripPos), gripQuat: q4(h.gripQuat), aimPos: v3(h.aimPos), aimDir: v3(h.aimDir),
      trigger: h.trigger, triggerDown: h.triggerDown, triggerUp: h.triggerUp, swingDown: !!h.swingDown, grip: h.grip, gripDown: h.gripDown, gripUp: h.gripUp,
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
  // a comic scene now, whatever the flags and the save say (arg: a district's { id, name, left, clog })
  story(name, arg) { story(name, arg, true); },
  cutscene: () => cutscenes.info(),
  cutsceneArt: () => cutscenes.preload(), // resolves when every picture has loaded or failed
  wakeKing() { if (game && game.wakeKing) game.wakeKing(); },
  clearClog(id) { if (game && game.clearClog) game.clearClog(id); },
  portal: () => (portal ? portal.info() : null),
  lakeDrop: () => (lakeDrop ? { ...lakeDrop } : null),
  ui: () => (ui && ui.info ? ui.info() : { paused: !!(ui && ui.paused), panel: null, buttons: [] }),
  uiPress(id) { if (ui && ui.press) ui.press(id); },
  reality: () => (comfort && comfort.realityInfo ? comfort.realityInfo() : { planes: X.planes.size, meshes: X.meshes.size, maxFade: 0 }),
  camera: (name) => setShot(name),
  // flat play: turn the view by dx (yaw, left is +) and dy (pitch, up is +) radians at the next frame, like a mouse move
  look(dx = 0, dy = 0) { ov.lookX += +dx || 0; ov.lookY += +dy || 0; },
  // flat play: where the camera is and what the hero does ({ on: false } everywhere else)
  flat: () => (flatcam && flatOn ? { on: true, camera: v3(camera.position), quat: q4(camera.quaternion), fov: camera.fov, ...flatcam.info(), forward: v3(flatcam.forward), hero: hero.info() } : { on: false }),
  // flat play: the auto target. { on, tier, target, hand, side, ndc, inView, behind, pref, avoid, cue, specialNear, picks, rays }; on is
  // false outside flat play and in the opening. ndc is where the target lands on the screen of the camera now.
  target() {
    const on = !!(picker && pickerOn && flatOn && !isXR()), o = picker ? { ...picker.info() } : {};
    if (on && o.target) { project(TCTX, o.target.x, o.target.y, o.target.z, PROJ); o.ndc = { x: PROJ.x, y: PROJ.y }; o.inView = PROJ.inView; o.behind = PROJ.behind; }
    o.on = on; o.cue = !!(on && !G.input.easySwing && settings.cue !== false && (releaseWindow(P, P.ropes[0], DRAG[0]) || releaseWindow(P, P.ropes[1], DRAG[1])));
    return JSON.parse(JSON.stringify(o));
  },
  renderInfo: () => ({ ...lastInfo }),
  // one frame through the real render path (the bloom passes included) while the loop is off; pixels can be read after it
  render() { render(null); return { ...lastInfo }; },
  // the people and the signs (js/street.js): counts, states, reactions; people: every person out, for the scenario checks
  street: (all) => ({ ...street.info(), view: streetView.info(), people: all ? street.people.filter((p) => p.on).map((p) => ({ id: p.id, x: p.x, z: p.z, yaw: p.yaw, state: p.state, pose: p.pose, onWalk: street.onWalk(p) })) : undefined }),
  bloom: () => ({ ...bloom.info(), want: bloomLevel() }),
  // the city action (flat play): fights, cars, jobs, the moves, and the screen bits
  action: () => ({ on: actionOn(), driving, sprinting, energy, roll: P.roll || 0, combat: combat.info(), cars: cars.info(), jobs: jobs.info(), hud: actHud.info(), view: actionView.info(), figures: figures.info(), save: JSON.parse(JSON.stringify(save.jobs)), ropeTargets: [...ropeIds], cueAir: cueAir.slice(), slowT, hero: G.hero.info().pose }),
  // start a job (type: sludge, catch, washer, pizza, balloon, brawl, taxi, thief) at the nearest offer of that type, or at the hero
  job(type) { const o = jobs.offers.find((q) => q.type === type) || null; jobs.start(type, o, heroFight()); return jobs.info(); },
  jobOffers(on = true) { save.jobs.sludge = !!on; return jobs.info().offers; },
  spawnGoon(x, y, z, aggro = true) { const g = combat.spawn(x, y, z, "test"); g.aggro = aggro; return g.id; },
  // get into the nearest parked car (or the given one), and out
  // the street cars within r of the hero now (cars.js trafficAt), nearest first, and the hidden (stolen) instances
  traffic(r = 60) {
    const T = view.traffic(), out = [];
    if (T) for (let i = 0; i < T.n; i++) {
      const t = trafficAt(T, i, G.time);
      if (Math.abs(t.y) < 1 && Math.hypot(t.x - P.pos.x, t.z - P.pos.z) < r) out.push({ i, x: t.x, z: t.z, yaw: t.yaw, fx: t.fx, fz: t.fz, speed: t.speed, s: t.s, len: t.len, paint: t.paint });
    }
    out.sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
    return { list: out, hidden: view.trafficHidden(), near: trafficNear() };
  },
  enterCar(id) { const c = id == null ? cars.near(P.pos.x, P.pos.y, P.pos.z) : cars.cars.find((q) => q.id === id && q.on); if (c) enterCar(c); return driving; },
  exitCar() { if (driving) exitCar(); return !driving; },
  attack() { return tryAttack(); },
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
