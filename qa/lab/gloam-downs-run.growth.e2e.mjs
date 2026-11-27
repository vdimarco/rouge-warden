// Gloam Downs' growth across runs in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2
// (openspec/changes/gloam-downs-growth):
//   flow: glim carried past the Gaol's beacon (the bank stays 0), a Rime lamp pattern dropped, taken ("◇ 1" on the count line and a
//     toast) and kept at the beacon ("Kept: Rime lamp"); the beacon card's wick, then its spark: Ward +1 at 80 of 100 gives 90/110 and
//     the HUD's colour row shows Ward 1; the Lamp-room's Kindle with the glim carried first; Lantern panes 1 opens a second pane row
//     that leaves out the pane set in the first; the save is v3;
//   layout: the beacon card with its spark buttons and kept line, and the Lamp-room with its colours, wares, patterns and three pane
//     rows, at 320x640, 390x844, 360x640, 800x600, 844x390 (touch) and 1280x720 (mouse): inside the screen with no page scroll,
//     buttons of 44 px or more, none under the Lab bar or the card's own buttons; every Lamp-room button reached by Tab alone and by
//     a mocked pad's d-pad alone, in view; the HUD's colour row inside the HUD and clear of the health and count lines.
// Needs this tree served:   python3 -m http.server 8851 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.growth.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>, ONLY=flow|layout)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8851').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
const ONLY = process.env.ONLY;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const part = name => !ONLY || ONLY.split(',').includes(name);
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
async function open(ctxOpts, query, save = null) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (save) await ctx.addInitScript(o => { try { localStorage.setItem('gloam-downs.run.v3', JSON.stringify(o)); } catch {} }, save);
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
const active = page => G(page, () => document.activeElement?.id || document.activeElement?.dataset.spark || document.activeElement?.textContent);
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
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
// the Gaol's beacon lights once the keep's three Snuffers (G5) are out; their 9 glim count as carried when it lights
const keepOut = (page, carried) => G(page, c => { const g = window.__gloam; g.out('G5'); g.tick(1.2, {}); g.set({ carried: c - 9 }); }, carried);

// a card measured with its scroll: each button in view when brought into view, 44 px, clear of the Lab bar and the card's own foot
function cardFaults(id) {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = [], box = document.querySelector(`#${id} .box`);
  if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  if (!inside(R(box))) out.push('box outside the screen');
  const lab = [R(document.querySelector('.labbar .back')), R(document.getElementById('menu'))];
  const btns = [...box.querySelectorAll('button')].filter(x => !x.hidden && x.getClientRects().length);
  const foot = [...box.querySelectorAll('#lampRow button, #beaconRow button')].filter(x => !x.hidden && x.getClientRects().length);
  for (const x of btns) {
    x.scrollIntoView({ block: 'nearest' });
    const r = R(x), name = x.id || x.dataset.spark || x.dataset.pane || x.textContent.trim().slice(0, 24);
    if (Math.min(r.width, r.height) < 44 - 0.01) out.push(`${name} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (!inside(r)) out.push(`${name} outside the screen`);
    if (lab.some(l => over(r, l))) out.push(`${name} under the Lab bar`);
    if (id === 'lamp' && !foot.includes(x) && foot.some(y => over(r, R(y)))) out.push(`${name} under the card's own buttons`);
  }
  for (const el of box.querySelectorAll('h2, h3, p, li, span')) if (!el.hidden && el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) out.push(`text wider than its row: ${el.textContent.trim().slice(0, 30)}`);
  box.scrollTop = 0;
  return { out, buttons: btns.length };
}
function focusSeen() {
  const R = el => el.getBoundingClientRect(), b = document.activeElement, r = R(b);
  const over = (a, c) => a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
  const foot = [...document.querySelectorAll('#lampRow button')].filter(x => !x.hidden);
  const inBox = r.top >= R(document.querySelector('#lamp .box')).top - 0.5 && r.bottom <= innerHeight + 0.5;
  const id = b.id || (b.dataset.pane ? `${b.dataset.slot}:${b.dataset.pane}` : null) || b.closest('li')?.dataset.up || b.closest('li')?.dataset.unlock || b.closest('li')?.dataset.pattern || b.dataset.ember || b.textContent;
  return { id, ok: inBox && (foot.includes(b) || !foot.some(y => over(r, R(y)))) };
}
// the HUD's colour row: inside the HUD and the screen, and clear of the health line and the count line
function colourRowFaults() {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const row = document.getElementById('colourRow'), out = [];
  if (row.hidden || !row.getClientRects().length) return ['the colour row is hidden'];
  const r = R(row), hud = R(document.getElementById('hud'));
  if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push('outside the screen');
  if (r.bottom > hud.bottom + 0.5) out.push('below the HUD');
  for (const id of ['life', 'count', 'combo']) { const e = document.getElementById(id); if (!e.hidden && e.getClientRects().length && over(r, R(e))) out.push(`over #${id}`); }
  for (const b of document.querySelectorAll('.act, .jump')) if (!b.hidden && b.getClientRects().length && over(r, R(b))) out.push(`over ${b.id}`);
  return out;
}

try {
  /* ---------------- the flow: carry, keep, spark, kindle, panes ---------------- */
  if (part('flow')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&nodraw', { seen: true, bank: 0 });
    await ready(page, 'lamp');
    await page.click('#bLampBegin');
    await ready(page, 'play');
    // a pattern at the lamplighter's feet: taken on the next steps, with its toast and "◇ 1" on the count line
    await G(page, () => window.__gloam.set({ dropPattern: 'rime' }));
    await tick(page, 0.1, {});
    let r = await run(page);
    assert.deepEqual([r.carriedPatterns, r.groundPatterns], [['rime'], []]);
    assert.match(await text(page, '#toast'), /A pattern: Rime lamp\. Light a beacon to keep it\./);
    assert.match(await text(page, '#count'), /◇ 1$/);
    // the beacon with 40 carried and 0 banked, at 80 of 100
    await keepOut(page, 40);
    await G(page, () => window.__gloam.set({ hp: 80 }));
    await G(page, () => window.__gloam.light());
    await tick(page, 1.6, {});
    assert(await page.isVisible('#beaconCard'));
    r = await run(page);
    assert.deepEqual([r.place, r.carried, r.bank, r.patterns, r.carriedPatterns, r.sparkPicks], ['ramparts', 40, 0, ['rime'], [], 1]);
    assert(!(await page.isVisible('#sparks')) && !(await page.isVisible('#beaconKept')), 'the wick first');
    await page.keyboard.press('Enter');
    // the spark, after the wick: three buttons, the first focused, and no Lamp-room or Walk on until one is taken
    assert(await page.isVisible('#sparks'));
    assert.deepEqual(await page.$$eval('#sparks button', bs => bs.map(b => b.querySelector('b').textContent)), ['Flame +1', 'Ward +1', 'Gloam +1']);
    assert.equal(await active(page), 'flame');
    assert(!(await page.isVisible('#bWalkOn')));
    for (const k of ['Escape', 'm']) { await page.keyboard.press(k); assert(await page.isVisible('#sparks'), `${k} cannot pass the spark`); }
    await page.click('#sparks button[data-spark="ward"]');
    r = await run(page);
    assert.deepEqual([r.hp, r.max, r.sparks, r.sparkPicks], [90, 110, { flame: 0, ward: 1, gloam: 0 }, 0]);
    assert.equal(await text(page, '#hpN'), '90/110');
    assert(await page.isVisible('#colourRow'));
    assert.equal(await text(page, '#colourRow'), 'Flame 0Ward 1Gloam 0');
    assert.equal(await text(page, '#beaconKept'), 'Kept: Rime lamp');
    assert.match(await text(page, '#beaconBank'), /^You carry 40 glim, and 0 is banked\./);
    // the beacon's Lamp-room is its shrine now (gloam-downs-hub): the same rows under three tabs, Wares, Patterns and Panes
    assert.equal(await text(page, '#bSpend'), 'Go to the shrine');
    assert.equal(await active(page), 'bWalkOn');
    await shot(page, 'flow-beacon-1280x720');
    pass('carry and keep: 40 glim carried past the Gaol (bank 0), the Rime lamp kept ("Kept: Rime lamp"), and Ward +1 gives 90/110', { colours: await text(page, '#colourRow') });
    // the Lamp-room: the Rime lamp's row, short of glim, then Kindle with the 40 carried first and 80 of the bank
    await page.click('#bSpend');
    assert(await page.isVisible('#lamp'));
    await page.click('#shrineTabs button[data-tab="kiln"]');
    assert.match(await text(page, '#lampLine'), /^Carried: 40 glim · Banked: 0 glim\./);
    assert.match(await text(page, '#colours'), /Flame 0 · Ward 1 · Gloam 0/);
    // a pattern is an unlit lamp tile (gloam-downs-screens-life): its row's words in data-label, and Kindle
    const row = () => page.$$eval('#patterns li:not(.kindled)', ls => ls.map(l => [l.dataset.label, l.querySelector('button').textContent]));
    assert.deepEqual(await row(), [['Rime lamp · a cone slows foes · 120 glim', '80 more glim']]);
    await G(page, () => window.__gloam.set({ bank: 150 }));
    assert.deepEqual(await row(), [['Rime lamp · a cone slows foes · 120 glim', 'Kindle']]);
    await page.click('#patterns li[data-pattern="rime"] button');
    r = await run(page);
    assert.deepEqual([r.carried, r.bank, r.patterns, r.kindledAll.includes('rime')], [0, 70, [], true]);
    // no pattern left to kindle: the kindled one stays on its shelf as a lit lamp with no button, until the Lamp-room opens again
    assert.deepEqual(await row(), [], 'no pattern left to kindle');
    assert.deepEqual(await page.$$eval('#patterns li.kindled', ls => ls.map(l => [l.dataset.pattern, l.querySelector('button').hidden])), [['rime', true]]);
    // the focus stays in the Lamp-room's growth rows (a pane button here), not on a Buy button of the wares
    // (at the shrine the panes are on their own tab: with no pattern left on this one, the focus goes to Back to the beacon)
    assert(await G(page, () => !!document.activeElement?.closest('#paneRow, #patterns') || document.activeElement?.id === 'bLampBack'), `the focus after Kindle: ${await G(page, () => document.activeElement?.textContent)}`);
    pass('kindle: the Rime lamp\'s row says "80 more glim" with 40 carried, then Kindle takes the 40 carried and 80 of the bank', { bank: r.bank });
    // two pane slots: Lantern panes 1, then Thick glass in slot 1 is not offered in slot 2
    await G(page, () => window.__gloam.set({ bank: 300 }));
    assert.equal(await page.$$eval('#paneRow .paneSlot', s => s.length), 1);
    await page.click('#shrineTabs button[data-tab="shelf"]');
    await page.click('#ups li[data-up="panes"] button');
    assert.equal(await page.$$eval('#paneRow .paneSlot', s => s.length), 2);
    await page.click('#shrineTabs button[data-tab="window"]');
    await page.click('#paneRow button[data-slot="0"][data-pane="thick"]');
    const panes = await page.$$eval('#paneRow .paneSlot', s => s.map(x => [...x.querySelectorAll('button')].map(b => `${b.dataset.pane}:${b.getAttribute('aria-pressed')}`)));
    assert.deepEqual(panes, [['thick:true', 'hot:false'], ['hot:false']]);
    r = await run(page);
    assert.deepEqual([r.panes, r.paneSlots, r.up.panes], [['thick'], 2, 1]);
    const stored = await G(page, () => JSON.parse(localStorage.getItem('gloam-downs.run.v3')));
    assert.deepEqual([stored.v, stored.panes, stored.kindled.includes('rime'), stored.run.sparks.ward], [3, ['thick'], true, 1]);
    await shot(page, 'flow-lamp-1280x720');
    pass('two pane slots: Lantern panes 1 shows a second row, and Thick glass set in the first is not offered in the second; the save is v3', { panes });
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- the cards and the HUD in six layouts, with keys alone and a pad alone ---------------- */
  if (part('layout')) {
    // a run at The Crow Wall's beacon card with its spark to pick, three patterns found, three pane slots and every pane kindled
    const SAVE = {
      seen: true, bank: 240, up: { panes: 2, mantle: 2 }, patterns: ['flare', 'moth', 'smoked'], kindled: ['rime', 'lead', 'storm', 'tallow'], panes: ['thick', 'lead'],
      run: { place: 'ramparts', seed: 7, hp: 100, carried: 35, sparkPicks: 1, sparks: { flame: 2, ward: 1, gloam: 3 }, kept: ['pitch'], wicks: ['keen'], carriedPatterns: [] }
    };
    const sizes = [[320, 640, true], [390, 844, true], [360, 640, true], [800, 600, false], [844, 390, true], [1280, 720, false]];
    const res = {};
    for (const [w, h, touch] of sizes) {
      const tag = `${w}x${h}`;
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&seed=7&nodraw', SAVE);
      await ready(page, 'beacon');
      assert(await page.isVisible('#sparks'), `${tag}: the spark waits`);
      let f = await G(page, cardFaults, 'beaconCard');
      assert.deepEqual(f.out, [], `${tag} beacon card with sparks`);
      await shot(page, `layout-sparks-${tag}`);
      await page.click('#sparks button[data-spark="flame"]');
      assert(await page.isVisible('#beaconKept') && await page.isVisible('#bWalkOn'));
      f = await G(page, cardFaults, 'beaconCard');
      assert.deepEqual(f.out, [], `${tag} beacon card after the spark`);
      await page.click('#bSpend');
      await ready(page, 'lamp');
      assert.equal(await page.$$eval('#paneRow .paneSlot', s => s.length), 3);
      f = await G(page, cardFaults, 'lamp');
      assert.deepEqual(f.out, [], `${tag} Lamp-room`);
      await shot(page, `layout-lamp-${tag}`);
      // keys alone: Tab through every button, each in view
      const tabbed = [];
      for (let k = 0; k < f.buttons; k++) { await page.keyboard.press('Tab'); const s = await G(page, focusSeen); tabbed.push(s.id); assert(s.ok, `${tag}: ${s.id} not in view on Tab`); }
      assert.equal(new Set(tabbed).size, f.buttons, `${tag}: Tab reaches each of the ${f.buttons} buttons`);
      // the HUD with the colour row, once the cards are shut
      await page.keyboard.press('Escape');
      await ready(page, 'beacon');
      await page.click('#bWalkOn');
      await ready(page, 'play');
      const hf = await G(page, colourRowFaults);
      assert.deepEqual(hf, [], `${tag} HUD`);
      await shot(page, `layout-hud-${tag}`);
      assert.deepEqual(errors, [], tag);
      await ctx.close();
      // a pad alone: A takes the focused spark, the d-pad reaches Lamp-room, A opens it, and the d-pad goes down through every button
      const P = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&seed=7&nodraw', SAVE);
      await P.page.addScriptTag({ content: `(${mock})()` });
      await ready(P.page, 'beacon');
      await tick(P.page, 0.1, 'live');
      await tap(P.page, PAD.A);
      assert.equal((await run(P.page)).sparks.flame, 3, `${tag} pad: A took Flame +1`);
      await tap(P.page, PAD.UP);
      assert.equal(await active(P.page), 'bSpend');
      await tap(P.page, PAD.A);
      await ready(P.page, 'lamp');
      const padded = [];
      for (let k = 0; k < f.buttons; k++) { await tap(P.page, PAD.DOWN); const s = await G(P.page, focusSeen); padded.push(s.id); assert(s.ok, `${tag} pad: ${s.id} not in view`); }
      assert.equal(new Set(padded).size, f.buttons, `${tag}: the d-pad reaches each button (${padded.join(', ')})`);
      assert.deepEqual(P.errors, [], `${tag} pad`);
      await P.ctx.close();
      res[tag] = f.buttons;
    }
    pass('the beacon card with its sparks and kept line, the Lamp-room with patterns and three pane rows, and the HUD\'s colour row in six layouts: 44 px buttons in view, Tab alone and a pad alone', res);
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
