// Light Years Home: checks of Earth's clock, the "On Earth" cards, the radio from home and the arrival date.
// node qa/light-years-home/timeline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayFrom, weekdayOf, earthYearsAgo, earthYear, earthDateText, milestonesBetween, milestoneAgo, milestoneWhen,
  signalYear, heardYear, arrivalText, RADIO_START,
} from '../../public/light-years-home/core/timeline.js';
import { MILESTONES } from '../../public/light-years-home/core/milestones.js';

const TODAY = todayFrom({ y: 2026, m: 10, d: 13 });

// Leg lengths in light-years from the stop table in the design (final.md 2.7); the last leg is 40 AU.
const LEGS = [737321302, 271909334, 141648564, 61874788, 2445098, 57763, 8430, 94, 748, 315, 383, 61, 9.5, 4.3,
  40 / 63241.077];
const ROUTE = LEGS.reduce((a, b) => a + b, 0);
const aheadAtStart = (leg) => ROUTE - LEGS.slice(0, leg - 1).reduce((a, b) => a + b, 0);   // leg is 1-based
const aheadAtEnd = (leg) => aheadAtStart(leg) - LEGS[leg - 1];

// Heliocentric galactic positions in light-years (research astro.md, from Wikipedia distances and coordinates).
const POS = { aldebaran: [-62.52, -1.06, -23.06], sirius: [-5.78, -6.24, -1.33], alphaCen: [3.11, -3.03, -0.05] };
const dist = (a, b = [0, 0, 0]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('today: 13 October 2026 is a Tuesday, about 2026.78', () => {
  assert.equal(TODAY.weekday, 2);
  assert.ok(Math.abs(TODAY.frac - 2026.78) < 0.005, `frac ${TODAY.frac}`);
  assert.deepEqual(todayFrom('2026-10-13'), TODAY);
  assert.deepEqual(todayFrom(new Date(2026, 9, 13, 12)), TODAY);
  assert.deepEqual(todayFrom({ year: 2026, month: 10, day: 13 }), TODAY);
  assert.deepEqual(todayFrom({ y: 2026, m: 2, d: 30 }), TODAY, 'an impossible date falls back');
  assert.deepEqual(todayFrom('junk'), TODAY);
  assert.deepEqual(todayFrom(new Date(NaN)), TODAY);
  assert.equal(weekdayOf(2000, 1, 1), 6);
  assert.equal(weekdayOf(1969, 7, 20), 0);
  assert.equal(weekdayOf(2024, 2, 29), 4);
  assert.equal(todayFrom({ y: 2027, m: 1, d: 1 }).weekday, 5);
});

test('Earth date: today minus the route still ahead', () => {
  assert.ok(Math.abs(ROUTE - 1215266893) < 1215266893 * 0.001, `route ${ROUTE}`);
  assert.equal(earthDateText(ROUTE, TODAY), '1.22 BILLION YEARS AGO');
  assert.equal(earthDateText(aheadAtEnd(1), TODAY), '478 MILLION YEARS AGO');
  assert.equal(earthDateText(aheadAtEnd(5), TODAY), '67,800 YEARS AGO');
  assert.match(earthDateText(aheadAtEnd(6), TODAY), /^80\d\d BC$/);
  assert.match(earthDateText(aheadAtEnd(7), TODAY), /^41\d AD$/);
  assert.match(earthDateText(aheadAtEnd(11), TODAY), /^195[12]$/);
  assert.equal(earthDateText(0, TODAY), 'TODAY');
  assert.equal(earthDateText(LEGS[14], TODAY), '2026');
  assert.equal(earthYearsAgo(-5), 0);
  assert.equal(earthYearsAgo(NaN), 0);
  assert.ok(Math.abs(earthYear(TODAY, 57) - (TODAY.frac - 57)) < 1e-12);
});

test('milestones: at most 30, sourced, plain, oldest first, all inside the journey', () => {
  assert.ok(MILESTONES.length > 0 && MILESTONES.length <= 30);
  const ids = new Set();
  let prev = Infinity;
  for (const m of MILESTONES) {
    assert.ok(/^[a-z0-9-]+$/.test(m.id) && !ids.has(m.id), `id ${m.id}`);
    ids.add(m.id);
    assert.match(m.source, /^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/, `${m.id} source`);
    assert.ok(typeof m.text === 'string' && m.text.length <= 70 && /^[A-Z].*\.$/.test(m.text), `${m.id} text`);
    assert.ok(!/[—–]/.test(m.text), `${m.id}: no dashes`);
    assert.equal(typeof m.about, 'boolean');
    assert.ok(m.yearsAgo > 0 && m.yearsAgo < ROUTE, `${m.id} happens during the journey`);
    assert.ok(m.yearsAgo < prev, `${m.id} is in order`);
    prev = m.yearsAgo;
  }
  const first = MILESTONES[0];
  assert.equal(first.text, 'Life is mostly single cells.');
  assert.equal(first.yearsAgo, 1.2e9);
  for (const id of ['asteroid', 'ice-age-ends', 'farming', 'copernicus', 'radio']) assert.ok(ids.has(id), id);
  assert.equal(MILESTONES.find((m) => m.id === 'asteroid').yearsAgo, 66.04e6);
  assert.equal(MILESTONES.find((m) => m.id === 'radio').year, 1895.5);
});

test('milestones: each comes back once, in order, when flown tick by tick', () => {
  const got = [];
  let ahead = ROUTE;
  for (let leg = 1; leg <= LEGS.length; leg++) {
    const steps = 400;
    for (let i = 1; i <= steps; i++) {
      // most of a leg passes early, as on screen, then slowly to the end
      const s = (1 - Math.exp(-6 * i / steps)) / (1 - Math.exp(-6));
      const next = aheadAtStart(leg) - LEGS[leg - 1] * s;
      got.push(...milestonesBetween(ahead, next, TODAY).map((m) => ({ id: m.id, leg })));
      ahead = next;
    }
  }
  assert.deepEqual(got.map((g) => g.id), MILESTONES.map((m) => m.id));
  const legOf = Object.fromEntries(got.map((g) => [g.id, g.leg]));
  // the chapter-card lines are true when they show: I ends at Fornax (leg 3), II at Carina (6), III at the Pleiades (10)
  assert.ok(legOf['single-cells'] === 1 && legOf.asteroid === 3);
  assert.ok(legOf['ice-age-ends'] === 6 && legOf.farming === 6);
  assert.equal(legOf.copernicus, 10);
  assert.equal(legOf.radio, 11);
  assert.deepEqual(milestonesBetween(10, 10, TODAY), []);
  assert.deepEqual(milestonesBetween(1e9, 1.1e9).map((m) => m.id), ['seaweed'], 'either order');
});

test('the asteroid card shows on leg 3 at p in (0.98, 1)', () => {
  const start = aheadAtStart(3), len = LEGS[2];
  let at = null;
  for (let p = 0.0005; p <= 1 && at === null; p += 0.0005) {
    if (milestonesBetween(start - len * (p - 0.0005), start - len * p, TODAY).some((m) => m.id === 'asteroid')) at = p;
  }
  assert.ok(at > 0.98 && at < 1, `asteroid at p ${at}`);
});

test('calendar milestones follow the real date', () => {
  const later = todayFrom({ y: 2027, m: 6, d: 1 });
  const moon = MILESTONES.find((m) => m.id === 'moon');
  assert.ok(Math.abs(milestoneAgo(moon, later) - (later.frac - 1969.55)) < 1e-9);
  assert.ok(Math.abs(milestoneAgo(moon, TODAY) - moon.yearsAgo) < 1e-9);
  const deep = MILESTONES.find((m) => m.id === 'asteroid');
  assert.equal(milestoneAgo(deep, later), deep.yearsAgo);
  assert.deepEqual(milestonesBetween(later.frac - 1969, later.frac - 1970, later).map((m) => m.id), ['moon']);
  assert.equal(milestoneWhen(MILESTONES[0], TODAY), 'About 1.2 billion years before today');
  assert.equal(milestoneWhen(deep, TODAY), '66 million years before today');
  assert.equal(milestoneWhen(moon, TODAY), '1969');
  assert.equal(milestoneWhen(MILESTONES.find((m) => m.id === 'writing'), TODAY), 'About 3200 BC');
  assert.equal(milestoneWhen(MILESTONES.find((m) => m.id === 'aryabhata'), TODAY), '499 AD');
});

test('radio: silent at Aldebaran (1885), 2004 at Sirius, 2018 at Alpha Centauri', () => {
  const sirToCen = dist(POS.sirius, POS.alphaCen), cenToSun = dist(POS.alphaCen);
  const aheadAld = dist(POS.aldebaran, POS.sirius) + sirToCen + cenToSun;
  const ald = signalYear(TODAY, aheadAld, dist(POS.aldebaran));
  assert.ok(Math.abs(ald - 1885) <= 1, `Aldebaran ${ald}`);
  assert.equal(heardYear(TODAY, aheadAld, dist(POS.aldebaran)), null);
  const sir = heardYear(TODAY, sirToCen + cenToSun, dist(POS.sirius));
  assert.ok(Math.abs(sir - 2004) <= 1, `Sirius ${sir}`);
  const cen = heardYear(TODAY, cenToSun, dist(POS.alphaCen));
  assert.ok(Math.abs(cen - 2018) <= 1, `Alpha Centauri ${cen}`);
  assert.equal(heardYear(TODAY, 0, 0), 2026);
  assert.equal(RADIO_START, 1895);
  // the first signal: heard years cross 1895 early on the Sirius leg
  const legLen = dist(POS.aldebaran, POS.sirius);
  let first = null;
  for (let p = 0; p <= 1 && first === null; p += 0.001) {
    const at = POS.aldebaran.map((c, i) => c + (POS.sirius[i] - c) * p);
    if (heardYear(TODAY, aheadAld - legLen * p, dist(at)) !== null) first = p;
  }
  assert.ok(first > 0.02 && first < 0.2, `first radio at p ${first}`);
});

test('arrival: the date is today, in words', () => {
  assert.deepEqual(arrivalText(TODAY), { weekday: 'Tuesday', date: '13 October 2026', line: 'It is Tuesday, 13 October 2026.' });
  assert.deepEqual(arrivalText({ y: 2026, m: 10, d: 13 }), arrivalText(TODAY));
  assert.equal(arrivalText('2027-01-01').line, 'It is Friday, 1 January 2027.');
  assert.equal(earthDateText(0, TODAY), 'TODAY');
});
