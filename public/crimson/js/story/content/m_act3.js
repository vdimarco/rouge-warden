// js/story/content/m_act3.js : Act III, Monday night to Tuesday dawn. P9 The Convoy (E4: any contact with
// the van that carries people above 1 m/s fails; the box-in is a slow follow into Gabe's roadblock), P10
// The Hart Ranch (it happens because the convoy forces it, and Vance's team is minutes out, E3), P11 The
// Scorpion, P12 Ten Seats (six freed people and four friends: ten seats full, E7).
import { talk, subs, cine, intro, script, enter, exit, drive, go } from './m_prologue.js';

// the Whale comes back from the FBI: trash bags taped over the windows, one mirror gone
const WHALE = { kind: 'van', player: true, look: { tapedWindows: true, noMirror: true } };

/* ---------------- P9 The Convoy (Monday 10:30 PM) ---------------- */
export const p9 = {
  id: 'p9', chapter: 'p9', title: 'The Convoy', giver: 'vance', cast: ['vance', 'gabe', 'gang', 'tanktop', 'civA', 'civB'], budget: 300,
  fail: { vanWrecked: true, heroDown: true },
  spawns: [
    { id: 'whale', ...WHALE, place: 'diner' },
    { id: 'vance', cast: 'vance', pos: { x: 142, z: 924 }, yaw: 1.57 },
    { id: 'fbi', kind: 'suv_fbi', pos: { x: 162, z: 940 }, yaw: 0.2 },
    // the convoy leaves Red Rock Plaza for FR 9: Voss's SUV, the white van with four people, a guard pickup
    { id: 'voss_suv', kind: 'suv', pos: { x: -520, z: 110 }, yaw: 1.5 },
    { id: 'van1', kind: 'whitevan', pos: { x: -538, z: 111 }, yaw: 1.5, protect: true, bumpLimit: 3, maxContact: 1 },
    { id: 'pickup', kind: 'pickup', pos: { x: -556, z: 112 }, yaw: 1.5 },
    // Gabe's orange jeep, sideways across Midgley Bridge (from the start: the convoy stops at it)
    { id: 'jeep', kind: 'jeep', place: 'p9_bridge_block', yaw: 4.62 },
    { id: 'gabe', cast: 'gabe', pos: { x: 426, z: -507 }, yaw: 3.0 },
  ],
  steps: [
    intro('p9_intro'),
    talk('p9.whale', 'p9.bags'),
    enter('whale', { objective: 'Get in the Whale.', cp: true }),
    // (the checkpoint is the convoy's start, not the chase: a RETRY sends the convoy off again)
    script('convoy', { vehicles: ['voss_suv', 'van1', 'pickup'], to: 'fr9_turnoff' }, { cp: true }),
    subs('p9.moves'),
    script('rule', { line: 'p9.rule', sec: 10 }),
    subs('p9.careful'),
    { type: 'chase', target: 'pickup', goal: 'disable', hits: 3, pit: true, protect: 'van1', bumpLimit: 3, maxContact: 1,
      objective: 'Stop the guard pickup. Three rams or a PIT.' },
    subs('p9.pickup'),
    // (the checkpoint is the block: a RETRY brings the SUV and the van back up the canyon to it)
    script('bridgeBlock', { jeep: 'jeep', gabe: 'gabe', suv: 'voss_suv', van: 'van1', at: 'p9_bridge_block' }, { cp: true }),
    subs('p9.follow'),
    { type: 'chase', target: 'van1', goal: 'stop', protect: 'van1', maxContact: 1, objective: 'Follow the van in. Slow. Do not touch it.' },
    subs('p9.runs'),
    exit('Get out. Go!'),
    { type: 'chase', target: 'runner', goal: 'takedown', objective: 'Catch the driver.' },
    { type: 'fight', objective: 'Two guards. Knock them out.', cp: true,
      waves: [[{ foe: 'guard', weapon: 'bat', pos: { x: 432, z: -522 } }, { foe: 'guard', pos: { x: 437, z: -526 } }]] },
    cine('p9_door'),
    talk('p9.gabe', 'p9.radio'),
  ],
  onPass: { unlock: ['legend_tarantula', 'hunt_rocks'], flags: { fourSafe: true }, save: true },
};
// the driver of the white van runs when it stops (a foe on foot for the chase step)
p9.spawns.push({ id: 'runner', foe: 'driver', pos: { x: 431, z: -519 }, yaw: 3.1, alert: false, group: 'runner' });

/* ---------------- P10 The Hart Ranch (Tuesday 1:10 AM) ---------------- */
const GUARDS = ['p10_a', 'p10_b', 'p10_c', 'p10_d', 'p10_e', 'p10_f'];
const G_AT = [[800, -734], [836, -760], [818, -725], [846, -739], [796, -767], [826, -784]];
export const p10 = {
  id: 'p10', chapter: 'p10', title: 'The Hart Ranch', cast: ['gang', 'boone'], budget: 300,
  fail: { heroDown: true },
  spawns: GUARDS.map((patrol, i) => ({ id: `g${i + 1}`, foe: 'guard', patrol, flashlight: true, alert: false, group: 'ranch', pos: { x: G_AT[i][0], z: G_AT[i][1] } })),
  steps: [
    intro('p10_intro'),
    talk('p10.suv', 'p10.now', 'p10.go'),
    { type: 'stealth', guards: GUARDS.map((_, i) => ({ spawn: `g${i + 1}`, flashlight: true })), to: { x: 786, z: -737 }, r: 3, onSpotted: 'fight', cp: true,
      objective: 'Reach the generator shed. Stay out of the flashlights.' },
    talk('p10.gen'),
    { type: 'interact', at: { x: 787.5, z: -739 }, label: 'CUT THE POWER', hold: 3, objective: 'Cut the generator.' },
    script('ranchDark'),
    subs('p10.dark'),
    { type: 'stealth', guards: GUARDS.map((_, i) => ({ spawn: `g${i + 1}` })), to: { x: 806, z: -778 }, r: 4, deepInk: true, onSpotted: 'fight', cp: true,
      objective: 'Guards see half as far in the dark. Reach the bunkhouse.' },
    talk('p10.boone'),
    { type: 'fight', boss: 'boone', music: true, cp: true, objective: 'Boone has the keys. Take him down.', waves: [[{ foe: 'boone', pos: { x: 814, z: -774 } }]] },
    talk('p10.keys'),
  ],
  onPass: { flags: { ranchDark: true } },
};
// the rescue: the six people spawn here, after every guard is tied (D4)
const BUNK = { x: 812, z: -781 };
export const p10_rescue = {
  id: 'p10_rescue', chapter: 'p10', title: 'The Bunkhouse', cast: ['tanktop', 'fifty', 'civA', 'civB'], budget: 200,
  fail: { heroDown: true },
  spawns: [
    { id: 'whale', ...WHALE, place: 'p10_gate' },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `c${i + 1}`, cast: i % 2 ? 'civB' : 'civA', pos: { x: BUNK.x - 3 + i * 1.2, z: BUNK.z + 3 + (i % 2) * 0.8 }, yaw: Math.PI })),
    { id: 'voss_suv', kind: 'suv', pos: { x: 690, z: -712 }, yaw: 1.5 },
  ],
  steps: [
    cine('p10_bunk'),
    talk('p10.whale', 'p10.signal'),
    { type: 'escort', followers: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], to: 'p10_gate', cp: true,
      cover: [{ x: 795, z: -768 }, { x: 770, z: -750 }, { x: 748, z: -733 }],
      objective: 'Lead them to the Whale. Wave them on at each cover point.' },
    script('arrive', { vehicle: 'voss_suv', to: 'p11_yard', lights: true }),
    talk('p10.lightsOn'),
  ],
  onPass: { flags: { sixOut: true } },
};

/* ---------------- P11 The Scorpion (Tuesday 2:00 AM) ---------------- */
export const p11 = {
  id: 'p11', chapter: 'p11', title: 'The Scorpion', cast: ['voss', 'fifty', 'tanktop', 'shades'], budget: 240,
  fail: { heroDown: true },
  spawns: [
    { id: 'voss_suv', kind: 'suv', pos: { x: 830, z: -744 }, yaw: -2.4 },
  ],
  steps: [
    intro('p11_intro'),
    script('crew', { at: { x: 812, z: -760 }, ids: ['fifty', 'tanktop', 'shades'], r: 2, from: 0.6, arc: 1.4 }),
    talk('p11.long', 'p11.so', 'p11.contract', 'p11.note'),
    { type: 'fight', boss: 'voss', until: 'finisher', music: true, cp: true, objective: 'Stop Voss.', waves: [[{ foe: 'voss', place: 'p11_yard' }]] },
    cine('p11_finisher'),
    script('tieBoss'),
    script('sayPick', { lines: ['p11.prove', 'p11.photos', 'p11.guard'], byPick: { tanktop: ['p11.prove', 'p11.photos', 'p11.guardNB'] } }),
  ],
  onPass: { flags: { vossHeld: true } },
};

/* ---------------- P12 Ten Seats (Tuesday 5:10 AM) ---------------- */
export const p12 = {
  id: 'p12', chapter: 'p12', title: 'Ten Seats', cast: ['gabe', 'vance', 'fifty', 'tanktop', 'civA'], budget: 260,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'whale', ...WHALE, place: 'p10_gate' },
    { id: 'gpickup', kind: 'pickup', pos: { x: 470, z: -640 }, yaw: 2.6 },
    { id: 'fbi1', kind: 'suv_fbi', pos: { x: 470, z: -712 }, yaw: 0.5 },
    { id: 'fbi2', kind: 'suv_fbi', pos: { x: 486, z: -720 }, yaw: 0.3 },
  ],
  steps: [
    intro('p12_intro'),
    { type: 'set', flags: { tenSeats: true } },
    talk('p12.seats', 'p12.slow'),
    enter('whale', { objective: 'Take the wheel.', cp: true }),
    script('tenSeats', { vehicle: 'whale' }),
    script('fbiBlock', { at: 'fr9_turnoff', pickup: 'gpickup', fbi: ['fbi1', 'fbi2'], line: 'p12.radio' }),
    script('subs', { lines: ['p12.thanks'], after: 25 }),
    { type: 'escort', followers: 'seats', to: 'p12_lot', drive: true, smooth: true, vehicle: 'whale', cp: true,
      objective: 'Drive them to the Midgley lot. Smooth. No sudden moves.' },
    exit('Park and get out.'),
    cine('p12_sunrise'),
  ],
  onPass: { flags: { rescued: true }, save: true },
};

export const MISSIONS = { p9, p10, p10_rescue, p11, p12 };
