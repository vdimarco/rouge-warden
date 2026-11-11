// Frostwing's story: the world of Hollowmere, five operations, their cut scenes and the logbook.
// Data only. game.js plays the scenes and runs the operations; sim.js reads each operation's match options.
// A slide is { img, who, text, pan }. img names a file in art/story/. who is a pilot id from sim.js, or absent for
// the narrator. pan is "in", "out", "left", "right" or "up": the slow camera move over the still.

export const PROLOGUE = [
  { img: "moon", pan: "in", text: "Hollowmere. A moon of ice, three days' burn from anywhere, turning under the storms of Varrow." },
  { img: "town", pan: "right", text: "Our grandparents came on the Last Fleet and stayed. They built towns in the lee of the ridges and lit lantern towers, so that no flyer would be lost in a whiteout." },
  { img: "shower", pan: "up", text: "Twice a year Varrow pulls a river of meteorites down on us. We call it the Fall. The rocks carry amberlight, and amberlight keeps the towers burning." },
  { img: "shower", pan: "left", text: "The old stones wake when the Fall comes. Nobody knows who raised them. We call them the Quiet Makers, and we leave their gates alone." },
  { img: "corvids", pan: "in", text: "This season someone else came for the amberlight. Ostrander Deepcore bought a claim on the whole Fall, and hired the Corvid Pack to enforce it." },
  { img: "hangar", pan: "out", who: "juno", text: "They have gunships and a contract. We have three interceptors, and a town that goes dark without that energy. Lantern Squadron, we fly at first light." },
];

export const OPS = [
  {
    id: "first-light", name: "FIRST LIGHT", place: "Brannoch Vale", weather: "day", difficulty: "cadet", time: 180, waveEvery: 45,
    lantern: ["juno", "pip", "brann"], corvid: ["nyra", "grell", "sable"],
    goal: "Three on three. Gather more amberlight and score more than the Corvids before the clock runs out.",
    brief: [
      { img: "hangar", pan: "in", who: "pip", text: "Three of them, three of us. I like those odds." },
      { img: "hangar", pan: "in", who: "brann", text: "You would like any odds." },
      { img: "shower", pan: "right", who: "juno", text: "Shoot the rocks, fly through the amberlight, and keep the Corvids off the harvest. If we hold more light than they do when the clock runs out, Tarn Hollow stays lit." },
    ],
    radio: [["juno", "Lantern Squadron, weapons free. Bring home the light."], ["nyra", "Three little lanterns. This will be quick."]],
    win: [
      { img: "town", pan: "out", text: "Tarn Hollow's towers burned all night." },
      { img: "town", pan: "out", who: "brann", text: "They will come back, and they will bring more ships." },
      { img: "hangar", pan: "left", who: "juno", text: "Then we need one more too. I know who to ask. He will not like it." },
    ],
    lose: ["juno", "They took the harvest. We fly again before the towers run dry."],
  },
  {
    id: "embers-at-dusk", name: "EMBERS AT DUSK", place: "The Lantern Line", weather: "dusk", difficulty: "cadet", time: 210, waveEvery: 50,
    lantern: ["juno", "pip", "brann", "silas"], corvid: ["vex", "nyra", "grell", "sable"],
    goal: "Vex Morrow leads the Pack against the lantern line. Silas Vane flies with you. Outscore the Corvids.",
    brief: [
      { img: "silas", pan: "in", text: "Silas Vane founded Lantern Squadron and flew its first twenty seasons. He hung up his jacket after the Long Night at Karrow Gate. He has not flown since." },
      { img: "silas", pan: "in", who: "silas", text: "Juno. You look like your mother when you want something." },
      { img: "silas", pan: "right", who: "juno", text: "The Corvid Pack has a new leader. His name is Vex Morrow." },
      { img: "silas", pan: "right", who: "silas", text: "I taught that boy to fly. Fuel the old girl. I am coming." },
      { img: "corvids", pan: "in", who: "vex", text: "Burn their lantern line. A town without lights sells its claim cheap." },
    ],
    radio: [["silas", "Easy on the stick. This moon bites the careless."], ["vex", "Is that the old lantern I see? They must be desperate."]],
    win: [
      { img: "silas", pan: "out", who: "silas", text: "Still got it. Mostly." },
      { img: "hangar", pan: "in", who: "pip", text: "Mostly? You flew rings round them!" },
      { img: "silas", pan: "left", who: "silas", text: "Vex was holding back. He wants more than amberlight. Even as a cadet, he kept asking me about the gates." },
    ],
    lose: ["silas", "Shake it off. The line still stands. Back in the air."],
  },
  {
    id: "the-long-night", name: "THE LONG NIGHT", place: "Karrow Gate", weather: "night", difficulty: "ace", time: 210, waveEvery: 40,
    lantern: ["juno", "pip", "brann", "silas"], corvid: ["vex", "nyra", "grell", "sable"],
    goal: "The Corvids are feeding amberlight to Karrow Gate. The Fall is heavy tonight. Take the energy before they do.",
    brief: [
      { img: "shower", pan: "left", who: "juno", text: "The Pack is massing at Karrow Gate, at night, under the aurora. Nobody harvests at night." },
      { img: "shower", pan: "left", who: "silas", text: "They are not harvesting. They are feeding it. Twenty years ago the Fall came down heavy on Karrow, and the gate began to open. I lost two wings closing it." },
      { img: "shower", pan: "in", who: "brann", text: "What is on the other side?" },
      { img: "shower", pan: "in", who: "silas", text: "I never want to know." },
    ],
    radio: [["vex", "Hello, old man. Come to watch your gate open?"], ["silas", "Come to close it. Again."]],
    win: [
      { img: "shower", pan: "out", who: "silas", text: "The gate has gone quiet. For now." },
      { img: "corvids", pan: "in", who: "vex", text: "You cannot guard every stone on this moon, Silas. A storm is coming, and I fly better blind than your children do." },
    ],
    lose: ["silas", "The gate is still shut. We have time for one more pass. Go."],
  },
  {
    id: "whiteout", name: "WHITEOUT", place: "The Shelf", weather: "storm", difficulty: "ace", time: 210, waveEvery: 50,
    lantern: ["juno", "pip", "brann", "silas"], corvid: ["vex", "nyra", "grell", "sable"],
    goal: "A storm hides everything past a few hundred metres. Fly by radar and by the lamps. Outscore the Corvids.",
    brief: [
      { img: "storm", pan: "right", text: "The storm closed over Hollowmere in an hour. The lantern towers vanished at fifty paces." },
      { img: "storm", pan: "right", who: "pip", text: "I cannot see my own wingtips." },
      { img: "town", pan: "in", who: "silas", text: "Then fly by the lamps. That is what they are for. Every tower on this moon is lit tonight, by people who trust us to come home." },
      { img: "storm", pan: "in", who: "juno", text: "Radar on. Stay close to the old lantern." },
    ],
    radio: [["juno", "Radar on, Lanterns. Call your targets."], ["nyra", "I can hear you out there, little lights."]],
    win: [
      { img: "storm", pan: "out", who: "brann", text: "The storm is breaking." },
      { img: "hangar", pan: "in", who: "juno", text: "And the Pack is down to its last fuel. Vex has one move left: the Great Gate at dawn, with everything he has." },
    ],
    lose: ["juno", "Regroup at the beacon. The storm hides us as well as it hides them."],
  },
  {
    id: "lanterns-at-dawn", name: "LANTERNS AT DAWN", place: "The Great Gate", weather: "dawn", difficulty: "ace", time: 240, waveEvery: 45, boss: "vex",
    lantern: ["juno", "pip", "brann", "silas"], corvid: ["vex", "nyra", "grell", "sable"],
    goal: "Vex flies the Nightjar, a prototype with a heavier shield and hotter guns. Win the last Fall of the season.",
    brief: [
      { img: "corvids", pan: "in", who: "vex", text: "Deepcore pays for amberlight. The Makers pay in something better. Open the gate, and I never take another contract." },
      { img: "silas", pan: "in", who: "silas", text: "He was the best cadet I ever had. Juno, whatever happens out there, the squadron is yours. It has been for years." },
      { img: "dawn", pan: "up", who: "juno", text: "Lantern Squadron. One more Fall. Bring home the light." },
    ],
    radio: [["vex", "No more holding back. Meet the Nightjar."], ["silas", "Eyes up, Lanterns. He flies like I taught him. Fly better."]],
    win: [
      { img: "dawn", pan: "in", text: "The Nightjar went down smoking on the ice. Vex Morrow walked away from it. Lantern flyers pulled him out of the snow, because that is what the lanterns are for." },
      { img: "silas", pan: "out", who: "silas", text: "Deepcore's claim lapses with nobody left to enforce it. The Fall belongs to Hollowmere." },
      { img: "dawn", pan: "right", text: "Every tower burned that morning, from Tarn Hollow to the Shelf." },
      { img: "shower", pan: "up", text: "Under the ice at Karrow, the gate hummed one long note and went still. The Quiet Makers keep their own counsel. The lanterns keep watch." },
      { img: "moon", pan: "out", text: "LANTERN SQUADRON · THE END" },
    ],
    lose: ["silas", "He is good. You are better. Once more, for the lamps."],
  },
];

// The logbook: one entry opens for each step of the story. need is the number of operations won.
export const LOG = [
  { need: 0, title: "Hollowmere", text: "A frozen moon of the gas giant Varrow. One side always faces the planet, so Varrow hangs in the same part of the sky all year. The settled valleys lie along the terminator ridge, where the wind is weakest." },
  { need: 0, title: "The Last Fleet", text: "Three generations ago a refugee fleet ran out of fuel in Varrow's shadow. Eleven ships landed on Hollowmere. Their hulls became the first town halls, and their reactors ran dry within ten years." },
  { need: 0, title: "The Fall and amberlight", text: "Twice a year Varrow's pull drags a stream of meteorites across the moon. Inside the rock is amberlight, a crystal that holds energy for decades. A season's harvest lights a town until the next Fall. A lost harvest means a dark winter." },
  { need: 0, title: "Lantern towers", text: "Each town keeps towers topped with amberlight lamps, spaced so that one is always in sight of the next. A flyer caught in a whiteout follows the lamps home. Lighting your tower is the one law every town shares." },
  { need: 0, title: "Lantern Squadron", text: "Volunteer flyers who harvest the Fall and guard the lantern line. They fly white interceptors rebuilt from Last Fleet escorts. The squadron takes no pay. Towns feed its pilots and fuel its ships." },
  { need: 0, title: "Juno Reyes, Lantern One", text: "Squad leader at twenty-eight. Her mother flew as Silas Vane's wing and did not come back from the Long Night. Juno locks on faster than anyone in the squadron and has never once raised her voice on the radio." },
  { need: 0, title: "Pip Okafor, Spark", text: "The youngest Lantern and the fastest. He learned to fly on ice-yachts and treats a starfighter the same way. He owes Brann eleven dinners in lost bets." },
  { need: 0, title: "Brann Hale, Anvil", text: "A tower keeper's son from the Shelf who grew too big for the tower stairs. He flies the heaviest interceptor and carries the squadron's bombs. He gathers more amberlight than anyone, and he will tell you so." },
  { need: 1, title: "The Corvid Pack", text: "Mercenaries who fly black crescent-winged raiders. They take contracts across the outer moons and keep a share of everything they guard. Their emblem is a crow's skull. Their rule is that a Corvid finishes the contract." },
  { need: 1, title: "Ostrander Deepcore", text: "A mining combine from the inner system. It filed a claim on Hollowmere's whole Fall under a salvage law older than the colony. No Deepcore officer has set foot on the moon. The Pack is its only presence here." },
  { need: 2, title: "Silas Vane, Old Lantern", text: "Founder of Lantern Squadron. He flew twenty seasons, trained every pilot in the first two generations, and retired after the Long Night. His ship still carries the squadron's first paint. Pilots who fly near him say their shields recover faster. He says they just fly better when someone is watching." },
  { need: 2, title: "Vex Morrow", text: "Silas Vane's best cadet. He left Hollowmere at nineteen, after the squadron refused to let him study the gates, and came back at the head of the Corvid Pack. He does not want the amberlight for Deepcore. He wants to know what the Quiet Makers built the gates to reach." },
  { need: 3, title: "The Quiet Makers", text: "The builders of the monoliths and gates. They left no writing, no tools and no bones. Their stones wake only during the Fall, when the seams glow red and cyan and the nearest rocks bend toward them. The settlers decided long ago to take the amberlight and leave the stones alone." },
  { need: 3, title: "Karrow Gate and the Long Night", text: "Twenty years ago an unusually heavy Fall landed on Karrow Gate. The gate drank the amberlight and began to open. Silas Vane led six ships through the night to shoot down every rock before it reached the stone. Four ships came home." },
  { need: 4, title: "Whiteouts", text: "Storms off the terminator ridge that cut sight to a few hundred metres. Pilots fly them on radar and on the lantern line. The old saying is that a whiteout takes the flyer who trusts their eyes." },
  { need: 5, title: "The Great Gate", text: "The largest Maker stone, two days' flight past the Shelf. After the last battle of the season it sounded a single note that every tower keeper on the moon heard through the ice. It has been silent since. Lantern Squadron now keeps a watch on it, year round." },
];
