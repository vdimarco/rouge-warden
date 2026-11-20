// Gloam Downs: the inputs. Keys, the mouse, touch and gamepads become one object of held inputs that the page reads before each
// frame's steps: { mx, mz, slow, jump, ox, oy, dyaw, dpitch, attack, roll, heal }. Press edges and their 0.15 s buffer are taken from
// it on the play steps (moves.js). A press that comes and goes between two reads is kept by a latch until a step has run. An action key
// or a pad button that was down when a card's button was pressed is swallowed: it does nothing in play until it is let go. The keys
// that move and look stay live through a card, so a held W walks on after Resume.
// readPads, navStep, heldNav and pickMove are pure, so Node tests use them.

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// the keys of a run's moves; M, P, Escape and R are the page's own (main.js)
export const KEYS = { attack: ['j', 'z'], roll: ['k', 'x'], heal: ['l', 'c'] };
// the keys that move, walk and look: never swallowed, so what is held through a card goes on after it
export const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e']);
// the left stick moves only past this size (moves.js heldDir reads the same): under it the keys or the touch stick win
export const WALK_MIN = 0.2;

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
   run() and play() say what the page is doing now. onFace() runs on a press of RB (the page's own R and Look call it too) */
export function makeInput(els, { run = () => false, play = () => false } = {}) {
  const { canvas, stick: stickEl } = els;
  const input = { mx: 0, mz: 0, slow: false, jump: false, ox: 0, oy: 0, dyaw: 0, dpitch: 0, attack: false, roll: false, heal: false };
  const keys = new Set(), swallowed = new Set(), padSwallowed = new Set();
  const latch = { attack: false, roll: false, heal: false, jump: false };
  const touch = { jump: false, attack: false, roll: false, heal: false };
  let stick = null, look = null, mouse = null, pads = null;
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
  function clear() {
    keys.clear(); swallowed.clear();
    stick = look = mouse = null;
    for (const k in touch) touch[k] = false;
    for (const k in latch) latch[k] = false;
    stickEl.hidden = true;
    for (const b of [els.jump, els.attack, els.roll, els.heal]) b?.classList.remove('on');
  }

  canvas.addEventListener('pointerdown', e => {
    if (!play()) return;
    canvas.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'mouse') {
      // in a run the left button swings at once, and holding it goes on with the string until the pointer moves 6 px; any drag looks
      const swing = run() && e.button === 0;
      mouse = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, swing };
      if (swing) latch.attack = true;
      canvas.classList.add('drag');
      return;
    }
    if (e.clientX < innerWidth * 0.5 && !stick) {
      stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      stickEl.style.left = `${e.clientX}px`; stickEl.style.top = `${e.clientY}px`; stickEl.hidden = false;
      stickEl.firstElementChild.style.transform = '';
    } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    if (mouse && e.pointerId === mouse.id) {
      input.dyaw -= (e.clientX - mouse.x) * 0.008; input.dpitch += (e.clientY - mouse.y) * 0.005; mouse.x = e.clientX; mouse.y = e.clientY;
      if (mouse.swing && Math.hypot(e.clientX - mouse.x0, e.clientY - mouse.y0) > 6) mouse.swing = false;
    } else if (stick && e.pointerId === stick.id) {
      stick.x = e.clientX; stick.y = e.clientY;
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, l = Math.hypot(dx, dy), k = l > 44 ? 44 / l : 1;
      stickEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else if (look && e.pointerId === look.id) { input.dyaw -= (e.clientX - look.x) * 0.009; input.dpitch += (e.clientY - look.y) * 0.006; look.x = e.clientX; look.y = e.clientY; }
  });
  const release = e => {
    if (mouse && e.pointerId === mouse.id) { mouse = null; canvas.classList.remove('drag'); }
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
    input.jump = jump || p.jump || touch.jump || latch.jump;
    input.slow = slow || p.slow;
    input.attack = r && (any(KEYS.attack) || p.attack || touch.attack || !!mouse?.swing || latch.attack);
    input.roll = r && (any(KEYS.roll) || p.roll || touch.roll || latch.roll);
    input.heal = r && (any(KEYS.heal) || p.heal || touch.heal || latch.heal);
    pads = null;
    return input;
  }
  return {
    input, read, readPad, clear,
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
      if (mouse) mouse.swing = false;
    },
    get pads() { return pads; }
  };
}
