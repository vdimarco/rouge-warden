import { distance, canSee, lineOfSight } from './world.js';
import { insideWarning } from './combat-rules.js';

const CAMP_ART={'possessed-ogre':{line:false,label:'Club cleave'},'undead-knight':{line:false,label:'Blade sweep'},'undead-mage':{line:true,label:'Soul bolt'},'undead-archer':{line:true,label:'Arrow volley'}};
// The warning is also the hit shape. Moving a target never changes locked aim.
export function encounterPattern(e, target, time) {
 const boss=e.kind==='boss',fury=boss&&e.hp/e.maxHp<.5,index=e.specialCount||0;
 // Camps fight like their art: the mage and the archer shoot a line, the ogre and the knight cleave.
 const art=CAMP_ART[e.marketplaceSprite],line=boss?index%2===1:art?art.line:(e.camp||0)%2===1;
 return {
  shape:{x:e.x,y:e.y,angle:Math.atan2(target.y-e.y,target.x-e.x),radius:line?(boss?600:500):(boss?(fury?450:400):320),width:line?(boss?.19:.21):(boss?1.1:1),shape:'cone'},
  start:time,at:time+(line?(boss?.85:.8):(boss?.8:.7)),
  label:boss?(line?'Wild Hunt · Piercing cry':fury?'Wild Hunt · Furious sweep':'Wild Hunt · Sweeping antlers'):art?`${e.name} · ${art.label}`:(line?'Guardian · Thorn line':'Guardian · Cleave'),
  amount:boss?(fury?235:185):(line?145:125),recovery:boss?1.4:1.15,
  cooldown:boss?(fury?4.8:6.2):6.5,
 };
}

// True reserves this tick for the special or its exposed recovery. The caller
// retains ordinary attacks, pursuit and neutral leashing when this returns false.
export function tickEncounter(s,e,dt,{damage}) {
 if(!['camp','boss'].includes(e.kind))return false;
 const home={x:e.homeX??e.x,y:e.homeY??e.y};
 if(e.hp<=0||e.leash||distance(e,home)>(e.kind==='boss'?390:430)||e.stun>0||e.fear>0){
  e.specialIntent=null;e.exposedUntil=0;e.nextSpecial=Math.max(e.nextSpecial||0,s.time+1.5);return false;
 }
 const intent=e.specialIntent;
 if(intent){
  e.pendingAttack=null;
  if(s.time<intent.at)return true;
  e.specialIntent=null;e.specialCount=(e.specialCount||0)+1;
  e.exposedUntil=s.time+intent.recovery;e.nextSpecial=s.time+intent.cooldown;
  e.attackCd=Math.max(e.attackCd||0,intent.recovery);
  const context=s.hitContext;s.hitContext={source:e.id,label:intent.label,telegraphed:true,dodgeable:true};
 for(const t of s.units)if(t.hp>0&&t.team>=0&&!['tower','core'].includes(t.kind)&&insideWarning(t,intent.shape)&&lineOfSight(s,intent.shape,t))damage(s,e,t,intent.amount,'spell');
 s.hitContext=context;
  s.effects.push({...intent.shape,type:'neutral-impact',source:e.id,life:.45,maxLife:.45,color:'#ffbb78'});
  return true;
 }
 if(e.exposedUntil>s.time){e.pendingAttack=null;return true;}
 if(e.nextSpecial===undefined){e.nextSpecial=s.time+1.8;return false;}
 if(s.time<e.nextSpecial)return false;
 const target=e.kind==='camp'?s.units.find(t=>t.id===e.aggro&&e.aggroUntil>s.time):s.units.filter(t=>t.kind==='hero'&&t.team>=0&&t.hp>0&&distance(e,t)<490&&canSee(s,e,t)&&canSee(s,t,e)).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id)[0];
 // An attacker must see the guardian at the start. This prevents specials from
 // starting through cover or selecting an unseen hero in another lane.
 if(!target||target.hp<=0||distance(e,target)>490||!canSee(s,e,target)||!canSee(s,target,e)||!lineOfSight(s,e,target))return false;
 const next=encounterPattern(e,target,s.time);
 if(!insideWarning(target,next.shape,20))return false;
 e.encounterPhase=e.kind==='boss'&&e.hp/e.maxHp<.5?2:1;
 e.specialIntent=next;e.facing=next.shape.angle;e.pendingAttack=null;
 return true;
}
