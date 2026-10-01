// js/story/audio/sfx.js : the story's sound effects, made in code like the arena's (js/audio.js).
// defineAll(Audio) adds them with Audio.define / Audio.defineLoop. A one-shot is fn(ctx, t, out, opts);
// a loop is fn(ctx, out, opts) -> { set(params), stop(fade) }.
// One-shots: horn, kazooHorn, kazoo, doorOpen, doorClose, doorSlide, trunk, shutter, phoneBuzz, rattle,
// scorpionClick, siren, step (opts.surface), splash, pickup, cairn, zip, radio, bump.
// Loops: engine {rpm 0..1, throttle 0..1}, skid {slip 0..1}, gravel {speed 0..1}, crickets {level},
// creek {level}, fire {level}.
const rnd = (a, b) => a + Math.random() * (b - a);

export function defineAll(A) {
  if (A.defs.horn) return; // once per page
  const tone = (t, type, f0, f1, peak, dec, a, out) => A.tone(t, type, f0, f1, peak, dec, a, out);
  const hit = (t, type, freq, q, peak, dec, sweep, out) => A.noiseHit(t, type, freq, q, peak, dec, sweep, out);
  const noiseSrc = (ctx, t, dur) => { const s = ctx.createBufferSource(); s.buffer = A.noise; s.loop = true; s.start(t, Math.random() * 1.5); if (dur) s.stop(t + dur); return s; };
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); };
  for (const name of ['siren', 'helicopter']) A.defineLoop(name, (context, output) => {
    const voice = context.createOscillator(), modulator = context.createOscillator();
    const depth = context.createGain(), volume = context.createGain();
    const air = name === 'helicopter';
    voice.type = air ? 'triangle' : 'sine'; voice.frequency.value = air ? 65 : 750;
    modulator.frequency.value = air ? 19 : 0.8; depth.gain.value = air ? 38 : 300;
    volume.gain.value = 0;
    modulator.connect(depth); depth.connect(voice.frequency); voice.connect(volume); volume.connect(output);
    voice.start(); modulator.start();
    return {
      set(options) { volume.gain.setTargetAtTime(Math.max(0, Math.min(1, options.level ?? 0)) * (air ? 0.16 : 0.09), context.currentTime, 0.15); },
      stop(fade = 0.2) { volume.gain.setTargetAtTime(0, context.currentTime, Math.max(0.01, fade / 3)); voice.stop(context.currentTime + fade + 0.1); modulator.stop(context.currentTime + fade + 0.1); },
    };
  });

  // the van's horn: two reedy tones a third apart
  A.define('horn', (ctx, t, out, o) => {
    const dur = o.long ? 0.9 : 0.42, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 1.2;
    env(g, t, 0.015, 0.22, dur, 0.06); lp.connect(g); g.connect(out);
    for (const [f, type] of [[392, 'sawtooth'], [494, 'square']]) { const x = ctx.createOscillator(); x.type = type; x.frequency.value = f; x.detune.value = rnd(-6, 6); x.connect(lp); x.start(t); x.stop(t + dur + 0.1); }
  });
  // all 51 kazoos found: the horn is a kazoo now (E8). A buzzing reed through a nasal formant, "da-da-daaa"
  const kazooNote = (ctx, t, f, dur, out, vel = 0.3) => {
    const o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    vib.frequency.value = 6.5; vg.gain.value = f * 0.02; vib.connect(vg); vg.connect(o.frequency);
    f1.type = 'bandpass'; f1.frequency.value = 900; f1.Q.value = 3; f2.type = 'bandpass'; f2.frequency.value = 2400; f2.Q.value = 4;
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); env(g, t, 0.02, vel, dur, 0.05); g.connect(out);
    for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.12); }
    hit(t, 'bandpass', 3000, 2, vel * 0.3, dur, 0, out);
  };
  A.define('kazooHorn', (ctx, t, out) => { kazooNote(ctx, t, 392, 0.12, out); kazooNote(ctx, t + 0.16, 392, 0.12, out); kazooNote(ctx, t + 0.32, 523, 0.5, out); });
  // one kazoo picked up: a short toot up
  A.define('kazoo', (ctx, t, out) => { kazooNote(ctx, t, 523, 0.08, out, 0.22); kazooNote(ctx, t + 0.1, 659, 0.16, out, 0.22); });

  // doors: a latch click and a body thud; the sliding door rolls, then clunks
  A.define('doorOpen', (ctx, t, out) => { hit(t, 'bandpass', 2400, 3, 0.25, 0.04, 0, out); hit(t + 0.05, 'lowpass', 900, 1, 0.2, 0.12, 0, out); });
  A.define('doorClose', (ctx, t, out) => { hit(t, 'lowpass', 420, 1, 0.8, 0.16, 0, out); tone(t, 'sine', 110, 55, 0.6, 0.18, 0.004, out); hit(t + 0.01, 'bandpass', 2600, 3, 0.2, 0.03, 0, out); });
  A.define('doorSlide', (ctx, t, out) => { hit(t, 'bandpass', 700, 0.8, 0.25, 0.55, 1400, out); hit(t + 0.55, 'lowpass', 380, 1, 0.9, 0.2, 0, out); tone(t + 0.55, 'sine', 95, 45, 0.6, 0.22, 0.004, out); });
  A.define('trunk', (ctx, t, out) => { hit(t, 'lowpass', 300, 1, 0.9, 0.25, 0, out); tone(t, 'sine', 80, 40, 0.6, 0.3, 0.004, out); });
  // the phone camera: the shutter's two clicks
  A.define('shutter', (ctx, t, out) => { hit(t, 'highpass', 3500, 1, 0.5, 0.025, 0, out); hit(t + 0.07, 'bandpass', 2200, 2, 0.4, 0.035, 0, out); });
  // a phone on vibrate: two buzzes
  A.define('phoneBuzz', (ctx, t, out) => {
    for (const d of [0, 0.5]) {
      const o = ctx.createOscillator(), am = ctx.createOscillator(), ag = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = 170; am.frequency.value = 32; ag.gain.value = 0.5; am.connect(ag); ag.connect(g.gain);
      lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); lp.connect(g); g.gain.setValueAtTime(0.5, t + d); g.gain.setValueAtTime(0, t + d + 0.34); g.connect(out);
      for (const x of [o, am]) { x.start(t + d); x.stop(t + d + 0.36); }
    }
  });
  // the rattlesnake's tell (0.6 s before its strike): a dry, fast rattle
  A.define('rattle', (ctx, t, out, o) => {
    const dur = o.dur || 0.7, s = noiseSrc(ctx, t, dur + 0.1), bp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.4; am.type = 'square'; am.frequency.value = 48; ag.gain.value = 0.35;
    am.connect(ag); ag.connect(g.gain); env(g, t, 0.03, 0.4, dur - 0.1, 0.08); s.connect(bp); bp.connect(g); g.connect(out); am.start(t); am.stop(t + dur + 0.1);
  });
  // the scorpion's trick step: three sharp clicks
  A.define('scorpionClick', (ctx, t, out) => { for (let i = 0; i < 3; i++) { hit(t + i * 0.07, 'highpass', 4200, 2, 0.55, 0.018, 0, out); tone(t + i * 0.07, 'square', 2600, 1800, 0.08, 0.02, 0.001, out); } });
  // a short siren whoop (the FBI arriving)
  A.define('siren', (ctx, t, out, o) => {
    const dur = o.dur || 2.2, x = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    x.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 2200;
    x.frequency.setValueAtTime(620, t);
    for (let k = 0; k < dur; k += 1.1) { x.frequency.linearRampToValueAtTime(1350, t + k + 0.55); x.frequency.linearRampToValueAtTime(620, t + k + 1.1); }
    env(g, t, 0.08, 0.16, dur - 0.2, 0.25); x.connect(lp); lp.connect(g); g.connect(out); x.start(t); x.stop(t + dur + 0.4);
  });
  // footsteps by surface
  A.define('step', (ctx, t, out, o) => {
    const s = o.surface || 'dirt', v = o.run ? 1 : 0.7;
    if (s === 'asphalt') { hit(t, 'bandpass', 1900, 1.5, 0.22 * v, 0.035, 0, out); hit(t, 'lowpass', 300, 1, 0.25 * v, 0.05, 0, out); }
    else if (s === 'rock') { hit(t, 'bandpass', 1300, 2, 0.25 * v, 0.03, 0, out); tone(t, 'sine', 140, 70, 0.18 * v, 0.05, 0.002, out); }
    else if (s === 'sand') hit(t, 'bandpass', 2600, 0.6, 0.12 * v, 0.09, 1200, out);
    else if (s === 'water') { hit(t, 'bandpass', 900, 0.8, 0.3 * v, 0.14, 2200, out); hit(t + 0.03, 'highpass', 3000, 0.7, 0.12 * v, 0.1, 0, out); }
    else if (s === 'scrub') { hit(t, 'highpass', 2800, 0.7, 0.14 * v, 0.12, 0, out); hit(t, 'lowpass', 400, 1, 0.2 * v, 0.05, 0, out); }
    else { hit(t, 'lowpass', 520, 1, 0.32 * v, 0.06, 0, out); hit(t + 0.01, 'bandpass', 3200, 1, 0.1 * v, 0.05, 0, out); }
  });
  A.define('splash', (ctx, t, out) => { hit(t, 'bandpass', 800, 0.7, 0.6, 0.4, 2400, out); hit(t + 0.05, 'highpass', 3000, 0.6, 0.2, 0.5, 0, out); });
  // a pickup or an objective: a small bright chime
  A.define('pickup', (ctx, t, out) => { [784, 1047, 1319].forEach((f, i) => tone(t + i * 0.07, 'sine', f, 0, 0.12, 0.35, 0.004, out)); });
  // a vortex cairn: a low bell with a long ring
  A.define('cairn', (ctx, t, out) => { [220, 330.5, 441, 662].forEach((f, i) => tone(t, 'sine', f * rnd(0.998, 1.002), 0, 0.18 / (i + 1), 3.2 - i * 0.5, 0.004, out)); tone(t, 'sine', 55, 45, 0.5, 1.4, 0.01, out); });
  // zip ties pulled tight
  A.define('zip', (ctx, t, out) => { for (let i = 0; i < 9; i++) hit(t + i * 0.022, 'bandpass', 3400 + i * 120, 3, 0.25, 0.012, 0, out); });
  // a radio: a burst of static, then a squelch
  A.define('radio', (ctx, t, out) => { hit(t, 'bandpass', 1800, 0.6, 0.25, 0.3, 900, out); tone(t + 0.3, 'square', 1200, 900, 0.05, 0.06, 0.002, out); });
  // a light touch between vehicles (the protected van's bump meter)
  A.define('bump', (ctx, t, out, o) => { const k = o.hard ? 1 : 0.5; hit(t, 'lowpass', 260, 1, 0.9 * k, 0.2, 0, out); tone(t, 'sine', 70, 35, 0.7 * k, 0.25, 0.003, out); hit(t, 'bandpass', 1500, 1.5, 0.3 * k, 0.08, 0, out); });

  // A six-second transformation bed. Its handle lets the cine stop it on skip or film failure.
  A.defineLoop('gabeMorph', (ctx, out) => {
    const nodes = [], start = ctx.currentTime;
    const note = (delay, f0, f1, level, duration, type = 'sine') => {
      const x = ctx.createOscillator(), g = ctx.createGain(), t = start + delay;
      x.type = type; x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + duration);
      env(g, t, 0.025, level, duration * 0.55, duration * 0.45); x.connect(g); g.connect(out);
      x.start(t); x.stop(t + duration + 0.1); nodes.push(x);
    };
    note(0, 72, 32, 0.35, 1.2); // collapse of the bear's mass
    for (let i = 0; i < 5; i++) note(0.45 + i * 0.48, 180 + i * 65, 70, 0.07, 0.5, 'triangle');
    const n = noiseSrc(ctx, start, 6.7), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.setValueAtTime(180, start); f.frequency.exponentialRampToValueAtTime(2800, start + 2.8); f.frequency.exponentialRampToValueAtTime(240, start + 5.8);
    env(g, start, 1.2, 0.16, 2.6, 2.5); n.connect(f); f.connect(g); g.connect(out); nodes.push(n);
    note(3.2, 95, 42, 0.3, 0.7); // landing on the sandstone
    for (const [i, f0] of [294, 440, 587].entries()) note(4.4 + i * 0.15, f0, f0, 0.065, 1.7);
    return { set() {}, stop(fade = 0.2) { for (const x of nodes) { try { x.stop(ctx.currentTime + fade + 0.02); } catch (e) { /* already ended */ } } } };
  });
  A.define('cineWhoosh', (ctx, t, out) => hit(t, 'bandpass', 250, 0.7, 0.16, 0.38, 2200, out));
  A.define('cineTraffic', (ctx, t, out) => { tone(t, 'triangle', 85, 52, 0.1, 2.4, 0.3, out); hit(t, 'lowpass', 700, 0.6, 0.12, 2.3, 220, out); });

  /* ---------------- loops ---------------- */
  // the engine: two detuned saws through a lowpass that opens with rpm and throttle
  A.defineLoop('engine', (ctx, out, o) => {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain(), sub = ctx.createOscillator(), sg = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2.2; lp.frequency.value = 300; g.gain.value = 0.0001;
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = 'sawtooth'; b.type = 'sawtooth'; sub.type = 'sine'; sg.gain.value = 0.35;
    a.connect(lp); b.connect(lp); sub.connect(sg); sg.connect(g); lp.connect(g); g.connect(out);
    const t0 = ctx.currentTime; for (const x of [a, b, sub]) x.start(t0);
    const h = {
      set(p) {
        const t = ctx.currentTime, rpm = Math.max(0, Math.min(1, p.rpm ?? 0.1)), th = Math.max(0, Math.min(1, p.throttle ?? 0));
        const f = 38 + rpm * 110;
        a.frequency.setTargetAtTime(f, t, 0.06); b.frequency.setTargetAtTime(f * 1.013 + 0.7, t, 0.06); sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
        lp.frequency.setTargetAtTime(220 + rpm * 900 + th * 1100, t, 0.08);
        g.gain.setTargetAtTime((0.05 + rpm * 0.07 + th * 0.06) * (p.on === false ? 0 : 1), t, 0.1);
      },
      stop(fade = 0.3) { const t = ctx.currentTime; for (const x of [a, b, sub]) x.stop(t + fade + 0.1); },
    };
    h.set(o); return h;
  });
  // tyres sliding: a band of noise that rises with slip
  A.defineLoop('skid', (ctx, out) => {
    const s = noiseSrc(ctx, ctx.currentTime), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 3; g.gain.value = 0.0001; s.connect(bp); bp.connect(g); g.connect(out);
    return { set(p) { const t = ctx.currentTime, k = Math.max(0, Math.min(1, p.slip ?? 0)); g.gain.setTargetAtTime(k * k * 0.3, t, 0.05); bp.frequency.setTargetAtTime(900 + k * 700, t, 0.05); }, stop(f = 0.2) { s.stop(ctx.currentTime + f + 0.1); } };
  });
  // gravel under the tyres on dirt
  A.defineLoop('gravel', (ctx, out) => {
    const s = noiseSrc(ctx, ctx.currentTime), lp = ctx.createBiquadFilter(), am = ctx.createOscillator(), ag = ctx.createGain(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 700; am.type = 'square'; am.frequency.value = 23; ag.gain.value = 0; am.connect(ag); ag.connect(g.gain);
    g.gain.value = 0.0001; s.connect(lp); lp.connect(g); g.connect(out); am.start();
    return { set(p) { const t = ctx.currentTime, k = Math.max(0, Math.min(1, p.speed ?? 0)); g.gain.setTargetAtTime(k * 0.22, t, 0.08); ag.gain.setTargetAtTime(k * 0.08, t, 0.08); lp.frequency.setTargetAtTime(500 + k * 1600, t, 0.08); am.frequency.setTargetAtTime(14 + k * 30, t, 0.1); }, stop(f = 0.2) { const t = ctx.currentTime; s.stop(t + f + 0.1); am.stop(t + f + 0.1); } };
  });
  // crickets at night: pulsed high tones in little groups
  A.defineLoop('crickets', (ctx, out) => {
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(out);
    const voices = [4400, 4720, 5100].map((f, i) => {
      const o = ctx.createOscillator(), am = ctx.createOscillator(), amg = ctx.createGain(), gate = ctx.createOscillator(), gg = ctx.createGain(), v = ctx.createGain();
      o.frequency.value = f; am.type = 'square'; am.frequency.value = 28 + i * 3; amg.gain.value = 0.5; gate.type = 'square'; gate.frequency.value = 0.9 + i * 0.23; gg.gain.value = 0.5;
      v.gain.value = 0; am.connect(amg); amg.connect(v.gain); gate.connect(gg); gg.connect(v.gain); o.connect(v); v.connect(g);
      for (const x of [o, am, gate]) x.start();
      return [o, am, gate];
    });
    return { set(p) { g.gain.setTargetAtTime(Math.max(0, Math.min(1, p.level ?? 1)) * 0.03, ctx.currentTime, 0.6); }, stop(f = 0.5) { const t = ctx.currentTime; for (const v of voices) for (const x of v) x.stop(t + f + 0.1); } };
  });
  // Oak Creek: a soft babble
  A.defineLoop('creek', (ctx, out) => {
    const s = noiseSrc(ctx, ctx.currentTime), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9; lfo.frequency.value = 3.1; lg.gain.value = 500; lfo.connect(lg); lg.connect(bp.frequency);
    g.gain.value = 0.0001; s.connect(bp); bp.connect(g); g.connect(out); lfo.start();
    return { set(p) { g.gain.setTargetAtTime(Math.max(0, Math.min(1, p.level ?? 1)) * 0.06, ctx.currentTime, 0.5); }, stop(f = 0.5) { const t = ctx.currentTime; s.stop(t + f + 0.1); lfo.stop(t + f + 0.1); } };
  });
  // a campfire: a low roar with pops
  A.defineLoop('fire', (ctx, out) => {
    const s = noiseSrc(ctx, ctx.currentTime), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0.0001; s.connect(lp); lp.connect(g); g.connect(out);
    let level = 1;
    return {
      set(p) { level = Math.max(0, Math.min(1, p.level ?? level)); g.gain.setTargetAtTime(level * 0.1, ctx.currentTime, 0.3); if (level > 0.2 && Math.random() < 0.08) hit(ctx.currentTime + Math.random() * 0.2, 'bandpass', rnd(1800, 3600), 3, 0.15 * level, 0.02, 0, out); },
      stop(f = 0.5) { s.stop(ctx.currentTime + f + 0.1); },
    };
  });
}
// wind by region: the band (Hz) and level of the wind bed (the arena's is 420 Hz at 0.05)
export const WIND = Object.freeze({
  west: [380, 0.03], airport: [520, 0.07], uptown: [360, 0.02], canyon: [300, 0.06], ranch: [460, 0.05],
  schnebly: [560, 0.07], redrock: [440, 0.05], village: [360, 0.025], boynton: [480, 0.06], interior: [220, 0.004], arena: [420, 0.05],
});
