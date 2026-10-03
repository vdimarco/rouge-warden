// Primordia sound: a generative underwater score and small synth effects, all made with Web Audio.
// Eating notes climb a pentatonic scale with the combo. The Burst hunt adds a driving bass pulse.
// Stasis sweeps a master low-pass filter down, so the whole mix sounds muffled while the dish is slow.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.tempo = 1;
    this.hunting = false; // set while the Burst hunt runs; drives the bass pulse in tick()
    this.winds = []; // live windup voices, oldest first
    this.nextBeat = 0;
    this.beat = 0;
    this.chord = 0;
  }

  init() {
    if (!this.ctx) {
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.on ? 0.8 : 0;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      // master -> Stasis low-pass -> compressor
      this.lpTop = Math.min(20000, c.sampleRate / 2);
      this.lp = c.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.frequency.value = this.lpTop;
      this.master.connect(this.lp).connect(comp).connect(c.destination);
      // a bypass bus for cues that must ring clear through Stasis (the parry bell)
      this.over = c.createGain(); this.over.gain.value = this.on ? 0.8 : 0;
      this.over.connect(comp);
      // a cheap echo for space
      this.wet = c.createGain(); this.wet.gain.value = 0.28;
      const d = c.createDelay(1); d.delayTime.value = 0.31;
      const fb = c.createGain(); fb.gain.value = 0.38;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
      this.wet.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.startDrone();
      this.nextBeat = c.currentTime + 0.1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setOn(on) {
    this.on = on;
    if (this.master) for (const b of [this.master, this.over]) b.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  startDrone() {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0.0;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380; lp.Q.value = 3;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    for (const [f, det] of [[hz(38), -7], [hz(45), 6], [hz(50), 3]]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start();
    }
    lp.connect(g); g.connect(this.master); g.connect(this.wet);
    this.droneGain = g;
    this.droneFilter = lp;
    g.gain.setTargetAtTime(0.06, c.currentTime, 2);
  }

  // Called every frame: schedules the soft arpeggio a little ahead of time.
  tick(intensity = 0) {
    const c = this.ctx;
    if (!c || !this.on) return;
    const spb = 60 / (92 * this.tempo) / 2; // eighth notes
    while (this.nextBeat < c.currentTime + 0.12) {
      const t = this.nextBeat, b = this.beat++;
      const prog = [0, -3, -7, -5];
      if (b % 16 === 0) this.chord = (this.chord + 1) % prog.length;
      const root = 57 + prog[this.chord];
      const pattern = [0, 4, 7, 11, 12, 7, 4, 2];
      if (b % 2 === 0 || intensity > 0.4) this.pluck(root + 12 + pattern[b % 8], t, 0.035 + intensity * 0.02, 0.5);
      if (b % 8 === 0) this.bass(root - 12, t, 0.09, spb * 7);
      if (this.hunting) {
        this.bass(root - 12 + (b % 2 ? 12 : 0), t, 0.11, spb * 0.9, "square");
        if (b % 2 === 0) this.kick(t, 0.5);
        if (b % 4 === 2) this.hat(t, 0.08);
      } else if (intensity > 0.6 && b % 4 === 0) this.kick(t, 0.25);
      this.nextBeat += spb;
    }
    if (this.droneFilter) this.droneFilter.frequency.setTargetAtTime(380 + intensity * 500 + (this.hunting ? 700 : 0), c.currentTime, 0.4);
  }

  env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  pluck(m, t, vol, dur = 0.4, type = "triangle") {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = hz(m);
    this.env(g, t, vol, 0.005, dur);
    o.connect(g); g.connect(this.master); g.connect(this.wet);
    o.start(t); o.stop(t + dur + 0.05);
  }

  bass(m, t, vol, dur, type = "sine") {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = hz(m);
    lp.type = "lowpass"; lp.frequency.value = 600;
    this.env(g, t, vol, 0.01, dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  kick(t, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    this.env(g, t, vol, 0.003, 0.16);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  hat(t, vol) { this.noise(t, vol, 0.05, 7000, "highpass"); }

  // One oscillator in Hz, with an optional glide to `to`.
  tone(f, t, vol, dur, type = "sine", to = 0, wet = true, out = this.master) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.env(g, t, vol, 0.004, dur);
    o.connect(g); g.connect(out); if (wet) g.connect(this.wet);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // The rising four-note chord shared by devour() and glory().
  arp(base, t, vol) {
    [0, 4, 7, 12].forEach((d, k) => this.pluck(base + d, t + k * 0.045, vol, 0.5, k % 2 ? "triangle" : "square"));
  }

  // Noise that grows and then stops dead, like a hit played backwards.
  swell(t, vol, dur, f0, f1) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = "bandpass"; f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.015);
    s.connect(f).connect(g); g.connect(this.master); g.connect(this.wet);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
  }

  // Fade out and stop a voice that is still sounding.
  cutVoice(v, t) {
    const p = v.g.gain;
    // some browsers report the default 1 for a param under automation; never hold above the voice's peak
    p.cancelScheduledValues(t); p.setValueAtTime(Math.min(v.vol, p.value), t); p.linearRampToValueAtTime(0, t + 0.04);
    for (const o of v.oscs) try { o.stop(t + 0.05); } catch (e) { /* already stopped */ }
    v.end = t + 0.05;
  }

  noise(t, vol, dur, freq, type = "bandpass", sweepTo) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = 1.2;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    this.env(g, t, vol, 0.005, dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }
  ready() { return this.ctx && this.on; }

  // --- effects ---
  gulp(combo) {
    if (!this.ready()) return;
    const t = this.now(), m = 64 + SCALE[Math.min(SCALE.length - 1, combo)];
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(hz(m - 5), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.06);
    this.env(g, t, 0.12, 0.004, 0.16);
    o.connect(g); g.connect(this.master); g.connect(this.wet);
    o.start(t); o.stop(t + 0.25);
  }
  nibble() {
    if (!this.ready()) return;
    const t = this.now();
    this.pluck(76 + Math.floor(Math.random() * 3) * 2, t, 0.02, 0.06, "sine");
  }
  devour(combo, big) {
    if (!this.ready()) return;
    const t = this.now(), base = 60 + SCALE[Math.min(SCALE.length - 4, combo)];
    this.arp(base, t, big ? 0.13 : 0.09);
    this.noise(t, 0.08, 0.2, 1800, "bandpass", 300);
    if (big) { this.kick(t, 0.6); this.bass(base - 24, t, 0.25, 0.6, "sawtooth"); }
  }
  hurt() {
    if (!this.ready()) return;
    const t = this.now();
    this.noise(t, 0.18, 0.18, 900, "bandpass", 200);
    this.bass(40, t, 0.18, 0.2, "sawtooth");
  }
  dash() {
    if (!this.ready()) return;
    this.noise(this.now(), 0.2, 0.22, 600, "bandpass", 3600);
  }
  frenzyStart() {
    if (!this.ready()) return;
    const t = this.now();
    [0, 5, 7, 12, 17, 19, 24].forEach((d, k) => this.pluck(60 + d, t + k * 0.05, 0.1, 0.3, "square"));
    this.kick(t, 0.7);
  }
  ready2() { if (!this.ready()) return; const t = this.now(); this.pluck(84, t, 0.08, 0.2, "sine"); this.pluck(91, t + 0.08, 0.08, 0.3, "sine"); }
  spawn(hunter) {
    if (!this.ready()) return;
    const t = this.now();
    if (hunter) { this.bass(36, t, 0.2, 0.9, "sawtooth"); this.noise(t, 0.06, 0.8, 300, "lowpass", 90); }
    else this.pluck(88, t, 0.03, 0.2, "sine");
  }
  golden() {
    if (!this.ready()) return;
    const t = this.now();
    [0, 4, 7, 11, 14, 19, 23, 26].forEach((d, k) => this.pluck(72 + d, t + k * 0.04, 0.09, 0.6, "triangle"));
  }
  epoch() {
    if (!this.ready()) return;
    const t = this.now();
    [[60, 64, 67, 71], [62, 65, 69, 72]].forEach((ch, k) => ch.forEach((m) => this.pluck(m, t + k * 0.35, 0.07, 1.4, "triangle")));
  }
  pick() { if (!this.ready()) return; const t = this.now(); this.pluck(79, t, 0.08, 0.15, "square"); this.pluck(86, t + 0.06, 0.08, 0.3, "square"); }
  move() { if (!this.ready()) return; this.pluck(74, this.now(), 0.04, 0.06, "square"); }
  death() {
    if (!this.ready()) return;
    const t = this.now();
    [67, 63, 60, 55, 51, 48].forEach((m, k) => this.pluck(m, t + k * 0.13, 0.1, 0.7, "triangle"));
    this.noise(t, 0.2, 1.4, 2000, "lowpass", 80);
  }

  // --- combat cues ---
  // A hunter winds up: saw and sine rise from 220 to 880 Hz over `sec` as a low-pass opens.
  // Call it once per windup, not every frame. At most 3 voices; a new one stops the oldest.
  // A call within 50 ms of the last is skipped, so hunters that start together share one voice.
  windup(sec) {
    if (!this.ready()) return;
    const c = this.ctx, t = this.now(), d = Math.min(4, Math.max(0.1, Number(sec) || 0.6));
    this.winds = this.winds.filter((v) => v.end > t);
    const last = this.winds[this.winds.length - 1];
    if (last && t - last.t0 < 0.05) return;
    while (this.winds.length >= 3) this.cutVoice(this.winds.shift(), t);
    const lp = c.createBiquadFilter(), g = c.createGain(), oscs = [], vol = 0.05;
    lp.type = "lowpass"; lp.Q.value = 4;
    lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(3200, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol / 2, t + Math.min(0.08, d / 2));
    g.gain.linearRampToValueAtTime(vol, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    for (const type of ["sawtooth", "sine"]) {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t + d);
      o.connect(lp); o.start(t); o.stop(t + d + 0.1); oscs.push(o);
    }
    lp.connect(g).connect(this.master);
    this.winds.push({ g, oscs, vol, t0: t, end: t + d + 0.1 });
  }
  glint() {
    if (!this.ready()) return;
    const t = this.now();
    this.tone(2600, t, 0.06, 0.08, "triangle");
    this.noise(t, 0.05, 0.02, 7000, "highpass");
  }
  lunge() {
    if (!this.ready()) return;
    this.noise(this.now(), 0.3, 0.3, 400, "bandpass", 120);
  }
  // n: 1 for the first cut on a hunter, 2 for the next within 1.2 s, and so on.
  // The noise slice and the pluck both climb one pentatonic step per cut (the slice stops after an octave).
  cut(n = 1) {
    if (!this.ready()) return;
    const t = this.now(), k = Math.min(SCALE.length - 1, Math.max(0, (n | 0) - 1)), r = Math.pow(2, SCALE[Math.min(k, 5)] / 12);
    this.noise(t, 0.16, 0.07, 2000 * r, "bandpass", 5000 * r);
    this.pluck(72 + SCALE[k], t + 0.01, 0.06, 0.14, "square");
  }
  stagger() {
    if (!this.ready()) return;
    const t = this.now();
    this.tone(220, t, 0.12, 0.6, "triangle");
    this.tone(330, t, 0.08, 0.6, "triangle");
  }
  glory(big) {
    if (!this.ready()) return;
    const t = this.now();
    this.kick(t, big ? 0.8 : 0.6);
    this.noise(t, 0.2, 0.12, 1800, "bandpass", 350);
    this.noise(t, 0.08, 0.06, 5000, "highpass");
    this.arp(64, t, big ? 0.13 : 0.1);
    if (big) this.bass(40, t, 0.25, 0.7, "sawtooth");
  }
  // A bell: sine plus an inharmonic partial at 2.76x. It skips the Stasis filter; its echo does not.
  parry() {
    if (!this.ready()) return;
    const t = this.now(), f = hz(83);
    this.tone(f, t, 0.14, 1, "sine", 0, true, this.over);
    this.tone(f * 2.76, t, 0.06, 0.7, "sine", 0, false, this.over);
  }
  // Guarded on the context, not on mute, so the filter can never stay shut after a mute mid-Stasis.
  stasis(on) {
    if (!this.lp) return;
    const f = this.lp.frequency, t = this.now();
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(20, f.value), t);
    f.exponentialRampToValueAtTime(on ? 700 : this.lpTop, t + 0.1);
  }
  burst() {
    if (!this.ready()) return;
    const t = this.now();
    this.kick(t, 0.8);
    this.tone(80, t, 0.4, 0.7, "sine", 40, false);
    this.swell(t, 0.22, 0.18, 400, 5000);
  }
  burstReady() { this.ready2(); }
  graze() {
    if (!this.ready()) return;
    const t = this.now();
    this.noise(t, 0.08, 0.08, 6000, "highpass");
    this.pluck(91, t + 0.02, 0.05, 0.15, "sine");
  }
  refill() { if (!this.ready()) return; this.tone(1300, this.now(), 0.06, 0.04, "sine", 0, false); }
  pop() { if (!this.ready()) return; this.pluck(88, this.now(), 0.07, 0.12, "triangle"); }
  crack() { if (!this.ready()) return; this.noise(this.now(), 0.12, 0.02, 3000, "bandpass"); }
  bubble() { if (!this.ready()) return; this.tone(600, this.now(), 0.04, 0.18, "sine", 900); }
  // n: the phase just reached (1 after the first wing is torn). Each phase is a fourth higher.
  bossPhase(n = 1) {
    if (!this.ready()) return;
    const c = this.ctx, t = this.now(), m = 36 + 5 * Math.min(6, Math.max(0, (n | 0) - 1));
    const lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = "lowpass"; lp.Q.value = 2;
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.7);
    this.env(g, t, 0.2, 0.02, 0.8);
    for (const det of [-9, 9]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + 0.9);
    }
    lp.connect(g); g.connect(this.master); g.connect(this.wet);
    this.kick(t, 0.5);
  }
  hit() {
    if (!this.ready()) return;
    this.hurt();
    this.tone(90, this.now(), 0.3, 0.2, "sine", 38, false);
  }
}
