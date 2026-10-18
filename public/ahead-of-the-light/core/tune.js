// Ahead of the Light: the tuning table (final.md 19, with the critic's values) as one frozen TUNE, the spans it
// gives as RANGES, and parseOverrides, which reads ?KEY=value from the page URL. Pure: no browser names, no clocks.
// Units: seconds, degrees, η (rapidity), CSS px. A value written "0.26 for 1.0 s" in the table is two keys here.

export const SLUG = 'ahead-of-the-light';

// The game's URL options (20). They are not tuning keys, and only seed and daily keep a run ranked.
export const OPTIONS = Object.freeze(['seed', 'daily', 'leg', 'lane', 'ship', 'piece', 'loop', 'toy', 'bot', 'debug',
  'perf', 'cam', 'button', 'scheme', 'burn', 'tier', 'barks']);
const RANKED_OPTIONS = new Set(['seed', 'daily']);

const TABLE = {
  // ---- screen (4.1, 6.1, 8.1, 15.2) ----
  F: 0.494,                     // focal length, × the screen's short side
  RING_FLOOR: 0.30,             // the ring's smallest radius, × the short side
  RING_FLOOR_PX: 112,           // and never under this
  RING_PUNCH: 0.26,             // the LIGHT SPEED punch: the ring at 26 % of the short side
  PUNCH_S: 1.0,                 // for 1.0 s
  CENTRE_Y_PORTRAIT: 0.40,      // ring centre, × the screen height
  CENTRE_Y_LANDSCAPE: 0.46,
  CENTRE_Y_DESKTOP: 0.48,
  ETA0: 1.0,                    // cruise η: the ring's launch size, the engine's target, course speed's base
  ETA_RING_TOP: 3.8,            // the ring reaches its floor here
  SKY_CAP: 5.0, SKY_PUNCH: 6.0,
  AHEAD_MIN: 0.20,              // a rival ahead is never drawn nearer the centre than this share of the ring
  BEHIND_MIN: 22,               // px outside the ring for a rival behind you
  BEHIND_EDGE: 12,              // px inside the screen edge where a rival behind is clamped
  KB_PHONE: 1.4, KB_DESK: 0.85, // the burst ring's growth, phones and desktop
  TTC_FULL: 300,                // s: the burst ring is at full size from here
  WING_FROM: 8,                 // °: the first wing item from the ship
  WING_PITCH: 5,                // °: one item every 5°
  WING_OUT: 7,                  // px outside the ring

  // ---- course (6.1, 11.2) ----
  V0: 1.605,                    // course speed at η 1, tube radii a second
  V_K: 0.16,                    // × (1 + V_K × (min(η, V_ETA_CAP) − 1))
  V_ETA_CAP: 3.8,
  LS_SURGE: 1.08,               // × at LIGHT SPEED
  BEAT_R: 0.86,                 // one beat, in tube radii
  BPM0: 112,
  SPAWN_BEATS: 12, GONE_BEATS: 4, LAUNCH_BEATS: 6, LAUNCH_BEATS_FIRST: 4,

  // ---- ship (5.1) ----
  SHIP_HALF: 3.5, GRAZE: 7, GRAZE_SOFT: 12, SOFT_BEATS: 19, HAIR: 2.5, SKIM_BAND: 6, RAIL_HALF: 1.5,
  GAIN: 0.6, GAIN_FAST: 1.4,    // °/px of drag
  GAIN_V0: 150, GAIN_V1: 1200,  // px/s where the gain starts and stops rising
  TURN_MAX: 600, TURN_TAU: 0.025, KEY_TURN: 330, KEY_RAMP: 0.06,
  CAM_LAG: 0.12, CAM_MAX: 240, CAM_WHIP: 200,

  // ---- speed (5.6, 6.1) ----
  LAUNCH_THREAD: 1.6, LAUNCH_PAST: 1.0, LAUNCH_DOCK: 0.8, ETA_MIN: 0.6, ETA_MAX: 5.3,
  ENGINE: 0.08,                 // η/s below ETA0
  DRAG: 0.03,                   // η/s
  DRAG_GEAR: 0.5,               // drag + 50 % a gear
  NINES: [1.4722, 2.6467, 3.8002, 4.9517],   // 0.9c, 0.99c (HEADLIGHT), 0.999c, 0.9999c (LIGHT SPEED)
  LS_DROP: 3.8, RIVAL_ETA_MAX: 3.8,
  KICK: 0.04, KICK_HAIR: 0.10,
  SKIM: 0.03,                   // η/s
  KICK_RIVAL: 0.08,
  HIT_ETA: 0.7,                 // WP9: 0.5 → 0.7 (risk 3's first lever): a hit slows you enough for the light to press
  RIVAL_HIT_ETA: 0.4,           // playtest P0-3: a rival's hit (WP9's 0.7 is yours); the field lives longer
  THREAD_ETA: 0.8, PAIR_ETA: 0.25,
  CHAIN_TIMEOUT: 3.0,
  CHAIN_LIT_BONUS: 3,           // s added to the chain timer per burn in HEADLIGHT

  // ---- burn (5.2) ----
  BURN_ETA: 0.4, BURN_S: 0.3,
  BURN_CAP: 2.6,                // none in the VOID (the leg sets it)
  OBERTH_ETA: 0.8, OBERTH_ANGLE: 150,
  SCOOP_LEG_MAX: 2,             // cells a leg from BUSSARD SCOOP
  SCOOP_LIFTER_MAX: 3,          // with STAR LIFTER

  // ---- fuel (5.7, 8.1) ----
  FUEL0: 2, FUEL_CAP: 4, FUEL_CAP_MAX: 6,
  FUEL_PER_LEG: [1, 3, 3, 3, 3, 3, 3, 3],
  SPILL: 1, TAKEDOWN_FUEL: 1, SKIP_FUEL: 1,
  PICK_DEG: 4,                  // °: a pickup is collected within this of the ship's edge
  FULL_TANK_SHIELD: 2,          // s off the shield's recharge for a fuel pickup at full tanks (critic lead item 3)

  // ---- hull (5.6, 8.1) ----
  HULL0: 3, HULL_MAX: 3, HULL_CAP: 5, SHIELD_MAX: 1, SHIELD_T: 5,   // playtest P0-1: 8 → 5
  FLICKER: 1.0, HITSTOP: 0.12, STUMBLE: 1.0, STUMBLE_S: 0.4, SOFT_S: 10, BUMP: 10,
  RIVAL_STUMBLE: 0.4,           // s of gap a rival's hit costs it (playtest P0-3; yours is STUMBLE)
  PATCH_AT: 0.55,               // of the leg
  PATCH_LOOK: 3,                // s before it comes into view

  // ---- the light (7) ----
  GAP0: 7,                      // s: your gap at a run's start (playtest P0-2: 8 → 7, the burst is nearer)
  RIVAL_GAP0: 8,                // s: each rival's gap at a run's start
  // WP9: legs 2 to 8 hold the light closer and push it back less (start 8, 7, 6, 5, 5, 5, 4.5, 4.5 and 1.00, 0.94,
  // 0.88, 0.83, 0.78, 0.73, 0.69, 0.65); leg 1 is unchanged, so a first leg stays gentle. Playtest P0-1: the caps of
  // legs 2 to 8 (WP9: 5, 4, 3.4, 3.4, 3.4, 3, 3) are a buffer of 2 or 3 hits, and each leg's cap holds from its launch.
  // The masses rose 0.08 (WP9: 0.70, 0.66, 0.63, 0.61, 0.58, 0.55, 0.51) once an item is judged once: a stumble no
  // longer pays a second THREAD or graze for what it glides back over (the mid home rate fell from 33 to 23 %; with
  // these 38 %, the novice's median run 3.1 min)
  GAP_CAP: [8, 3.5, 3, 3, 3, 3, 2.8, 2.8],
  MASS_K: [1.00, 0.78, 0.74, 0.71, 0.69, 0.66, 0.63, 0.59],
  BLEED: 1.0,                   // the gap falls by BLEED × (1 − tanh η) a second
  PB_GRAZE: 0.12, PB_HAIR: 0.30,
  PB_SKIM: 0.20,                // s/s
  PB_RIVAL: 0.12,
  PB_WHIP: 0.4,                 // × mass × (0.5 + d), half on a WIDE
  PB_PAIR: 0.5, PB_TAKEDOWN: 0.3,
  PB_THREAD: 2.0, PB_DOCK: 1.5, PB_PAST: 0.5,
  OVERCAP: 1.5, OVERCAP_DECAY: 0.1,
  CAP_OVERFLOW_SHIELD: 1,       // s off the shield's recharge per s of push-back lost at the cap (critic lead item 7)
  STUMBLE_FLOOR_TTC: 2.9,       // a hit outside the glare stops the gap here (7.3)
  TTC_LABEL: 10, TTC_WARN: 6, TTC_REARM: 9, GLARE_IN: 3.0, GLARE_OUT: 4.5, GLARE_PEAK_S: 4, BREATHER_S: 5,
  GLARE_ALPHA: 0.55,
  HEART_BPM: [60, 140],         // a span: see RANGES
  EASY_X: 0.75,
  QUIT_GAP: 2,                  // s of gap lost when a run left mid-leg resumes (9.2; critic lead item 6)

  // ---- the whip (5.3) ----
  WELLS: {
    small: { core: 4, reach: 35, mass: 0.8 },
    medium: { core: 5, reach: 40, mass: 1.0 },
    large: { core: 7, reach: 45, mass: 1.3 },
    landmark: { core: 9, reach: 50, mass: 2.0 },
  },
  PULL: 15,                     // °/s
  PULL_S: 1.0, WIN_EARLY: 0.35, WIN_LATE: 0.15, GRAB_COST: 0.25, LATCH_S: 0.12, CANCEL_PX: 20,
  SWEEP0: 120, SWEEP1: 200, SWEEP_A: 300, WORLD_SLOW: 0.5,
  EXIT_W: 60, PERFECT: 10, LIFT_COMP: 0.05, LAND_GRACE: 0.25,
  AIM: [1.5, 1.0, 0.5],         // PERFECT, GOOD, WIDE
  GAIN_BASE: 0.10, GAIN_DEPTH: 0.50, RED_SPAN: 75, RED_X: 1.3, WHIP_GAIN_X: 1.0,
  SCORCH_WARN: 0.6, LETGO_LEAD: 0.25, LETGO_MIN: 0.4, WAKE_START: 0.5, TEACH_SWEEP: 0.5, TEACH_WIN: 1.5,

  // ---- draft (5.4) ----
  WAKE_NEAR: 0.08, WAKE_FAR: 0.8, WAKE_HALF: 6,
  SUCTION: 0.06,                // η/s
  DRAFT_FILL: 1.0, DRAFT_KEEP: 0, TOW: 1.10,
  PULL_OUT: 10, SLING_ETA: 0.30, SLING_MIN: 0.5, SLING_SURGE: 1.3, SLING_S: 0.8,

  // ---- contact (5.5) ----
  CONTACT_Z: 0.08, SHOVE0: 12,
  SHOVE_K: 0.04,                // ° per °/s of closing speed
  SHOVE_MAX: 30, SHOVE_S: 0.15, SHOVE_X: 1,
  SLAM_V: 200, BUMP_SHOVE: 6, REAR_ETA: 0.2, REAR_SHOVE: 4, TAKEDOWN_S: 0.4, TRAP_S: 0.4, TRAP_GAP: 7, LEAN_S: 0.3,
  PHASE_COOLDOWN: 6.5,          // s PHASE HULL's hull stays solid after a pass through a rival (12.3)

  // ---- reading (playtest A) ----
  TICK_LEAD: 1.3, OUTLINE_LEAD: 1.2, PREVIEW_LEAD: 3.0, SILHOUETTE: 0.5, ALARM_LEAD: 0.6,

  // ---- feel (6.2) ----
  SLOWMO_X: 0.5, HEADLIGHT_SLOW: 0.4, LS_FREEZE: 0.15, LS_WHITE: 0.2, RESUME_SLOW: 0.6,
  MUSIC_NUDGE: 0.03,

  // ---- input (15.1) ----
  DRAG_PX: 8, FLICK_PX: 48, FLICK_MS: 150, FLICK_SPEED: 700, TAP_MS: 220, TAP_PX: 14, TOP_DEAD: 64, SCREEN_UNLOCK: 0.4,

  // ---- gates (9.1) ----
  THREAD_DEG0: 30, THREAD_STEP: -1, DOCK_DEG: 60, DOCK_SEP: 120,
  GATE_CALL: 12,                // beats before the leg's end (L − 12)

  // ---- dock (9.2) ----
  // playtest P0-1 and P1-7: prices to the smaller gaps (1.5, 1.0, 2.0 s), the floor 6 → 4 s
  FREE_REPAIR: 1, REPAIR_S: 0.6, REFUEL_S: 0.4, REFUEL_N: 2, TUNE_S: 0.8, TTC_FLOOR: 4, CLEAN_BONUS: 1, ABANDON_S: 2,

  // ---- landing (8.2) ----
  LAND_S: 3, LAND_PER_NINE: 1, LAND_FUEL_MAX: 3, DOOR_DEG: 60, DOOR_MISS_S: 1.5,

  // ---- years (13) ----
  YEARS_PER_S: 0.25,
  RANKS: [15, 40, 65],          // LIGHTKEEPER, NAVIGATOR, WAYFINDER (years or less), DRIFTER above

  // ---- run (11) ----
  LEG_BEATS: [96, 120, 128, 136, 144, 152, 160, 128],
  RISK_BEATS: 16, RISK_DENSITY: 1.25, VOID_X: 0.6, BELT_X: 0.75,

  // ---- offer (12.2) ----
  RARITY: [                     // % Common, Rare, Epic after legs 1, 2, 3, 4 to 5, 6 to 7
    [75, 25, 0], [68, 30, 2], [60, 33, 7], [52, 36, 12], [45, 38, 17],
  ],
  PITY_STEP: 4, FUSION_FROM: 2, LEGEND_FROM: 4, LEGEND_N: 3,
  OFFER_N: 3, BONUS_N: 4,
  RISK_PICKS: 1,                // pick 1 of 4, Rare or better (critic lead item 2; WP5's offer.riskRule)
  REROLLS0: 1, TEACH_RUNS: 3,

  // ---- rivals (10) ----
  GRID_GAP: 0.25,
  LEG1_GAPS: [0.6, 1.2, 1.8],
  DRIFT_START: [1, 4],          // s ahead, a span
  DRIFT_GAP: [3, 6],            // s of light gap, a span
  RIVAL_FUEL_MIN: 2,
  TICK: 0.05,                   // s (50 ms)
  CANDIDATES: [72, 5],          // 72 bearings 5° apart, then ±5 in 1° steps round the best
  LOOK: 1.3, JITTER_HOLD: 0.3, HOOK_LEAD: 0.3,
  FLEE_IN: 6, FLEE_OUT: 9, CONSERVE_AHEAD: 2.0, GAMBLE_BEHIND: 1.5,
  SLING_CHARGE: 0.9, SLING_GAP: 0.3,
  SLING_CLEAR: [20, 0.6],       // 20° clear for 0.6 s
  BLOCK_REACT: [0.40, 0.30],    // s: Act II, Act III
  BLOCK_RATE: [80, 110],        // °/s: Act II, Act III
  BLOCK_HOLD: 1.2, BLOCK_CD: 4,
  FED_WINDOW: 5, NEM_RAMS: 2, NEM_YOUR_RAMS: 3, NEM_RANGE: 1.0, NEM_RAM_BIAS: 0.4,

  // ---- bosses (10.3) ----
  WHALE: {
    half: 10, wakeHalf: 14, wakeFar: 1.6, tow: 1.12, charge: 0.6, suction: 0.10, sling: 1.5,
    bowWave: [13.5, 25],        // ° off its bearing, a span
    bowRate: 40, breachEta: 0.6, breachEvery: 12, breachFrom: 6, breachTow: 1.3, breachS: 1, turn: 120,
  },
  MAKO: {
    range: 1.5, every: 1.0,     // targets the fewest fuel within 1.5 s, every 1.0 s
    shove: 1.5, rollS: 0.6, rollRate: 20, backOff: 2, startBehind: 0.6,
  },
  MANTA: {
    push: 0.5, range: 8, sailDrag: 0.04, floor: 1.0, shadowDeg: 10, shadowS: 2.0, laneLead: 1.0, laneOff: 15,
    tear: 4, startGap: 2,
  },

  // ---- barks (10.7) ----
  BARK_GAP: 8, BARK_QUIET: 2, BARK_DROP: 1.0, BARK_CHARS: 24, BARK_START: 20,
};

// The spans the table gives as "a to b": [lo, hi]. TUNE holds the same pair. Dotted names reach into an object key.
export const RANGES = deepFreeze({
  HEART_BPM: [60, 140],
  DRIFT_START: [1, 4],
  DRIFT_GAP: [3, 6],
  'WHALE.bowWave': [13.5, 25],
});

export const TUNE = deepFreeze(TABLE);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

// A URL name matches a key case-insensitively and with or without underscores: ?gapcap=6 sets GAP_CAP.
export const norm = (name) => String(name).toLowerCase().replace(/_/g, '');

function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k of Object.keys(o)) out[k] = clone(o[k]);
    return out;
  }
  return o;
}

// Every overridable path: top-level keys, and 'WELLS.medium.reach', 'WHALE.tow' inside objects. Arrays are one path.
function paths(o, pre = '', out = new Map()) {
  for (const k of Object.keys(o)) {
    const v = o[k], p = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) paths(v, p, out);
    else out.set(p.split('.').map(norm).join('.'), p);
  }
  return out;
}
const PATHS = paths(TABLE);
export const KEYS = Object.freeze([...PATHS.values()]);

const num = (s) => {
  const t = String(s).trim();
  if (t === '') return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
};

// The new value for one path from its URL text, or undefined if the text does not fit the key's shape.
// A number sets a number. For an array, one number fills every slot and a comma list of the same length replaces it
// (?gapcap=6 or ?gapcap=8,7,6,5,5,5,4.5,4.5). Rows of arrays (RARITY) take a row per ';'. A span keeps lo ≤ hi.
function parseValue(path, old, text) {
  if (typeof old === 'number') {
    const v = num(text);
    return Number.isNaN(v) ? undefined : v;
  }
  if (Array.isArray(old) && old.length && Array.isArray(old[0])) {
    const rows = String(text).split(';');
    if (rows.length !== old.length) return undefined;
    const out = rows.map((r, i) => parseValue(path, old[i], r));
    return out.some((r) => r === undefined) ? undefined : out;
  }
  if (Array.isArray(old)) {
    const parts = String(text).split(',').map(num);
    if (parts.some(Number.isNaN)) return undefined;
    let out;
    if (parts.length === 1) out = old.map(() => parts[0]);
    else if (parts.length === old.length) out = parts;
    else return undefined;
    if (RANGES[path] && out[0] > out[1]) return undefined;
    return out;
  }
  return undefined;
}

function setPath(o, path, v) {
  const keys = path.split('.');
  let at = o;
  for (let i = 0; i < keys.length - 1; i++) at = at[keys[i]];
  at[keys[keys.length - 1]] = v;
}
function getPath(o, path) {
  return path.split('.').reduce((at, k) => (at == null ? undefined : at[k]), o);
}

// Read a URL query ('?gapcap=6&seed=KOMAZI', a URLSearchParams, or a plain { name: value } object).
// Returns { tune, set, options, ranked, ignored }:
//   tune     the live TUNE (frozen copy) with every override applied;
//   set      { 'GAP_CAP': [6, ...], 'WHALE.tow': 1.2 } for the keys that changed;
//   options  the URL options of 20 that are present, as strings ('1' stays '1'; main.js reads them);
//   ranked   false when any tuning key or any option but seed and daily is present;
//   ignored  names that matched a key but whose value did not parse.
// Names that match nothing are left alone (the page may use them).
export function parseOverrides(search = '', base = TUNE) {
  let pairs;
  if (search && typeof search === 'object' && typeof search[Symbol.iterator] === 'function') pairs = [...search];
  else if (search && typeof search === 'object') pairs = Object.entries(search);
  else pairs = [...new URLSearchParams(String(search || ''))];
  const live = clone(base);
  const set = {}, options = {}, ignored = [];
  const optionNames = new Map(OPTIONS.map((o) => [norm(o), o]));
  let ranked = true;
  for (const [rawName, rawValue] of pairs) {
    const name = String(rawName).split('.').map(norm).join('.');
    const value = rawValue == null ? '' : String(rawValue);
    if (optionNames.has(name)) {
      const o = optionNames.get(name);
      options[o] = value;
      if (!RANKED_OPTIONS.has(o)) ranked = false;
      continue;
    }
    const path = PATHS.get(name);
    if (!path) continue;
    const v = parseValue(path, getPath(live, path), value);
    if (v === undefined) { ignored.push(String(rawName)); continue; }
    setPath(live, path, v);
    set[path] = v;
    ranked = false;
  }
  return { tune: deepFreeze(live), set, options, ranked, ignored };
}
