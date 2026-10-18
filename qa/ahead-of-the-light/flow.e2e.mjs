// Ahead of the Light's screen flow in a browser (final.md 14, 15.2, 16, 22.1): the daily route's one seed (the DAILY
// chip, ?daily=1 and AGAIN), PRACTICE never touching the saved run, AGAIN on a practice card replaying that leg, its
// medals only on a page with no URL option but seed and daily, a saved run resumed on a tuned page going unranked,
// input after QUIT RUN, Esc and P pausing, M in the toy, a steer key let go on a screen or in the pause, Space after
// the pause button, Enter on a focused button, Space and Enter after a mouse click on a result card chip, keys behind
// the open game switcher, THE FULL RUN from the toy, a double tap on REROLL, the camera at each launch, REDUCED MOTION
// from Settings, the break's ship redrawn on a rotation, short phone screens upright and on their side (the break, the
// title, the captions, a missed DOOR's landing caption), a missed DOOR's landing caption through the real ending (each
// chunk before the result card) and the ring layer's labels (rival labels off the light's label, the wings and the
// HUD; landmark labels off each other).
//   NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/flow.e2e.mjs      (the site served on 8765)
import { launch, open, reporter, S, R, wait, waitMode, BASE } from './e2e-lib.mjs';

const rep = reporter('Ahead of the Light: flow');
const { check } = rep;
const RUN_KEY = 'ahead-of-the-light.run.v1';
const savedSeed = (page) => R(page, (k) => { try { const o = JSON.parse(localStorage.getItem(k)); return o && o.run ? String(o.run.seed) : null; } catch (e) { return null; } }, RUN_KEY);
const frames = (page, n = 2) => R(page, (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const meta1 = { runs: 1, seen: { runs: 1, goodWhip: false, offered: false, vistas: {} } };
async function tap(page, sel, desk = false) {
  if (!(await page.locator(sel).count())) return false;
  const box = await page.locator(sel).first().boundingBox();
  if (!box) return false;
  if (desk) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  else await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
// Play leg `leg` from a few beats before its gate with the mid bot until a break (or a result) opens.
async function toBreak(page, leg = 1, seed = 'FLOWB') {
  for (let k = 0; k < 4; k++) {
    await R(page, ({ leg, seed }) => { const r = window.__race; r.goto({ leg, seed }); const L = r.leg(); r.goto({ leg, seed, beat: L.beats - 6 }); r.bot('mid'); r.realtime(false); }, { leg, seed: seed + k });
    for (let i = 0; i < 60 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
    await R(page, () => { window.__race.bot(null); window.__race.realtime(true); });
    if ((await S(page)).mode === 'break') return true;
  }
  return false;
}
// Fly with no input until the light catches you.
async function toResult(page) {
  await R(page, () => window.__race.realtime(false));
  for (let i = 0; i < 200 && ['play', 'ending'].includes((await S(page)).mode); i++) await R(page, () => window.__race.advance(1));
  await R(page, () => window.__race.realtime(true));
  return (await S(page)).mode === 'result';
}
const browser = await launch();

// ---------------------------------------------------------------- desktop: keys, focus, the switcher, the toy
{
  rep.section('desktop');
  const { page, errors, ctx } = await open(browser, 'desktop');
  await page.keyboard.press('Space');
  await waitMode(page, 'play', 8000);
  // Esc and P pause, and the same key goes on
  await page.keyboard.press('Escape');
  await wait(150);
  let s = await S(page);
  check('desktop: Esc pauses', s.paused && s.screen === 'pause', JSON.stringify({ paused: s.paused, screen: s.screen }));
  await wait(300);
  await page.keyboard.press('Escape');
  await wait(150);
  check('desktop: Esc again goes on', !(await S(page)).paused);
  await page.keyboard.press('p');
  await wait(150);
  check('desktop: P pauses', (await S(page)).paused);
  await wait(300);
  await page.keyboard.press('p');
  await wait(150);
  check('desktop: P again goes on', !(await S(page)).paused);

  // the pause button, then Esc: Space grabs, and never pauses again
  await tap(page, '#pause', true);
  await wait(350);
  await page.keyboard.press('Escape');
  await wait(150);
  const p0 = (await S(page)).input.counts.presses;
  await page.keyboard.press('Space');
  await wait(150);
  s = await S(page);
  check('desktop: after a click on ‖ and Esc, Space is a press and does not pause', !s.paused && s.input.counts.presses === p0 + 1,
    `paused ${s.paused}, presses ${p0} → ${s.input.counts.presses}, focus ${await R(page, () => document.activeElement && document.activeElement.id)}`);

  // a steer key let go in the pause is let go
  await R(page, () => window.__race.realtime(false));
  await page.keyboard.down('ArrowRight');
  await R(page, () => window.__race.advance(0.3));
  await tap(page, '#pause', true);
  await wait(350);
  await page.keyboard.up('ArrowRight');
  await tap(page, '[data-act="resume"]', true);
  await wait(100);
  let b0 = (await S(page)).you.bearing;
  await R(page, () => window.__race.advance(1));
  let b1 = (await S(page)).you.bearing;
  check('desktop: → let go in the pause, then RESUME: the ship does not turn', Math.abs(b1 - b0) < 20, `${b0.toFixed(1)} → ${b1.toFixed(1)}`);
  // ... and let go on the result card, then AGAIN
  await page.keyboard.down('ArrowLeft');
  const res = await toResult(page);
  await page.keyboard.up('ArrowLeft');
  await wait(1100);
  await page.keyboard.press('Enter');
  await waitMode(page, 'play', 5000).catch(() => {});
  await R(page, () => window.__race.realtime(false));
  b0 = (await S(page)).you.bearing;
  await R(page, () => window.__race.advance(1));
  b1 = (await S(page)).you.bearing;
  check('desktop: ← let go on the result card, then AGAIN: the new leg does not turn', res && Math.abs(b1 - b0) < 20, `${b0.toFixed(1)} → ${b1.toFixed(1)}`);
  await R(page, () => window.__race.realtime(true));

  // QUIT RUN, then a new run: the keys steer
  await tap(page, '#pause', true);
  await wait(350);
  await tap(page, '[data-act="quit"]', true);
  await waitMode(page, 'title', 3000).catch(() => {});
  await page.keyboard.press('Space');
  await waitMode(page, 'play', 5000).catch(() => {});
  await R(page, () => window.__race.realtime(false));
  b0 = (await S(page)).you.bearing;
  await page.keyboard.down('ArrowLeft');
  await R(page, () => window.__race.advance(0.5));
  await page.keyboard.up('ArrowLeft');
  b1 = (await S(page)).you.bearing;
  check('desktop: after QUIT RUN and a new run, ← steers', Math.abs(b1 - b0) > 20, `${b0.toFixed(1)} → ${b1.toFixed(1)}`);
  await R(page, () => window.__race.realtime(true));

  // a double tap on REROLL spends one reroll
  const brk = await toBreak(page);
  check('desktop: a leg played to its gate opens the break', brk);
  if (brk) {
    const save = await R(page, () => window.__race.save());
    const env = JSON.parse(save);
    env.run.rerolls = 2;
    // a later offer (the first offer of a first run never rerolls)
    if (env.run.offer) { env.run.offer.first = false; env.run.offer.caption = null; }
    env.run.seen.offered = true;
    await R(page, (j) => window.__race.load(j), JSON.stringify(env));
    await wait(600);
    const box = (await page.locator('[data-act="reroll"]').count()) ? await page.locator('[data-act="reroll"]').boundingBox() : null;
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await wait(140);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await wait(150);
    }
    const left = (await R(page, () => window.__race.run())).rerolls;
    check('desktop: a double tap on REROLL spends one reroll', box && left === 1, `rerolls 2 → ${left}`);
    await wait(600);
    // Enter on the focused SKIP skips
    const before = (await R(page, () => window.__race.run())).build.length;
    await page.focus('[data-act="skip"]');
    await page.keyboard.press('Enter');
    await wait(200);
    s = await S(page);
    const after = (await R(page, () => window.__race.run())).build.length;
    check('desktop: Enter on the focused SKIP skips (no card taken)', s.mode === 'chart' && after === before, `mode ${s.mode}, build ${before} → ${after}`);
    // Enter on the focused second lane chip launches that lane
    await wait(700);
    const lanes = await R(page, () => (window.__race.chart() || {}).lanes || []);
    if (lanes.length > 1 && await page.locator('[data-act="lane"][data-i="1"]').count()) {
      await page.focus('[data-act="lane"][data-i="1"]');
      await page.keyboard.press('Enter');
      await wait(200);
      const run = await R(page, () => window.__race.run());
      const got = run && run.lanes[run.leg];
      check('desktop: Enter on the focused second lane chip launches that lane', (await S(page)).mode === 'play'
        && got && (got.id === lanes[1].id || got.name === lanes[1].name), `${got && (got.id || got.name)} against ${lanes[1].id || lanes[1].name}`);
    }
    // Enter on the result card's focused TITLE chip opens the title
    if (await toResult(page)) {
      await wait(1100);
      await page.focus('.s-result [data-act="title"]');
      await page.keyboard.press('Enter');
      await wait(200);
      check('desktop: Enter on the focused TITLE chip opens the title', (await S(page)).mode === 'title', (await S(page)).mode);
    }
    // a mouse click leaves no focus on the result card's chips: after a click on COPY LOG (or on TITLE inside the
    // card's 0.9 s lock, which ignores it) Space and Enter go AGAIN, as the card says; Enter on a focused COPY LOG
    // still copies (the clipboard's writes are counted)
    await R(page, () => {
      window.__copies = 0;
      if (navigator.clipboard) navigator.clipboard.writeText = () => { window.__copies++; return Promise.resolve(); };
    });
    const again = async (chip, key, inLock) => {
      await R(page, () => window.__race.action(window.__race.state().mode === 'title' ? 'fly' : 'again'));
      await waitMode(page, 'play', 5000).catch(() => {});
      if (!(await toResult(page))) return null;
      if (!inLock) await wait(1100);
      const c0 = await R(page, () => window.__copies);
      if (chip === 'focus') await page.focus('.s-result [data-act="copylog"]');
      else await tap(page, `.s-result [data-act="${chip}"]`, true);
      if (inLock) await wait(1100);
      await page.keyboard.press(key);
      await wait(250);
      return { mode: (await S(page)).mode, copies: (await R(page, () => window.__copies)) - c0 };
    };
    for (const [chip, key, inLock, want] of [['copylog', 'Space', false, 'play'], ['copylog', 'Enter', false, 'play'],
      ['title', 'Space', true, 'play'], ['focus', 'Enter', false, 'result']]) {
      const r = await again(chip, key, inLock);
      const what = chip === 'focus' ? 'Enter on the focused COPY LOG copies the log and keeps the card'
        : `${key} after a click on ${chip === 'title' ? 'TITLE in the card\'s lock' : 'COPY LOG'} goes AGAIN`;
      check(`desktop: ${what}`, r && r.mode === want && r.copies === (chip === 'copylog' || chip === 'focus' ? 1 : 0),
        JSON.stringify(r));
    }
    await R(page, () => window.__race.action('title'));
  }

  // the switcher open from the title: Space never starts a run behind it, and Esc closes it
  await R(page, () => { if (window.__race.state().mode !== 'title') window.__race.action('title'); });
  await wait(300);
  await tap(page, '#title [data-switch]', true);
  await wait(300);
  const sw = await R(page, () => Boolean(window.GameSwitch && window.GameSwitch.isOpen));
  if (sw) {
    await tap(page, '.gsw h2', true);
    await page.keyboard.press('Space');
    await wait(200);
    check('desktop: with the switcher open and its text clicked, Space does not start a run', (await S(page)).mode === 'title', (await S(page)).mode);
    await page.keyboard.press('Escape');
    await wait(150);
    check('desktop: Esc closes the switcher', !(await R(page, () => window.GameSwitch.isOpen)));
    // from the pause card: Esc closes the switcher and the race stays paused
    await page.keyboard.press('Space');
    await waitMode(page, 'play', 5000).catch(() => {});
    await tap(page, '#pause', true);
    await wait(350);
    await tap(page, '.s-pause [data-switch]', true);
    await wait(300);
    await tap(page, '.gsw p', true);
    await page.keyboard.press('Escape');
    await wait(200);
    s = await S(page);
    check('desktop: Esc with the switcher open over the pause closes it and the race stays paused', s.paused
      && !(await R(page, () => window.GameSwitch.isOpen)), `paused ${s.paused}`);
  } else check('desktop: the switcher opens', false);
  check('desktop: no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}
{
  const { page, errors, ctx } = await open(browser, 'desktop', '?toy=30');
  await page.keyboard.press('Space');
  await waitMode(page, 'toy', 5000).catch(() => {});
  // M in the toy mutes once
  const s0 = (await S(page)).sound;
  await page.keyboard.press('m');
  await wait(100);
  check('desktop toy: M toggles the sound', (await S(page)).sound === !s0, `${s0} → ${(await S(page)).sound}`);
  await page.keyboard.press('Escape');
  await wait(150);
  check('desktop toy: Esc pauses', (await S(page)).paused);
  await R(page, () => window.__race.resume());
  await R(page, () => window.__race.advance(32));
  await waitMode(page, 'toycard', 5000).catch(() => {});
  await wait(700);
  await tap(page, '[data-act="title"]', true);
  await waitMode(page, 'title', 3000).catch(() => {});
  await page.keyboard.press('Space');
  await wait(400);
  const s = await S(page);
  check('desktop toy: THE FULL RUN leads to a full run', s.mode === 'play' && s.runPhase !== null, `mode ${s.mode}`);
  check('desktop toy: no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- the vista: the glare left behind, labels on screen
// a gate crossed with the light held in the glare (as perf.e2e does), and one on a plain page where rivals fly by the
// screen's edges (seed VFX4 drew REMORA's name off the left edge): the vista's frames
for (const [size, q, seed0, back] of [['portrait', '?gap0=0.4&gapcap=0.4&bleed=0', 'VFX', 4], ['desktop', '?gap0=0.4&gapcap=0.4&bleed=0', 'VFX', 4],
  ['portrait', '', 'VFX4', 10], ['desktop', '', 'VFX4', 10]]) {
  const { page, errors, ctx } = await open(browser, size, q);
  let r = null;
  for (let k = 0; k < 3 && !r; k++) {
    r = await R(page, async ({ seed, back }) => {
      const race = window.__race;
      race.goto({ leg: 4, seed });
      const L = race.leg();
      race.goto({ leg: 4, seed, beat: L.beats - back });
      race.bot('dodge');
      const glare = document.getElementById('fx-glare'), cv = document.getElementById('overlay');
      const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText;
      const out = { play: 0, vista: [], off: [] };
      proto.fillText = function (str, x, y, ...rest) {
        if (this.canvas === cv && window.__race.state().mode === 'vista') {
          const m = this.measureText(str), t = this.getTransform(), k = t.a / (devicePixelRatio || 1) || 1;
          const x0 = this.textAlign === 'right' ? x - m.width : this.textAlign === 'center' ? x - m.width / 2 : x;
          if (x0 * k + t.e / (devicePixelRatio || 1) < -0.5 || (x0 + m.width) * k + t.e / (devicePixelRatio || 1) > innerWidth + 0.5) out.off.push(String(str));
        }
        return fill.call(this, str, x, y, ...rest);
      };
      const t0 = performance.now();
      await new Promise((done) => {
        const tick = () => {
          const s = window.__race.state();
          if (s.mode === 'play') out.play = Math.max(out.play, Number(glare.style.opacity) || 0);
          if (s.mode === 'vista') out.vista.push(Number(glare.style.opacity) || 0);
          if (s.mode === 'break' || s.mode === 'result' || performance.now() - t0 > 20000) return done();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      proto.fillText = fill;
      race.bot(null);
      return out.vista.length ? out : null;
    }, { seed: seed0 + (k ? k : ''), back });
  }
  if (q) {
    check(`${size}: a gate crossed in the glare: the glare is gone through the vista`, r && r.play > 0 && r.vista.every((o) => o === 0),
      r ? `play up to ${r.play}, vista ${r.vista.length} frames, max ${Math.max(...r.vista)}` : 'no vista');
  }
  check(`${size}${q ? ' (glare)' : ''}: the vista's labels stay on screen`, r && r.off.length === 0, r ? r.off.slice(0, 4).join(', ') : 'no vista');
  check(`${size} vista: no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- portrait: daily, practice, resume, camera, settings
{
  rep.section('portrait');
  const { page, errors, ctx, W, H } = await open(browser, 'portrait');
  await R(page, (m) => window.__race.setMeta(m), meta1);
  await wait(300);
  const day = await R(page, () => window.__race.daily());
  await tap(page, '[data-act="daily"]');
  await waitMode(page, 'play', 5000).catch(() => {});
  let run = await R(page, () => window.__race.run());
  check('portrait: the DAILY chip flies the day\'s seed', run && String(run.seed) === String(day.seed) && run.daily === day.date,
    `${run && run.seed} against ${day.seed}`);
  await R(page, () => window.__race.restart());
  run = await R(page, () => window.__race.run());
  check('portrait: AGAIN on a daily flies the day\'s seed again', String(run.seed) === String(day.seed) && run.daily === day.date, `${run.seed}`);
  await page.goto(BASE + '?daily=1');
  await page.waitForFunction(() => window.__race && window.__race.state().frames > 2);
  await tap(page, '#go');
  await waitMode(page, 'play', 5000).catch(() => {});
  run = await R(page, () => window.__race.run());
  check('portrait: ?daily=1 flies the day\'s seed', String(run.seed) === String(day.seed), `${run.seed}`);

  // a saved run, then PRACTICE: the save stays the real run's
  await page.goto(BASE);
  await page.waitForFunction(() => window.__race && window.__race.state().frames > 2);
  await tap(page, '#go');
  await waitMode(page, 'play', 5000).catch(() => {});
  await wait(300);
  await tap(page, '#pause');
  await wait(350);
  await tap(page, '[data-act="quit"]');
  await waitMode(page, 'title', 3000).catch(() => {});
  const seedA = await savedSeed(page);
  const goOn = () => R(page, () => (document.querySelector('[data-act="resume-save"]') || {}).textContent || null);
  const line0 = await goOn();
  await tap(page, '[data-act="practice"]');
  await wait(300);
  await tap(page, '[data-act="practice-leg"][data-i="0"]');
  await waitMode(page, 'play', 5000).catch(() => {});
  check('portrait: starting PRACTICE keeps the saved run', seedA && (await savedSeed(page)) === seedA, `${seedA} → ${await savedSeed(page)}`);
  await tap(page, '#pause');
  await wait(350);
  await tap(page, '[data-act="quit"]');
  await waitMode(page, 'title', 3000).catch(() => {});
  check('portrait: quitting PRACTICE keeps the saved run and its GO ON', (await savedSeed(page)) === seedA && (await goOn()) === line0,
    `${await savedSeed(page)}, ${await goOn()}`);
  await tap(page, '[data-act="practice"]');
  await wait(300);
  await tap(page, '[data-act="practice-leg"][data-i="0"]');
  await waitMode(page, 'play', 5000).catch(() => {});
  const ended = await toResult(page);
  check('portrait: a practice leg played to its end keeps the saved run', ended && (await savedSeed(page)) === seedA, `${await savedSeed(page)}`);
  // AGAIN on the practice card replays that practice leg
  await wait(1100);
  await tap(page, '.s-result h2');
  await waitMode(page, 'play', 5000).catch(() => {});
  run = await R(page, () => window.__race.run());
  let s = await S(page);
  check('portrait: AGAIN on a practice card replays that practice leg', run && run.seen && run.seen.practice && run.leg === 0
    && !s.ranked && run.build.length === 0, JSON.stringify({ leg: run && run.leg, practice: run && run.seen && run.seen.practice, ranked: s.ranked }));
  // the real run, resumed on a page with a tuning key, is unranked
  await page.goto(BASE + '?gapcap=1');
  await page.waitForFunction(() => window.__race && window.__race.state().frames > 2);
  await tap(page, '[data-act="resume-save"]');
  await waitMode(page, 'play', 5000).catch(() => {});
  run = await R(page, () => window.__race.run());
  s = await S(page);
  check('portrait: a saved run resumed on a tuned page is unranked', run && String(run.seed) === seedA && !s.ranked && run.ranked === false,
    `seed ${run && run.seed}, state ${s.ranked}, run ${run && run.ranked}`);

  // the camera starts each leg at your ship
  await page.goto(BASE);
  await page.waitForFunction(() => window.__race && window.__race.state().frames > 2);
  await R(page, () => { window.__race.goto({ leg: 1, seed: 'ROLL' }); window.__race.input({ turn: 1 }); });
  await wait(2500);
  await R(page, () => window.__race.input({ turn: 0 }));
  const wound = (await S(page)).you.bearing;
  await R(page, () => window.__race.restart());
  await frames(page, 2);
  const ang = await R(page, () => {
    const d = window.__race.drawn(), l = window.__race.state().layout;
    if (!d || !d.wings) return null;
    return Math.atan2(d.wings.shield.x - l.cx, d.wings.shield.y - l.cy) * 180 / Math.PI;
  });
  check('portrait: after a leg that wound the bearing round, the next launch draws your ship at 6 o\'clock', ang !== null
    && Math.abs(ang) < 8, `bearing ${wound.toFixed(0)}, ship at ${ang && ang.toFixed(1)}°`);

  // REDUCED MOTION from Settings reaches the page and the scene at once, and goes back
  await R(page, () => window.__race.action('title'));
  await wait(300);
  const motion = () => R(page, () => ({ motion: document.documentElement.dataset.motion || '', reduced: window.__race.perf().reduced,
    go: getComputedStyle(document.querySelector('#title .go') || document.body).animationName }));
  await tap(page, '[data-act="settings"]');
  await wait(300);
  await tap(page, '[data-act="set"][data-key="reduced"]');
  await wait(100);
  await tap(page, '[data-act="back"]');
  await wait(200);
  let m = await motion();
  check('portrait: REDUCED MOTION on: the page and the scene take it at once', m.motion === 'reduced' && m.reduced === true && m.go === 'none', JSON.stringify(m));
  await tap(page, '[data-act="settings"]');
  await wait(300);
  await tap(page, '[data-act="set"][data-key="reduced"]');
  await wait(100);
  await tap(page, '[data-act="back"]');
  await wait(200);
  m = await motion();
  check('portrait: REDUCED MOTION off again: the pulses and the scene come back', m.motion === '' && m.reduced === false && m.go === 'pulse', JSON.stringify(m));

  // the break's ship is redrawn for a rotated screen
  if (await toBreak(page, 1, 'ROT')) {
    await wait(300);
    await page.setViewportSize({ width: H, height: W });
    await wait(400);
    const cv = await R(page, () => { const c = document.querySelector('.shipcv'); const k = Math.min(2, devicePixelRatio || 1); return c && { w: c.width, cw: Math.round(c.clientWidth * k), h: c.height, ch: Math.round(c.clientHeight * k) }; });
    check('portrait → landscape at a break: the ship picture is redrawn for its new box', cv && Math.abs(cv.w - cv.cw) <= 1 && Math.abs(cv.h - cv.ch) <= 1, JSON.stringify(cv));
    await page.setViewportSize({ width: W, height: H });
  } else check('portrait: a leg played to its gate opens the break', false);
  check('portrait: no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- practice medals and URL options
// A practice leg earns medals only on a plain page (14.4, 20): ?bot= or any other option but seed and daily blocks
// them, as a tuning key does. The mid bot clears practice leg 1 in years that earn a medal (three tries), then the
// meta's medals are read.
{
  rep.section('practice medals');
  const pages = [['', true], ['?seed=4', true], ['?bot=mid', false], ['?barks=0', false], ['?gapcap=30', false]];
  for (const [query, want] of pages) {
    const { page, errors, ctx } = await open(browser, 'portrait', query);
    let r = null;
    for (let k = 0; k < 3 && !(r && r.earns); k++) {
      r = await R(page, async () => {
        const { medalFor } = await import(new URL('core/meta.js', location.href).href);
        const h = window.__race;
        h.setMeta({ ...h.meta(), medals: {} });
        h.action('practice-leg', { i: '0' });
        h.bot('mid');
        h.realtime(false);
        const tuned = h.run().tuned;
        for (let i = 0; i < 200 && ['play', 'ending'].includes(h.state().mode); i++) h.advance(2);
        const leg = (h.run().legs || [])[0] || {};
        const earns = leg.why === 'gate' ? medalFor('web', leg.years) : null;
        return { tuned, why: leg.why, years: leg.years, earns, medal: h.meta().medals.web || null,
          mode: h.state().mode };
      });
      await R(page, () => { window.__race.bot(null); window.__race.realtime(true); window.__race.action('title'); });
    }
    const tag = query || 'a plain page';
    check(`practice on ${tag}: ${want ? 'a cleared leg earns its medal' : 'a cleared leg earns no medal'}`,
      Boolean(r.earns) && r.tuned === !want && r.medal === (want ? r.earns : null), JSON.stringify(r));
    check(`practice on ${tag}: no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
}

// ---------------------------------------------------------------- short phone screens
// Upright (an iPhone SE in Safari is 375 × 553) and on its side (667 × 375, about 667 × 325 in Safari; 568 × 320).
const phone = (w, h) => ({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
const LONG = ['afterburner', 'twin-deflector', 'close-quarters', 'ablative-tanks'];     // the longest word and names
for (const [w, h] of [[375, 553], [360, 640], [320, 568], [667, 375], [667, 325], [568, 320]]) {
  const tag = `${w}x${h}`;
  rep.section(tag);
  const { page, errors, ctx } = await open(browser, phone(w, h));
  // the break, plain, with the dock strip, with the longest names and with 4 of them: SKIP is never under a card,
  // no card's text is cut at its bottom or its side, and a name breaks only at its space (4 cards side by side on a
  // screen under 760 px may break a word: a card is 101 px or less)
  if (await toBreak(page, 1, 'SHRT')) {
    const save = await R(page, () => window.__race.save());
    for (const kind of ['plain', 'dock', 'long', 'long4']) {
      const env = JSON.parse(save);
      if (kind === 'dock') { env.run.dock = { free: 1, bought: [] }; env.run.you.hull = 1; }
      if (kind.startsWith('long')) {
        const cards = env.run.offer.cards, n = kind === 'long4' ? 4 : 3;
        while (cards.length < n) cards.push({ ...cards[0], slot: cards.length });
        env.run.offer.cards = cards.slice(0, n).map((c, i) => ({ ...c, id: LONG[i] }));
      }
      await R(page, (j) => window.__race.load(j), JSON.stringify(env));
      await wait(900);
      const r = await R(page, () => {
        const skip = document.querySelector('[data-act="skip"]');
        skip.scrollIntoView({ block: 'nearest' });
        const b = skip.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        const box = (e) => {
          const rg = document.createRange();
          rg.selectNodeContents(e);
          return rg.getBoundingClientRect();
        };
        const cards = [...document.querySelectorAll('.s-break .card')];
        const cut = cards.filter((c) => {
          const B = c.getBoundingClientRect();
          return c.scrollWidth > c.clientWidth + 1 || [...c.querySelectorAll('.ctitle, .cfx, .ctag')].some((e) => {
            const a = box(e);
            return e.getBoundingClientRect().bottom > B.bottom + 1 || a.bottom > B.bottom + 1 || a.right > B.right + 1;
          });
        }).map((c) => c.querySelector('.ctitle').textContent);
        // a word of a name on two lines
        const split = [];
        for (const c of cards) {
          const tn = c.querySelector('.ctitle').firstChild;
          let at = 0;
          for (const wd of tn ? tn.textContent.split(' ') : []) {
            const rg = document.createRange();
            rg.setStart(tn, at); rg.setEnd(tn, at + wd.length);
            if (new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size > 1) split.push(wd);
            at += wd.length + 1;
          }
        }
        return { hit: Boolean(hit && hit.closest('[data-act="skip"]')), inView: b.top >= 0 && b.bottom <= innerHeight, cut,
          split, cards: cards.length, w: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0 };
      });
      const what = { plain: '', dock: ' with the dock strip', long: ' with the longest names',
        long4: ' with 4 long names' }[kind];
      const splitOk = r.split.length === 0 || (kind === 'long4' && w > h && w < 760);
      check(`${tag}: the break${what}: SKIP takes its own tap, no card's text is cut and a name breaks at its space`,
        r.hit && r.inView && r.cut.length === 0 && splitOk, JSON.stringify(r));
    }
  } else check(`${tag}: a leg played to its gate opens the break`, false);
  // the title of a returning player with every chip: the name stays on screen and clear of ‹ Arcade
  const best = { home: true, years: 21.4, legNo: 7 };
  await R(page, (m) => window.__race.setMeta(m), { ...meta1, runs: 6, redshift: { open: 2, level: 0 }, records: { best, byShip: {} },
    easy: { offered: true, on: false, early: 3 } });
  await R(page, () => { window.__race.goto({ leg: 3, seed: 'TTL' }); window.__race.save(); window.__race.action('title'); });
  await wait(400);
  const t = await R(page, () => {
    const h1 = document.querySelector('#title h1').getBoundingClientRect(), a = document.querySelector('#title .back').getBoundingClientRect();
    const chips = document.querySelectorAll('#title .chip').length;
    return { top: Math.round(h1.top), backBottom: Math.round(a.bottom), clear: h1.top >= a.bottom - 1 || h1.left >= a.right, chips };
  });
  check(`${tag}: the title with ${t.chips} chips keeps its name on screen and clear of ‹ Arcade`, t.top >= 0 && t.clear, JSON.stringify(t));
  // the widest bark fits the screen
  const cap = await R(page, () => {
    const el = document.getElementById('captions');
    el.innerHTML = '<span class="tag">HOUND ·</span>SMELL YOU, ROOKIE.';
    el.style.visibility = 'visible';
    const rg = document.createRange(); rg.selectNodeContents(el);
    const b = rg.getBoundingClientRect();
    el.innerHTML = ''; el.style.visibility = '';
    return { left: Math.round(b.left), right: Math.round(b.right) };
  });
  check(`${tag}: the widest caption chunk stays on screen`, cap.left >= 0 && cap.right <= w, JSON.stringify(cap));
  // the landing caption after a missed DOOR (8.2): the HUD's own words for the land event, shown chunk by chunk by a
  // HUD of its own on the caption line, each chunk on screen
  const door = await R(page, async () => {
    const hud = await import(new URL('ui/hud.js', location.href).href);
    const el = document.getElementById('captions');
    const race = { leg: { type: 'earth', items: [] }, legNo: 7, ships: [{ id: 'you', dist: 0 }], t: 60 };
    const out = [];
    for (const ok of [false, true]) {
      const ctx = { race, mem: hud.createCaptionMemory(), runs: 5, desk: false, toy: false, fires: [], prevDist: 0 };
      const c = hud.captionsFor([{ type: 'land', ship: 'you', ok, miss: true }], ctx).find((x) => x.type === 'land');
      const h = hud.createHud({ captions: el });
      h.say(c.text, { pri: c.pri, type: c.type });
      el.style.visibility = 'visible';
      let prev = '';
      for (let t = 0; t < 5 && h.caption; t += 0.05) {
        if (el.innerHTML !== prev) {
          prev = el.innerHTML;
          const rg = document.createRange(); rg.selectNodeContents(el);
          const b = rg.getBoundingClientRect();
          if (b.width > 0) out.push({ text: c.text, chunk: el.textContent, left: Math.round(b.left), right: Math.round(b.right) });
        }
        h.frame(0.05);
      }
      h.clearCaptions();
    }
    el.innerHTML = ''; el.style.visibility = '';
    return out;
  });
  const chunks = [...new Set(door.map((d) => d.chunk))];
  check(`${tag}: a missed DOOR's landing caption says so first, and each of its chunks stays on screen`,
    door.length > 0 && door.every((d) => d.text.startsWith('MISSED THE DOOR · ') && d.left >= 0 && d.right <= w)
      && ['MISSED THE DOOR', 'HOME'].every((c) => chunks.includes(c)) && chunks.some((c) => /DOORSTEP/.test(c)),
    JSON.stringify({ chunks, widest: door.reduce((m, d) => Math.max(m, d.right - d.left), 0), bad: door.filter((d) => d.left < 0 || d.right > w) }));
  check(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- a missed DOOR through the real ending
// Earth's leg from just before its DOOR with your bearing far off the DOOR's arc, on the page's own clock: the result
// card waits until the landing caption's last chunk has shown, home and caught on the doorstep (?lands=30, a landing
// that needs more than you have), with Slow captions too
for (const [label, q, slow, want] of [['home', '', false, ['MISSED THE DOOR', 'HOME']],
  ['doorstep', '?lands=30', false, ['MISSED THE DOOR', 'CAUGHT ON', 'THE DOORSTEP']],
  ['doorstep with Slow captions', '?lands=30', true, ['MISSED THE DOOR', 'CAUGHT ON', 'THE DOORSTEP']]]) {
  rep.section(`missed DOOR ending: ${label}`);
  const { page, errors, ctx } = await open(browser, 'portrait', q);
  if (slow) {
    // Slow captions is a setting: saved in the meta, read as the page loads
    await R(page, () => {
      const h = window.__race, m = h.meta();
      m.settings = { ...(m.settings || {}), slowCaptions: true };
      h.setMeta(m);
    });
    await page.reload();
    await page.waitForFunction(() => window.__race && window.__race.state().frames > 2, null, { timeout: 60000 });
  }
  const end = await R(page, async () => {
    const h = window.__race;
    h.goto({ leg: 'earth', seed: 'DOORQ' });
    h.goto({ leg: 'earth', seed: 'DOORQ', beat: h.leg().gate.beat - 3 });
    h.bot(null);
    h.input({ target: h.leg().gate.psi + 120 });
    const el = document.getElementById('captions'), seen = [];
    let land = null, landAt = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 20000 && h.state().mode !== 'result') {
      await new Promise((r) => requestAnimationFrame(r));
      if (!land && (land = h.events(20).find((e) => e.type === 'land') || null)) landAt = performance.now();
      const txt = (el.textContent || '').trim();
      if (land && txt && (!seen.length || seen[seen.length - 1].text !== txt)) {
        seen.push({ text: txt, ms: Math.round(performance.now() - landAt) });
      }
    }
    return { land, seen, mode: h.state().mode, cardMs: Math.round(performance.now() - landAt) };
  });
  const shown = end.seen.map((x) => x.text);
  check(`missed DOOR ending, ${label}: every chunk of the landing caption shows before the result card`,
    end.mode === 'result' && Boolean(end.land && end.land.miss) && end.land.ok === (label === 'home')
      && want.every((c) => shown.includes(c)), JSON.stringify(end));
  check(`missed DOOR ending, ${label}: no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- the ring layer's labels, frame by frame
for (const size of ['portrait', 'landscape', 'desktop']) {
  rep.section(`${size} labels`);
  const { page, errors, ctx } = await open(browser, size);
  const tally = { frames: 0, marks: 0, light: 0, wings: 0, hud: 0, first: { marks: [], light: [], wings: [], hud: [] } };
  for (const leg of [1, 4, 6, 8]) {
    await R(page, ({ leg, size }) => { const r = window.__race; r.goto({ leg, seed: 'LBL' + leg + size }); r.bot('mid'); r.realtime(false); }, { leg, size });
    for (let i = 0; i < 100; i++) {
      const st = await S(page);
      if (st.mode !== 'play') break;
      await R(page, () => window.__race.advance(0.25));
      await frames(page, 1);
      const f = await R(page, () => {
        const d = window.__race.drawn();
        if (!d) return null;
        const ov = (a, b, m = 0) => a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
        const sq = (x, y, s) => ({ x: x - s / 2, y: y - s / 2, w: s, h: s });
        const wings = d.wings ? [...d.wings.hull.map((p) => sq(p.x, p.y, p.size)), ...d.wings.fuel.map((p) => sq(p.x, p.y, p.size)),
          sq(d.wings.shield.x, d.wings.shield.y, d.wings.shield.r * 2)] : [];
        const hud = ['speed', 'land', 'place', 'pause'].map((id) => document.getElementById(id))
          .filter((e) => e && e.textContent.trim() !== '' || (e && e.id === 'pause')).map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
        const marks = d.marks.map((m) => m.box).filter(Boolean);
        let mk = 0;
        for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) if (ov(marks[i], marks[j])) mk++;
        const light = d.lightLabel ? d.labels.filter((l) => ov(l, d.lightLabel)).length : 0;
        const wing = d.labels.filter((l) => wings.some((b) => ov(l, b))).length;
        const hu = d.labels.filter((l) => hud.some((b) => ov(l, b))).length;
        return { mk, light, wing, hu, t: window.__race.state().t };
      });
      if (!f) continue;
      tally.frames++;
      for (const [k, n] of [['marks', f.mk], ['light', f.light], ['wings', f.wing], ['hud', f.hu]]) {
        if (!n) continue;
        tally[k] += n;
        if (tally.first[k].length < 3) tally.first[k].push(`leg ${leg} t ${f.t.toFixed(1)}`);
      }
    }
    await R(page, () => { window.__race.bot(null); window.__race.realtime(true); });
  }
  check(`${size}: landmark labels never sit on each other (${tally.frames} frames)`, tally.marks === 0, `${tally.marks}; ${tally.first.marks.join(', ')}`);
  check(`${size}: rival labels clear of the light's label, your wings and the HUD`, tally.light + tally.wings + tally.hud === 0,
    `light ${tally.light} (${tally.first.light.join(', ')}), wings ${tally.wings} (${tally.first.wings.join(', ')}), hud ${tally.hud} (${tally.first.hud.join(', ')})`);
  check(`${size} labels: no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
}
await browser.close();
rep.done();
