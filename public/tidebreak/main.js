import { CENTER, CAMPS } from './world.js';
import { objectiveText, nextObjective, structureProtected, guidanceLane } from './objectives.js';
import { market, inventoryHTML, icon as itemIcon } from './market.js';
import { ITEM, nextItem, nextPurchase, quote } from './items.js';
import { createMatch, step, player, HEROES, trainSkill, cancelOrder, cancelPursuit, announce, buy, setBuild, distance, SIZE, LIMIT, SUDDEN_DEATH, SHIFT, PORTALS, lockTip } from './sim.js';
import { createBattlefield } from './render3d/startup.js';
import { visibleTo, concealed } from './world.js';
import { Sound } from './audio.js';
import { KITS, canLearn, rankGate, xpForLevel, MAX_LEVEL, cooldownFor } from './abilities.js';
import { skillCard } from './skill-card.js';
import { BASIC_ATTACKS } from './basic-attacks.js';
import { spellbookHTML, spellDetail } from './spellbook.js';
import { rosterHTML, heroPreviewHTML, selectionSpellArt, hudSpellArt, ROLES, SELECTION_KEYS, portraitURL, mountMatchPortraits, updateMatchPortraits } from './roster.js';
import { HERO_IDENTITIES, identitySkill, assignIdentities } from './hero-identities.js';
import { mountLineup } from './hero-lineup.js';
import { pointerAction, movementPointer, abilityPointers, screenMovementPointer } from './pointer-action.js';
import { wheelZoomFactor } from './camera-zoom.js';
import { paginatePanel } from './panel-pager.js';
import { manaCost, canAfford, canReturn } from './combat-rules.js';
import { cursorSkillAim, dragSkillAim, skillAimPreview } from './skill-aim.js';
import { followUpFeedback } from './combat-feedback.js';
import { spellBlocked } from './combat-state.js';
import { draftPlan, runDraft } from './draft.js';
import { mountDifficulty, applyDifficulty, savedDifficulty } from './difficulty-ui.js';
import { Announcer } from './announcer.js';
import { PerfMeter } from './perf.js';
import { createFirstMatchGuide } from './first-match.js';
import { castFeedback } from './cast-feedback.js';
import { createShoreTelemetry } from './telemetry.js';
import { TeamChat } from './team-chat.js';
import { RecapView } from './death-recap.js';
import { ImpactFeel } from './impact-feel.js';
import { objectiveClock, clockText } from './objective-clock.js';
const $ = id => document.getElementById(id);
const sound = new Sound(), keys = new Set();
const desktopInput = matchMedia('(hover: hover) and (pointer: fine)');
let selectedIdentity=0;
let state = assignIdentities(createMatch(1),selectedIdentity), renderer, selected = 1, running = false, paused = false, last = performance.now(), accumulator = 0, uiTime = 0, resultShown = false, aim = null, cursor = null, orderQueue, castQueue, recallQueue = false, cancelRecallQueue = false, target = 0, movementControl, screenMovementControl, abilityControl, lastAttack = 0, lastCast = -1, portalQueue = false, waypoint = null;
const movement = { x: 0, y: 0 };
let currentLane = 1, castFeedbackUntil = 0;
const telemetry = createShoreTelemetry({context:()=>({build_id:'shore-playability-1',performance_tier:renderer?.quality!==undefined?String(renderer.quality):undefined})});
const firstMatch = createFirstMatchGuide({ inputType: () => desktopInput.matches ? 'mouse' : 'touch', onStep: step => telemetry.action('tutorial', step) });
function controlHelp() { return desktopInput.matches ? 'Click an enemy to select and attack. Click ground to move. WASD or arrows move. Space stops. Q / E / C / R cast. K opens the spellbook.' : 'Drag on the battlefield or use the left pad to move. Tap an enemy to select and attack. Drag a spell to aim; release to cast. Return to its center to cancel.'; }
function refreshGuide() {
  const v = firstMatch.view();
  $('coach').hidden = !v.active || !running || paused || player(state).hp <= 0 || !aimStatus.hidden;
  $('coach').dataset.step = v.step || '';
  $('coach-title').textContent = v.title || '';
  $('coach-text').textContent = v.text || '';
}
function recallAction() { if (player(state).recall > 0) cancelRecallQueue = true; else recallQueue = true; }
function rejectCast(slot, feedback = castFeedback(state, player(state), slot)) {
  if (feedback.outcome !== 'rejected') return;
  castFeedbackUntil = state.time + 2.5;
  aimStatus.hidden = false; aimStatus.textContent = feedback.message; aimStatus.classList.add('rejected');
  telemetry.action('cast', { slot, outcome: 'rejected', reason: feedback.reason });
  refreshGuide();
}
let plan = null, draft = null, rallyQueue = null, rallyReadyAt = 0, soundWokeAt = -1e9, gpuNoteClosed = false;
const perf = new PerfMeter($('perf'));
const announcer = new Announcer(sound, $('hud')), teamChat = new TeamChat(sound, $('hud'));
// Desktop camera: the view follows the hero and the mouse pushes it left or right; hold the minimap to look there; hold
// Space to centre the view on the hero.
let mouse = null, minimapDrag = null, lookX = 0;
const recenterButton = Object.assign(document.createElement('button'), { id: 'recenter', hidden: true, innerHTML: '⌖ Back to hero <kbd>Space</kbd>' });
recenterButton.setAttribute('aria-label', 'Return the view to your hero'); $('hud').append(recenterButton);
function recenter() { renderer?.recenter(); recenterButton.hidden = true; }
function enterFullscreen() {
  let wanted = true; try { wanted = localStorage.getItem('tidebreak.fullscreen') !== 'off'; } catch {}
  const root = document.documentElement;
  if (wanted && !document.fullscreenElement && root.requestFullscreen) root.requestFullscreen({ navigationUI: 'hide' }).then(lockEscape).catch(() => {});
}
// In full screen the browser takes Esc to leave full screen. Where the Keyboard Lock API exists (Chrome, Edge), Esc
// comes to the game instead and a long press leaves full screen. Elsewhere, leaving full screen opens the menu, which
// offers "Back to full screen" and "Keep playing windowed". Nothing forces full screen back.
let fullscreenLeft = false, leavingFullscreen = false;
function lockEscape() { try { navigator.keyboard?.lock?.(['Escape']).catch(() => {}); } catch {} }
function saveFullscreen(on) { try { localStorage.setItem('tidebreak.fullscreen', on ? 'on' : 'off'); } catch {} }
// The player's own choice from the menu: it saves the preference for the next match too.
function requestFullscreen() { saveFullscreen(true); document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(lockEscape).catch(() => {}); }
function playWindowed() { saveFullscreen(false); fullscreenLeft = false; if (document.fullscreenElement) { leavingFullscreen = true; document.exitFullscreen().catch(() => { leavingFullscreen = false; }); } }
document.addEventListener('fullscreenchange', () => {
  const mode = $('screen-mode'); if (mode) mode.textContent = document.fullscreenElement ? 'Play windowed' : 'Play full screen';
  if (document.fullscreenElement) { fullscreenLeft = false; lockEscape(); return; }
  try { navigator.keyboard?.unlock?.(); } catch {}
  if (leavingFullscreen) { leavingFullscreen = false; return; }
  // Chrome leaves full screen about two seconds into a held Esc, after the first press has opened the menu: the open
  // menu is drawn again with the windowed choice.
  if (running && !resultShown) { fullscreenLeft = true; if (!paused || $('screen-mode') || $('resume')) pause(); }
});
const dom = { clock: $('clock'), level: $('level'), healthFill: $('health-fill'), healthText: $('health-text'), xp: $('xp-fill'), gold: $('gold'), shop: $('shop'), notice: $('notice'), respawn: $('respawn'), objective: $('objective-sub') };
const skillButtons = [...document.querySelectorAll('[data-skill]')];
// Hover and keyboard focus inspect live skill details. Touch inspection uses the spellbook.
skillCard(skillButtons, slot => {
  if (!running) return null;
  const p = player(state), a = identitySkill(selectedIdentity, slot), rank = p.skillRanks[slot], cost = slot===0&&canReturn(state,p)?0:manaCost(p, slot);
  const cd = Math.round(cooldownFor({ ...p, skillRanks: p.skillRanks.map((r, i) => i === slot ? Math.max(1, r) : r) }, slot) * 10) / 10;
  const feedback=castFeedback(state,p,slot);
  const status = !rank ? (canLearn(p,slot) ? 'Not learned yet. Press + to learn it.' : `Learn at level ${rankGate(slot,0)}`) : feedback.outcome==='accepted' ? feedback.returning ? 'Return to your decoy' : 'Ready' : feedback.message;
  return { name: a.name, key: skillButtons[slot].querySelector('kbd')?.textContent || '', rank, maxRank: slot === 3 ? 3 : 4, cost, cooldown: cd, tags: a.tags, description: a.description, status, ready: feedback.outcome === 'accepted' };
});
skillButtons.forEach(b=>b.insertAdjacentHTML('beforeend','<small class="mana-cost"></small>'));
// Combat feel HUD: death recap, objective timers and the edge flash for damage taken.
const combatFeelStyle=document.createElement('link');combatFeelStyle.rel='stylesheet';combatFeelStyle.href=new URL('./combat-feel.css',import.meta.url).href;document.head.append(combatFeelStyle);
const recapView=new RecapView($('hud')),feel=new ImpactFeel(),hurtEdge=Object.assign(document.createElement('div'),{id:'hurt-edge'}),objectiveClockEl=Object.assign(document.createElement('div'),{id:'objective-clock'});
hurtEdge.setAttribute('aria-hidden','true');$('hud').prepend(hurtEdge);$('hud').append(objectiveClockEl);
let lastIntent,lastHits=0,huntCue=null;
const skillControlsStyle=document.createElement('link');skillControlsStyle.rel='stylesheet';skillControlsStyle.href=new URL('./skill-controls.css',import.meta.url).href;document.head.append(skillControlsStyle);
// The desktop command bar loads last, so its layout wins over the thumb fan on mouse-and-keyboard screens.
const commandBarStyle=document.createElement('link');commandBarStyle.rel='stylesheet';commandBarStyle.href=new URL('./command-bar.css',import.meta.url).href;document.head.append(commandBarStyle);
const playabilityStyle=document.createElement('link');playabilityStyle.rel='stylesheet';playabilityStyle.href=new URL('./playability.css',import.meta.url).href;document.head.append(playabilityStyle);
const aimStatus=document.createElement('output');aimStatus.id='skill-aim-status';aimStatus.setAttribute('role','status');aimStatus.setAttribute('aria-live','polite');aimStatus.hidden=true;$('skill-points').before(aimStatus);
skillButtons.forEach(b=>b.setAttribute('aria-describedby','skill-aim-status'));
function updateAimStatus(status){
  skillButtons.forEach((b,i)=>{b.classList.toggle('aiming',status?.slot===i);b.classList.toggle('aim-cancelled',status?.slot===i&&status.cancelled);});
  if(status) castFeedbackUntil=0;
  if(!status&&state.time<castFeedbackUntil){refreshGuide();return;}
  aimStatus.classList.remove('rejected');
  aimStatus.hidden=!status;
  const text=status?.cancelled?'Release to cancel.':status?'Release to cast. Return to center to cancel.':'';
  if(aimStatus.textContent!==text)aimStatus.textContent=text;
  aimStatus.classList.toggle('cancelled',!!status?.cancelled);
  refreshGuide();
}
function resetInput() { cancelOrder(player(state)); target=0; orderQueue=undefined; keys.clear(); movement.x = movement.y = 0; movementControl?.reset(); screenMovementControl?.reset(); abilityControl?.reset(); castQueue = undefined; recallQueue = cancelRecallQueue = portalQueue = false; aim = null; $('thumb').style.transform = ''; }
function closeSheet() {
  if (renderer?.lost) return;
  $('sheet').close(); paused = false; resetInput(); refreshGuide();
}
function sheet(html) { $('sheet').classList.remove('market','spellbook-sheet','map-sheet'); paused = running; resetInput(); refreshGuide(); $('sheet-content').innerHTML = html; if (!$('sheet').open) $('sheet').showModal(); requestAnimationFrame(()=>{if(!$('sheet').classList.contains('spellbook-sheet')&&!$('sheet').classList.contains('market')&&!$('sheet').classList.contains('map-sheet'))paginatePanel($('sheet-content'));}); }
function pause() {
  if (renderer?.lost) return;
  if (!running || resultShown) return;
  // After full screen ended during play, the menu asks how to go on. Nothing returns to full screen without a choice.
  const top = fullscreenLeft ? '<button id="fullscreen-back" class="primary">Back to full screen</button><button id="resume" class="row-btn">Keep playing windowed</button>' : '<button id="resume" class="primary">Keep playing</button>';
  const canFullscreen = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const screen = fullscreenLeft || !canFullscreen ? '' : `<button id="screen-mode" class="row-btn">${document.fullscreenElement ? 'Play windowed' : 'Play full screen'}</button>`;
  const book = `<button id="menu-spellbook" class="row-btn">Spellbook${desktopInput.matches ? ' <kbd>K</kbd>' : ''}</button>`;
  sheet(`<h2>The hunt can wait</h2>${top}<button id="return-home" class="row-btn">Return home to heal</button>${book}${soundRowsHTML('pause')}${screen}<button id="perf-toggle" class="row-btn"></button><button id="quit" class="row-btn">Choose another creature</button><button id="menu-guide" class="row-btn">Control guide</button><p class="keyhint">${controlHelp()} F rift · G rally team · M map · B Recall · Esc menu</p>`);
  $('resume').onclick = () => { if (fullscreenLeft) playWindowed(); closeSheet(); };
  if ($('fullscreen-back')) $('fullscreen-back').onclick = () => { requestFullscreen(); closeSheet(); };
  if ($('screen-mode')) $('screen-mode').onclick = () => { if (document.fullscreenElement) playWindowed(); else requestFullscreen(); closeSheet(); };
  $('return-home').onclick = () => { closeSheet(); recallQueue = true; };
  $('menu-guide').onclick = () => { closeSheet(); firstMatch.show(player(state)); refreshGuide(); };
  if ($('menu-spellbook')) $('menu-spellbook').onclick = learnSkills;
  wireSoundRows('pause'); wirePerfRow($('perf-toggle')); $('quit').onclick = menu;
}
// Sound controls name the action, not the state, so a player who hears nothing and presses one does not mute the game.
const SOUND_LABELS = {
  sound: on => on ? 'Mute all sound' : 'Sound is off · Turn it on',
  voice: on => on ? 'Mute the announcer voice' : 'Announcer voice is off · Turn it on',
  music: on => on ? 'Mute the music' : 'Music is off · Turn it on',
};
function soundRowsHTML(id) { return `<button id="${id}-sound" class="row-btn"></button><button id="${id}-voice" class="row-btn"></button><button id="${id}-music" class="row-btn"></button><button id="${id}-test" class="row-btn">Test sound</button>`; }
function wireSoundRows(id) {
  const state = { sound: () => sound.on, voice: () => sound.voiceOn, music: () => sound.musicOn }, toggle = { sound: () => sound.toggle(), voice: () => sound.toggleVoice(), music: () => sound.toggleMusic() };
  for (const kind of Object.keys(state)) {
    const b = $(`${id}-${kind}`), label = () => { b.textContent = SOUND_LABELS[kind](state[kind]()); }; label();
    b.onclick = () => { sound.start(); const on = toggle[kind](); label(); updateSound(); if (on) confirmSound(); };
  }
  $(`${id}-test`).onclick = () => soundTestPanel(id === 'pause' ? pause : gameSettings, $(`${id}-test`));
}
function confirmSound() { if (!sound.clip('ui-confirmation', { gain: .9 })) sound.tone(880, .15, .05); }
function turnSoundOn() { sound.start(); if (!sound.on) sound.toggle(); updateSound(); confirmSound(); }
// The game measures its own output while it plays a chime. If the level is there and the player still hears nothing,
// the sound is stopped outside the game, and the panel says where to look. The panel opens after the measurement, so
// the menu pager lays it out with its full text.
async function soundTestPanel(back, button) {
  if (button) { button.disabled = true; button.textContent = 'Playing a test chime…'; }
  const result = await sound.test();
  if (!$('sheet').open) return; // the player closed the menu meanwhile
  const muted = result.state === 'muted', heard = result.peak > .01;
  const message = muted ? 'Sound is off in this game.'
    : heard ? `The game is playing sound now (level ${Math.round(result.peak * 100)}%). If you heard nothing, the sound stops outside the game. Check the speaker icon on this browser tab (leave full screen, right-click the tab, choose Unmute site), this site's sound setting next to the address bar, your system volume mixer, and your output device. A monitor connected by DisplayPort or HDMI often becomes the default output.`
    : `The game could not start its sound (audio state: ${result.state}). Click anywhere in the game, then press Test again.`;
  sheet(`<h2>Test sound</h2><p id="sound-test-result" class="sound-test${heard ? '' : ' silent'}">${message}</p>${muted ? '<button id="sound-test-on" class="primary">Turn sound on</button>' : ''}<button id="sound-test-again" class="row-btn">Test again</button><button id="sound-test-back" class="${muted ? 'row-btn' : 'primary'}">Back</button>`);
  if (muted) $('sound-test-on').onclick = () => { turnSoundOn(); soundTestPanel(back); };
  $('sound-test-again').onclick = () => soundTestPanel(back, $('sound-test-again'));
  $('sound-test-back').onclick = back;
}
function wirePerfRow(b) { const label = () => { b.textContent = perf.on ? 'Hide the performance readout' : 'Show the performance readout'; }; label(); b.onclick = () => { perf.toggle(); label(); }; }
function menu() { if (running && !resultShown) telemetry.abandon(state); fullscreenLeft = false; sound.silence(); sound.setScene('menu'); draft?.cancel(); autoPaused = false; autoPauseNote.hidden = true; closeSheet(); running = false; resultShown = false; $('menu').hidden = false; $('hud').hidden = true; state = assignIdentities(createMatch(selected),selectedIdentity); sound.next = 0; lineup.refresh(); }
function updateSound() {
  const b = $('hud-sound'); b.setAttribute('aria-pressed', String(sound.on)); b.setAttribute('aria-label', 'Sound'); b.title = sound.on ? 'Sound on. Click to mute' : 'Sound off. Click to turn on';
  for (const chip of document.querySelectorAll('.muted-chip')) chip.hidden = sound.on;
}
function choose(identityId) {
  const h=HERO_IDENTITIES[identityId];if(!h)return;
  selectedIdentity=identityId;selected=h.kit;
  try { localStorage.setItem('tidebreak.hero', String(identityId)); } catch {}
  $('hero-name').textContent=h.name;$('ready-legend').textContent=`${h.name} · ${h.subtitle}`;$('hero-role').textContent=h.subtitle;$('hero-note').textContent=h.note;
  $('hero-tags').innerHTML=h.tags.map(tag=>`<span>${tag}</span>`).join('');
  $('hero-art').src=portraitURL(h.slug,'full');$('hero-art').alt=`${h.name}, ${h.subtitle}`;
  document.querySelectorAll('[data-hero]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.hero===identityId)));
  $('menu').style.setProperty('--hero-color',h.color);$('hero-preview').innerHTML=heroPreviewHTML(identityId);
  const spellNote=$('hero-spell-note');spellNote.hidden=false;
  const explainSkill=slot=>{
    const a=identitySkill(identityId,slot),cost=manaCost({hero:h.kit,skillRanks:[1,1,1,1]},slot);
    document.querySelectorAll('#hero-preview [data-hero-spell]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.heroSpell===slot)));
    spellNote.innerHTML=`${selectionSpellArt(identityId,slot,'detail-spell-art')}<strong>${a.name}</strong><kbd class="detail-key">${SELECTION_KEYS[slot]}</kbd><div class="detail-copy"><span>${a.description}</span><small>${a.tags}<br>Cooldown: ${a.cooldown}s<br>Mana cost: ${cost}${slot===3?'<br>Unlocks at level 6':''}</small></div>`;
  };
  document.querySelectorAll('#hero-preview [data-hero-spell]').forEach(b=>{const slot=+b.dataset.heroSpell;b.onpointerenter=()=>explainSkill(slot);b.onfocus=()=>explainSkill(slot);b.onclick=()=>{
    const a=identitySkill(identityId,slot);explainSkill(slot);
    sheet(`<h2>${a.name}</h2><div class="selection-spell-art">${heroPreviewHTML(identityId,slot)}</div><p>${a.description}</p><p class="keyhint">${a.tags} · ${a.cooldown}s cooldown<br>${slot===3?'Ultimate: levels 6, 12, 18':'Basic ranks: levels 1, 3, 5, 7'}</p><button id="back-preview" class="primary">Back to heroes</button>`);
    document.querySelectorAll('.selection-spell-art [data-hero-spell]').forEach(v=>v.onclick=()=>{closeSheet();document.querySelector(`#hero-preview [data-hero-spell="${v.dataset.heroSpell}"]`).click();});$('back-preview').onclick=closeSheet;
  };
  });
  explainSkill(1);
}
function quickStart() {
  if ($('play').disabled) return;
  sound.start(); enterFullscreen(); draft?.cancel(); draft = null; plan = null;
  $('draft').hidden = true; start();
}
// Inspect the draft board; the finished draft starts the match with that lineup.
function startDraft() {
  if ($('play').disabled) return;
  if($('sheet').open)closeSheet();
  // Sound starts in the click before full screen, so the draft music plays under every autoplay rule.
  sound.start(); sound.setScene('draft'); enterFullscreen(); draft?.cancel(); $('menu').hidden = true; $('hud').hidden = true; $('draft').hidden = false;
  plan = draftPlan(selectedIdentity, Date.now() >>> 0, ['ally', savedDifficulty()]); sound.voiceClip('choose-your-character', .1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  draft = runDraft($('draft'), plan, { sound, reduced, onDone: () => { $('draft').hidden = true; draft = null; start(); }, onBack: () => { $('draft').hidden = true; draft = null; $('menu').hidden = false; sound.setScene('menu'); } });
  $('draft-go').focus({ preventScroll: true });
}
function start() {
  sound.start(); sound.next = 0; plan ||= draftPlan(selectedIdentity, Date.now() >>> 0, ['ally', savedDifficulty()]);
  state = applyDifficulty(assignIdentities(createMatch(selected, plan.seed, plan.lineup), selectedIdentity, plan.picks), $('difficulty-badge')); rallyReadyAt = 0; rallyQueue = null;
  announcer.reset(state); teamChat.reset(state, plan); recenter(); sound.setScene('match'); sound.horn(); sound.line('prepare-yourself', 'Battle begins. Defend the shore.', .4); sound.clip('fight', { gain: 1.25, delay: 2.2, reverb: .2 }); try { setBuild(state, localStorage.getItem('monster-mash.build.' + selected)); } catch {} perf.reset(); updateSound(); $('gpu-note').hidden = !perf.software || gpuNoteClosed; if (!$('gpu-note').hidden) setTimeout(() => { $('gpu-note').hidden = true; }, 20000); running = true; paused = false; resultShown = false; currentLane = 1; castFeedbackUntil = 0; target = 0; waypoint = null; accumulator = 0; lastAttack = 0; lastCast = -1; resetInput();
  $('menu').hidden = true; $('hud').hidden = false; $('coach').hidden = false; $('close-sheet').hidden = false;
  for (let i = 0; i < 4; i++) { const a=identitySkill(selectedIdentity,i);skillButtons[i].setAttribute('aria-label',a.name+'. '+a.description);skillButtons[i].querySelector('span').textContent=a.name.toUpperCase(); }
  if (renderer) renderer.cam = { x: player(state).x, y: player(state).y };
  $('controls').style.setProperty('--hero-color',HEROES[selected].color);
  skillButtons.forEach((b,i)=> {
    b.querySelector('svg')?.remove();b.querySelector('.hud-spell-art')?.remove();
    b.insertAdjacentHTML('afterbegin',hudSpellArt(selectedIdentity,i,'hud-spell-art'));
  });
  abilityCluster.classList.remove('upgrade-mode');
  telemetry.start(state, { hero: HERO_IDENTITIES[selectedIdentity].slug, difficulty: savedDifficulty(), input_type: desktopInput.matches ? 'mouse' : 'touch' });
  firstMatch.begin(player(state));
  if(firstMatch.view().active) state.messages=state.messages.filter(m=>m.title!=='Choose your first spell');
  mountMatchPortraits(state,selectedIdentity); updateUI(); refreshGuide();
}
function learnSkills() {
  if (!running || resultShown) return;
  const p=player(state);let detailTab='overview',selectedSpell=p.skillRanks.findIndex((r,i)=>canLearn(p,i));if(selectedSpell<0)selectedSpell=0;
  const show=()=>{
    sheet(spellbookHTML(p,selectedSpell,detailTab));$('sheet').classList.add('spellbook-sheet');
    document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{selectedSpell=+b.dataset.preview;detailTab='overview';show();document.querySelector(`[data-preview="${selectedSpell}"]`).focus({preventScroll:true});});
    document.querySelectorAll('[data-spell-tab]').forEach(b=>b.onclick=()=>{detailTab=b.dataset.spellTab;show();document.querySelector(`[data-spell-tab="${detailTab}"]`).focus({preventScroll:true});});
    $('train-selected').onclick=()=>{if(trainSkill(p,selectedSpell)){const name=identitySkill(selectedIdentity,selectedSpell).name,text=`${name} · Rank ${p.skillRanks[selectedSpell]}`;announce(state,text,'Spell trained. Return to the hunt.');sound.tone(780,.16);updateUI();show();$('training-feedback').textContent=`Learned ${name}, rank ${p.skillRanks[selectedSpell]}.`;document.querySelector(`[data-preview="${selectedSpell}"]`).focus({preventScroll:true});}};
    $('back-skills').onclick=closeSheet;
  };show();
}
const abilityCluster=document.querySelector('.abilities');
function trainFromHUD(slot){
  const p=player(state);
  if(!canLearn(p,slot)||!trainSkill(p,slot))return false;
  abilityCluster.classList.remove('upgrade-mode');
  const name=identitySkill(selectedIdentity,slot).name;
  announce(state,`${name} · Rank ${p.skillRanks[slot]}`,'Ability upgraded while movement stays active.');
  sound.tone(780,.16);updateUI();
  return true;
}
pointerAction($('skill-points'),()=>{
  const p=player(state),eligible=p.skillRanks.map((_,i)=>i).filter(i=>canLearn(p,i));
  if(p.skillPoints>0&&eligible.length){
    abilityCluster.classList.toggle('upgrade-mode');
    announce(state,abilityCluster.classList.contains('upgrade-mode')?'Choose a skill':'Upgrade mode off',abilityCluster.classList.contains('upgrade-mode')?'Tap the full ability icon to spend the point. You can keep moving.':'Tap the point button when you want to upgrade.');
    updateUI();
    return;
  }
  learnSkills();
},()=>running&&!paused&&!resultShown);
const upgradeButtons=[...document.querySelectorAll('[data-upgrade]')];
upgradeButtons.forEach(b=>pointerAction(b,()=>trainFromHUD(+b.dataset.upgrade),()=>running&&!paused&&!resultShown&&!b.disabled));

function how() {
  const h = {...HEROES[selected],...HERO_IDENTITIES[selectedIdentity],descriptions:[0,1,2,3].map(i=>identitySkill(selectedIdentity,i).description)};
  sheet(`<h2>Hunt. Hide. Haunt.</h2><p>Each lane has three wards: outer, middle and inner. Break them in order. When any inner ward falls, the two rift guardians can be hit. Break both guardians to expose the enemy elder rift. Destroy the rift to win.</p><ul><li>Drag anywhere on the battlefield to move. Basic attacks fire automatically in range and cycle through three strikes. The third strike hits hardest. Click or tap an enemy to select it, approach and attack. A gold ring marks your target. ${desktopInput.matches ? "Click open ground to move." : "Tap open ground to stop. Drag the battlefield to move."} WASD or the pad cancels pursuit while keeping your selected enemy. Space stops the order. Automatic attacks continue when enemies enter range.</li><li>Tap a skill for aim assist, or drag to aim and release. Short drags place ground spells nearby. Return your finger to the button center to cancel an aimed skill. On desktop, point at the battlefield and press Q, E, C or R. Start with one skill point and choose your first spell. Each level earns another point. Basic ranks unlock at levels 1, 3, 5 and 7; ultimate ranks at 6, 12 and 18. When a skill point is ready, tap the point pill, then tap the full ability icon to learn or upgrade it without stopping movement. Use the spellbook to inspect every move. Your three-hit basic attacks always work.</li><li>Watch your mana. Each spell costs mana; the blue bar refills over time and faster at home. Heavy casts briefly hold your position. Red cast warnings lock their aim: move out, or stun or silence the caster. Bots combine marks with finishers and save spells for dangerous fights. Finish lane wisps for extra embers. Stay near your wave to gain experience. Repeated tower hits grow stronger, so push with a wave and retreat after attacking a hero under its tower. Wards and rifts take little hero damage unless your wisps are at them, and a rift heals while no enemy wisp is at it. Outer wards are fortified for the first three and a half minutes. Guardians slam the ground: a circle shows first. Step out, then hit the guardian while it recovers.</li><li>Every 40 seconds, the town becomes woods. Buildings and trees block movement and sight. In the woods, hide inside glowing brush. Your first hit from concealment deals 75% extra damage to a creature.</li><li>Your two teammates and the enemy three are drafted before each match. Teammates call fights in chat and rotate to help. Press G or Rally to call them to you, or use Call team here on the map. Pings and hero markers show on the minimap; a red pulse marks a ward under attack.</li><li>Use rift gates to cross the map. A gate near your base sends you to your river gate on the side you face. Tap a neutral guardian to start a camp fight. Guardians retaliate when hit and return home if you lead them too far away. Clear camps for embers, healing and haste. Slay the central beast to recruit the Wild Hunt.</li><li>Spend embers in the Night Market. Combine components into six items. Forge one powerful relic per build. Look for item synergies and counter enemy healing or shields. Choose a build, or track any item. Both teams buy items as they earn embers. Return home to heal. Tap the map to travel to a destination or push the next tower.</li></ul><h2>${h.name}</h2>${h.skills.map((name, i) => `<p><b>${name}</b><br>${h.descriptions[i]}</p>`).join('')}<p>The clock at the top counts down. When it runs out after 14 minutes, sudden death starts: every ward and rift is open and takes more damage, home stops healing and deaths last longer. The clock then turns red and counts down the last 3 minutes. When it runs out again, the team that broke more structures wins.</p><p class="keyhint">Sound: announcer kill calls by TripleSnail, recorded by Antti Saari (CC BY 3.0). Voice, impact and interface sounds by Kenney (CC0). Music (CC0): A Legend Will Rise by codemanu, Prepare to Fight by Basil, Unexplored by TAD and Bo Jingles, Determined Pursuit by Emma_MA, Victory Theme by cynicmusic, Lament of the War by Cethiel.</p><p class="keyhint">One player and five bots. ${controlHelp()} F gate · G rally team · M map · B return · Esc menu<br>The view follows your hero; move the mouse left or right to push the view that way · Click the minimap to look there, right-click to move there · Space returns the view to your hero</p><button id="got-it" class="primary">Into the dark</button>`);
  $('got-it').onclick = closeSheet;
}
function map() {
  sheet('<h2>The shifting grounds</h2><p class="map-help">Choose a destination. Your hero will follow the route.</p><canvas id="tactical-map" width="640" height="640" aria-label="Arena map: green allies, red enemies, cyan rift gates"></canvas><p class="map-legend">● Allies &nbsp; <em>● Enemies in sight</em> &nbsp; ◌ Last seen &nbsp; ◯ Rift gates &nbsp; ! Fight or ward alarm</p><div class="map-destinations"><button data-destination="ward">Next tower</button><button data-destination="hunt">Wild Hunt</button><button data-destination="spirit">Spirit camp</button><button data-destination="gate">Nearest gate</button><button data-destination="rally">Call team here</button></div><button id="back-map" class="primary">Back to the hunt</button>');
  $('sheet').classList.add('map-sheet');
  const mark = (point, enemy) => { waypoint = point; closeSheet(); if(player(state).hp>0)orderQueue=enemy?{type:'attack',target:enemy.id}:{type:'move',...point}; };
  $('tactical-map').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); mark({ x: (e.clientX - r.left) / r.width * SIZE, y: (e.clientY - r.top) / r.height * SIZE }); };
  document.querySelectorAll('[data-destination]').forEach(b => b.onclick = () => {
    const kind=b.dataset.destination, p=player(state), ward=nextObjective(state,1,currentLane=guidanceLane(p,currentLane));
    if(kind==='rally'){closeSheet();callRally(waypoint||{x:p.x,y:p.y});return;}
    const destination=kind==='ward'?ward:kind==='hunt'?CENTER:kind==='spirit'?state.units.filter(e=>e.kind==='camp'&&e.hp>0).sort((a,b)=>distance(p,a)-distance(p,b))[0]||CAMPS[0]:[...PORTALS].sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(destination)mark({x:destination.x,y:destination.y},kind==='ward'?ward:null);
  });
  $('back-map').onclick = closeSheet;
  renderer.drawMap(state, $('tactical-map'), waypoint);
}
function shop() { market(state, { sheet, close: closeSheet, changed: () => { try { localStorage.setItem('monster-mash.build.' + selected, player(state).build); } catch {} sound.coin(); updateUI(); } }); }
function result() {
  resultShown = true; telemetry.end(state); resetInput(); const p = player(state), victory = state.winner === 0; sound.setScene(victory ? 'victory' : 'defeat');
  try { const saved = JSON.parse(localStorage.getItem('monster-mash.record') || '{"wins":0,"matches":0}'); saved.matches++; if (victory) saved.wins++; localStorage.setItem('monster-mash.record', JSON.stringify(saved)); } catch {}
  sheet(`<h2>${state.winner === -1 ? 'The veil holds' : victory ? 'Legends never die' : 'Lost to the veil'}</h2><div class="result-score">${state.score[0]} : ${state.score[1]}</div><p>${state.reason}</p><dl><dt>Your kills / deaths</dt><dd>${p.kills} / ${p.deaths}</dd><dt>Wisps finished</dt><dd>${p.lastHits}</dd><dt>Damage dealt</dt><dd>${Math.round(state.stats.damage).toLocaleString()}</dd><dt>Ambush strikes</dt><dd>${state.stats.ambushes}</dd><dt>Spirit camps</dt><dd>${state.stats.camps}</dd><dt>Final level</dt><dd>${p.level}</dd><dt>Wild Hunts claimed</dt><dd>${state.stats.leviathans}</dd></dl><button id="again" class="primary">Battle again</button><button id="change-hero" class="row-btn">Choose another creature</button>`);
  $('close-sheet').hidden = true; $('again').onclick = () => { closeSheet(); $('close-sheet').hidden = false; plan = null; $('hud').hidden = true; running = false; resultShown = false; quickStart(); }; $('change-hero').onclick = () => { $('close-sheet').hidden = false; menu(); };
}
function updateUI() {
  // The clock counts down to sudden death, then to the hard limit.
  const p = player(state), remain = Math.max(0, Math.ceil((state.suddenDeath ? LIMIT : SUDDEN_DEATH) - state.time)); dom.clock.classList.toggle('sudden-death', !!state.suddenDeath);
  dom.clock.textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  $('allied-score').textContent = state.score[0]; $('enemy-score').textContent = state.score[1]; dom.level.textContent = p.level; dom.healthFill.style.width = `${p.hp / p.maxHp * 98}%`; dom.healthText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; dom.xp.style.width = `${(p.level === MAX_LEVEL ? 1 : p.xp / xpForLevel(p.level)) * 100}%`; dom.gold.textContent = Math.floor(p.gold); dom.shop.classList.toggle('available', !!nextPurchase(p));
  $('mana-fill').style.width=`${p.mana/p.maxMana*98}%`;$('mana-text').textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;$('mana-text').setAttribute('aria-label',`Mana ${Math.floor(p.mana)} of ${p.maxMana}`);
  const bag = p.inventory.join(','); if ($('inventory').dataset.bag !== bag) { $('inventory').innerHTML = inventoryHTML(p); $('inventory').dataset.bag = bag; }
  updateQuickBuy(p);
  const followUp=followUpFeedback(state,p,{visible:renderer?.visible});
  const upgradeMode=abilityCluster.classList.contains('upgrade-mode');
  skillButtons.forEach((b,i)=>{
    const eligible=canLearn(p,i),rank=p.skillRanks[i],locked=!rank,returnReady=i===0&&canReturn(state,p),empty=!canAfford(p,i)&&!returnReady,blocked=spellBlocked(state,p,i)||!!p.castIntent||p.recoveryUntil>state.time;
    const queued=p.queuedCast?.slot===i,blockedLabel=queued?'QUEUED':p.castIntent?'CAST':p.recoveryUntil>state.time?'WAIT':p.stun>0?'STUN':p.fear>0?'FEAR':p.silencedUntil>state.time?'SILENCE':p.hp<=0?'':blocked?'ROOT':'';
    b.querySelector('b').textContent=locked?(i===3&&p.level<6?'LV 6':'LOCK'):blocked?blockedLabel:returnReady?'BACK':p.cd[i]>0?Math.ceil(p.cd[i]):empty?'MANA':'';
    b.querySelector('b').classList.toggle('locked',locked);
    b.classList.toggle('unlearned',locked);b.classList.toggle('trainable',eligible);
    b.classList.toggle('upgrade-target',upgradeMode&&eligible);
    b.classList.toggle('control-blocked',blocked&&!locked);b.classList.toggle('queued',queued);
    b.classList.toggle('mana-empty',empty&&!locked);b.classList.toggle('return-ready',returnReady);
    b.querySelector('.mana-cost').textContent=`${returnReady?0:manaCost(p,i)} MP`;
    const combatDisabled=locked||!returnReady&&(p.cd[i]>0||empty)||blocked;
    b.setAttribute('aria-disabled',String(upgradeMode&&eligible?false:combatDisabled));
    const move=identitySkill(selectedIdentity,i);
    b.setAttribute('aria-label',upgradeMode&&eligible?`Spend one skill point on ${move.name}. Current rank ${rank}.`:`${returnReady?'Return to decoy':move.name}. ${locked?'Unlearned':`Rank ${rank}`}. ${returnReady?'No mana cost. ':`${manaCost(p,i)} mana. ${empty?'Need more mana. ':''}${p.cd[i]>0?`${Math.ceil(p.cd[i])} seconds cooldown. `:''}`}${move.description}`);
    if(blockedLabel)b.setAttribute('aria-label',`${b.getAttribute('aria-label')} Temporarily unavailable: ${blockedLabel.toLowerCase()}.`);
    b.classList.toggle('combo-ready',followUp?.slot===i);b.dataset.combo=followUp?.slot===i?followUp.bonus:'';
    if(followUp?.slot===i)b.setAttribute('aria-label',`${b.getAttribute('aria-label')} Combo ready. ${followUp.label}.`);
    const ranks=b.querySelector('.ranks'); if(ranks.dataset.rank!==String(rank)){ranks.innerHTML=Array.from({length:i===3?3:4},(_,j)=>`<i class="${j<rank?'filled':''}"></i>`).join('');ranks.dataset.rank=rank;}
  });
  const upgradeReady=p.skillPoints>0&&p.skillRanks.some((_,i)=>canLearn(p,i));
  $('skill-points').textContent=upgradeReady?`+ ${p.skillPoints} POINT${p.skillPoints===1?'':'S'}`:'SPELLBOOK';
  $('skill-points').classList.toggle('ready',upgradeReady);
  if(!upgradeReady)document.querySelector('.abilities')?.classList.remove('upgrade-mode');
  upgradeButtons.forEach((b,i)=>{
    const eligible=canLearn(p,i);b.hidden=!eligible;b.disabled=!eligible;
    b.setAttribute('aria-label',`${p.skillRanks[i]?'Upgrade':'Learn'} ${identitySkill(selectedIdentity,i).name} to rank ${p.skillRanks[i]+1} · 1 skill point`);
  });

  dom.respawn.hidden = p.hp > 0; if (p.hp <= 0) dom.respawn.innerHTML = `The veil takes you<strong>${Math.max(1, Math.ceil(p.respawn))}</strong>`;
  recapView.update(p);
  const clock=objectiveClock(state,p),clockKey=clock.items.map(i=>i.state+clockText(i)).join('|');
  if(objectiveClockEl.dataset.key!==clockKey){objectiveClockEl.dataset.key=clockKey;objectiveClockEl.replaceChildren(...clock.items.map(i=>Object.assign(document.createElement('span'),{className:i.state,textContent:clockText(i)})));}
  if(clock.hunt.state==='soon'&&(huntCue?.state!==state||huntCue.at!==state.objectiveAt)){huntCue={state,at:state.objectiveAt};sound.horn();}
  const msg = state.messages.at(-1), fresh = msg && state.time - msg.time < 3.8;
  const noticeKey = msg && JSON.stringify([msg.time, msg.title, msg.detail]);
  dom.notice.style.opacity = fresh ? '1' : '0'; if (fresh && dom.notice.dataset.message !== noticeKey) { dom.notice.replaceChildren(); const b = document.createElement('b'), small = document.createElement('small'); b.textContent = msg.title; small.textContent = msg.detail; dom.notice.append(b, small); dom.notice.dataset.message = noticeKey; }
  const until = Math.ceil(SHIFT - state.time % SHIFT), gate = [...PORTALS].sort((a, b) => distance(p, a) - distance(p, b))[0];
  $('realm').textContent = state.phase ? 'DEEP WOODS' : 'MIDNIGHT TOWN';
  $('realm-count').textContent = `${state.phase ? 'Town returns' : 'Woods arrive'} in ${until}s`;
  $('realm-fill').style.width = `${(1 - state.time % SHIFT / SHIFT) * 100}%`;
  $('objective').classList.toggle('shifting', until <= 6);
  $('portal').disabled = distance(p, gate) >= 150 || p.portalCd > 0 || p.hp <= 0;
  $('portal').querySelector('small').textContent = p.portalCd > 0 ? `${Math.ceil(p.portalCd)}s` : distance(p, gate) >= 150 ? 'Find a gate' : (gate.choices ? 'Jump to the river you face' : 'Jump across the map');
  const focus = state.units.find(e => e.id === (p.selectedTarget || p.target) && e.hp > 0 && visibleTo(state,p.team,e));
  $('auto-status').textContent = p.hp <= 0 ? 'RESPAWNING' : focus ? `${p.order?.type==='attack' && distance(p,focus)>p.range+focus.radius ? 'APPROACH' : distance(p,focus)>p.range+focus.radius ? 'SELECTED' : 'ATTACK'} · ${focus.name || focus.kind} · ${p.attackVariant+1||1}/3` : 'AUTO · SELECT AN ENEMY';
  $('auto-status').classList.toggle('engaged', !!focus);
  if (waypoint && distance(p, waypoint) < 110) waypoint = null;
  // The enemy bots' team focus is the player: a mark under the health bar. The focus needs the enemy team to see the player.
  const hunt=state.botFocus?.[1-p.team];$('hunted').hidden=!(hunt&&hunt.id===p.id&&hunt.until>state.time&&p.hp>0);
  const towerThreat=state.units.find(t=>t.kind==='tower'&&t.team!==p.team&&t.towerTarget===p.id&&t.towerUntil>state.time&&t.hp>0);
  const compactObjective = innerWidth <= 370;
  dom.objective.textContent = p.recall ? `Returning in ${Math.ceil(p.recall)}…` : towerThreat ? (compactObjective ? 'Tower fire. Retreat.' : 'Tower fire is growing. Leave its range.') : concealed(state, p) ? (compactObjective ? 'Hidden. Next strike: ambush.' : 'Hidden. Your next strike is an ambush.') : objectiveText(state, currentLane = guidanceLane(p, currentLane), compactObjective);
  const rallyWait=Math.ceil(rallyReadyAt-state.time);$('rally').disabled=p.hp<=0||rallyWait>0;$('rally').querySelector('small').textContent=rallyWait>0?`${rallyWait}s`:'Call team';
  const recalling = p.recall > 0;
  $('recall').disabled = p.hp <= 0;
  $('recall').classList.toggle('channeling', recalling);
  $('recall').style.setProperty('--recall-progress', `${recalling ? (1-p.recall/2.5)*100 : 0}%`);
  $('recall-label').textContent = recalling ? 'CANCEL' : 'RECALL';
  $('recall').querySelector('small').textContent = recalling ? `${p.recall.toFixed(1)}s to home` : 'Heal at home';
  $('recall').setAttribute('aria-label', recalling ? `Cancel Recall. ${p.recall.toFixed(1)} seconds to home.` : 'Recall to heal at home (B)');
  if (!aim && state.time >= castFeedbackUntil && aimStatus.classList.contains('rejected')) { aimStatus.hidden = true; aimStatus.classList.remove('rejected'); }
  firstMatch.update(p, { units: state.units, towerThreat, paused }); refreshGuide();
  updateMatchPortraits(state);
}
const hudReady=()=>running&&!paused&&!resultShown;
pointerAction($('inventory'),shop,hudReady);
// The quick-buy tab sits on top of the bar, above the items, and says QUICK BUY. It previews the next purchase: its
// icon, name and price, glowing when it can be bought, or the embers saved toward it. A small corner icon shows the
// build goal it leads to.
const nextStep = (p, id, bag = [...p.inventory]) => { const at = bag.indexOf(id); if (at >= 0) { bag.splice(at, 1); return null; } for (const part of ITEM[id].recipe) { const found = nextStep(p, part, bag); if (found) return found; } return id; };
let quickBuyKey = '';
function updateQuickBuy(p) {
  const b = $('quick-buy'), next = nextPurchase(p), goal = nextItem(p), step = next || (goal && nextStep(p, goal)), cost = step ? quote(p, step).cost : 0;
  b.disabled = !next; b.dataset.item = next || ''; b.classList.toggle('affordable', !!next);
  const key = `${step}|${goal}`;
  if (key !== quickBuyKey) { quickBuyKey = key; b.innerHTML = `<small class="qb-label">Quick buy</small>` + (step ? `${itemIcon(step)}<span class="qb-name">${ITEM[step].name}</span><b class="qb-cost"></b>${goal && goal !== step ? `<i class="qb-goal">${itemIcon(goal)}</i>` : ''}` : '<span class="qb-name">Build complete</span>'); }
  const price = b.querySelector('.qb-cost'); if (step && price) price.textContent = next ? cost : `${Math.floor(Math.min(p.gold, cost))}/${cost}`;
  const label = !step ? 'Build complete' : next ? `Buy ${ITEM[next].name} for ${cost} embers${goal && goal !== next ? `, toward ${ITEM[goal].name}` : ''}` : `Next: ${ITEM[step].name}, ${Math.floor(p.gold)} of ${cost} embers${goal !== step ? `, toward ${ITEM[goal].name}` : ''}`;
  b.title = label; b.setAttribute('aria-label', label);
}
pointerAction($('quick-buy'),()=>{const id=$('quick-buy').dataset.item;if(id&&buy(state,id)){sound.coin();updateUI();}},()=>hudReady()&&!$('quick-buy').disabled);
function minimapPoint(e){const r=$('minimap').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*SIZE,y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))*SIZE};}
$('map-button').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||!hudReady())return;
  e.preventDefault();e.stopImmediatePropagation();
  const point=minimapPoint(e);
  if(e.button===2){if(player(state).hp>0){cancelPursuit(player(state));target=0;orderQueue={type:'move',...point};waypoint=point;}return;}
  if(e.button!==0)return;
  minimapDrag=e.pointerId;$('map-button').setPointerCapture(e.pointerId);renderer?.lookAt(point.x,point.y);
},{capture:true});
$('map-button').addEventListener('pointermove',e=>{if(e.pointerId===minimapDrag){const point=minimapPoint(e);renderer?.lookAt(point.x,point.y);}});
// Releasing the minimap returns the view to the hero, so the camera never stays detached.
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('map-button').addEventListener(type,e=>{if(e.pointerId===minimapDrag){minimapDrag=null;recenter();}});
pointerAction(recenterButton,recenter,()=>hudReady());
function callRally(point){
  const p=player(state);if(!running||paused||p.hp<=0||state.time<rallyReadyAt)return false;
  rallyQueue=point||true;rallyReadyAt=state.time+8;return true;
}
for(const [id,action] of [['rally',()=>callRally()],['map-button',map],['shop',shop],['recall',recallAction],['portal',()=>{portalQueue=true;}],['pause',pause],['hud-sound',()=>{if(sound.on&&performance.now()-soundWokeAt<1500){updateSound();return;}sound.start();if(sound.toggle())confirmSound();updateSound();}],['muted-chip',turnSoundOn],['gpu-note-close',()=>{gpuNoteClosed=true;$('gpu-note').hidden=true;}],['coach-close',()=>{firstMatch.skip();refreshGuide();}]])pointerAction($(id),action,()=>hudReady()&&!$(id).disabled);
function heroDetails(){
  const h=HERO_IDENTITIES[selectedIdentity];
  sheet(`<h2>${h.name}</h2><p>${h.subtitle}</p><p>${h.note}</p>${[0,1,2,3].map(i=>{const a=identitySkill(selectedIdentity,i);return `<h3>${SELECTION_KEYS[i]} · ${a.name}</h3><p>${a.description}</p><p class="keyhint">${a.cooldown}s cooldown · ${manaCost({hero:h.kit,skillRanks:[1,1,1,1]},i)} mana${i===3?' · Unlocks at level 6':''}</p>`;}).join('')}<button id="details-back" class="primary">Back to heroes</button>`);
  $('details-back').onclick=closeSheet;
}
function selectionPanel(title,copy){sheet(`<h2>${title}</h2>${copy}<button id="selection-back" class="primary">Back to heroes</button>`);$('selection-back').onclick=closeSheet;}
function matchRecord(){let record={wins:0,matches:0};try{record=JSON.parse(localStorage.getItem('monster-mash.record'))||record;}catch{}selectionPanel('Tidecaller',`<p>Your match record on this device.</p><dl><dt>Matches played</dt><dd>${Number(record.matches)||0}</dd><dt>Victories</dt><dd>${Number(record.wins)||0}</dd></dl>`);}
function gameSettings(){sheet(`<h2>Game settings</h2><button id="draft-preview" class="row-btn" ${$('play').disabled?'disabled':''}>View team draft</button>${soundRowsHTML('settings')}<button id="selection-fullscreen" class="row-btn"></button><button id="settings-perf" class="row-btn"></button><button id="selection-how" class="row-btn">How to play</button><button id="settings-back" class="primary">Back to heroes</button>`);$('draft-preview').onclick=startDraft;wireSoundRows('settings');wirePerfRow($('settings-perf'));const fs=$('selection-fullscreen'),fsLabel=()=>{let on=true;try{on=localStorage.getItem('tidebreak.fullscreen')!=='off';}catch{}fs.textContent=on?'Full screen at start: on':'Full screen at start: off';};fsLabel();fs.onclick=()=>{let on=true;try{on=localStorage.getItem('tidebreak.fullscreen')!=='off';}catch{}saveFullscreen(!on);if(on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});fsLabel();};$('selection-how').onclick=how;$('settings-back').onclick=closeSheet;}
$('play').onclick=quickStart;$('how').onclick=heroDetails;$('close-sheet').onclick=closeSheet;
$('hero-profile').onclick=matchRecord;$('tidecaller-profile').onclick=matchRecord;$('hero-settings').onclick=gameSettings;
document.querySelectorAll('[data-menu-tab]').forEach(b=>b.onclick=()=>{
  const tab=b.dataset.menuTab;
  if(tab==='play'){quickStart();return;}
  if(tab==='heroes'){document.querySelector(`[data-hero="${selectedIdentity}"]`)?.focus();return;}
  if(tab==='lore'){heroDetails();return;}
  if(tab==='realms'){selectionPanel('The shifting realms','<p>Midnight Town and Deep Woods alternate every 40 seconds. Buildings and trees change the paths and block sight.</p><p>Use glowing brush for concealment. Rift gates cross the map. Clear spirit camps for embers, healing and haste, then contest the Wild Hunt in the center.</p>');return;}
  selectionPanel('The Night Market','<p>Earn embers in battle and spend them in the Night Market. Combine components into six items, choose a build and forge one relic.</p><p>Open the market during a match to inspect items and buy upgrades.</p>');
});
$('sheet').addEventListener('cancel', e => { e.preventDefault(); if (!resultShown) closeSheet(); });
$('select-key').onclick=quickStart;$('menu-muted-chip').onclick=turnSoundOn;updateSound();
let rosterFilter='All';
mountDifficulty($('difficulty-picker'));
const lineup=mountLineup({track:$('hero-picks'),previous:$('hero-prev'),next:$('hero-next'),position:$('lineup-position'),selected:()=>selectedIdentity,choose});
function showRoster(){ $('hero-picks').innerHTML=rosterHTML(selectedIdentity,rosterFilter);const count=document.querySelectorAll('[data-hero]').length;$('roster-count').textContent=`${count} ${count===1?'hero':'heroes'}`;lineup.refresh(); }
$('role-filters').innerHTML=ROLES.map((role,i)=>`<button data-role="${role}" aria-pressed="${role==='All'}"><span class="role-icon" style="--role-x:${[42,117,194,272,347,429][i]}" aria-hidden="true"></span>${role}</button>`).join('');
document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{rosterFilter=b.dataset.role;document.querySelectorAll('[data-role]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));showRoster();});showRoster();
movementControl=movementPointer($('joystick'),{movement,thumb:$('thumb'),enabled:()=>running&&!paused,onStart:()=>sound.start()});
screenMovementControl=screenMovementPointer($('battle'),{
  movement,
  enabled:()=>running&&!paused&&player(state).hp>0,
  onStart:()=>sound.start(),
  onDragStart:()=>{cancelPursuit(player(state));orderQueue=undefined;target=0;},
  onTap:e=>battlefieldTap(e),
  onZoom:factor=>renderer?.zoomBy(factor)
});
$('battle').addEventListener('wheel',e=>{
  if(!renderer||!running||paused||player(state).hp<=0)return;
  e.preventDefault();renderer.zoomBy(wheelZoomFactor(e,innerHeight));
},{passive:false});
abilityControl=abilityPointers(skillButtons,{enabled:()=>running&&!paused,onStart:()=>sound.start(),onAim:value=>{if(value&&!abilityCluster.classList.contains('upgrade-mode'))firstMatch.notify('aim');aim=abilityCluster.classList.contains('upgrade-mode')?null:value;},onStatus:status=>updateAimStatus(abilityCluster.classList.contains('upgrade-mode')?null:status),onCancel:command=>{if(abilityCluster.classList.contains('upgrade-mode'))return;firstMatch.notify('cancel');telemetry.action('cast',{slot:command.slot,outcome:'cancelled',reason:'center_return'});refreshGuide();},onUnavailable:command=>{const feedback=castFeedback(state,player(state),command.slot);if(feedback.outcome==='rejected')rejectCast(command.slot,feedback);else castQueue={slot:command.slot,aim:null};},onCast:command=>{
  if(abilityCluster.classList.contains('upgrade-mode')&&trainFromHUD(command.slot))return;
  castQueue=command;
}});
function battlefieldTap(e){
  if(!renderer||!running||paused||player(state).hp<=0)return;
  const point=renderer.world(e.clientX,e.clientY),picked=renderer.pick(state,e.clientX,e.clientY);
  const hit=state.units.find(u=>u.id===picked&&u.team!==0&&u.hp>0&&visibleTo(state,0,u))||state.units.filter(u=>u.team!==0&&u.hp>0&&distance(u,point)<Math.max(55,u.radius)&&visibleTo(state,0,u)).sort((a,b)=>distance(a,point)-distance(b,point))[0];
  if(hit&&structureProtected(state,hit)){announce(state,...lockTip(hit));return;}
  target=0;orderQueue=hit?{type:'attack',target:hit.id}:e.pointerType==='mouse'?{type:'move',...point}:{type:'stop'};
}
$('battle').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||!running||paused||player(state).hp<=0||(e.button!==0&&e.button!==2))return;
  e.preventDefault();sound.start();$('coach').hidden=true;cursor={x:e.clientX,y:e.clientY};battlefieldTap(e);
});
$('battle').addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;cursor={x:e.clientX,y:e.clientY};if(renderer&&running&&!paused)$('battle').style.cursor=renderer.pick(state,e.clientX,e.clientY)?'crosshair':'default';});
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
window.addEventListener('keydown', e => {
  if ($('graphics-error').open) { if (e.key === 'Escape') e.preventDefault(); return; }
  // A held Esc repeats. Chrome tells the player to hold Esc to leave a keyboard-locked full screen, and each repeat
  // would open or close the menu again, so only the first press counts.
  if (e.key === 'Escape' && e.repeat) { e.preventDefault(); return; }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (!$('draft').hidden && draft) { if (e.key === 'Enter') { e.preventDefault(); draft.skip(); } else if (e.key === 'Escape') { e.preventDefault(); $('draft-back').click(); } return; }
  // preventDefault: the same Esc would otherwise close the menu dialog it has just opened.
  if (e.key === 'Escape') { e.preventDefault(); if ($('sheet').open) { if (!resultShown) closeSheet(); } else if(!running)window.GameSwitch?.open();else pause();return; }
  if(!running&&!$('sheet').open&&!window.GameSwitch?.isOpen&&!e.repeat){
    const inRoster=e.target instanceof Element&&e.target.closest('#hero-picks');
    if(e.key==='Enter'&&(inRoster||e.target===document.body||e.target===document.documentElement)){
      e.preventDefault();quickStart();return;
    }
    if(e.key.toLowerCase()==='f'){e.preventDefault();heroDetails();return;}
  }
  const key = e.key.toLowerCase();
  if (running && !paused) telemetry.input('keyboard');
  // A movement key still held after a resize or a closed menu comes back with its next repeat.
  if (running && !paused && MOVE_KEYS.includes(key)) keys.add(key);
  if (!running || paused || e.repeat) return;
  keys.add(key);
  if(key==='k'){learnSkills();return;}
  if(MOVE_KEYS.includes(key)){cancelPursuit(player(state));orderQueue=undefined;target=0;}
  if(key===' '){cancelOrder(player(state));orderQueue={type:'stop'};target=0;recenter();}
  const slot = ['q', 'e', 'c', 'r'].indexOf(key); if (slot >= 0) castQueue = { slot, worldPoint:cursor&&renderer?renderer.world(cursor.x,cursor.y):null, aim:null };
  if (key === 'g') callRally();
  if (key === 'b') recallAction(); if (key === 'f') portalQueue = true; if (key === 'm') map();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
// Switching to another window or tab holds the match; coming back resumes it. The mouse may leave the window freely,
// since it pushes the view toward the edges. Touch players tap to resume.
let autoPaused = false, lastPointer = 'mouse';
const autoPauseNote = document.createElement('button'); autoPauseNote.id = 'auto-pause'; autoPauseNote.hidden = true; $('hud').append(autoPauseNote);
function autoPause() {
  if (!running || resultShown || $('sheet').open || autoPaused) return;
  resetInput(); paused = true; autoPaused = true; autoPauseNote.hidden = false;
  autoPauseNote.innerHTML = lastPointer === 'mouse' ? '<b>Paused</b><small>Click to keep playing</small>' : '<b>Paused</b><small>Tap to keep playing</small>';
}
function autoResume() {
  if (!autoPaused || document.hidden || renderer?.lost) return;
  autoPaused = false; autoPauseNote.hidden = true; if (!$('sheet').open) paused = false;
}
window.addEventListener('pointerdown', e => { lastPointer = e.pointerType; telemetry.input(e.pointerType); }, true);
window.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
document.documentElement.addEventListener('mouseleave', () => { mouse = null; });
window.addEventListener('mouseout', e => { if (!e.relatedTarget) mouse = null; });
window.addEventListener('mousemove', () => { if (autoPaused && lastPointer === 'mouse' && document.hasFocus()) autoResume(); }, { passive: true });
autoPauseNote.addEventListener('click', autoResume);
window.addEventListener('blur', autoPause);
window.addEventListener('focus', () => { if (lastPointer === 'mouse') autoResume(); });
document.addEventListener('visibilitychange', () => { sound.setHidden(document.hidden); if (document.hidden) autoPause(); });
// A resize (full screen, zoom, devtools) keeps the hero's order and held keys; only pointer gestures in progress end.
window.addEventListener('resize', () => { movementControl?.reset(); screenMovementControl?.reset(); abilityControl?.reset(); aim = null; $('thumb').style.transform = ''; renderer?.resize(); });
window.addEventListener('contextmenu', e => e.preventDefault());
function frame(now) {
  const frameMs = Math.max(0, now - last), dt = Math.min(frameMs / 1000, .05); last = now;
  let steps = 0;
  if (running && !paused && !renderer?.lost && !window.GameSwitch?.isOpen) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      steps++;
      const p = player(state), command = castQueue; castQueue = undefined;
      const castAim=command?.worldPoint?cursorSkillAim(p,command.slot,command.worldPoint):command?.aim?dragSkillAim(p,command.slot,command.aim,(x,y)=>renderer.screenDirection(x,y)):null;
      const input = { x: movement.x + Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: movement.y + Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')), target, order: orderQueue, cast: command?.slot, aim:castAim, recall: recallQueue, cancelRecall: cancelRecallQueue, portal: portalQueue, rally: rallyQueue }; recallQueue = cancelRecallQueue = portalQueue = false; rallyQueue = null; orderQueue=undefined;
      const direction = renderer.screenDirection(input.x, input.y); input.x = direction.x; input.y = direction.y;
      const previousRequest = p.lastCastRequest;
      const feedback = command ? castFeedback(state,p,command.slot,castAim) : null;
      for (const e of state.units) { e.px = e.x; e.py = e.y; } for (const m of state.missiles) { m.px = m.x; m.py = m.y; }
      step(state, input);
      if (command) {
        const outcome = p.lastCastRequest !== previousRequest ? p.lastCastRequest.outcome : 'rejected';
        if(outcome==='rejected') {
          const rejected = castFeedback(state,p,command.slot,castAim);
          rejectCast(command.slot,rejected.outcome==='rejected'?rejected:feedback?.outcome==='rejected'?feedback:{outcome:'rejected',reason:'interrupted',message:'Cast interrupted. Try again.'});
        } else {
          castFeedbackUntil=0;updateAimStatus(null);
          telemetry.action('cast',{slot:command.slot,outcome});
          firstMatch.notify('cast',{accepted:outcome==='accepted'});
        }
      }
      telemetry.observe(state);
      if(Number.isFinite(p.castStarted)&&p.castStarted>lastCast){sound.skill(p.castSlot,p.hero);lastCast=p.castStarted;}
      sound.syncFeedback(state,p);
      // A quiet click when your cast starts, and a gold chime for a last hit.
      const intentStart=p.castIntent?.start;if(intentStart!==undefined&&intentStart!==lastIntent)sound.commit();lastIntent=intentStart;
      if(p.lastHits!==lastHits){if(p.lastHits>lastHits)sound.lastHit();lastHits=p.lastHits;}
      if (p.lastBasicHit > lastAttack) { sound.hit(p.lastBasicVariant,p.hero); lastAttack = p.lastBasicHit; }
      accumulator -= 1 / 60;
    }
    // The last pointer position holds when the mouse leaves the window, so a push to the edge stays pushed.
    if (mouse && !minimapDrag) lookX = mouse.x / innerWidth * 2 - 1;
    renderer?.setLook(keys.has(' ') ? 0 : lookX); renderer?.adapt(frameMs);
    if (renderer) { const span = Math.abs(renderer.world(renderer.width, 0).x - renderer.world(0, 0).x) / 2 || 1400; sound.setListener(renderer.cam.x, renderer.cam.y, span); }
    announcer.update(state, { playerId: state.playerId, visible: renderer?.visible }); teamChat.update(state);
    // Hitstop and shake are drawn by the renderer; the sim keeps stepping at 60 Hz.
    const felt = feel.update(state, state.playerId, dt, { reducedMotion: renderer?.reducedMotion }); if (renderer) renderer.feel = feel;
    for (const i of felt.impacts) sound.impact(i.weight, i.x, i.y); if (felt.hurt > .004) sound.hurt(felt.hurt);
    const me = player(state); if (me.hp > 0 && me.hp < me.maxHp * .3) sound.heartbeat();
    const edge = Math.round(feel.edge * 20) / 20; if (hurtEdge.dataset.edge !== String(edge)) { hurtEdge.dataset.edge = edge; hurtEdge.style.opacity = edge; }
    sound.tick(state.time); uiTime += dt; if (uiTime > .09) { updateUI(); uiTime = 0; }
    if (state.winner !== null && !resultShown) result();
  }
  // A held match keeps fading the shake, the hitstop and the red edge instead of freezing them.
  if (running && (paused || window.GameSwitch?.isOpen)) { feel.idle(dt); hurtEdge.style.opacity = hurtEdge.dataset.edge = Math.round(feel.edge * 20) / 20; }
  const drawStart = performance.now();
  if (running && renderer) drawBetweenSteps(dt); else drawArena(frameMs);
  perf.frame(frameMs, steps, performance.now() - drawStart, renderer, running, running && !paused && !window.GameSwitch?.isOpen);
  requestAnimationFrame(frame);
}
// The hero select arena (3D only): the selected hero stands alone near the allied base, with only the structures and no
// match clock. three-render.js frames it with a low camera in the box of the portrait. The painted stage and portrait
// stay until the first hero model is ready, when a model fails and when the WebGL context is lost. A new
// pick keeps the last hero on stage while its model parses, then swaps. Idle frames parse the nearest other heroes one at
// a time, so later picks swap at once. It draws at most 30 frames a second. A slow draw waits twice its own time (up to
// 2 s), so the menu keeps about half of the main thread. It never draws while the tab is hidden, and stops when the draft
// or a match starts.
const ARENA = { x: 4250, y: 8950, facing: 1.95 }, ARENA_MS = 1000 / 30;
let arena = null, arenaClock = ARENA_MS, arenaSince = 0, arenaCost = 0;
function arenaState(ready) {
  if (!ready || arena?.identity === selectedIdentity) return arena.state;
  const s = assignIdentities(createMatch(selected), selectedIdentity), p = Object.assign(player(s), ARENA);
  // No structure is warded in sudden death, so no ward light stands in the view. The clock never runs here.
  s.units = s.units.filter(u => u === p || u.kind === 'tower' || u.kind === 'core'); s.suddenDeath = true;
  // A short ring in the hero's colour marks a new choice (not the first hero, and not with reduced motion).
  if (arena && !matchMedia('(prefers-reduced-motion: reduce)').matches) s.effects.push({ x: p.x, y: p.y, type: 'arrive', color: HERO_IDENTITIES[selectedIdentity].color, radius: 120, life: .8, maxLife: .8 });
  arena = { identity: selectedIdentity, state: s }; return s;
}
function warmHeroes() { const n = HERO_IDENTITIES.length; for (let k = 1; k < n; k++) for (const i of [(selectedIdentity + k) % n, (selectedIdentity - k + n) % n]) if (renderer.heroStatus(i) === 'loading') return; }
function drawArena(frameMs) {
  const menu = $('menu'); if (running || menu.hidden) return;
  const status = renderer?.lost ? 'lost' : renderer?.heroStatus?.(selectedIdentity);
  if (status !== 'ready' && !(status === 'loading' && arena && menu.classList.contains('arena-3d'))) { menu.classList.remove('arena-3d'); arenaClock = ARENA_MS; return; }
  if (document.hidden || window.GameSwitch?.isOpen) return;
  arenaSince += frameMs; arenaClock += frameMs; const gap = Math.min(2000, Math.max(ARENA_MS, arenaCost * 2)); if (arenaClock < gap) return;
  const s = arenaState(status === 'ready'), dt = Math.min(arenaSince, 100) / 1000; arenaClock = Math.min(arenaClock - gap, ARENA_MS); arenaSince = 0;
  for (const f of s.effects) f.life -= dt; s.effects = s.effects.filter(f => f.life > 0);
  // The hero stands where the portrait stands: feet on the portrait's lower edge (above the footer), head near its top
  // and below the wordmark where the two share a column (phones).
  const art = $('hero-art').getBoundingClientRect(), floor = menu.querySelector('.roster-footer').getBoundingClientRect().top, mark = menu.querySelector('.roster-heading').getBoundingClientRect(), x = art.left + art.width / 2;
  const start = performance.now();
  renderer.draw(s, dt, { stage: { x, head: Math.max(art.top + art.height * .06, x < mark.right ? mark.bottom + 8 : 0), feet: Math.min(art.bottom, floor) - art.height * .03 } });
  arenaCost = performance.now() - start; menu.classList.add('arena-3d'); if (status === 'ready') warmHeroes();
}
// The simulation steps at 60 Hz, but a 100-175 Hz screen draws two or three frames per step. Units and missiles are
// drawn between their last two positions (by the time left over in the accumulator), so they glide with the camera
// instead of jumping on some frames and standing still on others. A move longer than 80 units (a recall, a respawn,
// a rift jump) is drawn at once. The simulation never keeps the drawn positions.
function drawBetweenSteps(dt) {
  const a = Math.min(1, Math.max(0, accumulator * 60)), moved = [], time = state.time;
  for (const list of [state.units, state.missiles]) for (const e of list) {
    if (e.px === undefined) continue;
    const dx = e.x - e.px, dy = e.y - e.py; if ((!dx && !dy) || dx * dx + dy * dy >= 6400) continue;
    moved.push(e, e.x, e.y); e.x = e.px + dx * a; e.y = e.py + dy * a;
  }
  state.time = time - (1 - a) / 60;
  try { renderer.draw(state, dt, false, aim ? skillAimPreview(state, player(state), aim.slot, dragSkillAim(player(state), aim.slot, aim, (x, y) => renderer.screenDirection(x, y))) : null, waypoint); }
  finally { state.time = time; for (let i = 0; i < moved.length; i += 3) { moved[i].x = moved[i + 1]; moved[i].y = moved[i + 2]; } }
}
// 3D is the only battlefield. Old links/preferences cannot silently select another view.
try { localStorage.removeItem('tidebreak.renderer'); } catch {}
const loadingText = (done, total) => { if ($('play').disabled) $('play').querySelector('span').textContent = `Opening the shore… ${Math.round(done / total * 100)}%`; };
function graphicsMessage(message, visible = true) {
  $('graphics-error-text').textContent = message;
  const dialog = $('graphics-error');
  if (visible && !dialog.open) dialog.showModal();
  if (!visible && dialog.open) dialog.close();
}
async function startGraphics() {
  const loadStartedAt = performance.now();
  telemetry.load('started');
  try {
    renderer = await createBattlefield({ canvas: $('battle'), minimap: $('minimap'), onProgress: loadingText });
    renderer.canvas.addEventListener('webglcontextlost', () => {
      if (running) { paused = true; resetInput(); accumulator = 0; }
      $('play').disabled = true;
      graphicsMessage('3D graphics were interrupted. Your match is paused while graphics recover. If this continues, reload Shore.');
    });
    renderer.canvas.addEventListener('webglcontextrestored', () => {
      $('play').disabled = false;
      graphicsMessage('', false);
      if (running) { paused = true; pause(); }
    });
    $('play').disabled = false;
    $('play').querySelector('span').textContent = 'Start match';
    telemetry.load('ready', { elapsed_ms: performance.now() - loadStartedAt });
    requestAnimationFrame(frame);
  } catch (error) {
    telemetry.load('failed', { reason: error.code || 'load_failed', elapsed_ms: performance.now() - loadStartedAt });
    console.error('Shore 3D could not start.', error);
    graphicsMessage(error.code === 'GRAPHICS_UNAVAILABLE' ? error.message : 'Shore’s 3D world could not load. Check your connection and reload to try again.');
    $('play').querySelector('span').textContent = 'Shore unavailable';
  }
}
$('graphics-error').addEventListener('cancel', event => event.preventDefault());
startGraphics();
document.addEventListener('error',e=>{if(e.target.tagName!=='IMG')return;const picture=e.target.closest('picture');if(picture?.querySelector('source')?.hasAttribute('srcset')){picture.querySelector('source').removeAttribute('srcset');e.target.src=e.target.getAttribute('src');}},true);
try { const hero = Number(localStorage.getItem('tidebreak.hero')); if(Number.isInteger(hero)&&HERO_IDENTITIES[hero]) selectedIdentity=hero; } catch {}
choose(selectedIdentity);
window.addEventListener('pagehide',()=>{if(running&&!resultShown)telemetry.abandon(state);});
// A read-only snapshot supports the existing arcade's QA tooling.
export const snapshot = () => ({ running, paused, time: state.time, winner: state.winner, player: { ...player(state), cd: [...player(state).cd], inventory: [...player(state).inventory] }, phase: state.phase, stats: { ...state.stats }, waypoint: waypoint ? { ...waypoint } : null, units: state.units.length, score: [...state.score], assetReady: !!renderer, graphics: renderer?.stats() });
// QA scripts read the live match to stage events; gameplay never uses this.
export const qaState = () => state;
// The first tap or key anywhere opens audio, so recorded clips are ready before the draft starts. A later tap or key
// also wakes a context that the browser or the system stopped (an output change, a sleep), so sound does not stay lost.
const wakeSound = () => { if (!sound.context || sound.context.state !== 'running' || sound.scoreBlocked()) { soundWokeAt = performance.now(); sound.start(); } };
window.addEventListener('pointerdown', wakeSound, { capture: true });
window.addEventListener('keydown', wakeSound, { capture: true });


