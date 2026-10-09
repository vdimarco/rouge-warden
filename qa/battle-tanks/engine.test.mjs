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

test("charge requires actual travel, not turning or throttle against cover", () => {
  const s = e.start(e.create());
  s.enemies.forEach((t) => (t.hp = 0));
  s.relays.forEach((t) => (t.cooldown = 1000));
  for (let i = 0; i < 30; i++) e.update(s, { turn: 1 }, 0.05);
  assert.equal(s.charge, 0);
  s.x = 54.6;
  s.y = 67;
  s.hullAngle = 0;
  s.speed = 0;
  for (let i = 0; i < 100; i++) e.update(s, { throttle: 1 }, 0.05);
  assert.equal(s.charge, 0);
  s.x = 20;
  s.y = 90;
  s.speed = 0;
  for (let i = 0; i < 70; i++) e.update(s, { throttle: 1 }, 0.05);
  assert.equal(s.charge, 100);
  e.fire(s);
  assert.equal(s.charge, 0);
  assert.equal(s.projectiles.at(-1).damage, 2);
  assert.equal(s.projectiles.at(-1).remainingPierces, 1);
});
test("charged shell hits two aligned targets once each and stops at physical cover", () => {
  const s = e.start(e.create());
  s.cover.forEach((t) => (t.hp = 0));
  s.relays.forEach((t) => (t.hp = 0));
  s.enemies.forEach((t) => (t.hp = 0));
  s.x = 20;
  s.y = 20;
  s.charge = 100;
  for (const [i, x] of [35, 45].entries())
    Object.assign(s.enemies[i], { x, y: 20, hp: 3, cooldown: 1000 });
  e.aim(s, 70, 20);
  e.fire(s);
  for (let i = 0; i < 12; i++) e.update(s, {}, 0.05);
  assert.equal(s.enemies[0].hp, 1);
  assert.equal(s.enemies[1].hp, 1);
  assert.equal(s.projectiles.filter((p) => p.owner === "player").length, 0);
  s.shellCooldown = 0;
  s.charge = 100;
  Object.assign(s.cover[0], { x: 30, y: 20, w: 4, h: 8, hp: 12 });
  e.fire(s);
  for (let i = 0; i < 12; i++) e.update(s, {}, 0.05);
  assert.equal(s.cover[0].hp, 11);
  assert.equal(s.enemies[0].hp, 1);
});
test("relay destruction changes encounter once: repair drop, rapid fire, bolt clear and wreck", () => {
  const s = e.start(e.create());
  s.x = 55;
  s.y = 50;
  const r = s.relays[0];
  r.hp = 1;
  s.projectiles.push({
    id: "fixture-hostile",
    x: r.x,
    y: r.y + 5,
    vx: 0,
    vy: 0,
    owner: "tank-0",
    life: 2,
  });
  assert.equal(e.artillery(s, r), true);
  assert.equal(s.weaponBoost, 5);
  assert.equal(s.pickups.filter((p) => p.id === "repair-relay-0").length, 1);
  assert.equal(s.projectiles[0].life, 0);
  assert.equal(s.wrecks.filter((w) => w.id === r.id).length, 1);
  assert.equal(s.restorations[0].r, 24);
  e.fire(s);
  assert.equal(s.shellCooldown, 0.32);
  s.artilleryCooldown = 0;
  e.artillery(s, r);
  assert.equal(s.pickups.filter((p) => p.id === "repair-relay-0").length, 1);
  s.hp = 50;
  s.x = r.x;
  s.y = r.y;
  e.update(s, {}, 0.05);
  assert.equal(s.hp, 85);
});
test("enemy roles warn before their distinct attacks and old saves receive safe defaults", () => {
  const s = e.start(e.create());
  assert.deepEqual(
    s.enemies.map((t) => t.role),
    ["scout", "scatter", "bruiser"],
  );
  assert.equal(s.enemies[2].maxHp, 4);
  s.cover.forEach((t) => (t.hp = 0));
  s.x = 110;
  s.y = 35;
  for (const t of s.enemies) {
    t.cooldown = 0;
    t.warning = 0;
  }
  e.update(s, {}, 0.05);
  assert.equal(s.projectiles.length, 0);
  assert.ok(s.enemies.every((t) => t.warning > 0));
  const scatter = s.enemies[1];
  assert.equal(scatter.warning, 1.1);
  scatter.warning = 0.01;
  for (const t of s.enemies) if (t !== scatter) t.cooldown = 1000;
  e.update(s, {}, 0.05);
  assert.equal(s.projectiles.filter((p) => p.owner === scatter.id).length, 2);
  const old = e.create();
  delete old.charge;
  delete old.weaponBoost;
  delete old.wrecks;
  delete old.restorations;
  for (const t of old.enemies) {
    delete t.role;
    delete t.type;
    delete t.maxHp;
    t.hp = 3;
  }
  const loaded = e.restore(e.serialize(old));
  assert.equal(loaded.charge, 0);
  assert.equal(loaded.weaponBoost, 0);
  assert.equal(loaded.enemies[2].role, "bruiser");
  const current = e.create();
  current.charge = 73;
  current.weaponBoost = 2;
  const saved = e.restore(e.serialize(current));
  assert.equal(saved.charge, 73);
  assert.equal(saved.weaponBoost, 2);
  assert.equal(e.restore({ ...current, charge: 101 }), null);
  assert.equal(e.restore({ ...current, weaponBoost: Infinity }), null);
});
