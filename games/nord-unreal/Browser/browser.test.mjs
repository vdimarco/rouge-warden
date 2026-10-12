import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

// Reuse the repository's browser QA dependency; the shipped player has no Playwright dependency.
const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
const originalEndpoint = process.env.NORD_SIGNALLING_URL || '';
function build(endpoint) {
  const result = spawnSync(process.execPath, ['build.mjs'], { env: { ...process.env, NORD_SIGNALLING_URL: endpoint }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
const server = createServer(async (request, response) => {
  const file = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  const trailerFiles = ['trailer/hero-loop.mp4', 'trailer/gta-nord-trailer.mp4', 'trailer/hero-poster.jpg'];
  if (!['index.html', 'player.js', 'styles.css', ...trailerFiles].includes(file)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css'
    : file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
  response.end(await readFile(`dist/${file}`));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
// Exercise the shipped Epic player against a small real signalling socket,
// without starting Unreal or fabricating successful video/media playback.
const subscriptions = [];
let connections = 0;
const signalling = new WebSocketServer({ server });
signalling.on('connection', socket => {
  connections++;
  socket.send(JSON.stringify({ type: 'config', protocolVersion: '1.3.0', peerConnectionOptions: {} }));
  socket.on('message', data => {
    const message = JSON.parse(data.toString());
    if (message.type === 'listStreamers') {
      socket.send(JSON.stringify({ type: 'streamerList', ids: ['NordHost', 'NordFriend1'] }));
    } else if (message.type === 'subscribe') {
      subscriptions.push(message.streamerId);
      socket.send(JSON.stringify({ type: 'subscribeFailed', message: 'Occupied UI test slot' }));
    }
  });
});
const browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
const loggingSpam = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (/\[(?:Info|Debug)\]|Message Sent:/.test(message.text())) loggingSpam.push(message.text());
});
await page.addInitScript(() => {
  const NativeWebSocket = window.WebSocket;
  window.__nordQaSocketUrls = [];
  window.WebSocket = class extends NativeWebSocket {
    constructor(url, protocols) {
      window.__nordQaSocketUrls.push(String(url));
      super(url, protocols);
    }
  };
});
try {
  await mkdir('.qa', { recursive: true });
  build('');
  for (const [width, height] of [[1280, 720], [1920, 1080], [360, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${url}/?ss=wss://untrusted.example&AutoConnect=true`);
    assert.equal(await page.locator('body').getAttribute('data-state'), 'offline');
    assert.equal(await page.locator('#connect').isDisabled(), true);
    assert.equal(await page.locator('#play').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => window.__nordQaSocketUrls.length), 0, 'query parameters must not establish a connection');
    assert.deepEqual(await page.evaluate(() => ({ level: window.loggerContext.logLevel, stack: window.loggerContext.includeStack })),
      { level: 2, stack: false }, 'offline pages initialize warning-only logging without stack capture');
    assert.equal(await page.locator('.hero-title').isVisible(), true, 'the title screen shows the game title');
    assert.equal(await page.locator('#watch-trailer').isVisible(), true);
    assert.equal(await page.locator('#hero-video').isVisible(), true, 'the trailer loop plays behind the start card');
    assert.equal(await page.locator('#connect').isVisible(), true, 'the start card stays reachable under the hero');
    await page.screenshot({ path: `.qa/offline-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#watch-trailer').click();
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'Watch the trailer opens the player');
  assert.equal(await page.locator('#trailer-video source').getAttribute('src'), './trailer/gta-nord-trailer.mp4');
  await page.screenshot({ path: '.qa/trailer-1280.png' });
  await page.locator('#close-trailer').click();
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await page.locator('#trailer-video').evaluate(video => video.paused), true, 'closing the trailer stops it');
  build('ws://127.0.0.1:40999');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${url}/?ss=wss://untrusted.example&AutoConnect=true`);
  await page.waitForFunction(() => document.body.dataset.state === 'idle');
  assert.deepEqual(await page.evaluate(() => ({ level: window.loggerContext.logLevel, stack: window.loggerContext.includeStack })),
    { level: 2, stack: false }, 'configured players retain production logging settings');
  assert.equal(await page.evaluate(() => window.__nordQaSocketUrls.length), 0, 'a configured player still requires an explicit click');
  await page.locator('#connect').click();
  await page.waitForFunction(() => ['disconnected', 'error', 'offline'].includes(document.body.dataset.state));
  assert.deepEqual(await page.evaluate(() => window.__nordQaSocketUrls), ['ws://127.0.0.1:40999/'], 'only the build-configured endpoint is used');
  assert.equal(await page.locator('#play').isVisible(), false);
  assert.equal(await page.locator('#connect').isEnabled(), true);
  await page.screenshot({ path: '.qa/unavailable-1280.png', fullPage: true });
  build(`ws://127.0.0.1:${server.address().port}`);
  await page.goto(url);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.querySelector('#status-title').textContent === 'This player is unavailable.');
  assert.deepEqual(subscriptions, ['NordHost']);
  assert.equal(await page.locator('#streamer').isEnabled(), true, 'occupied-slot refusal keeps the live socket selector usable');
  await page.locator('#streamer').selectOption('NordFriend1');
  await page.waitForFunction(() => document.body.dataset.state === 'error');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1'], 'another slot subscribes over the same open signalling socket');
  assert.equal(connections, 1);
  await page.locator('#disconnect').click();
  await page.waitForFunction(() => document.body.dataset.state === 'disconnected');
  assert.equal(await page.locator('#streamer').isDisabled(), true, 'disconnected slots require Reconnect');
  assert.equal(await page.locator('#connect').isVisible(), true);
  await page.locator('#streamer').dispatchEvent('change');
  assert.equal(await page.locator('body').getAttribute('data-state'), 'disconnected', 'a stale change event cannot hide Reconnect');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1']);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.querySelector('#status-title').textContent === 'This player is unavailable.');
  assert.equal(connections, 2, 'Reconnect establishes a new signalling socket');
  assert.equal(await page.locator('#streamer').isEnabled(), true, 'a fresh streamer list restores slot selection');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1', 'NordFriend1']);
  await page.screenshot({ path: '/tmp/nord-browser-slot-reconnect.png', fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(loggingSpam, [], 'production logging suppresses debug/info and per-packet messages');
  console.log('Browser UI checks passed: offline, desktop/mobile layout, title-screen trailer, warning-only logging, click-to-connect, unavailable host, ignored query overrides, occupied-slot selection and disconnect/reconnect. No live game asserted.');
} finally {
  await browser.close();
  signalling.close();
  server.close();
  build(originalEndpoint);
}
