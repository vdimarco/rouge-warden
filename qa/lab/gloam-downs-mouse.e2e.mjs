// Gloam Downs' mouse in a real browser (public/lab/gloam-downs/), on software WebGL 2. Headless Chromium grants the Pointer Lock API, so
// the page takes the mouse for real and the moves come with movementX and movementY; the fallback is a page whose canvas has no
// requestPointerLock (an init script takes it away).
//   In a run at 1280x720: the hint shows while the mouse is free, Begin the run takes it, a move turns the view with no button, a left
//   click attacks and does not turn, a right click rolls, Escape frees it and opens the pause panel, Resume takes it again; when the
//   browser refuses the mouse once, the hint says to click again, a click on the view does not swing, and the page takes the mouse
//   after the wait; the pause key and the Lamp-room free it, and in 5 s of running past a foe with the mouse taken the view does not turn by itself.
//   In the explorer: Walk takes the mouse, Escape frees it and the hint shows, the click that takes it does not jump, and then a left
//   click jumps.
//   The fallback: the controls say to drag with the right button, the right drag turns the view, and a left click attacks only.
//   The Gaol's torn cell at 1280x720 and 390x844: at 8 yaws of the mouse the picture turns with it and forward moves the figure up the screen.
// The page runs with ?test: the game is stepped by __gloam.tick(), because software WebGL takes about a second a frame.
// Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs-mouse.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
async function open(ctxOpts, query, init) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init);
  if (process.env.DEBUG) await ctx.addInitScript(() => { document.addEventListener('pointerlockerror', () => console.log('LOCKERROR')); const o = Element.prototype.requestPointerLock; if (o) Element.prototype.requestPointerLock = function (x) { console.log('REQ', JSON.stringify(x), navigator.userActivation?.isActive); const r = o.call(this, x); r?.catch?.(e => console.log('REJECT', e.name, e.message)); return r; }; document.addEventListener('pointerlockchange', () => console.log('CHANGE', !!document.pointerLockElement)); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.DEBUG) page.on('console', m => { if (!m.text().includes('GL Driver')) console.log('console', m.text()); });
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
  return { ctx, page, errors };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const state = page => G(page, () => window.__gloam.state());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const locked = page => G(page, () => document.pointerLockElement?.id === 'view' && window.__gloam.state().mouse.locked);
// the pointer lock events come a moment after the request
const settle = page => page.waitForTimeout(250);
// Chrome refuses a pointer lock asked for too soon after the last ("too many pointer lock requests in a short window of time"), which a
// player clicking Resume never meets, so the test waits 2.5 s before it takes the mouse again
const cool = page => page.waitForTimeout(2500);
// the loading screen fades out over 0.5 s: a picture waits for it
const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const postAhead = (page, d, turn = 0) => G(page, ([d, turn]) => {
  const s = window.__gloam.state(), a = s.yaw + turn;
  return window.__gloam.post(s.x + Math.sin(a) * d, s.z + Math.cos(a) * d);
}, [d, turn]);
const hits = async page => (await G(page, () => window.__gloam.posts())).reduce((k, p) => k + p.hits.length, 0);

try {
  /* ---------------- a run, the mouse taken ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7');
    assert.match(await page.textContent('#runControls'), /Click the view to take the mouse\. Move the mouse to look\. Left click attacks, right click rolls\. Esc frees the mouse\./);
    assert(!(await page.isVisible('#mouseHint')), 'the hint does not show over a card');
    await shot(page, 'run-help-1280');
    await page.click('#bBegin');
    await settle(page);
    assert(await locked(page), 'Begin the run takes the mouse');
    assert(!(await page.isVisible('#mouseHint')), 'the hint hides once the mouse is taken');
    await tick(page, 0.2, 'live');

    // a move with no button turns the view: right turns right (the yaw goes down), down tilts the view down
    await page.mouse.move(640, 360);
    await tick(page, 0.05, 'live');
    let s0 = await state(page);
    await page.mouse.move(740, 400, { steps: 5 });
    await tick(page, 0.05, 'live');
    let s1 = await state(page);
    assert(s1.cam.yaw < s0.cam.yaw - 0.15, `a move right turns the view right (${s0.cam.yaw} to ${s1.cam.yaw})`);
    assert(s1.cam.pitch > s0.cam.pitch, 'a move down tilts the view down');
    assert.equal(await hits(page), 0, 'a move does not swing');
    // a left click attacks at a post 2 m ahead, and does not turn the view
    await postAhead(page, 2.0);
    await tick(page, 0.05, {});
    const yawClick = (await state(page)).cam.yaw;
    await page.mouse.down();
    await tick(page, 0.1, 'live');
    await page.mouse.up();
    await tick(page, 0.8, 'live');
    assert((await hits(page)) >= 1, 'a left click attacks');
    assert.equal((await state(page)).cam.yaw, yawClick, 'a left click does not turn the view');
    // a right click rolls
    await page.mouse.down({ button: 'right' });
    await tick(page, 0.1, 'live');
    const rolled = (await run(page)).move;
    await page.mouse.up({ button: 'right' });
    await tick(page, 1.0, 'live');
    assert.equal(rolled, 'roll', `a right click rolls (${rolled})`);
    assert.equal((await state(page)).cam.yaw, yawClick, 'a right click does not turn the view');
    pass('a run: Begin takes the mouse, a move turns the view, a left click attacks and a right click rolls, and no click turns the view', { turn: +(s0.cam.yaw - s1.cam.yaw).toFixed(3) });

    // Escape frees the mouse and opens the pause panel; Resume takes it again
    await page.keyboard.press('Escape');
    await settle(page);
    assert(!(await locked(page)), 'Escape frees the mouse');
    assert.equal((await run(page)).mode, 'pause', 'losing the mouse in play opens the pause panel');
    assert(await page.isVisible('#pause'), 'the pause panel shows');
    assert.match(await page.textContent('#pauseControls'), /Click the view to take the mouse/);
    await shot(page, 'pause-1280');
    await cool(page);
    await page.click('#bResume');
    await settle(page);
    assert(await locked(page), 'Resume takes the mouse again');
    assert.equal((await run(page)).mode, 'play');
    /* the browser refuses the mouse once (Chrome does, for a Resume clicked soon after Escape): the page waits 1.5 s before it asks
       again. In that wait the hint says to click again, and a click on the view only asks again: it does not swing */
    await page.keyboard.press('Escape');
    await settle(page);
    assert.equal((await run(page)).mode, 'pause');
    await cool(page);
    await G(page, () => {
      const v = document.getElementById('view');
      v.requestPointerLock = () => { delete v.requestPointerLock; return Promise.reject(new DOMException('refused', 'SecurityError')); };
    });
    await page.click('#bResume');
    await settle(page);
    await tick(page, 0.05, 'live');
    let m = (await state(page)).mouse;
    assert(!m.locked && m.waiting && m.hint, `after a refusal the hint shows (${JSON.stringify(m)})`);
    assert.equal(m.text, 'Click again to look with the mouse');
    assert.equal((await run(page)).mode, 'play', 'the refusal does not pause the run');
    await shot(page, 'hint-again-1280');
    await postAhead(page, 2.0);
    await tick(page, 0.05, {});
    const before = await hits(page);
    await page.mouse.click(640, 300);
    await tick(page, 0.8, 'live');
    assert.equal(await hits(page), before, 'a click in the wait does not swing');
    assert.notEqual((await run(page)).move, 'roll', 'and does not roll');
    // when the wait is over the page asks again by itself, and takes the mouse
    await page.waitForTimeout(1500);
    await settle(page);
    assert(await locked(page), 'after the wait the page takes the mouse');
    await tick(page, 0.05, 'live');
    assert(!(await state(page)).mouse.hint, 'and the hint hides');
    // the pause key frees it so the card's buttons can be clicked; so does the Lamp-room
    await page.keyboard.press('p');
    await settle(page);
    assert.equal((await run(page)).mode, 'pause');
    assert(!(await locked(page)), 'the pause panel frees the mouse');
    await cool(page);
    await page.click('#bResume');
    await settle(page);
    assert(await locked(page), 'Resume takes it again');
    // the browser takes the mouse back by itself (as when the window loses the focus): the pause panel opens
    await G(page, () => document.exitPointerLock());
    await settle(page);
    assert.equal((await run(page)).mode, 'pause', 'the browser taking the mouse back in play opens the pause panel');
    await cool(page);
    await page.click('#bResume');
    await settle(page);
    assert(await locked(page), 'Resume takes it again');
    await G(page, () => window.__gloam.lamp());
    await settle(page);
    assert(!(await locked(page)), 'the Lamp-room frees the mouse');
    assert.equal((await run(page)).mode, 'lamp', 'and the pause panel did not open over it');
    pass('Escape, or the browser, frees the mouse and pauses; Resume takes it again; a card frees it');
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- a run: no turn by itself while the mouse is taken ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7');
    await page.click('#bBegin');
    await settle(page);
    assert(await locked(page));
    await tick(page, 0.1, 'live');
    // a training post 4 m ahead and 3 m to the side, which the combat camera turns to with the mouse free; run past it for 5 s
    await postAhead(page, 5, 0.7);
    const yaw0 = (await state(page)).cam.yaw;
    await page.keyboard.down('w');
    let turned = 0, foe = null;
    for (let i = 0; i < 10; i++) {
      const s = await tick(page, 0.5, 'live');
      turned = Math.max(turned, Math.abs(s.cam.yaw - yaw0));
      foe ??= s.cam.foe;
    }
    await page.keyboard.up('w');
    const s = await state(page);
    assert(foe, `the post was the combat camera's foe (${foe})`);
    assert.equal(turned, 0, `the view turned by ${turned} rad by itself`);
    // with the mouse freed (the pause, then Resume by the keys, which a test cannot make a gesture), the camera turns as before
    pass('5 s of running past a foe with the mouse taken: the view does not turn by itself', { foe });
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- the explorer ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?fresh&test');
    assert(await page.isVisible('#help'), 'the help card shows on a first visit');
    assert.match(await page.textContent('#helpKeys'), /Click the view to take the mouse\. Move the mouse to look round\. Left click jumps\. Esc frees the mouse\./);
    await shot(page, 'help-1280');
    await page.click('#bStart');
    await settle(page);
    assert(await locked(page), 'Walk takes the mouse');
    await page.keyboard.press('Escape');
    await settle(page);
    assert(!(await locked(page)), 'Escape frees the mouse');
    assert.equal((await state(page)).mode, 'play', 'in the explorer the walk goes on');
    await tick(page, 0.05, 'live');
    assert(await page.isVisible('#mouseHint'), 'the hint shows while the mouse is free');
    assert.equal(await page.textContent('#mouseHint'), 'Click to look with the mouse');
    await G(page, () => window.__gloam.draw());
    await shot(page, 'hint-1280');
    const hb = await page.locator('#mouseHint').boundingBox();
    // the click that takes the mouse does nothing else: no jump
    const y0 = (await state(page)).y;
    await page.mouse.click(640, 300);
    await settle(page);
    let top = y0;
    for (let i = 0; i < 6; i++) top = Math.max(top, (await tick(page, 0.05, 'live')).y);
    assert(await locked(page), 'a click on the view takes the mouse');
    assert(top < y0 + 0.05, `the click that took the mouse did not jump (${y0} to ${top})`);
    assert(!(await page.isVisible('#mouseHint')), 'the hint hides');
    // then a left click jumps
    await page.mouse.down();
    for (let i = 0; i < 6; i++) top = Math.max(top, (await tick(page, 0.05, 'live')).y);
    await page.mouse.up();
    await tick(page, 1.2, 'live');
    assert(top > y0 + 0.3, `a left click with the mouse taken jumps (${top - y0} m)`);
    pass('the explorer: Walk takes the mouse, Escape frees it and the hint shows, the taking click does not jump, a left click jumps', { hint: [hb.x, hb.y, hb.width, hb.height].map(Math.round), jump: +(top - y0).toFixed(2) });
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- the fallback: no pointer lock ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7', () => { delete HTMLCanvasElement.prototype.requestPointerLock; delete Element.prototype.requestPointerLock; });
    assert.match(await page.textContent('#runControls'), /Hold the right button and drag the view to look\. Left click attacks\./);
    await page.click('#bBegin');
    await settle(page);
    assert(!(await locked(page)), 'with no pointer lock the mouse stays free');
    await tick(page, 0.05, 'live');
    assert(!(await page.isVisible('#mouseHint')), 'and the hint does not show');
    // a move with no button does not turn the view
    let yaw0 = (await state(page)).cam.yaw;
    await page.mouse.move(640, 300); await page.mouse.move(540, 300, { steps: 4 });
    await tick(page, 0.05, 'live');
    assert.equal((await state(page)).cam.yaw, yaw0, 'a move with no button does not turn the view');
    // a left click attacks and does not turn the view
    await postAhead(page, 2.0);
    await tick(page, 0.05, {});
    await page.mouse.down(); await page.mouse.move(600, 300, { steps: 4 });
    await tick(page, 0.1, 'live');
    await page.mouse.up();
    await tick(page, 0.8, 'live');
    assert((await hits(page)) >= 1, 'a left click attacks');
    assert.equal((await state(page)).cam.yaw, yaw0, 'a left drag does not turn the view');
    // a right drag turns the view and does not swing
    const h0 = await hits(page);
    await page.mouse.move(640, 300); await page.mouse.down({ button: 'right' }); await page.mouse.move(520, 300, { steps: 4 }); await page.mouse.up({ button: 'right' });
    await tick(page, 0.3, 'live');
    const yaw1 = (await state(page)).cam.yaw;
    assert(yaw1 < yaw0 - 0.3 || yaw1 > yaw0 + 0.3, `a right drag turns the view (${yaw0} to ${yaw1})`);
    assert.equal(await hits(page), h0, 'and does not swing');
    assert.notEqual((await run(page)).move, 'roll', 'and does not roll');
    pass('the fallback: a right drag turns the view, a left click attacks only, and a move with no button does nothing', { turn: +(yaw1 - yaw0).toFixed(3) });
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- a phone: no hint, the touch controls ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?run&test&fresh&seed=5');
    await page.tap('#bBegin');
    await tick(page, 0.1, {});
    assert(!(await page.isVisible('#mouseHint')), 'no mouse hint on a touch screen');
    await page.tap('#bMap');
    assert.equal((await run(page)).mode, 'pause');
    assert.match(await page.textContent('#pauseControls'), /Drag on the left half to move/);
    await shot(page, 'pause-390');
    pass('a phone: no mouse hint, and the pause panel shows the touch controls');
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  /* ---------------- the Gaol's torn cell: a move goes the way the screen shows ----------------
     In the cell where the first wisp hangs, the framed shot leans the view toward the mouth. At 8 yaws of the mouse (45° apart) and at
     both sizes, a press of forward moves the figure up the screen, as drawn from the view of that step (both points projected with the
     same view), and the picture has turned with the mouse. Once the mouse stops, nothing turns the view for 1.5 s (the mouse is taken),
     and then the eye stands 2.5 m back or the near fade leaves out the whole figure, its lantern and blade too ("it zooms in too much").
     The framed shot of 100a12c4 showed the cell from a yaw up to 180° from the mouse's: there a press of back went up the screen at one
     yaw and down at another, and the picture stood still across 90° of turn. That of 1974d668 turned the view by itself once the mouse
     stopped, and left the eye about 1 m back with the lantern and the blade over the view */
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h } }, '?run&test&fresh&nodraw&seed=7');
    if (await page.isVisible('#runHelp')) await page.click('#bBegin');
    await G(page, () => window.__gloam.release?.());
    const rows = await G(page, () => {
      const g = window.__gloam, out = [];
      for (const turn of [0, 45, 90, 135, 180, 225, 270, 315]) {
        g.teleport(1.6, -1.6, Math.PI, -1.7); g.tick(1, { mouse: true });
        const y0 = g.state().cam.yaw;
        g.tick(turn / 45 * 0.75, { dyaw: (Math.PI / 4) / 45, mouse: true });
        const y1 = g.state().cam.yaw;
        const still = g.tick(1.5, { mouse: true });
        const s0 = g.state(), s1 = g.tick(0.15, { mz: 1, mouse: true });
        const a = g.project([s0.x, s0.y + 0.9, s0.z]), b = g.project([s1.x, s1.y + 0.9, s1.z]);
        const dx = b[0] - a[0], dy = b[1] - a[1];
        out.push({ turn, shown: +(Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)) * 180 / Math.PI).toFixed(0), cell: s0.y < -1, moved: +Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2), dx: Math.round(dx), dy: Math.round(dy), off: +(Math.abs(Math.atan2(dx, -dy)) * 180 / Math.PI).toFixed(0), self: +(Math.abs(still.cam.yaw - y1) * 180 / Math.PI).toFixed(3), dist: +still.cam.dist.toFixed(2), fade: still.fade });
      }
      return out;
    });
    for (const r of rows) {
      assert(r.cell, `${w}x${h} at ${r.turn}°: the lamplighter stands in the cell`);
      assert(r.moved > 0.05 && r.dy < -2 && r.off <= 30, `${w}x${h} at a mouse turn of ${r.turn}°: forward moved the figure ${r.moved} m, ${r.dx}, ${r.dy} px on screen (${r.off}° from up)`);
      // the picture turned with the mouse, by 80 to 120% of its turn (a turn past 180° reads as one the other way)
      const want = r.turn > 180 ? r.turn - 360 : r.turn;
      assert(Math.abs(r.shown - want) <= 0.2 * Math.abs(want) + 1, `${w}x${h}: a mouse turn of ${r.turn}° turned the picture ${r.shown}°`);
      assert.equal(r.self, 0, `${w}x${h} at ${r.turn}°: the view turned by itself by ${r.self}° after the mouse stopped`);
      assert(r.dist >= 2.5 || r.fade === 2, `${w}x${h} at ${r.turn}°: 1.5 s after the mouse stopped the eye stands ${r.dist} m back with a fade of ${r.fade}`);
    }
    pass(`the torn cell at ${w}x${h}: at 8 yaws of the mouse the picture turns with it, stays still when it stops, the figure is out of the way, and forward moves the figure up the screen`, rows.map(r => [r.turn, r.shown, r.dx, r.dy, r.off, r.dist, r.fade]));
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  }
  console.log(`${n} checks passed`);
} finally {
  await browser.close();
}
