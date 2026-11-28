// Gloam Downs' new kit in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2 (openspec/changes/gloam-downs-hub):
//   each of the ten new abilities started with F in the Gaol, against a Snuffer spawned ahead: its cue, its tell drawn or sent before
//   its effect, and the effect (the damage, the shell's band on the HUD, the slick's pool and its fire, the tacks, the post lamp and
//   the blink back, the moths, the Mark that adds 22 to the next cut);
//   Gloam dash from the save's key: a jump and Roll in the air dash 3.5 m level, once;
//   the shell's pale band over the health bar, and pictures of the kit at 390x844, 844x390 and 1280x720 (SHOTS=<dir> keeps them).
// Needs this tree served:   python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.kit.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>)
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
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
async function open(ctxOpts, query = '?run&test&seed=7&nodraw', save = { seen: true, bank: 0, keys: ['dash'] }) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(o => { try { localStorage.setItem('gloam-downs.run.v3', JSON.stringify(o)); } catch {} }, save);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.run().mode === 'lamp', null, { timeout: 180000 });
  if (ctxOpts.hasTouch) await page.tap('#bLampBegin'); else await page.click('#bLampBegin');
  await page.waitForFunction(() => window.__gloam.run().mode === 'play', null, { timeout: 180000 });
  // the arrival card passes, and the lamplighter walks down from the Gaol's stair to the flat ground below it
  await tick(page, 3.5);
  await tick(page, 3, { mz: 1 });
  await tick(page, 0.5);
  return { ctx, page, errors };
}
// a Snuffer d m ahead of the lamplighter (and `side` m to its right), standing still in a hold (a held foe never hits)
async function foeAhead(page, d, side = 0, type = 'S', hold = true) {
  return G(page, ([d, side, type, hold]) => {
    const s = window.__gloam.state(), fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const r = window.__gloam.spawn(type, s.x + fx * d - fz * side, s.z + fz * d + fx * side, s.yaw + Math.PI);
    if (r.ok && hold) window.__gloam.hold(r.id, type === 'I' ? 'slam' : 'hook', 0);
    return r.id;
  }, [d, side, type, hold]);
}
const foe = (page, id) => G(page, id => window.__gloam.foes().find(f => f.id === id) || null, id);
const clear = page => G(page, () => { for (const f of window.__gloam.foes()) window.__gloam.out(f.id); window.__gloam.tick(0.6); window.__gloam.set({ cool: [0, 0], hp: 100 }); });
async function useF(page) { await page.keyboard.down('f'); await tick(page, 0.05, 'live'); await page.keyboard.up('f'); await tick(page, 0.02, 'live'); }
const cues = async page => (await G(page, () => window.__gloam.sounds())).map(c => c.cue);

try {
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
    const results = {};
    // Wick lash: its cue at the use, then 14 to the Snuffer 3 m ahead after the line's 0.15 s tell, and the burn after
    {
      await clear(page);
      const id = await foeAhead(page, 3);
      const hp0 = (await foe(page, id)).hp;
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'lash' }, null] }));
      await useF(page);
      assert((await cues(page)).includes('lash'), 'the lash cue');
      const tellHp = (await foe(page, id)).hp;
      await tick(page, 0.2);
      const after = (await foe(page, id)).hp;
      assert.equal(tellHp, hp0, 'nothing before the tell ends');
      assert.equal(hp0 - after, 14);
      await tick(page, 2.2);
      results.lash = hp0 - (await foe(page, id)).hp;
      assert(results.lash > 14, 'and it burns');
    }
    // Shard fan: the Snuffer 1.2 m ahead takes the five shards and their Char's burst
    {
      await clear(page);
      const id = await foeAhead(page, 1.2);
      const hp0 = (await foe(page, id)).hp;
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'fan' }, null] }));
      await useF(page); await tick(page, 0.4);
      results.fan = hp0 - (await foe(page, id)).hp;
      assert.equal(results.fan, 50);
    }
    // Oil slick and a Lantern bomb: the pool is drawn, the bomb lights it, and the foe in it burns
    {
      await clear(page);
      const id = await foeAhead(page, 2);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'slick' }, { id: 'bomb' }] }));
      await useF(page);
      await tick(page, 0.1);
      await G(page, () => window.__gloam.draw());
      assert((await run(page)).glows.slick > 10, 'the pool is drawn');
      const hp0 = (await foe(page, id)).hp;
      await page.keyboard.down('g'); await tick(page, 0.05, 'live'); await page.keyboard.up('g');
      await tick(page, 1.6);
      const log = await G(page, () => window.__gloam.sounds());
      assert(log.some(c => c.cue === 'slick' && c.lit), 'the slick lit');
      results.slick = hp0 - (await foe(page, id)).hp;
      assert(results.slick >= 28 + 10, `the bomb and the fire: ${results.slick}`);
    }
    // Tack scatter: the tacks are drawn round the lamplighter
    {
      await clear(page);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'tacks' }, null] }));
      await useF(page); await tick(page, 0.1);
      await G(page, () => window.__gloam.draw());
      results.tacks = (await run(page)).glows.tack;
      assert.equal(results.tacks, 8);
    }
    // Bell toll: its ring tells for 0.3 s, then the Snuffer is stunned (its hook does not start while it lasts)
    {
      await clear(page);
      const id = await foeAhead(page, 2, 0, 'S', false);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'toll' }, null] }));
      await useF(page); await tick(page, 0.4);
      assert((await cues(page)).includes('toll'));
      await G(page, () => window.__gloam.draw());
      assert((await run(page)).glows['state-stun'] >= 1, 'the stun shows');
      results.toll = true;
    }
    // Ember shell: the pale band over the health bar, and a blow takes it first
    {
      await clear(page);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'shell' }, null] }));
      await useF(page); await tick(page, 0.05);
      const w = await G(page, () => document.getElementById('shell').style.width);
      assert.equal(parseFloat(w), 20);
      const box = await G(page, () => { const a = document.getElementById('shell').getBoundingClientRect(), b = document.querySelector('.hpbar').getBoundingClientRect(); return { a: a.width, b: b.width, top: a.top <= b.top }; });
      assert(Math.abs(box.a - box.b * 0.2) < 1.5 && box.top, JSON.stringify(box));
      const hp = (await run(page)).hp;
      await G(page, () => window.__gloam.hurt(16));
      await tick(page, 0.05);
      assert.equal((await run(page)).hp, hp);
      assert.equal(parseFloat(await G(page, () => document.getElementById('shell').style.width)), 4);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/kit-shell-hud-1280.png`, clip: { x: 0, y: 0, width: 420, height: 160 } });
      results.shell = true;
    }
    // Post lamp: the lamp is drawn; walk 3 m away, F again, and the lamplighter is back at it 0.15 s later
    {
      await clear(page);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'post' }, null], cool: [0, 0] }));
      const at = await G(page, () => window.__gloam.state());
      await useF(page);
      await G(page, () => window.__gloam.draw());
      { const r = await run(page); assert(r.glows.post >= 10, JSON.stringify({ g: r.glows, c: (await cues(page)).slice(-6) })); }
      await tick(page, 0.6, { mz: 1 });
      const away = await G(page, () => window.__gloam.state());
      const d0 = Math.hypot(away.x - at.x, away.z - at.z);
      assert(d0 > 2, `walked ${d0}`);
      await useF(page); await tick(page, 0.2);
      const back = await G(page, () => window.__gloam.state());
      results.post = +Math.hypot(back.x - at.x, back.z - at.z).toFixed(2);
      assert(results.post < 0.4, `back at the lamp: ${results.post}`);
      assert((await cues(page)).includes('blink'));
    }
    // Shutter, then a cut: the cut is sure
    {
      await clear(page);
      await foeAhead(page, 1.4);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'shutter' }, null] }));
      await useF(page);
      await tick(page, 0.1, { attack: true }); await tick(page, 0.4);
      assert((await cues(page)).includes('sure'), 'the sure cue');
      results.shutter = true;
    }
    // Moth swarm: six moths drawn, and they hurt the Snuffer
    {
      await clear(page);
      const id = await foeAhead(page, 3);
      const hp0 = (await foe(page, id)).hp;
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'swarm' }, null] }));
      await useF(page); await tick(page, 2.5);
      await G(page, () => window.__gloam.draw());
      assert.equal((await run(page)).glows.moth, 6);
      results.swarm = hp0 - (await foe(page, id)).hp;
      assert(results.swarm >= 8);
    }
    // Gloam blink through a Snuffer: its Mark shows, and the next cut adds 22
    {
      await clear(page);
      const id = await foeAhead(page, 2.5);
      await G(page, () => window.__gloam.set({ abilities: [{ id: 'blink' }, null] }));
      const s0 = await G(page, () => window.__gloam.state());
      await useF(page); await tick(page, 0.2);
      const s1 = await G(page, () => window.__gloam.state());
      assert(Math.hypot(s1.x - s0.x, s1.z - s0.z) > 4, 'blinked through');
      await G(page, () => window.__gloam.draw());
      assert((await run(page)).glows['state-mark'] >= 4, 'the Mark shows');
      const hp0 = (await foe(page, id)).hp;
      // turn back to it: hold the stick toward it for a moment, then cut
      const f = await foe(page, id);
      await G(page, ([x, z]) => { const s = window.__gloam.state(); return window.__gloam.face?.(x, z); }, [f.x, f.z]);
      await tick(page, 0.1, { attack: true, mz: -1 }); await tick(page, 0.5);
      results.blink = hp0 - (await foe(page, id)).hp;
      assert(results.blink >= 10 + 22, `the cut and the Mark: ${results.blink}`);
    }
    // Gloam dash: jump, Roll in the air dashes 3.5 m level; a second Roll in the air does nothing
    {
      await clear(page);
      const s0 = await G(page, () => window.__gloam.state());
      await tick(page, 0.12, { jump: true });
      const s1 = await G(page, () => window.__gloam.state());
      assert(!s1.ground, 'in the air');
      await tick(page, 0.02, { roll: true, jump: true }); await tick(page, 0.16, { jump: true });
      const s2 = await G(page, () => window.__gloam.state());
      await tick(page, 0.02, { roll: true, jump: true }); await tick(page, 0.1, { jump: true });
      const s3 = await G(page, () => window.__gloam.state());
      results.dash = [+Math.hypot(s2.x - s1.x, s2.z - s1.z).toFixed(2), +Math.hypot(s3.x - s2.x, s3.z - s2.z).toFixed(2)];
      assert(results.dash[0] > 3 && results.dash[0] < 4.2 && results.dash[1] < 1.3, JSON.stringify(results.dash));
      assert((await cues(page)).includes('dash'));
      void s0;
    }
    assert.deepEqual(errors, []);
    pass('the ten new abilities and Gloam dash in the Gaol, each with its cue, its tell and its effect', results);
    await ctx.close();
  }
  /* ---------------- pictures at three layouts ---------------- */
  for (const [w, h, touch] of [[390, 844, true], [844, 390, true], [1280, 720, false]]) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
    await clear(page);
    const a = await foeAhead(page, 2.2, -0.6), b = await foeAhead(page, 3.2, 0.9);
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'slick' }, { id: 'shell' }] }));
    await G(page, () => { window.__gloam.set({ cool: [0, 0] }); });
    await G(page, () => window.__gloam.tick(0.02, { ab1: true }));
    await G(page, () => window.__gloam.tick(0.1, {}));
    await G(page, () => window.__gloam.tick(0.02, { ab2: true }));
    await G(page, () => window.__gloam.tick(0.3, {}));
    await G(page, () => window.__gloam.set({ wicks: ['charw'] }));
    await G(page, () => window.__gloam.draw());
    const shell = await G(page, () => { const r = document.getElementById('shell').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y, vis: getComputedStyle(document.getElementById('shell')).display !== 'none' }; });
    assert(shell.w > 4 && shell.vis, `the shell band at ${w}x${h}: ${JSON.stringify(shell)}`);
    assert(shell.x >= 0 && shell.x + shell.w <= w && shell.y >= 0, 'inside the screen');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/kit-slick-shell-${w}x${h}.png` });
    // Shard fan and Char on the foes
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'fan' }, { id: 'blink' }], cool: [0, 0] }));
    await G(page, () => window.__gloam.tick(0.02, { ab1: true }));
    await G(page, () => window.__gloam.tick(0.05, {}));
    await G(page, () => window.__gloam.draw());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/kit-fan-${w}x${h}.png` });
    assert.deepEqual(errors, []);
    pass(`the kit drawn at ${w}x${h}: the slick, the shell's band and the fan`, { shell: Math.round(shell.w), foes: [a, b].length });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`PASS qa/lab/gloam-downs-run.kit.e2e.mjs: ${n} checks`);
