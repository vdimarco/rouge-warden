import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, activateEmp } from './engine.js';
import { renderGame } from './renderer.js';

function canvasSpy() {
  const stack = [];
  const calls = [];
  const ctx = {
    globalAlpha: 1, shadowBlur: 0,
    save() { stack.push({ ...this }); },
    restore() { assert(stack.length > 0); Object.assign(this, stack.pop()); },
    clearRect(...coordinates) { assert(coordinates.every(Number.isFinite)); },
    fillRect(...coordinates) { assert(coordinates.every(Number.isFinite)); },
    translate(...coordinates) {
      assert(coordinates.every(Number.isFinite));
      calls.push({ method: 'translate', coordinates });
    },
    rotate(angle) {
      assert(Number.isFinite(angle));
      calls.push({ method: 'rotate', angle });
    },
    fillText(text, x, y) {
      assert.equal(typeof text, 'string');
      assert(Number.isFinite(x) && Number.isFinite(y));
      calls.push({ method: 'fillText', text, x, y, color: this.fillStyle });
    },
  };
  return { ctx, calls, stack };
}

test('renders ready, live, and reduced-motion effects without mutating the engine', () => {
  const { ctx, calls, stack } = canvasSpy();
  const game = createGame();
  const ready = structuredClone(game);
  renderGame(ctx, game);
  assert.deepEqual(game, ready);
  assert(calls.some(call => call.text === 'XXXX') && calls.some(call => call.text === '####'));
  startGame(game);
  for (let frame = 0; frame < 50; frame++) updateGame(game, 0.05, { fire: true, dash: frame === 0 });
  activateEmp(game);
  game.pickups.push({ x: 240, y: 240, type: 'star', life: 3 });
  game.particles.push({ x: 100, y: 100, life: 0.4, maxLife: 0.7, color: '#eeaa77', glyph: '×', text: '', kind: 'explosion' });
  const live = structuredClone(game);
  renderGame(ctx, game, 2.5);
  renderGame(ctx, game, 2.5, { reducedMotion: true });
  assert.deepEqual(game, live);
  assert(calls.some(call => call.text === '[★]'));
  assert(calls.some(call => call.text === '×'));
  assert.equal(stack.length, 0);
});

test('aims the turret independently and suppresses camera shake and flashes with reduced motion', () => {
  const game = createGame();
  startGame(game);
  Object.assign(game, { shake: 0.3, hitFlash: 0.28 });
  Object.assign(game.player, { hullAngle: Math.PI / 4, aimAngle: 0, muzzleFlash: 0.075, shotCount: 1, moving: true });
  const normal = canvasSpy();
  renderGame(normal.ctx, game, 1);
  const camera = normal.calls.find(call => call.method === 'translate').coordinates;
  assert(camera.some(value => value !== 0));
  assert(camera.every(value => Math.abs(value) <= 4));
  assert(normal.calls.some(call => call.method === 'rotate' && call.angle === Math.PI * 0.75));
  assert(normal.calls.some(call => call.method === 'rotate' && call.angle === Math.PI / 2));
  assert(normal.calls.some(call => call.text === '✦'));
  const reduced = canvasSpy();
  renderGame(reduced.ctx, game, 1, { reducedMotion: true });
  assert(reduced.calls.find(call => call.method === 'translate').coordinates.every(value => value === 0));
  assert(!reduced.calls.some(call => call.text === '✦' || call.text === '✶'));
  assert.equal(reduced.stack.length, 0);
});

test('renders four visibly distinct player tiers', () => {
  const game = createGame();
  game.enemies = [];
  const signatures = [];
  for (let level = 0; level < 4; level++) {
    game.player.level = level;
    const { ctx, calls } = canvasSpy();
    renderGame(ctx, game, 0, { reducedMotion: true });
    signatures.push(JSON.stringify(calls.filter(call => call.method === 'fillText')));
  }
  assert.equal(new Set(signatures).size, 4);
});

test('renders co-op, six supplies, ice and partial brick quarters with foliage over tanks', () => {
  const game = createGame({ coop: true, stage: 3 });
  game.terrain[5][5] = '#';
  game.brickDamage[5 * 30 + 5] = 1;
  game.pickups = ['star', 'helmet', 'grenade', 'timer', 'shovel', 'tank'].map((type, index) => ({ type, x: 100 + index * 40, y: 300, life: 10 }));
  const { ctx, calls, stack } = canvasSpy();
  renderGame(ctx, game);
  for (const symbol of ['★', '◈', '✹', '◷', '♜', '♟']) assert(calls.some(call => call.text === `[${symbol}]`));
  assert(calls.some(call => call.text === 'P1') && calls.some(call => call.text === 'P2'));
  assert(calls.some(call => call.text === '╱·╱·'));
  assert.equal(calls.filter(call => call.text === '##').length, 6);
  const lastTurret = calls.findLastIndex(call => call.text === '◉');
  const firstFoliage = calls.findIndex(call => call.text === ':%·%' || call.text === '%·%:');
  assert(firstFoliage > lastTurret);
  assert.equal(stack.length, 0);
});

test('centers EMP on the surviving co-op tank', () => {
  const game = createGame({ coop: true });
  startGame(game);
  Object.assign(game.player, { dead: true, hp: 0, lives: 0 });
  activateEmp(game, 'p2');
  const { ctx, calls } = canvasSpy();
  renderGame(ctx, game);
  assert(calls.some(call => call.text === '+' && call.x === game.players[1].x + 16 && call.y === game.players[1].y));
});
