import assert from 'node:assert/strict';
import { open, storyReady, freeRoam, step, stepUntil, shot } from './lib.mjs';

const touch = process.env.THEFT_TOUCH === '1';
const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=0', width: touch ? 390 : 1280, height: touch ? 844 : 720, touch });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(page)).ok);
  if (touch) {
    assert.ok(await page.locator('#turnPhone').isVisible(), 'portrait retains rotate-phone prompt');
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await page.evaluate(() => {
    const S = __crimson.story.S;
    S.traffic.setDensity(0); S.traffic.clear();
    if (S.drive.riding) S.vehicles.despawn(S.drive.riding);
    window.theftRoad = S.world.roads.sample('a89w', 200, 1);
  });
  for (const kind of ['van', 'whitevan', 'jeep', 'suv', 'suv_fbi', 'pickup', 'sedan', 'rv']) {
    const prompt = await page.evaluate(kind => {
      const S = __crimson.story.S;
      window.stolen = S.vehicles.spawn(kind, { pos: theftRoad, yaw: theftRoad.yaw, enterable: false });
      stolen.seats[0] = 'driver';
      window.oldDriver = S.drivers.route(stolen, [{ x: theftRoad.x, z: theftRoad.z }, { x: theftRoad.x + 50, z: theftRoad.z }]);
      const p = stolen.doorPoint('driver'); S.hero.place(p.x, p.z, 0, p.y);
      return S.interact.update(S.hero)?.id;
    }, kind);
    assert.ok(prompt?.endsWith(':driver'), `${kind} driver prompt`);
    if (touch) { await step(page, .2); await page.locator('#st_use').tap({ timeout: 5000 }); }
    else await page.keyboard.press('e');
    await step(page, .4);
    assert.ok(await page.evaluate(() => stolen.view.doors.driver.pivot && stolen.view.doors.driver.k > .9 && !!__crimson.story.S.drive.anim), `${kind} opens its door during the pull`);
    assert.ok((await stepUntil(page, () => !__crimson.story.S.drive.anim, { maxSec: 4 })).ok);
    assert.ok(await page.evaluate(() => {
      const S = __crimson.story.S;
      return S.drive.riding === stolen && S.drive.heroSeat === 0 && oldDriver.stopped && !stolen.controller && stolen.seats[0] === 'hero';
    }), `${kind} takeover`);
    if (touch) {
      const cdp = await page.context().newCDPSession(page), box = await page.locator('#st_gas').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await step(page, 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else { await page.keyboard.down('w'); await step(page, 1); await page.keyboard.up('w'); }
    assert.ok(await page.evaluate(() => stolen.speed > 1), `${kind} drives`);
    await page.evaluate(() => { const S = __crimson.story.S; stolen.speed = 0; S.drive.exit(); S.vehicles.despawn(stolen); });
    console.log(`PASS steal and drive occupied ${kind} with ${touch ? 'touch' : 'E'}`);
  }
  const passenger = await page.evaluate(() => {
    const S = __crimson.story.S;
    const v = S.vehicles.spawn('jeep', { pos: theftRoad, yaw: theftRoad.yaw });
    const actor = S.cast.spawn('gabe', { pos: theftRoad }); S.drive.seat(actor, v, 0);
    const h = S.drivers.route(v, [theftRoad, { x: theftRoad.x + 50, z: theftRoad.z }]);
    const door = S.interact.list.find(o => o.id === `getin:${v.id}:passenger`); door.act();
    const ride = S.drive.riding === v && S.drive.heroSeat === 1 && v.seats[0] === actor && !h.stopped;
    S.drive.exit(); S.drive.enter(v, 0);
    const take = v.seats[0] === 'hero' && !S.drive.seated.has(actor) && actor.visible && h.stopped;
    S.vehicles.despawn(v); S.cast.despawn(actor);
    return { ride, take };
  });
  assert.deepEqual(passenger, { ride: true, take: true });
  console.log('PASS passenger ride keeps Gabe driving; driver entry unseats him');
  await page.evaluate(() => { const S = __crimson.story.S; S.traffic.setDensity(1); });
  assert.ok((await stepUntil(page, () => __crimson.story.S.traffic.cars.length > 0, { maxSec: 15 })).ok);
  const traffic = await page.evaluate(() => {
    const S = __crimson.story.S;
    window.stolen = S.traffic.cars[0];
    stolen.setPose(theftRoad.x, theftRoad.z, theftRoad.yaw); stolen.damage = 42;
    const id = stolen.id, tint = stolen.tint;
    S.interact.list.find(o => o.id === `getin:${id}:driver`).act();
    S.traffic.clear();
    return { riding: S.drive.riding === stolen, retained: S.vehicles.list.includes(stolen), traffic: stolen.traffic, kinematic: stolen.kinematic, view: !!stolen.view, id: stolen.id === id, tint: stolen.tint === tint, damage: stolen.damage };
  });
  assert.deepEqual(traffic, { riding: true, retained: true, traffic: false, kinematic: false, view: true, id: true, tint: true, damage: 42 });
  assert.ok((await stepUntil(page, () => !__crimson.story.S.drive.anim, { maxSec: 4 })).ok);
  await page.keyboard.down('w'); await step(page, 1); await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => stolen.speed > 1));
  assert.ok(await page.evaluate(() => {
    const S = __crimson.story.S; stolen.speed = 0; const out = S.drive.exit();
    const back = out && S.drive.enter(stolen, 0); S.vehicles.despawn(stolen); return !!back;
  }));
  console.log('PASS traffic promotion preserves car and survives traffic cleanup, driving and re-entry');
  const lots = await page.evaluate(() => {
    const S = __crimson.story.S;
    return S.world.parkedCars.map(p => {
      S.hero.place(p.x + Math.cos(p.yaw) * 1.8, p.z - Math.sin(p.yaw) * 1.8, 0, p.y);
      S.interact.list.find(o => o.id === `parked:${p.id}:1`).act();
      const v = S.drive.riding; let blocked = false;
      S.world.colliders.query(p.x, p.z, .1, it => { if (it.tag === 'parked' && Math.hypot(it.x-p.x, it.z-p.z) < 1) blocked = true; });
      const ok = !!v && v.kind === p.kind && p.taken && !blocked && !S.world.group.getObjectByName(`town_${p.id}`).visible;
      if (v) S.vehicles.despawn(v);
      return ok;
    });
  });
  assert.equal(lots.length, 11); assert.ok(lots.every(Boolean));
  console.log('PASS all 11 parked lot cars transfer without leftover scenery or colliders');
  const rejected = await page.evaluate(() => {
    const S = __crimson.story.S, v = S.vehicles.spawn('sedan', { pos: theftRoad });
    const door = S.interact.list.find(o => o.id === `getin:${v.id}:driver`);
    v.speed = 10; const fast = !door.when(); v.speed = 0; v.wrecked = true;
    const wreck = !door.when() && !S.drive.enter(v); S.vehicles.despawn(v);
    const gone = !S.drive.enter(v); return fast && wreck && gone;
  });
  assert.ok(rejected);
  await page.evaluate(() => { const S = __crimson.story.S; S.hero.place(theftRoad.x, theftRoad.z); S.bus.emit('pedestrianCrime', { fatal: true, pos: S.hero.pos.clone() }); });
  assert.ok((await stepUntil(page, () => __crimson.story.S.law.units.length > 0, { maxSec: 20 })).ok);
  const patrol = await page.evaluate(() => {
    const S = __crimson.story.S, unit = S.law.units[0], v = unit.vehicle;
    v.setPose(theftRoad.x, theftRoad.z, theftRoad.yaw); v.seats[0] = 'officer';
    const entered = S.drive.enter(v, 0);
    return { entered, stolen: unit.stolen, controlled: !v.controller, stars: S.law.state.stars };
  });
  assert.ok(patrol.entered && patrol.stolen && patrol.controlled && patrol.stars >= 2);
  await step(page, 1, { draw: true }); await shot(page, touch ? '/tmp/crimson-theft-phone.png' : '/tmp/crimson-theft.png');
  assert.ok(await page.evaluate(() => __crimson.story.S.law.state.search > 0), 'stolen patrol is not its own witness');
  console.log('PASS occupied police car theft raises wanted level');
  const reset = await page.evaluate(() => {
    const S = __crimson.story.S; S.bus.emit('exit');
    return !S.drive.riding && S.world.parkedCars.every(p => !p.taken) && !S.interact.list.some(o => o.id.startsWith('getin:') || o.id.startsWith('parked:'));
  });
  assert.ok(reset); assert.deepEqual(errors, []);
  console.log('PASS session cleanup restores parked cars and removes entry prompts');
} finally { await browser.close(); }
