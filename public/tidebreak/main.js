import { market, inventoryHTML } from './market.js';
import { ITEM, nextItem, nextPurchase, quote } from './items.js';
import { createMatch, step, player, HEROES, trainSkill, cancelOrder, announce, buy, setBuild, distance, SIZE, LIMIT, SHIFT, PORTALS } from './sim.js';
import { loadArt, Renderer } from './illustrated-render.js';
import { visibleTo, concealed } from './world.js';
import { Sound } from './audio.js';
import { KITS, canLearn, rankGate, xpForLevel, MAX_LEVEL, cooldownFor } from './abilities.js';
import { skillIcon } from './skill-icons.js';
import { BASIC_ATTACKS } from './basic-attacks.js';
import { spellbookHTML, spellDetail } from './spellbook.js';
import { rosterHTML, heroPreviewHTML, ROLES } from './roster.js';
const $ = id => document.getElementById(id);
const sound = new Sound(), keys = new Set();
let state = createMatch(), renderer, selected = 1, running = false, paused = false, last = performance.now(), accumulator = 0, uiTime = 0, resultShown = false, aim = null, orderQueue, castQueue, recallQueue = false, target = 0, moveId = null, moveOrigin, skillId = null, skillOrigin, skillSlot = null, lastAttack = 0, portalQueue = false, waypoint = null;
const movement = { x: 0, y: 0 };
const dom = { clock: $('clock'), level: $('level'), healthFill: $('health-fill'), healthText: $('health-text'), xp: $('xp-fill'), gold: $('gold'), shop: $('shop'), notice: $('notice'), respawn: $('respawn'), objective: $('objective-sub') };
const skillButtons = [...document.querySelectorAll('[data-skill]')];
function resetInput() { cancelOrder(player(state)); target=0; orderQueue=undefined; keys.clear(); movement.x = movement.y = 0; moveId = skillId = null; castQueue = undefined; recallQueue = portalQueue = false; aim = null; skillSlot = null; $('thumb').style.transform = ''; }
function closeSheet() { $('sheet').close(); paused = false; resetInput(); last = performance.now(); }
function sheet(html) { $('sheet').classList.remove('market','spellbook-sheet'); paused = running; resetInput(); $('sheet-content').innerHTML = html; if (!$('sheet').open) $('sheet').showModal(); }
function pause() {
  if (!running || resultShown) return;
  sheet('<h2>The hunt can wait</h2><button id="resume" class="primary">Keep playing</button><button id="return-home" class="row-btn">Return home to heal</button><button id="sound" class="row-btn"></button><button id="quit" class="row-btn">Choose another creature</button><p class="keyhint">WASD or arrows to move · Q / E / C / R skills · K spellbook · F rift · M map · B return · Esc pause</p>');
  $('resume').onclick = closeSheet; $('return-home').onclick = () => { closeSheet(); recallQueue = true; }; $('sound').textContent = sound.on ? 'Sound on' : 'Sound off'; $('sound').onclick = () => { $('sound').textContent = sound.toggle() ? 'Sound on' : 'Sound off'; updateSound(); }; $('quit').onclick = menu;
}
function menu() { closeSheet(); running = false; resultShown = false; $('menu').hidden = false; $('hud').hidden = true; state = createMatch(selected); sound.next = 0; }
function updateSound() { $('sound-menu').textContent = sound.on ? 'Sound on' : 'Sound off'; }
function choose(kind) {
  selected = kind; const h = HEROES[kind]; $('hero-name').textContent = h.name; $('hero-role').textContent = h.role; $('hero-note').textContent = h.note;
  $('hero-art').src = `./art/illustrated/${h.slug}-front.webp`; $('hero-art').alt = `${h.name}, ${h.role}`;
  document.querySelectorAll('[data-hero]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.hero === kind)));
  $('menu').style.setProperty('--hero-color',h.color);$('hero-preview').innerHTML=heroPreviewHTML(kind);$('hero-spell-note').textContent=h.note;
  document.querySelectorAll('[data-hero-spell]').forEach(b=>b.onclick=()=>{$('hero-spell-note').textContent=spellDetail(kind,+b.dataset.heroSpell).description;document.querySelectorAll('[data-hero-spell]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});
}
function start() {
  sound.start(); sound.next = 0; state = createMatch(selected, Date.now() >>> 0); try { setBuild(state, localStorage.getItem('monster-mash.build.' + selected)); } catch {} running = true; paused = false; resultShown = false; target = 0; waypoint = null; accumulator = 0; lastAttack = 0; last = performance.now(); resetInput();
  $('menu').hidden = true; $('hud').hidden = false; $('coach').hidden = false; $('close-sheet').hidden = false;
  for (let i = 0; i < 4; i++) { skillButtons[i].setAttribute('title', HEROES[selected].skills[i]); skillButtons[i].setAttribute('aria-label', HEROES[selected].skills[i] + '. ' + HEROES[selected].descriptions[i]); skillButtons[i].querySelector('span').textContent = HEROES[selected].labels[i]; }
  if (renderer) renderer.cam = { x: player(state).x, y: player(state).y };
  $('controls').style.setProperty('--hero-color',HEROES[selected].color);
  skillButtons.forEach((b,i)=> {b.style.backgroundImage='none';b.querySelector('svg')?.remove();b.insertAdjacentHTML('afterbegin',skillIcon(KITS[selected][i].icon));});
  updateUI(); learnSkills();
}
function learnSkills() {
  if (!running || resultShown) return;
  const p=player(state);let selectedSpell=p.skillRanks.findIndex((r,i)=>canLearn(p,i));if(selectedSpell<0)selectedSpell=0;
  const show=()=>{
    sheet(spellbookHTML(p,selectedSpell));$('sheet').classList.add('spellbook-sheet');
    document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{selectedSpell=+b.dataset.preview;show();document.querySelector(`[data-preview="${selectedSpell}"]`).focus({preventScroll:true});});
    $('train-selected').onclick=()=>{if(trainSkill(p,selectedSpell)){const text=`${KITS[p.hero][selectedSpell].name} · Rank ${p.skillRanks[selectedSpell]}`;announce(state,text,'Spell trained. Return to the hunt.');sound.tone(780,.16);updateUI();show();$('training-feedback').textContent=`Learned ${KITS[p.hero][selectedSpell].name}, rank ${p.skillRanks[selectedSpell]}.`;document.querySelector(`[data-preview="${selectedSpell}"]`).focus({preventScroll:true});}};
    $('back-skills').onclick=closeSheet;
  };show();
}
$('skill-points').onclick=learnSkills;
const upgradeButtons=[...document.querySelectorAll('[data-upgrade]')];
upgradeButtons.forEach(b=>{
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.onclick=()=>{
    if(!running||paused||resultShown)return;
    const p=player(state),slot=+b.dataset.upgrade;
    if(!trainSkill(p,slot))return;
    announce(state,`${KITS[p.hero][slot].name} · Rank ${p.skillRanks[slot]}`,'Ability upgraded.');
    sound.tone(780,.16);updateUI();
  };
});

function how() {
  const h = HEROES[selected];
  sheet(`<h2>Hunt. Hide. Haunt.</h2><p>Destroy a wardstone to expose the enemy elder rift. Destroy the rift to win.</p><ul><li>Move with the left pad. Basic attacks fire automatically in range and cycle through three strikes. The third strike hits hardest. Click or tap an enemy to select it, approach and attack. A gold ring marks your target. Click open ground to move. WASD or the pad cancels pursuit. Space stops the order. Automatic attacks continue when enemies enter range.</li><li>Tap a skill for aim assist, or drag to aim and release. Start with one skill point and choose your first spell. Each level earns another point. Basic ranks unlock at levels 1, 3, 5 and 7; ultimate ranks at 6, 12 and 18. Tap the plus beside a move to learn or upgrade it. Use the spellbook to inspect every move. Your three-hit basic attacks always work.</li><li>Every 40 seconds, the town becomes woods. Buildings and trees block movement and sight. In the woods, hide inside glowing brush. Your first hit from concealment deals 75% extra damage to a creature.</li><li>Use rift gates to cross the map. Tap a neutral guardian to start a camp fight. Guardians retaliate when hit and return home if you lead them too far away. Clear camps for embers, healing and haste. Slay the central beast to recruit the Wild Hunt.</li><li>Spend embers in the Night Market. Combine components into six items. Forge one powerful relic per build. Look for item synergies and counter enemy healing or shields. Choose a build, or track any item. Both teams buy items as they earn embers. Return home to heal. Tap the map to set a direction marker.</li></ul><h2>${h.name}</h2>${h.skills.map((name, i) => `<p><b>${name}</b><br>${h.descriptions[i]}</p>`).join('')}<p>Six minutes maximum. Remaining structure health breaks a stalemate.</p><p class="keyhint">One player and five bots. Click enemy to attack · Click ground to move · Space stop · WASD / arrows · Q / E / C / R skills · K spellbook · F gate · M map · B return · Esc pause</p><button id="got-it" class="primary">Into the dark</button>`);
  $('got-it').onclick = closeSheet;
}
function map() {
  sheet('<h2>The shifting grounds</h2><p class="map-help">Tap a destination to mark your route.</p><canvas id="tactical-map" width="640" height="640" aria-label="Arena map: green allies, red enemies, cyan rift gates"></canvas><p class="map-legend">● Allies &nbsp; <em>● Enemies in sight</em> &nbsp; ◯ Rift gates</p><div class="map-destinations"><button data-destination="hunt">Wild Hunt</button><button data-destination="spirit">Spirit camp</button><button data-destination="gate">Nearest gate</button></div><button id="back-map" class="primary">Back to the hunt</button>');
  const mark = point => { waypoint = point; closeSheet(); };
  $('tactical-map').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); mark({ x: (e.clientX - r.left) / r.width * SIZE, y: (e.clientY - r.top) / r.height * SIZE }); };
  document.querySelectorAll('[data-destination]').forEach(b => b.onclick = () => mark(b.dataset.destination === 'hunt' ? { x: 2400, y: 2400 } : b.dataset.destination === 'spirit' ? state.units.filter(e => e.kind === 'camp' && e.hp > 0).sort((a, b) => distance(player(state), a) - distance(player(state), b))[0] || { x: 1480, y: 2440 } : [...PORTALS].sort((a, b) => distance(player(state), a) - distance(player(state), b))[0]));
  $('back-map').onclick = closeSheet;
  renderer.drawMap(state, $('tactical-map'), waypoint);
}
function shop() { market(state, { sheet, close: closeSheet, changed: () => { try { localStorage.setItem('monster-mash.build.' + selected, player(state).build); } catch {} sound.tone(660, .16); updateUI(); } }); }
function result() {
  resultShown = true; resetInput(); const p = player(state), victory = state.winner === 0;
  try { const saved = JSON.parse(localStorage.getItem('monster-mash.record') || '{"wins":0,"matches":0}'); saved.matches++; if (victory) saved.wins++; localStorage.setItem('monster-mash.record', JSON.stringify(saved)); } catch {}
  sheet(`<h2>${state.winner === -1 ? 'The veil holds' : victory ? 'Legends never die' : 'Lost to the veil'}</h2><div class="result-score">${state.score[0]} : ${state.score[1]}</div><p>${state.reason}</p><dl><dt>Your kills / deaths</dt><dd>${p.kills} / ${p.deaths}</dd><dt>Damage dealt</dt><dd>${Math.round(state.stats.damage).toLocaleString()}</dd><dt>Ambush strikes</dt><dd>${state.stats.ambushes}</dd><dt>Spirit camps</dt><dd>${state.stats.camps}</dd><dt>Final level</dt><dd>${p.level}</dd><dt>Wild Hunts claimed</dt><dd>${state.stats.leviathans}</dd></dl><button id="again" class="primary">Battle again</button><button id="change-hero" class="row-btn">Choose another creature</button>`);
  $('close-sheet').hidden = true; $('again').onclick = () => { closeSheet(); start(); }; $('change-hero').onclick = () => { $('close-sheet').hidden = false; menu(); };
}
function updateUI() {
  const p = player(state), remain = Math.max(0, Math.ceil(LIMIT - state.time));
  dom.clock.textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  $('allied-score').textContent = state.score[0]; $('enemy-score').textContent = state.score[1]; dom.level.textContent = p.level; dom.healthFill.style.width = `${p.hp / p.maxHp * 98}%`; dom.healthText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; dom.xp.style.width = `${(p.level === MAX_LEVEL ? 1 : p.xp / xpForLevel(p.level)) * 100}%`; dom.gold.textContent = Math.floor(p.gold); dom.shop.classList.toggle('available', !!nextPurchase(p));
  const bag = p.inventory.join(','); if ($('inventory').dataset.bag !== bag) { $('inventory').innerHTML = inventoryHTML(p); $('inventory').dataset.bag = bag; }
  const next = nextPurchase(p), goal = nextItem(p); $('quick-buy').disabled = !next; $('quick-buy').dataset.item = next || ''; $('quick-buy').title = next ? `+ ${ITEM[next].name} · ${quote(p, next).cost}` : goal ? `${ITEM[goal].name} · saving ${Math.floor(p.gold)}/${quote(p, goal).cost}` : 'Build complete'; $('quick-buy').textContent = next ? '+' : '·'; $('quick-buy').setAttribute('aria-label', $('quick-buy').title);
  skillButtons.forEach((b,i)=>{
    const rank=p.skillRanks[i],locked=!rank;
    b.querySelector('b').textContent=locked?(i===3&&p.level<6?'LV 6':'LOCK'):p.cd[i]>0?Math.ceil(p.cd[i]):'';
    b.querySelector('b').classList.toggle('locked',locked);
    b.classList.toggle('unlearned',locked);b.classList.toggle('trainable',canLearn(p,i));
    b.setAttribute('aria-disabled',String(locked||p.cd[i]>0||p.hp<=0));
    b.setAttribute('aria-label',`${KITS[p.hero][i].name}. ${locked?'Unlearned':`Rank ${rank}`}. ${p.cd[i]>0?`${Math.ceil(p.cd[i])} seconds cooldown. `:''}${KITS[p.hero][i].description}`);
    const ranks=b.querySelector('.ranks'); if(ranks.dataset.rank!==String(rank)){ranks.innerHTML=Array.from({length:i===3?3:4},(_,j)=>`<i class="${j<rank?'filled':''}"></i>`).join('');ranks.dataset.rank=rank;}
  });
  $('skill-points').textContent=p.skillPoints&&p.skillRanks.some((_,i)=>canLearn(p,i))?`+ ${p.skillPoints} SKILL POINT${p.skillPoints===1?'':'S'}`:'SPELLBOOK';
  $('skill-points').classList.toggle('ready',p.skillPoints>0&&p.skillRanks.some((_,i)=>canLearn(p,i)));
  upgradeButtons.forEach((b,i)=>{
    const eligible=canLearn(p,i);b.hidden=!eligible;b.disabled=!eligible;
    b.setAttribute('aria-label',`${p.skillRanks[i]?'Upgrade':'Learn'} ${KITS[p.hero][i].name} to rank ${p.skillRanks[i]+1} · 1 skill point`);
  });

  dom.respawn.hidden = p.hp > 0; if (p.hp <= 0) dom.respawn.innerHTML = `The veil takes you<strong>${Math.max(1, Math.ceil(p.respawn))}</strong>`;
  const msg = state.messages.at(-1), fresh = msg && state.time - msg.time < 3.8;
  const noticeKey = msg && JSON.stringify([msg.time, msg.title, msg.detail]);
  dom.notice.style.opacity = fresh ? '1' : '0'; if (fresh && dom.notice.dataset.message !== noticeKey) { dom.notice.replaceChildren(); const b = document.createElement('b'), small = document.createElement('small'); b.textContent = msg.title; small.textContent = msg.detail; dom.notice.append(b, small); dom.notice.dataset.message = noticeKey; }
  const until = Math.ceil(SHIFT - state.time % SHIFT), gate = [...PORTALS].sort((a, b) => distance(p, a) - distance(p, b))[0];
  $('realm').textContent = state.phase ? 'DEEP WOODS' : 'MIDNIGHT TOWN';
  $('realm-count').textContent = `${state.phase ? 'Town returns' : 'Woods arrive'} in ${until}s`;
  $('realm-fill').style.width = `${(1 - state.time % SHIFT / SHIFT) * 100}%`;
  $('objective').classList.toggle('shifting', until <= 6);
  $('portal').disabled = distance(p, gate) >= 150 || p.portalCd > 0 || p.hp <= 0;
  $('portal').hidden = distance(p, gate) >= 180 && p.portalCd <= 0;
  $('portal').querySelector('small').textContent = p.portalCd > 0 ? `${Math.ceil(p.portalCd)}s` : 'Jump across the map';
  const focus = state.units.find(e => e.id === p.target && e.hp > 0);
  $('auto-status').textContent = p.hp <= 0 ? 'RESPAWNING' : p.order?.type==='attack' && focus ? `${distance(p,focus)>p.range+focus.radius?'APPROACH':'ATTACK'} · ${focus.name} · ${p.attackVariant+1||1}/3` : p.order?.type==='move' ? 'MOVING · CLICK ENEMY TO ATTACK' : focus ? `AUTO ${p.attackVariant + 1 || 1}/3 · ${BASIC_ATTACKS[p.hero][p.attackVariant || 0]}` : 'AUTO · CLICK ENEMY TO ATTACK';
  $('auto-status').classList.toggle('engaged', !!focus);
  if (waypoint && distance(p, waypoint) < 110) waypoint = null;
  dom.objective.textContent = p.recall ? `Returning in ${Math.ceil(p.recall)}…` : concealed(state, p) ? 'Hidden. Your next strike is an ambush.' : state.towers[1] < 3 ? 'Their rift is exposed. Push with your wisps.' : state.objective ? 'Wild Hunt is awake in the center' : 'Break a wardstone. Open their rift.';
  if (state.time > 18) $('coach').hidden = true;
}
$('inventory').onclick = shop; $('quick-buy').onclick = () => { const id = $('quick-buy').dataset.item; if (id && buy(state, id)) { sound.tone(660, .16); updateUI(); } };
$('map-button').onclick = map; $('portal').onclick = () => { if (running && !paused) portalQueue = true; }; $('play').onclick = start; $('pause').onclick = pause; $('how').onclick = how; $('shop').onclick = shop; $('recall').onclick = () => { if (running && !paused) recallQueue = true; }; $('close-sheet').onclick = closeSheet; $('coach-close').onclick = () => $('coach').hidden = true;
$('sheet').addEventListener('cancel', e => { e.preventDefault(); if (!resultShown) closeSheet(); });
$('sound-menu').onclick = () => { sound.start(); sound.toggle(); updateSound(); }; updateSound();
let rosterFilter='All';
function showRoster(){ $('hero-picks').innerHTML=rosterHTML(selected,rosterFilter);$('roster-count').textContent=`${document.querySelectorAll('[data-hero]').length} legends`;document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>choose(+b.dataset.hero)); }
$('role-filters').innerHTML=ROLES.map(role=>`<button data-role="${role}" aria-pressed="${role==='All'}">${role}</button>`).join('');
document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{rosterFilter=b.dataset.role;document.querySelectorAll('[data-role]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));showRoster();});showRoster();
const joy = $('joystick');
function moveStick(e) { if (e.pointerId !== moveId) return; const x = e.clientX - moveOrigin.x, y = e.clientY - moveOrigin.y, d = Math.max(1, Math.hypot(x, y) / 38); movement.x = x / d / 38; movement.y = y / d / 38; $('thumb').style.transform = `translate(${movement.x * 29}px,${movement.y * 29}px)`; }
joy.addEventListener('pointerdown', e => { if (!running || paused || moveId !== null) return; e.preventDefault(); sound.start(); $('coach').hidden = true; moveId = e.pointerId; moveOrigin = { x: e.clientX, y: e.clientY }; joy.classList.add('active'); joy.setPointerCapture(e.pointerId); moveStick(e); });
joy.addEventListener('pointermove', moveStick);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(type, e => { if (e.pointerId !== moveId) return; moveId = null; movement.x = movement.y = 0; $('thumb').style.transform = ''; joy.classList.remove('active'); });
skillButtons.forEach(b => {
  // Native keyboard and assistive activation do not send a pointer sequence.
  b.addEventListener('click', e => { if (e.detail === 0 && running && !paused && b.getAttribute('aria-disabled') !== 'true') { sound.start(); castQueue = { slot: +b.dataset.skill, aim: null }; } });
  b.addEventListener('pointerdown', e => { if (!running || paused || skillId !== null || b.getAttribute('aria-disabled') === 'true') return; e.preventDefault(); sound.start(); skillId = e.pointerId; skillSlot = +b.dataset.skill; skillOrigin = { x: e.clientX, y: e.clientY }; aim = null; b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointermove', e => { if (e.pointerId !== skillId) return; const x = e.clientX - skillOrigin.x, y = e.clientY - skillOrigin.y; aim = Math.hypot(x, y) > 12 ? { x, y } : null; });
  b.addEventListener('pointerup', e => { if (e.pointerId !== skillId) return; castQueue = { slot: skillSlot, aim }; skillId = null; skillSlot = null; aim = null; });
  for (const event of ['pointercancel', 'lostpointercapture']) b.addEventListener(event, e => { if (e.pointerId === skillId) { skillId = null; skillSlot = null; aim = null; } });
});
$('battle').addEventListener('pointerdown', e => {
  if (!running || paused || player(state).hp<=0 || (e.button!==0&&e.button!==2)) return;
  e.preventDefault();sound.start();$('coach').hidden=true;
  const point=renderer.world(e.clientX,e.clientY),picked=renderer.pick(state,e.clientX,e.clientY);
  const hit=state.units.find(u=>u.id===picked&&u.team!==0&&u.hp>0&&visibleTo(state,0,u))||state.units.filter(u=>u.team!==0&&u.hp>0&&distance(u,point)<Math.max(55,u.radius)&&visibleTo(state,0,u)).sort((a,b)=>distance(a,point)-distance(b,point))[0];
  target=0;orderQueue=hit?{type:'attack',target:hit.id}:e.pointerType==='mouse'?{type:'move',...point}:{type:'stop'};
});
$('battle').addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&running&&!paused)$('battle').style.cursor=renderer.pick(state,e.clientX,e.clientY)?'crosshair':'default';});
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape') { if ($('sheet').open) { if (!resultShown) closeSheet(); } else pause(); return; }
  if (!running || paused || e.repeat) return;
  const key = e.key.toLowerCase(); keys.add(key);
  if(key==='k'){learnSkills();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){cancelOrder(player(state));orderQueue=undefined;target=0;}
  if(key===' '){cancelOrder(player(state));orderQueue={type:'stop'};target=0;}
  const slot = ['q', 'e', 'c', 'r'].indexOf(key); if (slot >= 0) castQueue = { slot, aim: null };
  if (key === 'b') recallQueue = true; if (key === 'f') portalQueue = true; if (key === 'm') map();
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
      const input = { x: movement.x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: movement.y + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')), target, order: orderQueue, cast: command?.slot, aim: command?.aim, recall: recallQueue, portal: portalQueue }; recallQueue = portalQueue = false; orderQueue=undefined;
      const direction = renderer.screenDirection(input.x, input.y); input.x = direction.x; input.y = direction.y; if (input.aim) input.aim = renderer.screenDirection(input.aim.x, input.aim.y);
      const before = command ? p.cd[command.slot] : 0; step(state, input);
      if (command && p.cd[command.slot] > before) sound.skill(command.slot);
      if (p.lastBasicHit > lastAttack) { sound.hit(p.lastBasicVariant); lastAttack = p.lastBasicHit; }
      accumulator -= 1 / 60;
    }
    sound.tick(state.time); uiTime += dt; if (uiTime > .09) { updateUI(); uiTime = 0; }
    if (state.winner !== null && !resultShown) result();
  }
  renderer?.draw(state, dt, !running, aim ? renderer.screenDirection(aim.x, aim.y) : null, waypoint);
  requestAnimationFrame(frame);
}
loadArt().then(art => { renderer = new Renderer($('battle'), $('minimap'), art); $('play').disabled = false; $('play').textContent = 'Start the hunt'; requestAnimationFrame(frame); }).catch(error => { console.error(error); if (/WebGL/i.test(String(error))) $('load-error').innerHTML = '3D graphics are unavailable in this browser. Turn on graphics acceleration or open on another device.'; $('load-error').hidden = false; $('play').textContent = 'Veil unavailable'; });
choose(selected);
// A read-only snapshot supports the existing arcade's QA tooling.
export const snapshot = () => ({ running, paused, time: state.time, winner: state.winner, player: { ...player(state), cd: [...player(state).cd], inventory: [...player(state).inventory] }, phase: state.phase, stats: { ...state.stats }, waypoint: waypoint ? { ...waypoint } : null, units: state.units.length, score: [...state.score], assetReady: !!renderer, graphics: renderer?.stats() });
