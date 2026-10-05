// Checks how a release is graded, with no browser: node qa/fish/release.test.mjs
// The pure helpers in cast.js that main.js calls (touchTheta, touchSpan, touchDy, gradeRelease, liftError), and touch
// flicks played through motion.js's virtual samples the way main.js feeds them: a sample for each pointer move and each
// frame, and one at the lift. Exit code 1 on failure.
import { CAST, RELEASE, TOUCH, castParams, castLanding, gradeRelease, liftError, touchTheta, touchSpan, touchSpanAt, touchDy } from "../../public/fish/js/cast.js";
import { rodTip } from "../../public/fish/js/fish.js";
import { setPlace, currentPlace } from "../../public/fish/js/lake.js";

globalThis.window = globalThis;
const { Motion } = await import("../../public/fish/js/motion.js");
setPlace("loon");

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const section = (s) => console.log("\n" + s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

section("1. The touch mapping: the rod follows the finger below the press point, and moves at 0.4 of it above");
{
  check(touchSpan(844) === 240 && touchSpan(640) === 192 && touchSpan(390) === 160 && touchSpan(2000) === 240, `touchSpan: 844 → ${touchSpan(844)}, 640 → ${touchSpan(640)}, 390 → ${touchSpan(390)}, 2000 → ${touchSpan(2000)}`);
  check(touchTheta(0, 240) === TOUCH.REST && near(touchTheta(80, 240), 130, 1e-9) && near(touchTheta(-100, 240), 80 - 0.4 * 100 / 240 * 150, 1e-9), `θ at the press point ${touchTheta(0, 240)}, 80 px below ${touchTheta(80, 240)}, 100 px above ${touchTheta(-100, 240).toFixed(1)}`);
  check(touchTheta(-1e4, 240) === 5 && touchTheta(1e4, 240) === 170 && touchTheta(NaN, 240) === TOUCH.REST, "clamped to 5..170, NaN stays at rest");
  // above the press point the screen does not matter: a flick carries on as far on a phone on its side
  check([-20, -100, -180].every((dy) => touchTheta(dy, 160) === touchTheta(dy, 240) && touchTheta(dy, 192) === touchTheta(dy, 240)) && touchTheta(40, 160) > touchTheta(40, 240),
    `above the press point every span turns the rod the same (100 px above: ${touchTheta(-100, 160).toFixed(1)} at 160, ${touchTheta(-100, 240).toFixed(1)} at 240); below it a short span turns it faster`);
  let worst = 0;
  for (const h of [160, 192, 240]) for (let dy = -300; dy <= 140; dy += 7) { const th = touchTheta(dy, h); if (th > 5 && th < 170) worst = Math.max(worst, Math.abs(touchDy(th, h) - dy)); }
  check(worst < 1e-9, `touchDy undoes touchTheta (the touch rail draws its marks with it): worst ${worst.toExponential(1)} px`);
  check(near(touchDy(CAST.LOAD_THETA, 240), 32, 1e-9), `LOAD is ${touchDy(CAST.LOAD_THETA, 240)} px below the press point at 390x844`);
  // a press low on the screen: the drag shrinks so the finger can still pass full power before the bottom edge
  const full = CAST.IDEAL_RELEASE + CAST.BACK_FULL;
  check(touchSpanAt(844, 400) === 240 && touchSpanAt(844, 700) === 240 && touchSpanAt(390, 200) === 160, `touchSpanAt keeps touchSpan with room below: ${touchSpanAt(844, 400)}, ${touchSpanAt(844, 700)}, ${touchSpanAt(390, 200)}`);
  const low = [[844, 780], [844, 810], [844, 825], [640, 600], [390, 360], [390, 370]].map(([H, y]) => ({ H, y, h: touchSpanAt(H, y) }));
  check(low.every(({ H, y, h }) => h < touchSpan(H) && h >= TOUCH.SPAN_EDGE && y + touchDy(full, h) <= H - TOUCH.EDGE),
    `a press low on the screen reaches full power on the screen: ${low.map(({ H, y, h }) => `${H}@${y}: span ${h.toFixed(0)}, full at ${(y + touchDy(full, h)).toFixed(0)}`).join("; ")}`);
  check(touchSpanAt(844, 844) === TOUCH.SPAN_EDGE && touchSpanAt(844, NaN) === 240, `touchSpanAt at the very edge is SPAN_EDGE (${touchSpanAt(844, 844)}), NaN keeps touchSpan`);
}

section("2. gradeRelease: the time of the lift sets the release angle; a held thumb is the low line drive");
{
  const rows = [-400, -200, -90, 0, 90, 200, 400, 900].map((e) => [e, gradeRelease({ errMs: e }).thetaRelease]);
  console.log("  errMs → θ release: " + rows.map(([e, t]) => e + " → " + t.toFixed(1)).join(", "));
  check(rows.every(([e, t]) => near(t, CAST.IDEAL_RELEASE - clamp(e, -RELEASE.MAX_MS, RELEASE.MAX_MS) * RELEASE.MS_DEG, 1e-9)), "θ = IDEAL − errMs × 0.22, clamped at ±400 ms");
  const v = (e) => castParams({ thetaRelease: gradeRelease({ errMs: e }).thetaRelease, omegaPeak: 700, thetaBack: 140 }).verdict;
  check(v(-90) === "sweet" && v(0) === "sweet" && v(90) === "sweet" && v(-130) === "high" && v(140) === "low", `±90 ms is sweet (${v(-90)}, ${v(0)}, ${v(90)}); −130 is ${v(-130)}, +140 is ${v(140)}`);
  const h = gradeRelease({ held: true });
  check(h.thetaRelease === RELEASE.HELD_THETA && h.assist === false, `held: θ ${h.thetaRelease}, no easy-mode pull`);
  const g = gradeRelease({ errMs: NaN });
  check(g.thetaRelease === CAST.IDEAL_RELEASE && g.assist === true, "a missing errMs grades as on time");
}

section("3. liftError: when the thumb lifted against the moment the rod crossed 11 o'clock");
{
  // a rod sweeping forward at 600 °/s from 130°, crossing 68° at t = 103.3 ms
  const w = 600, tc = ((130 - CAST.IDEAL_RELEASE) / w) * 1000, at = (t) => 130 - (w * Math.max(0, t)) / 1000;
  check(near(liftError(at, tc + 40, w), 40, 0.05), `a lift 40 ms after the crossing reads ${liftError(at, tc + 40, w).toFixed(2)} ms`);
  check(near(liftError(at, tc - 30, w, tc - 30 + RELEASE.WAIT_MS), -30, 0.05), `a lift 30 ms before it, with the samples after the lift, reads ${liftError(at, tc - 30, w, tc - 30 + RELEASE.WAIT_MS).toFixed(2)} ms`);
  check(near(liftError(at, tc - 30, w), -30, 0.05), `with no samples after the lift it is worked out from the speed: ${liftError(at, tc - 30, w).toFixed(2)} ms`);
  // a stroke that speeds up: the speed at the lift underestimates how soon it crosses; the wait reads the real crossing
  const acc = (t) => 130 - 0.006 * Math.max(0, t) * Math.max(0, t);   // crosses 68° at 101.7 ms
  const tca = Math.sqrt(62 / 0.006), t1 = tca - 60;
  check(near(liftError(acc, t1, 0.012 * t1 * 1000, t1 + RELEASE.WAIT_MS), -60, 0.1), `an accelerating swing, a lift 60 ms early: the wait reads ${liftError(acc, t1, 0.012 * t1 * 1000, t1 + RELEASE.WAIT_MS).toFixed(1)} ms`);
  // across the end of the wait the answer does not jump
  const e1 = liftError(acc, tca - RELEASE.WAIT_MS + 0.5, 1200, tca + 0.5), e2 = liftError(acc, tca - RELEASE.WAIT_MS - 0.5, 1200, tca - 0.5);
  check(Math.abs(e1 - e2) < 2, `no step where the crossing leaves the wait: ${e1.toFixed(1)} vs ${e2.toFixed(1)} ms`);
}

// A touch cast played through motion.js the way main.js feeds it: a virtual sample for each pointer move (every 8 ms during
// the flick, 12 ms during the drag down) and for each 60 Hz frame (the finger's last angle), then the lift. The release is
// graded at the finger: its angle, and the fastest forward swing in the last 450 ms. Times start at t0 (ms)
function touchCast({ t0, h, down = 80, pxs, lift, gap = 0, frame = 1000 / 60 }) {
  const ev = [];
  let y = 0;
  const move = (t, dy) => { y = dy; ev.push([t, dy]); };
  for (let i = 1; i <= 20; i++) move(t0 + i * 12, (down * i) / 20);
  const f0 = t0 + 20 * 12 + 200, dur = ((down - lift) / pxs) * 1000;
  for (let t = 0; t < dur; t += 8) move(f0 + t, down - (pxs * t) / 1000);
  move(f0 + dur, lift);
  const tLift = f0 + dur + gap;
  // frames: each pushes the finger's angle at that time (the last move before it)
  const moves = ev.slice(), fingerAt = (t) => { let d = 0; for (const [te, dy] of moves) if (te <= t) d = dy; return d; };
  for (let t = t0; t < tLift; t += frame) ev.push([t, fingerAt(t)]);
  ev.sort((a, b) => a[0] - b[0]);
  let back = TOUCH.REST;
  for (const [t, dy] of ev) { const th = touchTheta(dy, h); back = Math.max(back, th); Motion.virtual({ t, theta: th }); }
  const theta = touchTheta(lift, h);
  Motion.virtual({ t: tLift, theta });
  const s = Motion.at(tLift), pk = Motion.peak(tLift - RELEASE.LOOK_MS, tLift);
  const fwd = Math.max(0, -pk.minSwing, -s.omega);
  const p = castParams({ thetaRelease: theta, omegaPeak: fwd, thetaBack: Math.max(back, pk.maxTheta) });
  const r = castLanding(rodTip(clamp(theta, 0, 85), 0, 0, currentPlace().stand.rod), p);
  return { theta, at: s.theta, fwd, p, r, dist: Math.hypot(r.x, r.z) };
}
let clock = 10000;
const next = () => (clock += 5000);

section("4. The same flick, a different rest before the lift: the same cast");
{
  const out = [0, 40, 80, 120].map((gap) => ({ gap, ...touchCast({ t0: next(), h: 240, pxs: 1800, lift: -60, gap }) }));
  for (const o of out) console.log(`  gap ${String(o.gap).padStart(3)} ms: finger θ ${o.theta.toFixed(1)}, at() θ ${o.at.toFixed(1)}, swing ${o.fwd.toFixed(0)} °/s → ${o.p.verdict}, ${o.dist.toFixed(1)} m`);
  check(out.every((o) => o.p.verdict === out[0].p.verdict), `every gap gets the same verdict (${out.map((o) => o.p.verdict).join(", ")})`);
  check(out.every((o) => Math.abs(o.at - o.theta) <= 2), "the release angle stays within 2° of the angle at the finger");
  check(out.every((o) => Math.abs(o.dist - out[0].dist) < 1), `and the same distance (${out.map((o) => o.dist.toFixed(1)).join(", ")} m)`);
}

section("5. A natural flick that carries on past the press point still casts well");
for (const [h, size] of [[240, "390x844"], [192, "360x640"], [160, "844x390"]]) {
  const rows = [];
  for (const pxs of [1000, 1500, 2000]) for (const lift of [-10, -50, -90, -130]) rows.push({ pxs, lift, ...touchCast({ t0: next(), h, pxs, lift }) });
  console.log(`  ${size} (px/s / lift px: verdict, m, swing °/s): ` + rows.map((o) => `${o.pxs}/${o.lift}: ${o.p.verdict[0]}${o.dist.toFixed(0)} ${o.fwd.toFixed(0)}`).join("  "));
  const worst = rows.reduce((a, o) => (o.dist < a.dist || o.r.land !== "water" ? o : a), rows[0]);
  check(rows.every((o) => o.r.land === "water" && o.dist >= 25), `${size}: flicks of 1000 to 2000 px/s that lift 10 to 130 px above the press point land 25 m or more out (shortest ${worst.dist.toFixed(1)} m at ${worst.pxs} px/s, ${worst.lift} px)`);
  // past the range: a big flick carries on 110 ± 50 px, so the edge must lie well beyond 130 px on every screen
  const big = [-150, -170, -190].map((lift) => ({ lift, ...touchCast({ t0: next(), h, pxs: 1800, lift }) }));
  check(big.every((o) => o.r.land === "water" && o.dist >= 25), `${size}: a big 1800 px/s flick that lifts 150 to 190 px above still lands 25 m out (${big.map((o) => `${o.lift}: ${o.p.verdict} ${o.dist.toFixed(1)} m`).join(", ")})`);
  const soon = touchCast({ t0: next(), h, pxs: 1200, lift: 30 });
  check(soon.p.verdict === "high", `${size}: a lift 30 px below the press point grades ${soon.p.verdict} (θ ${soon.theta.toFixed(1)})`);
}

console.log(`\n${passes} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
