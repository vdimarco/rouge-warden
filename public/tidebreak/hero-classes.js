// Attributes describe growth. Attack type and team role remain independent.
export const CLASSES = {
 Strength: {health:35,regen:.4,attackSpeed:0,armor:0,power:0,mana:0,manaRegen:0,note:'+35 health and +0.4 health/sec per level'},
 Agility: {health:0,regen:0,attackSpeed:2.5,armor:.4,power:0,mana:0,manaRegen:0,note:'+2.5% attack speed and +0.4 armor per level'},
 Intelligence: {health:0,regen:0,attackSpeed:0,armor:0,power:3,mana:16,manaRegen:.2,note:'+3 spell power, +16 mana and +0.2 mana/sec per level'},
};
const PRIMARY = ['Agility','Strength','Intelligence','Agility','Intelligence','Strength','Agility','Strength','Intelligence','Intelligence','Intelligence','Agility'];
export const heroClass = index => PRIMARY[index];
export const classGrowth = (base,level=1) => {
 const rule=CLASSES[base.attribute]||{},levels=Math.max(0,level-1);
 return Object.fromEntries(['health','regen','attackSpeed','armor','power','mana','manaRegen'].map(k=>[k,(rule[k]||0)*levels]));
};
export const matchesHero = (hero,filter) => filter==='All'||hero.attribute===filter||hero.category===filter||hero.attackType===filter;
