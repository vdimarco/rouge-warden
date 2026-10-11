// Shore of the Ancients on a desktop, checked in Chromium under the default autoplay rule:
// - the mouse pushes the following camera; the mouse may leave the window; the minimap look ends on release;
// - Esc and the top-left Menu button open the menu; a held Esc opens it once; a resize keeps the hero's order and keys;
//   leaving full screen offers windowed play and never forces full screen back;
// - mouse play starts without the spellbook or touch-only HUD controls; K and the menu still open the spellbook;
//   a touch phone keeps its movement pad, skill-point control and opening spellbook;
// - sound: the match is audible at the output with a clean harness; a saved mute shows a chip that turns it back on;
//   a click that wakes a stopped context does not mute; Test sound reports the level;
// - motion: at a simulated 144 Hz the hero moves smoothly on screen (no 60 Hz judder);
// - an ultra-wide screen stays inside the pixel budget.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/desktop.e2e.mjs
// The browser runs without SwiftShader flags: they route the 2D canvas through an emulated GPU, which here is too slow.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const pass = (name, data) => { results.push(name); console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };

// Every connection to the speakers also feeds an analyser; every play() outcome is logged.
const TAP = () => {
  const connect = AudioNode.prototype.connect; window.__outputs = []; window.__plays = [];
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) { const c = this.context; if (!c.__meter) { c.__meter = c.createAnalyser(); c.__meter.fftSize = 2048; window.__outputs.push(c); } connect.call(this, c.__meter); }
    return connect.call(this, dest, ...rest);
  };
  window.__rms = () => Math.max(0, ...window.__outputs.map(c => { const d = new Float32Array(2048); c.__meter.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length); }));
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { const p = play.apply(this, a), name = this.src.split('/').pop(); p?.then?.(() => window.__plays.push(name + ':ok'), e => window.__plays.push(name + ':' + e.name)); return p; };
};
// Reads page state without giving the page user activation (page.evaluate would), so autoplay rules apply as for a player.
async function reader(page) {
  const cdp = await page.context().newCDPSession(page);
  return async expr => { const r = await cdp.send('Runtime.evaluate', { expression: expr, userGesture: false, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
}
const SNAP = `(async () => (await import('/tidebreak/main.js')).snapshot())()`;
async function open(width, height, { init = [], query = '', touch = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(TAP); for (const f of init) await page.addInitScript(f);
  await page.goto(URL + query);
  const read = await reader(page);
  for (let i = 0; i < 300 && await read(`document.getElementById('play').disabled`); i++) await page.waitForTimeout(200);
  return { page, errors, read, touch, snap: () => read(SNAP) };
}
const centre = async (read, selector) => read(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const shown = (read, selector) => read(`(() => { const e = document.querySelector(${JSON.stringify(selector)}), r = e.getBoundingClientRect(); return !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && r.width > 0 && r.height > 0; })()`);
async function toMatch(t) {
  const play = await centre(t.read, '#play'); await t.page.mouse.click(play.x, play.y);
  for (let i = 0; i < 150 && !(await t.read(`!document.getElementById('hud').hidden`)); i++) { await t.page.keyboard.press('Enter'); await t.page.waitForTimeout(200); }
  for (let i = 0; i < 100 && !(await t.snap()).running; i++) await t.page.waitForTimeout(200);
  await t.page.waitForTimeout(500);
  const desktop = await t.read(`matchMedia('(hover: hover) and (pointer: fine)').matches`);
  if (desktop) assert.equal(await t.read(`document.getElementById('sheet').open`), false, 'mouse play starts without an automatic spellbook');
  if (t.touch) {
    assert.equal(desktop, false, 'the phone context uses touch input');
    assert.equal(await t.read(`document.getElementById('sheet').open && document.getElementById('sheet').classList.contains('spellbook-sheet')`), true, 'touch play retains the opening spellbook');
    assert.equal(await shown(t.read, '#joystick'), true, 'the touch movement pad remains visible');
    assert.equal(await shown(t.read, '#skill-points'), true, 'the touch skill-point control remains visible');
  }
  if (await t.read(`document.getElementById('sheet').open`)) await t.page.keyboard.press('Escape');
  await t.page.waitForTimeout(300);
}
const until = async (f, ok, tries = 60, wait = 250) => { let v; for (let i = 0; i < tries; i++) { v = await f(); if (ok(v)) return v; await new Promise(r => setTimeout(r, wait)); } return v; };
const rmsOver = async (t, ms) => { let peak = 0; for (let i = 0; i < ms / 250; i++) { await t.page.waitForTimeout(250); peak = Math.max(peak, await t.read('window.__rms()')); } return peak; };

try {
  /* ---------------- sound with a clean harness ---------------- */
  {
    const t = await open(1440, 900);
    assert.equal(await t.read('navigator.userActivation.hasBeenActive'), false, 'the harness gives no activation before the first click');
    await toMatch(t);
    const rms = await rmsOver(t, 4000), plays = await t.read('window.__plays');
    assert(rms > .01, 'the match is audible after a real click on Play: rms ' + rms);
    assert(!plays.some(p => /NotAllowed/.test(p)), 'no track was refused: ' + plays);
    pass('a real click on Play gives an audible draft and match', { rms: +rms.toFixed(3) });

    for (const selector of ['#joystick', '#coach', '#skill-points']) assert.equal(await shown(t.read, selector), false, selector + ' stays out of the desktop battlefield');
    await t.page.keyboard.press('k');
    assert.equal(await t.read(`document.getElementById('sheet').open && document.getElementById('sheet').classList.contains('spellbook-sheet')`), true, 'K opens the spellbook');
    await t.page.keyboard.press('Escape');
    assert.equal(await t.read(`document.getElementById('sheet').open`), false, 'Esc closes the spellbook');
    assert.equal((await t.snap()).paused, false, 'closing the spellbook returns to play');
    await t.page.keyboard.press('Escape');
    const book = await centre(t.read, '#menu-spellbook'); await t.page.mouse.click(book.x, book.y);
    assert.equal(await t.read(`document.getElementById('sheet').open && document.getElementById('sheet').classList.contains('spellbook-sheet')`), true, 'the pause menu opens the spellbook');
    await t.page.keyboard.press('Escape');
    assert.equal((await t.snap()).paused, false, 'closing the menu spellbook returns to play');
    pass('desktop controls stay clear, and K or the menu opens the spellbook');

    // Test sound: the game plays a chime and reports its own level.
    await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(200);
    const test = await centre(t.read, '#pause-test'); await t.page.mouse.click(test.x, test.y);
    const report = await until(() => t.read(`document.getElementById('sound-test-result')?.textContent || ''`), s => /playing sound now|could not/.test(s), 40);
    assert.equal(await t.read(`!!document.getElementById('sound-test-back')`), true, 'the result panel has a way back');
    assert.match(report, /playing sound now/); assert.match(report, /Unmute site/);
    pass('Test sound reports the level and where to look outside the game');

    // A deliberate mute still works and persists; the chip turns it back on.
    await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(200);
    let speaker = await centre(t.read, '#hud-sound'); await t.page.mouse.click(speaker.x, speaker.y); await t.page.waitForTimeout(200);
    assert.equal(await t.read(`localStorage.getItem('tidebreak.sound')`), 'off');
    assert.equal(await t.read(`document.getElementById('muted-chip').hidden`), false, 'a saved mute shows the chip');
    const chip = await centre(t.read, '#muted-chip'); await t.page.mouse.click(chip.x, chip.y); await t.page.waitForTimeout(200);
    assert.equal(await t.read(`localStorage.getItem('tidebreak.sound')`), 'on');
    assert.equal(await t.read(`document.getElementById('muted-chip').hidden`), true);
    pass('the speaker mutes on purpose, and the chip turns sound back on');

    // A click that wakes a stopped context does not also mute it.
    await t.read(`Promise.all(window.__outputs.map(c => c.suspend()))`);
    speaker = await centre(t.read, '#hud-sound'); await t.page.mouse.click(speaker.x, speaker.y); await t.page.waitForTimeout(300);
    assert.equal(await t.read(`document.getElementById('hud-sound').getAttribute('aria-pressed')`), 'true');
    assert.notEqual(await t.read(`localStorage.getItem('tidebreak.sound')`), 'off');
    const after = await rmsOver(t, 2000);
    assert(after > .01, 'sound is back after the waking click: rms ' + after);
    pass('a click that wakes stopped audio keeps the sound on', { rms: +after.toFixed(3) });
    assert.deepEqual(t.errors, []); await t.page.close();
  }
  {
    // A saved mute shows on hero select; one click there turns sound on and plays the menu music.
    const t = await open(1440, 900, { init: [() => localStorage.setItem('tidebreak.sound', 'off')] });
    assert.equal(await t.read(`document.getElementById('menu-muted-chip').hidden`), false, 'hero select shows the muted chip');
    const chip = await centre(t.read, '#menu-muted-chip'); await t.page.mouse.click(chip.x, chip.y);
    const rms = await rmsOver(t, 3000);
    assert.equal(await t.read(`localStorage.getItem('tidebreak.sound')`), 'on');
    assert(rms > .01, 'the menu is audible after the chip: rms ' + rms);
    pass('a saved mute is visible on hero select and one click restores sound', { rms: +rms.toFixed(3) });
    assert.deepEqual(t.errors, []); await t.page.close();
  }

  /* ---------------- camera, menu and input ---------------- */
  {
    const t = await open(1440, 900), { page, read, snap } = t;
    await toMatch(t);
    const menu = await page.locator('#pause').boundingBox();
    assert(menu && menu.x < 40 && menu.y < 40 && menu.width >= 80, 'the Menu button sits in the top left: ' + JSON.stringify(menu));
    assert.match(await page.locator('#pause').innerText(), /Menu\s*Esc/i);
    pass('the top-left Menu button reads Menu and Esc');

    const settle = async (x, ok) => { await page.mouse.move(x, 450); return until(async () => (await snap()).graphics, g => ok(g.push), 80); };
    const mid = await settle(720, p => Math.abs(p) < 40), right = await settle(1435, p => p > 400), left = await settle(5, p => p < -400);
    assert(Math.abs(mid.push) < 40 && right.push > 400 && left.push < -400, `the mouse pushes the view: ${mid.push} ${right.push} ${left.push}`);
    assert(!left.freeCam, 'the push does not detach the camera');
    pass('the mouse pushes the following view', { right: Math.round(right.push), left: Math.round(left.push) });

    const before = (await snap()).time;
    await page.mouse.move(-50, 450);
    await read(`window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })), document.documentElement.dispatchEvent(new MouseEvent('mouseleave'))`);
    await page.waitForTimeout(1500);
    const outside = await snap();
    assert(!outside.paused && outside.time > before + .5 && outside.graphics.push < -200, 'the clock runs and the push holds with the mouse outside');
    pass('leaving the window with the mouse does not pause');

    // Holding Space centres the view on the hero.
    await page.keyboard.down(' ');
    const held = await until(async () => (await snap()).graphics, g => Math.abs(g.push) < 30, 80);
    await page.keyboard.up(' ');
    assert(Math.abs(held.push) < 30, 'holding Space removes the push: ' + held.push);
    pass('holding Space centres the view on the hero');

    // Esc: a tap opens and closes the menu; a held Esc (auto-repeat) opens it once and leaves it open.
    await page.mouse.move(720, 450);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    assert.equal((await snap()).paused, true); assert.equal(await read(`!!document.getElementById('resume')`), true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    assert.equal((await snap()).paused, false);
    const cdp = await page.context().newCDPSession(page), esc = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...esc });
    for (let i = 0; i < 31; i++) { await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', autoRepeat: true, ...esc }); await page.waitForTimeout(33); }
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...esc }); await page.waitForTimeout(150);
    assert.equal(await read(`document.getElementById('sheet').open`), true, 'a held Esc leaves the menu open');
    assert.equal((await snap()).paused, true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    pass('Esc taps open and close the menu, and a held Esc opens it once');

    // Minimap: the look lasts while it is held; release returns the view to the hero.
    const map = await centre(read, '#map-button');
    await page.mouse.move(map.x, map.y - 30); await page.mouse.down(); await page.waitForTimeout(400);
    assert.equal((await snap()).graphics.freeCam, true, 'holding the minimap looks there');
    await page.mouse.up(); await page.waitForTimeout(200);
    assert.equal((await snap()).graphics.freeCam, false, 'releasing the minimap returns the view to the hero');
    await page.mouse.move(720, 450); await page.keyboard.down('d'); await page.waitForTimeout(2500); await page.keyboard.up('d');
    const hero = (await snap()).graphics.heroScreen;
    assert(hero.x > 1440 * .16 && hero.x < 1440 * .84 && hero.y > 0 && hero.y < 900, 'the hero stays on screen: ' + JSON.stringify(hero));
    pass('the minimap look ends on release and the view follows the hero');

    // A resize keeps the move order and a held key.
    const p0 = (await snap()).player, target = await read(`(() => ({ x: innerWidth * .8, y: innerHeight * .45 }))()`);
    await page.mouse.click(target.x, target.y); await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1400, height: 880 }); await page.waitForTimeout(300);
    const p1 = (await snap()).player;
    assert.equal(p1.order?.type, 'move', 'the move order survives a resize: ' + JSON.stringify(p1.order));
    await page.keyboard.down('a'); await page.waitForTimeout(200);
    await page.setViewportSize({ width: 1440, height: 900 }); const xa = (await snap()).player.x; await page.waitForTimeout(800);
    const xb = (await snap()).player.x; await page.keyboard.up('a');
    assert(xb < xa - 20, `a held key keeps moving the hero after a resize: ${xa} -> ${xb}`);
    pass('a resize keeps the hero\'s order and held keys', { order: p1.order.type, moved: Math.round(xa - xb), from: Math.round(p0.x) });

    // Leaving full screen during play offers windowed play; nothing forces full screen back.
    await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {})); await page.waitForTimeout(300);
    assert.equal(await read('!!document.fullscreenElement'), true, 'the test page entered full screen');
    await read('document.exitFullscreen()'); await page.waitForTimeout(300);
    assert.equal(await read(`!!document.getElementById('fullscreen-back') && document.getElementById('resume').textContent`), 'Keep playing windowed');
    const windowed = await centre(read, '#resume'); await page.mouse.click(windowed.x, windowed.y); await page.waitForTimeout(200);
    for (let i = 0; i < 3; i++) { await page.mouse.click(1440 * (.3 + i * .2), 900 * .5); await page.waitForTimeout(150); }
    await page.mouse.click(1440 * .92, 900 * .3); const ordered = (await snap()).player.order?.type;
    assert.equal(await read('!!document.fullscreenElement'), false, 'clicks in the match do not return to full screen');
    assert(['move', 'attack'].includes(ordered), 'the clicks order the hero: ' + ordered);
    assert.equal(await read(`localStorage.getItem('tidebreak.fullscreen')`), 'off', 'the windowed choice is saved');
    pass('leaving full screen offers windowed play and keeps it');

    // Chrome's hold-Esc order: the menu is already open when full screen ends; the open menu then offers the choice.
    await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {})); await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    assert.equal(await read(`!!document.getElementById('resume') && !document.getElementById('fullscreen-back')`), true, 'the normal menu is open first');
    await read('document.exitFullscreen()'); await page.waitForTimeout(300);
    assert.equal(await read(`!!document.getElementById('fullscreen-back')`), true, 'the open menu now offers Back to full screen');
    // Closing that menu with Esc, without a choice, still never forces full screen back.
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    for (let i = 0; i < 3; i++) { await page.mouse.click(1440 * (.3 + i * .2), 900 * .5); await page.waitForTimeout(150); }
    assert.equal(await read('!!document.fullscreenElement'), false, 'clicks after closing the menu with Esc do not return to full screen');
    pass('a full-screen exit with the menu open offers the choice, and Esc never forces full screen back');
    assert.deepEqual(t.errors, []); await page.close();
  }

  /* ---------------- motion at a simulated 144 Hz ---------------- */
  {
    // requestAnimationFrame runs from a manual pump, so frames can be fed at exact 144 Hz intervals.
    const VIRTUAL_RAF = () => {
      const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true;
      window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
      window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
      const tick = () => { if (window.__auto) window.__pump(performance.now()); real(tick); }; real(tick);
    };
    const t = await open(1280, 720, { init: [VIRTUAL_RAF] });
    await toMatch(t);
    // Each window starts the hero at the same open spot and walks it right for one second (about 500 units, short of
    // the first obstacle), after a quarter second for the camera to settle. A hero that does not move fails the check.
    await t.page.keyboard.down('d');
    const measure = hz => t.read(`(async () => {
      const m = await import('/tidebreak/main.js'), s = m.qaState(), p = s.units.find(u => u.player);
      window.__spawn ||= { x: p.x, y: p.y }; Object.assign(p, { x: window.__spawn.x, y: window.__spawn.y, px: undefined, py: undefined, order: null });
      window.__auto = false; let ts = performance.now(); const xs = [];
      for (let i = 0; i < ${Math.round(hz / 4)}; i++) { ts += 1000 / ${hz}; window.__pump(ts); }
      const from = p.x;
      for (let i = 0; i < ${hz}; i++) { ts += 1000 / ${hz}; window.__pump(ts); xs.push(m.snapshot().graphics.heroScreen.x); }
      window.__auto = true; return { xs, moved: p.x - from }; })()`);
    const jitter = xs => { const d = xs.slice(1).map((x, i) => x - xs[i]), hp = d.map((v, i) => { const w = d.slice(Math.max(0, i - 4), i + 5); return v - w.reduce((a, b) => a + b, 0) / w.length; }); return Math.sqrt(hp.reduce((a, v) => a + v * v, 0) / hp.length); };
    const result = {};
    for (const hz of [144, 75, 60]) {
      const { xs, moved } = await measure(hz);
      assert(moved > 250, `the hero walks during the ${hz} Hz window: ${moved} units`);
      result[hz] = +jitter(xs).toFixed(3);
      assert(result[hz] < .3, `the hero moves smoothly at ${hz} Hz: jitter ${result[hz]} px`);
    }
    await t.page.keyboard.up('d');
    pass('the hero moves smoothly at 144, 75 and 60 Hz', result);
    assert.deepEqual(t.errors, []); await t.page.close();
  }

  /* ---------------- a phone with sound saved off ---------------- */
  {
    const t = await open(390, 844, { touch: true, init: [() => localStorage.setItem('tidebreak.sound', 'off')] });
    await toMatch(t);
    // The header ignores pointer events, so compare boxes: no shown top-left control may overlap the score.
    const overlaps = await t.read(`(() => { const s = document.querySelector('.score').getBoundingClientRect(); return [...document.querySelectorAll('.hud-corner > *')].filter(e => getComputedStyle(e).display !== 'none').map(e => [e.id, e.getBoundingClientRect()]).filter(([, r]) => r.right > s.left && r.left < s.right && r.bottom > s.top && r.top < s.bottom).map(([id]) => id); })()`);
    assert.deepEqual(overlaps, [], 'nothing in the top left covers the score on a phone');
    assert.equal(await t.read(`document.getElementById('hud-sound').getAttribute('aria-pressed')`), 'false', 'the speaker shows the saved mute');
    pass('touch play retains its opening spellbook and controls; the score and saved mute stay visible');
    assert.deepEqual(t.errors, []); await t.page.close();
  }

  /* ---------------- ultra-wide pixel budget and the performance readout ---------------- */
  {
    const t = await open(3440, 1440, { query: '?perf' });
    await toMatch(t); await t.page.waitForTimeout(1500);
    const size = await t.read(`(() => { const c = document.getElementById('battle'); return c.width * c.height; })()`);
    assert(size <= 2560 * 1440 * 1.01, 'an ultra-wide canvas stays inside the pixel budget: ' + size);
    const readout = await t.read(`document.getElementById('perf').hidden ? '' : document.querySelector('#perf pre').textContent`);
    assert.match(readout, /frame .* ms median/); assert.match(readout, /canvas \d+x\d+/);
    const zeroSteps = +readout.match(/steps\/frame (\d+)/)[1];
    assert(zeroSteps < 50, 'the readout counts match frames only (frames without a step: ' + zeroSteps + '%)');
    pass('an ultra-wide screen stays inside the pixel budget, and ?perf shows the frame timing', { pixels: size });
    assert.deepEqual(t.errors, []); await t.page.close();
  }
  console.log(`${results.length} checks passed`);
} finally { await browser.close(); }

