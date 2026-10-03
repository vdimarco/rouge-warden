// The approach cue, the touch launch and the end card, through the public controls.
// The test replaces the frame loop with a manual one, so game time moves only when the test steps
// it. Results do not depend on the speed of the machine. Run: node qa/lab/tilt.cue.e2e.mjs
import { open, until, shot, sleep, report, PHONE, DESK } from './lib.mjs';

const R = report('tilt.cue.e2e');
const FRAME = 1 / 60;
// A manual loop with the same contract as kit/loop.js: fixed steps, a scale for the Perfect hold.
const LOOP = `
export function startLoop({ step, draw, h = 1 / 120, scale = () => 1 }) {
  const loop = { frames: 0, frame(dt = ${FRAME}) {
    loop.frames++;
    if (scale() > 0) for (let i = 0; i < Math.round(dt / h); i++) step(h);
    draw(0, dt);
  } };
  window.__loop = loop;
  return { stop() {}, paused: false };
}
export function fitCanvas(canvas, onSize) { onSize(canvas.width, canvas.height, 1); return () => {}; }
`;
async function manualLoop(page, { score = null } = {}) {
  await page.route('**/lab/kit/loop.js', route => route.fulfill({ body: LOOP, contentType: 'text/javascript' }));
  if (score) await page.route('**/tilt/adventure.js', async route => {
    // Only the starting score and hearts change. Play, drains and the end card are real.
    const response = await route.fetch(), original = await response.text();
    const body = original.replace('export function createAdventure(', 'function fixtureCreateAdventure(') + `
export function createAdventure(seed) {
  const run = fixtureCreateAdventure(seed);
  Object.assign(run, { score: ${score.score}, lives: ${score.lives} });
  return run;
}`;
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
  await page.reload();
  await page.evaluate(() => {
    window.__sounds = [];
    document.getElementById('view').addEventListener('tilt-sound', e => window.__sounds.push({ kind: e.detail, frame: window.__loop.frames }));
  });
}
// Steps frames in the page until a condition holds. Returns the frame count, or -1.
const stepUntil = (page, condition, max) => page.evaluate(({ condition, max }) => {
  const test = new Function('return (' + condition + ')');
  for (let i = 0; i < max; i++) { window.__loop.frame(); if (test()) return window.__loop.frames; }
  return -1;
}, { condition, max });
const view = () => document.getElementById('view');

async function touchControl(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ ...p, id: 1, radiusX: 3, radiusY: 3, force: 1 }] : [] });
  return { down: p => send('touchStart', p), up: () => send('touchEnd'), close: () => cdp.detach() };
}
async function center(page, selector) {
  const box = await page.locator(selector).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const size of [{ name: 'phone-portrait', ...PHONE }, { name: 'desktop', ...DESK }, { name: 'phone-landscape', width: 844, height: 390, touch: true }]) {
  R.section(`${size.name}: the approach cue comes before the flip, in sight and in sound`);
  const { page, ctx, errors, close } = await open('tilt/', size);
  let touch = null;
  try {
    await manualLoop(page);
    await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
    if (size.touch) touch = await touchControl(ctx, page);
    let cueFrame = -1;
    for (let attempt = 0; attempt < 6 && cueFrame < 0; attempt++) {
      if (await page.locator('#launch-button').isVisible()) {
        await page.locator('#view').focus();
        await page.keyboard.press('Space');
      }
      cueFrame = await stepUntil(page, `document.getElementById('view').dataset.cue !== 'none' || !document.getElementById('launch-button').hidden`, 900);
      if (cueFrame > 0 && await page.locator('#launch-button').isVisible()) cueFrame = -1;
    }
    R.check(cueFrame > 0, 'A returning ball raises the approach cue');
    const side = await page.locator('#view').getAttribute('data-cue');
    const id = side === 'left' ? 'left-flip' : 'right-flip';
    const start = await page.evaluate(({ id, cueFrame }) => ({
      label: document.querySelector(`#${id} .flip-label`).textContent,
      incoming: document.getElementById(id).classList.contains('incoming'),
      lead: Number(document.getElementById('view').dataset.cueIn),
      tone: window.__sounds.some(s => s.kind === 'cue' && s.frame === cueFrame),
    }), { id, cueFrame });
    R.check(start.label === 'INCOMING' && start.incoming, 'The pad of the receiving flipper shows INCOMING when the cue starts');
    R.check(start.tone, 'A rising tone starts with the cue');
    R.check(start.lead >= .3, `The cue starts ${start.lead.toFixed(2)} s before the ideal press`);
    await shot(page, `tilt-cue-${size.name}-incoming`);
    // Step to the ideal press. FLIP NOW must light before it.
    const ready = await stepUntil(page, `Number(document.getElementById('view').dataset.cueIn) <= ${FRAME / 2}`, 120);
    R.check(ready > 0 && (await page.locator(`#${id} .flip-label`).textContent()) === 'FLIP NOW', 'FLIP NOW lights before the ideal press');
    await shot(page, `tilt-cue-${size.name}-flip-now`);
    if (touch) await touch.down(await center(page, `#${id}`));
    else await page.keyboard.down(side === 'left' ? 'z' : 'x');
    const struck = await stepUntil(page, `window.__sounds.some(s => s.kind.startsWith('strike-'))`, 60);
    if (touch) await touch.up(); else await page.keyboard.up(side === 'left' ? 'z' : 'x');
    const strike = await page.evaluate(() => window.__sounds.find(s => s.kind.startsWith('strike-')));
    R.check(struck > 0, 'The press makes a powered flip');
    R.check(struck > 0 && (struck - cueFrame) * FRAME >= .3, `The cue starts ${((struck - cueFrame) * FRAME).toFixed(2)} s before the powered flip (at least 0.3 s)`);
    R.check(strike?.kind === 'strike-perfect', 'A press as the ring closes is graded Perfect');
    await stepUntil(page, 'false', 8);
    await shot(page, `tilt-cue-${size.name}-perfect`);
    R.check(/rally ×1/.test(await page.locator('#rally-status').textContent()), 'The rally shows its multiplier after the flip');
  } catch (error) {
    await shot(page, `tilt-cue-${size.name}-failure`); R.check(false, error.stack || error.message);
  } finally {
    await touch?.close();
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors'); await close();
  }
}

R.section('phone-portrait: a touch launch never fires Pulse');
{
  const { page, ctx, errors, close } = await open('tilt/', PHONE);
  const touch = await touchControl(ctx, page);
  try {
    await manualLoop(page);
    await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
    const launch = await center(page, '#launch-button');
    await touch.down(launch); await sleep(500); await touch.up();
    await sleep(120);
    await stepUntil(page, 'false', 20);
    const after = await page.evaluate(() => ({ sounds: window.__sounds.map(s => s.kind), pulse: document.getElementById('pulse-button').textContent,
      message: document.getElementById('message').textContent, launched: document.getElementById('launch-button').hidden }));
    R.check(after.launched, 'Pressing and letting go of Launch launches the ball');
    R.check(!after.sounds.includes('pulse') && !/Pulse \d/.test(after.pulse) && after.message !== 'Gravity pulse',
      'The touch that launches the ball emits no pulse');
    await sleep(450);
    await touch.down(await center(page, '#pulse-button')); await touch.up();
    await stepUntil(page, 'false', 2);
    R.check((await page.evaluate(() => window.__sounds.map(s => s.kind))).includes('pulse'), 'A later tap on Pulse still works');
  } catch (error) {
    await shot(page, 'tilt-cue-launch-failure'); R.check(false, error.stack || error.message);
  } finally {
    await touch.close();
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors'); await close();
  }
}

// Plays with no flips until the hearts run out, then reads the end card.
async function playToEnd(page) {
  for (let i = 0; i < 12 && await page.locator('#end-panel').isHidden(); i++) {
    if (await page.locator('#launch-button').isVisible()) { await page.locator('#view').focus(); await page.keyboard.press('Space'); }
    await stepUntil(page, `!document.getElementById('end-panel').hidden || !document.getElementById('launch-button').hidden`, 1200);
  }
  return page.evaluate(() => ({ title: document.getElementById('end-title').textContent, score: Number(document.getElementById('end-score').textContent.replace(/,/g, '')),
    best: document.getElementById('end-best').textContent, gap: Number(document.getElementById('end-best').dataset.gap),
    worlds: document.querySelectorAll('#end-worlds li').length, reached: document.querySelectorAll('#end-worlds li.reached, #end-worlds li.cleared').length,
    detail: document.getElementById('end-detail').textContent, stored: Number(localStorage.getItem('tilt.voyage.best')) }));
}
for (const size of [{ name: 'phone-portrait', ...PHONE }, { name: 'desktop', ...DESK }]) {
  R.section(`${size.name}: the end card says how close the run came`);
  const init = () => { if (!sessionStorage.getItem('qa-best')) { localStorage.setItem('tilt.voyage.best', '50000'); sessionStorage.setItem('qa-best', '1'); } };
  const { page, errors, close } = await open('tilt/', { ...size, init });
  try {
    await manualLoop(page, { score: { score: 12000, lives: 1 } });
    await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
    const end = await playToEnd(page);
    R.check(end.score >= 12000 && end.score < 50000, 'The voyage ends below the stored best');
    R.check(end.best === `${(50000 - end.score).toLocaleString('en-US')} short of best` && end.gap === 50000 - end.score,
      `The end card reads "${end.best}"`);
    R.check(end.stored === 50000, 'A lower score keeps the stored best');
    R.check(end.worlds === 6 && end.reached >= 1, 'The end card shows six world markers and the world reached');
    R.check(/Perfect/.test(end.detail) && /best rally \d+ in a row/.test(end.detail), 'The end card shows the Perfect count and the best rally');
    await shot(page, `tilt-cue-${size.name}-end-short`);
    await page.unroute('**/tilt/adventure.js');
    await manualLoop(page, { score: { score: 61000, lives: 1 } });
    await page.getByRole('button', { name: 'Start voyage', exact: true }).click();
    const record = await playToEnd(page);
    R.check(record.best === 'New best' && record.stored === record.score, `A higher score reads "${record.best}" and becomes the stored best`);
    await shot(page, `tilt-cue-${size.name}-end-best`);
    const card = await page.locator('#end-panel .dialog-card').boundingBox();
    R.check(card && card.x >= 0 && card.y >= 0 && card.x + card.width <= size.width + 1 && card.y + card.height <= size.height + 1, 'The end card fits the screen');
  } catch (error) {
    await shot(page, `tilt-cue-${size.name}-end-failure`); R.check(false, error.stack || error.message);
  } finally {
    for (const error of errors) R.check(false, error);
    R.check(errors.length === 0, 'No application console or page errors'); await close();
  }
}
R.done();
