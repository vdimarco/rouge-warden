// Team facts recorded by the deterministic simulation. Presentation reads them;
// bots read pings and skirmishes to rotate like teammates.
import { distance, visibleTo, PATHS, closestTrack } from './world.js';
import { ROTATION_SCALE } from './arena.js';

export const MULTI_KILL_WINDOW = 12;
export const ALARM_COOLDOWN = 14;
export const RALLY_TIME = 12;
const FIGHT_PING_COOLDOWN = 7;
export const MISSING_AFTER = 4, MISSING_COOLDOWN = 25;
const LANE_NEAR = 320 * ROTATION_SCALE;
// Assist and rally reach follow the map size, so rotations still happen on the bigger shore.
const ASSIST_RANGE = 1900 * ROTATION_SCALE;
const RALLY_RANGE = 3200 * ROTATION_SCALE;

export function pushPing(s, ping) {
  s.pings ||= [];
  s.nextPing = (s.nextPing || 0) + 1;
  const entry = { id: s.nextPing, time: s.time, ...ping, x: Math.round(ping.x), y: Math.round(ping.y) };
  s.pings.push(entry);
  if (s.pings.length > 32) s.pings.shift();
  return entry;
}

// Hero-against-hero damage marks both sides as fighting and pings each team once per area.
export function noteSkirmish(s, a, b) {
  if (a?.kind !== 'hero' || b?.kind !== 'hero' || a.team === b.team) return;
  a.skirmishUntil = b.skirmishUntil = s.time + 3;
  b.attackers ||= {}; b.attackers[a.id] = s.time;
  s.fightPingAt ||= [-99, -99];
  for (const team of [a.team, b.team]) {
    if (s.time - s.fightPingAt[team] < FIGHT_PING_COOLDOWN) continue;
    s.fightPingAt[team] = s.time;
    pushPing(s, { team, type: 'fight', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, source: team === a.team ? a.id : b.id });
  }
}

export function noteStructureHit(s, source, structure) {
  if (!['tower', 'core'].includes(structure.kind) || source.team === structure.team || source.team < 0) return;
  if (s.time < (structure.alarmAt ?? -99)) return;
  structure.alarmAt = s.time + ALARM_COOLDOWN;
  pushPing(s, { team: structure.team, type: 'defend', x: structure.x, y: structure.y, target: structure.id, lane: structure.lane, structure: structure.kind, tier: structure.tier });
}

export function recordKill(s, killer, victim) {
  s.killFeed ||= [];
  const hero = killer?.kind === 'hero' ? killer : null;
  const firstBlood = !s.firstBlood;
  s.firstBlood = true;
  const victimStreak = victim.streak || 0;
  let multi = 0, streak = 0;
  if (hero) {
    hero.multi = s.time - (hero.multiAt ?? -99) <= MULTI_KILL_WINDOW ? (hero.multi || 0) + 1 : 1;
    hero.multiAt = s.time;
    hero.streak = (hero.streak || 0) + 1;
    multi = hero.multi; streak = hero.streak;
  }
  victim.streak = 0; victim.multi = 0;
  const assists = Object.entries(victim.attackers || {}).filter(([id, at]) => +id !== hero?.id && s.time - at < 8).map(([id]) => +id);
  victim.attackers = {};
  const teamDown = s.units.filter(u => u.kind === 'hero' && u.team === victim.team).every(u => u.hp <= 0);
  const entry = { id: s.killFeed.length ? s.killFeed.at(-1).id + 1 : 1, time: s.time, killer: hero?.id ?? killer?.id ?? 0, killerKind: killer?.kind || 'unknown', killerTeam: killer?.team ?? -1, victim: victim.id, victimTeam: victim.team, firstBlood, multi, streak, shutdown: victimStreak >= 3 ? victimStreak : 0, assists, teamWipe: teamDown, x: Math.round(victim.x), y: Math.round(victim.y) };
  s.killFeed.push(entry);
  if (s.killFeed.length > 40) s.killFeed.shift();
  return entry;
}

export function callRally(s, team, point, source) {
  s.rally ||= [null, null];
  s.rally[team] = { x: point.x, y: point.y, until: s.time + RALLY_TIME, source: source?.id ?? 0 };
  return pushPing(s, { team, type: 'rally', x: point.x, y: point.y, source: source?.id ?? 0 });
}

// A healthy bot answers a rally call, then an ally's fight. Returns a point to move to.
export function assistPoint(s, e, health = e.hp / e.maxHp) {
  const rally = s.rally?.[e.team];
  if (rally && rally.until > s.time && health > .45 && distance(e, rally) < RALLY_RANGE && distance(e, rally) > 180) return { x: rally.x, y: rally.y, kind: 'rally' };
  if (health < .6) return null;
  const ally = s.units.filter(a => a.kind === 'hero' && a.team === e.team && a.id !== e.id && a.hp > 0 && a.skirmishUntil > s.time && distance(a, e) < ASSIST_RANGE && distance(a, e) > 260)
    .sort((a, b) => distance(a, e) - distance(b, e) || a.id - b.id)[0];
  return ally ? { x: ally.x, y: ally.y, kind: 'assist', ally: ally.id } : null;
}

// A "missing" call, as players make: an enemy hero the player's team saw in a lane
// has been out of their sight for 4 s. Only the team's own vision counts.
export function noteMissing(s) {
  const seen = (s.sightings ||= {});
  for (const h of s.units) {
    if (h.kind !== 'hero' || h.team !== 1) continue;
    const last = seen[h.id];
    if (h.hp <= 0) { if (last) last.open = false; continue; }
    if (visibleTo(s, 0, h)) {
      const near = PATHS.map(path => distance(h, path[closestTrack(h, path)])), lane = near.indexOf(Math.min(...near));
      seen[h.id] = { time: s.time, x: h.x, y: h.y, lane: near[lane] < LANE_NEAR ? lane : -1, open: true, calledAt: last?.calledAt ?? -99 };
    } else if (last?.open && last.lane >= 0 && s.time - last.time > MISSING_AFTER && s.time - last.calledAt > MISSING_COOLDOWN) {
      last.open = false; last.calledAt = s.time;
      pushPing(s, { team: 0, type: 'missing', target: h.id, lane: last.lane, x: last.x, y: last.y });
    }
  }
}
