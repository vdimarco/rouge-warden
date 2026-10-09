export const SCORE = {
  bpm: 126,
  melody: [
    [76, 0, 79, 81, 76, 74, 72, 74],
    [77, 76, 72, 0, 69, 72, 76, 77],
    [79, 0, 76, 72, 74, 76, 79, 83],
    [81, 79, 74, 0, 71, 74, 76, 0],
  ],
  bass: [45, 41, 48, 43],
};

const pitch = note => 440 * 2 ** ((note - 69) / 12);

export function createAudio(Context = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context, master, noise, pendingSuspend, lastStatus, nextTime = 0, step = 0, music = false, enabled = false;
  const voices = new Set();
  function stop() {
    music = false;
    nextTime = 0;
    step = 0;
    for (const voice of voices) {
      try { voice.source.stop(); } catch {}
      voice.source.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  }
  async function unlock() {
    if (!Context) return false;
    try {
      if (!context) {
        context = new Context();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.12), context.sampleRate);
        const samples = noise.getChannelData(0);
        let seed = 17;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = seed / 2147483648 - 1;
        }
      }
      if (pendingSuspend) await pendingSuspend;
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running';
    } catch { return false; }
  }
  function envelope(source, when, duration, volume) {
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const voice = { source, gain };
    voices.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      voices.delete(voice);
    };
    source.start(when);
    source.stop(when + duration + 0.01);
  }
  function note(frequency, when, duration, volume, type = 'square', end = frequency) {
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(frequency, when);
    source.frequency.exponentialRampToValueAtTime(end, when + duration);
    envelope(source, when, duration, volume);
  }
  function percussion(when, volume, duration) {
    const source = context.createBufferSource();
    source.buffer = noise;
    envelope(source, when, duration, volume);
  }
  function phrase(game) {
    const bar = Math.floor(step / 16) % 8;
    const beat = step % 16;
    const length = 60 / (SCORE.bpm + Math.min(12, (game.wave || 1) * 2)) / 4;
    const pressure = (game.enemies?.length || 0) >= 6;
    if (beat % 2 === 0) {
      const melody = SCORE.melody[bar % 4][beat / 2];
      if (melody) note(pitch(melody + (bar >= 4 && beat === 14 ? 12 : 0)), nextTime, length * 1.6, 0.023, 'square');
    }
    if ([0, 6, 8, 14].includes(beat)) {
      const bass = SCORE.bass[bar % 4] + (beat === 6 ? 12 : beat === 14 ? 7 : 0);
      note(pitch(bass), nextTime, length * 1.8, 0.045, 'triangle');
    }
    if (beat === 0 || beat === 8 || (pressure && beat === 10)) note(100, nextTime, 0.11, 0.065, 'sine', 35);
    if (beat === 4 || beat === 12) percussion(nextTime, 0.025, 0.1);
    if (beat % 2 === 0 || (bar % 4 === 3 && beat >= 12)) percussion(nextTime, pressure ? 0.013 : 0.009, 0.025);
    nextTime += length;
    step = (step + 1) % 128;
  }
  function sync(game, sound) {
    const changed = game.status !== lastStatus;
    lastStatus = game.status;
    enabled = !!sound;
    if (!context || !master || !noise || context.state !== 'running') { stop(); return; }
    master.gain.value = enabled ? 0.65 : 0;
    if (!enabled || game.status !== 'playing') {
      if (music || changed || !enabled) stop();
      if (enabled && changed) {
        const notes = game.status === 'victory' ? [72, 76, 79, 84]
          : game.status === 'upgrade' ? [72, 76, 81]
            : game.status === 'gameover' ? [64, 60, 57, 45] : [];
        notes.forEach((value, index) => note(pitch(value), context.currentTime + 0.02 + index * 0.13, 0.25, 0.045, 'triangle'));
      }
      return;
    }
    if (!music || changed || nextTime < context.currentTime - 0.1) {
      stop();
      music = true;
      nextTime = context.currentTime + 0.025;
    }
    while (nextTime < context.currentTime + 0.15) phrase(game);
  }
  return {
    get state() {
      if (!enabled) return 'muted';
      if (!context || !master || !noise || context.state === 'closed' || (lastStatus === 'playing' && context.state !== 'running')) return 'locked';
      return music ? 'playing' : 'paused';
    },
    unlock,
    sync(game, sound) {
      try { sync(game, sound); } catch { stop(); enabled = false; }
    },
    effect(frequency, duration, volume) {
      try {
        if (enabled && context?.state === 'running') note(frequency, context.currentTime, duration, volume, 'square', Math.max(30, frequency / 3));
      } catch { /* Audio remains optional if the browser rejects a node. */ }
    },
    suspend() {
      stop();
      if (context?.state === 'running') pendingSuspend = context.suspend().catch(() => {});
    },
    reset() { stop(); lastStatus = undefined; },
    dispose() { stop(); master?.disconnect(); context?.close().catch(() => {}); },
  };
}
