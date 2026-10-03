// Headless play-through: a simple bot plays Primordia against the real Lenia dish.
// Usage: node qa/primordia/bot.mjs [seconds] [seed]
import { Game, wdelta } from "../../public/primordia/core.js";

const seconds = +(process.argv[2] || 90), seed = +(process.argv[3] || 7);
const g = new Game(256, 128, seed);
g.reset("play");
const counts = {};
const dt = 1 / 60;
let t0 = performance.now(), frames = 0;
function botInput() {
  const P = g.player;
  const near = (list) => list.reduce((b, e) => { const d = Math.hypot(wdelta(e.x - P.x, g.w), wdelta(e.y - P.y, g.h)); return d < b.d ? { d, e } : b; }, { d: Infinity, e: null });
  const prey = near(g.prey), hunt = near(g.hunters);
  let mx = 0, my = 0;
  const goal = g.frenzyT > 0 && hunt.e ? hunt.e : prey.e;
  if (goal) { mx = wdelta(goal.x - P.x, g.w); my = wdelta(goal.y - P.y, g.h); const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
  if (g.frenzyT <= 0 && hunt.e && hunt.d < hunt.e.size + 14) {
    const ax = -wdelta(hunt.e.x - P.x, g.w), ay = -wdelta(hunt.e.y - P.y, g.h), l = Math.hypot(ax, ay) || 1;
    mx = mx * 0.3 + ax / l; my = my * 0.3 + ay / l;
  }
  return { mx, my, dash: P.hurt > 0.5, frenzy: g.ready && hunt.e && hunt.d < 60 };
}
while (g.time < seconds && g.state !== "over") {
  if (g.state === "mutate") { g.choose(0); }
  g.update(dt, botInput());
  frames++;
  for (const e of g.events) { counts[e.type] = (counts[e.type] || 0) + 1; if (["devour", "frenzy", "epochEnd", "bloom", "death", "warn", "ready"].includes(e.type) && !(e.type === "devour" && e.kind === "prey")) console.log(g.time.toFixed(1).padStart(6), e.type, e.kind || "", e.name || "", e.points || "", e.boss ? "BOSS" : ""); }
  g.events.length = 0;
  if (frames % 600 === 0) console.log(g.time.toFixed(1).padStart(6), `light ${g.player.light.toFixed(0)} score ${g.score} prey ${g.prey.length} hunters ${g.hunters.length} massA ${g.world.massA.toFixed(0)} massB ${g.world.massB.toFixed(0)} meter ${g.meter.toFixed(2)} epoch ${g.epoch}`);
}
const ms = performance.now() - t0;
console.log("state", g.state, "time", g.time.toFixed(1), "score", g.score, "epoch", g.epoch, "stats", JSON.stringify({ ...g.stats, species: [...g.stats.species] }));
console.log("events", JSON.stringify(counts));
console.log("ms per frame", (ms / frames).toFixed(2), "steps", g.steps);
