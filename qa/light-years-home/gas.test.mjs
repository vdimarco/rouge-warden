// Light Years Home: gas model checks. The spiral arms put the Sun and Carina where the papers do, the path into the
// Milky Way keeps clear of the centre and meets the gas layer only at the end, the arms it passes over come with their
// heights, and each part of the model (solar wind, asteroid belt, clouds, bubbles, disc, halo) gives its density.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTS, AU_LY } from '../../public/light-years-home/core/objects.js';
import {
  ARMS, CLOUDS, GAS_SCALE_LY, armAt, armWeights, armsPassed, cloudAt, densityAt, sampleAt, galacticHeight, gcDistance,
  galactocentric, inAsteroidBelt, checkZones, medianDensity, pathLength, pointAlong, fromGalactic, N_HALO, N_IGM,
} from '../../public/light-years-home/core/gas.js';

const pos = (id) => OBJECTS[id].pos;
// The two legs these checks fly, as v1's route had them (straight, no via points): into the Milky Way to Carina, and
// Carina to Orion's Belt.
const LEG_6 = ['mw-entry', 'carina'];
const LEG_7 = ['carina', 'orions-belt'];
const legPoints = (ids) => ids.map(pos);
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

test('the arm model puts the Sun in the Orion (Local) Arm and Carina on the Sagittarius–Carina Arm', () => {
  const sun = armAt([0, 0, 0]);
  assert.equal(sun.id, 'local');
  assert.ok(sun.inArm, `Sun weight ${sun.weight}`);
  const carina = armAt(pos('carina'));
  assert.equal(carina.id, 'sagittarius-carina');
  assert.ok(carina.inArm, `Carina weight ${carina.weight}`);
  const orion = armAt(pos('orion-nebula'));
  assert.equal(orion.id, 'local');
  assert.ok(orion.inArm);
});

test('Reid 2019 radii: the Sun sits 376 pc inside the Local Arm and 1.92 kpc inside Perseus', () => {
  const { R, beta } = galactocentric([0, 0, 0]);
  assert.ok(Math.abs(beta) < 1e-6);
  assert.ok(near(R, 26996, 1e-3), `R0 ${R}`);
  const w = armWeights([0, 0, 0]);
  const local = ARMS.findIndex((a) => a.id === 'local');
  // 0.376 kpc × cos(11.4°) / 0.31 kpc → weight exp(−d²/2w²) ≈ 0.49
  assert.ok(Math.abs(w[local] - 0.49) < 0.03, `local weight ${w[local]}`);
  // A point 6,300 ly outward from the Sun lies on Perseus.
  assert.equal(armAt([-1.92 * 3261.56 * 1.0156, 0, 0]).id, 'perseus');
});

test('entry → Carina keeps 25,000 ly from the Galactic Centre and meets the gas layer only in its last 2,000 ly', () => {
  const path = legPoints(LEG_6);
  const total = pathLength(path);
  let minGc = Infinity, firstIn = null;
  for (let i = 0; i <= 5000; i++) {
    const s = (total * i) / 5000;
    const p = pointAlong(path, s);
    minGc = Math.min(minGc, gcDistance(p));
    if (firstIn === null && Math.abs(galacticHeight(p)) < GAS_SCALE_LY) firstIn = s;
  }
  assert.ok(minGc >= 25000, `closest to the centre ${minGc.toFixed(0)} ly`);
  assert.ok(firstIn !== null, 'it does reach the gas layer');
  const lastLy = total - firstIn;
  assert.ok(lastLy > 0 && lastLy <= 2000, `in the gas layer for the last ${lastLy.toFixed(0)} ly`);
  assert.ok(Math.abs(galacticHeight(pointAlong(path, total))) < GAS_SCALE_LY);
  assert.ok(galacticHeight(path[0]) < -15000, 'the entry point lies far below the disc');
});

test('armsPassed lists the arms leg 6 passes over, in order, with their heights', () => {
  const arms = armsPassed(legPoints(LEG_6));
  const ids = arms.map((a) => a.id);
  assert.deepEqual(ids, ['outer', 'perseus', 'local', 'sagittarius-carina']);
  for (let i = 1; i < arms.length; i++) assert.ok(arms[i].at > arms[i - 1].at);
  // The path climbs toward the disc from below: each arm lies above you, less so each time.
  for (const a of arms.slice(0, 3)) assert.ok(a.armAboveLy > 2000, `${a.name}: ${a.armAboveLy.toFixed(0)} ly above`);
  for (let i = 1; i < arms.length; i++) assert.ok(arms[i].armAboveLy < arms[i - 1].armAboveLy);
  const last = arms.at(-1);
  assert.ok(Math.abs(last.pathHeightLy) < 1000, `Sagittarius–Carina at ${last.pathHeightLy.toFixed(0)} ly`);
  for (const a of arms) {
    assert.ok(typeof a.name === 'string' && a.name.endsWith('Arm'));
    assert.ok(Number.isFinite(a.armAboveLy) && a.armAboveLy === -a.pathHeightLy);
  }
});

test('leg 7 passes through the Gum Nebula and enters our own arm', () => {
  const path = legPoints(LEG_7);
  const total = pathLength(path);
  const gum = CLOUDS.find((c) => c.id === 'gum');
  let closest = Infinity, inLocal = false;
  for (let i = 0; i <= 4000; i++) {
    const p = pointAlong(path, (total * i) / 4000);
    closest = Math.min(closest, Math.hypot(p[0] - gum.centre[0], p[1] - gum.centre[1], p[2] - gum.centre[2]));
    if (cloudAt(p) === null && armAt(p).id === 'local' && armAt(p).inArm) inLocal = true;
  }
  assert.ok(closest < gum.radius, `closest ${closest.toFixed(0)} ly, radius ${gum.radius}`);
  assert.ok(inLocal);
});

test('the solar wind falls as 1/r² out to the heliopause', () => {
  const ecl = OBJECTS.earth.pos.map((v) => v / Math.hypot(...OBJECTS.earth.pos));   // a direction in the ecliptic
  const at = (rAu) => densityAt(ecl.map((v) => v * rAu * AU_LY));
  assert.ok(near(at(1), 5, 1e-9));
  assert.ok(near(at(10), 0.05, 1e-9));
  assert.ok(near(at(100), 5e-4, 1e-9));
  assert.equal(sampleAt(ecl.map((v) => v * 130 * AU_LY)).by, 'lic', 'past the heliopause: the Local Interstellar Cloud');
});

test('the asteroid belt is a thick ring in the ecliptic, 2.1 to 3.3 AU out', () => {
  const ecl = OBJECTS.earth.pos.map((v) => v / Math.hypot(...OBJECTS.earth.pos));
  assert.equal(densityAt(ecl.map((v) => v * 2.7 * AU_LY)), 1e4);
  assert.ok(inAsteroidBelt(ecl.map((v) => v * 2.7 * AU_LY)));
  assert.ok(!inAsteroidBelt(ecl.map((v) => v * 4 * AU_LY)));
  // Straight above the Sun (the ecliptic pole) there is no belt.
  const pole = [-0.09647682, 0.86228585, 0.49714719];
  assert.ok(!inAsteroidBelt(pole.map((v) => v * 2.7 * AU_LY)));
});

test('clouds: the smallest one wins where they overlap; each has a density and a source', () => {
  assert.equal(cloudAt(pos('orion-nebula')).id, 'orion-nebula');   // inside Orion A, inside the superbubble
  assert.equal(densityAt(pos('orion-nebula')), 1000);
  assert.equal(cloudAt(pos('alpha-centauri')).id, 'g-cloud');
  assert.equal(cloudAt(pos('sirius')).id, 'lic');
  assert.equal(cloudAt(pos('carina')).id, 'carina');
  assert.equal(cloudAt(pos('pleiades')).id, 'pleiades-dust');
  assert.equal(cloudAt(pos('hyades')).id, 'local-bubble');
  assert.equal(cloudAt(pos('betelgeuse')).id, 'orion-eridanus');
  // Just outside the heliopause toward Alpha Centauri, the Sun is still in the LIC, near the G-Cloud's edge.
  const toward = pos('alpha-centauri').map((v) => v / Math.hypot(...pos('alpha-centauri')));
  assert.equal(cloudAt(toward.map((v) => v * 0.01)).id, 'lic');
  assert.equal(cloudAt(toward.map((v) => v * 2)).id, 'g-cloud');
  for (const c of CLOUDS) {
    assert.match(c.source, /^https:\/\/\S+$/, c.id);
    assert.ok(c.n > 0 && c.radius > 0, c.id);
  }
});

test('disc, halo and intergalactic gas', () => {
  // In the plane, on an arm's centre line: about 1; between arms: about 0.1.
  const arm = ARMS.find((a) => a.id === 'perseus');
  const R = 10.07 * 3261.563777 * 1.0156;                 // Perseus at β = 0, in game light-years
  const onArm = [26996 - R, 0, -17.9];
  assert.ok(near(densityAt(onArm), 1 + N_HALO, 0.02), `on Perseus ${densityAt(onArm)}`);
  assert.equal(armAt(onArm).id, arm.id);
  const between = [-3700, 0, -17.9];                      // 3,700 ly outward, midway between Local and Perseus
  assert.ok(densityAt(between) < 0.2, `between arms ${densityAt(between)}`);
  assert.equal(armAt(between).inArm, false);
  // Far above the plane: the halo. Far away: intergalactic gas.
  assert.ok(near(densityAt(fromGalactic(0, 90, 30000)), N_HALO, 1e-3));
  assert.equal(densityAt(OBJECTS.andromeda.pos), N_IGM);
});

test('zone checks: medians and the factor of 3', () => {
  const path = legPoints(LEG_7);
  const m = medianDensity(path, 0, 100);
  assert.equal(m, 100, 'the first 100 ly leave the Carina Nebula');
  const rest = pathLength(path) - 150;
  const good = checkZones(path, [{ ly: 150, n: 100, label: 'Carina' }, { ly: rest, n: 0.2, label: 'rest' }]);
  assert.ok(good[0].ok);
  const bad = checkZones(path, [{ ly: 150, n: 1, label: 'Carina' }]);
  assert.equal(bad[0].ok, false);
  assert.ok(bad[0].ratio > 3);
});
