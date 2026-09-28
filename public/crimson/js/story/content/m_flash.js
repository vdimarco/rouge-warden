// js/story/content/m_flash.js : the flashbacks (F1-F5, memory looks, one narrator each) and the interludes
// under the bridge between them (I1-I5). Design 2.5 with AMENDMENTS E6 (Sunburst Jeep Tours, orange jeeps,
// F2 "The Jeep Tour") and E8 (kazoos).
import { talk, subs, cine, intro, script, enter, exit, drive, go } from './m_prologue.js';

// the Rattlesnake Room sits at y = -300 (world/places.js INTERIORS): x -912..-888, z 892..908, door on +z
const BAR = (x, z) => ({ x: -900 + x, y: -300, z: 900 + z });
// Schnebly Hill Rd, down from the vista (900, 60) past (520, 60) to (170, 170): ten gates
const SCHNEBLY = [[848, 60], [772, 60], [696, 60], [620, 60], [548, 60], [470, 75], [400, 97], [330, 119], [260, 141], [196, 162]].map(([x, z]) => ({ x, z }));

const interlude = (id, cast) => ({ id, chapter: id, title: 'Under the Bridge', cast, budget: 40, steps: [cine(id)] });

/* ---------------- F1 Ten Seats (New Balance, Thursday 2:10 PM) ---------------- */
export const f1 = {
  id: 'f1', chapter: 'f1', title: 'Ten Seats', cast: ['newbalance', 'fifty', 'tanktop', 'shades', 'redjersey', 'civA', 'rattler'], budget: 150,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', kind: 'van', place: 'f1_van', player: true },
    { id: 'clerk', cast: 'civA', pos: { x: -609, z: 180 }, yaw: 3.4 },
    { id: 'twin', kind: 'whitevan', pos: { x: -477.6, z: 148 }, yaw: 0 },
    { id: 'rattler', cast: 'rattler', pos: { x: -479.5, z: 146 }, yaw: 1.4 },
  ],
  steps: [
    intro('f1_intro'),
    talk('f1.seats', 'f1.last', 'f1.whale', 'f1.fuel'),
    enter('van', { cp: true }),
    drive('gas', 'Drive to Red Dirt Gas & Go.', { cp: true }), // step 3 is the drive (handoff.mjs jumps here)
    exit('Stop at the pump and get out.'),
    { type: 'interact', at: 'p8_pump', label: 'FILL UP', hold: 2, objective: 'Fill the tank.' },
    talk('f1.nice', 'f1.twins'),
    enter('van', { objective: 'Get back in the van.' }),
    drive('mask_mayhem', 'Drive through the Y to Mask & Mayhem in Uptown.', { r: 14, cp: true }),
    exit('Park and get out.'),
    go('mask_mayhem', 'Pick up the order.', { r: 4 }),
    talk('f1.box', 'f1.boxNo'),
    enter('van'),
    script('kazooScatter'),
    drive('midgley_deck_s', 'Drive north to Midgley Bridge.', { r: 16, cp: true }),
    script('bridgeDrift', { from: 'midgley_deck_s', to: 'midgley_deck_n', line: 'f1.bridge' }, { objective: 'Cross the bridge.' }),
    drive('f1_park', 'Park in the box at the Creekside A-frame.', { r: 5, park: true, cp: true }),
    exit('Get out.'),
    talk('f1.card'),
  ],
  onPass: { flags: { f1Done: true } },
};
export const i1 = interlude('i1', ['gabe', 'fifty']);

/* ---------------- F2 The Jeep Tour (Red Jersey, Friday 9:30 AM) ---------------- */
export const f2 = {
  id: 'f2', chapter: 'f2', title: 'The Jeep Tour', cast: ['redjersey', 'gabe', 'fifty', 'shades'], budget: 180,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'jeep', kind: 'jeep', place: 'f2_jeep' },
    { id: 'gabe', cast: 'gabe', place: 'blush_depot' },
    { id: 'jeep2', kind: 'jeep', place: 'schnebly_vista', yaw: -1.6 },
    { id: 'suv', kind: 'suv', pos: { x: 150, z: -33 }, yaw: 2.2 },
  ],
  steps: [
    intro('f2_intro'),
    talk('f2.phone'),
    { type: 'photo', subject: 'any', kind: 'any', count: 3, min: 0, objective: 'Press the camera key. Take three photos.' },
    go('blush_depot', 'Walk to the Sunburst Jeep Tours lot.', { r: 6 }),
    talk('f2.welcome', 'f2.card', 'f2.later'),
    script('seat', { who: 'gabe', vehicle: 'jeep', seat: 0 }), // Gabe drives: the hero rides beside him
    enter('jeep', { seat: 1, objective: 'Get in the orange jeep.' }),
    subs('f2.film'),
    script('rideAlong', { vehicle: 'jeep', to: 'schnebly_vista' }, { objective: 'Ride up Schnebly Hill with Gabe.' }),
    { type: 'photo', subject: 'gabe', kind: 'any', min: 30, objective: 'Film the view. Get Gabe in the shot.' },
    exit('Get out at the vista.'),
    talk('f2.race'),
    enter('jeep2', { objective: 'Take the other jeep.' }),
    script('seat', { who: 'gabe', vehicle: 'jeep', seat: 0, at: { x: 885, z: 64.5, yaw: -1.6 } }), // Gabe races in the tour jeep, from the line beside the hero's
    script('suvBelow', { vehicle: 'suv', gate: 7 }),
    { type: 'race', gates: SCHNEBLY, target: 130, void: 7, vehicle: 'jeep2', rival: 'jeep', rubber: true, objective: 'Race Gabe down the hill. Ten gates.', cp: true },
    script('arrive', { vehicle: 'jeep', to: { x: 414, z: 87.5 } }), // Gabe pulls up at gate 7 to film the SUV
    subs('f2.stop'),
    { type: 'photo', subject: 'gabe', kind: 'any', min: 50, objective: 'Film Gabe and the black SUV below.', cp: true },
    talk('f2.sorry'),
  ],
  onPass: { flags: { f2Done: true } },
};
export const i2 = interlude('i2', ['gabe', 'redjersey']);

/* ---------------- F3 Ronin Night Out (Tank Top, Friday 10:40 PM) ---------------- */
export const f3 = {
  id: 'f3', chapter: 'f3', title: 'Ronin Night Out', cast: ['tanktop', 'fifty', 'shades', 'newbalance', 'redjersey', 'rattler', 'gang'], budget: 240,
  fail: { vanWrecked: true, heroDown: true },
  spawns: [
    { id: 'van', kind: 'van', place: 'f1_park', player: true },
    { id: 'rattler', cast: 'rattler', pos: BAR(4, -3), yaw: 3.1 },
  ],
  steps: [
    intro('f3_intro'),
    talk('f3.rules', 'f3.silly', 'f3.great'),
    enter('van'),
    drive('bar_lot', 'Drive to The Rattlesnake Room in Uptown.', { r: 14, cp: true }),
    exit('Park and get out.'),
    go('f3_bar_door', 'Go inside.', { r: 3 }),
    script('room', { id: 'rattlesnake_room', enter: true, look: 'INTERIOR' }),
    cine('f3_shove'),
    { type: 'fight', objective: 'Knock out the three drivers.', cp: true, music: true,
      waves: [[{ foe: 'driver', pos: BAR(-3, 2) }, { foe: 'driver', pos: BAR(2, 3) }, { foe: 'driver', pos: BAR(5, 0) }]] },
    { type: 'fight', objective: 'Grab a pool cue or a bar stool. Stop the next three.', cp: true, music: true,
      pickups: [{ weapon: 'cue', uses: 12, pos: BAR(10.5, -2) }, { weapon: 'stool', uses: 3, pos: BAR(-6, -5.5) }],
      waves: [[{ foe: 'driver', pos: BAR(-6, 4) }, { foe: 'driver', pos: BAR(6, 4) }, { foe: 'guard', weapon: 'bat', pos: BAR(0, -4) }]] },
    { type: 'fight', objective: 'Stop Rattler.', cp: true, music: true, boss: 'rattler', until: 'half',
      waves: [[{ foe: 'rattler', pos: BAR(3, -2) }]] },
    cine('f3_lights'),
    script('room', { id: 'rattlesnake_room', enter: false, look: 'MEMORY_NIGHT' }),
  ],
  onPass: { flags: { f3Done: true, fobSwap: true, gangVan: true } },
};
export const i3 = interlude('i3', ['gabe', 'fifty']);

/* ---------------- F4 The Morning After (Fifty-One, Saturday 8:15 AM) ---------------- */
// the van, nose-down in Oak Creek (SPAWNS.f4_van_creek); rocked out it stands on Creekside Dr west of the
// creek bridge (VO), facing Uptown, and the five wrong things are around it there (VAT: a point beside the
// van, lx to its right, lz ahead of its middle)
const VO = { x: 445.4, z: -281.2, yaw: -0.86 };
const VAT = (lx, lz) => { const c = Math.cos(VO.yaw), s = Math.sin(VO.yaw); return { x: +(VO.x + lx * c + lz * s).toFixed(2), z: +(VO.z - lx * s + lz * c).toFixed(2) }; };
export const f4 = {
  id: 'f4', chapter: 'f4', title: 'The Morning After', cast: ['fifty', 'tanktop', 'shades', 'newbalance', 'redjersey'], budget: 240,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', kind: 'whitevan', place: 'f4_van_creek', player: true },
    { id: 'redjersey', cast: 'redjersey', place: 'f4_redjersey' },
  ],
  steps: [
    intro('f4_intro'),
    talk('f4.head'),
    script('hangover', null, { objective: 'Drink from the canteen.' }),
    go('f4_van_creek', 'Find the van.', { r: 7 }),
    talk('f4.creek'),
    enter('van', { cp: true }),
    script('rockVan', { vehicle: 'van', to: 'creek_bridge', out: VO, rocks: 4 }, { objective: 'Rock the van out. Hit the gas on each forward swing.' }),
    talk('f4.bumper', 'f4.leave'),
    exit('Get out and look around.'),
    { type: 'collect', objective: 'Search the van. Five things are wrong.', cp: true, need: 5,
      items: [
        { id: 'dice', pos: VAT(-1.5, 1.4), label: 'FUZZY DICE', line: 'f4.dice' },
        { id: 'tag', pos: VAT(-1.6, -0.6), label: 'RENTAL TAG', line: 'f4.tag' },
        { id: 'box', pos: VAT(0, -3.6), label: 'STEEL BOX', line: 'f4.box' },
        { id: 'phone', pos: VAT(1.6, 1.0), label: 'BURNER PHONE', line: ['f4.text1', 'f4.text2', 'f4.text3'] },
        { id: 'photo', pos: VAT(1.6, -1.4), label: 'FLASH PHOTO', line: 'f4.flash' },
      ] },
    talk('f4.rj'),
    enter('van'),
    drive('uptown_clock', 'Drive to the Uptown clock.', { r: 14 }),
    exit('Get out.'),
    { type: 'photo', subject: 'uptown_clock', kind: 'place', match: 'uptown_clock', min: 40, objective: 'Match his photo of the Uptown clock.', cp: true },
    talk('f4.rail'),
    enter('van'),
    drive('creek_bridge', 'Drive to the creek bridge.', { r: 14 }),
    exit('Get out.'),
    { type: 'photo', subject: 'creek_rail', kind: 'place', match: 'creek_rail', min: 40, objective: 'Match his photo of the bridge rail.', cp: true },
    enter('van'),
    drive('slide_rock', 'Follow the creek up to Slide Rock.', { r: 30 }), // (Slide Rock is down by the creek, 25 m off the road)
    exit('Get out.'),
    script('actor', { who: 'redjersey', prop: 'flamingo', pose: 'knocked' }),
    go('f4_redjersey', 'Find Red Jersey.', { r: 3 }),
    script('actor', { who: 'redjersey', prop: 'flamingo', on: false, pose: 'idle' }),
    talk('f4.found', 'f4.sunrise', 'f4.theory', 'f4.police', 'f4.first'),
  ],
  onPass: { flags: { f4Done: true, steelBox: true } },
};
export const i4 = interlude('i4', ['gabe', 'fifty']);

/* ---------------- F5 Ronin Night (Shades, Saturday 4:30 PM to Sunday 2:58 AM) ---------------- */
export const f5 = {
  id: 'f5', chapter: 'f5', title: 'Ronin Night', cast: ['shades', 'tanktop', 'fifty', 'newbalance', 'redjersey', 'gabe'], budget: 260,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', kind: 'whitevan', place: 'bar_lot', player: true, look: { noBumper: true } },
    { id: 'rental', kind: 'van', pos: { x: 262, z: -52 }, yaw: 2.4, look: { noMirror: true } },
    { id: 'pickup', kind: 'pickup', pos: { x: 322, z: -166 }, yaw: -0.6 },
    { id: 'suv', kind: 'suv', pos: { x: 140, z: -22 }, yaw: 2.2 },
    { id: 'gabe', cast: 'gabe', place: 'perch' },
  ],
  steps: [
    intro('f5_intro'),
    talk('f5.ours', 'f5.soap'),
    enter('van', { cp: true }),
    subs('f5.lose'),
    { type: 'lose', pursuers: ['pickup', 'suv'], sec: 10, dist: 250, objective: 'Lose them. Break their line of sight, or get 250 m away.', cp: true },
    drive('aframe', 'Drive to the A-frame.', { r: 12 }),
    exit('Get out.'),
    talk('f5.hide'),
    { type: 'interact', at: 'p6_hottub', label: 'HIDE THE BOX', hold: 1.5, objective: 'Hide the steel box under the hot tub cover.' },
    talk('f5.lot'),
    enter('van'),
    drive('f5_lot', 'Drive to the Midgley Bridge lot.', { r: 10, park: true }),
    { type: 'card', kind: 'time', title: 'SUNDAY · 2:40 AM', sub: 'MIDGLEY BRIDGE LOT' },
    { type: 'set', clock: { day: 'sun', time: '2:40' }, look: 'MEMORY_NIGHT' },
    { type: 'stakeout', zone: 'midgley_lot', until: '2:56', r: 30, lapse: 60, objective: 'Watch the bridge. Wait.', cp: true,
      events: [
        { at: '2:48', line: 'f5.figure', look: 'perch' },
        { at: '2:52', line: 'f5.roar', sfx: 'roar', look: 'perch' },
        { at: '2:54', line: 'f5.flash', fx: 'flash', look: 'perch' },
      ] },
    { type: 'photo', subject: 'gabe', kind: 'any', min: 50, store: 'f5Photo', objective: 'Photograph the figure on the Perch.', cp: true },
    talk('f5.shot'),
    exit('Get out. Quietly.'),
    { type: 'stealth', guards: [{ spawn: 'gabe', flashlight: true }], to: 'f5_trail', r: 4, onSpotted: 'fail', cp: true,
      objective: 'Sneak down the Wilson Canyon trail. Stay out of the flashlight.' },
    cine('f5_rest'),
  ],
  onPass: { flags: { f5Done: true } },
};
export const i5 = interlude('i5', ['gabe', 'tanktop', 'fifty', 'shades', 'newbalance', 'redjersey']);

export const MISSIONS = { f1, i1, f2, i2, f3, i3, f4, i4, f5, i5 };
