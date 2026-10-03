import { SIZE, clamp, distance, lineOfSight, resolveBody, move } from './world.js';
const body=t=>!['core','tower'].includes(t.kind);
export function castLegend(c){
 const {s,e,slot,target,angle,rank,strength,origin,fx,cone,damage,heal,area}=c;
 const zone=(type,point,radius,life,amount,extra={})=>s.zones.push({...point,type,legend:true,source:e.id,team:e.team,hero:e.hero,rank,strength,radius,life,amount,tick:0,pulses:0,...extra});
 const placement=Math.min(360,c.aim?.distance??360);
 const point={x:clamp(c.aim?e.x+Math.cos(angle)*placement:target?.x??e.x+Math.cos(angle)*360,180,SIZE-180),y:clamp(c.aim?e.y+Math.sin(angle)*placement:target?.y??e.y+Math.sin(angle)*360,180,SIZE-180)};
 const allies=(radius,fn)=>s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<radius&&lineOfSight(s,e,t)).forEach(fn);
 if(slot===0){
  if(e.hero===4){e.shield+=260*strength;zone('ink',origin,290,5,38*strength);fx(origin,290);return true;}
  if(e.hero===5){e.chaseUntil=s.time+4;e.chaseStrength=strength;e.trailAt=0;fx(origin,150);return true;}
  if(e.hero===10){
   for(const t of s.units)if(t.kind==='summon'&&t.owner===e.id)t.hp=0;
   const spot={...point,radius:24};resolveBody(s,spot);
   c.spawn({kind:'summon',name:'Grove sentinel',owner:e.id,team:e.team,...spot,hp:420*strength,maxHp:420*strength,range:310,damage:45*strength,rate:1.1,speed:0,life:14,healing:28*strength,healAt:0});
   fx(spot,210);return true;
  }
  if(e.hero===11){e.shield+=300*strength;e.slow=0;e.bleed=null;e.burn=null;e.woundedUntil=0;e.scaleGuardUntil=s.time+3;fx(origin,160);return true;}
  if([7,8,9].includes(e.hero)){
   e.travel={...origin,angle,start:s.time,duration:e.hero===7?.6:e.hero===8?.9:1.2,length:e.hero===7?460:e.hero===8?460:570,strength,hitIds:[],trailAt:0};
   e.shield+=(e.hero===7?250:e.hero===8?160:140)*strength;fx(origin,140);return true;
  }
  // Kitsune is the sole instant blink among these kits.
  const length=430+(rank-1)*25;
  e.x+=Math.cos(angle)*length;e.y+=Math.sin(angle)*length;resolveBody(s,e);
  e.motion={...origin,start:s.time,duration:.38,arc:100};
  fx(e,180);s.effects.push({...origin,tx:e.x,ty:e.y,color:c.color,type:'beam',hero:e.hero,life:.45,maxLife:.45});
  e.returnAnchor={...origin,until:s.time+3};e.shield+=120*strength;e.cloak=s.time+1.5;e.revealedUntil=-1;zone('decoy',origin,220,1.2,180*strength,{armed:s.time+.7,tick:.7});
  return true;
 }
 fx(slot===2&&[6,10].includes(e.hero)?point:origin,slot===3?410:350);
 switch(e.hero){
  case 4:
   if(slot===1)cone(450,.8,(t,a)=>{damage(s,e,t,185*strength);if(body(t)){t.brineUntil=s.time+5;t.stun=.45+rank*.1;t.x-=Math.cos(a)*180;t.y-=Math.sin(a)*180;resolveBody(s,t);}});
   if(slot===2)cone(550,.28,t=>{damage(s,e,t,(t.brineUntil>s.time?340:205)*strength);});
   if(slot===3)zone('abyss',origin,410,6,55*strength);
   break;
  case 5:
   if(slot===1)area(s,e,e,310,190*strength,{slow:2+rank*.2});
   if(slot===1)for(const t of s.units)if(t.team!==e.team&&t.hp>0&&body(t)&&distance(e,t)<310+t.radius&&lineOfSight(s,e,t)){if(t.chillUntil>s.time)t.stun=1;t.chillUntil=s.time+4+rank*.3;}
   if(slot===2)cone(280,1,t=>{const amount=(170+(t.chillUntil>s.time?Math.min(160,(t.maxHp-t.hp)*.12):0))*strength;damage(s,e,t,amount);heal(s,e,75*strength);});
   if(slot===3){e.shield+=220*strength;e.sightUntil=s.time+7;zone('blizzard',origin,420,7,52*strength);}
   break;
  case 6:
   if(slot===1)cone(440,1,t=>{damage(s,e,t,180*strength);if(body(t))t.spiritUntil=s.time+5;});
   if(slot===2)zone('spiritknot',point,190,1.2,200*strength,{armed:s.time+.45,tick:.45});
   if(slot===3)zone('ninelights',origin,330,5.6,40*strength,{interval:.55,maxPulses:9});
   break;
  case 7:
   if(slot===1)cone(520,.26,t=>{damage(s,e,t,220*strength);if(body(t))t.stun=1;});
   if(slot===2){e.shield+=550*strength;e.guardUntil=s.time+4;}
   if(slot===3)zone('worldbreaker',origin,440,1.6,370*strength,{armed:s.time+.8,tick:.8});
   break;
  case 8:
   if(slot===1)cone(550,.3,t=>{damage(s,e,t,195*strength);if(body(t))t.silencedUntil=s.time+2;});
   if(slot===2){target.soulThread={source:e.id,until:s.time+6};damage(s,e,target,110*strength);fx(target,180);}
   if(slot===3)zone('requiem',origin,390,6,47*strength);
   break;
  case 9:
   if(slot===1)cone(430,1,t=>{damage(s,e,t,160*strength);if(body(t))t.bleed={source:e.id,until:s.time+4,tick:s.time+.8,amount:30*strength,type:'fire'};});
   if(slot===2){allies(350,t=>heal(s,t,230*strength));for(const t of s.units)if(c.hostile(s,e,t)&&distance(e,t)<350+t.radius&&lineOfSight(s,e,t)){const burning=t.bleed?.type==='fire'&&t.bleed.until>s.time||t.burn?.until>s.time;damage(s,e,t,(burning?340:190)*strength);if(burning){t.bleed=null;t.burn=null;}}}
   if(slot===3){e.rebirthUntil=s.time+6;e.rebirthStrength=strength;e.shield+=280*strength;}
   break;
  case 10:
   if(slot===1)zone('brambles',point,190,1.3,200*strength,{armed:s.time+.5,tick:.5});
   if(slot===2)allies(380,t=>{heal(s,t,250*strength);t.shield+=180*strength;});
   if(slot===3)zone('grove',origin,410,7,35*strength,{healing:65*strength});
   break;
  case 11:
   if(slot===1)cone(440,.95,t=>{damage(s,e,t,165*strength);if(body(t)){t.bleed={source:e.id,until:s.time+4,tick:s.time+.8,amount:32*strength,type:'poison'};t.slow=2;}});
   if(slot===2)cone(360,.9,(t,a)=>{damage(s,e,t,200*strength);if(body(t)){const toward=Math.atan2(Math.sin((t.facing||0)-(a+Math.PI)),Math.cos((t.facing||0)-(a+Math.PI)));if(Math.abs(toward)<1.2)t.stun=1.1+rank*.2;else t.slow=2;}});
   if(slot===3)zone('garden',origin,390,6,45*strength);
 }
 return true;
}
export function tickHeroMechanic({s,e,dt,damage,heal,hostile}){
 if(e.chaseUntil>s.time&&s.time>=(e.trailAt||0)){
  e.trailAt=s.time+.3;s.zones.push({x:e.x,y:e.y,type:'frost',legend:true,source:e.id,team:e.team,hero:5,rank:e.skillRanks[0],radius:95,life:2.2,amount:25*e.chaseStrength,tick:0,pulses:0});
 }
 const travel=e.travel;if(!travel)return false;
 if(e.stun>0||e.fear>0){e.travel=null;return false;}
 const progress=Math.min(1,(s.time-travel.start)/travel.duration),curve=e.hero===9?Math.sin(progress*Math.PI)*150:0;
 const point={x:clamp(travel.x+Math.cos(travel.angle)*travel.length*progress-Math.sin(travel.angle)*curve,180,SIZE-180),y:clamp(travel.y+Math.sin(travel.angle)*travel.length*progress+Math.cos(travel.angle)*curve,180,SIZE-180)};
 if(e.hero===7)move(s,e,point.x,point.y,dt,travel.length/travel.duration*1.1);
 else {e.x=point.x;e.y=point.y;e.facing=travel.angle;e.moving=true;}
 for(const t of s.units)if(hostile(s,e,t)&&body(t)&&!travel.hitIds.includes(t.id)&&distance(e,t)<110+t.radius&&lineOfSight(s,e,t)){
  travel.hitIds.push(t.id);damage(s,e,t,(e.hero===7?210:e.hero===8?140:110)*travel.strength);
  if(e.hero===7){t.stun=.8;t.x+=Math.cos(travel.angle)*110;t.y+=Math.sin(travel.angle)*110;resolveBody(s,t);}
  if(e.hero===8)heal(s,e,100*travel.strength);
 }
 if(e.hero===9&&s.time>=travel.trailAt){travel.trailAt=s.time+.2;s.zones.push({x:e.x,y:e.y,type:'cinders',legend:true,source:e.id,team:e.team,hero:9,rank:e.skillRanks[0],radius:100,life:3,amount:30*travel.strength,tick:0,pulses:0});}
 if(progress>=1){resolveBody(s,e);e.travel=null;}
 return true;
}
export function tickLegendZone({s,z,source,damage,heal,hostile}){
 if(z.maxPulses&&z.pulses>=z.maxPulses)return;
 z.tick=z.interval||.6;z.pulses++;
 const single=['decoy','spiritknot','worldbreaker','brambles'].includes(z.type);
 for(const t of s.units){
  if(t.hp<=0||distance(t,z)>=z.radius+t.radius||!lineOfSight(s,z,t))continue;
  if(hostile(s,source,t)){
   let amount=z.amount;
   if(z.type==='spiritknot'&&t.spiritUntil>s.time){amount*=1.6;t.spiritUntil=0;}
   if(z.type==='ninelights'&&t.spiritUntil>s.time)amount*=1.5;
   if(z.type==='garden'&&t.bleed?.type==='poison'&&t.bleed.until>s.time)amount*=1.5;
   if(amount>0)damage(s,source,t,amount);
   if(body(t)){
    if(['ink','frost','blizzard','garden','cinders','abyss'].includes(z.type))t.slow=1;
    if(['frost','blizzard'].includes(z.type))t.chillUntil=s.time+3;
    if(z.type==='abyss'){t.brineUntil=s.time+3;t.stun=Math.max(t.stun,.22);}
    if(z.type==='spiritknot'){t.stun=1+(z.rank-1)*.15;t.snaredUntil=s.time+t.stun;}
    if(z.type==='worldbreaker'){t.stun=2;t.snaredUntil=s.time+2;}
    if(z.type==='brambles'){t.stun=1+(z.rank-1)*.2;t.snaredUntil=s.time+t.stun;}
    if(z.type==='grove'&&z.pulses===1){t.stun=1;t.snaredUntil=s.time+1;}
    if(z.type==='garden'&&z.pulses%3===0)t.stun=Math.max(t.stun,1.2);
    if(z.type==='requiem'){if(z.pulses===1){t.fear=1;t.fearX=source.x;t.fearY=source.y;}heal(s,source,18*z.strength);}
   }
  }else if(z.healing&&t.kind==='hero'&&t.team===z.team)heal(s,t,z.healing);
 }
 if(single){z.life=0;s.effects.push({...z,type:'spell',slot:z.type==='worldbreaker'?3:2,life:.8,maxLife:.8,color:source.color});}
}
