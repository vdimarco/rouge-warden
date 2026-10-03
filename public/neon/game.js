import { District } from './district.js';
import { drawAlienBackdrop } from './alien-world.js';
import { Duel,PARRY_WINDOW } from './duel.js';
import { MouseSword,MouseLook } from './mouse-sword.js';
import { viewport,viewportPoint,lockViewport,unlockViewport } from './viewport.js';
import { orientationQuaternion,motionFrame } from './motion-frame.js';
const $=id=>document.getElementById(id), canvas=$('world'),ctx=canvas.getContext('2d');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let district=null;try{district=new District()}catch(error){console.warn('3D district unavailable',error)}
const target=()=>district?district.target():{x:W*.5,y:H*.48};
let W=viewport.width,H=viewport.height,state='menu',time=0,last=0,enemy,particles=[],trails=[],cooldown=0,guard=false,guardAt=0,combo=0,health=100,score=0,wave=1,kills=0,charge=0,damage=1,windowBonus=0,leech=0,slow=0,flash=0,notice=0,muted=false,audio,beat=0,best=0;
try{best=Number(localStorage.getItem('neon-best'))||0}catch{}
// New biome defaults on once, then respects subsequent player choices.
let visualStyle='rick-morty';try{if(localStorage.getItem('neon-biome-version')==='2')visualStyle=localStorage.getItem('neon-style')==='ghibli'?'ghibli':'rick-morty';localStorage.setItem('neon-biome-version','2')}catch{}
function applyStyle(value){visualStyle=value==='rick-morty'?'rick-morty':'ghibli';district?.setStyle(visualStyle);document.documentElement?.setAttribute('data-style',visualStyle);try{localStorage.setItem('neon-style',visualStyle)}catch{}}
applyStyle(visualStyle);
let duel=null,duelGuardAt=-10,duelWasBlocked=false;
let chainClock=0,chainBest=0,killFlash=0,runTime=0,cleaveRadius=3.8,droneArmor=0;
const mouseSword=new MouseSword(),mouseLook=new MouseLook();
const desktop=matchMedia('(hover:hover) and (pointer:fine)').matches;
document.body.classList.toggle('mouse-mode',desktop);
let motionRoll=0;
let gyro=false,base=null,aim={x:0,y:0},raw=null,gyroReady=true,lastMotion=0,motionTimer;
const sword={pose:{x:0,y:0,angle:-Math.PI/2},last:0,speed:0,previous:null,direction:[0,1,0],lastDirection:[0,1,0],travel:0,lastVelocity:null};
const upgrades=[['Edge amplifier','Cuts deal +1 damage.',()=>damage++],['Time crystal','Parry window grows by 40 ms.',()=>windowBonus=Math.min(.25,windowBonus+.04)],['Repair pulse','Restore 35 integrity.',()=>health=Math.min(100,health+35)],['Vampire circuit','Each takedown restores 2 integrity.',()=>leech+=2],['Capacitor','Gain 35% overdrive now.',()=>charge=Math.min(100,charge+35)]];
function resize(){W=viewport.width;H=viewport.height;const d=Math.min(devicePixelRatio||1,1.25);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);district?.resize()}addEventListener('resize',resize);resize();
function tone(f=220,d=.12,type='sawtooth',vol=.035){if(muted||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(f*.5,audio.currentTime+d);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+d)}
function audioStart(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{})}catch{}}
function say(text){$('callout').textContent=text;notice=1.1}
function panel(html){document.exitPointerLock?.();$('runStatus').hidden=true;$('explore').hidden=true;$('panel').innerHTML=html;$('overlay').hidden=false;$('controls').hidden=true}
async function enterWidescreen(){
  try{await document.documentElement?.requestFullscreen?.();}catch{}
  try{await screen.orientation?.lock?.('landscape');}catch{}
  const message=innerWidth>innerHeight?'Widescreen ready. Hold both ends and choose Play.':'Rotate your tablet sideways, then choose Play.';
  $('wideHelp').textContent=message;
}
function menu(){panel(`<div class="eyebrow">PORTAL BADLANDS / MOTION COMBAT</div><h1>NEON<br><span>RONIN.</span></h1><p>Meet their blade. Break their guard. Land a clean strike. Win longer duels against one opponent, then two, three and larger groups.</p><p>Desktop: move the mouse to aim your blade. Left-click or drag to swing, right-click to guard, move the mouse to turn your view. Escape releases the mouse. WASD moves. Space rolls in your movement direction; release movement to roll backward. Red sweeps must be dodged. On mobile, run with the left thumb stick. In gyro mode, move your phone to look, cut and block. In touch mode, drag the right side to look. Push the stick to its edge to dash. Hold the sword across an incoming cut to block. Set it just before impact to parry.</p><button class="secondary" id="wideStart">WIDESCREEN · TWO HANDS</button><p class="wide-help" id="wideHelp">Tablet: rotate to landscape and hold both ends. Left thumb moves; turn the tablet to aim.</p><label class="style-label" for="visualStyle">WORLD STYLE</label><select id="visualStyle"><option value="rick-morty">Rick and Morty · Portal Badlands</option><option value="ghibli">Cyber Ghibli · Courtyard</option></select><button class="primary" id="gyroStart">PLAY WITH GYRO</button><button class="secondary" id="start">${desktop?'PLAY WITH MOUSE':'PLAY WITH TOUCH'}</button><p class="fine">${district?"Explore the open world. WASD also moves on desktop.":"3D could not start on this device. The fixed-view duel is available."} Hold both ends in landscape. Hold the phone at any comfortable angle, even low. Screen layout stays locked during play. Roll your wrist to turn the blade; the world counter-rotates to keep its horizon steady. Tap Reset view to set your comfortable grip as neutral. Best: ${best.toLocaleString()}.</p>`);$('wideStart').onclick=enterWidescreen;$('visualStyle').value=visualStyle;$('visualStyle').onchange=e=>applyStyle(e.target.value);$('start').onclick=()=>{void lockViewport();disableGyro('Swipe to cut; hold Guard to block.');start()};$('gyroStart').onclick=async()=>{const enabled=await enableGyro();start();if(enabled)say('HOLD YOUR NATURAL GRIP')}}
function start(){chainClock=0;chainBest=0;killFlash=0;runTime=0;cleaveRadius=3.8;droneArmor=0;audioStart();district?.reset();health=100;score=0;wave=1;kills=0;combo=0;charge=0;damage=1;windowBonus=0;leech=0;slow=0;cooldown=0;guard=false;particles=[];trails=[];base=null;spawn();resume();say(district?'MATCH BLADES · BREAK THEIR GUARD':'MATCH THE BRIGHT LINE')}
function resume(){if(desktop&&!gyro)try{const lock=canvas.requestPointerLock?.();lock?.catch?.(()=>{})}catch{}state='play';$('runStatus').hidden=!district;resetSword();motionUI();guard=false;$('guard').textContent='HOLD TO GUARD';gyroReady=false;$('overlay').hidden=true;$('controls').hidden=false;$('explore').hidden=!district;$('hud').hidden=false;$('pause').textContent='Pause';last=performance.now()}
function spawn(){if(district){duel=new Duel(wave);district.beginEncounter(duel.fighters);if(!district.assetsRequested){district.assetsRequested=true;import('./model-assets.js').then(m=>m.loadDuelAssets(district)).catch(()=>{district.modelStatus='unavailable'})}enemy=duel.fighters[0];return}const boss=wave%5===0;const type=boss?'ENFORCER':['GHOST','RAZOR','SENTINEL'][Math.floor(Math.random()*Math.min(3,1+Math.floor(wave/2)))];enemy={type,boss,hp:boss?6+Math.floor(wave/3):2+Math.floor(wave/4),max:0,dir:Math.random()<.5?0:1,phase:'windup',timer:1.5,period:Math.max(.65,1.6-wave*.035),hit:0};enemy.max=enemy.hp;enemy.timer=enemy.period+(type==='GHOST'?.3:0);district?.placeEnemy(enemy);district?.reinforce(wave)}
function burstParticles(x,y,color,n=22){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*260;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.45,color})}if(particles.length>220)particles.splice(0,particles.length-220)}
function finishDuel(){
  wave++;state='upgrade';guard=false;kills=0;const options=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);
  panel(`<div class="eyebrow">DUEL WON</div><h2>Prepare for round ${wave}</h2><p>${Math.min(5,1+Math.floor((wave-1)/2))} opponents next. Choose a circuit.</p>${options.map((u,i)=>`<button class="choice" data-choice="${i}"><strong>${u[0]}</strong><span>${u[1]}</span></button>`).join('')}`);
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{options[+b.dataset.choice][2]();spawn();resume()});
}
function duelSwing(dx,dy){
  // A cut goes to an open guard in reach first, even while another fighter winds up.
  const victim=district.strikeTarget(enemy);if(victim!==enemy){enemy=victim;district.selectFighter(victim)}
  district.lunge();cooldown=.32;const horizontal=Math.abs(dx)>=Math.abs(dy);trails.push({horizontal,life:.22,blade:gyro?swordSegment():mouseSword.active?mouseSword.blade(W,H):null});tone(160,.08);
  if(!district.canStrike())return;const powered=charge>=100;const result=duel.swing(enemy,horizontal?0:1,powered?3:Math.min(3,damage+1));
  if(result.kind==='hit'||result.kind==='kill'){if(powered)charge=0;charge=Math.min(100,charge+10);burstParticles(target().x,target().y,'#d6ffb4');tone(280,.12);say(result.kind==='kill'?'OPPONENT DOWN':'CLEAN STRIKE');if(result.kind==='kill'){chainKill(200);kills++;if(duel.finished)finishDuel();else{enemy=district.chooseFighter(null);say(`${duel.fighters.filter(f=>f.hp>0).length} OPPONENTS LEFT`)}}}
  else{burstParticles(target().x,target().y,'#ffe8a1',12);tone(820,.06,'square',.025);say(result.kind==='break'?'GUARD BROKEN · STRIKE':'BLADES CLASH · PARRY TO OPEN')}
}
// A guard that goes down within this window before impact is a parry. Upgrades widen it.
const parryWindow=()=>(gyro?PARRY_WINDOW.gyro:PARRY_WINDOW.touch)+windowBonus;
function updateDuel(dt){
  if(gyro&&!raw)return;enemy=district.chooseFighter(duel.active)||enemy;
  const active=duel.active;let blocked=false;
  if(active){const selected=enemy;district.selectFighter(active);enemy=active;blocked=gyro?bladeBlocks():guard;enemy=selected;district.selectFighter(selected)}
  // A touch guard counts from the press. A gyro guard counts from the frame the blade first covers the cut.
  if(blocked&&!duelWasBlocked)duelGuardAt=gyro?time:guardAt;duelWasBlocked=blocked;
  // Soft lock-on on touch screens. The phone's gyro and the mouse steer the view themselves.
  if(!gyro&&!desktop)district.assist(active,enemy,dt);
  duel.update(dt*(slow>0?.5:1),{canAttack:f=>district.canEngage(f),defense:f=>({inRange:district.fighterDistance(f)<3.5,dashing:district.evade>0||(district.dash>0&&district.rollTime<=0),blocked,perfect:blocked&&time-duelGuardAt<parryWindow()}),event:(kind,f)=>{
    if(kind==='damage'){health-=f.boss?18:12;flash=.22;combo=0;chainClock=0;tone(65,.15);say('HIT · MATCH THE NEXT BLADE');if(health<=0)gameOver()}
    if(kind==='parry'||kind==='block'){charge=Math.min(100,charge+(kind==='parry'?18:8));score+=kind==='parry'?40:10;tone(kind==='parry'?920:560,.09);burstParticles(target().x,target().y,'#ffe9ae',16);say(kind==='parry'?'PARRY · CUT NOW':f.phase==='open'?'GUARD BROKEN · STRIKE':'BLOCKED · GUARD WEAKENED')}
    if(kind==='evade'){charge=Math.min(100,charge+8);say(f.phase==='open'?'GUARD BROKEN · STRIKE':'DODGED · GUARD WEAKENED')}
    if(kind==='whiff')say('OUT OF REACH · STEP IN');
  }});
  if(gyro)guard=blocked;
  setText('objective',`ROUND ${wave} · ${duel.fighters.filter(f=>f.hp>0).length}/${duel.fighters.length} opponents`);
  const threat=duel.active||enemy;setText('hint',enemy.phase==='open'?'GUARD BROKEN · SWING NOW':threat.phase==='windup'?(threat.attack==='sweep'?'SWEEP · SPACE TO ROLL':threat.attack==='lunge'?'THRUST · SIDESTEP OR ROLL':threat.attack==='delayed'?'DELAYED CUT · WAIT FOR THE BLADE':threat.dir===0?'Hold your blade upright to meet the side cut.':'Lay your blade sideways to meet the overhead cut.'):'Clash blades. Parry the next strike to break their guard.');
  setText('health',Math.max(0,health));setText('score',score);setText('wave',String(wave).padStart(2,'0'));setText('burst',charge>=100?'OVERDRIVE READY':`OVERDRIVE ${Math.floor(charge)}%`);
}
function chainKill(points=70){combo++;chainClock=6;chainBest=Math.max(chainBest,combo);killFlash=.22;score+=Math.round(points*(1+Math.min(combo,12)*.2));charge=Math.min(100,charge+20);health=Math.min(100,health+3+leech);tone(440+Math.min(combo,10)*65,.09,'triangle',.055);if(combo%4===0){slow=Math.max(slow,1.5);say(`${combo} CHAIN · TIME RUSH`)}else say(`${combo} CHAIN`)}
function hit(amount,parry=false){enemy.hp-=amount;enemy.hit=.2;burstParticles(target().x,target().y,parry?'#caff54':'#5cf5ff');tone(parry?640:330);charge=Math.min(100,charge+(parry?16:7));if(enemy.hp<=0){if(district)chainKill(enemy.boss?500:100);else combo++;if(!district)score+=Math.round((enemy.boss?500:100)*(1+Math.min(combo,20)*.1));if(!district)health=Math.min(100,health+leech);kills++;if(kills>=3+Math.min(wave,5)){wave++;kills=0;state='upgrade';guard=false;const options=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);panel(`<div class="eyebrow">DISTRICT CLEARED</div><h2>Rewrite your blade.</h2><p>Choose a circuit for district ${wave}.</p>${options.map((u,i)=>`<button class="choice" data-choice="${i}"><strong>${u[0]}</strong><span>${u[1]}</span></button>`).join('')}`);document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{options[+b.dataset.choice][2]();spawn();resume()})}else{spawn();say(combo>1?`${combo} CHAIN`:'TARGET DOWN')}}}
function slash(dx,dy){
  if(state!=='play'||cooldown>0||(!gyro&&guard))return;
  if(mouseSword.active&&!gyro)mouseSword.attack(dx);
  if(duel&&district){duelSwing(dx,dy);return}
  if(district){district.lunge();const powered=charge>=100;const count=district.cutDrones(powered?7:cleaveRadius);cooldown=.16;trails.push({horizontal:Math.abs(dx)>=Math.abs(dy),life:.22,blade:gyro?swordSegment():mouseSword.active?mouseSword.blade(W,H):null});tone(180,.07);if(district.canStrike()){if(powered){charge=0;slow=3;say('OVERDRIVE')}hit(damage*(powered?3:1));}else if(powered&&count){charge=0;slow=3;say('OVERDRIVE')}return}
  cooldown=.24;const horizontal=Math.abs(dx)>=Math.abs(dy);trails.push({horizontal,life:.22,blade:gyro?swordSegment():mouseSword.active?mouseSword.blade(W,H):null});tone(150,.08);if(enemy.phase==='open'||(horizontal?0:1)===enemy.dir){const powered=gyro&&charge>=100;if(powered){charge=0;slow=4;say('TIME FRACTURE')}hit(powered?damage*3:damage);if(state==='play')say('CLEAN CUT')}else{say('MATCH THE LINE');tone(75)}
}
function overdrive(){if(duel&&district){if(state==='play'&&charge>=100&&cooldown<=0)duelSwing(1,0);return}if(state!=='play'||charge<100||(district&&!district.canStrike()))return;charge=0;slow=4;say('TIME FRACTURE');tone(880,.4);hit(damage*3,true)}
function setGuard(value){if(gyro)return;if(state!=='play'){guard=false;return}if(value&&!guard)guardAt=time;guard=value;$('guard').textContent=value?'GUARD ACTIVE':'HOLD TO GUARD'}
function pause(){document.exitPointerLock?.();mouseLook.reset();mouseSword.down=false;mouseSword.look=false;if(state!=='play')return;state='pause';guard=false;panel('<div class="eyebrow">SIGNAL HELD</div><h2>Paused</h2><button class="primary" id="resume">RESUME</button><button class="secondary" id="quit">END RUN</button>');$('resume').onclick=()=>{void lockViewport();resume()};$('quit').onclick=gameOver}
function gameOver(){document.exitPointerLock?.();unlockViewport();state='over';guard=false;best=Math.max(best,score);try{localStorage.setItem('neon-best',best)}catch{}panel(`<div class="eyebrow">CONNECTION LOST</div><h2>District ${wave}</h2><p>${score.toLocaleString()} points · Best ${best.toLocaleString()}</p>${district?`<p>Best chain: ${chainBest} · Survived ${Math.floor(runTime)} seconds</p>`:""}<button class="primary" id="retry">RUN IT BACK</button>`);$('retry').onclick=()=>{void lockViewport();start()}}
$('pause').onclick=pause;$('burst').onclick=overdrive;$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';audioStart()};$('center').onclick=()=>{resetSword();say('VIEW RESET · THIS GRIP IS NEUTRAL')};
$('guard').onpointerdown=e=>{e.preventDefault();$('guard').setPointerCapture(e.pointerId);setGuard(true)};for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('guard').addEventListener(ev,()=>setGuard(false));
let pointer=null;canvas.onpointerdown=e=>{if(e.pointerType==='mouse'||state!=='play'||gyro)return;canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,...viewportPoint(e)}};canvas.onpointermove=e=>{if(e.pointerType==='mouse')return;if(!pointer||pointer.id!==e.pointerId)return;const point=viewportPoint(e);aim.x=clamp((point.x/W-.5)*2,-1,1);aim.y=clamp((point.y/H-.5)*2,-1,1);const dx=point.x-pointer.x,dy=point.y-pointer.y;if(Math.hypot(dx,dy)>32){slash(dx,dy);pointer.x=point.x;pointer.y=point.y}};for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>pointer=null);
// Mouse input is handled across the world, including the touch-only look zone.
const mouseSurface=e=>e.target===canvas||!!e.target.closest?.('#lookPad');
function mouseMotion(e){
  if(gyro||state!=='play')return;
  document.body.classList.add('mouse-mode');
  if(!mouseSurface(e)&&!mouseSword.down&&!mouseSword.look)return;
  const locked=document.pointerLockElement===canvas;
  const p=locked?{x:clamp(mouseSword.tx*W+e.movementX,0,W),y:clamp(mouseSword.ty*H+e.movementY,0,H)}:viewportPoint(e);
  const delta=mouseSword.move(p.x,p.y,W,H);
  if(district&&!mouseSword.look)mouseLook.move(locked?e.movementX:delta.x,locked?e.movementY:delta.y);
  if(mouseSword.look&&district){district.yaw-=delta.x*.004;district.pitch=clamp(district.pitch-delta.y*.003,-.45,.45);return}
  if(mouseSword.down){const cut=mouseSword.drag(p.x,p.y);if(cut)slash(cut.x,cut.y)}
}
addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&document.pointerLockElement!==canvas)mouseMotion(e)});
addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)mouseMotion(e)});
addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||gyro||state!=='play'||!mouseSurface(e))return;
  e.preventDefault();document.body.classList.add('mouse-mode');
  const p=document.pointerLockElement===canvas?{x:mouseSword.tx*W,y:mouseSword.ty*H}:viewportPoint(e);mouseSword.move(p.x,p.y,W,H);if(document.pointerLockElement!==canvas)canvas.setPointerCapture(e.pointerId);
  if(e.button===0)mouseSword.press(p.x,p.y);
  if(e.button===2)setGuard(true);
  if(e.button===1)mouseSword.look=true;
});
addEventListener('pointerup',e=>{
  if(e.pointerType!=='mouse')return;
  if(e.button===0){const cut=mouseSword.release();if(cut)slash(cut.x,cut.y)}
  if(e.button===2)setGuard(false);
  if(e.button===1)mouseSword.look=false;
});
document.addEventListener('pointerlockchange',()=>{if(desktop&&!document.pointerLockElement&&state==='play')pause()});
const releaseMouse=()=>{mouseSword.down=false;mouseSword.stroke=null;mouseSword.look=false;if(!gyro)setGuard(false)};
canvas.addEventListener('lostpointercapture',releaseMouse);addEventListener('pointercancel',releaseMouse);addEventListener('blur',releaseMouse);
canvas.addEventListener('contextmenu',e=>{if(state==='play')e.preventDefault()});
addEventListener('keydown',e=>{if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space'&&state==='play'){if(district){guard=false;if(district.rollTime>0)say('ROLL')}else setGuard(true);}if(['ArrowLeft','ArrowRight'].includes(e.code))slash(1,0);if(['ArrowUp','ArrowDown'].includes(e.code))slash(0,1);if(e.code==='KeyE')overdrive();if(e.code==='Escape')pause()});addEventListener('keyup',e=>{if(e.code==='Space')setGuard(false)});addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
// Orientation is calibrated in the player's grip. Quaternion differences avoid
// compass wrap and keep rotations continuous across portrait/landscape grips.
function resetSword(){mouseSword.reset();mouseLook.reset();motionRoll=0;if(gyro)district?.beginMotionView();else district?.endMotionView();base=null;raw=null;gyroReady=false;sword.last=0;sword.speed=0;sword.previous=null;sword.pose={x:0,y:0,angle:-Math.PI/2};sword.direction=[0,1,0];sword.lastDirection=[0,1,0];sword.travel=0;sword.lastVelocity=null;guard=false;guardAt=-10}
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
  document.body.classList.toggle('gyro-mode',gyro);
  $('guard').hidden=gyro;$('burst').hidden=gyro;$('lookPad').hidden=gyro;
  $('motion').textContent=gyro?'Gyro on · switch to touch':'Enable gyro';
}
function disableGyro(message){gyro=false;resetSword();clearTimeout(motionTimer);motionUI();$('hint').textContent=message}
async function enableGyro(){
  try {
    if(!window.isSecureContext||!window.DeviceOrientationEvent)throw Error('unavailable');
    // Called directly by a tap, as required by iOS permission prompts.
    const orientationLock=lockViewport();
    const permission=typeof DeviceOrientationEvent.requestPermission==='function'?DeviceOrientationEvent.requestPermission():Promise.resolve('granted');
    if(await permission!=='granted')throw Error('denied');
    await orientationLock;
    gyro=true;resetSword();motionUI();$('hint').textContent=W>H?'Hold both ends. Turn the tablet to aim and swing.':'Hold your natural grip. Turn the phone to aim and swing.';
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
  const frame=motionFrame(base,q,viewport.startAngle);
  // +Y always points out of the physical top of the phone, even in landscape.
  // Twisting about this axis turns the edge but cannot create a blade swing.
  const direction=frame.direction;
  const dot=direction.reduce((sum,v,i)=>sum+v*sword.lastDirection[i],0);
  const sweptAngle=Math.acos(clamp(dot,-1,1))*180/Math.PI;
  const speed=sweptAngle/dt;
  if(speed>1800){resetSword();return} // Reject sensor discontinuities.
  district?.aimMotionView(frame.yaw,frame.pitch,dt,frame.roll);
  motionRoll+=Math.atan2(Math.sin(frame.roll-motionRoll),Math.cos(frame.roll-motionRoll))*(1-Math.exp(-dt/.035));
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
    if((contact||district)&&cooldown<=0){guard=false;slash(dx,dy);gyroReady=false;sword.travel=0}
  }
});
function update(dt){mouseSword.update(dt);time+=dt;notice-=dt;if(notice<=0)$('callout').textContent='';cooldown=Math.max(0,cooldown-dt);slow=Math.max(0,slow-dt);flash=Math.max(0,flash-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);trails.forEach(t=>t.life-=dt);trails=trails.filter(t=>t.life>0);if(state!=='play')return;if(district){runTime+=dt;chainClock=Math.max(0,chainClock-dt);killFlash=Math.max(0,killFlash-dt);if(chainClock===0)combo=0;setText('chain',duel?'PARRY → BREAK GUARD → STRIKE':combo?`${combo}× CHAIN · ${chainClock.toFixed(1)}s`:'CUT QUICKLY TO BUILD A CHAIN');setText('objective',`PATROL ${wave} · ${kills}/${3+Math.min(wave,5)} swordsmen · ${district.drones.length} drones`);}if(gyro){if(!raw)return;if(performance.now()-sword.last>500){disableGyro('Motion signal lost. Swipe to play.');pause();return}const blocked=bladeBlocks();if(blocked&&!guard)guardAt=time;guard=blocked;$('hint').textContent=guard?'BLADE SET · catch the strike':enemy.dir===0?'Hold the blade upright across the incoming cut.':'Turn the blade sideways across the incoming cut.';}if(duel&&district){updateDuel(dt);return}enemy.hit=Math.max(0,enemy.hit-dt);if(district&&!district.canStrike()){enemy.timer=Math.max(enemy.timer,.65);$('hint').textContent='Swing toward a target to close the gap. Push the stick to dash.';return}enemy.timer-=dt*(slow>0?.4:1);if(enemy.timer<=0){if(enemy.phase==='windup'){const perfect=guard&&time-guardAt<.28+windowBonus;if(perfect){enemy.phase='open';enemy.timer=1.2;score+=25;hit(1,true);say('PERFECT PARRY')}else{health-=(district?.dash>0)?0:guard?(gyro?0:5):(enemy.boss?24:16);combo=0;flash=.25;burstParticles(W/2,H*.65,'#ff4a92',12);tone(55,.2);enemy.phase='open';enemy.timer=guard?.65:.4;if(health<=0)gameOver();else {if(guard&&gyro){burstParticles(W*.5,H*.48,'#65efff',18);tone(480,.09)}say(guard?'BLADE BLOCK':'HIT')}}}else{enemy.phase='windup';enemy.timer=enemy.period;enemy.dir=Math.random()<.5?0:1}}if(time>beat){beat=time+.26;tone([55,55,82,65][Math.floor(time*2)%4],.12,'triangle',.025)}$('health').textContent=Math.max(0,health);$('wave').textContent=String(wave).padStart(2,'0');$('score').textContent=score;$('burst').textContent=charge>=100?'RELEASE OVERDRIVE':`OVERDRIVE ${Math.floor(charge)}%`}
function line(x1,y1,x2,y2,c,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
// Generated raster plates are composited with live combat, weather and the
// orientation-driven weapon. Keep procedural art as a loading/error fallback.
const art={};
for(const name of ['street','duelist','grip','alien-sky','ronin-toon']){
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
  const im=visualStyle==='rick-morty'&&ready(art['ronin-toon'])?art['ronin-toon']:art.duelist,baseHeight=Math.min(H*.60,W*.94),ratio=im.naturalWidth/im.naturalHeight;
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
  ctx.lineJoin='round';ctx.strokeStyle='#202534';ctx.lineWidth=3;
  const shape=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke()};
  // Asymmetric alien sabre with a broad steel face and a clipped point.
  shape([[-8,2],[-7,-length+36],[3,-length],[13,-length+23],[10,2]],'#9fc6cc');
  shape([[2,0],[3,-length],[13,-length+23],[10,2]],'#e0eee3');
  line(-5,-length*.17,-4,-length*.72,'#66868f',2);
  for(let i=0;i<3;i++)line(0,-length*.24-i*17,5,-length*.25-i*17,'#283b48',1.5);
  shape([[-26,0],[-21,-8],[20,-5],[29,4],[18,11],[-22,8]],'#b8bb83');
  shape([[-7,9],[9,9],[10,59],[-9,59]],'#48445c');
  for(let i=0;i<5;i++)line(-7,16+i*8,8,20+i*8,'#797086',3);
  shape([[-10,59],[12,59],[15,70],[-11,70]],'#99bd9d');
  // Articulated grip: cuff, palm, wrapped fingers and a thumb over the handle.
  shape([[11,49],[33,48],[58,95],[34,112],[16,78]],'#e9c6a0');
  shape([[34,88],[57,78],[72,124],[46,139]],'#475164');
  shape([[12,20],[25,22],[32,33],[31,51],[19,63],[4,56],[-10,48],[-10,30]],'#e7be97');
  for(let i=0;i<3;i++)shape([[-10,27+i*9],[7,24+i*9],[15,28+i*9],[14,35+i*9],[-7,37+i*9],[-12,33+i*9]],i===0?'#f0cca7':'#ddb08a');
  shape([[25,22],[31,31],[22,44],[11,43],[7,35],[12,30]],'#f0cca7');
  line(28,51,23,58,'#9b6d60',2);line(41,96,59,88,'#a0bba3',3);
  if(guard){ctx.shadowColor='#baff72';ctx.shadowBlur=10;line(-8,0,-7,-length+36,'#c9f59f',2);ctx.shadowBlur=0}
  ctx.restore();
}

function drawThreats(){
  const p=target(),distance=district.distanceToActor();
  const dx=district.actor.position.x-district.position.x,dz=district.actor.position.z-district.position.z;
  if((-Math.sin(district.yaw)*dx-Math.cos(district.yaw)*dz)>0&&distance<18&&p.x>0&&p.x<W&&p.y>0&&p.y<H&&district.actor.visible){
    const width=64,hp=clamp(enemy.hp/enemy.max,0,1);ctx.fillStyle='#172127';ctx.fillRect(p.x-width/2,p.y-62,width,6);ctx.fillStyle=enemy.phase==='open'?'#caff54':'#ff829d';ctx.fillRect(p.x-width/2,p.y-62,width*hp,6);if(duel){ctx.fillStyle='#172127';ctx.fillRect(p.x-width/2,p.y-51,width,5);ctx.fillStyle='#ffc975';ctx.fillRect(p.x-width/2,p.y-51,width*clamp(enemy.posture/4,0,1),5)}
    ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(enemy.phase==='open'?'CUT NOW':distance<3.5?'MATCH THEIR BLADE':'CLOSE IN',p.x,p.y-74);
    if(enemy.phase==='windup'&&distance<4){ctx.strokeStyle='#ff647f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,42,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-enemy.timer/enemy.period,0,1));ctx.stroke()}
  }
  if(killFlash>0){ctx.strokeStyle='#caff54';ctx.lineWidth=3;const x=W/2,y=H*.45;for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]])line(x+a*8,y+b*8,x+a*18,y+b*18,'#caff54',3)}
  if(district.dash>0){for(let i=0;i<8;i++){const a=i*Math.PI/4;line(W/2+Math.cos(a)*W*.42,H/2+Math.sin(a)*H*.42,W/2+Math.cos(a)*W*.49,H/2+Math.sin(a)*H*.49,'#d3ffffaa',2)}}
  // Every open guard in view says CUT NOW, not only the chosen fighter's.
  for(const c of district.crowd||[]){const f=c.fighter;if(f.hp<=0||f.phase!=='open'||f===enemy||!district.inView(f,0))continue;const q=district.target(c.mesh);ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#caff54';ctx.fillText('CUT NOW',q.x,q.y-74)}
  // Arrows at the screen edge point to fighters outside the view. A red, pulsing arrow is an attack.
  let left=0,right=0;
  for(const c of district.crowd||[]){const f=c.fighter;if(f.hp<=0||district.inView(f,0))continue;const side=district.bearing(c.mesh.position)>0?-1:1,row=side<0?left++:right++,warn=f.phase==='windup';
    ctx.save();ctx.translate(side<0?16:W-16,H*.42+row*36);ctx.scale(side*(warn?1.35:1),warn?1.35:1);ctx.globalAlpha=warn?.65+.35*Math.sin(time*20):.9;ctx.fillStyle=warn?'#ff3d63':f.phase==='open'?'#caff54':'#ffd288';ctx.strokeStyle='#172127';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-10,-12);ctx.lineTo(-5,0);ctx.lineTo(-10,12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
}

function draw(){ctx.save();if(!district&&gyro){ctx.translate(W/2,H/2);ctx.rotate(-motionRoll);const c=Math.abs(Math.cos(motionRoll)),s=Math.abs(Math.sin(motionRoll)),cover=Math.max(c+s*H/W,c+s*W/H);ctx.scale(cover,cover);ctx.translate(-W/2,-H/2)}if(district){ctx.clearRect(0,0,W,H)}else if(visualStyle==='rick-morty'){if(ready(art['alien-sky'])){const im=art['alien-sky'];ctx.drawImage(im,im.naturalWidth*.17,im.naturalHeight*.06,im.naturalWidth*.66,im.naturalHeight*.88,0,0,W,H)}else drawAlienBackdrop(ctx,W,H,time)}else if(ready(art.street)){drawStreet()}else{ctx.fillStyle='#070a18';ctx.fillRect(0,0,W,H);const horizon=H*.44;const glow=ctx.createRadialGradient(W*.5,horizon,5,W*.5,horizon,W*.7);glow.addColorStop(0,'#602060');glow.addColorStop(.5,'#161737');glow.addColorStop(1,'#070a18');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);for(let i=0;i<18;i++){const bw=W/12,x=i*W/15-bw*.5,bh=H*(.12+((i*37)%11)/50);ctx.fillStyle=i%2?'#101329':'#0a1024';ctx.fillRect(x,horizon-bh,bw,bh);line(x,horizon-bh,x+bw,horizon-bh,i%3?'#384468':'#e358b7',2);for(let j=0;j<7;j++)if((i+j)%3)line(x+9,horizon-bh+15+j*16,x+14,horizon-bh+15+j*16,'#476e8a',2)}for(let i=-8;i<=8;i++)line(W/2+i*22,horizon,W/2+i*180,H,'#253557');for(let i=0;i<14;i++){let z=((i/14+time*.06)%1)**2,y=horizon+z*(H-horizon);line(0,y,W,y,'#283252')}for(let i=0;i<35;i++){const x=(i*113+time*22)%W,y=(i*61+time*260)%H;line(x,y,x-3,y+13,'#46718b44')}
}
if(!district&&enemy&&ready(art.duelist)){drawDuelist()}else if(!district&&enemy){const x=W/2,y=H*.45,s=Math.min(W*.25,H*.19),bob=Math.sin(time*3)*4;ctx.save();ctx.translate(x+Math.sin(enemy.hit*80)*enemy.hit*30,y+bob);ctx.shadowBlur=enemy.hit>0?28:12;ctx.shadowColor=enemy.boss?'#ff579e':'#42dce8';ctx.strokeStyle=enemy.phase==='open'?'#caff54':'#74c9e0';ctx.lineWidth=2;ctx.fillStyle=enemy.hit>0?'#b2ebf8':'#182039';ctx.beginPath();ctx.moveTo(-s*.42,-s*.55);ctx.lineTo(0,-s*.75);ctx.lineTo(s*.42,-s*.55);ctx.lineTo(s*.26,-s*.12);ctx.lineTo(-s*.26,-s*.12);ctx.closePath();ctx.fill();ctx.stroke();line(-s*.25,-s*.4,s*.25,-s*.4,'#ff64c9',5);ctx.beginPath();ctx.moveTo(-s*.28,-s*.05);ctx.lineTo(-s*.62,s*.28);ctx.lineTo(-s*.4,s*.7);ctx.lineTo(s*.4,s*.7);ctx.lineTo(s*.62,s*.28);ctx.lineTo(s*.28,-s*.05);ctx.closePath();ctx.fill();ctx.stroke();line(-s*.25,s*.7,-s*.35,s*1.2,'#54829f',13);line(s*.25,s*.7,s*.35,s*1.2,'#54829f',13);const c=enemy.phase==='open'?'#caff54':'#ff6bcc';if(enemy.dir===0)line(-s*.85,s*.15,s*.85,s*.15,c,5);else line(0,-s*.7,0,s*.85,c,5);ctx.shadowBlur=0;ctx.fillStyle='#d1ddeb';ctx.textAlign='center';ctx.font='10px monospace';ctx.fillText(enemy.type,0,-s-22);ctx.fillStyle='#303047';ctx.fillRect(-s*.6,-s-12,s*1.2,4);ctx.fillStyle=c;ctx.fillRect(-s*.6,-s-12,s*1.2*Math.max(0,enemy.hp/enemy.max),4);if(enemy.phase==='windup'){const ratio=clamp(enemy.timer/enemy.period,0,1);ctx.strokeStyle=ratio<.25?'#ff4b78':'#67efff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,s*.2,s*1.02,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);ctx.stroke();ctx.fillStyle='#e8edfa';ctx.fillText(ratio<.25?'GUARD NOW':'INCOMING',0,s*1.5)}else{ctx.fillStyle='#caff54';ctx.fillText('EXPOSED · CUT',0,s*1.5)}ctx.restore()}
ctx.restore();for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);line(p.x,p.y,p.x-p.vx*.035,p.y-p.vy*.035,p.color,2)}ctx.globalAlpha=1;for(const t of trails){ctx.globalAlpha=t.life/.22;ctx.shadowBlur=20;ctx.shadowColor='#70faff';if(t.blade)line(t.blade.ax,t.blade.ay,t.blade.bx,t.blade.by,'#d8ffff',7);else if(t.horizontal)line(W*.13,H*.44,W*.87,H*.48,'#d8ffff',7);else line(W*.48,H*.23,W*.53,H*.7,'#d8ffff',7)}ctx.globalAlpha=1;ctx.shadowBlur=0;if(state==='play'){
  if(district)drawThreats();
  const blade=gyro?swordSegment():mouseSword.active?mouseSword.blade(W,H,guard,enemy?.dir===1):{ax:W*.65+aim.x*W*.12,ay:H*.75+aim.y*H*.08,bx:W*.52+aim.x*W*.12,by:H*.47+aim.y*H*.08};
  drawSteel(blade);
  if(gyro&&enemy.phase==='windup'&&(!district||district.canStrike())){
    const {x,y}=target(),l=Math.min(W,H)*.13;
    ctx.setLineDash([5,7]);
    if(enemy.dir===0)line(x,y-l,x,y+l,guard?'#caff54':'#ffffff66',3);
    else line(x-l,y,x+l,y,guard?'#caff54':'#ffffff66',3);
    ctx.setLineDash([]);
  }
}if(flash>0){ctx.fillStyle=`rgba(255,30,90,${flash*.8})`;ctx.fillRect(0,0,W,H)}if(slow>0){ctx.strokeStyle='#caff54';ctx.lineWidth=4;ctx.strokeRect(2,2,W-4,H-4)}}
if(district){district.onDroneKill=()=>{chainKill();burstParticles(W*.5,H*.45,'#f2b7ff',14)};district.onDroneAttack=()=>{if(state!=='play'||(gyro&&!raw))return;if(guard){charge=Math.min(100,charge+12);say('DRONE DEFLECTED');tone(660,.08);return}health-=Math.max(3,10-droneArmor);combo=0;chainClock=0;flash=.18;tone(65,.1);say('DRONE HIT · DASH OUT');if(health<=0)gameOver()};}
if(district)district.onPickup=()=>{health=Math.min(100,health+8);charge=Math.min(100,charge+12);say('SPIRIT LIGHT · +8 HEALTH')};
function setText(id,value){const el=$(id),text=String(value);if(el.textContent!==text)el.textContent=text}
function frame(now){const dt=Math.min(.1,(now-last)/1000||.016);last=now;if(district&&state==='play'&&!gyro){const look=mouseLook.update(dt,district.pitch);district.yaw+=look.yaw;district.pitch=look.pitch;}if(district)district.enemyTimeScale=slow>0?.4:1;district?.update(dt,state==='play'&&(!gyro||!!raw),enemy);if(district&&state==='play'){setText('districtStatus',district.canStrike()?'SENTINEL IN REACH':`${district.collected} spirit lights · ${visualStyle==='rick-morty'?'Explore the Portal Badlands':'Run through the lanes'}`);setText('health',Math.max(0,health));setText('wave',String(wave).padStart(2,'0'));setText('score',score);}update(dt);draw();requestAnimationFrame(frame)}menu();requestAnimationFrame(frame);




