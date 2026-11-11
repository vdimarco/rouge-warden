// Frostwing: the match simulation. No rendering and no DOM, so node tests and bots can run whole matches.
// The renderer (game.js) reads this state each frame and turns the events into sound, sparks and HUD lines.
// Units: one unit is about one metre. Ships face -Z at yaw 0. Heading and pitch are radians.

export const ARENA = 1100; // half width of the combat area
export const CEILING = 460;
export const MATCH_TIME = 240; // seconds
export const WAVE_EVERY = 50; // a meteor shower starts every 50 s
export const WAVE_LEN = 24;
export const RESPAWN = 4;
export const SCORE = { kill: 10, orb: 5, wave: 25 };

export const TEAMS = [
  { id: 0, name: "LANTERN SQUADRON", short: "LANTERN", color: "#46b8ff" },
  { id: 1, name: "CORVID PACK", short: "CORVID", color: "#b06bff" },
];

// shield: hit points. speed: cruise multiplier. dmg: laser damage multiplier. regen: boost refill multiplier.
// lock: seconds to fill a charged shot. bombs: bombs at launch (and the cap is bombs + 1).
export const PILOTS = {
  juno: { id: "juno", team: 0, name: "Juno Reyes", call: "LANTERN ONE", role: "Squad leader", shield: 100, speed: 1, dmg: 1, regen: 1, lock: 0.65, bombs: 1, volley: 1,
    perk: "Locks on fastest. Her charged shot fills in 0.65 s." },
  pip: { id: "pip", team: 0, name: "Pip Okafor", call: "SPARK", role: "Speed ace", shield: 80, speed: 1.13, dmg: 0.9, regen: 1.6, lock: 0.95, bombs: 1, volley: 1, roll: 0.55,
    perk: "Fastest ship. Boost refills 60% faster and rolls come back sooner." },
  brann: { id: "brann", team: 0, name: "Brann Hale", call: "ANVIL", role: "Heavy gunner", shield: 145, speed: 0.9, dmg: 1.12, regen: 0.9, lock: 1, bombs: 2, volley: 1,
    perk: "Thickest shield. Starts with two bombs and holds three." },
  silas: { id: "silas", team: 0, name: "Silas Vane", call: "OLD LANTERN", role: "Veteran ace", shield: 115, speed: 1, dmg: 1.1, regen: 1, lock: 0.9, bombs: 1, volley: 3,
    perk: "Founder of Lantern Squadron. His charged shot is a three-bolt volley, and allies near him repair faster." },
  vex: { id: "vex", team: 1, name: "Vex Morrow", call: "CORVID LEAD", role: "Pack leader", shield: 115, speed: 1.02, dmg: 1.1, regen: 1, lock: 0.8, bombs: 1, volley: 1 },
  nyra: { id: "nyra", team: 1, name: "Nyra Kade", call: "QUILL", role: "Hunter", shield: 85, speed: 1.12, dmg: 0.95, regen: 1.5, lock: 0.9, bombs: 1, volley: 1, roll: 0.55 },
  grell: { id: "grell", team: 1, name: "Grell", call: "TALON", role: "Bruiser", shield: 140, speed: 0.9, dmg: 1.1, regen: 0.9, lock: 1, bombs: 2, volley: 1 },
  sable: { id: "sable", team: 1, name: "Sable", call: "HUSH", role: "Wing", shield: 100, speed: 1, dmg: 1, regen: 1, lock: 0.85, bombs: 1, volley: 1 },
};
export const LANTERN = ["juno", "pip", "brann", "silas"];
export const CORVID = ["vex", "nyra", "grell", "sable"];

// aim: random aim error in radians. think: seconds between target choices. cone: half-angle to open fire.
// skill also sets how often a hunted ship rolls or turns away.
export const DIFFICULTY = {
  cadet: { label: "Cadet", aim: 0.09, think: 1.4, cone: 0.1, dodge: 0.25, foeDmg: 0.6, react: 0.5 },
  ace: { label: "Ace", aim: 0.05, think: 0.9, cone: 0.13, dodge: 0.5, foeDmg: 0.85, react: 0.3 },
  veteran: { label: "Veteran", aim: 0.025, think: 0.6, cone: 0.16, dodge: 0.8, foeDmg: 1.05, react: 0.15 },
};

const BASE_SPEED = 135, BOOST_SPEED = 255, BRAKE_SPEED = 70;
const YAW_RATE = 1.55, PITCH_RATE = 1.35, MAX_PITCH = 1.2;
const LASER_SPEED = 950, LASER_LIFE = 0.95, LASER_DMG = 7, FIRE_GAP = 0.11;
const CHARGE_DMG = 38, CHARGE_SPEED = 620;
const SHIP_R = 8, METEOR_R = [14, 26];

/* ---------------- random, noise, terrain ---------------- */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hash(x, z) { let h = (x * 374761393 + z * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fractal value noise, ridged in the upper octaves for knife-edge snow ridges
function fbm(x, z) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < 5; i++) {
    let n = vnoise(x * f, z * f);
    if (i > 1) n = 1 - Math.abs(n * 2 - 1);
    sum += n * amp; norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}
// ground height in world units at (x, z). A wide valley floor, rolling drifts, rock ridges, and a ring of high
// peaks past the edge of the combat area so the arena reads as a bowl.
export function groundY(x, z) {
  const n = fbm(x / 420 + 7.3, z / 420 - 2.1);
  const d = Math.hypot(x, z) / ARENA;
  const ring = Math.max(0, d - 0.82);
  const rim = ring * ring * 1500 + ring * 260;
  const ridge = Math.pow(n, 2.6) * 190;
  return -10 + n * 40 + ridge + rim;
}

// tilted monolith slabs and old gate frames. Each is a vertical cylinder for collisions.
export function makeRuins(seed = 7) {
  const r = rng(seed), out = [];
  const spots = [[180, -260], [-320, 140], [420, 380], [-120, 520], [600, -420], [-640, -300], [80, 60], [-520, 620], [700, 160], [-300, -640], [300, -700], [-760, 80]];
  for (const [x, z] of spots) {
    const kind = r() < 0.3 ? "gate" : "slab";
    const h = kind === "gate" ? 120 + r() * 50 : 60 + r() * 70;
    out.push({ kind, x, z, y: groundY(x, z) - 6, h, r: kind === "gate" ? 30 : 18 + r() * 8, tilt: (r() - 0.5) * 0.5, turn: r() * Math.PI * 2 });
  }
  return out;
}

/* ---------------- vectors ---------------- */
const len = (x, y, z) => Math.hypot(x, y, z);
export function forward(yaw, pitch) { const c = Math.cos(pitch); return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c }; }
export function angleWrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
// yaw and pitch that face along (dx, dy, dz)
export function aimAngles(dx, dy, dz) { return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; }
// where to aim to hit a target moving at constant velocity with a bolt of speed s (first-order intercept)
export function leadPoint(sx, sy, sz, t, s) {
  const dx = t.x - sx, dy = t.y - sy, dz = t.z - sz;
  const a = t.vx * t.vx + t.vy * t.vy + t.vz * t.vz - s * s;
  const b = 2 * (dx * t.vx + dy * t.vy + dz * t.vz);
  const c = dx * dx + dy * dy + dz * dz;
  let tt;
  if (Math.abs(a) < 1e-6) tt = -c / b;
  else { const disc = b * b - 4 * a * c; if (disc < 0) tt = len(dx, dy, dz) / s; else { const r = Math.sqrt(disc); const t1 = (-b - r) / (2 * a), t2 = (-b + r) / (2 * a); tt = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2); } }
  if (!(tt > 0) || tt > 3) tt = len(dx, dy, dz) / s;
  return { x: t.x + t.vx * tt, y: t.y + t.vy * tt, z: t.z + t.vz * tt, t: tt };
}
// closest approach of segment p->p+d to point c, squared
function segDist2(px, py, pz, dx, dy, dz, cx, cy, cz) {
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 0 ? ((cx - px) * dx + (cy - py) * dy + (cz - pz) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = px + dx * t - cx, y = py + dy * t - cy, z = pz + dz * t - cz;
  return x * x + y * y + z * z;
}

/* ---------------- the match ---------------- */
export function createMatch(opts = {}) {
  const seed = opts.seed ?? (Date.now() & 0xffffff);
  const rand = rng(seed);
  const diff = DIFFICULTY[opts.difficulty] || DIFFICULTY.ace;
  const playerPilot = opts.pilot === null ? null : (opts.pilot || "juno");
  const m = {
    seed, rand, diff, time: MATCH_TIME, elapsed: 0, over: false, winner: -1,
    score: [0, 0], ships: [], bolts: [], bombs: [], meteors: [], orbs: [], events: [],
    ruins: makeRuins(), wave: { on: false, t: WAVE_EVERY - 18, n: 0, energy: [0, 0] },
    player: null, nextId: 1,
  };
  const roster = [...LANTERN.map((p) => [p, 0]), ...CORVID.map((p) => [p, 1])];
  roster.forEach(([pid, team], i) => {
    const P = PILOTS[pid];
    const s = {
      id: m.nextId++, pilot: pid, name: P.name, call: P.call, team, human: pid === playerPilot, slot: i % 4,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, bank: 0, speed: BASE_SPEED * P.speed,
      shield: P.shield, maxShield: P.shield, boost: 1, bombs: P.bombs, charge: 0, lock: null, fireCd: 0, rollCd: 0, roll: 0, rollDir: 0,
      uturn: 0, uturnYaw: 0, alive: true, respawn: 0, invuln: 2, kills: 0, deaths: 0, energy: 0, lastHitBy: null, hitFlash: 0, warn: 0,
      input: { pitch: 0, yaw: 0, fire: false, charge: false, boost: false, brake: false, bomb: false, rollL: false, rollR: false, uturn: false },
      prevCharge: false, prevBomb: false, ai: { target: null, think: rand() * diff.think, wobble: rand() * 10, mode: "hunt", evade: 0 },
    };
    spawn(m, s, true);
    m.ships.push(s);
    if (s.human) m.player = s;
  });
  return m;
}

function spawn(m, s, first) {
  const side = s.team === 0 ? 1 : -1;
  const x = (s.slot - 1.5) * 70 + (first ? 0 : (m.rand() - 0.5) * 300);
  const z = side * (ARENA * 0.78);
  s.x = x; s.z = z; s.y = Math.max(groundY(x, z) + 120, 150);
  s.yaw = side > 0 ? 0 : Math.PI; s.pitch = 0; s.bank = 0;
  s.speed = BASE_SPEED * PILOTS[s.pilot].speed;
  s.shield = s.maxShield; s.boost = 1; s.charge = 0; s.lock = null; s.alive = true; s.invuln = 2.5; s.uturn = 0; s.roll = 0;
  s.bombs = Math.max(s.bombs, PILOTS[s.pilot].bombs);
  const f = forward(s.yaw, s.pitch);
  s.vx = f.x * s.speed; s.vy = f.y * s.speed; s.vz = f.z * s.speed;
}

const emit = (m, e) => { m.events.push(e); };
const enemiesOf = (m, s) => m.ships.filter((o) => o.alive && o.team !== s.team);

// the enemy ship nearest the centre of the nose, inside a cone and range
export function findLock(m, s, cone = 0.26, range = 800) {
  const f = forward(s.yaw, s.pitch);
  let best = null, bestScore = Infinity;
  for (const o of enemiesOf(m, s)) {
    const dx = o.x - s.x, dy = o.y - s.y, dz = o.z - s.z, d = len(dx, dy, dz);
    if (d > range || d < 1) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dy * f.y + dz * f.z) / d)));
    if (ang > cone) continue;
    const sc = ang * 600 + d * 0.3;
    if (sc < bestScore) { bestScore = sc; best = o; }
  }
  return best;
}

function damage(m, target, amount, by, kind) {
  if (!target.alive || target.invuln > 0) return;
  let a = amount;
  if (target.roll > 0) a *= 0.2; // a barrel roll turns most bolts away
  if (!target.human && by && by.human === false && target.team === 0) a *= 1; // bots trade at face value
  if (target.human) a *= m.diff.foeDmg;
  target.shield -= a; target.hitFlash = 0.25; target.lastHitBy = by ? by.id : null;
  emit(m, { type: "hit", ship: target.id, by: by ? by.id : 0, amount: a, kind, deflect: target.roll > 0 });
  if (by && by.human) emit(m, { type: "hitmark", ship: target.id });
  if (target.shield <= 0) kill(m, target, by, kind);
}

function kill(m, s, by, kind) {
  s.alive = false; s.shield = 0; s.respawn = RESPAWN; s.deaths++;
  const killer = by && by.team !== s.team ? by : null;
  if (killer) { killer.kills++; m.score[killer.team] += SCORE.kill; }
  else m.score[1 - s.team] += SCORE.kill; // a crash still counts for the other team
  emit(m, { type: "down", ship: s.id, by: killer ? killer.id : 0, kind, x: s.x, y: s.y, z: s.z, team: s.team });
}

function fireLaser(m, s) {
  const P = PILOTS[s.pilot], f = forward(s.yaw, s.pitch);
  // right vector for the two wing guns
  const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  let dx = f.x, dy = f.y, dz = f.z;
  // the player's bolts bend a little toward a ship near the reticle, so the game plays well on a phone
  if (s.human) {
    const t = findLock(m, s, 0.07, 900);
    if (t) {
      const lp = leadPoint(s.x, s.y, s.z, t, LASER_SPEED);
      const ax = lp.x - s.x, ay = lp.y - s.y, az = lp.z - s.z, al = len(ax, ay, az);
      dx = dx * 0.4 + (ax / al) * 0.6; dy = dy * 0.4 + (ay / al) * 0.6; dz = dz * 0.4 + (az / al) * 0.6;
      const l = len(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    }
  }
  for (const side of [-1, 1]) {
    m.bolts.push({ kind: "laser", team: s.team, owner: s.id, x: s.x + rx * side * 4.5 + f.x * 6, y: s.y - 0.6 + f.y * 6, z: s.z + rz * side * 4.5 + f.z * 6,
      vx: dx * LASER_SPEED + s.vx * 0.3, vy: dy * LASER_SPEED + s.vy * 0.3, vz: dz * LASER_SPEED + s.vz * 0.3, life: LASER_LIFE, dmg: LASER_DMG * P.dmg, target: null });
  }
  emit(m, { type: "fire", ship: s.id, kind: "laser" });
}

function fireCharge(m, s) {
  const P = PILOTS[s.pilot], f = forward(s.yaw, s.pitch);
  const target = s.lock && s.lock.alive ? s.lock : null;
  const n = P.volley;
  for (let i = 0; i < n; i++) {
    const spread = n > 1 ? (i - (n - 1) / 2) * 0.22 : 0;
    const rx = Math.cos(s.yaw + spread), rz = -Math.sin(s.yaw + spread);
    const g = forward(s.yaw + spread, s.pitch + (n > 1 && i === 1 ? 0.12 : 0));
    m.bolts.push({ kind: "charge", team: s.team, owner: s.id, x: s.x + f.x * 8 + rx * 0.1, y: s.y + f.y * 8, z: s.z + f.z * 8 + rz * 0.1,
      vx: g.x * CHARGE_SPEED + s.vx * 0.5, vy: g.y * CHARGE_SPEED + s.vy * 0.5, vz: g.z * CHARGE_SPEED + s.vz * 0.5, life: 2.4,
      dmg: (n > 1 ? CHARGE_DMG * 0.7 : CHARGE_DMG) * P.dmg, target: target ? target.id : null });
  }
  emit(m, { type: "fire", ship: s.id, kind: "charge", volley: n });
}

function dropBomb(m, s) {
  const f = forward(s.yaw, s.pitch);
  m.bombs.push({ team: s.team, owner: s.id, x: s.x + f.x * 10, y: s.y + f.y * 10, z: s.z + f.z * 10, vx: f.x * 420 + s.vx * 0.4, vy: f.y * 420 + s.vy * 0.4 + 10, vz: f.z * 420 + s.vz * 0.4, life: 1.15 });
  s.bombs--;
  emit(m, { type: "fire", ship: s.id, kind: "bomb" });
}

function explodeBomb(m, b) {
  const by = m.ships.find((o) => o.id === b.owner);
  emit(m, { type: "blast", x: b.x, y: b.y, z: b.z, r: 95, team: b.team });
  for (const o of m.ships) {
    if (!o.alive || o.team === b.team) continue;
    const d = len(o.x - b.x, o.y - b.y, o.z - b.z);
    if (d < 95) damage(m, o, 70 * (1 - d / 140), by, "bomb");
  }
  for (const r of m.meteors) if (len(r.x - b.x, r.y - b.y, r.z - b.z) < 95 + r.r) hitMeteor(m, r, 99, by);
}

function hitMeteor(m, r, dmg, by) {
  r.hp -= dmg;
  emit(m, { type: "rockhit", x: r.x, y: r.y, z: r.z });
  if (r.hp > 0) return;
  r.dead = true;
  emit(m, { type: "rockbreak", x: r.x, y: r.y, z: r.z, r: r.r, by: by ? by.id : 0 });
  const n = r.r > 20 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const a = m.rand() * Math.PI * 2, e = (m.rand() - 0.3) * 1.2;
    const kind = i === 0 && m.rand() < 0.22 ? (m.rand() < 0.5 ? "bomb" : "repair") : "energy";
    m.orbs.push({ kind, x: r.x, y: r.y, z: r.z, vx: Math.cos(a) * 40, vy: e * 30, vz: Math.sin(a) * 40, life: 16, value: 1 });
  }
}

function spawnMeteor(m) {
  const a = m.rand() * Math.PI * 2, d = 150 + m.rand() * (ARENA * 0.62);
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  const r = METEOR_R[0] + m.rand() * (METEOR_R[1] - METEOR_R[0]);
  const y = Math.max(groundY(x, z) + 60 + m.rand() * 160, 90);
  m.meteors.push({ id: m.nextId++, x, y: y + 380, z, tx: y, vx: (m.rand() - 0.5) * 16, vy: -150, vz: (m.rand() - 0.5) * 16, r, hp: r > 20 ? 34 : 20, spin: m.rand() * 2 + 0.5, falling: true });
}

/* ---------------- bots ---------------- */
function think(m, s, dt) {
  // the chosen difficulty sets the Corvid Pack; Lantern wingmen always fly at Ace
  const ai = s.ai, D = s.team === 0 && m.player ? DIFFICULTY.ace : m.diff, P = PILOTS[s.pilot];
  ai.think -= dt; ai.wobble += dt;
  const inp = s.input;
  inp.fire = false; inp.charge = false; inp.boost = false; inp.brake = false; inp.bomb = false; inp.rollL = false; inp.rollR = false; inp.uturn = false;
  if (ai.think <= 0) {
    ai.think = D.think * (0.7 + m.rand() * 0.6);
    // choose: an enemy ship, or during a shower the nearest rock or energy orb
    const foes = enemiesOf(m, s);
    let best = null, bestS = Infinity;
    const f = forward(s.yaw, s.pitch);
    for (const o of foes) {
      const dx = o.x - s.x, dy = o.y - s.y, dz = o.z - s.z, d = len(dx, dy, dz);
      const facing = (dx * f.x + dy * f.y + dz * f.z) / Math.max(d, 1);
      let sc = d * (1.4 - facing * 0.5);
      if (o.human) sc *= 0.85; // the player draws a little more attention
      if (o.shield < o.maxShield * 0.35) sc *= 0.7;
      if (sc < bestS) { bestS = sc; best = o; }
    }
    ai.target = best ? { kind: "ship", id: best.id } : null;
    const grab = m.wave.on && (s.slot % 2 === 0 ? m.rand() < 0.7 : m.rand() < 0.35);
    if (grab || (!best && (m.meteors.length || m.orbs.length))) {
      let pick = null, pd = 700;
      for (const o of m.orbs) { const d = len(o.x - s.x, o.y - s.y, o.z - s.z); if (d < pd) { pd = d; pick = { kind: "orb", ref: o }; } }
      for (const r of m.meteors) { if (r.falling) continue; const d = len(r.x - s.x, r.y - s.y, r.z - s.z) * 0.9; if (d < pd) { pd = d; pick = { kind: "rock", ref: r }; } }
      if (pick) ai.target = pick;
    }
  }
  let tx = 0, ty = 150, tz = 0, tv = { vx: 0, vy: 0, vz: 0 }, shoot = false, tShip = null;
  const T = ai.target;
  if (T && T.kind === "ship") {
    tShip = m.ships.find((o) => o.id === T.id && o.alive);
    if (!tShip) ai.target = null, ai.think = 0;
  }
  if (tShip) {
    const lp = leadPoint(s.x, s.y, s.z, tShip, LASER_SPEED);
    tx = lp.x; ty = lp.y; tz = lp.z; tv = tShip; shoot = true;
  } else if (T && (T.kind === "orb" || T.kind === "rock") && !T.ref.dead && T.ref.life !== 0) {
    tx = T.ref.x; ty = T.ref.y; tz = T.ref.z; shoot = T.kind === "rock";
    if (T.kind === "orb" && !m.orbs.includes(T.ref)) ai.think = 0;
  } else {
    // patrol through the middle of the valley
    tx = Math.sin(ai.wobble * 0.2 + s.id) * 400; tz = Math.cos(ai.wobble * 0.17 + s.id) * 400; ty = 160;
  }
  // aim error that drifts, so bots miss like people do
  const err = D.aim * (1 + (s.hitFlash > 0 ? 1.5 : 0));
  const want = aimAngles(tx - s.x, ty - s.y, tz - s.z);
  let wy = want.yaw + Math.sin(ai.wobble * 2.3 + s.id) * err * 2;
  let wp = want.pitch + Math.cos(ai.wobble * 1.9 + s.id) * err * 2;
  // keep off the ground and inside the bowl
  const f = forward(s.yaw, s.pitch);
  const ahead1 = groundY(s.x + f.x * 90, s.z + f.z * 90), ahead2 = groundY(s.x + f.x * 200, s.z + f.z * 200);
  const clear = s.y - Math.max(ahead1, ahead2 - 30, groundY(s.x, s.z));
  if (clear < 55) wp = Math.max(wp, 0.5 + (55 - clear) / 80);
  if (s.y > CEILING - 40) wp = Math.min(wp, -0.2);
  if (Math.hypot(s.x, s.z) > ARENA * 0.86) { const c = aimAngles(-s.x, 0, -s.z); wy = c.yaw; }
  for (const r of m.ruins) { // swerve round the monoliths
    const dx = r.x - (s.x + f.x * 70), dz = r.z - (s.z + f.z * 70);
    if (dx * dx + dz * dz < (r.r + 30) ** 2 && s.y < r.y + r.h + 20) wp = Math.max(wp, 0.6);
  }
  const dyaw = angleWrap(wy - s.yaw), dpitch = wp - s.pitch;
  inp.yaw = Math.max(-1, Math.min(1, dyaw * 2.2));
  inp.pitch = Math.max(-1, Math.min(1, dpitch * 2.4));
  const dist = len(tx - s.x, ty - s.y, tz - s.z);
  const off = Math.hypot(dyaw * Math.cos(s.pitch), dpitch);
  if (shoot && off < D.cone && dist < 760) inp.fire = true;
  if (dist > 500 && off < 0.5) inp.boost = s.boost > 0.4;
  if (tShip && dist < 130 && off < 0.6) inp.brake = true;
  // a charged shot at a ship in front, now and then
  if (tShip && off < 0.2 && dist < 650) {
    if (s.charge < 1 && ai.mode !== "fire") { inp.charge = (ai.wobble % 6) < 2.2; }
  }
  if (tShip && s.bombs > 0 && dist < 260 && dist > 90 && off < 0.12 && m.rand() < dt * 0.6) inp.bomb = true;
  // hunted: someone close behind with their nose on me
  const hunter = m.ships.find((o) => o.alive && o.team !== s.team && len(o.x - s.x, o.y - s.y, o.z - s.z) < 260 && (() => {
    const g = forward(o.yaw, o.pitch), dx = s.x - o.x, dy = s.y - o.y, dz = s.z - o.z, d = len(dx, dy, dz);
    return (g.x * dx + g.y * dy + g.z * dz) / d > 0.95;
  })());
  if (hunter) {
    ai.evade -= dt;
    if (ai.evade <= 0) {
      ai.evade = 1.2 + m.rand() * 1.5;
      const r = m.rand();
      if (r < D.dodge * 0.5) (m.rand() < 0.5 ? (inp.rollL = true) : (inp.rollR = true));
      else if (r < D.dodge * 0.7 && s.boost > 0.5) inp.uturn = true;
    }
    if (!tShip || len(tShip.x - s.x, tShip.y - s.y, tShip.z - s.z) > 300) { inp.yaw = Math.sin(ai.wobble * 1.3) > 0 ? 1 : -1; inp.boost = s.boost > 0.2; }
  }
  void P;
}

/* ---------------- one step ---------------- */
export function step(m, dt) {
  if (m.over) return;
  m.elapsed += dt; m.time -= dt;
  // meteor showers
  const W = m.wave;
  W.t -= dt;
  if (!W.on && W.t <= 0 && m.time > 8) { W.on = true; W.t = WAVE_LEN; W.n++; W.energy = [0, 0]; W.spawned = 0; emit(m, { type: "wave", n: W.n }); }
  if (W.on) {
    const due = Math.floor((WAVE_LEN - W.t) / WAVE_LEN * 16) + 4;
    while (W.spawned < due && W.spawned < 18) { spawnMeteor(m); W.spawned++; }
    if (W.t <= 0) {
      W.on = false; W.t = WAVE_EVERY - WAVE_LEN;
      const [a, b] = W.energy, win = a === b ? -1 : a > b ? 0 : 1;
      if (win >= 0) m.score[win] += SCORE.wave;
      emit(m, { type: "waveEnd", winner: win, energy: [a, b] });
    }
  }
  for (const s of m.ships) {
    if (!s.alive) {
      s.respawn -= dt;
      if (s.respawn <= 0 && m.time > 0) { spawn(m, s, false); emit(m, { type: "spawn", ship: s.id }); }
      continue;
    }
    if (!s.human) think(m, s, dt);
    fly(m, s, dt);
  }
  for (const b of m.bolts) moveBolt(m, b, dt);
  m.bolts = m.bolts.filter((b) => b.life > 0);
  for (const b of m.bombs) {
    b.vy -= 60 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
    let boom = b.life <= 0 || b.y < groundY(b.x, b.z) + 3;
    for (const o of m.ships) if (o.alive && o.team !== b.team && len(o.x - b.x, o.y - b.y, o.z - b.z) < 22) boom = true;
    for (const r of m.meteors) if (len(r.x - b.x, r.y - b.y, r.z - b.z) < r.r + 6) boom = true;
    if (boom) { b.life = -1; explodeBomb(m, b); }
  }
  m.bombs = m.bombs.filter((b) => b.life > 0);
  for (const r of m.meteors) {
    if (r.falling) { r.y += r.vy * dt; if (r.y <= r.tx) { r.y = r.tx; r.falling = false; r.vy = 0; emit(m, { type: "rockland", x: r.x, y: r.y, z: r.z }); } }
    else { r.x += r.vx * dt; r.z += r.vz * dt; r.y += Math.sin(m.elapsed * 0.8 + r.id) * 4 * dt; }
  }
  m.meteors = m.meteors.filter((r) => !r.dead && !(!W.on && m.rand() < dt * 0.35));
  for (const o of m.orbs) {
    o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    o.vx *= 1 - dt * 0.9; o.vy *= 1 - dt * 0.9; o.vz *= 1 - dt * 0.9;
    // a ship nearby pulls the orb in
    for (const s of m.ships) {
      if (!s.alive) continue;
      const dx = s.x - o.x, dy = s.y - o.y, dz = s.z - o.z, d = len(dx, dy, dz);
      if (d < 16) { collect(m, s, o); break; }
      if (d < 70) { const k = 260 * dt / d; o.vx += dx * k; o.vy += dy * k; o.vz += dz * k; }
    }
  }
  m.orbs = m.orbs.filter((o) => o.life > 0);
  if (m.time <= 0) {
    m.time = 0; m.over = true;
    m.winner = m.score[0] === m.score[1] ? -1 : m.score[0] > m.score[1] ? 0 : 1;
    emit(m, { type: "end", winner: m.winner });
  }
}

function collect(m, s, o) {
  o.life = 0;
  if (o.kind === "energy") {
    s.energy++; m.score[s.team] += SCORE.orb;
    if (m.wave.on) m.wave.energy[s.team]++;
  } else if (o.kind === "bomb") s.bombs = Math.min(s.bombs + 1, PILOTS[s.pilot].bombs + 1);
  else if (o.kind === "repair") s.shield = Math.min(s.maxShield, s.shield + s.maxShield * 0.4);
  emit(m, { type: "orb", ship: s.id, kind: o.kind, team: s.team });
}

function fly(m, s, dt) {
  const P = PILOTS[s.pilot], inp = s.input;
  s.invuln = Math.max(0, s.invuln - dt); s.hitFlash = Math.max(0, s.hitFlash - dt);
  s.fireCd -= dt; s.rollCd -= dt;
  // a U-turn: half a loop up and over, then a half roll, finishing on the reverse heading
  if (inp.uturn && s.uturn <= 0 && s.boost > 0.3) { s.uturn = 1.1; s.uturnYaw = s.yaw + Math.PI; s.boost -= 0.3; emit(m, { type: "uturn", ship: s.id }); }
  if ((inp.rollL || inp.rollR) && s.roll <= 0 && s.rollCd <= 0) { s.roll = 0.55; s.rollDir = inp.rollL ? -1 : 1; s.rollCd = P.roll || 0.85; emit(m, { type: "roll", ship: s.id }); }
  let target = BASE_SPEED * P.speed;
  if (inp.boost && s.boost > 0.02 && s.uturn <= 0) { target = BOOST_SPEED * P.speed; s.boost = Math.max(0, s.boost - dt * 0.42); }
  else if (inp.brake && s.boost > 0.02) { target = BRAKE_SPEED; s.boost = Math.max(0, s.boost - dt * 0.3); }
  else s.boost = Math.min(1, s.boost + dt * 0.2 * P.regen);
  s.speed += (target - s.speed) * Math.min(1, dt * 2.5);
  if (s.uturn > 0) {
    const k = 1 - s.uturn / 1.1;
    s.pitch = Math.sin(k * Math.PI) * 1.25;
    s.yaw += angleWrap(s.uturnYaw - s.yaw) * Math.min(1, dt * (k > 0.45 ? 9 : 0.6));
    s.bank = k > 0.5 ? Math.PI * (k - 0.5) * 2 : 0;
    s.uturn -= dt;
    if (s.uturn <= 0) { s.yaw = angleWrap(s.uturnYaw); s.pitch = 0.05; s.bank = 0; }
  } else {
    s.yaw = angleWrap(s.yaw + inp.yaw * YAW_RATE * dt * (inp.brake ? 1.3 : 1));
    s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch + inp.pitch * PITCH_RATE * dt));
    if (Math.abs(inp.pitch) < 0.05) s.pitch *= 1 - dt * 0.8; // drift back to level
    const want = -inp.yaw * 0.9;
    s.bank += (want - s.bank) * Math.min(1, dt * 6);
  }
  let rollSlide = 0;
  if (s.roll > 0) { s.roll -= dt; rollSlide = s.rollDir * 90; }
  const f = forward(s.yaw, s.pitch);
  const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  s.vx = f.x * s.speed + rx * rollSlide; s.vy = f.y * s.speed; s.vz = f.z * s.speed + rz * rollSlide;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
  // ground, ceiling, ruins, edges
  const g = groundY(s.x, s.z);
  if (s.y < g + 5) {
    s.y = g + 8; s.pitch = Math.max(s.pitch, 0.45);
    if (s.invuln <= 0) { emit(m, { type: "scrape", ship: s.id, x: s.x, y: s.y, z: s.z }); damage(m, s, 14, null, "ground"); s.invuln = s.alive ? 0.4 : 0; }
  }
  if (s.y > CEILING) { s.y = CEILING; s.pitch = Math.min(s.pitch, 0); }
  for (const r of m.ruins) {
    const dx = s.x - r.x, dz = s.z - r.z, d = Math.hypot(dx, dz);
    if (d < r.r + 4 && s.y < r.y + r.h) {
      const k = (r.r + 5) / Math.max(d, 0.01); s.x = r.x + dx * k; s.z = r.z + dz * k; s.yaw = angleWrap(s.yaw + Math.PI * 0.5);
      if (s.invuln <= 0) { emit(m, { type: "scrape", ship: s.id, x: s.x, y: s.y, z: s.z }); damage(m, s, 18, null, "ruin"); s.invuln = s.alive ? 0.5 : 0; }
    }
  }
  const out = Math.hypot(s.x, s.z) - ARENA;
  s.warn = out > -60 ? 1 : 0;
  if (out > 0) { // a gale pushes strays back into the bowl
    const k = Math.min(1, out / 120) * 260 * dt / Math.hypot(s.x, s.z);
    s.x -= s.x * k; s.z -= s.z * k;
    if (out > 140 && s.invuln <= 0) { damage(m, s, 10, null, "storm"); s.invuln = s.alive ? 0.6 : 0; }
  }
  if (!s.alive) return;
  // weapons
  if (inp.fire && s.fireCd <= 0 && s.uturn <= 0 && !inp.charge) { fireLaser(m, s); s.fireCd = FIRE_GAP; }
  if (inp.charge) {
    s.charge = Math.min(1, s.charge + dt / P.lock);
    const l = findLock(m, s);
    if (l && s.charge >= 1) { if (!s.lock || s.lock.id !== l.id) emit(m, { type: "lock", ship: s.id, target: l.id }); s.lock = l; }
    else if (!l && s.lock && (!s.lock.alive || len(s.lock.x - s.x, s.lock.y - s.y, s.lock.z - s.z) > 900)) s.lock = null;
  } else {
    if (s.prevCharge && s.charge >= 1) fireCharge(m, s);
    s.charge = Math.max(0, s.charge - dt * 4); if (s.charge <= 0) s.lock = null;
  }
  s.prevCharge = inp.charge;
  if (inp.bomb && !s.prevBomb && s.bombs > 0) dropBomb(m, s);
  s.prevBomb = inp.bomb;
  // the veteran: allies close to Silas repair slowly
  if (s.pilot === "silas") for (const o of m.ships) if (o !== s && o.alive && o.team === s.team && len(o.x - s.x, o.y - s.y, o.z - s.z) < 220) o.shield = Math.min(o.maxShield, o.shield + dt * 2.5);
}

function moveBolt(m, b, dt) {
  if (b.target) {
    const t = m.ships.find((o) => o.id === b.target && o.alive);
    if (t) {
      const sp = len(b.vx, b.vy, b.vz), dx = t.x - b.x, dy = t.y - b.y, dz = t.z - b.z, d = len(dx, dy, dz);
      const k = Math.min(1, dt * 3.2);
      b.vx += (dx / d * sp - b.vx) * k; b.vy += (dy / d * sp - b.vy) * k; b.vz += (dz / d * sp - b.vz) * k;
    }
  }
  const dx = b.vx * dt, dy = b.vy * dt, dz = b.vz * dt;
  const owner = m.ships.find((o) => o.id === b.owner);
  for (const o of m.ships) {
    if (!o.alive || o.team === b.team) continue;
    const r = SHIP_R + (b.kind === "charge" ? 6 : 0);
    if (segDist2(b.x, b.y, b.z, dx, dy, dz, o.x, o.y, o.z) < r * r) { b.life = 0; damage(m, o, b.dmg, owner, b.kind); return; }
  }
  for (const r of m.meteors) {
    if (segDist2(b.x, b.y, b.z, dx, dy, dz, r.x, r.y, r.z) < r.r * r.r) { b.life = 0; hitMeteor(m, r, b.kind === "charge" ? 40 : b.dmg, owner); return; }
  }
  b.x += dx; b.y += dy; b.z += dz; b.life -= dt;
  if (b.y < groundY(b.x, b.z)) { b.life = 0; emit(m, { type: "spark", x: b.x, y: b.y + 1, z: b.z }); return; }
  for (const r of m.ruins) if (Math.hypot(b.x - r.x, b.z - r.z) < r.r && b.y < r.y + r.h) { b.life = 0; emit(m, { type: "spark", x: b.x, y: b.y, z: b.z }); return; }
}

// drain the events the renderer has not read yet
export function takeEvents(m) { const e = m.events; m.events = []; return e; }

// MVP: most kills, then most energy, then fewest downs
export function mvp(m) {
  return [...m.ships].sort((a, b) => b.kills * 10 + b.energy * 5 - b.deaths * 3 - (a.kills * 10 + a.energy * 5 - a.deaths * 3))[0];
}
