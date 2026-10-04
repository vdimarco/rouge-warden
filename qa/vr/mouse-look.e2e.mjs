// Flat play's mouse look and the pointer lock (desktop, 960x540). The browser's pointer lock and full screen are played by
// a stub, so every flow can be driven (a headless browser has no real cursor to catch at an edge): PLAY asks for the lock
// (raw mouse first, a plain lock when the system has none) before full screen, and on a Mac takes it again once full screen
// is on (elsewhere the click's lock stays);
// a locked mouse turns the view; Esc pauses (also when the key reaches the page with the browser's own unlock) and the
// RESUME click takes the lock inside the click; a lock refused just after Esc is asked for again a moment later; with no
// lock the free cursor turns the view, resting it at an edge keeps turning, and a prompt says how to get the lock back; a
// click with no lock takes it and fires no rope, and Chromium's made-up jump turns nothing even when it comes before the
// lock; a browser that keeps refusing gets its ropes back. Run from the repo root.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(840000, 'mouse look');
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const W = 960, H = 540, SENS = 0.0022, EDGE_YAW = 2.2, EDGE_PITCH = 1.2;
const page = await newPage({ width: W, height: H });
page.setDefaultTimeout(180000);
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
  // mode: 'grant', 'noraw' (no raw mouse on this system: unadjustedMovement is refused with NotSupportedError) or 'refuse'.
  // cooldown: refuse for 1.25 s after the user's own Esc, as Chrome does. Answers come a few ms later, as from a browser.
  // plat: the system (only a Mac lets go of the lock and takes it again once full screen is on)
  const S = window.__pl = { mode: 'grant', cooldown: false, fsDelay: 300, plat: 'MacIntel', log: [], el: null, fs: null, userExitAt: -1e9 };
  Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => S.plat });
  const later = (f, ms = 5) => setTimeout(f, ms);
  const fire = (name) => document.dispatchEvent(new Event(name));
  Element.prototype.requestPointerLock = function (opts) {
    const raw = !!(opts && opts.unadjustedMovement), el = this;
    S.log.push(raw ? 'lock:raw' : 'lock');
    const no = (name) => new Promise((res, rej) => later(() => { fire('pointerlockerror'); rej(new DOMException('no pointer lock (stub)', name)); }));
    if (S.mode === 'noraw' && raw) return no('NotSupportedError');
    if (S.mode === 'refuse' || (S.cooldown && performance.now() - S.userExitAt < 1250)) return no('NotAllowedError');
    // jumpFirst: Chromium's made-up jump (the cursor at 0, 0) comes before the lock's own event, as a headless run showed
    if (S.jumpFirst) later(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 0, clientY: 0, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mousemove', { movementX: -480, movementY: -270, clientX: 0, clientY: 0 }));
    }, 1);
    return new Promise((res) => later(() => { S.el = el; fire('pointerlockchange'); res(); }));
  };
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => S.el });
  Document.prototype.exitPointerLock = function () { S.log.push('exit'); if (S.el) later(() => { S.el = null; fire('pointerlockchange'); }); };
  Element.prototype.requestFullscreen = function () {
    S.log.push('fs'); const el = this;
    // the change animates (macOS: most of a second) and here it ends once the lock is taken (or after 30 looks with none),
    // so the lock taken during the change and taken again after it always shows, however slow the click's own work is
    const end = (n) => { if (S.el || n >= 30) { S.fs = el; fire('fullscreenchange'); } else later(() => end(n + 1), 20); };
    later(() => end(0), S.fsDelay);
    return Promise.resolve();
  };
  Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => S.fs });
  Document.prototype.exitFullscreen = function () { if (S.fs) later(() => { S.fs = null; fire('fullscreenchange'); }); return Promise.resolve(); };
  // the user's Esc as Chrome does it: the browser lets go of the lock and of full screen
  S.userEsc = () => { S.userExitAt = performance.now(); if (S.el) later(() => { S.el = null; fire('pointerlockchange'); }); if (S.fs) later(() => { S.fs = null; fire('fullscreenchange'); }); };
});

const pl = () => page.evaluate(() => ({ log: window.__pl.log.slice(), locked: G.desktop.locked, el: !!window.__pl.el, fs: !!window.__pl.fs, state: G.state, hint: !document.querySelector('#lookHint').hidden, menu: !!document.querySelector('#fsMenu')?.open }));
// n frames of the held loop; the yaw and the pitch after each
const frames = (n) => page.evaluate((n) => { const r = []; for (let i = 0; i < n; i++) { G.test.step(1 / 60, 1); r.push({ yaw: G.rigYaw, pitch: G.test.flat().pitch }); } return r; }, n);
const view = async () => (await frames(1))[0];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deltas = (r, k, from) => r.map((v, i) => wrap(v[k] - (i ? r[i - 1][k] : from[k])));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const triggers = (f0) => page.evaluate((f0) => G.test.events().filter((e) => e.type === 'input' && e.edge === 'triggerDown' && e.frame > f0).length, f0);
const frame = () => page.evaluate(() => G.frame);
const settle = (ms = 400) => page.waitForTimeout(ms);
// pause with the browser's own Esc: the lock goes, and (key) the Esc key reaches the page right after the unlock
async function userEsc(key) {
  await page.evaluate((key) => {
    if (key) document.addEventListener('pointerlockchange', () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })), { once: true });
    window.__pl.userEsc();
  }, key);
  await page.waitForFunction(() => !G.desktop.locked);
  await frames(3);
}

try {
  await open(page, '?nosw&skipintro'); await page.waitForFunction(() => G.viewDone);

  /* ---------------- (b) PLAY: the lock before full screen, raw mouse with a fallback, the lock again after full screen ---------------- */
  await page.evaluate(() => { window.__pl.mode = 'noraw'; });
  await page.locator('#playFlat').click({ noWaitAfter: true });
  await page.waitForFunction(() => G.state === 'play' && window.__pl.fs && window.__pl.log.includes('exit') && G.desktop.locked && window.__pl.el);
  await settle();
  let s = await pl();
  const ex = s.log.indexOf('exit');
  assert(s.log[0] === 'lock:raw' && s.log[1] === 'fs', 'PLAY asks for the pointer lock, with raw mouse, before full screen: ' + s.log.join());
  assert(s.log[2] === 'lock', 'the system has no raw mouse (NotSupportedError): a plain lock follows: ' + s.log.join());
  assert(ex > 2 && s.log.slice(ex + 1).includes('lock') && s.locked && s.state === 'play' && !s.menu, 'on a Mac, once full screen is on, the game lets go of the lock and takes it straight back, and play goes on: ' + JSON.stringify(s));
  assert(!s.log.slice(1).includes('lock:raw'), 'after NotSupportedError it asks plainly: ' + s.log.join());
  assert(!s.hint, 'no prompt while the lock holds');
  console.log('PASS (b) PLAY: lock (raw, then plain) before full screen, and the lock again after the full-screen change', s.log.join(' '));
  await page.evaluate(() => { window.__pl.mode = 'grant'; G.test.hold(true); });

  /* ---------------- (a) locked: the mouse turns the view ---------------- */
  await page.mouse.move(W / 2, H / 2); await frames(1);
  let v0 = await view();
  await page.mouse.move(W / 2 + 100, H / 2 - 60);
  let v1 = await view();
  assert(near(wrap(v1.yaw - v0.yaw), -100 * SENS, 0.02) && near(v1.pitch - v0.pitch, 60 * SENS, 0.02), 'locked: 100 px right and 60 px up turn the view right and up: ' + JSON.stringify({ dyaw: wrap(v1.yaw - v0.yaw), dpitch: v1.pitch - v0.pitch }));
  console.log('PASS (a) locked: the mouse turns the view', JSON.stringify({ dyaw: +wrap(v1.yaw - v0.yaw).toFixed(4), dpitch: +(v1.pitch - v0.pitch).toFixed(4) }));
  await page.screenshot({ path: out + '/mouse-locked.png' });

  /* ---------------- (e) Esc pauses; RESUME takes the lock inside its click ---------------- */
  // the first time on a Mac (the lock is taken again once full screen is on), the second on Windows (the click's lock stays)
  for (const key of [true, false]) {
    await userEsc(key);
    s = await pl();
    assert(s.state === 'paused' && s.menu && !s.hint, 'the browser\'s Esc pauses' + (key ? ', and the same Esc reaching the page does not close the menu again: ' : ': ') + JSON.stringify(s));
    await page.evaluate((mac) => { window.__pl.plat = mac ? 'MacIntel' : 'Win32'; }, key);
    const n = s.log.length;
    await page.click('#fsMenu button[data-id=resume]');
    const inClick = (await pl()).log.slice(n);
    await frames(2);
    await page.waitForFunction(() => G.desktop.locked && window.__pl.fs);
    await settle(); await frames(1);
    s = await pl();
    const after = s.log.slice(n);
    assert(inClick[0] === 'lock' && inClick.includes('fs') && s.state === 'play' && s.locked && !s.menu && !s.hint, 'RESUME asks for the lock (then full screen) inside its click, and play goes on locked: ' + JSON.stringify({ inClick, s }));
    assert(after.includes('exit') === key, (key ? 'on a Mac the lock is taken again once full screen is on: ' : 'elsewhere the lock taken in the click is kept: ') + after.join(' '));
    console.log('PASS (e) the browser\'s Esc pauses' + (key ? ' (the key also reaches the page)' : '') + '; RESUME takes the lock in its click' + (key ? ' (Mac: taken again after full screen)' : ' (Windows: kept)'), after.join(' '));
  }
  await page.evaluate(() => { window.__pl.plat = 'MacIntel'; });
  // the game's own Esc (a browser that sends the key and keeps the lock): the menu opens and the game lets go of the lock
  {
    const n = (await pl()).log.length;
    await page.keyboard.press('Escape'); await frames(2);
    await page.waitForFunction(() => !G.desktop.locked);
    s = await pl();
    assert(s.state === 'paused' && s.menu && s.log.slice(n).includes('exit'), 'Esc that reaches the page opens the menu and lets go of the lock: ' + JSON.stringify(s));
    const pad = await page.evaluate(() => { const r = document.querySelector('#fsMenu').getBoundingClientRect(); return { x: r.left + 6, y: r.top + 6 }; });
    await page.mouse.click(pad.x, pad.y);
    await frames(2); await page.waitForFunction(() => G.desktop.locked); await frames(1);
    s = await pl();
    assert(s.state === 'play' && s.locked, 'a click beside the menu goes back to play and takes the lock: ' + JSON.stringify(s));
    console.log('PASS (e) the game\'s own Esc pauses and lets go; a click beside the menu resumes locked');
  }

  /* ---------------- Chrome refuses a lock for a moment after Esc: the game asks again when that is over ---------------- */
  await page.evaluate(() => { window.__pl.cooldown = true; });
  {
    // Esc, the pause, and RESUME at once (inside the 1.25 s), all in the page so the timing holds on a slow machine
    const r = await page.evaluate(async () => {
      window.__pl.userEsc();
      await new Promise((res) => setTimeout(res, 40));
      G.test.step(1 / 60, 2);
      const paused = G.state === 'paused';
      document.querySelector('#fsMenu button[data-id=resume]').click();
      await new Promise((res) => setTimeout(res, 60));
      G.test.step(1 / 60, 2);
      await new Promise((res) => setTimeout(res, 40)); // the resume frame asks once more (refused too)
      G.test.step(1 / 60, 1);
      return { paused, state: G.state, locked: G.desktop.locked, hint: !document.querySelector('#lookHint').hidden, t: performance.now() - window.__pl.userExitAt };
    });
    assert(r.paused && r.state === 'play' && !r.locked && r.t < 1250, 'RESUME right after Esc: play goes on, the lock is refused for now: ' + JSON.stringify(r));
    assert(r.hint, 'with no lock a prompt says how to get the mouse look back');
    await page.waitForFunction(() => G.desktop.locked, null, { timeout: 5000 });
    await settle(); await frames(1); // full screen comes on once the lock holds, and the lock is taken again
    s = await pl();
    assert(s.locked && !s.hint && s.state === 'play', 'a moment later the game asks again with no click, and the lock holds: ' + JSON.stringify(s));
    console.log('PASS a lock refused just after Esc (Chrome) is taken again a moment later, with the prompt meanwhile');
  }
  await page.evaluate(() => { window.__pl.cooldown = false; });

  /* ---------------- (c) no lock: the free cursor turns the view, and an edge keeps turning ---------------- */
  await page.evaluate(() => { window.__pl.mode = 'refuse'; });
  await userEsc(false);
  await page.click('#fsMenu button[data-id=resume]');
  await frames(2); await settle(2000); await frames(1); // past the retry after Esc and the ask after full screen (both refused)
  s = await pl();
  assert(s.state === 'play' && !s.locked && s.hint, 'a refused lock: play goes on with the free cursor and the prompt: ' + JSON.stringify(s));
  await page.mouse.move(W / 2, H / 2); await frames(1); // the first move over the page only places the cursor
  v0 = await view();
  await page.mouse.move(W / 2 - 100, H / 2 + 50);
  v1 = await view();
  assert(near(wrap(v1.yaw - v0.yaw), 100 * SENS, 0.02) && near(v1.pitch - v0.pitch, -50 * SENS, 0.02), 'unlocked: moving the cursor 100 px left and 50 px down turns the view left and down: ' + JSON.stringify({ dyaw: wrap(v1.yaw - v0.yaw), dpitch: v1.pitch - v0.pitch }));
  // the right edge: the view keeps turning right every frame, at a steady rate, with the mouse still
  await page.mouse.move(W - 1, H / 2); await frames(1);
  v0 = await view();
  let r = await frames(10);
  let d = deltas(r, 'yaw', v0), want = (-EDGE_YAW) / 60;
  assert(d.every((x) => near(x, want, Math.abs(want) * 0.15)), 'the cursor resting at the right edge turns the view right every frame at a steady rate: ' + JSON.stringify(d.map((x) => +x.toFixed(4))));
  console.log('PASS (c) unlocked: the cursor turns the view, and the right edge keeps turning it', JSON.stringify({ perFrame: +d[0].toFixed(4), want: +want.toFixed(4) }));
  // the top edge tilts up
  await page.mouse.move(W / 2, H / 2); await frames(1);
  await page.mouse.move(W / 2, 0); await frames(1);
  v0 = await view();
  r = await frames(5);
  d = deltas(r, 'pitch', v0); want = EDGE_PITCH / 60;
  assert(d.every((x) => near(x, want, want * 0.2)), 'the cursor at the top edge tilts the view up every frame: ' + JSON.stringify(d.map((x) => +x.toFixed(4))));
  // away from the edges the view stays still; a cursor that left the window turns nothing
  await page.mouse.move(W / 2, H / 2); await frames(1);
  v0 = await view(); r = await frames(5);
  const still = Math.max(...deltas(r, 'yaw', v0).map(Math.abs), ...deltas(r, 'pitch', v0).map(Math.abs));
  await page.mouse.move(W - 1, H / 2); await frames(1);
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null })));
  v0 = await view(); r = await frames(5);
  const gone = Math.max(...deltas(r, 'yaw', v0).map(Math.abs));
  assert(still < 1e-4 && gone < 1e-4, 'the view keeps still with the cursor away from the edges, or out of the window: ' + JSON.stringify({ still, gone }));
  console.log('PASS (c) the top edge tilts up; the middle and a cursor outside the window turn nothing');
  await page.screenshot({ path: out + '/mouse-free-prompt.png' });

  /* ---------------- (d) a click with no lock takes it and fires no rope ---------------- */
  await page.evaluate(() => { window.__pl.mode = 'grant'; window.__pl.jumpFirst = true; });
  await page.mouse.move(W / 2, H / 2 + 120); await frames(1);
  let f0 = await frame(), n = (await pl()).log.length;
  v0 = await view();
  await page.mouse.click(W / 2, H / 2 + 120);
  await page.waitForFunction(() => G.desktop.locked); await frames(3);
  v1 = await view();
  s = await pl();
  let fired = await triggers(f0);
  const ropes = await page.evaluate(() => G.P.ropes.map((x) => x.state));
  assert(s.locked && s.log.slice(n).includes('lock') && fired === 0 && ropes.every((x) => x === 'idle') && !s.hint, 'a click with no lock takes the lock and fires no rope: ' + JSON.stringify({ s, fired, ropes }));
  // the made-up jump that came before the lock turned nothing, and the first real move after it counts
  await page.mouse.move(W / 2 + 60, H / 2 + 120);
  const v2 = await view();
  await page.evaluate(() => { window.__pl.jumpFirst = false; });
  assert(Math.abs(wrap(v1.yaw - v0.yaw)) < 1e-4 && Math.abs(v1.pitch - v0.pitch) < 1e-4 && near(wrap(v2.yaw - v1.yaw), -60 * SENS, 0.02), 'Chromium\'s jump before the lock turns nothing, and the first real move counts: ' + JSON.stringify({ jump: wrap(v1.yaw - v0.yaw), jumpPitch: v1.pitch - v0.pitch, first: wrap(v2.yaw - v1.yaw) }));
  // and now locked, a click does fire (the check above can see a rope)
  f0 = await frame();
  await page.mouse.down(); await frames(2); await page.mouse.up(); await frames(1);
  fired = await triggers(f0);
  assert(fired === 1, 'locked, a click fires the rope: ' + fired);
  await frames(3);
  console.log('PASS (d) a click with no lock takes it and fires no rope; locked, a click fires');

  /* ---------------- a browser that keeps refusing: the second refused click gives the clicks back to the ropes ---------------- */
  await page.evaluate(() => { window.__pl.mode = 'refuse'; });
  await userEsc(false);
  await page.click('#fsMenu button[data-id=resume]');
  await frames(2); await settle(2000); await frames(1);
  f0 = await frame();
  await page.mouse.click(W / 2, H / 2 + 120); await settle(150); await frames(2);
  const first = await triggers(f0);
  f0 = await frame(); n = (await pl()).log.length;
  await page.mouse.down(); await frames(2); await page.mouse.up(); await settle(150); await frames(1);
  const second = await triggers(f0), asked = (await pl()).log.slice(n).includes('lock');
  assert(first === 0 && second === 1 && asked, 'refused again: the next click fires its rope (and still asks for the lock): ' + JSON.stringify({ first, second, asked }));
  console.log('PASS a browser that keeps refusing the lock gets its clicks back for the ropes');

  /* ---------------- (f) ---------------- */
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log('PASS (f) no runtime errors');
} finally { await close(); }
