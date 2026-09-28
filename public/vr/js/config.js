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
  needle: { x: -90, z: 225, shaftR: 7, podY0: 262, podY1: 286, podR: 19, top: 360 },
  dome: { x: 70, z: 215, r: 55, h: 40 },
  expressway: { z: 270, y: 12, w: 22 },
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
  cupSpeed: 150, // the plunger cup flies this fast along the aim ray
  ropeRange: 80, // the reticle shows a valid target within this distance
  rangeGrace: 1.1, // the real range is 10 % longer than the reticle says
  aimCone: { low: 5, med: 9, high: 14 }, // degrees of cone search when the exact ray misses
  specialCone: 16, // clogs, pipes and the crack snap inside this cone
  targetSwitchMargin: 0.2,
  attachLengthFactor: 0.97, // a small tug when the cup lands
  minRopeLen: 2,
  reelSpeedMax: 9, // grip fully squeezed
  yank: { threshold: 1.2, gain: 2.2, maxDV: 7, cooldown: 0.35, shorten: 1.5 },
  handOverHandGain: 1.3,
  airAccel: 3, airAccelAttached: 1.5, airControlMaxSpeed: 6,
  dangleDamp: { speedBelow: 3, after: 1, perSec: 1.5 },
  ground: { run: 3.5, friction: 10, jump: 5.2, landHard: 12 },
  chestRadius: 0.35, kneeRadius: 0.3, bounce: 0.1,
  maxSubsteps: 8, fixedDt: 1 / 120,
};

/* ---------------- comfort ---------------- */
export const COMFORT = {
  presets: {
    comfortable: { vignette: "high", turn: "snap", snap: 45, speedCap: 20, aim: "high" },
    moderate: { vignette: "med", turn: "snap", snap: 45, speedCap: 26, aim: "med" },
    intense: { vignette: "off", turn: "smooth", snap: 45, speedCap: 35, aim: "med" },
  },
  defaultPreset: "moderate",
  vignetteMinFov: { off: 110, low: 90, med: 75, high: 60 }, // degrees of clear view at full strength
  vignette: { wAccel: 1, wYaw: 1, wSpeed: 0.5, accel: [2, 15], yaw: [30, 120], speed: [8, 30], attack: 0.1, hold: 0.2, release: 0.5, feather: 0.2 },
  smoothTurnDegPerSec: 90,
  snapDebounce: 0.3,
  standingHead: 1.65,
  realityNear: { head: 0.9, hand: 0.5 },
};

/* ---------------- speed ---------------- */
export const PERF = {
  hz: 72, fastHz: 90,
  foveation: 0.5,
  drawsPerViewMax: 120,
  trisPerViewMax: 800000,
  buildBudgetMs: 6, // city chunks built per frame while the intro plays
  fogNear: 180, fogFar: 900,
  cameraFar: 4000,
};

/* ---------------- the game ---------------- */
export const GAME = {
  pumpsToFlush: 3,
  clogRadius: 2.5,
  loonieRadius: 2.2,
  looniesPerFlush: 5,
  king: { unlock: 12, pipes: 3, hearts: 3, throwEvery: 2.8, ballSpeed: 30, ballRadius: 1.2, height: 16 },
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
export const LINES = {
  intro: ["Shoes off. Plunger up.", "Hear that? Something is backing up.", "Shoot the crack. Pull the trigger.", "Now yank it. Pull back hard."],
  tutorial: ["Shoot a roof. Hold the trigger to hang on.", "Let go at the bottom of the swing.", "Squeeze the grip to reel in.", "Pull your hand back hard to yank.", "That green light is a clog. Plunge it."],
  clog: ["That's a clog. Plunge it.", "Pull back hard. Like you mean it.", "Flushed.", "The city thanks you. Quietly."],
  king: ["Twelve clogs. One King.", "The King is on the Needle.", "Rip his pipes off.", "Flushed. For good this time."],
  splash: ["The lake is not a shortcut.", "Back to the roof."],
};
