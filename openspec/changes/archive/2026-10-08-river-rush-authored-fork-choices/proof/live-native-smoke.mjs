import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const repo = '/workspace/rouge-warden';
const { chromium } = createRequire(`${repo}/games/river-rush/package.json`)('playwright');
const out = '/tmp/river-rush-authored-release-live-controls';
const base = 'https://arcade.uptick.systems/river-rush/?v=75a484d';
await fs.mkdir(out, { recursive: true });
const report = { passed: false, scope: 'short-cold-production-native-controls-and-exact-pause',
  base, codeCommit: '75a484ddd0d1a6db5929495e5f989ebef2f8d452',
  actualAppStateOrClockMutations: false, fixedNaturalSeedOrClock: false,
  pairedChoiceEvidence: '/tmp/river-rush-authored-release-live-phone/offline-live-gameplay-audit.json',
  errors: [], scoreWrites: [], limitations: ['Chromium phone viewport on SwiftShader; hardware phone FPS and human fun are not measured.',
    'This short run verifies native controls and pause. Paid fork choices are independently audited from the preserved preceding live trace.'] };
const legacy = await fs.readFile(`${repo}/qa/river-rush/wild-finale.mjs`, 'utf8');
const install = legacy.slice(legacy.indexOf('function install(){'), legacy.indexOf('const state=p=>'));
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', error => report.errors.push(error.message));
  p.on('request', request => {
    if (request.url().includes('/api/river-rush-leaderboard') && request.method() !== 'GET')
      report.scoreWrites.push({ method: request.method(), url: request.url() });
  });
  await p.addInitScript({ content: install + '\ninstall();' });
  await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('[aria-label="Start run"]');
    return b && !b.disabled; }, {}, { timeout: 90000 });
  const status = () => p.evaluate(() => __tools.get_run_status({}));
  const read = () => p.evaluate(() => { const g = __raw(); return { seed: g.seed,
    campaignSeed: g.campaignSeed, time: g.time, distance: g.distance, phase: g.phase,
    lane: g.lane, visualLane: g.visualLane, action: g.action, shield: g.shield, shieldsUsed: g.shieldsUsed }; });
  report.bundle = await p.evaluate(() => [...document.scripts].map(s => s.src)
    .find(src => src.includes('/river-rush/assets/index-')));
  assert.ok(report.bundle.endsWith('index-CqqlzDw1.js'));
  report.coldReady = await status();
  assert.equal(report.coldReady.renderer.kind, 'webgl');
  assert.equal(report.coldReady.renderer.prepared, true);
  assert.ok(Object.values(report.coldReady.renderer.models).every(value => value === 'ready'));
  assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
  report.resourcesBefore = await p.evaluate(() => ({ ...__resources }));
  await p.getByRole('button', { name: 'Start run', exact: true }).click();
  report.started = await read(); assert.equal(report.started.phase, 'playing');
  const startLane = report.started.lane;
  const keyboardLane = startLane < 4 ? startLane + 1 : startLane - 1;
  const keyboardCode = keyboardLane > startLane ? 'ArrowRight' : 'ArrowLeft';
  await p.keyboard.press(keyboardCode);
  await p.waitForFunction(target => __raw().lane === target && Math.abs(__raw().visualLane - target) < .1, keyboardLane);
  report.nativeKeyboard = { from: startLane, to: keyboardLane, code: keyboardCode, after: await read() };
  const point = await p.evaluate(() => ({ x: innerWidth * .5, y: innerHeight * .55,
    element: document.elementFromPoint(innerWidth * .5, innerHeight * .55)?.className }));
  assert.match(String(point.element), /game-canvas|\bapp\b/);
  await p.mouse.move(point.x, point.y); await p.mouse.down();
  await p.mouse.move(point.x + (keyboardLane > startLane ? -33 : 33), point.y, { steps: 3 }); await p.mouse.up();
  await p.waitForFunction(target => __raw().lane === target, startLane);
  report.nativePointer = { from: keyboardLane, to: startLane, point, after: await read(), actualAppHandler: true };
  assert.ok(report.nativePointer.after.time > report.nativeKeyboard.after.time);
  assert.equal(report.nativePointer.after.campaignSeed, report.started.campaignSeed);
  await p.keyboard.press('Escape');
  await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
  const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
  const before = await status(), pixels = await p.locator('canvas').screenshot();
  await p.waitForTimeout(150);
  const after = await status(), stopped = await p.locator('canvas').screenshot();
  assert.deepEqual(after, before); assert.ok(stopped.equals(pixels));
  report.pause = { sameStatus: true, samePixels: true,
    sha256: createHash('sha256').update(pixels).digest('hex'), modalSettledAndHidden: true };
  await p.screenshot({ path: `${out}/phone-live-native-controls-paused.jpg`, type: 'jpeg', quality: 85 });
  await hide.evaluate(style => style.remove());
  report.final = await read(); report.status = await status();
  assert.equal(report.final.phase, 'playing'); assert.equal(report.status.screen, 'paused');
  assert.equal(report.final.shield, true); assert.equal(report.final.shieldsUsed, 0);
  report.resourcesAfter = await p.evaluate(() => ({ ...__resources }));
  assert.deepEqual(report.resourcesAfter, report.resourcesBefore);
  assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
  assert.ok(report.status.renderer.drawCalls <= 65 && report.status.renderer.triangles <= 125000);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.scoreWrites, []);
  report.passed = true;
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await browser.close();
  await fs.writeFile(`${out}/live-native-controls.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: true, report: `${out}/live-native-controls.json`,
  bundle: report.bundle, distance: report.final.distance, exactPause: report.pause.samePixels,
  publicScoreWrites: report.scoreWrites.length }));
