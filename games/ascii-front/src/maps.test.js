import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAPS, makeTerrain, validateMap, paintTile } from './maps.js';

test('35 distinct maps preserve terrain variety, traversable entry roads and HQ', () => {
  assert.equal(MAPS.length, 35);
  assert.equal(new Set(MAPS.map(map => JSON.stringify(map.terrain))).size, 35);
  const materials = new Set();
  for (const map of MAPS) {
    assert.ok(validateMap(map.terrain), map.name);
    const terrain = makeTerrain(map.id);
    terrain.flat().forEach(tile => materials.add(tile));
    const seen = new Set(['3,1']), queue = [[3, 1]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (nx < 1 || nx > 28 || ny < 1 || ny > 19 || seen.has(key) || ['S','~'].includes(terrain[ny][nx])) continue;
        seen.add(key); queue.push([nx, ny]);
      }
    }
    for (const point of ['15,1','26,1','3,18','26,18','15,19']) assert.ok(seen.has(point), `${map.name}: ${point} reachable through destructible cover`);
    assert.equal(terrain[18][14], '#'); assert.equal(terrain[19][14], '.');
    terrain[4][4] = '~';
    assert.notEqual(makeTerrain(map.id)[4][4], '~');
  }
  assert.deepEqual([...materials].sort(), ['#','%','.','I','S','~'].sort());
  assert.deepEqual(makeTerrain(36), makeTerrain(1));
});

test('construction validates saved maps and protects spawns, boundaries and HQ', () => {
  assert.equal(validateMap(null), false);
  assert.equal(validateMap(Array(21).fill('x'.repeat(30))), false);
  assert.equal(validateMap(Array(21).fill('.'.repeat(29))), false);
  const saved = Array(21).fill('~'.repeat(30));
  assert.ok(validateMap(saved));
  const game = { status:'editor', editorBrush:'I', terrain:makeTerrain(1, saved) };
  assert.equal(game.terrain[1][3], '.');
  for (const [x,y] of [[0,5],[3,1],[26,18],[15,19],[14,18],[15,10]]) assert.equal(paintTile(game,x,y),false);
  assert.equal(paintTile(game,7,8),true); assert.equal(game.terrain[8][7],'I');
  assert.equal(paintTile(game,7,8),false);
  assert.equal(paintTile(game,NaN,8),false);
  game.editorBrush='invalid'; assert.equal(paintTile(game,8,8),false);
  game.status='playing'; game.editorBrush='.'; assert.equal(paintTile(game,8,8),false);
  assert.equal(saved[8][7], '~');
});
