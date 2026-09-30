// Full Tilt: a pinball voyage. Gameplay stays in world coordinates in either orientation.
import { createAdventure, updateAdventure, launchAdventure, pulseAdventure, chooseUpgrade, skipAdventureFlight, availableUpgrades, objective, currentSector, setAdventureTilt, canDeployGravityWell, deployGravityWell, FIELD_CAPACITY } from './adventure.js';
import { createTiltControl } from './motion.js';
import { setFlip, H } from './physics.js';
import { createRenderer } from './render.js';
import { startLoop } from '../kit/loop.js';
import { Sfx, tone, hiss } from '../kit/sfx.js';
import { sampleTransit } from './transit.js';
import { createTransitAudio } from './transit-audio.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), renderer = createRenderer(canvas, $('mini-map'));
const transitAudio = createTransitAudio(Sfx);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let run = createAdventure(), mode = 'title', oldPhase = '', hudClock = 0, messageUntil = 0;
let chargeStart = null, chargeOwner = null, charge = 0, mapReturn = 'play', musicClock = 0;
let fieldAim = null, fieldPointer = null, fieldKind = 'pull';
const fingers = new Map(), keys = new Set(), activations = new Set();
const motion = createTiltControl({ onChange: paintMotion });
const FLIPS = { z: -1, arrowleft: -1, '/': 1, arrowright: 1, shiftleft: -1, shiftright: 1 };
const keyName = e => e.code === 'ShiftLeft' ? 'shiftleft' : e.code === 'ShiftRight' ? 'shiftright' : e.key.toLowerCase();
let best = 0;
try { best = Number(localStorage.getItem('tilt.voyage.best')) || 0; } catch { /* private browsing */ }

function sound(kind, strength = 1) {
  Sfx.play((e,t) => {
    if (kind === 'flip') { tone(e,t,{f:145,f2:70,dur:.065,peak:.12}); return; }
    if (kind === 'drain') { tone(e,t,{f:180,f2:55,dur:.5,peak:.15,wave:'triangle'}); return; }
    if (kind === 'field-deploy') { tone(e,t,{f:110,f2:330,dur:.65,peak:.12,wave:'sine',send:.5}); hiss(e,t,{type:'bandpass',f:350,f2:1300,dur:.45,peak:.065}); return; }
    if (kind === 'pulse' || kind === 'launch') { hiss(e,t,{type:'bandpass',f:250,f2:1800,dur:.3,peak:.1}); tone(e,t,{f:140,f2:520,dur:.22,peak:.1}); return; }
    const notes = kind === 'relay' || kind === 'upgrade' || kind === 'gate' || kind === 'orbit' ? [440,660,880] : [300 + strength * 90];
    notes.forEach((f,i) => tone(e,t+i*.07,{f,dur:.21,peak:.075,wave:'sine',send:.25}));
  });
}
function announce(text) { if (!text) return; $('message').textContent = text; $('message').classList.add('visible'); messageUntil = performance.now() + 2400; }
function paintMotion(state) {
  const active = state === 'on' || state === 'calibrating';
  const labels = { requesting: 'Allow tilt…', calibrating: 'Tilt on', on: 'Tilt on' };
  const descriptions = {
    off: 'Optional: hold your phone comfortably, then enable a gentle gravity nudge.',
    requesting: 'Allow motion access to use gentle tilt.',
    calibrating: 'Hold comfortably. Your next sensor reading sets the center.',
    on: 'Tilt gently to influence the ball. Planets still guide your flight.',
    denied: 'Motion access was not allowed. You can keep playing with the touch controls.',
    unavailable: 'Motion readings are unavailable here. Touch controls are ready to use.',
  };
  for (const id of ['motion-button', 'pause-motion-button']) {
    const button = $(id);
    button.textContent = labels[state] || 'Enable tilt';
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(active));
    button.disabled = state === 'requesting';
  }
  for (const id of ['motion-status', 'pause-motion-status']) $(id).textContent = descriptions[state] || descriptions.off;
  $('recenter-motion-button').hidden = !active;
  if (!active) setAdventureTilt(run);
}
async function toggleMotion() {
  if (motion.state === 'on' || motion.state === 'calibrating') motion.disable();
  else await motion.enable(); // Called directly by the tap, as motion permission requires.
  setAdventureTilt(run);
}
function suspendMotion() { motion.suspend(); setAdventureTilt(run); }
function resumeMotion() { if (run.phase === 'flight') motion.suspend(); else motion.resume(); setAdventureTilt(run); }
function releaseControls() {
  fingers.clear(); keys.clear(); activations.clear(); chargeStart = null; chargeOwner = null; charge = 0; fieldPointer = null;
  setFlip(run.world,-1,false); setFlip(run.world,1,false);
  $('left-flip').classList.remove('held'); $('right-flip').classList.remove('held');
  $('launch-button').style.setProperty('--charge',0);
}
function updateFlips() {
  for (const side of [-1,1]) {
    const held = activations.has(side) || [...fingers.values()].some(v=>v===side) || [...keys].some(k=>FLIPS[k]===side);
    const was = run.world.flippers.some(f=>f.side===side && f.held);
    const allowed = held && mode === 'play' && ['ready','play'].includes(run.phase);
    setFlip(run.world,side,allowed);
    if (allowed && !was) sound('flip');
    $(side === -1 ? 'left-flip' : 'right-flip').classList.toggle('held',allowed);
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
function boundedAim(point) {
  const screen = renderer.toScreen(point.x, point.y);
  const x = Math.max(22, Math.min(innerWidth - 22, screen.x));
  const y = Math.max(Math.min(130, innerHeight * .27), Math.min(innerHeight - Math.min(160, innerHeight * .3), screen.y));
  return renderer.toWorld(x, y);
}
function moveFieldAim(point) {
  if (mode !== 'field') return;
  fieldAim = { ...boundedAim(point), kind: fieldKind };
  fieldAim.valid = canDeployGravityWell(run, fieldAim.x, fieldAim.y, fieldKind);
  $('deploy-field').disabled = !fieldAim.valid;
  $('field-pull').setAttribute('aria-pressed', String(fieldKind === 'pull'));
  $('field-push').setAttribute('aria-pressed', String(fieldKind === 'push'));
  const help = fieldAim.valid ? 'Time paused. Tap space to place, or drag and release.' : 'Choose open space near the active planet.';
  if ($('field-aim-help').textContent !== help) $('field-aim-help').textContent = help;
}
function beginField() {
  if (mode === 'field') { cancelField(); return; }
  if (mode !== 'play' || run.phase !== 'play' || run.fieldCharges < 1 || run.gravityWell) return;
  releaseControls(); suspendMotion(); mode = 'field';
  $('field-placement').hidden = false; document.body.classList.add('aiming-field');
  const b = run.world.ball;
  const candidates = [{ x: b.x + b.vx * .2, y: b.y + b.vy * .2 }];
  for (const radius of [150, 280, 430]) for (let i = 0; i < 8; i++) candidates.push({ x: b.x + Math.cos(i * Math.PI / 4) * radius, y: b.y + Math.sin(i * Math.PI / 4) * radius });
  const target = candidates.map(boundedAim).find(p => canDeployGravityWell(run, p.x, p.y, fieldKind)) || boundedAim(b);
  moveFieldAim(target); syncHud(); canvas.focus({preventScroll:true});
}
function cancelField() {
  if (mode !== 'field') return;
  fieldAim = null; fieldPointer = null; mode = 'play';
  $('field-placement').hidden = true; document.body.classList.remove('aiming-field');
  releaseControls(); resumeMotion(); syncHud();
}
function placeField() {
  if (mode !== 'field' || !fieldAim) return;
  if (!deployGravityWell(run, fieldAim.x, fieldAim.y, fieldKind)) {
    moveFieldAim(fieldAim); return;
  }
  cancelField(); canvas.focus({preventScroll:true});
}
function newRun() {
  cancelField();
  transitAudio.stop();
  Sfx.init(); releaseControls(); run=createAdventure((Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0); mode='play'; oldPhase='';
  $('pause-button').textContent='Pause';
  for(const id of ['menu','pause-panel','upgrade-panel','end-panel','map-panel']) $(id).hidden=true;
  $('hud').hidden=false; document.body.classList.add('playing');
  resumeMotion(); motion.recenter();
  renderer.resize(); syncHud();
  announce('Release Launch to fly. Use Pulse to aim through gravity.');
  canvas.focus({preventScroll:true});
}
function pause() {
  cancelField();
  if(mode!=='play' || ['upgrade','won','over'].includes(run.phase))return;
  releaseControls(); suspendMotion(); transitAudio.stop(); mode='pause'; $('pause-panel').hidden=false; $('pause-button').textContent='Resume'; syncHud(); $('resume-button').focus();
}
function resume() {
  $('pause-panel').hidden=true; mode='play'; resumeMotion(); $('pause-button').textContent='Pause'; syncHud(); canvas.focus({preventScroll:true});
}
function showMap() {
  cancelField();
  if(mode==='title' || ['upgrade','flight','won','over'].includes(run.phase))return;
  releaseControls(); suspendMotion(); mapReturn=mode; mode='map'; $('map-panel').hidden=false;
  $('route-list').replaceChildren(...run.sectors.map((s,i)=>{
    const li=document.createElement('li'); li.className=i===run.sectorIndex?'current':s.cleared?'complete':'';
    const name=document.createElement('strong'); name.textContent=`${String(i+1).padStart(2,'0')}  ${s.name}`;
    const state=document.createElement('span'); state.textContent=s.cleared?'Complete':i===run.sectorIndex?'You are here':'Unexplored';
    li.append(name,state);return li;
  }));
  $('close-map').focus();
}
function closeMap() { $('map-panel').hidden=true; mode=mapReturn; if(mode==='play')resumeMotion(); canvas.focus({preventScroll:true}); }
function showUpgrades() {
  releaseControls(); suspendMotion(); $('upgrade-panel').hidden=false;
  $('upgrade-detail').textContent=`${currentSector(run).name} complete. Choose what you carry into the next sector.`;
  $('upgrade-options').replaceChildren(...availableUpgrades(run).map(item=>{
    const button=document.createElement('button');button.type='button';
    const name=document.createElement('strong');name.textContent=item.name;
    const desc=document.createElement('span');desc.textContent=item.description;
    button.append(name,desc);
    button.addEventListener('click',()=>{
      if(chooseUpgrade(run,item.id,{reducedMotion})!==false){ $('upgrade-panel').hidden=true; releaseControls(); suspendMotion(); $('message').classList.remove('visible'); messageUntil=0; sound('upgrade'); canvas.focus({preventScroll:true}); syncHud(); }
    });return button;
  }));
  $('upgrade-options').querySelector('button')?.focus();
}
function showEnd() {
  releaseControls(); suspendMotion(); best=Math.max(best,run.score);
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
  $('pulse-button').disabled=mode!=='play' || run.phase!=='play' || run.pulseCooldown>0;
  $('pulse-button').textContent=run.pulseCooldown>0?`Pulse ${run.pulseCooldown.toFixed(1)}s`:'Pulse ◎';
  $('map-button').disabled=['upgrade','flight','won','over'].includes(run.phase);
  $('field-button').textContent = mode === 'field' ? 'Cancel' : `Field ${run.fieldCharges}`;
  $('field-button').disabled = mode !== 'field' && (mode !== 'play' || run.phase !== 'play' || run.fieldCharges < 1 || !!run.gravityWell);
  $('field-button').setAttribute('aria-pressed', String(mode === 'field'));
  $('field-button').setAttribute('aria-label', mode === 'field' ? 'Cancel gravity field' : `Gravity field, ${run.fieldCharges} of ${FIELD_CAPACITY} charges`);
  const well = run.gravityWell;
  $('field-status').textContent = well ? `${well.kind === 'push' ? 'Push' : 'Pull'} field · ${well.remaining.toFixed(1)}s` : 'Relays and orbits earn field charges';
  $('field-status').dataset.active = String(!!well);
  const inTransit = run.phase === 'flight';
  document.body.classList.toggle('in-transit', inTransit);
  $('controls').hidden = inTransit;
  $('transit-panel').hidden = !inTransit || mode !== 'play';
  for (const id of ['left-flip','right-flip']) $(id).disabled = mode !== 'play' || !['ready','play'].includes(run.phase);
  if (run.phase!==oldPhase) {
    oldPhase=run.phase;
    if(run.phase==='upgrade')showUpgrades();
    else if(run.phase==='won'||run.phase==='over')showEnd();
    else if(run.phase==='ready' && mode==='play')announce('Ready to launch');
  }
}

const TRANSIT_LABELS = { departure: 'Leaving orbit', galaxy: 'Crossing the galaxy', horizon: 'Entering the event horizon', tunnel: 'Through the singularity', arrival: 'Arriving in a new world' };
function paintTransit() {
  if (!run.flight || run.phase !== 'flight') return;
  const flight = run.flight, phase = sampleTransit(flight.progress, reducedMotion).phase;
  const destination = run.sectors[flight.toSector];
  const stage = TRANSIT_LABELS[phase] || 'Crossing the galaxy';
  if ($('transit-stage').textContent !== stage) $('transit-stage').textContent = stage;
  if ($('transit-title').textContent !== destination.name) $('transit-title').textContent = destination.name;
  const route = `${run.sectors[flight.fromSector].name}  /  ${String(flight.toSector + 1).padStart(2, '0')}`;
  if ($('transit-route').textContent !== route) $('transit-route').textContent = route;
  $('transit-panel').dataset.phase = phase;
  $('transit-progress').setAttribute('aria-valuenow', String(Math.round(flight.progress * 100)));
  $('transit-progress').firstElementChild.style.transform = `scaleX(${flight.progress})`;
}

$('skip-transit').addEventListener('click',()=>{
  if(mode !== 'play' || !skipAdventureFlight(run))return;
  transitAudio.stop(); releaseControls(); resumeMotion(); syncHud(); canvas.focus({preventScroll:true});
});

$('play-button').addEventListener('click',newRun);
$('field-button').addEventListener('click',beginField);
$('cancel-field').addEventListener('click',cancelField);
$('deploy-field').addEventListener('click',placeField);
for (const kind of ['pull', 'push']) $('field-' + kind).addEventListener('click',()=>{fieldKind = kind; if(fieldAim)moveFieldAim(fieldAim);});
$('motion-button').addEventListener('click',toggleMotion);
$('pause-motion-button').addEventListener('click',toggleMotion);
$('recenter-motion-button').addEventListener('click',()=>{
  motion.recenter(); setAdventureTilt(run);
  $('pause-motion-status').textContent='Hold comfortably when you resume. Tilt will center on that position.';
});
paintMotion(motion.state);
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
document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').textContent=document.fullscreenElement?'Exit full screen':'Full screen';cancelField();releaseControls();});
function holdFlip(e,side,el) {
  if(mode!=='play'||!['ready','play'].includes(run.phase))return;
  e.preventDefault();Sfx.init();fingers.set(e.pointerId,side);el.setPointerCapture(e.pointerId);updateFlips();
}
for(const side of [-1,1]){
  const el=$(side===-1?'left-flip':'right-flip');el.addEventListener('pointerdown',e=>holdFlip(e,side,el));
  // Native keyboard activation gives a short stroke; key holds on Z and / remain independent.
  el.addEventListener('click',e=>{if(e.detail===0 && mode==='play' && ['ready','play'].includes(run.phase)){activations.add(side);updateFlips();setTimeout(()=>{activations.delete(side);updateFlips();},120);}});
}
canvas.tabIndex=0;
canvas.addEventListener('pointerdown',e=>{
  if (mode === 'field') {
    e.preventDefault(); if(fieldPointer !== null)return;
    fieldPointer = e.pointerId; canvas.setPointerCapture(e.pointerId);
    moveFieldAim(renderer.toWorld(e.clientX, e.clientY)); return;
  }
  holdFlip(e,e.clientX<innerWidth/2?-1:1,canvas);
});
canvas.addEventListener('pointermove',e=>{
  if(mode === 'field' && e.pointerId === fieldPointer) { e.preventDefault(); moveFieldAim(renderer.toWorld(e.clientX,e.clientY)); }
});
$('launch-button').addEventListener('pointerdown',e=>{if(!startCharge(e.pointerId))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);fingers.set(e.pointerId,'launch');});
$('launch-button').addEventListener('click',e=>{if(e.detail===0 && run.phase==='ready'){if(startCharge('activation'))endCharge(false,'activation');}});
$('pulse-button').addEventListener('click',()=>pulse());
function pointerEnd(e,cancel=false){
  if(e.pointerId === fieldPointer) {
    fieldPointer = null;
    if(cancel)cancelField(); else if(mode === 'field') { moveFieldAim(renderer.toWorld(e.clientX,e.clientY)); placeField(); }
    return;
  }
  const action=fingers.get(e.pointerId);fingers.delete(e.pointerId);
  if(action==='launch')endCharge(cancel,e.pointerId);else updateFlips();
}
window.addEventListener('pointerup',e=>pointerEnd(e));
window.addEventListener('pointercancel',e=>pointerEnd(e,true));
window.addEventListener('keydown',e=>{
  const key=keyName(e);
  if(key==='escape'){if(e.repeat)return;if(mode==='field')cancelField();else if(mode==='map')closeMap();else if(mode==='pause')resume();else pause();return;}
  if(mode === 'field') {
    if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) {
      e.preventDefault(); moveFieldAim({ x: fieldAim.x + (key === 'arrowright' ? 45 : key === 'arrowleft' ? -45 : 0), y: fieldAim.y + (key === 'arrowup' ? 45 : key === 'arrowdown' ? -45 : 0) });
    } else if(key === 'enter' && !e.target.closest('button,a')) { e.preventDefault(); if(!e.repeat)placeField(); }
    else if(key === 'f' && !e.repeat)cancelField();
    return;
  }
  if(mode!=='play'||['upgrade','flight','over','won'].includes(run.phase))return;
  if([' ','enter'].includes(key)&&e.target.closest('button,a'))return;
  if(key in FLIPS){e.preventDefault();keys.add(key);updateFlips();}
  else if(key===' '){e.preventDefault();if(!e.repeat)startCharge('space');}
  else if(key==='arrowup'||key==='x'){e.preventDefault();if(!e.repeat)pulse();}
  else if(key==='a'){if(!e.repeat)pulse(-1);}
  else if(key==='d'){if(!e.repeat)pulse(1);}
  else if(key==='m'&&!e.repeat)showMap();
  else if(key==='f'&&!e.repeat){e.preventDefault();beginField();}
});
window.addEventListener('keyup',e=>{const key=keyName(e);keys.delete(key);updateFlips();if(key===' ')endCharge(false,'space');});
window.addEventListener('blur',()=>{cancelField();releaseControls();if(mode==='play')pause();});
window.addEventListener('resize',()=>{cancelField();releaseControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelField();releaseControls();if(mode==='play')pause();}});

startLoop({h:H,step:()=>{
  if(mode!=='play')return;
  const tilt = ['ready','play'].includes(run.phase) ? motion.sample(H) : { x: 0, y: 0 };
  setAdventureTilt(run, tilt.x, tilt.y);
  updateAdventure(run,H);
  for(const event of run.events){
    renderer.onEvent?.(event,run);
    const kind=event.k||event.type;
    if(['relay','bumper','gate','drain','save','pulse','orbit','field-deploy','field-charge'].includes(kind))sound(kind);
    const messages={relay:event.complete===false?'Core charged once. Strike it again.':'Relay lit',gate:'Jump gate open. Shoot for the bright ring.',orbit:'Gravity slingshot! Bonus points.',save:'Launch shield saved your comet.',drain:'A heart lost. Your relays stay lit.',recall:'Comet recovered. Ready at the dock.',rescue:'A small boost keeps your comet moving.',arrive:currentSector(run).descriptor || 'New sector. Your progress is safe here.'};
    if(event.message || messages[kind])announce(event.message || messages[kind]);
    if(kind === 'field-charge')announce(`Gravity charge gained · ${event.charges}/${FIELD_CAPACITY}`);
    if(kind === 'field-deploy')announce(`${event.kind === 'push' ? 'Push' : 'Pull'} field deployed · 5 seconds`);
    if(kind === 'arrive') { releaseControls(); resumeMotion(); syncHud(); }
  }
  if(['upgrade','won','over'].includes(run.phase)&&oldPhase!==run.phase)syncHud();
  if(run.phase==='play' && (musicClock-=H)<=0){
    musicClock=2.6;
    Sfx.play((e,t)=>tone(e,t,{f:[110,164.81,146.83,130.81][Math.floor(run.clock/10)%4],dur:2.5,peak:.018,wave:'sine',send:.6}));
  }
},draw:(_,dt)=>{
  if(chargeStart!=null){charge=Math.min(1,(performance.now()-chargeStart)/1200);$('launch-button').style.setProperty('--charge',charge);}
  const frozen = mode === 'field' || mode === 'pause';
  renderer.draw(run,frozen ? 0 : dt,{overview:mode==='map',reducedMotion,charge,fieldAim,freezeCamera:frozen});
  transitAudio.update(run.flight, mode === 'play' && run.phase === 'flight', reducedMotion);
  paintTransit();
  if((hudClock-=dt)<=0){hudClock=.1;if(mode!=='title')syncHud();}
  if(performance.now()>messageUntil)$('message').classList.remove('visible');
}});
