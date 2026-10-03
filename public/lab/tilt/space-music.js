// Original generative score for Full Tilt. A fixed set of voices plays a slow
// harmonic orbit; the game clock steers it, so a pause never queues missed notes.
const TAU = Math.PI * 2;
const BEAT = 60 / 72;
const CHORD_TIME = BEAT * 16;
const CROSSFADE = 3.2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const midi = note => 440 * 2 ** ((note - 69) / 12);
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
// Suspended/add-nine voicings share notes as the bass moves beneath them.
const HARMONY = [
  { bass: 45, notes: [57, 60, 64, 71] },
  { bass: 41, notes: [57, 60, 64, 67] },
  { bass: 48, notes: [55, 59, 62, 64] },
  { bass: 38, notes: [57, 62, 64, 69] },
  { bass: 45, notes: [55, 59, 64, 72] },
  { bass: 41, notes: [57, 60, 64, 71] },
  { bass: 43, notes: [57, 62, 67, 71] },
  { bass: 40, notes: [55, 59, 64, 69] },
];
const MOTIFS = [
  [0, -1, 2, 3, -1, 1, 2, -1],
  [2, -1, 1, -1, 3, 2, -1, 0],
  [3, 2, -1, 0, -1, 1, -1, 2],
];

export function createSpaceMusic(Sfx) {
  let graph = null, destroyed = false, audible = false, failedContext = null;
  let lastStep = -1, lastClock = null, lastUpdate = -Infinity, nextVoice = 0;

  function dispose() {
    if (!graph) return;
    for (const source of graph.sources) { try { source.stop(); } catch (_) { /* already stopped */ } }
    for (const node of graph.nodes) { try { node.disconnect(); } catch (_) { /* already detached */ } }
    graph = null;
  }

  function build(e) {
    const ctx = e.ctx, nodes = [], sources = [];
    const keep = node => { nodes.push(node); return node; };
    const gain = (level, to) => {
      const node = keep(ctx.createGain()); node.gain.value = level;
      if (to) node.connect(to);
      return node;
    };
    const filter = (type, frequency, q, to) => {
      const node = keep(ctx.createBiquadFilter());
      node.type = type; node.frequency.value = frequency; node.Q.value = q;
      if (to) node.connect(to);
      return node;
    };
    const pan = (amount, to) => {
      if (!ctx.createStereoPanner) return to;
      const node = keep(ctx.createStereoPanner()); node.pan.value = amount; node.connect(to);
      return node;
    };
    const oscillator = (type, frequency, to, detune = 0) => {
      const node = keep(ctx.createOscillator()); node.type = type;
      node.frequency.value = frequency; node.detune.value = detune; node.connect(to);
      sources.push(node); return node;
    };
    try {
      const master = gain(0, e.loop);
      // Effects return before master, so pause also silences their tails.
      const mix = gain(1, master);
      const space = keep(ctx.createConvolver());
      const ir = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 3.8), ctx.sampleRate);
      let seed = 0x6f726269;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000 * 2 - 1; };
      for (let channel = 0; channel < 2; channel++) {
        const data = ir.getChannelData(channel); let low = 0;
        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          low += .22 * (random() - low);
          data[i] = low * Math.exp(-t * 1.8) * Math.min(1, t / .05);
        }
      }
      space.buffer = ir;
      space.connect(gain(.36, master));
      mix.connect(gain(.32, space));
      const echoSend = gain(.24);
      for (const [delaySeconds, side] of [[BEAT * .75, -.62], [BEAT * 1.5, .62]]) {
        const delay = keep(ctx.createDelay(2)); delay.delayTime.value = delaySeconds;
        const damp = filter('lowpass', 2900, .55, delay);
        echoSend.connect(delay);
        delay.connect(gain(.29, damp));
        delay.connect(pan(side, gain(.45, master)));
        delay.connect(gain(.12, space));
      }
      const banks = [0, 1].map(() => {
        const amp = gain(0, mix);
        const voices = [0, 1, 2, 3].map(i => {
          const filterNode = filter('lowpass', 1000, .5, pan((i - 1.5) * .32, amp));
          const a = oscillator('triangle', 220, gain(.075, filterNode), -3.2 - i * .5);
          const b = oscillator('sine', 220, gain(.058, filterNode), 3.2 + i * .5);
          return { a, b, filter: filterNode };
        });
        return { amp, voices, chord: -1 };
      });
      // Fundamental weight plus an octave and fifth remains audible on a phone.
      const bassAmp = gain(0, mix), bassFilter = filter('lowpass', 390, .5, bassAmp);
      const bass = [
        oscillator('sine', 110, gain(.14, bassFilter)),
        oscillator('triangle', 220, gain(.048, bassFilter)),
        oscillator('sine', 330, gain(.018, bassFilter)),
      ];
      const bells = [0, 1, 2].map(i => {
        const amp = gain(0), output = pan((i - 1) * .48, mix);
        amp.connect(output); amp.connect(echoSend);
        const fundamental = oscillator('sine', 440, amp);
        const overtone = oscillator('sine', 880, gain(.19, amp));
        const halo = oscillator('sine', 1320, gain(.055, amp));
        return { amp, fundamental, overtone, halo };
      });
      const airAmp = gain(0, mix), airFilter = filter('bandpass', 1400, .4, airAmp);
      if (e.pink) {
        const air = keep(ctx.createBufferSource()); air.buffer = e.pink; air.loop = true;
        air.playbackRate.value = .71; air.connect(airFilter); sources.push(air);
      }
      for (const source of sources) source.start();
      return { e, ctx, nodes, sources, master, banks, bass, bassAmp, bells, airAmp, airFilter };
    } catch (error) {
      for (const source of sources) { try { source.stop(); } catch (_) { /* not started */ } }
      for (const node of nodes) { try { node.disconnect(); } catch (_) { /* partial graph */ } }
      throw error;
    }
  }

  function hold(param, now) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const value = param.value; param.cancelScheduledValues(now); param.setValueAtTime(value, now); }
  }
  function steer(param, value, tau = .12) {
    const now = graph.ctx.currentTime;
    hold(param, now); param.setTargetAtTime(value, now, tau);
  }
  function stop() {
    if (!graph || !audible) return;
    audible = false; lastClock = null; lastStep = -1;
    const now = graph.ctx.currentTime;
    hold(graph.master.gain, now); graph.master.gain.linearRampToValueAtTime(0, now + .045);
    // Clear the short, scheduled note envelopes. The next start is a new phrase.
    for (const voice of graph.bells) {
      hold(voice.amp.gain, now); voice.amp.gain.linearRampToValueAtTime(0, now + .025);
    }
  }
  function strike(note, strength) {
    const voice = graph.bells[nextVoice++ % graph.bells.length];
    const now = graph.ctx.currentTime, start = now + .014, f = midi(note);
    hold(voice.amp.gain, now);
    voice.amp.gain.linearRampToValueAtTime(0, start);
    for (const [osc, multiplier] of [[voice.fundamental, 1], [voice.overtone, 2.002], [voice.halo, 3.003]]) {
      osc.frequency.cancelScheduledValues(now); osc.frequency.setValueAtTime(f * multiplier, start);
    }
    voice.amp.gain.linearRampToValueAtTime(strength, start + .026);
    voice.amp.gain.setTargetAtTime(0, start + .026, .36);
    voice.amp.gain.setValueAtTime(0, start + 2.5);
  }

  function update({ active = false, clock = 0, sector = 0, phase = 'play', reducedMotion = false } = {}) {
    if (destroyed) return;
    const e = Sfx.engine;
    if (!active || !Number.isFinite(clock) || !Sfx.isOn()
      || (typeof document !== 'undefined' && document.hidden)
      || !e || e.ctx.state !== 'running') { stop(); return; }
    if (e.ctx === failedContext) return;
    try {
      if (graph && graph.e !== e) { stop(); dispose(); }
      if (!graph) graph = build(e);
      const now = graph.ctx.currentTime;
      const resumed = !audible;
      const jumped = lastClock !== null && (clock < lastClock || clock - lastClock > .5);
      // 30 Hz control rate keeps automation bounded and avoids work at 120 Hz.
      if (!resumed && !jumped && now - lastUpdate < 1 / 30) return;
      lastUpdate = now; lastClock = clock;
      const time = Math.max(0, clock), chordNumber = Math.floor(time / CHORD_TIME);
      const chordIndex = chordNumber % HARMONY.length;
      const nextIndex = (chordIndex + 1) % HARMONY.length;
      const chordPosition = time % CHORD_TIME;
      const cross = smooth((chordPosition - CHORD_TIME + CROSSFADE) / CROSSFADE);
      const intensity = phase === 'ready' ? .74 : phase === 'upgrade' ? .66 : 1;
      const zone = Number.isFinite(sector) ? Math.max(0, Math.floor(sector)) : 0;
      const breathe = .86 + .14 * Math.sin(time * TAU / 19);
      const color = .5 + .5 * Math.sin(time * TAU / 47 + zone * .63);
      audible = true;
      steer(graph.master.gain, .49 * intensity, resumed ? .65 : .3);
      for (const [slot, index, level] of [[chordNumber % 2, chordIndex, 1 - cross], [(chordNumber + 1) % 2, nextIndex, cross]]) {
        const bank = graph.banks[slot], harmony = HARMONY[index];
        if (bank.chord !== index) {
          bank.chord = index;
          bank.voices.forEach((voice, i) => {
            steer(voice.a.frequency, midi(harmony.notes[i]), .16);
            steer(voice.b.frequency, midi(harmony.notes[i]), .16);
          });
        }
        steer(bank.amp.gain, level * breathe, .14);
        bank.voices.forEach((voice, i) => steer(voice.filter.frequency, 650 + 800 * color + 90 * Math.sin(time * .14 + i), .5));
      }
      const root = midi(HARMONY[chordIndex].bass);
      const upcoming = midi(HARMONY[nextIndex].bass);
      // A very slow bass glide is concealed beneath the chord crossfade.
      const bassFrequency = root * (1 - cross) + upcoming * cross;
      graph.bass.forEach((osc, i) => steer(osc.frequency, bassFrequency * [1, 2, 3][i], .24));
      const pulse = .74 + .26 * (.5 + .5 * Math.cos(time / BEAT * TAU)) ** 3;
      steer(graph.bassAmp.gain, pulse * (.76 + .24 * intensity), .045);
      steer(graph.airAmp.gain, .012 + .01 * color, .7);
      steer(graph.airFilter.frequency, 1000 + 1200 * (.5 + .5 * Math.sin(time * .083)), .8);

      const step = Math.floor(time / BEAT);
      // Never replay missed beats after a hidden tab, pause, or clock jump.
      if (resumed || jumped) lastStep = step;
      if (step !== lastStep) {
        lastStep = step;
        if (time % BEAT < BEAT * .35) {
          const motif = MOTIFS[(Math.floor(step / 32) + zone) % MOTIFS.length];
          const degree = motif[step % motif.length];
          if (degree >= 0) {
            const note = HARMONY[cross > .72 ? nextIndex : chordIndex].notes[degree] + 12;
            const accent = step % 8 === 0 ? 1 : .76;
            strike(note, .042 * accent * intensity * (reducedMotion ? .9 : 1));
          }
        }
      }
    } catch (_) {
      // Unsupported audio never interrupts a shot; partial graphs are disposed.
      stop(); dispose(); failedContext = e.ctx;
    }
  }

  const onHidden = () => { if (document.hidden) stop(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHidden);
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHidden);
    dispose(); audible = false;
  }
  return { update, stop, destroy };
}
