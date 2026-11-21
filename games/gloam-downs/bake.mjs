// Bake the Gloam Downs places into public/lab/gloam-downs/worlds/.
//   node bake.mjs                 every place
//   node bake.mjs gaol fen        only these
//   node bake.mjs gaol --preview  also draw CPU previews (from the start point and from above) into --out (default ./preview)
//   --out DIR  --w 640 --h 360
//   node bake.mjs foes boss       the foe files and the boss files (see lib/foes.mjs and lib/boss.mjs)
//   --worlds DIR  write there instead of public/lab/gloam-downs/worlds/;  --no-zones  leave the zones out of <id>.json
// For each place it writes <id>.bin.gz (SplatCodec rows, gzipped), <id>.walk.bin.gz (the walk map) and <id>.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { checkPlace } from './lib/check.mjs';
import { closeWalk } from './lib/traps.mjs';
import { lib, K, palette, hills, terrain, walkMap, walkCells, WALK_LAYERS, lamplighter, shadowDisc, wisp, fire, embers, BONES, INK_VERSION } from './lib/common.mjs';
import { zonesOf, zoneOf, zoneJson } from './lib/zones.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.resolve(HERE, '../../public/lab/gloam-downs/worlds');
export const ORDER = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];

export async function loadPlace(id) {
  return (await import(`./biomes/${id}.mjs`)).default;
}

// the scenery of a place, with its marks (the start, the wisps, the beacon, the zones), ready for the walk map and the bake
function scenery(def) {
  const P = palette(def.palette);
  const B = lib.makeBuilder(def.seed || 7, P.pal, { renderMetadata: false });
  const S0 = K.sculpt(lib.makeSculpt(B));
  /* A lamp turns a material onto its lit ramp (m.g) where the lamp outshines the sky. A one-step ramp there gives a flat slab of colour,
     so a one-step g is widened, from the material's own dark tones up through the shared fire ramp: lamp light falls off as a warm pool.
     Every call through ctx.S passes its materials through here (including the props' and the kit's, which are handed ctx.S). */
  const family = i => Object.values(P.at).find(r => r.includes(i) && r.length > 1) || [i];
  const fireR = P.ramp('fire');
  const fixMat = (m, depth = 0) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (Array.isArray(m.r) && Array.isArray(m.g) && m.g.length === 1 && !m._warm) {
      const R = family(m.g[0]), k = R.indexOf(m.g[0]);
      m.g = [R[Math.max(0, k - 1)], R[k], fireR[0], fireR[1], fireR[2], fireR[3]];
      m._warm = true;
    }
    // a material's `top` is a material too: widen its one-step g the same way
    if (Array.isArray(m.r)) { if (depth < 2) fixMat(m.top, depth + 1); }
    else if (depth < 1) for (const v of Object.values(m)) fixMat(v, depth + 1);
  };
  const warm = s => new Proxy(s, {
    get(t, k) {
      const v = t[k];
      return typeof v === 'function' ? (...a) => { for (const x of a) fixMat(x); return v.apply(t, a); } : v;
    }
  });
  const S = warm(S0);
  const L = def.light;
  S.sun = B.norm(L.sun);
  S.amb = L.amb;
  S.sky = L.sky;
  S.sunK = L.sunK;
  if (L.shK !== undefined) S.shK = L.shK;
  if (L.aoK !== undefined) S.aoK = L.aoK;
  const h = hills(B, def.hills);
  const marks = { wisps: [], beacon: null, spawn: null, fires: [], embers: [], late: [], glow: [], lamps: [], zones: [] };
  const ctx = {
    B, S, K, P, h, lib,
    ramp: P.ramp,
    terrain: (mat, o) => terrain(S, h, mat, o),
    // a lamp baked into the scenery's colours: c is two palette names' indices [warm, hot] the lit ramp steps to
    lamp: (p, r = 4.5, s = 0.9, sh = true) => { S0.lights.push({ p, r, s, sh }); marks.lamps.push(p); },
    fire: (p, s = 1, o = {}) => { marks.fires.push({ p, s }); if (o.embers !== false) marks.embers.push({ p, n: o.n || 6 }); if (o.lamp !== false) ctx.lamp([p[0], p[1] + 0.5 * s, p[2]], o.r || 4.5 * s, o.k || 0.9, true); },
    wisp: (p) => marks.wisps.push(p),
    beacon: (p, r = 1.6) => { marks.beacon = { p, r }; },
    spawn: (p, yaw = 0) => { marks.spawn = { p, yaw }; },
    // a zone of the combat run, from lib/zones.mjs: it adds nothing to the scenery, only to <id>.json
    zone: zid => { const z = zoneOf(def.id, zid); if (!marks.zones.includes(z)) marks.zones.push(z); return z; },
    later: (fn) => marks.late.push(fn), // solids that must not block the feet: added after the walk map, baked with the scenery
    glow: (fn) => marks.glow.push(fn) // emissive extras (motes, sky, moon): added after every bake
  };
  // GLOAM_COUNT=1: list the heaviest solids (where, size, spacing, splats), to keep a place inside its budget
  const per = new Map();
  if (process.env.GLOAM_COUNT) { const prev = S.emit; S.emit = (pr, n0, n1) => { if (prev) prev(pr, n0, n1); if (pr) per.set(pr, (per.get(pr) || 0) + n1 - n0); }; }
  def.build(ctx);
  if (!marks.spawn || !marks.beacon || marks.wisps.length !== 5) throw new Error(`${def.id}: needs a spawn, a beacon and five wisps`);
  const missing = zonesOf(def.id).filter(z => !marks.zones.includes(z)).map(z => z.id);
  if (missing.length) throw new Error(`${def.id}: lib/zones.mjs has zones the place does not place: ${missing.join(' ')}`);
  return { P, B, S0, S, L, h, marks, ctx, per, warm };
}
// the walk map as the march reads it from the scenery's distance field (S.ready() tells the field where the solids are, before the
// bake), before closeWalk(). -> { walk, marks, place: the start, beacon and bounds for closeWalk() }, and the scenery for build()
export function march(def) {
  const t0 = performance.now(), sc = scenery(def), W = def.walk || {}, t1 = performance.now();
  sc.S.ready();
  const walk = walkMap(sc.S, sc.h, { x0: -W.half || -36, x1: W.half || 36, z0: -W.half || -36, z1: W.half || 36, step: 0.25, ...W.opts });
  return { ...sc, walk, place: { spawn: sc.marks.spawn, beacon: sc.marks.beacon, bounds: W.half || 36 }, times: [t0, t1, performance.now()] };
}

// build one place; returns { world, meta, walk, stats }. zones: false leaves the zones out of the JSON (and only out of it)
export function build(def, { zones = true } = {}) {
  const sc = march(def), { P, B, S0, S, L, h, marks, ctx, per, warm, walk } = sc, [t0, t1, t2] = sc.times;
  /* the cracks the search reaches, and no trap in reach (lib/traps.mjs closeWalk()): a trap the size of a crack is filled, a wider one
     fails the bake. The last reach search of it is on the final walk map, so the check uses it */
  let traps;
  try { traps = closeWalk(walk, sc.place, { clear: walk.clear }); } catch (e) { throw new Error(`${def.id}: ${e.message}`); }
  walk.cracks = traps.cracks + traps.cracked.length;
  walk.traps = traps.changed;
  walk.cracked = traps.cracked;
  walk.gaps = walk.T.reduce((n, t, k) => n + (walk.G[k] < t ? 1 : 0), 0);
  const t2r = performance.now();
  /* then what must not block the feet (water, hanging cloth, chains), and one bake of it all, so the scenery shadows the late solids and
     hides what of them is buried in it. Baked alone, they would be lit in a field that holds nothing else */
  for (const fn of marks.late) fn(ctx);
  S.bake();
  const nScenery = B.count();
  const heavy = [...per].map(([pr, n]) => ({ n, at: (pr.bc || []).map(v => +v.toFixed(1)), br: +(pr.br || 0).toFixed(1), res: pr.res }));
  if (heavy.length) { heavy.sort((a, b) => b.n - a.n); console.log('heaviest solids:'); for (const x of heavy.slice(0, 25)) console.log('  ', x.n, 'at', x.at.join(','), 'r', x.br, 'res', x.res); }
  const t3 = performance.now();
  /* the lamplighter, lit by this place's sky (a little more fill, so it reads against the dark). It has a sculptor of its own: a bake
     gives S.sdf the field of the solids in that bake, so this way S.sdf in glow() still reads the scenery and the late solids */
  const SL = warm(K.sculpt(lib.makeSculpt(B)));
  for (const k of ['sun', 'sunK', 'shK', 'aoK']) SL[k] = S0[k];
  SL.amb = L.amb + 0.12;
  SL.sky = L.sky + 0.1;
  const tags = K.deform.tags(SL);
  const rig = lamplighter(SL, P);
  shadowDisc(SL, P, P.ramp('shade')[0]);
  SL.bake();
  const t4 = performance.now();
  // what glows
  const fires = marks.fires.map(f => fire(B, P, f.p, f.s));
  for (const e of marks.embers) embers(B, P, e.p, e.n);
  const wisps = marks.wisps.map((p, i) => ({ p, ids: wisp(B, P, p, i * 1.3) }));
  const bp = marks.beacon.p;
  const beaconFire = [fire(B, P, [bp[0], bp[1] + 0.15, bp[2]], 1.7)];
  {
    const n0 = B.count();
    embers(B, P, [bp[0], bp[1] + 0.3, bp[2]], 14, 0.5, 3.4);
    beaconFire.push([n0, B.count()]);
  }
  for (const fn of marks.glow) fn(ctx);
  const world = B.finish({
    cam: { target: [marks.spawn.p[0], marks.spawn.p[1] + 1, marks.spawn.p[2]], dist: 9, pitch: 0.32, yaw: marks.spawn.yaw + Math.PI },
    detail: 9,
    dither: def.dither ?? 0.45,
    radius: def.fog.far - 9,
    fog: { c: P.ramp(def.fog.color)[0], start: def.fog.start ?? 0.55, max: def.fog.max ?? 0.85 },
    outline: { c: P.ramp('ink')[0], edge: def.outline ?? 0.5 },
    ao: def.ao || { k: 0.5, range: 0.6 }
  });
  // put the lamplighter's splats on GPU bones
  const ids = [], bid = [];
  BONES.forEach((name, b) => { for (const i of tags[name] || []) { ids.push(i); bid.push(b); } });
  const tagged = K.bones.tag(world, Int32Array.from(ids), Int32Array.from(bid));
  if (tagged.cpu.length) throw new Error(`${def.id}: ${tagged.cpu.length} lamplighter splats could not ride a bone`);
  const boned = Array.from(tagged.boned);
  const t5 = performance.now();
  const meta = {
    format: 'gloam-downs/1',
    ink: INK_VERSION,
    id: def.id, name: def.name, sub: def.sub,
    count: world.count, pal: world.pal, cam: world.cam, radius: world.radius, fog: world.fog, dither: world.dither,
    outline: world.outline, ao: world.ao, seed: world.seed,
    moving: Array.from(world.moving || []), back: Array.from(world.back || []),
    fogFar: def.fog.far, fogNear: def.fog.near ?? 10,
    spawn: marks.spawn,
    beacon: { p: bp, r: marks.beacon.r, fire: beaconFire },
    wisps,
    fires: fires.length,
    bones: { names: BONES, pivots: BONES.map(n => rig.pivots[n]), first: Math.min(...boned), end: Math.max(...boned) + 1, count: boned.length },
    walk: { x0: walk.x0, z0: walk.z0, step: walk.step, nx: walk.nx, nz: walk.nz, layers: WALK_LAYERS, unit: 0.01 },
    bounds: def.walk?.half || 36,
    hint: def.hint || ''
  };
  // in the module's order, so the JSON's zones equal the module's
  if (zones) meta.zones = zonesOf(def.id).map(zoneJson);
  const stats = {
    splats: world.count, build: Math.round(t1 - t0), walk: Math.round(t2 - t1), reach: Math.round(t2r - t2), bake: Math.round(t3 - t2r),
    avatar: Math.round(t4 - t3), finish: Math.round(t5 - t4), gaps: walk.gaps, cracks: walk.cracks, traps: walk.traps.length, boned: boned.length,
    scenery: nScenery, glow: world.count - nScenery - boned.length
  };
  return { world, meta, walk, stats, P, reach: traps.R };
}

export function save(id, { world, meta, walk }, out = OUT) {
  fs.mkdirSync(out, { recursive: true });
  const bytes = K.procedural.splatCodec.encode(world.data, world.count);
  const gz = zlib.gzipSync(bytes, { level: 9 });
  const wgz = zlib.gzipSync(Buffer.from(walkCells(walk).buffer), { level: 9 });
  fs.writeFileSync(path.join(out, id + '.bin.gz'), gz);
  fs.writeFileSync(path.join(out, id + '.walk.bin.gz'), wgz);
  const json = JSON.stringify(meta);
  fs.writeFileSync(path.join(out, id + '.json'), json);
  return { splatsGz: gz.length, walkGz: wgz.length, jsonBytes: Buffer.byteLength(json) };
}

// a CPU picture of a place: the lamplighter stood at the start point, seen from the follow camera, from the beacon, or from above
const inkCli = () => createRequire(import.meta.url)('@shapeshift-labs/ink-studio/cli/render.js');
const pngCli = () => createRequire(import.meta.url)('@shapeshift-labs/ink-studio/cli/png.js');
// bone b moves its splats by x' = A (x - from) + to
export function boneAt(out, b, A, from, to) {
  out.set([A[0], A[1], A[2], A[3], A[4], A[5], A[6], A[7], A[8],
    to[0] - (A[0] * from[0] + A[1] * from[1] + A[2] * from[2]),
    to[1] - (A[3] * from[0] + A[4] * from[1] + A[5] * from[2]),
    to[2] - (A[6] * from[0] + A[7] * from[1] + A[8] * from[2])], 12 * b);
}
export function preview(built, { w = 640, h = 360, px = 2, view = 'start', file, pose, cam }) {
  const { world, meta } = built;
  const s = meta.spawn, names = meta.bones.names, n = names.length;
  const bones = new Float32Array(12 * n);
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), A = [c, 0, sn, 0, 1, 0, -sn, 0, c];
  const body = meta.bones.pivots[0];
  names.forEach((name, b) => {
    if (name === 'shadow') boneAt(bones, b, [1, 0, 0, 0, 1, 0, 0, 0, 1], meta.bones.pivots[b], [s.p[0], s.p[1] + 0.03, s.p[2]]);
    else boneAt(bones, b, A, [body[0], body[1] - 0.1, body[2]], s.p);
  });
  if (pose) pose(bones);
  const ids = [];
  for (let i = meta.bones.first; i < meta.bones.end; i++) ids.push(i);
  world.anim = { bones, boned: Int32Array.from(ids) };
  const posed = K.bones.posed(world);
  const W2 = { ...world, data: posed, anim: undefined };
  if (cam) W2.cam = cam;
  else if (view === 'top') W2.cam = { target: [0, 0, 0], dist: 80, pitch: 1.15, yaw: 0.3 };
  else if (view === 'beacon') W2.cam = { target: meta.beacon.p, dist: 13, pitch: 0.28, yaw: s.yaw + Math.PI + 0.7 };
  else if (view === 'wide') W2.cam = { target: [s.p[0], s.p[1] + 2, s.p[2]], dist: 22, pitch: 0.3, yaw: s.yaw + Math.PI + 0.25 };
  else W2.cam = { target: [s.p[0], s.p[1] + 1, s.p[2]], dist: 9, pitch: 0.3, yaw: s.yaw + Math.PI };
  // the page keeps the fog at the same distance whatever the camera's distance: radius = far - dist
  W2.radius = Math.max(8, meta.fogFar - W2.cam.dist);
  const R = inkCli();
  const art = R.render(W2, { w, h, px, colored: true });
  const big = R.upscale(art, art.px);
  if (file) pngCli().write(file, big.w, big.h, big.rgb);
  return art;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
  const VAL = new Set(['--out', '--w', '--h', '--worlds']); // the options that take a value; --check, --preview and --no-zones do not
  const ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.has(args[i - 1])));
  const list = ids.length ? ids : ORDER;
  const prev = args.includes('--preview'), out = opt('out') || path.join(HERE, 'preview');
  const worlds = opt('worlds') ? path.resolve(opt('worlds')) : OUT;
  for (const id of list) {
    if (id === 'foes' || id === 'boss') {
      const { bakeFigures } = await import('./lib/figures.mjs');
      const res = await bakeFigures(id, { worlds, preview: prev ? out : null });
      for (const line of res.lines) console.log(line);
      if (args.includes('--check')) {
        for (const r of res.checks) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
        if (res.checks.some(r => !r.ok)) process.exitCode = 1;
      }
      continue;
    }
    const def = await loadPlace(id);
    const built = build(def, { zones: !args.includes('--no-zones') });
    const sizes = save(id, built, worlds);
    console.log(`${id}: ${JSON.stringify(built.stats)} gz ${(sizes.splatsGz / 1e6).toFixed(2)} MB, walk ${(sizes.walkGz / 1e3).toFixed(0)} KB`);
    for (const c of built.walk.traps) console.log(`  trap filled at (${c.x}, ${c.z}): top/floor/underside ${c.before.join('/')} -> ${c.after.join('/')} cm`);
    for (const c of built.walk.cracked) console.log(`  crack closed by a later pass at (${c.x}, ${c.z}): top/floor/underside ${c.before.join('/')} -> ${c.after.join('/')} cm`);
    let frame;
    if (prev || args.includes('--check')) {
      fs.mkdirSync(out, { recursive: true });
      const w = +(opt('w') || 640), h = +(opt('h') || 360);
      frame = preview(built, { w, h, view: 'start', file: prev ? path.join(out, `${id}-start.png`) : undefined });
      if (prev) for (const view of ['wide', 'beacon', 'top']) preview(built, { w, h, view, file: path.join(out, `${id}-${view}.png`) });
      if (prev) console.log(`  previews in ${out}`);
    }
    if (args.includes('--check')) {
      // a place's 1.5 MB counts its three files: the splats, the walk map and its JSON
      const res = checkPlace(built, { gzBytes: sizes.splatsGz + sizes.walkGz + sizes.jsonBytes, frame, worlds });
      for (const r of res) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`);
      if (res.some(r => !r.ok)) process.exitCode = 1;
    }
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
