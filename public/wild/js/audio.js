// Sound, made in code: little effects, and a slow piano that plays a note now and then, like the wild.
let ctx = null, master = null, verb = null, musicGain = null;
let on = true;
try { on = JSON.parse(localStorage.getItem("arcade.sound") ?? "true"); } catch (e) { /* storage off */ }

export function init() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = on ? 0.7 : 0; master.connect(ctx.destination);
  // a soft room for the piano
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb.buffer = ir;
  const vg = ctx.createGain(); vg.gain.value = 0.5; verb.connect(vg); vg.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master); musicGain.connect(verb);
}
export function toggle() { on = !on; try { localStorage.setItem("arcade.sound", JSON.stringify(on)); } catch (e) { /* storage off */ } if (master) master.gain.value = on ? 0.7 : 0; return on; }
export const isOn = () => on;

function tone(f, dur, type = "sine", vol = 0.2, slide = 0, delay = 0, dest) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 1200, q = 1, type = "bandpass", delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
const notes = (list, type = "triangle", vol = 0.14, gap = 0.1, dur = 0.3) => list.forEach((f, i) => tone(f, dur, type, vol, 0, i * gap, musicGain));

export function sfx(name) {
  if (!ctx || !on) return;
  switch (name) {
    case "swing": noise(0.14, 0.18, 900, 0.8, "bandpass"); break;
    case "spin": noise(0.4, 0.2, 700, 0.6); tone(220, 0.4, "sawtooth", 0.05, 200); break;
    case "hit": tone(160, 0.12, "square", 0.12, -80); noise(0.08, 0.2, 2500, 1); break;
    case "crit": tone(880, 0.15, "square", 0.1, 400); noise(0.1, 0.25, 3000); break;
    case "bonk": tone(110, 0.2, "square", 0.14, -40); noise(0.1, 0.2, 1500); break;
    case "hurt": tone(300, 0.25, "sawtooth", 0.12, -200); break;
    case "jump": tone(300, 0.12, "sine", 0.1, 200); break;
    case "land": noise(0.08, 0.15, 400, 1, "lowpass"); break;
    case "thud": noise(0.3, 0.4, 200, 1, "lowpass"); tone(80, 0.3, "sine", 0.3, -40); break;
    case "roll": noise(0.25, 0.12, 500, 0.7); break;
    case "grab": noise(0.06, 0.14, 1800, 2); break;
    case "glide": noise(0.3, 0.15, 1400, 0.5, "highpass"); tone(500, 0.15, "sine", 0.06, 300); break;
    case "splash": noise(0.5, 0.3, 1200, 0.5, "lowpass"); break;
    case "tired": tone(400, 0.3, "triangle", 0.1, -200); tone(300, 0.3, "triangle", 0.1, -150, 0.25); break;
    case "pickup": notes([784, 1047], "sine", 0.12, 0.07, 0.2); break;
    case "loonie": notes([659, 784, 988, 1319], "sine", 0.13, 0.08, 0.3); tone(1400, 0.06, "square", 0.05, 500, 0.35); tone(1600, 0.06, "square", 0.05, 500, 0.45); break;
    case "eat": noise(0.08, 0.2, 1200, 2); noise(0.08, 0.2, 1000, 2, "bandpass", 0.12); notes([523, 659, 784], "sine", 0.1, 0.06); break;
    case "cook": notes([392, 523, 659, 784, 1047], "triangle", 0.12, 0.12, 0.4); break;
    case "open": notes([392, 494, 587, 784], "triangle", 0.14, 0.12, 0.5); break;
    case "tower": notes([262, 330, 392, 523, 659, 784, 1047], "triangle", 0.12, 0.15, 0.8); break;
    case "shrine": notes([523, 659, 784, 1047, 784, 1047, 1319], "triangle", 0.13, 0.12, 0.6); break;
    case "trial": notes([196, 185, 175], "sawtooth", 0.08, 0.2, 0.3); break;
    case "honk": tone(330, 0.2, "sawtooth", 0.12, -80); tone(300, 0.2, "sawtooth", 0.1, -60, 0.22); break;
    case "growl": noise(0.5, 0.25, 180, 3, "bandpass"); break;
    case "pop": noise(0.15, 0.2, 800, 1); tone(600, 0.1, "sine", 0.08, -300); break;
    case "break": noise(0.25, 0.3, 3000, 0.5, "highpass"); tone(200, 0.2, "square", 0.08, -120); break;
    case "block": tone(1200, 0.2, "triangle", 0.12, -600); break;
    case "slam": noise(0.5, 0.45, 150, 1, "lowpass"); tone(60, 0.5, "sine", 0.35, -20); break;
    case "throw": noise(0.3, 0.2, 400); break;
    case "poof": noise(0.3, 0.2, 2000, 0.6, "highpass"); break;
    case "cards": noise(0.15, 0.15, 4000, 1, "highpass"); break;
    case "dash": noise(0.3, 0.25, 1200, 0.5, "highpass"); break;
    case "hadoken": tone(180, 0.6, "sawtooth", 0.14, 400); noise(0.5, 0.2, 2000); break;
    case "spit": noise(0.25, 0.25, 500, 2); break;
    case "flush": noise(2.5, 0.35, 600, 0.4, "lowpass"); tone(120, 2.4, "sine", 0.15, -60); break;
    case "fury": tone(80, 0.6, "sawtooth", 0.2, 600); noise(0.6, 0.35, 3000, 0.4); break;
    case "lift": noise(0.8, 0.3, 900, 0.3, "bandpass"); tone(300, 0.8, "sine", 0.1, 600); break;
    case "slowmo": tone(600, 0.6, "sine", 0.12, -400); break;
    case "cast": noise(0.25, 0.12, 2400, 0.6, "highpass"); tone(900, 0.2, "sine", 0.04, -500); break;
    case "plop": tone(420, 0.12, "sine", 0.1, -260); noise(0.12, 0.1, 900, 1, "lowpass"); break;
    case "bite": tone(520, 0.08, "square", 0.08, 300); tone(700, 0.1, "square", 0.08, 300, 0.1); break;
    case "reel": noise(0.06, 0.06, 3200, 3, "bandpass"); break;
    case "catch": notes([523, 659, 784, 1047, 1319], "triangle", 0.12, 0.1, 0.5); break;
    case "paddle": noise(0.3, 0.1, 700, 0.6, "lowpass"); break;
    case "boss": notes([110, 104, 98], "sawtooth", 0.12, 0.3, 0.6); break;
    case "victory": notes([392, 523, 659, 784, 659, 784, 1047], "triangle", 0.14, 0.16, 0.7); break;
    case "die": notes([392, 370, 349, 330], "triangle", 0.14, 0.3, 0.6); break;
    case "talk": tone(500 + Math.random() * 300, 0.05, "square", 0.04); break;
    case "ui": tone(900, 0.05, "square", 0.05); break;
  }
}

// The music: a sparse piano by day, slower by night, and drums when something is chasing you.
let nextNote = 0, mood = "day", beat = 0;
const SCALE = [0, 2, 4, 7, 9];
export function setMood(m) { mood = m; }
export function music(t) {
  if (!ctx || !on) return;
  const now = ctx.currentTime;
  if (mood === "fight" || mood === "boss") {
    if (now >= nextNote) {
      const step = mood === "boss" ? 0.18 : 0.22;
      nextNote = now + step; beat++;
      if (beat % 4 === 0) { tone(55, 0.25, "sine", 0.35, -20, 0, musicGain); noise(0.1, 0.15, 150, 1, "lowpass"); }
      if (beat % 4 === 2) noise(0.08, 0.1, 2400, 1, "bandpass");
      const base = mood === "boss" ? 110 : 147;
      if (beat % 2 === 0) tone(base * Math.pow(2, [0, 3, 5, 7, 3, 10, 7, 5][(beat / 2) % 8] / 12), 0.2, "triangle", 0.06, 0, 0, musicGain);
    }
    return;
  }
  if (now < nextNote) return;
  const night = mood === "night";
  const root = night ? 196 : 262;
  const n = SCALE[(Math.random() * SCALE.length) | 0] + 12 * ((Math.random() * 2) | 0);
  const f = root * Math.pow(2, n / 12);
  tone(f, 2.5, "sine", 0.12, 0, 0, musicGain);
  tone(f * 2, 1.2, "triangle", 0.03, 0, 0, musicGain);
  if (Math.random() < 0.35) tone(f * Math.pow(2, 4 / 12), 2.2, "sine", 0.06, 0, 0.2, musicGain);
  nextNote = now + (night ? 2.4 : 1.4) + Math.random() * (night ? 3.5 : 2.6);
}
