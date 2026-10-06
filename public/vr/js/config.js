// In Full Swing: every tunable number in one place.
// Plain data with no imports, so the Node tests and the page share it.
// Units are metres and seconds. Y is up, street level is y = 0, and the lake lies to the south (+z).

export const VERSION = "1.14.0";
export const SAVE_KEY = "plungerd.vr.v1";
export const PACKAGE_ID = "com.cottagearcade.fullswing";

/* ---------------- the city ---------------- */
export const WORLD = {
  seed: 1972,
  bounds: { minX: -640, maxX: 640, minZ: -760, maxZ: 300 },
  shoreZ: 300,
  chunk: 160, // cityview merges buildings per chunk this size
  block: { w: 72, d: 96 }, // typical block between street centre lines
  street: 20,
  needle: { x: -90, z: 225, shaftR: 7, podY0: 262, podY1: 286, podR: 19, top: 360, collars: [60, 110, 160, 210], deckY: 262 },
  dome: { x: 70, z: 215, r: 55, h: 40 },
  expressway: { z: 283, y: 12, w: 22 }, // south of the Dome, which reaches z 270
  clogsPerDistrict: 2,
  loonies: 80,
  anchorReach: 60, // from any point above 15 m there is a surface this close
};

// Points toward the sun: low in the west-south-west, golden hour.
export const SUN_DIR = (() => { const x = -0.62, y = 0.2, z = 0.76, l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; })();

/* ---------------- swinging ---------------- */
// Starting values from research/swing-design.md §8. Tune by playing.
export const SWING = {
  gravity: 9.8,
  quadDragC: 0.0075, // quadratic drag: terminal speed about 36 m/s
  cupSpeed: 220, // the plunger cup flies this fast along the aim ray
  flyMax: 0.3, // but never takes longer than this to land
  dryFly: 6, // with no target the cup flies this far and drops
  ropeRange: 80, // the reticle shows a valid target within this distance
  rangeGrace: 1.1, // the real range is 10 % longer than the reticle says
  aimCone: { low: 5, med: 9, high: 14 }, // degrees of cone search when the exact ray misses
  specialCone: 16, // clogs, pipes and the crack snap inside this cone
  targetSwitchMargin: 0.2,
  attachLengthFactor: 0.97, // a small tug when the cup lands
  minRopeLen: 2,
  lenRate: 15, // the rope length moves toward its target this fast, so a change never pops the body
  catchTime: 0.12, // a slack rope that goes taut catches the body over this time
  chestH: 1.25, // the rope pulls on the chest, at this height above the feet (scaled by calibrated height)
  reelSpeedMax: 9, // grip fully squeezed
  yank: { threshold: 1.2, gain: 2.2, maxDV: 7, cooldown: 0.35, shorten: 1.5 },
  handOverHandGain: 1.3,
  airAccel: 3, airAccelAttached: 1.5, airControlMaxSpeed: 6,
  dangleDamp: { speedBelow: 3, lenBelow: 10, after: 0.8, perSec: 1.5 }, // kills the slow pendulum that makes people sick
  ground: { run: 3.5, friction: 10, jump: 5.2, landHard: 12 },
  chestRadius: 0.35, kneeRadius: 0.3, bounce: 0.1,
  maxSubsteps: 8, fixedDt: 1 / 120,
  snapBlocked: 0.25, // a rope blocked by a wall for this long snaps
  fireHold: 0.3, // a trigger held on an idle hand still fires if a target shows up within this time
};

/* ---------------- flat-play moves: the sprint and the landing roll ---------------- */
// Shift (a pad's left stick click) on the ground with no rope out runs at sprint times the run speed and drains the energy
// gauge (0..1) at drain a second; it fills again at fill a second, after a pause of wait seconds. A landing from a dive, or one
// faster than fall m/s down, rolls for time seconds and keeps at least minSpeed along the ground. Headset play has neither.
export const MOVES = {
  sprint: 2.2, drain: 0.2, fill: 0.16, wait: 0.8, minEnergy: 0.12,
  roll: { time: 0.62, minSpeed: 6, friction: 1.4, fall: 13 },
};

/* ---------------- wall climbing (flat play) ---------------- */
// Touch a wall in the air, or walk into one, and you hold on to it. W/S or the up/down arrows climb, A/D or left/right go
// along it, Space jumps off, and a rope fired from the wall swings you off it. Headset play does not climb.
export const CLIMB = {
  speed: 6, // m/s up, down and along the wall
  wallY: 0.35, // a surface whose normal is this close to flat (|ny| under it) is a wall you can hold
  gap: 0.03, // the chest sphere stays this far off the wall
  reach: 0.5, // the wall must stay this close to the chest sphere, or the move stops (a corner, the top)
  mantle: 1.8, // at the top, a roof up to this far over the chest is climbed onto
  inset: 0.7, // the feet land this far in from the roof edge
  jump: { out: 6, up: 6 }, // Space (or JUMP) pushes off the wall this hard (m/s)
  ropeOff: { out: 2, up: 2 }, // a rope fired from the wall pushes off this hard (m/s)
  regrab: 0.4, // after you leave a wall, you do not grab one for this long (s)
  brushSpeed: 8, headOn: 0.4, // in the air, a wall grabs you when slower than brushSpeed, or when this share of your speed (not
  // counting a fall) goes into it: a swing that brushes a wall keeps going
  head: 1.7, headR: 0.25, // the head sphere over the feet: a ceiling it meets on the way up is an overhang
  lip: 1, lipReach: 40, // under an overhang you move out to its face (found up to lipReach m out) and up lip m
};

/* ---------------- one-tap phone swinging ---------------- */
// Flat play on a touch screen: tap to swing, the rope lets go by itself, and the body moves much faster than in a headset.
export const PHONE = {
  physics: { gravity: 14, quadDragC: 0.0045 }, // punchier arcs, and a terminal speed near 48 m/s
  attachSpeed: 17, // a rope that catches gives at least this much speed across the rope, toward where you look
  fling: { forward: 7, up: 4, kick: 10 }, // the auto-release adds this speed (m/s) and widens the view by kick degrees
  // The rope lets go with a fling this many degrees past the bottom of the arc, this close under the anchor, or (a vault up and
  // over, with vault m/s up) this close to it. It lets go with no fling after ground s on roofs or stall s under stallSpeed.
  release: { minT: 0.35, angle: 32, overTop: 1.5, close: 5, vault: 10, ground: 0.01, stall: 2.5, stallSpeed: 4 },
  // A rope that catches keeps your speed: the part that flies away from the anchor turns into swing, toward where you look. It is
  // also short enough that the lowest point of its arc stays clear m over the street, so a chain of taps never drags you along it.
  catch: { clear: 6, min: 8, rate: 30 }, // (min: no change when that would leave a rope shorter than this; rate: m/s it shortens)
  // The marker prefers a building point at least y m up and up m over the chest: it wins over any lower one (bonus to the score)
  high: { y: 22, up: 8, bonus: 1 },
  handoff: 0.12, // s: when a new plunger catches, the other one lets go this much later (so taps on alternate sides chain)
  pair: 0.3, // s: two plungers thrown this close together hold together (a double swing)
  pumpYank: 3.5, // a rope on a clog or a pipe pumps by itself at this pull (m/s), once per yank cooldown
  buzz: { attach: 15, yank: 25, pump: 40 }, // vibration (ms) on a catch, where the browser has it
  follow: { speed: 6, idle: 0.7, yawRate: 2.4, pitch: 0.14, pitchRate: 1.2 }, // the camera turns toward where you fly
  fov: { base: 75, wide: 24, from: 12, to: 42 }, // the view widens by up to wide degrees over this speed range (m/s)
  lines: { from: 13, to: 34 }, // the phone's comic speed lines at the screen edges grow over this speed range (m/s)
};

/* ---------------- the auto target (flat play) ---------------- */
// Flat play picks one building point for each swing (js/target.js). Start values: the first-time bots in qa/vr/target.test.mjs
// tune them. Metres, seconds and degrees unless a name says radians.
export const TARGET = {
  rate: 0.05, rateWide: 0.2, // s between searches (tier 1, tier 2)
  // the fan: azimuth each side of the bearing (the Aim assist setting picks one), elevation about the preferred one
  fan: { az: { low: 21, med: 28, high: 35 }, azStep: 7, elSpan: 25, elStep: 10, elMin: 20, elMax: 75, screenX: 0.92 },
  tier1: { min: 9, max: 80, above: 4 },
  tier2: { min: 9, max: 88, above: 3, yaw: [0, -22, 22, -45, 45, -75, 75], pitch: [28, 42, 56, 16], cone: 24, ahead: 2, minSpeed: 4 }, // the old phone assist
  tier3: { min: 9, max: 88, above: 3 },
  lift: { base: 35, min: 35, max: 60, fall: 12, fallFrom: 3, fallTo: 15, top: 72 }, // preferred elevation, degrees
  weight: { angle: 0.55, distance: 0.35, up: 0.25, ahead: 0.15, wall: 0.1 },
  dist: { near: 25, far: 60, ramp: 25 }, // no distance penalty from near to far (m), then it grows to 1 over ramp
  recent: { penalty: 0.6, count: 2, secs: 8 },
  special: { enter: 22, leave: 28, range: 60, pipeFacing: 60, tap: 16, tapRange: 88, near: 35 },
  ring: { bearing: 35, range: 80 }, // the gold ring in tutorial step 0
  hold: { margin: SWING.targetSwitchMargin, dwell: 0.2 }, // a challenger must score this much higher (0.2 = 20 percent) to replace the held target
  bias: { steepHoriz: 0.34 }, // a tap ray with a smaller horizontal part gives no bias
  cue: { from: 25, to: 60, drag: 0.5 }, // degrees past the bottom; s dragged on the ground
  side: 6, // degrees: below this, the hands alternate
  noneLine: 10, // s between the "No building" lines
};
// Mouse, keys and pad. attachSpeed is the kick on attach (m/s, 0 = off), hop is a jump toward the target from the ground (m/s,
// 0 = off), wheel: one notch reels this long (s), and a stream reels at most cap s in any per s.
export const DESKTOP = { attachSpeed: 10, hop: 0, wheel: { reel: 0.15, cap: 0.3, per: 0.5 } };
export const PAD = { dead: 0.15, curve: 1.5, lookRate: Math.PI, trigger: { on: 0.5, off: 0.3 }, rumble: { attach: [0.3, 30], yank: [0.4, 40], pump: [0.6, 60] } };
export const HINT = { seconds: 60 }; // the key hint strip shows for the first minute of an unfinished tutorial
// The chase camera. They live here so the first-time bots and the game share them.
export const FLATCAM = { followTau: 1.2, holdLook: 1.5, pitch0: (-20 * Math.PI) / 180, arm: 4.5, lift: 0.14, liftHold: 0.7, liftRate: 3, turnSecs: 0.4 }; // pitch0: the chase view looks down 20 degrees, over the head

/* ---------------- comfort ---------------- */
export const COMFORT = {
  presets: {
    comfortable: { vignette: "high", turn: "snap", snap: 45, speedCap: 20, fallCap: 14, aim: "high" },
    moderate: { vignette: "med", turn: "snap", snap: 45, speedCap: 26, fallCap: 26, aim: "med" },
    intense: { vignette: "off", turn: "smooth", snap: 45, speedCap: 35, fallCap: 35, aim: "med" },
    desktop: { vignette: "off", turn: "smooth", snap: 45, speedCap: 35, fallCap: 35, aim: "high" },
    phone: { vignette: "off", turn: "smooth", snap: 45, speedCap: 48, fallCap: 40, aim: "high" },
  },
  defaultPreset: "moderate",
  vignetteMinFov: { off: 110, low: 90, med: 75, high: 60 }, // degrees of clear view at full strength
  vignette: { wAccel: 1, wYaw: 1, wSpeed: 0.5, accel: [2, 15], yaw: [30, 120], speed: [8, 30], attack: 0.1, hold: 0.2, release: 0.5, feather: 0.2 },
  smoothTurnDegPerSec: 90,
  snapOn: 0.7, snapOff: 0.3, // stick x to snap, and to re-arm
  snapBlink: 0.06,
  standingHead: 1.65,
  realityNear: { head: 0.9, hand: 0.5 },
  bubble: { from: 1, to: 1.4, ring: 1 }, // AR with no room data: passthrough fades in as you leave your spot
  seatedBelow: 1.3, // a head lower than this at the start means you are seated
};

/* ---------------- speed ---------------- */
export const PERF = {
  hz: 72, fastHz: 90,
  foveation: 0.5,
  drawsPerViewMax: 120,
  trisPerViewMax: 800000,
  buildBudgetMs: 6, // city chunks built per frame while the intro plays
  fogNear: 180, fogFar: 900,
  cameraNear: 0.1, cameraFar: 4000,
  waterY: -0.15,
};

/* ---------------- the game ---------------- */
export const GAME = {
  pumpsToFlush: 3,
  pumpMin: 0.8, // a pump needs a pull this far over the yank threshold (2.0 m/s)
  clogRadius: 2.5,
  loonieRadius: 2.2,
  looniesPerFlush: 5,
  king: { unlock: 12, pipes: 3, hearts: 3, throwEvery: 3.5, windUp: 1, ballSpeed: 14, ballGravity: 4, ballRadius: 0.5, hitRadius: 0.3, grace: 3, firstDelay: 5, height: 16, reactAt: [4, 8] },
  bankMax: 140,
  unlocks: { stripe: 30, cup: 60, launcher: 100, fireworks: 140 },
  tutorialRepeat: 8, tutorialTimeout: 30,
  intro: { widenAfter: 10, autoFireAfter: 20, easyYankAfter: 10, easyYank: 0.6, burstAfter: 20, skipAfter: 30, revealSpeed: 14, revealEnd: 40, holeWidth: 1.3 },
  trialStartHold: 1,
  ringRadius: 5,
};

/* ---------------- colours ---------------- */
// The training checklist in flat play: each row's words and keys, and what is said while it is the next row: a line of the
// tutorial tables (line: its index there, so each input hears its own words) or its own words (say). The rows tick in any
// order; the first is the gold ring, as in the spoken tutorial. A headset keeps the spoken tutorial. "of": a live count.
export const TRAINING = {
  mouse: [
    { id: "rope", text: "Swing at the gold ring", keys: ["HOLD W", "+ LEFT MOUSE"], line: 0 },
    { id: "swing", text: "Let go when the ring says GO", keys: ["RELEASE"], line: 1 },
    { id: "again", text: "Swing again before you land", keys: ["LEFT MOUSE", "OR E"], line: 2 },
    { id: "reel", text: "Reel in", keys: ["HOLD SHIFT"], line: 3 },
    { id: "yank", text: "Yank for speed", keys: ["F"], line: 4 },
    { id: "look", text: "Look around", keys: ["MOUSE"], line: 5 },
    { id: "climb", text: "Climb a wall", keys: ["W", "A", "S", "D"], say: "Fly into a wall, then climb with W, A, S and D. Space jumps off." },
    { id: "plunge", text: "Plunge a clog: rope it, then pump", keys: ["F", "F", "F"], of: 3, line: 7 },
  ],
  pad: [
    { id: "rope", text: "Swing at the gold ring", keys: ["LEFT STICK UP", "+ RT"], line: 0 },
    { id: "swing", text: "Let go when the ring says GO", keys: ["RELEASE RT"], line: 1 },
    { id: "again", text: "Swing again before you land", keys: ["RT"], line: 2 },
    { id: "reel", text: "Reel in", keys: ["HOLD LB"], line: 3 },
    { id: "yank", text: "Yank for speed", keys: ["RB"], line: 4 },
    { id: "look", text: "Look around", keys: ["RIGHT STICK"], line: 5 },
    { id: "climb", text: "Climb a wall", keys: ["LEFT STICK"], say: "Fly into a wall, then climb with the left stick." },
    { id: "plunge", text: "Plunge a clog: rope it, then pump", keys: ["RB", "RB", "RB"], of: 3, line: 7 },
  ],
  touch: [
    { id: "rope", text: "Swing at the gold ring", keys: ["TAP"], line: 0 },
    { id: "swing", text: "Swing out", keys: ["IT LETS GO"], line: 1 },
    { id: "again", text: "Tap the other side before you land", keys: ["L", "R"], line: 2 },
    { id: "fast", text: "Fly fast: tap left, right, left", keys: ["L", "R"], line: 4 },
    { id: "look", text: "Look around", keys: ["DRAG"], line: 5 },
    { id: "climb", text: "Climb a wall", keys: ["ARROWS"], say: "Fly into a wall, then hold the arrows to climb." },
    { id: "plunge", text: "Plunge a clog: tap it, hold on", keys: ["TAP"], of: 3, line: 7 },
  ],
};

export const COLORS = {
  sludge: 0x7a8a2a, sludgeGlow: 0x9cff3a, porcelain: 0xf4f1ea, gold: 0xf2c14e,
  rope: 0xd8b872, cup: 0xd2202a, wood: 0xb07a3a, brass: 0xc9a44a,
  skyTop: 0x2c3f78, skyMid: 0xd97a4a, skyHorizon: 0xffc27a, fog: 0xe8a070, water: 0x2f5d7a,
  clean: 0x6ec6ff,
};

/* ---------------- the Cottage talks ---------------- */
// LINES_HANDS, LINES_DESKTOP, LINES_PAD and LINES_PHONE keep the same keys and order, so ui.sayLine(group, i, kind) can pick the
// right words. The three flat tables also have a wall group: the first wall line.
export const LINES = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Shoot the crack. Hold the trigger.", "Now pull back hard.", "Clear the space around you.", "Give yourself some room.", "The toilet is overflowing! Shoot it. Hold the trigger.", "Now pull back hard. Flush it!"],
  tutorial: ["Shoot the gold ring. Hold the trigger.", "Swing out. Let go at the bottom.", "Shoot again before you land.", "Squeeze the grip to reel in.", "Pull back hard to yank.", "Push the right stick to turn.", "Look at your left wrist.", "That green light is a clog. Plunge it."],
  clog: ["That's a clog. Plunge it.", "Pull back hard. Like you mean it.", "Flushed.", "The city thanks you. Quietly."],
  king: ["Twelve clogs. One King.", "The King is on the Needle.", "Rip his pipes off.", "Flushed. For good this time.", "He felt that one.", "He is getting angry."],
  splash: ["The lake is not a shortcut.", "Back to the roof."],
};
export const LINES_HANDS = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Pinch at the crack. Keep pinching.", "Now pull your hand back hard.", "Clear the space around you.", "Give yourself some room.", "The toilet is overflowing! Pinch at it. Keep pinching.", "Now pull your hand back hard. Flush it!"],
  tutorial: ["Pinch at the gold ring. Keep pinching.", "Swing out. Open your fingers at the bottom.", "Pinch again before you land.", "Make a fist to reel in.", "Pull your hand back hard to yank.", "Tap the arrows on your wrist to turn.", "Look at your left wrist.", "That green light is a clog. Plunge it."],
  clog: LINES.clog, king: LINES.king, splash: LINES.splash,
};
// Mouse and keys. The game picks the building, so the lines say look at it and let go when the ring says GO.
export const LINES_DESKTOP = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Aim at the crack. Hold the left mouse button.", "Now press F to yank.", "Clear the space around you.", "Give yourself some room.", "The toilet is overflowing! Aim at it. Hold the left mouse button.", "Now press F to yank. Flush it!"],
  tutorial: ["Look at the gold ring. Hold W and the left mouse button.", "Swing out. Let go when the ring says GO.", "Swing again before you land.", "Hold Shift to reel in.", "Press F to yank.", "Move the mouse to look around.", "Your score is at the top of the screen.", "That green light is a clog. Look at it and swing."],
  clog: ["That's a clog. Look at it and swing.", "Press F three times to pump.", "Flushed.", "The city thanks you. Quietly."],
  king: LINES.king, splash: LINES.splash,
  wall: ["On the wall. W and S climb, A and D go along it. Space jumps off."],
};
// A game pad. The words fit an Xbox pad and a PlayStation pad: trigger, bumper, stick and "the bottom button".
export const LINES_PAD = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Aim at the crack. Hold the right trigger.", "Now press the right bumper to yank.", "Clear the space around you.", "Give yourself some room.", "The toilet is overflowing! Aim at it. Hold the right trigger.", "Now press the right bumper to yank. Flush it!"],
  tutorial: ["Look at the gold ring. Hold the left stick up and the right trigger.", "Swing out. Let go when the ring says GO.", "Swing again before you land.", "Hold the left bumper to reel in.", "Press the right bumper to yank.", "Push the right stick to look around.", "Your score is at the top of the screen.", "That green light is a clog. Look at it and swing."],
  clog: ["That's a clog. Look at it and swing.", "Press the right bumper three times to pump.", "Flushed.", "The city thanks you. Quietly."],
  king: LINES.king, splash: LINES.splash,
  wall: ["On the wall. Push the left stick to climb. Press the bottom button to jump off."],
};
// Phone play: one tap swings, the rope lets go by itself, and a rope on a clog plunges by itself.
export const LINES_PHONE = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Tap the crack.", "It plunges by itself.", "Clear the space around you.", "Give yourself some room.", "The toilet is overflowing! Tap it.", "It plunges by itself. Flush!"],
  tutorial: ["Tap left or right to swing at the gold ring.", "Swing out. The rope lets go by itself.", "Tap the other side before you land.", "The rope reels you in by itself.", "Tap the next building while you fly.", "Drag to look around.", "Your score is at the top of the screen.", "That green light is a clog. Tap it to plunge."],
  clog: ["That's a clog. Tap it to plunge.", "Hold on. It plunges by itself.", "Flushed.", "The city thanks you. Quietly."],
  king: LINES.king, splash: LINES.splash,
  wall: ["On the wall. Hold the arrows to climb. Tap JUMP to jump off."],
};
