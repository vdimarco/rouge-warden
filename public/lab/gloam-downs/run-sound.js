// Gloam Downs: the run's sound on the page. It makes the AudioContext on the first key, click or tap in a run (never in the explorer
// or Wander), builds the mix (sound.js) and the score (music.js), lays the logged cues of each frame on the context clock, follows the
// run's scene for the score, and keeps the Sound and Music switches. Before the context exists every call is cheap and silent, and
// the scene is kept, so the score starts in the right place. It listens to the run's events on the bus (bus.js): the place, the
// foes that see the lamplighter and the calm after, the elite, the boss's intro, health, phases and fall, the beacon, death, the win
// and the Lamp-room. The fight's strings start on the first tell or hit of a fight, read from the cue log. The place's sound bed
// (beds.js) follows the scene: it plays in a place, ducks while foes are awake, stops in the boss fight and the Lamp-room, and answers
// life.js's stirs (a gust, a flock, a lamp).
import { createMix, createSound, cueAt, CUES } from './sound.js';
import { createMusic, TIMER, keyOf, THEMES, LOOKAHEAD, PHONE_LOOKAHEAD } from './music.js';
import { on, EVENTS } from './bus.js';
import { makeBeds } from './beds.js';
import { GEAR_CUES } from './gear-play.js';

// the cues that begin a fight as a hit does: a hit given, a plunge's landing, a hit taken
const FIGHT_CUES = new Set(['hit', 'land', 'hurt']);
export function makeRunSound({ log, rs, phone = false, step = () => 0, ear = () => null, foe = () => null, base = './audio/', fetchFn = null, seed = 1 }) {
  const A = { ctx: null, mix: null, fx: null, music: null, heard: 0, timer: 0, scene: { kind: 'silent' }, paused: false, low: false, frame: null, failed: null, lead: null,
    // the fight as the score follows it (kept before the context exists), the Ember level, and the events heard
    fight: { awake: false, guard: false, strings: false, elite: false }, ember: 0, heardEvents: [] };
  // the scene the score follows: arrive (the arrival card), place, boss, lamp or silent. Kept before the context exists
  A.setScene = (kind, o = {}) => {
    const was = A.scene;
    A.scene = { kind, ...o };
    A.bedScene();
    if (!A.music) return;
    const M = A.music.score;
    if (kind === 'arrive') M.arrive(o.id);
    else if (kind === 'place') { if (!(was.kind === 'place' && was.id === o.id && M.state === 'place')) M.placeTheme(o.id); }
    else if (kind === 'light') { if (M.view().theme !== 'light') M.light(); }
    else if (kind === 'lamp') M.lamp(o.wait || 0);
    else if (kind === 'silent') M.silence();
    if (o.id && THEMES[o.id]) A.fx?.setKey(keyOf(o.id) - 12);
  };
  // the bed follows the scene: a place's own bed on arrival and in play (Barrow Crown's after the boss's fall), none in the boss
  // fight, the Lamp-room or the silence
  A.bedScene = () => {
    if (!A.beds) return;
    const sc = A.scene;
    if ((sc.kind === 'arrive' || sc.kind === 'place') && sc.id) A.beds.place(sc.id);
    else if (sc.kind === 'light') A.beds.place(sc.id || 'barrows');
    else A.beds.stop();
  };
  // the first press in a run: the context, the graph and the bank
  A.start = () => {
    if (A.ctx || A.failed) return !!A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.failed = 'no AudioContext'; return false; }
    // an iPhone mutes web audio when its side switch is on silent; a 'playback' session plays like a video does (Safari 16.4+)
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
    try {
      A.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) { A.failed = String(e.message || e); return false; }
    const ctx = A.ctx;
    A.mix = createMix(ctx, { phone });
    A.fx = createSound(ctx, { mix: A.mix, seed });
    A.music = createMusic(ctx, { mix: A.mix, base, fetchFn, seed, lookahead: phone ? PHONE_LOOKAHEAD : LOOKAHEAD });
    A.music.step = step;
    A.beds = makeBeds(ctx, A.mix, { seed });
    if (A.gone) A.beds.pause(true);
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
    A.music.score.setEmber(A.ember);
    if (sc.kind === 'boss') {
      A.music.score.bossIntro();
      if (sc.phase) { A.music.score.bossPhase(sc.phase); if (Number.isFinite(sc.share)) A.music.score.bossHealth(sc.share); }
      A.scene = sc;
    } else A.setScene(sc.kind, sc);
    A.music.score.setFight(A.fight);
    A.beds.duck(A.fight.awake);
    return true;
  };
  /* every later press: a context that a browser made suspended (a touch whose first event was no user activation, an iPhone that
     only lets touchend or click start sound) is resumed inside the press. -> a promise, or null */
  A.wake = () => {
    if (!A.ctx || A.ctx.state === 'running' || A.ctx.state === 'closed' || !(rs.sound || rs.music) || (typeof document !== 'undefined' && document.hidden)) return null;
    try { const p = A.ctx.resume(); return p && p.catch ? p.catch(() => {}) : p; } catch { return null; }
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
  A.begin = () => { A.frame = { t: A.ctx ? A.ctx.currentTime + 0.005 : 0, base: step() }; };
  // the cues logged since the last flush, laid at the frame's time plus 1/60 s a step (capped at 0.25 s)
  A.flush = () => {
    let fr = A.frame || { t: 0, base: step() - 1 };
    A.frame = null;
    if (A.ctx && !fr.t) fr = { ...fr, t: A.ctx.currentTime + 0.005 };
    for (; A.heard < log.length; A.heard++) {
      const c = log[A.heard];
      // the fight begins on its first tell (a foe's wind-up) or its first hit, given or taken: the strings come in
      if (A.fight.awake && !A.fight.strings && (CUES[c.cue]?.tell || FIGHT_CUES.has(c.cue))) A.setFight({ strings: true });
      if (!A.ctx || !rs.sound || A.paused || A.ctx.state !== 'running') continue;
      lay(c, cueAt(fr.t, fr.base, c.step));
    }
    if (A.beds && A.ctx?.state === 'running' && rs.sound) A.beds.tick();
  }
  // lay one cue. A.lead keeps how far ahead of the context's clock it was laid; with the dynamics' pre-delays and the output's
  // latency it is the effects' lag behind the picture (__gloam.music().lag)
  function lay(c, at) {
    const f = c.foe ? foe(c.foe) : null, o = { ...c };
    if (f) { o.pos = f.pos; o.type = f.type; }
    A.fx.setEar(ear());
    const r = A.fx.play(c.cue, at, o);
    // the lead is read inside play(), on the same reading of the clock as the cue's time: a read here could come a render quantum later
    if (r) A.lead = +r.lead.toFixed(4);
    if (r) { c.at = +r.at.toFixed(4); c.v = r.v; if (r.glim !== undefined) c.glim = r.glim; }
  }
  /* a cue of the page itself (the cards): logged in the same queue as the game's cues. Inside a frame the frame's flush lays it with
     them; outside one it is laid now. So a card that opens in a frame never takes the frame's other cues with it */
  A.cue = (name, more = {}) => {
    if (!CUES[name]) return;
    log.push({ cue: name, step: step(), play: step(), ...more });
    if (!A.frame) A.flush();
  };
  // the pause panel: the effects stop, the score goes on low-passed to 600 Hz and 8 dB down; low health takes it to 900 Hz, 3 dB down
  A.pause = on => {
    A.paused = !!on;
    if (on && A.fx) A.fx.hush();
    A.beds?.pause(A.paused || A.gone);
    A.filter();
  };
  /* away: the tab is hidden or the game switcher is open, and the frame loop is frozen. The bed's wind and water stop with the score,
     and come back when the player does */
  A.gone = false;
  A.away = on => {
    if (A.gone === !!on) return;
    A.gone = !!on;
    if (on) { A.fx?.hush(); A.music?.score.stop(); }
    A.beds?.pause(A.paused || A.gone);
  };
  A.setLow = low => { if (A.low !== !!low) { A.low = !!low; A.filter(); } };
  A.filter = () => {
    if (!A.music) return;
    if (A.paused) A.music.setFilter(600, -8);
    else if (A.low) A.music.setFilter(900, -3);
    else A.music.setFilter(9000, 0);
  };
  // the fight's state for the score: only the fields given change; a calm fight ends its strings and its elite too
  A.setFight = (o = {}) => {
    const F = A.fight;
    for (const k of ['awake', 'guard', 'strings', 'elite']) if (k in o) F[k] = !!o[k];
    if (!F.awake) F.guard = F.strings = F.elite = false;
    A.music?.score.setFight(F);
    A.beds?.duck(F.awake);
  };
  // the old switch (one release): foes awake, and a guard zone among them
  A.combat = (want, guard) => A.setFight(want ? { awake: true, guard: !!guard } : { awake: false });
  A.boss = (what, phase, share) => {
    if (what === 'intro') { A.scene = { kind: 'boss', phase: 0 }; A.music?.score.bossIntro(); A.beds?.stop(); }
    else if (what === 'phase') { A.scene = { kind: 'boss', phase, share: A.scene.share }; A.music?.score.bossPhase(phase); }
    else if (what === 'health') { if (A.scene.kind === 'boss') A.scene = { ...A.scene, share }; A.music?.score.bossHealth(share); }
    else if (what === 'fall') { A.scene = { kind: 'light', id: 'barrows' }; A.music?.score.bossFall(); A.bedScene(); }
  };
  A.sting = id => { A.music?.score.sting(id); if (id === 'death') A.scene = { kind: 'silent' }; else A.scene = { kind: 'lamp' }; if (id !== 'beacon') A.bedScene(); };
  // life.js's stirs: a gust swells the wind, a flock's take-off plays wings and caws at the flock, a lamp brightening stirs moths
  A.stir = (d = {}) => {
    if (!A.beds || !A.ctx || A.ctx.state !== 'running' || !rs.sound) return;
    if (d.kind === 'gust') A.beds.gust(Number.isFinite(d.k) ? d.k : 1);
    else if (d.kind === 'crows') A.beds.crows([d.x, d.z], ear());
    else if (d.kind === 'lamp') A.beds.lamp([d.x, d.z], ear());
  };
  /* the run's events on the bus. Each handler only moves the score; one that throws is caught by the bus, so the game goes on.
     relic-take and combo-tier are heard (the score may answer them later) and change nothing yet */
  const HANDLERS = {
    'place-enter': d => { if (Number.isFinite(d.ember)) { A.ember = d.ember; A.music?.score.setEmber(d.ember); } A.setFight({ awake: false }); },
    'foes-alert': d => A.setFight({ awake: true, ...(d.guard ? { guard: true } : {}), ...(d.elite ? { elite: true } : {}) }),
    'fight-calm': () => A.setFight({ awake: false }),
    'elite-alert': () => A.setFight({ awake: true, elite: true }),
    'elite-fall': () => A.setFight({ elite: false }),
    'relic-take': () => {},
    'boss-intro': () => A.boss('intro'),
    'boss-phase': d => A.boss('phase', d.phase),
    'boss-health': d => A.boss('health', null, d.share),
    'boss-fall': () => A.boss('fall'),
    'beacon-lit': () => A.sting('beacon'),
    'run-death': () => { A.setFight({ awake: false }); A.sting('death'); },
    'run-win': () => A.sting('win'),
    'lamp-room': d => A.setScene('lamp', { wait: d.wait || 0 }),
    'combo-tier': () => {},
    // growth (gloam-downs-growth design.md "Sound and music"): cues that exist, so sound.js needs no recipe. The runner logs the touch's
    // own cue (wisp) and each ability's cue with `ability: <id>`; these add the rest
    'pattern-found': () => A.cue('glim', { pattern: true }),
    'pattern-kept': () => A.cue('buy', { pattern: true }),
    // the screens play pick on a spark and kindle on a kindle (main.js), so these two stay quiet here
    'pattern-kindled': () => {},
    'key-found': () => A.cue('light', { key: true }),
    'ability-use': () => {},
    'ability-ready': d => A.cue('focus', { ready: d.slot ?? 0 }),
    'spark-take': () => {},
    'cache-open': () => A.cue('glim', { cache: true }),
    'life-stir': d => A.stir(d),
    // the gear (gloam-downs-hub design.md "Sound"): one handler a cue, each with a recipe there now; the gear's own name rides along
    'gear-cue': d => { const r = GEAR_CUES[d.cue]; if (r) A.cue(r, { gear: d.cue, ...(d.id ? { id: d.id } : {}), ...(d.tier ? { tier: d.tier } : {}) }); }
  };
  const offs = EVENTS.map(name => on(name, d => { A.heardEvents.push(name); if (A.heardEvents.length > 32) A.heardEvents.shift(); HANDLERS[name]?.(d || {}); }));
  // stop listening (a test that makes more than one run sound)
  A.off = () => { for (const f of offs) f(); };
  // __gloam.music(): the score's state, and the mix
  A.view = () => {
    const v = A.music ? A.music.view() : { state: A.scene.kind === 'arrive' ? 'silent' : 'none', place: A.scene.id ?? null, layers: [], changes: [] };
    if (A.ctx && !rs.music) v.state = 'off';
    return {
      ...v, fight: { ...A.fight }, events: A.heardEvents.slice(-8), ctx: A.ctx ? A.ctx.state : null, mix: phone ? 'phone' : 'desktop', scene: { ...A.scene },
      buses: A.mix ? { fx: A.mix.fx.gain.value, music: A.mix.music.gain.value, duck: +A.mix.duckDb().toFixed(2), hp: A.mix.hp.frequency.value } : null,
      fxVoices: A.fx ? A.fx.voices() : 0, fxLive: A.fx ? A.fx.liveNames() : [], time: A.ctx ? A.ctx.currentTime : null, failed: A.failed,
      reduction: A.mix ? A.mix.reduction() : null, beds: A.beds ? A.beds.view() : null,
      lag: A.ctx ? { lead: A.lead, pre: A.mix.delay.fx, out: A.ctx.outputLatency || 0, base: A.ctx.baseLatency || 0 } : null
    };
  };
  return A;
}
