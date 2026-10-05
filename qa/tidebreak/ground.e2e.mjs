// The 2D fallback ground at the full map size: water is painted at every river sample (both realms, several seeds)
// and the ground canvas covers the whole map with no holes.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/ground.e2e.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const ORIGIN = process.env.SHORE_ORIGIN || 'http://127.0.0.1:8765';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Any same-origin page can import the game modules; the art folder listing loads nothing else.
  await page.goto(ORIGIN + '/tidebreak/art/');
  const report = await page.evaluate(async () => {
    const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(src)); image.src = src; });
    const [ground, surfaces] = await Promise.all([load('/tidebreak/art/toon-ground.webp'), load('/tidebreak/art/illustrated/terrain-surfaces.webp')]);
    // The same four ground tiles the 2D renderer cuts from the ground sheet.
    const tiles = Array.from({ length: 4 }, (_, i) => { const size = i === 3 ? 220 : 300, c = document.createElement('canvas'), half = ground.width / 2; c.width = c.height = size; c.getContext('2d').drawImage(ground, i % 2 * half + 12, Math.floor(i / 2) * half + 12, half - 24, half - 24, 0, 0, size, size); return c; });
    const { makeScenery } = await import('/tidebreak/scenery.js'), { paintGround } = await import('/tidebreak/paint-ground.js');
    const { riverGeometry } = await import('/tidebreak/river.js'), { SIZE } = await import('/tidebreak/world.js');
    const out = [];
    for (const seed of [49, 7, 91822]) for (const phase of [0, 1]) {
      const canvas = paintGround(tiles, makeScenery(seed, phase), surfaces), c = canvas.getContext('2d'), k = canvas.width / SIZE;
      const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data, at = (x, y) => { const i = (Math.min(canvas.height - 1, Math.round(y * k)) * canvas.width + Math.min(canvas.width - 1, Math.round(x * k))) * 4; return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]; };
      const samples = riverGeometry(seed).samples, dry = samples.filter(p => { const [r, g, b] = at(p.x, p.y); return !(b > r + 15 && g > r); });
      let holes = 0; for (let x = 0; x <= SIZE; x += SIZE / 40) for (let y = 0; y <= SIZE; y += SIZE / 40) if (at(x, y)[3] !== 255) holes++;
      out.push({ seed, phase, size: canvas.width, samples: samples.length, dry: dry.length, firstDry: dry[0] && { x: Math.round(dry[0].x), y: Math.round(dry[0].y), rgb: at(dry[0].x, dry[0].y) }, holes });
    }
    return out;
  });
  for (const r of report) {
    assert.equal(r.dry, 0, `water is painted at every river sample (seed ${r.seed}, realm ${r.phase}): ${JSON.stringify(r.firstDry)}`);
    assert.equal(r.holes, 0, 'the ground canvas covers the whole map');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: the 2D ground paints water at every river sample in both realms for three seeds and covers the whole map.', JSON.stringify(report.map(r => ({ seed: r.seed, realm: r.phase, samples: r.samples, canvas: r.size }))));
} finally { await browser.close(); }
