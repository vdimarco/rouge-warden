// Browser check for the score reveal, the sounds, the mute toggle and reduced motion.
// Seed K7QX2M: 6♣ 6♦ 7♦ 7♠ 8♠ (naming clubs) A♣ is a ring with 3 switches. Value 45, Mult (1 + 3) × 2 = 8, score 360.

import assert from 'node:assert/strict';
import { expectGoodLayout, PHONES, shot, startSession } from './lib.mjs';

const SEED = 'K7QX2M';
const CHAIN = ['6C', '6D', '7D', '7S', ['8S', 'C'], 'AC'];

const session = await startSession();
const { check } = session;

/** Records every oscillator start (frequency and wave) and every reveal pop with its time. */
function spy() {
  window.__notes = [];
  window.__pops = [];
  window.__mults = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    window.__notes.push({ hz: Math.round(this.frequency.value * 100) / 100, type: this.type });
    return start.apply(this, args);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        for (const pop of [node, ...node.querySelectorAll('[data-testid$="-pop"]')]) {
          if (pop.matches?.('[data-testid$="-pop"]')) {
            window.__pops.push({ text: pop.textContent, where: pop.dataset.testid, at: performance.now() });
          }
        }
      }
      const mult = document.querySelector('[data-testid="mult"]');
      if (mult && window.__mults[window.__mults.length - 1] !== mult.textContent) window.__mults.push(mult.textContent);
    }
  }).observe(document, { childList: true, subtree: true, characterData: true });
}

async function open(page) {
  await page.addInitScript(spy);
  await page.goto(`${session.base}?seed=${SEED}`);
  await page.getByRole('button', { name: 'Start table 1' }).tap();
  await page.waitForSelector('[data-testid="hand"] [data-card]');
}

async function buildChain(page) {
  for (const entry of CHAIN) {
    const [code, suit] = Array.isArray(entry) ? entry : [entry];
    await page.tap(`[data-testid="hand"] [data-card="${code}"]`);
    if (suit) await page.tap(`[data-testid="suit-picker"] [data-suit="${suit}"]`);
  }
}

/** Clears the spies, so they record only what the reveal does. */
const resetSpies = (page) =>
  page.evaluate(() => {
    window.__notes = [];
    window.__pops = [];
    window.__mults = [document.querySelector('[data-testid="mult"]')?.textContent];
  });

const hz = (step) => 392 * 2 ** ([0, 2, 4, 5, 7, 9, 11][step % 7] / 12 + Math.floor(step / 7));
const near = (actual, expected) =>
  actual.length === expected.length && actual.every((value, i) => Math.abs(value - expected[i]) < 0.05);

const settle = (page) => page.waitForFunction(() => !document.querySelector('[data-revealing="true"]'), null, { timeout: 15_000 });

await check('the reveal scores each card in order, bumps Mult on each switch, rings, and counts the total up', async () => {
  const page = await session.phone();
  await open(page);
  await buildChain(page);

  const totals = new Set();
  const watch = setInterval(async () => {
    try {
      totals.add(await page.textContent('[data-testid="total"]'));
    } catch {
      // The page can be busy between frames.
    }
  }, 30);
  await resetSpies(page);
  await page.getByRole('button', { name: 'Play chain' }).tap();
  assert.equal(await page.getAttribute('.table-screen', 'data-revealing'), 'true');
  await page.waitForSelector('[data-ringed="true"]');
  await shot(page, 'feel-01-ring');
  await page.getByTestId('chain-score').waitFor();
  assert.equal(await page.textContent('[data-testid="chain-score"]'), 'Chain score 360');
  await settle(page);
  clearInterval(watch);

  const pops = await page.evaluate(() => window.__pops);
  const cardPops = pops.filter((p) => p.where === 'card-pop').map((p) => p.text);
  assert.deepEqual(cardPops, ['+6', '+6', '+1 Mult', '+7', '+7', '+1 Mult', '+8', '+1 Mult', '+11']);
  assert.deepEqual(pops.filter((p) => p.where === 'counter-pop').map((p) => p.text), ['Ring ×2']);

  const values = pops.filter((p) => p.where === 'card-pop' && !p.text.includes('Mult'));
  const gap = values[1].at - values[0].at;
  assert.ok(gap > 120 && gap < 300, `cards 1 and 2 scored ${Math.round(gap)} ms apart, not about 180 ms`);

  const mults = await page.evaluate(() => window.__mults);
  // The reveal starts from Mult 1, steps up at each switch and doubles at the ring. After the reveal the
  // empty chain shows Mult 1 again.
  const changes = mults.slice(1).filter((m, i, list) => m !== list[i - 1]);
  assert.deepEqual(changes.slice(0, 5), ['1', '2', '3', '4', '8']);

  assert.equal(await page.textContent('[data-testid="total"]'), '360');
  const middle = [...totals].filter((t) => t !== '0' && t !== '360');
  assert.ok(middle.length >= 2, `the total jumped instead of counting up: ${[...totals].join(', ')}`);
  await page.getByTestId('cleared-panel').waitFor();
  await page.context().close();
});

await check('each switch plays the next note of a major scale from the root, and the ring plays a chord', async () => {
  const page = await session.phone();
  await open(page);
  await buildChain(page);
  await resetSpies(page);
  await page.getByRole('button', { name: 'Play chain' }).tap();
  await settle(page);
  const notes = await page.evaluate(() => window.__notes);
  const switchNotes = notes.filter((n) => n.type === 'triangle').map((n) => n.hz);
  assert.ok(near(switchNotes, [hz(0), hz(1), hz(2)]), `switch notes ${switchNotes}: the root, then one step up each`);
  const chord = notes.filter((n) => n.type === 'sine').map((n) => n.hz).slice(-3);
  assert.ok(near(chord, [hz(7), hz(9), hz(11)]), `ring chord ${chord}: the root, third and fifth an octave up`);
  await page.context().close();
});

await check('cards cannot be tapped and buttons stay off while the reveal runs', async () => {
  const page = await session.phone();
  await open(page);
  await buildChain(page);
  await page.getByRole('button', { name: 'Play chain' }).tap();
  assert.equal(await page.getByRole('button', { name: 'Undo' }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Redraw' }).isDisabled(), true);
  await settle(page);
  await page.context().close();
});

await check('the mute toggle silences every sound and stays off after a reload', async () => {
  const page = await session.phone();
  await open(page);
  const toggle = page.getByTestId('sound-toggle');
  assert.equal(await toggle.getAttribute('aria-label'), 'Sound on');
  await toggle.tap();
  assert.equal(await toggle.getAttribute('aria-label'), 'Sound off');
  await buildChain(page);
  await resetSpies(page);
  await page.getByRole('button', { name: 'Play chain' }).tap();
  await settle(page);
  assert.deepEqual(await page.evaluate(() => window.__notes), []);

  await page.reload();
  await page.getByRole('button', { name: 'Start table 1' }).tap();
  assert.equal(await page.getByTestId('sound-toggle').getAttribute('aria-label'), 'Sound off');
  await page.getByTestId('sound-toggle').tap();
  assert.equal(await page.getByTestId('sound-toggle').getAttribute('aria-label'), 'Sound on');
  await page.context().close();
});

await check('with reduced motion the ring fades in place instead of moving the cards', async () => {
  const page = await session.phone(390, 844, { reducedMotion: 'reduce' });
  await open(page);
  await buildChain(page);
  await page.getByRole('button', { name: 'Play chain' }).tap();
  await page.waitForSelector('[data-ringed="true"]');
  await page.waitForTimeout(400);
  const row = page.getByTestId('chain');
  assert.match(await row.getAttribute('class'), /ring-fade/);
  assert.doesNotMatch(await row.getAttribute('class'), /ringed/);
  const slots = await page.$$eval('[data-testid="chain"] .chain-slot', (els) =>
    els.map((el) => ({ top: el.getBoundingClientRect().top, translate: getComputedStyle(el).translate })),
  );
  assert.ok(slots.every((slot) => slot.translate === 'none'), 'no card may move');
  const tops = slots.map((slot) => slot.top);
  assert.ok(Math.max(...tops) - Math.min(...tops) < 1, 'the cards must stay in one line');
  await shot(page, 'feel-02-reduced-motion-ring');
  await settle(page);
  await page.context().close();
});

for (const [width, height] of PHONES) {
  await check(`the ring stays clear of the hand and the page does not scroll at ${width}x${height}`, async () => {
    const page = await session.phone(width, height);
    await open(page);
    await buildChain(page);
    await page.getByRole('button', { name: 'Play chain' }).tap();
    await page.waitForSelector('[data-ringed="true"]');
    await page.waitForTimeout(650);
    const slots = await page.$$eval('[data-testid="chain"] .chain-slot', (els) => els.map((el) => el.getBoundingClientRect()));
    const tops = slots.map((r) => r.top);
    assert.ok(Math.max(...tops) - Math.min(...tops) >= 16, 'the cards must form a loop, not a line');
    const handTop = await page.$eval('[data-testid="hand"]', (el) => el.getBoundingClientRect().top);
    const boardBottom = await page.$eval('.charm-board', (el) => el.getBoundingClientRect().bottom);
    assert.ok(Math.max(...slots.map((r) => r.bottom)) <= handTop + 4, 'the ring must not cover the hand');
    assert.ok(Math.min(...slots.map((r) => r.top)) >= boardBottom - 4, 'the ring must not cover the charm board');
    assert.ok(Math.max(...slots.map((r) => r.right)) <= width && Math.min(...slots.map((r) => r.left)) >= 0, 'the ring must fit the width');
    await expectGoodLayout(page, 'ring');
    await shot(page, `feel-03-ring-${width}x${height}`);
    await settle(page);
    await page.context().close();
  });
}

await check('no console errors', async () => {
  assert.deepEqual(session.errors, []);
});

process.exit((await session.finish()) > 0 ? 1 : 0);
