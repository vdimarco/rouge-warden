// Shore of the Ancients on a desktop: the mouse pushes the following camera, the mouse may leave the window, Esc and
// the top-left Menu button open the menu, the speaker button shows and changes the sound, an ultra-wide screen stays
// inside the pixel budget, and the match is audible at the output.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--autoplay-policy=user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const graphics = page => page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
async function match(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Tap the output: every connection to the speakers also feeds an analyser.
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect; window.__outputs = [];
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) { const c = this.context; if (!c.__meter) { c.__meter = c.createAnalyser(); c.__meter.fftSize = 2048; window.__outputs.push(c); } connect.call(this, c.__meter); }
      return connect.call(this, dest, ...rest);
    };
    window.__rms = () => Math.max(0, ...window.__outputs.map(c => { const d = new Float32Array(2048); c.__meter.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); }));
  });
  await page.goto(URL);
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 60000 });
  await page.click('#play');
  for (let i = 0; i < 80 && !(await page.locator('#hud').isVisible()); i++) { await page.locator('#draft-go').click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); }
  await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 30000 });
  if (await page.locator('#sheet').evaluate(d => d.open)) await page.keyboard.press('Escape');
  return { page, errors };
}
try {
  const { page, errors } = await match(1440, 900);
  // Menu button: labelled, in the top left, with its key.
  const menu = await page.locator('#pause').boundingBox();
  assert(menu && menu.x < 40 && menu.y < 40 && menu.width >= 80, 'the Menu button sits in the top left: ' + JSON.stringify(menu));
  assert.match(await page.locator('#pause').innerText(), /Menu\s*Esc/i);
  console.log('PASS the top-left Menu button reads Menu and Esc');

  // Mouse push: the view moves toward the pointer and keeps following the hero.
  // The push eases in over frames, and a software browser draws few frames, so wait for it to settle.
  const settle = async (x, ok) => { await page.mouse.move(x, 450); let g; for (let i = 0; i < 60; i++) { await page.waitForTimeout(400); g = (await graphics(page)).graphics; if (ok(g.push)) break; } return g; };
  const centre = await settle(720, p => Math.abs(p) < 40);
  const right = await settle(1435, p => p > 400);
  const left = await settle(5, p => p < -400);
  assert(Math.abs(centre.push) < 40, 'a centred mouse leaves the view on the hero: ' + centre.push);
  assert(right.push > 400 && left.push < -400, `the mouse pushes the view right and left: ${right.push} ${left.push}`);
  assert.equal(await page.locator('#recenter').isHidden(), true, 'the push does not detach the camera');
  console.log('PASS the mouse pushes the following view', JSON.stringify({ right: Math.round(right.push), left: Math.round(left.push) }));

  // The mouse leaves the window: the match keeps running and the push holds.
  const before = (await graphics(page)).time;
  await page.mouse.move(-50, 450);
  await page.evaluate(() => { window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })); document.documentElement.dispatchEvent(new MouseEvent('mouseleave')); });
  await page.waitForTimeout(1500);
  const outside = await graphics(page);
  assert(!outside.paused && outside.time > before + .1, 'the clock runs with the mouse outside: ' + JSON.stringify({ before, after: outside.time, paused: outside.paused }));
  assert(outside.graphics.push < -200, 'the push holds while the mouse is outside');
  assert.equal(await page.locator('#auto-pause').isHidden(), true);
  console.log('PASS leaving the window with the mouse does not pause');

  // Esc opens the menu and closes it; so does the button.
  await page.mouse.move(720, 450);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  assert.equal((await graphics(page)).paused, true, 'Esc pauses and the same key does not close the menu again'); assert(await page.locator('#resume').isVisible(), 'Esc shows the menu');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  assert.equal((await graphics(page)).paused, false, 'Esc closes the menu');
  await page.click('#pause'); await page.waitForTimeout(200);
  assert(await page.locator('#resume').isVisible(), 'the Menu button shows the menu');
  await page.click('#resume'); await page.waitForTimeout(200);
  console.log('PASS Esc and the Menu button open and close the menu');

  // Sound: audible at the output, and the speaker button shows and changes it.
  let rms = 0; for (let i = 0; i < 8 && rms < .01; i++) { await page.waitForTimeout(700); rms = await page.evaluate(() => window.__rms()); }
  assert(rms > .01, 'the match is audible: rms ' + rms);
  assert.equal(await page.locator('#hud-sound').getAttribute('aria-pressed'), 'true');
  await page.click('#hud-sound'); await page.waitForTimeout(150);
  assert.equal(await page.locator('#hud-sound').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => localStorage.getItem('tidebreak.sound')), 'off');
  await page.click('#hud-sound');
  assert.equal(await page.locator('#hud-sound').getAttribute('aria-pressed'), 'true');
  console.log('PASS the match is audible and the speaker button toggles sound', JSON.stringify({ rms: +rms.toFixed(3) }));
  assert.deepEqual(errors, []);
  await page.close();

  // Ultra-wide: the backing store stays inside the pixel budget.
  const wide = await match(3440, 1440);
  // A slow machine (like a software-GL test browser) also steps the quality down; a fast one keeps it at 1.
  await wide.page.waitForTimeout(6000);
  const g = (await graphics(wide.page)).graphics, size = await wide.page.evaluate(() => { const c = document.getElementById('battle'); return c.width * c.height; });
  assert(size <= 2560 * 1440 * 1.01, 'an ultra-wide canvas stays inside the pixel budget: ' + size);
  console.log('PASS an ultra-wide screen draws at most 2560x1440 backing pixels', JSON.stringify({ pixelRatio: +g.pixelRatio.toFixed(2), quality: +(g.quality ?? 1).toFixed(2), pixels: size }));
  assert.deepEqual(wide.errors, []);
} finally { await browser.close(); }
