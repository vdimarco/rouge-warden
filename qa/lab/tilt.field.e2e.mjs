// Public UI checks for earned gravity fields. The fixtures never read or change game state.
// Physics direction, inventory awards and the exact lifetime have a separate deterministic simulation.
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.field.e2e');
const active = page => page.locator('#field-status').getAttribute('data-active');
const held = page => page.locator('.flipper-button.held').count();
const inventory = page => page.locator('#field-button').textContent();
const fits = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
});
async function start(page) {
  await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
  await page.locator('#launch-button').waitFor({ state: 'visible' });
}
async function launch(page) {
  await page.locator('#launch-button').click();
  await page.locator('#field-button').waitFor({ state: 'visible' });
  await until(page, () => !document.getElementById('field-button').disabled);
}
async function arm(page) {
  await page.locator('#field-button').click();
  await page.locator('#field-placement').waitFor({ state: 'visible' });
}
async function freshFlight(page) {
  if (!await page.locator('#pause-panel').isVisible()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Start a new voyage', exact: true }).click();
  await watchFieldTransition(page);
  await launch(page);
}
async function touchController(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  return {
    send: (type, p = null) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: p ? [{ ...p, id: 1, radiusX: 3, radiusY: 3, force: 1 }] : [],
    }),
    close: () => cdp.detach(),
  };
}
async function watchFieldTransition(page) {
  // Keep the exact count when aim closes. Play can earn a later charge before
  // Playwright reads the page, so a delayed inventory read cannot prove a spend.
  await page.evaluate(() => {
    const button = document.getElementById('field-button');
    const message = document.getElementById('message');
    const count = text => /^Field (\d+)$/.exec(text)?.[1];
    const reward = text => /^Gravity charge gained · (\d+)\/\d+$/.exec(text)?.[1];
    // Rewards announce their new count immediately; button text updates at 10 Hz.
    // These watchers start in a fresh run, or after cancellation before any
    // deployment. A visible reward count has therefore never been reduced by a spend.
    let before = Math.max(Number(count(button.textContent)), Number(reward(message.textContent) || 0));
    let aiming = false;
    window.__fieldTransition = null;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const text = [...record.addedNodes].map(node => node.textContent).join('');
        if (record.target === message) {
          const value = reward(text);
          if (!aiming && value !== undefined) before = Number(value);
          continue;
        }
        if (text === 'Cancel') aiming = true;
        const value = count(text);
        if (value === undefined) continue;
        if (aiming) {
          window.__fieldTransition = { before, after: Number(value) };
          observer.disconnect();
          return;
        }
        before = Number(value);
      }
    });
    observer.observe(button, { childList: true });
    observer.observe(message, { childList: true });
  });
}
async function fieldChange(page) {
  await until(page, () => window.__fieldTransition !== null, null, 3000);
  return page.evaluate(() => window.__fieldTransition.after - window.__fieldTransition.before);
}
// The state after aim closes. A failed check names it, so a CI log shows which part failed.
async function closedAim(page) {
  const hidden = await page.locator('#field-placement').isHidden();
  const state = { hidden, change: await fieldChange(page).catch(() => 'none, aim did not close'), held: await held(page) };
  state.ok = state.hidden && state.change === 0 && state.held === 0;
  state.note = state.ok ? '' : ` (panel ${state.hidden ? 'closed' : 'open'}, charge change ${state.change}, held pads ${state.held}, counts ${JSON.stringify(await page.evaluate(() => window.__fieldTransition))})`;
  return state;
}

for (const size of [
  { name: 'phone-portrait', ...PHONE, kind: 'pull', method: 'touch' },
  { name: 'phone-landscape', width: 844, height: 390, touch: true, kind: 'push', method: 'button' },
  { name: 'desktop', ...DESK, kind: 'pull', method: 'keyboard' },
]) {
  R.section(size.name + ': aim, deploy and pause');
  const { page, ctx, errors, close } = await open('tilt/', size);
  try {
    await start(page);
    R.check(await inventory(page) === 'Field 1' && await page.locator('#field-button').isDisabled(), 'A fresh voyage carries one field and waits for launch');
    R.check(await fits(page.locator('#field-button')), 'The field control fits with a usable touch area');
    await watchFieldTransition(page);
    await launch(page);
    await page.keyboard.down('z');
    await arm(page);
    R.check(await held(page) === 0, 'Entering aim releases a held flipper');
    await page.keyboard.up('z');
    R.check(await page.locator('#field-button').getAttribute('aria-pressed') === 'true', 'The field control exposes its aiming state');
    for (const id of ['field-pull', 'field-push', 'deploy-field', 'cancel-field']) {
      R.check(await fits(page.locator('#' + id)), id + ' stays on screen and has a usable touch area');
    }
    R.check(await page.locator('#deploy-field').isEnabled(), 'The initial reticle offers a valid placement');
    const score = await page.locator('#score').textContent();
    await sleep(300);
    R.check(await page.locator('#score').textContent() === score, 'The score stays still while choosing a position');
    await page.locator('#field-push').click();
    R.check(await page.locator('#field-push').getAttribute('aria-pressed') === 'true' && await page.locator('#field-pull').getAttribute('aria-pressed') === 'false', 'Pull and Push expose the selected choice');
    await page.locator('#cancel-field').click();
    // Deliberately let play advance before reading: later relay rewards must not
    // change the retained cancellation boundary.
    await sleep(350);
    R.check(await page.locator('#field-placement').isHidden() && await fieldChange(page) === 0 && await active(page) === 'false', 'Cancel resumes flight without spending inventory, including after a delayed read');

    await watchFieldTransition(page);
    await arm(page);
    await page.locator('#field-' + size.kind).click();
    await shot(page, 'tilt-field-' + size.name + '-aim');
    if (size.method === 'touch') {
      const touch = await touchController(ctx, page);
      try {
        let point = { x: size.width * .4, y: size.height * .4 };
        await touch.send('touchStart', point);
        // Drag across visible open space until the public confirm control reports a valid target.
        for (const y of [.35, .45, .55, .6]) {
          if (await page.locator('#deploy-field').isEnabled()) break;
          for (const x of [.2, .4, .6, .8]) {
            point = { x: size.width * x, y: size.height * y };
            await touch.send('touchMove', point);
            if (await page.locator('#deploy-field').isEnabled()) break;
          }
        }
        R.check(await page.locator('#deploy-field').isEnabled(), 'Dragging can choose valid open space');
        R.check(await held(page) === 0, 'Dragging a field never presses a flipper');
        await touch.send('touchEnd');
      } finally { await touch.close(); }
    } else if (size.method === 'keyboard') {
      await page.locator('#view').focus();
      await page.keyboard.press('d');
      await page.keyboard.press('a');
      await page.keyboard.press('w');
      await page.keyboard.press('s');
      await page.keyboard.press('q');
      R.check(await page.locator('#field-push').getAttribute('aria-pressed') === 'true', 'Q switches the field from Pull to Push');
      await page.keyboard.press('q');
      R.check(await page.locator('#field-pull').getAttribute('aria-pressed') === 'true', 'Q switches the field back to Pull');
      await page.keyboard.press('e');
    } else await page.locator('#deploy-field').click();
    await until(page, () => document.getElementById('field-status').dataset.active === 'true', null, 3000);
    // Freeze at the observed active-field boundary. Capturing a screenshot first
    // can let a returning ball drain and clear the field before Pause is pressed.
    // Read each deployment assertion before the public Pause button changes it.
    const deployed = await page.evaluate(() => {
      const status = document.getElementById('field-status');
      const before = {
        active: status.dataset.active === 'true', text: status.textContent,
        aimHidden: document.getElementById('field-placement').hidden,
        held: document.querySelectorAll('.flipper-button.held').length,
        fieldDisabled: document.getElementById('field-button').disabled,
      };
      document.getElementById('pause-button').click();
      return before;
    });
    R.check(deployed.active && await page.locator('#pause-panel').isVisible(), 'Pause starts while the field is still active');
    R.check(deployed.aimHidden && deployed.held === 0, 'Deployment closes aim and leaves flippers released');
    R.check(await fieldChange(page) === -1, 'A successful placement spends exactly one charge before later rewards');
    R.check(deployed.fieldDisabled, 'An active field prevents a second deployment');
    R.check(new RegExp('^' + (size.kind === 'push' ? 'Push' : 'Pull') + ' field · [0-5]\\.\\ds$').test(deployed.text), 'The active kind and remaining time are visible');
    const frozen = await page.locator('#field-status').textContent();
    await shot(page, 'tilt-field-' + size.name + '-paused');
    await sleep(350);
    R.check(await active(page) === 'true' && await page.locator('#field-status').textContent() === frozen, 'Pause preserves the active field and its remaining time');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    await until(page, () => document.getElementById('field-status').dataset.active === 'false', null, 12000);
    R.check(/earn field charges/.test(await page.locator('#field-status').textContent()), 'Expiry or a checkpoint restores the inventory guidance');
    R.check(await page.locator('#field-placement').isHidden(), 'Field cleanup returns to ordinary play');
  } catch (error) {
    await shot(page, 'tilt-field-' + size.name + '-failure');
    R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No app console or page errors');
    await close();
  }
}

R.section('Invalid targets and input lifecycle');
{
  const { page, ctx, errors, close } = await open('tilt/', PHONE);
  try {
    await start(page); await watchFieldTransition(page); await launch(page);
    await page.keyboard.press('f');
    await page.locator('#field-placement').waitFor({ state: 'visible' });
    // The camera remains frozen while this public keyboard scan reaches a planet or sector edge.
    for (const key of ['w', 'a', 's', 'd']) {
      if (await page.locator('#deploy-field').isDisabled()) break;
      for (let i = 0; i < 32 && await page.locator('#deploy-field').isEnabled(); i++) await page.keyboard.press(key);
    }
    R.check(await page.locator('#deploy-field').isDisabled(), 'An invalid point disables the confirm control');
    R.check(/Choose open space/.test(await page.locator('#field-aim-help').textContent()), 'Invalid placement gives a visible instruction');
    await page.keyboard.press('e');
    R.check(await page.locator('#field-placement').isVisible() && await active(page) === 'false', 'E on an invalid point keeps aim open');
    R.check(await held(page) === 0, 'WASD aim never leaks into flipper controls');
    await page.keyboard.press('Escape');
    R.check(await page.locator('#field-placement').isHidden() && await page.locator('#pause-panel').isHidden() && await fieldChange(page) === 0, 'Escape cancels aim without a charge or an extra pause');

    await freshFlight(page); await arm(page);
    const touch = await touchController(ctx, page);
    try {
      await touch.send('touchStart', { x: PHONE.width * .3, y: PHONE.height * .4 });
      await touch.send('touchCancel');
    } finally { await touch.close(); }
    { const aim = await closedAim(page); R.check(aim.ok, 'A cancelled touch leaves the charge available and all controls released' + aim.note); }

    await freshFlight(page); await arm(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('#field-placement').waitFor({ state: 'hidden' });
    { const aim = await closedAim(page); R.check(aim.ok, 'Rotation cancels stale aim without spending a charge' + aim.note); }
    await watchFieldTransition(page); await arm(page);
    // Browser lifecycle event only; no application state or private game API is accessed.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    R.check(await page.locator('#field-placement').isHidden() && await page.locator('#pause-panel').isVisible() && await fieldChange(page) === 0, 'Losing focus cancels aim and pauses the voyage');
    await page.getByRole('button', { name: 'Resume voyage', exact: true }).click();
    await watchFieldTransition(page); await arm(page);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    R.check(await page.locator('#field-placement').isHidden() && await page.locator('#map-panel').isVisible() && await fieldChange(page) === 0, 'Opening the map cancels aim without spending inventory');
    await page.getByRole('button', { name: 'Close map', exact: true }).click();
  } catch (error) {
    await shot(page, 'tilt-field-lifecycle-failure');
    R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No app console or page errors');
    await close();
  }
}

R.done();
