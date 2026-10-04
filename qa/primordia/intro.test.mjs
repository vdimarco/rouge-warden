// The intro scenes on the real dish: each one must show its move.
// Usage: node qa/primordia/intro.test.mjs [--log]
import assert from "node:assert/strict";
import { Game } from "../../public/primordia/core.js";
import { Intro, SCENES, INTRO_SEED } from "../../public/primordia/intro.js";

const log = process.argv.includes("--log");
const g = new Game(256, 128, INTRO_SEED);
const runs = [];
let cur = null;
const intro = new Intro(g, {
  onScene: (k, S) => { cur = { id: S.id, ev: [], t: 0, frames: 0 }; runs.push(cur); },
});

const DT = 1 / 60;
let frames = 0;
while (!intro.over && intro.scene?.id !== "end" && frames < 60 * 90) {
  const { input, scale } = intro.frame(DT);
  g.update(DT * scale, input);
  intro.observe(g.events);
  for (const e of g.events) {
    if (["step", "tissueHit", "nibble", "refill"].includes(e.type)) continue;
    cur.ev.push(e);
    if (log) console.log(cur.id, intro.s.t.toFixed(2), e.type, e.kind ?? e.how ?? e.why ?? "");
  }
  g.events.length = 0;
  cur.t = intro.s.t; cur.frames++;
  frames++;
}

const by = Object.fromEntries(runs.map((r) => [r.id, r]));
const has = (id, type, pred = () => true) => !!by[id] && by[id].ev.some((e) => e.type === type && pred(e));
const checks = [
  ["every scene before the end card ran", () => SCENES.slice(0, -1).every((S) => by[S.id])],
  ["eat: the player devours a prey", () => has("eat", "devour", (e) => e.kind === "prey")],
  ["dodge: a lane locks and the lunge misses", () => has("dodge", "lock") && has("dodge", "lunge") && !has("dodge", "lungeHit")],
  ["cut: a dash cuts the hunter and it staggers", () => has("cut", "cut") && has("cut", "stagger")],
  ["bite: a Glory Bite, then a Remains prey is eaten", () => has("bite", "devour", (e) => e.kind === "hunter" && e.how === "glory") && has("bite", "devour", (e) => e.kind === "prey")],
  ["parry: the dash parries, Stasis starts, then a Glory Bite", () => has("parry", "parry") && has("parry", "stasis") && has("parry", "devour", (e) => e.how === "glory")],
  ["burst: the Burst catches at least two hunters", () => by.burst && by.burst.ev.some((e) => e.type === "burst" && e.caught >= 2)],
  ["no scene runs out its time limit", () => runs.filter((r) => r.id !== "title" && r.id !== "end").every((r) => r.t < SCENES.find((S) => S.id === r.id).max - 0.05)],
];
let fails = 0;
for (const [name, fn] of checks) {
  let ok = false;
  try { ok = fn(); } catch (err) { ok = false; }
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
}
console.log(runs.map((r) => `${r.id} ${r.t.toFixed(1)} s`).join(" · "));
assert.ok(frames < 60 * 90, "the intro did not reach the end card");
process.exitCode = fails ? 1 : 0;
