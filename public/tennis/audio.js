// Lawn sounds are oscillators and noise. There are no audio files.

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function whooshAmount(peak) {
  return clamp01((Number(peak) - 250) / 750);
}

export function createSoundKit() {
  let ctx = null;

  function attach(next) {
    if (next) ctx = next;
    return ctx;
  }

  function osc(freq, dur, type, gainValue) {
    if (!ctx) return;
    const now = ctx.currentTime || 0;
    const voice = ctx.createOscillator();
    const gain = ctx.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    voice.connect(gain);
    gain.connect(ctx.destination);
    voice.start(now);
    voice.stop(now + dur + 0.02);
    return voice;
  }

  return {
    attach,
    context() { return ctx; },
    tok() {
      const voice = osc(180, 0.06, 'sine', 0.22);
      if (voice && ctx) voice.frequency.exponentialRampToValueAtTime(90, (ctx.currentTime || 0) + 0.05);
    },
    bounce() {
      osc(120, 0.07, 'triangle', 0.16);
    },
    point() {
      osc(520, 0.16, 'sine', 0.14);
      osc(780, 0.2, 'triangle', 0.08);
    },
    win() {
      osc(523, 0.28, 'sine', 0.14);
      osc(659, 0.32, 'triangle', 0.1);
      osc(784, 0.4, 'sine', 0.08);
    },
    whoosh(peak) {
      if (!ctx) return;
      const amount = whooshAmount(peak);
      const now = ctx.currentTime || 0;
      const dur = 0.18;
      const n = Math.max(1, Math.floor((ctx.sampleRate || 8000) * dur));
      const buffer = ctx.createBuffer(1, n, ctx.sampleRate || 8000);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      const pitch = 400 + amount * 800;
      filter.frequency.setValueAtTime(pitch, now);
      filter.frequency.linearRampToValueAtTime(Math.min(4000, pitch * 1.6), now + dur);
      filter.Q.setValueAtTime(0.7, now);
      const gain = ctx.createGain();
      const level = 0.15 + amount * 0.45;
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
    },
    chime() {
      osc(660, 0.18, 'sine', 0.12);
      osc(880, 0.22, 'triangle', 0.08);
    },
    chirp() {
      if (!ctx) return;
      const now = ctx.currentTime || 0;
      const voice = ctx.createOscillator();
      const gain = ctx.createGain();
      voice.type = 'sine';
      voice.frequency.setValueAtTime(1800, now);
      voice.frequency.exponentialRampToValueAtTime(2600, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      voice.connect(gain);
      gain.connect(ctx.destination);
      voice.start(now);
      voice.stop(now + 0.12);
    },
  };
}
