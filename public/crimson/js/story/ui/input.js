// js/story/ui/input.js : S.input, the story's one input layer (design 4.4). The arena's input is untouched.
// Sources: the keyboard (the game.js seam calls key(e, down)), the mouse (own listeners on the canvas while
// the story runs; pointer lock on a click in play, never under navigator.webdriver; losing the lock opens
// the story menu), a gamepad (the seam calls pad(p) each frame; update() polls it itself when the page is
// stepped by QA) with its own edge detection, and the touch layer (touch.js feeds `touch`).
// Contexts: foot, drive, photo, menu, cine. They follow the game by themselves (the menu and modal UI,
// a cine or the film, the hero's mode); setContext(c) pins one and setContext(null) lets it follow again.
// Actions are INPUT_ACTIONS plus the UI's own: up, down, left, right (menu focus), back, zoomIn, zoomOut.
// Combat actions (light, heavy, parry, dodge) are buffered for 0.32 s of story time: pressed() stays true
// until the buffer runs out or a handler consumes it.
// Axes: move and steer are stick units (-1..1, y forward). look is a turn rate in stick units, where 1
// is a full right stick (about 2.5 rad/s); the mouse and a touch drag give the same units, so a quick flick
// can go past 1. y is positive when the view should tilt down (mouse or finger moving down). zoom (extra):
// y > 0 zooms in.
const BUFFERED = ['light', 'heavy', 'parry', 'dodge'];
const BUFFER = 0.32;
const RATE = 2.5; // rad/s of a full look stick
const MOUSE_RAD = 0.0024, TOUCH_RAD = 0.0065; // the arena's mouse and drag feel

// keyboard: code -> actions, per context ('all' applies everywhere)
const NAV = { KeyW: ['up'], ArrowUp: ['up'], KeyS: ['down'], ArrowDown: ['down'], KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'] };
const KEYS = {
  all: { Escape: ['pause', 'back'], KeyP: ['pause'], KeyN: ['music'] },
  foot: { ...NAV, KeyJ: ['light'], KeyK: ['heavy'], KeyQ: ['heavy'], ShiftLeft: ['sprint'], ShiftRight: ['sprint'], KeyF: ['parry'], Space: ['dodge', 'skip'],
    KeyR: ['canteen'], KeyT: ['reload'], KeyB: ['weaponNext'], Digit1: ['weapon1'], Digit2: ['weapon2'], Digit3: ['weapon3'], Digit4: ['weapon4'], Digit5: ['weapon5'], Digit6: ['weapon6'], Digit7: ['weapon7'], Tab: ['lock'], KeyE: ['use', 'exit'], Enter: ['use', 'skip'], KeyX: ['crouch'], KeyC: ['crouch'], ControlLeft: ['crouch'],
    KeyV: ['camera'], KeyG: ['bearcall'], KeyM: ['map'] },
  drive: { KeyW: ['gas', 'up'], ArrowUp: ['gas', 'up'], KeyS: ['brake', 'down'], ArrowDown: ['brake', 'down'], KeyA: ['left'], ArrowLeft: ['left'], KeyD: ['right'], ArrowRight: ['right'],
    Space: ['handbrake', 'skip'], KeyH: ['horn'], KeyC: ['lookback'], KeyE: ['exit', 'use'], Enter: ['use', 'skip'], KeyV: ['camera'], KeyM: ['map'] },
  photo: { ...NAV, Space: ['shutter'], Enter: ['shutter'], KeyE: ['zoomIn'], KeyQ: ['zoomOut'], Equal: ['zoomIn'], Minus: ['zoomOut'], KeyV: ['camera'], KeyM: ['map'] },
  menu: { ...NAV, Enter: ['use', 'skip'], Space: ['use', 'skip'], KeyE: ['use', 'skip'], Backspace: ['back'], KeyM: ['map'], Tab: ['right'], Equal: ['zoomIn'], Minus: ['zoomOut'] },
  cine: { Space: ['skip', 'use'], Enter: ['skip', 'use'], KeyE: ['skip', 'use'] },
};
// standard gamepad: button index -> actions, per context
const PAD = {
  all: { 9: ['pause'] },
  foot: { 0: ['dodge', 'skip'], 1: ['back'], 2: ['canteen'], 3: ['use', 'exit'], 4: ['parry'], 5: ['light'], 6: ['parry'], 7: ['heavy'], 8: ['map'], 10: ['crouch'], 11: ['lock'], 12: ['bearcall', 'up'], 13: ['camera', 'down'], 14: ['weaponNext'], 15: ['reload'] },
  drive: { 0: ['handbrake'], 3: ['exit', 'use'], 6: ['brake'], 7: ['gas'], 8: ['map'], 10: ['horn'], 11: ['lookback'], 13: ['camera'] },
  photo: { 0: ['shutter'], 1: ['back'], 4: ['zoomOut'], 5: ['zoomIn'], 6: ['zoomOut'], 7: ['zoomIn'], 13: ['camera'] },
  menu: { 0: ['use', 'skip'], 1: ['back'], 3: ['use'], 4: ['zoomOut'], 5: ['zoomIn'], 8: ['map'], 12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'] },
  cine: { 0: ['skip', 'use'], 1: ['skip'] },
};
// mouse buttons (0 left, 1 middle, 2 right)
const MOUSE = { foot: { 0: ['light'], 1: ['lock'], 2: ['parry'] }, photo: { 0: ['shutter'] }, menu: { 0: ['use', 'skip'] }, cine: { 0: ['skip'] }, drive: {} };
const merge = (t) => { const o = {}; for (const c of ['foot', 'drive', 'photo', 'menu', 'cine']) o[c] = { ...t.all, ...t[c] }; return o; };
const KEYMAP = merge(KEYS), PADMAP = merge(PAD);
const dz = (v, d = 0.18) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

export function createInput(S) {
  const canvas = S.renderer && S.renderer.domElement;
  const keyHeld = new Set(), keyHits = new Set();
  let pad = null, padFed = false, padPrev = [], padAxes = [0, 0, 0, 0], padTrig = [0, 0], padHits = new Set();
  const mouse = { held: new Set(), hits: new Set(), dx: 0, dy: 0, wheel: 0, locked: false, hadLock: false, swallow: false };
  // the touch layer writes here (touch.js)
  // (tiltX, tiltY: radians of view turn from tilt.js, right and down)
  const touch = { held: new Set(), hits: new Set(), stick: { x: 0, y: 0 }, steer: 0, dx: 0, dy: 0, zoom: 0, tiltX: 0, tiltY: 0 };
  let qa = null, forced = null;
  let prev = new Set(), now = new Set(), pressedNow = new Set();
  const bufT = {};
  const axes = { move: { x: 0, y: 0 }, steer: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: { x: 0, y: 0 } };
  let realT = 0;

  // the context the game is in right now
  function derive() {
    if (forced) return forced;
    const ui = S.ui;
    if (S.mode === 'menu' || (ui && ui.menu && ui.menu.isOpen) || (ui && ui.modalOpen && ui.modalOpen())) return 'menu';
    if ((S.cine && S.cine.active) || (S.film && S.film.active)) return 'cine';
    const m = S.hero && S.hero.mode;
    if (m === 'photo' || (S.photo && S.photo.active)) return 'photo';
    if (m === 'drive' || m === 'passenger') return 'drive';
    return 'foot';
  }
  function pollPad() {
    if (padFed) { padFed = false; return; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null; for (const x of pads || []) if (x && x.connected) { p = x; break; }
    readPad(p);
  }
  function readPad(p) {
    pad = p;
    if (!p) { padAxes = [0, 0, 0, 0]; padTrig = [0, 0]; if (padPrev.length) padPrev = []; return; }
    const b = p.buttons.map((x) => (typeof x === 'object' ? !!x.pressed : x > 0.5));
    b.forEach((on, i) => { if (on && !padPrev[i]) padHits.add(i); });
    if (b.some((x, i) => x && !padPrev[i]) || p.axes.some((a) => Math.abs(a) > 0.4)) I.device = 'pad';
    padAxes = [p.axes[0] || 0, p.axes[1] || 0, p.axes[2] || 0, p.axes[3] || 0];
    padTrig = [p.buttons[6] ? +p.buttons[6].value || 0 : 0, p.buttons[7] ? +p.buttons[7].value || 0 : 0];
    padPrev = b;
  }
  const actsOf = (map, ctx, k) => (map[ctx] && map[ctx][k]) || null;

  const I = {
    context: 'foot', device: 'key', touch, mouse,
    get pinned() { return forced; },
    // pin a context ('foot' | 'drive' | 'photo' | 'menu' | 'cine'); null follows the game again
    setContext(c) { forced = c || null; I.context = derive(); },
    pressed(a) {
      if (pressedNow.has(a)) return true;
      if (a === 'zoom') return pressedNow.has('zoomIn') || pressedNow.has('zoomOut');
      return bufT[a] != null && S.time - bufT[a] <= BUFFER;
    },
    held(a) { if (a === 'zoom') return now.has('zoomIn') || now.has('zoomOut'); return now.has(a); },
    consume(...list) { for (const a of list) { pressedNow.delete(a); delete bufT[a]; } },
    // the stub's name for a UI key that is used up with everything it carries (kept for old callers)
    consumeKeyActions() { I.consume('use', 'skip', 'exit', 'dodge', 'handbrake', 'shutter'); },
    axis(name) {
      if (qa && qa[name] && typeof qa[name] === 'object') return { x: +qa[name].x || 0, y: +qa[name].y || 0 };
      const a = axes[name];
      return a ? { x: a.x, y: a.y } : { x: 0, y: 0 };
    },
    key(e, down) {
      const code = e.code; if (!code) return;
      I.device = 'key';
      if ((code === 'Tab' || code === 'Space' || code.startsWith('Arrow')) && e.preventDefault) e.preventDefault();
      if (down) { if (!keyHeld.has(code)) keyHits.add(code); keyHeld.add(code); } else keyHeld.delete(code);
    },
    pad(p) { padFed = true; readPad(p); },
    // QA: {action: true|false} holds or releases; {move|look|steer|zoom: {x, y}} sets an axis
    set(actions) { qa = { ...(qa || {}), ...actions }; },
    clear() {
      qa = null; keyHeld.clear(); keyHits.clear(); padHits.clear(); mouse.held.clear(); mouse.hits.clear(); mouse.dx = mouse.dy = mouse.wheel = 0;
      touch.held.clear(); touch.hits.clear(); touch.stick.x = touch.stick.y = 0; touch.steer = 0; touch.dx = touch.dy = touch.zoom = 0; touch.tiltX = touch.tiltY = 0;
      for (const k of Object.keys(bufT)) delete bufT[k];
      prev = new Set(); now = new Set(); pressedNow = new Set();
    },
    get realTime() { return realT; },
    // the director calls this at the top of every tick
    update() {
      pollPad();
      const ctx = I.context = derive();
      const held = new Set(), hits = new Set();
      const add = (set, acts) => { if (acts) for (const a of acts) set.add(a); };
      for (const k of keyHeld) add(held, actsOf(KEYMAP, ctx, k));
      for (const k of keyHits) add(hits, actsOf(KEYMAP, ctx, k));
      if (pad) padPrev.forEach((on, i) => { if (on) add(held, actsOf(PADMAP, ctx, i)); });
      for (const i of padHits) add(hits, actsOf(PADMAP, ctx, i));
      if (ctx === 'foot' && S.arsenal?.ranged) {
        if (padPrev[7]) { held.delete('heavy'); held.add('light'); }
        if (padHits.has(7)) { hits.delete('heavy'); hits.add('light'); }
      }
      for (const b of mouse.held) add(held, actsOf(MOUSE, ctx, b));
      for (const b of mouse.hits) add(hits, actsOf(MOUSE, ctx, b));
      for (const a of touch.held) held.add(a);
      for (const a of touch.hits) hits.add(a);
      if (qa) for (const [k, v] of Object.entries(qa)) if (v === true) held.add(k);
      // the left stick moves the menu focus too
      if (pad && ctx === 'menu') { const x = dz(padAxes[0], 0.5), y = dz(padAxes[1], 0.5); if (y < 0) held.add('up'); if (y > 0) held.add('down'); if (x < 0) held.add('left'); if (x > 0) held.add('right'); }
      // drive: the triggers are analog
      if (pad && ctx === 'drive') { if (padTrig[1] > 0.25) held.add('gas'); if (padTrig[0] > 0.25) held.add('brake'); }
      // the move and steer axes from the keys come from the arrow actions
      now = held;
      pressedNow = new Set(hits);
      for (const a of now) if (!prev.has(a)) pressedNow.add(a);
      prev = now;
      keyHits.clear(); padHits.clear(); mouse.hits.clear(); touch.hits.clear();
      for (const a of BUFFERED) if (pressedNow.has(a)) bufT[a] = S.time;
      // held menu directions repeat (a held stick or key walks down a list)
      navRepeat(ctx);
      // axes
      const kx = (now.has('right') ? 1 : 0) - (now.has('left') ? 1 : 0), ky = (now.has('up') ? 1 : 0) - (now.has('down') ? 1 : 0);
      const px = dz(padAxes[0]), py = -dz(padAxes[1]);
      let mx = ctx === 'foot' || ctx === 'photo' ? kx : 0, my = ctx === 'foot' || ctx === 'photo' ? ky : 0;
      if (!mx && !my) { mx = px; my = py; }
      if (!mx && !my) { mx = touch.stick.x; my = touch.stick.y; }
      const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      axes.move.x = mx; axes.move.y = my;
      axes.steer.x = kx || px || touch.steer || 0; axes.steer.y = 0;
      axes.zoom.x = 0; axes.zoom.y = (now.has('zoomIn') ? 1 : 0) - (now.has('zoomOut') ? 1 : 0);
    },
  };

  const navT = {};
  function navRepeat(ctx) {
    for (const a of ['up', 'down', 'left', 'right']) {
      if (!now.has(a) || ctx !== 'menu') { delete navT[a]; continue; }
      if (pressedNow.has(a)) { navT[a] = realT + 0.42; continue; }
      if (navT[a] != null && realT >= navT[a]) { pressedNow.add(a); navT[a] = realT + 0.13; }
    }
  }

  // raw-time work at the very start of the input phase: turn the mouse, drag and wheel into rates
  S.register('input', (cdt, rdt, raw) => {
    const dt = Math.max(1 / 240, raw || 1 / 60);
    realT += raw || 0;
    const lx = (mouse.dx * MOUSE_RAD + touch.dx * TOUCH_RAD) / RATE / dt, ly = (mouse.dy * MOUSE_RAD * 0.85 + touch.dy * TOUCH_RAD * 0.8) / RATE / dt;
    mouse.dx = mouse.dy = 0; touch.dx = touch.dy = 0;
    // tilt (tilt.js): its turn as a rate, kept under the right stick's lock-flick line (0.9) so tilting alone
    // never flicks the lock; what is over goes out on the next ticks
    const td = RATE * dt, tx = Math.max(-0.85, Math.min(0.85, touch.tiltX / td)), ty = Math.max(-1.5, Math.min(1.5, touch.tiltY / td));
    touch.tiltX -= tx * td; touch.tiltY -= ty * td;
    axes.look.x = dz(padAxes[2]) + lx + tx; axes.look.y = dz(padAxes[3]) + ly + ty;
    // the wheel and a pinch zoom, as rates in stick units (a full stick is about ln 2 per 0.7 s): one wheel
    // notch is a quarter second of full zoom; a pinch follows the fingers (touch.zoom is ln of the spread)
    axes.zoom.y += (mouse.wheel * -0.0025 + touch.zoom) / dt;
    mouse.wheel = 0; touch.zoom = 0;
  }, -200);

  /* ---------------- the mouse (story only) ---------------- */
  const inStory = () => S.game && S.game.state === 'story' && S.api && S.api.active;
  const canLock = () => !navigator.webdriver && canvas && canvas.requestPointerLock;
  I.lock = () => { if (canLock() && document.pointerLockElement !== canvas && I.device !== 'touch') { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed now */ } } };
  I.unlock = () => { if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* ignore */ } };
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (!inStory()) return;
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      I.device = 'key';
      // the click that takes the pointer lock does nothing else
      if (S.mode === 'play' && canLock() && document.pointerLockElement !== canvas && !(S.ui && S.ui.modalOpen && S.ui.modalOpen())) { I.lock(); return; }
      if (e.button === 1) e.preventDefault();
      mouse.held.add(e.button); mouse.hits.add(e.button);
    });
    canvas.addEventListener('wheel', (e) => { if (!inStory()) return; mouse.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }
  addEventListener('mouseup', (e) => { mouse.held.delete(e.button); });
  addEventListener('blur', () => { keyHeld.clear(); mouse.held.clear(); touch.held.clear(); });
  addEventListener('mousemove', (e) => {
    if (!inStory() || document.pointerLockElement !== canvas) return;
    mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; I.device = 'key';
  });
  document.addEventListener('pointerlockchange', () => {
    const on = document.pointerLockElement === canvas;
    if (on) { mouse.hadLock = true; mouse.locked = true; return; }
    mouse.locked = false;
    // losing the lock (Esc, alt-tab) opens the story menu
    if (mouse.hadLock && inStory() && S.mode === 'play' && S.ui && S.ui.menu && !S.ui.menu.isOpen && !(S.ui.modalOpen && S.ui.modalOpen())) S.ui.menu.open();
    mouse.hadLock = false;
  });
  return I;
}
