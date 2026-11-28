// Gloam Downs' gear on the HUD in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2 (openspec/changes/gloam-downs-hub,
// Part C "The HUD by category"):
//   the row by category: a bright Hook blade with Smouldering, the Buckler, Lantern bomb and nothing in slot 2 show a blade tile with a
//     Flame edge and one pip, a shield tile with a Ward edge, a lamp tile and a dashed empty tile, and the label names each;
//   six layouts: with all four slots full, 40 px tiles at the bottom left at 1280x720 and 800x600; under the life row in one line of at most
//     300 px with 32 px tiles at 390x844, 360x640 and 320x640; 28 px tiles at 844x390; the row overlaps no control, and the touch
//     ability (and Off-hand, once the hub builder's #bOff is there) buttons are 44 px or more with their marks;
//   read on a grey screen: with the page in greyscale, each colour keeps its own corner shape and each tier its own pips;
//   the compare toast: at 320x640 on a blazing Sling with two traits while holding a plain Buckler, two lines, "Off-hand: Buckler" over
//     "Off-hand: Sling, blazing" with its two traits and "Hold Off-hand to swap", clear of the touch buttons.
// Screenshots go to SHOTS (a folder) when it is set.
// Needs this tree served:   python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-gear-hud.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const SAVE = { v: 4, seen: true, bank: 0, kindled: ['hook', 'twin', 'bell', 'sling', 'pot', 'flare', 'rime'], up: { panes: 1 }, panes: ['thick', 'hot'] };
async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(o => { try { localStorage.setItem('gloam-downs.run.v4', JSON.stringify(o)); } catch {} }, SAVE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/?run&test&seed=7`);
  await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.run().mode === 'lamp', null, { timeout: 180000 });
  if (ctxOpts.hasTouch) await page.tap('#bLampBegin'); else await page.click('#bLampBegin');
  await page.waitForFunction(() => window.__gloam.run().mode === 'play', null, { timeout: 180000 });
  return { ctx, page, errors };
}
const rectOf = (page, sel) => G(page, s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, sel);
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const FULL = { blade: { id: 'hook', tier: 'bright', traits: ['smoulder'] }, offhand: { id: 'buckler', tier: 'plain', traits: [] } };
const FULL_AB = [{ id: 'bomb', tier: 'blazing', traits: ['quick', 'wide'] }, { id: 'flare', tier: 'plain', traits: [] }];
const LAYOUTS = [
  { w: 1280, h: 720, desk: true, tile: 40 }, { w: 800, h: 600, desk: true, tile: 40 },
  { w: 390, h: 844, tile: 32 }, { w: 360, h: 640, tile: 32 }, { w: 320, h: 640, tile: 32 }, { w: 844, h: 390, tile: 28 }
];

try {
  /* ---------------- the row by category ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'bomb' }, null] }));
    await G(page, o => window.__gloam.gear(o), FULL);
    await tick(page, 0.1);
    await G(page, () => window.__gloam.draw());
    const tiles = await G(page, () => [...document.querySelectorAll('#gear > .gt')].map(t => t.className));
    assert.match(tiles[0], /k-blade c-flame t-bright/);
    assert.match(tiles[1], /k-offhand c-ward t-plain/);
    assert.match(tiles[2], /k-ability c-flame t-plain/);
    assert.match(tiles[3], /empty k-ability/);
    assert.equal(await G(page, () => document.querySelector('#gear > .gt').querySelectorAll('.pips i').length), 1, 'one pip on the bright blade');
    const label = await page.getAttribute('#gear', 'aria-label');
    assert.match(label, /^Blade: Hook blade, bright, Smouldering\. Off-hand: Buckler, plain\. Ability 1: Lantern bomb, plain\. Ability 2: empty\./);
    assert.deepEqual(errors, []);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-row-1280x720.png` });
    pass('the row by category: a Flame blade tile with one pip, a Ward shield, a lamp tile and a dashed empty tile, and the label', { label });
    await ctx.close();
  }

  /* ---------------- six layouts ---------------- */
  for (const L of LAYOUTS) {
    const touch = !L.desk;
    const { ctx, page, errors } = await open({ viewport: { width: L.w, height: L.h }, ...(touch ? TOUCH : {}) });
    await G(page, a => window.__gloam.set({ abilities: a }), FULL_AB);
    await G(page, o => window.__gloam.gear(o), FULL);
    await tick(page, 0.1);
    await G(page, () => window.__gloam.draw());
    const row = await rectOf(page, '#gear');
    const tile = await rectOf(page, '#gear > .gt');
    assert(row && tile, 'the gear row shows');
    assert.equal(Math.round(tile.w), L.tile, `${L.w}x${L.h}: tiles ${tile.w}`);
    const life = await rectOf(page, '#life');
    if (L.desk) {
      assert(row.x < 40 && row.y + row.h > L.h - 80, `${L.w}x${L.h}: at the bottom left ${JSON.stringify(row)}`);
    } else {
      assert(row.w <= 300 + 0.5, `${L.w}x${L.h}: one line of at most 300 px, ${row.w}`);
      assert(row.h <= L.tile + 8, `${L.w}x${L.h}: one line, ${row.h} px high`);
      assert(life && row.y >= life.y + life.h - 1 && row.y < life.y + life.h + 12, `${L.w}x${L.h}: under the life row ${JSON.stringify([life, row])}`);
    }
    assert(row.x >= 0 && row.x + row.w <= L.w && row.y >= 0 && row.y + row.h <= L.h, 'inside the screen');
    // it covers no control: the Lab bar, the tools, the boss bar and every touch button
    const controls = ['.labbar', '#tools', '#bossBar', '#bJump', '#bAttack', '#bRoll', '#bHeal', '#bAb1', '#bAb2', '#bOff', '#stick', '#where', '#count'];
    for (const c of controls) { const r = await rectOf(page, c); assert(!overlap(row, r), `${L.w}x${L.h}: the row covers ${c} ${JSON.stringify([row, r])}`); }
    if (touch) {
      for (const b of ['#bAb1', '#bAb2', '#bOff']) {
        const r = await rectOf(page, b);
        if (!r) { assert.notEqual(b, '#bAb1', 'the ability button shows'); continue; }
        assert(Math.min(r.w, r.h) >= 44, `${b} is ${r.w}x${r.h}`);
        const mark = await G(page, s => { const m = document.querySelector(`${s} > .bm`); return m ? { svg: m.querySelectorAll('svg').length, pips: m.querySelectorAll('.pips i').length } : null; }, b);
        assert(mark && mark.svg >= 1, `${b} has its mark`);
        if (b === '#bAb1') assert.equal(mark.pips, 2, 'the blazing bomb has two pips on its button');
      }
    }
    assert.deepEqual(errors, []);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-${L.w}x${L.h}.png` });
    pass(`six layouts: ${L.w}x${L.h}, ${L.tile} px tiles${L.desk ? ' at the bottom left' : ', under the life row'}, clear of every control`, { row: [Math.round(row.x), Math.round(row.y), Math.round(row.w), Math.round(row.h)] });
    await ctx.close();
  }

  /* ---------------- a grey screen ---------------- */
  {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
    await G(page, a => window.__gloam.set({ abilities: a }), [{ id: 'bomb', tier: 'blazing', traits: ['quick', 'wide'] }, { id: 'rime', tier: 'bright', traits: ['char'] }]);
    await G(page, o => window.__gloam.gear(o), { blade: { id: 'twin', tier: 'plain', traits: [] }, offhand: { id: 'buckler', tier: 'bright', traits: ['dim'] } });
    await tick(page, 0.1);
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    await G(page, () => window.__gloam.draw());
    const marks = await G(page, () => [...document.querySelectorAll('#gear > .gt')].slice(0, 4).map(t => ({ shape: t.querySelector('.cs path')?.getAttribute('d'), pips: t.querySelectorAll('.pips i').length, colour: [...t.classList].find(c => c.startsWith('c-')) })));
    // Gloam, Ward, Flame, Ward: three colours, three shapes, and the same shape for the same colour; plain, bright, blazing, bright pips
    const byColour = {};
    for (const m of marks) { byColour[m.colour] ||= m.shape; assert.equal(byColour[m.colour], m.shape); }
    assert.equal(new Set(Object.values(byColour)).size, Object.keys(byColour).length, 'each colour its own shape');
    assert.deepEqual(marks.map(m => m.pips), [0, 1, 2, 1]);
    if (SHOTS) await page.locator('#gear').screenshot({ path: `${SHOTS}/gear-grey.png` });
    pass('read on a grey screen: each colour keeps its own corner shape, and the pips tell plain, bright and blazing apart', { colours: Object.keys(byColour) });
    await ctx.close();
  }

  /* ---------------- the compare toast ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 320, height: 640 }, ...TOUCH });
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'bomb' }, { id: 'flare' }] }));
    await G(page, () => window.__gloam.gear({ offhand: { id: 'buckler' }, lay: { kind: 'offhand', id: 'sling', tier: 'blazing', traits: ['char', 'dim'] } }));
    await tick(page, 0.1);
    await G(page, () => window.__gloam.draw());
    const lines = await G(page, () => [...document.querySelectorAll('#compare p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()));
    const heights = await G(page, () => [...document.querySelectorAll('#compare p')].map(p => p.getBoundingClientRect().height));
    // two lines: the held one with how to swap, over the found one with its tier and two traits, and no numbers
    assert.equal(lines.length, 2);
    assert.equal(lines[0], 'Off-hand: Buckler Hold Off-hand to swap');
    assert.equal(lines[1], 'Off-hand: Sling, blazing, Charring, Dimming');
    assert(heights.every(h => h < 24), `each a single line: ${heights}`);
    assert(await G(page, () => { const t = document.getElementById('compare'), p = t.querySelector('p.found'); return p.scrollWidth <= t.clientWidth; }), 'the found line fits');
    const toast = await rectOf(page, '#compare');
    for (const b of ['#bAttack', '#bRoll', '#bHeal', '#bAb1', '#bAb2', '#bOff', '#bJump']) assert(!overlap(toast, await rectOf(page, b)), `the toast covers ${b}`);
    assert(toast.x >= 0 && toast.x + toast.w <= 320, 'inside the screen');
    assert.deepEqual(errors, []);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/compare-320x640.png` });
    // at 1280x720 it shows the numbers too
    pass('the compare toast at 320x640: "Off-hand: Buckler" over the blazing Sling with its two traits and how to swap, clear of the buttons', { lines });
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
    await G(page, () => window.__gloam.gear({ blade: { id: 'lamp' }, lay: { kind: 'blade', id: 'hook', tier: 'bright', traits: ['smoulder'] } }));
    await tick(page, 0.1);
    await G(page, () => window.__gloam.draw());
    const text = await G(page, () => [...document.querySelectorAll('#compare p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(text, ['Blade: Lamp blade, plain 10', 'Blade: Hook blade, bright, Smouldering 14 Hold Attack to swap']);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/compare-1280x720.png` });
    pass('the compare toast at 1280x720 shows each item\'s first number too', { text });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
