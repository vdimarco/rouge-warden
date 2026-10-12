export function setupTouchControls({ root, stream }) {
  const document = root.ownerDocument;
  const pointers = new Map();
  const activations = new Map();
  let heldKeys = new Set();
  let enabled = false;
  const send = (name, values) => stream.toStreamerHandlers.get(name)?.(values);

  function syncKeys() {
    const next = new Set([...activations.keys(), ...[...pointers.values()].flatMap(pointer => pointer.keys)]);
    for (const key of heldKeys) if (!next.has(key)) send('KeyUp', [key]);
    for (const key of next) if (!heldKeys.has(key)) send('KeyDown', [key, 0]);
    heldKeys = next;
  }

  function updatePressed(target) {
    target.dataset.pressed = String([...pointers.values()].some(pointer => pointer.target === target)
      || activations.get(Number(target.dataset.key))?.target === target);
  }

  function move(pointer, event) {
    if (pointer.stick === 'move') {
      const bounds = pointer.target.getBoundingClientRect();
      const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
      const x = (event.clientX - bounds.left - bounds.width / 2) / radius;
      const y = (event.clientY - bounds.top - bounds.height / 2) / radius;
      pointer.keys = [x < -.28 && 65, x > .28 && 68, y < -.28 && 87, y > .28 && 83].filter(Boolean);
      const scale = radius * .55 / Math.max(1, Math.hypot(x, y));
      pointer.target.style.setProperty('--stick-x', `${x * scale}px`);
      pointer.target.style.setProperty('--stick-y', `${y * scale}px`);
      syncKeys();
    } else if (pointer.stick === 'look') {
      const delta = stream.webRtcController.coordinateConverter.translateSigned(event.clientX - pointer.x, event.clientY - pointer.y);
      if (Number.isFinite(delta.x) && Number.isFinite(delta.y)) {
        const signed = value => Math.max(-32767, Math.min(32767, Math.round(value)));
        send('MouseMove', [32768, 32768, signed(delta.x), signed(delta.y)]);
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
  }

  function release(pointerId) {
    const pointer = pointers.get(pointerId);
    if (!pointer) return;
    pointers.delete(pointerId);
    updatePressed(pointer.target);
    if (pointer.stick === 'move') {
      pointer.target.style.setProperty('--stick-x', '0px');
      pointer.target.style.setProperty('--stick-y', '0px');
    }
    syncKeys();
    if (pointer.target.hasPointerCapture(pointerId)) pointer.target.releasePointerCapture(pointerId);
  }

  function releaseAll() {
    const active = [...activations.values()];
    for (const activation of active) clearTimeout(activation.timer);
    activations.clear();
    for (const pointerId of [...pointers.keys()]) release(pointerId);
    for (const activation of active) updatePressed(activation.target);
    syncKeys();
  }

  function setEnabled(value) {
    if (!value) releaseAll();
    enabled = Boolean(value);
    root.hidden = !enabled;
  }

  root.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-stick], [data-key]');
    if (!enabled || event.button !== 0 || !target || !root.contains(target)) return;
    const stick = target.dataset.stick;
    if (stick && [...pointers.values()].some(pointer => pointer.stick === stick)) return;
    const key = Number(target.dataset.key);
    if (!stick && (!Number.isInteger(key) || key < 1 || key > 255)) return;
    event.preventDefault();
    const pointer = { target, stick, keys: stick ? [] : [key], x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, pointer);
    target.dataset.pressed = 'true';
    target.setPointerCapture(event.pointerId);
    if (stick === 'move') move(pointer, event);
    else if (stick === 'look') send('MouseEnter', []);
    else syncKeys();
  });
  root.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!enabled || !pointer) return;
    event.preventDefault();
    move(pointer, event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    root.addEventListener(type, event => release(event.pointerId));
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('button[data-key]');
    if (!enabled || event.detail !== 0 || !target || !root.contains(target)) return;
    const key = Number(target.dataset.key);
    if (!Number.isInteger(key) || key < 1 || key > 255 || heldKeys.has(key)) return;
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
  document.defaultView.addEventListener('blur', releaseAll);
  document.defaultView.addEventListener('resize', releaseAll);
  document.defaultView.addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  setEnabled(false);
  return { setEnabled, releaseAll };
}
