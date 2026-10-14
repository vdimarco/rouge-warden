// Light Years Home v3: every Chapter 1 line (final.md 12, scan lines from 10.1). A line is { id, speaker, text, pri }
// with pri 1 (mission and people), 2 (Dot), 3 (Redshift); log: true sends it straight to the log's Story card.
// Lines are 2 to 8 words and 44 characters at most (text.test). The trigger lives with the mission, scan, zone or
// jump that plays it; OPENING and REACTIONS below hold the ones that belong to no single thing. {n} and {short}
// are filled in by talk.js. SHINY THINGS was cut (decisions.md 4), and its four lines with it.

const PRI = { DOT: 2, REDSHIFT: 3 };
const L = (id, speaker, text, extra = null) => ({ id, speaker, text, pri: PRI[speaker] || 1, ...(extra || {}) });

const LIST = [
  // ---------------------------------------------------------------- the opening (12.1)
  L('kit.moon', 'KIT', "Moon and back. Don't be long."),
  L('dot.awake', 'DOT', "You're awake. Keep driving. It helps."),
  L('dot.notmoon', 'DOT', "That wasn't the Moon."),
  L('dot.billion', 'DOT', "We're a billion light-years out."),
  L('dot.units', 'DOT', 'I think I mixed up the units.'),
  L('dot.backintime', 'DOT', 'The fold threw us back in time too.'),
  L('dot.samedist', 'DOT', 'A billion years. Same as the distance.', { log: true }),
  L('dot.drivehome', 'DOT', 'So: drive home at light speed.', { log: true }),
  L('dot.landwhen', 'DOT', 'We land the moment we left.', { log: true }),
  L('dot.kitnever', 'DOT', 'Kit never knows. Deal?', { log: true }),

  // ---------------------------------------------------------------- the Wall: WHICH WAY HOME, FIRST SHOUT (12.2)
  L('magpie.chart', 'MAGPIE', 'Ooh, shiny star chart. Mine!'),
  L('dot.oldersky', 'DOT', "Got it. But it's 2026's sky."),
  L('dot.whichway', 'DOT', 'First: which way is home?'),
  L('dot.leo', 'DOT', 'Leo. One giant. Not it.'),
  L('dot.hercules', 'DOT', 'Hercules. All spirals. Not it.'),
  L('dot.coma', 'DOT', "Two giants downtown. That's Coma."),
  L('dot.coma-first', 'DOT', 'Two giants. Check the others.'),
  L('dot.checked', 'DOT', 'Light-years. Checked twice.'),
  L('red.woke', 'REDSHIFT', 'Light Years FM. Somebody just woke up.'),
  L('red.request', 'REDSHIFT', "Request line's open. Make it loud."),
  L('red.already', 'REDSHIFT', 'Already did it? Do it louder.'),
  L('red.drift', 'REDSHIFT', 'That drift. Again, slower. Kidding.'),
  L('red.chain', 'REDSHIFT', "Chain of {n}. Somebody's awake."),

  // ---------------------------------------------------------------- the Wall: scans and the secret (10.1, 12.3)
  L('dot.galaxy', 'DOT', 'Each of those is a galaxy.'),
  L('dot.filament', 'DOT', "We're on a filament. Galaxies ride it."),
  L('dot.void', 'DOT', 'A void. Nothing to hit out here.'),
  L('dot.node0', 'DOT', 'No name. Just a number.'),
  L('dot.overlook', 'DOT', 'From high enough: the whole wall.'),
  L('dot.lh.wall', 'DOT', "Earth's light here: two billion years old."),

  // ---------------------------------------------------------------- J1 (11.3, 12.3)
  L('dot.clockruns', 'DOT', "Earth's clock runs. We land when we left."),
  L('dot.snowball', 'DOT', 'Snowball Earth. Wrap up.', { log: true }),
  L('dot.legs', 'DOT', 'Something has legs!'),

  // ---------------------------------------------------------------- Coma City: people (12.2)
  L('ferro.tug', 'FERRO', "Tug's dead. Gravity isn't. Hook on."),
  L('dot.lotoftug', 'DOT', "That's a lot of tug."),
  L('ferro.swing', 'FERRO', "Swing it. Don't drag it."),
  L('magpie.tug', 'MAGPIE', 'Shiny tug!'),
  L('ferro.noted', 'FERRO', 'Noted, Tern.'),
  L('ferro.virgo', 'FERRO', 'Virgo. Big galaxy, straight ray. Follow it.'),
  L('ferro.glass2', 'FERRO', 'Glass for the dome. Downtown.'),
  L('ferro.glass', 'FERRO', "Glass. Don't bounce it."),
  L('dot.toofast', 'DOT', 'These galaxies move too fast. Odd.'),
  L('vela.newintown', 'VELA', 'New in town? Race you round.'),
  L('vela.keepup', 'VELA', 'Keep up, bird.'),
  L('vela.offtail', 'VELA', 'Get off my tail.'),
  L('vela.likethat', 'VELA', "Oh, it's like that."),
  L('vela.rude', 'VELA', 'Hey! Rude.'),
  L('vela.tooslow', 'VELA', 'Too slow. Again?'),
  L('vela.lucky', 'VELA', 'Hm. Lucky line.'),
  L('vela.twoseconds', 'VELA', "I'll give you two seconds."),
  L('vela.tip-coma', 'VELA', "Ride with one downtown. You'll see."),

  // ---------------------------------------------------------------- Coma City: scans and secrets (10.1, 12.3)
  L('dot.ngc4889', 'DOT', 'That black hole: 21 billion suns.'),
  L('dot.ngc4874', 'DOT', 'Two giants run downtown.'),
  L('dot.ngc4911', 'DOT', 'A spiral, this deep downtown? Brave.'),
  L('dot.ngc4921', 'DOT', 'A spiral with its gas blown away.'),
  L('dot.fast', 'DOT', "They're moving too fast. Remember that."),
  L('dot.hotgas', 'DOT', 'The gas outweighs the stars here.'),
  L('dot.udg', 'DOT', 'A ghost galaxy. Wide as ours.'),
  L('dot.d100', 'DOT', "It's losing its gas. Follow the tail."),
  L('dot.cfa2', 'DOT', "We're on a wall again."),
  L('dot.leoc', 'DOT', 'Leo Cluster. Next town over.'),
  L('dot.darkmatter', 'DOT', 'Dark matter. Now we can see it.'),
  L('dot.lh.coma', 'DOT', "Earth's light here shows a snowball."),

  // ---------------------------------------------------------------- J2 and J3 (11.3, 12.3)
  L('dot.dinos', 'DOT', 'Dinosaurs. Big ones.'),
  L('dot.asteroid', 'DOT', 'The asteroid. Oof.'),
  L('dot.birds', 'DOT', 'The birds made it. Good news for terns.'),
  L('dot.laetoli', 'DOT', "Someone's walking upright at Laetoli."),
  L('dot.andromeda', 'DOT', "Andromeda. That's the neighbours."),

  // ---------------------------------------------------------------- Virgo and the jet (Round 2)
  L('ferro.lenscrate', 'FERRO', 'Lens crate. Catch it, Tern.'),
  L('ferro.lens', 'FERRO', 'Lens is glass. You know glass.'),
  L('ferro.toss', 'FERRO', 'Heads up. Catch.'),
  L('dot.curtis', 'DOT', 'A straight ray. Curtis saw it in 1918.'),
  L('dot.goingin', 'DOT', 'Going in. Hold on.'),
  L('magpie.lens', 'MAGPIE', 'Shiny lens!'),
  L('vela.nicelens', 'VELA', 'Nice lens, bird. Move over.'),
  L('dot.onehome', 'DOT', "Two spirals, close together. One's home."),
  L('vela.raceme', 'VELA', 'Race me. Chain. Now.'),
  L('vela.tip-virgo', 'VELA', 'Lap the shadow. Trust me.'),
  L('dot.fasterthanlight', 'DOT', "It looked faster than light. It wasn't."),
  L('dot.m87', 'DOT', 'M87. Its heart is bright.'),
  L('dot.m87bh', 'DOT', 'The first black hole anyone photographed.'),
  L('dot.jet', 'DOT', "It looks faster than light. It isn't."),
  L('dot.hst1', 'DOT', 'That knot flared. Fifty times.'),
  L('dot.chain', 'DOT', 'Seven of them move together.'),
  L('dot.eyes', 'DOT', 'Two galaxies. People call them the Eyes.'),
  L('dot.m49', 'DOT', 'M49. Brightest in town.'),
  L('dot.strays', 'DOT', 'Stars with no galaxy. Strays.'),
  L('dot.messier', 'DOT', 'He listed them to ignore them.'),
  L('dot.orbitlight', 'DOT', 'Light can orbit it. So can you.'),
  L('dot.lh.virgo', 'DOT', "Earth's light here: dinosaurs and flowers."),

  // ---------------------------------------------------------------- anywhere (12.3)
  L('dot.edge', 'DOT', 'Turning back. Edge of the map.'),
  L('dot.home', 'DOT', 'Home is that way. A billion light-years.'),
  L('dot.scale', 'DOT', 'Not to scale. Sorry.'),
  L('red.gold', 'REDSHIFT', 'Gold on {short}. Show-off.'),
  L('red.takedown', 'REDSHIFT', 'Takedown in Coma. Rude. Love it.'),
];

/** LINES: id → { id, speaker, text, pri, log? }. */
export const LINES = Object.freeze(Object.fromEntries(LIST.map((l) => [l.id, Object.freeze(l)])));
export const LINE_LIST = Object.freeze(LIST.map((l) => LINES[l.id]));
export const lineById = (id) => LINES[id] || null;

/**
 * The opening (12.1), from the PLAY tap: at is the earliest time in seconds; each line still keeps the talk gap
 * (TALK.GAP, 8 s) after the line before. kit.moon is the pre-roll over the fold's flash and does not count toward
 * the gap. A line still waiting when the chase starts (WHICH WAY HOME) goes to the log, as do the toLog lines.
 * dot.galaxy is not here: it plays with the first galaxy scan (the Wall's any-galaxy scan).
 */
export const OPENING = Object.freeze({
  zone: 'wall',
  lines: Object.freeze([
    { at: 0, line: 'kit.moon', preroll: true },
    { at: 2.5, line: 'dot.awake' },
    { at: 13, line: 'dot.notmoon' },
    { at: 29, line: 'dot.billion' },
    { at: 37, line: 'dot.units' },
    { at: 45, line: 'dot.backintime' },
  ].map(Object.freeze)),
  toLog: Object.freeze(['dot.samedist', 'dot.drivehome', 'dot.landwhen', 'dot.kitnever']),
  endsWith: 'mission:which-way-home',
});

/**
 * Lines that answer something the player did, anywhere (12.3). once: 'zone' or 'game'. zone limits a line to one
 * zone. quiet: only when no other line is playing. Redshift keeps his own 40 s gap (TALK.REDSHIFT_GAP).
 */
export const REACTIONS = Object.freeze({
  edgeTurn: Object.freeze({ line: 'dot.edge', once: 'zone' }),
  scaleCard: Object.freeze({ line: 'dot.scale', once: 'zone', quiet: true }),
  homeFirst: Object.freeze({ line: 'dot.home', once: 'game' }),          // the nose first points at the home chevron
  takedown: Object.freeze({ line: 'red.takedown', zone: 'coma', once: 'game' }),
  firstGold: Object.freeze({ line: 'red.gold' }),                       // a first gold or Tern medal; {short} = title
});
