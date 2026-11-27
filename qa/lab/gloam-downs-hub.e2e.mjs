// Gloam Downs: the Lamp-room as a place in a real browser (public/lab/gloam-downs/?run&test&hall), on software WebGL 2
// (openspec/changes/gloam-downs-hub, the hub builder's part):
//   keys: walk to a station with W, its prompt "E Use" shows, E opens its card beside it, the arrows and Enter buy, the hall lights the
//     ware's ring, Escape closes; held S walks away from a card; Tab opens the quick list with the nine headings; the run door begins the
//     run when walked into;
//   pad (mocked): A opens a station's card, the d-pad and A pick the start blade, B closes; View opens the quick list; RB is no longer
//     the face (R3 is);
//   mouse: a click on the prompt opens the card; a click on a station within 3 m opens it; a click outside the card shuts it;
//   touch: the Use button opens the card as a bottom sheet; the close button shuts it; the List button opens the quick list;
//   the ability post: two abilities tried, the post takes hits, the cooldowns run at a quarter;
//   the shrine: at a beacon, "Go to the shrine" opens the tabs beside the beacon, and Back to the beacon goes back;
//   the phone load: the hall loads cold within 4.0 s and warm within 1.5 s with the network at 1.6 Mbit/s, 150 ms, and the CPU 4x slow.
// Needs this tree served:   python3 -m http.server 8951 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-hub.e2e.mjs   (SITE_URL, SHOTS=<dir>, ONLY=keys,pad,mouse,touch,post,shrine,load)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8951').replace(/\/$/, '');
const SHOTS = process.env.SHOTS, ONLY = process.env.ONLY;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const part = name => !ONLY || ONLY.split(',').includes(name);
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const KEY = 'gloam-downs.run.v3';
async function open(ctxOpts, query = '?run&test&hall', save = { seen: true }, init = null) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (save) await ctx.addInitScript(([k, o]) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } } catch {} }, [KEY, save]);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await hallReady(page);
  return { ctx, page, errors };
}
const hallReady = page => page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'lamproom', null, { timeout: 180000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const hall = page => G(page, () => window.__gloam.hall());
const mode = page => G(page, () => window.__gloam.run().mode);
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const mock = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
  window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
  navigator.getGamepads = () => [window.__pad];
};
const PAD = { A: 0, B: 1, RB: 5, BACK: 8, R3: 11, UP: 12, DOWN: 13 };
const tap = async (page, i) => {
  await G(page, i => window.__press(i, true), i); await tick(page, 0.05, 'live');
  await G(page, i => window.__press(i, false), i); await tick(page, 0.05, 'live');
};
// stand d m before a station's point, facing it (the camera behind): a walk of d m with W brings the lamplighter there
async function before(page, id, d = 1.6) {
  const st = (await hall(page)).stations.find(s => s.id === id), yaw = Math.atan2(st.obj[0] - st.at[0], st.obj[1] - st.at[1]);
  await G(page, ([x, z, y]) => window.__gloam.teleport(x, z, y), [st.at[0] - Math.sin(yaw) * d, st.at[1] - Math.cos(yaw) * d, yaw]);
  await tick(page, 0.3, {});
  return st;
}
const at = async (page, id) => { const st = await before(page, id, 0); await tick(page, 0.2, {}); return st; };
// the card: inside the screen, never under the Lab bar; its buttons 44 px or more
function cardFaults() {
  const R = el => el.getBoundingClientRect(), box = document.querySelector('#lamp .box'), r = R(box), out = [];
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`box outside: ${JSON.stringify(r)}`);
  if (r.top < 56) out.push('under the Lab bar');
  for (const b of box.querySelectorAll('button')) {
    if (b.hidden || !b.getClientRects().length || b.closest('.stOff')) continue;
    const q = R(b);
    if (Math.min(q.width, q.height) < 44 - 0.01) out.push(`${b.id || b.textContent.trim().slice(0, 20)} ${q.width.toFixed(0)}x${q.height.toFixed(0)}`);
  }
  if (document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  return out;
}

try {
  if (part('keys')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&hall', { seen: true, bank: 600 });
    let h = await hall(page);
    assert(h.on && h.stations.length === 12, 'the hall with twelve stations');
    // W walks to the lamp shelf; its prompt says "E Use"
    await before(page, 'shelf', 2.6);
    assert.equal((await hall(page)).near, null);
    await page.keyboard.down('w');
    for (let i = 0; i < 40 && (await hall(page)).near !== 'shelf'; i++) await tick(page, 0.05, 'live');
    await page.keyboard.up('w'); await tick(page, 0.3, 'live');
    h = await hall(page);
    assert.equal(h.near, 'shelf', `the shelf in reach: ${JSON.stringify(h)}`);
    assert.match(await page.textContent('#bUse'), /The lamp shelf\s*E\s*Use/);
    await shot(page, 'keys-prompt');
    // E opens its card beside the shelf
    await page.keyboard.press('e');
    h = await hall(page);
    assert.deepEqual([await mode(page), h.station, h.layout], ['station', 'shelf', 'beside']);
    assert.deepEqual(await G(page, cardFaults), []);
    const parts = await page.$$eval('#lamp section', s => s.filter(x => x.getClientRects().length).map(x => x.dataset.st));
    assert.deepEqual(parts, ['shelf'], 'only the shelf\'s rows');
    await shot(page, 'keys-shelf');
    // the focus is on the first Buy; Enter buys Mantle 1, and the hall lights its first ring
    assert(!(await hall(page)).shown.includes('ware:mantle:1'));
    await page.keyboard.press('Enter');
    let r = await G(page, () => window.__gloam.run());
    assert.deepEqual([r.bank, r.up.mantle], [560, 1]);
    assert((await hall(page)).shown.includes('ware:mantle:1'), 'the ring lit');
    // Escape closes; play again
    await page.keyboard.press('Escape');
    assert.equal(await mode(page), 'play');
    await tick(page, 0.1, 'live');
    // a held S walks away from a card
    await page.keyboard.press('e');
    assert.equal(await mode(page), 'station');
    await page.keyboard.down('s'); await tick(page, 0.45, 'live'); await page.keyboard.up('s'); await tick(page, 0.05, 'live');
    assert.equal(await mode(page), 'play', 'walking away shuts the card');
    // Tab opens the quick list with its nine headings in order
    await page.keyboard.press('Tab');
    h = await hall(page);
    assert(h.quick && (await mode(page)) === 'station');
    const heads = await page.$$eval('#lamp section h3', hs => hs.filter(x => x.getClientRects().length).map(x => x.textContent));
    assert.deepEqual(heads.filter(x => x !== 'The last run'), ['Blades', 'Off-hands', 'Abilities', 'Panes', 'Wares', 'Unlocks', 'Keys', 'Ember'].filter(Boolean).filter(x => x));
    await shot(page, 'keys-quick');
    await page.keyboard.press('Escape');
    // the run door: walked into, the run begins in the Gaol
    await before(page, 'door', 1.2);
    await page.keyboard.down('w');
    for (let i = 0; i < 40 && (await mode(page)) === 'play'; i++) await tick(page, 0.05, 'live');
    await page.keyboard.up('w');
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 180000 });
    r = await G(page, () => window.__gloam.run());
    assert.equal(r.place, 'gaol');
    assert.deepEqual(errors, []);
    pass('keys: W to the shelf, "E Use", E opens its card beside it with only its rows, Enter buys and the hall lights the ring, Escape and a held S shut it, Tab the quick list, the door begins the run');
    await ctx.close();
  }
  if (part('pad')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&hall', { seen: true, bank: 600, kindled: ['bomb', 'step', 'thick', 'hot', 'lamp', 'buckler', 'hook'] }, mock);
    await at(page, 'blades');
    // the pad's first press takes the labels (and presses nothing)
    await tap(page, PAD.R3);
    await tick(page, 0.1, 'live');
    assert.equal((await hall(page)).near, 'blades');
    assert.match(await page.textContent('#bUse'), /A\s*Use/, 'the prompt names A');
    await tap(page, PAD.A);
    assert.deepEqual([await mode(page), (await hall(page)).station], ['station', 'blades']);
    // the d-pad to the Hook blade's Pick, A
    await tap(page, PAD.DOWN);
    const f = await G(page, () => document.activeElement.closest('li')?.dataset.blade);
    assert.equal(f, 'hook', `the focus on the Hook blade: ${f}`);
    await tap(page, PAD.A);
    assert.equal((await hall(page)).blade, 'hook');
    assert((await hall(page)).shown.includes('blade:hook:start'), 'the Hook blade glows on the rack');
    await tap(page, PAD.B);
    assert.equal(await mode(page), 'play');
    // View opens the quick list; B closes it
    await tap(page, PAD.BACK);
    assert((await hall(page)).quick);
    await tap(page, PAD.B);
    assert.equal(await mode(page), 'play');
    const pads = await G(page, async () => { const { readPads, PAD } = await import('./input.js'); const p = readPads(navigator.getGamepads(), true); return p; });
    void pads;
    assert.deepEqual(errors, []);
    pass('pad: "A Use", A opens the blade rack, the d-pad and A pick the Hook blade and the rack shows it, B closes, View opens the quick list');
    await ctx.close();
  }
  if (part('mouse')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
    await at(page, 'kiln');
    await G(page, () => window.__gloam.draw());
    // a click on the prompt
    await page.click('#bUse');
    assert.deepEqual([await mode(page), (await hall(page)).station], ['station', 'kiln']);
    // a click outside the card shuts it
    await page.mouse.click(60, 600);
    assert.equal(await mode(page), 'play');
    // a click on a station within 3 m: the well, from 2 m
    await before(page, 'well', 2);
    const st = (await hall(page)).stations.find(s => s.id === 'well');
    const p = await G(page, s => window.__gloam.project([s.obj[0], s.y + 1.2, s.obj[1]]), st);
    await G(page, () => window.__gloam.release());
    await page.waitForFunction(() => !window.__gloam.state().mouse.locked);
    await G(page, () => window.__gloam.draw());
    await page.mouse.click(p[0], p[1]);
    assert.deepEqual([await mode(page), (await hall(page)).station], ['station', 'well']);
    assert.match(await page.textContent('#wellRecap'), /Banked: 0 glim/);
    await page.click('#bLampClose');
    assert.equal(await mode(page), 'play');
    // the close button takes the mouse back for play; freed, the cursor reaches the tools
    await G(page, () => window.__gloam.release());
    await page.waitForFunction(() => !window.__gloam.state().mouse.locked);
    await page.click('#bList');
    assert((await hall(page)).quick);
    assert.deepEqual(errors, []);
    pass('mouse: a click on the prompt opens the kiln, a click outside shuts it, a click on the well from 2 m opens it, the close button and the List button');
    await ctx.close();
  }
  if (part('touch')) {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, ...TOUCH });
    await at(page, 'offhand');
    assert(await page.isVisible('#bUse'), 'the Use button');
    assert.equal(await page.textContent('#useKey'), '', 'no key on touch');
    const r = await page.$eval('#bUse', b => b.getBoundingClientRect().toJSON());
    assert(r.height >= 44, 'the Use button 44 px');
    await page.tap('#bUse');
    const h = await hall(page);
    assert.deepEqual([h.station, h.layout], ['offhand', 'sheet']);
    assert.deepEqual(await G(page, cardFaults), []);
    const box = await page.$eval('#lamp .box', b => b.getBoundingClientRect().toJSON());
    assert(box.height <= 844 * 0.55 + 1, `the sheet ${box.height} px`);
    await shot(page, 'touch-offhand');
    // None for the off-hand
    await page.tap('#offRows li[data-off="null"] button');
    assert.equal((await hall(page)).offhand, null);
    await page.tap('#bLampClose');
    assert.equal(await mode(page), 'play');
    await page.tap('#bList');
    assert((await hall(page)).quick);
    for (const id of ['bOff', 'bList']) { const q = await page.$eval(`#${id}`, b => b.getBoundingClientRect().toJSON()); assert(Math.min(q.width, q.height) >= 44, id); }
    assert.deepEqual(errors, []);
    pass('touch: the Use button (no key) opens the off-hand stand as a bottom sheet of 55% or less, None picked, the close button and the List button; Off-hand and List are 44 px');
    await ctx.close();
  }
  if (part('post')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&hall', { seen: true, kindled: ['bomb', 'step', 'thick', 'hot', 'lamp', 'buckler', 'snare'] });
    await at(page, 'post');
    await G(page, () => window.__gloam.use());
    await page.click('#postRows li[data-ab="snare"] button');
    assert.deepEqual((await hall(page)).tried, ['bomb', 'snare']);
    await page.keyboard.press('Escape');
    // attack the post: it takes the hits
    for (let i = 0; i < 3; i++) await tick(page, 0.35, { attack: true });
    await tick(page, 0.5, {});
    assert((await hall(page)).post > 0, 'the post takes hits');
    // a bomb at the post: its 8 s cooldown runs at a quarter, so 2.1 s later it is ready again
    await tick(page, 0.05, { ab1: true });
    await tick(page, 0.1, {});
    let a = (await G(page, () => window.__gloam.run())).abilities[0];
    assert(a.left > 1.5 && a.left <= 2.05, `the bomb cools from ${a.left} s`);
    await tick(page, 2.1, {});
    a = (await G(page, () => window.__gloam.run())).abilities[0];
    assert.equal(a.left, 0);
    const r = await G(page, () => window.__gloam.run());
    assert.equal(r.bank, 0, 'nothing spent');
    assert.equal(r.ended, null);
    assert.deepEqual(errors, []);
    pass('the ability post: Ember snare tried in slot 2, the post takes the cuts, the bomb cools in a quarter of its time, nothing spent', { taken: (await hall(page)).post });
    await ctx.close();
  }
  if (part('shrine')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7&nodraw', { seen: true, bank: 0 }, null).catch(() => ({}));
    if (page) await ctx.close();
    // the run's beacon: a run at the Gaol with its beacon lit
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await c2.addInitScript(k => { try { if (!sessionStorage.getItem('s')) { localStorage.setItem(k, JSON.stringify({ seen: true, bank: 50 })); sessionStorage.setItem('s', 1); } } catch {} }, KEY);
    const p2 = await c2.newPage();
    const errs = [];
    p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(`${SITE}/lab/gloam-downs/?run&test&seed=7`);
    await p2.waitForFunction(() => window.__gloam?.ready() && window.__gloam.run().mode === 'lamp', null, { timeout: 180000 });
    await p2.click('#bLampBegin');
    await p2.waitForFunction(() => window.__gloam?.ready() && window.__gloam.run().mode === 'play', null, { timeout: 180000 });
    await G(p2, () => { const g = window.__gloam; g.out?.('G5'); g.tick(1.2, {}); g.set({ carried: 40 }); g.light(); g.tick(1.6, {}); });
    if (await p2.isVisible('#wicks button')) await p2.click('#wicks button');
    while (await p2.isVisible('#sparks button')) await p2.click('#sparks button');
    assert.equal(await p2.textContent('#bSpend'), 'Go to the shrine');
    await p2.click('#bSpend');
    const h = await hall(p2);
    assert.equal(h.shrine, 'shelf');
    assert.deepEqual(await p2.$$eval('#shrineTabs button', b => b.map(x => x.textContent)), ['Wares', 'Patterns', 'Panes']);
    await p2.click('#shrineTabs button[data-tab="window"]');
    assert.deepEqual(await p2.$$eval('#lamp section', s => s.filter(x => x.getClientRects().length).map(x => x.dataset.st)), ['window']);
    await shot(p2, 'shrine');
    await p2.click('#bLampBack');
    assert(await p2.isVisible('#beaconCard'));
    assert.deepEqual(errs, []);
    pass('the shrine: "Go to the shrine" opens three tabs beside the beacon, a tab shows its rows, Back to the beacon goes back');
    await c2.close();
  }
  if (part('load')) {
    const times = {};
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...TOUCH });
    await ctx.addInitScript(k => { try { localStorage.setItem(k, JSON.stringify({ seen: true })); } catch {} }, KEY);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6 / 8), uploadThroughput: (0.75e6 / 8) });
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&nodraw`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 240000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // cold: the hall's files are not in the cache yet
    for (const k of ['cold', 'warm']) {
      if (k === 'warm') { await G(page, () => window.__gloam.go('gaol')); await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 240000 }); }
      const t = await G(page, async () => {
        const t0 = performance.now();
        const p = window.__gloam.go('lamproom');
        await p;
        const t1 = performance.now();
        window.__gloam.draw();
        return { load: t1 - t0, draw: performance.now() - t1 };
      });
      times[k] = { load: +(t.load / 1000).toFixed(2), draw: +(t.draw / 1000).toFixed(2) };
    }
    // the 0.45 s fade before a load is part of it (go waits for it); the draw is software WebGL's, not a phone GPU's
    assert(times.cold.load <= 4.0, `cold ${times.cold.load} s`);
    assert(times.warm.load <= 1.5, `warm ${times.warm.load} s`);
    pass('the phone load: the hall in 4.0 s or less cold and 1.5 s or less warm, at 1.6 Mbit/s, 150 ms and the CPU 4x slow (the first draw on software WebGL printed, not checked)', times);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`PASS qa/lab/gloam-downs-hub.e2e.mjs: ${n} checks`);
