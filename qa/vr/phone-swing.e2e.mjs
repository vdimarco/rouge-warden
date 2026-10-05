// One-tap phone swinging: taps alone chain fast swings, the rope lets go by itself, a steady beat of taps keeps a fast swing over
// the street, a tap at the sky still swings, a tap on a clog plunges it, the view widens and the speed lines show at speed, the
// phone tutorial says phone words, and the phone buttons never cover the score or the spoken lines. Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(240000, 'phone swing');
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const page = await newPage({ width: 390, height: 844 });
await page.addInitScript(() => {
  window.AudioContext = window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  window.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied');
  window.DeviceMotionEvent.requestPermission = () => Promise.resolve('denied');
});
const boxes = () => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const buttons = [...document.querySelectorAll('.phone-top button')].map(r), pills = [...document.querySelectorAll('.fs-top .fs-pill')].filter((e) => !e.hidden).map(r);
  const sub = r(document.querySelector('.fs-sub')), bottom = r(document.querySelector('.phone-bottom'));
  // the hero on the screen, from the head down to the feet
  G.camera.updateMatrixWorld(true);
  const px = (v) => { const p = v.clone().project(G.camera); return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight }; };
  const hd = px(G.hero.head), ft = px(G.hero.head.clone().setY(G.P.pos.y));
  const hero = { l: Math.min(hd.x, ft.x) - 30, r: Math.max(hd.x, ft.x) + 30, t: hd.y - 20, b: ft.y };
  return { top: buttons.some((a) => pills.some((b) => hit(a, b))), sub: hit(sub, bottom) || buttons.some((a) => hit(sub, a)) || pills.some((a) => hit(sub, a)), hero: G.flatcam.opacity > 0.5 && hit(sub, hero), wide: document.documentElement.scrollWidth > innerWidth };
});
try {
  await open(page, '?nosw'); await page.waitForFunction(() => G.viewDone);
  await page.locator('#playFlat').click(); await page.waitForFunction(() => G.state === 'play');
  await page.locator('#phoneControls').waitFor({ state: 'visible' });

  // Taps alone, from the start roof toward the gold ring: no LET GO, no steering. The old two-tap play averaged 8 m/s
  // and covered 80 m in these 12 seconds.
  const run = await page.evaluate(() => {
    G.test.hold(true);
    const s = G.city.start, R = G.city.goldRing;
    G.test.teleport(s.x, s.y, s.z); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z));
    // in the chase view: hold the camera at this bearing and stop the hand-off settle (it eases the pitch for a while after
    // PLAY), and run one frame so the input's pitch matches the camera's; the level below then gives the same view however
    // many frames ran before this point
    if (G.flatcam) { G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.step(1 / 60, 1); }
    G.desktop.level(0.35); G.test.step(1 / 60, 2);
    const btn = document.querySelector('[data-action=throw]'), p0 = { ...G.P.pos };
    let sum = 0, max = 0, flings = 0, wide = 0, rush = 0, pressedAfterFling = null;
    for (let f = 0; f < 720; f++) {
      if (G.P.ropes[1].state === 'idle' && f % 10 === 0) btn.onclick();
      const before = G.test.events().filter((e) => e.type === 'fling').length;
      G.test.step(1 / 60, 1);
      const now = G.test.events().filter((e) => e.type === 'fling').length;
      if (now > before) { flings++; pressedAfterFling = btn.getAttribute('aria-pressed'); }
      const v = G.P.vel, sp = Math.hypot(v.x, v.y, v.z);
      sum += sp; max = Math.max(max, sp);
      if (sp > 28) { wide = Math.max(wide, G.camera.fov); rush = Math.max(rush, +document.querySelector('.phone-rush').style.opacity || 0); }
    }
    const p = G.P.pos;
    return { mean: sum / 720, max, dist: Math.hypot(p.x - p0.x, p.z - p0.z), flings, wide, rush, pressedAfterFling, dead: G.P.dead };
  });
  assert(run.mean >= 15, 'taps alone average at least 15 m/s: ' + JSON.stringify(run));
  assert(run.dist >= 140, 'taps alone cover at least 140 m in 12 s: ' + JSON.stringify(run));
  assert(run.flings >= 1 && run.pressedAfterFling === 'false', 'the rope lets go by itself and SWING comes back: ' + JSON.stringify(run));
  assert(run.wide > 85 && run.rush > 0.5, 'the view widens and the speed lines show at speed: ' + JSON.stringify(run));
  assert.equal(run.dead, null);
  console.log('PASS taps alone chain fast swings', JSON.stringify({ mean: +run.mean.toFixed(1), max: +run.max.toFixed(1), dist: Math.round(run.dist), flings: run.flings, fov: Math.round(run.wide), rush: run.rush }));

  // A steady beat: SWING pressed every 0.5, 0.8 or 1.2 s whatever the rope is doing, as a player who just keeps tapping. A press
  // with a rope out swings on to the next building (no let-go between), the catch keeps the speed, and the rope is short enough
  // that the arc stays over the street. Low is the time the feet spend under 8 m (the street and the low shops).
  const beats = [];
  for (const beat of [0.5, 0.8, 1.2]) beats.push(await page.evaluate((beat) => {
    const s = G.city.start, R = G.city.goldRing;
    G.test.teleport(s.x, s.y, s.z); G.desktop.mobile.reset(); G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z));
    if (G.flatcam) { G.flatcam.reset(G.rigYaw, G.flatcam.pitch); G.test.step(1 / 60, 1); }
    G.desktop.level(0.35); G.test.step(1 / 60, 2);
    const btn = document.querySelector('[data-action=throw]'), p0 = { ...G.P.pos }, every = Math.round(beat * 60);
    let sum = 0, low = 0, ground = 0;
    for (let f = 0; f < 720; f++) {
      if (f % every === 0) btn.onclick();
      G.test.step(1 / 60, 1);
      const v = G.P.vel; sum += Math.hypot(v.x, v.y, v.z);
      if (G.P.pos.y < 8) low++;
      if (G.P.onGround) ground++;
    }
    const p = G.P.pos;
    return { beat, mean: +(sum / 720).toFixed(1), dist: Math.round(Math.hypot(p.x - p0.x, p.z - p0.z)), low: +(low / 60).toFixed(1), ground: +(ground / 60).toFixed(1), dead: G.P.dead };
  }, beat));
  console.log('INFO steady beat', JSON.stringify(beats));
  for (const b of beats) {
    assert(b.mean >= 17 && b.dist >= 120, 'a steady beat of taps keeps a fast swing going: ' + JSON.stringify(b));
    assert(b.low <= 2.5 && b.ground <= 1.5, 'a steady beat of taps keeps the hero over the street: ' + JSON.stringify(b));
    assert.equal(b.dead, null);
  }
  console.log('PASS a steady beat of taps (0.5, 0.8 and 1.2 s) swings on with no let-go, fast and over the street');

  // A tap at the empty sky still swings: the assist picks a building ahead and above.
  const sky = await page.evaluate(() => {
    const s = G.city.start, R = G.city.goldRing;
    G.test.teleport(s.x, s.y, s.z); G.desktop.mobile.reset();
    G.rigYaw = Math.atan2(-(R.x - s.x), -(R.z - s.z)); G.test.step(1 / 60, 2);
    G.test.aimAt(1, s.x, s.y + 5000, s.z);
    document.querySelector('[data-action=throw]').onclick();
    G.test.step(1 / 60, 30);
    const r = G.P.ropes[1];
    G.test.aimAt(1, null);
    return { state: r.state, above: r.anchor.y - (G.P.pos.y + G.P.chest) };
  });
  assert.equal(sky.state, 'attached', 'a tap at the sky attaches'); console.log('PASS a tap at the sky swings from a building', JSON.stringify(sky));

  // A tap on a clog plunges it with no yank: three pumps and the flush.
  const clog = await page.evaluate(() => {
    const c = G.city.clogs.find((q) => !G.game.info().clogs[q.id].done), S = 1.35, T = { x: c.x, y: c.y + 1.9 * S, z: c.z }, HIT = {};
    let sp = null;
    for (const r of [4.5, 6, 8, 10, 13]) for (let k = 0; k < 16 && !sp; k++) {
      const a = (k / 16) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const tb = G.city.topBelow(x, c.y + 0.4, z, 0.3);
      if (!tb || Math.abs(tb.y - c.y) > 0.05) continue;
      if (G.city.collideSphere(x, c.y + 1.25, z, 0.5) || G.city.collideSphere(x, c.y + 0.5, z, 0.4)) continue;
      const dx = T.x - x, dy = T.y - (c.y + 1.65), dz = T.z - z, d = Math.hypot(dx, dy, dz);
      if (!G.city.raycast(x, c.y + 1.65, z, dx, dy, dz, d - 0.7, HIT)) sp = { x, y: c.y, z };
    }
    if (!sp) return 'no spot';
    G.test.teleport(sp.x, sp.y, sp.z); G.desktop.mobile.reset(); G.test.step(1 / 60, 3);
    G.test.aimAt(1, T.x, T.y, T.z);
    document.querySelector('[data-action=throw]').onclick();
    G.test.step(1 / 60, 20);
    const tag = G.P.ropes[1].tag || G.test.state().ropes[1].tag;
    G.test.step(1 / 60, 180);
    G.test.aimAt(1, null);
    return { tag, done: G.game.info().clogs[c.id].done, pumps: G.game.info().clogs[c.id].pumps };
  });
  assert.equal(clog.done, true, 'a tapped clog flushes by itself: ' + JSON.stringify(clog)); console.log('PASS a tap on a clog plunges it', JSON.stringify(clog));

  // The phone tutorial speaks phone words, never mouse or keyboard ones.
  const words = await page.evaluate(() => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => G.ui.sayLine('tutorial', i, 'mouse')));
  assert(words.every((w) => w && !/mouse|Shift|Press F|trigger/i.test(w)), 'phone tutorial lines: ' + JSON.stringify(words));
  console.log('PASS the phone tutorial says tap, not mouse or keys');

  // The layout: the top buttons never cover the score pills, and a spoken line never sits under the SWING panel, the top
  // buttons or the pills, nor over the hero.
  await page.evaluate(() => { G.ui.say('Tap the next building while you fly.', 6); G.test.step(1 / 60, 2); });
  let b = await boxes();
  assert(!b.top && !b.sub && !b.hero && !b.wide, 'portrait layout: ' + JSON.stringify(b));
  await page.screenshot({ path: out + '/phone-swing.png' });
  await page.setViewportSize({ width: 844, height: 390 }); await page.evaluate(() => G.test.step(1 / 60, 2));
  b = await boxes();
  assert(!b.top && !b.sub && !b.hero && !b.wide, 'landscape layout: ' + JSON.stringify(b));
  await page.screenshot({ path: out + '/phone-swing-landscape.png' });
  // a narrow phone (360 px): the top buttons stay on one row inside the screen
  await page.setViewportSize({ width: 360, height: 780 }); await page.evaluate(() => G.test.step(1 / 60, 2));
  const row = await page.evaluate(() => { const bs = [...document.querySelectorAll('.phone-top button')].map((b) => b.getBoundingClientRect()); return { tall: Math.max(...bs.map((r) => r.height)), left: Math.min(...bs.map((r) => r.left)), right: Math.max(...bs.map((r) => r.right)), w: innerWidth }; });
  b = await boxes();
  assert(row.tall <= 46 && row.left >= 0 && row.right <= row.w && !b.top && !b.wide, '360 px: one row of top buttons inside the screen: ' + JSON.stringify(row));
  console.log('PASS portrait, landscape and a 360 px phone: the phone buttons cover neither the score nor the spoken lines, and the lines keep off the hero');
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors)); console.log('PASS no runtime errors');
} finally { await close(); }
