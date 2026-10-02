// One definition for training, HUD, help and deterministic rules.
const skill = (name, label, icon, cooldown, description) => ({ name, label, icon, cooldown, description });
export const KITS = [
  [skill('Night flight','FLIGHT','wings',8,'Fly over walls and vanish. Your next strike from concealment becomes an ambush.'),
   skill('Dread feathers','DREAD','feathers',10,'Fan sharp feathers forward, damaging and slowing foes. Aim the fan to catch a group.'),
   skill('Death omen','OMEN','eye',13,'Mark a creature and reveal it through cover. Your next basic hit consumes the omen for bonus damage and a brief cloak.'),
   skill('Blackout','BLACKOUT','eclipse',32,'Unleash a fear pulse, vanish for six seconds and see through cover. Set up a devastating omen ambush.')],
  [skill('Loch dive','DIVE','wave',8,'Dive forward, heal and leave a slowing wake that makes enemies wet.'),
   skill('Undertow','PULL','whirlpool',10,'Drag enemies in a cone into biting range and drench them. Follow with Tailbreaker.'),
   skill('Tailbreaker','TAIL','tail',12,'Sweep your tail forward and knock enemies back. Wet enemies are also stunned.'),
   skill('Maelstrom','MAELSTROM','maelstrom',34,'Create a huge whirlpool that steadily pulls and damages enemies while healing allies.')],
  [skill('Hut hop','HOP','hut',9,'Vault over obstacles and shield your walking hut. Land beside your prepared traps.'),
   skill('Hex snare','SNARE','snare',11,'Plant a hidden root trap ahead. It arms after half a second and catches nearby enemies.'),
   skill('Witchfire mortar','FIRE','mortar',12,'Lob a glowing cauldron to an aimed spot. After a short warning it erupts into lingering fire. Rooted enemies take extra damage.'),
   skill('Stomp ritual','RITUAL','ritual',34,'Your hut pounds the ground exactly three times, each shockwave wider than the last, damaging and stunning foes.')],
  [skill('Pine leap','LEAP','horns',8,'Leap over obstacles. The landing damages and stuns enemies.'),
   skill('Hell shriek','SHRIEK','shriek',11,'Terrify nearby enemies. Bleeding foes flee longer, giving you time to chase.'),
   skill('Rending claws','REND','claws',12,'Slash a cone in front of you and cause bleeding for four seconds. Gain a burst of pursuit speed.'),
   skill('Blood moon','BLOOD MOON','bloodmoon',32,'Enter a frenzy for eight seconds: faster attacks, faster movement and 30% life steal. Gain a shield for the brawl.')],
];
export const MAX_LEVEL = 18;
export const xpForLevel = level => 60 + level * 25;
export const rankGate = (slot, rank) => (slot === 3 ? [6,12,18] : [1,3,5,7])[rank] ?? Infinity;
export const canLearn = (e, slot) => Number.isInteger(slot) && slot >= 0 && slot < 4 && e.skillPoints > 0 && e.level >= rankGate(slot,e.skillRanks[slot]);
export function trainSkill(e, slot) {
  if (!canLearn(e,slot)) return false;
  e.skillPoints--; e.skillRanks[slot]++; return true;
}
export const cooldownFor = (e,slot) => Math.max(3, KITS[e.hero][slot].cooldown - (e.skillRanks[slot] - 1) * (slot === 3 ? 3 : .75)) * e.haste;
export function trainBot(e) {
  const priority = e.hero === 0 ? [0,2,1] : e.hero === 1 || e.hero === 2 ? [1,2,0] : [0,2,1];
  while (e.skillPoints > 0) {
    const slot = canLearn(e,3) ? 3 : [...priority.filter(i=>e.skillRanks[i]===0),...priority].find(i=>canLearn(e,i));
    if (slot === undefined) break; trainSkill(e,slot);
  }
}
