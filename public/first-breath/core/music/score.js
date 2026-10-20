// First Breath: the score (openspec/changes/first-breath-score/contract.md). Pure data and pure functions: no DOM, no
// clocks, no randomness. Everything is computed once, here, at module load, from the cue files in ./cues/.
//
// THE STYLE. An original score in the idiom of Walter Murphy's Family Guy music ("Emission Impossible"): a theatrical
// studio orchestra with a big band inside it, played completely straight, as if the baby were the hero of a film.
// Brass voiced in close harmony with the lead trumpet on top, stabs on the "and" of the beat, rips and falls, timpani
// rolls into new sections, harp glissandos for wonder, swing for the caper and the show number, a "button" at the end.
// No existing melody is quoted; only the idiom is borrowed. music.test.mjs screens every tune against famous themes.
// The mix (each cue's loudness per level) is set in mix.js, applied when a cue is built.
//
// THE LEITMOTIF ("your" theme, kit.js LEITMOTIF, in C): C D G | E . . F | E D B C in a gallop (a quarter, two eighths,
// then the long note): a step and a fourth up, the leap of a sixth to E with F on the "and", and a turn home through the
// leading tone; then D E A | F . . G | A G E D, a step higher, open on the dominant. It is stated whole by four trumpets in the title, hidden in minor in the low
// brass of the spy chase (section C), broken into its head and sequenced upward in the battle (and stated whole in C
// major in its B section), and sung by a solo horn in F major, in three, in the ending.
//
// THE CUES (key, tempo, form after the intro; levels 0 → 1 → 2):
//   title   Overture       B-flat major 112  A B A2      curtain of low brass, then a march with the theme in four
//                                                      trumpets; B sings in G minor; A2 is the fanfare
//   swim    Spy chase      D minor 168       A B A C     falling-line string ostinato, dotted bass, bongo hats →
//                                                      trumpet spy tune → muted stabs, a rising horn line, snare drive
//   egg     Siege march    C minor 144       A B A2      march bass, pad, timpani → horn tune in three parts →
//                                                      trumpet stabs, string tremolo; boss: a flat-2 brass riff
//   split   Caper          G minor 120 swing A A2 B A3  walking bass, brushes, pizzicato → clarinet tune →
//                                                      a muted trumpet answering, trombone pads, ride
//   root    Expedition     E-flat major 132  A B A2 C    harp, bass, pad → horn tune and running strings →
//                                                      trumpet stabs, tremolo, snare drive
//   grow    Battle         A minor 152       A B A2 C    galloping strings → the theme in pieces, horns and trumpets
//                                                      → stabs, high strings; boss: choir, timpani, a dark riff
//   answer  Showstopper    G major 156 swing A A2 B A3  (locked to her beat) bass, brushes, high piano → clarinet
//                                                      and flute tune, ride → the shout chorus in three trumpets
//   turn    Last stand     E minor 160       A B C D     a climbing ostinato over a pedal, the key a step up each
//                                                      section → rising brass → stabs, timpani eighths
//   birth   Great escape   D major 176       A B A2 C    string drive and pumping bass → trumpet tune, horns in F
//                                                      → stabs, bells; it ends on the "light" stinger (the choir)
//   ending  Lullaby        F major 66 in 3   A B A2      a solo horn sings the theme over strings and harp; one
//                                                      level; it ends on the "warm" stinger
//
// THE DATA. CUES[id] = { id, name, key, tonic, bpm, swing, meter, sync, intro, loop, sections, end, ducks, levels,
// boss, plan }. A section is { bars, chords, layers }; a layer is { inst, level, role, gain, notes, off?, chorale? }
// with notes [beat, dur, midi, vel] from the section start. level is the lowest mood level that plays it, or "boss"
// (only while mood.boss). off: "boss" rests a layer while mood.boss (the tunes rest so the boss riff is heard).
// STINGERS[id] = { name, bpm, key, notes: [[beat, dur, midi, vel, inst], ...] }, written in C; stingerNotes(id, tonic)
// gives them in a cue's key. Two stingers beyond the contract's ten: "light" (birth's end: choir and a held chord)
// and "warm" (the ending's soft warm chord).
import { LEITMOTIF as THEME } from "./kit.js";
import { build as title } from "./cues/title.js";
import { build as swim } from "./cues/swim.js";
import { build as egg } from "./cues/egg.js";
import { build as split } from "./cues/split.js";
import { build as root } from "./cues/root.js";
import { build as grow } from "./cues/grow.js";
import { build as answer } from "./cues/answer.js";
import { build as turn } from "./cues/turn.js";
import { build as birth } from "./cues/birth.js";
import { build as ending } from "./cues/ending.js";
import { STINGER_DEFS } from "./stingers.js";
import { mixCue } from "./mix.js";

export const INSTRUMENTS = Object.freeze(["trumpet", "trombone", "horn", "tuba", "strings", "pizz", "contrabass", "harp",
  "glock", "clarinet", "flute", "piano", "choir", "timpani", "kick", "snare", "hat", "ride", "crash", "roll", "brush"]);
// Drum voices the engine synthesizes; their midi is 0 and ignored. Timpani is pitched and sampled.
export const DRUMS = Object.freeze(["kick", "snare", "hat", "ride", "crash", "roll", "brush"]);
// Sounding ranges (midi) the score keeps inside and the engine vendors samples over.
export const RANGES = Object.freeze({
  trumpet: Object.freeze([54, 84]), trombone: Object.freeze([40, 72]), horn: Object.freeze([41, 77]),
  tuba: Object.freeze([28, 58]), strings: Object.freeze([28, 96]), pizz: Object.freeze([28, 84]),
  contrabass: Object.freeze([28, 55]), harp: Object.freeze([36, 96]), glock: Object.freeze([72, 108]),
  clarinet: Object.freeze([50, 91]), flute: Object.freeze([60, 96]), piano: Object.freeze([36, 96]),
  choir: Object.freeze([48, 79]), timpani: Object.freeze([40, 57]),
});

export const LEITMOTIF = THEME;
export const CUE_ORDER = Object.freeze(["title", "swim", "egg", "split", "root", "grow", "answer", "turn", "birth", "ending"]);

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}

// Each cue is built the first time it is read (about 2 to 10 ms each), so importing the score costs nothing at boot.
// The same input always builds the same cue, and a built cue is mixed (mix.js: its layers' gains set per level),
// frozen and kept.
const errors = [];
const built = { title, swim, egg, split, root, grow, answer, turn, birth, ending };
const made = new Map();
const CUE_PROPS = {};
for (const id of CUE_ORDER) {
  CUE_PROPS[id] = {
    enumerable: true,
    get() { if (!made.has(id)) made.set(id, deepFreeze(mixCue(built[id](errors)))); return made.get(id); },
  };
}
export const CUES = Object.freeze(Object.defineProperties({}, CUE_PROPS));
export const STINGERS = deepFreeze(Object.fromEntries(Object.entries(STINGER_DEFS).map(([id, s]) => [id, { ...s, notes: s.notes }])));
// Problems the cue files found while parsing their own notation (a bar that does not add up, a bad token): builds
// every cue. The node check asserts this is empty.
export function scoreErrors() {
  for (const id of CUE_ORDER) void CUES[id];
  return errors.slice();
}

// The cue for a screen or a stage: a stage id, its index (0 to 7; 8 is the ending), or a screen name.
const SCREEN = Object.freeze({ title: "title", menu: "title", settings: "title", stages: "title", sources: "title",
  ending: "ending", result: "ending" });
export function cueFor(screenOrStage) {
  if (typeof screenOrStage === "number" && Number.isInteger(screenOrStage)) {
    return screenOrStage >= 0 && screenOrStage <= 8 ? CUE_ORDER[screenOrStage + 1] : null;
  }
  const k = String(screenOrStage);
  if (CUE_ORDER.includes(k) && k !== "title") return k;
  return SCREEN[k] || null;
}

// The section played at step n of a cue: step 0 is the intro, then the loop round and round.
export function sectionAt(cue, n) {
  const c = typeof cue === "string" ? CUES[cue] : cue;
  if (!c) return null;
  return n <= 0 ? c.intro : c.loop[(n - 1) % c.loop.length];
}
// A section's length in beats.
export function sectionBeats(cue, sectionId) {
  const c = typeof cue === "string" ? CUES[cue] : cue;
  const s = c && c.sections[sectionId];
  return s ? s.bars * c.meter : 0;
}

// Every section's notes in one list sorted by beat, made once.
const FLAT = new Map();
function flatOf(sec) {
  let f = FLAT.get(sec);
  if (f) return f;
  f = [];
  for (const [layer, l] of Object.entries(sec.layers)) {
    for (const [beat, dur, midi, vel] of l.notes) f.push({ beat, dur, midi, vel, inst: l.inst, gain: l.gain, layer, level: l.level, off: l.off || null });
  }
  f.sort((a, b) => a.beat - b.beat || (a.layer < b.layer ? -1 : a.layer > b.layer ? 1 : a.midi - b.midi));
  FLAT.set(sec, f);
  return f;
}

// Is a layer playing under a mood? Levels 0 to 2 play when mood.level reaches them; "boss" layers only while
// mood.boss; a layer marked off: "boss" rests while mood.boss. No mood means { level: 1 }.
export function layerOn(layer, mood) {
  const lv = mood && Number.isFinite(mood.level) ? mood.level : 1;
  const boss = !!(mood && mood.boss);
  if (layer.level === "boss") return boss;
  if (boss && layer.off === "boss") return false;
  return layer.level <= lv;
}

// The notes to play from a section in [fromBeat, toBeat) under a mood: a new list of
// { beat, dur, midi, vel, inst, gain, layer } sorted by beat (beats from the section start). Pure.
export function notesIn(cue, sectionId, fromBeat, toBeat, mood) {
  const c = typeof cue === "string" ? CUES[cue] : cue;
  const sec = c && c.sections && c.sections[sectionId];
  if (!sec || !(toBeat > fromBeat)) return [];
  const f = flatOf(sec);
  let lo = 0, hi = f.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (f[mid].beat < fromBeat - 1e-9) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < f.length && f[i].beat < toBeat - 1e-9; i++) {
    const n = f[i];
    if (!layerOn(n, mood)) continue;
    out.push({ beat: n.beat, dur: n.dur, midi: n.midi, vel: n.vel, inst: n.inst, gain: n.gain, layer: n.layer });
  }
  return out;
}

// A stinger's notes, as [beat, dur, midi, vel, inst], moved to a tonic (midi; its pitch class counts) when its key
// is "cue": the shift is -6 to +5 semitones. A note that would leave its range moves an octave back in.
export function stingerShift(tonic) {
  if (!Number.isFinite(tonic)) return 0;
  const s = ((Math.round(tonic) % 12) + 12) % 12;
  return s > 5 ? s - 12 : s;
}
export function stingerNotes(id, tonic = 60) {
  const st = STINGERS[id];
  if (!st) return [];
  const k = st.key === "cue" ? stingerShift(tonic) : 0;
  return st.notes.map(([b, d, m, v, inst]) => {
    if (m === 0 || !RANGES[inst]) return [b, d, m, v, inst];
    let x = m + k;
    const [lo, hi] = RANGES[inst];
    while (x > hi) x -= 12;
    while (x < lo) x += 12;
    return [b, d, x, v, inst];
  });
}
// A stinger's length in seconds (its last note's end at its own tempo).
export function stingerSeconds(id) {
  const st = STINGERS[id];
  if (!st) return 0;
  return Math.max(...st.notes.map((n) => n[0] + n[1])) * 60 / st.bpm;
}
