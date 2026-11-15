// Riftwalk (public/lab/riftwalk/), checked in Chromium with SwiftShader (software WebGL).
// The check loads the 6,000-splat test worlds (?worlds=lite): software WebGL draws a full world at a frame in many
// seconds. The rules, the portals and the controls are the same.
// - Start waits for the first world; the HUD, the hint and the walk pad show as they should;
// - a click on a wisp catches it, and Space catches the wisp in the middle of the view;
// - three wisps open the rift; a click on the rift carries the walker into the next world, and the rift shuts;
// - the keys walk, and the walker stays in the walk circle;
// - four crossings end the walk at the cottage with a time; Walk again starts over;
// - reduced motion crosses with no glide; a phone layout shows the pad clear of the hint and takes taps.
// Needs the static server (see AGENTS.md): node qa/lab/riftwalk.e2e.mjs
// SHOTS=<dir> also saves pictures of the canvas (with the test worlds, which look like loose specks).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const URL_ = (process.env.SITE_URL || 'http://127.0.0.1:8765') + '/lab/riftwalk/?worlds=lite&px=1&capture';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const started = Date.now(), pass = (name, data) => console.log(((Date.now() - started) / 1000).toFixed(0) + 's PASS ' + name + (data ? ' ' + JSON.stringify(data) : ''));
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, ...options });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_);
  const q = (body, arg) => page.evaluate(new Function('arg', `const q = window.__riftwalk; ${body}`), arg);
  const state = () => q('return q.state();');
  const until = async (test, what, ms = 60000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s)); await page.waitForTimeout(150); } };
  const shot = async name => { if (!shots) return; const d = await page.evaluate(() => document.getElementById('view').toDataURL('image/png')); writeFileSync(join(shots, name), Buffer.from(d.split(',')[1], 'base64')); };
  return { page, errors, q, state, until, shot };
}
const text = (page, id) => page.evaluate(id => document.getElementById(id).textContent, id);
// Go through the open rift with Space and wait for the rift to shut behind the walker.
async function cross(t, jumps) { await t.q('q.openNow();'); await t.until(s => s.rift === 'open', 'the rift opens'); await t.page.keyboard.press('Space'); return t.until(s => (s.jumps === jumps && s.rift === 'shut' && !s.gliding) || s.phase === 'end', 'crossing ' + jumps); }
try {
  {
    const t = await open(), { page } = t;
    assert.equal(await page.evaluate(() => document.getElementById('hud').hidden), true, 'no HUD on the title');
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 });
    assert.equal(await text(page, 'go'), 'Start walking');
    await page.click('#go');
    let s = await t.until(s => s.phase === 'play', 'the walk starts');
    assert.equal(s.world, 'cottage'); assert.equal(await text(page, 'hWorld'), 'Cottage'); assert.equal(await text(page, 'hWisps'), 'Wisps 0 of 3');
    assert.match(await text(page, 'hint'), /Drag to look around\. Click a wisp/);
    assert.equal(await page.evaluate(() => document.getElementById('pad').hidden), true, 'no walk pad with a mouse');
    pass('Start waits for the world; the HUD and the first hint show');

    // A click on a wisp catches it. A click on empty space catches nothing.
    await t.q('const w = q.wisp(0); q.lookAt(w.x, w.y, w.z);'); await page.waitForTimeout(600);
    const at = await t.q('return q.wispScreen(0);'); assert(at && Math.abs(at.x - 400) < 30 && Math.abs(at.y - 225) < 30, 'the wisp is in the middle of the view: ' + JSON.stringify(at));
    await t.shot('riftwalk-wisp.png');
    await page.mouse.click(60, 400); assert.equal((await t.state()).caught, 0, 'a click on empty space catches nothing');
    await page.mouse.click(at.x, at.y); s = await t.until(s => s.caught === 1, 'a click catches the wisp');
    assert.equal(await text(page, 'hWisps'), 'Wisps 1 of 3'); assert.match(await text(page, 'hint'), /2 left/);
    // A drag turns the view and catches nothing.
    const before = await t.q('const w = q.wisp(1); return q.wispScreen(1);');
    await page.mouse.move(400, 225); await page.mouse.down(); await page.mouse.move(250, 225, { steps: 6 }); await page.mouse.up();
    assert.equal((await t.state()).caught, 1, 'a drag catches nothing');
    const after = await t.q('return q.wispScreen(1);'); assert(!before || !after || Math.abs(before.x - after.x) > 40, 'a drag turns the view');
    // Space catches the wisp in the middle of the view.
    for (const k of [1, 2]) { await t.q('const w = q.wisp(arg); q.lookAt(w.x, w.y, w.z);', k); await page.waitForTimeout(400); await page.keyboard.press('Space'); await t.until(s => s.caught >= k + 1 || s.rift !== 'shut', 'Space catches wisp ' + k); }
    s = await t.until(s => s.rift === 'open', 'three wisps open the rift');
    assert.deepEqual(s.visible.slice(0, 2), [true, true], 'the next world is drawn behind the rift');
    assert.match(await text(page, 'hint'), /The rift is open\. Click it, press Space, or walk in\./);
    pass('a click and Space catch wisps, and three wisps open the rift');

    // A click on the rift carries the walker through. The rift shuts and the next world's wisps wait.
    await t.q('const r = q.rift(); q.lookAt(r.x, r.y, r.z);'); await page.waitForTimeout(600); await t.shot('riftwalk-rift.png');
    await page.mouse.click(400, 225);
    s = await t.until(s => s.jumps === 1 && s.rift === 'shut' && !s.gliding, 'the walker crosses');
    assert.equal(s.world, 'shore'); assert.equal(s.caught, 0); assert.deepEqual(s.visible, [false, true, false, false], 'only the new world is drawn');
    assert.equal(await text(page, 'hWorld'), 'Shore ruin'); assert.equal(await text(page, 'hWisps'), 'Wisps 0 of 3');
    pass('a click on the open rift crosses into the next world', { place: s.place });

    // The keys walk, and the walker stays in the walk circle (1.9 m in the shore ruin).
    const from = s.place; await page.keyboard.down('w'); await page.waitForTimeout(5000); await page.keyboard.up('w');
    s = await t.state(); const moved = Math.hypot(s.place.x - from.x, s.place.z - from.z), far = Math.hypot(s.place.x, s.place.z);
    assert(moved > 0.3, 'W walks: ' + moved); assert(far <= 1.9 + 1e-3, 'the walker stays in the circle: ' + far);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    pass('the keys walk inside the walk circle', { moved: +moved.toFixed(2), fromCentre: +far.toFixed(2) });

    // Three more crossings bring the walker home, and the end card shows a time.
    for (const jumps of [2, 3, 4]) await cross(t, jumps);
    s = await t.until(s => s.phase === 'end', 'the walk ends at home');
    assert.equal(s.world, 'cottage'); assert.equal(await page.evaluate(() => document.getElementById('end').hidden), false);
    assert.match(await text(page, 'endTime'), /^\d+:\d\d$/); assert.match(await text(page, 'endBest'), /^\d+:\d\d$/);
    assert.equal(await page.evaluate(() => document.getElementById('hud').hidden), true, 'the HUD hides on the end card');
    await page.click('#again'); s = await t.until(s => s.phase === 'play' && s.jumps === 0, 'Walk again starts over');
    assert.equal(s.world, 'cottage'); assert.equal(s.rift, 'shut'); assert(s.time < 3);
    assert.deepEqual(t.errors, [], 'no console errors');
    pass('four crossings end at the cottage with a time, and Walk again starts over');
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 }); await page.click('#go'); await t.until(s => s.phase === 'play', 'start');
    const s = await cross(t, 1); assert.equal(s.world, 'shore');
    assert.deepEqual(t.errors, []);
    pass('reduced motion crosses the rift');
    await page.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 });
    const startBox = await page.locator('#go').boundingBox(); assert(startBox.height >= 44, 'Start is 44px tall: ' + startBox.height);
    await page.tap('#go'); await t.until(s => s.phase === 'play', 'start');
    assert.match(await text(page, 'hint'), /Tap a wisp/);
    const pad = await page.locator('#pad').boundingBox(), hint = await page.locator('#hint').boundingBox(), hud = await page.locator('#hud').boundingBox();
    assert(pad && pad.width >= 100, 'the walk pad shows on a touch screen'); assert(hint.y + hint.height <= pad.y || hint.x >= pad.x + pad.width, 'the hint is clear of the pad');
    assert(hud.x >= 0 && hud.x + hud.width <= 390, 'the HUD fits the width: ' + JSON.stringify(hud)); assert(hint.x >= 0 && hint.x + hint.width <= 390, 'the hint fits the width');
    await t.q('const w = q.wisp(0); q.lookAt(w.x, w.y, w.z);'); await page.waitForTimeout(600);
    const at = await t.q('return q.wispScreen(0);'); await page.touchscreen.tap(at.x, at.y); await t.until(s => s.caught === 1, 'a tap catches the wisp');
    await t.shot('riftwalk-phone.png');
    // The pad walks.
    const from = (await t.state()).place; await page.touchscreen.tap(pad.x + pad.width / 2, pad.y + 8);
    await page.dispatchEvent('#pad', 'pointerdown', { pointerId: 9, clientX: pad.x + pad.width / 2, clientY: pad.y + 6, pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(2500); await page.dispatchEvent('#pad', 'pointerup', { pointerId: 9, pointerType: 'touch' });
    const to = (await t.state()).place; assert(Math.hypot(to.x - from.x, to.z - from.z) > 0.15, 'the pad walks: ' + JSON.stringify([from, to]));
    await t.q('q.openNow();'); await t.until(s => s.rift === 'open', 'open'); assert.match(await text(page, 'hint'), /Tap it, or walk in/);
    await t.q('const r = q.rift(); q.lookAt(r.x, r.y, r.z);'); await page.waitForTimeout(600); await page.touchscreen.tap(195, 422);
    const s = await t.until(s => s.jumps === 1 && s.rift === 'shut' && !s.gliding, 'a tap on the rift crosses'); assert.equal(s.world, 'shore');
    assert.deepEqual(t.errors, []);
    pass('phone layout: the pad, the hint and the HUD fit; a tap catches a wisp and crosses the rift');
    await page.close();
  }
  console.log('riftwalk checks passed');
} finally { await browser.close(); }
