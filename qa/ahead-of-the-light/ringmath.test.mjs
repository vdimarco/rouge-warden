// Ahead of the Light: the Ring's geometry (core/ringmath.js), ported from lab A's checks and extended to the race.
// The ring is 42 % of the short side at cruise and never under its floor; something beside the ship sits on it;
// the layouts land where 15.2 says; course speed and tempo match 6.1; the burst ring has 4.1's sizes; rivals ahead,
// abreast and behind are drawn where 4.1 and design-core 3.2 say, and always on screen; the wings never touch at
// the floor; captions sit on 15.2's line; labels keep their rules; nothing goes NaN.
// node qa/ahead-of-the-light/ringmath.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE } from '../../public/ahead-of-the-light/core/tune.js';
import {
  layoutFor, phiHazOf, phiSkyOf, depthPx, dopplerAt, ringPx, courseSpeed, beatsPerS, bpmOf, ringView, toScreen,
  screenOf, burstU, burstPx, rivalPx, rearPx, wingsPx, captionY, lightLabelPx, placeLabels, wrap,
} from '../../public/ahead-of-the-light/core/ringmath.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const SIZES = { portrait: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const view = (kind, o = {}) => ringView({ w: SIZES[kind][0], h: SIZES[kind][1], ...o });

test('lab A: the ring is 42 % of the short side at cruise, 117 px at the top, never under 112 px', () => {
  near(ringPx(TUNE.ETA0, 390) / 390, 0.42, 0.01, 'cruise');
  near(ringPx(TUNE.ETA_RING_TOP, 390), 117, 1.5, 'the floor at η 3.8');
  for (const eta of [0.6, 1, 2, 3.8, 4.95, 5.3]) assert.ok(ringPx(eta, 390) >= 112 - 1e-9, `η ${eta}`);
  assert.ok(ringPx(4.95, 320) >= 112 - 1e-9, 'a small phone keeps the 112 px floor');
  // the ring shrinks as you speed up, and stops at the floor
  assert.ok(ringPx(1.47, 390) < ringPx(1.0, 390) && ringPx(2.65, 390) < ringPx(1.47, 390));
  near(ringPx(4.95, 390), ringPx(3.8, 390), 1e-9, 'no change past η 3.8');
  // the LIGHT SPEED punch: 26 % of the short side at its peak, easing back over PUNCH_S
  near(ringPx(4.95, 390, TUNE, TUNE.PUNCH_S), 0.26 * 390, 0.5, 'the punch');
  assert.ok(ringPx(4.95, 390, TUNE, 0.5) > ringPx(4.95, 390, TUNE, 1) && ringPx(4.95, 390, TUNE, 0.5) < 117);
  // the gear ladder's ring sizes (6.1): portrait / desktop
  for (const [eta, p, d] of [[1.0, 164, 378], [1.472, 154, 356], [2.647, 134, 309], [3.8, 117, 270]]) {
    near(ringPx(eta, 390), p, 1, `portrait at η ${eta}`);
    near(ringPx(eta, 900), d, 1.5, `desktop at η ${eta}`);
  }
});

test('lab A: a point beside the ship sits on the ring; points ahead fall inside it; Doppler is e^φ beside you', () => {
  for (const eta of [1, 2.2, 3.8]) {
    const phi = phiHazOf(eta, 390), f = TUNE.F * 390;
    near(depthPx(0, phi, f), ringPx(eta, 390), 1e-9, `η ${eta}`);
    assert.ok(depthPx(1, phi, f) < depthPx(0, phi, f) && depthPx(5, phi, f) < depthPx(1, phi, f));
    assert.ok(depthPx(-0.5, phi, f) > depthPx(0, phi, f), 'just behind draws just outside');
    assert.equal(depthPx(-1e6, phi, f), Infinity);
    near(dopplerAt(0, phi), Math.cosh(phi), 1e-9, 'beside you: (e^φ + e^−φ) ÷ 2');
    assert.ok(dopplerAt(10, phi) > dopplerAt(0, phi), 'ahead is bluer');
  }
  const v = view('portrait');
  const h = { kind: 'knot', beat: 10, psi: 30, half: 3.5 };
  const p = screenOf(v, h, 10);
  near(p.r, v.R, 1e-9, 'on the ring at its beat');
  near(p.ang, 30, 1e-9, 'at its bearing');
  near(p.halfPx, v.R * 3.5 * Math.PI / 180, 1e-9, 'its outline arc');
  near(screenOf(v, h, 10 - beatsPerS(1)).ttp, 1, 1e-9, 'one second out');
  assert.equal(screenOf(ringView({ w: 390, h: 844, cam: 30 }), h, 10).ang, 0, 'the camera roll');
});

test('the sky uses the true η, capped, and punches to SKY_PUNCH', () => {
  assert.equal(phiSkyOf(2.0), 2.0);
  assert.equal(phiSkyOf(5.3), TUNE.SKY_CAP);
  near(phiSkyOf(4.95, TUNE, TUNE.PUNCH_S), TUNE.SKY_PUNCH, 1e-9, 'punched');
});

test('the layouts land where 15.2 says', () => {
  const want = {
    portrait: { kind: 'portrait', cx: 195, cy: 338, R: [164, 117], ship: [502, 455] },
    landscape: { kind: 'landscape', cx: 422, cy: 179, R: [164, 117], ship: [343, 296] },
    desktop: { kind: 'desktop', cx: 720, cy: 432, R: [378, 270], ship: [810, 702] },
  };
  for (const [k, w] of Object.entries(want)) {
    const L = layoutFor(...SIZES[k]);
    assert.equal(L.kind, w.kind);
    near(L.cx, w.cx, 0.5, `${k} cx`);
    near(L.cy, w.cy, 0.5, `${k} cy`);
    assert.equal(L.scale, k === 'desktop' ? 2 : 1);
    const a = view(k), b = view(k, { eta: 3.8 });
    near(a.R, w.R[0], 1, `${k} launch ring`);
    near(b.R, w.R[1], 1.5, `${k} floor ring`);
    near(toScreen(a, 0, a.R).y, w.ship[0], 1.5, `${k} ship at launch`);
    near(toScreen(b, 0, b.R).y, w.ship[1], 1.5, `${k} ship at the floor`);
    near(toScreen(a, 0, a.R).x, w.cx, 1e-9, `${k} ship at 6 o'clock`);
  }
  // + is to the right on screen
  const v = view('portrait');
  assert.ok(toScreen(v, 30, v.R).x > v.cx && toScreen(v, -30, v.R).x < v.cx);
  assert.ok(toScreen(v, 180, v.R).y < v.cy, '180° is 12 o\'clock');
  assert.equal(wrap(190), -170);
  assert.equal(wrap(-190), 170);
});

test('course speed and tempo follow 6.1', () => {
  for (const [eta, bps, bpm] of [[1.0, 1.87, 112], [1.472, 2.01, 121], [2.647, 2.36, 142], [3.8, 2.70, 162]]) {
    near(beatsPerS(eta), bps, 0.01, `beats a second at η ${eta}`);
    near(bpmOf(eta), bpm, 0.6, `tempo at η ${eta}`);
  }
  near(beatsPerS(4.952, TUNE, true), 2.92, 0.01, 'LIGHT SPEED');
  near(bpmOf(4.952, TUNE, true), 175, 0.6, 'LIGHT SPEED tempo');
  assert.equal(courseSpeed(5.3), courseSpeed(3.8), 'it stops growing at 0.999c');
  // a hazard passing 30 % of the ring radius is readable for at least 0.55 s at top speed (6.1)
  const v = view('portrait', { eta: 3.8 });
  let beats = 0;
  while (depthPx(beats * TUNE.BEAT_R, v.phi, v.fPx) > 0.30 * v.R) beats += 0.001;
  assert.ok(beats / beatsPerS(3.8, TUNE, true) >= 0.55 - 0.01, `${(beats / beatsPerS(3.8, TUNE, true)).toFixed(2)} s`);
});

test('the burst ring has 4.1\'s sizes on phones and desktop, and one hit at η 2.0 visibly pulls it in', () => {
  const phone = [[0, 1.00], [1, 1.11], [3, 1.26], [6, 1.39], [10, 1.50], [20, 1.67], [60, 1.96], [120, 2.15],
    [300, 2.40], [3000, 2.40]];
  const desk = [[1, 1.07], [3, 1.16], [6, 1.23], [10, 1.30], [20, 1.41], [60, 1.58], [120, 1.70], [300, 1.85]];
  for (const k of ['portrait', 'landscape']) {
    const v = view(k);
    for (const [ttc, x] of phone) near(burstPx(v, ttc) / v.R, x, 0.006, `${k} TTC ${ttc}`);
  }
  const d = view('desktop');
  for (const [ttc, x] of desk) near(burstPx(d, ttc) / d.R, x, 0.006, `desktop TTC ${ttc}`);
  const v = view('portrait', { eta: 2.0 });
  near(burstPx(v, 139) / v.R, 2.19, 0.01, 'TTC 139 s');
  near(burstPx(v, 42) / v.R, 1.86, 0.01, 'TTC 42 s');
  assert.equal(burstU(-1), 0);
  assert.equal(burstU(Infinity), 1);
  assert.equal(burstU(NaN), 0);
});

test('rivals ahead sit where design-core 3.2 puts them, clamped at 0.20 of the ring and hollow', () => {
  const v = view('portrait');                          // 0.762c: course speed 1.605 R/s
  const you = { dist: 50, bearing: 0, gap: 8 };
  for (const [s, share, hollow] of [[0.08, 0.85, false], [0.3, 0.57, false], [0.8, 0.30, false], [1.5, 0.20, true],
    [3, 0.20, true]]) {
    const p = rivalPx(v, { dist: 50 + s * v.bps, bearing: 0, gap: 8 }, you, burstPx(v, 30));
    near(p.r / v.R, share, 0.01, `${s} s ahead`);
    assert.equal(p.hollow, hollow, `${s} s ahead hollow`);
    near(p.secAhead, s, 1e-9, 'seconds ahead');
    assert.equal(p.place, s <= TUNE.CONTACT_Z ? 'abreast' : 'ahead');
  }
  // design-core said "the same at all gears to within 0.06"; with 6.1's ring it drifts further at the top gears
  // (0.3 s ahead is 0.57 of the ring at η 1 and 0.49 at η 3.8), but the draft zone still sits inside the ring
  for (const [eta, share] of [[1.47, 0.55], [2.65, 0.52], [3.8, 0.49]]) {
    const g = view('portrait', { eta });
    const p = rivalPx(g, { dist: 50 + 0.3 * g.bps, bearing: 0, gap: 8 }, you, burstPx(g, 30));
    near(p.r / g.R, share, 0.02, `0.3 s ahead at η ${eta}`);
  }
});

test('rivals behind sit by light gap between your ring and the burst ring, and always on screen', () => {
  for (const k of Object.keys(SIZES)) {
    for (const eta of [0.8, 1, 2.65, 3.8]) {
      const v = view(k, { eta });
      for (const ttc of [0.5, 3, 10, 60, 300]) {
        const Rb = burstPx(v, ttc), you = { dist: 50, bearing: 0, gap: 4 };
        for (const bearing of [-150, -100, -60, -20, 0, 20, 60, 100, 150, 180]) {
          for (const gap of [0, 1, 2, 3.9, 4, 6]) {
            const p = rivalPx(v, { dist: 49, bearing, gap }, you, Rb);
            assert.equal(p.place, 'behind');
            assert.ok(p.x >= TUNE.BEHIND_EDGE - 1e-6 && p.x <= v.w - TUNE.BEHIND_EDGE + 1e-6
              && p.y >= TUNE.BEHIND_EDGE - 1e-6 && p.y <= v.h - TUNE.BEHIND_EDGE + 1e-6,
            `${k} η ${eta} TTC ${ttc} bearing ${bearing} gap ${gap}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
            assert.ok(p.r > v.R && p.r <= Rb + 1e-9, `${k}: between your ring and the light`);
            const k4 = Math.max(0, Math.min(1, 1 - gap / 4));
            if (!p.edge && Rb - v.R >= 2 * TUNE.BEHIND_MIN) {
              const want = v.R + TUNE.BEHIND_MIN + (Rb - v.R - TUNE.BEHIND_MIN) * k4;
              near(p.r, want, 1e-6, `${k} rear band`);
            }
          }
        }
      }
    }
  }
  // a rival with a bigger gap than yours hugs your ring; one at gap 0 touches the burst ring
  const v = view('portrait');
  const Rb = burstPx(v, 300);
  near(rivalPx(v, { dist: 49, bearing: 20, gap: 9 }, { dist: 50, gap: 4 }, Rb).r, v.R + 22, 1e-9, 'hugs');
  near(rivalPx(v, { dist: 49, bearing: 90, gap: 0 }, { dist: 50, gap: 4 }, Rb).r, Math.min(Rb, 195 - 12), 1e-6,
    'touches the burst ring, or the screen edge');
  // in the glare the band squeezes between the two rings: a safer rival is never drawn outside the light
  const g = burstPx(v, 0.5);
  assert.ok(g - v.R < 2 * TUNE.BEHIND_MIN);
  near(rearPx(v, 9, 4, g), v.R + (g - v.R) / 2, 1e-9, 'halfway out');
  near(rearPx(v, 0, 4, g), g, 1e-9, 'gap 0 on the light');
  // landscape: straight behind you is pulled 12 px inside the bottom edge
  const l = view('landscape');
  const p = rivalPx(l, { dist: 49, bearing: 0, gap: 0 }, { dist: 50, gap: 4 }, burstPx(l, 300));
  assert.ok(p.edge);
  near(p.y, 390 - 12, 1e-6, 'landscape bottom');
  // abreast: on the ring, blending out to the rear band over CONTACT_Z, so nothing jumps
  const a = rivalPx(v, { dist: 50, bearing: 10, gap: 0 }, { dist: 50, gap: 4 }, Rb);
  near(a.r, v.R, 1e-9, 'abreast is on the ring');
  assert.equal(a.place, 'abreast');
  const b1 = rivalPx(v, { dist: 50 - 0.5 * TUNE.CONTACT_Z * v.bps, bearing: 10, gap: 0 }, { dist: 50, gap: 4 }, Rb);
  assert.ok(b1.r > v.R && b1.r < Rb && b1.place === 'abreast');
});

test('the wings: one item every 5° from 8° out, hull left and fuel right, never touching at the floor', () => {
  for (const k of Object.keys(SIZES)) {
    const v = view(k, { eta: 3.8 });
    const w = wingsPx(v, { bearing: 0, hull: 5, hullMax: 5, fuel: 6, fuelCap: 6, shield: 1, shieldMax: 1 });
    assert.deepEqual(w.hull.map((x) => x.off), [8, 13, 18, 23, 28]);
    assert.deepEqual(w.fuel.map((x) => x.off), [8, 13, 18, 23, 28, 33]);
    for (const h of w.hull) assert.ok(h.x < v.cx, `${k}: hull is left of the ship`);
    for (const f of w.fuel) assert.ok(f.x > v.cx, `${k}: fuel is right of the ship`);
    const s = k === 'desktop' ? 2 : 1;
    assert.equal(w.hull[0].wide, 4 * s);
    assert.equal(w.fuel[0].size, 8 * s);
    assert.equal(w.shield.r, 13 * s);
    near(Math.hypot(w.hull[0].x - v.cx, w.hull[0].y - v.cy), v.R + TUNE.WING_OUT * s, 1e-9, `${k}: 7 px out`);
    // no two items touch: centre spacing beats the item's own width along the arc
    const gapOf = (list, size) => {
      for (let i = 1; i < list.length; i++) {
        const d = Math.hypot(list[i].x - list[i - 1].x, list[i].y - list[i - 1].y);
        assert.ok(d - size >= 1, `${k}: items ${i - 1} and ${i} are ${(d - size).toFixed(1)} px apart`);
      }
    };
    gapOf(w.hull, 4 * s);
    gapOf(w.fuel, 8 * s);
    if (k === 'portrait') near(Math.hypot(w.fuel[1].x - w.fuel[0].x, w.fuel[1].y - w.fuel[0].y), 10.8, 0.1, '5°');
  }
  // fills: lost pips and empty cells; a part-filled diamond; the wings ride with the ship in the fixed camera
  const v = view('portrait');
  const w = wingsPx(v, { bearing: 40, hull: 2, hullMax: 3, fuel: 1.5, fuelCap: 4, shield: 0, shieldMax: 1 });
  assert.deepEqual(w.hull.map((h) => h.full), [true, true, false]);
  assert.deepEqual(w.fuel.map((f) => f.fill), [1, 0.5, 0, 0]);
  near(w.ship.ang, 40, 1e-9, 'the ship travels round the ring');
  near(w.hull[0].ang, 32, 1e-9, 'its wings with it');
});

test('captions sit on 15.2\'s line: portrait y 248, landscape 89, desktop 224, at any speed', () => {
  near(captionY(view('portrait')), 248, 1, 'portrait');
  near(captionY(view('landscape')), 89, 1, 'landscape');
  near(captionY(view('desktop')), 224, 1, 'desktop');
  near(captionY(view('portrait', { eta: 3.8 })), 248, 1, 'it does not move as the ring cinches');
});

test('the light\'s label is on screen at every size and burst size, on its leader', () => {
  for (const k of Object.keys(SIZES)) {
    for (const eta of [0.8, 2.65, 3.8]) {
      const v = view(k, { eta });
      for (const ttc of [0.5, 2.9, 6, 10, 60, 300]) {
        const Rb = burstPx(v, ttc);
        const l = lightLabelPx(v, Rb, 'LIGHT · 7 S');
        assert.ok(l, `${k} η ${eta} TTC ${ttc}: a label`);
        near(Math.hypot(l.anchor.x - v.cx, l.anchor.y - v.cy), Rb, 1e-6, 'anchored on the burst ring');
        const b = l.box;
        assert.ok(b.x >= 0 && b.x + b.w <= v.w && b.y >= 0 && b.y + b.h <= v.h,
          `${k} η ${eta} TTC ${ttc}: box ${JSON.stringify(b)}`);
        assert.ok(l.elbow.y < l.anchor.y, 'the leader goes up');
      }
    }
  }
  // the 4:30 point when it is on screen
  const v = view('desktop', { eta: 3.8 });
  const l = lightLabelPx(v, v.R * 1.07, 'LIGHT · 7 S');
  assert.equal(l.anchor.th, 45);
});

test('rival labels: at most 2, on leaders pointing away from the centre, clear of the landmark label', () => {
  const v = view('portrait');
  const landmark = { x: 150, y: 300, w: 90, h: 16 };
  const cands = [
    { id: 'hound', x: 195, y: 380, text: 'HOUND +0.4 S' },
    { id: 'pike', x: 300, y: 420, text: 'PIKE +0.8 S' },
    { id: 'moth', x: 304, y: 424, text: 'MOTH +0.9 S' },              // within 10 px of PIKE: they share
    { id: 'remora', x: 90, y: 520, text: 'REMORA -0.3 S' },
  ];
  const out = placeLabels(v, cands, { landmark });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].ids, ['hound']);
  assert.deepEqual(out[1].ids, ['pike', 'moth']);
  assert.equal(out[1].text, 'PIKE +0.8 S · MOTH +0.9 S');
  for (const l of out) {
    const far = !(l.box.x - 24 < landmark.x + landmark.w && landmark.x - 24 < l.box.x + l.box.w
      && l.box.y - 24 < landmark.y + landmark.h && landmark.y - 24 < l.box.y + l.box.h);
    assert.ok(far, `${l.text} is within 24 px of the landmark label`);
    assert.ok(l.box.x >= 0 && l.box.x + l.box.w <= v.w && l.box.y >= 0 && l.box.y + l.box.h <= v.h, 'on screen');
    near(Math.hypot(l.elbow.x - l.anchor.x, l.elbow.y - l.anchor.y), 12, 1e-9, 'a 12 px leader');
  }
  assert.equal(out[0].px, 11);
  assert.equal(placeLabels(view('desktop'), cands.slice(0, 1))[0].px, 13);
  assert.equal(placeLabels(v, cands, { max: 1 }).length, 1);
  assert.deepEqual(placeLabels(v, []), []);
});

test('nothing goes NaN for odd inputs (lab A\'s random-input check, for the geometry)', () => {
  let x = 12345;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  for (let i = 0; i < 5000; i++) {
    const w = 200 + rnd() * 2000, h = 200 + rnd() * 1400;
    const v = ringView({ w, h, eta: 0.6 + rnd() * 4.7, punch: rnd() < 0.2 ? rnd() : 0, cam: (rnd() - 0.5) * 2000,
      lightspeed: rnd() < 0.1 });
    for (const k of ['cx', 'cy', 'fPx', 'phi', 'R', 'R0', 'bps']) assert.ok(Number.isFinite(v[k]), `${k} at step ${i}`);
    const Rb = burstPx(v, rnd() < 0.1 ? Infinity : rnd() * 400);
    assert.ok(Number.isFinite(Rb) && Rb >= v.R);
    const p = rivalPx(v, { dist: 50 + (rnd() - 0.5) * 10, bearing: (rnd() - 0.5) * 900, gap: rnd() * 9 },
      { dist: 50, bearing: 0, gap: rnd() < 0.05 ? 0 : rnd() * 9 }, Rb);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `rival at step ${i}`);
    const s = screenOf(v, { beat: 50 + rnd() * 12, psi: (rnd() - 0.5) * 720, half: rnd() * 9 }, 50);
    assert.ok(!Number.isNaN(s.r) && Number.isFinite(s.D) && Number.isFinite(s.ttp), `item at step ${i}`);
  }
});
