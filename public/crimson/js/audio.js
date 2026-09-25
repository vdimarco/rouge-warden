// Every sound is made in the browser: clangs, whooshes, roars, and the taiko.
const rand = (a, b) => a + Math.random() * (b - a);
/* ------------------------------------------------------------------ audio */
export const Audio = {
  phase2: () => false,
  ctx: null, master: null, drumNext: 0, drumStep: 0, drumOn: false,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind across the grass
    const w = ctx.createBufferSource(); w.buffer = buf; w.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    w.connect(f); f.connect(g); g.connect(this.master); w.start();
    setInterval(() => this.schedule(), 40);
  },
  env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  noiseHit(t, type, freq, q, peak, dec, sweepTo) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dec);
    const g = ctx.createGain(); this.env(g, t, 0.004, peak, dec);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dec + 0.1);
  },
  tone(t, type, f0, f1, peak, dec, a = 0.004) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec);
    const g = ctx.createGain(); this.env(g, t, a, peak, dec); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dec + 0.05);
  },
  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'slash': this.noiseHit(t, 'bandpass', 3200, 1.2, 0.35, 0.16, 700); break;
      case 'heavy': this.noiseHit(t, 'bandpass', 1800, 1, 0.5, 0.3, 300); break;
      case 'bossSwing': this.noiseHit(t, 'bandpass', 900, 0.8, 0.6, 0.42, 160); break;
      case 'clang':
        [1180, 1735, 2410, 3180, 4870].forEach((f, i) => this.tone(t, 'sine', f * rand(0.98, 1.02), 0, 0.2 / (i * 0.5 + 1), 0.9 - i * 0.12));
        this.noiseHit(t, 'highpass', 3000, 0.7, 0.5, 0.06);
        this.tone(t, 'sine', 140, 60, 0.5, 0.18);
        break;
      case 'block':
        [640, 1010, 1530].forEach((f, i) => this.tone(t, 'triangle', f * rand(0.97, 1.03), 0, 0.18 / (i + 1), 0.28));
        this.noiseHit(t, 'bandpass', 1500, 1, 0.4, 0.08);
        break;
      case 'hit': this.noiseHit(t, 'lowpass', 600, 1, 0.8, 0.14); this.tone(t, 'sine', 120, 45, 0.7, 0.2); break;
      case 'cut': this.noiseHit(t, 'bandpass', 1200, 2, 0.5, 0.12, 400); this.tone(t, 'sine', 90, 40, 0.5, 0.16); break;
      case 'hurt': this.noiseHit(t, 'lowpass', 400, 1, 0.9, 0.2); this.tone(t, 'sine', 90, 35, 0.9, 0.3); break;
      case 'slam': this.tone(t, 'sine', 70, 26, 1.0, 0.9); this.noiseHit(t, 'lowpass', 260, 0.7, 1.0, 0.8); break;
      case 'glint': this.tone(t, 'sine', 2600, 3400, 0.12, 0.25); this.tone(t, 'sine', 3900, 0, 0.06, 0.3); break;
      case 'tell': this.tone(t, 'sawtooth', 220, 110, 0.25, 0.5); this.tone(t, 'sine', 55, 40, 0.8, 0.6); this.tone(t + 0.02, 'triangle', 1760, 1600, 0.15, 0.4); break;
      case 'roar': {
        const ctx = this.ctx, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.setValueAtTime(95, t); o2.frequency.setValueAtTime(99, t);
        o1.frequency.exponentialRampToValueAtTime(62, t + 1.7); o2.frequency.exponentialRampToValueAtTime(58, t + 1.7);
        f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1100, t + 0.4); f.frequency.linearRampToValueAtTime(260, t + 1.8);
        lfo.frequency.value = 9; lg.gain.value = 8; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        this.env(g, t, 0.15, 0.55, 1.7);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
        [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + 2); });
        this.noiseHit(t, 'bandpass', 500, 0.8, 0.35, 1.5, 200);
        break;
      }
      case 'punch': this.noiseHit(t, 'bandpass', 1400, 1, 0.45, 0.12, 500); break;
      case 'thud': this.noiseHit(t, 'lowpass', 500, 1, 0.9, 0.12); this.tone(t, 'sine', 140, 50, 0.8, 0.16); break;
      case 'growl': {
        const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(58, t + 0.9);
        f.type = 'lowpass'; f.frequency.value = 420; lfo.frequency.value = 23; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
        this.env(g, t, 0.08, 0.4, 0.9); o.connect(f); f.connect(g); g.connect(this.master);
        [o, lfo].forEach((x) => { x.start(t); x.stop(t + 1.1); });
        break;
      }
      case 'tear': for (let i = 0; i < 7; i++) this.noiseHit(t + i * 0.045 + Math.random() * 0.02, 'bandpass', 2400 + Math.random() * 1600, 2, 0.35, 0.05); break;
      case 'surge': this.tone(t, 'sawtooth', 110, 880, 0.12, 1.2, 0.3); this.tone(t, 'sine', 55, 30, 0.9, 1.5); this.noiseHit(t, 'highpass', 4000, 0.5, 0.25, 1.2); break;
      case 'dodge': this.noiseHit(t, 'bandpass', 700, 0.9, 0.25, 0.22, 300); break;
      case 'drink': [0, 0.18, 0.36].forEach((d) => this.tone(t + d, 'sine', 420, 180, 0.2, 0.1)); break;
      case 'broken': this.tone(t, 'sine', 330, 0, 0.3, 1.2); this.tone(t, 'sine', 495, 0, 0.2, 1.2); this.tone(t, 'sine', 55, 30, 0.8, 0.8); break;
      case 'deathblow': this.tone(t, 'sine', 60, 25, 1, 1.2); this.noiseHit(t, 'bandpass', 900, 1, 0.9, 0.5, 200); [880, 1320].forEach((f) => this.tone(t + 0.1, 'sine', f, 0, 0.15, 2)); break;
      case 'start': [392, 523, 784].forEach((f, i) => this.tone(t + i * 0.12, 'sine', f, 0, 0.18, 1.4)); break;
      case 'death': this.tone(t, 'sine', 110, 55, 0.6, 2.5, 0.2); this.tone(t, 'sine', 165, 80, 0.3, 2.5, 0.2); break;
      case 'victory': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(t + i * 0.22, 'sine', f, 0, 0.2, 2.2)); this.tone(t, 'sine', 65, 40, 0.8, 1.5); break;
    }
  },
  // the taiko keeps time while you fight
  schedule() {
    if (!this.ctx || !this.drumOn) return;
    const spb = 60 / (this.phase2() ? 104 : 84) / 4;
    const pat = [1, 0, 0, 0.3, 0, 0, 0.7, 0, 1, 0, 0.4, 0, 0, 0.5, 0.3, 0];
    if (this.drumNext < this.ctx.currentTime) this.drumNext = this.ctx.currentTime + 0.05;
    while (this.drumNext < this.ctx.currentTime + 0.15) {
      const v = pat[this.drumStep % 16] * (this.phase2() ? 1 : 0.75);
      if (v) { const t = this.drumNext; this.tone(t, 'sine', 92, 48, 0.55 * v, 0.35); this.noiseHit(t, 'lowpass', 700, 0.5, 0.18 * v, 0.05); }
      this.drumNext += spb; this.drumStep++;
    }
  },
};

