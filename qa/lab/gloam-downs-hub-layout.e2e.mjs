// Gloam Downs: the Lamp-room's cards at the six layouts (openspec/changes/gloam-downs-hub "Decision 6"), on software WebGL 2:
//   at 320x640, 390x844, 360x640, 844x390 (touch), 800x600 and 1280x720 (mouse): the use prompt, three station cards (the lamp shelf,
//   the kiln, the map table) and the quick list: a bottom sheet of 55% of the height or less on an upright phone, a side sheet of 45%
//   of the width or less on a landscape phone, beside the station elsewhere and never over it; inside the screen, under the Lab bar,
//   buttons of 44 px or more, no page scroll, no text wider than its row; the prompt inside the screen and clear of the touch buttons;
//   with reduced motion the hall's life holds still and a card shows with no motion.
// Needs this tree served:   python3 -m http.server 8951 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-hub-layout.e2e.mjs   (SITE_URL, SHOTS=<dir> keeps the pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8951').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const SIZES = [[320, 640, true, 'sheet'], [390, 844, true, 'sheet'], [360, 640, true, 'sheet'], [844, 390, true, 'side'], [800, 600, false, 'beside'], [1280, 720, false, 'beside']];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
function faults(kind) {
  const R = el => el.getBoundingClientRect(), box = document.querySelector('#lamp .box'), r = R(box), out = [];
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push('box outside the screen');
  const lab = [document.querySelector('.labbar .back'), document.getElementById('menu')].filter(Boolean).map(R);
  if (lab.some(l => over(r, l))) out.push('over the Lab bar');
  if (kind === 'sheet' && r.height > innerHeight * 0.55 + 1) out.push(`sheet ${r.height.toFixed(0)} px tall`);
  if (kind === 'side' && r.width > innerWidth * 0.45 + 1) out.push(`side ${r.width.toFixed(0)} px wide`);
  if (kind === 'beside' && r.width > 361) out.push(`beside ${r.width.toFixed(0)} px wide`);
  for (const b of box.querySelectorAll('button')) {
    if (b.hidden || !b.getClientRects().length || b.closest('.stOff')) continue;
    b.scrollIntoView({ block: 'nearest' });
    const q = R(b);
    if (Math.min(q.width, q.height) < 44 - 0.01) out.push(`${b.id || b.textContent.trim().slice(0, 20)} ${q.width.toFixed(0)}x${q.height.toFixed(0)}`);
    if (q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5) out.push(`${b.id || b.textContent.trim().slice(0, 20)} out of its card`);
  }
  for (const el of box.querySelectorAll('h2, h3, p, li > span')) if (el.getClientRects().length && !el.closest('.stOff') && el.scrollWidth > el.clientWidth + 1) out.push(`text wider than its row: ${el.textContent.trim().slice(0, 30)}`);
  box.scrollTop = 0;
  if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls');
  return out;
}
function promptFaults() {
  const R = el => el.getBoundingClientRect(), p = document.getElementById('bUse'), r = R(p), out = [];
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  if (p.hidden) return ['no prompt'];
  if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push('outside the screen');
  if (r.height < 44) out.push(`${r.height} px tall`);
  for (const b of document.querySelectorAll('.act, .jump, #mouseHint, .hud')) if (!b.hidden && b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden' && over(r, R(b))) out.push(`over ${b.id || b.className}`);
  return out;
}
try {
  for (const [w, h, touch, kind] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('s')) { localStorage.setItem('gloam-downs.run.v3', JSON.stringify({ seen: true, bank: 900, patterns: ['lash', 'cinder', 'hook'], unlocks: ['shelf'], emberTop: 2, keys: ['leap'] })); sessionStorage.setItem('s', 1); } } catch {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&hall`);
    await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'lamproom', null, { timeout: 180000 });
    await G(page, () => window.__gloam.tick(3.6, {}));
    if (SHOTS) { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/hall-${w}x${h}.png` }); }
    const out = {};
    for (const id of ['shelf', 'kiln', 'map']) {
      const st = (await G(page, () => window.__gloam.hall())).stations.find(s => s.id === id), yaw = Math.atan2(st.obj[0] - st.at[0], st.obj[1] - st.at[1]);
      await G(page, ([x, z, y]) => window.__gloam.teleport(x, z, y), [st.at[0], st.at[1], yaw]);
      await G(page, () => window.__gloam.tick(0.6, {}));
      assert.deepEqual(await G(page, promptFaults), [], `${w}x${h} ${id}: the prompt`);
      if (SHOTS && id === 'shelf') { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/prompt-${w}x${h}.png` }); }
      await G(page, () => window.__gloam.use());
      const hv = await G(page, () => window.__gloam.hall());
      assert.deepEqual([hv.station, hv.layout], [id, kind], `${w}x${h} ${id}`);
      assert.deepEqual(await G(page, faults, kind), [], `${w}x${h} ${id}`);
      // beside: never over the station's object
      if (kind === 'beside') {
        const p = await G(page, s => window.__gloam.project([s.obj[0], s.y + 1.3, s.obj[1]]), st), r = await page.$eval('#lamp .box', b => b.getBoundingClientRect().toJSON());
        assert(!(p[0] > r.left && p[0] < r.right && p[1] > r.top && p[1] < r.bottom), `${w}x${h} ${id}: the card over its station`);
      }
      // a sheet: the station's object shows above it (the follow camera already frames it there, so play.js's camera is not moved)
      if (kind === 'sheet') {
        const p = await G(page, s => window.__gloam.project([s.obj[0], s.y + 1.3, s.obj[1]]), st), r = await page.$eval('#lamp .box', b => b.getBoundingClientRect().toJSON());
        assert(p && p[1] < r.top && p[1] > 60, `${w}x${h} ${id}: the station (${p}) above the sheet (top ${r.top})`);
      }
      if (SHOTS) { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${id}-${w}x${h}.png` }); }
      out[id] = await page.$eval('#lamp .box', b => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
      await page.keyboard.press('Escape');
      await G(page, () => window.__gloam.tick(0.1, {}));
    }
    await G(page, () => window.__gloam.quick());
    assert.deepEqual(await G(page, faults, 'quick'), [], `${w}x${h} quick list`);
    if (SHOTS) { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/quick-${w}x${h}.png` }); }
    assert.deepEqual(errors, []);
    pass(`${w}x${h}: the prompt, the shelf, kiln and map cards (${kind}) and the quick list fit`, out);
    await ctx.close();
  }
  { // reduced motion: the hall's life holds still and a card shows with no motion
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&hall&fresh`);
    await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'lamproom', null, { timeout: 180000 });
    const life = await G(page, () => window.__gloam.life?.() ?? null);
    const st = (await G(page, () => window.__gloam.hall())).stations.find(s => s.id === 'well');
    await G(page, ([x, z, y]) => window.__gloam.teleport(x, z, y), [st.at[0], st.at[1], -Math.PI / 2]);
    await G(page, () => window.__gloam.tick(0.3, {}));
    await G(page, () => window.__gloam.use());
    const anim = await G(page, () => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.closest?.('#lamp')).length);
    assert.equal(anim, 0, 'a card moves under reduced motion');
    if (life) assert(!life.kinds || Object.keys(life.kinds).every(k => ['0', '7'].includes(k)), `life moves: ${JSON.stringify(life.kinds)}`);
    pass('reduced motion: the well\'s card shows with no motion, and the hall\'s life is still or a soft glow', { life: life?.kinds ?? 'not exposed' });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`PASS qa/lab/gloam-downs-hub-layout.e2e.mjs: ${n} checks`);
