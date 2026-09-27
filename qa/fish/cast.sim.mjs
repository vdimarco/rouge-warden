// Checks the cast physics in cast.js with no browser: node qa/fish/cast.sim.mjs
// Prints a table of where casts land, then checks the reference numbers in the spec. Exit code 1 on failure.
import { CAST, castParams, Flight, castLanding, strokeFactor, clockOf } from "../../public/fish/js/cast.js";
import { ROD } from "../../public/fish/js/lake.js";

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
console.log("\nWhere the lure lands: distance from the angler (m) / flight time (s) / verdict. Full back cast, yaw 0, assist on.");
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
  check(Math.abs(a.pitch - (30 + 0.35 * 8)) < 1e-9, `assist pulls 30° toward 38° by 35% (${a.pitch.toFixed(2)})`);
  const v = castParams({ thetaRelease: 68, omegaPeak: 550, thetaBack: 150 });
  check(near(v.v0, 33 * (1 - Math.exp(-1)), 0.001), `v0 at ω = V_K is 63% of V_MAX (${v.v0.toFixed(2)})`);
  check(Math.abs(strokeFactor(130, 80) - 1) < 1e-9 && Math.abs(strokeFactor(100, 80) - 0.6) < 1e-9, "a 50° back cast gives full power, 20° gives 60%");
  const short = castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 88 }), long = castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 140 });
  check(short.v0 < long.v0 * 0.65, `a short back cast is weaker (${short.v0.toFixed(1)} vs ${long.v0.toFixed(1)} m/s)`);
  check(castParams({ thetaRelease: 68, omegaPeak: 900, thetaBack: 150 }).verdict === "sweet", "a release at 68° with a good stroke is sweet");
  check(castParams({ thetaRelease: 100, omegaPeak: 900, thetaBack: 160 }).verdict === "high", "an early release is high");
  check(castParams({ thetaRelease: 40, omegaPeak: 900, thetaBack: 150 }).verdict === "low", "a late release is low");
  check(castParams({ thetaRelease: 68, omegaPeak: 150, thetaBack: 150 }).verdict === "weak", "a slow stroke is weak");
  check(castParams({ thetaRelease: 20, omegaPeak: 900, thetaBack: 150 }).verdict === "slam", "a very late release slams");
  check(castParams({ thetaRelease: 130, omegaPeak: 900, thetaBack: 170 }).verdict === "behind", "a release past 120° goes behind");
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
  // backward casts land behind you
  for (const [th, w] of [[125, 300], [130, 700], [140, 1000], [150, 1500]]) {
    const b = cast(th, w, { back: th + 30 });
    check(b.p.verdict === "behind" && b.r.z > 0 && b.r.done, `release at ${th}°, ${w} °/s goes behind: lands at z ${b.r.z.toFixed(1)} on the ${b.r.land}`);
  }
  // slams land close
  for (const [th, w] of [[25, 600], [20, 1000], [10, 1500]]) {
    const b = cast(th, w);
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
    if (r.done) { check(r.spool === 0 || i === 0, "the spool stops when the lure lands"); break; }
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

console.log(fails.length ? `\n${fails.length} check(s) failed` : "\nAll cast checks passed");
process.exit(fails.length ? 1 : 0);
