// Browser check for one table, played by touch on phone-sized screens.
// Seed K7QX2M deals 7♠ 8♠ 5♥ A♥ 6♣ A♣ 6♦ 7♦ at the first table (sorted by suit, then rank).

import assert from 'node:assert/strict';
import { distFiles, expectGoodLayout, PHONES, shot, startSession } from './lib.mjs';

const SEED = 'K7QX2M';
const SEED_HAND = ['7S', '8S', '5H', 'AH', '6C', 'AC', '6D', '7D'];

const session = await startSession();
const { check } = session;

async function open(page, seed = SEED) {
  await page.goto(`${session.base}?seed=${seed}`);
  await page.getByRole('button', { name: 'Start table 1' }).tap();
  await page.waitForSelector('[data-testid="hand"] [data-card]');
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

async function expectLegal(page, expected) {
  assert.deepEqual(await legalCodes(page), [...expected].sort());
}

async function expectLive(page, value, mult) {
  assert.equal(await testText(page, 'value'), String(value));
  assert.equal(await testText(page, 'mult'), String(mult));
}

await check('a new table shows the top bar, the charm slots, the hand and the buttons', async () => {
  const page = await session.phone();
  await open(page);
  assert.deepEqual(await codes(page), SEED_HAND);
  await expectLegal(page, SEED_HAND);
  assert.equal(await testText(page, 'target'), '150');
  assert.equal(await testText(page, 'total'), '0');
  assert.equal(await testText(page, 'chains'), '3');
  assert.equal(await testText(page, 'redraws'), '2');
  assert.equal(await testText(page, 'money'), '$4');
  assert.equal(await testText(page, 'seed'), `Seed ${SEED}`);
  assert.equal(await page.locator('.charm-board .slot').count(), 5);
  assert.equal(await page.locator('[data-testid="host-banner"]').count(), 0);
  assert.equal(await button(page, 'Undo').isDisabled(), true);
  assert.equal(await button(page, 'Play chain').isDisabled(), true);
  assert.equal(await button(page, 'Redraw').isDisabled(), false);
  await shot(page, 'table-01-start');
  await page.context().close();
});

await check('legal cards rise, illegal taps do nothing, 8s name a suit, undo works, a ring clears the table', async () => {
  const page = await session.phone();
  await open(page);

  await tapCard(page, '6C');
  assert.equal(await chainLength(page), 1);
  await expectLive(page, 6, 1);
  await expectLegal(page, ['AC', '6D', '8S']);

  // A dimmed card is aria-disabled, so Playwright needs force to tap it like a thumb would.
  await page.tap('[data-testid="hand"] [data-card="5H"]', { force: true });
  assert.equal(await chainLength(page), 1, 'an illegal tap must not change the chain');

  await tapCard(page, '6D');
  await expectLive(page, 12, 2);
  await expectLegal(page, ['7D', '8S']);

  await tapCard(page, '8S');
  const picker = page.getByTestId('suit-picker');
  await picker.waitFor();
  assert.match(await picker.textContent(), /8 of spades/);
  assert.equal(await picker.locator('.suit-btn:enabled').count(), 4);
  await shot(page, 'table-02-eight-picker');
  await picker.getByRole('button', { name: 'Cancel' }).tap();
  await picker.waitFor({ state: 'detached' });
  assert.equal(await chainLength(page), 2, 'Cancel must not add the 8');

  await tapCard(page, '8S');
  await page.tap('[data-testid="suit-picker"] [data-suit="H"]');
  await expectLive(page, 20, 3);
  await expectLegal(page, ['5H', 'AH']);

  await button(page, 'Undo').tap();
  assert.equal(await chainLength(page), 2);
  await expectLive(page, 12, 2);
  await expectLegal(page, ['7D', '8S']);

  await tapCard(page, '7D');
  await tapCard(page, '7S');
  await expectLive(page, 26, 3);
  await tapCard(page, '8S');
  await page.tap('[data-testid="suit-picker"] [data-suit="C"]');
  await expectLive(page, 34, 4);
  await expectLegal(page, ['AC']);
  assert.equal(await page.getAttribute('[data-testid="ring"]', 'data-on'), 'false');

  await tapCard(page, 'AC');
  await expectLive(page, 45, 4);
  assert.equal(await page.getAttribute('[data-testid="ring"]', 'data-on'), 'true');
  await shot(page, 'table-03-ring');

  await button(page, 'Play chain').tap();
  const cleared = page.getByTestId('cleared-panel');
  await cleared.waitFor();
  assert.equal(await testText(page, 'total'), '360', '45 × 4 × 2 = 360');
  assert.equal(await testText(page, 'chains'), '2');
  assert.equal(await testText(page, 'payout-total'), '$5', '$3 for the table and $2 for unused chains');
  assert.equal(await testText(page, 'money'), '$9');
  await shot(page, 'table-04-cleared');

  await button(page, 'Open the shop').tap();
  await page.getByTestId('shop').waitFor();
  await page.context().close();
});

await check('redraw selects cards, Cancel keeps the hand, Confirm draws back to 8', async () => {
  const page = await session.phone();
  await open(page);

  await button(page, 'Redraw').tap();
  assert.equal(await button(page, 'Confirm').isDisabled(), true);
  await tapCard(page, '5H');
  await tapCard(page, 'AH');
  assert.equal(await page.getAttribute('[data-card="5H"]', 'aria-pressed'), 'true');
  assert.equal(await button(page, 'Confirm').textContent(), 'Confirm (2)');
  await shot(page, 'table-05-redraw-mode');
  await button(page, 'Cancel').tap();
  assert.deepEqual(await codes(page), SEED_HAND);
  assert.equal(await testText(page, 'redraws'), '2');

  await button(page, 'Redraw').tap();
  await tapCard(page, '5H');
  await tapCard(page, 'AH');
  await button(page, 'Confirm').tap();
  assert.equal(await testText(page, 'redraws'), '1');
  const after = await codes(page);
  assert.equal(after.length, 8);
  assert.ok(!after.includes('5H') && !after.includes('AH'), `discarded cards came back: ${after.join(' ')}`);

  const [first] = (await hand(page)).filter((card) => card.legal && !card.code.startsWith('8'));
  await tapCard(page, first.code);
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

await check('three weak chains end the run on the run end screen', async () => {
  const page = await session.phone();
  await open(page);
  for (let i = 0; i < 3; i += 1) {
    const [first] = (await hand(page)).filter((card) => card.legal && !card.code.startsWith('8'));
    await tapCard(page, first.code);
    await button(page, 'Play chain').tap();
  }
  const end = page.getByTestId('run-end');
  await end.waitFor();
  assert.equal(await end.getAttribute('data-result'), 'lost');
  assert.match(await end.textContent(), /The run ends/);
  assert.equal(await testText(page, 'stop-reached'), '1 of 8');
  assert.equal(await testText(page, 'end-seed'), SEED);
  await shot(page, 'table-06-lost');
  await button(page, 'New run').tap();
  await page.getByTestId('start').waitFor();
  await page.context().close();
});

for (const [width, height] of PHONES) {
  await check(`layout at ${width}x${height}: 44 px targets, action bar low, no scroll`, async () => {
    const page = await session.phone(width, height);
    await open(page);
    await expectGoodLayout(page, 'table');

    const bar = await page.$eval('.actions', (el) => el.getBoundingClientRect().top);
    assert.ok(bar >= (height * 2) / 3, `the action bar starts at ${bar}, above the lower third`);

    const top = await page.$$eval('[data-testid="hand"] [data-card]', (els) =>
      Math.min(...els.map((el) => el.getBoundingClientRect().top)),
    );
    const chainBottom = await page.$eval('.chain-area', (el) => el.getBoundingClientRect().bottom);
    assert.ok(top >= chainBottom - 10, 'raised cards must not cover the chain area');

    await tapCard(page, '8S');
    await page.getByTestId('suit-picker').waitFor();
    await expectGoodLayout(page, 'suit picker');
    await shot(page, `table-07-layout-${width}x${height}`);
    await page.context().close();
  });
}

await check('reduced motion still plays a table', async () => {
  const page = await session.phone(390, 844, { reducedMotion: 'reduce' });
  await open(page);
  await tapCard(page, '6C');
  await tapCard(page, '6D');
  assert.equal(await chainLength(page), 2);
  await page.context().close();
});

if (!process.env.BASE_URL) {
  await check('the build holds no image or audio files', async () => {
    const media = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|mp3|wav|ogg|m4a|aac|flac|webm|mp4)$/i;
    const files = distFiles();
    assert.ok(files.length > 0, 'dist/ is empty: run the build first');
    assert.deepEqual(files.filter((file) => media.test(file)), []);
  });
}

await check('no console errors', async () => {
  assert.deepEqual(session.errors, []);
});

process.exit((await session.finish()) > 0 ? 1 : 0);
