// Renders the hero portraits in public/tidebreak/art/portraits/ from the committed 3D hero models, so the menus, HUD
// and minimap show the same heroes as the 3D battlefield.
//   node qa/tidebreak/render-portraits.mjs            all sixteen heroes
//   node qa/tidebreak/render-portraits.mjs dredge     one or more slugs
//   SHEET=/tmp/portraits.png node qa/tidebreak/render-portraits.mjs   also saves a contact sheet to check by eye
// Each hero gets <slug>-bust.webp (512x512: head and shoulders on a dark warm backdrop, for cards, HUD and minimap) and
// <slug>-full.webp (768x1024: the whole hero on a clear background, feet at the bottom edge, for the hero select and
// the 2D battlefield). One studio for all: idle pose at a fixed frame, 3/4 view, warm key light from the upper left,
// cool rim light from behind on the right, a soft environment for the metal. Chromium draws with SwiftShader (software
// WebGL), so the same models and script give the same files. It serves public/ itself; no other server is needed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), root = path.join(repo, 'public');
const out = path.join(root, 'tidebreak/art/portraits');
const { HERO_IDENTITIES } = await import(path.join(root, 'tidebreak/hero-identities.js'));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : HERO_IDENTITIES.map(h => h.slug);
for (const slug of slugs) if (!HERO_IDENTITIES.some(h => h.slug === slug)) throw new Error(`Unknown hero slug: ${slug}`);

// The studio page. Every number here is part of the look; change them together and render all heroes again.
const STUDIO = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style>
<script type="importmap">{"imports":{"three":"/vr/lib/three.module.min.js"}}</script></head><body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from '/vr/lib/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/tidebreak/lib/meshopt_decoder.mjs';
import { retarget, skinnedMeshOf } from '/tidebreak/hero-rig.js';
const YAW = -0.42, IDLE_FRAME = 0.12, SUPER = 2;
const clips = await (await fetch('/tidebreak/models/clips.json')).json();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
gl.setPixelRatio(1); gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15;
gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.setClearColor(0x000000, 0);
// Reflections come from a small light room: a warm softbox up left, a cool strip behind on the right, a dark floor.
function studioEnvironment() {
  const room = new THREE.Scene(), panel = (w, h, color, power, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 1, 0); room.add(m); };
  room.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.BackSide })));
  panel(6, 5, 0xffd2a0, 5, -6, 7, 6); panel(2.2, 8, 0x9cc4ff, 4, 7, 3, -5); panel(3, 3, 0xe8b88a, 1.2, -7, 1, -3); panel(30, 30, 0x120d09, 1, 0, -6, 0);
  const pmrem = new THREE.PMREMGenerator(gl), map = pmrem.fromScene(room, 0.04).texture; pmrem.dispose(); return map;
}
const environment = studioEnvironment();
function stage() {
  const scene = new THREE.Scene(); scene.environment = environment; scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xffcf98, 3.8); key.position.set(-3.2, 4.4, 3.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  key.target.position.set(0, 1, 0); Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 0.5, far: 14 }); key.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0x9fc6ff, 5.2); rim.position.set(3.4, 2.6, -3.4);
  const kick = new THREE.DirectionalLight(0xffb27a, 0.9); kick.position.set(-3.5, 1.2, -2.5);
  const fill = new THREE.HemisphereLight(0x6f7d8c, 0x2b1d12, 0.55);
  scene.add(key, key.target, rim, kick, fill); return scene;
}
async function pose(slug) {
  const gltf = await loader.loadAsync('/tidebreak/models/heroes/' + slug + '.glb'), root = gltf.scene, body = skinnedMeshOf(root);
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), clip = retarget(clips.idle, body, 'idle'); mixer.clipAction(clip).play(); mixer.setTime(IDLE_FRAME * clip.duration);
  root.rotation.y = YAW; root.updateMatrixWorld(true);
  const bone = name => body.skeleton.bones.find(b => b.name === name)?.getWorldPosition(new THREE.Vector3());
  const bodyBox = new THREE.Box3().setFromObject(body, true), allBox = new THREE.Box3();
  root.traverse(o => { if (o.isMesh) allBox.union(new THREE.Box3().setFromObject(o, true)); });
  const head = bone('Head'), neck = bone('neck') || head, top = Math.max(bone('head_end')?.y ?? bodyBox.max.y, Math.min(bodyBox.max.y, head.y + 2.2 * (head.y - neck.y + 0.06)));
  return { root, head, neck, top, bodyBox, allBox };
}
// Draws the scene from straight ahead (the hero is turned instead), so the lights stay fixed in the picture.
function shot(scene, width, height, fov, centerX, centerY, halfHeight, lookDown = 0) {
  gl.setSize(width * SUPER, height * SUPER, false);
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 60), distance = halfHeight / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  camera.position.set(centerX, centerY + lookDown * distance, distance); camera.lookAt(centerX, centerY, 0);
  gl.render(scene, camera); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return { canvas, ctx: canvas.getContext('2d'), image: gl.domElement };
}
function bust(scene, p) {
  const h = Math.max(0.16, p.top - p.neck.y), frameTop = p.top + 0.3 * h, frameBottom = p.neck.y - 1.25 * h, half = (frameTop - frameBottom) / 2;
  const { canvas, ctx, image } = shot(scene, 512, 512, 24, p.head.x - 0.1 * h, (frameTop + frameBottom) / 2, half, 0.06);
  // Backdrop: umber light behind the head, darker toward the edges, a cool edge on the rim side.
  let g = ctx.createRadialGradient(205, 190, 20, 240, 250, 420); g.addColorStop(0, '#5a3f28'); g.addColorStop(.42, '#2e2117'); g.addColorStop(1, '#0c0907');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  g = ctx.createLinearGradient(512, 0, 300, 0); g.addColorStop(0, '#24313a88'); g.addColorStop(1, '#24313a00'); ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, 512, 512);
  g = ctx.createRadialGradient(256, 236, 150, 256, 256, 380); g.addColorStop(0, '#0000'); g.addColorStop(1, '#000a'); ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  return canvas.toDataURL('image/webp', 0.86);
}
function full(scene, p) {
  // Feet 1.5% above the bottom edge, head top at 9% from the top; tall weapons may run off the top. The minimap crops a
  // square from the top middle of this picture, so the head must stay there.
  const feet = p.bodyBox.min.y, span = Math.max(p.top - feet, 0.8) / (1 - 0.015 - 0.09);
  const { canvas, ctx, image } = shot(scene, 768, 1024, 16, (p.bodyBox.min.x + p.bodyBox.max.x) / 2 * 0.5 + p.head.x * 0.5, feet - 0.015 * span + span / 2, span / 2);
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, 768, 1024);
  return canvas.toDataURL('image/webp', 0.88);
}
window.renderHero = async slug => {
  const scene = stage(), p = await pose(slug); scene.add(p.root);
  const result = { bust: bust(scene, p), full: full(scene, p), height: +(p.top - p.bodyBox.min.y).toFixed(3), weaponTop: +(p.allBox.max.y - p.top).toFixed(3) };
  p.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of [o.material].flat()) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); } } });
  return result;
};
window.ready = true;
</script></body></html>`;

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/__studio.html') { res.setHeader('Content-Type', 'text/html'); res.end(STUDIO); return; }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/__studio.html`);
  await page.waitForFunction(() => window.ready || null, null, { timeout: 120000 });
  fs.mkdirSync(out, { recursive: true });
  const sheet = [];
  for (const slug of slugs) {
    const started = Date.now(), r = await page.evaluate(s => window.renderHero(s), slug);
    if (errors.length) throw new Error(errors.join('\n'));
    for (const kind of ['bust', 'full']) fs.writeFileSync(path.join(out, `${slug}-${kind}.webp`), Buffer.from(r[kind].split(',')[1], 'base64'));
    sheet.push(slug);
    console.log(`${slug}: height ${r.height} m, weapon above head ${Math.max(0, r.weaponTop)} m, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  // Provenance, written in roster order so a partial run leaves the file unchanged.
  fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify({
    note: 'Rendered by qa/tidebreak/render-portraits.mjs from public/tidebreak/models/heroes/<slug>.glb (idle clip from models/clips.json, retargeted by hero-rig.js). Run the script again after a model changes.',
    files: Object.fromEntries(HERO_IDENTITIES.map(h => [h.slug, { model: `../../models/heroes/${h.slug}.glb`, bust: `${h.slug}-bust.webp`, full: `${h.slug}-full.webp` }])),
  }, null, 2) + '\n');
  if (process.env.SHEET) {
    // A contact sheet of what was rendered: busts on top, full bodies below.
    const port = server.address().port, cells = sheet.map(s => `<figure><img src="/tidebreak/art/portraits/${s}-bust.webp"><img src="/tidebreak/art/portraits/${s}-full.webp"><figcaption>${s}</figcaption></figure>`).join('');
    const view = await browser.newPage({ viewport: { width: 1600, height: 400 } });
    await view.goto(`http://127.0.0.1:${port}/__studio.html`); await view.setContent(`<base href="http://127.0.0.1:${port}/"><style>body{margin:0;background:#3a4048;display:flex;flex-wrap:wrap;gap:6px;padding:6px;font:12px sans-serif;color:#eee}figure{margin:0;width:192px}img{display:block;width:192px}img+img{background:#5b6470}</style>${cells}`);
    await view.waitForFunction(() => [...document.images].every(i => i.complete));
    await view.screenshot({ path: process.env.SHEET, fullPage: true });
  }
} finally { await browser.close(); server.close(); }
