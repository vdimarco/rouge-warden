// Ahead of the Light's layout at 390 × 844 touch, 844 × 390 touch and 1440 × 900 (final.md 4, 8.1, 10.7, 15, 16,
// 22.1). It shoots the moments of 22.1 into a contact sheet per size (title; the first 3 s; a swarm; HEADLIGHT;
// LIGHT SPEED; the light far, pressed, warned and in the glare; a whip with its bands and red zone; a draft; a slam;
// THE LIGHT TOOK…; every gate; every leg's signature; the dust; Saturn; the landing; the WHALE;
// MAKO's fin; MANTA's lane and shadow; the full wings; a break with and without the dock strip; a 4-card offer; a
// RISK offer; the chart at legs 2, 4 and 7; the caught and home cards; the log; the hangar) and checks, frame by frame
// over the mid bot's legs: the light's ring shows an arc of 60 px or more; the wings never cover the HUD text or the
// pause button; every rival behind you and every rival the light eats is drawn on the screen; no rival label sits
// within 24 px of a landmark label; the caption never sits on the next gate's lines or an exit band; and at 5 hull and
// 6 fuel at the ring's floor no two wing items touch. On every screen: tap targets of 44 px or more, card text inside
// its card, nothing outside the screen, and on the phones nothing outside an emulated notch's safe area.
//   NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/layout.e2e.mjs      (the site served on 8765)
//   SHOTS=<folder> keeps the shots and the sheets there (default: a folder in the system's temp folder).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { launch, open, reporter, sizeList, S, R, wait, waitMode, layoutFaults, faultCount, faultText, badText } from './e2e-lib.mjs';

const rep = reporter('Ahead of the Light: layout');
const { check } = rep;
const OUT = process.env.SHOTS || path.join(os.tmpdir(), 'ahead-of-the-light-layout');
fs.mkdirSync(OUT, { recursive: true });
const NOTCH = { portrait: { t: 47, b: 34, l: 0, r: 0 }, landscape: { t: 0, b: 21, l: 47, r: 47 } };

// In-page helpers: frames; until(body) advances 0.05 s chunks on the hook's own clock until body(s, ev, d) is true;
// sample(), the per-frame layout rules on what the ring layer drew.
function install(page) {
  return R(page, () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const frames = async (n) => { for (let i = 0; i < n; i++) await frame(); };
    async function until(body, { dt = 0.05, max = 90 } = {}) {
      // eslint-disable-next-line no-new-func
      const f = new Function('s', 'ev', 'd', body);
      window.__race.realtime(false);
      for (let t = 0; t <= max; t += dt) {
        const s0 = window.__race.state();
        if (!(s0.mode === 'play' || s0.mode === 'toy')) return { ok: false, mode: s0.mode, t: s0.t };
        const ev = window.__race.advance(dt);
        await frame();
        const s = window.__race.state();
        if (f(s, ev, window.__race.drawn())) return { ok: true, t: s.t };
      }
      return { ok: false, timeout: true };
    }
    const textBox = (el) => {
      if (!el || el.hidden || getComputedStyle(el).visibility === 'hidden' || !el.textContent.trim()) return null;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const r = rg.getBoundingClientRect();
      return r.width ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null;
    };
    const elBox = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
    const ov = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
    const xy = (b) => (b && 'w' in b ? { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h } : b);
    // the rules of 22.1 on one frame → a list of faults (empty when it reads well), and the light's arc in px
    function sample(ev = []) {
      const d = window.__race.drawn();
      const s = window.__race.state();
      if (!d || !s.you) return null;
      const W = innerWidth, H = innerHeight, cx = s.layout.cx, cy = s.layout.cy;
      const out = [];
      let n = 0;
      for (let k = 0; k < 720; k++) {
        const a = (k * Math.PI) / 360, x = cx + Math.sin(a) * d.burstR, y = cy + Math.cos(a) * d.burstR;
        if (x >= 0 && x <= W && y >= 0 && y <= H) n++;
      }
      const arc = (n / 720) * 2 * Math.PI * d.burstR;
      // on a first run's first leg the ring rises in from the screen's edge over its first 1.7 s (7.6)
      const rising = s.leg === 0 && s.real < 1.8;
      if (!s.you.caught && !rising && arc < 60) out.push(`the light's arc ${arc.toFixed(0)} px`);
      const hud = [textBox(document.getElementById('speed')), textBox(document.getElementById('place')),
        textBox(document.getElementById('land')), elBox(document.getElementById('pause'))].filter(Boolean);
      if (d.wings) {
        for (const p of [...d.wings.hull, ...d.wings.fuel]) {
          const h = (p.size || 8) / 2 + 1, b = { x0: p.x - h, y0: p.y - h, x1: p.x + h, y1: p.y + h };
          if (hud.some((r) => ov(b, r))) { out.push(`a wing item at ${p.x.toFixed(0)},${p.y.toFixed(0)} under the HUD`); break; }
        }
      }
      for (const r of d.rivals || []) {
        if (r.x < 0 || r.x > W || r.y < 0 || r.y > H) out.push(`${r.id} drawn off the screen at ${r.x.toFixed(0)},${r.y.toFixed(0)}`);
      }
      const eaten = ev.filter((e) => e.type === 'eaten');
      for (const e of eaten) {
        const r = (d.rivals || []).find((x) => x.id === (e.id || e.ship));
        if (r && (r.x < 0 || r.x > W || r.y < 0 || r.y > H)) out.push(`${r.id} eaten off the screen`);
      }
      const marks = (d.marks || []).map((m) => xy(m.box)).filter(Boolean);
      for (const L of (d.labels || []).map(xy)) {
        if (marks.some((m) => ov(L, m, 24 - 0.5))) { out.push('a rival label within 24 px of a landmark label'); break; }
      }
      const cap = textBox(document.getElementById('captions'));
      if (cap && (d.keep || []).some((k) => ov(cap, k))) out.push(`the caption "${document.getElementById('captions').textContent}" sits on a gate line or an exit band`);
      return { out, arc: rising ? Infinity : arc, eaten: eaten.length, rivals: (d.rivals || []).length };
    }
    // the wings at their fullest: pairs of items closer than their size
    function wingsTouch() {
      const d = window.__race.drawn();
      if (!d || !d.wings) return null;
      // a hull pip is a radial stroke (len long, wide thick); a fuel cell a diamond of `size`
      const seg = (p) => { const ux = Math.sin(p.ang * Math.PI / 180), uy = Math.cos(p.ang * Math.PI / 180);
        return [[p.x - ux * p.size / 2, p.y - uy * p.size / 2], [p.x + ux * p.size / 2, p.y + uy * p.size / 2]]; };
      const segDist = (A, B) => {
        const d = (P, [a, b]) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1;
          const t = Math.max(0, Math.min(1, ((P[0] - a[0]) * vx + (P[1] - a[1]) * vy) / L));
          return Math.hypot(P[0] - a[0] - t * vx, P[1] - a[1] - t * vy); };
        return Math.min(d(A[0], B), d(A[1], B), d(B[0], A), d(B[1], A));
      };
      let min = Infinity, worst = null;
      const H = d.wings.hull, F = d.wings.fuel;
      for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
        const gap = segDist(seg(H[i]), seg(H[j])) - (H[i].wide + H[j].wide) / 2;
        if (gap < min) { min = gap; worst = `hull ${i + 1} and ${j + 1}`; }
      }
      for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
        const gap = Math.hypot(F[i].x - F[j].x, F[i].y - F[j].y) - (F[i].size + F[j].size) / 2;
        if (gap < min) { min = gap; worst = `fuel ${i + 1} and ${j + 1}`; }
      }
      return { hull: d.wings.hull.length, fuel: d.wings.fuel.length, min, worst, R: d.ring };
    }
    // mid-bot sampling over a stretch of a leg: every 0.25 s
    async function sweep(seconds) {
      window.__race.realtime(false);
      const faults = {}, arcs = [];
      let frames = 0, eaten = 0, behind = 0;
      for (let t = 0; t < seconds; t += 0.25) {
        const s0 = window.__race.state();
        if (s0.mode !== 'play') break;
        const ev = window.__race.advance(0.25);
        await frame();
        const r = sample(ev);
        if (!r) continue;
        frames++; arcs.push(r.arc); eaten += r.eaten;
        behind += window.__race.rivals().filter((x) => x.alive && x.gapAhead < 0).length;
        for (const f of r.out) { const k = f.replace(/[-\d.,]+/g, '#'); if (!faults[k]) faults[k] = { n: 0, first: f, t: s0.t }; faults[k].n++; }
      }
      return { frames, faults, minArc: Math.min(...arcs), eaten, behind, end: window.__race.state().mode };
    }
    window.__lq = { frame, frames, until, sample, wingsTouch, sweep };
  });
}

const sheet = [];
async function shot(page, size, name, { dom = true } = {}) {
  await R(page, () => window.__lq.frames(3));
  const file = path.join(OUT, `${size}-${String(sheet.filter((x) => x.size === size).length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  sheet.push({ size, name, file });
  const bad = await badText(page);
  if (bad.length) check(`${size} ${name}: no NaN or broken text`, false, bad.join(' | '));
  if (dom) {
    const f = await layoutFaults(page);
    if (faultCount(f)) check(`${size} ${name}: tap targets, text and screen edges`, false, faultText(f));
  }
  const s = await R(page, () => window.__lq.sample());
  if (s && s.out.length) check(`${size} ${name}: reads well on the ring`, false, s.out.join('; '));
  return file;
}
const goto = (page, o) => R(page, (o) => { window.__race.realtime(false); window.__race.goto(o); window.__race.bot(o.bot || 'mid'); }, o);
const until = (page, body, o) => R(page, ({ body, o }) => window.__lq.until(body, o), { body, o });
// the first beat of a piece on this leg, or null
const pieceAt = (page, id) => R(page, (id) => {
  const it = window.__race.course({}).filter((i) => i.piece === id);
  return it.length ? Math.min(...it.map((i) => i.beat)) : null;
}, id);

async function moments(browser, size) {
  const { page, errors, W, H, ctx } = await open(browser, size);
  await install(page);
  const desk = size === 'desktop';
  const miss = [];
  const want = async (name, r) => { if (!r || !r.ok) miss.push(`${name} (${JSON.stringify(r)})`); return r && r.ok; };

  await wait(800);
  await shot(page, size, 'title');
  // the first 3 s of a first run, by a real tap
  if (desk) await page.keyboard.press('Space'); else await page.touchscreen.tap(W / 2, H * 0.3);
  await waitMode(page, 'play', 5000).catch(() => {});
  await R(page, () => { window.__race.realtime(false); window.__race.advance(3); });
  await shot(page, size, 'first-3s');
  // HEADLIGHT on leg 1 with the mid bot
  await goto(page, { leg: 1, seed: 'LAYA' });
  if (await want('headlight', await until(page, "return ev.some((e) => e.type === 'headlight' && e.ship === 'you');"))) {
    await R(page, () => window.__race.advance(0.3));
    await shot(page, size, 'headlight');
  }
  // the swarm
  await goto(page, { leg: 1, seed: 'LAYA' });
  let b = await pieceAt(page, 'swarm');
  if (b !== null) { await goto(page, { leg: 1, seed: 'LAYA', beat: b + 2 }); await R(page, () => window.__race.advance(1.5)); await shot(page, size, 'swarm'); } else miss.push('swarm');
  // a draft and a slam and a rival eaten, on leg 2 with the mid bot
  await goto(page, { leg: 2, seed: 'LAYB' });
  if (await want('draft', await until(page, "return ev.some((e) => e.type === 'wake' && e.ship === 'you');", { max: 70 }))) {
    await R(page, () => window.__race.advance(0.5));
    await shot(page, size, 'draft');
  }
  await goto(page, { leg: 2, seed: 'LAYC' });
  if (await want('slam', await until(page, "return ev.some((e) => e.type === 'contact' && e.kind === 'slam' && (e.victim === 'you' || e.by === 'you'));", { max: 90 }))) {
    await R(page, () => window.__race.advance(0.1));
    await shot(page, size, 'slam');
  }
  await goto(page, { leg: 1, seed: 'LAYD' });
  if (await want('light-took', await until(page, "return ev.some((e) => e.type === 'eaten');", { max: 70 }))) {
    await R(page, () => window.__race.advance(0.25));
    await shot(page, size, 'light-took');
  }
  // every gate, from Coma's (leg 1) to the Sun's (leg 7); Earth's door is the landing
  for (const [leg, name] of [[1, 'gate-coma'], [2, 'gate-virgo'], [3, 'gate-local'], [4, 'gate-milky-way'],
    [5, 'gate-orion-arm'], [6, 'gate-bubble'], [7, 'gate-sun']]) {
    await goto(page, { leg, seed: 'LAYE' + leg });
    const L = await R(page, () => window.__race.leg());
    await goto(page, { leg, seed: 'LAYE' + leg, beat: Math.max(0, L.beats - 24) });
    if (await want(name, await until(page, "return s.phase === 'gate';", { max: 30 }))) {
      await R(page, () => window.__race.advance(0.9));
      await shot(page, size, name);
    }
  }
  // every leg's signature, with its lane's own piece
  for (let leg = 1; leg <= 8; leg++) {
    await goto(page, { leg, seed: 'LAYS' + leg });
    const L = await R(page, () => window.__race.leg());
    const sigs = L.lane ? [L.lane.piece, ...(L.lane.seq || [])].flat().filter(Boolean) : [];
    const sig = sigs.join(',');
    b = null;
    for (const id of sigs) { if (b === null) b = await pieceAt(page, id); }
    if (b === null) { miss.push(`signature ${leg} (${sig})`); continue; }
    await goto(page, { leg, seed: 'LAYS' + leg, beat: b + 1 });
    await R(page, () => window.__race.advance(1.6));
    if ((await S(page)).mode === 'play') await shot(page, size, `sig-${L.type}`);
  }
  // the dust, Saturn, the WHALE, MAKO's fin, MANTA's lane and shadow, the landing
  for (const [leg, piece, name, body] of [
    [5, 'dust-road', 'dust', null], [8, 'saturn', 'saturn', null], [3, 'whale-road', 'whale', null],
    [6, 'mako-field', 'mako-fin', "return ev.some((e) => e.type === 'fin');"],
    [8, 'asteroids', 'manta-lane', "return ev.some((e) => e.type === 'lane');"],
    [8, 'asteroids', 'manta-shadow', "return ev.some((e) => e.type === 'shadow' && e.on);"],
  ]) {
    let found = null;
    for (let k = 0; k < 6 && found === null; k++) {
      await goto(page, { leg, seed: `LAYP${leg}${k}` });
      const at = await pieceAt(page, piece);
      if (at !== null) found = { seed: `LAYP${leg}${k}`, at };
    }
    if (!found) { miss.push(`${name}: no ${piece} in 6 seeds`); continue; }
    await goto(page, { leg, seed: found.seed, beat: Math.max(0, found.at - (body ? 2 : -1)) });
    if (body) { if (!(await want(name, await until(page, body, { max: 40 })))) continue; await R(page, () => window.__race.advance(0.2)); }
    else await R(page, () => window.__race.advance(1.5));
    if ((await S(page)).mode === 'play') await shot(page, size, name);
  }
  await goto(page, { leg: 'earth', seed: 'LAYL', beat: 100 });
  const door = await R(page, () => window.__race.leg().gate.beat);
  if (await want('landing', await until(page, `return s.you.dist >= ${door} - 2.5;`, { max: 40 }))) {
    await shot(page, size, 'landing');
  }

  // the frame-by-frame rules over four mid-bot legs
  for (const leg of [1, 3, 6, 8]) {
    await goto(page, { leg, seed: 'LAYM' + leg });
    const r = await R(page, () => window.__lq.sweep(80));
    const list = Object.values(r.faults);
    check(`${size}: leg ${leg} (mid bot, ${r.frames} frames): the light's arc is 60 px or more in every frame`, r.minArc >= 60, `smallest ${r.minArc.toFixed(0)} px`);
    check(`${size}: leg ${leg}: wings clear of the HUD, rivals behind (${r.behind}) and eaten (${r.eaten}) on screen, labels clear of landmarks, captions clear of gate lines and bands`,
      list.filter((f) => !/arc/.test(f.first)).length === 0, list.map((f) => `${f.first} ×${f.n} (from ${f.t.toFixed(1)} s)`).join('; '));
  }

  // a break after leg 1, then made-up breaks from its save: the dock strip, 4 cards, a RISK offer, the chart
  await goto(page, { leg: 1, seed: 'LAYR' });
  await R(page, () => window.__race.realtime(false));
  for (let i = 0; i < 120 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
  let s = await S(page);
  if (s.mode === 'break') {
    await R(page, () => window.__race.realtime(true));
    await wait(1200);
    await shot(page, size, 'break');
    const save = await R(page, () => window.__race.save());
    const load = async (mod, name) => {
      const env = JSON.parse(save);
      mod(env.run);
      await R(page, (j) => window.__race.load(j), JSON.stringify(env));
      await wait(1200);
      await shot(page, size, name);
    };
    await load((run) => { run.dock = { free: 1, bought: [] }; run.you.hull = 1; run.you.launchEta = 0.8; }, 'break-dock');
    await load((run) => {
      const o = run.offer;
      if (!o) return;
      o.cards.push({ ...o.cards[0], id: 'twin-deflector', r: 1, slot: 4 }); o.bonus = 'first'; o.first = false; o.caption = null;
    }, 'offer-4');
    await load((run) => {
      const o = run.offer;
      if (!o) return;
      o.cards = [{ id: 'bussard-scoop', r: 1, slot: 1 }, { id: 'twin-deflector', r: 2, slot: 2 }, { id: 'still-light', r: 1, slot: 3 },
        { id: 'slipstream', r: 1, slot: 4 }];
      o.risk = true; o.picks = 1; o.first = false; o.caption = null; o.family = null;
    }, 'offer-risk');
    for (const leg of [1, 3, 6]) {
      await load((run) => {
        run.offer = null; run.phase = 'chart'; run.leg = leg;
        while (run.legs.length < leg + 1) run.legs.push({ ...run.legs[run.legs.length - 1], legNo: run.legs.length, type: ['web', 'coma', 'virgo', 'local', 'milkyway', 'orion', 'neighbours', 'earth'][run.legs.length] });
      }, `chart-leg${leg + 1}`);
    }
  } else miss.push(`break (leg 1 ended in ${s.mode})`);
  // the caught card (idle on leg 2), the home card (Earth's end with the mid bot)
  await goto(page, { leg: 2, seed: 'LAYK', bot: 'idle' });
  for (let i = 0; i < 120 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
  await R(page, () => window.__race.realtime(true));
  await wait(1300);
  await shot(page, size, 'caught');
  await goto(page, { leg: 'earth', beat: 96, seed: 'LAYH' });
  for (let i = 0; i < 120 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
  await R(page, () => window.__race.realtime(true));
  await wait(1300);
  await shot(page, size, 'home');
  // the title after runs: the log and the hangar
  await R(page, () => window.__race.action('title'));
  await wait(500);
  await R(page, () => window.__race.action('log'));
  await wait(700);
  await shot(page, size, 'log');
  await R(page, () => window.__race.action('back'));
  await R(page, () => window.__race.action('hangar'));
  await wait(700);
  await shot(page, size, 'hangar');
  await R(page, () => window.__race.action('back'));

  // the phones' safe area: an emulated notch on the title, a leg, a break and the result
  if (NOTCH[size]) {
    const n = NOTCH[size];
    await page.addStyleTag({ content: `:root { --st: ${n.t}px !important; --sb: ${n.b}px !important; --sl: ${n.l}px !important; --sr: ${n.r}px !important; }` });
    const notch = [];
    await wait(500);
    let f = await layoutFaults(page, n); if (faultCount(f)) notch.push(`title: ${faultText(f)}`);
    await goto(page, { leg: 1, seed: 'LAYN' });
    await R(page, () => window.__race.advance(4));
    await R(page, () => window.__lq.frames(3));
    f = await layoutFaults(page, n); if (faultCount(f)) notch.push(`leg: ${faultText(f)}`);
    await page.screenshot({ path: path.join(OUT, `${size}-notch-leg.png`) });
    for (let i = 0; i < 120 && (await S(page)).mode === 'play'; i++) await R(page, () => window.__race.advance(1));
    await R(page, () => window.__race.realtime(true));
    await wait(1300);
    f = await layoutFaults(page, n); if (faultCount(f)) notch.push(`${(await S(page)).mode}: ${faultText(f)}`);
    await page.screenshot({ path: path.join(OUT, `${size}-notch-${(await S(page)).mode}.png`) });
    check(`${size}: with a notch's safe area (${JSON.stringify(n)}), nothing sits outside it`, notch.length === 0, notch.join('; '));
  }
  check(`${size}: every moment was reached`, miss.length === 0, miss.join('; '));
  check(`${size}: no page errors, console errors or failed requests`, errors.length === 0, errors.slice(0, 6).join(' | '));
  await ctx.close();
}

// The staged moments: LIGHT SPEED and the full wings (5 hull, 6 fuel) at the ring's floor, launched past leg 1 at
// η 4.6; and the light's four states with the light let in fast (BLEED 3).
async function staged(browser, size) {
  {
    const { page, errors, W, H, ctx } = await open(browser, size, '?hull0=5&hullmax=5&hullcap=5&fuel0=6&fuelcap=6&fuelcapmax=6&launchpast=4.6');
    await install(page);
    if (size === 'desktop') await page.keyboard.press('Space'); else await page.touchscreen.tap(W / 2, H * 0.3);
    await waitMode(page, 'play', 5000).catch(() => {});
    await goto(page, { leg: 2, seed: 'LAYW', bot: 'dodge' });
    await R(page, () => window.__race.advance(0.6));
    await R(page, () => window.__lq.frames(3));
    const wt = await R(page, () => window.__lq.wingsTouch());
    await shot(page, size, 'wings-full');
    check(`${size}: at ${wt && wt.hull} hull and ${wt && wt.fuel} fuel at the ring's floor (R ${wt && wt.R.toFixed(0)} px) no two wing items touch`,
      wt && wt.hull >= 5 && wt.fuel >= 6 && wt.min > 0, wt ? `closest: ${wt.worst}, ${wt.min.toFixed(1)} px apart` : 'no wings');
    await goto(page, { leg: 'local', lane: 'local-void', seed: 'LAYV', bot: 'dodge' });
    await R(page, () => { window.__race.bot(null); window.__race.input({ burn: true }); });
    const r = await until(page, "if (!ev.some((e) => e.type === 'lightspeed')) { window.__race.input({ burn: true }); return false; } return true;", { max: 10 });
    if (r && r.ok) { await R(page, () => window.__race.advance(0.4)); await shot(page, size, 'lightspeed'); }
    else check(`${size}: LIGHT SPEED reached in the VOID`, false, JSON.stringify(r));
    check(`${size} (staged): no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
  {
    const { page, errors, W, H, ctx } = await open(browser, size, '?bleed=3');
    await install(page);
    if (size === 'desktop') await page.keyboard.press('Space'); else await page.touchscreen.tap(W / 2, H * 0.3);
    await waitMode(page, 'play', 5000).catch(() => {});
    await goto(page, { leg: 2, seed: 'LAYG', bot: 'dodge' });
    await R(page, () => window.__race.advance(1));
    await shot(page, size, 'light-far');
    for (const st of ['pressed', 'warned', 'glare']) {
      const r = await until(page, `return s.you.light === '${st}';`, { max: 60 });
      if (r && r.ok) { await R(page, () => window.__race.advance(0.3)); await shot(page, size, `light-${st}`); }
      else check(`${size}: the light reaches ${st}`, false, JSON.stringify(r));
    }
    // a whip with its bands, then held into the red zone (the light off, one well piece)
    await ctx.close();
    errors.length && check(`${size} (light): no page errors`, false, errors.slice(0, 4).join(' | '));
  }
  {
    const { page, errors, W, H, ctx } = await open(browser, size, '?bleed=0&piece=hub-hop&loop=1');
    await install(page);
    if (size === 'desktop') await page.keyboard.press('Space'); else await page.touchscreen.tap(W / 2, H * 0.3);
    await waitMode(page, 'play', 5000).catch(() => {});
    await R(page, () => window.__race.bot('whipper'));
    let r = await until(page, "if (s.you.whip) { window.__race.bot(null); return true; } return false;", { max: 40 });
    if (r && r.ok) {
      await R(page, () => window.__race.advance(0.25));
      await shot(page, size, 'whip-bands');
      r = await until(page, "return ev.some((e) => e.type === 'redIn') || !s.you.whip;", { max: 6 });
      if (r && r.ok && (await S(page)).you.whip) { await R(page, () => window.__race.advance(0.2)); await shot(page, size, 'whip-red'); }
      else check(`${size}: a held whip reaches its red zone`, false, JSON.stringify(r));
    } else check(`${size}: the whipper grabs a well`, false, JSON.stringify(r));
    check(`${size} (whip): no page errors`, errors.length === 0, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
}

const browser = await launch();
for (const size of sizeList()) {
  rep.section(size);
  await moments(browser, size);
  await staged(browser, size);
  const mine = sheet.filter((x) => x.size === size);
  rep.note(`${mine.length} moments shot`);
  try {
    const geo = size === 'portrait' ? '260x563+4+4' : size === 'landscape' ? '422x195+4+4' : '480x300+4+4';
    const file = path.join(OUT, `sheet-${size}.jpg`);
    execFileSync('montage', ['-label', '%t', ...mine.map((x) => x.file), '-tile', size === 'portrait' ? '8x' : '5x',
      '-geometry', geo, '-background', '#202020', '-fill', '#dddddd', '-pointsize', '11', '-quality', '82', file]);
    rep.note(`contact sheet: ${file}`);
  } catch (e) { rep.note(`no contact sheet (ImageMagick montage is missing): ${String(e.message).slice(0, 80)}`); }
}
await browser.close();
rep.note(`shots in ${OUT}`);
rep.done();
