import { KITS } from './abilities.js';
import { manaCost } from './combat-rules.js';
import { distance, lineOfSight, visibleTo, inWater } from './world.js';
import { castTiming, spellBlocked } from './combat-state.js';

const MARKS = [
  ['wet', 'wetUntil', 'WET', '#91f4df'],
  ['brine', 'brineUntil', 'BRINE', '#bfadf1'],
  ['chill', 'chillUntil', 'CHILL', '#a4dfff'],
  ['spirit', 'spiritUntil', 'SPIRIT', '#ffca99'],
];
export function combatMarks(unit, time) {
  return MARKS.filter(([,field]) => unit[field] > time).map(([type,field,label,color]) => ({ type, label, color, remaining: unit[field] - time }));
}
// A root is independent of stun. Multiple active controls keep their own labels.
export function controlLabels(unit, time) {
  const labels = [];
  if (unit.stun > 0) labels.push('STUNNED');
  if (unit.fear > 0) labels.push('FEARED');
  if (unit.snaredUntil > time) labels.push('ROOTED');
  if (unit.silencedUntil > time) labels.push('SILENCED');
  if (unit.disarmedUntil > time) labels.push('DISARMED');
  return labels;
}

function combination(s, p, t) {
  const time = s.time;
  switch (p.hero) {
    case 1: return (t.wetUntil > time || inWater(t,s)) && { slot:2, range:350, until:t.wetUntil>time?t.wetUntil:time+1, color:'#91f4df', bonus:'Wet stun' };
    case 2: return t.snaredUntil > time && { slot:2, range:570, delay:.7, until:t.snaredUntil, color:'#ffd699', bonus:'Root bonus' };
    case 3: return t.bleed?.until > time && { slot:1, range:300, until:t.bleed.until, color:'#ff9989', bonus:'Longer fear' };
    case 4: return t.brineUntil > time && { slot:2, range:550, until:t.brineUntil, color:'#bfadf1', bonus:'Brine bonus' };
    case 5: return t.chillUntil > time && t.hp < t.maxHp && { slot:2, range:280, until:t.chillUntil, color:'#a4dfff', bonus:'Chill bonus' };
    case 6: return t.spiritUntil > time && { slot:2, range:550, delay:.45, until:t.spiritUntil, color:'#ffca99', bonus:'Spirit bonus' };
    case 9: return (t.bleed?.type==='fire' && t.bleed.until > time || t.burn?.until > time) && { slot:2, range:650, until:Math.max(t.bleed?.type==='fire'?t.bleed.until:0,t.burn?.until||0), color:'#ffc16d', bonus:'Burn bonus' };
    case 11: return t.bleed?.type==='poison' && t.bleed.until > time && { slot:3, range:390, until:t.bleed.until, color:'#a9dfb7', bonus:'Poison bonus' };
    case 12: return t.chained?.until > time && { slot:2, range:320, until:t.chained.until, color:'#a9c5d0', bonus:'Chained' };
    case 13: return t.kind === 'hero' && t.hp < t.maxHp * .5 && { slot:3, range:650, until:time+1, color:'#ff908b', bonus:'Execute' };
    default: return null;
  }
}

export function followUpFeedback(s, p, { visible, sight = visibleTo, clear = lineOfSight } = {}) {
  if (!p || p.hp <= 0 || s.winner != null || p.stun > 0 || p.fear > 0 || p.silencedUntil > s.time || p.castIntent || p.recoveryUntil > s.time) return null;
  const targets = s.units.filter(t => t.hp > 0 && t.team !== p.team && !['tower','core'].includes(t.kind) && (visible ? visible.has(t.id) : sight(s,p.team,t)) && clear(s,p,t));
  targets.sort((a,b) => (a.id===p.target?-1:0)-(b.id===p.target?-1:0) || distance(p,a)-distance(p,b) || a.id-b.id);
  for (const t of targets) {
    const combo = combination(s,p,t);
    if (!combo || !p.skillRanks?.[combo.slot] || p.cd?.[combo.slot] > 0 || spellBlocked(s,p,combo.slot) || !(p.mana >= manaCost(p,combo.slot)) || distance(p,t) >= combo.range+(t.radius||0) || combo.until-s.time <= castTiming(p,combo.slot).windup+(combo.delay||0)) continue;
    return { ...combo, targetId:t.id, remaining:Math.max(0,combo.until-s.time), label:`${KITS[p.hero][combo.slot].label} · ${combo.bonus}` };
  }
  return null;
}

export const RESULT_COLORS = { combo:'#fff0b2', 'shield-break':'#bdefff', interrupt:'#ffc1a6', kill:'#e8ce8f', exposed:'#ffc989', dodge:'#c8f3ff' };
export const RESULT_LABELS = { combo:'COMBO', 'shield-break':'SHIELD BREAK', interrupt:'INTERRUPTED', kill:'BANISHED', exposed:'OPENING HIT', dodge:'DODGED' };
export function recentCombatFeedback(s, p, { visible, age = .8, radius = 650 } = {}) {
  return (s.combatFeedback || []).filter(event => {
    const elapsed = s.time-event.time;
    if (elapsed < 0 || elapsed >= age || !RESULT_COLORS[event.type]) return false;
    if (event.source===p.id || event.target===p.id) return true;
    return visible && (visible.has(event.source) || visible.has(event.target)) && distance(p,event)<radius;
  });
}
