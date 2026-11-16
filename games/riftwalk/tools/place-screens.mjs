// Places the arcade screens of Riftwalk's hall in 3D.
// find-screens.py gives each screen's four corners as compass angles in the panorama. The panorama was made from the
// hall's capture point, so each angle is a ray from that point. A screen is a rectangle, so its tilt follows from the
// four corner rays alone. This tool reads the hall's splats (with Spark, in headless Chromium) for one thing: how far
// away the screen is. It then cuts the screen's plane with the four corner rays. The result is four corners for each
// cabinet, in the hall's own space: metres, floor at y = 0, the capture point at (0, ground, 0).
// Usage: node games/riftwalk/tools/place-screens.mjs <hall.spz> <corners.json> <screens.json> <scale> <ground> [check.jpg]
// scale and ground are Marble's metric_scale_factor and ground_plane_offset. check.jpg, when given, is a picture of the
// hall from the capture point in four directions, with a green frame drawn on every screen that was placed.
// Needs the static server (see AGENTS.md) and Playwright.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const require = createRequire(new URL('../../../qa/browser/x.mjs', import.meta.url));
const { chromium } = require('playwright');
const [spz, cornersPath, outPath, scaleArg, groundArg, check] = process.argv.slice(2);
if (!spz || !cornersPath || !outPath || !scaleArg || !groundArg) { console.error('usage: node place-screens.mjs <hall.spz> <corners.json> <screens.json> <scale> <ground> [check.jpg]'); process.exit(1); }
const ORIGIN = process.env.SITE_URL || 'http://127.0.0.1:8765', corners = JSON.parse(readFileSync(cornersPath, 'utf8'));
const html = `<!doctype html><script type="importmap">{"imports":{"three":"/vr/lib/three.module.min.js","three/addons/postprocessing/Pass.js":"/lab/riftwalk/lib/Pass.js","@sparkjsdev/spark":"/lab/riftwalk/lib/spark.module.min.js"}}</script>
<canvas id="c" width="960" height="540"></canvas><script type="module">
import * as THREE from 'three'; import { PackedSplats, SplatMesh, SparkRenderer } from '@sparkjsdev/spark';
try {
  const SCALE = ${+scaleArg}, GROUND = ${+groundArg}, input = ${JSON.stringify(corners.screens)};
  const bytes = new Uint8Array(await (await fetch('/__hall.spz')).arrayBuffer());
  const packed = new PackedSplats({ fileBytes: bytes.slice() }); await packed.initialized;
  // Every solid splat as a unit direction from the capture point and a distance, in the hall's space. A Marble file
  // has y down, so y and z change sign.
  const n = packed.numSplats, dx = new Float32Array(n), dy = new Float32Array(n), dz = new Float32Array(n), dist = new Float32Array(n); let m = 0;
  packed.forEachSplat((i, c, s, q, o) => { if (o < 0.3) return; const x = c.x, y = -c.y, z = -c.z, l = Math.hypot(x, y, z); if (l < 1e-6) return; dx[m] = x / l; dy[m] = y / l; dz[m] = z / l; dist[m] = l * SCALE; m++; });
  const ray = (lon, lat) => [Math.sin(lon) * Math.cos(lat), Math.sin(lat), -Math.cos(lon) * Math.cos(lat)];
  // The distance to the surface along a ray: just under the middle of the solid splats within a narrow cone.
  function depth(d) {
    for (const cone of [0.5, 1, 2, 3.5]) {   // a plain bright screen is a few large splats, so the cone may need to widen
      const limit = Math.cos(cone * Math.PI / 180), found = [];
      for (let i = 0; i < m; i++) if (dx[i] * d[0] + dy[i] * d[1] + dz[i] * d[2] > limit) found.push(dist[i]);
      if (found.length >= 6) { found.sort((a, b) => a - b); return found[Math.floor(found.length * 0.4)]; }
    }
    return null;
  }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = a => Math.hypot(...a), unit = a => mul(a, 1 / (len(a) || 1));
  const eye = [0, GROUND, 0], screens = [], dropped = [];
  input.forEach((screen, index) => {
    const rays = screen.corners.map(([lon, lat]) => ray(lon, lat)), mid = unit(rays.reduce(add));
    // The visitor stands at, or within a step of, the capture point. From there a portal whose four corners lie on the
    // four corner rays covers the screen exactly, whatever the screen's tilt. So the corners of the portal are the
    // corner rays cut by one plane. The plane's tilt comes from the corner rays alone: a screen is a rectangle, so the
    // plane through the eye and its top edge and the plane through the eye and its bottom edge meet in a line that
    // runs along its width, and the same for its sides and its height. When the corners do not make a good rectangle,
    // the plane just faces the capture point. The splats give one thing only: how far away the screen is.
    const [rtl, rtr, rbr, rbl] = rays;
    let along = unit(cross(cross(rtl, rtr), cross(rbl, rbr))), upward = unit(cross(cross(rtl, rbl), cross(rtr, rbr)));
    if (dot(along, sub(rtr, rtl)) < 0) along = mul(along, -1); if (dot(upward, sub(rtl, rbl)) < 0) upward = mul(upward, -1);
    const square = Math.abs(dot(along, upward)); let nrm = unit(cross(along, sub(upward, mul(along, dot(upward, along))))); if (dot(nrm, mid) > 0) nrm = mul(nrm, -1);
    if (!(square < 0.2) || -dot(nrm, mid) < 0.55) nrm = mul(mid, -1);
    const inside = [mid, ...rays.map(r => unit(add(r, mid))), ...rays.map(r => unit(add(r, mul(mid, 3))))];
    const offsets = inside.map(d => { const t = depth(d); return t === null ? null : -dot(mul(d, t), nrm); }).filter(v => v !== null && v > 0).sort((a, b) => a - b);
    if (offsets.length < 4) { dropped.push({ index, why: 'too few splats on it' }); return; }
    const offset = offsets[Math.floor(offsets.length * 0.4)], spread = offsets[Math.floor(offsets.length * 0.75)] - offsets[Math.floor(offsets.length * 0.25)];
    const quad = rays.map(d => mul(d, -offset / dot(d, nrm)));
    const [tl, tr, br, bl] = quad, right = unit(add(sub(tr, tl), sub(br, bl))), upRaw = add(sub(tl, bl), sub(tr, br)), up = unit(sub(upRaw, mul(right, dot(upRaw, right))));
    nrm = unit(cross(right, up));
    const w = (len(sub(tr, tl)) + len(sub(br, bl))) / 2, h = (dot(sub(tl, bl), up) + dot(sub(tr, br), up)) / 2, centre = mul(quad.reduce(add), 0.25);
    if (!(w > 0.12 && w < 2.2 && h > 0.1 && h < 2.2) || square > 0.35) { dropped.push({ index, why: 'not a rectangle', w: +w.toFixed(2), h: +h.toFixed(2), square: +square.toFixed(3) }); return; }
    const at = add(eye, centre), corners4 = quad.map(q => add(eye, q).map(v => +v.toFixed(4)));
    screens.push({ corners: corners4, centre: at.map(v => +v.toFixed(4)), right: right.map(v => +v.toFixed(5)), up: up.map(v => +v.toFixed(5)), normal: nrm.map(v => +v.toFixed(5)), width: +w.toFixed(4), height: +h.toFixed(4), heading: +Math.atan2(centre[0], -centre[2]).toFixed(5), distance: +len(centre).toFixed(3), square: +square.toFixed(3), spread: +spread.toFixed(3) });
  });
  screens.sort((a, b) => a.heading - b.heading);
  window.__out = { screens, dropped, splats: n };
  if (${check ? 'true' : 'false'}) {
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
    const scene = new THREE.Scene(); scene.add(new SparkRenderer({ renderer }));
    const mesh = new SplatMesh({ fileBytes: bytes }); await mesh.initialized; mesh.quaternion.set(1, 0, 0, 0); mesh.scale.setScalar(SCALE); mesh.position.set(0, GROUND, 0); scene.add(mesh);
    for (const s of screens) {
      const pts = s.corners.map(c => new THREE.Vector3(...c));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x00ff66, depthTest: false, transparent: true })); line.renderOrder = 30; scene.add(line);
    }
    const camera = new THREE.PerspectiveCamera(92, 16 / 9, .02, 500); camera.position.set(0, GROUND, 0); scene.add(camera); const shots = [];
    for (let v = 0; v < 4; v++) { camera.rotation.set(0, -v * Math.PI / 2, 0); camera.updateMatrixWorld(true); for (let f = 0; f < 6; f++) { renderer.render(scene, camera); await new Promise(r => setTimeout(r, 200)); } shots.push(document.getElementById('c').toDataURL('image/jpeg', .88)); }
    window.__shots = shots;
  }
} catch (e) { window.__error = String(e && e.stack || e); }
window.__done = true;
</script>`;
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); page.on('pageerror', e => console.error('page error:', e.message));
  await page.route('**/__place.html', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/__hall.spz', r => r.fulfill({ contentType: 'application/octet-stream', body: readFileSync(spz) }));
  await page.goto(ORIGIN + '/__place.html'); await page.waitForFunction(() => window.__done, null, { timeout: 900000 });
  const error = await page.evaluate(() => window.__error); if (error) throw new Error(error);
  const out = await page.evaluate(() => window.__out);
  writeFileSync(outPath, JSON.stringify({ note: 'The arcade screens of the hall, placed by games/riftwalk/tools/place-screens.mjs. Metres; floor at y = 0; sorted by compass heading from the capture point. hall holds Marble\'s metric_scale_factor (scale) and ground_plane_offset (ground) for the world.', hall: { scale: +scaleArg, ground: +groundArg }, screens: out.screens }, null, 1));
  console.log(`${out.screens.length} screens placed, ${out.dropped.length} dropped`, JSON.stringify(out.dropped));
  if (check) (await page.evaluate(() => window.__shots)).forEach((d, i) => writeFileSync(check.replace(/(\.\w+)$/, `-${i}$1`), Buffer.from(d.split(',')[1], 'base64')));
} finally { await browser.close(); }
