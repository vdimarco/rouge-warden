// Checks motion.js (the phone as a rod) in node with a tiny fake window: node qa/fish/motion.test.mjs
// A simulated phone (a rotation matrix over time) makes the same deviceorientation angles and devicemotion rates a real
// phone would, and they go in through Motion.inject(), which runs the same handlers as real events. Each sign in the
// pose is proven by a table of physical poses. Exit code 1 on failure.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const MOD = new URL("../../public/fish/js/motion.js", import.meta.url).href;

/* ---------------- a fake browser ---------------- */
function makeWindow({ api = true, secure = true, perm = null } = {}) {
  const L = {};
  const w = {
    isSecureContext: secure,
    addEventListener(type, fn) { (L[type] ||= []).push(fn); },
    removeEventListener(type, fn) { const a = L[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    fire(type, e) { for (const fn of L[type] || []) fn(e); },
    count(type) { return (L[type] || []).length; },
  };
  if (api) {
    w.DeviceMotionEvent = function () {};
    w.DeviceOrientationEvent = function () {};
    if (perm) { w.DeviceMotionEvent.requestPermission = perm.motion; w.DeviceOrientationEvent.requestPermission = perm.orient; }
  }
  return w;
}
let nImport = 0;
async function fresh(win = makeWindow()) {
  globalThis.window = win;
  const { Motion } = await import(MOD + "?i=" + nImport++);
  return Motion;
}

/* ---------------- reporting ---------------- */
const fails = [];
let passes = 0;
function check(ok, msg) {
  if (ok) passes++;
  else fails.push(msg);
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
}
const f1 = (v) => (v == null || Number.isNaN(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1));
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function section(name) { console.log("\n" + name); }

/* ---------------- a simulated phone ---------------- */
// R maps phone axes to earth axes (x east, y north, z up). The angler faces north. Row-major 3×3.
const Rx = (d) => { const c = Math.cos(d * D2R), s = Math.sin(d * D2R); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const Ry = (d) => { const c = Math.cos(d * D2R), s = Math.sin(d * D2R); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const Rz = (d) => { const c = Math.cos(d * D2R), s = Math.sin(d * D2R); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mul = (...Ms) => Ms.reduce((A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; });
const tr = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
// W3C angles from R, the way WebKit computes them (WebCoreMotionManager.mm): beta −180..180, gamma −90..90
function euler(R) {
  let z, x, y;
  if (R[8] > 0) { z = Math.atan2(-R[1], R[4]); x = Math.asin(R[7]); y = Math.atan2(-R[6], R[8]); }
  else if (R[8] < 0) { z = Math.atan2(R[1], -R[4]); x = -Math.asin(R[7]); x += x >= 0 ? -Math.PI : Math.PI; y = Math.atan2(R[6], -R[8]); }
  else if (R[6] > 0) { z = Math.atan2(-R[1], R[4]); x = Math.asin(R[7]); y = -Math.PI / 2; }
  else if (R[6] < 0) { z = Math.atan2(R[1], -R[4]); x = -Math.asin(R[7]); x += x >= 0 ? -Math.PI : Math.PI; y = -Math.PI / 2; }
  else { z = Math.atan2(R[3], R[0]); x = R[7] > 0 ? Math.PI / 2 : -Math.PI / 2; y = 0; }
  return { alpha: (z > 0 ? z : 2 * Math.PI + z) * R2D, beta: x * R2D, gamma: y * R2D };
}
// devicemotion.rotationRate for a moving phone: [ω]× = Rᵀ·dR/dt, alpha = about phone x, beta = y, gamma = z
function rate(Rf, t) {
  const e = 1e-5, A = tr(Rf(t)), P = mul(A, Rf(t + e)), M = mul(A, Rf(t - e)), S = P.map((v, i) => (v - M[i]) / (2 * e));
  return { alpha: S[7] * R2D, beta: S[2] * R2D, gamma: S[3] * R2D };
}
// Poses. θ = rod angle (90 upright, >90 tipped back over your shoulder); roll = turned clockwise as you look at the
// screen (right side down); turn = the angler turned to the right. side +1 = phone turned counter-clockwise (top to the left).
const portrait = (th, { roll = 0, turn = 0 } = {}) => mul(Rz(-turn), Ry(roll), Rx(th));
const landscape = (th, side = 1, { roll = 0, turn = 0 } = {}) => mul(Rz(-turn), Ry(roll), Rx(th), Rz(90 * side));
const upOf = (R) => ({ x: R[6], y: R[7], z: R[8] });
const T0 = 10000;
// feed a pose held still (rotation rate 0), n samples at 60 Hz
function hold(M, R, n = 3, t0 = T0, rr = { alpha: 0, beta: 0, gamma: 0 }) {
  const e = euler(R);
  for (let i = 0; i < n; i++) M.inject({ t: t0 + i * 16.7, ...e, rotationRate: rr });
  return t0 + (n - 1) * 16.7;
}
// play a motion R(t) (t in s) at 60 Hz through inject, with the true rates
function play(M, Rf, t0s, t1s, { hz = 60, gyro = true, each, lagO = 0, noise = 0, rnd, jitter = 0 } = {}) {
  let k = 0;
  for (let ts = t0s; ts <= t1s + 1e-9; ts = t0s + ++k / hz) {
    const tj = ts + (jitter ? rnd() * jitter : 0);
    const e = euler(Rf(Math.max(t0s, tj - lagO)));
    const w = rate(Rf, tj);
    if (noise) { e.beta += rnd() * noise; e.gamma += rnd() * noise; w.alpha += rnd() * noise * 15; w.beta += rnd() * noise * 15; w.gamma += rnd() * noise * 15; }
    M.inject({ t: T0 + tj * 1000, ...e, ...(gyro ? { rotationRate: w } : {}) });
    if (each) each(tj, M.pose);
  }
}
let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const smooth = (a, b, s) => a + (b - a) * (s <= 0 ? 0 : s >= 1 ? 1 : (1 - Math.cos(Math.PI * s)) / 2);

/* ================= 1. θ in portrait ================= */
section("1. θ in portrait (rod = the phone's top edge; θ = atan2(up.y, up.z))");
console.log("  pose                                   α       β       γ   →  θ want   θ got  orient");
const PORTRAIT = [
  ["upright, screen facing you", portrait(90), 90, "portrait"],
  ["tipped back 45° over the shoulder", portrait(135), 135, "portrait"],
  ["loaded: tipped back to 130°", portrait(130), 130, "portrait"],
  ["tipped forward to 60° (11 o'clock)", portrait(60), 60, "portrait"],
  ["level, face up, top forward", portrait(0), 0, "flat"],
  ["face down, top pointing back", portrait(180), 180, "flat"],
  ["past face down (rod back and down)", portrait(200), 200, "flat"],
  ["forward and down 30°", portrait(-30), -30, "flat"],
  ["upright, angler turned 70° right", portrait(100, { turn: 70 }), 100, "portrait"],
  ["tipped back to 110°, leaning 20° clockwise", portrait(110, { roll: 20 }), 110, "portrait"],
];
for (const [name, R, want, orient] of PORTRAIT) {
  const M = await fresh();
  hold(M, R);
  const e = euler(R), p = M.pose;
  console.log("  " + name.padEnd(38) + [e.alpha, e.beta, e.gamma].map((v) => f1(v).padStart(7)).join(" ") + "  " + f1(want).padStart(7) + " " + f1(p.theta).padStart(7) + "  " + p.orient);
  check(near(p.theta, want, 0.05) && p.orient === orient, `portrait θ: ${name} → ${f1(p.theta)}° (want ${want}°), orient ${p.orient}`);
}

/* ================= 2. θ in landscape ================= */
section("2. θ in landscape (rod = the screen's top edge = side·x; θ = atan2(side·up.x, up.z))");
const LAND = [
  ["side +1 (top to the left), upright", 1, landscape(90, 1), 90],
  ["side +1, rod raised back 30°", 1, landscape(120, 1), 120],
  ["side +1, rod lowered to 45°", 1, landscape(45, 1), 45],
  ["side −1 (top to the right), upright", -1, landscape(90, -1), 90],
  ["side −1, rod raised back 30°", -1, landscape(120, -1), 120],
  ["side −1, rod lowered to 45°", -1, landscape(45, -1), 45],
  ["side +1, upright, angler turned 50° right", 1, landscape(90, 1, { turn: 50 }), 90],
  ["side +1, upright, steered 20° clockwise", 1, landscape(90, 1, { roll: 20 }), 90],
];
for (const [name, side, R, want] of LAND) {
  const M = await fresh();
  M.mode = "landscape";
  hold(M, R);
  const e = euler(R), p = M.pose;
  console.log("  " + name.padEnd(42) + [e.alpha, e.beta, e.gamma].map((v) => f1(v).padStart(7)).join(" ") + "  →  θ " + f1(p.theta).padStart(6) + "  " + p.orient + " side " + p.side);
  check(near(p.theta, want, 0.05) && p.orient === "landscape" && p.side === side, `landscape θ: ${name} → ${f1(p.theta)}° (want ${want}°), ${p.orient}, side ${p.side}`);
}
{
  // the rod held low in the reel: the phone is nearly flat, so orient says "flat" but side and θ carry on
  const M = await fresh();
  M.mode = "landscape";
  const t = hold(M, landscape(90, -1), 3);
  play(M, (s) => landscape(smooth(90, 15, s / 0.5), -1), 0.001 + (t - T0) / 1000, 0.6 + (t - T0) / 1000);
  check(near(M.pose.theta, 15, 0.5) && M.pose.side === -1, `landscape side −1 lowered to 15°: θ ${f1(M.pose.theta)}, orient ${M.pose.orient}, side ${M.pose.side}`);
}

/* ================= 3. gimbal lock and the landscape flip ================= */
section("3. Continuity where beta/gamma flip");
{
  // portrait: sweep beta through 90 with gamma 5. The browser's angles degenerate at exactly 90
  for (const gyro of [true, false]) {
    const M = await fresh();
    let prev = null, maxStep = 0, maxErr = 0;
    play(M, (s) => mul(Rx(smooth(80, 100, s / 1.2)), Ry(5)), 0, 1.3, {
      gyro,
      each(ts, p) {
        const want = Math.atan2(Math.sin(smooth(80, 100, ts / 1.2) * D2R), Math.cos(smooth(80, 100, ts / 1.2) * D2R) * Math.cos(5 * D2R)) * R2D;
        if (prev != null) maxStep = Math.max(maxStep, Math.abs(p.theta - prev));
        if (ts > 0.1) maxErr = Math.max(maxErr, Math.abs(p.theta - want));
        prev = p.theta;
      },
    });
    check(maxStep < 0.6 && maxErr < 0.5, `portrait β 80→100 (γ 5)${gyro ? "" : " without gyro"}: largest θ step ${f2(maxStep)}°, largest error ${f2(maxErr)}°`);
  }
  // the exact degenerate output Chromium gives at beta = 90: gamma is folded into alpha.
  // Without a gyro the pose is the orientation itself; with a gyro reading 0 the filter settles on it in a few samples
  for (const gyro of [false, true]) {
    const M = await fresh();
    const seq = [[30, 89.9, 5], [35, 90, 0], [30, 90.1, 5]];
    const th = [], rl = [];
    seq.forEach(([a, b, g], i) => {
      for (let k = 0; k < (gyro ? 12 : 1); k++) M.inject({ t: T0 + (i * 12 + k) * 16.7, alpha: a, beta: b, gamma: g, ...(gyro ? { rotationRate: { alpha: 0, beta: 0, gamma: 0 } } : {}) });
      th.push(M.pose.theta); rl.push(M.pose.roll);
    });
    check(near(th[0], 89.9, 0.01) && near(th[1], 90, 0.01) && near(th[2], 90.1, 0.01) && Math.abs(rl[1] - rl[0]) < 0.01 && Math.abs(rl[2] - rl[1]) < 0.01,
      `raw (α,β,γ) (30,89.9,5) → (35,90,0) → (30,90.1,5)${gyro ? " with a still gyro" : ""}: θ ${th.map(f2).join(" → ")}, roll ${rl.map(f2).join(" → ")}`);
  }
}
{
  // landscape: the phone sideways and upright, the rod raised through vertical. gamma crosses −90 and the browser's
  // angles jump by 180 (α 30 β 3 γ −89 → α 210 β 177 γ 89) for a smooth move
  for (const [side, g0, g1] of [[1, -80, -100], [-1, 80, 100]]) {
    for (const gyro of [true, false]) {
      const M = await fresh();
      M.mode = "landscape";
      let prev = null, maxStep = 0, maxRollStep = 0, prevRoll = null, jumped = false, prevE = null, orientOk = true;
      const Rf = (s) => mul(Rz(30), Rx(3), Ry(smooth(g0, g1, s / 1.2)));
      play(M, Rf, 0, 1.3, {
        gyro,
        each(ts, p) {
          const e = euler(Rf(ts));
          if (prevE && Math.abs(e.beta - prevE.beta) > 90) jumped = true;
          prevE = e;
          if (prev != null) { maxStep = Math.max(maxStep, Math.abs(p.theta - prev)); maxRollStep = Math.max(maxRollStep, Math.abs(p.roll - prevRoll)); }
          prev = p.theta; prevRoll = p.roll;
          if (p.orient !== "landscape" || p.side !== side) orientOk = false;
        },
      });
      check(jumped && maxStep < 0.6 && maxRollStep < 0.02 && orientOk && near(M.pose.theta, 100, 0.5),
        `landscape side ${side > 0 ? "+1" : "−1"} γ ${g0}→${g1}${gyro ? "" : " without gyro"}: browser angles jumped ${jumped}, largest θ step ${f2(maxStep)}°, roll step ${f2(maxRollStep)}, θ ends ${f1(M.pose.theta)}, stays landscape ${orientOk}`);
    }
  }
  for (const gyro of [false, true]) {
    const M = await fresh();
    M.mode = "landscape";
    const n = gyro ? 12 : 1, rr = gyro ? { rotationRate: { alpha: 0, beta: 0, gamma: 0 } } : {};
    for (let k = 0; k < n; k++) M.inject({ t: T0 + k * 16.7, alpha: 30, beta: 3, gamma: -89, ...rr });
    const a = { ...M.pose };
    for (let k = 0; k < n; k++) M.inject({ t: T0 + (n + k) * 16.7, alpha: 210, beta: 177, gamma: 89, ...rr });
    check(near(a.theta, 89, 0.05) && near(M.pose.theta, 91, 0.05) && near(a.roll, M.pose.roll, 0.01) && M.pose.side === 1 && M.pose.orient === "landscape",
      `raw (30,3,−89) → (210,177,89) from the brief${gyro ? " with a still gyro" : ""}: θ ${f2(a.theta)} → ${f2(M.pose.theta)}, roll ${f2(a.roll)} → ${f2(M.pose.roll)}, ${M.pose.orient} side ${M.pose.side}`);
  }
}

/* ================= 4. ω from the gyro ================= */
section("4. ω = dθ/dt from the gyro (+ = rod moving back/up, − = forward/down). rotationRate: alpha = about x, beta = about y");
console.log("  pose                                   rotationRate (α, β, γ)   →   ω want   ω got");
const OMEGA = [
  ["portrait upright, tipping back", "portrait", portrait(90), [300, 0, 0], 300],
  ["portrait upright, whipping forward", "portrait", portrait(90), [-900, 0, 0], -900],
  ["portrait leaning 20°, about the hinge", "portrait", portrait(100, { roll: 20 }), [300, 0, 0], 300],
  ["portrait upright, wrist twist only", "portrait", portrait(90), [0, 500, 0], 0],
  ["landscape side +1, pulling up", "landscape", landscape(90, 1), [0, -300, 0], 300],
  ["landscape side +1, lowering", "landscape", landscape(90, 1), [0, 300, 0], -300],
  ["landscape side −1, pulling up", "landscape", landscape(90, -1), [0, 300, 0], 300],
  ["landscape side −1, lowering", "landscape", landscape(90, -1), [0, -300, 0], -300],
];
for (const [name, mode, R, [a, b, g], want] of OMEGA) {
  const M = await fresh();
  M.mode = mode;
  hold(M, R, 2);
  M.inject({ t: T0 + 2 * 16.7, ...euler(R), rotationRate: { alpha: a, beta: b, gamma: g } });
  console.log("  " + name.padEnd(38) + `(${a}, ${b}, ${g})`.padEnd(22) + "  → " + f1(want).padStart(7) + " " + f1(M.pose.omega).padStart(7));
  check(near(M.pose.omega, want, 0.5), `ω: ${name} → ${f1(M.pose.omega)} (want ${want})`);
}
{
  // a real move through the simulated phone: the sign of ω must match the way θ goes, in every hold
  const cases = [
    ["portrait tip back 90→130", "portrait", (s) => portrait(smooth(90, 130, s / 0.3))],
    ["portrait whip 130→40", "portrait", (s) => portrait(smooth(130, 40, s / 0.3))],
    ["portrait whip, leaning 25° and turning", "portrait", (s) => portrait(smooth(130, 40, s / 0.3), { roll: 25, turn: smooth(0, 30, s / 0.3) })],
    ["landscape +1 pull up 40→100", "landscape", (s) => landscape(smooth(40, 100, s / 0.3), 1)],
    ["landscape −1 pull up 40→100", "landscape", (s) => landscape(smooth(40, 100, s / 0.3), -1)],
    ["landscape +1 lower 100→40, steering", "landscape", (s) => landscape(smooth(100, 40, s / 0.3), 1, { roll: smooth(0, 25, s / 0.3) })],
  ];
  for (const [name, mode, Rf] of cases) {
    const M = await fresh();
    M.mode = mode;
    let prev = null, prevT = 0, worst = 0, signOk = true;
    play(M, Rf, 0, 0.33, {
      each(ts, p) {
        if (prev != null && Math.abs(p.omega) > 50) {
          const fd = (p.theta - prev) / (ts - prevT); // finite difference of θ between samples
          const mid = (M.at(T0 + (ts - 1 / 120) * 1000).omega);
          worst = Math.max(worst, Math.abs(mid - fd));
          if (Math.sign(fd) !== Math.sign(p.omega)) signOk = false;
        }
        prev = p.theta; prevT = ts;
      },
    });
    check(signOk && worst < 25, `simulated ${name}: sign of ω matches θ's direction ${signOk}, |ω(mid) − Δθ/Δt| ≤ ${f1(worst)} deg/s`);
  }
}

/* ================= 5. ω with no gyro ================= */
section("5. ω without a gyro (orientation only): differentiated and lightly smoothed");
{
  const Rf = (s) => portrait(90 + 200 * Math.min(s, 0.3)); // tip back at a steady 200 deg/s for 0.3 s, then hold
  const G = await fresh(), O = await fresh();
  const rows = [];
  let k = 0;
  for (let ts = 0; ts <= 0.6; ts = ++k / 60) {
    const e = euler(Rf(ts)), w = rate(Rf, ts + 1e-4 * (ts === 0.3 ? -1 : 0));
    G.inject({ t: T0 + ts * 1000, ...e, rotationRate: w, acc: { x: 0, y: 9.81, z: 0 } });
    // a gyro-less Android: orientation plus accelerometer-only motion events. Orientation goes quiet when the phone stops
    if (ts <= 0.35) O.inject({ t: T0 + ts * 1000, ...e });
    O.inject({ t: T0 + ts * 1000 + 3, acc: { x: 0, y: 9.81, z: 0 } });
    if (k % 3 === 0) rows.push([ts, G.pose.omega, O.pose.omega]);
  }
  console.log("  t (ms)   gyro ω   no-gyro ω   (truth: 200 until 300 ms, then 0)");
  for (const [ts, a, b] of rows) console.log("  " + String(Math.round(ts * 1000)).padStart(6) + " " + f1(a).padStart(8) + " " + f1(b).padStart(10));
  const at = (ms) => rows.find((r) => Math.round(r[0] * 1000) >= ms);
  check(near(at(100)[1], 200, 1), `gyro ω at 100 ms = ${f1(at(100)[1])} (exact from the first sample)`);
  check(near(at(150)[2], 200, 12) && near(at(250)[2], 200, 12), `no-gyro ω at 150/250 ms = ${f1(at(150)[2])} / ${f1(at(250)[2])} (within 6% of 200)`);
  check(Math.abs(rows.at(-1)[2]) < 3, `no-gyro ω decays to ${f1(rows.at(-1)[2])} once the phone stops (orientation quiet, motion events keep ticking)`);
  check(Math.abs(rows.at(-1)[1]) < 1, `gyro ω is ${f1(rows.at(-1)[1])} once the phone stops`);
}

/* ================= 6. the whip: θ must not lag ================= */
section("6. Complementary filter during a fast whip");
function castTheta(t) {
  // upright 0.3 s, tip back to 130° over 0.5 s, hold 0.1 s, whip forward: half-sine speed, 900 deg/s peak, 150° of travel
  const Tw = (150 * Math.PI) / 1800;
  if (t < 0.3) return { th: 90, w: 0 };
  if (t < 0.8) { const s = (t - 0.3) / 0.5; return { th: 90 + 20 * (1 - Math.cos(Math.PI * s)), w: (20 * Math.PI * Math.sin(Math.PI * s)) / 0.5 }; }
  if (t < 0.9) return { th: 130, w: 0 };
  if (t < 0.9 + Tw) { const p = (Math.PI * (t - 0.9)) / Tw; return { th: 130 - ((900 * Tw) / Math.PI) * (1 - Math.cos(p)), w: -900 * Math.sin(p) }; }
  return { th: -20, w: 0 };
}
const TW = (150 * Math.PI) / 1800;
const castTimeAt = (th) => 0.9 + (TW * Math.acos(1 - ((130 - th) * Math.PI) / (900 * TW))) / Math.PI;
{
  for (const lag of [0, 30]) {
    const M = await fresh();
    let worst = 0, worstRaw = 0;
    const Rf = (s) => portrait(castTheta(s).th, { roll: 10 });
    play(M, Rf, 0, 1.3, {
      lagO: lag / 1000,
      each(ts, p) {
        if (ts < 0.9 || ts > 1.17) return;
        worst = Math.max(worst, Math.abs(p.theta - castTheta(ts).th));
        worstRaw = Math.max(worstRaw, Math.abs(castTheta(Math.max(0, ts - lag / 1000)).th - castTheta(ts).th));
      },
    });
    check(worst < 3, `whip 900 deg/s, OS orientation ${lag ? "lagging " + lag + " ms" : "on time"}: fused θ within ${f2(worst)}° of truth during the stroke (the orientation alone is ${f1(worstRaw)}° behind)`);
  }
  // orientation only (no gyro): it simply follows the OS orientation, so a lag shows through. Shown for contrast.
  const M = await fresh();
  let worst = 0;
  play(M, (s) => portrait(castTheta(s).th), 0, 1.3, { gyro: false, lagO: 0.03, each(ts, p) { if (ts >= 0.9 && ts <= 1.17) worst = Math.max(worst, Math.abs(p.theta - castTheta(ts).th)); } });
  console.log(`  (for contrast: no gyro and a 30 ms orientation lag → θ is up to ${f1(worst)}° behind)`);
  // a clipped gyro: a 2600 deg/s whip reads 2000 at most. Once the phone is still, θ must settle back on the OS orientation
  const C = await fresh();
  const Tc = (150 * Math.PI) / 5200;
  const clipTh = (t) => (t < 0.2 ? 130 : t < 0.2 + Tc ? 130 - ((2600 * Tc) / Math.PI) * (1 - Math.cos((Math.PI * (t - 0.2)) / Tc)) : -20);
  let maxOm = 0, errMid = 0;
  play(C, (s) => portrait(clipTh(s)), 0, 0.8, { each(ts, p) { maxOm = Math.min(maxOm, p.omega); if (near(ts, 0.2 + Tc + 0.05, 0.009)) errMid = p.theta - clipTh(ts); } });
  check(maxOm >= -2000.01 && maxOm < -1900 && Math.abs(C.pose.theta - -20) < 0.5, `clipped whip (2600 deg/s): ω clamps at ${f1(maxOm)}, θ error right after ${f1(errMid)}°, settles to ${f2(C.pose.theta)}° (true −20°) once still`);
  // Chrome sends deviceorientation only when it changes by 0.1°. A pose that differs from the fused one (after a clipped
  // gyro, or a CDP test) arrives as ONE orientation event, then only motion events: θ must still settle on it
  const Q = await fresh();
  hold(Q, portrait(90), 3);
  Q.inject({ t: T0 + 60, ...euler(portrait(130)) });
  let settleMs = null;
  for (let i = 1; i <= 30; i++) {
    Q.inject({ t: T0 + 60 + i * 16.7, rotationRate: { alpha: 0, beta: 0, gamma: 0 }, acc: { x: 0, y: 9.81, z: 0 } });
    if (settleMs == null && Math.abs(Q.pose.theta - 130) < 0.5) settleMs = i * 16.7;
  }
  check(settleMs != null && settleMs < 300 && near(Q.pose.theta, 130, 0.05), `one orientation event, then motion events only (Chrome, phone still): θ within 0.5° after ${f1(settleMs)} ms, ends ${f2(Q.pose.theta)}`);
  // and the other way: the orientation stream stops while the gyro says the phone turns. θ follows the gyro
  const Z = await fresh();
  hold(Z, portrait(90), 3);
  for (let i = 1; i <= 30; i++) Z.inject({ t: T0 + 40 + i * 16.7, rotationRate: { alpha: 60, beta: 0, gamma: 0 } });
  check(near(Z.pose.theta, 90 + 60 * 0.5, 1), `orientation silent while the gyro turns 60 deg/s for 0.5 s: θ ${f1(Z.pose.theta)} (want 120, not dragged back to 90)`);
}

/* ================= 7. at(): interpolation and extrapolation ================= */
section("7. at(t): Hermite interpolation between samples, gyro extrapolation after the last one");
{
  const M = await fresh();
  // steady forward swing at −600 deg/s
  play(M, (s) => portrait(150 - 600 * s), 0, 0.15);
  const last = M.pose.t, thL = M.pose.theta;
  const mid = M.at(last - 25);
  check(near(mid.theta, 150 - 600 * ((last - 25 - T0) / 1000), 0.05) && near(mid.omega, -600, 1), `steady −600 deg/s: at(last − 25 ms) θ ${f2(mid.theta)} (want ${f2(150 - 600 * ((last - 25 - T0) / 1000))}), ω ${f1(mid.omega)}`);
  const ex = M.at(last + 15);
  check(near(ex.theta, thL - 9, 0.05) && near(ex.omega, -600, 1), `touch 15 ms after the last sample: at() extrapolates θ ${f2(ex.theta)} (want ${f2(thL - 9)})`);
  const far = M.at(last + 500);
  check(near(far.theta, thL - 600 * (M.tune.EXTRAP_MS / 1000), 0.05), `extrapolation stops after ${M.tune.EXTRAP_MS} ms: at(last + 500) = ${f1(far.theta)}`);
  const early = M.at(T0 - 1000);
  check(near(early.theta, 150, 0.05), `before the history: the first sample (${f1(early.theta)})`);
  // a changing speed: θ = 90 + 40·sin(2π·2t)
  const V = await fresh();
  const Rf = (s) => portrait(90 + 40 * Math.sin(4 * Math.PI * s));
  play(V, Rf, 0, 0.5, { jitter: 0.002, rnd });
  let worstI = 0;
  for (let q = 0.05; q < 0.49; q += 0.0037) worstI = Math.max(worstI, Math.abs(V.at(T0 + q * 1000).theta - (90 + 40 * Math.sin(4 * Math.PI * q))));
  check(worstI < 0.6, `sine stroke (±500 deg/s), jittered timestamps: error between samples ≤ ${f2(worstI)}° (includes the fused pose's own error)`);
  // the 15 ms touch skew on the same stroke, at many points: history only up to the sample before the touch
  let worstE = 0;
  for (let q = 0.1; q < 0.45; q += 0.023) {
    const W = await fresh();
    play(W, Rf, 0, q - 0.015);
    worstE = Math.max(worstE, Math.abs(W.at(T0 + q * 1000).theta - (90 + 40 * Math.sin(4 * Math.PI * q))));
  }
  check(worstE < 1.5, `sine stroke, touch time 15+ ms after the last sample: extrapolation error ≤ ${f2(worstE)}°`);
}

/* ================= 8. peak() ================= */
section("8. peak(t0, t1)");
{
  const M = await fresh();
  const Rf = (s) => portrait(castTheta(s).th);
  play(M, Rf, 0, 1.3);
  const tBack = 0.8, tWhip = 0.9 + TW / 2;
  const a = M.peak(T0 + 300, T0 + 850), b = M.peak(T0 + 850, T0 + 1250), c = M.peak(T0 + 850, T0 + (0.9 + TW / 4) * 1000);
  check(near(a.maxTheta, 130, 0.2) && near(a.minTheta, 90, 0.2) && near(a.maxOmega, 20 * Math.PI / 0.5, 3) && a.minOmega > -1, `back cast window: maxθ ${f1(a.maxTheta)}, minθ ${f1(a.minTheta)}, maxω ${f1(a.maxOmega)} (want ${f1(20 * Math.PI / 0.5)}), minω ${f1(a.minOmega)}`);
  check(near(b.minOmega, -900, 20) && near(b.minTheta, -20, 0.5) && near(b.maxTheta, 130, 0.2), `whip window: minω ${f1(b.minOmega)} (want −900), θ ${f1(b.minTheta)}..${f1(b.maxTheta)}`);
  check(near(c.minOmega, castTheta(0.9 + TW / 4).w, 15), `window ending mid-stroke includes the interpolated end: minω ${f1(c.minOmega)} (true ω there ${f1(castTheta(0.9 + TW / 4).w)})`);
  const E = await fresh();
  const e = E.peak(0, 1000);
  check(e.minOmega === 0 && e.maxOmega === 0 && e.maxTheta === E.pose.theta, "empty history: zeros and the current θ");
  void tBack; void tWhip;
}

/* ================= 9. twist and spin ================= */
section("9. twist (about the long axis, rotationRate.beta) and spin (|ω|)");
{
  const rows = [["portrait upright, twist 500", portrait(90), [0, 500, 0], 500, 500], ["portrait upright, twist −420", portrait(90), [0, -420, 0], -420, 420], ["portrait upright, tip 300 + twist 400", portrait(90), [300, 400, 0], 400, 500]];
  for (const [name, R, [a, b, g], tw, sp] of rows) {
    const M = await fresh();
    hold(M, R, 2);
    M.inject({ t: T0 + 40, ...euler(R), rotationRate: { alpha: a, beta: b, gamma: g } });
    check(near(M.pose.twist, tw, 0.01) && near(M.pose.spin, sp, 0.01), `${name}: twist ${f1(M.pose.twist)}, spin ${f1(M.pose.spin)}`);
  }
  // the real wrist twist, simulated: a quick turn about the phone's long axis and back
  const M = await fresh();
  let maxTw = 0;
  play(M, (s) => mul(portrait(90), Ry(60 * Math.sin(Math.PI * Math.min(s, 0.2) / 0.2))), 0, 0.25, { each(ts, p) { if (Math.abs(p.twist) > Math.abs(maxTw)) maxTw = p.twist; } });
  check(Math.abs(maxTw) > 900 && Math.abs(M.pose.theta - 90) < 1, `simulated wrist flip (60° and back in 0.2 s): peak twist ${f1(maxTw)} deg/s, θ stays ${f1(M.pose.theta)}`);
}

/* ================= 10. yaw ================= */
section("10. Yaw: + = turning right, integrated from the gyro about world up");
{
  const rows = [
    ["portrait upright, turn right 90°", "portrait", (s) => portrait(90, { turn: 90 * Math.min(s, 1) }), 90],
    ["portrait upright, turn left 60°", "portrait", (s) => portrait(90, { turn: -60 * Math.min(s, 1) }), -60],
    ["portrait tipped back to 130°, turn right 45°", "portrait", (s) => portrait(130, { turn: 45 * Math.min(s, 1) }), 45],
    ["landscape side +1, turn right 40°", "landscape", (s) => landscape(80, 1, { turn: 40 * Math.min(s, 1) }), 40],
    ["landscape side −1, turn right 40°", "landscape", (s) => landscape(80, -1, { turn: 40 * Math.min(s, 1) }), 40],
  ];
  for (const [name, mode, Rf, want] of rows) {
    for (const gyro of [true, false]) {
      const M = await fresh();
      M.mode = mode;
      let rateMid = 0;
      play(M, Rf, 0, 1.1, { gyro, each(ts, p) { if (near(ts, 0.5, 0.009)) rateMid = p.yawRate; } });
      check(near(M.pose.yaw, want, 1.5) && Math.sign(rateMid) === Math.sign(want), `${name}${gyro ? "" : " (no gyro: from the orientation angles)"}: yaw ${f1(M.pose.yaw)} (want ${want}), yawRate mid-turn ${f1(rateMid)}`);
    }
  }
  // a whip with the phone leaning 20°: the swing plane does not turn, so yaw must not move.
  // The plain rate about world up (up·ω) would drift here, because the tilted hinge has a vertical part.
  const M = await fresh();
  let naive = 0, prevT = null;
  const Rf = (s) => portrait(castTheta(s).th, { roll: 20 });
  play(M, Rf, 0, 1.3, { each(ts, p) { if (prevT != null) naive += -(p.up.x * rate(Rf, ts).alpha + p.up.y * rate(Rf, ts).beta + p.up.z * rate(Rf, ts).gamma) * (ts - prevT); prevT = ts; } });
  check(Math.abs(M.pose.yaw) < 1 && Math.abs(naive) > 15, `whole cast leaning 20°: yaw ${f2(M.pose.yaw)}° (a plain up·ω integral drifts ${f1(naive)}°)`);
  // recenter
  const R = await fresh();
  play(R, (s) => portrait(90, { turn: 30 * Math.min(s / 0.3, 1) }), 0, 0.4);
  const tMid = R.pose.t;
  R.recenter();
  const y0 = R.pose.yaw, atMid = R.at(tMid).yaw;
  play(R, (s) => portrait(90, { turn: 30 + 20 * Math.min((s - 0.4) / 0.3, 1) }), 0.4 + 1 / 60, 0.8);
  check(y0 === 0 && near(atMid, 0, 0.01) && near(R.pose.yaw, 20, 1), `recenter(): yaw 0 now (at() agrees: ${f2(atMid)}), then a 20° right turn reads ${f1(R.pose.yaw)}`);
}

/* ================= 11. steering roll ================= */
section("11. Steering roll: + = phone turned clockwise (right side down) as you look at it; ±35° = ±1");
{
  const rows = [
    ["landscape +1 upright, 17.5° clockwise", "landscape", landscape(90, 1, { roll: 17.5 }), 0.5],
    ["landscape +1 upright, 17.5° counter-clockwise", "landscape", landscape(90, 1, { roll: -17.5 }), -0.5],
    ["landscape −1 upright, 17.5° clockwise", "landscape", landscape(90, -1, { roll: 17.5 }), 0.5],
    ["landscape −1 upright, 17.5° counter-clockwise", "landscape", landscape(90, -1, { roll: -17.5 }), -0.5],
    ["landscape +1 upright, 35° clockwise", "landscape", landscape(90, 1, { roll: 35 }), 1],
    ["landscape +1 upright, 60° clockwise (clamped)", "landscape", landscape(90, 1, { roll: 60 }), 1],
    ["landscape +1 rod at 60°, wheel turned 17.5° cw", "landscape", mul(landscape(60, 1), Rz(-17.5)), 0.5],
    ["landscape +1 rod at 110°, wheel turned 17.5° ccw", "landscape", mul(landscape(110, 1), Rz(17.5)), -0.5],
    ["portrait upright, 17.5° clockwise", "portrait", portrait(90, { roll: 17.5 }), 0.5],
  ];
  for (const [name, mode, R, want] of rows) {
    const M = await fresh();
    M.mode = mode;
    // start from the plain pose so the orientation (and side) is known, then tilt
    hold(M, R, 3);
    check(near(M.pose.roll, want, 0.01), `${name}: roll ${f2(M.pose.roll)} (want ${want})`);
  }
  // the rod near level: the tilt is hard to read there, so a small lean must not throw the rod sideways
  const M = await fresh();
  M.mode = "landscape";
  hold(M, landscape(90, 1), 2);
  hold(M, mul(landscape(15, 1), Ry(8)), 3, T0 + 40);
  check(Math.abs(M.pose.roll) < 0.35, `rod near level (θ 15°) with an 8° lean about the rod: roll ${f2(M.pose.roll)} (calm)`);
}

/* ================= 12. orient and side, with hysteresis ================= */
section("12. orient / side: switch only 15° past the 45° midpoint and after 250 ms; flat on a table");
{
  // turn the phone slowly counter-clockwise from portrait to landscape (screen facing you), 1° per sample
  const M = await fresh();
  const at = (a) => mul(Rx(90), Rz(a)); // a = screen angle, counter-clockwise as you look at it
  let switchedAt = null, t = T0;
  for (let a = 0; a <= 90; a++) { M.inject({ t, ...euler(at(a)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } }); if (switchedAt == null && M.pose.orient === "landscape") switchedAt = a; t += 16.7; }
  for (let i = 0; i < 20; i++) { M.inject({ t, ...euler(at(90)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } }); t += 16.7; }
  check(switchedAt >= 61 + 14 && M.pose.orient === "landscape" && M.pose.side === 1, `turning counter-clockwise: landscape at ${switchedAt}° (not before 60° + 250 ms), side ${M.pose.side}`);
  // and back
  let backAt = null;
  for (let a = 90; a >= 0; a--) { M.inject({ t, ...euler(at(a)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } }); if (backAt == null && M.pose.orient === "portrait") backAt = a; t += 16.7; }
  check(backAt != null && backAt <= 29 - 14, `turning back: portrait at ${backAt}° (not before 30° − 250 ms)`);
  // shaky hands around the 45° midpoint, and right at the 60° switch point: no flapping
  for (const [center, amp] of [[45, 12], [60, 6], [30, 6]]) {
    const F = await fresh();
    let flips = 0, last = null;
    for (let i = 0; i < 180; i++) {
      const a = center + amp * Math.sin(i * 0.9) + rnd() * 2;
      F.inject({ t: T0 + i * 16.7, ...euler(at(a)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } });
      if (last && F.pose.orient !== last) flips++;
      last = F.pose.orient;
    }
    check(flips <= 1, `jitter ${center}° ± ${amp}° for 3 s: ${flips} orientation changes`);
  }
  // clockwise → side −1; upside down
  const S = await fresh();
  hold(S, mul(Rx(90), Rz(-90)), 3);
  check(S.pose.orient === "landscape" && S.pose.side === -1, `phone turned clockwise (−x up): ${S.pose.orient}, side ${S.pose.side}`);
  const U = await fresh();
  hold(U, mul(Rx(90), Rz(180)), 3);
  check(U.pose.orient === "upside", `phone upside down: ${U.pose.orient}`);
  // lying on a table, face up; then wobbling right at the flat threshold
  const Tb = await fresh();
  hold(Tb, mul(Rz(40), Rx(3)), 3);
  check(Tb.pose.orient === "flat", `face up on a table: ${Tb.pose.orient}`);
  let flips = 0, last = Tb.pose.orient;
  for (let i = 0; i < 180; i++) {
    const tilt = Math.asin(0.55) * R2D + 4 * Math.sin(i * 0.7); // hypot(up.x, up.y) wobbling around 0.55
    Tb.inject({ t: T0 + 100 + i * 16.7, ...euler(Rx(tilt)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } });
    if (Tb.pose.orient !== last) flips++;
    last = Tb.pose.orient;
  }
  check(flips <= 1, `wobbling around the flat threshold (0.55): ${flips} changes`);
  // a whole cast: the phone passes through near-flat poses during the whip but orient must stay portrait
  const C = await fresh();
  let leftPortrait = false;
  play(C, (s) => portrait(castTheta(s).th), 0, 1.15, { each(ts, p) { if (p.orient !== "portrait") leftPortrait = true; } });
  check(!leftPortrait, "orient stays portrait through the whole cast stroke");
}

/* ================= 13. virtual() ================= */
section("13. virtual(): touch and mouse feed the same pose");
{
  const M = await fresh();
  let calls = 0;
  const fn = () => calls++;
  M.on(fn);
  const rows = [];
  for (let i = 0; i <= 20; i++) {
    const t = T0 + i * 16.7, th = i < 5 ? 100 : i < 11 ? 100 - 600 * ((t - T0 - 5 * 16.7) / 1000) : 100 - 600 * 0.1;
    M.virtual({ t, theta: th, yaw: 5, roll: 0.2 });
    rows.push([i, th, M.pose.omega]);
  }
  console.log("  frame  θ      ω (a 600 deg/s flick from frame 5 to 11)");
  for (const [i, th, w] of rows) if (i % 2 === 0 || (i > 4 && i < 13)) console.log("  " + String(i).padStart(5) + " " + f1(th).padStart(6) + " " + f1(w).padStart(8));
  check(near(rows[9][2], -600, 30) && Math.abs(rows[20][2]) < 1, `virtual ω mid-flick ${f1(rows[9][2])} (want −600), after it ${f1(rows[20][2])}`);
  check(M.status === "virtual" && M.pose.yaw === 5 && M.pose.roll === 0.2 && calls === 21, `status ${M.status}, yaw/roll passed through, on() called ${calls}×`);
  const pk = M.peak(T0 + 20 * 16.7 - 450, T0 + 20 * 16.7);
  check(near(pk.minOmega, -600, 30), `peak() over the touch flick: minω ${f1(pk.minOmega)}`);
  // a pinmove timestamp older than the last frame: no NaN, and the newest θ wins
  M.virtual({ t: T0 + 20 * 16.7 - 5, theta: 30 });
  check(Number.isFinite(M.pose.omega) && M.at(T0 + 20 * 16.7).theta === 30, `out-of-order touch sample: ω ${f1(M.pose.omega)}, at(last) θ ${f1(M.at(T0 + 20 * 16.7).theta)}`);
  M.off(fn);
  M.virtual({ t: T0 + 400, theta: 30 });
  check(calls === 22, `off() stops the calls (${calls})`);
  // a live sensor and touch play at once (the player picked touch on a phone with motion on): touch owns the pose
  const B = await fresh();
  hold(B, portrait(120), 3);
  B.virtual({ t: T0 + 60, theta: 70 });
  hold(B, portrait(125), 3, T0 + 70);
  check(B.pose.theta === 70 && B.status === "granted" && B.live, `touch owns the rod pose while it plays (θ ${f1(B.pose.theta)}), status stays ${B.status}, live ${B.live}`);
  await new Promise((r) => setTimeout(r, B.tune.VIRTUAL_HOLD + 20));
  hold(B, portrait(125), 3, T0 + 200);
  check(near(B.pose.theta, 125, 0.5), `after touch stops, the sensor takes the pose back (θ ${f1(B.pose.theta)})`);
}

/* ================= 14. the overhead cast ================= */
section("14. A simulated overhead cast at 60 Hz: upright → tip back to 130° → whip forward (900 deg/s peak) → release at 11 o'clock");
{
  const tRel = castTimeAt(60);
  console.log(`  release at t = ${f1(tRel * 1000)} ms, true θ 60.0°, true ω ${f1(castTheta(tRel).w)} deg/s (thumb lifts; its timestamp is the release time)`);
  console.log("  variant                                   at(release)   error   peak minω   yaw");
  const variants = [
    ["clean", {}],
    ["noise ±0.2° / ±3 deg/s, jittered stamps", { noise: 0.4, jitter: 0.002 }],
    ["leaning 20° clockwise, noisy", { roll: 20, noise: 0.4, jitter: 0.002 }],
    ["OS orientation 25 ms late, noisy", { lagO: 0.025, noise: 0.4, jitter: 0.002 }],
    ["turned 30° right, noisy", { turn: 30, noise: 0.4, jitter: 0.002 }],
  ];
  for (const [name, o] of variants) {
    for (const skew of [0, 15]) {
      const M = await fresh();
      // the touch handler runs before the motion events that describe its moment: history ends ≥ skew ms before release
      const Rf = (s) => portrait(castTheta(s).th, { roll: o.roll || 0, turn: o.turn || 0 });
      play(M, Rf, 0, tRel - skew / 1000 - 1e-6, { ...o, rnd });
      const r = M.at(T0 + tRel * 1000), pk = M.peak(T0 + tRel * 1000 - 450, T0 + tRel * 1000), err = r.theta - 60;
      console.log("  " + (name + (skew ? ", touch 15 ms ahead" : "")).padEnd(42) + f2(r.theta).padStart(10) + f2(err).padStart(8) + f1(pk.minOmega).padStart(11) + f1(r.yaw).padStart(7));
      check(Math.abs(err) < 3 && pk.minOmega < -780 && near(r.yaw, 0, 2), `cast (${name}${skew ? ", 15 ms skew" : ""}): at(release) θ ${f2(r.theta)}, error ${f2(err)}° (< 3°), peak ω ${f1(pk.minOmega)}`);
    }
  }
}

/* ================= 15. permission and status ================= */
section("15. request() and status");
{
  // one all-null event and then nothing (desktop, or sensors blocked): "no-data" after 1200 ms
  const w = makeWindow();
  const M = await fresh(w);
  check(M.available && !M.needsPermission && M.status === "idle", `plain browser: available ${M.available}, needsPermission ${M.needsPermission}, status ${M.status}`);
  const t0 = Date.now();
  const p = M.request();
  w.fire("devicemotion", { timeStamp: 5, acceleration: { x: null, y: null, z: null }, accelerationIncludingGravity: { x: null, y: null, z: null }, rotationRate: { alpha: null, beta: null, gamma: null }, interval: 16 });
  w.fire("deviceorientation", { timeStamp: 6, alpha: null, beta: null, gamma: null, absolute: false });
  const st = await p;
  check(st === "no-data" && M.status === "no-data" && !M.live && Date.now() - t0 >= 1150, `one all-null event then nothing: ${st} after ${Date.now() - t0} ms, live ${M.live}`);
  check(w.count("devicemotion") === 1 && w.count("deviceorientation") === 1, "listeners attached once and kept");
  // data that comes later still flips it to granted
  w.fire("devicemotion", { timeStamp: 2000, accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 }, rotationRate: { alpha: 0, beta: 0, gamma: 0 } });
  check(M.status === "granted" && M.live, `late real data: status ${M.status}`);
}
{
  // iOS-style: both requestPermission calls start synchronously inside the tap
  const calls = [];
  const w = makeWindow({ perm: { motion: () => { calls.push("motion"); return Promise.resolve("granted"); }, orient: () => { calls.push("orient"); return Promise.resolve("granted"); } } });
  const M = await fresh(w);
  const p = M.request();
  const sync = calls.join(",");
  setTimeout(() => {
    w.fire("deviceorientation", { timeStamp: 100, alpha: 10, beta: 80, gamma: 2 });
    w.fire("devicemotion", { timeStamp: 101, accelerationIncludingGravity: { x: 0, y: -9.7, z: -1.7 }, rotationRate: { alpha: 1, beta: 0, gamma: 0 } });
  }, 60);
  const t0 = Date.now(), st = await p;
  check(M.needsPermission && sync === "motion,orient" && st === "granted" && Date.now() - t0 < 600, `needsPermission ${M.needsPermission}; both asked before request() returned (${sync}); ${st} as soon as data came (${Date.now() - t0} ms)`);
  check(near(M.pose.theta, 80, 0.5), `real-shaped events through the listeners reach the pose: θ ${f1(M.pose.theta)}`);
}
{
  let asked = 0;
  const w = makeWindow({ perm: { motion: () => { asked++; return Promise.resolve("denied"); }, orient: () => Promise.resolve("denied") } });
  const M = await fresh(w);
  const a = await M.request(), b = await M.request();
  check(a === "denied" && b === "denied" && asked === 1 && w.count("devicemotion") === 0, `denied: ${a}, then ${b} without asking again (asked ${asked}×), no listeners`);
}
{
  const w = makeWindow({ perm: { motion: () => Promise.reject(new (class NotAllowedError extends Error { name = "NotAllowedError"; })()), orient: () => Promise.resolve("granted") } });
  const M = await fresh(w);
  const st = await M.request();
  check(st === "idle", `NotAllowedError (not inside a tap): ${st}, so the next tap can ask again`);
}
{
  const M = await fresh(makeWindow({ api: false }));
  const st = await M.request();
  check(!M.available && st === "unsupported", `no DeviceOrientationEvent: available ${M.available}, ${st}`);
  const I = await fresh(makeWindow({ secure: false }));
  check(!I.available && I.status === "unsupported", `insecure context (http on a LAN IP): available ${I.available}`);
}

/* ================= 16. odds and ends ================= */
section("16. Clamps, timestamps, mode switch, gravity sign, gyro self-check");
{
  const M = await fresh();
  hold(M, portrait(90), 2);
  M.inject({ t: T0 + 40, ...euler(portrait(90)), rotationRate: { alpha: -2600, beta: 0, gamma: 0 } });
  check(M.pose.omega === -2000, `gyro above the clip level: ω ${M.pose.omega} (clamped, read as the most there is)`);
  const S = await fresh();
  hold(S, portrait(90), 2);
  for (let i = 0; i < 3; i++) S.inject({ t: T0 + 100, ...euler(portrait(90)), rotationRate: { alpha: 300, beta: 0, gamma: 0 } });
  S.inject({ t: 1.7e12, ...euler(portrait(90)), rotationRate: { alpha: 0, beta: 0, gamma: 0 } });
  check(Number.isFinite(S.pose.theta) && Number.isFinite(S.pose.omega) && Number.isFinite(S.pose.yaw), `bursts with equal timestamps and an epoch timestamp: θ ${f1(S.pose.theta)}, ω ${f1(S.pose.omega)} (finite)`);
  // mode switch recomputes θ right away (main.js reads the pose in the same frame)
  const D = await fresh();
  hold(D, landscape(110, 1), 3);
  const before = D.pose.theta;
  D.mode = "landscape";
  check(near(D.pose.theta, 110, 0.05), `mode portrait → landscape recomputes θ at once: ${f1(before)} → ${f1(D.pose.theta)}`);
  // no orientation events at all, accelerometer only (iOS without a gyro, sign −1): the sign is guessed from an upright hold
  const A = await fresh();
  for (let i = 0; i < 30; i++) A.inject({ t: T0 + i * 16.7, acc: { x: 0, y: -9.81 * Math.sin(100 * D2R), z: -9.81 * Math.cos(100 * D2R) } });
  check(near(A.pose.theta, 100, 1), `accelerometer only, iOS sign: θ ${f1(A.pose.theta)} (want 100)`);
  // gyro self-check: a phone whose rotationRate has the opposite sign, and one that reports rad/s
  for (const [name, k, wantSign, wantScale] of [["reversed sign", -1, -1, 1], ["rad/s units", D2R, 1, R2D]]) {
    const G = await fresh();
    const Rf = (s) => portrait(90 + 40 * Math.sin(2 * Math.PI * s));
    let k2 = 0;
    for (let ts = 0; ts <= 1.5; ts = ++k2 / 60) {
      const w = rate(Rf, ts);
      G.inject({ t: T0 + ts * 1000, ...euler(Rf(ts)), rotationRate: { alpha: w.alpha * k, beta: w.beta * k, gamma: w.gamma * k } });
    }
    const truth = 40 * 2 * Math.PI * Math.cos(2 * Math.PI * 1.5) * R2D * D2R;
    check(G.gyroSign === wantSign && near(G.gyroScale, wantScale, 1e-9) && near(G.pose.omega, truth, 3), `gyro self-check, ${name}: sign ${G.gyroSign}, scale ${f2(G.gyroScale)}, ω after 1.5 s ${f1(G.pose.omega)} (true ${f1(truth)})`);
  }
  const N = await fresh();
  const Rf = (s) => portrait(90 + 40 * Math.sin(2 * Math.PI * s));
  play(N, Rf, 0, 1.5);
  check(N.gyroSign === 1 && N.gyroScale === 1, `a normal phone keeps sign ${N.gyroSign}, scale ${N.gyroScale}`);
}

console.log(`\n${passes} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
