// Light Years Home v3: scans, rumours, secrets, sets and sparks (final.md 18.1, 10). Scripted runs: the nose holds a
// near target in a 25° cone for 0.8 s and a far one in 6° (Cruise 10°) for 3 s; Look Home is 10° for 1 s; Cruise
// scans what you pass close; a rumour turns its secret's ring faint; set items shimmer from 250 u and show in full
// inside 80 u; each secret's rule (The Overlook, The Ghost, Zwicky's ride, The Shadow's drift lap with the drift bot);
// a set's last item finishes it; a spark gives +0.04 bar. node qa/light-years-home/v3/discovery.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { farDir, scanState, ringStates, setMarks, sparkPositions } from '../../../public/light-years-home/core/zone.js';
import { builtOf, registerZone } from '../../../public/light-years-home/core/game.js';
import { posAt, velAt, KIND } from '../../../public/light-years-home/core/traffic.js';
import { BOTS, steerTo } from '../../../public/light-years-home/core/bots.js';
import { wireAll, newGame, run, of, place, stepOnce, H, WALL, COMA, QUIET } from './activities.mjs';

wireAll();
const PILOT = { assists: 'pilot' }, CRUISE = { assists: 'cruise' };
const headingOf = (v) => (Math.atan2(v[0], v[1]) * 180) / Math.PI;
const ids = (events, type) => of(events, type).map((e) => e.id);

test('scan cones and holds: near (25° for 0.8 s), far (6°, Cruise 10°, for 3 s) and Look Home (10° for 1 s)', () => {
  const T = newGame().tune.ZONE;
  // Node 0 from the east, in Pilot (no auto-scan): nose on it, the scan lands after SCAN_T.
  let g = newGame({ settings: PILOT });
  place(g, [110, 0, 0], 270, 24);
  let r = run(g, () => ({ gas: 0.3 }), 1.2, { until: (game) => game.zone.scanned.node0 });
  const start = of(r.events, 'scanStart').find((e) => e.id === 'node0');
  const done = of(r.events, 'scan').find((e) => e.id === 'node0');
  assert.ok(start && done, 'node0 scanned');
  assert.ok(Math.abs(done.t - start.t - T.SCAN_T) < 0.05, `held ${(done.t - start.t).toFixed(2)} s`);
  assert.equal(done.card, 'node0');
  // 40° off the nose: no scan. Back on it after looking away: the hold starts again.
  g = newGame({ settings: PILOT });
  place(g, [110, 0, 0], 270 + 40, 24);
  r = run(g, () => ({ gas: 0.3 }), 1.5);
  assert.ok(!ids(r.events, 'scanStart').includes('node0'), 'outside the cone');
  g = newGame({ settings: PILOT });
  place(g, [110, 0, 0], 270, 24);
  run(g, () => ({ gas: 0.3 }), 0.5);
  assert.equal(scanState(g, 'node0'), 'scanning');
  place(g, g.ship.pos.slice(), 270 + 60, 24);
  run(g, () => ({ gas: 0.3 }), 0.3);
  assert.equal(scanState(g, 'node0'), 'seen');
  place(g, g.ship.pos.slice(), headingOf([-g.ship.pos[0], -g.ship.pos[1]]), 24);
  r = run(g, () => ({ gas: 0.3 }), 1.2, { until: (game) => game.zone.scanned.node0 });
  const again = of(r.events, 'scan').find((e) => e.id === 'node0');
  assert.ok(again, 'scanned');
  assert.ok(again.t - of(r.events, 'scanStart').find((e) => e.id === 'node0').t >= T.SCAN_T - 0.02, 'a full hold again');

  // The Leo Cluster, 8° off the nose: Pilot's 6° cone misses, Cruise's 10° holds it for 3 s.
  const leo = headingOf(farDir(WALL, 'leo'));
  for (const [settings, off, want] of [[PILOT, 8, false], [CRUISE, 8, true], [PILOT, 4, true]]) {
    g = newGame({ settings });
    place(g, [100, -200, 0], leo + off, 24);
    r = run(g, () => ({ gas: 0.3 }), 4);
    const far = of(r.events, 'farScan').find((e) => e.id === 'far-leo');
    assert.equal(!!far, want, `${settings.assists} ${off}°`);
    if (far) {
      const s0 = of(r.events, 'scanStart').find((e) => e.id === 'far-leo');
      assert.ok(Math.abs(far.t - s0.t - T.FAR_T) < 0.05, `far hold ${(far.t - s0.t).toFixed(2)} s`);
    }
  }

  // Look Home in the Wall: Earth is 47° east of north and 12° up. Cruise forgives the height; Pilot climbs a little.
  const earth = farDir(WALL, 'earth');
  for (const [settings, climb, want] of [[CRUISE, 0, true], [PILOT, 0, false], [PILOT, 0.3, true]]) {
    g = newGame({ settings });
    place(g, [100, -200, 0], headingOf(earth), 24);
    r = run(g, () => ({ gas: 0.3, climb }), 3);
    const lh = of(r.events, 'lookHome')[0];
    assert.equal(!!lh, want, `${settings.assists} climb ${climb}`);
    if (lh) {
      assert.equal(lh.card, 'oxygen');
      assert.ok(lh.t >= T.LOOK_HOME_T - 1e-6 && lh.t < 1.5, `at ${lh.t.toFixed(2)} s`);
      assert.ok(g.progress.postcards.includes('oxygen'));
    }
  }
});

test('Cruise auto-scans what you pass close; Pilot does not', () => {
  // NGC 4911 sits beside the COMA DIVE line; pass it 25 u to the side, never pointing at it.
  const b = COMA.bodies.find((x) => x.id === 'ngc4911');
  for (const [settings, want] of [[CRUISE, true], [PILOT, false]]) {
    const g = newGame({ zone: COMA, settings });
    place(g, [b.pos[0] + 25, b.pos[1] - 60, 0], 0, 30);
    const r = run(g, () => ({ gas: 0.5 }), 4);
    const scan = of(r.events, 'scan').find((e) => e.id === 'ngc4911');
    assert.equal(!!scan, want, settings.assists);
    if (scan) assert.ok(!ids(r.events, 'scanStart').includes('ngc4911'), 'no hold: it just lands');
  }
});

test("a rumour turns its secret's ring faint; The Overlook needs the height", () => {
  const g = newGame({ settings: PILOT });
  const ring = () => ringStates(g).find((x) => x.id === 'overlook').state;
  assert.equal(ring(), 'hidden');
  // Scan the filament: look along the Sloan Road from the entry.
  place(g, [0, -400, 0], 0, 30);
  let r = run(g, () => ({ gas: 0.5 }), 3, { until: (game) => game.zone.rumours['wall-high'] });
  assert.ok(ids(r.events, 'scan').includes('filament'));
  const rumour = of(r.events, 'rumour')[0];
  assert.equal(rumour.id, 'wall-high');
  assert.equal(rumour.opens, 'overlook');
  assert.equal(ring(), 'faint');
  // Over Void West at the floor: nothing. At 115 u up: found, with the vista.
  place(g, [-250, 200, 0], 45, 24);
  r = run(g, () => ({ gas: 0.3 }), 1);
  assert.equal(of(r.events, 'secret').length, 0, 'too low');
  place(g, [-250, 200, 115], 45, 24);
  r = run(g, () => ({ gas: 0.3 }), 1);
  const s = of(r.events, 'secret')[0];
  assert.ok(s, 'found');
  assert.deepEqual([s.id, s.card, s.vista], ['overlook', 'sloan-wall', true]);
  assert.equal(ring(), 'found');
  assert.ok(g.progress.zones.wall.secrets.includes('overlook'));
});

test('set items shimmer and show on the radar from 250 u, in full inside 80 u; driving through one collects it', () => {
  const g = newGame({ zone: COMA, settings: CRUISE });
  const q = COMA.sets.ghosts.items[0];
  const mark = () => setMarks(g).find((m) => m.set === 'ghosts' && m.i === 0)?.state ?? 'none';
  for (const [d, want] of [[300, 'none'], [240, 'shimmer'], [120, 'shimmer'], [75, 'visible']]) {
    place(g, [q[0] + d, q[1], q[2]], 270, 24);
    assert.equal(mark(), want, `${d} u`);
  }
  // Drive through it: collected (1 of 10), scanned in passing (Cruise), and its rumour opens The Ghost.
  place(g, [q[0] + 40, q[1], q[2]], 270, 30);
  const r = run(g, () => ({ gas: 0.5 }), 2.5);
  const item = of(r.events, 'setItem')[0];
  assert.ok(item, 'collected');
  assert.deepEqual([item.id, item.i, item.n, item.of], ['ghosts', 0, 1, 10]);
  assert.equal(mark(), 'none');
  assert.ok(ids(r.events, 'scan').includes('udg'));
  assert.ok(ids(r.events, 'rumour').includes('bigger-ghost'));
  assert.equal(ringStates(g).find((x) => x.id === 'the-ghost').state, 'faint');
});

test("each secret's rule on a scripted run: The Ghost, Zwicky's ride, The Shadow's drift lap", () => {
  // The Ghost: reach (−560, 330) within 25 u.
  let g = newGame({ zone: COMA });
  place(g, [-560 + 45, 330, 0], 270, 30);
  let r = run(g, () => ({ gas: 0.5 }), 2);
  const ghost = of(r.events, 'secret').find((e) => e.id === 'the-ghost');
  assert.ok(ghost && ghost.card === 'udg-big');
  assert.ok(g.progress.trails.includes('ghost'));

  // Zwicky's Clue: ride 2.5 u behind one Inner Ring galaxy for 5 s, holding the gas and easing off when close.
  g = newGame({ zone: COMA });
  run(g, () => ({}), H);
  const tr = builtOf(g).traffic;
  let i = 0;
  while (!(tr.kind[i] === KIND.orbit && tr.road[i] === 0)) i++;
  const P = [0, 0, 0], V = [0, 0, 0];
  posAt(tr, i, g.zoneT, P); velAt(tr, i, g.zoneT, V);
  const yaw = Math.atan2(V[0], V[1]), gap0 = tr.size[i] + 3;
  place(g, [P[0] - Math.sin(yaw) * gap0, P[1] - Math.cos(yaw) * gap0, P[2]], (yaw * 180) / Math.PI, Math.hypot(V[0], V[1]));
  let near = Infinity, far = 0;
  r = run(g, (game) => {
    posAt(tr, i, game.zoneT, P); velAt(tr, i, game.zoneT, V);
    const s = game.ship;
    const gap = Math.hypot(P[0] - s.pos[0], P[1] - s.pos[1], P[2] - s.pos[2]) - tr.size[i];
    near = Math.min(near, gap); far = Math.max(far, gap);
    const want = Math.hypot(V[0], V[1]) + 1.5 * (gap - 2.5);
    return { steer: steerTo(game, Math.atan2(P[0] - s.pos[0], P[1] - s.pos[1])), climb: Math.max(-1, Math.min(1, 0.2 * (P[2] - s.pos[2]))),
      gas: s.speed < want - 0.3 ? 1 : 0, brake: s.speed > want + 0.6 ? Math.min(1, (s.speed - want) / 4) : 0 };
  }, 7, { until: (game) => game.zone.secrets['zwickys-clue'] });
  const zw = of(r.events, 'secret').find((e) => e.id === 'zwickys-clue');
  assert.ok(zw, `ridden (gap ${near.toFixed(1)} to ${far.toFixed(1)} u)`);
  assert.ok(zw.t >= 5 && zw.t < 5.6, `after ${zw.t.toFixed(2)} s`);
  assert.equal(zw.lens, 'dark-matter');
  assert.equal(of(r.events, 'crash').length + of(r.events, 'bigCrash').length, 0);

  // The Shadow (the jet pocket is Round 2: M87*'s data on a stand-in zone). The drift bot laps it within 20 u at
  // 26 u/s or more in under 4 s; too slow a lap does not count.
  const HOLE = Object.freeze({ ...QUIET, id: 'hole-test',
    bodies: [{ id: 'm87bh', pos: [0, 120, 0], r: 6, rc: 3, well: { rs: 14, gain: 0.9, refS: 36 } }],
    secrets: [{ id: 'the-shadow', rumour: 'orbit-light', when: { lap: 'm87bh', within: 20, minSpeed: 26, seconds: 4 },
      reward: { card: 'photon-ring', trail: 'photon' } }] });
  registerZone(HOLE);
  for (const [speed, want] of [[30, true], [32, true], [22, false]]) {
    g = newGame({ zone: HOLE, at: [16, 120, 0], heading: 0, speed });
    const bot = BOTS.drifter.make({ body: 'm87bh', lap: true, R: 15, tier: 3 });
    let t0 = null, minV = Infinity, maxD = 0;
    r = run(g, (game) => {
      const s = game.ship;
      if (s.drift.on) {
        if (t0 === null) t0 = game.t;
        minV = Math.min(minV, s.speed);
        maxD = Math.max(maxD, Math.hypot(s.pos[0], s.pos[1] - 120));
      }
      return bot.next(game);
    }, 6, { until: (game) => game.zone.secrets['the-shadow'] });
    const sh = of(r.events, 'secret').find((e) => e.id === 'the-shadow');
    assert.equal(!!sh, want, `${speed} u/s: slowest ${minV.toFixed(1)}, widest ${maxD.toFixed(1)} u`);
    if (sh) {
      assert.ok(sh.t - t0 < 4, `a lap in ${(sh.t - t0).toFixed(2)} s`);
      assert.ok(minV >= 26 && maxD <= 20);
      assert.ok(g.progress.trails.includes('photon'));
    }
  }
});

test('sets count to their reward; sparks give +0.04 bar once each', () => {
  // The last ghost finishes the set.
  let g = newGame({ zone: COMA, settings: PILOT });
  const items = COMA.sets.ghosts.items;
  g.zone.sets.ghosts = items.map((_, k) => (k === items.length - 1 ? 0 : 1));
  const q = items[items.length - 1];
  place(g, [q[0] + 40, q[1], q[2]], 270, 30);
  let r = run(g, () => ({ gas: 0.5 }), 2.5);
  const last = of(r.events, 'setItem')[0];
  assert.equal(last.n, items.length);
  const done = of(r.events, 'setDone')[0];
  assert.ok(done && done.card === 'udg-many');
  assert.ok(g.progress.trails.includes('pale'));
  assert.equal(g.progress.zones.coma.sets.ghosts.filter(Boolean).length, items.length);

  // A spark on the line east of Node 0: +0.04 bar, once.
  g = newGame({ settings: PILOT });
  run(g, () => ({}), H);
  const pos = sparkPositions(WALL, builtOf(g).traffic);
  assert.equal(pos.length / 3, g.zone.sparks.length);
  assert.equal(g.zone.sparks.length, 24);
  const k = 16, sp = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  const dir = [sp[0] - 0, sp[1] - 0];
  const l = Math.hypot(dir[0], dir[1]);
  place(g, [sp[0] - (dir[0] / l) * 20, sp[1] - (dir[1] / l) * 20, sp[2]], headingOf(dir), 24);
  g.ship.bar = 0.5;
  let got = null;
  for (let n = 0; n < 240 && !got; n++) {
    const before = g.ship.bar;
    const evs = stepOnce(g, { gas: 0.3 });
    const e = evs.find((x) => x.type === 'spark');
    if (e) got = { e, d: g.ship.bar - before };
  }
  assert.ok(got, 'collected');
  assert.equal(got.e.i, k);
  assert.ok(Math.abs(got.d - g.tune.BAR.SPARK) < 0.004, `+${got.d.toFixed(3)}`);
  assert.equal(g.tune.BAR.SPARK, 0.04);
  assert.equal(g.zone.sparks[k], 1);
  assert.ok(g.progress.zones.wall.sparks, 'saved as a bitfield');
  // Back through it: nothing more.
  place(g, [sp[0] - (dir[0] / l) * 20, sp[1] - (dir[1] / l) * 20, sp[2]], headingOf(dir), 24);
  r = run(g, () => ({ gas: 0.3 }), 1.5);
  assert.ok(!of(r.events, 'spark').some((e) => e.i === k));
});
