// Gloam Downs: the explorer's two sets of places. The downs (ORDER, five places) and the Gilt Lattice (LATTICE, three explorer places).
// The names, the next place in a set, the rows of the Map, its count line and the choice of the first place from ?place=. No DOM, so the
// Node test reads the same rows and texts that the page shows; main.js builds the Map from them. The run (?run) does not use this file.
import { ORDER, LATTICE, latticeOpen, wispCount, latticeWisps } from './save.js';
import { NUMERAL, NAMES } from './screens.js';

export const LATTICE_NAMES = { piazza: 'The Vanishing Piazza', cupola: 'The Broken Cupola', orrery: 'The Orrery Isles' };
export const SET_TITLES = { downs: 'The downs', lattice: 'The Gilt Lattice' };

export const isLattice = id => LATTICE.includes(id);
export const setOf = id => (ORDER.includes(id) ? ORDER : LATTICE.includes(id) ? LATTICE : null);
export const placeName = id => NAMES[id] || LATTICE_NAMES[id] || id;
// the next place in the same set, or null after the last
export function nextOf(id) {
  const set = setOf(id);
  if (!set) return null;
  return set[set.indexOf(id) + 1] ?? null;
}
// a place the player can go to now: a downs place reached, or a Lattice place open by its chain
export const isOpen = (s, id) => (ORDER.includes(id) ? s.reached.includes(id) : latticeOpen(s, id));

// one row of the Map: { id, n, name, open, lit, wisps, note, current }
function rowOf(s, id, i, current) {
  const open = isOpen(s, id), lit = open && s.lit[id] === true;
  return {
    id, n: NUMERAL[i], name: open ? placeName(id) : 'Locked', open, lit,
    wisps: open ? `◆ ${s.wisps[id]?.length || 0}/5` : '',
    note: open ? (lit ? 'Beacon lit' : 'Beacon dark') : 'Light the beacon before it',
    current: id === current
  };
}
// the Map's two groups, the downs first, then the Lattice
export function mapGroups(s, current) {
  return [
    { set: 'downs', title: SET_TITLES.downs, rows: ORDER.map((id, i) => rowOf(s, id, i, current)) },
    { set: 'lattice', title: SET_TITLES.lattice, rows: LATTICE.map((id, i) => rowOf(s, id, i, current)) }
  ];
}
export const mapLine = s => `Wisps: ${wispCount(s)} of 25 on the downs, ${latticeWisps(s)} of 15 in the Lattice.`;

// the small line over the name on the arrival card
const DOWNS_LINES = ['The first place', 'The second place', 'The third place', 'The fourth place', 'The last place'];
export function arriveLine(id) {
  const i = ORDER.indexOf(id);
  if (i >= 0) return `${NUMERAL[i]} · ${DOWNS_LINES[i]}`;
  const k = LATTICE.indexOf(id);
  return k >= 0 ? `${NUMERAL[k]} · ${SET_TITLES.lattice}` : '';
}

// the HUD hint of an explorer place: its own hint until its beacon burns, then where to go
export function hintOf(s, id, hint, beaconLit) {
  if (!beaconLit) return hint || 'Light the beacon on the summit.';
  if (isLattice(id)) return LATTICE.every(p => s.lit[p]) ? 'Every beacon of the Lattice burns. Use the map.' : 'The way is open. Use the map, or walk on.';
  const others = id === ORDER.at(-1) && ORDER.some(p => !s.lit[p]); // the last place lit before the rest
  return others ? 'Other beacons are still dark. Use the map.' : 'The way is open. Use the map, or walk on.';
}

// the first place of a page load: ?place=<id> when that place is open, else where the player was. q: URLSearchParams, or the id
export function startPlace(q, s) {
  const id = typeof q === 'string' ? q : q?.get?.('place');
  if (id && (ORDER.includes(id) || LATTICE.includes(id)) && isOpen(s, id)) return id;
  return s.at || ORDER[0];
}
