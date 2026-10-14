// Light Years Home v3 in a browser: driving (final.md 19, drive.e2e). PLAY to control, the first input, every
// control per layout (keys and a mocked pad on desktop; the stick, pedals, flick, BOOST, one thumb and a wandering
// thumb on touch), the HUD on its rectangles with no overlaps, captions out of the bottom third, no sideways scroll,
// the Bend Giant kept on screen through a drift lap at 390 × 844, and no errors.
//   NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/drive.e2e.mjs [desk] [por] [land]
import {
  launch, open, play, hook, check, note, summary, sizesFromArgs, SIZES, wait, touches, mid, hudChecks, errorCheck,
  waitGame,
} from './browser.mjs';

// An empty stretch of the Wall (Void East) where nothing gets in the way of a control check.
const QUIET = { zone: 'wall', skipIntro: true, at: [200, -330, 0], heading: 0, speed: 24 };
const ship = (page) => hook(page, 'ship');
const live = async (page, opts = QUIET) => { await hook(page, 'start', opts); await hook(page, 'live'); };

async function playChecks(page, size, software) {
  await play(page, size);
  // The first input right away: W on keys, the GAS pedal on touch.
  if (SIZES[size].hasTouch) {
    const L = await hook(page, 'layout');
    const t = await touches(page);
    await t.start(1, ...mid(L.rects.gas));
    await wait(1500);
    await t.end(1);
  } else {
    await page.keyboard.down('KeyW');
    await wait(1500);
    await page.keyboard.up('KeyW');
  }
  await wait(800);
  const tm = await hook(page, 'timing');
  const lim = software ? 2000 : 500;
  check(`PLAY to control in ${software ? '2 s on a software GPU (500 ms on hardware)' : 'under 500 ms'}`,
    tm.playToControlMs !== null && tm.playToControlMs < lim, `${Math.round(tm.playToControlMs)} ms`);
  check('the first input is accepted within 3 s of PLAY', tm.firstInputMs !== null && tm.firstInputMs < 3000,
    `${Math.round(tm.firstInputMs)} ms`);
  check('the game drives after PLAY', (await hook(page, 'mode')) === 'drive');
}

async function keyChecks(page) {
  const k = page.keyboard;
  await live(page);
  let s0 = await ship(page);
  await k.down('KeyW'); await waitGame(page, 1.5); await k.up('KeyW');
  let s1 = await ship(page);
  check('keys: W raises the speed toward top', s1.speed > s0.speed + 2, `${s0.speed.toFixed(1)} → ${s1.speed.toFixed(1)} u/s`);
  await k.down('KeyS'); await waitGame(page, 0.6);
  const s2 = await ship(page);
  await k.up('KeyS');
  check('keys: S brakes', s2.speed < s1.speed - 3, `${s1.speed.toFixed(1)} → ${s2.speed.toFixed(1)} u/s`);
  await live(page);
  s0 = await ship(page);
  await k.down('KeyD'); await waitGame(page, 0.5); s1 = await ship(page); await k.up('KeyD');
  check('keys: D turns right (clockwise)', s1.yaw > s0.yaw + 0.15, `${(s0.yaw * 57.3).toFixed(0)}° → ${(s1.yaw * 57.3).toFixed(0)}°`);
  s0 = await ship(page);
  await k.down('KeyA'); await waitGame(page, 0.5); s1 = await ship(page); await k.up('KeyA');
  check('keys: A turns left', s1.yaw < s0.yaw - 0.15, `${(s0.yaw * 57.3).toFixed(0)}° → ${(s1.yaw * 57.3).toFixed(0)}°`);
  await live(page);
  await k.down('KeyD'); await k.down('Space'); await waitGame(page, 0.6);
  s1 = await ship(page);
  await k.up('Space'); await k.up('KeyD');
  check('keys: Space with a steer drifts', s1.drift.on || s1.drift.t > 0 || s1.db.t > 0, `drift ${s1.drift.on} slip ${(s1.slip * 57.3).toFixed(0)}°`);
  await live(page);
  await k.down('ShiftLeft'); await waitGame(page, 0.3);
  s1 = await ship(page);
  await k.up('ShiftLeft');
  check('keys: Shift boosts', s1.boosting, `bar ${s1.bar.toFixed(2)} speed ${s1.speed.toFixed(1)}`);
}

// Mouse steer is a setting: turn it on through the pause menu's SETTINGS, then the mouse steers and the left button
// is gas.
async function mouseChecks(page) {
  await live(page);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.m-pause:not([hidden])', { timeout: 10000 });
  check('Esc pauses: the pause menu shows', (await hook(page, 'mode')) === 'paused');
  await page.click('.m-pause button[data-act="settings"]');
  await page.click('.m-settings button[data-key="mouseSteer"][data-value="true"]');
  await page.click('.m-settings button[data-act="back"]');
  await page.click('.m-pause button[data-act="resume"]');
  await wait(300);
  check('RESUME drives on', (await hook(page, 'mode')) === 'drive');
  const W = await page.evaluate(() => innerWidth), Hh = await page.evaluate(() => innerHeight);
  await page.mouse.move(W / 2 + W * 0.2, Hh / 2);
  const s0 = await ship(page);
  await page.mouse.down();
  await waitGame(page, 0.8);
  const s1 = await ship(page);
  await page.mouse.up();
  check('mouse steer: right of centre turns right, the left button is gas', s1.yaw > s0.yaw + 0.15 && s1.speed > s0.speed,
    `${(s0.yaw * 57.3).toFixed(0)}° → ${(s1.yaw * 57.3).toFixed(0)}°, ${s0.speed.toFixed(1)} → ${s1.speed.toFixed(1)} u/s`);
  await page.evaluate(() => localStorage.removeItem('light-years-home.v3.settings'));
}

async function padChecks(page) {
  await live(page);
  const setPad = (fn) => page.evaluate(fn);
  await setPad(() => { const b = window.__pad.buttons[0]; b.pressed = true; b.value = 1; window.__pad.timestamp++; });
  await waitGame(page, 0.3);
  const s1 = await ship(page);
  await setPad(() => { const b = window.__pad.buttons[0]; b.pressed = false; b.value = 0; window.__pad.timestamp++; });
  check('pad: A boosts (and the pad takes over on a button press)', s1.boosting, `bar ${s1.bar.toFixed(2)}`);
  await live(page);
  const s0 = await ship(page);
  await setPad(() => { window.__pad.axes[0] = 1; window.__pad.timestamp++; });
  await waitGame(page, 0.5);
  const s2 = await ship(page);
  await setPad(() => { window.__pad.axes[0] = 0; window.__pad.timestamp++; });
  check('pad: the left stick steers', s2.yaw > s0.yaw + 0.15, `${(s0.yaw * 57.3).toFixed(0)}° → ${(s2.yaw * 57.3).toFixed(0)}°`);
}

async function touchChecks(page, size) {
  const t = await touches(page);
  await live(page);
  let L = await hook(page, 'layout');
  const a = L.rects.steerArea || null;
  const sa = await page.evaluate(() => {
    const w = innerWidth, h = innerHeight;
    return h > w ? [60, h * 0.62] : [w * 0.22, h * 0.7];
  });
  // The stick: a drag in the steer area steers.
  let s0 = await ship(page);
  await t.drag(1, sa[0], sa[1], sa[0] + 60, sa[1], 120);
  await waitGame(page, 0.5);
  let s1 = await ship(page);
  await t.end(1);
  check('touch: a drag on the stick steers', s1.steerS > 0.4 && s1.yaw > s0.yaw + 0.1, `steer ${s1.steerS.toFixed(2)}`);
  // GAS raises the speed, and a pedal never steers.
  await live(page);
  s0 = await ship(page);
  await t.start(2, ...mid(L.rects.gas));
  await waitGame(page, 1.5);
  s1 = await ship(page);
  await t.end(2);
  check('touch: GAS raises the speed', s1.speed > s0.speed + 2, `${s0.speed.toFixed(1)} → ${s1.speed.toFixed(1)} u/s`);
  check('touch: a pedal touch never steers', Math.abs(s1.steerS) < 0.02, `steer ${s1.steerS.toFixed(3)}`);
  // BRAKE with a steer drifts.
  await live(page);
  await t.drag(1, sa[0], sa[1], sa[0] + 60, sa[1], 100);
  await t.start(3, ...mid(L.rects.brake));
  await waitGame(page, 0.5);
  s1 = await ship(page);
  await t.end(3); await t.end(1);
  check('touch: BRAKE with a steer drifts', s1.drift.on || s1.db.t > 0, `drift ${s1.drift.on}`);
  // A flick up on the stick is a burst.
  await live(page);
  await t.swipe(1, sa[0], sa[1], sa[0], sa[1] - 90, 3, 0.02);
  await waitGame(page, 0.3);
  await t.end(1);
  let ev = await hook(page, 'events', 40);
  check('touch: a flick up on the stick boosts', ev.some((e) => e.type === 'boostStart'), ev.filter((e) => e.type.startsWith('boost')).map((e) => e.type).join(' ') || 'no boost');
  // BOOST holds the boost.
  await live(page);
  await t.start(4, ...mid(L.rects.boost));
  await waitGame(page, 0.3);
  s1 = await ship(page);
  await t.end(4);
  check('touch: BOOST boosts', s1.boosting, `bar ${s1.bar.toFixed(2)}`);
  // A slow 20 px wander up and down of a steering thumb leaves the climb at 0.
  await live(page);
  await t.drag(1, sa[0], sa[1], sa[0] + 40, sa[1], 100);
  let climb = 0;
  for (let i = 0; i < 10; i++) {
    await t.move(1, sa[0] + 40, sa[1] + 20 * Math.sin((i / 10) * Math.PI * 2));
    await wait(100);
    const s = await ship(page);
    climb = Math.max(climb, Math.abs(s.climbS));
  }
  await t.end(1);
  check('touch: a slow 20 px vertical wander of the steering thumb leaves pitch at 0', climb < 1e-6, `climb ${climb.toFixed(3)}`);
  await hudChecks(page, 'touch drive');
  // One thumb: the stick finger holds the gas.
  await live(page, { ...QUIET, settings: { scheme: 'one-thumb' } });
  L = await hook(page, 'layout');
  s0 = await ship(page);
  await t.drag(1, sa[0], sa[1], sa[0] + 10, sa[1], 60);
  await waitGame(page, 1.5);
  s1 = await ship(page);
  await t.end(1);
  check('touch, one thumb: touch held is gas', s1.speed > s0.speed + 2 && !L.rects.gas, `${s0.speed.toFixed(1)} → ${s1.speed.toFixed(1)} u/s`);
}

// The drifter bot laps the Bend Giant; its core stays on screen for 80% of the lap (CAM.DRIFT_LOOK_IN).
async function lapCheck(page) {
  await hook(page, 'start', { zone: 'wall', skipIntro: true, at: [-48, -300, 0], heading: 0, speed: 26 });
  await hook(page, 'freeze', true);
  const out = await page.evaluate(() => {
    const h = window.__lyh;
    h.bot('drifter', { body: 'bend-giant', lap: true, tier: 3 });
    let on = 0, n = 0, turned = 0, last = null;
    for (let i = 0; i < 400 && turned < 2 * Math.PI; i++) {
      h.step(null, 1 / 30);
      const s = h.ship();
      if (!s.drift.on) { last = null; continue; }
      const a = Math.atan2(s.pos[0] + 48, s.pos[1] + 222);
      if (last !== null) turned += Math.abs(Math.atan2(Math.sin(a - last), Math.cos(a - last)));
      last = a;
      n++;
      if (h.project('bend-giant')?.onScreen) on++;
    }
    return { on, n, turned };
  });
  await hook(page, 'live');
  check('390 × 844: the Bend Giant stays on screen for 80% of the drifter bot\'s lap', out.n > 30 && out.on / out.n >= 0.8,
    `${out.on}/${out.n} frames, ${(out.turned * 57.3).toFixed(0)}° of lap`);
}

const browser = await launch();
for (const size of sizesFromArgs()) {
  console.log(`drive · ${SIZES[size].name}`);
  const { ctx, page, errors, software } = await open(browser, size, { pad: size === 'desk' });
  if (software) note('software GPU (SwiftShader): wall-clock limits are wider and say so');
  await playChecks(page, size, software);
  await hudChecks(page, 'after PLAY');
  if (SIZES[size].hasTouch) await touchChecks(page, size);
  else { await keyChecks(page); await mouseChecks(page); await padChecks(page); await hudChecks(page, 'keys drive'); }
  if (size === 'por') await lapCheck(page);
  errorCheck(errors, size);
  await ctx.close();
}
await browser.close();
summary();
