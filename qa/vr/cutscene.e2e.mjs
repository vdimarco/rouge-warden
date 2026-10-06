// Flat play: the comic scenes (cutscene.js). The opening tells why the Porcelain King sits on the Needle and gives the first
// mission; a district's briefing, the King waking and the finale follow. Each panel is a shot of the live city in an inked frame
// with a caption, a balloon pinned to its point or a title card. Most panels show a painted picture (art/cutscene); with no
// picture a panel shows the live shot. The game holds still and the HUD hides while a scene plays;
// a press skips it. A screenshot of every panel goes to $SHOTS. Run from the repo root (the server is our own, see lib.mjs).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { newPage, open, close, watchdog } from './lib.mjs';
watchdog(900000, 'cutscene');
const out = process.env.SHOTS || '/tmp/swing-qa'; await mkdir(out, { recursive: true });
const page = await newPage({ width: 960, height: 540 });
page.setDefaultTimeout(240000);
await page.addInitScript(() => { window.AudioContext = window.webkitAudioContext = undefined; Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); });
try {
  // a scene plays only on request in the tests (lib.mjs adds nocut otherwise): ?cut lets the save's first-run scene play too
  await open(page, '?nosw&skipintro&cut'); await page.waitForFunction(() => G.viewDone);
  await page.locator('#playFlat').click({ noWaitAfter: true }); await page.waitForFunction(() => G.state === 'play');
  await page.evaluate(() => { G.test.hold(true); G.test.step(1 / 60, 30); });
  const loaded = await page.evaluate(async () => { await G.test.cutsceneArt(); return G.test.cutscene().loaded.sort(); });
  assert.deepEqual(loaded, ['city', 'clogs', 'finale', 'hero', 'king', 'king-awake', 'swing'], 'flat play loads the seven pictures of the comic scenes: ' + loaded);
  const view = () => page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    return { cs: G.test.cutscene(), state: G.state, hud: getComputedStyle(document.querySelector('.fs-hud')).visibility, root: !document.querySelector('#cutscene').hidden, bal: r('#cutscene .cs-bal'), cap: r('#cutscene .cs-cap'), art: r('#cutscene .cs-art'), W: innerWidth, H: innerHeight };
  });
  const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const inside = (b, W, H) => !b || (b.l >= 0 && b.t >= 0 && b.r <= W && b.b <= H);

  /* ---------------- the opening, panel by panel ---------------- */
  const pos0 = await page.evaluate(() => ({ ...G.P.pos }));
  await page.evaluate(() => { G.test.story('opening'); G.test.step(1 / 60, 2); });
  const seen = [];
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => G.test.step(1 / 60, 60)); // a second into the panel
    const v = await view();
    seen.push(v);
    await page.screenshot({ path: `${out}/cutscene-opening-${k + 1}.png` });
    await page.evaluate((i) => { const c = G.test.cutscene(); const left = [2.4, 3.2, 2.6, 2.5, 1.8, 1.8][i] - c.t - 0.05; if (left > 0) G.test.step(1 / 60, Math.round(left * 60)); }, k);
  }
  const s0 = seen[0], s1 = seen[1];
  assert(s0.cs.playing && s0.cs.name === 'opening' && s0.state === 'cutscene' && s0.root && s0.hud === 'hidden', 'the opening plays: the game holds still and the HUD hides: ' + JSON.stringify(s0));
  assert(/Needle/.test(s0.cs.caption) && /Port Loon/i.test(s0.cs.caption), 'panel 1 shows Port Loon and the Needle: ' + s0.cs.caption);
  assert(/Porcelain King/.test(s1.cs.caption) && /Flushmore/.test(s1.cs.caption) && /drain/i.test(s1.cs.balloon) && inside(s1.bal, s1.W, s1.H), 'panel 2 tells who the King is, with his line, the balloon inside the screen: ' + JSON.stringify(s1.cs) + JSON.stringify(s1.bal));
  assert(/flushed himself/i.test(seen[2].cs.caption) && /toilet god/i.test(seen[2].cs.caption), 'panel 3 tells how he became the King: ' + seen[2].cs.caption);
  assert(/Sludge Gang/i.test(seen[3].cs.caption) && /Market drain/i.test(seen[3].cs.caption), 'panel 4 sets up the first mission: ' + seen[3].cs.caption);
  assert(/watch/i.test(seen[4].cs.caption) && /plunger/i.test(seen[4].cs.balloon), 'panel 5 shows the hero: ' + JSON.stringify(seen[4].cs));
  assert(/Mission 1/i.test(seen[5].cs.title) && /Sludge Run/i.test(seen[5].cs.title), 'panel 6 is the first mission card: ' + seen[5].cs.title);
  assert.deepEqual(seen.map((v) => v.cs.art), ['city', 'king', 'clogs', 'king-awake', 'hero', 'swing'], 'each opening panel shows its painted picture');
  assert(seen.reduce((s, v, i) => s + [2.4, 3.2, 2.6, 2.5, 1.8, 1.8][i], 0) <= 15, 'the opening is short: about 14 s');
  assert(seen.every((v) => v.art && v.art.l >= 0 && v.art.r <= v.W && v.art.t > 0 && v.art.b < v.H), 'the picture fills the inked frame, inside the screen');
  assert(!hit(s1.bal, s1.cap) && !hit(seen[4].bal, seen[4].cap) && s1.cap.t > s1.H / 2 && seen[4].cap.t > seen[4].H / 2, 'on the King and the hero the caption moves to the foot of the frame and no balloon covers it');
  assert(seen.every((v) => inside(v.cap, v.W, v.H)), 'every caption sits inside the screen');
  const after = await page.evaluate(() => { G.test.step(1 / 60, 40); return { cs: G.test.cutscene(), state: G.state, hud: getComputedStyle(document.querySelector('.fs-hud')).visibility, pos: { ...G.P.pos }, seen: G.save.seen.opening }; });
  assert(!after.cs.playing && after.state === 'play' && after.hud !== 'hidden' && after.seen === true, 'the opening ends by itself and play goes on with the HUD back: ' + JSON.stringify(after));
  assert(Math.hypot(after.pos.x - pos0.x, after.pos.z - pos0.z) < 0.5, 'the hero held still through the scene');
  console.log('PASS the opening: Port Loon, who the Porcelain King is, how he became a toilet god, the Sludge Gang, the hero, Mission 1: Sludge Run');

  /* ---------------- a press skips ---------------- */
  await page.evaluate(() => { G.test.story('king'); G.test.step(1 / 60, 3); });
  const early = await page.evaluate(() => G.test.cutscene());
  await page.keyboard.press('Space'); await page.evaluate(() => G.test.step(1 / 60, 2));
  const k1 = await view();
  assert(early.playing && early.name === 'king' && k1.cs.playing, 'a press in the first half second does not skip (the press that started play must not end the scene)');
  await page.evaluate(() => G.test.step(1 / 60, 40));
  await page.screenshot({ path: `${out}/cutscene-king.png` });
  const kv = await view();
  assert(/awake/i.test(kv.cs.caption) && /dare/i.test(kv.cs.balloon) && kv.cs.art === 'king-awake' && inside(kv.bal, kv.W, kv.H), 'the King scene: the painted King is awake and dares you: ' + JSON.stringify(kv.cs));
  await page.keyboard.press('Space'); await page.evaluate(() => G.test.step(1 / 60, 2));
  const k2 = await view();
  assert(!k2.cs.playing && k2.state === 'play' && !k2.root, 'Space skips the scene: ' + JSON.stringify(k2));
  console.log('PASS Space skips a scene (not in its first half second)');

  /* ---------------- a district's briefing, and the finale ---------------- */
  await page.evaluate(() => { const c = G.city.clogs[3]; G.test.story('district', { id: 3, name: 'Market', left: 2, clog: { x: c.x, y: c.y, z: c.z } }); G.test.step(1 / 60, 60); });
  const dv = await view();
  assert(dv.cs.name === 'district' && /Market: 2 clogs/.test(dv.cs.caption) && /fish/i.test(dv.cs.caption), 'a district briefing names it, its clogs and a line about it: ' + dv.cs.caption);
  await page.screenshot({ path: `${out}/cutscene-district.png` });
  await page.evaluate(() => G.test.step(1 / 60, 240));
  await page.evaluate(() => { G.test.story('finale'); G.test.step(1 / 60, 300); });
  const fv = await view();
  assert(fv.cs.name === 'finale' && /All clear/i.test(fv.cs.title), 'the finale ends on the all clear card: ' + JSON.stringify(fv.cs));
  await page.screenshot({ path: `${out}/cutscene-finale.png` });
  await page.evaluate(() => G.test.step(1 / 60, 240));
  assert.equal((await view()).state, 'play');
  console.log('PASS a district briefing and the finale');
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log('PASS no runtime errors');
  await page.context().close();

  /* ---------------- a phone held upright: the panels fit, a tap skips ---------------- */
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
  await open(ph, '?nosw&skipintro&cut'); await ph.waitForFunction(() => G.viewDone);
  await ph.route('**/art/cutscene/king-awake.webp', (r) => r.abort()); // a picture that does not load: its panel shows the live shot
  await ph.locator('#playFlat').click(); await ph.waitForFunction(() => G.state === 'play');
  await ph.evaluate(() => G.test.cutsceneArt());
  await ph.evaluate(() => { G.test.hold(true); G.test.step(1 / 60, 30); G.test.story('opening'); G.test.step(1 / 60, 2); });
  const pv = [];
  for (let k = 0; k < 4; k++) {
    await ph.evaluate(() => G.test.step(1 / 60, 60));
    pv.push(await ph.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { cs: G.test.cutscene(), bal: r('#cutscene .cs-bal'), cap: r('#cutscene .cs-cap'), skip: r('#cutscene .cs-skip'), phone: getComputedStyle(document.querySelector('#phoneControls')).visibility, W: innerWidth, H: innerHeight, wide: document.documentElement.scrollWidth > innerWidth };
    }));
    await ph.screenshot({ path: `${out}/cutscene-phone-${k + 1}.png` });
    await ph.evaluate((i) => { const c = G.test.cutscene(); const left = [3.4, 4.2, 3.6, 3.4][i] - c.t - 0.05; if (left > 0) G.test.step(1 / 60, Math.round(left * 60)); }, k);
  }
  assert(pv.every((v) => inside(v.cap, v.W, v.H) && inside(v.bal, v.W, v.H) && !v.wide && v.phone === 'hidden'), 'on a phone held upright each caption and balloon sits inside the screen and the phone buttons hide: ' + JSON.stringify(pv));
  assert(pv[1].bal && !hit(pv[1].bal, pv[1].cap) && !hit(pv[1].bal, pv[1].skip), 'on a phone the King\'s balloon keeps clear of the caption and the SKIP button: ' + JSON.stringify(pv[1]));
  assert.deepEqual(pv.map((v) => v.cs.art), ['city', 'king', 'clogs', ''], 'on a phone the panels show their pictures, and the panel whose picture did not load shows the live shot');
  const box = pv[1].skip;
  // a pointer press on SKIP, as a tap gives
  await ph.mouse.click((box.l + box.r) / 2, (box.t + box.b) / 2); await ph.evaluate(() => G.test.step(1 / 60, 2));
  const ps = await ph.evaluate(() => ({ cs: G.test.cutscene(), state: G.state }));
  assert(!ps.cs.playing && ps.state === 'play', 'a tap on SKIP ends the scene on a phone: ' + JSON.stringify(ps));
  const errs = ph.errors.filter((e) => !/Failed to load resource|ERR_FAILED|king-awake\.webp/.test(e)); // (the picture blocked on purpose)
  assert.equal(errs.length, 0, JSON.stringify(errs));
  console.log('PASS a phone held upright: the pictures fit, a missing one falls back to the live shot, the phone buttons hide, a tap skips');
} finally { await close(); }
