// Light Years Home v3 in a browser: discovery (final.md 19, discovery.e2e). A scan turns a dotted ring into the
// video's solid ring with a label (a pixel check round project(id) on the overlay canvas); the scale card shows on
// arrival for about 4 s; a tap on the radar opens the log's MAP; the home chevron points the right way after a
// teleport.
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/discovery.e2e.mjs [desk] [por] [land]
import { launch, open, play, hook, check, summary, sizesFromArgs, SIZES, wait, touches, mid, errorCheck } from './browser.mjs';
import WALL from '../../../public/light-years-home/core/world/zones/wall.js';
import { OBJECTS } from '../../../public/light-years-home/core/objects.js';
import { zoneFrame } from '../../../public/light-years-home/core/frame.js';

const DONE = { v: 1, chapter: 1, zoneId: 'wall', missions: { 'which-way-home': { done: true, beat: 3 } } };

// The share of a circle's pixels the overlay drew on (a dotted ring is about a third, a solid one nearly all).
function coverage(page, id) {
  return page.evaluate((id) => {
    const p = window.__lyh.project(id);
    const c = document.getElementById('overlay');
    if (!p || !p.onScreen) return null;
    const k = c.width / innerWidth;
    const r = Math.max(14, Math.min(p.r, Math.min(innerWidth, innerHeight) * 0.42));
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0, n = 0;
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      let best = 0;
      for (let dr = -2; dr <= 2; dr++) {
        const x = Math.round((p.x + (r + dr) * Math.cos(a)) * k), y = Math.round((p.y + (r + dr) * Math.sin(a)) * k);
        if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
        best = Math.max(best, img[(y * c.width + x) * 4 + 3]);
      }
      if (p.x + r * Math.cos(a) < 0 || p.y + r * Math.sin(a) < 0 || p.x + r * Math.cos(a) > innerWidth
        || p.y + r * Math.sin(a) > innerHeight) continue;
      n++;
      if (best > 60) lit++;
    }
    return { share: n ? lit / n : 0, n, r };
  }, id);
}

async function scanCheck(page) {
  // Drive at Node 0 (a ring of 40 u) with the opening's no-scan time past.
  await hook(page, 'start', { zone: 'wall', skipIntro: true, save: DONE, at: [0, -420, 0], heading: 0, speed: 24 });
  await hook(page, 'freeze', true);
  await hook(page, 'step', { brake: 1 }, 12.5);
  await hook(page, 'teleport', [0, -260, 0], 0, 24);
  let before = null, after = null;
  for (let i = 0; i < 200 && !after; i++) {
    await hook(page, 'step', null, 1 / 30);
    const st = await hook(page, 'scan', 'node0');
    if (st === 'seen' && !before) {
      const c = await coverage(page, 'node0');
      if (c && c.n > 60) before = c;
    }
    if (st === 'scanned') {
      // Back off to where the ring is small enough to keep its label (a scanned ring right round you is not drawn).
      await hook(page, 'teleport', [0, -300, 0], 0, 20);
      await hook(page, 'step', { brake: 1 }, 1.2);          // the scan's callout has gone
      for (let k = 0; k < 6; k++) await hook(page, 'step', { brake: 1 }, 1 / 60);
      after = await coverage(page, 'node0');
    }
  }
  check('an unscanned target shows a dotted ring', before && before.share > 0.12 && before.share < 0.62,
    before ? `${Math.round(before.share * 100)}% of the circle drawn` : 'not seen on screen');
  check('a scan turns it into a solid ring', after && after.share > 0.8,
    after ? `${Math.round(after.share * 100)}% of the circle drawn` : 'not scanned');
  const ov = await hook(page, 'overlay');
  check('the scanned ring has its label', ov.labels.some((l) => l.text === 'NODE 0'), ov.labels.map((l) => l.text).join(', '));
  await hook(page, 'live');
}

async function scaleCardCheck(page) {
  await hook(page, 'start', { zone: 'wall', skipIntro: true, save: DONE, at: [200, -330, 0], heading: 0, speed: 24 });
  await hook(page, 'freeze', true);
  let first = null, last = null;
  for (let t = 0; t < 8; t += 0.1) {
    await hook(page, 'step', null, 0.1);
    const txt = await page.evaluate(() => {
      const el = document.querySelector('.lyh-hud .h-info');
      return el && !el.hidden ? el.textContent : '';
    });
    if (/EACH POINT HERE IS A GALAXY/.test(txt)) { if (first === null) first = t; last = t; }
  }
  const dur = first === null ? 0 : last - first + 0.1;
  check('the scale card shows on arrival for about 4 s', first !== null && first >= 0.7 && first <= 1.5 && dur >= 3.4 && dur <= 4.6,
    first === null ? 'never shown' : `from ${first.toFixed(1)} s for ${dur.toFixed(1)} s`);
  await hook(page, 'live');
}

async function radarCheck(page, size) {
  await hook(page, 'start', { zone: 'wall', skipIntro: true, save: DONE, at: [200, -330, 0], heading: 0, speed: 24 });
  await hook(page, 'live');
  const L = await hook(page, 'layout');
  const [x, y] = mid(L.rects.radar);
  if (SIZES[size].hasTouch) {
    const t = await touches(page);
    await t.tap(5, x, y);
  } else {
    await page.mouse.click(x, y);
  }
  let mode = null;
  for (let i = 0; i < 30 && mode !== 'log'; i++) { await wait(100); mode = await hook(page, 'mode'); }
  const tab = await page.evaluate(() => document.querySelector('.lyh-log [data-tab="map"]')?.getAttribute('aria-selected'));
  const shown = await page.evaluate(() => !document.querySelector('.lyh-log').hidden);
  check('a tap on the radar opens the log on its MAP tab', mode === 'log' && shown && tab === 'true', `${mode} · map ${tab}`);
  // Esc closes it on keys; the × closes it on touch.
  if (SIZES[size].hasTouch) await page.tap('.lyh-log .l-close').catch(() => {});
  else await page.keyboard.press('Escape');
  for (let i = 0; i < 40 && mode !== 'drive'; i++) { await wait(100); mode = await hook(page, 'mode'); }
  check(`the log closes back to driving (${SIZES[size].hasTouch ? 'the × button' : 'Esc'})`, mode === 'drive', mode);
}

// Earth's map bearing from the Wall, as render/backdrop.js dirOf works it out.
function earthBearing() {
  const f = zoneFrame(WALL);
  const a = OBJECTS[WALL.object].pos, b = OBJECTS.earth.pos;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(...d);
  const m = f.toMap(d.map((x) => x / l), [0, 0, 0]);
  return Math.atan2(m[0], m[1]) * 180 / Math.PI;
}

async function homeCheck(page) {
  const b = earthBearing();
  await hook(page, 'start', { zone: 'wall', skipIntro: true, save: DONE, at: [200, -330, 0], heading: 0, speed: 24 });
  await hook(page, 'freeze', true);
  const side = async (heading) => {
    await hook(page, 'teleport', [200, -330, 0], heading, 24);
    for (let i = 0; i < 20; i++) await hook(page, 'step', null, 1 / 60);
    const c = (await hook(page, 'overlay')).chevrons.find((x) => x.id === 'home');
    return c ? c.x - (await page.evaluate(() => innerWidth)) / 2 : null;
  };
  const left = await side(b + 90), right = await side(b - 90);
  check('after a teleport the home chevron points the right way', left !== null && right !== null && left < 0 && right > 0,
    `Earth at ${b.toFixed(0)}°: left ${left?.toFixed(0)} px, right ${right?.toFixed(0)} px from the centre`);
  await hook(page, 'live');
}

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`discovery · ${SIZES[size].name}`);
  const { ctx, page, errors } = await open(browser, size);
  await play(page, size);
  await wait(400);
  await scanCheck(page);
  await scaleCardCheck(page);
  await radarCheck(page, size);
  await homeCheck(page);
  errorCheck(errors, size);
  await ctx.close();
}
await browser.close();
summary();
