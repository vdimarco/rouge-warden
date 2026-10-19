// First Breath: the shared action layer (openspec/changes/first-breath-action-genres/contract.md). One small world
// of circles that a stage owns and steps once per fixed step: your body (moved by the move vector, a dash on a
// second tap or Space, short i-frames after a hit), auto-fire at the nearest foe in range, one pooled bullet system
// for both sides, foes with behaviours (chase, orbit, wander, shooter, still), bullet patterns with telegraphs
// (aimed, fan, ring, spiral, wave), pickups (food, heal, up), a wave spawner, an optional shrinking safe zone, score
// with a combo, number pops and juice (hit flash, a small shake, hit-stop). A knock-out (hp 0) only sets A.ko: the
// stage ends there, its grade drops and core/run.js shows the Almost card (Try again or Go on). Pure and seeded:
// every draw comes from stream(seed, "action"); no DOM, no clocks.
//
// Sources: bullet patterns as small parametric emitters (aimed, fan, ring, spiral, wave) after Kenta Cho's BulletML
// (ABA Games, 2003) and the danmaku convention of a small hitbox inside a larger body (Touhou Project); auto-fire at
// the nearest foe after Vampire Survivors (poncle, 2022); telegraph before every pattern after the "wind-up" of
// action games (GDC 2015, "The Art of the Telegraph"); hit flash, screen shake and hit-stop after Jan Willem
// Nijman, "The Art of Screenshake" (INDIGO 2013) and Martin Jonasson and Petri Purho, "Juice it or lose it" (GDC
// Europe 2012). The pooled structure-of-arrays bullets are our own (swap-remove keeps the live ones packed).
//
// Units: world u, seconds, radians (counterclockwise from +x, y up). Positions in typed arrays are Float32.
import { DT } from "../clock.js";
import { stream } from "../rng.js";
import { emit } from "../events.js";

const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d) => (fin(v) ? v : d);

// The defaults; a stage overrides any of them in createWorld's opts (a shallow merge per group).
export const ACT = Object.freeze({
  caps: Object.freeze({ bullets: 640, foes: 48, pickups: 96, tells: 16, pops: 12, bursts: 16 }),
  burstS: 0.45,
  player: Object.freeze({
    r: 1.7,          // the hitbox (bullets and contact): small, inside the body
    body: 4,         // the body: pickups, drawing and the arena wall
    speed: 36,       // u/s at full deflection
    accel: 18,       // 1/s: the velocity eases toward the stick this fast (tight, not floaty)
    hp: 5,
    invS: 1.0,       // i-frames after a hit
    mercyR: 9,       // foe bullets this close are cleared when you are hit (no chain hits)
    push: 6,         // a hit pushes you this far from what hit you
    safeR: 14,       // no foe bullet is made this close to you (the pattern waits)
    clearR: 24,      // no foe spawns this close to you (it moves along the wall, or away)
    shield: 0,       // shield pips (each Glowing grade so far, up to 2: the stage sets it): they take the first hits
  }),
  bulletCap: 400,    // foe bullets at once: a pattern that would pass it waits (each stage sets its own)
  dash: Object.freeze({ speed: 110, s: 0.15, invS: 0.26, cdS: 0.85, bufferS: 0.12 }),
  fire: Object.freeze({ rate: 5, dmg: 1, speed: 95, spread: 1, arc: 0.2, pierce: 0, range: 60, r: 1.1, life: 0.9, kb: 6 }),
  pickup: Object.freeze({ magnet: 15, pull: 80, lifeS: 9, r: 1.3, drag: 3 }),
  combo: Object.freeze({ s: 1.3, step: 0.1, max: 2.5 }),
  foe: Object.freeze({ spawnS: 0.6, steer: 4, drag: 1.5, sep: 1.0, mercyS: 0.25 }),
  juice: Object.freeze({ shakeHit: 0.7, shakeClear: 0.12, shakeBig: 0.55, decay: 3.2, flashDecay: 3.5,
    stopHit: 5, stopBig: 6, stopPhase: 8 }),
  popS: 0.8,
  zone: Object.freeze({ tickS: 1.0, dmg: 1 }),
});

export const TONES = Object.freeze(["you", "foe", "hot", "soft"]);           // bullet tone ids 0..3
export const PICKS = Object.freeze(["food", "heal", "up"]);                  // pickup kind ids 0..2
export const FOE_KINDS = Object.freeze(["germ", "blob", "spore", "ring", "boss", "rival", "cell", "drop", "guard"]);
export const BEHAVIOURS = Object.freeze(["chase", "orbit", "wander", "shooter", "still"]);
export const PATTERNS = Object.freeze(["aimed", "fan", "ring", "spiral", "wave"]);
export const TELLS = Object.freeze(["line", "fan", "ring", "spot", "charge"]);
const TONE = { you: 0, foe: 1, hot: 2, soft: 3 };
const HP_PIPS = 12;                                                          // the HUD shows at most 12 (draw.js LIMITS.hp)
const PICK = { food: 0, heal: 1, up: 2 };

// ---- pools

function bulletPool(cap) {
  const f = () => new Float32Array(cap);
  return { n: 0, cap, x: f(), y: f(), vx: f(), vy: f(), r: f(), life: f(), age: f(), dmg: f(), w: f(), wf: f(),
    turn: f(), acc: f(), side: new Uint8Array(cap), tone: new Uint8Array(cap), pierce: new Uint8Array(cap),
    last: new Int32Array(cap) };
}
const B_KEYS = ["x", "y", "vx", "vy", "r", "life", "age", "dmg", "w", "wf", "turn", "acc", "side", "tone", "pierce", "last"];

function pickupPool(cap) {
  const f = () => new Float32Array(cap);
  return { n: 0, cap, x: f(), y: f(), vx: f(), vy: f(), v: f(), age: f(), life: f(), kind: new Uint8Array(cap) };
}
const K_KEYS = ["x", "y", "vx", "vy", "v", "age", "life", "kind"];

function swapOut(P, keys, i) {
  if (i < 0 || i >= P.n) return;
  const j = --P.n;
  if (i !== j) for (const k of keys) P[k][i] = P[k][j];
}

// ---- the world

// createWorld(seed, opts) → the world A. opts: { arena: { x, y, r } | null (a round wall; null for none), player:
// { x, y, ...ACT.player }, dash: { ...ACT.dash } | null (no dash), fire: { ...ACT.fire } | null (no auto-fire),
// pickup, combo, foe, juice (each a shallow override), bulletK (foe bullet speed factor, e.g. 0.75 with Assist),
// bulletCap (foe bullets at once), keepOut: [{ ang, half }] (arcs of the arena's wall where no foe spawns) }.
export function createWorld(seed, opts = {}) {
  const o = opts || {};
  const P = { ...ACT.player, ...(o.player || {}) };
  const A = {
    t: 0, seed: seed >>> 0, step: 0,
    arena: o.arena === null ? null : { x: 0, y: 0, r: 46, ...(o.arena || {}) },
    zone: null,
    p: {
      x: num(P.x, 0), y: num(P.y, 0), vx: 0, vy: 0, r: P.r, body: P.body, speed: P.speed, accel: P.accel,
      hp: P.hp, hpMax: P.hp, invS: P.invS, mercyR: P.mercyR, inv: 0, dashT: 0, dashCd: 0, dashQ: 0, dx: 0, dy: 1,
      face: Math.PI / 2, mx: 0, my: 0, fixed: !!P.fixed, zoneT: 0, push: P.push, safeR: P.safeR, clearR: P.clearR,
      shield: Math.max(0, num(P.shield, 0) | 0), shieldMax: Math.max(0, num(P.shield, 0) | 0),
    },
    dash: o.dash === null ? null : { ...ACT.dash, ...(o.dash || {}) },
    fire: o.fire === null ? null : { ...ACT.fire, ...(o.fire || {}), cool: 0 },
    pick: { ...ACT.pickup, ...(o.pickup || {}) },
    comboK: { ...ACT.combo, ...(o.combo || {}) },
    foeK: { ...ACT.foe, ...(o.foe || {}) },
    juiceK: { ...ACT.juice, ...(o.juice || {}) },
    bulletK: num(o.bulletK, 1),
    bulletCap: Math.max(1, num(o.bulletCap, ACT.bulletCap) | 0),
    keepOut: Array.isArray(o.keepOut) ? o.keepOut.map((k) => ({ ang: num(k.ang, 0), half: Math.max(0, num(k.half, 0)) })) : [],
    foes: [],
    b: bulletPool(ACT.caps.bullets),
    k: pickupPool(ACT.caps.pickups),
    tells: [], pops: [], bursts: [],
    juice: { shake: 0, flash: 0, stop: 0 },
    score: 0, combo: 0, comboT: 0, bestCombo: 0, kills: 0, hits: 0, shots: 0, strikes: 0,
    spawned: 0, value: 0, cleared: 0, food: 0, picks: 0, dashes: 0, ko: false,
    out: [], nextId: 1, sfxAt: {}, inBullets: false, mercy: false,
  };
  A.rnd = stream(A.seed, "action");
  return A;
}

// ---- input

// The move vector from intents: steer (world, |v| <= 1). A drag anywhere or WASD / the arrows (ui/input.js "move").
export function moveOf(intents) {
  const s = intents && intents.steer;
  const x = s && fin(s.x) ? s.x : 0, y = s && fin(s.y) ? s.y : 0;
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}
// A dash this step: any press (a second finger, a quick second tap, Space, Enter or Z in the "move" gesture).
export const wantsDash = (intents) => !!(intents && Array.isArray(intents.presses) && intents.presses.length);

// ---- juice, pops, score

function shake(A, k) { A.juice.shake = Math.min(1, A.juice.shake + k); }
// A burst of paper flecks at (x, y): kind 0 a foe cleared (its colour), 1 you were hit (cream), 2 a pickup.
export function burst(A, x, y, r, kind = 0) {
  if (A.bursts.length >= ACT.caps.bursts) A.bursts.shift();
  A.bursts.push({ x, y, r: Math.max(0.5, r), age: 0, k: kind | 0, rot: A.rnd() * TAU });
}
export function hitStop(A, frames) { A.juice.stop = Math.max(A.juice.stop, frames | 0); }

// A number pop at (x, y): the points a clear gave (the stage calls it with what it adds to the HUD score).
export function pop(A, x, y, value, combo = 0) {
  if (A.pops.length >= ACT.caps.pops) A.pops.shift();
  A.pops.push({ x, y, v: Math.round(value), age: 0, combo: combo | 0 });
}

export const comboMult = (A) => Math.min(A.comboK.max, 1 + A.comboK.step * Math.max(0, A.combo - 1));

// ---- the player

// Your body is hit: a shield pip goes first, else hp − dmg; i-frames, a push of p.push u away from (fx, fy) when
// given, the flash, a shake, a hit-stop, the combo lost, and the foe bullets near you cleared. → false while you are
// still invulnerable (or already knocked out).
export function hitPlayer(A, dmg = 1, from = null, fx = NaN, fy = NaN) {
  const p = A.p;
  if (A.ko || p.inv > 0) return false;
  const shielded = p.shield > 0;
  if (shielded) p.shield--;
  else p.hp = Math.max(0, p.hp - Math.max(0, dmg));
  p.inv = p.invS;
  A.hits++;
  if (shielded) A.shieldHits = (A.shieldHits || 0) + 1;
  if (fin(fx) && fin(fy)) {
    const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy);
    if (d > 1e-6 && !p.fixed) {
      // a velocity the stick's easing (k a step) brings down over the next steps: in all, p.push u
      const k = Math.min(0.99, p.accel * DT), v = (p.push * k) / (DT * (1 - k));
      p.vx = (dx / d) * v; p.vy = (dy / d) * v; p.dashT = 0;
    }
  }
  A.juice.flash = shielded ? 0.5 : 1;
  shake(A, A.juiceK.shakeHit);
  hitStop(A, A.juiceK.stopHit);
  if (A.inBullets) A.mercy = true;                        // inside the bullet loop: cleared once it is done
  else clearBullets(A, 2, p.x, p.y, p.mercyR);
  A.combo = 0; A.comboT = 0;
  burst(A, p.x, p.y, 3, 1);
  A.out.push({ type: "ouch", x: p.x, y: p.y, hp: p.hp, shield: shielded, from });
  if (p.hp <= 0) { A.ko = true; p.vx = 0; p.vy = 0; A.out.push({ type: "ko", x: p.x, y: p.y }); }
  return true;
}

export function heal(A, n = 1) {
  const p = A.p, before = p.hp;
  p.hp = Math.min(p.hpMax, p.hp + n);
  return p.hp - before;
}

function stepPlayer(A, it) {
  const p = A.p, D = A.dash;
  p.inv = Math.max(0, p.inv - DT);
  p.dashCd = Math.max(0, p.dashCd - DT);
  p.dashQ = Math.max(0, p.dashQ - DT);
  if (A.ko) return;
  const m = moveOf(it);
  p.mx = m.x; p.my = m.y;
  const mm = Math.hypot(m.x, m.y);
  if (mm > 0.15) p.face = Math.atan2(m.y, m.x);
  if (D && wantsDash(it)) p.dashQ = D.bufferS;
  if (D && p.dashQ > 0 && p.dashCd <= 0 && p.dashT <= 0 && !p.fixed) {
    const a = mm > 0.15 ? Math.atan2(m.y, m.x) : p.face;
    p.dx = Math.cos(a); p.dy = Math.sin(a);
    p.dashT = D.s; p.dashCd = D.cdS; p.dashQ = 0;
    p.inv = Math.max(p.inv, D.invS);
    A.dashes++;
    A.out.push({ type: "dash", x: p.x, y: p.y });
  }
  if (p.fixed) { p.vx = 0; p.vy = 0; return; }
  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - DT);
    p.vx = p.dx * D.speed; p.vy = p.dy * D.speed;
  } else {
    const k = Math.min(1, p.accel * DT);
    p.vx += (m.x * p.speed - p.vx) * k;
    p.vy += (m.y * p.speed - p.vy) * k;
  }
  p.x += p.vx * DT; p.y += p.vy * DT;
  const ar = A.arena;
  if (ar) {
    const dx = p.x - ar.x, dy = p.y - ar.y, d = Math.hypot(dx, dy), lim = ar.r - p.body * 0.8;
    if (d > lim && d > 1e-9) {
      p.x = ar.x + (dx / d) * lim; p.y = ar.y + (dy / d) * lim;
      const vn = (p.vx * dx + p.vy * dy) / d;               // slide along the wall
      if (vn > 0) { p.vx -= (vn * dx) / d; p.vy -= (vn * dy) / d; }
    }
  }
}

// ---- the safe zone (a battle royale): a circle that shrinks from `from` to `to` over [t0, t1]; outside it you lose
// zone.dmg hp every zone.tickS (the i-frames do not block it). setZone(A, null) removes it.
export function setZone(A, z) {
  if (!z) { A.zone = null; return; }
  const from = { x: num(z.x, 0), y: num(z.y, 0), r: Math.max(1, num(z.r, 40)) };
  const to = z.to ? { x: num(z.to.x, from.x), y: num(z.to.y, from.y), r: Math.max(1, num(z.to.r, from.r)) } : { ...from };
  A.zone = { x: from.x, y: from.y, r: from.r, from, to, t0: num(z.t0, A.t), t1: num(z.t1, A.t),
    tickS: num(z.tickS, ACT.zone.tickS), dmg: num(z.dmg, ACT.zone.dmg) };
}
export const inZone = (A, x, y, pad = 0) => !A.zone || Math.hypot(x - A.zone.x, y - A.zone.y) <= A.zone.r - pad;

function stepZone(A) {
  const z = A.zone;
  if (!z) return;
  const u = z.t1 > z.t0 ? clamp((A.t - z.t0) / (z.t1 - z.t0), 0, 1) : A.t >= z.t1 ? 1 : 0;
  z.x = z.from.x + (z.to.x - z.from.x) * u; z.y = z.from.y + (z.to.y - z.from.y) * u; z.r = z.from.r + (z.to.r - z.from.r) * u;
  const p = A.p;
  if (A.ko || inZone(A, p.x, p.y)) { p.zoneT = 0; return; }
  p.zoneT += DT;
  if (p.zoneT >= z.tickS) {
    p.zoneT -= z.tickS;
    p.inv = 0;
    const d = Math.hypot(p.x - z.x, p.y - z.y) || 1;
    hitPlayer(A, z.dmg, "zone", p.x + (p.x - z.x) / d, p.y + (p.y - z.y) / d);    // pushed back toward the zone
  }
}

// ---- bullets

// One bullet. side 1 is yours, 2 a foe's. o: { r, life, dmg, tone, pierce, w (wave amplitude u), wf (rad/s), turn
// (rad/s), acc (1/s: speed grows by acc × speed a second) }. → its slot, or −1 when the pool is full.
export function addBullet(A, side, x, y, vx, vy, o = {}) {
  const B = A.b;
  if (B.n >= B.cap) return -1;
  const i = B.n++;
  B.x[i] = x; B.y[i] = y; B.vx[i] = vx; B.vy[i] = vy;
  B.r[i] = num(o.r, side === 1 ? A.fire ? A.fire.r : 1.1 : 1.4);
  B.life[i] = num(o.life, 6); B.age[i] = 0; B.dmg[i] = num(o.dmg, 1);
  B.w[i] = num(o.w, 0); B.wf[i] = num(o.wf, 0); B.turn[i] = num(o.turn, 0); B.acc[i] = num(o.acc, 0);
  B.side[i] = side; B.tone[i] = TONE[o.tone] !== undefined ? TONE[o.tone] : side === 1 ? 0 : 1;
  B.pierce[i] = clamp(num(o.pierce, 0) | 0, 0, 255); B.last[i] = 0;
  return i;
}

// Clear the bullets of a side (1 yours, 2 a foe's, 0 both) within r of (x, y) (r Infinity: all). → how many.
export function clearBullets(A, side = 2, x = 0, y = 0, r = Infinity) {
  const B = A.b;
  let n = 0;
  for (let i = B.n - 1; i >= 0; i--) {
    if (side && B.side[i] !== side) continue;
    if (r !== Infinity) { const dx = B.x[i] - x, dy = B.y[i] - y; if (dx * dx + dy * dy > r * r) continue; }
    swapOut(B, B_KEYS, i);
    n++;
  }
  return n;
}

// A pattern from (x, y) toward angle `ang` (for ring and spiral, its first bullet's angle). pat: { kind: "aimed" |
// "fan" | "ring" | "spiral" | "wave", n (bullets; aimed: a stack of n at rising speeds), arc (fan and wave: the
// angle between neighbours), arms (spiral), speed, r, tone, life, dmg, w, wf (wave), turn, acc }. Foe bullets (side
// 2) unless pat.side is 1. → bullets made, or −1 when a foe pattern must wait: it would start within p.safeR of you,
// or pass A.bulletCap foe bullets (a foe's gun tries again next step; a stage's own call may skip it).
export function foeBullets(A) {
  let n = 0;
  for (let i = 0; i < A.b.n; i++) if (A.b.side[i] === 2) n++;
  return n;
}
function patternSize(pat) {
  const k = pat && pat.kind;
  if (k === "spiral") return Math.max(1, num(pat.arms, 2) | 0);
  return Math.max(1, num(pat && pat.n, 1) | 0);
}
export function shoot(A, x, y, pat, ang) {
  const kind = pat && pat.kind;
  const side = pat && pat.side === 1 ? 1 : 2;
  if (side === 2) {
    if (!A.ko && Math.hypot(x - A.p.x, y - A.p.y) < A.p.safeR) return -1;
    if (foeBullets(A) + patternSize(pat) > A.bulletCap) return -1;
  }
  const sp = num(pat.speed, 26) * (side === 2 ? A.bulletK : 1);
  const n = Math.max(1, num(pat.n, 1) | 0);
  const o = { r: pat.r, tone: pat.tone, life: pat.life, dmg: pat.dmg, turn: pat.turn, acc: pat.acc, w: pat.w, wf: pat.wf };
  let made = 0;
  const one = (a, s) => { if (addBullet(A, side, x, y, Math.cos(a) * s, Math.sin(a) * s, o) >= 0) made++; };
  switch (kind) {
    case "aimed": for (let k = 0; k < n; k++) one(ang, sp * (1 + 0.14 * k)); break;
    case "fan": case "wave": {
      const arc = num(pat.arc, 0.22);
      for (let k = 0; k < n; k++) one(ang + (k - (n - 1) / 2) * arc, sp);
      break;
    }
    case "ring": for (let k = 0; k < n; k++) one(ang + (k * TAU) / n, sp); break;
    case "spiral": {
      const arms = Math.max(1, num(pat.arms, 2) | 0);
      for (let k = 0; k < arms; k++) one(ang + (k * TAU) / arms, sp);
      break;
    }
    default: break;
  }
  if (made && side === 2) A.out.push({ type: "fire", x, y, kind, n: made });
  return made;
}

// ---- telegraphs

// A telegraph mark: { kind: "line" | "fan" | "ring" | "spot" | "charge", x, y, ang, r (ring and spot radius; fan
// reach), len (line and charge length), w (fan: half angle; line: half width), dur (s), foe (id: it follows that
// foe) }. Shown from now for dur; the view gives its progress p 0..1.
export function addTell(A, spec) {
  if (A.tells.length >= ACT.caps.tells) A.tells.shift();
  const t = { kind: TELLS.includes(spec.kind) ? spec.kind : "spot", x: num(spec.x, 0), y: num(spec.y, 0), ang: num(spec.ang, 0),
    r: Math.max(0.5, num(spec.r, 6)), len: num(spec.len, 40), w: num(spec.w, 1.5), t0: A.t, dur: Math.max(DT, num(spec.dur, 0.6)),
    foe: spec.foe | 0 };
  A.tells.push(t);
  A.out.push({ type: "tell", x: t.x, y: t.y, kind: t.kind });
  return t;
}

const TELL_OF = { aimed: "line", wave: "line", fan: "fan", ring: "ring", spiral: "ring" };

// ---- foes

// spawnFoe(A, spec) → the foe. spec: { kind (a FOE_KINDS name, its look), ai (a BEHAVIOURS name), x, y, r, hp, speed,
// value (score), touch (contact damage, 0 for none), drops: { food, heal (chance), up (chance) }, gun: { pattern
// (see shoot), every (s), tellS, first (s to the first shot), jitter (share), burst, gap (s between burst shots),
// spin (rad per burst shot) } | null, keep (shooter: preferred range), orbit: { r, w (rad/s) }, mass (knock-back
// resistance), boss (true: the stage reads its hp; it is never pushed by others), spawnS (s of the spawn tell: it
// cannot move, shoot or be hit), steer (1/s) }.
export function spawnFoe(A, spec = {}) {
  if (A.foes.length >= ACT.caps.foes) return null;
  const F = A.foeK;
  const hp = Math.max(1, num(spec.hp, 2));
  // never on you: a spawn within p.clearR (or, by the wall, in one of A.keepOut's arcs) moves along the arena's wall
  // to the nearest good place (or straight away from you, well inside it), unless anywhere
  let sx = num(spec.x, 0), sy = num(spec.y, 0);
  const p = A.p, R = p.clearR, ar = A.arena;
  const nearWall = ar && Math.hypot(sx - ar.x, sy - ar.y) > ar.r * 0.6;
  const kept = (x, y) => {
    if (Math.hypot(x - p.x, y - p.y) < R) return false;
    if (!nearWall || !A.keepOut.length) return true;
    const a = Math.atan2(y - ar.y, x - ar.x);
    return A.keepOut.every((k) => Math.abs(Math.atan2(Math.sin(a - k.ang), Math.cos(a - k.ang))) >= k.half);
  };
  if (!spec.anywhere && !kept(sx, sy)) {
    if (nearWall) {
      const r0 = Math.hypot(sx - ar.x, sy - ar.y), a0 = Math.atan2(sy - ar.y, sx - ar.x);
      for (let k = 1; k <= 36; k++) {
        const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.175;
        const qx = ar.x + Math.cos(a) * r0, qy = ar.y + Math.sin(a) * r0;
        if (kept(qx, qy)) { sx = qx; sy = qy; break; }
      }
    } else {
      const d = Math.hypot(sx - p.x, sy - p.y) || 1e-6, ux = d > 1e-3 ? (sx - p.x) / d : 1, uy = d > 1e-3 ? (sy - p.y) / d : 0;
      sx = p.x + ux * R; sy = p.y + uy * R;
    }
  }
  const f = {
    id: A.nextId++, kind: FOE_KINDS.includes(spec.kind) ? spec.kind : "germ",
    ai: BEHAVIOURS.includes(spec.ai) ? spec.ai : "chase",
    x: sx, y: sy, vx: num(spec.vx, 0), vy: num(spec.vy, 0), r: Math.max(0.5, num(spec.r, 2.6)),
    hp, hpMax: hp, speed: num(spec.speed, 12), steer: num(spec.steer, F.steer), value: num(spec.value, 10),
    touch: num(spec.touch, 1), drops: spec.drops || null, gun: spec.gun || null, keep: num(spec.keep, 30),
    orbit: spec.orbit || null, mass: Math.max(0.2, num(spec.mass, 1)), boss: !!spec.boss,
    in: Math.max(0, num(spec.spawnS, F.spawnS)), in0: Math.max(DT, num(spec.spawnS, F.spawnS)), age: 0, flash: 0, ang: num(spec.ang, 0), phase: 0,
    cool: spec.gun ? num(spec.gun.first, num(spec.gun.every, 2)) : 0, aim: null, bn: 0, bt: 0, bang: 0,
    wob: A.rnd() * TAU, dir: A.rnd() < 0.5 ? -1 : 1, mercy: 0,
  };
  A.foes.push(f);
  A.spawned++;
  A.value += f.value;
  if (f.in > 0) addTell(A, { kind: "spot", x: f.x, y: f.y, r: f.r + 1.5, dur: f.in, foe: f.id });
  return f;
}

// A point on the arena's wall at angle a, `inset` u inside it.
export function rimPoint(A, a, inset = 3) {
  const ar = A.arena || { x: 0, y: 0, r: 46 };
  return { x: ar.x + Math.cos(a) * (ar.r - inset), y: ar.y + Math.sin(a) * (ar.r - inset) };
}

// The nearest active foe to (x, y) within range (spawning ones do not count), or null.
export function nearestFoe(A, x, y, range = Infinity) {
  let best = null, bd = range * range;
  for (const f of A.foes) {
    if (f.in > 0 || f.hp <= 0) continue;
    const dx = f.x - x, dy = f.y - y, d = dx * dx + dy * dy - f.r * f.r;
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

function aimAt(A, f) { return Math.atan2(A.p.y - f.y, A.p.x - f.x); }

function stepGun(A, f) {
  const g = f.gun;
  if (!g || A.ko) return;
  const pat = g.pattern || { kind: "aimed" };
  if (f.bn > 0) {                                      // a burst under way (spirals)
    f.bt -= DT;
    while (f.bn > 0 && f.bt <= 0) {
      if (shoot(A, f.x, f.y, pat, f.bang) < 0) { f.bt = 0; return; }       // blocked: the burst waits
      f.bang += num(g.spin, 0.3);
      f.bn--;
      f.bt += num(g.gap, 0.1);
    }
    return;
  }
  f.cool -= DT;
  const tellS = num(g.tellS, 0.6);
  if (f.aim === null && f.cool <= tellS) {
    f.aim = pat.kind === "ring" || pat.kind === "spiral" ? A.rnd() * TAU : aimAt(A, f);
    const kind = TELL_OF[pat.kind] || "line";
    addTell(A, { kind, x: f.x, y: f.y, ang: f.aim, r: f.r + 5, len: 46, w: kind === "fan" ? ((num(pat.n, 3) - 1) / 2) * num(pat.arc, 0.22) + 0.08 : 1.2,
      dur: Math.max(DT, f.cool), foe: f.id });
  }
  if (f.cool <= 0) {
    const a = f.aim === null ? aimAt(A, f) : f.aim;
    const burst = Math.max(1, num(g.burst, 1) | 0);
    if (shoot(A, f.x, f.y, pat, a) < 0) { f.cool = 0; return; }             // blocked: it waits, aim kept
    if (burst > 1) { f.bn = burst - 1; f.bt = num(g.gap, 0.1); f.bang = a + num(g.spin, 0.3); }
    const j = num(g.jitter, 0.15);
    f.cool += Math.max(0.2, num(g.every, 2) * (1 + j * (2 * A.rnd() - 1)));
    f.aim = null;
  }
}

function stepFoe(A, f) {
  f.age += DT;
  f.flash = Math.max(0, f.flash - DT / 0.12);
  f.mercy = Math.max(0, f.mercy - DT);
  if (f.in > 0) { f.in = Math.max(0, f.in - DT); return; }
  const p = A.p, F = A.foeK;
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1e-6;
  let tx = 0, ty = 0, steer = f.steer;
  switch (f.ai) {
    case "chase": tx = (dx / d) * f.speed; ty = (dy / d) * f.speed; break;
    case "wander": {
      f.wob += (A.rnd() - 0.5) * 3 * DT * 4;
      tx = Math.cos(f.wob) * f.speed; ty = Math.sin(f.wob) * f.speed;
      steer = 1.5;
      break;
    }
    case "orbit": {
      const R = f.orbit ? num(f.orbit.r, 26) : 26, w = f.orbit ? num(f.orbit.w, 0.6) : 0.6;
      f.ang = Math.atan2(f.y - p.y, f.x - p.x) + f.dir * w * DT * 4;
      const gx = p.x + Math.cos(f.ang) * R, gy = p.y + Math.sin(f.ang) * R;
      const ex = gx - f.x, ey = gy - f.y, e = Math.hypot(ex, ey) || 1e-6;
      const s = Math.min(f.speed, e * 3);
      tx = (ex / e) * s; ty = (ey / e) * s;
      break;
    }
    case "shooter": {
      const k = d > f.keep + 6 ? 1 : d < f.keep - 6 ? -1 : 0;
      const strafe = 0.55 * f.dir;
      tx = ((dx / d) * k + (-dy / d) * strafe * (k === 0 ? 1 : 0.4)) * f.speed;
      ty = ((dy / d) * k + (dx / d) * strafe * (k === 0 ? 1 : 0.4)) * f.speed;
      break;
    }
    default: steer = F.drag; tx = 0; ty = 0; break;      // still: the stage moves it (velocity eases to 0)
  }
  if (!(f.ai === "still" && f.boss)) {             // a still boss: the stage sets its velocity
    const k = Math.min(1, steer * DT);
    f.vx += (tx - f.vx) * k; f.vy += (ty - f.vy) * k;
  }
  f.x += f.vx * DT; f.y += f.vy * DT;
  if (f.ai !== "chase" && f.ai !== "still") f.ang = Math.atan2(f.vy, f.vx);
  else if (f.ai === "chase") f.ang = Math.atan2(dy, dx);
  const ar = A.arena;
  if (ar) {
    const ex = f.x - ar.x, ey = f.y - ar.y, e = Math.hypot(ex, ey), lim = ar.r - f.r * 0.6;
    if (e > lim && e > 1e-9) {
      f.x = ar.x + (ex / e) * lim; f.y = ar.y + (ey / e) * lim;
      const vn = (f.vx * ex + f.vy * ey) / e;
      if (vn > 0) { f.vx -= (2 * vn * ex) / e; f.vy -= (2 * vn * ey) / e; f.wob += Math.PI; f.dir = -f.dir; }
    }
  }
  stepGun(A, f);
  // contact
  if (f.touch > 0 && !A.ko && f.mercy <= 0) {
    const rr = p.r + f.r * 0.85;
    if (dx * dx + dy * dy < rr * rr) {
      if (hitPlayer(A, f.touch, f.id, f.x, f.y)) {
        f.vx -= (dx / d) * 30 / f.mass; f.vy -= (dy / d) * 30 / f.mass;
        f.mercy = F.mercyS;
      }
    }
  }
}

// Foes push apart a little, so a crowd reads as many.
function separate(A) {
  const fs = A.foes, n = fs.length, k = A.foeK.sep;
  for (let i = 0; i < n; i++) {
    const a = fs[i];
    if (a.in > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = fs[j];
      if (b.in > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), push = ((rr - d) / d) * 0.5 * k;
      const wa = a.boss ? 0 : b.boss ? 1 : b.mass / (a.mass + b.mass), wb = 1 - wa;
      a.x -= dx * push * wa * 2; a.y -= dy * push * wa * 2;
      b.x += dx * push * wb * 2; b.y += dy * push * wb * 2;
    }
  }
}

// A foe is cleared: the combo, its value times the combo's multiplier as score, its drops, the juice.
function clearFoe(A, f) {
  A.kills++;
  A.combo++;
  A.comboT = A.comboK.s;
  A.bestCombo = Math.max(A.bestCombo, A.combo);
  const gain = Math.round(f.value * comboMult(A));
  A.score += gain;
  A.cleared += f.value;
  const dr = f.drops || {};
  const nf = num(dr.food, 0) | 0;
  if (nf > 0) drop(A, "food", f.x, f.y, nf, 1);
  if (fin(dr.heal) && A.rnd() < dr.heal) drop(A, "heal", f.x, f.y, 1, 1);
  if (fin(dr.up) && A.rnd() < dr.up) drop(A, "up", f.x, f.y, 1, 1);
  const big = f.boss || f.r >= 5;
  burst(A, f.x, f.y, f.r, 0);
  shake(A, big ? A.juiceK.shakeBig : A.juiceK.shakeClear);
  if (big) hitStop(A, A.juiceK.stopBig);
  const at = A.foes.indexOf(f);
  if (at >= 0) A.foes.splice(at, 1);
  A.out.push({ type: "clear", id: f.id, kind: f.kind, x: f.x, y: f.y, value: f.value, gain, combo: A.combo, boss: f.boss });
}

// Remove a foe without a clear (it drifts away; the stage's choice). → true when it was there.
export function removeFoe(A, id) {
  const i = A.foes.findIndex((f) => f.id === id);
  if (i < 0) return false;
  A.foes.splice(i, 1);
  return true;
}

// Damage a foe (your bullets, or the stage's own hits: a charge, a zone). → true when it was cleared (and so taken
// out of A.foes).
export function damageFoe(A, f, dmg, kx = 0, ky = 0) {
  if (!f || f.hp <= 0 || f.in > 0) return false;
  f.hp -= dmg;
  f.flash = 1;
  if (!f.boss) { f.vx += kx / f.mass; f.vy += ky / f.mass; }
  A.strikes++;
  A.out.push({ type: "strike", id: f.id, x: f.x, y: f.y, boss: f.boss });
  if (f.hp <= 0) { clearFoe(A, f); return true; }
  return false;
}

// ---- auto-fire

function stepFire(A) {
  const F = A.fire, p = A.p;
  if (!F || A.ko) return;
  F.cool = Math.max(-DT, F.cool - DT);
  if (F.cool > 0) return;
  const f = nearestFoe(A, p.x, p.y, F.range);
  if (!f) { F.cool = 0; return; }
  // lead the target a little, so a moving foe is met
  const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1e-6;
  const tHit = d / F.speed;
  const a = Math.atan2(dy + f.vy * tHit, dx + f.vx * tHit);
  const n = Math.max(1, F.spread | 0);
  for (let k = 0; k < n; k++) {
    const b = a + (k - (n - 1) / 2) * F.arc;
    addBullet(A, 1, p.x, p.y, Math.cos(b) * F.speed, Math.sin(b) * F.speed, { r: F.r, life: F.life, dmg: F.dmg, pierce: F.pierce, tone: "you" });
  }
  A.shots++;
  F.cool += 1 / Math.max(0.1, F.rate);
  A.out.push({ type: "shot", x: p.x, y: p.y });
}

// ---- bullets in flight

function stepBullets(A) {
  const B = A.b, p = A.p, ar = A.arena, fs = A.foes;
  A.inBullets = true;
  for (let i = Math.min(B.n, B.cap) - 1; i >= 0; i--) {
    if (i >= B.n) continue;
    B.age[i] += DT;
    if (B.age[i] >= B.life[i]) { swapOut(B, B_KEYS, i); continue; }
    let vx = B.vx[i], vy = B.vy[i];
    if (B.turn[i] !== 0) {
      const c = Math.cos(B.turn[i] * DT), s = Math.sin(B.turn[i] * DT);
      const nx = vx * c - vy * s; vy = vx * s + vy * c; vx = nx;
    }
    if (B.acc[i] !== 0) { const k = 1 + B.acc[i] * DT; vx *= k; vy *= k; }
    B.vx[i] = vx; B.vy[i] = vy;
    let mx = vx, my = vy;
    if (B.w[i] !== 0) {                      // a wave: a sine across its path, as a velocity
      const s = Math.hypot(vx, vy) || 1e-6, c = B.w[i] * B.wf[i] * Math.cos(B.wf[i] * B.age[i]);
      mx += (-vy / s) * c; my += (vx / s) * c;
    }
    const x = (B.x[i] += mx * DT), y = (B.y[i] += my * DT);
    if (ar) { const dx = x - ar.x, dy = y - ar.y; if (dx * dx + dy * dy > (ar.r + 6) * (ar.r + 6)) { swapOut(B, B_KEYS, i); continue; } }
    const r = B.r[i];
    if (B.side[i] === 1) {
      let gone = false;
      for (let j = 0; j < fs.length; j++) {
        const f = fs[j];
        if (f.in > 0 || f.hp <= 0 || f.id === B.last[i]) continue;
        const dx = f.x - x, dy = f.y - y, rr = f.r + r;
        if (dx * dx + dy * dy >= rr * rr) continue;
        const s = Math.hypot(vx, vy) || 1e-6, kb = A.fire ? A.fire.kb : 6;
        if (damageFoe(A, f, B.dmg[i], (vx / s) * kb, (vy / s) * kb)) j--;
        if (B.pierce[i] > 0) { B.pierce[i]--; B.last[i] = f.id; } else { gone = true; break; }
      }
      if (gone) swapOut(B, B_KEYS, i);
    } else if (!A.ko && p.inv <= 0) {
      const dx = p.x - x, dy = p.y - y, rr = p.r + r;
      if (dx * dx + dy * dy < rr * rr) {
        const dmg = B.dmg[i], bx = x - vx, by = y - vy;           // pushed along the bullet's flight
        swapOut(B, B_KEYS, i);
        hitPlayer(A, dmg, "bullet", bx, by);
      }
    }
  }
  A.inBullets = false;
  if (A.mercy) { A.mercy = false; clearBullets(A, 2, p.x, p.y, p.mercyR); }
}

// ---- pickups

// Drop n pickups of a kind ("food" | "heal" | "up") round (x, y), each worth v. → how many fit in the pool.
export function drop(A, kind, x, y, n = 1, v = 1) {
  const K = A.k, id = PICK[kind] !== undefined ? PICK[kind] : 0;
  let made = 0;
  for (let k = 0; k < n; k++) {
    if (K.n >= K.cap) break;
    const i = K.n++;
    const a = A.rnd() * TAU, s = 6 + 10 * A.rnd();
    K.x[i] = x; K.y[i] = y; K.vx[i] = Math.cos(a) * s; K.vy[i] = Math.sin(a) * s;
    K.v[i] = v; K.age[i] = 0; K.life[i] = A.pick.lifeS; K.kind[i] = id;
    made++;
  }
  return made;
}

// Pull every pickup to you (a wave's end): its magnet reach becomes the whole arena for `s` seconds.
export function vacuum(A, s = 1.2) { A.pick.vacT = Math.max(A.pick.vacT || 0, s); }

function stepPickups(A) {
  const K = A.k, p = A.p, P = A.pick;
  P.vacT = Math.max(0, (P.vacT || 0) - DT);
  const reach = P.vacT > 0 ? 1e4 : P.magnet;
  for (let i = K.n - 1; i >= 0; i--) {
    K.age[i] += DT;
    if (K.age[i] >= K.life[i]) { swapOut(K, K_KEYS, i); continue; }
    const dx = p.x - K.x[i], dy = p.y - K.y[i], d = Math.hypot(dx, dy) || 1e-6;
    if (!A.ko && d < reach && K.age[i] > 0.25) {
      const s = P.pull * (P.vacT > 0 ? 1.6 : 1);
      K.vx[i] += ((dx / d) * s - K.vx[i]) * Math.min(1, 8 * DT);
      K.vy[i] += ((dy / d) * s - K.vy[i]) * Math.min(1, 8 * DT);
    } else {
      const k = Math.max(0, 1 - P.drag * DT);
      K.vx[i] *= k; K.vy[i] *= k;
    }
    K.x[i] += K.vx[i] * DT; K.y[i] += K.vy[i] * DT;
    if (!A.ko && d < p.body + P.r) {
      const kind = PICKS[K.kind[i]], v = K.v[i], x = K.x[i], y = K.y[i];
      swapOut(K, K_KEYS, i);
      A.picks++;
      if (kind === "food") A.food += v;
      else if (kind === "heal") heal(A, v);
      A.out.push({ type: "pick", kind, v, x, y });
    }
  }
}

// ---- one step

// stepWorld(A, intents): one fixed step (DT). A.out holds this step's outcomes, in order: { type: "dash" | "shot" |
// "fire" (a foe pattern) | "tell" | "strike" (your hit on a foe) | "clear" (a foe cleared: value, gain, combo) |
// "ouch" (you were hit: hp) | "ko" | "pick" (kind, v), x, y, ... }. Under a hit-stop the world holds still for its
// frames (a dash pressed then is kept for when it moves on); A.t counts only the steps that moved. → true when the
// world moved this step (false under a hit-stop: a stage's own timers that count steps should wait too).
export function stepWorld(A, intents) {
  A.out.length = 0;
  A.step++;
  const J = A.juice, K = A.juiceK;
  J.shake = Math.max(0, J.shake - K.decay * DT);
  J.flash = Math.max(0, J.flash - K.flashDecay * DT);
  if (J.stop > 0) {
    J.stop--;
    if (A.dash && wantsDash(intents)) A.p.dashQ = A.dash.bufferS + J.stop * DT;
    return false;
  }
  A.t += DT;
  stepPlayer(A, intents);
  stepZone(A);
  stepFire(A);
  for (let i = 0; i < A.foes.length; i++) stepFoe(A, A.foes[i]);
  separate(A);
  stepBullets(A);
  stepPickups(A);
  for (let i = A.tells.length - 1; i >= 0; i--) {
    const t = A.tells[i];
    if (t.foe) {
      const f = A.foes.find((g) => g.id === t.foe);
      if (!f) { A.tells.splice(i, 1); continue; }
      t.x = f.x; t.y = f.y;
    }
    if (A.t - t.t0 >= t.dur) A.tells.splice(i, 1);
  }
  for (let i = A.pops.length - 1; i >= 0; i--) { const q = A.pops[i]; q.age += DT; q.y += 9 * DT; if (q.age >= ACT.popS) A.pops.splice(i, 1); }
  for (let i = A.bursts.length - 1; i >= 0; i--) { const q = A.bursts[i]; q.age += DT; if (q.age >= ACT.burstS) A.bursts.splice(i, 1); }
  if (A.comboT > 0) { A.comboT -= DT; if (A.comboT <= 0) { A.comboT = 0; A.combo = 0; } }
  return true;
}

// ---- the wave spawner

// makeWaves(list) → W. list: [{ at (s, world time A.t), ...a spawnFoe spec, ang (a rim angle: x, y from rimPoint
// when x is not given), inset, n (a group of n spread over spread rad along the rim), spread }].
export function makeWaves(list) {
  const rows = (Array.isArray(list) ? list : []).filter((e) => e && fin(e.at)).slice().sort((a, b) => a.at - b.at);
  return { rows, i: 0 };
}

// Spawn every row whose time has come. → the foes made.
export function spawnDue(A, W) {
  const made = [];
  while (W.i < W.rows.length && W.rows[W.i].at <= A.t + 1e-9) {
    const e = W.rows[W.i++];
    const n = Math.max(1, num(e.n, 1) | 0);
    for (let k = 0; k < n; k++) {
      const spec = { ...e };
      if (!fin(e.x) || !fin(e.y)) {
        const a = num(e.ang, A.rnd() * TAU) + (n > 1 ? (k - (n - 1) / 2) * num(e.spread, 0.3) : 0);
        const q = rimPoint(A, a, num(e.inset, 4));
        spec.x = q.x; spec.y = q.y;
      }
      const f = spawnFoe(A, spec);
      if (f) made.push(f);
    }
  }
  return made;
}
export const wavesDone = (W) => W.i >= W.rows.length;
export const foesLeft = (A) => A.foes.length;

// ---- events for the host

// The sound one-shots of this step's outcomes, as sfx events ("act.<type>", throttled: shots 0.09 s, strikes 0.05 s,
// fire 0.08 s, tells 0.15 s apart). → how many were sent.
const SFX_GAP = { shot: 0.09, strike: 0.05, fire: 0.08, tell: 0.15, pick: 0.05 };
export function emitOut(A, st) {
  let n = 0;
  for (const o of A.out) {
    const gap = SFX_GAP[o.type] || 0;
    const last = A.sfxAt[o.type];
    if (gap && fin(last) && A.t - last < gap) continue;
    A.sfxAt[o.type] = A.t;
    const extra = o.type === "clear" ? { pitch: Math.min(8, o.combo | 0), gain: o.boss ? 1 : 0.6 } : o.type === "pick" ? { pitch: o.kind === "food" ? 0 : 1 } : {};
    emit(st, "sfx", { id: "act." + o.type, x: o.x, y: o.y, ...extra });
    n++;
  }
  return n;
}

// ---- the picture

// actionView(A, { player = true }) → the draw list's `action` part (core/draw.js): fresh arrays, A unchanged.
export function actionView(A, { player = true } = {}) {
  const B = A.b, K = A.k, p = A.p;
  const nb = B.n;
  const xy = new Float32Array(2 * nb), r = new Float32Array(nb), tone = new Uint8Array(nb), ang = new Float32Array(nb);
  for (let i = 0; i < nb; i++) {
    xy[2 * i] = B.x[i]; xy[2 * i + 1] = B.y[i]; r[i] = B.r[i]; tone[i] = B.tone[i]; ang[i] = Math.atan2(B.vy[i], B.vx[i]);
  }
  const nk = K.n;
  const kxy = new Float32Array(2 * nk), kind = new Uint8Array(nk), ka = new Float32Array(nk);
  for (let i = 0; i < nk; i++) {
    kxy[2 * i] = K.x[i]; kxy[2 * i + 1] = K.y[i]; kind[i] = K.kind[i];
    const left = K.life[i] - K.age[i];
    ka[i] = left < 1.5 ? 0.35 + 0.65 * Math.abs(Math.cos(left * 9)) : 1;      // a blink before it fades
  }
  const foes = A.foes.map((f) => ({
    kind: f.kind, x: f.x, y: f.y, r: f.r, ang: fin(f.ang) ? f.ang : 0, hp: clamp(f.hp / f.hpMax, 0, 1),
    flash: clamp(f.flash, 0, 1), born: f.in > 0 ? clamp(1 - f.in / f.in0, 0, 1) : 1,
    // the wind-up: 0 to 1 over the gun's tell before a shot (its core swells)
    charge: f.gun && f.aim !== null ? clamp(1 - f.cool / Math.max(DT, num(f.gun.tellS, 0.6)), 0, 1) : 0,
    boss: f.boss, phase: f.phase | 0,
  }));
  const tells = A.tells.map((t) => ({ kind: t.kind, x: t.x, y: t.y, ang: t.ang, r: t.r, len: t.len, w: t.w,
    p: clamp((A.t - t.t0) / t.dur, 0, 1) }));
  const pops = A.pops.map((q) => ({ x: q.x, y: q.y, v: q.v, a: clamp(1 - q.age / ACT.popS, 0, 1), combo: q.combo }));
  const bursts = A.bursts.map((q) => ({ x: q.x, y: q.y, r: q.r, age: clamp(q.age / ACT.burstS, 0, 1), kind: q.k, rot: q.rot }));
  const D = A.dash;
  const you = player && !A.ko ? {
    x: p.x, y: p.y, r: p.r, body: p.body, ang: p.face,
    inv: p.inv > 0 ? clamp(p.inv / Math.max(DT, p.invS), 0, 1) : 0,
    dash: D && p.dashT > 0 ? clamp(p.dashT / D.s, 0, 1) : 0,
    ready: D ? (p.dashCd <= 0 ? 1 : clamp(1 - p.dashCd / D.cdS, 0, 1)) : 0,
  } : null;
  const z = A.zone;
  return {
    bullets: { n: nb, xy, r, tone, ang },
    foes,
    pickups: { n: nk, xy: kxy, kind, a: ka },
    player: you,
    zone: z ? { x: z.x, y: z.y, r: z.r, next: { x: z.to.x, y: z.to.y, r: z.to.r } } : null,
    tells,
    pops,
    bursts,
    hp: { n: Math.min(HP_PIPS, Math.max(0, Math.round(p.hp))), max: Math.min(HP_PIPS, Math.max(1, Math.round(p.hpMax))),
      shield: Math.min(2, p.shield) },
    shake: clamp(A.juice.shake, 0, 1),
    flash: clamp(A.juice.flash, 0, 1),
    combo: A.combo,
  };
}
