// Gloam Downs: the inputs. Keys, the mouse, touch and gamepads become one object of held inputs that the page reads before each
// frame's steps: { mx, mz, slow, jump, ox, oy, dyaw, dpitch, attack, roll, heal, mouse }. Press edges and their 0.15 s buffer are taken
// from it on the play steps (moves.js). A press that comes and goes between two reads is kept by a latch until a step has run. An action
// key or a pad button that was down when a card's button was pressed is swallowed: it does nothing in play until it is let go. The keys
// that move and look stay live through a card, so a held W walks on after Resume.
// The mouse: on a desktop a click on the view takes it (the Pointer Lock API), and that click does nothing else. While it is taken,
// moving it turns the view with no button held; the left button attacks (in the explorer, jumps) and the right button rolls. Escape, or
// the browser, frees it. Where the browser has no pointer lock, the right button held and dragged turns the view and the left button
// attacks or jumps. Where it refuses the lock for a moment, a click asks again as soon as it may, and does nothing else. No click ever
// turns the view, and no mouse movement ever swings.
// readPads, navStep, heldNav, pickMove, mouseLook and mouseAct are pure, so Node tests use them.

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// the keys of a run's moves; M, P, Escape and R are the page's own (main.js)
export const KEYS = { attack: ['j', 'z'], roll: ['k', 'x'], heal: ['l', 'c'] };
// the keys that move, walk and look: never swallowed, so what is held through a card goes on after it
export const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e']);
// the left stick moves only past this size (moves.js heldDir reads the same): under it the keys or the touch stick win
export const WALK_MIN = 0.2;
/* the mouse's look: rad per pixel of movement while the mouse is taken (yaw and pitch), the right-button drag of the fallback at `drag`
   times that, and the most one event may move (spike): Chrome can report one large jump of movementX when the mouse is first taken */
export const MOUSE = { yaw: 0.0022, pitch: 0.0018, drag: 2, spike: 120 };
const clampPx = (v, m) => (v < -m ? -m : v > m ? m : v);
// a mouse movement (dx, dy px) as a turn of the view: right turns right (the yaw goes down), down tilts the view down (the pitch goes up)
export function mouseLook(dx, dy, drag = false, P = MOUSE) {
  const k = drag ? P.drag : 1;
  return { dyaw: -clampPx(dx || 0, P.spike) * P.yaw * k, dpitch: clampPx(dy || 0, P.spike) * P.pitch * k };
}
/* what a mouse button does on the view: 'take' (the click that takes the mouse: nothing else), 'attack', 'roll', 'jump', 'look' (the
   fallback's right drag) or null. locked: the mouse is taken now; lockable: the page can take the mouse at all (a fine pointer and the
   Pointer Lock API). While the browser has just refused the lock and the page waits to ask again, the page is still lockable: a click
   then only asks again, and never swings */
export function mouseAct(button, { run = false, locked = false, lockable = false } = {}) {
  if (button !== 0 && button !== 2) return null;
  if (!locked && lockable) return 'take';
  if (button === 0) return run ? 'attack' : 'jump';
  return locked ? (run ? 'roll' : null) : 'look';
}

/* what the pads hold, all pads together: a button counts when any pad presses it, so two pads holding Start make one press. The
   left stick moves (a light tilt walks, as step reads its size), the right stick looks, A jumps. In a run X and RT attack, B and LT
   roll, Y heals, RB faces the foe, and Start and Back pause. In Wander X walks, as in the explorer, Start opens the Map, and RT, B,
   LT and Y do nothing. skip(i) is true for a button that is swallowed. Each stick is the one tilted furthest across the pads, so a
   second pad whose stick drifts past the deadzone does not take over. nav is what the cards read: the d-pad or the left stick past
   half, A, B, Start and Back */
export function readPads(pads, run, skip = () => false) {
  const out = { any: false, mx: 0, mz: 0, ox: 0, oy: 0, jump: false, slow: false, attack: false, roll: false, heal: false, face: false, pause: false, down: new Set(), nav: null };
  let lx = 0, ly = 0, lm = 0, rm = 0;
  for (const pad of pads || []) {
    if (!pad || !pad.connected) continue;
    out.any = true;
    const ax = (i, dz = 0.18) => (Math.abs(pad.axes?.[i] || 0) > dz ? pad.axes[i] : 0);
    const l = Math.hypot(ax(0), ax(1)), r = Math.hypot(ax(2), ax(3));
    if (l > lm) { lm = l; out.mx = ax(0); out.mz = -ax(1); lx = ax(0); ly = ax(1); }
    if (r > rm) { rm = r; out.ox = ax(2); out.oy = ax(3); }
    (pad.buttons || []).forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) out.down.add(i); });
  }
  const on = i => out.down.has(i) && !skip(i);
  out.jump = on(PAD.A);
  out.slow = !run && on(PAD.X);
  out.attack = run && (on(PAD.X) || on(PAD.RT));
  out.roll = run && (on(PAD.B) || on(PAD.LT));
  out.heal = run && on(PAD.Y);
  out.face = on(PAD.RB);
  out.pause = on(PAD.START) || (run && on(PAD.BACK));
  const d = i => out.down.has(i);
  out.nav = { prev: d(PAD.UP) || d(PAD.LEFT) || ly < -0.5 || lx < -0.5, next: d(PAD.DOWN) || d(PAD.RIGHT) || ly > 0.5 || lx > 0.5, a: d(PAD.A), b: d(PAD.B), start: d(PAD.START), back: d(PAD.BACK) };
  return out;
}
// the focus moves one button when the d-pad or the stick first holds a way, and again every 0.3 s while it is held -> -1, 0 or +1
export function navStep(st, nav, dt, every = 0.3) {
  const dir = nav.next ? 1 : nav.prev ? -1 : 0;
  if (!dir) { st.dir = 0; st.t = 0; return 0; }
  if (dir !== st.dir) { st.dir = dir; st.t = every; return dir; }
  st.t -= dt;
  if (st.t > 1e-9) return 0;
  st.t += every;
  return dir;
}
// a card or the loading screen takes over: the way the d-pad or the stick holds now moves nothing, at once or held, until it comes
// back to centre (navStep then counts a new press)
export function heldNav(st, nav) {
  st.dir = nav.next ? 1 : nav.prev ? -1 : 0;
  st.t = Infinity;
  return st;
}
// the move this frame: the keys or the touch stick ({ mx, mz }), unless the pad's left stick is tilted past the walk threshold, or
// they hold nothing
export function pickMove(own, pad) {
  if (Math.hypot(pad.mx, pad.mz) >= WALK_MIN || (!own.mx && !own.mz && (pad.mx || pad.mz))) return { mx: pad.mx, mz: pad.mz };
  return { mx: own.mx, mz: own.mz };
}

/* the page's inputs. els: { canvas, stick (the ring that shows under the thumb), jump, attack, roll, heal (the touch buttons) }.
   run() and play() say what the page is doing now. onLock(taken, ours) runs when the mouse is taken or freed (ours: the page freed
   it). fine: the page has a fine pointer (a mouse), so it may take the mouse */
export function makeInput(els, { run = () => false, play = () => false, onLock = () => {}, fine = matchMedia('(pointer: fine)').matches } = {}) {
  const { canvas, stick: stickEl } = els;
  const input = { mx: 0, mz: 0, slow: false, jump: false, ox: 0, oy: 0, dyaw: 0, dpitch: 0, attack: false, roll: false, heal: false, mouse: false };
  const keys = new Set(), swallowed = new Set(), padSwallowed = new Set();
  const latch = { attack: false, roll: false, heal: false, jump: false };
  const touch = { jump: false, attack: false, roll: false, heal: false };
  let stick = null, look = null, drag = null, pads = null;
  // the mouse's buttons held now, by what they do (mouseAct)
  const held = { attack: false, roll: false, jump: false };
  /* the pointer lock: taken now; refusals in a row; no new try before retryAt (a click till then asks again at retryAt: retry is that
     timer, and the click's user activation lasts about 5 s in Chrome, long enough for it); when the player or the browser last freed it, not the page (an Escape that the browser passes on as it frees the mouse must not also close
     the pause panel that opens); ours: the page is freeing it now */
  const lock = { taken: false, refused: 0, retryAt: 0, retry: 0, lostAt: -1e9, trying: false, promised: false, raw: null, ours: false };
  const now = () => performance.now();
  const canLock = () => fine && typeof canvas.requestPointerLock === 'function';
  const lockable = () => canLock() && now() >= lock.retryAt;
  const typing = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  addEventListener('keydown', e => {
    if (typing(e) || window.GameSwitch?.isOpen) return;
    const k = e.key.toLowerCase();
    // keys steer the lamplighter only in play. In a card, on the end card and on the loading screen they are the page's (Space and
    // Enter press the focused button), and a key pressed there stays out of play until it is let go
    if (!play() || e.target.closest?.('.panel:not([hidden])')) {
      // the keys that move stay live, so a direction held into a card (or pressed in one) walks on after it
      if (MOVE_KEYS.has(k)) keys.add(k);
      else swallowed.add(k);
      return;
    }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (swallowed.has(k) || (e.repeat && keys.has(k))) return;
    keys.add(k);
    if (run()) for (const [act, ks] of Object.entries(KEYS)) if (ks.includes(k)) latch[act] = true;
    if (k === ' ') latch.jump = true;
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); swallowed.delete(k); });
  addEventListener('blur', clear);
  function letGo() { held.attack = held.roll = held.jump = false; drag = null; canvas.classList.remove('drag'); }
  function clear() {
    keys.clear(); swallowed.clear();
    stick = look = null;
    letGo();
    for (const k in touch) touch[k] = false;
    for (const k in latch) latch[k] = false;
    stickEl.hidden = true;
    for (const b of [els.jump, els.attack, els.roll, els.heal]) b?.classList.remove('on');
  }

  /* take the mouse: raw movement where the browser offers it (unadjustedMovement), else the plain lock. A refusal waits 1.5 s, and the
     next refusals in a row 5 s each (Chrome also refuses too many requests in a short time). A browser whose request gives a promise
     says no through it (it also fires pointerlockerror, even for the first try that falls back); an older one only through
     pointerlockerror */
  function refuse() {
    if (!lock.trying) return;
    lock.trying = false; lock.refused++; lock.retryAt = now() + (lock.refused >= 2 ? 5000 : 1500);
    // a first refusal asks again by itself when the wait is over (the click that asked is still the gesture then); later ones wait
    // for a click
    if (lock.refused === 1) later();
  }
  function later() {
    clearTimeout(lock.retry);
    lock.retry = setTimeout(() => { lock.retry = 0; if (play()) take(); }, lock.retryAt - now() + 20);
  }
  function ask(opts) {
    const p = opts ? canvas.requestPointerLock(opts) : canvas.requestPointerLock();
    lock.promised = typeof p?.then === 'function';
    return p;
  }
  function take() {
    if (lock.taken || !canLock()) return false;
    if (!lockable()) { later(); return true; }
    lock.trying = true;
    const plain = () => { try { ask()?.catch?.(refuse); } catch { refuse(); } };
    // Chrome refuses too many requests in a short time, so a browser that has said no to raw movement once is not asked again
    if (lock.raw === false) { plain(); return true; }
    try { ask({ unadjustedMovement: true })?.catch?.(err => { if (err?.name === 'NotSupportedError') { lock.raw = false; plain(); } else refuse(); }); } catch { lock.raw = false; plain(); }
    return true;
  }
  function free() { clearTimeout(lock.retry); lock.retry = 0; if (lock.taken) { lock.ours = true; document.exitPointerLock?.(); } }
  document.addEventListener('pointerlockchange', () => {
    const was = lock.taken, ours = lock.ours;
    lock.taken = document.pointerLockElement === canvas;
    lock.trying = false;
    lock.ours = false;
    if (lock.taken) lock.refused = 0;
    else { if (!ours) lock.lostAt = now(); letGo(); }
    canvas.classList.toggle('taken', lock.taken);
    if (was !== lock.taken) onLock(lock.taken, ours);
  });
  document.addEventListener('pointerlockerror', () => { if (!lock.promised) refuse(); });

  canvas.addEventListener('mousedown', e => {
    if (!play()) return;
    const act = mouseAct(e.button, { run: run(), locked: lock.taken, lockable: canLock() });
    if (!act) return;
    e.preventDefault();
    if (act === 'take') { take(); return; }
    if (act === 'look') { drag = { x: e.clientX, y: e.clientY }; canvas.classList.add('drag'); return; }
    held[act] = true;
    latch[act] = true;
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) held.attack = held.jump = false;
    if (e.button === 2) { held.roll = false; drag = null; canvas.classList.remove('drag'); }
  });
  canvas.addEventListener('pointerdown', e => {
    if (!play()) return;
    // a taken mouse cannot be captured (the browser throws)
    if (!lock.taken) try { canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is gone already */ }
    if (e.pointerType === 'mouse') return;
    if (e.clientX < innerWidth * 0.5 && !stick) {
      stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      stickEl.style.left = `${e.clientX}px`; stickEl.style.top = `${e.clientY}px`; stickEl.hidden = false;
      stickEl.firstElementChild.style.transform = '';
    } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      let d = null;
      if (lock.taken) d = mouseLook(e.movementX, e.movementY);
      else if (drag) { d = mouseLook(e.clientX - drag.x, e.clientY - drag.y, true); drag.x = e.clientX; drag.y = e.clientY; }
      if (d && play()) { input.dyaw += d.dyaw; input.dpitch += d.dpitch; }
    } else if (stick && e.pointerId === stick.id) {
      stick.x = e.clientX; stick.y = e.clientY;
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy), k = l > 44 ? 44 / l : 1;
      stickEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else if (look && e.pointerId === look.id) { input.dyaw -= (e.clientX - look.x) * 0.009; input.dpitch += (e.clientY - look.y) * 0.006; look.x = e.clientX; look.y = e.clientY; }
  });
  const release = e => {
    if (stick && e.pointerId === stick.id) { stick = null; stickEl.hidden = true; }
    if (look && e.pointerId === look.id) look = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // the touch buttons: held while a finger is on them, and a tap between two reads still counts
  for (const name of ['jump', 'attack', 'roll', 'heal']) {
    const b = els[name];
    if (!b) continue;
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch[name] = true; latch[name] = true; b.classList.add('on'); b.setPointerCapture?.(e.pointerId); });
    const up = () => { touch[name] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }

  // read the pads (every frame, in every mode: the cards and the loading screen read them too)
  function readPad() {
    const list = navigator.getGamepads?.() || [];
    const raw = readPads(list, run(), i => padSwallowed.has(i));
    for (const i of [...padSwallowed]) if (!raw.down.has(i)) padSwallowed.delete(i);
    pads = raw;
    return raw;
  }
  // the held inputs for this frame's steps
  function read() {
    const k = n => keys.has(n) && !swallowed.has(n), any = list => list.some(k);
    let mx = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0);
    let mz = (k('w') || k('arrowup') ? 1 : 0) - (k('s') || k('arrowdown') ? 1 : 0);
    let ox = (k('e') ? 1 : 0) - (k('q') ? 1 : 0), oy = 0;
    let jump = k(' '), slow = k('shift');
    if (stick) {
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy);
      if (l > 6) { const m = Math.min(1, (l - 6) / 46); mx = (dx / l) * m; mz = (-dy / l) * m; }
    }
    const p = pads || readPad();
    ({ mx, mz } = pickMove({ mx, mz }, p));
    if (p.ox || p.oy) { ox = p.ox; oy = p.oy; }
    const r = run();
    input.mx = mx; input.mz = mz; input.ox = ox; input.oy = oy;
    input.jump = jump || p.jump || touch.jump || latch.jump || held.jump;
    input.slow = slow || p.slow;
    input.attack = r && (any(KEYS.attack) || p.attack || touch.attack || held.attack || latch.attack);
    input.roll = r && (any(KEYS.roll) || p.roll || touch.roll || held.roll || latch.roll);
    input.mouse = lock.taken;
    input.heal = r && (any(KEYS.heal) || p.heal || touch.heal || latch.heal);
    pads = null;
    return input;
  }
  return {
    input, read, readPad, clear, take, free,
    /* the mouse is taken now; the page can take it now; it could take it at all (a fine pointer and the Pointer Lock API); the browser
       refused it a moment ago and the page waits to ask again */
    get locked() { return lock.taken; }, get lockable() { return lockable(); }, get canLock() { return canLock(); },
    get waiting() { return canLock() && !lock.taken && !lockable(); },
    // the time the player or the browser last freed the mouse (performance.now)
    get lostAt() { return lock.lostAt; },
    // a step has run on what was read: the latches are spent
    consumed() { for (const k in latch) latch[k] = false; },
    // a card's button was pressed: the action keys and pad buttons held now do nothing in play until they are let go (the keys that
    // move stay live)
    swallowAll() {
      for (const k of keys) if (!MOVE_KEYS.has(k)) swallowed.add(k);
      const raw = readPads(navigator.getGamepads?.() || [], run());
      for (const i of raw.down) padSwallowed.add(i);
      // the pads read before this are stale now: the next read leaves the swallowed buttons out
      pads = null;
      for (const k in latch) latch[k] = false;
      letGo();
    },
    get pads() { return pads; }
  };
}
