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
      calls.push({ method: 'fillText', text, x, y });
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
  game.pickups.push({ x: 240, y: 240, type: 'repair', life: 3 });
  game.particles.push({ x: 100, y: 100, life: 0.4, maxLife: 0.7, color: '#eeaa77', glyph: '×', text: '', kind: 'explosion' });
  const live = structuredClone(game);
  renderGame(ctx, game, 2.5);
  renderGame(ctx, game, 2.5, { reducedMotion: true });
  assert.deepEqual(game, live);
  assert(calls.some(call => call.text === '[+]'));
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
