// Gloam Downs in a real browser (public/lab/gloam-downs/), on software WebGL 2:
//   the page loads and draws; Escape closes the help for good; every place is dark with fire in it (read back from the canvas); keys
//   move and jump the lamplighter; a wisp counts; the map shows the places and Space presses its buttons; the beacon opens the next
//   place; the save comes back after a reload and a bad save is ignored; after Walk again one beacon is not the end of the walk;
//   blocked site data does not stop the page; Space and Enter on Try again load a place that failed; on a phone the stick moves and the controls are 44 px and inside the screen; 320 and
//   1280 wide have no sideways scroll; without WebGL or DecompressionStream the page says so.
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
async function open(ctxOpts, query = '?fresh&test', init) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init);
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
const KEY = 'gloam-downs.save.v1';
const saved = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
// reload with a save set by the test: a string is written as it is, an object is laid over the stored save. The page is left first,
// for a plain file of the same site, because its pagehide stores the save it holds and would write over this one.
async function reloadWith(page, edit, query = '?test') {
  await page.goto(`${SITE}/lab/gloam-downs/worlds/gaol.json`);
  await page.evaluate(([k, e]) => localStorage.setItem(k, typeof e === 'string' ? e : JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), ...e })), [KEY, edit]);
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
}

try {
  /* ---------------- desktop ---------------- */
  const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } });
  {
    assert(await page.isVisible('#help'), 'the first visit shows how to play');
    assert(await page.isVisible('#helpKeys') && !(await page.isVisible('#helpTouch')), 'a computer is shown the keys');
    // Escape closes the help as Walk does, and for good: the places below and the reload check that it stays closed
    await page.keyboard.press('Escape');
    assert(!(await page.isVisible('#help')));
    assert.equal((await saved(page)).seen, true, 'Escape counts as read');
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
      assert(!(await page.isVisible('#help')) && (await state(page)).mode === 'play', `${id}: the help stays closed`);
      await page.evaluate(() => window.__gloam.close());
      const st = await page.evaluate(() => window.__gloam.stats());
      assert(st.mean > 0.05 && st.mean < 0.32, `${id}: mean luminance ${st.mean}`);
      assert(st.bright >= 0.0005 && st.bright <= 0.12, `${id}: ${st.bright} of the picture is over 0.55`);
      seen.push({ id, mean: +st.mean.toFixed(3), bright: +(st.bright * 100).toFixed(2) });
      await shot(page, `place-${id}`);
    }
    pass('every place is dark with bright fire in it', seen);
    // __gloam.go marks each place reached; open only the first again, keeping the rest of the save as the page stored it
    await reloadWith(page, { reached: ['gaol'], at: 'gaol', lit: {} });
    assert.equal((await state(page)).place, 'gaol');
    assert(!(await page.isVisible('#help')), 'after a reload too');
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
    // Space presses the focused button in a dialog: here the current place, which closes the map
    await page.keyboard.press('m');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-current')), 'true');
    await page.keyboard.press(' ');
    assert(!(await page.isVisible('#map')) && (await state(page)).mode === 'play', 'Space closed the map');
    pass('the map shows the five places, the first open, and Space presses its buttons');
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
    pass('the beacon lights and The Crow Wall loads');
  }
  { // reload: the save comes back
    await page.goto(`${SITE}/lab/gloam-downs/?test`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
    const s = await state(page);
    assert.equal(s.place, 'ramparts', 'it opens where you were');
    assert(!(await page.isVisible('#help')), 'the help closed with Escape is not shown again');
    await page.keyboard.press('m');
    const open = await page.$$eval('#places button', bs => bs.map(b => !b.disabled));
    assert.deepEqual(open, [true, true, false, false, false]);
    const gaolWisps = await page.textContent('#places button:first-child em');
    assert.match(gaolWisps, /1\/5/);
    pass('a reload keeps the places reached and the wisps found');
  }
  { // a bad save
    await reloadWith(page, JSON.stringify({ reached: 5, at: 'nowhere', wisps: { gaol: 'x' }, lit: [1], time: 'soon' }));
    assert.equal((await state(page)).place, 'gaol');
    await reloadWith(page, '{not json');
    assert.equal((await state(page)).place, 'gaol');
    pass('a bad save is ignored');
  }
  { // Walk again keeps the places open, but lighting only Barrow Crown is not the end of the walk
    const done = { v: 1, reached: ORDER, at: 'barrows', wisps: {}, lit: { gaol: true, ramparts: true, fen: true, bells: true }, time: 100, best: 300, done: 1, seen: true };
    await reloadWith(page, JSON.stringify(done));
    assert.equal((await state(page)).place, 'barrows');
    await page.evaluate(() => window.__gloam.light());
    await page.waitForSelector('#end', { state: 'visible', timeout: 6000 });
    let s = await saved(page);
    assert(s.done === 2 && s.best === 100, `the fifth beacon ends the walk: done ${s.done}, best ${s.best}`);
    assert.equal(await page.textContent('#endBest'), '1:40');
    await page.click('#bAgain');
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 120000 });
    await page.keyboard.press('m');
    assert.deepEqual(await page.$$eval('#places button', bs => bs.map(b => !b.disabled)), [true, true, true, true, true]);
    await page.click('#places button:nth-child(5)');
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'barrows', null, { timeout: 120000 });
    await tick(page, 0.5, {});
    await page.evaluate(() => window.__gloam.light());
    assert.match(await page.textContent('#toast'), /4 beacons are still dark/);
    await page.waitForTimeout(2600);
    assert(!(await page.isVisible('#end')), 'no end card while four beacons are dark');
    s = await saved(page);
    assert(s.done === 2 && s.best === 100, `the best time stays: done ${s.done}, best ${s.best}`);
    assert.deepEqual(s.lit, { barrows: true });
    assert.equal((await state(page)).mode, 'play');
    pass('after Walk again, one lit beacon shows no end card and keeps the best time', { best: s.best, done: s.done });
  }
  assert.deepEqual(errors, [], 'no page errors on the desktop');
  await ctx.close();

  { // site data blocked: even reading localStorage throws (Chrome with cookies blocked), and the page still plays
    const deny = () => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); } });
    const { ctx: bc, page: p, errors: be } = await open({ viewport: { width: 960, height: 540 } }, '?test', deny);
    assert(await p.isVisible('#help'), 'a fresh walk');
    await p.keyboard.press('Escape');
    assert.equal((await state(p)).mode, 'play');
    await tick(p, 0.5, {});
    assert.deepEqual(be, []);
    await bc.close();
    pass('with site data blocked the page loads and plays');
  }
  { // a place that does not load: Space on the focused Try again asks for it again, and Enter too
    const fc = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await fc.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
    let asked = 0, fail = true;
    await fc.route('**/worlds/gaol.bin.gz', r => { asked++; return fail ? r.fulfill({ status: 500, body: '' }) : r.continue(); });
    const p = await fc.newPage();
    const fe = [];
    p.on('pageerror', e => fe.push(e.message));
    await p.goto(`${SITE}/lab/gloam-downs/?fresh&test`);
    await p.waitForSelector('#bRetry', { state: 'visible', timeout: 60000 });
    assert.match(await p.textContent('#loadLine'), /Could not load The Sunken Gaol/);
    assert.equal(asked, 1);
    const askedFor = async n => { for (let i = 0; i < 100 && asked < n; i++) await p.waitForTimeout(100); return asked; };
    assert.equal(await p.evaluate(() => document.activeElement.id), 'bRetry', 'a failed load puts the focus on Try again');
    await p.keyboard.press(' ');
    assert.equal(await askedFor(2), 2, 'Space on Try again asks for the place again');
    await p.waitForSelector('#bRetry', { state: 'visible', timeout: 60000 });
    fail = false;
    await p.focus('#bRetry');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 120000 });
    assert.equal(asked, 3);
    assert.deepEqual(fe, []);
    await fc.close();
    pass('a place that does not load: Space and Enter on Try again ask for it again', { asked });
  }

  /* ---------------- phone ---------------- */
  {
    const { ctx: pc, page: p, errors: pe } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    assert(await p.isVisible('#helpTouch') && !(await p.isVisible('#helpKeys')), 'a phone is shown the touch controls');
    await p.click('#bStart');
    for (const sel of ['#bJump', '#bMap', '#bLook', '.labbar .back', '#menu']) {
      const b = await p.locator(sel).boundingBox();
      assert(b && Math.min(b.width, b.height) >= 44, `${sel} is 44 px: ${JSON.stringify(b)}`);
      assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844, `${sel} is inside the screen`);
    }
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    const a = await state(p);
    // real touches through the DevTools protocol: made-up PointerEvents have no active pointer, so the page cannot capture them
    const cdp = await pc.newCDPSession(p);
    const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) });
    // a thumb on the left half drags up: the stick shows and the lamplighter walks away from the camera
    await touch('touchStart', [[100, 640]]);
    await touch('touchMove', [[100, 570]]);
    assert(await p.isVisible('#stick'), 'the stick shows under the thumb');
    const b = await tick(p, 1, 'live');
    assert(Math.hypot(b.x - a.x, b.z - a.z) > 2, 'the stick moves the lamplighter');
    await touch('touchEnd');
    assert(!(await p.isVisible('#stick')));
    // the jump button
    const jb = await p.locator('#bJump').boundingBox();
    await touch('touchStart', [[jb.x + jb.width / 2, jb.y + jb.height / 2]]);
    const c = await tick(p, 0.25, 'live');
    await touch('touchEnd');
    assert(!c.ground, 'JUMP jumps');
    // a drag on the right half turns the view
    const yaw0 = (await state(p)).cam.yaw;
    await touch('touchStart', [[300, 400]]);
    await touch('touchMove', [[240, 400]]);
    await touch('touchEnd');
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
    const lab = await p.locator('.labbar').boundingBox();
    assert(lab.y + lab.height <= Math.min(hud.y, tools.y), `${w}: the Lab bar is above the HUD and the buttons`);
    for (const sel of ['.labbar .back', '#menu']) {
      const b = await p.locator(sel).boundingBox();
      assert(Math.min(b.width, b.height) >= 44, `${w}: ${sel} is 44 px: ${JSON.stringify(b)}`);
    }
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
    assert(!(await p.isVisible('#bRetry')));
    await b2.close();
    pass('without WebGL 2 the page says so in words');
  }
  { // WebGL 2 but no DecompressionStream (Safari before 16.4): the page says so, and does not offer a retry that cannot work
    const c = await browser.newContext();
    await c.addInitScript(() => { delete window.DecompressionStream; });
    const p = await c.newPage();
    await p.goto(`${SITE}/lab/gloam-downs/?fresh&test`);
    await p.waitForFunction(() => /newer browser/.test(document.getElementById('loadLine').textContent), null, { timeout: 30000 });
    assert(!(await p.isVisible('#bRetry')));
    await c.close();
    pass('without DecompressionStream the page says so in words');
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
