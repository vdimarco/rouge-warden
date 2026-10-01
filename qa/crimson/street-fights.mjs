import assert from 'node:assert/strict';
import { open, step, storyReady, freeRoam, shot } from './lib.mjs';

const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=1', width: 1280, height: 720 });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(page, { maxSec: 20 })).ok);
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.traffic.setDensity(0);
    if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    const road = scene.world.roads.sample('a89w', 200, 1);
    scene.hero.place(road.x, road.z, 0); scene.hero.hp = 10000;
    scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(page, 3.1);
  assert.ok(await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.patrol = scene.law.units[0];
    patrol.vehicle.setPose(scene.hero.pos.x + 7, scene.hero.pos.z, 0);
    return !scene.drive.enter(patrol.vehicle, 0) && !scene.drive.enter(patrol.vehicle, 1);
  }), 'occupied police vehicle cannot be entered');
  await step(page, 0.5);
  assert.ok(await page.evaluate(() => patrol.deputy && !patrol.sheriff && patrol.vehicle.seats[0] === null && Math.abs(patrol.vehicle.speed) < 0.8), 'regular police stop and dismount');
  await page.evaluate(() => {
    const scene = __crimson.story.S, officer = patrol.deputy;
    window.officerStart = officer.pos.clone();
    scene.hero.place(officer.pos.x, officer.pos.z + 10, Math.PI);
  });
  await step(page, 1);
  assert.ok(await page.evaluate(() => patrol.deputy.pos.distanceTo(officerStart) > 0.5), 'officer pursues on foot');
  await page.evaluate(() => {
    const scene = __crimson.story.S, officer = patrol.deputy;
    officer.cooldown = 100; officer.state = 'idle'; officer.atk = null;
    scene.hero.place(officer.pos.x, officer.pos.z - 1.5, 0); scene.hero.face = 0;
    scene.hero.state = 'move'; scene.hero.t = 0;
    window.officerHp = officer.hp; window.heatBefore = scene.law.state.heat;
  });
  await page.keyboard.press('j'); await step(page, 0.6, { draw: true });
  assert.ok(await page.evaluate(() => patrol.deputy.hp < officerHp && __crimson.story.S.law.state.heat > heatBefore), 'keyboard punch damages officer and raises heat');
  await shot(page, '/tmp/crimson-police-fight.png');
  await page.evaluate(() => {
    const scene = __crimson.story.S, officer = patrol.deputy;
    officer.cooldown = 0; officer.state = 'idle'; officer.token = true;
    scene.hero.place(officer.pos.x, officer.pos.z + 2.5, Math.PI); scene.hero.state = 'move';
    window.heroHp = scene.hero.hp;
  });
  await step(page, 3);
  assert.ok(await page.evaluate(() => __crimson.story.S.hero.hp < heroHp), 'officer fights back');
  await page.evaluate(() => {
    const scene = __crimson.story.S, officer = patrol.deputy;
    officer.hp = 1; officer.cooldown = 100; officer.state = 'broken'; officer.t = 0; officer.atk = null;
    scene.hero.place(officer.pos.x, officer.pos.z - 1.5, 0); scene.hero.face = 0;
    scene.hero.state = 'move'; scene.hero.t = 0; scene.hero.st = 100;
  });
  await page.keyboard.press('k'); await step(page, 2);
  assert.ok(await page.evaluate(() => patrol.deputy.downed), 'heavy attack knocks officer out');
  await page.evaluate(() => {
    const scene = __crimson.story.S, door = patrol.vehicle.doorPoint('driver');
    scene.hero.place(door.x, door.z, patrol.vehicle.yaw); scene.hero.state = 'move'; scene.hero.t = 0;
    window.crimesBefore = scene.law.state.crimes;
  });
  await step(page, 0.1);
  await page.keyboard.press('e'); await step(page, 2);
  assert.ok(await page.evaluate(() => __crimson.story.S.drive.riding === patrol.vehicle && patrol.stolen && __crimson.story.S.law.state.crimes === crimesBefore + 1), 'door interaction steals the police vehicle once');
  await page.evaluate(() => {
    const road = __crimson.story.S.world.roads.sample('a89w', 260, 1);
    patrol.vehicle.setPose(road.x, road.z, road.yaw);
  });
  await page.keyboard.down('w'); await step(page, 1); await page.keyboard.up('w');
  const driving = await page.evaluate(() => ({ speed: patrol.vehicle.speed, controller: patrol.vehicle.controller?.kind, done: patrol.vehicle.controller?.done, controls: patrol.vehicle.controls, seat: __crimson.story.S.drive.heroSeat, mode: __crimson.story.S.mode, context: __crimson.story.S.input.context, anim: __crimson.story.S.drive.anim?.type, hero: __crimson.story.S.hero.state }));
  assert.ok(driving.speed > 0.5 && (!driving.controller || driving.done), `player drives stolen car without police AI: ${JSON.stringify(driving)}`);
  await step(page, 0.1, { draw: true }); await shot(page, '/tmp/crimson-stolen-patrol.png');
  await page.evaluate(() => {
    const scene = __crimson.story.S, destination = scene.world.place('slide_rock');
    patrol.vehicle.setPose(destination.x, destination.z, 0);
  });
  await step(page, 42);
  assert.ok(await page.evaluate(() => {
    const scene = __crimson.story.S;
    return scene.law.state.stars === 0 && scene.drive.riding === patrol.vehicle && scene.vehicles.list.includes(patrol.vehicle);
  }), 'escaping preserves stolen vehicle');
  await page.evaluate(() => __crimson.story.S.law.reset());
  assert.ok(await page.evaluate(() => !__crimson.story.S.vehicles.list.includes(patrol.vehicle)), 'session reset cleans retained vehicles');
  await page.evaluate(() => {
    const scene = __crimson.story.S, road = scene.world.roads.sample('a89w', 200, 1);
    scene.hero.place(road.x, road.z, 0);
    scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(page, 3.1);
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.returningPatrol = scene.law.units[0];
    returningPatrol.vehicle.setPose(scene.hero.pos.x + 7, scene.hero.pos.z, 0);
  });
  await step(page, 0.5);
  assert.ok(await page.evaluate(() => !!returningPatrol.deputy));
  await page.evaluate(() => {
    const scene = __crimson.story.S, road = scene.world.roads.sample('a89w', 250, 1);
    const getaway = scene.vehicles.spawn('van', { pos: road, yaw: road.yaw, player: true });
    scene.drive.enter(getaway, 0);
  });
  await step(page, 3);
  // Keep the result boolean inside the browser: returning the controller itself
  // serializes its game object graph into Node and previously exhausted the heap.
  assert.ok(await page.evaluate(() => !returningPatrol.deputy && returningPatrol.vehicle.seats[0] === 'officer' && !!returningPatrol.vehicle.controller), 'officer returns and resumes vehicle pursuit');
  assert.deepEqual(errors, []);
  console.log('PASS police dismount, pursuit, punch, retaliation, heavy knockout, E theft, driving, escape ownership, reset');
} finally { await browser.close(); }

const phone = await open({ query: '?chapter=f1&seed=7&nomusic&q=0', width: 844, height: 390, touch: true });
try {
  assert.ok((await storyReady(phone.page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(phone.page, { maxSec: 20 })).ok);
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.traffic.setDensity(0);
    if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    const road = scene.world.roads.sample('a89w', 200, 1);
    scene.hero.place(road.x, road.z, 0);
    scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(phone.page, 3.1);
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S;
    window.patrol = scene.law.units[0];
    patrol.vehicle.setPose(scene.hero.pos.x + 7, scene.hero.pos.z, 0);
  });
  await step(phone.page, 0.5);
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S, officer = patrol.deputy;
    officer.cooldown = 100; officer.state = 'broken'; officer.t = 0;
    scene.hero.place(officer.pos.x, officer.pos.z - 1.5, 0); scene.hero.face = 0;
    window.healthBefore = officer.hp;
  });
  await step(phone.page, 0.1);
  await phone.page.locator('#st_cut').tap(); await step(phone.page, 0.7);
  assert.ok(await phone.page.evaluate(() => patrol.deputy.hp < healthBefore), 'touch attack damages officer');
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S, door = patrol.vehicle.doorPoint('driver');
    scene.hero.place(door.x, door.z, 0); scene.hero.state = 'move'; scene.hero.t = 0;
  });
  await step(phone.page, 0.1);
  await phone.page.locator('#st_use').tap(); await step(phone.page, 2, { draw: true });
  assert.ok(await phone.page.evaluate(() => __crimson.story.S.drive.riding === patrol.vehicle && patrol.stolen), 'touch USE steals patrol vehicle');
  await shot(phone.page, '/tmp/crimson-stolen-patrol-touch.png');
  assert.deepEqual(phone.errors, []);
  console.log('PASS touch police combat and vehicle theft');
} finally { await phone.browser.close(); }
