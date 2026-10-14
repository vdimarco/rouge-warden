// Light Years Home v3: every number the player can feel, in one frozen TUNE, with a [min, max] for each key in RANGES.
// Playtests change them in the URL: ?tune.SHIP.S_TOP=32, ?tune.DRIFT.TIERS.1=1.7, ?tune.DRIFT.TIERS=0.8,1.6,2.4, or
// ?tune.S_TOP=32 when the key name is used only once. Values are clamped to their range.
// Units: u is one ship length, s, u/s, u/s²; angles in degrees unless the comment says rad. Sources: final.md section
// 6 (the handling doc's table), decisions.md 2 (the jump is a free corridor) and 3 (S_CRUISE 24).

const LEAF = Symbol('leaf');

// One key: its default and range. A list key takes lists of the same length for min and max.
const k = (d, min, max) => ({ [LEAF]: true, d, min, max });

const SPEC = {
  // Speed, steering and grip (final.md 6.1).
  SHIP: {
    S_CRUISE: k(24, 16, 28),        // u/s with no input; decisions.md 3 (was 20)
    S_TOP: k(30, 26, 36),           // u/s, gas held
    S_BOOST: k(42, 38, 50),         // u/s, boost held
    S_DB_X: k(1.25, 1.15, 1.35),    // drift-boost target = S_TOP × this (37.5 u/s)
    S_CAP: k(48, 44, 56),           // u/s, nothing goes faster
    K_LOW: k(3.0, 2.5, 4.0),        // per s, approach below cruise
    K_GAS: k(0.75, 0.6, 1.0),       // per s, cruise to top
    K_BOOST: k(2.5, 1.5, 4.0),      // per s, toward boost speed
    KICK_A: k(25, 10, 40),          // u/s², extra push when a boost starts
    KICK_S: k(0.3, 0.1, 0.5),       // s, how long the kick lasts
    K_COAST: k(0.7, 0.4, 1.2),      // per s, easing down above the target speed
    BRAKE_A: k(17, 12, 24),         // u/s², linear
    PIVOT_S: k(4, 2, 6),            // u/s, below this the ship pivots on the spot
    YAW_LO: k(2.6, 2.2, 3.0),       // rad/s at rest; yawMax = lerp(YAW_LO, YAW_HI, s / S_TOP)
    YAW_HI: k(1.4, 1.1, 1.8),       // rad/s at top speed
    YAW_PIVOT: k(2.8, 2.2, 3.4),    // rad/s below PIVOT_S
    GRIP_LO: k(10, 8, 14),          // per s, sideways grip at rest
    GRIP_HI: k(5, 3.5, 7),          // per s, sideways grip at top speed
    GRIP_V: k(10, 6, 14),           // per s, vertical grip, always
    SCRUB: k(0.25, 0.1, 0.5),       // speed lost per s × |sin slip|
    STEER_IN: k(0.08, 0.04, 0.16),  // s, smoothing going in
    STEER_OUT: k(0.04, 0.02, 0.1),  // s, smoothing letting go
    KEY_RAMP: k(0.12, 0.06, 0.24),  // s, keys to full steer
    KEY_DROP: k(0.04, 0.02, 0.1),   // s, keys back to zero
    EXPO: k(1.5, 1.2, 2.0),         // steer = sign(x) · |x|^EXPO for sticks and touch
  },

  // Drift and drift-boost (6.2).
  DRIFT: {
    MIN_S: k(12, 8, 16),            // u/s, manual entry
    MIN_STEER: k(0.35, 0.2, 0.5),   // |steer| for a manual entry
    AUTO_STEER: k(0.85, 0.7, 0.95), // |steer| held for AUTO_T starts an auto-drift (touch default)
    AUTO_T: k(0.15, 0.08, 0.3),     // s
    AUTO_S: k(18, 14, 22),          // u/s
    YAW_X: k(1.5, 1.3, 1.8),        // yawRate = dir · yawMax · YAW_X · (0.45 + 0.55 · (x + 1) / 2), x = steer · dir
    GRIP: k(2.4, 1.6, 3.2),         // per s, sideways grip while drifting
    SCRUB: k(0.10, 0.05, 0.2),      // speed lost per s × |sin slip| while drifting
    CHARGE_BASE: k(0.5, 0.3, 0.7),  // charge per s = (BASE + IN · clamp(x, 0, 1)) · clamp(slip / SLIP, FLOOR, 1)
    CHARGE_IN: k(0.5, 0.3, 0.7),
    CHARGE_SLIP: k(20, 10, 30),     // deg
    CHARGE_FLOOR: k(0.4, 0.2, 0.6),
    TIERS: k([0.8, 1.6, 2.4], [0.5, 1.3, 2.1], [1.1, 1.9, 2.7]), // charge marks for tiers 1, 2, 3
    DB_DUR: k([0.6, 1.2, 2.0], [0.3, 0.8, 1.4], [1.0, 1.8, 3.0]), // s of drift-boost per tier
    DB_KICK: k(8, 4, 12),           // u/s added at release
    SNAP: k(20, 10, 30),            // per s, grip just after a release
    SNAP_S: k(0.15, 0.08, 0.3),     // s
    TIER_BAR: k([0.08, 0.15, 0.25], [0.04, 0.1, 0.15], [0.12, 0.2, 0.35]), // bar refill per tier
    EXIT_STEER: k(0.3, 0.15, 0.45), // steer under this for EXIT_T cashes out
    EXIT_T: k(0.12, 0.06, 0.25),    // s
    COUNTER: k(0.7, 0.5, 0.9),      // counter-steer past −COUNTER for COUNTER_T cashes out
    COUNTER_T: k(0.2, 0.1, 0.4),    // s
    HOP: k(0.15, 0, 0.3),           // u, show only
    HOP_T: k(0.12, 0.06, 0.2),      // s
    PERFECT_SLING: k(8, 4, 12),     // deg, release toward a marked exit for +1 tier
  },

  // The boost bar (6.3). Fills are bar fractions; a full bar is 1.
  BAR: {
    START: k(0.5, 0, 1),
    DRAIN: k(0.33, 0.25, 0.5),      // per s while boosting (3 s from full)
    MIN: k(0.05, 0.02, 0.1),        // boost needs at least this
    MIN_BURST: k(0.35, 0.2, 0.6),   // s, shortest boost
    FLICK_BURST: k(1.0, 0.6, 1.5),  // s, a flick up on the stick
    NEAR: k(0.06, 0.03, 0.1),
    HAIRLINE: k(0.12, 0.06, 0.2),
    THREAD: k(0.10, 0.05, 0.2),
    SKIM: k(0.10, 0.05, 0.2),       // per s
    DRAFT: k(0.08, 0.04, 0.15),     // per s
    SLING: k(0.15, 0.08, 0.25),
    SCAN: k(0.05, 0.02, 0.1),
    TAKEDOWN: k(0.25, 0.15, 0.4),
    SPARK: k(0.04, 0.02, 0.08),
    PAD: k(0.03, 0.01, 0.06),
    PAD_PERFECT: k(0.06, 0.03, 0.1),
    BULLSEYE: k(0.03, 0.01, 0.06),
    CRASH: k(-0.25, -0.5, 0),       // a head-on loses one segment
    SEGMENTS: k(4, 2, 8),           // shown as this many segments
  },

  // Near misses, threads, skims, drafts and the chain (6.4).
  PROX: {
    TRACK: k(12, 8, 16),            // u, colliders tracked
    NEAR: k(2.0, 1.5, 3.0),         // u, smallest gap on a pass
    HAIRLINE: k(0.6, 0.4, 0.9),     // u
    NEAR_REL: k(10, 6, 14),         // u/s, relative speed needed
    COOL: k(1.0, 0.5, 2.0),         // s, per collider
    THREAD: k(3.0, 2.0, 4.0),       // u, each side
    THREAD_T: k(0.3, 0.15, 0.5),    // s, both sides inside this
    SKIM: k(3.0, 2.0, 4.0),         // u, surface gap
    SKIM_MIN: k(0.4, 0.2, 0.8),     // s held before it counts
    SKIM_OFF: k(3.5, 2.5, 4.5),     // u, it ends past this
    DRAFT: k(12, 8, 16),            // u behind
    DRAFT_CONE: k(15, 10, 25),      // deg
    DRAFT_MIN_R: k(1.5, 1, 3),      // u, body radius
    DRAFT_TOP: k(0.05, 0.02, 0.1),  // +5% top speed
    CHAIN_GAP: k(3, 2, 5),          // s with no event banks the chain
    CHAIN_STEPS: k([3, 6, 10, 15], [2, 4, 7, 11], [4, 8, 13, 20]), // chain length for each multiplier step
    CHAIN_MULT: k([2, 3, 4, 5], [2, 3, 4, 5], [2, 3, 4, 5]),
  },

  // Plane, pitch, bank and the floor (6.5).
  PLANE: {
    PITCH_RATE: k(1.4, 1.0, 2.0),   // rad/s
    PITCH_MAX: k(35, 25, 45),       // deg from the plane
    PITCH_RET: k(0.4, 0.2, 0.8),    // s, the nose levels when you let go
    BAND_FALL: k(1.5, 1.2, 2.0),    // climb authority is 0 at this × the zone's band H
    BAND_NUDGE: k(12, 6, 20),       // deg per s back toward the plane past H
    U_TURN_MAX: k(0.8, 0.4, 1.5),   // rad/s, the plane's up never turns faster
    BANK_DRIVE: k(32, 20, 45),      // deg, show only
    BANK_DRIFT: k(48, 35, 60),      // deg, plus slip × BANK_SLIP
    BANK_SLIP: k(0.333, 0, 0.5),
    BANK_TC: k(0.15, 0.08, 0.3),    // s
    FLOOR_MIN_R: k(8, 5, 12),       // u, bodies this big get a floor
    FLOOR_SHELL: k(2.5, 1.5, 3.5),  // u above the surface (Cruise)
    FLOOR_SHELL_PILOT: k(1.0, 0.5, 1.5),
    FLOOR_ANGLE: k(30, 20, 40),     // deg, shallower meetings get pushed up
    FLOOR_DAMP: k(6, 3, 10),        // per s
    FLOOR_NUDGE: k(8, 4, 14),       // deg per s
    HA_RANGE: k(150, 80, 250),      // u, Cruise height assist toward an objective or gate
    HA_CONE: k(35, 20, 50),         // deg
    HA_RATE: k(6, 3, 10),           // u/s
    HA_OFF: k(2, 1, 4),             // s off after any climb input
  },

  // Collisions (6.6).
  COLLIDE: {
    CAPSULE_R: k(0.32, 0.25, 0.45), // u
    CAPSULE_HALF: k(0.30, 0.2, 0.4),// u
    CORE_X: k(0.5, 0.4, 0.7),       // a traffic galaxy's collider = this × drawn radius
    SCRAPE_DEG: k(35, 25, 45),      // under: scrape; over: head-on
    SCRAPE_KEEP: k(0.9, 0.85, 0.95),
    SCRAPE_TURN: k(0.4, 0.2, 0.6),  // nose turns this far toward the tangent
    SCRAPE_PUSH: k(0.05, 0.02, 0.1),// u
    HEAD_KEEP: k(0.4, 0.3, 0.5),
    HEAD_FLOOR: k(6, 4, 8),         // u/s, never slower after a head-on
    HEAD_BEND: k(0.5, 0.3, 0.7),    // the rebound bends this far toward the tangent
    HEAD_STEER: k(0.5, 0.3, 0.8),   // steering authority after a head-on
    HEAD_STEER_T: k(0.4, 0.2, 0.6), // s
    FLICKER: k(0.6, 0.4, 1.0),      // s, no second head-on
    HITSTOP: k(0.05, 0, 0.1),       // s
    BIG_S: k(32, 28, 40),           // u/s, a head-on this fast is a big crash
    BIG_SLOW: k(0.5, 0.3, 0.8),     // s of slow motion
    BIG_X: k(0.3, 0.2, 0.5),        // time scale during it
    AFTERTOUCH: k(40, 20, 60),      // deg, steering bends the rebound
    TAKEDOWN_REL: k(8, 5, 12),      // u/s of sideways closing speed
    TAKEDOWN_SPIN: k(1.2, 0.8, 2.0),// s the target spins
    TAKEDOWN_SPIN_X: k(0.4, 0.2, 0.6), // its speed while spinning
    TAKEDOWN_KEEP: k(0.95, 0.85, 1),
    CONTACT_HARD: k(6, 4, 8),       // u/s, a cargo contact
  },

  // Gravity wells (6.7). Per-body overrides live in the zone data.
  WELL: {
    GAIN: k(0.6, 0.4, 0.9),         // a = g_s · (rs / r)², g_s = GAIN · REF_S² / rs
    REF_S: k(30, 24, 40),           // u/s (S_TOP)
    CUT: k(3, 2, 4),                // × rs, no pull past this
    CHARGE_X: k(1.5, 1, 2),         // drift charge × this inside the sling ring
  },

  // Tow (6.7).
  TOW: {
    LEN: k(6, 4, 10),               // u, rest length
    K: k(10, 6, 16),                // per s²
    DAMP: k(4, 2, 8),               // per s
    LIMIT_X: k(3, 2, 4),            // hard limit at this × LEN; never snaps
    LOAD_GRIP: k(1.5, 0.8, 3),      // per s, the load swings wide
    TOP_X: k(0.85, 0.7, 1),
    ACC_X: k(0.8, 0.6, 1),
    GRIP_X: k(0.8, 0.6, 1),
    HOOK_R: k(3, 2, 5),             // u, the tow ring behind a load [K]
    HOOK_T: k(0.5, 0.2, 1),         // s inside the tow ring
    LETGO_HOLD: k(1.0, 0.5, 2),     // s of action hold
  },

  // Zone edges (6.7).
  EDGE: {
    YAW: k(1.2, 0.8, 1.6),          // rad/s, turn = YAW · smoothstep(R, R + BAND, r)
    BAND: k(60, 40, 100),           // u
    LINE_GAP: k(20, 10, 40),        // s between TURNING BACK lines
  },

  // The chase camera (6.8). Each layout kind from core/layout.js has its own block.
  CAM: {
    SPRING: k(0.15, 0.10, 0.22),    // s, critically damped, cruise
    SPRING_BOOST: k(0.20, 0.12, 0.28),
    BOOST_DIST_X: k(1.3, 1.15, 1.4),
    LOOK_AHEAD: k(0.3, 0.1, 0.5),   // s of velocity
    LOOK_MAX: k(12, 6, 20),         // u
    HEADING_VEL: k(0.7, 0.5, 0.9),  // heading = this × velocity + the rest × nose
    HEADING_VEL_DRIFT: k(0.85, 0.7, 0.95),
    ROT_TC: k(0.12, 0.06, 0.25),    // s
    YAW_MAX: k(3.0, 2.0, 4.0),      // rad/s
    FOV_RATE: k(60, 30, 120),       // deg per s
    KICK_IN: k(0.15, 0.08, 0.3),    // s
    KICK_OUT: k(0.6, 0.3, 1.0),     // s
    DB_KICK: k([4, 6, 9], [2, 3, 5], [6, 9, 13]), // deg of FOV per drift-boost tier
    PITCH_FOLLOW: k(0.5, 0, 1),
    INTEREST_CONE: k(35, 20, 50),   // deg
    INTEREST_RANGE: k(300, 150, 450), // u
    INTEREST_LEAN: k(0.15, 0, 0.3),
    DRIFT_LOOK_T: k(0.3, 0.1, 0.6), // s to ease in the drift look
    OBSTACLE_IN: k(0.6, 0.4, 0.8),  // the camera moves in to this × its distance past a body
    LOOK_BACK_T: k(0.2, 0.1, 0.4),  // s
    portrait: {                     // FOV set on the vertical
      FOV: k(90, 80, 96),
      FOV_TOP: k(6, 0, 10),
      FOV_KICK: k(10, 6, 16),
      FOV_MAX: k(100, 94, 108),
      DIST: k(8.2, 7, 9.5),         // u behind
      HEIGHT: k(2.9, 2, 4),         // u above
      SHIP_Y: k(0.60, 0.5, 0.7),    // ship's place on screen from the top
      DRIFT_LOOK_IN: k(14, 0, 20),  // deg toward the inside of a drift
    },
    landscape: {                    // FOV set on the horizontal
      FOV: k(86, 76, 94),
      FOV_TOP: k(8, 0, 12),
      FOV_KICK: k(12, 6, 16),
      FOV_MAX: k(104, 96, 110),
      DIST: k(6.0, 5, 7.5),
      HEIGHT: k(1.6, 1, 2.5),
      SHIP_Y: k(0.66, 0.55, 0.75),
      DRIFT_LOOK_IN: k(6, 0, 20),
    },
    desktop: {                      // FOV set on the horizontal
      FOV: k(82, 72, 90),
      FOV_TOP: k(8, 0, 12),
      FOV_KICK: k(12, 6, 16),
      FOV_MAX: k(100, 92, 108),
      DIST: k(6.0, 5, 7.5),
      HEIGHT: k(1.6, 1, 2.5),
      SHIP_Y: k(0.66, 0.55, 0.75),
      DRIFT_LOOK_IN: k(6, 0, 20),
    },
  },

  // Speed dust, shake and the boost sky hint (6.8).
  FX: {
    DUST: k(240, 140, 360),         // motes on the mid tier
    DUST_HIGH: k(360, 240, 480),
    DUST_LOW: k(140, 80, 240),
    DUST_BOX: k(64, 40, 96),        // u
    DUST_PLANE: k(0.7, 0.4, 0.9),   // share of motes near the plane
    DUST_PLANE_H: k(5, 2, 10),      // u
    DUST_STREAK: k(45, 30, 70),     // ms of speed per streak
    DUST_STREAK_MAX: k(2.4, 1.2, 4),// u
    SHAKE_MAX: k(4, 2, 6),          // deg; shake = trauma²
    SHAKE_MAX_U: k(0.3, 0.1, 0.5),  // u
    SHAKE_DECAY: k(1, 0.5, 2),      // trauma per s
    TRAUMA: {                       // trauma added by each event type
      near: k(0.12, 0, 0.3),
      hairline: k(0.20, 0, 0.4),
      driftBoost: k([0.10, 0.15, 0.20], [0, 0, 0], [0.3, 0.3, 0.4]), // per tier
      boostStart: k(0.15, 0, 0.3),
      scrape: k(0.30, 0.1, 0.5),
      crash: k(0.60, 0.3, 0.8),
      bigCrash: k(0.85, 0.5, 1),
      punch: k(0.50, 0.2, 0.8),
    },
    BOOST_PHI: k(0.12, 0, 0.25),    // sky rapidity hint × boost fraction in zones
    SLIP_SHOW: k(10, 5, 20),        // deg, slip shows on the hull and trails from here
    REDUCED_KICK: k(4, 0, 6),       // deg, most FOV kick under reduced motion
    REDUCED_FLASH: k(0.3, 0, 0.5),  // most flash alpha under reduced motion
  },

  // The jump (6.9), as a free corridor (decisions.md 2): a tube of light steered on two axes with the zone's stick.
  // The corridor keys are first guesses for WP5, sized so a graze matches lab A's 9° band on a 10 u ring.
  JUMP: {
    LEN_A: k(9.5, 7, 12),           // L = round(clamp(LEN_A + LEN_B · log10(ly), LEN_MIN, LEN_MAX)) s
    LEN_B: k(2, 1, 3),
    LEN_MIN: k(16, 14, 20),
    LEN_MAX: k(28, 24, 32),
    SOFT_S: k(6, 3, 10),            // s of soft start (J1)
    SOFT_RATE: k(0.6, 0.3, 1),      // hazards per s in the soft start
    RUNUP_RINGS: k([60, 140, 240], [40, 100, 180], [90, 200, 320]), // u ahead
    RUNUP_BEND: k(40, 20, 60),      // deg per ring toward the target
    RING_R: k(3.5, 2.5, 5),         // u, launch ring radius
    RUNUP_REFORM: k(80, 50, 120),   // u ahead after a miss
    RUNUP_CANCEL: k(1, 0.5, 2),     // s of brake calls it off
    PUNCH_STOP: k(0.12, 0.05, 0.2), // s of hit-stop
    PUNCH_LOCK: k(0.4, 0.2, 0.6),   // s with input locked
    PUNCH_T: k(1.5, 1, 2),          // s, punch to the run
    PUNCH_FLASH: k(0.8, 0.3, 1),    // alpha
    PUNCH_FLASH_T: k(0.2, 0.1, 0.4),// s held
    PUNCH_FOV: k(18, 8, 24),        // deg for 0.2 s
    PUNCH_SKY_T: k(1.4, 0.8, 2),    // s, sky rapidity 0 to entry
    PUNCH_CAM_T: k(1.2, 0.6, 2),    // s, chase framing to corridor framing
    RUSH_T: k(1.1, 0.6, 1.6),       // s of inward rush lines
    RADIO_FLOOR: k(0.125, 0.05, 0.25), // lowest radio playback rate
    ETA_ENTRY: k(2.0, 1.8, 2.3),    // rapidity
    ETA_FLOOR: k(1.8, 1.6, 2.0),
    ETA_CAP: k(4.0, 3.8, 4.5),
    DRIFT_BACK: k(0.04, 0.02, 0.05),// per s above entry (WP5: 0.04 so a long run needs grazes to hold)
    GAIN_X: k(1.65, 1, 2),          // every gain below × this (WP5's bots: 1.65)
    GAIN_REF: k(11, 6, 30),         // s of run that earns the full gains; longer runs × (GAIN_REF / run)^GAIN_POW
    GAIN_POW: k(1, 0.3, 1.2),
    PIECE_S: k(2.5, 0, 6),          // s of run a cluster ring set piece counts as, for that scale
    LOW_X: k(2, 1, 2.5),            // grazes count × this below 0.99c
    G_GRAZE: k(0.06, 0.03, 0.12),
    G_HAIRLINE: k(0.12, 0.06, 0.2),
    G_THREAD: k(0.25, 0.1, 0.4),
    G_PAD: k(0.15, 0.08, 0.25),
    G_SKIM: k(0.04, 0.02, 0.08),    // per s
    G_BOOST: k(0.25, 0.1, 0.4),     // per s
    G_DB: k([0.15, 0.25, 0.40], [0.08, 0.15, 0.25], [0.25, 0.4, 0.6]), // per drift-boost tier
    HIT: k(-0.35, -0.6, -0.15),
    HIT_FLICKER: k(0.6, 0.3, 1),    // s
    TUBE_R: k(10, 6, 16),           // u, corridor radius
    LAT_RATE: k(30, 18, 45),        // u/s across the corridor at full stick (rate steering)
    LAT_IN: k(12, 8, 16),           // per s, toward the target rate
    LAT_OUT: k(25, 18, 35),         // per s, back to still
    SLIDE_X: k(1.4, 1.1, 1.8),      // lateral rate × this while sliding (the drift here)
    SLIDE_GRIP: k(3, 1.5, 6),       // per s, both ways while sliding
    GRAZE: k(1.6, 1.0, 2.4),        // u from a hazard's edge
    GRAZE_SOFT: k(2.3, 1.5, 3.2),   // u in the soft start
    HAIRLINE: k(0.6, 0.35, 0.9),    // u
    HAZ_RATE: k(1.2, 0.8, 2),       // hazards per s after the soft start
    HAZ_RATE_MAX: k(2.5, 1.5, 3.5), // rising to this
    FORK_AT: k(0.55, 0.4, 0.7),     // share of the run
    SKY_CAP: k(3.0, 2.5, 3.5),      // sky rapidity in the run
    SKY_PUNCH: k(4.0, 3.5, 4.5),    // at THREE NINES
    VISTA_PHI: k(5.0, 4, 6),
    HEADLIGHT_SLOW: k(0.35, 0.2, 0.6), // time scale at THREE NINES
    HEADLIGHT_T: k(0.4, 0.2, 0.8),  // s
    VISTA_SLOW: k(0.4, 0.2, 0.6),
    VISTA_T: k(1.0, 0.5, 1.5),      // s
    VISTA_AT: k(4, 3, 6),           // s before the end
    DROP_AT: k(3, 2, 4),            // s before the end
    DROP_S: k(2.2, 1.5, 3),         // s, ease-out cubic
    LONG_HAUL: k(5, 3, 8),          // s per stretch when the next zone is late
    LONG_HAUL_MAX: k(3, 1, 5),
    TERN_HOLD: k(4, 2, 6),          // s at 0.999c with no hits for the Tern medal
    SILVER_HITS: k(2, 0, 4),        // most hits for silver
    MEDAL_BAR: k([0.5, 0.75, 1, 1], [0.25, 0.5, 0.75, 0.75], [0.75, 1, 1, 1]), // arrival bar: bronze, silver, gold, Tern
    CARD_GAP: k(3, 2, 5),           // s between On Earth cards
    DOT_LINES: k(3, 1, 5),          // most Dot lines per jump
    // The corridor (WP5): sizes in u, times in s.
    SOFT_L: k(18, 14, 24),          // s, the soft first jump's length
    RUNUP_PASS: k(1.4, 1, 2),       // a launch ring counts within this × RING_R
    RUNUP_WAIT: k(110, 90, 150),    // deg: a target further off than this holds the first ring back
    ARRIVE_S: k(42, 30, 48),        // u/s at the drop-out
    SHIP_R: k(0.6, 0.4, 0.9),       // the ship's hit radius in the corridor
    RUN_S: k(60, 40, 90),           // u/s down the corridor at entry rapidity
    RUN_K: k(0.25, 0, 0.5),         // forward speed × (1 + RUN_K · (η − entry))
    LEAD: k(2.6, 1.8, 3.5),         // s from a hazard's first sight to its pass
    AIM: k(0.55, 0.2, 0.9),         // share of knots put on your line
    AIM_SD: k(1.2, 0.5, 3),         // u of spread round your line
    KNOT_MIN: k(1.0, 0.6, 1.4),     // knot radius
    KNOT_MAX: k(1.8, 1.2, 2.4),
    HOLE_R: k(2.8, 2.2, 3.6),       // a wall's gap
    GATE_RING: k(2.9, 2.2, 3.6),    // a cluster ring's radius
    GATE_KNOT: k(0.5, 0.3, 0.8),    // its galaxies' radius
    PAD_R: k(1.4, 1, 2),
    PAD_BAR: k(0.1, 0, 0.2),        // bar a light pad gives
    RAIL_R: k(0.35, 0.2, 0.6),
    RAIL_T: k(2.4, 1.5, 3.5),       // s of rail
    THREAD_GAP: k(2.2, 1.5, 3),     // u each side, two knots within THREAD_T
    THREAD_T: k(0.3, 0.15, 0.5),
    HIT_STOP: k(0.06, 0, 0.12),     // s
    HIT_PUSH: k(9, 4, 14),          // u/s away from what you hit
    CHAIN_GAP: k(3, 2, 5),          // s with no graze ends the chain
    DANGER_T: k(0.9, 0.5, 1.5),     // s ahead the proximity whine looks
    SKY_PUNCH_T: k(1.0, 0.5, 2),    // s the THREE NINES sky punch takes to ease back
    VISTA_RISE: k(0.3, 0.1, 0.6),   // s to the vista's sky rapidity
    FORK_SPAN: k(0.25, 0.15, 0.35), // share of L the fork's branch lasts
    CALM_X: k(0.5, 0.2, 1),         // knot rate on the calm branch
    DENSE_X: k(1.5, 1.2, 2),        // knot rate and score on the dense branch
    PTS_GRAZE: k(10, 5, 20),        // × γ × the chain
    PTS_THREAD: k(250, 100, 400),   // × γ
    PTS_PAD: k(50, 20, 100),        // × γ
    PTS_SKIM: k(30, 10, 60),        // × γ per s
    HAIR_X: k(3, 2, 4),
    HEADLIGHT_X: k(2, 1, 3),        // score while at 0.999c
  },

  // Events: starts, gates, medals and restarts (6.10).
  RACE: {
    GATE_R: {                       // u
      wide: k(7, 5, 9),
      standard: k(4.5, 3.5, 6),
      needle: k(2.5, 1.8, 3.5),
    },
    START_R: k(4.5, 3.5, 6),        // u, start rings are 9 u across
    START_CONE: k(60, 40, 80),      // deg, crossing within this starts the clock
    BULLSEYE: k(1.0, 0.5, 1.5),     // u from the centre
    CLIP: k(2.0, 1, 3),             // u outside the ring
    MISS_PEN: k(3.0, 1, 5),         // s
    START_S: k(30, 24, 36),         // u/s at the start
    START_BAR: k(0.5, 0.25, 1),
    START_FLASH: k(0.2, 0.1, 0.4),  // s
    SEEN: k(400, 250, 600),         // u
    ARM: k(150, 100, 250),          // u
    ARM_CONE: k(60, 40, 90),        // deg
    TICKS: k(60, 40, 100),          // u, three ticks from here
    RESTART_HOLD: k(0.35, 0.2, 0.6),// s
    CONTROL_BACK: k(0.6, 0.3, 1),   // s from the press
    CLOCK_START: k(1.6, 1, 2.5),    // s from the press
    CANCEL_X: k(2, 1.5, 3),         // first gate not reached in this × its Tern time
    CANCEL_MIN: k(6, 4, 10),        // s
    CANCEL_TURN: k(100, 80, 140),   // deg away
    CANCEL_TURN_T: k(1.5, 1, 3),    // s
    OFF_COURSE: k(120, 80, 200),    // u from the line
    OFF_CHEVRON: k(3, 2, 5),        // s
    OFF_BACK: k(6, 4, 10),          // s, then back to the last gate
    GOLD_X: k(1.07, 1.03, 1.12),
    SILVER_X: k(1.20, 1.1, 1.3),
    BRONZE_X: k(1.50, 1.3, 1.8),
    BRONZE_FLOOR_X: k(1.05, 1, 1.2),// bronze at least the beginner bot's worst × this
    ROUND_SHORT: k(0.1, 0.1, 0.5),  // s, medal times under ROUND_AT
    ROUND_LONG: k(0.5, 0.1, 1),
    ROUND_AT: k(20, 10, 30),        // s
    PAD_KICK: k(6, 3, 10),          // u/s, plus the boost target for PAD_T, no bar cost
    PAD_T: k(0.6, 0.3, 1),          // s
    PAD_PERFECT_R: k(0.8, 0.4, 1.2),// u
    PAD_PERFECT_KICK: k(2, 0, 4),   // u/s more
    LINE_WINDOW: k(1.5, 1, 3),      // s between pads
    SPLIT_SHOW: k(1.4, 0.8, 2.5),   // s
    GHOST_HZ: k(20, 10, 30),
    LINK_HZ: k(10, 5, 20),
    RIVAL_SLOW: k(0.96, 0.9, 1),    // Cruise: her pace when leading by RIVAL_LEAD
    RIVAL_FAST: k(1.04, 1, 1.1),    // when trailing by RIVAL_TRAIL
    RIVAL_LEAD: k(60, 30, 100),     // u
    RIVAL_TRAIL: k(40, 20, 80),     // u
    RIVAL_CAP: k(1.02, 1, 1.05),    // never faster than Tern × this
    RIVAL_OFF: k(0.15, 0.05, 0.3),  // band off for the last share of the race
    EASIER_AFTER: k(3, 2, 6),       // tries with no medal
    GATE_GAP: k(0.6, 0.4, 1),       // s between gates at Tern pace
    RIM_CLEAR: k(55, 30, 80),       // u, no gate this near the rim
    RETRY_SHOW: k(6, 3, 10),        // s, a stunt's RETRY stays on the chip
    STUNT_RUNUP_TRAP: k(250, 150, 350), // u before a trap
    STUNT_RUNUP: k(60, 30, 100),    // u before a drift zone, thread or skim
  },

  // Missions (6.10).
  MISSION: {
    RETRY: k(1.2, 0.6, 2),          // s after a fail
    SKIP_AFTER: k(3, 2, 5),         // fails at one checkpoint
    LIMIT_X: k(2.0, 1.5, 3),        // × the author time
    TAKE_JOB: k(6, 4, 10),          // s the TAKE JOB chip stays
    CHOICE: k(15, 8, 25),           // s
    CHECKPOINT_MAX: k(60, 30, 90),  // s, a retry goes back at most this far
  },

  // The radio queue (6.10).
  TALK: {
    GAP: k(8, 5, 12),               // s between lines while driving
    QUIET: k(2, 1, 3),              // s round a gate, hit or takedown
    DROP: k(6, 3, 10),              // s a line may wait
    REDSHIFT_GAP: k(40, 20, 60),    // s
    ARRIVE_WAIT: k(2.5, 1, 4),      // s after an arrival
  },

  // Zones: scans, Look Home, sparks, cards, the zoom and the radar (6.10, 13.6).
  ZONE: {
    SCAN_CONE: k(25, 15, 35),       // deg
    SCAN_T: k(0.8, 0.4, 1.5),       // s
    SCAN_RANGE: k(30, 20, 50),      // u, plus SCAN_RANGE_X × the target's radius
    SCAN_RANGE_X: k(3, 2, 5),
    FAR_CONE: k(6, 3, 10),          // deg
    FAR_CONE_CRUISE: k(10, 6, 15),  // deg
    FAR_T: k(3.0, 1.5, 4),          // s
    AUTO_SCAN: k(12, 6, 20),        // u, Cruise scans what you pass this close (plus 3 × radius)
    LOOK_HOME: k(10, 5, 15),        // deg
    LOOK_HOME_T: k(1.0, 0.5, 2),    // s
    SPARK_R: k(2.5, 1.5, 4),        // u
    SCALE_CARD: k(4, 2, 6),         // s
    SCALE_CARD_DELAY: k(1, 0.5, 2), // s after the drop-out
    NUMBER_SHOW: k(3, 2, 5),        // s a scan's number stays in the info box
    ARRIVE_CLEAR: k(1, 0.5, 2),     // s nothing covers the view on arrival
    ZOOM: k(1.5, 1, 2.5),           // s
    ZOOM_REDUCED: k(0.2, 0.1, 0.5), // s
    RADAR: k(300, 200, 400),        // u, radar range at cruise
    RADAR_BOOST: k(420, 300, 600),
    RADAR_NEAR: k(200, 120, 300),   // near an objective or in a pocket
  },

  // Touch, mouse, pad and tilt shaping (13.2, 13.3). ui/input.js reads these.
  INPUT: {
    STICK_DEAD: k(6, 2, 12),        // px
    STICK_FULL: k(56, 40, 80),      // px, also the stick's drawn radius
    CLIMB_X: k(0.8, 0.5, 1),        // stick Y scale
    CLIMB_DEAD: k(24, 10, 40),      // px
    CLIMB_FULL: k(96, 60, 140),     // px
    FLICK_PX: k(48, 32, 72),        // px up
    FLICK_MS: k(150, 100, 250),     // ms
    FLICK_SPEED: k(700, 400, 1000), // px/s
    PITCH_DELAY: k(120, 60, 200),   // ms pitch waits while a flick is possible
    TAP_MS: k(250, 150, 350),
    TAP_PX: k(10, 6, 16),
    PAD_DEAD: k(0.12, 0.05, 0.25),  // radial
    MOUSE_DEAD: k(0.03, 0, 0.08),   // share of the width
    MOUSE_FULL: k(0.25, 0.15, 0.4),
    TILT_FULL: k(25, 15, 40),       // deg of roll
    TILT_DEAD: k(2, 0, 5),          // deg
    PLAY_LIVE: k(0.3, 0.1, 0.6),    // s after PLAY before input counts
  },
};

function build(spec) {
  const tune = {}, ranges = {};
  for (const [key, v] of Object.entries(spec)) {
    if (v && v[LEAF]) {
      const list = Array.isArray(v.d);
      tune[key] = list ? v.d.slice() : v.d;
      ranges[key] = list ? v.d.map((_, i) => [v.min[i], v.max[i]]) : [v.min, v.max];
    } else {
      [tune[key], ranges[key]] = build(v);
    }
  }
  return [tune, ranges];
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

function clone(o) {
  if (Array.isArray(o)) return o.map(clone);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(o)) out[key] = clone(v);
    return out;
  }
  return o;
}

const built = build(SPEC);
export const TUNE = deepFreeze(built[0]);
export const RANGES = deepFreeze(built[1]);
export const GROUPS = Object.freeze(Object.keys(TUNE));

const isRange = (r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'number';
const isRangeList = (r) => Array.isArray(r) && r.length > 0 && isRange(r[0]);
const clampTo = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));

// Every leaf path in RANGES, as 'GROUP.KEY' or 'CAM.portrait.FOV'.
export function tunePaths(ranges = RANGES, prefix = '') {
  const out = [];
  for (const [key, r] of Object.entries(ranges)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRange(r) || isRangeList(r)) out.push(path);
    else out.push(...tunePaths(r, path));
  }
  return out;
}

// A bare key such as 'S_TOP' names the one path that ends with it, or nothing when it is missing or used twice.
function resolvePath(parts) {
  if (parts.length > 0 && parts[0] in RANGES) return parts;
  if (parts.length !== 1) return null;
  const hits = tunePaths().filter((p) => p.endsWith(`.${parts[0]}`));
  return hits.length === 1 ? hits[0].split('.') : null;
}

// Pairs of [path, text] from a search string ('?tune.SHIP.S_TOP=32&bot=idle'), URLSearchParams, a Map or a plain
// object. From a string or URLSearchParams only 'tune.' keys count; a plain object may leave the prefix off.
function entriesOf(search) {
  if (search == null) return [];
  if (typeof search === 'string') {
    const out = [];
    for (const part of search.replace(/^[?#]/, '').split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };
      const key = dec(eq < 0 ? part : part.slice(0, eq));
      if (key.startsWith('tune.')) out.push([key.slice(5), dec(eq < 0 ? '' : part.slice(eq + 1))]);
    }
    return out;
  }
  const plain = Object.getPrototypeOf(search) === Object.prototype || Object.getPrototypeOf(search) === null;
  if (typeof search.entries === 'function' && !Array.isArray(search) && !plain) {
    return [...search.entries()].filter(([key]) => String(key).startsWith('tune.'))
      .map(([key, v]) => [String(key).slice(5), String(v)]);
  }
  if (typeof search === 'object') {
    return Object.entries(search).map(([key, v]) => [key.startsWith('tune.') ? key.slice(5) : key, v]);
  }
  return [];
}

const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

// A new frozen TUNE with the overrides in `search` applied and clamped. `report`, if given, collects one entry per
// override: { path, value, clamped } when applied, or { path, ignored: reason } when not.
export function withOverrides(base = TUNE, search = null, report = null) {
  const pairs = entriesOf(search);
  if (pairs.length === 0) return base;
  const out = clone(base);
  for (const [rawPath, raw] of pairs) {
    const parts = resolvePath(String(rawPath).split('.').filter(Boolean));
    if (!parts) { report?.push({ path: rawPath, ignored: 'unknown key' }); continue; }
    let r = RANGES, t = out, i = 0;
    for (; i < parts.length - 1; i++) {
      if (isRangeList(r[parts[i]])) break;
      if (!r[parts[i]] || isRange(r[parts[i]])) { r = null; break; }
      r = r[parts[i]];
      t = t[parts[i]];
    }
    const key = parts[i];
    const range = r?.[key];
    const rest = parts.slice(i + 1);
    const path = parts.join('.');
    if (!(isRange(range) || isRangeList(range)) || (rest.length > 0 && !isRangeList(range)) || rest.length > 1) {
      report?.push({ path: rawPath, ignored: 'unknown key' });
      continue;
    }
    if (isRange(range)) {
      const x = num(raw);
      if (!Number.isFinite(x)) { report?.push({ path, ignored: 'not a number' }); continue; }
      t[key] = clampTo(x, range);
      report?.push({ path, value: t[key], clamped: t[key] !== x });
    } else if (rest.length === 1) {
      const j = Number(rest[0]);
      const x = num(raw);
      if (!Number.isInteger(j) || j < 0 || j >= range.length) { report?.push({ path, ignored: 'bad index' }); continue; }
      if (!Number.isFinite(x)) { report?.push({ path, ignored: 'not a number' }); continue; }
      t[key][j] = clampTo(x, range[j]);
      report?.push({ path, value: t[key][j], clamped: t[key][j] !== x });
    } else {
      const xs = Array.isArray(raw) ? raw.map(num) : String(raw).split(',').map(num);
      if (xs.length !== range.length || !xs.every(Number.isFinite)) {
        report?.push({ path, ignored: `needs ${range.length} numbers` });
        continue;
      }
      t[key] = xs.map((x, j) => clampTo(x, range[j]));
      report?.push({ path, value: t[key].slice(), clamped: t[key].some((x, j) => x !== xs[j]) });
    }
  }
  return deepFreeze(out);
}

// Read one value by path ('SHIP.S_TOP', 'DRIFT.TIERS.1'); undefined when the path is unknown.
export function tuneAt(tune, path) {
  let v = tune;
  for (const part of String(path).split('.')) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[part];
  }
  return v;
}
