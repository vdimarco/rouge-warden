// Stub WORLD (frozen; the world package replaces world/sedona.js, not this file).
// A flat 2 km ground at y = 0 with a grid, a post at every place, empty colliders with interior volumes,
// straight-line routes, and the Sedona group that setVisible shows. It builds over three ticks, so the
// loading path runs.
import { WORLD, PLACES, REGIONS, INTERIORS, point } from '../world/places.js';

export function init(S) {
  const { THREE } = S;
  const HALF = WORLD.HALF;
  const group = new THREE.Group(); group.name = 'sedona'; group.visible = false;
  S.scene.add(group);

  // colliders: kept in lists; only interior volumes change heights here
  let cid = 0;
  const items = new Map(), vols = [];
  const C = {
    addCircle(x, z, r, o = {}) { const id = ++cid; items.set(id, { kind: 'circle', x, z, r, ...o }); return id; },
    addBox(o) { const id = ++cid; items.set(id, { kind: 'box', ...o }); return id; },
    addSegment(ax, az, bx, bz, o = {}) { const id = ++cid; items.set(id, { kind: 'segment', ax, az, bx, bz, ...o }); return id; },
    addVolume(o) { const id = ++cid; const v = { kind: 'volume', ...o }; items.set(id, v); vols.push(v); return id; },
    inVolume(x, y, z) { return vols.find((v) => x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1 && y >= v.y0 - 1 && y <= v.y1) || null; },
    remove(id) { const v = items.get(id); items.delete(id); const i = vols.indexOf(v); if (i >= 0) vols.splice(i, 1); },
    query(x, z, r, cb) { for (const it of items.values()) { const cx = it.x ?? it.ax, cz = it.z ?? it.az; if (cx != null && Math.hypot(cx - x, cz - z) <= r + (it.r || 0)) cb(it); } },
    resolveCircle() { return false },
    resolveOBB() { return null; },
    raycast() { return null; },
  };
  for (const [id, I] of Object.entries(INTERIORS)) C.addVolume({ id, x0: I.x - I.w / 2, x1: I.x + I.w / 2, y0: I.y, y1: I.y + I.h, z0: I.z - I.d / 2, z1: I.z + I.d / 2 });

  const pointOf = (a) => (typeof a === 'string' ? point(a) : a);
  const map = document.createElement('canvas'); map.width = map.height = 256;
  let built = 0, wall = null, ranchOn = false;
  const W = S.world = {
    ready: false, progress: 0, SCALE: 1, HALF, group,
    get visible() { return group.visible; },
    height: () => 0,
    normal: (x, z, out) => (out || new THREE.Vector3()).set(0, 1, 0),
    surface(x, z, yHint = 0) { const v = C.inVolume(x, yHint, z); return v ? v.y0 : 0; },
    surfaceType: () => 'dirt',
    roadDist: () => 50,
    regionAt(x, z) { let best = 'west', d = Infinity; for (const [id, r] of Object.entries(REGIONS)) { const k = Math.hypot(r.x - x, r.z - z) / r.r; if (k < d) { d = k; best = id; } } return best; },
    water: () => null,
    place(id) { const p = point(id); return p ? { x: p.x, y: W.surface(p.x, p.z), z: p.z, yaw: p.yaw || 0, r: p.r || 8 } : null; },
    colliders: C,
    roads: {
      nearest: (x, z) => ({ x, z, road: null, dist: 0 }),
      route(from, to) { const a = pointOf(from), b = pointOf(to); return a && b ? [{ x: a.x, z: a.z }, { x: b.x, z: b.z }] : []; },
      sample: (roadId, s) => ({ x: 0, z: s, yaw: 0 }),
      lanes: [],
      speedLimit: () => 15,
    },
    mapImage: map,
    toMap: (x, z) => [(x + HALF) / (2 * HALF), (z + HALF) / (2 * HALF)],
    reveal(id) { W.revealed.add(id); },
    revealed: new Set(),
    interiors: {
      open() {},
      enter(id) { const I = INTERIORS[id]; return I ? { x: I.x, y: I.y, z: I.z, yaw: 0 } : null; },
      exit(id) { const p = point((INTERIORS[id] || {}).door || id); return p ? { x: p.x, y: 0, z: p.z + 3, yaw: 0 } : null; },
      wall(id) {
        if (!wall) { const I = INTERIORS[id] || INTERIORS.airstream; wall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ color: 0x8a8580 })); wall.position.set(I.x, I.y + 1.4, I.z - I.d / 2 + 0.05); group.add(wall); }
        return wall;
      },
    },
    setVisible(v) { group.visible = !!v; },
    update() {},
    bridgeSilhouette() { return new THREE.Group(); },
    ranch: { lights(on) { ranchOn = !!on; }, gate() {}, get on() { return ranchOn; } },
    mapVersion: 0,
  };

  function buildSlice() {
    if (built === 0) {
      // the ground: a grey plane with a 20 m grid
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = '#8a8178'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#5e5750'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(100, 100); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshLambertMaterial({ map: tex }));
      ground.rotation.x = -Math.PI / 2; ground.name = 'stubGround';
      group.add(ground);
    } else if (built === 1) {
      // a dark post at every place, so a player can find the way
      const ids = Object.keys(PLACES), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 8, 1.2), new THREE.MeshLambertMaterial({ color: 0x2a2826 }), ids.length);
      const m = new THREE.Matrix4();
      ids.forEach((id, i) => { const p = PLACES[id]; m.makeTranslation(p.x, 4, p.z); posts.setMatrixAt(i, m); });
      group.add(posts);
    } else if (built === 2) {
      // interior floors under the corner
      for (const I of Object.values(INTERIORS)) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(I.w, 0.2, I.d), new THREE.MeshLambertMaterial({ color: 0x3a302a }));
        f.position.set(I.x, I.y - 0.1, I.z); group.add(f);
      }
    }
    built++; W.progress = Math.min(1, built / 3);
    if (built >= 3) W.ready = true;
  }
  S.register('world', () => { if (!W.ready) buildSlice(); W.update(); });

  const routeLen = (a, b) => { const r = W.roads.route(a, b); let s = 0; for (let i = 1; i < r.length; i++) s += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); return s; };
  S.test.world = {
    height: (x, z) => W.height(x, z), surface: (x, z, y) => W.surface(x, z, y), regionAt: (x, z) => W.regionAt(x, z), routeLen,
    teleport: (x, z) => { if (S.hero) S.hero.place(x, z); },
    info: () => ({ ready: W.ready, visible: group.visible, calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles }),
  };
}
