// Light Years Home v3: missions from data (final.md 8, story §3). A mission is beats; a beat has an objective, a goal,
// fails, setup and lines. Missions start by driving through a giver's ring, by TAKE JOB in the TAKE_JOB s after a
// radio call, or by themselves (auto). A fail shows its toast and retries MISSION.RETRY s later from the last
// checkpoint, ship, actors, cargo and clocks as they were; after SKIP_AFTER fails there, SKIP THIS PART finishes the
// mission with no medal, so the fix is never withheld. A side job may start while the story mission only waits for
// the exit gate: the story mission is parked and done when you jump.
import { missionById } from './world/missions/ch1.js';
import { OPENING } from './world/lines/ch1.js';
import { say, endOpening, dropQueued } from './talk.js';
import { spawn, actorById, catchable, despawn, releaseTow, tossItem } from './actors.js';
import { medalOf, betterMedal, cancelEvent } from './race.js';
import { zoneOf } from './game.js';

export const GOALS = Object.freeze(['reach', 'near', 'hook', 'away', 'drop', 'scan', 'takedown', 'catch', 'stunt', 'all']);
export const FAILS = Object.freeze(['timeLimit', 'contacts', 'actorLost', 'gapOver', 'reaches', 'leftZone']);

const LEFT_ZONE = 120;       // u past the rim that a leftZone fail allows
const REOFFER = 60;          // s before a call nobody took comes again (at most twice more)
const num = (x, d = 0) => (typeof x === 'number' && x === x && x !== Infinity && x !== -Infinity ? x : d);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Story beats that belong to no single mission's data: Redshift wakes up 8 s after the fix (final.md 12.1).
const AFTER_BEAT = Object.freeze({ 'which-way-home:2': [{ line: 'red.woke', delay: 8 }] });

const clone = (v) => (ArrayBuffer.isView(v) ? v.slice() : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);

function progressOf(game, id) {
  const p = game.progress.missions || (game.progress.missions = {});
  return p[id] || (p[id] = {});
}

const missionDone = (game, id) => !!game.progress.missions?.[id]?.done;

/** beatDone(game, id, k) → true once beat k of mission id is done (or the mission is). */
export function beatDone(game, id, k) {
  const p = game.progress.missions?.[id];
  if (p?.done) return true;
  if (game.mission?.id === id && game.mission.beat > k) return true;
  return num(p?.beat, -1) > k;
}

/** when(game, rule) → true when a rule such as 'mission:x', 'beatDone:x:2', 'rumour:x' or 'line:x' holds. */
export function when(game, rule) {
  if (!rule) return true;
  const [kind, a, b] = String(rule).split(':');
  if (kind === 'mission') return missionDone(game, a);
  if (kind === 'beatDone') return beatDone(game, a, Number(b));
  if (kind === 'rumour') return !!game.zone?.rumours?.[a];
  if (kind === 'line') return Number.isFinite(game.talk?.heard?.[a]);
  if (kind === 'event') return !!game.progress.events?.[a]?.medal;
  return false;
}

// ---------------------------------------------------------------- starting

/**
 * startMission(game, id, beat = 0, ev) → true. Cancels a running event, parks a story mission that only waits for
 * the exit, runs the mission's setup and enters the beat. The start is a checkpoint.
 */
export function startMission(game, id, beat = 0, ev = null) {
  const data = missionById(id);
  if (!data || missionDone(game, id)) return false;
  if (game.race) cancelEvent(game, ev, true);
  const cur = game.mission;
  if (cur && cur.id !== id) {
    if (!parkable(game)) return false;
    progressOf(game, cur.id).beat = cur.beat;
    progressOf(game, cur.id).parked = true;
  }
  game.mission = {
    id, beat: 0, t: 0, beatT: 0, fails: data.beats.map(() => 0), skipOffered: false, checkpoint: null, flags: {},
    retryAt: 0, state: 'running', count: 0, skipped: false, cpBeat: 0, gapT: 0, sub: [], target: {}, beatAt: [],
    kills: 0, waypoint: null, tossed: false, hitsTaken: 0,
  };
  game.activity = { kind: 'mission', id };
  game.zone.offer = null;
  const p = progressOf(game, id);
  p.started = true;
  delete p.parked;
  if (OPENING.endsWith === `mission:${id}`) endOpening(game, ev);
  if (ev) ev.push('missionStart', { id, title: data.title, beat });
  for (const s of data.setup || []) applySetup(game, s, ev);
  enterBeat(game, data, Math.max(0, Math.min(beat, data.beats.length - 1)), ev, true);
  return true;
}

// A story mission whose current beat only asks for the exit gate can wait while a side job runs.
function parkable(game) {
  const m = game.mission;
  if (!m) return true;
  const data = missionById(m.id);
  const goal = data?.beats[m.beat]?.goal;
  return m.state === 'running' && goal?.reach?.ring === 'exit';
}

function applySetup(game, s, ev) {
  const m = game.mission;
  if (s.spawn) {
    spawn(game, s.spawn, ev);
  } else if (s.cargo) {
    game.ship.cargo = { kind: s.cargo.kind, contacts: 0, scratched: false };
  } else if (s.ring) {
    const r = s.ring;
    const rings = game.zone.missionRings || (game.zone.missionRings = []);
    const k = rings.findIndex((x) => x.id === r.id);
    const item = { id: r.id, pos: [r.pos[0], r.pos[1], r.pos[2] || 0], r: r.r, label: r.label || null, kind: 'mission' };
    if (k >= 0) rings[k] = item; else rings.push(item);
    m.waypoint = item;
  } else if (s.wellsOff) {
    game.zone.wellsOff = s.wellsOff.slice();
  } else if (s.objectiveRing !== undefined) {
    const o = s.objectiveRing;
    m.waypoint = Array.isArray(o) ? o.slice() : o;
  } else if (s.guide) {
    m.guide = true;
  }
}

function ringOf(game, id) {
  if (!id) return null;
  if (typeof id === 'object') return id;
  const z = zoneOf(game);
  if (id === 'exit') return z?.exit ? { id: 'exit', pos: z.exit.pos, r: z.exit.r } : null;
  if (id === 'pocket') return z?.pocket?.ring ? { id: 'pocket', ...z.pocket.ring } : null;
  return (game.zone.missionRings || []).find((r) => r.id === id) || (z?.rings || []).find((r) => r.id === id) || null;
}

function enterBeat(game, data, k, ev, start = false) {
  const m = game.mission;
  const beat = data.beats[k];
  m.beat = k; m.beatT = 0; m.count = 0; m.sub = []; m.gapT = 0; m.kills = 0; m.tossed = false;
  m.beatAt[k] = m.t;
  m.waypoint = null;
  m.skipOffered = false;
  // Lines still waiting from another beat's start are stale now: they go to the log.
  const stale = data.beats.flatMap((b, j) => (j === k ? [] : b.lines?.start || []));
  if (stale.length) dropQueued(game, stale, ev);
  for (const s of beat.setup || []) applySetup(game, s, ev);
  // A default objective from the goal when the beat names none.
  if (!m.waypoint) m.waypoint = goalWaypoint(game, beat.goal);
  // Stunt goals with orBetter ask for one star more than you hold (at most 3).
  for (const g of flatGoals(beat.goal)) {
    if (g.stunt) m.target[g.stunt.id] = stuntTarget(game, g.stunt);
  }
  const rg = beat.goal?.reach?.ring;
  if (rg && typeof rg === 'object') applySetup(game, { ring: rg }, ev);
  for (const id of beat.lines?.start || []) say(game, id, { mission: true });
  if (start || beat.checkpoint) checkpoint(game);
  if (ev) ev.push('beat', { id: m.id, beat: k, objective: beat.objective || null });
  progressOf(game, m.id).beat = Math.max(num(progressOf(game, m.id).beat, 0), k);
}

function flatGoals(g) {
  if (!g) return [];
  return g.all ? g.all.flatMap(flatGoals) : [g];
}

function stuntTarget(game, s) {
  const held = num(game.progress.stunts?.[s.id]?.stars, 0);
  const min = num(s.min, 1);
  return s.orBetter && held >= min ? Math.min(3, held + 1) : min;
}

/** raisedFor(game, id) → true when an orBetter stunt goal of the mission asks for more than its min. */
export function raisedFor(game, id) {
  const data = missionById(id);
  if (!data) return false;
  return data.beats.some((b) => flatGoals(b.goal).some((g) => g.stunt && stuntTarget(game, g.stunt) > num(g.stunt.min, 1)));
}

function goalWaypoint(game, g) {
  if (!g) return null;
  if (g.reach) return typeof g.reach.ring === 'object' ? { ...g.reach.ring } : g.reach.ring;
  if (g.drop) return g.drop.ring;
  if (g.near) return `actor:${g.near.actor}`;
  if (g.hook) return `actor:${g.hook.actor}`;
  if (g.takedown) return `actor:${g.takedown.actors[0]}`;
  if (g.catch) return `actor:${g.catch.item}`;
  if (g.scan) return g.scan.ids.slice();
  if (g.stunt || g.all) {
    const z = zoneOf(game);
    const out = [];
    for (const s of flatGoals(g)) {
      const e = s.stunt && (z?.events || []).find((x) => x.id === s.stunt.id);
      const p = e?.ring?.pos || (e?.area?.centre && [...e.area.centre, 0]) || e?.pads?.[0];
      if (p) out.push({ id: e.id, pos: [p[0], p[1], p[2] || 0], label: e.title, r: e.ring?.r || e.area?.r || 6 });
    }
    return out.length ? out : null;
  }
  return null;
}

// ---------------------------------------------------------------- checkpoints, fails, retries, skips

function checkpoint(game) {
  const m = game.mission;
  m.cpBeat = m.beat;
  m.checkpoint = { beat: m.beat, t: m.t, zoneT: game.zoneT, ship: clone(game.ship), actors: clone(game.actors),
    contacts: game.ship.cargo?.contacts ?? 0, wellsOff: game.zone.wellsOff ? game.zone.wellsOff.slice() : null,
    count: m.count, kills: m.kills, beatAt: m.beatAt.slice() };
}

/** failMission(game, reason, ev, toast): the toast, then a retry MISSION.RETRY s later from the checkpoint. */
export function failMission(game, reason, ev = null, toast = null) {
  const m = game.mission;
  if (!m || m.state !== 'running') return false;
  const M = game.tune.MISSION;
  m.state = 'failed';
  m.retryAt = game.t + M.RETRY;
  m.fails[m.cpBeat] = num(m.fails[m.cpBeat]) + 1;
  if (ev) ev.push('fail', { id: m.id, reason, toast, beat: m.beat });
  if (reason === 'contacts' && ev) ev.push('cargoBreak', { id: m.id });
  if (m.fails[m.cpBeat] >= M.SKIP_AFTER && !m.skipOffered) {
    m.skipOffered = true;
    if (ev) ev.push('skipOffer', { id: m.id, beat: m.beat });
  }
  return true;
}

/** retry(game, ev): back to the last checkpoint: the ship, the actors, the cargo's contacts, the clocks. */
export function retry(game, ev = null) {
  const m = game.mission;
  const cp = m?.checkpoint;
  if (!m || !cp) return false;
  const data = missionById(m.id);
  const s = clone(cp.ship);
  s.prev.pos = s.pos.slice(); s.prev.yaw = s.yaw; s.prev.pitch = s.pitch; s.prev.bank = s.bank;
  game.ship = s;
  game.actors = clone(cp.actors);
  if (game.ship.cargo) game.ship.cargo.contacts = cp.contacts;
  game.zoneT = cp.zoneT;
  game.zone.wellsOff = cp.wellsOff ? cp.wellsOff.slice() : null;
  if (game.near?.ids) { game.near.n = 0; game.near.ids.fill(-1); if (game.near.away) game.near.away.fill(0); }
  m.t = cp.t;
  m.state = 'running';
  m.retryAt = 0;
  const skip = m.skipOffered;
  enterBeat(game, data, cp.beat, null);
  m.skipOffered = skip;
  m.count = cp.count; m.kills = cp.kills; m.beatAt = cp.beatAt.slice();
  if (ev) ev.push('retry', { id: m.id, beat: cp.beat, speed: s.speed });
  return true;
}

/** skipBeat(game, ev): SKIP THIS PART: the mission is done with no medal (the fix is never withheld). */
export function skipBeat(game, ev = null) {
  const m = game.mission;
  if (!m || !m.skipOffered) return false;
  m.skipped = true;
  m.state = 'running';
  completeMission(game, ev);
  return true;
}

// ---------------------------------------------------------------- goals

const P = [0, 0, 0];

function goalMet(game, g, ev, i0, k = 0) {
  const m = game.mission;
  const ship = game.ship;
  if (g.all) {
    let n = 0;
    g.all.forEach((sub, j) => {
      if (!m.sub[j] && goalMet(game, sub, ev, i0, j)) {
        m.sub[j] = true;
        const data = missionById(m.id);
        for (const id of data.beats[m.beat].lines?.progress || []) say(game, id, { mission: true });
      }
      if (m.sub[j]) n++;
    });
    m.count = n;
    return n >= g.all.length;
  }
  if (g.reach) {
    const r = ringOf(game, g.reach.ring);
    return !!r && segNear(ship, r.pos, num(r.r, 8));
  }
  if (g.near) {
    const a = actorById(game, g.near.actor);
    return !!a && dist(ship.pos, a.pos) <= num(g.near.within, 30);
  }
  if (g.hook) return ship.tow?.actor === g.hook.actor;
  if (g.away) {
    const a = actorById(game, g.away.actor);
    const b = (zoneOf(game)?.bodies || []).find((x) => x.id === g.away.from);
    return !!a && !!b && dist(a.pos, b.pos) >= num(g.away.r, 100);
  }
  if (g.drop) {
    const r = ringOf(game, g.drop.ring);
    if (!r || !segNear(ship, r.pos, num(r.r, 8))) return false;
    if (g.drop.carry === 'tow') return releaseTow(game, ev, 'drop');
    if (g.drop.carry === 'cargo') {
      if (!ship.cargo) return false;
      ship.cargo = null;
      if (ev) ev.push('release', { cargo: true });
    }
    return true;
  }
  if (g.scan) {
    const n = g.scan.ids.filter((id) => game.zone.scanned?.[id]).length;
    m.count = n;
    return n >= num(g.scan.n, g.scan.ids.length);
  }
  if (g.takedown) {
    for (let i = i0; i < (ev?.n || 0); i++) {
      const e = ev.list[i];
      if (e.type === 'takedown' && g.takedown.actors.includes(e.id)) m.kills++;
    }
    m.count = m.kills;
    return m.kills >= num(g.takedown.n, 1);
  }
  if (g.catch) {
    const c = g.catch;
    let it = actorById(game, c.item);
    if (!it && c.from && !m.tossed) {
      // A thrower tosses the item across your path when you come within tossWithin.
      const from = actorById(game, c.from);
      if (from && dist2(ship.pos, from.pos) <= num(c.tossWithin, 60)) {
        m.tossed = true;
        const fx = Math.sin(ship.yaw), fy = Math.cos(ship.yaw);
        const ahead = [ship.pos[0] + fx * 45, ship.pos[1] + fy * 45, ship.pos[2]];
        const side = (from.pos[0] - ship.pos[0]) * fy - (from.pos[1] - ship.pos[1]) * fx >= 0 ? 1 : -1;
        const start = [ahead[0] + fy * 20 * side, ahead[1] - fx * 20 * side, ahead[2]];
        tossItem(game, c.item, start, { along: [-fy * side, fx * side], speed: 8, kick: 0 }, ev);
        const data = missionById(m.id);
        for (const id of data.beats[m.beat].lines?.toss || []) say(game, id, { mission: true });
        it = actorById(game, c.item);
      }
    }
    if (it && catchable(game, it)) {
      despawn(game, c.item);
      if (ev) ev.push('hook', { actor: c.item, item: true });
      return true;
    }
    return false;
  }
  if (g.stunt) {
    const target = m.target[g.stunt.id] ?? num(g.stunt.min, 1);
    for (let i = i0; i < (ev?.n || 0); i++) {
      const e = ev.list[i];
      if (e.type === 'stuntResult' && e.id === g.stunt.id && e.stars >= target) return true;
    }
    return false;
  }
  return false;
}

// Within r of a point this step (the segment from the last position, so speed never skips a ring).
function segNear(ship, c, r) {
  const p0 = ship.prev.pos, p1 = ship.pos;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const l2 = dx * dx + dy * dy + dz * dz;
  let f = l2 > 1e-12 ? ((c[0] - p0[0]) * dx + (c[1] - p0[1]) * dy + ((c[2] || 0) - p0[2]) * dz) / l2 : 0;
  f = Math.max(0, Math.min(1, f));
  P[0] = p0[0] + dx * f; P[1] = p0[1] + dy * f; P[2] = p0[2] + dz * f;
  return Math.hypot(P[0] - c[0], P[1] - c[1], P[2] - (c[2] || 0)) <= r;
}

function failCheck(game, f, dt) {
  const m = game.mission;
  const ship = game.ship;
  if (f.timeLimit) {
    const from = num(m.beatAt[num(f.timeLimit.from, 0)], 0);
    return m.beat >= num(f.timeLimit.from, 0) && m.t - from >= f.timeLimit.s ? 'timeLimit' : null;
  }
  if (f.contacts) return num(ship.cargo?.contacts) >= f.contacts.n ? 'contacts' : null;
  if (f.actorLost) {
    const a = actorById(game, f.actorLost.actor);
    const b = (zoneOf(game)?.bodies || []).find((x) => x.id === f.actorLost.body);
    return a && b && dist(a.pos, b.pos) <= num(f.actorLost.r, 10) ? 'actorLost' : null;
  }
  if (f.gapOver) {
    const a = actorById(game, f.gapOver.actor);
    if (!a || a.state === 'beaten' || a.state === 'fleeing') { m.gapT = 0; return null; }
    m.gapT = dist(ship.pos, a.pos) > f.gapOver.u ? m.gapT + dt : 0;
    return m.gapT >= num(f.gapOver.s, 5) ? 'gapOver' : null;
  }
  if (f.reaches) {
    const a = actorById(game, f.reaches.actor);
    return a && dist2(a.pos, f.reaches.at) <= num(f.reaches.r, 20) ? 'reaches' : null;
  }
  if (f.leftZone) {
    const R = zoneOf(game)?.R ?? 700;
    return Math.hypot(ship.pos[0], ship.pos[1]) > R + LEFT_ZONE ? 'leftZone' : null;
  }
  return null;
}

// ---------------------------------------------------------------- done

function completeBeat(game, data, ev) {
  const m = game.mission;
  const beat = data.beats[m.beat];
  for (const id of beat.lines?.done || []) say(game, id, { mission: true });
  for (const od of beat.onDone || []) {
    if (od.actor && od.set) { const a = actorById(game, od.actor); if (a) Object.assign(a, clone(od.set)); }
    if (od.cargo) game.ship.cargo = { kind: od.cargo.kind, contacts: 0, scratched: false };
    if (od.line) say(game, od.line, { mission: true });
    if (od.zoom) game.zone.zoomReq = od.zoom;
    if (od.zoomOut) game.zone.zoomReq = 'out';
  }
  for (const a of AFTER_BEAT[`${m.id}:${m.beat}`] || []) say(game, a.line, { mission: true, story: true, at: game.t + a.delay });
  progressOf(game, m.id).beat = m.beat + 1;
  if (m.beat + 1 >= data.beats.length) completeMission(game, ev);
  else enterBeat(game, data, m.beat + 1, ev);
}

/** completeMission(game, ev): medal, rewards (fix, card, tape, stripe, trail, rumour, shout, flag), lines. */
export function completeMission(game, ev = null) {
  const m = game.mission;
  if (!m) return false;
  const data = missionById(m.id);
  const time = m.t;
  let medal = m.skipped || !data.medals ? null : medalOf(data.medals, time);
  if (medal && (medal === 'gold' || medal === 'tern') && data.medals.goldAlso && m.flags.goldLost) medal = 'silver';
  const p = progressOf(game, m.id);
  const best = Number.isFinite(p.best) && (!Number.isFinite(time) || p.best <= time) ? p.best : time;
  Object.assign(p, { done: true, medal: betterMedal(p.medal || null, medal), best,
    pilot: game.settings?.assists === 'pilot', beat: data.beats.length });
  delete p.parked;
  const prog = game.progress;
  for (const r of data.rewards || []) {
    if (r.fix && ev) ev.push('fix', { id: m.id, to: r.fix });
    if (r.tape && !prog.tapes.includes(r.tape)) prog.tapes.push(r.tape);
    if (r.stripe && !prog.stripes.includes(r.stripe)) prog.stripes.push(r.stripe);
    if (r.trail && !prog.trails.includes(r.trail)) prog.trails.push(r.trail);
    if (r.card) (p.cards || (p.cards = [])).includes(r.card) || p.cards.push(r.card);
    if (r.flag) game.story.flags[r.flag] = true;
    if (r.shout) say(game, r.shout, { mission: true, vars: { n: Math.max(3, num(game.stats.bestChain, 0)) } });
    if (r.rumour) game.zone.rumourReq = [...(game.zone.rumourReq || []), r.rumour];
  }
  for (const id of data.lines?.done || []) say(game, id, { mission: true });
  if (ev) ev.push('missionDone', { id: m.id, title: data.title, medal, time, skipped: m.skipped });
  game.story.doneAt = game.story.doneAt || {};
  game.story.doneAt[m.id] = game.t;
  game.mission = null;
  if (game.activity?.kind === 'mission') game.activity = null;
  if (game.zone.missionRings) game.zone.missionRings = [];
  game.zone.wellsOff = null;
  // A parked story mission comes back.
  const parked = Object.keys(prog.missions).find((id) => prog.missions[id].parked && !prog.missions[id].done);
  if (parked) startMission(game, parked, num(prog.missions[parked].beat, 0), ev);
  return true;
}

/** onJump(game, ev): the run-up started (the exit gate or JUMP): a beat or parked mission that wanted the exit is done. */
export function onJump(game, ev = null) {
  const m = game.mission;
  if (m && missionById(m.id)?.beats[m.beat]?.goal?.reach?.ring === 'exit') {
    completeBeat(game, missionById(m.id), ev);
  }
  for (const [id, p] of Object.entries(game.progress.missions || {})) {
    const data = missionById(id);
    if (!p.parked || p.done || !data) continue;
    if (data.beats[num(p.beat, 0)]?.goal?.reach?.ring !== 'exit') continue;
    const keep = game.mission;
    game.mission = { id, beat: p.beat, t: 0, skipped: false, flags: {}, beatAt: [] };
    completeMission(game, ev);
    game.mission = keep;
  }
}

/** missionTakesLine(game, scanId) → the line the current beat plays for that scan (beat.lines.on), or undefined. */
export function missionLineFor(game, scanId, firstOfThree = false) {
  const m = game.mission;
  if (!m) return undefined;
  const on = missionById(m.id)?.beats[m.beat]?.lines?.on;
  const v = on?.[scanId];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  return firstOfThree ? v.ifFirst : v.else;
}

// ---------------------------------------------------------------- offers and starts

function stepStarts(game, ev, i0) {
  const z = zoneOf(game);
  if (!z || game.mode !== 'drive') return;
  const t = game.t;
  const st = game.story;
  const k = game.talk;
  for (const id of z.missions || []) {
    const data = missionById(id);
    if (!data || data.zone !== (game.zoneId) || missionDone(game, id)) continue;
    const p = game.progress.missions?.[id];
    if (game.mission && game.mission.id === id) continue;
    if (p?.parked) continue;
    const s = data.start || {};
    if (s.auto && !game.mission && !game.race) {
      const a = s.auto;
      const tp = t - num(st.playAt, 0);
      const ta = t - game.arrivalT;
      let go = false;
      if (Number.isFinite(a.afterArrival)) go = ta >= a.afterArrival;
      if (Number.isFinite(a.afterPlay)) {
        const d = a.near ? dist2(game.ship.pos, a.near.pos) : 0;
        const near = !a.near || d <= a.near.within;
        // enter: driving into the place's own ring starts it at once (after its own few seconds).
        const inside = !!(a.enter && a.near) && d <= a.enter.within && tp >= num(a.enter.afterPlay, 0);
        go = inside || (tp >= a.afterPlay && near) || (Number.isFinite(a.orAfterPlay) && tp >= a.orAfterPlay);
      }
      if (go) { startMission(game, id, 0, ev); return; }
    }
    // Radio calls: the line plays, and TAKE JOB shows for MISSION.TAKE_JOB s from its start.
    if (s.call) {
      const c = s.call;
      const calls = game.zone.calls || (game.zone.calls = {});
      const cs = calls[id] || (calls[id] = { n: 0, at: null, line: null });
      if (cs.at === null) {
        let ready = null;
        if (c.after && when(game, c.after)) ready = num(k.heard?.[c.after.split(':')[1]], t) + 0.5;
        if (Number.isFinite(c.afterArrival)) ready = game.arrivalT + c.afterArrival;
        if (c.afterMission && missionDone(game, c.afterMission)) ready = num(st.doneAt?.[c.afterMission], t) + num(c.delay);
        if (ready !== null) cs.at = ready;
      }
      if (cs.at !== null && t >= cs.at && cs.n < 3 && !cs.line && (!game.mission || parkable(game)) && !game.race) {
        const raised = raisedFor(game, id);
        const lineId = raised && data.beats[0].lines?.raised?.[0] ? data.beats[0].lines.raised[0] : c.line;
        cs.line = lineId;
        cs.asked = t;
        cs.n++;
        say(game, lineId, { mission: true });
        p || progressOf(game, id);
        progressOf(game, id).offered = true;
      }
      // The offer opens when the call line starts (or is dropped): TAKE JOB for MISSION.TAKE_JOB s from then.
      if (cs.line) {
        const cur = k.cur?.id === cs.line ? k.cur : null;
        const gone = !cur && Number.isFinite(k.heard?.[cs.line]) && k.heard[cs.line] >= cs.asked;
        if (cur || gone) {
          const from = cur ? cur.t0 : t;
          game.zone.offer = { mission: id, until: from + game.tune.MISSION.TAKE_JOB };
          if (ev) ev.push('missionOffer', { mission: id, until: game.zone.offer.until });
          cs.line = null;
          cs.at = t + REOFFER;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- the step

/** stepMission(game, dt, ev): game.js's mission slot. */
export function stepMission(game, dt, ev) {
  if (!game.zone) return;
  let i0 = 0;
  if (ev && ev.list) {
    i0 = ev.n - 1;
    while (i0 >= 0 && ev.list[i0] && ev.list[i0].t === game.t) i0--;
    i0++;
  }
  if (game.zone.offer && game.t > game.zone.offer.until) game.zone.offer = null;
  stepStarts(game, ev, i0);
  const m = game.mission;
  if (!m) return;
  const data = missionById(m.id);
  if (!data) { game.mission = null; return; }
  if (m.state === 'failed') {
    if (game.t >= m.retryAt) retry(game, ev);
    return;
  }
  m.t += dt;
  m.beatT += dt;
  const beat = data.beats[m.beat];
  // Gold's second condition (a hit on the load, a scratch on the cargo).
  for (let i = i0; i < (ev?.n || 0); i++) {
    const e = ev.list[i];
    if (e.type === 'cargoHit') m.flags.goldLost = true;
  }
  // Fails: the beat's, then the mission's.
  for (const f of [...(beat.fails || []), ...(data.fails || [])]) {
    const why = failCheck(game, f, dt);
    if (why) { failMission(game, why, ev, f.toast || null); return; }
  }
  if (goalMet(game, beat.goal, ev, i0)) completeBeat(game, data, ev);
  else if (m.waypoint && typeof m.waypoint === 'string' && m.waypoint.startsWith('actor:')) {
    // A catch goal's item appears later (a takedown drops it): point at it once it exists.
    const g = beat.goal;
    if (g.catch && actorById(game, g.catch.item)) m.waypoint = `actor:${g.catch.item}`;
  }
}
