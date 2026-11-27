// Gloam Downs' gear in play in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2 (openspec/changes/gloam-downs-hub,
// Part C):
//   hold to swap a blade: on a bright Hook blade holding a plain Lamp blade, Attack held 0.4 s takes it, the Lamp blade lies there and
//     the cue log has swap; with keys (J), a pad (X), a mouse (the left button) and touch (#bAttack held);
//   a tap still cuts: on a blade underfoot a tap plays the first cut and keeps the held blade;
//   the off-hand: the Sling throws on an Off-hand press (V, the middle mouse button, RB and #bOff once the hub builder's input lands;
//     until then through __gloam.gear({ off: true }), and the check says which inputs it could not press);
//   the Buckler's parry: a Snuffer's blow 0.1 s into the raise deals nothing, the Snuffer goes down, the cue log has parry;
//   the Twin string: four presses of J on a training post give four cuts, the fourth with the first cut's pose;
//   the Bell slam: J held 0.5 s with two posts within 2.5 m: each takes 30;
//   the compare toast shows over a ground item and goes when the lamplighter steps off.
// Screenshots go to SHOTS (a folder) when it is set.
// Needs this tree served:   python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.gear.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const SAVE = { v: 4, seen: true, bank: 0, kindled: ['hook', 'twin', 'bell', 'sling', 'pot', 'chain', 'shade', 'cuff'] };
async function open(ctxOpts, query = '?run&test&seed=7&nodraw') {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(o => { try { localStorage.setItem('gloam-downs.run.v4', JSON.stringify(o)); } catch {} }, SAVE);
  await ctx.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__pad = { connected: false, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
    window.__press = (i, on) => { window.__pad.connected = true; buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
    navigator.getGamepads = () => (window.__pad.connected ? [window.__pad] : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.run().mode === 'lamp', null, { timeout: 180000 });
  if (ctxOpts.hasTouch) await page.tap('#bLampBegin'); else await page.click('#bLampBegin');
  await page.waitForFunction(() => window.__gloam.run().mode === 'play', null, { timeout: 180000 });
  // no foe here unless a check spawns one
  await G(page, () => { for (const f of window.__gloam.foes()) window.__gloam.out?.(f.id); });
  return { ctx, page, errors };
}
const sounds = async (page, since = 0) => (await G(page, () => window.__gloam.sounds())).slice(since).map(c => c.cue);
const layBlade = page => G(page, () => window.__gloam.gear({ clear: true, blade: { id: 'lamp' }, lay: { kind: 'blade', id: 'hook', tier: 'bright', traits: ['smoulder'] } }));
const held = page => G(page, () => window.__gloam.gear({}));

try {
  /* ---------------- hold to swap a blade, on every input ---------------- */
  for (const how of ['keys', 'pad', 'mouse', 'touch']) {
    const { ctx, page, errors } = await open(how === 'touch' ? { viewport: { width: 390, height: 844 }, ...TOUCH } : { viewport: { width: 1280, height: 720 } });
    await layBlade(page);
    await tick(page, 0.05);
    const n0 = (await sounds(page)).length;
    if (how === 'keys') { await page.keyboard.down('j'); await tick(page, 0.5, 'live'); await page.keyboard.up('j'); }
    if (how === 'pad') { await G(page, () => window.__press(2, true)); await tick(page, 0.5, 'live'); await G(page, () => window.__press(2, false)); }
    if (how === 'mouse') {
      await G(page, () => window.__gloam.release?.());
      await page.mouse.move(640, 400); await page.mouse.down(); await tick(page, 0.5, 'live'); await page.mouse.up();
    }
    if (how === 'touch') {
      const b = await page.$eval('#bAttack', el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b[0], y: b[1], id: 1 }] });
      await tick(page, 0.5, 'live');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await tick(page, 0.05, 'live');
    const v = await held(page);
    assert.deepEqual([v.blade.id, v.blade.tier, v.blade.traits], ['hook', 'bright', ['smoulder']], `${how}: the Hook blade is held`);
    assert.deepEqual(v.lamps.map(l => [l.kind, l.id, l.tier]), [['blade', 'lamp', 'plain']], `${how}: the Lamp blade lies there`);
    assert((await sounds(page, n0)).includes('swap'), `${how}: the swap cue`);
    assert.deepEqual(errors, []);
    if (SHOTS && how === 'keys') await page.screenshot({ path: `${SHOTS}/swap-keys.png` });
    pass(`hold to swap a blade with ${how === 'keys' ? 'keys' : how === 'pad' ? 'a pad' : how === 'mouse' ? 'a mouse' : 'touch'}: the bright Hook blade held, the Lamp blade left, the swap cue`);
    await ctx.close();
  }

  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7');
    /* ---------------- a tap still cuts; the compare toast ---------------- */
    await layBlade(page);
    await tick(page, 0.05);
    await G(page, () => window.__gloam.draw());
    assert(!(await page.$eval('#compare', e => e.hidden)), 'the compare toast shows on the blade');
    const n0 = (await sounds(page)).length;
    await tick(page, 0.05, { attack: true });
    await tick(page, 0.4, {});
    const after = await sounds(page, n0);
    assert(after.includes('swing'), 'a tap plays the first cut');
    assert.equal((await held(page)).blade.id, 'lamp', 'the held blade is the same');
    // step off: the toast goes
    await tick(page, 0.6, { mz: 1 });
    await G(page, () => window.__gloam.draw());
    assert(await page.$eval('#compare', e => e.hidden), 'the toast goes when the lamplighter steps off');
    pass('a tap still cuts on a blade underfoot, the compare toast shows there and goes off it');

    /* ---------------- the off-hand ---------------- */
    await G(page, () => window.__gloam.gear({ clear: true, offhand: { id: 'sling' } }));
    const s0 = (await sounds(page)).length;
    const tried = {};
    for (const [name, press] of [
      ['V', async () => { await page.keyboard.down('v'); await tick(page, 0.05, 'live'); await page.keyboard.up('v'); }],
      ['the middle mouse button', async () => { await page.mouse.move(640, 400); await page.mouse.down({ button: 'middle' }); await tick(page, 0.05, 'live'); await page.mouse.up({ button: 'middle' }); }],
      ['RB', async () => { await G(page, () => window.__press(5, true)); await tick(page, 0.05, 'live'); await G(page, () => window.__press(5, false)); }]
    ]) {
      const k = (await sounds(page)).length;
      await G(page, () => window.__gloam.gear({ cool: 0 }));
      await press();
      await tick(page, 0.1, 'live');
      tried[name] = (await sounds(page, k)).includes('sling');
    }
    await G(page, () => window.__gloam.gear({ cool: 0, off: true }));
    await tick(page, 0.1);
    const slings = (await sounds(page, s0)).filter(c => c === 'sling').length;
    assert(slings >= 1, 'the Sling throws on an Off-hand press');
    const missing = Object.entries(tried).filter(([, ok]) => !ok).map(([k]) => k);
    pass(`the off-hand: the Sling throws on a press${missing.length ? `; not yet pressed by ${missing.join(', ')} (the hub builder's input.off)` : ' by V, the middle mouse button and RB'}`, { tried });

    /* ---------------- the Buckler's parry ---------------- */
    await G(page, () => window.__gloam.gear({ offhand: { id: 'buckler' }, cool: 0 }));
    const st = await G(page, () => window.__gloam.state());
    const bx = st.x, bz = st.z, yaw = st.yaw;
    const spawned = await G(page, p => window.__gloam.spawn?.('S', p[0] + Math.sin(p[2]) * 1.6, p[1] + Math.cos(p[2]) * 1.6, p[2] + Math.PI), [bx, bz, yaw]);
    const foe = (await G(page, () => window.__gloam.foes()))[0];
    assert(spawned && foe, 'a Snuffer stands in front');
    const hp0 = (await G(page, () => window.__gloam.run())).hp;
    const p0 = (await sounds(page)).length;
    await G(page, () => window.__gloam.gear({ off: true }));
    await tick(page, 0.1);
    const out = await G(page, f => window.__gloam.hurt(14, [f.x, f.z]), foe);
    const hp1 = (await G(page, () => window.__gloam.run())).hp;
    assert.equal(out, 'none');
    assert.equal(hp1, hp0);
    assert((await sounds(page, p0)).includes('parry'), 'the parry cue');
    assert.equal((await G(page, () => window.__gloam.foes()))[0].move, 'down', 'the Snuffer goes down');
    assert((await held(page)).sure, 'the next cut is sure');
    pass('the Buckler\'s parry: a blow 0.1 s into the raise deals nothing, the Snuffer goes down, the parry cue, a sure cut next');
    await G(page, () => { for (const f of window.__gloam.foes()) window.__gloam.out?.(f.id); });
    await tick(page, 2);

    /* ---------------- the Twin string and the Bell slam ---------------- */
    await G(page, () => window.__gloam.gear({ blade: { id: 'twin' } }));
    await G(page, () => window.__gloam.clearPosts());
    await G(page, p => window.__gloam.post(p[0] + Math.sin(p[2]) * 1.2, p[1] + Math.cos(p[2]) * 1.2, { hp: Infinity }), [bx, bz, yaw]);
    for (let i = 0; i < 4; i++) { await page.keyboard.down('j'); await tick(page, 0.03, 'live'); await page.keyboard.up('j'); await tick(page, 0.4, 'live'); }
    const twin = (await G(page, () => window.__gloam.posts()))[0].hits.filter(h => /cut|fin/.test(h.kind));
    assert.deepEqual(twin.map(h => h.dmg), [9, 10, 20, 9], `the twin string: ${JSON.stringify(twin)}`);
    pass('the Twin string: four presses of J, four cuts (9, 10, 20, 9)');
    await G(page, () => window.__gloam.gear({ blade: { id: 'bell' } }));
    await G(page, () => window.__gloam.clearPosts());
    const pos = await G(page, () => window.__gloam.state());
    await G(page, p => { window.__gloam.post(p.x + 2, p.z + 0.5, { hp: Infinity }); window.__gloam.post(p.x - 1.8, p.z - 1, { hp: Infinity }); }, pos);
    await page.keyboard.down('j'); await tick(page, 0.6, 'live'); await page.keyboard.up('j'); await tick(page, 0.1, 'live');
    const slams = (await G(page, () => window.__gloam.posts())).map(p => p.hits.filter(h => h.kind === 'slam').map(h => h.dmg));
    assert.deepEqual(slams, [[30], [30]]);
    if (SHOTS) { await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/slam-1280x720.png` }); }
    pass('the Bell slam: J held 0.5 s, each post within 2.5 m takes 30');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
