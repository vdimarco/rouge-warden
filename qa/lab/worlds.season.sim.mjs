// Checks the rules of Season Thief (Small Worlds) with no browser: node qa/lab/worlds.season.sim.mjs
// The game module runs with a stub api and the shell's seeded random. A scripted player taps the chips, the
// timeline and the buttons, the same way a finger does. A separate solver here checks the par that the game shows.
// Exit code 1 on failure.
import createGame, { makeGarden, BUDGET } from "../../public/lab/worlds/games/season.js";
import { mulberry } from "../../public/lab/kit/rng.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const H = 1 / 120;
const AGE_X = [64, 209.5, 355], NAMES = ["tree", "vine", "spring", "lily"];

/* ---------------- a solver written for this test ---------------- */
// The rules as the game states them: moving an age forward costs 1 time a stage, and moving it back costs 2.
// A rule fires when the player sets its object to its age, and changes one other object for free.
const cost = (from, to) => (to > from ? to - from : 2 * (from - to));
function set(ages, i, v, effects) { const a = ages.slice(); a[i] = v; for (const e of effects) if (e.on[0] === i && e.on[1] === v) e.apply(a); return a; }
// Cheapest plan from the start to the haven: a priority search over ages and crossings. Returns the cost and the steps.
function solve(ages, gates, effects, only = null) {
  const id = (a, c) => a.join("") + c, seen = new Map([[id(ages, 0), { d: 0, from: null, step: null }]]), open = [{ a: ages, c: 0, d: 0 }];
  while (open.length) {
    let k = 0; for (let j = 1; j < open.length; j++) if (open[j].d < open[k].d) k = j;
    const s = open.splice(k, 1)[0];
    if (seen.get(id(s.a, s.c)).d < s.d) continue;
    if (s.c === 3) { const steps = []; let key = id(s.a, s.c); while (seen.get(key).from) { steps.unshift(seen.get(key).step); key = seen.get(key).from; } return { cost: s.d, steps }; }
    const add = (a, c, d, step) => { const key = id(a, c), b = seen.get(key); if (!b || b.d > d) { seen.set(key, { d, from: id(s.a, s.c), step }); open.push({ a, c, d }); } };
    if (only ? only[s.c].test(s.a) : gates[s.c].some((g) => g.test(s.a))) add(s.a, s.c + 1, s.d, "walk");
    for (let i = 0; i < 4; i++) for (let v = 0; v < 3; v++) if (v !== s.a[i]) add(set(s.a, i, v, effects), s.c, s.d + cost(s.a[i], v), [i, v]);
  }
  return { cost: Infinity, steps: null };
}

/* ---------------- a scripted player ---------------- */
function makeGame(seed) {
  const log = { tones: [], finish: null, status: "", metrics: [], t: 0 };
  const g = createGame({ W: 420, H: 680, rng: mulberry(seed), status: (s) => (log.status = s), metric: (s) => log.metrics.push(s),
    finish: (o) => (log.finish = o), tone: (f, d) => log.tones.push({ t: log.t, f: Math.round(f), d }), burst() {} });
  const step = (seconds) => { const n = Math.max(1, Math.round(seconds / H)); for (let i = 0; i < n; i++) { g.update(H); log.t += H; } };
  const tap = (x, y) => { g.pointer("down", { x, y }); g.pointer("up", { x, y }); };
  const s = () => g.getState();
  const select = (i) => { const c = s().controls.chips.find((c) => c.id === NAMES[i]); tap(c.x, c.y); };
  const age = (i, v) => { select(i); tap(AGE_X[v], 596); step(0.05); };
  const walk = () => { tap(340, 645); for (let n = 0; n < 400 && s().moving; n++) step(0.05); };
  const undo = () => tap(80, 645), hint = () => tap(210, 645);
  const play = (steps) => { for (const x of steps) { if (x === "walk") walk(); else age(x[0], x[1]); } };
  return { g, log, step, tap, s, select, age, walk, undo, hint, play };
}
// A 2D context that records the stroke and fill colors that draw() uses.
function recorder() {
  const calls = [], grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k.startsWith("create") ? () => grad : k === "stroke" ? () => calls.push("stroke " + o.strokeStyle) : k === "fill" ? () => calls.push("fill " + o.fillStyle) : () => {}),
    set: (o, k, v) => ((o[k] = v), true),
  });
  return { ctx, calls };
}

/* ---------------- 1. gardens from the seed ---------------- */
section("Gardens come from the seed (1,000 seeds)");
{
  let solvable = 0, parOk = 0, same = 0, ways2 = 0, closed = 0, ruleHelps = 0, distinct = new Set();
  const pars = {};
  for (let seed = 1; seed <= 1000; seed++) {
    const garden = makeGarden(mulberry(seed)), game = createGame({ rng: mulberry(seed), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
    const best = solve(garden.ages, garden.gates, garden.effects).cost;
    if (best <= BUDGET) solvable++;
    if (best >= 4 && best <= 6) parOk++;
    if (best === game.par && best === garden.par) same++;
    pars[best] = (pars[best] || 0) + 1;
    let ways = 0;
    for (const a of garden.gates[0]) for (const b of garden.gates[1]) for (const c of garden.gates[2]) if (solve(garden.ages, garden.gates, garden.effects, [a, b, c]).cost <= BUDGET) ways++;
    if (ways >= 2 && ways === game.ways) ways2++;
    if (!garden.gates[0].some((g) => g.test(garden.ages))) closed++;
    if (solve(garden.ages, garden.gates, []).cost > best) ruleHelps++;
    distinct.add(garden.ages.join("") + garden.gates.map((x) => x.map((y) => y.id).join("+")).join("|") + garden.effects.map((e) => e.id).join("+"));
  }
  console.log(`       par: ${Object.entries(pars).map(([p, n]) => `${p} in ${n}`).join(", ")}`);
  check(solvable === 1000, `every garden can be finished within ${BUDGET} time (${solvable}/1000)`);
  check(parOk === 1000, `par is 4 to 6 in every garden (${parOk}/1000)`);
  check(same === 1000, `the par the game shows matches this solver (${same}/1000)`);
  check(ways2 === 1000, `every garden has at least two ways to finish within the budget (${ways2}/1000)`);
  check(closed === 1000, `the stream starts closed in every garden (${closed}/1000)`);
  check(ruleHelps === 1000, `in every garden a rule makes par cheaper than with no rules (${ruleHelps}/1000)`);
  check(distinct.size >= 900, `1,000 seeds give at least 900 different gardens (${distinct.size})`);
  const a = createGame({ rng: mulberry(5), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
  const b = createGame({ rng: mulberry(5), status() {}, metric() {}, finish() {}, tone() {}, burst() {} }).getState();
  check(JSON.stringify(a.objects) === JSON.stringify(b.objects) && a.par === b.par && a.rules.join() === b.rules.join(), "one seed always gives the same garden");
}

/* ---------------- 2. a live preview while dragging ---------------- */
section("A live preview while dragging the timeline");
{
  // Find a garden that starts with a standing tree, then drag the tree to Fallen.
  let seed = 1; while (makeGarden(mulberry(seed)).ages[0] === 2) seed++;
  const P = makeGame(seed), r = recorder();
  P.select(0); P.step(0.05);
  const t0 = P.s().objects[0].age, budget0 = P.s().budget;
  // Only a standing tree draws its trunk in this color.
  const standing = (calls) => calls.filter((c) => c === "stroke #765d49").length;
  r.calls.length = 0; P.g.draw(r.ctx); const before = standing(r.calls);
  const ticks0 = P.log.tones.length;
  P.g.pointer("down", { x: AGE_X[t0], y: 596 });
  for (let i = 1; i <= 12; i++) P.g.pointer("move", { x: AGE_X[t0] + ((AGE_X[2] - AGE_X[t0]) * i) / 12, y: 598 });
  const mid = P.s();
  r.calls.length = 0; P.g.draw(r.ctx); const during = standing(r.calls);
  check(before > 0 && during === 0, `the tree is drawn fallen in the middle of the drag (standing trunk strokes: ${before} before, ${during} during)`);
  check(mid.preview && mid.preview.age === 2 && mid.objects[0].age === t0 && mid.budget === budget0, "the drag shows the new age but spends no time yet");
  check(P.log.tones.length - ticks0 === 2 - t0, `a soft tick plays at each stage on the way (${P.log.tones.length - ticks0} ticks)`);
  P.g.pointer("cancel", { x: AGE_X[2], y: 598 });
  r.calls.length = 0; P.g.draw(r.ctx);
  check(standing(r.calls) === before && !P.s().preview && P.s().budget === budget0, "a cancelled drag changes nothing");
}
{
  // The preview applies the rules, and WALK lights when the preview opens the way.
  let found = false;
  for (let seed = 1; seed <= 300 && !found; seed++) {
    const garden = makeGarden(mulberry(seed)), plan = solve(garden.ages, garden.gates, garden.effects).steps, k = plan.indexOf("walk");
    const last = plan[k - 1], before = plan.slice(0, k - 1);
    const fires = garden.effects.some((e) => e.on[0] === last[0] && e.on[1] === last[1]);
    if (!fires) continue;
    found = true;
    const P = makeGame(seed); P.play(before); P.select(last[0]);
    const a0 = P.s().objects[last[0]].age;
    P.g.pointer("down", { x: AGE_X[a0], y: 596 }); P.g.pointer("move", { x: AGE_X[last[1]], y: 598 });
    const s = P.s(), e = garden.effects.find((e) => e.on[0] === last[0] && e.on[1] === last[1]);
    const ruled = s.preview.ages.some((v, i) => i !== last[0] && v !== s.objects[i].age);
    check(s.preview.opens && !s.ready && ruled, `seed ${seed}: the preview shows the rule "${e.text}" and opens the way before the change is made`);
    const r = recorder(); P.g.draw(r.ctx);
    check(r.calls.includes("fill #e8cd98"), "WALK lights during that preview");
    P.g.pointer("up", { x: AGE_X[last[1]], y: 598 });
    check(P.s().ready && P.s().preview === null, "letting go makes the change, and the way stays open");
  }
  check(found, "found a garden where the last change before a walk fires a rule");
}

/* ---------------- 3. a real cost ---------------- */
section("Time has a real cost");
{
  let seed = 1; while (makeGarden(mulberry(seed)).ages[0] !== 0) seed++;
  const P = makeGame(seed);
  P.age(0, 1); check(P.s().budget === BUDGET - 1, "moving the tree forward one stage costs 1 time");
  P.age(0, 2); check(P.s().budget === BUDGET - 2, "and one more stage costs 1 more");
  P.age(0, 0); check(P.s().budget === BUDGET - 6, "moving it back two stages costs 4 time");
  P.undo(); P.step(0.05);
  check(P.s().objects[0].age === 2 && P.s().budget === BUDGET - 3, `UNDO puts the tree back and costs 1 time (time ${BUDGET - 2} before the change, ${P.s().budget} after the undo)`);
  P.undo(); P.step(0.05);
  check(P.s().objects[0].age === 1 && P.s().budget === BUDGET - 3, `a second UNDO also costs 1 time (time ${P.s().budget})`);
}
{
  let seed = 1; while (makeGarden(mulberry(seed)).ages[1] !== 0) seed++;
  const P = makeGame(seed);
  P.hint(); P.step(0.05);
  check(P.s().budget === BUDGET - 1 && P.s().hints[0] === 1 && /Hint: /.test(P.log.status), `HINT costs 1 time and names a way across: "${P.log.status}"`);
  P.age(1, 1); P.hint(); P.undo(); P.step(0.05);
  check(P.s().objects[1].age === 0 && P.s().budget === BUDGET - 3 && P.s().hints[0] === 2, `an UNDO does not give back a HINT (time ${P.s().budget} after two hints and one undo)`);
}
{
  // UNDO after WALK keeps the crossing. WALK commits every change before it.
  const garden = makeGarden(mulberry(11)), plan = solve(garden.ages, garden.gates, garden.effects).steps;
  const P = makeGame(11);
  P.play(plan.slice(0, plan.indexOf("walk") + 1));
  const s0 = P.s();
  P.undo(); P.step(0.05);
  const s1 = P.s();
  check(s0.checkpoint === 1 && s1.checkpoint === 1, `UNDO after WALK keeps the crossing count (${s0.checkpoint} then ${s1.checkpoint})`);
  check(s1.budget === s0.budget && JSON.stringify(s1.objects) === JSON.stringify(s0.objects) && s1.history === 0, "and it does not change the time or the ages");
  check(/nothing to undo/i.test(P.log.status), `the player is told why: "${P.log.status}"`);
}

/* ---------------- 4. par and stars on the end card ---------------- */
section("Par and stars");
{
  let threes = 0, n = 0;
  for (const seed of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const garden = makeGarden(mulberry(seed)), plan = solve(garden.ages, garden.gates, garden.effects);
    const P = makeGame(seed); P.play(plan.steps); P.step(0.5);
    const f = P.log.finish; n++;
    if (f && f.score === 3 && f.unit === "stars" && f.win && f.detail.startsWith(`Used ${plan.cost} time · par ${plan.cost} · ★★★`)) threes++;
    if (seed === 2) {
      check(P.log.metrics[P.log.metrics.length - 1].startsWith("3/3 crossings"), `the HUD is not stale at the end: "${P.log.metrics[P.log.metrics.length - 1]}"`);
      check(f && !/[!—]/.test(f.title + f.detail), `the end card has no exclamation marks or long dashes: "${f && f.detail}"`);
    }
  }
  check(threes === n, `the best plan makes par and gets three stars (${threes}/${n})`);
  // One hint costs 1 time, so the same plan ends at par + 1 with two stars.
  const garden = makeGarden(mulberry(3)), plan = solve(garden.ages, garden.gates, garden.effects);
  const P = makeGame(3); P.hint(); P.play(plan.steps); P.step(0.5);
  const f = P.log.finish;
  check(f && f.score === 2 && f.detail.startsWith(`Used ${plan.cost + 1} time · par ${plan.cost} · ★★☆`) && /Use 1 less time/.test(f.detail), `one extra time gives two stars: "${f && f.detail}"`);
}
{
  // While an UNDO can still save the run, the run goes on. A player who changes and undoes until no plan fits runs out.
  const P = makeGame(4);
  P.age(0, P.s().objects[0].age === 0 ? 2 : 0); P.age(1, P.s().objects[1].age === 0 ? 2 : 0);
  check(!P.log.finish || P.s().history > 0, "the run goes on while UNDO can still bring back enough time");
  while (P.s().history) { P.undo(); P.step(0.05); }
  let cycles = 0;
  while (!P.log.finish && cycles++ < 20) { P.age(2, P.s().objects[2].age === 0 ? 1 : 0); if (!P.log.finish) { P.undo(); P.step(0.05); } }
  const f = P.log.finish;
  check(f && f.score === 0 && f.win === false && /ran out/.test(f.title), `wasting time ends the run with 0 stars ("${f && f.title}", ${P.s().budget} time left)`);
}

/* ---------------- 5. the haven wakes ---------------- */
section("The haven wakes after the last crossing");
{
  const garden = makeGarden(mulberry(6)), plan = solve(garden.ages, garden.gates, garden.effects);
  const P = makeGame(6); P.play(plan.steps);
  const s0 = P.s(), r0 = recorder(); P.g.draw(r0.ctx);
  // The shell keeps calling update() for 1.6 s at half speed after the finish.
  const tones0 = P.log.tones.length;
  for (let i = 0; i < 192; i++) P.g.update(H / 2);
  const s1 = P.s(), r1 = recorder(); P.g.draw(r1.ctx);
  // The brightest light ray drawn, as its alpha.
  const rays = (calls) => Math.max(0, ...calls.filter((c) => c.startsWith("fill rgba(255,240,190,")).map((c) => parseFloat(c.split(",")[3])));
  check(s0.won && s1.wake > 0.79, `update() keeps the outro moving after the finish (wake ${s0.wake.toFixed(2)} to ${s1.wake.toFixed(2)})`);
  check(rays(r1.calls) > 0.2 && rays(r1.calls) > rays(r0.calls) * 5, `light rays spread from the haven (ray alpha ${rays(r0.calls).toFixed(3)} then ${rays(r1.calls).toFixed(3)})`);
  check(P.log.tones.length - tones0 >= 4, `a chord rings as the haven wakes (${P.log.tones.length - tones0} notes in the outro)`);
}

/* ---------------- 6. drawing does not throw ---------------- */
section("Drawing");
{
  let ok = true;
  const r = recorder(), draw = (P) => { try { P.g.draw(r.ctx); } catch (e) { ok = false; console.log("       " + e.stack.split("\n").slice(0, 3).join("\n       ")); } };
  for (const seed of [1, 2, 3, 12, 40]) {
    const garden = makeGarden(mulberry(seed)), plan = solve(garden.ages, garden.gates, garden.effects);
    const P = makeGame(seed); draw(P); P.hint(); draw(P); P.hint(); draw(P);
    for (const x of plan.steps) { if (x === "walk") { P.tap(340, 645); for (let i = 0; i < 30; i++) { P.step(0.05); draw(P); } } else { P.select(x[0]); P.g.pointer("down", { x: AGE_X[0], y: 596 }); P.g.pointer("move", { x: AGE_X[x[1]], y: 598 }); draw(P); P.g.pointer("up", { x: AGE_X[x[1]], y: 598 }); draw(P); } }
    for (let i = 0; i < 20; i++) { P.g.update(0.05); draw(P); }
  }
  check(ok, "draw() runs at the start, with hints, during drags, walks, the end and the outro");
}

console.log(`\nworlds.season.sim: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
