// Gloam Downs' combat run in a real browser (public/lab/gloam-downs/?run), on software WebGL 2: the run's HUD and cards.
//   keys: the help card and Begin the run; the health line ("74/100", the bar, the pips); a toast 8 px under the HUD that lasts game
//     time; the beacon card's wick buttons, which nothing but a wick closes; Spend glim, Back to the beacon and Walk on; the pause
//     panel's places, the sound switch, Back to the start and End the run; a death, a reload in the fade and the run summary; the
//     Lamp-room's rows, a buy that keeps the focus, a Buy button that says how much more is needed, and Begin the run with Mantle;
//     a death with Ash pocket, and the summary after 72 steps of the fade;
//   pad: a mocked gamepad alone at the beacon card: Start, Back and B cannot pass the wicks; A chooses a wick, the d-pad reaches Spend
//     glim and the left stick Mantle's Buy, B goes back to the beacon with the focus on Walk on, and A walks on;
//   layout: every card, and the widest HUD with the longest toast, at 320x640, 360x640, 390x844 and 800x600 on a touch screen and at
//     1280x720 and 800x600 with a mouse: inside the screen with no scroll, buttons of 44 px or more, no button under ◀ Lab or Games and
//     no overlap; a tap beside a card does nothing; the HUD with the hint hidden (the boss fight) against the spec's rects.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(). Deaths and beacons go through the run's
// own hooks (__gloam.set, kill, light), so no foe is needed. Needs this tree served:
//   python3 -m http.server 8823 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-run.cards.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures, ONLY=keys|pad|layout)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8823').replace(/\/$/, '');
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
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page, mode) => page.waitForFunction(m => window.__gloam?.ready() && (!m || window.__gloam.run().mode === m), mode, { timeout: 120000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
/* the Gaol's beacon lights only once its keepers are out: put out the keep's three Snuffers (G5). Their 9 glim lie as motes far from the
   lamplighter, and the beacon counts them as carried (gloam-downs-growth: a lit beacon no longer banks), so the carried glim is set 9
   lower to carry `carried` in all into the next place */
const keepOut = (page, carried) => G(page, c => { const g = window.__gloam; g.out('G5'); g.tick(1.2, {}); g.set({ carried: c - 9 }); }, carried);
const active = page => G(page, () => document.activeElement?.id || document.activeElement?.textContent);
const text = (page, sel) => page.textContent(sel).then(t => t.trim());
const stored = page => G(page, () => JSON.parse(localStorage.getItem('gloam-downs.run.v4')));
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
// the longest toast in the run's data (the keepers by the broken wall, from foes.js) and one of 96 characters
const KEEPERS = 'The beacon will not catch while its keepers stand by the broken wall below the tower.';
const LONG = 'A toast of ninety-six characters, to check that a long line wraps under the HUD at every width.';
const mock = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
  window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
  navigator.getGamepads = () => [window.__pad];
};
// a pad button pressed for one step and let go
const tap = async (page, i) => {
  await G(page, i => window.__press(i, true), i); await tick(page, 0.05, 'live');
  await G(page, i => window.__press(i, false), i); await tick(page, 0.05, 'live');
};
const PAD = { A: 0, B: 1, BACK: 8, START: 9, UP: 12, DOWN: 13 };

/* the card that shows, measured in the page: its box inside the screen with no scroll, each button 44 px or more on its shorter side,
   inside the screen, under neither ◀ Lab nor Games, and on no other button; every line of text inside the box -> the list of faults */
function cardFaults(id) {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = [], panel = document.getElementById(id), box = panel.querySelector('.box'), b = R(box);
  if (panel.hidden) return ['not shown'];
  if (!inside(b)) out.push(`box outside the screen ${JSON.stringify(b)}`);
  // the Lamp-room, with its unlocks, scrolls inside the card: each button must come into view, clear of the card's own buttons at its foot
  const scrolls = id === 'lamp';
  if (!scrolls && box.scrollHeight > box.clientHeight + 1) out.push(`box scrolls ${box.scrollHeight} > ${box.clientHeight}`);
  if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  const lab = [R(document.querySelector('.labbar .back')), R(document.getElementById('menu'))];
  const btns = [...box.querySelectorAll('button')].filter(x => !x.hidden && x.getClientRects().length);
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
  for (const el of box.querySelectorAll('h2, p, li, dt, dd, span')) {
    if (el.hidden || !el.getClientRects().length) continue;
    const r = R(el);
    if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push(`text outside the box: ${el.textContent.trim().slice(0, 30)}`);
  }
  return out;
}
const faults = (page, id) => G(page, cardFaults, id);
/* the HUD, the toast, the tools, the touch buttons and the Lab bar: each inside the screen, none on another, the toast 8 px under the
   HUD's bottom, and every control 44 px or more */
function hudFaults() {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const shown = el => el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0;
  const parts = { lab: document.querySelector('.labbar .back'), games: document.getElementById('menu'), hud: document.getElementById('hud'), tools: document.getElementById('tools'), toast: document.getElementById('toast') };
  for (const id of ['bAttack', 'bRoll', 'bHeal', 'bJump']) parts[id] = document.getElementById(id);
  const out = [], rect = {};
  for (const [k, el] of Object.entries(parts)) if (shown(el)) rect[k] = R(el);
  const keys = Object.keys(rect);
  keys.forEach((k, i) => {
    if (!inside(rect[k])) out.push(`${k} outside the screen`);
    if (!['hud', 'toast'].includes(k) && Math.min(rect[k].width, rect[k].height) < 44 - 0.01) out.push(`${k} under 44 px`);
    keys.slice(i + 1).forEach(j => { if (over(rect[k], rect[j])) out.push(`${k} over ${j}`); });
  });
  if (rect.toast && Math.abs(rect.toast.top - (rect.hud.bottom + 8)) > 1) out.push(`toast at ${rect.toast.top.toFixed(1)}, not 8 px under the HUD (${rect.hud.bottom.toFixed(1)})`);
  if (document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways');
  const r4 = r => r && [r.x, r.y, r.width, r.height].map(v => +v.toFixed(1));
  return { out, hud: r4(rect.hud), tools: r4(rect.tools), toast: r4(rect.toast) };
}
const hud = page => G(page, hudFaults);

try {
  /* ---------------- keys: the help card, the HUD, the beacon card, the pause panel, a death, the summary and the Lamp-room ---------------- */
  if (part('keys')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7&nodraw');
    // the help card: the run's text and controls, Begin the run with the focus; Escape does not close it
    assert(await page.isVisible('#runHelp'), 'a first visit opens on the help card');
    assert.match(await text(page, '#runHelp p'), /Put out each beacon's keepers, then light it\. At a lit beacon, spend the glim you carry in the Lamp-room, on wares that last, or carry it on\. A death keeps only a little of it\./);
    assert.equal(await active(page), 'bBegin');
    assert.deepEqual(await faults(page, 'runHelp'), []);
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#runHelp'), "Escape does not close the run's help card");
    await shot(page, 'keys-help-1280x720');
    await page.keyboard.press('Enter');
    let r = await run(page);
    assert.deepEqual([r.mode, r.place, r.hp, r.max, r.flasks], ['play', 'gaol', 100, 100, 1]);
    assert.equal(await text(page, '#hpN'), '100/100');
    pass('the help card says what the run asks, Escape keeps it, and Begin the run starts the Gaol with 100/100 and 1 flask');

    // the health line: 74 of 100 fills the bar 74% beside "74/100", with one full pip and one empty (Flask 1 gives the second); 40 of 100
    await G(page, () => window.__gloam.set({ up: { flask: 1 }, hp: 74, flasks: 1 }));
    const line = () => G(page, () => ({
      n: document.getElementById('hpN').textContent, fill: document.getElementById('hpFill').getBoundingClientRect().width / document.querySelector('.hpbar').getBoundingClientRect().width,
      pips: [...document.querySelectorAll('#pips i')].map(i => i.classList.contains('on')), count: document.getElementById('count').textContent
    }));
    let l = await line();
    assert.equal(l.n, '74/100');
    assert(Math.abs(l.fill - 0.74) < 0.01, `the bar is filled ${l.fill}`);
    assert.deepEqual(l.pips, [true, false]);
    assert.equal(l.count, '◆ 0/5 wisps · ● 0 glim');
    await G(page, () => window.__gloam.set({ hp: 40, carried: 18 }));
    l = await line();
    assert.deepEqual([l.n, l.pips, l.count], ['40/100', [true, false], '◆ 0/5 wisps · ● 18 glim']);
    pass('the health line: "74/100" beside a bar filled 74% with one full pip and one empty; the wisps and the glim carried', l);
    await G(page, () => window.__gloam.set({ up: { flask: 0 } }));

    // a toast: 8 px under the HUD's measured bottom; it lasts its steps of game time, not wall time
    await G(page, t => window.__gloam.toast(t, 1800), KEEPERS);
    await page.waitForTimeout(2200);
    let h = await hud(page);
    assert.deepEqual(h.out, []);
    assert(await G(page, () => document.getElementById('toast').classList.contains('on')), 'the toast waits for game time');
    await tick(page, 1.78, {});
    assert(await G(page, () => document.getElementById('toast').classList.contains('on')), 'still on after 107 steps');
    await tick(page, 0.02, {});
    assert(!(await G(page, () => document.getElementById('toast').classList.contains('on'))), 'gone after 108 steps (1.8 s)');
    pass('a toast sits 8 px under the HUD and lasts 108 steps of game time, not 2.2 s of wall time', h);

    // the beacon: its glim carried on (nothing banked), two wicks offered as "name · text"; Escape, M and P cannot pass them
    await keepOut(page, 44);
    await G(page, () => window.__gloam.light());
    await tick(page, 1.6, {});
    assert(await page.isVisible('#beaconCard'));
    r = await run(page);
    assert.deepEqual([r.bank, r.carried, r.place, r.flasks], [0, 44, 'ramparts', 1]);
    const wicks = await page.$$eval('#wicks button', bs => bs.map(b => b.textContent));
    const WICK = { long: 'Long wick · +20 health', keen: 'Keen edge · +15% blade damage', heels: 'Quick heels · roll again after 0.12 s', heavy: 'Heavy fall · plunge ×1.5 and wider', oil: 'Spare oil · +1 flask', shave: 'Close shave · +50% after a near miss' };
    assert.deepEqual(wicks, r.offer.map(id => WICK[id]));
    assert.equal(await active(page), (await page.$$eval('#wicks button', bs => bs.map(b => b.textContent)))[0]);
    assert(!(await page.isVisible('#bSpend')) && !(await page.isVisible('#bWalkOn')), 'no Spend glim or Walk on before the choice');
    for (const k of ['Escape', 'm', 'p']) { await page.keyboard.press(k); assert(await page.isVisible('#beaconCard'), `${k} cannot pass the wicks`); }
    assert.equal((await run(page)).mode, 'beacon');
    assert.deepEqual(await faults(page, 'beaconCard'), []);
    await shot(page, 'keys-beacon-1280x720');
    await page.keyboard.press('Enter');
    r = await run(page);
    assert.deepEqual([r.wicks, r.offer], [[wicks.length && Object.keys(WICK).find(k => WICK[k] === wicks[0])], null]);
    // gloam-downs-growth: after the wick the beacon's spark pick, Flame, Ward or Gloam; nothing but a spark closes it either
    assert.deepEqual(await page.$$eval('#sparks button', bs => bs.map(b => b.dataset.spark)), ['flame', 'ward', 'gloam']);
    assert.match(await page.$eval('#sparks button', b => b.textContent), /^Flame \+1 · /);
    assert(!(await page.isVisible('#bWalkOn')), 'no Walk on before the spark');
    await page.keyboard.press('Enter');
    assert.deepEqual((await run(page)).sparks, { flame: 1, ward: 0, gloam: 0 });
    assert.equal(await active(page), 'bWalkOn', 'after the choices Walk on has the focus');
    assert.match(await text(page, '#beaconBank'), /You carry 44 glim, and 0 is banked\. Spend it in the Lamp-room, or carry it on: a death would keep only 4 of it \(10%\) and lose 40\./);
    assert.equal((await stored(page)).run.wicks.length, 1, 'the wick is stored at once');
    // Spend glim opens the Lamp-room with Back to the beacon alone; Escape goes back with the focus on Walk on
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), 'bSpend');
    await page.keyboard.press('Enter');
    assert(await page.isVisible('#lamp'));
    const lampBtns = () => page.$$eval('#lampRow button', bs => bs.filter(b => !b.hidden).map(b => b.id));
    assert.deepEqual(await lampBtns(), ['bLampBack'], 'from a beacon card: Back to the beacon, and no Begin the run or Wander');
    assert.equal(await active(page), 'bLampBack');
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#beaconCard') && !(await page.isVisible('#lamp')));
    assert.equal(await active(page), 'bWalkOn');
    assert(await page.isVisible('#bSpend'), 'the card shows Spend glim and Walk on again');
    await page.keyboard.press('Enter');
    await ready(page, 'play');
    assert.equal((await G(page, () => window.__gloam.state())).place, 'ramparts');
    pass('the beacon card: its two wicks, nothing but a wick closes it, Spend glim and Back to the beacon, then Walk on to The Crow Wall', { wicks });

    // the pause panel in The Crow Wall: the Gaol passed, this place now, three ahead; the run time; the sound switch is stored
    await G(page, () => window.__gloam.set({ carried: 20 }));
    await tick(page, 0.5, {});
    await page.keyboard.press('p');
    assert.equal(await active(page), 'bResume');
    const route = await page.$$eval('#route li', ls => ls.map(l => [l.className, l.textContent]));
    assert.deepEqual(route.map(x => x[0]), ['passed', 'here', 'ahead', 'ahead', 'ahead']);
    assert.match(route[1][1], /II\s+The Crow Wall/);
    assert.match(await text(page, '#pauseLine'), /^Run time \d+:\d\d$/);
    assert.deepEqual(await faults(page, 'pause'), []);
    await shot(page, 'keys-pause-1280x720');
    const order = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await active(page)); }
    assert.deepEqual(order, ['bSound', 'bMusic', 'bShake', 'bRestart', 'bEnd', 'bResume'], 'Tab goes through the six buttons and wraps');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.equal(await text(page, '#bSound'), 'Sound off');
    assert.equal((await stored(page)).sound, false, 'the sound switch is stored');
    await page.keyboard.press('Enter');
    assert.equal((await stored(page)).sound, true);
    // Back to the start asks again; Escape is No; Yes restarts the place as a reload does
    const entryHp = (await run(page)).entry.hp;
    await G(page, () => window.__gloam.set({ hp: 90 }));
    await page.click('#bRestart');
    assert.match(await text(page, '#askLine'), /Back to the start of The Crow Wall\?/);
    assert.equal(await active(page), 'bNo');
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#pauseRow') && (await active(page)) === 'bResume');
    await page.click('#bRestart');
    await page.click('#bYes');
    await ready(page, 'play');
    r = await run(page);
    assert.deepEqual([r.place, r.carried, r.hp], ['ramparts', 44, Math.min(90, entryHp)], 'the glim found here is lost (the 44 brought in stays), and the health is the lower of the two');
    pass('the pause panel: the places passed, here and ahead, the time, the sound switch stored, Back to the start asks and restarts the place');

    // death on The Crow Wall carrying 20, nothing banked: End the run with keys, a reload in the fade, the summary
    await G(page, () => window.__gloam.set({ carried: 20 }));
    await page.keyboard.press('p');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), 'bEnd');
    await page.keyboard.press('Enter');
    assert.match(await text(page, '#askLine'), /End the run\?/);
    await page.keyboard.press('Tab');
    assert.equal(await active(page), 'bYes');
    await page.keyboard.press('Enter');
    r = await run(page);
    assert.equal(r.mode, 'dying');
    // the foes put out are the keep's three Snuffers, put out before the Gaol's beacon
    // with the recap's fields (gloam-downs-screens-life): the Gaol passed with its 3 foes, The Crow Wall where it ended, the spark taken
    const { path, colours, patternNames, by, gear, ...rest } = r.ended;
    // the recap's gear (gloam-downs-hub): the Lamp blade and the Buckler, plain
    assert.deepEqual([gear.blade.id, gear.offhand.id], ['lamp', 'buckler']);
    assert.deepEqual(rest, { won: false, place: 'ramparts', time: r.ended.time, foes: 3, kept: 2, lost: 18, banked: 2, ember: 0, opened: null, relics: [], combo: 0, seed: r.ended.seed, patternsKept: 0, patternsLost: 0 }, 'a death keeps 10%: 2 of the 20 carried');
    assert.deepEqual([path.map(p => [p.id, p.foes]), colours, patternNames, by], [[['gaol', 3], ['ramparts', 0]], { flame: 1, ward: 0, gloam: 0 }, [], null]);
    await tick(page, 0.5, {});
    await G(page, () => window.__gloam.draw());
    await shot(page, 'keys-fade-1280x720');
    /* how far the picture has faded to ink: the fight's grade pulls every slot toward slot 0 (feel.js); with no grade, the #ink
       overlay in slot 0 does the same */
    const ink = await G(page, () => {
      const over = +getComputedStyle(document.getElementById('ink')).opacity;
      if (over > 0) return over;
      const pal = window.__gloam.palette(), g = window.__gloam.run().fx.grade, ch = (c, s) => (c >> s) & 255;
      let num = 0, den = 0;
      for (const k of [20, 25, 31]) for (const s of [16, 8, 0]) { num += ch(pal[k], s) - ch(g[k], s); den += ch(pal[k], s) - ch(pal[0], s); }
      return num / den;
    });
    assert(ink > 0.35 && ink < 0.6, `0.5 s into the fade the ink is ${ink}`);
    const ended = r.ended;
    // a reload: the same page with no ?fresh, so the run's save is read back
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&seed=7&nodraw`);
    await ready(page, 'ended');
    r = await run(page);
    assert.deepEqual(r.ended, ended, 'a reload in the fade shows the same figures');
    assert.equal(r.place, 'gaol');
    const sum = await page.$$eval('#summary dd', ds => ds.map(d => d.textContent));
    // the recap (gloam-downs-screens-life): the path as lamps, the Gaol lit and The Crow Wall snuffed; the glim kept and lost said once
    assert.deepEqual(await page.$$eval('#sumPath li', ls => ls.map(l => l.className)), ['lit', 'snuffed', 'dark', 'dark', 'dark']);
    assert.deepEqual([sum[2], sum[3], sum.length], ['kept 2 · lost 18', 'none', 6]);
    assert.equal(await text(page, '#sumT'), 'The lamp goes out');
    assert.equal(await active(page), 'bSumLamp');
    assert.deepEqual(await faults(page, 'summary'), []);
    await shot(page, 'keys-summary-1280x720');
    pass('End the run with keys, a reload 0.5 s into the fade, and the summary: "II · The Crow Wall", glim kept 2 and lost 18, 2 banked', { sum });

    // the summary opens the Lamp-room over the Gaol; with 49 banked (set here), Mantle bought with the focus kept, Flask off with "11 more glim"
    await page.keyboard.press('Enter');
    await ready(page, 'lamp');
    await G(page, () => window.__gloam.set({ bank: 49 }));
    assert.equal((await stored(page)).ended, null, 'closing the summary clears the ended run');
    assert.deepEqual(await lampBtns(), ['bLampBegin', 'bLampExplore'], 'Explore beside Begin the run until Wander opens');
    assert.equal(await active(page), 'bLampBegin');
    // each ware is a lamp tile (gloam-downs-screens-life): its row's words in data-label, "Mantle 0 of 8" on the tile
    const rows = () => page.$$eval('#ups li', ls => ls.map(li => [li.dataset.label, li.querySelector('button').hidden ? null : li.querySelector('button').textContent, li.querySelector('button').getAttribute('aria-disabled')]));
    assert.deepEqual(await rows(), [
      ['Mantle 1 · +15 health · 40 glim', 'Buy', 'false'], ['Flask 1 · +1 flask · 60 glim', '11 more glim', 'true'], ['Edge 1 · +12% blade damage · 50 glim', '1 more glim', 'true'],
      ['Draught 1 · heal 45% · 45 glim', 'Buy', 'false'], ['Ash pocket 1 · keep 18% of glim at a death · 40 glim', 'Buy', 'false'],
      ['Belt 1 · a choice of two start abilities · 90 glim', '41 more glim', 'true'], ['Keen eye 1 · better drops · 70 glim', '21 more glim', 'true'],
      ['Lantern panes 1 · 2 pane slots · 300 glim', '251 more glim', 'true'], ['First spark 1 · 1 spark pick at the start · 120 glim', '71 more glim', 'true']
    ]);
    assert.match(await text(page, '#lampLine'), /Banked: 49 glim/);
    assert.deepEqual(await faults(page, 'lamp'), []);
    await shot(page, 'keys-lamp-1280x720');
    await page.keyboard.press('Tab');
    assert.equal(await active(page), 'bLampExplore', 'Tab goes from Begin the run to Explore');
    await page.keyboard.press('Tab');
    assert.equal(await G(page, () => document.activeElement.closest('li')?.dataset.up), 'mantle', 'Tab wraps to the first Buy');
    await page.keyboard.press(' ');
    let s = await stored(page);
    assert.deepEqual([s.bank, s.up.mantle], [9, 1], 'the buy is stored at once');
    assert.equal(await G(page, () => document.activeElement.closest('li')?.dataset.up), 'mantle', 'the focus stays on the Buy button');
    assert.deepEqual((await rows())[0], ['Mantle 2 · +15 health · 80 glim', '71 more glim', 'true']);
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    assert.equal((await stored(page)).bank, 9, 'a Buy button that is off does nothing, on Enter or Space');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), 'bLampExplore', 'Shift+Tab wraps back to Explore');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), 'bLampBegin');
    await page.keyboard.press('Enter');
    await ready(page, 'play');
    r = await run(page);
    assert.deepEqual([r.place, r.hp, r.max, r.bank], ['gaol', 115, 115, 9]);
    pass('the Lamp-room after the summary: its rows, a buy that keeps the focus, a Buy that says how much more, and a run of 115 health');

    // a death with Ash pocket 1 (18%): the fade is game time, and the summary shows 3 kept and 17 lost after 72 steps
    await G(page, () => window.__gloam.set({ up: { ash: 1 }, carried: 20 }));
    await G(page, () => window.__gloam.kill());
    await page.waitForTimeout(1500);
    await tick(page, 1.18, {});
    assert.equal((await run(page)).mode, 'dying', 'no summary before 72 steps of the fade, whatever the wall clock');
    await tick(page, 0.02, {});
    assert.equal((await run(page)).mode, 'ended');
    const ash = await page.$$eval('#summary dd', ds => ds.map(d => d.textContent));
    assert.deepEqual(await page.$$eval('#sumPath li', ls => ls.map(l => l.className)), ['snuffed', 'dark', 'dark', 'dark', 'dark']);
    assert.deepEqual([ash[2], ash[3]], ['kept 3 · lost 17', 'none']);
    assert.equal((await stored(page)).bank, 12);
    pass('a death with Ash pocket 1 keeps 3 of 20 (18%); the summary comes after 72 steps of game time');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- a mocked gamepad alone at the beacon card ---------------- */
  if (part('pad')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=2&nodraw', mock);
    await tap(page, PAD.A);
    assert.equal((await run(page)).mode, 'play', 'A begins the run');
    await keepOut(page, 60);
    await G(page, () => window.__gloam.light());
    await tick(page, 1.6, 'live');
    assert.equal((await run(page)).mode, 'beacon');
    const first = await page.$eval('#wicks button', b => b.dataset.wick);
    assert.equal(await G(page, () => document.activeElement.dataset.wick), first, 'the first wick has the focus');
    for (const b of [PAD.START, PAD.BACK, PAD.B]) {
      await tap(page, b);
      assert.equal((await run(page)).mode, 'beacon', `pad button ${b} cannot pass the wicks`);
    }
    await tap(page, PAD.A);
    let r = await run(page);
    assert.deepEqual([r.wicks, r.offer, r.bank, r.carried], [[first], null, 0, 60]);
    // the spark pick: A takes the first, Flame
    assert.equal(await G(page, () => document.activeElement.dataset.spark), 'flame', 'the first spark has the focus');
    await tap(page, PAD.A);
    assert.equal((await run(page)).sparks.flame, 1);
    assert.equal(await active(page), 'bWalkOn');
    await tap(page, PAD.UP);
    assert.equal(await active(page), 'bSpend');
    await tap(page, PAD.A);
    assert.equal((await run(page)).mode, 'lamp');
    assert.equal(await active(page), 'bLampBack');
    // the left stick past half moves the focus one button, as the d-pad does
    await G(page, () => { window.__pad.axes[1] = 0.8; });
    await tick(page, 0.05, 'live');
    await G(page, () => { window.__pad.axes[1] = 0; });
    await tick(page, 0.05, 'live');
    assert.equal(await G(page, () => document.activeElement.closest('li')?.dataset.up), 'mantle', "the left stick reaches Mantle's Buy");
    await tap(page, PAD.A);
    r = await run(page);
    assert.deepEqual([r.carried, r.bank, r.hp, r.max], [20, 0, 115, 115], 'the glim carried pays first: 20 left, and Mantle works at once');
    assert.match(await text(page, '#lampLine'), /Carried: 20 glim · Banked: 0 glim/);
    await tap(page, PAD.B);
    assert.equal((await run(page)).mode, 'beacon');
    assert.equal(await active(page), 'bWalkOn', 'B goes back to the beacon with the focus on Walk on');
    await tap(page, PAD.A);
    await ready(page, 'play');
    assert.equal((await G(page, () => window.__gloam.state())).place, 'ramparts');
    r = await run(page);
    assert.deepEqual([r.hp, r.max, r.entry.hp], [115, 115, 115]);
    assert.deepEqual(errors, []);
    pass('a gamepad alone: no way past the wicks, A chooses, the d-pad reaches Spend glim and the left stick Buy, B goes back, A walks on', { wick: first });
    await ctx.close();
  }

  /* ---------------- the five layouts: every card, the widest HUD and the longest toast ---------------- */
  if (part('layout')) {
    const TOUCHES = [[390, 844], [320, 640], [360, 640], [800, 600]], MICE = [[1280, 720], [800, 600]];
    const sizes = {};
    // each card at each size of the context: no fault, and a picture
    async function each(page, list, name, id, more) {
      for (const [w, hgt] of list) {
        await page.setViewportSize({ width: w, height: hgt });
        await page.waitForTimeout(50);
        const f = id ? await faults(page, id) : [];
        assert.deepEqual(f, [], `${name} at ${w}x${hgt}`);
        if (more) await more(w, hgt);
        await shot(page, `layout-${name}-${w}x${hgt}`);
      }
    }
    for (const [label, opts, list] of [['touch', TOUCH, TOUCHES], ['mouse', {}, MICE]]) {
      const { ctx, page, errors } = await open({ viewport: { width: list[0][0], height: list[0][1] }, ...opts }, '?run&test&fresh&seed=4&nodraw&title');
      // the title (gloam-downs-screens-life), then the help card that its Begin the run opens on a first visit
      await each(page, list, `${label}-title`, 'title');
      await G(page, () => document.getElementById('bTitleBegin').click());
      await each(page, list, `${label}-help`, 'runHelp');
      await G(page, () => document.getElementById('bBegin').click());
      // the widest HUD: 165/165 (Mantle 3, Long wick), 5 of 5 flasks (Flask 3, Spare oil), 5/5 wisps, 254 glim, and the longest toasts
      await G(page, () => window.__gloam.set({ up: { mantle: 3, flask: 3 }, wicks: ['long', 'oil'] }));
      for (let i = 0; i < 5; i++) await G(page, i => window.__gloam.wisp(i), i);
      await G(page, () => window.__gloam.set({ hp: 165, flasks: 5, carried: 254 }));
      assert.equal(await text(page, '#hpN'), '165/165');
      for (const t of [KEEPERS, LONG]) {
        await G(page, t => window.__gloam.toast(t, 60000), t);
        await each(page, list, `${label}-hud${t === LONG ? '-long' : ''}`, null, async (w, hgt) => {
          await page.waitForTimeout(250);
          const h = await hud(page);
          assert.deepEqual(h.out, [], `the HUD at ${w}x${hgt}`);
          if (t === KEEPERS) sizes[`${label} ${w}x${hgt}`] = { hud: h.hud, tools: h.tools, toast: h.toast };
        });
      }
      // the HUD in the boss fight: the hint hides; it and the tools inside the spec's rects (stage 3 sets the class in the fight)
      await G(page, () => document.getElementById('hud').classList.add('boss'));
      const RECTS = { 320: [180, 88, 198], 360: [220, 88, 238], 390: [250, 88, 268], 800: [262, 91, 656], 1280: [262, 91, 1136] };
      for (const [w, hgt] of list) {
        await page.setViewportSize({ width: w, height: hgt });
        await page.waitForTimeout(50);
        const h = await hud(page), [hw, hh, tx] = RECTS[w], tw = w <= 520 ? 112 : 134;
        sizes[`${label} ${w}x${hgt}`].boss = h.hud;
        assert(h.hud[0] >= 10 && h.hud[1] >= 60 && h.hud[0] + h.hud[2] <= 10 + hw + 0.5 && h.hud[1] + h.hud[3] <= 60 + hh + 0.5, `the HUD ${h.hud} in ${hw}x${hh} at ${w}`);
        assert(h.tools[0] >= tx - 0.5 && h.tools[0] + h.tools[2] <= tx + tw + 0.5 && h.tools[3] <= 44.5, `the tools ${h.tools} at ${w}`);
      }
      await G(page, () => document.getElementById('hud').classList.remove('boss'));
      await G(page, () => window.__gloam.toast('', 1));
      await tick(page, 0.05, {});
      // the beacon card before and after the choice, and the Lamp-room from it with a bank that buys some rows and not others
      await keepOut(page, 75);
      await G(page, () => window.__gloam.set({ hp: 120 }));
      await G(page, () => window.__gloam.light());
      await tick(page, 1.6, {});
      await each(page, list, `${label}-beacon`, 'beaconCard');
      await G(page, () => document.querySelector('#wicks button').click());
      // gloam-downs-growth: the beacon's spark pick after the wick, then the card's own buttons
      await each(page, list, `${label}-beacon-sparks`, 'beaconCard');
      await G(page, () => document.querySelector('#sparks button').click());
      await each(page, list, `${label}-beacon-chosen`, 'beaconCard');
      await G(page, () => document.getElementById('bSpend').click());
      await G(page, () => window.__gloam.set({ up: { mantle: 1, flask: 2, edge: 0, draught: 1, ash: 0 }, bank: 75 }));
      await each(page, list, `${label}-lamp-beacon`, 'lamp');
      if (label === 'touch') {
        // a tap beside a card does nothing in a run: the Lamp-room, and the beacon card after the choice
        await page.setViewportSize({ width: 390, height: 844 });
        for (const id of ['lamp', 'beaconCard']) {
          if (id === 'beaconCard') await G(page, () => document.getElementById('bLampBack').click());
          const m = (await run(page)).mode;
          // the beacon card is a bottom sheet at 390x844 (gloam-downs-screens-life): beside it is above it
          await page.touchscreen.tap(195, id === 'beaconCard' ? 300 : 830);
          assert(await page.isVisible(`#${id}`) && (await run(page)).mode === m, `a tap beside ${id} does nothing`);
        }
      } else await G(page, () => document.getElementById('bLampBack').click());
      await G(page, () => document.getElementById('bWalkOn').click());
      await ready(page, 'play');
      // the Lamp-room with a run in progress (as from Wander's Map, stage 3): Go on with the run and Back to Wander
      await G(page, () => window.__gloam.lamp('wander'));
      assert.deepEqual(await page.$$eval('#lampRow button', bs => bs.filter(b => !b.hidden).map(b => b.id)), ['bLampGoOn', 'bLampToWander']);
      await each(page, list, `${label}-lamp-wander`, 'lamp');
      await G(page, () => document.getElementById('bLampGoOn').click());
      await ready(page, 'play');
      // the pause panel, and its question
      await G(page, () => document.getElementById('bMap').click());
      await each(page, list, `${label}-pause`, 'pause');
      await G(page, () => document.getElementById('bEnd').click());
      await each(page, list, `${label}-pause-ask`, 'pause');
      await G(page, () => document.getElementById('bYes').click());
      await tick(page, 1.25, {});
      await each(page, list, `${label}-summary`, 'summary');
      if (label === 'touch') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.touchscreen.tap(195, 830);
        assert((await run(page)).mode === 'ended' && (await page.isVisible('#summary')), 'a tap beside the summary does nothing');
      }
      await G(page, () => document.getElementById('bSumLamp').click());
      await ready(page, 'lamp');
      await each(page, list, `${label}-lamp`, 'lamp');
      assert.deepEqual(errors, []);
      pass(`every card fits at ${list.map(s => s.join('x')).join(', ')} (${label}), with the widest HUD and the longest toasts`);
      await ctx.close();
    }
    pass('the HUD, the tools and the toast, measured (x, y, w, h)', sizes);
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
