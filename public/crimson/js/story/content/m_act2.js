// js/story/content/m_act2.js : Act II, Sunday night and Monday. P5 The Long Lens (PLACE, the Bear Call),
// P6 Rattler (DATE), P7 Vortex Monday (Vance asks the crew to watch the road, E3), P8 Plant the Phone.
import { talk, subs, intro, script, enter, exit, drive, go } from './m_prologue.js';

const GANG_VAN = { kind: 'whitevan', player: true, look: { noBumper: true } };
const RANCH = (x, z) => ({ x, z });

/* ---------------- P5 The Long Lens, PLACE (Sunday 6:30 PM to 9:30 PM) ---------------- */
export const p5 = {
  id: 'p5', chapter: 'p5', title: 'The Long Lens', giver: 'gabe', cast: ['gabe', 'shades', 'gang'], budget: 200,
  fail: { heroDown: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'p4_turnout' },
    { id: 'gabe', cast: 'gabe', pos: { x: 509, z: -688 }, yaw: 1.5 },
    { id: 'ranch_van', kind: 'whitevan', pos: RANCH(826, -772), yaw: 1.6 },
    { id: 'ranch_guard', foe: 'guard', patrol: 'p10_a', alert: false, group: 'ranch', flashlight: true, pos: RANCH(800, -748) },
    { id: 'patrol', foe: 'guard', patrol: 'p5_climb', alert: false, group: 'patrol', flashlight: true, pos: RANCH(805, -800) },
  ],
  steps: [
    intro('p5_intro'),
    talk('p5.pipe'),
    { type: 'set', ability: 'bearCall', flags: { bearCall: true } },
    script('hint', { text: 'Bear Call: press {bearcall}. Grunts run. Bosses stagger.', sec: 6 }),
    talk('p5.hike'),
    go('hart_ridge', 'Hike the ridge trail to the top.', { r: 6, mode: 'foot', cp: true }),
    talk('p5.lens', 'p5.list'),
    { type: 'stakeout', zone: 'hart_ridge', until: '21:00', r: 14, lapse: 240, objective: 'Watch the ranch. Wait for dark.' },
    { type: 'set', look: 'NIGHT' },
    { type: 'collect', need: 4, photo: true, cp: true, objective: 'Photograph the bunkhouse door, the van plates, a guard and the generator shed.',
      items: [
        // (the photo points face the ridge: the bunkhouse's north wall and the shed's north end; points inside a
        // building, or on its far side, can never be seen from up here)
        { id: 'door', subject: 'bunkhouse', pos: RANCH(812, -790.2), label: 'BUNKHOUSE DOOR', slot: 'place' },
        { id: 'plates', subject: 'ranch_van', pos: RANCH(826, -772), label: 'VAN PLATES' },
        { id: 'guard', subject: 'ranch_guard', pos: RANCH(800, -748), label: 'A GUARD' },
        { id: 'shed', subject: 'generator', pos: RANCH(790, -743.2), label: 'GENERATOR SHED' },
      ] },
    talk('p5.patrol'),
    { type: 'stealth', guards: [{ spawn: 'patrol', flashlight: true }], onSpotted: 'fight', cp: true,
      objective: 'Hide in the junipers, or take him down from behind.' },
    talk('p5.marks'),
  ],
  onPass: { unlock: ['legend_vulture', 'hunt_canyon'], flags: { routes: true, place: true } },
};

/* ---------------- P6 Rattler, the DATE (Sunday 11:00 PM) ---------------- */
export const p6 = {
  id: 'p6', chapter: 'p6', title: 'Rattler', cast: ['fifty', 'tanktop', 'newbalance', 'redjersey', 'rattler', 'gang', 'vance'], budget: 260,
  fail: { heroDown: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'f1_park' },
    { id: 'pickup', kind: 'pickup', pos: { x: 520, z: -280 }, yaw: 2.6 },
    { id: 'fbi', kind: 'suv_fbi', pos: { x: 470, z: -300 }, yaw: 1.9 },
  ],
  steps: [
    intro('p6_intro'),
    script('campfire', { at: { x: 556, z: -321 } }),
    script('crew', { at: { x: 556, z: -321 }, ids: ['fifty', 'tanktop', 'newbalance', 'redjersey'], r: 2.2, pose: 'talk' }),
    talk('p6.end', 'p6.never', 'p6.ten', 'p6.know', 'p6.post', 'p6.no'),
    script('arrive', { vehicle: 'pickup', to: { x: 548, z: -318 }, lights: true }),
    talk('p6.want'),
    { type: 'defend', protect: { place: 'p6_hottub', hp: 100, label: 'THE HOT TUB' }, cp: true, objective: 'Defend the hot tub. The box is inside.',
      waves: [
        [{ foe: 'driver', place: 'aframe' }, { foe: 'driver', pos: { x: 540, z: -318 } }, { foe: 'driver', pos: { x: 556, z: -340 } }],
        [{ foe: 'driver', pos: { x: 544, z: -312 } }, { foe: 'driver', pos: { x: 566, z: -344 } }, { foe: 'guard', weapon: 'bat', pos: { x: 548, z: -334 } }],
        [{ foe: 'guard', weapon: 'bat', pos: { x: 542, z: -326 } }, { foe: 'guard', flashlight: true, pos: { x: 560, z: -346 } }],
      ] },
    { type: 'fight', boss: 'rattler', music: true, cp: true, objective: 'Stop Rattler.', waves: [[{ foe: 'rattler', pos: { x: 552, z: -318 } }]] },
    talk('p6.ring', 'p6.keepers', 'p6.weepers'),
    script('arrive', { vehicle: 'fbi', to: { x: 540, z: -312 }, show: 'vance' }),
    talk('p6.photos', 'p6.text1', 'p6.text2'),
    { type: 'photo', subject: 'rattler', kind: 'any', min: 40, slot: 'date', cp: true, objective: 'Photograph the texts on his phone.' },
    talk('p6.key', 'p6.bed'),
  ],
  onPass: { flags: { rattlerHeld: true, date: true }, save: true },
};

/* ---------------- P7 Vortex Monday (Monday 6:00 AM) ---------------- */
export const p7 = {
  id: 'p7', chapter: 'p7', title: 'Vortex Monday', cast: ['gabe', 'fifty', 'tanktop', 'shades', 'newbalance', 'redjersey'], budget: 150,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, pos: { x: -228, z: 526 }, yaw: 0.9 },
    { id: 'gabe', cast: 'gabe', pos: { x: -146, z: 602 }, yaw: 3.5 },
  ],
  steps: [
    intro('p7_intro'),
    go('cathedral_saddle', 'Hike up to the Cathedral Rock saddle.', { r: 6, mode: 'foot', cp: true }),
    talk('p7.view', 'p7.best', 'p7.ask', 'p7.bride'),
    go({ x: -228, z: 526 }, 'Head back down to the van.', { r: 8 }),
    enter('van'),
    drive('airport_overlook', 'Drive up to the Airport Mesa overlook.', { r: 10, cp: true }),
    exit('Get out.'),
    talk('p7.photo'),
    { type: 'photo', subject: 'crew', kind: 'timer', min: 0, store: 'p7Group', timeLimit: 40, fail: 'skip', objective: 'Prop the phone. Start the timer. Run into the frame.' },
    talk('p7.call1', 'p7.call2', 'p7.call3', 'p7.road'),
  ],
  onPass: { unlock: ['legend_gila', 'trial_canyon'], flags: { watchRoad: true } },
};

/* ---------------- P8 Plant the Phone (Monday 4:00 PM) ---------------- */
export const p8 = {
  id: 'p8', chapter: 'p8', title: 'Plant the Phone', cast: ['gang', 'redjersey'], budget: 120,
  fail: { vanWrecked: true },
  spawns: [
    { id: 'van', ...GANG_VAN, place: 'motel' },
    { id: 'sunvan', kind: 'whitevan', pos: { x: -470.2, z: 148 }, yaw: 0 },
    { id: 'guard', foe: 'guard', pos: { x: -471.5, z: 152 }, yaw: 0.2, alert: false, group: 'pump' },
  ],
  steps: [
    intro('p8_intro'),
    talk('p8.van'),
    enter('van', { cp: true }),
    drive('p8_pump', 'Park the gang van at the next pump.', { r: 4, park: true }),
    exit('Get out. Crouch.'),
    talk('p8.take'),
    { type: 'interact', at: { x: -471.4, z: 146.2 }, label: 'PLANT THE PHONE', hold: 3, window: 40, watchers: ['guard'], mode: 'foot', cp: true,
      objective: 'Plant the phone in the wheel well. The guard must not see you.' },
    talk('p8.plant'),
    subs('p8.dot', 'p8.call'),
  ],
  onPass: { flags: { tracker: true } },
};

export const MISSIONS = { p5, p6, p7, p8 };
