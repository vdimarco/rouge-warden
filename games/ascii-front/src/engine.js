import { MAPS, makeTerrain, validateMap } from './maps.js';

export const WIDTH = 960;
export const HEIGHT = 672;
export const TILE = 32;
export const COLS = WIDTH / TILE;
export const ROWS = HEIGHT / TILE;

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const RADIUS = 11;
const HQ_WALLS = [[13, 18], [14, 18], [15, 18], [16, 18], [13, 19], [16, 19]];
const PICKUPS = ['star', 'helmet', 'grenade', 'timer', 'shovel', 'tank'];
const ENEMY = {
  basic: { hp: 1, speed: 72, fireRate: 2.4, bulletSpeed: 240, points: 100 },
  scout: { hp: 1, speed: 110, fireRate: 2.4, bulletSpeed: 240, points: 200 },
  power: { hp: 1, speed: 72, fireRate: 1.8, bulletSpeed: 520, points: 300 },
  heavy: { hp: 4, speed: 54, fireRate: 2.6, bulletSpeed: 240, points: 400 },
};
const UPGRADES = [
  { id: 'rapid-fire', name: 'Rapid fire', description: 'Fire 30% faster when a shell slot is free.', icon: '»' },
  { id: 'reinforced', name: 'Reactive armor', description: '+2 maximum armor. Repairs surviving tanks.', icon: '◈' },
  { id: 'overdrive', name: 'Overdrive', description: '+20% movement. Dash recharges 25% faster.', icon: '↗' },
  { id: 'piercing', name: 'Rail rounds', description: 'Shots punch through one extra target or wall.', icon: '↯' },
  { id: 'repair', name: 'Field engineer', description: 'Fortify HQ for 20 seconds and gain an EMP.', icon: '+' },
];

function random(game) {
  game.rng = (Math.imul(game.rng, 1664525) + 1013904223) >>> 0;
  return game.rng / 4294967296;
}

function makePlayer(index) {
  return {
    id: `p${index + 1}`, x: index === 0 ? 112 : 848, y: 592,
    spawnX: index === 0 ? 112 : 848, spawnY: 592,
    dir: 0, hp: 4, maxHp: 4, speed: 160, level: 0, lives: 3, dead: false, rankFx: 0,
    respawnTimer: 0, stunned: 0, score: 0, nextLifeScore: 20000, stageKills: 0, kills: 0,
    hullAngle: -Math.PI / 2, aimAngle: -Math.PI / 2, moving: false, vx: 0, vy: 0,
    fireCooldown: 0, fireRate: 0.14, dashCooldown: 0, dashRecharge: 2.1,
    dashTimer: 0, invulnerable: 0, pierce: 0, shotCount: 0, muzzleFlash: 0,
  };
}

export function createGame({ mode = 'campaign', seed = 1, stage = 1, coop = false, customMap = null } = {}) {
  const startStage = Math.max(1, Math.min(MAPS.length, Math.trunc(Number(stage)) || 1));
  const customTerrain = customMap?.terrain ?? customMap;
  if (customTerrain !== null && !validateMap(customTerrain)) throw new TypeError('Invalid custom battlefield');
  const players = [makePlayer(0)];
  if (coop) players.push(makePlayer(1));
  const game = {
    mode: mode === 'custom' || customTerrain !== null ? 'custom' : mode === 'endless' ? 'endless' : 'campaign',
    seed: Number(seed) >>> 0, rng: Number(seed) >>> 0, startStage, coop: !!coop,
    customMap: customTerrain === null ? null : customTerrain.map(row => [...row]),
    status: 'ready', wave: startStage, stage: startStage,
    stageName: customTerrain !== null ? 'CONSTRUCTION ZONE' : MAPS[startStage - 1].name,
    score: 0, kills: 0, combo: 0, comboTimer: 0, time: 0,
    players, player: players[0], base: { x: 480, y: 624, hp: 1, maxHp: 1 },
    enemies: [], bullets: [], particles: [], pickups: [], terrain: makeTerrain(startStage, customTerrain), brickDamage: {},
    spawnPoints: [{ x: 112, y: 48 }, { x: 496, y: 48 }, { x: 848, y: 48 }],
    waveTotal: 20, waveSpawned: 0, waveKills: 0, spawnTimer: 1.5, carrierDrops: 0,
    upgrades: [], upgradeChoices: [], empCharges: 2, empFx: 0, empRadius: 280,
    nextId: 1, event: 'DEFEND THE SIGNAL', previousEmp: false,
    shots: 0, empCount: 0, rankUps: 0, shake: 0, hitFlash: 0, freezeTimer: 0, fortifyTimer: 0,
    stageBonus: { p1: 0, p2: 0 },
  };
  for (const [index, type] of ['basic', 'scout', 'power', 'heavy', 'basic'].entries()) {
    game.enemies.push(makeEnemy(game, { x: 112 + index * 184, y: 48 }, type));
  }
  return game;
}

export function startGame(game) {
  const fresh = createGame({ mode: game.mode, seed: game.seed, stage: game.startStage, coop: game.coop, customMap: game.customMap });
  Object.assign(game, fresh, { status: 'playing', enemies: [], nextId: 1, event: `STAGE ${String(fresh.wave).padStart(2, '0')} // CONTACT INBOUND` });
  for (const player of game.players) player.invulnerable = 2.5;
  return game;
}

export function togglePause(game) {
  if (game.status === 'playing') game.status = 'paused';
  else if (game.status === 'paused') game.status = 'playing';
  return game;
}

function makeEnemy(game, point, type, ordinal = 0) {
  return {
    id: game.nextId++, x: point.x, y: point.y, dir: 2, type,
    hp: ENEMY[type].hp, maxHp: ENEMY[type].hp, speed: ENEMY[type].speed,
    fireCooldown: ENEMY[type].fireRate + random(game) * 0.4, spawnTimer: ordinal > 0 ? 1 : 0,
    stunned: 0, carrier: [4, 11, 18].includes(ordinal), dropped: false,
    routeDir: 2, routeDistance: 0, flash: 0, moving: false, vx: 0, vy: 0,
    hullAngle: Math.PI / 2, aimAngle: Math.PI / 2, shotCount: 0, muzzleFlash: 0,
  };
}

function solid(game, x, y) {
  const row = Math.floor(y / TILE), col = Math.floor(x / TILE);
  const type = game.terrain[row]?.[col];
  if (type === '#') {
    const quadrant = (x - col * TILE >= 16 ? 1 : 0) + (y - row * TILE >= 16 ? 2 : 0);
    return !((game.brickDamage[row * COLS + col] ?? 0) & (1 << quadrant));
  }
  return type === undefined || type === '#' || type === 'S' || type === '~';
}

function canStand(game, x, y, tank) {
  for (const dx of [-RADIUS, 0, RADIUS]) {
    for (const dy of [-RADIUS, 0, RADIUS]) if (solid(game, x + dx, y + dy)) return false;
  }
  if (game.base.hp > 0 && Math.abs(x - game.base.x) < 34 && Math.abs(y - game.base.y) < 30) return false;
  return ![...game.players, ...game.enemies].some(other => other !== tank && !other.dead
    && Math.abs(x - other.x) < RADIUS * 2 && Math.abs(y - other.y) < RADIUS * 2);
}

function moveTank(game, tank, dx, dy, distance) {
  const steps = Math.max(1, Math.ceil(distance / 5));
  const startX = tank.x;
  const startY = tank.y;
  for (let step = 0; step < steps; step++) {
    const amount = distance / steps;
    const x = tank.x + dx * amount;
    if (canStand(game, x, tank.y, tank)) tank.x = x;
    const y = tank.y + dy * amount;
    if (canStand(game, tank.x, y, tank)) tank.y = y;
  }
  return Math.hypot(tank.x - startX, tank.y - startY);
}

function motion(game, tank, vx, vy, dt) {
  const onIce = game.terrain[Math.floor(tank.y / TILE)]?.[Math.floor(tank.x / TILE)] === 'I';
  const blend = onIce ? 1 - Math.exp(-dt * 5) : 1;
  tank.vx = (tank.vx ?? 0) + (vx - (tank.vx ?? 0)) * blend;
  tank.vy = (tank.vy ?? 0) + (vy - (tank.vy ?? 0)) * blend;
  const speed = Math.hypot(tank.vx, tank.vy);
  if (speed < 0.1) { tank.vx = 0; tank.vy = 0; return 0; }
  const beforeX = tank.x;
  const beforeY = tank.y;
  const moved = moveTank(game, tank, tank.vx / speed, tank.vy / speed, speed * dt);
  if (Math.abs(tank.x - beforeX) < 0.001) tank.vx = 0;
  if (Math.abs(tank.y - beforeY) < 0.001) tank.vy = 0;
  return moved;
}

function shoot(game, tank, owner) {
  if (owner === 'player' && game.bullets.filter(bullet => !bullet.dead && bullet.owner === 'player'
    && (bullet.shooterId ?? 'p1') === tank.id).length >= (tank.level >= 2 ? 2 : 1)) return false;
  if (owner === 'enemy' && game.bullets.some(bullet => !bullet.dead && bullet.owner === 'enemy' && bullet.shooterId === tank.id)) return false;
  const angle = owner === 'player' && Number.isFinite(tank.aimAngle)
    ? tank.aimAngle : Math.atan2(DIRECTIONS[tank.dir][1], DIRECTIONS[tank.dir][0]);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const speed = owner === 'player' ? (tank.level >= 1 ? 950 : 700) : ENEMY[tank.type].bulletSpeed;
  tank.aimAngle = angle;
  tank.shotCount = (tank.shotCount ?? 0) + 1;
  tank.muzzleFlash = 0.075;
  game.shots++;
  if (owner === 'player') game.shake = Math.max(game.shake, 0.035);
  const brickAhead = owner === 'enemy' && game.terrain[Math.floor((tank.y + dy * 24) / TILE)]?.[Math.floor((tank.x + dx * 24) / TILE)] === '#';
  const breachOffset = brickAhead ? (tank.shotCount % 2 ? -8 : 8) : 0;
  game.bullets.push({ x: tank.x + dx * 17 - dy * breachOffset, y: tank.y + dy * 17 + dx * breachOffset, dx: dx * speed, dy: dy * speed,
    owner, shooterId: tank.id, damage: 1, pierce: owner === 'player' ? tank.pierce : 0,
    steelBreak: owner === 'player' && tank.level >= 3, hitIds: [] });
  return true;
}

function burst(game, x, y, color, count = 8, text = '', kind = 'spark') {
  const glyphs = ['·', '+', '×', '*', '■'];
  for (let index = 0; index < count; index++) {
    const angle = random(game) * Math.PI * 2;
    const speed = 35 + random(game) * (kind === 'explosion' ? 200 : 110);
    const life = 0.25 + random(game) * 0.45;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, text: '', glyph: glyphs[index % glyphs.length], kind });
  }
  if (text) game.particles.push({ x, y, vx: 0, vy: -35, life: 0.85, maxLife: 0.85, color, text, glyph: '', kind: 'label' });
}

function addScore(game, player, points) {
  game.score += points;
  player.score += points;
  while (player.score >= player.nextLifeScore) {
    player.nextLifeScore += 20000;
    player.lives++;
    if (player.dead && player.respawnTimer <= 0) player.respawnTimer = 1.2;
    game.event = `${player.id.toUpperCase()} EXTRA LIFE // ${player.lives} TANKS`;
  }
}

function dropCarrier(game, enemy) {
  if (!enemy.carrier || enemy.dropped) return;
  enemy.dropped = true;
  game.carrierDrops++;
  const livePlayers = game.players.filter(player => !player.dead).sort((a, b) => a.level - b.level);
  const player = livePlayers[0] ?? game.player;
  const point = supplyPosition(game, player);
  const type = game.carrierDrops <= 2 && livePlayers.some(tank => tank.level < 3)
    ? 'star' : PICKUPS[Math.floor(random(game) * PICKUPS.length)];
  game.pickups.push({ ...point, type, life: 45 });
  game.event = 'SUPPLY CARRIER HIT // POWER-UP DEPLOYED';
}

function supplyPosition(game, player) {
  const queue = [[Math.floor(player.x / TILE), Math.floor(player.y / TILE), 0]];
  const visited = new Set([queue[0][1] * COLS + queue[0][0]]);
  const candidates = [];
  for (let index = 0; index < queue.length; index++) {
    const [col, row, steps] = queue[index];
    const point = { x: col * TILE + 16, y: row * TILE + 16 };
    const distance = Math.hypot(point.x - player.x, point.y - player.y);
    if (distance <= 192 && canStand(game, point.x, point.y, null)
      && !game.pickups.some(pickup => Math.hypot(pickup.x - point.x, pickup.y - point.y) < 28)) candidates.push({ ...point, distance });
    if (steps >= 6) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const nextCol = col + dx, nextRow = row + dy, key = nextRow * COLS + nextCol;
      if (nextCol < 1 || nextCol >= COLS - 1 || nextRow < 1 || nextRow >= ROWS - 1 || visited.has(key)
        || !['.', '%', 'I'].includes(game.terrain[nextRow][nextCol])
        || !canStand(game, nextCol * TILE + 16, nextRow * TILE + 16, player)) continue;
      visited.add(key); queue.push([nextCol, nextRow, steps + 1]);
    }
  }
  const nearby = candidates.filter(point => point.distance >= 72);
  const choices = nearby.length ? nearby : candidates;
  return choices.length ? choices[Math.floor(random(game) * choices.length)] : { x: player.x, y: player.y };
}

function destroyEnemy(game, enemy, player = game.player) {
  if (enemy.dead) return;
  enemy.dead = true;
  game.kills++;
  game.waveKills++;
  player.stageKills++;
  player.kills++;
  game.combo = game.comboTimer > 0 ? Math.min(5, game.combo + 1) : 1;
  game.comboTimer = 4;
  const points = ENEMY[enemy.type].points;
  addScore(game, player, points);
  burst(game, enemy.x, enemy.y, '#ffb25b', 28, `+${points}`, 'explosion');
  game.shake = Math.max(game.shake, 0.14);
  game.event = `${enemy.type.toUpperCase()} ELIMINATED // +${points}`;
}

function damageEnemy(game, enemy, damage, player) {
  dropCarrier(game, enemy);
  enemy.hp -= damage;
  enemy.flash = 0.12;
  if (enemy.hp <= 0) destroyEnemy(game, enemy, player);
}

export function activateEmp(game, playerId = 'p1') {
  const player = game.players.find(tank => tank.id === playerId && !tank.dead) ?? game.players.find(tank => !tank.dead);
  if (game.status !== 'playing' || game.empCharges <= 0 || !player) return false;
  game.empCharges--;
  game.empCount++;
  game.empFx = 0.7;
  game.empX = player.x; game.empY = player.y;
  game.shake = Math.max(game.shake, 0.2);
  for (const enemy of game.enemies) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > game.empRadius) continue;
    damageEnemy(game, enemy, 2, player);
    enemy.stunned = 2;
    burst(game, enemy.x, enemy.y, '#8df5ca', 5);
  }
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
  game.bullets = game.bullets.filter(bullet => bullet.owner === 'player'
    || Math.hypot(bullet.x - player.x, bullet.y - player.y) > game.empRadius);
  game.event = 'EMP DISCHARGED // SYSTEMS DISRUPTED';
  return true;
}

function routeDirection(game, enemy, target) {
  const startCol = Math.floor(enemy.x / TILE), startRow = Math.floor(enemy.y / TILE);
  const endCol = Math.floor(target.x / TILE), endRow = Math.floor(target.y / TILE);
  const queue = [[startCol, startRow, -1]];
  const visited = new Set([startRow * COLS + startCol]);
  for (let index = 0; index < queue.length; index++) {
    const [col, row, firstDir] = queue[index];
    if (col === endCol && row === endRow && firstDir !== -1) return firstDir;
    const order = enemy.id % 2 ? [2, 1, 3, 0] : [2, 3, 1, 0];
    for (const dir of order) {
      const [dx, dy] = DIRECTIONS[dir];
      const nextCol = col + dx, nextRow = row + dy, key = nextRow * COLS + nextCol;
      if (nextCol < 1 || nextCol >= COLS - 1 || nextRow < 1 || nextRow >= ROWS - 1 || visited.has(key)) continue;
      const tile = game.terrain[nextRow][nextCol];
      if (tile === 'S' || tile === '~') continue;
      const occupied = [...game.players, ...game.enemies].some(other => other !== enemy && !other.dead
        && Math.abs(other.x - (nextCol * TILE + 16)) < RADIUS * 2 && Math.abs(other.y - (nextRow * TILE + 16)) < RADIUS * 2);
      if (occupied && (nextCol !== endCol || nextRow !== endRow)) continue;
      visited.add(key);
      queue.push([nextCol, nextRow, firstDir === -1 ? dir : firstDir]);
    }
  }
  const dx = target.x - enemy.x, dy = target.y - enemy.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
}

function updateEnemies(game, dt) {
  for (const enemy of game.enemies) {
    enemy.moving = false;
    enemy.muzzleFlash = Math.max(0, (enemy.muzzleFlash ?? 0) - dt);
    enemy.flash = Math.max(0, (enemy.flash ?? 0) - dt);
    enemy.stunned = Math.max(0, (enemy.stunned ?? 0) - dt);
    enemy.spawnTimer = Math.max(0, (enemy.spawnTimer ?? 0) - dt);
    if (game.freezeTimer > 0 || enemy.spawnTimer > 0 || enemy.stunned > 0 || enemy.dead) { enemy.vx = 0; enemy.vy = 0; continue; }
    enemy.fireCooldown -= dt;
    const visiblePlayers = game.players.filter(player => !player.dead && Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 224
      && (game.terrain[Math.floor(player.y / TILE)]?.[Math.floor(player.x / TILE)] !== '%'
      || Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 160));
    visiblePlayers.sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y));
    const target = (enemy.type === 'scout' || enemy.type === 'power') && visiblePlayers.length ? visiblePlayers[0] : game.base;
    const nearTarget = (Math.abs(target.x - enemy.x) < 17 || Math.abs(target.y - enemy.y) < 17)
      && Math.hypot(target.x - enemy.x, target.y - enemy.y) < 56;
    let vx = 0, vy = 0;
    if (!nearTarget) {
      if (enemy.routeDistance <= 0.01) {
        enemy.routeDir = routeDirection(game, enemy, target);
        const [dx, dy] = DIRECTIONS[enemy.routeDir];
        enemy.routeDistance = dx ? Math.abs((Math.floor(enemy.x / TILE) + dx + 0.5) * TILE - enemy.x)
          : Math.abs((Math.floor(enemy.y / TILE) + dy + 0.5) * TILE - enemy.y);
      }
      enemy.dir = enemy.routeDir;
      enemy.hullAngle = Math.atan2(DIRECTIONS[enemy.dir][1], DIRECTIONS[enemy.dir][0]);
      const speed = Math.min(enemy.speed, enemy.routeDistance / dt);
      vx = DIRECTIONS[enemy.dir][0] * speed; vy = DIRECTIONS[enemy.dir][1] * speed;
    }
    const moved = motion(game, enemy, vx, vy, dt);
    enemy.moving = moved > 0.001;
    enemy.routeDistance = Math.max(0, enemy.routeDistance - moved);
    if (!nearTarget && moved < Math.hypot(vx, vy) * dt * 0.8) enemy.routeDistance = 0;
    const dx = target.x - enemy.x, dy = target.y - enemy.y;
    const aligned = (Math.abs(dx) < 17 || Math.abs(dy) < 17) && Math.hypot(dx, dy) <= 192;
    const fireDir = aligned ? (Math.abs(dx) < 17 ? (dy > 0 ? 2 : 0) : (dx > 0 ? 1 : 3)) : enemy.routeDir;
    enemy.aimAngle = Math.atan2(DIRECTIONS[fireDir][1], DIRECTIONS[fireDir][0]);
    if (enemy.fireCooldown <= 0) {
      const travelDir = enemy.dir;
      enemy.dir = fireDir;
      if (shoot(game, enemy, 'enemy')) enemy.fireCooldown = ENEMY[enemy.type].fireRate * Math.max(0.9, 1 - (game.wave - 1) * 0.003);
      enemy.dir = travelDir;
    }
  }
}

function freePosition(game, tank, x = tank.spawnX, y = tank.spawnY) {
  if (canStand(game, x, y, tank)) return { x, y };
  const col = Math.floor(x / TILE), row = Math.floor(y / TILE);
  for (let radius = 1; radius < Math.max(COLS, ROWS); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const point = { x: (col + dx) * TILE + 16, y: (row + dy) * TILE + 16 };
        if (canStand(game, point.x, point.y, tank)) return point;
      }
    }
  }
  return null;
}

function destroyPlayer(game, player) {
  if (player.dead) return;
  player.lives = Math.max(0, player.lives - 1);
  player.dead = true; player.hp = 0; player.level = 0; player.rankFx = 0;
  player.moving = false; player.vx = 0; player.vy = 0; player.dashTimer = 0;
  player.respawnTimer = player.lives > 0 ? 1.2 : 0;
  game.bullets = game.bullets.filter(bullet => bullet.shooterId !== player.id);
  burst(game, player.x, player.y, '#ff7065', 32, 'TANK LOST', 'explosion');
  game.event = `${player.id.toUpperCase()} TANK LOST // ${player.lives} REMAINING`;
}

function hitBullet(game, bullet) {
  const col = Math.floor(bullet.x / TILE), row = Math.floor(bullet.y / TILE);
  const tile = game.terrain[row]?.[col];
  if (tile === undefined) { bullet.dead = true; return; }
  if ((tile === '#' && solid(game, bullet.x, bullet.y)) || tile === 'S') {
    const breakable = tile === '#' || (bullet.steelBreak && col > 0 && col < COLS - 1 && row > 0 && row < ROWS - 1);
    if (breakable) {
      if (tile === '#' && !bullet.steelBreak) {
        const quadrant = (bullet.x - col * TILE >= 16 ? 1 : 0) + (bullet.y - row * TILE >= 16 ? 2 : 0);
        game.brickDamage[row * COLS + col] = (game.brickDamage[row * COLS + col] ?? 0) | (1 << quadrant);
      }
      if (tile === 'S' || bullet.steelBreak || game.brickDamage[row * COLS + col] === 15) {
        game.terrain[row][col] = '.'; delete game.brickDamage[row * COLS + col];
      }
      burst(game, bullet.x, bullet.y, '#b98c65', 5);
    }
    else burst(game, bullet.x, bullet.y, '#bed3c6', 3);
    if (breakable && bullet.pierce > 0) bullet.pierce--;
    else bullet.dead = true;
  }
  if (bullet.dead) return;
  const shooter = game.players.find(player => player.id === (bullet.shooterId ?? 'p1')) ?? game.player;
  if (bullet.owner === 'player') {
    for (const enemy of game.enemies) {
      if (enemy.dead || bullet.hitIds.includes(enemy.id) || Math.abs(bullet.x - enemy.x) > 14 || Math.abs(bullet.y - enemy.y) > 14) continue;
      damageEnemy(game, enemy, bullet.damage, shooter);
      bullet.hitIds.push(enemy.id);
      burst(game, bullet.x, bullet.y, '#ffd08a', 3);
      if (bullet.pierce > 0) bullet.pierce--;
      else { bullet.dead = true; break; }
    }
  }
  if (!bullet.dead) {
    for (const player of game.players) {
      if (player.dead || (bullet.owner === 'player' && player === shooter)
        || Math.abs(bullet.x - player.x) >= 14 || Math.abs(bullet.y - player.y) >= 14) continue;
      bullet.dead = true;
      if (bullet.owner === 'player') {
        player.stunned = Math.max(player.stunned, 1.5);
        player.vx = 0; player.vy = 0; player.dashTimer = 0;
        game.event = `${player.id.toUpperCase()} STUNNED // WATCH FRIENDLY FIRE`;
      } else if (player.invulnerable <= 0) {
        player.hp = Math.max(0, player.hp - bullet.damage);
        player.invulnerable = 0.9;
        game.hitFlash = 0.28; game.shake = Math.max(game.shake, 0.28);
        game.combo = 0; game.comboTimer = 0;
        burst(game, player.x, player.y, '#ff7065', 24, '', 'explosion');
        game.event = `${player.id.toUpperCase()} ARMOR HIT // KEEP MOVING`;
        if (player.hp <= 0) destroyPlayer(game, player);
      }
      break;
    }
  }
  if (!bullet.dead && Math.abs(bullet.x - game.base.x) < 23 && Math.abs(bullet.y - game.base.y) < 21) {
    bullet.dead = true;
    game.base.hp = 0;
    burst(game, game.base.x, game.base.y, '#ff7065', 32, 'SIGNAL LOST', 'explosion');
    game.shake = Math.max(game.shake, 0.3);
    game.event = 'HQ DESTROYED // SIGNAL LOST';
  }
}

function updateBullets(game, dt) {
  const fastest = Math.max(1, ...game.bullets.map(bullet => Math.hypot(bullet.dx, bullet.dy)));
  const steps = Math.max(1, Math.ceil(fastest * dt / 4));
  for (let step = 0; step < steps; step++) {
    for (const bullet of game.bullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.dx * dt / steps; bullet.y += bullet.dy * dt / steps;
    }
    for (let index = 0; index < game.bullets.length; index++) {
      const bullet = game.bullets[index];
      if (bullet.dead) continue;
      for (let next = index + 1; next < game.bullets.length; next++) {
        const other = game.bullets[next];
        if (other.dead || other.owner === bullet.owner || Math.hypot(other.x - bullet.x, other.y - bullet.y) > 7) continue;
        bullet.dead = true; other.dead = true;
        burst(game, bullet.x, bullet.y, '#d8f1d8', 4);
        break;
      }
    }
    for (const bullet of game.bullets) if (!bullet.dead) hitBullet(game, bullet);
  }
  game.bullets = game.bullets.filter(bullet => !bullet.dead);
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
}

function setHQWalls(game, type) {
  for (const [col, row] of HQ_WALLS) {
    game.terrain[row][col] = type;
    delete game.brickDamage[row * COLS + col];
  }
  for (const tank of [...game.players, ...game.enemies]) {
    if (tank.dead || canStand(game, tank.x, tank.y, tank)) continue;
    const point = freePosition(game, tank, tank.x, tank.y);
    if (point) { tank.x = point.x; tank.y = point.y; tank.vx = 0; tank.vy = 0; }
  }
}

function fortify(game) {
  game.fortifyTimer = 20;
  setHQWalls(game, 'S');
}

function updatePickups(game, dt) {
  for (const pickup of game.pickups) {
    pickup.life -= dt;
    const player = game.players.find(tank => !tank.dead && Math.hypot(pickup.x - tank.x, pickup.y - tank.y) <= 25);
    if (!player || pickup.life <= 0) continue;
    pickup.life = 0;
    addScore(game, player, 500);
    const rankGained = pickup.type === 'star' && player.level < 3;
    if (rankGained) {
      player.level++;
      player.rankFx = 1.6;
      player.invulnerable = Math.max(player.invulnerable, 2);
      game.rankUps++;
    }
    if (pickup.type === 'helmet') player.invulnerable = Math.max(player.invulnerable, 12);
    if (pickup.type === 'grenade') {
      for (const enemy of game.enemies) {
        if (enemy.x < 0 || enemy.x >= WIDTH || enemy.y < 0 || enemy.y >= HEIGHT) continue;
        dropCarrier(game, enemy); destroyEnemy(game, enemy, player);
      }
      game.enemies = game.enemies.filter(enemy => !enemy.dead);
      game.bullets = game.bullets.filter(bullet => bullet.owner === 'player');
    }
    if (pickup.type === 'timer') game.freezeTimer = 10;
    if (pickup.type === 'shovel') fortify(game);
    if (pickup.type === 'tank') player.lives++;
    const rankMessages = ['', 'GUNNER // FASTER SHELLS', 'TWIN // TWO ACTIVE SHELLS', 'SIEGE // BREAK STEEL'];
    burst(game, pickup.x, pickup.y, '#8df5ca', rankGained ? 16 : 8, rankGained ? rankMessages[player.level].split(' // ')[0] : `+${pickup.type.toUpperCase()}`);
    game.event = rankGained ? `${player.id.toUpperCase()} ${rankMessages[player.level]} // +500`
      : `${player.id.toUpperCase()} ${pickup.type.toUpperCase()} COLLECTED // +500`;
  }
  game.pickups = game.pickups.filter(pickup => pickup.life > 0);
}

function finishWave(game) {
  game.bullets = [];
  if (game.coop && game.players[0].stageKills !== game.players[1].stageKills) {
    const winner = game.players[0].stageKills > game.players[1].stageKills ? game.players[0] : game.players[1];
    addScore(game, winner, 1000);
    game.stageBonus[winner.id] = 1000;
  }
  if (game.mode === 'custom' || (game.mode === 'campaign' && game.wave >= MAPS.length)) {
    game.status = 'victory'; game.event = 'SECTOR SECURE // SIGNAL RESTORED'; return;
  }
  game.status = 'upgrade'; game.empCharges = Math.min(5, game.empCharges + 1);
  if (game.mode === 'campaign') {
    game.upgradeChoices = [];
    game.event = `STAGE ${String(game.wave).padStart(2, '0')} CLEARED // CONTINUE TO REARM`;
    return;
  }
  const choices = [...UPGRADES];
  for (let index = choices.length - 1; index > 0; index--) {
    const next = Math.floor(random(game) * (index + 1));
    [choices[index], choices[next]] = [choices[next], choices[index]];
  }
  game.upgradeChoices = choices.slice(0, 3);
  game.event = `STAGE ${String(game.wave).padStart(2, '0')} CLEARED // SELECT UPGRADE`;
}

export function chooseUpgrade(game, id) {
  if (game.mode !== 'endless' || game.status !== 'upgrade' || !game.upgradeChoices.some(choice => choice.id === id)) return false;
  for (const player of game.players.filter(tank => tank.lives > 0)) {
    if (id === 'rapid-fire') player.fireRate = Math.max(0.08, player.fireRate * 0.7);
    if (id === 'reinforced') { player.maxHp = Math.min(10, player.maxHp + 2); player.hp = player.maxHp; }
    if (id === 'overdrive') { player.speed = Math.min(360, player.speed * 1.2); player.dashRecharge = Math.max(0.8, player.dashRecharge * 0.75); }
    if (id === 'piercing') player.pierce = Math.min(2, player.pierce + 1);
  }
  game.upgrades.push(id);
  nextStage(game);
  if (id === 'repair') { fortify(game); game.empCharges = Math.min(5, game.empCharges + 1); }
  return true;
}

export function continueStage(game) {
  if (game.mode !== 'campaign' || game.status !== 'upgrade' || game.wave >= MAPS.length) return false;
  nextStage(game);
  return true;
}

function nextStage(game) {
  game.wave++; game.stage = game.wave;
  game.stageName = MAPS[(game.wave - 1) % MAPS.length].name;
  game.terrain = makeTerrain(game.wave);
  game.brickDamage = {};
  game.enemies = []; game.bullets = []; game.pickups = []; game.particles = [];
  game.freezeTimer = 0; game.fortifyTimer = 0; game.empFx = 0;
  game.waveTotal = 20; game.waveSpawned = 0; game.waveKills = 0; game.spawnTimer = 1.5; game.carrierDrops = 0;
  game.upgradeChoices = []; game.status = 'playing'; game.previousEmp = false;
  game.stageBonus = { p1: 0, p2: 0 };
  for (const player of game.players) {
    player.stageKills = 0; player.stunned = 0; player.vx = 0; player.vy = 0;
    player.rankFx = 0; player.dir = 0; player.hullAngle = -Math.PI / 2; player.aimAngle = -Math.PI / 2;
    player.dashTimer = 0; player.dashCooldown = 0; player.fireCooldown = 0; player.moving = false;
    if (player.lives <= 0) continue;
    player.hp = game.mode === 'campaign' || player.dead ? player.maxHp : Math.max(1, player.hp);
    player.dead = false; player.respawnTimer = 0;
    const point = freePosition(game, player);
    if (point) { player.x = point.x; player.y = point.y; }
    player.invulnerable = 2.5;
  }
  game.event = `STAGE ${String(game.wave).padStart(2, '0')} // ${game.stageName.toUpperCase()}`;
}

function updatePlayer(game, player, dt, input) {
  player.moving = false;
  for (const field of ['muzzleFlash', 'fireCooldown', 'dashCooldown', 'invulnerable', 'stunned', 'rankFx']) player[field] = Math.max(0, player[field] - dt);
  if (player.dead) {
    if (player.lives <= 0) return;
    player.respawnTimer = Math.max(0, player.respawnTimer - dt);
    if (player.respawnTimer > 0) return;
    const point = freePosition(game, player);
    if (!point) { player.respawnTimer = 0.1; return; }
    Object.assign(player, point, { dead: false, hp: player.maxHp, level: 0, invulnerable: 2.5, stunned: 0, vx: 0, vy: 0, fireCooldown: 0,
      rankFx: 0, dir: 0, hullAngle: -Math.PI / 2, aimAngle: -Math.PI / 2 });
    game.event = `${player.id.toUpperCase()} REDEPLOYED // SHIELD ACTIVE`;
  }
  if (player.stunned > 0) return;
  const directions = [input.up && !input.down, input.right && !input.left, input.down && !input.up, input.left && !input.right];
  const dir = directions[player.dir] ? player.dir : directions.findIndex(Boolean);
  const moving = dir >= 0;
  if (moving) {
    const [dx, dy] = DIRECTIONS[dir];
    const onIce = game.terrain[Math.floor(player.y / TILE)]?.[Math.floor(player.x / TILE)] === 'I';
    if (dir % 2 !== player.dir % 2 && !onIce && !canStand(game, player.x + dx * RADIUS, player.y + dy * RADIUS, player)) {
      const x = dx ? player.x : Math.floor(player.x / TILE) * TILE + TILE / 2;
      const y = dy ? player.y : Math.floor(player.y / TILE) * TILE + TILE / 2;
      if (Math.hypot(x - player.x, y - player.y) <= TILE / 2
        && canStand(game, x, y, player) && canStand(game, x + dx * RADIUS, y + dy * RADIUS, player)) {
        player.x = x; player.y = y;
      }
    }
    player.dir = dir;
    player.hullAngle = Math.atan2(DIRECTIONS[dir][1], DIRECTIONS[dir][0]);
  }
  if (input.dash && player.dashCooldown === 0) {
    player.dashTimer = 0.16; player.dashCooldown = player.dashRecharge;
    player.invulnerable = Math.max(player.invulnerable, 0.28);
    burst(game, player.x, player.y, '#8df5ca', 6);
  }
  const dashTime = Math.min(dt, player.dashTimer);
  const distance = player.speed * (moving ? dt + dashTime * 2.5 : dashTime * 3.5);
  player.moving = motion(game, player, Math.cos(player.hullAngle) * distance / dt, Math.sin(player.hullAngle) * distance / dt, dt) > 0.001;
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
    if (input.aimX !== player.x || input.aimY !== player.y) player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  } else player.aimAngle = player.hullAngle;
  if (input.fire && player.fireCooldown === 0 && shoot(game, player, 'player')) player.fireCooldown = player.fireRate;
}

function enemyType(stage, ordinal) {
  if (stage === 1) return ordinal >= 19 ? 'scout' : 'basic';
  if (stage >= 4 && ordinal % 6 === 0) return 'power';
  if (ordinal % (stage >= 10 ? 4 : 10) === 0) return 'heavy';
  return ordinal % 5 === 0 ? 'scout' : 'basic';
}

export function updateGame(game, dt, input = {}) {
  if (game.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
  dt = Math.min(dt, 0.05);
  game.time += dt;
  for (const field of ['shake', 'hitFlash', 'empFx', 'comboTimer', 'freezeTimer']) game[field] = Math.max(0, game[field] - dt);
  if (game.comboTimer === 0) game.combo = 0;
  if (game.fortifyTimer > 0) {
    game.fortifyTimer = Math.max(0, game.fortifyTimer - dt);
    if (game.fortifyTimer === 0) setHQWalls(game, '#');
  }
  for (const [index, player] of game.players.entries()) updatePlayer(game, player, dt, index === 0 ? input : input.p2 ?? {});
  if (input.emp && !game.previousEmp) activateEmp(game);
  game.previousEmp = !!input.emp;
  game.spawnTimer -= dt;
  if (game.waveSpawned < game.waveTotal && game.spawnTimer <= 0 && game.enemies.length < (game.coop ? 6 : 4)) {
    const candidates = game.spawnPoints.filter(point => canStand(game, point.x, point.y, null));
    if (candidates.length) {
      const preferred = game.spawnPoints[[0, 2, 1][game.waveSpawned % 3]];
      const point = candidates.includes(preferred) ? preferred : candidates[0];
      const ordinal = game.waveSpawned + 1;
      const type = enemyType(game.wave, ordinal);
      game.enemies.push(makeEnemy(game, point, type, ordinal));
      game.waveSpawned++;
      game.spawnTimer = Math.max(1.6, 2.4 - Math.min(34, game.wave - 1) * (0.8 / 34));
      burst(game, point.x, point.y, '#ffb25b', 5);
    }
  }
  updateEnemies(game, dt); updateBullets(game, dt); updatePickups(game, dt);
  for (const particle of game.particles) {
    particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt;
  }
  game.particles = game.particles.filter(particle => particle.life > 0).slice(-320);
  if (game.base.hp <= 0 || game.players.every(player => player.lives <= 0)) {
    game.status = 'gameover'; game.event = game.base.hp <= 0 ? 'SIGNAL LOST // HQ DESTROYED' : 'SIGNAL LOST // ALL TANKS LOST';
  } else if (game.waveSpawned >= game.waveTotal && game.enemies.length === 0) finishWave(game);
  return game;
}

export function snapshot(game) {
  const copy = JSON.parse(JSON.stringify(game));
  if (copy.players) copy.player = copy.players[0];
  return copy;
}
