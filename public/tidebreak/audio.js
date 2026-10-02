// Lightweight, locally synthesized music and feedback. Starts on a user gesture.
export class Sound {
  constructor() { this.on = true; try { this.on = localStorage.getItem('tidebreak.sound') !== 'off'; } catch {} this.context = null; this.note = 0; this.next = 0; }
  start() { try { this.context ||= new (window.AudioContext || window.webkitAudioContext)(); this.context.resume().catch(() => {}); } catch {} }
  tone(hz, duration = .1, volume = .035, type = 'sine', end) {
    const c = this.context; if (!c || !this.on || c.state !== 'running') return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(hz, c.currentTime); if (end) o.frequency.exponentialRampToValueAtTime(end, c.currentTime + duration); g.gain.setValueAtTime(volume, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + duration);
  }
  tick(time) { if (time < this.next) return; this.next = time + .48; const notes = [146.83, 220, 293.66, 349.23, 293.66, 220, 174.61, 130.81]; this.tone(notes[this.note++ % notes.length], .9, .009, 'triangle'); }
  hit(variant = 0) { this.tone([340, 430, 220][variant], [.11, .14, .21][variant], variant === 2 ? .027 : .018, 'triangle', [105, 160, 65][variant]); }
  skill(slot) { this.tone([240, 440, 330, 110][slot], .38, .04, 'sine', [800, 180, 620, 520][slot]); }
  toggle() { this.on = !this.on; try { localStorage.setItem('tidebreak.sound', this.on ? 'on' : 'off'); } catch {} return this.on; }
}
