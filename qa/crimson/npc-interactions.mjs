import assert from 'node:assert/strict';
import { open, storyReady, freeRoam, step, stepUntil, shot } from './lib.mjs';
const touch = process.env.NPC_TOUCH === '1';
const fallback = process.env.NPC_FALLBACK === '1';
const ids = ['police', 'sheriff', 'civA', 'civB'];
const { browser, page, errors } = await open({ query: '?chapter=f1&seed=7&nomusic&q=0&god', width: touch ? 844 : 1280, height: touch ? 390 : 720, touch,
  before: fallback ? page => page.route(/\/models\/(police|sheriff|civA|civB)\.glb/, r => r.abort()) : null });
try {
  assert.ok((await storyReady(page, { maxSec: 90 })).ok);
  assert.ok((await freeRoam(page)).ok);
  await page.evaluate(ids => {
    const S = window.S = __crimson.story.S;
    S.traffic.setDensity(0); S.traffic.clear(); S.cast.crowd.setDensity(0);
    for (const v of [...S.vehicles.list]) S.vehicles.despawn(v);
    window.road = S.world.roads.sample('a89w', 200, 1);
    S.hero.place(road.x, road.z, 0);
    S.cast.all().forEach(a => { S.cast.followers.remove(a); a.visible = false; });
    window.models = ids.map((id, i) => S.cast.spawn(id, { pos: { x: road.x + (i - 1.5) * 1.5, z: road.z }, yaw: 0 }));
    S.cameras.add('npc-qa', 300, () => true, () => {
      S.camera.position.set(road.x + 1, road.y + 2.3, road.z + 7);
      S.camera.lookAt(road.x, road.y + .9, road.z); S.focus.set(road.x, road.y + 1, road.z);
    });
  }, ids);
  assert.ok((await stepUntil(page, () => models.every(a => !!a.body), { maxSec: 60 })).ok);
  const rigs = await page.evaluate(ids => ids.map(id => {
    const C = S.test.cast, tpl = C.template(id);
    const clips = C.clipNames(id);
    const heights = C.heights(id, 'lib:walk');
    return { id, glb: !!tpl.glb, tris: tpl.tris, missing: C.missingBones(id), grounded: heights.every(h => h > .75 && h < 1.15), finite: clips.every(n => { const c = C.clip(id, n); return !!c && C.finite(c) && C.drift(c) < 1e-6; }) };
  }), ids);
  assert.ok(rigs.every(r => r.glb !== fallback && r.tris > 2000 && r.tris < 16000 && !r.missing.length && r.finite && r.grounded), JSON.stringify(rigs));
  for (const pose of ['lib:walk', 'gabe:jabs', 'lib:sitDrive', 'lib:knock']) {
    await page.evaluate(pose => { models.forEach(a => a.play(pose, { restart: true, fade: 0 })); }, pose);
    await step(page, .5);
    assert.ok(await page.evaluate(() => models.every(a => {
      let valid = true; a.root.updateMatrixWorld(true);
      a.root.traverse(o => { if (o.isBone && o.matrixWorld.elements.some(v => !Number.isFinite(v))) valid = false; });
      return valid && !a.coarseOn;
    })), `${pose} has finite live poses and preserves the optimized NPC mesh`);
  }
  await page.evaluate(() => models.forEach(a => a.play('idle', { fade: 0 })));
  await step(page, .1, { draw: true });
  await shot(page, `/tmp/npc-${fallback ? 'fallback' : touch ? 'touch' : 'desktop'}.png`);
  console.log('PASS four NPC bodies, rigs and animation tracks', rigs);
  await page.evaluate(() => { models.forEach(a => S.cast.despawn(a)); S.hero.actor.visible = true; });
  if (!fallback) {
    for (const id of ['police', 'sheriff']) {
      await page.evaluate(id => {
        S.hero.place(road.x, road.z, 0); S.combat.give('fists');
        window.cop = S.combat.spawn('driver', { cast: id, pos: { x: road.x, z: road.z + 1.4 }, group: 'drop-qa' });
        cop.lawUnit = {}; cop.hp = 1; cop.state = 'broken'; cop.t = -1000;
        S.cast.props.attach(cop.a, 'pistol');
        S.arsenal.ammo.pistol.loaded = 0; S.arsenal.ammo.pistol.reserve = 0;
      }, id);
      await step(page, .2);
      if (touch) await page.locator('#st_cut').tap(); else await page.keyboard.press('j');
      await step(page, .8);
      assert.ok(await page.evaluate(() => cop.downed && cop.gunDropped && !cop.a.props.pistol && S.arsenal.drops.length === 1), `${id} melee drops one gun`);
      await page.evaluate(() => { S.test.combat.ko(S.combat.enemies.indexOf(cop)); S.combat.clear('drop-qa'); });
      await step(page, 1);
      assert.ok(await page.evaluate(() => S.arsenal.drops.length === 1 && S.arsenal.drops[0].landed), 'drop survives officer cleanup');
      await page.evaluate(() => { const p = S.arsenal.drops[0].object.position; S.hero.place(p.x, p.z, 0, p.y); S.interact.update(S.hero); });
      await step(page, .1);
      if (touch) await page.locator('#st_use').tap(); else await page.keyboard.press('e');
      await step(page, .1);
      assert.ok(await page.evaluate(() => !S.arsenal.drops.length && S.hero.weapon === 'pistol' && S.arsenal.ammo.pistol.loaded > 0), 'pickup equips and supplies ammo');
      console.log(`PASS ${id} melee, independent falling pickup, ammo and ${touch ? 'touch' : 'keyboard'} collection`);
    }
    await page.evaluate(() => {
      window.car = S.vehicles.spawn('sedan', { pos: road, yaw: 0 }); car.seats[0] = 'driver';
      const p = car.doorPoint('driver'); S.hero.place(p.x, p.z, 0, p.y); S.drive.enter(car);
      window.driver = S.drive.ejected[0];
    });
    await step(page, .5, { draw: true });
    assert.ok(await page.evaluate(() => S.drive.anim && car.view.doors.driver.k > .9 && driver.actor.visible && driver.actor.root.position.distanceTo(driver.from) > .1 && car.controls.throttle === 0));
    await shot(page, `/tmp/carjack-pull-${touch ? 'touch' : 'desktop'}.png`);
    await step(page, 1.1, { draw: true });
    assert.ok(await page.evaluate(() => driver.actor.root.position.distanceTo(driver.ground) < .01 && !!S.drive.anim), 'driver reaches ground before player finishes entry');
    await shot(page, `/tmp/carjack-ground-${touch ? 'touch' : 'desktop'}.png`);
    await step(page, 1);
    assert.ok(await page.evaluate(() => !S.drive.anim && car.view.doors.driver.k === 0 && S.drive.heroSeat === 0));
    await page.evaluate(() => S.vehicles.despawn(car));
    assert.ok(await page.evaluate(() => !S.drive.riding && !S.drive.ejected.length && driver.actor.disposed), 'despawn cleans temporary driver');
    await page.evaluate(() => {
      window.car = S.vehicles.spawn('jeep', { pos: road }); car.seats[0] = 'driver'; S.drive.enter(car); S.vehicles.despawn(car);
    });
    assert.ok(await page.evaluate(() => !S.drive.anim && !S.drive.ejected.length && S.hero.mode === 'foot'), 'interrupted carjack cleans controls');
    console.log('PASS visible door, pull, ground throw, seating, closing and interrupted cleanup');
    await page.evaluate(() => {
      window.car = S.vehicles.spawn('suv_fbi', { pos: road });
      car.seats[0] = 'officer'; car.lawUnit = { vehicle: car, sheriff: false, group: 'jack-qa' };
      S.drive.enter(car); window.ejectedCop = car.lawUnit.deputy;
    });
    await step(page, 4.2);
    assert.ok(await page.evaluate(() => !ejectedCop.carjacked && !ejectedCop.downed && ejectedCop.a.visible), 'police driver recovers');
    await page.evaluate(() => {
      S.test.combat.ko(S.combat.enemies.indexOf(ejectedCop));
      S.vehicles.despawn(car); S.combat.clear('jack-qa');
    });
    await step(page, 1);
    assert.ok(await page.evaluate(() => S.arsenal.drops.length === 1 && S.arsenal.drops[0].landed), 'ejected officer can be defeated and looted');
    await page.evaluate(() => S.bus.emit('exit'));
    assert.ok(await page.evaluate(() => !S.arsenal.drops.length && !S.drive.ejected.length && !S.interact.list.some(i => i.tag === 'police-guns')), 'session exit clears drops, prompts and drivers');
    console.log('PASS police driver recovery, defeat, dropped gun and session cleanup');
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
