// Bot difficulty. A profile changes how a bot reads and decides, never its stats.
// Every rule here uses only what the bot's team can see. All randomness is a
// seeded hash, so replays stay deterministic.
import { SIZE } from './arena.js';
import { BASES, PATHS, PORTALS, CAMPS, CENTER, closestTrack, distance, visibleTo, canSee, lineOfSight, inBrush } from './world.js';
import { callRally } from './team-events.js';
import { structureProtected } from './objectives.js';

const K = SIZE / 6400;
export const DIFFICULTIES = ['apprentice', 'veteran', 'mythic'];
export const DEFAULT_DIFFICULTY = 'veteran';
export const DIFFICULTY_LABELS = { apprentice: 'Apprentice', veteran: 'Veteran', mythic: 'Mythic' };
export const DIFFICULTY_HINTS = { apprentice: 'Slow reactions. Few team plays.', veteran: 'Good reactions. Team plays.', mythic: 'Fast reactions. Sharp aim. Leaves losing fights. Drafts strong heroes.' };

// reaction: seconds from a new warning to the dodge [min, max]. dodge: chance that the step clears the shape.
// aimLead: share of the target's movement that the bot leads. aimError: units of aim spread.
// castLock: seconds between spell decisions. failLock: lock after a cast that did not start.
// reserve: share of the escape spell's mana kept back in a fight with a healthy hero.
// retreatAt: health share that always sends the bot home. engage: dash in on a weak target.
// retreatRules: leave when a tower targets the bot, or when hurt against a healthier enemy.
// tradeRetreat: margin for comparing both sides' health and damage (0 = no comparison).
// saveSpells: below this mana share, spells wait for heroes instead of the wave (1 = only at full mana).
// focus: score bonus for the team focus target. gankEvery: seconds between ganks (0 = never).
// wardBonus: target score bonus for an open enemy ward (ward health decides matches).
// guard: keep fight and roam moves out of untanked enemy ward range (guardMove).
// draft: weight of measured kit strength in this team's draft picks (0 = role and chance only).
// push: enemy heroes down before the team pushes a ward without a wave (0 = never).
// objectiveLead: seconds before the boss spawns that the team gathers (0 = never).
const OFF = { legacy: false, guard: true, draft: 0, wardBonus: 0, retreatRules: false, retreatAt: .28, engage: true, reserve: 1, reaction: [.3, .42], busy: .08, dodge: .75, aimLead: 0, aimError: 0, castLock: 1.1, failLock: 1.1, focus: 0, lowest: 0, punish: 0, saveSpells: 0, tradeRetreat: 0, waveGate: false, diveGuard: false, gankEvery: 0, camps: false, objectiveLead: 0, defend: false, push: 0 };
export const PROFILES = {
  // The bots before this change. Measurements compare every profile with it.
  legacy: { ...OFF, legacy: true, reaction: [.18, .3], dodge: 1 },
  apprentice: { ...OFF, retreatAt: .2, engage: false, reaction: [.45, .65], busy: .12, dodge: .5, aimError: 70, castLock: 1.8, failLock: 1.8, waveGate: true },
  veteran: { ...OFF, reaction: [.3, .42], dodge: .75, aimLead: .5, aimError: 35, castLock: .7, failLock: .25, saveSpells: 1, focus: 160, lowest: 90, punish: 140, waveGate: true, diveGuard: true, gankEvery: 80, camps: false, objectiveLead: 6, defend: true, push: 2, wardBonus: 260 },
  mythic: { ...OFF, reaction: [.24, .32], busy: .06, dodge: .9, aimLead: .6, aimError: 18, castLock: .6, failLock: .2, saveSpells: 1, focus: 160, lowest: 90, punish: 140, retreatRules: true, tradeRetreat: .75, waveGate: true, diveGuard: true, gankEvery: 80, camps: false, objectiveLead: 6, defend: true, push: 2, wardBonus: 260, draft: 3 },
};
// Allied bots stay at one competent level, whatever the enemy difficulty is: Veteran with full retreat discipline.
PROFILES.ally = { ...PROFILES.veteran, retreatRules: true, tradeRetreat: .75 };

// Kit strength by lane, measured by qa/tidebreak/kit-strength.mjs: the share of matches a team
// won with this kit in this lane, with equal Veteran bots on both sides. Index [kit][lane].
// 600 matches on the grand arena; each lane value is shrunk toward the kit's overall rate (100-game prior).
export const KIT_POWER = [
  [.47, .38, .42],
  [.58, .54, .56],
  [.48, .46, .45],
  [.59, .59, .63],
  [.54, .57, .57],
  [.55, .55, .55],
  [.56, .59, .57],
  [.26, .26, .28],
  [.36, .36, .34],
  [.52, .58, .56],
  [.55, .57, .5],
  [.55, .56, .57],
];
// A drafting profile adds this to a candidate's draft score. The pool and the board are the
// same for everyone, and the player sees every pick, so a strong draft is a fair edge.
export function draftValue(level, kit, lane) {
  const P = PROFILES[level];
  return P?.draft ? P.draft * ((KIT_POWER[kit]?.[lane] ?? .5) - .5) * 10 : 0;
}
export const normalDifficulty = id => DIFFICULTIES.includes(id) ? id : DEFAULT_DIFFICULTY;
// s.difficulty = [allied profile, enemy profile]. A match without it plays Veteran.
export function setDifficulty(s, enemy = DEFAULT_DIFFICULTY, ally = 'ally') { s.difficulty = [PROFILES[ally] ? ally : 'ally', PROFILES[enemy] ? enemy : DEFAULT_DIFFICULTY]; return s; }
export const profileId = (s, team) => s.difficulty?.[team] ?? (team ? DEFAULT_DIFFICULTY : 'ally');
export const botProfile = (s, e) => PROFILES[profileId(s, e.team)] || PROFILES[DEFAULT_DIFFICULTY];

// FNV-1a over the match seed, the bot and the event key. Returns [0, 1).
export function roll(s, e, key) {
  let h = 2166136261;
  for (const c of `${s.seed}:${e.id}:${key}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Time from a new warning to the dodge. Never below the profile floor.
// reactionAt keeps the old bots' exact arithmetic, so the legacy baseline replays the same.
export const reactionAt = (s, e, source, key) => botProfile(s, e).legacy ? s.time + .18 + ((e.id * 17 + source * 13) % 13) * .01 : s.time + reactionDelay(s, e, source, key);
export function reactionDelay(s, e, source, key) {
  const P = botProfile(s, e);
  if (P.legacy) return .18 + ((e.id * 17 + source * 13) % 13) * .01;
  const [low, high] = P.reaction;
  return low + (high - low) * roll(s, e, key) + (e.pendingAttack ? P.busy : 0);
}

const STRUCTURE = ['tower', 'core'], ESCORT = ['minion', 'leviathan'];
const enemyStructures = (s, team) => s.units.filter(t => STRUCTURE.includes(t.kind) && t.team !== team && t.team >= 0 && t.hp > 0);
// A ward is tanked when an allied wisp or the Wild Hunt stands in its range or at its edge: it shoots those
// first, and hero damage to it is not cut (sim.js escorted() counts the same kinds, out to range + 150).
export const escorted = (s, team, tower) => s.units.some(a => a.team === team && a.hp > 0 && ESCORT.includes(a.kind) && distance(a, tower) < tower.range + 20);
const inTowerRange = (s, team, p, margin = 0) => enemyStructures(s, team).find(t => distance(t, p) < t.range + margin);
// Enemy heroes still down by the public kill feed and the hero level above each head.
// A respawn takes 5 s plus the level, so the bot needs no hidden timer.
export function enemiesDown(s, team) {
  const down = new Set();
  for (const k of s.killFeed || []) { const v = s.units.find(u => u.id === k.victim); if (k.victimTeam !== team && v && s.time - k.time < 4 + (v.level || 1)) down.add(k.victim); }
  return down.size;
}
// Bots move to, stand at and hit an enemy ward only when their wave tanks it (outside sudden death).
export const wardOpen = (s, e, ward) => escorted(s, e.team, ward);
export const effectiveHp = t => (t.hp + (t.shield || 0)) * (1 + Math.max(0, t.armor || 0) / 100);
const dps = t => t.damage / Math.max(.3, t.rate || 1) * (t.kind === 'hero' ? 1.4 : 1);
export const punishable = (s, t) => t?.kind === 'hero' && (t.recoveryUntil > s.time || t.exposedUntil > s.time || t.stun > 0 || !!t.castIntent);
// A bot answers a punish window only after its reaction floor, like a warning.
export function punishes(s, e, t) {
  const P = botProfile(s, e);
  if (!P.punish || !t) return false;
  const seen = (e.punishSeen ||= {}), was = seen[t.id];
  if (!punishable(s, t)) { delete seen[t.id]; return false; }
  if (!was || s.time - was.last > .25) seen[t.id] = { at: s.time, last: s.time }; else was.last = s.time;
  return s.time - seen[t.id].at >= P.reaction[0];
}

// Recall as the player does: stand still for 2.5 s, and a hit cancels it. A bot starts only
// when it has not been hit for 3 s and sees no enemy hero close. Returns 'home' when done,
// true while it stands and channels, false when it should keep walking.
export function recallStep(s, e, dt) {
  if (s.time - e.lastHit < .2) { e.recall = 0; return false; }
  if (!e.recall) {
    if (s.time - e.lastHit <= 3 || s.units.some(t => t.kind === 'hero' && t.team !== e.team && t.hp > 0 && distance(e, t) < 900 * K && visibleTo(s, e.team, t))) return false;
    e.recall = 2.5;
  }
  e.recall -= dt;
  if (e.recall > 0) return true;
  e.recall = 0; return 'home';
}

export const castLock = (s, e, started) => { const P = botProfile(s, e); return started ? P.castLock : P.failLock; };

// The dodge step. A failed roll steps short, so a careless bot can still be hit.
// No profile but the old bots dodges into an enemy ward that nothing tanks.
// A bot keeps one dodge point for each warning. After a short step it goes back to its fight,
// so the warned attack can still hit it. Returns null when the bot is done dodging.
export function evadePoint(s, e, angle, immediate) {
  const P = botProfile(s, e), W = e.warningReaction;
  const key = W?.key || 'zone';
  const length = P.legacy || immediate || roll(s, e, key + ':dodge') < P.dodge ? 320 : 120;
  const point = a => ({ x: e.x + Math.cos(a) * length, y: e.y + Math.sin(a) * length });
  if (P.legacy) return point(angle);
  const keep = !immediate && W;
  if (keep && W.dodge) { if (distance(e, W.dodge) > 12) return W.dodge; if (W.dodge.short) return null; }
  let pick = point(angle);
  if (!s.suddenDeath) for (const a of [angle, angle + .9, angle - .9, angle + Math.PI]) {
    const p = point(a), t = inTowerRange(s, e.team, p, 40);
    if (!t || escorted(s, e.team, t)) { pick = p; break; }
  }
  if (keep) W.dodge = { ...pick, short: length < 320 };
  return pick;
}

// Tower-dive guard. Attacking t means standing in range of it. If an enemy
// tower covers that spot, the bot counts the tower damage it will take.
// The enemy ward that covers the spot where the bot would stand to hit t.
function standWard(s, e, t) {
  const d = Math.max(1, distance(e, t)), reach = Math.min(d, e.range + (t.radius || 0));
  return inTowerRange(s, e.team, { x: t.x + (e.x - t.x) / d * reach, y: t.y + (e.y - t.y) / d * reach }, 10);
}
export function diveSafe(s, e, t, allies = []) {
  const P = botProfile(s, e);
  if (!P.diveGuard || STRUCTURE.includes(t.kind)) return true;
  const tower = standWard(s, e, t);
  if (!tower) return true;
  if (t.kind !== 'hero') return escorted(s, e.team, tower);
  // A hero hit under its tower turns the tower on the attacker, so a wave does not make this safe.
  const team = allies.filter(a => a.hp > 0 && distance(a, t) < 700 * K);
  const time = effectiveHp(t) / Math.max(1, team.reduce((v, a) => v + dps(a), 0) || dps(e));
  const taken = tower.damage / tower.rate * 1.45 * (time + 1.2);
  return t.hp < t.maxHp * .15 && taken < e.hp * .5;
}

// Trade-aware retreat. Each side's value is its effective health times its damage.
export function tradeRetreat(s, e, heroes, hurt) {
  const P = botProfile(s, e);
  if (!P.tradeRetreat && !P.retreatRules) return false;
  const near = 900 * K, foes = heroes.filter(t => distance(e, t) < near);
  const towerOnMe = enemyStructures(s, e.team).find(t => t.towerTarget === e.id && t.towerUntil > s.time && distance(t, e) < t.range + 30);
  if (towerOnMe && hurt < .6 && !(foes.length && foes.every(t => diveSafe(s, e, t, [e])))) return true;
  if (!foes.length) return false;
  const friends = s.units.filter(a => a.kind === 'hero' && a.team === e.team && a.hp > 0 && distance(a, e) < near * .8);
  const value = list => list.reduce((v, t) => v + effectiveHp(t), 0) * list.reduce((v, t) => v + dps(t), 0);
  const covering = enemyStructures(s, e.team).filter(t => distance(t, e) < t.range + 60);
  const ours = value(friends), theirs = value(foes) + covering.reduce((v, t) => v + dps(t) * 1.4, 0) * friends.reduce((v, t) => v + effectiveHp(t), 0) * .5;
  if (hurt < .5 && friends.length <= foes.length && foes.some(t => t.hp / t.maxHp - hurt >= .25)) return true;
  // Only profiles with a trade margin weigh both sides.
  return !!P.tradeRetreat && hurt < .8 && ours < theirs * P.tradeRetreat;
}

// Closest distance from c to the walk from a to b.
const pathGap = (a, b, c) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, u = l ? Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / l)) : 0;
  return Math.hypot(a.x + dx * u - c.x, a.y + dy * u - c.y);
};
// Move guard for every profile: a bot never steps into the range of an enemy ward or rift that
// no allied wave unit tanks, in any mode but retreat and evade (evadePoint has its own tower check). An approved dive (diveSafe) and sudden
// death are the exceptions. Inside such range the bot steps out along the line from the ward.
export function guardMove(s, e, intent) {
  const P = botProfile(s, e), point = intent.move;
  if (P.legacy || !P.guard || s.suddenDeath || intent.mode === 'retreat' || intent.mode === 'evade') return point;
  // An approved dive may enter the ward that covers its target, and no other ward.
  const target = intent.target, allies = s.units.filter(a => a.kind === 'hero' && a.team === e.team && a.hp > 0 && distance(e, a) < 650);
  const dive = target?.kind === 'hero' && P.diveGuard && diveSafe(s, e, target, allies) ? standWard(s, e, target) : null;
  const wards = enemyStructures(s, e.team).filter(t => t !== dive && !wardOpen(s, e, t));
  const inside = wards.find(t => distance(t, e) < t.range + 10);
  if (inside) { const d = Math.max(1, distance(inside, e)), k = (inside.range + 90) / d; return { x: inside.x + (e.x - inside.x) * k, y: inside.y + (e.y - inside.y) * k }; }
  const ward = point && wards.find(t => pathGap(e, point, t) < t.range + 40);
  if (!ward) return point;
  // Never stand still while a plan is held: wait at the edge for a goal under the ward,
  // or walk around the ward along its range + 60 circle toward the goal.
  const r = ward.range + 60, d = Math.max(1, distance(ward, e)), base = Math.atan2(e.y - ward.y, e.x - ward.x);
  if (distance(ward, point) < ward.range + 40) return { x: ward.x + Math.cos(base) * r, y: ward.y + Math.sin(base) * r };
  const side = (e.x - ward.x) * (point.y - ward.y) - (e.y - ward.y) * (point.x - ward.x) >= 0 ? 1 : -1, a = base + side * (Math.acos(Math.min(1, r / d)) + .35);
  return { x: ward.x + Math.cos(a) * r, y: ward.y + Math.sin(a) * r };
}
// Wave-gated lane walking. Without a wave in front, the bot waits outside tower range.
export function laneHold(s, e) {
  if (!botProfile(s, e).waveGate) return null;
  const path = e.team ? [...PATHS[e.lane]].reverse() : PATHS[e.lane];
  const index = closestTrack(e, path), ahead = path[Math.min(path.length - 1, index + 2)];
  const margin = 120 * K, tower = inTowerRange(s, e.team, ahead, margin) || inTowerRange(s, e.team, e, margin);
  if (!tower || wardOpen(s, e, tower)) return null;
  let i = index;
  while (i > 0 && distance(path[i], tower) < tower.range + margin) i--;
  return { x: path[i].x, y: path[i].y };
}

// Aim at where the target will be when the windup ends, with a seeded error.
export function leadAim(s, e, t, aim) {
  const P = botProfile(s, e);
  if (P.legacy || !t) return aim;
  const track = e.aimTrack;
  if (track?.id === t.id && s.time - track.time >= .1) {
    const dt = s.time - track.time, vx = (t.x - track.x) / dt, vy = (t.y - track.y) / dt;
    e.aimTrack = { id: t.id, x: t.x, y: t.y, time: s.time, vx: (track.vx + vx) / 2, vy: (track.vy + vy) / 2 };
  } else if (track?.id !== t.id) e.aimTrack = { id: t.id, x: t.x, y: t.y, time: s.time, vx: 0, vy: 0 };
  if (t.kind !== 'hero') return aim;
  const v = e.aimTrack, lead = P.aimLead * .5, spread = (roll(s, e, `aim:${t.id}:${Math.floor(s.time * 2)}`) - .5) * 2 * P.aimError;
  const fx = t.x + Math.max(-220, Math.min(220, v.vx * lead)) - e.x, fy = t.y + Math.max(-220, Math.min(220, v.vy * lead)) - e.y;
  const d = Math.max(1, Math.hypot(fx, fy)), x = fx - fy / d * spread, y = fy + fx / d * spread;
  return { x, y, distance: Math.hypot(x, y) };
}

// Extra target score. Lower is better.
export function targetBonus(s, e, t, inRange) {
  const P = botProfile(s, e);
  if (P.legacy) return 0;
  // Ward health decides a match at the time limit, so an open ward beats farming.
  if (STRUCTURE.includes(t.kind)) return -P.wardBonus;
  if (t.kind !== 'hero') return 0;
  const focus = s.botFocus?.[e.team];
  // The team focus counts only in reach, so a bot does not run past a closer threat.
  return (focus?.id === t.id && focus.until > s.time && distance(e, t) < e.range + 380 * K ? -P.focus : 0) - (punishes(s, e, t) ? P.punish : 0) - (inRange[0]?.id === t.id ? P.lowest : 0);
}
// Visible enemy heroes in reach, lowest effective health first.
export const lowestInRange = (e, heroes) => heroes.filter(t => distance(e, t) < e.range + 260 * K).sort((a, b) => effectiveHp(a) - effectiveHp(b) || a.id - b.id);

// Team focus: the visible enemy hero that the team can kill fastest. Changes every 2 seconds.
export function teamFocus(s, team) {
  s.botFocus ||= [null, null];
  const current = s.botFocus[team];
  if (current && current.until > s.time) return current;
  const mine = s.units.filter(a => a.kind === 'hero' && a.team === team && a.hp > 0);
  let best = null, score = Infinity;
  for (const t of s.units) {
    if (t.kind !== 'hero' || t.team === team || t.hp <= 0 || !visibleTo(s, team, t)) continue;
    const near = mine.filter(a => distance(a, t) < 900 * K);
    if (!near.length) continue;
    const n = effectiveHp(t) / Math.max(1, near.reduce((v, a) => v + dps(a), 0));
    if (n < score || n === score && best && t.id < best.id) { score = n; best = t; }
  }
  return s.botFocus[team] = { id: best?.id ?? 0, until: s.time + 2 };
}

// Shortest way to a point, through a rift gate when that saves time.
export function routeTo(s, e, dest) {
  const direct = distance(e, dest);
  if (e.portalCd > 0) return { move: dest };
  let best = null, cost = direct - 3 * e.speed;
  // Base gates choose their exit by facing; the sim's lane start uses them. Bots route through river gates.
  for (const gate of PORTALS) {
    if (gate.choices) continue;
    const via = distance(e, gate) + distance(PORTALS[gate.to], dest);
    if (via < cost) { cost = via; best = gate; }
  }
  if (!best) return { move: dest };
  return { move: best, portal: distance(e, best) < 140 };
}

// What the team knows about each spirit camp, from its own vision only.
function campKnown(s, team, i) {
  s.botCamps ||= [[], []];
  const memory = s.botCamps[team], camp = s.units.find(u => u.kind === 'camp' && u.camp === i && u.hp > 0);
  if (camp && visibleTo(s, team, camp)) return memory[i] = { up: true, camp };
  const watched = s.units.some(a => a.team === team && a.hp > 0 && a.kind === 'hero' && distance(a, CAMPS[i]) < 500 * K && lineOfSight(s, a, CAMPS[i]) && !inBrush(s, CAMPS[i]));
  if (watched && !camp) memory[i] = { up: false, at: s.time };
  const seen = memory[i];
  return { up: !seen || seen.up || s.time - seen.at > 32, camp: seen?.up ? camp : null };
}

// The lane a unit stands nearest to, from its seen position.
const wardRank = t => t.kind === 'core' ? 9 : t.tier ?? 0;
const laneOf = p => PATHS.map(path => distance(p, path[closestTrack(p, path)])).reduce((best, d, i, all) => d < all[best] ? i : best, 0);
const quiet = (s, e, radius) => !s.units.some(t => t.kind === 'hero' && t.team !== e.team && t.hp > 0 && distance(e, t) < radius && visibleTo(s, e.team, t));
const plan = (s, team) => (s.botPlan ||= [{}, {}])[team];

// Strategy for a bot that has no hero to fight: objective, defence, push, gank, camp.
// Returns a decision or null. Each choice moves the bot where players can see it.
export function strategy(s, e, { target, hurt, holding }) {
  const P = botProfile(s, e);
  if (P.legacy) return null;
  const T = plan(s, e.team), old = T.gank && s.units.find(u => u.id === T.gank.id);
  // A gank ends on time, or when its bot falls. Then the next gank can start.
  if (T.gank && (s.time >= T.gank.until || !old || old.hp < old.maxHp * .45)) { T.gank = null; T.gankAt = s.time + P.gankEvery; }
  if (hurt < .45) return null;
  const team = s.units.filter(a => a.kind === 'hero' && a.team === e.team), foes = s.units.filter(a => a.kind === 'hero' && a.team !== e.team);
  const free = !target || holding;
  // Gather on our side of the boss pit before it wakes. One bot calls the team.
  const wait = s.objectiveAt - s.time;
  if (P.objectiveLead && !s.objective && wait > 0 && wait < P.objectiveLead && hurt > .6 && distance(e, CENTER) < 2600 * K && free) {
    const home = BASES[e.team], d = distance(home, CENTER), spot = { x: CENTER.x + (home.x - CENTER.x) / d * 520 * K, y: CENTER.y + (home.y - CENTER.y) / d * 520 * K };
    if (T.rallyFor !== s.objectiveAt) { T.rallyFor = s.objectiveAt; callRally(s, e.team, spot, e); }
    return { mode: 'objective', ...routeTo(s, e, spot) };
  }
  // Answer a defend ping. The closest healthy bot goes, to the structure nearest the base first:
  // the core, then guardians, then inner, middle and outer wards. Among equals, the latest call.
  if (P.defend && hurt > .55 && (!target || target.kind !== 'hero')) {
    const calls = (s.pings || []).filter(p => p.team === e.team && p.type === 'defend' && s.time - p.time < 7).reverse();
    const ward = calls.map(p => s.units.find(t => t.id === p.target && t.hp > 0)).filter(Boolean).sort((a, b) => wardRank(b) - wardRank(a))[0];
    if (ward && distance(e, ward) < 3400 * K && distance(e, ward) > 300 * K) {
      const bots = team.filter(a => !a.player && a.hp > 0 && a.hp > a.maxHp * .55);
      if (bots.sort((a, b) => distance(a, ward) - distance(b, ward) || a.id - b.id)[0]?.id === e.id) return { mode: 'assist', call: 'defend', ...routeTo(s, e, ward) };
    }
  }
  if (!free) return null;
  // Push after a won fight: enemies down, walk to the lane where our wave is deepest.
  if (P.push && enemiesDown(s, e.team) >= P.push && hurt > .6) {
    let best = null, score = Infinity;
    for (const ward of enemyStructures(s, e.team)) if (wardOpen(s, e, ward) && !structureProtected(s, ward)) { const n = distance(e, ward); if (n < score) { score = n; best = ward; } }
    if (best && score > best.range) return { mode: 'push', ...routeTo(s, e, best) };
  }
  // Gank: our lane is pushed, an enemy hero the team can see is hurt or on our half of the map.
  const gank = T.gank;
  if (gank?.id === e.id) {
    const prey = s.units.find(t => t.id === gank.target && t.hp > 0 && visibleTo(s, e.team, t));
    if (prey && s.time < gank.until) return { mode: 'gank', ...routeTo(s, e, prey) };
    T.gank = null; T.gankAt = s.time + P.gankEvery;
  } else if (P.gankEvery && !gank && holding && s.time >= (T.gankAt ?? 60) && hurt > .7) {
    const prey = foes.filter(t => t.hp > 0 && visibleTo(s, e.team, t) && laneOf(t) !== e.lane && (t.hp < t.maxHp * .7 || distance(t, BASES[e.team]) < distance(t, BASES[t.team])) && diveSafe(s, e, t, team))
      .sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0];
    if (prey) {
      const route = routeTo(s, e, prey), eta = (route.move === prey ? distance(e, prey) : distance(e, route.move) + distance(PORTALS[route.move.to], prey)) / (e.speed * 1.35);
      if (eta < 12) { T.gank = { id: e.id, target: prey.id, until: s.time + eta + 6 }; return { mode: 'gank', ...route }; }
    }
  }
  // Spirit camps: only when safe and the team saw the camp up, or its respawn is due.
  if (P.camps && s.time > 30 && holding && quiet(s, e, 1300 * K)) {
    let best = null, score = 1800 * K;
    for (let i = 0; i < CAMPS.length; i++) {
      const known = campKnown(s, e.team, i), d = distance(e, CAMPS[i]);
      if (known.up && d < score && !inTowerRange(s, e.team, CAMPS[i], 100)) { score = d; best = { i, camp: known.camp }; }
    }
    if (best) {
      const camp = best.camp && canSee(s, e, best.camp) ? best.camp : null;
      if (camp && camp.leash) return null;
      return camp ? { mode: 'camp', target: camp, move: distance(e, camp) > e.range + camp.radius ? camp : undefined } : { mode: 'camp', ...routeTo(s, e, CAMPS[best.i]) };
    }
  }
  return null;
}
