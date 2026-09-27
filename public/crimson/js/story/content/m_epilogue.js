// js/story/content/m_epilogue.js : E1 The First (the wedding, the last photo, the credits), and the side
// content of AMENDMENTS E9 as data: 4 Legend fights (one guards each vortex cairn; ink forms of the gang
// body on the gabe and bear tables), 2 jeep time trials (the race step) and 3 photo hunts (the photo step).
// Side missions have no chapter. Chapter missions unlock them (onPass.unlock): one Legend per act, from P1,
// P5, P7 and P9. For free roam: `kind` names the kind of side job and `at` the place its marker stands.
import { talk, intro, script, enter, exit, go } from './m_prologue.js';

/* ---------------- E1 The First (one month later, 6:10 PM) ---------------- */
export const e1 = {
  id: 'e1', chapter: 'e1', title: 'The First', cast: ['christian', 'ryu', 'vance', 'gabe', 'fifty', 'tanktop', 'shades', 'newbalance', 'redjersey'], budget: 90,
  spawns: [
    { id: 'van', kind: 'van', pos: { x: -226, z: 520 }, yaw: 0.6, look: { justMarried: true, tapedWindows: true, noMirror: true } },
  ],
  steps: [
    intro('e1_intro'),
    go('e1_gift_table', 'Walk to the gift table.', { r: 3 }),
    talk('e1.gift'),
    { type: 'cine', id: 'e1_wedding' },
    talk('e1.photo'),
    { type: 'photo', subject: 'crew', kind: 'timer', min: 0, store: 'e1Photo', timeLimit: 40, fail: 'skip', objective: 'Prop the phone. Ten second timer. Run in.' },
    talk('e1.ten', 'e1.know', 'e1.post', 'e1.plan'),
    script('credits'),
  ],
  onPass: { flags: { storyDone: true }, save: true },
};

/* ---------------- the four Legends (E9) ---------------- */
function legend(variant, cairn, name, line) {
  const id = `legend_${variant}`, flag = `legend${variant[0].toUpperCase()}${variant.slice(1)}`;
  return {
    id, kind: 'legend', at: cairn, title: name, cast: ['gang'], budget: 120,
    fail: { heroDown: true },
    steps: [
      go(cairn, 'Walk to the vortex cairn.', { r: 6 }),
      script('cairn', { line }),
      { type: 'fight', legend: true, boss: 'legend', music: true, cp: true, objective: `Beat ${name}.`,
        waves: [[{ foe: 'legend', variant, place: cairn }]] },
      talk('side.legendDone'),
    ],
    onPass: { flags: { [flag]: true }, save: true },
  };
}
export const legend_javelina = legend('javelina', 'cairn_airport', 'THE JAVELINA', 'side.javelina');
export const legend_vulture = legend('vulture', 'cairn_bell', 'THE VULTURE', 'side.vulture');
export const legend_gila = legend('gila', 'cairn_cathedral', 'THE GILA', 'side.gila');
export const legend_tarantula = legend('tarantula', 'cairn_boynton', 'THE TARANTULA', 'side.tarantula');

/* ---------------- two jeep time trials (the race step, E9) ---------------- */
const SCHNEBLY = [[848, 60], [772, 60], [696, 60], [620, 60], [548, 60], [470, 75], [400, 97], [330, 119], [260, 141], [196, 162]].map(([x, z]) => ({ x, z }));
const CANYON = [[436, -610], [458, -650], [492, -684], [506, -720], [514, -760], [520, -800], [532, -850], [546, -900]].map(([x, z]) => ({ x, z }));
export const trial_schnebly = {
  id: 'trial_schnebly', kind: 'trial', at: 'schnebly_vista', title: 'Schnebly Hill Run', cast: [], budget: 180,
  fail: { vanWrecked: true },
  spawns: [{ id: 'jeep', kind: 'jeep', place: 'schnebly_vista', yaw: -1.6 }],
  steps: [
    go('schnebly_vista', 'Walk to the orange jeep at the vista.', { r: 10 }),
    talk('side.trialJeep'),
    enter('jeep', { objective: 'Get in the jeep.' }),
    { type: 'race', gates: SCHNEBLY, target: 120, vehicle: 'jeep', cp: true, objective: 'Ten gates to the bottom. Beat 2:00.' },
    exit('Stop and get out.'),
    talk('side.trialDone'),
  ],
  onPass: { flags: { trialSchnebly: true }, save: true },
};
export const trial_canyon = {
  id: 'trial_canyon', kind: 'trial', at: 'midgley_lot', title: 'Canyon Run', cast: [], budget: 180,
  fail: { vanWrecked: true },
  spawns: [{ id: 'jeep', kind: 'jeep', place: 'midgley_lot' }],
  steps: [
    go('midgley_lot', 'Walk to the orange jeep in the Midgley lot.', { r: 12 }),
    talk('side.trialCanyon'),
    enter('jeep', { objective: 'Get in the jeep.' }),
    { type: 'race', gates: CANYON, target: 75, vehicle: 'jeep', cp: true, objective: 'Eight gates up the canyon. Beat 1:15.' },
    exit('Stop and get out.'),
    talk('side.trialDone'),
  ],
  onPass: { flags: { trialCanyon: true }, save: true },
};

/* ---------------- three photo hunts (the photo step, E9) ---------------- */
function hunt(id, at, line, places, labels) {
  return {
    id, kind: 'hunt', at, title: 'Photo Hunt', cast: [], budget: 150,
    steps: [
      go(at, 'Start the photo hunt.', { r: 14 }),
      talk(line),
      { type: 'collect', need: places.length, photo: true, cp: true, objective: `Photograph ${labels.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
        items: places.map((p, i) => ({ id: p, place: p, subject: p, label: labels[i].toUpperCase() })) },
      talk('side.huntDone'),
    ],
    onPass: { flags: { [id]: true }, save: true },
  };
}
export const hunt_uptown = hunt('hunt_uptown', 'uptown', 'side.huntUptown', ['uptown_clock', 'mask_mayhem', 'rattlesnake_room'], ['the Uptown clock', 'Mask & Mayhem', 'The Rattlesnake Room']);
export const hunt_canyon = hunt('hunt_canyon', 'midgley_lot', 'side.huntCanyon', ['midgley_deck_s', 'perch', 'slide_rock'], ['Midgley Bridge', "Gabe's Perch", 'Slide Rock']);
export const hunt_rocks = hunt('hunt_rocks', 'y_roundabout', 'side.huntRocks', ['snoopy_rock', 'bell_rock', 'cathedral'], ['Snoopy Rock', 'Bell Rock', 'Cathedral Rock']);

export const SIDE = { legend_javelina, legend_vulture, legend_gila, legend_tarantula, trial_schnebly, trial_canyon, hunt_uptown, hunt_canyon, hunt_rocks };
export const MISSIONS = { e1, ...SIDE };
