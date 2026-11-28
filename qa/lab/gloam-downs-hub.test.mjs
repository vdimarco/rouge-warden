// Gloam Downs: the Lamp-room as a place (openspec/changes/gloam-downs-hub, the hub builder's part), checked in Node from the baked
// hall and the page's own modules (hub.js, screens.js, cards.js, places.js, save.js), with no browser:
//   the stations: twelve, as baked (meta.stations equals hub.js STATIONS), each within 6 m of the walk from the spawn to the run door,
//     any two 3.2 m apart or more, the prompt only within 1.6 m and facing the object within 70 degrees;
//   the growth ranges: meta.grow holds each of hub.js's ids once, contiguous and inside the place; a fresh save shows only the starters'
//     objects; a buy, a kindle, a pane, an unlock, a pick and an Ember level each change exactly their own ranges;
//   the station rows: every row starts with its category word (gearMark); the blade rack and off-hand stand pick the start items; the
//     quick list's headings in design.md's order; the post's slots and its quarter cooldowns;
//   the shrine: its three tabs, and a buy there spends the glim carried first, then the bank;
//   the cards: the six layouts (sheet, side, beside), and a beside card inside the screen and never over its station;
//   the places: "The Lamp-room" by name, never a row of the Map, never the explorer's place;
//   the budget: the baked hall's splats, scenery, growth objects, download and walk file inside design.md's numbers.
// Run: node qa/lab/gloam-downs-hub.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
globalThis.addEventListener ??= () => {}; // cards.js listens for keys at load; Node has none
const H = await import('../../public/lab/gloam-downs/hub.js');
const S = await import('../../public/lab/gloam-downs/screens.js');
const C = await import('../../public/lab/gloam-downs/cards.js');
const RS = await import('../../public/lab/gloam-downs/run-save.js');
const RUN = await import('../../public/lab/gloam-downs/run.js');
const P = await import('../../public/lab/gloam-downs/places.js');
const SV = await import('../../public/lab/gloam-downs/save.js');
const { PATTERNS, STARTERS, PANES } = await import('../../public/lab/gloam-downs/growth.js');
const { BLADES, OFFHANDS } = await import('../../public/lab/gloam-downs/gear.js');

const ROOT = fileURLToPath(new URL('../../', import.meta.url)), W = ROOT + 'public/lab/gloam-downs/worlds/';
const meta = JSON.parse(fs.readFileSync(W + 'lamproom.json', 'utf8'));
let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data !== undefined ? ' ' + JSON.stringify(data) : '')); };

/* ---------------- the stations ---------------- */
{
  assert.equal(H.STATIONS.length, 12);
  assert.deepEqual(meta.stations.map(s => s.id), H.STATION_IDS, 'the baked stations are hub.js\'s, in order');
  for (const s of meta.stations) {
    const h = H.stationOf(s.id);
    assert.deepEqual([s.at[0], s.at[2]], h.at, `${s.id}: its point`);
    assert.deepEqual(s.obj, h.obj, `${s.id}: its object`);
    assert.equal(s.r, H.USE.r);
  }
  const far = H.STATIONS.map(s => [s.id, +H.toPath(s.at).toFixed(2)]);
  assert(far.every(([, d]) => d <= 6), `a station over 6 m from the path: ${JSON.stringify(far)}`);
  // the lamp shelf and the pane window stand inward now (design.md "Decision 4"): 5.5 m from the path, not 8.5 and 9.3
  assert.equal(H.toPath(H.stationOf('shelf').at), 5.5);
  assert.equal(H.toPath(H.stationOf('window').at), 5.5);
  let least = Infinity;
  for (const a of H.STATIONS) for (const b of H.STATIONS) if (a !== b) least = Math.min(least, Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]));
  assert(least >= 3.2, `two stations ${least.toFixed(2)} m apart`);
  // the prompt: at the point facing the object; not facing away; not 1.7 m off
  for (const s of H.STATIONS) {
    const yaw = Math.atan2(s.obj[0] - s.at[0], s.obj[1] - s.at[1]);
    assert.equal(H.stationNear({ x: s.at[0], z: s.at[1], yaw })?.id, s.id, `${s.id}: no prompt at its point`);
    assert.equal(H.stationNear({ x: s.at[0], z: s.at[1], yaw: yaw + Math.PI }), null, `${s.id}: a prompt facing away`);
    assert.equal(H.stationNear({ x: s.at[0], z: s.at[1], yaw: yaw + (69 * Math.PI) / 180 })?.id, s.id, `${s.id}: 69 degrees off`);
    assert.equal(H.stationNear({ x: s.at[0], z: s.at[1], yaw: yaw + (72 * Math.PI) / 180 }), null, `${s.id}: 72 degrees off`);
  }
  const k = H.stationOf('kiln'), back = { x: k.at[0] - 1.7, z: k.at[1], yaw: Math.PI / 2 };
  assert.equal(H.stationNear(back), null, 'a prompt 1.7 m off');
  assert.deepEqual([H.promptOf(k, 'keys').text, H.promptOf(k, 'pad').text, H.promptOf(k, 'touch').text], ['E Use', 'A Use', 'Use']);
  pass('twelve stations as baked; each within 6 m of the walk to the door; 3.2 m apart or more; the prompt within 1.6 m facing within 70 degrees', { far: Object.fromEntries(far), least: +least.toFixed(2) });
}

/* ---------------- the growth ranges ---------------- */
{
  const ids = H.growIds(), have = meta.grow.map(g => g.id);
  assert.deepEqual([...have].sort(), [...ids].sort(), 'meta.grow holds each growth id once');
  assert.equal(new Set(have).size, have.length);
  const ranges = meta.grow.slice().sort((a, b) => a.first - b.first);
  for (let i = 0; i < ranges.length; i++) {
    const g = ranges[i];
    assert(g.n > 0 && g.first >= 0 && g.first + g.n <= meta.count, `${g.id}: a range outside the place`);
    if (i) assert(ranges[i - 1].first + ranges[i - 1].n <= g.first, `${g.id} overlaps ${ranges[i - 1].id}`);
    assert(g.first >= meta.bones.end || g.first + g.n <= meta.bones.first, `${g.id} rides the lamplighter's bones`);
  }
  // a fresh save: the Lamp blade and the Buckler (and their glow), the shutters on slots 2 and 3, Ember's first ring; nothing else
  const rs = RS.fresh();
  const on = ids.filter(id => H.shown(rs, id));
  assert.deepEqual(on.sort(), ['blade:lamp', 'blade:lamp:start', 'ember:0', 'offhand:buckler', 'offhand:buckler:start', 'shutter:1', 'shutter:2'].sort());
  // each change shows exactly its own objects
  const plan = new Map(ids.map(id => [id, H.shown(rs, id)]));
  const change = (what, fn) => {
    fn();
    const ch = H.growChanges(rs, meta.grow, plan).map(g => `${g.id}${g.on ? '+' : '-'}`);
    for (const id of ids) plan.set(id, H.shown(rs, id));
    return ch;
  };
  rs.bank = 99999;
  assert.deepEqual(change('mantle', () => assert(RUN.buy(rs, 'mantle'))), ['ware:mantle:1+']);
  assert.deepEqual(change('mantle 2', () => assert(RUN.buy(rs, 'mantle'))), ['ware:mantle:2+']);
  assert.deepEqual(change('find', () => { rs.patterns = ['smoked', 'hook']; }), ['pattern:smoked:found+', 'pattern:hook:found+']);
  assert.deepEqual(change('kindle', () => assert(RUN.kindle(rs, 'smoked'))).sort(), ['pattern:smoked:found-', 'pattern:smoked:lit+']);
  assert.deepEqual(change('set', () => assert(RUN.setPane(rs, 0, 'smoked'))), ['pane:smoked:0+']);
  assert.deepEqual(change('panes', () => assert(RUN.buy(rs, 'panes'))).sort(), ['shutter:1-', 'ware:panes:1+']);
  assert.deepEqual(change('unlock', () => assert(RUN.buyUnlock(rs, 'rack'))), ['unlock:rack+']);
  assert.deepEqual(change('kindle a blade', () => assert(RUN.kindle(rs, 'hook'))).sort(), ['blade:hook+', 'pattern:hook:found-', 'pattern:hook:lit+'].sort());
  assert.deepEqual(change('pick', () => assert(H.chooseBlade(rs, 'hook'))).sort(), ['blade:hook:start+', 'blade:lamp:start-']);
  assert.deepEqual(change('none', () => assert(H.chooseOffhand(rs, null))), ['offhand:buckler:start-']);
  assert.deepEqual(change('ember', () => { rs.emberTop = 2; }), ['ember:1+', 'ember:2+']);
  assert.deepEqual(change('key', () => { rs.keys = ['leap']; }), ['key:leap+']);
  assert(!H.chooseBlade(rs, 'bell') && !H.chooseOffhand(rs, 'chain'), 'an item not kindled is not picked');
  pass('meta.grow holds each growth id once, in the place and off the bones; a fresh save shows only the starters; each buy, kindle, pane, unlock, pick, level and key changes its own ranges', { ranges: ids.length, splats: meta.grow.reduce((a, g) => a + g.n, 0) });
}

/* ---------------- the station rows ---------------- */
{
  const rs = RS.fresh();
  rs.bank = 500; rs.patterns = ['lash', 'cinder', 'twin', 'sling'];
  const words = [];
  const marked = (rows, word) => { for (const r of rows) { assert.equal(r.mark?.word, word, `${r.id}: ${r.mark?.word}`); words.push(word); } };
  marked(S.upgradeRows(rs), 'Ware');
  marked(S.unlockRows(rs), 'Unlock');
  marked(S.bladeRows(rs), 'Blade');
  marked(S.offhandRows(rs), 'Off-hand');
  marked(S.keyRows(rs), 'Key');
  marked(H.postRows(rs), 'Ability');
  for (const p of S.paneRows(rs)) marked(p.panes, 'Pane');
  const pats = S.patternRows(rs);
  assert.deepEqual(pats.map(r => r.mark.word), ['Ability', 'Pane', 'Blade', 'Off-hand']);
  // a colour edge on what has a colour, a corner shape by colour, and no tier pips on a fresh item
  assert.deepEqual([S.bladeRows(rs)[0].mark.shape, H.gearMark({ kind: 'offhand', id: 'buckler' }).shape, H.gearMark({ kind: 'ability', id: 'blink' }).shape], ['triangle', 'square', 'diamond']);
  assert.deepEqual([H.gearMark({ kind: 'blade', id: 'hook', tier: 'bright' }).pips, H.gearMark({ kind: 'blade', id: 'hook', tier: 'blazing' }).pips, H.gearMark({ kind: 'ability', id: 'bomb', bright: true }).pips], [1, 2, 1]);
  // the blade rack and the off-hand stand
  // every blade and off-hand shows: the kindled ones to pick, the others locked with where they come from
  assert.deepEqual(S.bladeRows(rs).map(r => [r.id, r.pick]), [['lamp', 'Start blade'], ['hook', 'Locked'], ['twin', 'Locked'], ['bell', 'Locked']]);
  assert.match(S.bladeRows(rs)[1].text, /Blade rack unlock/);
  rs.kindled = [...STARTERS, 'twin', 'sling'];
  rs.patterns = ['hook'];
  assert.deepEqual(S.bladeRows(rs).filter(r => !r.locked).map(r => r.id), ['lamp', 'twin']);
  assert.match(S.bladeRows(rs).find(r => r.id === 'hook').text, /kindle it at the kiln for 160 glim/);
  H.chooseBlade(rs, 'twin');
  assert.deepEqual(S.bladeRows(rs).map(r => r.pick), ['Pick', 'Locked', 'Start blade', 'Locked']);
  assert.deepEqual(S.offhandRows(rs).map(r => [r.id, r.start, r.locked]), [['buckler', true, false], ['sling', false, false], [null, false, false], ['cuff', false, true], ['pot', false, true], ['chain', false, true], ['shade', false, true]]);
  H.chooseOffhand(rs, null);
  assert.equal(S.offhandRows(rs).find(r => r.id === null).start, true);
  assert(S.keyRows(rs).every(r => !r.got && /first fall of The /.test(r.label)));
  // the well: the bank and the last run
  assert.match(S.wellLines(rs)[0], /^Banked: 500 glim\./);
  assert.match(S.wellLines(rs)[1], /No run yet/);
  // the quick list's headings in design.md's order
  assert.deepEqual(H.QUICK.map(q => q.label), ['Blades', 'Off-hands', 'Abilities', 'Panes', 'Patterns', 'Wares', 'Unlocks', 'Keys', 'Ember']);
  const html = fs.readFileSync(ROOT + 'public/lab/gloam-downs/index.html', 'utf8'), lamp = html.slice(html.indexOf('id="lamp"'), html.indexOf('id="winCard"'));
  const order = ['bladesT', 'offT', 'postT', 'panesT', 'patternsT', 'waresT', 'unlocksT', 'keysT', 'emberT'].map(id => lamp.indexOf(`id="${id}"`));
  assert(order.every((v, i) => v > 0 && (!i || v > order[i - 1])), `the card's headings are out of order: ${order}`);
  // each station's parts in the card: every station but the door names its part, and the quick list's parts are the stations'
  for (const q of H.QUICK) assert(new RegExp(`data-st="[^"]*\\b${q.id}\\b`).test(lamp), `no part of the card for ${q.id}`);
  // the post: any two kindled abilities, Try fills then swaps, a press again takes one out; cooldowns at a quarter
  let t = [];
  t = H.tryAbility(t, 'bomb'); t = H.tryAbility(t, 'step');
  assert.deepEqual(t, ['bomb', 'step']);
  assert.deepEqual(H.tryAbility(t, 'snare'), ['bomb', 'snare']);
  assert.deepEqual(H.tryAbility(t, 'bomb'), ['step']);
  const pr = H.practiceRun(rs, ['step']);
  assert.deepEqual(pr.abilities.map(a => a?.id), ['step', 'bomb']);
  assert(pr.practice && pr.hp > 0);
  // an 8 s cooldown that has just started counts down from 2 s; one that runs on is left alone, and an empty slot stays empty
  assert.deepEqual(H.quarterCool([480, 100, 0], [0, 101, 0]), [120, 100, 0]);
  assert.deepEqual(H.quarterCool([119], [120]), [119]);
  assert.equal(H.USE.quarter, 4);
  pass('every row starts with its category word and colour edge; the blade rack and the stand pick the start items; the quick list\'s headings in order; the post\'s slots and quarter cooldowns', { rows: words.length });
}

/* ---------------- the shrine ---------------- */
{
  assert.deepEqual(H.SHRINE_TABS.map(t => t.label), ['Wares', 'Patterns', 'Panes']);
  const rs = RS.fresh();
  rs.bank = 100;
  RUN.startRun(rs, 7, 0);
  rs.run.carried = 30;
  rs.run.offer = null;
  // Mantle 1 costs 40: the 30 carried go first, then 10 of the bank
  assert(RUN.buy(rs, 'mantle'));
  assert.deepEqual([rs.run.carried, rs.bank], [0, 90]);
  rs.run.carried = 120;
  rs.patterns = ['smoked'];
  assert(RUN.kindle(rs, 'smoked'));
  assert.deepEqual([rs.run.carried, rs.bank], [0, 90]);
  assert(!RUN.kindle(rs, 'smoked'));
  pass('the shrine has three tabs, Wares, Patterns and Panes; a buy there spends the glim carried first, then the bank');
}

/* ---------------- the cards ---------------- */
{
  const L = { '320x640': 'sheet', '390x844': 'sheet', '360x640': 'sheet', '844x390': 'side', '800x600': 'beside', '1280x720': 'beside' };
  const got = {};
  for (const [k, want] of Object.entries(L)) { const [w, h] = k.split('x').map(Number); got[k] = C.anchorLayout(w, h); assert.equal(got[k], want, k); }
  // beside: inside the screen by 16 px, under the Lab bar, never over the station's point, for points all over the screen
  for (const [w, h] of [[800, 600], [1280, 720]]) for (let x = 0; x <= w; x += 40) for (let y = 60; y <= h; y += 40) {
    const bw = 360, bh = 300, at = C.anchorAt(w, h, x, y, bw, bh);
    assert(at.left >= 16 && at.left + bw <= w - 16, `${w}x${h} (${x}, ${y}): left ${at.left}`);
    assert(at.top >= 72 && at.top + bh <= h - 16 + 1e-9 || bh > h - 88, `${w}x${h} (${x}, ${y}): top ${at.top}`);
    assert(!(x > at.left && x < at.left + bw), `${w}x${h} (${x}, ${y}): the card covers the station`);
  }
  pass('station cards: a bottom sheet at 320x640, 360x640 and 390x844, a side sheet at 844x390, beside the station at 800x600 and 1280x720, inside the screen and never over it', got);
}

/* ---------------- the places ---------------- */
{
  assert.deepEqual(SV.HUB, ['lamproom']);
  assert.equal(P.placeName('lamproom'), 'The Lamp-room');
  assert(P.isHub('lamproom') && !P.isHub('gaol'));
  const s = SV.fresh();
  assert(!P.mapGroups(s, 'gaol').flatMap(g => g.rows).some(r => r.id === 'lamproom'), 'the hall is never a row of the Map');
  assert.equal(P.startPlace('lamproom', s), 'gaol', 'the explorer never opens the hall');
  assert.equal(SV.clean({ at: 'lamproom' }).at, 'gaol');
  assert.equal(meta.name, 'The Lamp-room');
  assert.equal(meta.set, 'hub');
  assert(!meta.zones && meta.wisps.length === 0 && meta.beacon.r === 0 && meta.beacon.fire.length === 0, 'no zones, wisps or beacon fire');
  pass('"The Lamp-room" by name, set hub, no zones, wisps or beacon; never a row of the Map nor the explorer\'s place');
}

/* ---------------- the budget (design.md "Decision 3") ---------------- */
{
  const sz = f => fs.statSync(W + f).size;
  const gz = sz('lamproom.bin.gz') + sz('lamproom.walk.bin.gz') + sz('lamproom.json');
  const grow = meta.grow.reduce((a, g) => a + g.n, 0);
  assert(meta.count <= 210000, `splats ${meta.count}`);
  assert(grow <= 46000, `growth ${grow}`);
  assert(meta.count - grow - (meta.bones.end - meta.bones.first) <= 160000, 'scenery');
  assert(gz <= 0.4e6, `download ${gz}`);
  assert(sz('lamproom.walk.bin.gz') <= 4096, 'walk file');
  assert(meta.pal.length <= 48);
  pass('the budget: splats, growth objects, scenery, download and walk file', { splats: meta.count, grow, gz, walk: sz('lamproom.walk.bin.gz') });
}
void PATTERNS; void PANES; void BLADES; void OFFHANDS;
console.log(`PASS qa/lab/gloam-downs-hub.test.mjs: ${n} checks`);
