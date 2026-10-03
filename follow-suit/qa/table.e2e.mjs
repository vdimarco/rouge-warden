// Browser check for milestone 2: one table, played by touch on a phone-sized screen.
//
//   npm run qa                      builds, serves dist/ and runs the check
//   BASE_URL=https://... npm run qa:url   runs the check against a deployed preview
//
// Set CHROMIUM_PATH to use a Chromium binary that Playwright did not install.
// Set CHROMIUM_ARGS to pass extra launch flags, separated by spaces.
// Screenshots go to qa/out/.

import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, 'out');
const DIST = join(HERE, '..', 'dist');
mkdirSync(OUT, { recursive: true });

// Seed K7QX2M deals 7♥ 2♣ 7♣ Q♣ K♣ 8♦ K♦ A♦ (sorted by suit, then rank).
const SEED = 'K7QX2M';
const SEED_HAND = ['7H', '2C', '7C', 'QC', 'KC', '8D', 'KD', 'AD'];

let server = null;
let base = process.env.BASE_URL;
if (!base) {
  const { preview } = await import('vite');
  server = await preview({ root: join(HERE, '..'), logLevel: 'silent', preview: { host: '127.0.0.1', port: 4180 } });
  base = server.resolvedUrls.local[0];
}
base = base.replace(/\/?$/, '/');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: (process.env.CHROMIUM_ARGS ?? '').split(' ').filter(Boolean),
});
const errors = [];
const results = [];

async function phone(width = 390, height = 844, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...options,
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${width}x${height}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${width}x${height}: ${error.message}`));
  return page;
}

async function open(page, seed = SEED) {
  await page.goto(`${base}?seed=${seed}`);
  await page.waitForSelector('[data-testid="hand"] [data-card]');
}

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
    console.log(`ok    ${name}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}\n      ${error.message.split('\n').join('\n      ')}`);
  }
}

const hand = (page) =>
  page.$$eval('[data-testid="hand"] [data-card]', (cards) =>
    cards.map((card) => ({ code: card.dataset.card, legal: card.dataset.legal === 'true' })),
  );
const legalCodes = async (page) => (await hand(page)).filter((card) => card.legal).map((card) => card.code).sort();
const codes = async (page) => (await hand(page)).map((card) => card.code);
const testText = (page, id) => page.textContent(`[data-testid="${id}"]`);
const chainLength = async (page) => Number(await page.getAttribute('[data-testid="chain"]', 'data-length'));
const tapCard = (page, code) => page.tap(`[data-testid="hand"] [data-card="${code}"]`);
const button = (page, name) => page.getByRole('button', { name, exact: false });
const shot = async (page, name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
};

async function expectLegal(page, expected) {
  assert.deepEqual(await legalCodes(page), [...expected].sort());
}

async function expectLive(page, value, mult) {
  assert.equal(await testText(page, 'value'), String(value));
  assert.equal(await testText(page, 'mult'), String(mult));
}

await check('a new table shows the top bar, the hand and the buttons', async () => {
  const page = await phone();
  await open(page);
  assert.deepEqual(await codes(page), SEED_HAND);
  await expectLegal(page, SEED_HAND);
  assert.equal(await testText(page, 'target'), '150');
  assert.equal(await testText(page, 'total'), '0');
  assert.equal(await testText(page, 'chains'), '3');
  assert.equal(await testText(page, 'redraws'), '2');
  assert.equal(await testText(page, 'money'), '$4');
  assert.equal(await testText(page, 'seed'), `Seed ${SEED}`);
  assert.equal(await button(page, 'Undo').isDisabled(), true);
  assert.equal(await button(page, 'Play chain').isDisabled(), true);
  assert.equal(await button(page, 'Redraw').isDisabled(), false);
  await shot(page, '01-start');
  await page.context().close();
});

await check('legal cards rise, illegal taps do nothing, 8s name a suit, undo works, a ring clears the table', async () => {
  const page = await phone();
  await open(page);

  await tapCard(page, '7C');
  assert.equal(await chainLength(page), 1);
  await expectLive(page, 7, 1);
  await expectLegal(page, ['7H', '2C', 'QC', 'KC', '8D']);

  // A dimmed card is aria-disabled, so Playwright needs force to tap it like a thumb would.
  await page.tap('[data-testid="hand"] [data-card="KD"]', { force: true });
  assert.equal(await chainLength(page), 1, 'an illegal tap must not change the chain');
  await expectLegal(page, ['7H', '2C', 'QC', 'KC', '8D']);

  await tapCard(page, '7H');
  await expectLive(page, 14, 2);
  await expectLegal(page, ['8D']);

  await tapCard(page, '8D');
  const picker = page.getByRole('dialog');
  await picker.waitFor();
  assert.match(await picker.textContent(), /8 of diamonds/);
  assert.equal(await page.locator('.suit-btn:enabled').count(), 4);
  await shot(page, '02-eight-picker');
  await page.tap('.sheet-cancel');
  await picker.waitFor({ state: 'detached' });
  assert.equal(await chainLength(page), 2, 'Cancel must not add the 8');

  await tapCard(page, '8D');
  await page.tap('[data-suit="D"]');
  assert.equal(await chainLength(page), 3);
  await expectLive(page, 22, 3);
  await expectLegal(page, ['KD', 'AD']);

  await button(page, 'Undo').tap();
  assert.equal(await chainLength(page), 2);
  await expectLive(page, 14, 2);
  await expectLegal(page, ['8D']);

  await tapCard(page, '8D');
  await page.tap('[data-suit="C"]');
  await expectLegal(page, ['2C', 'QC', 'KC']);
  assert.equal(await page.getAttribute('[data-testid="ring"]', 'data-on'), 'false');

  await tapCard(page, 'KC');
  await expectLive(page, 32, 3);
  assert.equal(await page.getAttribute('[data-testid="ring"]', 'data-on'), 'true');
  await shot(page, '03-ring');

  await button(page, 'Play chain').tap();
  const end = page.getByTestId('table-end');
  await end.waitFor();
  assert.equal(await end.getAttribute('data-status'), 'cleared');
  assert.equal(await testText(page, 'total'), '192', '32 × 3 × 2 = 192');
  assert.equal(await testText(page, 'chains'), '2');
  await shot(page, '04-cleared');

  await button(page, 'New table').tap();
  await end.waitFor({ state: 'detached' });
  assert.equal(await testText(page, 'total'), '0');
  assert.notEqual(await testText(page, 'seed'), `Seed ${SEED}`);
  await page.context().close();
});

await check('redraw selects cards, Cancel keeps the hand, Confirm draws back to 8', async () => {
  const page = await phone();
  await open(page);

  await button(page, 'Redraw').tap();
  assert.equal(await button(page, 'Confirm').isDisabled(), true);
  await tapCard(page, '2C');
  await tapCard(page, 'AD');
  assert.equal(await page.getAttribute('[data-card="2C"]', 'aria-pressed'), 'true');
  assert.equal(await button(page, 'Confirm').textContent(), 'Confirm (2)');
  await shot(page, '05-redraw-mode');
  await button(page, 'Cancel').tap();
  assert.deepEqual(await codes(page), SEED_HAND);
  assert.equal(await testText(page, 'redraws'), '2');

  await button(page, 'Redraw').tap();
  await tapCard(page, '2C');
  await tapCard(page, 'AD');
  await button(page, 'Confirm').tap();
  assert.equal(await testText(page, 'redraws'), '1');
  const after = await codes(page);
  assert.equal(after.length, 8);
  assert.ok(!after.includes('2C') && !after.includes('AD'), `discarded cards came back: ${after.join(' ')}`);

  await tapCard(page, after[0]);
  assert.equal(await button(page, 'Redraw').isDisabled(), true, 'no redraw while a chain is in progress');
  await button(page, 'Undo').tap();
  assert.equal(await button(page, 'Redraw').isDisabled(), false);

  await button(page, 'Redraw').tap();
  await tapCard(page, after[1]);
  await button(page, 'Confirm').tap();
  assert.equal(await testText(page, 'redraws'), '0');
  assert.equal(await button(page, 'Redraw').isDisabled(), true);
  await page.context().close();
});

await check('three weak chains end the run with a loss', async () => {
  const page = await phone();
  await open(page);
  for (let i = 0; i < 3; i += 1) {
    const [first] = (await hand(page)).filter((card) => card.legal);
    await tapCard(page, first.code);
    await button(page, 'Play chain').tap();
  }
  const end = page.getByTestId('table-end');
  await end.waitFor();
  assert.equal(await end.getAttribute('data-status'), 'lost');
  assert.match(await end.textContent(), /The run ends/);
  assert.equal(await testText(page, 'chains'), '0');
  await shot(page, '06-lost');
  await page.context().close();
});

for (const [width, height] of [
  [390, 844],
  [375, 667],
  [360, 740],
  [430, 932],
]) {
  await check(`layout at ${width}x${height}: 44 px targets, action bar low, no scroll`, async () => {
    const page = await phone(width, height);
    await open(page);

    const measure = () =>
      page.$$eval('button', (buttons) =>
        buttons
          .filter((b) => b.offsetParent !== null)
          .map((b) => {
            const r = b.getBoundingClientRect();
            return { label: b.getAttribute('aria-label') || b.textContent.trim(), w: r.width, h: r.height };
          }),
      );
    const small = (list) => list.filter((b) => b.w < 44 || b.h < 44);

    const onTable = await measure();
    assert.ok(onTable.length >= 11, `expected the hand and 3 buttons, got ${onTable.length}`);
    assert.deepEqual(small(onTable), [], 'every tap target must be at least 44 by 44');

    const bar = await page.$eval('.actions', (el) => el.getBoundingClientRect().top);
    assert.ok(bar >= (height * 2) / 3, `the action bar starts at ${bar}, above the lower third`);

    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth,
      innerHeight,
    }));
    assert.ok(size.scrollWidth <= size.innerWidth, `page is ${size.scrollWidth} px wide`);
    assert.ok(size.scrollHeight <= size.innerHeight, `page is ${size.scrollHeight} px tall`);

    const cards = await page.$$eval('[data-testid="hand"] [data-card]', (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    const chainBottom = await page.$eval('.chain-area', (el) => el.getBoundingClientRect().bottom);
    assert.ok(Math.min(...cards.map((c) => c.top)) >= chainBottom - 10, 'raised cards must not cover the chain area');

    await tapCard(page, '8D');
    await page.getByRole('dialog').waitFor();
    assert.deepEqual(small(await measure()), [], 'suit buttons must be at least 44 by 44');
    await shot(page, `07-layout-${width}x${height}`);
    await page.context().close();
  });
}

await check('reduced motion still plays a table', async () => {
  const page = await phone(390, 844, { reducedMotion: 'reduce' });
  await open(page);
  await tapCard(page, '7C');
  await tapCard(page, '7H');
  assert.equal(await chainLength(page), 2);
  await page.context().close();
});

if (!process.env.BASE_URL) {
  await check('the build holds no image or audio files', async () => {
    const media = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|mp3|wav|ogg|m4a|aac|flac|webm|mp4)$/i;
    const walk = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const files = walk(DIST);
    assert.ok(files.length > 0, 'dist/ is empty: run the build first');
    assert.deepEqual(files.filter((file) => media.test(extname(file)) || media.test(file)), []);
  });
}

await check('no console errors', async () => {
  assert.deepEqual(errors, []);
});

await browser.close();
await server?.close();

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots: ${OUT}`);
process.exit(failed.length > 0 ? 1 : 0);
