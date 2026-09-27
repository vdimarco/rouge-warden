// js/story/ui/menu.js : the story's pause menu. RESUME, MAP, EVIDENCE, MISSIONS (the chapter log),
// CONTROLS (for the device in use), MUSIC, SAVE & QUIT (S.exit, back to the title), SWITCH GAME
// (data-switch) and ARCADE. It opens on Esc, P or pad Start, when the pointer lock is lost, and when the
// page hides (the director's pauseMenu). The story clock stops while it is open. The arrows, the d-pad or
// the left stick move the focus; E, Enter or pad A picks; Esc or pad B goes back.
import { CHAPTER_ORDER } from '../types.js';
import { esc } from './cards.js';

const CONTROLS = [
  ['ON FOOT', [['Move', 'move'], ['Camera', 'look'], ['Light attack', 'light'], ['Heavy attack', 'heavy'], ['Parry (hold)', 'parry'], ['Dodge', 'dodge'], ['Drink', 'canteen'], ['Lock on', 'lock'], ['Use', 'use'], ['Crouch', 'crouch'], ['Phone camera', 'camera'], ['Bear call', 'bearcall']]],
  ['DRIVING', [['Gas', 'gas'], ['Brake and reverse', 'brake'], ['Steer', 'steer'], ['Drift', 'handbrake'], ['Horn', 'horn'], ['Look back', 'lookback'], ['Get out', 'exit']]],
  ['PHONE CAMERA', [['Take the photo', 'shutter'], ['Zoom', 'zoom'], ['Put it away', 'camera']]],
  ['ANY TIME', [['Map', 'map'], ['Pause', 'pause'], ['Music', 'music']]],
];

export function createMenu(U, { map, board }) {
  const { S, make, root } = U;
  const el = make('div', 'sMenu hidden', root, `<div class="mWrap"><div class="mMain"><p class="mK">止</p><h2>PAUSED</h2><p class="mCh"></p><div class="mBtns">
    <button type="button" class="main" data-a="resume">▶ RESUME</button><button type="button" data-a="map">MAP</button><button type="button" data-a="board">EVIDENCE</button>
    <button type="button" data-a="missions">MISSIONS</button><button type="button" data-a="controls">CONTROLS</button><button type="button" data-a="music">MUSIC <small></small></button>
    <button type="button" data-a="quit">SAVE &amp; QUIT</button><button type="button" data-a="switch" data-switch>SWITCH GAME</button><a href="/" data-a="arcade">◀ ARCADE</a></div>
    <p class="mTip"></p></div><div class="mPage hidden"><div class="mBody"></div><div class="mBtns"><button type="button" data-a="back">◀ BACK</button></div></div></div>`);
  el.id = 'sMenu';
  const mainEl = el.querySelector('.mMain'), pageEl = el.querySelector('.mPage'), bodyEl = el.querySelector('.mBody');
  if (window.GameSwitch && window.GameSwitch.wire) window.GameSwitch.wire();
  let isOpen = false, prevMode = 'play', page = 'main', focusI = 0;

  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'arcade' || b.dataset.a === 'switch') { if (S.api && S.api.save) S.api.save(); return; } // the link and the switch go on as links
    e.stopPropagation(); e.preventDefault();
    act(b.dataset.a, e.detail > 0);
  });
  function act(a, byPointer) {
    U.blip('pick');
    if (a === 'resume') { api.close(); if (byPointer && U.device === 'key') U.input.lock(); }
    else if (a === 'map') map.api.open();
    else if (a === 'board') board.api.open();
    else if (a === 'missions' || a === 'controls') showPage(a);
    else if (a === 'back') showPage('main');
    else if (a === 'music') { const M = S.ctx.Music; if (M && M.enabled) M.toggle(); musicLabel(); }
    else if (a === 'quit') { api.close(); S.exit(); }
  }
  function musicLabel() {
    const M = S.ctx.Music, b = el.querySelector('[data-a="music"]');
    b.classList.toggle('hidden', !(M && M.enabled));
    let on = true; try { on = localStorage.getItem('crimson.music') !== 'off'; } catch (e) { /* storage blocked */ }
    b.querySelector('small').textContent = on ? 'ON' : 'OFF';
  }
  function showPage(p) {
    page = p;
    mainEl.classList.toggle('hidden', p !== 'main');
    pageEl.classList.toggle('hidden', p === 'main');
    if (p === 'missions') bodyEl.innerHTML = missionsHtml();
    if (p === 'controls') bodyEl.innerHTML = controlsHtml();
    focusI = 0; showFocus();
  }
  function missionsHtml() {
    const C = (S.content && S.content.CHAPTERS) || {}, M = S.missions || {}, cur = M.chapter;
    const obj = U.pieces.hud.objectiveText;
    const rows = [];
    for (const id of CHAPTER_ORDER) {
      const c = C[id]; if (!c || /^i\d/.test(id) || id === 'c0') continue;
      const done = M.done && M.done(id), now = id === cur;
      const state = now ? 'now' : done ? 'done' : 'later';
      rows.push(`<li class="${state}"><i>${now ? '▶' : done ? '完' : '·'}</i><span>CHAPTER ${c.n}</span><b>${state === 'later' ? '· · ·' : esc(c.title)}</b></li>`);
    }
    let side = '';
    try { const av = (M.available && M.available()) || []; if (av.length) side = `<h4>YOU CAN ALSO PLAY</h4><ul class="av">${av.map((id) => `<li>${esc((M.title && M.title(id)) || ((S.content.MISSIONS || {})[id] || {}).title || id)}</li>`).join('')}</ul>`; } catch (e) { /* none */ }
    return `<h3>MISSIONS</h3>${obj ? `<p class="now">NOW: ${esc(obj)}</p>` : ''}<ul class="log">${rows.join('')}</ul>${side}`;
  }
  function controlsHtml() {
    const d = U.touch ? 'touch' : U.device;
    const head = { key: 'KEYBOARD AND MOUSE', pad: 'CONTROLLER', touch: 'TOUCH' }[d];
    const L = U.KEY_LABELS[d] || U.KEY_LABELS.key;
    return `<h3>CONTROLS · ${head}</h3><div class="ctl">${CONTROLS.map(([t, rows]) => `<table><tr><th colspan="2">${t}</th></tr>${rows.filter(([, a]) => L[a]).map(([n, a]) => `<tr><td>${n}</td><td><kbd>${esc(L[a])}</kbd></td></tr>`).join('')}</table>`).join('')}</div>`;
  }
  const focusList = () => [...(page === 'main' ? mainEl : pageEl).querySelectorAll('.mBtns button:not(.hidden), .mBtns a')];
  function showFocus() { focusList().forEach((b, i) => b.classList.toggle('sel', i === focusI)); }
  function moveFocus(d) { const l = focusList(); if (!l.length) return; focusI = (focusI + d + l.length) % l.length; showFocus(); U.blip('move'); }

  const api = {
    get isOpen() { return isOpen; },
    open() {
      if (isOpen) return;
      if (map.api.isOpen) map.api.close();
      if (board.api.isOpen) board.api.close();
      isOpen = true; prevMode = S.mode === 'menu' ? 'play' : S.mode; S.mode = 'menu';
      U.input.unlock();
      const C = S.content && S.content.CHAPTERS && S.content.CHAPTERS[S.missions && S.missions.chapter];
      el.querySelector('.mCh').textContent = C ? `CHAPTER ${C.n} · ${String(C.title).toUpperCase()}` : '';
      el.querySelector('.mTip').textContent = U.touch ? 'TAP A BUTTON' : U.device === 'pad' ? 'D-PAD MOVES · A CHOOSES · B RESUMES' : 'ARROWS MOVE · ENTER CHOOSES · ESC RESUMES';
      musicLabel();
      el.querySelector('[data-a="map"]').classList.toggle('hidden', !(S.world && S.world.visible));
      el.classList.remove('hidden');
      showPage('main');
      document.body.classList.add('smenu');
    },
    close() {
      if (!isOpen) return;
      if (map.api.isOpen) map.api.close();
      if (board.api.isOpen) board.api.close();
      isOpen = false; el.classList.add('hidden');
      if (S.mode === 'menu') S.mode = prevMode || 'play';
      document.body.classList.remove('smenu');
    },
  };
  return {
    api,
    get page() { return isOpen ? page : null; },
    focusLabel: () => { const b = focusList()[focusI]; return b ? b.textContent.trim() : null; },
    // returns true when the menu used the input (it is open, or it just opened or closed)
    input(I) {
      if (!isOpen) return false;
      if (map.api.isOpen || board.api.isOpen) return false; // they take the input over the menu
      if (I.pressed('back') || I.pressed('pause')) { I.consume('back', 'pause'); U.blip('back'); if (page !== 'main') showPage('main'); else api.close(); return true; }
      if (I.pressed('up') || I.pressed('left')) moveFocus(-1);
      if (I.pressed('down') || I.pressed('right')) moveFocus(1);
      if (I.pressed('use')) {
        I.consumeKeyActions();
        const b = focusList()[focusI];
        if (b && b.tagName === 'A') { if (S.api && S.api.save) S.api.save(); location.href = b.getAttribute('href'); }
        else if (b && b.dataset.a === 'switch') b.click();
        else if (b) act(b.dataset.a, false);
      }
      if (I.pressed('music')) { I.consume('music'); act('music'); }
      return true;
    },
    tick() {},
    reset() { if (isOpen) { isOpen = false; el.classList.add('hidden'); document.body.classList.remove('smenu'); } page = 'main'; },
  };
}
