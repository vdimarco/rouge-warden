// Splat Isle's painter and island (public/lab/splat-isle/sdf.js and scene.js), checked in node with no browser:
// the distance shapes, the strokes on the surface, the spread of strokes, the baked light and shadow, and the island.
// Run: node qa/lab/splat-isle.test.mjs
import assert from 'node:assert/strict';
import { PRIMS, smin, prepare, field, paint, bake, Grid, softShadow, rng } from '../../public/lab/splat-isle/sdf.js';
import { build, heightAt, ISLAND } from '../../public/lab/splat-isle/scene.js';
let n = 0; const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const near = (a, b, e) => Math.abs(a - b) <= e;

{ // Each primitive is 0 on its surface, below 0 inside and above 0 outside.
  assert(near(PRIMS.sphere([1])(1, 0, 0), 0, 1e-9) && PRIMS.sphere([1])(0, 0, 0) < 0 && near(PRIMS.sphere([1])(0, 3, 0), 2, 1e-9));
  assert(near(PRIMS.box([1, 0.5, 2])(1, 0, 0), 0, 1e-9) && near(PRIMS.box([1, 0.5, 2])(0, 1.5, 0), 1, 1e-9) && PRIMS.box([1, 0.5, 2])(0, 0, 0) < 0);
  assert(near(PRIMS.capsule([2, 0.5])(0, 1.5, 0), 0, 1e-9) && near(PRIMS.capsule([2, 0.5])(0.5, 0, 0), 0, 1e-9));
  assert(near(PRIMS.cylinder([2, 1])(1, 0, 0), 0, 1e-9) && near(PRIMS.cylinder([2, 1])(0, 1, 0), 0, 1e-9) && near(PRIMS.cylinder([2, 1])(0, 2, 0), 1, 1e-9));
  assert(near(PRIMS.cone([2, 1, 0.5])(1, -1, 0), 0, 1e-6) && near(PRIMS.cone([2, 1, 0.5])(0.5, 1, 0), 0, 1e-6) && PRIMS.cone([2, 1, 0.5])(0, 0, 0) < 0);
  assert(near(PRIMS.torus([2, 0.5])(2.5, 0, 0), 0, 1e-9) && near(PRIMS.ellipsoid([2, 1, 1])(2, 0, 0), 0, 1e-6) && near(PRIMS.ellipsoid([2, 1, 1])(0, 1, 0), 0, 1e-6));
  // The smooth minimum is below the plain minimum where the two meet, and equal to it far apart.
  assert(smin(0.1, 0.1, 0.3) < 0.1 && smin(0, 5, 0.3) === 0 && smin(1, 2, 0) === 1);
  // A shape moves and turns: a box turned a quarter turn about y swaps its x and z sizes.
  const turned = prepare({ type: 'box', size: [2, 1, 0.5], at: [5, 0, 0], rot: [0, Math.PI / 2, 0] });
  assert(near(turned.f(5, 0, 2), 0, 1e-6) && near(turned.f(5.5, 0, 0), 0, 1e-6));
  // A cut takes a hole out of a shape.
  const holed = field([prepare({ type: 'sphere', size: [1] }), prepare({ type: 'sphere', size: [0.5], at: [1, 0, 0], cut: true })]);
  assert(holed(1, 0, 0) > 0 && holed(-1, 0, 0) <= 1e-9);
  pass('the distance shapes are right on, in and out of their surfaces');
}

{ // Strokes lie on the surface, face out of it, and are flat along it. Twice the area gets about twice the strokes.
  const part = r => ({ shapes: [{ type: 'sphere', size: [r], mat: { color: [0.5, 0.5, 0.5] } }] });
  const a = paint(part(1), { density: 300, rand: rng(3) }), b = paint(part(Math.SQRT2), { density: 300, rand: rng(3) });
  for (let i = 0; i < a.count; i++) {
    const x = a.pos[i * 3], y = a.pos[i * 3 + 1], z = a.pos[i * 3 + 2], r = Math.hypot(x, y, z); assert(near(r, 1, 0.01), 'on the surface: ' + r);
    assert(a.nrm[i * 3] * x + a.nrm[i * 3 + 1] * y + a.nrm[i * 3 + 2] * z > 0.98, 'facing out');
    const s = [a.scale[i * 3], a.scale[i * 3 + 1], a.scale[i * 3 + 2]]; assert(s[2] < s[0] * 0.3 && s[2] < s[1] * 0.3, 'flat along the surface');
    const q = [a.quat[i * 4], a.quat[i * 4 + 1], a.quat[i * 4 + 2], a.quat[i * 4 + 3]]; assert(near(Math.hypot(...q), 1, 1e-4), 'a unit quaternion');
    // the quaternion turns the stroke's flat axis (z) onto the normal
    const [qx, qy, qz, qw] = q, zx = 2 * (qx * qz + qw * qy), zy = 2 * (qy * qz - qw * qx), zz = 1 - 2 * (qx * qx + qy * qy);
    assert(zx * a.nrm[i * 3] + zy * a.nrm[i * 3 + 1] + zz * a.nrm[i * 3 + 2] > 0.99, 'the flat axis is the normal');
  }
  const want = 4 * Math.PI * 300; assert(a.count > want * 0.85 && a.count < want * 1.15, `about ${Math.round(want)} strokes on a 1 m sphere: ${a.count}`);
  assert(near(b.count / a.count, 2, 0.2), 'twice the area, twice the strokes: ' + (b.count / a.count).toFixed(2));
  // The same seed paints the same strokes.
  const c = paint(part(1), { density: 300, rand: rng(3) }); assert.deepEqual([...c.pos.slice(0, 30)], [...a.pos.slice(0, 30)]);
  pass('strokes lie flat on the surface, evenly spread', { strokes: a.count, ratio: +(b.count / a.count).toFixed(2) });
}

{ // The baked light: the sun side is brighter than the far side, a shadow under a roof is darker than open ground,
  // and a glowing material keeps its colour.
  const ball = paint({ shapes: [{ type: 'sphere', size: [1], mat: { color: [0.8, 0.8, 0.8], jitter: 0 } }] }, { density: 200, rand: rng(5) }); bake(ball, { sun: [0, 1, 0] });
  let top = 0, bottom = 0, nt = 0, nb = 0; for (let i = 0; i < ball.count; i++) { const y = ball.nrm[i * 3 + 1], l = ball.color[i * 3] + ball.color[i * 3 + 1] + ball.color[i * 3 + 2]; if (y > 0.8) { top += l; nt++; } if (y < -0.8) { bottom += l; nb++; } }
  assert(top / nt > (bottom / nb) * 2, 'the sun side is brighter');
  const roof = (x, y, z) => Math.min(y + 1, PRIMS.box([1, 0.1, 1])(x, y - 1, z)), grid = new Grid([-4, -1.5, -4], [4, 3, 4], 0.1, roof);
  assert(near(grid.at(0, 1, 0), roof(0, 1, 0), 0.06) && grid.at(20, 0, 0) > 10, 'the grid matches the field, and gives a large distance far outside');
  const shade = softShadow((x, y, z) => grid.at(x, y, z), 0, -0.95, 0, 0, 1, 0), open = softShadow((x, y, z) => grid.at(x, y, z), 3, -0.95, 0, 0, 1, 0);
  assert(shade < 0.1 && open > 0.9, `under the roof ${shade.toFixed(2)}, in the open ${open.toFixed(2)}`);
  const lamp = paint({ shapes: [{ type: 'sphere', size: [0.3], mat: { color: [1, 0.9, 0.5], glow: true, jitter: 0 } }] }, { density: 300, rand: rng(2) }); bake(lamp, { sun: [0, 1, 0] });
  assert(lamp.color[0] === lamp.albedo[0] && lamp.color[2] === lamp.albedo[2], 'a lamp keeps its colour');
  pass('the light is baked in: sun and shade, a cast shadow, and a lamp that glows');
}

{ // The island: every object has strokes; the goat is in parts round its joints; nothing stands on the goat's path;
  // the sea is at the water line; the ground has a height everywhere on the island.
  const isle = await build(1, { density: 120, cell: 0.24, yieldTo: async () => {} });
  const ids = isle.objects.map(o => o.id); for (const want of ['island', 'cottage', 'lighthouse', 'goat']) assert(ids.includes(want), want);
  assert(ids.filter(i => i.startsWith('tree')).length >= 3 && ids.filter(i => i.startsWith('rock')).length >= 3 && ids.filter(i => i.startsWith('cloud')).length === 3);
  for (const p of isle.parts) assert(p.splats.count > 0, p.name + ' has strokes');
  const goat = isle.objects.find(o => o.id === 'goat'); assert(goat.rig && goat.parts.filter(p => p.startsWith('goat-leg')).length === 4 && goat.parts.includes('goat-head') && goat.parts.includes('goat-tail'));
  for (const o of isle.objects) if (!o.fixed && !o.rig && !o.cloud) { const r = Math.hypot(o.center[0], o.center[2]); assert(Math.abs(r - ISLAND.path) > 0.6, o.id + ' is clear of the path'); }
  const sea = isle.parts.find(p => p.name === 'sea'); assert.equal(sea.pivot[1], ISLAND.water);
  const ground = isle.parts.find(p => p.name === 'ground'); for (let i = 0; i < ground.splats.count; i++) assert(ground.splats.pos[i * 3 + 1] > ISLAND.water - 0.2, 'no strokes far under the sea');
  for (let a = 0; a < Math.PI * 2; a += 0.3) { const h = heightAt(Math.cos(a) * ISLAND.path, Math.sin(a) * ISLAND.path); assert(h > -0.6 && h < 0.8, 'the path has ground under it: ' + h.toFixed(2)); }
  const again = await build(1, { density: 120, cell: 0.24, yieldTo: async () => {} }); assert.equal(again.count, isle.count, 'the same seed builds the same island');
  const other = await build(2, { density: 120, cell: 0.24, yieldTo: async () => {} }); assert.notDeepEqual(other.objects.map(o => o.center), isle.objects.map(o => o.center), 'another seed builds another island');
  pass('the island has every object, a jointed goat and a clear path', { splats: isle.count, objects: ids.length });
}
console.log(`${n} checks passed`);
