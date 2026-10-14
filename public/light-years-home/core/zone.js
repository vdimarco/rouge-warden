// Light Years Home v3: the zone runtime (final.md 2.3, 7, 10). Scans are hands-free: hold a target in the nose
// (ZONE.SCAN_CONE for SCAN_T, far things FAR_CONE for FAR_T); Cruise also scans what you pass close. A scan turns a
// dotted ring solid, shows the card's number and plays Dot's line. Sparks, sets, rumours, secrets, Look Home, giver
// rings, the exit gate (it opens by the zone's rule and starts the jump's run-up when you drive through it or tap
// JUMP), the zoom into a pocket, the one orange objective and the action control's chip. Also ACTIVITIES, the slots
// for game.js's wire(), and playSlots() with the flight model and Earth's clock composed in.
import { setMode, zoneOf, zoneById, builtOf, enterZone, H } from './game.js';
import { FLIGHT, addBar, shipForward } from './ship.js';
import { zoneFrame } from './frame.js';
import { OBJECTS } from './objects.js';
import { query, STATIC_BASE } from './collide.js';
import { posAt, KIND } from './traffic.js';
import { setEarthClock, lookHomeCard } from './world/legs.js';
import { OPENING } from './world/lines/ch1.js';
import { missionById } from './world/missions/ch1.js';
import { stepActors, spawn, actorById, releaseTow, trackOf, trackAt } from './actors.js';
import { stepRace, restartEvent, toLastGate, stuntRetry, course, eventById } from './race.js';
import { stepMission, startMission, skipBeat, when, onJump, missionLineFor } from './mission.js';
import { stepTalk, say, skipLine, createTalk } from './talk.js';
import { toBase64 } from './ghost.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const num = (x, d = 0) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : d);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const SEEN = 400;             // u: a scan's dotted ring counts as seen (RACE.SEEN, the start rings' range)
const OPENING_QUIET = 12;     // s after PLAY with no scans in the opening zone (the opening's lines stay in order)
const ROAD_NEAR = 15;         // u: a road scan looks along the road, not at your feet
const ROAD_R = 6;             // u: a road point's radius for its scan range
const SET_R = 14;             // u: driving this close to a set item collects it
const LOOK_FIRST = 25;        // deg: the first time the nose points this near home, Dot says so

// ---------------------------------------------------------------- directions

const DIRS = new Map();
/** farDir(zoneData, objectId, out) → out: the map direction from the zone's place to a far landmark, or null. */
export function farDir(zoneData, objectId, out = [0, 0, 0]) {
  const key = `${zoneData?.id}:${objectId}`;
  let d = DIRS.get(key);
  if (!d) {
    const home = OBJECTS[zoneData?.object]?.pos, o = OBJECTS[objectId]?.pos;
    if (!home || !o) return null;
    const g = [o[0] - home[0], o[1] - home[1], o[2] - home[2]];
    const l = Math.hypot(g[0], g[1], g[2]) || 1;
    d = zoneFrame(zoneData).toMap([g[0] / l, g[1] / l, g[2] / l], [0, 0, 0]);
    DIRS.set(key, d);
  }
  out[0] = d[0]; out[1] = d[1]; out[2] = d[2];
  return out;
}

// The angle between the nose and a direction. A target far above or below the plane is held level at ±30° (the nose
// pitches 35° at most; a target overhead means "nose up"); Cruise forgives up to 15° of height on top.
const AIM = [0, 0, 0];
export function aimError(game, nose, dir, cruise) {
  let x = dir[0], y = dir[1], z = dir[2];
  const flat = Math.hypot(x, y);
  const lim = Math.sin(30 * DEG);
  if (Math.abs(z) > lim) {
    const zz = Math.sign(z) * lim, f = Math.sqrt(1 - zz * zz);
    if (flat < 0.05) { const h = game.ship.yaw; x = Math.sin(h) * f; y = Math.cos(h) * f; }
    else { x = (x / flat) * f; y = (y / flat) * f; }
    z = zz;
  }
  if (cruise) {
    // Cruise takes off up to 15° of the height difference between the nose and the target.
    const el = Math.asin(clamp(z, -1, 1)), ne = Math.asin(clamp(nose[2], -1, 1));
    const diff = el - ne, cut = Math.sign(diff) * Math.max(0, Math.abs(diff) - 15 * DEG);
    const e2 = ne + cut, fl = Math.cos(e2), fh = Math.hypot(x, y);
    if (fh > 1e-6) { x = (x / fh) * fl; y = (y / fh) * fl; }
    z = Math.sin(e2);
  }
  const c = clamp(nose[0] * x + nose[1] * y + nose[2] * z, -1, 1);
  return Math.acos(c);
}

// ---------------------------------------------------------------- sparks

const SPARKS = new WeakMap();
/**
 * sparkPositions(zoneData, traffic?) → Float32Array (x, y, z per spark, in zone.sparks order). Road sparks sit at
 * s = from + (to − from) · i / (n − 1) of the road's length plus lateral u to its right; orbit sparks at angle 2π·s
 * from +x with lateral outward; point lists as given; the jet's spine along +x.
 */
export function sparkPositions(zoneData, traffic = null) {
  let out = SPARKS.get(zoneData);
  if (out) return out;
  const pts = [];
  const roads = new Map((zoneData?.roads || []).map((r) => [r.id, r]));
  for (const s of zoneData?.sparks || []) {
    if (Array.isArray(s.pts)) { for (const p of s.pts) pts.push(p[0], p[1], p[2] || 0); continue; }
    const n = Math.max(1, s.n | 0);
    const r = roads.get(s.road);
    for (let i = 0; i < n; i++) {
      const u = num(s.from, 0) + (num(s.to, 1) - num(s.from, 0)) * (n > 1 ? i / (n - 1) : 0);
      const lat = num(s.lateral, 0);
      if (r && r.kind === 'orbit') {
        const rad = (Array.isArray(r.r) ? (r.r[0] + r.r[1]) / 2 : num(r.r, 100)) + lat;
        const a = TAU * u;
        pts.push(r.centre[0] + Math.cos(a) * rad, r.centre[1] + Math.sin(a) * rad, 0);
      } else if (r && Array.isArray(r.pts)) {
        const tr = traffic?.roads?.find((x) => x.id === r.id);
        if (tr) {
          const k = clamp(Math.round((u * tr.L) / (tr.L / Math.max(1, tr.n - 1))), 0, tr.n - 1);
          pts.push(tr.x[k] + tr.rx[k] * lat, tr.y[k] + tr.ry[k] * lat, tr.z[k]);
        } else {
          const tk = trackOf(r.pts, false), P = [0, 0, 0, 0];
          trackAt(tk, u * tk.L, P);
          pts.push(P[0] + Math.cos(P[3]) * lat, P[1] - Math.sin(P[3]) * lat, P[2]);
        }
      } else if (s.along === 'spine' && zoneData.jet) {
        const a = zoneData.jet.from, b = zoneData.jet.to;
        pts.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
      } else {
        pts.push(0, 0, 0);
      }
    }
  }
  out = Float32Array.from(pts);
  if (traffic || !(zoneData?.sparks || []).some((s) => s.road)) SPARKS.set(zoneData, out);
  return out;
}

const bitsOf = (arr) => {
  const b = new Uint8Array(Math.ceil(arr.length / 8));
  for (let i = 0; i < arr.length; i++) if (arr[i]) b[i >> 3] |= 1 << (i & 7);
  return toBase64(b);
};

// ---------------------------------------------------------------- the runtime

function zoneProgress(game, id = game.zoneId) {
  const z = game.progress.zones || (game.progress.zones = {});
  return z[id] || (z[id] = { visited: true, exitOpen: false, sparks: '', scans: [], rumours: [], secrets: [], sets: {},
    lookHome: false });
}

/**
 * createZoneRt(zoneData, progress) → the zone runtime (final.md 5.1), restored from progress.zones[id]: scans,
 * sparks, sets, rumours, secrets, Look Home, an open exit.
 */
export function createZoneRt(zoneData, progress = null) {
  let n = 0;
  for (const s of zoneData?.sparks || []) n += s.n ?? s.pts?.length ?? 0;
  const p = progress?.zones?.[zoneData?.id] || null;
  const zr = {
    id: zoneData?.id ?? null, exitOpen: !!p?.exitOpen, seen: {}, scanned: {}, scan: { id: null, t: 0 },
    sparks: new Uint8Array(n), sets: {}, rumours: {}, secrets: {}, secretT: {}, lookHome: !!p?.lookHome,
    scaleCardUntil: 0, waypoint: null, wellsOff: null, assistAt: null, slingAt: null, offer: null, jumpTo: null,
    missionRings: [], scannedAt: {}, armed: {}, retry: null, calls: {}, lookT: 0, homeT: 0, scaleShown: false,
    holdUsed: false, zoom: null, zoomReq: null, rumourReq: null, scanPos: null, firstFar: null,
  };
  if (p) {
    for (const id of p.scans || []) zr.scanned[id] = true;
    for (const id of p.rumours || []) zr.rumours[id] = true;
    for (const id of p.secrets || []) zr.secrets[id] = true;
    if (typeof p.sparks === 'string' && p.sparks) {
      const bytes = fromB64(p.sparks);
      for (let i = 0; i < n; i++) if (bytes[i >> 3] & (1 << (i & 7))) zr.sparks[i] = 1;
    }
    for (const [k, v] of Object.entries(p.sets || {})) zr.sets[k] = Array.isArray(v) ? v.slice() : [];
  }
  for (const [k, s] of Object.entries(zoneData?.sets || {})) {
    if (!zr.sets[k]) zr.sets[k] = new Array((s.items || []).length).fill(0);
  }
  return zr;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fromB64(s) {
  const out = [];
  let acc = 0, bits = 0;
  for (const ch of s.replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) break;
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  return out;
}

/**
 * enterActivities(game, zoneData, ev): the enter slot's share for activities. The zone is visited; an event or a
 * mission of another zone ends; the zone's own actors (Vela, D100) appear; the talk state is ready.
 */
export function enterActivities(game, zoneData, ev = null) {
  if (!game.talk || game.talk.once === undefined) game.talk = { ...createTalk(), ...(game.talk || {}) };
  if (!game.story.flags) game.story.flags = {};
  const pocket = zoneData.kind === 'pocket';
  if (!pocket) {
    const zp = zoneProgress(game, zoneData.id);
    zp.visited = true;
    if (game.race) { game.race = null; }
    game.stunt = null;
    if (game.mission && missionById(game.mission.id)?.zone !== zoneData.id) {
      const p = game.progress.missions[game.mission.id];
      if (p) p.parked = false;
      game.mission = null;
    }
    game.activity = game.mission ? { kind: 'mission', id: game.mission.id } : null;
    game.actors = game.actors.filter((a) => a.kind === 'towable' && game.ship.tow?.actor === a.id);
    for (const a of zoneData.actors || []) {
      // A rival who idles at her race's start ring waits beside it, not on it.
      const ev = (zoneData.events || []).find((e) => e.rival?.actor === a.id && e.start);
      let idleAt = a.idleAt;
      if (ev && idleAt && Math.hypot(idleAt[0] - ev.start.pos[0], idleAt[1] - ev.start.pos[1]) < 8) {
        const c = course(ev);
        idleAt = [c.start.pos[0] + c.start.dir[1] * 7, c.start.pos[1] - c.start.dir[0] * 7, c.start.pos[2]];
      }
      spawn(game, { ...a, idleAt, pos: a.pos || idleAt || (a.path && a.path[0]) }, null);
    }
  }
}

// ---------------------------------------------------------------- scans

// The scan targets' places this step: { pos, r, far, dir, inside, ti }. Reused objects.
const TGT = { pos: [0, 0, 0], r: 1, dir: [0, 0, 0], ti: -1, inside: false, far: false, ok: false, d: Infinity };
const NOSE = [0, 1, 0];
const IDS = new Int32Array(512);
const BP = [0, 0, 0];

function trafficGroup(zoneData, tr, i) {
  const kind = tr.kind[i], k = tr.road[i];
  if (kind === KIND.road) return (zoneData.roads || []).filter((r) => r.kind === 'road')[k]?.id;
  if (kind === KIND.orbit) return (zoneData.roads || []).filter((r) => r.kind === 'orbit')[k]?.id;
  if (kind === KIND.swarm) return (zoneData.swarms || [])[k]?.id;
  return null;
}

// Where a scan's target is now, seen from the ship. Fills TGT; returns false when it has no place.
function targetOf(game, zoneData, s, nose) {
  const tg = s.target || {};
  const p = game.ship.pos;
  TGT.ok = false; TGT.inside = false; TGT.far = !!(s.far || tg.far); TGT.ti = -1; TGT.d = Infinity;
  if (TGT.far) {
    const f = (zoneData.far || []).find((x) => x.id === tg.far || x.scan === s.id);
    if (!f || !farDir(zoneData, f.object, TGT.dir)) return false;
    TGT.ok = true;
    return true;
  }
  if (tg.inside) {
    TGT.pos[0] = tg.inside.centre[0]; TGT.pos[1] = tg.inside.centre[1]; TGT.pos[2] = tg.inside.centre[2] || 0;
    TGT.r = tg.inside.r;
    TGT.d = dist2(p, TGT.pos);
    TGT.inside = TGT.d <= tg.inside.r;
    TGT.ok = true;
    return true;
  }
  let best = Infinity, ang = Infinity;
  const consider = (x, y, z, r, ti = -1) => {
    const dx = x - p[0], dy = y - p[1], dz = z - p[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const a = Math.acos(clamp((dx * nose[0] + dy * nose[1] + dz * nose[2]) / d, -1, 1));
    // The best is the one nearest the nose among those in range; else the nearest.
    const range = game.tune.ZONE.SCAN_RANGE + game.tune.ZONE.SCAN_RANGE_X * r;
    const score = d <= range ? a : 10 + d / 1000;
    if (score < ang) { ang = score; best = d; TGT.pos[0] = x; TGT.pos[1] = y; TGT.pos[2] = z; TGT.r = r; TGT.ti = ti; }
  };
  if (tg.body) {
    const b = (zoneData.bodies || []).find((x) => x.id === tg.body);
    if (!b) return false;
    consider(b.pos[0], b.pos[1], b.pos[2] || 0, num(b.r, 3));
  } else if (tg.at) {
    const list = Array.isArray(tg.at[0]) ? tg.at : [tg.at];
    for (const q of list) consider(q[0], q[1], q[2] || 0, num(tg.r, 10));
  } else if (tg.roads) {
    for (const r of zoneData.roads || []) {
      if (!tg.roads.includes(r.id) || !Array.isArray(r.pts)) continue;
      const tk = trackOf(r.pts, false);
      for (let i = 0; i < tk.n; i += 5) {
        const dx = tk.x[i] - p[0], dy = tk.y[i] - p[1];
        if (dx * dx + dy * dy < ROAD_NEAR * ROAD_NEAR) continue;
        consider(tk.x[i], tk.y[i], tk.z[i], ROAD_R);
      }
    }
  } else if (tg.traffic) {
    const built = builtOf(game);
    const tr = built?.traffic, grid = built?.grid;
    if (!tr || !grid) return false;
    const reach = game.tune.ZONE.SCAN_RANGE + game.tune.ZONE.SCAN_RANGE_X * 8;
    const n = query(grid, p, reach, IDS);
    for (let k = 0; k < n; k++) {
      const i = IDS[k];
      if (i >= STATIC_BASE) continue;
      if (tg.traffic !== 'any' && trafficGroup(zoneData, tr, i) !== tg.traffic) continue;
      if (tr.kind[i] === KIND.swarm && tr.size[i] < 1) continue;          // dwarfs are pebbles, not galaxies to scan
      posAt(tr, i, game.zoneT, BP);
      consider(BP[0], BP[1], BP[2], tr.size[i], i);
    }
  } else if (tg.set) {
    const set = zoneData.sets?.[tg.set];
    for (const q of set?.items || []) consider(q[0], q[1], q[2] || 0, 10);
  } else if (tg.actor) {
    const a = actorById(game, tg.actor);
    if (!a) return false;
    consider(a.pos[0], a.pos[1], a.pos[2], num(a.r, 2));
  } else {
    return false;
  }
  if (!(best < Infinity)) return false;
  TGT.d = best;
  TGT.ok = true;
  return true;
}

/** scanState(game, id) → 'unseen' | 'seen' | 'scanning' | 'scanned'. */
export function scanState(game, id) {
  const zr = game.zone;
  if (!zr) return 'unseen';
  if (zr.scanned[id]) return 'scanned';
  if (zr.scan.id === id && zr.scan.t > 0) return 'scanning';
  return zr.seen[id] ? 'seen' : 'unseen';
}

const RACING = new Set(['running', 'armed', 'restart']);
function stepScans(game, zoneData, dt, ev) {
  const Z = game.tune.ZONE;
  const zr = game.zone;
  // No scans while a race clock runs: the nose is on the gates.
  if (game.race && RACING.has(game.race.state)) { zr.scan.id = null; zr.scan.t = 0; return; }
  const cruise = game.settings?.assists !== 'pilot';
  const t = game.t;
  const sincePlay = t - num(game.story.playAt, 0);
  shipForward(game.ship, NOSE);
  let pick = null, pickScore = Infinity, pickFar = false, pickAuto = false;
  for (const s of zoneData.scans || []) {
    if (zr.scanned[s.id]) continue;
    if (!targetOf(game, zoneData, s, NOSE)) continue;
    if (TGT.far) {
      if (!zr.seen[s.id]) { zr.seen[s.id] = true; if (ev) ev.push('ringSeen', { id: s.id, far: true }); }
    } else if (TGT.d <= SEEN && !zr.seen[s.id]) {
      zr.seen[s.id] = true;
      if (ev) ev.push('ringSeen', { id: s.id });
    }
    if (Number.isFinite(s.notBefore) && sincePlay < s.notBefore) continue;
    const opening = game.zoneId === OPENING.zone && !game.progress.missions?.[OPENING.endsWith.split(':')[1]];
    if (opening && sincePlay < OPENING_QUIET) continue;
    let score;
    let auto = false;
    if (TGT.far) {
      const cone = (cruise ? Z.FAR_CONE_CRUISE : Z.FAR_CONE) * DEG;
      const a = aimError(game, NOSE, TGT.dir, cruise);
      if (a > cone) continue;
      score = a / cone;
    } else if (TGT.inside) {
      score = 0.5;
    } else if (s.target?.inside) {
      continue;
    } else {
      const range = Z.SCAN_RANGE + Z.SCAN_RANGE_X * TGT.r;
      const autoR = TGT.r > 10 ? TGT.r * 0.6 : Z.AUTO_SCAN + 3 * TGT.r;
      if (cruise && !s.target?.roads && TGT.d <= autoR) { auto = true; score = -1; }
      else {
        if (TGT.d > range) continue;
        const dx = TGT.pos[0] - game.ship.pos[0], dy = TGT.pos[1] - game.ship.pos[1], dz = TGT.pos[2] - game.ship.pos[2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const a = Math.acos(clamp((dx * NOSE[0] + dy * NOSE[1] + dz * NOSE[2]) / d, -1, 1));
        const cone = Z.SCAN_CONE * DEG;
        if (a > cone) continue;
        score = a / cone;
      }
    }
    if (score < pickScore) {
      pickScore = score; pick = s; pickFar = TGT.far; pickAuto = auto;
      if (!TGT.far) {
        zr.scanPos = zr.scanPos || [0, 0, 0];
        zr.scanPos[0] = TGT.pos[0]; zr.scanPos[1] = TGT.pos[1]; zr.scanPos[2] = TGT.pos[2];
        zr.scanR = TGT.r; zr.scanTi = TGT.ti;
      }
    }
  }
  if (!pick) { zr.scan.id = null; zr.scan.t = 0; return; }
  if (zr.scan.id !== pick.id) {
    zr.scan.id = pick.id;
    zr.scan.t = 0;
    if (ev && !pickAuto) ev.push('scanStart', { id: pick.id, far: pickFar });
  }
  zr.scan.t += dt;
  const need = pickFar ? Z.FAR_T : Z.SCAN_T;
  if (pickAuto || zr.scan.t >= need) completeScan(game, zoneData, pick, pickFar, ev);
}

function completeScan(game, zoneData, s, far, ev) {
  const zr = game.zone;
  zr.scanned[s.id] = true;
  zr.scan.id = null; zr.scan.t = 0;
  if (!far && zr.scanPos) {
    zr.scannedAt[s.id] = { pos: zr.scanPos.slice(), r: num(zr.scanR, 3), traffic: num(zr.scanTi, -1) };
  }
  const zp = zoneProgress(game, game.zoneId);
  if (!zp.scans.includes(s.id)) zp.scans.push(s.id);
  addBar(game.ship, game.tune.BAR.SCAN);
  game.stats.scans++;
  if (ev) ev.push(far ? 'farScan' : 'scan', { id: s.id, card: s.card || s.id, label: s.label || null });
  // The line: the mission's own for this scan (WHICH WAY HOME's far scans), else Dot's.
  const group = (zoneData.far || []).filter((f) => f.kind === 'scan').map((f) => f.scan);
  const first = group.filter((id) => id !== s.id && zr.scanned[id]).length === 0;
  const ml = missionLineFor(game, s.id, first);
  if (ml !== undefined) { if (ml) say(game, ml, { mission: true }); }
  else if (s.line) say(game, s.line, { mission: !!s.scaleCard });           // the first galaxy's line is the opening's
  if (s.scaleCard) showScaleCard(game, ev);
  rumoursFrom(game, zoneData, `scan:${s.id}`, ev);
}

function showScaleCard(game, ev) {
  const Z = game.tune.ZONE;
  game.zone.scaleCardUntil = game.t + Z.SCALE_CARD;
  if (ev) ev.push('scaleCard', { zone: game.zoneId });
}

// ---------------------------------------------------------------- rumours, secrets, sets, sparks, Look Home

function rumoursFrom(game, zoneData, key, ev) {
  for (const r of zoneData.rumours || []) {
    const from = Array.isArray(r.from) ? r.from : [r.from];
    if (!from.includes(key) || game.zone.rumours[r.id]) continue;
    unlockRumour(game, r, ev);
  }
}

function unlockRumour(game, r, ev) {
  game.zone.rumours[r.id] = true;
  const zp = zoneProgress(game, game.zoneId);
  if (!zp.rumours.includes(r.id)) zp.rumours.push(r.id);
  if (ev) ev.push('rumour', { id: r.id, text: r.text, opens: r.opens });
}

function stepSecrets(game, zoneData, dt, ev) {
  const zr = game.zone, ship = game.ship;
  for (const s of zoneData.secrets || []) {
    if (zr.secrets[s.id]) continue;
    const w = s.when || {};
    let found = false;
    if (w.at) {
      found = dist2(ship.pos, w.at) <= num(w.within, 25) && (!Number.isFinite(w.hMin) || ship.pos[2] >= w.hMin);
    } else if (w.lap) {
      // A drift lap of a body within `within` u at minSpeed or more: the sweep round it adds up to a full turn.
      const b = (zoneData.bodies || []).find((x) => x.id === w.lap);
      if (b) {
        const st = zr.secretT[s.id] || (zr.secretT[s.id] = { a: 0, last: null, t: 0 });
        const d = dist2(ship.pos, b.pos);
        if (ship.drift.on && d <= num(w.within, 20) && ship.speed >= num(w.minSpeed, 0)) {
          const ang = Math.atan2(ship.pos[0] - b.pos[0], ship.pos[1] - b.pos[1]);
          if (st.last !== null) { let da = ang - st.last; da = Math.atan2(Math.sin(da), Math.cos(da)); st.a += da; }
          st.last = ang;
          st.t += dt;
          // Too slow a lap (over `seconds`) starts the count again from here.
          if (Number.isFinite(w.seconds) && st.t > w.seconds) { st.a = 0; st.t = 0; }
          found = Math.abs(st.a) >= TAU;
        } else { st.a = 0; st.last = null; st.t = 0; }
      }
    } else if (w.ride) {
      // Stay within `within` u of one galaxy on the named road for `seconds`.
      const built = builtOf(game), tr = built?.traffic;
      const st = zr.secretT[s.id] || (zr.secretT[s.id] = { id: -1, t: 0 });
      if (tr && (game.steps & 3) === 0) {
        const n = query(built.grid, ship.pos, num(w.within, 4) + 8, IDS);
        let hit = -1;
        for (let k = 0; k < n; k++) {
          const i = IDS[k];
          if (i >= STATIC_BASE || trafficGroup(zoneData, tr, i) !== w.ride) continue;
          posAt(tr, i, game.zoneT, BP);
          const gap = Math.hypot(BP[0] - ship.pos[0], BP[1] - ship.pos[1], BP[2] - ship.pos[2]) - tr.size[i];
          if (gap <= num(w.within, 4)) {
            if (i === st.id || hit < 0) hit = i;
          }
        }
        if (hit >= 0 && hit === st.id) st.t += 4 * dt; else { st.id = hit; st.t = 0; }
        found = st.t >= num(w.seconds, 5);
      }
    }
    if (!found) continue;
    zr.secrets[s.id] = true;
    const zp = zoneProgress(game, game.zoneId);
    if (!zp.secrets.includes(s.id)) zp.secrets.push(s.id);
    const rw = s.reward || {};
    const p = game.progress;
    if (rw.trail && !p.trails.includes(rw.trail)) p.trails.push(rw.trail);
    if (ev) ev.push('secret', { id: s.id, card: rw.card || null, vista: !!rw.vista, lens: rw.lens || null });
    if (rw.line) say(game, rw.line);
  }
}

function stepSets(game, zoneData, ev) {
  const zr = game.zone, p = game.ship.pos;
  for (const [name, set] of Object.entries(zoneData.sets || {})) {
    const items = set.items;
    if (!Array.isArray(items)) continue;
    const got = zr.sets[name] || (zr.sets[name] = new Array(items.length).fill(0));
    for (let i = 0; i < items.length; i++) {
      if (got[i]) continue;
      const q = items[i];
      if (Math.abs(q[0] - p[0]) > SET_R + 2 || Math.abs(q[1] - p[1]) > SET_R + 2) continue;
      if (Math.hypot(q[0] - p[0], q[1] - p[1], (q[2] || 0) - p[2]) > SET_R) continue;
      got[i] = 1;
      const n = got.reduce((a, b) => a + (b ? 1 : 0), 0);
      const zp = zoneProgress(game, game.zoneId);
      zp.sets[name] = got.slice();
      if (ev) ev.push('setItem', { set: set.label || name, id: name, i, n, of: items.length });
      if (n === items.length) {
        const rw = set.reward || {};
        if (rw.trail && !game.progress.trails.includes(rw.trail)) game.progress.trails.push(rw.trail);
        if (ev) ev.push('setDone', { set: set.label || name, id: name, card: rw.card || null });
      }
    }
  }
}

/**
 * setMarks(game) → set items to show: [{ set, i, pos, state: 'shimmer' | 'visible' }] (shimmer and radar from
 * 250 u, in full inside 80 u).
 */
export function setMarks(game) {
  const zoneData = zoneOf(game), out = [];
  const p = game.ship.pos;
  for (const [name, set] of Object.entries(zoneData?.sets || {})) {
    (set.items || []).forEach((q, i) => {
      if (game.zone.sets[name]?.[i]) return;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1], (q[2] || 0) - p[2]);
      if (d <= num(set.visibleWithin, 80)) out.push({ set: name, i, pos: q, state: 'visible' });
      else if (d <= num(set.shimmerWithin, 250)) out.push({ set: name, i, pos: q, state: 'shimmer' });
    });
  }
  return out;
}

function stepSparks(game, zoneData, ev) {
  const zr = game.zone;
  const n = zr.sparks.length;
  if (!n) return;
  const pos = sparkPositions(zoneData, builtOf(game)?.traffic);
  const s = game.ship, p0 = s.prev.pos, p1 = s.pos;
  const R = game.tune.ZONE.SPARK_R;
  const lim = R + 3;
  let changed = false;
  for (let i = 0; i < n; i++) {
    if (zr.sparks[i]) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.abs(x - p1[0]) > lim || Math.abs(y - p1[1]) > lim) continue;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const l2 = dx * dx + dy * dy + dz * dz;
    let f = l2 > 1e-12 ? ((x - p0[0]) * dx + (y - p0[1]) * dy + (z - p0[2]) * dz) / l2 : 0;
    f = clamp(f, 0, 1);
    if (Math.hypot(p0[0] + dx * f - x, p0[1] + dy * f - y, p0[2] + dz * f - z) > R) continue;
    zr.sparks[i] = 1;
    changed = true;
    addBar(s, game.tune.BAR.SPARK);
    if (ev) ev.push('spark', { i, x, y, z });
  }
  if (changed) zoneProgress(game, game.zoneId).sparks = bitsOf(zr.sparks);
}

function stepLookHome(game, zoneData, dt, ev) {
  const zr = game.zone, Z = game.tune.ZONE;
  const dir = farDir(zoneData, 'earth', TMP);
  if (!dir) return;
  const a = aimError(game, NOSE, dir, game.settings?.assists !== 'pilot');
  // The first time the nose points near home in the whole game.
  const opening = (game.story.openingI ?? 0) < OPENING.lines.length;
  if (a <= LOOK_FIRST * DEG && !game.talk.once?.['dot.home'] && !opening) {
    zr.homeT += dt;
    if (zr.homeT > 0.4 && zoneData.lookHome && !zr.lookHome) say(game, 'dot.home', { once: 'game', quiet: true });
  } else zr.homeT = 0;
  if (!zoneData.lookHome || zr.lookHome) return;
  if (a <= Z.LOOK_HOME * DEG) zr.lookT += dt; else zr.lookT = 0;
  if (zr.lookT < Z.LOOK_HOME_T) return;
  zr.lookHome = true;
  const card = lookHomeCard(game.zoneId, game.today)?.id || zoneData.lookHome.card;
  zoneProgress(game, game.zoneId).lookHome = true;
  if (!game.progress.postcards.includes(card)) game.progress.postcards.push(card);
  if (ev) ev.push('lookHome', { card, zone: game.zoneId });
  if (zoneData.lookHome.line) say(game, zoneData.lookHome.line);
}
const TMP = [0, 0, 0];

// ---------------------------------------------------------------- rings, the exit, the objective

function exitRule(game, zoneData) {
  const ex = zoneData.exit;
  return !!ex && when(game, ex.opensWhen);
}

/** openExit(game, ev): light the exit gate (the fix earned). */
export function openExit(game, ev = null) {
  const zr = game.zone;
  if (zr.exitOpen) return false;
  zr.exitOpen = true;
  zoneProgress(game, game.zoneId).exitOpen = true;
  const ex = zoneOf(game)?.exit;
  if (ev) ev.push('exitOpen', { to: ex?.to || null });
  return true;
}

/**
 * startJump(game, ev) → true: the run-up toward the exit's zone. Sets game.zone.jumpTo and mode 'runup'; core/jump.js
 * (the jump slot) arms itself from there. A mission beat that wanted the exit is done.
 */
export function startJump(game, ev = null) {
  const zoneData = parentOfZone(game);
  if (!game.zone.exitOpen || !zoneData?.exit?.to || game.mode !== 'drive') return false;
  const to = zoneData.exit.to;
  game.zone.jumpTo = to;
  if (game.race) game.race = null;
  game.stunt = null;
  const ok = ARM ? ARM(game, to, ev) : setMode(game, 'runup', ev);
  if (!ok) return false;
  game.activity = null;
  onJump(game, ev);
  return true;
}

let ARM = null;
/** setJumpArm(fn): the jump's arm (core/jump.js armJump(game, to, ev)), which starts the run-up; playSlots sets it. */
export function setJumpArm(fn) { ARM = typeof fn === 'function' ? fn : null; }
const parentOfZone = (game) => zoneById(game.zoneId);

function stepRings(game, zoneData, ev) {
  const zr = game.zone, ship = game.ship;
  if (game.mode !== 'drive') return;
  // Giver rings: drive through to take the job.
  if (!game.mission && !game.race) {
    for (const r of zoneData.rings || []) {
      if (!r.mission || game.progress.missions?.[r.mission]?.done || (r.after && !when(game, r.after))) continue;
      if (!zr.seen[r.id] && dist2(ship.pos, r.pos) <= SEEN) {
        zr.seen[r.id] = true;
        if (ev) ev.push('ringSeen', { id: r.id });
      }
      if (segNear(ship, r.pos, num(r.r, 8))) { startMission(game, r.mission, 0, ev); break; }
    }
  }
  // The exit: opens by the zone's rule, and driving through it starts the run-up.
  if (!zr.exitOpen && exitRule(game, zoneData)) openExit(game, ev);
  if (zr.exitOpen && zoneData.exit && segNear(ship, zoneData.exit.pos, num(zoneData.exit.r, 10))) startJump(game, ev);
  // The zoom ring into a pocket.
  const pk = zoneData.pocket;
  if (pk && segNear(ship, pk.ring.pos, num(pk.ring.r, 10)) && zoneById(pk.id)) zoomTo(game, pk.id, ev);
}

const SEG = [0, 0, 0];
function segNear(ship, c, r) {
  const p0 = ship.prev.pos, p1 = ship.pos;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  let f = l2 > 1e-12 ? ((c[0] - p0[0]) * dx + (c[1] - p0[1]) * dy + ((c[2] || 0) - p0[2]) * dz) / l2 : 0;
  f = clamp(f, 0, 1);
  SEG[0] = p0[0] + dx * f; SEG[1] = p0[1] + dy * f; SEG[2] = p0[2] + dz * f;
  return Math.hypot(SEG[0] - c[0], SEG[1] - c[1], SEG[2] - (c[2] || 0)) <= r;
}

// Always one objective (13.6): the race's next gate, the mission's, the exit once open, else the story's way in.
function objective(game, zoneData) {
  const m = game.mission;
  if (game.race) return null;
  if (m) return m.waypoint;
  if (game.zone.exitOpen && zoneData.exit) return 'exit';
  for (const id of zoneData.missions || []) {
    const data = missionById(id);
    if (!data?.story || game.progress.missions?.[id]?.done || data.zone !== zoneData.id) continue;
    if (data.start?.ring) return data.start.ring;
    const near = data.start?.auto?.near;
    if (near) return { id: `story:${id}`, pos: [near.pos[0], near.pos[1], 0], r: Math.min(40, near.within), label: '' };
  }
  return null;
}

function placeOf(game, zoneData, w) {
  if (!w) return null;
  if (Array.isArray(w)) return null;
  if (typeof w === 'object') return w.pos || null;
  if (w === 'exit') return zoneData.exit?.pos || null;
  if (w.startsWith('actor:')) return actorById(game, w.slice(6))?.pos || null;
  const r = (zoneData.rings || []).find((x) => x.id === w) || (game.zone.missionRings || []).find((x) => x.id === w);
  if (r) return r.pos;
  const s = (zoneData.scans || []).find((x) => x.id === w);
  if (s?.target?.body) return (zoneData.bodies || []).find((b) => b.id === s.target.body)?.pos || null;
  if (s?.target?.at && !Array.isArray(s.target.at[0])) return s.target.at;
  return null;
}

function stepObjective(game, zoneData) {
  const zr = game.zone;
  zr.waypoint = objective(game, zoneData);
  // In the run-up the jump owns the height assist (its next launch ring).
  if (game.mode === 'runup') {
    const a = game.jump?.runup?.assist;
    if (a) { zr.assistAt = a; zr.assistJump = true; }
    return;
  }
  if (zr.assistJump) { zr.assistAt = null; zr.assistJump = false; }
  // Cruise's height assist aims at the objective, the next gate or the exit.
  let p = null;
  if (game.race && game.race.state === 'running') {
    const ev = eventById(game, game.race.id);
    const g = ev ? course(ev).gates[game.race.gate] : null;
    p = g ? g.pos : null;
  } else {
    p = placeOf(game, zoneData, zr.waypoint);
  }
  if (p) {
    const a = zr.assistAt || (zr.assistAt = [0, 0, 0]);
    a[0] = p[0]; a[1] = p[1]; a[2] = p[2] || 0;
  } else zr.assistAt = null;
}

/**
 * ringStates(game) → [{ id, kind, state }]: every ring the zone shows. Givers and the exit: 'white' (open), 'orange'
 * (the objective), 'grey' (done), 'dim' (a dark exit); start rings 'white', 'grey' with a medal, 'hidden' while busy;
 * secrets 'hidden' until their rumour, then 'faint', then 'found'; scans their scanState.
 */
export function ringStates(game) {
  const zoneData = zoneOf(game), zr = game.zone, out = [];
  if (!zoneData || !zr) return out;
  const w = zr.waypoint;
  const isObj = (id) => (Array.isArray(w) ? w.includes(id) : w === id || w?.id === id);
  const busy = !!(game.mission || game.race);
  for (const r of zoneData.rings || []) {
    const done = r.mission && game.progress.missions?.[r.mission]?.done;
    const open = !r.after || when(game, r.after);
    out.push({ id: r.id, kind: 'giver', state: done ? 'grey' : !open ? 'hidden' : isObj(r.id) ? 'orange' : 'white' });
  }
  if (zoneData.exit) {
    out.push({ id: 'exit', kind: 'exit', state: !zr.exitOpen ? 'dim' : isObj('exit') ? 'orange' : 'white' });
  }
  for (const e of zoneData.events || []) {
    if (!e.start) continue;
    const medal = game.progress.events?.[e.id]?.medal;
    out.push({ id: e.id, kind: 'start', state: busy ? 'hidden' : medal ? 'grey' : 'white' });
  }
  for (const s of zoneData.secrets || []) {
    out.push({ id: s.id, kind: 'secret', state: zr.secrets[s.id] ? 'found' : zr.rumours[s.rumour] ? 'faint' : 'hidden' });
  }
  for (const s of zoneData.scans || []) out.push({ id: s.id, kind: 'scan', state: scanState(game, s.id) });
  return out;
}

// ---------------------------------------------------------------- zoom

/** zoomTo(game, pocketId, ev): the 1.5 s zoom into a pocket (mode 'zoom'); the pocket's data must be registered. */
export function zoomTo(game, pocketId, ev = null) {
  if (!zoneById(pocketId) || game.mode !== 'drive') return false;
  game.zone.zoom = { to: pocketId, t: 0, out: false };
  if (ev) ev.push('zoomIn', { to: pocketId });
  return setMode(game, 'zoom', ev);
}

/** zoomOut(game, ev): back out to the parent zone at the pocket's back point. */
export function zoomOut(game, ev = null) {
  if (!game.pocketId || game.mode !== 'drive') return false;
  game.zone.zoom = { to: game.zoneId, t: 0, out: true, from: game.pocketId };
  if (ev) ev.push('zoomOut', { from: game.pocketId });
  return setMode(game, 'zoom', ev);
}

/** stepZoom(game, input, dt, ev): game.js's zoom slot: after ZONE.ZOOM s (0.2 s under reduced motion), arrive. */
export function stepZoom(game, input, dt, ev) {
  const z = game.zone.zoom;
  if (!z) { setMode(game, 'drive', ev); return; }
  z.t += H;
  const len = game.settings?.reducedMotion ? game.tune.ZONE.ZOOM_REDUCED : game.tune.ZONE.ZOOM;
  if (z.t < len) return;
  const zr = game.zone;
  if (z.out) {
    const parent = zoneById(z.to);
    const pk = parent?.pocket;
    const back = pk?.back;
    const heading = back ? Math.atan2(back.dir[0], back.dir[1]) / DEG : 0;
    const keep = zr;
    game.pocketId = null;
    enterZone(game, parent, back ? { pos: back.pos, heading, speed: 'keep' } : null, ev);
    if (keep && game.zone !== keep) Object.assign(game.zone, { ...keep, zoom: null });
  } else {
    enterZone(game, zoneById(z.to), null, ev);
  }
  game.zone.zoom = null;
  setMode(game, 'drive', ev);
}

// ---------------------------------------------------------------- the action control

/**
 * actionOf(game, zoneData) → the chip the action control acts on now, in final.md 13.4's priority, or null:
 * { id: 'skip' | 'restart' | 'again' | 'retry' | 'take' | 'letgo' | 'jump' | 'zoomout' | 'cancel', hold?, to?,
 * mission? }. Labels are the HUD's (ui/hud.js CHIP by id). In the run-up a tap calls the jump off (jump.js).
 */
export function actionOf(game, zoneData = zoneOf(game)) {
  if (game?.mode === 'runup') return { id: 'cancel', to: game.jump?.to ?? game.zone?.jumpTo ?? null };
  if (!game || (game.mode !== 'drive' && game.mode !== 'ended')) return null;
  const R = game.tune.RACE;
  const m = game.mission;
  if (m?.skipOffered) return { id: 'skip' };
  const race = game.race;
  if (race && (race.state === 'running' || race.state === 'armed')) return { id: 'restart', hold: R.RESTART_HOLD };
  if (race && race.state === 'finished') return { id: 'again', event: race.id };
  const rt = game.zone?.retry;
  // No stunt RETRY during a mission: it would move the ship away from the job (a chase, a tow).
  if (rt && game.t <= rt.until && !race && !m) return { id: 'retry', stunt: rt.id };
  const offer = game.zone?.offer;
  if (offer && game.t <= offer.until && (!m || canPark(game))) return { id: 'take', mission: offer.mission };
  if (game.ship.tow) return { id: 'letgo', hold: game.tune.TOW.LETGO_HOLD };
  const exitTo = parentOfZone(game)?.exit?.to;
  if (game.zone?.exitOpen && exitTo && !game.pocketId) return { id: 'jump', to: exitTo };
  if (game.pocketId) return { id: 'zoomout' };
  return null;
}
function canPark(game) {
  const m = game.mission;
  return !!m && missionById(m.id)?.beats[m.beat]?.goal?.reach?.ring === 'exit';
}

/**
 * stepAction(game, input, ev): game.js's action slot. Holds: RACE.RESTART_HOLD restarts an event (from the press, so
 * control is back at CONTROL_BACK and the clock at CLOCK_START); TOW.LETGO_HOLD lets go of a tow. A tap does what the
 * chip says; with no chip it skips the line on the radio.
 */
export function stepAction(game, input, ev) {
  const zr = game.zone;
  const held = num(input?.actionHeld);
  const chip = actionOf(game);
  if (held <= 0) zr.holdUsed = false;
  if (held > 0 && !zr.holdUsed) {
    if ((chip?.id === 'restart' || chip?.id === 'again') && held >= game.tune.RACE.RESTART_HOLD) {
      zr.holdUsed = true;
      restartEvent(game, ev, game.t - held);
      return;
    }
    if (chip?.id === 'letgo' && held >= game.tune.TOW.LETGO_HOLD) {
      zr.holdUsed = true;
      releaseTow(game, ev, 'letgo');
      return;
    }
  }
  if (!input?.action) return;
  switch (chip?.id) {
    case 'skip': skipBeat(game, ev); break;
    case 'restart': toLastGate(game, ev); break;
    case 'again': restartEvent(game, ev, game.t); break;
    case 'retry': stuntRetry(game, ev); break;
    case 'take': startMission(game, chip.mission, 0, ev); break;
    case 'jump': startJump(game, ev); break;
    case 'zoomout': zoomOut(game, ev); break;
    case 'letgo': break;                                    // a tap is not enough: hold 1 s
    default: skipLine(game, ev); break;
  }
}

// ---------------------------------------------------------------- the step

/** stepZone(game, dt, ev): game.js's zone slot. */
export function stepZone(game, dt, ev) {
  const zoneData = zoneOf(game);
  if (!zoneData || !game.zone) return;
  const zr = game.zone;
  const t = game.t;
  // Arrival: the scale card 1 s after the drop-out, and Dot's "not to scale" once per zone if nothing else plays.
  if (!zr.scaleShown && t - game.arrivalT >= game.tune.ZONE.SCALE_CARD_DELAY && zoneData.scaleCard) {
    zr.scaleShown = true;
    showScaleCard(game, ev);
    say(game, 'dot.scale', { once: 'zone', quiet: true });
  }
  // Bests for Redshift's shout.
  if (ev && ev.list) {
    let i = ev.n - 1;
    while (i >= 0 && ev.list[i] && ev.list[i].t === t) i--;
    for (let j = i + 1; j < ev.n; j++) {
      const e = ev.list[j];
      if (e.type === 'chainBank' || e.type === 'chainLost') game.stats.bestChain = Math.max(num(game.stats.bestChain), e.n | 0);
      if (e.type === 'missionDone') rumoursFrom(game, zoneData, `mission:${e.id}`, ev);
      if (e.type === 'finish' && e.win) rumoursFrom(game, zoneData, `win:${e.id}`, ev);
    }
  }
  if (zr.rumourReq) {
    for (const id of zr.rumourReq) {
      const r = (zoneData.rumours || []).find((x) => x.id === id);
      if (r && !zr.rumours[id]) unlockRumour(game, r, ev);
    }
    zr.rumourReq = null;
  }
  stepSparks(game, zoneData, ev);
  stepScans(game, zoneData, dt, ev);
  stepLookHome(game, zoneData, dt, ev);
  stepSets(game, zoneData, ev);
  stepSecrets(game, zoneData, dt, ev);
  stepRings(game, zoneData, ev);
  if (zr.zoomReq && game.mode === 'drive') {
    const to = zr.zoomReq;
    zr.zoomReq = null;
    if (to === 'out') zoomOut(game, ev); else zoomTo(game, to, ev);
  }
  stepObjective(game, zoneData);
}

// ---------------------------------------------------------------- wiring

/**
 * steerToGate(game, input): Cruise's steer-to-gate while a race runs (final.md 2.9 rule 14, 13.4): with the stick
 * near the centre (|steer| < STG_CENTRE), up to STG_MAX of steer toward the next gate's line, fading out as the stick
 * moves. A player who steers hard is never overruled. Runs on the cleaned input just before the flight model.
 */
const STG_CENTRE = 0.3, STG_MAX = 0.35, STG_RANGE = 150, STG_CONE = 70 * DEG;
export function steerToGate(game, input) {
  const race = game.race;
  if (!race || race.state !== 'running' || game.settings?.assists === 'pilot' || !input) return;
  const a = Math.abs(input.steer);
  if (a >= STG_CENTRE) return;
  const data = eventById(game, race.id);
  const g = data ? course(data).gates[race.gate] : null;
  if (!g) return;
  const s = game.ship;
  const dx = g.pos[0] + g.n[0] * 3 - s.pos[0], dy = g.pos[1] + g.n[1] * 3 - s.pos[1];
  const d = Math.hypot(dx, dy);
  if (d > STG_RANGE) return;
  let err = Math.atan2(dx, dy) - s.yaw;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  if (Math.abs(err) > STG_CONE) return;
  input.steer += clamp(err * 2, -STG_MAX, STG_MAX) * (1 - a / STG_CENTRE);
}

// The flight model with the activities' input assists in front of it.
function shipSlot(game, input, dt, ev) {
  steerToGate(game, input);
  FLIGHT.ship(game, input, dt, ev);
}

/** ACTIVITIES: WP4's slots for game.js wire(): zoneRt, enter, actors, zone, race, mission, action, talk, zoom. */
export const ACTIVITIES = Object.freeze({
  zoneRt: createZoneRt, enter: enterActivities, actors: stepActors, zone: stepZone, race: stepRace,
  mission: stepMission, action: stepAction, talk: stepTalk, zoom: stepZoom,
});

/**
 * playSlots(extra) → every slot for a playable game: the flight model (ship.js FLIGHT, with Cruise's steer-to-gate in
 * front of it), these activities and Earth's clock, with the enter slots composed; extra adds or replaces slots
 * (core/jump.js's jump slot), and extra.arm is the jump's armJump, which the exit gate and the JUMP chip call:
 * playSlots({ jump: stepJump, arm: armJump }).
 */
export function playSlots(extra = {}) {
  setJumpArm(extra.arm || null);
  return {
    ...FLIGHT, ...ACTIVITIES, ship: shipSlot,
    enter(game, zoneData, ev) {
      FLIGHT.enter(game, zoneData, ev);
      setEarthClock(game, zoneData);
      enterActivities(game, zoneData, ev);
      if (extra.enter) extra.enter(game, zoneData, ev);
    },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'enter' && k !== 'arm')),
  };
}

