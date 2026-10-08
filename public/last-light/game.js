import { mount } from './vendor/mount.js';
import * as sunset from './vendor/ocean-sunset.js';
import * as coast from './vendor/night-coast.js';
import * as fjord from './vendor/aurora-fjord.js';
import { createVoyage, start, pause, resume, dash, update, readBest, saveBest, CROSSINGS, CROSSING_SECONDS, projectWater, HORIZONS } from './engine.js';
const $ = id => document.getElementById(id);
const scenes = [sunset, coast, fjord];
const canvas = $('play'), ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let state = createVoyage(), best = 0, sceneIndex = -1, stopScene = () => {}, scenePlaying = false;
try { best = readBest(localStorage); } catch {}
const keys = new Set(), pointers = new Map();
let last = 0, saved = false;
// Use the scene's 200 × 100 dot grid for every moving object.
const boat = ['    •    ', '    ●•   ', '    ●●•  ', '   •●●●• ', ' •●●●●●• ', '  •●●●•  '];
const rock = ['   ••   ', '  •●●•  ', ' •●●●●• ', '••●●●●••'];
function sprite(lines, x, y, size, color) {
  const cell = canvas.clientWidth / 200;
  const gx = Math.round(x / cell), gy = Math.round(y / cell);
  const scale = size || 1;
  const width = Math.max(1, Math.round(lines[0].length * scale));
  const height = Math.max(1, Math.round(lines.length * scale));
  ctx.font = (cell / .6) + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const glyph = lines[Math.min(lines.length-1, Math.floor(row / height * lines.length))][Math.min(lines[0].length-1, Math.floor(col / width * lines[0].length))];
      if (!glyph || glyph === ' ') continue;
      const px = (gx + col - Math.floor(width / 2) + .5) * cell;
      const py = (gy + row - Math.floor(height / 2) + .5) * cell;
      ctx.fillStyle = scenes[state.crossing].meta.ground;
      ctx.fillRect(px - cell / 2, py - cell / 2, cell, cell);
      ctx.fillStyle = color; ctx.fillText(glyph, px, py);
    }
  }
}
function waterContact(x, y, scale, ink, light = false) {
  const cell = canvas.clientWidth / 200;
  ctx.globalAlpha = .38;
  sprite(['· • · · • ·'], x, y + 2 * cell * scale, scale, ink);
  if (light) {
    ctx.globalAlpha = .24;
    sprite([' ·•· ', '  ·  ', ' · · '], x, y + 5 * cell * scale, scale, ink);
  }
  ctx.globalAlpha = 1;
}
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width*dpr); canvas.height = Math.round(r.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); render();
}
function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  ctx.clearRect(0,0,w,h);
  const boatScale = .4 + (state.y - HORIZONS[state.crossing]) / (1.04 - HORIZONS[state.crossing]) * 1.5;
  const entities = state.status === 'ready'
    ? [{type:'light',lane:.18,depth:.08},{type:'light',lane:.5,depth:.32},{type:'light',lane:.73,depth:.63},{type:'rock',lane:.3,depth:.48},{type:'rock',lane:.8,depth:.85}].map(e=>({...e,...projectWater(e.lane,e.depth,state.crossing)}))
    : [...state.entities].sort((a,b)=>a.y-b.y);
  for (const e of entities) {
    const scale = e.scale || 1;
    const ink = e.type === 'light' ? '#ffcd62' : ['#90327c','#526a92','#568b85'][state.crossing];
    waterContact(e.x*w,e.y*h,scale,ink,e.type==='light');
    ctx.globalAlpha = Math.min(1,.25 + (e.depth ?? 1)*1.5);
    if (e.type === 'light') sprite(['  ·  ', ' ·•· ', '·•●•·', ' ·•· ', '  ·  '],e.x*w,e.y*h,scale,ink);
    else sprite(rock,e.x*w,e.y*h,scale,ink);
    ctx.globalAlpha=1;
  }
  const boatInk = state.dash > 0 ? '#fff5d8' : state.safe > 0 ? '#ea6a78' : ['#ffe39a','#bdd5eb','#b6e5ce'][state.crossing];
  // Dark glyph shadow preserves contrast over the sun's reflection.
  ctx.shadowBlur=0;
  waterContact(state.x*w,state.y*h,boatScale,boatInk);
  sprite(boat,state.x*w,state.y*h,boatScale,boatInk);
  ctx.shadowBlur=0;
  if (!reduced.matches && (state.status === 'playing' || state.status === 'ready')) {
    sprite(['· · • · ·'],state.x*w,(state.y+.045)*h,boatScale,'#874266');
  }
  for (const e of state.effects) {
    ctx.globalAlpha=1-e.age/.9;
    sprite([e.text],e.x*w,(e.y-.04-e.age*.025)*h,1,'#fff5d8');
  }
  ctx.globalAlpha=1;
}
function syncScene() {
  const playing = state.status === 'playing';
  if (sceneIndex === state.crossing && scenePlaying === playing) return;
  stopScene(); sceneIndex=state.crossing; scenePlaying=playing;
  // Explicit set-sail input allows essential game movement. Decorative motion
  // respects reduced motion; fps:0 gives a stable paused/menu scene.
  stopScene=mount($('scene'),scenes[sceneIndex],{fps:playing && !reduced.matches?12:0});
  $('scene').setAttribute('aria-label', ['An ASCII ocean sunset','An ASCII moonlit lighthouse coast','An ASCII aurora over a fjord'][sceneIndex]);
}
function ui() {
  $('crossing').textContent=CROSSINGS[state.crossing];
  $('lights').textContent=state.lights;
  $('hull').textContent=state.hull+'/3';
  $('best').textContent='best '+best;
  const playing=state.status==='playing', paused=state.status==='paused', done=['won','lost'].includes(state.status);
  $('title').textContent=done?(state.status==='won'?'Home, before dawn.':'Lost to the tide.'):paused?'Voyage paused':playing?'Carry the light.':'Last Light';
  const message=done
    ? state.score+' points · '+state.lights+' lights carried'+(state.status==='won'?' · '+state.hull+' hull brought home':'')
    : paused?'The sea can wait.':playing?(state.cooldown>0?'dash ready in '+state.cooldown.toFixed(1)+'s':'Dash through rocks. Gather the golden sparks.'):'Carry the last sparks home.';
  if($('message').textContent!==message) $('message').textContent=message;
  $('primary').textContent=done?'[ sail again ]':paused?'[ resume ]':playing?'[ pause ]':'[ set sail ]';
  $('retry').hidden=!paused;
  $('progress').textContent=state.status==='ready'?'three crossings · one way home': 'crossing '+(state.crossing+1)+'/3 · '+Math.max(0,Math.ceil(CROSSING_SECONDS*(state.crossing+1)-state.time))+'s · score '+state.score;
  $('dash').disabled=!playing||state.cooldown>0;
  $('dash').textContent=state.cooldown>0?'[ '+Math.ceil(state.cooldown)+'s ]':'[ dash ]';
  syncScene();
}
function clearInputs() {
  keys.clear(); pointers.clear();
  for(const b of document.querySelectorAll('.held')) b.classList.remove('held');
}
function newRun() {
  clearInputs(); state=createVoyage((Date.now()%4294967296)>>>0); saved=false;
  start(state); ui(); render(); $('sea').focus({preventScroll:true});
}
function primary() {
  if(state.status==='ready') start(state);
  else if(state.status==='playing') { pause(state); clearInputs(); }
  else if(state.status==='paused') resume(state);
  else newRun();
  ui();
  if(state.status==='playing') $('sea').focus({preventScroll:true});
}
$('primary').addEventListener('click',primary);
$('retry').addEventListener('click',newRun);
$('dash').addEventListener('click',()=>dash(state));
document.addEventListener('keydown',e=>{
  if(e.target.closest('button,a,input,textarea,select') && ['Enter',' '].includes(e.key)) return;
  const key=e.key.toLowerCase();
  if(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d',' ','p','escape','enter'].includes(key)) e.preventDefault();
  if(['p','escape'].includes(key) && !e.repeat && ['playing','paused'].includes(state.status)) primary();
  else if(key==='enter' && !e.repeat && state.status!=='playing') primary();
  else if(key===' ' && !e.repeat) dash(state);
  keys.add(key);
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
for(const button of document.querySelectorAll('[data-direction]')) {
  button.addEventListener('pointerdown',e=>{
    e.preventDefault(); button.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,button.dataset.direction); button.classList.add('held');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event,e=>{
    pointers.delete(e.pointerId); button.classList.remove('held');
  });
}
function input() {
  const touch=new Set(pointers.values());
  return {
    x:Number(keys.has('arrowright')||keys.has('d')||touch.has('right'))-Number(keys.has('arrowleft')||keys.has('a')||touch.has('left')),
    y:Number(keys.has('arrowdown')||keys.has('s')||touch.has('down'))-Number(keys.has('arrowup')||keys.has('w')||touch.has('up'))
  };
}
function suspend() { clearInputs(); pause(state); ui(); }
document.querySelector('[data-switch]').addEventListener('click',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden) suspend();});
window.addEventListener('blur',suspend);
reduced.addEventListener('change',()=>{sceneIndex=-1;ui();render();});
new ResizeObserver(resize).observe(canvas);
function tick(now) {
  const dt=last?Math.min(.05,(now-last)/1000):0; last=now;
  update(state,input(),dt);
  if(!saved && ['won','lost'].includes(state.status)) {
    try { best=saveBest(localStorage,state.score,best); } catch { best=Math.max(best,state.score); }
    saved=true;
  }
  ui(); render(); requestAnimationFrame(tick);
}
ui(); resize(); requestAnimationFrame(tick);

