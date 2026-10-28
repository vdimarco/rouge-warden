// The job sticker's place: on the goal when it is in view, on the safe edge when it is not (swing-jobs).
import assert from "node:assert/strict";
import { placeGoal } from "../../public/vr/js/actionhud.js";

const size = { w: 1280, h: 800 };
const pad = { l: 28, t: 100, r: 28, b: 84 };
const inside = (p) => p.x >= pad.l - 0.5 && p.x <= size.w - pad.r + 0.5 && p.y >= pad.t - 0.5 && p.y <= size.h - pad.b + 0.5;

const on = placeGoal({ x: 0, y: 0, z: -20 }, { x: 0, y: 0, z: 0.5 }, size, pad);
assert.equal(on.off, false);
assert.ok(Math.abs(on.x - 640) < 1 && Math.abs(on.y - 400) < 1, JSON.stringify(on));

const right = placeGoal({ x: 12, y: 0, z: -4 }, { x: 1.8, y: 0, z: 0.4 }, size, pad, 0.8);
assert.equal(right.off, true);
assert.ok(inside(right), JSON.stringify(right));
assert.ok(right.x > 1200, "sits on the right edge: " + right.x);
assert.ok(Math.abs(right.y - 408) < 30, "level with the middle of the safe area: " + right.y);

const behind = placeGoal({ x: -3, y: -8, z: 10 }, { x: 0, y: 0, z: 1.4 }, size, pad, -2.4);
assert.equal(behind.off, true);
assert.ok(inside(behind), JSON.stringify(behind));
assert.ok(behind.x < 80, "a goal behind and to the left sits on the left edge: " + behind.x);

const low = placeGoal({ x: 0, y: -6, z: -12 }, { x: 0, y: -1.4, z: 0.5 }, size, pad, 0);
assert.equal(low.off, true);
assert.ok(low.y > 680, "in front but off the bottom sits on the bottom edge: " + low.y);

console.log("PASS: goalmark");
