// Light Years Home v3: which round of the build is live (decisions.md 7). Round 1 is the toy, the Wall, the jump and
// Coma City as a free-drive zone with scans and Look Home. Coma's missions, races, stunts and Vela are written as data
// already, each marked round: 2, and stay out of play until Round 2 turns them on. roundView(zoneData, round) is the
// zone as a round plays it: the same data without the later rounds' events, rings, actors and missions. main.js loads
// every zone through it (world/index.js loadZone); ?round=2 shows the next round's work in progress.
import { missionById } from './missions/ch1.js';

export const ROUND = 1;

/** liveIn(item, round) → true when a piece of data (an event, ring, actor or mission) plays in this round. */
export const liveIn = (item, round = ROUND) => !item || typeof item !== 'object' || (item.round ?? 1) <= round;

const VIEWS = new WeakMap();

/** roundView(zoneData, round) → the zone without what later rounds add (the same object when nothing is cut). */
export function roundView(zoneData, round = ROUND) {
  if (!zoneData || typeof zoneData !== 'object') return zoneData;
  let byRound = VIEWS.get(zoneData);
  if (!byRound) { byRound = new Map(); VIEWS.set(zoneData, byRound); }
  if (byRound.has(round)) return byRound.get(round);
  const keep = (list) => (Array.isArray(list) ? list.filter((x) => liveIn(x, round)) : list);
  const missions = Array.isArray(zoneData.missions)
    ? zoneData.missions.filter((id) => liveIn(missionById(id), round)) : zoneData.missions;
  const out = { ...zoneData, events: keep(zoneData.events), rings: keep(zoneData.rings), actors: keep(zoneData.actors),
    missions };
  const same = ['events', 'rings', 'actors', 'missions'].every((k) => (out[k]?.length ?? 0) === (zoneData[k]?.length ?? 0));
  const view = same ? zoneData : out;
  byRound.set(round, view);
  return view;
}

/** missionsIn(list, round) → the missions that play in this round. */
export const missionsIn = (list, round = ROUND) => (list || []).filter((m) => liveIn(m, round));
