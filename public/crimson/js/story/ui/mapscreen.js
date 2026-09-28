// js/story/ui/mapscreen.js : the full paper map (M, pad Back, a tap on the minimap, or MAP in the menu).
// The world's painted map (regions and revealed places are inked on it by WORLD), with the hero, the van,
// the objective and other markers, the vortex cairns and a legend. A click or tap sets a waypoint (the
// GPS line leads there when no objective does); on a found cairn outside a mission it offers fast travel
// (S.missions.travel). The wheel, a pinch or pad LB/RB zoom; a drag or the right stick pans; the arrows,
// d-pad or left stick move a cursor that E, Enter or pad A uses. Esc, M, pad B or ✕ closes it. The story
// clock stops while it is open.
import { CAIRNS, INTERIORS, PLACES, REGION_NAMES } from '../world/places.js';
import { GLYPHS } from '../types.js';

const CRIMSON = '#d2263f', INK = '#20140e', PAPER = '#e8dcc0';
const CAIRN_NAMES = { cairn_airport: 'Airport Mesa', cairn_bell: 'Bell Rock', cairn_cathedral: 'Cathedral Rock', cairn_boynton: 'Boynton Canyon' };

export function createMapScreen(U) {
  const { S, make, root } = U;
  const el = make('div', 'sMap hidden', root, `<div class="mIn"><canvas></canvas><div class="mSide"><h3>SEDONA</h3><ul class="leg">
    <li><i class="lg you"></i>YOU</li><li><i class="lg obj"></i>OBJECTIVE</li><li><i class="lg wp"></i>WAYPOINT</li><li><i class="lg van"></i>THE VAN</li><li><i class="lg cairn">渦</i>CAIRN</li><li><i class="lg giver">熊</i>A FRIEND</li></ul>
    <p class="where"></p><p class="mHelp"></p><div class="ask hidden"><p></p><button type="button" class="main" data-a="go">TRAVEL</button><button type="button" data-a="no">CANCEL</button></div></div>
    <button type="button" class="mX" aria-label="Close the map">✕</button></div>`);
  el.id = 'sMap';
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const ask = el.querySelector('.ask');
  let open = false, prevMode = 'play', fromMenu = false;
  const view = { cx: 0, cz: 0, s: 0.3, min: 0.2, max: 2 };
  const cursor = { x: 0, z: 0, on: false };
  let pending = null, dirty = true, size = 0;
  const HALF = () => (S.world && S.world.HALF) || 1000;

  function known() {
    const s = new Set();
    try { for (const id of (S.save && S.save.get().cairns) || []) s.add(id); } catch (e) { /* no save */ }
    for (const id of Object.keys(CAIRNS)) if (S.flags && (S.flags[id] || S.flags[`found:${id}`])) s.add(id);
    return s;
  }
  const canTravel = () => !(S.missions && S.missions.active) && !!(S.missions && S.missions.travel);
  // the canvas is square (the map is), as big as the screen allows beside the legend (under it on a tall
  // screen): the whole map fits with no empty bars
  function fit() {
    const cs = getComputedStyle(el), side = el.querySelector('.mSide');
    const aw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const tall = getComputedStyle(el.querySelector('.mIn')).flexDirection === 'column';
    const sq = Math.max(120, Math.floor(Math.min(tall ? aw : aw - side.offsetWidth - 18, tall ? ah - side.offsetHeight - 18 : ah)));
    if (cv.style.width !== `${sq}px`) { cv.style.width = cv.style.height = `${sq}px`; }
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; dirty = true; }
    size = Math.min(r.width, r.height);
    view.min = size / (2 * HALF());
    view.s = Math.max(view.min, Math.min(view.max, view.s));
  }
  // world <-> screen (css px inside the canvas)
  const toScreen = (x, z) => { const r = cv.getBoundingClientRect(); return [r.width / 2 + (x - view.cx) * view.s, r.height / 2 + (z - view.cz) * view.s]; };
  const toWorld = (px, py) => { const r = cv.getBoundingClientRect(); return [view.cx + (px - r.width / 2) / view.s, view.cz + (py - r.height / 2) / view.s]; };
  function clampView() {
    const r = cv.getBoundingClientRect(), H = HALF();
    const hx = Math.max(0, H - r.width / 2 / view.s), hz = Math.max(0, H - r.height / 2 / view.s);
    view.cx = Math.max(-hx, Math.min(hx, view.cx)); view.cz = Math.max(-hz, Math.min(hz, view.cz));
  }
  function draw() {
    fit(); clampView();
    const dpr = cv.width / (cv.getBoundingClientRect().width || 1), W = cv.width / dpr, Hh = cv.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0c0907'; g.fillRect(0, 0, W, Hh);
    const img = S.world && S.world.mapImage, H = HALF();
    const [x0, y0] = toScreen(-H, -H);
    if (img && img.width) g.drawImage(img, x0, y0, 2 * H * view.s, 2 * H * view.s);
    else { g.fillStyle = PAPER; g.fillRect(x0, y0, 2 * H * view.s, 2 * H * view.s); }
    const k = Math.max(0.8, Math.min(1.6, view.s / 0.45));
    // cairns
    const kn = known();
    for (const [id, c] of Object.entries(CAIRNS)) {
      const [x, y] = toScreen(c.x, c.z), found = kn.has(id);
      g.fillStyle = found ? 'rgba(14,8,6,0.9)' : 'rgba(80,60,50,0.55)'; g.strokeStyle = found ? CRIMSON : 'rgba(40,24,16,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 11 * k, 0, 7); g.fill(); g.stroke();
      g.fillStyle = found ? '#f4efe4' : 'rgba(240,230,210,0.6)'; g.font = `${Math.round(15 * k)}px "Zhi Mang Xing", "Ma Shan Zheng", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('渦', x, y + 1);
    }
    // markers
    const hud = U.pieces.hud;
    for (const m of hud.allMarkers()) {
      if (m.hidden) continue;
      const kind = hud.kindOf(m), [x, y] = toScreen(m.x, m.z);
      if (kind === 'giver') { g.fillStyle = 'rgba(14,8,6,0.9)'; g.strokeStyle = CRIMSON; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12 * k, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#f4efe4'; g.font = `${Math.round(16 * k)}px "Zhi Mang Xing", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(GLYPHS[m.who] || m.glyph || '●', x, y + 1); }
      else if (kind === 'waypoint') { g.strokeStyle = CRIMSON; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - 8 * k, y - 8 * k); g.lineTo(x + 8 * k, y + 8 * k); g.moveTo(x + 8 * k, y - 8 * k); g.lineTo(x - 8 * k, y + 8 * k); g.stroke(); }
      else if (kind === 'danger') { g.fillStyle = '#c6ff1a'; g.beginPath(); g.arc(x, y, 6 * k, 0, 7); g.fill(); }
      else { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = CRIMSON; g.strokeStyle = '#f4efe4'; g.lineWidth = 2; g.fillRect(-7 * k, -7 * k, 14 * k, 14 * k); g.strokeRect(-7 * k, -7 * k, 14 * k, 14 * k); g.restore(); }
    }
    // the GPS line from the minimap
    const pts = U.pieces.mini.route;
    if (pts && pts.length > 1) { g.strokeStyle = CRIMSON; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); pts.forEach((p, i) => { const [x, y] = toScreen(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); }
    // the van and the hero
    const van = S.vehicles && S.vehicles.player;
    if (van && !(S.drive && S.drive.riding === van)) { const [x, y] = toScreen(van.pos.x, van.pos.z); g.save(); g.translate(x, y); g.rotate(-van.yaw); g.fillStyle = '#f4efe4'; g.strokeStyle = INK; g.lineWidth = 1.5; g.fillRect(-4 * k, -8 * k, 8 * k, 16 * k); g.strokeRect(-4 * k, -8 * k, 8 * k, 16 * k); g.restore(); }
    if (S.hero) {
      const hp = heroAt(), [x, y] = toScreen(hp.x, hp.z), f = S.hero.face;
      g.save(); g.translate(x, y); g.rotate(Math.atan2(Math.cos(f), Math.sin(f)));
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(13 * k, 0); g.lineTo(-8 * k, 8 * k); g.lineTo(-4 * k, 0); g.lineTo(-8 * k, -8 * k); g.closePath(); g.stroke(); g.fill();
      g.restore();
    }
    // the cursor (keys and pad)
    if (cursor.on) { const [x, y] = toScreen(cursor.x, cursor.z); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 14, 0, 7); g.moveTo(x - 22, y); g.lineTo(x - 8, y); g.moveTo(x + 8, y); g.lineTo(x + 22, y); g.moveTo(x, y - 22); g.lineTo(x, y - 8); g.moveTo(x, y + 8); g.lineTo(x, y + 22); g.stroke(); }
    dirty = false;
    // where the hero is
    const hp = heroAt(), reg = S.world && S.world.regionAt && S.hero ? S.world.regionAt(hp.x, hp.z) : '';
    el.querySelector('.where').textContent = reg ? `YOU ARE IN ${String(REGION_NAMES[reg] || reg).toUpperCase().replace(/_/g, ' ')}` : '';
  }
  // where the hero is on the map: inside a room, at its door
  function heroAt() {
    const p = S.hero ? S.hero.pos : { x: 0, y: 0, z: 0 }, I = S.world && S.world.interiors;
    const id = I && I.roomAt ? I.roomAt(p.x, p.y, p.z) : null, door = id && INTERIORS[id] && PLACES[INTERIORS[id].door];
    return door ? { x: door.x, z: door.z } : p;
  }
  // a tap or the cursor at (x, z): a found cairn offers travel, the waypoint clears, else a new waypoint
  function useAt(x, z) {
    const kn = known();
    for (const [id, c] of Object.entries(CAIRNS)) {
      if (Math.hypot(c.x - x, c.z - z) * view.s > 11 * Math.max(0.8, Math.min(1.6, view.s / 0.45)) + 3) continue; // on the cairn's disc
      if (!kn.has(id)) { U.pieces.hud.toast('Find this cairn first.'); return; }
      if (!canTravel()) { U.pieces.hud.toast('Not during a mission.'); return; }
      pending = id;
      ask.querySelector('p').textContent = `TRAVEL TO ${(CAIRN_NAMES[id] || id).toUpperCase()}?`;
      ask.classList.remove('hidden');
      return;
    }
    const wp = U.pieces.hud.allMarkers().find((m) => m.id === 'waypoint');
    if (wp && Math.hypot(wp.x - x, wp.z - z) * view.s < 16) { U.pieces.hud.unmark('waypoint'); U.blip('back'); dirty = true; return; }
    const H = HALF();
    U.pieces.hud.marker('waypoint', { x: Math.max(-H, Math.min(H, x)), z: Math.max(-H, Math.min(H, z)), kind: 'waypoint', label: 'WAYPOINT' });
    U.blip('pick'); dirty = true;
  }
  function travel(yes) {
    const id = pending; pending = null; ask.classList.add('hidden');
    if (!yes || !id) return;
    api.close();
    if (U.pieces.menu.api.isOpen) U.pieces.menu.api.close();
    try { S.missions.travel(id); } catch (e) { console.error('[ui] travel', e); }
  }
  ask.addEventListener('click', (e) => { e.stopPropagation(); const b = e.target.closest('button'); if (b) travel(b.dataset.a === 'go'); });
  el.querySelector('.mX').addEventListener('click', (e) => { e.stopPropagation(); api.close(); });

  // mouse and touch: a tap sets, a drag pans, the wheel and a pinch zoom
  const ptrs = new Map();
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; } });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && drag) { const [a, b] = [...ptrs.values()]; zoomTo(drag.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, drag.pinch)); return; }
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) { view.cx -= dx / view.s; view.cz -= dy / view.s; dirty = true; }
  });
  const up = (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) drag = null;
    if (e.type === 'pointerup' && ptrs.size === 0 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8) { const r = cv.getBoundingClientRect(); const [x, z] = toWorld(e.clientX - r.left, e.clientY - r.top); cursor.on = false; useAt(x, z); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(view.s * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  function zoomTo(s) { view.s = Math.max(view.min, Math.min(view.max, s)); dirty = true; }

  const api = {
    get isOpen() { return open; },
    open() {
      if (open || !S.world || !S.world.visible) return;
      open = true; fromMenu = U.pieces.menu.api.isOpen;
      if (!fromMenu) { prevMode = S.mode; S.mode = 'menu'; }
      U.pushModal('map', false);
      U.input.unlock();
      el.classList.remove('hidden');
      fit();
      const hp = heroAt();
      // the whole map at first; the wheel, a pinch or LB RB zoom in
      view.s = view.min; view.cx = hp.x; view.cz = hp.z;
      cursor.x = hp.x; cursor.z = hp.z; cursor.on = U.device === 'pad';
      pending = null; ask.classList.add('hidden');
      el.querySelector('.mHelp').textContent = U.touch ? 'TAP TO MARK A WAYPOINT · PINCH TO ZOOM' : U.device === 'pad' ? 'A MARKS A WAYPOINT · LB RB ZOOM · B CLOSES' : 'CLICK TO MARK A WAYPOINT · WHEEL ZOOMS · M CLOSES';
      dirty = true; draw();
      U.blip('pick');
    },
    close() {
      if (!open) return;
      open = false; el.classList.add('hidden');
      U.popModal('map');
      if (!fromMenu && S.mode === 'menu') S.mode = prevMode === 'menu' ? 'play' : prevMode;
      U.blip('back');
    },
  };
  return {
    api,
    input(I, raw = 1 / 60) {
      if (!open) return false;
      if (pending) {
        if (I.pressed('use')) { I.consumeKeyActions(); travel(true); }
        else if (I.pressed('back') || I.pressed('pause')) { I.consume('back', 'pause'); travel(false); }
        return true;
      }
      if (I.pressed('back') || I.pressed('pause') || I.pressed('map')) { I.consume('back', 'pause', 'map'); api.close(); return true; }
      // cursor: arrows, d-pad or the left stick
      const kx = (I.held('right') ? 1 : 0) - (I.held('left') ? 1 : 0), ky = (I.held('down') ? 1 : 0) - (I.held('up') ? 1 : 0);
      const mv = I.axis('move'), dx = kx || mv.x, dy = ky || -mv.y;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        if (!cursor.on) { cursor.on = true; cursor.x = view.cx; cursor.z = view.cz; }
        const sp = 260 / view.s * Math.min(0.1, raw || 1 / 60); // 260 px a second on screen
        cursor.x += dx * sp; cursor.z += dy * sp;
        const r = cv.getBoundingClientRect(), [sx, sy] = toScreen(cursor.x, cursor.z);
        if (sx < 40 || sx > r.width - 40) view.cx += dx * sp; if (sy < 40 || sy > r.height - 40) view.cz += dy * sp;
        dirty = true;
      }
      const dt = Math.min(0.1, raw || 1 / 60);
      const lk = I.axis('look'); if (Math.abs(lk.x) > 0.05 || Math.abs(lk.y) > 0.05) { view.cx += lk.x * 360 * dt / view.s; view.cz += lk.y * 360 * dt / view.s; dirty = true; }
      const z = I.axis('zoom').y; if (Math.abs(z) > 0.01) zoomTo(view.s * Math.exp(z * 1.8 * dt));
      if (I.pressed('use') && cursor.on) { I.consumeKeyActions(); useAt(cursor.x, cursor.z); }
      I.consume('light', 'heavy', 'dodge', 'parry', 'use', 'skip');
      return true;
    },
    tick() { if (open && dirty) draw(); },
    reset() { if (open) { open = false; el.classList.add('hidden'); } pending = null; ask.classList.add('hidden'); },
  };
}
