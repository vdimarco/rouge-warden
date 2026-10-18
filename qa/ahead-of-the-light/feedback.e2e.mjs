// Ahead of the Light's feedback (final.md 17, 18.5, 20, 22.1): through window.__race.feedback(), every event type that
// has a sound, an effect (the overlay's, a caption or the big digits) or a haptic starts it on its own frame, the
// first frame after the step that made the event. Counts are kept where effects start, not where events arrive.
// Stretches at 390 × 844 touch, on the hook's own clock (realtime(false)), in 0.05 s chunks of advance with one frame
// after each, so every run is the same: the toy with
// the mid bot (grazes, burns, the whip, the draft, REMORA), leg 1 with the mid bot (the soft start, gears, the gate),
// leg 2 idle (hits, the shield, the glare, the catch), leg 3 with the whipper (the red zone, scorches, the WHALE),
// leg 6 (MAKO), Earth's landing, and the VOID with big burns (LIGHT SPEED, a dry click). Types a stretch never made are
// listed, not failed. A rival's motif may be dropped by design (two at once at most), so those need only one play.
// And the ticks on the ring tell what crossing a knot does, mid-whip too, where no wall, gate or rail raises the alarm
// or the whine; PHASE HULL draws no SLAM tick and no rival's lean tick on you while its phase is ready, and its
// see-through tell follows the phase; Earth's landing never calls THREAD OR DOCK (a test race drawn on a canvas of
// its own).
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
// the ticks tell what the race does (5.1, 5.3, 5.5, 12.4): a test race in the page, the ring layer drawing on a
// canvas of its own. One knot at a time, dead on and 1°, 5° and 9° off its edge, mid-whip and not, with and without
// LENSED LANE: the tick's state against the event handle's pass check makes. Then a real grab with knots, walls, gates
// or rails all round the ring: while you sweep nothing on your line hits, so no frame raises the hit alarm or the
// danger whine (main.js dangerOf), and the same frame with the whip let go does. Then a rival abreast of a knot: a
// SLAM from your line would carry it in, so the knot's tick turns orange, but not with PHASE HULL (no SLAM to make).
// And Earth's landing, which has only its DOOR, never calls THREAD OR DOCK.
{
  const o = await open(browser, 'portrait');
  const r = await R(o.page, async () => {
    const u = (p) => new URL(p, location.href).href;
    const [{ createOverlay, lineState }, RC, { ringView }, H, K, { applyBuild }, { dangerOf }, { buildLeg },
      { captionsFor, createCaptionMemory }] = await Promise.all([import(u('render/overlay.js')), import(u('core/race.js')),
      import(u('core/ringmath.js')), import(u('core/handle.js')), import(u('core/course/kinds.js')),
      import(u('core/cards.js')), import(u('main.js')), import(u('core/course/gen.js')), import(u('ui/hud.js'))]);
    const { resolve } = K;
    const T = window.__race.tune;
    const legOf = (list, beats = 200) => Object.freeze({ type: 'test', lane: null, seed: 1, beats,
      items: Object.freeze(list.map((x, i) => Object.freeze({ id: i, piece: 'test', ...x }))), sections: [],
      gate: { id: null, beat: beats - 4 }, pickups: [], wells: [], labels: [], hash: 'ticks',
      report: { ok: true, errors: [] } });
    const rows = [];
    const lens = applyBuild([{ id: 'lensed-lane', r: 0 }], T);
    const edge = T.SHIP_HALF + 3.5;
    const offs = [0, edge + 1, edge + 5, edge + 9];
    for (const lensed of [false, true]) for (const whip of [false, true]) for (const off of offs) {
      const race = RC.createRace({ leg: legOf([{ kind: 'knot', beat: 10, psi: off, half: 3.5 }]), tune: T });
      race.legNo = 1;
      if (lensed) race.hooks = lens.hooks;
      const ship = race.ships[0];
      ship.bearing = 0; ship.soft = false; ship.flicker = 0;
      if (whip) ship.whip = { well: 99, angle: 90 };
      race.events.length = 0;
      const it = race.leg.items[0];
      const draw = lineState(it, resolve(it, 0, it.beat, T, ship.half), whip, T, lensed);
      H.passCheck(race, ship, it, T, 1);
      const ev = race.events.find((e) => e.ship === 'you' && ['hit', 'hair', 'graze'].includes(e.type));
      rows.push({ lensed, whip, off, draw, did: ev ? ev.type : 'clear' });
    }
    // a grab at a large well, then the ring after it filled with one kind: what is on your line within ALARM_LEAD
    const fills = {
      knot: (b, add) => { for (let p = -180; p < 180; p += 12) add(K.knot(b, p, 2)); },
      wall: (b, add) => add(K.wall(b, [{ psi: ((b * 97) % 360) - 180, w: 30 }])),
      gate: (b, add) => add(K.gate(b, ((b * 61) % 360) - 180, 20, [40, 40], ['A', 'B'], { psi: ((b * 61) % 360), w: 60 })),
      rail: (b, add) => { if (b === 21) for (let p = -165; p < 180; p += 30) add(K.rail(21, 40, p, 1.5)); },
    };
    const lineOf = (q, you, bps) => {
      if (q.kind === 'rail') {
        return q.beat <= you.dist && K.railOn(q, you.dist) && resolve(q, you.bearing, you.dist, T, you.half).hit;
      }
      const ttp = (q.beat - you.dist) / bps;
      return ttp > 0 && ttp <= T.ALARM_LEAD && resolve(q, you.bearing, q.beat, T, you.half).hit;
    };
    const sweeps = {};
    for (const [kind, fill] of Object.entries(fills)) {
      const list = [{ kind: 'well', beat: 20, psi: 0, size: 'large', exits: [150, -150] }];
      for (let b = 21; b < 40; b += kind === 'knot' ? 0.5 : 1) fill(b, (x) => list.push(x));
      list.sort((a, b) => a.beat - b.beat);
      const race = RC.createRace({ leg: legOf(list), tune: T });
      race.legNo = 1;
      race.ships.length = 1;
      const you = race.ships[0], well = race.leg.items[0];
      const ov = createOverlay({ canvas: document.createElement('canvas'), tune: T });
      ov.resize(390, 844, 1);
      const tally = { whipFrames: 0, onLine: 0, alarmWhip: 0, alarmLetGo: 0, whineWhip: 0, whineLetGo: 0, hitsWhip: 0 };
      let grabAt = null;
      for (let i = 0; i < 4000 && race.phase !== 'done'; i++) {
        let it = RC.NO_INTENT;
        if (grabAt === null) {
          // fly 15° off the well and press as it comes abreast
          you.bearing = 15; you.target = 15;
          const t = (well.beat - you.dist) / H.bpsOf(you, T);
          const down = t <= RC.STEP * H.bpsOf(you, T) / 2 + 1e-6;
          it = { target: 15, turn: 0, action: down ? 'down' : null, burn: false };
          if (down) grabAt = race.real;
        }
        const ev = RC.stepRace(race, { you: it }, RC.STEP);
        if (you.whip) tally.hitsWhip += ev.filter((e) => e.ship === 'you' && e.type === 'hit').length;
        if (grabAt !== null && (!you.whip || race.real - grabAt > 1.4)) break;
        if (!you.whip) continue;
        tally.whipFrames++;
        const bps = H.bpsOf(you, T);
        let line = false;
        for (let k = race.win.lo; k < race.win.hi && !line; k++) {
          const q = race.leg.items[k];
          line = q.kind === kind && lineOf(q, you, bps);
        }
        if (!line) continue;
        tally.onLine++;
        const view = ringView({ w: 390, h: 844, eta: you.eta, cam: you.bearing, tune: T });
        if (ov.render(race, view, 1 / 60, {}).alarm) tally.alarmWhip++;
        if (dangerOf(race)) tally.whineWhip++;
        const W = you.whip;
        you.whip = null;
        if (ov.render(race, view, 1 / 60, {}).alarm) tally.alarmLetGo++;
        if (dangerOf(race)) tally.whineLetGo++;
        you.whip = W;
      }
      sweeps[kind] = tally;
    }
    // PHASE HULL: a rival abreast of you with a knot just past it on its side (handle.test's SLAM into a knot); the
    // ring's ram ticks are its 4.5 px orange strokes. With the phase ready you are see-through and have no SLAM to
    // show; solid after a pass, the tick is back and you are not see-through; ready with the rival far off, solid.
    // PIKE leans at you as the frame starts: its lean tick (3.5 px orange) shows on your ring only while you are solid
    const rams = {};
    const bps0 = H.bpsOf(RC.createRace({ leg: legOf([]), tune: T }).ships[0], T);
    const PH = [{ id: 'phase-hull', r: 0 }];
    for (const [label, build, cool, at] of [['no card', null, 0, 20], ['PHASE HULL', PH, 0, 20],
      ['PHASE HULL solid', PH, 3, 20], ['PHASE HULL far', PH, 0, 120]]) {
      const race = RC.createRace({ leg: legOf([K.knot(2 + bps0 * 0.2, 48, 3.5)]), tune: T });
      race.legNo = 1;
      if (build) { const B = applyBuild(build, T); race.tune = B.tune; race.hooks = B.hooks; }
      race.ships.length = 1;
      const you = race.ships[0];
      you.bearing = you.target = 0; you.soft = false;
      you.dist = 2;
      you.phaseCool = cool;
      const pike = H.createShip({ id: 'pike', kind: 'regular', type: 'pike', bearing: at, eta: you.eta, tune: race.tune,
        meters: { fuel: 2, fuelCap: 4 } });
      pike.dist = you.dist;
      race.ships.push(pike);
      race.win.hi = race.leg.items.length;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let strokes = 0, leans = 0;
      const stroke = ctx.stroke.bind(ctx);
      ctx.stroke = (...a) => {
        if (ctx.lineWidth === 4.5 && /^rgba\(240, 138, 44/.test(String(ctx.strokeStyle))) strokes++;
        if (ctx.lineWidth === 3.5 && String(ctx.strokeStyle) === '#f08a2c') leans++;
        return stroke(...a);
      };
      const ov = createOverlay({ canvas, tune: race.tune });
      ov.resize(390, 844, 1);
      ov.onEvents([{ type: 'lean', ship: 'pike', target: 'you', side: -1, by: 'pike' }], race);
      const drawn = ov.render(race, ringView({ w: 390, h: 844, eta: you.eta, cam: you.bearing, tune: race.tune }), 1 / 60,
        { tells: new Set(build ? ['see-through-near-rivals'] : []) });
      rams[label] = { strokes, leans, phase: race.tune.PHASE_HULL || 0, aim: Boolean(H.slamAim(race, you, pike, T)),
        ready: drawn.phase ? drawn.phase.ready : null, see: drawn.phase ? drawn.phase.see : null };
    }
    // Earth's landing on a first run (THREAD OR DOCK teaches the first 3 runs) and the web's gate
    const calls = {};
    for (const type of ['earth', 'web']) {
      const leg = buildLeg({ type });
      const you = { id: 'you', dist: 0, ttc: 99, shield: 1 };
      const race = { leg, legNo: type === 'earth' ? 7 : 0, ships: [you], t: 10 };
      const mem = createCaptionMemory();
      const said = [];
      let prev = leg.beats - 16;
      for (let d = prev; d <= leg.beats; d += 0.25) {
        you.dist = d;
        const ctx = { race, mem, runs: 0, desk: false, toy: false, fires: [], prevDist: prev };
        for (const c of captionsFor([], ctx)) said.push(c.text);
        prev = d;
      }
      calls[type] = said;
    }
    return { rows, sweeps, rams, calls };
  });
  const bad = r.rows.filter((x) => x.draw !== x.did);
  check('the ticks: a knot\'s tick shows what crossing it does, mid-whip and not, with and without LENSED LANE',
    r.rows.length === 16 && bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 4)) : `${r.rows.length} cases`);
  for (const [kind, t] of Object.entries(r.sweeps)) {
    const whine = kind === 'rail' || t.whineLetGo === t.onLine;      // the whine listens for knots, walls and gates
    check(`mid-whip a ${kind} on your line raises no hit alarm and no whine and nothing hits (both do, the whip let go)`,
      t.onLine >= 10 && t.alarmWhip === 0 && t.whineWhip === 0 && t.hitsWhip === 0 && t.alarmLetGo === t.onLine && whine,
      JSON.stringify(t));
  }
  const [plain, phase, solid, far] = ['no card', 'PHASE HULL', 'PHASE HULL solid', 'PHASE HULL far'].map((k) => r.rams[k]);
  check('a rival abreast of a knot turns its tick orange (a SLAM would carry it in), but not with PHASE HULL ready',
    plain.aim && plain.strokes > 0 && phase.phase === 1 && phase.strokes === 0, JSON.stringify(r.rams));
  check('PHASE HULL\'s tell: see-through near a rival while the phase is ready; solid (and the SLAM tick back) after a '
    + 'pass; solid with no rival near', plain.see === null && phase.ready && phase.see && solid.ready === false
    && solid.see === false && solid.strokes > 0 && far.ready && far.see === false, JSON.stringify(r.rams));
  check('a rival\'s lean tick on you shows without the card and while your hull is solid, never while the phase is ready',
    plain.leans > 0 && solid.leans > 0 && phase.leans === 0 && far.leans === 0, JSON.stringify(r.rams));
  check('Earth\'s landing (only its DOOR) never calls THREAD OR DOCK; the web\'s gate does on a first run',
    !r.calls.earth.includes('THREAD OR DOCK') && r.calls.earth.includes('LAND BEFORE THE LIGHT')
      && r.calls.web.includes('THREAD OR DOCK'), JSON.stringify(r.calls));
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
