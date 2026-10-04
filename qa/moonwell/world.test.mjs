// Moonwell: checks of the endless world. node qa/moonwell/world.test.mjs
import { createWorld, ensure, trim, station, lastIndex, REGION, BALL_R as R, isShrine } from '../../public/moonwell/world.js';
import { surfaceY } from '../../public/moonwell/run.js';
import { test, assert, report } from './check.mjs';

const sig = (s) => JSON.stringify([s.x0, s.y0, s.cx, s.fy, s.x1, s.y1, s.P, s.stars, s.bumpers, s.lanterns, s.mills, s.rail && s.rail.pts, s.portal, s.well, s.pearl]);
const worldTo = (seed, k) => { const w = createWorld(seed); ensure(w, k); return w; };

test('the same seed gives the same islands', () => {
  const a = worldTo(77, 60), b = worldTo(77, 60);
  for (let k = 0; k <= 60; k++) assert(sig(station(a, k)) === sig(station(b, k)), `island ${k + 1} differs`);
});

test('another seed gives other islands', () => {
  const a = worldTo(77, 30), b = worldTo(78, 30);
  let same = 0;
  for (let k = 1; k <= 30; k++) if (sig(station(a, k)) === sig(station(b, k))) same++;
  assert(same === 0, `${same} islands are the same`);
});

test('the level goes on: 1,000 islands, joined up, with the old ones dropped', () => {
  const w = createWorld(5);
  let prev = null, maxLen = 0;
  for (let k = 0; k < 1000; k++) {
    ensure(w, k + 3);
    trim(w, k);
    maxLen = Math.max(maxLen, w.list.length);
    const s = station(w, k);
    assert(s, `island ${k + 1} missing`);
    for (const v of [s.x0, s.y0, s.cx, s.fy, s.x1, s.y1, s.P]) assert(Number.isFinite(v), `island ${k + 1} has a bad number`);
    assert(s.x0 < s.cx - s.P && s.cx + s.P < s.x1, `island ${k + 1}: the bowl does not fit between its ridges`);
    assert(s.fy >= -200 && s.fy <= 200, `island ${k + 1}: floor ${s.fy} out of range`);
    assert(s.fy - s.y0 >= 139 && s.fy - s.y1 >= 199, `island ${k + 1}: a ridge is too low`);
    if (prev) {
      assert(prev.x1 === s.x0 && prev.y1 === s.y0, `island ${k + 1} does not join the one before`);
      const a = prev.right[prev.right.length - 1], b = s.left[0];
      assert(a[0] === b[0] && a[1] === b[1], `the slopes of island ${k + 1} do not meet at the ridge`);
    }
    prev = s;
  }
  assert(maxLen <= 12, `the world kept ${maxLen} islands at once`);
});

test('every eighth island is a sealed shrine with a moonwell', () => {
  const w = worldTo(9, 80);
  for (let k = 0; k <= 80; k++) {
    const s = station(w, k);
    assert(isShrine(k) === (k % REGION === REGION - 1), 'shrine rule');
    if (isShrine(k)) assert(s.sealed && s.well && !s.rail && !s.portal && !s.bumpers.length, `island ${k + 1} is not a proper shrine`);
    else assert(!s.sealed && !s.well, `island ${k + 1} is sealed but not a shrine`);
  }
});

test('rails and portals never skip a shrine', () => {
  let rails = 0, portals = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = worldTo(seed, 90);
    for (let k = 0; k <= 90; k++) {
      const s = station(w, k);
      const next = Math.ceil((k + 1) / REGION) * REGION - 1;
      if (s.rail) { rails++; assert(s.rail.to < next && s.rail.to >= k + 2, `seed ${seed}: the rail on island ${k + 1} goes to ${s.rail.to + 1}`); }
      if (s.portal) { portals++; assert(s.portal.to < next && station(w, s.portal.to).exit, `seed ${seed}: the portal on island ${k + 1} has no exit before the shrine`); }
    }
  }
  assert(rails > 40 && portals > 15, `too few rails (${rails}) or portals (${portals}) in 40 runs`);
});

test('a rail moves right from its mouth to its last island', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = worldTo(seed, 80);
    for (let k = 0; k <= 80; k++) {
      const r = station(w, k).rail;
      if (!r) continue;
      const end = r.pts[r.pts.length - 1], to = station(w, r.to);
      assert(end[0] > to.x0 && end[0] < to.cx - to.P, `seed ${seed}: the rail from island ${k + 1} does not end over the left slope of island ${r.to + 1}`);
      assert(end[1] < surfaceY(to.left, end[0]) - R, `seed ${seed}: the rail from island ${k + 1} ends under the ground`);
    }
  }
});

test('stars, bumpers, lanterns, portals and pearls float above the ground', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = worldTo(seed, 60);
    for (let k = 0; k <= 60; k++) {
      const s = station(w, k);
      const ground = (x) => (x <= s.cx - s.P ? surfaceY(s.left, x) : x >= s.cx + s.P ? surfaceY(s.right, x) : s.fy);
      const items = [...s.stars, ...s.bumpers, ...s.lanterns, s.portal, s.pearl, s.well].filter(Boolean);
      for (const o of items) {
        if (o.x < s.x0 || o.x > s.x1) continue;
        assert(o.y < ground(o.x) - R - (o.r || 0) + 4, `seed ${seed}: island ${k + 1} has something in the ground at ${o.x | 0},${o.y | 0}`);
      }
      for (const o of [...s.bumpers, ...s.lanterns, ...s.mills, s.portal].filter(Boolean)) {
        assert(!(Math.abs(o.x - s.cx) < s.P + 30 && o.y > s.fy - 230), `seed ${seed}: island ${k + 1} has a feature over its flippers`);
      }
    }
  }
});

test('the first islands are gentle, and later ones are harder', () => {
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const early = [], late = [], gapE = [], gapL = [], millsE = [], millsL = [];
  for (let seed = 1; seed <= 20; seed++) {
    const w = worldTo(seed, 70);
    const s0 = station(w, 0);
    assert(s0.bumpers.length === 0 && s0.mills.length === 0 && s0.stars.length >= 4, 'island 1 is not a plain teaching island');
    for (let k = 0; k <= 2; k++) assert(station(w, k).posts.length === 1, `island ${k + 1} has no moon post`);
    assert(station(w, 3).posts.length === 0, 'island 4 still has a moon post');
    for (let k = 1; k <= 10; k++) { early.push(station(w, k).Hr); gapE.push(station(w, k).P); millsE.push(station(w, k).mills.length); }
    for (let k = 50; k <= 70; k++) { late.push(station(w, k).Hr); gapL.push(station(w, k).P); millsL.push(station(w, k).mills.length); }
  }
  assert(mean(late) > mean(early) + 100, `ridges: ${mean(early) | 0} early, ${mean(late) | 0} late`);
  assert(mean(gapL) > mean(gapE) + 6, 'the gap between the flippers does not widen');
  assert(mean(millsL) > mean(millsE) + 0.2, 'mills do not appear more often');
});

test('islands are generated ahead and dressed four behind that', () => {
  const w = createWorld(3);
  ensure(w, 20);
  assert(lastIndex(w) >= 24 && w.decorated >= 20, 'the world is not ready ahead of the pearl');
});

report();
