// Light Years Home v3: the title, pause, settings and the chapter end card (final.md 13.6). The title shows the game's
// name in the caption style over the live far web; any key or tap plays. Pause offers RESUME, LOG, SETTINGS, SWITCH
// GAME and QUIT TO ARCADE. Settings change controls, assists, motion, captions, sound and quality and report each
// change to main.js, which stores them (core/save.js) and applies them. The end card sits over the Andromeda edge
// while you keep driving behind it. Menus own their keys while open; ui/input.js leaves them alone.
import { MEDAL_NAME } from './hud.js';

const YEAR_S = 31557600;

// "Your speed, for real": the chapter's distance D in light-years over your play time τ in seconds. γ ≈ D·year/τ,
// 1 − β ≈ 1 / (2γ²), nines = floor(−log10(1 − β)) (final.md 13.6). 1.0645 Gly in 41 minutes is 26 nines.
export function realNines(distanceLy, playSeconds) {
  const tau = Math.max(1, Number(playSeconds) || 0);
  const gamma = ((Number(distanceLy) || 0) * YEAR_S) / tau;
  if (!(gamma > 1)) return 0;
  return Math.max(0, Math.floor(-Math.log10(1 / (2 * gamma * gamma)) + 1e-9));
}

// Play time for the end card: '0 H 41 MIN'.
export function playText(seconds) {
  const m = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  return `${Math.floor(m / 60)} H ${m % 60} MIN`;
}

// The settings rows: key, label, the choices [value, text], and the group.
export const SETTINGS = Object.freeze([
  { group: 'CONTROLS', key: 'scheme', label: 'Phone controls',
    choices: [['pedals', 'Stick and pedals'], ['one-thumb', 'One thumb']] },
  { group: 'CONTROLS', key: 'hand', label: 'Hand', choices: [['right', 'Right'], ['left', 'Left']] },
  { group: 'CONTROLS', key: 'tilt', label: 'Tilt to steer', note: 'Landscape',
    choices: [[false, 'Off'], [true, 'On']] },
  { group: 'CONTROLS', key: 'invertClimb', label: 'Invert climb', choices: [[false, 'Off'], [true, 'On']] },
  { group: 'CONTROLS', key: 'mouseSteer', label: 'Mouse steer', choices: [[false, 'Off'], [true, 'On']] },
  { group: 'ASSISTS', key: 'assists', label: 'Assists', choices: [['cruise', 'Cruise'], ['pilot', 'Pilot']] },
  { group: 'ASSISTS', key: 'autoDrift', label: 'Auto-drift', choices: [[true, 'On'], [false, 'Off']] },
  { group: 'SCREEN', key: 'reducedMotion', label: 'Reduced motion', choices: [[false, 'Off'], [true, 'On']] },
  { group: 'SCREEN', key: 'slowCaptions', label: 'Captions', choices: [[false, 'Normal'], [true, 'Slow']] },
  { group: 'SCREEN', key: 'quality', label: 'Graphics', choices: [['auto', 'Auto'], ['high', 'High'], ['mid', 'Mid'],
    ['low', 'Low']] },
  { group: 'SOUND', key: 'sound', label: 'Sound', choices: [[true, 'On'], [false, 'Off']] },
  { group: 'SOUND', key: 'music', label: 'Music', choices: [[true, 'On'], [false, 'Off']] },
]);

const KEYS_LINE = {
  touch: 'Drag to steer · GAS and BRAKE on the right',
  keys: 'WASD or arrows · Space drift · Shift boost',
  mouse: 'WASD or arrows · Space drift · Shift boost',
  pad: 'Left stick · RT gas · B drift · A boost',
};

function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

function button(parent, text, act, cls = '') {
  const b = h('button', cls, parent, text);
  b.type = 'button';
  if (act) b.dataset.act = act;
  return b;
}

/**
 * createMenus(root, handlers) → { title(state), pause(info), settings(s), endCard(summary), hide(), open, el }.
 * handlers: onPlay, onContinue, onResume, onLog, onSettings(patch, all) (called inside the click, so main.js can ask
 * for tilt permission), onQuit, onKeepDriving, onCopyLog() → string or Promise, onSources, onOpen(name).
 * title({ hasSave, saveLine, source }); pause({ where, earth }); settings(s) opens settings with the values in s
 * (game.settings plus tilt, mouseSteer, quality, sound, music); endCard({ chapter, earth, playSeconds, earthYears,
 * medals: { gold, silver, bronze }, scans: [n, of], secrets: [n, of], distanceLy, next }).
 */
export function createMenus(root, handlers = {}) {
  const H = handlers;
  const el = h('div', 'lyh-menus', root);
  let open = null, back = null, values = {};
  const call = (name, ...args) => (typeof H[name] === 'function' ? H[name](...args) : undefined);

  // ---------- title
  const title = h('section', 'm-screen m-title', el);
  title.setAttribute('aria-label', 'Light Years Home');
  const arcade = h('a', 'm-arcade', title, '‹ ARCADE');
  arcade.href = '/';
  const name = h('h1', 'm-name', title);
  ['LIGHT', 'YEARS', 'HOME'].forEach((w, i) => {
    const s = h('span', '', name, w);
    s.style.setProperty('--i', i);
    if (i < 2) name.appendChild(document.createTextNode(' '));
  });
  h('p', 'm-lede', title, 'A billion light-years out. Drive home.');
  const saveLine = h('p', 'm-save', title);
  const tActs = h('div', 'm-actions', title);
  const playB = button(tActs, 'PLAY', 'play', 'primary');
  const contB = button(tActs, 'CONTINUE', 'continue');
  button(tActs, 'SETTINGS', 'settings');
  const sw = button(tActs, 'SWITCH GAME', null);
  sw.dataset.switch = '';
  const keysLine = h('p', 'm-keys', title);

  // ---------- pause
  const pause = h('section', 'm-screen m-pause', el);
  pause.setAttribute('role', 'dialog');
  pause.setAttribute('aria-modal', 'true');
  pause.setAttribute('aria-labelledby', 'm-pause-title');
  const pCard = h('div', 'm-card', pause);
  const pTitle = h('h2', '', pCard, 'PAUSED');
  pTitle.id = 'm-pause-title';
  const pWhere = h('p', 'm-where', pCard);
  const pActs = h('div', 'm-actions', pCard);
  button(pActs, 'RESUME', 'resume', 'primary');
  button(pActs, 'LOG', 'log');
  button(pActs, 'SETTINGS', 'settings');
  const sw2 = button(pActs, 'SWITCH GAME', null);
  sw2.dataset.switch = '';
  const quit = h('a', 'button', pActs, 'QUIT TO ARCADE');
  quit.href = '/';
  quit.dataset.act = 'quit';

  // ---------- settings
  const sets = h('section', 'm-screen m-settings', el);
  sets.setAttribute('role', 'dialog');
  sets.setAttribute('aria-modal', 'true');
  sets.setAttribute('aria-labelledby', 'm-set-title');
  const sCard = h('div', 'm-card m-wide', sets);
  const sHead = h('div', 'm-head', sCard);
  const sTitle = h('h2', '', sHead, 'SETTINGS');
  sTitle.id = 'm-set-title';
  const sBack = button(sHead, '×', 'back', 'm-close');
  sBack.setAttribute('aria-label', 'Back');
  const sBody = h('div', 'm-body', sCard);
  const rows = new Map();
  let group = null;
  for (const row of SETTINGS) {
    if (row.group !== group) { group = row.group; h('h3', '', sBody, group); }
    const r = h('div', 'm-row', sBody);
    const lab = h('span', 'm-label', r, row.label);
    if (row.note) h('small', '', lab, row.note);
    const seg = h('div', 'm-seg', r);
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', row.label);
    const bs = row.choices.map(([v, text]) => {
      const b = button(seg, text, null);
      b.dataset.key = row.key;
      b.dataset.value = JSON.stringify(v);
      return b;
    });
    rows.set(row.key, bs);
  }
  const copyRow = h('div', 'm-row', sBody);
  h('span', 'm-label', copyRow, 'Ship’s notes');
  const copyB = button(copyRow, 'Copy log', 'copy');
  const copyNote = h('small', 'm-note', sBody, 'Copies your last runs to paste in a bug report. Nothing is sent.');
  copyNote.setAttribute('aria-live', 'polite');
  button(sCard, 'DONE', 'back', 'primary m-done');

  // ---------- end card
  const end = h('section', 'm-screen m-end', el);
  end.setAttribute('aria-labelledby', 'm-end-title');
  const eCard = h('div', 'm-card m-endcard', end);
  const eTitle = h('h2', '', eCard);
  eTitle.id = 'm-end-title';
  const eList = h('dl', 'm-stats', eCard);
  const eNext = h('p', 'm-next', eCard);
  const eActs = h('div', 'm-actions m-row-actions', eCard);
  button(eActs, 'KEEP DRIVING', 'keep', 'primary');
  button(eActs, 'LOG', 'log');
  const eArc = h('a', 'button', eActs, 'ARCADE');
  eArc.href = '/';
  const eReal = h('p', 'm-real', eCard);
  h('span', '', eReal, 'THE MISJUMP IS MADE UP. THE REST IS REAL. ');
  button(eReal, 'SOURCES', 'sources', 'm-link');

  const screens = { title, pause, settings: sets, end };
  for (const s of Object.values(screens)) s.hidden = true;

  function show(nameKey) {
    for (const [k, s] of Object.entries(screens)) s.hidden = k !== nameKey;
    open = nameKey;
    el.dataset.open = nameKey || '';
    call('onOpen', nameKey);
    const first = screens[nameKey]?.querySelector('button.primary, .m-seg button[aria-pressed="true"], button');
    if (first && !matchMedia?.('(pointer: coarse)')?.matches) first.focus({ preventScroll: true });
  }

  function hide() {
    for (const s of Object.values(screens)) s.hidden = true;
    open = null;
    back = null;
    el.dataset.open = '';
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    call('onOpen', null);
  }

  function paint(s) {
    values = { ...values, ...s };
    for (const [key, bs] of rows) {
      for (const b of bs) {
        const on = JSON.stringify(values[key]) === b.dataset.value;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
  }

  // One listener for every button.
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button, a');
    if (!b || !el.contains(b)) return;
    if (b.dataset.key) {
      const key = b.dataset.key, v = JSON.parse(b.dataset.value);
      paint({ [key]: v });
      call('onSettings', { [key]: v }, { ...values });
      return;
    }
    switch (b.dataset.act) {
      case 'play': call('onPlay'); break;
      case 'continue': call('onContinue'); break;
      case 'resume': call('onResume'); break;
      case 'log': call('onLog'); break;
      case 'settings': back = open; show('settings'); break;
      case 'back': if (back) show(back); else hide(); break;
      case 'keep': call('onKeepDriving'); hide(); break;
      case 'sources': call('onSources'); break;
      case 'quit':
        if (typeof H.onQuit === 'function') { e.preventDefault(); H.onQuit(); }
        break;
      case 'copy': {
        copyNote.textContent = 'Copying…';
        Promise.resolve(call('onCopyLog')).then((text) => {
          const t = typeof text === 'string' ? text : '';
          const done = () => { copyNote.textContent = t ? 'Copied.' : 'Nothing to copy yet.'; };
          const fail = () => { copyNote.textContent = 'Copy failed.'; };
          if (t && navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(done, fail);
          else done();
        });
        break;
      }
      default: break;
    }
  });

  // Any key or tap on the title plays (the main button: CONTINUE when there is a save).
  title.addEventListener('pointerdown', (e) => {
    if (open !== 'title' || e.target.closest('button, a')) return;
    e.preventDefault();
    primary();
  });
  function primary() { if (contB.hidden) call('onPlay'); else call('onContinue'); }
  function onKey(e) {
    if (!open || globalThis.GameSwitch?.isOpen) return;
    if (open === 'title') {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(Tab|Shift|Control|Alt|Meta|Escape)/.test(e.code || e.key)) return;
      if (e.target.closest?.('button, a') && (e.key === 'Enter' || e.key === ' ')) return;   // the button's own click
      e.preventDefault();
      primary();
    } else if (open === 'settings' && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (back) show(back); else hide();
    } else if (open === 'end' && e.key === 'Escape') {
      e.stopPropagation();
      call('onKeepDriving');
      hide();
    }
  }
  addEventListener('keydown', onKey, true);
  globalThis.GameSwitch?.wire?.();

  return {
    el,
    get open() { return open; },
    title(state = {}) {
      contB.hidden = !state.hasSave;
      playB.classList.toggle('primary', !state.hasSave);
      contB.classList.toggle('primary', !!state.hasSave);
      tActs.insertBefore(state.hasSave ? contB : playB, tActs.firstChild);
      saveLine.textContent = state.saveLine || '';
      saveLine.hidden = !state.saveLine;
      keysLine.textContent = KEYS_LINE[state.source] || KEYS_LINE.keys;
      show('title');
    },
    pause(info = {}) {
      pWhere.textContent = [info.where, info.earth].filter(Boolean).join(' · ');
      pWhere.hidden = !pWhere.textContent;
      show('pause');
    },
    settings(s = {}) {
      paint(s);
      if (open && open !== 'settings') back = open;
      show('settings');
    },
    paint,
    endCard(sum = {}) {
      eTitle.textContent = sum.chapter || 'CHAPTER I · THE WEB';
      eList.textContent = '';
      const m = sum.medals || {};
      const n = (pair, i) => pair?.[i] ?? 0;
      const medals = ['gold', 'silver', 'bronze'].map((k) => `${m[k] || 0} ${MEDAL_NAME[k]}`).join(' · ');
      const pairs = [
        ['', sum.earth || ''],
        ['FOR YOU', playText(sum.playSeconds)],
        ['FOR EARTH', sum.earthYears || ''],
        ['MEDALS', medals],
        ['SCANS', `${n(sum.scans, 0)}/${n(sum.scans, 1)} · SECRETS ${n(sum.secrets, 0)}/${n(sum.secrets, 1)}`],
        ['YOUR SPEED, FOR REAL', `${realNines(sum.distanceLy ?? 1.0645e9, sum.playSeconds)} NINES`],
      ];
      for (const [k, v] of pairs) {
        if (!v) continue;
        const row = h('div', '', eList);
        if (k) h('dt', '', row, k);
        h('dd', '', row, v);
      }
      eNext.textContent = sum.next || 'CHAPTER II · NEIGHBOURS · COMING';
      show('end');
    },
    hide,
    destroy() { removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
