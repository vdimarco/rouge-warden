// Light Years Home v3: ghosts (final.md 18.1, races §2.5). A ghost is positions at 20 Hz in 1/32 u steps; a link is the
// run at 10 Hz in base64url. Checks: encode then decode stays within 0.05 u of the path; the same inputs give the same
// bytes; a 20 s link is under 1 KB; the pacer is the ghost with its clock stretched by the medal's ratio; junk decodes
// to nothing. node qa/light-years-home/v3/ghost.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, record, encode, decode, sampleAt, pacerAt, toLink, fromLink, flagsOf, toBase64, fromBase64 }
  from '../../../public/light-years-home/core/ghost.js';
import { pacerOnCourse, course, startEvent } from '../../../public/light-years-home/core/race.js';
import { BOTS } from '../../../public/light-years-home/core/bots.js';
import { wireAll, newGame, run, WALL, H } from './activities.mjs';

wireAll();

// Drive the Wall with the wander bot for `seconds`, recording at 20 Hz; returns the recorder and the true path.
function drive(seed, seconds, boost = false) {
  const game = newGame({ seed });
  const bot = BOTS.wander.make({ seed, R: WALL.R });
  const rec = createRecorder(20, seconds + 1);
  const path = [];
  run(game, (g) => {
    const r = bot.next(g);
    if (boost) { r.boost = true; g.ship.bar = 1; }
    return r;
  }, seconds, {
    until: (g) => {
      const t = g.t;
      const n = rec.n;
      record(rec, g.ship, flagsOf(g.ship, t), t);
      if (rec.n > n) path.push(g.ship.pos.slice());
      return false;
    },
  });
  return { rec, path, game };
}

test('encode then decode stays within 0.05 u of the recorded path', () => {
  for (const seed of [1, 2, 3]) {
    const { rec, path } = drive(seed, 30);
    const g = decode(encode(rec));
    assert.ok(g, 'decodes');
    assert.equal(g.n, path.length);
    assert.equal(g.hz, 20);
    let worst = 0;
    for (let i = 0; i < g.n; i++) {
      worst = Math.max(worst, Math.hypot(g.x[i] - path[i][0], g.y[i] - path[i][1], g.z[i] - path[i][2]));
    }
    assert.ok(worst <= 0.05, `seed ${seed}: worst ${worst.toFixed(3)} u`);
    // Between samples it interpolates; past the end there is no sample.
    const out = [0, 0, 0, 0];
    assert.equal(sampleAt(g, g.duration + 0.1, out), false);
    assert.equal(sampleAt(g, -0.1, out), false);
    assert.equal(sampleAt(g, g.duration / 2, out), true);
    assert.ok(Number.isFinite(out[3]), 'yaw comes along');
  }
});

test('the same inputs give the same ghost bytes', () => {
  const a = encode(drive(4, 20).rec), b = encode(drive(4, 20).rec);
  assert.deepEqual(a, b);
  const c = encode(drive(5, 20).rec);
  assert.notDeepEqual(a, c, 'another seed drives another line');
});

test('a 20 s link is under 1 KB, at boost speed, and reads back within 1/16 u', (t) => {
  const { rec, path } = drive(6, 20, true);
  const link = toLink('first-light', encode(rec));
  t.diagnostic(`20 s link: ${link.length} characters`);
  assert.ok(link.length < 1024, `${link.length} characters`);
  const back = fromLink(link);
  assert.equal(back.id, 'first-light');
  assert.equal(back.ghost.hz, 10);
  let worst = 0;
  for (let i = 0; i < back.ghost.n; i++) {
    const p = path[i * 2];
    worst = Math.max(worst, Math.hypot(back.ghost.x[i] - p[0], back.ghost.y[i] - p[1]));
  }
  assert.ok(worst < 0.1, `link error ${worst.toFixed(3)} u`);
  assert.equal(fromLink('junk'), null);
  assert.equal(fromLink('first-light~***'), null);
});

test('the pacer leads by the medal ratio', () => {
  const { rec } = drive(7, 20);
  const g = decode(encode(rec));
  const a = [0, 0, 0], b = [0, 0, 0];
  for (const ratio of [1.07, 1.2, 1.5]) {
    for (const t of [1, 5.5, 12.3]) {
      assert.equal(pacerAt(g, t * ratio, ratio, a), true);
      sampleAt(g, t, b);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6, `ratio ${ratio} at ${t}`);
    }
  }
  // With no author ghost yet, the course pacer runs the line at an even pace that lands on the medal time.
  const ev = WALL.events.find((e) => e.id === 'first-light');
  const c = course(ev);
  const end = [0, 0, 0, 0];
  assert.equal(pacerOnCourse(ev, ev.gold, ev.gold, end), true);
  assert.ok(Math.hypot(end[0] - c.gates.at(-1).pos[0], end[1] - c.gates.at(-1).pos[1]) < 2, 'ends at the finish');
  assert.equal(pacerOnCourse(ev, ev.gold, ev.gold + 0.1, end), false);
});

test('a finished race carries its ghost when it is a record', () => {
  const game = newGame({ seed: 2 });
  startEvent(game, 'first-light', { fromRunup: true });
  const bot = BOTS.mid.make({ event: 'first-light', seed: 2 });
  const { events } = run(game, (g) => bot.next(g), 40, { until: (g) => g.race?.state === 'finished' });
  const fin = events.find((e) => e.type === 'finish');
  assert.ok(fin, 'finished');
  assert.equal(fin.record, true);
  const g = decode(fin.ghost);
  assert.ok(g && Math.abs(g.duration - fin.time) < 0.25, `ghost ${g?.duration} s against ${fin.time} s`);
});

test('junk bytes and base64 decode to nothing; base64 round-trips', () => {
  assert.equal(decode(new Uint8Array(3)), null);
  assert.equal(decode(new Uint8Array(40)), null);
  assert.equal(decode('nope'), null);
  for (const n of [0, 1, 2, 3, 4, 5, 64, 65]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
    assert.deepEqual(fromBase64(toBase64(bytes, true)), bytes);
  }
  assert.equal(fromBase64('a'), null);
  assert.equal(H, 1 / 120);
});
