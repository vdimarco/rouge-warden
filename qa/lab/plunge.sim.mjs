// Checks the rules of Take the Plunge with no browser: node qa/lab/plunge.sim.mjs
// Exact replays, ghost links, the entry classes, winter, and that skill matters: a scripted good flyer goes at least
// twice as far as a random one, in runs of 1 to 6 minutes. Exit code 1 on failure.
import { makeWorld, newState, step, predict, distance, speed, entryClass, wallSpeed, stateHash, H, T, AIR, WATER, LAKE, LAND } from "../../public/lab/plunge/sim.js";
import { encodeGhost, decodeGhost, Tape, Recorder, replay } from "../../public/lab/plunge/ghost.js";
import { mulberry, cottageDay } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------------- flyers ---------------- */
// A good flyer: glide; when falling, look ahead with a tuck and commit if that makes a rip with room under the water.
// Under the water, chase fish ahead and below, else let go and swoop up.
function expert() {
  let commit = false;
  return (s, W) => {
    if (s.mode !== AIR) commit = false;
    if (s.mode === WATER) {
      const seg = W.find(s.x);
      for (const f of seg.fish) if (!s.taken.has(f.id) && f.x > s.x && f.x - s.x < 14 && f.y < s.y) return true;
      return false;
    }
    if (commit) return true;
    if (s.tick % 6 === 0 && s.vy < 0) {
      const p = predict(s, W, true, 360, 1000);
      if (p.end === "perfect" || p.end === "rip") {
        const ex = p.pts[p.pts.length - 2], seg = W.find(ex);
        if (seg.kind === LAKE && seg.x1 - ex > 25) { commit = true; return true; }
      }
    }
    return false;
  };
}
// A random flyer: flips the input now and then.
function random(seed) {
  const r = mulberry(seed ^ 0x5eed);
  let on = false;
  return (s) => { if (s.tick % 12 === 0 && r() < 0.25) on = !on; return on; };
}
function fly(seed, bot, { maxS = 900, record = false } = {}) {
  const W = makeWorld(seed), s = newState(), rec = new Recorder();
  let badGround = 0;
  while (s.alive && s.tick < maxS * 120) {
    const tuck = bot(s, W);
    rec.feed(s.tick + 1, tuck);
    step(s, W, tuck);
    const gy = W.ground(s.x);
    if (s.mode === AIR && s.y < gy - 0.01) badGround++;
    if (s.mode === WATER && s.y < gy) badGround++;
  }
  return { s, W, flips: rec.flips, badGround };
}

/* ---------------- 1. exact replays ---------------- */
section("Exact replays");
{
  const hashes = [0, 1, 2].map(() => stateHash(fly(1234, expert(), { maxS: 120 }).s));
  check(hashes[0] === hashes[1] && hashes[1] === hashes[2], `three runs of one flyer give one state hash (${hashes[0].toString(16)})`);
  const a = fly(99, random(7), { maxS: 60 }).s, b = fly(99, random(7), { maxS: 60 }).s;
  check(stateHash(a) === stateHash(b), "a random flyer with the same seed replays exactly");
  // the world does not depend on the order it is built in
  const w1 = makeWorld(5), w2 = makeWorld(5);
  w2.find(3000);
  let same = true;
  for (let x = -100; x < 3000; x += 7.3) if (w1.ground(x) !== w2.ground(x)) same = false;
  check(same, "the land is the same however far ahead it was built");
}

/* ---------------- 2. ghost links ---------------- */
section("Ghost links");
{
  const r = fly(4242, expert(), { maxS: 400 });
  const code = encodeGhost({ seed: 4242, flips: r.flips, ticks: r.s.tick, dist: distance(r.s), name: "abc" });
  const g = decodeGhost(code);
  check(!!g && g.seed === 4242 && g.name === "ABC" && g.flips.length === r.flips.length, `a ghost survives the link (${code.length} characters, ${r.flips.length} flips, ${(r.s.tick * H).toFixed(0)} s)`);
  const back = replay(g);
  check(stateHash(back.s) === stateHash(r.s), "the replay ends in exactly the same state");
  check(near(back.dist, g.dist, 0.05), `the replay flies the recorded ${g.dist} m`);
  check(code.length < 1500, "a long run still fits in a link");
  // junk never throws
  const rnd = mulberry(1);
  let bad = 0, threw = 0;
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+/*! ";
  for (let i = 0; i < 5000; i++) {
    let s = "";
    const n = Math.floor(rnd() * 60);
    for (let k = 0; k < n; k++) s += abc[Math.floor(rnd() * abc.length)];
    try { if (decodeGhost(s) !== null) bad++; } catch (e) { threw++; }
  }
  check(threw === 0, "5,000 junk links never throw");
  check(bad === 0, "5,000 junk links all read as no ghost");
  // a cut link fails cleanly
  check(decodeGhost(code.slice(0, code.length - 3)) === null, "a cut link reads as no ghost");
  const t = new Tape([3, 5, 9]);
  check([1, 3, 4, 5, 8, 9, 10].map((k) => t.at(k)).join() === "false,true,true,false,false,true,true", "the tape plays the flips back in order");
}

/* ---------------- 3. entries ---------------- */
section("Entries into the water");
{
  const W = makeWorld(1);
  const lake = W.segs.find((s) => s.kind === LAKE) || W.find(40);
  const mid = (lake.x0 + lake.x1) / 2;
  const at = (deg, tuck, v = 30) => {
    const s = newState({ x: mid, y: 0.2, vx: v * Math.cos((deg * Math.PI) / 180), vy: -v * Math.sin((deg * Math.PI) / 180) });
    const ev = [];
    for (let i = 0; i < 10 && !ev.length; i++) step(s, W, tuck, ev);
    const e = ev.find((q) => q.k === "entry" || q.k === "skip");
    return { e, s, k: e ? speed(s) / e.v : 0 };
  };
  const want = [[75, true, "perfect", T.K_PERFECT], [52, true, "rip", T.K_RIP], [35, true, "splash", T.K_SPLASH], [18, true, "flop", T.K_FLOP], [40, false, "flop", T.K_FLOP]];
  for (const [deg, tuck, cls, k] of want) {
    const r = at(deg, tuck);
    check(r.e && r.e.k === "entry" && r.e.cls === cls && near(r.k, k, 1e-9), `${deg}°, ${tuck ? "tucked" : "wings open"}: ${cls}, keeps ${Math.round(k * 100)}% (got ${r.e && r.e.cls}, ${(r.k * 100).toFixed(1)}%)`);
  }
  const sk = at(8, false);
  check(sk.e && sk.e.k === "skip" && sk.s.vy > 0 && sk.s.mode === AIR, "8° with wings open skips off the water");
  check(entryClass(10, -10, true) === "rip" && entryClass(10, -2, true) === "flop" && entryClass(10, -20, true) === "perfect", "entryClass reads slopes");
  // a rip swoops forward and bursts out faster than it went in
  const s = newState({ x: lake.x0 + 12, y: 0.2, vx: 18, vy: -26 });
  const ev = [];
  let n = 0;
  // hold until the water, then let go and swoop
  while (n++ < 600 && !ev.some((q) => q.k === "exit")) step(s, W, s.mode === AIR, ev);
  const en = ev.find((q) => q.k === "entry"), ex = ev.find((q) => q.k === "exit");
  check(en && en.cls === "rip" && ex && ex.cls === "burst" && speed(s) > en.v, `a rip swoops up and bursts out faster (${en && en.v.toFixed(1)} in, ${speed(s).toFixed(1)} out)`);
  check(s.vx > 5, "the swoop turns the dive forward");
}

/* ---------------- 4. winter ---------------- */
section("Winter");
{
  check(near(wallSpeed(0), 6, 1e-9) && near(wallSpeed(60), 13.2, 1e-9) && near(wallSpeed(180), 27.6, 1e-9), "the wall speeds up: 6 m/s, 13.2 at 1 min, 27.6 at 3 min");
  const W = makeWorld(3), s = newState();
  let sum = -T.WALL_GAP;
  for (let i = 1; i <= 120 * 30; i++) { step(s, W, false); sum += wallSpeed(i * H) * H; }
  check(near(s.wx, sum, 1e-6), "the wall moves by its speed each step");
  // a flyer that never touches the input still gets caught
  const idle = fly(3, () => false, { maxS: 400 });
  check(!idle.s.alive, `a flyer who does nothing is caught (${(idle.s.tick * H).toFixed(0)} s, ${distance(idle.s).toFixed(0)} m)`);
}

/* ---------------- 5. skill matters ---------------- */
section("Skill matters");
{
  const seeds = [1, 2, 3, 42, 777, 2026, 9];
  const ex = seeds.map((sd) => fly(sd, expert()));
  const rn = seeds.map((sd) => fly(sd, random(sd)));
  const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const exD = med(ex.map((r) => distance(r.s))), rnD = med(rn.map((r) => distance(r.s)));
  const exT = ex.map((r) => r.s.tick * H);
  console.log("  good flyer: " + ex.map((r) => `${distance(r.s).toFixed(0)} m / ${(r.s.tick * H).toFixed(0)} s / V${r.s.stats.bestFlock + 1}`).join(", "));
  console.log("  random:     " + rn.map((r) => `${distance(r.s).toFixed(0)} m / ${(r.s.tick * H).toFixed(0)} s`).join(", "));
  check(exD >= 2 * rnD, `the good flyer's median run (${exD.toFixed(0)} m) is at least twice the random one's (${rnD.toFixed(0)} m)`);
  check(med(exT) >= 60 && med(exT) <= 360, `a good run lasts 1 to 6 minutes (median ${med(exT).toFixed(0)} s)`);
  check(ex.every((r) => r.badGround === 0) && rn.every((r) => r.badGround === 0), "nobody ends a step inside the land or under a lake bed");
}

/* ---------------- 6. no NaN ---------------- */
section("1,000 random runs");
{
  let nan = 0, total = 0;
  for (let i = 0; i < 1000; i++) {
    const W = makeWorld(1000 + i), s = newState(), bot = random(i);
    while (s.alive && s.tick < 40 * 120) {
      step(s, W, bot(s, W));
      total++;
      if (!Number.isFinite(s.x + s.y + s.vx + s.vy + s.wx)) { nan++; break; }
    }
  }
  check(nan === 0, `no NaN in 1,000 random runs (${(total / 1e6).toFixed(1)} million steps)`);
}

section("The day");
check(/^\d{4}-\d{2}-\d{2}$/.test(cottageDay()), `the cottage day reads as a date (${cottageDay()})`);
check(cottageDay(new Date("2026-09-29T02:30:00Z")) === "2026-09-28", "10:30 pm in Ontario is still the same day there");

console.log(`\nplunge.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
