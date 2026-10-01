// Public UI checks with a virtual orientation sensor. No hidden game state is read or changed.
// Browser plugin unavailable; this uses the existing Playwright Chromium CI setup.
// Flow: Full Tilt menu -> opt in -> play -> pause/recenter -> resume or switch off.
import { open, until, shot, sleep, report, PHONE } from './lib.mjs';

const R = report('tilt.motion.e2e');
const state = (page, id = 'motion-button') => page.locator('#' + id).getAttribute('data-state');
const waitState = (page, expected, id = 'motion-button', timeout = 5000) =>
  until(page, ({ expected, id }) => document.getElementById(id)?.dataset.state === expected, { expected, id }, timeout);
const start = async page => {
  await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
  await page.locator('#launch-button').waitFor({ state: 'visible' });
};
const launch = async page => {
  await page.locator('#launch-button').click();
  await page.locator('#pulse-button').waitFor({ state: 'visible' });
};
const fits = async locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
});

// The fixture only supplies the browser sensor and permission boundary. Application controls
// are exercised by real Playwright clicks; the game owns calibration, state and physics.
function installSensor() {
  const P = window.__tiltPhone = { beta: 45, gamma: -5, angle: 0, stream: true, requests: 0, allowed: true };
  const Orientation = window.DeviceOrientationEvent;
  Object.defineProperty(Orientation, 'requestPermission', { configurable: true, value: async () => {
    P.requests++;
    return P.allowed ? 'granted' : 'denied';
  } });
  Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => P.angle });
  P.rotate = angle => {
    P.angle = angle;
    screen.orientation.dispatchEvent(new Event('change'));
    window.dispatchEvent(new Event('orientationchange'));
  };
  setInterval(() => {
    if (P.stream) window.dispatchEvent(new Orientation('deviceorientation', { beta: P.beta, gamma: P.gamma, alpha: 0 }));
  }, 16);
}

async function run(name, init, test) {
  R.section(name);
  const { page, errors, close } = await open('tilt/', { ...PHONE, init });
  try {
    await page.locator('#motion-button').waitFor();
    R.check(/Full Tilt/.test(await page.title()) && await page.locator('#menu-title').isVisible(), 'The correct, nonblank game page renders');
    await test(page);
  } catch (error) {
    await shot(page, 'tilt-motion-failure');
    R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No app console or page errors');
    await close();
  }
}

await run('Opt-in, calibration and control recovery', installSensor, async page => {
  R.check(await state(page) === 'off' && await page.locator('#motion-button').getAttribute('aria-pressed') === 'false', 'Tilt starts off');
  R.check(await page.evaluate(() => __tiltPhone.requests === 0), 'Loading the game does not ask for motion access');
  R.check(await fits(page.locator('#motion-button')), 'The menu tilt button fits and has a usable touch area');
  await page.locator('#motion-button').click();
  await waitState(page, 'on');
  R.check(await page.evaluate(() => __tiltPhone.requests === 1), 'A deliberate tap requests motion access once');
  R.check(await page.locator('#motion-button').getAttribute('aria-pressed') === 'true', 'The enabled state is exposed accessibly');
  await shot(page, 'tilt-motion-phone-enabled');
  await start(page);
  await waitState(page, 'on');

  await page.evaluate(() => { __tiltPhone.gamma = 9; __tiltPhone.stream = false; });
  await waitState(page, 'calibrating');
  R.check((await page.locator('#motion-status').textContent()).includes('center'), 'Stale readings require a fresh center');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  R.check(await fits(page.locator('#pause-motion-button')) && await fits(page.locator('#recenter-motion-button')), 'Pause has reachable tilt and recenter controls');
  await page.getByRole('button', { name: 'Recenter tilt', exact: true }).click();
  R.check(await state(page, 'pause-motion-button') === 'calibrating', 'Recenter requests a new comfortable grip');
  await shot(page, 'tilt-motion-phone-recenter');
  await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
  await page.evaluate(() => { __tiltPhone.beta = 61; __tiltPhone.gamma = -12; __tiltPhone.stream = true; });
  await waitState(page, 'on');

  await page.evaluate(() => { __tiltPhone.stream = false; __tiltPhone.rotate(90); });
  await page.setViewportSize({ width: 844, height: 390 });
  await waitState(page, 'calibrating');
  R.check(await page.locator('#launch-button').isVisible(), 'Rotating recalibrates and keeps the ball at the dock');
  await page.evaluate(() => { __tiltPhone.beta = 10; __tiltPhone.gamma = 38; __tiltPhone.stream = true; });
  await waitState(page, 'on');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('#recenter-motion-button').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Recenter tilt', exact: true }).click();
  R.check(await fits(page.locator('#recenter-motion-button')), 'Landscape pause can scroll to the recenter control');
  await page.locator('#pause-motion-button').scrollIntoViewIfNeeded();
  await shot(page, 'tilt-motion-landscape-pause');
  R.check(await fits(page.locator('#pause-motion-button')), 'Tilt remains reachable in landscape pause');
  await page.locator('#pause-motion-button').click();
  R.check(await state(page, 'pause-motion-button') === 'off' && await page.locator('#recenter-motion-button').isHidden(), 'Switching off clears the active state and recenter control');
  await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
  await launch(page);
  R.check(await page.locator('#pulse-button').isVisible(), 'Touch launch still works after tilt is switched off');
});

await run('Permission denied keeps touch play available', () => {
  window.__permissionRequests = 0;
  Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => {
    window.__permissionRequests++;
    return 'denied';
  } });
}, async page => {
  await page.locator('#motion-button').click();
  await waitState(page, 'denied');
  R.check(await page.locator('#motion-button').getAttribute('aria-pressed') === 'false', 'Denied access never appears enabled');
  R.check((await page.locator('#motion-status').textContent()).includes('touch controls'), 'The denial message explains the playable fallback');
  await start(page);
  await launch(page);
  R.check(await page.evaluate(() => __permissionRequests === 1), 'Starting a voyage does not ask again after denial');
});

await run('No orientation API keeps touch play available', () => {
  Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, value: undefined });
}, async page => {
  await page.locator('#motion-button').click();
  await waitState(page, 'unavailable');
  R.check((await page.locator('#motion-status').textContent()).includes('Touch controls'), 'Missing hardware/API gets a clear fallback');
  await start(page);
  await launch(page);
  R.check(await page.locator('#pulse-button').isVisible(), 'The game stays playable without sensor support');
});

await run('Permission granted without readings does not stay active', () => {
  Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => 'granted' });
}, async page => {
  await page.locator('#motion-button').click();
  await waitState(page, 'unavailable', 'motion-button', 6500);
  R.check(await page.locator('#motion-button').getAttribute('aria-pressed') === 'false', 'A sensor that never responds becomes unavailable');
  await start(page);
  await launch(page);
  R.check(await page.locator('#pulse-button').isVisible(), 'Missing readings never block touch launch');
});

R.done();
