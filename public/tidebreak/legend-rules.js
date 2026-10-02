import { SIZE, clamp, distance, lineOfSight, resolveBody } from './world.js';
const body=t=>!['core','tower'].includes(t.kind);
export function castLegend(c){
 const {s,e,slot,target,angle,rank,strength,origin,fx,cone,damage,heal,area}=c;
 const zone=(type,point,radius,life,amount,extra={})=>s.zones.push({...point,type,legend:true,source:e.id,team:e.team,hero:e.hero,rank,strength,radius,life,amount,tick:0,pulses:0,...extra});
 const point={x:clamp(c.aim?e.x+Math.cos(angle)*360:target?.x??e.x+Math.cos(angle)*360,180,SIZE-180),y:clamp(c.aim?e.y+Math.sin(angle)*360:target?.y??e.y+Math.sin(angle)*360,180,SIZE-180)};
 const allies=(radius,fn)=>s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<radius&&lineOfSight(s,e,t)).forEach(fn);
 if(slot===0){
  const length=[390,450,430,320,460,470,370,390][e.hero-4]+(rank-1)*25;
  e.x+=Math.cos(angle)*length;e.y+=Math.sin(angle)*length;resolveBody(s,e);
  e.motion={...origin,start:s.time,duration:.38,arc:[30,90,100,45,70,170,35,25][e.hero-4]};
  fx(e,180);s.effects.push({...origin,tx:e.x,ty:e.y,color:c.color,type:'beam',hero:e.hero,life:.45,maxLife:.45});
  if(e.hero===4){e.shield+=180*strength;zone('ink',origin,190,4,38*strength);}
  if(e.hero===5)zone('frost',origin,190,5,32*strength);
  if(e.hero===6){e.shield+=120*strength;e.cloak=s.time+1.5;e.revealedUntil=-1;zone('decoy',origin,220,1.2,180*strength,{armed:s.time+.7,tick:.7});}
  if(e.hero===7){e.shield+=250*strength;cone(180,Math.PI,(t,a)=>{damage(s,e,t,170*strength);if(body(t)){t.x+=Math.cos(a)*170;t.y+=Math.sin(a)*170;resolveBody(s,t);}});}
  if(e.hero===8){e.shield+=210*strength;e.cloak=s.time+1.2;e.revealedUntil=-1;}
  if(e.hero===9){e.shield+=140*strength;zone('cinders',origin,185,5,35*strength);}
  if(e.hero===10)zone('moss',origin,210,5,0,{healing:50*strength});
  if(e.hero===11){e.shield+=240*strength;e.slow=0;e.bleed=null;e.burn=null;}
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
