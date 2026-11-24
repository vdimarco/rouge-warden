// Gloam Downs: builds the score's sample bank in public/lab/gloam-downs/audio/ from First Breath's FluidR3_GM notes
// (public/first-breath/audio/score/, MIT and CC BY 3.0, see its README.md). For each of the six instruments that the score plays
// (music.js BANK) it keeps only the sample notes within 2 semitones of a note that the themes and the stingers play (there is one
// sample every 4 semitones, so no note moves more than 2), and writes manifest.json with First Breath's gains. The bank must be
// 500 KB or less.
//   node qa/lab/gloam-downs-bank.mjs [--check]   (--check only reports what it would copy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, STINGS, BANK, keyOf, PLACES } from '../../public/lab/gloam-downs/music.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FROM = path.join(ROOT, 'public/first-breath/audio/score'), TO = path.join(ROOT, 'public/lab/gloam-downs/audio');
const LIMIT = 500 * 1024;
// the notes the score plays on each sampled instrument
function used() {
  const out = Object.fromEntries(BANK.map(i => [i, new Set()]));
  for (const T of Object.values(THEMES)) for (const parts of Object.values(T.layers || {})) for (const p of parts) if (out[p.inst]) for (const n of p.notes) out[p.inst].add(n.m);
  // the stingers play in each place's key, and the win in the Lamp-room's
  for (const [id, Z] of Object.entries(STINGS)) for (const key of id === 'win' ? [keyOf('lamp')] : PLACES.map(keyOf)) for (const [inst, , n] of Z.notes) if (out[inst]) out[inst].add(key + n);
  return out;
}
const man = JSON.parse(fs.readFileSync(path.join(FROM, 'manifest.json'), 'utf8'));
const want = used(), list = [];
let bytes = 0;
const manifest = { source: man.source, license: man.license, instruments: {} };
for (const inst of BANK) {
  const have = Object.keys(man.instruments[inst].notes).map(Number);
  const keep = have.filter(s => [...want[inst]].some(m => Math.abs(m - s) <= 2));
  // a note that the bank cannot reach within 2 semitones is a fault in the score
  const far = [...want[inst]].filter(m => !keep.some(s => Math.abs(m - s) <= 2));
  if (far.length) { console.log(`FAIL ${inst}: notes ${far.join(', ')} are out of the bank's range`); process.exitCode = 1; }
  manifest.instruments[inst] = { notes: {}, gain: man.instruments[inst].gain };
  for (const s of keep.sort((a, b) => a - b)) {
    const file = man.instruments[inst].notes[s];
    manifest.instruments[inst].notes[s] = file;
    const b = fs.statSync(path.join(FROM, file)).size;
    bytes += b;
    list.push(file);
  }
}
console.log(BANK.map(i => `${i}: ${Object.keys(manifest.instruments[i].notes).join(' ')}`).join('\n'));
console.log(`${list.length} files, ${(bytes / 1024).toFixed(0)} KB of ${LIMIT / 1024} KB`);
if (bytes > LIMIT) { console.log('FAIL the bank is over 500 KB'); process.exit(1); }
if (!process.argv.includes('--check')) {
  for (const inst of BANK) fs.rmSync(path.join(TO, inst), { recursive: true, force: true });
  for (const file of list) { fs.mkdirSync(path.dirname(path.join(TO, file)), { recursive: true }); fs.copyFileSync(path.join(FROM, file), path.join(TO, file)); }
  fs.writeFileSync(path.join(TO, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`wrote ${TO}`);
}
