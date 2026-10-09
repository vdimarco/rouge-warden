import test from "node:test";
import assert from "node:assert/strict";
import {
  createJourney,
  start,
  update,
  interact,
  useTool,
  travel,
  pause,
  resume,
  recover,
  getContext,
  getObjectives,
  serialize,
  restore,
  WORLDS,
  REGIONS,
  getLandmarks,
  actionChallenge,
  cancelChallenge,
  getChallengeView,
  terrainAt,
  dodge,
  isSpatialChallenge,
} from "../../public/afterlight/engine.js";
function walk(s, id) {
  const landmark = () =>
    typeof id === "string" ? getLandmarks(s).find((l) => l.id === id) : id;
  let l = landmark();
  assert(l);
  for (let i = 0; i < 900 && Math.hypot(s.x - l.x, s.y - l.y) > 0.6; i++) {
    l = landmark();
    const dx = l.x - s.x,
      dy = l.y - s.y,
      n = Math.hypot(dx, dy);
    update(s, { dx: dx / n, dy: dy / n }, Math.min(0.1, n / 17));
    assert.equal(s.phase, "playing", `Exhausted near ${id} in ${s.region}`);
  }
  assert.ok(Math.hypot(s.x - l.x, s.y - l.y) < 1, `Could not reach ${id}`);
}
function solve(s) {
  for (let guard = 0; s.challenge && guard < 100; guard++) {
    const c = s.challenge;
    if (c.type === "forest") {
      for (const fly of c.fireflies.filter((f) => !f.caught)) {
        walk(s, fly);
        while (c.sweepCooldown > 0) update(s, {}, 0.1);
        assert(actionChallenge(s, "sweep-lantern"));
      }
      assert.equal(c.carried, 3);
      walk(s, c.anchor);
      assert(actionChallenge(s, "deliver"));
    } else if (c.type === "city") {
      for (let i = 0; i < 3; i++) {
        while (c.cells[c.selected].rotation !== c.cells[c.selected].target)
          assert(actionChallenge(s, "rotate-cell"));
        assert(actionChallenge(s, "next-cell"));
      }
      assert(actionChallenge(s, "energize"));
    } else if (c.type === "coast" && c.variant === "escort") {
      assert(actionChallenge(s, "attach"));
      assert(actionChallenge(s, "signal"));
      walk(s, { x: s.x, y: 94 });
      walk(s, { x: 42, y: 94 });
      walk(s, { x: 42, y: 89 });
      for (let i = 0; i < 30; i++) update(s, {}, 0.1);
      assert(actionChallenge(s, "release"));
    } else if (c.type === "coast")
      assert(actionChallenge(s, "signal-" + c.pattern[c.step]));
    else if (c.type === "fjord") {
      assert(actionChallenge(s, "channel-" + c.pattern[c.step]));
      assert(actionChallenge(s, "ping"));
      assert(actionChallenge(s, "listen"));
      assert(actionChallenge(s, "catch"));
    } else if (c.type === "desert") {
      assert(actionChallenge(s, "read-wind"));
      while (c.angle !== c.targets[c.step])
        assert(actionChallenge(s, "bearing-right"));
      assert(actionChallenge(s, "anchor"));
    } else if (c.type === "moon")
      assert(actionChallenge(s, "cultivate-" + c.pattern[c.step]));
  }
  assert.equal(s.challenge, null, "Operation did not complete");
}
function action(s, id, c, tool = false) {
  walk(s, id);
  if (tool) assert(useTool(s), `Tool failed near ${id}`);
  const choice = getContext(s).choices.find((x) => x.id === c);
  assert(
    choice && !choice.disabled,
    `Unavailable ${c} at ${id}: ${JSON.stringify(getContext(s))}`,
  );
  assert(interact(s, c));
  if (c === "restore")
    assert.equal(
      s.challenge,
      null,
      "Final beacon activation must be a direct payoff",
    );
  if (s.challenge) solve(s);
}
function complete(s, { nurture = false, coastFirst = false } = {}) {
  action(s, "cache", "gather");
  for (const id of ["grove-a", "grove-b", "grove-c"])
    action(s, id, nurture ? "nurture" : "gather", true);
  action(s, "beacon", "restore");
  if (coastFirst) {
    assert(travel(s, "coast"));
    for (const id of ["boat-a", "boat-b", "boat-c"])
      action(s, id, "rescue", true);
    walk(s, "beacon");
    assert(getContext(s).choices[0].disabled);
    assert.equal(interact(s, "restore"), false);
  }
  assert(travel(s, "city"));
  action(s, "cache-a", "gather");
  action(s, "cache-b", "gather");
  for (const id of ["junction-a", "junction-b"]) action(s, id, "repair");
  action(s, "station", "restore");
  assert(travel(s, "coast"));
  for (const id of ["boat-a", "boat-b", "boat-c"])
    if (!s.worlds.coast.flags[id]) action(s, id, "rescue", true);
  action(s, "beacon", "restore");
  assert(travel(s, "fjord"));
  action(s, "camp", "rest");
  for (const id of ["bell-a", "bell-b", "bell-c"])
    action(s, id, "retrieve", true);
  action(s, "spire", "restore");
  assert(travel(s, "desert"));
  action(s, "camp", "rest");
  action(s, "cache", "gather");
  for (const id of ["stone-a", "stone-b", "stone-c"])
    action(s, id, "align", true);
  action(s, "oasis", "restore");
  assert(travel(s, "moon"));
  for (const id of ["garden-a", "garden-b", "garden-c"]) action(s, id, "plant");
  action(s, "relay", "restore");
}
test("A legal campaign crosses all six worlds using movement, tools, inventory and camp recovery", () => {
  const s = createJourney(7);
  assert.equal(s.phase, "ready");
  start(s);
  complete(s);
  assert.equal(s.phase, "won");
  assert.equal(REGIONS.filter((r) => s.worlds[r].restored).length, 6);
  assert(s.time > 60, "Journey requires sustained exploration");
  assert(s.tools.sonar && s.tools.compass);
  assert(getObjectives(s).every((o) => o.done));
});
test("Restoration gates travel and prerequisites are described before resources are spent", () => {
  const s = createJourney();
  start(s);
  assert.equal(travel(s, "city"), false);
  walk(s, "beacon");
  const c = getContext(s);
  assert.match(c.choices[0].label, /1 scrap.*3 groves/);
  assert(c.choices[0].disabled);
  assert.equal(interact(s, "restore"), false);
  assert.equal(s.inventory.scrap, 0);
});
test("Optional shield is a real shared resource tradeoff and halves moving hazard damage", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  action(s, "camp", "upgrade");
  assert.equal(s.inventory.scrap, 0);
  assert.equal(s.tools.shield, true);
  const normal = createJourney();
  start(normal);
  const h = s.entities[0];
  s.x = h.x;
  s.y = h.y;
  normal.x = h.x;
  normal.y = h.y;
  normal.time = s.time;
  normal.hull = s.hull;
  update(s, {}, 0.1);
  update(normal, {}, 0.1);
  assert(s.hull > normal.hull);
  assert(s.hull > 99);
});
test("Emergency salvage and rest recover a spent upgrade route without resetting discoveries", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  action(s, "camp", "upgrade");
  action(s, "camp", "salvage");
  action(s, "camp", "salvage");
  assert.equal(s.inventory.scrap, 2);
  assert(s.energy < 100);
  action(s, "camp", "rest");
  assert.equal(s.energy, 100);
  assert.equal(s.worlds.forest.flags.cache, true);
});
test("Loss freezes progress and recovery retains restoration, tools and inventory", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  action(s, "grove-a", "gather", true);
  const supplies = { ...s.inventory };
  for (let i = 0; i < 30; i++) update(s, {}, 0.1);
  s.hull = 0.1;
  const h = s.entities[0];
  s.x = h.x;
  s.y = h.y;
  update(s, {}, 0.2);
  assert.equal(s.phase, "lost");
  const t = s.time;
  update(s, { dx: 1 }, 0.2);
  assert.equal(s.time, t);
  assert(recover(s));
  assert.equal(s.phase, "ready");
  assert.equal(s.hull, 100);
  assert.deepEqual(s.inventory, supplies);
  assert(s.worlds.forest.flags["grove-a"]);
  start(s);
  assert.equal(s.phase, "playing");
});
test("Pause freezes movement/weather and restore safely resumes deliberate ready state", () => {
  const s = createJourney(11);
  start(s);
  action(s, "cache", "gather");
  pause(s);
  const snapshot = serialize(s);
  update(s, { dx: 1 }, 0.2);
  assert.equal(serialize(s), snapshot);
  const saved = restore(snapshot);
  assert.equal(saved.phase, "ready");
  assert.deepEqual(saved.inventory, s.inventory);
  assert(saved.worlds.forest.flags.cache);
  resume(saved);
  assert.equal(saved.phase, "playing");
  assert.equal(restore("broken"), null);
  assert.equal(restore('{"version":1}'), null);
});
test("Returning to an unlocked region preserves shared damage and restored terrain", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  for (const id of ["grove-a", "grove-b", "grove-c"])
    action(s, id, "gather", true);
  action(s, "beacon", "restore");
  s.hull = 61;
  const supply = { ...s.inventory };
  assert(travel(s, "city"));
  assert(travel(s, "forest"));
  assert.equal(s.hull, 61);
  assert.deepEqual(s.inventory, supply);
  assert.equal(s.worlds.forest.restored, 1);
  assert(s.entities.every((h) => !h.active));
});

test("Courier cache offers an irreversible energy-versus-salvage branch without blocking the campaign", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "tune");
  assert(s.tools.efficient);
  assert.equal(s.inventory.scrap, 0);
  assert.equal(interact(s, "gather"), false);
  action(s, "camp", "salvage");
  action(s, "camp", "rest");
  action(s, "grove-a", "gather", true);
  assert.equal(s.inventory.seeds, 2);
  assert(s.energy > 90);
});
test("Malformed boolean flags, missing core tool and incoherent unlocks are rejected", () => {
  const s = createJourney();
  for (const mutate of [
    (x) => (x.worlds.forest.flags = []),
    (x) => (x.worlds.forest.flags.cache = "true"),
    (x) => (x.tools.lantern = false),
    (x) => x.unlocked.push("moon"),
  ]) {
    const bad = JSON.parse(serialize(s));
    mutate(bad);
    assert.equal(restore(bad), null);
  }
});

test("Coast-first branch and nurturing every grove retain enough seeds for all lunar gardens", () => {
  const s = createJourney(19);
  start(s);
  complete(s, { nurture: true, coastFirst: true });
  assert.equal(s.phase, "won");
  assert.equal(s.maxEnergy, 130);
  assert(s.inventory.seeds >= 0);
  assert.equal(
    WORLDS.forest.landmarks.filter(
      (l) => s.worlds.forest.flags[l.id + "-bloom"],
    ).length,
    3,
  );
  assert(travel(s, "forest"));
  assert.equal(s.phase, "playing");
  assert.equal(s.ending, true);
  walk(s, "camp");
  interact(s, "rest");
  assert.equal(s.energy, 130);
  const saved = restore(serialize(s));
  assert(saved);
  assert.equal(saved.maxEnergy, 130);
  assert(saved.ending);
});
test("Tool pulses temporarily calm hazards while planted gardens reduce lunar hazard radius", () => {
  const s = createJourney();
  start(s);
  walk(s, "grove-a");
  assert(useTool(s));
  assert(s.entities.every((h) => !h.active));
  for (let i = 0; i < 30; i++) update(s, {}, 0.1);
  assert(s.entities.some((h) => h.active));
  assert.equal(s.worlds.forest.restored, 0);
  const moon = createJourney();
  moon.region = "moon";
  moon.worlds.moon.stage = 2;
  start(moon);
  update(moon, {}, 0.1);
  assert(moon.entities[0].radius < WORLDS.moon.hazards[0].radius);
});

function restoreForest(s) {
  action(s, "cache", "gather");
  for (const id of ["grove-a", "grove-b", "grove-c"])
    action(s, id, "gather", true);
  action(s, "beacon", "restore");
}
test("Living weather and actor simulation are deterministic and pause freezes every field", () => {
  const a = createJourney(31),
    b = createJourney(31);
  start(a);
  start(b);
  for (let i = 0; i < 100; i++) {
    update(a, { dx: i < 8 ? 1 : 0 }, 0.1);
    update(b, { dx: i < 8 ? 1 : 0 }, 0.1);
  }
  assert.deepEqual(a.environment, b.environment);
  assert.deepEqual(a.terrain, b.terrain);
  assert.equal(a.x, b.x);
  const weather = a.environment.wind;
  for (let i = 0; i < 120; i++) update(a, {}, 0.1);
  assert.notEqual(a.environment.wind, weather);
  pause(a);
  const frozen = serialize(a);
  update(a, { dx: 1 }, 0.25);
  assert.equal(serialize(a), frozen);
});
test("Spatial terrain slows a living map and restoration opens faster paths", () => {
  const s = createJourney();
  start(s);
  walk(s, { x: 76, y: 70 });
  assert(terrainAt(s).kinds.includes("ferns"));
  const before = s.x;
  update(s, { dx: 1 }, 0.2);
  assert(s.x - before < 3.4);
  const oldGround = terrainAt(s, 76, 70).friction;
  restoreForest(s);
  assert(terrainAt(s, 76, 70).friction > oldGround);
  assert(s.paths[0].opened);
  assert.equal(s.paths[0].growth, 1);
});
test("Lantern catches require proximity; cancel preserves supplies and delivery pays once", () => {
  const s = createJourney();
  start(s);
  walk(s, "grove-a");
  const inventory = { ...s.inventory };
  assert(interact(s, "gather"));
  assert(isSpatialChallenge(s));
  walk(s, { x: 35, y: 95 });
  const energy = s.energy;
  assert.equal(actionChallenge(s, "sweep-lantern"), false);
  assert.match(s.challenge.feedback, /Move closer/);
  assert.deepEqual(s.inventory, inventory);
  assert.equal(s.energy, energy);
  assert.equal(s.worlds.forest.flags["grove-a"], undefined);
  assert(cancelChallenge(s));
  assert.deepEqual(s.inventory, inventory);
  walk(s, "grove-a");
  assert(interact(s, "gather"));
  solve(s);
  assert.equal(s.inventory.seeds, 2);
  assert.equal(s.worlds.forest.flags["grove-a"], true);
  assert.equal(actionChallenge(s, "deliver"), false);
  assert.equal(s.inventory.seeds, 2);
});
test("Focused circuit operations immobilize fairly while weather evolves and pending saves stay unpaid", () => {
  const s = createJourney();
  start(s);
  restoreForest(s);
  travel(s, "city");
  action(s, "cache-a", "gather");
  walk(s, "junction-a");
  interact(s, "repair");
  const x = s.x,
    y = s.y,
    hull = s.hull,
    wind = s.environment.wind,
    supplies = { ...s.inventory };
  assert.equal(isSpatialChallenge(s), false);
  assert.equal(dodge(s, 1, 0), false);
  for (let i = 0; i < 50; i++) update(s, { dx: 1, dy: 1 }, 0.1);
  assert.equal(s.x, x);
  assert.equal(s.y, y);
  assert.equal(s.hull, hull);
  assert.notEqual(s.environment.wind, wind);
  assert(s.entities.every((h) => !h.active));
  const loaded = restore(serialize(s));
  assert(loaded);
  assert.equal(loaded.challenge, null);
  assert.deepEqual(loaded.inventory, supplies);
  assert.equal(loaded.phase, "ready");
});
test("Drifting crews must actually be tethered and escorted; premature release spends nothing", () => {
  const s = createJourney(5);
  start(s);
  restoreForest(s);
  travel(s, "coast");
  const initial = getLandmarks(s).find((l) => l.id === "boat-a");
  for (let i = 0; i < 60; i++) update(s, {}, 0.1);
  const drift = getLandmarks(s).find((l) => l.id === "boat-a");
  assert(Math.hypot(initial.x - drift.x, initial.y - drift.y) > 1);
  walk(s, "boat-a");
  useTool(s);
  interact(s, "rescue");
  const supplies = { ...s.inventory };
  assert(actionChallenge(s, "attach"));
  assert.equal(actionChallenge(s, "release"), false);
  assert.match(s.challenge.feedback, /Keep towing/);
  assert.deepEqual(s.inventory, supplies);
  const from = s.x;
  update(s, { dx: -1 }, 0.2);
  assert(s.x < from);
  actionChallenge(s, "signal");
  walk(s, { x: s.x, y: 94 });
  walk(s, { x: 42, y: 94 });
  walk(s, { x: 42, y: 89 });
  for (let i = 0; i < 30; i++) update(s, {}, 0.1);
  assert(actionChallenge(s, "release"));
  assert.equal(s.challenge, null);
  assert(s.worlds.coast.flags["boat-a"]);
  assert.equal(s.inventory.scrap, supplies.scrap + 1);
  const crew = getLandmarks(s).find((l) => l.id === "boat-a");
  assert(Math.hypot(crew.x - 42, crew.y - 89) < 9);
});
test("Growth timestamps survive saves, future dates are clamped and unfinished rewards are not reconstructed", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  action(s, "grove-a", "nurture", true);
  assert.equal(s.worlds.forest.completedAt["grove-a"], s.time);
  const loaded = restore(serialize(s));
  assert(loaded);
  assert.equal(
    loaded.worlds.forest.completedAt["grove-a"],
    s.worlds.forest.completedAt["grove-a"],
  );
  const data = JSON.parse(serialize(s));
  data.worlds.forest.completedAt.cache = data.time + 999;
  const clamped = restore(data);
  assert(clamped);
  assert.equal(clamped.worlds.forest.completedAt.cache, data.time);
});

test("A tow line cannot attach to a remote crew; returning nearby restores the action without cost", () => {
  const s = createJourney(5);
  start(s);
  restoreForest(s);
  travel(s, "coast");
  walk(s, "boat-a");
  useTool(s);
  interact(s, "rescue");
  const supplies = { ...s.inventory };
  walk(s, { x: 35, y: 95 });
  assert(s.challenge.escort.playerDistance > 7);
  assert(s.challenge.choices.find((c) => c.id === "attach").disabled);
  const energy = s.energy;
  assert.equal(actionChallenge(s, "attach"), false);
  assert.match(s.challenge.feedback, /Approach the crew/);
  assert.equal(s.energy, energy);
  assert.deepEqual(s.inventory, supplies);
  assert.equal(s.challenge.escort.tethered, false);
  walk(s, "boat-a");
  assert.equal(
    s.challenge.choices.find((c) => c.id === "attach").disabled,
    false,
  );
  assert(actionChallenge(s, "attach"));
  assert.equal(s.challenge.escort.tethered, true);
  assert.deepEqual(s.inventory, supplies);
});

test("Forest catching needs actual movement, three sweeps and a return delivery before any reward", () => {
  const s = createJourney(9);
  start(s);
  walk(s, "grove-a");
  assert.equal(s.worlds.forest.flags["grove-a-lit"], undefined);
  assert(interact(s, "nurture"));
  const c = s.challenge;
  assert.equal(c.variant, "catch");
  assert(isSpatialChallenge(s));
  const original = c.fireflies.map((f) => ({ x: f.x, y: f.y }));
  for (let i = 0; i < 6; i++) update(s, {}, 0.1);
  assert(
    c.fireflies.some(
      (f, i) => Math.hypot(f.x - original[i].x, f.y - original[i].y) > 0.1,
    ),
  );
  for (const fly of c.fireflies) {
    walk(s, fly);
    while (c.sweepCooldown > 0) update(s, {}, 0.1);
    assert(actionChallenge(s, "sweep-lantern"));
  }
  assert.equal(c.carried, 3);
  assert.equal(c.phase, "active");
  assert.equal(s.inventory.seeds, 0);
  assert.equal(s.maxEnergy, 100);
  walk(s, { x: 35, y: 95 });
  assert(c.deliveryDistance > 7);
  assert.equal(c.choices.find((x) => x.id === "deliver").disabled, true);
  assert.equal(actionChallenge(s, "deliver"), false);
  assert.equal(s.inventory.seeds, 0);
  walk(s, c.anchor);
  assert(actionChallenge(s, "deliver"));
  assert.equal(s.challenge, null);
  assert.equal(s.inventory.seeds, 1);
  assert.equal(s.maxEnergy, 110);
  assert.equal(actionChallenge(s, "deliver"), false);
  assert.equal(s.inventory.seeds, 1);
});
test("Dodge is a directional protected burst with cooldown, fair movement and no action resource charge", () => {
  const s = createJourney(2);
  start(s);
  restoreForest(s);
  travel(s, "coast");
  walk(s, { x: 103, y: 81 });
  const supplies = { ...s.inventory },
    energy = s.energy,
    hull = s.hull,
    from = { x: s.x, y: s.y };
  assert(dodge(s, 0, 1));
  assert.equal(s.energy, energy);
  assert.deepEqual(s.inventory, supplies);
  assert.equal(s.dodge.remaining, 0.25);
  assert.equal(dodge(s, 1, 0), false);
  update(s, {}, 0.05);
  assert(s.y - from.y > 2);
  assert.equal(s.hull, hull);
  assert(s.dodge.cooldown > 0);
  assert.equal(dodge(s, 1, 0), false);
  for (let i = 0; i < 13; i++) update(s, { dx: -1 }, 0.1);
  assert.equal(s.dodge.remaining, 0);
  assert.equal(s.dodge.cooldown, 0);
  assert(dodge(s, -1, 0));
  pause(s);
  const frozen = serialize(s);
  update(s, { dx: 1 }, 0.2);
  assert.equal(serialize(s), frozen);
  assert.equal(dodge(s, 1, 0), false);
  const loaded = restore(frozen);
  assert(loaded);
  assert.equal(loaded.dodge.remaining, 0);
  assert.equal(loaded.dodge.cooldown, 0);
});
test("All final beacons are direct paid rewards instead of another challenge", () => {
  const s = createJourney();
  start(s);
  action(s, "cache", "gather");
  for (const id of ["grove-a", "grove-b", "grove-c"]) action(s, id, "gather");
  walk(s, "beacon");
  const before = s.inventory.scrap;
  assert(interact(s, "restore"));
  assert.equal(s.challenge, null);
  assert.equal(s.inventory.scrap, before - 1);
  assert.equal(s.worlds.forest.restored, 1);
  assert.match(s.message, /rescue|crews/);
  assert.equal(interact(s, "restore"), false);
  assert.equal(s.inventory.scrap, before - 1);
});
