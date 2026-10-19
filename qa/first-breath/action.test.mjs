// First Breath: the shared action layer (core/lib/action.js) and its bot (core/lib/actionbot.js), as
// openspec/changes/first-breath-action-genres/contract.md gives them. In node, with no DOM:
// - determinism: the same seed and intents give the same world, step for step (and another seed another one);
// - movement: the move vector eases the body to full speed, the arena's wall holds it, a hit-stop holds the world;
// - the dash: a press bursts along the move (or the facing), gives i-frames, and waits out its cooldown (a press in
//   the cooldown is buffered for 0.12 s, never lost);
// - collisions and i-frames: a foe bullet hits the hitbox (not the body), takes hp, starts i-frames in which nothing
//   hits, clears the foe bullets near you, and sets the flash, a shake and a hit-stop; contact with a foe hits too;
// - auto-aim: your sparks go to the nearest foe in range (never one still spawning, never one out of range), at the
//   fire rate, with the spread and pierce as stats;
// - patterns: aimed (a stack), fan, ring, spiral and wave make the bullets they say, at the angles they say, each
//   after its telegraph; the pool never passes its cap;
// - foes: chase closes in, orbit circles at its radius, shooter keeps its range, wander stays in the arena; a clear
//   gives score times the combo, drops food, and the combo lapses;
// - pickups: food is drawn in and counted, heal heals, the vacuum pulls all;
// - the safe zone shrinks on its clock and costs hp outside it;
// - the knock-out path: hp 0 sets ko and emits "ko" (never throws, the stage decides); the view validates throughout;
// - the bot dodges: at skill 1 it takes far fewer hits than standing still under the same fire, and its answer at
//   skill 1 needs no memory;
// - perf: a step with 600 bullets, 48 foes and 96 pickups stays far under the 1 ms budget (p99).
// node qa/first-breath/action.test.mjs
import assert from "node:assert/strict";
import * as X from "../../public/first-breath/core/lib/action.js";
import { actionSteer, BOT } from "../../public/first-breath/core/lib/actionbot.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { emptyDraw, validate } from "../../public/first-breath/core/draw.js";
import { DT } from "../../public/first-breath/core/clock.js";
import { stream } from "../../public/first-breath/core/rng.js";

const FILE = "qa/first-breath/action.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.stack || e.message).split("\n").slice(0, 8).join("\n     ")}`); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const still = () => makeIntents();
const move = (x, y) => makeIntents({ steer: { x, y }, touching: true });
const dash = (x = 0, y = 0, t = 0) => makeIntents({ steer: { x, y }, touching: true, presses: [{ t, raw: t }] });
const steps = (A, n, it = still) => { for (let i = 0; i < n; i++) X.stepWorld(A, typeof it === "function" ? it(i) : it); };
const viewOk = (A) => { const d = emptyDraw("grow"); d.action = { ...X.actionView(A), arena: A.arena }; return validate(d); };
const quiet = (o = {}) => X.createWorld(1, { fire: null, ...o });            // no auto-fire unless asked

await check("determinism: the same seed and input give the same world; another seed differs", () => {
  const run = (seed) => {
    const A = X.createWorld(seed);
    const W = X.makeWaves([{ at: 0.2, kind: "germ", ai: "chase", n: 4, spread: 0.3 },
      { at: 0.5, kind: "blob", ai: "shooter", hp: 4, gun: { pattern: { kind: "fan", n: 3, arc: 0.3, speed: 25 }, every: 0.8, tellS: 0.3, first: 0.6 } },
      { at: 0.8, kind: "spore", ai: "wander", n: 5, spread: 0.2 }]);
    const r = stream(seed, "input");
    for (let i = 0; i < 600; i++) {
      X.spawnDue(A, W);
      X.stepWorld(A, makeIntents({ steer: { x: Math.cos(i / 40), y: Math.sin(i / 50) }, touching: true, presses: r() < 0.01 ? [{ t: 0, raw: 0 }] : [] }));
    }
    return JSON.stringify(X.actionView(A), (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)) + "|" + A.score + "|" + A.hits + "|" + A.kills;
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

await check("movement: the stick eases the body to full speed; the wall holds it; a hit-stop holds the world", () => {
  const A = quiet();
  steps(A, 30, move(1, 0));
  near(A.p.vx, A.p.speed, 0.5, "full speed in half a second");
  assert.ok(A.p.x > 5, `moved: ${A.p.x}`);
  steps(A, 400, move(1, 0));
  near(Math.hypot(A.p.x, A.p.y), A.arena.r - A.p.body * 0.8, 1e-3, "held at the wall");
  X.hitStop(A, 4);
  const x0 = A.p.x, t0 = A.t;
  assert.equal(X.stepWorld(A, move(-1, 0)), false, "a hit-stop step does not move");
  steps(A, 3, move(-1, 0));
  assert.equal(A.p.x, x0); assert.equal(A.t, t0, "the world clock holds still");
  assert.equal(X.stepWorld(A, move(-1, 0)), true, "then it moves on");
  assert.ok(A.p.x < x0);
});

await check("the dash: a press bursts along the move with i-frames, waits out its cooldown, and is buffered, never lost", () => {
  const A = quiet();
  X.stepWorld(A, dash(0, 1));
  assert.equal(A.dashes, 1);
  assert.ok(A.p.inv >= X.ACT.dash.invS - 2 * DT, "i-frames");
  near(A.p.vy, X.ACT.dash.speed, 1e-6, "dash speed along the move");
  steps(A, Math.round(X.ACT.dash.s / DT));
  near(A.p.y, X.ACT.dash.speed * X.ACT.dash.s, 3, "about speed × time");
  assert.ok(A.out.length === 0 || !A.out.some((o) => o.type === "dash"));
  X.stepWorld(A, dash(1, 0));
  assert.equal(A.dashes, 1, "no dash in the cooldown");
  // a press made 0.1 s before the cooldown ends is kept and fires as it ends
  const B = quiet();
  X.stepWorld(B, dash(0, 1));
  steps(B, Math.round((X.ACT.dash.cdS - 0.1) / DT));
  X.stepWorld(B, dash(1, 0));
  steps(B, 8);
  assert.equal(B.dashes, 2, "the buffered press dashed once the cooldown ended");
  // with no move, it dashes the way you last faced
  const C = quiet();
  steps(C, 10, move(-1, 0));
  steps(C, 30);
  X.stepWorld(C, dash(0, 0));
  assert.ok(C.p.vx < -X.ACT.dash.speed * 0.99, `dash along the facing: ${C.p.vx}`);
  // no dash at all when the world has none
  const D = quiet({ dash: null });
  X.stepWorld(D, dash(1, 0));
  assert.equal(D.dashes, 0);
});

await check("collisions and i-frames: a bullet hits the hitbox, not the body; i-frames; mercy clear; juice; contact", () => {
  const A = quiet();
  // a bullet that passes 2.5 u from the centre misses the hitbox (r 1.7 + 1.4 = 3.1? no: 2.5 < 3.1 hits) — so 3.6 misses
  X.addBullet(A, 2, -20, 3.6, 60, 0, { r: 1.4 });
  steps(A, 60);
  assert.equal(A.hits, 0, "inside the body but outside the hitbox: no hit");
  X.addBullet(A, 2, -20, 2.5, 60, 0, { r: 1.4 });
  X.addBullet(A, 2, 6, 6, 0, 0, { r: 1.4, life: 10 });           // a still bullet near you: the mercy clear takes it
  let hitAt = -1;
  for (let i = 0; i < 60 && hitAt < 0; i++) { X.stepWorld(A, still()); if (A.hits) hitAt = i; }
  assert.equal(A.hits, 1);
  assert.equal(A.p.hp, X.ACT.player.hp - 1);
  assert.ok(A.out.some((o) => o.type === "ouch"));
  assert.equal(A.b.n, 0, "the bullets within mercyR were cleared");
  assert.equal(A.juice.flash, 1); assert.ok(A.juice.shake > 0.5); assert.equal(A.juice.stop, X.ACT.juice.stopHit);
  near(A.p.inv, X.ACT.player.invS, 1e-9, "i-frames");
  // during i-frames another bullet passes through
  steps(A, X.ACT.juice.stopHit + 2);
  X.addBullet(A, 2, -6, 0, 60, 0, { r: 1.4 });
  steps(A, 20);
  assert.equal(A.hits, 1, "no hit in i-frames");
  // contact with a foe (after the i-frames)
  steps(A, 70);
  const f = X.spawnFoe(A, { kind: "germ", ai: "chase", x: 10, y: 0, speed: 20, spawnS: 0, anywhere: true });
  steps(A, 60);
  assert.equal(A.hits, 2, "a chaser's touch hits");
  assert.ok(Math.hypot(f.x - A.p.x, f.y - A.p.y) > A.p.r, "and is pushed off");
  assert.deepEqual(viewOk(A), []);
});

await check("auto-aim: the nearest active foe in range, at the fire rate, with spread and pierce", () => {
  const A = X.createWorld(2, { fire: { rate: 5, range: 40, spread: 1, pierce: 0 } });
  X.spawnFoe(A, { kind: "germ", ai: "still", x: 60, y: 0, spawnS: 0, hp: 99 });            // out of range
  X.spawnFoe(A, { kind: "germ", ai: "still", x: 0, y: 12, spawnS: 1.0, hp: 99, anywhere: true });   // still spawning
  steps(A, 30);
  assert.equal(A.shots, 0, "nothing in range and active");
  const near1 = X.spawnFoe(A, { kind: "germ", ai: "still", x: -20, y: 0, spawnS: 0, hp: 99 });
  steps(A, 60);
  near(A.shots, 5, 1, "5 a second");
  // every spark flies at the nearest (−20, 0) or (0, 12) once it is active: here the one at (0, 12) is nearer
  const B = X.createWorld(2, { fire: { rate: 5, range: 40 } });
  X.spawnFoe(B, { kind: "germ", ai: "still", x: -20, y: 0, spawnS: 0, hp: 99 });
  X.spawnFoe(B, { kind: "germ", ai: "still", x: 0, y: 12, spawnS: 0, hp: 99, anywhere: true });
  X.stepWorld(B, still());
  assert.equal(B.b.n, 1);
  near(Math.atan2(B.b.vy[0], B.b.vx[0]), Math.PI / 2, 1e-3, "aimed at the nearer foe");
  assert.ok(B.foes[0].hp === 99 && near1);
  // spread 3: three sparks per shot, `arc` apart; pierce 1 passes through one foe into the next
  const C = X.createWorld(2, { fire: { rate: 5, range: 60, spread: 3, arc: 0.2, pierce: 1, dmg: 1 } });
  X.spawnFoe(C, { kind: "germ", ai: "still", x: 0, y: 10, spawnS: 0, hp: 99, anywhere: true });
  X.spawnFoe(C, { kind: "germ", ai: "still", x: 0, y: 20, spawnS: 0, hp: 99, anywhere: true });
  X.stepWorld(C, still());
  assert.equal(C.b.n, 3);
  const angs = [0, 1, 2].map((i) => Math.atan2(C.b.vy[i], C.b.vx[i])).sort((a, b) => a - b);
  near(angs[1] - angs[0], 0.2, 1e-4, "arc"); near(angs[2] - angs[1], 0.2, 1e-4, "arc");
  steps(C, 20);
  assert.ok(C.foes[0].hp < 99 && C.foes[1].hp < 99, "the middle spark pierced into the second foe");
});

await check("patterns: aimed (a stack), fan, ring, spiral and wave, each after its telegraph", () => {
  const A = quiet();
  const count = (pat, ang = 0) => { const n0 = A.b.n; const made = X.shoot(A, 0, 20, pat, ang); assert.equal(A.b.n - n0, made); return made; };
  assert.equal(count({ kind: "aimed", n: 3, speed: 20 }), 3);
  const sp = [A.b.n - 3, A.b.n - 2, A.b.n - 1].map((i) => Math.hypot(A.b.vx[i], A.b.vy[i]));
  assert.ok(sp[0] < sp[1] && sp[1] < sp[2], "a stack at rising speeds");
  assert.equal(count({ kind: "fan", n: 5, arc: 0.25, speed: 20 }, 1), 5);
  const fan = [0, 1, 2, 3, 4].map((k) => Math.atan2(A.b.vy[A.b.n - 5 + k], A.b.vx[A.b.n - 5 + k]));
  near(fan[2], 1, 1e-6, "a fan is centred on its angle"); near(fan[4] - fan[0], 1, 1e-5, "4 arcs wide");
  assert.equal(count({ kind: "ring", n: 12, speed: 20 }), 12);
  assert.equal(count({ kind: "spiral", arms: 3, speed: 20 }), 3);
  const wv = count({ kind: "wave", n: 1, speed: 20, w: 4, wf: 6 }, -Math.PI / 2);
  assert.equal(wv, 1);
  const i = A.b.n - 1;
  const xs = [];
  for (let k = 0; k < 30; k++) { X.stepWorld(A, still()); xs.push(A.b.x[A.b.n - 1]); }
  assert.ok(Math.max(...xs) - Math.min(...xs) > 3, "a wave weaves across its path");
  void i;
  // a foe's gun telegraphs first (its tell lasts tellS), then fires
  const B = quiet();
  B.p.x = 0; B.p.y = -20;
  X.spawnFoe(B, { kind: "blob", ai: "still", x: 0, y: 20, spawnS: 0, hp: 50, gun: { pattern: { kind: "fan", n: 3, arc: 0.3, speed: 20 }, every: 2, tellS: 0.5, first: 1.0, jitter: 0 } });
  let tellAt = null, fireAt = null;
  for (let k = 0; k < 120; k++) {
    X.stepWorld(B, still());
    if (tellAt === null && B.tells.some((t) => t.kind === "fan")) tellAt = B.t;
    if (fireAt === null && B.out.some((o) => o.type === "fire")) fireAt = B.t;
  }
  near(tellAt, 0.5, 2 * DT, "the tell starts tellS before the shot");
  near(fireAt, 1.0, 2 * DT, "the shot comes on time");
  // the pool never passes its cap
  const C = quiet({ bulletCap: 9999 });
  C.p.x = 30;
  for (let k = 0; k < 80; k++) X.shoot(C, 0, 0, { kind: "ring", n: 12, speed: 1, life: 99 }, 0);
  assert.equal(C.b.n, X.ACT.caps.bullets);
  assert.equal(X.addBullet(C, 2, 0, 0, 1, 0), -1);
  // a foe pattern waits: past the stage's bullet cap, or starting within safeR (14 u) of you
  const D = quiet({ bulletCap: 30 });
  D.p.x = 30;
  assert.equal(X.shoot(D, 0, 0, { kind: "ring", n: 24, speed: 1 }, 0), 24);
  assert.equal(X.shoot(D, 0, 0, { kind: "ring", n: 12, speed: 1 }, 0), -1, "past the cap: it waits");
  assert.equal(X.shoot(D, 20, 0, { kind: "aimed", n: 1, speed: 1 }, 0), -1, "10 u from you: it waits");
  assert.equal(X.foeBullets(D), 24);
  // a foe's gun that is blocked keeps its aim and fires once it can
  const G = quiet();
  X.spawnFoe(G, { kind: "blob", ai: "still", x: 0, y: 30, spawnS: 0, hp: 50, gun: { pattern: { kind: "aimed", n: 1, speed: 20 }, every: 2, tellS: 0.3, first: 0.5, jitter: 0 } });
  G.p.y = 22;                                                      // 8 u away: it may not fire
  steps(G, 60);
  assert.equal(X.foeBullets(G), 0, "no shot within 14 u");
  G.p.y = 0;
  steps(G, 3);
  assert.equal(X.foeBullets(G), 1, "it fires as soon as you are clear");
});

await check("foes: chase, orbit, shooter and wander; a clear scores times the combo, drops food; the combo lapses", () => {
  const A = quiet();
  const c = X.spawnFoe(A, { kind: "germ", ai: "chase", x: 30, y: 0, speed: 12, spawnS: 0, touch: 0 });
  const o = X.spawnFoe(A, { kind: "ring", ai: "orbit", x: -30, y: 0, speed: 20, orbit: { r: 20, w: 0.5 }, spawnS: 0, touch: 0 });
  const s = X.spawnFoe(A, { kind: "blob", ai: "shooter", x: 0, y: 40, speed: 12, keep: 25, spawnS: 0, touch: 0 });
  const w = X.spawnFoe(A, { kind: "spore", ai: "wander", x: 0, y: -30, speed: 15, spawnS: 0, touch: 0 });
  steps(A, 240);
  assert.ok(Math.hypot(c.x, c.y) < 6, "the chaser closed in");
  near(Math.hypot(o.x, o.y), 20, 4, "the orbiter keeps its radius");
  near(Math.hypot(s.x, s.y), 25, 7, "the shooter keeps its range");
  assert.ok(Math.hypot(w.x, w.y) <= A.arena.r, "the wanderer stays in the arena");
  // clears: score = value × the combo's multiplier; food drops; the combo lapses after combo.s
  const B = quiet();
  const fs = [0, 1, 2].map((k) => X.spawnFoe(B, { kind: "germ", ai: "still", x: 10 + 5 * k, y: 0, spawnS: 0, hp: 1, value: 10, drops: { food: 2 } }));
  const gains = fs.map((f) => { X.damageFoe(B, f, 5); return B.out.at(-1).gain; });
  assert.deepEqual(gains, [10, 11, 12], "1.0, 1.1, 1.2 × 10");
  assert.equal(B.kills, 3); assert.equal(B.combo, 3); assert.equal(B.foes.length, 0, "cleared foes leave the list");
  assert.equal(B.k.n, 6, "two food each");
  steps(B, Math.round(X.ACT.combo.s / DT) + 2);
  assert.equal(B.combo, 0, "the combo lapsed");
  assert.equal(B.bestCombo, 3);
  // a foe still spawning cannot be hit
  const f = X.spawnFoe(B, { kind: "germ", x: 5, y: 5, spawnS: 0.5 });
  assert.equal(X.damageFoe(B, f, 9), false);
  assert.equal(f.hp, f.hpMax);
});

await check("fairness: no foe spawns within 24 u of you (it moves along the wall); a hit pushes you 6 u; shield pips go first", () => {
  const A = quiet();
  A.p.x = 0; A.p.y = 40;
  const f = X.spawnFoe(A, { kind: "germ", x: 0, y: 43 });
  assert.ok(Math.hypot(f.x - A.p.x, f.y - A.p.y) >= 24 - 1e-6, `moved off: ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`);
  near(Math.hypot(f.x, f.y), 43, 1e-6, "along the wall");
  const g = X.spawnFoe(A, { kind: "germ", x: 0, y: 20 });
  near(Math.hypot(g.x - A.p.x, g.y - A.p.y), 24, 1e-6, "well inside: straight away from you");
  const h = X.spawnFoe(A, { kind: "germ", x: 0, y: 39, anywhere: true });
  assert.equal(h.y, 39, "anywhere: the stage's own spawn");
  // the push
  const B = quiet();
  X.hitPlayer(B, 1, "test", -5, 0);
  steps(B, X.ACT.juice.stopHit + 40);
  near(B.p.x, 6, 0.6, "pushed 6 u away from what hit you");
  // shields
  const C = quiet({ player: { shield: 2 } });
  assert.equal(C.p.shield, 2);
  X.hitPlayer(C, 1);
  assert.deepEqual([C.p.shield, C.p.hp], [1, X.ACT.player.hp], "a shield pip took it");
  C.p.inv = 0; X.hitPlayer(C, 1);
  C.p.inv = 0; X.hitPlayer(C, 1);
  assert.deepEqual([C.p.shield, C.p.hp], [0, X.ACT.player.hp - 1], "then hp");
  assert.deepEqual(X.actionView(C).hp, { n: X.ACT.player.hp - 1, max: X.ACT.player.hp, shield: 0 });
  // the wind-up: a gunned foe's charge rises over its tell
  const D = quiet();
  D.p.y = -30;
  const s = X.spawnFoe(D, { kind: "blob", ai: "still", x: 0, y: 20, spawnS: 0, gun: { pattern: { kind: "aimed" }, every: 2, tellS: 0.6, first: 1, jitter: 0 } });
  steps(D, 20);                                                     // the tell starts at 0.4 s (first 1 s − tellS)
  assert.equal(X.actionView(D).foes[0].charge, 0, "no wind-up before the tell");
  steps(D, 22);
  const ch = X.actionView(D).foes[0].charge;
  assert.ok(ch > 0.4 && ch < 0.7, `half way through the tell: ${ch}`);
  void s;
});

await check("pickups: food is drawn in and counted, heal heals, the vacuum pulls from anywhere", () => {
  const A = quiet();
  X.drop(A, "food", 10, 0, 3, 1);
  steps(A, 90);
  assert.equal(A.food, 3); assert.equal(A.k.n, 0);
  A.p.hp = 2;
  X.drop(A, "heal", 6, 0, 1, 1);
  steps(A, 90);
  assert.equal(A.p.hp, 3);
  X.drop(A, "food", -40, 0, 2, 1);
  steps(A, 30);
  assert.equal(A.food, 3, "too far for the magnet");
  X.vacuum(A, 2);
  steps(A, 120);
  assert.equal(A.food, 5, "the vacuum pulled them in");
});

await check("the safe zone shrinks on its clock and costs 1 hp a second outside it", () => {
  const A = quiet();
  X.setZone(A, { x: 0, y: 0, r: 40, to: { x: 10, y: 0, r: 10 }, t0: 0, t1: 2 });
  steps(A, 60);
  near(A.zone.r, 25, 0.5, "half way"); near(A.zone.x, 5, 0.3, "moving");
  steps(A, 60);
  near(A.zone.r, 10, 1e-6, "shrunk");
  A.p.x = -30; A.p.y = 0;
  const hp = A.p.hp;
  steps(A, 125);
  assert.equal(A.p.hp, hp - 2, "1 hp a second outside");
  assert.ok(!X.inZone(A, A.p.x, A.p.y));
  assert.deepEqual(viewOk(A), []);
});

await check("the knock-out: hp 0 sets ko and emits it once; the world goes on safely and still validates", () => {
  const A = quiet();
  A.p.hp = 1;
  X.addBullet(A, 2, -10, 0, 60, 0);
  steps(A, 30);
  assert.equal(A.ko, true);
  assert.equal(A.p.hp, 0);
  const kos = [];
  for (let i = 0; i < 60; i++) { X.stepWorld(A, dash(1, 0)); kos.push(...A.out.filter((o) => o.type === "ko")); }
  assert.equal(kos.length, 0, "ko comes once");
  assert.equal(A.dashes, 0, "no dash once knocked out");
  assert.equal(X.hitPlayer(A, 1), false);
  assert.equal(X.actionView(A).player, null);
  assert.deepEqual(viewOk(A), []);
});

await check("emitOut: outcomes become act.* sfx events, thinned in time", () => {
  const A = X.createWorld(3, { fire: { rate: 30, range: 60 } });
  X.spawnFoe(A, { kind: "germ", ai: "still", x: 0, y: 20, spawnS: 0, hp: 999 });
  const st = { t: 0, events: [] };
  for (let i = 0; i < 60; i++) { X.stepWorld(A, still()); X.emitOut(A, st); }
  const shots = st.events.filter((e) => e.id === "act.shot").length;
  assert.ok(shots >= 9 && shots <= 12, `shots thinned to about 11 a second: ${shots}`);
  assert.ok(st.events.every((e) => e.name === "sfx" && /^act\./.test(e.id)));
});

await check("the bot: at skill 1 it takes far fewer hits than standing still under the same fire; no memory at skill 1", () => {
  const fire = (A) => {
    for (let k = 0; k < 4; k++) {
      X.spawnFoe(A, { kind: "blob", ai: "shooter", x: 30 * Math.cos(k * 1.6), y: 30 * Math.sin(k * 1.6), hp: 9999, keep: 30, spawnS: 0, touch: 0,
        gun: { pattern: { kind: ["aimed", "fan", "ring", "wave"][k], n: [2, 5, 14, 3][k], arc: 0.25, speed: 24, w: 4, wf: 6 }, every: 1.2, tellS: 0.5, first: 0.5 + 0.3 * k } });
    }
  };
  const play = (skill) => {
    const A = X.createWorld(9, { fire: null, player: { hp: 99 } });
    fire(A);
    const r = stream(9, "bot");
    r.mem = {};
    for (let i = 0; i < 60 * 30; i++) {
      const a = skill === null ? { steer: { x: 0, y: 0 }, dash: false } : actionSteer(A, skill, r);
      X.stepWorld(A, makeIntents({ steer: a.steer, touching: true, presses: a.dash ? [{ t: 0, raw: 0 }] : [] }));
    }
    return A.hits;
  };
  const idle = play(null), ref = play(1), mid = play(0.5);
  assert.ok(idle >= 15, `standing still is hit often: ${idle}`);
  assert.ok(ref <= idle / 3, `skill 1: ${ref} hits vs ${idle}`);
  assert.ok(mid < idle && mid >= ref, `skill 0.5: ${mid} hits (ref ${ref}, idle ${idle})`);
  const A = X.createWorld(4);
  fire(A);
  steps(A, 90);
  const a1 = actionSteer(A, 1, null), a2 = actionSteer(A, 1, stream(1, "x"));
  assert.deepEqual(a1, a2, "skill 1 needs no stream and no memory");
  assert.ok(Math.hypot(a1.steer.x, a1.steer.y) < 1, "|steer| stays under 1");
  assert.ok(BOT.lookR > 0);
});

let PERF = null;
await check("perf: a step with 600 bullets, 48 foes and 96 pickups is far under 1 ms (p99; best of 3 on a busy machine)", () => {
  let best = null;
  for (let k = 0; k < 3 && !(best && best.p99 < 0.6); k++) { const r = perfOnce(); if (!best || r.p99 < best.p99) best = r; }
  PERF = best;
  assert.ok(best.n >= 500, `bullets kept: ${best.n}`);
  assert.ok(best.p99 < 0.6, `p99 ${best.p99.toFixed(3)} ms`);
  assert.deepEqual(best.bad, []);
});
function perfOnce() {
  const A = X.createWorld(7, { player: { hp: 1e9 }, fire: { rate: 12, spread: 3, range: 60 } });
  for (let k = 0; k < 48; k++) X.spawnFoe(A, { kind: "germ", ai: ["chase", "orbit", "wander", "shooter"][k % 4], x: 40 * Math.cos(k), y: 40 * Math.sin(k), hp: 1e6, spawnS: 0, touch: 0,
    gun: k % 6 === 0 ? { pattern: { kind: "ring", n: 12, speed: 10, life: 30 }, every: 0.5, tellS: 0.2 } : null });
  for (let k = 0; k < 600; k++) X.addBullet(A, 2, 40 * Math.cos(k), 40 * Math.sin(k), Math.cos(k * 3), Math.sin(k * 3), { life: 60 });
  X.drop(A, "food", 0, 30, 96, 1);
  A.pick.lifeS = 1e9;
  const ts = [];
  for (let i = 0; i < 600; i++) {
    const a = process.hrtime.bigint();
    X.stepWorld(A, makeIntents({ steer: { x: Math.cos(i / 30), y: Math.sin(i / 30) }, touching: true }));
    ts.push(Number(process.hrtime.bigint() - a) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return { p99: ts[Math.floor(0.99 * ts.length)], n: A.b.n, bad: viewOk(A) };
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks (p99 step with ${PERF ? PERF.n : "?"} bullets: ${PERF ? PERF.p99.toFixed(3) : "?"} ms)`);
