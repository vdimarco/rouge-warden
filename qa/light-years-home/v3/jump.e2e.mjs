// Light Years Home v3 in a browser: the jump (final.md 19, jump.e2e, Round 1: the Wall → J1 → Coma). The chapter
// bot drives from PLAY through WHICH WAY HOME, the run-up, the punch, the corridor and the drop-out into Coma City,
// with the core stepped in chunks; the old zone leaves the GPU (memory after the arrival within 10% of a fresh start
// in Coma); Earth's clock reads Coma's date; a slow load gives a long haul and a clean arrival; driving through the
// exit gate punches within 8 s in both zones. Screenshots of the punch, the corridor and the drop-out go to $SHOTS when
// it is set.
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/jump.e2e.mjs [desk] [por] [land]
import { launch, open, play, hook, check, note, summary, sizesFromArgs, SIZES, wait, errorCheck } from './browser.mjs';
import { JUMPS } from '../../../public/light-years-home/core/world/jumps.js';

const SHOTS = process.env.SHOTS || '';
const EXIT_OPEN = { v: 1, chapter: 1, zoneId: 'wall', zones: { wall: { visited: true, exitOpen: true } },
  missions: { 'which-way-home': { done: true, beat: 3 } } };

// Step in chunks, with a pause between them so the next zone's art can load, until pred(event) or max seconds.
async function stepTo(page, pred, max, chunk = 0.5) {
  const src = pred.toString();
  for (let t = 0; t < max; t += chunk) {
    const hit = await page.evaluate(([src, c]) => {
      const fn = (0, eval)(`(${src})`);
      return window.__lyh.step(null, c).find((e) => fn(e)) || null;
    }, [src, chunk]);
    if (hit) return hit;
    await wait(20);
  }
  return null;
}

const memory = async (page) => {
  const p = await hook(page, 'perf');
  return { geometries: p.memory.geometries, textures: p.memory.textures, bytes: p.textureBytes + p.bufferBytes };
};
const within = (a, b, x = 0.1, slack = 2) => Math.abs(a - b) <= Math.max(slack, Math.abs(b) * x);

async function chapterRun(page, size) {
  await play(page, size);
  await hook(page, 'freeze', true);
  await page.evaluate(() => { window.__b = window.__lyh.bot('chapter'); });
  const ring = await stepTo(page, (e) => e.type === 'runupRing', 200, 0.5);
  check('the chapter bot opens the exit and starts the run-up', !!ring, ring ? `at ${ring.t.toFixed(1)} s` : 'no run-up');
  const punch = await stepTo(page, (e) => e.type === 'punch', 30, 1 / 30);
  check('three launch rings, then the punch', !!punch && (await hook(page, 'mode')) === 'punch');
  if (SHOTS) { await hook(page, 'step', null, 0.15); await page.screenshot({ path: `${SHOTS}/jump-${size}-punch.png` }); }
  const inTunnel = await stepTo(page, (e) => e.type === 'mode' && e.to === 'tunnel', 5, 1 / 30);
  check('the corridor follows the punch', !!inTunnel);
  const half = (JUMPS.J1.L || 18) / 2;
  await stepTo(page, () => false, half - 1, 0.5);
  const js = await hook(page, 'jumpState');
  check('in the corridor at speed', js && js.eta > 2 && js.part === 'run', js ? `η ${js.eta.toFixed(2)} ${js.part}` : '');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump-${size}-tunnel.png` });
  const drop = await stepTo(page, (e) => e.type === 'drop', 30, 0.25);
  check('the vista, then the drop-out into Coma City', !!drop && drop.to === 'coma');
  if (SHOTS) { await hook(page, 'step', null, 0.6); await page.screenshot({ path: `${SHOTS}/jump-${size}-dropout.png` }); }
  const medal = await stepTo(page, (e) => e.type === 'jumpMedal', 10, 0.25);
  const st = await hook(page, 'state');
  check('J1 arrives with a medal', !!medal && st.zoneId === 'coma' && st.mode === 'drive', medal ? medal.medal : 'no medal');
  check('Earth\'s clock reads Coma\'s date', Math.abs(st.earth.aheadLy - JUMPS.J1.earth.aheadTo) < 1,
    `${(st.earth.aheadLy / 1e6).toFixed(0)} Mly ahead`);
  await page.evaluate(() => window.__b.stop());
  // Free driving in Coma: the art comes in, traffic and the giants draw.
  await hook(page, 'live');
  for (let i = 0; i < 60 && !(await hook(page, 'ready')); i++) await wait(250);
  check('Coma City\'s art is in after the arrival', await hook(page, 'ready'));
  await wait(1500);
  const perf = await hook(page, 'perf');
  check('Coma draws traffic and giants', perf.points > 5000 && perf.drawCalls > 8, `${perf.drawCalls} calls, ${perf.points} points`);
  const after = await memory(page);
  // A fresh start in Coma: the jump left nothing of the Wall behind.
  await hook(page, 'start', { zone: 'coma', skipIntro: true });
  await wait(1500);
  const fresh = await memory(page);
  check('GPU memory after the jump is within 10% of a fresh start in Coma',
    within(after.geometries, fresh.geometries) && within(after.textures, fresh.textures, 0.1, 1) && within(after.bytes, fresh.bytes),
    `after ${JSON.stringify(after)} · fresh ${JSON.stringify(fresh)}`);
}

async function slowLoad(page) {
  await hook(page, 'start', { zone: 'wall', skipIntro: true, save: EXIT_OPEN });
  await hook(page, 'freeze', true);
  await hook(page, 'simulateSlowLoad', 12);
  check('JUMP arms the run-up', await hook(page, 'jump', 'coma'));
  await page.evaluate(() => { window.__b = window.__lyh.bot('jump-mid'); });
  const ev = [];
  for (let t = 0; t < 90; t += 0.5) {
    const chunk = await page.evaluate(() => window.__lyh.step(null, 0.5).map((e) => ({ type: e.type, n: e.n, zone: e.zone })));
    ev.push(...chunk);
    if (ev.some((e) => e.type === 'jumpMedal')) break;
    await wait(20);
  }
  await page.evaluate(() => window.__b.stop());
  const hauls = ev.filter((e) => e.type === 'longHaul').length;
  const ship = await hook(page, 'ship');
  check('a slow load gives a long haul', hauls >= 1, `${hauls} stretch(es)`);
  check('and a clean arrival in Coma', ev.some((e) => e.type === 'arrive' && e.zone === 'coma') && (await hook(page, 'mode')) === 'drive'
    && ship.pos.every(Number.isFinite), `mode ${await hook(page, 'mode')}`);
  await hook(page, 'live');
}

// Drive through the open exit gate the way a player does (steering the travel line at the gate, then at each launch
// ring, the gas held) from 110 u in front of it: the rim no longer turns the run-up back, so LIGHT SPEED comes within
// 8 s of the gate. In both zones (Coma's exit opens from a save; its jump waits for Round 2's Virgo).
async function exitGate(page, size) {
  for (const zone of ['wall', 'coma']) {
    const save = { v: 1, chapter: 1, zoneId: zone, zones: { [zone]: { visited: true, exitOpen: true } },
      missions: { 'which-way-home': { done: true, beat: 3 } } };
    await hook(page, 'start', { zone, skipIntro: true, save });
    await hook(page, 'freeze', true);
    const res = await page.evaluate(async (zone) => {
      const h = window.__lyh;
      const data = (await import(`/light-years-home/core/world/zones/${zone}.js`)).default;
      const e = data.exit.pos, l = Math.hypot(e[0], e[1]);
      h.teleport([e[0] - (e[0] / l) * 110, e[1] - (e[1] / l) * 110, 0], (Math.atan2(e[0], e[1]) * 180) / Math.PI, 24);
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const clamp = (x) => Math.max(-1, Math.min(1, x));
      const touch = h.layout().kind !== 'desktop';
      let gateT = null, punchT = null, misses = 0, turns = 0;
      for (let k = 0; k < 160 && punchT === null; k++) {
        const s = h.ship(), j = h.jumpState(), v = Math.atan2(s.vel[0], s.vel[1]);
        let at = e;
        if (j && h.mode() === 'runup') {
          const R = j.runup;
          at = R.wait || !R.placed ? [s.pos[0] + R.dir[0] * 100, s.pos[1] + R.dir[1] * 100] : R.rings[R.done];
        }
        const steer = clamp(4 * wrap(Math.atan2(at[0] - s.pos[0], at[1] - s.pos[1]) - v));
        const evs = h.step({ steer, gas: 1, source: touch ? 'touch' : 'keys' }, 0.1);
        const t = h.state().t;
        for (const ev of evs) {
          if (ev.type === 'mode' && ev.to === 'runup') gateT = t;
          if (ev.type === 'runupMiss') misses++;
          if (ev.type === 'edgeTurn' && gateT !== null) turns++;
          if (ev.type === 'punch') punchT = t;
        }
      }
      return { gateT, punchT, misses, turns };
    }, zone);
    const dt = res.punchT !== null && res.gateT !== null ? res.punchT - res.gateT : null;
    check(`${zone}: through the exit gate to LIGHT SPEED within 8 s, no turn-back`,
      dt !== null && dt <= 8 && res.turns === 0, `${dt === null ? 'no punch' : dt.toFixed(1) + ' s'}, ${res.misses} missed`);
    if (SHOTS && zone === 'wall') await page.screenshot({ path: `${SHOTS}/jump-${size}-gate-punch.png` });
  }
  await hook(page, 'live');
}

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`jump · ${SIZES[size].name}`);
  const { ctx, page, errors } = await open(browser, size);
  await chapterRun(page, size);
  await slowLoad(page);
  await exitGate(page, size);
  note('J2 to Virgo comes in Round 2');
  errorCheck(errors, size);
  await ctx.close();
}
await browser.close();
summary();
