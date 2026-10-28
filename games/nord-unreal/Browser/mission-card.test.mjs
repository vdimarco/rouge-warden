import assert from 'node:assert/strict';
import { columnLines, exhaustPuff, heatLines, jobLines, markerOffset, missionLines, payoutLines, scuffPuff, skyLine, speechLines, weaponLines } from './mission-card.js';

const lines = missionLines({
  title: '28 / THE BOLT',
  objective: 'Reach the bay before they do',
  stage: '2 of 3',
  fail: 'A crawl is caught. The chase starts again.',
  bearing: 90,
  meters: 180,
});
assert.equal(lines.title, '28 / THE BOLT');
assert.equal(lines.objective, 'Reach the bay before they do');
assert.equal(lines.stage, 'Stage 2 of 3');
assert.equal(lines.fail, 'A crawl is caught. The chase starts again.');
assert.equal(lines.distance, '180 m');

const quiet = missionLines({ title: '31 / THE POST', objective: 'Keep walking inside the mark', stage: '1 of 1', meters: 3 });
assert.equal(quiet.fail, '');
assert.equal(quiet.distance, 'here');
assert.equal(missionLines(null).title, '');

const north = markerOffset(0, 40);
assert.ok(Math.abs(north.x) < 1e-6 && north.y < -39, 'north sits above the player');
const east = markerOffset(90, 40);
assert.ok(east.x > 39 && Math.abs(east.y) < 1e-6, 'east sits to the right');

const purse = payoutLines(700);
assert.equal(purse.amount, '+700');
assert.equal(purse.cue, 'CHING');
assert.equal(purse.notes.length, 2);
assert.equal(purse.notes[0].hz, 880);
assert.equal(purse.notes[1].hz, 1320);
assert.deepEqual(payoutLines(0), { amount: '', cue: '', notes: [] });

const failed = jobLines({ head: 'MISSION FAILED', line: 'Time ran out  ·  R restarts' });
assert.equal(failed.head, 'MISSION FAILED');
assert.equal(failed.line, 'Time ran out  ·  R restarts');
assert.equal(jobLines(failed, true).line, 'Time ran out  ·  Menu · Recover');
assert.equal(jobLines({ head: 'MISSION DONE', line: '+300 $  ·  Three doors delivered, still hot' }, true).line, '+300 $  ·  Three doors delivered, still hot');
assert.equal(jobLines(null).head, '');
assert.ok(!/[\u00e9\u00e8\u00ea\u00e0]/.test(`${failed.head} ${failed.line}`), 'the plate mixed in a French accent');

const wanted = heatLines({ stars: 2 });
assert.equal(wanted.head, 'WANTED');
assert.equal(wanted.line, '2 stars');
assert.equal(heatLines({ stars: 1 }).line, '1 star');
assert.equal(heatLines({ stars: 2, down: 'arrested' }).head, 'ARRESTED');
assert.equal(heatLines({ down: 'arrested' }).line, 'To Poste de quartier 38');
assert.equal(heatLines({ down: 'knocked' }).head, 'KNOCKED OUT');
assert.equal(heatLines({ down: 'knocked' }).line, 'To Hôpital Notre-Dame');
assert.equal(heatLines(null).head, '');
assert.ok(!/[\u00e9\u00e8\u00ea]/.test(`${wanted.head} ${wanted.line}`), 'the star plate mixed languages');

const column = columnLines({ title: 'Car thief', objective: 'Ram the stolen car until it gives', info: '40 m  ·  damage 55 %' });
assert.equal(column.title, 'Car thief');
assert.equal(column.objective, 'Ram the stolen car until it gives');
assert.equal(column.info, '40 m  ·  damage 55 %');
assert.equal(columnLines({ title: 'Ink overrun', info: '12 m  ·  down 2/6' }).info, '12 m  ·  down 2/6');
assert.equal(columnLines(null).title, '');
assert.ok(!/[\u00e9\u00e8\u00ea]/.test(`${column.title} ${column.objective} ${column.info}`), 'the job column mixed languages');
const heard = speechLines('Hi! A walk in the park feels good.');
assert.equal(heard.line, 'Hi! A walk in the park feels good.');
assert.equal(speechLines('').line, '');
assert.ok(!/[\u00e9\u00e8\u00ea\u00e0]/.test(heard.line), 'the resident line mixed languages');
const born = scuffPuff(0, 0);
assert.equal(born.back, 0);
assert.equal(born.up, 6);
assert.equal(born.radius, 12);
assert.equal(born.side, -8);
const mid = scuffPuff(0.52, 1);
assert.ok(Math.abs(mid.back - 0.52 * 84) < 1e-9, 'the mid puff left the shoe');
assert.equal(mid.side, 8);
assert.ok(mid.radius > born.radius, 'the mid puff did not grow');
assert.ok(mid.up > born.up + 20, 'the puff did not rise');
assert.ok(scuffPuff(0.7, 0).radius < 0.05, 'a finished puff still has a radius');
const pistol = weaponLines('PISTOL');
assert.equal(pistol.name, 'PISTOL');
assert.equal(weaponLines('').name, '');
assert.ok(!/[\u00e9\u00e8\u00ea\u00e0]/.test(pistol.name), 'the weapon mixed languages');
const tail = exhaustPuff(0, 1);
assert.equal(tail.back, 0);
assert.equal(tail.up, 0);
assert.ok(Math.abs(tail.swell - 0.16) < 1e-9, 'the birth puff left the tail');
assert.equal(tail.side, 0);
const risen = exhaustPuff(0.55, 0);
assert.ok(Math.abs(risen.back - 0.55 * 160) < 1e-6, 'the mid puff left the tail');
assert.ok(risen.up > tail.up + 90, 'the tail puff did not rise');
assert.ok(risen.swell > tail.swell, 'the tail puff did not grow');
assert.ok(risen.side < 0, 'the column lost its weave');
assert.ok(exhaustPuff(1.1, 2).swell < 0.01, 'a finished tail puff still has swell');
let live = 0;
for (let slot = 0; slot < 6; slot += 1) {
  const age = 0.05 + slot * 0.16;
  if (age >= 0 && age < 1.1 && exhaustPuff(age, slot).swell > 0.05) live += 1;
}
assert.equal(live, 6);
assert.equal(skyLine(15, 'CLEAR'), '15:00 · CLEAR');
assert.equal(skyLine(15.9, 'RAIN'), '15:54 · RAIN');
assert.equal(skyLine(0, 'FOG'), '00:00 · FOG');
assert.equal(skyLine(24, 'CLEAR'), '23:59 · CLEAR');
assert.equal(skyLine(-3, 'BREEZY'), '00:00 · BREEZY');
assert.equal(skyLine(9.5, ''), '');
assert.ok(!/[\u00e9\u00e8\u00ea\u00e0]/.test(skyLine(12, 'OVERCAST')), 'the sky line mixed languages');
assert.ok(!/[\u00e9\u00e8\u00ea\u00e0]/.test(skyLine(8, 'DRIZZLE')), 'the sky line mixed languages');

console.log('mission card lines and marker ok');
