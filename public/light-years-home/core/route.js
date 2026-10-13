// Light Years Home: the route home. Four chapters, 15 stops, 2 spots and one fork, in the video's order. Each stop has
// a clue, three candidates (the target and seeded decoys), a reveal line, and the flight that follows a lock: a list
// of zones of space, each with a gas density (atoms per cm³, with a source), a true length in light-years and a
// design screen time at its speed limit. Leg lengths come from the positions in objects.js. Intergalactic legs thread
// unnamed waypoint galaxies (disclosed in How it works); the Milky Way legs are checked against the gas model in gas.js.

import { OBJECTS, AU_LY, distanceLy } from './objects.js';
import { hashSeed, mulberry32 } from './rng.js';

const W = 'https://en.wikipedia.org/wiki/';
const au = (x) => x * AU_LY;

// ---------- zone densities (cinematic.md §5.3), atoms per cm³ ----------

export const DENSITY = {
  void: { n: 3e-8, plain: '1 atom per 30 m³', src: W + 'Void_(astronomy)' },
  filament: { n: 2.5e-7, plain: '1 atom per 4 m³', src: W + 'Warm%E2%80%93hot_intergalactic_medium' },
  outerHalo: { n: 1e-4, plain: '1 atom per 10 litres', src: W + 'Galactic_corona' },
  halo: { n: 1e-3, plain: '1 atom per litre', src: W + 'Galactic_corona' },
  cluster: { n: 3e-3, plain: '3 atoms per litre', src: W + 'Intracluster_medium' },
  bubble: { n: 0.005, plain: '5 atoms per litre', src: W + 'Local_Bubble' },
  thickDisc: { n: 0.05, plain: '1 atom per 20 cm³', src: W + 'Interstellar_medium' },
  interarm: { n: 0.1, plain: '1 atom per 10 cm³', src: W + 'Interstellar_medium' },
  lic: { n: 0.2, plain: '1 atom per 5 cm³', src: W + 'Local_Interstellar_Cloud' },
  orionArm: { n: 0.5, plain: '1 atom per 2 cm³', src: W + 'Interstellar_medium' },
  arm: { n: 1, plain: '1 atom per cm³', src: W + 'Interstellar_medium' },
  loop: { n: 10, plain: '10 atoms per cm³', src: W + 'H_II_region' },
  dust: { n: 30, plain: '30 atoms per cm³', src: W + 'Interstellar_medium' },
  molecular: { n: 100, plain: '100 atoms per cm³', src: W + 'Molecular_cloud' },
  core: { n: 1000, plain: '1,000 atoms per cm³', src: W + 'H_II_region' },
  wind: { n: 5, plain: '5 atoms per cm³ at Earth, falling as 1 / r²', src: W + 'Solar_wind' },
  belt: { n: 1e4, plain: 'one grain hits like a bomb (an estimate)', src: W + 'Asteroid_belt' },
};

// A zone: { kind, n, ly, screen, label, src, at?, info? }. ly is a number or 'fill' (the rest of the leg).
function z(kind, cls, ly, screen, label, extra = {}) {
  const d = DENSITY[cls];
  return { kind, n: extra.n ?? d.n, ly, screen, label, src: d.src, ...(extra.at ? { at: extra.at } : {}),
    ...(extra.info ? { info: extra.info } : {}) };
}
const WAYPOINT_LY = 1500;   // crossing a galaxy's gas disc at a slant
const waypoint = (screen) => z('waypoint', 'arm', WAYPOINT_LY, screen, 'Spiral galaxy');

// ---------- the opening ----------

export const INTRO = [
  { id: 'wake', text: 'You wake up a billion light-years from home.', firstRunOnly: true },
  { id: 'map', text: 'Your map is gone. Read the sky. Get home.', firstRunOnly: true },
  { id: 'ring', text: 'Home is in that ring. Too big to aim at.', ring: 'laniakea' },
];

// ---------- chapters ----------

export const CHAPTERS = [
  { id: 'wall', title: 'I · The Wall', info: 'Every dot is a galaxy', stops: ['coma', 'virgo', 'fornax'],
    end: 'On Earth: the dinosaurs are gone.' },
  { id: 'neighbours', title: 'II · Neighbours', info: 'Every dot is a galaxy', stops: ['andromeda', 'milky-way', 'carina'],
    end: 'On Earth: the ice age ends. People start to farm.' },
  { id: 'orion-arm', title: 'III · The Orion Arm', info: 'Every dot is a star',
    stops: ['orions-belt', 'orion-nebula', 'betelgeuse', 'pleiades'],
    end: 'On Earth: Copernicus puts the Sun at the centre.' },
  { id: 'home', title: 'IV · Home', info: 'Radio from home',
    stops: ['aldebaran', 'sirius', 'alpha-centauri', 'sun', 'earth'], end: null },
];

// The fork after the Andromeda lock (Fornax → Andromeda). The sheet branch threads galaxies and crosses the Local
// Sheet in its last 3 million ly; the void branch crosses empty space. Same straight line, same length.
const FORK_SHEET = [
  z('cluster', 'cluster', 2.5e6, 1.2, 'Fornax Cluster', { at: 'fornax' }),
  z('filament', 'filament', 'fill', 1.4, 'Filament'),
  waypoint(0.9),
  z('filament', 'filament', 6e6, 0.8, 'Open space'),
  waypoint(0.9),
  z('filament', 'filament', 2.4e6, 0.6, 'Local Sheet'),
  waypoint(0.9),
  z('halo', 'halo', 4e5, 1.4, 'Andromeda halo', { at: 'andromeda' }),
  z('arrive', 'halo', 1e5, 1.2, 'Andromeda', { at: 'andromeda' }),
];
const FORK_VOID = [
  z('cluster', 'cluster', 2.5e6, 1.0, 'Fornax Cluster', { at: 'fornax' }),
  z('void', 'void', 'fill', 4.6, 'Empty space', { info: 'Here, almost no galaxies at all' }),
  z('halo', 'halo', 4e5, 1.4, 'Andromeda halo', { at: 'andromeda' }),
  z('arrive', 'halo', 1e5, 1.2, 'Andromeda', { at: 'andromeda' }),
];

// ---------- stops ----------
// from / via / to: the leg's path through object positions. target and decoys: the scan's candidates; has lists the
// features a candidate shows, needs the features the clue asks for. A run draws 2 decoys, always the trap.
// coach: first-run hints during the flight; lines: captions every run. Triggers: { at: 'flight' } when the flight
// starts, { at: 'notch' } when the throttle first reaches the notch, { at: 'hot' } when the shield first heats up,
// { at: 'radio' } at the first radio signal,
// { atZone: k } as zone k comes up. passes: labelled rings during the flight; p is the share of the leg's screen time.

export const STOPS = [
  {
    id: 'coma', chapter: 0, from: 'start', to: 'coma', via: [], info: 'Every dot is a galaxy',
    clue: 'Find a crowd of a thousand galaxies with two giants at its heart.',
    needs: ['thousand', 'two-giants'],
    target: { id: 'coma', has: ['thousand', 'two-giants', 'round'],
      facts: ['About 1,000 galaxies', 'Round and dense', 'Two giant ellipticals at its heart'] },
    decoys: [
      { id: 'leo', trap: true, has: ['round'],
        facts: ['About 70 big galaxies', 'Mostly young spirals', 'One giant at its heart'],
        whyNot: "That's the Leo Cluster. One giant, not two." },
      { id: 'shapley', has: ['thousand'], facts: ['Thousands of galaxies', 'Spread over many clusters', 'No single heart'],
        whyNot: "That's the Shapley Supercluster. Many hearts, not one." },
      { id: 'hercules', has: [], facts: ['200 to 300 galaxies', 'Lumpy, with many spirals', 'Galaxies in collision'],
        whyNot: "That's the Hercules Cluster. Lumpy, with no giant heart." },
    ],
    reveal: 'The Coma Cluster. A thousand galaxies. Home is 323 million light-years away.',
    scan: { fovMin: 8, fovMax: 75 },
    // The first flight opens on a long open stretch, so "Hold to go faster." and the notch line play before the
    // first galaxy: held from rest, "Galaxy ahead. Let go!" comes about 5.8 s in.
    zones: [
      z('filament', 'filament', 40e6, 2.6, 'Sloan Great Wall', { at: 'start' }),
      z('void', 'void', 'fill', 3.8, 'Void'),
      waypoint(0.9),
      z('filament', 'filament', 30e6, 0.9, 'Coma Supercluster'),
      waypoint(0.9),
      z('cluster', 'cluster', 3e6, 0.6, 'Coma Cluster', { at: 'coma' }),
      z('arrive', 'cluster', 1e6, 1.2, 'Coma Cluster', { at: 'coma' }),
    ],
    branches: null, fork: null, passes: [], spot: null,
    coach: [
      { at: 'flight', text: 'Hold to go faster.' },
      { at: 'notch', text: 'Nothing is faster than light. Not even you.' },
      { at: 'hot', text: 'Too hot! Ease back to the orange mark.' },
      { atZone: 2, text: 'Galaxy ahead. Let go!' },
    ],
    lines: [],
  },
  {
    id: 'virgo', chapter: 0, from: 'coma', to: 'virgo', via: [], info: 'Every dot is a galaxy',
    clue: 'Now find a hub of about 1,500 galaxies. A jet streams from the giant at its heart.',
    needs: ['about-1500', 'jet'],
    target: { id: 'virgo', has: ['about-1500', 'jet', 'giant-heart'],
      facts: ['About 1,500 galaxies', 'Heart: M87, a giant elliptical', 'A jet about 5,000 ly long'] },
    decoys: [
      { id: 'centaurus', trap: true, has: ['giant-heart'],
        facts: ['Hundreds of galaxies', 'Heart: a giant wrapped in dust', 'No jet to see'],
        whyNot: "That's the Centaurus Cluster. Hundreds of galaxies, not 1,500." },
      { id: 'hydra', has: [], facts: ['About 160 bright galaxies', 'Two giants side by side', 'No jet to see'],
        whyNot: "That's the Hydra Cluster. About 160 bright galaxies, not 1,500." },
    ],
    reveal: 'The Virgo Cluster. Its pull reaches all the way to the Milky Way.',
    scan: { fovMin: 8, fovMax: 50 },
    zones: [
      z('cluster', 'cluster', 3e6, 1.2, 'Coma Cluster', { at: 'coma' }),
      waypoint(1.0),
      z('void', 'void', 'fill', 2.6, 'Void'),
      z('filament', 'filament', 30e6, 1.4, 'Virgo Supercluster'),
      waypoint(0.9),
      waypoint(0.9),
      z('cluster', 'cluster', 2.5e6, 1.2, 'Virgo Cluster', { at: 'virgo' }),
      z('arrive', 'cluster', 1e6, 1.2, 'Virgo Cluster', { at: 'virgo' }),
    ],
    branches: null, fork: null, passes: [], spot: null,
    coach: [{ atZone: 4, text: 'Two galaxies in a row. Stay low.' }],
    lines: [],
  },
  {
    id: 'fornax', chapter: 0, from: 'virgo', to: 'fornax', via: ['eridanus'], info: 'Every dot is a galaxy',
    clue: 'Find a small, tight cluster with a looser one beside it.',
    needs: ['tight', 'neighbour'],
    target: { id: 'fornax', has: ['tight', 'neighbour', 'small'],
      facts: ['58 galaxies', 'Small, tight and round', 'A loose cluster beside it'] },
    decoys: [
      { id: 'eridanus', trap: true, has: ['neighbour'], facts: ['About 200 galaxies', 'Loose, in small groups',
        'A tight cluster beside it'], whyNot: "That's the Eridanus Cluster, the loose one. You will pass it." },
      { id: 'norma', has: ['tight'], facts: ['Hundreds of galaxies', 'Dense and round', 'Half hidden behind dust'],
        whyNot: "That's the Norma Cluster. Tight, but far too big." },
    ],
    reveal: 'The Fornax Cluster. Between here and home: a flat sheet of galaxies, and an empty void.',
    scan: { fovMin: 8, fovMax: 100 },
    zones: [
      z('cluster', 'cluster', 2.5e6, 0.8, 'Virgo Cluster', { at: 'virgo' }),
      waypoint(0.9),
      z('void', 'void', 'fill', 1.6, 'Void'),
      z('cluster', 'cluster', 2e6, 0.8, 'Eridanus Cluster', { at: 'eridanus' }),   // centred on the Eridanus Cluster
      waypoint(0.9),
      z('filament', 'filament', 4e6, 0.5, 'Open space'),
      waypoint(0.9),
      z('filament', 'filament', 13922082, 0.9, 'Filament'),   // Eridanus → Fornax is 21,926,582 ly
      z('cluster', 'cluster', 2e6, 0.8, 'Fornax Cluster', { at: 'fornax' }),
      waypoint(0.9),
      z('arrive', 'cluster', 1e6, 1.2, 'Fornax Cluster', { at: 'fornax' }),
    ],
    branches: null, fork: null, passes: [{ id: 'eridanus', p: 0.36 }], spot: null,
    coach: [], lines: [],
  },
  {
    id: 'andromeda', chapter: 1, from: 'fornax', to: 'andromeda', via: [], info: 'Every dot is a galaxy',
    clue: 'The galaxies thin out. Find the biggest spiral in sight.',
    needs: ['spiral', 'biggest'],
    target: { id: 'andromeda', has: ['spiral', 'biggest'],
      facts: ['A spiral galaxy', '152,000 ly across', 'About a trillion stars'] },
    decoys: [
      { id: 'm81', trap: true, has: ['spiral'], facts: ['A spiral galaxy', '96,000 ly across', 'Arms wound tight'],
        whyNot: "That's Bode's Galaxy. A spiral, but smaller." },
      { id: 'cen-a', has: [], facts: ['A round glow', 'Cut by a dark band of dust', 'Jets from its heart'],
        whyNot: "That's Centaurus A. Not a spiral." },
    ],
    reveal: 'Andromeda. A trillion stars. Our big neighbour.',
    scan: { fovMin: 8, fovMax: 35 },
    // Both branches fly the same straight line and have the same length; they differ in what lies along it.
    // zones is the sheet branch, for readers that ignore the fork.
    zones: FORK_SHEET,
    branches: { sheet: FORK_SHEET, void: FORK_VOID },
    fork: {
      prompt: 'Two ways home. Thread the galaxies, or cross the empty dark?',
      sheet: { label: 'Thread the galaxies', note: 'Busier. 400 points if your shield stays whole.' },
      void: { label: 'Cross the empty dark', note: 'Almost no galaxies. Safe.' },
    },
    passes: [],
    spot: {
      id: 'triangulum',
      clue: 'Nearby, find a smaller spiral.',
      needs: ['spiral', 'smaller'],
      target: { id: 'triangulum', has: ['spiral', 'smaller'],
        facts: ['A spiral galaxy', '61,000 ly across', 'Patchy arms'] },
      decoys: [
        { id: 'm32', trap: true, has: ['smaller'], facts: ['A small round galaxy', '8,000 ly across', 'No arms'],
          whyNot: "That's M32. Small and round. No arms." },
        { id: 'm110', has: ['smaller'], facts: ['A soft oval galaxy', '17,000 ly across', 'No arms'],
          whyNot: "That's M110. A soft oval. No arms." },
      ],
      reveal: 'Triangulum. With Andromeda, it marks out the Local Group.',
      scan: { fovMin: 6, fovMax: 100 },
    },
    coach: [], lines: [],
  },
  {
    id: 'milky-way', chapter: 1, from: 'andromeda', to: 'mw-entry', via: [], info: 'Every dot is a galaxy',
    clue: 'Home is near Andromeda. Find a spiral with a bar across its middle.',
    needs: ['spiral', 'bar'],
    target: { id: 'milky-way', has: ['spiral', 'bar'],
      facts: ['A spiral with a bar', '87,000 ly across', 'Small companions around it'] },
    decoys: [
      { id: 'triangulum', trap: true, has: ['spiral'], facts: ['A spiral galaxy', 'Looks big from here', 'No bar'],
        whyNot: "That's Triangulum. It looks bigger because it is closer. No bar." },
      { id: 'ngc6822', has: ['bar'], facts: ['A small galaxy with a bar', '9,200 ly across', 'No spiral arms'],
        whyNot: "That's Barnard's Galaxy. A bar, but no arms." },
    ],
    reveal: 'The Milky Way. A barred spiral. Home is in there.',
    scan: { fovMin: 6, fovMax: 100 },
    zones: [
      z('halo', 'halo', 6e5, 1.2, 'Andromeda halo', { at: 'andromeda' }),
      z('filament', 'filament', 'fill', 2.4, 'Local Group'),
      z('halo', 'outerHalo', 3.2e5, 1.4, 'Milky Way hot halo', { at: 'milky-way' }),
      z('halo', 'halo', 2.5e5, 1.6, 'Milky Way halo', { at: 'milky-way' }),
      z('arrive', 'halo', 1.5e4, 1.2, 'Edge of the Milky Way', { at: 'mw-entry' }),
    ],
    branches: null, fork: null,
    passes: [{ id: 'lmc', p: 0.86 }, { id: 'smc', p: 0.88 }, { id: 'sgr-dwarf', p: 0.95 }],
    spot: null, coach: [], lines: [],
  },
  {
    id: 'carina', chapter: 1, from: 'mw-entry', to: 'carina', via: [], info: 'Every dot is a star',
    clue: 'Keep clear of the crowded centre. Find the biggest star nursery in sight.',
    needs: ['nursery', 'biggest'],
    target: { id: 'carina', has: ['nursery', 'biggest'],
      facts: ['A giant star nursery', 'Hundreds of ly across', 'Eta Carinae shines inside'] },
    decoys: [
      { id: 'galactic-centre', trap: true, has: ['biggest'],
        facts: ['Stars packed close', 'A black hole of 4 million Suns', 'The crowded centre'],
        whyNot: "That's the Galactic Centre. Too crowded. Stay out." },
      { id: 'orion-nebula', has: ['nursery'], facts: ['A star nursery', '24 ly across', 'Glowing pink'],
        whyNot: "That's the Orion Nebula. A nursery, but small. You come back to it later." },
    ],
    reveal: 'The Carina Nebula. Stars are born here by the thousand.',
    scan: { fovMin: 6, fovMax: 40 },
    overlay: 'arms',     // label the spiral arms the path passes over, with their height (gas.armsPassed)
    zones: [
      z('halo', 'halo', 'fill', 3.4, 'Milky Way halo', { at: 'milky-way' }),
      z('disc', 'thickDisc', 3000, 1.2, 'Thick disc'),
      z('arm', 'arm', 1120, 1.4, 'Sagittarius–Carina Arm', { n: 0.5 }),   // the top of the gas layer, |z| 150 to 500 ly
      z('nebula', 'molecular', 140, 1.6, 'Carina Nebula', { at: 'carina' }),
      z('arrive', 'molecular', 10, 1.2, 'Carina Nebula', { at: 'carina' }),
    ],
    branches: null, fork: null, passes: [{ id: 'eta-carinae', p: 0.95 }], spot: null, coach: [], lines: [],
  },
  {
    id: 'orions-belt', chapter: 2, from: 'carina', to: 'orions-belt', via: [], info: 'Every dot is a star',
    clue: 'From Carina, look for three bright blue stars in a row.',
    needs: ['three', 'line'],
    target: { id: 'orions-belt', has: ['three', 'line', 'blue'],
      facts: ['Three bright blue stars', 'In a line 62 ly long', 'Two supergiants and a giant'] },
    decoys: [
      { id: 'pleiades', trap: true, has: ['blue'], facts: ['Hundreds of hot blue stars', 'In a tight knot',
        'Wrapped in blue haze'], whyNot: "That's the Pleiades. A knot, not a line." },
      { id: 'rigel', has: ['blue'], facts: ['Colour 12,100 K', 'One blue supergiant', 'On its own'],
        whyNot: "That's Rigel. One star, not three." },
    ],
    reveal: "Orion's Belt. Alnitak, Alnilam, Mintaka.",
    scan: { fovMin: 3, fovMax: 30 },
    zones: [
      z('nebula', 'molecular', 150, 1.2, 'Carina Nebula', { at: 'carina' }),
      z('arm', 'arm', 1700, 1.0, 'Sagittarius–Carina Arm'),
      z('interarm', 'interarm', 'fill', 1.2, 'Between the arms'),
      z('arm', 'orionArm', 870, 0.8, 'Orion Arm', { at: 'orion-arm' }),
      z('nebula', 'loop', 660, 1.2, 'Gum Nebula'),
      z('arm', 'orionArm', 340, 0.6, 'Orion Arm', { at: 'orion-arm' }),
      z('bubble', 'bubble', 285, 0.8, 'Orion–Eridanus Superbubble'),
      z('nebula', 'loop', 50, 0.8, "Barnard's Loop"),
      z('bubble', 'bubble', 155, 0.6, 'Orion–Eridanus Superbubble'),
      z('arrive', 'bubble', 10.34, 1.2, "Orion's Belt", { at: 'orions-belt' }),
    ],
    branches: null, fork: null, passes: [], spot: null, coach: [],
    lines: [{ atZone: 3, text: 'Into our own arm: the Orion Arm. A small spur, far from the centre.' }],
  },
  {
    id: 'orion-nebula', chapter: 2, from: 'orions-belt', to: 'orion-nebula', via: [], info: 'Every dot is a star',
    clue: 'South of the Belt, find a pink cloud where stars are being born.',
    needs: ['pink', 'nursery'],
    target: { id: 'orion-nebula', has: ['pink', 'nursery', 'glowing'],
      facts: ['A glowing pink cloud', '24 ly across', 'Full of newborn stars'] },
    decoys: [
      { id: 'horsehead', trap: true, has: ['nursery'], facts: ['Dark dust shaped like a horse', 'Does not glow',
        'Lit from behind'], whyNot: "That's the Horsehead. Dark, not glowing." },
      { id: 'witch-head', has: [], facts: ['A faint blue cloud', 'Dust lit by Rigel', 'Shaped like a face'],
        whyNot: "That's the Witch Head. Blue, not pink." },
    ],
    reveal: 'The Orion Nebula. The nearest big star nursery to home.',
    scan: { fovMin: 6, fovMax: 100 },
    zones: [
      z('bubble', 'bubble', 'fill', 1.4, 'Orion–Eridanus Superbubble'),
      z('cloud', 'molecular', 18, 2.0, 'Orion A cloud'),
      z('nebula', 'core', 10, 2.4, 'Orion Nebula', { at: 'orion-nebula' }),
      z('arrive', 'core', 2, 1.2, 'Orion Nebula', { at: 'orion-nebula' }),
    ],
    branches: null, fork: null, passes: [], spot: null,
    coach: [{ atZone: 2, text: 'Thick gas. Let go all the way.' }], lines: [],
  },
  {
    id: 'betelgeuse', chapter: 2, from: 'orion-nebula', to: 'betelgeuse', via: [], info: 'Every dot is a star',
    clue: "Turn to Orion's shoulder. Find the huge red supergiant.",
    needs: ['red', 'supergiant'],
    target: { id: 'betelgeuse', has: ['red', 'supergiant', 'shoulder'],
      facts: ['Colour 3,800 K', 'A red supergiant', 'Wider than the orbit of Mars'] },
    decoys: [
      { id: 'bellatrix', trap: true, has: ['shoulder'], facts: ['Colour 22,000 K', 'A blue-white giant',
        "Orion's other shoulder"], whyNot: "That's Bellatrix. The other shoulder. Blue, not red." },
      { id: 'aldebaran', has: ['red'], facts: ['Colour 3,900 K', 'An orange giant', '45 times as wide as the Sun'],
        whyNot: "That's Aldebaran. A giant, not a supergiant." },
    ],
    reveal: 'Betelgeuse. It would swallow the orbit of Mars.',
    scan: { fovMin: 4, fovMax: 30 },
    zones: [
      z('nebula', 'core', 12, 1.0, 'Orion Nebula', { at: 'orion-nebula' }),
      z('cloud', 'molecular', 18, 1.2, 'Orion A cloud'),
      z('bubble', 'bubble', 46, 0.6, 'Orion–Eridanus Superbubble'),
      z('nebula', 'loop', 42, 1.2, "Barnard's Loop"),
      z('bubble', 'bubble', 'fill', 2.4, 'Orion–Eridanus Superbubble'),
      z('arrive', 'bubble', 5, 1.2, 'Betelgeuse', { at: 'betelgeuse' }),
    ],
    branches: null, fork: null, passes: [], spot: null, coach: [], lines: [],
  },
  {
    id: 'pleiades', chapter: 2, from: 'betelgeuse', to: 'pleiades', via: [], info: 'Every dot is a star',
    clue: 'As you travel, find a tight knot of young, hot blue stars.',
    needs: ['young', 'tight'],
    target: { id: 'pleiades', has: ['young', 'tight', 'blue'],
      facts: ['Hundreds of stars', 'Hot and blue, in a blue haze', '125 million years old'] },
    decoys: [
      { id: 'hyades', trap: true, has: [],
        facts: ['Hundreds of stars', 'Loose, in a V shape', 'About 625 million years old'],
        whyNot: "That's the Hyades. Too old, too loose." },
      { id: 'beehive', has: [], facts: ['About 1,000 stars', 'Old and yellowish', 'About 600 million years old'],
        whyNot: "That's the Beehive. Old and yellow." },
    ],
    reveal: 'The Pleiades. Born while dinosaurs walked the Earth.',
    scan: { fovMin: 6, fovMax: 100 },
    zones: [
      z('bubble', 'bubble', 'fill', 2.0, 'Local Bubble'),
      z('cloud', 'molecular', 91, 1.6, 'Taurus Molecular Cloud'),
      z('bubble', 'bubble', 11, 1.0, 'Local Bubble'),
      z('cloud', 'dust', 8, 1.4, 'Pleiades dust', { at: 'pleiades' }),
      z('arrive', 'dust', 2, 1.2, 'Pleiades', { at: 'pleiades' }),
    ],
    branches: null, fork: null, passes: [],
    spot: {
      id: 'antares',
      clue: 'Look toward the galactic centre. Find another red supergiant.',
      needs: ['red', 'supergiant'],
      target: { id: 'antares', has: ['red', 'supergiant', 'partner'],
        facts: ['Colour 3,660 K', 'A red supergiant', 'A small blue star beside it'] },
      decoys: [
        { id: 'spica', trap: true, has: ['partner'], facts: ['Colour 25,300 K', 'Two blue-white stars', 'A close pair'],
          whyNot: "That's Spica. Two stars, both blue-white." },
        { id: 'arcturus', has: ['red'], facts: ['Colour 4,300 K', 'An orange giant', 'On its own'],
          whyNot: "That's Arcturus. Orange, and a giant, not a supergiant." },
      ],
      reveal: 'Antares. Its name means rival of Mars.',
      scan: { fovMin: 6, fovMax: 35 },
    },
    coach: [], lines: [],
  },
  {
    id: 'aldebaran', chapter: 3, from: 'pleiades', to: 'aldebaran', via: ['hyades'], info: 'Radio from home',
    clue: 'Now find an orange giant in front of a loose cluster.',
    needs: ['orange', 'cluster-behind'],
    target: { id: 'aldebaran', has: ['orange', 'cluster-behind', 'giant'],
      facts: ['Colour 3,900 K', 'An orange giant', 'A loose cluster behind it'] },
    decoys: [
      { id: 'capella', trap: true, has: ['orange', 'giant'], facts: ['Colour 5,000 K', 'Two yellow giants',
        'No cluster behind it'], whyNot: "That's Capella. No cluster behind it." },
      { id: 'arcturus', has: ['orange', 'giant'], facts: ['Colour 4,300 K', 'An orange giant', 'Alone in its patch of sky'],
        whyNot: "That's Arcturus. Orange, but alone." },
    ],
    reveal: 'Aldebaran. From Earth it seems to sit in the Hyades. It is less than half as far away.',
    scan: { fovMin: 3, fovMax: 22 },
    zones: [
      z('cloud', 'dust', 10, 1.0, 'Pleiades dust', { at: 'pleiades' }),
      z('bubble', 'bubble', 'fill', 2.0, 'Local Bubble'),
      z('bubble', 'bubble', 66, 2.0, 'Hyades', { at: 'hyades' }),   // stars, no gas; centred on the cluster
      z('bubble', 'bubble', 50.4438, 1.4, 'Local Bubble'),            // Hyades → Aldebaran is 86.4438 ly
      z('arrive', 'bubble', 3, 1.2, 'Aldebaran', { at: 'aldebaran' }),
    ],
    branches: null, fork: null, passes: [{ id: 'hyades', p: 0.53 }], spot: null, coach: [], lines: [],
  },
  {
    id: 'sirius', chapter: 3, from: 'aldebaran', to: 'sirius', via: [], info: 'Radio from home',
    clue: 'Find a white star with a tiny white dwarf beside it.',
    needs: ['white', 'dwarf-partner'],
    target: { id: 'sirius', has: ['white', 'dwarf-partner'],
      facts: ['Colour 9,800 K', 'A white star', 'A tiny white dwarf beside it'] },
    decoys: [
      { id: 'procyon', trap: true, has: ['dwarf-partner'], facts: ['Colour 6,600 K', 'A yellow-white star',
        'A tiny white dwarf beside it'], whyNot: "That's Procyon. Right partner, wrong colour." },
      { id: 'vega', has: ['white'], facts: ['Colour 9,600 K', 'A white star', 'No partner'],
        whyNot: "That's Vega. White, but alone." },
    ],
    reveal: 'Sirius. From Earth, the brightest star of the night.',
    scan: { fovMin: 6, fovMax: 40 },
    zones: [
      z('bubble', 'bubble', 'fill', 2.4, 'Local Bubble'),
      z('cloud', 'lic', 14.3, 6.0, 'Local Interstellar Cloud'),
      z('arrive', 'lic', 1, 1.4, 'Sirius', { at: 'sirius' }),
    ],
    branches: null, fork: null, passes: [], spot: null, coach: [],
    lines: [{ at: 'radio', text: 'Listen. The first radio from home.' },
      { atZone: 1, text: 'The voices get younger as you get closer.' }],
  },
  {
    id: 'alpha-centauri', chapter: 3, from: 'sirius', to: 'alpha-centauri', via: [], info: 'Radio from home',
    clue: 'Nearby: a golden pair, and a small red star on its own.',
    needs: ['pair', 'red-dwarf'],
    target: { id: 'alpha-centauri', has: ['pair', 'red-dwarf', 'golden'],
      facts: ['Two Sun-like stars, gold and orange', 'A small red dwarf nearby', 'Colour 5,700 K and 5,200 K'] },
    decoys: [
      { id: 'sun', trap: true, has: ['golden'], facts: ['Colour 5,800 K', 'One yellow-white star', 'Planets around it'],
        whyNot: "That's the Sun, your own star. Visit its neighbours first." },
      { id: 'barnards-star', has: ['red-dwarf'], facts: ['Colour 3,200 K', 'One small red dwarf', 'Alone'],
        whyNot: "That's Barnard's Star. Red, but no golden pair." },
      { id: 'vega', has: [], facts: ['Colour 9,600 K', 'One white star', 'No partner'],
        whyNot: "That's Vega. One white star, not a pair." },
    ],
    reveal: 'Alpha Centauri. The closest stars to the Sun.',
    scan: { fovMin: 6, fovMax: 60 },
    zones: [
      z('cloud', 'lic', 'fill', 3.0, 'Local Interstellar Cloud'),
      z('cloud', 'lic', 3.32, 3.0, 'G-Cloud'),
      z('arrive', 'lic', 0.5, 1.4, 'Alpha Centauri', { at: 'alpha-centauri' }),
    ],
    branches: null, fork: null, passes: [{ id: 'proxima', p: 0.95 }], spot: null, coach: [], lines: [],
  },
  {
    id: 'sun', chapter: 3, from: 'alpha-centauri', to: 'kuiper', via: [], info: 'Radio from home',
    clue: 'A little fainter than Sirius: one plain yellow star.',
    needs: ['one', 'yellow'],
    target: { id: 'sun', has: ['one', 'yellow'],
      facts: ['Colour 5,800 K', 'One star, no partner', 'Magnitude 0.5 from here'] },
    decoys: [
      { id: 'capella', trap: true, has: ['yellow'], facts: ['Colour 5,000 K', 'Two yellow giants', 'Far behind it'],
        whyNot: "That's Capella. Yellow, but two giants." },
      { id: 'sirius', has: [], facts: ['Colour 9,800 K', 'White and very bright', 'A tiny partner'],
        whyNot: "That's Sirius again. Too white, too bright." },
    ],
    reveal: 'The Sun. An ordinary star. Yours.',
    scan: { fovMin: 6, fovMax: 80 },
    zones: [
      z('cloud', 'lic', 3.24, 2.0, 'G-Cloud'),
      z('cloud', 'lic', 'fill', 2.4, 'Local Interstellar Cloud'),
      z('wind', 'wind', au(96), 1.2, 'Heliopause', { n: 1e-3, at: 'sun' }),
      z('arrive', 'wind', au(5.5), 1.4, 'Kuiper belt', { n: 3e-3, at: 'kuiper' }),
    ],
    branches: null, fork: null, passes: [{ id: 'jupiter', p: 1 }, { id: 'saturn', p: 1 }], spot: null, coach: [],
    lines: [],
  },
  {
    id: 'earth', chapter: 3, from: 'kuiper', to: 'earth', via: [], info: 'Radio from home',
    clue: 'Planets appear. Giants far out, rocky worlds close in. Find the small blue one with a big grey moon.',
    needs: ['blue', 'big-moon'],
    target: { id: 'earth', has: ['blue', 'big-moon', 'rocky'],
      facts: ['A rocky world', 'Blue oceans, white clouds', 'One big grey moon'] },
    decoys: [
      { id: 'neptune', trap: true, has: ['blue'], facts: ['A blue ice giant', '17 times as heavy as Earth',
        '30 AU from the Sun'], whyNot: "That's Neptune. Blue, but a giant." },
      { id: 'venus', has: ['rocky'], facts: ['A rocky world', 'Thick yellow-white clouds', 'No moon'],
        whyNot: "That's Venus. No moon." },
      { id: 'mars', has: ['rocky'], facts: ['A rocky world', 'Red, with white ice caps', 'Two tiny moons'],
        whyNot: "That's Mars. Red, with two tiny moons." },
    ],
    reveal: 'Earth.',   // the ending plays from here
    scan: { fovMin: 2, fovMax: 65 },
    zones: [
      z('wind', 'wind', 'fill', 1.5, 'Kuiper belt', { n: 7e-3 }),
      z('wind', 'wind', au(7.53), 0.9, "Saturn's orbit", { n: 0.05, at: 'saturn' }),
      z('wind', 'wind', au(4.28), 0.8, "Jupiter's orbit", { n: 0.2, at: 'jupiter' }),
      z('belt', 'belt', au(1.29), 1.2, 'Asteroid belt'),
      z('wind', 'wind', au(1.34), 1.1, 'Solar wind', { n: 2 }),
      z('wind', 'wind', au(0.27), 0.7, 'Earth', { at: 'earth' }),   // 0.7 s at the notch, 2.3 s let go (rate floor 0.3)
      z('arrive', 'wind', au(0.01), 1.2, 'Earth', { at: 'earth' }),
    ],
    branches: null, fork: null, passes: [{ id: 'neptune', p: 0.1 }, { id: 'moon', p: 0.97 }], spot: null,
    coach: [], lines: [{ atZone: 5, text: 'Let go to arrive.' }],
  },
];

// Every scan in play order: each stop, then its spot if it has one.
export const SCANS = STOPS.flatMap((stop, index) => {
  const out = [{ id: stop.id, stop: index, mode: 'stop', entry: stop }];
  if (stop.spot) out.push({ id: stop.spot.id, stop: index, mode: 'spot', entry: stop.spot });
  return out;
});

export function stopIndex(id) {
  return STOPS.findIndex((s) => s.id === id);
}

// ---------- lengths and zones ----------

// The leg's path as positions: from, then each via, then to.
export function legPoints(index, branch = 'sheet') {
  const stop = STOPS[index];
  if (!stop) throw new Error(`no stop ${index}`);
  return [stop.from, ...stop.via, stop.to].map((id) => OBJECTS[id].pos);
}

// Length of a leg in light-years, along its path. Both fork branches use the same path, so the same length.
export function legLengthLy(index, branch = 'sheet') {
  const pts = legPoints(index, branch);
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += distanceLy(pts[i - 1], pts[i]);
  return s;
}

export function routeLengthLy() {
  let s = 0;
  for (let i = 0; i < STOPS.length; i++) s += legLengthLy(i);
  return s;
}

// The straight line from the start to Earth.
export function straightLineLy() {
  return distanceLy('start', 'earth');
}

// The authored zones of a leg (the branch's, on the fork stop), copied, with 'fill' resolved so the lengths add up to
// the leg's length, and startLy / endLy added.
export function zonesFor(index, branch = 'sheet') {
  const stop = STOPS[index];
  if (!stop) throw new Error(`no stop ${index}`);
  const src = stop.branches ? stop.branches[branch === 'void' ? 'void' : 'sheet'] : stop.zones;
  const total = legLengthLy(index, branch);
  const fixed = src.reduce((s, zn) => s + (zn.ly === 'fill' ? 0 : zn.ly), 0);
  let at = 0;
  return src.map((zn) => {
    const ly = zn.ly === 'fill' ? total - fixed : zn.ly;
    const out = { ...zn, ly, startLy: at, endLy: at + ly };
    at += ly;
    return out;
  });
}

// Total design screen time of a leg at each zone's notch, seconds.
export function legScreenTime(index, branch = 'sheet') {
  return zonesFor(index, branch).reduce((s, zn) => s + zn.screen, 0);
}

// ---------- the seeded draw ----------

// For each stop and spot: letters A, B and C over the target and 2 decoys. The trap decoy is always drawn; with three
// decoys the other one is picked by the seed. Same seed, same draw.
export function resolve(seed) {
  const out = {};
  for (const { id, entry } of SCANS) {
    const rand = mulberry32(hashSeed(seed, 'draw', id));
    const trap = entry.decoys.find((d) => d.trap) || entry.decoys[0];
    const rest = entry.decoys.filter((d) => d !== trap);
    const other = rest[Math.floor(rand() * rest.length)];
    const ids = [entry.target.id, trap.id, other.id];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    out[id] = { A: ids[0], B: ids[1], C: ids[2] };
  }
  return out;
}

// The candidate record (target or decoy) for an object id within a stop or spot.
export function candidate(entry, id) {
  if (entry.target.id === id) return { ...entry.target, isTarget: true };
  const d = entry.decoys.find((x) => x.id === id);
  return d ? { ...d, isTarget: false } : null;
}
