// Browser check for the how-to-play explainer: when it opens, its controls, its numbers and notes, reduced motion and
// the layout on phones. It runs on the build in dist/, or on BASE_URL.

import assert from 'node:assert/strict';
import { expectGoodLayout, PHONES, shot, startSession } from './lib.mjs';

const SEED = 'K7QX2M';
const session = await startSession();
const { check } = session;

const fresh = (width = 390, height = 844, options = {}) => session.phone(width, height, { introSeen: false, ...options });
const title = (page) => page.textContent('[data-testid="ex-title"]');
const scene = (page) => page.getAttribute('[data-testid="explainer"]', 'data-scene').then(Number);
const button = (page, name) => page.getByRole('button', { name, exact: true });
const waitScene = (page, n, timeout = 10_000) =>
  page.waitForFunction((n) => document.querySelector('[data-testid="explainer"]')?.dataset.scene === String(n), n, { timeout });
/** How far the bar of a scene is filled, from 0 to 1. */
const bar = (page, i) =>
  page.$$eval('.ex-bar-fill', (fills, i) => Number(/scaleX\(([\d.]+)\)/.exec(fills[i].style.transform)?.[1] ?? 0), i);

async function next(page, times = 1) {
  for (let i = 0; i < times; i += 1) await page.getByRole('button', { name: /^(Next|Finish)$/ }).tap();
}

/** Records the pitch and wave of every note. */
function spy() {
  window.__notes = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    window.__notes.push({ hz: Math.round(this.frequency.value * 100) / 100, type: this.type });
    return start.apply(this, args);
  };
}
const hz = (step) => 392 * 2 ** ([0, 2, 4, 5, 7, 9, 11][step % 7] / 12 + Math.floor(step / 7));
const near = (actual, expected) => actual.length === expected.length && actual.every((value, i) => Math.abs(value - expected[i]) < 0.05);

await check('a first visit opens the explainer, and it plays by itself', async () => {
  const page = await fresh();
  await page.goto(session.base);
  await page.getByTestId('explainer').waitFor();
  assert.equal(await title(page), 'Build a chain');
  await shot(page, 'explainer-01-first-visit');
  await waitScene(page, 1);
  assert.equal(await title(page), 'Follow by suit or by rank');
  assert.equal(await bar(page, 0), 1);
  await page.context().close();
});

await check('Skip closes it, a reload opens the start screen, and How to play opens it again', async () => {
  const page = await fresh();
  await page.goto(session.base);
  await button(page, 'Skip').tap();
  await page.getByTestId('start').waitFor();
  await page.reload();
  await page.getByTestId('start').waitFor();
  assert.equal(await page.getByTestId('explainer').count(), 0);
  await button(page, '▶︎ How to play').tap();
  await page.getByTestId('explainer').waitFor();
  assert.equal(await scene(page), 0);
  await page.context().close();
});

await check('a seed link opens the stop intro of its run, not the explainer', async () => {
  const page = await fresh();
  await page.goto(`${session.base}?seed=${SEED}`);
  await page.getByTestId('stop-intro').waitFor();
  assert.equal(await page.getByTestId('explainer').count(), 0);
  await page.context().close();
});

await check('the end card lists the rules, and Play starts a new run', async () => {
  const page = await fresh();
  await page.goto(session.base);
  await next(page, 7);
  assert.equal(await title(page), 'Ready to play?');
  assert.equal(await page.locator('.ex-recap li').count(), 5);
  await shot(page, 'explainer-02-end');
  await button(page, 'Play').tap();
  await page.getByTestId('stop-intro').waitFor();
  await page.context().close();
});

await check('from a stop intro, How to play goes back to the same stop intro', async () => {
  const page = await session.phone();
  await page.goto(`${session.base}?seed=${SEED}`);
  const intro = page.getByTestId('stop-intro');
  await intro.waitFor();
  const before = await intro.textContent();
  await button(page, 'How to play').tap();
  await page.getByTestId('explainer').waitFor();
  await next(page, 7);
  await button(page, 'Back to the game').tap();
  await intro.waitFor();
  assert.equal(await intro.textContent(), before);
  await page.context().close();
});

await check('a finger held on the animation stops it, and it goes on after the finger lifts', async () => {
  const page = await fresh();
  await page.goto(session.base);
  const stage = await page.getByTestId('ex-stage').boundingBox();
  await page.waitForTimeout(800);
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const held = await bar(page, 0);
  await page.waitForTimeout(1_500);
  assert.ok(Math.abs((await bar(page, 0)) - held) < 0.005, 'the scene moved on while held');
  assert.equal(await page.getByText('Paused').count(), 1);
  await page.mouse.up();
  await page.waitForTimeout(800);
  assert.ok((await bar(page, 0)) > held + 0.05, 'the scene did not go on after the finger lifted');
  await page.context().close();
});

await check('the scoring scenes show the game numbers: Value 45 and Mult 4, Mult 8 with the ring, 360 against 150', async () => {
  const page = await fresh();
  await page.goto(session.base);
  await next(page, 3);
  assert.equal(await title(page), 'Value and Mult');
  await page.waitForFunction(() => document.querySelector('[data-testid="ex-value"] .num-figure')?.textContent === '45', null, { timeout: 9_000 });
  assert.equal(await page.textContent('[data-testid="ex-mult"] .num-figure'), '4');
  assert.equal(await page.locator('[data-card="8S"] .ex-badge').textContent(), '♣︎');
  await shot(page, 'explainer-03-value-mult');
  await next(page);
  await page.waitForFunction(() => document.querySelector('[data-testid="ex-mult"] .num-figure')?.textContent === '8', null, { timeout: 5_000 });
  await shot(page, 'explainer-04-ring');
  await next(page);
  await page.getByTestId('ex-cleared').waitFor({ timeout: 6_000 });
  assert.equal(await page.textContent('[data-testid="ex-score"]'), '360');
  assert.equal(await page.textContent('[data-testid="ex-target"]'), 'Target 150');
  assert.equal(await page.textContent('[data-testid="ex-total"]'), 'Total 360');
  await shot(page, 'explainer-05-target');
  await page.context().close();
});

await check('each change of suit plays the next note of the scale, and the ring plays its chord', async () => {
  const page = await fresh();
  await page.addInitScript(spy);
  await page.goto(session.base);
  await next(page, 3);
  await page.evaluate(() => {
    window.__notes = [];
  });
  await page.waitForTimeout(6_200);
  const switchNotes = await page.evaluate(() => window.__notes.filter((note) => note.type === 'triangle').map((note) => note.hz));
  assert.ok(near(switchNotes, [hz(0), hz(1), hz(2)]), `switch notes ${switchNotes}`);
  await next(page);
  await page.evaluate(() => {
    window.__notes = [];
  });
  await page.waitForTimeout(3_000);
  const chord = await page.evaluate(() => window.__notes.filter((note) => note.type === 'sine').map((note) => note.hz));
  assert.ok(near(chord, [hz(7), hz(9), hz(11)]), `ring chord ${chord}`);
  await page.context().close();
});

/** The places of the 7♠ while it joins the chain in scene 1, and its lowest opacity. */
async function journey(page) {
  const places = new Set();
  let faded = 1;
  const end = Date.now() + 1_400;
  while (Date.now() < end) {
    const seen = await page.evaluate(() => {
      const card = document.querySelector('[data-card="7S"]');
      const box = card.getBoundingClientRect();
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), opacity: Number(card.style.opacity) };
    });
    places.add(`${seen.x},${seen.y}`);
    faded = Math.min(faded, seen.opacity);
    await page.waitForTimeout(25);
  }
  return { places, faded };
}

await check('with reduced motion a card fades in at its place in the chain and never travels', async () => {
  const still = await fresh(390, 844, { reducedMotion: 'reduce' });
  await still.goto(session.base);
  await still.getByTestId('explainer').waitFor();
  await still.waitForTimeout(600);
  const calm = await journey(still);
  assert.ok(calm.places.size <= 2, `the card was seen at ${calm.places.size} places: ${[...calm.places].join(' ')}`);
  assert.ok(calm.faded < 0.9, 'the card did not fade in at its new place');
  await still.context().close();

  const moving = await fresh();
  await moving.goto(session.base);
  await moving.getByTestId('explainer').waitFor();
  await moving.waitForTimeout(600);
  const travel = await journey(moving);
  assert.ok(travel.places.size >= 4, `without reduced motion the card travels (${travel.places.size} places)`);
  await moving.context().close();
});

/** Fails when a visible card, chip, pop or panel leaves the animation area. */
async function expectInsideStage(page, label) {
  const outside = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="ex-stage"]').getBoundingClientRect();
    const parts = '.ex-card, .ex-chip, .ex-pop, .ex-live, .ex-shop, .ex-stamp, .ex-equation, .ex-note, .ex-stop, .ex-suit, .ex-ring';
    return [...document.querySelectorAll(parts)]
      .filter((el) => Number(getComputedStyle(el).opacity) > 0.05)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.left < stage.left - 1 || box.right > stage.right + 1 || box.top < stage.top - 1 || box.bottom > stage.bottom + 1)
      .map(({ el, box }) => `${el.className} ${el.textContent.trim().slice(0, 12)} (${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)})`);
  });
  assert.deepEqual(outside, [], `${label}: outside the animation area`);
}

await check('every card, chip, pop and panel stays inside the animation area in every scene', async () => {
  const page = await fresh(375, 667);
  await page.goto(session.base);
  await page.getByTestId('explainer').waitFor();
  // A moment with chips or pops, and a moment after the last move of each scene.
  const moments = [
    [2_700, 4_500],
    [2_600, 5_400],
    [2_950, 5_400],
    [2_300, 6_100],
    [1_000, 2_900],
    [2_400, 3_500],
    [3_400, 4_400],
  ];
  for (let s = 0; s < moments.length; s += 1) {
    if (s > 0) await next(page);
    const started = Date.now();
    for (const at of moments[s]) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - started)));
      await expectInsideStage(page, `scene ${s + 1} at ${at} ms`);
    }
  }
  await page.context().close();
});

for (const [width, height] of PHONES) {
  await check(`layout at ${width}x${height}: 44 px targets, no scroll, the animation, the caption and the buttons in order`, async () => {
    const page = await fresh(width, height);
    await page.goto(session.base);
    await page.getByTestId('explainer').waitFor();
    await next(page, 4);
    await page.waitForTimeout(400);
    await expectGoodLayout(page, 'explainer');
    const boxes = await page.evaluate(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      return { stage: box('[data-testid="ex-stage"]'), caption: box('.ex-caption'), actions: box('.ex-actions'), head: box('.ex-head') };
    });
    assert.ok(boxes.head.bottom <= boxes.stage.top, 'the header covers the animation');
    assert.ok(boxes.stage.bottom <= boxes.caption.top + 1, 'the animation covers the caption');
    assert.ok(boxes.caption.bottom <= boxes.actions.top + 1, 'the caption runs into the buttons');
    assert.ok(boxes.actions.bottom <= height, 'the buttons are below the window');
    await shot(page, `explainer-layout-${width}x${height}`);
    await next(page, 3);
    await expectGoodLayout(page, 'explainer end card');
    await page.context().close();
  });
}

await check('no console errors', async () => {
  assert.deepEqual(session.errors, []);
});

process.exit((await session.finish()) > 0 ? 1 : 0);
