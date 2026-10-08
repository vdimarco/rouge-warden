import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../../games/river-rush/package.json', import.meta.url))('playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const out = process.env.SHOTS || 'openspec/changes/river-rush-restyled-title-hero/qa';
const selected = process.env.CASE || 'all';
assert.ok(['all', 'landscape', 'phone', 'image-failure'].includes(selected));
const layouts = [{ name: 'desktop', width: 1365, height: 900 }, { name: 'phone', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 }];
const checkedLayouts = selected === 'all' ? layouts : layouts.filter(layout => layout.name === selected);
await fs.mkdir(out, { recursive: true });
const report = { passed: false, base, selected, scope: 'Built title hero and existing menu actions only',
  previousUnchangedDesktopPhoneProof: selected === 'landscape' ? 'title-hero.json; only the landscape heading/spacing CSS changed' : null,
  layouts: [], actions: [], errors: [], scoreWrites: [], imageRequests: [], imageFailure: null, reducedMotion: null,
  actualAppStateOrClockMutations: false, fixedSeedOrClock: false,
  limitations: ['Chromium uses SwiftShader; no physical device FPS or campaign/gameplay regression claim.',
    'Readability and face crop need actual-image review; rectangle and hit-target checks are recorded separately.'] };
const receipt = `${out}/title-hero${selected === 'all' ? '' : `-${selected}`}.json`;
const checkpoint = () => fs.writeFile(receipt, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const firstLayout = checkedLayouts[0] ?? layouts[1];
const p = await browser.newPage({ viewport: { width: firstLayout.width, height: firstLayout.height } });
p.on('pageerror', error => report.errors.push(error.message));
p.on('request', request => { if (request.url().includes('/api/river-rush-leaderboard') && request.method() !== 'GET')
  report.scoreWrites.push({ url: request.url(), method: request.method() }); });
p.on('requestfinished', request => { if (request.url().includes('/art/title-hero-reference-v1.webp'))
  report.imageRequests.push(request.url()); });
await p.addInitScript(() => {
  window.__titleTools = {};
  Object.defineProperty(document, 'modelContext', { value: { registerTool(tool) { window.__titleTools[tool.name] = tool.execute; } } });
});
const runStatus = () => p.evaluate(() => __titleTools.get_run_status({}));
const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
async function ready({ allowMissingHero = false } = {}) {
  await p.waitForFunction(() => { const button = document.querySelector('button[aria-label="Start run"]');
    return button && !button.disabled; }, {}, { timeout: 90000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(missing => { const img = document.querySelector('.title-hero img');
    return img?.complete && (missing || img.naturalWidth > 0); }, allowMissingHero);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
}
async function measure(layout) {
  return p.evaluate(({ layout }) => {
    const rect = element => { const r = element.getBoundingClientRect();
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY,
        width: r.width, height: r.height }; };
    const image = document.querySelector('.title-hero img'), css = getComputedStyle(image);
    const controls = [...document.querySelectorAll('.menu button,.menu a')].map(element => ({ text: element.textContent.trim(),
      label: element.getAttribute('aria-label'), disabled: element.disabled ?? false, rect: rect(element) }));
    return { layout, viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight },
      image: { src: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        rect: rect(image), objectFit: css.objectFit, objectPosition: css.objectPosition, pointerEvents: css.pointerEvents,
        animationName: css.animationName, visibility: css.visibility },
      heading: { text: document.querySelector('.menu h1').textContent, rect: rect(document.querySelector('.menu h1')),
        color: getComputedStyle(document.querySelector('.menu h1')).color },
      brand: rect(document.querySelector('.brand')), tagline: rect(document.querySelector('.tagline')),
      start: rect(document.querySelector('.menu .start')), maps: [...document.querySelectorAll('.map-card')].map(rect), controls,
      footer: rect(document.querySelector('.menu-footer')), videoCount: document.querySelectorAll('.menu video').length,
      heroPosition: getComputedStyle(document.querySelector('.title-hero')).position,
      baseColor: getComputedStyle(document.querySelector('.menu')).backgroundColor };
  }, { layout });
}
function assertLayout(proof, { allowMissingHero = false } = {}) {
  assert.ok(proof.document.width <= proof.viewport.width + 1, 'Title must not create horizontal scrolling');
  assert.equal(proof.image.objectFit, 'cover'); assert.equal(proof.image.pointerEvents, 'none');
  assert.equal(proof.image.animationName, 'none'); assert.equal(proof.videoCount, 0);
  assert.equal(proof.image.complete, true); if (!allowMissingHero) { assert.ok(proof.image.naturalWidth > 0);
    assert.equal(proof.image.visibility, 'visible'); }
  assert.ok(!overlap(proof.brand, proof.heading), 'Header and title remain separate');
  assert.ok(!overlap(proof.heading, proof.tagline)); assert.ok(!overlap(proof.tagline, proof.start));
  for (const map of proof.maps) assert.ok(!overlap(map, proof.start));
  for (let i = 0; i < proof.controls.length; i++) {
    const control = proof.controls[i]; assert.ok(control.rect.left >= -1 && control.rect.right <= proof.viewport.width + 1);
    for (const other of proof.controls.slice(i + 1)) assert.ok(!overlap(control.rect, other.rect), 'Menu actions have distinct hit areas');
  }
}
async function actions(layout, { allowMissingHero = false, onlyStart = false } = {}) {
  const steps = [];
  if (!onlyStart) {
  await p.getByRole('button', { name: 'How to play', exact: true }).click();
  await p.getByRole('dialog', { name: 'How to play', exact: true }).waitFor();
  assert.equal((await runStatus()).screen, 'help'); steps.push('Open Help through visible button');
  await p.getByRole('button', { name: 'Close instructions', exact: true }).click();
  assert.equal((await runStatus()).screen, 'menu'); steps.push('Close Help back to title');
  await p.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await p.getByRole('dialog', { name: 'Public leaderboard', exact: true }).waitFor();
  assert.equal((await runStatus()).screen, 'leaderboard'); steps.push('Open public Leaderboard, read only');
  await p.getByRole('button', { name: 'Close leaderboard', exact: true }).click();
  assert.equal((await runStatus()).screen, 'menu'); steps.push('Close Leaderboard back to title');
  }
  await p.getByRole('button', { name: 'Start run', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('.app')?.classList.contains('in-game'));
  assert.equal((await runStatus()).screen, 'playing'); steps.push('Start ready run through real button');
  await p.getByRole('button', { name: 'Pause game', exact: true }).click();
  await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Back to river', exact: true }).click();
  assert.equal((await runStatus()).screen, 'menu'); steps.push('Pause and return to title through real buttons');
  await ready({ allowMissingHero }); const proof = await measure(layout); assertLayout(proof, { allowMissingHero });
  return { layout: layout.name, steps, titleRestored: true, imageLoadedOnReturn: proof.image.naturalWidth > 0 };
}
try {
  if (selected === 'image-failure') await p.route(/\/art\/title-hero-reference-v1\.webp(?:\?.*)?$/, route => route.abort());
  await p.goto(base); await ready({ allowMissingHero: selected === 'image-failure' });
  report.bundle = await p.evaluate(() => [...document.scripts].map(script => script.src).find(src => src.includes('/river-rush/assets/index-')));
  if (process.env.EXPECTED_BUNDLE) assert.ok(report.bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  for (const layout of checkedLayouts) {
    await p.setViewportSize({ width: layout.width, height: layout.height }); await ready();
    const proof = await measure(layout), screenshot = `${out}/${layout.name}-title${selected === 'landscape' ? '-final' : ''}.jpg`;
    await p.screenshot({ path: screenshot, type: 'jpeg', quality: 82 });
    report.layouts.push({ ...proof, screenshot }); await checkpoint();
    console.log(JSON.stringify({ layout: layout.name, screenshot })); assertLayout(proof);
    if (selected === 'landscape') assert.ok(proof.start.bottom <= layout.height, 'Entire landscape Start button is visible in the initial viewport');
  }
  for (const layout of checkedLayouts) {
    await p.setViewportSize({ width: layout.width, height: layout.height }); await ready();
    report.actions.push(await actions(layout, { onlyStart: selected === 'landscape' })); await checkpoint();
  }
  const phone = layouts[1];
  if (selected === 'all') {
  await p.setViewportSize({ width: phone.width, height: phone.height });
  await p.emulateMedia({ reducedMotion: 'reduce' }); await ready();
  const reduced = await measure(phone); assertLayout(reduced);
  const before = await p.locator('.title-hero').screenshot(); await p.waitForTimeout(150);
  assert.deepEqual(await p.locator('.title-hero').screenshot(), before, 'Reduced-motion artwork remains static');
  report.reducedMotion = { imageVisible: reduced.image.naturalWidth > 0, sameHeroPixels: true,
    noTitleVideo: true, actions: await actions(phone), image: reduced.image }; await checkpoint();
  }
  if (selected === 'all' || selected === 'image-failure') {
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await p.setViewportSize({ width: phone.width, height: phone.height });
  if (selected !== 'image-failure') {
  await p.route(/\/art\/title-hero-reference-v1\.webp(?:\?.*)?$/, route => route.abort());
  await p.reload(); await ready({ allowMissingHero: true });
  }
  const failure = await measure(phone); assertLayout(failure, { allowMissingHero: true });
  assert.equal(failure.image.naturalWidth, 0, 'Failure case actually blocks the hero image');
  assert.equal(failure.image.visibility, 'hidden', 'Failed hero leaves no browser broken-image placeholder');
  const screenshot = `${out}/phone-title-image-unavailable.jpg`; await p.screenshot({ path: screenshot, type: 'jpeg', quality: 82 });
  report.imageFailure = { requestAbortedLocally: true, prefersReducedMotion: await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    darkBase: failure.baseColor, failedImageHiddenWithoutPlaceholder: true, startReadyDespiteImageFailure: true,
    screenshot, actions: await actions(phone, { allowMissingHero: true }), proof: failure }; await checkpoint();
  }
  assert.deepEqual(report.scoreWrites, []); assert.deepEqual(report.errors, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, report: receipt }));
} catch (error) { report.failure = error.stack; throw error; }
finally { await checkpoint(); await browser.close(); }
