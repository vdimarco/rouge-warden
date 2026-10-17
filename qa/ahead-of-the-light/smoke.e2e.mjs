// Ahead of the Light in a browser, at 390 × 844 touch, 844 × 390 touch and 1440 × 900 (final.md 22.1): the title, a
// tap and steering within 1.5 s, a whole run by the mid bot through window.__race (sped up with advance, the picture
// spot-checked every leg), every leg of the route by goto, the result card, AGAIN back to steering within 1.5 s, and
// the home card, with no page error, console error, failed request, NaN or broken text anywhere.
//   NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/smoke.e2e.mjs      (the site served on 8765)
import { launch, open, reporter, sizeList, S, R, wait, waitMode, synth, drag, holdKey, badText, overlayPixels,
  layoutFaults, faultCount, faultText, botRun } from './e2e-lib.mjs';

const rep = reporter('Ahead of the Light: smoke');
const { check } = rep;
const LEGS = ['web', 'coma', 'virgo', 'local', 'milkyway', 'orion', 'neighbours', 'earth'];

// The picture now: the scene's draw calls and points, the overlay's drawn pixels, and any NaN or broken text.
async function spot(page, tag) {
  await R(page, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const p = await R(page, () => window.__race.perf());
  const px = await overlayPixels(page);
  const bad = await badText(page);
  const ok = (p.fallback || (p.drawCalls > 0 && p.points > 1000)) && px > 200 && bad.length === 0;
  return { ok, detail: `${tag}: ${p.drawCalls} calls, ${p.points} points, ${px} overlay px${bad.length ? ', ' + bad.join(' | ') : ''}` };
}

// Steer now with this layout's own input, and wait for the bearing to move. → ms from `from` (or null).
async function steerNow(page, size, W, H, from) {
  const b0 = (await S(page)).you.bearing;
  if (size === 'desktop') await holdKey(page, 'ArrowLeft', 250);
  else await synth(page, drag(W / 2, H * 0.78, -60, 0, { n: 6, gap: 20 }));
  for (let i = 0; i < 40; i++) {
    const s = await S(page);
    if (s.you && Math.abs(s.you.bearing - b0) > 3) return Date.now() - from;
    await wait(25);
  }
  return null;
}

const browser = await launch();
for (const size of sizeList()) {
  rep.section(`${size}`);
  const { page, errors, W, H, ctx } = await open(browser, size);
  const desk = size === 'desktop';

  // ---- the title
  await wait(600);
  const title = await R(page, () => {
    const t = document.getElementById('title');
    const h1 = t && t.querySelector('h1'), span = h1 && h1.querySelector('span');
    const go = document.getElementById('go');
    const shown = (el) => el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none';
    return { open: Boolean(t && !t.hidden), name: h1 ? h1.textContent.trim() : '', light: span ? getComputedStyle(span).color : '',
      go: go ? [...go.querySelectorAll('span')].filter(shown).map((s) => s.textContent).join('') : '',
      back: Boolean(document.querySelector('#title a.back[href="/"]')), sw: Boolean(document.querySelector('#title [data-switch]')),
      mode: window.__race.state().mode, input: document.documentElement.dataset.input };
  });
  check(`${size}: the title shows AHEAD OF THE LIGHT with LIGHT in orange`, title.open && title.name === 'AHEAD OF THE LIGHT'
    && title.light === 'rgb(240, 138, 44)', `${title.name}, ${title.light}`);
  check(`${size}: the title says ${desk ? 'CLICK OR PRESS SPACE' : 'TAP TO FLY'}`, title.go === (desk ? 'CLICK OR PRESS SPACE' : 'TAP TO FLY'), title.go);
  check(`${size}: the title has a back link to the arcade and the game switcher`, title.back && title.sw);
  const st0 = await S(page);
  check(`${size}: WebGL starts (tier ${st0.tier}), no stand-in`, !st0.fallback);

  // ---- a tap, and steering within 1.5 s
  const t0 = Date.now();
  if (desk) await page.keyboard.press('Space');
  else await page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(page, 'play', 5000).catch(() => {});
  const playMs = Date.now() - t0;
  const steerMs = await steerNow(page, size, W, H, t0);
  check(`${size}: ${desk ? 'Space' : 'a tap'} starts the run and you steer within 1.5 s`, steerMs !== null && steerMs <= 1500,
    `play in ${playMs} ms, the bearing moved ${steerMs} ms after the ${desk ? 'key' : 'tap'}`);
  let sp = await spot(page, 'first seconds');
  check(`${size}: the first seconds draw the sky and the ring`, sp.ok, sp.detail);

  // ---- a whole run by the mid bot, spot-checked at every leg
  const spots = [];
  const res = await botRun(page, { bot: 'mid', chunk: 3, onLeg: async (p, s) => {
    await R(p, () => window.__race.advance(4));
    if ((await S(p)).mode === 'play') spots.push(await spot(p, `leg ${s.leg + 1} ${s.type}`));
  }, onBreak: async (p) => {
    const f = await layoutFaults(p);
    if (faultCount(f)) spots.push({ ok: false, detail: `break: ${faultText(f)}` });
  } });
  const bad = spots.filter((x) => !x.ok);
  check(`${size}: the mid bot plays a whole run to its result card (${res.legs.map((l) => l.type).join(', ')}; ${res.phase})`,
    res.mode === 'result' && (res.phase === 'caught' || res.phase === 'home'), `mode ${res.mode}`);
  check(`${size}: every leg of that run draws (${spots.length} spot checks)`, spots.length >= res.legs.length && bad.length === 0,
    bad.map((x) => x.detail).join('; ') || spots.map((x) => x.detail).join('; '));
  await wait(1100);
  const card = await R(page, () => {
    const el = document.querySelector('#screens .s-result');
    return el ? { text: el.innerText.replace(/\s+/g, ' ').slice(0, 160), again: Boolean(el.querySelector('[data-act="again"]')) } : null;
  });
  check(`${size}: the result card shows with AGAIN`, Boolean(card && card.again), card ? card.text : 'no card');
  let f = await layoutFaults(page);
  check(`${size}: the result card fits the screen (tap targets, text, overflow)`, faultCount(f) === 0, faultText(f));
  check(`${size}: no NaN or broken text on the result card`, (await badText(page)).length === 0, (await badText(page)).join(' | '));

  // ---- AGAIN: back to steering within 1.5 s
  await R(page, () => window.__race.bot(null));
  const t1 = Date.now();
  if (desk) await page.keyboard.press('Enter');
  else await page.touchscreen.tap(W / 2, H * 0.12);
  await waitMode(page, 'play', 5000).catch(() => {});
  const again = await steerNow(page, size, W, H, t1);
  const retry = await R(page, () => window.__race.timing().lastRetryMs);
  check(`${size}: AGAIN is back to steering within 1.5 s`, again !== null && again <= 1500, `steering ${again} ms after the ${desk ? 'key' : 'tap'}, first step ${Math.round(retry)} ms after AGAIN`);

  // ---- every leg of the route by goto: 10 s of the mid bot each
  const legBad = [];
  for (let i = 0; i < LEGS.length; i++) {
    await R(page, (i) => { window.__race.goto({ leg: i + 1, seed: 'SMOKE' + i }); window.__race.bot('mid'); }, i);
    const L = await R(page, () => window.__race.leg());
    await R(page, () => window.__race.advance(10));
    const s = await S(page);
    const x = s.mode === 'play' ? await spot(page, LEGS[i]) : { ok: s.mode === 'result', detail: `${LEGS[i]}: ${s.mode}` };
    if (L.type !== LEGS[i] || !x.ok) legBad.push(`${LEGS[i]} (${L.type}): ${x.detail}`);
  }
  check(`${size}: every leg of the route builds and draws (goto, 10 s of the mid bot each)`, legBad.length === 0, legBad.join('; '));

  // ---- home: Earth's last stretch with the mid bot, then the home card
  await R(page, () => { window.__race.goto({ leg: 'earth', beat: 92, seed: 'SMOKEH' }); window.__race.bot('mid'); });
  for (let i = 0; i < 80 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
  await waitMode(page, 'result', 20000).catch(() => {});
  await wait(1100);
  const run = await R(page, () => window.__race.run());
  const home = await R(page, () => (document.querySelector('#screens .s-result') || {}).innerText || '');
  check(`${size}: Earth's landing ends the run at the home card`, run && run.phase === 'home' && /HOME/.test(home),
    `${run && run.phase}: ${home.replace(/\s+/g, ' ').slice(0, 120)}`);
  f = await layoutFaults(page);
  check(`${size}: the home card fits the screen`, faultCount(f) === 0, faultText(f));

  check(`${size}: no page errors, console errors or failed requests`, errors.length === 0, errors.slice(0, 6).join(' | '));
  await ctx.close();
}
await browser.close();
rep.done();
