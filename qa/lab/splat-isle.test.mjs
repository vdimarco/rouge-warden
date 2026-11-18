// Splat Isle's painter and island (public/lab/splat-isle/sdf.js and scene.js), checked in node with no browser:
// the distance shapes, the strokes on the surface, the spread of strokes, the baked light and shadow, and the island.
// Run: node qa/lab/splat-isle.test.mjs
import assert from 'node:assert/strict';
import { PRIMS, smin, prepare, field, paint, bake, Grid, softShadow, rng } from '../../public/lab/splat-isle/sdf.js';
import { build, figure, goat, world, ISLANDS, ORDER, SEA, sproutSpots } from '../../public/lab/splat-isle/scene.js';
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

{ // The five islands: each has ground, a dock and the things its story needs; nothing in the story is missing from any seed
  // of the layout; the ground clips at the sea; the same island paints the same way; what the save says is broken stays gone.
  const fast = { density: 110, cell: 0.3, yieldTo: async () => {} }, made = {};
  for (const id of ORDER) made[id] = await build(id, fast);
  const ids = id => made[id].objects.map(o => o.id), has = (id, ...want) => { for (const w of want) assert(ids(id).includes(w), `${id} has ${w}: ${ids(id)}`); };
  for (const id of ORDER) { has(id, 'ground', 'dock'); const g = made[id].parts.find(p => p.name === 'ground'); for (let i = 0; i < g.splats.count; i++) assert(g.splats.pos[i * 3 + 1] > SEA - 0.2, 'no strokes far under the sea'); const [sx, sz] = made[id].start; assert(Math.hypot(sx, sz) < ISLANDS[id].radius - 0.5 && made[id].heightAt(sx, sz) > -0.5, id + ' start is on land'); }
  has('home', 'cottage', 'well', 'bloom'); has('orchard', 'gardener', 'thorn0', 'thorn1', 'thorn2', 'thorn3', 'wall'); has('bell', 'tower', 'bellringer'); has('wreck', 'fisher', 'crate0', 'crate1', 'crate2', 'crate3'); has('light', 'lighthouse', 'lampkeeper');
  const loot = ORDER.flatMap(id => made[id].objects.filter(o => o.loot).map(o => o.loot));
  assert.equal(loot.filter(l => l === 'shell').length, 7, 'seven shells to find'); assert.equal(loot.filter(l => l === 'rope').length, 1, 'one rope'); assert.equal(loot.filter(l => l === 'stone').length, 1, 'one stone');
  assert.equal(made.orchard.objects.find(o => o.id === 'wall').hits, 2, 'the wall takes two hits'); for (const o of made.orchard.objects.filter(q => q.id.startsWith('thorn') && q.id !== 'thorntree')) assert.equal(o.again, 'never', 'cleared thorns stay cleared');
  for (const id of ORDER) for (const p of made[id].parts) assert(p.splats.count > 0, `${id}/${p.name} has strokes`);
  // the lighthouse's lamp is its own glowing part, so the page can keep it dark until it is lit
  assert(made.light.parts.some(p => p.object === 'lighthouse' && p.glow), 'a lamp part');
  const again = await build('bell', fast); assert.equal(again.count, made.bell.count, 'the same island paints the same way');
  const broken = await build('wreck', { ...fast, state: { broken: { crate0: 'never', barrel1: 'dawn' } } }); assert(!broken.objects.some(o => o.id === 'crate0' || o.id === 'barrel1'), 'broken things stay gone');
  const far = await build('light', { density: 60, cell: 0.5, far: true, yieldTo: async () => {} }); assert(far.count < made.light.count && far.objects.some(o => o.id === 'lighthouse') && !far.objects.some(o => o.person), 'the far copy is light, with the big things only');
  pass('five islands with every thing the story needs', Object.fromEntries(ORDER.map(id => [id, made[id].count])));
}

{ // Thorn sprouts come up on Home Isle at dawn and grow into thorn trees after two days.
  const ids = sproutSpots(3, 2); assert.deepEqual(ids, ['sprout-3-0', 'sprout-3-1']);
  const day = 5, state = { day, sprouts: [[ids[0], day], [ids[1], day - 2]] };
  const home = await build('home', { density: 110, cell: 0.3, state, yieldTo: async () => {} }), a = home.objects.find(o => o.id === ids[0]), b = home.objects.find(o => o.id === ids[1]);
  assert(a && b, 'both sprouts come up'); assert.equal(a.kind, 'thornbush'); assert.equal(b.kind, 'thorntree', 'an old sprout is a thorn tree'); assert.equal(b.hits, 3);
  const again = await build('home', { density: 110, cell: 0.3, state: { day: 6, sprouts: [[ids[0], day]] }, yieldTo: async () => {} }); assert.deepEqual(again.objects.find(o => o.id === ids[0]).center.map(v => +v.toFixed(3)).filter((v, i) => i !== 1), a.center.map(v => +v.toFixed(3)).filter((v, i) => i !== 1), 'a sprout stays where it came up');
  pass('thorn sprouts come up and grow', { sprouts: home.sprouts.length });
}

{ // People, the goat, the sea and the clouds.
  for (const kind of ['keeper', 'gardener', 'bellringer', 'fisher', 'lampkeeper']) { const parts = figure(kind, { density: 120 }); assert(parts[0].splats.count > 100, kind + ' has strokes'); }
  assert(figure('keeper', { density: 120 }).some(p => p.glow), 'the keeper carries a lantern');
  const g = goat({ density: 120 }); assert(g.filter(p => p.name.startsWith('goat-leg')).length === 4 && g.some(p => p.name === 'goat-head') && g.some(p => p.name === 'goat-tail'), 'a jointed goat');
  const w = world({ density: 120 }); assert.equal(w.sea.pivot[1], SEA); assert.equal(w.clouds.length, 6); assert(w.sea.splats.count > 5000);
  pass('people, a jointed goat, the sea and clouds');
}
console.log(`${n} checks passed`);
