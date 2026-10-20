// First Breath score: the mix (openspec/changes/first-breath-score/contract.md). Pure: plain numbers applied once, when
// a cue is built. The engine has no per-cue gain, so each cue's loudness at each mood level is set here by trimming
// its layers' gains in dB. A trim that would lift a gain past 1 puts the rest into the notes' velocities, through the
// engine's velocity curve (ui/music.js velGain, copied below because core cannot import ui).
//
// How the numbers were found: every cue rendered offline through ui/music.js and ui/sound.js with the real samples,
// the whole loop at each level, the score alone, and measured with ffmpeg's ebur128 (integrated loudness of the loop
// after the intro). The targets, in LUFS on that render:
//   level 0  about -28.5   (the bed: it must still be heard on a phone, so its middle is lifted and its bass trimmed)
//   level 1  about -24.5   (the tune)
//   level 2  about -22.5   (stabs, drive: 1.5 to 2.5 LU over level 1, busier more than louder)
//   boss     about -22
//   answer   1 LU under the others at each level (stage 6's lane sounds sit on top of it)
//   title    about -23.5   (it plays level 1, on the menus, with no heart under it)
//   ending   about -32.5   (the lullaby: softer than any stage's bed)
// Her heart sits near -19 LUFS through the same chain, so even level 2 stays a few LU under it.

// ui/music.js velGain: velocity 1 → 0 dB, 0.5 → about -9 dB.
export const VG = (v) => 0.06 + 0.94 * Math.pow(Math.max(0, Math.min(1, v)), 1.6);
const VGinv = (g) => (g <= 0.06 ? 0.001 : Math.pow(Math.min(1, (g - 0.06) / 0.94), 1 / 1.6));
const r3 = (x) => Math.round(x * 1000) / 1000;

// Every cue: the contrabass and the kick 2 to 3 dB down and the level-0 pads and ostinatos 2 dB up, so the bed has a
// middle a phone speaker can play (before this the level-0 bed carried 15 to 23 dB more energy under 120 Hz than in
// the 1 to 3 kHz band).
export const ALL = Object.freeze({ inst: { contrabass: -3, kick: -2 }, bed: { harmony: 2, ostinato: 2 } });

// Per cue: dB by layer level (0, 1, 2, "boss"), by instrument, by layer id, and for the intro's layers. They add up per
// layer. The intro trims keep a short tutti intro (grow's hits, birth's run and roll) from jumping 5 LU over the loop.
export const MIX = Object.freeze({
  title: { level: { 0: 1, 1: -2 }, layer: { pad: 4 } },
  swim: { level: { 0: 3.5, 1: 1.5, 2: 4 }, layer: { bass: -1, pad: 5 } },
  egg: { level: { 0: -1, 1: -2.5, 2: 5, boss: -1 }, layer: { pad: 6 }, intro: -1 },
  split: { level: { 0: 1.5, 1: 3.5, 2: 7 }, layer: { bass: -2, pizz: 3 } },
  root: { level: { 0: 3.5, 1: -1, 2: 3.5 } },
  grow: { level: { 0: 4, 1: -3.5, 2: 4.5, boss: 0 }, layer: { bass: -2, gallop: 1, pad: 6 }, intro: -4 },
  answer: { level: { 0: 6, 1: 1, 2: -0.5 }, layer: { bass: -2, plink: 3 } },
  turn: { level: { 0: 3.5, 1: -3.5, 2: 0 } },
  birth: { level: { 0: 2.5, 1: -3.5, 2: 6 }, intro: -4 },
  ending: { level: { 0: -1 } },
});

// Stinger notes [beat, dur, midi, vel, inst] made db louder or softer through their velocities (a stinger has no
// layer gain). Measured alone through the same chain, the grand ones (win, glowing) sat 7 LU over a cue at level 1 and
// the gift's harp and bells 7 LU under it; these trims bring them to about 4 LU over and 2 LU under.
export function louder(notes, db) {
  if (!db) return notes;
  const k = Math.pow(10, db / 20);
  return notes.map(([b, d, m, v, inst]) => [b, d, m, r3(Math.max(0.001, VGinv(Math.min(1, VG(v) * k)))), inst]);
}

// A layer trimmed by db: the gain takes it up to 1, the velocities take the rest (each note at most velocity 1).
export function trimLayer(layer, db) {
  if (!db) return layer;
  const want = layer.gain * Math.pow(10, db / 20);
  if (want <= 1) return { ...layer, gain: r3(Math.max(0.001, want)) };
  const k = want;
  return { ...layer, gain: 1, notes: layer.notes.map(([b, d, m, v]) => [b, d, m, r3(Math.max(0.001, VGinv(Math.min(1, VG(v) * k))))]) };
}

// The dB a layer gets in a cue: the cue's level trim, the instrument and layer trims, and the shared ones.
export function layerDb(id, layerId, layer, intro = false) {
  const p = MIX[id] || {};
  let db = intro ? p.intro || 0 : 0;
  db += (p.level && p.level[layer.level]) || 0;
  db += (p.inst && p.inst[layer.inst]) || 0;
  db += (p.layer && p.layer[layerId]) || 0;
  db += ALL.inst[layer.inst] || 0;
  if (layer.level === 0) db += ALL.bed[layer.role] || 0;
  return db;
}

// A built cue with its mix applied (a new object; the cue files' output is not changed).
export function mixCue(cue) {
  const sections = {};
  for (const [sid, s] of Object.entries(cue.sections)) {
    const layers = {};
    for (const [lid, l] of Object.entries(s.layers)) layers[lid] = trimLayer(l, layerDb(cue.id, lid, l, sid === cue.intro));
    sections[sid] = { ...s, layers };
  }
  return { ...cue, sections };
}
