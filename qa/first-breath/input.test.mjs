// First Breath: ui/input.js and the fresh-press rule across a gesture change (design.md 5.3). The page hears of a
// stage's new moment only after the step that made it (main.js passes the prompt event's core time to setLive), so:
// - a press made after the change but before the page heard of it is a fresh press: its release is kept (the stage
//   judges it in the new moment, so it must see the hold end);
// - a press already down when the hold moment began still cannot start the hold: its release is dropped, with or
//   without the change's time, by touch, by key and in one-button mode; the timing offset moves the line as it moves
//   the press;
// - a hold that carries from one hold moment into the next (bloom into hatch, a hold into dragHold) keeps its release;
// - an arrow key that went down after a change into dragHold, before the page heard of it, is that moment's press.
// node qa/first-breath/input.test.mjs
import assert from "node:assert/strict";
import { createInput } from "../../public/first-breath/ui/input.js";

const FILE = "qa/first-breath/input.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 12).join("\n     ")}`); }
}

// A fresh input with no DOM, in a tap moment; settings read live.
function make(settings = {}) {
  const input = createInput(null, { settings });
  input.setLive("tap");
  return input;
}
const times = (list) => list.map((e) => Math.round(e.t * 1000) / 1000);
const touch = (type, t, x = 100, y = 400) => ({ type, id: 1, kind: "touch", x, y, t });

await check("a touch made just after the change to hold, heard a frame later, keeps its release", () => {
  const input = make();
  input.inject(touch("pointerdown", 1.005));            // the stage moved to its hold moment at 1.000
  input.setLive("hold", "steer", 1.0);                  // … and the page hears of it after that step
  input.inject(touch("pointerup", 2.0));
  const it = input.intents(2.1);
  assert.deepEqual(times(it.presses), [1.005]);
  assert.deepEqual(times(it.releases), [2], "the release of a fresh press is kept");
});

await check("Space pressed just after the change to hold keeps its release", () => {
  const input = make();
  input.inject({ type: "keydown", code: "Space", t: 1.01 });
  input.setLive("hold", "steer", 1.0);
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  const it = input.intents(2.1);
  assert.deepEqual(times(it.presses), [1.01]);
  assert.deepEqual(times(it.releases), [2]);
});

await check("a touch already down when the hold moment began loses its release (with the time, and without)", () => {
  for (const at of [1.0, undefined]) {
    const input = make();
    input.inject(touch("pointerdown", 0.9));
    input.setLive("hold", "steer", at);
    input.inject(touch("pointerup", 2.0));
    const it = input.intents(2.1);
    assert.deepEqual(times(it.presses), [0.9]);
    assert.deepEqual(it.releases, [], `at ${at}: the release of a stale press is dropped`);
    // the next touch-down is the press, and its release counts
    input.inject(touch("pointerdown", 2.2));
    input.inject(touch("pointerup", 3.0));
    assert.deepEqual(times(input.intents(3.1).releases), [3]);
  }
});

await check("a key or one-button press already down when the hold moment began loses its release", () => {
  const keys = make();
  keys.inject({ type: "keydown", code: "Enter", t: 0.5 });
  keys.setLive("hold", "steer", 1.0);
  keys.inject({ type: "keyup", code: "Enter", t: 1.5 });
  assert.deepEqual(keys.intents(1.6).releases, []);
  const one = make({ oneButton: true });
  one.inject({ type: "keydown", code: "KeyX", t: 0.5 });
  one.setLive("hold", "steer", 1.0);
  one.inject({ type: "keyup", code: "KeyX", t: 1.5 });
  assert.deepEqual(one.intents(1.6).releases, []);
});

await check("the offset moves the line with the press: t = raw − offset is what is compared", () => {
  const settings = { offsetMs: 100 };
  const early = make(settings);
  early.inject(touch("pointerdown", 1.05));             // t = 0.95: before the change, as the stage sees it
  early.setLive("hold", "steer", 1.0);
  early.inject(touch("pointerup", 2.0));
  assert.deepEqual(early.intents(2.1).releases, []);
  const late = make(settings);
  late.inject(touch("pointerdown", 1.15));              // t = 1.05: after it
  late.setLive("hold", "steer", 1.0);
  late.inject(touch("pointerup", 2.0));
  assert.deepEqual(times(late.intents(2.1).releases), [1.9]);
});

await check("a hold carried from one hold moment into the next keeps its release", () => {
  const input = make();
  input.setLive("hold", "steer", 1.0);
  input.inject(touch("pointerdown", 1.5));
  input.setLive("hold", "steer", 5.0);                   // bloom into hatch: the gesture stays hold
  input.setLive("dragHold", "steer", 6.0);               // and hold into dragHold
  input.inject(touch("pointerup", 7.0));
  assert.deepEqual(times(input.intents(7.1).releases), [7]);
});

await check("an arrow down just after the change to dragHold, heard a frame later, is that moment's press", () => {
  const input = make();
  input.setLive("drag");
  input.inject({ type: "keydown", code: "ArrowDown", t: 1.004 });
  input.setLive("dragHold", "steer", 1.0);
  input.inject({ type: "keyup", code: "ArrowDown", t: 2.0 });
  const it = input.intents(2.1);
  assert.deepEqual(times(it.presses), [1.004]);
  assert.deepEqual(times(it.releases), [2]);
  assert.equal(it.dir, null, "the key is up again");
  // one held from before the change is not
  const old = make();
  old.setLive("drag");
  old.inject({ type: "keydown", code: "ArrowDown", t: 0.5 });
  old.setLive("dragHold", "steer", 1.0);
  old.inject({ type: "keyup", code: "ArrowDown", t: 2.0 });
  const o = old.intents(2.1);
  assert.deepEqual(o.presses, []);
  assert.deepEqual(o.releases, []);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
