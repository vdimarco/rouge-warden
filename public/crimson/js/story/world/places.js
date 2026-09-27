// js/story/world/places.js : every named place in Sedona, and the shared geography the world is built from
// (the creek, the wash, flat pads and the town layout). Pure data and small helpers, no three.js: the
// terrain worker imports this file too. The place ids are frozen by the foundation: the world package
// refines coordinates only, and content refers to places by id. x,z in meters, +x east, -z north.
// yaw faces the way a visitor looks on arrival (0 looks toward +z); r is the arrival radius.
// low: the place is on the ground under a deck (place() ignores the deck above it).
export const WORLD = Object.freeze({ SCALE: 1, HALF: 1000, SEED: 51 }); // SCALE stays 1 (C1)

const P = (x, z, r = 8, yaw = 0, o = null) => Object.freeze({ x, z, r, yaw, ...(o || {}) });
// Uptown's main street as a straight line: up(t, off) is t (0..1) along it from the Y end and off meters to
// the side (+ south-east, - north-west). The storefronts stand 8.4 m out, behind the sidewalks (a wooden one
// stands PORCH m further back, its porch out to 8.4 m).
export const UPTOWN = Object.freeze({ a: [150, -33], b: [318, -160], yaw: Math.atan2(168, -127) });
const UL = Math.hypot(UPTOWN.b[0] - UPTOWN.a[0], UPTOWN.b[1] - UPTOWN.a[1]), UD = [(UPTOWN.b[0] - UPTOWN.a[0]) / UL, (UPTOWN.b[1] - UPTOWN.a[1]) / UL], UN = [-UD[1], UD[0]];
export const up = (t, off) => [Math.round((UPTOWN.a[0] + UD[0] * UL * t + UN[0] * off) * 10) / 10, Math.round((UPTOWN.a[1] + UD[1] * UL * t + UN[1] * off) * 10) / 10];
const UY = UPTOWN.yaw, UO = Math.atan2(UN[0], UN[1]); // along the street; facing south-east, away from it
export const UPTOWN_OUT = UO;
const UP = (t, off, r, yaw, o) => { const [x, z] = up(t, off); return P(x, z, r, yaw, o); };
export const PLACES = Object.freeze({
  y_roundabout: P(60, 40, 20),
  uptown: UP(0.4, 0, 40, UY), uptown_clock: UP(0.36, -7.6, 5, UO),
  mask_mayhem: UP(0.25, -6.6, 6, UO + Math.PI), blush_depot: UP(0.66, 12, 8, UO), rattlesnake_room: UP(0.47, 12, 6, UO), bar_lot: UP(0.585, 22, 12, UO),
  aframe: P(550, -328, 10, 1.88), creek_bridge: P(470, -302, 6, 1.2), creek_rail: P(467, -300, 5, 0.3),
  midgley_deck_s: P(425, -455, 8, Math.PI), midgley_deck_n: P(435, -565), midgley_lot: P(395, -585, 14, 0.8),
  perch: P(470, -535, 5, -1.3), wash: P(415, -505, 12, 1.5, { low: true }), // the cold-open clearing, beside the deck (C9)
  slide_rock: P(522, -804, 12, 1.6),
  fr9_turnoff: P(500, -690, 10, 1.5), hart_gate: P(730, -720, 8, 1.5), hart_ranch: P(815, -762, 30, 1.6), hart_ridge: P(785, -858, 10, 0.2),
  canyon_fleet: P(-620, 172, 14, Math.PI), gas: P(-470, 150, 12, Math.PI), sunline_plaza: P(-560, 76, 14), motel: P(-300, 150, 12, Math.PI),
  airport_mesa: P(-238, 305, 20, -0.8), airport_overlook: P(-140, 210, 8, -0.5),
  coffee_pot: P(-560, -262, 20), airstream: P(-540, -160, 8, Math.PI),
  capitol_butte: P(-350, -400, 40), snoopy_rock: P(420, -40, 30), chapel: P(380, 420, 20),
  boynton: P(-880, -630, 10, Math.PI), arts_village: P(150, 116, 12, 0.5), schnebly_vista: P(890, 60, 10, -1.6),
  cathedral: P(-180, 620, 40), cathedral_saddle: P(-150, 606, 6, 0.3),
  red_rock_crossing: P(-236, 534, 14, 3.6), wedding: P(-290, 550, 10, 3.4),
  bell_rock: P(300, 700, 40), bell_cairn: P(230, 690, 5, 1.6), courthouse: P(460, 760, 40),
  diner: P(150, 930, 12, 1.57),
});

// Spawn points by mission (content may ask for more).
export const SPAWNS = Object.freeze({
  f1_hero: P(-612, 176, 3, 1.57), f1_van: P(-600, 170, 3, 1.57), f1_park: P(547, -326, 6),
  f2_jeep: UP(0.66, 16, 3, UY), f2_race_end: P(210, 150, 8),
  f3_bar_door: UP(0.47, 12.6, 3, UO), f4_van_creek: P(476, -312, 4, 2.4), f4_redjersey: P(522, -800, 3),
  f5_lot: P(398, -582, 4, 0.9), f5_trail: P(452, -520, 4, 2.6, { low: true }),
  p1_airstream_door: P(-536, -156, 2, Math.PI), p3_watch: P(-575, 90, 4, 0.2), p4_turnout: P(505, -684, 4, 1.5),
  p5_ridge: P(785, -858, 4, 0.2), p6_hottub: P(571, -323, 3), p8_pump: P(-466, 146, 3, 1.57),
  p9_bridge_block: P(430, -510, 6, 0.1), p10_gate: P(728, -716, 4, 1.5), p11_yard: P(822, -752, 12, 1.6), p12_lot: P(395, -585, 6, 0.8),
  e1_meadow: P(-244, 538, 8, 3.6), e1_gift_table: P(-282, 556, 3),
});

// Guard patrol loops (P5 on the ridge, P10 at the ranch): lists of points on open ground.
const loop = (cx, cz, r, n, a0 = 0) => Object.freeze(Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return Object.freeze({ x: Math.round(cx + Math.sin(a) * r), z: Math.round(cz + Math.cos(a) * r) }); }));
export const PATROLS = Object.freeze({
  p5_ridge: loop(785, -850, 18, 5), p5_climb: Object.freeze([{ x: 805, z: -800 }, { x: 795, z: -828 }, { x: 787, z: -850 }]),
  p10_a: loop(800, -748, 14, 4), p10_b: loop(836, -772, 12, 4, 1), p10_c: loop(818, -735, 10, 4, 2),
  p10_d: loop(846, -748, 9, 4, 0.5), p10_e: loop(796, -778, 11, 4, 1.5), p10_f: loop(826, -792, 8, 4, 2.5),
});

// 51 kazoos on reachable ground, three near each of 17 places (E8: every 17 give a canteen sip). The
// offsets are hand-checked by qa/crimson/world.mjs: dry, walkable, not inside a building.
const KAZOO_SITES = ['uptown', 'mask_mayhem', 'y_roundabout', 'arts_village', 'aframe', 'creek_bridge', 'midgley_lot', 'slide_rock', 'gas', 'motel', 'airport_overlook', 'airstream', 'boynton', 'red_rock_crossing', 'bell_cairn', 'diner', 'schnebly_vista'];
// (Uptown's are on the sidewalks, placed along the street)
const rel = (id, pts) => pts.map(([x, z]) => [Math.round((x - PLACES[id].x) * 10) / 10, Math.round((z - PLACES[id].z) * 10) / 10]);
const KAZOO_AT = {
  uptown: rel('uptown', [up(0.33, 6.9), up(0.44, -6.9), up(0.55, 6.9)]), mask_mayhem: rel('mask_mayhem', [up(0.2, -6.9), up(0.3, -6.9), up(0.25, 6.9)]), y_roundabout: [[-26, -20], [30, -6], [-8, -30]],
  arts_village: [[-24, 24], [36, -8], [0, -21]], aframe: [[-8, 6], [-4, -12], [-16, -12]], creek_bridge: [[-28, 16], [-40, 22], [34, -18]],
  midgley_lot: [[6, 6], [-8, 10], [12, -8]], slide_rock: [[-16, 2], [-12, 14], [-10, -12]], gas: [[10, 8], [-12, 10], [16, -6]],
  motel: [[-12, 8], [14, 10], [0, -10]], airport_overlook: [[6, 4], [-6, 8], [10, -6]], airstream: [[6, 6], [-8, 4], [10, -8]],
  boynton: [[6, -6], [-8, 6], [4, 10]], red_rock_crossing: [[-10, 6], [12, 8], [4, 16]], bell_cairn: [[-6, 6], [-10, -6], [6, -8]],
  diner: [[-10, 10], [8, 14], [-12, -12]], schnebly_vista: [[-8, 6], [-14, -6], [-4, 12]],
};
export const KAZOOS = Object.freeze(KAZOO_SITES.flatMap((id, i) => [0, 1, 2].map((k) => {
  const p = PLACES[id], [dx, dz] = KAZOO_AT[id][k];
  return Object.freeze({ id: `k${String(i * 3 + k + 1).padStart(2, '0')}`, x: p.x + dx, z: p.z + dz });
})));

// The vortex cairns: save, refill, fast travel, wait; one Legend guards each (E9).
export const CAIRNS = Object.freeze({
  cairn_airport: Object.freeze({ ...PLACES.airport_overlook, legend: 'javelina', act: 1 }),
  cairn_bell: Object.freeze({ ...PLACES.bell_cairn, legend: 'vulture', act: 2 }),
  cairn_cathedral: Object.freeze({ ...PLACES.cathedral_saddle, legend: 'gila', act: 2 }),
  cairn_boynton: Object.freeze({ ...PLACES.boynton, legend: 'tarantula', act: 3 }),
});
export const SAFEHOUSES = Object.freeze(['aframe', 'airstream']);
// the Creekside A-frame (the wild cabin.glb): its centre, and yaw with the front door facing the creek
export const AFRAME = Object.freeze({ x: 568, z: -334, yaw: -1.26 });

// Regions for wind, traffic and the map labels: a centre and a radius; regionAt picks the nearest.
export const REGIONS = Object.freeze({
  west: P(-520, 120, 260), airport: P(-200, 260, 160), uptown: P(220, -60, 180), canyon: P(470, -500, 260),
  ranch: P(780, -770, 140), schnebly: P(600, 60, 220), redrock: P(-200, 560, 220), village: P(200, 850, 220), boynton: P(-800, -560, 220),
});
export const REGION_NAMES = Object.freeze({
  west: 'WEST SEDONA', airport: 'AIRPORT MESA', uptown: 'UPTOWN', canyon: 'OAK CREEK CANYON', ranch: 'FOREST ROAD 9',
  schnebly: 'SCHNEBLY HILL', redrock: 'RED ROCK CROSSING', village: 'VILLAGE OF OAK CREEK', boynton: 'BOYNTON CANYON',
});

// Interiors sit at y = -300 under an unused corner (C3). Each is an axis-aligned volume; door is the place
// outside, doorAt the spot just outside the door and yaw the way you face as you walk out.
export const INTERIORS = Object.freeze({
  rattlesnake_room: Object.freeze({ x: -900, y: -300, z: 900, w: 24, d: 16, h: 5, door: 'rattlesnake_room', doorAt: Object.freeze({ x: up(0.47, 12.2)[0], z: up(0.47, 12.2)[1], yaw: UO + Math.PI }) }),
  airstream: Object.freeze({ x: -870, y: -300, z: 900, w: 9, d: 2.6, h: 2.4, door: 'airstream', doorAt: Object.freeze({ x: -536, z: -155, yaw: Math.PI }) }),
});

/* ------------------------------------------------------------------ geography */
// Oak Creek: its water level falls as it runs south out of the canyon, past Uptown, under SR 179 and out
// past Red Rock Crossing. [x, z, water level, half width]
export const CREEK = Object.freeze([
  [574, -1010, 52, 5], [550, -905, 47, 5], [532, -812, 42.5, 4], [527, -790, 41.6, 3], [533, -700, 37, 5], [546, -600, 33.5, 5.5],
  [541, -522, 30.5, 5.5], [529, -455, 28.6, 6], [508, -385, 27.2, 6], [484, -322, 26.2, 6], [466, -290, 25.6, 6], [436, -242, 25, 6],
  [398, -168, 24.2, 6.5], [362, -84, 23.2, 6.5], [320, 2, 22.1, 6.5], [248, 80, 20.6, 7], [168, 138, 19.2, 7], [96, 222, 17.6, 7],
  [2, 350, 15.4, 7], [-116, 458, 13.2, 7.5], [-238, 510, 11.4, 7.5], [-400, 566, 9.2, 7.5], [-650, 624, 6.2, 7.5], [-1010, 676, 3, 7.5],
].map((a) => Object.freeze(a)));
// Slide Rock: a narrow sandstone chute between two pools. [x, z, radius, depth below the water]
export const POOLS = Object.freeze([Object.freeze([530, -826, 7, 2.2]), Object.freeze([525, -776, 8, 2.4])]);
// Wilson Canyon: the dry wash under Midgley Bridge, running east into Oak Creek. [x, z, floor]
export const WASH = Object.freeze([
  [110, -590, 78], [170, -566, 58], [238, -548, 41], [300, -536, 36], [352, -520, 33], [415, -505, 31], [470, -486, 29.6], [529, -462, 28.4],
].map((a) => Object.freeze(a)));
export const WASH_HW = 13; // half width of the sandy floor

// Flat pads under lots, yards and buildings: radius r fully flat, blending over f. y fixes the height.
export const PADS = Object.freeze([
  { x: -620, z: 178, r: 30, f: 18 }, { x: -470, z: 156, r: 24, f: 16 }, { x: -560, z: 66, r: 32, f: 18 }, { x: -300, z: 156, r: 26, f: 16 },
  { x: -405, z: 76, r: 18, f: 14 }, { x: -700, z: 104, r: 18, f: 14 }, { x: -230, z: 60, r: 18, f: 14 }, { x: -760, z: 175, r: 16, f: 14 },
  { x: 150, z: 930, r: 24, f: 16 }, { x: 120, z: 880, r: 16, f: 12 }, { x: 250, z: 870, r: 16, f: 12 },
  { x: 562, z: -331, r: 24, f: 14 }, { x: -540, z: -160, r: 15, f: 12 }, { x: 395, z: -585, r: 20, f: 12 },
  { x: 815, z: -760, r: 58, f: 30 }, { x: 150, z: 108, r: 20, f: 14 }, { x: -880, z: -630, r: 14, f: 12 }, { x: -40, z: 540, r: 12, f: 12 },
  { x: -256, z: 546, r: 26, f: 16 }, { x: -140, z: 210, r: 12, f: 10 }, { x: 890, z: 60, r: 16, f: 12 }, { x: 230, z: 690, r: 8, f: 10 },
  { x: -250, z: 318, r: 40, f: 12 }, { x: 60, z: 40, r: 26, f: 20 }, { x: -150, z: 606, r: 9, f: 8 },
  { x: up(0.63, 19)[0], z: up(0.63, 19)[1], r: 14, f: 8 }, { x: 785, z: -858, r: 7, f: 8 },
].map((p) => Object.freeze(p)));

/* ------------------------------------------------------------------ the town layout */
// Shop strips on the highways (West Sedona on 89A, the Village of Oak Creek on SR 179): n shops along a straight
// chord from a to b, set back `setback` m to one side (side +1 is the right of a->b); skip lists the stretches (t
// along the chord) left empty. roads.js lays a STRIP_WALK wide sidewalk along the shop fronts (the crowd's lines
// run down its middle) and a parking apron from `apron` m out to the walk, in front of the shops. West Sedona's
// shops stand where they always stood (20 m back); street trees line the walk's kerb edge (gen.worker.js).
export const STRIP_WALK = 3;
// a wooden storefront's porch: its roof, posts and boardwalk reach PORCH m out from the front wall
export const PORCH = 1.8;
const ST = (district, a, b, side, setback, n, skip, apron) => Object.freeze({ district, a: Object.freeze(a), b: Object.freeze(b), side, setback, n, skip: Object.freeze(skip.map((s) => Object.freeze(s))), apron });
export const STRIPS = Object.freeze([
  // West Sedona, north of 89A (gaps for Coffee Pot Dr and Red Rock Plaza's frontage), then south of it (a gap
  // for the motel and its lot)
  ST('west', [-420, 116], [-660, 146], 1, 20, 11, [[0.36, 0.74]], 4),
  ST('west', [-240, 90], [-420, 116], 1, 20, 8, [], 3),
  ST('west', [-180, 76], [-390, 108], -1, 20, 9, [[0.42, 0.78]], 3),
  ST('west', [-680, 146], [-880, 164], -1, 20, 8, [], 0),
  // the Village, both sides of SR 179 (the chords lie on the road; a gap on the west for the diner and its lot)
  ST('village', [225.4, 800], [208, 880], 1, 12, 3, [], 2.5),
  ST('village', [208, 880], [186, 985], 1, 12, 4, [[0.3, 0.72]], 2.5),
  ST('village', [225.4, 800], [208, 880], -1, 12, 3, [], 2.5),
  ST('village', [208, 880], [186, 985], -1, 12, 4, [], 2.5),
]);
export const stripSkip = (st, t) => st.skip.some(([a, b]) => t > a && t < b);

// Every building as a footprint, so the worker keeps trees off them and town.js builds them. Deterministic.
// style: stucco | adobe | wood | block | metal; sign: an atlas key or null.
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const B = (district, x, z, w, d, h, yaw, style, sign = null, extra = null) => Object.freeze({ district, x, z, w, d, h, yaw, style, sign, ...(extra || {}) });
function buildLayout() {
  const R = mulberry(51 * 7919), out = [];
  const GENERIC = ['gallery', 'cafe', 'rockshop', 'outfitter', 'tacos', 'books', 'icecream', 'trading', 'crystals', 'realty', 'pizza', 'bank', 'pharmacy', 'hardware'];
  let g = 0;
  const gen = () => GENERIC[(g++) % GENERIC.length];
  // a row of shops along a street from a to b, set back s meters on one side (side +1 is the road's right); with
  // porch, a wooden storefront stands PORCH m further back, so its porch (town.js) ends at the setback
  function row(district, ax, az, bx, bz, side, setback, n, skip, style, depth = 12, porch = false) {
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, rx = -dz * side, rz = dx * side;
    const yaw = Math.atan2(-rx, -rz); // front faces the road
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; if (skip && skip(t)) continue;
      const w = L / n - 2 - R() * 3, d = depth + R() * 5, h = 4.5 + R() * 3.5;
      const sty = typeof style === 'function' ? style(i) : style, sb = setback + (porch && sty === 'wood' ? PORCH : 0), r1 = (v) => Math.round(v * 10) / 10;
      const at = (s) => [r1(ax + dx * L * t + rx * (s + d / 2)), r1(az + dz * L * t + rz * (s + d / 2))], [x, z] = at(sb);
      // (was: where it stood before it made room for its porch; the flora scatter still keeps clear of it there)
      out.push(B(district, x, z, Math.max(7, w), d, h, yaw, sty, R() < 0.8 ? gen() : null, sb > setback ? { porch: PORCH, was: Object.freeze(at(setback)) } : null));
    }
  }
  // Uptown: two rows of storefronts along the main street, ten slots a side; the named shops take theirs.
  // South-east: the bar (set back behind a patio), its lot, the jeep lot and the Sunburst depot.
  const [ua, ub] = [UPTOWN.a, UPTOWN.b], slot = (i) => (i + 0.5) / 10;
  row('uptown', ua[0], ua[1], ub[0], ub[1], 1, 8.4, 10, (t) => t > 0.4 && t < 0.8, (i) => (i % 3 === 0 ? 'wood' : i % 3 === 1 ? 'adobe' : 'stucco'), 12, true);
  row('uptown', ua[0], ua[1], ub[0], ub[1], -1, 8.4, 10, (t) => Math.abs(t - slot(2)) < 0.01, (i) => (i % 2 ? 'wood' : 'stucco'), 12, true);
  const ub1 = (t, off, w, d, h, yaw, style, sign, extra) => { const [x, z] = up(t, off); out.push(B('uptown', x, z, w, d, h, yaw, style, sign, extra)); };
  ub1(0.25, -(8.4 + PORCH + 5.5), 13, 11, 7.5, UO, 'wood', 'mask', { porch: PORCH, was: Object.freeze(up(0.25, -(8.4 + 5.5))) });
  ub1(0.47, 14 + 6, 16, 12, 6, UO + Math.PI, 'wood', 'rattle', { door: true });
  ub1(0.75, 8.4 + 5, 14, 10, 5.5, UO + Math.PI, 'metal', 'sunburst');
  // West Sedona: the rental lot, the gas station, the plaza, the motel and a strip of shops on 89A
  out.push(B('west', -640, 190, 12, 9, 4.5, Math.PI, 'block', 'fleet'));
  out.push(B('west', -478, 168, 14, 10, 4.5, Math.PI, 'block', 'gas'));
  out.push(B('west', -560, 50, 44, 13, 5.5, 0, 'stucco', null, { plaza: true }));
  out.push(B('west', -548, 50, 11, 13.2, 6, 0, 'stucco', 'sunline'));
  out.push(B('west', -300, 170, 40, 10, 5, Math.PI, 'stucco', 'motel', { motel: true }));
  out.push(B('west', -326, 150, 10, 26, 5, Math.PI / 2, 'stucco'));
  // the strips (STRIPS): gaps for Coffee Pot Dr, the plaza's frontage and lot, the motel and its lot
  const strip = (k, style) => { const st = STRIPS[k]; row(st.district, st.a[0], st.a[1], st.b[0], st.b[1], st.side, st.setback, st.n, st.skip.length ? (t) => stripSkip(st, t) : null, style, 11); };
  strip(0, (i) => (i % 3 ? 'stucco' : 'block'));
  strip(1, (i) => (i % 2 ? 'stucco' : 'adobe'));
  strip(2, (i) => (i % 2 ? 'adobe' : 'stucco'));
  strip(3, (i) => (i % 2 ? 'block' : 'stucco'));
  // the Y and the arts village by the SR 179 bridge
  out.push(B('y', 20, 70, 14, 12, 5, 2.2, 'adobe', gen()));
  out.push(B('y', 112, 58, 12, 12, 5, -0.75, 'adobe', gen()));
  out.push(B('y', 24, 4, 12, 10, 5, 0.8, 'stucco', gen()));
  out.push(B('y', 136, 96, 12, 11, 6, -0.75, 'adobe', 'arts'));
  out.push(B('y', 166, 98, 10, 10, 6, -0.75, 'adobe', gen()));
  out.push(B('y', 112, 128, 10, 9, 5, 2.3, 'adobe', null));
  // the Village of Oak Creek: the diner and a few neighbours
  out.push(B('village', 138, 930, 16, 11, 5, Math.PI / 2, 'metal', 'diner'));
  // shops along SR 179 either side (a gap on the west for the diner and its lot)
  strip(4, (i) => (i % 2 ? 'stucco' : 'adobe'));
  strip(5, 'adobe');
  strip(6, 'block');
  strip(7, (i) => (i % 3 ? 'stucco' : 'block'));
  // the airport on the mesa top
  out.push(B('airport', -262, 320, 18, 10, 5, 0.7, 'block', 'airport'));
  out.push(B('airport', -226, 338, 22, 16, 7, 0.7, 'metal', null));
  // the Hart Ranch (the bunkhouse door is padlocked; the generator shed feeds the floodlights)
  out.push(B('ranch', 832, -748, 14, 10, 5, -Math.PI / 2, 'wood', null, { ranch: 'house' }));
  out.push(B('ranch', 812, -786, 16, 7, 4, 0, 'wood', null, { ranch: 'bunkhouse' }));
  out.push(B('ranch', 790, -740, 5, 4, 3, Math.PI / 2, 'metal', null, { ranch: 'generator' }));
  out.push(B('ranch', 850, -780, 14, 12, 8, -Math.PI / 2, 'wood', null, { ranch: 'barn' }));
  return Object.freeze(out);
}
export const BUILDINGS = buildLayout();

export const PLACE_IDS = Object.freeze(Object.keys(PLACES));
export const ALL_POINT_IDS = Object.freeze([...PLACE_IDS, ...Object.keys(SPAWNS), ...Object.keys(CAIRNS)]);
// any point id: places, spawns and cairns
export function point(id) { return PLACES[id] || SPAWNS[id] || CAIRNS[id] || null; }
