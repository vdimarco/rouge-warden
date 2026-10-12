import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, updateGame, togglePause, chooseUpgrade, continueStage, activateEmp, snapshot, TILE, WIDTH } from './engine.js';
import { MAPS, makeTerrain, validateMap } from './maps.js';

function isolated(options = {}) {
  const game = startGame(createGame(options));
  game.spawnTimer = 999;
  game.terrain = Array.from({ length: 21 }, () => Array(30).fill('.'));
  for (const player of game.players) player.invulnerable = 0;
  return game;
}
function step(game, seconds, input = {}, dt = 0.02) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) updateGame(game, Math.min(dt, seconds - elapsed), input);
}
function shell(game, values = {}) {
  game.bullets.push({ x: 400, y: 300, dx: 0, dy: 0, owner: 'player', shooterId: 'p1', damage: 1, pierce: 0, steelBreak: false, hitIds: [], ...values });
}
function enemy(type = 'basic', x = 400, y = 300, id = 1) {
  return { ...createGame().enemies.find(tank => tank.type === type), x, y, id, stunned: 999 };
}
function collect(game, type, player = game.player) {
  game.pickups.push({ x: player.x, y: player.y, type, life: 25 });
  updateGame(game, 0.01);
}
function hitPlayer(game, player = game.player) {
  player.invulnerable = 0;
  shell(game, { x: player.x, y: player.y, owner: 'enemy' });
  updateGame(game, 0.01);
}

function reachableCells(game, player, maxSteps = 6) {
  const start = [Math.floor(player.x / TILE), Math.floor(player.y / TILE), 0];
  const queue = [start], visited = new Set([start[1] * 30 + start[0]]);
  for (const [col, row, steps] of queue) {
    if (steps >= maxSteps) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nextCol = col + dx, nextRow = row + dy, key = nextRow * 30 + nextCol;
      const x = nextCol * TILE + 16, y = nextRow * TILE + 16;
      if (visited.has(key) || !['.', '%', 'I'].includes(game.terrain[nextRow]?.[nextCol])
        || (Math.abs(x - game.base.x) < 34 && Math.abs(y - game.base.y) < 30)
        || [...game.players, ...game.enemies].some(tank => tank !== player && !tank.dead
          && Math.abs(tank.x - x) < 22 && Math.abs(tank.y - y) < 22)) continue;
      visited.add(key); queue.push([nextCol, nextRow, steps + 1]);
    }
  }
  return visited;
}

test('35 fresh maps, deterministic games, stage selection and validated custom maps', () => {
  assert.equal(MAPS.length, 35);
  assert.equal(new Set(MAPS.map(map => JSON.stringify(map.terrain))).size, 35);
  assert.ok(MAPS.every(map => validateMap(map.terrain)));
  assert.deepEqual(createGame({ seed: 42 }), createGame({ seed: 42 }));
  const selected = startGame(createGame({ stage: 17, coop: true }));
  assert.equal(selected.wave, 17);
  assert.equal(selected.stageName, MAPS[16].name);
  assert.equal(selected.waveTotal, 20);
  assert.equal(selected.players.length, 2);
  assert.equal(selected.player, selected.players[0]);
  assert.equal(selected.base.hp, 1);
  assert.throws(() => createGame({ customMap: [['?']] }), /Invalid/);
  const customMap = makeTerrain(3), custom = createGame({ customMap });
  custom.terrain[10][10] = '#';
  assert.notEqual(custom.terrain, customMap);
  assert.equal(custom.mode, 'custom');
  selected.score = 1000; selected.player.level = 3; selected.player.lives = 1;
  startGame(selected);
  assert.equal(selected.wave, 17);
  assert.equal(selected.score, 0);
  assert.equal(selected.player.level, 0);
  assert.equal(selected.player.lives, 3);
  assert.equal(selected.enemies.length, 0);
  const copy = snapshot(selected);
  assert.equal(copy.player, copy.players[0]);
  copy.player.hp = 99;
  assert.equal(selected.player.hp, 4);
});

test('cardinal movement retains a held axis, respects walls and tanks, and supports deliberate pointer aim', () => {
  const game = isolated();
  Object.assign(game.player, { x: 336, y: 336 });
  updateGame(game, 0.05, { up: true, right: true });
  assert.ok(Math.abs(Math.hypot(game.player.x - 336, game.player.y - 336) - 8) < 1e-9);
  assert.equal(game.player.x, 336); assert.equal(game.player.hullAngle, -Math.PI / 2);
  assert.equal(game.player.aimAngle, game.player.hullAngle);
  updateGame(game, 0.05, { right: true });
  const heldY = game.player.y;
  updateGame(game, 0.05, { up: true, right: true });
  assert.equal(game.player.dir, 1); assert.equal(game.player.y, heldY);
  const point = { x: game.player.x, y: game.player.y };
  updateGame(game, 0.05, { up: true, down: true, left: true, right: true });
  assert.equal(game.player.x, point.x); assert.equal(game.player.y, point.y);
  Object.assign(game.player, { x: 116, y: 112 });
  for (let row = 1; row < 10; row++) game.terrain[row][4] = 'S';
  updateGame(game, 0.05, { up: true, right: true });
  assert.equal(game.player.y, 112, 'A held blocked axis does not turn into diagonal wall sliding');
  updateGame(game, 0.05, { up: true });
  assert.ok(game.player.x <= 117 && game.player.y < 112);
  updateGame(game, 0.05, { right: true, dash: true });
  assert.ok(game.player.x <= 117);
  assert.equal(game.player.moving, false);
  const coop = isolated({ coop: true });
  Object.assign(coop.player, { x: 112, y: 112 });
  Object.assign(coop.players[1], { x: 144, y: 112 });
  step(coop, 0.4, { right: true });
  assert.ok(coop.players[1].x - coop.player.x >= 22);
  for (const [aimX, aimY, dx, dy] of [[500, 400, 700, 0], [400, 300, 0, -700], [0, 400, -700, 0], [500, 500, 700 / Math.SQRT2, 700 / Math.SQRT2]]) {
    const aimed = isolated(); Object.assign(aimed.player, { x: 400, y: 400 });
    updateGame(aimed, 0.02, { aimX, aimY, fire: true });
    assert.ok(Math.abs(aimed.bullets[0].dx - dx) < 1e-9 && Math.abs(aimed.bullets[0].dy - dy) < 1e-9);
  }
  const aimed = isolated(); Object.assign(aimed.player, { x: 400, y: 400 });
  updateGame(aimed, 0.02, { right: true, aimX: 0, aimY: 400, fire: true });
  assert.equal(aimed.player.hullAngle, 0); assert.equal(aimed.player.aimAngle, Math.PI);
  updateGame(aimed, 0.02, { aimX: NaN, aimY: Infinity });
  assert.equal(aimed.player.aimAngle, aimed.player.hullAngle, 'Keyboard fire returns to the hull after click aim ends');
  updateGame(aimed, NaN, { right: true });
  assert.ok(Number.isFinite(aimed.player.x));
});

test('a blocked perpendicular turn centers within its corridor without crossing walls, tanks or ice', () => {
  const corridor = (coop = false) => {
    const game = isolated({ coop });
    game.terrain = game.terrain.map(row => row.map(() => 'S'));
    for (let row = 1; row < 20; row++) game.terrain[row][3] = '.';
    for (let col = 1; col < 29; col++) game.terrain[10][col] = '.';
    Object.assign(game.player, { x: 112, y: 342 });
    return game;
  };
  const assisted = corridor(); updateGame(assisted, 0.05, { right: true });
  assert.equal(assisted.player.y, 336); assert.equal(assisted.player.x, 120);
  step(assisted, 0.2, { right: true }); assert.ok(assisted.player.x > 144);
  const wall = corridor(); wall.terrain[10][4] = 'S'; updateGame(wall, 0.05, { right: true });
  assert.equal(wall.player.y, 342);
  const occupied = corridor(true); Object.assign(occupied.players[1], { x: 144, y: 336 });
  updateGame(occupied, 0.05, { right: true }); assert.equal(occupied.player.y, 342);
  const ice = corridor(); ice.terrain[10][3] = 'I'; updateGame(ice, 0.05, { right: true });
  assert.equal(ice.player.y, 342);
  const open = isolated(); Object.assign(open.player, { x: 112, y: 342 });
  updateGame(open, 0.05, { right: true }); assert.equal(open.player.y, 342);
});

test('dash integrates exactly 0.16 seconds with a 2.1 second recharge', () => {
  for (const dt of [0.05, 0.02, 1 / 120]) {
    const game = isolated(); Object.assign(game.player, { x: 336, y: 336 });
    updateGame(game, dt, { right: true, dash: true });
    assert.equal(game.player.dashCooldown, 2.1);
    step(game, 0.2, {}, dt);
    assert.ok(Math.abs(game.player.x - 336 - 160 * 3.5 * 0.16) < 1e-8);
    assert.equal(game.player.dashTimer, 0);
    updateGame(game, dt, { dash: true }); assert.equal(game.player.dashTimer, 0);
    step(game, 2.2, {}, dt);
    updateGame(game, dt, { dash: true }); assert.ok(game.player.dashTimer > 0);
  }
});

test('partial bricks retain four quadrants, holes pass shells but not wide tanks', () => {
  const game = isolated(); game.terrain[3][4] = '#';
  shell(game, { x: 126, y: 104, dx: 700 }); updateGame(game, 0.05);
  assert.equal(game.brickDamage[3 * 30 + 4], 1); assert.equal(game.terrain[3][4], '#');
  shell(game, { x: 126, y: 104, dx: 700 }); updateGame(game, 0.05);
  assert.equal(game.brickDamage[3 * 30 + 4], 3);
  Object.assign(game.player, { x: 112, y: 104 }); step(game, 0.2, { right: true });
  assert.ok(game.player.x <= 117, 'A 22px tank cannot fit a 16px opening');
  for (let hit = 0; hit < 2; hit++) { shell(game, { x: 126, y: 120, dx: 700 }); updateGame(game, 0.05); }
  assert.equal(game.terrain[3][4], '.'); assert.equal(game.brickDamage[94], undefined);
  step(game, 0.2, { right: true }); assert.ok(game.player.x > 128);
});

test('fast shells sweep steel and tanks, pierce once per tank, and opposing bullets cancel', () => {
  const steel = isolated(); steel.terrain[3][4] = 'S';
  shell(steel, { x: 126, y: 112, dx: 950 }); updateGame(steel, 0.05);
  assert.equal(steel.bullets.length, 0); assert.equal(steel.terrain[3][4], 'S');
  const game = isolated(); const first = enemy('heavy', 112, 112), second = enemy('heavy', 144, 112, 2);
  game.enemies = [first, second];
  shell(game, { x: 92, y: 112, dx: 1400, pierce: 1 }); updateGame(game, 0.05);
  assert.equal(first.hp, 3); assert.equal(second.hp, 3); assert.equal(game.bullets.length, 0);
  const crossing = isolated();
  shell(crossing, { x: 100, y: 112, dx: 950 });
  shell(crossing, { x: 140, y: 112, dx: -520, owner: 'enemy' });
  updateGame(crossing, 0.05); assert.equal(crossing.bullets.length, 0);
  const offscreen = isolated(); offscreen.enemies = [enemy('basic', -30, -30)];
  shell(offscreen, { x: -30, y: -30 }); updateGame(offscreen, 0.05);
  assert.equal(offscreen.score, 0); assert.equal(offscreen.bullets.length, 0);
});

test('three star ranks change shell speed, active shot cap and steel destruction', () => {
  const game = isolated(); Object.assign(game.player, { x: 400, y: 400 });
  updateGame(game, 0.01, { fire: true }); game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true }); assert.equal(game.player.shotCount, 1);
  game.bullets = []; collect(game, 'star');
  assert.equal(game.player.level, 1); game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true }); assert.ok(Math.abs(game.bullets[0].dy + 950) < 1e-9);
  game.player.fireCooldown = 0; updateGame(game, 0.01, { fire: true }); assert.equal(game.bullets.length, 1);
  game.bullets = []; collect(game, 'star'); game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true }); game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true }); game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true }); assert.equal(game.bullets.length, 2);
  game.bullets = []; collect(game, 'star'); collect(game, 'star'); assert.equal(game.player.level, 3);
  Object.assign(game.player, { x: 112, y: 112, fireCooldown: 0 }); game.terrain[3][4] = 'S';
  updateGame(game, 0.01, { fire: true, aimX: 300, aimY: 112 }); assert.equal(game.terrain[3][4], '.');
  game.terrain[3][4] = '#'; game.bullets = []; game.player.fireCooldown = 0;
  updateGame(game, 0.01, { fire: true, aimX: 300, aimY: 112 }); assert.equal(game.terrain[3][4], '.');
  game.terrain[3][29] = 'S'; shell(game, { x: WIDTH - TILE - 2, y: 112, dx: 950, steelBreak: true }); updateGame(game, 0.05);
  assert.equal(game.terrain[3][29], 'S', 'Rank3 cannot destroy permanent boundaries');
  const cadence = isolated();
  for (let frame = 0; frame < 120; frame++) { cadence.bullets = []; updateGame(cadence, 1 / 120, { fire: true }); }
  assert.equal(cadence.player.shotCount, 8, 'Free shell slots retain the fast 0.14 second cadence');
});

test('all six classic pickups score500 and have observable effects', () => {
  const game = isolated(); const armor = game.player.hp;
  collect(game, 'helmet'); assert.equal(game.player.invulnerable, 12);
  shell(game, { x: game.player.x, y: game.player.y, owner: 'enemy' }); updateGame(game, 0.01);
  assert.equal(game.player.hp, armor);
  collect(game, 'tank'); assert.equal(game.player.lives, 4);
  collect(game, 'timer'); assert.equal(game.freezeTimer, 10);
  const frozen = enemy('power', 400, 300); frozen.stunned = 0; frozen.fireCooldown = 0; game.enemies = [frozen];
  const frozenPoint = { x: frozen.x, y: frozen.y }; step(game, 0.3);
  assert.equal(frozen.x, frozenPoint.x); assert.equal(frozen.y, frozenPoint.y); assert.equal(frozen.shotCount, 0);
  game.freezeTimer = 0.01; updateGame(game, 0.02); assert.ok(frozen.shotCount > 0 || frozen.moving);
  collect(game, 'shovel'); assert.equal(game.fortifyTimer, 20); assert.equal(game.terrain[18][14], 'S');
  game.enemies = []; game.bullets = []; step(game, 20.1);
  assert.equal(game.fortifyTimer, 0); assert.equal(game.terrain[18][14], '#');
  game.enemies = [enemy('basic'), enemy('heavy', 500, 300, 2)];
  const score = game.score; collect(game, 'grenade');
  assert.equal(game.enemies.length, 0); assert.equal(game.score - score, 500 + 100 + 400);
  collect(game, 'star'); assert.equal(game.player.level, 1);
  assert.equal(game.score, 6 * 500 + 500);
});

test('carrier ordinals4/11/18 drop exactly once on their first hit', () => {
  const game = isolated();
  for (let ordinal = 1; ordinal <= 20; ordinal++) {
    game.spawnTimer = 0; updateGame(game, 0.01);
    assert.equal(game.enemies[0].carrier, [4, 11, 18].includes(ordinal));
    game.enemies = []; game.bullets = [];
  }
  const hit = isolated(); const carrier = enemy('heavy'); carrier.carrier = true; hit.enemies = [carrier];
  shell(hit); updateGame(hit, 0.01);
  assert.equal(carrier.hp, 3); assert.equal(carrier.dropped, true); assert.equal(hit.pickups.length, 1);
  shell(hit); updateGame(hit, 0.01); assert.equal(hit.pickups.length, 1);
  assert.ok(['star', 'helmet', 'grenade', 'timer', 'shovel', 'tank'].includes(hit.pickups[0].type));
});

test('arrivals allow preparation, use the outer lanes first and telegraph before acting', () => {
  const game = startGame(createGame());
  step(game, 1.48); assert.equal(game.enemies.length, 0);
  updateGame(game, 0.04); assert.equal(game.enemies.length, 1);
  const first = game.enemies[0], position = { x: first.x, y: first.y };
  assert.equal(first.x, game.spawnPoints[0].x); assert.equal(game.spawnTimer, 2.4);
  first.fireCooldown = 0;
  step(game, 0.9);
  assert.equal(first.x, position.x); assert.equal(first.y, position.y); assert.equal(first.shotCount, 0);
  step(game, 0.12); assert.ok(first.moving || first.shotCount > 0);
  for (const lane of [2, 1]) {
    game.enemies = []; game.bullets = []; game.spawnTimer = 0;
    updateGame(game, 0.01);
    assert.equal(game.enemies[0].x, game.spawnPoints[lane].x);
  }
  const late = isolated({ stage: 35 }); late.spawnTimer = 0;
  updateGame(late, 0.01); assert.equal(late.spawnTimer, 1.6);
  for (const coop of [false, true]) {
    const capped = isolated({ coop }); capped.freezeTimer = 999;
    for (let ordinal = 0; ordinal < 9; ordinal++) {
      capped.spawnTimer = 0; updateGame(capped, 0.01);
      capped.enemies.forEach((tank, index) => Object.assign(tank, { x: 112 + index * 96, y: 144 }));
    }
    assert.equal(capped.enemies.length, coop ? 6 : 4);
    assert.equal(capped.waveSpawned, coop ? 6 : 4);
  }
});

test('opening roster teaches basic tanks before scouts, armor and power enter later', () => {
  const rosters = new Map();
  for (const stage of [1, 2, 3, 4]) {
    const game = isolated({ stage }), types = [];
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      game.spawnTimer = 0; updateGame(game, 0.01);
      types.push(game.enemies[0].type); game.enemies = []; game.bullets = [];
    }
    rosters.set(stage, types);
  }
  assert.deepEqual(rosters.get(1), [...Array(18).fill('basic'), 'scout', 'scout']);
  assert.ok(rosters.get(2).includes('heavy')); assert.ok(!rosters.get(2).includes('power'));
  assert.ok(!rosters.get(3).includes('power')); assert.ok(rosters.get(4).includes('power'));
});

test('enemies carry one shell, fire at a slower cadence and only redirect toward nearby targets', () => {
  for (const [type, fireRate] of Object.entries({ basic: 2.4, scout: 2.4, power: 1.8, heavy: 2.6 })) {
    const game = isolated();
    const tank = enemy(type, 400, 300);
    Object.assign(tank, { stunned: 0, speed: 0, routeDir: 1, routeDistance: 999, fireCooldown: 0 });
    game.enemies = [tank]; updateGame(game, 0.01);
    assert.equal(tank.fireCooldown, fireRate); assert.equal(tank.shotCount, 1);
    assert.ok(game.bullets[0].dx > 0); assert.equal(game.bullets[0].dy, 0);
    tank.fireCooldown = 0; updateGame(game, 0.01); assert.equal(tank.shotCount, 1);
    game.bullets = []; game.base.x = 400; game.base.y = 450;
    updateGame(game, 0.01); assert.equal(tank.shotCount, 2);
    assert.ok(game.bullets[0].dy > 0); assert.ok(Math.abs(game.bullets[0].dx) < 1e-9);
  }
  const far = isolated(); Object.assign(far.player, { x: 337, y: 112 });
  const scout = enemy('scout', 112, 112); scout.stunned = 0; far.enemies = [scout];
  const near = snapshot(far); near.player.x = 336;
  updateGame(far, 0.01); updateGame(near, 0.01);
  assert.equal(far.enemies[0].routeDir, 2, 'A distant scout advances toward HQ');
  assert.equal(near.enemies[0].routeDir, 1, 'A nearby scout pursues the player');
});

test('early supplies offer nearby reachable stars to the lowest-ranked surviving player', () => {
  for (const coop of [false, true]) {
    const game = isolated({ coop });
    if (coop) game.player.level = 2;
    const recipient = game.players.at(-1);
    for (let drop = 1; drop <= 2; drop++) {
      const carrier = enemy('heavy', 400, 300, drop); carrier.carrier = true;
      game.enemies = [carrier]; shell(game); updateGame(game, 0.01);
      const pickup = game.pickups.at(-1), distance = Math.hypot(pickup.x - recipient.x, pickup.y - recipient.y);
      assert.equal(pickup.type, 'star'); assert.ok(pickup.life > 44.9 && pickup.life <= 45);
      assert.ok(distance >= 72 && distance <= 192);
      assert.ok(reachableCells(game, recipient).has(Math.floor(pickup.y / TILE) * 30 + Math.floor(pickup.x / TILE)));
      assert.ok(game.pickups.slice(0, -1).every(other => Math.hypot(other.x - pickup.x, other.y - pickup.y) >= 28));
      assert.equal(game.carrierDrops, drop);
    }
  }
  const randomTypes = new Set();
  for (let seed = 1; seed <= 16; seed++) {
    const game = isolated({ seed }); game.player.level = 3;
    const carrier = enemy('heavy'); carrier.carrier = true; game.enemies = [carrier];
    shell(game); updateGame(game, 0.01); randomTypes.add(game.pickups[0].type);
  }
  assert.ok(randomTypes.size > 2, 'Maximum-rank tanks receive varied classic supplies');
  const boxed = isolated(); boxed.terrain = boxed.terrain.map(row => row.map(() => 'S'));
  for (let col = 13; col <= 18; col++) boxed.terrain[19][col] = '.';
  Object.assign(boxed.player, { x: 432, y: 624 }); boxed.terrain[3][3] = '.';
  const carrier = enemy('heavy', 112, 112); carrier.carrier = true; boxed.enemies = [carrier];
  shell(boxed, { x: 112, y: 112 }); updateGame(boxed, 0.01);
  assert.equal(boxed.player.level, 1, 'HQ cannot connect a boxed tank to unreachable supplies; fallback collects locally');
  assert.equal(boxed.pickups.length, 0);
});

test('real rank gains grant a short shield and feedback without healing or replaying counts', () => {
  const game = isolated(); game.player.hp = 2;
  for (const [level, message] of [[1, 'GUNNER // FASTER SHELLS'], [2, 'TWIN // TWO ACTIVE SHELLS'], [3, 'SIEGE // BREAK STEEL']]) {
    collect(game, 'star');
    assert.equal(game.player.level, level); assert.equal(game.rankUps, level);
    assert.equal(game.player.hp, 2); assert.equal(game.player.invulnerable, 2); assert.equal(game.player.rankFx, 1.6);
    assert.ok(game.event.includes(message));
  }
  const score = game.score; collect(game, 'star');
  assert.equal(game.rankUps, 3); assert.equal(game.score, score + 500);
  game.player.hp = 1; hitPlayer(game);
  assert.equal(game.player.level, 0); assert.equal(game.player.rankFx, 0); assert.equal(game.rankUps, 3);
  startGame(game); assert.equal(game.rankUps, 0);
});

test('four classes score100/200/300/400; personal score milestones award a tank', () => {
  for (const [type, points] of Object.entries({ basic: 100, scout: 200, power: 300, heavy: 400 })) {
    const game = isolated(); game.enemies = [enemy(type)]; shell(game, { damage: 4 }); updateGame(game, 0.01);
    assert.equal(game.score, points); assert.equal(game.player.score, points); assert.equal(game.player.kills, 1);
  }
  const milestone = isolated(); milestone.player.score = milestone.score = 19900;
  milestone.enemies = [enemy('basic')]; shell(milestone); updateGame(milestone, 0.01);
  assert.equal(milestone.player.lives, 4); assert.equal(milestone.player.nextLifeScore, 40000);
});

test('limited lives reset stars, respawn under shield and end only when out', () => {
  const game = isolated(); game.player.hp = 1; game.player.level = 3;
  hitPlayer(game); assert.equal(game.player.lives, 2); assert.equal(game.player.level, 0);
  assert.equal(game.player.dead, true); assert.equal(game.status, 'playing');
  const x = game.player.x, shots = game.shots;
  updateGame(game, 0.05, { right: true, fire: true, dash: true });
  assert.equal(game.player.x, x); assert.equal(game.shots, shots);
  game.player.dir = 1; game.player.hullAngle = 0; game.player.aimAngle = Math.PI;
  step(game, 1.3); assert.equal(game.player.dead, false); assert.equal(game.player.hp, 4); assert.ok(game.player.invulnerable > 2);
  assert.equal(game.player.dir, 0); assert.equal(game.player.hullAngle, -Math.PI / 2); assert.equal(game.player.aimAngle, -Math.PI / 2);
  for (let life = 2; life > 0; life--) {
    game.player.hp = 1; hitPlayer(game);
    assert.equal(game.player.lives, life - 1);
    if (life > 1) step(game, 1.3);
  }
  assert.equal(game.status, 'gameover');
});

test('co-op input, friendly stun, independent lives, kill attribution and stage bonus', () => {
  const game = isolated({ coop: true }); const p2 = game.players[1];
  const before = p2.x; updateGame(game, 0.05, { p2: { left: true, fire: true } });
  assert.ok(p2.x < before); assert.equal(game.player.x, 112); assert.equal(game.bullets[0].shooterId, 'p2');
  game.bullets = []; shell(game, { x: p2.x, y: p2.y }); updateGame(game, 0.01);
  assert.equal(p2.hp, 4); assert.ok(p2.stunned > 1);
  const stopped = p2.x; updateGame(game, 0.05, { p2: { left: true, fire: true, dash: true } }); assert.equal(p2.x, stopped);
  game.player.lives = 1; game.player.hp = 1; hitPlayer(game); assert.equal(game.player.lives, 0); assert.equal(game.status, 'playing');
  game.enemies = [enemy('power')]; shell(game, { shooterId: 'p2', damage: 4 }); updateGame(game, 0.01);
  assert.equal(p2.kills, 1); assert.equal(p2.score, 300);
  game.waveSpawned = 20; updateGame(game, 0.01); assert.equal(game.status, 'upgrade');
  assert.equal(game.stageBonus.p2, 1000); assert.equal(p2.score, 1300);
  assert.deepEqual(game.upgradeChoices, []); assert.equal(continueStage(game), true);
  assert.equal(game.player.dead, true); assert.equal(game.stageBonus.p2, 0);
  p2.hp = 1; p2.stunned = 0; p2.lives = 1; hitPlayer(game, p2); assert.equal(game.status, 'gameover');
  const reserves = isolated({ coop: true }); reserves.player.hp = 1; hitPlayer(reserves);
  reserves.waveSpawned = 20; updateGame(reserves, 0.01);
  continueStage(reserves);
  assert.equal(reserves.player.dead, false); assert.equal(reserves.player.hp, reserves.player.maxHp);
  assert.equal(reserves.player.lives, 2); assert.ok(reserves.player.invulnerable > 0);
});

test('all shots threaten one-hit HQ, damage shields work, pause freezes exactly', () => {
  for (const owner of ['player', 'enemy']) {
    const game = isolated(); shell(game, { x: game.base.x, y: game.base.y, owner }); updateGame(game, 0.01);
    assert.equal(game.base.hp, 0); assert.equal(game.status, 'gameover');
  }
  const game = isolated(); hitPlayer(game); assert.equal(game.player.hp, 3);
  shell(game, { x: game.player.x, y: game.player.y, owner: 'enemy' }); updateGame(game, 0.01);
  assert.equal(game.player.hp, 3);
  togglePause(game); const paused = snapshot(game); updateGame(game, 0.05, { fire: true, emp: true, right: true });
  assert.deepEqual(snapshot(game), paused); togglePause(game); assert.equal(game.status, 'playing');
});

test('ice inertia, water collision and forest concealment affect actual behavior', () => {
  const ice = isolated(); ice.terrain = ice.terrain.map(row => row.map(() => 'I'));
  Object.assign(ice.player, { x: 336, y: 336 }); step(ice, 0.4, { right: true });
  const x = ice.player.x; updateGame(ice, 0.05); assert.ok(ice.player.x > x && ice.player.moving);
  const water = isolated(); Object.assign(water.player, { x: 112, y: 112 }); water.terrain[3][4] = '~';
  step(water, 0.4, { right: true }); assert.ok(water.player.x <= 117);
  shell(water, { x: 126, y: 112, dx: 700 }); updateGame(water, 0.05); assert.equal(water.bullets.length, 1);
  const visible = isolated(); visible.enemies = [enemy('scout', 112, 112)]; visible.enemies[0].stunned = 0;
  Object.assign(visible.player, { x: 336, y: 112 }); const hidden = snapshot(visible); hidden.terrain[3][10] = '%';
  updateGame(visible, 0.02); updateGame(hidden, 0.02);
  assert.equal(visible.enemies[0].routeDir, 1); assert.equal(hidden.enemies[0].routeDir, 2);
  Object.assign(hidden.enemies[0], { x: 112, y: 112, routeDistance: 0 }); hidden.player.x = 240; hidden.terrain[3][7] = '%';
  updateGame(hidden, 0.02); assert.equal(hidden.enemies[0].routeDir, 1);
});

test('EMP spends charges once, preserves its radius, stuns armor and drops carriers', () => {
  const game = isolated();
  game.enemies = [enemy('basic', 144, 592), enemy('heavy', 112, 544, 2), enemy('basic', 848, 48, 3)];
  game.enemies[1].carrier = true;
  assert.equal(activateEmp(game), true); assert.equal(game.empCharges, 1); assert.equal(game.empCount, 1);
  assert.equal(game.enemies.length, 2); assert.equal(game.enemies[0].hp, 2); assert.equal(game.pickups.length, 1);
  assert.equal(game.enemies[1].hp, 1); activateEmp(game); assert.equal(activateEmp(game), false);
});

test('HQ attackers navigate tank blockers and breach partial bricks from all spawn lanes', () => {
  for (const lane of [0, 1, 2]) {
    const game = startGame(createGame()); game.player.invulnerable = 999; game.spawnTimer = 999;
    const heavy = enemy('heavy'); Object.assign(heavy, game.spawnPoints[lane], { stunned: 0 }); game.enemies = [heavy];
    step(game, 45); assert.equal(game.base.hp, 0); assert.equal(game.status, 'gameover');
  }
  const breach = isolated(); Object.assign(breach.player, { x: 848, y: 592 });
  const heavy = enemy('heavy', 112, 80); heavy.stunned = 0; breach.enemies = [heavy];
  breach.terrain[3][3] = '#'; breach.terrain[3][2] = 'S'; breach.terrain[3][4] = 'S';
  step(breach, 15); assert.equal(breach.terrain[3][3], '.'); assert.ok(heavy.y > 128);
});

test('35-stage campaign continues with armor repairs and retained stars; Endless keeps bounded perks', () => {
  const game = startGame(createGame({ coop: true })); game.player.level = 3;
  for (let stage = 1; stage <= 35; stage++) {
    assert.equal(game.wave, stage); assert.equal(game.stage, stage); assert.equal(game.waveTotal, 20);
    game.waveSpawned = 20; game.enemies = []; updateGame(game, 0.01);
    if (stage === 35) { assert.equal(game.status, 'victory'); break; }
    assert.equal(game.status, 'upgrade'); assert.deepEqual(game.upgradeChoices, []);
    game.terrain[8][8] = '~'; game.freezeTimer = 10; game.fortifyTimer = 10;
    game.player.hp = 1; game.player.lives = 2; game.player.dir = 3; game.player.hullAngle = Math.PI; game.player.aimAngle = Math.PI;
    assert.equal(chooseUpgrade(game, 'overdrive'), false); assert.equal(continueStage(game), true);
    assert.equal(continueStage(game), false);
    assert.equal(game.player.level, 3); assert.equal(game.freezeTimer, 0); assert.equal(game.fortifyTimer, 0);
    assert.equal(game.player.hp, game.player.maxHp); assert.equal(game.player.lives, 2);
    assert.equal(game.player.dir, 0); assert.equal(game.player.hullAngle, -Math.PI / 2); assert.equal(game.player.aimAngle, -Math.PI / 2);
    assert.deepEqual(game.terrain, makeTerrain(stage + 1));
  }
  assert.equal(game.player.speed, 160); assert.equal(game.players[1].speed, 160); assert.equal(game.player.dashRecharge, 2.1);
  assert.equal(game.upgrades.length, 0); assert.equal(continueStage(game), false);
  const endless = startGame(createGame({ mode: 'endless', stage: 35 })); endless.waveSpawned = 20;
  updateGame(endless, 0.01); assert.equal(endless.status, 'upgrade'); assert.equal(endless.upgradeChoices.length, 3);
  assert.equal(continueStage(endless), false); chooseUpgrade(endless, endless.upgradeChoices[0].id);
  assert.equal(endless.wave, 36); assert.equal(endless.stageName, MAPS[0].name);
  const custom = startGame(createGame({ customMap: makeTerrain(7) })); custom.waveSpawned = 20; updateGame(custom, 0.01);
  assert.equal(custom.status, 'victory'); assert.equal(continueStage(custom), false);
  for (const id of ['rapid-fire', 'reinforced', 'overdrive', 'piercing', 'repair']) {
    const world = startGame(createGame({ coop: true, mode: 'endless' }));
    for (let iteration = 0; iteration < 12; iteration++) {
      world.status = 'upgrade'; world.upgradeChoices = [{ id }]; chooseUpgrade(world, id);
    }
    for (const player of world.players) {
      assert.ok(player.fireRate >= 0.08); assert.ok(player.maxHp <= 10); assert.ok(player.pierce <= 2);
      assert.ok(player.speed <= 360); assert.ok(player.dashRecharge >= 0.8);
    }
    if (id === 'repair') { assert.equal(world.fortifyTimer, 20); assert.equal(world.empCharges, 5); }
  }
});
