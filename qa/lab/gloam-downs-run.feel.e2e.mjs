// Gloam Downs' combat run in a real browser (public/lab/gloam-downs/?run), on software WebGL 2: the feel and the seed.
//   shake: under reduced motion the pause panel first reads "Shake off" and a finisher does not kick; after a press it reads "Shake on",
//     the choice is stored at once, a finisher kicks the camera and the zoom still stays 1;
//   lamp: the combo at 10 gives fx.lamp 1.3 and a halo of 12 dabs in lamp slots, none of fire 37;
//   meter: the combo at 23 reads "×23" in each of 320x640, 390x844 and 360x640 on a touch screen and 800x600 and 1280x720 with a mouse,
//     inside the screen and over none of the HUD's other rows, the toast, the Lab bar, the tools or a touch button; it fades after 3 s;
//   pause: the panel with Shake and the seed fits 320x640 and 800x600 with no scroll and buttons of 44 px or more;
//   seed: ?seed= with a code starts that seed, the pause panel and the run summary show its code, and the foes are the seed's mix.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(). Needs this tree served:
//   python3 -m http.server 8822 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.feel.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep
// pictures, ONLY=shake|lamp|meter|pause|seed)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { seedCode, parseSeed, mixZones } from '../../public/lab/gloam-downs/mix.js';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8822').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
const ONLY = process.env.ONLY;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const part = name => !ONLY || ONLY.split(',').includes(name);
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
async function open(ctxOpts, query) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page, mode) => page.waitForFunction(m => window.__gloam?.ready() && (!m || window.__gloam.run().mode === m), mode, { timeout: 120000 });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const text = (page, sel) => page.textContent(sel).then(t => t.trim());
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
async function begin(page) {
  await page.waitForSelector('#runHelp:not([hidden])');
  await G(page, () => document.getElementById('bBegin').focus());
  await page.keyboard.press('Enter');
  await ready(page, 'play');
}
// a Snuffer 1.5 m in front of the lamplighter, held still at the start of its hook (a held foe takes hits and never hits)
const snufferAhead = page => G(page, () => {
  const g = window.__gloam, s = g.state(), r = g.spawn('S', s.x + Math.sin(s.yaw) * 1.5, s.z + Math.cos(s.yaw) * 1.5, s.yaw + Math.PI);
  if (r.ok) g.hold(r.id, 'hook', 0);
  return r;
});
// step one game step at a time with Attack held until the finisher lands. -> the step count, or -1
const toFinisher = page => G(page, () => {
  const g = window.__gloam, before = g.sounds().length;
  for (let i = 0; i < 240; i++) {
    g.tick(1 / 60, { attack: true });
    if (g.sounds().slice(before).some(c => c.cue === 'hit' && c.hit === 'fin')) return i;
  }
  return -1;
});
const len = v => Math.hypot(...v);

/* what must not lie under the combo meter: the HUD's other rows, the toast, the Lab bar, the tools and the touch buttons -> faults */
function meterFaults() {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const shown = el => el && !el.hidden && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const m = document.getElementById('combo'), out = [];
  if (!shown(m)) return { out: ['the meter is not shown'] };
  const r = R(m);
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push('the meter is outside the screen');
  const others = { where: 'where', life: 'life', count: 'count', hint: 'hint', toast: 'toast', tools: 'tools', bAttack: 'bAttack', bRoll: 'bRoll', bHeal: 'bHeal', bJump: 'bJump', bossBar: 'bossBar' };
  for (const [k, id] of Object.entries(others)) { const el = document.getElementById(id); if (shown(el) && over(r, R(el))) out.push(`the meter is over ${k}`); }
  for (const sel of ['.labbar .back', '#menu']) { const el = document.querySelector(sel); if (shown(el) && over(r, R(el))) out.push(`the meter is over ${sel}`); }
  const num = getComputedStyle(document.getElementById('comboN')).fontSize;
  return { out, rect: [r.x, r.y, r.width, r.height].map(v => +v.toFixed(1)), num, text: document.getElementById('comboN').textContent };
}
function cardFaults(id) {
  const R = el => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = [], panel = document.getElementById(id), box = panel.querySelector('.box'), b = R(box);
  if (panel.hidden) return ['not shown'];
  if (!inside(b)) out.push('box outside the screen');
  if (box.scrollHeight > box.clientHeight + 1) out.push(`box scrolls ${box.scrollHeight} > ${box.clientHeight}`);
  const lab = [R(document.querySelector('.labbar .back')), R(document.getElementById('menu'))];
  const btns = [...box.querySelectorAll('button')].filter(x => !x.hidden && x.getClientRects().length);
  btns.forEach((x, i) => {
    const r = R(x), name = x.id || x.textContent.trim();
    if (Math.min(r.width, r.height) < 44 - 0.01) out.push(`${name} is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (!inside(r)) out.push(`${name} outside the screen`);
    if (lab.some(l => over(r, l))) out.push(`${name} under the Lab bar`);
    btns.slice(i + 1).forEach(y => { if (over(r, R(y))) out.push(`${name} over ${y.id || y.textContent.trim()}`); });
  });
  for (const el of box.querySelectorAll('h2, p, li')) {
    if (el.hidden || !el.getClientRects().length) continue;
    const r = R(el);
    if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push(`text outside the box: ${el.textContent.trim().slice(0, 30)}`);
  }
  return out;
}

try {
  if (part('shake')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }, '?run&test&fresh&seed=7&nodraw');
    await begin(page);
    await page.keyboard.press('p');
    await page.waitForSelector('#pause:not([hidden])');
    assert.equal(await text(page, '#bShake'), 'Shake off');
    assert.equal((await run(page)).fx.shakes, false);
    // a finisher with Shake off: no kick, the zoom 1
    await page.keyboard.press('Escape');
    await ready(page, 'play');
    assert((await snufferAhead(page)).ok);
    const at0 = await toFinisher(page);
    assert(at0 >= 0, 'the finisher landed');
    await G(page, () => window.__gloam.draw());
    let r = await run(page);
    assert.deepEqual(r.fx.kick, [0, 0, 0]);
    assert.equal(r.fx.zoom, 1);
    await tick(page, 2);
    // press Shake: it reads Shake on, the save keeps it, and a finisher kicks with the zoom still 1
    await page.keyboard.press('p');
    await page.waitForSelector('#pause:not([hidden])');
    await page.click('#bShake');
    assert.equal(await text(page, '#bShake'), 'Shake on');
    const stored = await G(page, () => JSON.parse(localStorage.getItem('gloam-downs.run.v2') || localStorage.getItem('gloam-downs.run.v1')));
    assert.equal(stored.shake, true, 'the choice is stored at once');
    await page.keyboard.press('Escape');
    await ready(page, 'play');
    await G(page, () => { for (const f of window.__gloam.foes()) window.__gloam.out(f.id); });
    assert((await snufferAhead(page)).ok);
    const at1 = await toFinisher(page);
    assert(at1 >= 0, 'the second finisher landed');
    // the kick drawn on steps 0, 3 and 6 after the finisher (each draw is slow in software WebGL): a felt kick (1.5 cm or more at its
    // peak) and never past 0.15 m
    const kicks = await G(page, () => { const g = window.__gloam, out = []; for (let i = 0; i < 3; i++) { if (i) g.tick(3 / 60, {}); g.draw(); const r = g.run(); out.push({ k: r.fx.kick.slice(), zoom: r.fx.zoom }); } return out; });
    const peak = Math.max(...kicks.map(q => len(q.k)));
    assert(kicks.every(q => len(q.k) <= 0.15 + 1e-6), `the kicks: ${kicks.map(q => len(q.k).toFixed(4))}`);
    assert(peak >= 0.015, `a finisher's kick is felt: its peak is ${peak.toFixed(4)} m`);
    assert(kicks.every(q => q.zoom === 1), 'the zoom stays 1 under reduced motion');
    assert.deepEqual(errors, []);
    pass('reduced motion: "Shake off" until pressed, no kick; then "Shake on", stored at once, a finisher kicks 1.5 cm to 0.15 m and the zoom stays 1', { peak: +peak.toFixed(4), kicks: kicks.map(q => +len(q.k).toFixed(4)) });
    await ctx.close();
  }

  if (part('lamp')) {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7&nodraw');
    await begin(page);
    await G(page, () => window.__gloam.set({ combo: 10 }));
    await G(page, () => window.__gloam.draw());
    const r = await run(page);
    assert.equal(r.fx.lamp, 1.3);
    assert.equal(r.fx.halo.length, 12, `${r.fx.halo.length} dabs`);
    assert(r.fx.halo.every(ci => ci === 46 || ci === 47) && !r.fx.halo.includes(37));
    assert.deepEqual([r.combo.n, r.combo.tier], [10, 2]);
    await shot(page, 'lamp-tier2-1280x720');
    assert.deepEqual(errors, []);
    pass('the combo at 10: fx.lamp 1.3 and 12 halo dabs in lamp slots 46 and 47, none of fire 37', { halo: r.fx.halo });
    await ctx.close();
  }

  if (part('meter')) {
    const sizes = {};
    for (const [w, h, touch] of [[320, 640, true], [390, 844, true], [360, 640, true], [800, 600, false], [1280, 720, false]]) {
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&fresh&seed=7&nodraw');
      await begin(page);
      await G(page, () => window.__gloam.toast('The beacon will not catch while its keepers stand by the broken wall below the tower.', 4000));
      await G(page, () => window.__gloam.set({ combo: 23, carried: 999 }));
      await G(page, () => window.__gloam.draw());
      const m = await G(page, meterFaults);
      assert.deepEqual(m.out, [], `${w}x${h}: ${m.out.join('; ')}`);
      assert.equal(m.text, '×23');
      assert.equal(m.num, '12px');
      sizes[`${w}x${h}`] = m.rect;
      await shot(page, `meter-${w}x${h}`);
      // after 3 s with no hit the combo ends, the meter fades over 0.4 s and goes
      await tick(page, 3.05);
      await G(page, () => window.__gloam.draw());
      const fading = await G(page, () => ({ hidden: document.getElementById('combo').hidden, fading: document.getElementById('combo').classList.contains('fading') }));
      await tick(page, 0.5);
      await G(page, () => window.__gloam.draw());
      const gone = await G(page, () => document.getElementById('combo').hidden);
      assert(fading.fading || fading.hidden, `${w}x${h}: the meter fades: ${JSON.stringify(fading)}`);
      assert(gone, `${w}x${h}: the meter goes`);
      assert.deepEqual((await run(page)).combo, { n: 0, tier: 0, left: 0 });
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    pass('the meter reads "×23" in a 12 px number in five layouts, over nothing it must not, and fades after 3 s', sizes);
  }

  if (part('pause')) {
    const out = {};
    for (const [w, h, touch] of [[320, 640, true], [800, 600, false]]) {
      const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) }, '?run&test&fresh&seed=7&nodraw');
      await begin(page);
      await page.keyboard.press('p');
      await page.waitForSelector('#pause:not([hidden])');
      const f = await G(page, cardFaults, 'pause');
      assert.deepEqual(f, [], `${w}x${h}: ${f.join('; ')}`);
      assert.equal(await text(page, '#seedLine'), 'Seed 000007');
      // the focus order: Resume, Sound, Music, Shake, Back to the start, End the run
      const order = [];
      await G(page, () => document.getElementById('bResume').focus());
      for (let i = 0; i < 6; i++) { order.push(await G(page, () => document.activeElement.id)); await page.keyboard.press('Tab'); }
      assert.deepEqual(order, ['bResume', 'bSound', 'bMusic', 'bShake', 'bRestart', 'bEnd']);
      out[`${w}x${h}`] = 'fits';
      await shot(page, `pause-${w}x${h}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    pass('the pause panel with Shake and the seed fits 320x640 and 800x600; the focus goes Resume, Sound, Music, Shake, Back to the start, End the run', out);
  }

  if (part('seed')) {
    const code = 'K3X9QM', seed = parseSeed(code);
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, `?run&test&mix&fresh&nodraw&seed=${code.toLowerCase()}`);
    await begin(page);
    let r = await run(page);
    assert.equal(r.seed, seed);
    assert.equal(r.seedCode, code);
    assert.equal(seedCode(seed), code);
    // the foes are the seed's mix of the Gaol, as mix.js gives it in node
    const meta = await G(page, () => fetch('./worlds/gaol.json').then(x => x.json()));
    const slots = (await G(page, () => window.__gloam.pool().slots.map(s => s.code))).join('');
    const want = mixZones('gaol', meta.zones, slots, seed, { ember: 0 }).filter(z => !z.boss).map(z => ({ id: z.id, foes: z.foes, baked: z.baked, elite: z.elite ?? null }));
    assert.deepEqual(r.mix, want);
    await page.keyboard.press('p');
    await page.waitForSelector('#pause:not([hidden])');
    assert.equal(await text(page, '#seedLine'), `Seed ${code}`);
    await page.keyboard.press('Escape');
    await ready(page, 'play');
    await G(page, () => window.__gloam.set({ combo: 12 }));
    await G(page, () => window.__gloam.kill());
    await tick(page, 1.6);
    await page.waitForSelector('#summary:not([hidden])');
    const line = await text(page, '#sumSeed');
    assert.equal(line, `Seed ${code} · Best combo ×12`);
    assert.deepEqual(errors, []);
    pass('?seed= with a code starts that seed: the foes are its mix, and the pause panel and the summary show its code', { code, seed, line });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
