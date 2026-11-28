// Gloam Downs: the fair fight in a real browser (public/lab/gloam-downs/?run&test), on software WebGL 2 (openspec/changes/
// gloam-downs-fair-fight):
//   cut into a hook: a Snuffer 1.6 m in front of the lamplighter starts its hook, and 0.2 s later Attack is pressed by J, by a left
//     click, by a mocked pad's X and by a touch on ATTACK; the first cut lands in the wind-up, the hook is cancelled with 21 steps of
//     stun, the flinch pose, the snap in the cue log and a hit stop of 5 steps, and no health is lost in the next second;
//   the armor: an Ironback winding up its charge holds 8 rim dabs in slot 39 and none in fire slots 34 to 37, and a Snuffer in its
//     hook's wind-up lays its ground tell of 7 dabs in slot 35, at 320x640, 390x844, 360x640, 800x600, 1280x720 and 844x390;
//   a Snuffer 2.4 m to the right of the lamplighter at 390x844 with the view narrowed, off screen: its hook winds up 48 steps, its
//     tell is logged off screen at its first step, and a notch shows at the right edge;
//   the tokens in The Crow Wall: two Snuffers 2 m away, one winds up and the other circles with no move (melee 1 of 1);
//   reduced motion: a cancel with no camera kick and no shake of the foe, the flinch pose, and a rim that keeps its size.
// Takes pictures of a flinch, an armored wind-up and a cancelled attack at 390x844 and 1280x720 (SHOTS=<dir> keeps them).
// Needs the site served: python3 -m http.server 8821 --bind 127.0.0.1 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-run.interrupt.e2e.mjs   (SITE_URL to point elsewhere)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8821').replace(/\/$/, '');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const browser = await chromium.launch({ executablePath, args: GL });
const ZONES = ['G1', 'G2', 'G3', 'G5', 'G6', 'G7', 'G8', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'F1', 'F2', 'F3', 'F4', 'B1', 'B2', 'B3', 'B4', 'W1', 'W2', 'W4', 'W5', 'W6'];
const padMock = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  window.__pad = { connected: true, id: 'mock', index: 0, axes: [0, 0, 0, 0], buttons, timestamp: 0, mapping: 'standard' };
  window.__press = (i, on) => { buttons[i].pressed = on; buttons[i].value = on ? 1 : 0; };
  navigator.getGamepads = () => [window.__pad];
};
async function open(ctxOpts, { query = '?run&test&fresh&seed=7', init = null } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SITE}/lab/gloam-downs/${query}`);
  await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
  if (ctxOpts.hasTouch) await page.tap('#bBegin');
  else { await page.focus('#bBegin'); await page.keyboard.press('Enter'); }
  await G(page, z => { for (const id of z) window.__gloam.out(id); window.__gloam.tick(3.5, {}); }, ZONES);
  return { ctx, page, errors };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
const ready = page => page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
const shot = async (page, name) => { if (!SHOTS) return; await G(page, () => window.__gloam.draw()); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const go = async (page, id) => {
  await G(page, id => window.__gloam.go(id), id);
  await ready(page);
  if (await page.isVisible('#beaconCard')) { await page.click('#wicks button'); await page.click('#sparks button'); await page.click('#bWalkOn'); }
  // (3.5 s: the place's name card is gone, for the pictures)
  await G(page, z => { for (const id of z) window.__gloam.out(id); window.__gloam.tick(3.5, {}); }, ZONES);
};
/* a Snuffer 1.6 m from the lamplighter in the Gaol's south yard, 0.7 rad off its facing (inside the blade's soft aim, and beside the
   lamplighter in the picture rather than behind it), started on its hook and 0.2 s into it. -> its id */
const hookAhead = (page, d = 1.6) => G(page, d => {
  const g = window.__gloam;
  g.set({ hp: 100 });
  g.teleport(5.6, 11.2, -Math.PI / 2);
  g.tick(0.1, {});
  const s = g.state(), a = s.yaw + 0.7, sp = g.spawn('S', s.x + Math.sin(a) * d, s.z + Math.cos(a) * d, a + Math.PI);
  for (let i = 0; i < 120 && g.foes().find(f => f.id === sp.id)?.move !== 'hook'; i++) g.tick(1 / 60, {});
  g.tick(12 / 60, {});
  return sp.id;
}, d);
/* press Attack by `how` and step live until the cut lands (the foe flashes). -> what the foe and the run show on the step of the hit */
async function cutIn(page, id, how, cdp) {
  const box = how === 'touch' ? await page.locator('#bAttack').boundingBox() : null;
  if (how === 'keys') await page.keyboard.down('j');
  else if (how === 'mouse') await page.mouse.down();
  else if (how === 'pad') await G(page, () => window.__press(2, true));
  else if (how === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  let at = null;
  for (let i = 0; i < 30 && !at; i++) {
    await G(page, () => window.__gloam.tick(1 / 60, 'live'));
    if (i === 1) {
      if (how === 'keys') await page.keyboard.up('j');
      else if (how === 'mouse') await page.mouse.up();
      else if (how === 'pad') await G(page, () => window.__press(2, false));
      else if (how === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    at = await G(page, id => { const f = window.__gloam.foes().find(q => q.id === id); return f && f.flash > 0 ? { f, stop: window.__gloam.run().stop, hp: window.__gloam.run().hp } : null; }, id);
  }
  if (how === 'keys') await page.keyboard.up('j');
  return at;
}
const after = (page, id) => G(page, id => {
  const g = window.__gloam, hp = g.run().hp;
  g.tick(1.0, {});
  return { lost: hp - g.run().hp, snap: g.sounds().filter(c => c.cue === 'snap').map(c => c.kind), f: g.foes().find(q => q.id === id) };
}, id);
function checkCut(at, rest, how) {
  assert(at, `${how}: the cut landed`);
  assert.equal(at.f.move === 'hook', false, `${how}: the hook is cancelled (${at.f.move})`);
  assert(at.f.stun >= 20 && at.f.stun <= 21, `${how}: ${at.f.stun} steps of stun`);
  assert.equal(at.f.pose, 'hurt', `${how}: the flinch pose`);
  assert.equal(at.stop, 5, `${how}: a hit stop of ${at.stop}`);
  assert.equal(rest.lost, 0, `${how}: health lost ${rest.lost}`);
  assert(rest.snap.includes('S'), `${how}: the snap in the cue log`);
}

/* ---------------- the desktop: keys, mouse and pad ---------------- */
{
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } }, { init: padMock });
  const out = {};
  for (const how of ['keys', 'mouse', 'pad']) {
    const id = await hookAhead(page);
    const at = await cutIn(page, id, how);
    if (how === 'keys') await shot(page, 'cancel-1280x720');
    const rest = await after(page, id);
    checkCut(at, rest, how);
    out[how] = at.f.stun;
    await G(page, id => { window.__gloam.out(id); window.__gloam.tick(1, {}); }, id);
  }
  pass('cut into a hook at 1280x720 by J, a left click and a pad\'s X: cancelled, the stun, the flinch pose, the snap, a 5-step stop, no health lost', out);
  // a flinch outside a wind-up: a chasing Snuffer cut once
  const fl = await G(page, () => {
    const g = window.__gloam;
    g.teleport(5.6, 11.2, -Math.PI / 2);
    g.tick(0.1, {});
    const s = g.state(), a = s.yaw + 0.7, sp = g.spawn('S', s.x + Math.sin(a) * 1.5, s.z + Math.cos(a) * 1.5, a + Math.PI);
    g.tick(1 / 60, {});
    g.hold(sp.id, 'hook', 0.8); g.hold(sp.id, null);
    g.tick(0.6, {});
    g.tick(9 / 60, { attack: true });
    return g.foes().find(f => f.id === sp.id);
  });
  await shot(page, 'flinch-1280x720');
  await G(page, () => { for (const f of window.__gloam.foes()) window.__gloam.out(f.id); window.__gloam.tick(1, {}); });
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
  pass('a flinch at 1280x720 for the picture', { pose: fl?.pose, stun: fl?.stun });
}

/* ---------------- a phone: touch, the off-screen tell ---------------- */
{
  const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const cdp = await ctx.newCDPSession(page);
  const id = await hookAhead(page);
  const at = await cutIn(page, id, 'touch', cdp);
  await shot(page, 'cancel-390x844');
  const rest = await after(page, id);
  checkCut(at, rest, 'touch');
  pass('cut into a hook at 390x844 by a touch on ATTACK', { stun: at.f.stun });
  const fl = await G(page, id => {
    const g = window.__gloam;
    const f = g.foes().find(q => q.id === id);
    g.hold(id, 'hook', 0.8); g.hold(id, null);
    g.tick(0.6, {});
    g.tick(9 / 60, { attack: true });
    return g.foes().find(q => q.id === id);
  }, id);
  await shot(page, 'flinch-390x844');
  await G(page, id => { window.__gloam.out(id); window.__gloam.tick(1.2, {}); }, id);
  /* a Snuffer 2.4 m to the right with the view narrowed (fov 0.3, so it is outside it): a 48-step wind-up, its tell logged off
     screen at its first step, and a notch at the right edge. In the open the phone's view shows every foe in hook range, so the view
     is narrowed for the check */
  const q = await G(page, () => {
    const g = window.__gloam;
    g.teleport(5.6, 11.2, -Math.PI / 2);
    g.tick(0.1, {});
    g.layout({ fov: 0.3, dist: 7, pitch: 0.3, aim: 1.2 });
    const s = g.state(), sp = g.spawn('S', s.x, s.z - 2.4, 0);
    let start = null, act = null, notch = null, offScreen = null, off = null;
    for (let i = 0; i < 260 && act === null; i++) {
      g.tick(1 / 60, {});
      const f = g.foes().find(x => x.id === sp.id);
      if (start === null && f?.move === 'hook') {
        start = i; g.draw(); off = f.off;
        const p = g.project([f.x, f.y + 0.9, f.z]);
        offScreen = !p || p[0] > innerWidth || p[0] < 0 || p[1] < 0 || p[1] > innerHeight;
      }
      if (start !== null && notch === null && i - start === 20) { g.draw(); notch = g.notches(); }
      if (start !== null && f?.state === 'move' && f.t >= 0.55 - 1e-6 && act === null) act = i;
    }
    const cue = g.sounds().filter(c => c.cue === 'scrape').at(-1);
    g.layout(null);
    return { sp, start, act, cue, notch, offScreen, off };
  });
  assert(q.offScreen && q.off, `the Snuffer is outside the view when it starts (${q.offScreen}, ${q.off})`);
  assert.equal(q.act - q.start, 48, `the wind-up ${q.act - q.start} steps`);
  assert(q.cue && q.cue.off === true, `the tell is logged off screen: ${JSON.stringify(q.cue)}`);
  assert(q.notch?.some(x => x.edge === 'right'), `a notch at the right edge: ${JSON.stringify(q.notch)}`);
  pass('a Snuffer off screen at 390x844: a 48-step wind-up, its tell logged off screen at its first step, and a notch at the right edge', { wind: q.act - q.start, notch: q.notch?.map(x => x.edge) });
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
}

/* ---------------- the armor in six layouts, and the tokens ---------------- */
{
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await go(page, 'bells');
  const sizes = [[320, 640], [390, 844], [360, 640], [800, 600], [1280, 720], [844, 390]], seen = {};
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    const r = await G(page, () => {
      const g = window.__gloam;
      for (const f of g.foes()) g.out(f.id);
      g.tick(1, {});
      g.set({ hp: 100 });
      g.teleport(-0.5, 18.0, Math.PI);
      g.tick(0.1, {});
      // 5.4 m away and off to the side, so its lane runs across the view and the rim stands clear of it
      const sp = g.spawn('I', -3.5, 13.5, 0);
      // and a Snuffer in its hook's wind-up on the other side, for the hook's ground tell
      const sn = g.spawn('S', 2.0, 15.5, 0);
      g.tick(1 / 60, {});
      g.hold(sp.id, 'charge', 0.5);
      g.hold(sn.id, 'hook', 0.3);
      g.tick(1 / 60, {});
      g.draw();
      const fx = g.run().fx, f = g.foes().find(x => x.id === sp.id);
      const tell = fx.hookTell;
      return { armor: fx.armor, tell, f: { move: f.move, armor: f.armor, rim: f.rim }, id: sp.id };
    });
    const cold = r.armor.filter(d => d.ci === 39).length, fire = r.armor.filter(d => d.ci >= 34 && d.ci <= 37).length;
    assert.equal(r.f.armor, true, `${w}x${h}: the charge is armored`);
    assert.equal(cold, 8, `${w}x${h}: ${cold} rim dabs in slot 39`);
    assert.equal(fire, 0, `${w}x${h}: ${fire} rim dabs in fire`);
    // the hook's ground tell: 7 fire dabs (slot 35), on the ground in front of the Snuffer
    assert.equal(r.tell.length, 7, `${w}x${h}: ${r.tell.length} tell dabs`);
    assert(r.tell.every(d => d.ci === 35), `${w}x${h}: the tell in slot 35`);
    seen[`${w}x${h}`] = [cold, r.tell.length];
    if ((w === 390 && h === 844) || (w === 1280 && h === 720)) await shot(page, `armor-${w}x${h}`);
  }
  pass('an Ironback winding up its charge: 8 rim dabs in slot 39 and none in fire slots 34 to 37, and a Snuffer\'s hook tell of 7 dabs in slot 35, in six layouts', seen);
  await page.setViewportSize({ width: 1280, height: 720 });
  // the tokens in The Crow Wall: two Snuffers 2 m away; one winds up, the other circles with no move
  await go(page, 'ramparts');
  const t = await G(page, () => {
    const g = window.__gloam;
    g.set({ hp: 1000 });
    const s = g.state();
    const a = g.spawn('S', s.x + 2, s.z, 0), b = g.spawn('S', s.x - 2, s.z, 0);
    let tok = null, other = null;
    for (let i = 0; i < 240 && !tok; i++) {
      g.tick(1 / 60, {});
      const fs = g.foes(), wind = fs.find(f => f.state === 'move' && f.move === 'hook');
      if (wind) { tok = g.run().tokens; other = fs.find(f => (f.id === a.id || f.id === b.id) && f.id !== wind.id); }
    }
    return { tok, other };
  });
  assert.deepEqual([t.tok.melee, t.tok.max], [1, 1], JSON.stringify(t.tok));
  assert(t.other && t.other.state !== 'move', `the other Snuffer has no move: ${JSON.stringify(t.other)}`);
  pass('the tokens in The Crow Wall: one Snuffer winds up, melee 1 of 1, and the other waits with no move', { tokens: t.tok, other: t.other.state });
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
}

/* ---------------- reduced motion ---------------- */
{
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const id = await hookAhead(page);
  const at = await cutIn(page, id, 'keys');
  const fx = await G(page, () => window.__gloam.run().fx.kick);
  assert(at && at.f.move !== 'hook', 'the hook is cancelled');
  assert.deepEqual(at.f.shake, [0, 0, 0], 'the foe does not shake');
  assert.deepEqual(fx, [0, 0, 0], 'no camera kick');
  assert.equal(at.f.pose, 'hurt', 'the flinch pose');
  await G(page, id => { window.__gloam.out(id); window.__gloam.tick(1.2, {}); }, id);
  await go(page, 'bells');
  const sz = await G(page, () => {
    const g = window.__gloam;
    g.teleport(-0.5, 18.0, Math.PI);
    g.tick(0.1, {});
    const sp = g.spawn('I', -0.5, 12.0, 0);
    g.tick(1 / 60, {});
    const at = t => { g.hold(sp.id, 'charge', t); g.tick(1 / 60, {}); g.draw(); return g.run().fx.armor.map(d => d.s); };
    return [at(0.1), at(0.8)];
  });
  assert(sz[0].length === 8 && sz[1].length === 8, `the rim: ${sz[0].length} then ${sz[1].length}`);
  assert.deepEqual(sz[0], sz[1], 'the rim keeps its size over the wind-up');
  pass('reduced motion: a cancel with no kick and no shake, the flinch pose, and a rim that keeps its size', { s: sz[0][0] });
  assert.deepEqual(errors, [], errors.join('\n'));
  await ctx.close();
}
await browser.close();
console.log(`${n} checks passed`);
