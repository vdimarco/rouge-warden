// Gloam Downs: the zones go into <id>.json only. Bakes each place twice into the system's temp folder, with its zones and with
// --no-zones, one bake at a time (about 8 to 16 s each), and checks that the two .bin.gz files are the same, the two .walk.bin.gz files
// are the same, both are the committed files, and the two JSON files differ only in `zones`. The committed files are not written.
// Run: node qa/lab/gloam-downs-bake-zones.mjs [place ...]   (all five by default)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BAKE = path.join(ROOT, 'games/gloam-downs/bake.mjs'), WORLDS = path.join(ROOT, 'public/lab/gloam-downs/worlds');
export function bakeTwice(id) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `gloam-zones-${id}-`)), a = path.join(tmp, 'with'), b = path.join(tmp, 'without');
  try {
    execFileSync(process.execPath, [BAKE, id, '--worlds', a], { stdio: 'pipe' });
    execFileSync(process.execPath, [BAKE, id, '--no-zones', '--worlds', b], { stdio: 'pipe' });
    const read = (dir, ext) => fs.readFileSync(path.join(dir, id + ext));
    const out = [], ok = (cond, what) => out.push({ ok: !!cond, what: `${id}: ${what}` });
    for (const ext of ['.bin.gz', '.walk.bin.gz']) {
      ok(read(a, ext).equals(read(b, ext)), `the two ${ext} files are the same`);
      ok(read(a, ext).equals(fs.readFileSync(path.join(WORLDS, id + ext))), `the ${ext} baked with zones is the committed file`);
    }
    const ja = JSON.parse(read(a, '.json')), jb = JSON.parse(read(b, '.json'));
    const keys = [...new Set([...Object.keys(ja), ...Object.keys(jb)])].filter(k => JSON.stringify(ja[k]) !== JSON.stringify(jb[k]));
    ok(keys.length === 1 && keys[0] === 'zones' && !('zones' in jb), `the two JSON files differ only in zones (${keys.join(', ') || 'none'})`);
    ok(read(a, '.json').equals(fs.readFileSync(path.join(WORLDS, id + '.json'))), 'the JSON baked with zones is the committed file');
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ids = process.argv.slice(2);
  let bad = 0;
  for (const id of ids.length ? ids : ['gaol', 'ramparts', 'fen', 'bells', 'barrows']) {
    const t = Date.now();
    for (const r of bakeTwice(id)) { console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.what}`); bad += !r.ok; }
    console.log(`  ${id}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
  if (bad) process.exitCode = 1;
}
