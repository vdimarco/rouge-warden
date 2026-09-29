// Full Tilt: a pinball voyage. Gameplay stays in world coordinates in either orientation.
import { createAdventure, updateAdventure, launchAdventure, pulseAdventure, chooseUpgrade, availableUpgrades, objective, currentSector } from './adventure.js';
import { setFlip, H } from './physics.js';
import { createRenderer } from './render.js';
import { startLoop } from '../kit/loop.js';
import { Sfx, tone, hiss } from '../kit/sfx.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), renderer = createRenderer(canvas, $('mini-map'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let run = createAdventure(), mode = 'title', oldPhase = '', hudClock = 0, messageUntil = 0;
let chargeStart = null, chargeOwner = null, charge = 0, mapReturn = 'play', musicClock = 0;
const fingers = new Map(), keys = new Set(), activations = new Set();
const FLIPS = { z: -1, arrowleft: -1, '/': 1, arrowright: 1, shiftleft: -1, shiftright: 1 };
const keyName = e => e.code === 'ShiftLeft' ? 'shiftleft' : e.code === 'ShiftRight' ? 'shiftright' : e.key.toLowerCase();
let best = 0;
try { best = Number(localStorage.getItem('tilt.voyage.best')) || 0; } catch { /* private browsing */ }

function sound(kind, strength = 1) {
  Sfx.play((e,t) => {
    if (kind === 'flip') { tone(e,t,{f:145,f2:70,dur:.065,peak:.12}); return; }
    if (kind === 'drain') { tone(e,t,{f:180,f2:55,dur:.5,peak:.15,wave:'triangle'}); return; }
    if (kind === 'pulse' || kind === 'launch') { hiss(e,t,{type:'bandpass',f:250,f2:1800,dur:.3,peak:.1}); tone(e,t,{f:140,f2:520,dur:.22,peak:.1}); return; }
    const notes = kind === 'relay' || kind === 'upgrade' || kind === 'gate' ? [440,660,880] : [300 + strength * 90];
    notes.forEach((f,i) => tone(e,t+i*.07,{f,dur:.21,peak:.075,wave:'sine',send:.25}));
  });
}
function announce(text) { if (!text) return; $('message').textContent = text; $('message').classList.add('visible'); messageUntil = performance.now() + 2400; }
function releaseControls() {
  fingers.clear(); keys.clear(); activations.clear(); chargeStart = null; chargeOwner = null; charge = 0;
  setFlip(run.world,-1,false); setFlip(run.world,1,false);
  $('left-flip').classList.remove('held'); $('right-flip').classList.remove('held');
  $('launch-button').style.setProperty('--charge',0);
}
function updateFlips() {
  for (const side of [-1,1]) {
    const held = activations.has(side) || [...fingers.values()].some(v=>v===side) || [...keys].some(k=>FLIPS[k]===side);
    const was = run.world.flippers.some(f=>f.side===side && f.held);
    setFlip(run.world,side,held && mode === 'play');
    if (held && !was) sound('flip');
    $(side === -1 ? 'left-flip' : 'right-flip').classList.toggle('held',held);
  }
}
function startCharge(owner) { if(mode !== 'play' || run.phase !== 'ready' || chargeStart != null) return false; chargeOwner=owner; chargeStart=performance.now(); return true; }
function endCharge(cancel=false,owner=chargeOwner) {
  if(chargeStart == null || owner !== chargeOwner) return;
  const power=Math.min(1,.55+(performance.now()-chargeStart)/1800);
  chargeStart=null; chargeOwner=null; charge=0;
  $('launch-button').style.setProperty('--charge',0);
  if(!cancel && mode==='play') launchAdventure(run,power);
  syncHud();
}
function pulse(dx=0) {
  if(mode !== 'play' || run.phase !== 'play') return;
  if(pulseAdventure(run,dx)) announce('Gravity pulse');
  syncHud();
}
function newRun() {
  Sfx.init(); releaseControls(); run=createAdventure((Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0); mode='play'; oldPhase='';
  $('pause-button').textContent='Pause';
  for(const id of ['menu','pause-panel','upgrade-panel','end-panel','map-panel']) $(id).hidden=true;
  $('hud').hidden=false; document.body.classList.add('playing');
  renderer.resize(); syncHud();
  announce('Hold Launch, then release. Hit the three bright relays.');
  canvas.focus({preventScroll:true});
}
function pause() {
  if(mode!=='play' || ['upgrade','won','over'].includes(run.phase))return;
  releaseControls(); mode='pause'; $('pause-panel').hidden=false; $('pause-button').textContent='Resume'; $('resume-button').focus();
}
function resume() {
  $('pause-panel').hidden=true; mode='play'; $('pause-button').textContent='Pause'; canvas.focus({preventScroll:true});
}
function showMap() {
  if(mode==='title')return;
  releaseControls(); mapReturn=mode; mode='map'; $('map-panel').hidden=false;
  $('route-list').replaceChildren(...run.sectors.map((s,i)=>{
    const li=document.createElement('li'); li.className=i===run.sectorIndex?'current':s.cleared?'complete':'';
    const name=document.createElement('strong'); name.textContent=`${String(i+1).padStart(2,'0')}  ${s.name}`;
    const state=document.createElement('span'); state.textContent=s.cleared?'Complete':i===run.sectorIndex?'You are here':'Unexplored';
    li.append(name,state);return li;
  }));
  $('close-map').focus();
}
function closeMap() { $('map-panel').hidden=true; mode=mapReturn; canvas.focus({preventScroll:true}); }
function showUpgrades() {
  releaseControls(); $('upgrade-panel').hidden=false;
  $('upgrade-detail').textContent=`${currentSector(run).name} complete. Choose what you carry into the next sector.`;
  $('upgrade-options').replaceChildren(...availableUpgrades(run).map(item=>{
    const button=document.createElement('button');button.type='button';
    const name=document.createElement('strong');name.textContent=item.name;
    const desc=document.createElement('span');desc.textContent=item.description;
    button.append(name,desc);
    button.addEventListener('click',()=>{
      if(chooseUpgrade(run,item.id)!==false){ $('upgrade-panel').hidden=true; sound('upgrade'); canvas.focus({preventScroll:true}); syncHud(); }
    });return button;
  }));
  $('upgrade-options').querySelector('button')?.focus();
}
function showEnd() {
  releaseControls(); best=Math.max(best,run.score);
  try{localStorage.setItem('tilt.voyage.best',String(best));}catch{/* private browsing */}
  $('end-title').textContent=run.phase==='won'?'The stars are yours.':'A voyage to remember.';
  $('end-detail').textContent=`${run.score.toLocaleString()} points · ${run.sectors.filter(s=>s.cleared).length} of ${run.sectors.length} sectors · Best ${best.toLocaleString()}`;
  $('end-panel').hidden=false; $('again-button').focus();
}
function syncHud() {
  const sector=currentSector(run);
  $('sector-name').textContent=`${String(run.sectorIndex+1).padStart(2,'0')} / ${run.sectors.length} · ${sector.name}`;
  $('objective').textContent=objective(run);
  $('score').textContent=run.score.toLocaleString();
  $('lives').textContent=`${run.lives} ${run.lives===1?'heart':'hearts'}`;
  $('launch-button').hidden=run.phase!=='ready';
  $('pulse-button').hidden=run.phase==='ready';
  $('pulse-button').disabled=run.phase!=='play' || run.pulseCooldown>0;
  $('pulse-button').textContent=run.pulseCooldown>0?`Pulse ${run.pulseCooldown.toFixed(1)}s`:'Pulse ↑';
  $('map-button').disabled=['upgrade','flight','won','over'].includes(run.phase);
  if (run.phase!==oldPhase) {
    oldPhase=run.phase;
    if(run.phase==='upgrade')showUpgrades();
    else if(run.phase==='won'||run.phase==='over')showEnd();
    else if(run.phase==='ready' && mode==='play')announce('Ready to launch');
  }
}

$('play-button').addEventListener('click',newRun);
$('again-button').addEventListener('click',newRun);
$('restart-button').addEventListener('click',newRun);
$('pause-button').addEventListener('click',()=>mode==='pause'?resume():pause());
$('resume-button').addEventListener('click',resume);
$('map-button').addEventListener('click',showMap);
$('close-map').addEventListener('click',closeMap);
$('sound-button').addEventListener('click',()=>{ Sfx.init();Sfx.toggle();paintSound(); });
function paintSound(){ $('sound-button').textContent=Sfx.isOn()?'Sound on':'Sound off';$('sound-button').setAttribute('aria-pressed',String(Sfx.isOn())); }
paintSound();
$('fullscreen-button').addEventListener('click',async()=>{
  try{ if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen(); }
  catch{announce('Use the full screen option in your browser.');}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').textContent=document.fullscreenElement?'Exit full screen':'Full screen';releaseControls();});
function holdFlip(e,side,el) {
  if(mode!=='play'||!['ready','play'].includes(run.phase))return;
  e.preventDefault();Sfx.init();fingers.set(e.pointerId,side);el.setPointerCapture(e.pointerId);updateFlips();
}
for(const side of [-1,1]){
  const el=$(side===-1?'left-flip':'right-flip');el.addEventListener('pointerdown',e=>holdFlip(e,side,el));
  // Native keyboard activation gives a short stroke; key holds on Z and / remain independent.
  el.addEventListener('click',e=>{if(e.detail===0 && mode==='play'){activations.add(side);updateFlips();setTimeout(()=>{activations.delete(side);updateFlips();},120);}});
}
canvas.tabIndex=0;
canvas.addEventListener('pointerdown',e=>holdFlip(e,e.clientX<innerWidth/2?-1:1,canvas));
$('launch-button').addEventListener('pointerdown',e=>{if(!startCharge(e.pointerId))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);fingers.set(e.pointerId,'launch');});
$('launch-button').addEventListener('click',e=>{if(e.detail===0 && run.phase==='ready'){if(startCharge('activation'))endCharge(false,'activation');}});
$('pulse-button').addEventListener('click',()=>pulse());
function pointerEnd(e,cancel=false){
  const action=fingers.get(e.pointerId);fingers.delete(e.pointerId);
  if(action==='launch')endCharge(cancel,e.pointerId);else updateFlips();
}
window.addEventListener('pointerup',e=>pointerEnd(e));
window.addEventListener('pointercancel',e=>pointerEnd(e,true));
window.addEventListener('keydown',e=>{
  const key=keyName(e);
  if(key==='escape'){if(e.repeat)return;if(mode==='map')closeMap();else if(mode==='pause')resume();else pause();return;}
  if(mode!=='play'||['upgrade','over','won'].includes(run.phase))return;
  if([' ','enter'].includes(key)&&e.target.closest('button,a'))return;
  if(key in FLIPS){e.preventDefault();keys.add(key);updateFlips();}
  else if(key===' '){e.preventDefault();if(!e.repeat)startCharge('space');}
  else if(key==='arrowup'||key==='x'){e.preventDefault();if(!e.repeat)pulse();}
  else if(key==='a'){if(!e.repeat)pulse(-1);}
  else if(key==='d'){if(!e.repeat)pulse(1);}
  else if(key==='m'&&!e.repeat)showMap();
});
window.addEventListener('keyup',e=>{const key=keyName(e);keys.delete(key);updateFlips();if(key===' ')endCharge(false,'space');});
window.addEventListener('blur',()=>{releaseControls();if(mode==='play')pause();});
window.addEventListener('resize',()=>releaseControls());
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseControls();if(mode==='play')pause();}});

startLoop({h:H,step:()=>{
  if(mode!=='play')return;
  updateAdventure(run,H);
  for(const event of run.events){
    renderer.onEvent?.(event,run);
    const kind=event.k||event.type;
    if(['relay','bumper','gate','drain','save','pulse'].includes(kind))sound(kind);
    const messages={relay:event.complete===false?'Core charged once. Strike it again.':'Relay lit',gate:'Jump gate open. Shoot for the bright ring.',save:'Launch shield saved your comet.',drain:'A heart lost. Your relays stay lit.',recall:'Comet recovered. Ready at the dock.',arrive:currentSector(run).descriptor || 'New sector. Your progress is safe here.'};
    if(event.message || messages[kind])announce(event.message || messages[kind]);
  }
  if(['upgrade','won','over'].includes(run.phase)&&oldPhase!==run.phase)syncHud();
  if(run.phase==='play' && (musicClock-=H)<=0){
    musicClock=2.6;
    Sfx.play((e,t)=>tone(e,t,{f:[110,164.81,146.83,130.81][Math.floor(run.clock/10)%4],dur:2.5,peak:.018,wave:'sine',send:.6}));
  }
},draw:(_,dt)=>{
  if(chargeStart!=null){charge=Math.min(1,(performance.now()-chargeStart)/1200);$('launch-button').style.setProperty('--charge',charge);}
  renderer.draw(run,dt,{overview:mode==='map',reducedMotion,charge});
  if((hudClock-=dt)<=0){hudClock=.1;if(mode!=='title')syncHud();}
  if(performance.now()>messageUntil)$('message').classList.remove('visible');
}});
