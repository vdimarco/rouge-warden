// Stream the score once; action cues and the river share a small, reusable graph.
const SOUND_KEY = 'river-rush-sound-enabled';
const MUSIC_URL = `${import.meta.env?.BASE_URL ?? '/'}audio/river-rush-adventure.mp3`;
const patterns = { land: [160, 110], goal: [523, 659, 784, 1046], perfect: [660, 988], power: [440, 660, 880], rush: [330, 660, 1046], jump: [330], duck: [260], key: [660, 880], chest: [440, 660, 880], win: [523, 659, 784, 1046], finish: [523, 659, 784, 1046], miss: [220], fall: [160, 100], recover: [330, 440], near: [740, 988], surge: [220, 330, 660], 'terrain-combo': [784, 988, 1175] };
const VOICE_LIMIT = 12;
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function readSoundPreference(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem(SOUND_KEY) !== 'false'; } catch { return true; }
}
export function saveSoundPreference(enabled, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(SOUND_KEY, String(!!enabled)); } catch {}
}

export class RiverAudio {
  constructor({ createContext, createMedia, musicUrl = MUSIC_URL } = {}) {
    // Factories also make failures and lifecycle behavior testable without audio hardware.
    this.createContext = createContext ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.createMedia = createMedia ?? (() => new Audio());
    this.musicUrl = musicUrl;
    this.ctx = null; this.music = null; this.nodes = null;
    this.enabled = false; this.active = false; this.intensity = 0; this.rush = false;
    this.musicState = 'idle'; this.voices = new Set(); this.playAttempt = 0;
    this.effectNoise = null; this.cueCounts = {}; this.lastCue = null;
    this.lastMixTime = -Infinity; this.lastMixBucket = -1; this.lastMixRush = false;
  }

  get audible() { return this.enabled && this.active; }
  get status() {
    return { enabled: this.enabled, active: this.active, contextState: this.ctx?.state ?? 'uninitialized',
      musicState: this.musicState, musicPlaying: !!(this.audible && this.music && !this.music.paused && this.ctx?.state === 'running'),
      intensity: this.intensity, rush: this.rush, musicGain: this.nodes?.musicGain.gain.value ?? 0,
      filterFrequency: this.nodes?.musicFilter.frequency.value ?? 0,
      cueCounts: { ...this.cueCounts }, lastCue: this.lastCue && { ...this.lastCue }, activeVoices: this.voices.size, voiceLimit: VOICE_LIMIT };
  }

  setEnabled(enabled) {
    if (this.enabled === !!enabled) return;
    this.enabled = !!enabled;
    if (this.audible) this.activate(); else this.silence();
  }

  start({ reset = false, intensity = 0, rush = false } = {}) {
    this.active = true; this.intensity = clamp(intensity); this.rush = !!rush;
    this.stopVoices();
    if (reset) { this.cueCounts = {}; this.lastCue = null; }
    if (reset && this.music) { try { this.music.currentTime = 0; } catch {} }
    if (this.audible) this.activate();
  }

  pause() { this.active = false; this.silence(); }

  ensureGraph() {
    if (this.ctx) return;
    let context;
    try {
      context = this.createContext();
      const master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
      const cueGain = context.createGain(); cueGain.gain.value = .8;
      const cueLimiter = context.createDynamicsCompressor();
      cueLimiter.threshold.value = -9; cueLimiter.knee.value = 6; cueLimiter.ratio.value = 8;
      cueLimiter.attack.value = .002; cueLimiter.release.value = .06;
      cueGain.connect(cueLimiter); cueLimiter.connect(master);
      const riverGain = context.createGain(); riverGain.gain.value = .075; riverGain.connect(master);
      const riverFilter = context.createBiquadFilter(); riverFilter.type = 'lowpass'; riverFilter.frequency.value = 1100; riverFilter.connect(riverGain);
      const river = context.createBufferSource(), buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; samples[i] = last * 3; }
      river.buffer = buffer; river.loop = true; river.connect(riverFilter); river.start();
      // Impacts share one short noise buffer; collection and collisions never prepare samples in the frame loop.
      const effectNoise = context.createBuffer(1, Math.ceil(context.sampleRate * .55), context.sampleRate);
      const noiseSamples = effectNoise.getChannelData(0);
      for (let i = 0; i < noiseSamples.length; i++) noiseSamples[i] = Math.random() * 2 - 1;
      const musicGain = context.createGain(); musicGain.gain.value = .4; musicGain.connect(master);
      const musicFilter = context.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 5500; musicFilter.Q.value = .55; musicFilter.connect(musicGain);
      this.ctx = context;
      this.effectNoise = effectNoise;
      this.nodes = { master, cueGain, cueLimiter, river, riverFilter, riverGain, musicFilter, musicGain };
    } catch {
      try { Promise.resolve(context?.close()).catch(() => {}); } catch {}
      this.ctx = null; this.nodes = null; this.effectNoise = null;
    }
  }

  ensureMusic() {
    if (this.music || !this.ctx) return;
    let music, source;
    try {
      music = this.createMedia(); music.preload = 'none'; music.loop = true;
      music.src = this.musicUrl;
      source = this.ctx.createMediaElementSource(music); source.connect(this.nodes.musicFilter);
      this.musicError = () => { this.musicState = 'unavailable'; this.playAttempt++; try { music.pause(); } catch {} };
      music.addEventListener('error', this.musicError);
      this.music = music; this.nodes.musicSource = source;
    } catch {
      this.musicState = 'unavailable';
      try { music?.pause(); source?.disconnect(); } catch {}
    }
  }

  activate() {
    if (!this.audible) return;
    this.ensureGraph();
    if (!this.ctx) return;
    this.nodes.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.nodes.master.gain.setValueAtTime(1, this.ctx.currentTime);
    this.applyMix(true);
    // Both calls happen synchronously inside Start/Resume/toggle's user gesture.
    const context = this.ctx;
    try { Promise.resolve(context.resume()).then(() => { if (!this.audible || this.ctx !== context) { try { Promise.resolve(context.suspend()).catch(() => {}); } catch {} } }, () => {}); } catch {}
    if (this.musicState === 'unavailable') return;
    this.ensureMusic();
    if (!this.music || !this.music.paused) return;
    const attempt = ++this.playAttempt, music = this.music;
    this.musicState = 'loading';
    try {
      Promise.resolve(music.play()).then(() => {
        if (!this.audible || this.music !== music) { try { music.pause(); } catch {} return; }
        if (attempt !== this.playAttempt) return;
        this.musicState = 'playing';
      }, error => {
        if (attempt !== this.playAttempt) return;
        this.musicState = error?.name === 'NotSupportedError' ? 'unavailable' : 'blocked';
      });
    } catch (error) { this.musicState = error?.name === 'NotSupportedError' ? 'unavailable' : 'blocked'; }
  }

  updateMix(intensity, rush = false) {
    this.intensity = clamp(intensity); this.rush = !!rush;
    if (this.audible && this.ctx) this.applyMix();
  }

  applyMix(force = false) {
    const now = this.ctx.currentTime, bucket = Math.round(this.intensity * 100);
    if (!force && this.rush === this.lastMixRush && (bucket === this.lastMixBucket || now - this.lastMixTime < .15)) return;
    this.lastMixTime = now; this.lastMixBucket = bucket; this.lastMixRush = this.rush;
    const gain = .38 + this.intensity * .12 + (this.rush ? .06 : 0);
    const frequency = 5500 + this.intensity * 9500 + (this.rush ? 2500 : 0);
    for (const [parameter, value] of [[this.nodes.musicGain.gain, gain], [this.nodes.musicFilter.frequency, frequency]]) {
      // Cancel pending targets before the next one; no automation list grows with run length.
      parameter.cancelScheduledValues(now); parameter.setTargetAtTime(value, now, .5);
    }
  }

  suspendContext() { try { Promise.resolve(this.ctx?.suspend()).catch(() => {}); } catch {} }

  silence() {
    this.playAttempt++;
    try { this.music?.pause(); } catch {}
    this.stopVoices();
    if (this.ctx && this.nodes) {
      try {
        this.nodes.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.nodes.master.gain.setValueAtTime(0, this.ctx.currentTime);
      } catch {}
      // Explicit pause/suspend clears quiet.js ownership so tab-show cannot resume a paused run.
      this.suspendContext();
    }
    if (this.musicState === 'playing' || this.musicState === 'loading') this.musicState = 'idle';
  }

  stopVoices() {
    for (const voice of this.voices) this.releaseVoice(voice, true);
  }

  releaseVoice(voice, cancel = false) {
    if (voice.released) return;
    voice.released = true; this.voices.delete(voice);
    if (voice.source) {
      voice.source.onended = null;
      if (cancel) { try { voice.source.stop(); } catch {} }
    }
    for (const node of [voice.source, voice.filter, voice.gain]) { try { node?.disconnect(); } catch {} }
  }

  tone(event, detail = {}) {
    // A hidden or suspended context must not record a cue that nobody heard.
    if (!this.ctx || !this.audible || this.ctx.state !== 'running') return false;
    const impact = event === 'hit' || event === 'lose' || event === 'smash';
    let notes;
    if (event === 'coin') {
      const streak = Math.max(0, Math.min(12, Number.isFinite(detail?.streak) ? detail.streak : 0));
      const pitch = 1175 * 2 ** (streak / 36);
      notes = [
        { frequency: pitch, volume: .15, duration: .16, attack: .003 },
        { frequency: pitch * 2.76, volume: .065, duration: .085, attack: .002 }
      ];
    } else if (event === 'stash') {
      notes = [
        { waveform: 'triangle', frequency: 784, endFrequency: 988, volume: .15, duration: .15, attack: .003 },
        { frequency: 1568, offset: .04, volume: .095, duration: .2, attack: .003 }
      ];
    } else if (event === 'treasure') {
      const clean = detail.clean === true;
      notes = [
        { waveform: 'triangle', frequency: 440, volume: .16, duration: .18, attack: .004 },
        { frequency: 659, offset: .05, volume: .14, duration: .2, attack: .004 },
        { frequency: 880, offset: .1, volume: .12, duration: .24, attack: .004 },
        ...(clean ? [{ frequency: 1319, offset: .15, volume: .12, duration: .25, attack: .004 }] : [])
      ];
    } else if (event === 'target') {
      notes = [
        { waveform: 'triangle', frequency: 659, endFrequency: 784, volume: .16, duration: .14, attack: .004 },
        { frequency: 988, offset: .045, volume: .12, duration: .2, attack: .004 },
        { frequency: 1319, offset: .095, volume: .1, duration: .26, attack: .004 }
      ];
    } else if (impact) {
      const fatal = event === 'lose', duration = fatal ? .49 : event === 'smash' ? .27 : .34;
      notes = [
        { waveform: 'triangle', frequency: 175, endFrequency: 58, volume: .28, duration: .17, attack: .004 },
        { frequency: fatal ? 82 : 98, endFrequency: 34, volume: .27, duration, attack: .006 },
        { noise: true, frequency: event === 'smash' ? 2800 : 1900, volume: .24, duration: duration * .87, attack: .007 }
      ];
    } else {
      const combo = event === 'terrain-combo';
      notes = (patterns[event] || []).map((frequency, i) => ({ frequency, offset: i * (combo ? .075 : .13), volume: .13, duration: combo ? .21 : .3, attack: combo ? .006 : .02 }));
    }
    if (!notes.length) return false;
    const priority = event === 'lose' ? 4 : impact ? 3 : event === 'terrain-combo' || event === 'target' || event === 'treasure' || event === 'stash' ? 2 : 1;
    // Repeated contacts replace quiet tails; a full coin burst cannot swallow a crash.
    while (this.voices.size + notes.length > VOICE_LIMIT) {
      let oldest;
      for (const voice of this.voices) if (voice.priority <= priority && (!oldest || voice.priority < oldest.priority)) oldest = voice;
      if (!oldest) return false;
      this.releaseVoice(oldest, true);
    }
    const created = [], now = this.ctx.currentTime;
    try {
      for (const note of notes) {
        const voice = { source: null, gain: null, filter: null, priority, event, released: false };
        created.push(voice); this.voices.add(voice);
        const source = voice.source = note.noise ? this.ctx.createBufferSource() : this.ctx.createOscillator();
        const gain = voice.gain = this.ctx.createGain(), at = now + (note.offset || 0);
        if (note.noise) {
          source.buffer = this.effectNoise;
          const filter = voice.filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass'; filter.frequency.value = note.frequency; filter.Q.value = .6;
          source.connect(filter); filter.connect(gain);
        } else {
          source.type = note.waveform || 'sine'; source.frequency.setValueAtTime(note.frequency, at);
          if (note.endFrequency) source.frequency.exponentialRampToValueAtTime(note.endFrequency, at + note.duration);
          source.connect(gain);
        }
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(note.volume, at + note.attack);
        gain.gain.exponentialRampToValueAtTime(.0001, at + note.duration);
        gain.connect(this.nodes.cueGain);
        source.onended = () => this.releaseVoice(voice);
        source.start(at); source.stop(at + note.duration + .02);
      }
    } catch {
      for (const voice of created) this.releaseVoice(voice, true);
      return false;
    }
    this.cueCounts[event] = (this.cueCounts[event] || 0) + 1;
    this.lastCue = { type: event, at: now, id: Number.isFinite(detail?.id) ? detail.id : null };
    return true;
  }

  dispose() {
    this.pause();
    try { if (this.music) { this.music.removeEventListener('error', this.musicError); this.music.removeAttribute('src'); this.music.load(); } } catch {}
    try { this.nodes?.river.stop(); } catch {}
    if (this.nodes) for (const node of Object.values(this.nodes)) { try { node.disconnect(); } catch {} }
    try { Promise.resolve(this.ctx?.close()).catch(() => {}); } catch {}
    this.ctx = null; this.nodes = null; this.music = null; this.musicError = null; this.effectNoise = null;
    this.musicState = 'idle'; this.lastMixTime = -Infinity; this.lastMixBucket = -1;
  }
}
