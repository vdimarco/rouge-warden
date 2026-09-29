import { createMatch, step, player, HEROES, UPGRADES, buy, distance } from './sim.js';
import { loadArt, Renderer } from './render.js';
import { Sound } from './audio.js';
const $ = id => document.getElementById(id);
const sound = new Sound(), keys = new Set();
let state = createMatch(), renderer, selected = 0, running = false, paused = false, last = performance.now(), accumulator = 0, uiTime = 0, resultShown = false, aim = null, castQueue, recallQueue = false, target = 0, moveId = null, moveOrigin, skillId = null, skillOrigin, skillSlot = null, lastAttack = 0;
const movement = { x: 0, y: 0 };
const dom = { clock: $('clock'), level: $('level'), healthFill: $('health-fill'), healthText: $('health-text'), xp: $('xp-fill'), gold: $('gold'), shop: $('shop'), notice: $('notice'), respawn: $('respawn'), objective: $('objective-sub') };
const skillButtons = [...document.querySelectorAll('[data-skill]')];
function resetInput() { keys.clear(); movement.x = movement.y = 0; moveId = skillId = null; castQueue = undefined; recallQueue = false; aim = null; skillSlot = null; $('thumb').style.transform = ''; }
function closeSheet() { $('sheet').close(); paused = false; resetInput(); last = performance.now(); }
function sheet(html) { paused = running; resetInput(); $('sheet-content').innerHTML = html; if (!$('sheet').open) $('sheet').showModal(); }
function pause() {
  if (!running || resultShown) return;
  sheet('<h2>The tide can wait</h2><button id="resume" class="primary">Keep playing</button><button id="sound" class="row-btn"></button><button id="quit" class="row-btn">Choose another hero</button><p class="keyhint">WASD or arrows to move · Q dash · E surge · R ultimate · B return · Esc pause</p>');
  $('resume').onclick = closeSheet; $('sound').textContent = sound.on ? 'Sound on' : 'Sound off'; $('sound').onclick = () => { $('sound').textContent = sound.toggle() ? 'Sound on' : 'Sound off'; updateSound(); }; $('quit').onclick = menu;
}
function menu() { closeSheet(); running = false; resultShown = false; $('menu').hidden = false; $('hud').hidden = true; state = createMatch(selected); sound.next = 0; }
function updateSound() { $('sound-menu').textContent = sound.on ? 'Sound on' : 'Sound off'; }
function choose(kind) {
  selected = kind; const h = HEROES[kind]; $('hero-name').textContent = h.name; $('hero-role').textContent = h.role; $('hero-note').textContent = h.note;
  $('hero-art').src = `./art/${['nacre', 'brine', 'vela'][kind]}.webp`; $('hero-art').alt = `${h.name}, ${h.role}`;
  document.querySelectorAll('[data-hero]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.hero === kind)));
}
function start() {
  sound.start(); sound.next = 0; state = createMatch(selected, Date.now() >>> 0); running = true; paused = false; resultShown = false; target = 0; accumulator = 0; lastAttack = 0; last = performance.now(); resetInput();
  $('menu').hidden = true; $('hud').hidden = false; $('coach').hidden = false; $('close-sheet').hidden = false;
  for (let i = 0; i < 3; i++) skillButtons[i].setAttribute('title', HEROES[selected].skills[i]);
  if (renderer) renderer.cam = { x: player(state).x, y: player(state).y - 150 };
  updateUI();
}
function how() {
  sheet('<h2>Break their heart</h2><ul><li>Move with the left pad. Your hero attacks nearby enemies. Tap a target to focus it.</li><li>Tap a skill for aim assist. Drag its button to aim, then release.</li><li>Follow your soldiers into a lane. Let them draw the spire’s fire.</li><li>Break any enemy spire to expose the heart. Destroy the heart to win.</li><li>Defeat the Leviathan in the center to recruit a siege beast.</li><li>Spend pearls on upgrades. Return home to heal. Your ultimate unlocks at level 3.</li></ul><p>After four minutes, the team with more structure health wins.</p><p class="keyhint">Solo play with five bots. WASD / arrows · Q / E / R skills · B return · Esc pause</p><button id="got-it" class="primary">Got it</button>');
  $('got-it').onclick = closeSheet;
}
function shop() {
  const p = player(state);
  sheet(`<h2>Shape your hero</h2><p>${Math.floor(p.gold)} pearls available. Each upgrade stacks up to 3 times.</p>${UPGRADES.map(u => `<button class="row-btn" data-buy="${u.id}" ${p.gold < u.cost || (p.upgrades[u.id] || 0) >= 3 ? 'disabled' : ''}>${u.name} <span>· ${u.cost}</span><small>${u.text} · ${p.upgrades[u.id] || 0}/3</small></button>`).join('')}<button id="back-battle" class="primary">Back to battle</button>`);
  document.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => { if (buy(state, b.dataset.buy)) { sound.tone(660, .16); shop(); updateUI(); } }; });
  $('back-battle').onclick = closeSheet;
}
function result() {
  resultShown = true; resetInput(); const p = player(state), victory = state.winner === 0;
  try { const saved = JSON.parse(localStorage.getItem('tidebreak.record') || '{"wins":0,"matches":0}'); saved.matches++; if (victory) saved.wins++; localStorage.setItem('tidebreak.record', JSON.stringify(saved)); } catch {}
  sheet(`<h2>${state.winner === -1 ? 'The tide stands still' : victory ? 'The reef is yours' : 'The heart has fallen'}</h2><div class="result-score">${state.score[0]} : ${state.score[1]}</div><p>${state.reason}</p><dl><dt>Your kills / deaths</dt><dd>${p.kills} / ${p.deaths}</dd><dt>Damage dealt</dt><dd>${Math.round(state.stats.damage).toLocaleString()}</dd><dt>Final level</dt><dd>${p.level}</dd><dt>Leviathans claimed</dt><dd>${state.stats.leviathans}</dd></dl><button id="again" class="primary">Battle again</button><button id="change-hero" class="row-btn">Choose another hero</button>`);
  $('close-sheet').hidden = true; $('again').onclick = () => { closeSheet(); start(); }; $('change-hero').onclick = () => { $('close-sheet').hidden = false; menu(); };
}
function updateUI() {
  const p = player(state), remain = Math.max(0, Math.ceil(240 - state.time));
  dom.clock.textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  $('allied-score').textContent = state.score[0]; $('enemy-score').textContent = state.score[1]; dom.level.textContent = p.level; dom.healthFill.style.width = `${p.hp / p.maxHp * 98}%`; dom.healthText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; dom.xp.style.width = `${p.xp / (p.level * 100) * 100}%`; dom.gold.textContent = Math.floor(p.gold); dom.shop.classList.toggle('available', p.gold >= 200);
  skillButtons.forEach((b, i) => { const locked = i === 2 && p.level < 3; b.querySelector('b').textContent = locked ? 'LV 3' : p.cd[i] > 0 ? Math.ceil(p.cd[i]) : ''; b.querySelector('b').classList.toggle('locked', locked); b.setAttribute('aria-disabled', String(locked || p.cd[i] > 0 || p.hp <= 0)); });
  dom.respawn.hidden = p.hp > 0; if (p.hp <= 0) dom.respawn.innerHTML = `Return with the tide<strong>${Math.max(1, Math.ceil(p.respawn))}</strong>`;
  const msg = state.messages.at(-1), fresh = msg && state.time - msg.time < 3.8;
  dom.notice.style.opacity = fresh ? '1' : '0'; if (fresh && dom.notice.dataset.time !== String(msg.time)) { dom.notice.replaceChildren(); const b = document.createElement('b'), small = document.createElement('small'); b.textContent = msg.title; small.textContent = msg.detail; dom.notice.append(b, small); dom.notice.dataset.time = msg.time; }
  dom.objective.textContent = p.recall ? `Returning in ${Math.ceil(p.recall)}…` : state.towers[1] < 3 ? 'Their heart is exposed. Push with your wave.' : state.objective ? 'Leviathan is up · Claim it in the center' : 'Lead a wave to an enemy spire';
  if (state.time > 18) $('coach').hidden = true;
}
$('play').onclick = start; $('pause').onclick = pause; $('how').onclick = how; $('shop').onclick = shop; $('recall').onclick = () => { if (running && !paused) recallQueue = true; }; $('close-sheet').onclick = closeSheet; $('coach-close').onclick = () => $('coach').hidden = true;
$('sheet').addEventListener('cancel', e => { e.preventDefault(); if (!resultShown) closeSheet(); });
$('sound-menu').onclick = () => { sound.start(); sound.toggle(); updateSound(); }; updateSound();
document.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => choose(+b.dataset.hero));
const joy = $('joystick');
function moveStick(e) { if (e.pointerId !== moveId) return; const x = e.clientX - moveOrigin.x, y = e.clientY - moveOrigin.y, d = Math.max(1, Math.hypot(x, y) / 38); movement.x = x / d / 38; movement.y = y / d / 38; $('thumb').style.transform = `translate(${movement.x * 29}px,${movement.y * 29}px)`; }
joy.addEventListener('pointerdown', e => { if (!running || paused || moveId !== null) return; e.preventDefault(); sound.start(); $('coach').hidden = true; moveId = e.pointerId; const r = joy.getBoundingClientRect(); moveOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; joy.setPointerCapture(e.pointerId); moveStick(e); });
joy.addEventListener('pointermove', moveStick);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(type, e => { if (e.pointerId !== moveId) return; moveId = null; movement.x = movement.y = 0; $('thumb').style.transform = ''; });
skillButtons.forEach(b => {
  // Native keyboard and assistive activation do not send a pointer sequence.
  b.addEventListener('click', e => { if (e.detail === 0 && running && !paused) { sound.start(); castQueue = { slot: +b.dataset.skill, aim: null }; } });
  b.addEventListener('pointerdown', e => { if (!running || paused || skillId !== null) return; e.preventDefault(); sound.start(); skillId = e.pointerId; skillSlot = +b.dataset.skill; skillOrigin = { x: e.clientX, y: e.clientY }; aim = null; b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointermove', e => { if (e.pointerId !== skillId) return; const x = e.clientX - skillOrigin.x, y = e.clientY - skillOrigin.y; aim = Math.hypot(x, y) > 12 ? { x, y } : null; });
  b.addEventListener('pointerup', e => { if (e.pointerId !== skillId) return; castQueue = { slot: skillSlot, aim }; skillId = null; skillSlot = null; aim = null; });
  for (const event of ['pointercancel', 'lostpointercapture']) b.addEventListener(event, e => { if (e.pointerId === skillId) { skillId = null; skillSlot = null; aim = null; } });
});
$('attack').addEventListener('pointerdown', e => { e.preventDefault(); sound.start(); if (!running || paused) return; const p = player(state); const candidates = state.units.filter(e => e.team !== 0 && e.hp > 0 && distance(e, p) < p.range + e.radius).sort((a, b) => distance(a, p) - distance(b, p)); const index = candidates.findIndex(e => e.id === target); target = candidates[(index + 1) % candidates.length]?.id || 0; });
$('battle').addEventListener('pointerdown', e => { if (!running || paused) return; const point = renderer.world(e.clientX, e.clientY); const hit = state.units.filter(u => u.team !== 0 && u.hp > 0 && distance(u, point) < 75).sort((a, b) => distance(a, point) - distance(b, point))[0]; if (hit) target = hit.id; });
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape') { if ($('sheet').open) { if (!resultShown) closeSheet(); } else pause(); return; }
  if (!running || paused || e.repeat) return;
  const key = e.key.toLowerCase(); keys.add(key);
  const slot = ['q', 'e', 'r'].indexOf(key); if (slot >= 0) castQueue = { slot, aim: null };
  if (key === 'b') recallQueue = true;
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { resetInput(); if (running && !paused && !resultShown) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { resetInput(); if (running && !paused && !resultShown) pause(); } });
window.addEventListener('resize', () => { resetInput(); renderer?.resize(); });
window.addEventListener('contextmenu', e => e.preventDefault());
function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (running && !paused && !window.GameSwitch?.isOpen) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      const p = player(state), command = castQueue; castQueue = undefined;
      const input = { x: movement.x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: movement.y + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')), target, cast: command?.slot, aim: command?.aim, recall: recallQueue }; recallQueue = false;
      const before = command ? p.cd[command.slot] : 0; step(state, input);
      if (command && p.cd[command.slot] > before) sound.skill(command.slot);
      if (p.attackAnim > lastAttack && p.attackAnim <= .24) sound.hit(); lastAttack = p.attackAnim;
      accumulator -= 1 / 60;
    }
    sound.tick(state.time); uiTime += dt; if (uiTime > .09) { updateUI(); uiTime = 0; }
    if (state.winner !== null && !resultShown) result();
  }
  renderer?.draw(state, dt, !running, aim);
  requestAnimationFrame(frame);
}
loadArt().then(art => { renderer = new Renderer($('battle'), $('minimap'), art); $('play').disabled = false; $('play').textContent = 'Enter the tide'; requestAnimationFrame(frame); }).catch(error => { console.error(error); $('load-error').hidden = false; $('play').textContent = 'Reef unavailable'; });
// A read-only snapshot supports the existing arcade's QA tooling.
export const snapshot = () => ({ running, paused, time: state.time, winner: state.winner, player: { ...player(state), cd: [...player(state).cd] }, units: state.units.length, score: [...state.score], assetReady: !!renderer });
