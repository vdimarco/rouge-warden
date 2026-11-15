// Packs a Viggle PINOC scene (a raw Gaussian splat reconstruction, .spz) for Riftwalk.
// - measures the file: the capture point is the origin and the floor is about 1.5 m below it, so the nearest ground
//   under the origin gives the metres in one file unit;
// - scales the world to metres and puts the floor on y = 0 (the eye is then at y = 1.5);
// - keeps <count> splats, chosen at random with a seed, and widens the kept ones so surfaces stay closed;
// - writes a gzip .spz (version 3) with no spherical harmonics, and a contact sheet of four views to look at.
// It runs Spark (public/lab/riftwalk/lib) in headless Chromium, because Spark holds the only .spz reader here.
// Usage: node games/riftwalk/tools/pack-world.mjs <in.spz> <out.spz> [count=300000] [sheet.jpg]
// Needs the static server (see AGENTS.md) and Playwright.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const require = createRequire(new URL('../../../qa/browser/x.mjs', import.meta.url));
const { chromium } = require('playwright');
const [input, output, countArg, sheet] = process.argv.slice(2);
if (!input || !output) { console.error('usage: node pack-world.mjs <in.spz> <out.spz> [count] [sheet.jpg]'); process.exit(1); }
const COUNT = +countArg || 300000, ORIGIN = process.env.SITE_URL || 'http://127.0.0.1:8765';
const html = `<!doctype html><script type="importmap">{"imports":{"three":"/vr/lib/three.module.min.js","three/addons/postprocessing/Pass.js":"/lab/riftwalk/lib/Pass.js","@sparkjsdev/spark":"/lab/riftwalk/lib/spark.module.min.js"}}</script>
<canvas id="c" width="1280" height="720"></canvas>
<script type="module">
import * as THREE from 'three';
import { PackedSplats, SplatMesh, SparkRenderer, writeSpz } from '@sparkjsdev/spark';
try {
  const bytes = new Uint8Array(await (await fetch('/__world.spz')).arrayBuffer());
  const source = new PackedSplats({ fileBytes: bytes }); await source.initialized;
  const n = source.numSplats, pos = new Float32Array(n * 3), sc = new Float32Array(n * 3), rot = new Float32Array(n * 4), al = new Float32Array(n), col = new Float32Array(n * 3);
  source.forEachSplat((i, c, s, q, o, k) => { pos.set([c.x, c.y, c.z], i * 3); sc.set([s.x, s.y, s.z], i * 3); rot.set([q.x, q.y, q.z, q.w], i * 4); al[i] = o; col.set([k.r, k.g, k.b], i * 3); });
  // The ground under the capture point: solid splats in a narrow cone below the origin; the nearest tenth of them.
  const below = []; let far = 0;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; far = Math.max(far, Math.hypot(x, y, z)); if (y < 0 && al[i] > .5 && Math.hypot(x, z) < -y * .25) below.push(-y); }
  below.sort((a, b) => a - b);
  const floor = below.length ? below[Math.floor(below.length * .1)] : 1.5, metres = 1.5 / floor;
  // A seeded choice of splats to keep.
  let seed = 20261115; const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const solid = []; for (let i = 0; i < n; i++) if (al[i] > .02) solid.push(i);
  const keep = Math.min(${COUNT}, solid.length), fraction = keep / solid.length, widen = Math.min(1.8, Math.pow(fraction, -.5));
  for (let i = solid.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)), t = solid[i]; solid[i] = solid[j]; solid[j] = t; }
  const out = new PackedSplats({ maxSplats: keep }), c = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion(), k = new THREE.Color();
  for (let m = 0; m < keep; m++) {
    const i = solid[m];
    c.set(pos[i * 3] * metres, pos[i * 3 + 1] * metres + 1.5, pos[i * 3 + 2] * metres); s.set(sc[i * 3], sc[i * 3 + 1], sc[i * 3 + 2]).multiplyScalar(metres * widen);
    q.set(rot[i * 4], rot[i * 4 + 1], rot[i * 4 + 2], rot[i * 4 + 3]); k.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    out.pushSplat(c, s, q, al[i], k);
  }
  const written = await writeSpz(out, { maxSh: 0, version: 3 });
  window.__bytes = written.fileBytes;
  window.__info = { splats: n, kept: keep, floorUnits: +floor.toFixed(4), metresPerUnit: +metres.toFixed(4), farthestMetres: +(far * metres).toFixed(1), widen: +widen.toFixed(3), bytes: written.fileBytes.length };
  // Contact sheet: the packed file, looked at from the eye point in four directions.
  if (${sheet ? 'true' : 'false'}) {
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
    const scene = new THREE.Scene(), spark = new SparkRenderer({ renderer }); scene.add(spark);
    const mesh = new SplatMesh({ fileBytes: written.fileBytes.slice() }); await mesh.initialized; scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, .05, 500); camera.position.set(0, 1.5, 0); scene.add(camera);
    const shots = [];
    for (let v = 0; v < 4; v++) {
      camera.rotation.set(0, -v * Math.PI / 2, 0); camera.updateMatrixWorld(true);
      for (let f = 0; f < 14; f++) { renderer.render(scene, camera); await new Promise(r => setTimeout(r, 120)); }
      shots.push(document.getElementById('c').toDataURL('image/jpeg', .85));
    }
    window.__shots = shots;
  }
  window.__done = true;
} catch (e) { window.__error = String(e && e.stack || e); window.__done = true; }
</script>`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); page.on('pageerror', e => console.error('page error:', e.message));
  await page.route('**/__pack.html', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/__world.spz', r => r.fulfill({ contentType: 'application/octet-stream', body: readFileSync(input) }));
  await page.goto(ORIGIN + '/__pack.html');
  await page.waitForFunction(() => window.__done, null, { timeout: 600000 });
  const error = await page.evaluate(() => window.__error); if (error) throw new Error(error);
  const b64 = await page.evaluate(() => { const b = window.__bytes; let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); });
  writeFileSync(output, Buffer.from(b64, 'base64'));
  console.log(JSON.stringify(await page.evaluate(() => window.__info)));
  if (sheet) { const shots = await page.evaluate(() => window.__shots); shots.forEach((d, i) => writeFileSync(sheet.replace(/(\.\w+)$/, `-${i}$1`), Buffer.from(d.split(',')[1], 'base64'))); }
} finally { await browser.close(); }
