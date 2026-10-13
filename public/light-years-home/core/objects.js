// Light Years Home: the catalogue of every named place on the route home, with real positions and a source for each.
// Positions are heliocentric galactic Cartesian light-years: x toward the Galactic Centre, y toward l = 90°, z toward
// the north galactic pole. Most come from the JSON in the research notes (astro.md), which converted Wikipedia's
// RA, Dec and distance with the Hipparcos rotation matrix. Objects missing there (Bellatrix, Procyon, the Horsehead,
// the Witch Head, M32, M110) use the same method on their Wikipedia infobox values. Planets stand where JPL's
// approximate elements put them on 13 October 2026. Distances ignore the expansion of the universe (under 4 % error).

export const LY_PER_PC = 3.261563777;
export const LY_PER_MPC = 3.261563777e6;
export const KM_PER_LY = 9460730472580.8;
export const KM_PER_AU = 149597870.7;
export const AU_LY = KM_PER_AU / KM_PER_LY;        // 1 AU in light-years, 1.58e-5

// Layers say which scale draws an object: cosmic (Mly), group (kly), galaxy (ly), stars (ly), solar (AU).
export const LAYERS = ['cosmic', 'group', 'galaxy', 'stars', 'solar'];
export const KINDS = ['wall', 'cluster', 'supercluster', 'galaxy', 'nebula', 'star', 'pair', 'cluster-open', 'planet',
  'moon', 'region', 'point'];

const W = 'https://en.wikipedia.org/wiki/';
const mly = (x, y, z) => [x * 1e6, y * 1e6, z * 1e6];
const kly = (x, y, z) => [x * 1e3, y * 1e3, z * 1e3];

// Andromeda's position, used for the point where the route meets the Milky Way: 50,000 ly from the Sun on M31's line.
const M31_POS = kly(-1201.09, 1985.26, -917.41);
const M31_DIST = Math.hypot(...M31_POS);
const ENTRY_LY = 50000;

export const OBJECTS = {
  // ---------- cosmic: galaxy clusters and walls (Mly) ----------
  start: { name: 'Sloan Great Wall', kind: 'wall', pos: mly(386.46, -304.49, 870.59), radiusLy: 685e6, layer: 'cosmic',
    note: '1.000 billion ly out on the line to its richest part, SCl 126, inside the wall\'s depth range',
    source: W + 'Sloan_Great_Wall' },
  laniakea: { name: 'Laniakea Supercluster', kind: 'supercluster', pos: mly(131.18, -158.49, 53.66), radiusLy: 261e6,
    galaxies: 100000, layer: 'cosmic', source: W + 'Laniakea_Supercluster' },
  'local-void': { name: 'Local Void', kind: 'region', pos: mly(50.5, 54.86, 8.26), radiusLy: 71.8e6, layer: 'cosmic',
    source: W + 'Local_Void' },
  coma: { name: 'Coma Cluster', kind: 'cluster', pos: mly(6.08, 9.77, 322.69), radiusLy: 4.7e6, members: 1000, giants: 2,
    gasN: 3e-3, layer: 'cosmic', source: W + 'Coma_Cluster' },
  virgo: { name: 'Virgo Cluster', kind: 'cluster', pos: mly(2.52, -14.17, 51.86), radiusLy: 3.76e6, members: 1500,
    giants: 2, gasN: 3e-3, layer: 'cosmic', source: W + 'Virgo_Cluster' },
  m87: { name: 'M87', kind: 'galaxy', pos: kly(3406.21, -13890.92, 51542.04), radiusLy: 66150, jetLy: 5000,
    layer: 'cosmic', source: W + 'Messier_87' },
  eridanus: { name: 'Eridanus Cluster', kind: 'cluster', pos: mly(-37.83, -23.14, -60.5), radiusLy: 3.26e6, members: 200,
    gasN: 3e-3, layer: 'cosmic', source: W + 'Eridanus_Cluster' },     // radius assumed: 1 Mpc, like Fornax
  fornax: { name: 'Fornax Cluster', kind: 'cluster', pos: mly(-20.12, -30.64, -49.97), radiusLy: 3.26e6, members: 58,
    giants: 1, gasN: 3e-3, layer: 'cosmic', source: W + 'Fornax_Cluster' },
  leo: { name: 'Leo Cluster', kind: 'cluster', pos: mly(-61.62, -88.28, 352.48), radiusLy: 3e6, members: 70, giants: 1,
    layer: 'cosmic', source: W + 'Leo_Cluster' },                       // radius assumed
  shapley: { name: 'Shapley Supercluster', kind: 'supercluster', pos: mly(365.53, -412.71, 348.67), radiusLy: 40.4e6,
    layer: 'cosmic', source: W + 'Shapley_Supercluster' },               // collapsing core radius 12.4 Mpc
  hercules: { name: 'Hercules Cluster', kind: 'cluster', pos: mly(309.02, 190.02, 356.76), radiusLy: 4e6, members: 250,
    layer: 'cosmic', source: W + 'Hercules_Cluster' },                   // radius assumed
  centaurus: { name: 'Centaurus Cluster', kind: 'cluster', pos: mly(85.19, -134.18, 62.81), radiusLy: 4e6, members: 300,
    giants: 1, layer: 'cosmic', source: W + 'Centaurus_Cluster' },       // radius assumed
  hydra: { name: 'Hydra Cluster', kind: 'cluster', pos: mly(-1.18, -170.19, 84.8), radiusLy: 5e6, members: 157, giants: 2,
    layer: 'cosmic', source: W + 'Hydra_Cluster' },                      // spans about 10 Mly
  norma: { name: 'Norma Cluster', kind: 'cluster', pos: mly(180.29, -125.06, -27.45), radiusLy: 4e6, members: 600,
    layer: 'cosmic', source: W + 'Norma_Cluster' },                      // radius assumed

  // ---------- group: the Local Group and nearby galaxies (kly) ----------
  andromeda: { name: 'Andromeda Galaxy', kind: 'galaxy', pos: M31_POS, radiusLy: 75950, inclDeg: 77, stars: 1e12,
    layer: 'group', source: W + 'Andromeda_Galaxy' },
  triangulum: { name: 'Triangulum Galaxy', kind: 'galaxy', pos: kly(-1696.66, 1781.26, -1497.54), radiusLy: 30550,
    inclDeg: 55, layer: 'group', source: W + 'Triangulum_Galaxy' },
  m32: { name: 'M32', kind: 'galaxy', pos: [-1194436.56, 1976144.48, -931812.36], radiusLy: 4000, layer: 'group',
    source: W + 'Messier_32' },
  m110: { name: 'M110', kind: 'galaxy', pos: [-1281559.52, 2156997.31, -970086.5], radiusLy: 8525, layer: 'group',
    source: W + 'Messier_110' },
  m81: { name: "Bode's Galaxy", kind: 'galaxy', pos: kly(-7148.18, 5566.35, 7847.89), radiusLy: 48000, layer: 'group',
    source: W + 'Messier_81' },
  'cen-a': { name: 'Centaurus A', kind: 'galaxy', pos: kly(7437.62, -9017.46, 4120.31), radiusLy: 61550, layer: 'group',
    source: W + 'Centaurus_A' },
  ngc6822: { name: "Barnard's Galaxy", kind: 'galaxy', pos: kly(1398.54, 662.27, -514.73), radiusLy: 4600, layer: 'group',
    source: W + 'NGC_6822' },
  lmc: { name: 'Large Magellanic Cloud', kind: 'galaxy', pos: kly(24.86, -134.58, -88.5), radiusLy: 16100, layer: 'group',
    source: W + 'Large_Magellanic_Cloud' },
  smc: { name: 'Small Magellanic Cloud', kind: 'galaxy', pos: kly(78.95, -122.52, -142.23), radiusLy: 9450, layer: 'group',
    source: W + 'Small_Magellanic_Cloud' },
  'sgr-dwarf': { name: 'Sagittarius Dwarf', kind: 'galaxy', pos: kly(77.57, 7.56, -19.67), radiusLy: 5250, layer: 'group',
    source: W + 'Sagittarius_Dwarf_Spheroidal_Galaxy' },
  'milky-way': { name: 'Milky Way', kind: 'galaxy', pos: [26995.9, -26.3, -21.8], radiusLy: 43700, barHalfLy: 16300,
    layer: 'group', source: W + 'Milky_Way' },
  'mw-entry': { name: 'Edge of the Milky Way', kind: 'point', pos: M31_POS.map((v) => (v / M31_DIST) * ENTRY_LY),
    layer: 'group', note: '50,000 ly from the Sun on the line to Andromeda', source: W + 'Milky_Way' },
  'local-group': { name: 'Local Group', kind: 'region', pos: [-587047, 992617, -458716], radiusLy: 3.26e6, layer: 'group',
    note: 'midway between the Galactic Centre and Andromeda; members within 1 Mpc', source: W + 'Local_Group' },

  // ---------- galaxy: the Milky Way's own structure (ly) ----------
  'galactic-centre': { name: 'Galactic Centre', kind: 'region', pos: [26995.9, -26.3, -21.8], radiusLy: 5000,
    blackHoleSuns: 4.297e6, layer: 'galaxy', source: W + 'Galactic_Center' },
  'orion-arm': { name: 'Orion Arm', kind: 'region', pos: [-1245, 0, 0], radiusLy: 10000, widthLy: 3500, layer: 'galaxy',
    note: 'centre line nearest the Sun, from Reid et al. 2019', source: W + 'Orion_Arm' },

  // ---------- stars and nebulae (ly) ----------
  carina: { name: 'Carina Nebula', kind: 'nebula', pos: [2582.83, -8097.24, -116.73], radiusLy: 150, layer: 'stars',
    source: W + 'Carina_Nebula' },
  'eta-carinae': { name: 'Eta Carinae', kind: 'star', pos: [2267.25, -7148.62, -82.41], T: 20000, absMag: -7.61,
    radiusSun: 240, layer: 'stars', source: W + 'Eta_Carinae' },
  'orions-belt': { name: "Orion's Belt", kind: 'region', pos: [-1082.21, -509.53, -371.23], radiusLy: 31,
    members: ['alnitak', 'alnilam', 'mintaka'], layer: 'stars', source: W + 'Orion%27s_Belt' },
  alnitak: { name: 'Alnitak', kind: 'star', pos: [-1083.06, -538.87, -360.29], T: 29500, absMag: -6.0, radiusSun: 20,
    layer: 'stars', source: W + 'Alnitak' },
  alnilam: { name: 'Alnilam', kind: 'star', pos: [-1082.21, -509.53, -371.23], T: 25000, absMag: -6.89, radiusSun: 33.6,
    layer: 'stars', source: W + 'Alnilam' },
  mintaka: { name: 'Mintaka', kind: 'star', pos: [-1085.29, -479.94, -379.62], T: 31400, absMag: -5.8, radiusSun: 13.1,
    layer: 'stars', source: W + 'Mintaka' },
  'orion-nebula': { name: 'Orion Nebula', kind: 'nebula', pos: [-1046.69, -580.41, -421.05], radiusLy: 12, glow: 'emission',
    layer: 'stars', source: W + 'Orion_Nebula' },
  horsehead: { name: 'Horsehead Nebula', kind: 'nebula', pos: [-1173.45, -596.77, -396.85], radiusLy: 3.5, glow: 'dark',
    layer: 'stars', source: W + 'Horsehead_Nebula' },
  'witch-head': { name: 'Witch Head Nebula', kind: 'nebula', pos: [-706.23, -366.03, -421.02], radiusLy: 25,
    glow: 'reflection', layer: 'stars', source: W + 'IC_2118' },        // 3° × 1° at 900 ly; radius rounded
  rigel: { name: 'Rigel', kind: 'star', pos: [-669.27, -374.67, -361.67], T: 12100, absMag: -7.84, radiusSun: 74.1,
    layer: 'stars', source: W + 'Rigel' },
  betelgeuse: { name: 'Betelgeuse', kind: 'star', pos: [-509.35, -183.25, -85.34], T: 3779, absMag: -5.85, radiusSun: 700,
    layer: 'stars', source: W + 'Betelgeuse' },
  bellatrix: { name: 'Bellatrix', kind: 'star', pos: [-232.2, -70.67, -69.38], T: 22017, absMag: -2.78, radiusSun: 6.2,
    layer: 'stars', source: W + 'Bellatrix' },
  pleiades: { name: 'Pleiades', kind: 'cluster-open', pos: [-395.96, 95.37, -177.36], radiusLy: 20.34, members: 1000,
    ageMyr: 125, layer: 'stars', source: W + 'Pleiades' },
  alcyone: { name: 'Alcyone', kind: 'star', pos: [-395.95, 93.83, -176.56], T: 12258, absMag: -2.62, radiusSun: 10.56,
    group: 'pleiades', layer: 'stars', source: W + 'Alcyone_(star)' },
  atlas: { name: 'Atlas', kind: 'star', pos: [-397.76, 91.73, -175.24], T: 12525, absMag: -1.82, radiusSun: 7.81,
    group: 'pleiades', layer: 'stars', source: W + 'Atlas_(star)' },
  electra: { name: 'Electra', kind: 'star', pos: [-394.33, 97, -179.52], T: 13484, absMag: -1.77, radiusSun: 6.06,
    group: 'pleiades', layer: 'stars', source: W + 'Electra_(star)' },
  maia: { name: 'Maia', kind: 'star', pos: [-395.33, 97.32, -177.15], T: 12550, absMag: -1.54, radiusSun: 6.61,
    group: 'pleiades', layer: 'stars', source: W + 'Maia_(star)' },
  merope: { name: 'Merope', kind: 'star', pos: [-395.29, 94.39, -178.81], T: 14550, absMag: -1.29, radiusSun: 4.79,
    group: 'pleiades', layer: 'stars', source: W + 'Merope_(star)' },
  taygeta: { name: 'Taygeta', kind: 'star', pos: [-394.95, 98.59, -177.29], T: 13696, absMag: -1.37, radiusSun: 4.36,
    group: 'pleiades', layer: 'stars', source: W + 'Taygeta' },
  pleione: { name: 'Pleione', kind: 'star', pos: [-397.66, 92.12, -174.69], T: 11058, absMag: -0.35, radiusSun: 4.17,
    group: 'pleiades', layer: 'stars', source: W + 'Pleione_(star)' },
  hyades: { name: 'Hyades', kind: 'cluster-open', pos: [-141.53, -0.2, -58.12], radiusLy: 33, coreLy: 8.8, members: 300,
    ageMyr: 625, layer: 'stars', source: W + 'Hyades_(star_cluster)' },
  beehive: { name: 'Beehive Cluster', kind: 'cluster-open', pos: [-463.61, -221.8, 328.59], radiusLy: 11.4, members: 1000,
    ageMyr: 650, layer: 'stars', source: W + 'Beehive_Cluster' },
  antares: { name: 'Antares', kind: 'pair', pos: [529.44, -74.91, 143.92], T: 3660, absMag: -5.28, radiusSun: 680,
    companion: { T: 18200, radiusSun: 4.8, sepAu: 529 }, layer: 'stars', source: W + 'Antares' },
  spica: { name: 'Spica', kind: 'pair', pos: [113.65, -109.32, 193.65], T: 25300, absMag: -3.55, radiusSun: 7.47,
    companion: { T: 20900, radiusSun: 3.74, sepAu: 0.13 }, layer: 'stars', source: W + 'Spica' },
  arcturus: { name: 'Arcturus', kind: 'star', pos: [12.64, 3.4, 34.3], T: 4286, absMag: -0.3, radiusSun: 25.4,
    layer: 'stars', source: W + 'Arcturus' },
  aldebaran: { name: 'Aldebaran', kind: 'star', pos: [-62.52, -1.06, -23.06], T: 3900, absMag: -0.64, radiusSun: 45.1,
    layer: 'stars', source: W + 'Aldebaran' },
  capella: { name: 'Capella', kind: 'pair', pos: [-40.82, 12.8, 3.42], T: 4970, absMag: -0.52, radiusSun: 11.98,
    companion: { T: 5730, radiusSun: 8.83, sepAu: 0.74 }, layer: 'stars', source: W + 'Capella' },
  sirius: { name: 'Sirius', kind: 'pair', pos: [-5.78, -6.24, -1.33], T: 9845, absMag: 1.43, radiusSun: 1.7144,
    companion: { T: 25000, radiusSun: 0.008098, sepAu: 19.8 }, layer: 'stars', source: W + 'Sirius' },
  procyon: { name: 'Procyon', kind: 'pair', pos: [-9.29, -6.2, 2.58], T: 6582, absMag: 2.66, radiusSun: 2.043,
    companion: { T: 7740, radiusSun: 0.01234, sepAu: 15 }, layer: 'stars', source: W + 'Procyon' },
  vega: { name: 'Vega', kind: 'star', pos: [9.07, 21.84, 8.25], T: 9600, absMag: 0.58, radiusSun: 2.726, layer: 'stars',
    source: W + 'Vega' },
  'alpha-centauri': { name: 'Alpha Centauri', kind: 'pair', pos: [3.11, -3.03, -0.05], T: 5748, absMag: 4.38,
    radiusSun: 1.223, companion: { T: 5154, radiusSun: 0.864, sepAu: 23.4 }, layer: 'stars', source: W + 'Alpha_Centauri' },
  proxima: { name: 'Proxima Centauri', kind: 'star', pos: [2.94, -3.06, -0.14], T: 2992, absMag: 15.6, radiusSun: 0.1542,
    layer: 'stars', source: W + 'Proxima_Centauri' },
  'barnards-star': { name: "Barnard's Star", kind: 'star', pos: [4.96, 2.98, 1.45], T: 3195, absMag: 13.21,
    radiusSun: 0.187, layer: 'stars', source: W + 'Barnard%27s_Star' },
  polaris: { name: 'Polaris', kind: 'star', pos: [-219.35, 334.17, 198.96], T: 6015, absMag: -3.6, radiusSun: 46.27,
    layer: 'stars', source: W + 'Polaris' },
  deneb: { name: 'Deneb', kind: 'star', pos: [260.34, 2601.19, 91.18], T: 8525, absMag: -8.38, radiusSun: 203,
    layer: 'stars', source: W + 'Deneb' },
  canopus: { name: 'Canopus', kind: 'star', pos: [-42.7, -276.24, -132.08], T: 7400, absMag: -5.71, radiusSun: 71,
    layer: 'stars', source: W + 'Canopus' },
  sun: { name: 'Sun', kind: 'star', pos: [0, 0, 0], T: 5772, absMag: 4.83, radiusSun: 1, radiusKm: 695700,
    layer: 'stars', source: W + 'Sun' },

  // ---------- solar: the Solar System on 13 October 2026 (positions in ly; 1 AU = 1.58e-5 ly) ----------
  // Planets from JPL's approximate Keplerian elements (ssd.jpl.nasa.gov/planets/approx_pos.html), ecliptic J2000
  // turned to galactic. The Moon from a short lunar series. The Kuiper belt point is 40 AU out in the ecliptic at
  // longitude 305°: within 75° of both Earth's direction and Alpha Centauri's, so the ship never crosses the Solar
  // System to get there and the last leg falls inward past each planet's orbit.
  kuiper: { name: 'Kuiper belt', kind: 'point', pos: [4.95004517e-4, 2.36762538e-4, -3.14596016e-4], rAu: 40,
    layer: 'solar', source: W + 'Kuiper_belt' },
  mercury: { name: 'Mercury', kind: 'planet', pos: [5.430608e-6, 1.809953e-6, -3.709198e-6], aAu: 0.3871,
    radiusKm: 2439.4, color: '#9a9a96', layer: 'solar', source: W + 'Mercury_(planet)' },
  venus: { name: 'Venus', kind: 'planet', pos: [-3.187344e-6, 4.690516e-6, -9.974607e-6], aAu: 0.7233, radiusKm: 6051.8,
    color: '#e8dcb8', moons: 0, layer: 'solar', source: W + 'Venus' },
  earth: { name: 'Earth', kind: 'planet', pos: [-6.124688e-6, 6.741636e-6, -1.288237e-5], aAu: 1, radiusKm: 6371,
    color: '#2f6fd6', moons: 1, layer: 'solar', source: W + 'Earth' },
  moon: { name: 'Moon', kind: 'moon', pos: [-6.089036e-6, 6.729993e-6, -1.28628e-5], radiusKm: 1737.4, color: '#a9a8a4',
    parent: 'earth', layer: 'solar', source: W + 'Moon' },
  mars: { name: 'Mars', kind: 'planet', pos: [-2.472621e-5, -2.614902e-6, 8.169369e-7], aAu: 1.5237, radiusKm: 3389.5,
    color: '#c1440e', moons: 2, layer: 'solar', source: W + 'Mars' },
  jupiter: { name: 'Jupiter', kind: 'planet', pos: [-5.885459e-5, -3.387457e-5, 4.934772e-5], aAu: 5.2038,
    radiusKm: 69886, color: '#d8b58a', layer: 'solar', source: W + 'Jupiter' },
  saturn: { name: 'Saturn', kind: 'planet', pos: [-3.643177e-5, 6.349866e-5, -1.29923e-4], aAu: 9.5826, radiusKm: 58232,
    color: '#e3cf9c', layer: 'solar', source: W + 'Saturn' },
  uranus: { name: 'Uranus', kind: 'planet', pos: [-2.792457e-4, 3.838236e-5, -1.223859e-4], aAu: 19.1913,
    radiusKm: 25362, color: '#b5e0e4', layer: 'solar', source: W + 'Uranus' },
  neptune: { name: 'Neptune', kind: 'planet', pos: [-4.702993e-5, 2.208495e-4, -4.14978e-4], aAu: 30.07, radiusKm: 24622,
    color: '#7fa7d8', moons: 16, layer: 'solar', source: W + 'Neptune' },
};

// Ecliptic north pole and the vernal equinox as galactic unit vectors (J2000), for Solar System geometry.
export const ECLIPTIC_POLE = [-0.09647682, 0.86228585, 0.49714719];

// ---------- helpers ----------

// Position of an object id, an object, or a raw [x, y, z].
export function posOf(a) {
  if (Array.isArray(a)) return a;
  if (typeof a === 'string') {
    const o = OBJECTS[a];
    if (!o) throw new Error(`unknown object ${a}`);
    return o.pos;
  }
  return a.pos;
}

// Straight-line distance in light-years between two objects, ids or positions.
export function distanceLy(a, b) {
  const p = posOf(a), q = posOf(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// Unit vector from a to b.
export function directionTo(a, b) {
  const p = posOf(a), q = posOf(b);
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const n = Math.hypot(...d) || 1;
  return d.map((v) => v / n);
}

// Angle in degrees between b and c as seen from a.
export function angleBetween(a, b, c) {
  const u = directionTo(a, b), v = directionTo(a, c);
  const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

// Apparent visual magnitude of a star seen from a point (no dust): m = M + 5 log10(d / 10 pc).
export function apparentMag(id, from) {
  const o = OBJECTS[id];
  if (!o || !Number.isFinite(o.absMag)) return null;
  const dPc = Math.max(distanceLy(from, o) / LY_PER_PC, 1e-9);
  return o.absMag + 5 * Math.log10(dPc / 10);
}
