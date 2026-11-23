// Gloam Downs: every click of a real mouse does something (public/lab/gloam-downs/). The page is clicked with page.mouse (real CDP
// mouse events, so the browser's own hit testing picks the target), and before each click on a button the test checks that the button
// itself is on top at its centre (elementFromPoint), so no hidden or clear element covers it.
//   With the pointer lock granted, refused (the request rejects with NotAllowedError, or returns nothing and fires pointerlockerror),
//   never answered, and missing, at 1280x720 with a fine pointer:
//   - a run: Begin the run, then the first left click on the view attacks a post 2 m ahead, and so do the next; the mouse turns the
//     view (taken: a move; free: the right drag); taken, a right click rolls; the pause panel's buttons (Sound, Music, End the run, No,
//     Back to the start, No, Resume) answer one click each; after Resume the first click attacks again. A refusal or no answer shows
//     the hint "Hold the right button and drag to look", and no click is spent on asking only.
//   - the explorer: Walk, then the first left click jumps; the mouse turns the view; Look, Map, Close and Games answer one click.
//   A lock that the browser grants after a card has opened is given back at once, so Resume takes one click. A click round the help
//   card's box walks (the explorer) or begins the run. The beacon card, the summary and the Lamp-room are clicked through once.
//   On a coarse 390x844 page with a mouse (a phone with a mouse, Samsung DeX), with the lock granted, refused and missing: the buttons
//   answer the mouse, a left click attacks or jumps on the first click, the right drag or the taken mouse turns the view, and the
//   controls show the mouse's lines once the mouse has moved. A touch tap on the view does not jump and does not ask for the mouse, and
//   a thumb on the screen while the mouse is taken frees it and holds the stick where it touched. On a phone that has seen a mouse, a
//   finger's tap on each card button presses that button (the switch to touch does not move the card under it), and a tap round the
//   help box leaves it open.
// The page runs with ?test and is stepped by __gloam.tick(), because software WebGL takes about a second a frame.
// Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs-clicks.e2e.mjs [part...]   (parts: run explorer late help cards taps phone; SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ONLY = process.argv.slice(2);
const want = part => !ONLY.length || ONLY.includes(part);
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const DESK = { viewport: { width: 1280, height: 720 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

// the page's pointer lock: the browser's own (grant), refused two ways, never answered, missing, or granted 1.5 s late
function lockStub(style) {
  window.__reqs = 0;
  const orig = Element.prototype.requestPointerLock;
  if (style === 'missing') { delete HTMLCanvasElement.prototype.requestPointerLock; delete Element.prototype.requestPointerLock; return; }
  if (style === 'grant') { Element.prototype.requestPointerLock = function (o) { window.__reqs++; return orig.call(this, o); }; return; }
  Element.prototype.requestPointerLock = function (o) {
    window.__reqs++;
    if (style === 'reject') { setTimeout(() => document.dispatchEvent(new Event('pointerlockerror'))); return Promise.reject(new DOMException('refused', 'NotAllowedError')); }
    if (style === 'undef') { setTimeout(() => document.dispatchEvent(new Event('pointerlockerror'))); return undefined; }
    if (style === 'never') return new Promise(() => {});
    // late: the first request is answered after 1.5 s, the next at once
    if (style === 'late' && !window.__lateDone) { window.__lateDone = true; return new Promise((res, rej) => setTimeout(() => orig.call(this, o)?.then?.(res, rej), 1500)); }
    return orig.call(this, o);
  };
}
async function open(ctxOpts, query, lock) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(lockStub, lock);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await ready(page);
  return { ctx, page, errors };
}
const ready = page => page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const state = page => G(page, () => window.__gloam.state());
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = 'live') => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const reqs = page => G(page, () => window.__reqs);
const locked = page => G(page, () => document.pointerLockElement?.id === 'view');
const settle = (page, ms = 250) => page.waitForTimeout(ms);
const hits = async page => (await G(page, () => window.__gloam.posts())).reduce((k, p) => k + p.hits.length, 0);
const postAhead = (page, d) => G(page, d => { const s = window.__gloam.state(); return window.__gloam.post(s.x + Math.sin(s.yaw) * d, s.z + Math.cos(s.yaw) * d); }, d);
const topAt = (page, x, y) => G(page, ([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.id || e.tagName : null; }, [x, y]);

// click a button at its centre with the real mouse, once; the button (or a child of it) must be what is on top there
async function click(page, sel, label = sel) {
  const at = await G(page, sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, on: !!top && (top === el || el.contains(top)), top: top ? top.id || top.tagName : null };
  }, sel);
  assert(at && at.w > 0, `${label} shows`);
  assert(at.on, `${label} is on top at its centre (found ${at.top})`);
  assert(Math.min(at.w, at.h) >= 44, `${label} is at least 44 px (${at.w}x${at.h})`);
  await page.mouse.click(at.x, at.y);
  await settle(page, 150);
}
// a finger's tap on a button at its centre (the button must be on top there), after the mouse has moved over the page: the tap's
// pointerdown switches the page from the mouse to touch, and the card must not change under it
async function tap(page, sel, label = sel) {
  await page.mouse.move(6, 6); await page.mouse.move(9, 8);
  const at = await G(page, sel => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, on: !!top && (top === el || el.contains(top)), top: top ? top.id || top.tagName : null };
  }, sel);
  assert(at.w > 0 && at.on, `${label} is on top at its centre before the tap (found ${at.top})`);
  await G(page, () => { window.__tapped = null; addEventListener('click', e => { window.__tapped = e.target.closest('button')?.id || e.target.id || e.target.tagName; }, { once: true, capture: true }); });
  await page.touchscreen.tap(at.x, at.y);
  await settle(page, 100);
  const got = await G(page, () => window.__tapped);
  assert.equal(got, sel.slice(1), `a tap on ${label} after the mouse presses ${label} (pressed ${got})`);
  await settle(page, 150);
}
// a left click on the view: what it did (the hits on the posts, the swing, the rise)
async function viewClick(page, at, isRun) {
  const top = await topAt(page, at[0], at[1]);
  assert.equal(top, 'view', `the view is on top where the player clicks (${top})`);
  if (isRun) { await postAhead(page, 2); await tick(page, 0.05, {}); }
  const h0 = isRun ? await hits(page) : 0, y0 = (await state(page)).y;
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  let top2 = y0;
  for (let i = 0; i < 4; i++) top2 = Math.max(top2, (await tick(page, 0.05)).y);
  await page.mouse.up();
  for (let i = 0; i < 12; i++) top2 = Math.max(top2, (await tick(page, 0.08)).y);
  return isRun ? (await hits(page)) > h0 : top2 > y0 + 0.3;
}
// the mouse turns the view: taken, a move with no button; free, the right drag
async function look(page, at, isLocked) {
  const y0 = (await state(page)).cam.yaw;
  await page.mouse.move(at[0], at[1]);
  if (isLocked) await page.mouse.move(at[0] + 100, at[1], { steps: 5 });
  else { await page.mouse.down({ button: 'right' }); await page.mouse.move(at[0] - 100, at[1], { steps: 5 }); await page.mouse.up({ button: 'right' }); }
  await tick(page, 0.1);
  return Math.abs((await state(page)).cam.yaw - y0);
}
const LOCKS = ['grant', 'reject', 'undef', 'never', 'missing'];
const DESK_AT = [640, 300];

try {
  /* ---------------- a run at 1280x720 ---------------- */
  if (want('run')) for (const lock of LOCKS) {
    const { ctx, page, errors } = await open(DESK, '?run&test&fresh&seed=7', lock);
    await click(page, '#bBegin', 'Begin the run');
    await settle(page);
    await tick(page, 0.2);
    assert.equal((await run(page)).mode, 'play', `${lock}: Begin the run plays`);
    const took = lock === 'grant';
    assert.equal(await locked(page), took, `${lock}: the mouse taken after Begin`);
    // every click acts, the first one too, whatever the lock does
    const acts = [];
    for (let i = 0; i < 3; i++) { acts.push(await viewClick(page, [DESK_AT[0] + i * 9, DESK_AT[1]], true)); await settle(page, 300); }
    assert.deepEqual(acts, [true, true, true], `${lock}: each left click attacks (${acts})`);
    if (lock === 'never') {
      // a request that has no answer counts as refused after 2 s; the clicks in between asked no more
      assert((await reqs(page)) <= 2, `${lock}: no click asks again while a request is out (${await reqs(page)} requests)`);
      await settle(page, 2100);
      await tick(page, 0.05);
    }
    const m = (await state(page)).mouse;
    if (lock === 'grant') assert(!m.hint, 'grant: no hint while the mouse is taken');
    else if (lock === 'missing') assert(!m.hint, 'missing: no hint where the page cannot take the mouse');
    else assert(m.hint && m.text === 'Hold the right button and drag to look', `${lock}: the hint says how the free mouse looks (${JSON.stringify(m)})`);
    const turn = await look(page, DESK_AT, await locked(page));
    assert(turn > 0.1, `${lock}: the mouse turns the view (${turn})`);
    if (took) {
      await page.mouse.down({ button: 'right' }); await tick(page, 0.1);
      const mv = (await run(page)).move;
      await page.mouse.up({ button: 'right' }); await tick(page, 1.0);
      assert.equal(mv, 'roll', 'grant: a right click rolls');
      await page.keyboard.press('Escape');
      await settle(page);
      assert(!(await locked(page)), 'grant: Escape frees the mouse');
    } else await click(page, '#bMap', 'Pause');
    assert.equal((await run(page)).mode, 'pause', `${lock}: the pause panel opens`);
    // the pause panel: each button answers one click
    await click(page, '#bSound', 'Sound'); await click(page, '#bSound', 'Sound again');
    await click(page, '#bMusic', 'Music'); await click(page, '#bMusic', 'Music again');
    await click(page, '#bEnd', 'End the run'); assert(await page.isVisible('#askRow'), `${lock}: End the run asks`);
    await click(page, '#bNo', 'No'); assert(!(await page.isVisible('#askRow')), `${lock}: No closes the question`);
    await click(page, '#bRestart', 'Back to the start'); assert(await page.isVisible('#askRow'), `${lock}: Back to the start asks`);
    await click(page, '#bNo', 'No');
    if (took) await settle(page, 2500); // Chrome refuses a lock asked for too soon after Escape
    await click(page, '#bResume', 'Resume');
    await settle(page);
    await tick(page, 0.1);
    assert.equal((await run(page)).mode, 'play', `${lock}: Resume plays`);
    assert(await viewClick(page, DESK_AT, true), `${lock}: after Resume the first click attacks`);
    pass(`a run at 1280x720 with the lock ${lock}: every click on the view attacks, the mouse looks, and every pause button answers one click`, { turn: +turn.toFixed(2), requests: await reqs(page) });
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- the explorer at 1280x720 ---------------- */
  if (want('explorer')) for (const lock of LOCKS) {
    const { ctx, page, errors } = await open(DESK, '?fresh&test', lock);
    assert(await page.isVisible('#help'), 'the help card shows');
    await click(page, '#bStart', 'Walk');
    await settle(page);
    await tick(page, 0.2);
    assert.equal((await state(page)).mode, 'play', `${lock}: Walk plays`);
    assert(await viewClick(page, DESK_AT, false), `${lock}: the first click after Walk jumps`);
    await settle(page, 300);
    assert(await viewClick(page, [DESK_AT[0] + 9, DESK_AT[1]], false), `${lock}: the next click jumps too`);
    const turn = await look(page, DESK_AT, await locked(page));
    assert(turn > 0.1, `${lock}: the mouse turns the view (${turn})`);
    if (await locked(page)) {
      await page.keyboard.press('Escape');
      await settle(page);
      assert(!(await locked(page)), 'Escape frees the mouse');
      assert(await viewClick(page, DESK_AT, false), `${lock}: after Escape the first click jumps (and takes the mouse)`);
      await page.keyboard.press('Escape');
      await settle(page);
    }
    await click(page, '#bLook', 'Look');
    assert.equal((await state(page)).mode, 'play');
    await click(page, '#bMap', 'Map');
    assert.equal((await state(page)).mode, 'map', `${lock}: Map opens the map`);
    await click(page, '#bMapClose', 'Close');
    assert.equal((await state(page)).mode, 'play', `${lock}: Close goes back to play`);
    if (await locked(page)) { await page.keyboard.press('Escape'); await settle(page); }
    await click(page, '#menu', 'Games');
    assert(await G(page, () => window.GameSwitch?.isOpen), `${lock}: Games opens the switcher`);
    await page.keyboard.press('Escape');
    await settle(page);
    pass(`the explorer at 1280x720 with the lock ${lock}: Walk, then every click jumps, the mouse looks, and Look, Map, Close and Games answer one click`, { turn: +turn.toFixed(2) });
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- a lock granted late, over a card ---------------- */
  if (want('late')) {
    const { ctx, page, errors } = await open(DESK, '?run&test&fresh&seed=7', 'late');
    await click(page, '#bBegin', 'Begin the run');
    await page.keyboard.press('p');
    await settle(page, 2000);
    assert.equal((await run(page)).mode, 'pause', 'P paused while the lock was on its way');
    assert(!(await locked(page)), 'the lock that came after the pause panel opened was given back');
    await click(page, '#bResume', 'Resume');
    await settle(page);
    assert.equal((await run(page)).mode, 'play', 'one click on Resume plays');
    pass('a lock granted after the pause panel opened is given back, and Resume takes one click');
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- a click round the help card ---------------- */
  if (want('help')) {
    for (const [query, id] of [['?fresh&test', 'help'], ['?run&test&fresh&seed=7', 'runHelp']]) {
      const { ctx, page, errors } = await open(DESK, query, 'grant');
      assert(await page.isVisible(`#${id}`));
      assert.equal(await topAt(page, 30, 360), id, `the backdrop of #${id} is on top at the left`);
      await page.mouse.click(30, 360);
      await settle(page);
      await tick(page, 0.1);
      assert.equal((await state(page)).mode, 'play', `a click round #${id} plays`);
      assert(!(await page.isVisible(`#${id}`)), `#${id} closes`);
      pass(`a click on the view round #${id} starts play, as its button does`);
      if (errors.length) throw new Error(errors.join('\n'));
      await ctx.close();
    }
  }
  /* ---------------- the run's cards: beacon, summary, Lamp-room ---------------- */
  if (want('cards')) for (const lock of ['grant', 'reject']) {
    const { ctx, page, errors } = await open(DESK, '?run&test&fresh&seed=7', lock);
    await click(page, '#bBegin', 'Begin the run');
    await settle(page);
    // the Gaol's keepers put out (its zones G1 to G6), then a touch on the beacon
    await G(page, () => { const g = window.__gloam; for (const z of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) g.out(z); g.tick(1.2, {}); g.light(); });
    await tick(page, 4, {});
    assert.equal((await run(page)).mode, 'beacon', `${lock}: the beacon card opens`);
    assert(!(await locked(page)), 'the beacon card frees the mouse');
    await click(page, '#wicks button', 'a wick');
    if (await page.isVisible('#bSpend')) { await click(page, '#bSpend', 'Spend glim'); await click(page, '#bLampBack', 'Back to the beacon'); }
    await click(page, '#bWalkOn', 'Walk on');
    await ready(page);
    await settle(page);
    await tick(page, 0.2);
    assert.equal((await run(page)).mode, 'play', `${lock}: Walk on plays`);
    assert(await viewClick(page, DESK_AT, true), `${lock}: the first click after Walk on attacks`);
    await G(page, () => window.__gloam.kill());
    await tick(page, 6, {});
    assert.equal((await run(page)).mode, 'ended', `${lock}: the summary shows`);
    await click(page, '#bSumLamp', 'To the Lamp-room');
    await ready(page);
    await tick(page, 0.2, {});
    await click(page, '#bLampBegin', 'Begin the run (Lamp-room)');
    await ready(page);
    await settle(page);
    await tick(page, 0.2);
    assert.equal((await run(page)).mode, 'play', `${lock}: the Lamp-room's Begin the run plays`);
    assert(await viewClick(page, DESK_AT, true), `${lock}: the first click after the Lamp-room attacks`);
    pass(`the run's cards with the lock ${lock}: wick, Spend glim, Back, Walk on, To the Lamp-room and Begin the run answer one click, and the first click after each attacks`);
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- taps on a phone that has seen a mouse: every card button is pressed where the finger lands ---------------- */
  if (want('taps')) for (const vp of [{ width: 390, height: 844 }, { width: 884, height: 1104 }]) {
    const opts = { ...PHONE, viewport: vp };
    {
      const { ctx, page, errors } = await open(opts, '?run&test&fresh&seed=7', 'grant');
      await tap(page, '#bBegin', 'Begin the run');
      await settle(page);
      await tick(page, 0.2);
      assert.equal((await run(page)).mode, 'play', 'a tap on Begin the run plays');
      await page.mouse.move(20, 20); await page.mouse.move(25, 22);
      await click(page, '#bMap', 'Pause');
      assert.equal((await run(page)).mode, 'pause');
      for (const [sel, label] of [['#bSound', 'Sound'], ['#bSound', 'Sound again'], ['#bMusic', 'Music'], ['#bMusic', 'Music again']]) await tap(page, sel, label);
      await tap(page, '#bEnd', 'End the run'); assert(await page.isVisible('#askRow'), 'End the run asks');
      await tap(page, '#bNo', 'No');
      await tap(page, '#bRestart', 'Back to the start'); assert(await page.isVisible('#askRow'), 'Back to the start asks');
      await tap(page, '#bNo', 'No');
      await tap(page, '#bResume', 'Resume');
      await settle(page);
      assert.equal((await run(page)).mode, 'play', 'a tap on Resume plays');
      pass(`${vp.width}x${vp.height}, a phone that has seen a mouse, in a run: a tap on Begin, Sound, Music, End the run, No, Back to the start and Resume presses that button`);
      if (errors.length) throw new Error(errors.join('\n'));
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open(opts, '?fresh&test', 'grant');
      assert(await page.isVisible('#help'), 'the help shows');
      await page.mouse.move(20, 20); await page.mouse.move(25, 22);
      // a tap round the help box leaves it open (a mouse click there walks)
      const edge = await G(page, () => { const b = document.querySelector('#help .box') || document.querySelector('#help > *'); const r = b.getBoundingClientRect(); return [Math.max(2, r.left / 2), r.top > 8 ? r.top / 2 : innerHeight - 4]; });
      if ((await topAt(page, edge[0], edge[1])) === 'help') {
        await page.touchscreen.tap(edge[0], edge[1]);
        await settle(page);
        assert(await page.isVisible('#help'), 'a tap round the help box leaves it open');
      }
      await tap(page, '#bStart', 'Walk');
      await settle(page);
      await tick(page, 0.2);
      assert.equal((await state(page)).mode, 'play', 'a tap on Walk plays');
      pass(`${vp.width}x${vp.height}, a phone that has seen a mouse, in the explorer: a tap round the help leaves it, a tap on Walk walks`);
      if (errors.length) throw new Error(errors.join('\n'));
      await ctx.close();
    }
  }
  /* ---------------- a phone with a mouse, 390x844, coarse ---------------- */
  if (want('phone')) for (const lock of ['grant', 'reject', 'missing']) {
    const AT = [200, 330];
    {
      const { ctx, page, errors } = await open(PHONE, '?run&test&fresh&seed=7', lock);
      assert(await G(page, () => matchMedia('(pointer: coarse)').matches), 'the page is coarse');
      await page.mouse.move(100, 100); await page.mouse.move(120, 110);
      if (lock !== 'missing') assert.match(await page.textContent('#runControls'), /Click the view to take the mouse/, `${lock}: a mouse that moves brings the mouse's lines`);
      else assert.match(await page.textContent('#runControls'), /Hold the right button and drag/, 'missing: the drag line');
      await click(page, '#bBegin', 'Begin the run');
      await settle(page);
      await tick(page, 0.2);
      assert.equal((await run(page)).mode, 'play');
      const acts = [];
      for (let i = 0; i < 2; i++) { acts.push(await viewClick(page, [AT[0] + i * 7, AT[1]], true)); await settle(page, 300); }
      assert.deepEqual(acts, [true, true], `phone ${lock}: each left click attacks (${acts})`);
      const turn = await look(page, AT, await locked(page));
      assert(turn > 0.1, `phone ${lock}: the mouse turns the view (${turn})`);
      if (await locked(page)) { await page.keyboard.press('Escape'); await settle(page); }
      else await click(page, '#bMap', 'Pause');
      assert.equal((await run(page)).mode, 'pause');
      if (lock === 'grant') await settle(page, 2500);
      await click(page, '#bResume', 'Resume');
      await settle(page);
      assert.equal((await run(page)).mode, 'play');
      for (const b of ['#bAttack', '#bJump']) await click(page, b, b);
      pass(`a coarse 390x844 page with a mouse, lock ${lock}, in a run: Begin, every left click attacks, the mouse looks, Pause, Resume and the touch buttons answer the mouse`, { turn: +turn.toFixed(2) });
      if (errors.length) throw new Error(errors.join('\n'));
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open(PHONE, '?fresh&test', lock);
      // a touch tap on the view is not a mouse click: it does not jump and does not ask for the mouse
      await page.touchscreen.tap(195, 120);
      await settle(page);
      if (await page.isVisible('#help')) await page.tap('#bStart');
      await settle(page);
      await tick(page, 0.3);
      const r0 = await reqs(page), y0 = (await state(page)).y;
      await page.touchscreen.tap(300, 300);
      let top = y0;
      for (let i = 0; i < 8; i++) top = Math.max(top, (await tick(page, 0.08)).y);
      assert(top < y0 + 0.05, `a touch tap on the view does not jump (${(top - y0).toFixed(2)})`);
      assert.equal(await reqs(page), r0, 'a touch tap does not ask for the mouse');
      assert(await viewClick(page, AT, false), `phone ${lock}: the first mouse click jumps`);
      const turn = await look(page, AT, await locked(page));
      assert(turn > 0.1, `phone ${lock}: the mouse turns the view in the explorer (${turn})`);
      // a thumb on the left half while the mouse is taken: the mouse is freed, and the stick shows under the thumb, not where the mouse was
      if (await locked(page)) {
        const cdp = await ctx.newCDPSession(page);
        const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) });
        await touch('touchStart', [[90, 640]]);
        await touch('touchMove', [[90, 590]]);
        await settle(page);
        const st = await G(page, () => { const e = document.getElementById('stick'); return { on: !e.hidden, x: parseFloat(e.style.left) }; });
        await touch('touchEnd');
        assert(st.on && Math.abs(st.x - 90) < 2, `a touch frees the mouse and the stick shows under the thumb (${JSON.stringify(st)})`);
        assert(!(await locked(page)), 'a touch frees the taken mouse');
      }
      if (await locked(page)) { await page.keyboard.press('Escape'); await settle(page); }
      await click(page, '#bMap', 'Map');
      assert.equal((await state(page)).mode, 'map');
      await click(page, '#bMapClose', 'Close');
      assert.equal((await state(page)).mode, 'play');
      pass(`a coarse 390x844 page with a mouse, lock ${lock}, in the explorer: a touch tap does not jump, a mouse click jumps on the first click, the mouse looks, Map and Close answer`, { turn: +turn.toFixed(2) });
      if (errors.length) throw new Error(errors.join('\n'));
      await ctx.close();
    }
  }
  console.log(`${n} checks passed`);
} finally {
  await browser.close();
}
