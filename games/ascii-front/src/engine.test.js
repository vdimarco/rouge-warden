import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, togglePause, chooseUpgrade, activateEmp, snapshot, TILE } from './engine.js';

function isolatedGame(seed = 1) {
  const game = startGame(createGame({ seed }));
  game.spawnTimer = 999;
  game.terrain = Array.from({ length: 21 }, () => Array(30).fill('.'));
  return game;
}

function step(game, seconds, input) {
  for (let time = 0; time < seconds; time += 0.02) updateGame(game, 0.02, input);
}

const game = isolatedGame();
game.player.x = 112;
game.player.y = 112;
game.terrain[3][4] = '#';
step(game, 1, { right: true });
assert.ok(game.player.x <= 4 * TILE - 11, 'Tank cannot cross a brick wall');
assert.ok(game.player.x > 112, 'Tank can approach a wall');
step(game, 0.4, { fire: true });
assert.equal(game.terrain[3][4], '.', 'Player shots destroy bricks');
step(game, 0.4, { right: true });
assert.ok(game.player.x > 4 * TILE, 'Destroyed walls become traversable');

const health = game.player.hp;
game.bullets.push({ x: game.player.x, y: game.player.y, dx: 0, dy: 0, owner: 'enemy', damage: 1, pierce: 0, hitIds: [] });
updateGame(game, 0.02);
assert.equal(game.player.hp, health - 1, 'Enemy shots damage the player');
game.bullets.push({ x: game.player.x, y: game.player.y, dx: 0, dy: 0, owner: 'enemy', damage: 1, pierce: 0, hitIds: [] });
updateGame(game, 0.02);
assert.equal(game.player.hp, health - 1, 'Damage grants temporary invulnerability');

const baseHp = game.base.hp;
game.bullets.push({ x: game.base.x, y: game.base.y, dx: 0, dy: 0, owner: 'player', damage: 1, pierce: 0, hitIds: [] });
updateGame(game, 0.02);
assert.equal(game.base.hp, baseHp, 'Player shots cannot damage HQ');
game.bullets.push({ x: game.base.x, y: game.base.y, dx: 0, dy: 0, owner: 'enemy', damage: 1, pierce: 0, hitIds: [] });
updateGame(game, 0.02);
assert.equal(game.base.hp, baseHp - 1, 'Enemy shots damage HQ');

togglePause(game);
const paused = snapshot(game);
updateGame(game, 0.05, { right: true, fire: true, emp: true });
assert.deepEqual(snapshot(game), paused, 'Pause freezes all simulation');
togglePause(game);
assert.equal(game.status, 'playing');

const empGame = isolatedGame();
empGame.enemies = [
  { id: 1, x: empGame.player.x + 32, y: empGame.player.y, dir: 2, type: 'scout', hp: 1, maxHp: 1 },
  { id: 2, x: empGame.player.x, y: empGame.player.y - 48, dir: 2, type: 'heavy', hp: 4, maxHp: 4 },
  { id: 3, x: 48, y: 48, dir: 2, type: 'scout', hp: 1, maxHp: 1 },
];
assert.equal(activateEmp(empGame), true);
assert.equal(empGame.empCharges, 1);
assert.equal(empGame.enemies.length, 2, 'EMP kills nearby scouts');
assert.equal(empGame.enemies.find(enemy => enemy.id === 2).hp, 2, 'EMP damages heavy armor');
assert.equal(empGame.enemies.find(enemy => enemy.id === 3).hp, 1, 'EMP respects its radius');
activateEmp(empGame);
assert.equal(activateEmp(empGame), false, 'EMP cannot spend missing charges');
assert.equal(empGame.empCharges, 0);

const waveGame = isolatedGame(8);
waveGame.waveSpawned = waveGame.waveTotal;
updateGame(waveGame, 0.02);
assert.equal(waveGame.status, 'upgrade');
assert.equal(waveGame.upgradeChoices.length, 3);
assert.equal(new Set(waveGame.upgradeChoices.map(choice => choice.id)).size, 3);
assert.equal(chooseUpgrade(waveGame, 'missing'), false, 'Only offered upgrades are valid');
waveGame.upgradeChoices = [{ id: 'rapid-fire' }];
const fireRate = waveGame.player.fireRate;
assert.equal(chooseUpgrade(waveGame, 'rapid-fire'), true);
assert.ok(waveGame.player.fireRate < fireRate, 'Rapid fire modifies shot cadence');
assert.equal(waveGame.wave, 2);
assert.equal(waveGame.status, 'playing');
assert.equal(waveGame.waveSpawned, 0);
waveGame.status = 'upgrade';
waveGame.upgradeChoices = [{ id: 'reinforced' }];
chooseUpgrade(waveGame, 'reinforced');
assert.equal(waveGame.player.hp, 6, 'Armor upgrade increases and repairs health');
waveGame.wave = 5;
waveGame.waveSpawned = waveGame.waveTotal;
updateGame(waveGame, 0.02);
assert.equal(waveGame.status, 'victory', 'Campaign ends after wave five');

const endless = isolatedGame();
endless.mode = 'endless';
endless.wave = 5;
endless.waveSpawned = endless.waveTotal;
updateGame(endless, 0.02);
assert.equal(endless.status, 'upgrade', 'Endless continues past wave five');

const lethal = isolatedGame();
lethal.base.hp = 1;
lethal.bullets.push({ x: lethal.base.x, y: lethal.base.y, dx: 0, dy: 0, owner: 'enemy', damage: 1 });
updateGame(lethal, 0.02);
assert.equal(lethal.status, 'gameover', 'HQ destruction ends a run');

const ready = createGame({ seed: 42 });
const same = createGame({ seed: 42 });
assert.deepEqual(ready, same, 'Seeded games are deterministic');
startGame(ready);
ready.player.hp = 1;
ready.score = 10000;
ready.terrain[3][3] = '.';
startGame(ready);
assert.equal(ready.player.hp, 4);
assert.equal(ready.score, 0);
assert.equal(ready.terrain[3][3], '#', 'Restart restores destructible terrain');
assert.equal(ready.enemies.length, 0, 'Preview enemies are cleared on launch');
assert.equal(ready.status, 'playing');
const cloned = snapshot(ready);
cloned.player.hp = 99;
assert.equal(ready.player.hp, 4, 'Snapshots do not share mutable entities');
updateGame(ready, Number.NaN, { right: true });
assert.ok(Number.isFinite(ready.player.x), 'Invalid frame times cannot corrupt the simulation');

const visiblePlayer = isolatedGame();
const scout = createGame().enemies.find(enemy => enemy.type === 'scout');
Object.assign(scout, { x: 112, y: 112, routeDistance: 0 });
visiblePlayer.enemies = [scout];
Object.assign(visiblePlayer.player, { x: 336, y: 112 });
const hiddenPlayer = snapshot(visiblePlayer);
hiddenPlayer.terrain[3][10] = '%';
updateGame(visiblePlayer, 0.02);
updateGame(hiddenPlayer, 0.02);
assert.equal(visiblePlayer.enemies[0].routeDir, 1, 'Scouts pursue a visible player to the right');
assert.equal(hiddenPlayer.enemies[0].routeDir, 2, 'Brush redirects distant scouts toward HQ below');
Object.assign(hiddenPlayer.enemies[0], { x: 112, y: 112, routeDistance: 0 });
hiddenPlayer.player.x = 240;
hiddenPlayer.terrain[3][7] = '%';
updateGame(hiddenPlayer, 0.02);
assert.equal(hiddenPlayer.enemies[0].routeDir, 1, 'Nearby scouts detect the player through brush');

for (const spawnIndex of [0, 1, 2]) {
  const heavy = createGame().enemies.find(enemy => enemy.type === 'heavy');
  const siege = startGame(createGame());
  Object.assign(heavy, siege.spawnPoints[spawnIndex], { id: 3 });
  siege.enemies = [heavy];
  siege.spawnTimer = 999;
  siege.player.invulnerable = 999;
  step(siege, 45, {});
  assert.equal(siege.base.hp, 0, `Heavy from lane ${spawnIndex} navigates steel, breaches brick, and destroys HQ`);
  assert.equal(siege.status, 'gameover');
}

const upgradeChecks = {
  'overdrive': world => { assert.equal(world.player.speed, 264); assert.ok(world.player.dashRecharge < 2.1); },
  'piercing': world => assert.equal(world.player.pierce, 1),
  'repair': world => { assert.equal(world.base.hp, 4); assert.equal(world.empCharges, 2); },
};
for (const [id, check] of Object.entries(upgradeChecks)) {
  const world = startGame(createGame());
  Object.assign(world, { status: 'upgrade', upgradeChoices: [{ id }], empCharges: 1 });
  world.base.hp = 2;
  assert.equal(chooseUpgrade(world, id), true);
  check(world);
  assert.equal(chooseUpgrade(world, id), false, 'Upgrade selection is single-use');
}

const diagonal = isolatedGame();
Object.assign(diagonal.player, { x: 336, y: 336 });
updateGame(diagonal, 0.05, { up: true, right: true });
assert.ok(Math.abs(Math.hypot(diagonal.player.x - 336, diagonal.player.y - 336) - 11) < 1e-9, 'Diagonal movement is normalized to 220px/s');
assert.equal(diagonal.player.hullAngle, -Math.PI / 4);
assert.equal(diagonal.player.aimAngle, diagonal.player.hullAngle, 'Keyboard-only aim follows movement');
const still = snapshot(diagonal.player);
updateGame(diagonal, 0.05, { up: true, down: true, left: true, right: true });
assert.equal(diagonal.player.x, still.x, 'Opposite directions cancel');
assert.equal(diagonal.player.y, still.y);
assert.equal(diagonal.player.moving, false);
assert.equal(diagonal.player.aimAngle, still.aimAngle, 'Stationary aim holds its last direction');

const sliding = isolatedGame();
Object.assign(sliding.player, { x: 116, y: 112 });
for (let row = 1; row < 10; row++) sliding.terrain[row][4] = 'S';
updateGame(sliding, 0.05, { up: true, right: true });
assert.ok(sliding.player.x <= 117, 'Wall sliding preserves tank clearance');
assert.ok(sliding.player.y < 112, 'Diagonal input slides along the unobstructed wall axis');
assert.equal(sliding.player.moving, true);
updateGame(sliding, 0.05, { right: true, dash: true });
assert.ok(sliding.player.x <= 117, 'Dash substeps cannot cross steel walls');
assert.equal(sliding.player.moving, false);

for (const [aimX, aimY, expectedX, expectedY] of [
  [500, 400, 700, 0], [400, 300, 0, -700], [0, 400, -700, 0],
  [500, 500, 700 / Math.SQRT2, 700 / Math.SQRT2],
]) {
  const aimed = isolatedGame();
  Object.assign(aimed.player, { x: 400, y: 400 });
  updateGame(aimed, 0.02, { aimX, aimY, fire: true });
  assert.ok(Math.abs(aimed.bullets[0].dx - expectedX) < 1e-9, 'Pointer aim sets the projectile horizontal velocity');
  assert.ok(Math.abs(aimed.bullets[0].dy - expectedY) < 1e-9, 'Pointer aim sets the projectile vertical velocity');
  assert.equal(aimed.player.shotCount, 1);
  assert.equal(aimed.shots, 1);
  assert.ok(aimed.player.muzzleFlash > 0);
}
const independentAim = isolatedGame();
Object.assign(independentAim.player, { x: 400, y: 400 });
updateGame(independentAim, 0.02, { right: true, aimX: 0, aimY: 400, fire: true });
assert.equal(independentAim.player.hullAngle, 0, 'Hull points along movement');
assert.equal(independentAim.player.aimAngle, Math.PI, 'Turret can aim opposite to movement');
const lastAim = independentAim.player.aimAngle;
updateGame(independentAim, 0.02, { aimX: Number.NaN, aimY: Infinity });
assert.equal(independentAim.player.aimAngle, lastAim, 'Invalid pointer coordinates cannot corrupt aim');

for (const tile of ['#', 'S']) {
  const swept = isolatedGame();
  swept.terrain[3][4] = tile;
  swept.bullets.push({ x: 126, y: 112, dx: 700, dy: 0, owner: 'player', damage: 1, pierce: 0, hitIds: [] });
  updateGame(swept, 0.05);
  assert.equal(swept.bullets.length, 0, `Fast projectiles cannot tunnel through${tile === '#' ? ' brick' : ' steel'}`);
  assert.equal(swept.terrain[3][4], tile === '#' ? '.' : 'S');
}
const sweptTank = isolatedGame();
const targetTank = createGame().enemies[0];
Object.assign(targetTank, { x: 112, y: 112, stunned: 999 });
sweptTank.enemies = [targetTank];
sweptTank.bullets.push({ x: 92, y: 112, dx: 700, dy: 0, owner: 'player', damage: 1, pierce: 0, hitIds: [] });
updateGame(sweptTank, 0.05);
assert.equal(sweptTank.enemies.length, 0, 'Fast projectiles hit tanks crossed between frame endpoints');
assert.equal(sweptTank.kills, 1);
assert.ok(sweptTank.particles.some(particle => particle.kind === 'explosion' && particle.glyph), 'Tank explosions expose richer renderer particles');

const piercing = isolatedGame();
const armoredTarget = createGame().enemies.find(enemy => enemy.type === 'heavy');
Object.assign(armoredTarget, { x: 112, y: 112, stunned: 999 });
piercing.enemies = [armoredTarget];
piercing.bullets.push({ x: 92, y: 112, dx: 700, dy: 0, owner: 'player', damage: 1, pierce: 1, hitIds: [] });
updateGame(piercing, 0.05);
assert.equal(armoredTarget.hp, 3, 'Piercing bullets only hit the same tank once across collision substeps');
assert.equal(piercing.bullets.length, 1);

const cadence = isolatedGame();
for (let frame = 0; frame < 120; frame++) updateGame(cadence, 1 / 120, { fire: true });
assert.equal(cadence.player.shotCount, 8, 'Base weapon fires 8 rounds in the first second at 120Hz');
assert.equal(cadence.player.fireRate, 0.14);
assert.equal(cadence.player.speed, 220);

const dashing = isolatedGame();
Object.assign(dashing.player, { x: 336, y: 336 });
updateGame(dashing, 0.05, { right: true, dash: true });
assert.ok(Math.abs(dashing.player.x - 336 - 220 * 3.5 * 0.05) < 1e-9, 'Dash moves at 3.5 times normal speed');
assert.equal(dashing.player.dashCooldown, 2.1);
for (let frame = 0; frame < 3; frame++) updateGame(dashing, 0.05);
assert.equal(dashing.player.dashTimer, 0, 'Dash duration ends precisely within coarse frames');
assert.ok(Math.abs(dashing.player.x - 336 - 220 * 3.5 * 0.16) < 1e-9, 'Dash integrates only its 0.16 second duration');
updateGame(dashing, 0.05, { dash: true });
assert.equal(dashing.player.dashTimer, 0, 'Dash cannot reactivate during its cooldown');
for (let frame = 0; frame < 40; frame++) updateGame(dashing, 0.05);
updateGame(dashing, 0.05, { dash: true });
assert.ok(dashing.player.dashTimer > 0, 'Dash reactivates after the 2.1 second cooldown');

console.log('Engine checks passed: movement, wall sliding, aiming, swept collision, cadence, dash, damage, pause, EMP, upgrades, sieges, campaign, endless, restart.');
