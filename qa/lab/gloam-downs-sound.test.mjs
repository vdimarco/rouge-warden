// Gloam Downs' sound and music, checked in Node with no browser (public/lab/gloam-downs/sound.js, music.js, run-save.js):
//   the cue table against every cue the game can emit (moves.js, run.js, foes.js, boss.js, fight.js, feel.js and the cards in
//     main.js), and a tell of its own for each attack;
//   the shuffle of the 4 variants, with its pitch and level moves; the cue times of a frame of many steps; the glim's rising scale;
//     a tell from behind;
//   the bar maths of every theme; the scheduler on a fake clock (notes 150 ms ahead, a late note dropped, a stall resumed on a bar
//     line); through the bus (bus.js): the drums on the next bar line after foes-alert, with the tom pickup, the strings on the bar
//     after the first tell in the cue log, both out 2 s after the calm over one bar, no flapping, the guard part, the elite's drone;
//     the boss's six levels on bar lines as its health falls and the Ember 5 line; the fall sting and the light; a listener that
//     throws; each place's six layers with a cello, the gurdies, and the bank of the four instruments made offline; the stingers;
//   the Sound and Music settings in the run's save;
//   on a fake AudioContext: the swing's voices that a roll, a hit taken, a death or a fall stop, the drop that the landing stops, the
//   whoosh that steps aside under its hit and under a tell; the run's sound laying no effect while paused, with Sound off or with the
//   context suspended, a card cue in a frame that keeps the frame's other cues, and a later press that resumes a suspended context;
//   the Barrow Reeve's ostinato, its own figure (no pedal note; no place shares its steps or its notes in any key).
// Run: node qa/lab/gloam-downs-sound.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUES, cueAt, CUE_CAP, makeVary, makeGlim, space, PENTA, createMix, createSound, db } from '../../public/lab/gloam-downs/sound.js';
import { makeRunSound } from '../../public/lab/gloam-downs/run-sound.js';
import { THEMES, STINGS, PLACES, BANK, SYNTH, gridOf, nextLine, nextBeat, onLine, lineAt, makeScore, levelOf, LOOKAHEAD, LATE } from '../../public/lab/gloam-downs/music.js';
import { emit, on as busOn, EVENTS } from '../../public/lab/gloam-downs/bus.js';
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
// a run sound whose score is a fake-clock score, with the bus wired: events go through bus.js as the page sends them
function busRun(F) {
  const log = [], rs = { sound: true, music: true };
  const A = makeRunSound({ log, rs, step: () => F.step });
  A.music = { score: F.S, view: () => F.S.view(), setFilter() {} };
  return { A, log };
}
const lineOf = (F, at) => { const v = F.S.view(); return onLine({ t0: v.t0, bar: v.bar }, at, 0.005); };
const whats = F => F.S.view().changes.map(c => c.what);
{ // drums on the bar: foes-alert 0.4 s after a bar line of the Gaol's theme brings the drums in on the next bar line, 2.21 s later
  const F = fake(), { A } = busRun(F);
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(4);
  const v0 = F.S.view(), g = { t0: v0.t0, bar: v0.bar }, k = Math.ceil((F.T - g.t0) / g.bar) + 1;
  F.run(lineAt(g, k) + 0.4 - F.T);
  const sent = F.T;
  emit('foes-alert', { zone: 'G2', guard: false, elite: false });
  F.run(0.05);
  const din = F.S.view().changes.find(c => c.what === 'drums in');
  assert(din && Math.abs(din.at - lineAt(g, k + 1)) < 0.005 && Math.abs(din.at - sent - (g.bar - 0.4)) < 0.03, `drums in ${JSON.stringify(din)} for an alert at ${sent} (bar ${g.bar})`);
  assert(F.S.view().layers.includes('drums') && !F.S.view().layers.includes('strings') && !F.S.view().layers.includes('combat'), JSON.stringify(F.S.view().layers));
  // the tom fill is the pickup on the last beat before that line
  const fill = F.notes.filter(n => n.inst === 'fill');
  assert(fill.length === 1 && Math.abs(fill[0].t - (din.at - g.bar / 4)) < 1e-6, `the pickup ${JSON.stringify(fill)}`);
  F.run(3);
  assert(F.notes.some(n => n.layer === 'drums' && n.inst === 'drum-lo'), 'the low drum plays on 1');
  A.off();
  pass('foes-alert brings the drums in on the next bar line (0.4 s after a line: 2.21 s later), with the tom pickup on the beat before', { wait: +(din.at - sent).toFixed(3) });
}
{ // the strings come in on the next bar line after the first tell or hit of the fight in the cue log, not on the wake
  const F = fake(), { A, log } = busRun(F);
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(3);
  emit('foes-alert', { zone: 'G2' });
  // a hit on a training post before the wake does not count; here the foes walk with no attack for 4 s
  F.run(4); A.flush();
  assert(F.S.view().layers.includes('drums') && !F.S.view().layers.includes('strings'), 'a wake with no attack: drums and no strings');
  log.push({ cue: 'scrape', step: F.step, play: F.step });
  const told = F.T;
  A.flush(); F.run(0.05);
  const sin = F.S.view().changes.find(c => c.what === 'strings in');
  assert(sin && lineOf(F, sin.at) && sin.at >= told && sin.at - told <= F.S.view().bar + 0.03, `strings in ${JSON.stringify(sin)} for a tell at ${told}`);
  F.run(3);
  assert(F.notes.some(n => n.layer === 'strings' && n.inst === 'cello') && F.notes.some(n => n.layer === 'strings' && n.inst === 'strings'), 'the strings with the cello');
  // the cello an octave down: the Gaol's strings start on D3 (50) and its cello on D2 (38)
  const cs = THEMES.gaol.layers.strings;
  assert.equal(cs.find(p => p.inst === 'strings').notes[0].m - cs.find(p => p.inst === 'cello').notes[0].m, 12);
  // the calm: drums and strings wait 2 s, then leave on a bar line over one bar
  emit('fight-calm');
  const calm = F.T;
  F.run(6);
  const dout = F.S.view().changes.find(c => c.what === 'drums out'), sout = F.S.view().changes.find(c => c.what === 'strings out');
  assert(dout && sout && dout.at === sout.at && lineOf(F, dout.at) && dout.at >= calm + 2 - 1e-6 && dout.at - (calm + 2) <= F.S.view().bar + 0.2, `out ${JSON.stringify([dout, sout])}, calm at ${calm}`);
  assert(Math.abs(dout.end - dout.at - F.S.view().bar) < 1e-6, 'the fade is one bar');
  assert(F.notes.filter(n => ['drums', 'strings'].includes(n.layer) && n.t > dout.end + 1e-6 && !n.stopped).length === 0, 'no fight note after its fade');
  assert.deepEqual(F.S.view().layers, ['explore']);
  // a tell after the calm brings nothing: no foe is awake
  log.push({ cue: 'scrape', step: F.step, play: F.step }); A.flush(); F.run(3);
  assert.deepEqual(F.S.view().layers, ['explore']);
  A.off();
  pass('the strings come in on the bar after the first tell, with the cello an octave down; after the calm drums and strings leave together, 2 s on, over one bar', { strings: +(sin.at - told).toFixed(3), out: +(dout.at - calm).toFixed(3) });
}
{ // no flapping: fight-calm and then foes-alert 1.5 s later keeps the drums
  const F = fake(), { A } = busRun(F);
  F.S.arrive('ramparts'); F.run(0.3); F.S.placeTheme('ramparts'); F.run(3);
  emit('foes-alert', {}); F.run(4); emit('fight-calm'); F.run(1.5); emit('foes-alert', {}); F.run(6);
  assert(!whats(F).includes('drums out'), `the drums flapped: ${whats(F)}`);
  assert(F.S.view().layers.includes('drums'));
  // a guard zone adds its part on the next bar line
  emit('foes-alert', { guard: true }); F.run(0.05);
  const gin = F.S.view().changes.find(c => c.what === 'guard in');
  assert(gin && lineOf(F, gin.at), JSON.stringify(gin));
  F.run(3);
  assert(F.S.view().layers.includes('guard') && F.notes.some(n => n.layer === 'guard'));
  A.off();
  pass('no flapping: a calm and a wake 1.5 s later keep the drums; a guard zone adds its part on the bar');
}
{ // the elite's drone: in on the next bar line after elite-alert, out on the next bar line after elite-fall (and after fight-calm)
  const F = fake(), { A } = busRun(F);
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(3);
  emit('foes-alert', { zone: 'G3' }); emit('elite-alert', { place: 'gaol', type: 'S', name: 'Wardmother' }); F.run(0.05);
  const ein = F.S.view().changes.find(c => c.what === 'elite in');
  assert(ein && lineOf(F, ein.at), JSON.stringify(ein));
  F.run(4);
  const ns = F.notes.filter(n => n.layer === 'elite');
  assert(ns.some(n => n.inst === 'gurdy' && n.m === 50) && ns.some(n => n.inst === 'gurdy' && n.m === 57), 'the gurdy on the tonic (D3) and the fifth (A3)');
  const buzz = ns.filter(n => n.inst === 'gurdy-buzz'), beat = F.S.view().bar / 4;
  assert(buzz.length >= 4 && buzz.every(n => Math.abs((n.t - F.S.view().t0) / beat - Math.round((n.t - F.S.view().t0) / beat)) < 1e-6), 'a buzz on each beat');
  emit('elite-fall', { place: 'gaol', relic: 'x' });
  const fell = F.T;
  F.run(0.05);
  const eout = F.S.view().changes.find(c => c.what === 'elite out');
  assert(eout && lineOf(F, eout.at) && eout.at - fell <= F.S.view().bar + 0.03, JSON.stringify(eout));
  assert(F.S.view().layers.includes('drums'), 'the drums stay while other foes are awake');
  // a second elite, then the calm: it leaves on the next bar line, without the 2 s wait
  emit('elite-alert', {}); F.run(3); emit('fight-calm'); const calm = F.T; F.run(0.05);
  const e2 = F.S.view().changes.filter(c => c.what === 'elite out').at(-1);
  assert(e2 && e2.at - calm <= F.S.view().bar + 0.03 && lineOf(F, e2.at), JSON.stringify(e2));
  A.off();
  pass('the elite\'s drone: the gurdy on the tonic and the fifth with a buzz on each beat, in on the bar after elite-alert, out on the bar after elite-fall or the calm', { in: ein.at, out: eout.at });
}
{ // the boss music builds: six levels on bar lines as the health falls, never back, faster from level 5; the Ember 5 line at 40%
  const F = fake(), { A } = busRun(F);
  F.S.arrive('barrows'); F.run(0.3); F.S.placeTheme('barrows'); F.run(3);
  emit('boss-intro'); F.run(3);
  // the intro: one bar of silence, then the drone
  const p0 = F.S.view(), silence = p0.changes.find(c => c.what === 'boss 0');
  assert.equal(p0.state, 'boss'); assert.equal(p0.level, 0);
  assert(Math.abs(silence.at - silence.silence - gridOf('reeve').bar) < 1e-6, 'one bar of silence before the drone');
  emit('boss-phase', { phase: 1 }); emit('boss-health', { share: 1, phase: 1 }); F.run(3);
  assert.equal(F.S.view().level, 1);
  const seen = [{ level: 1, bpm: F.S.view().bpm, phase: 1 }];
  for (const [share, phase] of [[0.85, 1], [0.61, 2], [0.44, 2], [0.26, 3], [0.11, 3]]) {
    const t = F.T;
    emit('boss-health', { share, phase });
    // the boss's own phase event follows its health in the same step
    if (phase !== seen.at(-1).phase) emit('boss-phase', { phase });
    F.run(0.05);
    const c = F.S.view().changes.filter(x => x.what.startsWith('level ')).at(-1);
    F.run(3);
    const v = F.S.view();
    assert(onLine({ t0: v.t0, bar: v.bar }, c.at, 0.005), `${c.what} at ${c.at} is not on a bar line`);
    assert(c.at - t <= 2.0 + 0.2 || !['level 3', 'level 5'].includes(c.what), `${c.what} starts ${c.at - t} s after the phase`);
    seen.push({ level: v.level, bpm: v.bpm, phase, after: +(c.at - t).toFixed(3) });
  }
  assert.deepEqual(seen.map(x => x.level), [1, 2, 3, 4, 5, 6]);
  assert(seen[4].bpm > seen[3].bpm && seen[5].bpm === seen[4].bpm, JSON.stringify(seen));
  // the layers of level 6, and a level never goes back
  assert(['top', 'p3', 'cello', 'pulse'].every(n => F.S.view().layers.includes(n)), JSON.stringify(F.S.view().layers));
  emit('boss-health', { share: 0.9, phase: 3 }); F.run(1);
  assert.equal(F.S.view().level, 6);
  // the boss phase changes still log `boss 2` and `boss 3`
  assert(whats(F).includes('boss 2') && whats(F).includes('boss 3'));
  // the lines: 85, 61.5, 45, 26.9 and 12%; at Ember 5 level 5 at 40%
  assert.deepEqual([1, 0.86, 0.85, 0.616, 0.615, 0.451, 0.45, 0.27, 0.269, 0.121, 0.12].map(s => levelOf(s)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  assert.equal(levelOf(800 / 1300), 2); assert.equal(levelOf(799 / 1300), 3); assert.equal(levelOf(350 / 1300), 4); assert.equal(levelOf(349 / 1300), 5);
  assert.equal(levelOf(0.4, 5), 5); assert.equal(levelOf(0.4, 4), 4); assert.equal(levelOf(0.41, 5), 4);
  A.off();
  pass('the boss music builds in six levels on bar lines (3 and 5 inside the stumble), faster from 5, never back; level 5 at 40% at Ember 5', seen);
}
{ // the Ember 5 line in play: place-enter carries the Ember level to the score
  const F = fake(), { A } = busRun(F);
  emit('place-enter', { id: 'barrows', index: 4, ember: 5 });
  F.S.arrive('barrows'); F.run(0.3); F.S.placeTheme('barrows'); F.run(2);
  emit('boss-intro'); F.run(3); emit('boss-phase', { phase: 1 }); F.run(3);
  emit('boss-health', { share: 0.4, phase: 2 }); F.run(3);
  assert.equal(F.S.view().level, 5);
  assert.equal(F.S.view().theme, 'reeve3');
  A.off();
  pass('at Ember 5 the boss\'s level 5 (the faster theme) starts at 40% health');
}
{ // the fall sting: at once, 2.2 s, then the light 2.5 s after the fall
  const F = fake(), { A } = busRun(F);
  F.S.arrive('barrows'); F.run(0.3); F.S.placeTheme('barrows'); F.run(2);
  emit('boss-intro'); F.run(3); emit('boss-phase', { phase: 1 }); F.run(3); emit('boss-health', { share: 0.05, phase: 3 }); emit('boss-phase', { phase: 3 }); F.run(3);
  const before = F.notes.length, t = F.T;
  emit('boss-fall');
  const sf = F.S.view().changes.find(c => c.what === 'sting fall');
  assert(sf && sf.at - t >= 0 && sf.at - t <= 0.02, `sting fall at ${sf?.at}, the fall at ${t}`);
  F.run(2.4);
  const sting = F.notes.slice(before).filter(n => n.theme === 'sting');
  assert(sting.some(n => n.inst === 'drum-lo') && sting.some(n => n.inst === 'cello') && sting.some(n => n.inst === 'choir'), 'a low drum, the cello and the choir');
  const cello = sting.filter(n => n.inst === 'cello').map(n => n.m);
  assert.equal(cello[0] - cello.at(-1), 12, 'the cello falls an octave');
  const choir = sting.filter(n => n.inst === 'choir').map(n => n.m).sort((a, b) => a - b);
  assert.equal(choir[1] - choir[0], 7, 'an open fifth in the choir');
  assert.equal(cello[0] % 12, 11, 'in B');
  assert.equal(STINGS.fall.len, 2.2);
  assert(!F.notes.slice(before).some(n => n.theme !== 'sting' && n.t > t + 0.05 && n.t < t + 2.4 && !n.stopped), 'only the sting sounds after the fall');
  F.run(1);
  const light = F.S.view().changes.find(c => c.what === 'light');
  assert(light && Math.abs(light.at - t - 2.5) <= 0.1, `light at ${light?.at}, the fall at ${t}`);
  assert.equal(F.S.view().theme, 'light');
  A.off();
  pass('the fall sting plays at once (a low drum, the cello falling an octave, an open fifth in the choir, in B), and the light 2.5 s after', { sting: +(sf.at - t).toFixed(3), light: +(light.at - t).toFixed(3) });
}
{ // the beacon, death and win events play their stingers through the bus; the Lamp-room event its theme
  const F = fake(), { A } = busRun(F);
  F.S.arrive('gaol'); F.run(0.3); F.S.placeTheme('gaol'); F.run(3);
  emit('beacon-lit', { place: 'gaol' }); F.run(1); emit('lamp-room', { wait: 0 }); F.run(3);
  assert(whats(F).includes('sting beacon') && F.S.view().state === 'lamp');
  emit('run-death'); F.run(1);
  assert(whats(F).includes('sting death'));
  emit('run-win', { ember: 0 }); F.run(1);
  assert(whats(F).includes('sting win'));
  A.off();
  pass('beacon-lit, run-death and run-win play their stingers, and lamp-room the Lamp-room theme');
}
{ // the bus: every event is known, a listener that throws does not stop the next one, and the run's sound hears every event
  const got = [];
  const err = console.error;
  console.error = () => {};
  const a = busOn('foes-alert', () => { throw new Error('a listener that throws'); }), b = busOn('foes-alert', d => got.push(d));
  emit('foes-alert', { zone: 'G1' });
  console.error = err;
  a(); b();
  assert.deepEqual(got, [{ zone: 'G1' }]);
  assert.equal(EVENTS.length, 15);
  const F = fake(), { A } = busRun(F);
  for (const e of EVENTS) emit(e, {});
  assert.deepEqual(A.view().events.length ? EVENTS.filter(e => !A.heardEvents.includes(e)) : ['none'], []);
  A.off();
  pass('the bus: a listener that throws does not stop the next one; the run\'s sound subscribes to all 15 events', { events: EVENTS.length });
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
{ // the bank: the four instruments made offline are in it, each 100 KB or less, and the whole bank 800 KB or less
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'audio/manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(man.instruments), BANK);
  let all = 0;
  const kb = {};
  for (const [inst, e] of Object.entries(man.instruments)) {
    let b = 0;
    for (const f of Object.values(e.notes)) b += fs.statSync(path.join(DIR, 'audio', f)).size;
    all += b; kb[inst] = +(b / 1024).toFixed(1);
    if (SYNTH.includes(inst)) assert(b <= 100 * 1024 && b > 0, `${inst} is ${b} bytes`);
  }
  assert(all <= 800 * 1024, `the bank is ${all} bytes`);
  const readme = fs.readFileSync(path.join(DIR, 'audio/README.md'), 'utf8');
  assert(/gloam-downs-synth\.mjs/.test(readme) && /Frank Wen/.test(readme), 'the README says how the four were made and keeps the license note');
  pass('the bank holds cello, gurdy, drum-lo and drum-mid made offline, each 100 KB or less, and is 800 KB or less', { kb, total: +(all / 1024).toFixed(0) });
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
  for (const id of PLACES) {
    assert.deepEqual(Object.keys(THEMES[id].layers), ['amb', 'explore', 'drums', 'strings', 'guard', 'elite'], `${id}'s layers`);
    for (const k of Object.keys(THEMES[id].layers)) assert(THEMES[id].layers[k].length, `${id} has no ${k} part`);
    assert(THEMES[id].layers.explore.some(p => p.inst === 'cello'), `${id}: no cello in its explore layer`);
    assert(THEMES[id].layers.drums.some(p => p.inst === 'drum-lo' && p.notes.some(n => n.bar === 0 && n.beat === 0)), `${id}: no low drum on 1`);
    assert(THEMES[id].layers.drums.some(p => p.inst === 'drum-mid'), `${id}: no frame drum`);
    assert(THEMES[id].layers.strings.some(p => p.inst === 'cello'), `${id}: no cello in its strings`);
    assert(THEMES[id].layers.elite.some(p => p.inst === 'gurdy') && THEMES[id].layers.elite.some(p => p.inst === 'gurdy-buzz'), `${id}: the elite layer`);
  }
  for (const id of ['ramparts', 'barrows']) assert(THEMES[id].layers.explore.some(p => p.inst === 'gurdy'), `${id} has no hurdy-gurdy`);
  assert(THEMES.lamp.layers.explore.some(p => p.inst === 'cello') && THEMES.lamp.layers.explore.some(p => p.inst === 'harp'), 'the Lamp-room: harp and cello');
  assert(THEMES.bells.layers.explore.some(p => p.inst === 'bell'), 'the Bell Knoll leads with bells');
  assert(THEMES.fen.layers.amb.some(p => p.inst === 'water') && THEMES.fen.layers.explore.some(p => p.inst === 'flute'), 'Lantern Fen has water and a reed');
  // every note of a sampled instrument is within the bank's reach of a sample: cello C2 to A4, gurdy D3 to D5
  for (const T of Object.values(THEMES)) for (const parts of Object.values(T.layers || {})) for (const p of parts) {
    if (p.inst === 'cello') for (const n of p.notes) assert(n.m >= 36 && n.m <= 69, `a cello note ${n.m}`);
    if (p.inst === 'gurdy') for (const n of p.notes) assert(n.m >= 50 && n.m <= 74, `a gurdy note ${n.m}`);
  }
  pass('a boss slam ducks 6 dB and a phase change 8 dB; each place has amb, explore, drums, strings, guard and elite, a cello in explore, gurdies on the Wall and the Crown, bells on the Knoll, water and a reed in the Fen');
}

/* ---------------- a fake AudioContext: the nodes keep their params' calls, and do nothing else ---------------- */
function fakeCtx() {
  const PARAMS = ['gain', 'frequency', 'Q', 'pan', 'threshold', 'ratio', 'attack', 'release', 'knee', 'detune', 'playbackRate'];
  const param = () => {
    const P = { value: 1, calls: [] };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) P[m] = (...a) => { P.calls.push([m, ...a]); return P; };
    return P;
  };
  const node = () => {
    const o = {};
    return new Proxy(o, {
      get(t, k) {
        if (k in t) return t[k];
        if (PARAMS.includes(k)) return (t[k] = param());
        if (['connect', 'disconnect', 'start', 'stop'].includes(k)) return (t[k] = () => {});
        if (k === 'reduction') return 0;
        return undefined;
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  };
  const C = { currentTime: 0, sampleRate: 8000, destination: node(), createBuffer: (ch, n, sr) => ({ length: n, sampleRate: sr, getChannelData: () => new Float32Array(n) }) };
  for (const m of ['createGain', 'createStereoPanner', 'createBiquadFilter', 'createDynamicsCompressor', 'createWaveShaper', 'createOscillator', 'createBufferSource', 'createConvolver']) C[m] = node;
  return C;
}
const fakeSound = () => { const c = fakeCtx(), mix = createMix(c), S = createSound(c, { mix, seed: 7 }); return { c, S }; };
const swingAt = (S, t, id = 'cut1') => {
  S.play('swing', t, { hit: id, wind: 6, act: 5, strike: 4 });
  S.play('strike', t + 4 / 60, { hit: id, lead: 2, act: 5 });
};
{ // the swing's voices end with the move: a roll that cuts the wind-up, a hit taken, a death and a fall stop the draw-back and the whoosh
  for (const [cue, o] of [['roll', { cut: true }], ['hurt', { dmg: 12 }], ['death', {}], ['fall', {}]]) {
    const { c, S } = fakeSound();
    swingAt(S, 0.1);
    assert.deepEqual(S.liveNames(), ['swing', 'strike']);
    c.currentTime = 0.13;
    S.play(cue, 0.14, o);
    const live = S.liveNames();
    assert(!live.includes('swing') && !live.includes('strike'), `${cue} leaves ${live}`);
  }
  // a roll that does not cut (out of the recovery) leaves a swing that has landed
  const { S } = fakeSound();
  swingAt(S, 0.1);
  S.play('roll', 0.15, {});
  assert(S.liveNames().includes('strike'), 'a plain roll stopped the whoosh');
  pass('a roll that cuts the wind-up, a hit taken, a death and a fall stop the swing\'s draw-back and whoosh; a plain roll does not');
}
{ /* the lead (how far ahead of the clock a cue is laid, __gloam.music().lag) is read inside play() on the same reading of the clock
     as the cue's time. The e2e read the clock again after play(), and a render quantum (128 samples) could pass between, so the lead
     read -0.0008 s. Here the clock moves one quantum on every read */
  const c = fakeCtx(), mix = createMix(c), S = createSound(c, { mix, seed: 7 });
  let now = 1;
  Object.defineProperty(c, 'currentTime', { get: () => (now += 128 / 48000) });
  const late = S.play('hit', 0.5, { hit: 'cut1', on: ['S'], stop: 3 }), ahead = S.play('hit', now + 0.02, { hit: 'cut1', on: ['S'], stop: 3 });
  assert(late.lead === 0, `a late cue is laid now: lead ${late.lead}`);
  assert(ahead.lead >= 0 && ahead.lead <= 0.02 + 1e-9, `a cue 20 ms ahead: lead ${ahead.lead}`);
  pass('a cue\'s lead is read on the same clock reading as its time: never below 0 when the clock moves during play()', { late: late.lead, ahead: +ahead.lead.toFixed(4) });
}
{ // the landing stops the plunge's fall; a hit taken stops it too
  for (const cue of ['land', 'hurt']) {
    const { c, S } = fakeSound();
    S.play('plunge', 0.1, { hang: 5 }); S.play('drop', 0.18, {});
    c.currentTime = 0.4;
    S.play(cue, 0.41, cue === 'land' ? { fallen: 2, on: ['S'], stop: 5 } : { dmg: 10 });
    assert(!S.liveNames().includes('drop'), `${cue} leaves the drop: ${S.liveNames()}`);
  }
  pass('the landing and a hit taken stop the drop\'s rush');
}
{ // the whoosh steps aside: 18 dB down over about 15 ms at its hit, 5 dB under a tell
  const dipOf = (S, name) => {
    const V = S.live.find(v => v.name === name), calls = V.g.gain.calls.filter(x => x[0] === 'setTargetAtTime');
    return calls.map(([, v, t, tau]) => ({ db: 20 * Math.log10(v / V.g.gain.value), t, tau }));
  };
  const { S } = fakeSound();
  swingAt(S, 0.1);
  S.play('hit', 0.2, { hit: 'cut1', on: ['S'], stop: 3 });
  const d = dipOf(S, 'strike');
  assert(d.length === 1 && Math.abs(d[0].db + 18) < 0.01 && Math.abs(d[0].t - 0.2) < 1e-9 && d[0].tau <= 0.006, JSON.stringify(d));
  const T = fakeSound();
  swingAt(T.S, 0.1);
  T.S.play('scrape', 0.16, { pos: [1, -3] });
  const e = dipOf(T.S, 'strike');
  assert(e.length === 1 && Math.abs(e[0].db + 5) < 0.01, JSON.stringify(e));
  pass('the whoosh falls 18 dB at its hit (in about 15 ms) and 5 dB under a tell', { hit: d[0], tell: e[0] });
}
{ // the run's sound: no effect is laid while paused, with Sound off or with the context suspended; a card cue in a frame keeps the
  // frame's other cues; a later press resumes a suspended context
  const make = () => {
    const log = [], rs = { sound: true, music: true }, played = [];
    let st = 100;
    const A = makeRunSound({ log, rs, step: () => st });
    A.ctx = { state: 'running', currentTime: 2, resumed: 0, resume() { this.resumed++; return Promise.resolve(); } };
    A.mix = { delay: { fx: 0.006 } };
    A.fx = { play: (n, at) => { played.push(n); return { v: 0, at, lead: 0 }; }, setEar() {}, hush() { played.push('hush'); }, voices: () => 0, liveNames: () => [] };
    return { A, log, rs, played, next: () => ++st };
  };
  const cue = (log, name, step) => log.push({ cue: name, step, play: step });
  { const { A, log, played } = make(); A.pause(true); cue(log, 'hit', 101); A.flush(); assert.deepEqual(played, ['hush']); assert.equal(log[0].at, undefined, 'a cue laid while paused'); }
  { const { A, log, rs, played } = make(); rs.sound = false; cue(log, 'hit', 101); A.flush(); assert.deepEqual(played, []); assert.equal(log[0].at, undefined, 'a cue laid with Sound off'); }
  { const { A, log, played } = make(); A.ctx.state = 'suspended'; cue(log, 'hit', 101); A.flush(); assert.deepEqual(played, []); }
  { const { A, log, played } = make(); cue(log, 'hit', 101); A.flush(); assert.deepEqual(played, ['hit']); assert(Number.isFinite(log[0].at)); }
  { // a card opens inside a frame that has logged a foe's cue: both are laid, in order
    const { A, log, played, next } = make();
    A.begin(); cue(log, 'slam', next()); A.cue('card'); assert.deepEqual(played, [], 'the card cue was laid before the frame ended');
    A.flush(); assert.deepEqual(played, ['slam', 'card']);
    // outside a frame a card cue is laid at once
    A.cue('choice'); assert.deepEqual(played, ['slam', 'card', 'choice']);
  }
  { // a later press resumes a context the browser left suspended; not a running one, nor with Sound and Music off
    const { A, rs } = make();
    A.wake(); assert.equal(A.ctx.resumed, 0);
    A.ctx.state = 'suspended'; A.wake(); assert.equal(A.ctx.resumed, 1);
    rs.sound = rs.music = false; A.wake(); assert.equal(A.ctx.resumed, 1);
  }
  pass('the run\'s sound lays nothing while paused, with Sound off or suspended; a card in a frame keeps its cues; a press resumes');
}
{ /* the Barrow Reeve's ostinato is its own figure. The first build compared only the steps between notes, so a figure with the
     same shape (a pedal on the tonic with a neighbour between: 0,0,+1,0,+3,0,+1,-2 in the Gaol, 0,0,+6,0,+1,0,-1,0 in the Reeve)
     passed. Now: no place's part of 6 notes or more has the Reeve's steps or its notes from the first note (in any key), the
     Reeve's figure has no pedal (its first note sounds at its two ends only), and its own contour climbs to the tritone */
  const ms = part => part.notes.map(n => n.m);
  const steps = m => m.slice(1).map((x, i) => x - m[i]).join(',');
  const from = m => m.map(x => x - m[0]).join(',');
  const pedal = m => m.filter((x, i) => i % 2 === 1 && i < m.length - 1 && x === m[0]).length;
  const reeve = ['low', 'high'].map(k => ms(THEMES.reeve.layers[k][0]));
  for (const m of reeve) {
    assert(m.filter(x => x === m[0]).length <= 2, `the Reeve's figure sounds its first note ${m.filter(x => x === m[0]).length} times: a pedal`);
    assert.equal(Math.max(...m) - m[0], 6, 'the Reeve\'s figure climbs to the tritone');
  }
  assert.equal(from(reeve[0]), from(reeve[1]), 'phase 2 plays the same figure a fourth up');
  let gaolPedal = 0;
  for (const id of PLACES) for (const [k, parts] of Object.entries(THEMES[id].layers)) for (const p of parts) {
    if (p.notes.length < 6) continue;
    const m = ms(p);
    if (id === 'gaol' && k === 'strings' && p.inst === 'strings') gaolPedal = pedal(m);
    for (const r of reeve) {
      assert(steps(m) !== steps(r), `${id} ${k} ${p.inst} has the Reeve's steps`);
      assert(from(m) !== from(r), `${id} ${k} ${p.inst} has the Reeve's notes in another key`);
    }
  }
  assert(gaolPedal >= 3 && pedal(reeve[0]) === 0, `the Gaol's strings are a pedal figure (${gaolPedal} of its inner off-beats on D), the Reeve's is not`);
  pass('the Barrow Reeve\'s ostinato is its own figure: no place shares its steps or its notes, and it has no pedal note', reeve.map(from));
}
console.log(`PASS qa/lab/gloam-downs-sound.test.mjs: ${passed} checks`);
