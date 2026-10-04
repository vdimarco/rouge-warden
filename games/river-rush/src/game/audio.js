// Synthesized river ambience and brief action tones; no external audio dependency.
export class RiverAudio {
  constructor() { this.ctx = null; this.enabled = false; }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
        const data = buffer.getChannelData(0); let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = last * 3; }
        const source = this.ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1100;
        this.gain = this.ctx.createGain(); this.gain.gain.value = 0.17;
        source.connect(filter).connect(this.gain).connect(this.ctx.destination); source.start();
      } catch { this.enabled = false; }
    }
    if (this.ctx) { this.gain.gain.setTargetAtTime(enabled ? 0.17 : 0, this.ctx.currentTime, 0.15); if (enabled) this.ctx.resume().catch(() => {}); }
  }
  tone(event) {
    if (!this.ctx || !this.enabled) return;
    const patterns = { key: [660, 880], chest: [440, 660, 880], win: [523, 659, 784, 1046], hit: [130], miss: [220], fall: [160, 100], lose: [260, 190, 130], recover: [330, 440], near: [740, 988], surge: [220, 330, 660] };
    (patterns[event] || []).forEach((freq, i) => {
      const at = this.ctx.currentTime + i * 0.13;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.13, at + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
      osc.connect(gain).connect(this.ctx.destination); osc.start(at); osc.stop(at + 0.31);
    });
  }
}
