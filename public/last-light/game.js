import { mount } from './vendor/mount.js';
import * as sunset from './vendor/ocean-sunset.js';
import * as coast from './vendor/night-coast.js';
import * as fjord from './vendor/aurora-fjord.js';
import { createVoyage, start, pause, resume, dash, update, readBest, saveBest, CROSSINGS, CROSSING_SECONDS } from './engine.js';
const $ = id => document.getElementById(id);
const scenes = [sunset, coast, fjord];
const canvas = $('play'), ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let state = createVoyage(), best = 0, sceneIndex = -1, stopScene = () => {}, scenePlaying = false;
try { best = readBest(localStorage); } catch {}
const keys = new Set(), pointers = new Map();
let last = 0, saved = false;
const boat = ['    |    ', '    |\\   ', '   /| \\  ', '  /_|__\\ ', ' \\_____/ '];
const rock = ['  /\\  ', ' /##\\ ', '/####\\'];
function sprite(lines, x, y, size, color) {
  ctx.font = size + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  const step = size * .82;
  for (let i=0; i<lines.length; i++) ctx.fillText(lines[i], x, y + (i-(lines.length-1)/2)*step);
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
  const scale = Math.max(5.5, Math.min(14,w/95));
  const entities = state.status === 'ready'
    ? [{type:'light',x:.18,y:.69},{type:'light',x:.5,y:.71},{type:'light',x:.84,y:.72},{type:'rock',x:.29,y:.78},{type:'rock',x:.87,y:.84}]
    : state.entities;
  for (const e of entities) {
    if (e.type === 'light') {
      sprite([' | ', '-*-', ' | '],e.x*w,e.y*h,scale*1.1,'#ffcd62');
    } else sprite(rock,e.x*w,e.y*h,scale,'#ff5d8f');
  }
  const boatInk = state.dash > 0 ? '#7cf0a0' : state.safe > 0 ? '#ff8a9a' : '#fff5d8';
  // Dark glyph shadow preserves contrast over the sun's reflection.
  ctx.shadowColor='#0b0817'; ctx.shadowBlur=3;
  sprite(boat,state.x*w,state.y*h,scale,boatInk);
  ctx.shadowBlur=0;
  if (!reduced.matches && (state.status === 'playing' || state.status === 'ready')) {
    sprite(['· . · . ·'],state.x*w,(state.y+.045)*h,scale,'#c8bbdb');
  }
  for (const e of state.effects) {
    ctx.globalAlpha=1-e.age/.9;
    sprite([e.text],e.x*w,(e.y-.04-e.age*.025)*h,Math.max(10,scale),'#fff5d8');
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

