// js/story/world/sedona.js : the WORLD package. init(S) fills S.world: a 2 km Sedona built from a fixed seed
// by gen.worker.js (heights, surface types, the road mask, the map, flora, tiles), then assembled on the
// main thread in small steps inside the 'world' phase (terrain, water, bridges, town, interiors, flora,
// map) so no frame blocks. Everything lives in S.world.group, never in the arena group.
// Heights are exact (the terrain's own triangles); surface() adds walkable boxes (decks, floors) and ignores
// the terrain inside an interior volume (C3).
import { WORLD, REGIONS, INTERIORS, point } from './places.js';
import { buildNetwork, nearest, route, sample, LOTS } from './roads.js';
import { heightAt, generate, buildTile, TILES, HALF, TYPES, TGRID, TCELL, MASK, MPX, MAP, dec, fromHalf, walkAt } from './gen.worker.js';
import { createColliders } from './colliders.js';
import { createTerrain, terrainMaterial, sharedUniforms } from './terrain.js';
import { createFlora } from './flora.js';
import { createWater } from './water.js';
import { createBridges } from './bridge.js';
import { createTown } from './town.js';
import { createInteriors } from './interiors.js';
import { createMap } from './map.js';
import { lastInfo } from '../../render.js';
import { QUALITY } from '../look/quality.js';
import { PALETTE } from '../look/palette.js';
const ROOM_LAMP = 60; // the bar's two lamps (W.update)

// Every base colour the world paints with (display sRGB), for LOOK's palette check (palette.mjs). Greens stay
// bluish (g - b < 0.12) and nothing is yellow-green. (The road and sidewalk paint takes LOOK's PALETTE.)
const srgb = (hex) => [16, 8, 0].map((s) => Math.round(((hex >> s) & 255) / 255 * 1000) / 1000);
export const WORLD_PALETTE = Object.freeze({
  soilRed: [0.64, 0.31, 0.19], soilDark: [0.54, 0.25, 0.16], scrub: [0.43, 0.4, 0.33], sand: [0.76, 0.62, 0.47], creekStone: [0.42, 0.39, 0.36],
  strataRed: [0.62, 0.27, 0.16], strataOrange: [0.7, 0.36, 0.21], strataDark: [0.55, 0.24, 0.15], strataBuff: [0.74, 0.48, 0.33], capRock: [0.8, 0.69, 0.55],
  asphalt: srgb(PALETTE.asphalt), asphaltWorn: srgb(PALETTE.asphaltWorn), dirtRoad: [0.66, 0.44, 0.3], edgeLine: srgb(PALETTE.roadLine), centreLine: [0.8, 0.48, 0.16],
  parkingLine: srgb(PALETTE.parkingLine), shoulder: srgb(PALETTE.shoulder), sidewalk: srgb(PALETTE.concrete), curb: srgb(PALETTE.curb),
  juniper: [0.3, 0.4, 0.35], cottonwood: [0.36, 0.47, 0.4], agave: [0.4, 0.47, 0.44], pricklyPear: [0.36, 0.44, 0.36], boulder: [0.62, 0.33, 0.22],
  grassStraw: [0.66, 0.55, 0.38], grassBlue: [0.48, 0.5, 0.45], waterDeep: [0.15, 0.3, 0.3], waterShallow: [0.38, 0.47, 0.43],
  stucco: [0.8, 0.66, 0.52], adobe: [0.72, 0.47, 0.33], wood: [0.56, 0.4, 0.28], block: [0.66, 0.63, 0.58], metal: [0.72, 0.74, 0.74],
  steel: [0.44, 0.47, 0.48], concrete: [0.62, 0.6, 0.56], jeepTangerine: [0.93, 0.46, 0.12], vanWhite: [0.93, 0.93, 0.92], barnRed: [0.46, 0.2, 0.15],
  barWall: [0.42, 0.2, 0.14], poolFelt: [0.12, 0.3, 0.36], windowGlow: [1, 0.48, 0.2], lampShade: [1, 0.76, 0.48],
});

// view distance (day, night) and tile LOD bias per tier come from LOOK's quality table (one source for C8)
const VIEW = QUALITY.map((t) => [t.view.day, t.view.night]), BIAS = QUALITY.map((t) => t.lodBias);
const NIGHT_LOOKS = { NIGHT: 1, MEMORY_NIGHT: 1, VORTEX: 1, DEEP_INK: 1, INTERIOR: 1, ARENA: 1, DUSK: 0.55, DAWN: 0.45 };

export function init(S) {
  const { THREE } = S;
  const group = new THREE.Group(); group.name = 'sedona'; group.visible = false;
  S.scene.add(group);
  const C = createColliders();
  const net = buildNetwork();
  const shared = sharedUniforms();
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = MAP;
  const revealed = new Set();
  let H = null, types = null, mask = null, ground = null, lotIds = null, data = null;
  const parts = {};
  let worker = null, steps = null, stepI = 0, genP = 0, failed = false;
  const build = { t0: 0, worker: 0, steps: [], longest: 0, ms: null };

  /* ---------------- the worker */
  function start() {
    if (worker || data) return;
    build.t0 = performance.now();
    try {
      worker = new Worker(new URL('./gen.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => onMessage(e.data);
      worker.onerror = (e) => { console.error('[world] the terrain worker failed; building on the main thread', e.message); worker = null; mainThreadBuild(); };
      worker.postMessage({ init: { seed: WORLD.SEED } });
    } catch (e) { console.warn('[world] no module worker here; building on the main thread', e); worker = null; mainThreadBuild(); }
  }
  // the fallback: the same generator on this thread (a one-off stall)
  let mainCtx = null;
  function mainThreadBuild() {
    if (data || failed) return;
    try {
      const g = generate(WORLD.SEED); mainCtx = g.ctx;
      const tiles = []; for (let j = 0; j < TILES; j++) for (let i = 0; i < TILES; i++) tiles.push(buildTile(mainCtx, i, j, 2));
      onMessage({ type: 'init', heights: g.H, types: g.types, mask: g.mask, ground: g.ground, lotIds: g.lotIds, map: g.map, scatter: g.scatter, rockColliders: g.rockColliders, creek: g.creek, wash: g.wash, bridges: g.bridges, tiles, ms: g.ms });
    } catch (e) { failed = true; console.error('[world] could not build Sedona', e); }
  }
  function onMessage(m) {
    if (m.type === 'progress') genP = m.p;
    else if (m.type === 'init') {
      data = m; H = m.heights; types = m.types; mask = m.mask; ground = m.ground; lotIds = m.lotIds;
      build.worker = performance.now() - build.t0; build.ms = m.ms;
      steps = makeSteps();
      idle();
    } else if (m.type === 'tile') { if (parts.terrain) parts.terrain.add(m.tile); }
    else if (m.type === 'error') { console.error('[world] worker error', m.message); }
  }
  const request = (i, j, lod) => { if (worker) worker.postMessage({ tile: { i, j, lod } }); else if (mainCtx) parts.terrain.add(buildTile(mainCtx, i, j, lod)); };

  /* ---------------- assembly, one step per frame */
  function makeSteps() {
    return [
      ['terrain', () => {
        // the road masks, read bilinear (the shader anti-aliases its own edges; no mipmaps: the ids are exact);
        // the ground's are half floats; the lot ids are read exact
        const tex = (data, format, type) => { const t = new THREE.DataTexture(data, MASK, MASK, format, type); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
        const roadTex = tex(mask, THREE.RGBAFormat, THREE.UnsignedByteType), groundTex = tex(ground, THREE.RGBAFormat, THREE.HalfFloatType), lotTex = tex(lotIds, THREE.RedFormat, THREE.UnsignedByteType);
        lotTex.minFilter = lotTex.magFilter = THREE.NearestFilter;
        parts.roadTex = roadTex; parts.groundTex = groundTex; parts.lotTex = lotTex;
        parts.terrainMat = terrainMaterial(THREE, shared, { road: roadTex, ground: groundTex, lots: lotTex }, net, LOTS);
        parts.terrain = createTerrain(S, { THREE, group, material: parts.terrainMat, tiles0: data.tiles, request });
        for (const c of data.rockColliders) C.addCircle(c.x, c.z, c.r, { tag: 'rock' });
      }],
      ['town', () => createTown(S, { THREE, group, colliders: C, height: W.height, net })],
      ['bridges', () => { parts.bridges = createBridges(S, { THREE, group, colliders: C, material: parts.town.material, bridges: data.bridges, height: W.height }); }],
      ['interiors', () => {
        const mat = parts.town.material.clone(); mat.side = THREE.DoubleSide; mat.emissiveIntensity = 0;
        parts.interiors = createInteriors(S, { THREE, group, colliders: C, material: mat });
      }],
      ['flora', () => createFlora(S, { THREE, group, shared, data: data.scatter, H, types, ground, colliders: C })],
      ['water', () => { parts.water = createWater(S, { THREE, group, shared, creek: data.creek, heightTex: parts.flora.heightTex, H, heightAt }); }],
      ['map', () => createMap(S, { mapBytes: data.map, net, creek: data.creek, revealed, canvas: mapCanvas })],
    ];
  }
  // Steps run until about `budget` ms are used. A step is a function, or returns a generator that yields
  // between slices and returns the part (town, flora). They run in the story's 'world' phase and, like any
  // asset loading, in the browser's idle time before that (so NEW STORY's cold open finds Sedona built).
  let cur = null, curMs = 0;
  function idle() {
    if (W.ready || typeof window === 'undefined') return;
    const ric = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 120 }) : (f) => setTimeout(() => f({ timeRemaining: () => 8, didTimeout: true }), 16);
    ric((dl) => { runStep(Math.max(4, Math.min(8, dl.timeRemaining ? dl.timeRemaining() : 8))); settle(); idle(); });
  }
  function settle() {
    if (W.ready) return;
    W.progress = Math.min(0.99, (data ? 1 : genP) * 0.6 + (steps ? stepI / steps.length : 0) * 0.4);
    if (steps && stepI >= steps.length && parts.town.glb.done) {
      W.ready = true; W.progress = 1; build.total = performance.now() - build.t0;
      console.info(`[world] Sedona built in ${Math.round(build.total)} ms (worker ${Math.round(build.worker)} ms; longest main-thread slice ${Math.round(build.longest)} ms)`);
    }
  }
  function runStep(budget = 8) {
    const t0 = performance.now();
    while (steps && stepI < steps.length && performance.now() - t0 < budget) {
      const [name, fn] = steps[stepI], t = performance.now();
      let done = true;
      if (!cur) { const r = fn(); if (r && typeof r.next === 'function') { cur = r; done = false; } }
      if (cur) { const r = cur.next(); done = r.done; if (r.done) { parts[name] = r.value; cur = null; } }
      const ms = performance.now() - t; curMs += ms; build.longest = Math.max(build.longest, ms);
      if (done) { build.steps.push([name, Math.round(curMs)]); curMs = 0; stepI++; }
    }
  }

  /* ---------------- queries */

  const typeAt = (x, z) => types[Math.min(TGRID - 1, Math.max(0, Math.floor((z + HALF) / TCELL))) * TGRID + Math.min(TGRID - 1, Math.max(0, Math.floor((x + HALF) / TCELL)))];
  // what the masks say at (x,z) (the texel's values, gen.worker.js roadMask): {road, d: signed distance to its
  // centreline, e: meters past the nearest road edge, lot, l: signed distance to its edge, walk: signed distance
  // to the nearest sidewalk's edge}, or null
  function maskAt(x, z) {
    if (!mask) return null;
    const mi = Math.min(MASK - 1, Math.max(0, Math.floor((x + HALF) / MPX))), mj = Math.min(MASK - 1, Math.max(0, Math.floor((z + HALF) / MPX))), mk = (mj * MASK + mi) * 4;
    const id = mask[mk + 1], lid = lotIds[mk >> 2];
    return { road: id ? net.roads[id - 1] : null, d: dec(mask[mk]), e: fromHalf(ground[mk]), lot: lid ? LOTS[lid - 1] : null, l: fromHalf(ground[mk + 1]), walk: walkAt(ground, mk) };
  }
  const W = S.world = {
    ready: false, progress: 0, SCALE: WORLD.SCALE, HALF: WORLD.HALF, group,
    get visible() { return group.visible; },
    get parkedCars() { return parts.town?.parkedCars || []; },
    // terrain only: the exact height of the terrain triangles
    height(x, z) { return H ? heightAt(H, x, z) : 0; },
    normal(x, z, out = new THREE.Vector3()) { const e = 1.5; return out.set(W.height(x - e, z) - W.height(x + e, z), 2 * e, W.height(x, z - e) - W.height(x, z + e)).normalize(); },
    // the highest walkable top at or below yHint + 0.8: terrain, decks, floors. Inside an interior volume the
    // terrain is ignored (C3). With no hint, the highest of all.
    surface(x, z, yHint = Infinity) {
      const vol = Number.isFinite(yHint) ? C.inVolume(x, yHint, z) : null;
      const top = C.walkTop(x, z, yHint + 0.8);
      if (vol) return top != null ? top : vol.y0 + 1;
      const h = W.height(x, z);
      return top != null && top > h ? top : h;
    },
    surfaceType(x, z) {
      if (!types) return 'dirt';
      const m = maskAt(x, z);
      if (m && m.road && m.e < 0.2) return m.road.surface;
      if (m && m.walk < 0) return 'asphalt'; // (concrete sounds and grips like asphalt)
      if (m && m.lot && m.l < 0) return m.lot.surface;
      return TYPES[typeAt(x, z)];
    },
    // meters from the nearest road's centreline
    roadDist(x, z) { const m = maskAt(x, z); if (m && m.road && Math.abs(m.d) < 7.9) return Math.abs(m.d); return nearest(net, x, z).dist; },
    regionAt(x, z) { let best = 'west', d = Infinity; for (const [id, r] of Object.entries(REGIONS)) { const k = Math.hypot(r.x - x, r.z - z) / r.r; if (k < d) { d = k; best = id; } } return best; },
    water(x, z) { return parts.water ? parts.water.water(x, z) : null; },
    // a place, spawn or cairn: where to stand there. Places marked low stand on the ground under a deck.
    place(id) {
      const p = point(id); if (!p) return null;
      const y = p.low ? W.surface(p.x, p.z, W.height(p.x, p.z) + 0.5) : W.surface(p.x, p.z);
      return { x: p.x, y, z: p.z, yaw: p.yaw || 0, r: p.r || 8 };
    },
    colliders: C,
    roads: {
      nearest: (x, z) => { const q = nearest(net, x, z); return { x: q.x, z: q.z, road: q.road, dist: q.dist, s: q.s, yaw: q.yaw, side: q.side }; },
      route: (from, to) => route(net, from, to),
      // a lane position {x, y, z, yaw, s, road}; lane +1 right of the road's direction, -1 the other way
      sample: (roadId, s, lane = 1) => { const p = sample(net, roadId, s, lane); if (p) p.y = W.surface(p.x, p.z); return p; }, // (roads never run under a deck)
      lanes: net.lanes,
      speedLimit(x, z) { const m = maskAt(x, z); if (m && m.road && Math.abs(m.d) < m.road.hw + 1) return m.road.speed; const q = nearest(net, x, z, 60); return q.road && q.dist < 12 ? net.byId[q.road].speed : 8; },
      list: net.roads.map((r) => ({ id: r.id, name: r.name, len: r.len, width: r.width, lanes: r.lanes, surface: r.surface, speed: r.speed, closed: r.closed })),
      net,
    },
    mapImage: mapCanvas,
    toMap: (x, z) => [(x + HALF) / (2 * HALF), (z + HALF) / (2 * HALF)],
    reveal(id) { if (id) revealed.add(id); },
    revealed,
    get mapVersion() { return parts.map ? parts.map.version : 0; },
    interiors: {
      enter(id) { return parts.interiors ? parts.interiors.enter(id) : null; },
      exit(id) { const p = parts.interiors ? parts.interiors.exit(id) : null; if (p) p.y = W.surface(p.x, p.z); return p; },
      wall(id) { return parts.interiors ? parts.interiors.wall(id) : null; },
      // doors work in free roam; a mission may open or lock one
      open(id, on = true) { doorState[id] = on; },
      get points() { return parts.interiors ? parts.interiors.points : {}; },
      roomAt(x, y, z) { return parts.interiors ? parts.interiors.roomAt(x, y, z) : null; },
    },
    ranch: {
      lights(on) { ranchLights = !!on; if (parts.town) parts.town.ranch.lights(on); },
      get on() { return ranchLights; },
      gate(open) { if (parts.town) parts.town.ranch.gate(open); },
      get bunkDoor() { return parts.town ? parts.town.ranch.bunkDoor : null; },
    },
    town: { get pumps() { return parts.town ? parts.town.pumps : []; } },
    setVisible(v) { group.visible = !!v; },
    update,
    bridgeSilhouette() { return parts.bridges ? parts.bridges.silhouette() : new THREE.Group(); },
  };
  let ranchLights = true;
  const doorState = {};
  // raycast(a, b): the first hit among the colliders and the ground (for cameras and photo visibility).
  // Inside an interior volume the ground far above is ignored (C3). {terrain: false} skips the ground.
  const rayBoxes = C.raycast;
  C.raycast = (a, b, o = {}) => {
    let best = rayBoxes(a, b);
    if (o.terrain === false || !H || C.inVolume(a.x, a.y, a.z) || C.inVolume(b.x, b.y, b.z)) return best;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, n = Math.max(2, Math.ceil(Math.hypot(dx, dz) / 2));
    let prev = 0;
    for (let i = 1; i <= n; i++) {
      const t = i / n; if (best != null && t > best) break;
      if (a.y + dy * t < W.height(a.x + dx * t, a.z + dz * t)) {
        // refine between the last free sample and this one
        let lo = prev, hi = t;
        for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (a.y + dy * m < W.height(a.x + dx * m, a.z + dz * m)) hi = m; else lo = m; }
        return best == null ? hi : Math.min(best, hi);
      }
      prev = t;
    }
    return best;
  };

  /* ---------------- per frame */
  const hero = new THREE.Vector3();
  let pointsLit = false;
  function nightK() {
    const L = S.look || {}, name = L.name || 'DAY';
    if (!L.clockDriven && NIGHT_LOOKS[name] != null) return NIGHT_LOOKS[name];
    if (!L.clockDriven && (name === 'DAY' || name === 'MEMORY' || name === 'HANGOVER')) return 0;
    const h = S.day ? S.day.hour : 12;
    return 1 - Math.min(1, Math.max(0, (h - 5.2) / 1.2)) * Math.min(1, Math.max(0, (19.8 - h) / 1.2));
  }
  function update(rdt, camera, focus) {
    if (!W.ready) { start(); runStep(); settle(); return; }
    if (!group.visible) return;
    shared.uTime.value = S.time;
    const night = nightK(), q = Math.max(0, Math.min(2, S.q | 0)), view = VIEW[q][night > 0.6 ? 1 : 0];
    shared.uCloud.value = 1 - night;
    if (S.hero && S.hero.pos) hero.copy(S.hero.pos); else hero.copy(focus || camera.position);
    // under the corner, in an interior, only the rooms draw; outside, the rooms never do
    const inside = camera.position.y < -200;
    for (const k of ['terrain', 'flora', 'town', 'bridges', 'water']) { const r = parts[k].root || parts[k].mesh; if (r) r.visible = !inside; }
    parts.interiors.root.visible = inside;
    if (!inside) {
      parts.terrain.update(camera, view, BIAS[q]);
      parts.flora.update(camera, view, hero, 1 - night * 0.72);
      cull(parts.town.root, camera, view); cull(parts.bridges.root, camera, view);
    }
    if (parts.town.ranch.on !== ranchLights) parts.town.ranch.lights(ranchLights);
    parts.town.update(night, S.time);
    parts.water.setLight(1 - night * 0.75, S.scene.fog && S.scene.fog.color);
    // inside a room: keep the walker in, and hang the fixed point lights over it (the bar's two lamps at 60:
    // at 14 the room read black, its walls and the people in it lost in the F3 cines)
    const room = S.hero && S.hero.mode === 'foot' && hero.y < -200 ? parts.interiors.contain(S.hero.pos) : null;
    const pts = S.look && S.look.lights && S.look.lights.points;
    if (room && pts && pts.length) {
      const L = room === 'rattlesnake_room' ? parts.interiors.lamps : [[INTERIORS.airstream.x - 1.5, INTERIORS.airstream.y + 2, INTERIORS.airstream.z], [INTERIORS.airstream.x + 2.5, INTERIORS.airstream.y + 2, INTERIORS.airstream.z]];
      pts.forEach((p, i) => { const l = L[i % L.length]; p.userData.pinned = true; p.position.set(l[0], l[1] - 0.3, l[2]); if (!pointsLit) p.intensity = room === 'airstream' ? 1.6 : ROOM_LAMP; });
      pointsLit = true;
    } else if (pointsLit && pts) { for (const p of pts) { p.intensity = 0; p.userData.pinned = false; } pointsLit = false; }
  }
  S.register('world', (cdt, rdt) => W.update(rdt, S.camera, S.focus));
  // hide what lies beyond the view distance (fog hides it anyway): the children of a root, by their bounds
  const sph = new THREE.Sphere(), box3 = new THREE.Box3();
  function cull(root, camera, view) {
    for (const o of root.children) {
      let s = o.userData.bounds;
      if (!s) {
        if (o.isInstancedMesh) { o.computeBoundingSphere(); s = o.boundingSphere.clone(); }
        else { box3.setFromObject(o, false); if (box3.isEmpty()) continue; s = box3.getBoundingSphere(new THREE.Sphere()); }
        o.userData.bounds = s;
      }
      sph.copy(s);
      o.userData.far = camera.position.distanceTo(sph.center) - sph.radius > view;
      if (!o.userData.managed) o.visible = !o.userData.far;
    }
  }

  /* ---------------- doors: walk in and out of the interiors */
  let busy = false, prevLook = null;
  function* through(id, into) {
    busy = true;
    try {
      if (S.ui && S.ui.fade) yield S.ui.fade(1, 0.35);
      const sp = into ? W.interiors.enter(id) : W.interiors.exit(id);
      if (sp && S.hero) { S.hero.pos.y = sp.y; S.hero.place(sp.x, sp.z, sp.yaw, sp.y); }
      if (S.look && S.look.set) { if (into) { prevLook = S.look.name; S.look.set('INTERIOR'); } else if (prevLook && prevLook !== 'ARENA') { S.look.set(prevLook); prevLook = null; } }
      yield 0.15;
      if (S.ui && S.ui.fade) yield S.ui.fade(0, 0.35);
    } finally { busy = false; }
  }
  const doorOpen = (id) => !busy && (doorState[id] ?? !(S.missions && S.missions.active));
  S.bus.on('start', () => {
    busy = false; prevLook = null;
    for (const [id, I] of Object.entries(INTERIORS)) {
      S.interact.add({ id: `door:${id}:in`, tag: 'world:doors', label: 'ENTER', r: 2.2, pos: () => ({ x: I.doorAt.x, y: W.height(I.doorAt.x, I.doorAt.z), z: I.doorAt.z }), when: () => doorOpen(id), act: () => S.co.start(through(id, true), `world:door:${id}`) });
      S.interact.add({ id: `door:${id}:out`, tag: 'world:doors', label: 'LEAVE', r: 2.2, pos: () => { const p = W.interiors.points[id]; return p ? { x: p.door.x, y: I.y, z: p.door.z } : { x: 0, y: -1e4, z: 0 }; }, when: () => !busy, act: () => S.co.start(through(id, false), `world:door:${id}`) });
    }
  });
  S.bus.on('exit', () => { busy = false; prevLook = null; if (pointsLit && S.look && S.look.lights) for (const p of S.look.lights.points) { p.intensity = 0; p.userData.pinned = false; } pointsLit = false; });
  S.bus.on('quality', (q) => { if (parts.flora) parts.flora.setQuality(q); });

  /* ---------------- QA */
  const routeLen = (a, b) => { const r = W.roads.route(a, b); let s = 0; for (let i = 1; i < r.length; i++) s += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); return r.length ? s : Infinity; };
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  function draws() {
    const cam = S.camera; cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    const out = { terrain: 0, flora: 0, town: 0, water: 0, bridge: 0, interior: 0, total: 0, triangles: 0, tris: {} };
    group.updateMatrixWorld();
    const walk = (o) => {
      if (!o.visible) return;
      if (o.isMesh && (!o.isInstancedMesh || o.count > 0)) {
        if (!o.frustumCulled || frustum.intersectsObject(o)) {
          const k = o.userData.kind || 'town'; out[k] = (out[k] || 0) + 1; out.total++;
          const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1);
          out.triangles += tri; out.tris[k] = (out.tris[k] || 0) + Math.round(tri);
        }
      }
      for (const c of o.children) walk(c);
    };
    walk(group);
    return out;
  }
  S.test.world = {
    height: (x, z) => W.height(x, z), surface: (x, z, y) => W.surface(x, z, y), regionAt: (x, z) => W.regionAt(x, z), routeLen,
    teleport: (x, z) => { if (S.hero) { S.hero.pos.y = W.surface(x, z); S.hero.place(x, z); } },
    info: () => ({
      ready: W.ready, visible: group.visible, progress: W.progress, calls: lastInfo.calls, triangles: lastInfo.triangles,
      programs: S.renderer.info.programs ? S.renderer.info.programs.length : 0, draws: W.ready ? draws() : null,
      lods: parts.terrain ? parts.terrain.stats() : null, flora: parts.flora ? parts.flora.counts : null, colliders: C.count,
      build: { worker: Math.round(build.worker), gen: build.ms, steps: build.steps, longest: Math.round(build.longest), total: Math.round(build.total || 0) },
    }),
    parts, net, draws,
  };

  // Sedona starts building as soon as the story module loads (NEW STORY, CONTINUE or a jump): the worker is
  // asset loading, not game flow, so no S.timers or S.co task starts here.
  start();
}
