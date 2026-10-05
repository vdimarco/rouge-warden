// Procedural textures for the 3D battlefield, made once at start: tiling ground materials (colour in RGB, height in
// alpha for bump and height blending), a macro noise for large patches, and soft sprites for glows, smoke and sparks.
// Nothing here is a painted 2D sprite, so the ground takes the real light.
import * as THREE from 'three';

const random = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// Tiling value noise: a lattice of period `cells` that wraps, so every octave tiles the texture seamlessly.
function lattice(cells, rand) { const v = new Float32Array(cells * cells); for (let i = 0; i < v.length; i++) v[i] = rand(); return v; }
function fbm(size, octaves, seed, base = 4, gain = .55) {
  const rand = random(seed), out = new Float32Array(size * size); let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o, grid = lattice(cells, rand), step = cells / size;
    for (let y = 0; y < size; y++) {
      const gy = y * step, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy), r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = x * step, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx), c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const a = grid[r0 + c0] + (grid[r0 + c1] - grid[r0 + c0]) * sx, b = grid[r1 + c0] + (grid[r1 + c1] - grid[r1 + c0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const ramp = (stops, t) => { t = Math.max(0, Math.min(.9999, t)) * (stops.length - 1); const i = Math.floor(t), f = t - i, a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
// Draws wrapped copies so a mark that crosses an edge continues on the opposite side.
function wrapped(size, draw) { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy); }
function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
// Builds an RGBA DataTexture: colour from a painter on a canvas, height from a second painter in the alpha channel.
function material(size, paintColor, paintHeight) {
  const color = canvas(size), height = canvas(size), cc = color.getContext('2d'), hc = height.getContext('2d');
  paintColor(cc); paintHeight(hc);
  const c = cc.getImageData(0, 0, size, size).data, h = hc.getImageData(0, 0, size, size).data, data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = c[i]; data[i + 1] = c[i + 1]; data[i + 2] = c[i + 2]; data[i + 3] = h[i]; }
  const t = new THREE.DataTexture(data, size, size); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function noiseFill(ctx, size, stops, seed, { octaves = 6, base = 4, detail = .25, detailSeed = seed + 7 } = {}) {
  const n = fbm(size, octaves, seed, base), d = fbm(size, 3, detailSeed, 64), img = ctx.createImageData(size, size), s = stops.map(hex);
  for (let i = 0; i < n.length; i++) { const [r, g, b] = ramp(s, n[i] * (1 - detail) + d[i] * detail); img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return n;
}
function grayFill(ctx, size, values, scale = 1, offset = 0) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < values.length; i++) { const v = Math.max(0, Math.min(255, (values[i] * scale + offset) * 255)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
// Grass: olive and moss greens with straw tips; many short blades give the surface a grain the sun can catch.
function grass(size, seed, stops, bladeTones) {
  let base;
  return material(size, c => {
    base = noiseFill(c, size, stops, seed, { base: 3, detail: .35 });
    const rand = random(seed + 11);
    for (let i = 0; i < size * size / 9; i++) {
      const x = rand() * size, y = rand() * size, a = -Math.PI / 2 + (rand() - .5) * 1.4, l = 2 + rand() * 5;
      c.strokeStyle = bladeTones[Math.floor(rand() * bladeTones.length)]; c.globalAlpha = .25 + rand() * .35; c.lineWidth = .7 + rand() * .8;
      wrapped(size, (dx, dy) => { if (x + dx < -8 || x + dx > size + 8 || y + dy < -8 || y + dy > size + 8) return; c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); c.stroke(); });
    }
    c.globalAlpha = 1;
  }, h => {
    grayFill(h, size, base, .55, .15); const rand = random(seed + 11);
    for (let i = 0; i < size * size / 9; i++) {
      const x = rand() * size, y = rand() * size, a = -Math.PI / 2 + (rand() - .5) * 1.4, l = 2 + rand() * 5; rand(); const alpha = .25 + rand() * .35, w = .7 + rand() * .8;
      h.strokeStyle = '#fff'; h.globalAlpha = alpha * .5; h.lineWidth = w;
      wrapped(size, (dx, dy) => { if (x + dx < -8 || x + dx > size + 8 || y + dy < -8 || y + dy > size + 8) return; h.beginPath(); h.moveTo(x + dx, y + dy); h.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); h.stroke(); });
    }
    h.globalAlpha = 1;
  });
}
// Scattered pebbles with a dark contact edge, used on dirt, sand and the river bed.
function pebbles(c, h, size, seed, count, tones, min = 1.5, max = 5) {
  const rand = random(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size, rx = min + rand() * (max - min), ry = rx * (.55 + rand() * .4), a = rand() * Math.PI, tone = tones[Math.floor(rand() * tones.length)];
    wrapped(size, (dx, dy) => {
      if (x + dx < -12 || x + dx > size + 12 || y + dy < -12 || y + dy > size + 12) return;
      if (c) { c.fillStyle = 'rgba(30,22,14,.45)'; c.beginPath(); c.ellipse(x + dx + .8, y + dy + 1, rx, ry, a, 0, Math.PI * 2); c.fill(); c.fillStyle = tone; c.beginPath(); c.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,240,210,.18)'; c.beginPath(); c.ellipse(x + dx - rx * .25, y + dy - ry * .3, rx * .45, ry * .35, a, 0, Math.PI * 2); c.fill(); }
      if (h) { const g = h.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rx); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); h.fillStyle = g; h.beginPath(); h.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2); h.fill(); }
    });
  }
}
function dirt(size, seed) {
  let base;
  return material(size, c => {
    base = noiseFill(c, size, ['#3f2f1e', '#5a4429', '#6e5434', '#7f6440', '#8d7552'], seed, { base: 4, detail: .4 });
    // Wheel ruts and foot-worn streaks run along the texture's x axis.
    const rand = random(seed + 3); c.globalAlpha = .12;
    for (let i = 0; i < 40; i++) { const y = rand() * size, w = 2 + rand() * 6; c.fillStyle = rand() < .5 ? '#2c2014' : '#a48c66'; wrapped(size, (dx, dy) => c.fillRect(dx, y + dy, size, w)); }
    c.globalAlpha = 1; pebbles(c, null, size, seed + 5, 420, ['#8a7c66', '#9a8f7c', '#6f6250', '#a69a86'], 1.2, 4.2);
  }, h => { grayFill(h, size, base, .5, .1); pebbles(null, h, size, seed + 5, 420, [], 1.2, 4.2); });
}
function sand(size, seed) {
  let base;
  return material(size, c => {
    base = noiseFill(c, size, ['#8d7a58', '#a38d66', '#b6a07a', '#c4b089'], seed, { base: 5, detail: .55 });
    pebbles(c, null, size, seed + 9, 160, ['#7d7466', '#958b7a', '#6c6a60', '#b3a690'], 1, 3.2);
  }, h => { grayFill(h, size, base, .35, .2); pebbles(null, h, size, seed + 9, 160, [], 1, 3.2); });
}
// Flagstones from a jittered grid of cells: weathered slabs, dark joints with moss in them.
function stone(size, seed) {
  const rand = random(seed), cells = 7, pts = [];
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) pts.push({ x: (x + .2 + rand() * .6) / cells * size, y: (y + .2 + rand() * .6) / cells * size, tone: rand(), moss: rand() });
  const n = fbm(size, 5, seed + 1, 8), id = new Int16Array(size * size), edge = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let d1 = 1e9, d2 = 1e9, k = 0;
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(x - pts[i].x), dy = Math.abs(y - pts[i].y); dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy);
      const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
    }
    id[y * size + x] = k; edge[y * size + x] = Math.sqrt(d2) - Math.sqrt(d1);
  }
  const slab = ['#6f6a5c', '#7e7866', '#8b8572', '#958e7a', '#a39b86'].map(hex), joint = hex('#2e2b23'), moss = hex('#4b5527');
  return material(size, c => {
    const img = c.createImageData(size, size);
    for (let i = 0; i < id.length; i++) {
      const p = pts[id[i]], e = Math.min(1, edge[i] / 7), wear = n[i];
      let col = ramp(slab, p.tone * .7 + wear * .3); const shade = .82 + wear * .3; col = col.map(v => v * shade);
      if (e < 1) { const m = p.moss > .45 ? moss : joint, k = 1 - e; col = col.map((v, j) => v + (m[j] - v) * k * k); }
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, h => {
    const img = h.createImageData(size, size);
    for (let i = 0; i < id.length; i++) { const e = Math.min(1, edge[i] / 6), v = (.35 + .45 * Math.sqrt(e) + n[i] * .2) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    h.putImageData(img, 0, 0);
  });
}
// Four tiling ground materials plus dry meadow and woods moss, in the order the ground shader samples them.
export function groundTextures() {
  const size = 512;
  return {
    grass: grass(size, 11, ['#2f3a1b', '#3f4b22', '#4f5a2a', '#626a33', '#7a7a3f'], ['#8b8a4a', '#2a3416', '#6f7b3a', '#a49a5a']),
    dry: grass(size, 23, ['#4f4626', '#665a32', '#7c6c3e', '#937e4a', '#a58e57'], ['#b8a46a', '#4a4024', '#8a7a48']),
    moss: grass(size, 37, ['#1f2a17', '#2b3a1f', '#38482a', '#475532', '#5a6440'], ['#6c7a4a', '#18220f', '#4e6234']),
    dirt: dirt(size, 41), stone: stone(size, 53), sand: sand(size, 67),
  };
}
// Large soft patches (R and G are independent noises), sampled at a low frequency to break up tiling.
export function macroTexture() {
  const size = 256, a = fbm(size, 5, 101, 3), b = fbm(size, 5, 202, 5), data = new Uint8Array(size * size * 4);
  for (let i = 0; i < a.length; i++) { data[i * 4] = a[i] * 255; data[i * 4 + 1] = b[i] * 255; data[i * 4 + 2] = 0; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// Soft round sprite: white with a falloff, tinted by the material.
export function glowTexture(size = 128, hardness = 2.2) {
  const c = canvas(size), g = c.getContext('2d'), grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 8; i++) { const t = i / 8; grad.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, hardness).toFixed(3)})`); }
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A lumpy smoke puff for dust and tower smoke.
export function smokeTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), rand = random(7);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = rand() * size * .22, x = size / 2 + Math.cos(a) * r, y = size / 2 + Math.sin(a) * r, s = size * (.12 + rand() * .16);
    const grad = g.createRadialGradient(x, y, 0, x, y, s); grad.addColorStop(0, 'rgba(255,255,255,.22)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
