// Ahead of the Light: the controls. Keys: A D or ← → strafe, W S or ↑ ↓ climb and dive, SHIFT boost, SPACE sonar.
// A drag anywhere on the view is a stick from where it started (the left of the screen on a phone, where the
// thumb rests); the touch buttons hold BOOST and tap SONAR. A gamepad's left stick steers, RT or A boosts and X
// or B pings. read() returns this step's { x, y, boost, ping } and spends the ping.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createInput({ surface, boostBtn = null, pingBtn = null, invert = () => false } = {}) {
  const keys = new Set();
  const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  let pingQueued = false, boostHeld = false, last = 'keys';
  const R = () => Math.max(46, Math.min(90, Math.min(innerWidth, innerHeight) * 0.14));

  function onKey(e, down) {
    const k = e.code;
    if (down && k === 'Space' && !e.repeat) { pingQueued = true; last = 'keys'; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (down) keys.add(k); else keys.delete(k);
  }
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  addEventListener('blur', () => { keys.clear(); stick.id = null; boostHeld = false; });

  surface.addEventListener('pointerdown', (e) => {
    if (stick.id !== null) return;
    stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.x = 0; stick.y = 0;
    last = e.pointerType === 'touch' ? 'touch' : 'mouse';
    try { surface.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic event */ }
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stick.id) return;
    const r = R();
    stick.x = clamp((e.clientX - stick.x0) / r, -1, 1);
    stick.y = clamp(-(e.clientY - stick.y0) / r, -1, 1);
  });
  const end = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = 0; stick.y = 0; } };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  if (boostBtn) {
    boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); boostHeld = true; try { boostBtn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) boostBtn.addEventListener(t, () => { boostHeld = false; });
  }
  if (pingBtn) pingBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pingQueued = true; });

  let padPing = false;
  function pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      const pingNow = Boolean(p.buttons[2]?.pressed || p.buttons[1]?.pressed);
      if (pingNow && !padPing) pingQueued = true;
      padPing = pingNow;
      const boost = Boolean(p.buttons[7]?.pressed || p.buttons[0]?.pressed);
      if (dz(ax) || dz(ay) || boost || pingNow) last = 'pad';
      return { x: dz(ax), y: -dz(ay), boost };
    }
    return null;
  }

  function read() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (x || y) last = 'keys';
    let boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || boostHeld;
    if (stick.id !== null) { x += stick.x; y += stick.y; }
    const p = pad();
    if (p) { x += p.x; y += p.y; boost = boost || p.boost; }
    if (invert()) y = -y;
    const out = { x: clamp(x, -1, 1), y: clamp(y, -1, 1), boost, ping: pingQueued };
    pingQueued = false;
    return out;
  }
  return {
    read, keys, stick,
    ping() { pingQueued = true; },
    reset() { keys.clear(); stick.id = null; stick.x = stick.y = 0; pingQueued = false; boostHeld = false; },
    last: () => last,
  };
}
