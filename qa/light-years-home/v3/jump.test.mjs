// Light Years Home v3: the jump as a free corridor (final.md 18.1, 11; decisions.md 2). The run-up rings, the punch,
// the corridor's passes, the fork, the long haul, Earth's clock, the cards, the medals and the arrival bar, and the
// bots' nines on 20 seeds. node qa/light-years-home/v3/jump.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, step, wire, unwire, registerZone, makeInput, H,
} from '../../../public/light-years-home/core/game.js';
import { FLIGHT } from '../../../public/light-years-home/core/ship.js';
import { createEventBuffer } from '../../../public/light-years-home/core/events.js';
import { TUNE } from '../../../public/light-years-home/core/tune.js';
import { hashState } from '../../../public/light-years-home/core/hash.js';
import { aheadLyAt } from '../../../public/light-years-home/core/world/legs.js';
import { JUMPS } from '../../../public/light-years-home/core/world/jumps.js';
import { earthDateText } from '../../../public/light-years-home/core/timeline.js';
import {
  armJump, stepJump, setZoneReady, jumpMedal, jumpLength, medalBar, targetDir, resolveAt, JUMP_BOTS, JUMP_SLOTS,
  HAZ, RES, NINE2, NINE3, MEDALS,
} from '../../../public/light-years-home/core/jump.js';
import wall from '../../../public/light-years-home/core/world/zones/wall.js';
import coma from '../../../public/light-years-home/core/world/zones/coma.js';

// Virgo and the Andromeda edge come in Round 2: stand-ins with their own ids and objects.
const virgo = { ...coma, id: 'virgo', name: 'Virgo', object: 'virgo' };
const andromeda = { ...coma, id: 'andromeda-edge', name: 'Andromeda edge', object: 'andromeda' };
const FROM = { J1: [wall, 'coma'], J2: [coma, 'virgo'], J3: [virgo, 'andromeda-edge'] };
const TODAY = { y: 2026, m: 10, d: 13, hh: 12, mm: 0 };

function setup() {
  unwire();
  wire({ ...FLIGHT, ...JUMP_SLOTS });
  for (const z of [wall, coma, virgo, andromeda]) registerZone(z);
}

// A game in the jump's start zone, inside the rim, heading `off` degrees from the target; its exit open.
function startGame(jid, seed = 1, { off = 0, bar = 0.5 } = {}) {
  const [from, to] = FROM[jid];
  const dir = targetDir(from, to);
  const heading = (Math.atan2(dir[0], dir[1]) * 180) / Math.PI + off;
  const game = createGame({ seed, zoneData: from, mode: 'drive', at: [0, -150, 0], heading, speed: 40, today: TODAY });
  game.ship.bar = bar;
  return { game, to };
}

// Fly a jump to the end with a bot (or a policy), telling the core the zone is ready at readyAt s into the jump.
function fly(jid, botName, seed, { readyAt = 0, policy = null, maxS = 90, off = 0 } = {}) {
  const { game, to } = startGame(jid, seed, { off });
  const ev = createEventBuffer(8192);
  const events = [];
  assert.ok(armJump(game, to, ev), 'armed');
  const bot = botName ? JUMP_BOTS[botName]({ seed }) : null;
  let last = game.jump, steps = 0, dropBar = null, dropMedal = null;
  while (game.jump && steps < maxS / H) {
    if (game.jump.t >= readyAt && game.mode !== 'runup') setZoneReady(game, true);
    ev.clear();
    const inp = policy ? policy(game) : bot.next(game);
    const wasDrop = game.mode === 'dropout';
    step(game, inp, ev);
    for (let i = 0; i < ev.n; i++) events.push({ ...ev.list[i], jt: game.jump?.t ?? last.t });
    if (!wasDrop && game.mode === 'dropout') { dropBar = game.ship.bar; dropMedal = game.jump.medal; }
    if (game.jump) last = game.jump;
    steps++;
  }
  return { game, last, events, dropBar, dropMedal };
}

test('the jump length: J2 26 s, J3 25 s, the soft first jump 18 s', () => {
  assert.equal(jumpLength(2.72e8), 26);
  assert.equal(jumpLength(5.5e7), 25);
  assert.equal(jumpLength(7.37e8, true), 18);
  assert.equal(jumpLength(4.24), 16);
  assert.deepEqual(['J1', 'J2', 'J3'].map((id) => JUMPS[id].L), [18, 26, 25]);
});

test('the run-up: three rings bend toward the target, then the punch', () => {
  setup();
  const { game, to } = startGame('J1', 3, { off: 60 });
  const ev = createEventBuffer(4096);
  armJump(game, to, ev);
  const R = game.jump.runup;
  assert.equal(game.mode, 'runup');
  assert.ok(R.placed && !R.wait);
  // Each ring turns at most RUNUP_BEND toward the target.
  const h = (n) => Math.atan2(n[0], n[1]);
  const hd = (game.ship.yaw * 180) / Math.PI;
  let prev = hd;
  for (const n of R.normals) {
    const a = (h(n) * 180) / Math.PI;
    const turn = Math.abs(((a - prev + 540) % 360) - 180);
    assert.ok(turn <= TUNE.JUMP.RUNUP_BEND + 1e-6, `bend ${turn.toFixed(1)}`);
    prev = a;
  }
  const bot = JUMP_BOTS.mid({ seed: 3 });
  const rings = [];
  let punchT = null;
  for (let i = 0; i < 12 / H && game.mode === 'runup'; i++) {
    ev.clear();
    step(game, bot.next(game), ev);
    for (let k = 0; k < ev.n; k++) {
      if (ev.list[k].type === 'runupRing') rings.push(ev.list[k].n);
      if (ev.list[k].type === 'punch') punchT = game.t;
    }
  }
  assert.deepEqual(rings, [1, 2, 3]);
  assert.equal(game.mode, 'punch');
  assert.ok(punchT < 9, `run-up took ${punchT?.toFixed(1)} s`);
  // The punch: a hit-stop, the controls locked, the sky winding up to the entry rapidity.
  assert.ok(game.stopUntil > game.t - H && game.lockUntil > game.t);
});

test('the run-up: a target behind holds the rings; a missed ring re-forms; only a tap calls it off', () => {
  setup();
  let { game, to } = startGame('J1', 1, { off: 170 });
  const ev = createEventBuffer(1024);
  armJump(game, to, ev);
  assert.ok(game.jump.runup.wait, 'TURN TOWARD COMA: the first ring waits');
  // Turn toward it: the rings appear.
  for (let i = 0; i < 4 / H && game.jump.runup.wait; i++) step(game, makeInput({ steer: 1 }), ev);
  assert.ok(!game.jump.runup.wait && game.jump.runup.placed);
  // Steer away from the first ring: it re-forms ahead.
  ({ game } = startGame('J1', 1));
  armJump(game, to, ev);
  ev.clear();
  for (let i = 0; i < 6 / H && game.mode === 'runup'; i++) step(game, makeInput({ steer: -1 }), ev);
  assert.ok(ev.count('runupMiss') >= 1);
  // Braking to line up a ring never calls it off; a tap of the action control does.
  ({ game } = startGame('J1', 1));
  armJump(game, to, ev);
  for (let i = 0; i < 1.5 / H; i++) step(game, makeInput({ brake: 1 }), ev);
  assert.equal(game.mode, 'runup');
  step(game, makeInput({ action: true }), ev);
  assert.equal(game.mode, 'drive');
  assert.equal(game.jump, null);
});

test('the still bot always arrives, in the next zone at the arrival speed', () => {
  setup();
  for (const jid of ['J1', 'J2', 'J3']) {
    for (let seed = 1; seed <= 20; seed++) {
      const { game, last } = fly(jid, 'still', seed, { off: 0 });
      // The still bot never steers, so it gets the run-up from a helper: start it at the punch.
      assert.equal(game.mode, 'drive', `${jid} seed ${seed}`);
      assert.equal(game.zoneId, FROM[jid][1]);
      assert.ok(last.etaPeak >= TUNE.JUMP.ETA_ENTRY - 1e-9);
      assert.ok(MEDALS.includes(jumpMedal(last)));
    }
  }
});

test('a jump cannot be failed: a bot that steers into every hazard still arrives', () => {
  setup();
  const into = (game) => {
    const inp = makeInput({ source: 'pad' });
    const J = game.jump;
    if (game.mode === 'runup') return JUMP_BOTS.mid({ seed: 1 }).next(game);
    if (!J || game.mode !== 'tunnel') return inp;
    let best = -1, bt = 9;
    for (let i = 0; i < J.haz.n; i++) {
      if (J.haz.state[i] !== 1 || J.haz.kind[i] === HAZ.pad) continue;
      const ttp = J.haz.tp[i] - J.t;
      if (ttp > 0 && ttp < bt) { bt = ttp; best = i; }
    }
    if (best >= 0) {
      const k = J.haz.kind[best];
      // Walls and forks: aim at the sheet, not the gap.
      const tx = k === HAZ.wall || k === HAZ.fork ? -J.haz.x[best] * 0.2 : J.haz.x[best];
      const ty = k === HAZ.wall || k === HAZ.fork ? -J.haz.y[best] * 0.2 : J.haz.y[best];
      inp.steer = Math.max(-1, Math.min(1, (tx - J.pos[0]) / 3));
      inp.climb = Math.max(-1, Math.min(1, (ty - J.pos[1]) / 3));
    }
    return inp;
  };
  const r = fly('J1', null, 4, { policy: into });
  assert.equal(r.game.mode, 'drive');
  assert.equal(r.game.zoneId, 'coma');
  assert.ok(r.last.hits >= 3, `hits ${r.last.hits}`);
  const etas = r.events.filter((e) => e.type === 'jHit').map((e) => e.eta);
  assert.ok(etas.every((e) => e >= TUNE.JUMP.ETA_FLOOR - 1e-9), 'never under the floor');
  assert.equal(jumpMedal(r.last), 'bronze');
});

test('mid and expert nines targets on 20 seeds (final.md 11.5)', () => {
  setup();
  for (const jid of ['J1', 'J2', 'J3']) {
    const res = {};
    for (const b of ['mid', 'expert']) {
      let two = 0, three = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const { last } = fly(jid, b, seed);
        if (last.etaPeak >= NINE2) two++;
        if (last.etaPeak >= NINE3) three++;
      }
      res[b] = { two, three };
    }
    const msg = `${jid}: ${JSON.stringify(res)}`;
    assert.ok(res.mid.two >= 18, `mid reaches 0.99c in at least 90%. ${msg}`);
    assert.ok(res.mid.three >= 6 && res.mid.three <= 10, `mid reaches 0.999c in 30 to 50%. ${msg}`);
    assert.ok(res.expert.three >= 18, `expert reaches 0.999c in at least 90%. ${msg}`);
  }
});

test('the corridor: grazes, hairlines and hits as the pass check says', () => {
  setup();
  const { game, to } = startGame('J2', 2);
  armJump(game, to);
  const J = game.jump, Hz = J.haz, SR = TUNE.JUMP.SHIP_R;
  Hz.kind[0] = HAZ.knot; Hz.x[0] = 0; Hz.y[0] = 0; Hz.r[0] = 1.5; Hz.state[0] = 1;
  assert.equal(resolveAt(Hz, 0, 1.5 + SR - 0.01, 0).code, RES.hit);
  const g = resolveAt(Hz, 0, 1.5 + SR + 0.3, 0);
  assert.ok(g.code === RES.pass && g.gap < TUNE.JUMP.HAIRLINE);
  assert.ok(resolveAt(Hz, 0, 1.5 + SR + 1.2, 0).gap < TUNE.JUMP.GRAZE);
  Hz.kind[0] = HAZ.wall; Hz.r[0] = 2.8;
  assert.equal(resolveAt(Hz, 0, 0, 0).code, RES.pass);
  assert.equal(resolveAt(Hz, 0, 2.5, 0).code, RES.hit);
  Hz.kind[0] = HAZ.gate; Hz.r[0] = 2.9; Hz.w[0] = 0.5;
  assert.equal(resolveAt(Hz, 0, 0.5, 0).code, RES.thread);
  assert.equal(resolveAt(Hz, 0, 2.9, 0).code, RES.hit);
  assert.equal(resolveAt(Hz, 0, 6, 0).code, RES.pass);
});

test('steering: the rate stick moves the ship across the corridor; the slide charges tiers and pays rapidity', () => {
  setup();
  const { game, to } = startGame('J2', 5);
  const ev = createEventBuffer(8192);
  armJump(game, to, ev);
  const bot = JUMP_BOTS.mid({ seed: 5 });
  while (game.mode !== 'tunnel') { ev.clear(); step(game, bot.next(game), ev); }
  const J = game.jump;
  // Full right stick: the ship reaches most of LAT_RATE within a quarter second.
  const x0 = J.pos[0];
  for (let i = 0; i < 0.25 / H; i++) step(game, makeInput({ steer: 1, source: 'pad' }), ev);
  assert.ok(J.vel[0] > TUNE.JUMP.LAT_RATE * 0.9, `vel ${J.vel[0].toFixed(1)}`);
  assert.ok(J.pos[0] - x0 > 4, 'it moved');
  // Let go: it stops quickly.
  for (let i = 0; i < 0.15 / H; i++) step(game, makeInput({ source: 'pad' }), ev);
  assert.ok(Math.abs(J.vel[0]) < 1.5);
  // Keys: W and S (gas and brake) move it up and down too (from the middle, clear of the tube's wall).
  J.pos[0] = 0; J.pos[1] = -4; J.vel[0] = J.vel[1] = 0;
  for (let i = 0; i < 0.2 / H; i++) step(game, makeInput({ gas: 1, source: 'keys' }), ev);
  assert.ok(J.vel[1] > TUNE.JUMP.LAT_RATE * 0.8, `vel ${J.vel[1].toFixed(1)}`);
  // The slide: drift held while weaving across an empty stretch of tube.
  const empty = () => { J.haz.state.fill(0); J.haz.n = 0; J.haz.live = 0; };
  J.plan.specials = []; J.plan.nextT = 1e9;
  ev.clear();
  let tierMax = 0;
  for (let i = 0; i < 2.6 / H; i++) {
    empty();
    const dir = Math.floor((i * H) / 0.55) % 2 ? -1 : 1;
    step(game, makeInput({ steer: dir, drift: true, source: 'pad' }), ev);
    tierMax = Math.max(tierMax, J.tier);
  }
  assert.ok(ev.count('driftStart') >= 1 && tierMax >= 2, `tier ${tierMax}`);
  const before = J.eta, tier = J.tier;
  step(game, makeInput({ source: 'pad' }), ev);
  const boost = ev.list.slice(0, ev.n).find((e) => e.type === 'driftBoost');
  assert.ok(boost && boost.tier === tier, 'letting go pays the tier');
  assert.ok(J.eta > before, `η ${before.toFixed(2)} → ${J.eta.toFixed(2)}`);
});

test('the fork sets the next quarter: the calm way brings rails and pads, the knots way packs knots', () => {
  setup();
  const count = (way) => {
    const kinds = { knot: 0, rail: 0, pad: 0, wall: 0 };
    let mode = null;
    for (let seed = 1; seed <= 6; seed++) {
      const bot = JUMP_BOTS.expert({ seed });
      const policy = (game) => {
        const J = game.jump;
        const inp = bot.next(game);
        if (!J || game.mode !== 'tunnel') return inp;
        // Head for the chosen gap from 1 s out.
        for (let i = 0; i < J.haz.n; i++) {
          if (J.haz.state[i] !== 1 || J.haz.kind[i] !== HAZ.fork || J.haz.tp[i] - J.t > 1.2) continue;
          const x = way === 'a' ? J.haz.x[i] : J.haz.x1[i], y = way === 'a' ? J.haz.y[i] : J.haz.y1[i];
          inp.steer = Math.max(-1, Math.min(1, (x - J.pos[0]) / 2));
          inp.climb = Math.max(-1, Math.min(1, (y - J.pos[1]) / 2));
        }
        return inp;
      };
      const { game, to } = startGame('J2', seed);
      const ev = createEventBuffer(8192);
      armJump(game, to, ev);
      let seen = new Set();
      while (game.jump) {
        setZoneReady(game, true);
        ev.clear();
        step(game, policy(game), ev);
        const J = game.jump;
        if (!J) break;
        if (J.fork?.taken && mode === null) mode = J.plan.mode;
        if (J.fork?.taken && J.t < J.plan.modeUntil) {
          for (let i = 0; i < J.haz.n; i++) {
            if (!J.haz.state[i] || seen.has(J.haz.id[i]) || J.haz.tp[i] < J.t + 1) continue;
            seen.add(J.haz.id[i]);
            const k = ['', 'knot', 'rail', 'wall', 'gate', 'pad', 'fork'][J.haz.kind[i]];
            if (k in kinds) kinds[k]++;
          }
        }
      }
      assert.ok(game.progress.jumps.J2, 'arrived');
    }
    return { kinds, mode };
  };
  const a = count('a'), b = count('b');
  assert.equal(a.mode, 'calm');
  assert.equal(b.mode, 'dense');
  assert.ok(a.kinds.rail + a.kinds.pad > b.kinds.rail + b.kinds.pad, JSON.stringify({ a, b }));
  assert.ok(b.kinds.knot > a.kinds.knot * 1.5, JSON.stringify({ a, b }));
});

test('the vista waits for zoneReady; the long haul adds 5 s stretches up to 15 s', () => {
  setup();
  const L = JUMPS.J1.L;
  // Never ready: three stretches, then the drop-out anyway.
  let r = fly('J1', 'mid', 1, { readyAt: 1e9 });
  assert.equal(r.events.filter((e) => e.type === 'longHaul').length, 3);
  const vista = r.events.find((e) => e.type === 'vista');
  assert.ok(Math.abs(vista.jt - (L + 15 - TUNE.JUMP.VISTA_AT)) < 0.05, `vista at ${vista.jt}`);
  assert.equal(r.game.zoneId, 'coma');
  // Ready 6 s late: two stretches.
  r = fly('J1', 'mid', 1, { readyAt: L - 5 + 6 });
  assert.equal(r.events.filter((e) => e.type === 'longHaul').length, 2);
  // Ready in time: none, and the vista comes at L − 4 s.
  r = fly('J1', 'mid', 1);
  assert.equal(r.events.filter((e) => e.type === 'longHaul').length, 0);
  assert.ok(Math.abs(r.events.find((e) => e.type === 'vista').jt - (L - 4)) < 0.05);
  const drop = r.events.find((e) => e.type === 'drop');
  assert.ok(Math.abs(drop.jt - (L - 3)) < 0.05);
});

test("Earth's date at arrival matches final.md 11.4", () => {
  setup();
  const want = { J1: ['coma', '330 MILLION YEARS AGO'], J2: ['virgo', '57.8 MILLION YEARS AGO'],
    J3: ['andromeda-edge', '2.5 MILLION YEARS AGO'] };
  for (const jid of ['J1', 'J2', 'J3']) {
    const { game, events } = fly(jid, 'mid', 2);
    const [to, text] = want[jid];
    assert.ok(Math.abs(game.earth.aheadLy - aheadLyAt(to)) < 1, jid);
    assert.equal(earthDateText(game.earth.aheadLy, TODAY, { short: true }).toUpperCase().includes(text.split(' ')[0]),
      true, `${jid}: ${earthDateText(game.earth.aheadLy, TODAY)}`);
    // The clock only falls.
    const aheads = events.filter((e) => e.type === 'earthCard').map((e) => e.jt);
    assert.ok(aheads.every((t, i) => i === 0 || t >= aheads[i - 1]));
  }
});

test('On Earth cards appear in order, one per 3 s at most; the rest go to the log', () => {
  setup();
  const { game, events } = fly('J1', 'mid', 3);
  const cards = events.filter((e) => e.type === 'earthCard');
  const order = ['seaweed', 'snowball', 'cambrian', 'land-plants', 'tetrapods'];
  const ids = cards.map((e) => e.id);
  assert.deepEqual(ids, order.filter((id) => ids.includes(id)), 'oldest first');
  for (let i = 1; i < cards.length; i++) assert.ok(cards[i].jt - cards[i - 1].jt >= TUNE.JUMP.CARD_GAP - 1e-6);
  assert.deepEqual(game.earth.cardsShown, order, 'every card crossed reaches the log');
});

test('the arrival bar follows the medal (bronze 0.5, silver 0.75, gold or Tern full)', () => {
  setup();
  const seen = new Set();
  for (const [b, seeds] of [['still', [1, 2]], ['mid', [1, 2, 3, 4, 5]], ['expert', [1, 2, 3]]]) {
    for (const seed of seeds) {
      const r = fly('J1', b, seed);
      assert.equal(r.dropBar, medalBar(r.dropMedal), `${b} ${seed} ${r.dropMedal}`);
      seen.add(r.dropMedal);
    }
  }
  assert.ok(seen.size >= 3, [...seen].join());
  assert.deepEqual(MEDALS.map((m) => medalBar(m)), [0.5, 0.75, 1, 1]);
});

test('Dot speaks at most three lines a jump, and the punch line comes first', () => {
  setup();
  const { last } = fly('J2', 'mid', 1);
  assert.ok(last.say.length + last.pend.length <= TUNE.JUMP.DOT_LINES);
  assert.equal(last.say[0], 'dot.checked');
});

test('the same seed and inputs fly the same jump', () => {
  setup();
  const a = fly('J2', 'expert', 7), b = fly('J2', 'expert', 7);
  assert.equal(hashState(a.game), hashState(b.game));
  assert.equal(a.events.length, b.events.length);
});

// ---------------------------------------------------------------- Round 1 playtest fixes

test('through the exit gate from five directions, in both zones: no rim turn-back, LIGHT SPEED within 8 s', async () => {
  const { playSlots, openExit } = await import('../../../public/light-years-home/core/zone.js');
  const { createEventBuffer: buf } = await import('../../../public/light-years-home/core/events.js');
  unwire();
  wire(playSlots({ jump: stepJump, arm: armJump }));
  for (const z of [wall, coma, virgo]) registerZone(z);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (x) => Math.max(-1, Math.min(1, x));
  // A plain driver: steer the travel line at the exit gate, then at each launch ring, with the gas held; touch.
  const drive = (zone) => (g) => {
    const s = g.ship, v = Math.atan2(s.vel[0], s.vel[1]);
    let at = zone.exit.pos;
    if (g.mode === 'runup') {
      const R = g.jump.runup;
      if (R.wait || !R.placed) return makeInput({ steer: clamp(2 * wrap(Math.atan2(R.dir[0], R.dir[1]) - s.yaw)), source: 'touch' });
      at = R.rings[R.done];
    }
    return makeInput({ steer: clamp(4 * wrap(Math.atan2(at[0] - s.pos[0], at[1] - s.pos[1]) - v)), gas: 1, source: 'touch' });
  };
  for (const zone of [wall, coma]) {
    const e = zone.exit.pos, R = zone.R;
    // Five approaches, each about 120 u from the gate, from the rim side to the centre side.
    for (const k of [-2, -1, 0, 1, 2]) {
      const a = Math.atan2(-e[0], -e[1]) + k * 0.5;
      const at = [e[0] + Math.sin(a) * 120, e[1] + Math.cos(a) * 120, 0];
      if (Math.hypot(at[0], at[1]) > R - 10) continue;
      const heading = (Math.atan2(e[0] - at[0], e[1] - at[1]) * 180) / Math.PI;
      const game = createGame({ seed: 1, zoneData: zone, mode: 'drive', at, heading, speed: 24, today: TODAY });
      game.story.openingI = 99;
      openExit(game);
      const ev = buf(4096);
      let gateT = null, punchT = null, misses = 0, turns = 0;
      for (let i = 0; i < 40 / H && punchT === null; i++) {
        ev.clear();
        step(game, drive(zone)(game), ev);
        for (let j = 0; j < ev.n; j++) {
          const t = ev.list[j].type;
          if (t === 'mode' && ev.list[j].to === 'runup') gateT = game.t;
          if (t === 'runupMiss') misses++;
          if (t === 'edgeTurn' && game.mode === 'runup') turns++;
          if (t === 'punch') punchT = game.t;
        }
      }
      const where = `${zone.id} approach ${k}`;
      assert.ok(gateT !== null, `${where}: through the gate`);
      assert.ok(punchT !== null && punchT - gateT <= 8, `${where}: punch ${(punchT - gateT).toFixed(1)} s after the gate`);
      assert.equal(turns, 0, `${where}: no turn-back in the run-up`);
      assert.ok(misses <= 1, `${where}: ${misses} missed rings`);
    }
  }
  setup();
});

test('the jump bots: made mid-corridor they never throw, and in the run-up they fly the travel line through rings', () => {
  setup();
  for (const name of ['mid', 'expert', 'thumb']) {
    for (let seed = 1; seed <= 12; seed++) {
      const { game, to } = startGame('J1', seed);
      const ev = createEventBuffer(8192);
      armJump(game, to, ev);
      const first = JUMP_BOTS.mid({ seed });
      let made = null, missed = 0;
      for (let i = 0; i < 40 / H && game.jump; i++) {
        // A second bot made at a random moment of the run takes over (the hook's bot() does this).
        if (!made && game.mode === 'tunnel' && game.jump.t > 3 + (seed % 5)) made = JUMP_BOTS[name]({ seed });
        if (game.jump && game.mode !== 'runup') setZoneReady(game, true);
        ev.clear();
        step(game, (made || first).next(game), ev);
        missed += ev.count('runupMiss');
      }
      assert.ok(made, `${name} ${seed}: made in the corridor`);
      assert.equal(game.zoneId, 'coma', `${name} ${seed}: arrived`);
      assert.equal(missed, 0, `${name} ${seed}: run-up rings missed ${missed}`);
    }
  }
});

test('the fix earned facing Coma starts the run-up there; facing away, the exit gate is the objective', async () => {
  const { playSlots } = await import('../../../public/light-years-home/core/zone.js');
  const { startMission } = await import('../../../public/light-years-home/core/mission.js');
  const { createEventBuffer: buf } = await import('../../../public/light-years-home/core/events.js');
  unwire();
  wire(playSlots({ jump: stepJump, arm: armJump }));
  for (const z of [wall, coma]) registerZone(z);
  const toComa = (Math.atan2(...targetDir(wall, 'coma').slice(0, 2)) * 180) / Math.PI;
  for (const [off, want] of [[20, 'runup'], [120, 'drive']]) {
    const game = createGame({ seed: 1, zoneData: wall, mode: 'drive', at: [0, -100, 0], heading: toComa + off, speed: 24,
      today: TODAY });
    game.story.openingI = 99;
    startMission(game, 'which-way-home', 2);
    for (const id of ['far-coma', 'far-leo', 'far-hercules']) game.zone.scanned[id] = true;
    const ev = buf(2048);
    for (let i = 0; i < 0.5 / H; i++) { ev.clear(); step(game, makeInput({}), ev); }
    assert.equal(game.zone.exitOpen, true);
    assert.equal(game.mode, want, `${off}° off Coma`);
    if (want === 'drive') assert.equal(game.zone.waypoint, 'exit');
  }
  setup();
});
