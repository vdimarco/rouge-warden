// Ahead of the Light's feedback (final.md 17, 18.5, 20, 22.1): through window.__race.feedback(), every event type that
// has a sound, an effect (the overlay's, a caption or the big digits) or a haptic starts it on its own frame, the
// first frame after the step that made the event. Counts are kept where effects start, not where events arrive.
// Stretches at 390 × 844 touch, on the hook's own clock (realtime(false)), in 0.05 s chunks of advance with one frame
// after each, so every run is the same: the toy with
// the mid bot (grazes, burns, the whip, the draft, REMORA), leg 1 with the mid bot (the soft start, gears, the gate),
// leg 2 idle (hits, the shield, the glare, the catch), leg 3 with the whipper (the red zone, scorches, the WHALE),
// leg 6 (MAKO), Earth's landing, and the VOID with big burns (LIGHT SPEED, a dry click). Types a stretch never made are
// listed, not failed. A rival's motif may be dropped by design (two at once at most), so those need only one play.
//   NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/feedback.e2e.mjs      (the site served on 8765)
import { launch, open, reporter, R, wait, waitMode } from './e2e-lib.mjs';

const rep = reporter('Ahead of the Light: feedback');
const { check } = rep;

// For each event type: which channels answer it, and for which events (the rules of 17 and the overlay's).
const YOU = (e) => e.ship === 'you';
const RAM = (e) => e.victim === 'you' || e.by === 'you';
const TABLE = {
  graze: { s: YOU, e: YOU, h: YOU }, hair: { s: YOU, e: YOU, h: YOU }, rivalGraze: { s: YOU, e: YOU },
  chainEnd: { s: (e) => YOU(e) && e.chain > 1, e: (e) => YOU(e) && e.chain > 1 },
  burn: { s: YOU, e: YOU, h: YOU }, oberth: { s: YOU, e: YOU, h: YOU }, dry: { s: YOU, e: YOU },
  pickFuel: { s: YOU, e: YOU }, pickPatch: { s: YOU, e: YOU }, window: { s: YOU }, grab: { s: YOU, e: YOU },
  latchCancel: { s: YOU }, redIn: { s: YOU, e: YOU }, scorchWarn: { s: YOU }, scorch: { s: YOU, e: YOU },
  release: { s: YOU, e: YOU }, draftFull: { s: YOU }, slingshot: { s: YOU, e: YOU },
  contact: { s: RAM, e: RAM, h: (e) => e.victim === 'you' && e.kind === 'slam' },
  spill: { s: (e) => YOU(e) || e.to === 'you', e: (e) => YOU(e) || e.to === 'you' },
  takedown: { s: RAM, e: (e) => e.by === 'you', h: (e) => e.by === 'you' },
  hit: { s: YOU, e: YOU, h: YOU }, bump: { s: YOU, e: YOU }, shieldPop: { s: YOU, e: YOU, h: YOU },
  shieldBack: { s: YOU, e: YOU }, lastHull: { s: YOU }, gearUp: { s: YOU, e: YOU }, gearDown: { s: YOU, e: YOU },
  headlight: { s: YOU, e: YOU }, lightspeed: { s: YOU, e: YOU }, dropout: { s: YOU, e: YOU },
  thread: { s: (e) => YOU(e) && !e.miss, e: YOU }, dock: { s: YOU, e: YOU }, past: { s: YOU, e: YOU },
  push: { e: YOU }, warn: { s: YOU }, glareIn: { s: YOU }, caught: { s: YOU, e: YOU, h: YOU }, wreck: { s: YOU, e: YOU, h: YOU },
  eaten: { s: () => true, e: () => true }, land: { s: YOU, h: (e) => YOU(e) && e.ok },
  lean: { e: () => true }, hook: { e: () => true }, block: { e: () => true }, fin: { e: () => true }, lane: { e: () => true },
  drafted: { e: YOU },
};
const MOTIF = { bark: (e) => true, nemesis: () => true, breach: () => true, fin: (e) => e.target === 'you' };
const CH = { s: 'sounds', e: 'effects', h: 'haptics' };

const tally = {};          // type → { s: [ok, n], e: [...], h: [...] }
const motifs = {};         // type → [played, n]
let canBuzz = true;

// One stretch: setup() in the page, then n chunks of `dt` s, each followed by one frame; per chunk, the counters'
// rise is compared with the events the chunk made.
async function stretch(page, name, setup, { n = 400, dt = 0.05, each = null } = {}) {
  const r = await R(page, async ({ setup, n, dt, each }) => {
    window.__race.realtime(false);
    // eslint-disable-next-line no-new-func
    new Function(setup)();
    const frame = () => new Promise((res) => requestAnimationFrame(() => res()));
    await frame(); await frame();
    let prev = window.__race.feedback();
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = window.__race.state();
      if (!(s.mode === 'play' || s.mode === 'toy')) break;
      // eslint-disable-next-line no-new-func
      if (each) new Function('s', each)(s);
      const ev = window.__race.advance(dt);
      await frame();
      const now = window.__race.feedback();
      const rise = {};
      for (const ch of ['sounds', 'effects', 'haptics']) {
        rise[ch] = {};
        for (const [k, v] of Object.entries(now[ch])) if (v > (prev[ch][k] || 0)) rise[ch][k] = v - (prev[ch][k] || 0);
      }
      prev = now;
      out.push({ ev: ev.map((e) => ({ type: e.type, ship: e.ship, by: e.by, victim: e.victim, to: e.to, kind: e.kind,
        chain: e.chain, miss: e.miss, ok: e.ok, target: e.target })), rise });
    }
    window.__race.realtime(true);
    return { out, vib: typeof navigator.vibrate === 'function', end: window.__race.state().mode };
  }, { setup, n, dt, each });
  canBuzz = canBuzz && r.vib;
  const seen = new Set();
  for (const { ev, rise } of r.out) {
    const types = new Set(ev.map((e) => e.type));
    for (const type of types) {
      seen.add(type);
      const list = ev.filter((e) => e.type === type);
      if (MOTIF[type] && list.some(MOTIF[type])) {
        const m = motifs[type] || (motifs[type] = [0, 0]);
        m[1]++; if (rise.sounds[type]) m[0]++;
      }
      const row = TABLE[type];
      if (!row) continue;
      for (const ch of ['s', 'e', 'h']) {
        if (!row[ch] || !list.some(row[ch])) continue;
        if (ch === 'h' && !r.vib) continue;
        const t = tally[type] || (tally[type] = {});
        const c = t[ch] || (t[ch] = [0, 0]);
        c[1]++;
        if (rise[CH[ch]][type]) c[0]++;
      }
    }
  }
  rep.note(`${name}: ${r.out.length} chunks, ended in ${r.end}; made ${[...seen].sort().join(' ')}`);
}

const browser = await launch();
const { page, errors, W, H, ctx } = await open(browser, 'portrait', '?toy=30');
await page.touchscreen.tap(W / 2, H * 0.3);
await waitMode(page, 'toy', 5000).catch(() => {});
await wait(300);
const audio = await R(page, () => window.__race.state().audio);
check('the sound context runs after the first tap', audio === 'running', String(audio));

await stretch(page, 'the toy, mid bot', "window.__race.toy(1); window.__race.bot('mid');", { n: 640 });
await stretch(page, 'the toy, mid bot, seed 4', "window.__race.toy(4); window.__race.bot('mid', { seed: 4 });", { n: 640 });
await stretch(page, 'leg 1, mid bot', "window.__race.goto({ leg: 1, seed: 'FEEDA' }); window.__race.bot('mid');", { n: 1000 });
await stretch(page, 'leg 1, idle', "window.__race.goto({ leg: 1, seed: 'FEEDG' }); window.__race.bot('idle');", { n: 1000 });
await stretch(page, 'leg 2, idle', "window.__race.goto({ leg: 2, seed: 'FEEDB' }); window.__race.bot('idle');", { n: 1200 });
// a whip held into the red zone, with a burn at the bottom (Oberth), then a press lifted inside the latch
const HOLD = "window.__race.bot(null); window.__race.input({ target: null }); window.__w = 0; window.__b = 0; window.__u = 0;";
await stretch(page, 'the toy, a whip held too long', `window.__race.toy(2); ${HOLD}`, { n: 300,
  each: "if (s.t > 9 && !window.__w) window.__race.input({ target: 40 });"
    + "if (s.you.inWindow && !window.__w) { window.__race.input({ action: 'down' }); window.__w = s.t; }"
    + "if (window.__w && !window.__b && s.t > window.__w + 0.3) { window.__race.input({ burn: true }); window.__b = 1; }"
    + "if (window.__w && !window.__u && s.t > window.__w + 3) { window.__race.input({ action: 'up' }); window.__u = 1; }" });
await stretch(page, 'the toy, a press lifted in the latch', `window.__race.toy(3); ${HOLD}`, { n: 300,
  each: "if (s.t > 9 && !window.__w) window.__race.input({ target: 40 });"
    + "if (s.you.inWindow && !window.__w) { window.__race.input({ action: 'down' }); window.__w = s.t; }"
    + "else if (window.__w && !window.__u) { window.__race.input({ action: 'up' }); window.__u = 1; }" });
await stretch(page, 'leg 3, whipper', "window.__race.goto({ leg: 3, seed: 'FEEDC' }); window.__race.bot('whipper');", { n: 1300 });
await stretch(page, 'leg 6, mid bot', "window.__race.goto({ leg: 6, seed: 'FEEDD' }); window.__race.bot('mid');", { n: 1000 });
await stretch(page, "Earth's landing, mid bot", "window.__race.goto({ leg: 'earth', beat: 96, seed: 'FEEDE' }); window.__race.bot('mid');", { n: 600 });
await ctx.close();

// the VOID with big burns: LIGHT SPEED, then a dry click with the tank empty
{
  const o = await open(browser, 'portrait', '?burneta=1.6&fuel0=4', { clear: false });
  await o.page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(o.page, 'play', 5000).catch(() => {});
  await stretch(o.page, 'the VOID, big burns', "window.__race.goto({ leg: 'local', lane: 'local-void', seed: 'FEEDF' }); window.__race.bot(null);",
    { n: 160, each: "if (s.t > 1 && Math.round(s.t * 20) % 8 === 0) window.__race.input({ burn: true });" });
  errors.push(...o.errors);
  await o.ctx.close();
}
// the light held back (BLEED 0): one piece's wells, a whip held into the red zone with a burn at the bottom (Oberth)
// until the scorch, then leg 1 with the dodge bot, which flies past or docks at the gate
{
  const o = await open(browser, 'portrait', '?bleed=0&piece=hub-hop&loop=1');
  await o.page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(o.page, 'play', 5000).catch(() => {});
  await stretch(o.page, 'a well held too long (hub-hop, the light off)', "window.__race.bot('whipper'); window.__w = 0; window.__b = 0; window.__u = 0;", { n: 700,
    each: "if (s.you.whip && !window.__w) { window.__race.bot(null); window.__w = s.t; }"
      + "if (window.__w && !window.__b && s.t > window.__w + 0.3) { window.__race.input({ burn: true }); window.__b = 1; }"
      + "if (window.__w && !window.__u && (!s.you.whip || s.t > window.__w + 4)) { window.__race.input({ action: 'up' }); window.__u = 1; window.__race.bot('whipper'); }"
      + "if (window.__u && !s.you.whip && s.t > window.__w + 6) { window.__w = 0; window.__b = 0; window.__u = 0; }" });
  await stretch(o.page, 'leg 1, dodge, the light held', "window.__race.goto({ leg: 1, seed: 'FEEDI' }); window.__race.bot('dodge');", { n: 1200 });
  errors.push(...o.errors);
  await o.ctx.close();
}
// the light let in fast: the glare, then the catch
{
  const o = await open(browser, 'portrait', '?bleed=6');
  await o.page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(o.page, 'play', 5000).catch(() => {});
  await stretch(o.page, 'leg 2, the light let in', "window.__race.goto({ leg: 2, seed: 'FEEDH' }); window.__race.bot('dodge');", { n: 1200 });
  errors.push(...o.errors);
  await o.ctx.close();
}
await browser.close();

for (const [type, row] of Object.entries(tally).sort()) {
  for (const [ch, [ok, n]] of Object.entries(row)) {
    check(`${type}: its ${CH[ch].replace(/s$/, '')} starts on its own frame`, ok === n, `${ok} of ${n} frames`);
  }
}
for (const [type, [ok, n]] of Object.entries(motifs)) {
  check(`${type}: a rival's motif plays (two at most at once)`, ok > 0, `${ok} of ${n} frames`);
}
const never = Object.keys(TABLE).filter((k) => !tally[k]);
rep.note(`types no stretch made (not checked): ${never.join(' ') || 'none'}`);
if (!canBuzz) rep.note('navigator.vibrate is missing here: the haptics were not checked');
check('no page errors, console errors or failed requests', errors.length === 0, errors.slice(0, 6).join(' | '));
rep.done();
