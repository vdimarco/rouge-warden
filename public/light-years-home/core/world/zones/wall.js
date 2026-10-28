// Light Years Home v3: The Wall. Inside the Sloan Great Wall, 1.000 Gly out; 1 u = 50,000 ly (final.md 7.2).
// The game's first place: the misfire drops you onto the Sloan Road at 38 u/s, three galaxies whip past, the Bend
// Giant asks for the first drift, the Sloan Pads kick, and Node 0 is 19 s ahead. Five filament roads run in to
// Node 0; Void West and Void East stay empty on purpose. Plain data; core/world/schema.js checks every field.
//
// Scan targets (WP6's shape, read by core/zone.js): { body }, { at: [x, y, z] or a list of them, r }, { roads },
// { traffic: 'any' | road or swarm id }, { set }, { actor }, { far }. far: true scans use the far cone and hold.

const FIRST_LIGHT = {
  id: 'first-light', type: 'sprint', title: 'FIRST LIGHT', zone: 'wall',
  start: { pos: [25, 30, 0], dir: [0.49, 0.87, 0], r: 4.5 }, runup: { pos: [10, 4, 0], heading: 29 },
  line: [[25, 30], [70, 110], [140, 170], [175, 240], [240, 290], [300, 330]],
  gates: [{ at: 1, r: 4.5, name: 'D ROAD' }, { at: 2, r: 4.5 }, { at: 3, r: 4.5, split: true }, { at: 4, r: 4.5 },
    { at: 5, r: 7, name: 'FINISH' }],
  length: 417, tern: 11.0, gold: 11.8, silver: 13.4, bronze: 16.6,     // the bots' table (races §2.6, race.test)
  note: 'oncoming on the D road; finishes beside the exit gate',
};

const STUNTS = [
  // Highest drift tier cashed out inside the circle, or within 1 s of leaving it.
  { id: 'sloan-bend', type: 'drift', title: 'SLOAN BEND', area: { centre: [-48, -222], r: 32 }, stars: [1, 2, 3] },
  // Speed through the ring, either direction: 40 needs boost, 44 a boost near a kick, 47 a drift-boost or pad kick.
  { id: 'void-run', type: 'trap', title: 'VOID RUN', ring: { pos: [250, -200, 0], r: 6 }, stars: [40, 44, 47] },
  // Near misses in 10 s, driving out the B road against its flow.
  { id: 'outbound', type: 'oncoming', title: 'OUTBOUND', road: 'b-road', 'window': 10, stars: [5, 10, 15] },
  { id: 'sloan-pads', type: 'line', title: 'SLOAN PADS', pads: [[-20, -150, 0], [-12, -111, 0], [-4, -72, 0], [4, -33, 0]],
    'window': 1.5, exitSpeed: 44, stars: ['all', 'all+exit', 'all-perfect'] },
];

const SCANS = [
  // The first traffic galaxy you scan, not before 12 s, so the opening's lines stay in order. Shows the scale card.
  { id: 'any-galaxy', target: { traffic: 'any' }, notBefore: 12, label: 'GALAXY', card: 'any-galaxy',
    line: 'dot.galaxy', scaleCard: true },
  // Any of the filament roads; the nose holds the nearest point of the road.
  { id: 'filament', target: { roads: ['sloan', 'b-road', 'c-road', 'd-road', 'e-road'] }, label: 'FILAMENT',
    card: 'filament', line: 'dot.filament' },
  // Either void's centre.
  { id: 'void', target: { at: [[240, -230, 0], [-230, 220, 0]], r: 150 }, label: 'VOID', card: 'void',
    line: 'dot.void' },
  { id: 'node0', target: { at: [0, 0, 0], r: 40 }, label: 'NODE 0', card: 'node0', line: 'dot.node0' },
  // Far scans: WHICH WAY HOME's lines play on these (missions/ch1.js); a scan before the mission counts there.
  { id: 'far-coma', target: { far: 'far-coma' }, far: true, card: 'far-coma', line: 'dot.coma' },
  { id: 'far-leo', target: { far: 'far-leo' }, far: true, card: 'far-leo', line: 'dot.leo' },
  { id: 'far-hercules', target: { far: 'far-hercules' }, far: true, card: 'far-hercules', line: 'dot.hercules' },
];

export default {
  id: 'wall', name: 'The Wall', chapter: 1, kind: 'pit', object: 'start',
  R: 450, slab: 120, band: 100, scaleLy: 50000,
  scaleCard: 'EACH POINT HERE IS A GALAXY · 1 SHIP = 50,000 LIGHT-YEARS',
  plane: { kind: 'aim', contains: ['coma', 'hercules'], align: { id: 'coma', toward: [335, 295] } },
  key: 'chapter-1',
  // The game's first frame: the misfire drops you onto the Sloan Road, heading north, at 38 u/s.
  entry: { pos: [0, -400, 0], heading: 0, speed: 38, bar: 0.5 },
  // Beat 2 is the three far scans. Finish them facing Coma (within 60°) and the run-up starts where you are.
  exit: { pos: [335, 295, 0], r: 10, to: 'coma', label: 'COMA CLUSTER · 737 MLY',
    opensWhen: 'beatDone:which-way-home:2', autoRunup: { within: 60, object: 'coma' } },
  bodies: [
    // The first drift, at the S-bend: a well that makes the circle easy.
    { id: 'bend-giant', pos: [-48, -222, 0], r: 9, rc: 4.5, look: 'elliptical-warm', well: { rs: 14 }, skim: true,
      label: 'GIANT ELLIPTICAL' },
    // Node 0's posts: thread between them.
    { id: 'node-e1', pos: [12, -4, 2], r: 3, rc: 1.5, look: 'elliptical' },
    { id: 'node-e2', pos: [27, -16, -2], r: 3, rc: 1.5, look: 'elliptical' },
    { id: 'node-e3', pos: [-14, 10, 0], r: 3.5, rc: 1.8, look: 'elliptical' },
  ],
  roads: [                                                                // every road listed from the rim inward
    // The spawn road: a narrow first stretch (tube 6 u) and three seeded galaxies at 45, 70 and 95 u ahead, gaps
    // 1.3, 1.7 and 0.9 u: three NEARs at 1.4, 2.4 and 3.6 s with no input (critic-calc).
    { id: 'sloan', kind: 'road', pts: [[0, -440, 0], [-2, -330, 0], [-30, -245, 0], [-25, -195, 0], [-5, -110, 0],
      [0, -40, 0]], flow: +1, speed: 6, count: 30, tube: [[0, 0.35, 6], [0.35, 1, 18]], size: [1, 2.5], mix: 'spiral',
    seeded: [{ ahead: 45, lateral: 2.6, r: 2 }, { ahead: 70, lateral: -3.0, r: 2 }, { ahead: 95, lateral: 2.2, r: 2 }] },
    { id: 'b-road', kind: 'road', pts: [[366, 140, 0], [340, 158, 0], [300, 132, 0], [230, 95, 0], [130, 55, 0],
      [40, 15, 0]], flow: +1, speed: 6, count: 70, tube: 20, size: [1, 3], mix: 'spiral' },
    { id: 'c-road', kind: 'road', pts: [[-430, -90, 0], [-300, -70, 0], [-170, -40, 0], [-60, -10, 0]],
      flow: +1, speed: 6, count: 70, tube: 20, size: [1, 3], mix: 'spiral' },
    { id: 'd-road', kind: 'road', pts: [[290, 320, 0], [240, 290, 0], [175, 240, 0], [140, 170, 0], [70, 110, 0],
      [25, 30, 0]], flow: +1, speed: 6, count: 70, tube: 18, size: [1, 3], mix: 'spiral' },
    // The north filament (WP6, not in the design's map): without it the north rim was 282 u from anything to do.
    // It runs between Void West and the D road, so both voids stay empty.
    { id: 'e-road', kind: 'road', pts: [[-70, 440, 0], [-60, 330, 0], [-35, 200, 0], [-18, 100, 0], [-8, 40, 0]],
      flow: +1, speed: 6, count: 40, tube: 14, size: [1, 2.5], mix: 'spiral' },
    { id: 'node', kind: 'orbit', centre: [0, 0], r: [12, 40], dir: -1, speed: [4, 8], count: 60, size: [1.5, 3],
      mix: 'elliptical', height: 8 },
  ],
  swarms: [
    // Dwarfs trace the web (core/traffic.js gathers 70% of them along the roads). 700, up from the design's 400, so a
    // driver away from the roads still meets near misses (WP1's toy test).
    { id: 'web-dwarfs', count: 700, area: { r: 440 }, h: 60, size: [0.4, 1.0], drift: [1, 3], mix: 'dwarf',
      colliders: true, avoid: [{ centre: [-230, 220], r: 160 }, { centre: [240, -230], r: 150 }] },
    // The handling doc's pebble field round the opening: small dwarfs that only scrape, for near misses whatever
    // line a new player takes. The entry line's first 100 u stays clear (a lane about 6 u either side).
    { id: 'pebbles', count: 40, centre: [10, -300], area: { r: 110 }, h: 6, size: [0.5, 1.2], drift: [0.5, 1.5],
      mix: 'dwarf', colliders: true,
      avoid: [-400, -386, -372, -358, -344, -330, -316, -302].map((y) => ({ centre: [0, y], r: 9 })) },
  ],
  rings: [],
  sparks: [
    { road: 'sloan', from: 0.05, to: 0.95, n: 16 },
    // The line east from Node 0 toward the Void Run ring.
    { pts: [[60, -40, 0], [120, -80, 0], [180, -130, 0], [230, -180, 0], [262, -215, 0], [290, -250, 0],
      [320, -275, 0], [340, -300, 0]] },
  ],                                                                      // 24
  far: [
    { id: 'far-coma', object: 'coma', label: 'COMA CLUSTER', scan: 'far-coma', kind: 'scan' },
    { id: 'far-leo', object: 'leo', label: 'LEO CLUSTER', scan: 'far-leo', kind: 'scan' },
    { id: 'far-hercules', object: 'hercules', label: 'HERCULES CLUSTER', scan: 'far-hercules', kind: 'scan' },
    { id: 'shapley', object: 'shapley', label: 'SHAPLEY SUPERCLUSTER', kind: 'beacon' },
  ],
  sets: {},
  rumours: [{ id: 'wall-high', from: 'scan:filament', text: "From high enough, you'd see the whole wall.",
    opens: 'overlook' }],
  // Climb to the slab's ceiling over Void West: the camera pulls back to show the wall's length in the far web.
  secrets: [{ id: 'overlook', rumour: 'wall-high', when: { at: [-230, 220], within: 60, hMin: 110 },
    reward: { card: 'sloan-wall', vista: true, line: 'dot.overlook' } }],
  lookHome: { card: 'oxygen', line: 'dot.lh.wall' },                     // light 2.07 billion years old (legs.js)
  zoneCard: 'wall',
  missions: ['which-way-home', 'first-shout'],
  backdrop: { web: 'chapter-1', rings: ['shapley'] },
  art: { atlas: ['wp-grand', 'wp-barred', 'wp-flocculent', 'elliptical'], giants: [], extra: null },
  events: [FIRST_LIGHT, ...STUNTS],
  scans: SCANS,
};
