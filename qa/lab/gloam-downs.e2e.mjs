// Gloam Downs in a real browser (public/lab/gloam-downs/), on software WebGL 2:
//   the page loads and draws; every place is dark with fire in it (read back from the canvas); keys move and jump the lamplighter;
//   a wisp counts; the map shows the places; the beacon opens the next place; the save comes back after a reload and a bad save is
//   ignored; on a phone the stick moves and the controls are 44 px and inside the screen; 320 and 1280 wide have no sideways scroll;
//   without WebGL the page says so.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(), because software WebGL takes about a
// second a frame. Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const ORDER = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };

const browser = await chromium.launch({ executablePath, args: GL });
async function open(ctxOpts, query = '?fresh&test') {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
  return { ctx, page, errors };
}
const state = page => page.evaluate(() => window.__gloam.state());
const tick = (page, sec, held = {}) => page.evaluate(([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

try {
  /* ---------------- desktop ---------------- */
  const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } });
  {
    assert(await page.isVisible('#help'), 'the first visit shows how to play');
    assert(await page.isVisible('#helpKeys') && !(await page.isVisible('#helpTouch')), 'a computer is shown the keys');
    await page.click('#bStart');
    assert(!(await page.isVisible('#help')));
    const s = await state(page);
    assert.equal(s.place, 'gaol');
    assert.equal(s.mode, 'play');
    assert(s.art.w >= 200 && s.art.w <= 420, `art ${s.art.w}x${s.art.h}`);
    const st = await page.evaluate(() => window.__gloam.stats());
    assert(st.colours > 6, `the picture is drawn (${st.colours} colours)`);
    await shot(page, 'desktop-start');
    pass('the page loads and draws The Sunken Gaol', { art: s.art, colours: st.colours });
  }
  { // every place is dark, with fire in it
    const seen = [];
    for (const id of ORDER) {
      await page.evaluate(id => window.__gloam.go(id), id);
      await page.waitForFunction(id => window.__gloam.ready() && window.__gloam.state().place === id, id, { timeout: 120000 });
      await page.evaluate(() => window.__gloam.close());
      const st = await page.evaluate(() => window.__gloam.stats());
      assert(st.mean > 0.05 && st.mean < 0.32, `${id}: mean luminance ${st.mean}`);
      assert(st.bright >= 0.0005 && st.bright <= 0.12, `${id}: ${st.bright} of the picture is over 0.55`);
      seen.push({ id, mean: +st.mean.toFixed(3), bright: +(st.bright * 100).toFixed(2) });
      await shot(page, `place-${id}`);
    }
    pass('every place is dark with bright fire in it', seen);
    await page.evaluate(() => window.__gloam.go('gaol'));
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 120000 });
  }
  { // keys: W walks away from the camera, Space jumps
    const a = await state(page);
    await page.keyboard.down('w');
    const b = await tick(page, 1, 'live');
    await page.keyboard.up('w');
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    assert(moved > 2, `W moved the lamplighter ${moved}`);
    // forward is away from the camera: the eye is at +(sin yaw, cos yaw) from the target
    const away = (b.x - a.x) * -Math.sin(a.cam.yaw) + (b.z - a.z) * -Math.cos(a.cam.yaw);
    assert(away > moved * 0.7, 'W goes away from the camera');
    await page.keyboard.down(' ');
    const c = await tick(page, 0.25, 'live');
    await page.keyboard.up(' ');
    assert(!c.ground && c.y > b.y + 0.5, `Space jumped: ${b.y} to ${c.y}`);
    await tick(page, 1, {});
    assert((await state(page)).ground, 'it lands');
    pass('the keys walk and jump the lamplighter', { moved: +moved.toFixed(2) });
  }
  { // a wisp
    const pts = await page.evaluate(() => window.__gloam.points());
    const w = pts.wisps[0];
    await page.evaluate(([x, z]) => window.__gloam.teleport(x, z), [w[0], w[2]]);
    const s = await tick(page, 0.3, {});
    assert.equal(s.wisps, 1, 'the wisp counted');
    assert.match(await page.textContent('#count'), /1\/5/);
    assert.match(await page.textContent('#toast'), /Wisp 1 of 5/);
    pass('a wisp goes out and counts');
  }
  { // the map
    await page.keyboard.press('m');
    assert(await page.isVisible('#map'));
    const buttons = await page.$$eval('#places button', bs => bs.map(b => ({ open: !b.disabled, text: b.textContent })));
    assert.equal(buttons.length, 5);
    assert.deepEqual(buttons.map(b => b.open), [true, false, false, false, false]);
    await shot(page, 'map');
    await page.keyboard.press('Escape');
    assert(!(await page.isVisible('#map')));
    pass('the map shows the five places, the first open');
  }
  { // the beacon opens the next place
    const pts = await page.evaluate(() => window.__gloam.points());
    await page.evaluate(([x, z]) => window.__gloam.teleport(x, z), [pts.beacon[0], pts.beacon[2]]);
    const s = await tick(page, 0.3, {});
    assert(s.lit, 'the beacon lit');
    await shot(page, 'beacon-lit');
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'ramparts', null, { timeout: 120000 });
    const r = await state(page);
    assert.deepEqual(r.reached, ['gaol', 'ramparts']);
    pass('the beacon lights and Crow Ramparts loads');
  }
  { // reload: the save comes back
    await page.goto(`${SITE}/lab/gloam-downs/?test`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
    const s = await state(page);
    assert.equal(s.place, 'ramparts', 'it opens where you were');
    assert(!(await page.isVisible('#help')), 'the help is not shown again');
    await page.keyboard.press('m');
    const open = await page.$$eval('#places button', bs => bs.map(b => !b.disabled));
    assert.deepEqual(open, [true, true, false, false, false]);
    const gaolWisps = await page.textContent('#places button:first-child em');
    assert.match(gaolWisps, /1\/5/);
    pass('a reload keeps the places reached and the wisps found');
  }
  { // a bad save
    await page.evaluate(() => localStorage.setItem('gloam-downs.save.v1', JSON.stringify({ reached: 5, at: 'nowhere', wisps: { gaol: 'x' }, lit: [1], time: 'soon' })));
    await page.goto(`${SITE}/lab/gloam-downs/?test`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
    assert.equal((await state(page)).place, 'gaol');
    await page.evaluate(() => localStorage.setItem('gloam-downs.save.v1', '{not json'));
    await page.goto(`${SITE}/lab/gloam-downs/?test`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
    assert.equal((await state(page)).place, 'gaol');
    pass('a bad save is ignored');
  }
  assert.deepEqual(errors, [], 'no page errors on the desktop');
  await ctx.close();

  /* ---------------- phone ---------------- */
  {
    const { ctx: pc, page: p, errors: pe } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    assert(await p.isVisible('#helpTouch') && !(await p.isVisible('#helpKeys')), 'a phone is shown the touch controls');
    await p.click('#bStart');
    for (const sel of ['#bJump', '#bMap', '#bLook']) {
      const b = await p.locator(sel).boundingBox();
      assert(b && Math.min(b.width, b.height) >= 44, `${sel} is 44 px: ${JSON.stringify(b)}`);
      assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844, `${sel} is inside the screen`);
    }
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    const a = await state(p);
    // a thumb on the left half drags up: the stick shows and the lamplighter walks away from the camera
    await p.evaluate(() => {
      const c = document.getElementById('view'), o = { pointerId: 7, pointerType: 'touch', bubbles: true, isPrimary: true };
      c.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 100, clientY: 640 }));
      c.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: 100, clientY: 570 }));
    });
    assert(await p.isVisible('#stick'), 'the stick shows under the thumb');
    const b = await tick(p, 1, 'live');
    assert(Math.hypot(b.x - a.x, b.z - a.z) > 2, 'the stick moves the lamplighter');
    await p.evaluate(() => document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true })));
    assert(!(await p.isVisible('#stick')));
    // the jump button
    await p.evaluate(() => document.getElementById('bJump').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true })));
    const c = await tick(p, 0.25, 'live');
    await p.evaluate(() => document.getElementById('bJump').dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch', bubbles: true })));
    assert(!c.ground, 'JUMP jumps');
    // a drag on the right half turns the view
    const yaw0 = (await state(p)).cam.yaw;
    await p.evaluate(() => {
      const c = document.getElementById('view'), o = { pointerId: 9, pointerType: 'touch', bubbles: true };
      c.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 300, clientY: 400 }));
      c.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: 240, clientY: 400 }));
      c.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 240, clientY: 400 }));
    });
    await tick(p, 0.05, 'live');
    assert(Math.abs((await state(p)).cam.yaw - yaw0) > 0.2, 'a drag on the right turns the view');
    await p.evaluate(() => window.__gloam.draw());
    await shot(p, 'phone-390');
    assert.deepEqual(pe, []);
    await pc.close();
    pass('on a phone: the stick, JUMP and a look drag work, and the controls are 44 px and inside the screen');
  }
  for (const [w, h] of [[320, 640], [1280, 720]]) {
    const { ctx: c2, page: p, errors: pe } = await open({ viewport: { width: w, height: h }, hasTouch: w < 400, isMobile: w < 400 });
    await p.click('#bStart');
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}: no sideways scroll`);
    for (const sel of ['#bMap', '#bLook', '#where']) {
      const b = await p.locator(sel).boundingBox();
      assert(b && b.x >= 0 && b.x + b.width <= w, `${w}: ${sel} inside the screen`);
    }
    const hud = await p.locator('#hud').boundingBox(), tools = await p.locator('#tools').boundingBox();
    assert(hud.x + hud.width <= tools.x || hud.y + hud.height <= tools.y || tools.y + tools.height <= hud.y, `${w}: the HUD and the buttons do not overlap`);
    await p.evaluate(() => window.__gloam.draw());
    await shot(p, `layout-${w}`);
    assert.deepEqual(pe, []);
    await c2.close();
    pass(`${w} by ${h}: the layout fits`);
  }
  { // without WebGL the page says so
    const b2 = await chromium.launch({ executablePath, args: ['--disable-webgl', '--disable-3d-apis'] });
    const p = await b2.newPage();
    await p.goto(`${SITE}/lab/gloam-downs/?fresh&test`);
    await p.waitForFunction(() => /WebGL 2/.test(document.getElementById('loadLine').textContent), null, { timeout: 30000 });
    await b2.close();
    pass('without WebGL 2 the page says so in words');
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
