// Stream the score once; action cues and the river share a small, reusable graph.
const SOUND_KEY = 'river-rush-sound-enabled';
const MUSIC_URL = `${import.meta.env?.BASE_URL ?? '/'}audio/river-rush-adventure.mp3`;
const patterns = { coin: [880], land: [160, 110], goal: [523, 659, 784, 1046], perfect: [660, 988], power: [440, 660, 880], rush: [330, 660, 1046], smash: [220, 440], jump: [330], duck: [260], key: [660, 880], chest: [440, 660, 880], win: [523, 659, 784, 1046], finish: [523, 659, 784, 1046], hit: [130], miss: [220], fall: [160, 100], lose: [260, 190, 130], recover: [330, 440], near: [740, 988], surge: [220, 330, 660] };
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
    this.lastMixTime = -Infinity; this.lastMixBucket = -1; this.lastMixRush = false;
  }

  get audible() { return this.enabled && this.active; }
  get status() {
    return { enabled: this.enabled, active: this.active, contextState: this.ctx?.state ?? 'uninitialized',
      musicState: this.musicState, musicPlaying: !!(this.audible && this.music && !this.music.paused && this.ctx?.state === 'running'),
      intensity: this.intensity, rush: this.rush, musicGain: this.nodes?.musicGain.gain.value ?? 0,
      filterFrequency: this.nodes?.musicFilter.frequency.value ?? 0 };
  }

  setEnabled(enabled) {
    if (this.enabled === !!enabled) return;
    this.enabled = !!enabled;
    if (this.audible) this.activate(); else this.silence();
  }

  start({ reset = false, intensity = 0, rush = false } = {}) {
    this.active = true; this.intensity = clamp(intensity); this.rush = !!rush;
    this.stopVoices();
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
      const riverGain = context.createGain(); riverGain.gain.value = .075; riverGain.connect(master);
      const riverFilter = context.createBiquadFilter(); riverFilter.type = 'lowpass'; riverFilter.frequency.value = 1100; riverFilter.connect(riverGain);
      const river = context.createBufferSource(), buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const samples = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; samples[i] = last * 3; }
      river.buffer = buffer; river.loop = true; river.connect(riverFilter); river.start();
      const musicGain = context.createGain(); musicGain.gain.value = .4; musicGain.connect(master);
      const musicFilter = context.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 5500; musicFilter.Q.value = .55; musicFilter.connect(musicGain);
      this.ctx = context;
      this.nodes = { master, river, riverFilter, riverGain, musicFilter, musicGain };
    } catch {
      try { Promise.resolve(context?.close()).catch(() => {}); } catch {}
      this.ctx = null; this.nodes = null;
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
    for (const voice of this.voices) { try { voice.osc.stop(); } catch {} try { voice.osc.disconnect(); voice.gain.disconnect(); } catch {} }
    this.voices.clear();
  }

  tone(event) {
    if (!this.ctx || !this.audible) return;
    for (const [i, freq] of (patterns[event] || []).entries()) {
      // Bound even repeated coin bursts; finished voices release their graph nodes.
      if (this.voices.size >= 12) break;
      const at = this.ctx.currentTime + i * .13;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), voice = { osc, gain };
      this.voices.add(voice); osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.13, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + .3);
      osc.connect(gain); gain.connect(this.nodes.master);
      osc.onended = () => { this.voices.delete(voice); osc.disconnect(); gain.disconnect(); };
      osc.start(at); osc.stop(at + .31);
    }
  }

  dispose() {
    this.pause();
    try { if (this.music) { this.music.removeEventListener('error', this.musicError); this.music.removeAttribute('src'); this.music.load(); } } catch {}
    try { this.nodes?.river.stop(); } catch {}
    if (this.nodes) for (const node of Object.values(this.nodes)) { try { node.disconnect(); } catch {} }
    try { Promise.resolve(this.ctx?.close()).catch(() => {}); } catch {}
    this.ctx = null; this.nodes = null; this.music = null; this.musicError = null;
    this.musicState = 'idle'; this.lastMixTime = -Infinity; this.lastMixBucket = -1;
  }
}
