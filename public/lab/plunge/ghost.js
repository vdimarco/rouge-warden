// Ghosts for Take the Plunge. A run is its seed plus the ticks where the input flipped (hold, let go, hold...), so it
// fits in a link: a version byte, the seed, how long it ran, how far it got, the flyer's initials, then the gaps between
// flips as varints, all in base64url. The sim is exact, so replaying the flips flies the same run again.
import { Writer, Reader, toB64u, fromB64u } from "../kit/rng.js";
import { makeWorld, newState, step, distance } from "./sim.js";

// The version goes up each time the sim changes, because the old flips do not fly the same run in a new sim.
// 2: a touch on a lake bed costs speed once, and a thud keeps more speed.
export const GHOST_V = 2;
const MAX_TICKS = 120 * 60 * 30;   // half an hour of flying is more than any run

export function encodeGhost({ seed, flips, ticks, dist, name = "" }) {
  const w = new Writer().u8(GHOST_V).u32(seed).uvar(ticks).uvar(Math.round(dist * 10)).str(String(name).toUpperCase().slice(0, 3), 3).uvar(flips.length);
  let prev = 0;
  for (const f of flips) { w.uvar(f - prev); prev = f; }
  return toB64u(w.bytes());
}

// A link of any version so far, or null for anything that is not a ghost. Versions 1 and 2 have the same layout.
function parse(str) {
  const b = fromB64u(str);
  if (!b || b.length < 8) return null;
  const r = new Reader(b);
  const v = r.u8();
  if (v < 1 || v > GHOST_V) return null;
  const seed = r.u32(), ticks = r.uvar(), dist = r.uvar() / 10, name = r.str(3), n = r.uvar();
  if (r.bad || ticks > MAX_TICKS || n > ticks + 1) return null;
  const flips = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const d = r.uvar();
    if (r.bad || (i > 0 && d === 0)) return null;
    prev += d;
    flips.push(prev);
  }
  if (!r.done || prev > ticks + 1) return null;
  return { v, seed, ticks, dist, name, flips };
}

// the ghost, or null for anything that is not one of this version
export function decodeGhost(str) {
  const g = parse(str);
  if (!g || g.v !== GHOST_V) return null;
  return { seed: g.seed, ticks: g.ticks, dist: g.dist, name: g.name, flips: g.flips };
}

// A ghost link from an older version: { v, seed, dist, name }, or null. Its flips do not fly the same run in this
// version, so it cannot race. Its lakes and its distance are still good.
export function oldGhost(str) {
  const g = parse(str);
  if (!g || g.v >= GHOST_V) return null;
  return { v: g.v, seed: g.seed, dist: g.dist, name: g.name };
}

// The input at a tick, from a list of flips. It only walks forward, like the run it plays back.
export class Tape {
  constructor(flips) { this.f = flips; this.i = 0; this.on = false; }
  at(tick) {
    while (this.i < this.f.length && this.f[this.i] <= tick) { this.on = !this.on; this.i++; }
    return this.on;
  }
}

// Records the flips of a live run: call with the input just before each step.
export class Recorder {
  constructor() { this.flips = []; this.on = false; }
  feed(tick, tuck) { if (tuck !== this.on) { this.on = tuck; this.flips.push(tick); } }
}

// Plays a ghost to its end with no pictures. Returns the final state.
export function replay(g, world = makeWorld(g.seed)) {
  const s = newState(), tape = new Tape(g.flips);
  while (s.alive && s.tick < g.ticks) step(s, world, tape.at(s.tick + 1));
  return { s, dist: distance(s) };
}

// The race with a ghost, as a line for the end card. dist is how far you flew; gs is the ghost's state when your run
// ended, or null. The gap is to the distance the ghost recorded. The ghost can still be in the air when winter
// catches you, so where it is at that moment says nothing about how far it flew.
const fmt = (m) => Math.round(m).toLocaleString("en-CA") + " m";
export function raceLine(dist, ghost, gs = null) {
  const who = ghost.name ? `${ghost.name}'s ghost` : "the ghost";
  let line = dist >= ghost.dist ? `You beat ${who} by ${fmt(dist - ghost.dist)}.` : `${who[0].toUpperCase() + who.slice(1)} flew ${fmt(ghost.dist - dist)} farther.`;
  if (gs && !gs.alive && Math.abs(distance(gs) - ghost.dist) > 1) line += " (That ghost came from another browser, so it drifted.)";
  return line;
}
