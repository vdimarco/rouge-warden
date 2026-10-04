// Moonwell in a browser: the title, the controls (keys, two thumbs on a touch screen), the camera as the pearl
// travels, a shrine and its charms, pause and blur, sound, the end of a run and the save, junk saves, three screen
// sizes and reduced motion. Needs the site served, see AGENTS.md.
//   NODE_PATH=qa/browser/node_modules node qa/moonwell/smoke.e2e.mjs      (BASE_URL defaults to http://127.0.0.1:8765)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '') + '/moonwell/';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  (' + detail + ')' : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, { width = 1280, height = 720, touch = false, reduced = false, store = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (store) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, store);
  await page.goto(BASE);
  await page.waitForFunction(() => window.moonwell && window.moonwell.snapshot.artReady && window.moonwell.snapshot.frames > 10);
  return { ctx, page, errors };
}
const snap = (page) => page.evaluate(() => window.moonwell.snapshot);
// the flippers of the bowl the pearl is in, and the ridge ahead, in screen pixels
const framing = (page) => page.evaluate(() => {
  const r = window.moonwell.run, s = r.world.list.find((x) => x.k === r.at), c = window.moonwell.snapshot.cam, v = window.moonwell.snapshot.view;
  const sx = (x) => (x - c.x) * c.scale + v.w / 2, sy = (y) => (y - c.y) * c.scale + v.h / 2;
  return { left: sx(s.flippers[0].px - 20), right: sx(s.flippers[1].px + 20), ridge: sx(s.x1), flipY: sy(s.fy), ridgeY: sy(s.y1), w: v.w, h: v.h };
});
const angles = (page) => page.evaluate(() => { const r = window.moonwell.run, s = r.world.list.find((x) => x.k === r.at); return s.flippers.map((f) => Math.abs(f.th - f.rest)); });

(async () => {
  const browser = await chromium.launch();

  console.log('desktop 1280 x 720');
  {
    const { ctx, page, errors } = await open(browser);
    const t = await snap(page);
    check('the title shows, with a bot playing behind it', t.mode === 'title' && t.attract && await page.isVisible('#launch'));
    check('no best run yet', (await page.textContent('#best-line')).includes('No best run yet'));
    const lit = await page.evaluate(() => { const c = document.getElementById('world'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 997) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n; });
    check('the canvas draws the islands', lit > 40, `${lit} bright samples`);

    await page.click('#launch');
    let s = await snap(page);
    check('Play starts a run at island 1, waiting in the moonbeam', s.mode === 'play' && !s.attract && s.island === 1 && s.phase === 'ready');
    check('the first island shows how to start', (await page.textContent('#hint')).length > 5);
    await page.keyboard.press('Space');
    await wait(100);
    check('Space drops the pearl', (await snap(page)).phase === 'play');
    await page.keyboard.down('z');
    await wait(120);
    let a = await angles(page);
    check('holding Z raises the left flipper', a[0] > 0.9 && a[1] < 0.05, a.map((x) => x.toFixed(2)).join());
    await page.keyboard.up('z');
    await page.keyboard.down('ArrowRight');
    await wait(120);
    a = await angles(page);
    check('holding → raises the right flipper', a[1] > 0.9, a.map((x) => x.toFixed(2)).join());
    await page.keyboard.up('ArrowRight');
    await wait(200);
    a = await angles(page);
    check('letting go drops both flippers', a[0] < 0.05 && a[1] < 0.05);

    await page.keyboard.press('Escape');
    await wait(100);
    s = await snap(page);
    check('Escape pauses', s.mode === 'paused' && await page.isVisible('#dialog'));
    const x0 = s.ball.x;
    await wait(400);
    check('nothing moves while paused', (await snap(page)).ball.x === x0);
    await page.keyboard.press('Escape');
    check('Escape resumes', (await snap(page)).mode === 'play' && !(await page.isVisible('#dialog')));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    check('losing focus pauses', (await snap(page)).mode === 'paused');
    await page.click('#dialog-actions button');
    check('Resume plays on', (await snap(page)).mode === 'play');

    await page.click('#sound');
    check('the sound button mutes and remembers it', (await page.textContent('#sound')) === 'Sound off' && await page.evaluate(() => localStorage.getItem('moonwell.muted.v1')) === 'true');
    await page.click('#sound');
    check('and turns the sound back on', (await page.textContent('#sound')) === 'Sound on');

    // the camera follows the pearl to the right, keeps it on the screen, and frames the bowl
    await page.evaluate(() => { window.moonwell.start(777); window.moonwell.autoplay(true, 0.95); });
    let inView = 0, samples = 0, framed = 0, firstX = null;
    for (let i = 0; i < 80; i++) {
      await wait(250);
      s = await snap(page);
      if (firstX === null) firstX = s.cam.x;
      if (s.mode !== 'play') continue;
      if (s.ball.mode === 'free' || s.ball.mode === 'rail') {
        samples++;
        const half = s.view.w / 2 / s.cam.scale;
        if (Math.abs(s.ball.x - s.cam.x) < half) inView++;
      }
      const f = await framing(page);
      if (f.left > -5 && f.right < f.w + 5 && f.flipY < f.h - 40) framed++;
    }
    s = await snap(page);
    check('the camera scrolls right with the pearl', s.island >= 4 && s.cam.x > firstX + 2500, `island ${s.island}, camera moved ${(s.cam.x - firstX) | 0}`);
    check('the pearl stays on the screen sideways', inView === samples, `${inView} of ${samples}`);
    check('the flippers of the bowl stay on the screen', framed >= 74, `${framed} of 80`);

    // a strong pass back over the ridge behind: the camera follows the pearl left, and the furthest island stays
    await page.evaluate(() => { window.moonwell.autoplay(false); const r = window.moonwell.run; r.saver = 9; const st = r.world.list.find((x) => x.k === r.at); r.phase = 'play'; Object.assign(r.ball, { x: st.x0 + 60, y: st.y0 - 150, vx: -800, vy: -250, mode: 'free' }); });
    const before = await snap(page);
    let back = null, visible = true;
    for (let i = 0; i < 12; i++) {
      await wait(100);
      const n = await snap(page);
      if (Math.abs(n.ball.x - n.cam.x) > n.view.w / 2 / n.cam.scale) visible = false;
      if (n.island < before.island) back = n;
    }
    check('a strong pass goes back an island, and the camera follows it left', back && back.far === before.far && back.cam.x < before.cam.x - 200 && visible, back ? `island ${back.island}, furthest ${back.far}` : 'did not go back');
    check('the head-up display shows the furthest island', /FURTHEST/.test(await page.textContent('#island')));
    check('no console errors on desktop', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  console.log('a shrine, a charm, the end of a run and the save');
  {
    const { ctx, page, errors } = await open(browser);
    await page.click('#launch');
    await page.evaluate(() => { window.moonwell.autoplay(true, 0.97, false); });
    await page.waitForFunction(() => window.moonwell.snapshot.mode === 'charm', null, { timeout: 120000 });
    const n = await page.$$eval('#choices button', (b) => b.length);
    check('the moonwell offers three charms', n === 3);
    const want = (await snap(page)).offer[1];
    await page.keyboard.press('Digit2');
    await wait(150);
    let s = await snap(page);
    check('the 2 key picks the second charm, and play goes on', s.mode === 'play' && s.charms[want] === 1, JSON.stringify(s.charms));
    // the last pearl drains
    await page.evaluate(() => { window.moonwell.autoplay(false); const r = window.moonwell.run; r.lives = 1; r.moonrise = 0; r.meter = 0; r.saver = 0; r.bridges = 0; r.phase = 'play'; const st = r.world.list.find((x) => x.k === r.at); Object.assign(r.ball, { x: st.cx, y: st.drainY + 4, vx: 0, vy: 50, mode: 'free' }); });
    await page.waitForFunction(() => window.moonwell.snapshot.mode === 'over', null, { timeout: 5000 });
    s = await snap(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moonwell.best.v1')));
    check('the run ends with a summary', await page.isVisible('#dialog') && (await page.textContent('#dialog-title')).includes('moon rests'));
    check('the best run is saved, with the furthest island', saved && saved.score === s.score && saved.island === s.far, JSON.stringify(saved));
    await page.keyboard.press('Space');
    await wait(150);
    s = await snap(page);
    check('Space plays again from island 1', s.mode === 'play' && s.island === 1 && s.score === 0);
    check('the best flag stands on that island', await page.evaluate(() => window.moonwell.run.best) === saved.island);
    check('no console errors through a shrine and a game over', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  console.log('junk saves');
  for (const junk of ['junk', '{"score":"x"}', 'null', '[]']) {
    const { ctx, page, errors } = await open(browser, { store: { 'moonwell.best.v1': junk, 'moonwell.muted.v1': junk } });
    check(`save ${JSON.stringify(junk)}: no error and a plain best line`, errors.length === 0 && (await page.textContent('#best-line')).includes('No best run yet'), errors.join('; '));
    await ctx.close();
  }

  console.log('phone 390 x 844 with touch');
  {
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844, touch: true });
    await page.tap('#launch');
    await wait(200);
    const cdp = await ctx.newCDPSession(page);
    // on several seeds: drop the pearl, and hold the left flipper up so it waits in the crook, where a player aims
    // the first three have the widest first bowl of 400 seeds, where the ridge sits furthest right
    const seeds = [165, 383, 46, 11], misses = [];
    for (const seed of seeds) {
      await page.evaluate((sd) => window.moonwell.start(sd), seed);
      await wait(400);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 600, id: 1 }] });
      await page.waitForFunction(() => { const r = window.moonwell.run, s = r.world.list.find((x) => x.k === r.at); return r.ball.y > s.fy - 60 && Math.hypot(r.ball.vx, r.ball.vy) < 30; }, null, { timeout: 8000 });
      await wait(1200);
      const f = await framing(page);
      if (!(f.left > 0 && f.right < f.w && f.ridge < f.w && f.flipY < f.h - 150)) misses.push(`seed ${seed}: ${JSON.stringify(f)}`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(100);
    }
    check(`with the pearl at the flippers, both flippers and the next ridge are on the screen (${seeds.length} seeds)`, misses.length === 0, misses.join('; '));
    check('the touch pads show', await page.isVisible('#pad-left') && await page.isVisible('#pad-right'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 600, id: 1 }, { x: 330, y: 600, id: 2 }] });
    await wait(150);
    let a = await angles(page);
    check('two thumbs hold both flippers up', a[0] > 0.9 && a[1] > 0.9, a.map((x) => x.toFixed(2)).join());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: 330, y: 600, id: 2 }] });
    await wait(150);
    a = await angles(page);
    check('lifting one thumb drops only its flipper', a[0] > 0.9 && a[1] < 0.05, a.map((x) => x.toFixed(2)).join());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(150);
    a = await angles(page);
    check('lifting both drops both', a[0] < 0.05 && a[1] < 0.05);
    const hudOk = await page.evaluate(() => { const r = document.getElementById('sound').getBoundingClientRect(); return r.height < 50 && r.right <= innerWidth; });
    check('the head-up display fits on one line', hudOk);
    check('no console errors on the phone', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  console.log('phone 844 x 390 landscape');
  {
    const { ctx, page, errors } = await open(browser, { width: 844, height: 390, touch: true });
    await page.tap('#launch');
    await wait(200);
    const f = await framing(page);
    check('the bowl is on the screen in landscape', f.left > 0 && f.right < f.w && f.flipY < f.h - 30 && f.flipY > 60, JSON.stringify(f));
    check('no console errors in landscape', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  console.log('reduced motion');
  {
    const { ctx, page } = await open(browser, { reduced: true });
    await page.click('#launch');
    await page.evaluate(() => { window.moonwell.autoplay(true, 0.9); });
    await wait(8000);
    // a drain always shakes the screen, unless motion is reduced
    await page.evaluate(() => { window.moonwell.autoplay(false); const r = window.moonwell.run; r.saver = 0; r.moonrise = 0; r.bridges = 0; r.phase = 'play'; const st = r.world.list.find((x) => x.k === r.at); Object.assign(r.ball, { x: st.cx, y: st.drainY + 4, vx: 0, vy: 50, mode: 'free' }); });
    await wait(500);
    const s = await snap(page);
    check('the screen never shakes, even on a drain', s.maxShake === 0 && s.lives < 3, `lives ${s.lives}, shake ${s.maxShake}`);
    await ctx.close();
  }

  await browser.close();
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
