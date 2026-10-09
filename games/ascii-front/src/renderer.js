import { WIDTH, HEIGHT, TILE, COLS } from './engine.js';

const FONT = '"Front Mono", monospace';
const HULL = ['▌   ▐', '▌┏━┓▐', '▌┃█┃▐', '▌┗━┛▐', '▌   ▐'];
const HEAVY = ['▐   ▌', '▐╔═╗▌', '▐║▓║▌', '▐╚═╝▌', '▐   ▌'];
const PLAYER_HULLS = [
  ['▌   ▐', '▌┌─┐▐', '▌│·│▐', '▌└─┘▐', '▌   ▐'], HULL,
  ['▌   ▐', '▌╔═╗▐', '▌║◆║▐', '▌╚═╝▐', '▌   ▐'], HEAVY,
];
const COLORS = {
  player: ['#bce977', '#e2ffa5', '#688d42'],
  p2: ['#85d7e5', '#d2faff', '#4d8995'],
  basic: ['#e59b66', '#ffd39b', '#8d5a3d'],
  scout: ['#d8b272', '#ffe0a0', '#876c42'],
  power: ['#e99b95', '#ffcdc2', '#914a4c'],
  heavy: ['#dd8065', '#ffc1a0', '#884c3d'],
};
const ARMOR = [COLORS.heavy, COLORS.scout, ['#91ba81', '#d0e4ac', '#5c7d54'], ['#b3c3b5', '#e3edcf', '#738f7c']];

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
        const damage = type === '#' ? game.brickDamage?.[row * COLS + col] || 0 : 0;
        if (damage) {
          for (let quarter = 0; quarter < 4; quarter++) {
            if (damage & (1 << quarter)) continue;
            const qx = x + quarter % 2 * 16;
            const qy = row * TILE + Math.floor(quarter / 2) * 16;
            ctx.fillStyle = '#27251b';
            ctx.fillRect(qx - 1, qy + 1, 16, 15);
            ctx.fillStyle = '#d49260';
            ctx.fillText('##', qx, qy + 5);
            ctx.fillText('##', qx, qy + 13);
          }
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
      } else if (type === 'I') {
        ctx.fillStyle = '#15282a';
        ctx.fillRect(x - 1, y - 5, TILE, TILE);
        for (let line = 0; line < 3; line++) {
          ctx.fillStyle = line === 0 && topEdge ? '#a3ccd0' : '#719ba5';
          ctx.fillText(line % 2 ? '·╱·╱' : '╱·╱·', x, y + line * 10);
        }
      }
    }
  }
}

function foliage(ctx, game, time, reducedMotion) {
  ctx.textAlign = 'left';
  ctx.font = `13.3333px ${FONT}`;
  for (let row = 0; row < game.terrain.length; row++) {
    for (let col = 0; col < game.terrain[row].length; col++) {
      if (game.terrain[row][col] !== '%') continue;
      const variation = (row * 7 + col * 3) % 4;
      const phase = reducedMotion ? 0 : Math.floor(time * 0.7 + variation) % 2;
      for (let line = 0; line < 3; line++) {
        ctx.fillStyle = line === 0 ? '#91ac63' : ['#7c9c54', '#8ba95e', '#75964e', '#83a358'][variation];
        ctx.fillText((line + phase) % 2 ? ':%·%' : '%·%:', col * TILE + 1, row * TILE + 6 + line * 10);
      }
    }
  }
  ctx.textAlign = 'center';
}

function tank(ctx, entity, isPlayer, game, time, reducedMotion) {
  const { x, y } = entity;
  const level = isPlayer ? Math.min(3, Math.max(0, entity.level || 0)) : 0;
  let palette = isPlayer ? COLORS[entity.id === 'p2' ? 'p2' : 'player'] : entity.type === 'heavy' ? ARMOR[Math.min(3, Math.max(0, Math.ceil(entity.hp) - 1))] : COLORS[entity.type] || COLORS.basic;
  const carrier = !isPlayer && entity.carrier && !entity.dropped;
  if (carrier && !reducedMotion && Math.floor(time * 4) % 2) palette = ['#f4daba', '#fff4df', '#ac6f58'];
  const [color, light, shade] = palette;
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
  const sprite = isPlayer ? PLAYER_HULLS[level] : entity.type === 'heavy' ? HEAVY : HULL;
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
  const frame = isPlayer && level === 0 ? [' ┌─┐ ', ' │·│ ', ' └─┘ '] : level >= 2 || entity.type === 'heavy' ? [' ╔═╗ ', ' ║▓║ ', ' ╚═╝ '] : [' ┏━┓ ', ' ┃█┃ ', ' ┗━┛ '];
  glyphRows(ctx, frame, -12, -5);
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
  ctx.fillStyle = light;
  ctx.font = `${level >= 2 ? 10 : 12}px ${FONT}`;
  for (const barrel of level >= 2 ? [-3.5, 3.5] : [0]) {
    ctx.fillText('║', barrel, -10);
    ctx.fillText(level === 3 ? '╬' : '▀', barrel, -16);
  }
  if (isPlayer && level > 0) {
    ctx.font = `7px ${FONT}`;
    ctx.fillText(['', '⌃', '◆', '▓'][level], 0, 3);
  }
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
  if (carrier || (!isPlayer && game.freezeTimer > 0)) {
    ctx.fillStyle = carrier ? '#f6d49b' : '#a0dde3';
    ctx.font = `9px ${FONT}`;
    ctx.fillText(carrier ? '★' : 'Ⅱ', x, y - 23);
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
  ctx.fillStyle = base.hp > 0 ? '#d2ddc3' : '#e79571';
  glyphRows(ctx, baseSprite, base.x - 16, base.y - 20, 8, 8);
  ctx.fillStyle = base.hp <= 0 ? '#6d4e42' : game.fortifyTimer > 0 ? '#98e1e5' : '#d7fa9c';
  ctx.font = `9px ${FONT}`;
  ctx.fillText('●', base.x, base.y - 27);
  ctx.globalAlpha = reducedMotion ? 0.45 : 0.3 + (Math.sin(fieldTime * 2.5) + 1) * 0.2;
  ctx.fillText('(', base.x - 11, base.y - 27);
  ctx.fillText(')', base.x + 11, base.y - 27);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#9caf98';
  ctx.fillText('HQ', base.x, base.y + 26);

  for (const pickup of game.pickups) {
    const color = pickup.type === 'star' ? '#f3d58b' : ['helmet', 'timer'].includes(pickup.type) ? '#9cdae6' : '#bde996';
    const symbol = { star: '★', helmet: '◈', grenade: '✹', timer: '◷', shovel: '♜', tank: '♟' }[pickup.type];
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = '#020a06';
    ctx.fillText(`[${symbol}]`, pickup.x + 2, pickup.y + 2);
    ctx.globalAlpha = reducedMotion ? 1 : 0.82 + Math.sin(fieldTime * 3 + pickup.x) * 0.18;
    ctx.fillStyle = color;
    ctx.fillText(`[${symbol}]`, pickup.x, pickup.y);
  }
  ctx.globalAlpha = 1;

  const player = game.player;
  const players = game.players || [player];
  for (const unit of players) {
    if (unit.dead || unit.respawnTimer > 0 || unit.hp <= 0 || !['ready', 'playing'].includes(game.status)) continue;
    const player = unit;
    const aim = player.aimAngle ?? (player.dir - 1) * Math.PI / 2;
    ctx.fillStyle = player.id === 'p2' ? '#86c7d8' : '#a7cb72';
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
      ctx.fillText(point % 3 ? '·' : '+', (game.empX ?? player.x) + Math.cos(angle) * radius, (game.empY ?? player.y) + Math.sin(angle) * radius);
    }
    ctx.globalAlpha = 1;
  }
  if (game.status !== 'editor') {
    for (const enemy of game.enemies) tank(ctx, enemy, false, game, fieldTime, reducedMotion);
    for (const unit of players) {
      if (!unit.dead && unit.respawnTimer <= 0 && unit.hp > 0) tank(ctx, unit, true, game, fieldTime, reducedMotion);
      else if (unit.respawnTimer > 0) {
        ctx.fillStyle = unit.id === 'p2' ? '#85d7e5' : '#bce977';
        ctx.font = `9px ${FONT}`;
        ctx.fillText(`${unit.id === 'p2' ? 'P2' : 'P1'} / ${Math.ceil(unit.respawnTimer)}s`, unit.x, unit.y - 20);
      }
    }
  }
  foliage(ctx, game, fieldTime, reducedMotion);

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
  if (game.status === 'ready' || game.status === 'editor' || players.length > 1) {
    for (const unit of players) {
      if (unit.dead || unit.respawnTimer > 0) continue;
      ctx.fillStyle = unit.id === 'p2' ? '#85d7e5' : '#b9dc82';
      ctx.font = `8px ${FONT}`;
      ctx.fillText(game.status === 'editor' ? `${unit.id === 'p2' ? 'P2' : 'P1'} SPAWN` : players.length > 1 ? unit.id === 'p2' ? 'P2' : 'P1' : 'YOU', unit.x, unit.y + 27);
    }
  }
  ctx.restore();
  if (game.hitFlash > 0 && !reducedMotion) {
    ctx.globalAlpha = Math.min(0.07, game.hitFlash * 0.25);
    ctx.fillStyle = '#efb07b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  ctx.restore();
}
