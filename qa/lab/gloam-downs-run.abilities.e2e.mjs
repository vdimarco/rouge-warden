// Gloam Downs' abilities, keys and hidden ground in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2
// (openspec/changes/gloam-downs-growth):
//   inputs: F and G with the keys, the mouse's side buttons 3 and 4 (the page takes them, so the browser does not go back), the pad's
//     LB and LT (LT no longer rolls), and the touch buttons #bAb1 and #bAb2;
//   the HUD: #abilities with each slot's key and name, its seconds while it cools; on a touch screen the two buttons, 44 px or more,
//     inside the screen and clear of the other buttons and the HUD, at 320x640, 390x844, 360x640, 844x390; #abilities inside the HUD
//     and clear of the health and count lines at 800x600 and 1280x720;
//   lamps drawn: a pattern lamp, an ability lamp and the place's caches are dabs of the draw; an ability lamp fills an empty slot;
//   keys: Crow step from the set hook, the Gaol's first ledge reached with its way from its stand and its cache opened (and not without
//     the key), and the pause panel's keys line.
// Needs this tree served:   python3 -m http.server 8765 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.abilities.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir>)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { SPOTS } from '../../public/lab/gloam-downs/keys.js';
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
const run = page => G(page, () => window.__gloam.run());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
async function open(ctxOpts, query = '?run&test&seed=7&nodraw', save = { seen: true, bank: 0 }) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(o => { try { localStorage.setItem('gloam-downs.run.v3', JSON.stringify(o)); } catch {} }, save);
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
  // a touch screen is played by touch: a click would tell the page a mouse is there
  if (ctxOpts.hasTouch) await page.tap('#bLampBegin'); else await page.click('#bLampBegin');
  await page.waitForFunction(() => window.__gloam.run().mode === 'play', null, { timeout: 180000 });
  return { ctx, page, errors };
}
const used = async page => (await G(page, () => window.__gloam.sounds())).filter(c => c.ability && c.slot !== undefined).map(c => c.ability);
const R = el => el.getBoundingClientRect();

try {
  /* ---------------- inputs: keys, side buttons, pad ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'bomb' }, { id: 'flare' }] }));
    for (const k of ['f', 'g']) { await page.keyboard.down(k); await tick(page, 0.05, 'live'); await page.keyboard.up(k); await tick(page, 0.05, 'live'); }
    assert.deepEqual(await used(page), ['bomb', 'flare']);
    let r = await run(page);
    assert(r.abilities[0].left > 7 && r.abilities[1].left > 13, JSON.stringify(r.abilities));
    // the HUD: the slot's key, its name and the seconds left
    await G(page, () => window.__gloam.draw());
    assert.match(await page.textContent('#abilities'), /^FLantern bomb \d+ sGFlare \d+ s$/);
    // the side buttons: back is slot 1, forward slot 2; the page takes their events, so the browser does not go back
    await G(page, () => window.__gloam.set({ cool: [0, 0] }));
    const prevented = await G(page, () => {
      const c = document.getElementById('view'), out = [];
      for (const b of [3, 4]) {
        c.dispatchEvent(new PointerEvent('pointerdown', { button: b, pointerType: 'mouse', bubbles: true }));
        const down = new MouseEvent('mousedown', { button: b, bubbles: true, cancelable: true });
        c.dispatchEvent(down);
        const up = new MouseEvent('mouseup', { button: b, bubbles: true, cancelable: true });
        c.dispatchEvent(up);
        const aux = new MouseEvent('auxclick', { button: b, bubbles: true, cancelable: true });
        c.dispatchEvent(aux);
        out.push(down.defaultPrevented && up.defaultPrevented && aux.defaultPrevented);
        window.__gloam.tick(0.05, 'live');
      }
      return out;
    });
    assert.deepEqual(prevented, [true, true], 'back and forward never reach the browser');
    assert.deepEqual((await used(page)).slice(2), ['bomb', 'flare']);
    // the pad: LB slot 1, LT slot 2, and LT no longer rolls
    await G(page, () => window.__gloam.set({ cool: [0, 0] }));
    for (const b of [4, 6]) { await G(page, i => window.__press(i, true), b); await tick(page, 0.05, 'live'); r = await run(page); assert.notEqual(r.move, 'roll', 'LT does not roll'); await G(page, i => window.__press(i, false), b); await tick(page, 0.05, 'live'); }
    assert.deepEqual((await used(page)).slice(4), ['bomb', 'flare']);
    assert.deepEqual(errors, []);
    pass('inputs: F and G, the side buttons 3 and 4 (with back and forward taken), and the pad\'s LB and LT start the two abilities; LT does not roll');
    await ctx.close();
  }

  /* ---------------- lamps and caches drawn; an ability lamp taken ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&seed=7');
    const s = await G(page, () => window.__gloam.state());
    await G(page, ([x, y, z]) => window.__gloam.set({ dropPattern: 'rime', abilityLamps: [{ id: 'moth', bright: true, x: x + 3, y, z }] }), [s.x, s.y, s.z]);
    // the pattern lands at the feet and is taken at once; drop it 3 m off with the run's own hook to see it drawn
    await G(page, ([x, y, z]) => { window.__gloam.set({ abilities: [{ id: 'bomb' }, null] }); }, [s.x, s.y, s.z]);
    await G(page, () => window.__gloam.draw());
    const r = await run(page);
    assert(r.glows.ability >= 5, JSON.stringify(r.glows));
    assert((r.glows.cache || 0) + (r.glows.stone || 0) >= 4, 'the Gaol\'s caches are drawn');
    await G(page, ([x, z]) => window.__gloam.teleport(x + 3, z, 0), [s.x, s.z]);
    await tick(page, 0.1, {});
    assert.deepEqual((await run(page)).abilities[1]?.id, 'moth', 'the lamp fills the empty slot');
    assert.deepEqual(errors, []);
    pass('lamps: an ability lamp and the place\'s caches are drawn as dabs, and a touch takes the lamp into the empty slot', r.glows);
    await ctx.close();
  }

  /* ---------------- keys: the Gaol's first ledge ---------------- */
  {
    const sp = SPOTS.gaol.find(x => x.kind === 'ledge');
    const tryWay = async (page, keys) => {
      await G(page, k => window.__gloam.set({ keys: k }), keys);
      const ux = sp.at[0] - sp.from[0], uz = sp.at[2] - sp.from[2];
      await G(page, ([f, yaw]) => window.__gloam.teleport(f[0], f[2], yaw, f[1] + 0.3), [sp.from, Math.atan2(ux, uz)]);
      await tick(page, 0.3, {});
      // the way as the ledge scan played it: run for way.run s, jump held way.hold s, and again way.leapAt s after the take-off
      return G(page, ([w, at]) => {
        const g = window.__gloam;
        for (let i = 0; i < 180; i++) {
          const t = i / 60, s = g.state(), over = Math.hypot(s.x - at[0], s.z - at[2]) < 0.5, h = over ? {} : { mz: 1 };
          if (t >= w.run) { const j = t - w.run; h.jump = j < w.hold; if (j >= w.leapAt && j < w.leapAt + 0.3) h.jump = j >= w.leapAt + 1 / 60; }
          g.tick(1 / 60, h);
        }
        return g.run().caches;
      }, [sp.way, sp.at]);
    };
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
    assert.deepEqual(await tryWay(page, []), [], 'no cache without Crow step');
    assert.deepEqual(await tryWay(page, ['leap']), [sp.id]);
    await page.keyboard.press('p');
    await page.waitForSelector('#pause:not([hidden])');
    assert.equal(await page.textContent('#keysLine'), 'Keys: Crow step');
    assert.match(await page.textContent('#pauseControls'), /Jump again in the air: Crow step\./);
    assert.deepEqual(errors, []);
    pass(`keys: the Gaol's ${sp.id} is reached with Crow step from its stand and its cache opens; not without it; the pause panel names the key`);
    await ctx.close();
  }

  /* ---------------- the layouts ---------------- */
  for (const [w, h, touch] of [[320, 640, true], [390, 844, true], [360, 640, true], [844, 390, true], [800, 600, false], [1280, 720, false]]) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, ...(touch ? TOUCH : {}) });
    await G(page, () => window.__gloam.set({ abilities: [{ id: 'bomb', bright: true }, { id: 'rime' }] }));
    await G(page, () => window.__gloam.draw());
    const faults = await G(page, touch => {
      const out = [], over = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const inside = r => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
      const R = el => el.getBoundingClientRect(), shown = el => el && !el.hidden && el.getClientRects().length;
      if (touch) {
        const abs = ['bAb1', 'bAb2'].map(id => document.getElementById(id));
        const others = ['bAttack', 'bRoll', 'bHeal', 'bJump', 'hud', 'tools'].map(id => document.getElementById(id)).filter(shown);
        for (const b of abs) {
          if (!shown(b)) { out.push(`${b.id} hidden`); continue; }
          const r = R(b);
          if (Math.min(r.width, r.height) < 44) out.push(`${b.id} is ${r.width}`);
          if (!inside(r)) out.push(`${b.id} outside the screen`);
          for (const o of [...others, ...abs.filter(x => x !== b)]) if (over(r, R(o))) out.push(`${b.id} over ${o.id}`);
        }
        if (shown(document.getElementById('abilities'))) out.push('the HUD row shows on touch');
      } else {
        const a = document.getElementById('abilities');
        if (!shown(a)) out.push('no #abilities');
        else {
          const r = R(a), hud = R(document.getElementById('hud'));
          if (r.left < hud.left - 0.5 || r.right > hud.right + 0.5 || r.bottom > hud.bottom + 0.5) out.push('#abilities outside the HUD');
          for (const id of ['life', 'count', 'where']) if (over(r, R(document.getElementById(id)))) out.push(`#abilities over #${id}`);
          if (!inside(r)) out.push('#abilities outside the screen');
        }
        if (['bAb1', 'bAb2'].some(id => shown(document.getElementById(id)))) out.push('the touch buttons show with a mouse');
      }
      if (document.scrollingElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways');
      return out;
    }, touch);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/abilities-${w}x${h}.png` });
    assert.deepEqual(faults, [], `${w}x${h}: ${faults.join('; ')}`);
    if (touch) {
      await page.tap('#bAb1');
      await tick(page, 0.05, 'live');
      assert.deepEqual(await used(page), ['bomb'], 'a tap on the first button');
      assert(await G(page, () => document.getElementById('bAb1').classList.contains('bright')), 'a bright ability has its gold edge');
      // the cooldown's sweep: nearly all of it left on slot 1, none on slot 2
      await G(page, () => window.__gloam.draw());
      const cd = await G(page, () => ['bAb1', 'bAb2'].map(id => +getComputedStyle(document.getElementById(id)).getPropertyValue('--cd')));
      assert(cd[0] > 0.9 && cd[1] === 0, `sweeps ${cd}`);
    }
    assert.deepEqual(errors, []);
    pass(`layout ${w}x${h}${touch ? ' (touch)' : ''}: ${touch ? 'the two ability buttons, 44 px, clear of the others and inside the screen; a tap uses one' : 'the HUD\'s ability row inside the HUD, clear of the health and count lines'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
