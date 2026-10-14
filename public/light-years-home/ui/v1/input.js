// Light Years Home: pointer, touch and keys. One verb per phase: look and tap in a scan, hold and let go in flight.
// Pointers live in one Map keyed by pointerId with capture on press; thrust ends on pointerup, pointercancel,
// lostpointercapture, blur, a hidden page and pause. A press under 250 ms and 10 px is a tap (core/pick.js); a longer
// one is a look-drag in a scan or thrust in flight. The look offsets (yaw ±60°, pitch ±35°, light inertia) live here.
// A chapter card moves on only by its Continue button (or Enter once its line is over), never by a scene tap.
// Nothing reaches the game while the arcade's game switcher is open.
import { classifyPointer } from '../../core/pick.js';
import { LOOK_YAW, LOOK_PITCH } from '../../core/geo.js';

const KEY_LOOK = 70;          // degrees per second with the arrow keys
const INERTIA = 5;            // per second: how fast a flung look slows down
const SWING_S = 0.55;         // seconds to swing toward a chevron's target
const CHAPTER_READY = 1;      // seconds a chapter card is up before Enter continues
const THRUST_KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);
const LOOK_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const LOOK_PHASES = new Set(['clue', 'scan', 'fork']);
const HURRY_PHASES = new Set(['intro', 'clue', 'scan', 'fork', 'reveal', 'ending', 'lost']);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const switcherOpen = () => Boolean(typeof window !== 'undefined' && window.GameSwitch && window.GameSwitch.isOpen);

// canvas: the element that takes scene presses. opts:
//   state()         the engine state (read only)
//   modal()         true while a full-screen card (title, pause, how it works, graphics) is up
//   cardOpen()      true while the scan card is open
//   canLook()       true while look-drags move the view
//   degPerPx()      degrees of view per CSS px of drag
//   reduced()       true under reduced motion
//   thrustMode()    'hold' | 'toggle'
//   pick(x, y)      → { letter } for a ring, { chevron: id } for an edge chevron, or null
//   act(action)     engine actions
//   select(letter)  open a candidate's card (also swings to it when off screen)
//   swing(id)       swing the view toward an object
//   cycle(dir)      Tab: open the next candidate
//   pause(), togglePause(), mute(), escape() → true when it closed something
export function createInput(canvas, opts) {
  const o = opts;
  const pointers = new Map();         // pointerId → { x0, y0, t0, x, y, lastX, lastY, lastT, thrust, drag, mouse }
  const keys = new Set();             // thrust keys held
  const lookKeys = new Set();
  let toggled = false;                // Thrust: Tap to toggle
  let virtual = false;                // QA hook: hold(on)
  const look = { yaw: 0, pitch: 0 };
  let vel = { yaw: 0, pitch: 0 };     // deg/s, for inertia
  let swing = null;                   // { from, to, t }
  let enabled = true;

  const phase = () => (o.state() || {}).phase;
  const blocked = () => !enabled || switcherOpen() || o.modal() || Boolean((o.state() || {}).paused);

  function setLook(yaw, pitch) {
    look.yaw = clamp(yaw, -LOOK_YAW, LOOK_YAW);
    look.pitch = clamp(pitch, -LOOK_PITCH, LOOK_PITCH);
  }

  // ---------- pointers ----------
  function down(e) {
    if (blocked()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
    const ph = phase();
    const t = e.timeStamp || performance.now();
    const p = {
      x0: e.clientX, y0: e.clientY, t0: t, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, lastT: t,
      thrust: false, drag: false, mouse: e.pointerType === 'mouse',
    };
    if (ph === 'flight') {
      if (o.thrustMode() === 'toggle') toggled = !toggled;
      else p.thrust = true;
    }
    swing = null;
    vel = { yaw: 0, pitch: 0 };
    pointers.set(e.pointerId, p);
  }

  function move(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (blocked()) { pointers.delete(e.pointerId); return; }
    const t = e.timeStamp || performance.now();
    const dx = e.clientX - p.lastX, dy = e.clientY - p.lastY;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.drag && Math.hypot(p.x - p.x0, p.y - p.y0) > 10) p.drag = true;
    // one finger looks; a second finger does not fight the first
    const first = pointers.keys().next().value === e.pointerId;
    if (p.drag && !p.thrust && first && o.canLook()) {
      const k = o.degPerPx();
      setLook(look.yaw - dx * k, look.pitch + dy * k);
      const dt = Math.max(1, t - p.lastT) / 1000;
      // smoothed fling velocity for inertia
      vel = { yaw: 0.6 * vel.yaw + 0.4 * (-dx * k / dt), pitch: 0.6 * vel.pitch + 0.4 * (dy * k / dt) };
    }
    p.lastX = e.clientX; p.lastY = e.clientY; p.lastT = t;
  }

  function up(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (blocked()) return;
    const t = e.timeStamp || performance.now();
    const kind = classifyPointer({ x: p.x0, y: p.y0, t: p.t0 }, { x: e.clientX, y: e.clientY, t });
    if (p.drag) {
      if (o.reduced() || t - p.lastT > 80) vel = { yaw: 0, pitch: 0 };
      return;
    }
    vel = { yaw: 0, pitch: 0 };
    if (kind === 'tap' && !p.thrust) tap(e.clientX, e.clientY);
  }

  function cancel(e) {
    pointers.delete(e.pointerId);
  }

  function tap(x, y) {
    const ph = phase();
    if (ph === 'flight' || ph === 'chapter' || ph === 'title') return;
    if (ph === 'clue' || ph === 'scan') {
      const hit = o.pick(x, y);
      if (hit && hit.letter) { o.select(hit.letter); return; }
      if (hit && hit.chevron) { o.swing(hit.chevron); return; }
      if (o.cardOpen()) { o.act({ type: 'close' }); return; }
    }
    if (HURRY_PHASES.has(ph)) o.act({ type: 'advance' });
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- keys ----------
  const isField = (t) => t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  const onButton = (t) => t && t !== document.body && (t.tagName === 'BUTTON' || t.tagName === 'A');

  function keydown(e) {
    if (switcherOpen() || isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code, key = e.key;
    // pause, mute and Esc work over the menus too
    if (code === 'Escape') {
      if (e.repeat) return;
      e.preventDefault();
      o.escape();
      return;
    }
    if (code === 'KeyP') { if (!e.repeat) o.togglePause(); e.preventDefault(); return; }
    if (code === 'KeyM') { if (!e.repeat) o.mute(); e.preventDefault(); return; }
    if (blocked()) return;
    const ph = phase();
    if (ph === 'title') return;
    // a focused button keeps Enter and Space for itself (except Space in flight, which is thrust)
    const enter = code === 'Enter' || code === 'NumpadEnter';
    if (onButton(e.target) && (enter || (code === 'Space' && ph !== 'flight'))) return;

    if (ph === 'flight' && THRUST_KEYS.has(code)) {
      e.preventDefault();
      if (onButton(e.target)) e.target.blur();
      if (o.thrustMode() === 'toggle') { if (!e.repeat) toggled = !toggled; }
      else keys.add(code);
      return;
    }
    if (o.canLook() && LOOK_KEYS[code]) {
      e.preventDefault();
      swing = null;
      lookKeys.add(code);
      return;
    }
    if (e.repeat) return;
    if ((ph === 'clue' || ph === 'scan') && /^Digit[123]$|^Numpad[123]$/.test(code)) {
      o.select('ABC'[Number(code.slice(-1)) - 1]);
      e.preventDefault();
      return;
    }
    if (ph === 'fork' && /^(Digit|Numpad)[12]$/.test(code)) {
      o.act({ type: 'fork', branch: code.endsWith('1') ? 'sheet' : 'void' });
      e.preventDefault();
      return;
    }
    if (code === 'Tab' && (ph === 'clue' || ph === 'scan')) {
      e.preventDefault();
      o.cycle(e.shiftKey ? -1 : 1);
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      e.preventDefault();
      if (ph === 'scan' && o.cardOpen()) o.act({ type: 'lock' });
      else if (ph === 'chapter') o.act({ type: chapterReady() ? 'continue' : 'advance' });
      else if (HURRY_PHASES.has(ph)) o.act({ type: 'advance' });
      return;
    }
    // any other key hurries a caption
    if (HURRY_PHASES.has(ph) && (code === 'Space' || key.length === 1)) {
      if (code === 'Space') e.preventDefault();
      o.act({ type: 'advance' });
    }
  }

  // Enter is Continue on a chapter card only once its line is over and the card has been up a moment, so Enter
  // pressed to hurry the reveal before it never skips the card.
  function chapterReady() {
    const st = o.state() || {};
    return st.phase === 'chapter' && !(st.say && st.say.current) && st.phaseT >= CHAPTER_READY;
  }

  function keyup(e) {
    keys.delete(e.code);
    lookKeys.delete(e.code);
  }

  // capture phase: the switcher stops keys from bubbling out of its box, and focus can stay in it after it closes
  addEventListener('keydown', keydown, true);
  addEventListener('keyup', keyup, true);

  // ---------- each frame ----------
  // Inertia, arrow-key looking and chevron swings. dt in seconds.
  function frame(dt) {
    const d = clamp(Number(dt) || 0, 0, 0.1);
    if (swing) {
      swing.t += d / SWING_S;
      const k = ease(swing.t);
      const { from, to } = swing;
      setLook(from.yaw + (to.yaw - from.yaw) * k, from.pitch + (to.pitch - from.pitch) * k);
      if (swing.t >= 1) swing = null;
      return;
    }
    if (!o.canLook() || blocked()) { vel = { yaw: 0, pitch: 0 }; return; }
    if (lookKeys.size) {
      let ky = 0, kp = 0;
      for (const c of lookKeys) { ky += LOOK_KEYS[c][0]; kp += LOOK_KEYS[c][1]; }
      setLook(look.yaw + ky * KEY_LOOK * d, look.pitch + kp * KEY_LOOK * d);
    }
    const held = [...pointers.values()].some((p) => p.drag);
    if (!held && (vel.yaw || vel.pitch)) {
      if (o.reduced()) { vel = { yaw: 0, pitch: 0 }; return; }
      setLook(look.yaw + vel.yaw * d, look.pitch + vel.pitch * d);
      const f = Math.exp(-INERTIA * d);
      vel = { yaw: vel.yaw * f, pitch: vel.pitch * f };
      if (Math.hypot(vel.yaw, vel.pitch) < 1) vel = { yaw: 0, pitch: 0 };
    }
  }

  // Thrust this tick: a held pointer that started in flight, a held thrust key, the toggle or the QA hold.
  function hold() {
    if (virtual) return true;
    if (blocked()) return false;
    if (toggled || keys.size) return true;
    for (const p of pointers.values()) if (p.thrust) return true;
    return false;
  }

  // Let go of everything: blur, a hidden page, pause, the switcher.
  function clear() {
    for (const id of pointers.keys()) {
      try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch { /* gone */ }
    }
    pointers.clear();
    keys.clear();
    lookKeys.clear();
    toggled = false;
    vel = { yaw: 0, pitch: 0 };
  }

  return {
    look, frame, hold, clear,
    get toggled() { return toggled; },
    // a new flight starts with the toggle off; a new scan starts looking straight at its framing
    resetThrust() { toggled = false; keys.clear(); for (const p of pointers.values()) p.thrust = false; },
    resetLook() { look.yaw = 0; look.pitch = 0; vel = { yaw: 0, pitch: 0 }; swing = null; },
    swingTo(target) {
      const to = { yaw: clamp(target.yaw, -LOOK_YAW, LOOK_YAW), pitch: clamp(target.pitch, -LOOK_PITCH, LOOK_PITCH) };
      vel = { yaw: 0, pitch: 0 };
      if (o.reduced()) { swing = null; setLook(to.yaw, to.pitch); return; }
      swing = { from: { yaw: look.yaw, pitch: look.pitch }, to, t: 0 };
    },
    setVirtual(on) { virtual = Boolean(on); },
    set enabled(v) { enabled = Boolean(v); if (!enabled) clear(); },
    get enabled() { return enabled; },
    get pointers() { return pointers.size; },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      removeEventListener('keydown', keydown, true);
      removeEventListener('keyup', keyup, true);
    },
  };
}
