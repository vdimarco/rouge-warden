import { COURSE_LENGTH, nearestKey } from './engine.js';
import { createMotion, advanceMotion } from './motion.js';

const runs = new WeakMap();
const TAU = Math.PI * 2;
const fraction = n => n - Math.floor(n);

function current(ctx, g, width, height) {
  const scale = width / 1000;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = width < 650 ? 1.2 : 1.8;
  for (let i = 0; i < (width < 650 ? 32 : 58); i++) {
    const lane = fraction(i * 0.618034);
    const x = (265 + lane * 470 + Math.sin(g.time * 1.2 + i) * 7) * scale;
    const speed = (lane > 0.72 ? 125 : 75) * (g.surge ? 1.35 : 1);
    const y = fraction(i * 0.381966 + g.time * speed / (height + 100)) * (height + 100) - 50;
    ctx.strokeStyle = `rgba(218,255,246,${0.12 + fraction(i * 0.73) * 0.22})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5 * scale, y + 10, x - 3 * scale, y + 16 + lane * 24); ctx.stroke();
  }
  ctx.restore();
}

function wake(ctx, x, y, size, time, strength = 1, reaching = false) {
  ctx.save(); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const p = fraction(time * (0.65 + strength * 0.25) + i / 7);
    ctx.strokeStyle = `rgba(233,255,245,${(1 - p) * 0.5})`;
    ctx.beginPath(); ctx.ellipse(x, y + size * (95 + p * 95), size * (38 + p * 42), size * (9 + p * 15), 0, 0.13, Math.PI - 0.13); ctx.stroke();
  }
  // A paddle dip produces rings, followed by spray. The reaching arm stays out of the water.
  if (!reaching) {
    const stroke = fraction(time * 1.15);
    const side = Math.floor(time * 1.15) % 2 ? 1 : -1;
    const paddleX = x + side * 76 * size, paddleY = y + 20 * size;
    ctx.strokeStyle = `rgba(239,255,250,${(1 - stroke) * 0.65})`;
    ctx.beginPath(); ctx.ellipse(paddleX, paddleY + stroke * 25 * size, (8 + stroke * 28) * size, (4 + stroke * 10) * size, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const p = fraction(stroke + i * 0.075);
      ctx.fillStyle = `rgba(239,255,250,${(1 - p) * 0.7})`;
      ctx.beginPath(); ctx.arc(paddleX + side * p * (12 + i * 5) * size, paddleY + (p * p * 50 - Math.sin(p * Math.PI) * 30) * size, (1 - p * 0.5) * 2 * size, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function actionEffects(ctx, g, m, art, px, playerY, scale, size, toY) {
  for (const effect of m.effects) {
    const age = g.time - effect.time, p = age / 1.3;
    const gold = ['key', 'chest', 'win', 'near'].includes(effect.type);
    const x = effect.x * scale, y = toY(effect.distance);
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.strokeStyle = gold ? '#ffe395' : '#e6fff8'; ctx.lineWidth = 2 * size;
    ctx.beginPath(); ctx.ellipse(x, y + 24 * size, (18 + p * 110) * size, (8 + p * 36) * size, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const angle = i * 2.39996;
      const radius = age * (45 + (i % 5) * 15) * size;
      const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * 0.7 + age * age * 30 * size;
      ctx.fillStyle = gold ? (i % 2 ? '#ffe99f' : '#f9c65b') : '#e6fff8';
      ctx.beginPath(); ctx.arc(x + dx, y + dy, Math.max(0.5, (3 - p * 2) * size), 0, TAU); ctx.fill();
    }
    if (effect.type === 'key' && age < 0.6) {
      const t = Math.min(1, age / 0.6), ease = 1 - (1 - t) ** 3;
      const fromX = effect.keyX * scale, fromY = toY(effect.keyDistance);
      sprite(ctx, art.sprites, 3, fromX + (px - fromX) * ease, fromY + (playerY - fromY) * ease - Math.sin(t * Math.PI) * 65 * size, (90 - t * 48) * size, t * TAU);
    }
    ctx.restore();
  }
}

export function loadArt() {
  return Promise.all(['river', 'sprites', 'menu'].map(name => new Promise((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve([name, im]);
    im.onerror = () => reject(new Error(`Could not load ${name} art.`));
    im.src = `${import.meta.env.BASE_URL}art/${name}.png`;
  }))).then(entries => Object.fromEntries(entries));
}

function sprite(ctx, atlas, index, x, y, width, rotation = 0, alpha = 1) {
  const cw = atlas.width / 3, ch = atlas.height / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha *= alpha;
  ctx.drawImage(atlas, (index % 3) * cw, Math.floor(index / 3) * ch, cw, ch, -width / 2, -width / 2, width, width);
  ctx.restore();
}

export function renderGame(ctx, g, art, width, height, reducedMotion = false) {
  if (!runs.has(g)) runs.set(g, createMotion(g));
  const motion = advanceMotion(runs.get(g), g, reducedMotion);
  ctx.clearRect(0, 0, width, height);
  const scale = width / 1000;
  const spriteScale = Math.min(1.7, Math.max(0.7, width / 1000));
  const playerY = height * (width < 650 ? 0.64 : 0.67);
  const px = g.x * scale;
  const distScale = Math.max(0.43, Math.min(0.85, height / 1000));
  const toY = d => playerY - (d - g.distance) * distScale;
  // Mirrored alternating river tiles avoid abrupt changes at the repeating edges.
  const tileH = width * art.river.height / art.river.width;
  const offset = (g.distance * distScale) % (tileH * 2);
  for (let i = -2; i < Math.ceil(height / tileH) + 2; i++) {
    const y = i * tileH + offset - tileH * 2;
    ctx.save();
    if (i % 2) { ctx.translate(0, y + tileH); ctx.scale(1, -1); ctx.drawImage(art.river, 0, 0, width, tileH); }
    else ctx.drawImage(art.river, 0, y, width, tileH);
    ctx.restore();
  }
  if (!reducedMotion) current(ctx, g, width, height);
  // Subtle code-native navigational lines are game guidance, not representational art.
  if (g.time < 9) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,241,202,.2)'; ctx.setLineDash([6, 12]);
    [365, 630].forEach(x => { ctx.beginPath(); ctx.moveTo(x * scale, 110); ctx.lineTo(x * scale, height - 130); ctx.stroke(); });
    ctx.font = '500 11px system-ui'; ctx.fillStyle = '#fff1ca'; ctx.textAlign = 'center';
    ctx.fillText('CALM WATER', 305 * scale, height * 0.47);
    ctx.fillText('FAST CURRENT', 700 * scale, height * 0.47); ctx.restore();
  }
  for (const rock of g.rocks) {
    const y = toY(rock.d);
    if (y > -120 && y < height + 130) sprite(ctx, art.sprites, 4, rock.x * scale, y, rock.radius * 3 * spriteScale, 0, rock.hit ? 0.8 : 1);
  }
  const key = nearestKey(g);
  if (key && !g.hasKey) {
    const y = toY(key.d), x = key.x * scale;
    if (y > -150 && y < height + 150) {
      const r = (58 + (reducedMotion ? 0 : Math.sin(g.time * 4) * 4)) * spriteScale;
      ctx.save(); ctx.strokeStyle = '#fbc65b'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffe6a0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      sprite(ctx, art.sprites, 3, x, y + (reducedMotion ? 0 : Math.sin(g.time * 3) * 7), 98 * spriteScale, reducedMotion ? 0 : Math.sin(g.time * 2) * 0.18);
      ctx.shadowBlur = 0; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center';
      const close = Math.abs(key.d - g.distance) < 125 && Math.abs(g.x - key.x) < 120;
      const label = close && g.wasReaching ? 'RELEASE NOW!' : 'GOLDEN KEY';
      ctx.fillStyle = close ? '#fbc65b' : '#fff0c9';
      const tw = ctx.measureText(label).width;
      ctx.beginPath(); ctx.roundRect(x - tw / 2 - 10, y - r - 34, tw + 20, 24, 5); ctx.fill();
      ctx.fillStyle = '#092a23'; ctx.fillText(label, x, y - r - 18); ctx.restore();
    }
  }
  const rivalY = toY(g.rivalDistance);
  if (rivalY > -120 && rivalY < height + 150) {
    if (!reducedMotion) wake(ctx, g.rivalX * scale, rivalY, spriteScale * 0.85, g.time + 0.7, 0.8);
    sprite(ctx, art.sprites, 2, g.rivalX * scale, rivalY + (reducedMotion ? 0 : Math.sin(g.time * 5 + 1) * 3), 185 * spriteScale, reducedMotion ? 0 : Math.sin(g.time * 4 + 1) * 0.045);
    ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0c9';
    ctx.fillText('RIVAL', g.rivalX * scale, rivalY - 96 * spriteScale);
  }
  if (g.distance > COURSE_LENGTH - 1600) {
    const gateY = toY(COURSE_LENGTH);
    ctx.save();
    ctx.fillStyle = 'rgba(249,198,91,.17)'; ctx.fillRect(275 * scale, gateY - 95, 160 * scale, 150);
    ctx.strokeStyle = '#f9c65b'; ctx.lineWidth = 3; ctx.setLineDash([9, 8]);
    ctx.strokeRect(275 * scale, gateY - 95, 160 * scale, 150);
    ctx.font = '700 12px system-ui'; ctx.fillStyle = '#fff0c9'; ctx.textAlign = 'center';
    ctx.fillText('ESCAPE', 355 * scale, gateY - 107);
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,240,200,.65)';
    ctx.beginPath(); ctx.moveTo(445 * scale, gateY); ctx.lineTo(790 * scale, gateY); ctx.stroke();
    ctx.font = '600 11px system-ui'; ctx.fillText('WATERFALL', 615 * scale, gateY - 16); ctx.restore();
  }
  const fast = g.surge ? 2 : g.x > 630 ? 1.5 : 1;
  const stroke = Math.sin(g.time * TAU * 1.15);
  const bob = reducedMotion ? 0 : (Math.sin(g.time * 4.8) * 4 * fast + stroke * 1.5) * spriteScale;
  const impact = reducedMotion ? 0 : motion.effects.reduce((amount, effect) => {
    const age = g.time - effect.time;
    return effect.type === 'hit' && age < 0.45 ? amount + Math.sin(age * 48) * (1 - age / 0.45) * 7 * spriteScale : amount;
  }, 0);
  const rotation = reducedMotion ? 0 : g.falling ? Math.sin(g.time * 5) * 0.16 : g.vx * 0.0003 + stroke * 0.028 * (1 - motion.reach) + Math.sin(g.time * 3.3) * 0.025 * fast;
  if (!reducedMotion) wake(ctx, px, playerY, spriteScale, g.time, fast, g.wasReaching || !!g.falling);
  const alpha = g.falling ? 0.65 : 1;
  if (motion.reach < 1) sprite(ctx, art.sprites, 0, px + impact, playerY + bob, 210 * spriteScale, rotation, alpha * (1 - motion.reach));
  if (motion.reach > 0) sprite(ctx, art.sprites, 1, px + impact, playerY + bob - motion.reach * 3, 210 * spriteScale, rotation - motion.reach * 0.025, alpha * motion.reach);
  if (!reducedMotion) actionEffects(ctx, g, motion, art, px, playerY, scale, spriteScale, toY);
  if (g.wasReaching) {
    ctx.save(); ctx.strokeStyle = g.reach > 1.8 ? '#ef9268' : '#f9c65b'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(px, playerY, 115 * spriteScale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, g.reach / 2.3)); ctx.stroke(); ctx.restore();
  }
  if (g.unlocked) {
    ctx.save(); ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0c9';
    ctx.fillText('TREASURE ABOARD', px, playerY + 115 * spriteScale); ctx.restore();
  }
  if (g.falling) {
    ctx.save(); ctx.fillStyle = 'rgba(3,28,23,.55)'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff0c9'; ctx.font = '600 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Climbing back aboard…', width / 2, height / 2); ctx.restore();
  }
}
