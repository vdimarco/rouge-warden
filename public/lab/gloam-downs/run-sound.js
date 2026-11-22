// Gloam Downs: the run's sound on the page. It makes the AudioContext on the first key, click or tap in a run (never in the explorer
// or Wander), builds the mix (sound.js) and the score (music.js), lays the logged cues of each frame on the context clock, follows the
// run's scene for the score, and keeps the Sound and Music switches. Before the context exists every call is cheap and silent, and
// the scene is kept, so the score starts in the right place.
import { createMix, createSound, cueAt, CUES } from './sound.js';
import { createMusic, TIMER, keyOf, THEMES } from './music.js';

export function makeRunSound({ log, rs, phone = false, step = () => 0, ear = () => null, foe = () => null, base = './audio/', fetchFn = null, seed = 1 }) {
  const A = { ctx: null, mix: null, fx: null, music: null, heard: 0, timer: 0, scene: { kind: 'silent' }, paused: false, low: false, frame: null, failed: null };
  // the scene the score follows: arrive (the arrival card), place, boss, lamp or silent. Kept before the context exists
  A.setScene = (kind, o = {}) => {
    const was = A.scene;
    A.scene = { kind, ...o };
    if (!A.music) return;
    const M = A.music.score;
    if (kind === 'arrive') M.arrive(o.id);
    else if (kind === 'place') { if (!(was.kind === 'place' && was.id === o.id && M.state === 'place')) M.placeTheme(o.id); }
    else if (kind === 'light') { if (M.view().theme !== 'light') M.light(); }
    else if (kind === 'lamp') M.lamp(o.wait || 0);
    else if (kind === 'silent') M.silence();
    if (o.id && THEMES[o.id]) A.fx?.setKey(keyOf(o.id) - 12);
  };
  // the first press in a run: the context, the graph and the bank
  A.start = () => {
    if (A.ctx || A.failed) return !!A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.failed = 'no AudioContext'; return false; }
    try {
      A.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) { A.failed = String(e.message || e); return false; }
    const ctx = A.ctx;
    A.mix = createMix(ctx, { phone });
    A.fx = createSound(ctx, { mix: A.mix, seed });
    A.music = createMusic(ctx, { mix: A.mix, base, fetchFn, seed });
    A.music.step = step;
    A.heard = log.length;
    A.switches();
    ctx.resume?.().catch?.(() => {});
    A.music.load();
    // the score's timer: every 25 ms, never while the page is hidden
    A.timer = setInterval(() => { if (!document.hidden && ctx.state === 'running' && rs.music) A.music.score.tick(); }, TIMER * 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) A.music.score.stop(); });
    // the scene so far
    const sc = A.scene;
    A.scene = { kind: 'silent' };
    if (sc.kind === 'boss') { A.music.score.bossIntro(); if (sc.phase) A.music.score.bossPhase(sc.phase); A.scene = sc; } else A.setScene(sc.kind, sc);
    return true;
  };
  // Sound and Music: Sound off silences the effects, Music off the score, and with both off the context is suspended
  A.switches = () => {
    if (!A.ctx) return;
    A.mix.set({ fx: rs.sound, music: rs.music });
    A.music.score.setOff(!rs.music);
    if (!rs.sound && !rs.music) { if (A.ctx.state === 'running') A.ctx.suspend(); }
    else if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  };
  // a frame begins: the context time and the game step before its first step
  A.begin = () => { A.frame = A.ctx ? { t: A.ctx.currentTime + 0.005, base: step() } : null; };
  // the cues logged since the last flush, laid at the frame's time plus 1/60 s a step (capped at 0.25 s)
  A.flush = () => {
    const fr = A.frame || (A.ctx ? { t: A.ctx.currentTime + 0.005, base: step() - 1 } : null);
    A.frame = null;
    for (; A.heard < log.length; A.heard++) {
      const c = log[A.heard];
      if (!A.ctx || !rs.sound || A.paused || A.ctx.state !== 'running') continue;
      lay(c, cueAt(fr.t, fr.base, c.step));
    }
  };
  function lay(c, at) {
    const f = c.foe ? foe(c.foe) : null, o = { ...c };
    if (f) { o.pos = f.pos; o.type = f.type; }
    A.fx.setEar(ear());
    const r = A.fx.play(c.cue, at, o);
    if (r) { c.at = +r.at.toFixed(4); c.v = r.v; if (r.glim !== undefined) c.glim = r.glim; }
  }
  // a cue of the page itself (the cards): logged and played now
  A.cue = (name, more = {}) => {
    if (!CUES[name]) return;
    const c = { cue: name, step: step(), play: step(), ...more };
    log.push(c);
    if (A.ctx && rs.sound && !A.paused && A.ctx.state === 'running') { lay(c, A.ctx.currentTime + 0.005); A.heard = log.length; }
  };
  // the pause panel: the effects stop, the score goes on low-passed to 600 Hz and 8 dB down; low health takes it to 900 Hz, 3 dB down
  A.pause = on => {
    A.paused = !!on;
    if (on && A.fx) A.fx.hush();
    A.filter();
  };
  A.setLow = low => { if (A.low !== !!low) { A.low = !!low; A.filter(); } };
  A.filter = () => {
    if (!A.music) return;
    if (A.paused) A.music.setFilter(600, -8);
    else if (A.low) A.music.setFilter(900, -3);
    else A.music.setFilter(9000, 0);
  };
  A.combat = (want, guard) => { A.music?.score.setCombat(want, guard); };
  A.boss = (what, phase) => {
    if (what === 'intro') { A.scene = { kind: 'boss', phase: 0 }; A.music?.score.bossIntro(); }
    else if (what === 'phase') { A.scene = { kind: 'boss', phase }; A.music?.score.bossPhase(phase); }
    else if (what === 'fall') { A.scene = { kind: 'light', id: 'barrows' }; A.music?.score.bossFall(); }
  };
  A.sting = id => { A.music?.score.sting(id); if (id === 'death') A.scene = { kind: 'silent' }; else A.scene = { kind: 'lamp' }; };
  // __gloam.music(): the score's state, and the mix
  A.view = () => {
    const v = A.music ? A.music.view() : { state: A.scene.kind === 'arrive' ? 'silent' : 'none', place: A.scene.id ?? null, layers: [], changes: [] };
    if (A.ctx && !rs.music) v.state = 'off';
    return {
      ...v, ctx: A.ctx ? A.ctx.state : null, mix: phone ? 'phone' : 'desktop', scene: { ...A.scene },
      buses: A.mix ? { fx: A.mix.fx.gain.value, music: A.mix.music.gain.value, duck: +A.mix.duckDb().toFixed(2), hp: A.mix.hp.frequency.value } : null,
      fxVoices: A.fx ? A.fx.voices() : 0, time: A.ctx ? A.ctx.currentTime : null, failed: A.failed
    };
  };
  return A;
}
