// Every sound is made in the browser: clangs, whooshes, roars, and the taiko.
// The story adds its own sounds with define() and defineLoop(), plays them with play(name, {at, gain})
// (through a 3D panner when `at` is given), and moves the wind bed with setWind(). The arena's sounds are
// the same as ever.
const rand = (a, b) => a + Math.random() * (b - a);
// the arena's own sounds (play's switch below); the story can never redefine them
const ARENA_SOUNDS = new Set(['slash', 'heavy', 'bossSwing', 'clang', 'block', 'hit', 'cut', 'hurt', 'slam', 'glint', 'tell', 'roar', 'pipe', 'pvc', 'punch', 'thud', 'growl', 'tear', 'surge', 'dodge', 'drink', 'broken', 'deathblow', 'start', 'death', 'victory']);
/* ------------------------------------------------------------------ audio */
export const Audio = {
  phase2: () => false,
  ctx: null, master: null, drumNext: 0, drumStep: 0, drumOn: false,
  defs: {}, loopDefs: {}, wind: null, sfxBus: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    // Chapter links can create a suspended context before the first gesture.
    // Resume that same context when the player touches the game or presses a key.
    const unlock = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
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
    this.wind = { filter: f, gain: g, depth: lg, freq: 420, level: 0.05 }; // the story moves it by region
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    setInterval(() => this.schedule(), 40);
  },
  env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  noiseHit(t, type, freq, q, peak, dec, sweepTo, dest) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dec);
    const g = ctx.createGain(); this.env(g, t, 0.004, peak, dec);
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t, Math.random()); s.stop(t + dec + 0.1);
  },
  tone(t, type, f0, f1, peak, dec, a = 0.004, dest) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec);
    const g = ctx.createGain(); this.env(g, t, a, peak, dec); o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + a + dec + 0.05);
  },
  // a new sound: fn(ctx, t, out, opts) schedules it at time t into the node `out` (never an arena name)
  define(name, fn) { if (ARENA_SOUNDS.has(name)) throw new Error(`Audio.define: '${name}' is an arena sound`); this.defs[name] = fn; },
  // a new looping sound: fn(ctx, out, opts) starts it and returns { set(params), stop(fadeSec) }
  defineLoop(name, fn) { this.loopDefs[name] = fn; },
  // where a story sound goes: a gain (opts.gain), then a panner when opts.at is a world position
  route(opts = {}) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = opts.gain == null ? 1 : opts.gain;
    if (opts.at && Number.isFinite(opts.at.x)) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = opts.ref || 6; p.maxDistance = 400; p.rolloffFactor = opts.rolloff == null ? 1.2 : opts.rolloff;
      if (p.positionX) { p.positionX.value = opts.at.x; p.positionY.value = opts.at.y || 0; p.positionZ.value = opts.at.z; } else p.setPosition(opts.at.x, opts.at.y || 0, opts.at.z);
      g.connect(p); p.connect(opts.bus || this.sfxBus);
      g.panner = p;
    } else g.connect(opts.bus || this.sfxBus);
    return g;
  },
  // the listener's place and heading (the story moves it with the camera each frame)
  listen(pos, fwd, up) {
    const L = this.ctx && this.ctx.listener; if (!L) return;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = up ? up.x : 0; L.upY.value = up ? up.y : 1; L.upZ.value = up ? up.z : 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up ? up.x : 0, up ? up.y : 1, up ? up.z : 0); }
  },
  // the wind bed: its band (Hz) and level; the arena's is 420 Hz at 0.05
  setWind(freq = 420, level = 0.05, ramp = 1.5) {
    const w = this.wind; if (!w) return;
    const t = this.ctx.currentTime;
    w.filter.frequency.setTargetAtTime(freq, t, ramp / 3); w.gain.gain.setTargetAtTime(level, t, ramp / 3); w.depth.gain.setTargetAtTime(level * 0.7, t, ramp / 3);
    w.freq = freq; w.level = level;
  },
  // start a defined loop; without sound it hands back a handle that does nothing
  loop(name, opts = {}) {
    const def = this.loopDefs[name];
    if (!this.ctx || !def) return { set() {}, stop() {}, silent: true };
    const out = this.route(opts);
    const h = def(this.ctx, out, opts) || { set() {}, stop() {} };
    // Ambient builders start at zero; apply the requested starting level.
    if (h.set) h.set(opts);
    const stop = h.stop;
    h.stop = (fade = 0.25) => { if (h.stopped) return; h.stopped = true; const t = this.ctx.currentTime; out.gain.setTargetAtTime(0, t, Math.max(0.01, fade / 3)); if (stop) stop.call(h, fade); }; // the loop's own stop ends its sources after the fade
    const set = h.set;
    h.set = (p = {}) => { if (h.stopped) return; if (p.at && out.panner) { const P = out.panner; if (P.positionX) { P.positionX.value = p.at.x; P.positionY.value = p.at.y || 0; P.positionZ.value = p.at.z; } else P.setPosition(p.at.x, p.at.y || 0, p.at.z); } if (p.gain != null) out.gain.setTargetAtTime(p.gain, this.ctx.currentTime, 0.05); if (set) set.call(h, p); };
    return h;
  },
  play(name, opts) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const def = this.defs[name];
    if (def) { def(this.ctx, t + (opts && opts.delay || 0), this.route(opts), opts || {}); return; }
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
      case 'pipe': {
        // a roar blown down a PVC pipe: a growling buzz, shaped by the tube's hollow resonances
        const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), mix = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sawtooth'; o2.type = 'square';
        o.frequency.setValueAtTime(82, t); o.frequency.linearRampToValueAtTime(96, t + 0.35); o.frequency.exponentialRampToValueAtTime(64, t + 1.3);
        o2.frequency.setValueAtTime(41, t); o2.frequency.exponentialRampToValueAtTime(32, t + 1.3);
        lfo.frequency.value = 17; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
        o.connect(mix); o2.connect(mix);
        for (const [fr, q, amp] of [[240, 9, 1], [720, 8, 0.7], [1200, 7, 0.35]]) {
          const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q; bg.gain.value = amp;
          mix.connect(bp); bp.connect(bg); bg.connect(g);
        }
        this.env(g, t, 0.06, 1.6, 1.3); g.connect(this.master);
        [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + 1.5); });
        this.noiseHit(t, 'bandpass', 700, 3, 0.25, 1.1, 300);
        break;
      }
      case 'pvc': this.tone(t, 'triangle', 620, 380, 0.25, 0.12); this.tone(t + 0.05, 'triangle', 540, 300, 0.18, 0.1); break;
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
