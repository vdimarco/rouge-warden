// EMBER TIDE — the campaign: three acts, twelve sorties.
//
// A mission is a list of stages flown one after another. Stage types:
//   gates   { n, alt: 'mid' | 'low' | 'mix', spacing, turn, r }   fly through n beacons
//   skim    { secs, below }                                       hold the jet low over the sea
//   kills   { n }                                                 shoot down n enemies
//   evade   { n }                                                 roll a missile off n times
//   counter { n }                                                 land n counter-attacks
//   survive { secs }                                              stay in the air
//   ace     { hp, name }                                          one enemy that takes hp hits
// Any stage may carry: label, limit (seconds, or the sortie fails), set (scene settings that
// change when it begins) and radio (lines spoken when it begins).
// `spares` is how many jets may be lost; `bonus` is the third star.

export const ACTS = [
  { id: 1, name: 'Act I', title: 'Fair Weather', blurb: 'The Halcyon Reach has not seen a shot fired in thirty years. You have been on the roster for six days.' },
  { id: 2, name: 'Act II', title: 'Red Sky', blurb: 'The Ember Fleet is no longer pretending to be lost. The picket line is three jets and a radio tower.' },
  { id: 3, name: 'Act III', title: 'Ember Tide', blurb: 'They come at night now. One carrier, somewhere past the shoals, is feeding all of it.' },
]

const M = 'Marrow'
const P = 'Pip'
const L = 'Lantern'
const C = 'Cinder'

export const MISSIONS = [
  // ───────────────────────────────────────────── ACT I
  {
    id: 'first-light', act: 1, title: 'First Light',
    brief: 'Check ride, callsign Gull. Commander Marrow wants to see you thread the marker gates over Tern Island, then put the jet on the deck and skim the lagoon. Nobody is shooting at you today.',
    tip: 'Steer with the pointer or A/D. Left alone, the jet settles back to cruising height: hold a dive (S, or pointer above the jet) to get low.',
    scene: { timeOfDay: 'day', seed: 7, clouds: 0.35, enemies: 0, weapons: false },
    spares: 2, bonus: { type: 'time', par: 105 },
    stages: [
      { type: 'gates', n: 5, alt: 'mid', label: 'Fly the marker gates', radio: [[M, 'Gull, Marrow. Green rings are your gates. Fly through the middle of each.'], [P, 'Try not to dent it, new kid. I just washed that one.']] },
      { type: 'skim', secs: 6, below: 30, label: 'Skim the water', radio: [[M, 'Now take it down. I want spray off your wake. Stay under thirty.'], [L, 'Dive too hard and you will be swimming home. Ease it.']] },
      { type: 'gates', n: 3, alt: 'low', label: 'Low gates', radio: [[M, 'Last three are on the deck. Hold it low and fly through.']] },
    ],
    debrief: 'Marrow signs your sheet without looking up. "You can fly. Tomorrow we find out if you can shoot."',
  },
  {
    id: 'live-fire', act: 1, title: 'Live Fire',
    brief: 'Three target drones are circling the gunnery range off Saltmarsh Key. They fly like jets but they do not shoot back. Hold one in your sights until the box closes, then let it have it.',
    tip: 'Right mouse fires the cannon. Keep a target ahead to lock on, then M sends a missile.',
    scene: { timeOfDay: 'day', seed: 12, clouds: 0.5, enemies: 2, foeFire: false },
    spares: 2, bonus: { type: 'time', par: 70 },
    stages: [
      { type: 'kills', n: 3, label: 'Down the target drones', radio: [[L, 'Range is hot. Drones are up, weapons free.'], [P, 'Loser buys the coffee. I got all three in forty seconds.']] },
    ],
    debrief: 'Pip buys the coffee. Over the cups, Lantern mentions an odd thing: two contacts on the long-range scope last night, no transponders, gone by dawn.',
  },
  {
    id: 'milk-run', act: 1, title: 'Milk Run',
    brief: 'The lighthouse chain needs its weekly mail and the supply boat is in dry dock. Fly the route: eight drops, alternating high and low. The keeper at the last light goes off shift in ninety seconds.',
    tip: 'Hold left mouse or Shift for thrusters. Low gates want you under the ring, close to the water.',
    scene: { timeOfDay: 'day', seed: 21, clouds: 0.3, enemies: 0, weapons: false },
    spares: 1, bonus: { type: 'time', par: 68 },
    stages: [
      { type: 'gates', n: 8, alt: 'mix', turn: 1.0, limit: 95, label: 'Fly the mail route', radio: [[L, 'Clock is running, Gull. Eight lights, ninety-five seconds.'], [P, 'Glamorous work. Wave at the gulls for me.']] },
    ],
    debrief: 'The last keeper has a message for the Commander. A fishing crew saw black jets with orange tails, low over the outer shoals. Not ours.',
  },
  {
    id: 'trespassers', act: 1, title: 'Trespassers',
    brief: 'Three unmarked jets have crossed the line and are not answering the radio. Marrow has run out of polite ways to ask. Send them home, and watch for missiles: when the two rings round your jet meet, roll.',
    tip: 'Click (tap left mouse) to roll. A roll timed as the rings meet throws a missile off and slows time.',
    scene: { timeOfDay: 'day', seed: 33, clouds: 0.55, enemies: 3, foeFire: true },
    spares: 2, bonus: { type: 'time', par: 150 },
    stages: [
      { type: 'kills', n: 4, label: 'Drive off the intruders', radio: [[M, 'They have been warned twice. Weapons free, Gull.'], [P, 'These are not drones. They turn like they mean it.']] },
      { type: 'evade', n: 1, label: 'Roll a missile off', radio: [[L, 'Launch warning! Watch the rings and roll when they meet.']] },
    ],
    debrief: 'The wreckage carries a painted flame. Marrow goes quiet. "The Ember Fleet. I had hoped they were a story we told cadets."',
  },

  // ───────────────────────────────────────────── ACT II
  {
    id: 'picket-line', act: 2, title: 'Picket Line',
    brief: 'The evacuation ferry leaves Tern Harbour at dusk and needs eighty seconds to clear the breakwater. Four raiders are already inbound. You are the picket line. You do not have to win. You have to still be there.',
    tip: 'Hull heals if you stay untouched for a few seconds. Break away, breathe, come back.',
    scene: { timeOfDay: 'sunset', seed: 41, clouds: 0.5, enemies: 4, foeFire: true },
    spares: 1, bonus: { type: 'kills', n: 4 },
    stages: [
      { type: 'survive', secs: 80, label: 'Hold until the ferry is clear', radio: [[L, 'Ferry is casting off. Eighty seconds, Gull. Keep them looking at you.'], [M, 'Do not be a hero. Be a nuisance.']] },
    ],
    debrief: 'The ferry makes open water with four hundred people aboard. Somebody on the stern is flashing a torch at you. It takes a moment to read: THANK YOU.',
  },
  {
    id: 'needle', act: 2, title: 'Thread the Needle',
    brief: 'The raiders have brought missile boats, in the air. Pip has a theory: a missile you throw off is a missile-length opening. Roll three off, then turn the slow motion into a counter-attack.',
    tip: 'Right after a perfect roll, fire a missile (M) for a triple counter.',
    scene: { timeOfDay: 'sunset', seed: 52, clouds: 0.4, enemies: 3, foeFire: true },
    spares: 2, bonus: { type: 'time', par: 170 },
    stages: [
      { type: 'evade', n: 3, label: 'Roll off three missiles', radio: [[P, 'Let them shoot first. Trust me. Mostly.'], [L, 'Three launches is three chances. Rings meet, you roll.']] },
      { type: 'counter', n: 2, label: 'Land two counter-attacks', radio: [[P, 'Now the fun part. Dodge, then M while the world is slow.']] },
    ],
    debrief: 'Pip is unbearable about being right. Marrow writes "counter" into the squadron manual in her own hand.',
  },
  {
    id: 'dry-tanks', act: 2, title: 'Dry Tanks',
    brief: 'The armoury on Saltmarsh took a hit overnight. You are flying with ninety rounds, two missiles and a loader that jams. Five raiders are over the fuel depot. Make every burst count.',
    tip: 'Short bursts at close range. A locked missile is a sure kill: save them.',
    scene: { timeOfDay: 'sunset', seed: 63, clouds: 0.6, enemies: 3, foeFire: true, ammo: 90, missiles: 2, reload: 9 },
    fixedLoadout: true,
    spares: 1, bonus: { type: 'time', par: 150 },
    stages: [
      { type: 'kills', n: 5, limit: 240, label: 'Clear the depot', radio: [[L, 'Depot crew is in the shelters. Four minutes before the tanks go.'], [M, 'Ninety rounds, Gull. Spend them like your own money.']] },
    ],
    debrief: 'The depot stands. On the way home a new voice comes up on the guard channel, amused: "Nicely flown, little bird. We will meet."',
  },
  {
    id: 'cinder', act: 2, title: 'Cinder',
    brief: 'The voice has a name. Cinder leads the Ember vanguard and has not been shot down in eleven years. Two escorts fly ahead. Cut them away and the ace will come to you.',
    tip: 'The ace shrugs off single missiles. Stay on the tail with the cannon; a counter-attack hits four times as hard.',
    scene: { timeOfDay: 'sunset', seed: 74, clouds: 0.45, enemies: 2, foeFire: true },
    spares: 2, bonus: { type: 'time', par: 210 },
    stages: [
      { type: 'kills', n: 2, label: 'Cut away the escorts', radio: [[C, 'There you are. Show me what the Reach has been hiding.'], [M, 'Ignore the talk. Escorts first.']] },
      { type: 'ace', hp: 70, name: 'CINDER', set: { enemies: 2, aceHp: 70, aceMissile: 6 }, label: 'Shoot down Cinder', radio: [[C, 'My turn.'], [P, 'That one is the ace! Stay on the tail, do not let go!']] },
    ],
    debrief: 'Cinder goes into the sea trailing fire, and a parachute opens. "Keep the sky warm," says the radio. "The tide is coming in behind me."',
  },

  // ───────────────────────────────────────────── ACT III
  {
    id: 'blackout', act: 3, title: 'Blackout Run',
    brief: 'The carrier is past the outer shoals, under the radar horizon. A recon pod needs to go through nine points at night, some on the deck, with a patrol overhead. Two minutes of film.',
    tip: 'Thrusters between gates, ease off for the low ones. The patrol loses you in a hard turn.',
    scene: { timeOfDay: 'night', seed: 81, clouds: 0.5, enemies: 2, foeFire: true },
    spares: 1, bonus: { type: 'time', par: 92 },
    stages: [
      { type: 'gates', n: 9, alt: 'mix', turn: 0.9, limit: 125, label: 'Fly the recon line', radio: [[L, 'Lights out, Gull. Nine points. The film runs two minutes.'], [M, 'You are not there to fight. You are there to come back with pictures.']] },
    ],
    debrief: 'The film shows it: one carrier, the Ember Crown, with a deck full of jets. Marrow pins the print to the wall. "So that is where they all come from."',
  },
  {
    id: 'swarm', act: 3, title: 'Swarm',
    brief: 'They know you saw them. Everything the Crown can launch is coming for the airfield tonight, five at a time. Ten kills breaks the wave. You have two spare jets on the line and a ground crew that will not sleep.',
    tip: 'Do not chase. Let them cross your nose, and use counters to thin them out.',
    scene: { timeOfDay: 'night', seed: 92, clouds: 0.6, enemies: 5, foeFire: true, foeHp: 4 },
    spares: 2, bonus: { type: 'time', par: 250 },
    stages: [
      { type: 'kills', n: 10, label: 'Break the wave', radio: [[L, 'Scope is solid with them. I have stopped counting.'], [P, 'I am up with you on the east side. Race you to five.']] },
    ],
    debrief: 'At dawn the runway is still there. Pip lands on one engine, grinning. "Five and a half. The half is arguable."',
  },
  {
    id: 'counterstrike', act: 3, title: 'Counterstrike',
    brief: 'The Crown\'s guard flight is flying heavy armour: cannon alone will take all night. They lean on their missiles, so use that. Three counters to break their formation, then finish the rest.',
    tip: 'Armoured raiders take seven hits. A counter-attack still ends one outright.',
    scene: { timeOfDay: 'night', seed: 103, clouds: 0.7, enemies: 4, foeFire: true, foeHp: 7 },
    spares: 2, bonus: { type: 'time', par: 270 },
    stages: [
      { type: 'counter', n: 3, label: 'Land three counter-attacks', radio: [[M, 'Their armour is thick and their patience is thin. Make them fire first.']] },
      { type: 'kills', n: 5, label: 'Finish the guard flight', radio: [[P, 'Formation is broken. They are all yours.']] },
    ],
    debrief: 'With the guard flight gone the Crown is alone for the first time. Marrow has the whole squadron fuelled before you have climbed out. All three of you.',
  },
  {
    id: 'ember-crown', act: 3, title: 'Ember Crown',
    brief: 'Dawn. Marrow and Pip are on your wing. Run the shoals fast and low before the carrier can turn into the wind, clear its last fighters, and then deal with what launches last. Cinder has a new jet and a grudge.',
    tip: 'Three parts, two spare jets. Keep one in hand for the end.',
    scene: { timeOfDay: 'sunset', seed: 114, clouds: 0.5, enemies: 0, foeFire: true, wingmen: 2 },
    spares: 2, bonus: { type: 'time', par: 400 },
    stages: [
      { type: 'gates', n: 6, alt: 'mix', turn: 0.7, limit: 100, label: 'Run the shoals', radio: [[M, 'Marrow on your left wing, Gull. Lead us in.'], [P, 'Pip on your right. Still owe me a coffee.']] },
      { type: 'kills', n: 6, set: { enemies: 4 }, respawn: true, label: 'Clear the deck fighters', radio: [[L, 'Crown is launching everything it has left!'], [M, 'Break and engage. Good hunting.']] },
      { type: 'ace', hp: 120, name: 'CINDER', set: { enemies: 3, aceHp: 120, aceMissile: 6 }, label: 'Finish it', radio: [[C, 'Little bird. You kept the sky warm.'], [P, 'It is him! Everything you have got, Gull!']] },
    ],
    debrief: 'The Ember Crown turns for the open sea with nothing left to launch. Behind you the Reach is waking up: thirty islands, every light still on.',
  },
]

// The hangar: five things the ground crew can do to the jet, three steps each.
export const UPGRADES = [
  { id: 'engine', name: 'Engines', hint: 'Faster cruise and harder thrusters', apply: (p, n) => { p.speed += 7 * n; p.boost += 0.1 * n } },
  { id: 'agility', name: 'Control surfaces', hint: 'Tighter turns', apply: (p, n) => { p.agility += 0.15 * n } },
  { id: 'armour', name: 'Armour', hint: '+2 hull per step', apply: (p, n) => { p.hullMax += 2 * n } },
  { id: 'racks', name: 'Missile racks', hint: '+2 missiles per step', apply: (p, n) => { p.missiles += 2 * n } },
  { id: 'loader', name: 'Autoloader', hint: 'Faster reloads, deeper magazine', apply: (p, n) => { p.reload -= n; p.ammo += 60 * n } },
]
export const UPGRADE_MAX = 3
export const UPGRADE_COST = 2 // stars a step

export const LIVERIES = [
  { id: 'stock', name: 'Reach Grey', need: 0, colors: ['#545969', '#f0580e', '#1e8ca0'] },
  { id: 'tide', name: 'Tidewater', need: 8, colors: ['#2f5f8f', '#f4f1e6', '#7fe0d0'] },
  { id: 'dusk', name: 'Red Sky', need: 18, colors: ['#3a2a35', '#ff3b4a', '#ffb347'] },
  { id: 'gull', name: 'Gold Gull', need: 30, colors: ['#e9e4d4', '#e2a21a', '#1b2a4a'] },
]
