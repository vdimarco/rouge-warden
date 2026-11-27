// Gloam Downs: the rules the checker of the hub change found broken, checked in node with no browser (openspec/changes/gloam-downs-hub,
// spec "Ticks never interrupt", "Traits", "The beacon shrine", "The hall grows", "The Buckler", "Off-hands"). Each block failed before
// its fix:
//   gear burn ticks (Smouldering, Fire pot) go through status.js tickHit: inside the 8-a-second cap, and never a hit for the combo;
//   the Barrow Reeve takes no gear burn and no tick, and a tick never wears its poise;
//   Steady adds its 6% to Whetstone's sure-cut chance (one roll a blade hit from the sure stream), with no extra blow;
//   an elite put out writes its plaque into the lasting save (rs.eliteFalls), and the hall shows it;
//   a reload keeps the sure stream's counter;
//   holding Off-hand to swap does not use the held off-hand first;
//   the Buckler does not parry in the roll's safe time; a parry staggers a light foe 0.6 s;
//   a poise break by the gear does not spend a Mark;
//   the blade rack and the off-hand stand list every item, the locked ones with where they come from;
//   the hall camera: no cutaway and no eye behind a wall on the walk from the run door to the open front, and each station's object
//   beside or over the figure with its card open, never behind it.
// Run: node qa/lab/gloam-downs-hub-rules.test.mjs
import assert from 'node:assert/strict';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, goTo } from '../../public/lab/gloam-downs/run.js';
import { makeFoes, FOE_HARD } from '../../public/lab/gloam-downs/foes.js';
import { makeAbilities } from '../../public/lab/gloam-downs/abilities.js';
import { makeBoss, REEVE } from '../../public/lab/gloam-downs/boss.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeBuild, steadyChance } from '../../public/lab/gloam-downs/build.js';
import { GEAR, wearPoise } from '../../public/lab/gloam-downs/gear-play.js';
import { tickHit, statusHit, STATES } from '../../public/lab/gloam-downs/status.js';
import { shown } from '../../public/lab/gloam-downs/hub.js';
import { bladeRows, offhandRows } from '../../public/lab/gloam-downs/screens.js';

FOE_HARD.dmg = 1; FOE_HARD.hp = 1; REEVE.hard = 1;
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
function flat(half = 20) {
  const info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }, N = info.nx * info.nz;
  return makeWalk(info, new Int16Array(2 * N));
}
const FLAT = flat();
const META = { id: 'test', wisps: [], beacon: { p: [90, 0, 90], r: 1.2 }, zones: [], spawn: { p: [0, 0, 20] } };
const ALL = ['hook', 'twin', 'bell', 'cuff', 'sling', 'pot', 'chain', 'shade'];
const item = (id, tier = 'plain', traits = []) => ({ id, tier, traits });
function setup({ blade = null, offhand, foes = [], rs = null, still = true } = {}) {
  rs ||= RS.fresh();
  rs.kindled = [...new Set([...rs.kindled, ...ALL])];
  if (!rs.run) startRun(rs, 7);
  if (blade) rs.run.blade = typeof blade === 'string' ? item(blade) : blade;
  if (offhand !== undefined) rs.run.offhand = typeof offhand === 'string' ? item(offhand) : offhand;
  rs.run.abilities = [null, null];
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: 0 }, 20, { ...PARAMS });
  const F = makeFoes({ walk: FLAT, meta: META, slots: 'SSSSPMI', seed: 3, bounds: 20 });
  const R = makeRunner({ walk: FLAT, meta: META, body, rs, targets: () => F.targets(), think: still ? null : F.think, abilities: makeAbilities, build: makeBuild });
  F.bind(R);
  const ids = foes.map(([t, x, z]) => F.spawn(t, x, z, Math.PI).id);
  return { rs, R, F, body, s: body.s, foes: ids.map(id => F.find(id)) };
}
const steps = (R, k, inp = {}) => { const all = []; for (let i = 0; i < k; i++) all.push(...R.step(typeof inp === 'function' ? inp(i) : inp, 0)); return all; };
const press = (R, key) => [...R.step({ [key]: true }, 0), ...R.step({}, 0)];

{ // a Smouldering cut on a Snuffer: its burn ticks come as status.js ticks, never as hits, and the combo counts the cut alone
  const { R, foes } = setup({ blade: item('lamp', 'bright', ['smoulder']), foes: [['S', 0, 1.4]] });
  const f = foes[0];
  f.hp = f.maxHp = 999;
  const ev = [...press(R, 'attack'), ...steps(R, 22)];
  const cuts = ev.filter(e => e.type === 'hit' && e.target === f).length;
  assert(cuts >= 1, 'the cut lands');
  const later = steps(R, 150);
  const ticks = later.filter(e => e.type === 'tick' && e.id === 'burn').length, hits = later.filter(e => e.type === 'hit').length;
  assert.equal(ticks, 2, 'two burn ticks in 2 s');
  assert.equal(hits, 0, 'no burn tick is a hit');
  assert.equal(R.build.combo.best, cuts, `the combo counts the cut alone: best ${R.build.combo.best}, cuts ${cuts}`);
  // the cap: with 8 ticks dealt this second, a burn tick deals nothing
  f.status.ticks = [[f.status.age, 8]];
  assert.equal(tickHit(f, 1, [], { id: 'burn' }), 0, 'the 8-a-second cap holds the gear burn too');
  pass('a gear burn ticks through the tick cap, and a tick is never a hit for the combo', { cuts, ticks, best: R.build.combo.best });
}
{ // the Barrow Reeve: a Smouldering hit gives it no burn, a tick deals it nothing, and nothing a tick sends wears its poise
  const rs = RS.fresh();
  rs.kindled = [...new Set([...rs.kindled, ...ALL])];
  startRun(rs, 7);
  goTo(rs, 'barrows');
  rs.run.hp = 1000;
  rs.run.blade = item('lamp', 'bright', ['smoulder']);
  const arena = { id: 'arena', c: [0, 0, 0], leash: 6.5, boss: true };
  const body = makeBody(FLAT, { p: [0, 0.5, 5], yaw: Math.PI }, 20, { ...PARAMS });
  const B = makeBoss({ walk: FLAT, arena, seed: 7, bounds: 20 });
  B.ready = true;
  const R = makeRunner({ walk: FLAT, meta: { wisps: [], beacon: { p: [90, 0, 90], r: 1 } }, body, rs, targets: () => (B.alive ? [B] : []), lightable: B.lightable, think: B.think, abilities: makeAbilities, build: makeBuild });
  B.bind(R);
  for (let i = 0; i < REEVE.intro + 2 && !B.started; i++) R.step({}, 0);
  assert(B.started, 'the fight has started');
  const hp0 = B.hp, poise0 = B.view().poise;
  // the cut's trait rides on its hit: the gear's step reads the hit
  R.gear.step({}, [{ type: 'hit', kind: 'cut1', target: B, dmg: 10 }]);
  for (let i = 0; i < 200; i++) R.gear.step({}, []);
  assert.equal(B.hp, hp0, 'no burn tick reached the Reeve');
  assert.equal(statusHit(B, 'burn', 60), null, 'the Reeve takes no burn');
  assert.equal(tickHit(B, 5, [], { id: 'swarm' }), 0, 'the Reeve takes no tick');
  assert.equal(B.hit(5, { tick: true }), false, 'a tick sent to the Reeve anyway does nothing');
  assert.deepEqual([B.hp, B.view().poise], [hp0, poise0], 'its health and poise as they were');
  pass('the Barrow Reeve takes no gear burn and no tick, and no tick wears its poise', { hp: B.hp, poise: B.view().poise });
}
{ // Steady: 6% a Steady item, added to Whetstone's chance in one roll a blade hit, with no extra blow
  const { rs, R } = setup({ blade: item('lamp', 'blazing', ['steady', 'wide']), offhand: item('sling', 'bright', ['steady']) });
  assert.equal(+steadyChance(rs.run).toFixed(3), 0.12, 'two Steady items add to 12%');
  rs.up.whet = 1;
  let sure = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (R.build.sure({ status: {} }, 'cut1')) sure++;
  const share = sure / N;
  // Whetstone 1 is 4%: 16% in all
  assert(share > 0.14 && share < 0.18, `sure cuts ${share}`);
  assert.equal(rs.run.sureRolls, N, 'one roll of the sure stream a blade hit');
  assert.equal(R.build.sure({ status: {} }, 'offhand'), false, 'an off-hand hit is never a sure cut');
  // no 'sure' blow: a Steady cut deals only its own hit
  const { R: R2, foes } = setup({ blade: item('lamp', 'blazing', ['steady', 'steady']), foes: [['S', 0, 1.4]] });
  foes[0].hp = foes[0].maxHp = 999;
  const ev = [...press(R2, 'attack'), ...steps(R2, 60)];
  assert(!ev.some(e => e.type === 'hit' && e.kind === 'sure'), 'no extra half blow');
  pass('Steady adds 6% an item to Whetstone\'s sure-cut chance in the sure stream, and deals no extra blow', { share: +share.toFixed(3) });
}
{ // an elite put out: its plaque goes into the lasting save, a reload keeps it, and the hall's trophy wall shows it
  const rs = RS.fresh();
  assert.equal(shown(rs, 'elite:wardmother'), false);
  startRun(rs, 7);
  const { R, F } = setup({ rs });
  const f = F.find(F.spawn('S', 0, 2, Math.PI).id);
  f.elite = { id: 'wardmother', name: 'The Wardmother' };
  R.elite = f;
  // the foes part reports the elite's fall on one step
  let once = true;
  R.think = ev => { if (once) { once = false; ev.push({ type: 'foeOut', foe: f.id, x: f.x, y: f.y, z: f.z }); } };
  R.step({}, 0);
  assert.deepEqual(rs.eliteFalls, ['wardmother']);
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  assert.deepEqual(back.eliteFalls, ['wardmother'], 'a reload keeps it');
  assert.equal(shown(back, 'elite:wardmother'), true, 'the plaque shows');
  assert.equal(shown(back, 'elite:rookchief'), false);
  pass('an elite put out once shows its plaque on the trophy wall, and a reload keeps it');
}
{ // a reload keeps the sure stream's counter, so the same hits are sure after it
  const { rs, R } = setup({});
  rs.up.whet = 3;
  for (let i = 0; i < 25; i++) R.build.sure({ status: {} }, 'cut1');
  const back = RS.clean(JSON.parse(JSON.stringify(rs)));
  assert.equal(back.run.sureRolls, 25);
  assert.equal(back.run.entry.sureRolls, rs.run.entry?.sureRolls ?? 0);
  pass('a reload keeps the sure stream\'s counter', { sureRolls: back.run.sureRolls });
}
{ // hold Off-hand 0.4 s on a Sling underfoot with a Buckler held: the swap, and the Buckler not raised first; a tap there uses it
  const { rs, R } = setup({ offhand: 'buckler' });
  R.gear.lay('offhand', item('sling', 'bright', ['quick']), [0, 0, 0]);
  steps(R, 2);
  steps(R, GEAR.swap + 2, { off: true });
  steps(R, 2);
  assert.equal(rs.run.offhand.id, 'sling', 'swapped');
  assert.equal(rs.run.offCool | 0, 0, 'nothing was used: no cooldown runs');
  assert(!R.log.some(c => c.cue === 'buckler'), 'the Buckler was not raised');
  // a tap on the Buckler lying there now: the Sling is used on the let-go
  steps(R, 2, { off: true });
  steps(R, 3);
  assert.equal(rs.run.offhand.id, 'sling');
  assert((rs.run.offCool | 0) > 0, 'a tap uses the held one');
  pass('holding Off-hand to swap uses nothing first; a tap on the item underfoot uses the held off-hand');
}
{ // the Buckler: a blow in the roll's safe time is not parried and readies no sure cut; a parry staggers a light foe 0.6 s
  const { R, foes } = setup({ offhand: 'buckler', foes: [['S', 0, 1.6]] });
  const f = foes[0];
  press(R, 'off');
  steps(R, 3);
  R.fighter.f.safe = 30;
  const before = R.fighter.safe();
  assert(before, 'safe time');
  R.hurt(14, [f.x, f.z]);
  assert(!R.log.some(c => c.cue === 'parry'), 'no parry in the safe time');
  assert.equal(R.gear.view().sure, false, 'no sure cut readied');
  const { R: R2, foes: f2 } = setup({ offhand: 'buckler', foes: [['S', 0, 1.6]] });
  f2[0].braced = 30;
  press(R2, 'off');
  steps(R2, 3);
  R2.hurt(14, [f2[0].x, f2[0].z]);
  assert.equal(f2[0].state, 'stagger', 'a braced light foe staggers too');
  pass('the Buckler does not parry in the safe time; a parry staggers a light foe 0.6 s, braced or not');
}
{ // a poise break from the gear (Weighted, the Bell maul, a parry) does not spend a Mark: the lamplighter's next hit bursts it
  const { foes } = setup({ foes: [['I', 0, 1.6]] });
  const f = foes[0];
  f.hp = f.maxHp = 999;
  statusHit(f, 'mark', 240);
  // a fresh Ironback: its poise starts full, and the wear breaks it
  f.alive = true;
  if (f.state === 'asleep') f.state = 'chase';
  assert.equal(wearPoise(f, 999, [0, 0]), true);
  assert.equal(f.state, 'stagger', 'the poise broke');
  assert(f.status.mark > 0, 'the Mark still stands');
  pass('a poise break by the gear staggers a fresh heavy foe and leaves a Mark for the next hit');
}
{ // the blade rack and the off-hand stand: every item, the locked ones greyed with where they come from
  const rs = RS.fresh();
  const b = bladeRows(rs), o = offhandRows(rs);
  assert.equal(b.length, 4);
  assert.equal(o.length, 7, 'six off-hands and None');
  assert.deepEqual(b.filter(r => r.locked).map(r => r.id), ['hook', 'twin', 'bell']);
  assert(b.filter(r => r.locked).every(r => /not found yet|kindle it/.test(r.text) && r.pick === 'Locked'));
  pass('the blade rack and the off-hand stand show all 4 blades and 6 off-hands, locked ones with where they come from');
}
/* ---------------- the hall camera (cameras.js makeHallCam), on the baked hall's walk map ---------------- */
{
  const fs = await import('node:fs'), zlib = await import('node:zlib');
  const { makeCamera, camLayout } = await import('../../public/lab/gloam-downs/play.js');
  const { makeHallCam, projector, HALLCAM } = await import('../../public/lab/gloam-downs/cameras.js');
  const { HALL, STATIONS } = await import('../../public/lab/gloam-downs/hub.js');
  const W = new URL('../../public/lab/gloam-downs/worlds/', import.meta.url).pathname;
  const meta = JSON.parse(fs.readFileSync(W + 'lamproom.json', 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(W + 'lamproom.walk.bin.gz')));
  const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
  const STEP = 1 / 60;
  // the page's set-up (main.js go): the follow camera with no swing, and the hall camera over it
  function hallAt(x, z, yaw, w, h, focus = () => null) {
    const body = makeBody(walk, { p: [x, walk.top(x, z) + 0.5, z], yaw }, meta.bounds, { ...PARAMS });
    const cam = makeCamera(walk, { yaw: yaw + Math.PI, auto: false, ...camLayout(w, h) });
    cam.snap(body.s, yaw + Math.PI);
    const H = makeHallCam(cam, { box: HALL, focus });
    const step = (inp = {}) => { body.step(STEP, inp, cam.c.yaw); return H.step(body.s, STEP, cam.follow(body.s, STEP, inp)); };
    return { body, cam, H, step };
  }
  const eyeOf = v => [v.target[0] + Math.sin(v.yaw) * Math.cos(v.pitch) * v.dist, v.target[1] + Math.sin(v.pitch) * v.dist, v.target[2] + Math.cos(v.yaw) * Math.cos(v.pitch) * v.dist];
  // inside the hall's walls, or out past the open front
  const inHall = e => e[2] > HALL.front || (Math.abs(e[0]) <= HALLCAM.side + 0.05 && e[2] >= HALL.back + HALLCAM.back - 0.05);
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    // from before the run door, facing the open front, walk toward it for 6 s (toward the camera: S, or the stick pulled back)
    const T = hallAt(0, -6.4, 0, w, h);
    let worst = { pitch: 0, dist: 99, cut: 0, out: 0 }, z0 = T.body.s.z;
    for (let i = 0; i < 360; i++) {
      const v = T.step({ mz: -1 }), e = eyeOf(v);
      worst = { pitch: Math.max(worst.pitch, v.pitch), dist: Math.min(worst.dist, v.dist), cut: worst.cut + (v.cut ? 1 : 0), out: worst.out + (inHall(e) ? 0 : 1) };
    }
    assert(T.body.s.z - z0 > 8, `it walked toward the front: ${z0.toFixed(1)} to ${T.body.s.z.toFixed(1)}`);
    assert.equal(worst.cut, 0, 'never a cutaway');
    assert.equal(worst.out, 0, 'the eye never stands behind a wall');
    assert(worst.pitch <= HALLCAM.hi + 1e-6 && worst.dist >= 6, `a follow view all the way: ${JSON.stringify(worst)}`);
    pass(`the hall camera at ${w}x${h}: walking from the run door to the open front, no cutaway and the eye never behind a wall`, worst);
  }
  // at each station, facing its object, with the card open: the object shows beside the figure, not behind it, inside the screen
  for (const [w, h] of [[1280, 720], [800, 600]]) {
    const out = {};
    for (const st of STATIONS.filter(s => s.id !== 'door')) {
      const yaw = Math.atan2(st.obj[0] - st.at[0], st.obj[1] - st.at[1]);
      const T = hallAt(st.at[0], st.at[1], yaw, w, h, () => ({ obj: st.obj, y: 1.3, open: true }));
      let v;
      for (let i = 0; i < 90; i++) v = T.step({});
      const pr = projector(v, w, h), s = T.body.s, o = pr([st.obj[0], s.y + 1.3, st.obj[1]]);
      const top = pr([s.x, s.y + 1.6, s.z]), feet = pr([s.x, s.y, s.z]), side = pr([s.x + Math.cos(v.yaw) * 0.4, s.y + 0.8, s.z - Math.sin(v.yaw) * 0.4]);
      const half = Math.abs(side[0] - feet[0]) + 4, inside = o && o[0] > 0 && o[0] < w && o[1] > 0 && o[1] < h;
      const covered = o && Math.abs(o[0] - feet[0]) < half && o[1] > top[1] - 4 && o[1] < feet[1] + 4;
      out[st.id] = [Math.round(o[0] - feet[0]), Math.round(o[1] - top[1])];
      assert(inside, `${st.id}: its object is on the screen at ${w}x${h}`);
      assert(!covered, `${st.id}: its object is not behind the figure at ${w}x${h} (${out[st.id]}, half ${half.toFixed(0)})`);
    }
    pass(`at ${w}x${h}, each station's object shows on the screen beside or over the figure with its card open, never behind it`, out);
  }
}
console.log(`${n} checks passed`);
