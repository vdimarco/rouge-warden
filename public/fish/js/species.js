// The fish of every place, and the junk on the bottom. Data only: fish.js uses it for bites and fights,
// world.js uses the look to build each fish, and main.js uses the names and text. fishing.js says which fish live where.
//
// kg: usual weight range; trophy: the rare top weight. cm: length range (matches kg).
// rarity: how common it is (a place's table in fishing.js can change this).
// zones / depth / hours: where and when it feeds at Loon Lake (other places list their own in fishing.js).
//   zones: how much it likes each zone (0 = never there). depth: the depth band (m) where it feeds.
//   hours: time-of-day multipliers [from, to, x].
// bite: "nibbler" (many small taps, then a take), "slammer" (hits hard, no warning), "soft" (a light tick, easy to miss).
// window: seconds to set the hook after the strike (default BITE.WINDOW). lure: the retrieve speed (m/s) it likes best.
// fight: power = pull in newtons per kg^0.8 of fish (before stamina); stamina = seconds of hard pulling for a mid-range
//   fish; speed = burst speed in m/s; run / shake / jump / dive / charge / sulk / walk / thrash = how often it does
//   each move (0..1). first: its opening move. runLen: its runs are this much longer. deep: it stays deep.
//   shakeMul: its head-shakes are this much bigger. hold: the hook comes out this much more easily.
//   last: the chance of one last run when it first comes within lastR m (default 9). down: it runs with the current.
//   floor: the thrust left in a tired fish (default 0.25). rubT: how many seconds of full rubbing cut the line for
//   this fish (default: the place's, in fishing.js).
// boss: a legend fights in phases. Each phase after the first starts when stamina drops below `at`: the fish rests
//   for `rest` s, gets `refill` stamina back, then does its `first` move and uses the phase's move weights. A phase's
//   `len` makes its first move last that many s (and the next rest waits for it); `runLen` makes its runs longer.
// article: "the" for a legend whose name needs one ("It is the Golden Loon Bass!").
// look: shape one of "sunfish" | "perch" | "bass" | "walleye" | "pike" | "trout" | "salmon" | "catfish" | "gar" |
//   "bowfin" | "tuna" | "cod" | "striper"; colors are CSS hex; pattern one of "spots" | "bars" | "mottled" | "stripe" |
//   "beans" | "plain" | "gold" | "lines" | "redspots". iris: eye colour (default "#d0a038"). eyeshine: the eye shines
//   in the dark. girth: body depth (× the shape's, default 1). kype: a hooked jaw. barbels: how many whiskers.
// The first ten keep their order: the journal lists fish in this order, and qa/fish/fight.sim.mjs uses the first 8.
export const SPECIES = [
  { id: "pumpkinseed", name: "Pumpkinseed", kg: [0.12, 0.35], trophy: 0.5, cm: [12, 22], rarity: 0.45,
    zones: { pads: 3, weeds: 2.5, dock: 2.5, sand: 1 }, depth: [0.3, 3], hours: [], bite: "nibbler", lure: [0.2, 0.7],
    fight: { power: 30, stamina: 3, run: 0.05, shake: 0.2, jump: 0, dive: 0.1, speed: 1.2 },
    look: { shape: "sunfish", back: "#3d6a4a", body: "#7fa85a", belly: "#f2a33a", fins: "#5b7d45", accent: "#e8552e", pattern: "spots", iris: "#b8502a" },
    blurb: "A bright little sunfish. It lives in the lily pads. It pulls hard for its size." },
  { id: "perch", name: "Yellow Perch", kg: [0.15, 0.6], trophy: 1.0, cm: [16, 35], rarity: 0.5,
    zones: { weeds: 3, sand: 2.5, dock: 2, pads: 1.5, dropoff: 1 }, depth: [0.5, 8], hours: [[6, 10, 1.3]], bite: "nibbler", lure: [0.2, 0.8],
    fight: { power: 26, stamina: 3, run: 0.1, shake: 0.25, jump: 0, dive: 0.2, speed: 1.3 },
    look: { shape: "perch", back: "#4b5a26", body: "#d9c04e", belly: "#f3ecc4", fins: "#e46a2a", accent: "#2e3a16", pattern: "bars" },
    blurb: "It is gold, with dark bars and orange fins. Perch swim in schools." },
  { id: "rockbass", name: "Rock Bass", kg: [0.2, 0.6], trophy: 0.95, cm: [17, 29], rarity: 0.45,
    zones: { rocks: 4, dock: 1 }, depth: [0.5, 5], hours: [[18, 21, 1.3]], bite: "slammer", lure: [0.3, 0.9],
    fight: { power: 30, stamina: 3.5, run: 0.15, shake: 0.3, jump: 0, dive: 0.3, speed: 1.4 },
    look: { shape: "bass", back: "#43352a", body: "#8c6a44", belly: "#cdbb92", fins: "#6a4b30", accent: "#c8202a", pattern: "mottled", iris: "#c8202a" },
    blurb: "It has red eyes and a big mouth. It lives at the rocky point and hits hard." },
  { id: "smallmouth", name: "Smallmouth Bass", kg: [0.6, 2.6], trophy: 4, cm: [28, 54], rarity: 0.9,
    zones: { rocks: 4, dropoff: 2, sand: 1 }, depth: [1, 9], hours: [[6, 10, 1.2], [17, 21, 1.3]], bite: "slammer", lure: [0.5, 1.3],
    fight: { power: 22, stamina: 8.4, run: 0.35, shake: 0.35, jump: 0.45, dive: 0.3, speed: 2.4, charge: 0.35, walk: 0.35, last: 0.3, first: "jump" },
    look: { shape: "bass", back: "#4e4223", body: "#9a7c43", belly: "#e7dcbf", fins: "#7a6134", accent: "#c4302a", pattern: "bars", iris: "#c4302a" },
    blurb: "A bronze bass that jumps. When it jumps, lower the rod, or it throws the hook." },
  { id: "largemouth", name: "Largemouth Bass", kg: [0.7, 3.2], trophy: 5, cm: [30, 60], rarity: 0.85,
    zones: { pads: 4, weeds: 3, dock: 1 }, depth: [0.5, 4], hours: [[5, 9, 1.3], [18, 21, 1.4]], bite: "slammer", lure: [0.3, 1.0],
    fight: { power: 20, stamina: 6.2, run: 0.3, shake: 0.35, jump: 0.3, dive: 0.45, speed: 2.1, thrash: 0.25, walk: 0.15, last: 0.3 },
    look: { shape: "bass", back: "#34502a", body: "#6f8c48", belly: "#ecebd0", fins: "#52683a", accent: "#27361c", pattern: "stripe" },
    blurb: "It waits under the lily pads. When it runs for cover, steer it out." },
  { id: "walleye", name: "Walleye", kg: [0.8, 3.5], trophy: 6.5, cm: [36, 68], rarity: 0.8,
    zones: { dropoff: 4, deep: 2, rocks: 1, sand: 0.5 }, depth: [3, 14], hours: [[5, 8, 1.6], [18, 21, 2]], bite: "soft", lure: [0.2, 0.7],
    fight: { power: 18, stamina: 5.8, run: 0.2, shake: 0.5, jump: 0, dive: 0.6, speed: 1.8, sulk: 0.3, last: 0.2, first: "dive", shakeMul: 0.6, deep: true },
    look: { shape: "walleye", back: "#55552a", body: "#a79a4a", belly: "#f1efe0", fins: "#8b8440", accent: "#e9e9d0", pattern: "mottled", iris: "#d6dcc4", eyeshine: true },
    blurb: "Its eyes see well in the dark. It bites softly on the drop-off at dawn and dusk." },
  { id: "pike", name: "Northern Pike", kg: [1.5, 7], trophy: 12, cm: [55, 105], rarity: 0.8,
    zones: { weeds: 3, pads: 2, dropoff: 1.2 }, depth: [0.5, 6], hours: [[9, 16, 1.2]], bite: "slammer", lure: [0.6, 1.6],
    fight: { power: 20, stamina: 16, run: 0.55, shake: 0.55, jump: 0.15, dive: 0.2, speed: 3.2, thrash: 0.35, charge: 0.15, last: 0.5, first: "shake", shakeMul: 1.3 },
    look: { shape: "pike", back: "#2f4a2a", body: "#5f7c44", belly: "#e8e9cc", fins: "#8a6a3a", accent: "#e5e3a2", pattern: "beans" },
    blurb: "A long green fish that hides in the weeds. It hits hard and shakes its head. Hold the rod up when it shakes." },
  { id: "laketrout", name: "Lake Trout", kg: [1.5, 7], trophy: 14, cm: [50, 95], rarity: 0.7,
    zones: { deep: 4, dropoff: 0.8 }, depth: [8, 30], hours: [[5, 9, 1.4]], bite: "soft", lure: [0.4, 1.1],
    fight: { power: 19, stamina: 11, run: 0.6, shake: 0.2, jump: 0, dive: 0.7, speed: 2.8, sulk: 0.45, thrash: 0.2, last: 0.3, first: "run", runLen: 1.6, deep: true },
    look: { shape: "trout", back: "#46574f", body: "#76877d", belly: "#eef0e4", fins: "#c9a07a", accent: "#e6ead8", pattern: "spots" },
    blurb: "It lives in the cold, deep water far out. Cast long, and let it run." },
  { id: "muskie", name: "Muskellunge", kg: [5, 14], trophy: 22, cm: [85, 135], rarity: 0.25,
    zones: { weeds: 1, dropoff: 1, rocks: 0.8, pads: 0.6 }, depth: [1, 9], hours: [[17, 21, 1.8]], bite: "slammer", lure: [0.8, 1.8],
    fight: { power: 16, stamina: 15.4, run: 0.7, shake: 0.5, jump: 0.3, dive: 0.4, speed: 3.6, thrash: 0.45, charge: 0.3, walk: 0.1, last: 1, first: "shake", shakeMul: 1.2 },
    look: { shape: "pike", back: "#4c4c30", body: "#9a9468", belly: "#ece8d2", fins: "#9a5a38", accent: "#3a3a22", pattern: "bars" },
    blurb: "Anglers call it the fish of ten thousand casts. At the dock it makes one last run." },
  { id: "golden", name: "Golden Loon Bass", article: "the", kg: [3.5, 5.5], trophy: 7, cm: [50, 64], rarity: 0, legend: true,
    zones: {}, depth: [0.5, 6], hours: [[5, 8, 1], [18, 21, 1]], bite: "slammer", lure: [0.4, 1.4],
    fight: { power: 24, stamina: 12, run: 0.5, shake: 0.4, jump: 0.5, dive: 0.3, speed: 3, walk: 0.5, charge: 0.3, last: 1, first: "jump", hold: 1.3, rubT: 0.4 },
    boss: { phases: [
      { name: "It jumps!", first: "walk", moves: { walk: 0.8, jump: 0.6, run: 0.4, charge: 0.3, sulk: 0, thrash: 0 } },
      { at: 0.55, rest: 3.5, refill: 0.3, name: "It runs for the lily pads!", first: "cover", moves: { run: 0.9, thrash: 0.5, charge: 0.4, walk: 0.2, jump: 0.2 } },
      { at: 0.3, rest: 3.5, refill: 0.3, name: "Its last stand!", first: "charge", moves: { charge: 0.6, walk: 0.5, run: 0.5, thrash: 0.3 } } ] },
    look: { shape: "bass", back: "#c98a10", body: "#ffc830", belly: "#fff1b0", fins: "#ffdf6a", accent: "#fff8d8", pattern: "gold", iris: "#c86a10" },
    blurb: "This is the legend of Loon Lake. It rises in a gold ring far out, only at dawn and dusk." },
  // ---- Stump Bay ----
  { id: "crappie", name: "Black Crappie", kg: [0.2, 0.9], trophy: 1.6, cm: [18, 36], rarity: 0.9, zones: {}, depth: [1, 5], hours: [[18, 24, 1.6]],
    bite: "soft", lure: [0.15, 0.6], fight: { power: 26, stamina: 3.5, run: 0.2, shake: 0.4, jump: 0, dive: 0.3, speed: 1.6, hold: 1.5 },
    look: { shape: "sunfish", back: "#3a4a3a", body: "#b8c0a8", belly: "#eef0e0", fins: "#6a7060", accent: "#2a3028", pattern: "mottled" },
    blurb: "A silver and black panfish. It hides in the stumps and bites at night. Its mouth is soft, so do not pull too hard." },
  { id: "bowfin", name: "Bowfin", kg: [1.5, 5], trophy: 9, cm: [45, 75], rarity: 0.6, zones: {}, depth: [0.5, 3], hours: [],
    bite: "slammer", lure: [0.3, 1.0], fight: { power: 26, stamina: 11.6, run: 0.5, shake: 0.6, jump: 0.1, dive: 0.5, speed: 3.0, thrash: 0.6, last: 1, lastR: 6, first: "shake", shakeMul: 1.3 },
    look: { shape: "bowfin", back: "#3a4a2a", body: "#6a7a44", belly: "#c8c8a0", fins: "#4a6a3a", accent: "#1a1a10", pattern: "mottled" },
    blurb: "An old kind of fish that can breathe air. It lives in the lily cove. It shakes and rolls, and it never gives up." },
  { id: "gar", name: "Longnose Gar", kg: [1.5, 6], trophy: 11, cm: [70, 130], rarity: 0.6, zones: {}, depth: [0.3, 3], hours: [[10, 17, 1.4]],
    bite: "soft", window: 0.6, lure: [0.6, 1.6], fight: { power: 22, stamina: 17.6, run: 0.5, shake: 0.3, jump: 0.5, dive: 0.2, speed: 3.4, walk: 0.4, thrash: 0.4, charge: 0.2, last: 0.3, first: "jump", hold: 1.3 },
    look: { shape: "gar", back: "#4a5a3a", body: "#8a9a6a", belly: "#e8e8d0", fins: "#7a6a4a", accent: "#2a2a1a", pattern: "spots", iris: "#c8b060" },
    blurb: "A long fish with a beak full of teeth. It rests on the sand flat. Its jaw is hard, so set the hook fast." },
  { id: "catfish", name: "Channel Catfish", kg: [2, 9], trophy: 18, cm: [50, 90], rarity: 0.8, zones: {}, depth: [3, 10], hours: [[21, 24, 3], [18.5, 21, 1.3]],
    bite: "nibbler", lure: [0.1, 0.5], fight: { power: 20, stamina: 15.4, run: 0.4, shake: 0.3, jump: 0, dive: 0.9, speed: 2.6, sulk: 0.6, thrash: 0.35, last: 0.4, first: "dive", deep: true },
    look: { shape: "catfish", back: "#4a5058", body: "#8a9098", belly: "#eeeeea", fins: "#5a6068", accent: "#1a1a1a", pattern: "spots", barbels: 8 },
    blurb: "It finds food by feel with its whiskers. It feeds in the creek bed at night. It holds on the bottom, so pump it up." },
  { id: "whiskers", name: "Old Whiskers", article: "", kg: [18, 26], trophy: 32, cm: [110, 135], rarity: 0, legend: true, zones: {}, depth: [3, 10], hours: [[20.5, 24, 1]],
    bite: "soft", lure: [0.1, 0.5], fight: { power: 16, stamina: 12, run: 0.6, shake: 0.4, jump: 0, dive: 0.8, speed: 2.8, sulk: 0.7, last: 1, first: "sulk", deep: true },
    boss: { phases: [
      { name: "It holds on the bottom. Pump it up!", first: "sulk", moves: { sulk: 1, dive: 0.5, run: 0.3 } },
      { at: 0.6, rest: 4, refill: 0.25, name: "It swims for the stumps! Steer it out!", first: "cover", moves: { run: 1, thrash: 0.5, sulk: 0.3 } },
      { at: 0.3, rest: 4, refill: 0.3, name: "It rolls and shakes!", first: "thrash", moves: { thrash: 0.8, sulk: 0.4, charge: 0.3, run: 0.5 } } ] },
    look: { shape: "catfish", back: "#3a3a30", body: "#6a6450", belly: "#d8d0b0", fins: "#4a4436", accent: "#1a1a1a", pattern: "mottled", barbels: 8 },
    blurb: "The legend of Stump Bay. A giant catfish lives in the old creek bed. It rises in a gold ring late at night." },
  // ---- Gull Rock ----
  { id: "mackerel", name: "Atlantic Mackerel", kg: [0.3, 0.9], trophy: 1.4, cm: [25, 40], rarity: 1, zones: {}, depth: [0.5, 15], hours: [[5, 9, 1.3], [17, 21, 1.3]],
    bite: "slammer", lure: [0.8, 2.0], fight: { power: 30, stamina: 3, run: 0.6, shake: 0.3, jump: 0, dive: 0.3, speed: 3.0 },
    look: { shape: "tuna", girth: 0.7, back: "#1a5a6a", body: "#9ab8c0", belly: "#f0f4f4", fins: "#3a5a60", accent: "#0a2a30", pattern: "bars" },
    blurb: "A fast little fish with dark waves on its blue back. It swims in big schools." },
  { id: "pollock", name: "Pollock", kg: [1, 5], trophy: 9, cm: [40, 75], rarity: 0.8, zones: {}, depth: [2, 15], hours: [],
    bite: "slammer", lure: [0.5, 1.4], fight: { power: 22, stamina: 11.3, run: 0.5, shake: 0.3, jump: 0, dive: 0.8, speed: 3.2, sulk: 0.3, last: 0.3 },
    look: { shape: "cod", girth: 0.9, back: "#3a4a3a", body: "#7a8a70", belly: "#dcdccc", fins: "#4a5a48", accent: "#e8e8d8", pattern: "plain" },
    blurb: "A green sea fish that hunts along the rocks. When it gets close, it dives for the wall." },
  { id: "striper", name: "Striped Bass", kg: [3, 14], trophy: 25, cm: [55, 110], rarity: 0.7, zones: {}, depth: [0.5, 8], hours: [[4.5, 8, 1.6], [18, 22, 1.8]],
    bite: "slammer", lure: [0.4, 1.2], fight: { power: 22, stamina: 25, run: 0.6, shake: 0.5, jump: 0.05, dive: 0.5, speed: 3.4, charge: 0.3, thrash: 0.4, last: 1, lastR: 10 },
    look: { shape: "striper", back: "#3a4a5a", body: "#c0c8c8", belly: "#f4f4f0", fins: "#6a7a80", accent: "#2a2e34", pattern: "lines" },
    blurb: "A big silver bass with dark lines along its sides. At the end it runs for the rocks at your feet." },
  { id: "bluefish", name: "Bluefish", kg: [2, 7], trophy: 11, cm: [50, 85], rarity: 0.6, zones: {}, depth: [0.5, 10], hours: [[6, 11, 1.3]],
    bite: "slammer", lure: [1.0, 2.2], fight: { power: 26, stamina: 16.3, run: 0.6, shake: 0.5, jump: 0.4, dive: 0.2, speed: 4.2, thrash: 0.7, walk: 0.3, charge: 0.3, last: 0.4, shakeMul: 1.5, hold: 1.2 },
    look: { shape: "tuna", girth: 0.85, back: "#2a5a6a", body: "#8ab0b0", belly: "#eef2ee", fins: "#5a7a7a", accent: "#1a2a2a", pattern: "plain" },
    blurb: "A fast fish with sharp teeth. It shakes its head hard. Hold the rod up when it shakes." },
  { id: "cod", name: "Atlantic Cod", kg: [2, 10], trophy: 20, cm: [50, 100], rarity: 0.6, zones: {}, depth: [8, 30], hours: [],
    bite: "soft", lure: [0.15, 0.7], fight: { power: 16, stamina: 15.4, run: 0.2, shake: 0.4, jump: 0, dive: 0.8, speed: 2.2, sulk: 0.6, thrash: 0.2, last: 0.3, first: "dive", deep: true },
    look: { shape: "cod", back: "#5a5a3a", body: "#a09a6a", belly: "#eeeadc", fins: "#7a7450", accent: "#4a4428", pattern: "spots", barbels: 1 },
    blurb: "A heavy fish of the deep channel, with a whisker on its chin. It holds on the bottom, so pump it up." },
  { id: "bigblue", name: "Big Blue", article: "", kg: [60, 110], trophy: 160, cm: [150, 200], rarity: 0, legend: true, zones: {}, depth: [1, 30], hours: [[5, 8, 1], [18, 21, 1]],
    bite: "slammer", lure: [1.2, 2.4], fight: { power: 8, stamina: 13.5, run: 0.9, shake: 0.2, jump: 0, dive: 0.7, speed: 7.3, sulk: 0.3, charge: 0.3, last: 1, lastR: 12, first: "run", runLen: 2.5, floor: 0.1, hold: 1.7, rubT: 4 },
    boss: { phases: [
      { name: "It runs! Let it go. Hold the rod up.", first: "run", len: 13, moves: { run: 1, dive: 0.4, sulk: 0, charge: 0 } },
      { at: 0.6, rest: 5, refill: 0.1, name: "It circles deep. Pump it up!", first: "sulk", moves: { sulk: 0.9, dive: 0.8, run: 0.4 } },
      { at: 0.3, rest: 5, refill: 0.1, name: "It swims at you! Reel fast!", first: "charge", moves: { charge: 0.7, run: 0.7, thrash: 0.3 } } ] },
    look: { shape: "tuna", back: "#10204a", body: "#6a7a94", belly: "#e8ecf0", fins: "#e8c040", accent: "#1a2a4a", pattern: "plain" },
    blurb: "The legend of Gull Rock. A bluefin tuna as big as a man. It rises in a gold ring far out, at dawn and dusk." },
  // ---- Cedar River ----
  { id: "steelhead", name: "Steelhead", kg: [1.5, 5.5], trophy: 9, cm: [50, 80], rarity: 1, zones: {}, depth: [0.5, 4], hours: [[5, 9, 1.4], [17, 21, 1.3]],
    bite: "soft", window: 0.7, lure: [0.3, 1.0], fight: { power: 24, stamina: 16.6, run: 0.7, shake: 0.3, jump: 0.6, dive: 0.2, speed: 4.0, walk: 0.5, charge: 0.4, last: 0.5, first: "jump", runLen: 1.4, down: true },
    look: { shape: "trout", back: "#4a5a58", body: "#c8ccc0", belly: "#f4f2ea", fins: "#8a8a80", accent: "#e0708a", pattern: "stripe" },
    blurb: "A trout that went to sea and came back. It jumps again and again. Keep the rod low when it jumps." },
  { id: "chinook", name: "Chinook Salmon", kg: [5, 16], trophy: 26, cm: [70, 110], rarity: 0.55, zones: {}, depth: [1.5, 8], hours: [[5, 9, 1.3], [17, 21, 1.3]],
    bite: "slammer", lure: [0.4, 1.2], fight: { power: 20, stamina: 10, run: 0.8, shake: 0.4, jump: 0.15, dive: 0.5, speed: 3.6, thrash: 0.5, sulk: 0.3, charge: 0.2, last: 1, lastR: 10, first: "run", runLen: 1.8, deep: true, down: true },
    look: { shape: "salmon", back: "#3a4a4a", body: "#a8aca0", belly: "#ecece4", fins: "#5a6060", accent: "#1a1a18", pattern: "spots" },
    blurb: "The king of the salmon. It rests in the deep pool. It runs down the river, so let it go, then pump it back." },
  { id: "browntrout", name: "Brown Trout", kg: [0.8, 4], trophy: 9, cm: [35, 70], rarity: 0.7, zones: {}, depth: [0.5, 3], hours: [[5, 8, 1.8], [19, 22, 2]],
    bite: "soft", lure: [0.3, 0.9], fight: { power: 22, stamina: 7, run: 0.45, shake: 0.5, jump: 0.25, dive: 0.6, speed: 3.0, charge: 0.3, thrash: 0.35, last: 0.4, first: "shake" },
    look: { shape: "trout", back: "#5a4a2a", body: "#b89a5a", belly: "#f0e4b8", fins: "#8a6a3a", accent: "#2a1a10", pattern: "redspots" },
    blurb: "A golden trout with red and black spots. It hides under the logs and feeds at dawn and dusk." },
  { id: "brooktrout", name: "Brook Trout", kg: [0.2, 1.2], trophy: 2.5, cm: [20, 45], rarity: 1.2, zones: {}, depth: [0.3, 2], hours: [],
    bite: "nibbler", lure: [0.2, 0.8], fight: { power: 28, stamina: 3.5, run: 0.3, shake: 0.4, jump: 0.2, dive: 0.3, speed: 2.2 },
    look: { shape: "trout", back: "#2e4a30", body: "#6a7a4a", belly: "#e87a3a", fins: "#d8603a", accent: "#e8d890", pattern: "spots" },
    blurb: "A small, bright trout with an orange belly. It lives near the banks and in the slow water." },
  { id: "hookjaw", name: "Old Hookjaw", article: "", kg: [20, 30], trophy: 38, cm: [115, 135], rarity: 0, legend: true, zones: {}, depth: [2, 8], hours: [[5, 8.5, 1]],
    bite: "slammer", lure: [0.4, 1.2], fight: { power: 17, stamina: 16.2, run: 0.9, shake: 0.6, jump: 0.2, dive: 0.5, speed: 4.0, last: 1, lastR: 12, first: "run", runLen: 2.2, deep: true, down: true, hold: 2, rubT: 1.4 },
    boss: { phases: [
      { name: "It jumps! Keep the rod low.", first: "walk", moves: { walk: 0.8, jump: 0.5, run: 0.6, thrash: 0 } },
      { at: 0.6, rest: 4, refill: 0.25, name: "It runs down the river! Steer it off the logs!", first: "cover", runLen: 2.5, moves: { run: 1, dive: 0.4, charge: 0.3 } },
      { at: 0.3, rest: 4, refill: 0.1, name: "It shakes its head! Hold the rod up.", first: "thrash", moves: { thrash: 0.8, charge: 0.4, run: 0.5 } } ] },
    look: { shape: "salmon", back: "#4a2a2a", body: "#8a4a3a", belly: "#c8b8a0", fins: "#4a3a30", accent: "#1a1010", pattern: "spots", kype: true },
    blurb: "The legend of Cedar River. An old chinook with a hooked jaw. It rises in a gold ring in the deep pool at dawn." },
];

// junk comes up with no fight: it drags like a weight
export const JUNK = [
  { id: "boot", name: "Old Boot", kg: [0.7, 0.9], look: { shape: "boot", body: "#4a3a2a", accent: "#2a2018" }, blurb: "Size 11. There is no foot in it. Good." },
  { id: "plunger", name: "The King's Plunger", kg: [0.5, 0.5], look: { shape: "plunger", body: "#c0302a", accent: "#e8c890" }, blurb: "The Porcelain King lost it in Loon Lake. He wants it back." },
  { id: "frisbee", name: "Pip's Frisbee", kg: [0.2, 0.2], look: { shape: "frisbee", body: "#f2d034", accent: "#e8552e" }, blurb: "Pip threw it off the cottage roof. Now it is back." },
];

export const byId = (id) => SPECIES.find((s) => s.id === id) || JUNK.find((j) => j.id === id) || null;
// length from weight: fish of one kind keep their shape, so length grows with the cube root of weight
export function lengthFor(sp, kg) {
  const [k0, k1] = sp.kg, [c0, c1] = sp.cm;
  const t = (Math.cbrt(kg) - Math.cbrt(k0)) / (Math.cbrt(k1) - Math.cbrt(k0) || 1);
  return Math.round(c0 + (c1 - c0) * t);
}
