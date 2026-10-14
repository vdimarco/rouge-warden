// Verify page-media lifecycle against a real stream without moving or restarting the game.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const url = new URL(process.env.NORD_PLAYER_URL || 'http://127.0.0.1:8100/');
assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash);
const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
const output = resolve('.qa', 'media-' + new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(output, { recursive: true });
const report = { passed: false, playerUrl: url.href, checks: [], mp4Requests: [], errors: [],
  limits: ['Host-PC Chromium emulated touch, not a physical phone/carrier.', 'MP4 requests are observed and aborted; trailer audio/playback and bandwidth/FPS gains are not measured.'] };
const browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--disable-gpu'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('**/*.mp4', route => { report.mp4Requests.push(route.request().url()); return route.abort(); });
  await page.goto(url.href);
  await page.waitForFunction(() => document.body.dataset.state === 'idle');
  assert.equal(await page.locator('#trailer-video').getAttribute('src'), null);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.body.dataset.state === 'ready');
  assert.equal(await page.locator('#hero-video').getAttribute('src'), null);
  report.checks.push('title source released while waiting for real game playback');
  await page.locator('#play').click();
  await page.waitForFunction(() => document.body.dataset.state === 'playing' && document.querySelector('#video video')?.readyState > 2);
  const beforeRotation = report.mp4Requests.length;
  for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(tall => {
      const v = document.querySelector('#video video'); return v.videoWidth > 0 && (v.videoHeight > v.videoWidth) === tall;
    }, height > width);
    const time = await page.locator('#video video').evaluate(v => v.currentTime);
    await page.waitForFunction(t => document.querySelector('#video video').currentTime > t + .5, time);
    assert.equal(await page.locator('#hero-video').getAttribute('src'), null);
    assert.equal(await page.locator('#trailer-video').getAttribute('src'), null);
    await page.screenshot({ path: resolve(output, `${name}.png`) });
    report.checks.push(`${name}: advancing real video with both page videos unloaded`);
  }
  assert.equal(report.mp4Requests.length, beforeRotation, 'game rotation must not request title/trailer clips');
  assert.deepEqual(report.errors, []);
  report.checks.push('no new MP4 requests during real play/rotation; no page errors');
  report.passed = true;
} catch (e) { report.error = e.stack; throw e; }
finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, passed: report.passed, checks: report.checks.length }));
}
