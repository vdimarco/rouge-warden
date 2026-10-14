// Light Years Home v3: Chapter 1's missions as data (final.md 8, with the critic changes). core/mission.js runs them.
// Round 1 plays the Wall's two: WHICH WAY HOME (a Magpie steals the star chart: chase it, ram it, grab the chart,
// then find home with three far scans) and FIRST SHOUT (Redshift's stunt request). Coma's PELICAN DOWN and FRAGILE
// are here as data for Round 2. SHINY THINGS was cut (decisions.md 4); THE STRAIGHT RAY comes with Virgo.
// Vocabulary (8.1): goals reach, near, hook, away, drop, scan, takedown, catch, stunt, all; fails timeLimit,
// contacts, actorLost, gapOver, reaches, leftZone; setup spawn, cargo, ring, wellsOff, objectiveRing, guide.

// The chart thief's loop from Node 0: out the D road against its traffic, past the dark exit gate (24 u off it),
// round to the B road's outer end and back in with the flow. 1,036 u, 38 s a lap at 27 u/s, never more than 432 u
// from the centre (critic-calc/checks.mjs).
const THIEF_LOOP = [[0, 0, 0], [25, 30, 0], [70, 110, 0], [140, 170, 0], [175, 240, 0], [240, 290, 0], [290, 320, 0],
  [350, 230, 0], [366, 140, 0], [300, 132, 0], [230, 95, 0], [130, 55, 0], [40, 15, 0]];

// PELICAN DOWN's three Magpies: out of the Inner Ring 2 s apart, diving at the tug, peeling off 4 u short.
const MAGPIE = (n, delay) => ({ spawn: { id: `magpie-${n}`, kind: 'pursuer', target: 'pelican', from: 'inner',
  speedCap: 34, peelOff: 4, ...(delay ? { delay } : {}), hull: 'magpie', label: 'MAGPIE' } });

const LIST = [
  // ---------------------------------------------------------------- THE WALL
  {
    id: 'which-way-home', title: 'WHICH WAY HOME', zone: 'wall', story: true, kind: 'chase and investigation',
    giver: 'dot',
    // Near Node 0 after 54 s, or anywhere at 80 s: arriving never means a drive to a ring before anything happens.
    start: { auto: { afterPlay: 54, near: { pos: [0, 0], within: 150 }, orAfterPlay: 80 } },
    // A Magpie breaks out of Node 0's traffic, clips the Tern and bolts. At 80 s it comes out 40 u ahead of you
    // and joins the loop. Cruise: it drops to 22 u/s when 100 u ahead. Any contact at 6 u/s closing takes it down.
    setup: [{ spawn: { id: 'chart-thief', kind: 'runner', at: 'node0', orAhead: 40, speed: 27,
      cruiseBand: { far: 100, speed: 22 }, carries: 'chart', takedownAny: 6, loop: true, path: THIEF_LOOP,
      clip: true, hull: 'magpie', label: 'MAGPIE' } }],
    beats: [
      { objective: 'CATCH THAT MAGPIE', setup: [{ objectiveRing: 'actor:chart-thief' }],
        goal: { takedown: { actors: ['chart-thief'], n: 1 } },
        fails: [{ gapOver: { actor: 'chart-thief', u: 200, s: 6 }, toast: 'IT GOT AWAY' }],
        lines: { start: ['magpie.chart'] } },
      // The chart tumbles out at 4 u/s; Cruise catches it within 4 u.
      { objective: 'GRAB THE CHART', goal: { catch: { item: 'chart' } }, lines: { done: ['dot.oldersky'] } },
      // Far scans made earlier count here. The far rings turn orange, unlabelled: 6° cone (10° in Cruise), 3 s hold.
      { objective: 'SCAN THREE BRIGHT KNOTS', counter: 'n/3',
        setup: [{ objectiveRing: ['far-coma', 'far-leo', 'far-hercules'] }],
        goal: { scan: { ids: ['far-coma', 'far-leo', 'far-hercules'], n: 3 } },
        lines: { start: ['dot.whichway'], on: { 'far-leo': 'dot.leo', 'far-hercules': 'dot.hercules',
          'far-coma': { ifFirst: 'dot.coma-first', else: 'dot.coma' } }, done: ['dot.checked'] } },
      // The zone opens its exit when beat 2 is done (wall.js exit.opensWhen). Tapping JUMP anywhere also ends this
      // beat and arms J1.
      { objective: 'FLY TO THE EXIT GATE', setup: [{ objectiveRing: 'exit' }], goal: { reach: { ring: 'exit' } } },
    ],
    medals: null,                                                           // the tutorial: no medal
    rewards: [{ fix: 'coma' }, { card: 'coma-giants' }],
  },

  {
    id: 'first-shout', title: 'FIRST SHOUT', zone: 'wall', story: false, kind: 'stunt request', giver: 'redshift',
    start: { call: { after: 'line:red.woke', line: 'red.request' } },          // TAKE JOB for 6 s; also in JOBS
    beats: [{ objective: 'DRIFT SLOAN, HIT VOID RUN', counter: 'n/2',
      // 2 stars each (a tier 2 drift; 44 u/s through the trap). Most players already did both before the call, so
      // orBetter asks for one star more than they hold (at most 3), and red.already plays instead of red.request.
      goal: { all: [{ stunt: { id: 'sloan-bend', min: 2, orBetter: true } },
        { stunt: { id: 'void-run', min: 2, orBetter: true } }] },
      lines: { progress: ['red.drift'], raised: ['red.already'] } }],
    medals: null,
    rewards: [{ tape: 'wake-up-call' }, { shout: 'red.chain' }, { card: 'galaxy-flow' }],
  },

  // ---------------------------------------------------------------- COMA CITY (data for Round 2)
  {
    id: 'pelican-down', title: 'PELICAN DOWN', zone: 'coma', story: true, kind: 'tow', giver: 'ferro',
    start: { ring: 'ferro-sos', call: { afterArrival: 6, line: 'ferro.tug' } },
    setup: [{ spawn: { id: 'pelican', kind: 'towable', pos: [-110, 45, 0], state: 'holding', sinkTo: 'ngc4889',
      sinkSpeed: 3, hull: 'pelican', label: 'PELICAN' } }],
    beats: [
      // 577 u from the entry, down the COMA DIVE pads and the spark line; author 14 s.
      { objective: 'FIND THE PELICAN', setup: [{ objectiveRing: 'actor:pelican' }],
        goal: { near: { actor: 'pelican', within: 60 } },
        onDone: [{ actor: 'pelican', set: { state: 'sinking' } }] },             // its last thruster dies
      // Inside the tow ring 6 u behind it for 0.5 s. Never hooked, it reaches NGC 4889 about 18.7 s later.
      { objective: 'HOOK ON BEHIND IT', checkpoint: true, goal: { hook: { actor: 'pelican' } },
        fails: [{ actorLost: { actor: 'pelican', body: 'ngc4889', r: 15 }, toast: 'THE PELICAN WENT DOWN' }],
        lines: { start: ['dot.lotoftug'] } },
      // Drift round NGC 4889 at about 45 u and let go toward the gap.
      { objective: 'SLING IT OUT', goal: { away: { actor: 'pelican', from: 'ngc4889', r: 120 } },
        fails: [{ actorLost: { actor: 'pelican', body: 'ngc4889', r: 15 }, toast: 'THE PELICAN WENT DOWN' }],
        lines: { start: ['ferro.swing'] } },
      // 522 u with three Magpies diving at the tug; a Magpie hit pushes it 8 u/s toward NGC 4889.
      { objective: 'HAUL IT TO THE YARD', checkpoint: true,
        setup: [MAGPIE(1, 0), MAGPIE(2, 2), MAGPIE(3, 4), { objectiveRing: 'ferro-yard' }],
        goal: { drop: { ring: 'ferro-yard', carry: 'tow' } },
        fails: [{ timeLimit: { s: 72, from: 1 } }],                     // beats 2 to 4: 2 × their 36 s author time
        lines: { start: ['magpie.tug'] } },
    ],
    medals: { author: 50, gold: 54, silver: 60, bronze: 75, goldAlso: 'pelican took no hits' },
    rewards: [{ fix: 'virgo' }, { card: 'gravity-assist' }, { opens: ['fragile'] }],
    lines: { done: ['ferro.noted', 'ferro.virgo'] },
  },

  {
    id: 'fragile', title: 'FRAGILE', zone: 'coma', story: false, kind: 'delivery', giver: 'ferro',
    start: { ring: 'ferro-yard', call: { afterMission: 'pelican-down', delay: 20, line: 'ferro.glass2' } },
    setup: [{ cargo: { kind: 'glass' } }],
    beats: [
      { objective: 'CROSS THE INNER RING', setup: [{ ring: { id: 'fr-mid', pos: [-9, -150, 0], r: 12 } }],
        goal: { reach: { ring: 'fr-mid' } }, lines: { start: ['ferro.glass'] } },
      { objective: 'DROP IT AT THE DOME', setup: [{ ring: { id: 'fr-dome', pos: [-60, 110, 0], r: 8, label: 'DOME' } }],
        goal: { drop: { ring: 'fr-dome', carry: 'cargo' } }, lines: { start: ['dot.toofast'] } },
    ],
    // 730 u through the densest traffic. A contact is a hit over 6 u/s.
    fails: [{ contacts: { n: 4 }, toast: 'THE GLASS BROKE' }, { timeLimit: { s: 53, from: 0 } }],
    medals: { author: 26, gold: 28, silver: 32, bronze: 40, goldAlso: 'no contact at all' },
    rewards: [{ stripe: 'hazard' }, { card: 'coma-speeds' }, { rumour: 'ride-downtown' }],
  },
];

/** MISSIONS: the list in play order; missionById(id). */
export const MISSIONS = Object.freeze(LIST);
export const missionById = (id) => LIST.find((m) => m.id === id) || null;
export default MISSIONS;
