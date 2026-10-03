// Checks the rules of Take the Plunge with no browser: node qa/lab/plunge.sim.mjs
// Exact replays, ghost links, the entry classes, winter, and that skill matters: a scripted good flyer goes at least
// twice as far as a random one, in runs of 1 to 6 minutes. Also: a touch on a lake bed costs speed once, so a player
// who dives at every lake flies on; the dive-now cue tells the truth; old ghost links say so; and the race with a ghost
// is told against the distance it recorded. Exit code 1 on failure.
import { makeWorld, newState, step, predict, diveCue, goodDive, lakeLeft, distance, speed, entryClass, wallSpeed, stateHash, H, T, ROOM, REACT, AIR, WATER, LAKE, LAND } from "../../public/lab/plunge/sim.js";
import { encodeGhost, decodeGhost, oldGhost, raceLine, GHOST_V, Tape, Recorder, replay } from "../../public/lab/plunge/ghost.js";
import { mulberry, cottageDay, toB64u, fromB64u } from "../../public/lab/kit/rng.js";

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
// A new player who read "hold to dive": holds while a lake is under the loon or just ahead, and lets go under the water.
const lakeDiver = () => (s, W) => s.mode === AIR && (W.isLake(s.x) || W.isLake(s.x + 15)) && s.y > -0.5;
// A player who answers the dive-now cue 0.25 s late: when the cue lights, they hold from REACT steps later until the
// water.
function cueFollower() {
  let at = -1;
  return (s, W) => {
    if (s.mode !== AIR) { at = -1; return false; }
    if (at < 0 && diveCue(s, W)) at = s.tick + REACT;
    return at >= 0 && s.tick >= at;
  };
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

/* ---------------- 6. no death spiral ---------------- */
section("The lake bed and the thud");
const SEEDS = [1, 2, 3, 42, 777, 2026, 9, 11, 12, 13, 100, 2000, 31337, 5, 6];
const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
{
  // a skim along the bed near the far shore: the loss comes once for the touch, not once for each step of it
  const W = makeWorld(42);
  let lake = W.find(200);
  while (lake.kind !== LAKE) lake = W.find(lake.x1 + 0.01);
  const s = newState({ x: lake.x1 - 12, y: W.ground(lake.x1 - 12) + 0.41, vx: 20, vy: -2, mode: WATER, under: 0.5 });
  const v0 = speed(s), ev = [];
  let contact = 0;
  for (let i = 0; i < 36 && s.mode === WATER; i++) { step(s, W, true, ev); if (s.y <= W.ground(s.x) + 0.4 + 1e-9) contact++; }
  const scrapes = ev.filter((e) => e.k === "scrape").length, kept = speed(s) / v0;
  check(contact >= 24 && scrapes === 1 && kept >= T.K_BED - 0.01, `a ${(contact * H).toFixed(2)} s skim on the bed scrapes once and keeps ${Math.round(kept * 100)}% of the speed (it kept 5% when each step cost 8%)`);
  // a new touch costs again
  const b = newState({ x: (lake.x0 + lake.x1) / 2, y: -lake.depth * 0.5, vx: 4, vy: -14, mode: WATER, under: 0.5 }), ev2 = [];
  let left = false;
  for (let i = 0; i < 240 && b.mode === WATER; i++) {
    step(b, W, true, ev2);
    if (ev2.some((e) => e.k === "scrape") && !b.onBed && !left) { left = true; b.vy = -14; }
    if (left && ev2.filter((e) => e.k === "scrape").length >= 2) break;
  }
  check(left && ev2.filter((e) => e.k === "scrape").length === 2, "the loon leaves the bed, dives at it again, and the second touch costs again");
  // a thud bounces you up
  const t = newState({ x: 0, y: 12, vx: 14, vy: -12 }), w5 = makeWorld(5), ev3 = [];
  for (let i = 0; i < 240 && !ev3.some((e) => e.k === "thud"); i++) step(t, w5, false, ev3);
  check(ev3.some((e) => e.k === "thud") && t.vy >= T.HOP_LAND, `a thud bounces the loon back up at ${t.vy.toFixed(1)} m/s (at least ${T.HOP_LAND})`);
}
{
  // a new player who dives at every lake now flies on, and gets farther than one who does nothing
  const runs = (bot) => SEEDS.map((sd) => {
    const W = makeWorld(sd), s = newState(), b = bot(sd), ev = [];
    let th30 = 0;
    while (s.alive && s.tick < 900 * 120) { ev.length = 0; step(s, W, b(s, W), ev); if (s.tick <= 30 * 120) th30 += ev.filter((e) => e.k === "thud").length; }
    return { d: distance(s), t: s.tick * H, th30 };
  });
  const lk = runs(lakeDiver), idle = runs(() => () => false);
  const lkT = med(lk.map((r) => r.t)), lkD = med(lk.map((r) => r.d)), idD = med(idle.map((r) => r.d));
  const th = lk.reduce((a, r) => a + r.th30, 0) / lk.length;
  console.log("  lake-diver: " + lk.map((r) => `${r.d.toFixed(0)} m / ${r.t.toFixed(0)} s / ${r.th30} thuds`).join(", "));
  console.log("  idle:       " + idle.map((r) => `${r.d.toFixed(0)} m`).join(", "));
  check(lkT >= 60, `a player who dives at every lake flies for a median ${lkT.toFixed(0)} s (at least 60)`);
  check(lkD >= 1.2 * idD, `and goes a median ${lkD.toFixed(0)} m, ${(lkD / idD).toFixed(2)} times the ${idD.toFixed(0)} m of a player who does nothing (at least 1.2)`);
  check(th <= 10, `with ${th.toFixed(1)} thuds in the first 30 s (at most 10)`);
}

/* ---------------- 7. the dive-now cue and the line ---------------- */
section("The dive-now cue and the line");
{
  // the cue tells the truth: every hold that starts 0.25 s after the cue lights rips, with room to swoop out
  let holds = 0, good = 0;
  const bad = [], dist = [], first = [];
  for (const sd of SEEDS) {
    const W = makeWorld(sd), s = newState(), bot = cueFollower(), ev = [];
    let cueAt = -1;
    const lake1 = W.segs[1] || W.find(40);
    while (s.alive && s.tick < 900 * 120) {
      if (cueAt < 0 && diveCue(s, W)) cueAt = s.tick;
      const tuck = bot(s, W);
      ev.length = 0;
      step(s, W, tuck, ev);
      for (const e of ev) if (e.k === "entry" && tuck) {
        holds++;
        const room = lakeLeft(W, e.x);
        if (goodDive(e.cls, room)) good++; else bad.push(`seed ${sd} at ${e.x.toFixed(0)} m: ${e.cls}, ${room.toFixed(0)} m of lake`);
      }
    }
    dist.push(distance(s));
    // the first cue comes before the loon is over the first lake
    const w = makeWorld(sd), f = newState();
    while (f.tick < 600 && !diveCue(f, w)) step(f, w, false);
    first.push({ sd, t: f.tick * H, x: f.x, ok: diveCue(f, w) && f.x < lake1.x0 });
  }
  check(holds > 100 && good === holds, `a player who answers the cue 0.25 s late rips with room on all ${holds} holds (${bad.slice(0, 3).join("; ") || "no misses"})`);
  const lk = SEEDS.map((sd) => { const W = makeWorld(sd), s = newState(), b = lakeDiver(); while (s.alive && s.tick < 900 * 120) step(s, W, b(s, W)); return distance(s); });
  check(med(dist) >= 1.5 * med(lk), `following the cue takes the median run to ${med(dist).toFixed(0)} m, against ${med(lk).toFixed(0)} m for diving at every lake`);
  check(first.every((r) => r.ok), `on every seed the cue lights before the first lake (after ${med(first.map((r) => r.t)).toFixed(2)} s, at ${med(first.map((r) => r.x)).toFixed(0)} m)`);
  // and it stays off while the loon climbs, and under the water
  const W = makeWorld(3);
  check(!diveCue(newState({ vy: 4 }), W) && !diveCue(newState({ mode: WATER, y: -3 }), W), "the cue stays off on a climb and under the water");
}
{
  // the line: a rip that leaves less than ROOM metres of lake to swoop out is not a good dive (amber, not green)
  const W = makeWorld(42);
  let lake = W.find(200);
  while (lake.kind !== LAKE || lake.x1 - lake.x0 < 80) lake = W.find(lake.x1 + 0.01);
  const dive = (back) => predict(newState({ x: lake.x1 - back - 0.6, y: 1.2, vx: 12, vy: -24 }), W, true);
  const near = dive(20), far = dive(60);
  check(near.end === "perfect" && near.room > 18 && near.room < ROOM && !goodDive(near.end, near.room), `a perfect entry ${near.room.toFixed(1)} m before the far shore is not a good dive (less than ${ROOM} m to swoop)`);
  check(far.end === "perfect" && far.room > ROOM && goodDive(far.end, far.room), `the same entry ${far.room.toFixed(1)} m before the far shore is a good dive`);
}

/* ---------------- 8. ghost links from an older version, and the race ---------------- */
section("Old ghost links, and the race with a ghost");
{
  const r = fly(42, expert(), { maxS: 300 });
  const code = encodeGhost({ seed: 42, flips: r.flips, ticks: r.s.tick, dist: distance(r.s), name: "abc" });
  const b = fromB64u(code);
  b[0] = GHOST_V - 1;
  const old = toB64u(b);
  const og = oldGhost(old);
  check(decodeGhost(old) === null && !!og && og.v === GHOST_V - 1 && og.seed === 42 && og.name === "ABC" && near(og.dist, distance(r.s), 0.06),
    `a link from version ${GHOST_V - 1} does not race, but it keeps its lakes, initials and ${og && og.dist} m`);
  check(oldGhost(code) === null, "a link of this version is not an old ghost");
  const rnd = mulberry(2);
  let bad = 0;
  for (let i = 0; i < 5000; i++) {
    let s = "";
    const n = Math.floor(rnd() * 60);
    for (let k = 0; k < n; k++) s += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[Math.floor(rnd() * 64)];
    if (oldGhost(s) !== null) bad++;
  }
  check(bad === 0, "5,000 junk links all read as no old ghost");
}
{
  // The race: a long ghost, and a player who does nothing and is caught early. The ghost flies beside the player in
  // step, as on the page, so it is still in the air when winter catches the player.
  const r = fly(42, expert());
  const g = decodeGhost(encodeGhost({ seed: 42, flips: r.flips, ticks: r.s.tick, dist: distance(r.s), name: "abc" }));
  const W = makeWorld(42), s = newState(), gs = newState(), tape = new Tape(g.flips);
  while (s.alive) { step(s, W, false); if (gs.alive) step(gs, W, tape.at(gs.tick + 1)); }
  const d = distance(s), line = raceLine(d, g, gs);
  const want = Math.round(g.dist - d).toLocaleString("en-CA") + " m", then = Math.round(distance(gs) - d).toLocaleString("en-CA") + " m";
  check(gs.alive && line === `ABC's ghost flew ${want} farther.`, `caught at ${d.toFixed(0)} m against a ${g.dist} m ghost: "${line}" (where the ghost was then says ${then})`);
  const won = raceLine(g.dist + 120, g, null);
  check(won === "You beat ABC's ghost by 120 m.", `a longer run says "${won}"`);
}

/* ---------------- 9. no NaN ---------------- */
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
