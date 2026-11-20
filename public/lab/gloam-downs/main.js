// Gloam Downs: the page. It loads a baked place, draws it with Ink Studio's own WebGL renderer, and walks the lamplighter through it.
// Everything here is input, the frame loop, the HUD and the dialogs; the rules of movement are in play.js.
/* global PixelLook */
import { createRenderer } from './ink/webgl/renderer.mjs';
import { loadPlace } from './world.js';
import { makeWalk, makeBody, makeCamera, pose, touches, atBeacon } from './play.js';
import { ORDER, load, store, wispCount, fresh } from './save.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), loading = $('loading'), loadLine = $('loadLine'), barFill = $('barFill'), bar = $('bar');
const q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NUMERAL = ['I', 'II', 'III', 'IV', 'V'];
const TARGET = { low: 30000, mid: 64000, high: 110000 };

/* ---------------- state ---------------- */
// with site data blocked, even reading localStorage throws; then the save lives in this page only (load and store take null)
const disk = (() => { try { return window.localStorage; } catch { return null; } })();
let save = q.has('fresh') ? fresh() : load(disk);
let renderer = null, place = null, walk = null, body = null, cam = null, world = null, meta = null;
let mode = 'loading', paused = false, lost = false, last = 0, time = 0, frames = 0;
let artTarget = TARGET[q.get('q')] || (coarse ? 46000 : TARGET.mid), adapt = !q.has('q');
let art = { w: 320, h: 200, s: 1 };
let pendingRows = new Set(), fogNear = 10, beaconLit = false, arriveTimer = 0, toastTimer = 0, slowFor = 0;
const intervals = [];

/* ---------------- the art size: a small picture scaled up by a whole number ---------------- */
function sizeArt() {
  const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  const s = Math.max(1, Math.round(Math.sqrt((W * H * dpr * dpr) / artTarget)));
  art = { w: Math.max(64, Math.ceil((W * dpr) / s)), h: Math.max(64, Math.ceil((H * dpr) / s)), s };
  canvas.style.width = `${(art.w * s) / dpr}px`;
  canvas.style.height = `${(art.h * s) / dpr}px`;
}
// a tall screen sees little to the sides, so the camera stands further back there
const camDist = () => (innerWidth < innerHeight ? 8.5 * Math.min(1.5, 1 + 0.6 * (innerHeight / innerWidth - 1)) : 8.5);
addEventListener('resize', () => { sizeArt(); if (cam) cam.c.want = camDist(); });

/* ---------------- input ---------------- */
const keys = new Set();
const input = { mx: 0, mz: 0, slow: false, jump: false, ox: 0, oy: 0, dyaw: 0, dpitch: 0 };
const jumpBtn = $('bJump'), stickEl = $('stick');
let stick = null, look = null, mouse = null, jumpTouch = false;
const typing = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
addEventListener('keydown', e => {
  if (typing(e) || window.GameSwitch?.isOpen) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { closePanels(); return; }
  if (mode === 'play' && k === 'm') { openMap(); e.preventDefault(); return; }
  if (mode === 'map' && k === 'm') { closePanels(); return; }
  if (mode === 'play' && k === 'r') { lookAhead(); return; }
  // keys steer the lamplighter only in play. In a dialog, on the end card and on the loading screen they are the page's: Space and Enter
  // press the focused button (Try again too), and the arrows scroll a dialog's box
  if (mode !== 'play' || e.target.closest?.('.panel:not([hidden])')) return;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); stick = look = mouse = null; jumpTouch = false; stickEl.hidden = true; });

canvas.addEventListener('pointerdown', e => {
  if (mode !== 'play') return;
  canvas.setPointerCapture?.(e.pointerId);
  if (e.pointerType === 'mouse') { mouse = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.classList.add('drag'); return; }
  if (e.clientX < innerWidth * 0.5 && !stick) {
    stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    stickEl.style.left = `${e.clientX}px`; stickEl.style.top = `${e.clientY}px`; stickEl.hidden = false;
    stickEl.firstElementChild.style.transform = '';
  } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', e => {
  if (mouse && e.pointerId === mouse.id) { input.dyaw -= (e.clientX - mouse.x) * 0.008; input.dpitch += (e.clientY - mouse.y) * 0.005; mouse.x = e.clientX; mouse.y = e.clientY; }
  else if (stick && e.pointerId === stick.id) {
    stick.x = e.clientX; stick.y = e.clientY;
    const dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy), k = l > 44 ? 44 / l : 1;
    stickEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  } else if (look && e.pointerId === look.id) { input.dyaw -= (e.clientX - look.x) * 0.009; input.dpitch += (e.clientY - look.y) * 0.006; look.x = e.clientX; look.y = e.clientY; }
});
const release = e => {
  if (mouse && e.pointerId === mouse.id) { mouse = null; canvas.classList.remove('drag'); }
  if (stick && e.pointerId === stick.id) { stick = null; stickEl.hidden = true; }
  if (look && e.pointerId === look.id) look = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', e => e.preventDefault());
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); jumpTouch = true; jumpBtn.classList.add('on'); jumpBtn.setPointerCapture?.(e.pointerId); });
const jumpUp = () => { jumpTouch = false; jumpBtn.classList.remove('on'); };
jumpBtn.addEventListener('pointerup', jumpUp);
jumpBtn.addEventListener('pointercancel', jumpUp);
jumpBtn.addEventListener('contextmenu', e => e.preventDefault());

function readInput() {
  const k = n => keys.has(n);
  let mx = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0);
  let mz = (k('w') || k('arrowup') ? 1 : 0) - (k('s') || k('arrowdown') ? 1 : 0);
  let ox = (k('e') ? 1 : 0) - (k('q') ? 1 : 0), oy = 0, jump = k(' '), slow = k('shift'), start = false;
  if (stick) {
    const dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy);
    if (l > 6) { const m = Math.min(1, (l - 6) / 46); mx = (dx / l) * m; mz = (-dy / l) * m; }
  }
  for (const pad of navigator.getGamepads?.() || []) {
    if (!pad || !pad.connected) continue;
    const ax = (i, dz = 0.18) => (Math.abs(pad.axes[i] || 0) > dz ? pad.axes[i] : 0);
    if (ax(0) || ax(1)) { mx = ax(0); mz = -ax(1); }
    if (ax(2) || ax(3)) { ox = ax(2); oy = ax(3); }
    if (pad.buttons[0]?.pressed) jump = true;
    if (pad.buttons[2]?.pressed) slow = true;
    if (pad.buttons[9]?.pressed) start = true;
    if (pad.buttons[5]?.pressed && mode === 'play') lookAhead();
  }
  // Start counts once for all the pads together, so a second pad cannot make a held Start press again
  if (start && !padStart) mode === 'play' ? openMap() : closePanels();
  padStart = start;
  input.mx = mx; input.mz = mz; input.ox = ox; input.oy = oy; input.jump = jump || jumpTouch; input.slow = slow;
}
let padStart = false;

/* ---------------- the HUD and the cards ---------------- */
const hud = $('hud'), tools = $('tools');
function showHud(on) {
  hud.hidden = tools.hidden = !on;
  jumpBtn.hidden = !(on && coarse);
}
function updateHud() {
  const got = save.wisps[meta.id]?.length || 0;
  $('where').textContent = meta.name;
  $('count').innerHTML = `<b>◆ ${got}/5</b> wisps · <i>${beaconLit ? 'beacon lit' : 'beacon dark'}</i>`;
  const others = meta.id === ORDER.at(-1) && ORDER.some(id => !save.lit[id]); // the last place lit before the rest
  $('hint').textContent = !beaconLit ? meta.hint || 'Light the beacon on the summit.' : others ? 'Other beacons are still dark. Use the map.' : 'The way is open. Use the map, or walk on.';
}
function toast(html, ms = 1800) {
  const t = $('toast');
  t.innerHTML = html;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
function arrive() {
  const i = ORDER.indexOf(meta.id);
  $('arriveN').textContent = `${NUMERAL[i]} · ${['The first place', 'The second place', 'The third place', 'The fourth place', 'The last place'][i]}`;
  $('arriveName').textContent = meta.name;
  $('arriveSub').textContent = meta.sub || '';
  const a = $('arrive');
  a.classList.remove('off');
  clearTimeout(arriveTimer);
  arriveTimer = setTimeout(() => a.classList.add('off'), still ? 2400 : 3200);
}

/* ---------------- dialogs ---------------- */
const panels = ['help', 'map', 'end'];
function closePanels() {
  // closing the help any way (Walk, Escape, a gamepad's Start) means it has been read
  if (!$('help').hidden) { save.seen = true; store(disk, save); }
  let was = false;
  for (const p of panels) if (!$(p).hidden) { $(p).hidden = true; was = true; }
  if (was && mode !== 'loading') { mode = 'play'; canvas.focus?.(); }
}
function openMap() {
  const box = $('places');
  box.textContent = '';
  ORDER.forEach((id, i) => {
    const open = save.reached.includes(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = !open;
    if (meta && id === meta.id) b.setAttribute('aria-current', 'true');
    const name = NAMES[id];
    b.innerHTML = `<span class="n">${NUMERAL[i]}</span><b></b><em></em><small></small>`;
    b.querySelector('b').textContent = open ? name : 'Locked';
    b.querySelector('small').textContent = open ? (save.lit[id] ? 'Beacon lit' : 'Beacon dark') : 'Light the beacon before it';
    b.querySelector('em').textContent = open ? `◆ ${save.wisps[id]?.length || 0}/5` : '';
    b.addEventListener('click', () => { closePanels(); if (id !== meta.id) go(id); });
    box.appendChild(b);
  });
  $('mapLine').textContent = `Wisps found: ${wispCount(save)} of 25.`;
  $('map').hidden = false;
  mode = 'map';
  box.querySelector('[aria-current="true"]')?.focus();
}
const NAMES = { gaol: 'The Sunken Gaol', ramparts: 'Crow Ramparts', fen: 'Lantern Fen', bells: 'The Bell Knoll', barrows: 'Barrow Crown' };
$('bMap').addEventListener('click', () => (mode === 'map' ? closePanels() : openMap()));
$('bMapClose').addEventListener('click', closePanels);
$('bLook').addEventListener('click', lookAhead);
$('bStart').addEventListener('click', closePanels);
$('bEndStay').addEventListener('click', closePanels);
$('bAgain').addEventListener('click', () => { closePanels(); save.lit = {}; save.time = 0; save.at = 'gaol'; store(disk, save); go('gaol'); });
for (const p of panels) $(p).addEventListener('pointerdown', e => { if (e.target === $(p) && p !== 'help') closePanels(); });
function lookAhead() { if (cam && body) { cam.c.yaw = body.s.yaw + Math.PI; cam.c.pitch = 0.34; cam.c.idle = 0; } }
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ---------------- wisps and the beacon ---------------- */
// put splats out (density 0) or back; the renderer then uploads only the changed 512-splat rows
const saved = new Map();
function setLit(ranges, on) {
  for (const [a, b] of ranges)
    for (let i = a; i < b; i++) {
      const o = i * 16 + 3;
      if (!saved.has(i)) saved.set(i, world.data[o]);
      world.data[o] = on ? saved.get(i) : 0;
      pendingRows.add(i >> 9);
    }
}
function takeWisp(i) {
  const list = (save.wisps[meta.id] ||= []);
  if (list.includes(i)) return;
  list.push(i);
  list.sort();
  setLit([meta.wisps[i].ids], false);
  store(disk, save);
  updateHud();
  toast(`<b>◆</b> Wisp ${list.length} of 5`);
}
let beaconTimer = 0;
function lightBeacon() {
  if (beaconLit) return;
  beaconLit = true;
  setLit(meta.beacon.fire, true);
  const id = meta.id, next = ORDER[ORDER.indexOf(id) + 1];
  save.lit[id] = true;
  if (next && !save.reached.includes(next)) save.reached.push(next);
  // the walk ends when all five burn, whatever the order: after Walk again the map still opens every place reached
  const dark = ORDER.filter(p => !save.lit[p]).length;
  if (!dark) {
    save.done += 1;
    if (!save.best || save.time < save.best) save.best = save.time;
  }
  store(disk, save);
  updateHud();
  clearTimeout(beaconTimer);
  if (!dark) {
    toast('The last beacon burns', 2400);
    beaconTimer = setTimeout(() => {
      if (meta.id !== id || mode === 'loading') return;
      closePanels();
      $('endTime').textContent = fmt(save.time);
      $('endWisps').textContent = `${wispCount(save)}/25`;
      $('endBest').textContent = save.best ? fmt(save.best) : '–';
      $('end').hidden = false;
      mode = 'end';
    }, 1800);
  } else if (next) {
    toast(`The way opens to <b>${NAMES[next]}</b>`, 2600);
    beaconTimer = setTimeout(() => { if (meta.id === id && mode === 'play') go(next); }, 2800);
  } else toast(`${dark} ${dark === 1 ? 'beacon is' : 'beacons are'} still dark`, 2600);
}

/* ---------------- loading a place ---------------- */
function progress(f) {
  barFill.style.width = `${Math.round(f * 100)}%`;
  bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
}
async function go(id) {
  clearTimeout(beaconTimer);
  mode = 'loading';
  showHud(false);
  $('veil').classList.add('on');
  await new Promise(r => setTimeout(r, still ? 0 : 450));
  loading.classList.remove('done');
  loadLine.textContent = `Walking to ${NAMES[id]}…`;
  $('bRetry').hidden = true;
  progress(0);
  try {
    place = await loadPlace('./worlds/', id, progress);
  } catch (err) {
    loadLine.textContent = `Could not load ${NAMES[id]} (${err.message}).`;
    const r = $('bRetry');
    r.hidden = false;
    r.onclick = () => go(id);
    r.focus(); // so Space or Enter tries again without a Tab
    return;
  }
  ({ meta, world } = place);
  walk = makeWalk(meta.walk, place.walk);
  body = makeBody(walk, meta.spawn, meta.bounds);
  cam = makeCamera(walk, { yaw: meta.spawn.yaw + Math.PI, auto: !still, dist: camDist() });
  cam.snap(body.s, meta.spawn.yaw + Math.PI);
  // the fog: the bake set it for a camera 9 back; keep it at the same depths whatever the distance
  fogNear = meta.fog.start * 2 * (meta.fogFar - 9) + 2 * 9 - meta.fogFar;
  // the lamplighter's splats ride bones that the page writes every frame
  const n = meta.bones.names.length;
  world.anim = { bones: new Float32Array(12 * n), boned: Int32Array.from({ length: meta.bones.end - meta.bones.first }, (_, i) => meta.bones.first + i) };
  saved.clear();
  pendingRows = new Set();
  for (const i of save.wisps[id] || []) setLit([meta.wisps[i].ids], false);
  beaconLit = !!save.lit[id];
  if (!beaconLit) setLit(meta.beacon.fire, false);
  pendingRows = new Set(); // the whole world is uploaded on its first frame anyway
  save.at = id;
  if (!save.reached.includes(id)) save.reached.push(id);
  store(disk, save);
  updateHud();
  progress(1);
  loading.classList.add('done');
  $('veil').classList.remove('on');
  mode = 'play';
  view = null;
  showHud(true);
  arrive();
  if (manual) draw();
  if (!save.seen) {
    $('helpKeys').hidden = coarse;
    $('helpTouch').hidden = !coarse;
    $('help').hidden = false;
    mode = 'help';
  }
}

/* ---------------- the frame ---------------- */
// ?test: the loop does not run by itself; a test steps the game with __gloam.tick() and draws with __gloam.draw(). Software WebGL
// draws a frame in about a second, so a test cannot wait on the real loop.
const manual = q.has('test');
function update(dt) {
  if (mode === 'play') {
    time += dt;
    save.time += dt;
    body.step(dt, input, cam.c.yaw);
    const s = body.s;
    meta.wisps.forEach((w, i) => { if (!(save.wisps[meta.id] || []).includes(i) && touches(s, w.p)) takeWisp(i); });
    if (!beaconLit && atBeacon(s, meta.beacon)) lightBeacon();
    if (s.y < -25) { body.place(meta.spawn.p, meta.spawn.yaw); cam.snap(body.s, meta.spawn.yaw + Math.PI); toast('Back to the start'); }
  } else time += dt;
  view = cam.follow(body.s, dt, input);
  input.dyaw = input.dpitch = 0;
}
let view = null;
function draw() {
  if (!view) view = cam.follow(body.s, 0, input);
  pose(world.anim.bones, meta.bones, body.s, time, still);
  // the fog stays at fogNear..fogFar whatever the camera's distance (the renderer spreads it over dist ± radius)
  world.radius = Math.max(6, meta.fogFar - view.dist);
  world.fog.start = Math.max(0, Math.min(0.97, (fogNear - 2 * view.dist + meta.fogFar) / (2 * world.radius)));
  try {
    renderer.render(world, { width: art.w, height: art.h, time, camera: view, changedRows: [...pendingRows], colored: true });
    pendingRows.clear();
  } catch (err) {
    // a lost context can throw before its webglcontextlost event arrives: wait for webglcontextrestored, do not stop
    if (lost || canvas.getContext('webgl2')?.isContextLost()) { lost = true; return; }
    console.warn(err); paused = true; loadLine.textContent = `The picture stopped: ${err.message}`; loading.classList.remove('done');
  }
  frames++;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dtRaw = last ? (now - last) / 1000 : 0;
  last = now;
  if (manual || paused || lost || !place || mode === 'loading' || document.hidden || window.GameSwitch?.isOpen) return;
  readInput();
  // steps of at most 1/30 s, as many as the frame took (up to a quarter second), so a slow phone does not play in slow motion
  for (let rest = Math.min(0.25, dtRaw); rest > 1e-4; rest -= 1 / 30) update(Math.min(1 / 30, rest));
  draw();
  if (frames % 120 === 0) store(disk, save);
  // slow machine: if frames come slower than 45 ms for two seconds, draw a smaller picture
  if (adapt && dtRaw > 0) {
    intervals.push(dtRaw);
    if (intervals.length > 40) intervals.shift();
    const med = [...intervals].sort((a, b) => a - b)[intervals.length >> 1];
    slowFor = med > 0.045 ? slowFor + dtRaw : 0;
    if (slowFor > 2 && artTarget > 24000) { artTarget = Math.round(artTarget * 0.72); sizeArt(); slowFor = 0; intervals.length = 0; }
  }
}

/* ---------------- start ---------------- */
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
canvas.addEventListener('webglcontextrestored', () => { lost = false; });
document.addEventListener('visibilitychange', () => { last = 0; if (document.hidden && place) store(disk, save); });
addEventListener('pagehide', () => { if (place) store(disk, save); });

window.__gloam = {
  state: () => ({
    mode, place: meta?.id, x: body?.s.x, y: body?.s.y, z: body?.s.z, ground: body?.s.ground, yaw: body?.s.yaw,
    wisps: meta ? save.wisps[meta.id]?.length || 0 : 0, lit: beaconLit, frames, art: { ...art }, target: artTarget, count: world?.count,
    reached: save.reached.slice(), cam: cam ? { yaw: cam.c.yaw, dist: cam.c.dist, pitch: cam.c.pitch } : null
  }),
  go: id => go(id),
  teleport: (x, z, yaw) => { body.place([x, walk.top(x, z) + 0.5, z], yaw); cam.snap(body.s, (yaw ?? body.s.yaw) + Math.PI); },
  wisp: i => takeWisp(i),
  light: () => lightBeacon(),
  points: () => (meta ? { spawn: meta.spawn, beacon: meta.beacon.p, wisps: meta.wisps.map(w => w.p) } : null),
  close: () => closePanels(),
  // ?test only: step the game by `seconds` at 60 steps a second with these held (mx, mz, jump, slow, ox), then draw once if asked
  tick: (seconds, held = {}, drawAfter = false) => {
    const n = Math.round(seconds * 60);
    // held 'live': read the real keys, touch stick, jump button and gamepad, as the running page does
    for (let i = 0; i < n; i++) { if (held === 'live') readInput(); else Object.assign(input, { mx: 0, mz: 0, jump: false, slow: false, ox: 0, oy: 0 }, held); update(1 / 60); }
    if (drawAfter) draw();
    return window.__gloam.state();
  },
  draw: () => { draw(); return frames; },
  // draw, then read the picture back before the browser shows it: mean luminance (0..1), the share over 0.55, and how many colours
  stats: () => {
    draw();
    const gl = canvas.getContext('webgl2'), w = canvas.width, h = canvas.height, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, bright = 0;
    const colours = new Set();
    for (let i = 0; i < w * h; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sum += y;
      if (y > 0.55) bright++;
      if (colours.size < 200) colours.add((r << 16) | (g << 8) | b);
    }
    return { w, h, mean: sum / (w * h), bright: bright / (w * h), colours: colours.size };
  },
  ready: () => mode !== 'loading' && !!place
};

(async () => {
  sizeArt();
  try {
    renderer = createRenderer(canvas, { toolkit: { PixelLook } });
  } catch (err) {
    loadLine.textContent = 'Gloam Downs needs WebGL 2, and this browser does not have it. Try a recent Chrome, Firefox or Safari.';
    return;
  }
  // the places are gzipped, and world.js unzips them with DecompressionStream
  if (typeof DecompressionStream !== 'function') {
    loadLine.textContent = 'Gloam Downs needs a newer browser to unpack its places. Try Safari 16.4, Firefox 113, Chrome 80 or later.';
    return;
  }
  requestAnimationFrame(frame);
  const start = q.get('place');
  await go(ORDER.includes(start) && save.reached.includes(start) ? start : save.at || 'gaol');
})();
