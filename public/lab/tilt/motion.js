// Optional gentle steering. The phone's comfortable starting pose is neutral.
// Output is a unit-disc vector in the game's axes: right +x, up +y. The game
// decides how much acceleration this adds; this module never moves the ball.
const RAD = Math.PI / 180;
const DEAD_ZONE = Math.sin(2 * RAD), FULL_TILT = Math.sin(18 * RAD), SMOOTH_SECONDS = 0.16;
const STALE_MS = 500, NO_DATA_MS = 4000;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const screenAngle = (n) => ((n % 360) + 360) % 360;
const zero = () => ({ x: 0, y: 0 });

// No browser dependencies. time is monotonic milliseconds; dt is seconds.
// A fresh stream, a different screen orientation, or reset() makes the next
// valid reading neutral. Invalid or stale data cannot leave a steering force.
export function createTiltFilter() {
  let neutral = null, lastTime = -Infinity;
  let targetX = 0, targetY = 0, x = 0, y = 0;
  function reset() {
    neutral = null; lastTime = -Infinity;
    targetX = targetY = x = y = 0;
  }
  function ingest({ beta, gamma, angle = 0, time } = {}) {
    if (!finite(beta) || !finite(gamma) || !finite(angle) || !finite(time)
        || Math.abs(beta) > 180 || Math.abs(gamma) > 90 || time < lastTime) {
      reset();
      return false;
    }
    const a = screenAngle(angle);
    // Gravity projected onto the natural device's screen plane. Unlike raw
    // Euler-angle differences, this stays continuous near an upright phone.
    // alpha is a turn about Earth's vertical axis and cannot change gravity.
    const gx = Math.cos(beta * RAD) * Math.sin(gamma * RAD);
    const gy = -Math.sin(beta * RAD);
    const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
    const screenX = gx * c - gy * s, screenY = gx * s + gy * c;
    if (!neutral || a !== neutral.angle || time - lastTime > STALE_MS) {
      reset();
      neutral = { x: screenX, y: screenY, angle: a };
      lastTime = time;
      return true;
    }
    lastTime = time;
    // DeviceOrientation's axes stay in the device's natural orientation.
    // Screen Orientation's positive angle is counter-clockwise: at 90deg,
    // natural-device down becomes screen right, and right becomes screen up.
    // https://www.w3.org/TR/orientation-event/#deviceorientation
    // https://www.w3.org/TR/screen-orientation/#dfn-current-orientation-angle
    const dx = screenX - neutral.x, dy = screenY - neutral.y;
    const distance = Math.hypot(dx, dy);
    const strength = Math.min(1, Math.max(0, (distance - DEAD_ZONE) / (FULL_TILT - DEAD_ZONE)));
    targetX = distance ? dx / distance * strength : 0;
    targetY = distance ? dy / distance * strength : 0;
    return true;
  }
  function sample(dt, time) {
    if (!neutral || !finite(time) || time < lastTime || time - lastTime > STALE_MS) {
      reset();
      return zero();
    }
    if (finite(dt) && dt > 0) {
      // Limit a delayed frame so resuming cannot jump straight to full force.
      const amount = 1 - Math.exp(-Math.min(dt, 0.1) / SMOOTH_SECONDS);
      x += (targetX - x) * amount;
      y += (targetY - y) * amount;
    }
    return { x: Math.abs(x) < 1e-12 ? 0 : x, y: Math.abs(y) < 1e-12 ? 0 : y };
  }
  return { ingest, sample, reset, get calibrated() { return neutral !== null; } };
}

// onChange receives a state string, only when it changes. No permission or
// sensor access occurs until enable(), which must be called by a user gesture.
export function createTiltControl({ onChange = () => {} } = {}) {
  const win = typeof window !== "undefined" ? window : null;
  const doc = win?.document || (typeof document !== "undefined" ? document : null);
  const filter = createTiltFilter();
  const now = () => win?.performance?.now?.() ?? Date.now();
  const getAngle = () => {
    const modern = win?.screen?.orientation?.angle;
    return screenAngle(finite(modern) ? modern : finite(win?.orientation) ? win.orientation : 0);
  };
  let state = "off", enabled = false, listening = false, paused = false;
  let background = !!doc?.hidden, generation = 0, pending = null, timer = null;
  let angle = getAngle();
  function setState(next) {
    if (state === next) return;
    state = next;
    onChange(state);
  }
  function clearTimer() {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  }
  function armTimer() {
    clearTimer();
    if (!listening || background) return;
    timer = win.setTimeout(() => {
      timer = null;
      stop("unavailable");
    }, NO_DATA_MS);
  }
  function recenter() {
    filter.reset();
    angle = getAngle();
    if (listening) {
      setState("calibrating");
      armTimer();
    }
  }
  function orientation(event) {
    if (!enabled || !listening || background) return;
    const nextAngle = getAngle();
    if (nextAngle !== angle) recenter();
    const valid = filter.ingest({ beta: event.beta, gamma: event.gamma, angle: nextAngle, time: now() });
    if (valid) {
      clearTimer();
      // While a menu is open, readings only prove that the sensor works.
      // The first reading after resume sets the gameplay neutral pose.
      if (paused) filter.reset();
      setState("on");
    } else if (state === "on") {
      setState("calibrating");
      armTimer();
    }
  }
  function visibility() {
    background = !!doc?.hidden;
    filter.reset();
    if (background) clearTimer();
    else recenter();
  }
  function pageHide() {
    background = true;
    filter.reset();
    clearTimer();
  }
  function pageShow() { visibility(); }
  function attach() {
    if (listening) return;
    listening = true;
    background = !!doc?.hidden;
    win.addEventListener("deviceorientation", orientation);
    win.addEventListener("orientationchange", recenter);
    win.screen?.orientation?.addEventListener?.("change", recenter);
    doc?.addEventListener?.("visibilitychange", visibility);
    win.addEventListener("pagehide", pageHide);
    win.addEventListener("pageshow", pageShow);
    recenter();
  }
  function detach() {
    clearTimer();
    if (!listening) return;
    listening = false;
    win.removeEventListener("deviceorientation", orientation);
    win.removeEventListener("orientationchange", recenter);
    win.screen?.orientation?.removeEventListener?.("change", recenter);
    doc?.removeEventListener?.("visibilitychange", visibility);
    win.removeEventListener("pagehide", pageHide);
    win.removeEventListener("pageshow", pageShow);
  }
  function stop(next) {
    generation++;
    enabled = false;
    pending = null;
    detach();
    filter.reset();
    setState(next);
  }
  function enable() {
    if (pending) return pending;
    if (enabled) return Promise.resolve(state);
    if (!win || win.isSecureContext === false || !win.DeviceOrientationEvent) {
      stop("unavailable");
      return Promise.resolve(state);
    }
    const attempt = ++generation;
    enabled = true;
    filter.reset();
    setState("requesting");
    let permission;
    try {
      // Invoke before any await/then so iOS retains this click's activation.
      permission = typeof win.DeviceOrientationEvent.requestPermission === "function"
        ? win.DeviceOrientationEvent.requestPermission() : "granted";
    } catch (error) {
      stop(error?.name === "NotAllowedError" ? "denied" : "unavailable");
      return Promise.resolve(state);
    }
    pending = Promise.resolve(permission).then((result) => {
      if (attempt !== generation || !enabled) return state;
      if (result !== "granted") stop("denied");
      else attach();
      return state;
    }, (error) => {
      if (attempt !== generation || !enabled) return state;
      stop(error?.name === "NotAllowedError" ? "denied" : "unavailable");
      return state;
    }).finally(() => { if (attempt === generation) pending = null; });
    return pending;
  }
  function suspend() {
    paused = true;
    filter.reset();
    if (listening) armTimer();
  }
  function resume() {
    if (!paused) return;
    paused = false;
    if (listening) recenter();
  }
  function sample(dt) {
    if (!enabled || !listening || paused || background || doc?.hidden) return zero();
    if (getAngle() !== angle) recenter();
    const value = filter.sample(dt, now());
    if (!filter.calibrated && state === "on") {
      setState("calibrating");
      armTimer();
    }
    return value;
  }
  return { enable, disable: () => stop("off"), recenter, suspend, resume, sample,
    get state() { return state; } };
}
