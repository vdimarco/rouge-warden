// Gloam Downs: the boss fight, in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2:
//   the boss files come in after play starts in Barrow Crown; within 11 m of the arena the intro stops the game with its card and its
//   bars, the candles light and the boss bar shows (in the Lab bar row); each of the five attacks shows its tell and its ground marker
//   in view in its wind-up; a phase change stumbles the boss; the fall breaks it, and the light comes to the lantern; a reload after
//   the fall goes on at the arena with the light, also when the boss files fail; the carried light lights the last beacon, the win card
//   shows 1.8 s of game time later, and a reload before it shows it again with the wins counted once; and when the boss files fail,
//   the loading screen shows Try again and Step back with ◀ Lab above it.
// Takes pictures of the intro, each attack's wind-up and the fall at 1280x720 and 390x844 (SHOTS=<dir> keeps them). Software WebGL
// draws about one frame a second, so the game steps with __gloam.tick and draws only for a picture.
// Needs the site served: python3 -m http.server 8831 --bind 127.0.0.1 --directory public
// Run: node qa/lab/gloam-downs-run.boss.e2e.mjs   (SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8831').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const C = [18, 0.68, -22];
const G = (page, fn, arg) => page.evaluate(fn, arg);
// a picture of the game as it is now: ?test draws only when asked, and a card's fade has 0.4 s to end
const shot = async (page, name) => { if (!SHOTS) return; await page.evaluate(() => window.__gloam.draw()); await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
// a reload of the page as a player makes it: the same address without &fresh, so the save is read
const reload = page => page.goto(`${SITE}/lab/gloam-downs/?run&test&seed=7`);
const ready = page => page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
async function open(viewport, touch = false, o = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (o.failBoss) await ctx.route('**/worlds/boss.*', r => r.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/?run&test&fresh&seed=7`);
  await ready(page);
  await (touch ? page.tap('#bBegin') : page.click('#bBegin'));
  await G(page, () => window.__gloam.go('barrows'));
  await ready(page);
  return { ctx, page, errors };
}
const bossIn = page => page.waitForFunction(() => window.__gloam.boss()?.files === 'in', null, { timeout: 120000 });
// a point dm from the arena's centre, toward the start (south of it), and the yaw that faces the centre
const toward = d => ({ x: C[0], z: C[2] + d, yaw: Math.PI });
/* draw, and count the art pixels within 12 (on each of R, G and B) of fire slots 34 to 37 in a box round world points (as CSS px from
   __gloam.project, grown by pad px) -> { fire, box, seen }: seen is how many of the points are on the screen */
const firePixels = (page, pts, pad = 16) => G(page, ({ pts, pad }) => {
  const g = window.__gloam;
  g.draw();
  const c = document.getElementById('view'), gl = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const r = c.getBoundingClientRect(), sx = w / r.width, sy = h / r.height;
  const q = pts.map(p => g.project(p)).filter(Boolean);
  const seen = q.filter(v => v[0] >= r.left && v[0] <= r.right && v[1] >= r.top && v[1] <= r.bottom).length;
  if (!q.length) return { fire: 0, box: null, seen };
  const x0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[0])) - pad - r.left) * sx)), x1 = Math.min(w - 1, Math.ceil((Math.max(...q.map(v => v[0])) + pad - r.left) * sx));
  const y0 = Math.max(0, Math.floor((Math.min(...q.map(v => v[1])) - pad - r.top) * sy)), y1 = Math.min(h - 1, Math.ceil((Math.max(...q.map(v => v[1])) + pad - r.top) * sy));
  const fire = g.run().fx.grade.slice(34, 38).map(v => [(v >> 16) & 255, (v >> 8) & 255, v & 255]);
  let k = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = ((h - 1 - y) * w + x) * 4;
    if (fire.some(f => Math.abs(px[i] - f[0]) <= 12 && Math.abs(px[i + 1] - f[1]) <= 12 && Math.abs(px[i + 2] - f[2]) <= 12)) k++;
  }
  return { fire: k, box: [x0, y0, x1, y1], seen };
}, { pts, pad });
// the points of a marker, on the ground: the sweeps' front slices, the slam's ring, the three shard rings, the lunge's lane
function markerPoints(m) {
  const arc = (x, y, z, r, a0, a1, k = 9) => Array.from({ length: k }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (k - 1); return [x + Math.sin(a) * r, y + 0.05, z + Math.cos(a) * r]; });
  if (m.kind === 'slices') return arc(m.x, m.y, m.z, Math.max(0.5, m.R), m.face - Math.PI / 2, m.face + Math.PI / 2);
  if (m.kind === 'ring') return arc(m.x, m.y, m.z, Math.max(0.5, m.R), 0, Math.PI * 2, 12);
  if (m.kind === 'shards') return m.rings.flatMap(r => arc(r.x ?? r[0], (r.y ?? r[1]) , r.z ?? r[2], Math.max(0.3, m.R), 0, Math.PI * 2, 6));
  if (m.kind === 'lane') return Array.from({ length: 6 }, (_, i) => [m.x + Math.sin(m.yaw) * m.len * (i / 5), m.y + 0.05, m.z + Math.cos(m.yaw) * m.len * (i / 5)]);
  return [];
}
// where the lamplighter stands for each attack, and the time of its wind-up to look at (near its end, the marker grown)
const ATT = {
  sweep: { d: 2.6, behind: false, t: 0.6 },
  slam: { d: 2.4, behind: true, t: 0.8 },
  shards: { d: 5.5, behind: false, t: 0.7 },
  lunge: { d: 7.5, behind: false, t: 0.55 },
  dsweep: { d: 2.6, behind: false, t: 1.3 }
};
// stand the lamplighter at a place relative to the boss, then hold the boss at t s of the attack
const stage = (page, name) => G(page, ({ name, a }) => {
  const g = window.__gloam, b = g.boss();
  const yaw = b.yaw + (a.behind ? Math.PI : 0);
  const x = b.x + Math.sin(yaw) * a.d, z = b.z + Math.cos(yaw) * a.d;
  g.teleport(x, z, Math.atan2(b.x - x, b.z - z));
  g.hold('B', name, a.t);
  g.tick(0.05, {});
  return g.boss();
}, { name, a: ATT[name] });

/* ---------------- the fight at one layout ---------------- */
async function fight(viewport, touch, tag) {
  const { ctx, page, errors } = await open(viewport, touch);
  { // the boss files come in after play starts in Barrow Crown; the arena sleeps till then
    const b0 = await G(page, () => window.__gloam.boss());
    assert(b0 && b0.state === 'wait');
    await bossIn(page);
    const b1 = await G(page, () => window.__gloam.boss());
    assert.equal(b1.ready, true);
    if (tag === 'desktop') pass('the boss files load after play starts in Barrow Crown, and the boss waits in its arena', { before: b0.files });
  }
  { // the intro at 10.5 m: the stop, the bars, the card; then the boss bar and the fight
    const p = toward(10.5);
    await G(page, p => { const g = window.__gloam; g.set({ hp: 100 }); g.teleport(p.x, p.z, p.yaw); g.tick(0.1, {}); }, p);
    const a = await G(page, () => {
      const g = window.__gloam;
      g.tick(0.6, {});
      const r = g.run(), el = id => document.getElementById(id);
      return { state: g.boss().state, mode: r.mode, bars: r.fx.bars, zoom: r.fx.zoom, n: el('arriveN').textContent, name: el('arriveName').textContent,
        shown: !el('arrive').classList.contains('off'), bar: g.boss().bar, awake: g.foes().filter(f => f.type !== 'B').length };
    });
    await shot(page, `${tag}-intro`);
    assert.equal(a.state, 'intro');
    assert.equal(a.mode, 'intro');
    assert(a.bars > 0, 'the bars are in');
    assert.equal(a.n, 'V · The last light of the downs');
    assert.equal(a.name, 'The Barrow Reeve');
    assert(a.shown);
    assert.equal(a.bar, null, 'no boss bar in the intro');
    const b = await G(page, () => { const g = window.__gloam; g.tick(2.0, {}); return { boss: g.boss(), mode: g.run().mode, pool: g.pool().slots.filter(s => s.awake).map(s => s.code) }; });
    assert.equal(b.mode, 'play');
    assert.equal(b.boss.state === 'idle' || b.boss.state === 'move', true);
    assert(b.boss.bar && b.boss.bar.width > 100, 'the boss bar shows');
    assert(b.boss.bar.top < 60, 'in the Lab bar row');
    assert(b.pool.includes('B') && b.pool.includes('C'), 'the boss slot and the candles are awake');
    assert(b.pool.every(c => ['B', 'C', 'L'].includes(c)), 'the other slots are parked');
    const back = await G(page, () => document.querySelector('.labbar .back').getBoundingClientRect().toJSON()), menu = await G(page, () => document.getElementById('menu').getBoundingClientRect().toJSON());
    assert(b.boss.bar.left >= back.right && b.boss.bar.right <= menu.left, 'between ◀ Lab and Games');
    pass(`${tag}: the intro stops the game with the bars and "V · The last light of the downs"; then the boss bar in the Lab bar row, the boss and candle slots awake`, { bars: a.bars, bar: [Math.round(b.boss.bar.left), Math.round(b.boss.bar.width)], awake: b.pool });
  }
  { // the boss camera is on in the arena, and the boss is a target
    const c = await G(page, () => { const g = window.__gloam; g.teleport(18, -18, Math.PI); g.tick(1.0, {}); const s = g.state(); return { boss: s.cam.boss, n: g.combat().foes.length }; });
    assert(c.boss && c.boss.on, 'the boss camera frames the fight in the arena');
    // the grave stone south of the arena is under the raised pitch: the camera stays out at its frame and does not dive to the stone
    assert(c.boss.dist >= 11.9, `the boss camera stays out at 12 m or more (${c.boss.dist})`);
    pass(`${tag}: in the arena the boss camera is on, 12 m or more out with the stone behind`, { dist: c.boss.dist && Math.round(c.boss.dist * 100) / 100 });
  }
  // the attacks: phase 1 has the sweeps and the slam; phase 2 the shards and the lunge; phase 3 the double sweep
  for (const [name, hp] of [['sweep', 1300], ['slam', 1300], ['shards', 700], ['lunge', 700], ['dsweep', 300]]) {
    const ph = await G(page, hp => { const g = window.__gloam; g.hold('B', null); if (g.boss().hp !== hp) { g.set({ bossHp: hp }); g.tick(2.3, {}); } return g.boss(); }, hp);
    if (hp === 700 && name === 'shards') {
      assert.equal(ph.phase, 2);
      if (tag === 'desktop') pass('a phase change: set({ bossHp: 700 }) puts the boss in phase 2 after one stumble');
    }
    const b = await stage(page, name);
    assert.equal(b.move, name);
    assert.equal(b.seg, 'wind');
    assert(b.marker, `${name} lays its marker`);
    const f = await firePixels(page, markerPoints(b.marker));
    await shot(page, `${tag}-${name}`);
    assert(f.seen >= 3, `${name}: its marker is in view (${f.seen} points)`);
    assert(f.fire >= 20, `${name}: its marker adds fire (${f.fire})`);
    pass(`${tag}: the ${name} winds up with its marker in view`, { fire: f.fire, seen: f.seen, kind: b.marker.kind });
  }
  { // the phase change itself: hits do nothing in the stumble
    const s = await G(page, () => { const g = window.__gloam; g.hold('B', null); g.set({ bossHp: 1300 }); g.tick(2.5, {}); g.set({ bossHp: 790 }); g.tick(0.3, {}); return g.boss(); });
    assert.equal(s.state, 'stumble');
    assert.equal(s.phase, 2);
    if (tag === 'desktop') pass('below 800 the boss stumbles, in phase 2', { hp: s.hp });
  }
  { // the fall: a stop, the bars, the parts; the light rises and rides at the lantern; 30 glim carried; stored with bossDown
    const before = await G(page, () => { const g = window.__gloam; g.tick(2.0, {}); g.teleport(18, -19, Math.PI); g.tick(0.1, {}); return g.run().carried; });
    const a = await G(page, () => { const g = window.__gloam; g.set({ bossHp: 0 }); g.tick(0.12, {}); const r = g.run(); return { state: g.boss().state, stop: r.stop, bars: r.fx.bars }; });
    await shot(page, `${tag}-fall`);
    assert.equal(a.state, 'fall');
    const b = await G(page, () => { const g = window.__gloam; g.tick(2.4, {}); const r = g.run(); return { boss: g.boss(), carried: r.carried, down: r.bossDown, bars: r.fx.bars, toast: document.getElementById('toast').textContent, stored: JSON.parse(localStorage.getItem('gloam-downs.run.v1') || 'null') }; });
    await shot(page, `${tag}-light`);
    assert.equal(b.boss.light.state, 'carried');
    assert.equal(b.carried, before + 30);
    assert.equal(b.down, true);
    assert.equal(b.stored.run.bossDown, true, 'stored at once');
    assert.equal(b.bars, 0, 'the bars are out while the light is carried');
    assert.equal(b.boss.bar, null, 'the boss bar is gone');
    assert.match(b.toast, /Carry the light to the beacon/);
    pass(`${tag}: the fall breaks the boss; its light rides at the lantern, 30 glim carried, the run stored with bossDown`, { stop: a.stop, carried: b.carried });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { ctx, page, errors };
}

/* ---------------- the desktop: the whole fight, the reloads and the win ---------------- */
{
  const { ctx, page, errors } = await fight({ width: 1280, height: 720 }, false, 'desktop');
  { // a reload after the fall, with the boss files failing: no loading screen, the arena, the light, no zone awake
    await ctx.route('**/worlds/boss.*', r => r.fulfill({ status: 404, body: '' }));
    const carried = await G(page, () => window.__gloam.run().carried);
    await reload(page);
    await ready(page);
    const r = await G(page, () => { const g = window.__gloam; g.tick(1.0, {}); const s = g.state(), b = g.boss(), run = g.run(); return { mode: run.mode, light: b.light.state, files: b.files, state: b.state, carried: run.carried, at: Math.hypot(s.x - 18, s.z + 22), loading: !document.getElementById('loading').classList.contains('done'), awake: g.foes().length }; });
    assert.equal(r.mode, 'play');
    assert.equal(r.loading, false, 'no loading screen');
    assert.equal(r.state, 'down');
    assert.equal(r.light, 'carried');
    assert.equal(r.carried, carried);
    assert.equal(r.awake, 0, 'no zone wakes');
    pass('a reload after the fall, with the boss files failing, goes on at the arena with the light and no loading screen', { files: r.files, carried: r.carried });
  }
  { // the carried light lights the last beacon; the win card 1.8 s of game time later; a reload before it shows it again
    const w = await G(page, () => {
      const g = window.__gloam, b = g.points().beacon;
      g.teleport(b[0] + 1.0, b[2] + 1.0, 0);
      g.tick(0.3, {});
      const r = g.run();
      return { mode: r.mode, bank: r.bank, ended: r.ended, card: !document.getElementById('winCard').hidden };
    });
    assert(w.ended && w.ended.won, 'the win is stored');
    assert.equal(w.card, false, 'no win card yet');
    const wins = await G(page, () => JSON.stringify(localStorage));
    await G(page, () => window.__gloam.tick(0.7, {}));
    await reload(page);
    await ready(page);
    const r = await G(page, () => ({ card: !document.getElementById('winCard').hidden, rows: [...document.querySelectorAll('#winCard dd')].map(d => d.textContent), wander: !document.getElementById('bWinWander').hidden }));
    assert.equal(r.card, true);
    assert.equal(r.wander, true, 'the first win opens Wander');
    await shot(page, 'desktop-win');
    const after = await G(page, () => JSON.stringify(localStorage));
    const count = s => JSON.parse(JSON.parse(s)['gloam-downs.run.v1']).wins;
    assert.equal(count(after), 1, 'the wins counted once');
    assert.equal(count(wins), 1);
    pass('the carried light lights the last beacon; the win is stored at once, and a reload before the card shows it again, with Wander', { rows: r.rows, wins: count(after) });
  }
  { // the win card after 1.8 s of game time, in a fresh win
    const t = await G(page, () => {
      const g = window.__gloam;
      document.getElementById('bWinLamp').click();
      return g.run().mode;
    });
    assert.notEqual(t, 'ended');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

/* ---------------- a phone held upright ---------------- */
{
  const { ctx, page, errors } = await fight({ width: 390, height: 844 }, true, 'phone');
  { // the light to the beacon: the win card shows 1.8 s of game time after the beacon lights, and not before
    const a = await G(page, () => {
      const g = window.__gloam, b = g.points().beacon, el = () => !document.getElementById('winCard').hidden;
      g.teleport(b[0] + 1.0, b[2] + 1.0, 0);
      g.tick(0.05, {});
      const lit = g.run().mode;
      g.tick(1.6, {});
      const early = el();
      g.tick(0.4, {});
      return { lit, early, late: el(), bars: g.run().fx.bars };
    });
    assert.equal(a.early, false);
    assert.equal(a.late, true);
    await shot(page, 'phone-win');
    pass('phone: the win card shows 1.8 s of game time after the last beacon lights', a);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

/* ---------------- the boss files fail ---------------- */
{
  const { ctx, page, errors } = await open({ width: 1280, height: 720 }, false, { failBoss: true });
  await page.waitForFunction(() => window.__gloam.boss()?.files === 'failed', null, { timeout: 60000 });
  const p = toward(14);
  const a = await G(page, p => {
    const g = window.__gloam;
    g.teleport(p.x, p.z, p.yaw);
    g.tick(0.2, {});
    g.teleport(p.x, p.z + -4.5, p.yaw);
    g.tick(0.2, {});
    const el = id => document.getElementById(id), back = document.querySelector('.labbar .back').getBoundingClientRect();
    const top = document.elementFromPoint(back.left + back.width / 2, back.top + back.height / 2);
    return { arrive: !el('arrive').classList.contains('off'), waiting: g.boss().waiting, line: el('loadLine').textContent, retry: !el('bRetry').hidden, step: !el('bBack').hidden, lab: !!top?.closest('.labbar'), focus: document.activeElement?.id, h: [el('bRetry').getBoundingClientRect().height, el('bBack').getBoundingClientRect().height, back.height] };
  }, p);
  await shot(page, 'desktop-boss-failed');
  assert.equal(a.waiting, true);
  assert.equal(a.arrive, false, 'no arrival card over the loading screen');
  assert.match(a.line, /The Barrow Reeve did not load/);
  assert(a.retry && a.step);
  assert.equal(a.focus, 'bRetry');
  assert.equal(a.lab, true, '◀ Lab is above the loading screen');
  assert(a.h.every(h => h >= 44));
  await page.click('#bRetry');
  await page.waitForFunction(() => window.__gloam.boss()?.files === 'failed' && !document.getElementById('bBack').hidden, null, { timeout: 60000 });
  await page.click('#bBack');
  const b = await G(page, () => { const g = window.__gloam; g.tick(0.5, {}); const s = g.state(); return { mode: g.run().mode, d: Math.hypot(s.x - 18, s.z + 22), state: g.boss().state }; });
  assert.equal(b.mode, 'play');
  assert(b.d >= 13, `Step back puts the lamplighter 13 m or more away (${b.d})`);
  assert.equal(b.state, 'wait');
  pass('the boss files fail: at 11 m the loading screen says so with Try again (focused) and Step back, ◀ Lab above it; Step back goes 13 m or more away and the arena sleeps', { d: Math.round(b.d * 10) / 10 });
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

await browser.close();
console.log(`\n${n} checks passed`);
