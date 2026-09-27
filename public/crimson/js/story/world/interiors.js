// js/story/world/interiors.js : the rooms under the unused corner at y = -300 (C3). The Rattlesnake Room
// (24 x 16 m: the bar, two pool tables, booths, stools, cue racks) and the inside of Gabe's Airstream with
// its evidence wall (a plane MISSIONS textures: S.world.interiors.wall(id)). Each room is an interior volume,
// so height, surface, raycasts and cameras inside ignore the terrain far above. Doors fade and teleport.
import { Geo, UV } from './town.js';
import { INTERIORS } from './places.js';

const WOOD = [0.36, 0.22, 0.14], DARKWOOD = [0.22, 0.14, 0.1], WALL = [0.42, 0.2, 0.14], FELT = [0.12, 0.3, 0.36], BRASS = [0.66, 0.52, 0.3];

export function createInteriors(S, { THREE, group, colliders, material }) {
  const root = new THREE.Group(); root.name = 'interiors'; group.add(root);
  const rooms = {}, points = {};
  const lamps = [];
  for (const [id, I] of Object.entries(INTERIORS)) {
    const x0 = I.x - I.w / 2, x1 = I.x + I.w / 2, z0 = I.z - I.d / 2, z1 = I.z + I.d / 2, y = I.y;
    colliders.addVolume({ id, x0: x0 - 0.5, x1: x1 + 0.5, z0: z0 - 0.5, z1: z1 + 0.5, y0: y - 1, y1: y + I.h + 1 });
    // floor you stand on and walls you cannot pass
    colliders.addBox({ x: I.x, z: I.z, w: I.w + 1, d: I.d + 1, y0: y - 1, top: y, walk: true, tag: `floor:${id}` });
    for (const [x, z, w, d] of [[I.x, z0 - 0.25, I.w + 1, 0.5], [I.x, z1 + 0.25, I.w + 1, 0.5], [x0 - 0.25, I.z, 0.5, I.d + 1], [x1 + 0.25, I.z, 0.5, I.d + 1]]) colliders.addBox({ x, z, w, d, y0: y - 1, top: y + I.h + 1, tag: `wall:${id}` });
    rooms[id] = { ...I, x0, x1, z0, z1 };
  }

  /* The Rattlesnake Room: the door is on the south wall (+z), the bar along the north wall */
  const RR = rooms.rattlesnake_room, g = new Geo();
  {
    const { x, z, y, w, d, h } = RR;
    // floor planks, walls with a dado rail, a dark ceiling with beams
    g.box(x, y - 0.3, z, w, 0.3, d, 0, WOOD, { top: [0.34, 0.22, 0.15] });
    const wallIn = (ax, az, bx, bz) => { g.quad([ax, y, az], [bx, y, bz], [bx, y + h, bz], [ax, y + h, az], WALL); g.quad([ax, y, az], [bx, y, bz], [bx, y + 1.1, bz], [ax, y + 1.1, az], DARKWOOD); };
    // each wall faces into the room: (b - a) x up points inward
    wallIn(x + w / 2, z + d / 2, x - w / 2, z + d / 2); wallIn(x - w / 2, z - d / 2, x + w / 2, z - d / 2);
    wallIn(x + w / 2, z - d / 2, x + w / 2, z + d / 2); wallIn(x - w / 2, z + d / 2, x - w / 2, z - d / 2);
    g.quad([x - w / 2, y + h, z + d / 2], [x - w / 2, y + h, z - d / 2], [x + w / 2, y + h, z - d / 2], [x + w / 2, y + h, z + d / 2], [0.12, 0.09, 0.08]);
    for (let k = 1; k < 6; k++) g.box(x - w / 2 + w * k / 6, y + h - 0.35, z, 0.3, 0.35, d, 0, DARKWOOD);
    // the bar along the north wall, the back bar with bottles, stools
    g.box(x - 2, y, z - d / 2 + 2.2, 12, 1.1, 0.8, 0, DARKWOOD, { top: [0.3, 0.2, 0.13] });
    g.box(x - 2, y, z - d / 2 + 0.35, 12, 2.2, 0.5, 0, DARKWOOD);
    for (let k = 0; k < 26; k++) { const bx = x - 7.6 + k * 0.44, c = [[0.34, 0.18, 0.1], [0.22, 0.3, 0.3], [0.5, 0.36, 0.18], [0.6, 0.55, 0.45]][k % 4]; g.box(bx, y + 1.35 + (k % 2) * 0.55, z - d / 2 + 0.4, 0.14, 0.34, 0.14, 0, c); }
    colliders.addBox({ x: x - 2, z: z - d / 2 + 1.3, w: 12.4, d: 2.6, y0: y - 0.5, top: y + 1.1, tag: 'bar' });
    const stools = [];
    for (let k = 0; k < 9; k++) { const sx = x - 7.2 + k * 1.3, sz = z - d / 2 + 3.2; g.cyl([sx, y, sz], [sx, y + 0.72, sz], 0.05, 0.05, 5, BRASS); g.cyl([sx, y + 0.72, sz], [sx, y + 0.8, sz], 0.2, 0.2, 8, [0.5, 0.12, 0.1], true); stools.push({ x: sx, z: sz }); }
    // two pool tables under their lamps
    const tables = [];
    for (const tx of [x + 1, x + 7]) {
      const tz = z + 1.8;
      g.box(tx, y, tz, 1.5, 0.78, 2.7, 0, DARKWOOD, { top: FELT });
      g.box(tx, y + 0.78, tz - 1.35, 1.6, 0.1, 0.1, 0, DARKWOOD); g.box(tx, y + 0.78, tz + 1.35, 1.6, 0.1, 0.1, 0, DARKWOOD);
      g.box(tx - 0.76, y + 0.78, tz, 0.1, 0.1, 2.7, 0, DARKWOOD); g.box(tx + 0.76, y + 0.78, tz, 0.1, 0.1, 2.7, 0, DARKWOOD);
      colliders.addBox({ x: tx, z: tz, w: 1.6, d: 2.8, y0: y - 0.5, top: y + 0.9, tag: 'pool' });
      lamps.push([tx, y + h - 1.4, tz]); tables.push({ x: tx, z: tz });
    }
    // booths along the west wall
    for (let k = 0; k < 3; k++) {
      const bz = z - 3 + k * 3.6, bx = x - w / 2 + 1.2;
      g.box(bx, y, bz, 1.2, 0.75, 1.2, 0, DARKWOOD, { top: [0.3, 0.2, 0.14] });
      for (const dz of [-1, 1]) { g.box(bx, y, bz + dz * 1.1, 1.8, 0.48, 0.55, 0, [0.44, 0.1, 0.08]); g.box(bx, y + 0.48, bz + dz * 1.36, 1.8, 0.65, 0.12, 0, [0.44, 0.1, 0.08]); }
      colliders.addBox({ x: bx, z: bz, w: 1.9, d: 2.9, y0: y - 0.5, top: y + 1, tag: 'booth' });
    }
    // cue racks on the east wall (pickup points), a jukebox, the door on the south wall
    const cues = [];
    for (const rz of [z - 1, z + 3]) {
      const rx = x + w / 2 - 0.12;
      g.box(rx, y + 0.9, rz, 0.1, 1.6, 1.1, 0, DARKWOOD);
      for (let k = 0; k < 5; k++) g.cyl([rx - 0.1, y + 0.2, rz - 0.4 + k * 0.2], [rx - 0.12, y + 1.6, rz - 0.4 + k * 0.2], 0.018, 0.012, 4, [0.72, 0.58, 0.4]);
      cues.push({ x: rx - 0.8, z: rz, yaw: -Math.PI / 2 });
    }
    g.box(x + w / 2 - 0.6, y, z - 5.6, 1, 1.6, 0.7, 0, [0.5, 0.18, 0.12], { front: [0.8, 0.6, 0.3] });
    colliders.addBox({ x: x + w / 2 - 0.6, z: z - 5.6, w: 1, d: 0.7, y0: y - 0.5, top: y + 1.6, tag: 'jukebox' });
    g.box(x - 6, y, z + d / 2 - 0.06, 1.3, 2.3, 0.1, 0, [1, 1, 1], { uv: { back: UV.door } });
    // warm lamp shades over the tables (they glow)
    points.rattlesnake_room = { door: { x: x - 6, z: z + d / 2 - 1.6, yaw: Math.PI }, spawn: { x: x - 6, y, z: z + d / 2 - 2.2, yaw: Math.PI }, stools, tables, cues };
  }
  /* The Airstream: a curved shell, a bench, a table, a bunk and the evidence wall on the north side */
  const AR = rooms.airstream;
  {
    const { x, z, y, w, d, h } = AR;
    g.box(x, y - 0.25, z, w, 0.25, d, 0, [0.4, 0.34, 0.28]);
    // the curved inside of the shell: quads round a half cylinder
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n, r = d / 2;
      const p = (a, xx) => [xx, y + 0.9 + Math.sin(a) * (h - 0.9), z + Math.cos(a) * r];
      g.quad(p(a1, x - w / 2), p(a1, x + w / 2), p(a0, x + w / 2), p(a0, x - w / 2), [0.78, 0.76, 0.72]);
    }
    for (const zz of [z - d / 2, z + d / 2]) g.quad(zz < z ? [x - w / 2, y, zz] : [x + w / 2, y, zz], zz < z ? [x + w / 2, y, zz] : [x - w / 2, y, zz], zz < z ? [x + w / 2, y + 0.9, zz] : [x - w / 2, y + 0.9, zz], zz < z ? [x - w / 2, y + 0.9, zz] : [x + w / 2, y + 0.9, zz], [0.7, 0.66, 0.6]);
    for (const xx of [x - w / 2, x + w / 2]) g.box(xx, y, z, 0.1, h, d, 0, [0.66, 0.64, 0.6]);
    g.box(x + 3, y, z + 0.3, 2.4, 0.5, 1.4, 0, [0.3, 0.4, 0.44], { top: [0.55, 0.52, 0.48] }); // the bunk
    g.box(x - 1.2, y, z + 0.6, 1.1, 0.75, 0.8, 0, WOOD, { top: [0.55, 0.4, 0.28] }); // the table
    g.box(x - 3.2, y, z + 0.6, 1.4, 0.45, 0.9, 0, [0.36, 0.28, 0.24]); // the bench
    colliders.addBox({ x: x + 3, z: z + 0.3, w: 2.4, d: 1.4, y0: y - 0.5, top: y + 0.5, tag: 'bunk' });
    colliders.addBox({ x: x - 1.2, z: z + 0.6, w: 1.1, d: 0.8, y0: y - 0.5, top: y + 0.75, tag: 'table' });
    points.airstream = { door: { x: x - 0.2, z: z + d / 2 - 0.5, yaw: Math.PI }, spawn: { x: x - 0.2, y, z: z + 0.2, yaw: Math.PI }, wall: { x: x - 0.4, z: z - d / 2 + 0.7, yaw: Math.PI } };
  }
  const mesh = new THREE.Mesh(g.build(THREE), material);
  mesh.name = 'interiors'; mesh.userData.kind = 'interior'; root.add(mesh);
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  for (const [lx, ly, lz] of lamps) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 0.45, 10, 1, true), shadeMat); s.position.set(lx, ly, lz); root.add(s); }

  // the evidence wall: a cork board MISSIONS textures (B6)
  let wall = null;
  function evidenceWall() {
    if (wall) return wall;
    const c = document.createElement('canvas'); c.width = 512; c.height = 300;
    const x = c.getContext('2d'); x.fillStyle = '#9a7248'; x.fillRect(0, 0, 512, 300);
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${60 + Math.random() * 60 | 0},${40 + Math.random() * 30 | 0},20,0.25)`; x.fillRect(Math.random() * 512, Math.random() * 300, 2, 2); }
    x.strokeStyle = '#4a3220'; x.lineWidth = 14; x.strokeRect(0, 0, 512, 300);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const I = AR, p = points.airstream.wall;
    wall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: t }));
    wall.position.set(p.x, I.y + 1.45, I.z - I.d / 2 + 0.5); wall.rotation.x = -0.12; wall.name = 'evidenceWall';
    root.add(wall);
    return wall;
  }
  evidenceWall();

  // which room (if any) holds a point
  const roomAt = (x, y, z) => { for (const [id, r] of Object.entries(rooms)) if (x > r.x0 - 0.5 && x < r.x1 + 0.5 && z > r.z0 - 0.5 && z < r.z1 + 0.5 && y > r.y - 2 && y < r.y + r.h + 2) return id; return null; };
  return {
    root, rooms, points, lamps,
    roomAt,
    enter(id) { const p = points[id]; return p ? { x: p.spawn.x, y: p.spawn.y, z: p.spawn.z, yaw: p.spawn.yaw } : null; },
    exit(id) { const I = INTERIORS[id]; if (!I) return null; const d = I.doorAt; return { x: d.x, y: null, z: d.z, yaw: d.yaw }; },
    wall() { return evidenceWall(); }, // (one wall so far: the Airstream's)
    // keep a walker inside the room it is in (a safety net under any hero code)
    contain(p) { const id = roomAt(p.x, p.y, p.z); if (!id) return null; const r = rooms[id], m = 0.35; p.x = Math.min(r.x1 - m, Math.max(r.x0 + m, p.x)); p.z = Math.min(r.z1 - m, Math.max(r.z0 + m, p.z)); return id; },
  };
}
