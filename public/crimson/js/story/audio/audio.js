// js/story/audio/audio.js : S.audio, the story's sound.
// - sfx(name, {at, gain, surface, ...}): a one-shot from sfx.js (3D when `at` is a world position). 'horn'
//   plays the kazoo horn once all 51 kazoos are found (E8). 'step' picks the surface under `at` if none is given.
// - loop(name, opts) -> {set(params), stop(fade)}: engine, skid, gravel, crickets, creek, fire. Every loop
//   still running stops when the story ends.
// - cue(name|null): the score (music.js). 'auto' (the start) picks by the look and the fight: boss, chase,
//   memory, night or day. Any other cue holds until cue('auto').
// - wind(region): the wind bed by region; it also follows the hero's region by itself unless wind(name) pinned it.
// The arena's sounds and its wind bed come back unchanged when the story ends.
import * as THREE from 'three';
import { defineAll, WIND } from './sfx.js';
import { createMusic } from './music.js';
import { createCinematicSound } from './cinematic.js';

export function init(S) {
  const A = S.ctx.Audio, Music = S.ctx.Music;
  let defined = false;
  const ensure = () => { if (!defined && A && A.ctx) { defineAll(A); defined = true; } return defined; };
  const music = createMusic(A, Music);
  const cinematic = createCinematicSound(S, A);
  const loops = new Set();
  const amb = { crickets: null, creek: null };
  const st = { auto: true, region: null, pinned: null, checkT: 0, windKey: '' };
  const fwd = new THREE.Vector3(), up = new THREE.Vector3();

  function kazooHorn() {
    if (S.flags && S.flags.kazooHorn) return true;
    try { const s = S.save && S.save.has && S.save.has() ? S.save.get() : null; return !!s && /^1{51}$/.test(s.kazoos || ''); } catch (e) { return false; }
  }
  function setWind(region) {
    const w = WIND[region] || WIND.arena;
    const key = region;
    if (key === st.windKey) return;
    st.windKey = key;
    if (A && A.ctx) A.setWind(w[0], w[1]);
  }
  const autoCue = () => {
    const C = S.combat;
    if (C && C.active && C.boss) return 'boss';
    if (C && C.active && C.enemies && C.enemies.some((f) => !f.downed && !f.tied)) return 'chase';
    const n = S.look ? S.look.name : 'NIGHT';
    if (n === 'MEMORY' || n === 'MEMORY_NIGHT') return 'memory';
    if (n === 'ARENA') return 'night';
    return S.look && S.look.params && S.look.params.ink > 0.5 ? 'night' : 'day';
  };

  S.audio = {
    beginCinematic: (scene) => cinematic.begin(scene),
    endCinematic: () => cinematic.end(),
    speak: (who, text) => cinematic.speak(who, text),
    stopVoice: () => cinematic.stopVoice(),
    get voice() { return cinematic.voice; },
    sfx(name, o = {}) {
      if (!ensure()) return;
      let n = name, opts = o;
      if (name === 'horn' && kazooHorn()) n = 'kazooHorn';
      if (name === 'step' && !o.surface && o.at && S.world && S.world.surfaceType) opts = { ...o, surface: S.world.surfaceType(o.at.x, o.at.z) };
      A.play(n, opts);
    },
    loop(name, o = {}) {
      ensure();
      const h = A.loop(name, o);
      if (!h.silent) { loops.add(h); const stop = h.stop; h.stop = (f) => { loops.delete(h); stop(f); }; }
      return h;
    },
    cue(name) {
      if (name === 'auto') { st.auto = true; return; }
      st.auto = false; music.cue(name);
    },
    wind(region) { st.pinned = region || null; if (region) setWind(region); },
    get music() { return music.cue; },
    get region() { return st.region; },
    get auto() { return st.auto; },
  };

  // each frame: the listener follows the camera; every half second the wind, the crickets, the creek and
  // the automatic cue follow the hero
  function update(rdt) {
    if (!A || !A.ctx) return;
    ensure();
    const cam = S.camera;
    cam.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    A.listen(cam.position, fwd, up);
    music.update(rdt);
    st.checkT -= rdt;
    if (st.checkT > 0) return;
    st.checkT = 0.5;
    const W = S.world, inStory = !!(W && W.visible), p = S.hero && S.hero.pos;
    let region = 'arena';
    if (inStory && p) region = W.colliders && W.colliders.inVolume && W.colliders.inVolume(p.x, p.y + 0.5, p.z) ? 'interior' : W.regionAt(p.x, p.z);
    st.region = region;
    if (!st.pinned) setWind(region);
    const night = S.day && S.day.night, outdoors = inStory && region !== 'interior';
    const cr = outdoors && night ? 1 : 0, ck = outdoors && region === 'canyon' ? 0.7 : 0;
    if (cr && !amb.crickets) amb.crickets = S.audio.loop('crickets', { level: 1 });
    if (amb.crickets) amb.crickets.set({ level: cr });
    if (ck && !amb.creek) amb.creek = S.audio.loop('creek', { level: ck });
    if (amb.creek) amb.creek.set({ level: ck });
    if (st.auto && S.mode !== 'credits') music.cue(S.ready || S.mode === 'play' ? autoCue() : null);
  }
  S.register('hud', (cdt, rdt, raw) => update(raw || rdt), 100);

  S.bus.on('start', () => { st.auto = true; st.pinned = null; st.windKey = ''; });
  // the story is over: every loop stops, the score rests, the arena's wind comes back
  S.bus.on('exit', () => {
    cinematic.end();
    for (const h of [...loops]) h.stop(0.2);
    loops.clear(); amb.crickets = amb.creek = null;
    music.cue(null);
    st.windKey = ''; st.pinned = null;
    if (A && A.ctx) A.setWind(WIND.arena[0], WIND.arena[1], 0.5);
  });

  S.test.audio = {
    get cinematicReady() { return cinematic.ready; }, get scoreSource() { return cinematic.scoreSource; },
    get cue() { return music.cue; }, get region() { return st.region; }, get loops() { return loops.size; },
    get defined() { return defined; }, names: () => Object.keys((A && A.defs) || {}), loopNames: () => Object.keys((A && A.loopDefs) || {}),
    get wind() { return A && A.wind ? { freq: A.wind.freq, level: A.wind.level } : null; },
  };
}

