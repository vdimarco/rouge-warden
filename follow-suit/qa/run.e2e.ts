// Browser check for a full run, played by touch at 390 by 844.
//
// A fixed policy plays the run: the best chain each turn, then simple shop choices. The check first plays
// that policy on the engine alone and picks a seed that reaches stop 2. Then it plays the same steps on
// screen. After each tap it compares the screen with an engine copy of the run (the mirror).
//
//   npx tsx qa/run.e2e.ts   (npm run qa runs it after the build)

import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import {
  availableCards,
  beginTable,
  bestChain,
  buyCharm,
  buyStamp,
  charmBuyStatus,
  CHARMS,
  HOSTS,
  leaveShop,
  legalCardIds,
  moveCharm,
  needsNamedSuit,
  newRun,
  openShop,
  ownedCharmIds,
  previewChain,
  reroll,
  rerollCost,
  runAddCard,
  runPlay,
  runRules,
  sellCharm,
  SLOT_IDS,
  stampBuyStatus,
  stopTargets,
  SUITS,
  type RunState,
  type SlotId,
  type StampUse,
  type Suit,
} from '../src/engine';
import { expectGoodLayout, PHONES, shot, startSession } from './lib.mjs';

type Step =
  | { kind: 'begin' }
  | { kind: 'chain'; cards: { id: string; suit?: Suit }[] }
  | { kind: 'openShop' }
  | { kind: 'deck' }
  | { kind: 'buyCharm'; offer: number }
  | { kind: 'stamp'; offer: number; use: StampUse }
  | { kind: 'reroll' }
  | { kind: 'move'; from: Suit; to: Suit }
  | { kind: 'sell'; slot: SlotId }
  | { kind: 'leave' };

/** Applies one step to the engine copy of the run. */
function apply(run: RunState, step: Step): RunState {
  switch (step.kind) {
    case 'begin':
      return beginTable(run);
    case 'chain': {
      let next = run;
      for (const card of step.cards) next = runAddCard(next, card.id, card.suit);
      return runPlay(next);
    }
    case 'openShop':
      return openShop(run);
    case 'deck':
      return run;
    case 'buyCharm':
      return buyCharm(run, step.offer);
    case 'stamp':
      return buyStamp(run, step.offer, step.use);
    case 'reroll':
      return reroll(run);
    case 'move':
      return moveCharm(run, step.from, step.to);
    case 'sell':
      return sellCharm(run, step.slot);
    case 'leave':
      return leaveShop(run);
  }
}

function stampFor(run: RunState, offer: number): StampUse {
  const o = run.shop!.offers[offer];
  if (o.kind !== 'stamp') throw new Error('not a stamp');
  const [first, second] = run.deck;
  switch (o.id) {
    case 'suit':
      return { id: 'suit', cardId: first.id, suit: first.suit === 'H' ? 'S' : 'H' };
    case 'copy':
      return { id: 'copy', fromId: first.id, toId: second.id };
    case 'eight':
      return { id: 'eight', suit: 'S' };
    case 'burn':
      return { id: 'burn', cardId: first.id };
  }
}

/** The shop choices for one visit. The first two shops also try the deck view, move and sell. */
function shopSteps(run: RunState, visit: number): Step[] {
  const steps: Step[] = [];
  let state = run;
  const push = (step: Step) => {
    steps.push(step);
    state = apply(state, step);
  };
  if (visit === 0) push({ kind: 'deck' });
  const charm = state.shop!.offers.findIndex((_, i) => charmBuyStatus(state, i) === 'ok');
  if (charm >= 0) push({ kind: 'buyCharm', offer: charm });
  const stamp = state.shop!.offers.findIndex((_, i) => stampBuyStatus(state, i) === 'ok');
  if (stamp >= 0) push({ kind: 'stamp', offer: stamp, use: stampFor(state, stamp) });
  if (state.money >= rerollCost(state.shop!.rerolls) + 4) push({ kind: 'reroll' });
  if (visit === 0) {
    const from = SUITS.find((suit) => state.charms[suit] !== null);
    const to = SUITS.find((suit) => suit !== from);
    if (from && to) push({ kind: 'move', from, to });
  }
  if (visit === 1) {
    const slot = SLOT_IDS.find((s) => state.charms[s] !== null);
    if (slot) push({ kind: 'sell', slot });
  }
  push({ kind: 'leave' });
  return steps;
}

/** Plays the policy on the engine to the end of the run. */
function plan(seed: string): { steps: Step[]; end: RunState } {
  let run = newRun(seed);
  const steps: Step[] = [];
  let visits = 0;
  const push = (step: Step) => {
    steps.push(step);
    run = apply(run, step);
  };
  while (run.phase !== 'won' && run.phase !== 'lost') {
    if (run.phase === 'intro') push({ kind: 'begin' });
    else if (run.phase === 'cleared') push({ kind: 'openShop' });
    else if (run.phase === 'shop') {
      for (const step of shopSteps(run, visits)) push(step);
      visits += 1;
    } else {
      const table = run.table!;
      const rules = runRules(run);
      const best = bestChain(availableCards(table), rules, { charms: run.charms, handSize: table.hand.length })!;
      push({
        kind: 'chain',
        cards: best.links.map((link) => ({ id: link.card.id, suit: needsNamedSuit(link.card, rules) ? link.suit : undefined })),
      });
    }
  }
  return { steps, end: run };
}

function findSeed(): { seed: string; steps: Step[]; end: RunState } {
  for (let i = 1; i <= 500; i += 1) {
    const seed = `QA${String(i).padStart(4, '0')}`;
    const result = plan(seed);
    const usedShops = result.steps.filter((s) => s.kind === 'openShop').length;
    if (result.end.stop >= 2 && usedShops >= 3) return { seed, ...result };
  }
  throw new Error('No seed in QA0001 to QA0500 reaches stop 2');
}

const session = await startSession();
const { check } = session;
const { seed, steps, end } = findSeed();
console.log(`seed ${seed}: ${steps.length} steps, the run ends ${end.phase} at stop ${end.stop}`);

const text = (page: Page, id: string) => page.textContent(`[data-testid="${id}"]`);

async function waitText(page: Page, id: string, expected: string) {
  await page.waitForFunction(
    ([testId, want]) => document.querySelector(`[data-testid="${testId}"]`)?.textContent === want,
    [id, expected],
    { timeout: 15_000 },
  );
}

async function expectTable(page: Page, run: RunState) {
  const table = run.table!;
  await waitText(page, 'total', table.total.toLocaleString('en-US'));
  assert.equal(await text(page, 'target'), table.target.toLocaleString('en-US'));
  assert.equal(await text(page, 'chains'), String(table.chainsLeft));
  assert.equal(await text(page, 'money'), `$${run.money}`);
  const ids = await page.$$eval('[data-testid="hand"] [data-id]', (els) => els.map((el) => (el as HTMLElement).dataset.id));
  const expectedIds = table.hand.filter((c) => !table.chain.some((l) => l.card.id === c.id)).map((c) => c.id);
  assert.deepEqual(ids, expectedIds, 'the hand on screen must match the engine');
  const legal = await page.$$eval('[data-testid="hand"] [data-legal="true"]', (els) =>
    els.map((el) => (el as HTMLElement).dataset.id),
  );
  assert.deepEqual(legal.sort(), [...legalCardIds(table, run.charms)].sort(), 'legal cards must match the engine');
  assert.equal(await page.locator('[data-testid="host-banner"]').count(), table.host ? 1 : 0);
  if (table.host) assert.match((await text(page, 'host-banner'))!, new RegExp(HOSTS[table.host].name));
}

async function expectShop(page: Page, run: RunState) {
  await waitText(page, 'money', `$${run.money}`);
  const offers = await page.$$eval('[data-offer]', (els) => els.map((el) => (el as HTMLElement).dataset.offer));
  assert.deepEqual(offers, run.shop!.offers.map((o) => o.id), 'offers must match the engine');
  for (const slot of SLOT_IDS) {
    const label = await page.getAttribute(`[data-slot="${slot}"]`, 'aria-label');
    const charm = run.charms[slot];
    assert.ok(label!.endsWith(charm ? CHARMS[charm.id].name : 'empty'), `slot ${slot}: ${label}`);
  }
  assert.equal(await page.getAttribute('.deck-btn', 'aria-label'), `Deck, ${run.deck.length} cards`);
}

async function checkSizes(page: Page, label: string) {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await expectGoodLayout(page, label);
    await shot(page, `run-${label}-${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

await check('the start screen starts a run from a typed seed', async () => {
  const page = await session.phone();
  await page.goto(session.base);
  await page.getByTestId('start').waitFor();
  await checkSizes(page, 'start');
  assert.equal(await page.getByRole('button', { name: 'Play seed' }).isDisabled(), true);
  await page.tap('#seed-input');
  await page.keyboard.type(seed.toLowerCase());
  await page.getByRole('button', { name: 'Play seed' }).tap();
  await page.getByTestId('stop-intro').waitFor();
  assert.match((await page.textContent('.intro-head'))!, new RegExp(`Seed ${seed}`));
  await page.context().close();
});

await check(`a full run on seed ${seed} matches the engine at every step`, async () => {
  const page = await session.phone();
  await page.goto(`${session.base}?seed=${seed}`);
  let mirror = newRun(seed);
  let checkedHost = false;
  let checkedShop = false;
  let checkedCharmSheet = false;

  for (const step of steps) {
    switch (step.kind) {
      case 'begin': {
        await page.getByTestId('stop-intro').waitFor();
        const host = HOSTS[mirror.hosts[mirror.stop - 1]];
        assert.match((await page.textContent('.intro-kicker'))!, new RegExp(`Stop ${mirror.stop} of 8`));
        assert.equal(await page.getAttribute('[data-testid="intro-host"]', 'data-host'), host.id);
        const targets = await page.$$eval('.targets b', (els) => els.map((el) => el.textContent));
        assert.deepEqual(targets, stopTargets(mirror.stop, host.id).map((t) => t.toLocaleString('en-US')));
        if (mirror.stop === 1) await checkSizes(page, 'intro');
        await page.getByRole('button', { name: 'Start table 1' }).tap();
        mirror = apply(mirror, step);
        await expectTable(page, mirror);
        break;
      }
      case 'chain': {
        if (!checkedCharmSheet && ownedCharmIds(mirror.charms).length > 0) {
          const slot = SLOT_IDS.find((s) => mirror.charms[s] !== null)!;
          await page.tap(`[data-slot="${slot}"]`);
          const sheet = page.getByTestId('charm-sheet');
          await sheet.waitFor();
          assert.match((await sheet.textContent())!, new RegExp(CHARMS[mirror.charms[slot]!.id].name));
          await sheet.getByRole('button', { name: 'Close' }).tap();
          await sheet.waitFor({ state: 'detached' });
          checkedCharmSheet = true;
        }
        if (!checkedHost && mirror.table!.host !== null && mirror.table!.chain.length === 0) {
          await checkSizes(page, 'host-table');
          checkedHost = true;
        }
        for (const card of step.cards) {
          await page.tap(`[data-testid="hand"] [data-id="${card.id}"]`);
          if (card.suit) await page.tap(`[data-testid="suit-picker"] [data-suit="${card.suit}"]`);
          mirror = { ...mirror, table: runAddCard(mirror, card.id, card.suit).table };
          const preview = previewChain(mirror.table!.chain);
          assert.equal(await text(page, 'value'), preview.value.toLocaleString('en-US'));
          assert.equal(await text(page, 'mult'), preview.mult.toLocaleString('en-US'));
          assert.equal(await page.getAttribute('[data-testid="ring"]', 'data-on'), String(preview.ring));
          await expectTable(page, mirror);
        }
        await page.getByRole('button', { name: 'Play chain' }).tap();
        mirror = runPlay(mirror);
        if (mirror.phase === 'table') await expectTable(page, mirror);
        if (mirror.phase === 'cleared') {
          await page.getByTestId('cleared-panel').waitFor();
          await waitText(page, 'payout-total', `$${mirror.lastPayout!.total}`);
          await expectTable(page, mirror);
        }
        if (mirror.phase === 'lost' || mirror.phase === 'won') {
          const endScreen = page.getByTestId('run-end');
          await endScreen.waitFor({ timeout: 15_000 });
          assert.equal(await endScreen.getAttribute('data-result'), mirror.phase);
          assert.equal(await text(page, 'stop-reached'), `${mirror.stop} of 8`);
          assert.equal(await text(page, 'best-chain'), mirror.bestChain.toLocaleString('en-US'));
          assert.equal(await text(page, 'end-seed'), seed);
          await checkSizes(page, 'run-end');
        }
        break;
      }
      case 'openShop':
        await page.getByRole('button', { name: 'Open the shop' }).tap();
        mirror = apply(mirror, step);
        await page.getByTestId('shop').waitFor();
        await expectShop(page, mirror);
        if (!checkedShop) {
          await checkSizes(page, 'shop');
          checkedShop = true;
        }
        break;
      case 'deck': {
        await page.tap('.deck-btn');
        const view = page.getByTestId('deck-view');
        await view.waitFor();
        assert.equal(await view.locator('.deck-card').count(), mirror.deck.length);
        await checkSizes(page, 'deck-view');
        await view.getByRole('button', { name: 'Close' }).tap();
        await view.waitFor({ state: 'detached' });
        break;
      }
      case 'buyCharm': {
        const offer = mirror.shop!.offers[step.offer];
        await page.tap(`[data-offer="${offer.id}"] button.buy`);
        mirror = apply(mirror, step);
        await expectShop(page, mirror);
        break;
      }
      case 'stamp': {
        const offer = mirror.shop!.offers[step.offer];
        await page.tap(`[data-offer="${offer.id}"] button.buy`);
        const picker = page.getByTestId('stamp-picker');
        await picker.waitFor();
        const use = step.use;
        const cardsToTap = use.id === 'copy' ? [use.fromId, use.toId] : 'cardId' in use ? [use.cardId] : [];
        for (const id of cardsToTap) await picker.locator(`[data-id="${id}"]`).tap();
        if ('suit' in use) await picker.locator(`[data-suit="${use.suit}"]`).tap();
        assert.notEqual((await text(page, 'stamp-preview'))!.trim(), '', 'the picker must preview the stamp');
        if (!checkedShop || use.id === 'copy') await checkSizes(page, `stamp-${use.id}`);
        await picker.getByRole('button', { name: /^Use for/ }).tap();
        await picker.waitFor({ state: 'detached' });
        mirror = apply(mirror, step);
        await expectShop(page, mirror);
        break;
      }
      case 'reroll':
        await page.getByRole('button', { name: /^Reroll/ }).tap();
        mirror = apply(mirror, step);
        await expectShop(page, mirror);
        break;
      case 'move':
        await page.tap(`[data-slot="${step.from}"]`);
        await page.getByTestId('slot-details').waitFor();
        await page.tap(`[data-slot="${step.to}"]`);
        mirror = apply(mirror, step);
        await expectShop(page, mirror);
        break;
      case 'sell':
        await page.tap(`[data-slot="${step.slot}"]`);
        await page.getByRole('button', { name: /^Sell for/ }).tap();
        mirror = apply(mirror, step);
        await expectShop(page, mirror);
        break;
      case 'leave':
        await page.getByRole('button', { name: /^(Next table|Go to stop)/ }).tap();
        mirror = apply(mirror, step);
        if (mirror.phase === 'table') await expectTable(page, mirror);
        break;
    }
  }
  assert.ok(checkedHost, 'the run must reach a host table');
  assert.equal(mirror.phase, end.phase);
  await page.getByRole('button', { name: 'New run' }).tap();
  await page.getByTestId('start').waitFor();
  await page.context().close();
});

await check('no console errors', async () => {
  assert.deepEqual(session.errors, []);
});

process.exit((await session.finish()) > 0 ? 1 : 0);
