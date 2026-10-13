// Slingshot Home (lab B): the pure core. Flight with focusing, the grab, the reel, release judging, gains, the chain,
// the nines, LIGHT SPEED, burns, losts, rewinds, the clock and the bots. No DOM, no three: it runs in plain node.
// Units: course units (u), seconds and rapidity η. North (+y) is up the course. step() takes real seconds.
import { mulberry32, hashSeed } from '../../core/rng.js';
import { COURSE1, toyMasses } from './course1.js';

const D2R = Math.PI / 180;
const H = 1 / 120;                       // the fixed step

export const TUNE = Object.freeze({
  // flight: speed s = S0 (1 + S_K η), × LS_X at LIGHT SPEED
  S0: 10, S_K: 0.4, LS_X: 1.4, FOCUS: 0.06,
  // lost: a line that can reach nothing is lost after LOST_GRACE; any flight with nothing in reach ends at LOST_S
  LOST_GRACE: 0.6, LOST_S: 5,
  // masses: radius R, and core, band and reach as shares of R
  R_SMALL: 4.5, R_MEDIUM: 6, R_LARGE: 8, R_LANDMARK: 14,
  CORE: 0.3, BAND_IN: 0.62, BAND_OUT: 0.86, REACH: 2.4,
  K_SMALL: 0.8, K_MEDIUM: 1.0, K_LARGE: 1.3, K_LANDMARK: 2.0,
  // the grab and the orbit
  // (a press closer in than GRAB_DMAX catches at GRAB_DMAX, so every hold has time before its burn)
  GRAB_COST: 0.35, GRAB_DMAX: 0.6, ALONGSIDE_S: 0.12,
  REEL: 0.24, REEL_WIDE0: 0.6, REEL_WIDE: 0.6, SWEEP0: 180, SWEEP_DEEP: 60, SWEEP_WIDE_MIN: 90,
  WORLD_SLOW: 0.6, WARN_S: 0.5,
  // the release
  PERFECT: 8, GOOD: 16, WIDE: 30, LAT_PERFECT: 0.6, LAT_GOOD: 1.0, LAT_WIDE: 1.4, LAT_INNER: 2.5, CORE_SAFE: 0.45,
  AIM_PERFECT: 1.6, AIM_GOOD: 0.8, AIM_WIDE: 0.4,
  GAIN_BASE: 0.05, GAIN_DEPTH: 0.45, CHAIN_STEP: 0.06, CHAIN_CAP: 10, SKIP_X: 1.0, SKIP_CHAIN: 2, LANDMARK_BONUS: 1.2,
  PREVIEW: 70, FREEZE_PERFECT: 0.08, SLOW_PERFECT: 0.3, SLOW_X: 0.5,
  // speed
  ETA0: 1.0, ETA_MIN: 1.0, ETA_MAX: 5.25, LS_ETA: 4.952, LS_DROP: 3.8, FREEZE_LS: 0.15, FREEZE_VISTA: 0.15,
  // failure
  BURN_S: 0.4, REWIND_S: 0.9, REWIND_ETA: 0.3, ETA_FLOOR: 0.8, CKPT_BEFORE: 0.5, MERCY_AFTER: 2, MERCY_X: 1.5, MERCY_REEL: 0.6,
  // the clock and the ranks (years)
  CLOCK_K: 0.162, CLOCK_P: 1.75, RANK_1: 1.2, RANK_2: 2.5, RANK_3: 5,
  // the first mass: the world waits, the first swing runs at half speed, the first clean releases get wide windows
  TUTORIAL_SLOW: 0.3, TUTORIAL_C: 0.6, TUT_HOLD_X: 0.5, TUT_CLEAN: 2,
  // cues: the approach ring shows a release window this long ahead; LET GO shows LETGO_LEAD before a window's
  // centre, never sooner than LETGO_MIN after the grab
  APPROACH_S: 0.75, LETGO_LEAD: 0.25, LETGO_MIN: 0.4,
  // camera (read by the view)
  HFOV: 62, HFOV_LS: 80, FOV_KICK: 8, FOV_KICK_S: 0.25,
  FLIGHT_PITCH: 30, FLIGHT_PITCH_WIDE: 22, HOLD_PITCH: 48, HOLD_PITCH_WIDE: 34,
  FLIGHT_DIST: 24, HOLD_DIST: 30, LOOK_AHEAD: 10, CAM_EASE: 0.3, LS_LOOK: 1.6,
});

// β crosses 0.9, 0.99, 0.999 and 0.9999 here.
export const NINES = [0.9, 0.99, 0.999, 0.9999].map((b) => Math.atanh(b));
export const GRADES = ['PERFECT', 'GOOD', 'WIDE', 'MISS'];
export const RANKS = ['LIGHTKEEPER', 'NAVIGATOR', 'WAYFINDER', 'DRIFTER'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

export const radiusOf = (kind, T) =>
  ({ small: T.R_SMALL, medium: T.R_MEDIUM, large: T.R_LARGE, landmark: T.R_LANDMARK })[kind] || T.R_MEDIUM;
export const massOf = (kind, T) =>
  ({ small: T.K_SMALL, medium: T.K_MEDIUM, large: T.K_LARGE, landmark: T.K_LANDMARK })[kind] || 1;
export const speedOf = (eta, ls, T) => T.S0 * (1 + T.S_K * eta) * (ls ? T.LS_X : 1);
// Your clock: years per real second. True time dilation (1 / cosh η) settles the score in the first 15 s, so the game
// uses a gentler K / η^CLOCK_P: going faster still keeps you young, and the second half of the stage still counts.
export const clockRate = (eta, T) => T.CLOCK_K / Math.max(0.5, eta) ** T.CLOCK_P;
export const ninesOf = (eta) => NINES.filter((n) => eta >= n - 1e-9).length;
export function rankOf(years, T = TUNE) {
  return years <= T.RANK_1 ? RANKS[0] : years <= T.RANK_2 ? RANKS[1] : years <= T.RANK_3 ? RANKS[2] : RANKS[3];
}

// Speed as text with all its nines: { text: '0.9990c', hot: index of the newest 9 or -1 }.
export function speedText(eta) {
  const b = Math.tanh(Math.max(0, fin(eta)));
  const n = b > 0 ? Math.max(0, Math.floor(-Math.log10(1 - b) + 1e-9)) : 0;
  const dec = Math.max(4, n + 1);
  const v = Math.floor(b * 10 ** dec) / 10 ** dec;
  const text = v.toFixed(dec) + 'c';
  return { text, hot: n > 0 ? 1 + n : -1, nines: n };
}

// ---------- the course ----------

function buildCourse(def, T, toy, seed) {
  const raw = toy ? toyMasses(seed, 0, 24) : def.masses.concat((def.targets || []).map((m) => ({ ...m, target: true })));
  const masses = raw.map((m, i) => decorate(m, i, T, toy, def));
  const final = toy ? -1 : masses.findIndex((m) => m.final);
  return { name: toy ? 'TOY' : def.name, start: def.start || { x: 0, y: 0 }, masses, final, toy };
}

function decorate(m, i, T, toy, def) {
  const R = radiusOf(m.kind, T);
  let to;
  if (toy) to = [i + 1];
  else if (m.target) to = [];
  else if (m.final) to = [def.masses.length];
  else to = m.to ? m.to.map((n) => n - 1) : [i + 1];
  return { ...m, i, R, k: massOf(m.kind, T), to };
}

function growToy(s) {
  if (!s.toy) return;
  const M = s.course.masses;
  while (M[M.length - 1].y < s.pos[1] + 220) {
    for (const m of toyMasses(s.seed, M.length, 8)) M.push(decorate(m, M.length, s.tune, true));
  }
}

const grabbable = (m) => m && !m.target;

// Direct successors of a mass (or the first mass before any grab), and the ones after those (skips, +2).
export function candidates(s, direct) {
  const M = s.course.masses;
  const out = [];
  for (const j of direct) if (M[j]) out.push({ j, skip: false });
  for (const j of direct) {
    for (const k of (M[j] ? M[j].to : [])) {
      if (M[k] && !out.some((c) => c.j === k)) out.push({ j: k, skip: true });
    }
  }
  return out;
}

// The release judge. Two numbers per candidate: the angle between the line (pos, dir) and the line to the centre of
// its band on the nearer side (the timing), and how far the line passes from that band, in units of R (the aim). The
// grade is the worse of the two, so a far target is a smaller target. Masses behind the line do not count.
// A line that skims a core (inside CORE_SAFE) is WIDE at best, and a line into any core on the way is a MISS: a grade
// never praises a line that burns you or leaves no safe press.
export function judgeLine(s, pos, dir, direct, x = 1) {
  const T = s.tune, M = s.course.masses;
  const h = Math.atan2(dir[1], dir[0]);
  const mid = 0.5 * (T.BAND_IN + T.BAND_OUT);
  let best = { target: -1, errDeg: 180, lat: 99, grade: 'MISS', skip: false, side: 0, dist: 0, core: false };
  for (const { j, skip } of candidates(s, direct)) {
    const m = M[j];
    const dx = m.x - pos[0], dy = m.y - pos[1], dist = Math.hypot(dx, dy);
    const along = dx * dir[0] + dy * dir[1];
    if (dist < 1e-6 || along <= 0) continue;
    const base = Math.atan2(dy, dx), off = Math.atan2(mid * m.R, dist);
    const e1 = Math.abs(wrap(h - base - off)), e2 = Math.abs(wrap(h - base + off));
    const errDeg = Math.min(e1, e2) / D2R;
    const b = dir[0] * dy - dir[1] * dx;                       // where the line passes the centre (signed)
    const miss = (Math.abs(b) - mid * m.R) / m.R;              // + outside the band, - toward the core
    const lat = miss >= 0 ? miss : -T.LAT_INNER * miss;
    let grade = worse(gradeOf(errDeg, T, x), latGrade(lat, T, x));
    const pass = Math.abs(b) / m.R;
    let core = false;
    if (!m.target && pass < T.CORE_SAFE) { grade = worse(grade, pass < T.CORE ? 'MISS' : 'WIDE'); core = pass < T.CORE; }
    if (grade !== 'MISS' && lineCore(s, pos, dir, along, j) >= 0) { grade = 'MISS'; core = true; }
    const better = GRADES.indexOf(grade) < GRADES.indexOf(best.grade)
      || (grade === best.grade && errDeg < best.errDeg);
    if (better) best = { target: j, errDeg, lat, grade, skip, side: b > 0 ? 1 : -1, dist, core };
  }
  return best;
}

const worse = (a, b) => (GRADES.indexOf(a) > GRADES.indexOf(b) ? a : b);
export function latGrade(lat, T, x = 1) {
  if (lat <= T.LAT_PERFECT * x) return 'PERFECT';
  if (lat <= T.LAT_GOOD * x) return 'GOOD';
  if (lat <= T.LAT_WIDE * x) return 'WIDE';
  return 'MISS';
}

// The first core a straight line runs into within len, or -1 (for the preview's red core and the bots).
export function lineCore(s, pos, dir, len, skip = -1) {
  const T = s.tune, M = s.course.masses;
  let best = -1, bestAlong = Infinity;
  for (let i = s.lo; i < M.length; i++) {
    const m = M[i];
    if (!grabbable(m) || i === skip || (s.phase === 'hold' && i === s.anchor)) continue;
    const dx = m.x - pos[0], dy = m.y - pos[1];
    const along = dx * dir[0] + dy * dir[1];
    if (along < 0 || along > len + m.R) continue;
    const off = Math.abs(dir[0] * dy - dir[1] * dx);
    if (off < T.CORE * m.R && along < bestAlong) { best = i; bestAlong = along; }
  }
  return best;
}

export function gradeOf(errDeg, T, x = 1) {
  if (errDeg <= T.PERFECT * x) return 'PERFECT';
  if (errDeg <= T.GOOD * x) return 'GOOD';
  if (errDeg <= T.WIDE * x) return 'WIDE';
  return 'MISS';
}
export const aimOf = (grade, T) => ({ PERFECT: T.AIM_PERFECT, GOOD: T.AIM_GOOD, WIDE: T.AIM_WIDE })[grade] || 0;
export const depthGain = (d, T) => T.GAIN_BASE + T.GAIN_DEPTH * Math.max(0, d) ** 2;

// ---------- state ----------

function newStats(eta) {
  return {
    releases: 0, grades: { PERFECT: 0, GOOD: 0, WIDE: 0, MISS: 0 }, errs: [], depths: [], burns: 0, losts: 0,
    rewinds: 0, chain: 0, maxChain: 0, topEta: eta, grabs: 0, grabCost: 0, gained: 0, branch: null, stageTime: 0,
    lsAt: null, lsMass: null, lsCount: 0, shallow: 0, firstGrabAt: null, reached: -1, clean: 0, early: 0,
  };
}

// tutorial: the world waits at mass 1, the first swing runs at half speed and the first clean releases get wider
// windows. A retry by someone who has already flown can skip it.
export function createState({ seed = 1, course = COURSE1, tune = TUNE, toy = false, tutorial = true } = {}) {
  const s = { seed: seed >>> 0, tune, toy, courseDef: course, tutorial };
  return restart(s);
}

export function restart(s) {
  const T = s.tune;
  s.course = buildCourse(s.courseDef, T, s.toy, s.seed);
  const st = s.course.start;
  Object.assign(s, {
    t: 0, real: 0, phase: 'fly',
    pos: [st.x, st.y], vel: [0, 0], dir: [0, 1], eta: T.ETA0, ls: false,
    anchor: -1, depth: 0, sweep: 0, orbitSign: 1, ang: 0, r: 0, warned: false,
    armed: false, chain: 0, clock: 0, next: [0], lastAnchor: -1, leftAnchor: true,
    lostTimer: 0, driftT: 0, checkpoint: null, hist: [], lo: 0,
    started: false, clockOn: false, timeScale: 1, freeze: 0, slow: 0, holdX: 1, rOff: 0, holdT: 0,
    rewind: null, down: false, stale: false,
    fails: {}, mercy: -1, nines: ninesOf(T.ETA0), bestNines: ninesOf(T.ETA0),
    grabId: 0, releaseId: 0, lastRelease: null, near: -1, nearC: 1, passing: null, flightWarn: -1, aim: 0,
    alongside: -1, shadow: T.ETA0, clockShadow: 0,
    stats: newStats(T.ETA0), events: [],
  });
  s.vel = [s.dir[0] * speedOf(s.eta, false, T), s.dir[1] * speedOf(s.eta, false, T)];
  pushHist(s);
  s.checkpoint = s.hist[0];
  return s;
}

// A copy that step() can run ahead on without touching the original (bots use it to look ahead).
export function clone(s) {
  const c = { ...s };
  c.pos = s.pos.slice(); c.dir = s.dir.slice(); c.vel = s.vel.slice(); c.next = s.next.slice();
  c.hist = s.hist.slice(); c.fails = { ...s.fails };
  c.stats = { ...s.stats, grades: { ...s.stats.grades }, errs: [], depths: [] };
  c.events = [];
  c.rewind = s.rewind ? { ...s.rewind } : null;
  c.checkpoint = s.checkpoint;
  c.ahead = true;
  return c;
}

function emit(s, type, extra) {
  const e = { t: +s.real.toFixed(4), type, ...extra };
  s.events.push(e);
  return e;
}

function pushHist(s) {
  s.hist.push({ t: s.t, pos: s.pos.slice(), dir: s.dir.slice(), next: s.next.slice(), lastAnchor: s.lastAnchor,
    leftAnchor: s.leftAnchor, eta: s.eta, aim: s.aim });
  while (s.hist.length > 2 && s.hist[1].t < s.t - 2) s.hist.shift();
}

function setEta(s, eta) {
  const T = s.tune;
  const before = s.nines;
  s.eta = clamp(eta, T.ETA_MIN, T.ETA_MAX);
  s.nines = ninesOf(s.eta);
  if (s.nines > before) {
    // the fanfare is for a new best; climbing back to a nine you already had is a small tick
    const first = s.nines > s.bestNines;
    s.bestNines = Math.max(s.bestNines, s.nines);
    emit(s, 'nine', { level: s.nines, eta: s.eta, first });
  }
  s.stats.topEta = Math.max(s.stats.topEta, s.eta);
}

function dropOut(s, why) {
  if (!s.ls) return;
  s.ls = false;
  setEta(s, Math.min(s.eta, s.tune.LS_DROP));
  s.shadow = Math.min(s.shadow, s.tune.LS_DROP);
  emit(s, 'dropout', { why, eta: s.eta });
}

// ---------- step ----------

// input: { down: boolean }; dt in real seconds. Returns this step's events (also left in state.events).
export function step(s, input, dt) {
  s.events = [];
  let left = clamp(fin(dt), 0, 0.5);
  const down = Boolean(input && input.down);
  while (left > 1e-9) {
    const h = Math.min(H, left);
    sub(s, down, h);
    left -= h;
  }
  return s.events;
}

function sub(s, downRaw, h) {
  const T = s.tune;
  s.real += h;
  if (s.phase === 'clear') {
    if (s.freeze > 0) { s.freeze -= h; return; }
    s.t += h;
    move(s, h, false);
    return;
  }
  // input edges
  const pressed = downRaw && !s.down, lifted = !downRaw && s.down;
  s.down = downRaw;
  if (s.phase === 'rewind') {
    s.stale = downRaw;
  } else {
    if (s.stale && !downRaw) s.stale = false;
    if (!s.stale) {
      if (pressed && s.phase === 'fly') tryGrab(s, true);
      else if (lifted && s.phase === 'hold') release(s);
      else if (lifted && s.armed) { s.armed = false; emit(s, 'disarm', {}); }
    }
  }
  if (s.freeze > 0) { s.freeze -= h; return; }
  if (s.phase === 'rewind') { tickClock(s, h); rewindTick(s, h); return; }

  // the world's pace: the first mass waits for you, a PERFECT slows things for a moment, deep orbits slow the music
  let target = 1;
  if (s.tutorial && !s.started && s.near >= 0 && s.nearC < T.TUTORIAL_C) target = T.TUTORIAL_SLOW;
  if (s.slow > 0) { s.slow -= h; target = Math.min(target, T.SLOW_X); }
  if (s.phase === 'hold') target = (1 - T.WORLD_SLOW * clamp(s.depth, 0, 1)) * s.holdX;
  s.timeScale += (target - s.timeScale) * Math.min(1, h / 0.12);
  if (s.phase === 'hold') s.timeScale = target;

  tickClock(s, h);
  if (s.phase === 'hold') {
    s.t += h * s.timeScale;
    holdTick(s, h * s.holdX);
  } else {
    const w = h * s.timeScale;
    s.t += w;
    flyTick(s, w);
  }
}

// Your clock runs from the first fling. A shadow clock runs at the speed you would have had with no grab costs, so the
// result can say what early presses cost you.
function tickClock(s, h) {
  if (s.toy || !s.clockOn) return;
  s.clock += h * clockRate(s.eta, s.tune);
  s.clockShadow += h * clockRate(s.shadow, s.tune);
}

// Straight flight, bent toward any mass whose reach you are in but whose ring you are outside (focusing). Works on
// the given pos and dir, so the core warning can look ahead with the same code.
function advance(s, pos, dir, w, focus) {
  const T = s.tune;
  const sp = speedOf(s.eta, s.ls, T);
  if (focus) {
    const M = s.course.masses;
    let turn = 0;
    for (let i = s.lo; i < M.length; i++) {
      const m = M[i];
      if (!grabbable(m) || (i === s.lastAnchor && !s.leftAnchor)) continue;
      const dx = m.x - pos[0], dy = m.y - pos[1], d2 = dx * dx + dy * dy;
      const reach = T.REACH * m.R;
      if (d2 > reach * reach || d2 < m.R * m.R) continue;
      const cross = dir[0] * dy - dir[1] * dx;
      turn += Math.sign(cross) * T.FOCUS * sp * m.R / d2;
    }
    if (turn) {
      const a = turn * w, c = Math.cos(a), sn = Math.sin(a);
      const x = dir[0] * c - dir[1] * sn, y = dir[0] * sn + dir[1] * c, n = Math.hypot(x, y);
      dir[0] = x / n; dir[1] = y / n;
    }
  }
  pos[0] += dir[0] * sp * w;
  pos[1] += dir[1] * sp * w;
  return sp;
}

function move(s, w, focus) {
  const sp = advance(s, s.pos, s.dir, w, focus);
  s.vel[0] = s.dir[0] * sp; s.vel[1] = s.dir[1] * sp;
}

// Which core the current line runs into within `ahead` seconds of world time, or -1.
function coreAhead(s, ahead) {
  const T = s.tune, M = s.course.masses;
  const pos = s.pos.slice(), dir = s.dir.slice();
  const w = 1 / 60;
  const span = speedOf(s.eta, s.ls, T) * ahead + 2 * T.R_LANDMARK;
  const close = [];
  for (let i = s.lo; i < M.length; i++) {
    if (grabbable(M[i]) && Math.hypot(M[i].x - pos[0], M[i].y - pos[1]) < span) close.push(i);
  }
  if (!close.length) return -1;
  for (let t = 0; t < ahead; t += w) {
    advance(s, pos, dir, w, true);
    for (const i of close) {
      const m = M[i];
      const dx = m.x - pos[0], dy = m.y - pos[1];
      if (dx * dx + dy * dy < (T.CORE * m.R) ** 2) return i;
    }
  }
  return -1;
}

// Whether the straight line ahead enters the reach of any mass you could grab (focusing only acts inside reach, so a
// straight line is the honest test). The first such mass, or -1.
export function reachAhead(s, pos = s.pos, dir = s.dir) {
  const T = s.tune, M = s.course.masses;
  const far = speedOf(s.eta, s.ls, T) * T.LOST_S;
  let best = -1, bestAlong = Infinity;
  for (let i = s.lo; i < M.length; i++) {
    const m = M[i];
    if (!grabbable(m) || (i === s.lastAnchor && !s.leftAnchor)) continue;
    const dx = m.x - pos[0], dy = m.y - pos[1];
    const along = dx * dir[0] + dy * dir[1];
    const reach = T.REACH * m.R;
    if (along < -reach || along > far + reach) continue;
    const off = Math.abs(dir[0] * dy - dir[1] * dx);
    if (off <= reach && along < bestAlong) { best = i; bestAlong = along; }
  }
  return best;
}

// ?toy: forget masses far behind, so a long session stays as fast as the first minute.
function pruneToy(s) {
  const M = s.course.masses;
  while (s.lo < M.length - 1 && M[s.lo].y < s.pos[1] - 120 && s.lo !== s.lastAnchor) s.lo++;
}

function flyTick(s, w) {
  const T = s.tune, M = s.course.masses;
  if (s.toy) { growToy(s); pruneToy(s); }
  move(s, w, true);
  // what is near: the nearest mass in reach (not the one just left, until you leave its reach)
  let near = -1, nearD = Infinity, inReach = false;
  for (let i = s.lo; i < M.length; i++) {
    const m = M[i];
    if (!grabbable(m)) continue;
    const d = Math.hypot(m.x - s.pos[0], m.y - s.pos[1]);
    if (d < T.CORE * m.R) { burn(s, i); return; }
    if (d <= T.REACH * m.R) {
      if (i === s.lastAnchor && !s.leftAnchor) continue;
      inReach = true;
      if (d < nearD) { near = i; nearD = d; }
    } else if (i === s.lastAnchor) s.leftAnchor = true;
  }
  if (near !== s.near && near >= 0) emit(s, 'reach', { mass: near });
  s.near = near;
  s.nearC = near >= 0 ? ((M[near].x - s.pos[0]) * s.dir[0] + (M[near].y - s.pos[1]) * s.dir[1]) / nearD : 1;
  if (near >= 0) {
    // "now": a tick just before the mass comes alongside, the free moment to press
    const tca = (s.nearC * nearD) / speedOf(s.eta, s.ls, T);
    if (s.alongside !== near && tca <= T.ALONGSIDE_S && tca > -0.05) {
      s.alongside = near;
      emit(s, 'alongside', { mass: near });
    }
    // a soft tick at closest approach inside a ring
    const p = s.passing;
    if (p && p.i === near && nearD > p.d && p.d < M[near].R && !p.ticked) { p.ticked = true; emit(s, 'pass', { mass: near }); }
    if (!p || p.i !== near) s.passing = { i: near, d: nearD, ticked: false };
    else if (nearD < p.d) p.d = nearD;
  }
  if (s.armed && near >= 0) { tryGrab(s, false); return; }
  // the core flashes red half a second before you would fly into it
  if (s.flightWarn < 0) {
    const i = coreAhead(s, T.WARN_S);
    if (i >= 0) {
      s.flightWarn = i;
      // a press now would catch this mass (and the catch is never deeper than GRAB_DMAX): say so
      emit(s, 'warn', { mass: i, flight: true, save: near === i });
    }
  }
  // lost: a line that reaches nothing is lost at once (after a moment to see it); a line still heading for a mass is
  // never lost early, however far it has to go
  if (inReach) { s.lostTimer = 0; s.driftT = 0; } else {
    s.driftT += w;
    if (reachAhead(s) >= 0) s.lostTimer = 0;
    else s.lostTimer += w;
    if (s.lostTimer >= T.LOST_GRACE || s.driftT >= T.LOST_S) { lose(s); return; }
  }
  pushHist(s);
}

function tryGrab(s, fresh) {
  const T = s.tune, M = s.course.masses;
  let best = -1, bestD = Infinity;
  for (let i = s.lo; i < M.length; i++) {
    const m = M[i];
    if (!grabbable(m) || (i === s.lastAnchor && !s.leftAnchor)) continue;
    const d = Math.hypot(m.x - s.pos[0], m.y - s.pos[1]);
    if (d <= T.REACH * m.R && d < bestD) { best = i; bestD = d; }
  }
  if (best < 0) {
    if (fresh && !s.armed) { s.armed = true; emit(s, 'armed', { reach: reachAhead(s) }); }
    return;
  }
  const m = M[best];
  const rx = s.pos[0] - m.x, ry = s.pos[1] - m.y;
  const c = -(rx * s.dir[0] + ry * s.dir[1]) / bestD;             // how much you were heading at it
  const cost = T.GRAB_COST * Math.max(0, c) ** 2;
  const floor = s.ls ? T.LS_ETA : T.ETA_MIN;
  const before = s.eta, ninesBefore = s.nines;
  s.eta = Math.max(Math.min(before, floor), before - cost);
  s.nines = ninesOf(s.eta);
  const cross = rx * s.dir[1] - ry * s.dir[0];
  s.orbitSign = cross >= 0 ? 1 : -1;
  s.ang = Math.atan2(ry, rx);
  // the catch: never deeper than GRAB_DMAX. The ship eases out to that orbit (rOff) instead of jumping
  const raw = (m.R - bestD) / ((1 - T.CORE) * m.R);
  s.depth = Math.min(raw, T.GRAB_DMAX);
  s.rOff = bestD - m.R * (1 - (1 - T.CORE) * s.depth);
  s.anchor = best;
  s.phase = 'hold';
  s.flightWarn = -1;
  s.armed = false;
  s.warned = false;
  s.near = -1;
  s.grabId++;
  s.lostTimer = 0;
  s.driftT = 0;
  s.holdT = 0;
  // the first swing (until the first clean release) runs at half speed while you learn the line
  s.holdX = s.tutorial && s.stats.clean === 0 ? T.TUT_HOLD_X : 1;
  // the checkpoint: where you were half a second before this grab
  let cp = s.hist[0];
  for (const e of s.hist) if (e.t <= s.t - T.CKPT_BEFORE + 1e-9) cp = e;
  s.checkpoint = cp;
  if (!s.started) { s.started = true; s.stats.firstGrabAt = s.real; }
  const paid = before - s.eta;
  s.stats.grabs++;
  s.stats.grabCost += paid;
  if (paid > 0.05) s.stats.early++;
  s.stats.reached = Math.max(s.stats.reached, best);
  if (m.branch && !s.stats.branch) s.stats.branch = m.branch;
  updateOrbit(s);
  emit(s, 'grab', { mass: best, kind: m.kind, cost: +paid.toFixed(4), early: +cost.toFixed(4),
    depth: +s.depth.toFixed(3), caught: raw > T.GRAB_DMAX, armed: !fresh, eta: s.eta });
  if (s.nines < ninesBefore) emit(s, 'ninedrop', { level: s.nines, eta: s.eta });
}

export function sweepOf(d, T) {
  return d < 0 ? Math.max(T.SWEEP_WIDE_MIN, T.SWEEP0 + 0.5 * (T.SWEEP0 - T.SWEEP_WIDE_MIN) * d)
    : T.SWEEP0 + T.SWEEP_DEEP * Math.min(d, 1);
}

function updateOrbit(s) {
  const T = s.tune, m = s.course.masses[s.anchor];
  s.r = m.R * (1 - (1 - T.CORE) * s.depth) + s.rOff;
  s.pos[0] = m.x + s.r * Math.cos(s.ang);
  s.pos[1] = m.y + s.r * Math.sin(s.ang);
  s.dir[0] = -Math.sin(s.ang) * s.orbitSign;
  s.dir[1] = Math.cos(s.ang) * s.orbitSign;
  s.sweep = sweepOf(s.depth, T) * s.holdX;
  const v = s.sweep * D2R * s.r;
  s.vel[0] = s.dir[0] * v; s.vel[1] = s.dir[1] * v;
}

// While held: the orbit closes (fast while wide), the line sweeps, the core warns half a second before the burn, then
// burns. h is hold time: real time, slowed in the first swing.
export const reelOf = (s) => s.tune.REEL * (s.mercy === s.anchor ? s.tune.MERCY_REEL : 1);
function holdTick(s, h) {
  const T = s.tune;
  const reel = reelOf(s);
  s.holdT += h;
  s.depth += (reel + (s.depth < 0 ? T.REEL_WIDE0 + T.REEL_WIDE * -s.depth : 0)) * h;
  s.ang += s.orbitSign * sweepOf(s.depth, T) * D2R * h;
  s.rOff *= Math.exp(-h / 0.08);
  if (!s.warned && (1 - s.depth) / (reel * s.holdX) <= T.WARN_S + 1e-9) {
    s.warned = true;
    emit(s, 'warn', { mass: s.anchor });
  }
  if (s.depth >= 1) { s.depth = 1; s.rOff = 0; updateOrbit(s); burn(s, s.anchor); return; }
  updateOrbit(s);
}

// The release windows get wider on a mass you keep failing on, and for your first clean releases.
export const judgeX = (s) => (s.mercy === s.anchor || (s.tutorial && s.stats.clean < s.tune.TUT_CLEAN)
  ? s.tune.MERCY_X : 1);

function release(s) {
  const T = s.tune, M = s.course.masses;
  const a = s.anchor, m = M[a];
  const j = judgeLine(s, s.pos, s.dir, m.to, judgeX(s));
  const grade = j.grade;
  const d = s.depth;
  const chainX = 1 + T.CHAIN_STEP * Math.min(s.chain, T.CHAIN_CAP);
  const gain = depthGain(d, T) * m.k * aimOf(grade, T) * chainX * (j.skip ? T.SKIP_X : 1);
  const clean = grade === 'PERFECT' || grade === 'GOOD';
  // a skip swings past a mass in one go: it counts as two links of the chain
  s.chain = clean ? s.chain + (j.skip ? T.SKIP_CHAIN : 1) : 0;
  const st = s.stats;
  st.releases++;
  if (clean) st.clean++;
  st.grades[grade]++;
  st.errs.push(+j.errDeg.toFixed(2));
  st.depths.push(+d.toFixed(3));
  if (d < 0.3) st.shallow++;
  st.maxChain = Math.max(st.maxChain, s.chain);
  st.gained += gain;
  s.releaseId++;
  s.phase = 'fly';
  s.lastAnchor = a;
  s.leftAnchor = false;
  s.anchor = -1;
  s.lostTimer = 0;
  s.driftT = 0;
  s.holdX = 1;
  s.rOff = 0;
  s.alongside = -1;
  s.next = m.to.slice();
  s.passing = null;
  s.clockOn = true;
  if (s.mercy === a && clean) s.mercy = -1;
  s.lastRelease = { grade, errDeg: j.errDeg, target: j.target, skip: j.skip, depth: d, gain, mass: a };
  s.aim = j.target;
  const ev = emit(s, 'release', { grade, errDeg: +j.errDeg.toFixed(2), lat: +j.lat.toFixed(3), depth: +d.toFixed(3),
    gain: +gain.toFixed(4), mass: a, target: j.target, skip: j.skip, chain: s.chain, core: j.core, final: !!m.final });
  setEta(s, s.eta + gain);
  s.shadow = clamp(s.shadow + gain, T.ETA_MIN, T.ETA_MAX);
  if (grade === 'PERFECT') { s.freeze = Math.max(s.freeze, T.FREEZE_PERFECT); s.slow = T.SLOW_PERFECT; }
  if (s.ls && !clean) dropOut(s, grade);
  if (m.final) {
    setEta(s, s.eta + T.LANDMARK_BONUS);
    s.shadow = clamp(s.shadow + T.LANDMARK_BONUS, T.ETA_MIN, T.ETA_MAX);
    checkLs(s);
    ev.eta = s.eta;
    st.stageTime = s.real;
    emit(s, 'vista', { eta: s.eta });
    s.freeze = Math.max(s.freeze, T.FREEZE_VISTA);
    s.phase = 'clear';
    emit(s, 'clear', { clock: s.clock, rank: rankOf(s.clock, T), time: s.real });
    return;
  }
  checkLs(s);
  ev.eta = s.eta;
  pushHist(s);
}

function checkLs(s) {
  const T = s.tune;
  if (!s.ls && s.eta >= T.LS_ETA - 1e-9) {
    s.ls = true;
    s.freeze = Math.max(s.freeze, T.FREEZE_LS);
    s.stats.lsCount++;
    const first = s.stats.lsAt === null;
    if (first) { s.stats.lsAt = s.real; s.stats.lsMass = s.lastAnchor; }
    emit(s, 'lightspeed', { eta: s.eta, mass: s.lastAnchor, first });
  }
}

function burn(s, i) {
  const T = s.tune, m = s.course.masses[i];
  const held = s.phase === 'hold';
  s.stats.burns++;
  if (s.toy) {
    // ?toy: no failure. The core flings you out instead, with no gain.
    emit(s, 'burn', { mass: i, toy: true, eta: s.eta });
    dropOut(s, 'burn');
    s.chain = 0;
    setEta(s, s.eta - T.REWIND_ETA);
    if (!held) {
      const dx = s.pos[0] - m.x, dy = s.pos[1] - m.y, n = Math.hypot(dx, dy) || 1;
      s.dir = [dx / n, dy / n];
      s.pos = [m.x + s.dir[0] * T.CORE * m.R * 1.05, m.y + s.dir[1] * T.CORE * m.R * 1.05];
    }
    s.phase = 'fly';
    s.lastAnchor = i;
    s.leftAnchor = false;
    s.anchor = -1;
    s.flightWarn = -1;
    s.holdX = 1;
    s.rOff = 0;
    s.next = m.to.slice();
    return;
  }
  // a burn in flight is the last line's fault: the retry is on the mass you left
  fail(s, 'burn', i, held ? i : s.lastAnchor);
}

function lose(s) {
  s.stats.losts++;
  fail(s, 'lost', s.lastAnchor, s.lastAnchor);
}

// Burn or lost: a short hold, then the tape runs back to just before your last grab. The clock never rewinds.
function fail(s, kind, i, blame) {
  const T = s.tune;
  emit(s, kind, { mass: i, eta: s.eta });
  dropOut(s, kind);
  s.chain = 0;
  const key = String(blame);
  s.fails[key] = (s.fails[key] || 0) + 1;
  if (blame >= 0 && s.fails[key] >= T.MERCY_AFTER) s.mercy = blame;
  const cp = s.checkpoint || s.hist[0];
  const eta = s.toy ? s.eta : Math.max(T.ETA_FLOOR, s.eta - T.REWIND_ETA);
  s.shadow = Math.max(T.ETA_FLOOR, s.shadow - T.REWIND_ETA);
  s.rewind = { kind, mass: i, t: 0, from: { pos: s.pos.slice(), dir: s.dir.slice() }, to: cp, eta, started: false };
  s.phase = 'rewind';
  s.anchor = -1;
  s.armed = false;
  s.flightWarn = -1;
  s.holdX = 1;
  s.rOff = 0;
  s.stale = s.down;
  s.stats.rewinds++;
}

// The retry's line never skims a core: if it would pass inside CORE_SAFE of one in the next 3 s, turn it out to pass
// at 0.7 R on the same side.
function nudgeLine(s) {
  const T = s.tune, M = s.course.masses;
  const far = speedOf(s.eta, false, T) * 3;
  for (let i = s.lo; i < M.length; i++) {
    const m = M[i];
    if (!grabbable(m)) continue;
    const dx = m.x - s.pos[0], dy = m.y - s.pos[1];
    const along = dx * s.dir[0] + dy * s.dir[1], dist = Math.hypot(dx, dy);
    if (along <= 0 || along > far || dist < m.R) continue;
    const b = s.dir[0] * dy - s.dir[1] * dx;
    if (Math.abs(b) >= T.CORE_SAFE * m.R) continue;
    const side = b >= 0 ? 1 : -1;                                // keep the mass on the same side of the line
    const want = Math.asin(clamp((0.7 * m.R) / dist, 0, 1));
    const base = Math.atan2(dy, dx) - side * want;
    s.dir = [Math.cos(base), Math.sin(base)];
    return i;
  }
  return -1;
}

function rewindTick(s, h) {
  const T = s.tune, rw = s.rewind;
  rw.t += h;
  if (!rw.started && rw.t >= T.BURN_S - 1e-9) { rw.started = true; emit(s, 'rewind', { kind: rw.kind }); }
  if (rw.t < T.BURN_S + T.REWIND_S - 1e-9) return;
  const cp = rw.to;
  s.pos = cp.pos.slice();
  s.dir = cp.dir.slice();
  s.next = cp.next.slice();
  s.lastAnchor = cp.lastAnchor;
  s.leftAnchor = cp.leftAnchor;
  s.aim = cp.aim;
  setEta(s, rw.eta);
  const nudged = nudgeLine(s);
  s.phase = 'fly';
  s.rewind = null;
  s.lostTimer = 0;
  s.driftT = 0;
  s.near = -1;
  s.alongside = -1;
  s.passing = null;
  s.slow = 0;
  s.hist = [];
  pushHist(s);
  s.checkpoint = s.hist[0];
  emit(s, 'resume', { eta: s.eta, mercy: s.mercy, nudged });
}

// ---------- reading the state ----------

// The preview line and what it is lined up with. While held, the line is the tangent; in flight, the heading.
export function preview(s) {
  const T = s.tune, M = s.course.masses;
  const direct = s.phase === 'hold' ? M[s.anchor].to : s.next;
  const x = s.phase === 'hold' ? judgeX(s) : 1;
  const j = judgeLine(s, s.pos, s.dir, direct, x);
  const x1 = s.pos[0] + s.dir[0] * T.PREVIEW, y1 = s.pos[1] + s.dir[1] * T.PREVIEW;
  // rings the line crosses, and whether it crosses the target's band
  const crosses = [];
  let band = false;
  for (const { j: k } of candidates(s, direct)) {
    const m = M[k];
    const dx = m.x - s.pos[0], dy = m.y - s.pos[1];
    const along = clamp(dx * s.dir[0] + dy * s.dir[1], 0, T.PREVIEW);
    const off = Math.hypot(s.pos[0] + s.dir[0] * along - m.x, s.pos[1] + s.dir[1] * along - m.y);
    if (off <= m.R) crosses.push(k);
    if (k === j.target && off >= T.BAND_IN * m.R * 0.9 && off <= T.BAND_OUT * m.R * 1.1) band = true;
  }
  return { line: [s.pos[0], s.pos[1], x1, y1], target: j.target, grade: j.grade, errDeg: j.errDeg, lat: j.lat,
    skip: j.skip, side: j.side, crosses, band, core: lineCore(s, s.pos, s.dir, T.PREVIEW) };
}

export function summary(s) {
  const st = s.stats, T = s.tune;
  const errs = st.errs.slice().sort((a, b) => a - b);
  return {
    clock: +s.clock.toFixed(4), rank: rankOf(s.clock, T), time: +(st.stageTime || s.real).toFixed(2),
    top: speedText(st.topEta).text, topEta: +st.topEta.toFixed(3),
    perfectPct: st.releases ? Math.round((100 * st.grades.PERFECT) / st.releases) : 0,
    grades: { ...st.grades }, releases: st.releases, maxChain: st.maxChain, burns: st.burns, losts: st.losts,
    branch: st.branch || '-', medianErr: errs.length ? errs[errs.length >> 1] : null,
    grabCost: +st.grabCost.toFixed(3), lsAt: st.lsAt, seed: s.seed, early: st.early,
    earlyYears: +Math.max(0, s.clock - s.clockShadow).toFixed(4),
  };
}

// The release windows ahead in this hold, found by running a copy forward while held: each is a stretch where a lift
// grades GOOD or better toward a target, with its best moment (peak, in seconds from now), the depth there, and the
// point where that line passes its target (for the approach ring). One sweep of the line crosses several in a burst
// (both sides of a band, and a skip): `cues` keeps one per burst, the longest toward the next mass, for the approach
// ring and LET GO, with that burst's skips as `alts`. Also when the hold would burn.
export function holdWindows(s, seconds = 8) {
  const out = { list: [], cues: [], burnAt: null };
  if (s.phase !== 'hold') return out;
  const T = s.tune, M = s.course.masses;
  const c = clone(s);
  const to = M[s.anchor].to;
  let cur = null;
  for (let t = 0; t < seconds; t += H) {
    const j = judgeLine(c, c.pos, c.dir, to, judgeX(c));
    if (j.grade === 'PERFECT' || j.grade === 'GOOD') {
      const m = M[j.target];
      const q = Math.max(j.errDeg / T.PERFECT, j.lat / T.LAT_PERFECT);
      if (!cur || cur.target !== j.target || t - cur.t1 > 1.5 * H) {
        cur = { t0: t, t1: t, peak: t, q: Infinity, target: j.target, skip: j.skip, grade: j.grade, depth: c.depth };
        out.list.push(cur);
      }
      cur.t1 = t;
      if (j.grade === 'PERFECT') { cur.grade = 'PERFECT'; if (cur.p0 === undefined) cur.p0 = t; cur.p1 = t; }
      if (q < cur.q) {
        const along = (m.x - c.pos[0]) * c.dir[0] + (m.y - c.pos[1]) * c.dir[1];
        Object.assign(cur, { q, peak: t, depth: c.depth, gain: depthGain(c.depth, T) * m.k,
          at: [c.pos[0] + c.dir[0] * along, c.pos[1] + c.dir[1] * along] });
      }
    } else cur = null;
    step(c, { down: true }, H);
    if (c.phase !== 'hold') { out.burnAt = t + H; break; }
  }
  // the moment to aim for: the middle of the window (the most forgiving), or of its PERFECT stretch when that is long
  for (const w of out.list) {
    w.aim = (w.t0 + w.t1) / 2;
    if (w.p0 !== undefined && w.p1 - w.p0 >= 0.4 * (w.t1 - w.t0)) w.aim = (w.p0 + w.p1) / 2;
  }
  // bursts: windows less than 0.25 s apart
  let burst = [];
  const flush = () => {
    if (!burst.length) return;
    const len = (w) => w.t1 - w.t0 + (w.grade === 'PERFECT' ? 0.02 : 0);
    const direct = burst.filter((w) => !w.skip);
    const pick = (direct.length ? direct : burst).reduce((a, b) => (len(b) > len(a) ? b : a));
    out.cues.push({ ...pick, alts: burst.filter((w) => w !== pick && w.skip) });
    burst = [];
  };
  for (const w of out.list) {
    if (burst.length && w.t0 - burst[burst.length - 1].t1 > 0.25) flush();
    burst.push(w);
  }
  flush();
  return out;
}

// When LET GO should show (seconds from the grab): LETGO_LEAD before the aim of a burst's best window, so a lift a
// reaction later lands on it, and never in the first LETGO_MIN of a hold. Skips get no call.
export function letGoTimes(windows, T = TUNE) {
  return windows.cues.filter((w) => !w.skip && w.aim - T.LETGO_LEAD >= T.LETGO_MIN)
    .map((w) => ({ at: w.aim - T.LETGO_LEAD, w }));
}

// ---------- bots ----------

// Gaussian deviates for the bots' timing wobble.
function gauss(rnd) {
  return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
}

// Plan a release from a hold: sample the orbit until it burns, and pick the time that pays best for a player whose
// timing wobbles by sigma seconds. pick: 'best' (deepest pay under depthMax) or 'first' (the first band crossing).
function planRelease(s, { sigma, depthMax, pick, patience = 0 }) {
  const T = s.tune, M = s.course.masses;
  const c = clone(s);
  const to = M[s.anchor].to;
  const k = M[s.anchor].k;
  const x = judgeX(s);
  const rows = [];
  const capped = s.eta >= T.ETA_MAX - 0.01;
  for (let t = 0; t < 8; t += H) {
    const j = judgeLine(c, c.pos, c.dir, to, x);
    rows.push({ t, d: c.depth, err: j.errDeg, lat: j.lat, grade: j.grade, skip: j.skip });
    step(c, { down: true }, H);
    if (c.phase !== 'hold') break;
  }
  const burnAt = rows.length * H;
  // what a release at row i is worth: its gain, or the price of a lost (the rewind's speed and about 4 s) on a MISS
  const valAt = (i) => {
    const r = rows[clamp(i, 0, rows.length - 1)];
    if (r.grade === 'MISS') return -(T.REWIND_ETA + 4 * Math.max(patience, 0.1));
    // a skip flies past a mass it could have swung on: worth it only once speed is maxed
    const skip = r.skip ? (capped ? T.SKIP_X : 0.5) : 1;
    return aimOf(r.grade, T) * skip * depthGain(r.d, T) * k - 0.15 * Math.min(r.lat, 1) + (r.skip && capped ? 0.2 : 0);
  };
  const sd = Math.max(1, Math.round(sigma / H));
  const QUAD = [[-2, 0.054], [-1, 0.244], [0, 0.403], [1, 0.244], [2, 0.054]];
  if (pick === 'first') {
    for (let i = 1; i < rows.length - 1; i++) {
      const r = rows[i];
      const ok = r.grade === 'PERFECT' || r.grade === 'GOOD';
      if (ok && r.err <= rows[i - 1].err && r.err <= rows[i + 1].err) return { at: r.t, row: r, burnAt };
    }
  }
  let best = null;
  const cap = Math.max(depthMax, rows[0].d + 0.05);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.d > cap) break;
    if (i + 2 * sd >= rows.length) break;                     // too close to the burn for this player's wobble
    // the expected worth for this player's wobble; an expert also wants the line through the band (valAt's lat term)
    let v = 0;
    for (const [q, wgt] of QUAD) v += wgt * valAt(i + q * sd);
    v -= patience * r.t;
    if (!best || v > best.v + 1e-9) best = { v, at: r.t, row: r };
  }
  if (!best) return { at: Math.max(0, burnAt - 3 * sigma - 0.1), row: rows[0], burnAt };
  return { ...best, burnAt };
}

// When to press. pressAtClosest false: as soon as any mass is in reach. Otherwise try press times from reach entry to
// closest approach of the mass the line was aimed at, and keep the one whose swing pays best after the grab's cost
// (closest approach, unless that leaves no good window before the burn).
function planPress(s, { pressAtClosest, sigma, depthMax, patience }) {
  const M = s.course.masses;
  const c = clone(s);
  const aim = M[s.aim] && !M[s.aim].target ? s.aim : -1;
  let prev = Infinity, entry = null;
  const tries = [];
  for (let t = H; t < 4; t += H) {
    const snap = (tries.length === 0 || t - tries[tries.length - 1].t >= 2 * H) ? clone(c) : null;
    step(c, { down: false }, H);
    if (c.phase !== 'fly') { if (snap && entry !== null) tries.push({ t: t - H, state: snap }); break; }
    if (c.near < 0) continue;
    if (entry === null) entry = t;
    if (!pressAtClosest) return { at: entry };
    if (aim >= 0 && c.near !== aim) continue;
    const m = M[c.near];
    const d = Math.hypot(m.x - c.pos[0], m.y - c.pos[1]);
    if (snap) tries.push({ t: t - H, state: snap });
    if (d > prev + 1e-9) break;
    prev = d;
  }
  if (!tries.length) return { at: entry ?? 4 };
  let best = null;
  for (const tr of tries) {
    const g = clone(tr.state);
    const before = g.eta;
    step(g, { down: true }, H);
    if (g.phase !== 'hold') continue;
    const p = planRelease(g, { sigma, depthMax, pick: 'best', patience });
    const v = (p.v ?? -1) - (before - g.eta) - patience * tr.t;
    if (!best || v > best.v) best = { v, at: tr.t };
  }
  return { at: best ? best.at : entry ?? 4 };
}

function makeBot(kind, opts = {}) {
  const jitter = (opts.jitterMs ?? 0) / 1000;
  const react = (opts.reactMs ?? 0) / 1000;
  const depthMax = opts.depthMax ?? 0.8;
  const pressAtClosest = opts.pressAtClosest ?? true;
  const patience = opts.patience ?? 0;
  let rnd = null, seed = -1, plan = null, press = null, key = '';
  return (s) => {
    if (seed !== s.seed || !rnd) { seed = s.seed; rnd = mulberry32(hashSeed(s.seed, 'bot', kind, opts.jitterMs ?? 0)); }
    if (kind === 'idle') return { down: false };
    if (s.phase === 'rewind' || s.phase === 'clear') { plan = null; press = null; return { down: false }; }
    if (s.phase === 'hold') {
      press = null;
      if (kind === 'holder') return { down: true };
      const k = `h${s.grabId}`;
      if (!plan || key !== k) {
        key = k;
        const p = planRelease(s, { sigma: Math.max(jitter, 0.004), depthMax, pick: kind === 'first' ? 'first' : 'best',
          patience });
        plan = { at: s.real + p.at + gauss(rnd) * jitter };
      }
      return { down: s.real < plan.at - 1e-9 };
    }
    // flight
    plan = null;
    if (kind === 'holder') return { down: s.near >= 0 };
    const k = `f${s.releaseId}:${s.stats.rewinds}`;
    if (!press || key !== k) {
      key = k;
      const p = planPress(s, { pressAtClosest: kind !== 'first' && pressAtClosest, sigma: Math.max(jitter, 0.004),
        depthMax, patience });
      press = { at: s.real + p.at + react + gauss(rnd) * jitter };
    }
    return { down: s.real >= press.at };
  };
}

export const BOTS = {
  idle: () => makeBot('idle'),
  holder: () => makeBot('holder'),
  first: (o = {}) => makeBot('first', { jitterMs: 110, reactMs: 250, ...o, pressAtClosest: false }),
  greedy: (o = {}) => makeBot('greedy', { jitterMs: 60, depthMax: 0.8, pressAtClosest: true, patience: 0.03, ...o }),
  exact: (o = {}) => makeBot('exact', { jitterMs: 10, depthMax: 0.9, pressAtClosest: true, patience: 0.03, ...o }),
};

// Run a bot headless until the stage clears or the time runs out. Returns the state and every event.
export function runBot(name, opts = {}, { seed = 1, seconds = 180, tune = TUNE, course = COURSE1, toy = false,
  tutorial = true } = {}) {
  const s = createState({ seed, tune, course, toy, tutorial });
  const bot = BOTS[name](opts);
  const events = [];
  const steps = Math.round(seconds / H);
  for (let i = 0; i < steps && s.phase !== 'clear'; i++) {
    for (const e of step(s, bot(s), H)) events.push(e);
  }
  return { state: s, events, summary: summary(s) };
}
