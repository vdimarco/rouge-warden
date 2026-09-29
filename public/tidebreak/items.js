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
].map((v, icon) => ({ ...v, icon }));
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const BUILDS = [
  { id: 'ambush', name: 'Ambush', note: 'Empowered strikes · chase resets', order: ['nightfang', 'boots', 'hunter', 'blood', 'mirror', 'thorn'] },
  { id: 'bulwark', name: 'Bulwark', note: 'Shields · sustain · close-range pressure', order: ['root', 'boots', 'grave', 'frost', 'blood', 'beacon'] },
  { id: 'hex', name: 'Hex', note: 'Burns · slows · frequent spells', order: ['lantern', 'boots', 'frost', 'grave', 'mirror', 'beacon'] },
  { id: 'frenzy', name: 'Frenzy', note: 'Attack speed · life steal · lightning', order: ['thorn', 'boots', 'blood', 'storm', 'nightfang', 'root'] },
];
export const hasItem = (e, id) => e.inventory?.includes(id);
export function quote(e, id) {
  const i = ITEM[id]; if (!i) return { cost: Infinity, possible: false, used: [], reason: 'Unknown item' };
  const used = [], bag = e.inventory || [];
  for (const part of i.recipe) { const index = bag.findIndex((v, n) => v === part && !used.includes(n)); if (index >= 0) used.push(index); }
  const cost = i.cost - used.reduce((sum, n) => sum + ITEM[bag[n]].cost, 0);
  const reason = i.recipe.length && bag.includes(id) ? 'Already owned' : bag.length - used.length >= 6 ? 'Inventory full' : e.gold < cost ? `Need ${Math.ceil(cost - e.gold)} embers` : '';
  return { cost, used, possible: !reason, reason };
}
export function recalculate(e, base) {
  const stats = { attack: 0, attackSpeed: 0, power: 0, armor: 0, health: 0, haste: 0, speed: 0, regen: 0, lifesteal: 0 };
  for (const id of e.inventory || []) for (const [key, value] of Object.entries(ITEM[id].stats)) stats[key] += value;
  e.maxHp = base.hp + (e.level - 1) * 110 + stats.health;
  e.hp = Math.min(e.hp, e.maxHp); // Purchases never refill health; selling cannot generate healing.
  e.damage = base.damage + (e.level - 1) * 13 + stats.attack;
  e.rate = base.rate / (1 + stats.attackSpeed / 100);
  e.speed = base.speed + stats.speed; e.haste = 100 / (100 + stats.haste);
  e.power = stats.power; e.armor = stats.armor; e.regen = stats.regen; e.lifesteal = stats.lifesteal / 100;
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
  const build = BUILDS.find(b => b.id === e.build) || BUILDS[e.hero];
  return (e.goal && !hasItem(e, e.goal) ? e.goal : build.order.find(id => !hasItem(e, id))) || null;
}
export function nextPurchase(e) {
  const id = nextItem(e); if (!id) return null;
  if (quote(e, id).possible) return id;
  const missing = [...ITEM[id].recipe], bag = [...e.inventory];
  for (let n = missing.length - 1; n >= 0; n--) { const at = bag.indexOf(missing[n]); if (at >= 0) { bag.splice(at, 1); missing.splice(n, 1); } }
  return missing.find(part => quote(e, part).possible) || null;
}
export function statText(i) {
  const labels = { attack: 'attack', attackSpeed: '% attack speed', power: 'power', armor: 'armor', health: 'health', haste: 'haste', speed: 'move speed', regen: 'health / sec', lifesteal: '% life steal' };
  return Object.entries(i.stats).map(([k, v]) => `+${v}${labels[k].startsWith('%') ? '' : ' '}${labels[k]}`).join(' · ');
}
