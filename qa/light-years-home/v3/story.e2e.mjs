// Light Years Home v3 in a browser: the story (final.md 19, story.e2e, Round 1 parts). The opening's lines play in
// order; no line starts within 2 s of a hit; WHICH WAY HOME's chase, takedown, catch and three far scans open the
// exit gate. PELICAN DOWN, Vela's flyby and the one-thumb run of PELICAN DOWN come with Coma's missions in Round 2.
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/story.e2e.mjs [desk] [por] [land]
import { launch, open, play, hook, check, note, summary, sizesFromArgs, SIZES, wait, errorCheck, hudChecks } from './browser.mjs';
import { OPENING } from '../../../public/light-years-home/core/world/lines/ch1.js';

// The core stepped in chunks with one input record (or the running bot); the events of every chunk, in order.
const run = (page, seconds, chunk = 0.25, input = null) => page.evaluate(([s, c, input]) => {
  const out = [];
  for (let t = 0; t < s - 1e-9; t += c) {
    for (const e of window.__lyh.step(input, c)) {
      out.push({ type: e.type, t: e.t, id: e.id, zone: e.zone, to: e.to, speaker: e.speaker, item: e.item });
    }
  }
  return out;
}, [seconds, chunk, input]);

async function openingCheck(page, size) {
  await play(page, size);
  await hook(page, 'freeze', true);
  // The lines between the PLAY tap and the freeze are in the hook's history; the rest come from the steps.
  const pre = (await hook(page, 'events', 400)).filter((e) => e.type === 'line');
  // Circle near the drop-out, away from Node 0's ring (driving into it from 12 s starts the chase, and the premise
  // lines left go to the log).
  const ev = await run(page, 50, 0.25, { steer: 0.3, source: 'keys' });
  const lines = pre.concat(ev.filter((e) => e.type === 'line' && !pre.some((p) => p.t === e.t))).map((e) => e.id);
  const want = OPENING.lines.map((o) => o.line);
  const played = lines.filter((id) => want.includes(id));
  const inOrder = played.every((id, i) => i === 0 || want.indexOf(id) > want.indexOf(played[i - 1]));
  check('the opening\'s lines play in order', played.length >= 5 && inOrder && played[0] === 'kit.moon',
    played.join(' → '));
  const talk = await hook(page, 'talk');
  const logged = OPENING.toLog.filter((id) => talk.log.some((l) => (l.id || l) === id));
  check('the opening\'s note lines wait in the log', logged.length === OPENING.toLog.length,
    `${logged.length}/${OPENING.toLog.length}`);
  const starts = ev.filter((e) => e.type === 'line').map((e) => e.t);
  const tight = starts.filter((t, i) => i > 0 && t - starts[i - 1] < 7.99 && i > 1);
  check('lines start at least 8 s apart (after the pre-roll)', tight.length === 0, tight.map((t) => t.toFixed(1)).join(', '));
  await hook(page, 'live');
}

// Crash into the Bend Giant just before an opening line is due: the line waits until 2 s after the hit.
async function hitCheck(page) {
  await hook(page, 'start', { zone: 'wall', skipIntro: false, at: [0, -400, 0], heading: 0, speed: 38 });
  await page.evaluate(() => { const h = window.__lyh; h.freeze(true); });
  await page.evaluate(() => {
    // PLAY by hand: the title's own path, so the opening runs.
    document.querySelector('.m-title button.primary').click();
  });
  await hook(page, 'freeze', true);
  // Dot's "That wasn't the Moon." is due 13 s after PLAY: hit the giant at about 12.4 s.
  await run(page, 12.0, 0.25, { brake: 1 });
  await hook(page, 'teleport', [-48, -236, 0], 0, 30);
  const ev = await run(page, 10, 1 / 30);
  const hit = ev.find((e) => e.type === 'crash' || e.type === 'bigCrash' || e.type === 'scrape');
  const after = hit ? ev.filter((e) => e.type === 'line' && e.t > hit.t && e.t < hit.t + 2) : [];
  const next = hit ? ev.find((e) => e.type === 'line' && e.t > hit.t) : null;
  check('a forced hit happens', !!hit, hit ? `${hit.type} at ${hit.t.toFixed(2)} s` : 'none');
  check('no line starts within 2 s of a hit', !!hit && after.length === 0,
    next ? `next line ${next.id} ${(next.t - hit.t).toFixed(2)} s after` : 'no line after');
  await hook(page, 'live');
}

async function whichWayHome(page, size) {
  await hook(page, 'start', { zone: 'wall', at: [0, -400, 0], heading: 0, speed: 38 });
  await page.evaluate(() => document.querySelector('.m-title button.primary').click());
  await hook(page, 'freeze', true);
  await page.evaluate(() => { window.__b = window.__lyh.bot('story'); });
  const ev = [];
  let shot = false;
  for (let i = 0; i < 100; i++) {
    const chunk = await run(page, 2, 0.25);
    ev.push(...chunk);
    if (!shot && ev.some((e) => e.type === 'missionStart')) {
      shot = true;
      await run(page, 2, 1 / 30);
      await hudChecks(page, 'the chase');
    }
    if (ev.some((e) => e.type === 'exitOpen')) break;
  }
  await page.evaluate(() => window.__b.stop());
  const at = (pred) => ev.findIndex(pred);
  const start = at((e) => e.type === 'missionStart' && e.id === 'which-way-home');
  const take = at((e) => e.type === 'takedown');
  const grab = at((e) => e.type === 'hook' || (e.type === 'beat' && e.id === 'which-way-home' && ev.indexOf(e) > take));
  const scans = ev.filter((e) => e.type === 'farScan').map((e) => e.id);
  const open = at((e) => e.type === 'exitOpen');
  check('WHICH WAY HOME starts by itself: the Magpie takes the chart', start >= 0,
    start >= 0 ? `at ${ev[start].t.toFixed(1)} s` : 'never');
  check('the chase ends in a takedown, then the chart is caught', take > start && grab > take,
    take >= 0 ? `takedown at ${ev[take].t.toFixed(1)} s` : 'no takedown');
  check('three far scans', new Set(scans).size === 3, scans.join(', '));
  check('and the exit gate opens', open > grab && (await hook(page, 'chapter')).exitOpen,
    open >= 0 ? `at ${ev[open].t.toFixed(1)} s` : 'closed');
  const lines = ev.filter((e) => e.type === 'line');
  const hits = ev.filter((e) => ['takedown', 'crash', 'bigCrash', 'gate'].includes(e.type));
  const close = lines.filter((l) => hits.some((h) => l.t > h.t && l.t < h.t + 2));
  check('no line starts within 2 s of a takedown or a crash on the way', close.length === 0, close.map((l) => l.id).join(', '));
  await hook(page, 'live');
}

// The fix is saved: a reload offers CONTINUE, which puts you before the lit exit gate.
async function continueCheck(page, size) {
  await wait(3000);
  await page.reload();
  await page.waitForFunction(() => window.__lyh && window.__lyh.ready, null, { timeout: 120000 });
  const line = await page.evaluate(() => document.querySelector('.m-title .m-save')?.textContent || '');
  const cont = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.m-title button')].find((x) => x.textContent === 'CONTINUE');
    return !!b && !b.hidden && b.classList.contains('primary');
  });
  check('after a reload the title offers CONTINUE with the save\'s line', cont && /THE WALL/.test(line), line);
  if (SIZES[size].hasTouch) await page.tap('.m-title button.primary'); else await page.click('.m-title button.primary');
  await wait(1500);
  const st = await hook(page, 'state');
  const exit = [335, 295];
  const d = Math.hypot(st.ship.pos[0] - exit[0], st.ship.pos[1] - exit[1]);
  check('CONTINUE drives on at the Wall with the exit open, just before the gate',
    st.mode === 'drive' && st.zoneId === 'wall' && st.zone.exitOpen && d < 90, `${d.toFixed(0)} u from the gate`);
  check('WHICH WAY HOME stays done', !!st.progress.missions['which-way-home']?.done);
  await hook(page, 'resetSave');
}

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`story · ${SIZES[size].name}`);
  const { ctx, page, errors } = await open(browser, size);
  await openingCheck(page, size);
  await hitCheck(page);
  await whichWayHome(page, size);
  await continueCheck(page, size);
  note('PELICAN DOWN, Vela\'s flyby and its one-thumb run come with Coma\'s missions in Round 2');
  errorCheck(errors, size);
  await ctx.close();
}
await browser.close();
summary();
