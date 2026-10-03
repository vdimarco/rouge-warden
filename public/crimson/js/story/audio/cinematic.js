// Recorded character performances share the game's Web Audio output.
// Load the current scene only; conversations fetch their own lines on demand.
import { CREW_IDS } from '../types.js';

export const voiceKey = (who, text) => `${who}\u0000${String(text)}`;
export const resolveSpeaker = (who, pick = 0) => who === 'pick' || who === 'hero' ? CREW_IDS[pick] || 'shades' : who;
export const silentSpeaker = who => !who || who === 'phone' || who === 'note';

export function createCinematicSound(S, A) {
  const files = new Map(), decoded = new Map(), loading = new Map();
  let manifest = null, current = null, score = null, gate = null, session = 0;
  async function getManifest() {
    if (!manifest) manifest = fetch('audio/dialogue/realistic/manifest.json', { signal: AbortSignal.timeout(15000) }).then(r => {
      if (!r.ok) throw Error('Voice manifest unavailable'); return r.json();
    }).then(data => { for (const e of data.entries) files.set(voiceKey(e.who, e.text), e); return data; })
      .catch(e => { manifest = null; throw e; });
    return manifest;
  }
  async function buffer(src) {
    if (decoded.has(src)) return decoded.get(src);
    if (loading.has(src)) return loading.get(src);
    const task = (async () => {
      const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 15000);
      try {
        const r = await fetch(src, { signal: abort.signal }); if (!r.ok) throw Error('Voice unavailable: ' + src);
        const b = await A.ctx.decodeAudioData(await r.arrayBuffer()); decoded.set(src, b); return b;
      } finally { clearTimeout(timeout); loading.delete(src); }
    })(); loading.set(src, task); return task;
  }
  const speaker = who => resolveSpeaker(who, S.ctx?.crewPick);
  function duck(on) {
    if (score) score.gain.gain.setTargetAtTime(on ? .16 : .42, A.ctx.currentTime, on ? .06 : .3);
  }
  function stopVoice() {
    if (current) { current.stopped = true; for (const source of current.sources) { try { source.stop(); } catch {} } }
    current = null; duck(false);
  }
  function startScore(b) {
    if (score) return;
    const source = A.ctx.createBufferSource(), gain = A.ctx.createGain();
    source.buffer = b; source.loop = true; gain.gain.value = .42;
    source.connect(gain); gain.connect(A.master); source.start(); score = { source, gain };
  }
  async function prepare(scene) {
    await getManifest();
    const def = S.content?.CINES?.[scene];
    const keys = (def?.lines || []).map(l => {
      const line = S.content.LINES[l.line];
      return voiceKey(speaker(l.who || line?.who), S.content.line(l.line));
    });
    await Promise.all([...new Set(keys)].map(k => files.get(k)).filter(Boolean).map(e => buffer(e.src)));
    return buffer('audio/cinematic-score.mp3');
  }
  function begin(scene) {
    const ticket = ++session, h = { ready: false };
    const start = async () => {
      A.init(); await A.ctx.resume(); const b = await prepare(scene);
      if (ticket !== session) return;
      if (A.ctx.state !== 'running') throw Error('Sound needs a tap');
      startScore(b); h.ready = true; gate?.remove(); gate = null;
    };
    const show = () => {
      if (ticket !== session || gate) return;
      gate = document.createElement('button'); gate.id = 'cineSoundStart';
      gate.textContent = 'START CUTSCENE WITH SOUND';
      gate.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,9,27,.94);color:#fff;border:0;font:600 20px system-ui;letter-spacing:.08em;cursor:pointer;padding:24px;touch-action:manipulation';
      gate.onclick = () => { gate.textContent = 'LOADING SOUND…'; start().catch(() => { if (gate) gate.textContent = 'SOUND COULD NOT START. TAP TO RETRY'; }); };
      document.body.append(gate);
    };
    if (A.ctx?.state === 'running') start().catch(show); else show();
    return h;
  }
  function speak(who, text) {
    stopVoice(); const id = speaker(who);
    if (silentSpeaker(id) || !text || /^\s*\(.*\)\s*$/.test(text)) return null;
    const h = { who: id, text: String(text), sources: [], source: null, pending: true, stopped: false,
      duration: Math.max(1, String(text).length * .055), start: null, failed: false,
      get elapsed() { return this.start == null ? 0 : Math.max(0, A.ctx.currentTime - this.start); },
      get done() { return this.stopped || !this.pending && this.elapsed >= this.duration; },
      get energy() {
        if (this.pending || this.done || !this.source) return 0;
        const b = this.source.buffer, data = b.getChannelData(0), offset = Math.floor(this.elapsed * b.sampleRate);
        let sum = 0, count = 0; for (let i = offset; i < Math.min(data.length, offset + 512); i++) { sum += data[i] * data[i]; count++; }
        return Math.min(1, Math.sqrt(sum / Math.max(1, count)) * 7);
      } };
    current = h;
    const play = async () => {
      A.init(); await A.ctx.resume(); await getManifest();
      if (h.stopped) return;
      const entry = files.get(voiceKey(id, text));
      if (!entry) throw Error('No recording for ' + id + ': ' + text);
      h.duration = entry.duration; const b = await buffer(entry.src);
      if (h.stopped) return;
      if (A.ctx.state !== 'running') throw Error('Sound needs a tap');
      const source = A.ctx.createBufferSource(), gain = A.ctx.createGain();
      source.buffer = b; gain.gain.value = .95; source.connect(gain); gain.connect(A.master);
      h.source = source; h.sources.push(source); h.duration = b.duration; h.start = A.ctx.currentTime; h.pending = false;
      duck(true); source.onended = () => { h.stopped = true; gain.disconnect(); if (current === h) duck(false); };
      source.start();
    };
    play().catch(e => { if (!h.stopped) { h.failed = true; h.error = e.message; } h.pending = false; h.stopped = true; });
    return h;
  }
  function end() {
    session++; stopVoice(); gate?.remove(); gate = null;
    if (score) { score.source.stop(); score.gain.disconnect(); score = null; }
  }
  return { begin, end, speak, stopVoice, get voice() { return current; }, get ready() { return files.size > 0; }, get score() { return !!score; }, get scoreSource() { return score?.source || null; } };
}
