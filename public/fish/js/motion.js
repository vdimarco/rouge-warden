// The phone as a fishing rod. Reads DeviceOrientation and DeviceMotion and turns them into one rod pose:
// the rod angle θ and its speed ω, the heading, the steering tilt, the wrist twist, and how the phone is held.
// Touch and mouse play push the same pose through Motion.virtual(), so the game logic is the same in both modes.
//
// The phone's own axes: x to the right of the screen, y to its top edge, z out of the screen toward your face.
// deviceorientation: alpha about z, beta about x', gamma about y'' (intrinsic Z-X'-Y''), in degrees.
// devicemotion.rotationRate: alpha about x, beta about y, gamma about z, in deg/s. The letters do NOT match the ones above.
// Every rotation is right-handed. qa/fish/motion.test.mjs proves each sign with a table of poses.

const W = typeof window !== "undefined" ? window : globalThis;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const wrap180 = (a) => a - 360 * Math.round(a / 360);

// Tunables. Motion.tune is this object, so a debug page can change them live.
const T = {
  K_STILL: 0.3,      // per 60 Hz sample: how hard the pose pulls toward the OS orientation while the phone is still
  K_FAST: 0.01,     // ... and while it spins fast. Trust the gyro then: the OS orientation can lag a whip
  SPIN_LO: 30,       // deg/s: slower than this counts as still
  SPIN_HI: 200,      // deg/s: faster than this counts as spinning fast
  SPIN_HOLD: 60,     // ms: after a fast move the spin reading decays with this time constant (the OS orientation catches up)
  SNAP: 25,          // deg: if the pose and the OS orientation disagree this much while slow (a clipped gyro), pull hard
  DT_MIN: 5,         // ms: clamp the time between samples. A stalled main thread delivers them in bursts
  DT_MAX: 50,
  GYRO_MAX: 2000,    // deg/s: phone gyros clip near ±2000. Clamp, and treat a clipped reading as the most there is
  HIST_MS: 2000,     // ms of history for at() and peak()
  LIVE_MS: 400,      // a real sample this recent means the sensors are live
  WAIT_MS: 1200,     // request() waits this long for the first real sample
  ROLL_DEG: 35,      // deg of steering tilt for a full ±1
  ROLL_FLOOR: 0.5,   // keeps the steering calm when the rod is near level, where the tilt is hard to read
  FLAT_IN: 0.5,      // hypot(up.x, up.y) below this: the phone lies flat...
  FLAT_OUT: 0.6,     // ...and it must rise above this to count as upright again (no flapping near 0.55)
  TURN_PAST: 15,     // deg past the 45° midpoint before portrait/landscape switches
  TURN_HOLD: 250,    // ms the new orientation must hold before it counts
  EXTRAP_MS: 80,     // at() carries on past the last sample with its rate, at most this far
  LAG_MS: 0,         // added to the times at() and peak() look up. Calibrate on a device if touch and motion clocks skew
  DIFF_MS: 30,       // ms baseline for ω when there is no gyro (orientation only, or touch)
  DIFF_EMA: 0.5,     // light smoothing of that ω
  VIRTUAL_HOLD: 150, // ms: after a virtual() sample, real sensor samples do not overwrite the rod pose
};
const COS_SNAP = () => Math.cos(T.SNAP * D2R);

// Feature detection. Safari 26.4 hides the interfaces entirely outside a secure context.
const available = !!W && ("DeviceOrientationEvent" in W || "DeviceMotionEvent" in W) && W.isSecureContext !== false;
const needsPermission = available && [W.DeviceMotionEvent, W.DeviceOrientationEvent].some((C) => C && typeof C.requestPermission === "function");

/* ---------------- state (plain numbers: the per-sample path allocates nothing) ---------------- */
let status = available ? "idle" : "unsupported";
let mode = "portrait";
let listening = false, lastReal = -1e9, lastVirtual = -1e9;
const waiters = [];
const subs = [];

// the fused "up": the world's up direction in phone axes, and the time it describes
let ux = 0, uy = 1, uz = 0, have = false, tu = 0, uByGyro = false;
// the last gyro rates (deg/s about phone x, y, z), when they came, and what the self-check learned
let gx = 0, gy = 0, gz = 0, tg = -1e9, gyroOn = false, gyroSign = 1, gyroScale = 1;
// the last OS orientation, as an up vector (plus its angles, for the heading when there is no gyro)
let ox = 0, oy = 1, oz = 0, to = -1e9, oHave = false, oA = NaN, oB = 0, oG = 0;
// that orientation carried forward to now with the gyro: the target the fused pose is pulled toward
let qx = 0, qy = 1, qz = 0, tq = 0;
// the accelerometer, only for phones that send no orientation. iOS negates it: the sign is learned, not sniffed
let agx = 0, agy = 0, agz = 0, gSign = 0, gGuess = false;
// heading
let yaw = 0, yawRateS = 0, headPrev = NaN, sOmega = 0, lastG = false, spinH = 0;
// gyro self-check: does the gyro agree with how the orientation moves?
let calN = 0, calDot = 0, calLog = 0, calDone = false;
// orientation state machine: 0 portrait, 1 landscape (+x up), 2 upside down, 3 landscape (−x up), 4 flat
let oCode = 0, oQuad = 0, oInit = false, cCode = -1, cSince = 0;
// scratch output of rot()
let RX = 0, RY = 0, RZ = 0;

const pose = { t: 0, theta: 90, omega: 0, yaw: 0, yawRate: 0, roll: 0, twist: 0, spin: 0, orient: "portrait", side: 1, up: { x: 0, y: 1, z: 0 } };

/* ---------------- history: a ring of samples for at() and peak() ---------------- */
const HN = 512;
const HT = new Float64Array(HN), HA = new Float64Array(HN), HW = new Float64Array(HN), HY = new Float64Array(HN);
const HG = new Uint8Array(HN); // 1 = ω came from the gyro (an exact slope, so at() can bend the curve)
let h0 = 0, hn = 0, hYR = 0;
const idx = (i) => (h0 + i) % HN;
function push(t, th, w, y, g, yr) {
  hYR = yr;
  if (hn) {
    const L = idx(hn - 1);
    // same time or out of order (a touch timestamp older than the last frame): the newest news wins
    if (t <= HT[L]) { HA[L] = th; HW[L] = w; HY[L] = y; HG[L] = g; return; }
  }
  let j;
  if (hn < HN) { j = idx(hn); hn++; } else { j = h0; h0 = (h0 + 1) % HN; }
  HT[j] = t; HA[j] = th; HW[j] = w; HY[j] = y; HG[j] = g;
  while (hn > 2 && t - HT[h0] > T.HIST_MS) { h0 = (h0 + 1) % HN; hn--; }
}
// the newest sample at or before t (logical index), or −1
function find(t) {
  let lo = 0, hi = hn - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (HT[idx(m)] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}
// slope of a history channel over at least DIFF_MS: ω without a gyro, and yaw rate from touch
function slope(arr, t, v) {
  const i = find(t - T.DIFF_MS);
  if (i < 0) return 0;
  const j = idx(i), dt = t - HT[j];
  return dt > 0 && dt < 300 ? (wrap180(v - arr[j]) / dt) * 1000 : 0;
}

/* ---------------- geometry ---------------- */
// A world-fixed vector seen from the phone turns the other way when the phone turns: v ← rotate(v, −ω·dt).
function rot(x, y, z, wx, wy, wz, dts) {
  const wn = Math.sqrt(wx * wx + wy * wy + wz * wz), ang = -wn * dts * D2R;
  if (wn < 1e-9 || ang === 0) { RX = x; RY = y; RZ = z; return; }
  const kx = wx / wn, ky = wy / wn, kz = wz / wn, c = Math.cos(ang), s = Math.sin(ang);
  const kd = (kx * x + ky * y + kz * z) * (1 - c);
  RX = x * c + (ky * z - kz * y) * s + kx * kd;
  RY = y * c + (kz * x - kx * z) * s + ky * kd;
  RZ = z * c + (kx * y - ky * x) * s + kz * kd;
}
function normU() {
  const n = Math.sqrt(ux * ux + uy * uy + uz * uz);
  if (n > 1e-9) { ux /= n; uy /= n; uz /= n; } else { ux = 0; uy = 1; uz = 0; }
}
// Heading (deg, + = right) of the plane the rod swings in, from the orientation angles. Only used without a gyro.
// The swing plane is square to the hinge, so its forward line is up × hinge, measured in earth axes.
function heading() {
  if (!fin(oA)) return NaN;
  const a = oA * D2R, b = oB * D2R, c = oG * D2R, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(c), sg = Math.sin(c);
  let hx, hy;
  if (mode === "landscape") { const s = -pose.side; hx = s * -sa * cb; hy = s * ca * cb; } // hinge = −side · (phone y) in earth axes
  else { hx = ca * cg - sa * sb * sg; hy = sa * cg + ca * sb * sg; }                       // hinge = phone x in earth axes
  if (hx * hx + hy * hy < 0.09) return NaN; // the hinge points up or down: no heading to read
  return -Math.atan2(hx, -hy) * R2D;
}

/* ---------------- orientation: portrait / landscape / flat / upside, with hysteresis ---------------- */
const ORIENT = ["portrait", "landscape", "upside", "landscape", "flat"];
function setOrient(c) {
  oCode = c;
  if (c < 4) oQuad = c;
  pose.orient = ORIENT[c];
  if (c === 1) pose.side = 1; else if (c === 3) pose.side = -1;
}
function orientStep(t) {
  const m = Math.sqrt(ux * ux + uy * uy);
  let c;
  if (m < (oCode === 4 ? T.FLAT_OUT : T.FLAT_IN)) c = 4;
  else {
    let a = Math.atan2(ux, uy) * R2D; // 0 upright, 90 turned counter-clockwise (top to the left), like screen.orientation.angle
    if (a < 0) a += 360;
    const d = Math.abs(((a - oQuad * 90 + 540) % 360) - 180);
    c = d > 45 + T.TURN_PAST ? Math.round(a / 90) % 4 : oQuad;
  }
  if (!oInit) { oInit = true; setOrient(c); return; }
  if (c === oCode) { cCode = -1; return; }
  if (c !== cCode) { cCode = c; cSince = t; return; }
  if (t - cSince >= T.TURN_HOLD) { setOrient(c); cCode = -1; }
}

/* ---------------- the rod pose from the fused up vector ---------------- */
// commit = false only recomputes θ/ω/roll (after a mode change); it does not integrate, record or notify.
function solve(t, dts, g, commit) {
  if (commit) orientStep(t);
  const land = mode === "landscape", s = pose.side;
  // θ: the rod is the phone's top edge (portrait) or the screen's top edge = side·x (landscape)
  let th = Math.atan2(land ? s * ux : uy, uz) * R2D;
  if (th < -90) th += 360; // −90..270: continuous for every pose except the rod pointing straight down
  // the hinge is the axis the rod turns about when you tip it back: phone x (portrait) or −side·y (landscape)
  const uh = land ? -s * uy : ux;
  let om, ycw = 0;
  if (g) {
    const wh = land ? -s * gy : gx, wu = gx * ux + gy * uy + gz * uz;
    const den = 1 - uh * uh, dc = den < 0.2 ? 0.2 : den, perp = wu - uh * wh;
    // exact dθ/dt of the atan2 above. With no sideways lean (uh = 0) it is the hinge rate: rotationRate.alpha in portrait
    om = wh - (uh * perp) / dc;
    // heading of the swing plane (+ = right). A whip turns the phone about the hinge and must not change it, even with
    // the phone leaning sideways. Near a vertical hinge fall back to the plain rate about world up (up·ω)
    const k = den < 0.36 ? den / 0.36 : 1;
    ycw = -((k * perp) / dc + (1 - k) * wu);
  } else om = sOmega + T.DIFF_EMA * (slope(HA, t, th) - sOmega);
  // steering: the screen turned like a wheel, + = clockwise (right side down) as you look at it
  const sx = land ? -s * uy : ux, sy = land ? s * ux : uy;
  const roll = clamp((Math.atan2(-sx, sy > T.ROLL_FLOOR ? sy : T.ROLL_FLOOR) * R2D) / T.ROLL_DEG, -1, 1);
  const own = now() - lastVirtual >= T.VIRTUAL_HOLD; // touch play owns the rod pose for a moment after each virtual sample
  if (!commit) {
    if (own) { pose.theta = th; pose.roll = roll; if (g) pose.omega = om; }
    return;
  }
  if (g) {
    yaw += ((lastG ? (ycw + yawRateS) / 2 : ycw) * dts);
    yawRateS = ycw;
  } else {
    const hd = heading();
    if (fin(hd) && fin(headPrev)) yaw += wrap180(hd - headPrev);
    headPrev = hd;
    yawRateS = slope(HY, t, yaw);
  }
  lastG = g;
  sOmega = om;
  pose.up.x = ux; pose.up.y = uy; pose.up.z = uz;
  if (!own) return;
  pose.t = t; pose.theta = th; pose.omega = om; pose.yaw = yaw; pose.yawRate = yawRateS; pose.roll = roll;
  pose.twist = g ? gy : 0;
  pose.spin = g ? Math.sqrt(gx * gx + gy * gy + gz * gz) : Math.abs(om);
  push(t, th, om, yaw, g ? 1 : 0, yawRateS);
  emit();
}
function emit() {
  for (let i = 0; i < subs.length; i++) {
    try { subs[i](pose); } catch (err) { console.error(err); }
  }
}

/* ---------------- sensor events ---------------- */
// event.timeStamp shares the performance.now() clock with touch events. Never use event.interval
const stamp = (e) => { const t = e && e.timeStamp; return fin(t) && t > 0 && t < 1e11 ? t : now(); };
function seen() {
  lastReal = now();
  if (status !== "granted") status = "granted";
  while (waiters.length) waiters.pop()(true);
}
const gyroLive = (t) => gyroOn && t - tg < 100 && t - tg > -100;

function onOrientation(e) {
  if (!e || !fin(e.beta) || !fin(e.gamma)) return; // the one all-null event of a blocked or sensor-less browser
  const t = stamp(e);
  seen();
  // "up" from beta/gamma: the third row of R = Rz(α)·Rx(β)·Ry(γ). It stays smooth where beta/gamma flip (gimbal lock)
  const b = e.beta * D2R, c = e.gamma * D2R, cb = Math.cos(b);
  const nx = -cb * Math.sin(c), ny = Math.sin(b), nz = cb * Math.cos(c);
  if (gyroLive(t)) selfCheck(nx, ny, nz, t);
  ox = nx; oy = ny; oz = nz; to = t; oHave = true;
  qx = nx; qy = ny; qz = nz; tq = t;
  oA = fin(e.alpha) ? e.alpha : NaN; oB = e.beta; oG = e.gamma;
  if (gyroLive(t)) {
    // the gyro stream moves the pose; this sample corrects it on the next motion event
    if (!have) { ux = nx; uy = ny; uz = nz; tu = t; have = true; uByGyro = false; }
    return;
  }
  // no gyro: the OS orientation is the pose
  const dts = clamp(t - tu, T.DT_MIN, T.DT_MAX) / 1000;
  ux = nx; uy = ny; uz = nz; tu = t; have = true; uByGyro = false;
  solve(t, dts, false, true);
}

function onMotion(e) {
  if (!e) return;
  const r = e.rotationRate, a = e.accelerationIncludingGravity;
  const hasG = !!r && fin(r.alpha) && fin(r.beta) && fin(r.gamma);
  const hasA = !!a && fin(a.x) && fin(a.y) && fin(a.z);
  if (!hasG && !hasA) return; // all null: no sensor, or blocked
  const t = stamp(e);
  seen();
  if (hasA) gravity(a.x, a.y, a.z, t);
  gyroOn = hasG;
  if (hasG) gyroStep(t, r.alpha, r.beta, r.gamma);
  else if (!oHave || t - to > 60) accelStep(t); // orientation is quiet (Chrome sends it only on a change): keep ω ticking to 0
}

function gravity(x, y, z, t) {
  agx = x; agy = y; agz = z;
  // learn the sign (+1 spec and Android, −1 iOS) from the orientation while the phone is roughly still
  if ((!gSign || gGuess) && oHave && t - to < 100) {
    const n = Math.sqrt(x * x + y * y + z * z);
    if (n > 8.3 && n < 11.3) {
      const d = (x * ox + y * oy + z * oz) / n;
      if (Math.abs(d) > 0.8) { gSign = d > 0 ? 1 : -1; gGuess = false; }
    }
  }
}
// gravity as a unit "up" in RX/RY/RZ; returns |a| or 0
function gravUp() {
  const n = Math.sqrt(agx * agx + agy * agy + agz * agz);
  if (n < 1) return 0;
  // nothing to learn the sign from: guess that the phone is held upright or face up
  if (!gSign) { gSign = agy + agz >= 0 ? 1 : -1; gGuess = true; }
  RX = (gSign * agx) / n; RY = (gSign * agy) / n; RZ = (gSign * agz) / n;
  return n;
}

function gyroStep(t, ra, rb, rc) {
  const M = T.GYRO_MAX, k0 = gyroSign * gyroScale;
  const wx = clamp(ra * k0, -M, M), wy = clamp(rb * k0, -M, M), wz = clamp(rc * k0, -M, M);
  const gap = t - tg;
  // trapezoid: turn by the mean of this rate and the one before
  const fresh = gap > 0 && gap < 100;
  const ax = fresh ? (wx + gx) / 2 : wx, ay = fresh ? (wy + gy) / 2 : wy, az = fresh ? (wz + gz) / 2 : wz;
  gx = wx; gy = wy; gz = wz; tg = t;
  if (!have) {
    if (oHave) { ux = ox; uy = oy; uz = oz; tu = to; }
    else if (gravUp()) { ux = RX; uy = RY; uz = RZ; tu = t; }
    else return;
    have = true; uByGyro = false;
  }
  // Integrate from the time "up" describes. Between gyro samples clamp to 5..50 ms: after a stall, events arrive in a
  // burst with nearly equal stamps. Right after an orientation sample set "up", the real (maybe tiny) gap is right
  const dt = uByGyro ? clamp(t - tu, T.DT_MIN, T.DT_MAX) : clamp(t - tu, 0, T.DT_MAX), dts = dt / 1000;
  // between orientation samples the gyro moves the rod, so θ does not lag a whip
  rot(ux, uy, uz, ax, ay, az, dts);
  ux = RX; uy = RY; uz = RZ; tu = t; uByGyro = true;
  const spin = Math.sqrt(wx * wx + wy * wy + wz * wz);
  // hold the spin a moment after a whip stops: a lagging OS orientation would drag θ back along the stroke
  spinH = Math.max(spin, spinH * Math.exp(-dt / T.SPIN_HOLD));
  let k = 0, px = 0, py = 0, pz = 0;
  if (oHave) {
    // The target: the last OS orientation (set on each orientation event), carried forward to now with the gyro.
    // Chrome sends orientation only when it changes by 0.1°, so a silent stream means "unchanged", not "gone":
    // keep pulling toward it, or a phone held still would never settle
    rot(qx, qy, qz, ax, ay, az, clamp(t - tq, -60, 60) / 1000);
    qx = RX; qy = RY; qz = RZ; tq = t;
    px = qx; py = qy; pz = qz;
    const s = spinH;
    k = s <= T.SPIN_LO ? T.K_STILL : s >= T.SPIN_HI ? T.K_FAST : T.K_STILL + ((T.K_FAST - T.K_STILL) * (s - T.SPIN_LO)) / (T.SPIN_HI - T.SPIN_LO);
    if (s < 150 && ux * px + uy * py + uz * pz < COS_SNAP()) k = Math.max(k, 0.5);
  } else {
    // no orientation stream at all: raw gravity, and only while the phone is not being swung
    const n = gravUp();
    if (n && Math.abs(n - 9.81) < 1.5 && spin < 120) { px = RX; py = RY; pz = RZ; k = 0.04; }
  }
  if (k > 0) {
    k = 1 - Math.pow(1 - k, Math.max(dt, T.DT_MIN) / 16.7);
    ux += k * (px - ux); uy += k * (py - uy); uz += k * (pz - uz);
  }
  normU();
  solve(t, dts, true, true);
}

function accelStep(t) {
  if (!oHave) {
    if (!gravUp()) return;
    if (!have) { ux = RX; uy = RY; uz = RZ; have = true; }
    else { ux += 0.3 * (RX - ux); uy += 0.3 * (RY - uy); uz += 0.3 * (RZ - uz); normU(); } // raw gravity shakes with every hand move
  } else if (!have) return;
  const dts = clamp(t - tu, T.DT_MIN, T.DT_MAX) / 1000;
  tu = t; uByGyro = false;
  solve(t, dts, false, true);
}

// Gyro self-check: over the first real moves, compare how the orientation's up vector moved with what the gyro
// predicts (u × ω·dt). A reversed sign or rad/s units would break the cast, so fix them once, then stop checking.
function selfCheck(nx, ny, nz, t) {
  if (calDone || !oHave) return;
  const dtm = t - to;
  if (dtm < 8 || dtm > 60) return;
  const dx = nx - ox, dy = ny - oy, dz = nz - oz, dn = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const f = (dtm / 1000) * D2R;
  const px = (ny * gz - nz * gy) * f, py = (nz * gx - nx * gz) * f, pz = (nx * gy - ny * gx) * f;
  const pn = Math.sqrt(px * px + py * py + pz * pz);
  if (dn < 0.02 || pn < 1e-5) return; // needs a real move of at least ~1° per sample
  calDot += (dx * px + dy * py + dz * pz) / (dn * pn);
  calLog += Math.log(dn / pn);
  if (++calN < 20) return;
  const c = calDot / calN, lr = calLog / calN;
  if (c < -0.6) gyroSign = -gyroSign;
  if (Math.abs(lr - Math.log(R2D)) < 0.6) gyroScale *= R2D; // the gyro spoke rad/s
  if (Math.abs(c) > 0.6) calDone = true;
  calN = 0; calDot = 0; calLog = 0;
}

function listen() {
  if (listening || !W.addEventListener) return;
  listening = true;
  // keep these for the whole session: removing all of them stops CoreMotion on iOS and resets its reference
  W.addEventListener("devicemotion", onMotion);
  W.addEventListener("deviceorientation", onOrientation);
}

/* ---------------- permission ---------------- */
function request() {
  if (!available) { status = "unsupported"; return Promise.resolve(status); }
  if (status === "denied") return Promise.resolve(status); // iOS never asks twice; do not nag
  // iOS: both prompts must start inside the tap, before any await. One dialog covers both.
  // Chrome 151+ has requestPermission too, so this is not an iOS test.
  let asks = null;
  try {
    const DM = W.DeviceMotionEvent, DO = W.DeviceOrientationEvent;
    const a = DM && typeof DM.requestPermission === "function" ? DM.requestPermission() : null;
    const b = DO && typeof DO.requestPermission === "function" ? DO.requestPermission() : null;
    if (a || b) asks = Promise.all([a, b]);
  } catch (err) {
    asks = Promise.reject(err);
  }
  return settle(asks);
}
async function settle(asks) {
  if (asks) {
    try {
      const r = await asks;
      if (r.includes("denied")) { status = "denied"; return status; }
    } catch (err) {
      // NotAllowedError: it was not inside a tap. The next tap can ask again
      if (err && err.name === "NotAllowedError") { if (status !== "granted") status = "idle"; return status; }
      // anything else: listen anyway (Android sends events without asking)
    }
  }
  listen();
  if (now() - lastReal < T.LIVE_MS) { status = "granted"; return status; }
  // a blocked or sensor-less browser sends one all-null event and then nothing: wait for real numbers
  const ok = await new Promise((res) => {
    waiters.push(res);
    setTimeout(() => { const i = waiters.indexOf(res); if (i >= 0) waiters.splice(i, 1); res(false); }, T.WAIT_MS);
  });
  if (ok || now() - lastReal < T.LIVE_MS) status = "granted";
  else if (status !== "granted") status = "no-data";
  return status;
}

/* ---------------- lookups ---------------- */
function atRaw(q) {
  if (!hn) return { theta: pose.theta, omega: pose.omega, yaw: pose.yaw };
  const i = find(q), L = idx(hn - 1);
  if (i === hn - 1) {
    // after the last sample (touch times run ahead of motion dispatch): carry on with the rate we have.
    // θ also bends with the gyro's change of rate (the stroke speeds up at 11 o'clock); ω just holds, so a
    // release never reads faster than the rod really went
    const tau = Math.min(q - HT[L], T.EXTRAP_MS) / 1000;
    let acc = 0;
    if (hn > 1) {
      const P = idx(hn - 2), h = HT[L] - HT[P];
      if (HG[L] && HG[P] && h >= T.DT_MIN && h <= T.DT_MAX) acc = clamp(((HW[L] - HW[P]) / h) * 1000, -50000, 50000);
    }
    return { theta: HA[L] + HW[L] * tau + 0.5 * acc * tau * tau, omega: HW[L], yaw: HY[L] + hYR * tau };
  }
  if (i < 0) { const F = idx(0); return { theta: HA[F], omega: HW[F], yaw: HY[F] }; }
  const a = idx(i), b = idx(i + 1), h = HT[b] - HT[a], s = h > 0 ? (q - HT[a]) / h : 1;
  let th = HA[a] + (HA[b] - HA[a]) * s;
  if (HG[a] && HG[b] && h > 0.5 && Math.abs(HA[b] - HA[a]) < 90) {
    // cubic Hermite: the gyro gives the exact slope at both ends, so the curve bends the way the stroke did
    const s2 = s * s, s3 = s2 * s, hs = h / 1000;
    th = (2 * s3 - 3 * s2 + 1) * HA[a] + (s3 - 2 * s2 + s) * hs * HW[a] + (3 * s2 - 2 * s3) * HA[b] + (s3 - s2) * hs * HW[b];
  }
  return { theta: th, omega: HW[a] + (HW[b] - HW[a]) * s, yaw: HY[a] + (HY[b] - HY[a]) * s };
}

/* ---------------- the module ---------------- */
export const Motion = {
  available,
  needsPermission,
  get status() { return status; },
  request,
  get live() { return now() - lastReal < T.LIVE_MS; },
  get mode() { return mode; },
  set mode(v) {
    const m = v === "landscape" ? "landscape" : "portrait";
    if (m === mode) return;
    mode = m;
    headPrev = NaN; // the hinge changed: start the heading afresh (yaw keeps its value)
    if (have) solve(pose.t, 0, gyroOn, false);
  },
  pose,
  // {theta, omega, yaw} at time t (ms, performance.now clock), from the ~2 s history
  at(t) { return atRaw((fin(t) ? t : now()) + T.LAG_MS); },
  // {minOmega, maxOmega, maxTheta, minTheta} over [t0, t1], including the values right at both ends
  peak(t0, t1) {
    const q0 = t0 + T.LAG_MS, q1 = t1 + T.LAG_MS;
    let n = 0, minO = Infinity, maxO = -Infinity, minT = Infinity, maxT = -Infinity;
    const add = (w, th) => { n++; if (w < minO) minO = w; if (w > maxO) maxO = w; if (th < minT) minT = th; if (th > maxT) maxT = th; };
    if (hn && fin(q0) && fin(q1) && q1 >= q0) {
      for (let i = Math.max(0, find(q0)); i < hn; i++) {
        const j = idx(i);
        if (HT[j] > q1) break;
        if (HT[j] >= q0) add(HW[j], HA[j]);
      }
      if (q0 >= HT[idx(0)] && q0 <= HT[idx(hn - 1)]) { const e = atRaw(q0); add(e.omega, e.theta); }
      if (q1 >= HT[idx(0)]) { const e = atRaw(q1); add(e.omega, e.theta); }
    }
    if (!n) return { minOmega: 0, maxOmega: 0, maxTheta: pose.theta, minTheta: pose.theta };
    return { minOmega: minO, maxOmega: maxO, maxTheta: maxT, minTheta: minT };
  },
  // aim from here: yaw 0 = the way the phone points now
  recenter() {
    const d = yaw;
    yaw = 0;
    if (now() - lastVirtual >= T.VIRTUAL_HOLD) {
      pose.yaw = 0;
      for (let i = 0; i < hn; i++) HY[idx(i)] -= d; // so at() between old samples agrees with the new zero
    }
  },
  on(fn) { if (typeof fn === "function" && !subs.includes(fn)) subs.push(fn); },
  off(fn) { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); },
  // a pose from touch or mouse play. ω comes from the history, so the cast logic reads it like a gyro
  virtual({ t, theta, yaw: vy = 0, roll: vr = 0 } = {}) {
    if (!fin(theta)) return;
    if (!fin(t)) t = now();
    if (!fin(vy)) vy = 0;
    lastVirtual = now();
    if (!(now() - lastReal < T.LIVE_MS)) status = "virtual";
    const w = slope(HA, t, theta), yr = slope(HY, t, vy);
    pose.t = t; pose.theta = theta; pose.omega = w; pose.yaw = vy; pose.yawRate = yr;
    pose.roll = clamp(fin(vr) ? vr : 0, -1, 1); pose.twist = 0; pose.spin = Math.abs(w);
    push(t, theta, w, vy, 0, yr);
    emit();
  },
  // tests: a raw sample as the browser would send it, through the same handlers as real events
  inject({ t, alpha, beta, gamma, rotationRate, acc } = {}) {
    const ts = fin(t) ? t : now();
    if (beta !== undefined || gamma !== undefined || alpha !== undefined) onOrientation({ timeStamp: ts, alpha, beta, gamma });
    if (rotationRate !== undefined || acc !== undefined) onMotion({ timeStamp: ts, rotationRate: rotationRate || null, accelerationIncludingGravity: acc || null });
  },
  tune: T,
  // debug: what the gyro self-check decided (1 = as the spec says)
  get gyroSign() { return gyroSign; },
  get gyroScale() { return gyroScale; },
};
