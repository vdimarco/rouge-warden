// Light Years Home v3 in a browser: the jump (final.md 19, jump.e2e, Round 1: the Wall → J1 → Coma). The chapter
// bot drives from PLAY through WHICH WAY HOME, the run-up, the punch, the corridor and the drop-out into Coma City,
// with the core stepped in chunks; the old zone leaves the GPU (memory after the arrival within 10% of a fresh start
// in Coma); Earth's clock reads Coma's date; a slow load gives a long haul and a clean arrival. Screenshots of the
// punch, the corridor and the drop-out go to $SHOTS when it is set.
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

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`jump · ${SIZES[size].name}`);
  const { ctx, page, errors } = await open(browser, size);
  await chapterRun(page, size);
  await slowLoad(page);
  note('J2 to Virgo comes in Round 2');
  errorCheck(errors, size);
  await ctx.close();
}
await browser.close();
summary();
