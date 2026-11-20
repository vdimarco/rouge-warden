// Gloam Downs' foes in a real browser (public/lab/gloam-downs/?run), on software WebGL 2: the figure files and each place's pool.
//   ?run builds the Gaol's pool of 5 Snuffer slots, every slot parked (off the bones); the explorer has no pool; ?run&test&lineup
//   stands one of each figure in front of the lamplighter (the four foes, the Barrow Reeve with its candles, the carried light), at
//   rest and held in the hook's wind-up, on a desktop and on a phone; and when the foe files do not load, the loading screen says so,
//   Try again takes the focus, and Enter on it loads them.
// Stage 1 of the combat run: the look e2e of the later stages measures the tells and the markers; this file keeps the pictures.
// Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs-run.lineup.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const LAMP = 5436; // the lamplighter's boned splats in every place
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
async function open(ctxOpts, query, route) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (route) await ctx.route(route.url, route.fn);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  return { ctx, page, errors };
}
const ready = page => page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
// the run opens on its help card: begin the run, so nothing covers the figures
async function begin(page, tap = false) {
  if (!(await page.isVisible('#runHelp'))) return;
  await (tap ? page.tap('#bBegin') : page.click('#bBegin'));
  assert.equal(await G(page, () => window.__gloam.run().mode), 'play');
}
// stand the lineup on open ground in the Gaol's yard, facing back toward the start, and draw it; `changed` is the share of art pixels
// that the figures change
const lineupAt = (page, o) => G(page, o => {
  const read = () => {
    window.__gloam.draw();
    const c = document.getElementById('view'), gl = c.getContext('webgl2'), px = new Uint8Array(c.width * c.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  };
  window.__gloam.teleport(1, 6, Math.PI);
  window.__gloam.tick(0.1, {});
  const before = read();
  const r = window.__gloam.lineup(o);
  const after = read(), p = window.__gloam.pool();
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) changed++;
  return { r: r.map(q => q.code), changed: changed / (before.length / 4), pool: { count: p.count, boned: p.boned, awake: p.slots.filter(s => s.awake).map(s => s.code).join('') } };
}, o);

try {
  {
    const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } }, '?fresh&test&run');
    await ready(page);
    const p = await G(page, () => window.__gloam.pool()), s = await G(page, () => window.__gloam.state());
    assert.equal(p.slots.map(x => x.code).join(''), 'SSSSS', 'the Gaol pool is 5 Snuffer slots');
    assert(p.slots.every(x => !x.awake), 'every slot is parked');
    assert.equal(p.boned, LAMP, 'only the lamplighter rides the bones');
    // the place, its pool's slots, and the spark pool's 256 splats after them
    assert(p.count > s.count - 1 && p.count - p.slots.reduce((a, x) => a + x.end - x.first, 0) - p.extra === 240582 && p.extra === 256, `the place and its pool: ${p.count}`);
    assert.deepEqual(errors, []);
    pass('?run builds the Gaol pool parked: 5 Snuffer slots off the bones', { count: p.count, boned: p.boned });
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } }, '?fresh&test');
    await ready(page);
    assert.equal(await G(page, () => window.__gloam.pool()), null, 'the explorer has no pool');
    assert.equal((await G(page, () => window.__gloam.state())).count, 240582);
    assert.deepEqual(errors, []);
    pass('the explorer has no pool, and its world holds only the place');
    await ctx.close();
  }
  for (const [name, viewport, mobile, o] of [
    ['lineup-1280x720', { width: 1280, height: 720 }, false, {}],
    ['lineup-tells-1280x720', { width: 1280, height: 720 }, false, { clip: 'hook.windup', t: 0.54 }],
    ['lineup-390x844', { width: 390, height: 844 }, true, { spread: 1.1, ahead: 5.5 }]
  ]) {
    const { ctx, page, errors } = await open({ viewport, hasTouch: mobile, isMobile: mobile }, '?fresh&test&run&lineup');
    await ready(page);
    await begin(page, mobile);
    const res = await lineupAt(page, o);
    assert.deepEqual(res.r, ['S', 'P', 'M', 'I', 'B', 'L'], 'one of each figure');
    assert.equal(res.pool.awake, 'SPMIBCL', 'every lineup slot is awake');
    assert(res.pool.boned > LAMP + 20000, `the awake figures ride the bones: ${res.pool.boned}`);
    assert(res.changed > 0.02, `the figures change 2% of the picture or more: ${res.changed}`);
    await shot(page, name);
    assert.deepEqual(errors, []);
    pass(`${name}: one of each figure stands in view`, { boned: res.pool.boned, changed: +res.changed.toFixed(3) });
    await ctx.close();
  }
  {
    // the foe files fail once: the loading screen says so, and Enter on Try again asks again
    let asked = 0;
    const route = { url: '**/worlds/foes.bin.gz', fn: r => (++asked === 1 ? r.fulfill({ status: 503, body: '' }) : r.continue()) };
    const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } }, '?fresh&test&run', route);
    await page.waitForFunction(() => /foes did not load/.test(document.getElementById('loadLine').textContent), null, { timeout: 120000 });
    assert(await page.isVisible('#bRetry'));
    assert.equal(await G(page, () => document.activeElement?.id), 'bRetry', 'Try again has the focus');
    await page.keyboard.press('Enter');
    await ready(page);
    assert.equal(asked, 2);
    assert.equal((await G(page, () => window.__gloam.pool())).slots.length, 5);
    assert.deepEqual(errors, []);
    pass('foe files that do not load: the loading screen says so, Try again has the focus, and Enter loads them', { asked });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
