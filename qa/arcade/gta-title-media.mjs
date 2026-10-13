// Serve public/ (for example: cd public && python3 -m http.server 8765), then:
// node qa/arcade/gta-title-media.mjs
// Set GTA_TITLE_URL to test a deployed /gta/ page, and GTA_TITLE_QA_OUT for screenshots.
// Checks that the title page plays the NORD trailer inline, muted, on its own, and that
// it fits each layout. It never opens the streamed game.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Match the arcade QA suite's existing Playwright setup (`NODE_PATH=$(npm root -g)`
// or another installed node_modules directory); no test dependency is vendored here.
const { chromium } = createRequire(import.meta.url)('playwright');

const pageUrl = new URL(process.env.GTA_TITLE_URL || 'http://127.0.0.1:8765/gta/');
assert.match(pageUrl.pathname, /\/gta\/$/, 'GTA_TITLE_URL must end at the title page');
const output = path.resolve(process.env.GTA_TITLE_QA_OUT || '/tmp/nord-gta-title-media-qa');
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-gpu'],
});

async function open(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({
    viewport,
    reducedMotion,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
    ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  const response = await page.goto(pageUrl.href, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, 'title page HTTP status');
  return { context, page, errors };
}

async function checkViewport(viewport) {
  const { context, page, errors } = await open(viewport);
  const video = page.locator('#game-trailer');
  assert.equal(await video.count(), 1, 'one trailer player');
  const attrs = await video.evaluate(v => ({ muted: v.muted, loop: v.loop, inline: v.playsInline, controls: v.controls, src: v.currentSrc || v.src }));
  assert.ok(attrs.muted && attrs.loop && attrs.inline && attrs.controls, 'trailer is muted, looping, inline, with controls');
  assert.match(attrs.src, /^https:\/\/.+\.mp4$/, 'trailer source is an MP4 over HTTPS');
  // The trailer is H.264; some open-source Chromium builds cannot decode it, so check playback only where it can.
  if (await video.evaluate(v => v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '')) {
    await page.waitForFunction(() => {
      const v = document.querySelector('#game-trailer');
      return v && !v.paused && v.currentTime > 0.5;
    }, null, { timeout: 30000 });
  } else {
    console.log(`  skip ${viewport.width}x${viewport.height}: this browser has no H.264 decoder, so playback was not checked`);
  }
  assert.equal(await page.getByText('being captured', { exact: false }).count(), 0, 'no capture placeholder');
  assert.equal(await page.locator('a.play').getAttribute('href'), 'https://nord-montreal.vercel.app/', 'Play goes to live player');
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { selector, left: box.left, right: box.right, width: box.width };
    };
    return {
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      rects: ['h1', '.play', '.feature', '#game-trailer'].map(rect),
    };
  });
  assert.ok(layout.documentWidth <= viewport.width + 1 && layout.bodyWidth <= viewport.width + 1, 'no horizontal document overflow');
  for (const { selector, left, right, width } of layout.rects) {
    assert.ok(width > 0, `${selector} is visible`);
    assert.ok(left >= -1 && right <= viewport.width + 1, `${selector} fits viewport`);
  }
  await page.screenshot({ path: path.join(output, `gta-title-${viewport.width}x${viewport.height}.png`), fullPage: true });
  assert.deepEqual(errors, [], 'no page errors');
  await context.close();
}

for (const viewport of viewports) {
  await checkViewport(viewport);
  console.log(`  ok   ${viewport.width}x${viewport.height}: the trailer is set to play inline, muted, and fits`);
}

// Reduced motion: the trailer waits for the player's controls.
{
  const { context, page, errors } = await open(viewports[1], 'reduce');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#game-trailer').evaluate(v => v.paused), true, 'reduced motion keeps the trailer paused');
  assert.deepEqual(errors, [], 'no page errors');
  await context.close();
  console.log('  ok   reduced motion: the trailer does not start on its own');
}
await browser.close();
console.log('GTA title trailer checks passed.');
