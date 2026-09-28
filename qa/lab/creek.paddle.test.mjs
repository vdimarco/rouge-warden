// Checks how Up the Creek reads the phone as a paddle, with no browser: node qa/lab/creek.paddle.test.mjs
// Made-up pose streams (the rod angle θ and its rate ω, the steering tilt, the twist) go into the reader in
// public/lab/creek/paddle.js, and it must find the strokes, J-strokes, back strokes and braces, and nothing in the
// shakes of a walk. A last section goes through the real public/fish/js/motion.js too. Exit code 1 on failure.
import { createPaddle, PT } from "../../public/lab/creek/paddle.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);

// A pose stream at 60 Hz from functions of time (seconds): theta(t) in degrees, roll(t) in -1..1, twist(t) in deg/s.
// ω is the slope of θ; spin is |ω| plus the twist and a little of the roll change.
function stream(secs, { theta = () => 80, roll = () => 0, twist = () => 0, t0 = 0 } = {}) {
  const out = [], dt = 1 / 60;
  let prevTh = theta(0), prevRoll = roll(0);
  for (let i = 1; i <= Math.round(secs * 60); i++) {
    const t = i * dt, th = theta(t), ro = roll(t), tw = twist(t);
    const om = (th - prevTh) / dt, rr = ((ro - prevRoll) * 35) / dt;
    out.push({ t: (t0 + t) * 1000, theta: th, omega: om, roll: ro, twist: tw, spin: Math.sqrt(om * om + tw * tw + rr * rr) });
    prevTh = th; prevRoll = ro;
  }
  return out;
}
function read(poses, pull = -1) {
  const acts = [];
  const p = createPaddle({ pull, onAction: (a) => acts.push(a) });
  for (const q of poses) p.feed(q);
  return { acts, p, of: (type) => acts.filter((a) => a.type === type) };
}
// one stroke: the top edge rocks away from you (θ falls) by `swing` degrees over `ms`, then back after a pause
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function strokeTheta(swing, ms, start = 0.1) {
  return (t) => {
    const a = (t - start) / (ms / 1000), b = (t - start - ms / 1000 - 0.25) / 0.5;
    return 85 - swing * smoothstep(a) + swing * smoothstep(b);
  };
}

section("Strokes");
{
  const r = read(stream(1.2, { theta: strokeTheta(45, 200), roll: () => 0.4 }));
  const s = r.of("stroke");
  check(s.length === 1 && s[0].side === 1, `a rock of the top edge, tipped to the right, is one stroke on the right (${s.length})`);
  check(s.length && s[0].power > 0.8 && s[0].power < 1.4, `a quick rock is a strong stroke (power ${s.length ? s[0].power.toFixed(2) : "-"})`);
  check(r.of("back").length === 0, "the swing back is not a back stroke");
  const l = read(stream(1.2, { theta: strokeTheta(45, 200), roll: () => -0.4 }));
  check(l.of("stroke").length === 1 && l.of("stroke")[0].side === -1, "tipped to the left, it is a stroke on the left");
  const slow = read(stream(1.5, { theta: strokeTheta(45, 350), roll: () => 0.4 }));
  check(slow.of("stroke").length === 1 && slow.of("stroke")[0].power < r.of("stroke")[0].power, "a slow rock is a weaker stroke");
  const twitch = read(stream(1, { theta: strokeTheta(9, 60), roll: () => 0.4 }));
  check(twitch.of("stroke").length === 0, "a twitch of 9° is not a stroke");
  const wrong = read(stream(1.2, { theta: strokeTheta(45, 200), roll: () => 0.4 }), +1);
  check(wrong.of("stroke").length === 1 && wrong.of("stroke")[0].side === 1, "with the other grip learned, the swing back is the stroke instead");
  const keep = read(stream(1.2, { theta: strokeTheta(45, 200), roll: (t) => (t < 0.05 ? -0.5 : 0.05) }));
  check(keep.of("stroke").length === 1 && keep.of("stroke")[0].side === -1, "a small tilt keeps the side you chose last");
}

section("J-strokes");
{
  const j = read(stream(1.2, { theta: strokeTheta(50, 260), roll: () => 0.4, twist: (t) => (t > 0.25 && t < 0.4 ? 280 : 0) }));
  check(j.of("j").length === 1 && j.of("j")[0].side === 1, "a twist late in the stroke is a J on the stroke's side");
  check(j.of("j").length === 1 && Math.abs(j.of("j")[0].power - 280 / PT.J_FULL) < 0.05, `the J's strength follows the twist (${j.of("j").length ? j.of("j")[0].power.toFixed(2) : "-"})`);
  const after = read(stream(1.2, { theta: strokeTheta(50, 260), roll: () => 0.4, twist: (t) => (t > 0.42 && t < 0.5 ? 260 : 0) }));
  check(after.of("j").length === 1, "a twist just after the stroke still counts");
  const none = read(stream(1.2, { theta: strokeTheta(50, 260), roll: () => 0.4, twist: (t) => (t > 0.12 && t < 0.16 ? 260 : 0) }));
  check(none.of("j").length === 0, "a twist at the very start of the stroke is not a J");
}

section("Back strokes and braces");
{
  // held still, then rocked toward you
  const back = read(stream(1.2, { theta: (t) => (t < 0.4 ? 60 : 60 + 40 * smoothstep((t - 0.4) / 0.2)), roll: () => -0.4 }));
  check(back.of("back").length === 1 && back.of("back")[0].side === -1 && back.of("stroke").length === 0, "from a still phone, a rock toward you is a back stroke");
  const brace = read(stream(1, { roll: (t) => (t < 0.5 ? 0.95 : 0.4) }));
  const on = brace.acts.find((a) => a.type === "brace" && a.on), off = brace.acts.find((a) => a.type === "brace" && !a.on);
  check(on && on.side === 1 && off, "tipped hard and held still is a brace on that side; tipping back ends it");
  const shaky = read(stream(1, { roll: (t) => 0.95 + 0.05 * Math.sin(t * 60), theta: (t) => 80 + 6 * Math.sin(t * 40) }));
  check(!shaky.acts.some((a) => a.type === "brace"), "tipped hard while shaking is not a brace");
  const lean = read(stream(1, { roll: () => 0.5 }));
  check(lean.p.lean > 0.35 && lean.p.lean < 0.5, `a gentle tilt leans the canoe (${lean.p.lean.toFixed(2)})`);
}

section("Rhythm and noise");
{
  // strokes at 1.5 a second for 10 s
  const rhythm = read(stream(10, { theta: (t) => 70 + 25 * Math.sin(2 * Math.PI * 1.5 * t), roll: () => 0.4 }));
  const n = rhythm.of("stroke").length;
  check(n >= 14 && n <= 16, `a steady 1.5 strokes a second for 10 s reads as ${n} strokes (15 ± 1)`);
  check(rhythm.of("back").length === 0, "and never as a back stroke");
  // a walk: the phone bobs and sways in the hand
  const r = mulberry(3);
  let a = 0, b = 0;
  const walk = read(stream(10, {
    theta: (t) => 70 + 4 * Math.sin(t * 11) + (a += (r() - 0.5) * 0.8),
    roll: (t) => 0.2 * Math.sin(t * 3.1) + (b = b * 0.95 + (r() - 0.5) * 0.02),
    twist: (t) => 60 * Math.sin(t * 7),
  }));
  check(walk.of("stroke").length === 0 && walk.of("back").length === 0 && walk.of("j").length === 0, `10 s of walking is no stroke at all (${walk.acts.map((q) => q.type).join(",") || "nothing"})`);
}

section("Through public/fish/js/motion.js");
{
  globalThis.window = { isSecureContext: true, addEventListener() {}, DeviceMotionEvent: function () {}, DeviceOrientationEvent: function () {} };
  const { Motion } = await import("../../public/fish/js/motion.js");
  const acts = [];
  const p = createPaddle({ pull: -1, onAction: (x) => acts.push(x) });
  Motion.on((q) => p.feed(q));
  // touch play pushes the same pose: a stroke tipped right
  const th = strokeTheta(45, 200);
  for (let i = 1; i <= 72; i++) Motion.virtual({ t: 1000 + (i * 1000) / 60, theta: th(i / 60), roll: 0.4 });
  check(acts.filter((x) => x.type === "stroke" && x.side === 1).length === 1, "a stroke through Motion's pose reads the same");
}

console.log(`\ncreek.paddle: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
