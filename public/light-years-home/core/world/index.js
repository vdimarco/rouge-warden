// Light Years Home v3: the world's registry (final.md 4.3). Zone modules load on demand (main.js imports the next
// one when an exit gate opens); jumps, missions, lines and fact cards are small and load with the game. Round 1
// has the Wall and Coma City; Virgo, M87's jet and the Andromeda edge come in Round 2.
import { JUMPS, JUMP_LIST, jumpFrom } from './jumps.js';
import { MISSIONS, missionById } from './missions/ch1.js';
import { LINES, LINE_LIST, lineById, OPENING, REACTIONS } from './lines/ch1.js';
import { FACTS, FACT_LIST, factById } from './facts.js';
import { LEGS, ROUTE, routeTotalLy, aheadLyAt, lightAgeAt, lookHomeCard, setEarthClock } from './legs.js';

/** ZONES: zone id → () => import of its module (default export: the zone data). */
export const ZONES = Object.freeze({
  wall: () => import('./zones/wall.js'),
  coma: () => import('./zones/coma.js'),
});

export const ZONE_IDS = Object.freeze(Object.keys(ZONES));
export const hasZone = (id) => Object.prototype.hasOwnProperty.call(ZONES, id);

/** loadZone(id) → Promise<zoneData>. Rejects for a zone this build does not have yet. */
export function loadZone(id) {
  if (!hasZone(id)) return Promise.reject(new Error(`no zone '${id}' in this build`));
  return ZONES[id]().then((m) => m.default);
}

export {
  JUMPS, JUMP_LIST, jumpFrom, MISSIONS, missionById, LINES, LINE_LIST, lineById, OPENING, REACTIONS, FACTS,
  FACT_LIST, factById, LEGS, ROUTE, routeTotalLy, aheadLyAt, lightAgeAt, lookHomeCard, setEarthClock,
};
