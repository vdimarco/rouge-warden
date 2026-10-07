import { distance, lineOfSight } from './world.js';
import { hopPolyp } from './tide-kits.js';
const creature=t=>!['tower','core'].includes(t.kind);
export function launchSkill(s,source,target,type,amount,extra={}){
 s.missiles.push({x:source.x,y:source.y,source:source.id,team:source.team,hero:source.hero,target:target.id,type,amount,speed:type==='spirit'?520:680,life:5,visited:[],...extra});
}
// Completed spells travel independently of the movement pad and later casts.
export function tickSkillEvents(s,dt,{damage,heal,hostile}){
 for(const m of s.missiles){
  m.life-=dt;const source=s.units.find(e=>e.id===m.source),target=s.units.find(e=>e.id===m.target);
  if(m.life<=0||!source||source.hp<=0||!target||target.hp<=0||!lineOfSight(s,m,target)){m.life=0;continue;}
  const d=distance(m,target),travel=m.speed*dt;
  if(d>travel+target.radius){m.x+=(target.x-m.x)/d*travel;m.y+=(target.y-m.y)/d*travel;continue;}
  m.x=target.x;m.y=target.y;
  if(m.returning){heal(s,source,m.healing);m.life=0;continue;}
  if(m.type==='polyp'){hopPolyp(s,m,source,target,{damage,heal,hostile});continue;}
  if(!hostile(s,source,target)){m.life=0;continue;}
  const actual=damage(s,source,target,m.amount)||0;
  if(m.type==='foxfire')target.spiritUntil=s.time+5;
  if(m.type==='spirit'){m.target=source.id;m.returning=true;m.healing=actual*.5;m.life=4;continue;}
  if(m.type==='venom'){
   target.bleed={source:source.id,until:s.time+4,tick:s.time+.8,amount:32*m.strength,type:'poison'};target.slow=2;m.visited.push(target.id);
   const next=m.visited.length<3?s.units.filter(t=>creature(t)&&hostile(s,source,t)&&!m.visited.includes(t.id)&&distance(target,t)<260&&lineOfSight(s,target,t)).sort((a,b)=>distance(target,a)-distance(target,b)||a.id-b.id)[0]:null;
   if(next){m.target=next.id;m.amount*=.8;continue;}
  }
  m.life=0;
 }
 s.missiles=s.missiles.filter(m=>m.life>0);
 for(const e of s.units){
  if(e.bloom){
   const b=e.bloom,source=s.units.find(t=>t.id===b.source);
   if(e.hp<=0||!source||source.hp<=0||s.time>=b.until){e.bloom=null;continue;}
   if(s.time>=b.tick){b.tick=s.time+1;heal(s,e,b.amount);e.mana=Math.min(e.maxMana,e.mana+b.mana);s.effects.push({x:e.x,y:e.y,type:'spell',hero:10,slot:2,radius:105,color:'#96e0ac',life:.5,maxLife:.5});}
  }
 }
}
