// Table tennis voices are oscillators and noise. There are no audio files.
// The bat pock and the table tik stay apart in pitch and length so the rally reads as pock, tik, pock, tik.

export const VOICES = Object.freeze({
  pock: { freq: 1200, dur: 0.04, gain: 0.22 },
  tik: { freq: 2400, dur: 0.025, gain: 0.1 },
  net: { freq: 150, dur: 0.09, gain: 0.16 },
  floor: { freq: 90, dur: 0.16, gain: 0.12 },
  whoosh: { dur: 0.12 },
  ooh: { freq: 330, dur: 0.28, gain: 0.08 },
  tick: { freq: 880, dur: 0.04, gain: 0.05 },
});

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function panFromX(x) {
  return Math.max(-1, Math.min(1, (Number(x) || 0) / 0.76));
}

export function createSoundKit() {
  let ctx = null;
  let murmur = null;
  const heard = [];

  function note(name, extra) {
    heard.push({ name, ...extra });
    if (heard.length > 24) heard.shift();
  }

  function attach(next) {
    if (next) ctx = next;
    return ctx;
  }

  function bus(pan) {
    if (!ctx) return null;
    const gain = ctx.createGain();
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panFromX(pan), ctx.currentTime || 0);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }
    return gain;
  }

  function tone(freq, dur, type, gainValue, pan) {
    if (!ctx) return;
    const now = ctx.currentTime || 0;
    const voice = ctx.createOscillator();
    const gain = ctx.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    voice.connect(gain);
    const out = bus(pan);
    if (out) gain.connect(out);
    else gain.connect(ctx.destination);
    voice.start(now);
    voice.stop(now + dur + 0.02);
  }

  function noise(dur, freq, q, gainValue, pan) {
    if (!ctx) return;
    const now = ctx.currentTime || 0;
    const n = Math.max(1, Math.floor((ctx.sampleRate || 8000) * dur));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate || 8000);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < n; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.08) * 0.96;
      data[i] = Math.max(-1, Math.min(1, brown));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(q, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    const out = bus(pan);
    if (out) gain.connect(out);
    else gain.connect(ctx.destination);
    source.start(now);
  }

  return {
    attach,
    context() { return ctx; },
    heard() { return heard.slice(); },
    pock(kind, speed, pan) {
      const smash = kind === 'smash';
      const drive = kind === 'drive';
      const gain = smash ? 0.34 : drive ? 0.24 : 0.16;
      const freq = smash ? 1600 : drive ? 1200 : 860;
      tone(freq, VOICES.pock.dur, 'sine', gain, pan);
      noise(VOICES.pock.dur, freq, 0.8, gain * 0.7, pan);
      if (smash) tone(90, 0.08, 'sine', 0.2, pan);
      note('pock', { freq, dur: VOICES.pock.dur, kind });
    },
    tik(pan) {
      tone(VOICES.tik.freq, VOICES.tik.dur, 'triangle', VOICES.tik.gain, pan);
      note('tik', { freq: VOICES.tik.freq, dur: VOICES.tik.dur });
    },
    net(pan) {
      tone(VOICES.net.freq, VOICES.net.dur, 'sine', VOICES.net.gain, pan);
      noise(VOICES.net.dur, 220, 0.6, 0.08, pan);
      note('net', { freq: VOICES.net.freq, dur: VOICES.net.dur });
    },
    floor(pan) {
      tone(VOICES.floor.freq, VOICES.floor.dur, 'sine', VOICES.floor.gain, pan);
      note('floor', { freq: VOICES.floor.freq, dur: VOICES.floor.dur });
    },
    whoosh(peak, pan) {
      const amount = clamp01(((Number(peak) || 300) - 300) / 900);
      noise(0.08 + amount * 0.08, 500 + amount * 1400, 0.7, 0.05 + amount * 0.16, pan);
      note('whoosh', { peak });
    },
    murmur() {
      if (!ctx || murmur) return;
      const dur = 1.2;
      const n = Math.max(1, Math.floor((ctx.sampleRate || 8000) * dur));
      const buffer = ctx.createBuffer(1, n, ctx.sampleRate || 8000);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < n; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.04) * 0.98;
        data[i] = brown * 0.35;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 280;
      const gain = ctx.createGain();
      gain.gain.value = 0.03;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      murmur = source;
      note('murmur', {});
    },
    clap(big) {
      noise(big ? 0.42 : 0.22, 1800, 0.5, big ? 0.14 : 0.07, 0);
      note('clap', { big: !!big });
    },
    ooh() {
      tone(VOICES.ooh.freq, VOICES.ooh.dur, 'sine', VOICES.ooh.gain, 0);
      tone(520, 0.22, 'triangle', 0.04, 0);
      note('ooh', { freq: VOICES.ooh.freq });
    },
    tick() {
      tone(VOICES.tick.freq, VOICES.tick.dur, 'sine', VOICES.tick.gain, 0);
      note('tick', { freq: VOICES.tick.freq, dur: VOICES.tick.dur });
    },
  };
}
