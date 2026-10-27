import assert from 'node:assert/strict';
import { markerOffset, missionLines } from './mission-card.js';

const lines = missionLines({
  title: '28 / THE BOLT',
  objective: 'Reach the bay before they do',
  stage: '2 of 3',
  fail: 'A crawl is caught. The chase starts again.',
  bearing: 90,
  meters: 180,
});
assert.equal(lines.title, '28 / THE BOLT');
assert.equal(lines.objective, 'Reach the bay before they do');
assert.equal(lines.stage, 'Stage 2 of 3');
assert.equal(lines.fail, 'A crawl is caught. The chase starts again.');
assert.equal(lines.distance, '180 m');

const quiet = missionLines({ title: '31 / THE POST', objective: 'Keep walking inside the mark', stage: '1 of 1', meters: 3 });
assert.equal(quiet.fail, '');
assert.equal(quiet.distance, 'here');
assert.equal(missionLines(null).title, '');

const north = markerOffset(0, 40);
assert.ok(Math.abs(north.x) < 1e-6 && north.y < -39, 'north sits above the player');
const east = markerOffset(90, 40);
assert.ok(east.x > 39 && Math.abs(east.y) < 1e-6, 'east sits to the right');

console.log('mission card lines and marker ok');
