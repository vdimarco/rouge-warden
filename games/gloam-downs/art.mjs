// The cabinet art: one view of a place, drawn by Ink Studio's CPU renderer (it matches the page's WebGL picture), written as
//   public/arcade/gloam-downs.webp            480 x 396, the homepage cabinet's screen and the switcher's picture
//   the Corridor's ART.gloam_downs           448 x 370, a WebP data URI under 60 KB, written into public/corridor/index.html
//   node art.mjs gaol --cam 4,1.4,24,8.6,0.08,0.24     (target x,y,z, distance, yaw, pitch; default: behind the start)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, loadPlace, preview } from './bake.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2), id = args[0] || 'gaol';
const ci = args.indexOf('--cam');
const built = build(await loadPlace(id));
const s = built.meta.spawn;
let cam = { target: [s.p[0], s.p[1] + 1.2, s.p[2]], dist: 8.6, yaw: s.yaw + Math.PI + 0.12, pitch: 0.24 };
if (ci >= 0) { const v = args[ci + 1].split(',').map(Number); cam = { target: v.slice(0, 3), dist: v[3], yaw: v[4], pitch: v[5] }; }
const png = path.join(HERE, 'preview', `art-${id}.png`);
fs.mkdirSync(path.dirname(png), { recursive: true });
preview(built, { w: 480, h: 396, px: 2, file: png, cam });
// encode with Pillow: the big picture as it is, the Corridor's at 448 x 370 with nearest-neighbour scaling (pixel art stays crisp)
const py = `
import sys, base64, io
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
im.save(sys.argv[2], 'WEBP', quality=82, method=6)
small = im.resize((448, 370), Image.NEAREST)
q = 80
while True:
    b = io.BytesIO(); small.save(b, 'WEBP', quality=q, method=6)
    if b.tell() < 60000 or q < 30: break
    q -= 5
print(base64.b64encode(b.getvalue()).decode())
`;
const out = path.join(ROOT, 'public/arcade/gloam-downs.webp');
const b64 = execFileSync('python3', ['-c', py, png, out], { maxBuffer: 1 << 24 }).toString().trim();
const corridor = path.join(ROOT, 'public/corridor/index.html');
let html = fs.readFileSync(corridor, 'utf8');
const line = `          gloam_downs: 'data:image/webp;base64,${b64}',`;
if (/^ +gloam_downs: 'data:image\/webp;base64,[^']+',$/m.test(html)) html = html.replace(/^ +gloam_downs: 'data:image\/webp;base64,[^']+',$/m, line);
else html = html.replace(/^( +splat_isle: 'data:image\/webp;base64,[^']+',)$/m, `$1\n${line}`);
fs.writeFileSync(corridor, html);
console.log(`wrote ${path.relative(ROOT, out)} (${fs.statSync(out).size} bytes) and the Corridor's ${(b64.length * 0.75 / 1024).toFixed(1)} KB picture, from ${png}`);
