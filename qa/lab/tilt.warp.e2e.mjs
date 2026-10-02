// Browser-only fixture enters the real upgrade/travel path. Input cases get a
// longer flight; collection cases use aligned initial rings. The model and UI
// then run normally. No debug hook is added to the shipped game.
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.warp.e2e');
const read = page => page.evaluate(() => window.__warpFixture.read());
const cleared = state => Math.hypot(state.target.x - state.pilot.x, state.target.y - state.pilot.y) < 1e-6;
const fits = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
});

async function installFixture(page, options = {}) {
  await page.route('**/tilt/adventure.js', async route => {
    const response = await route.fetch(), original = await response.text();
    if (!original.includes('export function createAdventure(') || !original.includes('export function updateAdventure(')) {
      throw new Error('Warp fixture needs the public create/update exports');
    }
    const body = original
      .replace('export function createAdventure(', 'function fixtureCreateAdventure(')
      .replace('export function updateAdventure(', 'function fixtureUpdateAdventure(') + `
// This observed initial-state fixture exists only in the intercepted response.
export function createAdventure() {
  const options = ${JSON.stringify(options)}, run = fixtureCreateAdventure(43);
  run.phase = 'upgrade'; run.sectors[0].cleared = true;
  run.score = 250; run.fieldCharges = options.charges ?? 1;
  chooseUpgrade(run, 'pulse', { reducedMotion: !!options.reduced });
  const flight = run.flight;
  if (options.duration) flight.duration = options.duration;
  if (options.aligned) for (const ring of flight.surf.rings) { ring.x = .55; ring.y = .20; }
  const fixture = { run, flight, rings: [], bonuses: [], arrivals: 0,
    read: () => ({ phase: run.phase, progress: flight.progress, sector: run.sectorIndex,
      lives: run.lives, score: run.score, charges: run.fieldCharges,
      enabled: flight.surf.enabled, pilot: { ...flight.surf.pilot }, target: { ...flight.surf.target },
      hits: flight.surf.hits, points: flight.surf.points,
      rings: flight.surf.rings.map(r => ({ id: r.id, status: r.status })),
      ringEvents: fixture.rings.map(e => ({ ...e })), bonuses: fixture.bonuses.map(e => ({ ...e })),
      arrivals: fixture.arrivals }) };
  window.__warpFixture = fixture;
  return run;
}
export function updateAdventure(run, dt) {
  fixtureUpdateAdventure(run, dt);
  const fixture = window.__warpFixture;
  if (fixture?.run !== run) return;
  fixture.rings.push(...run.events.filter(e => e.type === 'warp-ring'));
  fixture.bonuses.push(...run.events.filter(e => e.type === 'warp-bonus'));
  fixture.arrivals += run.events.filter(e => e.type === 'arrive').length;
}
`;
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
  if (options.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
  await page.locator('#transit-panel').waitFor({ state: 'visible' });
}

async function makePointer(page, ctx, touch) {
  if (!touch) return {
    down: async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); },
    move: p => page.mouse.move(p.x, p.y, { steps: 4 }),
    up: () => page.mouse.up(),
    cancel: async () => {
      // Mouse cancellation has no Playwright primitive. Dispatch its standard
      // notification after a genuine pointerdown, then release the mouse.
      await page.evaluate(() => document.getElementById('view').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true })));
      await page.mouse.up();
    },
    close: async () => {},
  };
  const cdp = await ctx.newCDPSession(page);
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type,
    touchPoints: p ? [{ ...p, id: 1, radiusX: 3, radiusY: 3, force: 1 }] : [] });
  return { down: p => send('touchStart', p), move: p => send('touchMove', p),
    up: () => send('touchEnd'), cancel: () => send('touchCancel'), close: () => cdp.detach() };
}

async function arrive(page) {
  await page.locator('#transit-panel').waitFor({ state: 'hidden', timeout: 12000 });
  await page.locator('#launch-button').waitFor({ state: 'visible' });
  await until(page, () => window.__warpFixture.read().phase === 'ready' && document.querySelector('#view').dataset.visibleSector === '1');
  const state = await read(page);
  R.check(state.sector === 1 && state.lives === 3 && state.arrivals === 1, 'Travel arrives once at the second dock with all hearts');
  R.check(await page.locator('#left-flip').isEnabled() && await page.locator('#map-button').isEnabled(), 'Arrival restores the normal game controls');
  return state;
}

const sizes = [
  { name: 'desktop', ...DESK },
  { name: 'phone-portrait', ...PHONE },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
];

for (const size of sizes) {
  R.section(`${size.name}: steering and input cleanup`);
  const { page, ctx, errors, close } = await open('tilt/', size);
  let pointer;
  try {
    await installFixture(page, { duration: 60 });
    R.check(/Full Tilt/.test(await page.title()) && /\/lab\/tilt\/$/.test(page.url()), 'The Full Tilt page loads');
    R.check(await page.locator('#warp-readout').isVisible() && (await page.locator('#warp-help').textContent()).includes('steer'), 'The warp challenge explains its steering control');
    R.check(await fits(page.locator('#skip-transit')) && await page.locator('#controls').isHidden(), 'Skip fits on screen while ordinary flipper controls stay hidden');
    const untouched = await read(page);
    await page.locator('#sound-button').click();
    await sleep(100);
    R.check(cleared(await read(page)) && (await read(page)).pilot.x === untouched.pilot.x, 'Tapping Sound changes no steering input');

    pointer = await makePointer(page, ctx, size.touch);
    const origin = { x: size.width * .44, y: size.height * .43 };
    const destination = { x: origin.x + 48, y: origin.y + 28 };
    await pointer.down(origin);
    await pointer.move(destination);
    await until(page, () => {
      const s = window.__warpFixture.read(); return s.pilot.x > .035 && s.pilot.y > .015;
    }, null, 2000);
    R.check((await read(page)).target.x > 0 && (await read(page)).target.y > 0, 'Dragging on the scene steers right and down');
    await pointer.up();
    await until(page, () => {
      const s = window.__warpFixture.read(); return Math.hypot(s.target.x-s.pilot.x,s.target.y-s.pilot.y) < 1e-6;
    }, null, 1500);
    R.check(cleared(await read(page)), 'Releasing the pointer clears held steering');
    const released = await read(page);
    if (!size.touch) await pointer.move({ x: origin.x - 40, y: origin.y - 20 });
    await sleep(100);
    R.check((await read(page)).pilot.x === released.pilot.x, 'The ship stays still after pointer release');

    await pointer.down(origin);
    await pointer.move({ x: origin.x - 45, y: origin.y - 25 });
    await pointer.cancel();
    await until(page, () => {
      const s = window.__warpFixture.read(); return Math.hypot(s.target.x-s.pilot.x,s.target.y-s.pilot.y) < 1e-6;
    }, null, 1500);
    R.check(cleared(await read(page)), 'Pointer cancellation clears steering');

    await page.locator('#view').focus();
    for (const [key, axis, direction] of [['d', 'x', 1], ['a', 'x', -1], ['w', 'y', -1], ['s', 'y', 1]]) {
      const before = await read(page);
      await page.keyboard.down(key);
      await until(page, ({ axis, direction, value }) => (window.__warpFixture.read().pilot[axis] - value) * direction > .07,
        { axis, direction, value: before.pilot[axis] }, 2000);
      await page.keyboard.up(key);
      R.check(cleared(await read(page)), `${key.toUpperCase()} steers in its direction and release stops the input`);
    }
    await page.keyboard.press('z'); await page.keyboard.press('x');
    R.check(await page.locator('.flipper-button.held').count() === 0, 'Flipper keys remain inactive during warp');

    await page.keyboard.down('d');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await read(page);
    await page.keyboard.press('w');
    await sleep(180);
    const still = await read(page);
    R.check(cleared(still) && still.progress === paused.progress && still.pilot.x === paused.pilot.x && still.pilot.y === paused.pilot.y && still.score === paused.score,
      'Pause clears input and freezes travel, ship position and points');
    R.check(await page.locator('#transit-panel').isHidden(), 'The pause panel replaces the warp controls');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    await page.keyboard.down('d'); // Auto-repeat from the key still physically held.
    await sleep(100);
    R.check((await read(page)).pilot.x === paused.pilot.x && cleared(await read(page)), 'A held key repeating after Resume cannot restart steering');
    await page.keyboard.up('d');

    await page.keyboard.down('a');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('a');
    await page.locator('#pause-panel').waitFor({ state: 'visible' });
    R.check(cleared(await read(page)), 'Window focus loss clears steering and pauses travel');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    await page.keyboard.down('s');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      try { document.dispatchEvent(new Event('visibilitychange')); }
      finally { delete document.hidden; }
    });
    await page.keyboard.up('s');
    await page.locator('#pause-panel').waitFor({ state: 'visible' });
    R.check(cleared(await read(page)), 'Hiding the page clears steering and pauses travel');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();

    await pointer.down(origin);
    await pointer.move(destination);
    await page.setViewportSize({ width: size.width + 10, height: size.height });
    await until(page, () => {
      const s = window.__warpFixture.read(); return Math.hypot(s.target.x-s.pilot.x,s.target.y-s.pilot.y) < 1e-6;
    }, null, 1500);
    await pointer.up();
    R.check(cleared(await read(page)), 'Resizing the viewport clears an active drag');
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.locator('#view').focus();
    await page.keyboard.down('d');
    await page.setViewportSize({ width: size.width + 10, height: size.height });
    await sleep(80);
    const resized = await read(page);
    await page.keyboard.down('d'); // The browser repeats the same held key.
    await sleep(100);
    R.check(cleared(await read(page)) && (await read(page)).pilot.x === resized.pilot.x, 'A held key repeating after resize cannot restart steering');
    await page.keyboard.up('d');
    await page.setViewportSize({ width: size.width, height: size.height });
    R.check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The warp UI fits without horizontal overflow');
    await shot(page, `tilt-warp-${size.name}-controls`);
    await page.keyboard.down('z'); await page.keyboard.down('x');
    await page.locator('#skip-transit').click();
    const final = await arrive(page);
    R.check(final.hits === 0 && final.score === 250 && final.charges === 1, 'Skipping before a crossing gives no unearned points or charge');
    await page.keyboard.down('z'); await page.keyboard.down('x');
    R.check(await page.locator('.flipper-button.held').count() === 0, 'Flipper keys held through Skip cannot activate on repeat after arrival');
    await page.keyboard.up('z'); await page.keyboard.up('x');
    await page.keyboard.down('z');
    R.check(await page.locator('#left-flip').evaluate(el => el.classList.contains('held')), 'A fresh flipper press works after arrival');
    await page.keyboard.up('z');
  } catch (error) {
    await shot(page, `tilt-warp-${size.name}-input-failure`);
    R.check(false, error.stack || error.message);
  } finally {
    if (pointer) await pointer.close();
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors');
    await close();
  }
}

for (const size of sizes) {
  R.section(`${size.name}: ring collection and arrival reward`);
  const { page, ctx, errors, close } = await open('tilt/', size);
  let pointer;
  try {
    const full = size.name === 'phone-landscape', skip = size.name === 'phone-portrait';
    await installFixture(page, { aligned: true, charges: full ? 3 : 1 });
    pointer = await makePointer(page, ctx, size.touch);
    const origin = { x: size.width * .40, y: size.height * .43 };
    const scale = Math.max(200, Math.min(size.width, size.height)) / 2.1;
    await pointer.down(origin);
    await pointer.move({ x: origin.x + .55 * scale, y: origin.y + .20 * scale });
    await until(page, () => window.__warpFixture.read().hits >= 2, null, 8500);
    R.check(await page.locator('#warp-readout').getAttribute('data-complete') === 'true' &&
      (await page.locator('#warp-help').textContent()).includes(full ? 'fields full' : 'charge earned'),
      full ? 'The reward readout explains that field capacity is full' : 'Passing two rings shows the earned gravity charge');
    R.check((await read(page)).score === 550, 'Each of the first two rings awards 150 points');
    if (!skip) await shot(page, `tilt-warp-${size.name}-rings`);
    await pointer.up();
    if (skip) await page.keyboard.press('e');
    const final = await arrive(page), expected = skip ? 2 : 3;
    R.check(final.hits === expected && final.points === expected * 150 && final.score === 250 + expected * 150,
      skip ? 'Skipping preserves the collected rings and leaves the future ring uncollected' : 'All three rings award points exactly once');
    R.check(final.charges === (full ? 3 : 2) && final.bonuses.length === 1 && final.bonuses[0].amount === (full ? 0 : 1),
      full ? 'Arrival respects the three-charge capacity' : 'Arrival awards one charge for two or more rings');
    R.check((await page.locator('#message').textContent()).includes(full ? 'field charges full' : 'Warp reward'), 'Arrival visibly announces the warp result');
    R.check(new Set(final.ringEvents.map(e => e.id)).size === expected && final.ringEvents.length === expected,
      'Every passed ring emits a single result');
    await sleep(150);
    R.check((await read(page)).score === final.score && (await read(page)).charges === final.charges, 'Rewards remain unchanged after arrival');
  } catch (error) {
    await shot(page, `tilt-warp-${size.name}-collection-failure`);
    R.check(false, error.stack || error.message);
  } finally {
    if (pointer) await pointer.close();
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors');
    await close();
  }
}

for (const reduced of [false, true]) {
  R.section(reduced ? 'Reduced motion: calm travel and accessible reward' : 'Default flight: safe arrival with no steering');
  const { page, errors, close } = await open('tilt/', DESK);
  try {
    await installFixture(page, { reduced });
    R.check((await page.locator('#warp-readout').isHidden()) === reduced, 'The speed challenge follows the reduced-motion preference');
    if (reduced) {
      await page.keyboard.press('d');
      R.check(cleared(await read(page)) && !(await read(page)).enabled, 'Reduced motion ignores warp steering');
    }
    const final = await arrive(page);
    R.check(final.hits === 0 && final.score === 250 && final.charges === (reduced ? 2 : 1),
      reduced ? 'The calm fade awards its charge without requiring a speed challenge' : 'An untouched flight arrives safely without a reward or penalty');
    R.check(final.bonuses.length === (reduced ? 1 : 0), 'The arrival reward is emitted at most once');
    if (reduced) R.check(final.ringEvents.length === 0, 'Reduced motion runs no ring crossing challenge');
    else R.check(final.ringEvents.length === 3 && final.rings.every(r => r.status === 'miss'), 'Uncollected rings pass safely without changing the voyage');
  } catch (error) {
    R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors');
    await close();
  }
}
R.done();
