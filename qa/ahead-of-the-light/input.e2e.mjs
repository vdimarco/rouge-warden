// Ahead of the Light's controls in a browser (final.md 15, 22.1). Touch at 390 × 844 and 844 × 390, keys and the
// mouse at 1440 × 900: the drag's gain curve (real CDP touch: a slow 40 px drag gives about 24°, a fast one more), a
// re-grip keeps the target, two fingers never double the gain, a flick up burns one cell and never steers (alone and
// mid-drag), a press in a grab window grabs on the press, a drag of 20 px in the latch cancels it, a re-grip inside an
// open window ends as a free latch cancel and never a whip, pause, blur and a hidden page keep a held whip held and go
// on with HOLD TO GO ON, a second pointer grabs in landscape, Space holds a whip and ↑ burns, and a mouse with no
// button down never steers. It also counts accidental grabs in the toy (a grab followed by a latch cancel or a WIDE
// release within 0.6 s). Flicks and latch drags are dispatched inside the page with set gaps, since CDP touch moves
// arrive 80 to 100 ms apart under SwiftShader (too slow for a flick); drags, re-grips and two fingers use real CDP
// touch. The grab windows come from the toy (?toy=30), steered toward Coma by the hook, played in real time.
//   NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/input.e2e.mjs      (the site served on 8765)
import { launch, open, reporter, sizeList, S, R, wait, waitMode, holdKey } from './e2e-lib.mjs';

const rep = reporter('Ahead of the Light: input');
const { check } = rep;

// Helpers that run in the page: pointer events, a busy wait, frames, and the toy steered to Coma's grab window.
function install(page) {
  return R(page, () => {
    const P = (type, id, x, y, kind = 'touch', button = 0) => window.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: kind, clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1,
      button, buttons: type === 'pointerup' ? 0 : 1 }));
    const busy = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const frames = async (n) => { for (let i = 0; i < n; i++) await frame(); };
    const st = () => window.__race.state();
    const mine = (since) => window.__race.events(800).filter((e) => (e.ship === 'you' || e.by === 'you') && e.t >= since);
    // a toy run steered to `target` from 9 s, waiting until a grab window is open and in reach. → the toy's time
    async function toWindow(seed, target = 40, before = null) {
      window.__race.toy(seed);
      window.__race.input({ target: null });
      while (st().t < 9) { if (st().mode !== 'toy') return null; await frame(); }
      window.__race.input({ target });
      if (before) before();
      while (!st().you.inWindow) { if (st().t > 15 || st().mode !== 'toy') return null; await frame(); }
      return st().t;
    }
    window.__qa = { P, busy, frame, frames, st, mine, toWindow };
  });
}

// Real CDP touch: a drag of `pts` frames, each [ [x, y], ... ] for the fingers down, gap ms apart.
async function cdpTouch(cdp, frames, gap = 30) {
  const tp = (f) => f.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(frames[0]) });
  for (let i = 1; i < frames.length; i++) {
    await wait(gap);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(frames[i]) });
  }
  await wait(gap);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const line = (x, y, dx, n, fingers = 1, spread = 60) => Array.from({ length: n + 1 }, (_, k) =>
  Array.from({ length: fingers }, (_, f) => [x + f * spread + (dx * k) / n, y]));
// the degrees of drag the input has turned into the aim so far (bumps and shoves in the toy move the ship's target too)
const target = async (page) => (await S(page)).input.counts.aim;
const settle = (page, n = 4) => R(page, (n) => window.__qa.frames(n), n);

async function touchChecks(page, size, W, H) {
  const cdp = await page.context().newCDPSession(page);
  const y = H * 0.78, x = size === 'landscape' ? 120 : W / 2 - 60;
  // the toy: steering from its first second, 2 fuel cells
  await R(page, () => { window.__race.toy(1); window.__race.input({ target: null }); });
  await settle(page, 6);

  let t0 = await target(page);
  await cdpTouch(cdp, line(x, y, 40, 10), 40);
  await settle(page);
  let d = (await target(page)) - t0;
  check(`${size}: a slow 40 px drag (real touch) turns the aim about 24°`, d > 19 && d < 29, `${d.toFixed(1)}°`);

  t0 = await target(page);
  await R(page, ({ x, y }) => { const q = window.__qa; q.P('pointerdown', 3, x, y); for (let i = 1; i <= 5; i++) { q.busy(5); q.P('pointermove', 3, x + 8 * i, y); } q.busy(5); q.P('pointerup', 3, x + 40, y); }, { x, y });
  await settle(page);
  const fast = (await target(page)) - t0;
  check(`${size}: a fast 40 px drag turns it further (the gain curve)`, fast > d + 6, `${fast.toFixed(1)}° against ${d.toFixed(1)}°`);

  t0 = await target(page);
  await cdpTouch(cdp, [[[x, y]], [[x, y]], [[x, y]]], 40);
  await settle(page);
  d = (await target(page)) - t0;
  check(`${size}: a re-grip (thumb lifted and put down again) keeps the target`, Math.abs(d) < 0.5, `${d.toFixed(2)}°`);

  t0 = await target(page);
  await cdpTouch(cdp, line(x, y, 40, 10, 2, size === 'landscape' ? 520 : 90), 40);
  await settle(page);
  d = (await target(page)) - t0;
  check(`${size}: two fingers dragging 40 px together do not double the gain`, d > 15 && d < 31, `${d.toFixed(1)}°`);

  // a flick alone: one cell, no steering
  let before = await R(page, () => ({ fuel: window.__race.state().you.fuel, t: window.__race.state().t, aim: window.__race.state().input.counts.aim }));
  await R(page, ({ x, y }) => { const q = window.__qa; q.P('pointerdown', 4, x, y); for (let i = 1; i <= 6; i++) { q.busy(8); q.P('pointermove', 4, x + 2 * i, y - 12 * i); } q.busy(8); q.P('pointerup', 4, x + 12, y - 72); }, { x, y });
  await settle(page, 6);
  let after = await R(page, (t) => ({ fuel: window.__race.state().you.fuel, aim: window.__race.state().input.counts.aim,
    burns: window.__qa.mine(t).filter((e) => e.type === 'burn').length }), before.t);
  check(`${size}: a flick up burns one cell and does not steer`, after.burns === 1 && Math.abs(after.aim - before.aim) < 2,
    `${after.burns} burns, fuel ${before.fuel} → ${after.fuel}, aim moved ${(after.aim - before.aim).toFixed(1)}°`);

  // a flick mid-drag: the sideways drag steers, the flick's own swipe does not
  before = await R(page, () => ({ t: window.__race.state().t, aim: window.__race.state().input.counts.aim, fuel: window.__race.state().you.fuel }));
  await R(page, ({ x, y }) => { const q = window.__qa; q.P('pointerdown', 5, x, y); for (let i = 1; i <= 5; i++) { q.busy(30); q.P('pointermove', 5, x + 6 * i, y); } for (let i = 1; i <= 6; i++) { q.busy(8); q.P('pointermove', 5, x + 30 + 3 * i, y - 12 * i); } q.busy(8); q.P('pointerup', 5, x + 48, y - 72); }, { x, y });
  await settle(page, 8);
  after = await R(page, (t) => ({ aim: window.__race.state().input.counts.aim, fuel: window.__race.state().you.fuel,
    burns: window.__qa.mine(t).filter((e) => e.type === 'burn').length }), before.t);
  const md = after.aim - before.aim;
  check(`${size}: a flick mid-drag burns, and only the drag before it steers`, after.burns === 1 && md > 10 && md < 26,
    `${after.burns} burns (fuel ${before.fuel} → ${after.fuel}), aim moved ${md.toFixed(1)}° for a 30 px drag`);
  await cdp.detach();
}

// The grab-window checks, on touch: grab on the press, the latch cancel, the re-grip in a window, HOLD TO GO ON.
async function windowChecks(page, size, W, H) {
  const x = size === 'landscape' ? 700 : W / 2, y = H * 0.8;
  let r = await R(page, async ({ x, y }) => {
    const q = window.__qa;
    const t = await q.toWindow(2);
    if (t === null) return null;
    q.P('pointerdown', 9, x, y);
    const pressAt = q.st().t;
    await q.frames(2);
    const grab = q.mine(t).find((e) => e.type === 'grab');
    await new Promise((res) => setTimeout(res, 450));
    const whip = q.st().you.whip;
    q.P('pointerup', 9, x, y);
    await q.frames(4);
    const rel = q.mine(t).find((e) => e.type === 'release' || e.type === 'latchCancel');
    return { grab: grab ? grab.t - pressAt : null, whip, rel: rel ? `${rel.type} ${rel.grade || ''}` : null };
  }, { x, y });
  check(`${size}: a press in an open grab window grabs on the press, a hold whips, a lift flings`,
    r && r.grab !== null && r.grab < 0.06 && r.whip && /release/.test(r.rel || ''), JSON.stringify(r));

  r = await R(page, async ({ x, y }) => {
    const q = window.__qa;
    const t = await q.toWindow(3);
    if (t === null) return null;
    q.P('pointerdown', 10, x, y);
    q.busy(20);
    for (let i = 1; i <= 5; i++) { q.busy(10); q.P('pointermove', 10, x + 5 * i, y); }
    await q.frames(6);
    const ev = q.mine(t).map((e) => e.type).filter((k) => /grab|latchCancel|release/.test(k));
    q.P('pointerup', 10, x + 25, y);
    await q.frames(3);
    return { ev, whip: q.st().you.whip };
  }, { x, y });
  check(`${size}: a 25 px drag inside the latch cancels the grab at no cost`, r && r.ev.includes('latchCancel') && !r.ev.includes('release') && !r.whip, JSON.stringify(r));

  // the critic's re-grip: one thumb steering lifts and presses again inside the window, then drags 30 px in 150 ms
  r = await R(page, async ({ x, y }) => {
    const q = window.__qa;
    const t = await q.toWindow(4, 40, () => { q.P('pointerdown', 6, x, y); });
    if (t === null) return null;
    q.P('pointerup', 6, x, y);
    q.busy(15);
    q.P('pointerdown', 6, x, y);
    q.busy(25);
    for (let i = 1; i <= 5; i++) { q.busy(20); q.P('pointermove', 6, x + 6 * i, y); }
    await q.frames(8);
    q.P('pointerup', 6, x + 30, y);
    await q.frames(8);
    const ev = q.mine(t).map((e) => e.type).filter((k) => /grab|latchCancel|release/.test(k));
    return { ev, whip: q.st().you.whip };
  }, { x, y });
  check(`${size}: a re-grip inside an open window that drags 30 px within 150 ms ends as a free latch cancel, never a whip`,
    r && r.ev.includes('latchCancel') && !r.ev.includes('release'), JSON.stringify(r));

  // HOLD TO GO ON after a blur and after a hidden page; a pause by the button keeps the thumb's hold
  for (const how of ['blur', 'hidden', 'button', 'button-lift']) {
    r = await R(page, async ({ x, y, how }) => {
      const q = window.__qa;
      const t = await q.toWindow(5);
      if (t === null) return null;
      q.P('pointerdown', 11, x, y);
      await new Promise((res) => setTimeout(res, 250));
      const whip0 = q.st().you.whip;
      if (how === 'blur') window.dispatchEvent(new Event('blur'));
      else if (how === 'hidden') {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      } else document.getElementById('pause').click();
      await q.frames(2);
      const paused = q.st().paused;
      // the whip thumb lifts while the game is paused (to tap RESUME): play goes on only with a fresh press
      if (how === 'button-lift') q.P('pointerup', 11, x, y);
      await new Promise((res) => setTimeout(res, 300));
      window.__race.resume();
      await q.frames(3);
      const s1 = q.st(), hint = document.getElementById('hint').textContent;
      if (how !== 'button') { q.P('pointerdown', 12, x, y); await q.frames(4); }
      const s2 = q.st();
      q.P('pointerup', 11, x, y); q.P('pointerup', 12, x, y);
      await q.frames(4);
      const rel = q.mine(t).filter((e) => e.type === 'release').length;
      return { whip0, paused, regrip: s1.regrip, hint, whip1: s1.you.whip, after: { regrip: s2.regrip, whip: s2.you.whip, holding: s2.input.holding }, rel };
    }, { x, y, how });
    const ok = how === 'button'
      ? r && r.whip0 && r.paused && !r.regrip && r.after.whip && r.after.holding && r.rel === 1
      : r && r.whip0 && r.paused && r.regrip && r.hint === 'HOLD TO GO ON' && r.whip1 && !r.after.regrip && r.after.whip && r.after.holding && r.rel === 1;
    const what = { blur: 'a blur keeps a held whip held and goes on with HOLD TO GO ON and a fresh press',
      hidden: 'a hidden page keeps a held whip held and goes on with HOLD TO GO ON and a fresh press',
      button: 'the pause button keeps a held whip held while the thumb stays down',
      'button-lift': 'the pause button mid-whip, the thumb lifted while paused: HOLD TO GO ON, and a fresh press goes on' }[how];
    check(`${size}: ${what}`, ok, JSON.stringify(r));
  }

  if (size === 'landscape') {
    r = await R(page, async () => {
      const q = window.__qa;
      const t = await q.toWindow(6, 40, () => { q.P('pointerdown', 21, 120, 300); });
      if (t === null) return null;
      for (let i = 1; i <= 3; i++) { q.busy(25); q.P('pointermove', 21, 120 + 4 * i, 300); }
      q.P('pointerdown', 22, 720, 300);
      await q.frames(3);
      const aim0 = q.st().input.counts.aim;
      for (let i = 1; i <= 6; i++) { q.busy(25); q.P('pointermove', 21, 132 - 5 * i, 300); }
      await q.frames(4);
      const aim1 = q.st().input.counts.aim;
      const ev = q.mine(t).map((e) => e.type).filter((k) => /grab|release|latchCancel/.test(k));
      q.P('pointerup', 22, 720, 300); q.P('pointerup', 21, 102, 300);
      await q.frames(3);
      return { ev, steer: aim1 - aim0 };
    });
    check(`${size}: a second thumb grabs in the window while the first still steers`, r && r.ev[0] === 'grab' && r.steer < -8, JSON.stringify(r));
  }
}

// Accidental grabs in the toy (critic risk 8): the mid bot on 10 seeds.
async function accidental(page) {
  return R(page, () => {
    let grabs = 0, bad = 0;
    for (let seed = 1; seed <= 10; seed++) {
      window.__race.toy(seed);
      window.__race.bot('mid');
      window.__race.advance(30);
      const ev = window.__race.events(3000).filter((e) => e.ship === 'you');
      ev.forEach((e, i) => {
        if (e.type !== 'grab') return;
        grabs++;
        const next = ev.slice(i + 1).find((x) => x.type === 'latchCancel' || x.type === 'release');
        if (next && next.t - e.t <= 0.6 && (next.type === 'latchCancel' || next.grade === 'WIDE')) bad++;
      });
    }
    window.__race.bot(null);
    return { grabs, bad };
  });
}

async function deskChecks(page, size) {
  await R(page, () => { window.__race.toy(1); window.__race.input({ target: null }); });
  await settle(page, 6);
  // the mouse: moving with no button never steers; a held left button and a drag does
  let t0 = await target(page);
  await page.mouse.move(500, 700);
  for (let i = 1; i <= 10; i++) await page.mouse.move(500 + 30 * i, 700 - 5 * i);
  await settle(page);
  let d = (await target(page)) - t0;
  check(`${size}: a mouse moving with no button down never steers`, Math.abs(d) < 0.01, `${d.toFixed(2)}°`);
  t0 = await target(page);
  await page.mouse.move(700, 700);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(700 + 6 * i, 700); await wait(30); }
  await page.mouse.up();
  await settle(page);
  d = (await target(page)) - t0;
  check(`${size}: the left button held and a 60 px drag steers`, d > 25, `${d.toFixed(1)}°`);
  // ↑ burns a cell
  const before = await R(page, () => ({ t: window.__race.state().t, fuel: window.__race.state().you.fuel }));
  await holdKey(page, 'ArrowUp', 60);
  await settle(page, 6);
  const burns = await R(page, (t) => window.__qa.mine(t).filter((e) => e.type === 'burn').length, before.t);
  check(`${size}: ↑ burns one cell`, burns === 1, `${burns} burns, fuel ${before.fuel} → ${(await S(page)).you.fuel}`);
  // ← → turn
  t0 = (await S(page)).you.bearing;
  await holdKey(page, 'ArrowRight', 300);
  await settle(page);
  d = (await S(page)).you.bearing - t0;
  check(`${size}: → turns the ship (330°/s with a ramp)`, d > 40 && d < 120, `${d.toFixed(1)}° in 0.3 s`);
  // Space holds a whip, its release flings
  let r = await R(page, async () => {
    const q = window.__qa;
    const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    const t = await q.toWindow(2);
    if (t === null) return null;
    key('keydown');
    await new Promise((res) => setTimeout(res, 450));
    const whip = q.st().you.whip;
    key('keyup');
    await q.frames(4);
    return { ev: q.mine(t).map((e) => e.type).filter((k) => /grab|release|latchCancel/.test(k)), whip };
  });
  check(`${size}: Space in a window grabs and holds a whip, and its release flings`, r && r.ev[0] === 'grab' && r.whip && r.ev.includes('release'), JSON.stringify(r));
  // a blur mid-whip: HOLD SPACE TO GO ON
  r = await R(page, async () => {
    const q = window.__qa;
    const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
    const t = await q.toWindow(5);
    if (t === null) return null;
    key('keydown');
    await new Promise((res) => setTimeout(res, 250));
    window.dispatchEvent(new Event('blur'));
    await q.frames(2);
    window.__race.resume();
    await q.frames(2);
    const s1 = q.st(), hint = document.getElementById('hint').textContent;
    key('keyup'); key('keydown');
    await q.frames(4);
    const s2 = q.st();
    key('keyup');
    await q.frames(4);
    return { regrip: s1.regrip, hint, whip: s1.you.whip, after: { regrip: s2.regrip, whip: s2.you.whip }, rel: q.mine(t).filter((e) => e.type === 'release').length };
  });
  check(`${size}: a blur mid-whip goes on with HOLD SPACE TO GO ON`, r && r.regrip && r.hint === 'HOLD SPACE TO GO ON' && r.whip && !r.after.regrip && r.after.whip && r.rel === 1, JSON.stringify(r));
}

const browser = await launch();
for (const size of sizeList()) {
  rep.section(size);
  const { page, errors, W, H, ctx } = await open(browser, size, '?toy=30');
  await install(page);
  if (size === 'desktop') await page.keyboard.press('Space'); else await page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(page, 'toy', 5000).catch(() => {});
  if (size === 'desktop') await deskChecks(page, size);
  else { await touchChecks(page, size, W, H); await windowChecks(page, size, W, H); }
  if (size === 'portrait') {
    const a = await accidental(page);
    check(`portrait: accidental grabs in the toy (mid bot, seeds 1 to 10): ${a.bad} of ${a.grabs}, at most 1 in 10`,
      a.grabs > 0 && a.bad * 10 <= a.grabs, `${a.bad} of ${a.grabs}`);
  }
  check(`${size}: no page errors, console errors or failed requests`, errors.length === 0, errors.slice(0, 6).join(' | '));
  await ctx.close();
}
await browser.close();
rep.done();
