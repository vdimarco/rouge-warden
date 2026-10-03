// Primordia sound: a generative underwater score and small synth effects, all made with Web Audio.
// Eating notes climb a pentatonic scale with the combo. Frenzy adds a driving bass pulse.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.tempo = 1;
    this.frenzy = false;
    this.nextBeat = 0;
    this.beat = 0;
    this.chord = 0;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.on ? 0.8 : 0;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
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
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
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
      if (this.frenzy) {
        this.bass(root - 12 + (b % 2 ? 12 : 0), t, 0.11, spb * 0.9, "square");
        if (b % 2 === 0) this.kick(t, 0.5);
        if (b % 4 === 2) this.hat(t, 0.08);
      } else if (intensity > 0.6 && b % 4 === 0) this.kick(t, 0.25);
      this.nextBeat += spb;
    }
    if (this.droneFilter) this.droneFilter.frequency.setTargetAtTime(380 + intensity * 500 + (this.frenzy ? 700 : 0), c.currentTime, 0.4);
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
    [0, 4, 7, 12].forEach((d, k) => this.pluck(base + d, t + k * 0.045, big ? 0.13 : 0.09, 0.5, k % 2 ? "triangle" : "square"));
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
}
