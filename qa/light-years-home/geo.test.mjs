// Light Years Home: camera geometry checks. C9 (every scan frames its three candidates inside the free content box,
// for every stop and spot, the three supported layouts and every seeded draw for seeds 1 to 20), legs that end
// exactly at their end object, projection that matches physics.aberrate, rings that crowd toward the centre at full
// throttle, a camera that never jumps between phases, layer crossfades, chevrons and the look swing.
// node qa/light-years-home/geo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTS } from '../../public/light-years-home/core/objects.js';
import {
  STOPS, SCANS, CHAPTERS, legLengthLy, zonesFor, resolve, stopIndex,
} from '../../public/light-years-home/core/route.js';
import {
  aberrate, aberrateVector, viewRapidity, zoneDistance, zoneLambda,
} from '../../public/light-years-home/core/physics.js';
import { HIT_MIN } from '../../public/light-years-home/core/pick.js';
import {
  LAYOUTS, LAYER_NAMES, LOOK_YAW, LOOK_PITCH, FLIGHT_BLEND, CLUE_BLEND, SPOT_BLEND, ENDING, contentBox, layoutMode,
  legPath, legHeading, scanPose, cameraFor, layerWeights, layerFor, lookToward, revealPose, endingPose, keyartPose,
  quatToBasis, freeBox, prepareScans,
} from '../../public/light-years-home/core/geo.js';
import { project, edgeChevron, MIN_RING_PX } from '../../public/light-years-home/core/project.js';
import { playJourney } from '../../public/light-years-home/core/bot.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const SIZES = Object.entries(LAYOUTS);                  // desktop 1440×900, portrait 390×844, landscape 844×390
const LAST = STOPS.length - 1;
const DRAW = resolve(1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angleDeg = (a, b) => (Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) * 180) / Math.PI;   // exact near 0
const viewOf = (name) => { const { width, height } = LAYOUTS[name]; return [width / height, contentBox(width, height)]; };

// The HUD rects of final.md 2.9 at each supported size, [x, y, w, h] in CSS px: what the free box must stay clear of.
const HUD_RECTS = {
  desktop: {
    top: [0, 0, 1440, 44], clock: [0, 44, 1440, 20], info: [0, 64, 300, 30],
    caption: [0, 0.70 * 900 - 41, 1440, 82],          // 34 px, at most 2 lines, centred at 70 %
    card: [1440 - 360, 120, 360, 900 - 120 - 150],     // right panel, 360 wide, top 120 px to bottom 150 px
    chips: [340, 900 - 150, 760, 44], strip: [340, 900 - 106, 760, 106],
  },
  portrait: {
    top: [0, 0, 390, 44], clock: [0, 44, 390, 18], info: [0, 62, 390, 36],
    caption: [0, 0.62 * 844 - 31, 390, 62],           // 26 px, at most 2 lines, centred at 62 %
    card: [0, 844 - 60 - 44 - 250, 390, 250],          // bottom sheet above the chips and the strip
    chips: [0, 844 - 60 - 44, 390, 44], strip: [0, 844 - 60, 390, 60],
  },
  landscape: {
    top: [0, 0, 844, 44], caption: [0, 0.74 * 390 - 14, 844 - 300, 28],   // one line, 22 px, at 74 %
    card: [844 - 300, 44, 300, 390 - 44 - 56], chips: [844 - 300, 44, 300, 44], strip: [0, 390 - 56, 844, 56],
  },
};
const overlaps = (b, [x, y, w, h]) => b.x < x + w && x < b.x + b.w && b.y < y + h && y < b.y + b.h;

function insideBox(p, box, inset) {
  return p.front && p.x >= box.x + inset && p.x <= box.x + box.w - inset && p.y >= box.y + inset
    && p.y <= box.y + box.h - inset;
}

function finiteDeep(v, path = 'cam') {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path} is ${v}`);
  else if (Array.isArray(v)) v.forEach((x, i) => finiteDeep(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) finiteDeep(x, `${path}.${k}`);
}

function assertBasis(b, what) {
  for (const k of ['right', 'up', 'fwd']) assert.ok(Math.abs(Math.hypot(...b[k]) - 1) < 1e-9, `${what}: |${k}|`);
  assert.ok(Math.abs(dot(b.right, b.up)) < 1e-9 && Math.abs(dot(b.up, b.fwd)) < 1e-9 && Math.abs(dot(b.fwd, b.right)) < 1e-9,
    `${what}: not orthogonal`);
  const c = [b.up[1] * b.right[2] - b.up[2] * b.right[1], b.up[2] * b.right[0] - b.up[0] * b.right[2],
    b.up[0] * b.right[1] - b.up[1] * b.right[0]];
  assert.ok(dist(c, b.fwd) < 1e-9, `${what}: fwd = up × right (three.js camera looks down −z)`);
}

function samePose(a, b, what, tolPos = 1e-9, tolDeg = 1e-6) {
  const scale = Math.max(1e-12, Math.hypot(...a.pos), Math.hypot(...b.pos));
  assert.ok(dist(a.pos, b.pos) <= tolPos * scale, `${what}: position jumps by ${dist(a.pos, b.pos)} ly`);
  assert.ok(angleDeg(a.basis.fwd, b.basis.fwd) <= tolDeg, `${what}: view turns by ${angleDeg(a.basis.fwd, b.basis.fwd)}°`);
  assert.ok(angleDeg(a.basis.up, b.basis.up) <= tolDeg, `${what}: roll jumps`);
  assert.ok(Math.abs(a.fovY - b.fovY) <= 1e-6, `${what}: field of view jumps ${a.fovY} → ${b.fovY}`);
}

const scanState = (sc, seed, extra = {}) => ({ phase: 'scan', phaseT: 3, stop: sc.stop, mode: sc.mode, draw: resolve(seed),
  ...extra });
const flightState = (i, ly, zone, p, x, phaseT = 5, branch = 'sheet') => ({ phase: 'flight', phaseT, stop: i, mode: 'stop',
  branch, draw: DRAW, flight: { zone, p, x, view: viewRapidity(x), ly } });

// ---------- layouts ----------

test('layouts: the three supported sizes get their own mode, and the free box stays clear of the HUD', () => {
  assert.equal(layoutMode(1440, 900), 'desktop');
  assert.equal(layoutMode(390, 844), 'portrait');
  assert.equal(layoutMode(844, 390), 'landscape');
  for (const [name, { width, height }] of SIZES) {
    const box = contentBox(width, height);
    assert.equal(box.mode, name);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height, `${name}: box on screen`);
    assert.ok(box.w >= 300 && box.h >= 180, `${name}: box ${box.w}×${box.h} big enough to read`);
    for (const [part, r] of Object.entries(HUD_RECTS[name])) assert.ok(!overlaps(box, r), `${name}: box under the ${part}`);
    // The screen centre is inside the box: scan framings rely on it.
    assert.ok(box.x < width / 2 && box.x + box.w > width / 2 && box.y < height / 2 && box.y + box.h > height / 2);
  }
  const safe = contentBox(390, 844, { top: 47, bottom: 34 });
  assert.equal(safe.y, contentBox(390, 844).y + 47, 'the safe-area top inset pushes the box down');
  const measured = freeBox({ top: { x: 0, y: 0, w: 390, h: 100 }, caption: { left: 0, top: 480, width: 390, height: 60 } },
    390, 844);
  assert.deepEqual([measured.y, measured.y + measured.h], [100, 480]);
});

// ---------- C9 ----------

test('C9: every stop and spot frames its three candidates inside the free box, every layout, seeds 1 to 20', () => {
  let worstGap = Infinity, worstSep = Infinity, framings = 0;
  for (const sc of SCANS) {
    for (const [name] of SIZES) {
      const [aspect, box] = viewOf(name);
      for (const seed of SEEDS) {
        const state = scanState(sc, seed);
        const draw = state.draw[sc.id];
        assert.ok(draw && draw.A && draw.B && draw.C, `${sc.id}: drawn letters`);
        const cam = cameraFor(state, aspect, {}, box);
        assert.equal(cam.phiView, 0, 'the ship is at rest during a scan');
        const xy = [];
        for (const letter of ['A', 'B', 'C']) {
          const p = project(draw[letter], cam);
          assert.ok(insideBox(p, box, HIT_MIN), `${sc.id} ${name} seed ${seed}: ${letter} = ${draw[letter]} at `
            + `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) is outside the free box ${JSON.stringify(box)}`);
          assert.ok(p.visible);
          worstGap = Math.min(worstGap, p.x - box.x, box.x + box.w - p.x, p.y - box.y, box.y + box.h - p.y);
          xy.push(p);
        }
        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const sep = Math.hypot(xy[i].x - xy[j].x, xy[i].y - xy[j].y);
            assert.ok(sep >= 2 * MIN_RING_PX, `${sc.id} ${name} seed ${seed}: two rings ${sep.toFixed(1)} px apart`);
            worstSep = Math.min(worstSep, sep);
          }
        }
        framings++;
      }
    }
  }
  assert.equal(SCANS.length, 17, '15 stops and 2 spots');
  console.log(`# ${framings} framings: centres at least ${worstGap.toFixed(1)} px inside the box, `
    + `rings at least ${worstSep.toFixed(1)} px apart`);
});

test('C9: the first scan also shows the Laniakea ring the opening points at', () => {
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    for (const seed of SEEDS) {
      const cam = cameraFor(scanState(SCANS[0], seed), aspect, {}, box);
      assert.ok(insideBox(project('laniakea', cam), box, HIT_MIN), `${name} seed ${seed}: Laniakea ring`);
    }
  }
});

test('prepareScans works out the next framings ahead, and they are the ones the scans then use', () => {
  const [aspect, box] = viewOf('portrait');
  const draw = resolve(9);
  assert.deepEqual(prepareScans({ stop: 13, draw }, aspect, box), ['sun', 'earth']);
  const cam = cameraFor({ phase: 'scan', stop: 14, mode: 'stop', draw }, aspect, {}, box);
  const pose = scanPose('earth', aspect, box, { draw });
  assert.deepEqual(cam.pos, [...pose.pos]);
  assert.ok(['none', 'pull', 'vantage'].includes(pose.moved));
  assert.throws(() => { pose.pos[0] = 0; }, 'cached framings are frozen');
});

test('scan framings respect the scan field of view limits and the look limits', () => {
  for (const sc of SCANS) {
    for (const [name] of SIZES) {
      const [aspect, box] = viewOf(name);
      const p = scanPose(sc.id, aspect, box, { draw: DRAW });
      const { fovMin, fovMax } = sc.entry.scan;
      const fovX = (2 * Math.atan(Math.tan((p.fovY * Math.PI) / 360) * aspect) * 180) / Math.PI;
      assert.ok(p.fovY >= fovMin - 1e-9 && p.fovY <= fovMax + 1e-9, `${sc.id} ${name}: fov ${p.fovY}`);
      assert.ok(Math.max(p.fovY, fovX) <= 110 + 1e-6, `${sc.id} ${name}: no wider than 110° across`);
    }
  }
  const [aspect, box] = viewOf('desktop');
  const base = cameraFor(scanState(SCANS[0], 1), aspect, {}, box);
  const far = cameraFor(scanState(SCANS[0], 1), aspect, { yaw: 500, pitch: -500 }, box);
  assert.deepEqual(far.look, { yaw: LOOK_YAW, pitch: -LOOK_PITCH });
  assert.ok(Math.abs(angleDeg(base.basis.fwd, far.basis.fwd) - angleDeg(base.basis.fwd, cameraFor(scanState(SCANS[0], 1),
    aspect, { yaw: 60, pitch: -35 }, box).basis.fwd)) < 1e-9);
  assert.deepEqual(far.frame, base.frame, 'look turns the view around the same framing');
  assert.equal(far.pos.join(), base.pos.join(), 'looking around does not move the camera');
});

// ---------- legs ----------

test('legPath ends exactly at the end object and starts exactly at the start object', () => {
  for (let i = 0; i < STOPS.length; i++) {
    const stop = STOPS[i];
    for (const branch of stop.branches ? ['sheet', 'void'] : ['sheet']) {
      const L = legLengthLy(i, branch);
      assert.deepEqual(legPath(i, branch, L).pos, OBJECTS[stop.to].pos, `${stop.id} ${branch}: end`);
      assert.deepEqual(legPath(i, branch, L * 2).pos, OBJECTS[stop.to].pos, `${stop.id}: past the end clamps`);
      assert.deepEqual(legPath(i, branch, 0).pos, OBJECTS[stop.from].pos, `${stop.id}: start`);
      assert.deepEqual(legPath(i, branch, -5).pos, OBJECTS[stop.from].pos, `${stop.id}: before the start clamps`);
      // The zones the engine flies add up to the same length, so its last tick lands on the target.
      const zones = zonesFor(i, branch);
      assert.deepEqual(legPath(i, branch, zones[zones.length - 1].endLy).pos, OBJECTS[stop.to].pos);
      if (stop.to === stop.target.id) assert.deepEqual(legPath(i, branch, L).pos, OBJECTS[stop.target.id].pos);
    }
    if (i > 0) assert.equal(STOPS[i - 1].to, stop.from, `${stop.id}: legs join`);
  }
  // The two stops whose leg ends short of the landmark itself.
  assert.deepEqual(STOPS.filter((s) => s.to !== s.target.id).map((s) => s.id), ['milky-way', 'sun']);
});

test('legPath follows the path through its via points, at the true distance', () => {
  for (let i = 0; i < STOPS.length; i++) {
    const stop = STOPS[i];
    const pts = [stop.from, ...stop.via, stop.to].map((id) => OBJECTS[id].pos);
    const L = legLengthLy(i);
    let along = 0;
    for (let k = 1; k < pts.length - 1; k++) {
      along += dist(pts[k - 1], pts[k]);
      assert.ok(dist(legPath(i, 'sheet', along).pos, pts[k]) <= 1e-9 * L, `${stop.id}: via ${stop.via[k - 1]}`);
    }
    const corners = [];
    for (let k = 1, c = 0; k < pts.length - 1; k++) corners.push((c += dist(pts[k - 1], pts[k])));
    let prev = legPath(i, 'sheet', 0);
    for (let k = 1; k <= 200; k++) {
      const cur = legPath(i, 'sheet', (L * k) / 200);
      const step = dist(prev.pos, cur.pos);
      const turns = corners.some((c) => c > (L * (k - 1)) / 200 && c < (L * k) / 200);   // a step round a corner is shorter
      assert.ok(step <= (L / 200) * (1 + 1e-9) && (turns || Math.abs(step - L / 200) <= 1e-6 * L),
        `${stop.id}: step ${k} covers ${step}, not ${L / 200}`);
      assert.ok(Math.abs(Math.hypot(...cur.fwd) - 1) < 1e-12);
      assert.ok(LAYER_NAMES.includes(cur.layer));
      prev = cur;
    }
  }
  assert.equal(legPath(0, 'sheet', 0).layer, 'cosmic');
  assert.equal(legPath(LAST, 'sheet', legLengthLy(LAST)).layer, 'solar');
  assert.equal(legPath(stopIndex('carina'), 'sheet', legLengthLy(stopIndex('carina'))).layer, 'stars');
});

test('the heading turns smoothly through via corners, tick by tick as the engine flies', () => {
  for (const id of ['fornax', 'aldebaran']) {
    const i = stopIndex(id), L = legLengthLy(i), zones = zonesFor(i);
    let prev = legHeading(i, 'sheet', 0), worst = 0, turned = 0;
    // Step every zone at the fastest zone rate (1.6 × its notch rate), with the engine's Eames pacing.
    zones.forEach((z, k) => {
      const lambda = k < zones.length - 1 ? zoneLambda(z.ly, zones[k + 1].ly) : 0;
      for (let p = 0; p <= 1; p = Math.min(1, p + 1.6 / (60 * z.screen))) {
        const h = legHeading(i, 'sheet', z.startLy + zoneDistance(p, z.ly, lambda));
        assert.ok(Math.abs(Math.hypot(...h) - 1) < 1e-12);
        worst = Math.max(worst, angleDeg(prev, h));
        turned += angleDeg(prev, h);
        prev = h;
        if (p === 1) break;
      }
    });
    const corner = angleDeg(legPath(i, 'sheet', 0).fwd, legPath(i, 'sheet', L).fwd);
    assert.ok(Math.abs(turned - corner) < 0.5, `${id}: turns ${turned.toFixed(1)}° in all for a ${corner.toFixed(1)}° corner`);
    assert.ok(worst < 3, `${id}: heading turns ${worst.toFixed(2)}° in one tick`);
    assert.ok(angleDeg(legHeading(i, 'sheet', 0), legPath(i, 'sheet', 0).fwd) < 1e-9);
    assert.ok(angleDeg(legHeading(i, 'sheet', L), legPath(i, 'sheet', L).fwd) < 1e-9);
  }
});

// ---------- projection ----------

test('project uses the same light-speed maths as physics.aberrate', () => {
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const randUnit = () => {
    const z = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), r * Math.sin(a), z];
  };
  const [aspect, box] = viewOf('desktop');
  for (let k = 0; k < 400; k++) {
    const cam = cameraFor(flightState(0, 1e8 * rnd(), 2, 0.5, rnd()), aspect, {}, box);
    const r = 10 ** (8 * rnd()), dir0 = randUnit();
    const pos = cam.pos.map((c, i) => c + dir0[i] * r);
    // The direction as the camera sees it (the subtraction rounds at 1e9 ly, so take it from the stored position).
    const d = pos.map((c, i) => c - cam.pos[i]), n = d.map((c) => c / Math.hypot(...d));
    for (const phi of [0, 0.3, 1, 2.48, 3]) {
      const p = project(pos, cam, phi);
      // Reference: the vector form at β = tanh φ, then a plain pinhole camera.
      const ref = phi > 0 ? aberrateVector(n, cam.velocity, Math.tanh(phi)) : { n, D: 1 };
      const m = ref.n.map((v) => v / Math.hypot(...ref.n));
      const cx = dot(m, cam.basis.right), cy = dot(m, cam.basis.up), cz = dot(m, cam.basis.fwd);
      assert.ok(Math.abs(p.D - ref.D) <= 1e-9 * ref.D, `D ${p.D} vs ${ref.D}`);
      assert.ok(dist(p.dir, [cx, cy, cz]) < 1e-9, 'seen direction');
      assert.equal(p.front, cz > 1e-6);
      if (cz > 0.05) {
        const T = Math.tan((cam.fovY * Math.PI) / 360);
        const x = ((cx / (cz * T * aspect) + 1) / 2) * cam.width, y = ((1 - cy / (cz * T)) / 2) * cam.height;
        assert.ok(Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6, `(${p.x}, ${p.y}) vs (${x}, ${y})`);
      }
    }
    // At any rapidity the direction is exactly physics.aberrate's.
    for (const phi of [5, 12, 20.8]) {
      const ab = aberrate(n, cam.velocity, phi), p = project(pos, cam, phi);
      assert.ok(dist(p.dir, [dot(ab.n, cam.basis.right), dot(ab.n, cam.basis.up), dot(ab.n, cam.basis.fwd)]) < 1e-12);
      assert.equal(p.D, ab.D);
    }
  }
  // phiView defaults to the camera's own.
  const cam = cameraFor(flightState(0, 3e8, 2, 0.5, 0.8), aspect, {}, box);
  assert.deepEqual(project('coma', cam), project('coma', cam, cam.phiView));
  assert.ok(cam.phiView > 0 && Math.abs(cam.expPhi * cam.expMinusPhi - 1) < 1e-12);
});

test('rings for an object at x = 1 sit closer to the centre than at x = 0, and look bluer', () => {
  const [aspect, box] = viewOf('desktop');
  let checked = 0;
  for (const i of [0, 2, 4, 6, 9, 12]) {
    const L = legLengthLy(i), zones = zonesFor(i);
    const mid = zones.findIndex((z) => z.endLy > L / 2);
    const slow = cameraFor(flightState(i, L / 2, mid, 0.5, 0), aspect, {}, box);
    const fast = cameraFor(flightState(i, L / 2, mid, 0.5, 1), aspect, {}, box);
    assert.equal(slow.phiView, 0);
    assert.ok(Math.abs(fast.phiView - viewRapidity(1)) < 1e-12);
    assert.deepEqual(slow.pos, fast.pos, 'the throttle does not move the camera');
    const cx = slow.width / 2, cy = slow.height / 2;   // looking along the heading: the centre is the way ahead
    assert.ok(angleDeg(slow.basis.fwd, slow.velocity) < 1e-9);
    for (const id of Object.keys(OBJECTS)) {
      const a = project(id, slow), b = project(id, fast);
      if (!a.visible || a.dist === 0) continue;
      const r0 = Math.hypot(a.x - cx, a.y - cy), r1 = Math.hypot(b.x - cx, b.y - cy);
      if (r0 < 1) continue;
      assert.ok(r1 < r0, `${STOPS[i].id}: ${id} moves out from ${r0.toFixed(1)} to ${r1.toFixed(1)} px`);
      assert.ok(b.D > 1, `${id}: blueshifted ahead`);
      checked++;
    }
  }
  assert.ok(checked > 50, `checked ${checked} rings`);
});

test('project: sizes, behind the camera, and object ids', () => {
  const [aspect, box] = viewOf('portrait');
  const cam = cameraFor({ phase: 'reveal', stop: stopIndex('andromeda'), mode: 'stop', draw: DRAW }, aspect, {}, box);
  const p = project('andromeda', cam);
  assert.ok(p.visible && p.rawR > 50, `Andromeda ring ${p.rawR}`);
  assert.ok(Math.abs(p.x - (box.x + box.w / 2)) < 2 && Math.abs(p.y - (box.y + box.h / 2)) < 2, 'centred in the box');
  const behind = cam.pos.map((c, i) => c - cam.basis.fwd[i] * 1e6);
  const q = project(behind, cam);
  assert.equal(q.front, false);
  assert.equal(q.visible, false);
  const tiny = project({ pos: OBJECTS.coma.pos, radiusLy: 0 }, cam);
  assert.equal(tiny.r, MIN_RING_PX, 'rings never shrink below the minimum');
  assert.throws(() => project('no-such-object', cam));
});

// ---------- the camera across phases ----------

test('the camera never jumps between phases', () => {
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    const at = (state, look) => cameraFor(state, aspect, look || {}, box);
    for (let i = 0; i < STOPS.length; i++) {
      const stop = STOPS[i], zones = zonesFor(i), L = legLengthLy(i);
      // scan → flight start
      samePose(at({ phase: 'scan', phaseT: 9, stop: i, mode: 'stop', draw: DRAW }),
        at(flightState(i, 0, 0, 0, 0, 0)), `${stop.id} ${name}: scan → flight`);
      // flight blend done → plain flight view
      const blended = at(flightState(i, 0, 0, 0, 0, FLIGHT_BLEND + 1e-9));
      assert.ok(angleDeg(blended.basis.fwd, blended.velocity) < 1e-9, `${stop.id}: flight looks ahead`);
      // flight end → reveal (or the ending, after the last leg)
      const end = at(flightState(i, L, zones.length - 1, 1, 0));
      assert.equal(end.phiView, 0, `${stop.id}: the drop-out eases the view to rest`);
      assert.deepEqual(end.ship, OBJECTS[stop.to].pos, `${stop.id}: the ship ends exactly at the end object`);
      const next = i === LAST ? at({ phase: 'ending', phaseT: 0, stop: i, ending: { beat: 0, t: 0 }, say: {} })
        : at({ phase: 'reveal', phaseT: 0, stop: i, mode: 'stop', draw: DRAW });
      samePose(end, next, `${stop.id} ${name}: flight → ${i === LAST ? 'ending' : 'reveal'}`);
      if (i === LAST) continue;
      // reveal → spot clue, spot reveal → next clue, reveal → next clue
      let before = at({ phase: 'reveal', phaseT: 9, stop: i, mode: 'stop', draw: DRAW });
      if (stop.spot) {
        samePose(before, at({ phase: 'clue', phaseT: 0, stop: i, mode: 'spot', draw: DRAW }), `${stop.id}: → spot clue`);
        samePose(at({ phase: 'clue', phaseT: CLUE_BLEND, stop: i, mode: 'spot', draw: DRAW }),
          at({ phase: 'scan', phaseT: 0, stop: i, mode: 'spot', draw: DRAW }), `${stop.id}: spot clue → scan`);
        samePose(at({ phase: 'scan', phaseT: 9, stop: i, mode: 'spot', draw: DRAW }),
          at({ phase: 'reveal', phaseT: 0, stop: i, mode: 'spot', draw: DRAW }), `${stop.id}: spot scan → reveal`);
        before = at({ phase: 'reveal', phaseT: SPOT_BLEND, stop: i, mode: 'spot', draw: DRAW });
      }
      samePose(before, at({ phase: 'clue', phaseT: 0, stop: i + 1, mode: 'stop', draw: DRAW }), `${stop.id}: → next clue`);
      samePose(at({ phase: 'clue', phaseT: CLUE_BLEND, stop: i + 1, mode: 'stop', draw: DRAW }),
        at({ phase: 'scan', phaseT: 0, stop: i + 1, mode: 'stop', draw: DRAW }), `${STOPS[i + 1].id}: clue → scan`);
    }
    // Chapter cards hold what the last reveal showed, whether the engine has moved to the next stop or not.
    for (const c of CHAPTERS.slice(1)) {
      const first = stopIndex(c.stops[0]);
      const held = at({ phase: 'chapter', phaseT: 1, stop: first, mode: 'stop', draw: DRAW });
      samePose(held, at({ phase: 'chapter', phaseT: 1, stop: first - 1, mode: 'stop', draw: DRAW }), `${c.id}: card`);
      samePose(held, at({ phase: 'clue', phaseT: 0, stop: first, mode: 'stop', draw: DRAW }), `${c.id}: card → clue`);
    }
    // The opening eases from the title into the first scan.
    samePose(at({ phase: 'title' }), at({ phase: 'intro', phaseT: 0, draw: DRAW }), `${name}: title → intro`);
    samePose(at({ phase: 'intro', phaseT: 60, draw: DRAW }), at({ phase: 'clue', phaseT: 0, stop: 0, mode: 'stop',
      draw: DRAW }), `${name}: intro → first clue`);
  }
});

test('a whole journey played by the skilled bot: the camera stays finite and smooth, and every scan frames its rings', () => {
  for (const name of ['portrait', 'landscape']) {
    const [aspect, box] = viewOf(name);
    let prev = null, ticks = 0, scans = 0, worst = 0, where = '';
    const { result } = playJourney('skilled', { seed: 3, onTick: (state) => {
      const cam = cameraFor(state, aspect, {}, box);
      finiteDeep([cam.pos, cam.basis, cam.fovY, cam.phiView, cam.layerWeights]);
      // Turn per tick, view direction plus roll; the ending's address stills cut on purpose.
      const stills = state.phase === 'ending' && ENDING[state.ending.beat] !== 'approach';
      if (prev && !stills) {
        const turn = angleDeg(prev.basis.fwd, cam.basis.fwd) + angleDeg(prev.basis.up, cam.basis.up);
        if (turn > worst) { worst = turn; where = `${state.phase} at stop ${state.stop}`; }
      }
      if (state.phase === 'scan') {
        const sc = SCANS.find((x) => x.stop === state.stop && x.mode === state.mode);
        for (const id of Object.values(state.draw[sc.id])) {
          assert.ok(insideBox(project(id, cam), box, HIT_MIN), `${name}: ${sc.id} ${id} outside the box`);
        }
        scans++;
      }
      prev = stills ? null : cam;
      ticks++;
    } });
    assert.equal(result.home, true, 'the bot gets home');
    assert.ok(scans > 0 && ticks > 10000);
    assert.ok(worst < 8, `${name}: the view turns ${worst.toFixed(2)}° in one tick (${where})`);
    console.log(`# ${name}: ${ticks} ticks, largest turn in one tick ${worst.toFixed(2)}° (${where})`);
  }
});

test('reduced motion cuts instead of sweeping', () => {
  const [aspect, box] = viewOf('desktop');
  const reduced = { reduced: true };
  samePose(cameraFor({ phase: 'clue', phaseT: 0, stop: 4, mode: 'stop', draw: DRAW }, aspect, reduced, box),
    cameraFor({ phase: 'scan', phaseT: 0, stop: 4, mode: 'stop', draw: DRAW }, aspect, {}, box), 'clue cuts to the scan');
  const lost = cameraFor({ ...flightState(2, 5e7, 3, 0.5, 0.5), phase: 'lost', phaseT: 2 }, aspect, reduced, box);
  assert.equal(lost.phiView, viewRapidity(0.5), 'no fold');
  assert.ok(lost.fade < 1);
  const fold = cameraFor({ ...flightState(2, 5e7, 3, 0.5, 0.5), phase: 'lost', phaseT: 3 }, aspect, {}, box);
  assert.ok(fold.phiView > viewRapidity(1), 'the sky folds into the point ahead');
});

test('every phase gives a whole, finite camera for every stop', () => {
  const phases = ['title', 'intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter', 'ending', 'lost', 'unknown'];
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    for (let i = 0; i < STOPS.length; i++) {
      const zones = zonesFor(i);
      for (const phase of phases) {
        for (const mode of STOPS[i].spot ? ['stop', 'spot'] : ['stop']) {
          for (const t of [0, 0.7, 30]) {
            const state = {
              phase, phaseT: t, stop: i, mode, draw: resolve(i + 3), branch: i === 3 ? 'void' : null,
              flight: { zone: 1 % zones.length, p: 0.4, x: 0.7, view: viewRapidity(0.7),
                ly: zones[1 % zones.length].startLy },
              ending: { beat: i % ENDING.length, t }, say: { current: i % 2 ? { ring: 'sun' } : null },
            };
            const before = structuredClone(state);
            const cam = cameraFor(state, aspect, { yaw: 10, pitch: -5 }, box);
            assert.deepEqual(state, before, 'cameraFor does not change the state');
            finiteDeep(cam);
            assertBasis(cam.basis, `${phase} ${i}`);
            assert.ok(cam.fovY > 1 && cam.fovY < 179);
            const qb = quatToBasis(cam.quat);
            for (const k of ['right', 'up', 'fwd']) assert.ok(dist(qb[k], cam.basis[k]) < 1e-9, `${phase}: quat ${k}`);
            assert.ok(Math.abs(Math.hypot(...cam.quat) - 1) < 1e-12);
            for (const n of LAYER_NAMES) {
              const l = cam.layers[n];
              assert.ok(l.weight >= 0 && l.weight <= 1 && l.near > 0 && l.far > l.near);
              assert.ok(Math.abs(l.origin[0] * l.unit - cam.pos[0]) <= 1e-9 * Math.abs(cam.pos[0]) + 1e-300);
            }
            assert.ok(Math.abs(cam.layerWeights[cam.layer] - 0) > 0.05, `${phase} ${i}: main layer ${cam.layer} drawn`);
            assert.deepEqual(cam, cameraFor(state, aspect, { yaw: 10, pitch: -5 }, box), 'same state, same camera');
          }
        }
      }
    }
  }
});

test('three.js convention: the quaternion turns −z to the view direction and +y to up', () => {
  const [aspect, box] = viewOf('landscape');
  const cam = cameraFor({ phase: 'scan', stop: 7, mode: 'stop', draw: DRAW }, aspect, { yaw: 20 }, box);
  const [x, y, z, w] = cam.quat;
  // Columns of the rotation matrix of a unit quaternion (the textbook formula, independent of geo.js).
  const col1 = [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)];
  const col2 = [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
  assert.ok(dist(col1, cam.basis.up) < 1e-9);
  assert.ok(dist(col2.map((v) => -v), cam.basis.fwd) < 1e-9);
  assert.deepEqual(cam.velocityView.map((v) => Math.round(v * 1e9) / 1e9),
    [dot(cam.velocity, cam.basis.right), dot(cam.velocity, cam.basis.up), -dot(cam.velocity, cam.basis.fwd)]
      .map((v) => Math.round(v * 1e9) / 1e9));
  const flying = cameraFor(flightState(1, 1e8, 2, 0.5, 1), aspect, {}, box);
  assert.ok(dist(flying.velocityView, [0, 0, -1]) < 1e-9, 'in flight the motion is straight ahead, down −z');
});

// ---------- layers ----------

test('layer weights crossfade on log10 of the distance from home', () => {
  let prev = layerWeights(1e-9);
  for (let e = -9; e <= 9.2; e += 0.01) {
    const w = layerWeights(10 ** e);
    for (const n of LAYER_NAMES) {
      assert.ok(w[n] >= 0 && w[n] <= 1);
      assert.ok(Math.abs(w[n] - prev[n]) < 0.05, `${n} jumps at 10^${e.toFixed(2)} ly`);   // fades span ≥ 0.3 dex
    }
    assert.ok(LAYER_NAMES.some((n) => w[n] > 0.5), `something is drawn at 10^${e.toFixed(2)} ly`);
    assert.ok(w[layerFor(10 ** e)] > 0.05, `the main layer is drawn at 10^${e.toFixed(2)} ly`);
    prev = w;
  }
  const at = (ly) => Object.fromEntries(Object.entries(layerWeights(ly)).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  assert.deepEqual(at(1e9), { cosmic: 1, group: 0, galaxy: 0, stars: 0, solar: 0 }, 'the start: galaxies only');
  assert.deepEqual(at(2.5e6), { cosmic: 1, group: 1, galaxy: 0, stars: 0, solar: 0 }, 'near Andromeda');
  assert.deepEqual(at(8000), { cosmic: 0, group: 0, galaxy: 1, stars: 1, solar: 0 }, 'at Carina');
  assert.deepEqual(at(1.6e-5), { cosmic: 0, group: 0, galaxy: 1, stars: 1, solar: 1 }, 'at Earth');
  assert.deepEqual(['1e9', '2e6', '1e5', '100', '1e-4'].map(Number).map(layerFor),
    ['cosmic', 'group', 'galaxy', 'stars', 'solar']);
  // In the game: the Milky Way fly-in brings in the galaxy layer, the Kuiper belt brings in the Solar System.
  const [aspect, box] = viewOf('desktop');
  const mw = stopIndex('milky-way'), mwL = legLengthLy(mw), mwZones = zonesFor(mw);
  const startMw = cameraFor(flightState(mw, 0, 0, 0, 0.5), aspect, {}, box);
  const endMw = cameraFor(flightState(mw, mwL, mwZones.length - 1, 1, 0), aspect, {}, box);
  assert.equal(startMw.layerWeights.galaxy, 0);
  assert.equal(endMw.layerWeights.galaxy, 1);
  const sun = cameraFor({ phase: 'reveal', stop: stopIndex('sun'), mode: 'stop', draw: DRAW }, aspect, {}, box);
  assert.equal(sun.layerWeights.solar, 1);
  assert.equal(sun.layer, 'solar');
  assert.ok(sun.layers.solar.near < 40 * 0.5, 'the solar near plane sits in front of the nearest body');
});

// ---------- reveals, the ending, key art ----------

test('reveals frame the landmark in the middle of the free box', () => {
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    for (let i = 0; i < LAST; i++) {
      const cam = cameraFor({ phase: 'reveal', stop: i, mode: 'stop', draw: DRAW }, aspect, {}, box);
      const p = project(STOPS[i].target.id, cam);
      assert.ok(Math.abs(p.x - (box.x + box.w / 2)) < 2 && Math.abs(p.y - (box.y + box.h / 2)) < 2,
        `${STOPS[i].id} ${name}: at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
      assert.ok(p.y - p.rawR >= box.y - 1 && p.y + p.rawR <= box.y + box.h + 1, `${STOPS[i].id} ${name}: ring fits`);
    }
    // The Milky Way reveal shows a barred spiral filling a good part of the short side.
    const mw = project('milky-way', cameraFor({ phase: 'reveal', stop: stopIndex('milky-way'), mode: 'stop', draw: DRAW },
      aspect, {}, box));
    assert.ok(2 * mw.rawR >= 0.3 * Math.min(LAYOUTS[name].width, LAYOUTS[name].height), `${name}: Milky Way ${mw.rawR}`);
    // Spot reveals turn to the answer.
    for (const i of [stopIndex('andromeda'), stopIndex('pleiades')]) {
      const cam = cameraFor({ phase: 'reveal', phaseT: SPOT_BLEND, stop: i, mode: 'spot', draw: DRAW }, aspect, {}, box);
      const p = project(STOPS[i].spot.target.id, cam);
      assert.ok(Math.abs(p.x - (box.x + box.w / 2)) < 2 && Math.abs(p.y - (box.y + box.h / 2)) < 2);
    }
  }
  // The pose depends on the layout only through the aim and the field of view.
  assert.deepEqual(revealPose(4, ...viewOf('desktop')).pos, revealPose(4, ...viewOf('portrait')).pos);
});

test('the ending: Earth grows in the lower part, the address stills ring each place, key art shows Earth and Moon', () => {
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    let last = 0;
    for (let t = 0; t <= 8; t += 0.5) {
      const cam = cameraFor({ phase: 'ending', phaseT: t, stop: LAST, ending: { beat: 0, t }, say: {} }, aspect, {}, box);
      const p = project('earth', cam);
      assert.ok(p.visible && p.ang >= last, `${name} t ${t}: Earth grows`);
      last = p.ang;
      if (t >= 2) assert.ok(p.y > box.y + box.h / 2, `${name} t ${t}: Earth in the lower part of the free box`);
      // it ends whole inside the free box, under the date stamp and clear of the caption below the box
      if (t === 8) {
        assert.ok(p.y - p.rawR >= box.y + 0.25 * box.h && p.y + p.rawR <= box.y + box.h + 1, `${name}: Earth fits`);
        assert.ok(2 * p.rawR >= 0.6 * Math.min(box.w, 0.72 * box.h), `${name}: Earth ends big (${p.rawR.toFixed(0)} px)`);
      }
    }
    const moon = project('moon', cameraFor({ phase: 'ending', stop: LAST, ending: { beat: 0, t: 0 }, say: {} }, aspect, {},
      box));
    assert.ok(moon.visible, `${name}: the Moon passes at the start of the approach`);
    for (const ring of ['earth', 'sun', 'orion-arm', 'milky-way', 'local-group', 'laniakea']) {
      const cam = cameraFor({ phase: 'ending', stop: LAST, ending: { beat: ENDING.indexOf('address'), t: 1 },
        say: { current: { ring } } }, aspect, {}, box);
      const p = project(ring, cam);
      assert.ok(insideBox(p, box, 0), `${name}: ${ring} still`);
      assert.ok(cam.layerWeights[cam.layer] > 0.5);
    }
    const plain = endingPose({ beat: ENDING.indexOf('address'), t: 14 }, aspect, box);
    assert.ok(insideBox(project('laniakea', { ...plain, aspect, width: box.width, height: box.height }), box, 0),
      'without captions the stills step every 2.5 s');
  }
  const key = keyartPose(480 / 270, { x: 0, y: 0, w: 480, h: 270, width: 480, height: 270 });
  for (const id of ['earth', 'moon']) {
    const p = project(id, key);
    assert.ok(p.visible && p.x - p.rawR >= 0 && p.x + p.rawR <= 480 && p.y - p.rawR >= 0 && p.y + p.rawR <= 270,
      `key art: ${id} whole on screen`);
    assert.ok(p.rawR >= 14, `key art: ${id} ${p.rawR.toFixed(1)} px`);
  }
});

// ---------- chevrons and the look swing ----------

test('edge chevrons point at off-screen candidates, and lookToward brings them back', () => {
  for (const [name] of SIZES) {
    const [aspect, box] = viewOf(name);
    for (const sc of SCANS) {
      const state = scanState(sc, 4);
      const ids = Object.values(state.draw[sc.id]);
      const turned = cameraFor(state, aspect, { yaw: 60, pitch: 35 }, box);
      for (const id of ids) {
        const p = project(id, turned);
        const ch = edgeChevron(p, turned);
        if (insideBox(p, box, 24)) { assert.equal(ch, null); continue; }
        assert.ok(ch, `${sc.id} ${name}: ${id} needs a chevron`);
        const onEdge = [Math.abs(ch.x - (box.x + 24)), Math.abs(ch.x - (box.x + box.w - 24)), Math.abs(ch.y - (box.y + 24)),
          Math.abs(ch.y - (box.y + box.h - 24))].some((d) => d < 1e-6);
        assert.ok(onEdge && ch.x >= box.x + 24 - 1e-6 && ch.x <= box.x + box.w - 24 + 1e-6, `${id}: chevron on the edge`);
        if (p.front) {
          const toward = [p.x - (box.x + box.w / 2), p.y - (box.y + box.h / 2)];
          assert.ok(toward[0] * Math.cos(ch.angle) + toward[1] * Math.sin(ch.angle) > 0, 'points toward the target');
        }
        const look = lookToward(id, turned);
        const swung = cameraFor(state, aspect, look, box);
        assert.ok(insideBox(project(id, swung), box, HIT_MIN), `${sc.id} ${name}: swinging to ${id} brings it on screen`);
      }
    }
  }
});
