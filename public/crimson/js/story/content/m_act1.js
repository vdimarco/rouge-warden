// js/story/content/m_act1.js : Act I of the present, Sunday. P1 Dawn Patrol (the truth, the note, the
// staff), P2 Pie and Photos (Agent Vance's rule), P3 Sunline (FACE), P4 Tail the Black SUV (PLACE, half).
// AMENDMENTS E2 (Gabe's motive) and E3 (the crew works with the FBI).
import { talk, subs, cine, intro, script, enter, exit, drive, go } from './m_prologue.js';

// the lookalike gang van the crew drives since the fobs were swapped (F3); it lost its bumper in F4
const GANG_VAN = { kind: 'whitevan', player: true, look: { noBumper: true } };

/* ---------------- P1 Dawn Patrol (Sunday 5:40 AM) ---------------- */
export const p1 = {
  id: 'p1', chapter: 'p1', title: 'Dawn Patrol', giver: 'gabe', cast: ['gabe', 'newbalance', 'fifty', 'shades', 'tanktop'], budget: 150,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'midgley_lot' },
    { id: 'gabe', cast: 'gabe', pos: { x: 399, z: -589 }, yaw: 0.8 },
  ],
  steps: [
    intro('p1_intro'),
    script('sayPick', { lines: ['p1.drive', 'p1.start'], byPick: { newbalance: ['p1.driveNB', 'p1.start'] } }),
    enter('van', { objective: 'Take the wheel.', cp: true }),
    script('seats', { vehicle: 'van', list: [{ seat: 1, who: 'gabe' }, { seat: 2, who: 'newbalance' }, { seat: 3, who: 'fifty' }, { seat: 4, who: 'shades' }, { seat: 5, who: 'tanktop' }, { seat: 6, who: 'redjersey' }] }),
    script('dawnAtY', { at: 'y_roundabout', r: 90, dur: 6 }),
    script('subs', { lines: ['p1.g1', 'p1.g2', 'p1.g3', 'p1.g4', 'p1.g5'], after: 4 }),
    drive('airstream', "Drive to Gabe's Airstream below Coffee Pot Rock.", { r: 12, cp: true }),
    exit('Get out.'),
    script('room', { id: 'airstream', enter: true, look: 'INTERIOR' }),
    script('pinWall', { photo: 'f5Photo' }),
    cine('p1_wall'),
    talk('p1.cut', 'p1.ids', 'p1.note', 'p1.ten'),
    { type: 'choice', title: 'Who speaks first?', options: [
      { label: 'FIFTY-ONE', set: { flags: { p1First: 'fifty' } } },
      { label: 'SHADES', set: { flags: { p1First: 'shades' } } },
    ] },
    script('firstWords', { order: { fifty: ['p1.plan', 'p1.wrong'], shades: ['p1.wrong', 'p1.plan'] } }),
    talk('p1.staff'),
    { type: 'set', weapon: 'staff', flags: { staff: true } },
    talk('p1.bear', 'p1.water'),
    script('room', { id: 'airstream', enter: false, look: 'DAY' }),
  ],
  onPass: { unlock: ['legend_javelina', 'trial_schnebly', 'hunt_uptown'], flags: { actOne: true }, save: true },
};

/* ---------------- P2 Pie and Photos (Sunday 11:00 AM) ---------------- */
export const p2 = {
  id: 'p2', chapter: 'p2', title: 'Pie and Photos', giver: 'vance', cast: ['vance', 'gabe', 'fifty', 'shades'], budget: 90,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, pos: { x: -530, z: -150 }, yaw: 0 },
    { id: 'vance', cast: 'vance', pos: { x: 142, z: 924 }, yaw: 1.57 },
    { id: 'gabe', cast: 'gabe', pos: { x: 142, z: 927 }, yaw: 1.4 },
    { id: 'fbi', kind: 'suv_fbi', pos: { x: 164, z: 944 }, yaw: 0 },
  ],
  steps: [
    intro('p2_intro'),
    enter('van', { cp: true }),
    drive('diner', 'Drive to the Moonrise Diner in the Village.', { r: 14 }),
    exit('Park and get out.'),
    go({ x: 146, z: 925 }, 'Meet Agent Vance at the diner.', { r: 3 }),
    talk('p2.five', 'p2.ronin', 'p2.need', 'p2.how', 'p2.hero', 'p2.arrest'),
    talk('p2.rule1', 'p2.rule2', 'p2.van', 'p2.call'),
  ],
  onPass: { flags: { vanceMet: true } },
};

/* ---------------- P3 Sunline, the FACE (Sunday 2:00 PM) ---------------- */
export const p3 = {
  id: 'p3', chapter: 'p3', title: 'Sunline', cast: ['voss', 'gang', 'redjersey'], budget: 120,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'p3_watch' },
    { id: 'lookout', foe: 'guard', pos: { x: -552, z: 66 }, yaw: 3.3, alert: false, group: 'lookout' },
    { id: 'voss_suv', kind: 'suv', pos: { x: -420, z: 112 }, yaw: -1.7 },
    { id: 'voss', cast: 'voss', pos: { x: -548, z: 62 }, yaw: 3.0 },
  ],
  steps: [
    intro('p3_intro'),
    talk('p3.plan'),
    enter('van', { objective: 'Wait in the van. It is your cover.' }),
    talk('p3.clerk', 'p3.keep'),
    script('arrive', { vehicle: 'voss_suv', to: { x: -540, z: 84 }, show: 'voss' }),
    subs('p3.here'),
    exit('Get out on the far side.'),
    { type: 'stealth', guards: [{ spawn: 'lookout' }], to: { x: -566, z: 84 }, r: 3, onSpotted: 'fail', cp: true,
      objective: "Get a clear angle on his face. Stay out of the lookout's view." },
    { type: 'photo', subject: 'voss', kind: 'face', min: 70, slot: 'face', window: 30, cp: true, objective: 'Photograph his face. You have 30 seconds.' },
    talk('p3.how', 'p3.four', 'p3.cost'),
    talk('p3.got'),
    { type: 'photo', subject: 'voss_suv', kind: 'place', min: 50, slot: 'link', timeLimit: 25, fail: 'skip', objective: 'Optional: zoom in on the Canyon Fleet papers on his dash.' },
  ],
  onPass: { flags: { face: true } },
};

/* ---------------- P4 Tail the Black SUV, PLACE 1/2 (Sunday 2:30 PM) ---------------- */
export const p4 = {
  id: 'p4', chapter: 'p4', title: 'Tail the Black SUV', cast: ['voss'], budget: 150,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'p3_watch' },
    { id: 'voss_suv', kind: 'suv', pos: { x: -540, z: 84 }, yaw: 1.4 },
  ],
  steps: [
    intro('p4_intro'),
    talk('p4.tail'),
    enter('van', { cp: true }),
    { type: 'tail', target: 'voss_suv', to: 'fr9_turnoff', near: 25, far: 140, notice: 18, cp: true, objective: 'Follow the black SUV. Stay 25 to 140 m back.' },
    subs('p4.turn', 'p4.park'),
    drive('p4_turnout', 'Park at the turnout.', { r: 6, park: true }),
    exit('Get out.'),
    go({ x: 700, z: -716 }, 'Walk up FR 9. Keep to the trees.', { r: 12 }),
    { type: 'photo', subject: 'hart_gate', kind: 'place', min: 50, store: 'p4Sign', cp: true, objective: 'Photograph the ranch sign at the gate.' },
    talk('p4.sign'),
  ],
  onPass: { flags: { placeHalf: true } },
};

export const MISSIONS = { p1, p2, p3, p4 };
