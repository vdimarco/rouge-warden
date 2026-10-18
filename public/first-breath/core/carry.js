// First Breath: the carry between stages (design.md 5.5, 16.7). One plain object passes from result().carryOut to
// the next create(seed, carryIn, opts). Every field has a default, so any stage runs alone. Pure.
//
// Contract choices: mergeCarry(prev, out) starts from DEFAULT_CARRY, takes each known field from prev, then from out,
// and keeps a value only when it has the right type and range (else the earlier one stays); sperm merges field by
// field; song.notes must be 16 finite MIDI numbers and song.lit a 16-bit mask of the notes you answered.

// A fixed 16-note pentatonic lullaby (MIDI on G major pentatonic, G3 to D4: about 196 to 294 Hz).
export const DEFAULT_SONG = Object.freeze([55, 57, 59, 57, 55, 57, 62, 59, 57, 55, 57, 59, 62, 59, 57, 55]);

export const DEFAULT_CARRY = Object.freeze({
  sparks: 0,
  sperm: Object.freeze({ hue: 0.11, place: 3, glow: 0.5 }),
  nestleX: 0,
  treeSeed: null,
  song: Object.freeze({ notes: DEFAULT_SONG, lit: 0 }),
  turnDir: 1,
});

const num = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function take(c, src) {
  if (!src || typeof src !== "object") return;
  if (num(src.sparks) && src.sparks >= 0) c.sparks = Math.floor(src.sparks);
  if (src.sperm && typeof src.sperm === "object") {
    const s = src.sperm;
    if (num(s.hue)) c.sperm.hue = s.hue;
    if (num(s.place) && s.place >= 1 && s.place <= 20) c.sperm.place = Math.round(s.place);
    if (num(s.glow)) c.sperm.glow = clamp(s.glow, 0, 1);
  }
  if (num(src.nestleX)) c.nestleX = clamp(src.nestleX, -1, 1);
  if (src.treeSeed === null || (num(src.treeSeed) && src.treeSeed >= 0)) c.treeSeed = src.treeSeed === null ? null : src.treeSeed >>> 0;
  if (src.song && typeof src.song === "object") {
    const n = src.song.notes;
    if (Array.isArray(n) && n.length === 16 && n.every(num)) c.song.notes = n.slice();
    if (num(src.song.lit) && src.song.lit >= 0) c.song.lit = Math.floor(src.song.lit) & 0xffff;
  }
  if (src.turnDir === 1 || src.turnDir === -1) c.turnDir = src.turnDir;
}

// → a new carry: defaults, then prev, then out; unknown fields are dropped.
export function mergeCarry(prev, out) {
  const c = {
    sparks: DEFAULT_CARRY.sparks,
    sperm: { ...DEFAULT_CARRY.sperm },
    nestleX: DEFAULT_CARRY.nestleX,
    treeSeed: DEFAULT_CARRY.treeSeed,
    song: { notes: DEFAULT_SONG.slice(), lit: DEFAULT_CARRY.song.lit },
    turnDir: DEFAULT_CARRY.turnDir,
  };
  take(c, prev);
  take(c, out);
  return c;
}
