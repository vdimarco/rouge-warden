// In Full Swing: every tunable number in one place.
// Plain data with no imports, so the Node tests and the page share it.
// Units are metres and seconds. Y is up, street level is y = 0, and the lake lies to the south (+z).

export const VERSION = "1.0.0";
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

/* ---------------- comfort ---------------- */
export const COMFORT = {
  presets: {
    comfortable: { vignette: "high", turn: "snap", snap: 45, speedCap: 20, fallCap: 14, aim: "high" },
    moderate: { vignette: "med", turn: "snap", snap: 45, speedCap: 26, fallCap: 26, aim: "med" },
    intense: { vignette: "off", turn: "smooth", snap: 45, speedCap: 35, fallCap: 35, aim: "med" },
    desktop: { vignette: "off", turn: "smooth", snap: 45, speedCap: 35, fallCap: 35, aim: "high" },
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
export const COLORS = {
  sludge: 0x7a8a2a, sludgeGlow: 0x9cff3a, porcelain: 0xf4f1ea, gold: 0xf2c14e,
  rope: 0xd8b872, cup: 0xd2202a, wood: 0xb07a3a, brass: 0xc9a44a,
  skyTop: 0x2c3f78, skyMid: 0xd97a4a, skyHorizon: 0xffc27a, fog: 0xe8a070, water: 0x2f5d7a,
  clean: 0x6ec6ff,
};

/* ---------------- the Cottage talks ---------------- */
// LINES_HANDS and LINES_DESKTOP keep the same keys and order, so ui.sayLine(group, i, kind) can pick the right words.
export const LINES = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Shoot the crack. Hold the trigger.", "Now pull back hard.", "Clear the space around you.", "Give yourself some room."],
  tutorial: ["Shoot the gold ring. Hold the trigger.", "Swing out. Let go at the bottom.", "Shoot again before you land.", "Squeeze the grip to reel in.", "Pull back hard to yank.", "Push the right stick to turn.", "Look at your left wrist.", "That green light is a clog. Plunge it."],
  clog: ["That's a clog. Plunge it.", "Pull back hard. Like you mean it.", "Flushed.", "The city thanks you. Quietly."],
  king: ["Twelve clogs. One King.", "The King is on the Needle.", "Rip his pipes off.", "Flushed. For good this time.", "He felt that one.", "He is getting angry."],
  splash: ["The lake is not a shortcut.", "Back to the roof."],
};
export const LINES_HANDS = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Pinch at the crack. Keep pinching.", "Now pull your hand back hard.", "Clear the space around you.", "Give yourself some room."],
  tutorial: ["Pinch at the gold ring. Keep pinching.", "Swing out. Open your fingers at the bottom.", "Pinch again before you land.", "Make a fist to reel in.", "Pull your hand back hard to yank.", "Tap the arrows on your wrist to turn.", "Look at your left wrist.", "That green light is a clog. Plunge it."],
  clog: LINES.clog, king: LINES.king, splash: LINES.splash,
};
export const LINES_DESKTOP = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Aim at the crack. Hold the left mouse button.", "Now press F to yank.", "Clear the space around you.", "Give yourself some room."],
  tutorial: ["Aim at the gold ring. Hold a mouse button.", "Swing out. Let go at the bottom.", "Shoot again before you land.", "Hold Shift to reel in.", "Press F to yank.", "Move the mouse to turn.", "Your score is at the top of the screen.", "That green light is a clog. Plunge it."],
  clog: LINES.clog, king: LINES.king, splash: LINES.splash,
};
