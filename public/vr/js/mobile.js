// Phone input stays in the flat-screen input path. Sensors never simulate XR tracking.
import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createMobile(canvas, active) {
  const enabled = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const state = { turn: 0, pitch: 0, moveX: 0, moveY: 0, hold: false, reel: false, yank: 0, jump: false, menu: false };
  if (!enabled) return { enabled, sample: () => state, reset() {}, start() {} };
  let sensors = false, motionSeen = false, down = false, launched = false;
  let lastYaw = null, lastPitch = null, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0;
  const clearPointers = [];
  let pull = 0, cooldown = 0, armedAt = 0, drag = null, stick = null, wasActive = false;
  const q = new THREE.Quaternion(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const screenQ = new THREE.Quaternion(), euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
  const panel = document.createElement('div'); panel.id = 'phoneControls'; panel.hidden = true;
  panel.innerHTML = `<div class="phone-top"><button data-action="motion">Enable motion</button><button data-action="center">Center</button><button data-action="menu">Pause</button></div><p class="phone-hint" role="status">Drag to aim. Hold Throw to swing.</p><div class="phone-bottom"><button class="phone-stick" aria-label="Drag to walk">MOVE</button><div class="phone-actions"><button data-action="jump">Jump</button><button data-action="reel">Pull</button><button data-action="throw">Throw</button></div></div>`;
  document.body.append(panel);
  const button = name => panel.querySelector(`[data-action="${name}"]`), hint = panel.querySelector('.phone-hint');
  function reset() {
    for (const clear of clearPointers) clear();
    down = launched = false; state.hold = state.reel = false; state.moveX = state.moveY = 0;
    state.turn = state.pitch = state.yank = 0; state.jump = state.menu = false;
    drag = stick = null; pull = 0; lastYaw = lastPitch = null;
    targetYaw = targetPitch = smoothYaw = smoothPitch = 0;
    button('throw').classList.remove('held');
  }
  function center() { lastYaw = lastPitch = null; targetYaw = targetPitch = smoothYaw = smoothPitch = 0; }
  async function start() {
    // Call both permission APIs synchronously within the user's tap, before awaiting either.
    try {
      const requests = [window.DeviceOrientationEvent, window.DeviceMotionEvent].map(C => C?.requestPermission ? C.requestPermission().catch(() => 'denied') : Promise.resolve(C ? 'granted' : 'denied'));
      const result = await Promise.all(requests);
      sensors = result.some(x => x === 'granted'); center();
      button('motion').textContent = sensors ? 'Motion on' : 'Retry motion';
      hint.textContent = sensors ? 'Move to aim. Hold Throw, then flick. Pull back to reel.' : 'Motion unavailable. Drag to aim; hold Throw and use Pull.';
    } catch { sensors = false; hint.textContent = 'Drag to aim; hold Throw and use Pull.'; }
  }
  button('motion').onclick = () => { if (sensors) { sensors = false; center(); button('motion').textContent = 'Enable motion'; hint.textContent = 'Drag to aim. Hold Throw to swing.'; } else start(); };
  button('center').onclick = () => { center(); hint.textContent = 'Aim centered.'; };
  button('menu').onclick = () => { state.menu = true; };
  button('jump').onclick = () => { state.jump = true; };
  function bindHold(el, begin, end) {
    let pointer = null;
    clearPointers.push(() => { pointer = null; });
    el.addEventListener('pointerdown', ev => { if (pointer !== null) return; ev.preventDefault(); pointer = ev.pointerId; el.setPointerCapture(pointer); begin(ev); });
    const finish = ev => { if (ev.pointerId !== pointer) return; pointer = null; end(ev); };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(name, finish);
  }
  bindHold(button('throw'), () => {
    down = true; launched = !sensors || !motionSeen; armedAt = performance.now();
    button('throw').classList.add('held');
    hint.textContent = launched ? 'Pull back or hold Pull. Release Throw to let go.' : 'Flick forward to throw.';
  }, () => { down = launched = false; button('throw').classList.remove('held'); hint.textContent = 'Hold Throw for the next swing.'; });
  bindHold(button('reel'), () => { state.reel = true; state.yank = 2.5; }, () => { state.reel = false; });
  const pad = panel.querySelector('.phone-stick');
  bindHold(pad, ev => { stick = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; }, () => { stick = null; state.moveX = state.moveY = 0; });
  pad.addEventListener('pointermove', ev => { if (stick?.id !== ev.pointerId) return; state.moveX = clamp((ev.clientX - stick.x) / 38, -1, 1); state.moveY = clamp((stick.y - ev.clientY) / 38, -1, 1); });
  bindHold(canvas, ev => { if (active()) drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; }, () => { drag = null; });
  canvas.addEventListener('pointermove', ev => {
    if (drag?.id !== ev.pointerId || !active()) return;
    state.turn -= (ev.clientX - drag.x) * .004; state.pitch -= (ev.clientY - drag.y) * .004;
    drag.x = ev.clientX; drag.y = ev.clientY;
  });
  addEventListener('deviceorientation', ev => {
    if (!sensors || !active() || !Number.isFinite(ev.beta) || !Number.isFinite(ev.gamma) || !Number.isFinite(ev.alpha)) return;
    const rad = Math.PI / 180, angle = (screen.orientation?.angle || 0) * rad;
    euler.set(ev.beta * rad, ev.alpha * rad, -ev.gamma * rad, 'YXZ');
    q.setFromEuler(euler).multiply(correction).multiply(screenQ.setFromAxisAngle(zAxis, -angle));
    euler.setFromQuaternion(q, 'YXZ');
    const yaw = euler.y, pitch = euler.x;
    if (lastYaw !== null) {
      targetYaw += clamp(Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)), -.18, .18);
      targetPitch += clamp(pitch - lastPitch, -.14, .14);
    }
    lastYaw = yaw; lastPitch = pitch;
  });
  addEventListener('devicemotion', ev => {
    if (!sensors || !active()) return;
    const a = ev.acceleration, r = ev.rotationRate;
    if (!a || !Number.isFinite(a.z)) return; // Never use accelerationIncludingGravity for a pull.
    motionSeen = true;
    if (!down) return;
    const now = performance.now();
    const rotation = Math.hypot(r?.alpha || 0, r?.beta || 0, r?.gamma || 0);
    if (!launched && now - armedAt > 80 && (a.z < -2.5 || rotation > 145)) {
      launched = true; cooldown = now + 350;
      navigator.vibrate?.(12); hint.textContent = 'Attached? Pull toward you to gain speed. Release Throw to fly.';
    } else if (launched && a.z > 1.6 && now > cooldown) {
      pull = Math.max(pull, clamp(a.z / 9, .2, 1));
      if (a.z > 4) { state.yank = clamp(a.z * .38, 1.6, 4.5); cooldown = now + 450; navigator.vibrate?.(8); }
    }
  });
  addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  screen.orientation?.addEventListener('change', () => { reset(); });
  return { enabled, reset, start,
    sample(dt) {
      const on = active(); panel.hidden = !on;
      if (!on) { if (wasActive) reset(); wasActive = false; return { ...state, hold: false }; }
      wasActive = true;
      const blend = 1 - Math.exp(-20 * Math.min(dt, .05));
      const sy = smoothYaw, sp = smoothPitch;
      smoothYaw += (targetYaw - smoothYaw) * blend; smoothPitch += (targetPitch - smoothPitch) * blend;
      // A held button also launches after a short delay if the phone gives no usable throw signal.
      if (down && !launched && performance.now() - armedAt > 850) launched = true;
      const out = { ...state, turn: state.turn + smoothYaw - sy, pitch: state.pitch + smoothPitch - sp, hold: down && launched, reel: state.reel ? 1 : (pull > .12 ? pull : 0) };
      pull *= Math.exp(-6 * dt);
      state.turn = state.pitch = state.yank = 0; state.jump = state.menu = false;
      return out;
    },
  };
}
