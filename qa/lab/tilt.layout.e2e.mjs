// Responsive and interaction checks. Serve public/ on 8765, then run with Playwright on NODE_PATH.
import assert from 'node:assert/strict';
import { open, pointer, shot, sleep } from './lib.mjs';

for (const viewport of [
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'tablet-landscape', width: 1366, height: 1024, touch: true },
  { name: 'phone-portrait', width: 390, height: 844, touch: true },
]) {
  const { name, ...size } = viewport;
  const { page, errors, close } = await open('tilt/', size);
  try {
    assert.match(await page.title(), /Full Tilt.*Celestial/);
    assert.match(page.url(), /\/lab\/tilt\//);
    await page.locator('.card.start .go').click();
    await page.waitForFunction(() => QA.phase === 'play');
    await sleep(150);
    assert(await page.locator('#dmd').isVisible(), 'score panel is visible');
    const view = await page.evaluate(() => QA.view);
    const wide = size.width > size.height;
    assert.equal(view.wide, wide);
    const tableWidth = (wide ? 1060 : 500) * view.s / view.DPR;
    const tableHeight = (wide ? 500 : 1060) * view.s / view.DPR;
    assert(tableWidth > size.width * (wide ? 0.8 : 0.75), 'table uses most of the available width');
    assert(tableHeight < size.height && tableWidth <= size.width, 'whole table fits');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    for (const selector of ['.left-flip', '.right-flip']) {
      const box = await page.locator(selector).boundingBox();
      assert(box && box.width >= 44 && box.height >= 42, 'thumb pad is large enough');
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height, 'thumb pad stays visible');
    }
    await shot(page, `${name}-ready`);

    // Exercise the real pointer path, rather than calling the launch hooks.
    const span = Math.min(220, (wide ? size.width : size.height) * 0.25);
    const x = size.width * 0.8, y = size.height * (wide ? 0.7 : 0.45);
    await pointer(page, 'pointerdown', x, y, 1);
    const endX = wide ? x - span * 0.6 : x, endY = wide ? y : y + span * 0.6;
    await pointer(page, 'pointermove', endX, endY, 1);
    assert(Math.abs(await page.evaluate(() => QA.game.pull) - 0.6) < 0.03, 'orientation-specific drag pulls plunger');
    await shot(page, `${name}-pull`);
    await pointer(page, 'pointerup', endX, endY, 1);
    assert(await page.evaluate(() => QA.w.ball.live), 'release launches ball');

    // Real browser mouse events provide pointer capture on the visible flipper pad.
    const pad = await page.locator('.left-flip').boundingBox();
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await page.mouse.down();
    assert(await page.evaluate(() => QA.w.flippers[0].held), 'visible pad raises flipper');
    await page.mouse.up();
    assert(await page.evaluate(() => !QA.w.flippers[0].held), 'release lowers flipper');
    await shot(page, `${name}-play`);

    const before = await page.evaluate(() => ({ ball: QA.game.ball, score: QA.game.score }));
    await page.mouse.down();
    await page.setViewportSize({ width: size.height, height: size.width });
    await page.waitForFunction(wide => QA.view.wide !== wide, wide);
    assert(await page.evaluate(() => QA.phase === 'play' && QA.w.flippers.every(f => !f.held)), 'rotation clears held controls');
    const after = await page.evaluate(() => ({ ball: QA.game.ball, score: QA.game.score }));
    assert(after.ball >= before.ball && after.score >= before.score, 'rotation preserves the run');
    await page.mouse.up();
    await shot(page, `${name}-rotated`);
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(`PASS ${name}: layout, launch, flipper pad, rotation, console`);
  } catch (error) {
    await shot(page, `${name}-failure`);
    throw error;
  } finally { await close(); }
}
