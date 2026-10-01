// A small, reusable score for sector travel. Every envelope follows the game
// clock: pausing, skipping or resuming a jump never leaves a cue playing behind.
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (a, b, p) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const swell = (a, b, c, d, p) => ease(a, b, p) * (1 - ease(c, d, p));

export function createTransitAudio(Sfx) {
  let graph = null, audible = false, destroyed = false;

  function build(e) {
    const ctx = e.ctx, nodes = [], sources = [];
    const keep = node => { nodes.push(node); return node; };
    const gain = (level, to) => {
      const node = keep(ctx.createGain());
      node.gain.value = level;
      if (to) node.connect(to);
      return node;
    };
    const master = gain(0, e.loop);
    function voice(type, frequency, pan = 0) {
      const oscillator = keep(ctx.createOscillator());
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const amp = gain(0);
      oscillator.connect(amp);
      let panner = null;
      if (ctx.createStereoPanner && pan) {
        panner = keep(ctx.createStereoPanner());
        panner.pan.value = pan;
        amp.connect(panner); panner.connect(master);
      } else amp.connect(master);
      sources.push(oscillator);
      return { oscillator, amp, panner };
    }
    function noise(buffer, type, frequency, q) {
      const source = keep(ctx.createBufferSource());
      source.buffer = buffer; source.loop = true;
      const filter = keep(ctx.createBiquadFilter());
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
      const amp = gain(0, master);
      source.connect(filter); filter.connect(amp);
      sources.push(source);
      return { filter, amp };
    }

    try {
      // The octave above the sub keeps the sense of weight on phone speakers.
      const sub = voice('sine', 42);
      const body = voice('sine', 84);
      const shimmer = [voice('sine', 220, -.42), voice('sine', 330, .42), voice('sine', 440, -.15)];
      const wind = noise(e.pink, 'bandpass', 300, .65);
      const air = noise(e.white, 'bandpass', 2200, .5);
      for (const source of sources) source.start();
      return { e, ctx, master, sub, body, shimmer, wind, air, nodes, sources };
    } catch (error) {
      for (const source of sources) { try { source.stop(); } catch (_) { /* not started */ } }
      for (const node of nodes) { try { node.disconnect(); } catch (_) { /* already detached */ } }
      throw error;
    }
  }

  // Keep only the current automation target; the graph stays the same size
  // through every frame and every subsequent jump.
  function steer(param, value, tau = .045) {
    const now = graph.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, tau);
  }

  function stop() {
    if (!graph || !audible) return;
    audible = false;
    const now = graph.ctx.currentTime, level = graph.master.gain;
    const current = level.value;
    if (level.cancelAndHoldAtTime) level.cancelAndHoldAtTime(now);
    else { level.cancelScheduledValues(now); level.setValueAtTime(current, now); }
    level.linearRampToValueAtTime(0, now + .025);
  }

  function update(flight, active, reducedMotion = false) {
    if (destroyed) return;
    const e = Sfx.engine;
    if (!active || !flight || !Number.isFinite(flight.progress) || !Sfx.isOn()
      || (typeof document !== 'undefined' && document.hidden)
      || !e || e.ctx.state !== 'running') {
      stop(); return;
    }
    try {
      if (!graph) graph = build(e);
      const p = clamp(flight.progress);
      const lift = swell(0, .1, .38, .61, p);
      const plunge = swell(.34, .5, .61, .7, p);
      const exit = swell(.71, .76, .81, .87, p);
      const arrival = swell(.83, .89, .94, 1, p);
      // Sound falls away at the event horizon before the short exit surge.
      const hush = 1 - .96 * swell(.59, .66, .706, .745, p);
      const envelope = ease(0, .025, p) * (1 - ease(.97, 1, p));
      const rise = ease(.08, .62, p);
      const resolve = ease(.81, .89, p);
      const mix = reducedMotion ? .78 : 1;
      const { sub, body, shimmer, wind, air } = graph;

      audible = true;
      steer(graph.master.gain, .48 * envelope * mix, .018);
      const bass = (42 - 12 * plunge) * (1 - resolve) + 55 * resolve;
      steer(sub.oscillator.frequency, bass);
      steer(sub.amp.gain, (.07 * lift + .1 * plunge + .075 * exit + .045 * arrival) * hush);
      steer(body.oscillator.frequency, bass * 2);
      steer(body.amp.gain, (.022 * lift + .025 * plunge + .018 * arrival) * hush);

      const chord = [220, 277.1826, 329.6276];
      shimmer.forEach((voice, i) => {
        const moving = [176, 264.6, 353.2][i] * (1 + 2.6 * rise + 1.1 * exit);
        const pitch = moving * (1 - resolve) + chord[i] * resolve;
        steer(voice.oscillator.frequency, pitch);
        steer(voice.amp.gain, ((.006 * lift + .012 * plunge + .014 * exit) * hush + .022 * arrival) / (1 + i * .25));
        if (voice.panner) {
          const orbit = Math.sin(p * Math.PI * 4 + i * 2.1);
          steer(voice.panner.pan, orbit * (reducedMotion ? .08 : .42), .09);
        }
      });

      steer(wind.filter.frequency, 170 + 1450 * rise + 1450 * exit);
      steer(wind.amp.gain, (.036 * lift + .07 * plunge + .1 * exit) * hush);
      steer(air.filter.frequency, 1200 + 3000 * rise + 900 * exit);
      steer(air.amp.gain, (.004 * lift + .008 * plunge + .027 * exit) * hush);
    } catch (_) {
      // Audio support must never interrupt travel or consume a player's input.
      stop();
    }
  }

  const onHidden = () => { if (document.hidden) stop(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHidden);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHidden);
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setValueAtTime(0, now);
    for (const source of graph.sources) { try { source.stop(); } catch (_) { /* already stopped */ } }
    for (const node of graph.nodes) { try { node.disconnect(); } catch (_) { /* already detached */ } }
    graph = null; audible = false;
  }

  return { update, stop, destroy };
}
