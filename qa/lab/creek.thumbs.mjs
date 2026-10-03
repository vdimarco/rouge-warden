// Which side should a thumb drag paddle on? node qa/lab/creek.thumbs.mjs
// Bots play Up the Creek with their thumbs under two mappings:
//   paddle: a drag on a side is a stroke on that side, so a drag on the right turns the bow left (as a real paddle).
//   steer:  a drag on the side you want to turn toward (paddle.js steer()), which the game uses for thumbs and keys.
// A new player drags on the side it wants to go. A learner starts the same way, but after two turns the wrong way in a
// row it swaps sides. The phone keeps real paddle sides; that is not tested here. Exit code 1 on failure.
import { makeRiver, START } from "../../public/lab/creek/river.js";
import { newCanoe, act, step } from "../../public/lab/creek/canoe.js";
import { steer } from "../../public/lab/creek/paddle.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const section = (s) => console.log("\n" + s);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const med = (a) => { const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };

const MAP = {
  paddle: (type, toward, power) => ({ type, side: toward, power }),
  steer,
};

// a thumb player: every 0.6 s it looks 10 m ahead on the middle of the river and drags toward it, or drags on both
// sides in turn when it points the right way. It sees which way the bow swings just after a turning drag (the yaw
// rate 0.25 s later). learn: swap sides after two swings the wrong way in a row.
function thumbs(river, map, learn) {
  let last = -9, alt = 1, belief = 1, wrong = 0, want = 0, om0 = 0, judged = true;
  const bot = (c) => {
    if (!judged && c.t - last >= 0.25) {
      judged = true;
      bot.turns++;
      if ((c.om - om0) * want < 0) {
        bot.wrong++; if (bot.turns <= 6) bot.early++;
        if (learn && ++wrong >= 2) { belief = -belief; wrong = 0; bot.swaps++; }
      } else wrong = 0;
    }
    if (c.t - last < 0.6) return [];
    last = c.t;
    const ty = c.y + 10, err = wrap(Math.atan2(river.c(ty) - c.x, ty - c.y) - c.psi);
    if (Math.abs(err) > 0.25) { want = err > 0 ? 1 : -1; om0 = c.om; judged = false; return [map("stroke", belief * want, 1)]; }
    want = 0; alt = -alt;
    return [map("stroke", alt, 0.8)];
  };
  bot.swaps = 0; bot.wrong = 0; bot.turns = 0; bot.early = 0;
  return bot;
}

function run(seed, mapName, learn) {
  const r = makeRiver(seed), c = newCanoe(r), bot = thumbs(r, MAP[mapName], learn), q = r.targets[0];
  let tFirst = null, y30 = null;
  while (!c.done && c.t < 240) {
    for (const a of bot(c)) act(c, a);
    step(c, r);
    if (tFirst == null && c.y >= q.y) tFirst = c.t;
    if (y30 == null && c.t >= 30) y30 = c.y;
  }
  return { done: c.done, t: c.t, tFirst: tFirst ?? 240, stalled: (y30 ?? c.y) < START + 30, swaps: bot.swaps, wrong: bot.wrong, early: bot.early };
}

const seeds = [3, 7, 11, 23, 42, 99, 2026, 5, 13, 17, 21, 31];
const table = {};
section("A new player who drags on the side it wants to go");
for (const mapName of ["paddle", "steer"]) for (const learn of [false, true]) {
  const runs = seeds.map((s) => run(s, mapName, learn)), done = runs.filter((x) => x.done);
  table[mapName + (learn ? "+learn" : "")] = runs;
  console.log(`  ${(mapName + (learn ? ", learner" : ", new player")).padEnd(20)} down ${String(done.length).padStart(2)} of ${seeds.length}` +
    `${done.length ? ` (median ${med(done.map((x) => x.t)).toFixed(0)} s)` : ""}, stalled near the top ${runs.filter((x) => x.stalled).length}, ` +
    `first eddy after ${med(runs.map((x) => x.tFirst)).toFixed(0)} s (median), wrong swings in the first 6 turns ${runs.reduce((a, x) => a + x.early, 0)}`);
}
const ok = (k) => table[k].filter((x) => x.done).length, early = (k) => table[k].reduce((a, x) => a + x.early, 0);
check(ok("paddle") <= 2 && table.paddle.filter((x) => x.stalled).length >= 10, "with paddle sides, a new thumb player stalls near the top on most rivers (the reviewer saw this on 6 of 6)");
check(ok("steer") >= 10 && table.steer.every((x) => !x.stalled), `with steer, the same player gets down ${ok("steer")} of ${seeds.length} rivers and never stalls`);
// (a rock or an eddy line can still swing the bow against a stroke now and then)
check(early("steer+learn") <= (6 * seeds.length) / 20 && table["steer+learn"].every((x) => x.swaps === 0),
  `with steer, the first 6 turning drags swing the bow the way the player meant (${6 * seeds.length - early("steer+learn")} of ${6 * seeds.length}), so it never swaps sides`);
check(table["paddle+learn"].every((x) => x.early >= 2), `with paddle sides, even a player who learns fast sees the bow swing the wrong way first (${early("paddle+learn")} times in 12 runs)`);

section("The steer mapping");
{
  const s = steer("stroke", 1), j = steer("j", 1), b = steer("back", 1);
  check(s.side === -1 && j.side === -1 && b.side === 1, "to turn right: a stroke and its J go in on the left, a back stroke on the right");
  const still = makeRiver(1, { still: true, rocks: [] });
  const turn = (a) => { const c = newCanoe(still, { x: 0, y: 50, psi: 0 }); act(c, a); for (let i = 0; i < 60; i++) step(c, still); return c.psi; };
  check(turn(steer("stroke", 1)) > 0 && turn(steer("stroke", -1)) < 0, "a forward drag on the right turns the bow right, on the left turns it left");
  check(turn(steer("back", 1)) > 0 && turn(steer("back", -1)) < 0, "a back drag on the right also turns the bow right");
}

console.log(`\ncreek.thumbs: ${fails.length ? fails.length + " failed" : "all passed"}`);
process.exit(fails.length ? 1 : 0);
