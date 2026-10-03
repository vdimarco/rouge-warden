// Public UI smoke test for Full Tilt's celestial voyage.
// Serve public/ or set LAB_URL to a deployed /lab/ URL, then run node qa/lab/tilt.e2e.mjs.
// Requires Playwright Chromium. SHOTS=<folder> saves optional screenshots.
// Physics and camera contracts live in separate pure Node tests. This file uses no hidden game state.
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.e2e');
const held = (page, id) => page.locator('#' + id).evaluate(el => el.classList.contains('held'));
const charge = page => page.locator('#launch-button').evaluate(el => Number(el.style.getPropertyValue('--charge')) || 0);
const center = async locator => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Control is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
async function start(page) {
  await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
  await until(page, () => document.querySelector('#menu').hidden && !document.querySelector('#hud').hidden);
  await page.locator('#launch-button').waitFor({ state: 'visible' });
}
async function controlsFit(page) {
  return page.locator('#controls button:visible').evaluateAll(buttons => buttons.every(button => {
    const box = button.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1;
  }));
}

R.section('Phone input, launch safety, and landscape');
{
  const { page, ctx, errors, close } = await open('tilt/', PHONE);
  try {
    await page.getByRole('button', { name: 'Start voyage', exact: true }).waitFor();
    await shot(page, 'tilt-voyage-phone-menu');
    await start(page);
    R.check((await page.locator('#sector-name').textContent()).includes('Lunar Harbor'), 'A new voyage starts at Lunar Harbor');
    R.check(await controlsFit(page), 'Portrait controls fit the screen and have usable touch targets');

    // CDP supplies real browser touch contacts, including pointer capture and cancellation.
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, points = []) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((p, id) => ({ ...p, id, radiusX: 3, radiusY: 3, force: 1 })),
    });
    const left = await center(page.getByRole('button', { name: 'Left flipper', exact: true }));
    const right = await center(page.getByRole('button', { name: 'Right flipper', exact: true }));
    await touch('touchStart', [left, right]);
    R.check(await held(page, 'left-flip') && await held(page, 'right-flip'), 'Two thumbs hold both flippers');
    await touch('touchCancel');
    R.check(!await held(page, 'left-flip') && !await held(page, 'right-flip'), 'A cancelled gesture releases both flippers');

    const launcher = await center(page.locator('#launch-button'));
    await touch('touchStart', [launcher]);
    await sleep(360);
    R.check(await charge(page) > 0.15, 'Holding Launch fills its visible charge bar');
    await touch('touchCancel');
    R.check(await page.locator('#launch-button').isVisible() && await charge(page) === 0,
      'A cancelled launch clears its bar and leaves the ball at the dock');

    // Only the input that began the charge may release it.
    await page.locator('#view').focus();
    await page.keyboard.down('Space');
    await sleep(100);
    await touch('touchStart', [launcher]);
    await touch('touchEnd');
    R.check(await page.locator('#launch-button').isVisible() && await charge(page) > 0,
      'A second input cannot release an existing keyboard charge');
    await page.keyboard.up('Space');
    await page.locator('#pulse-button').waitFor({ state: 'visible' });
    R.check(!await page.locator('#launch-button').isVisible(), 'Releasing the charge owner launches the ball');

    await page.locator('#pulse-button').click();
    R.check(await page.locator('#pulse-button').isDisabled(), 'A gravity pulse starts its cooldown');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const frozenScore = await page.locator('#score').textContent();
    await sleep(300);
    R.check(await page.locator('#pause-panel').isVisible() && await page.locator('#score').textContent() === frozenScore,
      'Pause holds the voyage and its score');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();

    await page.getByRole('button', { name: 'Map', exact: true }).click();
    R.check(await page.locator('#route-list > li').count() === 6, 'The route map lists all six sectors');
    R.check(await page.locator('#route-list .current').count() === 1, 'The route map marks one current sector');
    await page.getByRole('button', { name: 'Close map', exact: true }).click();
    R.check(!await page.locator('#map-panel').isVisible(), 'Closing the route map returns to play');

    // Restart supplies a stable dock for rotation and charge-cancellation checks.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Start a new voyage', exact: true }).click();
    await touch('touchStart', [await center(page.locator('#launch-button'))]);
    await sleep(180);
    await page.setViewportSize({ width: 844, height: 390 });
    await touch('touchCancel');
    R.check(await page.locator('#launch-button').isVisible() && await charge(page) === 0,
      'Rotation cancels a held launch without firing');
    R.check(await controlsFit(page), 'Landscape controls stay inside the screen');
    const bounds = await page.locator('#view').boundingBox();
    R.check(Math.abs(bounds.width - 844) < 1 && Math.abs(bounds.height - 390) < 1, 'The landscape canvas fills the viewport');
    await shot(page, 'tilt-voyage-phone-landscape');

    const sound = page.locator('#sound-button');
    const before = await sound.getAttribute('aria-pressed');
    await sound.click();
    R.check(await sound.getAttribute('aria-pressed') !== before, 'Sound toggle exposes its state');
    await sound.click();
    await cdp.detach();
  } catch (error) { R.check(false, error.stack || error.message); }
  finally { for (const error of errors) R.check(false, error); await close(); }
}

R.section('Desktop keys, pause, and restart');
{
  const { page, errors, close } = await open('tilt/', DESK);
  try {
    await start(page);
    await page.keyboard.down('z');
    await page.keyboard.down('x');
    R.check(await held(page, 'left-flip') && await held(page, 'right-flip'), 'Z and X hold both flippers');
    await page.keyboard.up('x');
    R.check(await held(page, 'left-flip') && !await held(page, 'right-flip'), 'Releasing one key leaves the other flipper held');
    await page.keyboard.up('z');
    for (const key of ['ArrowLeft', 'ArrowRight', '/', 'ShiftRight', 'm', 'Enter']) {
      await page.keyboard.down(key);
      R.check(!await held(page, 'left-flip') && !await held(page, 'right-flip') &&
        await page.locator('#map-panel').isHidden() && await charge(page) === 0,
        key + ' has no game shortcut on the focused canvas');
      await page.keyboard.up(key);
    }

    await page.keyboard.down('z');
    await page.keyboard.down('Space');
    await sleep(180);
    await page.keyboard.down('Escape');
    await page.keyboard.down('Escape'); // A repeated keydown must not resume the voyage.
    await page.keyboard.up('Escape');
    R.check(await page.locator('#pause-panel').isVisible(), 'Holding Escape leaves the game paused');
    R.check(!await held(page, 'left-flip') && !await held(page, 'right-flip') && await charge(page) === 0,
      'Pause releases flippers and cancels a charged launch');
    await page.keyboard.up('Space');
    await page.keyboard.up('z');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    R.check(await page.locator('#launch-button').isVisible(), 'A release during pause cannot launch the ball');

    await page.keyboard.down('z');
    await page.keyboard.press('r');
    R.check(await page.locator('#map-panel').isVisible() && !await held(page, 'left-flip'),
      'Opening the map releases a held flipper');
    await page.keyboard.up('z');
    await page.keyboard.press('r');
    R.check(await page.locator('#map-panel').isHidden(), 'R closes the map and returns to play');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Start a new voyage', exact: true }).click();
    R.check(await page.getByRole('button', { name: 'Pause', exact: true }).isVisible() && await page.locator('#score').textContent() === '0',
      'Restart resets the score and restores the Pause label');

    await page.keyboard.down('Space');
    await sleep(350);
    await page.keyboard.up('Space');
    await page.locator('#pulse-button').waitFor({ state: 'visible' });
    R.check(!await page.locator('#launch-button').isVisible(), 'Space launches from the keyboard');
    await page.keyboard.press('ArrowUp');
    R.check(await page.locator('#pulse-button').isEnabled(), 'Arrow Up leaves the pulse available');
    await page.keyboard.down('x');
    R.check(await held(page, 'right-flip') && await page.locator('#pulse-button').isEnabled(),
      'X holds the right flipper in flight without spending a pulse');
    await page.keyboard.up('x');
    await page.keyboard.press('c');
    R.check(await page.locator('#pulse-button').isDisabled() && /^Pulse [0-9]/.test(await page.locator('#pulse-button').textContent()),
      'C fires a gravity pulse and starts its visible cooldown');
    await shot(page, 'tilt-voyage-desktop-flight');
  } catch (error) { R.check(false, error.stack || error.message); }
  finally { for (const error of errors) R.check(false, error); await close(); }
}
R.done();
