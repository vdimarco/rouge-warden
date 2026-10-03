// Browser check for the copy of Follow Suit that the Cottage Arcade serves at /follow-suit/.
//
//   npm run qa:arcade
//
// It builds that copy into public/follow-suit/ and serves public/. With BASE_URL set to the address of /follow-suit/
// on a running arcade server, it checks that server instead.

import assert from 'node:assert/strict';
import { expectGoodLayout, PHONES, shot, startSession } from './lib.mjs';

const SEED = 'K7QX2M';
const RING = ['6C', '6D', '7D', '7S', ['8S', 'C'], 'AC'];
const BEST_KEY = 'follow-suit:best-chain';

const session = await startSession({ arcade: true });
const { check } = session;
const arcade = new URL('/', session.base).href;

const button = (page, name) => page.getByRole('button', { name, exact: true });
const settle = (page) => page.waitForFunction(() => !document.querySelector('[data-revealing="true"]'), null, { timeout: 15_000 });
const saved = (page) => page.evaluate((key) => window.localStorage.getItem(key), BEST_KEY);

/** The arcade page asks Google for its fonts. The check answers with an empty style sheet. */
const quietFonts = (page) => page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ body: '', contentType: 'text/css' }));

async function startTable(page) {
  await page.goto(`${session.base}?seed=${SEED}`);
  await button(page, 'Start table 1').tap();
  await page.waitForSelector('[data-testid="hand"] [data-card]');
}

async function playOneCard(page) {
  const code = await page.$eval('[data-testid="hand"] [data-legal="true"]:not([data-card^="8"])', (card) => card.dataset.card);
  await page.tap(`[data-testid="hand"] [data-card="${code}"]`);
  await button(page, 'Play chain').tap();
  await settle(page);
}

/** Three one-card chains miss the first target of 150, so the run ends. */
async function loseRun(page) {
  await startTable(page);
  for (let i = 0; i < 3; i += 1) await playOneCard(page);
  await page.getByTestId('run-end').waitFor();
}

/** The Arcade link: big enough for a thumb, inside the window, and on top. */
async function expectArcadeLink(page, label) {
  const link = page.getByRole('link', { name: 'Arcade', exact: true });
  const box = await link.boundingBox();
  const { width, height } = page.viewportSize();
  assert.ok(box.width >= 44 && box.height >= 44, `${label}: the Arcade link is ${box.width} by ${box.height} px`);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${label}: the Arcade link is outside the window`);
  assert.equal(await link.getAttribute('href'), '/');
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.textContent, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  assert.equal(hit, 'Arcade', `${label}: something covers the Arcade link`);
}

await check('the page loads quiet.js as its first script, then switch.js', async () => {
  const page = await session.phone();
  await page.goto(session.base);
  await page.getByTestId('start').waitFor();
  const scripts = await page.$$eval('script[src]', (list) => list.map((script) => script.getAttribute('src')));
  assert.deepEqual(scripts.slice(0, 2), ['/arcade/quiet.js', '/arcade/switch.js']);
  assert.ok(await page.evaluate(() => Boolean(window.__quiet) && typeof window.GameSwitch?.open === 'function'));
  await page.context().close();
});

for (const [width, height] of PHONES) {
  await check(`start screen and run end screen at ${width}x${height}: Switch game and Arcade fit, 44 px targets, no scroll`, async () => {
    const page = await session.phone(width, height);
    await page.goto(session.base);
    await page.getByTestId('start').waitFor();
    await expectGoodLayout(page, 'start screen');
    await expectArcadeLink(page, 'start screen');
    assert.ok(await button(page, 'Switch game').isVisible());
    await shot(page, `arcade-start-${width}x${height}`);

    await loseRun(page);
    await expectGoodLayout(page, 'run end screen');
    await expectArcadeLink(page, 'run end screen');
    assert.ok(await button(page, 'Switch game').isVisible());
    await shot(page, `arcade-end-${width}x${height}`);
    await page.context().close();
  });
}

await check('Switch game opens the game switcher with Follow Suit marked, and Keep playing closes it', async () => {
  const page = await session.phone();
  await page.goto(session.base);
  await button(page, 'Switch game').tap();
  await page.waitForSelector('.gsw:not([hidden]) .gsw-game');
  assert.deepEqual(await page.$$eval('.gsw-game.here b', (names) => names.map((name) => name.textContent)), ['Follow Suit']);
  await shot(page, 'arcade-switcher');
  await button(page, 'Keep playing').tap();
  await page.waitForSelector('.gsw', { state: 'hidden' });
  await page.getByTestId('start').waitFor();
  await page.context().close();
});

await check('a chain saves the best chain score, a weaker chain keeps it, and the machine shows it in the Strategy group', async () => {
  const page = await session.phone();
  await startTable(page);
  assert.equal(await saved(page), null);
  for (const entry of RING) {
    const [code, suit] = Array.isArray(entry) ? entry : [entry];
    await page.tap(`[data-testid="hand"] [data-card="${code}"]`);
    if (suit) await page.tap(`[data-testid="suit-picker"] [data-suit="${suit}"]`);
  }
  await button(page, 'Play chain').tap();
  await settle(page);
  assert.equal(await saved(page), '360');

  await startTable(page);
  await playOneCard(page);
  assert.equal(await saved(page), '360');

  await quietFonts(page);
  await page.goto(arcade);
  await page.waitForSelector('.cab.on');
  assert.equal(await page.textContent('.cab[data-game="follow-suit"] .hi'), 'BEST CHAIN 360');
  const strategy = await page.$$eval('#machinePicker optgroup[label="Strategy"] option', (options) => options.map((option) => option.textContent));
  assert.ok(strategy.includes('FOLLOW SUIT'), `the Strategy group lists ${strategy.join(', ')}`);
  await page.context().close();
});

await check('Arcade on the run end screen opens the arcade', async () => {
  const page = await session.phone();
  await loseRun(page);
  await quietFonts(page);
  await page.getByRole('link', { name: 'Arcade', exact: true }).tap();
  await page.waitForURL(arcade);
  await page.waitForSelector('.cab[data-game="follow-suit"]');
  await page.context().close();
});

await check('no console errors', async () => {
  assert.deepEqual(session.errors, []);
});

process.exit((await session.finish()) > 0 ? 1 : 0);
