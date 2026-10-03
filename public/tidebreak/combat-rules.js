import { distance, lineOfSight } from './world.js';
import { classGrowth } from './hero-classes.js';

const COSTS = [
 [45,65,55,140], [50,70,65,155], [55,60,80,150], [55,60,70,135],
 [60,75,80,160], [40,65,70,150], [55,60,75,145], [65,75,60,170],
 [60,70,65,155], [60,65,80,180], [80,70,75,160], [55,65,80,165],
];
export const manaCost = (e, slot) => COSTS[e.hero][slot] + Math.max(0,(e.skillRanks[slot] || 1)-1)*8;
export const manaCapacity = (base, level=1) => 420 + (base.range>250?100:0) + (level-1)*32 + classGrowth(base,level).mana;
export const canAfford = (e,slot) => e.mana >= manaCost(e,slot);
export const canReturn = (s,e) => e.hero===6 && e.returnAnchor?.until>s.time;

// These shapes also describe the rules used by directional spells.
export function spellShape(e,slot,aim) {
 const angle=Math.atan2(aim.y,aim.x), origin={x:e.x,y:e.y};
 if(e.hero===9&&slot===2)return {...origin,angle,radius:650,width:.13,shape:'cone'};
 if(e.hero===8&&slot===3)return {...origin,radius:550,shape:'circle'};
 if(slot===1){
  const cones=[[360,1.05],[440,1],null,[300,Math.PI],[450,.8],[310,Math.PI],[440,1],[520,.26],[550,.3],[430,1],null,[440,.95]];
  if(cones[e.hero])return {...origin,angle,radius:cones[e.hero][0],width:cones[e.hero][1],shape:'cone'};
  const range=Math.min(aim.distance??Infinity,e.hero===2?290:360);
  return {x:e.x+Math.cos(angle)*range,y:e.y+Math.sin(angle)*range,radius:e.hero===2?145:190,shape:'circle'};
 }
 if(slot===2){
  if([1,3,4,5,11].includes(e.hero)){const ranges={1:[350,1.25],3:[310,1],4:[550,.28],5:[280,1],11:[360,.9]};return {...origin,angle,radius:ranges[e.hero][0],width:ranges[e.hero][1],shape:'cone'};}
  if([2,6].includes(e.hero)){const range=Math.min(aim.distance??Infinity,e.hero===2?380:360);return {x:e.x+Math.cos(angle)*range,y:e.y+Math.sin(angle)*range,radius:190,shape:'circle'};}
  return {...origin,radius:[0,0,0,0,0,0,0,0,540,350,380][e.hero]||540,shape:'circle'};
 }
 return {...origin,radius:[340,460,370,0,410,420,330,440,390,0,410,390][e.hero],shape:'circle'};
}
export function insideWarning(point,w,margin=0){
 const d=distance(point,w);if(d>w.radius+(point.radius||0)+margin)return false;
 if(w.shape!=='cone'||d<50)return true;
 const a=Math.atan2(point.y-w.y,point.x-w.x),delta=Math.atan2(Math.sin(a-w.angle),Math.cos(a-w.angle));
 return Math.abs(delta)<=w.width + Math.asin(Math.min(1,((point.radius||0)+margin)/Math.max(1,d)));
}
export const threateningZones = (s,e) => s.zones.filter(z=>z.team!==e.team&&(z.amount>0)&&z.life>0&&distance(e,z)<z.radius+e.radius+65&&lineOfSight(s,e,z)&&(z.type!=='sunray'||insideWarning(e,{...z,width:.13,shape:'cone'},35)));
