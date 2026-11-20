// Gloam Downs: where the foes of the combat run stand. The one home of the zone table: each zone's centre [x, y, z] (y is the floor
// there on the baked walk map), its leash, its foes by type, the guard flag and, for a guard, the keeper: the landmark a toast names
// when its beacon will not catch. The biomes place them with ctx.zone(id), the bake writes them into <id>.json, and the zone test
// (qa/lab/gloam-downs-zones.mjs) reads both. No page code imports this file; the page reads the zones from <id>.json.
// Foe types: S Snuffer, P Pitchrook, M Mirelight, I Ironback, B the Barrow Reeve.
export const TYPES = { S: 'snuffer', P: 'pitchrook', M: 'mirelight', I: 'ironback', B: 'reeve' };

export const ZONES = {
  gaol: [
    { id: 'G1', name: 'yard south', c: [0.3, -2.29, 11.8], leash: 3.8, foes: 'S' },
    { id: 'G2', name: 'by the cells', c: [-5.5, -2.29, 4.5], leash: 4.3, foes: 'SS' },
    { id: 'G3', name: 'lower lane', c: [-3, 0.31, -6.5], leash: 4, foes: 'SS' },
    { id: 'G5', name: 'keep', c: [2.3, 4.21, -23.8], leash: 3, foes: 'SSS', guard: true, keeper: 'the keep' }
  ],
  ramparts: [
    { id: 'R1', name: 'vale south', c: [-4.3, -0.7, 11.3], leash: 5, foes: 'SS' },
    { id: 'R2', name: 'vale middle', c: [-1.5, -1.01, -3.8], leash: 5, foes: 'SS' },
    { id: 'R3', name: 'west flank', c: [-14.3, 0.18, -4.8], leash: 4.4, foes: 'P' },
    { id: 'R4', name: 'by the broken wall', c: [-18.8, 0.15, -15.3], leash: 5, foes: 'SSP', guard: true, keeper: 'by the broken wall below the tower' }
  ],
  fen: [
    { id: 'F1', name: 'wading', c: [4.5, -0.49, 7.6], leash: 3, foes: 'MM' },
    { id: 'F2', name: 'east pool', c: [7, -0.49, -3.8], leash: 3, foes: 'SM' },
    { id: 'F3', name: 'north shore', c: [-8.3, 1.59, -8], leash: 3, foes: 'S' },
    { id: 'F4', name: 'mill', c: [8.3, 1.86, -18.3], leash: 3.5, foes: 'SSP', guard: true, keeper: 'the mill' }
  ],
  bells: [
    { id: 'B1', name: 'vale', c: [-0.5, -0.04, 12], leash: 4.5, foes: 'I' },
    { id: 'B2', name: 'side path', c: [9.5, 0.56, 9.5], leash: 3.5, foes: 'SSM' },
    { id: 'B3', name: 'under the clock hill', c: [-11.3, 0.59, 12], leash: 3.3, foes: 'PM' },
    { id: 'B4', name: 'terrace', c: [3, 4.5, -12], leash: 3, foes: 'SP', guard: true, keeper: 'the terrace' }
  ],
  barrows: [
    { id: 'W1', name: 'under the start barrow', c: [0, 1.06, 14.3], leash: 5, foes: 'SS' },
    { id: 'W2', name: 'hollow', c: [1, 0.18, 3.5], leash: 5.5, foes: 'IS' },
    { id: 'W4', name: 'before the gate', c: [-0.5, 1.52, -4.8], leash: 3, foes: 'PM' },
    { id: 'arena', name: 'the arena', c: [18, 0.68, -22], leash: 6.5, foes: 'B', guard: true, boss: true, keeper: 'the open ground below the crown' }
  ]
};

/* The pool of each place: the slots, by type, that its zones share. At Barrow Crown the Barrow Reeve (B) and its grave candles (C)
   have slots of their own from the boss files, and the light carried after the fall (L) one from the foe files */
export const POOLS = { gaol: 'SSSSS', ramparts: 'SSSSP', fen: 'SSSSMMMP', bells: 'SSSMPI', barrows: 'SSSIPMBCL' };

/* The way through each place, as a player walks it: waypoints [x, y, z] from the start to the beacon, a few metres apart, on the walk
   map's floor. From the design survey's natural route (a search over the walk map by the controller's rules). Each route goes by its
   guard zone: on The Crow Wall it turns off before the beacon to the broken wall below the tower (R4, 14 m from the beacon) and back.
   At Barrow Crown the way leaves the path before the gate for the arena, and then climbs from the arena to the beacon (15.9 m), as
   the light is carried. The zone check and the bot walk each route twice: as a runner, who clears only the guard zone, and as a
   fighter, who clears each zone it wakes. */
export const ROUTES = {
  gaol: [[3, 7.4, 25.5], [5.5, 5, 23], [7, 1.9, 19.5], [7, -2.1, 14.5], [7, -2.2, 9.5], [7, -2.2, 4.5], [8.5, -2.2, 1], [9.3, -2.2, -3.3],
    [9.3, 0.9, -8.3], [5.8, 2.9, -9.8], [3.8, 2.7, -12.8], [3.3, 4.1, -17.3], [-0.5, 4.2, -18.5], [-1.8, 5.2, -22.3], [-4, 8, -25], [-4.3, 8, -24.5]],
  ramparts: [[0, 3.7, 27], [0, 1.2, 22], [-0.3, -0.1, 17.3], [-0.8, -0.5, 12.8], [-1, -1.3, 8], [-1.8, -1.7, 3.8], [-3.3, -1.5, 0.3],
    [-4.3, -1, -3.8], [-5.5, -0.4, -7.5], [-10.3, 0, -8.3], [-14, 0, -11.5], [-17, 0, -14.5], [-18.8, 0.2, -15.3],
    [-13.8, 0.1, -15.3], [-10.3, 1.4, -15.5], [-8.8, 3.2, -17.3], [-8.5, 4.7, -19.5], [-7.5, 5.4, -20.5]],
  fen: [[2, 4.9, 19.5], [1.3, 1.3, 15.3], [0.3, 0.5, 11.3], [0, -0.5, 6.5], [-0.8, -0.5, 2.3], [-0.8, -0.5, -2.8], [-0.8, 1.9, -7.8],
    [-0.8, 3.6, -12.8], [-0.8, 4.9, -16.5]],
  bells: [[0, 6.8, 27], [0, 1.7, 22], [0, 0.3, 17], [0.3, -0.1, 12.3], [1, -0.1, 8], [1, 2.6, 3], [1.5, 3.6, -1], [1.5, 4.5, -6], [2, 6.5, -6.8]],
  barrows: [[2, 9, 27], [1.3, 7.1, 22.8], [1.3, 1.1, 17.8], [1.3, 1, 12.8], [1.3, 0.3, 7.8], [1.3, 0.3, 2.8], [1.3, 1, -2.3],
    [4.8, 1.6, -5.8], [7.3, 2.5, -9.8], [11, 1.6, -13.5], [14.3, 0.9, -17.3], [18, 0.7, -22],
    [13, 0.7, -22], [9.8, 2, -22], [8.8, 3.3, -22], [7.5, 4.5, -22], [6, 6, -21.8], [5.3, 7.4, -21], [4.8, 8.7, -19.8], [4.8, 9.5, -18.5]]
};

export const zonesOf = id => {
  if (!ZONES[id]) throw new Error(`no zones for ${id}`);
  return ZONES[id];
};
export const zoneOf = (id, zid) => {
  const z = zonesOf(id).find(q => q.id === zid);
  if (!z) throw new Error(`${id} has no zone ${zid}`);
  return z;
};
// what the bake writes into <id>.json: a copy of the module's zones, with only the keys that are set
export const zoneJson = z => JSON.parse(JSON.stringify(z));
// how many slots of each type a pool has: { S: 5 }
export const poolTypes = id => [...POOLS[id]].filter(t => 'SPMI'.includes(t)).reduce((n, t) => ((n[t] = (n[t] || 0) + 1), n), {});
