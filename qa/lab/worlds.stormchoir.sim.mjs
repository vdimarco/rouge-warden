// Checks the rules of Storm Choir (Small Worlds) with no browser: node qa/lab/worlds.stormchoir.sim.mjs
// It imports the game module with a stub api and plays it with scripted players. Storms cross the racing line, so a
// player who only aims at rings loses birds and a player who dodges loses none. Rings score more through the centre
// and at a faster climb. The sky is endless and seeded, with a dawn every six rings. Exit code 1 on failure.
import createGame from "../../public/lab/worlds/games/stormchoir.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const STEP = 1 / 120, NOTES = [262, 294, 330, 392, 440, 523];
const drift = (a) => Math.asin(Math.sin(a)) * 2 / Math.PI;

// A stub of the shell's api. It logs each sound and effect with the game time.
function start(seed, best = 0) {
  const log = { now: 0, calls: [], status: [], finish: null };
  const rec = (k) => (...a) => log.calls.push({ k, t: log.now, a });
  const g = createGame({ W: 420, H: 680, rng: mulberry(seed), seed, daily: false, best, status: (s) => log.status.push({ t: log.now, s }), metric: () => {}, finish: (o) => { log.finish ||= { ...o, t: log.now }; }, tone: rec("tone"), noise: rec("noise"), chord: rec("chord"), slow: rec("slow"), shake: rec("shake"), burst() {}, buzz() {} });
  return { g, log };
}
// Plays until stop(state) is true or the run ends. The player sees the state 60 times a second.
function play(seed, player, { stop = () => false, maxT = 600, best = 0, each = null } = {}) {
  const { g, log } = start(seed, best);
  let s = g.getState();
  for (let i = 0; !log.finish && s.time < maxT && !stop(s); i++) {
    log.now = s.time;
    if (player && i % 2 === 0) player(g, s);
    log.now = s.time + STEP; // the game time while this step runs
    g.update(STEP);
    s = g.getState();
    if (each) each(s, log);
  }
  return { g, log, s };
}
const firstSet = (seed, player) => play(seed, player, { stop: (s) => s.dawns > 0 }).s;

/* ---------------- players ---------------- */
// Aims the wind at the next ring and never looks at the storms.
const chaser = (fingerY = 560) => (g, s) => g.pointer(s.held ? "move" : "down", { x: s.nextRing ? s.nextRing.x : 210, y: fingerY });
// A careful player. For each place the wind could aim for, it adds a cost for each storm that will cover that place
// while the flock crosses the storm's band (sooner storms cost more), a cost for crossing a storm that is about to
// arrive, and a cost for being far from where the next ring will be. It also reaches for a bird that falls.
function dodger(fingerY = 560, aim = 0) {
  return (g, s) => {
    const at = (alt) => s.time + (alt - s.altitude) / s.climb, ring = s.nextRing, tr = ring ? at(ring.alt) - s.time : 9;
    const ringX = ring ? ring.cx + ring.amp * Math.sin(ring.om * at(ring.alt) + ring.ph) + aim : 210;
    const flock = s.birds.filter((b) => b.state === "flock"), cx = flock.length ? flock.reduce((a, b) => a + b.x, 0) / flock.length : ringX;
    const blocks = [];
    for (const st of s.storms) {
      if (st.alt + st.r + 34 < s.altitude) continue;
      const t1 = Math.max(s.time, at(st.alt - st.r - 24)), t2 = at(st.alt + st.r + 34);
      if (t1 - s.time > 3) break;
      let lo = 1e9, hi = -1e9;
      for (let k = 0; k <= 10; k++) { const x = st.lx + st.amp * drift(st.om * (t1 + (t2 - t1) * k / 10) + st.ph); lo = Math.min(lo, x); hi = Math.max(hi, x); }
      blocks.push({ lo: lo - st.r - 51, hi: hi + st.r + 51, soon: t1 - s.time, end: t2 - s.time, now0: st.x - st.r - 30, now1: st.x + st.r + 30 });
    }
    if (blocks.length > 1) { const end = blocks[0].end + .4; for (let i = blocks.length - 1; i > 0; i--) if (blocks[i].soon > end) blocks.splice(i, 1); }
    const falling = s.birds.filter((b) => b.state === "tumble" && b.t < 1.7);
    let x = ringX, best = Infinity;
    for (let c = 50; c <= 370; c += 4) {
      let cost = Math.abs(c - ringX) / (.6 + tr) + Math.abs(c - cx) * .05;
      for (const b of falling) if (Math.abs(c - b.x) < 24) cost -= 250;
      for (const b of blocks) {
        if (c > b.lo && c < b.hi) cost += 1000 / (1 + b.soon) + Math.min(c - b.lo, b.hi - c);
        if (b.soon < 1.1 && Math.min(c, cx) < b.now1 && Math.max(c, cx) > b.now0) cost += 400;
      }
      if (cost < best) { best = cost; x = c; }
    }
    g.pointer(s.held ? "move" : "down", { x, y: fingerY });
  };
}
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/* ---------------- 1. a seeded sky ---------------- */
section("An endless sky from the seed");
{
  const sky = (seed) => { const s = start(seed).g.getState(); return { rings: s.rings.map((r) => [r.alt, r.cx, r.amp, r.hw].map(Math.round)), storms: s.storms.map((q) => [q.alt, q.lx, q.amp, q.r].map(Math.round)) }; };
  const a = sky(1), b = sky(1), c = sky(2);
  check(JSON.stringify(a) === JSON.stringify(b), `one seed always gives the same rings and storms (${a.rings.length} rings, ${a.storms.length} storms)`);
  const moved = a.rings.filter((r, i) => Math.abs(r[1] - c.rings[i][1]) > 20).length;
  check(moved >= a.rings.length / 2, `two seeds give different rings: ${moved} of ${a.rings.length} ring centres move more than 20 px`);
  const runA = play(4, dodger(486), { stop: (s) => s.dawns >= 2 }).s, runB = play(4, dodger(636, 30), { stop: (s) => s.dawns >= 2 }).s;
  const n = Math.min(runA.rings.length, runB.rings.length), same = runB.rings.slice(0, n).every((r, i) => r.alt === runA.rings[i].alt && r.cx === runA.rings[i].cx);
  check(same && n >= 24, `the sky does not depend on how you play: a fast and a slow player see the same ${n} rings`);
}

/* ---------------- 2. storms on the racing line ---------------- */
section("Storms cross the racing line, and the flock is your health");
{
  let chaserLost = 0, dodgerClean = 0, knocks = 0, warned = 0, late = [], rumbled = 0;
  for (const seed of SEEDS) {
    const c = play(seed, chaser(), { stop: (s) => s.dawns > 0, each: (s, log) => {
      for (const b of s.birds) if (b.knockAt === s.time) {
        knocks++;
        const st = s.storms[b.by];
        if (st.warned && s.time - st.warnAt >= .3) warned++; else late.push(`seed ${seed} t ${s.time.toFixed(2)}`);
        if (log.calls.some((q) => q.k === "noise" && Math.abs(q.t - st.warnAt) < 1e-6)) rumbled++;
      }
    } });
    if (c.s.lost > 0) chaserLost++;
    const d = firstSet(seed, dodger(600));
    if (d.knocked === 0 && d.lost === 0) dodgerClean++;
  }
  check(chaserLost > SEEDS.length / 2, `a player who aims at the next ring loses at least one bird in the first set on most seeds (${chaserLost} of ${SEEDS.length})`);
  check(dodgerClean === SEEDS.length, `a player who dodges loses no bird in the first set (${dodgerClean} of ${SEEDS.length} seeds)`);
  check(knocks > 20 && warned === knocks, `every knockout comes at least 0.3 s after its storm darkens (${warned} of ${knocks})${late.length ? ": " + late.slice(0, 3).join(", ") : ""}`);
  check(rumbled === knocks, `every storm that knocks a bird out rumbled when it darkened (${rumbled} of ${knocks})`);
  // the storm's dark core is drawn with the same radius as its hit circle
  const { g } = start(3);
  for (let i = 0; i < 120 * 5; i++) g.update(STEP);
  const s = g.getState(), st = s.storms.find((q) => q.y > 0 && q.y < 680), arcs = [];
  g.draw(recorder((k, a) => { if (k === "arc") arcs.push(a); }));
  check(st && arcs.some((a) => Math.abs(a[0] - st.x) < .01 && Math.abs(a[1] - st.y) < .01 && Math.abs(a[2] - st.r) < 1e-9), `a storm's bright rim has the radius of its core, ${st ? st.r.toFixed(1) : "?"} px (a bird is knocked out when its body touches the core)`);
}

/* ---------------- 3. a bird can be caught ---------------- */
section("A knocked-out bird tumbles, and the wind can catch it within 2 s");
{
  // fly at the first storm; when a bird falls, reach for it with the wind
  let caughtIn = null, lostAfter = null;
  for (const seed of SEEDS) {
    let fallAt = null, target = null;
    const r = play(seed, (g, s) => {
      const b = s.birds.find((q) => q.state === "tumble");
      if (b && fallAt === null) { fallAt = s.time; target = s.birds.indexOf(b); }
      const x = fallAt !== null && s.birds[target].state === "tumble" ? s.birds[target].x : s.nextRing.x;
      g.pointer(s.held ? "move" : "down", { x, y: 600 });
    }, { stop: (s) => fallAt !== null && s.birds[target].state !== "tumble" });
    if (r.s.birds[target]?.state === "flock") { caughtIn = r.s.time - fallAt; break; }
  }
  check(caughtIn !== null && caughtIn <= 2, `steering the wind to a falling bird brings it back into the flock (after ${caughtIn?.toFixed(2)} s)`);
  for (const seed of SEEDS) {
    let fallAt = null, target = null;
    const r = play(seed, chaser(), { stop: (s) => { if (fallAt === null) { const b = s.birds.find((q) => q.state === "tumble"); if (b) { fallAt = s.time; target = s.birds.indexOf(b); } } return fallAt !== null && s.birds[target].state !== "tumble"; } });
    if (r.s.birds[target]?.state === "lost") { lostAfter = r.s.time - fallAt; break; }
  }
  check(lostAfter !== null && lostAfter > 1.9 && lostAfter < 2.1, `a bird nobody catches is lost after 2 s (${lostAfter?.toFixed(2)} s)`);
  const knock = play(2, chaser(), { stop: (s) => s.knocked > 0 }).log.calls.filter((q) => q.k === "chord").pop();
  check(knock && knock.a[0].every((f) => f < 150), `a knockout plays a low chord (${knock ? knock.a[0].join(", ") : "none"} Hz)`);
}

/* ---------------- 4. scoring ---------------- */
section("Points per ring: birds through × centre bonus (up to ×2) × climb bonus (up to ×2)");
{
  const seeds = SEEDS.slice(0, 12);
  let centreWins = 0, fastWins = 0, sumC = 0, sumO = 0, sumH = 0, sumL = 0;
  for (const seed of seeds) {
    const c = firstSet(seed, dodger(600, 0)).score, o = firstSet(seed, dodger(600, 50)).score, h = firstSet(seed, dodger(486)).score, l = firstSet(seed, dodger(636)).score;
    if (c > o) centreWins++; if (h > l) fastWins++;
    sumC += c; sumO += o; sumH += h; sumL += l;
  }
  check(centreWins === seeds.length, `aiming at the centre outscores aiming 50 px off on every seed (${centreWins} of ${seeds.length}; mean ${Math.round(sumC / seeds.length)} against ${Math.round(sumO / seeds.length)})`);
  check(fastWins === seeds.length, `a high finger (fast climb) outscores a low one on every seed (${fastWins} of ${seeds.length}; mean ${Math.round(sumH / seeds.length)} against ${Math.round(sumL / seeds.length)})`);
  // the formula on one ring
  const r = play(5, dodger(560), { stop: (s) => s.rings.some((g) => g.passed && g.hit) }).s, ring = r.rings.find((g) => g.passed && g.hit);
  check(ring.points >= 10 * ring.through && ring.points <= 40 * ring.through, `one ring gives ${ring.points} points for ${ring.through} birds: between ×1 and ×4 of 10 per bird`);
  let perfect = null, shown = [];
  for (const seed of SEEDS) {
    const r = play(seed, dodger(600), { maxT: 200, stop: (s) => s.streak >= 2, each: (s, log) => { if (s.streak >= 2 && !perfect) perfect = log.calls.filter((q) => q.k === "chord").pop(); } });
    if (perfect) { r.g.draw(recorder((k, a) => { if (k === "fillText" && /PERFECT/.test(a[0])) shown.push(a[0]); })); break; }
  }
  check(perfect && perfect.a[0].length === 2, `two centred passes in a row stack a harmony note on the ring note (${perfect ? perfect.a[0].map(Math.round).join(", ") : "none"} Hz)`);
  check(shown.includes("PERFECT ×2"), `and the sky shows "${shown[0] || "nothing"}"`);
  // rings sway, so centring takes timing
  const sway = start(1).g.getState().rings.filter((g) => g.amp > 10).length;
  check(sway >= 8, `most rings sway from side to side (${sway} of the first 12)`);
}

/* ---------------- 5. dawns and run length ---------------- */
section("A dawn every six rings, and how long a run lasts");
{
  const r = play(7, dodger(560), { stop: (s) => s.dawns > 0 });
  const slow = r.log.calls.find((q) => q.k === "slow"), chord = r.log.calls.find((q) => q.k === "chord" && q.a[0].length === 6);
  check(r.s.dawns === 1 && r.s.sung + r.s.rings.filter((g) => g.passed && !g.hit).length === 6, "the dawn comes after the sixth ring");
  check(slow && slow.a[0] < 1 && slow.a[1] >= 2, `the dawn is a 2 s slow motion (factor ${slow?.a[0]}, ${slow?.a[1]} s)`);
  check(chord && NOTES.every((n, i) => chord.a[0][i] === n), `the six ring notes play together as a chord (${chord ? chord.a[0].join(", ") : "none"} Hz)`);
  const set0 = r.s.storms.filter((q) => q.alt < r.s.rings[5].alt), set2 = r.s.storms.filter((q) => q.alt > r.s.rings[11].alt && q.alt < r.s.rings[17].alt);
  const mean = (a, k) => a.reduce((x, q) => x + q[k], 0) / a.length;
  check(set2.length > set0.length && mean(set2, "r") > mean(set0, "r"), `later skies are stormier: ${set0.length} storms of ${mean(set0, "r").toFixed(0)} px in the first set, ${set2.length} of ${mean(set2, "r").toFixed(0)} px in the third`);
  const lengths = [];
  for (const seed of SEEDS.slice(0, 8)) { const p = play(seed, dodger(560), { maxT: 900 }); lengths.push(p.log.finish ? p.log.finish.t : Infinity); if (p.log.finish) check(p.s.alive < 5, `seed ${seed}: the run ends when fewer than 5 birds are left (${p.s.alive} left after ${p.log.finish.t.toFixed(0)} s)`); }
  check(lengths.every((t) => t > 60), `a good player's run lasts more than 60 s (${lengths.map((t) => t.toFixed(0)).join(", ")} s)`);
  check(lengths.every((t) => t < 600), "and every run ends in less than 10 minutes");
  const idle = SEEDS.slice(0, 8).map((seed) => play(seed, null, { maxT: 600 }).log.finish?.t ?? Infinity);
  check(idle.every((t) => t < 240), `with no input the run ends in less than 4 minutes (${idle.map((t) => t.toFixed(0)).join(", ")} s)`);
  const end = play(3, chaser(), { maxT: 300 }).log.finish;
  check(end && /next dawn was \d ring/.test(end.detail) && end.score >= 0, `the end says how close the next dawn was ("${end?.detail}")`);
}

/* ---------------- 6. input ---------------- */
section("Input");
{
  const { g } = start(1);
  g.key("down", "ArrowLeft"); g.update(STEP);
  const a = g.getState();
  g.key("up", "ArrowLeft"); g.update(STEP);
  const b = g.getState();
  check(a.held && !b.held && a.targetX < 210, "an arrow key steers the wind while it is held, and lets go when it is released");
  g.key("down", "ArrowUp"); for (let i = 0; i < 240; i++) g.update(STEP);
  const fast = g.getState().climb;
  g.key("up", "ArrowUp"); g.key("down", "ArrowDown"); for (let i = 0; i < 240; i++) g.update(STEP);
  check(fast > g.getState().climb + 30, `up climbs fast and down climbs slowly (${fast.toFixed(0)} against ${g.getState().climb.toFixed(0)} px/s)`);
  const tap = play(1, (g, s) => g.pointer(Math.floor(s.time * 4) % 2 ? "up" : "down", { x: 210, y: 600 }), { maxT: 10 }).s;
  check(tap.altitude / tap.time >= 46, `a player who only taps still climbs at ${(tap.altitude / tap.time).toFixed(0)} px/s (it was 11 px/s)`);
}

/* ---------------- 7. drawing ---------------- */
section("Drawing");
{
  // play one run and draw it at each moment that matters
  let errors = 0, frames = 0;
  const { g, log } = start(9);
  const p = dodger(560);
  let moments = new Set();
  for (let i = 0; i < 120 * 200 && !moments.has("outro"); i++) {
    const s = g.getState(); log.now = s.time;
    if (i % 2 === 0 && !s.phase.includes("end")) p(g, s);
    g.update(STEP);
    const n = g.getState();
    const m = n.phase === "ended" ? (n.time - log.finish.t > .4 ? "outro" : "end") : n.dawnT >= 0 ? "dawn" : n.birds.some((b) => b.state === "tumble") ? "tumble" : n.storms.some((q) => q.warned && q.y > 0 && q.y < 680) ? "storm" : "flight";
    if (i % 15 === 0 || !moments.has(m)) { moments.add(m); try { g.draw(recorder()); frames++; } catch (e) { errors++; console.log("   ", m, e.message); } }
  }
  check(errors === 0 && ["flight", "storm", "dawn", "outro"].every((m) => moments.has(m)), `draw() runs in flight, near storms, at a dawn and in the outro (${frames} frames, moments: ${[...moments].join(", ")})`);
}

console.log(`\nworlds.stormchoir.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);

// A canvas context that accepts every call. onCall(name, args) sees each method call.
function recorder(onCall = () => {}) {
  const gradient = { addColorStop() {} }, props = {};
  return new Proxy(props, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => gradient;
      if (k === "measureText") return () => ({ width: 10 });
      return (...a) => onCall(k, a);
    },
    set(target, k, v) { target[k] = v; return true; },
  });
}
