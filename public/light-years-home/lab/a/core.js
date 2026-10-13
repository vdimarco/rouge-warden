// Light Years Ahead (lab A): the pure core. Tuning, the state, one fixed step of play, the tube geometry (Penrose's
// stereographic aberration: everything beside the ship lands on one ring of radius f / sinh φ), the pass checks,
// speed, score, the burst's lead, and the bots that play it. No DOM, no three, no clocks: the same seed and inputs
// always replay the same run.
import { mulberry32, hashSeed } from '../../core/rng.js';
import { buildStage, STAGE_BEATS, INTRO_SKIP } from './stage1.js';

export { STAGE_BEATS, INTRO_SKIP };
export const DEG = Math.PI / 180;

// Starting values from the design (final-v2 3.9). main.js applies URL overrides on a copy.
export const TUNE = Object.freeze({
  // screen
  F: 0.494, RING_FLOOR: 0.30, RING_FLOOR_PX: 112, RING_PUNCH: 0.26, PUNCH_S: 1.0,
  CENTRE_Y_PORTRAIT: 0.40, CENTRE_Y_LANDSCAPE: 0.46, CENTRE_Y_DESKTOP: 0.48,
  PHI_HAZ0: 1.0, SKY_CAP: 3.0, SKY_PUNCH: 4.0,
  // beat
  BPM0: 112, BPM_K: 0.25, BEAT_R: 0.86, STAGE_BEATS,
  // ship
  SHIP_HALF: 3.5, GRAZE: 7, GRAZE_SOFT: 12, HAIR: 2.5, RAIL_HALF: 1.5, SKIM_BAND: 6,
  // drag gain rises with thumb speed: GAIN °/px at GAIN_V0 px/s or slower, GAIN_FAST at GAIN_V1 or faster
  GAIN: 0.6, GAIN_FAST: 1.4, GAIN_V0: 150, GAIN_V1: 1200,
  TURN_MAX: 600, TURN_TAU: 0.025, KEY_TURN: 330, KEY_RAMP: 0.06, CAM_LAG: 0.12, CAM_MAX: 280,
  // speed
  ETA0: 1.0, ETA_MIN: 0.6, ETA_TOP: 2.6, ETA_CAP: 3.0, HEADLIGHT_DROP: 2.3,
  KICK: 0.06, KICK_HAIR: 0.12, SKIM: 0.04, KICK_GATE: 0.25, KICK_COMA: 0.8,
  DRAG: 0.03, ENGINE: 0.08, HIT_ETA: 0.4, FLICKER: 1.0, GEAR_STEP: 0.4,
  // score
  CHAIN_TIMEOUT: 3.0, CHAIN_CAP: 40,
  PTS_GRAZE: 10, HAIR_X: 3, PTS_SKIM: 30, PTS_GATE: 250, PTS_CLEAR: 100, HEADLIGHT_X: 2,
  // failure: the burst's light gains at BLEED × (1 − β) light-seconds a second; grazes win lead back
  LEAD0: 8, LEAD_MAX: 9, BLEED: 0.8, HIT_LEAD: 1.5, LEAD_GRAZE: 0.12, LEAD_HAIR: 0.25, LEAD_THREAD: 0.5, LEAD_SKIM: 0.2,
  WARN_TTC: 5, MERCY: 2, SOFT_BEATS: 19, BUMP: 10, CAUGHT_LOCK: 0.4,
  // reading
  TICK_LEAD: 1.3, OUTLINE_LEAD: 1.2, ALARM_LEAD: 0.9, WHINE_LEAD: 0.6, PREVIEW_LEAD: 3.0, SILHOUETTE: 0.5,
  // feel
  HITSTOP: 0.12, SLOWMO_X: 0.35, SLOWMO_HEADLIGHT: 0.4, SLOWMO_PEAK: 0.6, SLOWMO_COMA: 1.2, SLOWMO_RESUME: 0.6,
});

// Spectral-class ranks by share of par (a strong human's score on the same seed), coloured as blackbodies. Each class
// has a star, so a letter reads as a kind of star and not a school grade.
export const RANKS = [
  { letter: 'O', share: 1.0, T: 40000, clean: true, line: 'HOTTEST · BLUE GIANT' },
  { letter: 'B', share: 0.6, T: 20000, line: 'LIKE RIGEL' },
  { letter: 'A', share: 0.35, T: 9500, line: 'LIKE SIRIUS' },
  { letter: 'F', share: 0.18, T: 7000, line: 'LIKE PROCYON' },
  { letter: 'G', share: 0.08, T: 5800, line: 'LIKE THE SUN' },
  { letter: 'K', share: 0.03, T: 4400, line: 'LIKE ARCTURUS' },
  { letter: 'M', share: 0, T: 3200, line: 'LIKE BETELGEUSE' },
];
// The player model par is measured against: quick, accurate and greedy, but human.
export const PAR_MODEL = { reactMs: 150, jitterDeg: 1.5, greed: 0.9 };

const SPAWN_BEATS = 12;        // hazards join the list this many beats before they pass
const GONE_BEATS = 4;          // and leave this many beats after
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// ---------- geometry ----------

// The rapidity the hazards and the ring are drawn with: 1.0 at cruise, easing to the floor's φ at the top speed, and
// punched toward RING_PUNCH for a second when the Headlight lights. shortPx: the screen's short side (CSS px).
export function phiHazOf(state, shortPx = 0) {
  const T = state.tune;
  const floorPx = shortPx > 0 ? Math.max(T.RING_FLOOR * shortPx, T.RING_FLOOR_PX) : T.RING_FLOOR;
  const fPx = shortPx > 0 ? T.F * shortPx : T.F;
  const floor = Math.asinh(fPx / floorPx);
  const u = clamp((state.eta - T.ETA0) / (T.ETA_TOP - T.ETA0), 0, 1);
  let phi = T.PHI_HAZ0 + (floor - T.PHI_HAZ0) * u;
  if (state.punch > 0) {
    const p = clamp(state.punch / T.PUNCH_S, 0, 1), k = p * p * (3 - 2 * p);
    phi += (Math.asinh(T.F / T.RING_PUNCH) - phi) * k;
  }
  return phi;
}

// The sky's rapidity: the true speed (capped), punched to SKY_PUNCH while the Headlight opens.
export function phiSkyOf(state) {
  const T = state.tune;
  const base = Math.min(state.eta, T.SKY_CAP);
  if (!(state.punch > 0)) return base;
  const p = clamp(state.punch / T.PUNCH_S, 0, 1), k = p * p * (3 - 2 * p);
  return base + (T.SKY_PUNCH - base) * k;
}

// Screen radius (CSS px) of a point on the tube wall at depth z (tube radii, + ahead), seen at rapidity phi with
// focal length fPx. tan(θ/2) = 1 / (√(1 + z²) + z); aberrated by e^−φ; r = f tan θ′. Infinity once it is behind.
export function depthPx(z, phi, fPx) {
  const t = 1 / (Math.hypot(1, z) + z);
  const tp = Math.exp(-phi) * t;
  if (!(tp < 1)) return Infinity;
  return (fPx * 2 * tp) / (1 - tp * tp);
}

// Doppler factor of a point on the tube wall at depth z: (e^φ + t² e^−φ) / (1 + t²), t = tan(θ/2).
export function dopplerAt(z, phi) {
  const t = 1 / (Math.hypot(1, z) + z), t2 = t * t;
  return (Math.exp(phi) + t2 * Math.exp(-phi)) / (1 + t2);
}

// The ring's radius on this screen (CSS px).
export function ringPx(state, shortPx) {
  return (state.tune.F * shortPx) / Math.sinh(phiHazOf(state, shortPx));
}

// Where the overlay draws a hazard: screen radius r (px from the ring centre), bearing ang (radians, before the camera
// roll), Doppler D, the half-width of its outline arc at that radius (px), its depth z and seconds to its pass.
export function screenOf(state, h, shortPx) {
  const T = state.tune;
  const phi = phiHazOf(state, shortPx);
  const z = (h.beat - state.beat) * T.BEAT_R;
  const r = depthPx(z, phi, T.F * shortPx);
  const half = h.kind === 'wall' || h.kind === 'gate' ? h.gap : h.half;
  return { r, ang: h.psi * DEG, D: dopplerAt(z, phi), halfPx: r * half * DEG, z, ttp: secondsTo(state, h.beat) };
}

export const secondsTo = (state, beat) => ((beat - state.beat) * 60) / state.bpm;

// ---------- the pass check ----------

// What a ship centred at bearing b (degrees) gets from hazard h as it passes: hit, the edge gaps it passes at
// (degrees; each under GRAZE is a graze, under HAIR a hairline; side +1 = the edge is to the ship's right), and
// whether it threaded a gate. The edge gap is |Δψ| − the ship's half-width − the hazard's half-width.
export function resolve(h, b, tune = TUNE) {
  const S = tune.SHIP_HALF;
  const d = wrap(b - h.psi), a = Math.abs(d), sd = d >= 0 ? 1 : -1;
  if (h.kind === 'knot' || h.kind === 'rail') {
    const g = a - S - h.half;
    return { hit: g < 0, overlap: g, gaps: g < 0 ? [] : [{ g, side: -sd }], thread: false };
  }
  if (h.kind === 'wall') {
    const inner = h.gap - a - S;
    if (inner < 0) return { hit: true, overlap: inner, gaps: [], thread: false };
    return { hit: false, overlap: inner, gaps: [{ g: inner, side: sd }, { g: h.gap + a - S, side: -sd }], thread: false };
  }
  if (h.kind === 'gate') {
    const inner = h.gap - a - S;
    if (inner >= 0) {
      return { hit: false, overlap: inner, gaps: [{ g: inner, side: sd }, { g: h.gap + a - S, side: -sd }],
        thread: true };
    }
    const outer = a - (h.gap + 2 * h.half) - S;
    if (outer >= 0) return { hit: false, overlap: outer, gaps: [{ g: outer, side: -sd }], thread: false };
    return { hit: true, overlap: Math.max(inner, outer), gaps: [], thread: false };
  }
  return { hit: false, overlap: Infinity, gaps: [], thread: false };
}

// The pass check's number for one hazard: the smallest edge gap (degrees), negative for a hit.
export function edgeGap(state, h, bearing = state.bearing) {
  const r = resolve(h, bearing, state.tune);
  if (r.hit) return r.overlap;
  return r.gaps.reduce((m, x) => Math.min(m, x.g), Infinity);
}

// ---------- state ----------

function freshStats() {
  return { grazes: 0, hairs: 0, hits: 0, bumps: 0, threads: 0, passes: 0, knots: 0, skimS: 0, headlightS: 0,
    headlights: 0, maxEta: 0, maxChain: 0, firstInputT: null, firstGrazeT: null, lostLead: 0, wonLead: 0,
    minLead: Infinity };
}

// startBeat: where the course starts (a retry skips the intro once you have played past it). Items before it are
// dropped, so nothing is passed on the first step.
export function createState({ seed = 1, script = null, tune = TUNE, toy = false, mercy = 0, meta = null,
  startBeat = 0 } = {}) {
  const T = tune;
  const items = typeof script === 'function' ? script(seed) : Array.isArray(script) ? script : buildStage(seed);
  const b0 = finite(startBeat) ? Math.max(0, startBeat) : 0;
  let next = 0;
  while (next < items.length && items[next].beat < b0) next++;
  const s = {
    seed, tune: T, toy, items, next, loop: 0, startBeat: b0,
    t: 0, rt: 0, beat: b0, bpm: T.BPM0,
    eta: T.ETA0, phiHaz: T.PHI_HAZ0, phiSky: T.ETA0, gear: 0, headlight: false, hlT: 0, punch: 0,
    bearing: 0, target: 0, keyVel: 0, turnRate: 0,
    hazards: [], chain: 0, chainT: 0, score: 0, lead: T.LEAD0 + mercy, mercy, flicker: 0, freeze: 0, slow: 0,
    ttc: Infinity, danger: 0, dangerSide: 0, dangerId: -1,
    skimming: false, warned: false, comaT: -1, vista: false, hairRun: 0,
    phase: 'play', phaseT: 0, progress: 0, result: null,
    stats: freshStats(), events: [],
    meta: meta || { best: {}, catches: 0, tries: 0, farthest: 0, clears: 0 },
  };
  s.meta.tries++;
  s.phiHaz = phiHazOf(s);
  s.phiSky = phiSkyOf(s);
  return s;
}

// Back to the stage start (same seed, or the next one). Keeps the bests and the catch count; two catches in a row
// give the next try MERCY seconds more lead. Once a run has got past the intro, retries start at INTRO_SKIP.
export function restart(state, { newSeed = false, seed = null, intro = false } = {}) {
  const meta = state.meta;
  meta.farthest = Math.max(meta.farthest || 0, state.beat - state.loop * state.tune.STAGE_BEATS);
  const nextSeed = finite(seed) ? seed : newSeed ? (state.seed >>> 0) + 1 : state.seed;
  const skip = !intro && !state.toy && meta.farthest >= 20 ? INTRO_SKIP : 0;
  const fresh = createState({ seed: nextSeed, tune: state.tune, toy: state.toy, meta, startBeat: skip,
    mercy: meta.catches >= 2 ? state.tune.MERCY : 0 });
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  return state;
}

export const gearOf = (eta, tune = TUNE) => clamp(Math.floor((eta - tune.ETA0) / tune.GEAR_STEP + 1e-9), 0, 4);

// ---------- one step ----------

// input: { aim: radians (absolute bearing, unwrapped) | null, turn: −1 | 0 | 1 }. dt: real seconds (clamped to
// 0.1). Hit-stop (hits only) freezes the course; slow motion runs it at SLOWMO_X while the ship still steers in real
// time.
// Returns this step's events (also left in state.events).
export function step(state, input, dtIn = 1 / 120) {
  const s = state, T = s.tune, ev = [];
  s.events = ev;
  const dt = clamp(finite(dtIn) ? dtIn : 0, 0, 0.1);
  s.rt += dt;
  s.phaseT += dt;
  if (s.phase !== 'play') return ev;
  const inp = input || {};

  // time: freeze, then slow motion
  const frozen = s.freeze > 0;
  let sdt = dt;
  if (s.freeze > 0) { const f = Math.min(s.freeze, sdt); s.freeze -= f; sdt -= f; }
  if (s.slow > 0) { s.slow = Math.max(0, s.slow - dt); sdt *= T.SLOWMO_X; }
  s.punch = Math.max(0, s.punch - dt);
  const steerDt = frozen ? 0 : dt;

  // steering: aim (drag or mouse) sets the target; keys turn with a short ramp and stop at once
  const prevBearing = s.bearing;
  const turn = clamp(Math.round(finite(inp.turn) ? inp.turn : 0), -1, 1);
  if (finite(inp.aim)) s.target = inp.aim / DEG;
  if (turn !== 0) {
    if (Math.sign(s.keyVel) !== turn) s.keyVel = 0;
    s.keyVel += (turn * T.KEY_TURN - s.keyVel) * Math.min(1, steerDt / Math.max(1e-3, T.KEY_RAMP));
    s.bearing += s.keyVel * steerDt;
    s.target = s.bearing;
  } else {
    s.keyVel = 0;
    const err = s.target - s.bearing;
    const v = clamp(err / Math.max(1e-3, T.TURN_TAU), -T.TURN_MAX, T.TURN_MAX);
    s.bearing = Math.abs(v * steerDt) >= Math.abs(err) ? s.target : s.bearing + v * steerDt;
  }
  if (!finite(s.bearing)) s.bearing = prevBearing;
  if (!finite(s.target)) s.target = s.bearing;
  s.turnRate = dt > 0 ? (s.bearing - prevBearing) / dt : 0;
  if (s.stats.firstInputT === null && (turn !== 0 || Math.abs(s.bearing - prevBearing) > 0.05)) s.stats.firstInputT = s.t;

  // the course: tempo follows speed, and the course moves BEAT_R tube radii per beat
  s.bpm = T.BPM0 * (1 + T.BPM_K * (s.eta - T.ETA0));
  const prevBeat = s.beat;
  s.t += sdt;
  s.beat += (sdt * s.bpm) / 60;
  const span = s.beat - prevBeat;

  // spawn
  const base = s.loop * T.STAGE_BEATS;
  while (s.next < s.items.length && s.items[s.next].beat + base - s.beat < SPAWN_BEATS) {
    const it = s.items[s.next++];
    const h = { ...it, id: it.id + s.loop * 1000, beat: it.beat + base, ticked: false, alarmed: false, passed: false };
    if (h.end !== undefined) h.end += base;
    s.hazards.push(h);
  }

  // each hazard: tick, alarm, pass, and rails while they are beside the ship
  for (const h of s.hazards) {
    if (h.kind === 'cue') {
      if (!h.passed && s.beat >= h.beat) { h.passed = true; onCue(s, h, ev); }
      continue;
    }
    const ttp = secondsTo(s, h.beat);
    if (!h.ticked && ttp <= T.TICK_LEAD) { h.ticked = true; ev.push({ t: s.t, type: 'tick', id: h.id }); }
    if (!h.passed) {
      if (!h.alarmed && ttp > 0 && ttp <= T.ALARM_LEAD && resolve(h, s.bearing, T).hit) {
        h.alarmed = true;
        ev.push({ t: s.t, type: 'alarm', id: h.id, side: escapeSide(h, s.bearing, T), kind: h.kind });
      }
      if (h.beat <= s.beat) {
        const f = span > 0 ? clamp((h.beat - prevBeat) / span, 0, 1) : 1;
        const b = prevBearing + (s.bearing - prevBearing) * f;
        h.passed = true;
        passCheck(s, h, b, ev, s.t - sdt * (1 - f));
      }
    }
  }
  railStep(s, prevBearing, sdt, ev);
  s.hazards = s.hazards.filter((h) => s.beat - (h.end ?? h.beat) < GONE_BEATS);
  dangerStep(s);

  // speed drifts back to cruise: drag above it, the engine below it
  if (s.eta > T.ETA0) s.eta = Math.max(T.ETA0, s.eta - T.DRAG * sdt);
  else if (s.eta < T.ETA0) s.eta = Math.min(T.ETA0, s.eta + T.ENGINE * sdt);

  // the chain lapses after CHAIN_TIMEOUT with no graze, and takes the Headlight with it
  // (the chain holds through the closing vista, when nothing is left to graze)
  if (s.chain > 0 && !s.vista) {
    s.chainT += sdt;
    if (s.chainT > T.CHAIN_TIMEOUT) breakChain(s, ev, 'timeout');
  }
  if (!s.headlight && s.eta >= T.ETA_TOP - 1e-9) startHeadlight(s, ev, T.SLOWMO_HEADLIGHT);
  if (s.headlight) { s.hlT += sdt; s.stats.headlightS += sdt; }
  s.flicker = Math.max(0, s.flicker - sdt);

  const gear = s.headlight ? 4 : Math.min(3, gearOf(s.eta, T));
  if (gear !== s.gear) { ev.push({ t: s.t, type: 'gear', gear, up: gear > s.gear }); s.gear = gear; }
  s.phiHaz = phiHazOf(s);
  s.phiSky = phiSkyOf(s);
  s.stats.maxEta = Math.max(s.stats.maxEta, s.eta);

  // the burst's light gains at BLEED × (1 − β); ttc is the time it needs to catch you at this speed
  const rate = bleedRate(s);
  if (!s.toy) {
    s.lead -= rate * sdt;                      // LEAD_MAX caps what grazes win back, not a head start
    s.ttc = rate > 0 ? Math.max(0, s.lead) / rate : Infinity;
    s.stats.minLead = Math.min(s.stats.minLead, s.lead);
    // the warning is real danger only: the light would catch you within WARN_TTC, or one more hit would
    const near = s.ttc < T.WARN_TTC || s.lead < T.HIT_LEAD + 0.25;
    if (!s.warned && near) { s.warned = true; ev.push({ t: s.t, type: 'warn', lead: s.lead, ttc: s.ttc }); }
    if (s.warned && s.ttc > T.WARN_TTC + 2 && s.lead > T.HIT_LEAD + 0.75) {
      s.warned = false;
      ev.push({ t: s.t, type: 'safe', lead: s.lead });
    }
  }
  s.progress = clamp((s.beat - base) / T.STAGE_BEATS, 0, 1);

  if (!s.toy && s.lead <= 0) {
    s.lead = 0;
    s.phase = 'caught';
    s.phaseT = 0;
    s.meta.catches++;
    record(s, false);
    ev.push({ t: s.t, type: 'caught', progress: s.progress });
  } else if (s.beat - base >= T.STAGE_BEATS) {
    if (s.toy) {
      s.loop++;
      s.next = 0;
      s.vista = false;
      s.meta.farthest = Math.max(s.meta.farthest || 0, T.STAGE_BEATS);
    } else {
      const bonus = Math.round(T.PTS_CLEAR * Math.cosh(s.eta) * s.lead * (s.headlight ? T.HEADLIGHT_X : 1));
      s.score += bonus;
      s.phase = 'clear';
      s.phaseT = 0;
      s.meta.catches = 0;
      s.meta.clears = (s.meta.clears || 0) + 1;
      record(s, true, bonus);
      ev.push({ t: s.t, type: 'clear', bonus, score: s.score, lead: s.lead });
    }
  }
  return ev;
}

// Light-seconds a second the burst gains at this speed: BLEED × (1 − β).
export const bleedRate = (s) => s.tune.BLEED * (2 / (Math.exp(2 * s.eta) + 1));

// The way out of a hazard from bearing b: +1 (right) or −1 (left), whichever clears it with the smaller turn.
export function escapeSide(h, b, T = TUNE) {
  for (let k = 1; k <= 180; k += 1.5) {
    if (!resolve(h, b + k, T).hit) return 1;
    if (!resolve(h, b - k, T).hit) return -1;
  }
  return 1;
}

// Danger: the nearest hazard (within ALARM_LEAD) that both your bearing and the line you are steering to would hit.
// The page plays a whine while it lasts and cuts it the moment you are clear.
function dangerStep(s) {
  const T = s.tune;
  let best = 0, id = -1, side = 0;
  for (const h of s.hazards) {
    if (h.passed || h.kind === 'cue' || h.kind === 'rail') continue;
    const ttp = secondsTo(s, h.beat);
    if (ttp <= 0 || ttp > T.ALARM_LEAD || (best && ttp >= best)) continue;
    if (!resolve(h, s.bearing, T).hit || !resolve(h, s.target, T).hit) continue;
    best = ttp; id = h.id;
  }
  if (id >= 0 && id !== s.dangerId) {
    const h = s.hazards.find((x) => x.id === id);
    side = escapeSide(h, s.bearing, T);
  } else side = id >= 0 ? s.dangerSide : 0;
  s.danger = best; s.dangerId = id; s.dangerSide = side;
}

function onCue(s, h, ev) {
  if (h.cue === 'vista') { s.slow = Math.max(s.slow, s.tune.SLOWMO_COMA); s.vista = true; }
  if (h.cue === 'coma') s.comaT = s.t;
  ev.push({ t: s.t, type: 'cue', cue: h.cue, id: h.id });
}

function passCheck(s, h, b, ev, at) {
  const T = s.tune;
  const r = resolve(h, b, T);
  s.stats.passes++;
  if (h.kind === 'knot') s.stats.knots++;
  if (r.hit) { hit(s, h, b, ev, at); return; }
  if (h.kind === 'rail') return;                  // the front of a rail only checks for a hit; riding it is a skim
  let any = false;
  const band = h.beat - s.loop * T.STAGE_BEATS < T.SOFT_BEATS ? T.GRAZE_SOFT : T.GRAZE;
  for (const { g, side } of r.gaps) if (g < band) { graze(s, h, g, side, ev, at); any = true; }
  if (r.thread) thread(s, h, ev, at);
  if (!any && !r.thread) ev.push({ t: at, type: 'pass', id: h.id, gap: r.gaps.length ? r.gaps[0].g : 0 });
}

function hit(s, h, b, ev, at) {
  const T = s.tune;
  if (s.flicker > 0) return;
  const side = Math.sign(wrap(h.psi - b)) || 1;
  if (h.beat - s.loop * T.STAGE_BEATS < T.SOFT_BEATS) {
    // the soft start: a bump aside, at no cost
    let dir = -side;
    if (h.kind === 'wall') dir = side;
    if (h.kind === 'gate') {
      const d = wrap(b - h.psi), body = Math.sign(d) * (h.gap + h.half);
      dir = Math.sign(d - body) || 1;
    }
    s.bearing += dir * T.BUMP;
    s.target += dir * T.BUMP;
    s.stats.bumps++;
    ev.push({ t: at, type: 'bump', id: h.id, side });
    return;
  }
  const lost = s.chain;
  s.eta = Math.max(T.ETA_MIN, s.eta - T.HIT_ETA);
  if (s.headlight) endHeadlight(s, ev, 'hit');
  s.chain = 0;
  s.chainT = 0;
  s.hairRun = 0;
  s.flicker = T.FLICKER;
  if (!s.toy) { s.lead -= T.HIT_LEAD; s.stats.lostLead += T.HIT_LEAD; }
  s.freeze = Math.max(s.freeze, T.HITSTOP);
  s.stats.hits++;
  ev.push({ t: at, type: 'hit', id: h.id, side, chain: lost, eta: s.eta, kind: h.kind });
}

function graze(s, h, g, side, ev, at) {
  const T = s.tune;
  const hair = g < T.HAIR;
  const gamma = Math.cosh(s.eta);
  s.chain++;
  s.chainT = 0;
  const c = Math.min(s.chain, T.CHAIN_CAP);
  const pts = Math.round(T.PTS_GRAZE * gamma * (1 + c / 10) * (hair ? T.HAIR_X : 1) * (s.headlight ? T.HEADLIGHT_X : 1));
  s.score += pts;
  s.eta = Math.min(T.ETA_CAP, s.eta + (hair ? T.KICK_HAIR : T.KICK));
  // no hit-stop on a hairline: the beat clock (and the music on it) never limps for playing well
  if (hair) { s.stats.hairs++; s.hairRun++; } else { s.stats.grazes++; s.hairRun = 0; }
  winLead(s, hair ? T.LEAD_HAIR : T.LEAD_GRAZE);
  if (s.stats.firstGrazeT === null) s.stats.firstGrazeT = at;
  s.stats.maxChain = Math.max(s.stats.maxChain, s.chain);
  ev.push({ t: at, type: hair ? 'hair' : 'graze', id: h.id, gap: g, side, points: pts, chain: s.chain, eta: s.eta,
    kind: h.kind, hairRun: s.hairRun });
}

function thread(s, h, ev, at) {
  const T = s.tune;
  const gamma = Math.cosh(s.eta);
  s.eta = Math.min(T.ETA_CAP, s.eta + (h.coma ? T.KICK_COMA : T.KICK_GATE));
  const pts = Math.round(T.PTS_GATE * gamma * (s.headlight ? T.HEADLIGHT_X : 1));
  s.score += pts;
  s.chain++;
  s.chainT = 0;
  s.stats.threads++;
  winLead(s, T.LEAD_THREAD);
  ev.push({ t: at, type: 'thread', id: h.id, points: pts, coma: Boolean(h.coma), eta: s.eta });
  // Coma's gate is the peak: it lights the Headlight in this very step (above ETA_TOP, so drag cannot undo it), and
  // if the Headlight is already on it fires the whole moment again.
  if (h.coma) {
    s.eta = Math.max(s.eta, Math.min(T.ETA_CAP, T.ETA_TOP + 0.1));
    if (!s.headlight) startHeadlight(s, ev, T.SLOWMO_PEAK, true);
    else {
      s.slow = Math.max(s.slow, T.SLOWMO_PEAK);
      s.punch = T.PUNCH_S;
      s.hlT = 0;
      ev.push({ t: at, type: 'headlight', eta: s.eta, coma: true, again: true });
    }
  }
}

function winLead(s, x) {
  if (s.toy || !(x > 0)) return;
  const before = s.lead;
  s.lead = Math.min(s.tune.LEAD_MAX, s.lead + x);
  s.stats.wonLead += s.lead - before;
}

// Rails beside the ship: crossing or touching one is a hit; riding within SKIM_BAND of it is a skim.
function railStep(s, prevBearing, sdt, ev) {
  const T = s.tune;
  let skim = false;
  for (const h of s.hazards) {
    if (h.kind !== 'rail' || !h.passed || s.beat >= h.end) continue;
    const r = resolve(h, s.bearing, T);
    const d0 = wrap(prevBearing - h.psi), d1 = wrap(s.bearing - h.psi);
    const crossed = Math.sign(d0) !== Math.sign(d1) && Math.abs(d0) < 90 && Math.abs(d1) < 90;
    if ((r.hit || crossed) && s.flicker <= 0) { hit(s, h, s.bearing, ev, s.t); continue; }
    if (!r.hit && r.overlap <= T.SKIM_BAND) skim = true;
  }
  if (skim && sdt > 0) {
    const gamma = Math.cosh(s.eta);
    s.eta = Math.min(T.ETA_CAP, s.eta + T.SKIM * sdt);
    winLead(s, T.LEAD_SKIM * sdt);
    s.score += T.PTS_SKIM * gamma * sdt * (s.headlight ? T.HEADLIGHT_X : 1);
    s.stats.skimS += sdt;
    s.chainT = 0;
  }
  if (skim !== s.skimming) { s.skimming = skim; ev.push({ t: s.t, type: skim ? 'skim' : 'skimEnd' }); }
}

function breakChain(s, ev, why) {
  if (s.chain > 0) ev.push({ t: s.t, type: 'chainEnd', chain: s.chain, why });
  s.chain = 0;
  s.chainT = 0;
  if (s.headlight) endHeadlight(s, ev, why);
}

function startHeadlight(s, ev, slow, coma = false) {
  const T = s.tune;
  s.headlight = true;
  s.hlT = 0;
  s.slow = Math.max(s.slow, slow);
  s.punch = T.PUNCH_S;
  s.stats.headlights++;
  ev.push({ t: s.t, type: 'headlight', eta: s.eta, coma });
}

function endHeadlight(s, ev, why) {
  const T = s.tune;
  s.headlight = false;
  s.eta = Math.min(s.eta, T.HEADLIGHT_DROP);
  ev.push({ t: s.t, type: 'headlightEnd', why, eta: s.eta });
}

// The run's result for the card and the log, and the per-seed bests.
function record(s, cleared, bonus = 0) {
  s.meta.farthest = Math.max(s.meta.farthest || 0, s.beat - s.loop * s.tune.STAGE_BEATS);
  const best = s.meta.best[s.seed] || { score: 0, progress: 0 };
  const prev = { ...best };
  if (s.score > best.score) best.score = Math.round(s.score);
  if (s.progress > best.progress) best.progress = s.progress;
  s.meta.best[s.seed] = best;
  s.result = { cleared, bonus, score: Math.round(s.score), progress: s.progress, lead: s.lead, prevBest: prev,
    best: { ...best } };
}

// The rank for a score against par. A clean run (no hits) is needed for O.
// next: the class above and the score it needs (null at the top), so the card can show the next goal.
export function rankOf(score, parScore, hits = 0) {
  const share = parScore > 0 ? score / parScore : 0;
  let i = RANKS.findIndex((r) => share >= r.share && (!r.clean || hits === 0));
  if (i < 0) i = RANKS.length - 1;
  const up = i > 0 ? RANKS[i - 1] : null;
  const next = up ? { letter: up.letter, score: Math.ceil(up.share * parScore), clean: Boolean(up.clean) } : null;
  return { ...RANKS[i], pct: share, next };
}

// ---------- bots ----------
// A bot is (opts) => (state) => input. They plan over the next few hazards with the same pass check the game uses.

// Hazards still to pass, in order, within horizon seconds: { h, t (s to its pass, 0 if a rail is beside you), tEnd }.
function upcoming(s, horizon) {
  const out = [];
  for (const h of s.hazards) {
    if (h.kind === 'cue') continue;
    const t = secondsTo(s, h.beat), tEnd = h.kind === 'rail' ? secondsTo(s, h.end) : t;
    if (tEnd <= 0 || t > horizon) continue;
    if (h.passed && h.kind !== 'rail') continue;
    out.push({ h, t: Math.max(0, t), tEnd: Math.max(0, tEnd) });
  }
  return out.sort((a, b) => a.t - b.t);
}

// Bearings worth aiming at for a hazard: each free edge plus SHIP_HALF plus each wanted gap, and a gap's middle.
function candidates(h, T, gaps) {
  const S = T.SHIP_HALF, out = [];
  const edge = (at, dir) => { for (const g of gaps) out.push(at + dir * (S + g)); };
  if (h.kind === 'knot' || h.kind === 'rail') { edge(h.psi - h.half, -1); edge(h.psi + h.half, 1); }
  else if (h.kind === 'wall') { edge(h.psi - h.gap, 1); edge(h.psi + h.gap, -1); out.push(h.psi); }
  else if (h.kind === 'gate') {
    edge(h.psi - h.gap, 1); edge(h.psi + h.gap, -1); out.push(h.psi);
    edge(h.psi - h.gap - 2 * h.half, -1); edge(h.psi + h.gap + 2 * h.half, 1);
  }
  return out;
}

// What a bearing is worth at a hazard, for a bot with these values.
function worth(h, b, T, val, hold = 0) {
  const r = resolve(h, b, T);
  if (r.hit) return val.hit;
  if (h.kind === 'rail') return r.overlap <= T.SKIM_BAND ? val.skim * Math.max(0.3, hold) : 0;
  let v = 0;
  for (const { g } of r.gaps) {
    if (g < T.HAIR) v += val.hair;
    else if (g < T.GRAZE) v += val.graze;
    else if (val.margin) v += Math.min(g, 20) * val.margin;
  }
  if (r.thread) v += h.coma ? val.coma : val.thread;
  return v;
}

// Search the next few hazards for the best line; returns the bearing (unwrapped, degrees) to aim at now.
// opts: depth, turn (deg/s it can count on), settle (s), gapsFor(h) → wanted gaps, val (worth table), move (cost per
// degree), from (start bearing).
function plan(s, items, opts) {
  const T = s.tune;
  const n = Math.min(items.length, opts.depth);
  const from = finite(opts.from) ? opts.from : s.bearing;
  if (n === 0) return from;
  let best = -Infinity, bestB = from;
  const rec = (i, b, tFree, acc, first) => {
    if (i === n) { if (acc > best) { best = acc; bestB = first; } return; }
    const it = items[i];
    const raw = candidates(it.h, T, opts.gapsFor(it.h));
    raw.push(b);
    const seen = new Set();
    for (const c0 of raw) {
      const opts2 = [b + wrap(c0 - b)];
      if (i === 0 && opts.rails.length && it.h.kind !== 'rail') {
        const alt = opts2[0] - 360 * Math.sign(opts2[0] - b || 1);
        opts2.push(alt);
      }
      for (const c of opts2) {
        const key = Math.round(c * 4);
        if (seen.has(key)) continue;
        seen.add(key);
        const dist = Math.abs(c - b);
        const avail = it.t - tFree - opts.settle;
        let v = worth(it.h, c, T, opts.val, it.tEnd - it.t) - dist * opts.move;
        if (dist > 0.5 && dist > opts.turn * Math.max(0, avail)) v += opts.val.late;
        // a rail beside the ship now cannot be crossed
        for (const r of opts.rails) {
          const a0 = wrap(b - r.psi), a1 = a0 + (c - b);
          if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) < T.SHIP_HALF + r.half) v += opts.val.hit;
        }
        rec(i + 1, c, it.h.kind === 'rail' ? it.tEnd : it.t, acc + v, i === 0 ? c : first);
      }
    }
  };
  rec(0, from, 0, 0, from);
  return bestB;
}

const activeRails = (s) => s.hazards.filter((h) => h.kind === 'rail' && h.passed && s.beat < h.end);

// A planner bot that replans when its next hazard changes, or every replan seconds.
function plannerBot(makeOpts) {
  let key = null, aim = null, nextAt = 0;
  return (s) => {
    if (s.phase !== 'play') { key = null; return { aim: null, turn: 0 }; }
    const o = makeOpts(s);
    const items = upcoming(s, o.horizon);
    const k = items.length ? items[0].h.id : -1;
    if (k !== key || s.t >= nextAt || aim === null) {
      key = k;
      nextAt = s.t + o.replan;
      aim = plan(s, items, { ...o, rails: activeRails(s) });
    }
    return { aim: aim * DEG, turn: 0 };
  };
}

const GRAZE_VAL = { hit: -100, hair: 3, graze: 1, thread: 6, coma: 30, skim: 4, late: -60, margin: 0 };

export const BOTS = {
  // never touches the controls
  idle: () => () => ({ aim: null, turn: 0 }),
  // keeps at least 12° clear of everything and never grazes
  dodge: () => plannerBot(() => ({
    horizon: 2.2, depth: 3, turn: 420, settle: 0.06, replan: 0.1, move: 0.004,
    gapsFor: () => [12.5], val: { hit: -100, hair: -20, graze: -20, thread: -20, coma: -20, skim: -5, late: -60,
      margin: 0.01 },
  })),
  // the perfect line: hairlines everywhere it can reach. Its score is par.
  graze: () => plannerBot(() => ({
    horizon: 2.4, depth: 3, turn: 480, settle: 0.05, replan: 0.25, move: 0.002,
    gapsFor: () => [1.0, 10], val: GRAZE_VAL,
  })),
  // a person: sees a hazard only reactMs after it comes into reach of a plan, misses by jitterDeg (one error per
  // hazard), and goes for a graze with chance greed (a hairline only when greed is high); the thumb moves at a
  // human pace.
  human: ({ reactMs = 250, jitterDeg = 4, greed = 0.5, seed = 1 } = {}) => {
    const rnd = mulberry32(hashSeed('human', seed, reactMs, jitterDeg, greed));
    const gauss = () => {
      const u = Math.max(1e-9, rnd()), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const mind = new Map();
    const thumb = 260 + 1.2 * (400 - reactMs);           // deg/s: quicker hands with quicker eyes
    let aim = null, goal = 0, key = null, lastRt = 0, alarmAt = -1, fixes = 0;
    const decide = (h) => {
      let m = mind.get(h.id);
      if (!m) {
        const greedy = rnd() < greed;
        m = { greedy, hair: greedy && rnd() < greed * 0.6, err: gauss() * jitterDeg };
        mind.set(h.id, m);
      }
      return m;
    };
    return (s) => {
      if (s.phase !== 'play') { aim = null; key = null; return { aim: null, turn: 0 }; }
      if (aim === null) { aim = s.bearing; goal = s.bearing; lastRt = s.rt; }
      const react = reactMs / 1000;
      const items = upcoming(s, 1.5 - react);
      const k = items.length ? items[0].h.id : -1;
      // the alarm (red chevron, rising tone): after reactMs, look again and correct, with a smaller error
      if (s.events.some((e) => e.type === 'alarm')) alarmAt = s.rt;
      let fix = false;
      if (alarmAt >= 0 && s.rt - alarmAt >= react && items.length && resolve(items[0].h, goal, s.tune).hit) {
        fix = true;
        alarmAt = -1;
        const m = decide(items[0].h);
        m.err = gauss() * jitterDeg * 0.6;
        m.greedy = false;
        fixes++;
      }
      if (k !== key || fix) {
        key = k;
        if (items.length) {
          const first = decide(items[0].h);
          const target = plan(s, items, {
            depth: greed >= 0.5 ? 2 : 1, turn: thumb * 0.8, settle: react * 0.5, move: 0.01, from: aim,
            rails: activeRails(s),
            gapsFor: (h) => { const m = decide(h); return m.greedy ? (m.hair ? [1.5, 4] : [4]) : [11]; },
            val: { hit: -100, hair: 3, graze: 1.5, thread: 6, coma: 30, skim: 3, late: -40, margin: 0 },
          });
          goal = target + (target === aim ? 0 : first.err);
        }
      }
      const dt = Math.max(0, s.rt - lastRt);
      lastRt = s.rt;
      const d = goal - aim, stepMax = thumb * dt;
      aim += Math.abs(d) <= stepMax ? d : Math.sign(d) * stepMax;
      return { aim: aim * DEG, turn: 0 };
    };
  },
};

// Run a bot headless from the stage start until the run ends (or maxT real seconds). Returns { state, events }.
export function simulate(botName, botOpts = {}, { seed = 1, tune = TUNE, dt = 1 / 120, maxT = 240, keep = true,
  startBeat = 0 } = {}) {
  const s = createState({ seed, tune, startBeat });
  const bot = BOTS[botName](botOpts);
  const events = [];
  while (s.phase === 'play' && s.rt < maxT) {
    const e = step(s, bot(s), dt);
    if (keep) for (const x of e) events.push(x);
  }
  return { state: s, events };
}

// Par: a strong human's score on this seed (PAR_MODEL, about 8,000 steps), from the same start beat. Cached per seed,
// start and tuning.
const parCache = new Map();
export function par(seed = 1, tune = TUNE, startBeat = 0) {
  const key = `${seed}|${startBeat}|${JSON.stringify(tune)}`;
  if (parCache.has(key)) return parCache.get(key);
  const { state } = simulate('human', { ...PAR_MODEL, seed }, { seed, tune, keep: false, startBeat });
  const v = Math.max(1, Math.round(state.score));
  parCache.set(key, v);
  return v;
}

// A plain summary of a finished run, for the result card and the log.
export function summary(s, parScore = null) {
  const st = s.stats;
  const p = parScore ?? par(s.seed, s.tune, s.startBeat);
  const rank = rankOf(s.score, p, st.hits);
  const touches = st.grazes + st.hairs;
  return {
    seed: s.seed, result: s.phase, progress: Math.round(s.progress * 1000) / 1000, score: Math.round(s.score), par: p,
    rank: rank.letter, share: Math.round(rank.pct * 1000) / 1000, lead: Math.round(s.lead * 100) / 100,
    grazes: st.grazes, hairs: st.hairs, hits: st.hits, bumps: st.bumps, threads: st.threads, passes: st.passes,
    grazePerPass: st.passes ? Math.round((touches / st.passes) * 1000) / 1000 : 0,
    headlightS: Math.round(st.headlightS * 10) / 10, skimS: Math.round(st.skimS * 10) / 10,
    maxEta: Math.round(st.maxEta * 100) / 100, maxChain: st.maxChain, timeS: Math.round(s.rt * 10) / 10,
    firstInputS: st.firstInputT === null ? null : Math.round(st.firstInputT * 100) / 100,
    minLead: Number.isFinite(st.minLead) ? Math.round(st.minLead * 100) / 100 : null,
    wonLead: Math.round(st.wonLead * 10) / 10, startBeat: s.startBeat,
  };
}
