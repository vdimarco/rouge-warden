// Light Years Home v3: the route home and Earth's clock (final.md 2.1, 4.3; story-calc/clock.mjs). Earth's date is
// today minus the route light-years still ahead, so each stop has a fixed aheadLy. The route runs through the
// story's twelve stops and three via points (Carina, a Sirius drop-out, Voyager 1). Chapter 1's stops are zones;
// later points are named by their objects.js id until their zones exist.
import { OBJECTS, AU_LY } from '../objects.js';
import { ALL_MILESTONES } from '../milestones.js';
import { milestoneAgo } from '../timeline.js';
import { galPos } from './skyplane.js';

const W = 'https://en.wikipedia.org/wiki/';

// Voyager 1 on 13 October 2026: RA 17h 14.4m, Dec +12.1°, 172.8 AU from the Sun (story-calc/clock.mjs). Not in
// objects.js: it is only a via point on the jump to Saturn.
export const VOYAGER_1 = Object.freeze({
  name: 'Voyager 1', pos: Object.freeze(galPos(258.6, 12.1, 172.8 * AU_LY)), source: W + 'Voyager_1',
});

// The route, in order: { id, object, zone }. zone is true for a place you drive in (a stop), false for a point a
// jump passes. The Andromeda edge (Chapter 1's last stop) and Chapter II's Andromeda share one point.
export const ROUTE = Object.freeze([
  { id: 'wall', object: 'start', zone: true },
  { id: 'coma', object: 'coma', zone: true },
  { id: 'virgo', object: 'virgo', zone: true },
  { id: 'andromeda-edge', object: 'andromeda', zone: true },
  { id: 'milky-way', object: 'mw-entry', zone: true },
  { id: 'carina', object: 'carina', zone: false },
  { id: 'orion', object: 'orion-nebula', zone: true },
  { id: 'betelgeuse', object: 'betelgeuse', zone: true },
  { id: 'pleiades', object: 'pleiades', zone: true },
  { id: 'sirius', object: 'sirius', zone: false },
  { id: 'proxima', object: 'proxima', zone: true },
  { id: 'voyager-1', object: null, zone: false },
  { id: 'saturn', object: 'saturn', zone: true },
  { id: 'jupiter', object: 'jupiter', zone: true },
  { id: 'moon', object: 'moon', zone: true },
  { id: 'earth', object: 'earth', zone: true },
].map(Object.freeze));

// Zone ids that share a route point with another id (Chapter II's Andromeda zone is where Chapter 1 ends).
const ALIAS = { andromeda: 'andromeda-edge' };

const posOfPoint = (p) => (p.object ? OBJECTS[p.object].pos : VOYAGER_1.pos);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** LEGS: [{ from, to, ly }] along ROUTE, straight lines between the points. */
export const LEGS = Object.freeze(ROUTE.slice(1).map((p, i) => Object.freeze({
  from: ROUTE[i].id, to: p.id, ly: dist(posOfPoint(ROUTE[i]), posOfPoint(p)),
})));

/** routeTotalLy: the whole trip, about 1.067 billion light-years. */
export const routeTotalLy = LEGS.reduce((s, l) => s + l.ly, 0);

const AHEAD = new Map();
{
  let acc = 0;
  AHEAD.set(ROUTE[ROUTE.length - 1].id, 0);
  for (let i = LEGS.length - 1; i >= 0; i--) {
    acc += LEGS[i].ly;
    AHEAD.set(LEGS[i].from, acc);
  }
}

const idOf = (id) => ALIAS[id] || id;

/** aheadLyAt(zoneId) → the route light-years still ahead at that stop (Earth's clock there), or null. */
export function aheadLyAt(zoneId) {
  const v = AHEAD.get(idOf(zoneId));
  return v === undefined ? null : v;
}

/** legOf(from, to) → the straight leg between two neighbouring route points, or null. */
export function legOf(from, to) {
  return LEGS.find((l) => l.from === idOf(from) && l.to === idOf(to)) || null;
}

/** The route point for a zone id, or null. */
export function pointOf(zoneId) {
  return ROUTE.find((p) => p.id === idOf(zoneId)) || null;
}

/** distanceFromEarthLy(zoneId): the straight line from that stop to Earth now. */
export function distanceFromEarthLy(zoneId) {
  const p = pointOf(zoneId);
  return p ? dist(posOfPoint(p), OBJECTS.earth.pos) : null;
}

/**
 * lightAgeAt(zoneId) → years: how old Earth's light is when it reaches that stop on the story clock. The ship's
 * Earth date there is today − aheadLy; the light left Earth a further distanceFromEarthLy years before that
 * (timeline.signalYear).
 */
export function lightAgeAt(zoneId) {
  const a = aheadLyAt(zoneId), d = distanceFromEarthLy(zoneId);
  return a === null || d === null ? null : a + d;
}

/**
 * lookHomeCard(zoneId, today?) → the Look Home postcard: the latest Earth card (milestones.js, EARLIER included)
 * at or before the date in the light that reaches that stop. today moves the calendar cards (timeline.js).
 */
export function lookHomeCard(zoneId, today) {
  const age = lightAgeAt(zoneId);
  if (age === null) return null;
  let best = null, bestAgo = Infinity;
  for (const m of ALL_MILESTONES) {
    const ago = milestoneAgo(m, today);
    if (ago >= age && ago < bestAgo) { best = m; bestAgo = ago; }
  }
  return best;
}

/**
 * setEarthClock(game, zoneData): Earth's clock as it reads on arrival at that stop (a pocket keeps its zone's).
 * For game.js's enter slot: main.js composes it with the other enter functions, so a game started straight in Coma
 * (the hook, a Continue) reads 330 million years ago, not the Wall's 1.07 billion.
 */
export function setEarthClock(game, zoneData) {
  if (!zoneData || zoneData.kind === 'pocket') return;
  const a = aheadLyAt(zoneData.id);
  if (a !== null) game.earth.aheadLy = a;
}
