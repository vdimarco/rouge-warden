// A design tool from the combat run's design rounds, not a check. Draws a baked place in software WebGL (SwiftShader) with 6 foes (copies
// of the lamplighter), hidden by bones or at density 0, and a boss 3 times as big, and times the frame (sort-bench.html).
// Needs the site served (SITE_URL, default http://127.0.0.1:8765). SIZE=147x317 and FRAMES=3 by default; `shot` writes two pictures
// into SHOTS (default the system temp folder).
// Run: node games/gloam-downs/tools/sort-bench-page.mjs [place] [shot]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { chromium } = createRequire(new URL('../../../qa/browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || os.tmpdir();
const id = process.argv[2] || 'gaol';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
await page.route('**/bench/**', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(HERE, 'sort-bench.html'), 'utf8') }));
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.text().startsWith('RESULT')) console.log(m.text()); });
await page.goto(`${SITE}/bench/`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
if (process.argv[3] === 'shot') {
  for (const [name, cfg] of [['foes6', { n: 6 }], ['boss', { n: 0, boss: 3 }]]) {
    const url = await page.evaluate(([i, c]) => window.shot(i, c, 320, 180), [id, cfg]);
    fs.writeFileSync(path.join(SHOTS, `bench-${id}-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(`shots written to ${SHOTS}`);
} else {
  const configs = [
    { label: 'today', n: 0 },
    { label: '+6 foes on screen', n: 6 },
    { label: '+6 foes collapsed (hidden by bones)', n: 6, hide: 'collapse' },
    { label: '+6 foes density 0', n: 6, hide: 'density' },
    { label: '+6 foes and a 3x boss', n: 6, boss: 3 }
  ];
  const t0 = Date.now();
  const size = (process.env.SIZE || '147x317').split('x').map(Number);
  const res = await page.evaluate(([i, c, s, f]) => window.bench(i, c, [s], f), [id, configs, size, +(process.env.FRAMES || 3)]);
  console.table(res);
  console.log(`took ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
