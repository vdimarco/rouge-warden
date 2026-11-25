// Gloam Downs: the foes fight back, in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2:
//   in the Gaol, a Snuffer's zone wakes with ember cracks, the Snuffer rises, winds up with its pole back and its cup aglow (the tell
//   adds fire pixels in its box), hooks the lamplighter and takes 21 health (16 × 1.3 at Ember 0); the lamplighter rolls through a hook unhurt; the string
//   puts a Snuffer out, and its 3 glim fly in; the beacon will not catch while the keep's Snuffers stand (the toast names the keep, and
//   a notch points to them), and lights once they are out, its keepers' glim carried on (a lit beacon no longer banks);
//   a Snuffer winding up 6 m beside the lamplighter on a phone gives a notch at the right edge that fills over the wind-up;
//   and one fight each in their places: a Pitchrook's lob onto its ring on The Crow Wall, a Mirelight's pulse over the water of Lantern
//   Fen, and an Ironback's charge lane and slam ring at The Bell Knoll, each marker adding fire pixels on the ground.
// Takes pictures at 1280x720 and 390x844 (SHOTS=<dir> keeps them). Software WebGL draws about one frame a second, so the game steps
// with __gloam.tick and draws only for a picture.
// Needs the site served: python3 -m http.server 8821 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-run.fight.e2e.mjs   (SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8821').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
async function open(viewport, touch = false) {
  // a phone at device scale 3, as most phones held upright: art 147x317, about 46,000 px
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  await (touch ? page.tap('#bBegin') : page.click('#bBegin'));
  return { ctx, page, errors };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const ready = page => page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
// put out every zone of the place but the ones named, so a fight has only the foes it asks for
const clearBut = (page, keep) => G(page, keep => { for (const z of ['G1', 'G2', 'G3', 'G5', 'R1', 'R2', 'R3', 'R4', 'F1', 'F2', 'F3', 'F4', 'B1', 'B2', 'B3', 'B4', 'W1', 'W2', 'W4']) if (!keep.includes(z)) window.__gloam.out(z); window.__gloam.tick(1.2, {}); }, keep);
/* draw, and count the art pixels within 12 (on each of R, G and B) of fire slots 34 to 37 in a box round world points, as CSS px
   from __gloam.project, grown by pad px. -> { fire, box } */
const firePixels = (page, pts, pad = 24, o = {}) => G(page, ({ pts, pad, o }) => {
  const g = window.__gloam;
  g.draw(o);
  const c = document.getElementById('view'), gl = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const r = c.getBoundingClientRect(), sx = w / r.width, sy = h / r.height;
  const q = pts.map(p => g.project(p)).filter(Boolean);
  if (!q.length) return { fire: 0, box: null };
  const x0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[0])) - pad - r.left) * sx)), x1 = Math.min(w - 1, Math.ceil((Math.max(...q.map(v => v[0])) + pad - r.left) * sx));
  const y0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[1])) - pad - r.top) * sy)), y1 = Math.min(h - 1, Math.ceil((Math.max(...q.map(v => v[1])) + pad - r.top) * sy));
  const fire = g.run().fx.grade.slice(34, 38).map(v => [(v >> 16) & 255, (v >> 8) & 255, v & 255]);
  let k = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = ((h - 1 - y) * w + x) * 4;
    if (fire.some(f => Math.abs(px[i] - f[0]) <= 12 && Math.abs(px[i + 1] - f[1]) <= 12 && Math.abs(px[i + 2] - f[2]) <= 12)) k++;
  }
  return { fire: k, box: [x0, y0, x1, y1] };
}, { pts, pad, o });
// a foe's box: from its feet to over its head, and 1.3 m round it, as far as the Snuffer's pole swings its cup
const foeBox = f => [0, 1, 2, 3].flatMap(k => [[f.x + Math.sin(k * Math.PI / 2) * 1.3, f.y, f.z + Math.cos(k * Math.PI / 2) * 1.3], [f.x + Math.sin(k * Math.PI / 2) * 1.3, f.y + 2.2, f.z + Math.cos(k * Math.PI / 2) * 1.3]]);
const ring = (x, y, z, r) => Array.from({ length: 12 }, (_, k) => [x + Math.sin((k * Math.PI) / 6) * r, y, z + Math.cos((k * Math.PI) / 6) * r]);
/* the near third of a ring, toward the camera (which looks along yaw): on the screen it lies below the foe's body, so a tell's glow
   does not count as the ring's fire */
const nearArc = (x, y, z, r, yaw) => Array.from({ length: 9 }, (_, k) => { const a = yaw + ((k - 4) * 15 * Math.PI) / 180; return [x + Math.sin(a) * r, y, z + Math.cos(a) * r]; });

/* ---------------- the desktop: the Gaol ---------------- */
{
  const { ctx, page, errors } = await open({ width: 1280, height: 720 });
  { // the south yard wakes: ember cracks, then the Snuffer rises; it winds up with its glow, and its hook takes 21 health
    await clearBut(page, ['G1', 'G5']);
    const yard = ring(0.3, -2.29, 11.8, 0.8);
    const a = await G(page, () => {
      const g = window.__gloam;
      g.teleport(5.6, 11.2, -Math.PI / 2);
      g.tick(0.25, {});
      return { foes: g.foes(), hp: g.run().hp };
    });
    assert.equal(a.foes.length, 0, 'in the ground while the cracks show');
    const cracks = await firePixels(page, yard, 6);
    await shot(page, 'desk-gaol-cracks');
    // the same view as the cracks fade, with the Snuffer still under the ground at the start of its rise
    await G(page, () => window.__gloam.tick(0.37, {}));
    const dark = await firePixels(page, yard, 6);
    assert(cracks.fire >= dark.fire + 10, `the cracks add ${cracks.fire - dark.fire} fire pixels`);
    const b = await G(page, () => { const g = window.__gloam; g.tick(0.13, {}); const r = g.foes(); g.tick(0.95, {}); return { rising: r, risen: g.foes() }; });
    assert(b.rising.length === 1 && b.rising[0].move === 'rise', JSON.stringify(b.rising));
    assert(b.risen[0] && b.risen[0].move !== 'rise', 'risen after 0.9 s');
    // it notices the lamplighter and comes to hook it
    const c = await G(page, () => {
      const g = window.__gloam;
      for (let i = 0; i < 120 && g.foes()[0].move !== 'hook'; i++) g.tick(1 / 60, {});
      const f = g.foes()[0];
      g.hold(f.id, 'hook', 0);
      g.tick(1 / 60, {});
      return g.foes()[0];
    });
    assert.equal(c.move, 'hook');
    const rest = await firePixels(page, foeBox(c), 4);
    await G(page, id => { window.__gloam.hold(id, 'hook', 0.54); window.__gloam.tick(1 / 60, {}); }, c.id);
    const tell = await firePixels(page, foeBox(c), 4);
    await shot(page, 'desk-gaol-hook-tell');
    assert(tell.fire >= 3 * rest.fire && tell.fire >= rest.fire + 8, `the tell's fire: ${rest.fire} at rest, ${tell.fire} at the end of the wind-up`);
    assert.equal(await G(page, () => window.__gloam.run().fx.tell), 1, 'at 1280x720 the tells keep their size');
    const d = await G(page, id => { const g = window.__gloam; g.hold(id, null); g.tick(0.3, {}); return { hp: g.run().hp, sounds: g.sounds().filter(s => ['scrape', 'hurt'].includes(s.cue)) }; }, c.id);
    assert.equal(d.hp, 79, `the hook took ${100 - d.hp} (16 × 1.3 at Ember 0, foes.js FOE_HARD)`);
    assert(d.sounds.some(s => s.cue === 'hurt'));
    pass('in the Gaol: the yard wakes with cracks, the Snuffer rises, winds up with its glow, and its hook takes 21 health', { cracks: cracks.fire - dark.fire, fire: [rest.fire, tell.fire] });
  }
  { // the lamplighter rolls through a hook unhurt, and the string puts a Snuffer out; its 3 glim fly in
    const r = await G(page, () => {
      const g = window.__gloam;
      g.out('G1');
      g.tick(2, {});
      g.set({ hp: 100 });
      g.teleport(3.2, 11, -Math.PI / 2);
      g.tick(0.1, {});
      const sp = g.spawn('S', 1.2, 11, Math.PI / 2);
      g.tick(1 / 60, {});
      const started = g.foes().find(f => f.id === sp.id).move;
      g.tick(20 / 60, {});
      g.tick(1 / 60, { roll: true, mz: 1 });
      g.tick(1.0, {});
      const s = g.state(), f = g.foes().find(q => q.id === sp.id);
      return { sp, started, hp: g.run().hp, behind: s.x < f.x, x: s.x, fx: f.x };
    });
    assert.equal(r.started, 'hook');
    assert.equal(r.hp, 100, 'no damage');
    assert(r.behind, `out behind the Snuffer: ${r.x} against ${r.fx}`);
    pass('the lamplighter rolls through a hook unhurt and comes out behind the Snuffer');
    const k = await G(page, id => {
      const g = window.__gloam, f = g.foes().find(q => q.id === id), s = g.state();
      const before = { carried: g.run().carried, foes: g.run().foes };
      g.teleport(f.x + 1.9, f.z, -Math.PI / 2);
      g.set({ hp: 100 });
      // held in its recovery, it cannot hook back, so the string's hits land one after another
      g.hold(id, 'hook', 0.75);
      g.tick(3, { attack: true });
      const gone = !g.foes().some(q => q.id === id && q.move !== 'dying');
      const mid = g.run().carried;
      g.tick(1.5, {});
      return { gone, before, mid, after: g.run().carried, foes: g.run().foes };
    }, r.sp.id);
    assert(k.gone, 'the Snuffer is out');
    assert.equal(k.foes, k.before.foes + 1);
    assert.equal(k.after - k.before.carried, 3, `the glim carried went up by ${k.after - k.before.carried}`);
    await G(page, () => window.__gloam.draw());
    await shot(page, 'desk-gaol-glim');
    pass('the string puts a Snuffer out, and its 3 glim fly in', k);
  }
  { // the keep's Snuffers keep the beacon dark: the toast names the keep and a notch points to them; out, the beacon lights
    const r = await G(page, () => {
      const g = window.__gloam;
      g.teleport(-4.3, -21.5, Math.PI);
      g.tick(0.1, {});
      g.light();
      g.draw();
      const toast = document.getElementById('toast').textContent, notches = g.notches(), lit = g.state().lit, bank = g.run().bank, carried = g.run().carried;
      g.out('G5');
      g.light();
      return { toast, notches, lit, bank, carried, after: g.run().bank, carriedAfter: g.run().carried, mode: g.run().mode, place: g.run().place };
    });
    assert(/in the keep/.test(r.toast) && !/north|south|east|west/i.test(r.toast), r.toast);
    assert(r.notches.some(q => q.kind === 'keepers'), JSON.stringify(r.notches));
    assert(!r.lit);
    // gloam-downs-growth: the beacon banks nothing; the keepers' 9 glim (and the 3 before) are carried into the next place
    assert.equal(r.after, r.bank, `banked ${r.after - r.bank}`);
    assert(r.carriedAfter >= 9 + 3, `carried ${r.carriedAfter}`);
    assert.equal(r.place, 'ramparts');
    await shot(page, 'desk-gaol-beacon');
    pass('the beacon stays dark while the keepers stand (the toast names the keep, a notch points to them), and lights once they are out', { toast: r.toast, carried: r.carriedAfter });
  }
  /* ---------------- one fight each in their places ---------------- */
  // walk on to a place: there the beacon card shows with its two wicks; choose the first and walk on
  const to = async (id, keep) => {
    await G(page, id => window.__gloam.go(id), id);
    await ready(page);
    if (await page.isVisible('#beaconCard')) { await page.click('#wicks button'); await page.click('#sparks button'); await page.click('#bWalkOn'); }
    assert.equal(await G(page, () => window.__gloam.run().mode), 'play');
    await G(page, () => window.__gloam.set({ hp: 100 }));
    await clearBut(page, keep);
  };
  { // The Crow Wall: the west flank's Pitchrook lobs; its ring lies where the lamplighter stood, and the coal's glow flies onto it
    await to('ramparts', ['R3']);
    const r = await G(page, () => {
      const g = window.__gloam;
      g.teleport(-8.6, -6.2, -Math.PI / 2);
      g.wake('R3');
      g.tick(1.6, {});
      for (let i = 0; i < 240 && g.foes()[0]?.move !== 'lob'; i++) g.tick(1 / 60, {});
      const f = g.foes()[0], s = g.state();
      g.hold(f.id, 'lob', 0);
      g.tick(1 / 60, {});
      return { f: g.foes()[0], s };
    });
    assert.equal(r.f.move, 'lob');
    const pts = nearArc(r.s.x, r.s.y, r.s.z, 1.3, Math.PI / 2);
    const before = await firePixels(page, pts, 6);
    await G(page, id => { window.__gloam.hold(id, 'lob', 0.79); window.__gloam.tick(1 / 60, {}); }, r.f.id);
    const after = await firePixels(page, pts, 6);
    await shot(page, 'desk-ramparts-lob-ring');
    assert(after.fire >= before.fire + 20, `the ring adds ${after.fire - before.fire} fire pixels`);
    const hit = await G(page, id => { const g = window.__gloam, hp = g.run().hp; g.hold(id, null); g.tick(0.25, {}); g.draw(); return { hp, coal: true }; }, r.f.id);
    await shot(page, 'desk-ramparts-coal');
    const land = await G(page, hp => { const g = window.__gloam; g.tick(1, {}); return hp - g.run().hp; }, hit.hp);
    assert.equal(land, 23, `the coal took ${land} (18 × 1.3 at Ember 0)`);
    pass('The Crow Wall: a Pitchrook lobs onto a ring laid where the lamplighter stood, and its coal takes 23 (18 × 1.3 at Ember 0)', { ring: after.fire - before.fire });
  }
  { // Lantern Fen: a Mirelight floats over the water, swells and pulses a ring on the water's surface
    await to('fen', ['F1']);
    const r = await G(page, () => {
      const g = window.__gloam;
      g.teleport(0.6, 7.4, Math.PI / 2);
      g.wake('F1');
      g.tick(1.6, {});
      for (let i = 0; i < 300 && !g.foes().some(f => f.move === 'pulse'); i++) g.tick(1 / 60, {});
      const f = g.foes().find(q => q.move === 'pulse');
      g.hold(f.id, 'pulse', 0);
      g.tick(1 / 60, {});
      return { f: g.foes().find(q => q.id === f.id), all: g.foes() };
    });
    assert(r.f && r.f.y >= -0.01, `it floats over the water: ${r.f?.y}`);
    const pts = nearArc(r.f.x, 0, r.f.z, 2.1, -Math.PI / 2);
    const before = await firePixels(page, pts, 6);
    await G(page, id => { window.__gloam.hold(id, 'pulse', 0.69); window.__gloam.tick(1 / 60, {}); }, r.f.id);
    const after = await firePixels(page, pts, 6);
    await shot(page, 'desk-fen-pulse-ring');
    assert(after.fire >= before.fire + 20, `the ring adds ${after.fire - before.fire} fire pixels`);
    pass('Lantern Fen: a Mirelight floats over the water and grows its pulse ring on the surface', { ring: after.fire - before.fire, y: +r.f.y.toFixed(2) });
  }
  { // The Bell Knoll: the vale's Ironback grows its charge lane, and then its slam ring
    await to('bells', ['B1']);
    const r = await G(page, () => {
      const g = window.__gloam;
      g.teleport(-0.5, 18.0, Math.PI);
      g.wake('B1');
      g.tick(1.6, {});
      for (let i = 0; i < 300 && g.foes()[0]?.move !== 'charge'; i++) g.tick(1 / 60, {});
      const f = g.foes()[0];
      g.hold(f.id, 'charge', 0.85);
      g.tick(1 / 60, {});
      return { f: g.foes()[0], s: g.state() };
    });
    assert.equal(r.f.move, 'charge');
    await G(page, () => window.__gloam.draw());
    await shot(page, 'desk-bells-charge-lane');
    const pts = nearArc(r.f.x, r.f.y, r.f.z, 2.9, 0);
    const before = await G(page, id => { window.__gloam.hold(id, 'slam', 0); window.__gloam.tick(1 / 60, {}); }, r.f.id).then(() => firePixels(page, pts, 6));
    await G(page, id => { window.__gloam.hold(id, 'slam', 0.74); window.__gloam.tick(1 / 60, {}); }, r.f.id);
    const after = await firePixels(page, pts, 6);
    await shot(page, 'desk-bells-slam-ring');
    assert(after.fire >= before.fire + 20, `the slam ring adds ${after.fire - before.fire} fire pixels`);
    pass('The Bell Knoll: an Ironback grows its charge lane, and its slam ring adds fire on the ground', { ring: after.fire - before.fire });
  }
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
}

/* ---------------- a phone: the tell and the notch ---------------- */
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, true);
  await clearBut(page, []);
  const r = await G(page, () => {
    const g = window.__gloam;
    g.teleport(5.6, 11.2, -Math.PI / 2);
    g.tick(0.1, {});
    const sp = g.spawn('S', 1.6, 11.2, Math.PI / 2);
    g.tick(1 / 60, {});
    g.hold(sp.id, 'hook', 0.54);
    g.tick(1 / 60, {});
    return { f: g.foes()[0] };
  });
  const tell = await firePixels(page, foeBox(r.f), 4);
  await shot(page, 'phone-gaol-hook-tell');
  await G(page, id => { window.__gloam.hold(id, 'hook', 0); window.__gloam.tick(1 / 60, {}); }, r.f.id);
  const rest = await firePixels(page, foeBox(r.f), 4);
  assert(tell.fire >= 3 * rest.fire && tell.fire >= rest.fire + 8, `on a phone: ${rest.fire} at rest, ${tell.fire} at the end of the wind-up`);
  // the figures are smaller on a phone held upright, so the tells grow (fight.js tellGrow)
  const grow = await G(page, () => window.__gloam.run().fx.tell);
  assert(grow > 1.4 && grow < 1.6, `on a phone the tells grow ${grow} times`);
  /* a Snuffer 6 m to the right, held at 0.1 s and then 0.5 s of its hook: a notch at the right edge, 18% and then 91% full. A phone
     held upright sees ±4.6 m to each side of the lamplighter, so a foe 3 m to the side is in view */
  const q = await G(page, id => {
    const g = window.__gloam;
    g.out(id);
    g.tick(1.2, {});
    const s = g.state(), sp = g.spawn('S', s.x, s.z - 6.0, 0);
    g.tick(1 / 60, {});
    g.hold(sp.id, 'hook', 0.1);
    g.tick(1 / 60, {});
    const a = g.notches();
    g.hold(sp.id, 'hook', 0.5);
    g.tick(1 / 60, {});
    g.draw();
    const b = g.notches();
    const ctl = ['#bAttack', '#bRoll', '#bHeal', '#bJump', '#hud', '#tools', '.labbar .back', '#menu'].map(sel => document.querySelector(sel)).filter(e => e && !e.hidden).map(e => e.getBoundingClientRect());
    const over = b.some(n => ctl.some(c => n.rect.left < c.right && n.rect.right > c.left && n.rect.top < c.bottom && n.rect.bottom > c.top));
    return { a, b, over, sp, offScreen: (() => { const p = g.project([s.x, s.y + 0.9, s.z - 6.0]); return !p || p[0] > innerWidth || p[0] < 0; })() };
  }, r.f.id);
  await shot(page, 'phone-gaol-notch');
  assert(q.sp?.ok !== false, `the spawn: ${JSON.stringify(q.sp)}`);
  assert(q.offScreen, 'the Snuffer is outside the view');
  assert(q.a.length === 1 && q.a[0].edge === 'right', JSON.stringify(q.a));
  assert(Math.abs(q.a[0].fill - 0.18) <= 0.1 && Math.abs(q.b[0].fill - 0.91) <= 0.1, `${q.a[0].fill} then ${q.b[0].fill}`);
  assert(!q.over, 'the notch overlaps no control');
  // the Ironback's slam ring on a phone
  await G(page, () => window.__gloam.go('bells'));
  await ready(page);
  await clearBut(page, []);
  const s = await G(page, () => {
    const g = window.__gloam;
    g.teleport(-0.5, 16.0, Math.PI);
    g.tick(0.1, {});
    const sp = g.spawn('I', -0.5, 12.3, 0);
    g.tick(1 / 60, {});
    g.hold(sp.id, 'slam', 0);
    g.tick(1 / 60, {});
    return g.foes()[0];
  });
  const pts = nearArc(s.x, s.y, s.z, 2.9, 0);
  const before = await firePixels(page, pts, 6);
  await G(page, id => { window.__gloam.hold(id, 'slam', 0.74); window.__gloam.tick(1 / 60, {}); }, s.id);
  const after = await firePixels(page, pts, 6);
  await shot(page, 'phone-bells-slam-ring');
  assert(after.fire >= before.fire + 20, `on a phone the slam ring adds ${after.fire - before.fire} fire pixels`);
  pass('on a phone: the tell reads, a Snuffer beside the lamplighter gives a notch at the right edge that fills, and the slam ring reads', { tell: [rest.fire, tell.fire], grow: +grow.toFixed(3), fill: [q.a[0].fill, q.b[0].fill], ring: after.fire - before.fire });
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
}
await browser.close();
console.log(`${n} checks passed`);
