import { manaCapacity } from './combat-rules.js';
import { classGrowth } from './hero-classes.js';
// Recipes, derived stats and build orders are shared by the player and bots.
const item = (id, name, cost, category, stats, text, recipe = []) => ({ id, name, cost, category, stats, text, recipe });
export const ITEMS = [
  item('bone', 'Bone shard', 180, 'Attack', { attack: 18 }, 'A sharp beginning.'),
  item('feather', 'Swift feather', 180, 'Attack', { attackSpeed: 10 }, 'Strike more often.'),
  item('gem', 'Ember gem', 180, 'Magic', { power: 30 }, 'Strengthens all damaging skills.'),
  item('iron', 'Iron plate', 180, 'Defense', { armor: 12 }, 'Reduces incoming damage.'),
  item('seed', 'Heart seed', 180, 'Defense', { health: 200, regen: 3 }, 'Grow into the fight.'),
  item('dust', 'Moon dust', 180, 'Magic', { haste: 8 }, 'Cast skills more often.'),
  item('nightfang', 'Nightfang', 780, 'Attack', { attack: 48, attackSpeed: 15 }, 'After casting, your next attack deals 65 + 50% power bonus damage. 3s cooldown.', ['bone', 'feather']),
  item('blood', 'Blood talisman', 860, 'Attack', { attack: 36, health: 220, lifesteal: 16 }, 'Basic attacks heal you for 16% of damage dealt.', ['bone', 'seed']),
  item('storm', 'Storm talon', 820, 'Attack', { attack: 25, attackSpeed: 28 }, 'Every third attack chains lightning to two nearby foes for 60 + 20% power damage.', ['feather', 'gem']),
  item('lantern', 'Witch lantern', 820, 'Magic', { power: 85, haste: 10 }, 'Skills burn enemies for 3s: 28 + 5% power damage each second.', ['gem', 'dust']),
  item('frost', 'Frost bell', 800, 'Magic', { power: 60, armor: 18 }, 'Damaging skills slow enemies for 1.2s.', ['gem', 'iron']),
  item('root', 'Root crown', 850, 'Defense', { health: 480, armor: 32 }, 'Below 35% health, gain a 300 shield. 35s cooldown.', ['iron', 'seed']),
  item('boots', 'Moon boots', 620, 'Mobility', { speed: 60, haste: 12 }, 'Chase through the shifting grounds.', ['feather', 'dust']),
  item('mirror', 'Mirror cloak', 850, 'Defense', { health: 250, armor: 22, haste: 12 }, 'When a creature hits you, gain a 220 shield before the hit. 20s cooldown.', ['iron', 'dust']),
  item('grave', 'Grave bell', 900, 'Defense', { health: 450, power: 65 }, 'Deal 24 damage each second to nearby enemies within 220 range.', ['seed', 'gem']),
  item('hunter', "Hunter's mark", 780, 'Attack', { attack: 38, haste: 15 }, 'A creature kill resets your movement skill and refunds 3s of ultimate cooldown.', ['bone', 'dust']),
  item('thorn', 'Quickthorn', 880, 'Attack', { attack: 35, attackSpeed: 30 }, 'Every third attack deals an extra 3% of the target’s maximum health (160 cap).', ['bone', 'feather']),
  item('beacon', 'Beacon heart', 860, 'Defense', { health: 400, haste: 10, regen: 8 }, 'Heal yourself and allied creatures within 300 range for 24 each second.', ['seed', 'dust']),
].map((v, icon) => ({ ...v, icon, tier: v.recipe.length ? 2 : 1 }));
const relic = (id, name, cost, stats, text, recipe, grants, icon, tradeoff) => ({ ...item(id, name, cost, 'Relics', stats, text, recipe), grants, icon, tier: 3, tradeoff });
ITEMS.push(
  relic('eclipse', 'Eclipse covenant', 1850, { attack: 80, power: 35, haste: 18 }, 'Empowered attacks execute wounded creatures for 8% of missing health (200 cap). Keeps Nightfang and kill resets.', ['nightfang', 'hunter'], ['nightfang', 'hunter'], 6, 'Burst and pursuit. No health or armor.'),
  relic('tempest', 'Tempest engine', 1980, { attack: 65, attackSpeed: 55 }, 'Third-hit lightning strikes the primary target too. Keeps chain lightning and 3% maximum-health strikes.', ['storm', 'thorn'], ['storm', 'thorn'], 8, 'Sustained attacks. No defense or spell power.'),
  relic('winter', 'Winter sovereign', 1800, { health: 400, armor: 40, power: 100, haste: 15 }, 'Three spell hits on one creature within 5s root it for 1s. 10s per-target cooldown. Keeps slows and Mirror shield.', ['frost', 'mirror'], ['frost', 'mirror'], 10, 'Control and protection. Needs repeated spell hits.'),
  relic('inferno', 'Hollow inferno', 1920, { health: 500, power: 150, haste: 12 }, 'Burns deal 60% more damage to slowed creatures. Keeps Witch lantern burns and Grave bell aura.', ['lantern', 'grave'], ['lantern', 'grave'], 9, 'Pair with Frost bell or a slowing skill. No armor.'),
  relic('worldroot', 'Worldroot pact', 1900, { health: 850, armor: 55, regen: 12, haste: 10, speed: -20 }, 'Casting your ultimate shields allied creatures within 450 for 15% of your maximum health. 18s cooldown. Keeps Root and Beacon.', ['root', 'beacon'], ['root', 'beacon'], 11, 'Protect your team. Costs 20 movement speed.'),
  relic('reaper', 'Pale reaper', 1840, { attack: 70, health: 350, lifesteal: 22, haste: 15 }, 'Attacks cut healing by 45% for 4s and deal 50% more damage to shields. Keeps life steal and kill resets.', ['blood', 'hunter'], ['blood', 'hunter'], 7, 'Counters healing and shields. No attack speed.'),
  relic('starfall', 'Starfall grimoire', 1800, { power: 160, attack: 35, haste: 20, health: -120, armor: -8 }, 'After three skill casts, your next attack explodes for 160 + 40% power in a 240 radius. Keeps burns and Nightfang.', ['lantern', 'nightfang'], ['lantern', 'nightfang'], 14, 'Spell burst. Costs 120 health and 8 armor.'),
  relic('colossus', 'Gravemaw idol', 1900, { health: 1100, armor: 45, power: 90, speed: -25 }, 'Grave aura also deals 1% of your maximum health each second. Keeps emergency Root shield.', ['root', 'grave'], ['root', 'grave'], 17, 'Close-range pressure. Costs 25 movement speed.'),
);
// Items with a single trick each: a snowball, a ward breaker, tenacity, momentum, a hunter's mark, a risky edge and a
// team rally. They reuse painted icons with a hue shift (icon, hue in degrees).
const special = (id, name, cost, category, stats, text, recipe, icon, hue, extra = {}) => ({ ...item(id, name, cost, category, stats, text, recipe), icon, hue, tier: extra.tier || 2, ...extra });
ITEMS.push(
  special('tidecoin', 'Drowned doubloon', 760, 'Attack', { attack: 20, power: 30 }, 'Each hero you banish adds a stack: +4 attack and +8 power, up to 10. You lose half the stacks when you fall.', ['bone', 'gem'], 2, 125),
  special('siege', 'Wardbreaker maul', 820, 'Attack', { attack: 40, armor: 15 }, 'Basic attacks deal 40% more damage to wards and rifts. Wards and rifts deal 30% less damage to you.', ['bone', 'iron'], 16, 40),
  special('glass', "Duelist's glass", 800, 'Attack', { attack: 45, attackSpeed: 12 }, 'Deal 15% more damage to heroes while above 70% health. You take 10% more damage.', ['bone', 'feather'], 6, 180),
  special('seer', "Seer's eye", 820, 'Magic', { power: 70, haste: 12 }, 'Skill hits mark a hero for 5s: it stays revealed and takes 10% more damage from your whole team.', ['gem', 'dust'], 9, 180),
  special('charm', 'Moonstone charm', 780, 'Defense', { armor: 20, health: 200, haste: 8 }, 'Stuns, fears and slows on you wear off 40% faster.', ['iron', 'dust'], 7, 200),
  special('horn', 'Rallying conch', 820, 'Defense', { health: 300, haste: 15 }, 'Casting your ultimate rallies allies within 500: 20% more damage and 20% movement speed for 4s.', ['feather', 'seed'], 14, 180),
  special('riptide', 'Riptide sandals', 700, 'Mobility', { speed: 45, health: 150 }, 'After each skill cast, gain 30% movement speed for 2s.', ['feather', 'dust'], 12, 300),
);
const specialRelic = (id, name, cost, stats, text, recipe, icon, hue, tradeoff) => special(id, name, cost, 'Relics', stats, text, recipe, icon, hue, { tier: 3, grants: recipe, tradeoff });
ITEMS.push(
  specialRelic('hoard', "Kraken's hoard", 1850, { attack: 70, power: 60, attackSpeed: 20 }, 'Banished heroes add stacks of +4 attack and +8 power, up to 20, and you keep them all when you fall. Keeps the doubloon and the duelist edge.', ['tidecoin', 'glass'], 17, 160, 'Snowball. Starts weak, and you still take 10% more damage.'),
  specialRelic('titan', 'Siegebreaker titan', 1900, { attack: 55, armor: 45, health: 500, speed: -15 }, 'Basic attacks deal 70% more damage to wards and rifts, and wards and rifts deal 50% less damage to you. Keeps the charm.', ['siege', 'charm'], 3, 140, 'Tower diver. Costs 15 movement speed.'),
  specialRelic('warhorn', "Tidecaller's warhorn", 1800, { health: 450, speed: 30, haste: 20 }, 'Any skill rallies allies within 500 for 3s (12% damage, 20% speed; 8s cooldown). Your ultimate rally is 25% for 5s. Keeps the sandals.', ['horn', 'riptide'], 13, 40, 'Team tempo. Little damage of its own.'),
);
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const BUILDS = [
  { id: 'ambush', name: 'Ambush', note: 'Nightfang + Hunter → Eclipse. Cast, strike, then chase the reset.', order: ['nightfang', 'boots', 'hunter', 'eclipse', 'blood', 'mirror', 'thorn', 'frost'] },
  { id: 'bulwark', name: 'Bulwark', note: 'Root + Beacon → Worldroot. Trade speed for team shields and sustain.', order: ['root', 'boots', 'beacon', 'worldroot', 'grave', 'frost', 'blood', 'mirror'] },
  { id: 'hex', name: 'Hex', note: 'Lantern + Grave → Inferno. Add Frost to amplify every burn.', order: ['lantern', 'boots', 'frost', 'grave', 'inferno', 'mirror', 'beacon', 'nightfang'] },
  { id: 'frenzy', name: 'Frenzy', note: 'Storm + Quickthorn → Tempest. Every third strike shreds and chains.', order: ['storm', 'boots', 'thorn', 'tempest', 'blood', 'nightfang', 'root', 'hunter'] },
  { id: 'plunder', name: 'Plunder', note: "Doubloon + Glass → Kraken's hoard. Win early fights and keep the spoils.", order: ['tidecoin', 'riptide', 'glass', 'hoard', 'blood', 'thorn', 'charm', 'nightfang'] },
  { id: 'siege', name: 'Siege', note: 'Maul + Charm → Siegebreaker titan. Push with your wave and outlast the wards.', order: ['siege', 'boots', 'charm', 'titan', 'root', 'thorn', 'blood', 'mirror'] },
  { id: 'vanguard', name: 'Vanguard', note: "Conch + Sandals → Tidecaller's warhorn. Lead the charge and speed your team in.", order: ['horn', 'riptide', 'seer', 'warhorn', 'charm', 'root', 'beacon', 'mirror'] },
];
export const hasItem = (e, id) => e.inventory?.some(owned => owned === id || ITEM[owned]?.grants?.includes(id));
export function synergies(e) {
  const active = [];
  if (hasItem(e, 'lantern') && hasItem(e, 'frost')) active.push({ name: 'Frozen flame', text: `Burns against slowed foes deal ${hasItem(e, 'inferno') ? 60 : 35}% extra damage.` });
  if (hasItem(e, 'root') && hasItem(e, 'beacon')) active.push({ name: 'Living sanctuary', text: 'Beacon healing adds 1% of your maximum health per pulse.' });
  if (hasItem(e, 'nightfang') && hasItem(e, 'hunter')) active.push({ name: 'Endless hunt', text: 'Kill → movement skill reset → another empowered attack.' });
  if (hasItem(e, 'tidecoin') && e.itemState?.coin) active.push({ name: 'Plunder', text: `${e.itemState.coin} stacks: +${e.itemState.coin * 4} attack, +${e.itemState.coin * 8} power.` });
  if (hasItem(e, 'seer') && hasItem(e, 'lantern')) active.push({ name: 'Marked flame', text: 'Your burns keep a marked hero revealed.' });
  if (hasItem(e, 'storm') && hasItem(e, 'thorn')) active.push({ name: 'Thunder thorns', text: 'Every third hit triggers both lightning and maximum-health damage.' });
  return active;
}
export function quote(e, id) {
  const i = ITEM[id]; if (!i) return { cost: Infinity, possible: false, used: [], reason: 'Unknown item' };
  const used = [], bag = e.inventory || [];
  const consume = id => { const index = bag.findIndex((v, n) => v === id && !used.includes(n)); if (index >= 0) used.push(index); else for (const part of ITEM[id].recipe) consume(part); };
  for (const part of i.recipe) consume(part);
  const cost = i.cost - used.reduce((sum, n) => sum + ITEM[bag[n]].cost, 0);
  const reason = i.recipe.length && hasItem(e, id) ? 'Already owned' : i.tier === 3 && bag.some(id => ITEM[id].tier === 3) ? 'One relic per build' : bag.length - used.length >= 6 ? 'Inventory full' : e.gold < cost ? `Need ${Math.ceil(cost - e.gold)} embers` : '';
  return { cost, used, possible: !reason, reason };
}
export function recalculate(e, base) {
  const stats = { attack: 0, attackSpeed: 0, power: 0, armor: 0, health: 0, haste: 0, speed: 0, regen: 0, lifesteal: 0 };
  for (const id of e.inventory || []) for (const [key, value] of Object.entries(ITEM[id].stats)) stats[key] += value;
  const coins = hasItem(e, 'tidecoin') ? e.itemState?.coin || 0 : 0; stats.attack += coins * 4; stats.power += coins * 8;
  const growth=classGrowth(base,e.level);
  e.attribute=base.attribute;e.manaRegen=growth.manaRegen;
  e.maxHp = base.hp + (e.level - 1) * 110 + stats.health + growth.health;
  e.maxMana=manaCapacity(base,e.level);e.mana=Math.min(e.mana??e.maxMana,e.maxMana);
  e.hp = Math.min(e.hp, e.maxHp); // Purchases never refill health; selling cannot generate healing.
  e.damage = base.damage + (e.level - 1) * 13 + stats.attack;
  e.rate = base.rate / (1 + (stats.attackSpeed+growth.attackSpeed) / 100);
  e.speed = base.speed + stats.speed; e.haste = 100 / (100 + stats.haste);
  e.power = stats.power+growth.power; e.armor = stats.armor+growth.armor; e.regen = stats.regen+growth.regen; e.lifesteal = stats.lifesteal / 100;
}
export function purchase(e, id, base) {
  const q = quote(e, id); if (!q.possible) return false;
  e.gold -= q.cost; e.inventory = e.inventory.filter((_, n) => !q.used.includes(n)); e.inventory.push(id);
  recalculate(e, base); return true;
}
export function sellItem(e, slot, base) {
  const id = e.inventory[slot]; if (!id) return false;
  e.gold += Math.floor(ITEM[id].cost * .7); e.inventory.splice(slot, 1); recalculate(e, base); return true;
}
export function nextItem(e) {
  const build = BUILDS.find(b => b.id === e.build) || BUILDS[e.hero % BUILDS.length];
  const allowed = id => !hasItem(e, id) && !(ITEM[id].tier === 3 && e.inventory.some(v => ITEM[v].tier === 3));
  return (e.goal && allowed(e.goal) ? e.goal : build.order.find(allowed)) || null;
}
export function nextPurchase(e) {
  const id = nextItem(e); if (!id) return null;
  if (quote(e, id).possible) return id;
  const bag = [...e.inventory];
  const find = id => { const at = bag.indexOf(id); if (at >= 0) { bag.splice(at, 1); return null; } if (quote(e, id).possible) return id; for (const part of ITEM[id].recipe) { const found = find(part); if (found) return found; } return null; };
  for (const part of ITEM[id].recipe) { const found = find(part); if (found) return found; } return null;
}
export function statText(i) {
  const labels = { attack: 'attack', attackSpeed: '% attack speed', power: 'power', armor: 'armor', health: 'health', haste: 'haste', speed: 'move speed', regen: 'health / sec', lifesteal: '% life steal' };
  return Object.entries(i.stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v}${labels[k].startsWith('%') ? '' : ' '}${labels[k]}`).join(' · ');
}
