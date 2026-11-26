// Gloam Downs: the selection screens, checked in node with no browser (openspec/changes/gloam-downs-screens-life, Part S). Each block
// is a scenario of the change's spec:
//   Title screen: a load with no run gives the title (the old cards only when asked), and the title's drift (menu-scene.js titleView);
//   Places as lamps: lit for each place reached in any run, the line of a lamp, the subtitles as baked;
//   Lamp-room shelves: a ware's tile, "Mantle 2 of 8" with its glass filled 25%;
//   Run recap: the path, each place's own time and foes, what put the lamp out (the runner's last hit), an old save, and the save's checks;
//   the grid move of the cards (cards.js gridPick with stand-in rects), and the screen cues in sound.js CUES.
// Run: node qa/lab/gloam-downs-screens.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, goTo, die, win, makeRunner, kindle } from '../../public/lab/gloam-downs/run.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { cardOnLoad, titleLamps, titleLine, seedLine, emberStep, wareTile, recapOf, summaryOf, SUBS, NAMES, byLine, pickColour, patternHue } from '../../public/lab/gloam-downs/screens.js';
import { titleView, DRIFT } from '../../public/lab/gloam-downs/menu-scene.js';
import { CUES } from '../../public/lab/gloam-downs/sound.js';
import { ORDER } from '../../public/lab/gloam-downs/save.js';

// cards.js reads the page at its load (addEventListener); a stand-in is enough for its pure parts
globalThis.addEventListener ??= () => {};
const { gridPick } = await import('../../public/lab/gloam-downs/cards.js');

let n = 0;
const pass = (name, data) => { n++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
const DEG = Math.PI / 180;

{ // Title screen: a returning player's load (a bank, no run) and a first visit both give the title; the old cards only with title false
  const rs = RS.fresh();
  assert.equal(cardOnLoad(rs), 'title');
  rs.seen = true; rs.bank = 75;
  assert.equal(cardOnLoad(rs), 'title');
  assert.equal(cardOnLoad(rs, { title: false }), 'lamp');
  assert.equal(cardOnLoad(RS.fresh(), { title: false }), 'help');
  // a run that waits for its picks, a summary and a win keep their cards
  startRun(rs, 7);
  assert.equal(cardOnLoad(rs), null);
  rs.run.offer = ['long', 'keen'];
  assert.equal(cardOnLoad(rs), 'beacon');
  die(rs);
  assert.equal(cardOnLoad(rs), 'summary');
  assert.equal(seedLine('000007', 0), 'Seed 000007 · Ember 0');
  pass('a load with no run opens the title; the beacon card, the summary and the win card do not change; "Seed 000007 · Ember 0"');
}

{ // The place drifts behind the title: after 6 s the yaw has moved by more than 1 degree and at most 9, the distance by at most 4%;
  // the base view is not changed; with reduced motion the view is the start camera's
  const base = { target: [1, 2, 3], yaw: 0.4, pitch: 0.3, dist: 9, fov: 50 };
  const v = titleView(base, 6);
  const dy = Math.abs(v.yaw - base.yaw) / DEG;
  assert(dy > 1 && dy <= 9, `yaw moved ${dy}`);
  assert.deepEqual([base.yaw, base.dist, v.pitch, v.target], [0.4, 9, 0.3, [1, 2, 3]]);
  for (let t = 0; t < 200; t += 0.7) {
    const w = titleView(base, t);
    assert(Math.abs(w.yaw - base.yaw) <= DRIFT.yaw + 1e-9 && Math.abs(w.dist / base.dist - 1) <= DRIFT.dist + 1e-9);
  }
  assert.equal(titleView(base, 6, true), base);
  pass('titleView: 6 s moves the yaw by 1 to 9 degrees; never more than 9 degrees or 4% of the distance; reduced motion keeps the start view', { dy: +dy.toFixed(2) });
}

{ // Places as lamps: none lit before any run; after runs, lit up to the furthest place reached; the line names the place and its subtitle
  const rs = RS.fresh();
  assert.deepEqual(titleLamps(rs).map(l => l.lit), [false, false, false, false, false]);
  rs.runs = 2; rs.furthest = 1;
  const lamps = titleLamps(rs);
  assert.deepEqual(lamps.map(l => [l.n, l.lit]), [['I', true], ['II', true], ['III', false], ['IV', false], ['V', false]]);
  assert.equal(lamps[1].line, 'II · The Crow Wall. A broken wall rides the downs as the storm light dies');
  assert.equal(titleLine('ramparts'), lamps[1].line);
  // the subtitles are the baked ones
  const dir = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
  for (const id of ORDER) {
    const m = JSON.parse(fs.readFileSync(`${dir}${id}.json`, 'utf8'));
    assert.deepEqual([m.name, m.sub], [NAMES[id], SUBS[id]], id);
  }
  // the Ember steps of the title's arrows: none below 0 or over the top open level
  assert.deepEqual([emberStep(rs, -1), emberStep(rs, 1)], [null, null]);
  rs.emberTop = 2; rs.ember = 1;
  assert.deepEqual([emberStep(rs, -1), emberStep(rs, 1)], [0, 2]);
  pass('the title\'s lamps: lit to the furthest place reached once a run has been played; "II · The Crow Wall" with its subtitle; the subtitles as baked');
}

{ // Lamp-room shelves: Mantle 2 bought reads "Mantle 2 of 8" and its glass is filled 25%; a full ware has no Buy
  const rs = RS.fresh();
  rs.up.mantle = 2; rs.bank = 100;
  const t = wareTile(rs, 'mantle');
  assert.deepEqual([t.level, t.fill, t.gift, t.costText, t.buy], ['Mantle 2 of 8', 0.25, '+15 health', '140 glim', '40 more glim']);
  rs.up.draught = 3;
  const top = wareTile(rs, 'draught');
  assert.deepEqual([top.level, top.fill, top.gift, top.buy, top.costText], ['Draught 3 of 3', 1, 'all bought', null, '']);
  assert.deepEqual([wareTile(RS.fresh(), 'edge').fill, wareTile(RS.fresh(), 'edge').level], [0, 'Edge 0 of 5']);
  // a pattern's tile takes its colour's hue: Rime lamp is Ward's
  assert.equal(patternHue('rime'), '#8fd6a0');
  pass('a ware\'s tile: "Mantle 2 of 8" filled 25%, "Draught 3 of 3" full with no Buy, Edge 0 a cold glass; Rime lamp in Ward\'s hue');
}

// flat ground for the runner, as gloam-downs-growth.test.mjs makes it
const FLAT = (() => { const half = 20, info = { x0: -half, z0: -half, step: 0.25, nx: half * 8 + 1, nz: half * 8 + 1 }; return makeWalk(info, new Int16Array(2 * info.nx * info.nz)); })();
const META = { wisps: [], beacon: { p: [90, 0, 90], r: 1.2 } };
function runner(rs, targets) {
  const body = makeBody(FLAT, { p: [0, 0.5, 0], yaw: Math.PI }, 20, { ...PARAMS });
  return makeRunner({ walk: FLAT, meta: META, body, rs, targets: () => targets });
}

{ // Run recap: a run passes the Gaol in 2:10 with 9 foes, and a Snuffer's hit ends it on The Crow Wall
  const rs = RS.fresh();
  startRun(rs, 7);
  rs.run.time = 130; rs.run.foes = 9;
  rs.run.kept = ['rime'];
  goTo(rs, 'ramparts');
  rs.run.time = 171; rs.run.foes = 13;
  rs.run.sparks = { flame: 2, ward: 0, gloam: 1 };
  const R = runner(rs, [{ x: 1, z: 1, type: 'S', alive: true }]);
  R.hurt(500, [1, 1]);
  assert.equal(rs.run, null, 'the hit ends the run');
  const e = rs.ended;
  assert.deepEqual(e.path, [{ id: 'gaol', time: 130, foes: 9 }, { id: 'ramparts', time: 41, foes: 4 }]);
  assert.deepEqual([e.by, e.colours, e.patternNames], ['S', { flame: 2, ward: 0, gloam: 1 }, ['rime']]);
  const r = recapOf(e);
  assert.deepEqual(r.path.slice(0, 2).map(p => [p.n, p.state, p.time, p.foes]), [['I', 'lit', '2:10', '9'], ['II', 'snuffed', '0:41', '4']]);
  assert.deepEqual(r.path.slice(2).map(p => p.state), ['dark', 'dark', 'dark']);
  assert.equal(r.by, 'Put out by a Snuffer');
  assert.deepEqual(Object.fromEntries(r.rows), { Time: '2:51', 'Foes put out': '13', Glim: 'kept 0 · lost 0', 'Patterns kept': 'Rime lamp', Sparks: 'Flame 2 · Ward 0 · Gloam 1', 'Best combo': '–' });
  // the save keeps the recap through a store and a load, and checks each field
  const box = new Map(), storage = { getItem: k => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  RS.store(storage, rs);
  assert.deepEqual(RS.load(storage).ended.path, e.path);
  const bad = RS.clean({ ended: { place: 'ramparts', path: [{ id: 'moon', time: 3 }, { id: 'gaol', time: -1, foes: 'x' }, { id: 'gaol', time: 5 }], by: '<b>', colours: { flame: 99 }, patternNames: ['rime', 'nope'] } }).ended;
  assert.deepEqual([bad.path, bad.by, bad.colours, bad.patternNames], [[{ id: 'gaol', time: 0, foes: 0 }], null, { flame: 40, ward: 0, gloam: 0 }, ['rime']]);
  pass('a death on The Crow Wall: lamp I lit with "2:10" and "9", lamp II snuffed, "Put out by a Snuffer"; the save keeps and checks the recap', r.path[0]);
}

{ // what put the lamp out: a coal is the nearest Pitchrook's, an elite by its name, the Barrow Reeve, a fall; a win is bright
  const who = (targets, from, o) => { const rs = RS.fresh(); startRun(rs, 3); const R = runner(rs, targets); R.hurt(10, from, o); return rs.run.lastHurt; };
  assert.equal(who([{ x: 30, z: 0, type: 'P', alive: true }, { x: 1, z: 0, type: 'S', alive: true }], [5, 5], { coal: true }), 'P');
  assert.equal(who([{ x: 2, z: 0, type: 'S', elite: { id: 'wardmother' }, alive: true }], [2, 0]), 'wardmother');
  assert.equal(who([{ x: 0, z: 2, type: 'B', code: 'B', alive: true }], [0, 2]), 'B');
  assert.deepEqual(['wardmother', 'B', 'fall', 'I', null].map(byLine), ['Put out by The Wardmother', 'Put out by the Barrow Reeve', 'Put out by a fall', 'Put out by an Ironback', '']);
  const rs = RS.fresh();
  startRun(rs, 5);
  for (const id of ORDER.slice(1)) { rs.run.time += 60; rs.run.foes += 5; goTo(rs, id); }
  rs.run.time += 90; rs.run.foes += 1;
  win(rs);
  const w = recapOf(rs.ended);
  assert.deepEqual(w.path.map(p => p.state), ['lit', 'lit', 'lit', 'lit', 'bright']);
  assert.deepEqual([w.title, w.by, w.path[4].time], ['The downs are lit', '', '1:30']);
  pass('the last hit: a coal, an elite, the Barrow Reeve, a fall; a win lights the five lamps, the last one bright');
}

{ // An old save still reads: an ended run with no path shows the old rows and no path
  const old = { won: false, place: 'fen', time: 100, foes: 3, kept: 30, lost: 270, banked: 30 };
  const r = recapOf(old);
  assert.deepEqual([r.old, r.path, r.rows], [true, [], summaryOf(old).rows]);
  const s = RS.clean({ ended: old }).ended;
  assert(!('path' in s) && recapOf(s).old, 'the save adds no path');
  pass('an old save\'s ended run has no path: the summary shows the old rows');
}

{ // Grid moves on lamp cards: three spark cards in a row and a button under them; right from the first goes to the second
  const rects = [{ x: 10, y: 100, w: 100, h: 110 }, { x: 120, y: 100, w: 100, h: 110 }, { x: 230, y: 100, w: 100, h: 110 }, { x: 10, y: 230, w: 320, h: 44 }];
  assert.equal(gridPick(rects, 0, 1, 0), 1);
  assert.equal(gridPick(rects, 1, 1, 0), 2);
  assert.equal(gridPick(rects, 2, 1, 0), -1, 'nothing to the right: the page falls back to the order');
  assert.equal(gridPick(rects, 1, 0, 1), 3);
  assert.equal(gridPick(rects, 3, 0, -1), 1, 'up from the wide button goes to the card above its centre');
  // the title's five lamps over Begin the run: up from Begin is the middle lamp, then left is lamp II
  const lamps = [0, 1, 2, 3, 4].map(i => ({ x: 20 + i * 70, y: 500, w: 56, h: 66 })), title = [...lamps, { x: 16, y: 640, w: 358, h: 50 }];
  assert.equal(gridPick(title, 5, 0, -1), 2);
  assert.equal(gridPick(title, 2, -1, 0), 1);
  pass('the grid move: right along a row of cards, down to the button under them, up from Begin the run to the middle lamp');
}

{ // Screen sounds: the five cues are in CUES, with hover at most once each 60 ms and tally at most 12 a roll; the pick colours
  for (const c of ['hover', 'reveal', 'pick', 'kindle', 'tally']) assert(CUES[c], c);
  assert.deepEqual([CUES.hover.every, CUES.tally.most], [0.06, 12]);
  assert.deepEqual([pickColour('wick', 'long'), pickColour('spark', 'gloam'), pickColour('ability', 'rime'), pickColour('ability', 'bomb')], ['wick', 'gloam', 'ward', 'flame']);
  pass('hover, reveal, pick, kindle and tally are cues; screen-pick\'s colours: wick, a spark\'s, an ability\'s');
}

// kindle stays as it was (the Lamp-room's own rules), and the screens read it
{ const rs = RS.fresh(); rs.bank = 200; rs.patterns = ['rime']; assert(kindle(rs, 'rime')); pass('a kindle still kindles'); }

console.log(`\n${n} checks passed`);
