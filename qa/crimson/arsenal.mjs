import assert from 'node:assert/strict';
import { open, step, storyReady, freeRoam, shot } from './lib.mjs';
const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=1', width: 1280, height: 720 });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(page, { maxSec: 20 })).ok);
  await page.evaluate(() => {
    const scene = __crimson.story.S;
    scene.traffic.setDensity(0); scene.cast.crowd.setDensity(0);
    if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    for (const vehicle of [...scene.vehicles.list]) scene.vehicles.despawn(vehicle);
    const road = scene.world.roads.sample('a89w', 200, 1), aim = scene.world.roads.sample('a89w', 214, 1);
    scene.hero.place(road.x, road.z, road.yaw); scene.hero.hp = 10000;
    window.target = scene.combat.spawn('driver', { pos: aim, group: 'arsenal-qa' });
    target.state = 'broken'; target.t = -1000; target.hp = 1000;
    window.aimCamera = scene.cameras.add('arsenal-qa', 200, () => true, () => {
      scene.camera.position.set(scene.hero.pos.x, scene.hero.pos.y + 1.5, scene.hero.pos.z);
      scene.camera.lookAt(target.pos.x, target.pos.y + 1, target.pos.z);
    });
  });
  for (const [key, weapon] of [['2', 'pistol'], ['3', 'goldenEagle'], ['4', 'ak47']]) {
    await page.keyboard.press(key); await step(page, 0.3);
    assert.equal(await page.evaluate(() => __crimson.story.S.hero.weapon), weapon);
    const health = await page.evaluate(() => target.hp);
    await page.evaluate(() => { const hero = __crimson.story.S.hero; hero.state = 'move'; hero.t = 1; hero.iframe = false; });
    await page.keyboard.press('j'); await step(page, 0.15);
    const firing = await page.evaluate(() => ({ hp: target.hp, shots: __crimson.story.S.arsenal.shots, ammo: __crimson.story.S.arsenal.ammo[__crimson.story.S.hero.weapon], state: __crimson.story.S.hero.state, camera: __crimson.story.S.camera.position.toArray(), target: target.pos.toArray(), aim: __crimson.story.S.camera.getWorldDirection(new __crimson.story.S.THREE.Vector3()).toArray() }));
    assert.ok(firing.hp < health, `${weapon} damages target: ${JSON.stringify(firing)}`);
    await page.evaluate(() => { target.state = 'broken'; target.t = -1000; });
    console.log(`PASS ${weapon} selection and hit`);
  }
  const count = await page.evaluate(() => __crimson.story.S.arsenal.shots);
  await page.keyboard.down('j'); await step(page, 0.65); await page.keyboard.up('j');
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.shots) >= count + 4, 'AK automatic fire');
  await page.evaluate(() => { target.state = 'broken'; target.t = -1000; });
  const reserve = await page.evaluate(() => __crimson.story.S.arsenal.ammo.ak47.reserve);
  await page.keyboard.press('t'); await step(page, 0.2);
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.reload > 0));
  await page.evaluate(() => { window.reloadBefore = __crimson.story.S.arsenal.reload; __crimson.story.S.mode = 'menu'; });
  await step(page, 3);
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.reload === reloadBefore), 'pause freezes reload');
  await page.evaluate(() => { __crimson.story.S.mode = 'play'; }); await step(page, 2.2);
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.ammo.ak47.loaded === 30 && __crimson.story.S.arsenal.ammo.ak47.reserve < 180));
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.ammo.ak47.reserve) < reserve);
  await page.evaluate(() => { __crimson.story.S.arsenal.ammo.ak47.loaded = 0; window.shotsBefore = __crimson.story.S.arsenal.shots; });
  await page.keyboard.press('j'); await step(page, 0.2);
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.shots === shotsBefore), 'empty magazine cannot fire');
  await page.keyboard.press('t'); await step(page, 2.3);
  await page.evaluate(() => {
    const scene = __crimson.story.S, hero = scene.hero.pos;
    window.wall = scene.world.colliders.addBox({ x: (hero.x + target.pos.x) / 2, z: (hero.z + target.pos.z) / 2, w: 6, d: 6, y0: hero.y - 1, top: hero.y + 8 });
    window.healthBefore = target.hp;
  });
  await page.keyboard.press('j'); await step(page, 0.2);
  assert.ok(await page.evaluate(() => target.hp === healthBefore), 'solid cover blocks shots');
  await page.evaluate(() => {
    const scene = __crimson.story.S; scene.world.colliders.remove(wall);
    const toward = target.pos.clone().sub(scene.hero.pos).normalize();
    target.pos.copy(scene.hero.pos).addScaledVector(toward, 4); target.state = 'broken'; target.t = -1000;
    window.healthBefore = target.hp;
  });
  await page.keyboard.press('7'); await step(page, 0.3); await page.keyboard.press('j'); await step(page, 0.2);
  assert.ok(await page.evaluate(() => target.hp === healthBefore && target.state === 'stagger' && target.stunT > 2), 'spray staggers without damage');
  await page.evaluate(() => { __crimson.story.S.cast.crowd.setDensity(2); window.foeTarget = target; });
  await step(page, 5);
  await page.evaluate(() => {
    const scene = __crimson.story.S, road = scene.world.roads.sample('a89w', 214, 1);
    target = scene.cast.crowd.list.find((person) => !person.dead);
    if (!target) throw new Error('No civilian for shooting test');
    target.pos.set(road.x, scene.world.surface(road.x, road.z), road.z);
    target.state = 'stand'; target.t = 10; target.flee = 0; target.dive = null;
  });
  await page.keyboard.press('3'); await step(page, 0.3); await page.keyboard.press('j'); await step(page, 0.1);
  assert.ok(await page.evaluate(() => target.hp < 100 && __crimson.story.S.law.state.stars > 0), 'shooting a civilian damages them and reports a crime');
  await page.evaluate(() => { target = foeTarget; target.state = 'broken'; target.t = -1000; __crimson.story.S.cast.crowd.setDensity(0); __crimson.story.S.law.reset(); });
  for (const [key, weapon] of [['5', 'katana'], ['6', 'baseballBat']]) {
    await page.keyboard.press(key); await step(page, 0.3);
    assert.ok(await page.evaluate((id) => __crimson.story.S.hero.weapon === id && !!__crimson.story.S.hero.actor.props[id], weapon), `${weapon} has visible prop`);
  }
  await page.evaluate(() => {
    const scene = __crimson.story.S, road = scene.world.roads.sample('a89w', 222, 1);
    target.pos.set(road.x, scene.world.surface(road.x, road.z), road.z);
    target.lawUnit = {}; target.state = 'idle'; target.t = 0; target.speed = 0;
    target.cooldown = 100; target.gunCooldown = 0; target.gunTell = 0;
    window.heroHealth = scene.hero.hp;
  });
  await step(page, 0.3);
  assert.ok(await page.evaluate(() => target.gunTell > 0 && __crimson.story.S.hero.hp === heroHealth), 'officer telegraphs before shooting');
  await step(page, 0.65);
  assert.ok(await page.evaluate(() => __crimson.story.S.arsenal.policeShots > 0 && __crimson.story.S.hero.hp < heroHealth), 'armed officer returns fire');
  await page.evaluate(() => {
    const scene = __crimson.story.S, hero = scene.hero.pos;
    window.wall = scene.world.colliders.addBox({ x: (hero.x + target.pos.x) / 2, z: (hero.z + target.pos.z) / 2, w: 6, d: 6, y0: hero.y - 1, top: hero.y + 8 });
    target.gunCooldown = 0; window.heroHealth = scene.hero.hp;
  });
  await step(page, 1.2);
  assert.ok(await page.evaluate(() => __crimson.story.S.hero.hp === heroHealth), 'cover blocks officer fire');
  await page.evaluate(() => __crimson.story.S.world.colliders.remove(wall));
  console.log('PASS officer telegraph, return fire and cover');
  await page.evaluate(() => { aimCamera(); __crimson.story.S.combat.clear('arsenal-qa'); __crimson.story.S.law.reset(); __crimson.story.S.arsenal.equip('ak47'); });
  await step(page, 0.5, { draw: true }); await shot(page, '/tmp/crimson-arsenal-desktop.png');
  await page.evaluate(() => __crimson.story.S.input.set({ look: { x: 0, y: -1 } })); await step(page, 1.3);
  assert.ok(await page.evaluate(() => { const scene = __crimson.story.S; return scene.camera.getWorldDirection(new scene.THREE.Vector3()).y > 0.65; }), 'foot camera looks skyward');
  await page.evaluate(() => {
    const scene = __crimson.story.S; scene.input.clear();
    const road = scene.world.roads.sample('a89w', 200, 1);
    window.car = scene.vehicles.spawn('suv_fbi', { pos: road, yaw: road.yaw, player: true, patrol: true });
    scene.drive.enter(car, 0);
  });
  await step(page, 2); await page.evaluate(() => __crimson.story.S.input.set({ look: { x: 0, y: -1 } })); await step(page, 1.1);
  assert.ok(await page.evaluate(() => { const scene = __crimson.story.S; return scene.camera.getWorldDirection(new scene.THREE.Vector3()).y > 0.7 && car.spec.top === 46 && car.spec.grip.asphalt > 12; }), 'patrol handling and skyward driving camera');
  await step(page, 0.1, { draw: true }); await shot(page, '/tmp/crimson-sky-camera.png');
  const rotor = await page.evaluate(async () => {
    const { Audio } = await import('./js/audio.js'); Audio.init();
    __crimson.story.S.audio.sfx('reload');
    const context = new OfflineAudioContext(1, 24000, 24000);
    const handle = Audio.loopDefs.helicopter(context, context.destination);
    handle.set({ level: 1 });
    const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);
    return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
  });
  assert.ok(rotor > 0.02, `rotor produces audio signal: ${rotor}`);
  await page.evaluate(() => {
    const scene = __crimson.story.S; scene.input.clear();
    for (let count = 0; count < 3; count++) scene.bus.emit('pedestrianCrime', { fatal: true, pos: scene.hero.pos.clone() });
  });
  await step(page, 3.2);
  assert.ok(await page.evaluate(() => !!__crimson.story.S.law.helicopter), 'air support spawns');
  await page.evaluate(() => {
    const scene = __crimson.story.S, aircraft = scene.law.helicopter;
    aircraft.pos.set(car.pos.x + Math.sin(car.yaw) * 35, car.pos.y + 33, car.pos.z + Math.cos(car.yaw) * 35);
    scene.input.set({ look: { x: 0, y: 1 } });
  });
  await step(page, 0.4); await page.evaluate(() => __crimson.story.S.input.clear());
  await step(page, 0.02, { draw: true }); await shot(page, '/tmp/crimson-helicopter-look-up.png');
  assert.ok(await page.evaluate(() => {
    const scene = __crimson.story.S, projected = scene.law.helicopter.pos.clone().project(scene.camera);
    return Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1;
  }), 'helicopter visible with normal driving camera looking up');
  console.log('PASS helicopter visibility and measurable rotor audio');
  assert.deepEqual(errors, []);
  console.log('PASS automatic fire, reload/pause, cover, spray, melee props, upward cameras, patrol upgrades');
} finally { await browser.close(); }

const phone = await open({ query: '?chapter=f1&seed=7&nomusic&q=0', width: 844, height: 390, touch: true });
try {
  assert.ok((await storyReady(phone.page, { maxSec: 90 })).ok); assert.ok((await freeRoam(phone.page, { maxSec: 20 })).ok);
  await phone.page.evaluate(() => {
    const scene = __crimson.story.S; if (scene.drive.riding) scene.vehicles.despawn(scene.drive.riding);
    for (const vehicle of [...scene.vehicles.list]) scene.vehicles.despawn(vehicle);
    const road = scene.world.roads.sample('a89w', 200, 1); scene.hero.place(road.x, road.z, road.yaw);
  });
  await step(phone.page, 0.2);
  await phone.page.getByRole('button', { name: 'Next weapon', exact: true }).tap(); await step(phone.page, 0.3);
  assert.equal(await phone.page.evaluate(() => __crimson.story.S.hero.weapon), 'pistol');
  await phone.page.locator('#st_cut').tap(); await step(phone.page, 0.2);
  assert.equal(await phone.page.evaluate(() => __crimson.story.S.arsenal.ammo.pistol.loaded), 11);
  await phone.page.getByRole('button', { name: 'Reload', exact: true }).tap(); await step(phone.page, 1.6, { draw: true });
  assert.equal(await phone.page.evaluate(() => __crimson.story.S.arsenal.ammo.pistol.loaded), 12);
  await shot(phone.page, '/tmp/crimson-arsenal-touch.png'); assert.deepEqual(phone.errors, []);
  console.log('PASS touch weapon selection, firing and reload');
} finally { await phone.browser.close(); }
