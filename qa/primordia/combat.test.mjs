// Primordia combat rules against the real Lenia dish: combat design section 8.3 (tests 1-31) plus
// two rules found while writing them (32, 33).
// Usage: node qa/primordia/combat.test.mjs [test numbers...]   e.g. `node qa/primordia/combat.test.mjs 8 12`
// Every test seeds its Game and drives it with update(1/60, input). Scripted situations are built
// directly: stamp hunters, step until tracked, force states, move the player by setting P.x and P.y.
// A failure whose message starts with "GAME BUG" (or "SUSPECTED GAME BUG") is a rule the game breaks,
// not a test mistake; "setup:" failures mean the scripted situation did not come about.
import assert from "node:assert/strict";
import { World, findBlobs, blobShape, decodeCells } from "../../public/primordia/lenia.js";
import { ORBIUM } from "../../public/primordia/species.js";
import { Game, GAME_RULES, HUNTER_R, TUNE, SPECIES, SP, MUTATIONS, WAVES, wrap, wdelta, mulberry32 } from "../../public/primordia/core.js";

const only = new Set(process.argv.slice(2).map(Number).filter(Boolean));
const results = [];
let failures = 0;
function test(n, name, fn) {
  if (only.size && !only.has(n)) return;
  const t0 = Date.now();
  let line;
  try {
    const note = fn();
    line = `ok   ${String(n).padStart(2)} ${name} (${Date.now() - t0} ms)${note ? `  [${note}]` : ""}`;
  } catch (err) {
    failures++;
    const msg = String((err && err.message) || err).split("\n").slice(0, 6).join("\n       ");
    line = `FAIL ${String(n).padStart(2)} ${name} (${Date.now() - t0} ms)\n       ${msg}`;
  }
  results.push(line);
  console.log(line);
}

// ---------- helpers ----------
const DT = 1 / 60;
const SCALE = HUNTER_R / 13;
const ORB = decodeCells(ORBIUM);
const deg = (r) => (r * 180) / Math.PI;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const NAME = Object.fromEntries(Object.values(SP).map((v) => [v, SPECIES[v].name]));

// A play-mode game on a clean dish: no waves, encores or prey unless a test asks for them.
function setup(seed = 1, { w = 256, h = 128, touch = false, clean = true } = {}) {
  const g = new Game(w, h, seed, { touch });
  g.reset("play");
  g.qa = { immortal: true, holdEpoch: clean };
  g.growHold = true; // these rules run inside one size; growth.test.mjs covers growing
  if (clean) {
    g.world.clear();
    g.prey.length = 0; g.hunters.length = 0; g.claims.length = 0; g.pending.length = 0;
    g.labelB = null; g.ownerOf = [];
    hush(g);
  }
  g.events.length = 0;
  return g;
}
function hush(g) {
  const D = g.director;
  D.spawned = [true, true, true]; D.cleared = [true, true, true]; D.encoreCd = Infinity;
  g.preyCd = Infinity; g.goldenCd = Infinity; g.epochTime = 5;
}
// one 60 Hz frame. Immortal players keep full light (damage still shows in stats.loss).
function tick(g, input = {}) {
  const P = g.player;
  if (g.qa.immortal && P.alive) P.light = P.maxLight;
  if (g.qa.holdEpoch && g.epochTime > 30) g.epochTime = 5;
  g.update(DT, input);
}
function frames(g, n, input = {}, each) {
  for (let i = 0; i < n; i++) { tick(g, typeof input === "function" ? input(i) : input); if (each && each(i) === false) return i + 1; }
  return n;
}
function stepOnce(g, input = {}) { const s = g.steps; for (let i = 0; i < 40 && g.steps === s; i++) tick(g, input); }

// Stamp bodies (all in the same frame), then step until each one is tracked.
function spawnMany(g, list) {
  const P = g.player, alive = P.alive;
  P.alive = false; // no chase, no bites while the bodies settle into the tracker
  const before = new Set(g.hunters);
  for (const u of list) g.stampHunter(u.sp, u.x, u.y, u.angle ?? g.angleToward(u.sp, u.x, u.y), u.tags || {});
  const found = list.map(() => null);
  for (let k = 0; k < 6 && found.some((f) => !f); k++) {
    stepOnce(g);
    list.forEach((u, i) => {
      if (found[i]) return;
      found[i] = g.hunters.find((e) => !before.has(e) && e.species === u.sp && !found.includes(e) && g.dist(e.x, e.y, u.x, u.y) < 20) || null;
    });
  }
  P.alive = alive;
  assert.ok(found.every(Boolean), "setup: stamped bodies were not all tracked");
  if (alive) stepOnce(g); // labels and nearest tissue with a live player
  return found;
}
const spawn = (g, sp, x, y, angle, tags) => spawnMany(g, [{ sp, x, y, angle, tags }])[0];

function cellsOf(g, e) { const L = g.labelB, out = []; for (let i = 0; i < L.length; i++) if (L[i] === e.blob) out.push(i); return out; }
// the densest labelled cell: real tissue (an arc's centroid sits in its empty hollow)
function densest(g, e) { let bi = -1, bv = -1; for (const i of cellsOf(g, e)) if (g.world.B[i] > bv) { bv = g.world.B[i]; bi = i; } return { x: bi % g.w, y: (bi / g.w) | 0 }; }
const shapeOf = (g, e) => blobShape(g.labelB, e.blob, g.w, g.h, e.x, e.y);
const evs = (g, type, pred = () => true) => g.events.filter((v) => v.type === type && pred(v));

// Dash from (x0, y0) along (ux, uy); runs until the dash and any hit-stop are over, plus `after` frames.
function dash(g, x0, y0, ux, uy, { after = 0, each } = {}) {
  const P = g.player;
  P.x = wrap(x0, g.w); P.y = wrap(y0, g.h); P.vx = 0; P.vy = 0;
  const id = P.dashId;
  let f = 0;
  tick(g, { mx: ux, my: uy, dash: true }); if (each) each(f); f++;
  assert.equal(P.dashId, id + 1, "setup: the dash did not start (no charge?)");
  while ((P.dashT > 0 || g.hitstop > 0) && f < 300) { tick(g, { mx: ux, my: uy }); if (each) each(f); f++; }
  for (let i = 0; i < after; i++) { tick(g, { mx: ux, my: uy }); if (each) each(f); f++; }
  return id + 1;
}
// a dash of full length centred on (cx, cy)
function dashThrough(g, cx, cy, ux, uy, opts) {
  const half = (TUNE.dashSpeed * g.dashTime()) / 2;
  return dash(g, cx - ux * half, cy - uy * half, ux, uy, opts);
}
// bodies counted the way the caps count them: tracked hunters plus pending spawns
function census(g) {
  const c = { gliders: 0, swarm: 0, eggs: 0, bodies: 0 };
  const add = (egg, swarm) => { if (egg) c.eggs++; else { c.gliders++; if (swarm) c.swarm++; } c.bodies++; };
  for (const e of g.hunters) add(!!e.egg, e.species === SP.DISC);
  for (const p of g.pending) if (p.kind === "hunter") add(SPECIES[p.species].role === "egg", SPECIES[p.species].role === "swarm");
  return c;
}
// a lone body in a bare Lenia world: mass trace and its unwrapped centroid path
function lifeRun(sp, { steps = 300, settle = 40, angle = 0.7, w = 128, h = 128, marks = [] } = {}) {
  const W = new World(w, h, GAME_RULES);
  W.stamp(W.B, SPECIES[sp].rows, w / 2, h / 2, angle, SCALE);
  const big = () => findBlobs(W.B, w, h, 0.15, 4).blobs.sort((a, b) => b.mass - a.mass);
  for (let s = 0; s < settle; s++) W.step();
  let prev = big()[0], px = 0, py = 0;
  const out = { start: prev, at: {}, minMass: Infinity, maxMass: 0 };
  for (let s = 1; s <= steps; s++) {
    W.step();
    const bl = big(), b = bl[0];
    px += wdelta(b.x - prev.x, w); py += wdelta(b.y - prev.y, h); prev = b;
    out.minMass = Math.min(out.minMass, b.mass); out.maxMass = Math.max(out.maxMass, b.mass);
    if (marks.includes(s)) out.at[s] = { blobs: bl.length, mass: b.mass, dx: px, dy: py };
  }
  out.end = { blobs: big().length, mass: prev.mass, dx: px, dy: py };
  return out;
}
const cache = new Map();
const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// A player who never attacks: steers away from nearby tissue and out of locked lanes.
function dodger(g) {
  const P = g.player;
  let mx = 0, my = 0;
  for (const e of g.hunters) {
    if (!(e.nd < 45)) continue;
    const dx = wdelta(P.x - e.nx, g.w), dy = wdelta(P.y - e.ny, g.h), d = Math.hypot(dx, dy) || 1;
    const k = (45 - d) / 45;
    mx += (dx / d) * k * 2; my += (dy / d) * k * 2;
    if (e.lane && (e.state === "windup" || e.state === "lunge")) {
      const side = Math.sign(-e.lane.uy * dx + e.lane.ux * dy) || 1;
      mx += -e.lane.uy * 1.5 * side; my += e.lane.ux * 1.5 * side;
    }
  }
  if (Math.hypot(mx, my) < 0.2) { mx = Math.cos(g.time * 0.5); my = Math.sin(g.time * 0.7); }
  return { mx, my };
}

// ---------- 1-5: Lenia motion and the species ----------

test(1, "Roll is exact", () => {
  const W = new World(128, 128, GAME_RULES), sp = SPECIES[SP.DISC];
  W.stamp(W.B, sp.rows, 64, 64, 0.7, SCALE);
  for (let s = 0; s < 20; s++) W.step();
  const b = findBlobs(W.B, 128, 128, 0.15, 4).blobs[0], R = sp.reach + 2;
  const cx = Math.round(b.x), cy = Math.round(b.y);
  for (let i = 0; i < W.n; i++) if (W.B[i] > 0) assert.ok(Math.hypot(wdelta((i % 128) - cx, 128), wdelta(((i / 128) | 0) - cy, 128)) <= R - 4, "setup: body pokes out of the roll disc");
  const before = Float32Array.from(W.B), m0 = sum(before);
  const moved = W.roll(W.B, b.x, b.y, R, 3, -2);
  let bad = 0;
  for (let i = 0; i < W.n; i++) {
    const x = i % 128, y = (i / 128) | 0;
    if (W.B[wrap(y - 2, 128) * 128 + wrap(x + 3, 128)] !== before[i]) bad++;
  }
  assert.equal(bad, 0, `${bad} cells differ from the shifted original`);
  assert.ok(Math.abs(sum(W.B) - m0) < 1e-4, `mass ${m0} -> ${sum(W.B)}`);
  assert.ok(Math.abs(moved - m0) < 1e-3, `roll reported ${moved}, mass ${m0}`);
  // rollMany shifts several fields by the same whole cells
  W.A.fill(0); W.stamp(W.A, ORB, b.x, b.y, 0, 1);
  const a0 = Float32Array.from(W.A), b0 = Float32Array.from(W.B);
  const movedA = W.rollMany([W.A, W.B], b.x, b.y, R, -1, 2);
  for (let i = 0; i < W.n; i++) {
    const x = i % 128, y = (i / 128) | 0, j = wrap(y + 2, 128) * 128 + wrap(x - 1, 128);
    if (W.A[j] !== a0[i] || W.B[j] !== b0[i]) bad++;
  }
  assert.equal(bad, 0, `rollMany: ${bad} cells differ`);
  assert.ok(Math.abs(movedA - sum(a0)) < 1e-3, "rollMany returns the first field's moved mass");
  return `mass ${m0.toFixed(2)}, moved exactly`;
});

const circium = () => once("circium", () => {
  // eggs are tiny and static: a 64x64 dish is plenty (kernel R=10, body about 9 cells)
  const r = lifeRun(SP.EGG, { w: 64, h: 64, steps: 1500, angle: 0, marks: [800] });
  return r;
});

test(2, "Small bodies survive whole-cell chase", () => {
  // Discutium chases a circling player with the game's own stalk and moveBody (whole-cell roll)
  const g = setup(2, { w: 128, h: 128 });
  const P = g.player; P.x = 96; P.y = 64;
  const W = g.world, calls = { roll: 0, advect: 0 };
  const e = spawn(g, SP.DISC, 40, 64);
  for (const m of ["roll", "advect"]) { const o = W[m].bind(W); W[m] = (...a) => { calls[m]++; return o(...a); }; }
  for (let s = 0; s < 20; s++) stepOnce(g);
  const base = SPECIES[SP.DISC].mass;
  let minM = Infinity, maxM = 0, path = 0, last = { x: e.x, y: e.y }, lost = null;
  const s0 = g.steps;
  while (g.steps - s0 < 900 && !lost) {
    const a = g.time * 0.35;
    tick(g, { target: { x: 64 + Math.cos(a) * 34, y: 64 + Math.sin(a) * 34 } });
    if (!g.hunters.includes(e)) { lost = `lost at step ${g.steps - s0}`; break; }
    minM = Math.min(minM, e.mass); maxM = Math.max(maxM, e.mass);
    path += g.dist(last.x, last.y, e.x, e.y); last = { x: e.x, y: e.y };
  }
  assert.ok(!lost, "Discutium " + lost);
  const blobs = findBlobs(W.B, g.w, g.h, 0.15, 16).blobs;
  assert.equal(blobs.length, 1, "Discutium blobs " + blobs.length);
  assert.equal(calls.advect, 0, "Discutium must move by whole cells only");
  assert.ok(calls.roll > 100, "roll calls " + calls.roll);
  assert.ok(minM >= 0.9 * base && maxM <= 1.1 * base, `Discutium mass ${minM.toFixed(0)}-${maxM.toFixed(0)} vs species ${base}`);
  const c = circium();
  assert.equal(c.end.blobs, 1, "Circium blobs " + c.end.blobs);
  assert.ok(c.minMass >= 0.9 * c.start.mass && c.maxMass <= 1.1 * c.start.mass, `Circium mass ${c.minMass.toFixed(1)}-${c.maxMass.toFixed(1)}`);
  assert.ok(Math.hypot(c.end.dx, c.end.dy) < 1, "Circium drifted " + Math.hypot(c.end.dx, c.end.dy).toFixed(2));
  return `Discutium ${minM.toFixed(0)}-${maxM.toFixed(0)} over 900 steps, path ${path.toFixed(0)} cells; Circium ${c.minMass.toFixed(0)}-${c.maxMass.toFixed(0)} over 1500`;
});

test(3, "New species live alone", () => {
  const d = once("disc800", () => lifeRun(SP.DISC, { w: 64, h: 64, steps: 800, angle: 0.7 }));
  const c = circium().at[800];
  const notes = [];
  for (const [sp, r] of [[SP.DISC, d.end], [SP.EGG, c]]) {
    const m = SPECIES[sp].mass;
    assert.equal(r.blobs, 1, `${NAME[sp]} blobs ${r.blobs}`);
    assert.ok(Math.abs(r.mass - m) <= 0.1 * m, `${NAME[sp]} mass ${r.mass.toFixed(1)} vs ${m}`);
    notes.push(`${NAME[sp]} ${r.mass.toFixed(0)}`);
  }
  return notes.join(", ");
});

test(4, "Species masses and headings", () => {
  const notes = [];
  for (const sp of [SP.PARA, SP.PENTA, SP.HEXA, SP.HEPTA, SP.DISC, SP.EGG]) {
    const angle = 0.7, r = lifeRun(sp, { steps: 300, angle });
    const m = SPECIES[sp].mass, mass = r.end.mass;
    assert.ok(Math.abs(mass - m) <= 0.1 * m, `${NAME[sp]} mass ${mass.toFixed(0)} vs constant ${m}`);
    const dist = Math.hypot(r.end.dx, r.end.dy);
    if (sp === SP.EGG) { assert.ok(dist < 2, "Circium moved " + dist.toFixed(1)); notes.push(`Circ ${mass.toFixed(0)} static`); continue; }
    const off = deg(angDiff(Math.atan2(r.end.dy, r.end.dx), angle));
    const want = deg(SPECIES[sp].headingOffset);
    assert.ok(dist > 30, `${NAME[sp]} barely moved: ${dist.toFixed(1)} cells`);
    assert.ok(Math.abs(angDiff((off * Math.PI) / 180, (want * Math.PI) / 180)) <= (10 * Math.PI) / 180, `${NAME[sp]} heading = stamp ${off.toFixed(1)} deg, headingOffset ${want.toFixed(1)}`);
    notes.push(`${NAME[sp].slice(0, 4)} ${mass.toFixed(0)} ${off.toFixed(0)}deg`);
  }
  return notes.join(", ");
});

test(5, "Lunge safety", () => {
  const notes = [];
  for (const sp of [SP.PARA, SP.PENTA, SP.HEXA, SP.HEPTA]) {
    const g = setup(5, { w: 128, h: 128 });
    const P = g.player;
    const e = spawn(g, sp, 64, 64, 0);
    P.alive = false; // no chase between lunges: only the scripted lunges move the body
    const base = SPECIES[sp].mass, lv = g.lungeOf(e), dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let minM = Infinity, maxM = 0, lunges = 0, done = 0;
    const bad = [];
    const s0 = g.steps;
    while (g.steps - s0 < 8 * 70) {
      if (lunges < 8 && g.steps - s0 >= lunges * 70) {
        const [dx, dy] = dirs[lunges % 4];
        P.x = wrap(e.x + dx * 30, g.w); P.y = wrap(e.y + dy * 30, g.h);
        e.state = "windup"; e.lane = null; g.lockLane(e);
        assert.ok(e.lane, "setup: lane did not lock");
        g.beginLunge(e); lunges++;
      }
      tick(g, {});
      for (const v of g.events) {
        if (["dissolve", "brood", "rupture", "selfDeath", "tide"].includes(v.type)) bad.push(v.type);
        if (v.type === "recover" && v.why === "done") done++;
      }
      g.events.length = 0;
      if (!g.hunters.includes(e)) { bad.push("lost"); break; }
      minM = Math.min(minM, e.mass); maxM = Math.max(maxM, e.mass);
    }
    assert.equal(lunges, 8);
    assert.equal(done, 8, `${NAME[sp]}: ${done} of 8 lunges ran to the end`);
    assert.deepEqual(bad, [], `${NAME[sp]}: ${bad.join(", ")}`);
    assert.equal(g.hunters.length, 1, `${NAME[sp]}: ${g.hunters.length} bodies`);
    assert.equal(findBlobs(g.world.B, g.w, g.h, 0.15, 16).blobs.length, 1, `${NAME[sp]} split`);
    assert.ok(minM >= 0.85 * base, `${NAME[sp]} min mass ${minM.toFixed(0)} < 85% of ${base}`);
    assert.ok(maxM <= 1.4 * base, `${NAME[sp]} max mass ${maxM.toFixed(0)} > 1.4x ${base}`);
    notes.push(`${NAME[sp].slice(0, 4)} ${lv.v}x${lv.steps} ${(minM / base * 100).toFixed(0)}-${(maxM / base * 100).toFixed(0)}%`);
  }
  return notes.join(", ");
});

// ---------- 6-7: lunges ----------

test(6, "Lane cancel", () => {
  const g = setup(6);
  const P = g.player; P.x = 118; P.y = 64;
  // Paraptera glides toward the player (+x); a Pentapteryx sits on the far end of its lane
  const [para, penta] = spawnMany(g, [{ sp: SP.PARA, x: 88, y: 64, angle: Math.PI / 2 }, { sp: SP.PENTA, x: 150, y: 64, angle: Math.PI }]);
  penta.cool = Infinity;
  para.token = true; g.beginWindup(para);
  g.events.length = 0;
  const seen = [];
  let tokenAtCancel = null, held = null, cool = null;
  frames(g, 90, {}, () => {
    for (const v of g.events) if (v.id === para.id && ["windup", "lock", "cancel", "lunge"].includes(v.type)) {
      seen.push(v.type);
      if (v.type === "cancel" && tokenAtCancel === null) { tokenAtCancel = para.token; held = g.hunters.filter((e) => e.token && !e.boss).length; cool = para.cool; }
    }
    g.events.length = 0;
  });
  assert.ok(seen.includes("cancel"), "no cancel: " + seen.join(","));
  assert.ok(!seen.includes("lunge"), "lunged into another body: " + seen.join(","));
  assert.ok(!seen.includes("lock"), "lane locked: " + seen.join(","));
  assert.equal(tokenAtCancel, false, "token not released on cancel");
  assert.equal(held, 0, "a token is still held after the cancel");
  assert.ok(cool > 0, "no cooldown after the cancel");
  return `events ${seen.join(",")} in 1.5 s`;
});

test(7, "Lunge hit and cap", () => {
  const g = setup(7);
  const P = g.player;
  P.x = 85; P.y = 64;
  // two lancers far apart on one line. The player sits in A's lane, without i-frames, for A's whole
  // lunge; then in B's lane for B's whole lunge, which lands less than 1 s after A's.
  const [A, B] = spawnMany(g, [{ sp: SP.PARA, x: 60, y: 64, angle: Math.PI / 2 }, { sp: SP.PARA, x: 190, y: 64, angle: -Math.PI / 2 }]);
  A.token = true; g.beginWindup(A);
  const hits = [];
  let hold = { x: 85, y: 64 }, f = 0, moved = false;
  while (f < 240) {
    if (f === 40) { B.token = true; g.beginWindup(B); }
    if (!moved && A.state === "recover") { moved = true; hold = { x: wrap(B.nx - 14, g.w), y: B.ny }; } // step into B's lane
    P.x = hold.x; P.y = hold.y; P.vx = P.vy = 0; P.iframes = 0; // parked, no i-frames
    tick(g, {}); f++;
    for (const v of g.events) if (v.type === "lungeHit") hits.push({ id: v.id, dmg: v.dmg, t: g.time });
    g.events.length = 0;
    if (moved && B.state === "recover") break;
  }
  const byA = hits.filter((h) => h.id === A.id), byB = hits.filter((h) => h.id === B.id);
  assert.equal(byA.length, 1, `A hit ${byA.length} times in one lunge`);
  assert.equal(byB.length, 1, `B hit ${byB.length} times in one lunge`);
  assert.ok(byB[0].t - byA[0].t < 1, `setup: hits ${(byB[0].t - byA[0].t).toFixed(2)} s apart, cap not exercised`);
  for (const h of hits) {
    const win = hits.filter((o) => o.t <= h.t && o.t > h.t - 1).reduce((a, o) => a + o.dmg, 0);
    assert.ok(win <= TUNE.lungeCapPerSec + 1e-9, `lunge damage ${win} in 1 s`);
  }
  assert.equal(byA[0].dmg, TUNE.lungeHit);
  assert.equal(byB[0].dmg, TUNE.lungeCapPerSec - TUNE.lungeHit, "second hit should be capped");
  assert.equal(g.stats.loss.lunge, TUNE.lungeCapPerSec);
  return `hits ${byA[0].dmg} + ${byB[0].dmg} light, ${(byB[0].t - byA[0].t).toFixed(2)} s apart`;
});

// ---------- 8-14: Rend Dash, stagger, Glory Bite, kill credit ----------

test(8, "Rend Dash along staggers", () => {
  const g = setup(8);
  const P = g.player; P.x = 128; P.y = 110;
  const e = spawn(g, SP.PARA, 128, 50, 0);
  e.cool = Infinity;
  const d = densest(g, e), s = shapeOf(g, e), base = SPECIES[SP.PARA].mass;
  let crossed = -1, staggered = -1, cut = null;
  g.events.length = 0;
  dashThrough(g, d.x, d.y, s.ux, s.uy, { after: 2, each: (f) => {
    if (crossed < 0 && (e.tear || 0) >= TUNE.stagger) crossed = f;
    for (const v of g.events) { if (v.type === "stagger" && v.id === e.id && staggered < 0) staggered = f; if (v.type === "cut" && v.id === e.id) cut = v; }
    g.events.length = 0;
  } });
  assert.ok(cut, "no cut event");
  assert.ok(staggered >= 0, `no stagger (cut frac ${cut.frac.toFixed(3)})`);
  assert.ok(staggered - crossed <= 1, `stagger ${staggered - crossed} frames after tear passed ${TUNE.stagger}`);
  const tornFrac = cut.torn / base;
  assert.ok(tornFrac >= 0.18 && tornFrac <= TUNE.cutCap + 1e-3, `torn ${(tornFrac * 100).toFixed(1)}% of species mass`);
  assert.ok(cut.frac >= 0.18, `cut frac ${cut.frac.toFixed(3)}`);
  return `cut frac ${cut.frac.toFixed(3)}, torn ${(tornFrac * 100).toFixed(1)}%, stagger on frame ${staggered}`;
});

test(9, "Two cuts stagger a heavy", () => {
  const g = setup(9);
  const P = g.player; P.x = 128; P.y = 110;
  const e = spawn(g, SP.HEXA, 128, 50, 0);
  e.cool = Infinity;
  const t0 = g.time, tears = [];
  let stag = 0;
  const watch = () => { for (const v of g.events) if (v.type === "stagger" && v.id === e.id) stag++; g.events.length = 0; };
  for (let k = 0; k < 2; k++) {
    const d = densest(g, e), s = shapeOf(g, e);
    dashThrough(g, d.x, d.y, -s.uy, s.ux, { after: 2, each: watch }); // across the long axis
    tears.push(e.tear);
    if (k === 0) {
      assert.equal(stag, 0, `staggered by one cut across (tear ${e.tear.toFixed(3)})`);
      assert.ok(g.hunters.includes(e), "setup: one cut killed the Hexapteryx");
      frames(g, 4, {}, watch);
    }
  }
  assert.ok(g.time - t0 < 1.0, `setup: the cuts took ${(g.time - t0).toFixed(2)} s`);
  assert.equal(stag, 1, `stagger events after two cuts: ${stag} (tear ${tears.map((t) => t.toFixed(3)).join(" -> ")})`);
  return `tear ${tears.map((t) => t.toFixed(3)).join(" -> ")} within ${(g.time - t0).toFixed(2)} s`;
});

test(10, "Cut cap", () => {
  // The design's stagger at 0.20 would end the cut early; switch it off here so the whole Long Rend
  // dash (r5, 28 cells) runs along the body and only the 22% cap can stop it.
  const keep = TUNE.stagger;
  TUNE.stagger = Infinity;
  try {
    const g = setup(10);
    const P = g.player; P.x = 128; P.y = 110;
    g.mut.rend = 2;
    const e = spawn(g, SP.PENTA, 128, 50, 0);
    e.cool = Infinity;
    const W = g.world, orig = W.drain.bind(W), r = g.cutRadius();
    let drained = 0, rec = false;
    W.drain = (f, x, y, rad, rate) => { const t = orig(f, x, y, rad, rate); if (rec && f === W.B && rad === r) drained += t; return t; };
    const d = densest(g, e), s = shapeOf(g, e), cap = TUNE.cutCap * SPECIES[SP.PENTA].mass;
    rec = true;
    dashThrough(g, d.x, d.y, s.ux, s.uy);
    rec = false;
    const torn = P.dashTorn.get(e.id) || 0;
    assert.ok(torn >= cap - 0.5, `setup: the dash only tore ${torn.toFixed(1)} of a ${cap.toFixed(1)} cap`);
    assert.ok(torn <= cap + 0.01, `credited ${torn.toFixed(1)} > cap ${cap.toFixed(1)}`);
    assert.ok(drained <= cap + 5, `drained ${drained.toFixed(1)} mass, cap ${cap.toFixed(1)} + 5`);
    return `drained ${drained.toFixed(1)}, credited ${torn.toFixed(1)}, cap ${cap.toFixed(1)}`;
  } finally { TUNE.stagger = keep; }
});

// put the player's mouth (P + dir * 0.9) on a cell
function mouthOn(g, x, y) { const P = g.player; P.dirX = 1; P.dirY = 0; P.vx = P.vy = 0; P.x = wrap(x - 0.9, g.w); P.y = y; }

test(11, "Glory Bite", () => {
  const g = setup(11);
  const P = g.player; P.x = 128; P.y = 110;
  const e = spawn(g, SP.PARA, 128, 50, 0);
  e.cool = Infinity;
  g.stagger(e, "tear");
  let devour = null, cells = [], f = 0;
  while (!devour && f++ < 60) {
    const d = densest(g, e);
    cells = cellsOf(g, e);
    mouthOn(g, d.x, d.y);
    tick(g, {});
    devour = evs(g, "devour", (v) => v.kind === "hunter")[0];
    g.events.length = 0;
  }
  assert.ok(devour, "no devour");
  assert.equal(devour.how, "glory");
  assert.equal(devour.species, SP.PARA);
  const left = cells.filter((i) => g.world.B[i] !== 0).length;
  assert.equal(left, 0, `${left} of ${cells.length} cells of the old blob still hold tissue`);
  const t0 = g.time;
  let rem = null;
  frames(g, 90, {}, () => { rem = g.prey.find((p) => p.remains); g.events.length = 0; return !rem; });
  assert.ok(rem, "no Remains prey tracked within 1.5 s");
  assert.ok(g.time - t0 <= 1.0, `Remains tracked after ${(g.time - t0).toFixed(2)} s`);
  assert.equal(g.prey.filter((p) => p.remains).length, SPECIES[SP.PARA].remains);
  const near = g.world.probe(g.world.B, rem.x, rem.y, 8);
  assert.equal(near, 0, `hunter tissue ${near.toFixed(3)} within 8 cells of the Remains`);
  return `wiped ${cells.length} cells; Remains after ${(g.time - t0).toFixed(2)} s`;
});

test(12, "Same-dash rule", () => {
  const g = setup(12);
  const P = g.player; P.x = 128; P.y = 110;
  const e = spawn(g, SP.PARA, 128, 50, 0);
  e.cool = Infinity;
  const d = densest(g, e), s = shapeOf(g, e);
  let glory = null, stag = -1;
  const id = P.dashId + 1;
  dashThrough(g, d.x, d.y, s.ux, s.uy, { each: (f) => {
    for (const v of g.events) {
      if (v.type === "stagger" && v.id === e.id && stag < 0) stag = f;
      if (v.type === "devour" && v.kind === "hunter" && v.how === "glory" && !glory) glory = { f, dashT: P.dashT, sameDash: P.dashId === id };
    }
    g.events.length = 0;
  } });
  assert.ok(stag >= 0, "setup: the dash did not stagger the Paraptera");
  assert.ok(!glory, `GAME BUG: Glory Bite in the dash that staggered it (stagger frame ${stag}, glory frame ${glory && glory.f}, dashT ${glory && glory.dashT.toFixed(3)}); tryGlory() ignores e.staggerDash`);
  // the finish: a new dash into the reeling hunter
  assert.equal(e.state, "stagger");
  const d2 = densest(g, e);
  let fin = null;
  dash(g, d2.x - 6, d2.y, 1, 0, { each: () => { fin = fin || evs(g, "devour", (v) => v.kind === "hunter")[0]; g.events.length = 0; } });
  assert.ok(fin && fin.how === "glory", "no Glory Bite on the next dash");
  return "no glory in the staggering dash; glory on the next";
});

test(13, "Bleed-out credit", () => {
  const g = setup(13);
  const P = g.player; P.x = 128; P.y = 110;
  const notes = [];
  // A: a cut across the Paraptera's band (17% here, no stagger); the player swims away
  {
    const e = spawn(g, SP.PARA, 128, 50, 0);
    e.cool = Infinity;
    const h0 = g.stats.hunters, b0 = g.stats.bleed;
    const d = densest(g, e), s = shapeOf(g, e);
    let credit = null;
    const look = () => { credit = credit || evs(g, "devour", (v) => v.kind === "hunter")[0]; g.events.length = 0; };
    dashThrough(g, d.x, d.y, -s.uy, s.ux, { each: look });
    assert.notEqual(e.state, "stagger", "setup: the cut staggered it");
    const tCut = e.cutAt;
    frames(g, 6 * 60, { mx: 0, my: 1 }, () => { look(); return !credit && g.hunters.includes(e); });
    assert.ok(!g.hunters.includes(e), "setup: the cut Paraptera lived on for 6 s (no bleed-out to credit)");
    assert.ok(credit, "GAME BUG: a hunter that died within 6 s of a cut was not credited");
    assert.equal(credit.how, "bleed");
    assert.ok(g.time - tCut <= TUNE.killCredit, "credit came late");
    assert.equal(g.stats.hunters, h0 + 1); assert.equal(g.stats.bleed, b0 + 1);
    notes.push(`across cut: bled out ${(g.time - tCut).toFixed(2)} s later`);
  }
  // B and C: a light cut, then the body dies (wiped here) inside or outside the 6 s window
  for (const [late, label] of [[false, "dies 2 s after a cut"], [true, "dies 6.5 s after a cut"]]) {
    const e = spawn(g, SP.PENTA, 128, 50, 0);
    e.cool = Infinity;
    const s = shapeOf(g, e), tip = s.tips[1];
    dashThrough(g, tip.x, tip.y, -s.uy, s.ux); // across a wing tip
    assert.ok(g.hunters.includes(e) && e.cutAt >= 0 && e.state !== "stagger", `setup (${label}): the skim did not leave a live, cut hunter`);
    const tCut = e.cutAt, h0 = g.stats.hunters;
    P.x = 128; P.y = 110;
    frames(g, 600, {}, () => g.time - tCut < (late ? 6.5 : 2));
    assert.ok(g.hunters.includes(e), `setup (${label}): the hunter died on its own`);
    g.events.length = 0;
    g.wipe(g.world.B, g.labelB, e.blob);
    let credit = null, self = null;
    frames(g, 12, {}, () => { credit = credit || evs(g, "devour", (v) => v.kind === "hunter")[0]; self = self || evs(g, "selfDeath", (v) => v.id === e.id)[0]; g.events.length = 0; });
    assert.ok(!g.hunters.includes(e));
    if (late) { assert.ok(!credit && self, `${label}: credit ${!!credit}, selfDeath ${!!self}`); assert.equal(g.stats.hunters, h0); }
    else { assert.ok(credit && credit.how === "bleed", `${label}: not credited`); assert.equal(g.stats.hunters, h0 + 1); }
    notes.push(`${label}: ${late ? "not credited" : "credited"}`);
  }
  return notes.join("; ");
});

// thicken a hunter's blob until its mass passes k times its species mass; returns its mass and cells
function inflate(g, e, k) {
  const W = g.world, { w, h } = g, target = k * SPECIES[e.species].mass;
  for (let r = 0; r < 8; r++) {
    const { blobs, label } = findBlobs(W.B, w, h, 0.15, 16);
    const b = blobs.sort((p, q) => g.dist(p.x, p.y, e.x, e.y) - g.dist(q.x, q.y, e.x, e.y))[0];
    const cells = [];
    for (let i = 0; i < label.length; i++) if (label[i] === b.id) cells.push(i);
    if (b.mass >= target) return { mass: b.mass, cells };
    const set = new Set(cells);
    for (const i of cells) {
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = wrap(y + dy, h) * w + wrap(x + dx, w);
        if (!set.has(j)) W.B[j] = Math.max(W.B[j], 0.7);
      }
    }
  }
  throw new Error("setup: could not inflate the hunter");
}

test(14, "Rupture", () => {
  const g = setup(14);
  const P = g.player; P.x = 128; P.y = 120;
  const [e, ctl] = spawnMany(g, [{ sp: SP.PARA, x: 64, y: 50, angle: 0 }, { sp: SP.PARA, x: 192, y: 50, angle: 0 }]);
  e.cool = ctl.cool = Infinity;
  g.tear(e, 5, "cut", e.nx, e.ny); // a light cut: cutAt is now
  assert.ok(g.time - e.cutAt < 0.01);
  const { mass: m, cells } = inflate(g, e, 1.4), { mass: mc } = inflate(g, ctl, 1.4);
  const h0 = g.stats.hunters, r0 = g.stats.rupture;
  let rup = null, dev = null, ctlDev = null;
  frames(g, 6, {}, () => {
    rup = rup || evs(g, "rupture", (v) => v.id === e.id)[0];
    dev = dev || evs(g, "devour", (v) => v.kind === "hunter" && v.how === "rupture")[0];
    ctlDev = ctlDev || evs(g, "devour", (v) => v.kind === "hunter" && v.how !== "rupture")[0] || evs(g, "rupture", (v) => v.id === ctl.id && !v.fused)[0];
    g.events.length = 0;
  });
  assert.ok(rup, `no rupture (mass ${m.toFixed(0)} = ${(m / SPECIES[SP.PARA].mass).toFixed(2)}x)`);
  assert.ok(dev, "rupture not credited");
  assert.ok(!g.hunters.includes(e), "ruptured hunter still tracked");
  assert.equal(cells.filter((i) => g.world.B[i] > 0.15).length, 0, "ruptured tissue not wiped");
  assert.equal(g.stats.rupture, r0 + 1); assert.equal(g.stats.hunters, h0 + 1);
  assert.ok(!ctlDev, "the uncut, swollen control was credited");
  return `${(m / SPECIES[SP.PARA].mass).toFixed(2)}x within 3 s of a cut: ruptured and credited; uncut ${(mc / SPECIES[SP.PARA].mass).toFixed(2)}x: not credited`;
});

// ---------- 15-19: parry, Stasis and hit-stop ----------

function lancerInWindup(g, sp = SP.PARA, px = 125) {
  const P = g.player; P.x = px; P.y = 64;
  const e = spawn(g, sp, 100, 64, Math.PI / 2); // glides +x, toward the player
  e.token = true; g.beginWindup(e);
  return e;
}

test(15, "Parry", () => {
  const g = setup(15);
  const P = g.player;
  const e = lancerInWindup(g);
  frames(g, 200, {}, () => !(e.state === "lunge" && e.nd < 8));
  assert.equal(e.state, "lunge", "setup: never saw the lunge close in");
  P.charges = 1; P.chargeT = 99; // one charge, no refill during the test
  g.events.length = 0;
  tick(g, { mx: -1, my: 0, dash: true });
  const parry = evs(g, "parry", (v) => v.id === e.id)[0];
  assert.ok(parry, "no parry: " + g.events.map((v) => v.type).join(","));
  const stasisAt = g.stasisT;
  assert.ok(stasisAt > 1.4 && stasisAt <= TUNE.stasisLadder[0], "stasisT " + stasisAt);
  assert.equal(P.charges, 1, "charges after dash (-1) and parry (+1)");
  assert.equal(e.state, "stagger");
  assert.equal(e.lane, null);
  assert.equal(g.stats.parries, 1);
  g.events.length = 0;
  let after = [];
  frames(g, 40, {}, () => { after.push(...g.events.filter((v) => v.id === e.id && ["lunge", "recover", "lungeHit"].includes(v.type)).map((v) => v.type)); g.events.length = 0; });
  assert.deepEqual(after, [], "the lunge went on after the parry");
  return `stasisT ${stasisAt.toFixed(2)} at parry, charges 0 -> 1`;
});

test(16, "Glint parry window", () => {
  // The player waits 2 cells from the lancer's front and dashes straight away, so its disc
  // touches the tissue only on the first dash frame: the result depends on timing alone.
  const out = {};
  for (const [label, at] of [["early", 0.3], ["glint", 0.15]]) {
    const g = setup(16);
    const P = g.player;
    const e = lancerInWindup(g, SP.PENTA, 140);
    let left = null, touched = false, parried = false, f = 0;
    while (f++ < 200) {
      if (left === null) {
        P.x = wrap(e.nx + 2, g.w); P.y = e.ny; P.vx = P.vy = 0;
        if (e.state === "windup" && g.windupLeft(e) <= at) {
          left = g.windupLeft(e);
          tick(g, { mx: 1, my: 0, dash: true });
          touched = g.ownerAt(P.x, P.y, P.r + 2) === e;
        } else tick(g, {});
      } else tick(g, { mx: 1, my: 0 });
      if (evs(g, "parry", (v) => v.id === e.id).length) parried = true;
      g.events.length = 0;
      if (left !== null && P.dashT <= 0 && g.hitstop <= 0) break;
    }
    assert.ok(left !== null, `setup (${label}): never reached ${at} s before the lunge`);
    assert.ok(touched, `setup (${label}): the dash never touched the hunter`);
    out[label] = { left, parried };
  }
  assert.equal(out.early.parried, false, `parried ${out.early.left.toFixed(2)} s before the lunge`);
  assert.equal(out.glint.parried, true, `no parry ${out.glint.left.toFixed(2)} s before the lunge`);
  return `${out.early.left.toFixed(2)} s: no parry; ${out.glint.left.toFixed(2)} s: parry`;
});

test(17, "Stasis clock", () => {
  const run = (stasis) => {
    const g = setup(17);
    if (stasis) g.stasisT = 10;
    const s0 = g.steps, h0 = g.stats.loss.hunger;
    frames(g, 120, {});
    return { steps: g.steps - s0, hunger: g.stats.loss.hunger - h0, rate: g.simRate(), hungerPerSec: g.hunger() };
  };
  const on = run(true), off = run(false);
  const want = TUNE.stasisScale * on.rate * 2;
  assert.ok(Math.abs(on.steps - want) <= 0.1 * want, `${on.steps} steps in 2 s of Stasis, want ${want.toFixed(1)}`);
  assert.ok(Math.abs(off.steps - on.rate * 2) <= 1, `${off.steps} steps in 2 s without Stasis`);
  assert.ok(Math.abs(on.hunger - TUNE.stasisHunger * on.hungerPerSec * 2) < 0.02, `hunger ${on.hunger.toFixed(3)} in Stasis`);
  assert.ok(Math.abs(on.hunger / off.hunger - TUNE.stasisHunger) < 0.01, `hunger ratio ${(on.hunger / off.hunger).toFixed(3)}`);
  return `${on.steps} vs ${off.steps} steps in 2 s; hunger ${on.hunger.toFixed(2)} vs ${off.hunger.toFixed(2)}`;
});

test(18, "Hit-stop cap", () => {
  const g = setup(18);
  let granted = 0, frozenFrames = 0, maxSteps = 0, accBroken = 0;
  const c0 = g.clock, t0 = g.time;
  for (let f = 0; f < 60; f++) {
    if (f % 6 === 0) granted += g.freeze(0.1, "cut");
    const acc = g.simAcc, time = g.time, steps = g.steps;
    tick(g, {});
    if (g.time === time) { frozenFrames++; if (g.simAcc !== acc || g.steps !== steps) accBroken++; }
    maxSteps = Math.max(maxSteps, g.steps - steps);
  }
  const frozen = (g.clock - c0) - (g.time - t0);
  assert.ok(granted <= TUNE.freezeCap + 1e-9, `granted ${granted.toFixed(3)} s of freeze in 1 s`);
  assert.ok(frozen <= TUNE.freezeCap + DT + 1e-9, `froze ${frozen.toFixed(3)} s in 1 s`);
  assert.equal(accBroken, 0, "sim time built up during a freeze");
  assert.ok(maxSteps <= 3, `${maxSteps} steps in one frame after a freeze`);
  return `granted ${granted.toFixed(2)} s, ${frozenFrames} frozen frames, max ${maxSteps} step/frame`;
});

test(19, "Freeze skip", () => {
  const g = setup(19);
  const P = g.player; P.x = 110; P.y = 110;
  const [A, B] = spawnMany(g, [{ sp: SP.PENTA, x: 80, y: 64, angle: 0 }, { sp: SP.PARA, x: 140, y: 64, angle: 0 }]);
  A.cool = B.cool = Infinity;
  // A's tissue nearest to B: the cut goes across that wing
  const wing = () => { let best = null, bd = Infinity; for (const i of cellsOf(g, A)) { const x = i % g.w, y = (i / g.w) | 0, dd = g.dist(x, y, B.x, B.y); if (dd < bd && g.world.B[i] > 0.5) { bd = dd; best = { x, y }; } } return best; };
  const cutA = () => {
    const d = wing(), s = shapeOf(g, A);
    let maxStop = 0, hits = 0;
    A.tear = 0;
    dashThrough(g, d.x, d.y, -s.uy, s.ux, { each: () => { maxStop = Math.max(maxStop, g.hitstop); hits += evs(g, "tissueHit", (v) => v.id === A.id).length; g.events.length = 0; } });
    return { maxStop, hits };
  };
  // control: no windup nearby, so the cut freezes
  const ctl = cutA();
  assert.ok(ctl.hits > 0 && ctl.maxStop > 0, `setup: control cut froze ${ctl.maxStop}`);
  frames(g, 70, {});
  // B winds up near the player (held in its windup)
  Object.assign(B, { state: "windup", windupTotal: 400, steps: 400, stateAt: g.time, token: true, glinted: false, lane: null });
  P.charges = g.maxCharges();
  const d = wing();
  P.x = d.x; P.y = d.y; stepOnce(g);
  assert.ok(B.nd < 30, `setup: windup hunter is ${B.nd.toFixed(1)} cells away`);
  const cut = cutA();
  assert.equal(B.state, "windup", "setup: B left its windup");
  assert.ok(cut.hits > 0, "setup: the cut missed");
  assert.equal(cut.maxStop, 0, `cut froze ${cut.maxStop.toFixed(3)} s with a windup ${B.nd.toFixed(0)} cells away`);
  frames(g, 70, {});
  P.x = d.x; P.y = d.y; P.vx = P.vy = 0; stepOnce(g);
  assert.ok(B.state === "windup" && B.nd < 30, `setup: B ${B.state} ${B.nd.toFixed(1)} cells away at the parry`);
  g.parry(A);
  assert.ok(Math.abs(g.hitstop - 0.04) < 1e-9, `parry freeze ${g.hitstop.toFixed(3)} s`);
  return `control cut froze ${ctl.maxStop.toFixed(2)} s; with windup 0; parry ${g.hitstop.toFixed(2)} s`;
});

// ---------- 20-21: persistence and the budget ----------

test(20, "Persistence", () => {
  const notes = [], fails = [];
  for (const seed of [7, 11]) {
    const g = new Game(256, 128, seed);
    g.reset("play"); g.epoch = 4;
    g.qa = { immortal: true, holdEpoch: false };
    g.growHold = true;
    const first = [];
    let purge = false, tides = 0;
    const s0 = g.steps;
    while (g.steps - s0 < 1200) {
      if (g.epochTime > 38) g.epochTime = 38; // stay in epoch IV (all three waves are out by 28 s)
      tick(g, dodger(g));
      if (g.world.purge.B) purge = true;
      for (const e of g.hunters) if (e.species !== undefined && !e.egg && first.length < 4 && !first.includes(e)) first.push(e);
      tides += evs(g, "tide").length;
      g.events.length = 0;
    }
    const alive = first.filter((e) => g.hunters.includes(e)).length;
    notes.push(`seed ${seed}: purge ${purge}, ${alive}/4 alive`);
    if (purge || alive < 3) fails.push(`seed ${seed}: purge ${purge}, tides ${tides}, first four ${first.map((e) => `${NAME[e.species]}#${e.id}${g.hunters.includes(e) ? "" : " dead"}`).join(", ")}`);
  }
  assert.equal(fails.length, 0, "GAME BUG: hunters did not persist: " + fails.join("; "));
  return notes.join("; ");
});

test(21, "Budget", () => {
  const B = TUNE.budget;
  const expect = (g) => {
    let s = 0;
    for (const e of g.hunters) s += e.species !== undefined ? SPECIES[e.species].mass * (e.boss ? B.bossK : B.k) : e.brood ? (e.baseMass || 150) * B.k : 0;
    for (const p of g.pending) if (p.kind === "hunter") s += SPECIES[p.species].mass * (p.boss ? B.bossK : B.k);
    return Math.min(B.cap, s + B.pad) * Math.min(1, g.area * 1.4);
  };
  const rosters = [
    [],
    [{ species: SP.PARA }],
    [{ species: SP.PARA }, { species: SP.PENTA }, { species: SP.HEXA }, { species: SP.HEPTA, boss: true }],
    [{ brood: true, baseMass: 200 }, { species: SP.EGG, egg: true }, { species: SP.DISC }],
    Array.from({ length: 8 }, () => ({ species: SP.HEXA })),
  ];
  let checked = 0;
  for (const [w, h] of [[256, 128], [128, 128]]) for (const r of rosters) {
    const g = setup(21, { w, h });
    g.hunters.push(...r.map((e, i) => ({ id: 1000 + i, x: 0, y: 0, ...e })));
    g.pending.push({ kind: "hunter", species: SP.DISC, boss: false, x: 0, y: 0, t: 99 }, { kind: "prey", x: 0, y: 0, t: 99 });
    const want = expect(g), got = g.hunterBudget();
    assert.ok(Math.abs(got - want) < 1e-9, `${w}x${h} roster ${JSON.stringify(r)}: budget ${got} vs ${want}`);
    assert.ok(got <= B.cap + 1e-9);
    g.simAcc = -10; // no sim step, so the fake roster is not re-tracked this frame
    tick(g, {});
    assert.ok(Math.abs(g.world.limit.B - (got * 1.6 + 300)) < 1e-9, `limit.B ${g.world.limit.B} vs budget ${got}`);
    checked++;
  }
  const g = setup(21);
  g.hunters.push(...rosters[4].map((e, i) => ({ id: i, ...e })));
  assert.equal(g.hunterBudget(), B.cap, "the cap");
  return `${checked} rosters; limit.B = budget x 1.6 + 300 in play`;
});

// ---------- 22-25: Burst, meter, eggs ----------

test(22, "Burst", () => {
  const g = setup(22);
  const P = g.player; P.x = 128; P.y = 64;
  const [d1, d2, para, egg1, egg2] = spawnMany(g, [
    { sp: SP.DISC, x: 109, y: 70 }, { sp: SP.DISC, x: 147, y: 70 },
    { sp: SP.PARA, x: 128, y: 44, angle: Math.PI },
    { sp: SP.EGG, x: 128, y: 84, angle: 0 }, { sp: SP.EGG, x: 152, y: 94, angle: 0 },
  ]);
  for (const e of [d1, d2, para]) assert.ok(e.nd <= 12, `setup: ${NAME[e.species]} tissue ${e.nd.toFixed(1)} cells away`);
  assert.ok(egg1.nd <= TUNE.burst.catch, `setup: near egg ${egg1.nd.toFixed(1)}`);
  assert.ok(egg2.nd > TUNE.burst.r + 4, `setup: far egg ${egg2.nd.toFixed(1)}`);
  const farCells = cellsOf(g, egg2), farVals = farCells.map((i) => g.world.B[i]);
  g.meter = 1; g.ready = true; g.simAcc = 0; g.events.length = 0;
  tick(g, { burst: true });
  const burst = evs(g, "burst")[0];
  assert.ok(burst, "no burst");
  assert.equal(burst.caught, 3, "caught " + burst.caught);
  // each hunter the blast devours adds TUNE.burst.perKill to the hunt
  const blastKills = evs(g, "devour", (v) => v.kind === "hunter" && v.how === "burst").length;
  const hunt = TUNE.burst.time + TUNE.burst.perKill * blastKills;
  assert.ok(g.burstT <= hunt && g.burstT >= hunt - 2 * DT, `burstT ${g.burstT} with ${blastKills} blast kills`);
  assert.ok(evs(g, "pop", (v) => v.id === egg1.id).length === 1 && !g.hunters.includes(egg1), "near egg not popped");
  assert.ok(g.hunters.includes(egg2), "far egg gone");
  assert.equal(farCells.filter((i, k) => g.world.B[i] !== farVals[k]).length, 0, "far egg cells changed");
  assert.ok(para.state === "stagger" || !g.hunters.includes(para), "Paraptera state " + para.state);
  // follow both Discutium until each is credited (or the 6 s kill-credit window runs out)
  const credited = new Map(), s0 = g.steps, t0 = g.time;
  frames(g, 8 * 60, {}, () => {
    for (const v of evs(g, "devour", (x) => x.kind === "hunter" && x.species === SP.DISC)) for (const d of [d1, d2]) if (!credited.has(d) && !g.hunters.includes(d)) credited.set(d, { steps: g.steps - s0, how: v.how });
    g.events.length = 0;
    return credited.size < 2 && g.time - t0 < TUNE.killCredit;
  });
  const info = [d1, d2].map((d) => credited.has(d) ? `${credited.get(d).how} after ${credited.get(d).steps} steps` : g.hunters.includes(d) ? `alive (mass ${d.mass.toFixed(0)}, ${d.state})` : "gone uncredited").join("; ");
  assert.equal(credited.size, 2, "Discutium not credited within 6 s: " + info);
  assert.ok([...credited.values()].every((c) => c.steps <= 20), "SUSPECTED GAME BUG (balance): caught Discutium are not dead within 20 steps of the Burst (the r20 drain is weak at 11 cells; they swell, then bleed out): " + info);
  return `caught 3, near egg popped, far egg untouched; Discutium ${info}`;
});

test(23, "Burst meter sources", () => {
  const g = setup(23);
  g.preyCd = 0; // the game's own prey spawner keeps the dish stocked
  const P = g.player;
  let meterSeen = 0, f = 0;
  while (g.stats.prey < 10 && f++ < 6000) {
    let best = null, bd = Infinity;
    for (const p of g.prey) { const d = g.dist(P.x, P.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
    tick(g, best ? { target: { x: P.x + wdelta(best.x - P.x, g.w), y: P.y + wdelta(best.y - P.y, g.h) } } : {});
    meterSeen = Math.max(meterSeen, g.meter);
    g.events.length = 0;
  }
  assert.equal(g.stats.prey, 10, "setup: ate " + g.stats.prey);
  assert.equal(g.stats.golden, 0, "setup: a golden prey slipped in");
  assert.equal(meterSeen, 0, "eating prey moved the Burst meter to " + meterSeen);
  g.preyCd = Infinity;
  const e = spawn(g, SP.PARA, wrap(P.x + 60, g.w), P.y, 0);
  e.cool = Infinity;
  g.stagger(e, "tear");
  const m0 = g.meter;
  let dev = null;
  frames(g, 60, {}, () => { const d = densest(g, e); dev = dev || evs(g, "devour", (v) => v.kind === "hunter")[0]; g.events.length = 0; if (dev) return false; mouthOn(g, d.x, d.y); });
  assert.ok(dev && dev.how === "glory", "setup: no Glory Bite");
  assert.ok(Math.abs(g.meter - m0 - TUNE.meter.glory) < 1e-9, `Glory Bite meter +${(g.meter - m0).toFixed(3)}`);
  return `10 prey: meter 0; Glory Bite +${(g.meter - m0).toFixed(2)}`;
});

test(24, "Eggs", () => {
  // two Circium 24 cells apart in a bare dish
  const W = new World(64, 64, GAME_RULES), rows = SPECIES[SP.EGG].rows;
  W.stamp(W.B, rows, 20, 32, 0, SCALE); W.stamp(W.B, rows, 44, 32, 0, SCALE);
  for (let s = 0; s < 600; s++) W.step();
  const blobs = findBlobs(W.B, 64, 64, 0.15, 4).blobs;
  assert.equal(blobs.length, 2, "eggs " + blobs.length);
  for (const b of blobs) assert.ok(Math.abs(b.mass - SPECIES[SP.EGG].mass) <= 0.1 * SPECIES[SP.EGG].mass, "egg mass " + b.mass.toFixed(1));
  // one egg in play: crack 0.6 s before it hatches 8 s after it appears, into exactly one Discutium
  const g = setup(24);
  const P = g.player; P.x = 200; P.y = 100;
  const egg = spawn(g, SP.EGG, 80, 50, 0);
  let crack = null, hatch = null;
  frames(g, 12 * 60, {}, () => {
    if (evs(g, "crack", (v) => v.id === egg.id).length) crack = g.time;
    if (evs(g, "hatch", (v) => v.id === egg.id).length) hatch = g.time;
    g.events.length = 0;
    return !hatch;
  });
  assert.ok(hatch, "no hatch");
  assert.ok(Math.abs(hatch - egg.born - TUNE.egg.hatch) < 0.05, `hatched ${(hatch - egg.born).toFixed(2)} s after it appeared`);
  assert.ok(crack && Math.abs(hatch - crack - TUNE.egg.crack) < 0.05, `cracked ${crack && (hatch - crack).toFixed(2)} s before`);
  frames(g, 60, {});
  const discs = g.hunters.filter((e) => e.species === SP.DISC);
  assert.equal(discs.length, 1, "Discutium after hatch " + discs.length);
  assert.equal(g.hunters.filter((e) => e.egg).length, 0);
  assert.equal(findBlobs(g.world.B, g.w, g.h, 0.15, 16).blobs.length, 1, "hunter blobs after hatch");
  return `2 eggs live 600 steps; hatch at ${(hatch - egg.born).toFixed(2)} s into 1 Discutium`;
});

test(25, "Egg scoring", () => {
  const g = setup(25);
  const P = g.player; P.x = 200; P.y = 100;
  const egg = spawn(g, SP.EGG, 80, 50, 0);
  g.combo = 4; g.comboTimer = TUNE.comboWindow;
  const s0 = g.score, m0 = g.meter, cells = cellsOf(g, egg);
  let pop = null;
  g.events.length = 0;
  dashThrough(g, egg.x, egg.y, 1, 0, { each: () => { pop = pop || evs(g, "pop", (v) => v.id === egg.id)[0]; g.events.length = 0; } });
  assert.ok(pop, "no pop");
  const mult = Math.min(8, 1 + Math.floor(5 / 2));
  assert.equal(pop.points, 50 * mult);
  assert.equal(g.score - s0, 50 * mult, "score rose by " + (g.score - s0));
  assert.equal(g.stats.eggs, 1);
  assert.ok(Math.abs(g.meter - m0 - TUNE.meter.pop) < 1e-9, "meter +" + (g.meter - m0));
  assert.ok(!g.hunters.includes(egg));
  assert.equal(cells.filter((i) => g.world.B[i] > 0).length, 0, "egg tissue left");
  return `pop +${pop.points} at x${mult}`;
});

// ---------- 26: the Leviathan ----------

test(26, "Leviathan phases", () => {
  const g = setup(26);
  const P = g.player; P.x = 128; P.y = 100;
  const boss = spawn(g, SP.HEPTA, 128, 36, undefined, { boss: true });
  assert.ok(boss.boss && boss.phase === 1, "setup: not a phase-1 boss");
  let purge = false, lost = null;
  const t0 = g.time;
  frames(g, 80 * 60, () => dodger(g), () => {
    if (g.world.purge.B) purge = true;
    if (!g.hunters.includes(boss)) { lost = g.events.map((v) => v.type).join(","); return false; }
    g.events.length = 0;
    return g.time - t0 < 60;
  });
  const kept = g.time - t0;
  assert.ok(!lost, "the Leviathan was lost during play: " + lost);
  assert.ok(!purge, "the dish purged with the Leviathan out");
  const phases = [];
  for (let k = 0; k < 3; k++) {
    frames(g, 50, {}); // past the 0.5 s gate guard
    g.events.length = 0;
    g.tear(boss, 0.21 * SPECIES[SP.HEPTA].mass, "cut", boss.nx, boss.ny);
    phases.push(boss.state === "collapse" ? "collapse" : boss.phase);
    assert.ok(g.hunters.includes(boss), "boss lost at gate " + (k + 1));
  }
  assert.deepEqual(phases, [2, 3, "collapse"]);
  frames(g, 3, {});
  const h0 = g.stats.hunters;
  let dev = null;
  frames(g, 60, {}, () => { dev = dev || evs(g, "devour", (v) => v.kind === "hunter" && v.boss)[0]; g.events.length = 0; if (dev) return false; const d = densest(g, boss); mouthOn(g, d.x, d.y); });
  assert.ok(dev && dev.how === "glory", "no Glory Bite in collapse");
  assert.equal(g.stats.hunters, h0 + 1);
  assert.ok(g.ready && g.meter === 1 && g.duoNext, "boss rewards: meter, ready, Duo next");
  return `kept ${kept.toFixed(0)} s; phases ${phases.join(" -> ")}; glory`;
});

// ---------- 27-28: waves and caps ----------

function capsWatch(g, caps) {
  const worst = { gliders: 0, swarm: 0, eggs: 0, bodies: 0 }, over = [];
  return {
    check() {
      const c = census(g);
      for (const k of Object.keys(worst)) worst[k] = Math.max(worst[k], c[k]);
      if (c.gliders > caps.gliders || c.swarm > caps.swarm || c.eggs > caps.eggs || c.bodies > caps.bodies) over.push(`${g.epochTime.toFixed(1)}s ${JSON.stringify(c)}`);
    },
    worst, over,
  };
}

test(27, "Wave table", () => {
  const g = new Game(256, 128, 27);
  g.reset("play");
  g.qa = { immortal: true, holdEpoch: false };
  g.growHold = true;
  const P = g.player, caps = capsWatch(g, TUNE.caps.desktop), waves = [], warns = [], cleared = [], falseClear = [];
  while (g.epochTime < 39.5 && g.state === "play") {
    tick(g, {});
    for (const v of g.events) {
      if (v.type === "wave") waves.push({ at: g.epochTime, units: v.units });
      if (v.type === "warn") warns.push({ d: g.dist(v.x, v.y, P.x, P.y), name: v.name });
      if (v.type === "waveClear") {
        cleared.push(g.epochTime);
        // a wave is clear only when all its units are dead: none tracked, pending, queued or just stamped
        const key = g.waveKey(v.wave - 1);
        const live = g.hunters.filter((e) => e.wave === key).length + g.claims.filter((c) => c.kind === "hunter" && c.tags.wave === key).length;
        if (live) falseClear.push(`wave ${v.wave} at ${g.epochTime.toFixed(2)} s with ${live} unit(s) alive`);
      }
    }
    g.events.length = 0;
    caps.check();
  }
  assert.deepEqual(waves.map((w) => w.units), WAVES[1].map((w) => w.units));
  assert.equal(falseClear.length, 0, "GAME BUG: wave cleared while its units live (a just-stamped unit is only a claim, which the Director does not count): " + falseClear.join("; ") + `; waves at ${waves.map((w) => w.at.toFixed(1)).join(", ")} s`);
  waves.forEach((w, k) => {
    const early = cleared.some((c) => c < w.at) && w.at < WAVES[1][k].at;
    if (!early) assert.ok(Math.abs(w.at - WAVES[1][k].at) <= 2 * DT, `wave ${k + 1} at ${w.at.toFixed(2)} s, table says ${WAVES[1][k].at}`);
  });
  for (const w of warns) assert.ok(w.d >= TUNE.spawn.min - 1 && w.d <= TUNE.spawn.max + 1, `${w.name} warned ${w.d.toFixed(1)} cells from the player`);
  assert.equal(caps.over.length, 0, "GAME BUG: caps exceeded: " + caps.over.slice(0, 3).join("; "));
  return `waves ${waves.map((w) => `${w.units}@${w.at.toFixed(1)}`).join(" ")}; max ${JSON.stringify(caps.worst)}`;
});

test(28, "Portrait caps", () => {
  const g = new Game(128, 256, 28, { touch: true });
  g.reset("play"); g.epoch = 5;
  g.qa = { immortal: true, holdEpoch: false };
  g.growHold = true;
  assert.ok(g.compact);
  const caps = capsWatch(g, TUNE.caps.compact);
  // a dodging player keeps the spawn arc behind it moving, so the waves land
  while (g.epochTime < 39.5 && g.state === "play") { tick(g, dodger(g)); g.events.length = 0; caps.check(); }
  assert.equal(caps.over.length, 0, "GAME BUG: caps exceeded: " + caps.over.slice(0, 3).join("; "));
  return "max " + JSON.stringify(caps.worst);
});

// ---------- 29-31: procs, cards, eggs never move ----------

test(29, "Procs", () => {
  // Nerve Net jumps from three quick cuts on a Hexapteryx to the two Discutium beside it, with
  // Spore Burst and Chain Bloom on: six proc drains are asked for within a second. The stagger
  // threshold is switched off here so every dash cuts instead of ending in a Glory Bite.
  const keep = TUNE.stagger;
  TUNE.stagger = Infinity;
  try {
    const g = setup(29);
    const P = g.player; P.x = 200; P.y = 64;
    Object.assign(g.mut, { sporeburst: 2, nerve: 2, chainbloom: 1, flagellum: 1 });
    const [hexa] = spawnMany(g, [{ sp: SP.HEXA, x: 128, y: 50, angle: 0 }, { sp: SP.DISC, x: 128, y: 84 }, { sp: SP.DISC, x: 128, y: 14 }]);
    for (const e of g.hunters) e.cool = Infinity;
    const drains = [], tries = [];
    const orig = g.drainCredit.bind(g), ok = g.procOk.bind(g);
    g.drainCredit = (x, y, r, rate, src) => { if (src === "proc") drains.push({ t: g.time, depth: g.procDepth || 0 }); return orig(x, y, r, rate, src); };
    g.procOk = () => { const v = ok(); tries.push({ t: g.time, v }); return v; };
    P.charges = 3;
    const t0 = g.time;
    for (let k = 0; k < 3; k++) {
      // cut across the biggest body left (the Hexapteryx first)
      const e = g.hunters.filter((o) => !o.egg).sort((a, b) => b.mass - a.mass)[0];
      if (!e) break;
      const d = densest(g, e), s = shapeOf(g, e), off = e === hexa ? (k - 1) * 6 : 0;
      dashThrough(g, d.x + s.ux * off, d.y + s.uy * off, -s.uy, s.ux);
    }
    const tDash = g.time - t0;
    // how many procs the cuts set off depends on how the bodies split; top up to six in the last second
    const recent = () => tries.filter((t) => g.time - t.t < 1).length;
    for (let k = 0; k < 6 && recent() < 6; k++) { const e = g.hunters.find((o) => !o.egg); if (e) g.procSpore(e.x, e.y, 0); }
    frames(g, 120, {});
    assert.ok(tries.length >= 5, `setup: only ${tries.length} procs asked for`);
    for (const d of drains) {
      const n = drains.filter((o) => o.t <= d.t && o.t > d.t - 1).length;
      assert.ok(n <= 4, `${n} proc drains within 1 s`);
    }
    const depth = Math.max(...drains.map((d) => d.depth));
    assert.ok(depth <= 2, "chain depth " + (depth + 1));
    return `${tries.length} procs asked for in ${tDash.toFixed(2)} s of cuts, ${drains.length} drained, ${tries.filter((t) => !t.v).length} refused; deepest link ${depth + 1}`;
  } finally { TUNE.stagger = keep; }
});

test(30, "Cards", () => {
  const g = setup(30), rnd = mulberry32(30);
  let duos = 0, full = 0;
  for (let k = 0; k < 50; k++) {
    for (const m of MUTATIONS) g.mut[m.id] = Math.floor(rnd() * (m.max + 1));
    g.duoNext = rnd() < 0.3;
    const duoNext = g.duoNext;
    const open = MUTATIONS.filter((m) => g.mut[m.id] < m.max && (m.kind !== "duo" || m.parents.every((p) => g.mut[p] > 0)));
    const offer = g.makeOffer(), ids = offer.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate card " + ids);
    for (const m of offer) {
      assert.ok(g.mut[m.id] < m.max, `${m.id} offered at max`);
      if (m.kind === "duo") assert.ok(m.parents.every((p) => g.mut[p] > 0), `${m.id} offered without ${m.parents}`);
    }
    const builds = open.filter((m) => m.kind === "build").length;
    assert.ok(offer.filter((m) => m.kind === "build").length >= Math.min(2, builds), `offer ${ids} has too few build cards (${builds} open)`);
    assert.equal(offer.length, Math.min(3, open.length), `offer ${ids} of ${open.length} open`);
    if (duoNext && open.some((m) => m.kind === "duo")) assert.ok(offer.some((m) => m.kind === "duo"), "no Duo after a Leviathan kill");
    duos += offer.some((m) => m.kind === "duo"); full += offer.length === 3;
  }
  assert.ok(duos > 0 && duos < 50, "Duo offers " + duos);
  return `50 offers, ${duos} with a Duo, ${full} full`;
});

// One run near an egg: separation, then a cut with its kick, then a Burst push. Returns what touched the egg.
function eggRun(seed, { start, cut, blast = 12 }) {
  const g = setup(seed);
  const P = g.player; P.x = 200; P.y = 64;
  // a Paraptera gliding toward the egg from `start` cells away (the separation room is 39), and a
  // Discutium passing above; the player waits on the far side of the egg
  const [egg, para, disc] = spawnMany(g, [
    { sp: SP.EGG, x: 150, y: 64, angle: 0 },
    { sp: SP.PARA, x: 150 - start, y: 64, angle: Math.PI / 2 },
    { sp: SP.DISC, x: 150, y: 24, angle: Math.PI },
  ]);
  para.cool = disc.cool = Infinity;
  const W = g.world, eggCells = cellsOf(g, egg), m0 = egg.mass, c0 = { x: egg.x, y: egg.y };
  let phase = "separation";
  const touches = [], done = [];
  const hit = (cx, cy, r) => eggCells.some((i) => Math.hypot(wdelta((i % g.w) - cx, g.w), wdelta(((i / g.w) | 0) - cy, g.h)) < r);
  for (const m of ["advect", "roll", "rollMany"]) {
    const o = W[m].bind(W);
    W[m] = (...a) => { if (g.hunters.includes(egg) && hit(a[1], a[2], a[3])) touches.push(`${m} r${(+a[3]).toFixed(1)} at ${(+a[1]).toFixed(0)},${(+a[2]).toFixed(0)} (${g.dist(a[1], a[2], c0.x, c0.y).toFixed(1)} from the egg) during ${phase}`); return o(...a); };
  }
  const alive = () => g.hunters.includes(egg);
  frames(g, 90, {}, alive);
  done.push(`separation to ${g.dist(para.x, para.y, egg.x, egg.y).toFixed(0)} cells`);
  // a cut toward the egg: across the lower wing tip (light) or straight through the band
  phase = "cut kick";
  if (alive() && g.hunters.includes(para)) {
    const s = shapeOf(g, para), tip = s.tips[0].y > s.tips[1].y ? s.tips[0] : s.tips[1], d = densest(g, para);
    if (cut === "tip") dashThrough(g, tip.x, tip.y, 1, 0, { after: 20 }); else dashThrough(g, d.x, d.y, 1, 0, { after: 20 });
    if (P.kicked.has(para.id)) done.push("kick");
  }
  // a Burst from the side away from the egg: `blast` cells from the Paraptera's tissue, so it is
  // caught (12) or only pushed (22); either way the push points at the egg
  phase = "burst";
  if (alive() && g.hunters.includes(para)) {
    // walk the player out along -x until the Paraptera's nearest tissue is `blast` cells away
    P.x = wrap(para.nx - blast, g.w); P.y = para.ny;
    for (let k = 0; k < 6; k++) { P.vx = P.vy = 0; stepOnce(g); if (Math.abs(para.nd - blast) <= 1.5) break; P.x = wrap(P.x - (blast - para.nd), g.w); }
    P.vx = P.vy = 0;
    g.meter = 1; g.ready = true; g.events.length = 0;
    const nd = para.nd;
    tick(g, { burst: true });
    const b = evs(g, "burst")[0];
    if (b && nd <= TUNE.burst.push) done.push(`burst ${b.caught ? "caught" : "pushed"} it from ${nd.toFixed(0)} cells (egg ${egg.nd.toFixed(0)} cells from the player)`);
    stepOnce(g); // the Burst's knockback moves bodies on the next sim step
  }
  phase = "after";
  frames(g, 120, {}, alive);
  assert.ok(g.time - egg.born < TUNE.egg.hatch, "setup: the egg reached its hatch time");
  return { touches, done, alive: alive(), m0, m1: egg.mass, drift: g.dist(egg.x, egg.y, c0.x, c0.y) };
}

test(31, "Never move eggs", () => {
  const runs = [
    ["light tip cut, Burst catch", { start: 44, cut: "tip", blast: 12 }],
    ["cut through the band, Burst catch", { start: 42, cut: "band", blast: 12 }],
    ["cut through the band, Burst push", { start: 42, cut: "band", blast: 22 }],
  ].map(([label, opts]) => ({ label, ...eggRun(31, opts) }));
  for (const r of runs) assert.equal(r.done.length, 3, `setup (${r.label}): not every phase ran: ${r.done.join(", ")}`);
  const bad = runs.filter((r) => r.touches.length || !r.alive || r.drift >= 1 || Math.abs(r.m1 - r.m0) >= 0.1 * r.m0);
  assert.equal(bad.length, 0, "GAME BUG: another body's move swept over the egg. " + bad.map((r) => `${r.label}: ${r.touches.length} moves, first ${r.touches[0]}; egg ${r.alive ? "alive" : "destroyed"}, mass ${r.m0.toFixed(0)} -> ${r.m1.toFixed(0)}, drift ${r.drift.toFixed(1)} [${r.done.join(", ")}]`).join(" | "));
  return runs.map((r) => `${r.label}: untouched`).join("; ");
});

// ---------- extra: found while writing 20 and 27 ----------

test(32, "Eggs waiting on a full glider cap hatch one per free slot", () => {
  const g = setup(32);
  const P = g.player; P.x = 128; P.y = 64;
  // four Discutium (the desktop glider cap) gliding side by side along +x, three eggs below them
  const bodies = spawnMany(g, [
    ...[32, 96, 160, 224].map((x) => ({ sp: SP.DISC, x, y: 24, angle: Math.PI / 2 })),
    ...[64, 128, 192].map((x) => ({ sp: SP.EGG, x, y: 100, angle: 0 })),
  ]);
  P.alive = false; // no chase: the bodies keep their spacing
  const discs = bodies.slice(0, 4), eggs = bodies.slice(4);
  let hatches = 0;
  frames(g, 12 * 60, {}, () => { hatches += evs(g, "hatch").length; g.events.length = 0; return g.time - eggs[0].born < TUNE.egg.hatch + 0.5; });
  assert.equal(hatches, 0, "setup: an egg hatched while the glider cap was full");
  assert.equal(eggs.filter((e) => g.hunters.includes(e)).length, 3, "setup: an egg is gone");
  // one Discutium dies: one slot frees
  g.wipe(g.world.B, g.labelB, discs[0].blob);
  let worst = 0;
  frames(g, 90, {}, () => { hatches += evs(g, "hatch").length; g.events.length = 0; worst = Math.max(worst, census(g).gliders); });
  assert.ok(!g.hunters.includes(discs[0]), "setup: the wiped Discutium is still tracked");
  assert.equal(hatches, 1, `GAME BUG: ${hatches} eggs hatched into one free glider slot (capRoom() does not count just-stamped claims); gliders peaked at ${worst}, cap ${TUNE.caps.desktop.gliders}`);
  assert.ok(worst <= TUNE.caps.desktop.gliders, `gliders peaked at ${worst}`);
  return "one hatch per free slot";
});

test(33, "A Burst does not refill its own meter", () => {
  // economy table: a Burst catch gives 0 meter, and nothing fills the meter while Burst runs
  const g = setup(33);
  const P = g.player; P.x = 128; P.y = 64;
  const [para] = spawnMany(g, [{ sp: SP.PARA, x: 128, y: 44, angle: Math.PI }]);
  para.cool = Infinity;
  assert.ok(para.nd <= TUNE.burst.catch, "setup: tissue " + para.nd.toFixed(1));
  g.meter = 1; g.ready = true; g.events.length = 0;
  tick(g, { burst: true });
  assert.equal(evs(g, "burst")[0]?.caught, 1, "setup: the Burst caught nothing");
  assert.equal(g.meter, 0, `GAME BUG: the meter reads ${g.meter.toFixed(3)} right after the Burst (startBurst() tears the caught hunters through tear(), which adds 0.4 x frac before burstT is set)`);
  return "meter 0 after the Burst";
});

console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
