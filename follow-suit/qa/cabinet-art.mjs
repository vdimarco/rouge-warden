// Makes the art for the Follow Suit machine in the Cottage Arcade: one frame of a ring from the real game, saved as
// public/arcade/follow-suit.webp. The machine screen and the game switcher tile both show it.
//
//   npm run build && node qa/cabinet-art.mjs
//
// Seed K7QX2M plays the 360 ring from qa/feel.e2e.mjs. The frame is taken 900 ms after the cards start to move into
// the ring, when Value, Mult and the ring marker are lit. The crop is the full width of a 390 by 844 phone and the
// shape of a machine screen (4 by 3.3). The arcade keeps each machine picture under 60 KB.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, startSession } from './lib.mjs';

const SEED = 'K7QX2M';
const CHAIN = ['6C', '6D', '7D', '7S', ['8S', 'C'], 'AC'];
const OUT = join(HERE, '..', '..', 'public', 'arcade', 'follow-suit.webp');
const WIDTH = 480;
const HEIGHT = Math.round(WIDTH / (4 / 3.3));
const MAX_BYTES = 60 * 1024;

const session = await startSession();
const page = await session.phone(390, 844);
await page.goto(`${session.base}?seed=${SEED}`);
await page.getByRole('button', { name: 'Start table 1' }).tap();
await page.waitForSelector('[data-testid="hand"] [data-card]');
for (const entry of CHAIN) {
  const [code, suit] = Array.isArray(entry) ? entry : [entry];
  await page.tap(`[data-testid="hand"] [data-card="${code}"]`);
  if (suit) await page.tap(`[data-testid="suit-picker"] [data-suit="${suit}"]`);
}
await page.getByRole('button', { name: 'Play chain' }).tap();
await page.waitForSelector('[data-testid="chain"][data-ringed="true"]');
await page.waitForTimeout(900);

const area = await page.locator('.chain-area').boundingBox();
const viewport = page.viewportSize();
const height = Math.round(viewport.width / (4 / 3.3));
const png = await page.screenshot({ clip: { x: 0, y: Math.round(area.y), width: viewport.width, height } });

// Chromium encodes the WebP, so the script needs no image tools.
const canvasPage = await session.browser.newPage();
let bytes = null;
for (const quality of [0.92, 0.86, 0.8, 0.72, 0.64]) {
  const data = await canvasPage.evaluate(
    async ({ png, width, height, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/webp', quality);
    },
    { png: png.toString('base64'), width: WIDTH, height: HEIGHT, quality },
  );
  if (!data.startsWith('data:image/webp;base64,')) throw new Error('This Chromium cannot encode WebP.');
  bytes = Buffer.from(data.split(',')[1], 'base64');
  if (bytes.length < MAX_BYTES) {
    console.log(`quality ${quality}: ${(bytes.length / 1024).toFixed(1)} KB`);
    break;
  }
}
if (bytes.length >= MAX_BYTES) throw new Error(`The art is ${(bytes.length / 1024).toFixed(1)} KB, over 60 KB.`);
writeFileSync(OUT, bytes);
console.log(`wrote ${OUT} (${WIDTH} by ${HEIGHT})`);
if (session.errors.length > 0) console.log(`console errors:\n${session.errors.join('\n')}`);
const failed = await session.finish();
process.exit(failed > 0 || session.errors.length > 0 ? 1 : 0);
