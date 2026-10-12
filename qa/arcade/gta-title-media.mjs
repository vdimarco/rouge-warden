// Run after public/gta/poster.webp and trailer.mp4 are in place.
// Serve public/ (for example: cd public && python3 -m http.server 8765), then:
// node qa/arcade/gta-title-media.mjs
// Set GTA_TITLE_URL to test a deployed /gta/ page, and GTA_TITLE_QA_OUT for evidence.
// This checks actual browser image/video decoding. It never opens the streamed game.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Match the arcade QA suite's existing Playwright setup (`NODE_PATH=$(npm root -g)`
// or another installed node_modules directory); no test dependency is vendored here.
const { chromium } = createRequire(import.meta.url)('playwright');

const pageUrl = new URL(process.env.GTA_TITLE_URL || 'http://127.0.0.1:8765/gta/');
assert.match(pageUrl.protocol, /^https?:$/);
assert.match(pageUrl.pathname, /\/gta\/$/, 'GTA_TITLE_URL must end at the title page');
const publicPageUrl = pageUrl.origin + pageUrl.pathname;
const safeUrl = value => {
  const url = new URL(value);
  return url.origin + url.pathname;
};
const safeError = value => {
  let message = String(value).replaceAll(pageUrl.href, publicPageUrl);
  if (pageUrl.search) message = message.replaceAll(pageUrl.search, '?[redacted]');
  return message;
};
const output = path.resolve(process.env.GTA_TITLE_QA_OUT || '/tmp/nord-gta-title-media-qa');
const trailerUrl = new URL('trailer.mp4', pageUrl).href;
const posterUrl = new URL('poster.webp', pageUrl).href;
const localTrailer = await readFile(new URL('../../public/gta/trailer.mp4', import.meta.url));
const localPoster = await readFile(new URL('../../public/gta/poster.webp', import.meta.url));
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
];
const results = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-gpu'],
});

async function checkViewport(viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
    ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    if (!request.url().startsWith(pageUrl.origin)) return;
    const failure = request.failure();
    const reason = typeof failure === 'string' ? failure : failure?.errorText || JSON.stringify(failure);
    // Removing the video src on Close/Escape deliberately aborts an in-flight
    // media range request; loading the poster twice can cancel one duplicate.
    // Successful decoding is asserted separately below.
    if (reason.includes('ERR_ABORTED') && [posterUrl, trailerUrl].includes(request.url())) return;
    errors.push(`request: ${safeUrl(request.url())}: ${safeError(reason)}`);
  });
  page.on('response', response => {
    if (response.url().startsWith(pageUrl.origin) && response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${safeUrl(response.url())}`);
    }
  });

  try {
    const response = await page.goto(pageUrl.href, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, 'title page HTTP status');
    const [posterHead, trailerHead] = await Promise.all([
      context.request.head(posterUrl), context.request.head(trailerUrl),
    ]);
    assert.equal(posterHead.status(), 200, 'poster HTTP status');
    assert.match(posterHead.headers()['content-type'] || '', /^image\/webp(?:;|$)/i, 'poster MIME');
    assert.equal(trailerHead.status(), 200, 'trailer HTTP status');
    assert.match(trailerHead.headers()['content-type'] || '', /^video\/mp4(?:;|$)/i, 'trailer MIME');

    let mediaDelivery;
    if (viewport.width === 1280) {
      const range = await context.request.get(trailerUrl, {
        headers: { Range: 'bytes=0-1023', 'Accept-Encoding': 'identity' },
      });
      assert.equal(range.status(), 206, 'trailer accepts byte ranges');
      const contentRange = range.headers()['content-range'];
      assert.equal(contentRange, `bytes 0-1023/${localTrailer.length}`, 'Content-Range identifies exact source size');
      assert.match(range.headers()['accept-ranges'] || '', /^bytes$/i, 'byte-range response advertises ranges');
      assert.match(range.headers()['content-type'] || '', /^video\/mp4(?:;|$)/i, 'byte-range MIME');
      const rangeBytes = await range.body();
      assert.equal(rangeBytes.length, 1024, 'byte-range length');
      assert.deepEqual(rangeBytes, localTrailer.subarray(0, 1024), 'byte-range content matches source');

      const [remoteTrailer, remotePoster] = await Promise.all([
        context.request.get(trailerUrl), context.request.get(posterUrl),
      ]);
      assert.equal(remoteTrailer.status(), 200, 'complete trailer download');
      assert.equal(remotePoster.status(), 200, 'complete poster download');
      const trailerBytes = await remoteTrailer.body();
      const posterBytes = await remotePoster.body();
      assert.equal(digest(trailerBytes), digest(localTrailer), 'deployed trailer SHA-256 matches accepted local file');
      assert.equal(digest(posterBytes), digest(localPoster), 'deployed poster SHA-256 matches accepted local file');
      mediaDelivery = {
        rangeStatus: range.status(),
        contentRange,
        rangeBytes: rangeBytes.length,
        trailerBytes: trailerBytes.length,
        trailerSha256: digest(trailerBytes),
        posterBytes: posterBytes.length,
        posterSha256: digest(posterBytes),
      };
    }

    await page.waitForFunction(() => {
      const scene = document.querySelector('.scene');
      return !document.querySelector('#trailer-open')?.hidden &&
        getComputedStyle(scene).backgroundImage.includes('poster.webp');
    }, null, { timeout: 10_000 });
    const poster = await page.evaluate(async () => {
      const image = new Image();
      image.src = new URL('./poster.webp', location.href).href;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    assert.ok(poster.width > 0 && poster.height > 0, 'poster decodes');
    assert.match(await page.locator('#game-trailer').getAttribute('poster'), /poster\.webp$/);
    assert.equal(await page.locator('#trailer-pending').isHidden(), true, 'placeholder clears');
    assert.equal(await page.locator('a.play').getAttribute('href'), 'https://nord-montreal.vercel.app/', 'Play goes to live player');

    const layout = await page.evaluate(() => {
      const width = innerWidth;
      const targets = ['h1', '.play', '.feature', '.frame', '#trailer-open'];
      return {
        viewportWidth: width,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        targets: Object.fromEntries(targets.map(selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return [selector, { left: rect.left, right: rect.right }];
        })),
      };
    });
    assert.ok(layout.documentWidth <= viewport.width + 1 && layout.bodyWidth <= viewport.width + 1, 'no horizontal document overflow');
    for (const [selector, rect] of Object.entries(layout.targets)) {
      assert.ok(rect.left >= -1 && rect.right <= viewport.width + 1, `${selector} fits viewport`);
    }
    await page.screenshot({ path: path.join(output, `title-${viewport.width}.png`), fullPage: true });

    const open = page.locator('#trailer-open');
    await open.click();
    assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'modal opens');
    assert.equal(await page.evaluate(() => document.querySelector('#trailer-dialog').contains(document.activeElement)), true, 'focus enters modal');
    await page.waitForFunction(() => {
      const video = document.querySelector('#game-trailer');
      const quality = video.getVideoPlaybackQuality?.();
      return video.currentTime > 0.5 && video.videoWidth > 0 && video.videoHeight > 0 && quality?.totalVideoFrames >= 5;
    }, null, { timeout: 20_000 });
    const first = await page.locator('#game-trailer').evaluate(video => ({
      time: video.currentTime,
      width: video.videoWidth,
      height: video.videoHeight,
      decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames,
      currentSrc: video.currentSrc,
    }));
    assert.equal(first.currentSrc, trailerUrl, 'modal plays the actual trailer file');
    await page.waitForTimeout(500);
    const second = await page.locator('#game-trailer').evaluate(video => ({
      time: video.currentTime,
      decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames,
    }));
    assert.ok(second.time > first.time && second.decodedFrames > first.decodedFrames, 'video time and decoded frames advance');
    await page.screenshot({ path: path.join(output, `trailer-${viewport.width}.png`) });

    await page.locator('#trailer-close').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#game-trailer');
      return !document.querySelector('#trailer-dialog').open && video.paused && !video.hasAttribute('src');
    });
    const closed = await page.locator('#game-trailer').evaluate(video => ({ paused: video.paused, hasSrc: video.hasAttribute('src') }));
    assert.deepEqual(closed, { paused: true, hasSrc: false }, 'Close stops and unloads media');
    assert.equal(await open.evaluate(button => document.activeElement === button), true, 'Close restores trigger focus');

    await open.click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const video = document.querySelector('#game-trailer');
      return !document.querySelector('#trailer-dialog').open && video.paused && !video.hasAttribute('src');
    });
    const escaped = await page.locator('#game-trailer').evaluate(video => ({ paused: video.paused, hasSrc: video.hasAttribute('src') }));
    assert.deepEqual(escaped, { paused: true, hasSrc: false }, 'Escape stops and unloads media');
    assert.equal(await open.evaluate(button => document.activeElement === button), true, 'Escape restores trigger focus');
    assert.deepEqual(errors, [], 'no first-party page, request or HTTP errors');
    return { viewport, passed: true, poster, layout, first, second, closeAndEscape: true, mediaDelivery, errors };
  } finally {
    await context.close();
  }
}

try {
  for (const viewport of viewports) {
    try {
      results.push(await checkViewport(viewport));
    } catch (error) {
      results.push({ viewport, passed: false, error: safeError(error.stack || error) });
    }
  }
} finally {
  await browser.close();
}
const report = { pageUrl: publicPageUrl, authorizedPreview: Boolean(pageUrl.search), posterUrl, trailerUrl, passed: results.every(result => result.passed), results };
await writeFile(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, output, results: results.map(({ viewport, passed, error }) => ({ viewport, passed, error })) }, null, 2));
if (!report.passed) process.exitCode = 1;
