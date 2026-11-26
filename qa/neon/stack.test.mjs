// Neon Stack without a browser: the seeded block, the walk, and the script size.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, pathfind, hackStep, rayHits, hitsMachine, TILE } from "../../public/neon-stack/world.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const a = build(4);
const again = build(4);
const other = build(9);

assert.equal(a.buildings.length, 16);
assert.ok(a.buildings.every((b) => b.h >= 1 && b.h <= 7));
assert.equal(a.buildings.find((b) => b.tx === 0 && b.ty === 0).h, 7);
assert.ok(a.buildings.filter((b) => !(b.tx === 0 && b.ty === 0)).every((b) => b.h <= 5));
assert.deepEqual(a.buildings, again.buildings);
assert.ok(other.buildings.some((b, i) => b.h !== a.buildings[i].h), "seed changes heights");
assert.deepEqual(other.buildings.map((b) => [b.tx, b.ty]), a.buildings.map((b) => [b.tx, b.ty]));
assert.equal(a.signs.length, 6);
assert.equal(a.signs.filter((s) => s.street).length, 4);
assert.deepEqual(a.signs.filter((s) => s.buzz).map((s) => s.name), ["eye"]);
assert.deepEqual(a.signs.filter((s) => s.colour === "#B6F23A").map((s) => s.name), ["cross"]);

assert.equal(a.lights.some((l) => l.type === "fire"), false);
assert.ok(a.slices.length <= 900, a.slices.length + " slices");
function lotH(w, x, y) {
  const b = w.buildings.find((p) => p.tx === x && p.ty === y);
  return b ? b.h : 0;
}
for (const seed of [1, 4, 7, 9]) {
  const w = build(seed);
  for (const b of w.buildings) {
    const bi = w.buildings.indexOf(b);
    const faces = [
      [(q) => q.orient === 2 && q.z > b.z && q.hx > 0, b.tx, b.ty + 1, "s"],
      [(q) => q.orient === 2 && q.z < b.z && q.hx < 0, b.tx, b.ty - 1, "n"],
      [(q) => q.orient === 1 && q.x > b.x && q.hx < 0, b.tx + 1, b.ty, "e"],
      [(q) => q.orient === 1 && q.x < b.x && q.hx > 0, b.tx - 1, b.ty, "w"],
    ];
    for (const [pred, nx, ny, name] of faces) {
      const cover = lotH(w, nx, ny);
      for (let s = cover; s < b.h; s++) {
        const y = (s + 0.5) * TILE;
        const hit = w.slices.some((q) => q.bid === bi && q.kind >= 8 && q.kind < 8.2 && Math.abs(q.y - y) < 1 && pred(q));
        assert.ok(hit, "seed " + seed + " " + b.tx + "," + b.ty + " " + name + " storey " + s);
      }
    }
  }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, filler = 0;
  for (const q of w.slices) {
    if (q.kind !== 8 || q.sign >= 0) continue;
    filler++;
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.z < minZ) minZ = q.z;
    if (q.z > maxZ) maxZ = q.z;
  }
  assert.ok(filler > 40, "seed " + seed + " filler walls " + filler);
  const tower = w.buildings.find((b) => b.tx === 0 && b.ty === 0).h;
  for (const q of w.slices) {
    if (q.kind !== 8 || q.sign >= 0) continue;
    assert.ok(q.y + q.hz <= tower * TILE + 0.1, "filler taller than the tower");
    assert.ok(q.bid >= 16, "filler has a cutaway id");
  }
  assert.ok(minX <= -2 * TILE && maxX >= 8 * TILE, "seed " + seed + " east-west ring " + minX + " " + maxX);
  assert.ok(minZ <= -2 * TILE && maxZ >= 8 * TILE, "seed " + seed + " north-south ring " + minZ + " " + maxZ);
  assert.equal(w.buildings.length, 16);
  assert.equal(w.lights.length, 6);
  assert.equal(w.blocked[2][2], false, "column 2 row 2 stays open");
  assert.equal(w.blocked[3][2], false, "column 3 stays a street tile");
  assert.equal(hitsMachine(3.82, 2.5), true);
  assert.equal(hitsMachine(3, 2.5), false);
  assert.equal(hitsMachine(2.5, 2.5), false);
  assert.ok(Math.hypot(3.5 - w.spawn.x, 2.5 - w.spawn.y) > 2.5);
  assert.ok(Math.hypot(3.5 - w.goals.exit.x, 2.5 - w.goals.exit.y) >= 2);
  assert.equal(pathfind((x, y) => w.blocked[x][y], 2.5, 2.5, 0.5, 4.5).length > 1, true);
  assert.equal(rayHits(2 * TILE, 2.5 * TILE, 4 * TILE, 2.5 * TILE, w.machine), true);
  assert.equal(rayHits(2 * TILE, 0.5 * TILE, 2 * TILE, 4.5 * TILE, w.machine), false);
}
for (const seed of [1, 4, 7, 9]) {
  const w = build(seed);
  assert.ok(w.slices.length <= 900, "seed " + seed + " slices " + w.slices.length);
  const hs = w.buildings.map((b) => b.h);
  assert.equal(w.buildings.filter((b) => b.h === 7).length, 1, "seed " + seed + " one tower");
  assert.ok(hs.filter((h) => h <= 2).length >= 3, "seed " + seed + " shorts " + hs.join(","));
  const tower = w.buildings.find((b) => b.tx === 0 && b.ty === 0).h;
  assert.ok(w.buildings.every((b) => b.tx === 0 && b.ty === 0 || tower - b.h >= 2), "seed " + seed + " tower lead " + hs.join(","));
  const lights = w.lights.filter((l) => l.type === "neon").map((l) => l.x.toFixed(2) + "," + l.y.toFixed(2));
  assert.equal(new Set(lights).size, lights.length, "seed " + seed + " stacked lights");
  const ac = w.buildings.filter((b) => b.prop === "ac_unit").length;
  assert.ok(ac / w.buildings.length <= 0.4, "seed " + seed + " ac " + ac);
}
assert.ok(a.slices.some((s) => s.kind === 1));
for (const s of a.signs) {
  assert.ok(s.plate.hx * 2 <= TILE, s.name + " wider than its lot");
  assert.ok(Math.abs(s.plate.hz * 2 - TILE * 2) < 1, s.name + " is not two tiles tall");
  assert.equal(s.plate.hx, TILE / 2 - 1, s.name + " plate width");
  const left = s.plate.x - s.plate.hx, right = s.plate.x + s.plate.hx;
  const lotL = s.tx * TILE, lotR = (s.tx + 1) * TILE;
  assert.ok(left <= lotR + 0.1 && right >= lotL - 0.1, s.name + " misses its lot");
  const building = (px) => {
    const t = Math.floor((px + 0.001) / TILE);
    return t >= 0 && t < 6 && t !== 2 && t !== 3 && t !== s.tx;
  };
  assert.ok(!building(left) && !building(right - 0.01), s.name + " enters another lot");
}
const neon = a.lights.filter((l) => l.type === "neon");
for (const ty of [2.5, 4.5]) {
  const tiles = [0.5, 1.5, 4.5, 5.5].map((tx) => Math.min(...neon.map((l) => Math.hypot(l.x - tx, l.y - ty))));
  const dark = tiles.filter((d) => d > 2).length;
  assert.ok(dark >= 2, "alley y=" + ty + " has " + dark + " dark tiles (" + tiles.map((d) => d.toFixed(2)).join(", ") + ")");
}
for (const seed of [1, 4, 7, 9]) {
  const w = build(seed);
  for (const s of w.signs) {
    const host = w.buildings.find((b) => b.tx === s.tx && b.ty === s.ty);
    assert.ok(host.h >= 3, "seed " + seed + " " + s.name + " lot " + host.h);
    assert.ok(s.plate.y - s.plate.hz >= -0.6 && s.plate.y + s.plate.hz <= TILE * 2 + 0.6, s.name + " plate storeys");
    for (const b of w.buildings) {
      if (b.tx === s.tx && b.ty > s.ty && !w.signs.some((o) => o.tx === b.tx && o.ty === b.ty)) {
        assert.equal(b.h, 1, "seed " + seed + " lot in front of " + s.name);
      }
    }
  }
  const spawnD = Math.min(...w.lights.map((l) => Math.hypot(l.x - w.spawn.x, l.y - w.spawn.y)));
  assert.ok(spawnD > 2.5, "seed " + seed + " nearest sign " + spawnD.toFixed(2));
  for (const sl of w.slices) {
    if (sl.kind !== 12 || sl.bid < 0 || sl.orient !== 2) continue;
    const host = w.buildings[sl.bid];
    if (sl.y <= host.h * TILE) continue;
    assert.ok(sl.hz * 2 <= TILE * 0.5 + 0.01, "prop " + (sl.hz * 2 / TILE).toFixed(2) + " tiles");
    assert.ok(sl.hx * 2 <= TILE * 0.5 + 0.01, "prop wide " + (sl.hx * 2 / TILE).toFixed(2));
    const blocking = w.signs.some((s) => s.tx === host.tx && s.ty < host.ty);
    if (blocking) assert.equal(host.h, 1, "tall roof in front of a sign");
  }
}
const steps = (from, goal) => pathfind((x, y) => a.blocked[x][y], from.x, from.y, goal.x, goal.y).length - 1;
const spawnExit = steps(a.spawn, a.goals.exit);
const termExit = steps(a.goals.terminal, a.goals.exit);
assert.ok(spawnExit >= 3, "spawn->exit steps " + spawnExit);
assert.ok(termExit >= 3, "terminal->exit steps " + termExit);
const exitLight = Math.min(...a.lights.filter((l) => l.type === "neon").map((l) => Math.hypot(l.x - a.goals.exit.x, l.y - a.goals.exit.y)));
assert.ok(exitLight >= 2, "exit light " + exitLight.toFixed(2));
assert.ok(steps(a.spawn, a.goals.terminal) >= 1, "terminal path");
assert.equal(a.blocked[Math.floor(a.goals.exit.x)][Math.floor(a.goals.exit.y)], false);
let idle = { held: 0, flash: 0, cool: 0 };
idle = hackStep(idle, 0.9, true);
assert.equal(idle.flash, 0, "0.9s hold does nothing");
idle = hackStep(idle, 0, false);
idle = hackStep({ held: 0, flash: 0, cool: 0 }, 1, true);
assert.equal(idle.flash, 4, "1.0s hold flashes");
let cooling = hackStep(idle, 4, false);
assert.equal(cooling.flash, 0);
assert.equal(cooling.cool, 10);
const ignored = hackStep(cooling, 1, true);
assert.equal(ignored.flash, 0, "hold during cooldown does nothing");
assert.ok(ignored.cool < 10 && ignored.cool > 8);
assert.equal(a.blocked[Math.floor(a.goals.terminal.x)][Math.floor(a.goals.terminal.y)], false);

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
for (const name of ["world.mjs", "render.mjs", "game.mjs", "art/atlas-data.mjs"]) {
  bytes += zlib.gzipSync(fs.readFileSync(path.join(root, "public/neon-stack", name))).length;
}
const kb = bytes / 1024;
assert.ok(kb < 150, kb.toFixed(1) + " KB gzipped");
console.log("PASS neon stack logic, " + a.slices.length + " slices, " + kb.toFixed(1) + " KB gz, tile " + TILE);
