import { isEngage } from './combat-tells.js';
// Shared action rules. Roots restrain voluntary movement, not the whole hero.
export const rooted = (s,e) => (e.snaredUntil || 0) > s.time;
export const movementSpell = (e,slot) => slot === 0 && [0,1,2,3,6,7,8,9].includes(e.hero);
export const spellBlocked = (s,e,slot) => e.hp <= 0 || e.stun > 0 || e.fear > 0 || e.silencedUntil > s.time || (rooted(s,e) && movementSpell(e,slot));

// These are gameplay commitments. Low-level cast() resolves a legal spell.
const WINDUPS = [
 [0,.24,0,.36], [0,.32,.3,.4], [0,0,0,.32], [0,.22,.24,0],
 [0,.32,.4,.38], [0,0,.24,.32], [0,0,0,.28], [0,.34,0,0],
 [0,.3,0,.36], [0,0,.2,0], [0,0,0,.34], [0,0,.38,.34],
];
export function castTiming(e,slot,bot=false) {
 // Engages that stun on contact (leap, charge) get a path tell. Other slot 0 spells are escapes.
 const engage = isEngage(e,slot), defensive = !engage && (slot===0 || slot===2&&[7,10].includes(e.hero) || slot===3&&[3,9].includes(e.hero));
 const windup = defensive ? 0 : engage ? (bot?.45:.3) : bot ? (slot===3?.7:.5) : WINDUPS[e.hero]?.[slot] || 0;
 // Major attacks should create a real answer window. The tell gives the defender
 // time to dodge; the recovery gives them time to punish a miss instead of
 // immediately resetting into another action.
 const recovery = windup<=0 ? 0 : slot===3 ? .34 : windup>=.3 ? .26 : .22;
 return {windup,recovery};
}

export function emitCombatFeedback(s,source,target,type,label='') {
 if(!source || !target || (!source.player && !target.player))return;
 s.combatFeedback ||= [];
 if(s.combatFeedback.some(f=>f.type===type&&f.source===source.id&&f.target===target.id&&s.time-f.time<.5))return;
 s.nextFeedback=(s.nextFeedback||0)+1;
 s.combatFeedback.push({id:s.nextFeedback,time:s.time,type,source:source.id,target:target.id,x:target.x,y:target.y,hero:source.hero,label});
 if(s.combatFeedback.length>20)s.combatFeedback.shift();
}
