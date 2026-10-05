import { BASES, distance, canSee, visibleTo, lineOfSight } from './world.js';
import { structureProtected } from './objectives.js';
import { canAfford, manaCost, canReturn, threateningZones, insideWarning } from './combat-rules.js';
import { assistPoint } from './team-events.js';
import { botProfile, reactionAt, evadePoint, tradeRetreat, diveSafe, wardOpen, targetBonus, lowestInRange, teamFocus, laneHold, strategy, leadAim, punishes } from './bot-difficulty.js';

const escapeHeroes=[0,1,2,3,6,8,9];
export function combatDecision(s,e){
 const enemies=s.units.filter(t=>t.hp>0&&t.team!==e.team&&t.team>=0&&!structureProtected(s,t)&&distance(e,t)<850&&canSee(s,e,t)&&lineOfSight(s,e,t));
 const heroes=enemies.filter(t=>t.kind==='hero'),allies=s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<650);
 const P=botProfile(s,e);
 const ready=slot=>e.skillRanks[slot]&&e.cd[slot]<=0&&canAfford(e,slot)&&s.time>=(e.thinkAt||0);
 const zones=threateningZones(s,e),zone=zones.find(z=>!(z.armed>s.time)),armedWarning=zones.find(z=>z.armed>s.time);
 const caster=s.units.find(t=>t.team!==e.team&&(t.castIntent||t.specialIntent)&&canSee(s,e,t)&&insideWarning(e,(t.castIntent||t.specialIntent).shape,35));
 const warning=caster&&(caster.castIntent||caster.specialIntent);
 const warningShape=armedWarning?{...armedWarning,shape:armedWarning.type==='sunray'?'cone':'circle',width:.13}:warning?.shape;
 let reacted=false;
 if(warningShape){
  const source=armedWarning?.source??caster?.id??0;
  const key=armedWarning?`ground:${source}:${armedWarning.type}:${armedWarning.armed}:${armedWarning.x}:${armedWarning.y}`:`cast:${source}:${warning.start}:${warning.at}`;
  if(e.warningReaction?.key!==key)e.warningReaction={key,at:reactionAt(s,e,source,key)};
  reacted=s.time>=e.warningReaction.at;
 }else e.warningReaction=null;
 // Active ground remains urgent. Pending ground, casts and neutral specials
 // share the same bounded perception delay until their damage becomes active.
 const danger=zone?.type==='sunray'?{...zone,shape:'cone',width:.13}:zone||(reacted&&warningShape);
 if(danger){
  const origin=danger.targetId&&caster?caster:danger;
  const a=danger.shape==='cone'?danger.angle+(Math.sin(Math.atan2(e.y-danger.y,e.x-danger.x)-danger.angle)>=0?1:-1)*Math.PI/2:Math.atan2(e.y-origin.y,e.x-origin.x);
  return {mode:'evade',move:evadePoint(s,e,a,danger===zone)};
 }
 const outnumbered=heroes.length>allies.length, hurt=e.hp/e.maxHp;
 // A lost trade backs off without the full retreat, so the bot does not recall at once.
 const fleeing=hurt<P.retreatAt||(outnumbered&&hurt<.65)||e.retreat&&hurt<.82;
 if(fleeing||tradeRetreat(s,e,heroes,hurt)){
  const home=BASES[e.team],aim={x:home.x-e.x,y:home.y-e.y};
  const slot=e.hero===9&&ready(3)?3:e.hero===6&&canReturn(s,e)?0:escapeHeroes.includes(e.hero)&&ready(0)?0:e.hero===7&&ready(2)?2:e.hero===11&&ready(0)?0:e.hero===9&&ready(3)?3:undefined;
  return {mode:fleeing?'retreat':'disengage',move:home,slot:heroes.length?slot:undefined,aim};
 }
 // Towers are approached with a wave. Finishing a weak wisp takes priority over a full-health hero.
 // Higher profiles also count the Wild Hunt and summons as escorts, and weigh tower damage before a dive.
 const candidates=enemies.filter(t=>(t.kind!=='tower'&&t.kind!=='core'||(P.legacy?s.units.some(a=>a.team===e.team&&a.kind==='minion'&&a.hp>0&&distance(a,t)<t.range):wardOpen(s,e,t)))&&diveSafe(s,e,t,allies));
 if(P.focus)teamFocus(s,e.team);
 const inRange=lowestInRange(e,heroes);
 const score=t=>distance(e,t)+(t.kind==='hero'?-190+(t.hp/t.maxHp)*100:0)+(t.kind==='minion'&&t.hp<=e.damage*1.15?-400:0)+(e.target===t.id?-35:0)+targetBonus(s,e,t,inRange);
 let target=candidates.sort((a,b)=>score(a)-score(b)||a.id-b.id)[0];
 if(!target){const boss=s.units.find(t=>t.kind==='boss'&&t.hp>0);if(boss&&e.lane===1&&hurt>.6&&distance(e,boss)<700)target=boss;}
 const injured=allies.filter(t=>t.hp<t.maxHp*.7&&distance(e,t)<480).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
 // A nearby injured ally creates a protection opportunity for front-line kits.
 // It changes target choice; each hero still uses its own control/attack rules.
 const endangered=allies.filter(t=>t.id!==e.id&&t.hp<t.maxHp*.58&&distance(e,t)<500).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
 if(endangered&&[1,7].includes(e.hero)&&hurt>.55){
  const attacker=heroes.filter(t=>distance(t,endangered)<Math.max(300,t.range+80)).sort((a,b)=>distance(a,endangered)-distance(b,endangered)||a.id-b.id)[0];
  if(attacker)target=attacker;
 }
 const boss=s.units.find(t=>t.kind==='boss'&&t.hp>0);
 const team=s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0);
 const support=boss&&team.some(t=>t.id!==e.id&&t.hp/t.maxHp>.55&&distance(t,boss)<1600&&distance(t,e)<1700);
 const rally=boss&&hurt>.72&&support&&distance(e,boss)<1900&&visibleTo(s,e.team,boss)&&!heroes.some(t=>distance(e,t)<500)&&!endangered;
 if(rally)target=boss;
 // Teammates answer calls and fights when nothing in sight needs a hero.
 const call=!rally&&(!target||target.kind!=='hero')&&!endangered?assistPoint(s,e,hurt):null;
 if(call&&(call.kind==='rally'||!target||target.kind==='minion'))return {mode:'assist',move:call,call:call.kind};
 // Objectives, defence, ganks and camps. A bot with no wave waits outside tower range.
 const holding=(!target||target.kind!=='hero')&&laneHold(s,e),planned=!rally&&!endangered&&strategy(s,e,{target,hurt,holding:!!holding});
 if(planned)return planned;
 if(!target){if(e.hero===10&&injured&&!injured.bloom&&ready(2))return {mode:'support',slot:2,aim:{x:injured.x-e.x,y:injured.y-e.y,distance:distance(e,injured)}};return holding?{mode:'lane',move:holding}:{mode:'lane'};}
 const d=distance(e,target),aim=leadAim(s,e,target,{x:target.x-e.x,y:target.y-e.y,distance:d}),combat=target.kind==='hero',near=heroes.filter(t=>distance(e,t)<420).length;
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
 if(slot===undefined&&combat&&P.engage&&escapeHeroes.includes(e.hero)&&![8,9].includes(e.hero)&&d>330&&d<580&&hurt>.65&&!outnumbered&&(target.hp<target.maxHp*.7||punishes(s,e,target)))choose(0);
 // Keep enough mana for a defensive move instead of emptying every cooldown into a healthy target.
 if(slot!==undefined&&slot!==0&&slot!==3&&hurt>.55&&combat&&target.hp>target.maxHp*.7&&!punishes(s,e,target)&&e.mana-manaCost(e,slot)<manaCost(e,0)*P.reserve)slot=undefined;
 // Higher profiles keep spells for heroes when mana is low, so their threats are spells you can read.
 if(slot!==undefined&&!combat&&slot!==3&&e.mana<e.maxMana*P.saveSpells&&!(e.hero===10&&slot===2))slot=undefined;
 let point;
 if(e.range>250&&combat&&d<e.range*.7&&e.attackCd>.12){const a=Math.atan2(e.y-target.y,e.x-target.x);point={x:e.x+Math.cos(a)*260,y:e.y+Math.sin(a)*260};}
 else if(d>e.range*.9+target.radius)point=target;
 return {mode:rally?'objective':'fight',target,move:point,slot,aim:e.hero===10&&slot===2&&injured?{x:injured.x-e.x,y:injured.y-e.y,distance:distance(e,injured)}:aim};
}
