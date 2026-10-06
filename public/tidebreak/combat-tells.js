// Combat feel rules shared by the sim and both renderers: hit history, punish windows,
// tower lock-on, engage tells, impact weights and the cast input buffer.
// Everything here is deterministic. Presentation (hitstop, shake, sound) reads the data.
import { SIZE } from './arena.js';
import { resolveBody, SUDDEN_DEATH } from './world.js';
import { ATTACK_TIMINGS } from './basic-attacks.js';
const SCALE = SIZE / 6400;
export const RECAP_SECONDS = 8, RECAP_LIMIT = 48;
// A tower holds fire this long after it picks a new hero target.
export const TOWER_LOCK = .35;
// Basic attacks on heroes miss when the target is this far past attack range at contact.
export const DODGE_SLACK = 35 * SCALE;
// A press this close to the end of a cast or recovery is kept and cast when the hero is free.
export const CAST_BUFFER = .12;
// A committed cast that hits no enemy hero leaves the caster exposed for longer.
export const MISS_EXPOSE = .5, ULT_MISS_EXPOSE = .7, INTERRUPT_EXPOSE = .4;
// Heroes take this much more damage from heroes while exposed.
export const EXPOSED_BONUS = 1.15;
// Lane mana regeneration per second. A lower rate makes spells compete for mana.
export const manaRegen = level => 3.5 + level * .25;
// Engage spells that stun or knock back on contact. They get a windup with a path tell.
// The leap (sim.js) and the charge (legend-rules.js) read these same numbers, so the tell
// shows the real reach. They do not scale with the map, because the moves do not.
export const ENGAGES = { 3: { length: 460, radius: 160, step: 25 }, 7: { length: 460, radius: 110, step: 0 } };
export const isEngage = (e, slot) => slot === 0 && !!ENGAGES[e.hero];
export const engageLength = (hero, rank = 1) => ENGAGES[hero].length + (rank - 1) * ENGAGES[hero].step;
// Given the match state, the end is pushed out of cover, as the leap and the aim preview (skill-aim.js) push the hero.
export function engageShape(e, angle, rank = 1, s = null) {
  const length = engageLength(e.hero, rank), end = { x: e.x + Math.cos(angle) * length, y: e.y + Math.sin(angle) * length, radius: e.radius };
  if (s) resolveBody(s, end);
  return { x: e.x, y: e.y, tx: end.x, ty: end.y, angle, radius: ENGAGES[e.hero].radius, shape: 'path', engage: true };
}

// ---- The damage of a hero's next basic attack on t, worked out as attack() in sim.js does it:
// the chain strike on the same target, an ambush on a hero, and the sudden-death rise. Armor comes later.
export function strikeDamage(s, e, t) {
  const variant = e.comboTarget === t.id && s.time <= (e.comboUntil || 0) ? e.comboNext || 0 : 0;
  const rise = s.suddenDeath ? 1 + (s.time - SUDDEN_DEATH) / 150 : 1;
  return e.damage * rise * (e.ambushReady && t.kind === 'hero' ? 1.75 : 1) * ATTACK_TIMINGS[variant].damage;
}

// ---- Hit history for the death recap. The caller sets s.hitContext around a damage source.
export function withContext(s, context, fn) { const before = s.hitContext; s.hitContext = context; try { return fn(); } finally { s.hitContext = before; } }
export function recordHit(s, source, credit, target, amount, absorbed, kind) {
  if (target.kind !== 'hero' || (amount <= 0 && absorbed <= 0)) return;
  const who = credit || source, c = s.hitContext && (!s.hitContext.source || s.hitContext.source === source.id) ? s.hitContext : null;
  const log = target.damageLog ||= [];
  log.push({ time: s.time, source: who.id, sourceKind: who.kind, name: who.name || who.kind, hero: who.kind === 'hero' ? who.hero : undefined, team: who.team, type: kind, label: c?.label || defaultLabel(who, kind), amount, absorbed, telegraphed: !!c?.telegraphed, dodgeable: !!c?.dodgeable, controlled: controlState(s, target) });
  while (log.length > RECAP_LIMIT || log.length && s.time - log[0].time > RECAP_SECONDS) log.shift();
}
function defaultLabel(who, kind) {
  if (kind === 'attack') return who.kind === 'tower' ? 'Tower shot' : who.kind === 'core' ? 'Rift shot' : 'Basic attack';
  if (kind === 'item') return 'Item effect';
  if (kind === 'reflect') return 'Reflected damage';
  return 'Spell';
}
function controlState(s, e) { return e.stun > 0 ? 'stunned' : e.fear > 0 ? 'feared' : e.snaredUntil > s.time ? 'rooted' : e.silencedUntil > s.time ? 'silenced' : ''; }
// Hard control time, kept as merged intervals for the recap.
export function noteControl(s, e, dt) {
  const kind = e.stun > 0 ? 'stunned' : e.fear > 0 ? 'feared' : '';
  if (!kind) return;
  const log = e.controlLog ||= [], last = log.at(-1);
  if (last && last.kind === kind && s.time - last.to <= dt * 1.5) last.to = s.time; else log.push({ kind, from: s.time - dt, to: s.time });
  while (log.length > 12 || log.length && s.time - log[0].to > RECAP_SECONDS) log.shift();
}

// ---- Punish windows. A commit opens before the cast resolves and is judged when its
// instant hits are known (after a charge, when the charge ends). A cast aimed at a hero
// needs a hero hit; a cast aimed at anything else needs any hit. A cast that places a
// zone, trap or missile is judged by its placement, since its damage comes later.
const placed = s => s.zones.length + s.traps.length + s.missiles.length;
export function openCommit(s, e, slot, heroAim) { judgeCommit(s, e); e.commit = { slot, at: s.time, judgeAt: s.time, hit: false, ult: slot === 3, heroAim, placed: placed(s) }; }
export function closeCommit(s, e, cast) {
  if (!e.commit) return;
  if (!cast) { e.commit = null; return; }
  if (placed(s) > e.commit.placed) e.commit.hit = true;
  // A charge is judged when it ends, by what the charge itself hit. Damage from
  // anything else (a bleed tick, a summon, a basic attack) never counts for it.
  if (e.travel && e.travel.start === s.time) { e.commit.judgeAt = s.time + e.travel.duration; e.commit.travel = e.travel; }
  judgeCommit(s, e);
}
export function noteCommitHit(s, credit, target) {
  const c = credit?.kind === 'hero' && credit.commit;
  if (!c || target.team === credit.team || target.team < 0 && c.heroAim) return;
  if (target.kind !== 'hero' && c.heroAim) return;
  // A charge counts only what the charge itself touched. The travel marks each body in
  // hitIds just before it damages it, so a bleed tick elsewhere never counts for it.
  if (c.travel && !(credit.travel === c.travel && c.travel.hitIds.includes(target.id))) return;
  c.hit = true;
}
export function judgeCommit(s, e) {
  const c = e.commit; if (!c || s.time < c.judgeAt) return;
  e.commit = null;
  if (!c.hit) { const time = c.ult ? ULT_MISS_EXPOSE : MISS_EXPOSE; expose(s, e, time, 'miss'); e.recoveryUntil = Math.max(e.recoveryUntil || 0, s.time + time); }
  else if (c.ult && e.recoveryUntil > s.time) expose(s, e, e.recoveryUntil - s.time, 'ultimate');
}
export function expose(s, e, seconds, reason) {
  if (e.hp <= 0 || seconds <= 0) return;
  if ((e.exposedUntil || 0) < s.time + seconds) { e.exposedUntil = s.time + seconds; e.exposeReason = reason; e.exposedAt = s.time; }
}
// True when a hero hit on this hero earns the opening bonus.
export const heroOpening = (s, credit, target) => target.kind === 'hero' && credit?.kind === 'hero' && credit.team !== target.team && target.exposedUntil > s.time;

// ---- Tower lock-on. Returns true while the tower must hold fire on this hero.
export function towerLock(s, tower, target) {
  if (!target || target.kind !== 'hero') { tower.lockTarget = 0; return false; }
  if (tower.lockTarget !== target.id) { tower.lockTarget = target.id; tower.lockStart = s.time; tower.lockAt = s.time + TOWER_LOCK; }
  return s.time < tower.lockAt;
}

// ---- Impacts: weighted events for hitstop, shake and sound. Weight 1 heavy, 2 ultimate, 3 hero kill.
export function pushImpact(s, source, target, weight, kind) {
  const list = s.impacts ||= [];
  s.nextImpact = (s.nextImpact || 0) + 1;
  list.push({ id: s.nextImpact, time: s.time, x: target.x, y: target.y, weight, kind, source: source?.id ?? 0, target: target.id });
  if (list.length > 16) list.shift();
}

// ---- Cast input buffer. A blocked press near the end of a lock waits on the hero.
export function lockRemaining(s, e) {
  const i = e.castIntent;
  return Math.max(i ? i.at - s.time + (i.recovery || 0) : 0, (e.recoveryUntil || 0) - s.time, 0);
}
export function bufferCast(s, e, slot, aim, ready = true) {
  const left = lockRemaining(s, e);
  if (!ready || left <= 0 || left > CAST_BUFFER + 1e-9) return false;
  e.queuedCast = { slot, aim, at: s.time, until: s.time + left + .25 };
  return true;
}

// ---- Windup pose for renderers: progress 0..1 from the first cue to the hit.
export function windupState(e, time) {
  const i = e.castIntent || e.specialIntent;
  if (i && time >= i.start && time < i.at) return { progress: (time - i.start) / Math.max(.001, i.at - i.start), kind: e.specialIntent ? 'neutral' : i.shape?.engage ? 'engage' : i.slot === 3 ? 'ultimate' : 'cast', at: i.at };
  if ((e.kind === 'tower' || e.kind === 'core') && e.lockTarget && time < e.lockAt) return { progress: Math.max(0, Math.min(1, (time - e.lockStart) / TOWER_LOCK)), kind: 'lock', at: e.lockAt, target: e.lockTarget };
  return null;
}
