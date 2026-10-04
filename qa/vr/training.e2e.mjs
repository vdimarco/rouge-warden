// Flat play: the training checklist (rows that tick in any order, the next one lit, its line said), the pump sticker by the
// crosshair (F and a dot per pump) and the mission card. A desktop with a mouse first, then a phone in portrait, where the
// card would cover the view: a chip in the score row counts the rows done and the spoken line names the next. Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(900000, 'training');
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const quiet = () => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); };

// In the page: stepping, the training rows, the card, and a one-box building with a clear street face to climb
const HELPERS = () => {
  const C = G.city;
  const B = C.colliders.find((c) => {
    if (!(c.type === 'box' && c.tag === 'building' && c.minY === 0 && c.maxY > 25 && c.maxY < 90)) return false;
    if (C.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
    const z = (c.minZ + c.maxZ) / 2;
    for (let y = 0.5; y < c.maxY + 3; y += 1) if (C.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
    return !C.isWater(c.maxX + 1, z) && C.groundY(c.maxX + 1, z) < 0.5;
  });
  window.__t = {
    B,
    step: (n) => G.test.step(1 / 60, n),
    until(f, n) { for (let i = 0; i < n; i++) { if (f()) return i; G.test.step(1 / 60, 1); } return -1; },
    tr: () => G.game.progress.training,
    row: (id) => { const t = G.game.progress.training; return t && t.items.find((r) => r.id === id); },
    done: (id) => { const r = __t.row(id); return !!(r && r.done); },
    card: () => [...document.querySelectorAll('.fs-train li')].map((li) => ({ id: li.dataset.id, now: li.classList.contains('now'), done: li.classList.contains('done'), text: li.textContent })),
    said: () => document.querySelector('.fs-sub').textContent,
    key(code, on) { window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); },
    fire(side, x, y, z) { G.test.press(side, false); __t.step(1); G.test.aimAt(side, x, y, z); G.test.press(side, true); return __t.until(() => G.test.state().ropes[side].state === 'attached', 90); },
  };
  return !!B;
};

const page = await newPage({ width: 960, height: 540 });
page.setDefaultTimeout(240000);
await page.addInitScript(quiet);
try {
  await open(page, '?nosw&skipintro'); await page.waitForFunction(() => G.viewDone);
  await page.locator('#playFlat').click({ noWaitAfter: true }); await page.waitForFunction(() => G.state === 'play');
  await page.evaluate(() => G.test.hold(true));
  assert(await page.evaluate(HELPERS), 'a building to climb');
  const L = await page.evaluate(async () => (await import('./js/config.js')).LINES_DESKTOP.tutorial);

  /* ---------------- the card on a first run ---------------- */
  const c0 = await page.evaluate(() => { __t.step(3); const t = __t.tr(); return { n: t && t.items.length, now: t && t.now, kind: t && t.kind, tut: G.game.progress.tutorial, card: __t.card(), shown: !document.querySelector('.fs-train').hidden, said: __t.said() }; });
  assert(c0.n === 8 && c0.now === 0 && c0.kind === 'mouse' && c0.tut === 0 && c0.shown && c0.card.length === 8 && c0.card[0].now && !c0.card[1].now, 'a first run shows the training card with 8 rows, the gold ring first and lit: ' + JSON.stringify(c0));
  assert(/HOLD W/.test(c0.card[0].text) && /LEFT MOUSE/.test(c0.card[0].text) && /F/.test(c0.card[7].text), 'each row shows its keys: ' + JSON.stringify(c0.card.map((r) => r.text)));
  assert.equal(c0.said, L[0], 'the line said is the first tutorial line');
  console.log('PASS the training card: 8 rows, the next one lit, its keys and its line');
  await page.screenshot({ path: out + '/training-card.png' });

  /* ---------------- rows tick by real actions ---------------- */
  // the gold ring: a rope high on a wall
  const r1 = await page.evaluate(() => { const R = G.city.goldRing; const n = __t.fire(1, R.x, R.y, R.z); __t.step(2); return { n, done: __t.done('rope'), now: __t.tr().now, tut: G.game.progress.tutorial, said: __t.said(), card: __t.card()[0] }; });
  assert(r1.n >= 0 && r1.done && r1.now === 1 && r1.tut === 1 && r1.card.done && /✓/.test(r1.card.text), 'a rope high on a wall ticks the first row and lights the next: ' + JSON.stringify(r1));
  assert.equal(r1.said, L[1], 'the next row says its line');
  // let go at speed, then rope again in the air
  const r2 = await page.evaluate(() => {
    const n = __t.until(() => Math.hypot(G.P.vel.x, G.P.vel.y, G.P.vel.z) > 9, 300);
    G.test.press(1, false); G.test.aimAt(1, null); __t.step(2);
    const swing = __t.done('swing');
    const R = G.city.goldRing, m = __t.fire(0, R.x, R.y, R.z); __t.step(2);
    return { n, swing, m, air: !G.P.onGround, again: __t.done('again') };
  });
  assert(r2.swing && r2.again, 'letting go at speed ticks "let go", and a rope in the air ticks "swing again": ' + JSON.stringify(r2));
  // reel in, then yank
  const r3 = await page.evaluate(() => {
    G.test.grip(0, 1); const n = __t.until(() => __t.done('reel'), 300); G.test.grip(0, null);
    G.test.yank(0, 3); __t.step(3); G.test.yank(0, 0);
    G.test.press(0, false); G.test.aimAt(0, null); __t.step(2);
    return { n, reel: __t.done('reel'), yank: __t.done('yank') };
  });
  assert(r3.reel && r3.yank, 'holding Shift ticks "reel in" and F ticks "yank": ' + JSON.stringify(r3));
  // look around with the mouse (the lock is faked, as the mouse tests do)
  const r4 = await page.evaluate(() => {
    G.desktop.locked = true;
    for (let i = 0; i < 4; i++) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 150, movementY: 0 })); __t.step(1); }
    G.desktop.locked = false; __t.step(1);
    return { look: __t.done('look') };
  });
  assert(r4.look, 'turning with the mouse ticks "look around"');
  // climb a wall: fly into it and hold W
  const r5 = await page.evaluate(() => {
    const B = __t.B, z = (B.minZ + B.maxZ) / 2;
    G.test.teleport(B.maxX + 3, B.maxY / 2, z); G.rigYaw = Math.PI / 2; G.desktop.level(0);
    G.P.vel.x = -8; __t.step(30);
    const on = !!G.P.wall;
    __t.key('KeyW', true); const n = __t.until(() => __t.done('climb'), 240); __t.key('KeyW', false);
    __t.key('Space', true); __t.step(2); __t.key('Space', false); __t.step(10);
    return { on, n, climb: __t.done('climb') };
  });
  assert(r5.on && r5.climb, 'climbing a wall with W ticks "climb a wall": ' + JSON.stringify(r5));
  console.log('PASS rows tick by real actions: the gold ring, let go, swing again, reel, yank, look, climb');

  /* ---------------- the pump sticker and the last row ---------------- */
  const p0 = await page.evaluate(() => {
    const c = G.city.clogs[0], tg = G.game.info().clogs[0];
    G.test.teleport(c.x + 8, c.y, c.z); __t.step(20);
    const n = __t.fire(1, c.x, c.y + 2, c.z); __t.step(2);
    const el = document.querySelector('.fs-pump');
    return { n, tag: G.test.state().ropes[1].tag, shown: !el.hidden, text: el.textContent, dots: el.querySelectorAll('i').length, on: el.querySelectorAll('i.on').length, pump: G.game.progress.pump && { ...G.game.progress.pump }, done: tg.done };
  });
  assert(p0.tag === 'clog' && p0.shown && /F/.test(p0.text) && /PUMP/.test(p0.text) && p0.dots === 3 && p0.on === 0, 'a rope on a clog shows the pump sticker: F, PUMP and three empty dots: ' + JSON.stringify(p0));
  await page.screenshot({ path: out + '/training-pump.png' });
  const p1 = await page.evaluate(() => {
    const out = [];
    for (let k = 0; k < 3; k++) {
      G.test.yank(1, 3.5); __t.step(2); G.test.yank(1, 0); __t.step(20);
      const el = document.querySelector('.fs-pump'), r = __t.row('plunge');
      out.push({ on: el.hidden ? -1 : el.querySelectorAll('i.on').length, n: r ? r.n : null, done: r ? r.done : null });
    }
    return { steps: out, clog: G.game.info().clogs[0].done, training: !!__t.tr(), tdone: __t.tr() && __t.tr().done };
  });
  assert(p1.clog && p1.steps[0].on === 1 && p1.steps[1].on === 2 && p1.steps[2].on === -1, 'each F press fills a dot, and the third flushes the clog and hides the sticker: ' + JSON.stringify(p1));
  assert(p1.tdone, 'the last row ticks and the training is complete: ' + JSON.stringify(p1));
  const fin = await page.evaluate(() => { __t.step(5); const t = document.querySelector('.fs-train'); const a = { done: t.classList.contains('done'), shown: !t.hidden, save: G.save.tutorial, toast: document.querySelector('.fs-toast').textContent }; __t.step(300); a.gone = !__t.tr() && t.hidden; return a; });
  assert(fin.done && fin.shown && fin.save === true && /Training complete/i.test(fin.toast) && fin.gone, 'the card says complete, the save marks the tutorial done, a toast cheers, and the card folds away: ' + JSON.stringify(fin));
  console.log('PASS the pump sticker counts F presses; the last row completes the training');

  /* ---------------- the mission card ---------------- */
  const m = await page.evaluate(() => { __t.step(40); const el = document.querySelector('.fs-mission'); return { shown: !el.hidden, text: el.textContent, ob: G.game.progress.objective && { ...G.game.progress.objective } }; });
  assert(m.shown && /FLUSH THE CLOGS 1\/12/.test(m.text) && /Next: .+ clog, \d+ m/.test(m.text), 'the mission card says what to do and where: ' + JSON.stringify(m));
  console.log('PASS the mission card:', m.text);
  await page.screenshot({ path: out + '/training-mission.png' });
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log('PASS no runtime errors on desktop');
  await page.context().close();

  /* ---------------- a phone in portrait ---------------- */
  const ph = await newPage({ width: 390, height: 844 });
  ph.setDefaultTimeout(240000);
  await ph.addInitScript(() => {
    window.AudioContext = window.webkitAudioContext = undefined;
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    window.ontouchstart = null;
    window.DeviceOrientationEvent = function () {}; window.DeviceMotionEvent = function () {};
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied');
    window.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied');
  });
  await open(ph, '?nosw'); await ph.waitForFunction(() => G.viewDone);
  await ph.locator('#playFlat').click(); await ph.waitForFunction(() => G.state === 'play');
  const LP = await ph.evaluate(async () => (await import('./js/config.js')).LINES_PHONE.tutorial[0]);
  const q = await ph.evaluate(() => {
    G.test.hold(true); G.test.step(1 / 60, 5);
    const t = G.game.progress.training, card = document.querySelector('.fs-train'), now = document.querySelector('.fs-train-now');
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width }; };
    return { kind: t && t.kind, n: t && t.items.length, cardShown: getComputedStyle(card).display !== 'none' && !card.hidden, nowShown: !now.hidden && getComputedStyle(now).display !== 'none', nowText: now.textContent, nowBox: r(now), said: document.querySelector('.fs-sub').textContent, wide: document.documentElement.scrollWidth > innerWidth, tops: [...document.querySelectorAll('.fs-top .fs-pill')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().top)) };
  });
  await ph.screenshot({ path: out + '/training-phone.png' });
  assert(q.kind === 'touch' && q.n === 7 && !q.cardShown && q.nowShown && /gold ring/i.test(q.nowText) && q.nowBox.r <= 390 && !q.wide && Math.max(...q.tops) - Math.min(...q.tops) <= 4, 'a phone in portrait shows the training chip in the score row, which stays one row: ' + JSON.stringify(q));
  assert.equal(q.said, LP, 'the first line on a phone is the phone tutorial line');
  assert.equal(ph.errors.length, 0, JSON.stringify(ph.errors));
  console.log('PASS a phone in portrait: the training chip in the one-row score row, the phone line said, no runtime errors');
} finally { await close(); }
