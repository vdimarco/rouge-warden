import test from 'node:test';
import assert from 'node:assert/strict';
import { GUNS, LOADOUT, raySphere, reloadMagazine } from '../../public/crimson/js/story/combat/arsenal-data.js';
import { PATROL_TUNE, SPECS } from '../../public/crimson/js/story/vehicles/specs.js';
import { openingReward } from '../../public/crimson/js/story/combat/playermoves.js';
test('arsenal contains distinct, bounded weapon roles', () => {
  assert.equal(LOADOUT.length, 7);
  assert.ok(GUNS.ak47.automatic && GUNS.goldenEagle.damage > GUNS.pistol.damage);
  assert.equal(GUNS.bearSpray.damage, 0);
  for (const gun of Object.values(GUNS)) assert.ok(gun.interval >= 0.1 && gun.magazine > 0 && gun.reload > 1);
});
test('ray test distinguishes nearest hits, misses and targets behind the camera', () => {
  const origin = { x: 0, y: 0, z: 0 }, direction = { x: 0, y: 0, z: 1 };
  assert.equal(raySphere(origin, direction, { x: 0, y: 0, z: 5 }, 1), 4);
  assert.equal(raySphere(origin, direction, { x: 2, y: 0, z: 5 }, 1), Infinity);
  assert.equal(raySphere(origin, direction, { x: 0, y: 0, z: -5 }, 1), Infinity);
});
test('reload conserves finite ammo and patrol upgrades leave stock SUVs untouched', () => {
  const ammo = { loaded: 2, reserve: 3 }; reloadMagazine(ammo, 12);
  assert.deepEqual(ammo, { loaded: 5, reserve: 0 }); reloadMagazine(ammo, 12); assert.equal(ammo.loaded, 5);
  assert.ok(PATROL_TUNE.accel > SPECS.suv_fbi.accel && PATROL_TUNE.brake > SPECS.suv_fbi.brake && PATROL_TUNE.grip.asphalt > SPECS.suv_fbi.grip.asphalt);
  assert.equal(SPECS.suv_fbi.top, 36);
});

test('combat openings reward reads without regressing recoil posture', () => {
  assert.deepEqual(openingReward('idle', 'heavy'), { open: false, damage: 1, posture: 1 });
  assert.deepEqual(openingReward('recover', 'l1'), { open: true, damage: 1.4, posture: 1.45 });
  assert.deepEqual(openingReward('stagger', 'heavy'), { open: true, damage: 1.55, posture: 1.45 });
  assert.deepEqual(openingReward('recoil', 'l1'), { open: true, damage: 1.4, posture: 1.6 });
});
