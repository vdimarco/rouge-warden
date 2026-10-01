import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINES } from '../../public/crimson/js/story/content/lines.js';
import { CREW_IDS } from '../../public/crimson/js/story/types.js';
import { voiceKey, silentSpeaker } from '../../public/crimson/js/story/audio/cinematic.js';
const manifest = JSON.parse(readFileSync(new URL('../../public/crimson/audio/dialogue/realistic/manifest.json', import.meta.url)));
const byKey = new Map(manifest.entries.map(e => [voiceKey(e.who,e.text),e]));
assert.equal(byKey.size, manifest.entries.length, 'manifest keys are unique');
const voices = new Set();
for (const who of [...CREW_IDS,'gabe']) {
  const profile = manifest.entries.find(e => e.who === who)?.voice;
  assert(profile, who); voices.add(profile);
  assert(manifest.entries.filter(e=>e.who===who).every(e=>e.voice===profile), 'one stable voice per character');
}
assert.equal(voices.size, 6, 'six distinct lead male voices');
let checked = 0;
for (const [id,line] of Object.entries(LINES)) {
  if (silentSpeaker(line.who) || /^\s*\(.*\)\s*$/.test(line.text)) continue;
  for (const who of line.who==='pick' ? CREW_IDS : [line.who]) {
    const text = line.byPick?.[who] || line.text;
    const entry = byKey.get(voiceKey(who,text)); assert(entry, `${id}: ${who} / ${text}`);
    assert(entry.duration>.15 && entry.duration<30);
    const bytes = readFileSync(new URL('../../public/crimson/'+entry.src, import.meta.url)); assert(bytes.length>1000);
    checked++;
  }
}
console.log(`PASS: ${checked} spoken line/character cases, ${manifest.entries.length} unique clips and six distinct lead voices.`);
