// Slims clips.json for the game: rotation tracks plus hip translation, values rounded to 4 decimals.
// Usage: node slim-clips.mjs clips.json ../../public/tidebreak/models/clips.json
import fs from 'node:fs';
const [input, output] = process.argv.slice(2), clips = JSON.parse(fs.readFileSync(input, 'utf8')), round = (v, d) => +v.toFixed(d);
for (const entry of Object.values(clips)) {
  entry.tracks = entry.tracks.filter(t => t.path === 'rotation' || (t.bone === 'Hips' && t.path === 'translation'))
    .map(t => ({ ...t, times: t.times.map(v => round(v, 3)), values: t.values.map(v => round(v, 4)) }));
  entry.bind = Object.fromEntries(Object.entries(entry.bind).map(([bone, m]) => [bone, m.map(v => round(v, 5))]));
  entry.forward = entry.forward.map(v => round(v, 4));
}
fs.writeFileSync(output, JSON.stringify(clips));
console.log(Object.keys(clips).length, 'clips', fs.statSync(output).size, 'bytes');
