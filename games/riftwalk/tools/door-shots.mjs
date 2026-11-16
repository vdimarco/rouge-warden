// Draws the picture each storefront door shows: the world behind it, as the page itself draws it, with no frames.
// Usage: node games/riftwalk/tools/door-shots.mjs <out dir> <zone> [more zones]      (needs the static server)
// It writes <out dir>/<zone>.png at 1024 by 1024. Convert each to worlds/rooms/<zone>/door.webp.
// Software WebGL draws a 500,000-splat world in a few minutes, so the script waits SETTLE ms (default 200000).
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
const { chromium } = createRequire(new URL('../../../qa/browser/x.mjs', import.meta.url))('playwright');
const [out, ...zones] = process.argv.slice(2), root = new URL('../../../public/lab/riftwalk/worlds/', import.meta.url);
mkdirSync(out, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const zone of zones) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  // The alley is not in the picture: a small world file stands in for it, so the page starts quickly.
  await page.route('**/worlds/hall/hall.spz', r => r.fulfill({ contentType: 'application/octet-stream', body: readFileSync(new URL(`rooms/${zone}/150k.spz`, root)) }));
  await page.goto(`http://127.0.0.1:8765/lab/riftwalk/?capture&px=1&q=500k&zone=${zone}`);
  await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 240000 }); await page.click('#go'); await page.keyboard.press('r');
  const end = Date.now() + 300000; while (Date.now() < end) { const s = await page.evaluate(() => window.__riftwalk.state()); if (s.room === zone && s.phase === 'hall' && s.splats >= 400000) break; await page.waitForTimeout(1000); }
  await page.evaluate(() => { window.__riftwalk.bare(true); window.__riftwalk.look(0); });
  await page.waitForTimeout(+process.env.SETTLE || 200000);
  const data = await page.evaluate(() => document.getElementById('view').toDataURL('image/png')); writeFileSync(`${out}/${zone}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log('door picture', zone);
  await page.close();
}
await browser.close();
