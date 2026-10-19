// Graded phone steering: three levels per side instead of digital A/D. Config/DefaultInput.ini maps NumPad 1/2 to
// MoveRight -0.33/-0.66 and NumPad 4/5 to +0.33/+0.66 (JavaScript key codes 97, 98, 100, 101); A and D stay full lock.
export const steerKeys = new Map([[-3, 65], [-2, 98], [-1, 97], [1, 100], [2, 101], [3, 68]]);
const steeringKeys = new Set(steerKeys.values());
// Wheel deflection, as a fraction of its drag reach, where each steering level and the pedals engage.
export const steerEdges = [.18, .45, .75];
export const pedalEdges = [.28];
// An engaged level holds until the thumb comes back this far below its edge, so a thumb resting on an edge cannot flicker.
export const holdMargin = .06;
// The wheel measures drags over 1.4 times its drawn radius, so small thumb jitter moves the steering less.
export const wheelReach = 1.4;

// Signed level for a signed deflection: 0 inside the deadzone, else the number of edges passed on that side.
export function gradedLevel(value, previous = 0, edges = steerEdges) {
  if (!Number.isFinite(value)) return 0;
  const side = Math.sign(value);
  const size = Math.abs(value);
  const engaged = edges.filter(edge => size >= edge).length;
  const held = edges.filter(edge => size >= edge - holdMargin).length;
  const current = Math.sign(previous) === side ? Math.abs(previous) : 0;
  return side * Math.min(Math.max(current, engaged), held) || 0;
}

export function setupTouchControls({ root, surface, stream }) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const gyroButton = document.getElementById('gyro-look');
  const gyroStatus = document.getElementById('gyro-status');
  const pointers = new Map();
  const activations = new Map();
  let heldKeys = new Set();
  let enabled = false;
  let driving = null;
  let swimming = false;
  let sprintLatched = false;
  let autoGas = false;
  let lastTap;
  const gasButton = document.getElementById('touch-gas');
  const brakeButton = document.getElementById('touch-brake');
  const useButton = document.getElementById('touch-use');
  const autoButton = document.getElementById('touch-auto');
  const combatGroup = root.querySelector('.touch-combat');
  // Aim holds the right mouse button; every other control holds a key code.
  const aimInput = 'RightMouseButton';
  let gyro = false;
  let gyroRequest = 0;
  let motionTime = null;
  let motionTimeout;
  let focused = true;
  const send = (name, values) => stream.toStreamerHandlers.get(name)?.(values);

  function sendLook(delta) {
    if (Number.isFinite(delta.x) && Number.isFinite(delta.y)) {
      const signed = value => Math.max(-32767, Math.min(32767, Math.round(value)));
      if (signed(delta.x) || signed(delta.y)) send('MouseMove', [32768, 32768, signed(delta.x), signed(delta.y)]);
    }
  }

  function look(x, y) {
    const delta = stream.webRtcController.coordinateConverter.translateSigned(x, y);
    const video = stream.webRtcController.videoPlayer.getVideoElement();
    // Preserve drag gain when performance adaptation changes the encoded frame size.
    const scale = 1280 / (Math.max(video.videoWidth, video.videoHeight) || 1280);
    sendLook({ x: delta.x * scale, y: delta.y * scale });
  }

  function stopGyro(message = 'Drag with a second finger to look.') {
    gyroRequest++;
    gyro = false;
    motionTime = null;
    clearTimeout(motionTimeout);
    window.removeEventListener('devicemotion', motion);
    gyroButton.disabled = !enabled;
    gyroButton.setAttribute('aria-pressed', 'false');
    gyroStatus.textContent = message;
  }

  function motion(event) {
    if (!gyro || !enabled || !focused || document.hidden) {
      motionTime = null;
      return;
    }
    const rate = event.rotationRate;
    if (!rate || ![rate.alpha, rate.beta, rate.gamma, event.timeStamp].every(Number.isFinite)) return;
    clearTimeout(motionTimeout);
    if (gyroButton.getAttribute('aria-pressed') !== 'true') {
      gyroButton.setAttribute('aria-pressed', 'true');
      gyroStatus.textContent = 'Gyro on. Move your phone to look; dragging still works.';
      send('MouseEnter', []);
    }
    if (root.inert || surface.inert) { motionTime = null; return; }
    const seconds = motionTime === null ? 0 : (event.timeStamp - motionTime) / 1000;
    motionTime = event.timeStamp;
    if (seconds <= 0 || seconds > .1) return;
    const angle = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    let yaw = rate.beta * Math.sin(angle) + rate.gamma * Math.cos(angle);
    const gravity = event.accelerationIncludingGravity;
    if (gravity && [gravity.x, gravity.y, gravity.z].every(Number.isFinite)) {
      const length = Math.hypot(gravity.x, gravity.y, gravity.z);
      if (length > 1) yaw = (rate.beta * gravity.x + rate.gamma * gravity.y + rate.alpha * gravity.z) / length;
    }
    const pitch = rate.beta * Math.cos(angle) - rate.gamma * Math.sin(angle);
    // Use native pixels so gyro gain does not change with the phone's CSS size or letterboxing.
    const pixels = rate => Math.abs(rate) < .3 ? 0 : -Math.max(-10, Math.min(10, rate * seconds)) * 6;
    const video = stream.webRtcController.videoPlayer.getVideoElement();
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      sendLook({ x: pixels(yaw) * 65534 / video.videoWidth, y: pixels(pitch) * 65534 / video.videoHeight });
    }
  }

  gyroButton.addEventListener('click', async () => {
    if (!enabled || gyroButton.disabled) return;
    if (gyro) { stopGyro(); return; }
    if (!window.isSecureContext || !window.DeviceMotionEvent) {
      stopGyro('Motion controls are unavailable on this device. Drag to look.');
      return;
    }
    const request = ++gyroRequest;
    gyroButton.disabled = true;
    gyroStatus.textContent = 'Waiting for motion permission…';
    try {
      const permission = window.DeviceMotionEvent.requestPermission
        ? await window.DeviceMotionEvent.requestPermission() : 'granted';
      if (!enabled || request !== gyroRequest) return;
      if (permission !== 'granted') { stopGyro('Motion access denied. Drag to look.'); return; }
      gyro = true;
      motionTime = null;
      gyroStatus.textContent = 'Move your phone to start gyro look…';
      window.addEventListener('devicemotion', motion, { passive: true });
      motionTimeout = setTimeout(() => stopGyro('No motion data received. Drag to look.'), 2500);
    } catch {
      if (request === gyroRequest && enabled) stopGyro('Motion access could not be enabled. Drag to look.');
    } finally {
      if (request === gyroRequest) gyroButton.disabled = !enabled;
    }
  });

  // A held control's native input: the right mouse button for Aim, else its key code (1-255), else null.
  function controlInput(target) {
    if (target.dataset.mouse === '2') return aimInput;
    const key = Number(target.dataset.key);
    return Number.isInteger(key) && key >= 1 && key <= 255 ? key : null;
  }

  function press(input) {
    if (input !== aimInput) { send('KeyDown', [input, 0]); return; }
    // Mouse buttons go to the middle of the game view, where look drags also point the cursor.
    send('MouseEnter', []);
    send('MouseDown', [2, 32768, 32768]);
  }

  function lift(input) {
    if (input === aimInput) send('MouseUp', [2, 32768, 32768]);
    else send('KeyUp', [input]);
  }

  function syncKeys() {
    const next = new Set([...activations.keys(), ...[...pointers.values()].flatMap(pointer => pointer.keys)]);
    if (!driving && sprintLatched && [65, 68, 87, 83].some(key => next.has(key))) next.add(16);
    if (driving) {
      // Auto gas holds Gas until any brake input (button or wheel pulled down) turns it off.
      if (next.has(83)) autoGas = false;
      if (autoGas) next.add(87);
      // Exactly one steering key: a held wheel level wins over a keyboard-style Left/Right pulse.
      const wheel = [...pointers.values()].find(pointer => pointer.stick === 'steer')?.keys.find(key => steeringKeys.has(key));
      const steering = [...next].filter(key => steeringKeys.has(key));
      for (const key of steering) if (key !== (wheel ?? steering[0])) next.delete(key);
    } else autoGas = false;
    if (driving && next.has(83)) next.delete(87);
    for (const key of heldKeys) if (!next.has(key)) lift(key);
    for (const key of next) if (!heldKeys.has(key)) press(key);
    heldKeys = next;
    gasButton.dataset.pressed = String(next.has(Number(gasButton.dataset.key)));
    gasButton.setAttribute('aria-pressed', String(!driving && sprintLatched));
    autoButton?.setAttribute('aria-pressed', String(autoGas));
  }

  function setAutoGas(value) {
    autoGas = Boolean(value) && enabled && driving === true;
    syncKeys();
  }

  function updatePressed(target) {
    target.dataset.pressed = String([...pointers.values()].some(pointer => pointer.target === target)
      || activations.get(controlInput(target))?.target === target);
  }

  function move(pointer, event) {
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 12) pointer.tapMoved = true;
    if (pointer.stick === 'steer') {
      // The wheel is a stick: left and right steer in three levels each, up accelerates, down brakes and then reverses.
      const bounds = pointer.target.getBoundingClientRect();
      const centerX = pointer.originX ?? bounds.left + bounds.width / 2;
      const centerY = pointer.originY ?? bounds.top + bounds.height / 2;
      const x = Math.max(-1, Math.min(1, (event.clientX - centerX) / (bounds.width / 2 * wheelReach)));
      const y = Math.max(-1, Math.min(1, (event.clientY - centerY) / (bounds.height / 2 * wheelReach)));
      pointer.steer = gradedLevel(x, pointer.steer);
      pointer.pedal = gradedLevel(y, pointer.pedal, pedalEdges);
      pointer.keys = [steerKeys.get(pointer.steer), pointer.pedal < 0 && 87, pointer.pedal > 0 && 83].filter(Boolean);
      pointer.target.dataset.steer = String(pointer.steer);
      pointer.target.style.setProperty('--steer-angle', `${x * 60}deg`);
      pointer.target.style.setProperty('--steer-y', `${Math.round(y * 12)}px`);
      syncKeys();
    } else if (pointer.stick === 'move') {
      const bounds = pointer.target.getBoundingClientRect();
      const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
      // A stick placed under the thumb measures from where the finger landed, not from the drawn stick.
      const centerX = pointer.originX ?? bounds.left + bounds.width / 2;
      const centerY = pointer.originY ?? bounds.top + bounds.height / 2;
      const x = (event.clientX - centerX) / radius;
      const y = (event.clientY - centerY) / radius;
      pointer.keys = [x < -.28 && 65, x > .28 && 68, y < -.28 && 87, y > .28 && 83].filter(Boolean);
      const scale = radius * .55 / Math.max(1, Math.hypot(x, y));
      pointer.target.style.setProperty('--stick-x', `${x * scale}px`);
      pointer.target.style.setProperty('--stick-y', `${y * scale}px`);
      syncKeys();
    } else if (pointer.stick === 'look' || pointer.lookDrag) {
      const otherLook = [...pointers.values()].some(other => other !== pointer && (other.stick === 'look' || (pointer.stick !== 'look' && other.looking)));
      if (!otherLook) {
        if (pointer.lookDrag && !pointer.looking) send('MouseEnter', []);
        pointer.looking = true;
        look(event.clientX - pointer.x, event.clientY - pointer.y);
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
  }

  function release(pointerId, event) {
    const pointer = pointers.get(pointerId);
    if (!pointer) return;
    pointers.delete(pointerId);
    if (!driving && (pointer.stick === 'move' || pointer.keys.includes(16))) {
      if (event?.type === 'pointerup' && !pointer.tapMoved && event.timeStamp - pointer.downTime <= 250
        && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 12) {
        lastTap = { target: pointer.target, time: event.timeStamp, x: event.clientX, y: event.clientY };
      } else lastTap = undefined;
    }
    updatePressed(pointer.target);
    if (pointer.stick === 'steer') {
      pointer.target.style.setProperty('--steer-angle', '0deg');
      pointer.target.style.setProperty('--steer-y', '0px');
      delete pointer.target.dataset.floating;
      delete pointer.target.dataset.steer;
    }
    if (pointer.stick === 'move') {
      sprintLatched = false;
      pointer.target.style.setProperty('--stick-x', '0px');
      pointer.target.style.setProperty('--stick-y', '0px');
      delete pointer.target.dataset.floating;
    }
    syncKeys();
    if (pointer.target.hasPointerCapture(pointerId)) pointer.target.releasePointerCapture(pointerId);
  }

  function releaseAll() {
    motionTime = null;
    sprintLatched = false;
    autoGas = false;
    lastTap = undefined;
    const active = [...activations.values()];
    for (const activation of active) clearTimeout(activation.timer);
    activations.clear();
    for (const pointerId of [...pointers.keys()]) release(pointerId);
    for (const activation of active) updatePressed(activation.target);
    syncKeys();
  }

  function setEnabled(value) {
    if (!value) { releaseAll(); stopGyro(); }
    enabled = Boolean(value);
    gyroButton.disabled = !enabled;
    root.hidden = !enabled;
  }

  function setDriving(value) {
    if (typeof value !== 'boolean' || value === driving) return;
    releaseAll();
    driving = value;
    swimming = false;
    root.dataset.driving = String(driving);
    root.querySelector('[data-stick="move"]').hidden = driving;
    root.querySelector('.touch-steering').hidden = !driving;
    // Combat buttons are for walking; the Auto gas toggle is for driving.
    if (combatGroup) combatGroup.hidden = driving;
    if (autoButton) autoButton.hidden = !driving;
    for (const [button, key, name, hint, label, icon] of [
      [gasButton, driving ? 87 : 16, driving ? 'Gas' : 'Sprint', driving ? 'Hold' : 'Hold / ×2', driving ? 'Hold to accelerate' : 'Hold or double-tap to sprint while moving',
        driving ? '<path d="M10 28V9l12-5v24ZM10 12h12M10 19h12"/>' : null],
      [brakeButton, driving ? 83 : 32, driving ? 'Brake' : 'Jump', driving ? 'Reverse' : 'On foot',
        driving ? 'Hold to brake, then reverse when stopped' : 'Jump on foot',
        driving ? '<path d="M7 12h18v16H7ZM7 19h18M11 5h10"/>' : null],
      [useButton, 69, driving ? 'Exit' : 'Use', driving ? 'Car' : 'Interact',
        driving ? 'Exit car' : 'Interact, enter car, toggle worklight', null]
    ]) {
      button.dataset.key = String(key);
      button.querySelector('b').textContent = name;
      button.querySelector('span').textContent = hint;
      button.setAttribute('aria-label', label);
      const svg = button.querySelector('svg');
      if (!svg.dataset.walkIcon) svg.dataset.walkIcon = svg.innerHTML;
      svg.innerHTML = icon || svg.dataset.walkIcon;
    }
  }

  function setSwimming(value) {
    if (typeof value !== 'boolean' || value === swimming || driving) return;
    swimming = value;
    brakeButton.querySelector('b').textContent = value ? 'Stroke' : 'Jump';
    brakeButton.querySelector('span').textContent = value ? 'Swim' : 'On foot';
    brakeButton.setAttribute('aria-label', value ? 'Swim stroke' : 'Jump on foot');
  }

  function pointerDown(event) {
    const control = event.target.closest('[data-stick], [data-key], [data-mouse], [data-toggle]');
    let target = control && root.contains(control) ? control : surface.contains(event.target) ? surface : null;
    if (!enabled || event.button !== 0 || !target) return;
    if (root.inert || surface.inert) return;
    if (target === surface && (event.pointerType !== 'touch'
      || event.target.closest('button, select, a, input, textarea, #menu, #intro, #overlay, #crew-picker, #install-nudge'))) return;
    // Auto gas toggles on touch, so a second finger can flip it while the first one steers.
    if (target.dataset.toggle === 'auto') {
      event.preventDefault();
      setAutoGas(!autoGas);
      return;
    }
    if (driving && [65, 68].includes(Number(target.dataset.key))) target = root.querySelector('.touch-steering');
    // The first finger on the game moves (on foot) or drives (in a car) from wherever it lands; a second finger looks.
    const floatStick = driving ? 'steer' : 'move';
    const floating = target === surface && ![...pointers.values()].some(pointer => pointer.stick === floatStick);
    if (floating) target = driving ? root.querySelector('.touch-steering') : root.querySelector('[data-stick="move"]');
    const stick = target === surface ? 'look' : target.dataset.stick;
    if (stick && [...pointers.values()].some(pointer => pointer.stick === stick)) return;
    const key = stick ? null : controlInput(target);
    if (!stick && key === null) return;
    event.preventDefault();
    if (!driving && (stick === 'move' || key === 16) && lastTap?.target === target
      && event.timeStamp >= lastTap.time && event.timeStamp - lastTap.time <= 300
      && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= 32) {
      sprintLatched = stick === 'move' || !sprintLatched;
      lastTap = undefined;
    }
    const pointer = { target, stick, keys: stick ? [] : [key], lookDrag: !driving && !stick && key !== 65 && key !== 68,
      x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, downTime: event.timeStamp };
    if (floating) {
      pointer.originX = event.clientX;
      pointer.originY = event.clientY;
      const frame = root.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      target.style.setProperty('--float-x', `${event.clientX - frame.left}px`);
      target.style.setProperty('--float-y', `${event.clientY - frame.top}px`);
      target.dataset.floating = 'true';
    }
    pointers.set(event.pointerId, pointer);
    target.dataset.pressed = 'true';
    target.setPointerCapture(event.pointerId);
    if (stick === 'move' || stick === 'steer') move(pointer, event);
    else if (stick === 'look') send('MouseEnter', []);
    else syncKeys();
  }
  function pointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!enabled || !pointer) return;
    event.preventDefault();
    move(pointer, event);
  }
  surface.addEventListener('pointerdown', pointerDown);
  surface.addEventListener('pointermove', pointerMove);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => release(event.pointerId, event));
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('button[data-key], button[data-mouse], button[data-toggle]');
    if (!enabled || root.inert || surface.inert || event.detail !== 0 || !target || !root.contains(target)) return;
    if (target.dataset.toggle === 'auto') {
      setAutoGas(!autoGas);
      return;
    }
    const key = controlInput(target);
    if (key === null) return;
    if (!driving && target === gasButton && sprintLatched) {
      sprintLatched = false;
      syncKeys();
      return;
    }
    if (heldKeys.has(key)) return;
    // Keep a click held across Unreal ticks so jump is observed before its release.
    const timer = setTimeout(() => {
      activations.delete(key);
      updatePressed(target);
      syncKeys();
    }, 120);
    activations.set(key, { timer, target });
    updatePressed(target);
    syncKeys();
  });
  root.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-menu-toggle]')) releaseAll();
  });
  window.addEventListener('blur', () => { focused = false; releaseAll(); });
  window.addEventListener('focus', () => { focused = true; motionTime = null; });
  window.addEventListener('resize', releaseAll);
  window.addEventListener('orientationchange', releaseAll);
  window.addEventListener('pagehide', () => { releaseAll(); stopGyro(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  setEnabled(false);
  return { setEnabled, releaseAll, setDriving, setSwimming };
}
