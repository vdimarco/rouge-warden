// A bot that mashes buttons all over the map and checks the rules after every step:
// no NaN, never under the ground or inside a building, never out of the world, hearts and stamina in range.
// Usage: node fuzz.mjs [runs] [steps per run]
import { open, newGame } from "./lib.mjs";

const RUNS = +process.argv[2] || 24, STEPS = +process.argv[3] || 2400;
const { browser, page, errors } = await open();
await newGame(page);
const result = await page.evaluate(async ([RUNS, STEPS]) => {
  const P = G.player, I = G.inp, W = G.world;
  const counts = {}, examples = {};
  const rnd = QA.rng(99);
  const spots = [];
  for (let k = 0; k < RUNS; k++) spots.push(QA.landSpot(rnd));
  // also start at the hard places: towers, the island, boss arenas, the dock, a cliff
  for (const t of W.towers) spots.push([t.x + 5, t.z + 5]);
  for (const b of G.bosses) spots.push([b.center.x + 6, b.center.z + 6]);
  spots.push([W.cottage.x, W.shoreZ - 30], [W.cottage.x + 2, W.cottage.z - 20]);
  let steps = 0, deaths = 0;
  for (const [x, z] of spots) {
    QA.closeModals();
    P.dead = false; P.place(x, z); P.hp = P.maxHp;
    let hold = 0, ex = 0;
    for (let i = 0; i < STEPS; i++) {
      if (--hold <= 0) {
        hold = 10 + ((rnd() * 60) | 0);
        const a = rnd() * 6.28, m = rnd() < 0.15 ? 0 : 1;
        I.move.x = Math.cos(a) * m; I.move.y = Math.sin(a) * m;
        I.sprint = rnd() < 0.4; I.attackHeld = rnd() < 0.1;
        G.cam.yaw += (rnd() - 0.5) * 2; G.cam.pitch = rnd() * 1.2 - 0.3;
      }
      I.jump = rnd() < 0.06; I.attack = rnd() < 0.08; I.roll = rnd() < 0.03; I.interact = rnd() < 0.01;
      I.eat = rnd() < 0.005; I.next = rnd() < 0.01; I.lift = rnd() < 0.01; I.fury = rnd() < 0.01;
      try { G.test.step(1 / 30); } catch (e) { counts.exception = (counts.exception || 0) + 1; examples.exception = examples.exception || String(e.stack || e); }
      steps++;
      // the camera is updated by the render loop, which is paused; run it here too
      const bad = QA.check();
      for (const b of bad) { counts[b] = (counts[b] || 0) + 1; if (!examples[b]) examples[b] = { at: P.pos.toArray().map((v) => +v.toFixed(2)), state: P.state, start: [x, z].map(Math.round), step: i, climb: P.climb && (P.climb.box ? "box" : "terrain") }; }
      if (G.ui.modal) { if (P.dead) deaths++; QA.closeModals(); }
      if (P.dead) { P.dead = false; P.hp = P.maxHp; }
      if (P.hp < 4) P.hp = P.maxHp;
      if (++ex % 300 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }
  return { steps, deaths, counts, examples, foes: G.foes.length, fx: G.fx.list.length, shots: G.hazards.shots.length, children: G.scene.children.length };
}, [RUNS, STEPS]);
console.log(JSON.stringify(result, null, 1));
if (errors.length) console.log("ERRORS\n" + errors.slice(0, 10).join("\n"));
await browser.close();
process.exit(Object.keys(result.counts).length || errors.length ? 1 : 0);
