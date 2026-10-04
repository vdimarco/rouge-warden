// Primordia "Eat to grow" rules against the real Lenia dish: growth design section 10, tests 1-16,
// adapted to the build, plus rules found while writing them (17) and the spec's "No timer" scenario (18).
// Usage: node qa/primordia/growth.test.mjs [test numbers...]   e.g. `node qa/primordia/growth.test.mjs 4 8`
// The build has no torus roll: the old dish shrinks about its own centre (x' = w/4 + x/2), so the player
// keeps their spot in the old dish (test 7) instead of moving to the grid centre.
// Same harness as combat.test.mjs: every test seeds its Game and drives it with update(1/60, input).
// setup() holds growth (growHold) as combat.test.mjs does; a test that grows sets g.growHold = false.
// A failure whose message starts with "GAME BUG" is a rule the game breaks, not a test mistake;
// "setup:" failures mean the scripted situation did not come about.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { World, decodeCells } from "../../public/primordia/lenia.js";
import { ORBIUM } from "../../public/primordia/species.js";
import { Game, GAME_RULES, HUNTER_R, TUNE, SPECIES, SP, TIERS, tierOf, wrap, wdelta, mulberry32 } from "../../public/primordia/core.js";

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
    const msg = String((err && err.message) || err).split("\n").slice(0, 8).join("\n       ");
    line = `FAIL ${String(n).padStart(2)} ${name} (${Date.now() - t0} ms)\n       ${msg}`;
  }
  results.push(line);
  console.log(line);
}

// ---------- helpers (setup, tick, frames, stepOnce and spawnMany as in combat.test.mjs) ----------
const DT = 1 / 60;
const SCALE = HUNTER_R / 13;
const ORB = decodeCells(ORBIUM);
const G = TUNE.grow;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const NAME = Object.fromEntries(Object.values(SP).map((v) => [v, SPECIES[v].name]));
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const fx = (v, d = 2) => Number(v).toFixed(d);
const ROTS = [[256, 128], [128, 256]];
const orient = (g) => (g.h > g.w ? "portrait" : "landscape");
const BAD = ["devour", "selfDeath", "waveClear", "dissolve", "brood", "rupture", "fade"];

// A play-mode game on a clean dish: no waves, encores or prey unless a test asks for them.
function setup(seed = 1, { w = 256, h = 128, touch = false, clean = true } = {}) {
  const g = new Game(w, h, seed, { touch });
  g.reset("play");
  g.qa = { immortal: true, holdEpoch: clean };
  g.growHold = true; // tests that grow switch this off
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
// Play frames, handing each frame's events to `each` (the frame's events are then cleared).
function go(g, max, input = {}, each) {
  for (let i = 0; i < max; i++) {
    tick(g, typeof input === "function" ? input(i) : input);
    const ev = g.events.splice(0);
    if (each && each(ev, i) === false) return i + 1;
  }
  return max;
}

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
  if (alive) stepOnce(g);
  return found;
}
const spawn = (g, sp, x, y, angle, tags) => spawnMany(g, [{ sp, x, y, angle, tags }])[0];

function cellsOf(g, e) { const L = g.labelB, out = []; for (let i = 0; i < L.length; i++) if (L[i] === e.blob) out.push(i); return out; }
function densest(g, e) { let bi = -1, bv = -1; for (const i of cellsOf(g, e)) if (g.world.B[i] > bv) { bv = g.world.B[i]; bi = i; } return { x: bi % g.w, y: (bi / g.w) | 0 }; }
const evs = (g, type, pred = () => true) => g.events.filter((v) => v.type === type && pred(v));
// put the player's mouth (P + dir * 0.9) on a cell
function mouthOn(g, x, y) { const P = g.player; P.dirX = 1; P.dirY = 0; P.vx = P.vy = 0; P.x = wrap(x - 0.9, g.w); P.y = y; }

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

// a point given as an offset from the dish centre; portrait dishes swap the axes
function rel(g, dx, dy) {
  const { w, h } = g;
  return h > w ? { x: wrap(w / 2 + dy, w), y: wrap(h / 2 + dx, h) } : { x: wrap(w / 2 + dx, w), y: wrap(h / 2 + dy, h) };
}
// the meal that fills the GROW bar
function fill(g) { g.growth = g.bar() - 1; g.addGrowth(1, g.player.x, g.player.y); }
// stamp an Orbium (with claim tags) and step until it is tracked
function stampPrey(g, at, angle = 0, tags = {}) {
  const W = g.world;
  W.stamp(W.A, ORB, at.x, at.y, angle, 1);
  g.claims.push({ kind: "prey", x: at.x, y: at.y, at: g.time, tags: { stamped: true, ...tags } });
  let p = null;
  for (let k = 0; k < 4 && !p; k++) { stepOnce(g); p = g.prey.find((q) => g.dist(q.x, q.y, at.x, at.y) < 12) || null; }
  assert.ok(p, "setup: the stamped Orbium was not tracked");
  return p;
}
// keep the mouth on a prey until the player devours it
function eat(g, p, max = 240) {
  const events = [];
  let dev = null;
  go(g, max, () => { mouthOn(g, p.x, p.y); return {}; }, (ev) => { events.push(...ev); dev = ev.find((v) => v.type === "devour" && v.kind === "prey") || null; return !dev; });
  return { dev, events };
}
// a nameless brood body made from a species' rows (as if cut off a hunter)
function stampBrood(g, sp, at, angle = 0) {
  const W = g.world, P = g.player, alive = P.alive;
  W.stamp(W.B, SPECIES[sp].rows, at.x, at.y, angle, SCALE);
  g.claims.push({ kind: "hunter", x: at.x, y: at.y, at: g.time, tags: { brood: true, baseMass: SPECIES[sp].mass, name: "Brood", stamped: true } });
  P.alive = false;
  let e = null;
  for (let k = 0; k < 6 && !e; k++) { stepOnce(g); e = g.hunters.find((o) => o.brood && g.dist(o.x, o.y, at.x, at.y) < 20) || null; }
  P.alive = alive;
  assert.ok(e, "setup: the brood body was not tracked");
  if (alive) stepOnce(g);
  return e;
}
// play until the cards are up; logs every event with the game time and the grow clock
function toCards(g, input = {}, max = 900) {
  const log = [];
  go(g, max, input, (ev) => { for (const v of ev) log.push({ ...v, t: g.time, growT: g.growT }); return g.state !== "mutate"; });
  assert.equal(g.state, "mutate", "setup: the cards never came");
  return log;
}
// five bodies around the dish centre (six husk sources: the two heavies give two each)
function crowd(g) {
  const at = (sp, dx, dy, angle) => ({ sp, ...rel(g, dx, dy), angle });
  return spawnMany(g, [at(SP.HEXA, -78, -24, 0), at(SP.HEPTA, 52, -29, 0), at(SP.PARA, -68, 41, 0), at(SP.PARA, 62, 41, 0), at(SP.DISC, 0, 46)]);
}
const pairMin = (pts, g) => { let m = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, g.dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y)); return m; };

// ---------- 1-3: the GROW bar, the body, outgrowing ----------

test(1, "Growth table and holds", () => {
  const g = setup(1); g.growHold = false;
  const GP = G.gp;
  const bars = [1, 2, 3, 4, 5, 6, 9].map((n) => { g.epoch = n; return g.bar(); });
  g.epoch = 1;
  assert.deepEqual(bars, [34, 40, 46, 52, 56, 56, 56], "bar per size");
  // a real meal: the mouth eats a stamped Orbium bite by bite
  const meal = eat(g, stampPrey(g, { x: 160, y: 64 }));
  assert.ok(meal.dev, "setup: the Orbium was not devoured");
  const ge = meal.events.filter((v) => v.type === "grow");
  assert.equal(g.growth, GP.prey, `an Orbium meal gave ${g.growth} GP`);
  assert.ok(ge.length === 1 && ge[0].n === 1 && Math.abs(ge[0].g - 1 / 34) < 1e-9 && Number.isFinite(ge[0].x) && Number.isFinite(ge[0].y), "grow event " + JSON.stringify(ge));
  // every other source, each from an empty bar, through the game's own devour() and creditEgg()
  let id = 9000;
  const body = (o) => ({ id: id++, x: 60, y: 30, peak: 300, mass: 300, born: -9, bitAt: -9, ...o });
  const prey = (o) => () => g.devour(body({ peak: 100, stamped: true, ...o }), "prey");
  const kill = (sp, how, o = {}) => () => g.devour(body({ species: sp, name: sp === undefined ? "Brood" : NAME[sp], ...o }), "hunter", { how });
  const rows = [
    ["Remains", prey({ remains: true }), GP.prey],
    ["golden Orbium", prey({ golden: true }), GP.golden],
    ["converted Orbium", prey({ converted: true, from: "Paraptera" }), GP.husk],
    ["egg pop", () => g.creditEgg(body({ egg: true, species: SP.EGG }), "dash"), GP.egg],
  ];
  for (const how of ["glory", "burst", "bleed", "rupture", "gulp"]) rows.push([`Discutium ${how}`, kill(SP.DISC, how), GP.swarm]);
  rows.push(["brood bleed", kill(undefined, "bleed", { brood: true, baseMass: 180 }), GP.swarm], ["brood gulp", kill(undefined, "gulp", { brood: true, baseMass: 150 }), GP.swarm]);
  for (const sp of [SP.PARA, SP.PENTA]) for (const how of ["glory", "burst", "bleed", "rupture"]) rows.push([`${NAME[sp]} ${how}`, kill(sp, how), how === "glory" || how === "burst" ? GP.lancer : GP.lancerBleed]);
  for (const sp of [SP.HEXA, SP.HEPTA]) for (const how of ["glory", "burst", "bleed", "rupture"]) rows.push([`${NAME[sp]} ${how}`, kill(sp, how), how === "glory" || how === "burst" ? GP.heavy : GP.heavyBleed]);
  const bad = [];
  for (const [label, fn, want] of rows) {
    g.growth = 0; g.combo = 0;
    fn();
    if (g.growth !== want) bad.push(`${label}: ${g.growth} GP, table ${want}`);
  }
  g.events.length = 0;
  assert.equal(bad.length, 0, "GAME BUG: " + bad.join("; "));
  // the Leviathan adds no points to the bar: it opens the apex gate
  g.growth = 10; g.ripe = false; g.duoNext = false;
  g.devour(body({ species: SP.HEPTA, name: "Heptapteryx", boss: true }), "hunter", { how: "glory" });
  assert.equal(g.growth, 10, "a Leviathan kill added GP");
  assert.ok(g.ripe && g.afterBoss && g.duoNext, "a Leviathan kill did not open the gate");
  g.ripe = false; g.duoNext = false; g.events.length = 0;
  // overflow: points on a full bar pay 50 each, times the multiplier
  g.growth = g.bar(); g.combo = 0;
  let s0 = g.score; g.addGrowth(3, 0, 0);
  const plain = g.score - s0;
  g.combo = 4; s0 = g.score; g.addGrowth(3, 0, 0);
  const x3 = g.score - s0;
  assert.equal(plain, 3 * G.overflowPoints, "overflow at x1");
  assert.equal(x3, 3 * G.overflowPoints * 3, "overflow at x3");
  assert.equal(g.growth, g.bar());
  assert.equal(evs(g, "grow").length, 0, "a grow event on a full bar");
  g.events.length = 0; g.combo = 0;
  // holds: growHold (tests, intro), states other than play, and the title / cabinet dish
  const held = [];
  g.growHold = true; g.growth = 0; g.addGrowth(5, 0, 0); held.push(["growHold", g.growth]);
  const meal2 = eat(g, stampPrey(g, { x: 100, y: 30 }));
  assert.ok(meal2.dev, "setup: the second Orbium was not devoured");
  held.push(["growHold meal", g.growth]);
  g.growHold = false;
  for (const st of ["grow", "mutate", "paused", "over"]) { g.state = st; g.growth = 0; g.addGrowth(5, 0, 0); held.push([st, g.growth]); }
  g.state = "play";
  const d = new Game(256, 128, 3); // the title screen and cabinet run demo mode
  d.addGrowth(5, 0, 0);
  let demoEv = 0;
  for (let f = 0; f < 600; f++) { d.update(DT, {}); demoEv += d.events.filter((v) => ["grow", "ripe", "apex", "growStart", "zoomBegin"].includes(v.type)).length; d.events.length = 0; }
  held.push(["demo", d.growth + demoEv]);
  const leak = held.filter(([, v]) => v !== 0);
  assert.equal(leak.length, 0, "GAME BUG: growth accrued in " + leak.map(([k, v]) => `${k} (${v})`).join(", "));
  return `bars ${bars.slice(0, 5).join("/")}; Orbium meal +1 (g ${fx(ge[0].g, 3)}); ${rows.length} other sources match; overflow +${plain} (x3 +${x3}); held in ${held.map(([k]) => k).join(", ")}`;
});

test(2, "Body radius, mouth and cut", () => {
  const g = setup(2); g.growHold = false;
  const P = g.player;
  // design section 3 table (two decimals); mouth and cut at half the bar are the formula's values
  const table = { 1: { r: [2.40, 3.00, 3.60], maw: [3.70, 4.37, 5.01], cut: [4.00, 4.47, 4.90] }, 5: { r: [3.27, 4.08, 4.90], maw: [4.66, 5.51, 6.32], cut: [4.67, 5.22, 5.72] } };
  const out = [], bad = [];
  for (const n of [1, 5]) {
    g.epoch = n;
    const base = G.base * Math.pow(G.basePerSize, Math.min(n, G.baseCapSize) - 1);
    [0, 0.5, 1].forEach((gf, k) => {
      g.growth = gf * g.bar();
      tick(g, {}); g.events.length = 0; // the play frame sets P.r from the bar
      const r = base * (1 + G.swell * gf), maw = 3.7 * Math.pow(r / G.base, G.maw.exp), cut = TUNE.cutR * Math.pow(r / G.base, G.cutExp);
      const got = { r: P.r, maw: g.mawRadius(), cut: g.cutRadius() };
      for (const [key, want] of [["r", r], ["maw", maw], ["cut", cut]]) {
        if (Math.abs(got[key] - want) > 1e-9) bad.push(`Size ${n} g ${gf} ${key} ${fx(got[key], 3)} vs formula ${fx(want, 3)}`);
        if (Math.abs(got[key] - table[n][key][k]) > 0.01) bad.push(`Size ${n} g ${gf} ${key} ${fx(got[key], 3)} vs table ${table[n][key][k]}`);
      }
      out.push(`${n === 1 ? "I" : "V"}@${gf}: r ${fx(got.r)} maw ${fx(got.maw)} cut ${fx(got.cut)}`);
    });
  }
  assert.equal(bad.length, 0, "GAME BUG: " + bad.join("; "));
  // Wide Maw x2 caps the mouth at 8 cells, then x1.55 in Burst; Long Rend widens the cut
  g.epoch = 5; g.growth = g.bar(); tick(g, {});
  g.mut.maw = 2; const capped = g.mawRadius(); g.burstT = 1; const inBurst = g.mawRadius(); g.burstT = 0; g.mut.maw = 0;
  g.mut.rend = 2; const rend = g.cutRadius(); g.mut.rend = 0;
  assert.ok(Math.abs(capped - G.maw.cap) < 1e-9 && Math.abs(inBurst - G.maw.cap * 1.55) < 1e-9, `maw cap ${fx(capped, 3)}, in Burst ${fx(inBurst, 3)}`);
  assert.ok(Math.abs(rend - (TUNE.cutR + 1) * Math.sqrt(P.r / G.base)) < 1e-9, "Long Rend cut " + rend);
  // swim speed does not change with size
  g.epoch = 1;
  const swim = (gf) => { g.growth = gf * g.bar(); P.x = 40; P.y = 64; P.vx = P.vy = 0; const x0 = P.x; for (let f = 0; f < 30; f++) tick(g, { mx: 1, my: 0 }); g.events.length = 0; return wdelta(P.x - x0, g.w); };
  const sw0 = swim(0), sw1 = swim(1);
  assert.ok(Math.abs(sw0 - sw1) < 1e-6, `swam ${fx(sw0, 3)} cells empty, ${fx(sw1, 3)} full`);
  // the bigger body is easier to sting: a spot at a hunter's edge stings a full-bar body only
  const e = spawn(g, SP.PARA, 128, 30, 0); e.cool = Infinity;
  const W = g.world, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const edge = () => {
    const d0 = densest(g, e);
    for (const [ux, uy] of dirs) for (let s = 0; s < 16; s += 0.5) {
      const x = wrap(Math.round(d0.x + ux * s), g.w), y = wrap(Math.round(d0.y + uy * s), g.h);
      if (W.probe(W.B, x, y, G.base) <= 0.25 && W.probe(W.B, x, y, G.base * 1.5) > 0.6) return { x, y };
    }
    return null;
  };
  const sting = (gf) => {
    g.growth = gf * g.bar(); P.x = 128; P.y = 110; P.vx = P.vy = 0; tick(g, {}); g.events.length = 0;
    const spot = edge();
    assert.ok(spot, "setup: no spot at the Paraptera's edge");
    P.x = spot.x; P.y = spot.y; P.vx = P.vy = 0; P.iframes = 0;
    const c0 = g.stats.loss.contact;
    tick(g, {}); g.events.length = 0;
    return g.stats.loss.contact - c0;
  };
  const small = sting(0), big = sting(1);
  assert.equal(small, 0, `setup: the empty-bar body was stung at the edge spot (${fx(small, 3)})`);
  assert.ok(big > 0, "a full-bar body at the same edge spot was not stung");
  return `${out.join("; ")}; Wide Maw cap ${fx(capped)}; swim ${fx(sw0)} = ${fx(sw1)} cells in 0.5 s; edge sting ${fx(small, 3)} vs ${fx(big, 3)} light`;
});

test(3, "Outgrow at half the bar", () => {
  const notes = [];
  const half = (g) => Math.ceil(G.notch * g.bar());
  // A: a Discutium swims away from a still player once the bar is half full, and rushes in below half
  const flee = (full) => {
    const g = setup(3); g.growHold = false;
    g.growth = full ? half(g) : half(g) - 1;
    const P = g.player; P.x = 128; P.y = 64;
    const e = spawn(g, SP.DISC, 168, 64);
    const d0 = g.dist(P.x, P.y, e.x, e.y);
    let dMin = d0;
    for (let s = 0; s < 60 && g.hunters.includes(e); s++) { stepOnce(g); dMin = Math.min(dMin, g.dist(P.x, P.y, e.x, e.y)); }
    return { d0, d1: g.dist(P.x, P.y, e.x, e.y), dMin, edible: g.edible(e), alive: g.hunters.includes(e), glide: Math.hypot(e.glideX || 0, e.glideY || 0) };
  };
  const fl = flee(true), ctl = flee(false);
  assert.ok(fl.edible && !ctl.edible, `edible at half ${fl.edible}, below ${ctl.edible}`);
  assert.ok(fl.alive, "setup: the fleeing Discutium was lost");
  // the game stamps every swarm facing the player (angleToward), as spawn() does here
  assert.ok(fl.d1 > fl.d0 + 5, `GAME BUG: an outgrown Discutium did not swim away: ${fx(fl.d0, 1)} -> ${fx(fl.d1, 1)} cells in 60 steps (below half: ${fx(ctl.d0, 1)} -> ${fx(ctl.d1, 1)}). The flee move (${G.flee.v} cells/step, clamp ${G.flee.clamp}) is weaker than the Discutium's own glide (${fx(fl.glide, 2)} cells/step), and swarms are stamped facing the player, so they keep drifting in`);
  assert.ok(ctl.dMin < ctl.d0 - 5, `setup: below half the Discutium did not close in (${fx(ctl.d0, 1)} -> min ${fx(ctl.dMin, 1)})`);
  notes.push(`flee ${fx(fl.d0, 0)} -> ${fx(fl.d1, 0)} cells; below half ${fx(ctl.d0, 0)} -> ${fx(ctl.dMin, 0)}`);
  // B: tissue the player has outgrown never stings (the mouth is switched off so only the sting rule acts)
  const touch = (full) => {
    const g = setup(3); g.growHold = false;
    g.growth = full ? half(g) : half(g) - 1;
    const P = g.player; P.x = 128; P.y = 100;
    const e = spawn(g, SP.DISC, 128, 30);
    g.tryGulp = () => {};
    const c0 = g.stats.loss.contact;
    let touched = 0;
    for (let f = 0; f < 10 && g.hunters.includes(e); f++) {
      const d = densest(g, e);
      P.x = d.x; P.y = d.y; P.vx = P.vy = 0; P.iframes = 0;
      if (g.world.probe(g.world.B, P.x, P.y, P.r) > 0.35) touched++;
      tick(g, {}); g.events.length = 0;
    }
    return { loss: g.stats.loss.contact - c0, touched };
  };
  const t1 = touch(true), t0 = touch(false);
  assert.ok(t1.touched >= 5 && t0.touched >= 5, `setup: touched ${t1.touched} and ${t0.touched} frames`);
  assert.ok(t0.loss > 0, "setup: an un-outgrown Discutium did not sting");
  assert.equal(t1.loss, 0, `GAME BUG: an outgrown Discutium stung for ${fx(t1.loss, 3)} light`);
  notes.push(`sting ${fx(t1.loss, 2)} vs ${fx(t0.loss, 2)} light below half`);
  // C: the mouth swallows an outgrown Discutium whole (gulp, 2 GP) and pops an egg (1 GP)
  {
    const g = setup(3); g.growHold = false; g.growth = half(g);
    const P = g.player; P.x = 128; P.y = 110;
    const [d, egg] = spawnMany(g, [{ sp: SP.DISC, x: 60, y: 40 }, { sp: SP.EGG, x: 200, y: 40, angle: 0 }]);
    const cells = cellsOf(g, d), g0 = g.growth;
    let dev = null;
    go(g, 30, () => { if (g.hunters.includes(d)) { const q = densest(g, d); mouthOn(g, q.x, q.y); } return {}; }, (ev) => { dev = ev.find((v) => v.type === "devour" && v.kind === "hunter") || null; return !dev; });
    assert.ok(dev, "GAME BUG: the mouth on an outgrown Discutium did not swallow it");
    assert.equal(dev.how, "gulp");
    assert.equal(g.growth - g0, G.gp.swarm, "gulp GP");
    assert.ok(!g.hunters.includes(d) && cells.filter((i) => g.world.B[i] > 0).length === 0, "the gulped body is still there");
    assert.equal(g.stats.gulps, 1);
    let pop = null;
    const g1 = g.growth;
    go(g, 30, () => { mouthOn(g, egg.x, egg.y); return {}; }, (ev) => { pop = ev.find((v) => v.type === "pop") || null; return !pop; });
    assert.ok(pop, "GAME BUG: the mouth on an egg did not pop it");
    assert.equal(pop.src, "gulp");
    assert.equal(g.growth - g1, G.gp.egg, "egg GP");
    notes.push(`gulp +${G.gp.swarm} GP, egg pop +${G.gp.egg}`);
  }
  // D: brood under 200 mass is food; brood of 200 or more stays hostile
  {
    const g = setup(3); g.growHold = false; g.growth = half(g);
    const P = g.player; P.x = 128; P.y = 110;
    const small = stampBrood(g, SP.DISC, { x: 60, y: 40 }), big = stampBrood(g, SP.PARA, { x: 190, y: 36 });
    small.cool = big.cool = Infinity;
    assert.ok(small.mass < G.edibleMass && big.mass >= G.edibleMass, `setup: brood masses ${fx(small.mass, 0)} and ${fx(big.mass, 0)}`);
    assert.ok(g.edible(small) && !g.edible(big), `edible: small ${g.edible(small)}, big ${g.edible(big)}`);
    // the big one stings and is not swallowed
    const c0 = g.stats.loss.contact;
    let bigDev = null;
    for (let f = 0; f < 10; f++) {
      const q = densest(g, big); P.x = q.x; P.y = q.y; P.vx = P.vy = 0; P.iframes = 0;
      tick(g, {}); bigDev = bigDev || evs(g, "devour", (v) => v.kind === "hunter")[0]; g.events.length = 0;
    }
    const loss = g.stats.loss.contact - c0;
    assert.ok(loss > 0, `GAME BUG: brood of ${fx(big.mass, 0)} mass did not sting`);
    assert.ok(!bigDev, "GAME BUG: brood of 200 mass or more was swallowed");
    // the small one is swallowed
    let dev = null;
    P.x = 128; P.y = 110;
    go(g, 30, () => { if (g.hunters.includes(small)) { const q = densest(g, small); mouthOn(g, q.x, q.y); } return {}; }, (ev) => { dev = ev.find((v) => v.type === "devour" && v.kind === "hunter") || null; return !dev; });
    assert.ok(dev && dev.how === "gulp", "GAME BUG: small brood was not swallowed");
    notes.push(`brood ${fx(small.mass, 0)} gulped, brood ${fx(big.mass, 0)} stings ${fx(loss, 2)}`);
  }
  return notes.join("; ");
});

// ---------- 4-6: the ripe wait, the boss gate, the frozen dish ----------

test(4, "Ripe timing, Burst wait, the herald and i-frames", () => {
  const notes = [];
  // A: a red hunter on the dish: the dish grows 0.25 s after the bar fills; 0.8 s of i-frames at the fill
  {
    const g = setup(4); g.growHold = false;
    const P = g.player;
    const e = spawn(g, SP.PARA, 20, 64, 0); e.cool = Infinity;
    P.iframes = 0;
    const t0 = g.time;
    fill(g);
    const ifr = P.iframes, ripe = evs(g, "ripe").length;
    g.events.length = 0;
    let tg = null;
    go(g, 120, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) { tg = g.time; return false; } });
    assert.equal(ripe, 1, "no ripe event at the fill");
    assert.ok(Math.abs(ifr - G.ripe.iframes) < 1e-9, `i-frames at the fill ${fx(ifr, 3)}`);
    assert.ok(tg !== null, "GAME BUG: the dish did not grow with a red hunter on it");
    assert.ok(tg - t0 >= G.ripe.delay - 1e-9 && tg - t0 <= G.ripe.delay + 2 * DT, `grew ${fx(tg - t0, 3)} s after the fill`);
    notes.push(`grew ${fx(tg - t0, 3)} s after the fill, i-frames ${fx(ifr, 2)} s`);
  }
  // B: a running Burst holds the grow until it ends
  {
    const g = setup(4); g.growHold = false;
    const e = spawn(g, SP.PARA, 20, 64, 0); e.cool = Infinity;
    g.meter = 1; g.ready = true;
    tick(g, { burst: true });
    assert.ok(g.burstT > 0, "setup: no Burst");
    g.events.length = 0;
    fill(g);
    let tEnd = null, tg = null, early = false;
    go(g, 900, {}, (ev) => {
      if (ev.some((v) => v.type === "burstEnd") && tEnd === null) tEnd = g.time;
      if (ev.some((v) => v.type === "growStart")) { tg = g.time; early = tEnd === null; return false; }
    });
    assert.ok(tg !== null && tEnd !== null, `setup: growStart ${tg}, burstEnd ${tEnd}`);
    assert.ok(!early, "GAME BUG: the dish grew while a Burst ran");
    assert.ok(tg - tEnd <= 2 * DT, `grew ${fx(tg - tEnd, 3)} s after the Burst ended`);
    notes.push(`Burst: grew ${fx(tg - tEnd, 3)} s after it ended`);
  }
  // C: an empty dish: one of the size's headline hunters is sent at once; the dish grows once it is tracked
  for (const n of [1, 2]) {
    const g = setup(4); g.growHold = false; g.epoch = n;
    const t0 = g.time;
    fill(g); g.events.length = 0;
    let herald = null, tq = null, tt = null, tg = null, zb = null;
    go(g, 6 * 60, {}, (ev) => {
      const p = g.pending.find((q) => q.wave === "herald");
      if (p && !herald) { herald = p; tq = g.time; }
      if (tt === null && g.hunters.some((e) => e.wave === "herald")) tt = g.time;
      if (ev.some((v) => v.type === "growStart") && tg === null) tg = g.time;
      zb = zb || ev.find((v) => v.type === "zoomBegin");
      return !zb;
    });
    assert.ok(herald, `GAME BUG: Size ${n}: no hunter was sent to an empty dish`);
    assert.equal(herald.species, tierOf(n).head, `Size ${n} herald is ${NAME[herald.species]}`);
    if (n >= 2) assert.ok(herald.tags.double, "the Size II herald lacks its double strike");
    assert.ok(tg !== null && tg - t0 <= G.ripe.wait + 2 * DT, `GAME BUG: Size ${n}: grew ${tg === null ? "never" : fx(tg - t0, 2) + " s"} after the fill`);
    assert.ok(tt !== null && tg >= tt, `Size ${n}: grew at ${fx(tg - t0, 2)} s, herald tracked at ${tt === null ? "never" : fx(tt - t0, 2)} s`);
    assert.ok(zb.converted >= 1, `Size ${n}: the herald did not convert (${zb.converted})`);
    notes.push(`Size ${n} herald ${NAME[herald.species]} sent ${fx(tq - t0, 2)} s, grew ${fx(tg - t0, 2)} s`);
  }
  // D: no spot for the herald: the dish grows anyway, 4 s after the fill
  {
    const g = setup(4); g.growHold = false;
    g.queueUnit = () => false;
    const t0 = g.time;
    fill(g); g.events.length = 0;
    let tg = null;
    go(g, 8 * 60, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) { tg = g.time; return false; } });
    assert.ok(tg !== null, "GAME BUG: an empty dish with no herald never grew");
    assert.ok(tg - t0 >= G.ripe.wait - 1e-6 && tg - t0 <= G.ripe.wait + 2 * DT, `grew ${fx(tg - t0, 3)} s after the fill, want ${G.ripe.wait}`);
    notes.push(`no herald: grew ${fx(tg - t0, 2)} s`);
  }
  return notes.join("; ");
});

// the Leviathan through three wing tears to its collapse, then a Glory Bite; returns the devour event
function killBoss(g, boss) {
  boss.cool = Infinity;
  for (let k = 0; k < 3; k++) {
    frames(g, 50, {}); g.events.length = 0; // past the 0.5 s gate guard
    g.tear(boss, 0.21 * SPECIES[SP.HEPTA].mass, "cut", boss.nx, boss.ny);
    assert.ok(g.hunters.includes(boss), "setup: boss lost at gate " + (k + 1));
  }
  assert.equal(boss.state, "collapse", "setup: the boss did not collapse");
  frames(g, 3, {});
  g.events.length = 0;
  let dev = null;
  go(g, 60, () => { if (g.hunters.includes(boss)) { const d = densest(g, boss); mouthOn(g, d.x, d.y); } return {}; }, (ev) => { dev = ev.find((v) => v.type === "devour" && v.boss) || null; return !dev; });
  assert.ok(dev && dev.how === "glory", "setup: no Glory Bite on the collapsed boss");
  return dev;
}
const bossCount = (g) => g.hunters.filter((e) => e.boss).length + g.pending.filter((p) => p.boss).length + g.director.queue.filter((q) => q.boss).length + g.claims.filter((c) => c.tags.boss).length;

test(5, "Boss guard and the apex", () => {
  const notes = [];
  // A: Size II, a full bar and a red hunter: a boss alive, pending, queued or claimed holds the grow
  {
    const g = setup(5); g.growHold = false; g.epoch = 2;
    const red = spawn(g, SP.PARA, 20, 64, 0); red.cool = Infinity;
    const states = {
      pending: () => g.pending.push({ kind: "hunter", species: SP.HEPTA, x: 200, y: 20, t: 99, total: 99, name: "Heptapteryx", boss: true, wave: "apex", tags: {} }),
      queued: () => g.director.queue.push({ species: SP.HEPTA, boss: true, wave: "apex" }),
      claimed: () => g.claims.push({ kind: "hunter", x: 200, y: 20, at: g.time, tags: { name: "Heptapteryx", species: SP.HEPTA, boss: true } }),
    };
    const grew = [];
    for (const [k, add] of Object.entries(states)) {
      const keep = { pending: [...g.pending], queue: [...g.director.queue], claims: [...g.claims] };
      add();
      Object.assign(g, { ripe: true, ripeT: 5, waitT: 5, ripeDelay: G.ripe.delay, afterBoss: false });
      g.checkRipe(DT);
      if (g.state !== "play") grew.push(k);
      g.state = "play"; g.pending = keep.pending; g.director.queue = keep.queue; g.claims = keep.claims; g.ripe = false;
      g.events.length = 0;
    }
    assert.equal(grew.length, 0, "GAME BUG: the dish grew with a boss " + grew.join(", "));
    // alive: three seconds with a full bar and a living boss, then the boss leaves the dish
    const boss = spawn(g, SP.HEPTA, 200, 30, undefined, { boss: true });
    boss.cool = Infinity;
    fill(g); g.events.length = 0;
    let tg = null, tFade = null;
    go(g, 180, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) { tg = g.time; return false; } });
    assert.equal(tg, null, "GAME BUG: the dish grew while a boss lived");
    g.wipe(g.world.B, g.labelB, boss.blob);
    go(g, 180, {}, (ev) => { if (ev.some((v) => v.type === "fade" && v.boss)) tFade = g.time; if (ev.some((v) => v.type === "growStart")) { tg = g.time; return false; } });
    assert.ok(tFade !== null && tg !== null, `after the boss left: fade ${tFade}, growStart ${tg}`);
    notes.push(`held 3 s with a boss alive (also pending, queued, claimed); grew ${fx(tg - tFade, 2)} s after it left`);
  }
  // B: Size III: the full bar summons exactly one Leviathan; devouring it grows the dish 1 s later with a Duo
  {
    const g = setup(5); g.growHold = false; g.epoch = 3;
    g.mut.flagellum = 1; g.mut.stasis = 1; // both parents of Blade Dance: a Duo is open
    const P = g.player; P.iframes = 0;
    fill(g);
    const apex = evs(g, "apex").length, ripe = evs(g, "ripe").length, ifr = P.iframes;
    g.events.length = 0;
    assert.equal(apex, 1, "no apex event");
    assert.equal(ripe, 0, "GAME BUG: an apex bar turned ripe before the Leviathan came");
    assert.ok(Math.abs(ifr - G.ripe.iframes) < 1e-9, "i-frames at the apex fill " + ifr);
    assert.equal(bossCount(g), 1, "bosses after the fill");
    const s0 = g.score;
    for (let k = 0; k < 3; k++) g.addGrowth(5, P.x, P.y);
    assert.equal(bossCount(g), 1, "GAME BUG: more meals on a full apex bar summoned another boss");
    assert.ok(g.score > s0, "no overflow points on the full apex bar");
    g.events.length = 0;
    let boss = null, grewEarly = false;
    go(g, 6 * 60, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) grewEarly = true; boss = g.hunters.find((e) => e.boss) || null; return !boss; });
    assert.ok(boss, "setup: the Leviathan never arrived");
    go(g, 120, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) grewEarly = true; });
    assert.ok(!grewEarly, "GAME BUG: the dish grew while the Leviathan lived");
    assert.equal(g.hunters.filter((e) => e.boss).length, 1, "bosses on the dish");
    const dev = killBoss(g, boss), tDev = g.time;
    let tg = null, duo = null;
    go(g, 300, {}, (ev) => { if (ev.some((v) => v.type === "growStart")) { tg = g.time; duo = g.duoNext; return false; } });
    assert.ok(tg !== null, "GAME BUG: the dish did not grow after the Leviathan was devoured");
    assert.ok(Math.abs(tg - tDev - G.ripe.bossDelay) <= 2 * DT, `grew ${fx(tg - tDev, 3)} s after the devour, want ${G.ripe.bossDelay}`);
    assert.equal(duo, true, "duoNext not set at the grow");
    toCards(g);
    assert.ok(g.offer.some((m) => m.kind === "duo"), "GAME BUG: no Duo card after a Leviathan kill: " + g.offer.map((m) => m.id).join(","));
    notes.push(`Size III: 1 boss, devour (${dev.points} pts) -> grew ${fx(tg - tDev, 2)} s later, cards ${g.offer.map((m) => m.id).join("/")}`);
  }
  // C: Size III: a Leviathan that leaves uneaten still grows the dish, without a Duo
  {
    const g = setup(5); g.growHold = false; g.epoch = 3;
    fill(g); g.events.length = 0;
    let boss = null;
    go(g, 6 * 60, {}, () => { boss = g.hunters.find((e) => e.boss) || null; return !boss; });
    assert.ok(boss, "setup: the Leviathan never arrived");
    boss.cool = Infinity;
    g.wipe(g.world.B, g.labelB, boss.blob);
    let tFade = null, tg = null, duo = null;
    go(g, 300, {}, (ev) => { if (ev.some((v) => v.type === "fade" && v.boss)) tFade = g.time; if (ev.some((v) => v.type === "growStart")) { tg = g.time; duo = g.duoNext; return false; } });
    assert.ok(tFade !== null, "setup: no boss fade");
    assert.ok(tg !== null, "GAME BUG: the dish did not grow after the Leviathan left");
    assert.ok(Math.abs(tg - tFade - G.ripe.bossDelay) <= 2 * DT, `grew ${fx(tg - tFade, 3)} s after it left`);
    assert.equal(duo, false, "duoNext set after a boss that left");
    notes.push(`left uneaten: grew ${fx(tg - tFade, 2)} s later, no Duo`);
  }
  return notes.join("; ");
});

test(6, "The dish is frozen while it grows", () => {
  const g = setup(6); g.growHold = false; g.qa.immortal = false;
  const P = g.player; P.x = 128; P.y = 64; P.light = 60;
  // a busy dish: hunters (one cut moments ago), an egg, prey, a golden prey, a fresh Remains, spawns on their way
  const [para] = spawnMany(g, [{ sp: SP.PARA, x: 50, y: 30, angle: 0 }, { sp: SP.DISC, x: 205, y: 100 }, { sp: SP.HEXA, x: 200, y: 26, angle: 0 }, { sp: SP.EGG, x: 50, y: 100, angle: 0 }]);
  for (const e of g.hunters) e.cool = Infinity;
  stampPrey(g, { x: 128, y: 18 }); stampPrey(g, { x: 128, y: 112 });
  stampPrey(g, { x: 90, y: 64 }, 0, { golden: true });
  stampPrey(g, { x: 166, y: 64 }, 0, { remains: true, fadeAt: g.time + TUNE.remains.fade });
  g.pending.push({ kind: "hunter", species: SP.DISC, x: 20, y: 64, angle: 0, t: 3, total: 3, name: "Discutium", boss: false, wave: g.waveKey(1), brood: false, tags: {} });
  g.pending.push({ kind: "prey", x: 236, y: 64, angle: 0, t: 3, total: 3 });
  g.director.spawned[1] = true; g.director.cleared[1] = false; para.wave = g.waveKey(1);
  g.combo = 5; g.comboTimer = 2; g.meter = 1; g.ready = true;
  const W = g.world, orig = W.step.bind(W);
  let calls = 0, win = false;
  W.step = () => { if (win) calls++; return orig(); };
  fill(g);
  g.tear(para, 30, "cut", para.nx, para.ny); // a cut moments before: forgetting it must not pay a bleed-out
  g.events.length = 0;
  const press = { mx: 1, my: 0, dash: true, burst: true };
  const seen = [];
  let at = null, zb = null, zbLight = null;
  go(g, 900, () => (g.state === "grow" ? press : {}), (ev) => {
    const k = ev.findIndex((v) => v.type === "growStart");
    if (k >= 0 && !at) {
      win = true;
      at = { time: g.time, steps: g.steps, light: P.light, combo: g.combo, comboTimer: g.comboTimer, charges: P.charges, dashId: P.dashId, meter: g.meter, x: P.x, y: P.y, afterStart: ev.slice(k + 1).map((v) => v.type) };
    }
    if (win) for (const v of (k >= 0 ? ev.slice(k + 1) : ev)) { seen.push(v.type); if (v.type === "zoomBegin") { zb = v; zbLight = P.light; } }
    return g.state !== "mutate";
  });
  assert.ok(at, "setup: the dish did not start growing");
  assert.equal(g.state, "mutate", "setup: the cards never came");
  go(g, 30, press, (ev) => { for (const v of ev) seen.push(v.type); }); // the cards wait: still frozen
  const fails = [];
  if (calls) fails.push(`World.step ran ${calls} times`);
  if (g.steps !== at.steps) fails.push(`${g.steps - at.steps} sim steps`);
  if (g.time !== at.time) fails.push(`game time moved ${fx(g.time - at.time, 3)} s`);
  if (at.afterStart.includes("step")) fails.push("a step in the growStart frame after the grow began");
  const bad = seen.filter((t) => BAD.includes(t));
  if (bad.length) fails.push("events " + [...new Set(bad)].join(","));
  if (seen.includes("dash") || seen.includes("burst") || P.dashId !== at.dashId || g.meter !== at.meter) fails.push("a press acted during the grow");
  if (g.combo !== at.combo || g.comboTimer !== at.comboTimer) fails.push(`combo ${at.combo}/${fx(at.comboTimer)} -> ${g.combo}/${fx(g.comboTimer)}`);
  const motes = zb ? zb.motes.length : 0, wantLight = Math.min(P.maxLight, at.light + G.motes.light * motes);
  if (Math.abs(P.light - wantLight) > 1e-9) fails.push(`light ${fx(at.light)} -> ${fx(P.light)} (motes ${motes}, want ${fx(wantLight)}): hunger ran`);
  assert.equal(fails.length, 0, "GAME BUG: " + fails.join("; "));
  const gain = P.light - at.light;
  g.choose(0);
  frames(g, 10, {});
  assert.ok(calls > 0 && g.time > at.time, "setup: play did not resume after the pick");
  return `growStart to the pick: 0 World.step calls, time held at ${fx(at.time, 2)} s, ${seen.length} events (${[...new Set(seen)].join(",")}), light +${fx(gain, 1)} from ${motes} motes (light ${fx(zbLight, 1)} at zoomBegin)`;
});

// ---------- 7-10: the swap, placement, survival, cost ----------

test(7, "The swap state and World.zoomOut", () => {
  const notes = [];
  // A: World.zoomOut on random fields: a quarter of the mass in the middle, fresh dish outside
  for (const [w, h] of ROTS) {
    const W = new World(w, h, GAME_RULES), rnd = mulberry32(w);
    for (let i = 0; i < W.n; i++) { W.A[i] = rnd() < 0.3 ? rnd() : 0; W.B[i] = rnd() < 0.2 ? rnd() : 0; W.N[i] = 0.4 + 0.6 * rnd(); }
    W.toxin.A = 0.2; W.toxin.B = 0.5; W.purge.A = W.purge.B = true;
    const a0 = sum(W.A), b0 = sum(W.B), n0 = sum(W.N), A0 = Float32Array.from(W.A);
    W.zoomOut();
    let am = 0, bm = 0, nm = 0, outBad = 0;
    for (let i = 0; i < W.n; i++) {
      const x = i % w, y = (i / w) | 0;
      if (x >= w / 4 && x < (3 * w) / 4 && y >= h / 4 && y < (3 * h) / 4) { am += W.A[i]; bm += W.B[i]; nm += W.N[i]; }
      else if (W.A[i] !== 0 || W.B[i] !== 0 || W.N[i] !== 1) outBad++;
    }
    assert.equal(outBad, 0, `${w}x${h}: ${outBad} cells outside the middle quarter are not fresh agar`);
    for (const [k, got, want] of [["A", am, a0 / 4], ["B", bm, b0 / 4], ["N", nm, n0 / 4]]) assert.ok(Math.abs(got - want) <= 1e-4 * want, `${w}x${h}: middle ${k} ${fx(got, 3)}, want a quarter of ${fx(want * 4, 3)}`);
    const X = 37, Y = 21, j = (h / 4 + Y) * w + w / 4 + X, o = 2 * Y * w + 2 * X;
    const want = (A0[o] + A0[o + 1] + A0[o + w] + A0[o + w + 1]) / 4;
    assert.ok(Math.abs(W.A[j] - want) < 1e-6, `cell (${w / 4 + X},${h / 4 + Y}) holds ${W.A[j]}, the old 2x2 box at (${2 * X},${2 * Y}) means ${want}`);
    assert.ok(W.toxin.A === 0 && W.toxin.B === 0 && !W.purge.A && !W.purge.B, "zoomOut kept the toxin or purge");
    assert.ok(Math.abs(W.massA - sum(W.A)) < 1e-2 && Math.abs(W.massB - sum(W.B)) < 1e-2, "zoomOut masses");
    notes.push(`${w}x${h} zoomOut: A ${fx(a0)} -> ${fx(am)} in the middle`);
  }
  // B: the game state right after zoomBegin (forced mid-dash, mid-Burst, mid-Stasis and mid-purge)
  for (const [w, h] of ROTS) {
    const g = setup(7, { w, h }); g.growHold = false; g.qa.immortal = false;
    const P = g.player, W = g.world;
    const s = rel(g, 9.3, -6.6); P.x = s.x; P.y = s.y;
    const [para] = spawnMany(g, [{ sp: SP.PARA, ...rel(g, -80, -35), angle: 0 }, { sp: SP.DISC, ...rel(g, 80, 35) }, { sp: SP.EGG, ...rel(g, -80, 40), angle: 0 }]);
    for (const e of g.hunters) e.cool = Infinity;
    stampPrey(g, rel(g, 60, -40)); stampPrey(g, rel(g, 20, 45));
    stampPrey(g, rel(g, -30, 50), 0, { golden: true });
    stampPrey(g, rel(g, -20, -50), 0, { remains: true, fadeAt: g.time + TUNE.remains.fade });
    g.pending.push({ kind: "hunter", species: SP.DISC, ...rel(g, -40, 50), angle: 0, t: 9, total: 9, name: "Discutium", boss: false, wave: g.waveKey(1), brood: false, tags: {} });
    g.pending.push({ kind: "prey", ...rel(g, 40, -50), angle: 0, t: 9, total: 9 });
    g.director.queue.push({ species: SP.DISC, wave: g.waveKey(1) });
    g.director.spawned[1] = true; g.director.cleared[1] = false; para.wave = g.waveKey(1);
    g.burstT = 3; g.stasisT = 1.2; P.dashT = 0.1; P.cutting = true; P.cutLog.set(para.id, { torn: 1, frac: 0.1, x: 0, y: 0 });
    P.vx = 40; P.vy = -10; g.dashBuffer = 0.1; g.burstBuffer = 0.1; g.simAcc = 0.7; g.freezeLog = [[g.clock, 0.1]];
    W.toxin.A = 0.12; W.toxin.B = 0.3; W.purge.A = W.purge.B = true; g.bloom = g.tide = true;
    g.lastCut = { x: 1, y: 1, time: g.time, e: para };
    P.light = 40;
    const x0 = P.x, y0 = P.y, s0 = g.score, L0 = P.light, eggs0 = g.hunters.filter((e) => e.egg).length;
    const oldPrey = g.prey.filter((p) => !p.golden && !p.remains).length;
    g.events.length = 0;
    g.startGrow();
    const log = [];
    go(g, 60, {}, (ev) => { log.push(...ev); return !ev.some((v) => v.type === "zoomBegin"); });
    const zb = log.find((v) => v.type === "zoomBegin");
    assert.ok(zb, "setup: no zoomBegin");
    const fails = [], chk = (ok, msg) => { if (!ok) fails.push(msg); };
    chk(!g.prey.length && !g.hunters.length && !g.claims.length && !g.pending.length && !g.director.queue.length, `lists: prey ${g.prey.length}, hunters ${g.hunters.length}, claims ${g.claims.length}, pending ${g.pending.length}, queue ${g.director.queue.length}`);
    chk(g.labelB === null && g.ownerOf.length === 0 && g.lastCut === null, "labelB, ownerOf or lastCut kept");
    const want = { x: wrap(w / 4 + x0 / 2, w), y: wrap(h / 4 + y0 / 2, h) };
    chk(Math.abs(P.x - want.x) < 1e-9 && Math.abs(P.y - want.y) < 1e-9, `player at ${fx(P.x, 3)},${fx(P.y, 3)}, want w/4 + x/2 = ${fx(want.x, 3)},${fx(want.y, 3)}`);
    chk(P.px === P.x && P.py === P.y, "px, py are not the player's point");
    chk(Math.abs(P.vx - 20) < 1e-9 && Math.abs(P.vy + 5) < 1e-9, `velocity ${P.vx},${P.vy}: not halved`);
    chk(W.toxin.A === 0 && W.toxin.B === 0 && !W.purge.A && !W.purge.B && !g.bloom && !g.tide, "toxin, purge, bloom or tide kept");
    chk(g.burstT === 0 && log.some((v) => v.type === "burstEnd"), "Burst did not end");
    chk(g.stasisT === 0 && log.some((v) => v.type === "stasisEnd"), "Stasis did not end");
    chk(P.dashT === 0 && !P.cutting && !P.dashEnded && P.cutLog.size === 0 && !log.some((v) => v.type === "cut"), "the dash did not end quietly");
    chk(g.hitstop === 0 && g.freezeLog.length === 0 && g.dashBuffer === 0 && g.burstBuffer === 0 && g.simAcc === 0, "hit-stop, buffers or simAcc kept");
    chk(g.score === s0, `score changed by ${g.score - s0} at zoomBegin`);
    const motes = Math.min(G.motes.max, oldPrey);
    chk(Math.abs(P.light - Math.min(P.maxLight, L0 + G.motes.light * motes)) < 1e-9, `light ${L0} -> ${P.light} with ${motes} old prey`);
    chk(zb.motes.length === motes && zb.eggs.length === eggs0, `zoomBegin motes ${zb.motes.length}/${motes}, eggs ${zb.eggs.length}/${eggs0}`);
    chk(g.epoch === 2 && g.growth === 0 && !g.ripe && g.stats.zooms === 1, `size ${g.epoch}, growth ${g.growth}, ripe ${g.ripe}`);
    chk(g.oldBox && g.oldBox.x === w / 4 && g.oldBox.y === h / 4 && g.oldBox.w === w / 2 && g.oldBox.h === h / 2, "oldBox " + JSON.stringify(g.oldBox));
    chk(g.director.cleared.every(Boolean), "an uncleared wave was kept");
    const bad = log.filter((v) => BAD.includes(v.type));
    chk(!bad.length, "events " + bad.map((v) => v.type).join(","));
    const rest = toCards(g), zf = rest.find((v) => v.type === "zoomFinish");
    chk(g.score - s0 === G.sizeBonus * 2 && zf.bonus === G.sizeBonus * 2, `score +${g.score - s0} by the cards, want the size bonus ${G.sizeBonus * 2}`);
    chk(!rest.some((v) => BAD.includes(v.type)), "events after zoomBegin " + rest.filter((v) => BAD.includes(v.type)).map((v) => v.type).join(","));
    assert.equal(fails.length, 0, `GAME BUG (${orient(g)}): ` + fails.join("; "));
    notes.push(`${orient(g)}: player ${fx(x0, 1)},${fx(y0, 1)} -> ${fx(P.x, 2)},${fx(P.y, 2)}; ${zb.converted} sources (${zf.at.map((a) => a.from).join(", ")}); light +${fx(P.light - L0, 0)} from ${motes} motes; score +${g.score - s0}`);
  }
  return notes.join("; ");
});

test(8, "Placement of the converted prey", () => {
  const notes = [];
  // A: a crowded dish (eight sources with a golden prey) in both orientations
  for (const [w, h] of ROTS) {
    const g = setup(8, { w, h }); g.growHold = false;
    const P = g.player;
    for (const e of crowd(g)) e.cool = Infinity;
    stampPrey(g, rel(g, -18, -50), 0, { golden: true });
    const golden = g.prey.some((p) => p.golden);
    const W = g.world, orig = W.stamp.bind(W), stamps = [];
    let rec = false, zf = null;
    W.stamp = (field, cells, x, y, angle, s, mode) => { if (rec && field === W.A) stamps.push({ x, y, angle }); return orig(field, cells, x, y, angle, s, mode); };
    fill(g); g.events.length = 0;
    const fails = [], chk = (ok, msg) => { if (!ok) fails.push(msg); };
    go(g, 300, {}, (ev) => {
      if (ev.some((v) => v.type === "zoomBegin")) rec = true;
      zf = ev.find((v) => v.type === "zoomFinish") || null;
      if (!zf) return true;
      rec = false;
      // checked in the frame of zoomFinish, before the dish steps again
      let agarBad = 0;
      for (const s of stamps) {
        const X = Math.round(s.x), Y = Math.round(s.y);
        for (let dy = -G.zoom.refill; dy <= G.zoom.refill; dy++) for (let dx = -G.zoom.refill; dx <= G.zoom.refill; dx++) if (dx * dx + dy * dy <= G.zoom.refill ** 2 && W.N[wrap(Y + dy, h) * w + wrap(X + dx, w)] !== 1) agarBad++;
      }
      chk(agarBad === 0, `${agarBad} cells under 1 agar within ${G.zoom.refill} of a stamp`);
      chk(sum(W.B) === 0 && W.massB === 0, `massB ${W.massB} after the swap`);
      return false;
    });
    assert.ok(zf, "setup: no zoomFinish");
    const pm = pairMin(stamps, g), playerMin = Math.min(...stamps.map((s) => g.dist(s.x, s.y, P.x, P.y)));
    chk(stamps.length <= G.zoom.maxNew && stamps.length === zf.at.length, `${stamps.length} stamps, ${zf.at.length} reported`);
    chk(pm >= 0.95 * G.zoom.dmin - 1e-9, `stamps ${fx(pm, 1)} cells apart`);
    chk(playerMin >= G.zoom.rmin - 1e-9, `a stamp ${fx(playerMin, 1)} cells from the player`);
    chk(stamps.every((s) => Math.abs(s.angle / (Math.PI / 2) - Math.round(s.angle / (Math.PI / 2))) < 1e-9), "stamp angles " + stamps.map((s) => fx(s.angle, 3)).join(","));
    chk(g.prey.length === stamps.length && g.prey.every((p) => p.stamped && typeof p.from === "string" && p.from && !!p.converted === !p.golden), "prey tags " + JSON.stringify(g.prey.map((p) => ({ converted: p.converted, golden: p.golden, from: p.from }))));
    const names = zf.at.map((a) => a.from);
    if (golden) chk(zf.at.some((a) => a.golden), "the golden prey was not carried");
    chk(names.filter((n) => n === "Hexapteryx").length === 2 && names.filter((n) => n === "Heptapteryx").length === 2, "heavy arcs did not give two each: " + names.join(","));
    assert.equal(fails.length, 0, `GAME BUG (${orient(g)}): ` + fails.join("; "));
    notes.push(`${orient(g)} crowd: ${stamps.length} of 8 sources (${names.join(", ")}), min gap ${fx(pm, 1)}, player ${fx(playerMin, 1)}`);
  }
  // B: lone bodies: a Hexapteryx or a common Heptapteryx gives two Orbium, a lancer or swarm one
  for (const [sp, n, w, h] of [[SP.HEXA, 2, 256, 128], [SP.HEXA, 2, 128, 256], [SP.HEPTA, 2, 256, 128], [SP.PARA, 1, 256, 128], [SP.DISC, 1, 128, 256]]) {
    const g = setup(80 + sp, { w, h }); g.growHold = false;
    const e = spawn(g, sp, ...Object.values(rel(g, -70, -30)), sp === SP.DISC ? undefined : 0); e.cool = Infinity;
    fill(g); g.events.length = 0;
    const zf = toCards(g).find((v) => v.type === "zoomFinish");
    const P = g.player;
    assert.equal(zf.at.length, n, `GAME BUG: a lone ${NAME[sp]} gave ${zf.at.length} Orbium (${orient(g)})`);
    assert.ok(zf.at.every((a) => a.from === NAME[sp]), "from " + zf.at.map((a) => a.from));
    assert.ok(n < 2 || pairMin(zf.at, g) >= 0.95 * G.zoom.dmin - 1e-9, `two Orbium ${fx(pairMin(zf.at, g), 1)} cells apart`);
    assert.ok(zf.at.every((a) => g.dist(a.x, a.y, P.x, P.y) >= G.zoom.rmin - 1e-9), "an Orbium too close to the player");
    assert.equal(g.prey.filter((p) => p.converted).length, n, "converted prey tracked");
    notes.push(`${NAME[sp].slice(0, 4)} ${orient(g)[0]}: ${n}${n > 1 ? ` (${fx(pairMin(zf.at, g), 0)} apart)` : ""}`);
  }
  // C: placeHusks on random source lists: spread, clustered, all on the player, in a tight line
  const v = { cap: [], gap: [], near: [] };
  let cases = 0, dropped = 0;
  for (const [w, h] of ROTS) {
    const g = setup(88, { w, h }), rnd = mulberry32(w + 88), P = g.player;
    for (let c = 0; c < 300; c++, cases++) {
      P.x = rnd() * w; P.y = rnd() * h;
      const K = 1 + Math.floor(rnd() * 9), mode = c % 4;
      const cx = mode === 2 ? P.x : rnd() * w, cy = mode === 2 ? P.y : rnd() * h;
      const list = [];
      for (let k = 0; k < K; k++) {
        let x, y;
        if (mode === 0) { x = rnd() * w; y = rnd() * h; } else if (mode === 3) { x = cx + k * 6; y = cy; } else { x = cx + (rnd() - 0.5) * 12; y = cy + (rnd() - 0.5) * 12; }
        list.push({ x: wrap(x, w), y: wrap(y, h), from: "Paraptera", id: k + 1 });
      }
      const out = g.placeHusks(list);
      dropped += Math.min(K, G.zoom.maxNew) - out.length;
      const tag = `${w}x${h} case ${c} (mode ${mode}, ${K} sources)`;
      if (out.length > G.zoom.maxNew) v.cap.push(tag);
      if (pairMin(out, g) < 0.95 * G.zoom.dmin - 1e-9) v.gap.push(tag);
      const near = Math.min(...out.map((p) => g.dist(p.x, p.y, P.x, P.y)));
      if (near < G.zoom.rmin - 1e-9) v.near.push(`${tag}: ${fx(near, 1)} cells`);
    }
  }
  assert.equal(v.cap.length + v.gap.length, 0, "GAME BUG: placeHusks broke the cap or the spacing: " + [...v.cap, ...v.gap].slice(0, 3).join("; "));
  assert.equal(v.near.length, 0, `GAME BUG: placeHusks left an Orbium closer than ${G.zoom.rmin} cells to the player in ${v.near.length} of ${cases} random lists (the final filter only checks spacing): ${v.near.slice(0, 3).join("; ")}`);
  notes.push(`${cases} random lists: ${dropped} sources dropped for spacing, 0 too close`);
  return notes.join("; ");
});

// A real run with an immortal player: play each size with hunters on the dish, fill the bar, and follow
// the converted Orbium after play resumes. Sizes I to III (the apex boss is skipped; test 5 covers it).
function survivalRun(seed, w, h, { zooms = 3, spawner = true } = {}) {
  const g = new Game(w, h, seed, { touch: h > w });
  g.reset("play");
  g.qa = { immortal: true, holdEpoch: false };
  g.growHold = true;
  const out = [];
  for (let z = 0; z < zooms; z++) {
    const t0 = g.time;
    go(g, 60 * 60, () => dodger(g), () => g.time - t0 < 16);
    g.growHold = false;
    if (g.isApex()) g.apexCalled = true;
    const named = g.hunters.filter((e) => g.isNamed(e) && !e.egg).length;
    const tFill = g.time;
    fill(g);
    let zb = null, zf = null, massB = null, wait = null;
    go(g, 900, () => dodger(g), (ev) => {
      for (const v of ev) {
        if (v.type === "growStart") wait = g.time - tFill;
        if (v.type === "zoomBegin") zb = v;
        if (v.type === "zoomFinish") { zf = v; massB = Math.max(sum(g.world.B), g.world.massB); }
      }
      return g.state !== "mutate";
    });
    assert.equal(g.state, "mutate", `setup: seed ${seed} ${w}x${h} zoom ${z + 1}: no cards`);
    const husks = g.prey.filter((p) => p.converted), gold = g.prey.filter((p) => p.golden).length;
    g.choose(0);
    g.growHold = true;
    if (!spawner) g.preyCd = Infinity; // control: the game's prey spawner waits out the 100 steps
    const s0 = g.steps, tR = g.time, early = [];
    let eaten100 = 0, eaten = 0, blooms = 0, tides = 0, inWindow = true, stamps = 0;
    const watch = (ev) => {
      for (const v of ev) {
        if (inWindow && v.type === "spawn" && v.kind === "prey") stamps++;
        if (v.type === "devour" && v.kind === "prey" && v.converted) { eaten++; if (inWindow) eaten100++; }
        if (v.type === "bloom") blooms++;
        if (v.type === "tide") tides++;
        if (g.time - tR <= 2 && (["selfDeath", "waveClear", "rupture", "dissolve"].includes(v.type) || (v.type === "devour" && v.kind === "hunter"))) early.push(v.type);
      }
    };
    go(g, 60 * 30, {}, (ev) => { watch(ev); return g.steps - s0 < 100; });
    inWindow = false;
    if (!spawner) g.preyCd = 0;
    const tracked = husks.filter((p) => g.prey.includes(p)).length;
    go(g, 60 * 30, () => dodger(g), (ev) => { watch(ev); return g.time - tR < 12; });
    out.push({ seed, orient: orient(g), size: g.epoch - 1, named, wait, converted: zb.converted, placed: zf.at.length, husks: husks.length, gold, tracked, eaten100, eaten, massB, blooms, tides, early, stamps });
  }
  return out;
}

test(9, "Converted Orbium live on in play", () => {
  const runs = [];
  for (const seed of [7, 11, 23]) for (const [w, h] of ROTS) runs.push(...survivalRun(seed, w, h));
  const total = runs.reduce((a, r) => a + r.husks, 0), alive = runs.reduce((a, r) => a + r.tracked, 0), eaten = runs.reduce((a, r) => a + r.eaten100, 0);
  const lines = runs.map((r) => `${r.seed}${r.orient[0]} ${["", "I", "II", "III"][r.size]}: ${r.named} red, ${r.husks} husks, ${r.tracked} tracked${r.eaten100 ? ` + ${r.eaten100} eaten` : ""}, ${r.stamps} new prey stamped, ${r.blooms} blooms`);
  console.log("       " + lines.join("\n       "));
  const fails = [];
  if (total < runs.length) fails.push(`setup: only ${total} converted Orbium in ${runs.length} zooms`);
  if ((alive + eaten) / total < 0.85) {
    // the same zooms again with the game's prey spawner held for the 100 steps
    const ctl = [];
    for (const seed of [7, 11, 23]) for (const [w, h] of ROTS) ctl.push(...survivalRun(seed, w, h, { spawner: false }));
    const ct = ctl.reduce((a, r) => a + r.husks, 0), ca = ctl.reduce((a, r) => a + r.tracked + r.eaten100, 0);
    console.log(`       control, prey spawner held for 100 steps: ${ca} of ${ct} lived; ${ctl.reduce((a, r) => a + r.blooms, 0)} blooms in the 12 s after`);
    fails.push(`only ${alive + eaten} of ${total} converted Orbium (${fx((100 * (alive + eaten)) / total, 1)}%) lived 100 steps after play resumed; with the prey spawner held for those steps the same zooms keep ${ca} of ${ct} (${fx((100 * ca) / ct, 1)}%). The spawner restocks the nearly empty dish at once (${runs.reduce((a, r) => a + r.stamps, 0)} new Orbium in the ${runs.length} windows, findSpot 22 cells from other prey) and the new prey collide with the converted ones`);
  }
  const dirty = runs.filter((r) => r.massB !== 0);
  if (dirty.length) fails.push(`hunter tissue left after the swap: ${dirty.map((r) => fx(r.massB, 1)).join(",")}`);
  const blooms = runs.reduce((a, r) => a + r.blooms, 0), tides = runs.reduce((a, r) => a + r.tides, 0);
  if (blooms || tides) fails.push(`${blooms} blooms and ${tides} red tides in the 12 s after`);
  const early = runs.flatMap((r) => r.early);
  if (early.length) fails.push(`in the 2 s after resuming: ${early.join(",")}`);
  assert.equal(fails.length, 0, "GAME BUG: " + fails.join("; "));
  const waits = runs.map((r) => r.wait);
  return `${runs.length} zooms (3 seeds x 2 orientations x 3), ${total} converted: ${alive} tracked + ${eaten} eaten after 100 steps (${fx((100 * (alive + eaten)) / total, 1)}%; tracked alone ${fx((100 * alive) / total, 1)}%); median ${median(runs.map((r) => r.placed))} placed per zoom; ripe wait median ${fx(median(waits), 2)} s, max ${fx(Math.max(...waits), 2)} s; massB 0; 0 blooms, 0 tides`;
});

test(10, "Cost per phase", () => {
  const t = { begin: [], finish: [] };
  for (const [w, h] of ROTS) {
    const g = setup(10, { w, h }); g.growHold = false;
    for (const [k, key] of [["zoomBegin", "begin"], ["zoomFinish", "finish"]]) {
      const o = g[k].bind(g);
      g[k] = () => { const t0 = performance.now(); o(); t[key].push(performance.now() - t0); };
    }
    for (let z = 0; z < 3; z++) {
      const c = rel(g, 0, 0); g.player.x = c.x; g.player.y = c.y;
      for (const e of crowd(g)) e.cool = Infinity;
      for (const [dx, dy] of [[-30, 0], [30, -8], [0, -40]]) stampPrey(g, rel(g, dx, dy));
      if (g.isApex()) g.apexCalled = true;
      fill(g); g.events.length = 0;
      toCards(g);
      g.choose(0); hush(g);
    }
  }
  const mb = median(t.begin), mf = median(t.finish);
  assert.equal(t.begin.length, 6, "setup: zooms timed " + t.begin.length);
  assert.ok(mb <= 20 && mf <= 20, `median zoomBegin ${fx(mb)} ms, zoomFinish ${fx(mf)} ms (limit 20)`);
  return `zoomBegin median ${fx(mb)} ms (max ${fx(Math.max(...t.begin))}), zoomFinish median ${fx(mf)} ms (max ${fx(Math.max(...t.finish))}) over 6 crowded zooms`;
});

// ---------- 11-12: the next size ----------

test(11, "Size start", () => {
  const notes = [];
  for (const [w, h] of ROTS) {
    const g = setup(11, { w, h }); g.growHold = false; g.qa.immortal = false;
    const P = g.player;
    const red = spawn(g, SP.PARA, ...Object.values(rel(g, -108, 0)), 0); red.cool = Infinity;
    P.light = 50; P.maxLight = 100; P.charges = 0; P.chargeT = 99;
    fill(g); g.events.length = 0;
    let before = null, atCards = null;
    go(g, 600, {}, () => { if (g.state === "mutate") { atCards = g.growT; return false; } before = g.growT; });
    assert.ok(atCards !== null, "setup: no cards");
    assert.ok(atCards >= G.seq.cards - 1e-9 && atCards < G.seq.cards + DT + 1e-9 && before < G.seq.cards, `cards at growT ${fx(atCards, 3)} (frame before ${fx(before, 3)})`);
    const L0 = P.light, M0 = P.maxLight;
    const pick = g.offer.findIndex((m) => m.id !== "heart");
    g.choose(pick);
    const ev = g.events.splice(0), start = ev.find((v) => v.type === "epochStart"), L1 = P.light;
    const fails = [], chk = (ok, msg) => { if (!ok) fails.push(msg); };
    chk(P.maxLight === Math.min(G.maxLight.cap, M0 + G.maxLight.perSize), `max light ${M0} -> ${P.maxLight}`);
    chk(Math.abs(L1 - Math.min(P.maxLight, L0 + 30)) < 1e-9, `light ${fx(L0)} -> ${fx(L1)}`);
    chk(P.charges === g.maxCharges(), `charges ${P.charges} of ${g.maxCharges()}`);
    chk(g.director.relaxT === G.feast, `relaxT ${g.director.relaxT}`);
    chk(g.state === "play" && start && start.size === 2 && start.line === tierOf(2).line, "epochStart " + JSON.stringify(start));
    // wave 1 comes from the new territory, and no hunter warns in for 4 s
    const B = g.oldBox, warns = [];
    let firstWarn = null, waveAt = null;
    go(g, 10 * 60, {}, (evs2) => {
      if (firstWarn === null && evs2.some((v) => v.type === "warn")) firstWarn = g.epochTime;
      // the warnings that spawnWave() raised in wave 1's own frame
      if (evs2.some((v) => v.type === "wave")) { waveAt = g.epochTime; warns.push(...evs2.filter((v) => v.type === "warn")); }
      return waveAt === null;
    });
    chk(waveAt !== null, "no wave in 10 s");
    chk(firstWarn !== null && firstWarn >= G.feast - 1e-9, `first warning ${fx(firstWarn, 2)} s into the size`);
    const inside = warns.filter((v) => v.x >= B.x && v.x < B.x + B.w && v.y >= B.y && v.y < B.y + B.h);
    const far = warns.filter((v) => { const d = g.dist(v.x, v.y, P.x, P.y); return d < G.wave1.min - 1e-6 || d > G.wave1.max + 1e-6; });
    chk(warns.length >= 1, "setup: wave 1 warned nothing");
    chk(!inside.length && !far.length, `wave 1 warnings inside the old dish ${inside.length}, outside 34-70 cells ${far.length}: ${warns.map((v) => `${fx(v.x, 0)},${fx(v.y, 0)}`).join(" ")}`);
    assert.equal(fails.length, 0, `GAME BUG (${orient(g)}): ` + fails.join("; "));
    notes.push(`${orient(g)}: cards at ${fx(atCards, 3)}, light ${fx(L0, 1)} -> ${fx(L1, 1)}, max ${M0} -> ${P.maxLight}, ${P.charges} charges, wave 1 at ${fx(waveAt, 2)} s with ${warns.length} warnings ${warns.map((v) => fx(g.dist(v.x, v.y, P.x, P.y), 0)).join("/")} cells out, all outside the old dish`);
  }
  // the max light cap: +10 up to 150, never lowering a bigger heart
  const g = setup(11); const P = g.player;
  const caps = [100, 145, 150, 175].map((m) => { P.maxLight = m; g.state = "mutate"; g.nextEpoch(null); return P.maxLight; });
  assert.deepEqual(caps, [110, 150, 150, 175], "max light after a pick");
  notes.push(`max light 100/145/150/175 -> ${caps.join("/")}`);
  return notes.join("; ");
});

// wipe every hunter, as if the player had killed them all (waves clear, encores and loop waves follow)
function clearDish(g) { if (g.labelB) for (const e of [...g.hunters]) g.wipe(g.world.B, g.labelB, e.blob); }

test(12, "Never return", () => {
  const banned = { 2: [SP.PARA], 3: [SP.PARA, SP.PENTA], 4: [SP.PARA, SP.PENTA, SP.HEXA] };
  const UNIT = { P: SP.PARA, Q: SP.PENTA, H: SP.HEXA, T: SP.HEPTA, L: SP.HEPTA, D: SP.DISC, E: SP.EGG };
  const notes = [], bad = [];
  let loops = 0, encores = 0;
  for (const n of [2, 3, 4]) {
    // the size's own tables
    const T = TIERS[n], table = T.waves.flatMap((wv) => [...wv.units].map((u) => UNIT[u]));
    for (const sp of [...table, ...T.pool, T.head]) if (banned[n].includes(sp)) bad.push(`Size ${n} table names ${NAME[sp]}`);
    if (!T.line.includes(NAME[T.head])) bad.push(`Size ${n} banner "${T.line}" does not name ${NAME[T.head]}`);
    // and a long run with the director, encores and loop waves
    const g = new Game(256, 128, 120 + n);
    g.reset("play"); g.epoch = n; g.growHold = true;
    g.qa = { immortal: true, holdEpoch: false };
    const stamped = [], orig = g.stampHunter.bind(g);
    g.stampHunter = (species, x, y, angle, tags = {}) => { stamped.push({ species, wave: tags.wave, boss: !!tags.boss, t: g.epochTime }); return orig(species, x, y, angle, tags); };
    let lastClear = 0, waves = 0;
    go(g, 80 * 60, () => dodger(g), (ev) => {
      for (const v of ev) if (v.type === "wave") { waves++; if (v.wave === "+") loops++; }
      if (g.time - lastClear > 9 && g.hunters.some((e) => !e.egg)) { lastClear = g.time; clearDish(g); }
      return g.epochTime < 76;
    });
    const enc = stamped.filter((s) => s.wave === "encore").length;
    encores += enc;
    for (const s of stamped) if (banned[n].includes(s.species)) bad.push(`Size ${n}: ${NAME[s.species]} stamped at ${fx(s.t, 1)} s (wave ${s.wave})`);
    const kinds = {};
    for (const s of stamped) kinds[NAME[s.species]] = (kinds[NAME[s.species]] || 0) + 1;
    notes.push(`Size ${n}: ${stamped.length} stamps ${JSON.stringify(kinds)}, ${waves} waves, ${enc} encore units`);
  }
  assert.ok(loops >= 3, `setup: ${loops} loop waves in three sizes`);
  assert.ok(encores >= 1, "setup: no encore unit");
  assert.equal(bad.length, 0, "GAME BUG: an outgrown arc came back red: " + bad.slice(0, 4).join("; "));
  return `${notes.join("; ")}; ${loops} loop waves`;
});

// ---------- 13-16: the new moves and the common Heptapteryx ----------

test(13, "Double strike", () => {
  // a Size II Pentapteryx gliding +x toward the player, forced into its windup (as in combat test 15).
  // When its first lunge starts, the player stands at (118, 124): the second lane runs along +y.
  const strike = ({ egg = false, parry = null } = {}) => {
    const g = setup(13); g.epoch = 2;
    const P = g.player; P.x = 125; P.y = 64;
    const list = [{ sp: SP.PENTA, x: 100, y: 64, angle: Math.PI / 2, tags: { double: true } }];
    if (egg) list.push({ sp: SP.EGG, x: 118, y: 104, angle: 0 });
    const [e] = spawnMany(g, list);
    assert.ok(e.double, "setup: no double tag");
    e.token = true; g.beginWindup(e);
    const seen = [], lanes = [];
    let tReaim = null, moved = false, tried = false, stop = null, f = 0;
    while (f++ < 500 && (stop === null || f < stop)) {
      if (!moved && e.state === "lunge" && parry !== "first") { moved = true; P.x = 118; P.y = 124; P.vx = P.vy = 0; }
      let input = {};
      if (parry && !tried && (parry === "first" ? e.state === "windup" && g.windupLeft(e) <= TUNE.glint : e.state === "reaim" && e.glinted)) {
        const d = densest(g, e), ux = wdelta(e.x - d.x, g.w), uy = wdelta(e.y - d.y, g.h), l = Math.hypot(ux, uy) || 1;
        P.x = d.x; P.y = d.y; P.vx = P.vy = 0; P.charges = 2; tried = true;
        input = { mx: ux / l, my: uy / l, dash: true };
      }
      tick(g, input);
      for (const v of g.events) if (v.id === e.id && ["windup", "lock", "glint", "lunge", "recover", "cancel", "parry", "stagger"].includes(v.type)) {
        seen.push({ type: v.type, t: g.time });
        if (v.type === "lock") lanes.push({ ux: v.lane.ux, uy: v.lane.uy });
      }
      g.events.length = 0;
      if (tReaim === null && e.state === "reaim") tReaim = g.time;
      if (stop === null && seen.some((s) => ["cancel", "parry"].includes(s.type) || (s.type === "recover"))) stop = f + 60;
      if (stop === null && seen.filter((s) => s.type === "lunge").length >= 2 && e.state === "recover") stop = f + 60;
    }
    const t = (type, k = 0) => (seen.filter((s) => s.type === type)[k] || {}).t ?? null;
    return { g, e, seen, lanes, tReaim, t, types: seen.map((s) => s.type) };
  };
  const notes = [];
  // A: the full double strike
  {
    const r = strike();
    const n = (type) => r.types.filter((x) => x === type).length;
    assert.ok(n("lunge") >= 1, "setup: no first lunge: " + r.types.join(","));
    assert.ok(r.tReaim !== null, "GAME BUG: no re-aim after a completed lunge: " + r.types.join(","));
    assert.equal(n("lunge"), 2, "lunges: " + r.types.join(","));
    assert.ok(n("lock") === 2 && n("glint") === 2, "the second strike lacks a fresh lane or glint: " + r.types.join(","));
    const pause = r.t("lunge", 1) - r.tReaim;
    assert.ok(pause >= 0.25 - 1e-9, `re-aimed for ${fx(pause, 3)} s`);
    assert.ok(r.t("glint", 1) >= r.tReaim && r.t("glint", 1) <= r.t("lunge", 1), "the second glint is not inside the re-aim");
    const [a, b] = r.lanes, turn = Math.acos(Math.max(-1, Math.min(1, a.ux * b.ux + a.uy * b.uy))) * 180 / Math.PI;
    assert.ok(turn > 30, `the second lane turned only ${fx(turn, 0)} degrees toward the moved player`);
    assert.ok(n("recover") === 1 && r.e.state !== "lunge", "no recover after the second lunge: " + r.types.join(","));
    notes.push(`re-aim ${fx(pause, 2)} s, second lane turned ${fx(turn, 0)} deg, ${r.types.join(">")}`);
  }
  // B: a body in the second lane cancels the re-aim
  {
    const r = strike({ egg: true });
    const n = (type) => r.types.filter((x) => x === type).length;
    assert.ok(n("lunge") >= 1, "setup: the egg blocked the first lunge: " + r.types.join(","));
    assert.equal(n("lunge"), 1, "GAME BUG: the Pentapteryx struck again through a blocked lane: " + r.types.join(","));
    assert.ok(n("cancel") >= 1, "no cancel: " + r.types.join(","));
    assert.ok(!r.e.token && !r.e.second, `token ${r.e.token}, second ${r.e.second} after the cancel`);
    notes.push(`blocked: ${r.types.join(">")}`);
  }
  // C and D: the player can parry the second glint, and the first
  for (const which of ["second", "first"]) {
    const r = strike({ parry: which });
    const n = (type) => r.types.filter((x) => x === type).length;
    assert.ok(n("parry") === 1, `GAME BUG: no parry on the ${which} glint: ${r.types.join(",")}`);
    assert.ok(n("stagger") >= 1 && r.g.stats.parries === 1, `the ${which}-glint parry did not stagger it`);
    if (which === "second") assert.equal(n("lunge"), 1, "setup: the parry did not come in the re-aim");
    notes.push(`${which} glint parried`);
  }
  return notes.join("; ");
});

test(14, "Egg layer", () => {
  const g = setup(14); g.epoch = 3;
  const P = g.player; P.x = 180; P.y = 64;
  const e = spawn(g, SP.HEXA, 70, 64, 0, { layer: true }); e.cool = Infinity;
  assert.ok(e.layer, "setup: no layer tag");
  const born = e.born, laid = [], gaps = [], seenP = new Set(), seenE = new Set(), blocks = [];
  let maxMine = 0, hatched = 0, lost = false;
  const W = g.world, clearAt = g.clearAt.bind(g);
  // when the layer's spot is refused, note the body in the way
  g.clearAt = (x, y, reach) => {
    const ok = clearAt(x, y, reach);
    if (!ok) { const b = g.hunters.find((o) => g.dist(x, y, o.x, o.y) < g.reachOf(o) + reach + (o.egg ? TUNE.egg.spacing : 4)); blocks.push(b ? `${b.egg ? (b.mother === e.id ? "its own egg" : "an egg") : b === e ? "itself" : NAME[b.species]} ${fx(g.dist(x, y, b.x, b.y), 0)} cells away at ${fx(g.time - born, 1)} s` : "a spawn on its way"); }
    return ok;
  };
  go(g, 50 * 60, () => { const a = g.time * 0.35; return { target: { x: 128 + Math.cos(a) * 40, y: 64 + Math.sin(a) * 30 } }; }, (ev) => {
    hatched += ev.filter((v) => v.type === "hatch").length;
    if (!g.hunters.includes(e)) { lost = true; return false; }
    for (const p of g.pending) if (p.tags && p.tags.mother === e.id && !seenP.has(p)) { seenP.add(p); laid.push(g.time - born); }
    const mine = g.hunters.filter((o) => o.egg && o.mother === e.id);
    maxMine = Math.max(maxMine, mine.length + g.pending.filter((p) => p.tags && p.tags.mother === e.id).length);
    for (const egg of mine) {
      if (seenE.has(egg)) continue;
      seenE.add(egg);
      // the tissue gap between the new egg and its mother
      const ec = cellsOf(g, egg).filter((i) => W.B[i] > 0.15), mc = cellsOf(g, e).filter((i) => W.B[i] > 0.15);
      let gap = Infinity;
      for (const i of ec) for (const j of mc) gap = Math.min(gap, Math.hypot(wdelta((i % g.w) - (j % g.w), g.w), wdelta(((i / g.w) | 0) - ((j / g.w) | 0), g.h)));
      gaps.push(gap);
    }
    // hatched Discutium leave the dish at once, so the glider cap never holds an egg back
    if (g.labelB) for (const d of g.hunters) if (d.species === SP.DISC) g.wipe(W.B, g.labelB, d.blob);
    return g.time - born < 40;
  });
  assert.ok(!lost, "setup: the Hexapteryx was lost");
  assert.ok(laid.length >= 4, `setup: ${laid.length} eggs laid in 40 s`);
  const gapsT = laid.slice(1).map((t, k) => t - laid[k]);
  const fails = [];
  if (Math.abs(laid[0] - G.layer.first) > 0.6) fails.push(`first egg at ${fx(laid[0], 2)} s`);
  if (gapsT.some((d) => d < G.layer.every - 0.05 || d > G.layer.every + 0.6)) fails.push(`eggs ${gapsT.map((d) => fx(d, 2)).join(", ")} s apart, not ${G.layer.every}: the spot behind the mother was refused ${blocks.length} times (${blocks.filter((b, k) => k % 4 === 0).slice(0, 3).join("; ")}). clearAt() keeps a new egg ${fx(TUNE.egg.spacing + 2 * SPECIES[SP.EGG].reach, 1)} cells from any egg, so the next egg waits until the last one hatches${maxMine < G.layer.max ? ` and it never has ${G.layer.max} eggs alive` : ""}`);
  if (maxMine > G.layer.max) fails.push(`${maxMine} of its eggs alive at once`);
  if (Math.min(...gaps) < 9.8) fails.push(`an egg ${fx(Math.min(...gaps), 1)} cells of tissue from its mother`);
  assert.equal(fails.length, 0, "GAME BUG: " + fails.join("; "));
  return `laid at ${laid.map((t) => fx(t, 1)).join(", ")} s; at most ${maxMine} alive; tissue gaps ${gaps.map((d) => fx(d, 1)).join(", ")} cells; ${hatched} hatched`;
});

// A player who holds a spot and steps 22 cells away from any tissue closer than 9 cells, so hunters keep
// coming back into lunge range (a still player gets hugged at under 6 cells, where nothing lunges).
function kiter(g, S) {
  const P = g.player;
  if (!S.anchor) S.anchor = { x: P.x, y: P.y };
  for (const e of g.hunters) {
    if (e.egg || !(e.nd < 9)) continue;
    const dx = wdelta(P.x - e.nx, g.w), dy = wdelta(P.y - e.ny, g.h), d = Math.hypot(dx, dy) || 1;
    S.anchor = { x: wrap(P.x + (dx / d) * 22, g.w), y: wrap(P.y + (dy / d) * 22, g.h) };
    break;
  }
  return { target: { x: P.x + wdelta(S.anchor.x - P.x, g.w), y: P.y + wdelta(S.anchor.y - P.y, g.h) } };
}

// Follow relay pairs: windups of a paired hunter whose mate is alive, hand-offs, fusions and pair rules.
function relayWatch(g) {
  const key = (e) => e.pair || e.duo; // duo: a test-only tag for two unpaired Heptapteryx (the control)
  const r = { attacks: 0, handoffs: 0, twoWind: 0, overlap: 0, twoTok: 0, trios: 0, tides: 0, fused: 0, merged: [], otherDeaths: 0, firstFusion: null };
  const origTrack = g.track.bind(g);
  g.track = (kind) => {
    if (kind !== "hunter") return origTrack(kind);
    const before = new Map(g.hunters.map((e) => [e.id, e])), mark = g.events.length;
    origTrack(kind);
    for (const v of g.events.slice(mark)) {
      if (v.type !== "selfDeath") continue;
      const e = before.get(v.id), lab = e && e.maxI !== undefined && g.labelB ? g.labelB[e.maxI] : -1, into = lab >= 0 ? g.ownerOf[lab] : null;
      const nm = (o) => (o ? `${o.species !== undefined ? NAME[o.species] : "brood"}${key(o) ? " (" + key(o) + ")" : ""}` : "?");
      if (into) { r.merged.push(`${nm(e)} into ${nm(into)} at ${fx(g.time, 1)} s`); r.firstFusion = r.firstFusion ?? g.time; } else r.otherDeaths++;
    }
  };
  const lastEnd = new Map();
  r.frame = (ev) => {
    for (const v of ev) {
      if (v.type === "windup") {
        const e = g.hunters.find((o) => o.id === v.id), mate = e && key(e) ? g.hunters.find((o) => o !== e && key(o) === key(e)) : null;
        if (mate) { r.attacks++; const le = lastEnd.get(key(e)); if (le && le.id === mate.id && g.time - le.t < 0.6) r.handoffs++; }
      }
      if (v.type === "recover") { const e = g.hunters.find((o) => o.id === v.id); if (e && key(e)) lastEnd.set(key(e), { id: e.id, t: g.time }); }
      if (v.type === "tide") r.tides++;
      if (v.type === "rupture" && v.fused) { r.fused++; r.firstFusion = r.firstFusion ?? g.time; }
    }
    const groups = new Map();
    for (const e of g.hunters) if (key(e)) { if (!groups.has(key(e))) groups.set(key(e), []); groups.get(key(e)).push(e); }
    for (const m of groups.values()) {
      if (m.filter((e) => e.state === "windup").length > 1) r.twoWind++;
      if (m.filter((e) => ["windup", "lunge", "reaim"].includes(e.state)).length > 1) r.overlap++;
      if (m.filter((e) => e.token).length > 1) r.twoTok++;
      if (m.length > 2) r.trios++;
    }
  };
  return r;
}

// Pairs of Heptapteryx stamped on clear spots 62 cells either side of a kiting player, swarms kept on the
// dish, Size IV, until 100 attacks or 150 s. paired: a relay pair; otherwise two unpaired Heptapteryx.
function relayStress(w, h, paired) {
  const g = setup(15, { w, h }); g.epoch = 4;
  const P = g.player, S = {}, r = relayWatch(g), key = (e) => e.pair || e.duo;
  let pairs = 0;
  const t0 = g.time;
  go(g, 150 * 60, () => {
    const members = g.hunters.filter(key), coming = g.claims.some((c) => c.kind === "hunter" && (c.tags.pair || c.tags.duo));
    if (!coming && members.length < 2) {
      if (g.labelB) for (const e of members) g.wipe(g.world.B, g.labelB, e.blob); // a broken pair leaves
      // the first clear pair of spots 62 cells either side of the player, along the dish's long axis first
      const free = (q) => g.clearAt(q.x, q.y, SPECIES[SP.HEPTA].reach) && g.world.probe(g.world.B, q.x, q.y, SPECIES[SP.HEPTA].reach) < 0.5;
      for (let k = 0; k < 16 && !members.length; k++) {
        const a0 = (h > w ? Math.PI / 2 : 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const a = { x: wrap(P.x + Math.cos(a0) * 62, w), y: wrap(P.y + Math.sin(a0) * 62, h) }, b = { x: wrap(P.x - Math.cos(a0) * 62, w), y: wrap(P.y - Math.sin(a0) * 62, h) };
        if (g.dist(a.x, a.y, b.x, b.y) < 100 || !free(a) || !free(b)) continue; // on the torus, steep angles wrap the two spots together
        pairs++;
        const tag = paired ? { pair: `stress${pairs}:pair` } : { duo: `duo${pairs}` };
        for (const q of [a, b]) g.stampHunter(SP.HEPTA, q.x, q.y, g.angleToward(SP.HEPTA, q.x, q.y), { ...tag, wave: "relay" });
        break;
      }
    }
    const swarm = g.hunters.filter((e) => e.species === SP.DISC).length + g.pending.filter((p) => p.species === SP.DISC).length;
    if (swarm < 2 && g.capRoom(SP.DISC)) g.queueUnit(SP.DISC, { wave: "swarm" });
    return kiter(g, S);
  }, (ev) => { r.frame(ev); return r.attacks < 100; });
  return { orient: orient(g), pairs, t: g.time - t0, ...r };
}

test(15, "Relay gate", () => {
  const notes = [], fails = [];
  // A: the director's own pair (Size IV wave 1, "TT"): do both Heptapteryx reach the dish?
  for (const [w, h] of ROTS) {
    const g = new Game(w, h, 150 + w, { touch: h > w });
    g.reset("play"); g.epoch = 4; g.growHold = true;
    g.qa = { immortal: true, holdEpoch: true };
    const S = {};
    let both = null, queued = 0, warned = 0;
    go(g, 30 * 60, () => kiter(g, S), (ev) => {
      warned += ev.filter((v) => v.type === "warn" && v.name === "Heptapteryx").length;
      const on = g.hunters.filter((e) => e.pair).length + g.pending.filter((p) => p.tags && p.tags.pair).length + g.claims.filter((c) => c.kind === "hunter" && c.tags.pair).length;
      queued = Math.max(queued, g.director.queue.filter((q) => q.tags && q.tags.pair).length);
      if (on >= 2 && both === null) both = g.epochTime;
      return g.epochTime < 29;
    });
    notes.push(`${orient(g)} director pair: ${both === null ? `never both on the dish in 25 s (${warned} warned, ${queued} pair unit${queued === 1 ? "" : "s"} stuck in the queue)` : `both by ${fx(both, 1)} s`}`);
    if (both === null) fails.push(`${orient(g)}: the second Heptapteryx of a relay pair never left the director queue in 25 s. spawnWave() gives the pair spots ${44} cells on opposite sides of the player (at most 88 cells apart), but clearAt() needs ${fx(2 * SPECIES[SP.HEPTA].reach + 4, 1)} cells between two Heptapteryx, so the partner's spot is never clear`);
  }
  // B: the relay rules under stress: pairs stamped directly (the director cannot field them, see A)
  const runs = ROTS.map(([w, h]) => relayStress(w, h, true));
  for (const r of runs) console.log(`       ${r.orient} stress: ${r.attacks} relay attacks (${r.handoffs} hand-offs) in ${fx(r.t, 0)} s from ${r.pairs} pairs; fused ruptures ${r.fused}, merges ${r.merged.length}, other deaths ${r.otherDeaths}, tides ${r.tides}; two windups ${r.twoWind}, overlaps ${r.overlap}, two tokens ${r.twoTok}`);
  for (const r of runs) {
    if (r.fused || r.merged.length) fails.push(`${r.orient}: ${r.fused} fused ruptures and ${r.merged.length} merges in ${r.attacks} relay attacks, the first at ${fx(r.firstFusion, 1)} s (${r.merged.slice(0, 2).join("; ")})`);
    if (r.tides) fails.push(`${r.orient}: ${r.tides} red tides`);
    if (r.twoWind || r.overlap) fails.push(`${r.orient}: a pair wound up together on ${r.twoWind} frames, attacked together on ${r.overlap}`);
    if (r.twoTok || r.trios) fails.push(`${r.orient}: two tokens in a pair on ${r.twoTok} frames, three members on ${r.trios}`);
  }
  const total = runs.reduce((a, r) => a + r.attacks, 0);
  if (runs.some((r) => r.fused || r.merged.length)) {
    // control: the same stress with two unpaired Heptapteryx (no relay rules)
    const ctl = ROTS.map(([w, h]) => relayStress(w, h, false));
    for (const r of ctl) console.log(`       ${r.orient} control, unpaired: ${r.attacks} attacks with both alive in ${fx(r.t, 0)} s from ${r.pairs} duos; fused ruptures ${r.fused}, merges ${r.merged.length}, tides ${r.tides}`);
    const cf = ctl.reduce((a, r) => a + r.fused + r.merged.length, 0);
    fails.push(`control with two unpaired Heptapteryx (no relay rules): ${cf} fusions in ${ctl.reduce((a, r) => a + r.attacks, 0)} attacks${cf ? ", so the fusions come from two Heptapteryx hunting one player (the cap allows 2), not from the hand-off" : ""}`);
  }
  assert.equal(fails.length, 0, "GAME BUG: " + fails.join("; ") + `; ${total} relay attacks in all, gate needs 200 with 0 fusions`);
  assert.ok(total >= 200, `setup: only ${total} relay attacks in ${fx(runs.reduce((a, r) => a + r.t, 0), 0)} s`);
  return `${notes.join("; ")}; stress ${total} relay attacks, 0 fusions, 0 tides`;
});

test(16, "Common Heptapteryx and the Leviathan", () => {
  const notes = [];
  // A: a common Heptapteryx takes an attack token to wind up
  {
    const g = setup(16); g.epoch = 4;
    const P = g.player; P.x = 128; P.y = 64;
    const e = spawn(g, SP.HEPTA, 128, 18);
    assert.ok(!e.boss, "setup: a boss");
    let wind = null;
    go(g, 8 * 60, {}, (ev) => { if (ev.some((v) => v.type === "windup" && v.id === e.id)) { wind = { token: e.token, held: g.hunters.filter((o) => o.token).length }; return false; } });
    assert.ok(wind, "setup: no windup in 8 s");
    assert.ok(wind.token && wind.held === 1, `GAME BUG: a common Heptapteryx wound up without a token (${JSON.stringify(wind)})`);
    notes.push("winds up with a token");
  }
  // B and C: Glory Bites pay 1500 and 2 Remains for the common one, 2500 and 3 for the Leviathan
  for (const boss of [false, true]) {
    const g = setup(16); g.epoch = 4;
    const P = g.player; P.x = 128; P.y = 110;
    const e = spawn(g, SP.HEPTA, 128, 40, 0, boss ? { boss: true } : {});
    e.cool = Infinity;
    let dev = null;
    if (boss) dev = killBoss(g, e);
    else {
      g.stagger(e, "tear");
      go(g, 60, () => { if (g.hunters.includes(e)) { const d = densest(g, e); mouthOn(g, d.x, d.y); } return {}; }, (ev) => { dev = ev.find((v) => v.type === "devour" && v.kind === "hunter") || null; return !dev; });
    }
    assert.ok(dev && dev.how === "glory", "setup: no Glory Bite");
    const drops = g.claims.filter((c) => c.kind === "prey" && c.tags.remains).length + g.prey.filter((p) => p.remains).length;
    const want = boss ? { pts: 2500, n: 3 } : { pts: 1500, n: SPECIES[SP.HEPTA].remains };
    frames(g, 90, {});
    const tracked = g.prey.filter((p) => p.remains).length;
    assert.equal(dev.points, want.pts * dev.mult, `GAME BUG: ${boss ? "the Leviathan" : "a common Heptapteryx"} paid ${dev.points} at x${dev.mult}`);
    assert.equal(drops, want.n, `GAME BUG: ${boss ? "the Leviathan" : "a common Heptapteryx"} dropped ${drops} Remains`);
    notes.push(`${boss ? "Leviathan" : "common"}: ${dev.points} at x${dev.mult} (${dev.points / dev.mult} each), ${drops} Remains (${tracked} tracked 1.5 s later)`);
  }
  // D: at most 2 common Heptapteryx, counting ones on their way; the Leviathan does not count
  {
    const g = setup(16); g.epoch = 4;
    const T = (boss) => ({ kind: "hunter", species: SP.HEPTA, x: 0, y: 0, t: 99, total: 99, name: "Heptapteryx", boss, tags: {} });
    const room = [];
    g.pending.push(T(false)); room.push(g.capRoom(SP.HEPTA));
    g.pending.push(T(true)); room.push(g.capRoom(SP.HEPTA));
    g.claims.push({ kind: "hunter", x: 0, y: 0, at: g.time, tags: { species: SP.HEPTA, name: "Heptapteryx" } }); room.push(g.capRoom(SP.HEPTA));
    assert.deepEqual(room, [true, true, false], "Heptapteryx room with 1 common, 1 common + boss, 2 common");
    assert.ok(g.capRoom(SP.DISC), "the Heptapteryx cap blocked a Discutium");
    notes.push("cap: 2 common Heptapteryx (boss not counted)");
  }
  return notes.join("; ");
});

// ---------- extra: found while writing 7 ----------

test(17, "The body takes the new size's radius at the swap", () => {
  // design section 4 step 5: at zoomBegin P.r becomes base(n + 1). game.js easeBody() eases the drawn
  // cell toward P.r from growT 1.60 (the pop to the new base) and through the cards.
  const g = setup(17); g.growHold = false;
  const P = g.player;
  const e = spawn(g, SP.PARA, 20, 64, 0); e.cool = Infinity;
  fill(g); g.events.length = 0;
  let atStart = null, atBegin = null, atFinish = null;
  go(g, 400, {}, (ev) => {
    if (ev.some((v) => v.type === "growStart")) atStart = P.r;
    if (ev.some((v) => v.type === "zoomBegin")) atBegin = P.r;
    if (ev.some((v) => v.type === "zoomFinish")) atFinish = P.r;
    return g.state !== "mutate";
  });
  const atCards = P.r, want = g.baseR(2);
  g.choose(0); tick(g, {});
  assert.ok(Math.abs(P.r - want) < 1e-9, `setup: in play P.r is ${P.r}, base ${want}`);
  assert.ok([atBegin, atFinish, atCards].every((r) => Math.abs(r - want) < 1e-9),
    `GAME BUG: P.r stays at the old full radius through the swap (growStart ${fx(atStart, 2)}, zoomBegin ${fx(atBegin, 2)}, zoomFinish ${fx(atFinish, 2)}, cards ${fx(atCards, 2)}) and only becomes the Size II base ${fx(want, 2)} when play resumes. game.js easeBody() eases the drawn cell toward P.r from growT 1.60, so the body swells to ${fx(atCards, 2)} cells over the cards and shrinks after the pick`);
  return `P.r ${fx(atStart, 2)} -> ${fx(atBegin, 2)} at the swap, ${fx(atCards, 2)} at the cards, ${fx(P.r, 2)} in play`;
});

test(18, "No timer: loop waves and late golden prey", () => {
  // spec "No timer": a size lasts until the dish grows; from 40 s a wave every 14 s, from 60 s a golden Orbium every 12 s
  const g = new Game(256, 128, 18);
  g.reset("play"); g.growHold = true; // the bar cannot fill: the size has to last on its own
  g.qa = { immortal: true, holdEpoch: false };
  const loops = [], golden = [], other = [];
  go(g, 95 * 60, () => dodger(g), (ev) => {
    for (const v of ev) {
      if (v.type === "wave" && v.wave === "+") loops.push(g.epochTime);
      if (v.type === "spawn" && v.kind === "prey" && v.golden) golden.push(g.epochTime);
      if (["epochEnd", "growStart", "zoomBegin", "death"].includes(v.type)) other.push(v.type);
    }
    return g.epochTime < 92;
  });
  const fails = [];
  if (other.length || g.state !== "play" || g.epoch !== 1) fails.push(`the size ended: ${other.join(",")}, state ${g.state}, size ${g.epoch}`);
  const gaps = (a) => a.slice(1).map((t, k) => t - a[k]);
  if (!loops.length || loops[0] < G.loop.from - 1e-6 || loops[0] > G.loop.from + 0.5 || gaps(loops).some((d) => Math.abs(d - G.loop.every) > 0.5)) fails.push(`loop waves at ${loops.map((t) => fx(t, 1)).join(", ")} s`);
  const late = golden.filter((t) => t >= G.goldenLate.after);
  const lateGaps = gaps([G.goldenLate.after, ...late]);
  if (late.length < 2 || lateGaps.some((d) => d > G.goldenLate.every + 1.5)) fails.push(`golden Orbium at ${golden.map((t) => fx(t, 1)).join(", ")} s: after ${G.goldenLate.after} s the gaps are ${lateGaps.map((d) => fx(d, 1)).join(", ")} s, not ${G.goldenLate.every}. The cooldown set by the last golden before ${G.goldenLate.after} s (22 to 32 s) keeps running; updateSpawns() only uses the ${G.goldenLate.every} s gap when the next golden spawns`);
  assert.equal(fails.length, 0, "GAME BUG: " + fails.join("; "));
  return `92 s in Size I: loop waves at ${loops.map((t) => fx(t, 1)).join(", ")} s; golden at ${golden.map((t) => fx(t, 1)).join(", ")} s`;
});

console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
