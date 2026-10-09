export const WIDTH = 960;
export const HEIGHT = 672;
export const TILE = 32;
export const COLS = WIDTH / TILE;
export const ROWS = HEIGHT / TILE;

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const RADIUS = 11;
const ENEMY = {
  scout: { hp: 1, speed: 110, fireRate: 1.4, points: 100 },
  striker: { hp: 2, speed: 80, fireRate: 1.15, points: 200 },
  heavy: { hp: 4, speed: 54, fireRate: 1.65, points: 400 },
};
const UPGRADES = [
  { id: 'rapid-fire', name: 'Rapid fire', description: 'Fire 30% faster. Keep the pressure on.', icon: '»' },
  { id: 'reinforced', name: 'Reactive armor', description: '+2 maximum armor. Fully repairs your tank.', icon: '◈' },
  { id: 'overdrive', name: 'Overdrive', description: '+20% movement. Dash recharges 25% faster.', icon: '↗' },
  { id: 'piercing', name: 'Rail rounds', description: 'Shots punch through one extra target or wall.', icon: '↯' },
  { id: 'repair', name: 'Field engineer', description: 'Repair HQ by 2 and gain an extra EMP charge.', icon: '+' },
];

function random(game) {
  game.rng = (Math.imul(game.rng, 1664525) + 1013904223) >>> 0;
  return game.rng / 4294967296;
}

function makeTerrain() {
  const terrain = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  function block(x, y, w, h, type) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) terrain[row][col] = type;
    }
  }
  block(0, 0, COLS, 1, 'S');
  block(0, ROWS - 1, COLS, 1, 'S');
  block(0, 0, 1, ROWS, 'S');
  block(COLS - 1, 0, 1, ROWS, 'S');
  for (const x of [2, 13, 24]) block(x, 0, 4, 1, '.');
  for (const x of [3, 8, 19, 24]) {
    block(x, 3, 3, 3, '#');
    block(x, 14, 3, 3, '#');
  }
  block(8, 4, 3, 1, '.');
  block(19, 4, 3, 1, '.');
  for (const x of [3, 10, 18, 25]) block(x, 7, 2, 1, 'S');
  for (const x of [5, 22]) block(x, 9, 3, 3, '~');
  for (const x of [11, 17]) block(x, 10, 2, 2, '#');
  block(14, 8, 2, 1, 'S');
  block(14, 12, 2, 1, 'S');
  for (const x of [2, 25]) block(x, 11, 3, 2, '%');
  for (const x of [12, 17]) block(x, 2, 1, 3, '%');
  block(12, 15, 1, 2, '%');
  block(17, 15, 1, 2, '%');
  block(13, 18, 4, 1, '#');
  block(13, 19, 1, 1, '#');
  block(16, 19, 1, 1, '#');
  return terrain;
}

export function createGame({ mode = 'campaign', seed = 1 } = {}) {
  const game = {
    mode: mode === 'endless' ? 'endless' : 'campaign',
    seed: Number(seed) >>> 0,
    rng: Number(seed) >>> 0,
    status: 'ready', wave: 1, score: 0, kills: 0, combo: 0, comboTimer: 0, time: 0,
    player: {
      x: 112, y: 592, dir: 0, hp: 4, maxHp: 4, speed: 220,
      hullAngle: -Math.PI / 2, aimAngle: -Math.PI / 2, moving: false,
      fireCooldown: 0, fireRate: 0.14, dashCooldown: 0, dashRecharge: 2.1,
      dashTimer: 0, invulnerable: 0, pierce: 0, shotCount: 0, muzzleFlash: 0,
    },
    base: { x: 480, y: 624, hp: 5, maxHp: 5 },
    enemies: [], bullets: [], particles: [], pickups: [], terrain: makeTerrain(),
    spawnPoints: [{ x: 112, y: 48 }, { x: 496, y: 48 }, { x: 848, y: 48 }],
    waveTotal: 12, waveSpawned: 0, waveKills: 0, spawnTimer: 0.6,
    upgrades: [], upgradeChoices: [], empCharges: 2, empFx: 0, empRadius: 280,
    nextId: 1, event: 'DEFEND THE SIGNAL', previousEmp: false,
    shots: 0, empCount: 0, shake: 0, hitFlash: 0,
  };
  for (const [index, point] of [
    { x: 112, y: 80 }, { x: 304, y: 240 }, { x: 496, y: 144 },
    { x: 656, y: 240 }, { x: 848, y: 80 },
  ].entries()) {
    const type = ['scout', 'striker', 'heavy', 'striker', 'scout'][index];
    game.enemies.push(makeEnemy(game, point, type));
  }
  return game;
}

export function startGame(game) {
  const fresh = createGame({ mode: game.mode, seed: game.seed });
  Object.assign(game, fresh, { status: 'playing', enemies: [], nextId: 1, event: 'WAVE 01 // CONTACT INBOUND' });
  return game;
}

export function togglePause(game) {
  if (game.status === 'playing') game.status = 'paused';
  else if (game.status === 'paused') game.status = 'playing';
  return game;
}

function makeEnemy(game, point, type) {
  return {
    id: game.nextId++, x: point.x, y: point.y, dir: 2, type,
    hp: ENEMY[type].hp, maxHp: ENEMY[type].hp, speed: ENEMY[type].speed,
    fireCooldown: 0.4 + random(game), stunned: 0,
    routeDir: 2, routeDistance: 0, flash: 0, moving: false,
    hullAngle: Math.PI / 2, aimAngle: Math.PI / 2, shotCount: 0, muzzleFlash: 0,
  };
}

function solid(game, x, y) {
  const type = game.terrain[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
  return type === undefined || type === '#' || type === 'S' || type === '~';
}

function canStand(game, x, y) {
  return !solid(game, x - RADIUS, y - RADIUS)
    && !solid(game, x + RADIUS, y - RADIUS)
    && !solid(game, x - RADIUS, y + RADIUS)
    && !solid(game, x + RADIUS, y + RADIUS);
}

function moveTank(game, tank, dx, dy, distance) {
  const steps = Math.max(1, Math.ceil(distance / 5));
  const startX = tank.x;
  const startY = tank.y;
  for (let step = 0; step < steps; step++) {
    const amount = distance / steps;
    const x = tank.x + dx * amount;
    if (canStand(game, x, tank.y)) tank.x = x;
    const y = tank.y + dy * amount;
    if (canStand(game, tank.x, y)) tank.y = y;
  }
  return Math.hypot(tank.x - startX, tank.y - startY);
}

function shoot(game, tank, owner) {
  const angle = owner === 'player' && Number.isFinite(tank.aimAngle)
    ? tank.aimAngle : Math.atan2(DIRECTIONS[tank.dir][1], DIRECTIONS[tank.dir][0]);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const speed = owner === 'player' ? 700 : 240;
  tank.aimAngle = angle;
  tank.shotCount = (tank.shotCount ?? 0) + 1;
  tank.muzzleFlash = 0.075;
  game.shots++;
  if (owner === 'player') game.shake = Math.max(game.shake, 0.035);
  game.bullets.push({
    x: tank.x + dx * 17, y: tank.y + dy * 17,
    dx: dx * speed, dy: dy * speed,
    owner, damage: 1, pierce: owner === 'player' ? game.player.pierce : 0, hitIds: [],
  });
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

function destroyEnemy(game, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  game.kills++;
  game.waveKills++;
  game.combo = game.comboTimer > 0 ? Math.min(5, game.combo + 1) : 1;
  game.comboTimer = 4;
  const points = ENEMY[enemy.type].points * game.combo;
  game.score += points;
  burst(game, enemy.x, enemy.y, '#ffb25b', 28, `+${points}`, 'explosion');
  game.shake = Math.max(game.shake, 0.14);
  if (game.kills % 3 === 0) {
    const types = ['repair', 'credits', 'base', 'charge'];
    game.pickups.push({ x: enemy.x, y: enemy.y, type: types[Math.floor(random(game) * types.length)], life: 20 });
  }
  game.event = game.combo > 1 ? `${game.combo}× CHAIN // +${points}` : `${enemy.type.toUpperCase()} ELIMINATED // +${points}`;
}

export function activateEmp(game) {
  if (game.status !== 'playing' || game.empCharges <= 0) return false;
  game.empCharges--;
  game.empCount++;
  game.empFx = 0.7;
  game.shake = Math.max(game.shake, 0.2);
  for (const enemy of game.enemies) {
    if (Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) > game.empRadius) continue;
    enemy.hp -= 2;
    enemy.stunned = 2;
    enemy.flash = 0.2;
    burst(game, enemy.x, enemy.y, '#8df5ca', 5);
    if (enemy.hp <= 0) destroyEnemy(game, enemy);
  }
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
  game.bullets = game.bullets.filter(bullet => bullet.owner === 'player'
    || Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y) > game.empRadius);
  game.event = 'EMP DISCHARGED // SYSTEMS DISRUPTED';
  return true;
}

function routeDirection(game, enemy, target) {
  const startCol = Math.floor(enemy.x / TILE);
  const startRow = Math.floor(enemy.y / TILE);
  const endCol = Math.floor(target.x / TILE);
  const endRow = Math.floor(target.y / TILE);
  const queue = [[startCol, startRow, -1]];
  const visited = new Set([startRow * COLS + startCol]);
  for (let index = 0; index < queue.length; index++) {
    const [col, row, firstDir] = queue[index];
    if (col === endCol && row === endRow && firstDir !== -1) return firstDir;
    const order = enemy.id % 2 ? [2, 1, 3, 0] : [2, 3, 1, 0];
    for (const dir of order) {
      const [dx, dy] = DIRECTIONS[dir];
      const nextCol = col + dx;
      const nextRow = row + dy;
      const key = nextRow * COLS + nextCol;
      if (nextCol < 1 || nextCol >= COLS - 1 || nextRow < 1 || nextRow >= ROWS - 1 || visited.has(key)) continue;
      const tile = game.terrain[nextRow][nextCol];
      if (tile === 'S' || tile === '~') continue;
      visited.add(key);
      queue.push([nextCol, nextRow, firstDir === -1 ? dir : firstDir]);
    }
  }
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
}

function updateEnemies(game, dt) {
  const playerInBrush = game.terrain[Math.floor(game.player.y / TILE)]?.[Math.floor(game.player.x / TILE)] === '%';
  for (const enemy of game.enemies) {
    enemy.moving = false;
    enemy.muzzleFlash = Math.max(0, (enemy.muzzleFlash ?? 0) - dt);
    enemy.fireCooldown -= dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.stunned = Math.max(0, enemy.stunned - dt);
    if (enemy.stunned > 0 || enemy.dead) continue;
    const hiddenPlayer = playerInBrush && Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y) > 160;
    const target = enemy.type === 'scout' && !hiddenPlayer ? game.player : game.base;
    const nearTarget = (Math.abs(target.x - enemy.x) < 17 || Math.abs(target.y - enemy.y) < 17)
      && Math.hypot(target.x - enemy.x, target.y - enemy.y) < 56;
    if (!nearTarget) {
      if (enemy.routeDistance <= 0.01) {
        enemy.routeDir = routeDirection(game, enemy, target);
        const [dx, dy] = DIRECTIONS[enemy.routeDir];
        enemy.routeDistance = dx
          ? Math.abs((Math.floor(enemy.x / TILE) + dx + 0.5) * TILE - enemy.x)
          : Math.abs((Math.floor(enemy.y / TILE) + dy + 0.5) * TILE - enemy.y);
      }
      enemy.dir = enemy.routeDir;
      enemy.hullAngle = Math.atan2(DIRECTIONS[enemy.dir][1], DIRECTIONS[enemy.dir][0]);
      const distance = Math.min(enemy.routeDistance, enemy.speed * dt);
      const [moveX, moveY] = DIRECTIONS[enemy.dir];
      const moved = moveTank(game, enemy, moveX, moveY, distance);
      enemy.moving = moved > 0.001;
      enemy.routeDistance -= moved;
      if (moved < distance * 0.8) enemy.routeDistance = 0;
    }

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const aligned = Math.abs(dx) < 17 || Math.abs(dy) < 17;
    enemy.aimAngle = aligned
      ? (Math.abs(dx) < 17 ? (dy > 0 ? Math.PI / 2 : -Math.PI / 2) : (dx > 0 ? 0 : Math.PI))
      : enemy.hullAngle;
    if (enemy.fireCooldown <= 0) {
      if (aligned) enemy.dir = Math.abs(dx) < 17 ? (dy > 0 ? 2 : 0) : (dx > 0 ? 1 : 3);
      shoot(game, enemy, 'enemy');
      enemy.fireCooldown = ENEMY[enemy.type].fireRate * Math.max(0.6, 1 - (game.wave - 1) * 0.06);
    }
  }
}

function hitBullet(game, bullet) {
  const col = Math.floor(bullet.x / TILE);
  const row = Math.floor(bullet.y / TILE);
  const tile = game.terrain[row]?.[col];
  if (tile === undefined) { bullet.dead = true; return; }
  if (tile === '#' || tile === 'S') {
    if (tile === '#') {
      game.terrain[row][col] = '.';
      burst(game, bullet.x, bullet.y, '#b98c65', 4);
    } else burst(game, bullet.x, bullet.y, '#bed3c6', 3);
    if (tile === '#' && bullet.pierce > 0) bullet.pierce--;
    else bullet.dead = true;
  }
  if (bullet.dead) return;
  if (bullet.owner === 'player') {
    for (const enemy of game.enemies) {
      if (enemy.dead || bullet.hitIds.includes(enemy.id) || Math.abs(bullet.x - enemy.x) > 14 || Math.abs(bullet.y - enemy.y) > 14) continue;
      enemy.hp -= bullet.damage;
      enemy.flash = 0.12;
      bullet.hitIds.push(enemy.id);
      burst(game, bullet.x, bullet.y, '#ffd08a', 3);
      if (enemy.hp <= 0) destroyEnemy(game, enemy);
      if (bullet.pierce > 0) bullet.pierce--;
      else { bullet.dead = true; break; }
    }
  } else {
    const player = game.player;
    if (Math.abs(bullet.x - player.x) < 14 && Math.abs(bullet.y - player.y) < 14) {
      bullet.dead = true;
      if (player.invulnerable <= 0) {
        player.hp = Math.max(0, player.hp - bullet.damage);
        player.invulnerable = 0.9;
        game.hitFlash = 0.28;
        game.shake = Math.max(game.shake, 0.28);
        game.combo = 0;
        game.comboTimer = 0;
        burst(game, player.x, player.y, '#ff7065', 24, '', 'explosion');
        game.event = 'ARMOR HIT // KEEP MOVING';
      }
    }
    if (!bullet.dead && Math.abs(bullet.x - game.base.x) < 23 && Math.abs(bullet.y - game.base.y) < 21) {
      bullet.dead = true;
      game.base.hp = Math.max(0, game.base.hp - bullet.damage);
      burst(game, game.base.x, game.base.y, '#ff7065', 28, '', 'explosion');
      game.shake = Math.max(game.shake, 0.3);
      game.event = 'HQ UNDER FIRE // PROTECT THE SIGNAL';
    }
  }
}

function updateBullets(game, dt) {
  for (const bullet of game.bullets) {
    const steps = Math.max(1, Math.ceil(Math.hypot(bullet.dx, bullet.dy) * dt / 6));
    for (let step = 0; step < steps && !bullet.dead; step++) {
      bullet.x += bullet.dx * dt / steps;
      bullet.y += bullet.dy * dt / steps;
      hitBullet(game, bullet);
    }
  }
  game.bullets = game.bullets.filter(bullet => !bullet.dead);
  game.enemies = game.enemies.filter(enemy => !enemy.dead);
}

function updatePickups(game, dt) {
  for (const pickup of game.pickups) {
    pickup.life -= dt;
    if (Math.hypot(pickup.x - game.player.x, pickup.y - game.player.y) > 25) continue;
    pickup.life = 0;
    if (pickup.type === 'repair') game.player.hp = Math.min(game.player.maxHp, game.player.hp + 2);
    if (pickup.type === 'base') game.base.hp = Math.min(game.base.maxHp, game.base.hp + 1);
    if (pickup.type === 'charge') game.empCharges = Math.min(5, game.empCharges + 1);
    if (pickup.type === 'credits') game.score += 500;
    burst(game, pickup.x, pickup.y, '#8df5ca', 6, pickup.type === 'credits' ? '+500' : '+SUPPLY');
    game.event = `${pickup.type.toUpperCase()} SUPPLY COLLECTED`;
  }
  game.pickups = game.pickups.filter(pickup => pickup.life > 0);
}

function finishWave(game) {
  game.bullets = [];
  if (game.mode === 'campaign' && game.wave >= 5) {
    game.status = 'victory';
    game.score += game.base.hp * 500 + game.player.hp * 250;
    game.event = 'SECTOR SECURE // SIGNAL RESTORED';
    return;
  }
  game.status = 'upgrade';
  game.empCharges = Math.min(5, game.empCharges + 1);
  const choices = [...UPGRADES];
  for (let index = choices.length - 1; index > 0; index--) {
    const next = Math.floor(random(game) * (index + 1));
    [choices[index], choices[next]] = [choices[next], choices[index]];
  }
  game.upgradeChoices = choices.slice(0, 3);
  game.event = `WAVE ${String(game.wave).padStart(2, '0')} CLEARED // SELECT UPGRADE`;
}

export function chooseUpgrade(game, id) {
  if (game.status !== 'upgrade' || !game.upgradeChoices.some(choice => choice.id === id)) return false;
  if (id === 'rapid-fire') game.player.fireRate = Math.max(0.08, game.player.fireRate * 0.7);
  if (id === 'reinforced') { game.player.maxHp += 2; game.player.hp = game.player.maxHp; }
  if (id === 'overdrive') { game.player.speed *= 1.2; game.player.dashRecharge *= 0.75; }
  if (id === 'piercing') game.player.pierce++;
  if (id === 'repair') { game.base.hp = Math.min(game.base.maxHp, game.base.hp + 2); game.empCharges = Math.min(5, game.empCharges + 1); }
  game.upgrades.push(id);
  game.wave++;
  game.waveTotal = 9 + game.wave * 3;
  game.waveSpawned = 0;
  game.waveKills = 0;
  game.spawnTimer = 1.2;
  game.upgradeChoices = [];
  game.status = 'playing';
  game.player.invulnerable = 1.5;
  game.event = `WAVE ${String(game.wave).padStart(2, '0')} // HOSTILES INBOUND`;
  return true;
}

export function updateGame(game, dt, input = {}) {
  if (game.status !== 'playing') return game;
  if (!Number.isFinite(dt) || dt <= 0) return game;
  dt = Math.min(dt, 0.05);
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt);
  game.hitFlash = Math.max(0, game.hitFlash - dt);
  game.empFx = Math.max(0, game.empFx - dt);
  game.comboTimer = Math.max(0, game.comboTimer - dt);
  if (game.comboTimer === 0) game.combo = 0;
  const player = game.player;
  player.moving = false;
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  const moveX = Number(!!input.right) - Number(!!input.left);
  const moveY = Number(!!input.down) - Number(!!input.up);
  const moving = moveX !== 0 || moveY !== 0;
  if (moving) {
    player.hullAngle = Math.atan2(moveY, moveX);
    player.dir = Math.abs(moveX) > Math.abs(moveY) ? (moveX > 0 ? 1 : 3) : (moveY > 0 ? 2 : 0);
  }
  if (input.dash && player.dashCooldown === 0) {
    player.dashTimer = 0.16;
    player.dashCooldown = player.dashRecharge;
    player.invulnerable = Math.max(player.invulnerable, 0.28);
    burst(game, player.x, player.y, '#8df5ca', 6);
  }
  if (moving || player.dashTimer > 0) {
    const dashTime = Math.min(dt, player.dashTimer);
    const distance = player.speed * (moving ? dt + dashTime * 2.5 : dashTime * 3.5);
    player.moving = moveTank(game, player, Math.cos(player.hullAngle), Math.sin(player.hullAngle), distance) > 0.001;
  }
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
    if (input.aimX !== player.x || input.aimY !== player.y) player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  } else if (moving) player.aimAngle = player.hullAngle;
  if (input.fire && player.fireCooldown === 0) {
    shoot(game, player, 'player');
    player.fireCooldown = player.fireRate;
  }
  if (input.emp && !game.previousEmp) activateEmp(game);
  game.previousEmp = !!input.emp;

  game.spawnTimer -= dt;
  if (game.waveSpawned < game.waveTotal && game.spawnTimer <= 0 && game.enemies.length < 8) {
    const candidates = game.spawnPoints.filter(point => !game.enemies.some(enemy => Math.hypot(enemy.x - point.x, enemy.y - point.y) < 45));
    if (candidates.length) {
      const point = candidates[Math.floor(random(game) * candidates.length)];
      const roll = random(game);
      const type = roll < 0.18 + Math.min(0.2, game.wave * 0.035) ? 'heavy' : roll < 0.65 ? 'striker' : 'scout';
      game.enemies.push(makeEnemy(game, point, type));
      game.waveSpawned++;
      game.spawnTimer = Math.max(0.55, 1.15 - game.wave * 0.09);
      burst(game, point.x, point.y, '#ffb25b', 5);
    }
  }
  updateEnemies(game, dt);
  updateBullets(game, dt);
  updatePickups(game, dt);
  for (const particle of game.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  game.particles = game.particles.filter(particle => particle.life > 0).slice(-240);
  if (player.hp <= 0 || game.base.hp <= 0) {
    game.status = 'gameover';
    game.event = game.base.hp <= 0 ? 'SIGNAL LOST // HQ DESTROYED' : 'SIGNAL LOST // TANK DISABLED';
  } else if (game.waveSpawned >= game.waveTotal && game.enemies.length === 0) finishWave(game);
  return game;
}

export function snapshot(game) {
  return JSON.parse(JSON.stringify(game));
}
