// The places you can fish. Each place is a map in the same frame as Loon Lake: the angler stands at (0, 0) and faces
// the water (-z), +x is to the angler's right, and the water surface is y = 0. So fish movement, landing, the lure's
// home point, the aim line and the cameras work the same everywhere.
// A place is only the map: pure and deterministic (no DOM, no three.js), so node tests can read it.
// Who lives where, the gear and the legend are in fishing.js; the look is in world-look.js.
//
// A place:
//   id, name
//   stand: { dock: {x0, x1, z0, z1, deck}, eye: {x, y, z}, rod: { base: {x, y, z}, length }, kind: "dock" | "road" | "bar" | "wall" }
//     eye y = deck + 1.65, rod base y = deck + 0.85, and the rod is 2.3 m long at every place
//   height(x, z)     land above 0 (its height), water below 0 (minus its depth)
//   depth(x, z)      water depth, 0 on land
//   isLand(x, z), onStand(x, z)
//   zone(x, z)       the kind of water; zoneNames: { zone: "Name" } for the text
//   treeMin          land higher than this has trees on it (a cast catches in them)
//   flow             null, or (x, z) => {x, z}: the current in m/s
//   snags            [{x, z, r, top, kind: "stump" | "logs"}]: posts the line rubs on
//   snagNear(x, z)   the snags near a point (every snag within 6 m, from a 6 m grid)
//   rough            null, or (x, z) => true over rocky bottom
//   props            { rocks: [{x, z, r, top}], lilies: [{x, z, r, rot, flower}], reeds: [{x, z, n, h}],
//                      stumps: [{x, z, r, top, tall}], logs: [{ax, az, bx, bz, r, top}], boulders: [{x, z, r}] }
//   features         named shapes for painting the place (loon: point, island, weeds, pads, bay;
//                    stumps: bay, cove, flat, creekZ, road; river: nearZ, farZ, pool, eddy; sea: jetty, head, bar, light)
import { loon } from "./places/loon.js";
import { stumps } from "./places/stumps.js";
import { river } from "./places/river.js";
import { sea } from "./places/sea.js";
export { rng, noise } from "./places/util.js";

// the trail order: each place opens the next one
export const PLACE_IDS = ["loon", "stumps", "river", "sea"];
export const PLACES = { loon, stumps, river, sea };
// an unknown id (an old or broken save) gives Loon Lake
export const getPlace = (id) => (PLACE_IDS.includes(id) ? PLACES[id] : PLACES.loon);
