// Physical initial-state fixtures supplied only in the intercepted module response.
// All interaction, collisions, timing and rendering then use the real game code.
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.rallies.e2e');
const read = page => page.evaluate(() => window.__rallyFixture.read());
const state = page => page.locator('#rally-status').getAttribute('data-state');
const layouts = [
  { name: 'desktop', ...DESK, side: -1 },
  { name: 'phone-portrait', ...PHONE, side: 1 },
  { name: 'phone-landscape', width: 844, height: 390, touch: true, side: -1 },
];

async function fixture(page, kind, side = -1) {
  await page.route('**/tilt/adventure.js', async route => {
    const response = await route.fetch();
    const original = await response.text();
    if (!original.includes('export function createAdventure(') || !original.includes('export function updateAdventure(')) {
      throw new Error('Rally fixture requires the public create/update exports');
    }
    const body = original
      .replace('export function createAdventure(', 'function fixtureCreateAdventure(')
      .replace('export function updateAdventure(', 'function fixtureUpdateAdventure(') + `
let fixtureCreations = 0;
export function createAdventure() {
  const run = fixtureCreateAdventure(43), sector = currentSector(run), side = ${side};
  const kind = ${JSON.stringify(kind)}, prepared = ++fixtureCreations <= 2;
  const blade = run.world.flippers.find(f => f.sector === 0 && f.side === side);
  const rock = run.table.bumpers.find(b => b.sector === 0 && b.dynamic);
  if (prepared) {
    run.phase = 'play'; run.saveUntil = 0;
    Object.assign(run.world.ball, { live: true, lane: false, x: sector.x + 300,
      y: sector.y + 1000, vx: 100, vy: -100 });
    if (kind === 'strike') Object.assign(run.world.ball,
      { x: blade.px - side * 55, y: blade.py + 50, vx: 0, vy: -300 });
    if (kind === 'return') {
      Object.assign(run.world.ball, { x: sector.x - 180, y: sector.y + 650, vx: 0, vy: -150 });
      run.rally.age = RALLY_FLIGHT - .025;
    }
    if (kind === 'break') {
      Object.assign(run.world.ball, { x: rock.x - rock.r - 20, y: rock.y, vx: 380, vy: rock.vy });
      Object.assign(run.rally, { powerRemaining: RALLY_POWER, multiplier: 2, shots: 2 });
    }
    if (kind === 'warning') {
      Object.assign(rock, { active: false, respawnRemaining: 1.2,
        warningRemaining: 0, _warningIssued: false });
    }
  }
  const fixture = { run, kind, prepared, rock, started: kind !== 'strike' || !prepared,
    events: [], maxFrameTravel: 0, read: () => ({
      phase: run.phase, lives: run.lives, score: run.score, clock: run.clock,
      ball: { x: run.world.ball.x, y: run.world.ball.y, vx: run.world.ball.vx, vy: run.world.ball.vy },
      rally: { ...run.rally }, events: fixture.events.map(e => ({ ...e })),
      held: blade.held, started: fixture.started, maxFrameTravel: fixture.maxFrameTravel,
      rocks: run.table.bumpers.filter(r => r.sector === 0 && r.dynamic).map(r => ({
        id: r.id, x: r.x, y: r.y, active: r.active, pathTime: r.pathTime,
        respawnRemaining: r.respawnRemaining, warningRemaining: r.warningRemaining }))
    }) };
  window.__rallyFixture = fixture;
  return run;
}
export function updateAdventure(run, dt) {
  const f = window.__rallyFixture;
  if (!f || f.run !== run) return fixtureUpdateAdventure(run, dt);
  if (!f.started) {
    const blade = run.world.flippers.find(b => b.sector === 0 && b.side === ${side});
    if (!blade.held) { run.events.length = 0; return; }
    f.started = true;
  }
  const before = { x: run.world.ball.x, y: run.world.ball.y };
  fixtureUpdateAdventure(run, dt);
  f.maxFrameTravel = Math.max(f.maxFrameTravel, Math.hypot(run.world.ball.x - before.x, run.world.ball.y - before.y));
  f.events.push(...run.events.map(e => ({ ...e })));
}
`;
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
}

async function inBounds(page) {
  return page.evaluate(() => {
    const status = document.getElementById('rally-status').getBoundingClientRect();
    const controls = ['left-flip', 'right-flip', 'field-button'].map(id => document.getElementById(id).getBoundingClientRect());
    return document.documentElement.scrollWidth <= innerWidth && status.left >= 0 && status.right <= innerWidth + 1
      && status.top >= 0 && status.bottom <= innerHeight + 1 && controls.every(r =>
        r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1
        && (status.bottom <= r.top || status.top >= r.bottom || status.right <= r.left || status.left >= r.right));
  });
}

async function frozen(page, label) {
  const before = await read(page);
  await page.keyboard.press('z'); await page.keyboard.press('x'); await page.keyboard.press('c');
  await sleep(220);
  const after = await read(page);
  R.check(after.clock === before.clock && JSON.stringify(after.rally) === JSON.stringify(before.rally)
    && JSON.stringify(after.rocks) === JSON.stringify(before.rocks) && JSON.stringify(after.ball) === JSON.stringify(before.ball),
  `${label} freezes ball, power, return and asteroid timers`);
  R.check(await page.locator('.flipper-button.held').count() === 0, `${label} does not retain a held flipper`);
}

for (const size of [...layouts, { name: 'desktop-right', ...DESK, side: 1 }]) {
  R.section(`${size.name}: timed strike and lifecycle`);
  const { page, ctx, errors, close } = await open('tilt/', size);
  let cdp;
  try {
    await fixture(page, 'strike', size.side);
    const name = size.side < 0 ? 'left' : 'right', key = size.side < 0 ? 'z' : 'x';
    const button = page.locator(`#${name}-flip`);
    await until(page, id => document.getElementById(id).classList.contains('shot-ready'), `${name}-flip`);
    R.check((await button.locator('.flip-label').textContent()) === 'FLIP NOW', 'The incoming ball cues its matching flipper');
    R.check(await inBounds(page), 'Rally text fits without overlapping usable flipper and field controls');
    await page.keyboard.press(size.side < 0 ? 'x' : 'z');
    R.check((await read(page)).rally.powerRemaining === 0 && (await read(page)).rally.shots === 0,
      'A press in empty space grants no power or rally credit');
    await shot(page, `tilt-rallies-${size.name}-ready`);
    let down, up;
    if (size.touch) {
      cdp = await ctx.newCDPSession(page);
      const box = await button.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      down = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1, radiusX: 3, radiusY: 3, force: 1 }] });
      up = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.locator('#view').focus();
      down = () => page.keyboard.down(key); up = () => page.keyboard.up(key);
    }
    await down();
    await until(page, () => window.__rallyFixture.read().events.some(e => e.type === 'strike'), null, 2000);
    await until(page, () => document.getElementById('rally-status').dataset.state === 'powered', null, 1500);
    const powered = await read(page);
    R.check(powered.rally.shots === 1 && powered.rally.multiplier === 1 && powered.rally.powerRemaining > 0 && powered.ball.vy > 300,
      'The real moving-flipper strike launches an upward powered shot');
    R.check(/POWER SHOT ×1/.test(await page.locator('#rally-status').textContent()), 'The HUD names power, multiplier and remaining time');
    R.check(powered.events.filter(e => e.type === 'reverse').length === 0, 'An above-blade strike is not an underside rescue');
    if (!size.touch) await down(); // auto-repeat while the same key stays held
    await sleep(400);
    const held = await read(page);
    R.check(held.events.filter(e => e.type === 'strike').length === 1 && held.rally.powerRemaining < powered.rally.powerRemaining,
      'Holding the blade cannot refresh or repeat its power reward');
    await up();
    await until(page, () => !document.querySelector('.flipper-button.held'), null, 1000);
    await shot(page, `tilt-rallies-${size.name}-powered`);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await frozen(page, 'Pause');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await frozen(page, 'The map');
    await page.getByRole('button', { name: 'Close map', exact: true }).click();
    await page.locator('#field-button').click();
    await page.locator('#field-placement').waitFor({ state: 'visible' });
    await frozen(page, 'Field aiming');
    await page.locator('#cancel-field').click();
    const resumed = await read(page);
    await sleep(140);
    R.check((await read(page)).clock > resumed.clock && (await read(page)).rally.powerRemaining < resumed.rally.powerRemaining,
      'Leaving aim resumes the same timed shot');
    const beforePulse = await read(page);
    await page.keyboard.press('c'); await sleep(100);
    const afterPulse = await read(page);
    R.check(afterPulse.rally.age > beforePulse.rally.age && afterPulse.rally.shots === beforePulse.rally.shots
      && afterPulse.rally.powerRemaining < beforePulse.rally.powerRemaining,
    'Pulse does not restart the return clock or award another powered hit');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Start a new voyage', exact: true }).click();
    const fresh = await read(page);
    R.check(fresh.phase === 'ready' && fresh.rally.powerRemaining === 0 && fresh.rally.age === 0 && fresh.rally.shots === 0
      && fresh.rally.multiplier === 1 && fresh.rocks.every(r => r.active && r.warningRemaining === 0 && r.respawnRemaining === 0),
    'A new voyage clears power, multiplier, return state and hazard lifecycle');
    R.check(await state(page) === 'ready' && /Time your flips/.test(await page.locator('#rally-status').textContent()),
      'The dock shows the new gameplay guidance');
  } catch (error) {
    await shot(page, `tilt-rallies-${size.name}-failure`); R.check(false, error.stack || error.message);
  } finally {
    if (cdp) await cdp.detach();
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors'); await close();
  }
}

for (const size of [...layouts, { name: 'desktop-reduced', ...DESK, reduced: true }]) {
  for (const kind of ['return', 'break', 'warning']) {
    R.section(`${size.name}: ${kind}`);
    const { page, errors, close } = await open('tilt/', size);
    try {
      if (size.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await fixture(page, kind);
      const event = kind === 'return' ? 'return' : `asteroid-${kind}`;
      await until(page, name => window.__rallyFixture.read().events.some(e => e.type === name), event, 2000);
      if (kind === 'return') {
        await until(page, () => document.getElementById('rally-status').dataset.state === 'return', null, 1500);
        const returning = await read(page);
        R.check(returning.rally.returning && returning.rally.side === -1 && /ready your left flipper/.test(await page.locator('#rally-status').textContent()),
          'The return current names the approaching flipper');
        R.check(returning.maxFrameTravel < 50, 'The return starts through continuous physical movement');
      } else if (kind === 'break') {
        const broken = await read(page), event = broken.events.find(e => e.type === 'asteroid-break');
        const rock = broken.rocks.find(r => r.id === event.id);
        R.check(!rock.active && rock.respawnRemaining > 0 && event.points > 0 && event.multiplier === 2,
          'A powered physical impact removes the asteroid and awards its rally bonus');
        R.check(/Asteroid smashed/.test(await page.locator('#message').textContent()), 'The smash has visible player feedback');
        await sleep(180);
        const later = await read(page);
        R.check(later.events.filter(e => e.type === 'asteroid-break' && e.id === event.id).length === 1,
          'The destroyed body cannot pay a second destruction reward');
      } else {
        const warning = await read(page), event = warning.events.find(e => e.type === 'asteroid-warning');
        const rock = warning.rocks.find(r => r.id === event.id);
        R.check(!rock.active && rock.warningRemaining > 0, 'A returning asteroid warns while still noncolliding');
        await shot(page, `tilt-rallies-${size.name}-warning`);
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await frozen(page, 'Warning pause');
        await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
        await until(page, id => window.__rallyFixture.read().rocks.find(r => r.id === id).active, event.id, 3000);
        const returned = await read(page), live = returned.rocks.find(r => r.id === event.id);
        R.check(live.warningRemaining === 0 && Math.hypot(live.x - rock.x, live.y - rock.y) > .1,
          'The warning becomes a live asteroid at its moving path position');
        R.check(returned.events.filter(e => e.type === 'asteroid-warning' && e.id === event.id).length === 1,
          'One return emits one warning');
      }
      R.check(await inBounds(page), 'The action HUD and essential controls fit the viewport');
      if (size.reduced) R.check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        'The same interaction remains active with reduced motion');
      await shot(page, `tilt-rallies-${size.name}-${kind}`);
    } catch (error) {
      await shot(page, `tilt-rallies-${size.name}-${kind}-failure`); R.check(false, error.stack || error.message);
    } finally {
      for (const error of errors) R.check(false, error);
      R.check(errors.length === 0, 'No application console or page errors'); await close();
    }
  }
}
R.done();
