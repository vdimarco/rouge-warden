// Neon Stack without a browser: the seeded block, the walk, and the script size.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, pathfind, TILE } from "../../public/neon-stack/world.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const a = build(4);
const again = build(4);
const other = build(9);

assert.equal(a.buildings.length, 12);
assert.ok(a.buildings.every((b) => b.h >= 16 && b.h <= 40));
assert.deepEqual(a.buildings, again.buildings);
assert.notDeepEqual(a.buildings.map((b) => b.h), other.buildings.map((b) => b.h));
assert.equal(a.signs.length, 5);
assert.deepEqual(a.signs.map((s) => [s.name, s.w, s.h, s.colour]), [
  ["noodle", 12, 10, "#FF3D8B"],
  ["bar", 6, 20, "#3DE0E8"],
  ["arrow", 14, 6, "#F2A33A"],
  ["eye", 12, 8, "#FF3D8B"],
  ["cross", 9, 9, "#B6F23A"],
]);
assert.deepEqual(a.signs.filter((s) => s.buzz).map((s) => s.name), ["eye"]);
assert.deepEqual(a.signs.filter((s) => s.colour === "#B6F23A").map((s) => s.name), ["cross"]);

const fire = a.lights.find((l) => l.type === "fire");
const near = Math.min(...a.lights.filter((l) => l.type === "neon").map((l) => Math.hypot(l.x - fire.x, l.y - fire.y)));
assert.ok(near <= 2, "barrel is " + near.toFixed(2) + " tiles from the nearest sign");
assert.ok(a.slices.length <= 3000, a.slices.length + " slices");
assert.ok(a.slices.some((s) => s.kind === 1));

const blocked = (x, y) => a.blocked[x][y];
const alley = pathfind(blocked, 2.5, 0.5, 2.5, 4.5);
assert.ok(alley.length >= 2);
for (const [x, y] of alley) assert.equal(blocked(Math.floor(x), Math.floor(y)), false);
const around = pathfind(blocked, 4.5, 1.5, 0.5, 1.5);
if (around.length) {
  for (const [x, y] of around) assert.equal(blocked(Math.floor(x), Math.floor(y)), false);
  assert.ok(around.length > 2);
}
assert.equal(pathfind(blocked, 2.5, 0.5, 1.5, 1.5).length, 0);

let bytes = 0;
for (const name of ["world.mjs", "render.mjs", "game.mjs"]) {
  bytes += zlib.gzipSync(fs.readFileSync(path.join(root, "public/neon-stack", name))).length;
}
const kb = bytes / 1024;
assert.ok(kb < 150, kb.toFixed(1) + " KB gzipped");
console.log("PASS neon stack logic, barrel " + near.toFixed(2) + " tiles, " + a.slices.length + " slices, " + kb.toFixed(1) + " KB gz, tile " + TILE);
