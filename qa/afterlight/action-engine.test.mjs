import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_ORDER,
  ACTION_REGIONS,
  createActionGame,
  startAction,
  updateAction,
  fireAction,
  dodgeAction,
  pauseAction,
  resumeAction,
  retryAction,
  advanceAction,
  serializeAction,
  restoreAction,
} from "../../public/afterlight/action-engine.js";
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function frame(s, target, fire = true) {
  const dx = target.x - s.x,
    dy = target.y - s.y,
    n = Math.hypot(dx, dy) || 1;
  const incoming = s.projectiles.find(
    (p) => p.owner === "enemy" && gap(s, p) < 12,
  );
  const charge = s.enemies.find((e) => e.mode === "windup" && gap(s, e) < 22);
  if ((incoming || charge) && s.dodge.cooldown <= 0) {
    const threat = incoming || charge;
    dodgeAction(s, -(threat.y - s.y), threat.x - s.x);
  }
  updateAction(
    s,
    { dx: n > 1 ? dx / n : 0, dy: n > 1 ? dy / n : 0, fire },
    0.05,
  );
  assert.equal(
    s.phase === "lost",
    false,
    `Action failure ${s.region} ${s.stage}: hp${s.hp}, beacon${s.beacon.hp}`,
  );
}
function walk(s, target) {
  for (let i = 0; i < 800 && gap(s, target) > 1 && s.phase === "playing"; i++)
    frame(s, target);
  assert(gap(s, target) < 2, `Could not walk to ${JSON.stringify(target)}`);
}
function completeRegion(s) {
  for (const v of [...s.survivors].sort((a, b) => gap(s, a) - gap(s, b))) {
    if (v.status === "safe") continue;
    if (v.status === "stranded") walk(s, v);
    assert.notEqual(v.status, "stranded");
    walk(s, s.beacon);
    for (let i = 0; i < 60 && v.status !== "safe"; i++) frame(s, s.beacon);
    assert.equal(v.status, "safe");
  }
  assert.equal(s.stage, "defend");
  for (let i = 0; i < 700 && s.phase === "playing"; i++)
    frame(s, {
      x: 100 + Math.sin(s.regionTime * 1.4) * 10,
      y: 62 + Math.cos(s.regionTime * 1.4) * 8,
    });
  assert(
    ["region-complete", "won"].includes(s.phase),
    `Defense did not finish ${s.region}`,
  );
}
function completeCampaign(seed) {
  const s = createActionGame(seed);
  for (const region of ACTION_ORDER) {
    assert.equal(s.region, region);
    assert(startAction(s));
    completeRegion(s);
    if (region !== "moon") assert(advanceAction(s));
  }
  return s;
}
test("A legal movement/fire/dodge solver rescues eighteen people and defends all six worlds", () => {
  for (const seed of [1, 19, 74]) {
    const s = completeCampaign(seed);
    assert.equal(s.phase, "won");
    assert.deepEqual(s.completed, ACTION_ORDER);
    assert.equal(s.totalRescued, 18);
    assert(s.time > 110);
    assert(s.kills > 20);
  }
});
test("Opening survivor is reachable quickly and visible threats have telegraphs before attacking", () => {
  const s = createActionGame();
  assert.equal(s.phase, "ready");
  assert(s.survivors.some((v) => gap(s, v) < 20));
  startAction(s);
  assert.equal(s.enemies.length, 2);
  assert(s.enemies.every((e) => gap(s, e) > 25));
  let telegraphed = false;
  for (let i = 0; i < 60; i++) {
    updateAction(s, {}, 0.025);
    telegraphed ||= s.enemies.some(
      (e) => e.telegraph && e.telegraph.remaining > 0,
    );
  }
  assert(telegraphed);
  assert.equal(s.hp, 100);
});
test("Held light fire defeats an enemy through actual projectile collision and respects fire cooldown", () => {
  const s = createActionGame(3);
  startAction(s);
  const target = s.enemies[0];
  assert(fireAction(s, target.x, target.y));
  assert.equal(fireAction(s, target.x, target.y), false);
  const targetId = target.id;
  for (let i = 0; i < 100 && s.enemies.some((e) => e.id === targetId); i++)
    updateAction(s, { fire: true, aimX: target.x, aimY: target.y }, 0.025);
  assert(!s.enemies.some((e) => e.id === targetId));
  assert(s.kills >= 1);
  assert(s.effects.some((e) => e.kind === "hit" || e.kind === "burst"));
});
test("Recruiting by proximity requires a physical escort before defense begins", () => {
  const s = createActionGame(4);
  startAction(s);
  const v = s.survivors.find((v) => gap(s, v) < 20);
  walk(s, v);
  assert.equal(v.status, "following");
  assert.equal(s.rescued, 0);
  assert.equal(s.stage, "rescue");
  walk(s, s.beacon);
  for (let i = 0; i < 30 && v.status !== "safe"; i++) frame(s, s.beacon);
  assert.equal(v.status, "safe");
  assert.equal(s.rescued, 1);
  assert.equal(s.stage, "rescue");
  assert.equal(s.defenseRemaining, 18);
});
test("Dodge is protected movement with cooldown and pauses freeze combat exactly", () => {
  const s = createActionGame(5);
  startAction(s);
  const x = s.x,
    y = s.y;
  assert(dodgeAction(s, 1, 0));
  assert.equal(dodgeAction(s, 1, 0), false);
  updateAction(s, {}, 0.1);
  assert(s.x - x > 5);
  assert.equal(s.y, y);
  assert(s.dodge.remaining > 0);
  pauseAction(s);
  const frozen = serializeAction(s);
  updateAction(s, { dx: 1, fire: true }, 0.2);
  assert.equal(serializeAction(s), frozen);
  assert.equal(fireAction(s), false);
  assert.equal(dodgeAction(s), false);
  resumeAction(s);
  assert.equal(s.phase, "playing");
});
test("Health and light power pickups change combat through proximity", () => {
  const s = createActionGame(6);
  startAction(s);
  walk(s, { x: 100, y: 73 });
  assert(s.powerRemaining > 0);
  assert(!s.pickups.some((p) => p.kind === "power"));
  assert(fireAction(s) || s.fireCooldown > 0);
  assert(
    s.projectiles.some(
      (p) => p.owner === "player" && p.powered && p.damage === 2,
    ),
  );
});
test("Loss has a fair region checkpoint retry without erasing earlier rescues", () => {
  const s = createActionGame(1);
  startAction(s);
  completeRegion(s);
  advanceAction(s);
  startAction(s);
  for (let i = 0; i < 5000 && s.phase === "playing"; i++)
    updateAction(s, {}, 0.05);
  assert.equal(s.phase, "lost");
  assert.deepEqual(s.completed, ["forest"]);
  assert(retryAction(s));
  assert.equal(s.phase, "ready");
  assert.equal(s.region, "city");
  assert.equal(s.hp, 100);
  assert.equal(s.beacon.hp, 100);
  assert.equal(s.rescued, 0);
  assert.deepEqual(s.completed, ["forest"]);
});
test("Action saves preserve restored regions and in-region rescue progress with deliberate resume", () => {
  const s = createActionGame(8);
  startAction(s);
  const v = s.survivors.find((v) => gap(s, v) < 20);
  walk(s, v);
  walk(s, s.beacon);
  for (let i = 0; i < 30 && v.status !== "safe"; i++) frame(s, s.beacon);
  const loaded = restoreAction(serializeAction(s));
  assert(loaded);
  assert.equal(loaded.phase, "ready");
  assert.equal(loaded.rescued, 1);
  assert.equal(loaded.stage, "rescue");
  assert.equal(loaded.x, s.x);
  assert.equal(loaded.dodge.remaining, 0);
  assert(startAction(loaded));
  assert.equal(restoreAction("invalid"), null);
  assert.equal(restoreAction('{"version":1,"mode":"classic"}'), null);
  const won = completeCampaign(9);
  const restored = restoreAction(serializeAction(won));
  assert(restored);
  assert.equal(restored.phase, "won");
  assert.deepEqual(restored.completed, ACTION_ORDER);
});
test("Regions retain distinct shadow behaviors and weapon cues", () => {
  const kinds = ACTION_ORDER.flatMap((r) => ACTION_REGIONS[r].enemyKinds);
  assert.equal(new Set(kinds).size, 12);
  assert.equal(ACTION_ORDER.length, 6);
});

test("Hostile collisions hurt outside dodge protection and are harmless during the burst", () => {
  const s = createActionGame(2);
  startAction(s);
  s.projectiles.push({
    id: "collision-probe",
    owner: "enemy",
    x: s.x,
    y: s.y,
    vx: 54,
    vy: 0,
    radius: 2,
    damage: 9,
    ttl: 1,
  });
  assert(dodgeAction(s, 1, 0));
  updateAction(s, {}, 0.05);
  assert.equal(s.hp, 100);
  for (let i = 0; i < 6; i++) updateAction(s, {}, 0.05);
  s.projectiles.push({
    id: "damage-probe",
    owner: "enemy",
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    radius: 2,
    damage: 9,
    ttl: 1,
  });
  updateAction(s, {}, 0.025);
  assert.equal(s.hp, 91);
});
test("Triple-light power creates a visible fan while restoration requires the full defense time", () => {
  const s = createActionGame(11);
  startAction(s);
  walk(s, { x: 100, y: 73 });
  while (s.fireCooldown > 0) updateAction(s, {}, 0.025);
  const before = s.projectiles.length;
  assert(fireAction(s, 100, 30));
  assert.equal(s.projectiles.length - before, 3);
  for (const v of s.survivors) {
    if (v.status === "stranded") walk(s, v);
    walk(s, s.beacon);
    for (let i = 0; i < 50 && v.status !== "safe"; i++) frame(s, s.beacon);
  }
  assert.equal(s.stage, "defend");
  assert(s.defenseRemaining > 16);
  assert.equal(s.completed.length, 0);
  assert.equal(advanceAction(s), false);
});
test("Corrupt action saves and inconsistent unlock progress are rejected without touching Classic format", () => {
  const s = createActionGame();
  for (const mutate of [
    (a) => (a.region = "city"),
    (a) => a.completed.push("moon"),
    (a) => (a.survivors[0].status = "missing"),
    (a) => (a.phase = "won"),
    (a) => (a.x = null),
  ]) {
    const bad = JSON.parse(serializeAction(s));
    mutate(bad);
    assert.equal(restoreAction(bad), null);
  }
  assert.equal(
    restoreAction({ version: 1, phase: "ready", region: "forest", worlds: {} }),
    null,
  );
});

test("A charged beacon cannot restore its region while the visible guardian remains alive", () => {
  const s = createActionGame(37);
  startAction(s);
  for (const v of s.survivors) {
    if (v.status === "stranded") walk(s, v);
    walk(s, s.beacon);
    for (let i = 0; i < 50 && v.status !== "safe"; i++) frame(s, s.beacon);
  }
  assert.equal(s.stage, "defend");
  let guardianSeen = false;
  for (
    let i = 0;
    i < 800 && s.defenseRemaining > 0 && s.phase === "playing";
    i++
  ) {
    const target = {
      x: 100 + Math.sin(s.regionTime * 1.4) * 11,
      y: 62 + Math.cos(s.regionTime * 1.4) * 9,
    };
    const dx = target.x - s.x,
      dy = target.y - s.y,
      n = Math.hypot(dx, dy) || 1;
    const add = [...s.enemies]
      .filter((e) => !e.elite)
      .sort((a, b) => gap(s.beacon, a) - gap(s.beacon, b))[0];
    const threat =
      s.projectiles.find((p) => p.owner === "enemy" && gap(s, p) < 13) ||
      s.enemies.find((e) => e.mode === "windup" && gap(s, e) < 25);
    if (threat && s.dodge.cooldown <= 0)
      dodgeAction(s, -(threat.y - s.y), threat.x - s.x);
    updateAction(
      s,
      { dx: dx / n, dy: dy / n, fire: !!add, aimX: add?.x, aimY: add?.y },
      0.05,
    );
    guardianSeen ||= s.enemies.some(
      (e) => e.elite && e.hp > 0 && e.maxHp === 24,
    );
  }
  assert(guardianSeen);
  assert.equal(s.phase, "playing");
  assert.equal(s.defenseRemaining, 0);
  assert.equal(s.guardianDefeated, false);
  assert(s.enemies.some((e) => e.elite && e.hp > 0));
  assert.equal(s.completed.length, 0);
  assert.match(s.message, /Defeat the guardian/);
  assert.equal(advanceAction(s), false);
  for (let i = 0; i < 600 && s.phase === "playing"; i++)
    frame(s, {
      x: 100 + Math.sin(s.regionTime * 1.4) * 10,
      y: 62 + Math.cos(s.regionTime * 1.4) * 8,
    });
  assert.equal(s.phase, "region-complete");
  assert.equal(s.guardianDefeated, true);
  assert.deepEqual(s.completed, ["forest"]);
});
test("Saving an undefeated guardian reconstructs it and cannot bypass the climax on reload", () => {
  const s = createActionGame(3);
  startAction(s);
  for (const v of s.survivors) {
    if (v.status === "stranded") walk(s, v);
    walk(s, s.beacon);
    for (let i = 0; i < 50 && v.status !== "safe"; i++) frame(s, s.beacon);
  }
  for (let i = 0; i < 300 && !s.guardianSpawned; i++)
    frame(s, {
      x: 100 + Math.sin(s.regionTime) * 10,
      y: 62 + Math.cos(s.regionTime) * 8,
    });
  assert(s.guardianSpawned);
  assert.equal(s.guardianDefeated, false);
  const loaded = restoreAction(serializeAction(s));
  assert(loaded);
  assert.equal(loaded.phase, "ready");
  assert.equal(loaded.guardianDefeated, false);
  assert.equal(loaded.guardianSpawned, false);
  startAction(loaded);
  updateAction(loaded, { fire: true }, 0.05);
  assert.equal(loaded.guardianSpawned, true);
  assert(loaded.enemies.some((e) => e.elite && e.hp > 0));
  assert.equal(advanceAction(loaded), false);
});
