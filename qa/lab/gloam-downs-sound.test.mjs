// Gloam Downs' sound and music, checked in Node with no browser (public/lab/gloam-downs/sound.js, music.js, run-save.js):
//   the cue table against every cue the game can emit (moves.js, run.js, foes.js, boss.js, fight.js, feel.js and the cards in
//     main.js), and a tell of its own for each attack;
//   the shuffle of the 4 variants, with its pitch and level moves; the cue times of a frame of many steps; the glim's rising scale;
//     a tell from behind;
//   the bar maths of every theme; the scheduler on a fake clock (notes 150 ms ahead, a late note dropped, a stall resumed on a bar
//     line); the combat layer's enter and leave rules and no flapping; the boss's phases on bar lines; the stingers and the Lamp-room;
//   the Sound and Music settings in the run's save.
// Run: node qa/lab/gloam-downs-sound.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUES, cueAt, CUE_CAP, makeVary, makeGlim, space, PENTA } from '../../public/lab/gloam-downs/sound.js';
import { THEMES, STINGS, PLACES, gridOf, nextLine, nextBeat, onLine, lineAt, makeScore, LOOKAHEAD, LATE } from '../../public/lab/gloam-downs/music.js';
import { TYPES } from '../../public/lab/gloam-downs/foes.js';
import { ATTACKS } from '../../public/lab/gloam-downs/boss.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/lab/gloam-downs');
let passed = 0;
const pass = (name, detail) => { passed++; console.log(`ok   ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };

{ // every cue the code can emit has a recipe, and no recipe is left with no cue
  const found = new Set();
  const pats = [/cue: '(\w+)'/g, /hitCue: '(\w+)'/g, /cue\(ev, '(\w+)'/g, /cues\.push\('(\w+)'\)/g, /audio\??\.cue\('(\w+)'/g];
  for (const f of ['moves.js', 'run.js', 'foes.js', 'boss.js', 'fight.js', 'feel.js', 'main.js']) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const re of pats) for (const m of src.matchAll(re)) found.add(m[1]);
  }
  const missing = [...found].filter(c => !CUES[c]), unused = Object.keys(CUES).filter(c => !found.has(c));
  assert.deepEqual(missing, [], `cues with no recipe: ${missing}`);
  assert.deepEqual(unused, [], `recipes with no cue: ${unused}`);
  pass('every cue the game emits has a recipe, and every recipe has a cue', { cues: found.size });
}
{ // a tell of its own for each attack, the Ironback's charge is paw
  const tells = [];
  for (const T of Object.values(TYPES)) for (const [id, M] of Object.entries(T.moves)) tells.push([id, M.cue]);
  // the double sweep is two crook sweeps, each with its own crook (the spec's list of tells)
  for (const [id, A] of Object.entries(ATTACKS)) if (id !== 'dsweep') tells.push([id, A.cue]);
  assert.equal(ATTACKS.dsweep.cue, 'crook');
  const names = tells.map(t => t[1]);
  assert.equal(new Set(names).size, names.length, `two attacks share a tell: ${JSON.stringify(tells)}`);
  assert.equal(TYPES.I.moves.charge.cue, 'paw');
  for (const n of names) assert(CUES[n]?.tell, `${n} is not marked as a tell`);
  assert.deepEqual(names.sort(), ['cage', 'chime', 'crook', 'crouch', 'hum', 'paw', 'rear', 'scrape', 'whistle']);
  pass('each attack has its own tell cue, and the charge logs paw', tells);
}
{ // the shuffle: 40 hits with seed 7
  const vary = makeVary(7), out = [];
  for (let i = 0; i < 40; i++) out.push(vary('hit'));
  const count = [0, 0, 0, 0];
  out.forEach((x, i) => {
    count[x.v]++;
    if (i) assert.notEqual(x.v, out[i - 1].v, `variant ${x.v} twice in a row at ${i}`);
    assert(Math.abs(x.rate - 1) <= 0.04 + 1e-9, `pitch ${x.rate}`);
    assert(Math.abs(x.gain) <= 1.5 + 1e-9, `level ${x.gain}`);
  });
  assert(count.every(n => n >= 6), `counts ${count}`);
  const tv = makeVary(7);
  for (let i = 0; i < 40; i++) { const x = tv('scrape'); assert(Math.abs(x.rate - 1) <= 0.02 + 1e-9, `a tell moves ${x.rate}`); }
  pass('the hit shuffle never plays a variant twice in a row, each at least 6 of 40, ±4% and ±1.5 dB; tells ±2%', { count });
}
{ // the cues of a long frame
  const t0 = 10, base = 100;
  const at = [2, 5, 11].map(k => cueAt(t0, base, base + k) - t0);
  [1, 4, 10].forEach((k, i) => assert(Math.abs(at[i] - k / 60) < 0.001, `step ${k}: ${at[i]}`));
  for (let k = 1; k <= 20; k++) assert(cueAt(t0, base, base + k) - t0 <= CUE_CAP + 1e-9);
  // the same cues at 30, 60, 120 and 144 Hz: one step a frame at 120 and 144 Hz keeps the 1/60 s spacing through the frame's time
  pass('the cues of a 12-step frame at +1/60, 4/60 and 10/60 s, and none of a 20-step frame more than 0.25 s ahead', at.map(x => +x.toFixed(4)));
}
{ // the glim's scale: five 0.2 s apart, then one 1 s later
  const g = makeGlim(), steps = [0, 0.2, 0.4, 0.6, 0.8, 1.8].map(t => g(t));
  assert.deepEqual(steps, [0, 1, 2, 3, 4, 0]);
  const h = makeGlim(), top = Array.from({ length: 12 }, (_, i) => h(i * 0.1));
  assert.equal(Math.max(...top), 7);
  assert.equal(PENTA.length, 8);
  pass('glim rises one step of the scale within 0.4 s, up to 8 steps, and starts again after a gap', steps);
}
{ // a tell from behind and far away is no more than 10 dB under the same tell close by; a foe's other cue falls to −18 dB
  const ear = { x: 0, z: 0, yaw: 0 };
  const near = space([0, -2], ear, true), far = space([0, 14], ear, true), other = space([0, 40], ear, false), right = space([5, 0], ear, true);
  assert(near.gain - far.gain <= 10);
  assert.equal(other.gain, -18);
  assert(right.pan > 0.5, `a foe to the right pans right (${right.pan})`);
  pass('a tell at 14 m behind is at most 10 dB under, other cues fall to −18 dB, and the pan follows the bearing', { near, far, other, right });
}
{ // the bar maths
  for (const id of [...PLACES, 'lamp', 'reeve', 'reeve3']) {
    const g = gridOf(id);
    assert(g.bar >= 1.9 - 1e-9 && g.bar <= 3.0 + 1e-9, `${id}: a bar of ${g.bar}`);
  }
  assert(gridOf('reeve3').bar < gridOf('reeve').bar && THEMES.reeve3.bpm > THEMES.reeve.bpm);
  const g = gridOf('gaol', 1);
  assert(Math.abs(nextLine(g, 1) - 1) < 1e-9);
  assert(Math.abs(nextLine(g, 1.01) - (1 + g.bar)) < 1e-9);
  assert(Math.abs(nextBeat(g, 1 + g.beat * 1.5) - (1 + 2 * g.beat)) < 1e-9);
  assert(onLine(g, lineAt(g, 7)) && !onLine(g, lineAt(g, 7) + 0.02));
  pass('every theme has a bar of 1.9 to 3.0 s, phase 3 is faster, and the line and beat maths', Object.fromEntries([...PLACES, 'lamp', 'reeve', 'reeve3'].map(id => [id, +gridOf(id).bar.toFixed(3)])));
}
// a fake clock: lay records each note with the clock time it was laid at
function fake(lat = 0.01) {
  const F = { T: 0, notes: [], step: 0 };
  F.S = makeScore({ now: () => F.T, lat: () => lat, step: () => F.step, lay: (n, t, p, layer) => { const x = { ...n, t, laidAt: F.T, layer, theme: p.id, stopped: null }; F.notes.push(x); return { stop: at => { x.stopped = at; } }; } });
  F.run = (sec, dt = 0.025) => { const end = F.T + sec; while (F.T < end - 1e-9) { F.T = +(F.T + dt).toFixed(6); F.step += Math.round(dt * 60); F.S.tick(); } };
  return F;
}
{ // the scheduler: notes 150 ms ahead plus the latency, never late; a stall resumes on a bar line
  const F = fake();
  F.S.arrive('gaol');
  F.run(0.5);
  F.S.placeTheme('gaol');
  F.run(6);
  assert(F.notes.length > 10, `${F.notes.length} notes`);
  for (const n of F.notes) {
    assert(n.t >= n.laidAt - LATE - 1e-9, `a note laid late: ${n.t} at ${n.laidAt}`);
    assert(n.t <= n.laidAt + LOOKAHEAD + 0.01 + 0.06, `a note laid too far ahead: ${n.t} at ${n.laidAt}`);
  }
  // the timer stops for 1.5 s
  const before = F.notes.length;
  F.T += 1.5;
  F.S.tick();
  F.run(3);
  const after = F.notes.slice(before).filter(n => !n.stopped);
  const p = F.S.view(), g = { t0: p.t0, bar: p.bar };
  assert(after.length, 'notes after the stall');
  for (const n of after) assert(n.t >= n.laidAt - LATE - 1e-9, `a note laid late after the stall: ${n.t} at ${n.laidAt}`);
  const first = Math.min(...after.map(n => n.t));
  assert(onLine(g, first), `the first note after the stall at ${first} is not on a bar line (t0 ${g.t0}, bar ${g.bar})`);
  assert.equal(F.S.dropped, 0);
  // a note asked for in the past is dropped, never played late
  const late = fake();
  late.S.arrive('gaol'); late.run(0.2); late.S.placeTheme('gaol'); late.run(0.2);
  late.S.laid -= 1; late.S.tick();
  assert(late.S.dropped > 0 && late.notes.every(n => n.t >= n.laidAt - LATE - 1e-9));
  pass('the scheduler lays notes 150 ms ahead, drops late ones, and resumes on a bar line after a stall', { notes: F.notes.length, first: +first.toFixed(3), dropped: late.S.dropped });
}
{ // the combat layer: in on a beat within one beat of the wake, full on the next bar line, out on the first bar line 2 s or more after
  const F = fake();
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(5);
  const wake = F.T;
  F.S.setCombat(true); F.run(0.05);
  const v = F.S.view(), g = { t0: v.t0, bar: v.bar, beat: v.bar / 4 };
  const cin = v.changes.find(c => c.what === 'combat in'), full = v.changes.find(c => c.what === 'combat full');
  assert(cin && full, JSON.stringify(v.changes));
  assert(cin.at >= wake - 1e-9 && cin.at - wake <= g.beat + 1e-6, `combat in at ${cin.at}, wake ${wake}`);
  assert(Math.abs(((cin.at - g.t0) / g.beat) - Math.round((cin.at - g.t0) / g.beat)) < 1e-6, 'combat in on a beat');
  assert(onLine(g, full.at), 'combat full on a bar line');
  F.run(4);
  const quiet = F.T;
  F.S.setCombat(false); F.run(6);
  const out = F.S.view().changes.find(c => c.what === 'combat out');
  assert(out && onLine(g, out.at) && out.at >= quiet + 2 - 1e-6 && out.at - (quiet + 2) <= g.bar + 0.2, `combat out ${JSON.stringify(out)}, quiet ${quiet}`);
  assert(F.notes.filter(n => n.layer === 'combat' && n.t > out.end + 1e-6 && !n.stopped).length === 0, 'no combat note after its fade');
  // no flapping: a zone wakes, empties, and another wakes 1.5 s later
  const G = fake();
  G.S.arrive('ramparts'); G.run(0.3); G.S.placeTheme('ramparts'); G.run(3);
  G.S.setCombat(true); G.run(4); G.S.setCombat(false); G.run(1.5); G.S.setCombat(true); G.run(6);
  assert(!G.S.view().changes.some(c => c.what === 'combat out'), 'the combat layer flapped');
  // a guard zone adds its third percussion part
  const H = fake();
  H.S.arrive('gaol'); H.run(0.3); H.S.placeTheme('gaol'); H.run(2); H.S.setCombat(true, true); H.run(6);
  assert(H.S.view().layers.includes('guard') && H.notes.some(n => n.layer === 'guard'));
  pass('combat in on the beat, full on the bar, out on the bar 2 s after, no flapping, and the guard part', { in: +(cin.at - wake).toFixed(3), out: +(out.at - quiet).toFixed(3) });
}
{ // the boss: the intro's silence, phases on bar lines, phase 3 faster, the fall's 2.5 s of silence
  const F = fake();
  F.S.arrive('barrows'); F.run(0.3); F.S.placeTheme('barrows'); F.run(3);
  F.S.bossIntro(); F.run(3);
  const p0 = F.S.view();
  assert.equal(p0.state, 'boss'); assert.equal(p0.phase, 0);
  const silence = p0.changes.find(c => c.what === 'boss 0');
  assert(Math.abs(silence.at - silence.silence - gridOf('reeve').bar) < 1e-6, 'one bar of silence before the drone');
  const bpm = [];
  for (const ph of [1, 2, 3]) {
    F.S.bossPhase(ph);
    const v = F.S.view(), c = v.changes.at(-1);
    F.run(3);
    const g = { t0: F.S.view().t0, bar: F.S.view().bar };
    assert.equal(c.what, `boss ${ph}`);
    assert(onLine(g, c.at), `phase ${ph} at ${c.at} is not on a bar line`);
    // phase 1 starts with the boss bar, on the drone's next bar line; phases 2 and 3 start inside the 2.0 s stumble
    if (ph >= 2) assert(c.at - F.T + 3 <= 2.0 + 1e-6, `phase ${ph} starts ${c.at - (F.T - 3)} s after the phase change`);
    bpm.push(F.S.view().bpm);
  }
  assert(bpm[2] > bpm[1]);
  F.S.bossFall();
  const t = F.T;
  F.run(2.4);
  assert.equal(F.S.view().state, 'silent');
  assert(!F.notes.some(n => n.t > t + 0.05 && n.t < t + 2.4 && !n.stopped), 'a note in the silence after the fall');
  F.run(1);
  assert.equal(F.S.view().theme, 'light');
  pass('the boss: a bar of silence, phases on bar lines within the stumble, phase 3 faster, 2.5 s of silence after the fall', { bpm });
}
{ // the stingers: beacon then the Lamp-room, death then silence and the Lamp-room 2 s or more later
  const F = fake();
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(3);
  F.S.sting('beacon'); F.run(1); F.S.lamp(); F.run(3);
  let w = F.S.changes.map(c => c.what);
  assert(w.indexOf('lamp') > w.indexOf('sting beacon'), w.join(', '));
  F.S.arrive('ramparts'); F.run(0.3); F.S.placeTheme('ramparts'); F.run(3);
  F.S.sting('death'); F.run(1.2); F.S.lamp(2); F.run(6);
  const ch = F.S.changes, d = ch.findIndex(c => c.what === 'sting death'), s = ch.findIndex((c, i) => i > d && c.what === 'silent'), l = ch.findIndex((c, i) => i > s && c.what === 'lamp');
  assert(d >= 0 && s > d && l > s && ch[l].at - ch[s].at >= 2 - 1e-6, ch.map(c => `${c.what}@${c.at.toFixed(2)}`).join(', '));
  F.S.sting('win'); F.run(7);
  w = F.S.changes.map(c => c.what);
  assert(w.lastIndexOf('lamp') > w.lastIndexOf('sting win'));
  // the win holds the score's first major chord
  const win = STINGS.win.notes.filter(n => n[0] === 'choir').map(n => n[2]);
  assert(win.includes(4) && win.includes(7));
  pass('stingers: beacon then the Lamp-room; death, silence, the Lamp-room 2 s later; the win and its major chord');
}
{ // Music off: no notes laid; on again: resumes on a bar line
  const F = fake();
  F.S.arrive('fen'); F.run(0.3); F.S.placeTheme('fen'); F.run(2);
  F.S.setOff(true);
  const n0 = F.notes.length;
  F.run(2);
  assert.equal(F.notes.length, n0);
  assert.equal(F.S.view().state, 'off');
  F.S.setOff(false); F.run(3);
  const g = { t0: F.S.view().t0, bar: F.S.view().bar }, first = Math.min(...F.notes.slice(n0).map(n => n.t));
  assert(onLine(g, first));
  pass('Music off lays no notes, and Music on goes on at a bar line');
}
{ // the switches in the run's save
  const s = RS.fresh();
  assert.equal(s.sound, true); assert.equal(s.music, true);
  const back = RS.clean(JSON.parse(JSON.stringify({ ...s, sound: false, music: false })));
  assert.equal(back.sound, false); assert.equal(back.music, false);
  const bad = RS.clean({ ...s, music: 'loud', sound: 3 });
  assert.equal(bad.music, true); assert.equal(bad.sound, true);
  const old = RS.clean({ ...s, music: undefined });
  assert.equal(old.music, true);
  const mem = new Map(), store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  RS.store(store, { ...s, music: false });
  assert.equal(RS.load(store).music, false);
  pass('Sound and Music are kept in the run\'s save, a bad or missing value reads on, and a store and load keep Music off');
}
{ // the duck depths and the themes' layers
  assert.equal(CUES.slam.duck[0], 6); assert.equal(CUES.stumble.duck[0], 8);
  for (const id of PLACES) for (const k of ['amb', 'explore', 'combat', 'guard']) assert(THEMES[id].layers[k]?.length, `${id} has no ${k} layer`);
  assert(THEMES.bells.layers.explore.some(p => p.inst === 'bell'), 'the Bell Knoll leads with bells');
  assert(THEMES.fen.layers.amb.some(p => p.inst === 'water') && THEMES.fen.layers.explore.some(p => p.inst === 'flute'), 'Lantern Fen has water and a reed');
  pass('a boss slam ducks 6 dB and a phase change 8 dB; each place has its four layers, bells on the Knoll, water and a reed in the Fen');
}
console.log(`PASS qa/lab/gloam-downs-sound.test.mjs: ${passed} checks`);
