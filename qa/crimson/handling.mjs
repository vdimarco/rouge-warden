import assert from 'node:assert/strict';
import { open, storyReady, freeRoam, step, stepUntil, shot } from './lib.mjs';

const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=0', width: 1000, height: 750, touch: true });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(page)).ok);
  const results = await page.evaluate(async () => {
    const { createVehicle, stepVehicle } = await import('./js/story/vehicles/vehicle.js');
    const { SPECS } = await import('./js/story/vehicles/specs.js');
    const S = { time: 0, world: { HALF: 10000, surface: () => 0, surfaceType: () => 'asphalt', water: () => null, normal: (x, z, out) => out.set(0, 1, 0), colliders: { query() {} } } };
    const oldGrip = { van: [7.5, 5], whitevan: [7.5, 5], jeep: [7.8, 6], suv: [8, 5.2], suv_fbi: [8.2, 5.4], pickup: [7.6, 5.4], sedan: [8.4, 4.8], rv: [6.5, 4.4] };
    const results = [];
    for (const kind of Object.keys(SPECS)) for (const surface of ['asphalt', 'dirt']) {
      S.world.surfaceType = () => surface;
      const v = createVehicle(S, 'handling', kind, {}, null);
      v.driven = true; v.controls.steer = 1;
      for (let i = 0; i < 120; i++) { v.speed = 15; stepVehicle(S, v, 1 / 120); }
      const radius = Math.abs(v.speed / v.yawRate);
      const oldAngle = v.spec.steer / (1 + 15 / v.spec.steerV);
      const oldRadius = Math.max(v.spec.wheelbase / Math.tan(oldAngle), 225 / (oldGrip[kind][surface === 'asphalt' ? 0 : 1] * 1.08));
      v.controls.steer = 0;
      for (let i = 0; i < 18; i++) stepVehicle(S, v, 1 / 120);
      const centered = v.steerAngle === 0;
      v.setPose(0, 0, 0); v.speed = 20; v.controls.brake = 1;
      for (let i = 0; i < 600 && v.speed > 0.35; i++) stepVehicle(S, v, 1 / 120);
      const stop = v.pos.z;
      v.controls.reverse = true;
      for (let i = 0; i < 120; i++) stepVehicle(S, v, 1 / 120);
      const reverse = v.speed < -1;
      v.setPose(0, 0, 0); v.controls.brake = 0; v.controls.steer = 1; v.controls.handbrake = true;
      for (let i = 0; i < 120; i++) { v.speed = 15; stepVehicle(S, v, 1 / 120); }
      results.push({ kind, surface, radius, oldRadius, centered, stop, reverse, handbrake: Math.abs(v.speed / v.yawRate) < radius, water: v.spec.grip.water });
    }
    return results;
  });
  for (const r of results) {
    assert.ok(r.radius < r.oldRadius * .9 && r.centered && r.stop < 25 && r.reverse && r.handbrake && r.water === 2.2, JSON.stringify(r));
    console.log(`PASS ${r.kind} ${r.surface}: radius ${r.radius.toFixed(1)}m (was ${r.oldRadius.toFixed(1)}m), stop ${r.stop.toFixed(1)}m; recenter, reverse, handbrake`);
  }
  await page.evaluate(() => {
    const S = __crimson.story.S;
    S.traffic.setDensity(0); S.traffic.clear();
    window.tour = S.vehicles.spawn('jeep', { place: 'f2_jeep', enterable: true });
    S.drive.enter(tour, 1);
    window.tourRoute = S.drivers.route(tour, 'schnebly_vista', { r: 10, speed: 13 });
  });
  const ride = await stepUntil(page, () => tourRoute.done, { maxSec: 160, chunk: 1 });
  const arrival = await page.evaluate(() => {
    const p = __crimson.story.S.world.place('schnebly_vista');
    return { distance: Math.hypot(tour.pos.x - p.x, tour.pos.z - p.z), damage: tour.damage };
  });
  assert.ok(ride.ok && arrival.distance < 25, JSON.stringify({ ride, arrival }));
  console.log(`PASS Gabe tour route: ${ride.sec}s, ${arrival.distance.toFixed(1)}m from vista, damage ${arrival.damage.toFixed(1)}`);
  await step(page, .2, { draw: true });
  await shot(page, '/tmp/crimson-handling.png');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const S = __crimson.story.S;
    S.vehicles.despawn(tour);
    const p = S.world.roads.sample('a89w', 200, 1);
    window.manualCar = S.vehicles.spawn('jeep', { pos: p, yaw: p.yaw, player: true });
    S.drive.enter(manualCar, 0);
  });
  await step(page, 1);
  await page.keyboard.down('w'); await step(page, 2); await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => manualCar.speed > 5), 'keyboard gas accelerates');
  const yaw = await page.evaluate(() => manualCar.yaw);
  await page.keyboard.down('d'); await step(page, .5); await page.keyboard.up('d');
  assert.ok(await page.evaluate(yaw => Math.abs(manualCar.yaw - yaw) > .1, yaw), 'keyboard steering turns');
  await step(page, .15);
  assert.equal(await page.evaluate(() => manualCar.steerAngle), 0, 'keyboard release recenters');
  await page.keyboard.down('s');
  assert.ok((await stepUntil(page, () => Math.abs(manualCar.speed) < .5, { maxSec: 3, chunk: .05 })).ok, 'keyboard brake stops');
  await page.keyboard.up('s');
  console.log('PASS desktop keyboard gas, steering, release and brake');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
