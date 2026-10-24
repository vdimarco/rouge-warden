import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generate } from '../../public/vr/js/city.js';
const path = new URL('../../public/vr/js/street.js', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
const old = 'Math.hypot(p.x - fx, p.z - fz) < STREET.crowdNear && (focus.y - p.y) < 12';
const next = '(focus.y - p.y) < 12 && Math.hypot(p.x - fx, p.z - fz) < STREET.crowdNear';
const load = async s => import('data:text/javascript;base64,' + Buffer.from(s.replace('"./config.js"', JSON.stringify(new URL('../../public/vr/js/config.js', import.meta.url).href))).toString('base64'));
const candidate = await load(source), reference = await load(source.replace(next, old));
const city = generate();
const a = candidate.createStreet(city), b = reference.createStreet(city);
const hypot = Math.hypot;
function step(s, f, time) {
  let calls = 0;
  Math.hypot = (...args) => { calls++; return hypot(...args); };
  try { s.update(1 / 30, time, f, null); } finally { Math.hypot = hypot; }
  return calls;
}
const snapshot = s => ({ crowd: s.crowd, count: s.count, time: s.time, stats: s.stats, people: s.people.map(p => ({ ...Object.fromEntries(Object.entries(p).filter(([k]) => !["strip", "crossing"].includes(k))), stripId: p.strip?.id, crossing: p.crossing && [p.crossing.along,p.crossing.road,p.crossing.edge] })) });
let saved = 0, roof = 0;
for (let i = 0; i < 240; i++) {
  const f = { x: 110 + Math.sin(i / 20) * 8, y: [0, 11.999999, 12, 12.000001, 60, -3][Math.floor(i / 40)], z: 1 };
  const ca = step(a, f, i / 30), cb = step(b, f, i / 30);
  assert.deepEqual(snapshot(a), snapshot(b), `state at frame ${i}`);
  assert.ok(ca <= cb);
  saved += cb - ca;
  if (f.y === 60) roof += cb - ca;
}
assert.ok(roof > 0, 'high focus skips actual horizontal distance calls');
console.log(`PASS 240 actual street updates: exact state/crowd equivalence across height boundaries and movement; ${saved} distance calls skipped, ${roof} on roof`);
