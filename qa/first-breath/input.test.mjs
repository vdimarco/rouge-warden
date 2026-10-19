// First Breath: ui/input.js and the fresh-press rule across a gesture change (design.md 5.3). The page hears of a
// stage's new moment only after the step that made it (main.js passes the prompt event's core time to setLive), so:
// - a press made after the change but before the page heard of it is a fresh press: its release is kept (the stage
//   judges it in the new moment, so it must see the hold end);
// - a press already down when the hold moment began still cannot start the hold: its release is dropped, with or
//   without the change's time, by touch, by key and in one-button mode; the timing offset moves the line as it moves
//   the press;
// - a hold that carries from one hold moment into the next (bloom into hatch, a hold into dragHold) keeps its release;
// - an arrow key that went down after a change into dragHold, before the page heard of it, is that moment's press;
// - a release made while paused or hidden survives Resume's flush when its press reached the stage, and is dropped
//   when its press was flushed (review F9);
// - in a hold or dragHold moment many keys and the pointer make one hold: the first down is the press, the last up
//   the release, also after the moment moves on (review F12).
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

// Pause and resume (review F9): a key or finger let go while paused or hidden still ends the hold its press began.
await check("a release made while paused, after its press reached the stage, survives the resume flush", () => {
  for (const kind of ["key", "touch"]) {
    const input = make();
    input.setLive("dragHold", "steer", 0);
    input.inject(kind === "key" ? { type: "keydown", code: "Space", t: 3.0 } : touch("pointerdown", 3.0));
    assert.deepEqual(times(input.intents(3.02).presses), [3], `${kind}: the press reaches the stage`);
    // paused: core time stands at 4.0, the key or finger goes up, then Resume flushes the queue
    input.inject(kind === "key" ? { type: "keyup", code: "Space", t: 4.0 } : touch("pointerup", 4.0));
    input.flush({ resume: true });
    const it = input.intents(4.02);
    assert.deepEqual(times(it.releases), [4], `${kind}: the release is kept, at the paused core time`);
    assert.deepEqual(it.presses, []);
  }
});

await check("a press flushed before any stage saw it loses its release (Enter or Space on Resume, a new screen)", () => {
  // Enter clicks Resume on keydown: its press is flushed, and its keyup comes after the resume
  const enter = make();
  enter.setLive("hold", "steer", 0);
  enter.inject({ type: "keydown", code: "Enter", t: 4.0 });
  enter.flush({ resume: true });
  enter.inject({ type: "keyup", code: "Enter", t: 4.1 });
  const e = enter.intents(4.2);
  assert.deepEqual(e.presses, []);
  assert.deepEqual(e.releases, [], "no stray release after the resume");
  // Space clicks Resume on keyup: both are queued before the flush, and both go
  const space = make();
  space.setLive("hold", "steer", 0);
  space.inject({ type: "keydown", code: "Space", t: 4.0 });
  space.inject({ type: "keyup", code: "Space", t: 4.0 });
  space.flush({ resume: true });
  assert.deepEqual(space.intents(4.2).releases, []);
  // a plain flush (a new run or stage) still drops every queued event
  const plain = make();
  plain.setLive("hold", "steer", 0);
  plain.inject({ type: "keydown", code: "Space", t: 1.0 });
  plain.intents(1.02);
  plain.inject({ type: "keyup", code: "Space", t: 2.0 });
  plain.flush();
  assert.deepEqual(plain.intents(2.1).releases, []);
});

// One hold from many keys (review F12): in a hold or dragHold moment the first key or finger down is the press, the
// last one up the release.
await check("dragHold: a second arrow joins the hold, and the hold ends only when the last one goes up", () => {
  const input = make();
  input.setLive("dragHold", "steer", 0);
  input.inject({ type: "keydown", code: "ArrowLeft", t: 1.0 });
  input.inject({ type: "keydown", code: "ArrowRight", t: 2.0 });
  input.inject({ type: "keyup", code: "ArrowLeft", t: 2.4 });
  const a = input.intents(2.5);
  assert.deepEqual(times(a.presses), [1], "one press");
  assert.deepEqual(a.releases, [], "letting go of Left while Right is down does not end the hold");
  assert.equal(a.dir, "right");
  input.inject({ type: "keyup", code: "ArrowRight", t: 5.0 });
  assert.deepEqual(times(input.intents(5.1).releases), [5]);
});

await check("dragHold: Space, then Down for the tuck, then Space up keeps the hold with the direction down", () => {
  const input = make();
  input.setLive("dragHold", "steer", 0);
  input.inject({ type: "keydown", code: "Space", t: 1.0 });
  input.inject({ type: "keydown", code: "ArrowDown", t: 1.5 });
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  const a = input.intents(2.1);
  assert.deepEqual(times(a.presses), [1]);
  assert.deepEqual(a.releases, []);
  assert.equal(a.dir, "down");
  input.inject({ type: "keyup", code: "ArrowDown", t: 4.0 });
  assert.deepEqual(times(input.intents(4.1).releases), [4]);
});

await check("hold: a finger and a key make one hold; a tap moment keeps every press and release", () => {
  const input = make();
  input.setLive("hold", "steer", 0);
  input.inject(touch("pointerdown", 1.0));
  input.inject({ type: "keydown", code: "Space", t: 1.2 });
  input.inject(touch("pointerup", 1.5));
  const a = input.intents(1.6);
  assert.deepEqual(times(a.presses), [1]);
  assert.deepEqual(a.releases, []);
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  assert.deepEqual(times(input.intents(2.1).releases), [2]);
  // in a tap moment two keys are two presses
  const taps = make();
  taps.inject({ type: "keydown", code: "Space", t: 1.0 });
  taps.inject({ type: "keydown", code: "Enter", t: 1.1 });
  taps.inject({ type: "keyup", code: "Space", t: 1.2 });
  taps.inject({ type: "keyup", code: "Enter", t: 1.3 });
  const b = taps.intents(1.4);
  assert.deepEqual(times(b.presses), [1, 1.1]);
  assert.deepEqual(times(b.releases), [1.2, 1.3]);
});

await check("a key still down from before the hold moment does not block a fresh press", () => {
  const input = make();
  input.inject({ type: "keydown", code: "Space", t: 0.5 });
  input.intents(0.6);
  input.setLive("hold", "steer", 1.0);
  input.inject({ type: "keydown", code: "Enter", t: 1.5 });
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  input.inject({ type: "keyup", code: "Enter", t: 3.0 });
  const it = input.intents(3.1);
  assert.deepEqual(times(it.presses), [1.5]);
  assert.deepEqual(times(it.releases), [3], "only the fresh key's release counts");
});

await check("a hold made of two keys ends once, even after the moment moves on to a tap", () => {
  const input = make();
  input.setLive("hold", "steer", 0);
  input.inject({ type: "keydown", code: "Space", t: 1.0 });
  input.inject({ type: "keydown", code: "Enter", t: 1.2 });
  assert.deepEqual(times(input.intents(1.3).presses), [1]);
  input.setLive("tap", "steer", 1.5);
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  input.inject({ type: "keyup", code: "Enter", t: 2.5 });
  const it = input.intents(2.6);
  assert.deepEqual(times(it.releases), [2.5], "one release, when the last key goes up");
  // and a new press in the tap moment is its own
  input.inject({ type: "keydown", code: "Space", t: 3.0 });
  input.inject({ type: "keyup", code: "Space", t: 3.1 });
  const b = input.intents(3.2);
  assert.deepEqual(times(b.presses), [3]);
  assert.deepEqual(times(b.releases), [3.1]);
});

await check("blur ends a two-key hold with one release", () => {
  const input = make();
  input.setLive("dragHold", "steer", 0);
  input.inject({ type: "keydown", code: "ArrowLeft", t: 1.0 });
  input.inject({ type: "keydown", code: "Space", t: 1.1 });
  input.intents(1.2);
  // a blur's keyups (main.js: the window lost focus, the real keyups never come)
  input.inject({ type: "keyup", code: "ArrowLeft", t: 2.0 });
  input.inject({ type: "keyup", code: "Space", t: 2.0 });
  assert.deepEqual(times(input.intents(2.1).releases), [2]);
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else console.log(`PASS ${FILE}: ${passed} checks`);
