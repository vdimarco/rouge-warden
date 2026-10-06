// Renders the 2x2 spell sheets of the four shore kits (art/spells/<slug>-spells.webp, tiles Q E C R).
// Each tile combines the hero's 3D portrait, a glow in the kit colour, a motion motif and the skill glyph.
// No paid generation: run `node qa/tidebreak/render-shore-spells.mjs` with the site served on port 8765,
// then convert the PNGs with Pillow (see the end of this file).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { NEW_HEROES } from '../../public/tidebreak/legends.js';
import { skillIcon } from '../../public/tidebreak/skill-icons.js';
const base = process.env.SITE || 'http://127.0.0.1:8765/tidebreak/';
const out = process.argv[2] || '.';
const kits = NEW_HEROES.slice(8);
const MOTIFS = { anchor:'streaks', chain:'ring', helm:'burst', anchorfall:'ring', lunge:'streaks', drop:'burst', parry:'burst', horizon:'streaks', gust:'streaks', cyclone:'swirl', windwall:'streaks', storm:'swirl', swap:'swirl', polyp:'burst', coral:'ring', springtide:'ring' };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.goto(base + 'index.html', { waitUntil: 'domcontentloaded' });
for (const h of kits) {
  const tiles = h.kit.map(k => ({ path: skillIcon(k.icon).match(/d="([^"]+)"/)[1], motif: MOTIFS[k.icon] || 'burst' }));
  const data = await page.evaluate(async ({ slug, color, tiles }) => {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = `./art/portraits/${slug}-full.webp`; });
    const T = 627, c = document.createElement('canvas'); c.width = c.height = T * 2; const g = c.getContext('2d');
    let seed = slug.length * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    tiles.forEach((tile, i) => {
      const ox = (i % 2) * T, oy = Math.floor(i / 2) * T;
      g.save(); g.beginPath(); g.rect(ox, oy, T, T); g.clip(); g.translate(ox, oy);
      const bg = g.createRadialGradient(T * .5, T * .45, 20, T * .5, T * .5, T * .75); bg.addColorStop(0, color); bg.addColorStop(.35, color + '66'); bg.addColorStop(1, '#05070c');
      g.fillStyle = '#05070c'; g.fillRect(0, 0, T, T); g.fillStyle = bg; g.fillRect(0, 0, T, T);
      // The hero, large and to one side, so each tile reads as this hero's spell.
      g.globalAlpha = .55; const flip = i % 2 === 1; g.save(); if (flip) { g.translate(T, 0); g.scale(-1, 1); }
      const h = T * 1.5, w = h * img.width / img.height; g.drawImage(img, -T * .25, -T * .05, w, h); g.restore(); g.globalAlpha = 1;
      // Motion motif in the kit colour.
      g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 30; g.lineCap = 'round';
      const cx = T * .5, cy = T * .5;
      if (tile.motif === 'streaks') for (let k = 0; k < 26; k++) { const y = rnd() * T, x = rnd() * T * .6, l = 80 + rnd() * 220; g.globalAlpha = .25 + rnd() * .5; g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - l * .35); g.stroke(); }
      if (tile.motif === 'ring') for (let k = 0; k < 4; k++) { g.globalAlpha = .7 - k * .14; g.lineWidth = 10 - k * 2; g.beginPath(); g.ellipse(cx, cy + 40, 150 + k * 60, 70 + k * 26, 0, 0, Math.PI * 2); g.stroke(); }
      if (tile.motif === 'swirl') for (let k = 0; k < 7; k++) { g.globalAlpha = .65 - k * .07; g.lineWidth = 9 - k; g.beginPath(); g.arc(cx, cy, 60 + k * 38, k, k + 4.2); g.stroke(); }
      if (tile.motif === 'burst') for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, r1 = 60 + rnd() * 60, r2 = r1 + 80 + rnd() * 200; g.globalAlpha = .3 + rnd() * .5; g.lineWidth = 2 + rnd() * 5; g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke(); }
      for (let k = 0; k < 70; k++) { g.globalAlpha = rnd() * .8; g.beginPath(); g.arc(rnd() * T, rnd() * T, 1 + rnd() * 4, 0, Math.PI * 2); g.fill(); }
      // The skill glyph, glowing in the centre.
      g.globalAlpha = 1; g.save(); g.translate(cx - 220, cy - 220); g.scale(11, 11); const path = new Path2D(tile.path);
      g.shadowBlur = 50; g.shadowColor = color; g.lineWidth = 3.4; g.strokeStyle = color; g.stroke(path);
      g.shadowBlur = 12; g.shadowColor = '#ffffff'; g.lineWidth = 1.6; g.strokeStyle = '#fff8ec'; g.stroke(path); g.restore();
      // Vignette.
      g.shadowBlur = 0; const v = g.createRadialGradient(cx, cy, T * .3, cx, cy, T * .75); v.addColorStop(0, '#0000'); v.addColorStop(1, '#000a'); g.fillStyle = v; g.fillRect(0, 0, T, T);
      g.restore();
    });
    return c.toDataURL('image/png');
  }, { slug: h.slug, color: h.color, tiles });
  writeFileSync(`${out}/${h.slug}-spells.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log('rendered', h.slug);
}
await browser.close();
// Convert: python3 -c "from PIL import Image;import sys;[Image.open(f).convert('RGB').save(f[:-4]+'.webp',quality=86) for f in sys.argv[1:]]" *-spells.png
