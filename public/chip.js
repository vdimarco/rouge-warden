// Chip: a tiny 8-bit music player made with Web Audio, like an old console sound chip.
// Four voices: a lead pulse wave, a thin pulse for arpeggios, a triangle for the bass, and noise for drums.
// Three original songs: "arcade" (an upbeat anthem for the Cottage Arcade), "lake" (an epic overture
// for the Breath of the Lake title screen), and "drain" (a driving underground theme for Down the Drain). Usage: Chip.play("arcade"), Chip.stop(), Chip.setOn(bool).
(function () {
  const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const midi = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return m ? NOTE[m[1]] + (+m[2] + 1) * 12 : null; };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // "E5/2 G5/2 C6/4 r/4" -> [[midi, steps], ...]; r is a rest
  const line = (s) => s.trim().split(/\s+/).map((t) => { const [n, l] = t.split("/"); return [n === "r" ? null : midi(n), +(l || 1)]; });
  // chord name -> midi notes of the triad in octave 4
  const chord = (c) => { const m = /^([A-G][#b]?)(m?)$/.exec(c); const r = NOTE[m[1]] + 60; return [r, r + (m[2] ? 3 : 4), r + 7]; };

  const SONGS = {
    // The Cottage Arcade: bright, fast, a little heroic. C major, 148 beats a minute.
    arcade: {
      bpm: 148, lead: 0.1, drums: "rock",
      chords: "C G Am F C G F G Am F C G Am F G G",
      melody: [
        "E5/2 G5/2 C6/4 B5/2 G5/2 E5/4", "D5/2 G5/2 B5/4 A5/2 G5/2 D5/4", "C5/2 E5/2 A5/4 G5/2 E5/2 C5/2 E5/2", "F5/4 A5/4 G5/4 F5/2 E5/2",
        "E5/2 G5/2 C6/2 D6/2 E6/4 D6/2 C6/2", "B5/4 G5/2 A5/2 B5/4 D6/4", "C6/2 A5/2 F5/4 A5/2 C6/2 F6/4", "E6/4 D6/4 B5/4 G5/4",
        "A5/6 C6/2 B5/4 A5/4", "F5/6 A5/2 G5/4 F5/4", "E5/2 F5/2 G5/4 C6/4 G5/4", "B5/6 A5/2 G5/4 D5/4",
        "A5/2 B5/2 C6/4 E6/4 C6/4", "F6/4 E6/2 D6/2 C6/4 A5/4", "B5/2 C6/2 D6/4 G6/4 D6/4", "G6/8 D6/4 B5/4",
      ],
    },
    // Down the Drain: a driving underground theme in A minor, 132 beats a minute.
    drain: {
      bpm: 132, lead: 0.095, drums: "rock",
      intro: { chords: "Am E", melody: ["A4/4 r/4 A4/2 C5/2 E5/4", "G#4/4 r/4 G#4/2 B4/2 E5/4"] },
      chords: "Am F G Em Am F E E F G Am Am Dm Em F E",
      melody: [
        "A4/2 C5/2 E5/4 A5/4 G5/2 E5/2", "F5/4 E5/2 C5/2 A4/8", "G4/2 B4/2 D5/4 G5/4 F5/2 D5/2", "E5/12 B4/4",
        "A5/2 A5/2 G5/2 A5/2 C6/4 A5/4", "C6/4 A5/2 F5/2 A5/8", "G#5/4 B5/4 E6/4 D6/2 B5/2", "G#5/8 E5/4 r/4",
        "F5/2 A5/2 C6/4 F6/4 E6/2 C6/2", "D6/4 B5/2 G5/2 D6/4 G6/4", "E6/6 C6/2 A5/4 E5/4", "A5/2 B5/2 C6/2 D6/2 E6/8",
        "F6/4 E6/2 D6/2 A5/8", "G5/4 E6/4 D6/2 B5/2 G5/4", "A5/4 C6/4 F6/4 E6/2 D6/2", "E6/8 G#5/4 B5/4",
      ],
    },
    // Breath of the Lake: a fanfare, then a broad adventure theme. D major, 104 beats a minute.
    lake: {
      bpm: 104, lead: 0.09, drums: "march",
      intro: { chords: "D D G A", melody: ["D5/2 D5/2 D5/2 A5/10", "F#5/2 F#5/2 F#5/2 D6/10", "B5/2 B5/2 B5/2 G6/6 F#6/2 E6/2", "E6/12 r/4"] },
      chords: "D Bm G A D F#m G A Bm G D A G A D D",
      melody: [
        "A4/4 D5/2 E5/2 F#5/6 A5/2", "F#5/4 E5/2 D5/2 B4/8", "D5/4 G5/4 F#5/2 E5/2 D5/4", "C#5/4 E5/4 A5/8",
        "A5/4 D6/2 C#6/2 D6/6 A5/2", "C#6/4 A5/2 F#5/2 A5/8", "B5/4 D6/2 C#6/2 B5/4 G5/4", "A5/12 E5/2 A5/2",
        "B5/6 A5/2 F#5/4 D5/4", "G5/6 A5/2 B5/4 D6/4", "A5/6 F#5/2 D5/4 F#5/4", "E5/8 C#5/4 E5/4",
        "D5/2 E5/2 G5/4 B5/4 D6/4", "C#6/4 E6/4 A6/4 G6/2 E6/2", "F#6/12 E6/2 D6/2", "D6/8 r/4 A4/4",
      ],
    },
  };
  // turn a song into one list of bars: each bar has a chord and a melody line of 16 steps
  function bars(song) {
    const out = [];
    const add = (chords, mel, intro) => chords.split(" ").forEach((c, i) => out.push({ chord: c, mel: line(mel[i]), intro }));
    if (song.intro) add(song.intro.chords, song.intro.melody, true);
    add(song.chords, song.melody, false);
    return out;
  }

  let ctx = null, out = null, on = true, cur = null, timer = null, pulse = {}, noiseBuf = null;
  try { on = JSON.parse(localStorage.getItem("arcade.sound") ?? "true"); } catch (e) { /* storage off */ }
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return !!ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = on ? 0.5 : 0;
    // a gentle low-pass takes the harsh edge off the square waves
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    out.connect(lp).connect(ctx.destination);
    // pulse waves with the classic 25% and 12.5% duty cycles
    for (const d of [0.25, 0.125]) {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
      pulse[d] = ctx.createPeriodicWave(re, im);
    }
    const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }
  function voice(wave, f, t, dur, vol, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (typeof wave === "string") o.type = wave; else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    // a short attack and a small decay, like a hardware envelope
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.8, t + Math.min(dur * 0.4, 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(t, dur, vol, freq, type = "highpass") {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // one bar of music, starting at time t
  function playBar(song, bar, t) {
    const step = 60 / song.bpm / 4;
    // lead melody, with a little vibrato on long notes
    let s = 0;
    for (const [m, l] of bar.mel) {
      if (m != null) {
        const f = hz(m), d = l * step * 0.92;
        voice(pulse[0.25], f, t + s * step, d, song.lead);
        if (l >= 6) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 5.5; g.gain.value = f * 0.006; o.connect(g); o.start(t + s * step + 0.15); o.stop(t + s * step + d); }
        // a quiet echo one octave down on the thin pulse, for body
        voice(pulse[0.125], f / 2, t + s * step, d * 0.9, song.lead * 0.28);
      }
      s += l;
    }
    const tri = chord(bar.chord), root = tri[0] - 24;
    // bass: the root, the octave, and the fifth, in eighth notes
    const bassPat = song.drums === "march" ? [0, null, 12, 0, 7, null, 12, 7] : [0, 12, 0, 12, 7, 12, 0, 12];
    bassPat.forEach((iv, k) => { if (iv != null) voice("triangle", hz(root + iv), t + k * 2 * step, step * 1.8, 0.2); });
    // arpeggio: the chord broken into sixteenth notes, soft
    if (!bar.intro) for (let k = 0; k < 16; k++) { const n = tri[[0, 1, 2, 1][k % 4]] + (k % 8 >= 4 ? 12 : 0); voice(pulse[0.125], hz(n), t + k * step, step * 0.7, 0.025); }
    else voice(pulse[0.125], hz(tri[0] + 12), t, step * 15, 0.035);
    // drums
    for (let k = 0; k < 16; k++) {
      const at = t + k * step;
      if (song.drums === "rock") {
        if (k % 8 === 0) voice("sine", 150, at, 0.14, 0.35, 45);
        if (k % 8 === 4) hit(at, 0.12, 0.2, 1800);
        if (k % 2 === 0) hit(at, 0.03, 0.06, 7000);
      } else {
        // a march: a timpani roll to open each bar, snare on the off beats, rolls before the fanfare lands
        if (k === 0) voice("triangle", hz(root + 12), at, 0.45, 0.28, hz(root + 5));
        if (k === 8) voice("sine", 110, at, 0.2, 0.25, 50);
        if (k % 8 === 4) hit(at, 0.1, 0.13, 2200);
        if (bar.intro && k >= 12) hit(at, 0.05, 0.08, 2600);
        if (k % 4 === 2) hit(at, 0.025, 0.035, 8000);
      }
    }
  }
  function play(name) {
    if (!SONGS[name]) return;
    if (cur && cur.name === name) { init(); return; }
    stop();
    if (!init()) return;
    const song = SONGS[name], list = bars(song), barLen = (60 / song.bpm) * 4;
    const loopFrom = list.findIndex((b) => !b.intro);
    cur = { name, i: 0, next: ctx.currentTime + 0.1 };
    // schedule a little ahead of time, one bar at a time
    timer = setInterval(() => {
      if (!cur) return;
      while (cur.next < ctx.currentTime + 0.4) {
        playBar(song, list[cur.i], cur.next);
        cur.next += barLen;
        cur.i++; if (cur.i >= list.length) cur.i = loopFrom;
      }
    }, 60);
    if (out) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(on ? 0.5 : 0, ctx.currentTime); }
  }
  function stop(fade = 0) {
    if (!cur) return;
    const c = cur; cur = null;
    if (fade && out) {
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
      setTimeout(() => { clearInterval(timer); if (!cur && out) out.gain.value = on ? 0.5 : 0; }, fade * 1000 + 50);
    } else clearInterval(timer);
    void c;
  }
  function setOn(v) { on = !!v; if (out) out.gain.setValueAtTime(on ? 0.5 : 0, ctx.currentTime); }
  // browsers only allow sound after a tap or a key: start the waiting song then
  let pending = null;
  const unlock = () => { if (pending) { const p = pending; pending = null; play(p); } };
  addEventListener("pointerdown", unlock, true); addEventListener("keydown", unlock, true);
  function request(name) { pending = name; init(); if (ctx && ctx.state === "running") { pending = null; play(name); } }
  window.Chip = { play: request, stop, setOn, get playing() { return cur && cur.name; } };
})();
