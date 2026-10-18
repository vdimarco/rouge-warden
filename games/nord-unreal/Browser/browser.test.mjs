import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  if (!['index.html', 'player.js', 'hero.js', 'crew.js', 'intro.js', 'menu.js', 'install.js', 'styles.css', 'hero.css', 'intro.css', 'menu.css', 'crew-sprite.webp', 'title-loop-wide.mp4', 'title-loop-tall.mp4', 'manifest.webmanifest', 'bungee-400.woff2', 'barlow-condensed-500.woff2', 'barlow-condensed-700.woff2', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].includes(file)) {
    response.writeHead(404).end();
    return;
  }
  const types = { woff2: 'font/woff2', js: 'text/javascript', css: 'text/css', webp: 'image/webp', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png', mp4: 'video/mp4' };
  response.setHeader('Content-Type', types[file.split('.').at(-1)] || 'text/html');
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
      // Keep a refusal pending long enough to test selector ownership during a subscription.
      setTimeout(() => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'subscribeFailed', message: 'Occupied UI test slot' })); }, 500);
    }
  });
});
// The player, sound, fullscreen and disconnect buttons live in the menu.
async function openMenu(target) {
  if (await target.locator('#menu').isHidden()) await target.locator('[data-menu-toggle]:visible').first().click();
}
async function installationHelp(target, width, height, label) {
  await target.setViewportSize({ width, height });
  await target.goto(url);
  await target.locator('#menu-toggle').click();
  assert.equal(await target.locator('#install-help').isHidden(), true);
  const box = await target.locator('#install-app').boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'Install is a >=44 px target');
  await target.locator('#install-app').click();
  assert.equal(await target.locator('#install-help').isVisible(), true, 'Install reveals manual browser instructions when no prompt is offered');
  assert.match(await target.locator('#install-help').textContent(), /Safari/);
  assert.match(await target.locator('#install-help').textContent(), /Add to Home Screen/);
  assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await target.locator('.menu-panel').evaluate(panel => panel.scrollWidth <= panel.clientWidth), true, 'installation help does not overflow the menu');
  await target.screenshot({ path: `.qa/install-help-${label}-${width}.png`, fullPage: true });
  await target.keyboard.press('Escape');
  assert.equal(await target.locator('#menu').isHidden(), true);
  assert.equal(await target.locator('#overlay').evaluate(overlay => overlay.inert), false);
  assert.equal(await target.evaluate(() => document.activeElement.id), 'menu-toggle', 'installation help preserves Escape and menu focus return');
}
async function installNudgeChecks(browser, errors) {
  // Isolated accelerated UI states assert reminders, not decoded game media or live play.
  for (const [width, height, mobile] of [[1280, 720, false], [320, 740, true], [390, 844, true], [667, 375, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    try {
      const target = await context.newPage();
      target.on('pageerror', error => errors.push(error.message));
      await target.clock.install();
      await target.goto(url);
      await target.clock.pauseAt((await target.evaluate(() => Date.now())) + 1000);
      const nudge = target.locator('#install-nudge');
      const state = value => target.evaluate(value => {
        document.body.dataset.state = value;
        document.querySelector('#overlay').hidden = value === 'playing';
        document.querySelector('#touch-controls').hidden = value !== 'playing' || navigator.maxTouchPoints === 0;
      }, value);
      if (!mobile) {
        await target.clock.fastForward(120000);
        assert.equal(await nudge.isHidden(), true, 'time on the title screen does not count as play');
        await state('ready');
        await target.clock.fastForward(120000);
        assert.equal(await nudge.isHidden(), true, 'a ready stream has not started playing');
        await state('playing');
        await target.clock.fastForward(60000);
        await state('disconnected');
        await target.clock.fastForward(120000);
        assert.equal(await nudge.isHidden(), true, 'disconnected time does not count');
        await state('playing');
        await openMenu(target);
        await target.clock.fastForward(120000);
        assert.equal(await nudge.isHidden(), true, 'time in the menu does not count');
        await target.locator('#menu-close').click();
        await target.locator('#video').focus();
        await target.clock.fastForward(59999);
        assert.equal(await nudge.isHidden(), true, 'the reminder waits for two cumulative minutes of play');
        // Simulate ownership gates without capturing the real mouse or contacting a host.
        await target.evaluate(() => {
          window.__qaNudgePointerLocked = true;
          Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => window.__qaNudgePointerLocked ? document.querySelector('#video') : null });
          document.querySelector('#touch-gas').dataset.pressed = 'true';
          document.querySelector('#frame').dataset.pressed = 'true';
        });
        await target.clock.fastForward(1);
        assert.equal(await nudge.isHidden(), true, 'held game input defers the reminder at the threshold');
        assert.equal(await target.evaluate(() => localStorage.getItem('gta-north-install-reminder')), null, 'deferred UI does not consume the cooldown');
        await target.evaluate(() => {
          window.__qaNudgePointerLocked = false;
          document.dispatchEvent(new Event('pointerlockchange'));
        });
        assert.equal(await nudge.isHidden(), true, 'releasing the mouse still waits for the held touch control');
        await target.evaluate(() => {
          delete document.querySelector('#touch-gas').dataset.pressed;
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });
        assert.equal(await nudge.isHidden(), true, 'a held look drag still defers the reminder');
        await target.evaluate(() => { delete document.querySelector('#frame').dataset.pressed; });
        await target.clock.runFor(1);
      } else {
        await state('playing');
        await target.locator('#video').focus();
        await target.clock.fastForward(119999);
        assert.equal(await nudge.isHidden(), true, 'the phone reminder also waits two minutes');
        await target.clock.fastForward(1);
      }
      assert.equal(await nudge.isVisible(), true, 'the reminder appears after eligible play');
      assert.equal(await target.evaluate(() => document.activeElement.id), 'video', 'appearing never steals game focus');
      assert.ok(await target.evaluate(() => localStorage.getItem('gta-north-install-reminder')), 'showing records the cooldown');
      for (const id of ['install-nudge-button', 'install-nudge-dismiss']) {
        const box = await target.locator(`#${id}`).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${id} is a >=44 px target at ${width}`);
      }
      if (!mobile) {
        await state('disconnected');
        assert.equal(await nudge.isHidden(), true, 'the reminder hides when play stops');
        await state('playing');
        assert.equal(await nudge.isVisible(), true, 'the undismissed reminder can return during play');
        await openMenu(target);
        assert.equal(await nudge.isHidden(), true, 'the menu hides the reminder');
        await target.locator('#menu-close').click();
        assert.equal(await nudge.isVisible(), true, 'closing the menu restores an undismissed reminder');
      }
      await target.locator('#install-nudge-button').click();
      assert.equal(await target.locator('#install-nudge-help').isVisible(), true, 'unsupported prompt UI offers manual installation help');
      assert.match(await target.locator('#install-nudge-help').textContent(), /Add to Home Screen/);
      const box = await nudge.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `reminder and help fit the ${width}x${height} screen`);
      assert.equal(await nudge.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'reminder help has no horizontal overflow');
      assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await target.screenshot({ path: `/tmp/nord-install-nudge-${width}.png`, fullPage: true });
      if (mobile) {
        for (const control of await target.locator('.move-stick:visible, .touch-primary button:visible, #touch-menu:visible').all()) {
          const touch = await control.boundingBox();
          const overlap = Math.min(box.x + box.width, touch.x + touch.width) > Math.max(box.x, touch.x)
            && Math.min(box.y + box.height, touch.y + touch.height) > Math.max(box.y, touch.y);
          assert.equal(overlap, false, `reminder help clears ${await control.getAttribute('id') || 'Move'} at ${width}x${height}`);
        }
      }
      if (mobile) await target.locator('#install-nudge-dismiss').click();
      else await target.keyboard.press('Escape');
      assert.equal(await nudge.isHidden(), true, 'Not now or Escape dismisses the reminder');
      assert.equal(await target.evaluate(() => document.querySelector('#install-nudge').contains(document.activeElement)), false, 'dismissal leaves no focus in hidden content');
      await state('disconnected');
      await state('playing');
      await target.clock.fastForward(120000);
      assert.equal(await nudge.isHidden(), true, 'dismissal prevents repeated reminders on this page');
      await target.reload();
      await state('playing');
      await target.clock.fastForward(120000);
      assert.equal(await nudge.isHidden(), true, 'the saved cooldown survives reload');
    } finally {
      await context.close();
    }
  }
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
  window.__nordQaSockets = [];
  const addListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...args) {
    if (type === 'videoInitialized') window.__nordQaEvents = this;
    return addListener.call(this, type, ...args);
  };
  window.WebSocket = class extends NativeWebSocket {
    constructor(url, protocols) {
      window.__nordQaSocketUrls.push(String(url));
      super(url, protocols);
      window.__nordQaSockets.push(this);
    }
  };
});
try {
  await mkdir('.qa', { recursive: true });
  build('');
  // Chromium blocks installation in incognito; isolate this real manifest gate in a temporary normal profile.
  const profile = await mkdtemp(join(tmpdir(), 'nord-installability-'));
  let installContext;
  try {
    installContext = await chromium.launchPersistentContext(profile, { executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--disable-gpu'] });
    const installPage = installContext.pages()[0] || await installContext.newPage();
    await installPage.goto(url);
    const cdp = await installContext.newCDPSession(installPage);
    const manifest = await cdp.send('Page.getAppManifest');
    const installability = await cdp.send('Page.getInstallabilityErrors');
    await writeFile('.qa/installability.json', JSON.stringify({ manifest, installability }, null, 2));
    assert.equal(manifest.url, `${url}/manifest.webmanifest`);
    assert.deepEqual(manifest.errors, [], 'Chromium parses the served manifest without errors');
    const app = JSON.parse(manifest.data);
    assert.equal(app.name, 'GTA: NORTH');
    for (const field of ['id', 'start_url', 'scope']) assert.equal(new URL(app[field], manifest.url).href, `${url}/`, `${field} resolves to the player root`);
    assert.equal(app.display, 'standalone');
    assert.deepEqual(installability.installabilityErrors, [], 'Chromium reports no installability errors; raw promotion gates are retained in .qa/installability.json');
    await cdp.detach();
  } finally {
    try {
      await installContext?.close();
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  }
  for (const [file, type] of Object.entries({ 'title-loop-wide.mp4': 'video/mp4', 'title-loop-tall.mp4': 'video/mp4', 'install.js': 'text/javascript', 'manifest.webmanifest': 'application/manifest+json', 'favicon.svg': 'image/svg+xml', 'favicon-32.png': 'image/png', 'apple-touch-icon.png': 'image/png', 'icon-192.png': 'image/png', 'icon-512.png': 'image/png', 'icon-maskable-512.png': 'image/png' })) {
    const response = await page.request.get(`${url}/${file}`);
    assert.equal(response.status(), 200, `${file} is shipped`);
    assert.equal(response.headers()['content-type'], type, `${file} has the correct media type`);
  }
  for (const [width, height] of [[1280, 720], [1920, 1080], [360, 800], [320, 568], [844, 390]]) {
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
    assert.equal(await page.locator('#overlay').evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth), true, 'entry screen fits without internal scrolling');
    assert.equal(await page.locator('.badge-launch').evaluate(el => (() => { const image = el.querySelector('img').getBoundingClientRect(); const button = el.querySelector('.play-label').getBoundingClientRect(); const center = button.top + button.height / 2; return center > image.top + image.height * .65 && center < image.top + image.height * .8; })()), true, 'PLAY overlays the lower third of the clickable badge');
    assert.equal(await page.locator('#watch-trailer').isVisible(), true);
    assert.equal(await page.locator('#hero-video').isVisible(), true, 'the trailer loop plays behind the start card');
    assert.equal(await page.locator('#trailer-video').getAttribute('src'), null, 'full trailer is not loaded until opened');
    assert.equal(await page.locator('#hero-video').getAttribute('src'), width < height ? './title-loop-tall.mp4' : './title-loop-wide.mp4', 'the title screen loops the text-free 14.5 s clip, vertical in portrait');
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
  assert.equal(await page.locator('#hero-video').getAttribute('src'), null, 'full trailer releases the title media');
  assert.equal(await page.locator('#trailer-video').getAttribute('src'), 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/850ec3d7-3375-4695-bcb6-0ad320dc8ad2.mp4');
  const trailerBox = await page.locator('#trailer-video').boundingBox();
  assert.deepEqual([trailerBox.x, trailerBox.y, trailerBox.width, trailerBox.height], [0, 0, 1280, 720], 'the trailer fills the screen');
  assert.equal(await page.locator('#close-trailer').isVisible(), true, 'Close stays on screen over the trailer');
  await page.screenshot({ path: '.qa/trailer-1280.png' });
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.querySelector('#trailer-dialog').open && document.querySelector('#trailer-video').paused);
  await page.waitForFunction(() => !document.querySelector('#trailer-video').hasAttribute('src')); // close is queued after fullscreen exit.
  // The video's own fullscreen (double-click, or its controls on another browser) keeps the trailer open,
  // and Close then leaves both levels of fullscreen.
  await page.locator('#watch-trailer').click();
  await trailerIsFullscreen();
  assert.equal(await page.locator('#trailer-video').getAttribute('controlslist'), 'nofullscreen', 'the stage is already fullscreen');
  await page.evaluate(() => {
    const button = Object.assign(document.createElement('button'), { id: 'qa-video-fullscreen', textContent: 'video fullscreen' });
    button.style.cssText = 'position:absolute;left:0;bottom:80px;z-index:2';
    button.onclick = () => document.querySelector('#trailer-video').requestFullscreen();
    document.querySelector('#trailer-stage').append(button);
  });
  await page.locator('#qa-video-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'trailer-video');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'the trailer stays open in the video\'s own fullscreen');
  await page.evaluate(() => document.exitFullscreen());
  await trailerIsFullscreen();
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'leaving the video\'s fullscreen returns to the trailer');
  await page.locator('#close-trailer').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  // Over a fullscreen game frame the trailer covers the screen without a fullscreen of its own,
  // and leaving the video's own fullscreen drops back to the trailer, not out of it.
  await page.locator('#menu-toggle').click();
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'frame');
  await page.locator('#watch-trailer').click();
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'frame');
  await page.locator('#qa-video-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'trailer-video');
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.fullscreenElement?.id === 'frame');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), true, 'the trailer stays open over the fullscreen game frame');
  await page.locator('#close-trailer').click();
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'frame', 'Close keeps the game frame fullscreen');
  await page.evaluate(() => { document.querySelector('#qa-video-fullscreen').remove(); return document.exitFullscreen(); });
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.locator('#trailer-dialog').evaluate(dialog => dialog.open), false);
  await page.waitForFunction(() => document.querySelector('#trailer-video').paused); // dialog close is queued by the browser.
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
  // Browsers without an offered native prompt can still use the menu's installation instructions.
  await installationHelp(page, 1280, 720, 'desktop');
  // A synthetic prompt tests the real DOM focus lifecycle, not installation through the operating system.
  await openMenu(page);
  await page.evaluate(() => {
    window.__installQaPrompts = 0;
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => { window.__installQaPrompts++; return Promise.resolve(); },
      userChoice: Promise.resolve({ outcome: 'accepted' })
    }));
    document.querySelector('#install-app').focus();
  });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'install-app');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#install-app').hidden);
  const installFocus = await page.evaluate(() => ({ prompts: window.__installQaPrompts, hidden: document.querySelector('#install-app').hidden, activeElement: document.activeElement.id, menuHidden: document.querySelector('#menu').hidden }));
  await writeFile('.qa/install-focus-lifecycle.json', JSON.stringify({ synthetic: true, ...installFocus }, null, 2));
  assert.equal(installFocus.prompts, 1, 'Enter invokes one deferred prompt');
  assert.equal(installFocus.activeElement, 'menu-close', 'accepted installation returns focus to Close after disabling and hiding Install');
  assert.equal(installFocus.menuHidden, false, 'the menu stays open after the install action');
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
    assert.equal(await page.locator('#hero-video').getAttribute('src'), null, 'Start releases the title download');
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
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/crew-sprite.webp') && entry.responseEnd > 0));
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
  for (const [width, height] of [[320, 740], [390, 844]]) await installationHelp(phonePage, width, height, 'touch');
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
  // Round game buttons stay separated in two bottom-right rows.
  const buttons = await phonePage.locator('.touch-primary button').evaluateAll(elements => elements.map(button => {
    const box = button.getBoundingClientRect();
    return { top: box.top, left: box.left, right: box.right, width: box.width, height: box.height,
      radius: parseFloat(getComputedStyle(button).borderTopLeftRadius), icon: button.querySelector('svg')?.getBoundingClientRect().height,
      border: parseFloat(getComputedStyle(button).borderTopWidth), background: getComputedStyle(button).backgroundColor };
  }));
  assert.equal(buttons.length, 4, 'Sprint, Jump, Use and Menu');
  assert.equal(new Set(buttons.map(button => button.top)).size, 2, 'two rows');
  assert.equal(new Set(buttons.map(button => button.left)).size, 2, 'two columns');
  for (const button of buttons) {
    assert.ok(button.width >= 88 && button.height >= 88, '88 px portrait thumb targets');
    assert.ok(button.radius >= 50 && button.icon >= 28, 'round faces with clear action icons');
    assert.ok(button.border > 0 && button.background !== 'rgba(0, 0, 0, 0)', 'full visible button faces');
  }
  assert.ok(buttons[0].left > 390 * .45 && Math.abs(buttons[1].right - (390 - 16)) <= 1, 'bottom-right grid');
  assert.ok(buttons[1].left - buttons[0].right >= 12 && buttons[2].top - buttons[0].top - buttons[0].height >= 12, '12 px thumb clearance');
  assert.ok(buttons[3].top === buttons[2].top && Math.abs(buttons[3].right - (390 - 16)) <= 1, 'Menu fills the bottom-right corner');
  assert.equal(await phonePage.locator('[data-stick="look"]').count(), 0, 'image drag replaces the look pad');
  for (const [width, height] of [[390, 844], [844, 390]]) {
    await phonePage.setViewportSize({ width, height });
    await phonePage.locator('.move-stick').evaluate(stick => { stick.dataset.pressed = 'true'; stick.style.setProperty('--stick-y', '-18px'); });
    await phonePage.waitForTimeout(200);
    assert.ok(await phonePage.locator('.move-stick').evaluate(stick => Number(getComputedStyle(stick).opacity) >= .5), 'held Move keeps its direction visible');
    await phonePage.screenshot({ path: `.qa/move-held-${width}.png` });
    await phonePage.locator('.move-stick').evaluate(stick => { stick.dataset.pressed = 'false'; stick.style.setProperty('--stick-y', '0px'); });
  }
  await phonePage.setViewportSize({ width: 390, height: 844 });
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
  const crewBounds = await phonePage.locator('#crew-picker').boundingBox();
  assert.ok(crewBounds.y + crewBounds.height + 16 <= buttons[0].top, 'crew list clears the larger action grid');
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
  // Start keeps the page in its window, so the header's ☰ Menu stays in reach over the start screen.
  assert.equal(await phonePage.evaluate(() => document.fullscreenElement), null);
  assert.equal(await phonePage.evaluate(() => {
    const { left, top, width, height } = document.querySelector('#menu-toggle').getBoundingClientRect();
    return document.elementFromPoint(left + width / 2, top + height / 2)?.id;
  }), 'menu-toggle', 'the menu button is reachable while the start screen is open');
  const fits = await phonePage.evaluate(() => {
    const intro = document.querySelector('#intro').getBoundingClientRect();
    const play = document.querySelector('#crew-play').getBoundingClientRect();
    return play.bottom <= intro.bottom && document.querySelector('#intro').scrollTop === 0;
  });
  assert.equal(fits, true, 'Play as is on screen on a phone on its side');
  await phonePage.screenshot({ path: '.qa/crew-667-touch.png' });
  // On a touch screen the tap on Play as takes the game frame fullscreen.
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
  await installNudgeChecks(browser, errors);
  // Still-only pages must not start MP4 downloads, even on rotation.
  for (const saver of [false, true]) {
    const still = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: saver ? 'no-preference' : 'reduce' });
    if (saver) await still.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    const stillPage = await still.newPage();
    const requests = [];
    await stillPage.route('**/*.mp4', route => { requests.push(route.request().url()); return route.abort(); });
    await stillPage.goto(url);
    await stillPage.setViewportSize({ width: 844, height: 390 });
    await stillPage.waitForTimeout(200);
    assert.equal(await stillPage.locator('#hero-video').getAttribute('src'), null);
    assert.deepEqual(requests, [], 'still-only title/rotation must not request MP4 media');
    await stillPage.locator('#watch-trailer').click();
    await stillPage.waitForFunction(() => document.querySelector('#trailer-video').hasAttribute('src'));
    assert.ok((await stillPage.locator('#trailer-video').getAttribute('src')).endsWith('.mp4'), 'explicit trailer remains available');
    await still.close();
  }
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
  await page.waitForFunction(() => document.querySelector('#streamer').options.length > 1);
  assert.equal(await page.locator('#streamer').isDisabled(), true, 'a pending subscription cannot overlap a second slot selection');
  await page.waitForFunction(() => document.querySelector('#status-title').textContent === 'This player is unavailable.');
  assert.deepEqual(subscriptions, ['NordHost']);
  await page.evaluate(() => {
    document.querySelector('#video video').dispatchEvent(new Event('playing'));
    window.__nordQaEvents.dispatchEvent(new Event('videoInitialized'));
    window.__nordQaEvents.dispatchEvent(new Event('playStreamRejected'));
  });
  assert.equal(await page.locator('body').getAttribute('data-state'), 'error', 'late media cannot revive a refused session');
  assert.equal(await page.locator('#play').isVisible(), false);
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
  await page.evaluate(() => { document.querySelector('#video video').dispatchEvent(new Event('playing')); window.__nordQaEvents.dispatchEvent(new Event('videoInitialized')); window.__nordQaEvents.dispatchEvent(Object.assign(new Event('subscribeFailed'), { data: { message: 'Late refusal' } })); });
  assert.equal(await page.locator('body').getAttribute('data-state'), 'disconnected', 'late media cannot revive an explicitly left session');
  await page.locator('#streamer').dispatchEvent('change');
  assert.equal(await page.locator('body').getAttribute('data-state'), 'disconnected', 'a stale change event cannot hide Reconnect');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1']);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.querySelector('#status-title').textContent === 'This player is unavailable.');
  assert.equal(connections, 2, 'Reconnect establishes a new signalling socket');
  assert.equal(await page.locator('#streamer').isEnabled(), true, 'a fresh streamer list restores slot selection');
  assert.deepEqual(subscriptions, ['NordHost', 'NordFriend1', 'NordFriend1']);
  await page.screenshot({ path: '/tmp/nord-browser-slot-reconnect.png', fullPage: true });
  await page.evaluate(() => window.__nordQaEvents.dispatchEvent(new Event('dataChannelError')));
  await page.waitForFunction(() => window.__nordQaSockets.at(-1).readyState === WebSocket.CLOSED);
  assert.equal(await page.locator('#status-title').textContent(), 'The controls disconnected.', 'disconnect keeps the specific error');
  assert.equal(await page.locator('#connect').isVisible(), true);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.querySelector('#status-title').textContent === 'This player is unavailable.');
  assert.equal(connections, 3, 'control failure recovery opens a fresh socket');
  // Start connects in the background and the start screen reports the connection.
  await page.goto(url);
  await page.locator('#start').click();
  assert.equal(await page.locator('#intro-crew').isVisible(), true);
  await page.waitForFunction(() => document.querySelector('#intro-status').textContent === 'This player is unavailable.');
  assert.equal(connections, 4, 'Start opens a connection while the player chooses');
  await page.locator('#crew-play').click();
  assert.equal(await page.locator('#status-title').isVisible(), true, 'closing the start screen shows the connection card');
  assert.deepEqual(errors, []);
  assert.deepEqual(loggingSpam, [], 'production logging suppresses debug/info and per-packet messages');
  console.log('Browser UI checks passed: Chromium manifest/installability gates, installed assets, installation help at 320/390/1280, two-minute install reminder timing/focus/input gates/layout/dismissal/cooldown, offline, desktop/mobile layout, title-screen trailer, start screen story and crew choice, warning-only logging, click-to-connect, unavailable host, ignored query overrides, occupied-slot selection and disconnect/reconnect. No native installation or live game asserted.');
} catch (error) {
  console.error({ state: await page.locator('body').getAttribute('data-state').catch(() => null), title: await page.locator('#status-title').textContent().catch(() => null), errors });
  throw error;
} finally {
  await browser.close();
  signalling.close();
  server.close();
  build(originalEndpoint);
}
