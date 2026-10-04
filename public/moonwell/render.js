// Moonwell: drawing. The sky and the moon, the painted islands far behind, the islands of the run, their features,
// the flippers and the pearl, then particles and score popups. The camera is a world point at the screen centre and
// a scale in CSS pixels per world unit. Nothing here changes the run.
import { BALL_R as R, BIOMES, REGION, near, station, pathAt } from './world.js';

const sheet = new Image();
sheet.src = './assets/sprites.webp';
const far = new Image();
far.src = './assets/far-islands.webp';
export const art = { sheet, far };
const SPR = { bumper: [0, 0, 256, 256], portal: [256, 0, 256, 256], star: [512, 0, 256, 256], pearl: [768, 0, 256, 256], flipper: [0, 256, 320, 215], ball: [320, 256, 128, 128] };
// the flipper sprite: the centre of its pivot cap, and the angle and length of its top face, in sheet pixels
const FLIPPER = { px: 62.5, py: 38.7, angle: 0.4417, len: 243 };
const ready = (img) => img.complete && img.naturalWidth > 0;
const TAU = Math.PI * 2;

// a stone texture in world units, made once
let rockPattern = null;
function stonePattern(ctx) {
  if (rockPattern) return rockPattern;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let y = 0;
  while (y < 160) {
    const rh = 16 + rnd() * 14;
    let x = -rnd() * 30;
    while (x < 160) {
      const w = 22 + rnd() * 34;
      g.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.05})`;
      g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, rh - 4, 6 + rnd() * 4); g.fill();
      g.strokeStyle = 'rgba(10,8,20,0.17)'; g.lineWidth = 1.6; g.stroke();
      if (rnd() < 0.15) { g.fillStyle = 'rgba(120,170,90,0.2)'; g.beginPath(); g.ellipse(x + rnd() * w, y + 3, 7, 3, 0, 0, TAU); g.fill(); }
      x += w;
    }
    y += rh;
  }
  rockPattern = ctx.createPattern(c, 'repeat');
  return rockPattern;
}

// soft glows, drawn once per colour and then stamped: far cheaper than a gradient per object per frame
const glows = new Map();
function glowSprite(rgb) {
  let c = glows.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.45)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glows.set(rgb, c);
  return c;
}
function glow(ctx, x, y, r, rgb, alpha) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// stars of the night sky, in a tile that wraps
const SKY = Array.from({ length: 180 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 12345.678, c = Math.sin(i * 74.7) * 9876.54;
  return { x: (a - Math.floor(a)) * 2400, y: (b - Math.floor(b)) * 900, r: 0.5 + (c - Math.floor(c)) * 1.4, p: c };
});

const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// The biome at the camera, blended over the last island of a region
function skyAt(run, x) {
  const list = run.world.list;
  let s = list[0];
  for (const st of list) if (st.x0 <= x) s = st;
  const nextB = BIOMES[(Math.floor(s.k / REGION) + 1) % BIOMES.length];
  const t = s.k % REGION === REGION - 1 ? Math.max(0, Math.min(1, (x - s.x0) / (s.x1 - s.x0))) : 0;
  return { a: s.biome, b: nextB, t };
}

export function draw(ctx, view, run, fx, now) {
  const { w, h, dpr, cam } = view;
  const S = cam.scale;
  const left = cam.x - w / 2 / S, right = cam.x + w / 2 / S, top = cam.y - h / 2 / S, bottom = cam.y + h / 2 / S;
  const sky = skyAt(run, cam.x);
  const B = sky.a;
  const moon = run.moonrise > 0 ? Math.min(1, run.moonrise, (12 - run.moonrise) * 2) : 0;

  // the sky, in screen space
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(B.sky[0], sky.b.sky[0], sky.t));
  g.addColorStop(1, mix(B.sky[1], sky.b.sky[1], sky.t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (moon) {
    ctx.globalAlpha = 0.35 * moon;
    const mg = ctx.createRadialGradient(w * 0.78, h * 0.12, 10, w * 0.78, h * 0.12, Math.max(w, h) * 0.8);
    mg.addColorStop(0, '#ffe7a8'); mg.addColorStop(1, 'rgba(255,231,168,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  // twinkling stars, barely moving with the camera
  // the far layers move with the camera's height over the bowl, not with the world's height, which grows as the
  // islands step down; the stars drift up slowly as the pearl descends
  const rel = cam.y - (cam.bottom ?? cam.y) + 150;
  const sx = cam.x * 0.03 * S, sy = cam.y * 0.02 * S;
  ctx.fillStyle = '#fff6dc';
  for (const st of SKY) {
    const x = (((st.x - sx) % 2400) + 2400) % 2400 * (w / 1600), y = ((st.y - sy) % 900 + 900) % 900 * (h / 900) * 0.75;
    if (x > w) continue;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now * 0.0015 + st.p * 7);
    ctx.fillRect(x, y, st.r, st.r);
  }
  ctx.globalAlpha = 1;
  drawMoon(ctx, w, h, run, now, moon);

  // the painting of the islands, far away and misted
  if (ready(far)) {
    const tile = farTile(Math.round(Math.min(h * 0.46, 420))), iw = tile.width, ih = tile.height;
    const px = -((cam.x * 0.1 * S) % iw), py = h * 0.5 - (rel * 0.05 * S) - ih * 0.15;
    for (let x = px - iw; x < w; x += iw) ctx.drawImage(tile, x, py);
    const fog = ctx.createLinearGradient(0, py, 0, py + ih);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, mix(B.sky[1], sky.b.sky[1], sky.t));
    ctx.fillStyle = fog;
    ctx.fillRect(0, py, w, ih + 2);
    ctx.fillStyle = mix(B.sky[1], sky.b.sky[1], sky.t);
    ctx.fillRect(0, py + ih, w, h);
  }
  hills(ctx, w, h, { ...cam, y: rel }, S, mix(B.haze, sky.b.haze, sky.t), mix(B.sky[1], sky.b.sky[1], sky.t));

  // the world
  ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * (w / 2 - cam.x * S), dpr * (h / 2 - cam.y * S));
  const shown = near(run.world, left - 200, right + 200);
  for (const s of shown) beams(ctx, s, run, now, top);
  for (const s of shown) land(ctx, s, run, now, bottom);
  for (const s of shown) features(ctx, s, run, now);
  for (const s of shown) if (s.rail) rail(ctx, s.rail, now);
  bestFlag(ctx, run, now);
  for (const s of shown) flippers(ctx, s, run, now);
  if (run.phase === 'ready') moonbeam(ctx, run, top, now);
  pearl(ctx, run, fx, now);
  particles(ctx, fx, S);

  // a soft vignette keeps the eye on the middle
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(vignette(w, h), 0, 0, w, h);

  // the pearl above the top of the screen: an arrow and its height
  const b = run.ball;
  if (b.mode !== 'gone' && b.y < top - R) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = Math.max(24, Math.min(w - 24, (b.x - cam.x) * S + w / 2));
    ctx.fillStyle = '#ffeec2';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x - 9, 80); ctx.lineTo(x + 9, 80); ctx.closePath(); ctx.fill();
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round((top - b.y) / 10) + ' m', x, 96);
    ctx.globalAlpha = 1;
  }
}

// the far painting, scaled and faded once per screen height, so each frame copies it without scaling
let farCache = null;
function farTile(ih) {
  if (farCache && farCache.height === ih) return farCache;
  const c = document.createElement('canvas');
  c.height = ih;
  c.width = Math.round((far.naturalWidth / far.naturalHeight) * ih);
  const g = c.getContext('2d');
  g.globalAlpha = 0.42;
  g.drawImage(far, 0, 0, c.width, c.height);
  farCache = c;
  return c;
}

let vig = null;
function vignette(w, h) {
  if (vig && vig.key === w + 'x' + h) return vig.c;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w / 4); c.height = Math.ceil(h / 4);
  const g = c.getContext('2d'), v = g.createRadialGradient(c.width / 2, c.height * 0.55, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height * 0.55, Math.max(c.width, c.height) * 0.75);
  v.addColorStop(0, 'rgba(3,6,18,0)');
  v.addColorStop(1, 'rgba(3,6,18,0.45)');
  g.fillStyle = v;
  g.fillRect(0, 0, c.width, c.height);
  vig = { key: w + 'x' + h, c };
  return c;
}

function drawMoon(ctx, w, h, run, now, moon) {
  // the moon in the sky shows the moon meter: a thin crescent grows to a full moon
  const x = w * 0.8, y = Math.min(h * 0.17, 140), r = Math.min(w, h) * 0.055 + 12 + moon * 10;
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (3 + moon * 2));
  glow.addColorStop(0, `rgba(255,236,190,${0.25 + 0.35 * moon})`);
  glow.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * (3 + moon * 2), 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a2142';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const f = Math.max(0.06, run.meter);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#fff1c9';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // the shadow slides off as the meter fills
  ctx.fillStyle = '#1a2142';
  ctx.beginPath(); ctx.arc(x - r * 2 * f, y - r * 0.08, r * 1.02, 0, TAU); ctx.fill();
  ctx.restore();
}

function hills(ctx, w, h, cam, S, haze, base) {
  ctx.fillStyle = haze;
  ctx.globalAlpha = 0.55;
  const off = cam.x * 0.3, y0 = h * 0.72 - cam.y * 0.12 * S;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 24; x += 24) {
    const u = x / S + off;
    ctx.lineTo(x, y0 - (Math.sin(u * 0.004) * 40 + Math.sin(u * 0.011 + 2) * 22 + Math.sin(u * 0.023) * 9) * S * 1.4);
  }
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.globalAlpha = 1;
  // pine silhouettes on the hills
  ctx.fillStyle = base;
  ctx.globalAlpha = 0.45;
  const step = 70;
  for (let u = Math.floor(off / step) * step; (u - off) * S < w + 40; u += step) {
    const n = Math.sin(u * 12.9898) * 43758.5453, f = n - Math.floor(n);
    if (f < 0.45) continue;
    const x = (u - off) * S, y = y0 - (Math.sin(u * 0.004) * 40 + Math.sin(u * 0.011 + 2) * 22 + Math.sin(u * 0.023) * 9) * S * 1.4;
    const t = (24 + f * 30) * S;
    ctx.beginPath(); ctx.moveTo(x, y - t); ctx.lineTo(x - t * 0.28, y + 2); ctx.lineTo(x + t * 0.28, y + 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// the moon gate: a column of moonlight on a ridge behind the pearl, and the sealed gate of a shrine
function beams(ctx, s, run, now, top) {
  const col = (x, y, alpha, color) => {
    const g = ctx.createLinearGradient(0, y, 0, Math.max(top, y - 900));
    g.addColorStop(0, color.replace('A', alpha));
    g.addColorStop(1, color.replace('A', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, Math.max(top, y - 900), 20, y - Math.max(top, y - 900));
  };
  if (s.gate && s.k > 0) col(s.x0, s.y0 - 6, 0.22 + 0.06 * Math.sin(now * 0.004 + s.k), 'rgba(190,220,255,A)');
  if (s.sealed) {
    col(s.x1, s.y1 - 6, 0.55 + 0.15 * Math.sin(now * 0.006), 'rgba(255,214,140,A)');
    ctx.fillStyle = '#ffe2a8';
    for (let i = 0; i < 9; i++) {
      const y = s.y1 - 40 - ((now * 0.06 + i * 70) % 640);
      ctx.globalAlpha = 0.6 * (1 - (s.y1 - y) / 700);
      ctx.fillRect(s.x1 - 3, y, 6, 6);
    }
    ctx.globalAlpha = 1;
  }
}

// screenBottom: the world y of the bottom edge of the screen. The rock and the water reach past it, whatever the
// camera does, so no background shows under an island.
function land(ctx, s, run, now, screenBottom) {
  const B = s.biome;
  const deep = Math.max(s.deep, screenBottom + 20);
  const rock = ctx.createLinearGradient(0, Math.min(s.y0, s.y1), 0, s.deep);
  rock.addColorStop(0, B.rock);
  rock.addColorStop(0.55, mix(B.rock, B.rockDark, 0.6));
  rock.addColorStop(1, B.rockDark);
  gapWater(ctx, s, now, deep);
  // each bowl draws the near side of its two islands; the halves meet under the ridges
  const halves = [
    [...s.left, [s.cx - s.P - 4, s.fy + 12], s.cliffL[1], [s.cliffL[1][0], deep], [s.x0 - 1, deep], [s.x0 - 1, s.y0]],
    [[s.cx + s.P + 4, s.fy + 12], ...s.right, [s.x1 + 1, s.y1], [s.x1 + 1, deep], [s.cliffR[1][0], deep], s.cliffR[1]],
  ];
  for (const pts of halves) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = rock;
    ctx.fill();
    ctx.fillStyle = stonePattern(ctx);
    ctx.fill();
  }
  // a dark lip under the grass, then the grass and a moonlit rim
  const grassLine = (pts, width, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  };
  const lslope = s.left.slice(0, -1), rslope = s.right.slice(1);
  for (const pts of [lslope, rslope]) {
    grassLine(pts.map(([x, y]) => [x, y + 8]), 16, B.grassDark);
    grassLine(pts.map(([x, y]) => [x, y + 2]), 9, B.grass);
    grassLine(pts.map(([x, y]) => [x, y - 2]), 2, 'rgba(255,248,214,0.45)');
  }
  // the inlanes: gold-trimmed stone guides onto the flippers
  for (const [a, b] of [[s.left[s.left.length - 2], s.left[s.left.length - 1]], [s.right[1], s.right[0]]]) {
    grassLine([[a[0], a[1] + 6], [b[0], b[1] + 6]], 13, B.rockDark);
    grassLine([a, b], 4, '#d9b25f');
    grassLine([[a[0], a[1] - 1.5], [b[0], b[1] - 1.5]], 1.2, '#fff0bf');
  }
  // decorations stand on the slopes
  for (const d of s.deco) deco(ctx, d, B, now);
  // the crest: a little stone post with a lamp
  ctx.fillStyle = B.rockDark;
  ctx.beginPath(); ctx.roundRect(s.x1 - 6, s.y1 - 26, 12, 30, 3); ctx.fill();
  ctx.fillStyle = B.accent;
  ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now * 0.005 + s.k);
  ctx.beginPath(); ctx.arc(s.x1, s.y1 - 30, 5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  glow(ctx, s.x1, s.y1 - 30, 22, '255,226,160', 0.35);
  // waterfalls down the cliffs of the gap
  ctx.strokeStyle = 'rgba(190,235,255,0.32)';
  ctx.lineWidth = 7;
  ctx.setLineDash([20, 12]);
  ctx.lineDashOffset = -now * 0.12;
  for (const side of [-1, 1]) {
    const x = s.cx + side * (s.P + 6);
    ctx.beginPath(); ctx.moveTo(x, s.fy + 18); ctx.lineTo(x + side * 16, s.fy + POOL); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const p of s.posts) {
    ctx.fillStyle = '#e8c372';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 + Math.sin(now * 0.006) * 2, 0, TAU); ctx.fill();
  }
}

// The water in a gap: a dark drop under the flippers, then a pool with a moonlit surface and mist
export const POOL = 190;
function gapWater(ctx, s, now, deep) {
  const x0 = s.cx - s.P - 70, x1 = s.cx + s.P + 70, wy = s.fy + POOL;
  const drop = ctx.createLinearGradient(0, s.fy, 0, wy);
  drop.addColorStop(0, 'rgba(6,12,30,0.25)');
  drop.addColorStop(1, 'rgba(6,12,30,0.85)');
  ctx.fillStyle = drop;
  ctx.fillRect(x0, s.fy, x1 - x0, wy - s.fy);
  const g = ctx.createLinearGradient(0, wy, 0, wy + 160);
  g.addColorStop(0, s.biome.water);
  g.addColorStop(1, '#050b1c');
  ctx.fillStyle = g;
  ctx.fillRect(x0, wy, x1 - x0, deep - wy);
  const mist = ctx.createLinearGradient(0, wy - 50, 0, wy);
  mist.addColorStop(0, 'rgba(200,230,255,0)');
  mist.addColorStop(1, 'rgba(200,230,255,0.22)');
  ctx.fillStyle = mist;
  ctx.fillRect(x0, wy - 50, x1 - x0, 50);
  ctx.strokeStyle = 'rgba(225,245,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, wy + Math.sin(x * 0.05 + now * 0.003) * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(225,245,255,0.16)';
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 16) ctx.lineTo(x, wy + i * 18 + Math.sin(x * 0.04 - now * 0.002 + i) * 2.5);
    ctx.stroke();
  }
}

function deco(ctx, d, B, now) {
  const { x, y } = d, s = d.s;
  ctx.save();
  ctx.translate(x, y + 4);
  if (d.flip) ctx.scale(-1, 1);
  ctx.scale(s, s);
  switch (d.kind) {
    case 'pine': {
      ctx.fillStyle = '#3a2c25'; ctx.fillRect(-3, -14, 6, 14);
      const greens = ['#2f5a3c', '#3d6e45', '#4b8250'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = greens[i];
        const w = 26 - i * 6, y0 = -12 - i * 16;
        ctx.beginPath(); ctx.moveTo(0, y0 - 26); ctx.lineTo(-w, y0); ctx.lineTo(w, y0); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'bush':
      ctx.fillStyle = B.grassDark;
      ctx.beginPath(); ctx.ellipse(-8, -8, 13, 10, 0, 0, TAU); ctx.ellipse(8, -9, 12, 11, 0, 0, TAU); ctx.ellipse(0, -15, 12, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = B.grass;
      ctx.beginPath(); ctx.ellipse(-2, -17, 7, 5, 0, 0, TAU); ctx.fill();
      break;
    case 'flower':
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = B.grassDark; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(i * 6 - 9, 0); ctx.lineTo(i * 6 - 9, -10 - (i % 2) * 5); ctx.stroke();
        ctx.fillStyle = i % 2 ? '#c9a4ff' : '#fff4f0';
        ctx.beginPath(); ctx.arc(i * 6 - 9, -11 - (i % 2) * 5, 3, 0, TAU); ctx.fill();
      }
      break;
    case 'lamp': {
      ctx.fillStyle = '#2e2a33'; ctx.fillRect(-2, -38, 4, 38);
      ctx.fillStyle = '#5a4630'; ctx.fillRect(-7, -48, 14, 12);
      const f = 0.8 + 0.2 * Math.sin(now * 0.004 + x);
      ctx.fillStyle = `rgba(255,205,120,${f})`; ctx.fillRect(-5, -46, 10, 8);
      ctx.fillStyle = `rgba(255,205,120,${0.16 * f})`;
      ctx.beginPath(); ctx.arc(0, -42, 26, 0, TAU); ctx.fill();
      break;
    }
    case 'arch':
      // a little stone arch with a lamp inside, like the painting's ruins
      ctx.fillStyle = B.rock;
      ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-22, -26); ctx.arc(0, -26, 22, Math.PI, 0); ctx.lineTo(22, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1d1a2a';
      ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-12, -24); ctx.arc(0, -24, 12, Math.PI, 0); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(10,8,20,0.3)'; ctx.lineWidth = 1.5;
      for (const a of [-2.6, -2.0, -1.4, -0.8]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, -26 + Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 22, -26 + Math.sin(a) * 22); ctx.stroke(); }
      glow(ctx, 0, -12, 14, '255,205,120', 0.8 + 0.2 * Math.sin(now * 0.004 + x));
      break;
    case 'reed':
      ctx.strokeStyle = '#6f9d6a'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4, 0); ctx.quadraticCurveTo(i * 6, -14, i * 7 + Math.sin(now * 0.002 + i) * 2, -26 - Math.abs(i) * 3); ctx.stroke(); }
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-1.5, -30, 3, 9);
      break;
    case 'mushroom': {
      ctx.fillStyle = '#e8dccb'; ctx.fillRect(-2.5, -10, 5, 10);
      const f = 0.6 + 0.4 * Math.sin(now * 0.003 + x * 0.1);
      ctx.fillStyle = `rgba(150,255,220,${0.8 * f})`;
      ctx.beginPath(); ctx.ellipse(0, -10, 10, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = `rgba(150,255,220,${0.15 * f})`; ctx.beginPath(); ctx.arc(0, -10, 18, 0, TAU); ctx.fill();
      break;
    }
    case 'crystal': {
      const f = 0.7 + 0.3 * Math.sin(now * 0.002 + x);
      ctx.fillStyle = `rgba(190,150,255,${0.85 * f})`;
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(7, -8); ctx.lineTo(0, 0); ctx.lineTo(-7, -8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(15, -4); ctx.lineTo(9, 0); ctx.lineTo(5, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(200,170,255,${0.15 * f})`; ctx.beginPath(); ctx.arc(2, -16, 24, 0, TAU); ctx.fill();
      break;
    }
    case 'starpost':
      ctx.fillStyle = '#4a3b30'; ctx.fillRect(-2, -30, 4, 30);
      ctx.fillStyle = '#ffd77a';
      star5(ctx, 0, -36, 8, 3.5, now * 0.001);
      break;
    case 'cloud':
      ctx.fillStyle = 'rgba(235,240,255,0.55)';
      ctx.beginPath(); ctx.ellipse(0, -46 + Math.sin(now * 0.001 + x) * 4, 26, 10, 0, 0, TAU); ctx.ellipse(12, -52 + Math.sin(now * 0.001 + x) * 4, 14, 9, 0, 0, TAU); ctx.fill();
      break;
  }
  ctx.restore();
}

function star5(ctx, x, y, R1, R2, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R2 : R1;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function features(ctx, s, run, now) {
  const sheetOk = ready(sheet);
  const sprite = (name, x, y, size, rot = 0, alpha = 1) => {
    if (!sheetOk) return;
    const [sx, sy, sw, sh] = SPR[name];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(sheet, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
    ctx.restore();
  };
  for (const st of s.stars) {
    if (st.taken) continue;
    const bob = Math.sin(now * 0.004 + st.x * 0.05) * 4;
    glow(ctx, st.x, st.y + bob, 34, '255,215,120', 0.35);
    sprite('star', st.x, st.y + bob, 40, Math.sin(now * 0.002 + st.y) * 0.2);
  }
  for (const o of s.bumpers) {
    glow(ctx, o.x, o.y, o.r * 2.2, '255,214,130', 0.22 + 0.6 * o.flash);
    sprite('bumper', o.x, o.y, o.r * 2.3 * (1 + 0.15 * o.flash));
  }
  for (const o of s.lanterns) {
    ctx.strokeStyle = 'rgba(200,190,170,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(o.x, o.y - o.r - 40); ctx.lineTo(o.x, o.y - o.r); ctx.stroke();
    if (o.lit) glow(ctx, o.x, o.y, 46, '255,190,90', 0.55 + 0.1 * Math.sin(now * 0.008 + o.x));
    ctx.fillStyle = '#3d2c22';
    ctx.beginPath(); ctx.roundRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2, 5); ctx.fill();
    ctx.fillStyle = o.lit ? '#ffcf6e' : `rgba(130,120,150,${0.6 + 0.4 * o.flash})`;
    ctx.beginPath(); ctx.roundRect(o.x - o.r + 4, o.y - o.r + 4, o.r * 2 - 8, o.r * 2 - 8, 3); ctx.fill();
    ctx.fillStyle = '#d9b25f';
    ctx.fillRect(o.x - o.r - 2, o.y - o.r - 3, o.r * 2 + 4, 4);
  }
  for (const m of s.mills) {
    const c = Math.cos(m.a), sn = Math.sin(m.a);
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = m.r * 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x - c * m.half, m.y - sn * m.half); ctx.lineTo(m.x + c * m.half, m.y + sn * m.half); ctx.stroke();
    ctx.strokeStyle = '#d9b25f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(m.x - c * m.half, m.y - sn * m.half); ctx.lineTo(m.x + c * m.half, m.y + sn * m.half); ctx.stroke();
    ctx.fillStyle = '#e8c372';
    ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,40,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x, m.y + 9); ctx.lineTo(m.x, m.y + 70); ctx.stroke();
  }
  for (const p of [s.portal, s.exit]) {
    if (!p) continue;
    glow(ctx, p.x, p.y, p.r * 2.4, '120,170,255', 0.45 + 0.1 * Math.sin(now * 0.004));
    sprite('portal', p.x, p.y, p.r * 2.6, now * 0.0006 * (p === s.exit ? -1 : 1));
  }
  if (s.well && s.well.spent) sprite('portal', s.well.x, s.well.y, s.well.r * 2.4, now * 0.0002, 0.35);
  else if (s.well) {
    const wl = s.well, pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
    glow(ctx, wl.x, wl.y, wl.pull, '150,190,255', 0.16 + 0.08 * pulse);
    ctx.strokeStyle = `rgba(200,225,255,${0.25 + 0.2 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = now * 0.03;
    ctx.beginPath(); ctx.arc(wl.x, wl.y, wl.pull * (0.6 + 0.1 * pulse), 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    sprite('portal', wl.x, wl.y, wl.r * 2.9, now * 0.0004);
  }
  if (s.pearl) {
    const bob = Math.sin(now * 0.003) * 6;
    glow(ctx, s.pearl.x, s.pearl.y + bob, 70, '255,240,255', 0.5);
    sprite('pearl', s.pearl.x, s.pearl.y + bob, s.pearl.r * 2.4);
  }
}

function rail(ctx, r, now) {
  const pts = r.pts;
  const line = (offset, width, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      ctx.lineTo(pts[i][0] - (dy / l) * offset, pts[i][1] + (dx / l) * offset);
    }
    ctx.stroke();
  };
  line(0, 22, 'rgba(40,28,20,0.35)');
  line(-8, 4, '#c99a45');
  line(8, 4, '#c99a45');
  line(-8.5, 1.4, '#fff0bf');
  line(7.5, 1.4, '#fff0bf');
  // light runs along the rail
  const L = r.length, u = (now * 0.5) % 160;
  ctx.fillStyle = 'rgba(255,240,190,0.8)';
  for (let d = u; d < L; d += 160) { const p = pathAt(pts, d); ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill(); }
  // the mouth
  const m = r.mouth;
  glow(ctx, m.x, m.y, m.r * 2.4, '255,220,140', 0.7 + 0.2 * Math.sin(now * 0.008));
  ctx.strokeStyle = '#e8c372'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(m.x, m.y, m.r, Math.PI * 0.55, Math.PI * 2.45); ctx.stroke();
}

function bestFlag(ctx, run, now) {
  if (!run.best || run.best < 2) return;
  const s = station(run.world, run.best);
  if (!s) return;
  const x = s.x0, y = s.y0 - 30;
  ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y + 30); ctx.lineTo(x, y - 70); ctx.stroke();
  const wave = Math.sin(now * 0.005) * 5;
  ctx.fillStyle = run.newBest ? '#9fe3b0' : '#ffcf6e';
  ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.quadraticCurveTo(x + 30, y - 66 + wave, x + 56, y - 58); ctx.lineTo(x, y - 42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1b1a2a';
  ctx.font = '700 11px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('BEST', x + 6, y - 53);
}

function flippers(ctx, s, run, now) {
  const at = s.k === run.at;
  const shield = at && (run.saver > 0 || run.moonrise > 0 || run.bridges > 0);
  if (shield) {
    // the moon bridge under the gap
    const a = s.flippers[0], b = s.flippers[1];
    const ax = a.px + Math.cos(a.rest) * a.len, bx = b.px + Math.cos(b.rest) * b.len, y = s.fy + 52;
    ctx.strokeStyle = run.moonrise > 0 ? 'rgba(255,220,140,0.85)' : 'rgba(170,215,255,0.8)';
    ctx.lineWidth = 4 + Math.sin(now * 0.01) * 1.5;
    ctx.beginPath(); ctx.moveTo(ax - 10, y - 12); ctx.quadraticCurveTo(s.cx, y + 18, bx + 10, y - 12); ctx.stroke();
  }
  for (const f of s.flippers) {
    const k = f.len / FLIPPER.len;
    const [sx, sy, sw, sh] = SPR.flipper;
    ctx.save();
    ctx.translate(f.px, f.py);
    if (f.side > 0) { ctx.scale(-1, 1); ctx.rotate(Math.PI - f.th - FLIPPER.angle); }
    else ctx.rotate(f.th - FLIPPER.angle);
    if (Math.abs(f.th - f.rest) > 0.2) glow(ctx, f.len * 0.45, 0, f.len * 0.75, '255,220,140', 0.45);
    if (ready(sheet)) ctx.drawImage(sheet, sx, sy, sw, sh, -FLIPPER.px * k, -FLIPPER.py * k, sw * k, sh * k);
    else {
      ctx.fillStyle = '#d9b25f';
      ctx.beginPath(); ctx.moveTo(0, -f.r0); ctx.lineTo(f.len, -f.r1); ctx.lineTo(f.len, f.r1); ctx.lineTo(0, f.r0); ctx.fill();
    }
    ctx.restore();
  }
}

function moonbeam(ctx, run, top, now) {
  const b = run.ball, f = 0.7 + 0.3 * Math.sin(now * 0.006);
  for (const [w, a] of [[64, 0.06], [38, 0.09], [16, 0.16]]) {
    const g = ctx.createLinearGradient(0, top, 0, b.y + 30);
    g.addColorStop(0, 'rgba(200,225,255,0)');
    g.addColorStop(1, `rgba(200,225,255,${a * f})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(b.x - w / 2, top, w, b.y + 30 - top, w / 2); ctx.fill();
  }
}

function pearl(ctx, run, fx, now) {
  const b = run.ball;
  if (b.mode === 'gone') return;
  // the trail
  const tr = fx.trail;
  if (tr.length > 2 && b.mode !== 'warp') {
    ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      const t = i / tr.length;
      ctx.strokeStyle = run.moonrise > 0 ? `rgba(255,215,120,${t * 0.5})` : `rgba(220,235,255,${t * 0.35})`;
      ctx.lineWidth = R * 1.6 * t;
      ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
    }
  }
  if (b.mode === 'warp') {
    glow(ctx, b.x, b.y, 44, '180,210,255', 1);
    return;
  }
  glow(ctx, b.x, b.y, R * 3, run.moonrise > 0 ? '255,220,140' : '230,240,255', run.moonrise > 0 ? 0.6 : 0.4);
  if (ready(sheet)) {
    const [sx, sy, sw, sh] = SPR.ball;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(fx.spin);
    ctx.drawImage(sheet, sx, sy, sw, sh, -R - 1, -R - 1, R * 2 + 2, R * 2 + 2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f4ecff'; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
  }
  if (run.saver > 0 && run.phase === 'play') {
    ctx.strokeStyle = `rgba(170,215,255,${0.4 + 0.3 * Math.sin(now * 0.02)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, R + 6, 0, TAU); ctx.stroke();
  }
}

function particles(ctx, fx, S) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx.parts) {
    const t = p.life / p.max;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = p.color;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 * t + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - t) * p.grow, 0, TAU); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, TAU); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const p of fx.pops) {
    const t = p.life / p.max;
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `700 ${p.size}px Georgia, serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,14,30,0.7)';
    ctx.strokeText(p.text, p.x, p.y - (1 - t) * 50);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - (1 - t) * 50);
  }
  ctx.globalAlpha = 1;
}

// Particles and popups move here, once per frame
export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    p.life -= dt;
    p.vy += (p.g || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 1 - 1.5 * dt; p.vy *= 1 - (p.g ? 0 : 1.5) * dt;
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const p of fx.pops) p.life -= dt;
  fx.pops = fx.pops.filter((p) => p.life > 0);
}

export function burst(fx, x, y, { n = 12, color = '#ffe2a0', speed = 240, size = 4, life = 0.6, g = 0, kind = 'spark' } = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (g ? speed * 0.5 : 0), life: life * (0.6 + Math.random() * 0.4), max: life, color, size: size * (0.6 + Math.random() * 0.8), g, kind });
  }
  if (fx.parts.length > 600) fx.parts.splice(0, fx.parts.length - 600);
}

export function ring(fx, x, y, color = '#ffe2a0', size = 20, grow = 60, life = 0.5) {
  fx.parts.push({ x, y, vx: 0, vy: 0, life, max: life, color, size, grow, kind: 'ring' });
}

export function pop(fx, x, y, text, color = '#ffe5a3', size = 18, life = 0.9) {
  fx.pops.push({ x, y, text, color, size, life, max: life });
  if (fx.pops.length > 40) fx.pops.shift();
}
