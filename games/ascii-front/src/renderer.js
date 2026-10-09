import { WIDTH, HEIGHT, TILE } from './engine.js';

const FONT = '"Front Mono", monospace';
const HULL = ['▌   ▐', '▌┏━┓▐', '▌┃█┃▐', '▌┗━┛▐', '▌   ▐'];
const HEAVY = ['▐   ▌', '▐╔═╗▌', '▐║▓║▌', '▐╚═╝▌', '▐   ▌'];
const COLORS = {
  player: ['#bce977', '#e2ffa5', '#688d42'],
  scout: ['#d8b272', '#ffe0a0', '#876c42'],
  striker: ['#e59b66', '#ffd39b', '#8d5a3d'],
  heavy: ['#dd8065', '#ffc1a0', '#884c3d'],
};

function glyphRows(ctx, rows, x, y, spacing = 6, lineHeight = 5) {
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < rows[row].length; col++) {
      if (rows[row][col] !== ' ') ctx.fillText(rows[row][col], x + col * spacing, y + row * lineHeight);
    }
  }
}

function terrain(ctx, game, time, reducedMotion) {
  ctx.textAlign = 'left';
  ctx.font = `13.3333px ${FONT}`;
  ctx.fillStyle = '#3b5142';
  const dots = '· '.repeat(WIDTH / 16);
  for (let y = 8; y < HEIGHT; y += 16) ctx.fillText(dots, 6, y);
  ctx.font = `8px ${FONT}`;
  ctx.fillStyle = '#263e30';
  for (let y = 64; y < HEIGHT; y += 64) {
    for (let x = 64; x < WIDTH; x += 64) ctx.fillText('+', x, y);
  }
  ctx.font = `13.3333px ${FONT}`;
  for (let row = 0; row < game.terrain.length; row++) {
    for (let col = 0; col < game.terrain[row].length; col++) {
      const type = game.terrain[row][col];
      if (type === '.') continue;
      const x = col * TILE + 1;
      const y = row * TILE + 6;
      const variation = (row * 7 + col * 3) % 4;
      const topEdge = game.terrain[row - 1]?.[col] !== type;
      if (type === '#' || type === 'S') {
        if (type === 'S' && (row === 0 || col === 0 || row === game.terrain.length - 1 || col === game.terrain[row].length - 1)) {
          ctx.fillStyle = '#354b3c';
          ctx.fillText('· ·', x + 4, y + 10);
          continue;
        }
        ctx.fillStyle = '#050c08';
        ctx.fillRect(x + 3, y - 1, 31, 29);
        ctx.fillStyle = type === '#' ? '#27251b' : '#25332b';
        ctx.fillRect(x - 1, y - 5, 31, 29);
        for (let line = 0; line < 3; line++) {
          ctx.fillStyle = type === '#'
            ? line === 0 && topEdge ? '#e8b27d' : ['#d49260', '#d99b68', '#c08557', '#d49a6c'][variation]
            : line === 0 && topEdge ? '#b4c6b3' : line === 2 ? '#81998a' : '#a1b3a3';
          ctx.fillText(type === '#' ? '####' : 'XXXX', x, y + line * 10);
        }
      } else if (type === '~') {
        ctx.fillStyle = '#142b2a';
        ctx.fillRect(x - 1, y - 5, TILE, TILE);
        const phase = reducedMotion ? 0 : Math.floor(time * 1.4 + row * 0.3 + col * 0.2) % 2;
        for (let line = 0; line < 3; line++) {
          ctx.fillStyle = line === 0 && topEdge ? '#8ab9c4' : (line + phase) % 2 ? '#72a1b1' : '#548395';
          ctx.fillText((line + phase) % 2 ? '~≈~≈' : '≈~≈~', x, y + line * 10);
        }
      } else if (type === '%') {
        ctx.fillStyle = '#19271b';
        ctx.fillRect(x - 1, y - 5, TILE, TILE);
        const phase = reducedMotion ? 0 : Math.floor(time * 0.7 + variation) % 2;
        for (let line = 0; line < 3; line++) {
          ctx.fillStyle = line === 0 ? '#91ac63' : ['#7c9c54', '#8ba95e', '#75964e', '#83a358'][variation];
          ctx.fillText((line + phase) % 2 ? ':%·%' : '%·%:', x, y + line * 10);
        }
      }
    }
  }
}

function tank(ctx, entity, isPlayer, game, time, reducedMotion) {
  const { x, y } = entity;
  const [color, light, shade] = COLORS[isPlayer ? 'player' : entity.type] || COLORS.striker;
  const hullAngle = entity.hullAngle ?? (entity.dir - 1) * Math.PI / 2;
  const aimAngle = entity.aimAngle ?? (entity.dir - 1) * Math.PI / 2;
  const hidden = game.terrain[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] === '%';
  const moving = game.status === 'playing' && entity.moving;
  const tread = moving && !reducedMotion && Math.floor(game.time * 20) % 2 ? '╫' : '▰';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `10px ${FONT}`;
  if (moving && !reducedMotion) {
    ctx.fillStyle = isPlayer ? '#627951' : '#72644c';
    for (let step = 0; step < 3; step++) {
      const distance = 18 + step * (entity.dashTimer > 0 ? 12 : 6);
      const drift = Math.sin(time * 11 + step * 2) * 3;
      ctx.globalAlpha = 0.35 - step * 0.09;
      ctx.fillText(step === 0 ? '·' : '.', x - Math.cos(hullAngle) * distance - Math.sin(hullAngle) * drift, y - Math.sin(hullAngle) * distance + Math.cos(hullAngle) * drift);
    }
  }
  ctx.globalAlpha = hidden ? 0.6 : 1;
  const sprite = entity.type === 'heavy' ? HEAVY : HULL;
  ctx.save();
  ctx.translate(x + 2, y + 3);
  ctx.rotate(hullAngle + Math.PI / 2);
  ctx.fillStyle = '#020805';
  glyphRows(ctx, sprite, -12, -10);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hullAngle + Math.PI / 2);
  ctx.fillStyle = entity.flash > 0 && !reducedMotion ? '#fff3ce' : shade;
  glyphRows(ctx, sprite, -12, -10);
  ctx.fillStyle = entity.flash > 0 && !reducedMotion ? '#fff3ce' : color;
  glyphRows(ctx, [' ┏━┓ ', ' ┃█┃ ', ' ┗━┛ '], -12, -5);
  for (const side of [-12, 12]) {
    ctx.fillStyle = color;
    for (let row = -1; row <= 1; row++) ctx.fillText(tread, side, row * 7);
    ctx.fillStyle = light;
    ctx.fillText('▪', side, -10);
  }
  ctx.fillStyle = light;
  ctx.fillText('━', 0, -6);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aimAngle + Math.PI / 2);
  ctx.fillStyle = '#08120c';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('●', 1, 1);
  ctx.fillStyle = color;
  ctx.fillText('◉', 0, 0);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = light;
  ctx.fillText('║', 0, -10);
  ctx.font = `9px ${FONT}`;
  ctx.fillText('▀', 0, -16);
  if (entity.muzzleFlash > 0 && !reducedMotion) {
    ctx.fillStyle = '#fff2ac';
    ctx.shadowColor = '#ffbd62';
    ctx.shadowBlur = 5;
    ctx.font = `16px ${FONT}`;
    ctx.fillText(entity.shotCount % 2 ? '✦' : '✶', 0, -23);
  }
  ctx.restore();
  if (!isPlayer && entity.hp < entity.maxHp) {
    ctx.fillStyle = color;
    ctx.font = `7px ${FONT}`;
    ctx.fillText('▪'.repeat(entity.hp) + '·'.repeat(entity.maxHp - entity.hp), x, y + 20);
  }
  if (entity.stunned > 0 || (isPlayer && entity.invulnerable > 0)) {
    ctx.fillStyle = entity.stunned > 0 ? '#8df5ca' : '#cdea94';
    ctx.font = `9px ${FONT}`;
    ctx.fillText(entity.stunned > 0 ? '⌁' : '⌜   ⌝', x, y - 21);
  }
  ctx.restore();
}

export function renderGame(ctx, game, time = 0, { reducedMotion = false } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#0d1612';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'middle';
  ctx.save();
  const shake = reducedMotion || game.status !== 'playing' ? 0 : Math.min(4, (game.shake || 0) * 16);
  ctx.translate(Math.sin(time * 83) * shake, Math.cos(time * 67) * shake * 0.7);
  const fieldTime = game.status === 'ready' ? time : game.time;
  terrain(ctx, game, fieldTime, reducedMotion);
  ctx.textAlign = 'center';
  ctx.font = `10px ${FONT}`;
  ctx.fillStyle = '#6e826e';
  for (const spawn of game.spawnPoints) ctx.fillText('[ ↓ ]', spawn.x, 13);

  const base = game.base;
  const baseSprite = ['  │  ', ' ╱╫╲ ', '╔═╩═╗', '║▥◆▥║', '╚═══╝'];
  ctx.font = `11px ${FONT}`;
  ctx.fillStyle = '#030b07';
  glyphRows(ctx, baseSprite, base.x - 14, base.y - 17, 8, 8);
  ctx.fillStyle = base.hp > 1 ? '#d2ddc3' : '#e79571';
  glyphRows(ctx, baseSprite, base.x - 16, base.y - 20, 8, 8);
  ctx.fillStyle = base.hp > 0 ? '#d7fa9c' : '#6d4e42';
  ctx.font = `9px ${FONT}`;
  ctx.fillText('●', base.x, base.y - 27);
  ctx.globalAlpha = reducedMotion ? 0.45 : 0.3 + (Math.sin(fieldTime * 2.5) + 1) * 0.2;
  ctx.fillText('(', base.x - 11, base.y - 27);
  ctx.fillText(')', base.x + 11, base.y - 27);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#9caf98';
  ctx.fillText('HQ', base.x, base.y + 26);

  for (const pickup of game.pickups) {
    const color = pickup.type === 'credits' ? '#ecd18c' : pickup.type === 'charge' ? '#93dbe0' : '#bde996';
    const symbol = { repair: '+', base: '⌂', charge: 'ϟ', credits: '$' }[pickup.type];
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = '#020a06';
    ctx.fillText(`[${symbol}]`, pickup.x + 2, pickup.y + 2);
    ctx.globalAlpha = reducedMotion ? 1 : 0.82 + Math.sin(fieldTime * 3 + pickup.x) * 0.18;
    ctx.fillStyle = color;
    ctx.fillText(`[${symbol}]`, pickup.x, pickup.y);
  }
  ctx.globalAlpha = 1;

  const player = game.player;
  if (player.hp > 0 && (game.status === 'ready' || game.status === 'playing')) {
    const aim = player.aimAngle ?? (player.dir - 1) * Math.PI / 2;
    ctx.fillStyle = '#a7cb72';
    ctx.font = `9px ${FONT}`;
    for (let point = 0; point < 7; point++) {
      const x = player.x + Math.cos(aim) * (28 + point * 14);
      const y = player.y + Math.sin(aim) * (28 + point * 14);
      if (['#', 'S'].includes(game.terrain[Math.floor(y / TILE)]?.[Math.floor(x / TILE)])) break;
      ctx.globalAlpha = 0.32 - point * 0.035;
      ctx.fillText('·', x, y);
    }
    ctx.globalAlpha = 1;
  }
  if (game.empFx > 0) {
    const progress = 1 - game.empFx / 0.7;
    const radius = reducedMotion ? game.empRadius : 16 + game.empRadius * progress;
    ctx.fillStyle = '#96f0c1';
    ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.font = `12px ${FONT}`;
    for (let point = 0; point < 64; point++) {
      const angle = point / 64 * Math.PI * 2;
      ctx.fillText(point % 3 ? '·' : '+', player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius);
    }
    ctx.globalAlpha = 1;
  }
  for (const enemy of game.enemies) tank(ctx, enemy, false, game, fieldTime, reducedMotion);
  if (player.hp > 0) tank(ctx, player, true, game, fieldTime, reducedMotion);

  for (const bullet of game.bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(bullet.dy, bullet.dx));
    ctx.fillStyle = bullet.owner === 'player' ? '#ddffae' : '#ffd094';
    ctx.font = `12px ${FONT}`;
    if (!reducedMotion) {
      for (let step = 3; step > 0; step--) {
        ctx.globalAlpha = 0.52 - step * 0.12;
        ctx.fillText('─', -step * 7, 0);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = bullet.owner === 'player' ? '#b8eb7d' : '#ffb35e';
    ctx.shadowBlur = 4;
    ctx.fillText('═', 0, 0);
    ctx.restore();
  }
  for (const particle of game.particles) {
    const life = Math.max(0, particle.life / particle.maxLife);
    const explosion = particle.kind === 'explosion';
    ctx.save();
    ctx.globalAlpha = life;
    ctx.fillStyle = particle.color;
    ctx.font = `${particle.text ? 11 : explosion ? 9 + (1 - life) * 11 : 7 + life * 5}px ${FONT}`;
    if (explosion && !reducedMotion) {
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 4 * life;
    }
    ctx.fillText(particle.text || particle.glyph || '+', particle.x, particle.y);
    ctx.restore();
  }
  if (game.status === 'ready') {
    ctx.fillStyle = '#b9dc82';
    ctx.font = `9px ${FONT}`;
    ctx.fillText('YOU', player.x, player.y + 27);
  }
  ctx.restore();
  if (game.hitFlash > 0 && !reducedMotion) {
    ctx.globalAlpha = Math.min(0.07, game.hitFlash * 0.25);
    ctx.fillStyle = '#efb07b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.restore();
}
