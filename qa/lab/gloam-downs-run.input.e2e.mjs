// Gloam Downs' combat run in a real browser (public/lab/gloam-downs/?run), on software WebGL 2: the inputs and the run's first cards.
//   The run opens on its help card, and Tab stays in it; J and a left click swing at a training post, and a move of the taken mouse only looks;
//   R and the Look tool face a post behind or to the side, a tool click does not swing, and with none near R looks ahead; A and K
//   roll to the camera's left, the arrows with X, Z and C roll, swing and drink, L with no flask says so; W held through the pause
//   walks on; a roll, a drink, Heal at full health, a hit that is stored at once and a fall; the pause panel with its focus, End the
//   run asking again, Escape and M; the beacon card, its wicks, Escape that cannot pass them and a reload at it; a mocked gamepad
//   alone on the cards and in play (a stick held into a card moves nothing, RB faces, a tilt and B roll its way, three X make the
//   string); and a phone with real touches: the touch buttons at the design's sizes, Look, and Roll with the stick held left.
// Stage 1 of the combat run: the later stages add Wander's cards, the Lamp-room and the sound log to this file.
// The page runs with ?test: the game is stepped by __gloam.tick() and drawn by __gloam.draw(), because software WebGL takes about a
// second a frame. Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs-run.input.e2e.mjs   (SITE_URL to point elsewhere, SHOTS=<dir> to keep pictures)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
async function open(ctxOpts, query, init) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
  return { ctx, page, errors };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const run = page => G(page, () => window.__gloam.run());
const state = page => G(page, () => window.__gloam.state());
const tick = (page, sec, held = {}) => G(page, ([s, h]) => window.__gloam.tick(s, h), [sec, held]);
const active = page => G(page, () => document.activeElement?.id || document.activeElement?.textContent);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// a post `d` m in front of the lamplighter (or at a bearing off its facing)
const postAhead = (page, d, turn = 0) => G(page, ([d, turn]) => {
  const s = window.__gloam.state(), a = s.yaw + turn;
  return window.__gloam.post(s.x + Math.sin(a) * d, s.z + Math.cos(a) * d);
}, [d, turn]);
// the angle between the view's forward and the way to the last post (radians)
const viewOff = async page => {
  const st = await state(page), p = (await G(page, () => window.__gloam.posts())).at(-1);
  return Math.abs(wrap(Math.atan2(-Math.sin(st.cam.yaw), -Math.cos(st.cam.yaw)) - Math.atan2(p.x - st.x, p.z - st.z)));
};

try {
  /* ---------------- desktop: keys and mouse ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, '?run&test&fresh&seed=7');
    assert(await page.isVisible('#runHelp'), 'the run opens on its help card');
    assert.match(await page.textContent('#runControls'), /J.*or.*Z/s);
    assert.equal(await page.textContent('#bMap'), 'Pause', 'in a run the Map tool is the pause');
    assert.equal(await active(page), 'bBegin', 'Begin the run has the focus');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    assert(await G(page, () => !!document.activeElement.closest('#runHelp')), 'Tab stays in the card');
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#runHelp'), "Escape does not close the run's help card");
    await page.focus('#bBegin');
    await page.keyboard.press('Enter');
    let r = await run(page);
    assert.deepEqual([r.mode, r.place, r.hp, r.max, r.flasks, r.flasksMax], ['play', 'gaol', 100, 100, 1, 1]);
    for (const id of ['#bAttack', '#bRoll', '#bHeal', '#bJump']) assert(!(await page.isVisible(id)), `${id} is hidden with a mouse`);
    const tb = await page.locator('#tools').boundingBox();
    pass('the run starts from its help card with 100 health and 1 flask; Tab stays in the card', { tools1280: [tb.x, tb.y, tb.width, tb.height].map(v => +v.toFixed(1)) });
    // the checks below drink at 2 flasks: Flask 1 gives the second
    await G(page, () => window.__gloam.set({ up: { flask: 1 }, flasks: 2 }));

    // swing: J on the keys, then a left click on the view, at a training post 2 m ahead
    await postAhead(page, 2.0);
    await tick(page, 0.05, {});
    await page.keyboard.down('j');
    await tick(page, 0.1, 'live');
    await page.keyboard.up('j');
    await tick(page, 0.9, 'live');
    let posts = await G(page, () => window.__gloam.posts());
    assert.equal(posts[0].hits[0]?.dmg, 10, `J swung the first cut: ${JSON.stringify(posts[0].hits)}`);
    await page.mouse.click(640, 300);
    await tick(page, 0.5, 'live');
    posts = await G(page, () => window.__gloam.posts());
    assert(posts[0].hits.length >= 2, 'a left click swings on the press');
    const swing = (await G(page, () => window.__gloam.sounds())).filter(c => c.cue === 'swing');
    assert(swing.length >= 2 && swing.every(c => Number.isInteger(c.step) && Number.isInteger(c.play)), 'the cue log has game and play steps');
    // Begin the run took the mouse (Enter is a gesture): a move of the mouse with no button turns the view and does not swing
    assert((await state(page)).mouse.locked, 'Begin the run took the mouse');
    const yaw0 = (await state(page)).cam.yaw;
    await page.mouse.move(500, 300, { steps: 6 });
    await tick(page, 0.3, 'live');
    assert(Math.abs((await state(page)).cam.yaw - yaw0) > 0.2, 'a move of the taken mouse turns the view');
    assert.equal((await G(page, () => window.__gloam.posts()))[0].hits.length, posts[0].hits.length, 'and does not swing');
    pass('J and a left click swing at the post; a move of the taken mouse only looks', { hits: posts[0].hits.map(h => h.dmg) });

    // a draw mid-swing at 1280x720, for the eye
    await postAhead(page, 1.6);
    await tick(page, 0.6, {});
    await tick(page, 0.08, { attack: true });
    await G(page, () => window.__gloam.draw());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-1280x720.png` });

    // R faces a post 6 m behind, the only one standing: the view turns to it within 0.5 s
    await tick(page, 1.0, {});
    await G(page, () => window.__gloam.clearPosts());
    await postAhead(page, 6, Math.PI);
    let off = await viewOff(page);
    assert(off > 2.5, `the post starts behind the view (${off})`);
    await page.keyboard.press('r');
    await tick(page, 0.5, {});
    off = await viewOff(page);
    assert(off <= 10 * Math.PI / 180, `R faced the post behind: ${off}`);
    // the Look tool does the same, and its click does not swing; with the post 6 m to the side
    await G(page, () => window.__gloam.clearPosts());
    await postAhead(page, 6, Math.PI / 2);
    const hits0 = (await G(page, () => window.__gloam.posts()))[0].hits.length;
    // the tools take a click only while the mouse is free (taken, the cursor is hidden and every click goes to the view)
    await G(page, () => window.__gloam.release());
    await page.waitForTimeout(250);
    await page.click('#bLook');
    await tick(page, 0.5, 'live');
    const offLook = await viewOff(page);
    assert(offLook <= 10 * Math.PI / 180, `the Look tool faced the post to the side: ${offLook}`);
    await page.click('#bMap');
    assert(await page.isVisible('#pause'), 'and the Pause tool pauses');
    await page.click('#bResume');
    await tick(page, 0.3, 'live');
    assert.equal((await G(page, () => window.__gloam.posts()))[0].hits.length, hits0, 'a click on a tool does not swing');
    // with no foe within 10 m, R looks ahead
    await G(page, () => window.__gloam.clearPosts());
    await page.keyboard.press('r');
    await tick(page, 0.1, {});
    const ahead = await state(page);
    assert(Math.abs(wrap(ahead.cam.yaw - (ahead.yaw + Math.PI))) < 0.05, 'with no foe near, R looks ahead');
    pass('R and the Look tool face a foe behind or to the side within 0.5 s; a tool click does not swing; with none near, R looks ahead', { off: +off.toFixed(3), look: +offLook.toFixed(3) });

    // the keys: A held and K rolls to the camera's left; with the right arrow held, X rolls, Z swings and C drinks
    const rollDir = async (keys, press) => {
      const a = await state(page);
      for (const k of keys) await page.keyboard.down(k);
      await page.keyboard.press(press);
      await tick(page, 0.1, 'live');
      for (const k of keys) await page.keyboard.up(k);
      await tick(page, 0.6, {});
      const b = await state(page), d = [b.x - a.x, b.z - a.z], l = Math.hypot(...d);
      return { l, left: (d[0] * -Math.cos(a.cam.yaw) + d[1] * Math.sin(a.cam.yaw)) / l };
    };
    // open ground more than 10 m from every zone (the yard by the cells wakes two Snuffers that would hook the lamplighter)
    await G(page, () => { const s = window.__gloam.state(); window.__gloam.teleport(-24.5, -21, s.yaw); });
    await tick(page, 1.0, {});
    const rl = await rollDir(['a'], 'k');
    assert(rl.l > 2.5 && rl.left > 0.9, `A and K rolled to the camera's left: ${JSON.stringify(rl)}`);
    await G(page, () => { const s = window.__gloam.state(); window.__gloam.teleport(-24.5, -21, s.yaw); window.__gloam.set({ hp: 60 }); });
    await tick(page, 1.0, {});
    const cues0 = (await G(page, () => window.__gloam.sounds())).length;
    const rr = await rollDir(['ArrowRight'], 'x');
    assert(rr.l > 2.5 && rr.left < -0.9, `the right arrow and X rolled to the right: ${JSON.stringify(rr)}`);
    await page.keyboard.press('z');
    await tick(page, 0.8, 'live');
    const fl0 = (await run(page)).flasks;
    await page.keyboard.press('c');
    await tick(page, 1.0, 'live');
    const after = (await G(page, () => window.__gloam.sounds())).slice(cues0).map(c => c.cue);
    assert(after.includes('roll') && after.includes('swing') && after.includes('drink'), `X, Z and C: ${after}`);
    assert.deepEqual([(await run(page)).flasks, (await run(page)).hp], [fl0 - 1, 95], 'C drank a flask: 60 + 35');
    // with no flask, L says that a lit beacon fills them
    await G(page, () => window.__gloam.set({ flasks: 0, hp: 50 }));
    await page.keyboard.press('l');
    await tick(page, 0.1, 'live');
    assert.match(await page.textContent('#toast'), /No flask left/);
    pass('A and K roll to the camera\'s left; the arrows with X, Z and C roll, swing and drink; L with no flask says so', { left: +rl.left.toFixed(2), right: +rr.left.toFixed(2) });

    // W held through the pause: P twice, and the lamplighter walks on without letting go of W
    await G(page, () => window.__gloam.set({ flasks: 2, hp: 100 }));
    await G(page, () => { const s = window.__gloam.state(); window.__gloam.teleport(-24.5, -21, s.yaw); });
    await tick(page, 0.5, {});
    await page.keyboard.down('w');
    await tick(page, 0.5, 'live');
    await page.keyboard.press('p');
    assert(await page.isVisible('#pause'));
    await page.keyboard.press('p');
    const w0 = await state(page);
    await tick(page, 0.5, 'live');
    const w1 = await state(page);
    await page.keyboard.up('w');
    assert(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 1.5, `W held through the pause walks on: ${Math.hypot(w1.x - w0.x, w1.z - w0.z)}`);
    await tick(page, 0.5, {});
    pass('a direction held through the pause panel walks on after Resume');

    // the roll: no direction held, straight back from the facing
    // open ground more than 10 m from every zone, so no foe wakes and hooks the lamplighter in these checks (the yard by the cells, used
    // before the foes fought back, wakes two Snuffers now)
    await G(page, () => { const s = window.__gloam.state(); window.__gloam.teleport(-24.5, -21, s.yaw); });
    await tick(page, 1.0, {}); // the swing drawn above ends first
    let a = await state(page);
    await tick(page, 0.1, { roll: true });
    r = await run(page);
    assert.deepEqual([r.move, r.safe], ['roll', 'roll'], `run() reads the roll: ${r.move} ${r.safe}`);
    await tick(page, 1.0, {});
    assert.equal((await run(page)).move, null, 'and the roll has ended');
    let b = await state(page);
    const rolled = Math.hypot(b.x - a.x, b.z - a.z);
    assert(rolled >= 3.3 && rolled <= 3.7, `rolled ${rolled}`);
    pass('K or a held roll rolls 3.3 to 3.7 m, and run() reads the roll and its safe time', { rolled: +rolled.toFixed(2) });

    // the drink: 40 of 100 and 2 flasks, then 75 and 1; at full health a toast and the flask kept
    await G(page, () => window.__gloam.set({ hp: 40 }));
    await tick(page, 0.1, { heal: true });
    await tick(page, 0.9, {});
    r = await run(page);
    assert.deepEqual([r.hp, r.flasks], [75, 1]);
    assert.equal(await page.textContent('#hpN'), '75/100', 'the health line shows the drink');
    await G(page, () => window.__gloam.set({ hp: 100 }));
    await tick(page, 0.1, { heal: true });
    assert.match(await page.textContent('#toast'), /Health is full/);
    assert.equal((await run(page)).flasks, 1);
    pass('a drink heals 35 in 0.8 s, and Heal at full health keeps the flask');

    // a hit and a fall
    await G(page, () => window.__gloam.hurt(16));
    r = await run(page);
    assert.deepEqual([r.hp, r.stop], [84, 5]);
    const saved = await G(page, () => JSON.parse(localStorage.getItem('gloam-downs.run.v3')));
    assert.equal(saved.run.hp, 84, 'the hit is stored at once');
    await tick(page, 1.0, {});
    a = await state(page);
    await G(page, ([x, z]) => window.__gloam.teleport(x, z, 0, -30), [a.x, a.z]);
    await tick(page, 0.1, {});
    b = await state(page);
    r = await run(page);
    assert(r.hp === 74 && b.y > -3 && b.ground, `a fall: back on firm ground with 74 (${r.hp}, y ${b.y})`);
    pass('a hit takes 16 and is stored at once; a fall below y -25 costs 10 and comes back on firm ground', { y: b.y });

    // the pause panel: P opens it with Resume focused, Tab stays in it, End the run asks again, Escape chooses No
    await page.keyboard.press('p');
    assert(await page.isVisible('#pause'));
    assert.equal(await active(page), 'bResume');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    assert.equal(await active(page), 'bResume', "Tab wraps through the panel's six buttons");
    await page.click('#bEnd');
    assert(await page.isVisible('#askRow'));
    assert.equal(await active(page), 'bNo');
    await page.keyboard.press('m');
    assert(await page.isVisible('#askRow'), 'M does nothing while End the run asks again');
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#pause') && !(await page.isVisible('#askRow')), 'Escape chooses No and keeps the panel');
    assert.equal(await active(page), 'bResume');
    await page.keyboard.press('Escape');
    assert(!(await page.isVisible('#pause')) && (await run(page)).mode === 'play');
    // Escape on Resume took the mouse again (a key press is a gesture): wait for the lock, then free it to click the tool
    await page.waitForTimeout(300);
    await G(page, () => window.__gloam.release());
    await page.waitForTimeout(250);
    await page.click('#bMap');
    assert(await page.isVisible('#pause'), 'the Pause tool opens the pause panel');
    await page.click('#bResume');
    pass('the pause panel: focus, Tab, End the run asks again, Escape and M behave, the tool opens it');

    // the beacon: light() acts as a touch; the card offers two wicks; Escape cannot leave it; a reload shows the same two. Its keepers
    // in the keep are put out first (the guard rule), and their 9 glim are carried on with the 9 carried (a lit beacon no longer banks)
    await G(page, () => window.__gloam.set({ carried: 9 }));
    await G(page, () => window.__gloam.out('G5'));
    await G(page, () => window.__gloam.light());
    await tick(page, 1.6, {});
    assert(await page.isVisible('#beaconCard'), 'the beacon card shows');
    const offer = await page.$$eval('#wicks button', bs => bs.map(b => b.textContent));
    assert(offer.length === 2 && offer.every(t => / · /.test(t)), JSON.stringify(offer));
    r = await run(page);
    assert.deepEqual([r.bank, r.carried, r.place, r.flasks], [0, 18, 'ramparts', 2]);
    await page.keyboard.press('Escape');
    assert(await page.isVisible('#beaconCard'), 'Escape does not close the card before a wick is chosen');
    await page.goto(`${SITE}/lab/gloam-downs/worlds/gaol.json`);
    await page.goto(`${SITE}/lab/gloam-downs/?run&test`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 120000 });
    assert.equal((await state(page)).place, 'ramparts');
    assert.deepEqual(await page.$$eval('#wicks button', bs => bs.map(b => b.textContent)), offer, 'the same two wicks after a reload');
    await page.keyboard.press('Enter');
    // then the beacon's spark pick (gloam-downs-growth): Enter takes the first, Flame
    assert.equal(await G(page, () => document.activeElement.dataset.spark), 'flame', 'after the wick the first spark has the focus');
    await page.keyboard.press('Enter');
    assert.equal(await active(page), 'bWalkOn', 'after the choices Walk on has the focus');
    r = await run(page);
    assert(r.wicks.length === 1 && r.offer === null && r.sparks.flame === 1);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__gloam.ready() && window.__gloam.run().mode === 'play', null, { timeout: 120000 });
    pass('the beacon, its keepers out, carries the 9 carried and their 9 on, fills the flasks and offers two wicks; Escape cannot pass them; a reload shows the same two', { offer, wick: r.wicks });
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  /* ---------------- a mocked gamepad ---------------- */
  {
    const mock = () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
      window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
      navigator.getGamepads = () => [window.__pad];
    };
    const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } }, '?run&test&fresh&seed=2', mock);
    assert.match(await page.textContent('#runControls'), /A jump.*X attack.*B roll.*Y heal/s, 'the help card shows the pad controls');
    assert.match(await page.textContent('#runControls'), /Start pause/);
    await G(page, () => window.__press(0, true));
    await tick(page, 0.1, 'live');
    let r = await run(page);
    assert.equal(r.mode, 'play', 'A pressed Begin the run');
    let s = await state(page);
    await tick(page, 0.3, 'live');
    assert((await state(page)).ground, 'the A that pressed the card does not jump while it is held');
    await G(page, () => window.__press(0, false));
    // B rolls, X attacks
    await postAhead(page, 2.0);
    await G(page, () => window.__press(1, true));
    await tick(page, 0.1, 'live');
    await G(page, () => window.__press(1, false));
    await tick(page, 0.8, 'live');
    s = await state(page);
    await G(page, () => window.__press(2, true));
    await tick(page, 0.1, 'live');
    await G(page, () => window.__press(2, false));
    await tick(page, 0.6, 'live');
    const cues = (await G(page, () => window.__gloam.sounds())).map(c => c.cue);
    assert(cues.includes('roll') && cues.includes('swing'), JSON.stringify(cues));
    // Start pauses; B resumes, and a held B does not roll until it is let go
    await G(page, () => window.__press(9, true));
    await tick(page, 0.1, 'live');
    await G(page, () => window.__press(9, false));
    await tick(page, 0.05, 'live');
    assert.equal((await run(page)).mode, 'pause');
    assert.equal(await active(page), 'bResume');
    const rolls = cues.filter(c => c === 'roll').length;
    await G(page, () => window.__press(1, true));
    await tick(page, 0.5, 'live');
    assert.equal((await run(page)).mode, 'play', 'B resumed');
    assert.equal((await G(page, () => window.__gloam.sounds())).filter(c => c.cue === 'roll').length, rolls, 'the held B does not roll');
    await G(page, () => window.__press(1, false));
    await tick(page, 0.1, 'live');
    await G(page, () => window.__press(1, true));
    await tick(page, 0.1, 'live');
    await G(page, () => window.__press(1, false));
    assert.equal((await G(page, () => window.__gloam.sounds())).filter(c => c.cue === 'roll').length, rolls + 1, 'pressed again, it rolls');
    // the d-pad moves the focus in the pause panel and wraps
    await G(page, () => window.__press(9, true)); await tick(page, 0.05, 'live'); await G(page, () => window.__press(9, false)); await tick(page, 0.05, 'live');
    const down = async () => { await G(page, () => window.__press(13, true)); await tick(page, 0.05, 'live'); await G(page, () => window.__press(13, false)); await tick(page, 0.05, 'live'); };
    await down();
    assert.equal(await active(page), 'bSound');
    for (let i = 0; i < 5; i++) await down();
    assert.equal(await active(page), 'bResume', 'the focus wraps');
    await G(page, () => window.__press(8, true)); await tick(page, 0.05, 'live'); await G(page, () => window.__press(8, false)); await tick(page, 0.05, 'live');
    assert.equal((await run(page)).mode, 'play', "the pad's Back closes the pause panel");
    pass('a gamepad alone: the help card lists its controls, A begins, B rolls, X swings, Start pauses, B resumes without a roll, the d-pad wraps');

    // the stick held forward when Start opens the pause panel moves nothing: Resume keeps the focus
    const stick = (x, y) => G(page, ([x, y]) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; }, [x, y]);
    await stick(0, -1);
    await tick(page, 0.2, 'live');
    await G(page, () => window.__press(9, true)); await tick(page, 0.1, 'live'); await G(page, () => window.__press(9, false));
    await tick(page, 0.6, 'live');
    assert.equal((await run(page)).mode, 'pause');
    assert.equal(await active(page), 'bResume', 'a stick held into the pause panel does not move its focus');
    await stick(0, 0); await tick(page, 0.05, 'live');
    await stick(0, 1); await tick(page, 0.05, 'live'); await stick(0, 0); await tick(page, 0.05, 'live');
    // the pause panel's buttons are Resume, Sound, Music, Back to the start and End the run: one tilt down from Resume is Sound
    assert.equal(await active(page), 'bSound', 'back to centre, a new tilt moves it');
    await G(page, () => window.__press(1, true)); await tick(page, 0.1, 'live'); await G(page, () => window.__press(1, false)); await tick(page, 0.1, 'live');
    assert.equal((await run(page)).mode, 'play');
    // RB faces a post 6 m behind
    await G(page, () => window.__gloam.clearPosts());
    await postAhead(page, 6, Math.PI);
    await G(page, () => window.__press(5, true)); await tick(page, 0.1, 'live'); await G(page, () => window.__press(5, false));
    await tick(page, 0.4, 'live');
    const offRB = await viewOff(page);
    assert(offRB <= 10 * Math.PI / 180, `RB faced the post behind: ${offRB}`);
    // a full tilt and B: the roll goes the tilt's way (to the camera's right)
    await G(page, () => window.__gloam.clearPosts());
    await tick(page, 0.5, 'live');
    let a = await state(page);
    await stick(1, 0);
    await G(page, () => window.__press(1, true)); await tick(page, 0.1, 'live'); await G(page, () => window.__press(1, false));
    await stick(0, 0);
    await tick(page, 0.6, 'live');
    let b = await state(page);
    const d = [b.x - a.x, b.z - a.z], right = (d[0] * Math.cos(a.cam.yaw) - d[1] * Math.sin(a.cam.yaw)) / Math.hypot(...d);
    assert(Math.hypot(...d) > 2.5 && right > 0.9, `the tilt and B rolled right: ${right}`);
    // X three times: cut1, cut2 and the finisher
    const n0 = (await G(page, () => window.__gloam.sounds())).length;
    for (let k = 0; k < 3; k++) { await G(page, () => window.__press(2, true)); await tick(page, 0.1, 'live'); await G(page, () => window.__press(2, false)); await tick(page, 0.2, 'live'); }
    await tick(page, 1.0, 'live');
    const string = (await G(page, () => window.__gloam.sounds())).slice(n0).filter(c => c.cue === 'swing').map(c => c.hit);
    assert.deepEqual(string, ['cut1', 'cut2', 'fin'], `three X: ${string}`);
    // RT swings and Y drinks, as main.js wires the pads' run buttons; LT is ability 2 now, and with slot 2 empty it does nothing
    const btn = async (i, sec = 1.0) => { const k = (await G(page, () => window.__gloam.sounds())).length; await G(page, i => window.__press(i, true), i); await tick(page, 0.1, 'live'); await G(page, i => window.__press(i, false), i); await tick(page, sec, 'live'); return (await G(page, () => window.__gloam.sounds())).slice(k).map(c => c.cue); };
    assert((await btn(7)).includes('swing'), 'RT swings');
    assert(!(await btn(6)).includes('roll'), 'LT no longer rolls');
    await G(page, () => window.__gloam.set({ hp: 50 }));
    const fl = (await run(page)).flasks;
    assert((await btn(3)).includes('drink') && (await run(page)).flasks === fl - 1, 'Y drinks a flask');
    // the beacon card that opens with the stick held: the focus on the first wick (the keep's Snuffers put out first: the guard rule)
    await G(page, () => { window.__gloam.set({ carried: 3 }); window.__gloam.out('G5'); });
    await stick(0, -1);
    await G(page, () => window.__gloam.light());
    await tick(page, 2.2, 'live');
    assert(await page.isVisible('#beaconCard'));
    assert.equal(await G(page, () => document.activeElement === document.querySelector('#wicks button')), true, 'the first wick keeps the focus');
    await stick(0, 0);
    await tick(page, 0.1, 'live');
    assert.deepEqual(errors, []);
    pass('a stick held into a card moves nothing; RB faces the foe behind; a tilt and B roll its way; three X give cut1, cut2 and the finisher; RT, LT and Y swing, roll and drink', { rb: +offRB.toFixed(3), right: +right.toFixed(2), string });
    await ctx.close();
  }

  /* ---------------- the explorer with a gamepad: the Map that Start opens with the stick held keeps the focus on the current place ---------------- */
  {
    const mock = () => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
      window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
      navigator.getGamepads = () => [window.__pad];
      // three places reached, so the Map has three buttons to move between
      localStorage.setItem('gloam-downs.save.v1', JSON.stringify({ v: 1, reached: ['gaol', 'ramparts', 'fen'], at: 'gaol', wisps: {}, lit: { gaol: true, ramparts: true }, seen: true }));
    };
    const { ctx, page, errors } = await open({ viewport: { width: 960, height: 540 } }, '?explore&test', mock);
    const press = async i => { await G(page, i => window.__press(i, true), i); await tick(page, 0.1, 'live'); await G(page, i => window.__press(i, false), i); await tick(page, 0.1, 'live'); };
    await tick(page, 0.3, 'live');
    assert.equal((await state(page)).mode, 'play');
    await G(page, () => { window.__pad.axes[1] = -1; });
    await tick(page, 0.3, 'live');
    await press(9);
    await tick(page, 0.6, 'live');
    assert.equal((await state(page)).mode, 'map');
    assert.equal(await G(page, () => document.activeElement.getAttribute('aria-current')), 'true', 'the current place keeps the focus');
    await G(page, () => { window.__pad.axes[1] = 0; });
    assert.deepEqual(errors, []);
    pass('the explorer: a stick held when Start opens the Map does not move its focus off the current place');
    await ctx.close();
  }

  /* ---------------- a phone: the touch buttons ---------------- */
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?run&test&fresh&seed=5');
    assert.match(await page.textContent('#runControls'), /ATTACK/);
    await page.tap('#bBegin');
    const box = async sel => { const b = await page.locator(sel).boundingBox(); return b && [Math.round(b.x), Math.round(b.y), Math.round(b.width)]; };
    const want = { '#bAttack': [290, 664, 84], '#bRoll': [214, 750, 64], '#bJump': [302, 756, 72], '#bHeal': [226, 682, 52] };
    for (const [sel, w] of Object.entries(want)) assert.deepEqual(await box(sel), w, `${sel} at 390x844`);
    assert.match(await page.textContent('#bHeal'), /1/, 'the run starts with 1 flask');
    assert.equal(await page.textContent('#bMap'), 'Pause');
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id ?? 1 })) });
    await postAhead(page, 2.0);
    // a tap on Attack: tap, then step
    await touch('touchStart', [[332, 706]]);
    await touch('touchEnd');
    await tick(page, 0.6, 'live');
    let posts = await G(page, () => window.__gloam.posts());
    assert.equal(posts[0].hits[0]?.dmg, 10, 'a tap on ATTACK swings at the post');
    // two thumbs: a look drag on the right half while Attack is held
    const yaw0 = (await state(page)).cam.yaw;
    await touch('touchStart', [[332, 706, 1]]);
    await touch('touchStart', [[332, 706, 1], [300, 400, 2]]);
    await touch('touchMove', [[332, 706, 1], [240, 400, 2]]);
    await tick(page, 0.8, 'live');
    await touch('touchEnd');
    posts = await G(page, () => window.__gloam.posts());
    assert(Math.abs((await state(page)).cam.yaw - yaw0) > 0.2 && posts[0].hits.length >= 3, `two thumbs: the view turns and the string goes on (${posts[0].hits.length})`);
    // a draw mid-swing, for the eye
    await tick(page, 0.6, {});
    await tick(page, 0.1, { attack: true });
    await G(page, () => window.__gloam.draw());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-390x844.png` });
    // Look on a phone: a tap faces a post 6 m behind
    await tick(page, 1.0, {});
    await G(page, () => window.__gloam.clearPosts());
    await postAhead(page, 6, Math.PI);
    const lb = await page.locator('#bLook').boundingBox();
    await touch('touchStart', [[lb.x + lb.width / 2, lb.y + lb.height / 2]]);
    await touch('touchEnd');
    await tick(page, 0.5, 'live');
    const offTap = await viewOff(page);
    assert(offTap <= 10 * Math.PI / 180, `a tap on Look faced the post behind: ${offTap}`);
    // Roll tapped with the stick held left: the roll goes to the camera's left
    await G(page, () => window.__gloam.clearPosts());
    await tick(page, 0.5, {});
    const a = await state(page), rb = await page.locator('#bRoll').boundingBox();
    await touch('touchStart', [[100, 500, 1]]);
    await touch('touchMove', [[40, 500, 1]]);
    await tick(page, 0.05, 'live');
    await touch('touchStart', [[40, 500, 1], [rb.x + rb.width / 2, rb.y + rb.height / 2, 2]]);
    await tick(page, 0.05, 'live');
    await touch('touchEnd');
    await tick(page, 0.6, 'live');
    const b = await state(page), dd = [b.x - a.x, b.z - a.z], left = (dd[0] * -Math.cos(a.cam.yaw) + dd[1] * Math.sin(a.cam.yaw)) / Math.hypot(...dd);
    assert(Math.hypot(...dd) > 2.5 && left > 0.85, `Roll with the stick held left rolled left: ${left}`);
    pass('on a phone: a tap on Look faces the foe behind, and Roll with the stick held left rolls left', { look: +offTap.toFixed(3), left: +left.toFixed(2) });
    // the small sizes at 320x640
    await page.setViewportSize({ width: 320, height: 640 });
    const small = { '#bAttack': [228, 480, 76], '#bRoll': [160, 562, 60], '#bJump': [240, 564, 64], '#bHeal': [168, 498, 48] };
    for (const [sel, w] of Object.entries(small)) assert.deepEqual(await box(sel), w, `${sel} at 320x640`);
    // the tools row and the HUD at 320 with the Pause label
    const hud = await page.locator('#hud').boundingBox(), tools = await page.locator('#tools').boundingBox();
    assert(hud.x + hud.width <= tools.x, `the HUD (${hud.x + hud.width}) clears the tools (${tools.x}) at 320`);
    assert(await G(page, () => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    assert.deepEqual(errors, []);
    pass('on a phone: the touch buttons at the design sizes at 390x844 and 320x640, a tap swings, two thumbs look and swing', { tools320: [tools.x, tools.y, tools.width, tools.height].map(v => +v.toFixed(1)), hud320: [hud.x, hud.y, hud.width, hud.height].map(v => +v.toFixed(1)) });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`${n} checks passed`);
