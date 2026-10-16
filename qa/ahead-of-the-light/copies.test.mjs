// Ahead of the Light: the copies of light-years-home's data (final.md 18.1, 21.3). The route's stops and fact lines
// are copied, not imported (another team is changing those files), so this test imports the originals and fails if a
// copied distance differs by more than 0.5 %, a card id has gone, or a copied card's text has changed. Copied audio
// keys and perf helpers are checked once the game has them.
// node qa/ahead-of-the-light/copies.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mod from '../../public/ahead-of-the-light/core/route.js';
import { STOPS, FACTS, STOP, FACT, factsFor, lyText } from '../../public/ahead-of-the-light/core/route.js';
import { OBJECTS, distanceLy } from '../../public/light-years-home/core/objects.js';
import { FACTS as V3 } from '../../public/light-years-home/core/world/facts.js';
import { ROUTE } from '../../public/ahead-of-the-light/core/course/legs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, '../../public/ahead-of-the-light');
const LYH = resolve(HERE, '../../public/light-years-home');

test('core/route.js exports its 18.4 API and imports in plain node', () => {
  assert.ok(Array.isArray(mod.STOPS) && Array.isArray(mod.FACTS));
  assert.ok(STOPS.length >= 20 && FACTS.length >= 30, `${STOPS.length} stops, ${FACTS.length} facts`);
  assert.equal(new Set(STOPS.map((s) => s.id)).size, STOPS.length);
  assert.equal(new Set(FACTS.map((f) => f.id)).size, FACTS.length);
  assert.equal(STOP.coma.name, 'COMA CLUSTER');
  assert.equal(FACT.filament.card, 'filament', 'web.js\'s fact cue names a fact that exists');
});

test('the copied route and facts match light-years-home\'s originals (0.5 % on distances; card ids exist)', () => {
  for (const s of STOPS) {
    assert.ok(OBJECTS[s.id], `${s.id} is an object`);
    assert.ok(ROUTE.includes(s.leg), `${s.id}'s leg`);
    const d = distanceLy('earth', s.id);
    if (d === 0) assert.equal(s.ly, 0, s.id);
    else assert.ok(Math.abs(s.ly - d) / d <= 0.005, `${s.id}: ${s.ly} against ${d.toPrecision(5)} ly from Earth`);
    if (s.card) assert.ok(V3[s.card], `${s.id}'s card ${s.card} exists`);
  }
  for (const f of FACTS) {
    assert.ok(ROUTE.includes(f.leg), f.id);
    if (f.card) {
      assert.ok(V3[f.card], `card ${f.card} exists`);
      assert.equal(f.text, V3[f.card].text, `${f.id} is the v3 card's text`);
    } else {
      assert.ok(OBJECTS[f.obj], `${f.id}: ${f.obj}`);
      const d = distanceLy('earth', f.obj);
      assert.ok(Math.abs(f.ly - d) / d <= 0.005, `${f.id}: ${f.ly} against ${d.toPrecision(5)}`);
    }
  }
  for (const t of ROUTE) assert.ok(STOPS.some((s) => s.leg === t && s.role === 'region'), `${t} has its region`);
  for (const t of ['web', 'coma', 'virgo', 'local', 'milkyway', 'orion', 'neighbours']) {
    assert.ok(factsFor(t).length >= 1, `${t} has a fact`);
  }
  assert.deepEqual([lyText(1e9), lyText(5.382e7), lyText(2.495e6), lyText(2.7e4), lyText(4.342), lyText(0)],
    ['1,000 MLY', '54 MLY', '2.5 MLY', '27,000 LY', '4.3 LY', 'HOME']);
});

test('copied keys (CHAPTER_KEYS, ENDING_TUNE) and perf helpers match their originals', async (t) => {
  // the game copies these into ui/ (WP7); light-years-home's ui/ is being replaced, so compare by value
  const copies = [['ui/sound.js', ['CHAPTER_KEYS', 'ENDING_TUNE']], ['ui/audio.js', ['CHAPTER_KEYS', 'ENDING_TUNE']],
    ['ui/perf.js', ['isSoftware']]];
  const present = copies.filter(([f]) => existsSync(resolve(GAME, f)));
  const found = [];
  for (const [file, names] of present) {
    const src = readFileSync(resolve(GAME, file), 'utf8');
    for (const n of names) if (new RegExp(`export\\s+(const|function)\\s+${n}\\b`).test(src)) found.push([file, n]);
  }
  if (!found.length) { t.skip('the game has no copy of the audio keys or perf helpers yet (WP7)'); return; }
  const music = existsSync(resolve(LYH, 'ui/sound/music.js')) ? await import('../../public/light-years-home/ui/sound/music.js') : {};
  for (const [file, n] of found) {
    let copy;
    try { copy = await import(`../../public/ahead-of-the-light/${file}`); } catch (e) { copy = null; }
    if (!copy) { t.diagnostic(`${file} does not import in node; checked by name only`); continue; }
    if (n === 'isSoftware') {
      for (const s of ['Google SwiftShader', 'llvmpipe', 'Apple M1']) {
        assert.equal(copy.isSoftware(s), /swiftshader|llvmpipe|softpipe|basic render|software/i.test(s));
      }
    } else if (music[n] !== undefined) assert.deepEqual(copy[n], music[n], `${file} ${n}`);
  }
});
