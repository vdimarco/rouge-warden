// Locally synthesized music, battle sound and announcer. Starts on a user gesture.
// Mix: sources -> (sfx | music) bus -> compressor -> speakers, with a shared reverb send.
const VOICE_KEY = 'tidebreak.voice';
// Recorded clips (see audio/CREDITS.md). Each falls back to synthesis until it has loaded.
export const CLIPS = {
  announcer: ['first-blood', 'double-kill', 'triple-kill', 'mayhem', 'rampage', 'killing-spree', 'dominating', 'mega-kill', 'ownage', 'massacre', 'carnage', 'godlike', 'choose-your-character', 'prepare-yourself', 'fight', 'you-win', 'you-lose', 'flawless-victory', 'multi-kill', 'game-over'],
  sfx: ['punch-1', 'punch-2', 'punch-heavy-1', 'punch-heavy-2', 'metal', 'metal-heavy', 'bell', 'crumble', 'plate-heavy', 'body-fall', 'wood-heavy', 'glass', 'coins', 'draw-blade', 'ui-tick', 'ui-confirmation', 'ui-select', 'ui-glass', 'ui-pluck', 'ui-error'],
};
const CLIP_BASE = new URL('./audio/', import.meta.url);
// Orchestral score (CC0, see audio/CREDITS.md). Each scene streams its own tracks.
export const TRACKS = {
  menu: { file: 'menu-legend-will-rise', loop: true },
  draft: { file: 'draft-prepare-to-fight', loop: true },
  calm: { file: 'match-unexplored', loop: true },
  battle: { file: 'battle-determined-pursuit', loop: true },
  victory: { file: 'victory', loop: false },
  defeat: { file: 'defeat-lament', loop: false },
};
export const SCENES = { menu: ['menu'], draft: ['draft'], match: ['calm', 'battle'], victory: ['victory'], defeat: ['defeat'] };
const MUSIC_LEVEL = .62, BATTLE_HOLD = 7;
export class Sound {
  constructor() {
    this.on = true; this.voiceOn = true; this.musicOn = true; this.scene = 'menu'; this.tracks = new Map(); this.battleMix = 0; this.fightAt = -99; this.hidden = false;
    try { this.on = localStorage.getItem('tidebreak.sound') !== 'off'; this.voiceOn = localStorage.getItem(VOICE_KEY) !== 'off'; this.musicOn = localStorage.getItem('tidebreak.music') !== 'off'; } catch {}
    this.context = null; this.note = 0; this.next = 0; this.beat = 0; this.intensity = 0;
    this.listener = { x: 0, y: 0, span: 1400 }; this.lastAt = {}; this.buffers = new Map(); this.loading = false;
  }
  start() {
    try {
      const wasRunning = this.context?.state === 'running';
      if (!this.context) {
        const c = this.context = new (window.AudioContext || window.webkitAudioContext)();
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .22;
        this.master = c.createGain(); this.master.gain.value = .95; this.master.connect(comp).connect(c.destination);
        this.sfx = c.createGain(); this.sfx.connect(this.master);
        this.music = c.createGain(); this.music.gain.value = 1; this.music.connect(this.master);
        this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.6); this.wet = c.createGain(); this.wet.gain.value = .32; this.reverb.connect(this.wet).connect(this.master);
        const n = c.sampleRate * 2, buffer = c.createBuffer(1, n, c.sampleRate), d = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
        // A meter on the game's own output, for the Test sound button.
        this.meter = c.createAnalyser(); this.meter.fftSize = 512; this.master.connect(this.meter);
        // Chrome reports a lost output device (unplugged, or a monitor turned off) as an error on the context. The next
        // tap or key then builds a new context on the current default device.
        c.addEventListener?.('error', () => this.lost());
      }
      const first = !this.loading;
      this.context.resume().catch(() => {});
      this.loadClips();
      // A context that was not running, or a track the browser refused, gets its scene started again in this gesture.
      if (first || !wasRunning || this.scoreBlocked()) this.setScene(this.scene);
      this.unlock();
    } catch {}
  }
  lost() {
    try { this.context?.close(); } catch {}
    for (const t of this.tracks.values()) t.el.pause();
    this.context = null; this.loading = false; this.unlocked = false; this.tracks.clear(); this.buffers.clear();
    // Times kept from the old context's clock would hold the new one silent (throttle) or the battle music up.
    this.lastAt = {}; this.fightAt = -99; this.battleMix = 0;
  }
  // Safari, and Chrome on a site without earlier engagement, let a media element start only from a user gesture. The
  // first gesture starts and at once pauses every track that is not playing yet, so later scenes can start them from
  // timers (the draft ending, a victory).
  unlock() {
    if (this.unlocked || !this.context || !this.on || !this.musicOn || navigator.userActivation?.isActive === false) return;
    const active = SCENES[this.scene] || [];
    for (const name of Object.keys(TRACKS)) {
      if (active.includes(name)) continue;
      const t = this.track(name); if (!t) continue;
      t.el.play()?.catch?.(() => {}); t.el.pause();
    }
    this.unlocked = true;
  }
  scoreBlocked() { return (SCENES[this.scene] || []).some(name => this.tracks.get(name)?.blocked); }
  // Plays a test chime and measures the game's own output. The result says whether the game is making sound, so the
  // player knows to look outside the game (a muted tab, the system mixer, the output device) when they hear nothing.
  async test() {
    this.start();
    if (!this.context) return { state: 'unavailable', peak: 0 };
    try { await Promise.race([this.context.resume(), new Promise(resolve => setTimeout(resolve, 500))]); } catch {}
    if (this.context.state !== 'running') return { state: this.context.state, peak: 0 };
    if (!this.on) return { state: 'muted', peak: 0 };
    if (!this.clip('bell', { gain: 1 })) this.chord([523.25, 659.25, 783.99], .7, .07);
    const m = this.meter, data = new Float32Array(m.fftSize); let peak = 0;
    for (let i = 0; i < 14; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (m.getFloatTimeDomainData) m.getFloatTimeDomainData(data); else { const b = new Uint8Array(m.fftSize); m.getByteTimeDomainData(b); b.forEach((v, j) => { data[j] = (v - 128) / 128; }); }
      for (const v of data) peak = Math.max(peak, Math.abs(v));
    }
    return { state: 'running', peak };
  }
  loadClips() {
    if (this.loading || !this.context || typeof fetch !== 'function') return; this.loading = true;
    for (const [folder, names] of Object.entries(CLIPS)) for (const name of names)
      fetch(new URL(`${folder}/${name}.mp3`, CLIP_BASE)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(data => this.context.decodeAudioData(data)).then(buffer => this.buffers.set(name, buffer)).catch(() => {});
  }
  // Plays a loaded clip and returns true; returns false so callers can synthesize instead.
  clip(name, { gain = 1, pan = 0, rate = 1, delay = 0, reverb = 0, bus } = {}) {
    const buffer = this.buffers.get(name); if (!this.ready || !buffer) return false;
    const c = this.context, source = c.createBufferSource(), g = c.createGain();
    source.buffer = buffer; source.playbackRate.value = rate; g.gain.value = gain;
    source.connect(g); this.route(g, { pan, reverb, bus }); source.start(c.currentTime + delay);
    return buffer.duration / rate;
  }
  impulse(seconds) {
    const c = this.context, n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  get ready() { const c = this.context; return !!(c && this.on && c.state === 'running'); }
  // Route a voice through an optional stereo pan and reverb send.
  route(node, { pan = 0, reverb = 0, bus } = {}) {
    const c = this.context; let out = node;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); out = p; }
    out.connect(bus || this.sfx);
    if (reverb) { const send = c.createGain(); send.gain.value = reverb; out.connect(send).connect(this.reverb); }
  }
  tone(hz, duration = .1, volume = .035, type = 'sine', end, delay = 0, opts = {}) {
    if (!this.ready) return; const c = this.context;
    const at = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(hz, at); if (end) o.frequency.exponentialRampToValueAtTime(end, at + duration);
    if (opts.detune) o.detune.value = opts.detune;
    g.gain.setValueAtTime(.0001, at); g.gain.linearRampToValueAtTime(volume, at + (opts.attack ?? .006)); g.gain.exponentialRampToValueAtTime(.0001, at + duration);
    o.connect(g); this.route(g, opts); o.start(at); o.stop(at + duration + .02);
  }
  noise(duration = .2, volume = .05, { type = 'bandpass', freq = 1200, end, q = 1, delay = 0, attack = .004, ...opts } = {}) {
    if (!this.ready) return; const c = this.context;
    const at = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuffer; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, at); if (end) f.frequency.exponentialRampToValueAtTime(end, at + duration); f.Q.value = q;
    g.gain.setValueAtTime(.0001, at); g.gain.linearRampToValueAtTime(volume, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + duration);
    s.connect(f).connect(g); this.route(g, opts); s.start(at, Math.random()); s.stop(at + duration + .02);
  }
  chord(notes, duration, volume, type = 'triangle', delay = 0, opts = {}) { notes.forEach((hz, i) => this.tone(hz, duration, volume, type, null, delay + i * (opts.spread || 0), { reverb: .5, ...opts, detune: (i % 2 ? 6 : -6) })); }
  // Spatial helpers: world point -> pan and gain from the camera.
  setListener(x, y, span = 1400) { this.listener = { x, y, span }; }
  spatial(x, y) {
    const l = this.listener, dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
    return { pan: Math.max(-.9, Math.min(.9, dx / l.span)), gain: Math.max(.05, Math.min(1, 1 - (d - l.span * .45) / (l.span * 2.2))), far: d > l.span * .8 };
  }
  throttle(key, gap, now = this.context?.currentTime ?? 0) { if (now < (this.lastAt[key] ?? -9)) return false; this.lastAt[key] = now + gap; return true; }

  // ---- Score: recorded tracks per scene. In a match the battle track rises with the fighting.
  track(name) {
    if (this.tracks.has(name)) return this.tracks.get(name);
    const spec = TRACKS[name], el = new Audio(new URL(`music/${spec.file}.mp3`, CLIP_BASE).href);
    el.loop = spec.loop; el.preload = 'auto';
    const gain = this.context.createGain(); gain.gain.value = 0;
    try { this.context.createMediaElementSource(el).connect(gain).connect(this.music); } catch { return null; }
    const entry = { el, gain, level: 0 }; this.tracks.set(name, entry); return entry;
  }
  setScene(scene) {
    const changed = scene !== this.scene; this.scene = scene;
    if (!this.context || !this.on || !this.musicOn) { this.pauseMusic(); return; }
    const active = SCENES[scene] || [];
    for (const name of Object.keys(TRACKS)) {
      const t = active.includes(name) ? this.track(name) : this.tracks.get(name); if (!t) continue;
      if (active.includes(name)) {
        if (changed && !TRACKS[name].loop) t.el.currentTime = 0;
        // A refused play() is remembered, so the next tap or key retries it. A finished fanfare is not replayed.
        if (!this.hidden && !(t.el.ended && !changed)) t.el.play().then(() => { t.blocked = false; }, e => { t.blocked = e?.name === 'NotAllowedError'; });
      }
      else this.fade(t, 0, () => { if (!(SCENES[this.scene] || []).includes(name)) t.el.pause(); });
    }
    if (changed && scene === 'match') { this.battleMix = 0; this.fightAt = -99; for (const name of active) { const t = this.tracks.get(name); if (t) t.el.currentTime = 0; } }
    this.updateMusic(true);
  }
  fade(t, level, done) {
    const now = this.context.currentTime; t.level = level; t.gain.gain.cancelScheduledValues(now); t.gain.gain.setTargetAtTime(level, now, level ? .5 : .35);
    if (done) setTimeout(done, 1600);
  }
  // Called every frame. The battle layer holds for a few seconds after the last clash.
  updateMusic(force = false) {
    if (!this.context || !this.musicOn || !this.on) return;
    const now = this.context.currentTime, active = SCENES[this.scene] || [];
    if (this.scene === 'match') {
      if (this.intensity > .32) this.fightAt = now;
      const target = now - this.fightAt < BATTLE_HOLD ? 1 : 0;
      this.battleMix += (target - this.battleMix) * (target ? .05 : .012);
    }
    for (const name of active) {
      const t = this.tracks.get(name); if (!t) continue;
      const level = MUSIC_LEVEL * (name === 'battle' ? this.battleMix : name === 'calm' ? 1 - this.battleMix * .9 : 1);
      if (force || Math.abs(level - t.level) > .02) this.fade(t, level);
    }
  }
  playingScore() { return (SCENES[this.scene] || []).some(name => { const t = this.tracks.get(name); return t && !t.el.paused && t.el.readyState >= 2; }); }
  pauseMusic() { for (const t of this.tracks.values()) t.el.pause(); }
  setHidden(hidden) { this.hidden = hidden; if (hidden) this.pauseMusic(); else this.setScene(this.scene); }
  toggleMusic() { this.musicOn = !this.musicOn; try { localStorage.setItem('tidebreak.music', this.musicOn ? 'on' : 'off'); } catch {} this.setScene(this.scene); return this.musicOn; }
  // Fallback score: a minor arpeggio with drums, used only while no recorded track plays.
  tick(time) {
    this.updateMusic();
    if (time < this.next) return; this.next = time + .48;
    if (!this.musicOn || this.playingScore()) return;
    const notes = [146.83, 220, 293.66, 349.23, 293.66, 220, 174.61, 130.81];
    // Loud enough to be heard as music while a recorded track cannot play.
    this.tone(notes[this.note++ % notes.length], .9, .04 + this.intensity * .016, 'triangle', null, 0, { bus: this.music, reverb: .2 });
    const i = this.intensity, beat = this.beat++, b = beat % 4;
    if (i > .15 && (b === 0 || (i > .55 && b === 2))) { this.tone(92, .32, .05 * i, 'sine', 42, 0, { bus: this.music }); this.noise(.08, .012 * i, { freq: 160, type: 'lowpass', bus: this.music }); }
    if (i > .5 && b % 2) this.noise(.12, .016 * i, { freq: 2300, q: .7, bus: this.music, reverb: .1 });
    if (beat % 16 === 0) this.tone(73.4, 3.2, .012 + i * .01, 'sawtooth', null, 0, { bus: this.music, attack: .8, reverb: .4 });
  }
  setIntensity(target) { this.intensity += (Math.max(0, Math.min(1, target)) - this.intensity) * .08; }

  // ---- Player combat.
  hit(variant = 0, hero = 0) {
    const pitch = [1, .6, .85, 1.12, .68, .88, 1.3, .55, 1.2, .95, 1.05, .8][hero] || 1;
    this.tone([340, 430, 220][variant] * pitch, [.11, .14, .21][variant], variant === 2 ? .03 : .02, hero === 7 ? 'sine' : 'triangle', [105, 160, 65][variant] * pitch);
    this.noise([.06, .07, .12][variant], variant === 2 ? .07 : .045, { freq: [2600, 2100, 1300][variant] * pitch, end: 500, q: 1.3 });
    if (variant === 2) this.tone(70, .2, .05, 'sine', 40);
    this.clip(variant === 2 ? `punch-heavy-${1 + (hero % 2)}` : `punch-${1 + variant}`, { gain: variant === 2 ? .55 : .38, rate: .85 + pitch * .15 });
  }
  skill(slot, hero = 0) {
    const roots = [310, 145, 250, 190, 120, 420, 540, 95, 660, 330, 470, 175], root = roots[hero] || 310, interval = [1, 1.5, 1.25, .5][slot] || 1, type = [0, 3, 7, 11].includes(hero) ? 'triangle' : 'sine';
    this.tone(root * interval, slot === 3 ? .45 : .26, .034, type, root * ([1, 4, 6, 9].includes(hero) ? 2.3 : .55), 0, { reverb: .25 });
    this.noise(slot === 3 ? .55 : .3, .05, { freq: 600, end: slot === 3 ? 3800 : 2400, q: 2, reverb: .3 });
    if (slot === 3) { this.tone(root * 1.5, .32, .024, 'triangle', root * 2, .07, { reverb: .5 }); this.tone(55, .7, .07, 'sine', 35, 0); }
  }
  feedback(event) {
    if (event.type === 'combo') { this.tone(590, .13, .033, 'triangle', 760); this.tone(880, .18, .024, 'sine', 1050, .07, { reverb: .3 }); }
    else if (event.type === 'shield-break') { this.tone(1000, .2, .025, 'triangle', 160); this.tone(1420, .12, .016, 'sine', 330, .025); this.noise(.18, .05, { freq: 5200, q: 3 }); }
    else if (event.type === 'interrupt') { this.tone(390, .16, .03, 'triangle', 90); }
    else if (event.type === 'kill') { this.tone(330, .28, .03, 'triangle', 440); this.tone(660, .28, .022, 'sine', 880, .09, { reverb: .4 }); }
    else if (event.type === 'exposed') { this.tone(250, .18, .025, 'triangle', 120); this.tone(500, .13, .018, 'sine', 270, .025); }
    else if (event.type === 'dodge') { this.noise(.22, .04, { freq: 900, end: 3600, q: 1.4 }); this.tone(660, .12, .016, 'sine', 990, .04); }
  }
  syncFeedback(state, p) {
    if (this.feedbackState !== state) { this.feedbackState = state; this.feedbackSeen = new Set(); this.feedbackAt = -1; }
    const events = (state.combatFeedback || []).filter(e => !this.feedbackSeen.has(e.id));
    for (const e of events) this.feedbackSeen.add(e.id);
    // One result sound per update keeps a group hit from masking the next warning.
    const priority = { kill: 5, interrupt: 4, 'shield-break': 3, combo: 2, dodge: 2, exposed: 1 };
    const event = events.filter(e => state.time - e.time <= .3 && (e.source === p.id || e.target === p.id)).sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0))[0];
    if (event && state.time >= this.feedbackAt + .09) { this.feedback(event); this.feedbackAt = state.time; }
    if (this.feedbackSeen.size > 128) this.feedbackSeen = new Set((state.combatFeedback || []).map(e => e.id));
  }

  // ---- Battlefield sounds at a world position.
  worldHit(x, y, heavy = false) { const s = this.spatial(x, y); if (s.gain < .08) return; this.clip(heavy ? 'punch-heavy-1' : Math.random() < .5 ? 'punch-1' : 'punch-2', { gain: .22 * s.gain, pan: s.pan, rate: .9 + Math.random() * .2 }); this.noise(heavy ? .12 : .06, (heavy ? .045 : .028) * s.gain, { freq: heavy ? 1400 : 2400, end: 500, q: 1.2, pan: s.pan }); this.tone(heavy ? 160 : 260, .1, .012 * s.gain, 'triangle', 90, 0, { pan: s.pan }); }
  worldCast(x, y, ultimate = false) { const s = this.spatial(x, y); if (s.gain < .08) return; this.noise(ultimate ? .5 : .28, .035 * s.gain, { freq: 500, end: ultimate ? 3200 : 2000, q: 2.2, pan: s.pan, reverb: .35 }); if (ultimate) this.tone(62, .6, .05 * s.gain, 'sine', 38, 0, { pan: s.pan }); }
  // ---- Combat feel: tells, commits, impacts and damage taken.
  // A rising swell as long as the enemy windup, panned to the caster. Brighter when it is aimed at you.
  windup(x, y, { ult = false, neutral = false, aimed = false, duration = .5 } = {}) {
    const s = this.spatial(x, y), g = (aimed ? Math.max(.55, s.gain) * 1.25 : s.gain * .8), d = Math.max(.3, Math.min(.9, duration));
    if (g < .12 || !this.throttle('windup', .1)) return;
    const root = neutral ? 110 : ult ? 147 : 196;
    this.tone(root, d, .03 * g, 'sawtooth', root * (aimed ? 2.6 : 2), 0, { pan: s.pan, attack: d * .8, reverb: .25 });
    this.noise(d, .035 * g, { freq: 500, end: aimed ? 4200 : 2600, q: 3, pan: s.pan, attack: d * .85 });
    if (ult || neutral) this.tone(root / 2, d, .04 * g, 'sine', root, 0, { pan: s.pan, attack: d * .7 });
  }
  // Two short beeps: a tower has locked on to you and fires when the line turns solid.
  lockOn(x, y) { const s = this.spatial(x, y); if (!this.throttle('lock', .3)) return; this.tone(1760, .07, .03, 'square', null, 0, { pan: s.pan }); this.tone(1760, .07, .03, 'square', null, .12, { pan: s.pan }); this.tone(2093, .1, .025, 'square', null, .24, { pan: s.pan, reverb: .2 }); }
  // A quiet click when your own cast starts its windup.
  commit() { this.noise(.035, .05, { freq: 3400, q: 4 }); this.tone(1900, .04, .012, 'triangle', 1200); }
  // Damage you take: a thud scaled by the share of health lost.
  hurt(share) { if (!this.throttle('hurt', .14)) return; const v = Math.min(1, share * 5); this.tone(120, .16, .02 + .05 * v, 'sine', 55); this.noise(.12, .02 + .05 * v, { type: 'lowpass', freq: 900, end: 200 }); if (v > .5) this.clip('punch-heavy-2', { gain: .35 * v, rate: .7 }); }
  // A heavy contact at a hitstop moment.
  impact(weight, x, y) { const s = this.spatial(x, y), w = Math.max(1, Math.min(3, weight)); this.tone(70 - w * 8, .18 + w * .05, .04 + w * .015, 'sine', 32, 0, { pan: s.pan }); this.noise(.08 + w * .03, .04 + w * .015, { freq: 1600, end: 300, q: 1, pan: s.pan }); }
  // A gold chime for a last hit.
  lastHit() { this.tone(1568, .12, .022, 'triangle', null, 0, { reverb: .2 }); this.tone(2349, .2, .018, 'sine', null, .06, { reverb: .35 }); }
  heartbeat() { if (!this.throttle('heart', .85)) return; this.tone(62, .12, .06, 'sine', 45); this.tone(58, .12, .045, 'sine', 42, .2); }
  towerShot(x, y) { const s = this.spatial(x, y); if (s.gain < .1) return; this.tone(1180, .22, .02 * s.gain, 'sawtooth', 240, 0, { pan: s.pan, reverb: .3 }); this.noise(.16, .03 * s.gain, { freq: 3800, end: 900, q: 4, pan: s.pan }); }
  death(x, y, ally) {
    const s = this.spatial(x, y); this.clip('body-fall', { gain: .7 * Math.max(.3, s.gain), pan: s.pan, rate: .8, reverb: .3 });
    this.tone(ally ? 220 : 196, .9, .05 * s.gain, 'triangle', ally ? 110 : 98, 0, { pan: s.pan, reverb: .6 });
    this.tone(ally ? 261.6 : 155.6, .9, .03 * s.gain, 'sine', null, .08, { pan: s.pan, reverb: .6 });
    this.noise(.6, .05 * s.gain, { freq: 900, end: 180, q: .8, pan: s.pan, reverb: .5 });
  }
  minionPop(x, y) { const s = this.spatial(x, y); if (s.gain < .25 || !this.throttle('pop', .05)) return; this.tone(520, .09, .01 * s.gain, 'sine', 220, 0, { pan: s.pan }); }
  // A team fight beyond the camera: faint steel and shouts from its direction.
  distantClash(x, y) {
    const s = this.spatial(x, y), g = Math.max(.25, s.gain) * .6;
    for (let i = 0; i < 3; i++) this.noise(.07, .03 * g, { freq: 2600 + i * 700, end: 900, q: 2.5, delay: i * .11 + Math.random() * .05, pan: s.pan, reverb: .5 });
    this.tone(180, .18, .01 * g, 'triangle', 120, .05, { pan: s.pan, reverb: .5 });
  }
  structureFall(x, y) { const s = this.spatial(x, y), g = Math.max(.5, s.gain); this.clip('crumble', { gain: .9 * g, pan: s.pan, rate: .7, reverb: .5 }); this.clip('plate-heavy', { gain: .6 * g, pan: s.pan, rate: .6, delay: .25, reverb: .5 }); this.noise(1.8, .12 * g, { type: 'lowpass', freq: 900, end: 60, pan: s.pan, reverb: .6, attack: .02 }); this.tone(48, 1.6, .1 * g, 'sine', 30, 0, { pan: s.pan }); for (let i = 0; i < 5; i++) this.noise(.1, .04 * g, { freq: 400 + i * 230, q: 3, delay: .2 + i * .17, pan: s.pan }); }
  alarm(enemy = false) { // A bronze bell, twice.
    if (this.clip('bell', { gain: .8, rate: enemy ? .84 : .94, reverb: .5 })) { this.clip('bell', { gain: .6, rate: enemy ? .84 : .94, delay: .45, reverb: .5 }); return; }
    for (let i = 0; i < 2; i++) { const d = i * .42; [1, 2.76, 5.4].forEach((m, j) => this.tone((enemy ? 466 : 523) * m, 1.1 - j * .3, [.045, .02, .01][j], 'sine', null, d, { reverb: .55 })); }
  }
  ping(type, x, y) {
    const s = x === undefined ? { pan: 0 } : this.spatial(x, y);
    const notes = { fight: [880, 660], defend: [740, 554], rally: [660, 880, 1100], onmyway: [990, 1320], retreat: [520, 390], missing: [784, 622] }[type] || [880];
    if (this.clip('ui-glass', { gain: .5, pan: s.pan, rate: type === 'defend' ? .8 : type === 'retreat' ? .9 : 1.1, reverb: .3 })) return;
    notes.forEach((hz, i) => this.tone(hz, .16, .03, 'sine', null, i * .08, { pan: s.pan, reverb: .35 }));
  }
  chat() { if (this.clip('ui-pluck', { gain: .35, rate: 1.2 })) return; this.tone(1560, .06, .012, 'sine', 1900); this.tone(2080, .05, .008, 'sine', null, .045); }
  coin() { if (this.clip('coins', { gain: .7 })) return; this.tone(1320, .09, .02, 'square', null, 0); this.tone(1760, .16, .018, 'square', null, .06, { reverb: .3 }); }
  levelUp() { this.chord([523, 659, 784, 1047], .7, .022, 'triangle', 0, { spread: .07 }); }
  portal() { this.noise(.9, .07, { freq: 300, end: 4000, q: 4, reverb: .6 }); this.tone(220, .9, .03, 'sine', 880, 0, { reverb: .6 }); }
  respawn() { this.chord([392, 587, 784], 1.1, .02, 'sine', 0, { spread: .1 }); this.noise(1.1, .03, { freq: 5000, q: 2, reverb: .7, attack: .5 }); }
  realmShift(phase) { this.tone(phase ? 55 : 82, 3, .07, 'sawtooth', phase ? 41 : 110, 0, { attack: 1.2, reverb: .7 }); this.noise(3, .05, { type: 'lowpass', freq: phase ? 300 : 1500, end: phase ? 1800 : 260, attack: 1.2, reverb: .6 }); this.chord(phase ? [110, 130.8, 164.8] : [146.8, 185, 220], 2.6, .012, 'sine', .4, { attack: .9 }); }
  roar(x, y) { const s = x === undefined ? { pan: 0, gain: 1 } : this.spatial(x, y), g = Math.max(.6, s.gain); this.tone(75, 1.6, .09 * g, 'sawtooth', 48, 0, { pan: s.pan, reverb: .6, attack: .15 }); this.tone(112, 1.4, .05 * g, 'sawtooth', 66, .05, { pan: s.pan, detune: 15 }); this.noise(1.5, .08 * g, { freq: 380, end: 160, q: 1.5, pan: s.pan, reverb: .6, attack: .2 }); }
  horn() { this.tone(110, 2.1, .06, 'sawtooth', null, 0, { attack: .25, reverb: .7 }); this.tone(164.8, 1.9, .04, 'sawtooth', null, .1, { attack: .35, reverb: .7, detune: 8 }); this.tone(55, 2.2, .07, 'sine', null, 0, { attack: .3 }); this.tone(82.4, .4, .08, 'sine', 40, 1.6); }
  victory() { [[523, 659, 784], [587, 740, 880], [659, 831, 988, 1319]].forEach((c, i) => this.chord(c, i === 2 ? 2.4 : .55, .028, 'triangle', i * .45)); this.horn(); }
  defeat() { [[220, 261.6, 329.6], [196, 233, 293.7], [174.6, 207.7, 261.6]].forEach((c, i) => this.chord(c, i === 2 ? 2.6 : .7, .026, 'sine', i * .6)); this.tone(55, 3, .07, 'sine', 41, 1.2, { reverb: .7 }); }

  // ---- Draft.
  draftHover() { if (!this.clip('ui-tick', { gain: .45 })) this.tone(1240, .05, .012, 'sine', 1000); }
  draftLock(team = 0) { this.clip('metal-heavy', { gain: .45, rate: team ? .7 : .85, reverb: .4 }); this.clip('ui-confirmation', { gain: .35, rate: team ? .8 : 1 }); this.tone(team ? 196 : 262, .5, .055, 'triangle', team ? 98 : 131, 0, { reverb: .5 }); this.noise(.3, .07, { freq: 1700, end: 300, q: 1.5, reverb: .4 }); this.tone(team ? 392 : 523, .5, .02, 'sine', null, .04, { reverb: .5 }); }
  draftHorn() { this.horn(); }

  // ---- Announcer: a stinger for each call, and a spoken line when available.
  stinger(kind) {
    switch (kind) {
      case 'first-blood': this.tone(61.7, 1.8, .1, 'sine', 41, 0, { reverb: .5 }); this.chord([246.9, 311.1, 370], 1.6, .03, 'sawtooth', .05, { spread: .03 }); this.noise(1.2, .07, { freq: 300, end: 120, type: 'lowpass', reverb: .7 }); break;
      case 'multi': case 'streak': { const level = this.stingerLevel || 2, base = 220 * Math.pow(1.122, level); this.chord([base, base * 1.26, base * 1.5, base * 2], 1.1 + level * .1, .026, 'triangle', 0, { spread: .05 }); this.tone(base / 4, .9, .08, 'sine', base / 6); this.noise(.5, .05, { freq: 900, end: 5000, q: 2, reverb: .5 }); break; }
      case 'shutdown': this.tone(880, .5, .04, 'square', 110, 0, { reverb: .4 }); this.tone(55, .8, .09, 'sine', 35); break;
      case 'wipe': this.chord([196, 246.9, 293.7, 392], 1.8, .03, 'sawtooth', 0, { spread: .09 }); this.tone(49, 1.8, .1, 'sine', 35); break;
      case 'ally-down': this.chord([233, 277, 349], 1, .02, 'sine'); break;
      case 'enemy-down': this.chord([392, 494, 587], .6, .02, 'triangle'); break;
      case 'ward-fall': this.structureFall(this.listener.x, this.listener.y); this.chord([174.6, 207.7, 261.6], 1.6, .02, 'sine', .3); break;
      case 'ward-break': this.chord([392, 494, 587, 784], 1.2, .024, 'triangle', 0, { spread: .06 }); break;
      case 'defend': this.alarm(false); break;
    }
  }
  say(text, { priority = 1 } = {}) {
    const synth = typeof window !== 'undefined' && window.speechSynthesis;
    if (!this.on || !this.voiceOn || !synth || !text) return false;
    const voices = synth.getVoices(), english = voices.filter(v => /^en/i.test(v.lang));
    const voice = english.find(v => /Daniel|UK English Male|Google UK|Arthur|Fred|Male/i.test(v.name)) || english[0];
    if (!voice) return false;
    if (priority > 1 || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.pitch = .55; u.rate = .9; u.volume = 1;
    if (this.music && this.context) { const g = this.music.gain, t = this.context.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(.35, t, .05); u.onend = u.onerror = () => g.setTargetAtTime(1, this.context.currentTime, .3); }
    synth.speak(u); return true;
  }
  // Plays a recorded announcer line with the music ducked. Returns false if the clip is not loaded.
  voiceClip(name, delay = 0) {
    if (!this.voiceOn || !name) return false;
    const length = this.clip(name, { gain: 1.25, delay, reverb: .18 }); if (!length) return false;
    if (this.music) { const g = this.music.gain, t = this.context.currentTime + delay; g.cancelScheduledValues(t); g.setTargetAtTime(.3, t, .04); g.setTargetAtTime(1, t + length, .3); }
    return true;
  }
  announce(text, kind, { level = 2, priority = 1, clip } = {}) {
    if (!this.ready) return;
    this.stingerLevel = level; this.stinger(kind);
    const delay = kind === 'first-blood' || kind === 'wipe' ? .26 : .12;
    if (this.voiceClip(clip, delay)) return;
    setTimeout(() => this.say(text, { priority }), delay * 1000);
  }
  line(clip, text, delay = 0) { if (this.ready && !this.voiceClip(clip, delay)) setTimeout(() => this.say(text), delay * 1000); }
  silence() { try { window.speechSynthesis?.cancel(); } catch {} }
  toggle() { this.on = !this.on; try { localStorage.setItem('tidebreak.sound', this.on ? 'on' : 'off'); } catch {} if (!this.on) this.silence(); this.setScene(this.scene); return this.on; }
  toggleVoice() { this.voiceOn = !this.voiceOn; try { localStorage.setItem(VOICE_KEY, this.voiceOn ? 'on' : 'off'); } catch {} if (!this.voiceOn) this.silence(); return this.voiceOn; }
}
