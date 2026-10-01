// Shared identifiers match the pinned C# exports. Simulation never loads images.
export const FAMILIES = Object.freeze(['quadruped', 'biped', 'reptile', 'arthropod', 'winged', 'serpent', 'aquatic', 'amorphous', 'plantfolk']);
export const CREATURES = Object.freeze(FAMILIES.flatMap(family => [101, 202].map(seed => Object.freeze({ id: `${family}-${seed}`, family, seed }))));
const POOLS = Object.freeze({
  lane: ['biped', 'arthropod', 'amorphous', 'quadruped'],
  siege: ['reptile', 'plantfolk'],
  neutral: ['quadruped', 'serpent', 'plantfolk', 'winged', 'arthropod'],
  boss: ['reptile', 'quadruped'],
  aquatic: ['aquatic', 'serpent'],
  any: FAMILIES,
});
export function creatureHash(seed, key) {
  let value = (Number(seed) >>> 0) ^ 2166136261;
  for (const char of String(key)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return (Math.imul(value, 0x846ca68b) ^ value >>> 16) >>> 0;
}
export function chooseCreature(seed, key, role = 'any') {
  const families = POOLS[role];
  if (!families) throw new Error(`Unknown creature role: ${role}`);
  const pool = CREATURES.filter(c => families.includes(c.family));
  return pool[creatureHash(seed, key) % pool.length];
}
export function provokeNeutral(creature, attacker, now, duration = 6) {
  if (creature.leash || attacker.hp <= 0) return false;
  creature.aggro = attacker.id; creature.aggroUntil = now + duration;
  return true;
}
// Engine-independent intent. Each game applies its movement and collision rules.
export function neutralIntent(creature, attacker, now, leashRadius = 390) {
  const home = { x: creature.homeX, y: creature.homeY };
  const fromHome = Math.hypot(creature.x - home.x, creature.y - home.y);
  const engaged = attacker && attacker.hp > 0 && now < creature.aggroUntil;
  if (creature.leash || fromHome > leashRadius || (!engaged && (creature.aggro || fromHome > 20))) {
    return { mode: fromHome < 20 ? 'reset' : 'return', ...home };
  }
  return engaged ? { mode: 'fight', x: attacker.x, y: attacker.y } : { mode: 'idle', ...home };
}
