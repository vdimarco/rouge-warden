// Checks the cast physics in cast.js with no browser: node qa/fish/cast.sim.mjs
// Prints a table of where casts land, then checks the reference numbers in the spec. Exit code 1 on failure.
// Section 8 steps a motion release from 200 ms early to 200 ms late through the game's own grading (liftError and
// gradeRelease, as main.js calls them), and section 9 measures easy mode for a cautious player.
import { CAST, RELEASE, castParams, Flight, castLanding, strokeFactor, clockOf, gradeRelease, liftError } from "../../public/fish/js/cast.js";
import { ROD, setPlace } from "../../public/fish/js/lake.js";
import { PLACE_IDS } from "../../public/fish/js/places.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const near = (v, want, tol = 0.15) => Math.abs(v - want) <= want * tol;
const D2R = Math.PI / 180;
// the unbent rod tip for a rod angle and heading (spec §2)
function tipAt(theta, yaw = 0) {
  const t = theta * D2R, y = yaw * D2R;
  return { x: ROD.base.x + ROD.length * Math.sin(y) * Math.cos(t), y: ROD.base.y + ROD.length * Math.sin(t), z: ROD.base.z - ROD.length * Math.cos(y) * Math.cos(t) };
}
function cast(theta, omega, { back = theta + 60, yaw = 0, assist = true, featherAt = Infinity } = {}) {
  const p = castParams({ thetaRelease: theta, omegaPeak: omega, thetaBack: back, yaw, assist });
  const r = castLanding(tipAt(theta, yaw), p, featherAt);
  return { p, r };
}

// 1. the table
const speeds = [150, 300, 500, 750, 1000, 1500];
console.log(`\nWhere the lure lands: distance from the angler (m) / flight time (s) / verdict. Full back cast, yaw 0, easy mode (assist) on, V_MAX ${CAST.V_MAX} m/s, V_K ${CAST.V_K_EASY} °/s (${CAST.V_K} with easy mode off).`);
console.log("θ rel  clock        " + speeds.map((s) => (s + " °/s").padEnd(22)).join(""));
for (let th = 20; th <= 140; th += 10) {
  let row = String(th).padStart(4) + "   " + clockOf(th).padEnd(12) + " ";
  for (const w of speeds) {
    const { p, r } = cast(th, w);
    const d = Math.hypot(r.x, r.z) * (r.z > 0 ? -1 : 1);
    row += `${d.toFixed(1).padStart(6)} ${r.time.toFixed(2).padStart(5)} ${p.verdict.padEnd(9)}`;
  }
  console.log(row);
}
console.log("(negative distance = behind the angler)");

// 2. the reference numbers from the spec, straight from the flight physics
console.log("\nReference flights");
{
  const f = castLanding({ x: 0, y: 3.4, z: 0 }, { v0: 26, pitch: 35, yaw: 0 });
  console.log(`  26 m/s at 35° from 3.4 m: ${f.dist.toFixed(1)} m in ${f.time.toFixed(2)} s, apex ${f.apex.toFixed(1)} m, line out ${f.lineOut.toFixed(1)} m`);
  check(near(f.dist, 42), `26 m/s lands about 42 m out (${f.dist.toFixed(1)})`);
  check(near(f.time, 3), `26 m/s flies about 3 s (${f.time.toFixed(2)})`);
  const g = castLanding({ x: 0, y: 3.4, z: 0 }, { v0: 14, pitch: 35, yaw: 0 });
  console.log(`  14 m/s at 35° from 3.4 m: ${g.dist.toFixed(1)} m in ${g.time.toFixed(2)} s`);
  check(near(g.dist, 18), `14 m/s lands about 18 m out (${g.dist.toFixed(1)})`);
}

// 3. the launch rules
console.log("\nLaunch rules");
{
  const p = castParams({ thetaRelease: 60, omegaPeak: 800, thetaBack: 150, assist: false });
  check(Math.abs(p.pitch - 30) < 1e-9, `11 o'clock release without assist gives pitch 30 (${p.pitch})`);
  check(p.clock === "11 o'clock", `θ 60 is "${p.clock}"`);
  check(clockOf(120) === "1 o'clock", `θ 120 is "${clockOf(120)}"`);
  const a = castParams({ thetaRelease: 60, omegaPeak: 800, thetaBack: 150 });
  check(Math.abs(a.pitch - (30 + CAST.ASSIST_PULL * 8)) < 1e-9, `easy mode pulls 30° toward 38° by ${CAST.ASSIST_PULL * 100}% (${a.pitch.toFixed(2)})`);
  const v = castParams({ thetaRelease: 68, omegaPeak: 550, thetaBack: 150, assist: false });
  check(near(v.v0, 33 * (1 - Math.exp(-1)), 0.001), `v0 at ω = V_K is 63% of V_MAX (${v.v0.toFixed(2)})`);
  const ve = castParams({ thetaRelease: 68, omegaPeak: CAST.V_K_EASY, thetaBack: 150 });
  check(near(ve.v0, 33 * (1 - Math.exp(-1)), 0.001), `in easy mode v0 at ω = V_K_EASY (${CAST.V_K_EASY}) is 63% of V_MAX (${ve.v0.toFixed(2)})`);
  // the pull fades out at both ends of its range: no step anywhere in the pitch (a step stays the same size however fine
  // the scan; a slope shrinks with it)
  let jump = 0;
  for (let th = -40; th < 160; th += 0.02) jump = Math.max(jump, Math.abs(castParams({ thetaRelease: th + 0.02, omegaPeak: 800, thetaBack: 200 }).pitch - castParams({ thetaRelease: th, omegaPeak: 800, thetaBack: 200 }).pitch));
  check(jump < 0.25, `easy mode has no step in the launch pitch from θ −40° to 160° (largest change ${jump.toFixed(3)}° per 0.02°)`);
  const sl = castParams({ thetaRelease: 25, omegaPeak: 600, thetaBack: 150 }), hs = castParams({ thetaRelease: 25, omegaPeak: 600, thetaBack: 150, assist: false });
  check(hs.verdict === "slam" && sl.verdict !== "slam" && sl.pitch > 0, `easy mode softens a slightly late slam: θ 25° gives ${sl.verdict} at ${sl.pitch.toFixed(1)}° (easy off: ${hs.verdict})`);
  const nb = castParams({ thetaRelease: 66, omegaPeak: 900, thetaBack: 88 }), fb = castParams({ thetaRelease: 66, omegaPeak: 900, thetaBack: 130 });
  check(nb.verdict === "short" && nb.stroke < CAST.SHORT_STROKE && fb.verdict === "sweet" && fb.stroke === 1, `no back cast is "short" (stroke ${nb.stroke.toFixed(2)}), a full one is sweet (${fb.stroke})`);
  check(Math.abs(strokeFactor(130, 80) - 1) < 1e-9 && Math.abs(strokeFactor(100, 80) - 0.6) < 1e-9, "a 50° back cast gives full power, 20° gives 60%");
  const short = castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 88 }), long = castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 140 });
  check(short.v0 < long.v0 * 0.65, `a short back cast is weaker (${short.v0.toFixed(1)} vs ${long.v0.toFixed(1)} m/s)`);
  check(castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 150 }).verdict === "sweet", "a release at 68° with a good stroke is sweet");
  check(castParams({ thetaRelease: 100, omegaPeak: 900, thetaBack: 160 }).verdict === "high", "an early release is high");
  check(castParams({ thetaRelease: 40, omegaPeak: 900, thetaBack: 150 }).verdict === "low", "a late release is low");
  check(castParams({ thetaRelease: 68, omegaPeak: 150, thetaBack: 150 }).verdict === "weak", "a slow stroke is weak");
  check(castParams({ thetaRelease: 20, omegaPeak: 900, thetaBack: 150 }).verdict === "slam", "a very late release slams");
  check(castParams({ thetaRelease: 130, omegaPeak: 900, thetaBack: 170 }).verdict === "high", "an overhead release stays forward and grades high");
  check(castParams({ thetaRelease: 68, omegaPeak: -900, thetaBack: 150 }).v0 > 20, "a negative (motion.js style) forward speed works too");
}

// 4. how casts land
console.log("\nLandings");
{
  const s = cast(68, 1000);
  check(s.r.land === "water" && s.r.dist > 35 && s.r.dist < 55, `a sweet 1000 °/s cast lands in the water 35..55 m out (${s.r.dist.toFixed(1)} m, ${s.r.land})`);
  const d750 = cast(68, 750).r.dist, d1500 = cast(68, 1500).r.dist;
  check(d1500 / d750 < 1.35, `a violent throw gains little: 1500 °/s goes ${d1500.toFixed(1)} m vs ${d750.toFixed(1)} m at 750 °/s`);
  // feathering: a finger on the line from 0.8 s drops the lure short
  const free = cast(68, 900), fe = cast(68, 900, { featherAt: 0.8 });
  console.log(`  feather from 0.8 s: ${fe.r.dist.toFixed(1)} m vs ${free.r.dist.toFixed(1)} m free (${fe.r.time.toFixed(2)} s vs ${free.r.time.toFixed(2)} s)`);
  check(fe.r.done && fe.r.dist < free.r.dist * 0.75, "feathering stops the lure short");
  const late = cast(68, 900, { featherAt: 2.0 });
  check(late.r.dist < free.r.dist && late.r.dist > fe.r.dist, `feathering late stops it less short (${late.r.dist.toFixed(1)} m)`);
  // Overhead releases retain positive forward velocity.
  for (const [th, w] of [[125, 300], [130, 700], [140, 1000], [150, 1500]]) {
    const b = cast(th, w, { back: th + 30 });
    check(b.p.verdict === "high" && b.p.pitch <= CAST.MAX_PITCH && new Flight(tipAt(th), b.p).v.z < 0 && b.r.done, `release at ${th}°, ${w} °/s stays forward: lands at z ${b.r.z.toFixed(1)} on the ${b.r.land}`);
  }
  // slams land close (with easy mode off: easy mode softens the mild ones, section 3)
  for (const [th, w] of [[25, 600], [20, 1000], [10, 1500]]) {
    const b = cast(th, w, { assist: false });
    check(b.p.verdict === "slam" && b.r.dist < 12 && b.r.z < 0, `release at ${th}°, ${w} °/s slams in close: ${b.r.dist.toFixed(1)} m (${b.r.land})`);
  }
  // the heading sets the direction
  const y = cast(68, 700, { yaw: 25 });
  const ang = Math.atan2(y.r.x - 0.28, -y.r.z) / D2R;
  check(Math.abs(ang - 25) < 3, `a cast at yaw 25° lands along 25° (${ang.toFixed(1)}°)`);
  // a long cast to the right runs into the rocky point and its pines
  const r = cast(68, 1500, { yaw: 60 });
  check(r.r.land === "land" || r.r.land === "tree", `a long cast at yaw 60° hits the point (${r.r.land} at ${r.r.dist.toFixed(1)} m)`);
}

// 5. the line and the spool during a flight
console.log("\nLine and spool");
{
  const tip = tipAt(68), f = new Flight(tip, castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 150 }));
  let maxSpool = 0, first = 0, ok = true, last = 0;
  for (let i = 0; i < 600; i++) {
    const r = f.step(1 / 60, false);
    if (i === 2) first = r.spool;
    if (!r.done) maxSpool = Math.max(maxSpool, r.spool);
    const straight = Math.hypot(r.x - tip.x, r.y - tip.y, r.z - tip.z);
    if (r.lineOut + 1e-6 < straight || r.lineOut + 1e-9 < last) ok = false;
    last = r.lineOut;
    if (r.done) break;
  }
  const endR = f.step(1 / 60);
  check(ok, "line out never shrinks and is never shorter than the straight line");
  check(maxSpool > 15 && endR.spool === 0, `the spool whirrs (${maxSpool.toFixed(1)} m/s peak, ${first.toFixed(1)} m/s at the start) and then stops`);
  check(endR.lineOut > endR.lineOut / 1.1 && endR.lineOut < Math.hypot(endR.x - tip.x, endR.y - tip.y, endR.z - tip.z) * 1.08 + 0.5, `line out is the distance plus a little sag (${endR.lineOut.toFixed(1)} m)`);
}

// 6. bad input never breaks it
console.log("\nRobustness");
{
  const p = castParams({ thetaRelease: NaN, omegaPeak: undefined, thetaBack: NaN, yaw: NaN });
  check(Object.values(p).every((v) => typeof v === "string" || Number.isFinite(v)), "castParams with NaN input gives finite numbers");
  const f = new Flight({ x: NaN, y: undefined, z: 0 }, { v0: NaN, pitch: NaN, yaw: NaN });
  const r1 = f.step(NaN), r2 = f.step(5), r3 = f.step(-1);
  check([r1, r2, r3].every((r) => Number.isFinite(r.x + r.y + r.z + r.lineOut + r.spool)), "Flight.step with NaN, huge or negative dt stays finite");
  let n = 0, r;
  do { r = f.step(1); n++; } while (!r.done && n < 100);
  check(r.done, `a flight always ends (${n} big steps, ${r.land})`);
}

// 7. every place: the same landings from its own stand (lake.js follows setPlace, and so does tipAt through ROD)
console.log("\nPlaces");
for (const id of PLACE_IDS) {
  const P = setPlace(id);
  const s = cast(68, 1000);
  check(s.r.land === "water" && s.r.dist > 35 && s.r.dist < 62, `${P.name}: a sweet 1000 °/s cast lands in the water 35..62 m out (${s.r.dist.toFixed(1)} m, ${s.r.land})`);
  // along a river bank or a breakwater there is water to both sides
  if (id === "river" || id === "sea") for (const yaw of [-60, 60]) {
    const y = cast(68, 1000, { yaw });
    check(y.r.land === "water", `${P.name}: a sweet cast at yaw ${yaw}° lands in the water (${y.r.dist.toFixed(1)} m, ${y.r.land})`);
  }
  for (const [th, w] of [[125, 300], [130, 700], [140, 1000], [150, 1500]]) {
    const b = cast(th, w, { back: th + 30 });
    check(b.r.z < 0 && b.r.land === "water", `${P.name}: an early release at ${th}°, ${w} °/s lands forward on the ${b.r.land === "dock" ? "stand" : b.r.land} (z ${b.r.z.toFixed(1)})`);
  }
  for (const [th, w] of [[25, 600], [20, 1000], [10, 1500]]) {
    const b = cast(th, w, { assist: false });
    check(b.r.land === "water" && b.r.dist < 12 && b.r.z < 0, `${P.name}: a very late release at ${th}°, ${w} °/s lands in the water close in (${b.r.dist.toFixed(1)} m)`);
  }
}
setPlace("loon");

// 8. the motion release window: a cosine stroke from 130° to 20° with peak speed w, and a thumb that lifts err ms after
// the rod crosses 11 o'clock (IDEAL_RELEASE). Graded the way main.js does: a lift before the crossing reads the swing up
// to RELEASE.WAIT_MS after it; the speed is the fastest forward swing up to the launch
function stroke(w) {
  const T = ((110 * Math.PI) / (2 * w)) * 1000, k = (t) => Math.min(1, Math.max(0, t / T));
  const at = (t) => 130 - 110 * (0.5 - 0.5 * Math.cos(Math.PI * k(t)));
  return { T, at, speed: (t) => (t <= 0 || t >= T ? 0 : w * Math.sin(Math.PI * k(t))), tc: 0.5405 * T };
}
const fastest = (S, t0, t1) => { let f = 0; for (let q = t0; q <= t1; q += 2) f = Math.max(f, S.speed(q)); return f; };
function motionLift(w, err, assist = true) {
  const S = stroke(w), t = S.tc + err;
  const tEnd = S.at(t) >= CAST.IDEAL_RELEASE ? Math.min(t + RELEASE.WAIT_MS, Math.max(t, S.tc + 1)) : t;
  const fwd = fastest(S, t - RELEASE.LOOK_MS, tEnd);
  if (fwd < 150 || 130 - S.at(tEnd) < 8) return null;   // no swing yet: main.js starts again
  const g = gradeRelease({ errMs: liftError(S.at, t, fwd, tEnd) });
  const p = castParams({ thetaRelease: g.thetaRelease, omegaPeak: fwd, thetaBack: 130, assist: assist && g.assist });
  return { p, r: castLanding(tipAt(Math.min(85, S.at(tEnd))), p) };
}
// the thumb never lifted: main.js casts 120 ms after the swing slowed under 250 °/s
function motionHeld(w, assist = true) {
  const S = stroke(w);
  let slow = 0;
  for (let q = 0; q <= S.T; q++) if (S.speed(q) > 250) slow = q;
  const t = slow + 120, g = gradeRelease({ held: true });
  const p = castParams({ thetaRelease: g.thetaRelease, omegaPeak: fastest(S, t - RELEASE.LOOK_MS, t), thetaBack: 130, assist: assist && g.assist });
  return { p, r: castLanding(tipAt(Math.min(85, S.at(t))), p), err: t - S.tc };
}
console.log("\nRelease window: m (S sweet, H high, L low, X slam, W weak, F short) for a lift err ms after 11 o'clock; --- no cast yet");
const errs = [];
for (let e = -200; e <= 200; e += 10) errs.push(e);
console.log("          °/s " + errs.filter((e) => e % 40 === 0).map((e) => String(e).padStart(5)).join("") + "   (every 40 ms shown, every 10 ms checked)");
for (const assist of [true, false]) for (const w of [450, 600, 1000]) {
  let prev = null, worst = 0, row = "";
  for (const e of errs) {
    const c = motionLift(w, e, assist);
    if (e % 40 === 0) row += c ? ({ sweet: "S", high: "H", low: "L", slam: "X", weak: "W", short: "F" }[c.p.verdict] + c.r.dist.toFixed(0)).padStart(5) : "  ---";
    if (c && prev) worst = Math.max(worst, Math.abs(c.r.dist - prev.r.dist));
    prev = c;
  }
  const late = motionLift(w, 170, assist), held = motionHeld(w, assist);
  console.log(`  ${assist ? "easy" : "hard"} ${String(w).padStart(5)} ${row}`);
  check(worst <= 10, `${assist ? "easy" : "hard"} mode, ${w} °/s: lifts 10 ms apart land at most 10 m apart (largest ${worst.toFixed(1)} m)`);
  check(held.r.dist < late.r.dist, `${assist ? "easy" : "hard"} mode, ${w} °/s: a thumb held through the swing (${held.r.dist.toFixed(1)} m, cast ${held.err.toFixed(0)} ms after 11 o'clock) casts shorter than a lift 170 ms late (${late.r.dist.toFixed(1)} m)`);
}
{
  const s = motionLift(600, 0), e90 = motionLift(600, -90), l90 = motionLift(600, 90), early = motionLift(600, -150);
  check(s.p.verdict === "sweet" && e90.p.verdict === "sweet" && l90.p.verdict === "sweet" && early.p.verdict === "high", `at 600 °/s the sweet window spans −90..+90 ms (${e90.p.verdict}, ${s.p.verdict}, ${l90.p.verdict}); 150 ms early is ${early.p.verdict}`);
}

// 9. easy mode for a cautious player: swings of about 300 °/s (lognormal, σ 0.35), lifts 30 ± 110 ms late
{
  let seed = 5;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const run = (assist) => {
    seed = 5;
    let n = 0, far = 0;
    for (let i = 0; i < 3000; i++) {
      const w = 300 * Math.exp(0.35 * gauss()), e = 30 + 110 * gauss(), c = motionLift(w, e, assist);
      if (!c) continue;
      n++;
      if (c.r.land === "water" && c.r.dist >= 15) far++;
    }
    return far / n;
  };
  const easy = run(true), hard = run(false);
  console.log(`\nA cautious player (300 °/s): ${(easy * 100).toFixed(0)}% of casts land 15 m or more out in easy mode, ${(hard * 100).toFixed(0)}% with it off`);
  check(easy >= 0.65 && easy > hard, `easy mode lands 65% or more of a cautious player's casts 15 m or more out (${(easy * 100).toFixed(0)}%)`);
}

console.log(fails.length ? `\n${fails.length} check(s) failed` : "\nAll cast checks passed");
process.exit(fails.length ? 1 : 0);
