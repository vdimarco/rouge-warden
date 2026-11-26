// Gloam Downs: the selection screens in a real browser (openspec/changes/gloam-downs-screens-life, Part S), on software WebGL 2:
//   title: a returning player's load opens the title ("Gloam Downs", the seed and Ember line, Begin the run with the focus), the place
//     drifts behind it (the drawn yaw by 1 to 9 degrees after 6 s, the follow camera not turned), the lamps lit to the furthest place,
//     the arrow keys to lamp II and its line, and Enter on Begin the run starts the run in the Gaol;
//   beacon: the wick cards deal in; a mouse over the second wick lifts it 3 to 5 px, lights its glow and takes the focus, with one
//     hover, and with the focus moved off it by an arrow only the focused card is lit; a tap plays pick and no hover; the beacon's
//     point is on screen and outside the card at 390x844 and 844x390; a pad alone picks Gloam +1 with right, right and A (pick, and
//     screen-pick with colour gloam);
//   lamp: Mantle 2 reads "Mantle 2 of 8" with its glass filled 25%; 2, 3 and 4 columns at 390x844, 800x600 and 1280x720; a buy of
//     Mantle 1 for 40 of 75 rolls the glim line from 75 to 35 with 1 to 12 tally and buy, the focus kept; a kindle of Rime lamp lights
//     its tile in Ward's hue with kindle;
//   recap: a death on The Crow Wall by a Snuffer's hit: lamp I lit with its time and foes, lamp II snuffed, "Put out by a Snuffer"; the
//     win card's five lamps, the last bright;
//   layout: the title (the lamplighter clear of its words, lamps and buttons), How to play and Back, the beacon card (wicks, sparks,
//     after), the Lamp-room, the place's name (clear of the HUD and the lamplighter), the pause card, the summary, the win card and
//     the explorer's map at 320x640, 360x640, 390x844
//     and 844x390 with touch, and at 800x600 and 1280x720 with a mouse: no fault (inside the screen, no page scroll, buttons of 44 px,
//     nothing under ◀ Lab or Games), text of 14 px or more, and a contrast of 4.5:1 or more for each line of text;
//   away: the place's bed pauses under the game switcher and in a hidden tab, and comes back;
//   still: with reduced motion the title's view is the start camera's on every draw, a card's transform is none at every sample of the
//     deal-in, and no animation runs longer than 150 ms.
// The page runs with ?test&title: the game is stepped by __gloam.tick() and drawn by __gloam.draw(). Needs this tree served:
//   python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-screens.e2e.mjs   (SITE_URL for another port, SHOTS=<dir> keeps pictures, ONLY=title,beacon,lamp,recap,layout,away,still, SIZES=844x390,... for layout)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
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
// a saved bank with no run: a returning player
const RETURNING = (o = {}) => `localStorage.setItem('gloam-downs.run.v3', ${JSON.stringify(JSON.stringify({ v: 3, bank: 75, seen: true, runs: 2, deaths: 2, furthest: 1, ...o }))});`;
const mock = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
  window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
  navigator.getGamepads = () => [window.__pad];
};
async function open(ctxOpts, query, init) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  for (const s of [].concat(init || [])) await ctx.addInitScript(s);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page, mode) => page.waitForFunction(m => window.__gloam?.ready() && (!m || window.__gloam.run()?.mode === m || window.__gloam.state().mode === m), mode, { timeout: 120000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const active = page => G(page, () => document.activeElement?.id || document.activeElement?.dataset?.place || document.activeElement?.textContent);
const cues = (page, from = 0) => G(page, f => window.__gloam.sounds().slice(f).map(c => c.cue), from);
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const PAD = { A: 0, RIGHT: 15 };
const tap = async (page, i) => {
  await G(page, i => window.__press(i, true), i); await tick(page, 0.05, 'live');
  await G(page, i => window.__press(i, false), i); await tick(page, 0.05, 'live');
};
// put out the Gaol's keepers and light its beacon, carrying `carried` on: the beacon card opens with its wicks
const toBeacon = (page, carried = 44) => G(page, c => { const g = window.__gloam; g.out('G5'); g.tick(1.2, {}); g.set({ carried: c - 9 }); g.light(); g.tick(1.6, {}); }, carried);
// wait for the cards' motion to end (the deal-in, a flare, the recap), so a measure reads the card at rest
// (the cards' own: the loading screen's and the arrival card's fades are not the screens')
// (polled from here: in a page whose frames stall, Playwright's own polling stalls with them)
async function settle(page) {
  for (let t = 0; t < 150; t++) {
    if (await G(page, () => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.target?.closest?.('.panel')))) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`the cards still move: ${await G(page, () => JSON.stringify(document.getAnimations().filter(a => a.playState === 'running').map(a => [a.transitionProperty || a.animationName || a.id, a.effect?.target?.id || a.effect?.target?.className, a.currentTime])))}`);
}

/* the card that shows, measured in the page: as gloam-downs-run.cards.e2e.mjs cardFaults (inside the screen with no page scroll, each
   button 44 px or more, none under ◀ Lab or Games and none on another, every line of text inside the box), and here also the text: 14 px
   or more, and its colour on the first opaque fill behind it (the night when there is none) at 4.5:1 or more */
function screenFaults(id) {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = [], panel = document.getElementById(id), box = panel.querySelector('.box'), b = R(box);
  if (panel.hidden) return ['not shown'];
  if (!inside(b)) out.push(`box outside the screen ${JSON.stringify(b)}`);
  const scrolls = id === 'lamp';
  if (!scrolls && box.scrollHeight > box.clientHeight + 1) out.push(`box scrolls ${box.scrollHeight} > ${box.clientHeight}`);
  if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  const lab = [R(document.querySelector('.labbar .back')), R(document.getElementById('menu'))];
  const btns = [...box.querySelectorAll('button')].filter(x => !x.hidden && x.getClientRects().length && !x.classList.contains('ghost'));
  const foot = scrolls ? [...document.querySelectorAll('#lampRow button')].filter(x => !x.hidden && x.getClientRects().length) : [];
  btns.forEach((x, i) => {
    if (scrolls) x.scrollIntoView({ block: 'nearest' });
    const r = R(x), name = x.id || x.textContent.trim();
    if (Math.min(r.width, r.height) < 44 - 0.01) out.push(`${name} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (!inside(r)) out.push(`${name} outside the screen`);
    if (lab.some(l => over(r, l))) out.push(`${name} under the Lab bar`);
    if (scrolls) { if (!foot.includes(x) && foot.some(y => over(r, R(y)))) out.push(`${name} under the card's own buttons`); }
    else btns.slice(i + 1).forEach(y => { if (over(r, R(y))) out.push(`${name} over ${y.id || y.textContent.trim()}`); });
  });
  if (scrolls) box.scrollTop = 0;
  // the text: inside the box, 14 px or more, and 4.5:1 on its fill
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, bl]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl); };
  const fill = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) >= 0.5) return c; } return [5, 6, 12]; };
  for (const el of box.querySelectorAll('h1, h2, h3, p, li, dt, dd, span, b, button, em')) {
    if (el.hidden || !el.getClientRects().length || el.closest('[hidden], .ghost')) continue;
    const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
    const r = R(el);
    if (['h2', 'p', 'li', 'dt', 'dd', 'span'].includes(el.localName) && (r.left < b.left - 0.5 || r.right > b.right + 0.5 || el.scrollWidth > el.clientWidth + 1)) out.push(`text outside the box: ${el.textContent.trim().slice(0, 30)}`);
    if (!own) continue;
    const cs = getComputedStyle(el), size = parseFloat(cs.fontSize);
    if (size < 14 - 0.01) out.push(`${el.textContent.trim().slice(0, 24)}: ${size}px`);
    const c = rgb(cs.color);
    // a title filled by its gradient (the brand) and a number drawn by data-roll are read from their own colours
    if ((c[3] ?? 1) < 0.5) continue;
    const L1 = lum(c), L2 = lum(fill(el)), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5 && !el.matches('button[aria-disabled="true"], button:disabled, button:disabled *')) out.push(`${el.textContent.trim().slice(0, 24)}: contrast ${ratio.toFixed(2)}`);
  }
  return out;
}
const faults = (page, id) => G(page, screenFaults, id);

try {
  /* ---------------- the title ---------------- */
  if (part('title')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH }, '?run&test&seed=7&title', RETURNING());
    assert(await page.isVisible('#title'), 'a returning player\'s load opens the title');
    assert.match(await page.textContent('#title'), /Gloam Downs/);
    assert.match(await page.textContent('#titleSeed'), /^Seed 000007 · Ember 0$/);
    assert.equal(await active(page), 'bTitleBegin', 'Begin the run has the focus');
    assert.equal((await run(page)).mode, 'title');
    // the drift: 6 s of game time
    const c0 = await G(page, () => { window.__gloam.draw(); return window.__gloam.state().cam; });
    await tick(page, 6, {});
    const c1 = await G(page, () => { window.__gloam.draw(); return window.__gloam.state().cam; });
    const dy = Math.abs(c1.drawn.yaw - c1.yaw) * 180 / Math.PI;
    assert(dy > 1 && dy <= 9, `the drawn yaw moved ${dy.toFixed(2)} degrees from the start camera's`);
    assert(Math.abs(c1.yaw - c0.yaw) < 1e-9, 'the follow camera did not turn');
    pass('the title over the live place: "Seed 000007 · Ember 0", Begin the run with the focus, and the place drifts', { dy: +dy.toFixed(2) });
    await shot(page, 'title-390x844');
    // the lamps: I and II lit; the arrow keys go up to the lamps and left to lamp II, which lights fully and names its place
    const lamps = await G(page, () => window.__gloam.screens().lamps.map(l => l.lit));
    assert.deepEqual(lamps, [true, true, false, false, false]);
    const before = (await cues(page)).length;
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await active(page), 'ramparts', 'the focus is on lamp II');
    const s = await G(page, () => window.__gloam.screens());
    assert.deepEqual(s.lamps.map(l => l.on), [false, true, false, false, false]);
    assert.equal(s.line, 'II · The Crow Wall. A broken wall rides the downs as the storm light dies');
    assert((await cues(page, before)).includes('hover'), 'a lamp under the focus plays hover');
    // a press on a lamp in a run does not start a place
    await page.keyboard.press('Enter');
    assert.equal((await run(page)).mode, 'title');
    pass('lamps I and II lit; the arrows reach lamp II, which lights fully, names "II · The Crow Wall" with its subtitle and plays hover');
    // Begin the run starts the run in the Gaol
    await page.focus('#bTitleBegin');
    await page.keyboard.press('Enter');
    const r = await run(page);
    assert.deepEqual([r.mode, r.place, r.seed], ['play', 'gaol', 7]);
    assert(!(await page.isVisible('#title')));
    assert.deepEqual(errors, []);
    pass('Enter on Begin the run starts the run in the Gaol at once (a returning player), with the seed the title showed');
    await ctx.close();
  }

  /* ---------------- the beacon card ---------------- */
  if (part('beacon')) {
    for (const [w, h, opts] of [[390, 844, TOUCH], [844, 390, TOUCH]]) {
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...opts }, '?run&test&fresh&seed=7');
      await G(page, () => document.getElementById('bBegin').click());
      await toBeacon(page);
      assert(await page.isVisible('#beaconCard'));
      await settle(page);
      const v = await G(page, () => { window.__gloam.draw(); const p = window.__gloam.project(window.__gloam.points().beacon), r = document.querySelector('#beaconCard .box').getBoundingClientRect(); return { p, r: r.toJSON(), w: innerWidth, h: innerHeight }; });
      const [x, y] = v.p, inBox = x >= v.r.left && x <= v.r.right && y >= v.r.top && y <= v.r.bottom;
      assert(x >= 0 && x <= v.w && y >= 0 && y <= v.h, `the beacon is on screen at ${w}x${h}: ${v.p}`);
      assert(!inBox, `the beacon is outside the card at ${w}x${h}: ${v.p} in ${JSON.stringify(v.r)}`);
      if (h > w) assert(v.r.top >= 0.58 * h - 0.5, `a bottom sheet whose top (${v.r.top}) is at or under 58% of the height`);
      else assert(v.r.width <= 0.46 * w + 0.5 && v.r.right > w * 0.9, `at the right in at most 46% of the width (${v.r.width})`);
      await shot(page, `beacon-${w}x${h}`);
      assert.deepEqual(errors, []);
      pass(`the beacon stays in view at ${w}x${h}: its point outside the card`, { beacon: v.p.map(Math.round), card: [v.r.left, v.r.top, v.r.width, v.r.height].map(Math.round) });
      if (w === 390) { // a tap on a wick: touch has no hover, so the tap plays pick and no hover, and the bus hears no screen-hover
        const from = (await cues(page)).length, bus0 = (await G(page, () => window.__gloam.screens().bus)).length;
        await page.tap('#wicks button.lcard:nth-child(2)');
        const c = await cues(page, from), bus = (await G(page, () => window.__gloam.screens().bus)).slice(bus0);
        assert(c.includes('pick') && !c.includes('hover'), `a tap played ${c}`);
        assert(!bus.some(e => e.name === 'screen-hover'), JSON.stringify(bus));
        pass('a tap on a wick plays pick and no hover', c);
      }
      await ctx.close();
    }
    { // the mouse over the second wick card at 1280x720: 3 to 5 px higher within 200 ms, its glow at 1, one hover
      const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7');
      await G(page, () => document.getElementById('bBegin').click());
      await toBeacon(page);
      await settle(page);
      const cards = await page.$$('#wicks button.lcard');
      assert.equal(cards.length, 2, 'two wick cards');
      assert(await G(page, () => [...document.querySelectorAll('#wicks .lcard')].every(b => b.querySelector('.glass .flame') && b.querySelector('.glow'))), 'each wick is a lamp card with a glass');
      const rest = await cards[1].boundingBox();
      await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height + 120);
      await page.waitForTimeout(250);
      const from = (await cues(page)).length;
      await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
      await page.waitForTimeout(200);
      const up = await G(page, () => { const b = document.querySelectorAll('#wicks button.lcard')[1]; return { top: b.getBoundingClientRect().top, glow: +getComputedStyle(b.querySelector('.glow')).opacity }; });
      const lift = rest.y - up.top;
      assert(lift >= 3 && lift <= 5, `the card rose ${lift} px`);
      assert.equal(up.glow, 1, 'its glow is at full');
      assert.deepEqual((await cues(page, from)).filter(c => c === 'hover'), ['hover']);
      const bus = await G(page, () => window.__gloam.screens().bus);
      assert(bus.some(e => e.name === 'screen-hover' && e.kind === 'wick' && e.colour === 'wick'), 'the bus heard screen-hover');
      pass('a mouse over the second wick: it rises 3 to 5 px within 200 ms, its glow is 1, hover plays once, and the bus hears screen-hover', { lift });
      // the mouse takes the focus, so one card is lit: the one Enter takes. An arrow then moves the focus and the light with it
      assert.equal(await G(page, () => [...document.querySelectorAll('#wicks button.lcard')].indexOf(document.activeElement)), 1, 'the card under the mouse has the focus');
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(400);
      const lit = await G(page, () => [...document.querySelectorAll('#wicks button.lcard')].map(b => +getComputedStyle(b.querySelector('.glow')).opacity));
      assert(lit[0] === 1 && lit[1] < 0.5, `one card lit with the mouse on the other: ${lit}`);
      await page.keyboard.press('ArrowRight');
      pass('the mouse moves the focus; with the focus on one card and the mouse on another, only the focused card is lit', { lit });
      await shot(page, 'beacon-hover-1280x720');
      // a click picks at once: the wick is taken on the press, pick plays, the spark cards deal in with reveal
      const f2 = (await cues(page)).length;
      await page.mouse.click(rest.x + rest.width / 2, rest.y + rest.height / 2);
      const r = await run(page);
      assert(r.wicks.length === 1 && !r.offer, 'the wick is chosen on the press');
      const c2 = await cues(page, f2);
      assert(c2.includes('pick') && c2.includes('reveal'), c2.join(','));
      assert.deepEqual(await page.$$eval('#sparks button', bs => bs.map(b => b.dataset.spark)), ['flame', 'ward', 'gloam']);
      await settle(page);
      await shot(page, 'beacon-sparks-1280x720');
      assert.deepEqual(errors, []);
      pass('a click on a wick: chosen on the press, pick, then the three spark cards deal in with reveal', c2);
      await ctx.close();
    }
    { // a pad alone: right twice and A on the spark cards takes Gloam +1
      const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH }, '?run&test&fresh&seed=7', mock);
      await G(page, () => document.getElementById('bBegin').click());
      await toBeacon(page);
      await G(page, () => document.querySelector('#wicks button').click());
      // the pad's first press takes the labels and presses nothing
      await tap(page, PAD.RIGHT);
      await G(page, () => document.querySelector('#sparks button').focus());
      const from = (await cues(page)).length;
      await tap(page, PAD.RIGHT);
      await tap(page, PAD.RIGHT);
      assert.equal(await G(page, () => document.activeElement.dataset.spark), 'gloam');
      await tap(page, PAD.A);
      const r = await run(page);
      assert.deepEqual(r.sparks, { flame: 0, ward: 0, gloam: 1 });
      assert((await cues(page, from)).includes('pick'));
      const bus = await G(page, () => window.__gloam.screens().bus);
      assert(bus.some(e => e.name === 'screen-pick' && e.kind === 'spark' && e.colour === 'gloam'), JSON.stringify(bus));
      assert(bus.some(e => e.name === 'screen-pick' && e.kind === 'wick' && e.colour === 'wick'), 'the wick\'s pick too');
      assert.deepEqual(errors, []);
      pass('a pad alone: right, right and A take Gloam +1; pick plays and the bus hears screen-pick with colour gloam');
      await ctx.close();
    }
  }

  /* ---------------- the Lamp-room ---------------- */
  if (part('lamp')) {
    const columns = {};
    for (const [w, h, opts, want] of [[390, 844, TOUCH, 2], [800, 600, {}, 3], [1280, 720, {}, 4]]) {
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...opts }, '?run&test&seed=7&title', RETURNING({ up: { mantle: 2 } }));
      await G(page, () => document.getElementById('bTitleLamp').click());
      assert(await page.isVisible('#lamp'));
      const t = await G(page, () => {
        const li = document.querySelector('#ups li[data-up="mantle"]'), g = li.querySelector('.glass'), f = li.querySelector('.fill');
        const tops = new Set([...document.querySelectorAll('#ups li')].slice(0, 4).map(x => Math.round(x.getBoundingClientRect().top)));
        const row = [...document.querySelectorAll('#ups li')].filter(x => Math.abs(x.getBoundingClientRect().top - document.querySelector('#ups li').getBoundingClientRect().top) < 2).length;
        return { text: li.querySelector('.nm').textContent, fill: f.getBoundingClientRect().height / g.getBoundingClientRect().height, row, tops: tops.size, shelves: [...document.querySelectorAll('#lamp h3.shelf')].filter(x => !x.hidden).map(x => x.textContent) };
      });
      await settle(page);
      assert.equal(t.text, 'Mantle 2 of 8');
      assert(Math.abs(t.fill - 0.25) < 0.02, `the glass is filled ${t.fill}`);
      assert.equal(t.row, want, `${t.row} columns at ${w}x${h}`);
      assert.deepEqual(t.shelves.slice(0, 1), ['Wares']);
      columns[`${w}x${h}`] = t.row;
      await shot(page, `lamp-${w}x${h}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    pass('Mantle 2 reads "Mantle 2 of 8" with its glass filled 25%; the ware tiles stand in 2, 3 and 4 columns', columns);
    { // a buy: Mantle 1 for 40 with 75 banked
      const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&title', RETURNING({ patterns: ['rime'], bank: 75 }));
      await G(page, () => document.getElementById('bTitleLamp').click());
      await settle(page);
      await page.focus('#ups li[data-up="mantle"] button');
      const from = (await cues(page)).length;
      const shown = () => G(page, () => { const b = document.querySelectorAll('#lampLine b.bank')[0]; return b.dataset.roll ?? b.textContent; });
      // the press and the first read in one task of the page, so a slow machine cannot let the roll start between them
      const at = await G(page, () => { document.activeElement.click(); const b = document.querySelectorAll('#lampLine b.bank')[0]; return b.dataset.roll ?? b.textContent; });
      await page.waitForTimeout(450);
      const after = await shown();
      assert.match(at, /^75 glim$/, `at once: ${at}`);
      assert.match(after, /^35 glim$/, `after 400 ms: ${after}`);
      const c = await cues(page, from), tallies = c.filter(x => x === 'tally').length;
      assert(c.includes('buy') && tallies >= 1 && tallies <= 12, c.join(','));
      assert.equal(await G(page, () => document.activeElement.closest('li')?.dataset.up), 'mantle', 'the focus stays on the Buy');
      pass('a buy of Mantle 1: the glim line shows 75 at once and 35 after 400 ms, with buy and 1 to 12 tally; the focus stays', { tallies });
      // a kindle: Rime lamp (120) with 35: too little; then 200 banked
      await G(page, () => window.__gloam.set({ bank: 200 }));
      const f2 = (await cues(page)).length;
      await page.click('#patterns li[data-pattern="rime"] button');
      const k = await G(page, () => { const li = document.querySelector('#patterns li[data-pattern="rime"]'); return li && { kindled: li.classList.contains('kindled'), hue: getComputedStyle(li.querySelector('.glass')).getPropertyValue('--hue').trim(), flame: +getComputedStyle(li.querySelector('.flame')).opacity }; });
      assert(k?.kindled, 'the tile stays as a lit lamp');
      assert.equal(k.hue, '#8fd6a0', 'in Ward\'s hue');
      assert((await cues(page, f2)).includes('kindle'));
      await settle(page);
      await shot(page, 'lamp-kindle-1280x720');
      assert.deepEqual(errors, []);
      pass('a kindle of Rime lamp: its tile shows a lit glass in Ward\'s hue, and kindle plays', k);
      await ctx.close();
    }
  }

  /* ---------------- the recap ---------------- */
  if (part('recap')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH }, '?run&test&fresh&seed=7');
    await G(page, () => document.getElementById('bBegin').click());
    await tick(page, 1, {});
    await toBeacon(page);
    await G(page, () => { document.querySelector('#wicks button').click(); document.querySelector('#sparks button').click(); document.getElementById('bWalkOn').click(); });
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'ramparts' && window.__gloam.run().mode === 'play', null, { timeout: 120000 });
    await G(page, () => { const g = window.__gloam, s = g.state(); g.tick(2, {}); g.spawn('S', s.x + 1, s.z + 1); g.hurt(500, [s.x + 1, s.z + 1]); g.tick(1.3, {}); });
    assert(await page.isVisible('#summary'));
    const e = (await run(page)).ended;
    assert.deepEqual([e.by, e.path.map(p => p.id)], ['S', ['gaol', 'ramparts']]);
    const lamps = await page.$$eval('#sumPath li', ls => ls.map(l => [l.className, l.querySelector('.t').textContent, l.querySelector('.f').textContent]));
    const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    assert.deepEqual(lamps[0], ['lit', fmt(e.path[0].time), `${e.path[0].foes} foes`]);
    assert.equal(lamps[1][0], 'snuffed');
    assert.deepEqual(lamps.slice(2).map(l => l[0]), ['dark', 'dark', 'dark']);
    assert.equal(await page.textContent('#sumBy'), 'Put out by a Snuffer');
    const rows = await page.$$eval('#summary dt', ds => ds.map(d => d.textContent));
    assert.deepEqual(rows, ['Time', 'Foes put out', 'Glim', 'Patterns kept', 'Sparks', 'Best combo']);
    assert.equal(await active(page), 'bSumLamp', 'the main button has the focus from the start');
    await settle(page);
    await shot(page, 'summary-390x844');
    assert.deepEqual(errors, []);
    pass('a death on The Crow Wall by a Snuffer: lamp I lit with its time and foes, lamp II snuffed, "Put out by a Snuffer"', { lamps });
    await ctx.close();
    // the win card: five lamps lit, the last bright, from a stored win
    const path = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'].map((id, i) => ({ id, time: 100 + i * 10, foes: 6 + i }));
    const won = RETURNING({ wins: 1, ended: { won: true, place: 'barrows', time: 600, foes: 40, kept: 58, lost: 0, banked: 58, ember: 0, combo: 7, seed: 7, patternsKept: 1, patternsLost: 0, path, colours: { flame: 3, ward: 1, gloam: 2 }, patternNames: ['rime'], by: null } });
    const w = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7', won);
    assert(await w.page.isVisible('#winCard'));
    const wl = await w.page.$$eval('#winPath li', ls => ls.map(l => l.className));
    assert.deepEqual(wl, ['lit', 'lit', 'lit', 'lit', 'bright']);
    assert.match(await w.page.textContent('#winCard dl'), /Patterns keptRime lamp.*SparksFlame 3 · Ward 1 · Gloam 2.*Best combo×7/);
    await settle(w.page);
    await shot(w.page, 'win-1280x720');
    assert.deepEqual(w.errors, []);
    pass('the win card: five lamps, the last bright, with the patterns kept, the sparks and the best combo');
    await w.ctx.close();
  }

  /* ---------------- every screen at every layout ---------------- */
  if (part('layout')) {
    const SIZES = [[320, 640, TOUCH], [360, 640, TOUCH], [390, 844, TOUCH], [844, 390, TOUCH], [800, 600, {}], [1280, 720, {}]].filter(([w, h]) => !process.env.SIZES || process.env.SIZES.split(',').includes(`${w}x${h}`));
    const seen = {};
    for (const [w, h, opts] of SIZES) {
      const label = `${w}x${h}`, list = [];
      const check = async (page, id, name) => {
        await settle(page);
        const f = await faults(page, id);
        assert.deepEqual(f, [], `${name} at ${label}`);
        list.push(name);
        await shot(page, `layout-${name}-${label}`);
      };
      { // the title, the Lamp-room from it, a beacon's wicks, sparks and after, and the summary
        const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...opts }, '?run&test&seed=7&title', RETURNING({ emberTop: 2, ember: 1, patterns: ['rime', 'snare'], up: { mantle: 2, belt: 1 } }));
        await check(page, 'title', 'title');
        // the lamplighter stands clear of the title's words, lamps and buttons: its feet, middle and head are on screen and on none
        const fig = await G(page, () => {
          const g = window.__gloam;
          g.draw();
          const v = g.state().cam.drawn, b = v.body;
          const pts = [0.1, 0.9, 1.7].map(y => g.project([b.x, b.y + y, b.z], v));
          const rects = [...document.querySelectorAll('#title .tbrand h1, #title .tplace, #title .lamps:not([hidden]), #title .tline, #title .seedrow:not([hidden]), #title .row:not([hidden]), .labbar a, .labbar button, #menu')]
            .filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, n: e.id || e.className }; });
          return { pts, rects };
        });
        for (const p of fig.pts) {
          assert(p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h, `the lamplighter is on screen at ${label}: ${p}`);
          const on = fig.rects.find(r => p[0] >= r.l && p[0] <= r.r && p[1] >= r.t && p[1] <= r.b);
          assert(!on, `the lamplighter (${p.map(Math.round)}) is under ${on?.n} at ${label}`);
        }
        list.push('title-figure');
        // How to play from the title, and Back to the title
        await G(page, () => document.getElementById('bTitleHelp').click());
        await check(page, 'runHelp', 'help');
        await G(page, () => document.getElementById('bHelpBack').click());
        assert(await page.isVisible('#title'), `Back on How to play goes to the title at ${label}`);
        await G(page, () => document.getElementById('bTitleLamp').click());
        await check(page, 'lamp', 'lamp');
        await G(page, () => document.getElementById('bLampBegin').click());
        await G(page, () => { const r = window.__gloam.run(); if (r.abilityOffer) document.querySelector('#wicks button').click(); });
        await toBeacon(page, 120);
        await check(page, 'beaconCard', 'beacon-wicks');
        await G(page, () => document.querySelector('#wicks button').click());
        await check(page, 'beaconCard', 'beacon-sparks');
        await G(page, () => document.querySelector('#sparks button').click());
        await check(page, 'beaconCard', 'beacon-after');
        await G(page, () => { const g = window.__gloam; g.set({ bank: 999 }); document.getElementById('bSpend').click(); });
        await check(page, 'lamp', 'lamp-beacon');
        await G(page, () => { document.getElementById('bLampBack').click(); document.getElementById('bWalkOn').click(); });
        await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.run().mode === 'play', null, { timeout: 120000 });
        // the place's name as it arrives: on no line of the HUD (the hint waits under it) and not over the lamplighter
        const arr = await G(page, () => {
          const g = window.__gloam;
          g.tick(0.4, {});
          g.draw();
          const R = el => el.getBoundingClientRect(), rg = document.createRange();
          rg.selectNodeContents(document.getElementById('arriveName'));
          const a = rg.getBoundingClientRect(), shown = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05;
          const over = r => a.left < r.right && r.left < a.right && a.top < r.bottom && r.top < a.bottom;
          const hud = [...document.querySelectorAll('.hud > *, .tools button, .labbar a, .labbar button, #menu')].filter(shown).filter(e => over(R(e))).map(e => e.className || e.id);
          const v = g.state().cam.drawn, b = v.body, fig = [0.2, 0.9, 1.6].map(y => g.project([b.x, b.y + y, b.z], v)).filter(p => p && p[0] >= a.left && p[0] <= a.right && p[1] >= a.top && p[1] <= a.bottom);
          return { shown: !document.getElementById('arrive').classList.contains('off'), hud, fig: fig.length, a: [a.left, a.top, a.right, a.bottom].map(Math.round) };
        });
        assert(arr.shown, `the place's name shows at ${label}`);
        assert.deepEqual(arr.hud, [], `the place's name ${arr.a} runs over the HUD at ${label}`);
        assert.equal(arr.fig, 0, `the place's name ${arr.a} covers the lamplighter at ${label}`);
        list.push('arrive');
        await shot(page, `layout-arrive-${label}`);
        // the pause card: everything in view, Resume among it, with no scroll
        await G(page, () => { const g = window.__gloam; g.tick(4, {}); document.getElementById('bMap').click(); });
        await check(page, 'pause', 'pause');
        await G(page, () => document.getElementById('bResume').click());
        await G(page, () => { const g = window.__gloam, s = g.state(); g.spawn('S', s.x + 1, s.z + 1); g.hurt(500, [s.x + 1, s.z + 1]); g.tick(1.3, {}); });
        await check(page, 'summary', 'summary');
        assert.deepEqual(errors, []);
        await ctx.close();
      }
      { // the explorer's map
        const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...opts }, '?explore&test');
        await G(page, () => { if (!document.getElementById('help').hidden) document.getElementById('bStart').click(); });
        await G(page, () => document.getElementById('bMap').click());
        await check(page, 'map', 'map');
        assert.deepEqual(errors, []);
        await ctx.close();
      }
      { // the win card
        const path = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'].map((id, i) => ({ id, time: 100 + i * 10, foes: 6 + i }));
        const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...opts }, '?run&test&seed=7', RETURNING({ wins: 1, emberTop: 1, ended: { won: true, place: 'barrows', time: 600, foes: 40, kept: 58, lost: 0, banked: 58, ember: 0, opened: 1, combo: 7, seed: 7, patternsKept: 1, path, colours: { flame: 3, ward: 1, gloam: 2 }, patternNames: ['rime'] } }));
        await check(page, 'winCard', 'win');
        assert.deepEqual(errors, []);
        await ctx.close();
      }
      seen[label] = list;
    }
    pass('the title (with the lamplighter clear of it), How to play, the Lamp-room, the beacon card, the place\'s name, the pause card, the summary, the win card and the map fit at the six layouts, with text of 14 px or more at 4.5:1', seen);
  }

  /* ---------------- away: a hidden tab or the game switcher ---------------- */
  if (part('away')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH }, '?run&test&seed=7&title', RETURNING());
    await G(page, () => { window.__gloam.sound({ start: true }); document.getElementById('bTitleBegin').click(); });
    await page.waitForFunction(() => window.__gloam.sound()?.beds?.on, null, { timeout: 30000 });
    await G(page, () => window.GameSwitch.open());
    await page.waitForFunction(() => window.__gloam.sound().beds.paused, null, { timeout: 3000 }).catch(() => {});
    const open1 = await G(page, () => window.__gloam.sound().beds.paused);
    await G(page, () => window.GameSwitch.close());
    await page.waitForTimeout(200);
    const back1 = await G(page, () => window.__gloam.sound().beds.paused);
    await G(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hid = await G(page, () => window.__gloam.sound().beds.paused);
    await G(page, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(100);
    const back2 = await G(page, () => window.__gloam.sound().beds.paused);
    assert.deepEqual([open1, back1, hid, back2], [true, false, true, false], 'the bed under the switcher, back, in a hidden tab, back');
    assert.deepEqual(errors, []);
    pass('the place\'s bed stops under the game switcher and in a hidden tab, and comes back with the player');
    await ctx.close();
  }

  /* ---------------- reduced motion ---------------- */
  if (part('still')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...TOUCH }, '?run&test&fresh&seed=7&title');
    assert(await page.isVisible('#title'));
    for (let i = 0; i < 4; i++) {
      await tick(page, 1.5, {});
      const c = await G(page, () => { window.__gloam.draw(); return window.__gloam.state().cam; });
      assert(Math.abs(c.drawn.yaw - c.yaw) < 1e-9 && Math.abs(c.drawn.dist - c.dist) < 0.5, `the title's view is the start camera's: ${c.drawn.yaw} ${c.yaw}`);
    }
    await G(page, () => { document.getElementById('bTitleBegin').click(); document.getElementById('bBegin').click(); });
    await G(page, () => { const g = window.__gloam; g.out('G5'); g.tick(1.2, {}); g.light(); });
    // sample the cards' transforms through the deal-in, and every animation's length
    const samples = await G(page, async () => {
      const out = { transforms: new Set(), longest: 0 };
      window.__gloam.tick(1.6, {});
      for (let i = 0; i < 12; i++) {
        for (const b of document.querySelectorAll('#beaconCard .lcard')) out.transforms.add(getComputedStyle(b).transform);
        // the screens' own motion: animations on the cards (the Lab kit's toast keeps its own fade)
        for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.panel')) out.longest = Math.max(out.longest, a.effect.getComputedTiming().endTime ?? 0);
        await new Promise(r => setTimeout(r, 25));
      }
      // hover and focus keep the glow but not the rise
      const b = document.querySelector('#beaconCard .lcard');
      b.focus();
      out.focused = getComputedStyle(b).transform;
      out.glow = +getComputedStyle(b.querySelector('.glow')).opacity;
      return { transforms: [...out.transforms], longest: out.longest, focused: out.focused, glow: out.glow };
    });
    assert.deepEqual(samples.transforms, ['none'], JSON.stringify(samples));
    assert.equal(samples.focused, 'none');
    assert(samples.longest <= 150, `the longest animation is ${samples.longest} ms`);
    // a pick still works the same
    await G(page, () => document.querySelector('#wicks button').click());
    assert((await run(page)).wicks.length === 1);
    assert.deepEqual(errors, []);
    pass('reduced motion: the title\'s view is still, the cards never move, no animation is longer than 150 ms, and a pick works', samples);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
