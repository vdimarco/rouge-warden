// Reverse-flip interaction regression. The served adventure module is intercepted
// only by this test to supply a stationary ball just below a chosen flipper.
// After the first scoop, the unchanged game physics runs normally. The fixture
// observes its result; it adds no debug hooks or state mutations to production.
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.reverse.e2e');
const held = page => page.locator('.flipper-button.held').count();
const read = page => page.evaluate(() => window.__reverseFixture.read());
const center = async locator => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Flipper control is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function installFixture(page, side) {
  await page.route('**/tilt/adventure.js', async route => {
    const response = await route.fetch();
    const original = await response.text();
    if (!original.includes('export function createAdventure(') || !original.includes('export function updateAdventure(')) {
      throw new Error('Adventure fixture needs the public create/update exports');
    }
    const body = original
      .replace('export function createAdventure(', 'function fixtureCreateAdventure(')
      .replace('export function updateAdventure(', 'function fixtureUpdateAdventure(') + `
// Browser-test-only initial-state fixture. This response is never saved to the game.
export function createAdventure() {
  const run = fixtureCreateAdventure(43), sector = currentSector(run);
  const side = ${side}, f = run.world.flippers.find(f => f.sector === 0 && f.side === side);
  Object.assign(run.world.ball, { live: true, lane: false, x: sector.x + side * 75,
    y: sector.y + 65, vx: 0, vy: -280 });
  run.phase = 'play'; run.saveUntil = 0;
  const fixture = { run, started: false, count: 0, maxFx: 0,
    maxY: run.world.ball.y, maxVy: run.world.ball.vy,
    read: () => ({ started: fixture.started, count: fixture.count, maxFx: fixture.maxFx,
      maxY: fixture.maxY, maxVy: fixture.maxVy, pivotY: f.py,
      x: run.world.ball.x, y: run.world.ball.y, lives: run.lives,
      held: f.held, reverseUntil: f.reverseUntil }) };
  window.__reverseFixture = fixture;
  return run;
}
export function updateAdventure(run, dt) {
  const fixture = window.__reverseFixture;
  if (fixture?.run !== run) return fixtureUpdateAdventure(run, dt);
  const f = run.world.flippers.find(f => f.sector === 0 && f.side === ${side});
  fixture.maxFx = Math.max(fixture.maxFx, f.reverseFx || 0);
  if (f.reverseFx > 0) fixture.started = true;
  if (!fixture.started) { run.events.length = 0; return; }
  fixtureUpdateAdventure(run, dt);
  fixture.count += run.events.filter(e => e.type === 'reverse').length;
  fixture.maxY = Math.max(fixture.maxY, run.world.ball.y);
  fixture.maxVy = Math.max(fixture.maxVy, run.world.ball.vy);
}
`;
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
  await page.reload();
}

for (const size of [
  { name: 'desktop', ...DESK },
  { name: 'phone-portrait', ...PHONE },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
]) {
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'left' : 'right', key = side < 0 ? 'z' : 'x';
    R.section(`${size.name}: ${name} reverse scoop`);
    const { page, ctx, errors, close } = await open('tilt/', size);
    let cdp;
    try {
      await installFixture(page, side);
      R.check(/Full Tilt/.test(await page.title()) && /\/lab\/tilt\/$/.test(page.url()), 'The Full Tilt page loads');
      await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
      const button = page.locator(`#${name}-flip`);
      await until(page, id => document.getElementById(id).classList.contains('scoop-ready'), `${name}-flip`);
      R.check((await button.locator('.flip-label').textContent()) === 'REVERSE FLIP', 'The matching button shows the available reverse flip');
      R.check(!await page.locator(`#${side < 0 ? 'right' : 'left'}-flip`).evaluate(el => el.classList.contains('scoop-ready')), 'The distant flipper does not offer a rescue');
      R.check(await button.evaluate(el => {
        const b = el.getBoundingClientRect();
        return b.width >= 44 && b.height >= 44 && b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1;
      }), 'The reverse control fits on screen with a usable touch area');
      await shot(page, `tilt-reverse-${size.name}-${name}-ready`);

      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await until(page, id => document.getElementById(id).disabled, `${name}-flip`);
      const paused = await read(page);
      await page.keyboard.press(key);
      await sleep(100);
      const afterPause = await read(page);
      R.check(afterPause.count === 0 && !afterPause.started && afterPause.x === paused.x && afterPause.y === paused.y && await held(page) === 0,
        'Pause blocks a reverse keypress and keeps the ball still');
      await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
      await until(page, id => !document.getElementById(id).disabled, `${name}-flip`);

      let down, up;
      if (size.touch) {
        cdp = await ctx.newCDPSession(page);
        const point = await center(button);
        down = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1, radiusX: 3, radiusY: 3, force: 1 }] });
        up = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.locator('#view').focus();
        down = () => page.keyboard.down(key);
        up = () => page.keyboard.up(key);
      }
      await down();
      await until(page, () => window.__reverseFixture.read().count === 1, null, 2000);
      R.check(await page.locator('#message').textContent() === 'Reverse flip', 'The scoop gives a visible confirmation');
      const first = await read(page);
      R.check(first.maxFx > 0 && first.held && await held(page) === 1, 'The real press starts the reverse visual and holds its flipper');
      await until(page, () => {
        const s = window.__reverseFixture.read();
        return s.maxY > s.pivotY + 30 && s.maxVy > 500;
      }, null, 3000);
      R.check((await read(page)).lives === 3, 'The scoop carries the ball upward past the blades without losing a life');
      if (!size.touch) await down(); // Browser auto-repeat while the key remains held.
      await sleep(900); // Exceeds the scoop cooldown while the same input remains down.
      const continued = await read(page);
      R.check(continued.count === 1 && continued.reverseUntil === first.reverseUntil,
        'Holding the control does not repeat the rescue or refresh its cooldown');
      await up();
      // CDP acknowledges dispatch before the browser finishes its pointerup task.
      await until(page, () => !window.__reverseFixture.read().held && !document.querySelector('.flipper-button.held'), null, 1000);
      R.check(!((await read(page)).held) && await held(page) === 0, 'Release restores the normal unheld flipper');
      R.check(await page.locator('#pause-panel').isHidden() && await page.locator('#field-placement').isHidden(), 'The rescue stays in ordinary play');
      R.check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The controls create no horizontal overflow');
    } catch (error) {
      await shot(page, `tilt-reverse-${size.name}-${name}-failure`);
      R.check(false, error.stack || error.message);
    } finally {
      if (cdp) await cdp.detach();
      for (const error of errors) R.check(false, error);
      R.check(errors.length === 0, 'No application console or page errors');
      await close();
    }
  }
}
R.done();
