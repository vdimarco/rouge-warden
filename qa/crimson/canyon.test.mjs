import assert from 'node:assert/strict';
import test from 'node:test';
import { generate, heightAt, maskIndex } from '../../public/crimson/js/story/world/gen.worker.js';
import { CANYON_TRAIL, trailSample } from '../../public/crimson/js/story/world/canyon-trail.js';

for (const seed of [7, 51]) {
  test(`canyon trail and bridge continuity, seed ${seed}`, () => {
    const terrain = generate(seed);
    for (const point of [[425, -455], [435, -565]]) assert.ok(Math.abs(heightAt(terrain.H, ...point) - 62) < 0.1);
    assert.equal(terrain.mask[maskIndex(430, -510) + 1], 0);
    for (const rock of terrain.rockColliders) assert.ok(trailSample(rock.x, rock.z).distance > rock.r + 2);
    for (let index = 1; index < CANYON_TRAIL.length; index++) {
      const start = CANYON_TRAIL[index - 1], end = CANYON_TRAIL[index], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      let previous = heightAt(terrain.H, ...start);
      for (let distance = 1; distance <= length; distance++) {
        const height = heightAt(terrain.H, start[0] + (end[0] - start[0]) * distance / length, start[1] + (end[1] - start[1]) * distance / length);
        assert.ok(Math.abs(height - previous) < 0.45, `walkable trail at segment ${index}, meter ${distance}`);
        previous = height;
      }
    }
  });
}
