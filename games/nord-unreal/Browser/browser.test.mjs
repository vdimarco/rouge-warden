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
  if (!['index.html', 'player.js', 'hero.js', 'crew.js', 'intro.js', 'menu.js', 'styles.css', 'hero.css', 'intro.css', 'menu.css'].includes(file)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
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
// The player, sound, fullscreen and disconnect buttons live in the menu.
async function openMenu(target) {
  if (await target.locator('#menu').isHidden()) await target.locator('[data-menu-toggle]:visible').first().click();
}
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
    assert.equal(await page.locator('.hero-title').textContent(), 'GTA: NORTH', 'the title screen shows the game title');
    assert.equal(await page.locator('#watch-trailer').isVisible(), true);
    assert.equal(await page.locator('#hero-video').isVisible(), true, 'the trailer loop plays behind the start card');
    assert.equal(await page.locator('#hero-video').getAttribute('src'), width < height ? 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/4d0928ae-27d4-4c7e-92ec-f3927c66a4b0.mp4' : 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/a7a1e663-b152-4806-9a6c-6907f9738a44.mp4', 'the title screen loops a light 15 s clip, vertical in portrait');
    assert.equal(await page.locator('#hero-video').evaluate(video => video.loop && !video.hasAttribute('muted')), true);
    assert.equal(await page.locator('#connect').isVisible(), true, 'the start card stays reachable under the hero');
    await page.screenshot({ path: `.qa/offline-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // The full trailer plays full screen; leaving fullscreen closes it, and Close leaves fullscreen.
  const trailerIsFullscreen = () => page.waitForFunction(() => document.fullscreenElement === document.querySelector('#trailer-stage'));
  await page.locator('#watch-trailer').click();
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'Watch the trailer opens the player');
  await trailerIsFullscreen();
  assert.equal(await page.locator('#trailer-video').getAttribute('src'), 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/850ec3d7-3375-4695-bcb6-0ad320dc8ad2.mp4');
  const trailerBox = await page.locator('#trailer-video').boundingBox();
  assert.deepEqual([trailerBox.x, trailerBox.y, trailerBox.width, trailerBox.height], [0, 0, 1280, 720], 'the trailer fills the screen');
  assert.equal(await page.locator('#close-trailer').isVisible(), true, 'Close stays on screen over the trailer');
  await page.screenshot({ path: '.qa/trailer-1280.png' });
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.querySelector('#trailer-dialog').open);
  assert.equal(await page.locator('#trailer-video').evaluate(video => video.paused), true, 'leaving fullscreen stops the trailer');
  await page.locator('#watch-trailer').click();
  await trailerIsFullscreen();
  await page.locator('#close-trailer').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await page.locator('#trailer-video').evaluate(video => video.paused), true, 'closing the trailer stops it');
  // The header keeps only the title and the menu button; the menu holds the stream buttons.
  for (const id of ['streamer', 'mute', 'fullscreen', 'disconnect']) {
    assert.equal(await page.locator(`#${id}`).isHidden(), true, `${id} is in the closed menu, not on top`);
  }
  await page.locator('#menu-toggle').click();
  assert.equal(await page.locator('#menu').isVisible(), true);
  assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
  for (const id of ['streamer', 'mute', 'fullscreen', 'disconnect']) assert.equal(await page.locator(`#${id}`).isVisible(), true);
  assert.equal(await page.locator('.menu-game').isHidden(), true, 'game buttons show only while playing on a touch screen');
  await page.screenshot({ path: '.qa/menu-1280.png' });
  assert.equal(await page.locator('#overlay').evaluate(overlay => overlay.inert), true, 'the title screen under the menu is out of reach');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').isHidden(), true, 'Escape closes the menu');
  assert.equal(await page.locator('#overlay').evaluate(overlay => overlay.inert), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle', 'focus returns to the menu button');
  // Start screen: three story panels, then the crew choice; each layout fits without sideways scrolling.
  for (const [width, height] of [[360, 800], [800, 360], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.clear());
    await page.goto(url);
    await page.locator('#start').click();
    assert.equal(await page.locator('#intro').isVisible(), true, 'Start opens the start screen');
    assert.equal(await page.locator('body').getAttribute('data-intro'), 'open');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'a mouse-and-keyboard player stays in the window');
    assert.equal(await page.locator('#hero-video').isHidden(), true, 'the title trailer stops behind the start screen');
    for (const step of ['1 / 3', '2 / 3', '3 / 3']) {
      assert.equal(await page.locator('#intro-step').textContent(), step);
      await page.waitForFunction(() => document.querySelector('#intro-image').complete);
      assert.match(await page.locator('#intro-image').getAttribute('src'), /^https:\/\/d2ol7oe51mr4n9\.cloudfront\.net\/.+\.webp$/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.qa/intro-${step[0]}-${width}.png` });
      await page.locator('#intro-next').click();
    }
    assert.equal(await page.locator('#intro-crew').isVisible(), true, 'the story ends on the crew choice');
    assert.equal(await page.locator('#crew-grid button').count(), 8);
    assert.equal(await page.locator('#crew-play').isDisabled(), true, 'a crew member must be chosen first');
    await page.locator('#crew-grid button[data-slot="7"]').click();
    assert.equal(await page.locator('#crew-grid button[data-slot="7"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#crew-play').textContent(), 'Play as TOPKNOT ▶');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const card of await page.locator('#crew-grid button').all()) {
      const box = await card.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, 'each crew card is a >=44 px target');
    }
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('e7188ec0-a77a-428c-ad52-dfcec5511aaf.webp') && entry.responseEnd > 0));
    await page.screenshot({ path: `.qa/crew-${width}.png` });
    await page.locator('#crew-play').click();
    assert.equal(await page.locator('#intro').isHidden(), true, 'Play closes the start screen');
    assert.equal(await page.locator('body').getAttribute('data-crew'), '7', 'the choice waits for the stream');
    assert.equal(await page.evaluate(() => localStorage.getItem('gta-north-crew')), '7');
    assert.equal(await page.locator('body').getAttribute('data-intro'), null);
  }
  await page.reload();
  assert.equal(await page.locator('body').getAttribute('data-crew'), '7', 'a returning player keeps their crew member');
  await page.locator('#start').click();
  assert.equal(await page.locator('#intro-crew').isVisible(), true, 'a returning player goes straight to the crew choice');
  assert.equal(await page.locator('#crew-grid button[data-slot="7"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#crew-play').isEnabled(), true);
  await page.locator('#intro-story-again').click();
  assert.equal(await page.locator('#intro-step').textContent(), '1 / 3', 'Story replays the panels');
  await page.locator('#intro-skip').click();
  assert.equal(await page.locator('#intro-crew').isVisible(), true, 'Skip story goes to the crew choice');
  assert.equal(await page.locator('#overlay').evaluate(overlay => overlay.inert), true, 'the title screen under the start screen is out of reach');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#intro').isHidden(), true, 'Escape closes the start screen');
  assert.equal(await page.locator('#overlay').evaluate(overlay => overlay.inert), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'start', 'focus returns to Start');
  // A crew member chosen in game (Crew button or keys 1-8) is the one the start screen shows next.
  await page.evaluate(() => { document.body.dataset.crew = '2'; });
  await page.locator('#start').click();
  assert.equal(await page.locator('#crew-grid button[data-slot="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#crew-play').textContent(), 'Play as BLACK CAP ▶');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hero-video').isVisible(), true, 'the title trailer returns');
  // The stored crew member is sent once each time a connection starts playing; on phones through the touch key buttons.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phonePage = await phone.newPage();
  phonePage.on('pageerror', error => errors.push(error.message));
  await phonePage.goto(url);
  await phonePage.evaluate(() => localStorage.setItem('gta-north-crew', '7'));
  await phonePage.reload();
  await phonePage.evaluate(() => {
    window.__crewClicks = [];
    document.querySelector('#crew-picker').addEventListener('click', event => window.__crewClicks.push(event.target.dataset.key), true);
  });
  const setState = state => phonePage.evaluate(value => { document.body.dataset.state = value; }, state);
  await setState('playing');
  await phonePage.waitForTimeout(800);
  await setState('playing');
  await phonePage.waitForTimeout(800);
  assert.deepEqual(await phonePage.evaluate(() => window.__crewClicks), ['56'], 'TOPKNOT (key 8) is sent once per connection');
  await setState('disconnected');
  await setState('playing');
  await phonePage.waitForTimeout(800);
  assert.deepEqual(await phonePage.evaluate(() => window.__crewClicks), ['56', '56'], 'a new connection sends it again');
  await setState('disconnected');
  await setState('playing');
  await setState('disconnected');
  await phonePage.waitForTimeout(800);
  assert.deepEqual(await phonePage.evaluate(() => window.__crewClicks), ['56', '56'], 'nothing is sent after the stream stops');
  // While playing on a phone the header hides and the ☰ next to Sprint, Jump and Use opens the menu with the game buttons.
  await phonePage.evaluate(() => {
    document.body.dataset.state = 'playing';
    document.querySelector('#overlay').hidden = true;
    document.querySelector('#touch-controls').hidden = false;
    window.__keyClicks = [];
    document.querySelector('.touch-keys').addEventListener('click', event => window.__keyClicks.push(event.target.dataset.key), true);
  });
  assert.equal(await phonePage.locator('header').isHidden(), true, 'the header hides while playing on a phone');
  const menuButton = await phonePage.locator('#touch-menu').boundingBox();
  assert.ok(menuButton.width >= 44 && menuButton.height >= 44, 'the ☰ button is a >=44 px target');
  await phonePage.locator('#touch-menu').click();
  assert.equal(await phonePage.locator('.menu-game').isVisible(), true);
  await phonePage.screenshot({ path: '.qa/menu-390-playing.png' });
  await phonePage.locator('[data-send="82"]').click();
  assert.deepEqual(await phonePage.evaluate(() => window.__keyClicks), ['82'], 'Recover presses the R key button once');
  assert.equal(await phonePage.locator('#menu').isHidden(), true, 'a game button closes the menu');
  await phonePage.locator('#touch-menu').click();
  await phonePage.locator('#crew-toggle').click();
  assert.equal(await phonePage.locator('#crew-picker').isVisible(), true, 'Crew opens the crew list');
  assert.equal(await phonePage.locator('#menu').isHidden(), true);
  await phonePage.locator('#crew-close').click();
  assert.equal(await phonePage.locator('#crew-picker').isHidden(), true, 'Close shuts the crew list');
  await phonePage.evaluate(() => {
    document.body.dataset.state = 'disconnected';
    document.querySelector('#overlay').hidden = false;
    document.querySelector('#touch-controls').hidden = true;
  });
  // A phone on its side fits the whole crew choice without scrolling.
  await phonePage.setViewportSize({ width: 667, height: 375 });
  await phonePage.evaluate(() => localStorage.setItem('gta-north-intro', 'seen'));
  await phonePage.reload();
  await phonePage.locator('#start').click();
  // On a touch screen the tap on Start also takes the game frame fullscreen.
  await phonePage.waitForFunction(() => document.fullscreenElement?.id === 'frame');
  const fits = await phonePage.evaluate(() => {
    const intro = document.querySelector('#intro').getBoundingClientRect();
    const play = document.querySelector('#crew-play').getBoundingClientRect();
    return play.bottom <= intro.bottom && document.querySelector('#intro').scrollTop === 0;
  });
  assert.equal(fits, true, 'Play as is on screen on a phone on its side');
  await phonePage.screenshot({ path: '.qa/crew-667-touch.png' });
  // A player who left fullscreen gets it back with Play as.
  await phonePage.evaluate(() => document.exitFullscreen());
  await phonePage.waitForFunction(() => !document.fullscreenElement);
  await phonePage.locator('#crew-play').click();
  await phonePage.waitForFunction(() => document.fullscreenElement?.id === 'frame');
  // The menu leaves fullscreen in any state; in fullscreen the title screen has its own menu button, clear of Sound on.
  await phonePage.evaluate(() => { document.querySelector('#hero-sound').hidden = false; });
  const overlap = await phonePage.evaluate(() => {
    const [a, b] = ['#hero-sound', '#overlay-menu'].map(id => document.querySelector(id).getBoundingClientRect());
    return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
  });
  assert.equal(overlap, false, 'Sound on and ☰ Menu do not cover each other in fullscreen');
  await phonePage.locator('#overlay-menu').click();
  assert.equal(await phonePage.locator('#fullscreen').textContent(), 'Exit fullscreen');
  await phonePage.locator('#fullscreen').click();
  await phonePage.waitForFunction(() => !document.fullscreenElement);
  await phone.close();
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
  await openMenu(page);
  await page.locator('#streamer').selectOption('NordFriend1');
  assert.equal(await page.locator('#menu').isHidden(), true, 'choosing a player closes the menu');
  await page.waitForFunction(() => document.body.dataset.state === 'error');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1'], 'another slot subscribes over the same open signalling socket');
  assert.equal(connections, 1);
  await openMenu(page);
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
  // Start connects in the background and the start screen reports the connection.
  await page.goto(url);
  await page.locator('#start').click();
  assert.equal(await page.locator('#intro-crew').isVisible(), true);
  await page.waitForFunction(() => document.querySelector('#intro-status').textContent === 'This player is unavailable.');
  assert.equal(connections, 3, 'Start opens a connection while the player chooses');
  await page.locator('#crew-play').click();
  assert.equal(await page.locator('#status-title').isVisible(), true, 'closing the start screen shows the connection card');
  assert.deepEqual(errors, []);
  assert.deepEqual(loggingSpam, [], 'production logging suppresses debug/info and per-packet messages');
  console.log('Browser UI checks passed: offline, desktop/mobile layout, title-screen trailer, start screen story and crew choice, warning-only logging, click-to-connect, unavailable host, ignored query overrides, occupied-slot selection and disconnect/reconnect. No live game asserted.');
} finally {
  await browser.close();
  signalling.close();
  server.close();
  build(originalEndpoint);
}
