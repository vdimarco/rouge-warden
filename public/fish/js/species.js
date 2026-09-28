// The fish of Loon Lake, and the junk on its bottom. Data only: fish.js uses it for bites and fights,
// world.js uses the look to build each fish, and main.js uses the names and text.
//
// kg: usual weight range; trophy: the rare top weight. cm: length range (matches kg).
// zones: how much this fish likes each zone of lake.js (0 = never there).
// depth: the depth band (m) where it feeds. hours: time-of-day multipliers [from, to, x].
// bite: "nibbler" (many small taps, then a take), "slammer" (hits hard, no warning), "soft" (a light tick, easy to miss).
// fight: power = pull in newtons per kg of fish (before stamina); stamina = seconds of hard pulling at full strength;
//   run / shake / jump / dive = how often it does each move (0..1); speed = burst speed in m/s.
// lure: the retrieve speed (m/s) it likes best.
// look: shape one of "sunfish" | "perch" | "bass" | "walleye" | "pike" | "trout"; colors are CSS hex;
//   pattern one of "spots" | "bars" | "mottled" | "stripe" | "beans" | "plain" | "gold".
export const SPECIES = [
  {
    id: "pumpkinseed", name: "Pumpkinseed", kg: [0.08, 0.3], trophy: 0.45, cm: [10, 21], rarity: 1,
    zones: { pads: 3, weeds: 2.5, dock: 2.5, sand: 1 }, depth: [0.3, 3], hours: [],
    bite: "nibbler", lure: [0.2, 0.7],
    fight: { power: 30, stamina: 3, run: 0.05, shake: 0.2, jump: 0, dive: 0.1, speed: 1.2 },
    look: { shape: "sunfish", back: "#3d6a4a", body: "#7fa85a", belly: "#f2a33a", fins: "#5b7d45", accent: "#e8552e", pattern: "spots" },
    blurb: "A bright little sunfish. It lives in the lily pads. It pulls hard for its size.",
  },
  {
    id: "perch", name: "Yellow Perch", kg: [0.1, 0.5], trophy: 0.9, cm: [14, 33], rarity: 1,
    zones: { weeds: 3, sand: 2.5, dock: 2, pads: 1.5, dropoff: 1 }, depth: [0.5, 8], hours: [[6, 10, 1.3]],
    bite: "nibbler", lure: [0.2, 0.8],
    fight: { power: 26, stamina: 3, run: 0.1, shake: 0.25, jump: 0, dive: 0.2, speed: 1.3 },
    look: { shape: "perch", back: "#4b5a26", body: "#d9c04e", belly: "#f3ecc4", fins: "#e46a2a", accent: "#2e3a16", pattern: "bars" },
    blurb: "It is gold, with dark bars and orange fins. Perch swim in schools.",
  },
  {
    id: "rockbass", name: "Rock Bass", kg: [0.15, 0.55], trophy: 0.9, cm: [15, 28], rarity: 0.8,
    zones: { rocks: 4, dock: 1 }, depth: [0.5, 5], hours: [[18, 21, 1.3]],
    bite: "slammer", lure: [0.3, 0.9],
    fight: { power: 30, stamina: 3.5, run: 0.15, shake: 0.3, jump: 0, dive: 0.3, speed: 1.4 },
    look: { shape: "bass", back: "#43352a", body: "#8c6a44", belly: "#cdbb92", fins: "#6a4b30", accent: "#c8202a", pattern: "mottled" },
    blurb: "It has red eyes and a big mouth. It lives at the rocky point and hits hard.",
  },
  {
    id: "smallmouth", name: "Smallmouth Bass", kg: [0.4, 2.2], trophy: 3.5, cm: [25, 52], rarity: 0.75,
    zones: { rocks: 4, dropoff: 2, sand: 1 }, depth: [1, 9], hours: [[6, 10, 1.2], [17, 21, 1.3]],
    bite: "slammer", lure: [0.5, 1.3],
    fight: { power: 22, stamina: 6, run: 0.35, shake: 0.35, jump: 0.55, dive: 0.3, speed: 2.4 },
    look: { shape: "bass", back: "#4e4223", body: "#9a7c43", belly: "#e7dcbf", fins: "#7a6134", accent: "#c4302a", pattern: "bars" },
    blurb: "A bronze bass that jumps. When it jumps, lower the rod, or it throws the hook.",
  },
  {
    id: "largemouth", name: "Largemouth Bass", kg: [0.4, 2.8], trophy: 4.5, cm: [25, 58], rarity: 0.7,
    zones: { pads: 4, weeds: 3, dock: 1 }, depth: [0.5, 4], hours: [[5, 9, 1.3], [18, 21, 1.4]],
    bite: "slammer", lure: [0.3, 1.0],
    fight: { power: 20, stamina: 5.5, run: 0.3, shake: 0.35, jump: 0.35, dive: 0.45, speed: 2.1 },
    look: { shape: "bass", back: "#34502a", body: "#6f8c48", belly: "#ecebd0", fins: "#52683a", accent: "#27361c", pattern: "stripe" },
    blurb: "It waits under the lily pads. When it runs for the weeds, steer it out.",
  },
  {
    id: "walleye", name: "Walleye", kg: [0.5, 3], trophy: 6, cm: [33, 66], rarity: 0.7,
    zones: { dropoff: 4, deep: 2, rocks: 1, sand: 0.5 }, depth: [3, 14], hours: [[5, 8, 1.6], [18, 21, 2]],
    bite: "soft", lure: [0.2, 0.7],
    fight: { power: 18, stamina: 5.5, run: 0.2, shake: 0.5, jump: 0, dive: 0.6, speed: 1.8 },
    look: { shape: "walleye", back: "#55552a", body: "#a79a4a", belly: "#f1efe0", fins: "#8b8440", accent: "#e9e9d0", pattern: "mottled" },
    blurb: "Its eyes see well in the dark. It bites softly on the drop-off at dawn and dusk.",
  },
  {
    id: "pike", name: "Northern Pike", kg: [1, 5.5], trophy: 10, cm: [50, 100], rarity: 0.55,
    zones: { weeds: 3, pads: 2, dropoff: 1.2 }, depth: [0.5, 6], hours: [[9, 16, 1.2]],
    bite: "slammer", lure: [0.6, 1.6],
    fight: { power: 20, stamina: 7, run: 0.55, shake: 0.55, jump: 0.15, dive: 0.2, speed: 3.2 },
    look: { shape: "pike", back: "#2f4a2a", body: "#5f7c44", belly: "#e8e9cc", fins: "#8a6a3a", accent: "#e5e3a2", pattern: "beans" },
    blurb: "A long green fish that hides in the weeds. It hits hard and shakes its head. Keep the line tight.",
  },
  {
    id: "laketrout", name: "Lake Trout", kg: [1, 5.5], trophy: 12, cm: [45, 90], rarity: 0.5,
    zones: { deep: 4, dropoff: 0.8 }, depth: [8, 30], hours: [[5, 9, 1.4]],
    bite: "soft", lure: [0.4, 1.1],
    fight: { power: 19, stamina: 8, run: 0.6, shake: 0.2, jump: 0, dive: 0.7, speed: 2.8 },
    look: { shape: "trout", back: "#46574f", body: "#76877d", belly: "#eef0e4", fins: "#c9a07a", accent: "#e6ead8", pattern: "spots" },
    blurb: "It lives in the cold, deep water far out. Cast long, and let it run.",
  },
  {
    id: "muskie", name: "Muskellunge", kg: [4, 13], trophy: 22, cm: [80, 135], rarity: 0.15,
    zones: { weeds: 1, dropoff: 1, rocks: 0.8, pads: 0.6 }, depth: [1, 9], hours: [[17, 21, 1.8]],
    bite: "slammer", lure: [0.8, 1.8],
    fight: { power: 16, stamina: 9, run: 0.7, shake: 0.5, jump: 0.3, dive: 0.4, speed: 3.6 },
    look: { shape: "pike", back: "#4c4c30", body: "#9a9468", belly: "#ece8d2", fins: "#9a5a38", accent: "#3a3a22", pattern: "bars" },
    blurb: "Anglers call it the fish of ten thousand casts. At the dock it makes one last run.",
  },
  {
    id: "golden", name: "Golden Loon Bass", kg: [2, 4.5], trophy: 6, cm: [40, 58], rarity: 0, legend: true,
    zones: {}, depth: [0.5, 6], hours: [[5, 8, 1], [18, 21, 1]],
    bite: "slammer", lure: [0.4, 1.4],
    fight: { power: 24, stamina: 9, run: 0.5, shake: 0.4, jump: 0.5, dive: 0.3, speed: 3 },
    look: { shape: "bass", back: "#c98a10", body: "#ffc830", belly: "#fff1b0", fins: "#ffdf6a", accent: "#fff8d8", pattern: "gold" },
    blurb: "This is the legend of Loon Lake. It rises in a gold ring far out, only at dawn and dusk.",
  },
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
