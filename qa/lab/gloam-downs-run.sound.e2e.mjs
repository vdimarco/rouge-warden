// Gloam Downs: the run's sound and music in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2:
//   no AudioContext and no file of audio/ before the first press, one running context after it; the arrival card's silence, then the
//   place's theme; a cut in the sound log with its wind-up, its target types, its context time and its variant; the duck of a finisher;
//   a zone that wakes and is put out: the combat layer in on the beat and out on the bar 2 s after; the beacon's stinger, then the
//   Lamp-room theme; the Lamp-room's card, focus, buy and refused buy; the pause panel's filter and its Sound and Music switches, both
//   off suspending the context, and Music off kept over a reload; a hidden page suspended with no new notes; the boss's intro, phases
//   and fall; the swing's whoosh keyed to the wind-up (rendered offline); the bank failing; the phone mix; no sound in the explorer,
//   in Wander or in a Lamp-room opened from Wander's Map; the effects' lag behind the picture; Sound off with Music on lays no effect;
//   a roll that cuts a swing leaves no swing voice; and a phone tap on a browser that only lets touchend or click start sound (an
//   AudioContext stub that starts suspended and refuses resume() outside those events), which must end with a running context.
// Software WebGL draws about one frame a second, so the game steps with __gloam.tick. The score runs on the context's own clock, in
// real time, so the music checks wait in real time.
// Needs the site served: python3 -m http.server 8841 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.sound.e2e.mjs   (SITE_URL to point elsewhere, ONLY=run,boss,more)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8841').replace(/\/$/, '');
const part = name => !process.env.ONLY || process.env.ONLY.split(',').includes(name);
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const G = (page, fn, arg) => page.evaluate(fn, arg);
const wait = ms => new Promise(r => setTimeout(r, ms));
// every AudioContext the page makes, counted before quiet.js wraps the class
const COUNT = () => {
  const A = window.AudioContext;
  window.__ctxs = [];
  window.AudioContext = class extends A { constructor(...a) { super(...a); window.__ctxs.push(this); } };
};
async function open(url, o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1280, height: 720 }, hasTouch: !!o.touch, isMobile: !!o.touch });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (o.failBank) await ctx.route('**/gloam-downs/audio/**', r => r.fulfill({ status: 404, body: '' }));
  if (o.strict) await ctx.addInitScript(STRICT);
  await ctx.addInitScript(COUNT);
  const page = await ctx.newPage(), errors = [], audio = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().includes('/gloam-downs/audio/')) audio.push(r.url()); });
  await page.goto(`${SITE}/lab/gloam-downs/${url}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  return { ctx, page, errors, audio };
}
const ctxs = page => G(page, () => window.__ctxs.map(c => c.state));
/* an iPhone's rules on a stub AudioContext: a context made outside touchend or click starts suspended, and resume() outside them is
   refused. The page's own events are read first (this listener is added before the page's) */
const STRICT = () => {
  const A = window.AudioContext;
  window.__gest = null; window.__stub = [];
  for (const k of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown']) {
    window.addEventListener(k, e => { window.__gest = e.type; setTimeout(() => { if (window.__gest === e.type) window.__gest = null; }, 0); }, true);
  }
  const ok = () => window.__gest === 'touchend' || window.__gest === 'click';
  window.AudioContext = class extends A {
    constructor(...a) { super(...a); this.__st = ok() ? 'running' : 'suspended'; window.__stub.push({ made: window.__gest, state: this.__st }); }
    get state() { return this.__st === 'running' ? super.state : this.__st; }
    resume() {
      if (!ok()) { window.__stub.push({ refused: window.__gest }); return Promise.reject(new DOMException('no gesture', 'NotAllowedError')); }
      this.__st = 'running'; window.__stub.push({ resumed: window.__gest });
      return super.resume();
    }
    suspend() { this.__st = 'suspended'; return super.suspend(); }
  };
};
const music = page => G(page, () => window.__gloam.music());
// is t on the grid of the theme now playing (its t0 and bar), within 5 ms
const onGrid = (m, t, unit = m.bar) => { const k = (t - m.t0) / unit; return Math.abs(k - Math.round(k)) * unit <= 0.005; };

if (part('run')) {
  const { ctx, page, errors, audio } = await open('?run&test&fresh&seed=7');
  { // no context before a press, one after it
    await wait(3000);
    assert.deepEqual(await ctxs(page), [], 'no AudioContext before a press');
    assert.equal(audio.length, 0, `audio/ loaded before a press: ${audio}`);
    const label = await G(page, () => { window.__gloam.close?.(); return document.getElementById('bSound').textContent; });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__ctxs.length === 1 && window.__ctxs[0].state === 'running', null, { timeout: 10000 });
    await page.waitForFunction(() => window.__gloam.music().bank !== 'loading', null, { timeout: 20000 });
    const m = await music(page);
    assert.equal(m.mix, 'desktop');
    assert(m.samples > 20, `${m.samples} samples in the bank`);
    assert(audio.length > 20 && audio.every(u => !u.includes('README')));
    pass('no AudioContext and no audio/ file before the first press; one running context and the bank after Enter', { samples: m.samples, label });
  }
  { // the arrival card's silence, then the theme on the first bar line after it closes
    const a = await G(page, () => { const g = window.__gloam; g.tick(0.5, {}); return { m: g.music(), off: document.getElementById('arrive').classList.contains('off') }; });
    assert.equal(a.off, false);
    assert.equal(a.m.state, 'silent');
    assert(a.m.amb, 'the place sounds made in code play under the card');
    const closed = await G(page, () => { const g = window.__gloam; for (let i = 0; i < 400 && !document.getElementById('arrive').classList.contains('off'); i++) g.tick(1 / 60, {}); return g.music().time; });
    await wait(3500);
    const m = await music(page);
    assert.equal(m.state, 'place'); assert.equal(m.place, 'gaol'); assert.deepEqual(m.layers, ['explore']);
    assert(m.bar >= 1.9 && m.bar <= 3.0);
    const first = m.changes.find(c => c.what === 'place');
    assert(first.at >= closed - 0.01 && first.at - closed <= m.bar + 0.25 && onGrid(m, first.at), `place at ${first.at}, card closed at ${closed}`);
    pass('the arrival card is silent but for the place sounds; the theme starts on the first bar line after it closes', { bar: +m.bar.toFixed(3), wait: +(first.at - closed).toFixed(3) });
  }
  { // a cut in the log
    const r = await G(page, () => {
      const g = window.__gloam, s = g.state();
      g.clearPosts();
      const sp = g.spawn('S', s.x + Math.sin(s.yaw) * 1.5, s.z + Math.cos(s.yaw) * 1.5, s.yaw + Math.PI);
      g.hold(sp.id, 'idle');
      const from = g.sounds().length, steps = [];
      g.tick(1 / 60, { attack: true });
      for (let i = 0; i < 30; i++) { g.tick(1 / 60, {}); steps.push(g.run().stop); }
      g.hold(sp.id, null);
      return { log: g.sounds().slice(from), id: sp.id };
    });
    const swing = r.log.find(c => c.cue === 'swing'), strike = r.log.find(c => c.cue === 'strike'), hit = r.log.find(c => c.cue === 'hit');
    assert(swing && swing.hit === 'cut1' && swing.wind === 6 && swing.act === 5 && swing.strike === 4, JSON.stringify(swing));
    // the whoosh is keyed to the move's strike event, and peaks lead steps on, on the hit's own step
    assert(strike && strike.hit === 'cut1' && strike.step - swing.step === swing.strike && strike.step + strike.lead === hit.step, JSON.stringify([swing, strike, hit]));
    assert(hit.at >= strike.at && strike.at >= swing.at, `laid out of order: ${swing.at} ${strike.at} ${hit.at}`);
    assert(hit && hit.hit === 'cut1' && hit.on[0] === 'S' && hit.stop === 3, JSON.stringify(hit));
    assert(hit.step - swing.step === 6, `the hit lands ${hit.step - swing.step} steps after the swing`);
    for (const c of [swing, strike, hit]) assert(Number.isFinite(c.at) && Number.isInteger(c.v), `no at or v: ${JSON.stringify(c)}`);
    // the effects' lag behind the picture: how far ahead the cue was laid and the limiter's pre-delay, under 30 ms (plus the output's
    // own latency, which the browser adds)
    const lag = (await music(page)).lag;
    assert(lag && lag.lead >= 0 && lag.lead + lag.pre <= 0.03, `the effects trail the picture by ${JSON.stringify(lag)}`);
    pass('a cut: swing with cut1, wind 6, act 5 on the press; strike at its strike step, lead steps before the hit; hit with on [S] on the first active step; each with at and v; the effects trail the picture by under 30 ms plus the output latency', { swing: { step: swing.step, at: swing.at, v: swing.v }, hit: { step: hit.step, at: hit.at, v: hit.v }, lag });
    // the Snuffer goes out (its duck is 5 dB), and the duck comes back before the next check
    await G(page, id => { window.__gloam.out(id); window.__gloam.tick(0.5, {}); }, r.id);
    await wait(1000);
  }
  { // the duck of a finisher: 4 dB down within 15 ms of its at, held through the hit stop, back within 1 dB 300 ms later
    const d = await G(page, async () => {
      const g = window.__gloam, s = g.state();
      g.post(s.x + Math.sin(s.yaw) * 1.1, s.z + Math.cos(s.yaw) * 1.1);
      const from = g.sounds().length;
      for (let i = 0; i < 60 && !g.sounds().slice(from).some(c => c.cue === 'hit' && c.hit === 'fin'); i++) g.tick(1 / 60, { attack: true });
      const fin = g.sounds().slice(from).find(c => c.cue === 'hit' && c.hit === 'fin');
      const out = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 900) { const m = g.music(); out.push([+(m.time - fin.at).toFixed(4), m.buses.duck]); await new Promise(r => setTimeout(r, 4)); }
      g.clearPosts();
      return { fin, out };
    });
    const at = (lo, hi) => d.out.filter(([t]) => t >= lo && t <= hi).map(x => x[1]);
    const held = at(0.015, 5 / 60 - 0.005), back = at(5 / 60 + 0.3, 1);
    assert(held.length && held.every(v => Math.abs(v + 4) <= 0.6), `the duck in the hit stop: ${held}`);
    assert(back.length && back.every(v => v > -1), `the duck 300 ms after: ${back}`);
    pass('a finisher ducks the music 4 dB through its hit stop, and it is back within 1 dB 300 ms later', { held: [Math.min(...held), Math.max(...held)], back: Math.min(...back) });
  }
  { // the combat layer: in on a beat when G2 wakes, full on the bar; out on the first bar line 2 s or more after its foes go out
    // the Snuffer of the cut had the combat layer in: it leaves first
    await page.waitForFunction(() => !window.__gloam.music().layers.includes('combat'), null, { timeout: 12000 });
    await wait(3200);
    // the zone's cracks show for 0.6 s, then its foes rise: the layer follows the awake foes
    const wake = await G(page, () => { const g = window.__gloam; g.wake('G2'); for (let i = 0; i < 120 && !g.foes().length; i++) g.tick(1 / 60, {}); return g.music().time; });
    await wait(4000);
    const quiet = await G(page, () => { const g = window.__gloam; g.out('G2'); g.tick(1.0, {}); return g.music().time; });
    await wait(6500);
    const m = await music(page), cin = m.changes.findLast(c => c.what === 'combat in'), full = m.changes.findLast(c => c.what === 'combat full'), out = m.changes.findLast(c => c.what === 'combat out');
    const beat = m.bar / 4;
    assert(cin && cin.at >= wake - 0.01 && cin.at - wake <= beat + 0.2 && onGrid(m, cin.at, beat), `combat in ${JSON.stringify(cin)} for a wake at ${wake}`);
    assert(full && onGrid(m, full.at), 'combat full on a bar line');
    assert(out && out.at >= quiet + 2 - 0.05 && onGrid(m, out.at), `combat out ${JSON.stringify(out)}, the foes out at ${quiet}`);
    assert.deepEqual(m.layers, ['explore']);
    pass('G2 wakes: the combat layer comes in on a beat and is full on the bar; 2 s after its foes are out it leaves on the bar', { in: +(cin.at - wake).toFixed(3), out: +(out.at - quiet).toFixed(3) });
  }
  { // every layer and theme change on a bar line, within 5 ms
    const m = await music(page);
    for (const c of m.changes.filter(c => ['place', 'combat full', 'combat out'].includes(c.what))) assert(onGrid(m, c.at), `${c.what} at ${c.at}`);
    pass('every place, combat full and combat out change is on a bar line within 5 ms', { changes: m.changes.length });
  }
  { // the beacon: its stinger, then the Lamp-room theme on the beacon card
    await G(page, () => { const g = window.__gloam; for (const z of ['G1', 'G2', 'G3', 'G5']) g.out(z); g.tick(1.2, {}); g.light(); g.tick(1.6, {}); });
    await wait(4500);
    const m = await music(page), w = m.changes.map(c => c.what);
    const s = w.lastIndexOf('sting beacon');
    assert(s >= 0 && w.indexOf('lamp', s) > s, w.join(', '));
    assert.equal(m.state, 'lamp');
    assert(!errors.length, errors.join(' | '));
    pass('a lit beacon plays its stinger, and the Lamp-room theme follows it on the beacon card', { changes: w.slice(-4) });
  }
  { // the Lamp-room: card, focus twice, buy and a refused buy
    const log = await G(page, async () => {
      const g = window.__gloam;
      document.getElementById('bSpend').click();
      g.set({ bank: 40 });
      const from = g.sounds().length;
      document.getElementById('lamp').hidden = true; g.lamp('beacon');
      await new Promise(r => setTimeout(r, 50));
      const btns = [...document.querySelectorAll('#ups button')].filter(b => !b.hidden);
      btns[1].focus(); btns[0].focus();
      document.querySelector('#ups li[data-up="mantle"] button').click();
      g.set({ bank: 0 });
      document.querySelector('#ups li[data-up="mantle"] button').click();
      return g.sounds().slice(from).map(c => c.cue);
    });
    const want = ['card', 'focus', 'focus', 'buy', 'refuse'];
    assert.deepEqual(log.filter(c => want.includes(c)), want, log.join(', '));
    pass('the Lamp-room logs card, focus twice, buy and refuse, in that order', log);
  }
  { // the pause panel: its filter and its switches
    await G(page, () => { document.getElementById('bLampBack').click(); document.querySelector('#wicks button')?.click(); document.getElementById('bWalkOn').click(); });
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.state().place === 'ramparts', null, { timeout: 120000 });
    await G(page, () => { const g = window.__gloam; for (let i = 0; i < 400 && !document.getElementById('arrive').classList.contains('off'); i++) g.tick(1 / 60, {}); });
    await G(page, () => window.__gloam.set({ hp: 30 }));
    await G(page, () => window.__gloam.tick(0.1, {}));
    const low = (await music(page)).filter;
    await page.keyboard.press('p');
    await wait(200);
    const p = await G(page, () => ({ m: window.__gloam.music(), sound: document.getElementById('bSound').textContent, mus: document.getElementById('bMusic').textContent, n: window.__gloam.sounds().length }));
    assert.equal(low, 900); assert.equal(p.m.filter, 600);
    assert.equal(p.sound, 'Sound on'); assert.equal(p.mus, 'Music on');
    // focus order: Resume, Sound, Music, Back to the start, End the run
    const order = await G(page, () => [...document.querySelectorAll('#pauseRow button')].map(b => b.id));
    assert.deepEqual(order, ['bResume', 'bSound', 'bMusic', 'bRestart', 'bEnd']);
    await page.click('#bMusic');
    await wait(300);
    const off = await music(page);
    assert.equal(off.state, 'off'); assert(off.buses.music < 1e-3, `the music bus at ${off.buses.music}`);
    await page.click('#bSound');
    await page.waitForFunction(() => window.__ctxs[0].state === 'suspended', null, { timeout: 500 });
    await page.click('#bSound');
    await page.waitForFunction(() => window.__ctxs[0].state === 'running', null, { timeout: 2000 });
    // the panel is open: a cut stepped under it lays no effect (the game does not step while paused, so the cue is logged by the
    // test's tick, which steps it anyway)
    const under = await G(page, () => {
      const g = window.__gloam, s = g.state(), from = g.sounds().length;
      g.post(s.x + Math.sin(s.yaw) * 1.1, s.z + Math.cos(s.yaw) * 1.1);
      g.tick(0.3, { attack: true });
      g.clearPosts();
      return { log: g.sounds().slice(from), m: g.music() };
    });
    assert(under.log.every(c => c.at === undefined) && under.m.fxVoices === 0, `effects laid under the pause panel: ${JSON.stringify(under.log.filter(c => c.at !== undefined))}`);
    console.log(`  (under the pause panel the test's tick logged ${under.log.length} cues)`);
    pass('the pause panel low-passes the score to 600 Hz (900 Hz at low health); Music off takes the bus to 0; both off suspend the context, and on again resumes it', { order });
    await page.keyboard.press('Escape');
    await G(page, () => window.__gloam.set({ hp: 200 }));
    // Music off, a cut still logs and the effects play
    const cut = await G(page, () => {
      const g = window.__gloam, s = g.state();
      g.post(s.x + Math.sin(s.yaw) * 1.1, s.z + Math.cos(s.yaw) * 1.1);
      const from = g.sounds().length;
      g.tick(0.4, { attack: true });
      g.clearPosts();
      return { log: g.sounds().slice(from), m: g.music() };
    });
    assert(cut.log.some(c => c.cue === 'hit' && Number.isFinite(c.at)), 'the cut is logged and laid with Music off');
    assert.equal(cut.m.state, 'off'); assert(cut.m.buses.fx > 0.5);
    // Sound off with Music on: a cut is logged, and no effect is laid
    await page.keyboard.press('p'); await wait(150);
    await G(page, () => { document.getElementById('bMusic').click(); document.getElementById('bSound').click(); });
    await page.keyboard.press('Escape'); await wait(300);
    const mute = await G(page, async () => {
      const g = window.__gloam, s = g.state();
      await new Promise(r => setTimeout(r, 1200));
      g.post(s.x + Math.sin(s.yaw) * 1.1, s.z + Math.cos(s.yaw) * 1.1);
      const from = g.sounds().length;
      g.tick(0.4, { attack: true });
      g.clearPosts();
      return { log: g.sounds().slice(from), m: g.music(), label: document.getElementById('bSound').textContent };
    });
    assert(mute.log.some(c => c.cue === 'hit') && mute.log.every(c => c.at === undefined), `effects laid with Sound off: ${JSON.stringify(mute.log)}`);
    assert.equal(mute.m.fxVoices, 0); assert.notEqual(mute.m.state, 'off'); assert.equal(mute.label, 'Sound off');
    // Sound on again, and Music off for the reload below
    await page.keyboard.press('p'); await wait(150);
    await G(page, () => { document.getElementById('bSound').click(); document.getElementById('bMusic').click(); });
    await page.keyboard.press('Escape');
    // a reload keeps Music off
    await page.goto(`${SITE}/lab/gloam-downs/?run&test&seed=7`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
    await page.mouse.click(640, 360);
    await page.keyboard.press('p');
    await wait(200);
    assert.equal(await page.textContent('#bMusic'), 'Music off');
    // (the click on the view took the mouse; the button is pressed as the focus would press it)
    await G(page, () => document.getElementById('bMusic').click());
    assert.equal(await page.textContent('#bMusic'), 'Music on');
    await page.keyboard.press('Escape');
    pass('with Music off a cut is still logged and played on the effects bus; under the pause panel and with Sound off (Music on) a cut lays no effect; a reload keeps Music off');
  }
  { // a hidden page: suspended, and no new notes
    await G(page, () => { const g = window.__gloam; for (let i = 0; i < 400 && !document.getElementById('arrive').classList.contains('off'); i++) g.tick(1 / 60, {}); });
    await wait(3000);
    const a = await G(page, () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      return window.__gloam.music().notes;
    });
    await page.waitForFunction(() => window.__ctxs.at(-1).state === 'suspended', null, { timeout: 3000 });
    await wait(2000);
    const b = await G(page, () => window.__gloam.music().notes);
    assert.equal(b, a, `${b - a} notes laid while hidden`);
    await G(page, () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__ctxs.at(-1).state === 'running', null, { timeout: 5000 });
    await wait(1500);
    const m = await music(page);
    assert(m.notes > b, 'notes again when shown');
    pass('a hidden page is suspended and lays no notes; shown again, the score goes on', { notes: m.notes - b });
  }
  assert(!errors.length, errors.join(' | '));
  await ctx.close();
}

if (part('boss')) {
  const { ctx, page, errors } = await open('?run&test&fresh&seed=7');
  await page.click('#bBegin');
  await G(page, () => window.__gloam.go('barrows'));
  await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'barrows', null, { timeout: 180000 });
  await page.waitForFunction(() => window.__gloam.boss()?.files === 'in', null, { timeout: 120000 });
  await G(page, () => { const g = window.__gloam; for (const z of ['W1', 'W2', 'W4']) g.out(z); g.set({ hp: 200 }); g.teleport(18, -22 + 10.5, Math.PI); g.tick(0.1, {}); });
  const intro = await G(page, () => window.__gloam.music());
  assert.equal(intro.state, 'boss'); assert.equal(intro.phase, 0);
  await G(page, () => window.__gloam.tick(2.6, {}));
  await wait(3000);
  const p1 = await music(page);
  assert.equal(p1.phase, 1);
  const log = [];
  for (const hp of [700, 300]) {
    const t = await G(page, hp => { const g = window.__gloam; g.hold('B', null); g.set({ bossHp: hp }); g.tick(0.05, {}); return g.music().time; }, hp);
    await wait(3000);
    const m = await music(page), c = m.changes.findLast(x => x.what.startsWith('boss '));
    assert(c.at - t <= 2.0, `the phase starts ${c.at - t} s after the stumble`);
    assert(onGrid(m, c.at), `phase ${m.phase} not on a bar line`);
    log.push({ phase: m.phase, bpm: m.bpm, after: +(c.at - t).toFixed(3) });
  }
  assert.deepEqual(log.map(x => x.phase), [2, 3]);
  assert(log[1].bpm > log[0].bpm);
  const tail = await G(page, () => { const g = window.__gloam; g.set({ bossHp: 0 }); g.tick(0.1, {}); return g.boss().state; });
  await wait(1500);
  assert.equal((await music(page)).state, 'silent');
  await wait(2000);
  const after = await music(page);
  assert.equal(after.theme, 'light');
  // the tells of the boss's attacks: each on the first step of its wind-up
  pass('the boss: the intro\'s drone, phase 1 with the boss bar, phases 2 and 3 on bar lines inside the stumble, faster in phase 3, silence after the fall, then the light', { log, tail });
  assert(!errors.length, errors.join(' | '));
  await ctx.close();
}

if (part('more')) {
  { // the swing's whoosh (the draw-back on 'swing', the whoosh on 'strike') peaks one step before the first active step, so it leads
    // into the hit, for a wind-up of 6 steps and of 14 (read from the strike on, less the delay of the effects' limiter)
    const { ctx, page } = await open('?run&test&fresh&seed=7');
    const r = await G(page, async () => {
      const { createMix, createSound } = await import('./sound.js');
      const out = {};
      for (const wind of [6, 14]) {
        const c = new OfflineAudioContext(1, 44100, 44100), mix = createMix(c), fx = createSound(c, { mix });
        fx.play('swing', 0.1, { hit: 'cut1', wind, act: 5, strike: wind - 2 });
        fx.play('strike', 0.1 + (wind - 2) / 60, { hit: 'cut1', lead: 2, act: 5 });
        const d = (await c.startRendering()).getChannelData(0), w = 441;
        let best = -1, at = 0;
        for (let i = Math.round((0.1 + (wind - 2) / 60) * 44100); i + w < d.length; i += 44) { let e = 0; for (let k = i; k < i + w; k += 2) e += d[k] * d[k]; if (e > best) { best = e; at = i; } }
        out[wind] = +((at + w / 2) / 44100 - mix.delay.fx - 0.1 - wind / 60).toFixed(4);
      }
      return out;
    });
    for (const [w, e] of Object.entries(r)) assert(Math.abs(e + 1 / 60) <= 0.006, `wind ${w}: the loudest 10 ms of the whoosh is ${e} s from the wind-up's end, not one step before it`);
    // a roll that cuts a wind-up ends the swing voice within 2 steps
    const cut = await G(page, () => {
      const g = window.__gloam;
      g.close?.();
      document.getElementById('bBegin').click();
      const from = g.sounds().length;
      g.tick(1 / 60, { attack: true }); g.tick(2 / 60, {});
      const before = g.music().fxLive;
      g.tick(1 / 60, { roll: true });
      const after = g.music().fxLive;
      g.tick(2 / 60, {});
      const later = g.music().fxLive;
      g.tick(0.6, {});
      return { log: g.sounds().slice(from).map(c => ({ cue: c.cue, cut: c.cut, step: c.step })), before, after, later, ctx: g.music().ctx };
    });
    assert(cut.log.find(c => c.cue === 'roll')?.cut === true && !cut.log.some(c => c.cue === 'hit'), JSON.stringify(cut.log));
    // the swing voice was sounding, and the roll's cut ends it: no swing or strike voice is left 2 steps after it
    assert(cut.ctx === 'running' && cut.before.includes('swing'), JSON.stringify(cut));
    assert(!cut.after.some(n => n === 'swing' || n === 'strike') && !cut.later.some(n => n === 'swing' || n === 'strike'), JSON.stringify(cut));
    pass('the whoosh peaks one step before the wind-up\'s end at a wind-up of 6 and of 14 steps; a roll cuts it, no hit is logged, and no swing voice is left', { r, before: cut.before, after: cut.later });
    await ctx.close();
  }
  { // the bank fails: the code voices play, and the page shows no error
    const { ctx, page, errors } = await open('?run&test&fresh&seed=7', { failBank: true });
    await page.click('#bBegin');
    await page.waitForFunction(() => window.__gloam.music()?.bank === 'failed', null, { timeout: 20000 });
    await G(page, () => { const g = window.__gloam; for (let i = 0; i < 400 && !document.getElementById('arrive').classList.contains('off'); i++) g.tick(1 / 60, {}); g.wake('G2'); for (let i = 0; i < 120 && !g.foes().length; i++) g.tick(1 / 60, {}); });
    await wait(4500);
    const m = await music(page);
    assert.equal(m.state, 'place'); assert(m.layers.includes('combat'), JSON.stringify(m.layers)); assert(m.notes > 10);
    assert(!errors.length, errors.join(' | '));
    pass('with every audio/ request failing, the score plays with its code voices and the combat layer, with no error', { notes: m.notes });
    await ctx.close();
  }
  { // the phone mix
    const { ctx, page } = await open('?run&test&fresh&seed=7', { touch: true, viewport: { width: 390, height: 844 } });
    await page.tap('#bBegin');
    await page.waitForFunction(() => window.__ctxs.length === 1, null, { timeout: 5000 });
    await wait(300);
    const m = await music(page);
    assert.equal(m.mix, 'phone'); assert.equal(m.buses.hp, 90);
    const { MIX } = await G(page, async () => ({ MIX: (await import('./sound.js')).MIX }));
    assert(Math.abs(20 * Math.log10(m.buses.music) - (MIX.music + MIX.phoneMusic)) < 0.2, `the phone music bus at ${20 * Math.log10(m.buses.music)} dB`);
    assert.equal(m.ahead, 0.3, `the phone score lays ${m.ahead} s ahead`);
    pass('a coarse pointer: the phone mix, the music bus 3 dB lower, the high-pass at 90 Hz, the score laid 300 ms ahead', { bus: +(20 * Math.log10(m.buses.music)).toFixed(2), ahead: m.ahead });
    await ctx.close();
  }
  { // a phone tap on a browser with iPhone rules: the context is made on an activation, and a later event in the same tap resumes it
    const { ctx, page, errors } = await open('?run&test&fresh&seed=7', { touch: true, strict: true, viewport: { width: 390, height: 844 } });
    await page.tap('#bBegin');
    await page.waitForFunction(() => window.__ctxs.length === 1 && window.__ctxs[0].state === 'running', null, { timeout: 5000 });
    await wait(300);
    const r = await G(page, () => ({ stub: window.__stub, state: window.__ctxs[0].state, label: document.getElementById('bSound').textContent }));
    assert(!r.stub.some(x => x.made === 'pointerdown'), `the context was made on a touch's pointerdown: ${JSON.stringify(r.stub)}`);
    assert.equal(r.state, 'running');
    assert(!/starts on a key or tap/.test(r.label), r.label);
    assert(!errors.length, errors.join(' | '));
    pass('a tap with iPhone rules: no context on the touch\'s pointerdown, and a running context after the tap; the Sound line no longer waits', r.stub);
    await ctx.close();
  }
  { // no sound in the explorer, in Wander or in a Lamp-room opened from Wander's Map
    for (const url of ['?explore', '?wander']) {
      const { ctx, page } = await open(url + '&test&fresh');
      await page.mouse.click(640, 360); await page.keyboard.press('Enter');
      await G(page, () => { const g = window.__gloam; g.close(); g.wisp(0); g.light(); });
      await page.keyboard.press('ArrowUp'); await wait(500);
      assert.deepEqual(await ctxs(page), [], `${url === '?explore' ? 'the explorer' : url} made an AudioContext`);
      assert.deepEqual(await G(page, () => window.__gloam.sounds()), []);
      await ctx.close();
    }
    const { ctx, page } = await open('?run&test&fresh&seed=7');
    await G(page, () => { window.__gloam.close?.(); window.__gloam.lamp('wander'); });
    await page.keyboard.press('ArrowDown'); await page.mouse.click(5, 400);
    assert.deepEqual(await ctxs(page), [], 'the Lamp-room from Wander\'s Map made a context');
    await page.click('#bLampBegin');
    await page.waitForFunction(() => window.__ctxs.length === 1, null, { timeout: 5000 });
    pass('the explorer and Wander make no AudioContext and log no cue; a Lamp-room from Wander\'s Map is silent until Begin the run');
    await ctx.close();
  }
}
await browser.close();
console.log(`PASS qa/lab/gloam-downs-run.sound.e2e.mjs: ${n} checks`);
