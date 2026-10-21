// Headset comfort for a swing. The game does not yaw the view to follow a rope.
// A stick snap or smooth turn still does. Each rope starts on that hand's trigger.
// node qa/vr/headset-comfort.test.mjs
import assert from "node:assert/strict";
import { playYaw, handFiresRope, buttonHand } from "../../public/vr/js/playturn.js";

const stick = -Math.PI / 4;
const follow = 1.2;

assert.equal(playYaw({ xr: true, turn: 0, follow }), 0, "a centered stick adds no yaw while a follow amount is waiting");
assert.equal(playYaw({ xr: true, turn: stick, follow }), stick, "a snap during a swing is the stick yaw alone");
assert.equal(playYaw({ xr: true, turn: stick, follow: 0 }), stick, "a snap with no follow is the stick yaw");
assert.equal(playYaw({ xr: false, turn: 0.1, follow: 0.4 }), 0.5, "flat play still adds the phone follow");
assert.equal(playYaw({ xr: false, turn: 0, follow: 0 }), 0, "flat play with no turn and no follow stays put");
assert.equal(playYaw({}), 0, "a missing frame adds no yaw");

const right = { triggerDown: true, gripDown: false };
const leftGrip = { triggerDown: false, gripDown: true };
const both = { triggerDown: true, gripDown: true };
const idle = { triggerDown: false, gripDown: false };

assert.equal(handFiresRope(right), true, "the swinging hand's trigger starts its rope");
assert.equal(handFiresRope(leftGrip), false, "a grip does not start a rope");
assert.equal(handFiresRope(both), true, "a trigger still starts the rope when the grip is also down");
assert.equal(handFiresRope(idle), false, "a quiet hand does not start a rope");
assert.equal(handFiresRope(null), false, "a missing hand does not start a rope");

const hands = [leftGrip, right];
assert.deepEqual(hands.map(handFiresRope), [false, true], "the other hand's grip does not start the swinging hand's rope, and the right trigger does not start the left rope");
assert.deepEqual([right, idle].map(handFiresRope), [true, false], "the left trigger does not start the right rope");
assert.deepEqual([leftGrip, { triggerDown: false, gripDown: true }].map(handFiresRope), [false, false], "neither grip starts a rope");

for (let i = 0; i < 10; i++) {
  assert.equal(buttonHand(0), 0, "left button " + (i + 1) + " is the left rope");
  assert.equal(buttonHand(1), 1, "right button " + (i + 1) + " is the right rope");
}

console.log("PASS: headset-comfort");
