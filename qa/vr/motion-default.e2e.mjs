import { newPage, open, close, enterXR, checker, watchdog, shot } from './lib.mjs';
const { check, done } = checker('motion default');
watchdog(600000, 'motion default');
try {
 for (const reducedMotion of ['no-preference', 'reduce']) {
  const page = await newPage({width:960,height:540});
  await page.emulateMedia({reducedMotion});
  await page.addInitScript(() => { window.AudioContext = window.webkitAudioContext = undefined; });
  await open(page, '?nosw&skipintro');
  await page.waitForFunction(() => G.viewDone);
  await enterXR(page, 'desktop');
  await page.waitForFunction(() => G.state === 'play');
  await page.evaluate(() => { G.renderer.setAnimationLoop(null); G.test.hold(true); G.test.step(1/60,2); G.ui.openPause(); });
  await page.locator('#fsMenu [data-id=comfort]').click();
  const expected = reducedMotion === 'reduce' ? 'calm' : 'full';
  check(await page.evaluate(() => G.settings.verse) === expected, `${reducedMotion}: default ${expected}`);
  check(await page.locator(`#fsMenu [data-id="verse:${expected}"]`).getAttribute('aria-pressed') === 'true', `${reducedMotion}: menu reflects default`);
  check(await page.evaluate(() => G.flatcam.bankOn === (G.settings.verse === 'full') && G.flatcam.shakeOn === (G.settings.verse === 'full')), `${reducedMotion}: camera follows selected motion mode`);
  await shot(page, `motion-${reducedMotion}`);
  await page.locator('#fsMenu [data-id="verse:full"]').click();
  await page.reload();
  await page.waitForFunction(() => window.G?.viewDone);
  check(await page.evaluate(() => G.settings.verse) === 'full', `${reducedMotion}: saved Full choice survives reload`);
  if (reducedMotion === 'reduce') {
   await page.evaluate(() => { G.settings.verse = 'off'; G.saveNow(); });
   await page.reload(); await page.waitForFunction(() => window.G?.viewDone);
   check(await page.evaluate(() => G.settings.verse) === 'off', 'saved Off choice survives reload');
   await page.evaluate(() => { delete G.settings.verse; G.saveNow(); });
   await page.reload(); await page.waitForFunction(() => window.G?.viewDone);
   check(await page.evaluate(() => G.settings.verse) === 'calm', 'legacy save without motion setting follows reduced preference');
  }
  check(page.errors.length === 0, `${reducedMotion}: no page errors`,page.errors);
  await page.context().close();
 }
} finally { await close(); }
done();
