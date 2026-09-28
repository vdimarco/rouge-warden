// The map the game reads: it forwards to the current place (places.js). Loon Lake is the default.
// Units are meters. Y is up. The angler stands at the end of the stand at x = 0, z = 0, and faces the water (-z).
// +x is to the angler's right. The water surface is y = 0.
// height(x, z) > 0 is land (its height above the water). height(x, z) < 0 is water (minus its depth).
// setPlace(p) changes the place: DOCK, EYE and ROD change in place, and ROCKS, LILIES, REEDS and ZONE_NAMES are
// bound again, so every module that imports them sees the new place without any change.
import { PLACES, getPlace } from "./places.js";

export { rng, noise } from "./places/util.js";
// Loon Lake's own shapes, for the code that paints Loon Lake
export { POINT, ISLAND, WEEDS, PADS, pointDist, islandDist } from "./places/loon.js";

let P = PLACES.loon;

// the stand: where the angler stands, where the eye and the reel are
export const DOCK = { ...P.stand.dock };
export const EYE = { ...P.stand.eye };
export const ROD = { base: { ...P.stand.rod.base }, length: P.stand.rod.length };
// the props of the current place
export let ROCKS = P.props.rocks;
export let LILIES = P.props.lilies;
export let REEDS = P.props.reeds;
export let ZONE_NAMES = P.zoneNames;

// go to a place (a place or its id; anything else is Loon Lake). Returns the place.
export function setPlace(p) {
  P = typeof p === "string" ? getPlace(p) : p && p.stand && p.height ? p : PLACES.loon;
  Object.assign(DOCK, P.stand.dock);
  Object.assign(EYE, P.stand.eye);
  Object.assign(ROD.base, P.stand.rod.base);
  ROD.length = P.stand.rod.length;
  ROCKS = P.props.rocks;
  LILIES = P.props.lilies;
  REEDS = P.props.reeds;
  ZONE_NAMES = P.zoneNames;
  return P;
}
export const currentPlace = () => P;

// the map of the current place
export function height(x, z) { return P.height(x, z); }
export const depth = (x, z) => P.depth(x, z);
export const isLand = (x, z) => P.isLand(x, z);
export function onDock(x, z) { return P.onStand(x, z); }
// what kind of water a point is in: the fish choose by this
export function zone(x, z) { return P.zone(x, z); }
