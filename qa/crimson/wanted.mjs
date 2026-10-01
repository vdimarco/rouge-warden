import assert from 'node:assert/strict';
import { open, step, storyReady, freeRoam, shot, invariants } from './lib.mjs';

if (!process.argv.includes('--phone')) {
const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=1', width: 1280, height: 720 });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok, 'story loads');
  assert.ok((await freeRoam(page, { maxSec: 20 })).ok, 'free roam starts');
  console.log('PASS story and free roam');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.traffic.setDensity(0);
    if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    const road = scene.world.roads.sample('a89w', 200, 1);
    scene.hero.place(road.x, road.z);
    window.testCar = scene.vehicles.spawn('van', { pos: road, yaw: road.yaw, player: true });
    if (!scene.drive.enter(testCar, 0)) throw new Error('Cannot enter test van');
    scene.cast.crowd.setDensity(2);
  });
  await step(page, 2);
  await page.keyboard.down('w'); await step(page, 1); await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => Math.abs(testCar.speed) > 0.5), 'keyboard throttle drives');
  await step(page, 5);
  assert.ok(await page.evaluate(() => __crimson.story.S.cast.crowd.list.length > 0), 'crowd spawned');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.victim = scene.cast.crowd.list[0];
    const point = scene.world.roads.sample('a89w', 200, 1);
    testCar.setPose(point.x, point.z, point.yaw);
    testCar.speed = 22;
    const [forwardX, forwardZ] = testCar.toWorld(0, testCar.hd + 0.12);
    victim.pos.set(forwardX, scene.world.surface(forwardX, forwardZ), forwardZ);
    victim.flee = 0; victim.dive = null; victim.state = 'stand'; victim.t = 10;
    Object.assign(victim.circle, { x: forwardX, z: forwardZ, y: victim.pos.y });
    scene.vehicles.people.push(victim.circle);
  });
  await step(page, 1 / 60);
  const impact = await page.evaluate(async () => ({ dead: victim.dead, stars: __crimson.story.S.law.state.stars, crimes: __crimson.story.S.law.state.crimes, speed: testCar.speed,
    riding: __crimson.story.S.drive.riding === testCar, seat: __crimson.story.S.drive.heroSeat, airborne: testCar.airborne, height: testCar.pos.y - victim.pos.y, local: testCar.toLocal(victim.pos.x, victim.pos.z),
    contact: (await import('./js/story/vehicles/pedestrian-impact.js')).pedestrianContact(testCar, victim.circle), hp: victim.hp, hitAt: victim.hitAt }));
  assert.ok(impact.dead && impact.stars === 1 && impact.crimes === 1 && impact.speed > 10, JSON.stringify(impact));
  console.log('PASS physical contact kills once, raises heat, car continues');
  await step(page, 0.45, { draw: true });
  await shot(page, '/tmp/crimson-impact.png');
  assert.ok(await page.evaluate(() => victim.pos.y > __crimson.story.S.world.surface(victim.pos.x, victim.pos.z) + 0.5), 'body launches');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.impactAge = victim.tumble.age;
    scene.mode = 'menu';
  });
  await step(page, 4);
  assert.ok(await page.evaluate(() => victim.tumble.age === impactAge && __crimson.story.S.law.units.length === 0), 'pause freezes impact and dispatch');
  await page.evaluate(() => { __crimson.story.S.mode = 'play'; testCar.speed = 0; });
  await step(page, 4);
  assert.ok(await page.evaluate(() => __crimson.story.S.law.units.length > 0), 'police dispatched');
  console.log('PASS pause and police dispatch');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    for (let count = 0; count < 4; count++) scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(page, 8, { draw: true });
  const escalation = await page.evaluate(() => ({ stars: __crimson.story.S.law.state.stars, units: __crimson.story.S.law.units.length, air: !!__crimson.story.S.law.helicopter, sheriff: __crimson.story.S.law.units.some((unit) => unit.sheriff) }));
  assert.ok(escalation.stars === 5 && escalation.units > 1 && escalation.units <= 4 && escalation.air && escalation.sheriff, JSON.stringify(escalation));
  const before = await page.evaluate(() => __crimson.story.S.law.units[0].vehicle.pos.toArray());
  await step(page, 1);
  const after = await page.evaluate(() => __crimson.story.S.law.units[0].vehicle.pos.toArray());
  assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.05, 'pursuer moves');
  console.log('PASS five-star police/sheriff pursuit and helicopter');
  await step(page, 0.1, { draw: true });
  await shot(page, '/tmp/crimson-pursuit-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await step(page, 0.1, { draw: true });
  const bounds = await page.locator('#sWanted').boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height < 844, 'phone wanted panel in bounds');
  await shot(page, '/tmp/crimson-pursuit-phone.png');
  assert.deepEqual(await invariants(page), []);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    const scene = __crimson.story.S, position = scene.hero.pos;
    window.restoreCamera = scene.cameras.add('wanted-qa', 200, () => true, () => {
      const aircraft = scene.law.helicopter.pos;
      scene.camera.position.set(aircraft.x + 12, Math.max(aircraft.y + 4, scene.world.height(aircraft.x + 12, aircraft.z + 16) + 5), aircraft.z + 16);
      scene.camera.lookAt(aircraft.x, aircraft.y, aircraft.z);
    });
  });
  await step(page, 0.1, { draw: true }); await shot(page, '/tmp/crimson-air-support.png');
  assert.ok(await page.evaluate(() => __crimson.story.S.law.helicopter.pos.toArray().every(Number.isFinite)), 'helicopter remains finite');
  console.log('Pursuit render sample', await page.evaluate(() => __crimson.story.S.test.perf.info()));
  await page.evaluate(() => restoreCamera());
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    const destination = scene.world.place('slide_rock');
    testCar.setPose(destination.x, destination.z, 0);
  });
  await step(page, 0.5);
  assert.equal(await page.evaluate(() => __crimson.story.S.law.state.status), 'search');
  await step(page, 40);
  assert.equal(await page.evaluate(() => __crimson.story.S.law.state.stars), 0, 'distance and broken sight escape pursuit');
  assert.ok(await page.evaluate(() => !__crimson.story.S.cast.crowd.list.includes(victim)), 'old bodies are removed');
  console.log('PASS real-world search and escape');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    const road = scene.world.roads.sample('a89w', 200, 1);
    testCar.setPose(road.x, road.z, road.yaw);
  });
  await step(page, 7);
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.reverseVictim = scene.cast.crowd.list.find((person) => !person.dead);
    if (!reverseVictim) throw new Error('No reverse victim');
    testCar.speed = -12;
    const [positionX, positionZ] = testCar.toWorld(0, -testCar.hd - 0.1);
    reverseVictim.pos.set(positionX, scene.world.surface(positionX, positionZ), positionZ);
    Object.assign(reverseVictim.circle, { x: positionX, z: positionZ, y: reverseVictim.pos.y });
    scene.vehicles.people.push(reverseVictim.circle);
  });
  await step(page, 1 / 60);
  assert.equal(await page.evaluate(() => reverseVictim.dead), true, 'reverse impact is lethal');
  console.log('PASS reverse collision');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.law.reset(); testCar.speed = 0; scene.drive.exit();
    window.meleeVictim = scene.cast.crowd.list.find((person) => !person.dead);
    if (!meleeVictim) throw new Error('No melee victim');
    scene.hero.place(meleeVictim.pos.x, meleeVictim.pos.z - 1.1, 0);
    scene.hero.face = 0; meleeVictim.state = 'stand'; meleeVictim.t = 20; meleeVictim.flee = 0; meleeVictim.dive = null;
  });
  await page.keyboard.press('j'); await step(page, 0.5);
  assert.ok(await page.evaluate(() => meleeVictim.hp < 100 && __crimson.story.S.law.state.stars > 0), 'keyboard melee damages civilians');
  const singleSwing = await page.evaluate(() => {
    const scene = __crimson.story.S;
    meleeVictim.hitAt = -Infinity;
    const attack = { spec: { reach: 10, arc: Math.PI }, cleave: new Set() };
    scene.cast.crowd.strike(scene.hero, attack, 5);
    const before = meleeVictim.hp;
    meleeVictim.hitAt = -Infinity;
    scene.cast.crowd.strike(scene.hero, attack, 5);
    return before === meleeVictim.hp;
  });
  assert.ok(singleSwing, 'one hit per melee swing');
  console.log('PASS keyboard melee and cleave deduplication');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.law.reset();
    const point = scene.world.roads.sample('a89w', 200, 1);
    testCar.setPose(point.x + 50, point.z, 0);
    scene.hero.place(point.x, point.z, 0);
    for (let count = 0; count < 2; count++) scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(page, 8);
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    window.deputyUnit = scene.law.units.find((unit) => unit.sheriff);
    if (!deputyUnit) throw new Error('Sheriff not dispatched');
    deputyUnit.vehicle.setPose(scene.hero.pos.x + 6, scene.hero.pos.z, 0);
    for (const unit of scene.law.units) scene.drivers.stop(unit.vehicle);
  });
  await step(page, 1);
  assert.ok(await page.evaluate(() => !!deputyUnit.deputy), 'sheriff dismounts to pursue on foot');
  await step(page, 7);
  assert.equal(await page.evaluate(() => __crimson.story.S.law.state.stars), 0, 'sheriff arrests stationary player');
  console.log('PASS sheriff dismount and arrest');
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.law.reset();
    const point = scene.world.roads.sample('a89w', 200, 1);
    testCar.setPose(point.x + 50, point.z, 0);
    scene.hero.place(point.x + 10, point.z, 0);
    window.showcase = ['civA', 'civB', 'sheriff'].map((id, index) => scene.cast.spawn(id, { pos: { x: point.x + (index - 1) * 1.8, z: point.z }, yaw: 0, variant: index, costume: false, lod: false }));
    window.restoreCamera = scene.cameras.add('portrait-qa', 200, () => true, () => {
      scene.camera.position.set(point.x, scene.world.surface(point.x, point.z) + 1.5, point.z + 7);
      scene.camera.lookAt(point.x, scene.world.surface(point.x, point.z) + 0.95, point.z);
    });
  });
  await step(page, 0.5, { draw: true }); await shot(page, '/tmp/crimson-civilians-sheriff.png');
  await page.evaluate(() => { restoreCamera(); for (const actor of showcase) __crimson.story.S.cast.despawn(actor); });
  await page.evaluate(() => __crimson.story.S.law.reset());
  await step(page, 0.1);
  assert.ok(await page.evaluate(() => {
    const scene = __crimson.story.S;
    return scene.law.state.stars === 0 && scene.law.units.length === 0 && !scene.law.helicopter;
  }), 'reset clears pursuit');
  assert.deepEqual(errors, []);
  console.log('PASS responsive HUD, finite state, cleanup, no browser errors');
} finally { await browser.close(); }
}

const phone = await open({ query: '?chapter=f1&seed=7&nomusic&q=0', width: 844, height: 390, touch: true });
try {
  assert.ok((await storyReady(phone.page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(phone.page, { maxSec: 20 })).ok);
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.traffic.setDensity(0);
    if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    const road = scene.world.roads.sample('a89w', 200, 1);
    window.mobileVan = scene.vehicles.spawn('van', { pos: road, yaw: road.yaw, player: true });
    if (!scene.drive.enter(mobileVan, 0)) throw new Error('Cannot enter mobile van');
    scene.bus.emit('pedestrianCrime', { fatal: true, pos: mobileVan.pos.clone() });
  });
  await step(phone.page, 2);
  const gas = await phone.page.locator('#st_gas').boundingBox(); assert.ok(gas, 'touch gas visible');
  const cdp = await phone.page.context().newCDPSession(phone.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 1 }] });
  await step(phone.page, 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mobileState = await phone.page.evaluate(() => ({ speed: mobileVan.speed, mode: __crimson.story.S.mode, context: __crimson.story.S.input.context, anim: __crimson.story.S.drive.anim?.type, throttle: mobileVan.controls.throttle, gas: __crimson.story.S.input.held('gas'), freeze: __crimson.story.S.freeze }));
  await step(phone.page, 0.01, { draw: true }); await shot(phone.page, '/tmp/crimson-touch-debug.png');
  assert.ok(Math.abs(mobileState.speed) > 0.5, `touch gas drives under wanted status: ${JSON.stringify(mobileState)} bounds ${JSON.stringify(gas)}`);
  await step(phone.page, 0.1, { draw: true });
  await shot(phone.page, '/tmp/crimson-pursuit-phone.png');
  assert.ok(await phone.page.evaluate(() => {
    const wanted = document.querySelector('#sWanted').getBoundingClientRect();
    const map = document.querySelector('#sMini').getBoundingClientRect();
    return wanted.left >= 0 && wanted.right <= innerWidth && wanted.bottom <= innerHeight && (wanted.right <= map.left || wanted.left >= map.right || wanted.top >= map.bottom || wanted.bottom <= map.top);
  }), 'wanted panel avoids touch minimap');
  assert.deepEqual(phone.errors, []);
  console.log('PASS phone touch driving and wanted layout');
} finally { await phone.browser.close(); }
