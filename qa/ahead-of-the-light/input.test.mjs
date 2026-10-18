// Ahead of the Light: the gesture machine's keys across pauses and new play (ui/input.js, final.md 15). ui/input.js
// imports in plain node (only bindInput and pollPad touch the page). After a blur's pause(false) then reset() (play
// after QUIT RUN, a new leg) the left key turns the ship; a steer key pressed and let go before reset() or resume()
// turns no more after it; a key still held through a pause keeps turning.
// node qa/ahead-of-the-light/input.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../../public/ahead-of-the-light/ui/input.js';
import { createRace, stepRace, STEP } from '../../public/ahead-of-the-light/core/race.js';
import { parseOverrides } from '../../public/ahead-of-the-light/core/tune.js';

const T = parseOverrides('?drag=0&engine=0').tune;

// A bare leg with nothing on it, out of leg 1 (no soft start), so only the intent moves the ship.
function emptyRace() {
  const leg = Object.freeze({ type: 'test', lane: null, seed: 1, beats: 400, items: Object.freeze([]), sections: [],
    gate: { id: null, beat: 396 }, pickups: [], wells: [], labels: [], hash: 'test', report: { ok: true, errors: [] } });
  const race = createRace({ leg, tune: T });
  race.legNo = 1;
  return race;
}
// Step the race for s seconds with the input's intent, its clock starting at t0 ms. → the clock at the end (ms).
function drive(input, race, t0, s) {
  const you = race.ships[0];
  let t = t0;
  for (let i = 0; i < Math.round(s / STEP); i++) {
    t += STEP * 1000;
    stepRace(race, { you: input.take(race, you, t) }, STEP);
  }
  return t;
}

test('ui/input.js imports in plain node and gives a turn from the keys', () => {
  const input = createInput({ tune: T });
  assert.equal(input.keyDown('ArrowLeft', 10), true);
  assert.equal(input.take(null, null, 20).turn, -1);
  input.keyUp('ArrowLeft', 30);
  assert.equal(input.take(null, null, 40).turn, 0);
});

test('after pause(false) then reset(), the left key turns the ship', () => {
  const input = createInput({ tune: T });
  const race = emptyRace(), you = race.ships[0];
  input.keyDown('ArrowRight', 0);                 // a key held as the page loses focus
  input.pause(false);                             // a blur: the keys are forgotten
  input.reset();                                  // new play (a new leg, or play after QUIT RUN)
  assert.equal(input.frozen, false);
  let t = drive(input, race, 0, 0.2);
  assert.equal(you.bearing, 0, 'the forgotten key turns nothing');
  input.keyDown('ArrowLeft', t);
  assert.equal(input.take(race, you, t + 1).turn, -1);
  t = drive(input, race, t + 1, 0.5);
  assert.ok(you.bearing < -20, `the ship turns left: ${you.bearing.toFixed(1)}°`);
});

test('after keyDown and keyUp, then reset(), the turn is 0', () => {
  const input = createInput({ tune: T });
  const race = emptyRace(), you = race.ships[0];
  input.keyDown('ArrowLeft', 100);
  assert.equal(input.take(race, you, 150).turn, -1, 'held, it turns');
  input.keyUp('ArrowLeft', 200);
  input.reset();                                  // before any step reads the key-up
  assert.equal(input.take(race, you, 300).turn, 0);
  const b = you.bearing;
  drive(input, race, 300, 0.5);
  assert.equal(you.bearing, b, 'the ship holds its line');
  // pressed and let go with no step between them
  input.keyDown('KeyD', 400);
  input.keyUp('KeyD', 410);
  input.reset();
  assert.equal(input.take(race, you, 500).turn, 0);
});

test('after keyDown and keyUp, then resume(), the turn is 0', () => {
  // let go while paused (the pause button keeps the keys, but a key-up in the pause is not queued)
  let input = createInput({ tune: T });
  input.keyDown('ArrowLeft', 100);
  assert.equal(input.take(null, null, 150).turn, -1);
  input.pause(true);
  input.keyUp('ArrowLeft', 200);
  assert.equal(input.resume(false), 'play');
  assert.equal(input.take(null, null, 300).turn, 0);
  // pressed and let go before the resume, with no step between them
  input = createInput({ tune: T });
  input.keyDown('ArrowRight', 100);
  input.keyUp('ArrowRight', 110);
  input.resume(false);
  assert.equal(input.take(null, null, 200).turn, 0);
  // on a race: the ship holds its line after the resume
  input = createInput({ tune: T });
  const race = emptyRace(), you = race.ships[0];
  input.keyDown('ArrowLeft', 0);
  const t = drive(input, race, 0, 0.3);
  assert.ok(you.bearing < 0);
  input.pause(true);
  input.keyUp('ArrowLeft', t + 5);
  input.resume(false);
  const b = you.bearing;
  drive(input, race, t + 10, 0.5);
  assert.equal(you.bearing, b);
});

test('a steer key still held through a pause keeps turning after resume() and reset()', () => {
  const input = createInput({ tune: T });
  input.keyDown('ArrowLeft', 100);
  input.pause(true);
  input.resume(false);
  assert.equal(input.take(null, null, 200).turn, -1);
  input.pause(true);
  input.reset();
  assert.equal(input.take(null, null, 300).turn, -1);
  input.keyUp('ArrowLeft', 400);
  assert.equal(input.take(null, null, 500).turn, 0);
});
