import { COURSE_LENGTH, nearestKey } from './engine.js';

export function loadArt() {
  return Promise.all(['river', 'sprites', 'menu'].map(name => new Promise((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve([name, im]);
    im.onerror = () => reject(new Error(`Could not load ${name} art.`));
    im.src = `${import.meta.env.BASE_URL}art/${name}.png`;
  }))).then(entries => Object.fromEntries(entries));
}

function sprite(ctx, atlas, index, x, y, width, rotation = 0, alpha = 1) {
  const cw = atlas.width / 3, ch = atlas.height / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha = alpha;
  ctx.drawImage(atlas, (index % 3) * cw, Math.floor(index / 3) * ch, cw, ch, -width / 2, -width / 2, width, width);
  ctx.restore();
}

export function renderGame(ctx, g, art, width, height, reducedMotion = false) {
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
      const r = 58 * spriteScale;
      ctx.save(); ctx.strokeStyle = '#fbc65b'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffe6a0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      sprite(ctx, art.sprites, 3, x, y, 98 * spriteScale, reducedMotion ? 0 : Math.sin(g.time * 2) * 0.12);
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
    sprite(ctx, art.sprites, 2, g.rivalX * scale, rivalY, 185 * spriteScale, Math.sin(g.time * 2) * 0.025);
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
  const bob = reducedMotion ? 0 : Math.sin(g.time * 4) * 2;
  const rotation = g.falling ? Math.sin(g.time * 5) * 0.2 : g.vx * 0.0003;
  const flashing = g.cooldown > 0 && Math.sin(g.time * 22) > 0;
  sprite(ctx, art.sprites, g.wasReaching ? 1 : 0, px, playerY + bob, 210 * spriteScale, rotation, flashing ? 0.72 : 1);
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
