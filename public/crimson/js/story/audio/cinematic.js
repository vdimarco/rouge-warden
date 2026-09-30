// Local recorded dialogue and score share the game's Web Audio output.
// A blocked audio context holds the scene until the player enables sound.
export function createCinematicSound(S, A) {
  const files = new Map(), decoded = new Map();
  let current = null, score = null, gate = null, prepared = null, enabled = false, session = 0;
  const load = () => fetch('audio/dialogue/manifest.json').then(r => { if (!r.ok) throw Error('Voice manifest unavailable'); return r.json(); }).then(async entries => {
    await Promise.all(entries.map(async e => { const r = await fetch(e.src); if (!r.ok) throw Error('Voice unavailable: ' + e.src); files.set(e.text, { ...e, bytes: await r.arrayBuffer() }); }));
    const r = await fetch('audio/cinematic-score.mp3'); if (!r.ok) throw Error('Score unavailable'); files.set('__score', { bytes: await r.arrayBuffer() });
  });
  // Keep the loading failure for the visible retry control rather than a rejected promise.
  let loadError = null, bytes = load(); bytes.catch(e => { loadError = e; });
  async function prepare() {
    if (prepared) return prepared;
    prepared = (async () => { await bytes; if (loadError) throw loadError;
      await Promise.all([...files].map(async ([key, f]) => decoded.set(key, await A.ctx.decodeAudioData(f.bytes.slice(0)))));
    })().catch(e => { prepared = null; throw e; });
    return prepared;
  }
  function stopVoice() {
    if (current?.source) { try { current.source.stop(); } catch {} }
    if (current?.utterance && window.speechSynthesis) speechSynthesis.cancel();
    if (current) current.stopped = true;
    current = null;
  }
  function startScore() {
    if (score || !decoded.has('__score')) return;
    const source = A.ctx.createBufferSource(), gain = A.ctx.createGain();
    source.buffer = decoded.get('__score'); source.loop = true; gain.gain.value = 0.42;
    source.connect(gain); gain.connect(A.master); source.start(); score = { source, gain };
  }
  function begin() {
    enabled = true;
    const ticket = ++session;
    const h = { ready: false };
    const start = async () => {
      A.init(); await A.ctx.resume(); await prepare();
      if (ticket !== session) return;
      if (A.ctx.state !== 'running') throw Error('Sound needs a tap');
      startScore(); h.ready = true; gate?.remove(); gate = null;
    };
    const show = () => {
      if (gate) return;
      gate = document.createElement('button'); gate.id = 'cineSoundStart';
      gate.textContent = 'START CUTSCENE WITH SOUND';
      gate.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,9,27,.94);color:#fff;border:0;font:600 20px system-ui;letter-spacing:.08em;cursor:pointer;padding:24px;touch-action:manipulation';
      gate.onclick = () => { if (loadError) { loadError = null; files.clear(); decoded.clear(); bytes = load(); bytes.catch(e => { loadError = e; }); } gate.textContent = 'LOADING SOUND…'; start().catch(() => { if (gate) gate.textContent = 'SOUND COULD NOT START. TAP TO RETRY'; }); };
      document.body.append(gate);
    };
    if (A.ctx?.state === 'running') start().catch(show); else show();
    return h;
  }
  function speak(who, text) {
    stopVoice();
    if (!enabled || !text || /^\s*\(.*\)\s*$/.test(text)) return null;
    const buffer = decoded.get(String(text));
    if (buffer && A.ctx?.state === 'running') {
      const source = A.ctx.createBufferSource(), gain = A.ctx.createGain();
      source.buffer = buffer; gain.gain.value = 1.25; source.connect(gain); gain.connect(A.master);
      const h = { who, text: String(text), source, duration: buffer.duration, start: A.ctx.currentTime, stopped: false,
        get elapsed() { return Math.max(0, A.ctx.currentTime - this.start); },
        get done() { return this.stopped || this.elapsed >= this.duration; },
        get energy() {
          if (this.done) return 0;
          const data = buffer.getChannelData(0), offset = Math.floor(this.elapsed * buffer.sampleRate);
          let sum = 0, count = 0; for (let i = offset; i < Math.min(data.length, offset + 512); i++) { sum += data[i] * data[i]; count++; }
          return Math.min(1, Math.sqrt(sum / Math.max(1, count)) * 7);
        } };
      source.start(); current = h; return h;
    }
    // Incidental conversations can use the device's installed English voice.
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(String(text)); utterance.lang = 'en-US'; utterance.rate = 1.15;
      utterance.pitch = who === 'gabe' ? 0.85 : 1; utterance.volume = 1;
      const h = { who, text: String(text), utterance, duration: Math.max(1, String(text).length * 0.05), start: performance.now(), stopped: false,
        get elapsed() { return (performance.now() - this.start) / 1000; }, get done() { return this.stopped; }, get energy() { return this.stopped ? 0 : 0.5; } };
      utterance.onend = utterance.onerror = () => { h.stopped = true; }; speechSynthesis.speak(utterance); current = h; return h;
    }
    return null;
  }
  function end() {
    session++;
    stopVoice(); gate?.remove(); gate = null;
    if (score) { score.source.stop(); score.gain.disconnect(); score = null; }
    // Dialogue outside cinematics can still use the installed voice after activation.
  }
  return { begin, end, speak, stopVoice, get voice() { return current; }, get ready() { return decoded.size > 0; }, get score() { return !!score; }, get scoreSource() { return score?.source || null; } };
}
