// Free-swimming rescue simulation. No DOM, audio, or wall-clock dependencies.
export const MAX_CHICKS = 8;
export const HOME = {x:.5, y:.205};
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,(a.y-b.y)*1.65);
const spots = [[.5,.38],[.23,.35],[.77,.36],[.18,.59],[.82,.66],[.32,.78],[.64,.78],[.57,.56]];
export function createRun(seed = 1) {
  let n=seed>>>0;
  const random=()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};
  return {elapsed:0,x:.5,y:.28,target:{x:.5,y:.28},angle:0,history:[{t:0,x:.5,y:.28,angle:0}],
    flock:[],saved:0,score:0,trips:0,hearts:3,invincible:0,call:0,cooldown:0,
    breath:3,diving:false,exhausted:false,deposit:0,ended:false,won:false,events:[],
    chicks:spots.map(([x,y],id)=>({id,x:clamp(x+(id?random()-.5:0)*.07,.13,.87),y:y+(id?random()-.5:0)*.03,state:'waiting',lock:0})),
    rocks:[{x:.34,y:.47},{x:.68,y:.51},{x:.46,y:.69}],
    fish:[[.2,.46],[.78,.47],[.2,.75],[.79,.77],[.46,.58],[.62,.4]].map(([x,y])=>({x,y,cooldown:0})),
    boats:[],boatTimer:9,
    eel:{x:.84,y:.79,angle:0,active:false,stun:0,phase:'hunt',timer:4,aim:{x:.5,y:.5},trail:[]}};
}
export function birdPosition(r,i) {
  if(!i)return {x:r.x,y:r.y,angle:r.angle};
  const at=r.elapsed-i*(r.call>0?.08:.23);
  for(let j=r.history.length-1;j>=0;j--)if(r.history[j].t<=at)return r.history[j];
  return r.history[0];
}
export function callFlock(r) {
  if(r.ended||r.cooldown>0||r.diving)return false;
  r.call=2; r.cooldown=7;
  if(r.eel.active&&distance(r,r.eel)<.38){r.eel.stun=2.4;r.eel.phase='hunt';r.eel.timer=3;}
  r.events.push({kind:'call',text:'HONK! Nearby chicks follow. The eel is startled.'});return true;
}
export function toggleDive(r) {
  if(r.ended)return false;
  if(r.diving){r.diving=false;return true;}
  if(r.exhausted||r.breath<.8)return false;
  r.diving=true;r.call=0;
  r.events.push({kind:'dive',text:'Hidden! Slip under rocks and boats. Watch your breath.'});return true;
}
function move(o,target,speed,dt) {
  const dx=target.x-o.x,dy=(target.y-o.y)*1.65,d=Math.hypot(dx,dy);
  if(d<.002)return;
  const k=Math.min(d,speed*dt)/d;
  o.x+=dx*k;o.y+=dy*k/1.65;o.angle=Math.atan2(dy,dx)+Math.PI/2;
}
function damage(r,source) {
  if(r.invincible||r.diving||distance(r,HOME)<.105)return;
  r.hearts--;r.invincible=2.2;r.deposit=0;
  const ids=r.flock.splice(-Math.min(2,r.flock.length));
  ids.forEach((id,i)=>{const c=r.chicks[id];c.state='waiting';c.x=clamp(r.x+(i?-.09:.09),.12,.88);c.y=clamp(r.y+.07,.3,.8);c.lock=1.8;});
  r.events.push({kind:'hit',text:ids.length?'Scattered! Your chicks are still out there—go get them.':source==='eel'?'The eel got you! HONK to stun it, or DIVE to break pursuit.':'Ouch! Dive under obstacles or swim around.'});
}
function updateEel(r,dt) {
  const e=r.eel;
  if(!e.active&&(r.flock.length>0||r.elapsed>12)) {
    e.active=true;e.stun=2;
    r.events.push({kind:'warning',text:r.flock.length?'Something heard the chicks. Bring them to the nest!':'The eel is awake. Keep moving once you leave the nest!'});
  }
  if(!e.active)return;
  e.stun=Math.max(0,e.stun-dt);
  if(e.stun)return;
  const tail=birdPosition(r,r.flock.length);
  const safe=distance(r,HOME)<.14;
  e.timer-=dt;
  if(e.phase==='hunt') {
    if(!r.diving&&!safe)e.aim={x:tail.x,y:tail.y};
    if(safe)e.aim={x:.5+Math.sin(r.elapsed*.3)*.28,y:.55};
    move(e,e.aim,.135+Math.min(.045,r.saved*.006)+r.flock.length*.006,dt);
    if(e.timer<=0&&!r.diving&&!safe&&distance(e,tail)<.42){e.phase='windup';e.timer=.85;e.aim={x:tail.x,y:tail.y};r.events.push({kind:'warning',text:'The eel is winding up—turn, HONK, or DIVE!'});}
  } else if(e.phase==='windup') {
    if(e.timer<=0){e.phase='lunge';e.timer=.65;}
  } else {
    move(e,e.aim,.66,dt);
    if(e.timer<=0){e.phase='hunt';e.timer=4;e.stun=.65;}
  }
  e.trail.push({x:e.x,y:e.y});if(e.trail.length>26)e.trail.shift();
  if(!r.diving&&!safe)for(let i=r.flock.length;i>=0;i--){if(distance(e,birdPosition(r,i))<.058){damage(r,'eel');e.stun=1.5;break;}}
}
export function step(r,dt) {
  if(r.ended)return;
  dt=clamp(dt,0,.05);r.elapsed+=dt;
  r.invincible=Math.max(0,r.invincible-dt);r.call=Math.max(0,r.call-dt);r.cooldown=Math.max(0,r.cooldown-dt);
  if(r.diving){r.breath=Math.max(0,r.breath-dt);if(r.breath===0){r.diving=false;r.exhausted=true;r.events.push({kind:'surface',text:'Out of breath! Stay on the surface to refill.'});}}
  else{r.breath=Math.min(3,r.breath+dt*.8);if(r.breath>=1.2)r.exhausted=false;}
  r.target.x=clamp(r.target.x,.1,.9);r.target.y=clamp(r.target.y,.19,.82);
  const previous={x:r.x,y:r.y};
  move(r,r.target,(r.diving?.36:.29)-Math.min(.045,r.flock.length*.006),dt);
  if(!r.diving)for(const rock of r.rocks)if(distance(r,rock)<.075){damage(r,'rock');r.x=previous.x;r.y=previous.y;break;}
  r.history.push({t:r.elapsed,x:r.x,y:r.y,angle:r.angle});
  while(r.history.length>1&&r.history[1].t<r.elapsed-3)r.history.shift();
  for(const c of r.chicks){
    c.lock=Math.max(0,c.lock-dt);
    if(c.state!=='waiting'||c.lock||r.diving)continue;
    if(r.call&&distance(r,c)<.3)move(c,r,.27,dt);
    if(distance(r,c)<.065){c.state='following';r.flock.push(c.id);r.events.push({kind:'rescue',text:r.flock.length===1?'One aboard! Bank it at the nest—or risk a bigger flock.':`${r.flock.length} following. Bigger deliveries earn bigger bonuses!`});}
  }
  for(const f of r.fish){f.cooldown=Math.max(0,f.cooldown-dt);if(!f.cooldown&&r.diving&&distance(r,f)<.065){f.cooldown=14;r.score+=25;r.cooldown=Math.max(0,r.cooldown-2);r.events.push({kind:'fish',text:'Snack! +25 points. HONK recharges faster.'});}}
  if(distance(r,HOME)<.11&&!r.diving&&r.flock.length){
    r.deposit+=dt;
    if(r.deposit>=.65){const count=r.flock.length;r.saved+=count;r.trips++;r.score+=count*count*100;
      r.flock.forEach(id=>r.chicks[id].state='saved');r.flock=[];r.deposit=0;r.hearts=Math.min(3,r.hearts+1);
      r.events.push({kind:'bank',text:`${count} home safe! +${count*count*100}. Energy restored. ${MAX_CHICKS-r.saved} still need you.`});}
  } else r.deposit=0;
  r.boatTimer-=dt;
  if(r.boatTimer<=0){const direction=r.trips%2?1:-1;r.boats.push({x:direction>0?-.16:1.16,y:.43+(Math.floor(r.elapsed/9)%2)*.19,direction,age:0});r.boatTimer=Math.max(6.5,12-r.saved*.5);r.events.push({kind:'warning',text:'Boat crossing! Dive underneath or let it pass.'});}
  for(const b of r.boats){b.age+=dt;if(b.age>1.5)b.x+=b.direction*dt*.27;
    if(!r.diving&&b.age>1.5)for(let i=0;i<=r.flock.length;i++){const p=birdPosition(r,i);if(Math.abs(b.x-p.x)<.1&&Math.abs(b.y-p.y)<.033){damage(r,'boat');break;}}}
  r.boats=r.boats.filter(b=>b.age<7);
  updateEel(r,dt);
  if(r.hearts<=0||r.saved===MAX_CHICKS){r.ended=true;r.won=r.saved===MAX_CHICKS;
    if(r.won)r.score+=Math.max(0,Math.round(180-r.elapsed))*10;
    r.events.push({kind:'end'});}
}
