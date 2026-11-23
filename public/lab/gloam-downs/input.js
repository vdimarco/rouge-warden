// Gloam Downs: the inputs. Keys, the mouse, touch and gamepads become one object of held inputs that the page reads before each
// frame's steps: { mx, mz, slow, jump, ox, oy, dyaw, dpitch, attack, roll, heal, mouse }. Press edges and their 0.15 s buffer are taken
// from it on the play steps (moves.js). A press that comes and goes between two reads is kept by a latch until a step has run. An action
// key or a pad button that was down when a card's button was pressed is swallowed: it does nothing in play until it is let go. The keys
// that move and look stay live through a card, so a held W walks on after Resume.
// The mouse: a click on the view always acts: the left button attacks (in the explorer, jumps), and while the mouse is free the right
// button held and dragged turns the view. Where the page can take the mouse (a mouse, and the Pointer Lock API), a click while it is
// free also asks the browser for it. While it is taken, moving it turns the view with no button held, and the right button rolls.
// Escape, or the browser, frees it. A refused lock, or one that never comes, leaves the free mouse as it is: clicks act and the right
// drag looks, and a click asks again once the wait is over. No click ever turns the view, and no mouse movement ever swings.
// Whether there is a mouse is read on each event (pointerType 'mouse') and from (pointer: fine) and (any-pointer: fine) as they change,
// so a phone with a mouse plugged in (Samsung DeX) takes it too. A touch's tap is never a click of the mouse.
// readPads, navStep, heldNav, pickMove, mouseLook, mouseAct and mouseAsk are pure, so Node tests use them.

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// the keys of a run's moves; M, P, Escape and R are the page's own (main.js)
export const KEYS = { attack: ['j', 'z'], roll: ['k', 'x'], heal: ['l', 'c'] };
// the keys that move, walk and look: never swallowed, so what is held through a card goes on after it
export const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e']);
// the left stick moves only past this size (moves.js heldDir reads the same): under it the keys or the touch stick win
export const WALK_MIN = 0.2;
/* the mouse's look: rad per pixel of movement while the mouse is taken (yaw and pitch), the right-button drag of the fallback at `drag`
   times that, and the most one event may move (spike) per 1/60 s since the last event: Chrome can report one large jump of movementX
   when the mouse is first taken. Chrome sends one pointermove a frame, so a cap of 120 px an event cut fast turns at 30 fps (720°/s
   lost 37%) and not at 144 fps; per 1/60 s, up to 4 times that for a slow frame, it cuts the same turn speed at every frame rate */
export const MOUSE = { yaw: 0.0022, pitch: 0.0018, drag: 2, spike: 120 };
const clampPx = (v, m) => (v < -m ? -m : v > m ? m : v);
/* a mouse movement (dx, dy px) as a turn of the view: right turns right (the yaw goes down), down tilts the view down (the pitch goes
   up). dt: the time since the mouse's last event, s */
export function mouseLook(dx, dy, drag = false, P = MOUSE, dt = 1 / 60) {
  const k = drag ? P.drag : 1, m = P.spike * Math.min(4, Math.max(1, (dt || 0) * 60));
  return { dyaw: -clampPx(dx || 0, m) * P.yaw * k, dpitch: clampPx(dy || 0, m) * P.pitch * k };
}
/* what a mouse button does on the view: 'attack', 'roll', 'jump', 'look' (the free mouse's right drag) or null. locked: the mouse is
   taken now. A click never only takes the mouse: what it does is the same whether or not the page also asks for the lock (mouseAsk) */
export function mouseAct(button, { run = false, locked = false } = {}) {
  if (button !== 0 && button !== 2) return null;
  if (button === 0) return run ? 'attack' : 'jump';
  return locked ? (run ? 'roll' : null) : 'look';
}
/* whether a press of the left or right button on the view also asks the browser for the mouse: not while it is taken, not where the
   page cannot take it or waits after a refusal (lockable is false then), and not while an earlier request is still out (trying) */
export function mouseAsk(button, { locked = false, lockable = false, trying = false } = {}) {
  return (button === 0 || button === 2) && !locked && lockable && !trying;
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
   run() and play() say what the page is doing now; hold() says the page may keep the mouse taken now (play, and the loading screen
   that a button sends to play): a lock that the browser grants later than that is given back at once, so it never hides the cursor
   over a card. onLock(taken, ours) runs when the mouse is taken or freed (ours: the page freed it); onState() when a request goes out
   or has had no answer, so the hint can change. onMouse(press) runs when the page finds a mouse, or loses it (press: a press did it). fine: true or false fixes
   whether there is a mouse (a test); by default the page reads it */
export function makeInput(els, { run = () => false, play = () => false, hold = play, onLock = () => {}, onState = () => {}, onMouse = () => {}, fine } = {}) {
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
  let lastMove = 0;
  const lock = { taken: false, refused: 0, retryAt: 0, retry: 0, lostAt: -1e9, trying: false, promised: false, raw: null, ours: false, pending: 0, req: 0, drop: false };
  const now = () => performance.now();
  /* a mouse: the primary pointer is fine, or a mouse has moved or pressed on the page since (any-pointer: fine) last turned on. A pen
     or a touch is not a mouse. When (any-pointer: fine) turns off (the mouse unplugged), only the primary pointer counts again */
  const mq = q => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false });
  const primary = mq('(pointer: fine)'), any = mq('(any-pointer: fine)');
  let seen = false;
  const hasMouse = () => (typeof fine === 'boolean' ? fine : primary.matches || seen);
  const mouseChanged = () => { letGo(); onMouse(); };
  any.addEventListener?.('change', () => { if (!any.matches) seen = false; mouseChanged(); });
  primary.addEventListener?.('change', mouseChanged);
  // onMouse(press): press is true when a press found or lost the mouse (its target is already chosen, so the page should not move it)
  const sawMouse = (e, press = false) => { if (e.pointerType === 'mouse' && !seen && !primary.matches) { seen = true; onMouse(press); } };
  /* a finger or a pen on the screen: the player plays by touch now, so a mouse seen before no longer counts (the touch lines come
     back), and a taken mouse is freed, so the touch reaches the view */
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return sawMouse(e, true);
    if (lock.taken) free();
    if (seen) { seen = false; onMouse(true); }
  }, true);
  addEventListener('pointermove', e => sawMouse(e), true);
  const canLock = () => hasMouse() && typeof canvas.requestPointerLock === 'function';
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
     pointerlockerror. A request that has had no answer in 2 s counts as refused, so a lock that never comes does not hold up the
     next ask. The free mouse acts all the while */
  // id: the request this answers; an answer to an older request (one that timed out) does not count against the newer one
  function refuse(id = lock.req) {
    if (!lock.trying || id !== lock.req) return;
    lock.drop = false;
    clearTimeout(lock.pending); lock.pending = 0;
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
    // a take while a request is out wants that request's answer again, even after a free() in the wait
    if (lock.trying) { lock.drop = false; return true; }
    if (!lockable()) { later(); return true; }
    lock.trying = true; lock.drop = false;
    const id = ++lock.req, no = () => refuse(id);
    clearTimeout(lock.pending);
    lock.pending = setTimeout(() => { lock.pending = 0; no(); onState(); }, 2000);
    const plain = () => { try { ask()?.catch?.(no); } catch { no(); } };
    // Chrome refuses too many requests in a short time, so a browser that has said no to raw movement once is not asked again
    if (lock.raw === false) { plain(); return true; }
    try { ask({ unadjustedMovement: true })?.catch?.(err => { if (err?.name === 'NotSupportedError') { lock.raw = false; plain(); } else no(); }); } catch { lock.raw = false; plain(); }
    return true;
  }
  // a free() while a request is out (Escape, or a card that opens, in the wait) drops that lock when it comes
  function free() {
    clearTimeout(lock.retry); lock.retry = 0;
    if (lock.taken) { lock.ours = true; document.exitPointerLock?.(); } else if (lock.trying) lock.drop = true;
  }
  document.addEventListener('pointerlockchange', () => {
    const was = lock.taken, ours = lock.ours;
    lock.taken = document.pointerLockElement === canvas;
    lock.trying = false;
    // the first move once the mouse is taken (or let go) is held to one frame's spike (pointermove, below)
    lastMove = 0;
    clearTimeout(lock.pending); lock.pending = 0;
    lock.ours = false;
    if (lock.taken) {
      // the free mouse's drag ends: the taken mouse looks with no button
      drag = null; canvas.classList.remove('drag');
      lock.refused = 0;
      /* granted late, over a card (a request made in play, answered after the pause panel opened) or after a free() in the wait: give
         it back at once. The page never counts it as taken, so the exit that follows changes nothing and calls no onLock */
      if (!hold() || lock.drop) {
        lock.drop = false; lock.taken = false; lock.ours = true;
        document.exitPointerLock?.(); onState(); return;
      }
    } else { if (!ours) lock.lostAt = now(); letGo(); }
    canvas.classList.toggle('taken', lock.taken);
    if (was !== lock.taken) onLock(lock.taken, ours);
  });
  document.addEventListener('pointerlockerror', () => { if (!lock.promised) refuse(lock.req); });

  // the type of the last pointer pressed on the view: a mousedown that follows a touch or a pen is the browser's copy of a tap
  let pressed = 'mouse';
  canvas.addEventListener('mousedown', e => {
    if (!play()) return;
    if (pressed !== 'mouse' || e.sourceCapabilities?.firesTouchEvents) return;
    if (!seen && !primary.matches) { seen = true; onMouse(true); }
    // a click asks for the mouse where the page may, and acts all the same (mouseAct)
    if (mouseAsk(e.button, { locked: lock.taken, lockable: lockable(), trying: lock.trying })) { take(); onState(); }
    const act = mouseAct(e.button, { run: run(), locked: lock.taken });
    if (!act) return;
    e.preventDefault();
    if (act === 'look') { drag = { x: e.clientX, y: e.clientY }; canvas.classList.add('drag'); return; }
    held[act] = true;
    latch[act] = true;
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) held.attack = held.jump = false;
    if (e.button === 2) { held.roll = false; drag = null; canvas.classList.remove('drag'); }
  });
  canvas.addEventListener('pointerdown', e => {
    pressed = e.pointerType || 'mouse';
    if (!play()) return;
    // a taken mouse cannot be captured (the browser throws)
    if (!lock.taken) try { canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is gone already */ }
    if (e.pointerType === 'mouse') return;
    // while the mouse was taken (it is being freed now), the browser gives a touch the taken mouse's place: wait for the true one
    if (lock.taken) { late = e.pointerId; return; }
    touchDown(e.pointerId, e.clientX, e.clientY);
  });
  // a finger down: the left half holds the stick, the right half looks
  let late = null;
  function touchDown(id, x, y) {
    if (x < innerWidth * 0.5 && !stick) {
      stick = { id, x0: x, y0: y, x, y };
      stickEl.style.left = `${x}px`; stickEl.style.top = `${y}px`; stickEl.hidden = false;
      stickEl.firstElementChild.style.transform = '';
    } else if (!look) look = { id, x, y };
  }
  canvas.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    if (late !== null && t && play()) touchDown(late, t.clientX, t.clientY);
    late = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (late === e.pointerId) { late = null; if (play()) touchDown(e.pointerId, e.clientX, e.clientY); }
    if (e.pointerType === 'mouse') {
      let d = null;
      /* the time since the last move of the taken mouse (or of the drag); after a pause, and on the first move once the mouse is taken
         (where Chrome's spike comes: the free cursor's moves on its way to the click do not count), one frame's */
      const gap = (e.timeStamp - lastMove) / 1000, dt = lastMove && gap > 0 && gap < 0.1 ? gap : 1 / 60;
      lastMove = lock.taken || drag ? e.timeStamp : 0;
      if (lock.taken) d = mouseLook(e.movementX, e.movementY, false, MOUSE, dt);
      else if (drag) { d = mouseLook(e.clientX - drag.x, e.clientY - drag.y, true, MOUSE, dt); drag.x = e.clientX; drag.y = e.clientY; }
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
    // the browser has refused the mouse since it was last taken; a mouse is on the page (as canLock reads it, with or without the API)
    get refused() { return lock.refused; }, get mouse() { return hasMouse(); },
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
