// Frame-time check for a scene: draws N frames in the preview and reports scene.draw time (performance.now).
//   python3 -m http.server 8767 --directory openspec/changes/add-first-breath/research/paper-cut   (in one shell)
//   NODE_PATH=qa/browser/node_modules node openspec/changes/add-first-breath/research/paper-cut/bench.mjs <id> [frames=60] [w=1280] [h=720] [--raster swiftshader|cpu] [--flush] [--query low=1]
// --raster swiftshader (default) uses the repo's test flags; cpu uses --disable-gpu (software raster).
// --flush adds a 1 px getImageData after each draw so the raster work counts too (an upper bound).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const modDir = process.env.NODE_PATH || 'qa/browser/node_modules';
const { chromium } = require(require.resolve('playwright', { paths: [modDir] }));

const args = process.argv.slice(2);
const has = (f) => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const val = (f, d) => { const i = args.indexOf(f); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flush = has('--flush');
const extra = val('--query', '');
const raster = val('--raster', 'swiftshader');
const [id, frames = '60', w = '1280', h = '720'] = args;
if (!id) { console.error('usage: node tools/bench.mjs <id> [frames] [w] [h] [--raster swiftshader|cpu] [--flush]'); process.exit(2); }
const flags = raster === 'cpu' ? ['--disable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: flags });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +val('--dpr', 1) });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`${process.env.BASE || "http://127.0.0.1:8767"}/preview.html?scene=${encodeURIComponent(id)}&bench=${frames}&w=${w}&h=${h}${flush ? '&flush=1' : ''}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const r = await page.evaluate(() => ({ bench: window.__bench, errors: window.__errors }));
if (has('--short') || process.env.SHORT) console.log(raster, extra, 'draw', r.bench.drawMs.mean, 'p95', r.bench.drawMs.p95, r.bench.withFlushMs ? 'flushed ' + r.bench.withFlushMs.mean + ' p95 ' + r.bench.withFlushMs.p95 : '', r.errors.join('|'));
else console.log(JSON.stringify({ raster, ...r.bench, errors: r.errors }, null, 1));
await browser.close();
