// js/story/ui/touch.js : the story's touch layer #stouch (design 4.4, D5). It uses raw touch events, as
// game.js does (Safari can cancel a pointer mid-drag), and pointer events for the buttons.
// Sets (touchSet(name) pins one; 'auto' or null follows the game):
//   combat  (an enemy within 20 m): CUT, HEAVY, GUARD, DODGE, GOURD, LOCK and 熊 (USE takes 熊's place
//           while there is a prompt): never more than 7 action buttons.
//   explore (otherwise): USE only with a prompt, 写 (the phone camera), CROUCH only in stealth.
//   drive:  a steer slider on the left that springs back to the middle, GAS, BRAKE, DRIFT, HORN, EXIT (when
//           slow) and AUTO (holds the gas). A passenger gets EXIT and 写 only.
//   photo:  SHOOT and 写 (put the phone away); a pinch zooms, a drag aims.
//   menu, none: no buttons (dialogue and cards take taps; in a cine, holding a finger down skips).
// TILT (tilt.js) sits by the pause button in every play set, only on touch hardware that can tilt: a tap
// turns the tilt look on or off, a double tap recentres it.
// On foot the left 45% is a thumb stick and the rest drags the camera. A free tap is a light attack only
// when an enemy is within 12 m; a tap on the minimap opens the map. Sizes use --u and the safe areas, as
// the arena's touch buttons do.
const BTN = [
  // id, glyph, label, action(s), kind
  ['cut', '斬', 'CUT', ['light'], 'act'], ['heavy', '重', 'HEAVY', ['heavy'], 'act'], ['guard', '守', 'GUARD', ['parry'], 'act'], ['dodge', '避', 'DODGE', ['dodge'], 'act'],
  ['gourd', '酒', 'GOURD', ['canteen'], 'act'], ['lock', '狙', 'LOCK', ['lock'], 'act'], ['bear', '熊', 'BEAR', ['bearcall'], 'act'],
  ['use', '用', 'USE', ['use', 'exit'], 'act'], ['cam', '写', 'PHOTO', ['camera'], 'act'], ['crouch', '伏', 'CROUCH', ['crouch'], 'act'],
  ['gas', '進', 'GAS', ['gas'], 'act'], ['brake', '退', 'BRAKE', ['brake'], 'act'], ['drift', '滑', 'DRIFT', ['handbrake'], 'act'], ['horn', '笛', 'HORN', ['horn'], 'act'],
  ['exit', '降', 'EXIT', ['exit', 'use'], 'act'], ['auto', '自', 'AUTO', [], 'act'],
  ['shoot', '撮', 'SHOOT', ['shutter'], 'act'], ['close', '写', 'CLOSE', ['camera'], 'act'],
  ['pause', '止', '', ['pause'], 'sys'], ['tilt', '傾', 'TILT', [], 'sys'],
];
import { createTilt } from './tilt.js';

const TAP_MOVE = 30, ATTACK_R = 12, COMBAT_R = 20;

export function createTouch(U, { hud, mini, dlg, cards }) {
  const { S, make, root } = U;
  const I = U.input, T = I.touch;
  const layer = make('div', 'sTouch hidden', root, `<div class="stick"><i></i></div><div class="steer"><i></i></div>`);
  layer.id = 'stouch';
  const stick = layer.querySelector('.stick'), knob = stick.querySelector('i'), steer = layer.querySelector('.steer'), sknob = steer.querySelector('i');
  const skipRing = make('div', 'sSkip', root, `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="on" cx="18" cy="18" r="15"/></svg><span>HOLD TO SKIP</span>`);
  skipRing.id = 'sSkip';
  const btns = {};
  for (const [id, g, label, acts, kind] of BTN) {
    const b = make('button', `tb ${kind} hidden`, layer, `<i>${g}</i>${label ? `<small>${label}</small>` : ''}`);
    b.type = 'button'; b.id = `st_${id}`; b.dataset.b = id; b.setAttribute('aria-label', label || 'Pause');
    btns[id] = { el: b, acts, id, down: false };
  }
  let forced = null, cur = 'none', skipT = 0;
  const tilt = createTilt(U);

  /* ---------------- buttons ---------------- */
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* touch pointers are captured anyway */ } };
  for (const B of Object.values(btns)) {
    const b = B.el;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); capture(b, e);
      b.classList.add('down'); B.down = true; I.device = 'touch';
      if (B.id === 'pause') { if (S.ui.menu && S.mode === 'play') S.ui.menu.open(); return; }
      if (B.id === 'tilt') return; // it acts on the lift (iOS asks for motion access only from a touchend)
      if (B.id === 'auto') { if (S.drive) S.drive.autoGas = !S.drive.autoGas; b.classList.toggle('on', !!(S.drive && S.drive.autoGas)); return; }
      for (const a of B.acts) { T.held.add(a); T.hits.add(a); }
    });
    const up = () => { b.classList.remove('down'); if (!B.down) return; B.down = false; for (const a of B.acts) T.held.delete(a); };
    if (B.id === 'tilt') b.addEventListener('pointerup', () => { if (B.down) { tilt.tap(); b.classList.toggle('on', tilt.on); } });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------- the free area: stick, steer, look, pinch, taps ---------------- */
  const ptrs = new Map();
  let R = 56, pinch = null;
  const ctx = () => I.context;
  function start(id, x, y) {
    I.device = 'touch';
    const c = ctx();
    const m = mini.rect(), onMini = m && x >= m.left && x <= m.right && y >= m.top && y <= m.bottom;
    const left = x < innerWidth * 0.45 && !onMini;
    const kind = onMini ? 'mini' : c === 'cine' ? 'hold' : c === 'menu' ? 'tap' : left && (c === 'foot' || c === 'photo') && ![...ptrs.values()].some((p) => p.kind === 'stick') ? 'stick'
      : left && c === 'drive' && ![...ptrs.values()].some((p) => p.kind === 'steer') ? 'steer' : 'look';
    const p = { kind, x0: x, y0: y, x, y, moved: 0, t0: performance.now() };
    ptrs.set(id, p);
    if (kind === 'stick') { R = stick.offsetWidth / 2 || 56; stick.style.left = `${x}px`; stick.style.top = `${y}px`; stick.classList.add('on'); knob.style.transform = 'translate(-50%, -50%)'; }
    if (kind === 'hold') T.held.add('skip');
    // two fingers on the free area in the phone camera: a pinch
    const looks = [...ptrs.values()].filter((q) => q.kind === 'look');
    if (c === 'photo' && looks.length >= 2) { const [a, b] = looks; pinch = { a, b, d: Math.hypot(a.x - b.x, a.y - b.y) }; }
  }
  function move(id, x, y) {
    const p = ptrs.get(id); if (!p) return;
    const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
    p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0));
    if (p.kind === 'stick') {
      let sx = x - p.x0, sy = y - p.y0; const l = Math.hypot(sx, sy);
      if (l > R) { sx *= R / l; sy *= R / l; }
      knob.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
      const mm = Math.hypot(sx, sy) / R, k = mm < 0.12 ? 0 : Math.min(1, (mm - 0.12) / 0.58) / (mm || 1);
      T.stick.x = sx / R * k; T.stick.y = -sy / R * k;
    } else if (p.kind === 'steer') {
      const w = steer.offsetWidth || 200, r = w * 0.36;
      const s = Math.max(-1, Math.min(1, (x - p.x0) / r));
      T.steer = Math.abs(s) < 0.06 ? 0 : s;
      sknob.style.transform = `translate(calc(-50% + ${(s * w * 0.42).toFixed(1)}px), -50%)`;
    } else if (p.kind === 'look') {
      if (pinch && (p === pinch.a || p === pinch.b)) {
        const d = Math.hypot(pinch.a.x - pinch.b.x, pinch.a.y - pinch.b.y);
        if (pinch.d > 1 && d > 1) T.zoom += Math.log(d / pinch.d);
        pinch.d = d;
        return;
      }
      T.dx += dx; T.dy += dy;
    }
  }
  function end(id, x, y, lifted) {
    const p = ptrs.get(id); if (!p) return;
    ptrs.delete(id);
    if (pinch && (p === pinch.a || p === pinch.b)) pinch = null;
    if (p.kind === 'stick') { T.stick.x = T.stick.y = 0; stick.classList.remove('on'); }
    if (p.kind === 'steer') { T.steer = 0; sknob.style.transform = 'translate(-50%, -50%)'; }
    if (p.kind === 'hold') { if (![...ptrs.values()].some((q) => q.kind === 'hold')) T.held.delete('skip'); }
    const moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0));
    if (!lifted || moved >= TAP_MOVE) return;
    // a tap
    if (p.kind === 'mini') { if (S.mode === 'play' && U.pieces.map) U.pieces.map.api.open(); return; }
    const c = ctx();
    if (c === 'menu' || p.kind === 'tap') { T.hits.add('use'); T.hits.add('skip'); return; }
    if (c === 'cine') { if (S.film && S.film.active) T.hits.add('skip'); return; }
    if (c === 'foot' && (enemyWithin(ATTACK_R) || civilianWithin(3))) T.hits.add('light');
  }
  function enemyWithin(r) {
    const H = S.hero, E = S.combat && S.combat.enemies; if (!H || !E) return false;
    for (const f of E) { if (!f || f.downed || f.tied || f.hp <= 0 || !f.pos) continue; if (Math.hypot(f.pos.x - H.pos.x, f.pos.z - H.pos.z) <= r) return true; }
    return false;
  }
  const onButton = (t) => t.target && t.target.closest && t.target.closest('button');
  layer.addEventListener('touchstart', (e) => {
    let used = false;
    for (const t of e.changedTouches) if (!onButton(t)) { start('t' + t.identifier, t.clientX, t.clientY); used = true; }
    if (used && e.cancelable) e.preventDefault();
  }, { passive: false });
  layer.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) move('t' + t.identifier, t.clientX, t.clientY); if (e.cancelable) e.preventDefault(); }, { passive: false });
  layer.addEventListener('touchend', (e) => { tilt.gesture(); for (const t of e.changedTouches) end('t' + t.identifier, t.clientX, t.clientY, true); }, { passive: false });
  layer.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) end('t' + t.identifier, t.clientX, t.clientY, false); });
  // a pen or a mouse on the layer (touch goes through the touch events above)
  layer.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.target.closest('button')) return; e.preventDefault(); capture(layer, e); start(e.pointerId, e.clientX, e.clientY); });
  layer.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e.pointerId, e.clientX, e.clientY); });
  layer.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e.pointerId, e.clientX, e.clientY, true); });
  layer.addEventListener('pointercancel', (e) => { if (e.pointerType !== 'touch') end(e.pointerId, e.clientX, e.clientY, false); });

  function releaseAll() {
    for (const [id, p] of [...ptrs]) end(id, p.x, p.y, false);
    for (const B of Object.values(btns)) { B.down = false; B.el.classList.remove('down'); }
    T.held.clear(); T.stick.x = T.stick.y = 0; T.steer = 0; pinch = null;
  }

  /* ---------------- which set shows ---------------- */
  function auto() {
    const c = ctx();
    if (S.mode !== 'play' || c === 'menu') return 'menu';
    if (c === 'cine') return 'none';
    if (c === 'photo') return 'photo';
    if (c === 'drive') return 'drive';
    return enemyWithin(COMBAT_R) || civilianWithin(3) ? 'combat' : 'explore';
  }
  function civilianWithin(radius) {
    const hero = S.hero;
    return !!hero && (S.cast.crowd?.list || []).some((person) => !person.dead && Math.abs(person.pos.y - hero.pos.y) < 1.5 && Math.hypot(person.pos.x - hero.pos.x, person.pos.z - hero.pos.z) < radius);
  }
  const hasBear = () => { const H = S.hero, f = S.flags || {}; return !!((H && H.abilities && H.abilities.bearCall) || f.bearCall || f.ability_bearCall || (S.combat && S.combat.bearCall && S.combat.bearCall.unlocked)); };
  const stealthy = () => !!((S.stealth && S.stealth.list && S.stealth.list.length) || (S.hero && S.hero.crouch));
  function wanted(set) {
    const on = new Set();
    const prompt = !!hud.promptLabel && S.hero && S.hero.mode === 'foot';
    if (set === 'combat') { for (const b of ['cut', 'heavy', 'guard', 'dodge', 'gourd', 'lock']) on.add(b); if (prompt) on.add('use'); else if (hasBear()) on.add('bear'); }
    if (set === 'explore') { if (prompt) on.add('use'); on.add('cam'); if (stealthy()) on.add('crouch'); }
    if (set === 'drive') {
      const pass = S.hero && S.hero.mode === 'passenger', v = S.drive && S.drive.riding;
      if (!pass) for (const b of ['gas', 'brake', 'drift', 'horn', 'auto']) on.add(b);
      if (pass) on.add('cam');
      if (!v || Math.abs(v.speed) < 4) on.add('exit');
    }
    if (set === 'photo') { on.add('shoot'); on.add('close'); }
    if (set !== 'menu' && set !== 'none' && S.mode === 'play') { on.add('pause'); if (tilt.supported) on.add('tilt'); }
    return on;
  }
  let lastKey = '';
  return {
    tilt,
    set(name) { forced = name && name !== 'auto' ? name : null; },
    get current() { return cur; },
    visibleButtons() { return Object.values(btns).filter((B) => !B.el.classList.contains('hidden') && B.el.classList.contains('act')).map((B) => B.id); },
    // the cine: hold skip 0.8 s (any device); the film skips at once
    cineInput(I2, raw) {
      const cine = I2.context === 'cine';
      if (cine && S.film && S.film.active && I2.pressed('skip')) { I2.consume('skip', 'use'); S.film.skip(); skipT = 0; return; }
      if (cine && S.cine && S.cine.active && I2.held('skip')) {
        skipT += raw || 1 / 60;
        if (skipT >= 0.8) { skipT = 0; T.held.delete('skip'); I2.consume('skip', 'use'); S.cine.skip(); }
      } else skipT = 0;
    },
    tick() {
      const on = U.touch && S.api && S.api.active && (S.mode === 'play' || S.mode === 'boot');
      layer.classList.toggle('hidden', !on);
      if (!on) { if (ptrs.size || T.held.size) releaseAll(); cur = 'none'; }
      else cur = forced || auto();
      const want = on ? wanted(cur) : new Set();
      const key = `${cur}|${[...want].join(',')}`;
      if (key !== lastKey) {
        lastKey = key;
        layer.dataset.set = cur;
        for (const B of Object.values(btns)) {
          const show = want.has(B.id);
          B.el.classList.toggle('hidden', !show);
          if (!show && B.down) { B.down = false; B.el.classList.remove('down'); for (const a of B.acts) T.held.delete(a); }
        }
        steer.classList.toggle('hidden', !(cur === 'drive' && want.has('gas')));
        if (!want.has('gas') && T.steer) T.steer = 0;
      }
      if (want.has('tilt')) btns.tilt.el.classList.toggle('on', tilt.on);
      if (want.has('auto')) btns.auto.el.classList.toggle('on', !!(S.drive && S.drive.autoGas));
      if (want.has('use')) { const l = (hud.promptLabel || 'USE').split(' ')[0].toUpperCase().slice(0, 6); const sm = btns.use.el.querySelector('small'); if (sm.textContent !== l) sm.textContent = l; }
      // the hold-to-skip ring (every device shows it while the skip is held in a cine)
      const k = Math.min(1, skipT / 0.8);
      if (skipT > 0.05 && !skipRing.classList.contains('on')) skipRing.querySelector('span').textContent = U.touch ? 'HOLD TO SKIP' : U.keys('HOLD {skip} TO SKIP');
      skipRing.classList.toggle('on', skipT > 0.05);
      skipRing.querySelector('.on').style.strokeDashoffset = String(94.25 * (1 - k));
    },
    boxes() {
      const out = [];
      for (const B of Object.values(btns)) { const r = U.box(B.el); if (r) out.push([`btn:${B.id}`, r]); }
      const r = U.box(steer); if (r && !layer.classList.contains('hidden')) out.push(['btn:steer', r]);
      return out;
    },
    reset() { releaseAll(); forced = null; lastKey = ''; skipT = 0; layer.classList.add('hidden'); },
  };
}
