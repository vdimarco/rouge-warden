// Who lives where: the fish, gear, cover and legend of each place. Data only (no DOM, no three.js), so node can test it.
// places.js holds the maps; this file holds what swims in them. fish.js reads it for bites and fights.
//
// gear: g = how much stronger the line, rod and reel are than Loon Lake's (every line force × g); spool = m of line
//   on the reel; line = the name the game shows.
// goodZones: zones where fish bite more often (BITE.GOOD). junkR: junk is more common this close to the angler (m).
// junk: the junk ids on this bottom. rings: rising fish show this far out (m).
// legend: its species id, the hours its gold ring shows, how far out the ring is (m), and the zone it rises in.
// fish: each species that lives here, with its zones, and rarity / depth / hours when they differ from species.js.
// cover: the kinds of cover each fish runs for when hooked.
// coverAt: where each kind of cover is, and how it rubs the line: "zone" = the fish is in that zone,
//   "snag" = the line touches a stump or a log post (snag: look this far for one), "rough" = rough bottom
//   (feet: the rocks at the angler's feet, for a fish this close).
import { SPECIES, byId } from "./species.js";

const LOON_IDS = ["pumpkinseed", "perch", "rockbass", "smallmouth", "largemouth", "walleye", "pike", "laketrout", "muskie"];
const fromSpecies = (ids) => Object.fromEntries(ids.map((id) => { const s = byId(id); return [id, { zones: s.zones, rarity: s.rarity, depth: s.depth, hours: s.hours }]; }));
export const FISHING = {
  loon: { gear: { g: 1, spool: 150, line: "10 lb line" }, goodZones: ["pads", "weeds", "rocks", "dropoff", "dock", "island"], junkR: 12, junk: ["boot", "plunger", "frisbee"],
    rings: [8, 45], legend: { id: "golden", hours: [[5, 8], [18, 21]], ring: [40, 50], zone: null }, fish: fromSpecies(LOON_IDS),
    cover: { largemouth: ["weeds", "pads"], pike: ["weeds", "pads"], smallmouth: ["rocks"], golden: ["pads", "weeds"] },
    coverAt: { weeds: { at: [{ x: -26, z: -16 }], rub: "zone", zones: ["weeds"] }, pads: { at: [{ x: -26, z: -16 }], rub: "zone", zones: ["pads"] }, rocks: { at: [{ x: 50, z: -22 }], rub: "zone", zones: ["rocks"] } } },
  stumps: { gear: { g: 2, spool: 150, line: "20 lb braid" }, goodZones: ["timber", "pads", "channel", "lane"], junkR: 10, junk: ["boot"],
    rings: [10, 45], legend: { id: "whiskers", hours: [[20.5, 24]], ring: [30, 45], zone: "channel" },
    fish: { pumpkinseed: { rarity: 0.5, zones: { pads: 2, flat: 1 } }, largemouth: { rarity: 1, zones: { timber: 4, pads: 3, lane: 1.2, channel: 0.8 }, depth: [0.5, 5] },
      crappie: { zones: { timber: 4, lane: 1 } }, bowfin: { zones: { pads: 3, timber: 1.5, flat: 1 } }, gar: { zones: { flat: 4, open: 1.5, pads: 1 } },
      catfish: { zones: { channel: 4, lane: 2, timber: 1, open: 1 } } },
    cover: { largemouth: ["stumps", "pads"], crappie: ["stumps"], bowfin: ["pads", "stumps"], catfish: ["stumps"], whiskers: ["stumps"] },
    coverAt: { stumps: { snag: 14, rub: "snag" }, pads: { at: [{ x: -42, z: -16 }], rub: "zone", zones: ["pads"] } } },
  river: { gear: { g: 2, spool: 180, line: "20 lb line" }, goodZones: ["pocket", "pool", "logs", "eddy", "riffle"], junkR: 8, junk: ["boot"],
    rings: [10, 45], legend: { id: "hookjaw", hours: [[5, 8.5]], ring: [30, 48], zone: "pool" },
    fish: { smallmouth: { rarity: 0.6, zones: { pocket: 3, eddy: 1.5, riffle: 1, run: 0.6 } }, walleye: { rarity: 0.5, zones: { pool: 2, tail: 2, eddy: 1 } },
      steelhead: { zones: { run: 3, pocket: 3, riffle: 2, tail: 2, pool: 1 } }, chinook: { zones: { pool: 4, run: 1.5, tail: 1 } },
      browntrout: { zones: { logs: 4, eddy: 2, pocket: 2, bank: 1 } }, brooktrout: { rarity: 1.2, zones: { bank: 3, eddy: 3, riffle: 2, run: 1.2 } } },
    cover: { steelhead: ["logs"], chinook: ["logs"], browntrout: ["logs"], hookjaw: ["logs"] },
    coverAt: { logs: { at: [{ x: -37, z: -13 }], rub: "snag" } } },
  sea: { gear: { g: 3, spool: 110, line: "30 lb line" }, goodZones: ["wall", "ledge", "channel", "bar"], junkR: 10, junk: ["boot"],
    rings: [20, 50], legend: { id: "bigblue", hours: [[5, 8], [18, 21]], ring: [40, 50], zone: "channel" },
    fish: { mackerel: { rarity: 0.5, zones: { sand: 2, channel: 2.5, open: 2, bar: 1 } }, pollock: { zones: { ledge: 3, wall: 2.5, channel: 1.5, sand: 1 } },
      striper: { zones: { wall: 3, bar: 3, ledge: 2, sand: 1 } }, bluefish: { zones: { channel: 3, open: 2, bar: 2, sand: 1 } },
      cod: { zones: { channel: 3, ledge: 2, open: 2.5, sand: 0.8 } } },
    cover: { striper: ["wall"], pollock: ["wall", "ledge"], cod: ["ledge"], bigblue: ["wall"] },
    coverAt: { wall: { feet: 16, rub: "rough" }, ledge: { at: [{ x: 40, z: -19 }], rub: "rough" } } },
};
// a place, or its id, to its table (Loon Lake for anything unknown)
export const fishingOf = (p) => FISHING[typeof p === "string" ? p : p && p.id] || FISHING.loon;
// the fish that bite here: [[sp, {zones, rarity, depth, hours}]] in SPECIES order, legends left out,
// so a pick from this list is the same for the same random numbers
export function ecology(id) { const t = fishingOf(id).fish; return SPECIES.filter((s) => !s.legend && t[s.id]).map((s) => [s, { zones: t[s.id].zones, rarity: t[s.id].rarity ?? s.rarity, depth: t[s.id].depth || s.depth, hours: t[s.id].hours || s.hours }]); }
// every id that can come up here: its fish, its legend, its junk (the world builds these, and frees the rest)
export function placeSpecies(id) { const F = fishingOf(id); return [...ecology(id).map(([s]) => s.id), F.legend.id, ...F.junk]; }
