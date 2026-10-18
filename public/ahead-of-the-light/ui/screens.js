// Ahead of the Light: the screens (final.md 9.2, 11.3, 12.7, 13, 14.2, 14.3, 16). Title, the toy's card, the break
// (the arrival line, your ship and the light at launch, the build row, the dock strip, the cards, SKIP and REROLL),
// the chart's lane chips (laid as DOM buttons over the chart main.js draws), the result card, pause, settings, the
// ship's log, the hangar and practice. Each screen is DOM built from a model; every button carries data-act and
// main.js does the rest. Input unlocks a moment after a screen appears (0.4 s; the result card 0.9 s), so a
// steering thumb cannot pick by accident. Keys: ← → move the highlight, Enter or Space picks, 1 to 4 pick a card.
import { FAMILIES } from '../core/cards.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c]);
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

// A button: act, its inner HTML, and { cls, data: { key: value }, attrs (raw), off }.
function button(act, inner, { cls = 'btn', data = {}, attrs = '', off = false } = {}) {
  const d = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="${cls}"${act ? ` data-act="${act}"` : ''}${d}${attrs}${off ? ' disabled' : ''}>`
    + `${inner}</button>`;
}
const back = () => button('back', 'BACK', { cls: 'btn main wide' });
const SWITCH = '<button type="button" class="btn quiet" data-switch>Switch game</button>';
// /arcade/switch.js wires the [data-switch] buttons it finds when the page loads; a screen drawn later asks it again
const wireSwitch = () => { try { if (typeof window !== 'undefined' && window.GameSwitch) window.GameSwitch.wire(); } catch (e) { /* no switcher */ } };

// ---------------------------------------------------------------- line art

const SVG_GLYPHS = {
  'ring-dot': (s, c) => `<circle cx="12" cy="12" r="7" ${s}/><circle cx="12" cy="12" r="2" fill="${c}"/>`,
  'two-chevrons': (s) => `<path d="M4 16l4-8 4 8M12 16l4-8 4 8" ${s}/>`,
  'chevron-flame': (s, c) => `<path d="M6 14l6-9 6 9" ${s}/><path d="M10 15l2 5 2-5z" fill="${c}"/>`,
  'cracked-ring': (s) => `<path d="M18.6 8.7A7 7 0 1 0 18.6 15.3" ${s}/><path d="M19 8.5l-3.5 3.5 3.5 3.5" ${s}/>`,
  'dashed-ring': (s) => `<circle cx="12" cy="12" r="7" ${s} stroke-dasharray="2.5 2.5"/>`,
  'well-ring': (s, c) => `<circle cx="12" cy="12" r="7" ${s}/><circle cx="12" cy="12" r="1.6" fill="${c}"/>`,
  'belt-dots': (s, c) => [4, 8, 12, 16, 20].map((x, i) => `<circle cx="${x}" cy="${12 + (i % 2) * 2}" r="1.3"`
    + ` fill="${c}"/>`).join(''),
  line: (s) => `<path d="M4 12h16" ${s}/>`,
  'dot-chevron': (s, c) => `<path d="M6 16l6-8 6 8" ${s}/><circle cx="12" cy="4.5" r="1.6" fill="${c}"/>`,
};

// A family glyph (12.7), or a lane icon (11.3), as thin line art in its colour.
export function glyphSvg(glyph, colour = '#fff', size = 24) {
  const s = `stroke="${colour}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const body = (SVG_GLYPHS[glyph] || SVG_GLYPHS['dot-chevron'])(s, colour);
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
const famGlyph = (fam, size) => (FAMILIES[fam] ? glyphSvg(FAMILIES[fam].glyph, FAMILIES[fam].colour, size)
  : glyphSvg('line', '#fff', size));
const shipSvg = (half = 3.5, colour = '#fff', size = 40) => {
  const w = 4 + half * 2.2;
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="M${20 - w} 30L20 8L${20 + w} 30L20 24Z" fill="${colour}"/></svg>`;
};
const mini = (c, label = true) => `<span class="mini" title="${esc(c.title)}" style="--fc:${c.colour}">`
  + `${famGlyph(c.fam, 16)}${label ? `<span>${esc(c.title)}</span>` : ''}</span>`;

// A card face (12.7): the family band, the glyph in its ring, the title, the rarity, the effect line with its number
// orange, the tag line. i: its slot; banish: show the × (only starters can go).
function cardHtml(c, i, { banish = false, focus = false, taken = false, compact = false } = {}) {
  if (!c) return '';
  const fx = c.num !== null && c.num !== undefined
    ? `${esc(c.before)}<b>${esc(c.num)}</b>${esc(c.after)}` : esc(c.text);
  const tag = c.tag ? `<span class="ctag${c.orange ? ' hot' : ''}">${esc(c.tag)}</span>` : '';
  const face = '<span class="band"></span>'
    + `<span class="glyph">${famGlyph(c.fam, 22)}</span>`
    + '<span class="cbody">'
    + `<span class="ctop"><span class="ctitle">${esc(c.title)}</span><span class="crar">${esc(c.rarity)}</span></span>`
    + `<span class="cfx">${fx}</span>${tag}</span>`
    + (i >= 0 ? `<span class="ckey" aria-hidden="true">${i + 1}</span>` : '');
  const cls = `card frame-${esc(c.frame)} band-${esc(c.band)}${compact ? ' compact' : ''}`;
  const x = banish && !taken ? button('banish', '×', { cls: 'banish', data: { i },
    attrs: ` aria-label="Banish ${esc(c.title)}"` }) : '';
  return `<div class="cardw${focus ? ' focus' : ''}${taken ? ' taken' : ''}" style="--fc:${c.colour}">`
    + button(i >= 0 ? 'pick' : null, face, { cls, data: i >= 0 ? { i } : {}, off: taken,
      attrs: ` aria-label="${esc(c.title)}: ${esc(c.text)}"` })
    + `${x}</div>`;
}

// The small ship at 2 × with its wings and the light's ring at launch, drawn into a canvas on the break.
function drawShip(cv, m) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 300, h = cv.clientHeight || 120;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const R = Math.max(60, Math.min(w * 0.9, 340)), cx = w / 2, cy = h * 0.42 - R;
  const sy = cy + R;
  // the light's ring at launch sits below yours by its time to catch (the burst ring's own scale, squeezed to fit)
  const k = m.light ? Math.max(0, Math.min(1, Math.log(1 + m.light.ttc / 2) / Math.log(1 + 300 / 2))) : 1;
  const Rb = R + 12 + k * Math.max(10, h - sy - 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.3, Math.PI * 0.7); ctx.stroke();
  const hot = m.light && m.light.ttc < 10;
  ctx.strokeStyle = hot ? 'rgba(255,255,255,0.95)' : 'rgba(190,215,255,0.8)'; ctx.lineWidth = hot ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, Rb, Math.PI * 0.34, Math.PI * 0.66); ctx.stroke();
  // the ship: a chevron at 2 ×, the shield bubble round it
  const half = m.ship.boat ? 5 : 10;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx, sy - 14); ctx.lineTo(cx + half, sy + 8); ctx.lineTo(cx, sy + 3); ctx.lineTo(cx - half, sy + 8);
  ctx.closePath(); ctx.fill();
  if (m.ship.shieldMax > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(cx, sy - 2, 22, 0, Math.PI * 2); ctx.stroke();
  }
  // the wings: hull bars left, fuel diamonds right, one every 5° along the ring
  const at = (deg) => {
    const a = Math.PI / 2 - (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * (R + 9), cy + Math.sin(a) * (R + 9), a];
  };
  for (let i = 0; i < m.ship.hullMax; i++) {
    const [x, y, a] = at(-(10 + i * 6));
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = i < m.ship.hull ? 1 : 0.35;
    if (i < m.ship.hull) { ctx.fillStyle = '#fff'; ctx.fillRect(-7, -2.5, 14, 5); }
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(-7, -2.5, 14, 5); }
    ctx.restore();
  }
  for (let i = 0; i < m.ship.fuelCap; i++) {
    const [x, y] = at(10 + i * 6);
    const fill = Math.max(0, Math.min(1, m.ship.fuel - i));
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = fill > 0 ? 1 : 0.35;
    ctx.strokeStyle = '#f08a2c'; ctx.lineWidth = 1.2; ctx.strokeRect(-4, -4, 8, 8);
    if (fill > 0) { ctx.fillStyle = '#f08a2c'; ctx.fillRect(-4, 4 - 8 * fill, 8, 8 * fill); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the screens

export function createScreens({ root, onAction }) {
  const S = { name: null, shownAt: 0, unlock: 0, focus: 0, n: 0, model: null, el: null, chips: [] };
  const layer = document.createElement('div');
  layer.id = 'layer';
  layer.dataset.ui = '1';
  root.appendChild(layer);
  const locked = () => now() - S.shownAt < S.unlock * 1000;

  // a rotation or a resized window at the break: the ship picture is drawn again for its box's new size (a frame
  // later, once main.js has set the new layout)
  window.addEventListener('resize', () => {
    const cv = S.name === 'break' && S.el ? S.el.querySelector('.shipcv') : null;
    if (cv && S.model) requestAnimationFrame(() => { drawShip(cv, S.model); moreCards(S.el); });
  });
  // On a short phone the offer scrolls in its own row: while cards wait below, its bottom edge fades (.more).
  function moreCards(el) {
    const o = el && el.querySelector('.s-break .offer');
    if (o) o.classList.toggle('more', o.scrollTop + o.clientHeight < o.scrollHeight - 2);
  }

  root.addEventListener('click', (e) => {
    // the game switcher's button belongs to /arcade/switch.js: a tap on it never reaches the screen under it (on the
    // title that screen is TAP TO FLY, so it started a run behind the switcher)
    if (e.target.closest('[data-switch], a[href]')) return;
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || locked()) return;
    e.preventDefault();
    onAction(b.dataset.act, { ...b.dataset });
  });

  function mount(name, html, { unlock = 0, cls = '', act = null, label = '' } = {}) {
    const fresh = S.name !== name;
    S.name = name;
    document.documentElement.dataset.screen = name;
    if (fresh) { S.shownAt = now(); S.unlock = unlock; S.focus = 0; }
    const title = document.getElementById('title');
    if (title) title.hidden = name !== 'title';
    if (name === 'title') { layer.innerHTML = ''; layer.hidden = true; return null; }
    layer.hidden = false;
    layer.innerHTML = `<section class="screen s-${name} ${cls}${fresh ? '' : ' redraw'}"${act ? ` data-act="${act}"` : ''}`
      + ` aria-label="${esc(label || name)}" data-ui="1">${html}</section>`;
    S.el = layer.firstElementChild;
    wireSwitch();
    return S.el;
  }
  function hide() {
    S.name = null;
    document.documentElement.dataset.screen = '';
    layer.innerHTML = '';
    layer.hidden = true;
    const title = document.getElementById('title');
    if (title) title.hidden = true;
  }

  // ---------- title (16) ----------
  function title(m) {
    const t = document.getElementById('title');
    if (!t) return;
    const chips = [button('hangar', `SHIP: ${esc(m.ship)} ›`, { cls: 'chip' })];
    if (m.goOn) chips.push(button('resume-save', esc(m.goOn), { cls: 'chip hot' }));
    if (m.daily) chips.push(button('daily', esc(m.daily), { cls: 'chip' }));
    if (m.practice) chips.push(button('practice', 'PRACTICE', { cls: 'chip' }));
    if (m.log) chips.push(button('log', `LOG · ${m.pages} PAGES`, { cls: 'chip' }));
    if (m.redshift) chips.push(button('redshift', esc(m.redshift), { cls: 'chip' }));
    if (m.easy) chips.push(button('easy', esc(m.easy), { cls: 'chip', attrs: ` aria-pressed="${m.easyOn}"` }));
    chips.push(button('settings', 'SETTINGS', { cls: 'chip' }));
    t.innerHTML = '<a class="back" href="/">‹ Arcade</a>'
      + '<h1>AHEAD OF THE <span>LIGHT</span></h1>'
      + '<p class="sub">RACE HOME BEFORE THE BURST</p>'
      + `${m.best ? `<p class="best">${esc(m.best)}</p>` : ''}`
      + button('fly', '<span class="touch">TAP TO FLY</span><span class="desk">CLICK OR PRESS SPACE</span>',
        { cls: 'go', attrs: ' id="go"' })
      + `<div class="row chips">${chips.join('')}</div>`
      + `<div class="row">${SWITCH}</div>`;
    t.dataset.act = 'fly';
    t.dataset.ui = '1';
    mount('title', '');
    t.hidden = false;
    wireSwitch();
  }

  // ---------- the toy's card (24.2) ----------
  function toyCard(m) {
    const rows = m.rows.map(([a, b]) => `<p><span>${esc(a)}</span><b>${esc(b)}</b></p>`).join('');
    mount('toy', `<div class="panel toy"><h2>${esc(m.title || 'THE TOY')}</h2>${rows}`
      + button('toy-again', 'AGAIN', { cls: 'btn main wide' })
      + button('title', 'THE FULL RUN', { cls: 'btn quiet wide' }) + '</div>', { unlock: 0.6, label: 'The toy' });
  }

  // ---------- the break (9.2, 16) ----------
  function dockHtml(m) {
    if (!m.dock) return '';
    // TUNE asks which card: its choices take the strip's place until one is picked or the ask is dropped
    if (m.tunePick) {
      return '<div class="tunepick"><span>TUNE WHICH CARD?</span>'
        + m.tunePick.map((c) => button('tune', esc(c.title), { cls: 'chip', data: { card: c.id } })).join('')
        + button('tune-cancel', 'CANCEL', { cls: 'chip quiet' }) + '</div>';
    }
    const chips = m.dock.chips.map((c) => {
      if (c.auto) return `<div class="dchip auto">${esc(c.label)}</div>`;
      const state = c.bought ? ' bought' : c.ok ? '' : ' off';
      const sub = c.bought ? 'BOUGHT · TAP TO REFUND' : c.ok ? `${esc(c.text)} LEAD`
        : c.why === 'full' ? 'FULL' : esc(c.why || '');
      return button(c.bought ? 'refund' : 'buy', `<b>${esc(c.label)}</b><span>${sub}</span>`,
        { cls: `dchip${state}`, data: { chip: c.id }, off: !c.ok && !c.bought });
    }).join('');
    return `<div class="dock" aria-label="Dock">${chips}</div>`;
  }
  function brk(m) {
    S.model = m;
    const o = m.offer;
    const cards = o ? o.cards : [];
    S.n = cards.length;
    const build = m.build.length ? m.build.map((c) => mini(c)).join('') : '<span class="none">NO CARDS YET</span>';
    const reroll = m.canReroll ? button('reroll', `REROLL · ${m.rerolls}`, { cls: 'btn small' }) : '';
    const lines = m.lines.length ? `<p class="news">${m.lines.map(esc).join(' · ')}</p>` : '';
    // a RISK tag already says how many to pick ("PICK 1 OF 4 · RARE+"), so it stands alone
    const own = o && o.tag && /^PICK /.test(o.tag) && !o.caption;
    const offerHead = o ? `<p class="ohead">${own ? `<span>${esc(o.tag)}</span>`
      : `${esc(o.caption || (o.left > 1 ? `PICK ${o.left}` : 'PICK ONE'))}${o.tag ? ` <span>${esc(o.tag)}</span>` : ''}`}`
      + `${o.bonus ? ` <span class="hot">${esc(o.bonus)}</span>` : ''}`
      + '</p>' : '';
    const banishable = (c) => m.banishes > 0 && c.kind !== 'fusion' && c.kind !== 'legend' && c.kind !== 'trophy';
    const cardsHtml = o ? cards.map((c, i) => cardHtml(c, i, { banish: banishable(c), focus: S.focus === i,
      taken: c.taken, compact: cards.length > 3 })).join('')
      : `<p class="nocard">${esc(m.noCard ? 'NO CARD FROM THE VOID' : '')}</p>`;
    const skip = button('skip', esc(o ? m.skip : m.skip || 'GO ON'), { cls: o ? 'btn skip' : 'btn main skip' });
    const el = mount('break', `<header class="arrive"><p class="type">${esc(m.header)}</p>${lines}</header>`
      + '<div class="status">'
      + '<div class="shipbox"><canvas class="shipcv" aria-hidden="true"></canvas>'
      + `<p class="lead">${esc(m.light.line)}</p></div>`
      + `<div class="buildrow"><div class="minis">${build}</div>${reroll}</div>${dockHtml(m)}</div>`
      + `<div class="offer n${cards.length}">${offerHead}<div class="cards">${cardsHtml}</div></div>`
      + `<footer class="foot">${skip}</footer>`, { unlock: m.unlock ?? 0.4, label: 'The break',
      cls: m.dock ? 'docked' : '' });
    const cv = el.querySelector('.shipcv');
    if (cv) requestAnimationFrame(() => drawShip(cv, m));
    const off = el.querySelector('.offer');
    if (off) {
      off.addEventListener('scroll', () => moreCards(el), { passive: true });
      requestAnimationFrame(() => moreCards(el));
    }
  }

  // ---------- the chart's chips (11.3): DOM buttons over the chart main.js draws ----------
  function chart(m, rects) {
    S.model = m;
    S.n = m.lanes.length;
    S.chips = rects || [];
    const px = (v) => `${Math.round(v)}px`;
    const chips = m.lanes.map((l, i) => {
      const r = S.chips.find((c) => c.i === i) || null;
      const style = (r ? `left:${px(r.x)};top:${px(r.y)};width:${px(r.w)};height:${px(r.h)};` : '')
        + `--fc:${l.colour}`;
      const ic = l.icon === 'family' ? famGlyph(l.fam, 20) : glyphSvg(l.icon, '#fff', 20);
      const tags = l.tags.map((t, k) => `<span class="${k ? 'cond' : ''}">${esc(t)}</span>`).join('');
      // a long name (MARKARIAN'S) runs smaller so it clears the chip's icon
      const nm = String(l.short || '').length > 9 ? '<b class="long">' : '<b>';
      return button('lane', `${ic}${nm}${esc(l.short)}</b>${tags}`, {
        cls: `lane${S.focus === i ? ' focus' : ''} k-${esc(l.kind)}`, data: { i },
        attrs: ` style="${style}" aria-label="${esc(l.line)}: ${esc(l.tags.join(', '))}"` });
    }).join('');
    mount('chart', `<p class="chead">PICK THE NEXT LANE</p>${chips}`, { unlock: 0.4, label: 'The chart' });
  }

  // ---------- the result card (13, 16) ----------
  function result(m) {
    S.model = m;
    const build = m.build.map((c) => mini(c, false)).join('');
    const medals = (m.medals || []).map((x) => `<span class="medal ${esc(x.medal)}">`
      + `${esc(x.medal.toUpperCase())} · ${esc(x.name)}</span>`).join('');
    const easy = m.easyOffer ? button('easy', `EASY LIGHT: ${m.easyOn ? 'ON' : 'OFF'}`, { cls: 'chip',
      attrs: ` aria-pressed="${m.easyOn}"` }) : '';
    const p = (cls, text) => (text ? `<p class="${cls}">${esc(text)}</p>` : '');
    mount('result', '<div class="panel res">'
      + `<h2 class="${m.home ? 'home' : ''}">${esc(m.title)}</h2>`
      + (m.firstHome ? '<p class="first">FIRST HOME</p>' : '')
      + `<p class="where">${esc(m.where)}${m.best ? `<span class="rbest">${esc(m.best)}</span>` : ''}</p>`
      + p('rline', m.line) + p('cause', m.cause) + p('goal', m.goal)
      + `<p class="years">${esc(m.yearsLine)}${m.rank ? ` · <b>${esc(m.rank)}</b>` : ''}</p>`
      + (medals ? `<p class="medals">${medals}</p>` : '')
      + `<div class="rrow">${button('again', 'AGAIN', { cls: 'btn main again' })}<span class="rbuild">${build}</span></div>`
      + `<div class="rrow small">${m.log ? `<span class="logline">${esc(m.log)}</span>` : ''}${easy}`
      + button('copylog', 'COPY LOG', { cls: 'chip' }) + button('title', 'TITLE', { cls: 'chip' }) + '</div>'
      + '<p class="tapnote"><span class="touch">TAP ANYWHERE TO GO AGAIN</span>'
      + '<span class="desk">SPACE OR ENTER TO GO AGAIN</span></p>'
      + '</div>', { unlock: m.unlock ?? 0.9, act: 'again', label: 'The result' });
  }

  // ---------- pause (16) ----------
  function pause(m) {
    const build = m.build.length ? m.build.map((c) => cardHtml(c, -1, { compact: true })).join('')
      : '<p class="none">NO CARDS YET</p>';
    const quit = m.canQuit ? button('quit', 'QUIT RUN', { cls: 'btn quiet' }) : '';
    mount('pause', '<div class="panel pausep"><div class="pcol">'
      + `<h2>PAUSED</h2><p class="where">${esc(m.where)}</p><p class="years">${esc(m.years)}</p>`
      + button('resume', m.regrip ? 'RESUME · THEN HOLD TO GO ON' : 'RESUME', { cls: 'btn main wide' })
      + '<div class="row">'
      + button('mute', `SOUND: ${m.sound ? 'ON' : 'OFF'}`, { attrs: ` aria-pressed="${!m.sound}"` })
      + button('settings', 'SETTINGS') + '</div>'
      + `<div class="row">${quit}${SWITCH}</div></div>`
      + `<div class="pbuild">${build}</div>`
      + '</div>', { unlock: 0.25, label: 'Paused' });
  }

  // ---------- settings (16) ----------
  function settings(m) {
    const row = (key, label, on, note = '') => button('set',
      `<span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><b>${on ? 'ON' : 'OFF'}</b>`,
      { cls: 'toggle', data: { key }, attrs: ` role="switch" aria-checked="${Boolean(on)}"` });
    mount('settings', '<div class="panel setp"><h2>SETTINGS</h2><div class="toggles">'
      + row('sound', 'SOUND', m.sound)
      + row('slowCaptions', 'SLOW CAPTIONS', m.slowCaptions)
      + row('fixedCam', 'FIXED CAMERA', m.fixedCam, 'The world never rolls')
      + row('button', 'ACTION BUTTON', m.button, 'A button for grabs, bottom right')
      + row('reduced', 'REDUCED MOTION', m.reduced, 'No shake, softer flashes')
      + row('barks', 'RIVAL BARKS', m.barks)
      + `</div>${back()}</div>`, { unlock: 0.2, label: 'Settings' });
  }

  // ---------- the ship's log (14.2) ----------
  function log(m) {
    const tabs = m.tabs.map((t) => button('logtab', `${esc(t.id)} <small>${t.found}/${t.total}</small>`,
      { cls: `tab${t.id === m.tab ? ' on' : ''}`, data: { tab: t.id } })).join('');
    const pages = m.pages.map((pg) => `<li class="${pg.found ? 'found' : ''}"><span class="ring"></span>`
      + `${esc(pg.found ? pg.label : pg.hint || '?')}</li>`).join('');
    mount('log', `<div class="panel logp"><h2>THE SHIP'S LOG <small>${m.found} OF ${m.total} PAGES</small></h2>`
      + `<p class="next">${esc(m.next || '')}</p><div class="tabs">${tabs}</div><ul class="pages">${pages}</ul>`
      + `${back()}</div>`, { unlock: 0.2, label: 'The log' });
  }

  // ---------- the hangar (14.3) ----------
  function hangar(m) {
    const ships = m.ships.map((s) => button('ship',
      `${shipSvg(s.half, s.unlocked ? '#fff' : 'rgba(255,255,255,0.25)', 36)}<b>${esc(s.name)}</b>`
      + `<span>${esc(s.unlocked ? s.stats : `LOCKED · ${s.feat}`)}</span><small>${esc(s.unlocked ? s.quirk : '')}</small>`,
      { cls: `ship${s.selected ? ' on' : ''}${s.unlocked ? '' : ' locked'}`, data: { id: s.id },
        attrs: s.unlocked ? '' : ' aria-disabled="true"' })).join('');
    mount('hangar', `<div class="panel hangp"><h2>THE HANGAR</h2><div class="ships">${ships}</div>${back()}</div>`,
      { unlock: 0.2, label: 'The hangar' });
  }

  // ---------- practice (14.4): a leg once reached ----------
  function practice(m) {
    const legs = m.legs.map((l) => button('practice-leg',
      `${l.i + 1} · ${esc(l.name)}${l.medal ? ` · ${esc(l.medal.toUpperCase())}` : ''}`,
      { cls: `chip${l.open ? '' : ' off'}`, data: { i: l.i }, off: !l.open })).join('');
    mount('practice', '<div class="panel pracp"><h2>PRACTICE</h2>'
      + `<p class="where">ONE LEG · LANTERN · NO CARDS</p><div class="legs">${legs}</div>${back()}</div>`,
    { unlock: 0.2, label: 'Practice' });
  }

  // ---------- keys on the cards and the chart ----------
  function move(d) { S.focus = (S.focus + d + S.n) % S.n; refocus(); return true; }
  function key(code) {
    const n = S.n;
    if (S.name === 'break' || S.name === 'chart') {
      if (locked()) return true;
      const act = S.name === 'break' ? 'pick' : 'lane';
      if ((code === 'ArrowLeft' || code === 'ArrowUp') && n) return move(-1);
      if ((code === 'ArrowRight' || code === 'ArrowDown') && n) return move(1);
      if ((code === 'Enter' || code === 'Space') && n) { onAction(act, { i: String(S.focus) }); return true; }
      const d = /^(?:Digit|Numpad)([1-4])$/.exec(code);
      if (d && Number(d[1]) <= n) { onAction(act, { i: String(Number(d[1]) - 1) }); return true; }
      if (code === 'KeyR' && S.name === 'break') { onAction('reroll', {}); return true; }
      if (code === 'KeyS' && S.name === 'break') { onAction('skip', {}); return true; }
      return false;
    }
    if (S.name === 'result') {
      if (locked()) return true;
      if (code === 'Space' || code === 'Enter') { onAction('again', {}); return true; }
      return false;
    }
    if (S.name === 'toy' && (code === 'Space' || code === 'Enter')) { onAction('toy-again', {}); return true; }
    return false;
  }
  function refocus() {
    if (!S.el) return;
    const sel = S.name === 'break' ? '.cardw' : '.lane';
    S.el.querySelectorAll(sel).forEach((x, i) => x.classList.toggle('focus', i === S.focus));
    const f = S.el.querySelectorAll(S.name === 'break' ? '.card' : '.lane')[S.focus];
    if (f) f.focus({ preventScroll: true });
  }

  return {
    title, toyCard, brk, chart, result, pause, settings, log, hangar, practice, hide, key,
    get name() { return S.name; },
    get open() { return S.name !== null; },
    unlocked: () => !locked(),
    layer,
  };
}
