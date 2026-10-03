// Natural player inputs reach a gate. Checks only public controls and renderer diagnostics.
// No private game state, seed override, teleport, or scoring mutation is used.
import { open, until, shot, sleep, report } from './lib.mjs';
const R = report('tilt.transit.e2e');
const progress = page => page.locator('#transit-progress').getAttribute('aria-valuenow');
const visibleField = page => page.locator('#view').getAttribute('data-visible-sector');
const fits = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
});
async function reachGate(page) {
  const started = Date.now();
  let attempts = 1;
  while (Date.now() - started < 90000) {
    if (await page.locator('#upgrade-panel').isVisible()) {
      await page.keyboard.up('z'); await page.keyboard.up('x');
      return;
    }
    if (await page.locator('#end-panel').isVisible()) {
      if (attempts++ >= 3) throw new Error('Three natural voyages exhausted their hearts before reaching a gate');
      await page.getByRole('button', { name: 'Fly again', exact: true }).click();
    }
    const launch = page.locator('#launch-button'), pulse = page.locator('#pulse-button');
    if (await launch.isVisible()) {
      await page.keyboard.up('z'); await page.keyboard.up('x');
      await launch.click();
    }
    // Read the same approach cues shown to the player. Fresh strikes matter now;
    // keeping both blades raised indefinitely no longer proves natural progress.
    const flips = await page.evaluate(() => ['left-flip', 'right-flip'].map((id, i) => {
      const button = document.getElementById(id);
      return !button.disabled && (button.classList.contains('scoop-ready') || button.querySelector('.flip-label').textContent === 'FLIP NOW') ? ['z', 'x'][i] : null;
    }).filter(Boolean));
    for (const key of flips) await page.keyboard.press(key, { delay: 65 });
    // A checkpoint can hide Pulse between observation and action. Its ordinary keyboard
    // shortcut safely follows the current phase instead of waiting for a vanished button.
    if (await pulse.isVisible() && await pulse.isEnabled()) await page.keyboard.press('c');
    await sleep(70);
  }
  throw new Error('Natural launch/timed-flip/Pulse route did not reach a gate in 90 seconds');
}
async function watchStages(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('view');
    window.__transitFrames = [];
    const observer = new MutationObserver(() => {
      const phase = canvas.dataset.transitPhase;
      if (phase && window.__transitFrames.at(-1)?.phase !== phase) {
        window.__transitFrames.push({ phase, field: canvas.dataset.visibleSector });
      }
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-transit-phase'] });
  });
}

for (const size of [
  { name: 'phone-portrait', width: 390, height: 844, touch: true, skip: false },
  { name: 'phone-landscape', width: 844, height: 390, touch: true, skip: true },
  { name: 'desktop-reduced', width: 1280, height: 800, touch: false, reduced: true, skip: false },
]) {
  R.section(size.name + ': first sector to distant world');
  const { page, errors, close } = await open('tilt/', size);
  try {
    if (size.reduced) { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); }
    R.check(/Full Tilt/.test(await page.title()), 'The page is the Full Tilt game');
    await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
    await until(page, () => document.querySelector('#view').dataset.visibleSector === '0');
    R.check(await visibleField(page) === '0', 'Only the current physical field is rendered');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await until(page, () => document.querySelector('#view').dataset.visibleSector === 'none');
    R.check(await page.locator('#route-list > li').count() === 6 && await visibleField(page) === 'none', 'The galaxy route preserves six destinations and hides every physical field');
    await shot(page, 'tilt-transit-' + size.name + '-map');
    await page.getByRole('button', { name: 'Close map', exact: true }).click();
    await reachGate(page);
    R.check(await page.locator('#upgrade-panel').isVisible()
      && (await page.locator('#upgrade-from').textContent()) === 'Lunar Harbor'
      && (await page.locator('#upgrade-to').textContent()) === 'Amber Belt'
      && (await page.locator('#upgrade-options button').count()) === 3,
    'Normal play reaches the first gate and offers three upgrades on the correct route');
    await watchStages(page);
    await page.keyboard.press('1');
    await page.locator('#transit-panel').waitFor({ state: 'visible' });
    await until(page, () => document.querySelector('#transit-title').textContent.includes('Amber Belt'));
    R.check((await page.locator('#transit-title').textContent()).includes('Amber Belt'), '1 selects the first upgrade and starts travel to the named destination');
    R.check(await fits(page.locator('#skip-transit')), 'Skip jump stays visible with a usable touch target');
    R.check(await page.locator('#controls').isHidden(), 'The cinematic hides ordinary gameplay controls');
    R.check(await page.locator('#pulse-button').isDisabled() && await page.locator('#field-button').isDisabled() &&
      await page.locator('#left-flip').isDisabled() && await page.locator('#right-flip').isDisabled() && await page.locator('#map-button').isDisabled(),
      'Gameplay and map controls are disabled during travel');
    await page.locator('#view').focus();
    await page.keyboard.press('z'); await page.keyboard.press('f'); await page.keyboard.press('r'); await page.keyboard.press('c');
    R.check(await page.locator('.flipper-button.held').count() === 0 && await page.locator('#field-placement').isHidden() && await page.locator('#map-panel').isHidden(),
      'Transit keys cannot hold flippers, arm a field or open the map');

    if (!size.reduced) {
      // Headless Chrome keeps tabs visible. Model its visibility notification on landscape;
      // portrait uses the normal blur event. Neither path reads or writes game state.
      if (size.skip) await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        try { document.dispatchEvent(new Event('visibilitychange')); }
        finally { delete document.hidden; }
      });
      else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.locator('#pause-panel').waitFor({ state: 'visible' });
      const frozen = await progress(page);
      await sleep(250);
      R.check(await progress(page) === frozen && await page.locator('#transit-panel').isHidden(),
        (size.skip ? 'Hidden-tab notification' : 'Focus loss') + ' pauses and hides travel without advancing progress');
      await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
      await until(page, () => Number(document.querySelector('#transit-progress').getAttribute('aria-valuenow')) >= 42);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await progress(page);
      await sleep(250);
      R.check(await progress(page) === paused, 'Pause freezes the cinematic timeline');
      await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
      await shot(page, 'tilt-transit-' + size.name + '-black-hole');
      R.check(await visibleField(page) === 'none', 'Black-hole travel conceals both source and destination fields');
    }
    if (size.skip) {
      await page.keyboard.press('e');
      await page.locator('#launch-button').waitFor({ state: 'visible' });
      R.check(await page.locator('#transit-panel').isHidden(), 'E skips travel and arrives at a playable dock');
    } else {
      await page.locator('#transit-panel').waitFor({ state: 'hidden', timeout: size.reduced ? 3000 : 12000 });
      await page.locator('#launch-button').waitFor({ state: 'visible' });
      R.check(await page.locator('#transit-panel').isHidden(), 'The voyage arrives automatically');
    }
    await until(page, () => document.querySelector('#view').dataset.visibleSector === '1');
    R.check((await page.locator('#sector-name').textContent()).includes('02 / 6 · Amber Belt'), 'Arrival unlocks exactly the second world');
    R.check(await visibleField(page) === '1' && await page.locator('#left-flip').isEnabled() && await page.locator('#map-button').isEnabled(),
      'Arrival shows only its new field and restores controls');
    await shot(page, 'tilt-transit-' + size.name + '-arrival');
    const stages = await page.evaluate(() => window.__transitFrames);
    if (size.reduced) {
      R.check(stages.some(s => s.phase === 'arrival') && stages.every(s => !['galaxy', 'horizon', 'tunnel'].includes(s.phase)),
        'Reduced motion uses a short fade without galaxy rotation or tunnel stages');
    } else if (!size.skip) {
      const phases = stages.map(s => s.phase);
      R.check(['departure', 'galaxy', 'horizon', 'tunnel', 'arrival'].every(s => phases.includes(s)), 'The full cinematic visits departure, galaxy, black hole, tunnel and arrival');
    }
    R.check(stages.filter(s => ['horizon', 'tunnel'].includes(s.phase)).every(s => s.field === 'none'), 'Every recorded deep-transit stage hides the levels');
    await sleep(200);
    R.check((await page.locator('#sector-name').textContent()).includes('Amber Belt') && await page.locator('#launch-button').isVisible(),
      'A finished jump stays at its destination without a second transition');
    R.check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Travel and arrival create no horizontal overflow');
  } catch (error) {
    await shot(page, 'tilt-transit-' + size.name + '-failure');
    R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors');
    await close();
  }
}
R.done();
