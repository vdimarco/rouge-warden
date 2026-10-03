import { BASES, distance, canSee, lineOfSight } from './world.js';
import { structureProtected } from './objectives.js';
import { canAfford, manaCost, canReturn, threateningZones, insideWarning } from './combat-rules.js';

const escapeHeroes=[0,1,2,3,6,8,9];
export function combatDecision(s,e){
 const enemies=s.units.filter(t=>t.hp>0&&t.team!==e.team&&t.team>=0&&!structureProtected(s,t)&&distance(e,t)<850&&canSee(s,e,t)&&lineOfSight(s,e,t));
 const heroes=enemies.filter(t=>t.kind==='hero'),allies=s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<650);
 const ready=slot=>e.skillRanks[slot]&&e.cd[slot]<=0&&canAfford(e,slot)&&s.time>=(e.thinkAt||0);
 const zone=threateningZones(s,e)[0];
 const warning=s.units.find(t=>t.team!==e.team&&t.castIntent&&canSee(s,e,t)&&insideWarning(e,t.castIntent.shape,35))?.castIntent;
 const danger=zone?.type==='sunray'?{...zone,shape:'cone',width:.13}:zone||warning?.shape;
 if(danger){
  const a=danger.shape==='cone'?danger.angle+(Math.sin(Math.atan2(e.y-danger.y,e.x-danger.x)-danger.angle)>=0?1:-1)*Math.PI/2:Math.atan2(e.y-danger.y,e.x-danger.x);
  return {mode:'evade',move:{x:e.x+Math.cos(a)*320,y:e.y+Math.sin(a)*320}};
 }
 const outnumbered=heroes.length>allies.length, hurt=e.hp/e.maxHp;
 if(hurt<.28||(outnumbered&&hurt<.65)||e.retreat&&hurt<.82){
  const home=BASES[e.team],aim={x:home.x-e.x,y:home.y-e.y};
  const slot=e.hero===9&&ready(3)?3:e.hero===6&&canReturn(s,e)?0:escapeHeroes.includes(e.hero)&&ready(0)?0:e.hero===7&&ready(2)?2:e.hero===11&&ready(0)?0:e.hero===9&&ready(3)?3:undefined;
  return {mode:'retreat',move:home,slot:heroes.length?slot:undefined,aim};
 }
 // Towers are approached with a wave. Finishing a weak wisp takes priority over a full-health hero.
 const candidates=enemies.filter(t=>t.kind!=='tower'&&t.kind!=='core'||s.units.some(a=>a.team===e.team&&a.kind==='minion'&&a.hp>0&&distance(a,t)<t.range));
 const score=t=>distance(e,t)+(t.kind==='hero'?-190+(t.hp/t.maxHp)*100:0)+(t.kind==='minion'&&t.hp<=e.damage*1.15?-400:0)+(e.target===t.id?-35:0);
 let target=candidates.sort((a,b)=>score(a)-score(b)||a.id-b.id)[0];
 if(!target){const boss=s.units.find(t=>t.kind==='boss'&&t.hp>0);if(boss&&e.lane===1&&hurt>.6&&distance(e,boss)<700)target=boss;}
 const injured=allies.find(t=>t.hp<t.maxHp*.7);
 if(!target){if(e.hero===10&&injured&&!injured.bloom&&ready(2))return {mode:'support',slot:2,aim:{x:injured.x-e.x,y:injured.y-e.y,distance:distance(e,injured)}};return {mode:'lane'};}
 const d=distance(e,target),aim={x:target.x-e.x,y:target.y-e.y,distance:d},combat=target.kind==='hero',near=heroes.filter(t=>distance(e,t)<420).length;
 let slot;
 const choose=(i,condition=true)=>{if(slot===undefined&&condition&&ready(i))slot=i;};
 switch(e.hero){
  case 0:choose(3,combat&&(near>=2||hurt<.45));choose(2,combat&&!target.omen&&d<500);choose(1,d<340);break;
  case 1:choose(3,combat&&(near>=2||hurt<.5)&&d<400);choose(2,(target.wetUntil>s.time||target.stun>0)&&d<330);choose(1,d<420);break;
  case 2:choose(3,combat&&d<240);choose(2,d<490&&(target.snaredUntil>s.time||target.stun>0||near>=2));choose(1,d<390&&!s.traps.some(t=>t.source===e.id));choose(2,d<410);break;
  case 3:choose(3,combat&&d<220);choose(1,target.bleed?.until>s.time&&d<280);choose(2,d<290);choose(1,d<260);break;
  case 4:choose(2,target.brineUntil>s.time&&d<520);choose(1,d<430);choose(3,combat&&near>=2);choose(0,combat&&d<250);break;
  case 5:choose(2,d<260&&(target.chillUntil>s.time||hurt<.7));choose(1,d<290);choose(3,combat&&d<350&&(near>=2||hurt<.55));choose(0,combat&&d>260&&d<650);break;
  case 6:choose(2,target.spiritUntil>s.time&&d<470);choose(1,d<420);choose(3,combat&&d<300&&target.spiritUntil>s.time);break;
  case 7:choose(2,combat&&(hurt<.7||outnumbered));choose(3,combat&&d<410&&(target.stun>0||near>=2));choose(1,d<490);choose(0,combat&&d>280&&d<570&&!outnumbered);break;
  case 8:choose(2,combat&&d<500&&!target.soulThread);choose(1,d<520);choose(3,combat&&d<360);break;
  case 9:choose(3,combat&&hurt<.5);choose(2,d<600&&target.bleed?.type==='fire'&&!s.zones.some(z=>z.type==='sunray'&&z.source===e.id&&z.life>0));choose(1,d<400);break;
  case 10:choose(2,!!injured&&!injured.bloom);choose(0,d<480&&!s.units.some(t=>t.owner===e.id&&t.hp>0));choose(3,combat&&d<380&&(near>=2||!!injured));choose(1,d<480);break;
  case 11:choose(0,(e.slow>0||e.bleed?.until>s.time||hurt<.65)&&combat);choose(3,combat&&d<350&&target.bleed?.type==='poison');choose(2,d<340);choose(1,d<420);break;
 }
 if(slot===undefined&&combat&&escapeHeroes.includes(e.hero)&&![8,9].includes(e.hero)&&d>330&&d<580&&hurt>.65&&!outnumbered&&target.hp<target.maxHp*.7)choose(0);
 // Keep enough mana for a defensive move instead of emptying every cooldown into a healthy target.
 if(slot!==undefined&&slot!==0&&slot!==3&&hurt>.55&&combat&&target.hp>target.maxHp*.7&&e.mana-manaCost(e,slot)<manaCost(e,0))slot=undefined;
 let point;
 if(e.range>250&&combat&&d<e.range*.7&&e.attackCd>.12){const a=Math.atan2(e.y-target.y,e.x-target.x);point={x:e.x+Math.cos(a)*260,y:e.y+Math.sin(a)*260};}
 else if(d>e.range*.9+target.radius)point=target;
 return {mode:'fight',target,move:point,slot,aim:e.hero===10&&slot===2&&injured?{x:injured.x-e.x,y:injured.y-e.y,distance:distance(e,injured)}:aim};
}
