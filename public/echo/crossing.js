// Free-swimming rescue simulation. No DOM, audio, or wall-clock dependencies.
export const MAX_CHICKS = 8;
export const HOME = {x:.5, y:.205};
export const ROCK = .075;  // a rock blocks the loon closer than this to its centre
export const GAP = .062;   // the length of path between two birds in the line
const LEAD = .045;         // more path behind the loon, so the first chick sits clear of its long body
const TRAIL = (MAX_CHICKS+2)*GAP+LEAD;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,(a.y-b.y)*1.65);
// Seeded numbers. The same seed gives the same lake, clutches and boats in every browser.
export const hash = text => {let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;};
export function seeded(seed) {let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
// Lake #1 is 1 January 2026, and each day has the next lake. The page gives the date at the cottage, so the whole crew swims the same lake.
export const lakeNumber = day => {const [y,m,d]=String(day).split('-').map(Number);return Math.max(1,Math.round((Date.UTC(y,m-1,d)-Date.UTC(2026,0,1))/864e5)+1||1);};
export const lakeSeed = n => hash(`loon-echo-lake-${n}`);
export const clock = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
// The line to share, for example "Lake #278 · 3 clutches · 21 home · 2:14".
export const shareLine = (r,lake) => `Lake #${lake} · ${r.clutch} ${r.clutch===1?'clutch':'clutches'} · ${r.saved} home · ${clock(r.elapsed)}`;
const START = {x:.5, y:.28};
// The seed sets the lake: two to four rocks, six fish and three boat lanes. Rocks keep clear of the start and of each other,
// so the loon can always swim between them.
function makeLake(seed) {
  const random=seeded(hash(`${seed}:lake`)),rocks=[],fish=[],count=2+Math.floor(random()*3);
  for(let i=0;i<500&&rocks.length<count;i++){const p={x:.25+random()*.5,y:.41+random()*.33};if(distance(p,START)>.22&&rocks.every(o=>distance(o,p)>.27))rocks.push(p);}
  for(let gap=.16;fish.length<6;gap*=.85)for(let i=0;i<300&&fish.length<6;i++){const p={x:.16+random()*.68,y:.36+random()*.44,cooldown:0};if(rocks.every(o=>distance(o,p)>ROCK+.05)&&fish.every(o=>distance(o,p)>gap))fish.push(p);}
  // one lane in each band, so the lanes never crowd; the first two (the lanes of clutch 1) change from lake to lake
  const lanes=[.42,.58,.74].map(y=>y+(random()-.5)*.06);
  for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
  return {rocks,fish,lanes};
}
const newEel=(x,y)=>({x,y,angle:0,active:false,stun:0,phase:'hunt',timer:4,aim:{x:.5,y:.5},trail:[]});
export function createRun(seed = 1) {
  const eel=newEel(.84,.79),r={seed:seed>>>0,elapsed:0,x:START.x,y:START.y,target:{...START},angle:0,trail:[{...START,angle:0,d:0}],
    flock:[],saved:0,home:0,clutch:1,score:0,trips:0,biggest:0,hearts:3,invincible:0,call:0,cooldown:0,bump:0,
    breath:3,diving:false,exhausted:false,deposit:0,ended:false,cause:'',events:[],chicks:[],
    ...makeLake(seed>>>0),boats:[],boatTimer:9,boatCount:0,eel,eels:[eel]};
  r.chicks=hatch(r);return r;
}
// Eight chicks hatch at spots from the seed. The spots keep clear of the nest, the rocks and each other.
function hatch(r) {
  const random=seeded(hash(`${r.seed}:clutch:${r.clutch}`)),spots=[];
  for(let gap=.11;spots.length<MAX_CHICKS;gap*=.85)for(let i=0;i<300&&spots.length<MAX_CHICKS;i++){
    const p={x:.14+random()*.72,y:.33+random()*.47};
    if(distance(p,HOME)>.2&&r.rocks.every(o=>distance(o,p)>ROCK+.05)&&spots.every(o=>distance(o,p)>gap))spots.push(p);
  }
  return spots.map(({x,y},id)=>({id,x,y,state:'waiting',lock:r.clutch>1?.6:0}));
}
// Each clutch makes the lake more dangerous: a faster eel that rests less between lunges, a second eel from clutch 3
// and one more every three clutches (six at most), a third boat lane from clutch 2, boats more often, and boats in pairs from clutch 4.
export function danger(r) {
  const k=r.clutch-1;
  return {hunt:.135+Math.min(.09,k*.012),rest:Math.max(1.1,4-k*.35),reach:Math.min(.62,.42+k*.025),lunge:Math.min(1,.66+k*.04),windup:Math.max(.55,.85-Math.max(0,k-5)*.04),
    eels:Math.min(6,1+Math.floor(r.clutch/3)),lanes:r.clutch>=2?3:2,boatGap:Math.max(2,11-k*.9),boatSpeed:Math.min(.5,.27+k*.025),pairs:r.clutch>=10?1:r.clutch>=4?.5:0};
}
// Bird i sits LEAD+i*GAP back along the path of the loon (bird 0 is the loon). The line keeps its spacing when the loon stops or honks.
export function birdPosition(r,i) {
  if(!i)return {x:r.x,y:r.y,angle:r.angle};
  const t=r.trail,last=t[t.length-1],head=last.d+distance(r,last),want=head-LEAD-i*GAP;
  let b={x:r.x,y:r.y,angle:r.angle,d:head};
  for(let j=t.length-1;j>=0;j--){const a=t[j];if(a.d<=want){const k=(want-a.d)/(b.d-a.d||1);return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,angle:b.angle};}b=a;}
  return {x:t[0].x,y:t[0].y,angle:t[0].angle};
}
// Adds a point to the path each time the loon swims a little way, and forgets the path behind the last bird.
function extendTrail(r) {
  const last=r.trail[r.trail.length-1],d=distance(r,last);
  if(d<.004)return;
  r.trail.push({x:r.x,y:r.y,angle:r.angle,d:last.d+d});
  while(r.trail.length>2&&last.d+d-r.trail[1].d>TRAIL)r.trail.shift();
}
export function callFlock(r) {
  if(r.ended||r.cooldown>0||r.diving)return false;
  r.call=2; r.cooldown=7;
  for(const e of r.eels)if(e.active&&distance(r,e)<.38){e.stun=2.4;e.phase='hunt';e.timer=3;}
  r.events.push({kind:'call',text:'HONK. Near chicks swim to you. A near eel stops for a moment.'});return true;
}
export function toggleDive(r) {
  if(r.ended)return false;
  if(r.diving){r.diving=false;return true;}
  if(r.exhausted||r.breath<.8)return false;
  r.diving=true;r.call=0;
  r.events.push({kind:'dive',text:'You are under the water. Rocks, boats and eels pass over you. Watch your breath.'});return true;
}
function move(o,target,speed,dt) {
  const dx=target.x-o.x,dy=(target.y-o.y)*1.65,d=Math.hypot(dx,dy);
  if(d<.002)return;
  const k=Math.min(d,speed*dt)/d;
  o.x+=dx*k;o.y+=dy*k/1.65;o.angle=Math.atan2(dy,dx)+Math.PI/2;
}
// Moves a point out of a rock to its rim. Returns true if the point was in the rock.
function pushOut(o,rock,toward=o) {
  let nx=o.x-rock.x,ny=(o.y-rock.y)*1.65,d=Math.hypot(nx,ny);
  if(d>=ROCK)return false;
  if(d<1e-6){nx=toward.x-rock.x;ny=(toward.y-rock.y)*1.65;d=Math.hypot(nx,ny);if(d<1e-6){nx=0;ny=-1;d=1;}}
  o.x=rock.x+nx/d*ROCK;o.y=rock.y+ny/d*ROCK/1.65;return true;
}
// Rocks block the loon at the surface and do no damage. If the target is behind a rock, the loon slides along the rim toward it.
function swim(r,dt) {
  const speed=(r.diving?.36:.29)-Math.min(.045,r.flock.length*.006);
  let goal=r.target,slide=null;
  if(!r.diving)for(const rock of r.rocks){
    const nx=r.x-rock.x,ny=(r.y-rock.y)*1.65,d=Math.hypot(nx,ny)||1e-9,gx=goal.x-r.x,gy=(goal.y-r.y)*1.65;
    if(d>ROCK+.003||gx*nx+gy*ny>=0||distance(goal,rock)<ROCK)continue;
    let tx=-ny/d,ty=nx/d,side=tx*(goal.x-rock.x)+ty*(goal.y-rock.y)*1.65;
    if(Math.abs(side)<1e-6)side=tx*(.5-rock.x)+ty*(.5-rock.y)*1.65||tx||1;
    if(side<0){tx=-tx;ty=-ty;}
    goal={x:r.x+tx,y:r.y+ty/1.65};slide=rock;break;
  }
  move(r,goal,speed,dt);
  if(r.diving)return;
  r.rocks.forEach((rock,i)=>{
    const inside=distance(r,rock)<ROCK;
    if(!inside&&rock!==slide)return;
    if(!r.bump)r.events.push({kind:'bonk',rock:i,x:r.x,y:r.y});
    r.bump=.4;
    if(!pushOut(r,rock,r.target)&&rock===slide){const d=distance(r,rock);r.x=rock.x+(r.x-rock.x)*ROCK/d;r.y=rock.y+(r.y-rock.y)*ROCK/d;}
    if(distance(r.target,rock)<ROCK)r.target={x:r.x,y:r.y};
  });
}
function damage(r,source) {
  if(r.invincible||r.diving||distance(r,HOME)<.105)return;
  r.hearts--;r.invincible=2.2;r.deposit=0;r.cause=source;
  const ids=r.flock.splice(-Math.min(2,r.flock.length));
  ids.forEach((id,i)=>{const c=r.chicks[id];c.state='waiting';c.x=clamp(r.x+(i?-.09:.09),.12,.88);c.y=clamp(r.y+.07,.3,.8);c.lock=1.8;r.rocks.forEach(rock=>pushOut(c,rock,r));});
  r.events.push({kind:'hit',source,text:ids.length?'The line broke. Your chicks wait near you. Go back for them.':source==='eel'?'The eel bit you. HONK to stun it, or DIVE to get away.':'A boat hit you. Dive under boats, or wait for them to pass.'});
}
// The first eel hunts the tail of the line. The second eel goes for the nearest bird. The eels take turns to strike.
function updateEel(r,e,index,dt) {
  if(!e.active&&(r.flock.length>0||r.elapsed>12)) {
    e.active=true;e.stun=2;
    r.events.push({kind:'warning',text:r.flock.length?'Something heard the chicks. Bring them to the nest.':'The eel is awake. Keep moving when you leave the nest.'});
  }
  if(!e.active)return;
  e.stun=Math.max(0,e.stun-dt);
  if(e.stun)return;
  const d=danger(r),safe=distance(r,HOME)<.14;
  let prey=birdPosition(r,r.flock.length);
  if(index)for(let i=0;i<r.flock.length;i++){const p=birdPosition(r,i);if(distance(e,p)<distance(e,prey))prey=p;}
  e.timer-=dt;
  if(e.phase==='hunt') {
    if(!r.diving&&!safe)e.aim={x:prey.x,y:prey.y};
    if(safe)e.aim={x:.5+Math.sin(r.elapsed*.3+index*2.4)*.28,y:.55+index*.14};
    move(e,e.aim,d.hunt+Math.min(.045,r.home*.006)+r.flock.length*.006,dt);
    if(e.timer<=0&&!r.diving&&!safe&&distance(e,prey)<d.reach&&!r.eels.some(o=>o!==e&&o.phase!=='hunt')){e.phase='windup';e.timer=d.windup;e.aim={x:prey.x,y:prey.y};r.events.push({kind:'warning',text:'The eel is about to strike. Turn, HONK or DIVE.'});}
  } else if(e.phase==='windup') {
    if(e.timer<=0){e.phase='lunge';e.timer=.65;}
  } else {
    move(e,e.aim,d.lunge,dt);
    if(e.timer<=0){e.phase='hunt';e.timer=d.rest;e.stun=.65;}
  }
  e.trail.push({x:e.x,y:e.y});if(e.trail.length>26)e.trail.shift();
  if(r.diving||safe||e.phase==='windup')return;
  // Only a lunge costs energy, and it always comes after the warning. A touch while the eel hunts takes one chick from the line.
  for(let i=r.flock.length;i>=0;i--){if(distance(e,birdPosition(r,i))>=.058)continue;
    if(e.phase==='lunge'){damage(r,'eel');e.stun=1.5;}else if(i)nip(r,e,i);
    break;}
}
function nip(r,e,i) {
  const spot=birdPosition(r,i),c=r.chicks[r.flock.splice(i-1,1)[0]];
  c.state='waiting';c.x=clamp(spot.x,.12,.88);c.y=clamp(spot.y,.3,.8);c.lock=1.8;r.rocks.forEach(rock=>pushOut(c,rock,r));
  e.stun=1.2;r.deposit=0;
  r.events.push({kind:'nip',x:c.x,y:c.y,text:'The eel took a chick from your line. Go back for it.'});
}
// Banks the whole line for 100 × group². A full nest hatches the next clutch.
function bank(r) {
  const count=r.flock.length,points=count*count*100,spots=r.flock.map((id,i)=>birdPosition(r,i+1)),healed=r.hearts<3;
  r.saved+=count;r.home+=count;r.trips++;r.score+=points;r.biggest=Math.max(r.biggest,count);
  r.flock.forEach(id=>r.chicks[id].state='saved');r.flock=[];r.deposit=0;r.hearts=Math.min(3,r.hearts+1);
  const full=r.home>=MAX_CHICKS;
  r.events.push({kind:'bank',count,points,full,spots,text:`${count} home. +${points.toLocaleString('en-US')}.${healed?' +1 energy.':''}${full?'':` ${MAX_CHICKS-r.home} still need you.`}`});
  if(full)nextClutch(r);
}
const CLUTCH_NEWS=['','','The eel is faster now, and boats use a third lane.','A second eel wakes up. It goes for the nearest bird.','Boats now cross in pairs.'];
function nextClutch(r) {
  r.clutch++;r.home=0;r.chicks=hatch(r);r.hearts=3;
  while(r.eels.length<danger(r).eels){
    const room=p=>Math.min(distance(p,r),...r.eels.map(e=>distance(p,e)));
    const spot=[{x:.16,y:.79},{x:.84,y:.79},{x:.16,y:.5},{x:.84,y:.5},{x:.5,y:.81},{x:.16,y:.65}].sort((a,b)=>room(b)-room(a))[0],e=newEel(spot.x,spot.y);
    e.active=true;e.stun=2.5;r.eels.push(e);r.events.push({kind:'eel',x:e.x,y:e.y});
  }
  r.events.push({kind:'clutch',clutch:r.clutch,text:`Clutch ${r.clutch} hatched. ${CLUTCH_NEWS[r.clutch]||'The eels are faster again.'}`});
}
export function step(r,dt) {
  if(r.ended)return;
  dt=clamp(dt,0,.05);r.elapsed+=dt;
  r.invincible=Math.max(0,r.invincible-dt);r.call=Math.max(0,r.call-dt);r.cooldown=Math.max(0,r.cooldown-dt);r.bump=Math.max(0,r.bump-dt);
  if(r.diving){r.breath=Math.max(0,r.breath-dt);if(r.breath===0){r.diving=false;r.exhausted=true;r.events.push({kind:'surface',text:'Out of breath. Stay on the surface to fill up again.'});}}
  else{r.breath=Math.min(3,r.breath+dt*.8);if(r.breath>=1.2)r.exhausted=false;}
  r.target.x=clamp(r.target.x,.1,.9);r.target.y=clamp(r.target.y,.19,.82);
  swim(r,dt);
  extendTrail(r);
  for(const c of r.chicks){
    c.lock=Math.max(0,c.lock-dt);
    if(c.state!=='waiting'||c.lock||r.diving)continue;
    if(r.call&&distance(r,c)<.3){move(c,r,.27,dt);r.rocks.forEach(rock=>pushOut(c,rock,r));}
    if(distance(r,c)<.065){c.state='following';r.flock.push(c.id);r.events.push({kind:'rescue',x:c.x,y:c.y,text:r.flock.length===1?'One chick follows you. Bank it at the nest, or risk a longer line.':`${r.flock.length} follow you. A bigger group scores more: 100 × ${r.flock.length}² = ${(r.flock.length**2*100).toLocaleString('en-US')}.`});}
  }
  for(const f of r.fish){f.cooldown=Math.max(0,f.cooldown-dt);if(!f.cooldown&&r.diving&&distance(r,f)<.065){f.cooldown=14;r.score+=25;r.cooldown=Math.max(0,r.cooldown-2);r.events.push({kind:'fish',x:f.x,y:f.y,text:'Fish snack. +25 points, and HONK is ready sooner.'});}}
  if(distance(r,HOME)<.11&&!r.diving&&r.flock.length){
    r.deposit+=dt;
    if(r.deposit>=.65)bank(r);
  } else r.deposit=0;
  r.boatTimer-=dt;
  if(r.boatTimer<=0){
    const d=danger(r),random=seeded(hash(`${r.seed}:boat:${r.boatCount++}`)),lanes=r.lanes.slice(0,d.lanes),lane=Math.floor(random()*lanes.length),direction=random()<.5?1:-1;
    r.boats.push({x:direction>0?-.16:1.16,y:lanes[lane],direction,age:0,speed:d.boatSpeed});
    if(random()<d.pairs)r.boats.push({x:direction>0?1.16:-.16,y:lanes[(lane+1+Math.floor(random()*(lanes.length-1)))%lanes.length],direction:-direction,age:0,speed:d.boatSpeed});
    r.boatTimer=Math.max(3,d.boatGap-r.home*.35);r.events.push({kind:'warning',text:'A boat is coming. Dive under it, or let it pass.'});
  }
  for(const b of r.boats){b.age+=dt;if(b.age>1.5)b.x+=b.direction*dt*(b.speed||.27);
    if(!r.diving&&b.age>1.5)for(let i=0;i<=r.flock.length;i++){const p=birdPosition(r,i);if(Math.abs(b.x-p.x)<.1&&Math.abs(b.y-p.y)<.033){damage(r,'boat');break;}}}
  r.boats=r.boats.filter(b=>b.age<1.5||Math.abs(b.x-.5)<.7);
  r.eels.forEach((e,i)=>updateEel(r,e,i,dt));
  if(r.hearts<=0){r.ended=true;r.events.push({kind:'end',cause:r.cause});}
}
