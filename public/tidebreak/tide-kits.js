import { SIZE, clamp, distance, lineOfSight, resolveBody } from './world.js';
import { emitCombatFeedback } from './combat-state.js';
import { launchSkill } from './skill-events.js';
// Combat rules for the four shore kits (12 Irontide, 13 Bloodwake, 14 Zephyrs, 15 Coral Sage).
// Each kit adds a kind of play the first twelve do not have: a hook, an ally link, a taunt and a leash;
// a health cost, a parry and chained strikes; a moving cyclone, a wall against spells and a repelling storm;
// a position swap, a bouncing heal and a map-wide cleanse.
const body=t=>!['core','tower'].includes(t.kind);
const unit=(s,id)=>s.units.find(t=>t.id===id&&t.hp>0);
const sideOf=(e,angle,t)=>Math.sign(Math.cos(angle)*(t.y-e.y)-Math.sin(angle)*(t.x-e.x))||1;
// Enemies inside a straight band, nearest first.
function inLine(s,e,angle,length,width,hostile){
 return s.units.filter(t=>{
  if(!hostile(s,e,t)||!body(t)||!lineOfSight(s,e,t))return false;
  const dx=t.x-e.x,dy=t.y-e.y,along=dx*Math.cos(angle)+dy*Math.sin(angle),across=Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle));
  return along>0&&along<length+t.radius&&across<width+t.radius;
 }).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id);
}
const allyHeroes=(s,e,range)=>s.units.filter(t=>t.kind==='hero'&&t.team===e.team&&t.hp>0&&distance(e,t)<range&&lineOfSight(s,e,t));
const aimPoint=(e,c,reach)=>{const r=Math.min(reach,c.aim?.distance??reach);return {x:clamp(e.x+Math.cos(c.angle)*r,180,SIZE-180),y:clamp(e.y+Math.sin(c.angle)*r,180,SIZE-180)};};
const nearestTo=(list,point)=>list.sort((a,b)=>distance(a,point)-distance(b,point)||a.id-b.id)[0];
export const TIDE_DASH={13:{duration:.3,length:380,reach:95},14:{duration:.35,length:340,reach:105}};

export function castTide(c){
 const {s,e,slot,angle,rank,strength,origin,fx,damage,heal,hostile}=c;
 const zone=(type,point,radius,life,amount,extra={})=>s.zones.push({...point,type,legend:true,source:e.id,team:e.team,hero:e.hero,rank,strength,radius,life,amount,tick:0,pulses:0,...extra});
 const beam=(from,to)=>s.effects.push({x:from.x,y:from.y,tx:to.x,ty:to.y,color:c.color,type:'beam',hero:e.hero,life:.45,maxLife:.45});
 if(slot===0&&TIDE_DASH[e.hero]){
  const d=TIDE_DASH[e.hero];
  e.travel={...origin,angle,start:s.time,duration:d.duration,length:d.length+(rank-1)*25,strength,hitIds:[],tide:true};
  fx(origin,140);return true;
 }
 switch(e.hero*4+slot){
  case 48:{// Irontide · Anchor throw: the first enemy in the line is dragged to Irontide.
   const t=inLine(s,e,angle,560,45,hostile)[0];fx(origin,200);
   if(!t)return true;
   beam(e,t);damage(s,e,t,170*strength);
   const gap=e.radius+t.radius+18;t.x=e.x+Math.cos(angle)*gap;t.y=e.y+Math.sin(angle)*gap;resolveBody(s,t);t.stun=Math.max(t.stun,.5+(rank-1)*.1);
   emitCombatFeedback(s,e,t,'combo','HOOKED');return true;
  }
  case 49:{// Iron oath: link to an ally; Irontide takes 40% of the damage that ally takes.
   const allies=allyHeroes(s,e,500).filter(t=>t.id!==e.id),ally=c.aim?nearestTo(allies,aimPoint(e,c,500)):allies.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
   if(ally){ally.shield+=160*strength;ally.oath={source:e.id,until:s.time+5};fx(ally,150);beam(e,ally);}
   else{e.shield+=160*strength;fx(origin,150);}
   return true;
  }
  case 50:{// Challenge: nearby heroes and wisps must attack Irontide and cannot cast.
   const until=s.time+1.4+(rank-1)*.15;fx(origin,320);
   for(const t of s.units)if(hostile(s,e,t)&&['hero','minion'].includes(t.kind)&&distance(e,t)<320+t.radius&&lineOfSight(s,e,t)){damage(s,e,t,90*strength);t.tauntBy=e.id;t.tauntUntil=until;t.castIntent=null;t.queuedCast=null;}
   e.bulwarkUntil=until;return true;
  }
  case 51:{// Anchorfall: after a warning, chain every enemy near the anchor to it.
   zone('anchorfall',aimPoint(e,c,400),380,4.8,300*strength,{armed:s.time+.7,tick:.7,leash:240,maxPulses:1});return true;
  }
  case 53:{// Blood price: pay health for attack speed and heavier strikes.
   e.hp=Math.max(1,e.hp-e.hp*.1);e.bloodUntil=s.time+5;e.bloodStrength=strength;fx(origin,150);return true;
  }
  case 54:{// Red parry: the next hit from an enemy hero is blocked and answered.
   e.parryUntil=s.time+1;e.parryStrength=strength;e.parryRank=rank;fx(origin,130);return true;
  }
  case 55:{// Red horizon: cut through up to three enemies, heroes first.
   const targets=s.units.filter(t=>hostile(s,e,t)&&body(t)&&distance(e,t)<650&&lineOfSight(s,e,t)).sort((a,b)=>(a.kind==='hero'?0:1)-(b.kind==='hero'?0:1)||distance(e,a)-distance(e,b)||a.id-b.id).slice(0,3);
   fx(origin,650);if(targets.length)e.horizon={ids:targets.map(t=>t.id),next:s.time+.1,strength};return true;
  }
  case 57:{// Cyclone: a slow whirlwind travels forward and lifts each enemy once.
   zone('cyclone',origin,110,2,160*strength,{interval:.1,vx:Math.cos(angle)*325,vy:Math.sin(angle)*325,hitIds:[]});return true;
  }
  case 58:{// Wind wall: a wall across the aim stops enemy spell missiles and slows enemies inside.
   zone('windwall',aimPoint(e,c,300),180,4,0,{interval:.1,angle:angle+Math.PI/2,thickness:40});return true;
  }
  case 59:{// Eye of the storm: a ring follows Zephyrs, pushes enemies out and speeds allies.
   zone('eye',origin,420,6,45*strength,{interval:.5,follow:true});return true;
  }
  case 60:{// Tide swap: trade places with a hero near the aim.
   const point=aimPoint(e,c,520),heroes=s.units.filter(t=>t.kind==='hero'&&t.id!==e.id&&t.hp>0&&distance(e,t)<520&&lineOfSight(s,e,t)),t=c.aim||!c.target?nearestTo(heroes.filter(h=>distance(h,point)<220),point):heroes.find(h=>h.id===c.target.id);
   if(!t){const end=aimPoint(e,c,300);beam(e,end);e.x=end.x;e.y=end.y;resolveBody(s,e);fx(e,140);return true;}
   const from={x:e.x,y:e.y};e.x=t.x;e.y=t.y;t.x=from.x;t.y=from.y;resolveBody(s,e);resolveBody(s,t);beam(from,e);fx(e,140);fx(t,140);
   if(hostile(s,e,t)){damage(s,e,t,80*strength);t.slow=Math.max(t.slow,1.5);t.castIntent=null;emitCombatFeedback(s,e,t,'combo','TIDE SWAP');}
   else t.shield+=140*strength;
   return true;
  }
  case 61:{// Polyp swarm: a polyp hops between enemies and allies, hurting one and healing the other.
   const foes=s.units.filter(t=>hostile(s,e,t)&&body(t)&&distance(e,t)<520+t.radius&&lineOfSight(s,e,t)&&Math.abs(Math.atan2(Math.sin(Math.atan2(t.y-e.y,t.x-e.x)-angle),Math.cos(Math.atan2(t.y-e.y,t.x-e.x)-angle)))<.9).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id);
   const wounded=allyHeroes(s,e,520).filter(t=>t.id!==e.id&&t.hp<t.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id);
   const first=foes[0]||wounded[0];fx(origin,200);
   if(first)launchSkill(s,e,first,'polyp',120*strength,{strength,healing:110*strength,hops:5});
   return true;
  }
  case 62:{// Coral armor: shell an ally; the shield left when it ends becomes healing.
   const allies=allyHeroes(s,e,500),ally=c.aim?nearestTo(allies,aimPoint(e,c,500)):allies.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0]||e;
   ally.shield+=220*strength;ally.coral={until:s.time+4,shield:220*strength};fx(ally,150);if(ally!==e)beam(e,ally);return true;
  }
  case 63:{// Spring tide: every allied hero on the map is cleansed, healed and shielded.
   for(const t of s.units)if(t.kind==='hero'&&t.team===e.team&&t.hp>0){
    t.stun=t.fear=t.slow=0;t.snaredUntil=t.silencedUntil=t.disarmedUntil=t.tauntUntil=0;t.bleed=t.burn=null;t.chained=null;
    heal(s,t,260*strength);t.shield+=150*strength;fx(t,160);
   }
   return true;
  }
 }
 return true;
}

// Dashes, chained strikes and timed effects. Returns true while the hero is busy.
export function tickTide({s,e,damage,hostile}){
 if(e.horizon){
  const h=e.horizon;
  // A stun or fear that outlasts the gap between cuts ends the chain.
  if(s.time-h.next>1){e.horizon=null;return false;}
  if(s.time>=h.next){
   const t=unit(s,h.ids.shift());
   if(t&&hostile(s,e,t)){
    const a=Math.atan2(t.y-e.y,t.x-e.x),from={x:e.x,y:e.y};
    e.x=t.x-Math.cos(a)*(t.radius+e.radius+8);e.y=t.y-Math.sin(a)*(t.radius+e.radius+8);resolveBody(s,e);e.facing=a;
    s.effects.push({x:from.x,y:from.y,tx:e.x,ty:e.y,color:'#ff908b',type:'beam',hero:13,life:.4,maxLife:.4});
    damage(s,e,t,(220+Math.min(400,(t.maxHp-t.hp)*.15))*h.strength);
   }
   h.next=s.time+.25;if(!h.ids.length)e.horizon=null;
  }
  return true;
 }
 const travel=e.travel;if(!travel?.tide)return false;
 const d=TIDE_DASH[e.hero],progress=Math.min(1,(s.time-travel.start)/travel.duration);
 e.x=clamp(travel.x+Math.cos(travel.angle)*travel.length*progress,180,SIZE-180);e.y=clamp(travel.y+Math.sin(travel.angle)*travel.length*progress,180,SIZE-180);e.facing=travel.angle;e.moving=true;
 for(const t of s.units)if(hostile(s,e,t)&&body(t)&&!travel.hitIds.includes(t.id)&&distance(e,t)<d.reach+t.radius&&lineOfSight(s,e,t)){
  travel.hitIds.push(t.id);
  if(e.hero===13){damage(s,e,t,150*travel.strength);if(t.kind==='hero')t.lunge={source:e.id,until:s.time+3};}
  else{damage(s,e,t,90*travel.strength);const side=sideOf(e,travel.angle,t);t.x+=-Math.sin(travel.angle)*140*side;t.y+=Math.cos(travel.angle)*140*side;resolveBody(s,t);t.slow=Math.max(t.slow,1.5);}
 }
 if(progress>=1){resolveBody(s,e);e.travel=null;}
 return true;
}

// Zones of the shore kits. Returns true when the zone was handled here.
export function tickTideZone({s,z,source,damage,hostile}){
 if(z.type==='cyclone'){
  z.tick=z.interval;z.x=clamp(z.x+z.vx*z.interval,180,SIZE-180);z.y=clamp(z.y+z.vy*z.interval,180,SIZE-180);
  for(const t of s.units)if(hostile(s,source,t)&&body(t)&&!z.hitIds.includes(t.id)&&distance(t,z)<z.radius+t.radius&&lineOfSight(s,z,t)){z.hitIds.push(t.id);damage(s,source,t,z.amount);t.stun=Math.max(t.stun,.6);}
  return true;
 }
 if(z.type==='windwall'){
  z.tick=z.interval;
  const inside=p=>{const dx=p.x-z.x,dy=p.y-z.y;return Math.abs(dx*Math.cos(z.angle)+dy*Math.sin(z.angle))<z.radius&&Math.abs(-dx*Math.sin(z.angle)+dy*Math.cos(z.angle))<z.thickness+(p.radius||0);};
  for(const m of s.missiles)if(m.team!==z.team&&inside(m))m.life=0;
  for(const t of s.units)if(hostile(s,source,t)&&body(t)&&inside(t))t.slow=Math.max(t.slow,.5);
  return true;
 }
 if(z.type==='eye'){
  if(source.hp<=0){z.life=0;return true;}
  z.x=source.x;z.y=source.y;z.tick=z.interval;
  for(const t of s.units){
   if(t.hp<=0||distance(t,z)>=z.radius+t.radius)continue;
   if(hostile(s,source,t)&&lineOfSight(s,z,t)){damage(s,source,t,z.amount);if(body(t)){const d=Math.max(1,distance(t,z));t.x+=(t.x-z.x)/d*60;t.y+=(t.y-z.y)/d*60;resolveBody(s,t);}}
   else if(t.kind==='hero'&&t.team===z.team)t.windUntil=s.time+.6;
  }
  return true;
 }
 if(z.type==='anchorfall'){
  if(z.pulses>=1)return true;
  z.pulses++;
  for(const t of s.units)if(hostile(s,source,t)&&distance(t,z)<z.radius+t.radius&&lineOfSight(s,z,t)){damage(s,source,t,z.amount);if(body(t))t.chained={x:z.x,y:z.y,leash:z.leash,until:s.time+4};}
  // The anchor has struck: the ring stays to show the chains, but bots no longer need to dodge it.
  z.amount=0;s.effects.push({...z,type:'spell',slot:3,life:.8,maxLife:.8,color:source.color});
  return true;
 }
 return false;
}

// Polyp swarm: alternate between enemies and wounded allies, never twice on the same body.
export function hopPolyp(s,m,source,target,{damage,heal,hostile}){
 m.visited.push(target.id);
 const enemy=hostile(s,source,target);
 if(enemy)damage(s,source,target,m.amount);else heal(s,target,m.healing);
 if(m.visited.length>=m.hops){m.life=0;return;}
 const open=s.units.filter(t=>t.hp>0&&!m.visited.includes(t.id)&&distance(target,t)<300&&lineOfSight(s,target,t)&&(hostile(s,source,t)&&body(t)||t.kind==='hero'&&t.team===source.team&&t.hp<t.maxHp));
 const prefer=open.filter(t=>hostile(s,source,t)!==enemy),pool=prefer.length?prefer:open;
 const next=pool.sort((a,b)=>distance(target,a)-distance(target,b)||a.id-b.id)[0];
 if(next){m.target=next.id;}else m.life=0;
}

// Damage rules of the shore kits: parry, heavy strikes, the oath link and damage reduction.
// Returns the new amount, or null when the hit is blocked.
export function tideGuard(s,source,credit,target,amount,kind,damage){
 if(kind==='redirect')return amount;
 if(target.parryUntil>s.time&&credit?.kind==='hero'&&credit.team!==target.team&&credit.hp>0&&['attack','spell'].includes(kind)){
  target.parryUntil=0;const str=target.parryStrength||1;
  credit.stun=Math.max(credit.stun,1+((target.parryRank||1)-1)*.1);credit.pendingAttack=null;credit.castIntent=null;
  emitCombatFeedback(s,target,credit,'combo','RED PARRY');
  s.effects.push({x:target.x,y:target.y,tx:credit.x,ty:credit.y,color:'#ff908b',type:'beam',hero:13,life:.4,maxLife:.4});
  damage(s,target,credit,200*str);
  return null;
 }
 if(kind==='attack'&&source.bloodUntil>s.time)amount+=Math.min(120*(source.bloodStrength||1),(target.maxHp||0)*.05);
 if(target.oath?.until>s.time){
  const guard=unit(s,target.oath.source);
  if(guard&&guard!==target&&distance(guard,target)<900){const part=amount*.4;amount-=part;damage(s,source,guard,part,'redirect');}
 }
 if(target.bulwarkUntil>s.time)amount*=.7;
 if(target.coral?.until>s.time)amount*=.75;
 return amount;
}

// Once per step: leashes, the coral shell ending, and taunts that lose their source.
export function tickTideUnits(s,heal){
 for(const t of s.units){
  if(t.hp<=0)continue;
  const c=t.chained;
  if(c){if(s.time>=c.until)t.chained=null;else{const d=distance(t,c);if(d>c.leash){t.x=c.x+(t.x-c.x)/d*c.leash;t.y=c.y+(t.y-c.y)/d*c.leash;resolveBody(s,t);}}}
  if(t.coral&&s.time>=t.coral.until){const left=Math.min(t.shield,t.coral.shield);if(left>0){t.shield-=left;heal(s,t,left);}t.coral=null;}
  if(t.tauntUntil>s.time&&!unit(s,t.tauntBy))t.tauntUntil=0;
 }
}
export const taunter=(s,e)=>e.tauntUntil>s.time?unit(s,e.tauntBy):null;
// Crimson lunge: a banished hero that Bloodwake struck in the last three seconds resets the lunge.
export function onBanish(s,target){
 const l=target.lunge;if(l?.until>s.time){const b=s.units.find(t=>t.id===l.source&&t.hp>0);if(b)b.cd[0]=0;}
 target.lunge=target.oath=target.coral=target.chained=null;target.tauntUntil=target.parryUntil=target.bloodUntil=target.bulwarkUntil=0;target.horizon=null;
}
