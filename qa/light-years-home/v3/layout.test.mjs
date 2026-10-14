// Light Years Home v3: HUD rectangles (final.md 13.1, 18.1). The three design sizes give the design's numbers; at
// six sizes, both hands and both phone schemes nothing overlaps, everything sits inside the safe area, and every touch
// target is at least 44 px; a sweep of common screens holds the same rules. node qa/light-years-home/v3/layout.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutFor, overlaps, unsafe, kindFor, targetAt, inSteerArea, TARGET_MIN,
} from '../../../public/light-years-home/core/layout.js';

const PORTRAIT = { w: 390, h: 844, safe: { t: 47, b: 34 } };
const LANDSCAPE = { w: 844, h: 390, safe: { l: 47, r: 47, b: 21 } };
const DESKTOP = { w: 1440, h: 900, safe: {} };

// The six sizes of final.md 13.1 with typical safe areas, plus an iPad held sideways as a touch screen.
const SIZES = [
  { name: 'portrait 390', ...PORTRAIT },
  { name: 'landscape 844', ...LANDSCAPE },
  { name: 'desktop 1440', ...DESKTOP },
  { name: 'portrait 375', w: 375, h: 667, safe: { t: 20, b: 0 } },
  { name: 'portrait 430', w: 430, h: 932, safe: { t: 59, b: 34 } },
  { name: 'desktop 1024', w: 1024, h: 768, safe: {} },
  { name: 'tablet 1024', w: 1024, h: 768, safe: { t: 24, b: 20 }, kind: 'landscape' },
];

function checkLayout(lay, label) {
  const problems = [];
  for (const [a, b] of overlaps(lay.rects, lay.shares)) problems.push(`${a} overlaps ${b}`);
  for (const name of unsafe(lay)) problems.push(`${name} leaves the safe area`);
  for (const name of lay.targets) {
    const [, , w, h] = lay.rects[name];
    if (w < TARGET_MIN || h < TARGET_MIN) problems.push(`${name} is ${w} × ${h}, under ${TARGET_MIN} px`);
  }
  if (lay.steerArea) {
    const [x, y, w, h] = lay.steerArea;
    const s = lay.safe;
    if (x < s.l || y < s.t || x + w > lay.w - s.r || y + h > lay.h - s.b) problems.push('steer area leaves the safe area');
    // Portrait steers anywhere in the lower screen, ship included; landscape keeps the stick left of the ship. The
    // design's landscape steer area (y 140) starts inside the hint and info slot (y 130 to 158): both only show text.
    const clear = ['speed', 'mission', 'captions', 'toast', ...(lay.kind === 'landscape' ? ['ship'] : [])];
    for (const name of clear) {
      if (overlaps({ steer: lay.steerArea, [name]: lay.rects[name] }).length) problems.push(`steer area covers ${name}`);
    }
  }
  const cap = lay.rects.captions;
  if (cap[1] + cap[3] > lay.h * 2 / 3) problems.push('captions sit in the bottom third');
  for (const [name, r] of Object.entries(lay.rects)) {
    if (!r.every(Number.isInteger) || r[2] <= 0 || r[3] <= 0) problems.push(`${name} is not a whole positive rect`);
  }
  assert.deepEqual(problems, [], label);
}

test('kinds: taller than wide is portrait; 1000 × 600 and up is desktop; the rest landscape', () => {
  assert.equal(kindFor(390, 844), 'portrait');
  assert.equal(kindFor(844, 390), 'landscape');
  assert.equal(kindFor(1440, 900), 'desktop');
  assert.equal(kindFor(1024, 768), 'desktop');
  assert.equal(kindFor(932, 430), 'landscape');
  assert.equal(layoutFor({ w: 1024, h: 768, kind: 'landscape' }).kind, 'landscape', 'a touch tablet can ask');
});

test('portrait 390 × 844, stick and pedals: the design numbers', () => {
  const lay = layoutFor(PORTRAIT);
  assert.equal(lay.kind, 'portrait');
  assert.deepEqual(lay.rects, {
    speed: [16, 52, 80, 40], mission: [104, 52, 214, 40], pause: [330, 50, 44, 44], captions: [16, 104, 358, 46],
    toast: [31, 158, 328, 32], radar: [302, 198, 72, 72], info: [16, 198, 276, 40], ship: [168, 486, 54, 40],
    pips: [165, 462, 60, 18], gas: [290, 690, 84, 116], brake: [206, 714, 76, 92], boost: [298, 606, 72, 72],
    chip: [111, 612, 168, 56], hint: [95, 560, 200, 36],
  });
  assert.deepEqual(lay.steerArea, [0, 300, 390, 510], 'y 300 to 810, full width');
  assert.deepEqual(lay.targets, ['pause', 'radar', 'chip', 'boost', 'gas', 'brake']);
});

test('portrait 390 × 844, one thumb: BOOST moves, no pedals, the steer area is the lower 62%', () => {
  const lay = layoutFor({ ...PORTRAIT, scheme: 'one-thumb' });
  assert.deepEqual(lay.rects.boost, [284, 706, 76, 76]);
  assert.equal(lay.rects.gas, undefined);
  assert.equal(lay.rects.brake, undefined);
  assert.deepEqual(lay.rects.chip, [111, 612, 168, 56]);
  assert.deepEqual(lay.rects.hint, [95, 560, 200, 36]);
  assert.equal(lay.steerArea[1], Math.round(0.38 * 844));
  assert.equal(lay.steerArea[1] + lay.steerArea[3], 810);
});

test('landscape 844 × 390: the design numbers', () => {
  const lay = layoutFor(LANDSCAPE);
  assert.equal(lay.kind, 'landscape');
  assert.deepEqual(lay.rects, {
    speed: [57, 10, 100, 34], mission: [262, 10, 320, 34], pause: [753, 6, 44, 44], captions: [172, 52, 500, 38],
    toast: [222, 96, 400, 28], hint: [222, 130, 400, 28], info: [222, 130, 400, 28], radar: [57, 52, 80, 80],
    ship: [382, 238, 80, 40], pips: [382, 216, 80, 18], chip: [596, 214, 112, 48], boost: [719, 167, 72, 72],
    gas: [713, 251, 84, 116], brake: [625, 275, 76, 92],
  });
  assert.deepEqual(lay.steerArea, [47, 140, 333, 229], 'x 47 to 380, y 140 to 369');
  assert.deepEqual(lay.shares, [['hint', 'info']]);
});

test('desktop 1440 × 900: the design numbers, no stick', () => {
  const lay = layoutFor(DESKTOP);
  assert.equal(lay.kind, 'desktop');
  assert.deepEqual(lay.rects, {
    speed: [24, 20, 120, 40], mission: [520, 20, 400, 40], pause: [1372, 16, 44, 44], captions: [320, 72, 800, 56],
    toast: [470, 136, 500, 36], info: [470, 180, 500, 32], radar: [24, 716, 160, 160], ship: [645, 570, 150, 60],
    pips: [660, 540, 120, 20], hint: [570, 700, 300, 36], chip: [640, 760, 160, 52],
  });
  assert.equal(lay.steerArea, null);
  assert.equal(lay.scheme, null);
});

test('six sizes × both hands × both schemes: no overlaps, inside the safe areas, targets 44 px or more', () => {
  for (const size of SIZES) {
    for (const hand of ['right', 'left']) {
      for (const scheme of ['pedals', 'one-thumb']) {
        const lay = layoutFor({ ...size, hand, scheme });
        checkLayout(lay, `${size.name} ${hand} ${scheme}`);
      }
    }
  }
});

test('the left hand mirrors x', () => {
  for (const base of [PORTRAIT, LANDSCAPE, DESKTOP]) {
    const r = layoutFor(base), l = layoutFor({ ...base, hand: 'left' });
    for (const name of Object.keys(r.rects)) {
      const [x, y, w, h] = r.rects[name];
      assert.deepEqual(l.rects[name], [base.w - x - w, y, w, h], `${name} at ${base.w}`);
    }
    if (r.steerArea) assert.equal(l.steerArea[0], base.w - r.steerArea[0] - r.steerArea[2]);
  }
  const lay = layoutFor({ ...LANDSCAPE, hand: 'left' });
  assert.ok(lay.rects.gas[0] < 422 && lay.steerArea[0] > 422, 'pedals under the left thumb, stick on the right');
});

test('a sweep of common screens keeps the rules', () => {
  const phones = [[360, 640], [360, 780], [375, 667], [375, 812], [390, 844], [393, 852], [412, 915], [414, 896],
    [428, 926], [430, 932]];
  const cases = [];
  for (const [w, h] of phones) {
    cases.push({ w, h, safe: { t: h > 700 ? 47 : 20, b: h > 700 ? 34 : 0 } });
    cases.push({ w: h, h: w, safe: h > 700 ? { l: 47, r: 47, b: 21 } : {} });
  }
  for (const w of [1024, 1280, 1366, 1440, 1536, 1920, 2560]) {
    for (const h of [600, 720, 768, 900, 1080, 1440]) if (w > h) cases.push({ w, h, safe: {} });
  }
  for (const c of cases) {
    for (const hand of ['right', 'left']) {
      for (const scheme of ['pedals', 'one-thumb']) {
        checkLayout(layoutFor({ ...c, hand, scheme }), `${c.w} × ${c.h} ${hand} ${scheme}`);
      }
    }
  }
  assert.ok(cases.length > 50);
});

test('a short phone moves the hint above the ship', () => {
  const lay = layoutFor({ w: 375, h: 667, safe: { t: 20, b: 0 } });
  assert.ok(lay.rects.hint[1] + lay.rects.hint[3] <= lay.rects.pips[1], 'hint above the drift pips');
});

test('touches: buttons win, the rest of the steer area starts the stick', () => {
  const lay = layoutFor(PORTRAIT);
  assert.equal(targetAt(lay, 330, 750), 'gas');
  assert.equal(targetAt(lay, 240, 760), 'brake');
  assert.equal(targetAt(lay, 330, 640), 'boost');
  assert.equal(targetAt(lay, 340, 230), 'radar');
  assert.equal(targetAt(lay, 100, 700), null);
  assert.equal(inSteerArea(lay, 100, 700), true, 'the left half of the lower screen steers');
  assert.equal(inSteerArea(lay, 330, 750), false, 'a pedal touch never steers');
  assert.equal(inSteerArea(lay, 100, 200), false, 'the reading rows do not steer');
  const desk = layoutFor(DESKTOP);
  assert.equal(inSteerArea(desk, 700, 700), false);
  assert.equal(targetAt(desk, 1390, 30), 'pause');
});

test('the ship box follows the camera height in TUNE', () => {
  const tune = { CAM: { portrait: { SHIP_Y: 0.55 } } };
  const lay = layoutFor({ ...PORTRAIT, tune });
  assert.equal(lay.rects.ship[1] + lay.rects.ship[3] / 2, Math.round(0.55 * 844));
});
