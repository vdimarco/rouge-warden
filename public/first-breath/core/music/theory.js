// First Breath score: the small music toolkit the cues are written with (openspec/changes/first-breath-score). Pure:
// plain functions over plain data, computed once at module load. No DOM, no clocks, no randomness.
//
// A note is [beat, dur, midi, vel]: beat and dur in quarter notes from the start of its section, vel 0..1. A drum note
// has midi 0 (timpani is pitched). A chart is a list of chords { beat, dur, root, bass, iv, sym }: root and bass are
// pitch classes (0 = C), iv the chord's intervals above its root.

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const EPS = 1e-6;

// "C4" → 60, "Bb3" → 58, "F#5" → 78. NaN for anything else.
export function midi(name) {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/.exec(String(name).trim());
  if (!m) return NaN;
  const acc = !m[2] ? 0 : m[2][0] === "#" ? m[2].length : -m[2].length;
  return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + acc;
}

const SHARP = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const nameOf = (m) => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const pc = (m) => ((m % 12) + 12) % 12;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round = (x) => Math.round(x * 1e6) / 1e6;

// ---- chords

export const QUALITY = Object.freeze({
  "": [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  5: [0, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 69: [0, 4, 7, 9, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9], "7sus4": [0, 5, 7, 10], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
  "7b9": [0, 4, 7, 10, 13], "7#9": [0, 4, 7, 10, 15], 13: [0, 4, 7, 10, 14, 21],
});

// "A7b9/C#" → { root: 9, bass: 1, iv: [0, 4, 7, 10, 13], sym }
export function parseChord(sym) {
  const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(String(sym).trim());
  if (!m || !(m[3] in QUALITY)) return null;
  const acc = (a) => (a === "#" ? 1 : a === "b" ? -1 : 0);
  const root = pc(LETTER[m[1]] + acc(m[2]));
  const bass = m[4] ? pc(LETTER[m[4]] + acc(m[5])) : root;
  return { root, bass, iv: QUALITY[m[3]].slice(), sym: String(sym).trim() };
}

// The chord's pitch classes, the root first.
export const pcsOf = (c) => [...new Set(c.iv.map((i) => pc(c.root + i)))];

// The 3rd, 5th and 7th of a chord as intervals (null when it has none).
export function thirdOf(c) { return c.iv.includes(4) ? 4 : c.iv.includes(3) ? 3 : null; }
export function fifthOf(c) { return c.iv.includes(7) ? 7 : c.iv.includes(6) ? 6 : c.iv.includes(8) ? 8 : 7; }
export function seventhOf(c) { return c.iv.includes(10) ? 10 : c.iv.includes(11) ? 11 : c.iv.includes(9) && c.iv.length === 4 && c.iv[1] === 3 && c.iv[2] === 6 ? 9 : null; }

// A chart: bars split by "|"; a bar holds chords, "Sym" or "Sym:dur" (beats); chords without a dur share what is
// left of the bar. "%" repeats the bar before. Errors go to `errors`.
export function chart(str, meter = 4, errors = []) {
  const out = [];
  const bars = String(str).split("|").map((b) => b.trim()).filter((b) => b.length);
  let prev = null;
  bars.forEach((bar, bi) => {
    const toks = bar === "%" && prev ? prev : bar.split(/\s+/);
    prev = toks;
    const parsed = toks.map((t) => { const [s, d] = t.split(":"); return { s, d: d === undefined ? null : Number(d) }; });
    const fixed = parsed.reduce((a, p) => a + (p.d || 0), 0);
    const free = parsed.filter((p) => p.d === null).length;
    const each = free ? (meter - fixed) / free : 0;
    let beat = bi * meter;
    for (const p of parsed) {
      const c = parseChord(p.s);
      const dur = p.d === null ? each : p.d;
      if (!c) errors.push(`chart: bad chord "${p.s}" in bar ${bi + 1}`);
      else out.push({ ...c, beat: round(beat), dur: round(dur) });
      beat += dur;
    }
    if (Math.abs(beat - (bi + 1) * meter) > EPS) errors.push(`chart: bar ${bi + 1} "${bar}" holds ${beat - bi * meter} beats, not ${meter}`);
  });
  return out;
}

export function chordAt(ch, beat) {
  for (let i = ch.length - 1; i >= 0; i--) if (beat >= ch[i].beat - EPS) return ch[i];
  return ch[0];
}

// ---- pitch helpers

// The midi note of pitch class p nearest to `near` (ties go down).
export function nearest(p, near) {
  const base = near - pc(near - p);
  return near - base <= base + 12 - near ? base : base + 12;
}
// Fold m by octaves into [lo, hi] (hi - lo ≥ 11).
export function fold(m, lo, hi) {
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}
// The highest note below m (strictly) whose pitch class is in pcs.
export function below(pcs, m) { for (let k = m - 1; k > m - 13; k--) if (pcs.includes(pc(k))) return k; return m - 12; }
export function above(pcs, m) { for (let k = m + 1; k < m + 13; k++) if (pcs.includes(pc(k))) return k; return m + 12; }

// ---- note lists

export const tr = (notes, semis) => notes.map(([b, d, m, v]) => [b, d, m === 0 ? 0 : m + semis, v]);
export const shift = (notes, beats) => notes.map(([b, d, m, v]) => [round(b + beats), d, m, v]);
export const scaleVel = (notes, k) => notes.map(([b, d, m, v]) => [b, d, m, clamp01(v * k)]);
export const sortNotes = (notes) => notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]);
// Several [notes, offsetBeats] runs into one list.
export function cat(...runs) { return runs.flatMap(([notes, off]) => shift(notes, off || 0)); }
// Repeat a run `times` times, `every` beats apart.
export function rep(notes, times, every) { const out = []; for (let i = 0; i < times; i++) out.push(...shift(notes, i * every)); return out; }
// Keep the notes that start in [from, to).
export const within = (notes, from, to) => notes.filter((n) => n[0] >= from - EPS && n[0] < to - EPS);
// A velocity ramp over [from, to): v0 at from to v1 at to, multiplied in.
export function ramp(notes, from, to, v0, v1) {
  return notes.map(([b, d, m, v]) => {
    if (b < from - EPS || b >= to - EPS) return [b, d, m, v];
    const u = (b - from) / Math.max(EPS, to - from);
    return [b, d, m, clamp01(v * (v0 + (v1 - v0) * u))];
  });
}
// An octave doubling: every note again at +semis, kept only inside [lo, hi].
export function dbl(notes, semis, lo = 0, hi = 127, k = 0.85) {
  return notes.flatMap((n) => { const m = n[2] + semis; return m >= lo && m <= hi ? [n, [n[0], n[1], m, clamp01(n[3] * k)]] : [n]; });
}
// Route notes to instruments by pitch: ranges [[lo, hi], ...] in order of preference; returns one list per range
// (a note goes to the first range that holds it; notes no range holds are dropped).
export function route(notes, ranges) {
  const out = ranges.map(() => []);
  for (const n of notes) { const i = ranges.findIndex(([lo, hi]) => n[2] >= lo && n[2] <= hi); if (i >= 0) out[i].push(n); }
  return out;
}
export function inRange(notes, lo, hi) { return notes.map(([b, d, m, v]) => [b, d, m === 0 ? 0 : fold(m, lo, hi), v]); }

// ---- the melody line notation
//
// Tokens split by spaces. "|" is a bar line (the bar's beats are checked). pp p mp mf f ff set the loudness.
// A note is  [/]PITCH[:DUR][marks]  PITCH = C4, Bb3, F#5, r (a rest) or [C4,E4,G4] (a chord). DUR in beats (1, .5,
// 1.5, 1/3); a token without DUR keeps the last one. Marks: > accent, ^ marcato (accent, short), . staccato, _ full
// length, \ a fall off the end. A leading / rips up into the note (fast grace notes from a fifth below, taken from
// the start of the note). Sounding length is 0.92 of the written one unless marked.
const DYN = { ppp: 0.22, pp: 0.3, p: 0.42, mp: 0.54, mf: 0.66, f: 0.8, ff: 0.92, fff: 1 };

export function line(str, { meter = 4, vel = 0.66, start = 0, transpose = 0, errors = [], name = "line" } = {}) {
  const notes = [];
  let beat = start, barStart = start, dur = 1, v0 = vel, bar = 1;
  for (const tok of String(str).split(/\s+/).filter(Boolean)) {
    if (tok === "|") {
      if (Math.abs(beat - barStart - meter) > EPS) errors.push(`${name}: bar ${bar} holds ${round(beat - barStart)} beats, not ${meter}`);
      barStart = beat; bar++;
      continue;
    }
    if (tok in DYN) { v0 = DYN[tok]; continue; }
    const m = /^(\/)?(r|\[[^\]]+\]|[A-G](?:#|b)?-?\d)(?::(\d+\/\d+|\d*\.\d+|\d+))?([>^._\\]*)$/.exec(tok);
    if (!m) { errors.push(`${name}: bad token "${tok}"`); continue; }
    if (m[3] !== undefined) {
      const d = m[3].includes("/") ? m[3].split("/").map(Number).reduce((a, b) => a / b) : Number(m[3]);
      if (!(d > 0)) { errors.push(`${name}: bad duration "${tok}"`); continue; }
      dur = d;
    }
    const marks = m[4] || "";
    if (m[2] !== "r") {
      const pitches = (m[2][0] === "[" ? m[2].slice(1, -1).split(",") : [m[2]]).map((p) => midi(p) + transpose);
      if (pitches.some((p) => !Number.isFinite(p))) { errors.push(`${name}: bad pitch "${tok}"`); beat += dur; continue; }
      let v = v0;
      if (marks.includes(">")) v += 0.12;
      if (marks.includes("^")) v += 0.16;
      v = clamp01(v);
      let sound = dur * 0.92;
      if (marks.includes(".")) sound = Math.min(dur * 0.5, 0.45);
      if (marks.includes("^")) sound = Math.min(dur * 0.6, 0.6);
      if (marks.includes("_")) sound = dur;
      let at = beat;
      if (m[1]) {
        // a rip: four grace notes rising from a fifth below, in the first quarter beat (or a third of the note)
        const g = Math.min(0.25, dur / 3), top = Math.max(...pitches);
        [-7, -5, -3, -1].forEach((iv, i) => notes.push([round(at + (g / 4) * i), round(g / 4), top + iv, clamp01(v * (0.45 + 0.1 * i))]));
        at += g; sound = Math.max(0.05, sound - g);
      }
      if (marks.includes("\\")) {
        // a fall: the note holds, then four quick notes slide down a fourth and fade, inside the written length
        const fall = Math.min(0.5, dur / 2), keep = Math.max(0.05, dur - fall - (at - beat)), top = Math.max(...pitches);
        for (const p of pitches) notes.push([round(at), round(keep), p, v]);
        [-1, -2, -3, -5].forEach((iv, i) => notes.push([round(at + keep + (fall / 4) * i), round(fall / 4), top + iv, clamp01(v * (0.55 - 0.1 * i))]));
      } else {
        for (const p of pitches) notes.push([round(at), round(sound), p, v]);
      }
    }
    beat += dur;
  }
  if (Math.abs(beat - barStart) > EPS && Math.abs(beat - barStart - meter) > EPS) {
    errors.push(`${name}: last bar holds ${round(beat - barStart)} beats, not ${meter}`);
  }
  return notes;
}

// ---- drums
//
// A drum pattern: one bar as a string of steps (16 for 4/4 sixteenths, 12 for 3/4); "|" separates bars that take
// turns. X accent, x hit, o soft, g ghost, . rest. Returns notes [beat, dur, 0, vel] for `bars` bars. A pitched
// pattern (timpani) gives a midi for every step through `pitch(chord)` and the chart.
export function drum(pattern, bars, { meter = 4, vel = 0.7, dur = null, start = 0 } = {}) {
  const variants = String(pattern).split("|").map((s) => s.replace(/\s+/g, ""));
  const out = [];
  for (let b = 0; b < bars; b++) {
    const p = variants[b % variants.length];
    const step = meter / p.length;
    [...p].forEach((ch, i) => {
      const k = ch === "X" ? 1.22 : ch === "x" ? 1 : ch === "o" ? 0.62 : ch === "g" ? 0.36 : 0;
      if (k) out.push([round(start + b * meter + i * step), round(dur || step), 0, clamp01(vel * k)]);
    });
  }
  return out;
}

// A pattern for every bar but the last, which takes the fill.
export function drumFill(pattern, fillPattern, bars, opts = {}) {
  const meter = opts.meter || 4;
  return [...drum(pattern, bars - 1, opts), ...drum(fillPattern, 1, { ...opts, start: (opts.start || 0) + (bars - 1) * meter })];
}

// A roll: repeated strokes from `beat` for `len` beats, every `step`, the velocity going v0 → v1. midi 0 for a drum
// voice, a pitch for timpani.
export function roll(beat, len, midiNote, v0, v1, step = 1 / 6) {
  const out = [];
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i < n; i++) out.push([round(beat + i * step), round(step), midiNote, clamp01(v0 + ((v1 - v0) * i) / Math.max(1, n - 1))]);
  return out;
}

// ---- harmony builders (all from a chart)

// Every chord's root (or its slash bass) in [lo, hi], moving to the nearest octave each time. pattern: offsets and
// lengths inside each chord, e.g. [[0, 1.8]] (one held note) or [[0, .5], [2, .5]] (root on 1 and 3); a third field
// "5" plays the fifth there.
export function bassLine(ch, { lo = 28, hi = 52, vel = 0.7, pattern = null, start = null } = {}) {
  const out = [];
  let last = start === null ? Math.round((lo + hi) / 2) : start;
  for (const c of ch) {
    const r = fold(nearest(c.bass, last), lo, hi);
    last = r;
    const pat = pattern || [[0, Math.max(0.25, c.dur - 0.1)]];
    for (const [off, len, what, k] of pat) {
      if (off >= c.dur - EPS) continue;
      let m = r;
      if (what === "5") m = fold(r + (fifthOf(c) - 12), lo, hi);
      if (what === "8") m = r + 12 <= hi ? r + 12 : r;
      if (what === "3") m = fold(nearest(pc(c.root + (thirdOf(c) || 4)), r), lo, hi);
      out.push([round(c.beat + off), round(Math.min(len, c.dur - off)), m, clamp01(vel * (k || 1))]);
    }
  }
  return out;
}

// A walking bass in quarters: the root on each chord's first beat, chord and scale tones between, and a chromatic
// approach to the next root on the last beat before a change. Shapes rotate by bar so it never loops in 2 bars.
export function walk(ch, { lo = 28, hi = 50, vel = 0.68, start = null, meter = 4 } = {}) {
  const out = [];
  let last = start === null ? Math.round((lo + hi) / 2) : start;
  ch.forEach((c, i) => {
    const next = ch[(i + 1) % ch.length];
    const r = fold(nearest(c.bass, last), lo, hi);
    const n = Math.max(1, Math.round(c.dur));
    const third = thirdOf(c) || 4, fifth = fifthOf(c), sev = seventhOf(c) || (c.iv.includes(9) ? 9 : third === 3 ? 10 : 9);
    const up = r + 7 <= hi;
    const shapes = up
      ? [[0, third, fifth], [0, 2, third], [0, fifth, sev], [0, 7, 9]]
      : [[0, sev - 12, fifth - 12], [0, fifth - 12, third - 12], [0, fifth - 12, sev - 12]];
    const shape = shapes[(Math.floor(c.beat / meter) + i) % shapes.length];
    const notes = [];
    for (let k = 0; k < n; k++) {
      if (k === 0) notes.push(r);
      else if (k === n - 1 && n > 1) {
        const target = fold(nearest(next.bass, notes[notes.length - 1]), lo, hi);
        const prev = notes[notes.length - 1];
        let a = target > prev ? target - 1 : target + 1;
        if (a === prev) a = target + (target > prev ? 1 : -1);
        notes.push(fold(a, lo, hi));
      } else notes.push(fold(r + shape[Math.min(k, shape.length - 1)], lo, hi));
    }
    notes.forEach((m, k) => out.push([round(c.beat + k), 0.9, m, clamp01(vel * (k === 0 ? 1.08 : k % 2 ? 0.9 : 1))]));
    last = notes[notes.length - 1];
  });
  return out;
}

// Four-part (or n-part) close voicing of a chord with its top note at or under `top`: the chord's tones stacked down
// from the top. Triads take their 6th (major) or 7th (minor) so four voices are four tones.
export function closeChord(c, top, n = 4) {
  let set = c.iv.map((i) => pc(c.root + i));
  set = [...new Set(set)];
  if (set.length === 3 && n >= 4) set.push(pc(c.root + (c.iv[1] === 4 && c.iv[2] === 7 ? 9 : c.iv[1] === 3 && c.iv[2] === 7 ? 10 : 12)));
  if (set.length > n) {
    // drop the fifth, then the root, so the colour tones stay; but never the tone asked for on top (dropping it put
    // the whole chord a step or more under the top it was meant to have, and a high voicing could vanish under `lo`)
    const keep = pc(top), had = set.includes(keep);
    const fifth = pc(c.root + 7);
    if (set.includes(fifth) && fifth !== keep && set.length > n) set = set.filter((p) => p !== fifth);
    if (set.length > n && c.root !== keep) set = set.filter((p) => p !== c.root);
    if (set.length > n) set = had ? [keep, ...set.filter((p) => p !== keep)].slice(0, n) : set.slice(0, n);
  }
  const notes = [];
  let m = set.includes(pc(top)) ? top : below(set, top);
  while (notes.length < Math.min(n, set.length)) { notes.push(m); m = below(set, m); }
  return notes;
}

// Big-band block voicing under a lead line: each lead note gets n-1 voices below it from its chord (close position;
// drop2 moves the second voice down an octave; a lead under minLead stays alone). A short lead note that is not in its chord takes a diminished seventh
// built down from it (the passing chord). Returns n voice lists, the lead first. Voices under `floor` are left out.
export function block(lead, ch, { n = 4, floor = 0, drop2 = false, kVel = 0.88, minLead = 0 } = {}) {
  const voices = Array.from({ length: n }, () => []);
  for (const [b, d, m, v] of lead) {
    voices[0].push([b, d, m, v]);
    if (m < minLead || d < 0.1) continue;        // low pickups stay in unison; grace notes are the lead's alone
    const c = chordAt(ch, b);
    const set = pcsOf(c);
    const inChord = set.includes(pc(m));
    let under;
    if (!inChord && d <= 0.5 + EPS) under = [m - 3, m - 6, m - 9].slice(0, n - 1);
    else under = closeChord(c, inChord ? m : below(set, m - 2), n).filter((x) => x !== m).slice(0, n - 1);
    // no second right under the lead: start a third or more below it
    if (under.length && m - under[0] <= 2 && d > 0.5 + EPS) under = [below(set, under[0])];
    if (under.length < n - 1) {
      let x = under.length ? under[under.length - 1] : m;
      while (under.length < n - 1) { x = below(set, x); under.push(x); }
    }
    if (drop2 && under.length) under[0] -= 12;
    under.sort((a, b2) => b2 - a);
    under.forEach((x, i) => { if (x >= floor) voices[i + 1].push([b, d, x, clamp01(v * kVel)]); });
  }
  return voices;
}

// Chords on given offsets of every bar (the brass "stabs" and "pahs"): voiced close under a top note that follows
// the nearest chord tone to `top`, so the line moves smoothly. pos: [[offset, len, kVel], ...] per bar.
export function stabs(ch, pos, { top = 72, n = 3, vel = 0.7, meter = 4, bars = null, floor = 0, lo = null, hi = 127 } = {}) {
  const out = [];
  const total = bars === null ? Math.round((ch[ch.length - 1].beat + ch[ch.length - 1].dur) / meter) : bars;
  let t = top;
  for (let bar = 0; bar < total; bar++) {
    for (const [off, len, k] of pos) {
      const beat = bar * meter + off;
      const c = chordAt(ch, beat);
      const set = pcsOf(c);
      // the chord tone nearest the last top, kept within a fourth of `top`
      let head = null;
      for (let m = top - 5; m <= Math.min(top + 5, hi); m++) if (set.includes(pc(m)) && (head === null || Math.abs(m - t) < Math.abs(head - t))) head = m;
      t = head === null ? top : head;
      const hold = Math.min(len, c.beat + c.dur - beat);   // a held stab stops at its chord's end
      for (const m of closeChord(c, t, n)) if (m >= floor && (lo === null || m >= lo)) out.push([round(beat), round(hold), m, clamp01(vel * (k || 1))]);
    }
  }
  return out;
}

// A brass hit: the chord at `beat` voiced close under `top` (n voices), with a rip into it (four grace notes rising
// from a fifth below its top note in the first quarter beat) when rip is on. The big-band "hit" on a downbeat.
export function hit(ch, beat, { top = 74, n = 3, vel = 0.8, len = 0.5, rip = true, floor = 0 } = {}) {
  const c = chordAt(ch, beat);
  const set = pcsOf(c);
  const t = set.includes(pc(top)) ? top : below(set, top);
  const out = [];
  let at = beat;
  if (rip) {
    const g = 0.25;
    [-7, -5, -3, -1].forEach((iv, i) => out.push([round(beat + (g / 4) * i), round(g / 4), t + iv, clamp01(vel * (0.45 + 0.1 * i))]));
    at = beat + g;
  }
  for (const m of closeChord(c, t, n)) if (m >= floor) out.push([round(at), round(len), m, clamp01(vel)]);
  return out;
}

// Arpeggios: the chord's tones from its bass upward through [lo, hi], read by `pattern` (indices into that ladder)
// every `step` beats. For harp, running strings and the like.
export function arp(ch, { lo = 48, hi = 84, step = 0.5, pattern = [0, 1, 2, 3, 4, 3, 2, 1], vel = 0.55, dur = null, accent = 1.15, meter = 4 } = {}) {
  const out = [];
  for (const c of ch) {
    const set = pcsOf(c).filter((p, i, a) => a.length < 5 || p !== pc(c.root + 7));
    const ladder = [];
    let m = fold(nearest(c.bass, lo), lo, lo + 11);
    if (m < lo) m += 12;
    ladder.push(m);
    while (ladder.length < 16) { m = above(set, m); if (m > hi) break; ladder.push(m); }
    const n = Math.round(c.dur / step);
    for (let i = 0; i < n; i++) {
      const at = c.beat + i * step;
      const idx = pattern[Math.round((at % meter) / step) % pattern.length];
      const note = ladder[Math.min(ladder.length - 1, idx)];
      const onBeat = Math.abs(at - Math.round(at)) < EPS;
      // a note rings at most to its chord's end, so nothing hangs over into the next chord
      out.push([round(at), round(Math.min(dur || step * 1.6, c.beat + c.dur - at)), note, clamp01(vel * (onBeat && Math.round(at) % meter === 0 ? accent : 1))]);
    }
  }
  return out;
}

// An ostinato: a figure of chord-relative steps every `step` beats over each chord. A step is a number (semitones
// above the chord's bass in [lo, lo + 12)) or a string: "r" the root, "3" "5" "7" the chord's own tones, "c" its colour
// tone (the highest of 13, 11, 10, 9 it has, else the octave), "8" the octave, with "+" or "-" for an octave up or down.
export function ostinato(ch, figure, { lo = 38, step = 0.5, vel = 0.6, dur = null, accents = null, meter = 4 } = {}) {
  const out = [];
  for (const c of ch) {
    const r = fold(c.bass, lo, lo + 11);
    const root = fold(c.root, lo, lo + 11);
    const color = c.iv.includes(13) ? 13 : c.iv.includes(11) ? 11 : c.iv.includes(10) ? 10 : c.iv.includes(9) ? 9 : 12;
    const n = Math.round(c.dur / step);
    for (let i = 0; i < n; i++) {
      const at = c.beat + i * step;
      const slot = Math.round((at % meter) / step) % figure.length;
      const f = figure[slot];
      if (f === null || f === ".") continue;
      let m;
      if (typeof f === "number") m = r + f;
      else {
        const oct = (f.match(/\+/g) || []).length * 12 - (f.match(/-/g) || []).length * 12;
        const k = f.replace(/[+-]/g, "");
        m = k === "r" ? root : k === "b" ? r : k === "3" ? root + (thirdOf(c) || 4) : k === "5" ? root + fifthOf(c)
          : k === "7" ? root + (seventhOf(c) || 10) : k === "c" ? root + color : k === "8" ? root + 12 : root;
        m += oct;
      }
      const acc = accents ? accents[slot % accents.length] : 1;
      out.push([round(at), round(dur || step * 0.9), m, clamp01(vel * acc)]);
    }
  }
  return out;
}

// A rising line of chord tones: at each step the next chord tone above the last note (an octave lower once past hi).
export function riser(ch, { start = 60, step = 2, hi = 77, vel = 0.6, v1 = null, meter = 4 } = {}) {
  const out = [];
  const end = ch[ch.length - 1].beat + ch[ch.length - 1].dur;
  let m = start - 1;
  const n = Math.round(end / step);
  for (let i = 0; i < n; i++) {
    const at = i * step;
    const c = chordAt(ch, at);
    m = above(pcsOf(c), m);
    if (m > hi) m -= 12;
    out.push([round(at), round(step * 0.95), m, clamp01(vel + ((v1 === null ? vel : v1) - vel) * (i / Math.max(1, n - 1)))]);
  }
  return out;
}

// A harp (or string) glissando: the scale tones from `from` to `to` (either way) spread evenly over `len` beats.
export function gliss(beat, len, from, to, scalePcs, vel = 0.5, dur = 0.6) {
  const notes = [];
  const dir = to >= from ? 1 : -1;
  for (let m = from; dir > 0 ? m <= to : m >= to; m += dir) if (scalePcs.includes(pc(m))) notes.push(m);
  return notes.map((m, i) => [round(beat + (len * i) / Math.max(1, notes.length)), dur, m, clamp01(vel * (0.8 + (0.3 * i) / notes.length))]);
}

export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const PENTA = [0, 2, 4, 7, 9];
export const scaleOf = (tonic, steps) => steps.map((s) => pc(tonic + s));

// ---- the chorale: strict four-part voice leading over a chart (for the brass and string chorale moments)
//
// The bass takes each chord's bass note, the nearest octave in its range. The three upper voices take chord tones in
// their ranges, close enough (an octave or less between neighbours), with the 3rd always and the 7th when the chord
// has one, and the smallest total motion; no parallel fifths or octaves between any two voices, no crossing. The
// search is exhaustive per chord (a few hundred voicings), so it is cheap and the same every time.
const RANGES4 = [[40, 62], [52, 69], [57, 74], [62, 81]];

function parallels(a, b) {
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const i0 = Math.abs(a[j] - a[i]) % 12, i1 = Math.abs(b[j] - b[i]) % 12;
      const moved = a[i] !== b[i] || a[j] !== b[j];
      if (moved && i0 === i1 && (i0 === 7 || i0 === 0) && a[i] !== b[i] && a[j] !== b[j] && Math.sign(b[i] - a[i]) === Math.sign(b[j] - a[j])) return true;
    }
  }
  return false;
}
export { parallels as hasParallels };

export function chorale(ch, { ranges = RANGES4, top = null, vel = 0.5, rhythm = null } = {}) {
  const [bR, tR, aR, sR] = ranges;
  const out = [];
  let prev = null;
  for (const c of ch) {
    const set = pcsOf(c);
    const core = [...new Set([c.root, pc(c.root + (thirdOf(c) ?? 7))].concat(seventhOf(c) !== null ? [pc(c.root + seventhOf(c))] : []))];
    const third = thirdOf(c) === null ? null : pc(c.root + thirdOf(c));
    const bassNear = prev ? prev[0] : Math.round((bR[0] + bR[1]) / 2);
    let bass = fold(nearest(c.bass, bassNear), bR[0], bR[1]);
    const cand = (lo, hi) => { const a = []; for (let m = lo; m <= hi; m++) if (set.includes(pc(m))) a.push(m); return a; };
    const T = cand(tR[0], tR[1]), A = cand(aR[0], aR[1]), S = cand(sR[0], sR[1]);
    let best = null, bestScore = Infinity, bestLoose = null, looseScore = Infinity;
    for (const bassTry of [bass, bass + 12, bass - 12].filter((x) => x >= bR[0] && x <= bR[1])) {
      for (const t of T) {
        if (t <= bassTry) continue;
        for (const a of A) {
          if (a <= t || a - t > 12) continue;
          for (const s of S) {
            if (s <= a || s - a > 12) continue;
            const v = [bassTry, t, a, s];
            const pcs = v.map(pc);
            if (!core.every((p) => pcs.includes(p)) && !(core.length === 4 && [t, a, s].map(pc).filter((p) => core.includes(p)).length >= 3)) continue;
            if (third !== null && pcs.filter((p) => p === third).length > 1) continue;
            let score;
            if (prev) score = Math.abs(t - prev[1]) + Math.abs(a - prev[2]) + Math.abs(s - prev[3]) * 1.2 + Math.abs(bassTry - prev[0]) * 0.3;
            else score = Math.abs(s - (top ?? (sR[0] + sR[1]) / 2)) * 2 + (a - t) * 0.2;
            if (prev) for (let k = 1; k < 4; k++) if (Math.abs(v[k] - prev[k]) > 4) score += 3;
            if (top !== null && prev) score += Math.abs(s - top) * 0.15;
            if (prev && parallels(prev, v)) { if (score < looseScore) { looseScore = score; bestLoose = v; } continue; }
            if (score < bestScore) { bestScore = score; best = v; }
          }
        }
      }
    }
    const v = best || bestLoose || [bass, fold(c.root + 7, tR[0], tR[1]), fold(c.root + 12, aR[0], aR[1]), fold(c.root + 16, sR[0], sR[1])];
    const hits = rhythm ? rhythm(c) : [[0, c.dur]];
    for (const [off, len, k] of hits) if (off < c.dur - EPS) for (const m of v) out.push([round(c.beat + off), round(Math.min(len, c.dur - off) * 0.98), m, clamp01(vel * (k || 1))]);
    prev = v;
  }
  return out;
}

// Split simultaneous chord notes into voices (lowest first): for the parallel-motion check and for routing a chorale's
// voices to instruments.
export function voicesOf(notes) {
  const by = new Map();
  for (const n of notes) { const k = n[0].toFixed(4); if (!by.has(k)) by.set(k, []); by.get(k).push(n); }
  return [...by.values()].map((g) => g.sort((a, b) => a[2] - b[2]));
}
