// Makes the Moonwell machine art, public/arcade/moonwell.webp (480 x 270, under 60 KB), from a frame of the real
// game: a bot plays a seeded run, and the frame is taken while the pearl flies high over the islands.
//   NODE_PATH=qa/browser/node_modules node qa/moonwell/cabinet-art.mjs     (needs the site served and ImageMagick)
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '') + '/moonwell/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })).newPage();
await page.goto(BASE);
await page.waitForFunction(() => window.moonwell && window.moonwell.snapshot.artReady);
await page.evaluate(() => { window.moonwell.start(2026); window.moonwell.autoplay(true, 0.97); });
// a high flight past island 5, with no banner on the screen
await page.waitForFunction(() => { const s = window.moonwell.snapshot; return s.island >= 5 && s.ball.mode === 'free' && s.ball.vy < -200 && s.cam.zoom < 0.95 && !document.getElementById('banner').classList.contains('show'); }, null, { timeout: 120000, polling: 50 });
await page.addStyleTag({ content: '.hud, #pulse, #hint, .pads { visibility: hidden !important; }' });
const png = path.join(os.tmpdir(), 'moonwell-cabinet.png');
await page.screenshot({ path: png });
await browser.close();
execFileSync('convert', [png, '-resize', '480x270', '-quality', '90', 'public/arcade/moonwell.webp']);
console.log('public/arcade/moonwell.webp written');
