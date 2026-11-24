// Gloam Downs' builds in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2:
//   elites: in each of the five places the zone that holds the elite wakes, a toast names it, and it stands at 1.25 times the size;
//   relics: the Wardmother put out drops a relic, a walk onto it takes it, the toast names it, and the HUD shows its mark;
//   unlocks: Rising cut bought with 150 banked leaves 10, its row reads "bought", and the run's help has a line for it;
//   Wick shelf: Begin the run offers two wicks; one chosen, the run starts in the Gaol with it;
//   Ember: after a first win the win card says Ember 1 opens, and the Lamp-room shows Ember 0 and Ember 1 with Ember 0 chosen;
//   the Lamp-room with every row and the Ember row at 320x640, 390x844, 360x640, 800x600 and 1280x720: each button 44 px or more,
//     reached with Tab alone and with a mocked pad's d-pad alone, in view when focused, never under the card's own buttons or the Lab
//     bar; the page never scrolls;
//   the build hooks: __gloam.set({ relics, wicks }) shows in __gloam.run() and on the HUD with "Kindled".
// Needs this tree served:   python3 -m http.server 8832 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.builds.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>, ONLY=elites|relic|lamp|shelf|ember|layout|hooks)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8832').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
const ONLY = process.env.ONLY;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const part = name => !ONLY || ONLY.split(',').includes(name);
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
async function open(ctxOpts, query, init) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page, mode) => page.waitForFunction(m => window.__gloam?.ready() && (!m || window.__gloam.run().mode === m), mode, { timeout: 180000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const text = (page, sel) => page.textContent(sel).then(t => t.trim());
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
// a v2 save written before the page loads
const saveWith = obj => ({ fn: o => { try { localStorage.setItem('gloam-downs.run.v2', JSON.stringify(o)); } catch {} }, arg: obj });
const mock = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
  window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
  navigator.getGamepads = () => [window.__pad];
};
const tap = async (page, i) => {
  await G(page, i => window.__press(i, true), i); await tick(page, 0.05, 'live');
  await G(page, i => window.__press(i, false), i); await tick(page, 0.05, 'live');
};
const PAD = { A: 0, B: 1, UP: 12, DOWN: 13 };
const FULL = { seen: true, bank: 75, emberTop: 2, ember: 1, unlocks: ['rising'], runs: 3, wins: 2 };

// the Lamp-room measured as the cards check does, with its scroll: each button in view when brought into view, 44 px, clear of the foot
function lampFaults() {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = [], box = document.querySelector('#lamp .box');
  if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  if (!inside(R(box))) out.push('box outside the screen');
  const lab = [R(document.querySelector('.labbar .back')), R(document.getElementById('menu'))];
  const btns = [...box.querySelectorAll('button')].filter(x => !x.hidden && x.getClientRects().length);
  const foot = [...document.querySelectorAll('#lampRow button')].filter(x => !x.hidden && x.getClientRects().length);
  for (const x of btns) {
    x.scrollIntoView({ block: 'nearest' });
    const r = R(x), name = x.id || x.textContent.trim();
    if (Math.min(r.width, r.height) < 44 - 0.01) out.push(`${name} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (!inside(r)) out.push(`${name} outside the screen`);
    if (lab.some(l => over(r, l))) out.push(`${name} under the Lab bar`);
    if (!foot.includes(x) && foot.some(y => over(r, R(y)))) out.push(`${name} under the card's own buttons`);
  }
  for (const el of box.querySelectorAll('h2, h3, p, li, span')) if (!el.hidden && el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) out.push(`text wider than its row: ${el.textContent.trim().slice(0, 30)}`);
  box.scrollTop = 0;
  return { out, buttons: btns.length };
}
// the focused button is in the screen and clear of the card's foot
function focusSeen() {
  const R = el => el.getBoundingClientRect(), b = document.activeElement, r = R(b);
  const over = (a, c) => a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
  const foot = [...document.querySelectorAll('#lampRow button')].filter(x => !x.hidden);
  const inBox = r.top >= R(document.querySelector('#lamp .box')).top - 0.5 && r.bottom <= innerHeight + 0.5;
  return { id: b.id || b.closest('li')?.dataset.up || b.closest('li')?.dataset.unlock || b.dataset.ember || b.textContent, ok: inBox && (foot.includes(b) || !foot.some(y => over(r, R(y)))) };
}

try {
  /* ---------------- elites: one in each place ---------------- */
  if (part('elites')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7&nodraw');
    await G(page, () => document.getElementById('bBegin').click());
    await ready(page, 'play');
    const seen = {};
    for (const id of ['gaol', 'ramparts', 'fen', 'bells', 'barrows']) {
      if (id !== 'gaol') { await G(page, p => window.__gloam.go(p), id); await ready(page, 'play'); }
      const r = await run(page);
      assert(r.elite, `${id}: an elite stands`);
      // wake its zone, and step until it has risen and seen the lamplighter
      const ok = await G(page, z => window.__gloam.wake(z), r.elite.zone);
      assert(ok.ok, JSON.stringify(ok));
      // the lamplighter a little way from the zone's centre, so its foes see it
      await G(page, ([x, z]) => window.__gloam.teleport(x + 3, z + 3, 0), [r.elite.c[0], r.elite.c[2]]);
      let toast = '';
      for (let k = 0; k < 20 && !toast.includes(`${r.elite.name} wakes`); k++) { await tick(page, 0.25, {}); toast = await text(page, '#toast'); }
      const e = (await run(page)).elite;
      assert.match(toast, new RegExp(e.name), `${id}: the toast names the elite`);
      assert.equal(e.size, 1.25);
      seen[id] = { name: e.name, zone: e.zone, hp: e.hp };
      await shot(page, `elite-${id}`);
    }
    pass('an elite in each place: its zone wakes, a toast names it, and it stands 1.25 times the size', seen);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- a relic: the Wardmother falls, its relic is taken, and the HUD shows it ---------------- */
  if (part('relic')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH }, '?run&test&fresh&seed=7&nodraw');
    await G(page, () => document.getElementById('bBegin').click());
    await ready(page, 'play');
    const e = (await run(page)).elite;
    // near its zone, so the zone stays awake once its foes stand
    await G(page, ([x, z]) => window.__gloam.teleport(x + 3, z + 3, 0), [e.c[0], e.c[2]]);
    await G(page, z => window.__gloam.wake(z), e.zone);
    await tick(page, 2.5, {});
    await G(page, id => window.__gloam.out(id), e.id);
    await tick(page, 0.1, {});
    const r = await run(page);
    assert.equal(r.ground.length, 1, 'a relic lies where it fell');
    assert.match(await text(page, '#toast'), /falls/);
    const g = r.ground[0];
    await G(page, ([x, z]) => window.__gloam.teleport(x, z, 0), [g.x, g.z]);
    await tick(page, 0.1, {});
    const after = await run(page);
    assert.deepEqual(after.relics, [g.id]);
    assert.match(await text(page, '#toast'), /✦/);
    assert(await page.isVisible('#relics'), 'the HUD shows the relic');
    assert.equal((await text(page, '#relics')).length >= 2, true);
    await shot(page, 'relic-390x844');
    pass('a relic: the Wardmother put out drops one, a touch takes it, and the HUD shows its mark', { relic: g.id });
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- an unlock bought, Wick shelf, the Ember row ---------------- */
  if (part('lamp')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&nodraw', saveWith({ seen: true, bank: 150 }));
    await ready(page, 'lamp');
    assert(await page.isHidden('#emberRow'), 'no Ember row before a first win');
    const btn = '#unlocks li[data-unlock="rising"] button';
    assert.equal(await text(page, '#unlocks li[data-unlock="rising"] span'), 'Rising cut · attack as a roll ends · 140 glim');
    await page.click(btn);
    assert.equal((await run(page)).bank, 10);
    assert.equal(await text(page, '#unlocks li[data-unlock="rising"] span'), 'Rising cut · bought');
    assert(await page.isHidden(btn));
    const ember = await page.$$eval('#unlocks li button', bs => bs.filter(b => !b.hidden).map(b => b.getAttribute('aria-disabled')));
    assert(ember.every(d => d === 'true'), 'with 10 glim every other Buy is off');
    assert.match(await page.innerHTML('#runControls'), /Rising cut/);
    pass('an unlock: Rising cut with 150 banked leaves 10, reads "bought", and the run help has its line');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  if (part('shelf')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&nodraw', saveWith({ seen: true, unlocks: ['shelf'] }));
    await ready(page, 'lamp');
    await page.keyboard.press('Enter');
    await ready(page, 'beacon');
    assert.equal(await text(page, '#beaconT'), 'The Wick shelf');
    const offer = (await run(page)).offer;
    assert.equal(offer.length, 2);
    await page.keyboard.press('Enter');
    await ready(page, 'play');
    const r = await run(page);
    assert.deepEqual([r.place, r.wicks, r.offer], ['gaol', [offer[0]], null]);
    pass('Wick shelf: Begin the run offers two wicks; Enter chooses the first, and the run starts in the Gaol with it', { offer });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  if (part('ember')) {
    // a first win at Ember 0, stored: the win card says Ember 1 opens, and the Lamp-room shows the Ember row
    const won = { seen: true, wins: 1, runs: 1, emberTop: 1, ember: 0, bestWin: 1500, bestByEmber: [1500, 0, 0, 0, 0, 0], ended: { won: true, place: 'barrows', time: 1500, foes: 40, lost: 0, banked: 200, ember: 0, opened: 1 } };
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&nodraw', saveWith(won));
    await ready(page, 'ended');
    assert.match(await text(page, '#winOpened'), /Ember 1 opens/);
    await page.click('#bWinLamp');
    await ready(page, 'lamp');
    const row = await page.$$eval('#emberRow button', bs => bs.map(b => [b.textContent, b.getAttribute('aria-pressed')]));
    assert.deepEqual(row, [['Ember 0', 'true'], ['Ember 1', 'false']]);
    await page.click('#emberRow button[data-ember="1"]');
    await page.click('#bLampBegin');
    await ready(page, 'play');
    const r = await run(page);
    assert.equal(r.ember, 1);
    assert.equal(r.route[0], 'gaol');
    pass('Ember: after the first win the Lamp-room shows Ember 0 and Ember 1, and Begin the run starts at the one chosen', { route: r.route });
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- the Lamp-room in five layouts, with keys alone and a pad alone ---------------- */
  if (part('layout')) {
    const sizes = [[320, 640, true], [390, 844, true], [360, 640, true], [800, 600, false], [1280, 720, false]];
    const res = {};
    for (const [w, h, touch] of sizes) {
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&seed=7&nodraw', saveWith(FULL));
      await ready(page, 'lamp');
      const f = await G(page, lampFaults);
      assert.deepEqual(f.out, [], `${w}x${h}`);
      // keys alone: Tab through every button, each in view when it has the focus
      const tabbed = [];
      for (let k = 0; k < f.buttons; k++) { await page.keyboard.press('Tab'); const s = await G(page, focusSeen); tabbed.push(s.id); assert(s.ok, `${w}x${h}: ${s.id} not in view on Tab`); }
      assert.equal(new Set(tabbed).size, f.buttons, `${w}x${h}: Tab reaches each of the ${f.buttons} buttons`);
      await shot(page, `lamp-${w}x${h}`);
      res[`${w}x${h}`] = f.buttons;
      assert.deepEqual(errors, []);
      await ctx.close();
      // a pad alone: the d-pad moves the focus down through every button, each in view
      const P = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&seed=7&nodraw', { fn: o => { localStorage.setItem('gloam-downs.run.v2', JSON.stringify(o)); }, arg: FULL });
      await P.page.addScriptTag({ content: `(${mock})()` });
      await ready(P.page, 'lamp');
      await tick(P.page, 0.1, 'live');
      const padded = [];
      for (let k = 0; k < f.buttons; k++) { await tap(P.page, PAD.DOWN); const s = await G(P.page, focusSeen); padded.push(s.id); assert(s.ok, `${w}x${h} pad: ${s.id} not in view`); }
      assert.equal(new Set(padded).size, f.buttons, `${w}x${h}: the d-pad reaches each button (${padded.join(', ')})`);
      await P.ctx.close();
    }
    pass('the Lamp-room with every row and the Ember row in five layouts: 44 px buttons in view, reached by Tab alone and by a pad alone', res);
  }

  /* ---------------- the build hooks ---------------- */
  if (part('hooks')) {
    const { ctx, page, errors } = await open({ viewport: { width: 320, height: 640 }, ...TOUCH }, '?run&test&fresh&seed=7&nodraw');
    await G(page, () => document.getElementById('bBegin').click());
    await ready(page, 'play');
    const r = await G(page, () => window.__gloam.set({ relics: ['trail'], wicks: ['heels'] }));
    assert.deepEqual([r.relics, r.wicks, r.kindled], [['trail'], ['heels'], ['trail']]);
    assert.match(await text(page, '#relics'), /Kindled/);
    const box = await G(page, () => { const a = document.getElementById('relics').getBoundingClientRect(), h = document.getElementById('hud').getBoundingClientRect(); return { right: a.right, bottom: a.bottom, w: innerWidth, hud: h.bottom }; });
    assert(box.right <= box.w && box.bottom <= box.hud + 0.5, JSON.stringify(box));
    await shot(page, 'hud-relics-320x640');
    pass('the build hooks: set relics and wicks, and the HUD shows the mark with "Kindled" inside the HUD at 320', box);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
