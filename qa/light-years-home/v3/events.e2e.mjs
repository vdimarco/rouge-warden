// Light Years Home v3 in a browser: events (final.md 19, events.e2e). Driving through First Light's start ring
// starts the clock; a 0.35 s hold of the action control restarts and the clock runs again within 2 s; a tap goes back
// to the last gate; your ghost and the pacer are set for the next try after a finish; a ghost link opens the game at
// the start ring with the friend's ghost; the race HUD overlaps nothing.
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/events.e2e.mjs [desk] [por] [land]
import {
  launch, open, play, hook, check, note, summary, sizesFromArgs, SIZES, wait, touches, mid, hudChecks, errorCheck,
  stepUntil,
} from './browser.mjs';

// First Light's run-up point, facing the start ring 30 u ahead (core/world/zones/wall.js).
const RUNUP = { zone: 'wall', skipIntro: true, at: [10, 4, 0], heading: 29, speed: 30,
  save: { v: 1, chapter: 1, zoneId: 'wall', missions: { 'which-way-home': { done: true, beat: 3 } } } };

// Hold or tap the action control the way this layout does: E on keys, the chip on touch.
async function action(page, size, ms) {
  if (SIZES[size].hasTouch) {
    const L = await hook(page, 'layout');
    const t = await touches(page);
    if (ms < 200) { await t.tap(9, ...mid(L.rects.chip)); return; }
    await t.start(9, ...mid(L.rects.chip));
    await wait(ms);
    await t.end(9);
  } else {
    await page.keyboard.down('KeyE');
    await wait(ms);
    await page.keyboard.up('KeyE');
  }
}

async function raceChecks(page, size, software) {
  // From the run-up (the event's own clear traffic clock), drive through the start ring with the gas held.
  await hook(page, 'start', RUNUP);
  await hook(page, 'raceStart', 'first-light');
  const armed = (await hook(page, 'race'))?.state;
  await hook(page, 'live');
  await hook(page, 'input', { gas: 1 });
  let ok = false;
  for (let i = 0; i < 100 && !ok; i++) {
    await wait(150);
    const r = await hook(page, 'race');
    ok = !!r && r.state === 'running' && r.t > 0;
  }
  check('driving through First Light\'s start ring starts the clock', ok && armed === 'armed', `armed before: ${armed}`);
  // Hold the action control 0.45 s: a restart; the clock runs again within 2 s of wall time.
  const t0 = Date.now();
  await action(page, size, 450);
  let back = null, restarted = false;
  const seen = [];
  for (let i = 0; i < 200; i++) {
    await wait(50);
    const r = await hook(page, 'race');
    if (seen[seen.length - 1] !== r?.state) seen.push(r?.state);
    if (r && (r.state === 'restart' || r.state === 'armed')) restarted = true;
    if (restarted && r && r.state === 'running') { back = Date.now() - t0; break; }
  }
  const lim = software ? 4000 : 2000;
  const tm = await hook(page, 'timing');
  check(`a 0.35 s hold restarts and the clock runs again within ${software ? '4 s on a software GPU (2 s on hardware)' : '2 s'}`,
    restarted && back !== null && back < lim, `${back} ms wall from the press; ${seen.join(' → ')}`);
  await hudChecks(page, 'race HUD');
  // A tap after the first gate goes back to the last gate.
  await page.evaluate(() => { window.__b = window.__lyh.bot('mid', { event: 'first-light' }); });
  for (let i = 0; i < 300; i++) {
    await wait(100);
    const r = await hook(page, 'race');
    if (r && r.gate >= 2) break;
  }
  await page.evaluate(() => window.__b.stop());
  await action(page, size, 80);
  await wait(500);
  const ev = await hook(page, 'events', 60);
  check('a tap goes back to the last gate', ev.some((e) => e.type === 'toGate'), ev.filter((e) => /gate|toGate/.test(e.type)).map((e) => e.type).join(' '));
  await hook(page, 'input', null);
}

async function ghostChecks(page) {
  // Finish with the mid bot (core stepped), then AGAIN: your best ghost and the pacer for the next medal ride along.
  await hook(page, 'start', RUNUP);
  await hook(page, 'freeze', true);
  await hook(page, 'raceStart', 'first-light');
  await page.evaluate(() => { window.__b = window.__lyh.bot('mid', { event: 'first-light' }); });
  const fin = await stepUntil(page, (e) => e.type === 'finish', { max: 60, chunk: 0.25 });
  await page.evaluate(() => window.__b.stop());
  check('the mid bot finishes First Light', !!fin, fin ? `${fin.medal} ${fin.time?.toFixed(2)} s` : 'no finish');
  const ghost = await hook(page, 'ghost', 'first-light');
  check('the finish saves your ghost', !!ghost && ghost.n > 20, ghost ? `${ghost.n} samples` : 'none');
  await hook(page, 'raceRestart');
  await hook(page, 'step', null, 1.5);
  const slots = await hook(page, 'ghostSlots');
  check('the next try draws your ghost and the pacer', slots.includes('best') && slots.includes('pacer'), slots.join(', '));
  const link = await hook(page, 'ghostLink', 'first-light');
  check('a ghost link is short', !!link && link.length < 1400, link ? `${link.length} characters` : 'none');
  await hook(page, 'live');
  return link;
}

async function linkChecks(browser, size, link) {
  const { ctx, page, errors } = await open(browser, size, { query: `?ghost=${encodeURIComponent(link)}` });
  await play(page, size);
  await wait(1200);
  const r = await hook(page, 'race');
  const slots = await hook(page, 'ghostSlots');
  check('a ghost link opens the game at First Light with the friend\'s ghost', r?.id === 'first-light' && slots.includes('friend'),
    `${r?.id} ${r?.state} · ${slots.join(', ')}`);
  errorCheck(errors, `${size} ghost link`);
  await ctx.close();
}

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`events · ${SIZES[size].name}`);
  const { ctx, page, errors, software } = await open(browser, size);
  if (software) note('software GPU (SwiftShader): wall-clock limits are wider and say so');
  await play(page, size);
  await wait(500);
  await raceChecks(page, size, software);
  const link = await ghostChecks(page);
  errorCheck(errors, size);
  await ctx.close();
  if (link) await linkChecks(browser, size, link);
}
await browser.close();
summary();
