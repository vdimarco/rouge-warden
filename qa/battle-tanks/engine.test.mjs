import test from "node:test";
import assert from "node:assert/strict";
import * as e from "../../public/battle-tanks/engine.js";
function drive(s, target) {
  for (let i = 0; i < 2200 && s.phase === "playing"; i++) {
    const dx = target.x - s.x,
      dy = target.y - s.y,
      d = Math.hypot(dx, dy);
    if (d < 3) return;
    const desired = Math.atan2(dy, dx),
      delta = Math.atan2(
        Math.sin(desired - s.hullAngle),
        Math.cos(desired - s.hullAngle),
      );
    e.update(
      s,
      {
        turn: Math.max(-1, Math.min(1, delta * 3)),
        throttle: Math.abs(delta) > 0.8 ? 0 : d < 12 ? 0.4 : 1,
        fire: true,
        autoAim: true,
      },
      0.05,
    );
    tactics(s);
  }
  assert.notEqual(s.phase, "lost", "legal drive must survive");
}
function tactics(s) {
  const r = s.relays.find(
    (r) => r.hp > 0 && Math.hypot(r.x - s.x, r.y - s.y) <= 55,
  );
  if (r && s.artilleryCooldown === 0) e.artillery(s, r);
  if (s.hp < 80 && s.smokeCooldown === 0) e.smoke(s);
}
export function completeMission(s) {
  for (const p of [
    { x: 20, y: 15 },
    { x: 80, y: 15 },
    { x: 145, y: 15 },
    { x: 183, y: 15 },
  ]) {
    drive(s, p);
    for (
      let i = 0;
      i < 650 && s.phase === "playing" && s.relays.some((r) => r.hp > 0);
      i++
    ) {
      e.update(s, { fire: true, autoAim: true }, 0.05);
      tactics(s);
    }
  }
  assert.equal(s.phase, "playing");
  assert.ok(s.relays.every((r) => r.hp === 0));
  for (const p of [
    { x: 190, y: 15 },
    { x: 190, y: 92 },
    { x: 178, y: 83 },
  ])
    drive(s, p);
  assert.ok(["region-complete", "won"].includes(s.phase));
}
test("all three missions complete through legal fire, artillery and hull steering", () => {
  const s = e.start(e.create());
  for (let i = 0; i < 3; i++) {
    completeMission(s);
    assert.equal(s.completed[i], true);
    if (i < 2) {
      assert.equal(s.phase, "region-complete");
      assert.equal(e.advance(s), true);
    }
  }
  assert.equal(s.phase, "won");
  assert.ok(s.completed.every(Boolean));
  assert.ok(s.shots > 0);
});
test("hull acceleration and turret aiming are independent; coasting loses speed", () => {
  const s = e.start(e.create());
  e.aim(s, 80, 20);
  const angle = s.turretAngle;
  for (let i = 0; i < 15; i++) e.update(s, { turn: 1, throttle: 1 }, 0.05);
  assert.ok(s.hullAngle > 0.9);
  assert.equal(s.turretAngle, angle);
  assert.ok(s.speed > 0);
  const before = s.speed;
  for (let i = 0; i < 15; i++) e.update(s, {}, 0.05);
  assert.ok(s.speed < before / 3);
});
test("solid cover blocks the hull and receives shells before targets behind it", () => {
  const s = e.start(e.create());
  s.x = 50;
  s.y = 67;
  s.hullAngle = 0;
  for (let i = 0; i < 80; i++) e.update(s, { throttle: 1 }, 0.05);
  assert.ok(s.x < 55);
  assert.equal(
    e.lineBlocked(s, { x: 50, y: 67 }, { x: 80, y: 67 }, false),
    true,
  );
  s.x = 50;
  s.speed = 0;
  e.aim(s, 80, 67);
  const hp = s.cover[0].hp;
  e.fire(s);
  for (let i = 0; i < 20; i++) e.update(s, {}, 0.05);
  assert.ok(s.cover[0].hp < hp);
  assert.equal(s.projectiles.filter((p) => p.owner === "player").length, 0);
});
test("smoke blocks targeting with a cooldown; artillery damages through physical cover", () => {
  const s = e.start(e.create());
  assert.equal(e.smoke(s), true);
  assert.equal(e.smoke(s), false);
  assert.equal(e.lineBlocked(s, s, { x: 55, y: 26 }), true);
  s.x = 80;
  s.y = 35;
  const r = s.relays[1];
  assert.equal(e.lineBlocked(s, s, r, false), true);
  assert.equal(e.artillery(s, r), true);
  assert.equal(r.hp, 1);
  assert.equal(e.artillery(s, r), false);
});
test("repairs are single use and pause freezes every simulation field", () => {
  const s = e.start(e.create());
  s.hp = 50;
  s.x = 29;
  s.y = 81;
  e.update(s, {}, 0.05);
  assert.equal(s.hp, 85);
  assert.equal(s.pickups[0].used, true);
  e.update(s, {}, 0.05);
  assert.equal(s.hp, 85);
  e.pause(s);
  const before = structuredClone(s);
  e.update(s, { throttle: 1, turn: 1, fire: true }, 0.05);
  assert.deepEqual(s, before);
  assert.equal(e.fire(s), false);
});
test("separate tank saves validate progress and restore deliberately", () => {
  const s = e.start(e.create());
  completeMission(s);
  const restored = e.restore(e.serialize(s));
  assert.equal(restored.phase, "region-complete");
  assert.equal(restored.completed[0], true);
  assert.equal(e.restore("{broken"), null);
  assert.equal(e.restore({ ...s, x: Infinity }), null);
  assert.equal(e.restore({ ...s, mode: "afterlight" }), null);
  assert.equal(e.restore({ ...s, phase: "won" }), null);
  assert.equal(e.SAVE_KEY, "battle-tanks:campaign:v1");
});

test("spawn bombardment cannot clear distant relays; out-of-range artillery costs no cooldown", () => {
  const s = e.start(e.create());
  assert.equal(e.artillery(s, s.relays[2]), false);
  assert.equal(s.artilleryCooldown, 0);
  for (let i = 0; i < 3000 && s.phase === "playing"; i++) {
    e.update(s, { fire: true, autoAim: true }, 0.05);
    tactics(s);
  }
  assert.ok(s.relays.some((r) => r.hp > 0));
  assert.equal(s.completed[0], false);
});
