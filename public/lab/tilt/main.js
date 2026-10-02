// Full Tilt: a pinball voyage. Gameplay stays in world coordinates in either orientation.
import { createAdventure, updateAdventure, launchAdventure, pulseAdventure, chooseUpgrade, skipAdventureFlight, availableUpgrades, objective, currentSector, setAdventureTilt, canDeployGravityWell, deployGravityWell, FIELD_CAPACITY, setWarpAim, clearWarpAim } from './adventure.js';
import { createTiltControl } from './motion.js';
import { setFlip, canReverseScoop, H } from './physics.js';
import { createRenderer } from './render.js';
import { startLoop } from '../kit/loop.js';
import { Sfx, tone, hiss } from '../kit/sfx.js';
import { sampleTransit } from './transit.js';
import { createTransitAudio } from './transit-audio.js';
import { createSpaceMusic } from './space-music.js';
import { upgradeEmblem } from './upgrade-emblems.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), renderer = createRenderer(canvas, $('mini-map'));
const transitAudio = createTransitAudio(Sfx);
const spaceMusic = createSpaceMusic(Sfx);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let run = createAdventure(), mode = 'title', oldPhase = '', hudClock = 0, messageUntil = 0;
let chargeStart = null, chargeOwner = null, charge = 0, mapReturn = 'play', scoreClock = 0;
let fieldAim = null, fieldPointer = null, fieldKind = 'pull';
let warpPointer = null;
const warpKeys = new Set();
const fingers = new Map(), keys = new Set(), activations = new Set();
const motion = createTiltControl({ onChange: paintMotion });
const FLIPS = { z: -1, x: 1 };
const keyName = e => e.key.toLowerCase();
let best = 0;
try { best = Number(localStorage.getItem('tilt.voyage.best')) || 0; } catch { /* private browsing */ }

function sound(kind, strength = 1) {
  Sfx.play((e,t) => {
    if (kind === 'flip') { tone(e,t,{f:145,f2:70,dur:.065,peak:.12}); return; }
    if (kind === 'reverse') { tone(e,t,{f:95,f2:620,dur:.28,peak:.12,wave:'sine',send:.35}); hiss(e,t,{type:'bandpass',f:400,f2:1500,dur:.2,peak:.05}); return; }
    if (kind === 'warp-ring') { tone(e,t,{f:520,f2:1040,dur:.22,peak:.13,wave:'sine',send:.45}); tone(e,t+.07,{f:1560,dur:.22,peak:.05,send:.4}); return; }
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
  const pointer = warpPointer?.id;
  warpPointer = null; warpKeys.clear(); clearWarpAim(run);
  if (pointer != null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
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
  const help = fieldAim.valid ? (matchMedia('(pointer: coarse)').matches ? 'Time paused. Tap space to place, or drag and release.' : 'Time paused. WASD aim · Q Pull/Push · E place · F cancel') : 'Choose open space near the active planet.';
  if ($('field-aim-help').textContent !== help) $('field-aim-help').textContent = help;
}
function beginField() {
  if (mode === 'field') { cancelField(); return; }
  if (mode !== 'play' || run.phase !== 'play' || run.fieldCharges < 1 || run.gravityWell) return;
  releaseControls(); suspendMotion(); spaceMusic.stop(); mode = 'field';
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
  spaceMusic.stop();
  Sfx.init(); releaseControls(); run=createAdventure((Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0); mode='play'; oldPhase=''; scoreClock=0;
  document.body.classList.remove('showing-map');
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
  releaseControls(); suspendMotion(); transitAudio.stop(); spaceMusic.stop(); mode='pause'; $('pause-panel').hidden=false; $('pause-button').textContent='Resume'; syncHud(); $('resume-button').focus();
}
function resume() {
  $('pause-panel').hidden=true; mode='play'; resumeMotion(); $('pause-button').textContent='Pause'; syncHud(); canvas.focus({preventScroll:true});
}
function showMap() {
  cancelField();
  if(mode==='title' || ['upgrade','flight','won','over'].includes(run.phase))return;
  releaseControls(); suspendMotion(); spaceMusic.stop(); mapReturn=mode; mode='map'; $('map-panel').hidden=false;
  document.body.classList.add('showing-map');
  $('map-progress').textContent=`${run.sectors.filter(s=>s.cleared).length} of ${run.sectors.length} worlds explored`;
  $('route-list').replaceChildren(...run.sectors.map((s,i)=>{
    const li=document.createElement('li'); li.className=i===run.sectorIndex?'current':s.cleared?'complete':'';
    li.style.setProperty('--route-color',s.color);
    const name=document.createElement('strong'); name.textContent=`${String(i+1).padStart(2,'0')}  ${s.name}`;
    const state=document.createElement('span'); state.textContent=s.cleared?'Complete':i===run.sectorIndex?'You are here':'Unexplored';
    li.append(name,state);return li;
  }));
  $('close-map').focus();
}
function closeMap() { $('map-panel').hidden=true; document.body.classList.remove('showing-map'); mode=mapReturn; if(mode==='play')resumeMotion(); canvas.focus({preventScroll:true}); }
function showUpgrades() {
  releaseControls(); suspendMotion(); $('upgrade-panel').hidden=false;
  $('upgrade-from').textContent=currentSector(run).name;
  $('upgrade-to').textContent=run.sectors[run.sectorIndex + 1]?.name || 'Voyage complete';
  $('upgrade-options').replaceChildren(...availableUpgrades(run).map((item,index)=>{
    const button=document.createElement('button');button.type='button';button.className='upgrade-module';button.dataset.module=item.id;
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    const emblem=document.createElement('span');emblem.className='upgrade-emblem';emblem.innerHTML=upgradeEmblem(item.id);
    const copy=document.createElement('span');copy.className='upgrade-copy';
    const name=document.createElement('strong');name.className='upgrade-name';name.id=`upgrade-name-${item.id}`;name.textContent=item.name;
    const shortcut=document.createElement('kbd');shortcut.className='upgrade-key';shortcut.setAttribute('aria-hidden','true');shortcut.textContent=String(index + 1);
    const desc=document.createElement('span');desc.className='upgrade-description';desc.id=`upgrade-description-${item.id}`;desc.textContent=item.description;
    const action=document.createElement('span');action.className='upgrade-action';action.setAttribute('aria-hidden','true');action.innerHTML='Install &amp; jump <svg viewBox="0 0 20 20" focusable="false"><path d="M4 16 16 4M5 4h11v11"/></svg>';
    button.setAttribute('aria-labelledby',name.id);button.setAttribute('aria-describedby',desc.id);
    copy.append(shortcut,name,desc,action);button.append(emblem,copy);
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
  for (const [side,id] of [[-1,'left-flip'],[1,'right-flip']]) {
    const button = $(id), scoop = mode === 'play' && run.phase === 'play' && canReverseScoop(run.world,side);
    button.disabled = mode !== 'play' || !['ready','play'].includes(run.phase);
    button.classList.toggle('scoop-ready', scoop);
    button.querySelector('.flip-label').textContent = scoop ? 'REVERSE FLIP' : side < 0 ? 'LEFT FLIPPER' : 'RIGHT FLIPPER';
    button.querySelector('.flipper-arrow').textContent = scoop ? '⤴' : side < 0 ? '↗' : '↖';
  }
  if (run.phase!==oldPhase) {
    oldPhase=run.phase;
    if(run.phase==='upgrade')showUpgrades();
    else if(run.phase==='won'||run.phase==='over')showEnd();
    else if(run.phase==='ready' && mode==='play')announce('Ready to launch');
  }
}

const TRANSIT_LABELS = { departure: 'Leaving orbit', galaxy: 'Crossing the galaxy', horizon: 'Entering the event horizon', tunnel: 'Through the singularity', arrival: 'Arriving in a new world' };
function canSteerWarp() { return mode === 'play' && run.phase === 'flight' && run.flight?.surf?.enabled; }
function advanceWarpInput() {
  if (!canSteerWarp() || !warpKeys.size) return;
  const surf = run.flight.surf;
  const x = Number(warpKeys.has('d')) - Number(warpKeys.has('a'));
  const y = Number(warpKeys.has('s')) - Number(warpKeys.has('w'));
  const length = Math.max(1, Math.hypot(x,y));
  setWarpAim(run, surf.target.x + x / length * H * 1.9, surf.target.y + y / length * H * 1.9);
}
function paintTransit() {
  if (!run.flight || run.phase !== 'flight') return;
  const flight = run.flight, phase = sampleTransit(flight.progress, reducedMotion).phase;
  const destination = run.sectors[flight.toSector];
  const surf = flight.surf;
  $('warp-readout').hidden = !surf?.enabled;
  $('transit-panel').classList.toggle('has-surf', !!surf?.enabled);
  if (surf?.enabled) {
    const passed = surf.rings.filter(r=>r.status !== 'pending').length;
    const count = `${surf.hits} / ${surf.rings.length} rings`;
    if ($('warp-count').textContent !== count) $('warp-count').textContent = count;
    $('warp-count').dataset.hits = String(surf.hits);
    $('warp-readout').dataset.complete = String(surf.hits >= 2);
    const help = surf.hits >= 2 ? (run.fieldCharges < FIELD_CAPACITY ? 'Gravity charge earned' : 'Bonus points earned · fields full') : passed === surf.rings.length ? 'Next world ahead' : matchMedia('(pointer: coarse)').matches ? 'Drag to steer · 2 rings earn a field' : 'Drag or WASD to steer · 2 rings earn a field';
    if ($('warp-help').textContent !== help) $('warp-help').textContent = help;
  }
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
const SOUND_PREFERENCE = 'tilt.voyage.sound';
function setGameSound(enabled) {
  if (Sfx.isOn() === enabled) return;
  // The shared engine persists its global switch. Keep this game's choice local.
  let sharedPreference;
  try { sharedPreference = localStorage.getItem('arcade.sound'); } catch { /* private browsing */ }
  Sfx.toggle();
  if (sharedPreference !== undefined) {
    try {
      if (sharedPreference === null) localStorage.removeItem('arcade.sound');
      else localStorage.setItem('arcade.sound', sharedPreference);
    } catch { /* private browsing */ }
  }
}
function paintSound() {
  const enabled = Sfx.isOn();
  for (const id of ['sound-button', 'menu-sound-button']) {
    $(id).textContent = enabled ? 'Sound on' : 'Sound off';
    $(id).setAttribute('aria-pressed', String(enabled));
  }
  $('music-status').textContent = enabled ? 'Space music starts with your voyage.' : 'Sound is off for this game.';
}
function toggleSound() {
  setGameSound(!Sfx.isOn());
  Sfx.init();
  try { localStorage.setItem(SOUND_PREFERENCE, JSON.stringify(Sfx.isOn())); } catch { /* private browsing */ }
  paintSound();
}
let soundEnabled = true;
try { soundEnabled = JSON.parse(localStorage.getItem(SOUND_PREFERENCE) ?? 'true') !== false; } catch { /* default to sound on */ }
setGameSound(soundEnabled);
for (const id of ['sound-button', 'menu-sound-button']) $(id).addEventListener('click', toggleSound);
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
  // Native keyboard activation gives a short stroke; key holds on Z and X remain independent.
  el.addEventListener('click',e=>{if(e.detail===0 && mode==='play' && ['ready','play'].includes(run.phase)){activations.add(side);updateFlips();setTimeout(()=>{activations.delete(side);updateFlips();},120);}});
}
canvas.tabIndex=0;
canvas.addEventListener('pointerdown',e=>{
  if (canSteerWarp()) {
    if (warpPointer !== null) return;
    e.preventDefault(); Sfx.init(); warpKeys.clear(); clearWarpAim(run);
    warpPointer = { id:e.pointerId, x:e.clientX, y:e.clientY, aimX:run.flight.surf.pilot.x, aimY:run.flight.surf.pilot.y };
    canvas.setPointerCapture(e.pointerId); return;
  }
  if (mode === 'field') {
    e.preventDefault(); if(fieldPointer !== null)return;
    fieldPointer = e.pointerId; canvas.setPointerCapture(e.pointerId);
    moveFieldAim(renderer.toWorld(e.clientX, e.clientY)); return;
  }
  holdFlip(e,e.clientX<innerWidth/2?-1:1,canvas);
});
canvas.addEventListener('pointermove',e=>{
  if (canSteerWarp() && e.pointerId === warpPointer?.id) {
    e.preventDefault();
    const scale = 2.1 / Math.max(200, Math.min(innerWidth,innerHeight));
    setWarpAim(run, warpPointer.aimX + (e.clientX-warpPointer.x)*scale, warpPointer.aimY + (e.clientY-warpPointer.y)*scale); return;
  }
  if(mode === 'field' && e.pointerId === fieldPointer) { e.preventDefault(); moveFieldAim(renderer.toWorld(e.clientX,e.clientY)); }
});
$('launch-button').addEventListener('pointerdown',e=>{if(!startCharge(e.pointerId))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);fingers.set(e.pointerId,'launch');});
$('launch-button').addEventListener('click',e=>{if(e.detail===0 && run.phase==='ready'){if(startCharge('activation'))endCharge(false,'activation');}});
$('pulse-button').addEventListener('click',()=>pulse());
function pointerEnd(e,cancel=false){
  if(e.pointerId === warpPointer?.id) {
    warpPointer=null; clearWarpAim(run);
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    return;
  }
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
canvas.addEventListener('lostpointercapture',e=>{
  if(e.pointerId === warpPointer?.id){warpPointer=null;clearWarpAim(run);}
});
window.addEventListener('keydown',e=>{
  if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=keyName(e);
  if(key==='escape'){if(e.repeat)return;if(mode==='field')cancelField();else if(mode==='map')closeMap();else if(mode==='pause')resume();else pause();return;}
  if(mode==='map' && key==='r'){e.preventDefault();if(!e.repeat)closeMap();return;}
  if(mode==='play' && run.phase==='upgrade' && key==='tab'){
    const options=[...$('upgrade-options').querySelectorAll('button')];
    const index=options.indexOf(document.activeElement);
    const next=index < 0 ? (e.shiftKey ? options.length - 1 : 0) : (index + (e.shiftKey ? options.length - 1 : 1)) % options.length;
    e.preventDefault();options[next]?.focus();return;
  }
  if(mode === 'field') {
    if(['w','a','s','d'].includes(key)) {
      e.preventDefault(); moveFieldAim({ x: fieldAim.x + (key === 'd' ? 45 : key === 'a' ? -45 : 0), y: fieldAim.y + (key === 'w' ? 45 : key === 's' ? -45 : 0) });
    } else if(key === 'q') { e.preventDefault(); if(!e.repeat){fieldKind=fieldKind==='pull'?'push':'pull';moveFieldAim(fieldAim);} }
    else if(key === 'e') { e.preventDefault(); if(!e.repeat)placeField(); }
    else if(key === 'f') { e.preventDefault(); if(!e.repeat)cancelField(); }
    return;
  }
  if(mode==='play' && run.phase==='upgrade' && /^[1-3]$/.test(key)){
    e.preventDefault();if(!e.repeat)$('upgrade-options').children[Number(key)-1]?.click();return;
  }
  if(mode==='play' && run.phase==='flight' && key==='e'){
    e.preventDefault();if(!e.repeat)$('skip-transit').click();return;
  }
  if(canSteerWarp() && ['w','a','s','d'].includes(key)){
    if(e.target.closest('button,a') || warpPointer !== null || (e.repeat && !warpKeys.has(key)))return;
    e.preventDefault(); warpKeys.add(key); return;
  }
  if(mode!=='play'||['upgrade','flight','over','won'].includes(run.phase))return;
  if([' ','enter'].includes(key)&&e.target.closest('button,a'))return;
  if(key in FLIPS){e.preventDefault();if(e.repeat&&!keys.has(key))return;keys.add(key);updateFlips();}
  else if(key===' '){e.preventDefault();if(!e.repeat)startCharge('space');}
  else if(key==='c'){e.preventDefault();if(!e.repeat)pulse();}
  else if(key==='a'){e.preventDefault();if(!e.repeat)pulse(-1);}
  else if(key==='d'){e.preventDefault();if(!e.repeat)pulse(1);}
  else if(key==='r'){e.preventDefault();if(!e.repeat)showMap();}
  else if(key==='f'&&!e.repeat){e.preventDefault();beginField();}
});
window.addEventListener('keyup',e=>{const key=keyName(e);if(warpKeys.delete(key)&&!warpKeys.size)clearWarpAim(run);keys.delete(key);updateFlips();if(key===' ')endCharge(false,'space');});
window.addEventListener('blur',()=>{cancelField();releaseControls();if(mode==='play')pause();});
window.addEventListener('resize',()=>{cancelField();releaseControls();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelField();releaseControls();if(mode==='play')pause();}});

startLoop({h:H,step:()=>{
  if(mode!=='play')return;
  advanceWarpInput();
  const tilt = ['ready','play'].includes(run.phase) ? motion.sample(H) : { x: 0, y: 0 };
  setAdventureTilt(run, tilt.x, tilt.y);
  updateAdventure(run,H);
  const warpBonus = run.events.find(event => event.type === 'warp-bonus');
  for(const event of run.events){
    renderer.onEvent?.(event,run);
    const kind=event.k||event.type;
    if(['relay','bumper','gate','drain','save','pulse','orbit','field-deploy','field-charge','reverse'].includes(kind))sound(kind);
    const messages={relay:event.complete===false?'Core charged once. Strike it again.':'Relay lit',gate:'Jump gate open. Shoot for the bright ring.',orbit:'Gravity slingshot! Bonus points.',save:'Launch shield saved your comet.',drain:'A heart lost. Your relays stay lit.',recall:'Comet recovered. Ready at the dock.',rescue:'A small boost keeps your comet moving.',arrive:currentSector(run).descriptor || 'New sector. Your progress is safe here.'};
    if(event.message || messages[kind])announce(event.message || messages[kind]);
    if(kind === 'reverse')announce('Reverse flip');
    if(kind === 'warp-ring' && event.hit)sound('warp-ring');
    if(kind === 'field-charge')announce(`Gravity charge gained · ${event.charges}/${FIELD_CAPACITY}`);
    if(kind === 'field-deploy')announce(`${event.kind === 'push' ? 'Push' : 'Pull'} field deployed · 5 seconds`);
    if(kind === 'arrive') { releaseControls(); resumeMotion(); syncHud(); }
  }
  if(warpBonus)announce(warpBonus.amount ? `Warp reward · +${warpBonus.amount} gravity charge` : 'Warp complete · field charges full');
  if(['upgrade','won','over'].includes(run.phase)&&oldPhase!==run.phase)syncHud();
},draw:(_,dt)=>{
  if(chargeStart!=null){charge=Math.min(1,(performance.now()-chargeStart)/1200);$('launch-button').style.setProperty('--charge',charge);}
  const frozen = mode === 'field' || mode === 'pause';
  renderer.draw(run,frozen ? 0 : dt,{overview:mode==='map',reducedMotion,charge,fieldAim,freezeCamera:frozen});
  transitAudio.update(run.flight, mode === 'play' && run.phase === 'flight', reducedMotion);
  const musicActive = mode === 'play' && ['ready','play','upgrade'].includes(run.phase);
  if(musicActive)scoreClock+=Math.min(dt,.1);
  spaceMusic.update({ active: musicActive, clock: scoreClock, sector: run.sectorIndex, phase: run.phase, reducedMotion });
  paintTransit();
  if((hudClock-=dt)<=0){hudClock=.1;if(mode!=='title')syncHud();}
  if(performance.now()>messageUntil)$('message').classList.remove('visible');
}});
