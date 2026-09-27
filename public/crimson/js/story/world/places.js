// js/story/world/places.js : every named place in Sedona. The ids are frozen by the foundation: the world
// package refines coordinates only, and content refers to places by id. x,z in meters, +x east, -z north.
// yaw faces the way a visitor looks on arrival (0 looks toward +z); r is the arrival radius.
export const WORLD = Object.freeze({ SCALE: 1, HALF: 1000, SEED: 51 }); // SCALE stays 1 (C1)

const P = (x, z, r = 8, yaw = 0) => Object.freeze({ x, z, r, yaw });
export const PLACES = Object.freeze({
  y_roundabout: P(60, 40, 20),
  uptown: P(225, -90, 40), uptown_clock: P(232, -96, 5),
  mask_mayhem: P(200, -60), blush_depot: P(260, -110), rattlesnake_room: P(240, -80), bar_lot: P(250, -60, 12),
  aframe: P(560, -330, 10), creek_bridge: P(470, -300), creek_rail: P(472, -302, 5),
  midgley_deck_s: P(425, -455), midgley_deck_n: P(435, -565), midgley_lot: P(395, -585, 14),
  perch: P(520, -510, 5), wash: P(415, -505, 12), // the cold-open clearing, under the deck (C9)
  slide_rock: P(520, -800, 12),
  fr9_turnoff: P(500, -690, 10), hart_gate: P(730, -720, 8), hart_ranch: P(820, -760, 30), hart_ridge: P(780, -860, 10),
  canyon_fleet: P(-620, 170, 14), gas: P(-470, 150, 12), sunline_plaza: P(-560, 70, 14), motel: P(-300, 150, 12),
  airport_mesa: P(-230, 300, 20), airport_overlook: P(-140, 210, 8),
  coffee_pot: P(-560, -260, 20), airstream: P(-540, -160, 8),
  capitol_butte: P(-350, -400, 40), snoopy_rock: P(420, -40, 30), chapel: P(380, 420, 20),
  boynton: P(-880, -640, 10), arts_village: P(220, 140, 12), schnebly_vista: P(900, 60, 10),
  cathedral: P(-180, 620, 40), cathedral_saddle: P(-120, 580, 6),
  red_rock_crossing: P(-240, 520, 14), wedding: P(-290, 500, 10),
  bell_rock: P(300, 700, 40), bell_cairn: P(230, 690, 5), courthouse: P(460, 760, 40),
  diner: P(150, 930, 12),
});

// Spawn points by mission (rough; the world package refines them, content may ask for more).
export const SPAWNS = Object.freeze({
  f1_hero: P(-612, 176, 3, 1.57), f1_van: P(-600, 170, 3, 1.57), f1_park: P(548, -322, 6),
  f2_jeep: P(262, -118, 3), f2_race_end: P(210, 150, 8),
  f3_bar_door: P(244, -72, 3), f4_van_creek: P(476, -312, 4), f4_redjersey: P(522, -796, 3),
  f5_lot: P(398, -582, 4), f5_trail: P(430, -520, 4),
  p1_airstream_door: P(-536, -156, 2), p3_watch: P(-575, 85, 4), p4_turnout: P(505, -684, 4),
  p5_ridge: P(780, -860, 4), p6_hottub: P(566, -338, 3), p8_pump: P(-466, 146, 3),
  p9_bridge_block: P(430, -510, 6), p10_gate: P(728, -716, 4), p11_yard: P(822, -752, 12), p12_lot: P(395, -585, 6),
  e1_meadow: P(-236, 516, 8), e1_gift_table: P(-282, 504, 3),
});

// Guard patrol loops (P5 on the ridge, P10 at the ranch): lists of points.
const loop = (cx, cz, r, n, a0 = 0) => Object.freeze(Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return Object.freeze({ x: Math.round(cx + Math.sin(a) * r), z: Math.round(cz + Math.cos(a) * r) }); }));
export const PATROLS = Object.freeze({
  p5_ridge: loop(780, -850, 18, 5), p5_climb: Object.freeze([{ x: 800, z: -800 }, { x: 790, z: -830 }, { x: 782, z: -852 }]),
  p10_a: loop(810, -750, 14, 4), p10_b: loop(835, -770, 12, 4, 1), p10_c: loop(820, -735, 10, 4, 2),
  p10_d: loop(845, -745, 9, 4, 0.5), p10_e: loop(800, -775, 11, 4, 1.5), p10_f: loop(826, -790, 8, 4, 2.5),
});

// 51 kazoos on reachable ground, three near each of 17 places (E8: every 17 give a canteen sip).
const KAZOO_SITES = ['uptown', 'mask_mayhem', 'y_roundabout', 'arts_village', 'aframe', 'creek_bridge', 'midgley_lot', 'slide_rock', 'gas', 'motel', 'airport_overlook', 'airstream', 'boynton', 'red_rock_crossing', 'bell_cairn', 'diner', 'schnebly_vista'];
export const KAZOOS = Object.freeze(KAZOO_SITES.flatMap((id, i) => [0, 1, 2].map((k) => {
  const p = PLACES[id], a = (i * 3 + k) * 2.39996, r = 6 + k * 5;
  return Object.freeze({ id: `k${String(i * 3 + k + 1).padStart(2, '0')}`, x: Math.round(p.x + Math.sin(a) * r), z: Math.round(p.z + Math.cos(a) * r) });
})));

// The vortex cairns: save, refill, fast travel, wait; one Legend guards each (E9).
export const CAIRNS = Object.freeze({
  cairn_airport: Object.freeze({ ...PLACES.airport_overlook, legend: 'javelina', act: 1 }),
  cairn_bell: Object.freeze({ ...PLACES.bell_cairn, legend: 'vulture', act: 2 }),
  cairn_cathedral: Object.freeze({ ...PLACES.cathedral_saddle, legend: 'gila', act: 2 }),
  cairn_boynton: Object.freeze({ ...PLACES.boynton, legend: 'tarantula', act: 3 }),
});
export const SAFEHOUSES = Object.freeze(['aframe', 'airstream']);

// Regions for wind, traffic and the map labels: a centre and a radius; regionAt picks the nearest.
export const REGIONS = Object.freeze({
  west: P(-520, 120, 260), airport: P(-200, 260, 160), uptown: P(220, -60, 180), canyon: P(470, -500, 260),
  ranch: P(780, -770, 140), schnebly: P(600, 60, 220), redrock: P(-200, 560, 220), village: P(200, 850, 220), boynton: P(-800, -560, 220),
});

// Interiors sit at y = -300 under an unused corner (C3). Each is an axis-aligned volume.
export const INTERIORS = Object.freeze({
  rattlesnake_room: Object.freeze({ x: -900, y: -300, z: 900, w: 24, d: 16, h: 5, door: 'rattlesnake_room' }),
  airstream: Object.freeze({ x: -870, y: -300, z: 900, w: 9, d: 2.6, h: 2.4, door: 'airstream' }),
});

export const PLACE_IDS = Object.freeze(Object.keys(PLACES));
export const ALL_POINT_IDS = Object.freeze([...PLACE_IDS, ...Object.keys(SPAWNS), ...Object.keys(CAIRNS)]);
// any point id: places, spawns and cairns
export function point(id) { return PLACES[id] || SPAWNS[id] || CAIRNS[id] || null; }
