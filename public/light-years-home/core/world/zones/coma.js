// Light Years Home v3: Coma City. The Coma Cluster, 323 Mly from Earth; 1 u = 7,000 ly; north up, east left
// (final.md 7.3). You drop in above the slab on the COMA DIVE line, facing downtown: two warm giants, a fast inner
// ring of galaxies round them, a slow outer ring, two filament roads off to the rim, D100 falling through with its
// tail. Round 1 drives it freely with scans and Look Home; PELICAN DOWN, FRAGILE, the races and the stunts are here
// as data for Round 2. Downtown Eight and SHINY THINGS were cut (decisions.md 4). Scan targets as in wall.js, plus
// { inside: { centre, r } }: being inside the circle runs the scan, no aiming.

const EVENTS = [
  // Showcase: ride D100's tail for the draft (+5% top, +0.08 bar a second), then pass it before the Inner Ring.
  { id: 'race-the-jellyfish', type: 'showcase', title: 'RACE THE JELLYFISH', zone: 'coma',
    start: { pos: [300, 450, 0], dir: [-0.53, -0.85, 0], r: 4.5 }, runup: { pos: [316, 475, 0], heading: 212 },
    line: [[300, 450], [250, 370], [190, 300], [150, 220], [90, 160], [40, 120]],
    gates: [{ at: 1 }, { at: 2 }, { at: 3, name: 'TAIL END', split: true }, { at: 4 }, { at: 5, r: 7, name: 'INNER RING' }],
    opponent: { actor: 'd100', speed: 33, time: 12.9, label: 'D100' },
    length: 425, tern: 10.2, gold: 10.9, silver: 12.2, bronze: 15.3 },
  // Vela's race: half the Outer Ring, clockwise, against its traffic. Oncoming near misses fill the bar.
  { id: 'ring-road-rush', type: 'rival', title: 'RING ROAD RUSH', zone: 'coma',
    start: { pos: [-9, -440, 0], dir: [-1, 0, 0], r: 4.5 }, runup: { pos: [21, -440, 0], heading: 270 },
    line: 'arc: centre (-9,-10), r 430, from -90 deg to -270 deg, clockwise',
    gates: [{ pos: [-224, -382] }, { pos: [-381, -225] }, { pos: [-439, -10], split: true }, { pos: [-381, 205] },
      { pos: [-224, 362] }, { pos: [-9, 420], r: 7, name: 'FINISH' }],
    rival: { actor: 'vela', paceX: 1.18, time: 38.0 },
    length: 1350, tern: 32.2, gold: 34.5, silver: 39.0, bronze: 48.5 },
];

const STUNTS = [
  // The arrival line: first pad 95 u from the entry, then every 99 u. Turns the dive downtown into a pad run.
  { id: 'coma-dive', type: 'line', title: 'COMA DIVE', pads: [[-372, -362, 25], [-302, -292, 14], [-232, -222, 6],
    [-165, -155, 1]], 'window': 4.0, exitSpeed: 44, stars: ['all', 'all+exit', 'all-perfect'] },
  { id: 'leo-road-radar', type: 'trap', title: 'LEO ROAD RADAR', ring: { pos: [500, -128, 0], r: 6 }, stars: [40, 44, 47] },
  { id: 'halo-skim', type: 'skim', title: 'HALO SKIM', body: 'ngc4889', stars: [3, 5, 8] },         // seconds skimming
  { id: 'twin-bend', type: 'drift', title: 'TWIN BEND', area: { centre: [-9, -10], r: 35 }, stars: [1, 2, 3] },
  // Exit speed leaving the 3 × rs circle after turning 90° or more round NGC 4874.
  { id: 'giant-whip', type: 'sling', title: 'GIANT WHIP', body: 'ngc4874', minTurn: 90, stars: [38, 43, 47] },
];

const SCANS = [
  { id: 'ngc4889', target: { body: 'ngc4889' }, label: 'NGC 4889', card: 'ngc4889', line: 'dot.ngc4889' },
  { id: 'ngc4874', target: { body: 'ngc4874' }, label: 'NGC 4874', card: 'ngc4874', line: 'dot.ngc4874' },
  { id: 'ngc4911', target: { body: 'ngc4911' }, label: 'NGC 4911', card: 'ngc4911', line: 'dot.ngc4911' },
  { id: 'ngc4921', target: { body: 'ngc4921' }, label: 'NGC 4921', card: 'ngc4921', line: 'dot.ngc4921' },
  { id: 'fast-traffic', target: { traffic: 'inner' }, label: 'INNER RING', card: 'fast-traffic', line: 'dot.fast' },
  { id: 'hot-gas', target: { inside: { centre: [-9, -10], r: 140 } }, label: 'HOT GAS', card: 'hot-gas',
    line: 'dot.hotgas' },
  { id: 'udg', target: { set: 'ghosts' }, label: 'GHOST GALAXY', card: 'udg', line: 'dot.udg' },
  { id: 'd100', target: { actor: 'd100' }, label: 'D100', card: 'd100', line: 'dot.d100' },
  { id: 'cfa2-wall', target: { far: 'cfa2' }, far: true, card: 'cfa2-wall', line: 'dot.cfa2' },
  { id: 'leo-c', target: { far: 'leo-c' }, far: true, card: 'leo-c', line: 'dot.leoc' },
];

export default {
  id: 'coma', name: 'Coma City', chapter: 1, kind: 'full', object: 'coma',
  R: 700, slab: 150, band: 120, scaleLy: 7000,
  scaleCard: 'EACH POINT HERE IS A GALAXY · 1 SHIP = 7,000 LIGHT-YEARS',
  plane: { kind: 'sky' }, key: 'chapter-1',
  // Above the slab on the COMA DIVE line, facing downtown; 577 u to the Pelican.
  entry: { pos: [-440, -428, 37], heading: 45, speed: 42 },
  // The way on to Virgo. It opens when PELICAN DOWN is done (Round 2); until then it stays dark.
  exit: { pos: [480, -470, 0], r: 12, to: 'virgo', label: 'VIRGO CLUSTER · 272 MLY', opensWhen: 'mission:pelican-down' },
  bodies: [
    // Sky offsets at 323 Mly (skyplane.js): NGC 4889 is 41 u across, its faint halo 186 u.
    { id: 'ngc4889', pos: [-57, -3, 0], r: 20.5, rc: 10, halo: 93, look: 'giant-warm', well: { rs: 33 }, skim: true,
      stars: 4000, label: 'NGC 4889' },
    { id: 'ngc4874', pos: [39, -17, 0], r: 15, rc: 7, halo: 60, look: 'giant-warm', well: { rs: 24 }, skim: true,
      stars: 3000, label: 'NGC 4874' },
    // Two real spirals (WP6, not in the design's map), at their sky offsets: NGC 4911 beside the dive line, a skim
    // surface 14 s from the entry at cruise (critic note 9), and NGC 4921, the cluster's brightest spiral, east of
    // downtown where a free driver found nothing for a minute.
    { id: 'ngc4911', pos: [-200, -153, 0], r: 8.5, rc: 3.5, look: 'spiral', skim: true, label: 'NGC 4911' },
    { id: 'ngc4921', pos: [-289, -76, 0], r: 16, rc: 6, look: 'spiral', skim: true, label: 'NGC 4921' },
    // The Ghost secret: shows only inside 80 u, and only after its rumour.
    { id: 'ghost-big', pos: [-560, 330, 10], r: 20, rc: 0, look: 'udg', visibleWithin: 80,
      hiddenUntil: 'rumour:bigger-ghost' },
  ],
  roads: [
    // Zwicky's galaxies: too fast. 28 u/s, above cruise (24), so riding with one needs the gas held. A draft lane.
    { id: 'inner', kind: 'orbit', centre: [-9, -10], r: 140, dir: -1, speed: 28, count: 60, size: [3, 7], mix: 'big',
      height: 20 },
    // Counter-clockwise; Ring Road Rush runs against it.
    { id: 'outer', kind: 'orbit', centre: [-9, -10], r: 430, dir: +1, speed: 7, count: 120, size: [2, 6],
      mix: 'spiral', height: 30 },
    // West rim, toward the Leo Cluster.
    { id: 'leo', kind: 'road', pts: [[690, -120, 0], [560, -140, 10], [430, -120, 0]], flow: +1, speed: 8, count: 80,
      tube: 20, size: [1.5, 5], mix: 'spiral' },
    // East rim, toward Hercules.
    { id: 'hercules', kind: 'road', pts: [[-690, -250, 0], [-560, -220, -10], [-420, -160, 0]], flow: +1, speed: 8,
      count: 80, tube: 20, size: [1.5, 5], mix: 'spiral' },
  ],
  swarms: [
    // A ball squashed into the slab: 30% of each swarm above or below ±40 u so dives and climbs pass galaxies.
    // nearRoads 0: a cluster is a ball, not a web, so none gather along the rim roads (asked of core/traffic.js).
    { id: 'bright', count: 460, area: { r: 650 }, h: 90, size: [2, 6], drift: [2, 6], mix: 'mixed', colliders: true,
      nearRoads: 0 },
    { id: 'dwarfs', count: 1500, area: { r: 680 }, h: 120, size: [0.6, 2.5], drift: [2, 6], mix: 'dwarf',
      colliders: true, nearRoads: 0 },
  ],
  actors: [
    // D100, the jellyfish: falls toward downtown along its path. Its tail is drawn longer than real; its card says so.
    { id: 'd100', kind: 'faller', path: [[300, 450, 0], [250, 370, 0], [190, 300, 0], [150, 220, 0], [90, 160, 0],
      [40, 120, 0]], idleSpeed: 4, raceSpeed: 33, r: 4, rc: 2, tail: 150, draft: { len: 40, cone: 20 },
    label: 'D100', object: 'd100' },
    // Vela idles at her start ring. 12 s after PELICAN DOWN (never during a run-up) she buzzes past close enough to
    // count as a NEAR, says her line, and flies to the ring at 24 u/s: follow her, ride her draft.
    { id: 'vela', kind: 'racer', idleAt: [-9, -440, 0], idleHeading: 270, hull: 'swift', label: 'VELA', meetWithin: 200,
      line: 'vela.newintown',
      flyby: { after: 'mission:pelican-down', delay: 12, passWithin: 12, speed: 24, then: 'idle' } },
  ],
  rings: [
    { id: 'ferro-sos', pos: [-150, 80, 0], r: 8, label: 'FERRO · SOS', kind: 'giver', mission: 'pelican-down', ping: 4 },
    { id: 'ferro-yard', pos: [420, -330, 0], r: 10, label: "FERRO'S YARD", kind: 'giver', mission: 'fragile',
      after: 'mission:pelican-down' },
  ],
  sparks: [
    // Both filament roads carry a spark line into the city (the design had Leo's only; the east was empty).
    { road: 'leo', from: 0.1, to: 0.9, n: 8 },
    { road: 'hercules', from: 0.1, to: 0.9, n: 8 },
    { road: 'inner', from: 0, to: 0.5, n: 12, lateral: 6 },
    // From the entry down to downtown, with the COMA DIVE pads between its sparks.
    { pts: [[-425, -415, 34], [-390, -380, 28], [-355, -345, 22], [-320, -310, 17], [-285, -275, 12],
      [-250, -240, 8], [-215, -205, 5], [-180, -170, 2], [-150, -140, 0], [-120, -110, 0]] },
  ],                                                                      // 38
  far: [
    { id: 'leo-c', object: 'leo', label: 'LEO CLUSTER', scan: 'leo-c', kind: 'scan' },
    { id: 'cfa2', object: 'hercules', label: 'CFA2 GREAT WALL', scan: 'cfa2-wall', kind: 'scan' },
    { id: 'next', object: 'virgo', kind: 'next' },
  ],
  sets: {
    // Drawn in full inside 80 u; a faint shimmer and a radar dot from 250 u, so the hunt is driving, not sweeping.
    // Eight in the outskirts as designed, plus two in the gaps the density test found (south, and east of downtown):
    // ghosts spread through a cluster like the bright galaxies do (udg card).
    ghosts: { label: 'GHOSTS', visibleWithin: 80, shimmerWithin: 250, reward: { trail: 'pale', card: 'udg-many' },
      items: [[-610, 40, 20], [-420, 520, -30], [-150, 640, 10], [250, 600, 40], [560, 330, -20], [640, -60, 0],
        [330, -600, 30], [-300, -620, -10], [40, -650, -10], [-330, 170, 15]] },
  },
  rumours: [
    { id: 'ride-downtown', from: ['scan:fast-traffic', 'mission:fragile', 'win:ring-road-rush'],
      text: "Ride with one downtown. You'll see.", opens: 'zwickys-clue' },
    { id: 'bigger-ghost', from: ['scan:udg'], text: "There's a bigger ghost out east.", opens: 'the-ghost' },
  ],
  secrets: [
    // Stay within 4 u of one Inner Ring galaxy for 5 s. Reward: a faint violet glow over every cluster core.
    { id: 'zwickys-clue', rumour: 'ride-downtown', when: { ride: 'inner', within: 4, seconds: 5 },
      reward: { card: 'dark-matter', lens: 'dark-matter', line: 'dot.darkmatter' } },
    { id: 'the-ghost', rumour: 'bigger-ghost', when: { at: [-560, 330], within: 25 },
      reward: { card: 'udg-big', trail: 'ghost' } },
  ],
  lookHome: { card: 'snowball', line: 'dot.lh.coma' },                   // light 653 million years old (legs.js)
  zoneCard: 'coma',
  missions: ['pelican-down', 'fragile'],
  backdrop: { web: 'chapter-1', rings: ['leo', 'hercules', 'virgo'] },
  art: { atlas: ['wp-grand', 'wp-barred', 'wp-flocculent', 'elliptical'], giants: ['ngc4889', 'ngc4874'], extra: 'coma',
    tint: { elliptical: 4200, spiral: 5600 } },                         // Coma runs warm
  events: [...EVENTS, ...STUNTS],
  scans: SCANS,
};
