// Gloam Downs: builds the score's sample bank in public/lab/gloam-downs/audio/ from two sources:
//   First Breath's FluidR3_GM notes (public/first-breath/audio/score/, MIT and CC BY 3.0, see its README.md) for harp, strings,
//     contrabass, flute, choir and timpani;
//   the four instruments made offline (games/gloam-downs/audio-src/, written by qa/lab/gloam-downs-synth.mjs) for cello, gurdy,
//     drum-lo and drum-mid (music.js SYNTH).
// For each instrument that the score plays (music.js BANK) it keeps only the sample notes within reach of a note that the themes and
// the stingers play (2 semitones, as there is one sample every 4; a drum's one note is moved up to 7, music.js REACH), and writes
// manifest.json with each source's gains. The bank must be 800 KB or less, and each instrument made offline 100 KB or less.
//   node qa/lab/gloam-downs-bank.mjs [--check]   (--check only reports what it would copy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, STINGS, BANK, SYNTH, REACH, keyOf, stingKey, PLACES } from '../../public/lab/gloam-downs/music.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FLUID = path.join(ROOT, 'public/first-breath/audio/score'), MADE = path.join(ROOT, 'games/gloam-downs/audio-src'), TO = path.join(ROOT, 'public/lab/gloam-downs/audio');
const LIMIT = 800 * 1024, EACH = 100 * 1024;
// the notes the score plays on each sampled instrument
function used() {
  const out = Object.fromEntries(BANK.map(i => [i, new Set()]));
  for (const T of Object.values(THEMES)) for (const parts of Object.values(T.layers || {})) for (const p of parts) if (out[p.inst]) for (const n of p.notes) out[p.inst].add(n.m);
  // a stinger plays in its own key (the fall), the Lamp-room's (the win) or each place's
  for (const [id, Z] of Object.entries(STINGS)) for (const key of Z.key || id === 'win' ? [stingKey(id)] : PLACES.map(keyOf)) for (const [inst, , n] of Z.notes) if (out[inst]) out[inst].add(key + n);
  return out;
}
if (!fs.existsSync(path.join(MADE, 'manifest.json'))) { console.log(`FAIL ${MADE}/manifest.json is missing: run node qa/lab/gloam-downs-synth.mjs first`); process.exit(1); }
const src = { fluid: JSON.parse(fs.readFileSync(path.join(FLUID, 'manifest.json'), 'utf8')), made: JSON.parse(fs.readFileSync(path.join(MADE, 'manifest.json'), 'utf8')) };
const want = used(), list = [];
let bytes = 0;
const manifest = {
  source: `${src.fluid.source}; cello, gurdy, drum-lo and drum-mid ${src.made.source}`,
  license: `${src.fluid.license} The four instruments made offline: ${src.made.license}`,
  instruments: {}
};
const sizes = {};
for (const inst of BANK) {
  const made = SYNTH.includes(inst), man = made ? src.made : src.fluid, from = made ? MADE : FLUID, reach = REACH[inst] ?? 2;
  if (!man.instruments[inst]) { console.log(`FAIL ${inst} is not in ${from}/manifest.json`); process.exitCode = 1; continue; }
  const have = Object.keys(man.instruments[inst].notes).map(Number);
  const keep = have.filter(s => [...want[inst]].some(m => Math.abs(m - s) <= reach));
  // a note that the bank cannot reach is a fault in the score
  const far = [...want[inst]].filter(m => !keep.some(s => Math.abs(m - s) <= reach));
  if (far.length) { console.log(`FAIL ${inst}: notes ${far.join(', ')} are out of the bank's range`); process.exitCode = 1; }
  manifest.instruments[inst] = { notes: {}, gain: man.instruments[inst].gain };
  sizes[inst] = 0;
  for (const s of keep.sort((a, b) => a - b)) {
    const file = man.instruments[inst].notes[s];
    manifest.instruments[inst].notes[s] = file;
    const b = fs.statSync(path.join(from, file)).size;
    bytes += b; sizes[inst] += b;
    list.push({ file, from });
  }
  if (made && sizes[inst] > EACH) { console.log(`FAIL ${inst} is ${(sizes[inst] / 1024).toFixed(1)} KB, over ${EACH / 1024} KB`); process.exitCode = 1; }
}
console.log(BANK.map(i => `${i}: ${Object.keys(manifest.instruments[i]?.notes || {}).join(' ')}  (${((sizes[i] || 0) / 1024).toFixed(1)} KB)`).join('\n'));
console.log(`${list.length} files, ${(bytes / 1024).toFixed(0)} KB of ${LIMIT / 1024} KB`);
if (bytes > LIMIT) { console.log(`FAIL the bank is over ${LIMIT / 1024} KB`); process.exit(1); }
if (process.exitCode) process.exit(1);
if (!process.argv.includes('--check')) {
  for (const inst of BANK) fs.rmSync(path.join(TO, inst), { recursive: true, force: true });
  for (const { file, from } of list) { fs.mkdirSync(path.dirname(path.join(TO, file)), { recursive: true }); fs.copyFileSync(path.join(from, file), path.join(TO, file)); }
  fs.writeFileSync(path.join(TO, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`wrote ${TO}`);
}
