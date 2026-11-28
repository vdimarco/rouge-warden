// Gloam Downs: the life of the places in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2
// (gloam-downs-screens-life spec, "Ambient life", "Life answers the lamplighter", "Life never looks like a tell", "Life budget",
// "Life with reduced motion"):
//   life can be seen: the Gaol drawn at game times 0 s and 1 s differs in 0.2% of its pixels or more, and 1.5 times as many as
//     with life off (the baked fires and embers already move about 0.8% of it);
//   crows lift: the lamplighter 4 m from a flock on The Crow Wall, 3 s of play: the flock is put away, the bus heard life-stir, and
//     the run's sound bed played wings and caws at the flock;
//   the hush: a Snuffer wakes 4 m from a lamp in the Gaol; 0.3 s later no bright life dab within 8 m of it shows;
//   reduced motion: every life dab is still or a soft glow;
//   the frame time at 390x844 with touch (the phone layout), for each place at three views (the start, a lamp by the middle of the
//     route, the beacon): 15 draws to warm up, then 120 timed draws in blocks of 10 with life on and off by turns at the same game
//     times, each block with life starting a gust. Life's own time a draw (the browser's timer is coarse and SwiftShader shares the CPU): median 1 ms or less,
//     99th percentile 3 ms or less, 4 rows or fewer. The frame-time ratio only catches a gross cost (SwiftShader spreads by about 15%): 1.08 or less over all 15
//     views, 1.15 or less in each, and in the explorer at the Gaol. SwiftShader draws on the CPU; no real phone is checked.
// SHOTS=<dir> keeps a picture of each place at 390x844 (with the time part), 1280x720, 320x640 and 844x390 (SIZES=1280x720,... picks).
// ONLY=seen,crows,hush,still,time,none picks parts. WARM, DRAWS and BLOCK change the frame-time counts (default 15, 120, 10).
// Needs the site served: python3 -m http.server 8822 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-life.e2e.mjs   (SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8822').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const part = name => !process.env.ONLY || process.env.ONLY.split(',').includes(name);
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
const ZONES = ['G1', 'G2', 'G3', 'G5', 'G6', 'G7', 'G8', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'B1', 'B2', 'B3', 'B4', 'W1', 'W2', 'W4', 'W5', 'W6'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const G = (page, fn, arg) => page.evaluate(fn, arg);
async function open(viewport, o = {}) {
  const touch = !!o.touch;
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1, reducedMotion: o.still ? 'reduce' : 'no-preference' });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${o.url || '?run&test&fresh&seed=7'}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  if (!o.url?.includes('explore')) await (touch ? page.tap('#bBegin') : page.click('#bBegin'));
  return { ctx, page, errors };
}
async function goPlace(page, id) {
  if (await G(page, () => window.__gloam.state().place) !== id) {
    await G(page, id => window.__gloam.go(id), id);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  }
  // the arrival card's time, and every zone put out so no foe wakes
  await G(page, Z => { const g = window.__gloam; g.tick(4, {}); for (const z of Z) g.out?.(z); g.tick(1.2, {}); }, ZONES);
}
// read the art's pixels after a draw at `time`
const PIX = `(time => { const g = window.__gloam; g.draw({ time }); const c = document.getElementById('view'), gl = c.getContext('webgl2'), a = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; })`;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

if (part('seen')) { // life can be seen: two game times, life on and off
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, { touch: true });
  await goPlace(page, 'gaol');
  const r = await G(page, PIX => {
    const px = eval(PIX), g = window.__gloam;
    const diff = (a, b) => { let k = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) k++; return k; };
    const on = diff(px(0), px(1)), all = px(0).length / 4;
    g.life({ on: false });
    const off = diff(px(0), px(1));
    g.life({ on: true });
    return { on, off, share: on / all };
  }, PIX);
  assert(r.share >= 0.002, `life moved ${(r.share * 100).toFixed(2)}% of the picture`);
  assert(r.on >= 1.5 * r.off, `with life ${r.on} pixels moved, without ${r.off}`);
  assert.deepEqual(errors, []);
  pass('life can be seen: the Gaol at 0 s and 1 s differs in 0.2% of the picture or more, 1.5 times as much as with life off (the baked fires and embers already move)', { on: r.on, off: r.off, share: +(r.share * 100).toFixed(2) + '%' });
  await ctx.close();
}
if (part('crows')) { // crows lift on The Crow Wall, and the bed plays them
  const { ctx, page, errors } = await open({ width: 1280, height: 720 });
  await goPlace(page, 'ramparts');
  const f = await G(page, () => { const L = window.__gloam.life().flocks, i = L.findIndex(f => f.state === 'perched'); return { ...L[i], i }; });
  await G(page, f => { const g = window.__gloam; g.teleport(f.x + 4, f.z, -Math.PI / 2); g.draw(); }, f);
  const out = [];
  for (let k = 0; k < 12; k++) out.push(await G(page, i => { const g = window.__gloam; g.tick(0.25, {}); g.draw(); return g.life().flocks[i].state; }, f.i));
  const after = await G(page, () => ({ life: window.__gloam.life(), music: window.__gloam.music() }));
  const fl = after.life.flocks.find(x => Math.hypot(x.x - f.x, x.z - f.z) < 0.01);
  assert.equal(fl.state, 'gone', JSON.stringify(out));
  assert.equal(fl.shown, 0);
  assert(after.music.events.includes('life-stir'), `the bus: ${after.music.events}`);
  const bed = after.music.beds;
  assert(bed && bed.id === 'ramparts', JSON.stringify(bed));
  assert(bed.log.some(e => e.what === 'crows' && e.n >= 2), `the bed's log: ${JSON.stringify(bed.log)}`);
  assert.deepEqual(errors, []);
  pass('crows lift with the lamplighter 4 m off on The Crow Wall: put away in 3 s, life-stir heard, wings and caws in the bed', { states: out.join(' '), bed: bed.log.find(e => e.what === 'crows') });
  await ctx.close();
}
if (part('hush')) { // a Snuffer wakes 4 m from a lamp in the Gaol: 0.3 s later no bright life dab within 8 m of it shows
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, { touch: true });
  await goPlace(page, 'gaol');
  const r = await G(page, () => {
    const g = window.__gloam, L = g.life(), sp = g.points().spawn.p;
    // a lamp 8 m or more from the start, with ground beside it
    const a = L.halos.find(h => Math.hypot(h.x - sp[0], h.z - sp[2]) > 8 && h.y < 3) || L.halos[1];
    g.teleport(a.x + 6, a.z + 6, 0);
    g.tick(0.3, {}); g.draw();
    const spawned = g.spawn('S', a.x + 4, a.z, 0);
    g.tick(0.05, {}); g.draw();
    const fo = g.combat().foes[0];
    g.tick(0.3, {}); g.draw();
    const near = g.life({ near: [fo.x, fo.y, fo.z], r: 8 }).dabs.filter(d => d.bright);
    return { spawned, foe: fo && { x: fo.x, z: fo.z, state: fo.state }, n: near.length, lit: near.filter(d => d.d > 0).length, hushed: g.life().hushed };
  });
  assert(r.foe, `no foe woke: ${JSON.stringify(r.spawned)}`);
  assert(r.n > 0 && r.lit === 0, `${r.lit} of ${r.n} bright dabs within 8 m still shine`);
  assert.deepEqual(errors, []);
  pass('the hush: 0.3 s after a Snuffer wakes 4 m from a lamp, no bright life dab within 8 m shows', r);
  await ctx.close();
}
if (part('still')) { // reduced motion: still life
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, { touch: true, still: true });
  await goPlace(page, 'gaol');
  const s = await G(page, () => window.__gloam.life());
  assert(s.still, 'life did not read reduced motion');
  assert.deepEqual(Object.keys(s.kinds).filter(k => k !== '0' && k !== '7'), [], JSON.stringify(s.kinds));
  assert.deepEqual(errors, []);
  pass('reduced motion: every life dab is still (0) or a soft glow (7)', s.kinds);
  await ctx.close();
}
/* ---------------- the frame time ---------------- */
// one view: 15 draws to warm up, then 120 timed draws in blocks of 10, life on and off by turns at the same game times
// WARM, DRAWS and BLOCK change the counts (default 15, 120 and 10, as the spec says) for a machine where SwiftShader takes seconds a
// draw; the run prints the counts it used
const WARM = Number(process.env.WARM) || 15, BLOCK = Number(process.env.BLOCK) || 10;
const BLOCKS = Math.max(2, 2 * Math.round((Number(process.env.DRAWS) || 120) / BLOCK / 2));
const TIMED = `(([WARM, BLOCK, BLOCKS]) => {
  const g = window.__gloam, c = document.getElementById('view'), gl = c.getContext('webgl2'), one = new Uint8Array(4);
  const draw = t => { const t0 = performance.now(); g.draw({ time: t }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); return performance.now() - t0; };
  for (let k = 0; k < WARM; k++) draw(20 + k / 30);
  g.life({ reset: true });
  const on = [], off = [];
  for (let b = 0; b < BLOCKS; b++) {
    // on, off, off, on, on, off ...: each pair of blocks starts with the other one, so a slow spell falls on both alike
    const life = (b % 4 === 0 || b % 4 === 3), base = 21 + Math.floor(b / 2) * (BLOCK / 30);
    g.life({ on: life });
    // each block with life starts a gust, so the timed frames include ones where life writes rows
    if (life) g.life({ gust: true });
    for (let k = 0; k < BLOCK; k++) (life ? on : off).push(draw(base + k / 30));
  }
  g.life({ on: true });
  const L = g.life();
  return { on, off, ms: L.ms, p99: L.p99, rows: L.rows.max };
})`;
const timed = page => page.evaluate(`${TIMED}(${JSON.stringify([WARM, BLOCK, BLOCKS])})`);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
if (part('time')) {
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, { touch: true });
  const views = [], allOn = [], allOff = [], own = [], p99s = [], rowsMax = [];
  console.log(`  ${WARM} draws to warm up, then ${BLOCKS * BLOCK} timed draws a view in blocks of ${BLOCK}`);
  for (const id of PLACES) {
    await goPlace(page, id);
    const spots = await G(page, () => {
      const g = window.__gloam, L = g.life(), p = g.points(), sp = p.spawn.p, bp = p.beacon;
      // the lamp nearest the middle of the way from the start to the beacon
      const mid = [(sp[0] + bp[0]) / 2, (sp[2] + bp[2]) / 2], a = L.halos.slice().sort((u, v) => Math.hypot(u.x - mid[0], u.z - mid[1]) - Math.hypot(v.x - mid[0], v.z - mid[1]))[0];
      const face = (x, z, tx, tz) => [x, z, Math.atan2(tx - x, tz - z)];
      const away = (tx, tz, r, fx, fz) => { const d = Math.hypot(fx - tx, fz - tz) || 1; return face(tx + (fx - tx) / d * r, tz + (fz - tz) / d * r, tx, tz); };
      return { start: null, lamp: away(a.x, a.z, 3, sp[0], sp[2]), beacon: away(bp[0], bp[2], 6, sp[0], sp[2]) };
    });
    for (const [name, at] of Object.entries(spots)) {
      if (at) await G(page, ([x, z, yaw]) => { window.__gloam.teleport(x, z, yaw); window.__gloam.tick(0.4, {}); }, at);
      const r = await timed(page);
      const ratio = med(r.on) / med(r.off);
      views.push({ view: `${id}/${name}`, on: +med(r.on).toFixed(2), off: +med(r.off).toFixed(2), ratio: +ratio.toFixed(3), life: r.ms });
      allOn.push(...r.on); allOff.push(...r.off); own.push(r.ms); p99s.push(r.p99); rowsMax.push(r.rows);
      console.log(`  ${id}/${name}: life ${med(r.on).toFixed(2)} ms, none ${med(r.off).toFixed(2)} ms, ratio ${ratio.toFixed(3)}, life's own ${r.ms} ms (99th ${r.p99} ms, ${r.rows} rows)`);
      if (name === 'start') await shot(page, `life-${id}-390x844`);
    }
  }
  const overall = med(allOn) / med(allOff), worst = Math.max(...views.map(v => v.ratio)), ownMed = med(own);
  assert.deepEqual(errors, []);
  await ctx.close();
  // the explorer, once at the Gaol
  const ex = await open({ width: 390, height: 844 }, { touch: true, url: '?explore&test&place=gaol' });
  await G(ex.page, () => { window.__gloam.close?.(); window.__gloam.tick(1, {}); });
  const e = await timed(ex.page), eRatio = med(e.on) / med(e.off);
  console.log(`  explorer/gaol: life ${med(e.on).toFixed(2)} ms, none ${med(e.off).toFixed(2)} ms, ratio ${eRatio.toFixed(3)}`);
  await ex.ctx.close();
  /* the gate: life's own time, measured on the frames it draws (gusts included), is what life adds on the CPU; its GPU share is the
     count rule (1,200 small dabs of 277,000). A SwiftShader draw spreads by about 15% from one to the next, so the frame-time ratio
     only catches a gross cost (a large dab, a full rewrite): over all views 1.08 or less, each view 1.15 or less */
  assert(ownMed <= 1, `life's own median time a draw is ${ownMed} ms`);
  // a single slow draw (a collection, the first draw of a view) is printed, not gated: the views' 99th percentiles at their median
  assert(med(p99s) <= 3, `life's own 99th percentile draw is ${med(p99s)} ms at the median of the views`);
  assert(Math.max(...rowsMax) <= 4, `a draw wrote ${Math.max(...rowsMax)} rows`);
  assert(overall <= 1.08, `the median frame time with life is ${overall.toFixed(3)} times that without`);
  assert(worst <= 1.15, `a view's ratio is ${worst}: ${JSON.stringify(views.find(v => v.ratio === worst))}`);
  assert(eRatio <= 1.15, `the explorer's ratio is ${eRatio.toFixed(3)}`);
  pass('life\'s own time at 390x844 with a gust in each timed block: median 1 ms or less, 99th percentile 3 ms or less (the views\' median), 4 rows or fewer; the frame time with life 1.08 times or less over all views, 1.15 or less in each, the explorer too', { own: ownMed, p99: med(p99s), p99max: Math.max(...p99s), rows: Math.max(...rowsMax), overall: +overall.toFixed(3), worst, explorer: +eRatio.toFixed(3) });
}
if (SHOTS) { // a picture of each place at 1280x720, and with touch at 320x640 and 844x390 (390x844 comes from the frame-time part, or here without it)
  for (const [w, h, touch] of [[1280, 720, false], [320, 640, true], [844, 390, true], ...(part('time') ? [] : [[390, 844, true]])]) {
    if (process.env.SIZES && !process.env.SIZES.split(',').includes(`${w}x${h}`)) continue;
    const { ctx, page, errors } = await open({ width: w, height: h }, { touch });
    for (const id of PLACES) { await goPlace(page, id); await G(page, () => window.__gloam.draw()); await shot(page, `life-${id}-${w}x${h}`); }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
}
await browser.close();
console.log(`PASS qa/lab/gloam-downs-life.e2e.mjs: ${n} checks`);
