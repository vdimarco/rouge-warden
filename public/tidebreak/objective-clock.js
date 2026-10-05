// Objective timers for the HUD: when the Wild Hunt wakes, when the realm shifts, and a
// rest hint between peaks. Pure, so the 3D HUD and tests read the same values.
import { SHIFT } from './world.js';
export const SOON = 10, REST_LEAD = 20;
export function objectiveClock(s, p) {
  const boss = s.units.find(e => e.kind === 'boss' && e.hp > 0), huntIn = boss ? 0 : Math.max(0, s.objectiveAt - s.time);
  const realmIn = SHIFT - s.time % SHIFT;
  const hunt = boss ? { key: 'hunt', label: 'WILD HUNT AWAKE', seconds: 0, state: 'peak' } : { key: 'hunt', label: 'WILD HUNT', seconds: Math.ceil(huntIn), state: huntIn <= SOON ? 'soon' : 'wait' };
  const realm = { key: 'realm', label: s.phase ? 'TOWN RETURNS' : 'WOODS ARRIVE', seconds: Math.ceil(realmIn), state: realmIn <= 6 ? 'soon' : 'wait' };
  // Rest: out of combat, with no peak close. The hint names what to do with the time.
  const quiet = p && p.hp > 0 && s.time - (p.lastHit ?? -100) > 4 && !(p.skirmishUntil > s.time);
  const rest = quiet && !boss && huntIn > REST_LEAD ? { key: 'rest', label: 'QUIET · HEAL OR SHOP', seconds: null, state: 'rest' } : null;
  return { hunt, realm, rest, items: [hunt, rest].filter(Boolean) };
}
export const clockText = item => item.seconds ? `${item.label} ${Math.floor(item.seconds / 60)}:${String(item.seconds % 60).padStart(2, '0')}` : item.label;
