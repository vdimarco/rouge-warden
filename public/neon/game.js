import { District } from './district.js';
const $=id=>document.getElementById(id), canvas=$('world'),ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let district=null;try{district=new District()}catch(error){console.warn('3D district unavailable',error)}
const target=()=>district?district.target():{x:W*.5,y:H*.48};
let W=innerWidth,H=innerHeight,state='menu',time=0,last=0,enemy,particles=[],trails=[],cooldown=0,guard=false,guardAt=0,combo=0,health=100,score=0,wave=1,kills=0,charge=0,damage=1,windowBonus=0,leech=0,slow=0,flash=0,notice=0,muted=false,audio,beat=0,best=0;
try{best=Number(localStorage.getItem('neon-best'))||0}catch{}
let gyro=false,base=null,aim={x:0,y:0},raw=null,gyroReady=true,lastMotion=0,motionTimer;
const sword={pose:{x:0,y:0,angle:-Math.PI/2},last:0,speed:0,previous:null,direction:[0,1,0],lastDirection:[0,1,0],travel:0,lastVelocity:null};
const upgrades=[['Edge amplifier','Cuts deal +1 damage.',()=>damage++],['Time crystal','Parry window grows by 40 ms.',()=>windowBonus=Math.min(.25,windowBonus+.04)],['Repair pulse','Restore 35 integrity.',()=>health=Math.min(100,health+35)],['Vampire circuit','Each takedown restores 2 integrity.',()=>leech+=2],['Capacitor','Gain 35% overdrive now.',()=>charge=Math.min(100,charge+35)]];
function resize(){W=innerWidth;H=innerHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);district?.resize();resetSword()}addEventListener('resize',resize);resize();
function tone(f=220,d=.12,type='sawtooth',vol=.035){if(muted||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(f*.5,audio.currentTime+d);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d)}
function audioStart(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{})}catch{}}
function say(text){$('callout').textContent=text;notice=1.1}
function panel(html){$('explore').hidden=true;$('panel').innerHTML=html;$('overlay').hidden=false;$('controls').hidden=true}
function menu(){panel(`<div class="eyebrow">OPEN DISTRICT / MOTION COMBAT</div><h1>NEON<br><span>RONIN.</span></h1><p>A living district of lanterns, rooftop gardens and wandering sentinels.</p><p>Walk with the left thumb stick. Drag the right side to look. Hold your phone like a sword handle to cut and block. Collect spirit lights to recover.</p><button class="primary" id="gyroStart">PLAY WITH GYRO</button><button class="secondary" id="start">PLAY WITH TOUCH</button><p class="fine">${district?"Explore the market and canal. WASD also moves on desktop.":"3D could not start on this device. The fixed-view duel is available."} Keep a firm grip. Recenter sets your current grip as neutral. Best: ${best.toLocaleString()}.</p>`);$('start').onclick=()=>{disableGyro('Swipe to cut; hold Guard to block.');start()};$('gyroStart').onclick=async()=>{const enabled=await enableGyro();start();if(enabled)say('HOLD YOUR NATURAL GRIP')}}
function start(){audioStart();district?.reset();health=100;score=0;wave=1;kills=0;combo=0;charge=0;damage=1;windowBonus=0;leech=0;slow=0;cooldown=0;guard=false;particles=[];trails=[];base=null;spawn();resume();say('MATCH THE BRIGHT LINE')}
function resume(){state='play';resetSword();motionUI();guard=false;$('guard').textContent='HOLD TO GUARD';gyroReady=false;$('overlay').hidden=true;$('controls').hidden=false;$('explore').hidden=!district;$('hud').hidden=false;$('pause').textContent='Pause';last=performance.now()}
function spawn(){const boss=wave%5===0;const type=boss?'ENFORCER':['GHOST','RAZOR','SENTINEL'][Math.floor(Math.random()*Math.min(3,1+Math.floor(wave/2)))];enemy={type,boss,hp:boss?6+Math.floor(wave/3):2+Math.floor(wave/4),max:0,dir:Math.random()<.5?0:1,phase:'windup',timer:1.5,period:Math.max(.65,1.6-wave*.035),hit:0};enemy.max=enemy.hp;enemy.timer=enemy.period+(type==='GHOST'?.3:0);district?.placeEnemy(enemy)}
function burstParticles(x,y,color,n=22){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*260;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.45,color})}if(particles.length>220)particles.splice(0,particles.length-220)}
function hit(amount,parry=false){enemy.hp-=amount;enemy.hit=.2;burstParticles(target().x,target().y,parry?'#caff54':'#5cf5ff');tone(parry?640:330);charge=Math.min(100,charge+(parry?16:7));if(enemy.hp<=0){combo++;score+=Math.round((enemy.boss?500:100)*(1+Math.min(combo,20)*.1));health=Math.min(100,health+leech);kills++;if(kills>=3+Math.min(wave,5)){wave++;kills=0;state='upgrade';guard=false;const options=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);panel(`<div class="eyebrow">DISTRICT CLEARED</div><h2>Rewrite your blade.</h2><p>Choose a circuit for district ${wave}.</p>${options.map((u,i)=>`<button class="choice" data-choice="${i}"><strong>${u[0]}</strong><span>${u[1]}</span></button>`).join('')}`);document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{options[+b.dataset.choice][2]();spawn();resume()})}else{spawn();say(combo>1?`${combo} CHAIN`:'TARGET DOWN')}}}
function slash(dx,dy){if(state!=='play'||cooldown>0||(!gyro&&guard)||(district&&!district.canStrike()))return;cooldown=.24;const horizontal=Math.abs(dx)>=Math.abs(dy);trails.push({horizontal,life:.22,blade:gyro?swordSegment():null});tone(150,.08);if(enemy.phase==='open'||(horizontal?0:1)===enemy.dir){const powered=gyro&&charge>=100;if(powered){charge=0;slow=4;say('TIME FRACTURE')}hit(powered?damage*3:damage);if(state==='play')say('CLEAN CUT')}else{say('MATCH THE LINE');tone(75)}}
function overdrive(){if(state!=='play'||charge<100||(district&&!district.canStrike()))return;charge=0;slow=4;say('TIME FRACTURE');tone(880,.4);hit(damage*3,true)}
function setGuard(value){if(gyro)return;if(state!=='play'){guard=false;return}if(value&&!guard)guardAt=time;guard=value;$('guard').textContent=value?'GUARD ACTIVE':'HOLD TO GUARD'}
function pause(){if(state!=='play')return;state='pause';guard=false;panel('<div class="eyebrow">SIGNAL HELD</div><h2>Paused</h2><button class="primary" id="resume">RESUME</button><button class="secondary" id="quit">END RUN</button>');$('resume').onclick=resume;$('quit').onclick=gameOver}
function gameOver(){state='over';guard=false;best=Math.max(best,score);try{localStorage.setItem('neon-best',best)}catch{}panel(`<div class="eyebrow">CONNECTION LOST</div><h2>District ${wave}</h2><p>${score.toLocaleString()} points · Best ${best.toLocaleString()}</p><button class="primary" id="retry">RUN IT BACK</button>`);$('retry').onclick=start}
$('pause').onclick=pause;$('burst').onclick=overdrive;$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';audioStart()};$('center').onclick=()=>{resetSword();say('HOLD PHONE COMFORTABLY')};
$('guard').onpointerdown=e=>{e.preventDefault();$('guard').setPointerCapture(e.pointerId);setGuard(true)};for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('guard').addEventListener(ev,()=>setGuard(false));
let pointer=null;canvas.onpointerdown=e=>{if(state!=='play'||gyro)return;canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY}};canvas.onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;aim.x=clamp((e.clientX/W-.5)*2,-1,1);aim.y=clamp((e.clientY/H-.5)*2,-1,1);const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>32){slash(dx,dy);pointer.x=e.clientX;pointer.y=e.clientY}};for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>pointer=null);
addEventListener('keydown',e=>{if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')setGuard(true);if(['ArrowLeft','ArrowRight'].includes(e.code))slash(1,0);if(['ArrowUp','ArrowDown'].includes(e.code))slash(0,1);if(e.code==='KeyE')overdrive();if(e.code==='Escape')pause()});addEventListener('keyup',e=>{if(e.code==='Space')setGuard(false)});addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
// Orientation is calibrated in the player's grip. Quaternion differences avoid
// compass wrap and keep rotations continuous across portrait/landscape grips.
function multiply(a,b) {
  const [w,x,y,z]=a,[v,i,j,k]=b;
  return [w*v-x*i-y*j-z*k,w*i+x*v+y*k-z*j,w*j-x*k+y*v+z*i,w*k+x*j-y*i+z*v];
}
function inverse(q){return [q[0],-q[1],-q[2],-q[3]]}
function orientationQuaternion(alpha,beta,gamma) {
  const a=alpha*Math.PI/360,b=beta*Math.PI/360,c=gamma*Math.PI/360;
  return multiply(multiply([Math.cos(a),0,0,Math.sin(a)],[Math.cos(b),Math.sin(b),0,0]),[Math.cos(c),0,Math.sin(c),0]);
}
function rotate(q,v){return multiply(multiply(q,[0,...v]),inverse(q)).slice(1)}
function resetSword(){base=null;raw=null;gyroReady=false;sword.last=0;sword.speed=0;sword.previous=null;sword.direction=[0,1,0];sword.lastDirection=[0,1,0];sword.travel=0;sword.lastVelocity=null;guard=false;guardAt=-10}
// The phone's physical top edge is the blade axis. The wrist is the pivot;
// the blade keeps a fixed world length and foreshortens when aimed in depth.
function swordSegment() {
  const [x,y,z]=sword.direction;
  const roll=.19,pitch=.42;
  const rx=x*Math.cos(roll)-y*Math.sin(roll),ry=x*Math.sin(roll)+y*Math.cos(roll);
  const vy=ry*Math.cos(pitch)-z*Math.sin(pitch),vz=ry*Math.sin(pitch)+z*Math.cos(pitch);
  const length=Math.min(W*.85,H*.46),perspective=2.8/(2.8-vz*.85);
  const ax=W*.61+rx*Math.min(W,H)*.055,ay=H*.76+(1-vy)*Math.min(W,H)*.045;
  return {ax,ay,bx:ax+rx*length*perspective,by:ay-vy*length*perspective};
}
function nearBlade(s,x,y,r) {
  const dx=s.bx-s.ax,dy=s.by-s.ay,t=clamp(((x-s.ax)*dx+(y-s.ay)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-s.ax-dx*t,y-s.ay-dy*t)<r;
}
function bladeBlocks() {
  if(!gyro||!raw||performance.now()-sword.last>300||sword.speed>80)return false;
  const s=swordSegment(),dx=s.bx-s.ax,dy=s.by-s.ay,len=Math.hypot(dx,dy);if(len<Math.min(W,H)*.28)return false;const cross=enemy.dir===0?Math.abs(dy/len):Math.abs(dx/len);
  // Intercept the incoming blade along its path, including a low horizontal guard.
  const point=target();const t=enemy.dir===0?(point.y-s.ay)/(dy||1):(point.x-s.ax)/(dx||1);
  const ix=s.ax+dx*t,iy=s.ay+dy*t;
  return cross>.78&&t>=0&&t<=1&&ix>W*.15&&ix<W*.85&&iy>H*.25&&iy<H*.85;
}
function motionUI(){
  $('guard').hidden=gyro;$('burst').hidden=gyro;
  $('motion').textContent=gyro?'Gyro on · switch to touch':'Enable gyro';
}
function disableGyro(message){gyro=false;resetSword();clearTimeout(motionTimer);motionUI();$('hint').textContent=message}
async function enableGyro(){
  try {
    if(!window.isSecureContext||!window.DeviceOrientationEvent)throw Error('unavailable');
    // Called directly by a tap, as required by iOS permission prompts.
    const permission=typeof DeviceOrientationEvent.requestPermission==='function'?DeviceOrientationEvent.requestPermission():Promise.resolve('granted');
    if(await permission!=='granted')throw Error('denied');
    gyro=true;resetSword();motionUI();$('hint').textContent='Hold the phone by its lower half. Its top edge points along the blade.';
    clearTimeout(motionTimer);
    motionTimer=setTimeout(()=>{if(gyro&&!raw)disableGyro('No motion signal. Swipe to cut; hold Guard to block.');},3000);
    return true;
  }catch{disableGyro('Motion unavailable. Swipe to cut; hold Guard to block.');return false}
}
$('motion').onclick=()=>gyro?disableGyro('Swipe to cut; hold Guard to block.'):enableGyro();
addEventListener('deviceorientation',e=>{
  if(!gyro||state!=='play'||![e.alpha,e.beta,e.gamma].every(Number.isFinite))return;
  const q=orientationQuaternion(e.alpha,e.beta,e.gamma),now=performance.now();
  if(!base){base=q;sword.last=now;sword.previous=q;sword.pose={x:0,y:0,angle:-Math.PI/2};raw=q;return}
  const dt=(now-sword.last)/1000;
  if(dt<=0)return;
  if(dt>.3){resetSword();return}
  const relative=multiply(inverse(base),q);
  // +Y always points out of the physical top of the phone, even in landscape.
  // Twisting about this axis turns the edge but cannot create a blade swing.
  const direction=rotate(relative,[0,1,0]);
  const dot=direction.reduce((sum,v,i)=>sum+v*sword.lastDirection[i],0);
  const sweptAngle=Math.acos(clamp(dot,-1,1))*180/Math.PI;
  const speed=sweptAngle/dt;
  if(speed>1800){resetSword();return} // Reject sensor discontinuities.
  const prior=swordSegment(),alpha=1-Math.exp(-dt/.018);
  const velocity=direction.map((v,i)=>(v-sword.lastDirection[i])/dt);
  const reverse=sword.lastVelocity&&velocity.reduce((n,v,i)=>n+v*sword.lastVelocity[i],0)<-0.5;
  if(reverse&&speed>45){gyroReady=true;sword.travel=0}
  if(speed<35){gyroReady=true;sword.travel=0}
  sword.travel+=sweptAngle;
  sword.direction=sword.direction.map((v,i)=>v+(direction[i]-v)*alpha);
  const norm=Math.hypot(...sword.direction)||1;sword.direction=sword.direction.map(v=>v/norm);
  sword.speed=speed;sword.lastDirection=direction;sword.lastVelocity=velocity;
  sword.last=now;sword.previous=q;raw=q;
  const visible=swordSegment();
  sword.pose.angle=Math.atan2(visible.by-visible.ay,visible.bx-visible.ax);
  sword.pose.x=direction[0];sword.pose.y=direction[2];
  const current=swordSegment(),dx=current.bx-prior.bx,dy=current.by-prior.by;
  if(sword.speed>70&&sword.travel>=12&&gyroReady&&Math.hypot(dx,dy)/dt>65){
    // Sample the swept blade so fast swings cannot skip through the target.
    const radius=Math.min(W,H)*.16;
    let contact=false;
    for(let i=0;i<=8;i++){
      const t=i/8,s={};for(const k of ['ax','ay','bx','by'])s[k]=prior[k]+(current[k]-prior[k])*t;
      if(nearBlade(s,target().x,target().y,radius)){contact=true;break}
    }
    if(contact&&cooldown<=0){guard=false;slash(dx,dy);gyroReady=false;sword.travel=0}
  }
});
function update(dt){time+=dt;notice-=dt;if(notice<=0)$('callout').textContent='';cooldown=Math.max(0,cooldown-dt);slow=Math.max(0,slow-dt);flash=Math.max(0,flash-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);trails.forEach(t=>t.life-=dt);trails=trails.filter(t=>t.life>0);if(state!=='play')return;if(gyro){if(!raw)return;if(performance.now()-sword.last>500){disableGyro('Motion signal lost. Swipe to play.');pause();return}const blocked=bladeBlocks();if(blocked&&!guard)guardAt=time;guard=blocked;$('hint').textContent=guard?'BLADE SET · catch the strike':enemy.dir===0?'Hold the blade upright across the incoming cut.':'Turn the blade sideways across the incoming cut.';}enemy.hit=Math.max(0,enemy.hit-dt);if(district&&!district.canStrike()){enemy.timer=Math.max(enemy.timer,.65);$('hint').textContent='Explore freely. Face a nearby sentinel to fight.';return}enemy.timer-=dt*(slow>0?.4:1);if(enemy.timer<=0){if(enemy.phase==='windup'){const perfect=guard&&time-guardAt<.28+windowBonus;if(perfect){enemy.phase='open';enemy.timer=1.2;score+=25;hit(1,true);say('PERFECT PARRY')}else{health-=guard?(gyro?0:5):(enemy.boss?24:16);combo=0;flash=.25;burstParticles(W/2,H*.65,'#ff4a92',12);tone(55,.2);enemy.phase='open';enemy.timer=guard?.65:.4;if(health<=0)gameOver();else {if(guard&&gyro){burstParticles(W*.5,H*.48,'#65efff',18);tone(480,.09)}say(guard?'BLADE BLOCK':'HIT')}}}else{enemy.phase='windup';enemy.timer=enemy.period;enemy.dir=Math.random()<.5?0:1}}if(time>beat){beat=time+.26;tone([55,55,82,65][Math.floor(time*2)%4],.12,'triangle',.025)}$('health').textContent=Math.max(0,health);$('wave').textContent=String(wave).padStart(2,'0');$('score').textContent=score;$('burst').textContent=charge>=100?'RELEASE OVERDRIVE':`OVERDRIVE ${Math.floor(charge)}%`}
function line(x1,y1,x2,y2,c,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
// Generated raster plates are composited with live combat, weather and the
// orientation-driven weapon. Keep procedural art as a loading/error fallback.
const art={};
for(const name of ['street','duelist','grip']){
  const image=new Image();image.decoding='async';if(!district)image.src=`art/${name}.webp`;
  art[name]=image;
}
const ready=image=>image&&image.complete&&image.naturalWidth>0;
function drawStreet(){
  const im=art.street,scale=Math.max(W/im.naturalWidth,H/im.naturalHeight)*1.04;
  const w=im.naturalWidth*scale,h=im.naturalHeight*scale;
  const shift=gyro?sword.pose.x:aim.x;
  ctx.drawImage(im,(W-w)/2-shift*5,(H-h)*.43,w,h);
  const shade=ctx.createLinearGradient(0,0,0,H);
  shade.addColorStop(0,'#03081566');shade.addColorStop(.4,'#05071600');shade.addColorStop(1,'#03040ac9');
  ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  // Rain and slow vapour retain depth while the camera remains comfortable.
  for(let i=0;i<55;i++){
    const x=(i*97+time*17)%W,y=(i*67+time*(230+i%5*30))%H;
    line(x,y,x-2,y+9,'#b5dce12b',.7);
  }
  const mist=ctx.createRadialGradient(W*.3+Math.sin(time*.2)*W*.1,H*.68,1,W*.4,H*.65,W*.6);
  mist.addColorStop(0,'#719ea61c');mist.addColorStop(1,'#719ea600');ctx.fillStyle=mist;ctx.fillRect(0,H*.35,W,H*.5);
}
function drawDuelist(){
  const im=art.duelist,baseHeight=Math.min(H*.60,W*.94),ratio=im.naturalWidth/im.naturalHeight;
  const pressure=enemy.phase==='windup'?1-clamp(enemy.timer/enemy.period,0,1):0;
  const lunge=pressure>.8?(pressure-.8)*.45:0;
  const height=baseHeight*(1+lunge+(enemy.boss?.10:0)),width=height*ratio;
  const center=W*.5+Math.sin(time*1.6)*3,feet=H*.74;
  ctx.save();
  ctx.fillStyle='#02040b99';ctx.beginPath();ctx.ellipse(center,feet-3,width*.34,9,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.14;ctx.save();ctx.translate(center,feet);ctx.scale(1,-.26);ctx.drawImage(im,-width/2,-height,width,height);ctx.restore();ctx.globalAlpha=1;
  ctx.translate(center,feet-height+Math.sin(time*2.2)*1.5);
  if(enemy.hit>0)ctx.translate(Math.sin(enemy.hit*65)*enemy.hit*20,0);
  ctx.drawImage(im,-width/2,0,width,height);
  ctx.restore();
  // Compact world-space health bar and an incoming cut projected on the body.
  const top=feet-height;
  ctx.fillStyle='#070b16b3';ctx.fillRect(center-53,top-24,106,20);
  ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#d8e2e8';ctx.fillText(enemy.type,center,top-11);
  ctx.fillStyle='#ffffff24';ctx.fillRect(center-50,top-1,100,2);ctx.fillStyle=enemy.phase==='open'?'#caff54':'#ff745b';ctx.fillRect(center-50,top-1,100*Math.max(0,enemy.hp/enemy.max),2);
  const x=W*.5,y=H*.48,r=Math.min(W,H)*.13,c=enemy.phase==='open'?'#caff54':pressure>.76?'#ff785e':'#efc6a98c';
  ctx.globalAlpha=enemy.phase==='open'?.65:.25+pressure*.6;
  if(enemy.dir===0)line(x-r,y,x+r,y,c,2);else line(x,y-r,x,y+r,c,2);
  ctx.globalAlpha=1;
  if(enemy.phase==='windup'){
    ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r*1.3,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-pressure));ctx.stroke();
  }
}
function drawSteel(blade){
  const dx=blade.bx-blade.ax,dy=blade.by-blade.ay,length=Math.hypot(dx,dy)||1;
  ctx.save();ctx.translate(blade.ax,blade.ay);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
  const metal=ctx.createLinearGradient(-7,0,8,0);
  metal.addColorStop(0,'#113540');metal.addColorStop(.22,'#98cbd4');metal.addColorStop(.48,'#e7f0ed');metal.addColorStop(.53,'#6c788b');metal.addColorStop(1,'#222a3d');
  ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(-7,3);ctx.lineTo(-5,-length+24);ctx.lineTo(4,-length);ctx.lineTo(8,2);ctx.closePath();ctx.fill();
  ctx.shadowBlur=guard?16:4;ctx.shadowColor=guard?'#caff54':'#52d6e0';line(-7,1,-5,-length+24,guard?'#d9ffae':'#b3f3ed',1.5);ctx.shadowBlur=0;
  // Fine highlights on the steel, with a real gloved grip below the guard.
  for(let i=0;i<9;i++)line(-3,-length*.12-i*length*.075,4,-length*.12-i*length*.075-3,'#eaf6f62b',.5);
  if(!district&&ready(art.grip)){
    const size=clamp(Math.min(W,H)*.60,150,300);
    ctx.drawImage(art.grip,-size*.495,-size*.305,size,size);
  }else{
    line(-18,0,18,0,'#bbd4aa',6);line(0,5,0,48,'#5a7971',14);if(district){ctx.fillStyle='#bdc9a6';ctx.beginPath();ctx.ellipse(9,28,18,24,-.2,0,Math.PI*2);ctx.fill();line(18,45,47,108,'#587c79',30);for(let i=0;i<3;i++)line(-4,15+i*9,12,18+i*9,'#718e7b',3);}
  }
  ctx.restore();
}

function draw(){if(district){ctx.clearRect(0,0,W,H)}else if(ready(art.street)){drawStreet()}else{ctx.fillStyle='#070a18';ctx.fillRect(0,0,W,H);const horizon=H*.44;const glow=ctx.createRadialGradient(W*.5,horizon,5,W*.5,horizon,W*.7);glow.addColorStop(0,'#602060');glow.addColorStop(.5,'#161737');glow.addColorStop(1,'#070a18');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);for(let i=0;i<18;i++){const bw=W/12,x=i*W/15-bw*.5,bh=H*(.12+((i*37)%11)/50);ctx.fillStyle=i%2?'#101329':'#0a1024';ctx.fillRect(x,horizon-bh,bw,bh);line(x,horizon-bh,x+bw,horizon-bh,i%3?'#384468':'#e358b7',2);for(let j=0;j<7;j++)if((i+j)%3)line(x+9,horizon-bh+15+j*16,x+14,horizon-bh+15+j*16,'#476e8a',2)}for(let i=-8;i<=8;i++)line(W/2+i*22,horizon,W/2+i*180,H,'#253557');for(let i=0;i<14;i++){let z=((i/14+time*.06)%1)**2,y=horizon+z*(H-horizon);line(0,y,W,y,'#283252')}for(let i=0;i<35;i++){const x=(i*113+time*22)%W,y=(i*61+time*260)%H;line(x,y,x-3,y+13,'#46718b44')}
}
if(!district&&enemy&&ready(art.duelist)){drawDuelist()}else if(!district&&enemy){const x=W/2,y=H*.45,s=Math.min(W*.25,H*.19),bob=Math.sin(time*3)*4;ctx.save();ctx.translate(x+Math.sin(enemy.hit*80)*enemy.hit*30,y+bob);ctx.shadowBlur=enemy.hit>0?28:12;ctx.shadowColor=enemy.boss?'#ff579e':'#42dce8';ctx.strokeStyle=enemy.phase==='open'?'#caff54':'#74c9e0';ctx.lineWidth=2;ctx.fillStyle=enemy.hit>0?'#b2ebf8':'#182039';ctx.beginPath();ctx.moveTo(-s*.42,-s*.55);ctx.lineTo(0,-s*.75);ctx.lineTo(s*.42,-s*.55);ctx.lineTo(s*.26,-s*.12);ctx.lineTo(-s*.26,-s*.12);ctx.closePath();ctx.fill();ctx.stroke();line(-s*.25,-s*.4,s*.25,-s*.4,'#ff64c9',5);ctx.beginPath();ctx.moveTo(-s*.28,-s*.05);ctx.lineTo(-s*.62,s*.28);ctx.lineTo(-s*.4,s*.7);ctx.lineTo(s*.4,s*.7);ctx.lineTo(s*.62,s*.28);ctx.lineTo(s*.28,-s*.05);ctx.closePath();ctx.fill();ctx.stroke();line(-s*.25,s*.7,-s*.35,s*1.2,'#54829f',13);line(s*.25,s*.7,s*.35,s*1.2,'#54829f',13);const c=enemy.phase==='open'?'#caff54':'#ff6bcc';if(enemy.dir===0)line(-s*.85,s*.15,s*.85,s*.15,c,5);else line(0,-s*.7,0,s*.85,c,5);ctx.shadowBlur=0;ctx.fillStyle='#d1ddeb';ctx.textAlign='center';ctx.font='10px monospace';ctx.fillText(enemy.type,0,-s-22);ctx.fillStyle='#303047';ctx.fillRect(-s*.6,-s-12,s*1.2,4);ctx.fillStyle=c;ctx.fillRect(-s*.6,-s-12,s*1.2*Math.max(0,enemy.hp/enemy.max),4);if(enemy.phase==='windup'){const ratio=clamp(enemy.timer/enemy.period,0,1);ctx.strokeStyle=ratio<.25?'#ff4b78':'#67efff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,s*.2,s*1.02,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);ctx.stroke();ctx.fillStyle='#e8edfa';ctx.fillText(ratio<.25?'GUARD NOW':'INCOMING',0,s*1.5)}else{ctx.fillStyle='#caff54';ctx.fillText('EXPOSED · CUT',0,s*1.5)}ctx.restore()}
for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);line(p.x,p.y,p.x-p.vx*.035,p.y-p.vy*.035,p.color,2)}ctx.globalAlpha=1;for(const t of trails){ctx.globalAlpha=t.life/.22;ctx.shadowBlur=20;ctx.shadowColor='#70faff';if(t.blade)line(t.blade.ax,t.blade.ay,t.blade.bx,t.blade.by,'#d8ffff',7);else if(t.horizontal)line(W*.13,H*.44,W*.87,H*.48,'#d8ffff',7);else line(W*.48,H*.23,W*.53,H*.7,'#d8ffff',7)}ctx.globalAlpha=1;ctx.shadowBlur=0;if(state==='play'){
  const blade=gyro?swordSegment():{ax:W*.65+aim.x*W*.12,ay:H*.75+aim.y*H*.08,bx:W*.52+aim.x*W*.12,by:H*.47+aim.y*H*.08};
  drawSteel(blade);
  if(gyro&&enemy.phase==='windup'&&(!district||district.canStrike())){
    const {x,y}=target(),l=Math.min(W,H)*.13;
    ctx.setLineDash([5,7]);
    if(enemy.dir===0)line(x,y-l,x,y+l,guard?'#caff54':'#ffffff66',3);
    else line(x-l,y,x+l,y,guard?'#caff54':'#ffffff66',3);
    ctx.setLineDash([]);
  }
}if(flash>0){ctx.fillStyle=`rgba(255,30,90,${flash*.8})`;ctx.fillRect(0,0,W,H)}if(slow>0){ctx.strokeStyle='#caff54';ctx.lineWidth=4;ctx.strokeRect(2,2,W-4,H-4)}}
if(district)district.onPickup=()=>{health=Math.min(100,health+8);charge=Math.min(100,charge+12);say('SPIRIT LIGHT · +8 HEALTH')};
function frame(now){const dt=Math.min(.04,(now-last)/1000||.016);last=now;district?.update(dt,state==='play',enemy);if(district&&state==='play'){$('districtStatus').textContent=district.canStrike()?'SENTINEL IN REACH':`${district.collected} spirit lights · Explore the lanes`;$('health').textContent=Math.max(0,health);$('wave').textContent=String(wave).padStart(2,'0');$('score').textContent=score;}update(dt);draw();requestAnimationFrame(frame)}menu();requestAnimationFrame(frame);
