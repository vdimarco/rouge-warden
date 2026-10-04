// Lenia behaviour that Primordia depends on. Usage: node qa/primordia/lenia.test.mjs
import assert from "node:assert/strict";
import { World, RULES, findBlobs, decodeCells } from "../../public/primordia/lenia.js";
import { ORBIUM, HUNTERS } from "../../public/primordia/species.js";
import { Game, GAME_RULES, SPECIES, SP, TUNE, MUTATIONS, HUNTER_R, wrap, wdelta } from "../../public/primordia/core.js";

const results = [];
let failures = 0;
const test = (name, fn) => {
  const t0 = Date.now();
  try { fn(); results.push(`ok  ${name} (${Date.now() - t0} ms)`); }
  catch (err) { failures++; results.push(`FAIL ${name} (${Date.now() - t0} ms)\n     ${String(err.message).split("\n")[0]}`); }
};
const orb = decodeCells(ORBIUM);
const biggest = (field, w, h) => findBlobs(field, w, h).blobs.sort((a, b) => b.mass - a.mass)[0];

test("species decode to the published sizes", () => {
  assert.equal(orb.length, 20);
  assert.deepEqual(HUNTERS.map((h) => Math.max(...decodeCells(h.cells).map((r) => r.length))), [49, 63, 76, 92]);
});

test("Orbium glides and keeps its mass", () => {
  const w = new World(256, 128, GAME_RULES);
  w.stamp(w.A, orb, 128, 64, 0.4, 1);
  for (let s = 0; s < 30; s++) w.step();
  const a = biggest(w.A, 256, 128);
  for (let s = 0; s < 300; s++) w.step();
  const b = biggest(w.A, 256, 128);
  const moved = Math.hypot(wdelta(b.x - a.x, 256), wdelta(b.y - a.y, 128));
  assert.ok(moved > 60, "moved " + moved);
  assert.ok(Math.abs(b.mass - a.mass) < 10, `mass ${a.mass} -> ${b.mass}`);
});

test("each hunter species lives alone for 800 steps", () => {
  // the four arcs, Discutium and the Circium egg; each keeps its species mass
  for (const sp of SPECIES) {
    const w = new World(256, 128, GAME_RULES);
    w.stamp(w.B, sp.rows, 128, 64, 0.7, HUNTER_R / 13);
    for (let s = 0; s < 800; s++) w.step();
    const blobs = findBlobs(w.B, 256, 128).blobs;
    assert.equal(blobs.length, 1, sp.name + " blobs " + blobs.length);
    assert.ok(Math.abs(blobs[0].mass - sp.mass) < 0.15 * sp.mass, `${sp.name} mass ${blobs[0].mass.toFixed(0)} vs ${sp.mass}`);
  }
});

test("a hunter dragged toward a point survives and closes in", () => {
  const w = new World(256, 128, GAME_RULES);
  w.stamp(w.B, SPECIES[1].rows, 128, 64, 1, HUNTER_R / 13);
  for (let s = 0; s < 40; s++) w.step();
  const px = 40, py = 20;
  const dist = (c) => Math.hypot(wdelta(px - c.x, 256), wdelta(py - c.y, 128));
  const start = dist(biggest(w.B, 256, 128));
  let c;
  for (let s = 0; s < 500; s++) {
    c = biggest(w.B, 256, 128);
    const dx = wdelta(px - c.x, 256), dy = wdelta(py - c.y, 128), d = Math.hypot(dx, dy) || 1;
    w.advect(w.B, c.x, c.y, SPECIES[1].reach, (dx / d) * 0.12, (dy / d) * 0.12);
    w.step();
  }
  assert.ok(c.mass > 200, "mass " + c.mass);
  assert.ok(dist(c) < start - 30, `distance ${start.toFixed(0)} -> ${dist(c).toFixed(0)}`);
});

test("a prey bloom starves on the agar", () => {
  const w = new World(256, 128, GAME_RULES);
  w.limit.A = 1300;
  for (let k = 0; k < 8; k++) w.stamp(w.A, orb, 20 + k * 30, 70 + ((k * 37) % 40), k * 0.8, 1);
  let peak = 0;
  for (let s = 0; s < 1500; s++) { w.step(); peak = Math.max(peak, w.massA); }
  assert.ok(w.massA < 1300, `mass after 1500 steps ${w.massA.toFixed(0)} (peak ${peak.toFixed(0)})`);
});

test("a red tide burns out under the quorum toxin", () => {
  const w = new World(256, 128, GAME_RULES);
  w.limit.B = 420 + 380 * 3;
  [0, 1, 2, 0, 1, 2].forEach((sp, k) => w.stamp(w.B, SPECIES[sp].rows, 30 + k * 40, k % 2 ? 40 : 90, k * 1.1, HUNTER_R / 13));
  for (let s = 0; s < 900; s++) w.step();
  assert.ok(w.massB < w.limit.B, "massB " + w.massB.toFixed(0));
});

test("eating a whole Orbium counts as a devour and feeds the player", () => {
  const g = new Game(256, 128, 3);
  g.reset("play");
  const P = g.player;
  const e = g.prey[0];
  P.light = 50;
  let devoured = 0;
  for (let i = 0; i < 400 && !devoured; i++) {
    const tgt = g.prey.find((p) => p.id === e.id) || e;
    g.update(1 / 60, { target: null, mx: Math.sign(wdelta(tgt.x - P.x, g.w)) * Math.min(1, Math.abs(wdelta(tgt.x - P.x, g.w)) / 3), my: Math.sign(wdelta(tgt.y - P.y, g.h)) * Math.min(1, Math.abs(wdelta(tgt.y - P.y, g.h)) / 3) });
    devoured = g.events.filter((ev) => ev.type === "devour" && ev.kind === "prey").length;
    g.events.length = 0;
  }
  assert.ok(devoured >= 1, "no devour");
  assert.ok(g.stats.prey >= 1);
  assert.ok(g.score > 60);
});

test("Burst tears and staggers nearby hunters, then the maw eats them", () => {
  const g = new Game(256, 128, 4);
  g.reset("play");
  // no scripted waves: this test places its own hunter
  Object.assign(g.director, { spawned: [true, true, true], cleared: [true, true, true], encoreCd: Infinity });
  const P = g.player;
  const hx = wrap(P.x + 24, g.w), hy = P.y;
  g.stampHunter(SP.PARA, hx, hy, g.angleToward(SP.PARA, hx, hy));
  for (let i = 0; i < 20; i++) g.update(1 / 60, {});
  assert.equal(g.hunters.length, 1);
  const h = g.hunters[0];
  assert.ok(h.nd <= TUNE.burst.catch, "hunter tissue " + h.nd + " cells away");
  g.meter = 1; g.ready = true;
  g.events.length = 0;
  g.update(1 / 60, { burst: true });
  const burst = g.events.find((e) => e.type === "burst");
  assert.ok(burst && burst.caught === 1, "burst " + JSON.stringify(burst));
  assert.ok(g.burstT > 0);
  assert.ok(g.meter < 1 && !g.ready, "the meter was not spent"); // exact refund rules: combat.test.mjs 33
  assert.equal(h.state, "stagger");
  assert.ok(h.tear >= TUNE.stagger, "tear " + h.tear);
  let devour = null;
  for (let i = 0; i < 900 && !devour; i++) {
    g.burstT = Math.max(g.burstT, 2); P.light = P.maxLight;
    // aim at real tissue: an arc's centroid sits in its empty hollow
    if (g.hunters.includes(h)) {
      let bi = -1, bv = 0;
      for (let k = 0; k < g.labelB.length; k++) if (g.labelB[k] === h.blob && g.world.B[k] > bv) { bv = g.world.B[k]; bi = k; }
      if (bi >= 0) { P.x = bi % g.w; P.y = (bi / g.w) | 0; }
    }
    g.update(1 / 60, {});
    devour = g.events.find((e) => e.type === "devour" && e.kind === "hunter");
    g.events.length = 0;
  }
  assert.ok(devour, "the hunter was not eaten");
  assert.equal(devour.species, SP.PARA);
  assert.ok(["glory", "burst", "bleed"].includes(devour.how), "how " + devour.how);
  assert.equal(g.stats.hunters, 1);
});

test("a full GROW bar grows the dish, then three mutation cards and the pick applies", () => {
  const g = new Game(256, 128, 5);
  g.reset("play");
  g.growth = g.bar() - 1;
  g.addGrowth(1, g.player.x, g.player.y);
  assert.ok(g.ripe, "a full bar is ripe");
  g.afterBoss = true; // grow at once: no hunter needs to be on the dish for this test
  for (let i = 0; i < 200 && g.state !== "mutate"; i++) g.update(1 / 30, {});
  assert.equal(g.state, "mutate");
  assert.equal(g.offer.length, 3);
  assert.ok(g.offer.filter((m) => m.kind === "build").length >= 2, "offer " + g.offer.map((m) => m.id));
  assert.ok(g.offer.every((m) => MUTATIONS.includes(m) && m.kind !== "duo"), "a fresh run cannot be offered a Duo");
  const id = g.offer[0].id;
  assert.ok(g.choose(0));
  assert.equal(g.mut[id], 1);
  assert.equal(g.epoch, 2);
  assert.equal(g.state, "play");
});

console.log(results.join("\n"));
process.exitCode = failures ? 1 : 0;
