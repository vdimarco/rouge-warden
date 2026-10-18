// First Breath: sound, the WAVE-0 STUB (design.md 11, 16.2; tasks.md 1.10). It makes no audio nodes. It keeps the
// frozen signature and the numbers a test reads (what was scheduled, mute, the scene), so main.js is wired to it
// exactly as it will be to the real graph: her beats from run.beats() through schedule(), one-shots from the stage
// events through sfx(), the hum, breaths and the opening at the ending. The ui-and-sound agent fills this file in
// wave 1 against the same injected AudioContext (or an OfflineAudioContext in sound.e2e.mjs).
//
// Contract choices (16.2 gives createSound(ctx, { seed, latencyS }) → { start, setMuted, setScene, schedule, sfx, hum,
// breath, open, suspend, resume, stats }):
// - ctx may be null (no Web Audio); every call still works and stats().state reads "none".
// - latencyS null takes ctx.outputLatency, else ctx.baseLatency, else 0. Each beat is "scheduled" at
//   toCtxTime(t) − latencyS (11), and the stub counts it. A beat at or before the last context time scheduled for
//   that heart is skipped, so overlapping lookahead windows never count a beat twice (context time never runs back,
//   also across a new run).
// - suspend() and resume() suspend and resume ctx (quiet.js also suspends it when the page is hidden).
// - stats() → { state, cutoffHz, scheduled: { mother, you }, muted, voices, latencyS }, plus the extras hearing,
//   sfx (one-shots asked for) and last ({ mother, you }: the last ctx time scheduled).

export function createSound(ctx, { seed = 1, latencyS = null } = {}) {
  const lat = Number.isFinite(latencyS) ? latencyS
    : ctx ? (Number.isFinite(ctx.outputLatency) && ctx.outputLatency > 0 ? ctx.outputLatency : Number(ctx.baseLatency) || 0) : 0;
  const scheduled = { mother: 0, you: 0 };
  const lastT = { mother: -Infinity, you: -Infinity };
  const lastAt = { mother: null, you: null };
  const scene = { stage: null, cutoffHz: 150, hearing: false, motherDb: 0, youDb: -8, voice: null };
  let muted = false, started = false, sfxCount = 0;
  const quietly = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* closed */ } };

  return {
    start() { started = true; if (ctx && ctx.state === "suspended") quietly(() => ctx.resume()); },
    setMuted(b) { muted = !!b; },
    setScene(s = {}) { for (const k of Object.keys(scene)) if (k in s) scene[k] = s[k]; },
    schedule(heart, times, toCtxTime) {
      const h = heart === "you" ? "you" : "mother";
      for (const t of times || []) {
        const at = (typeof toCtxTime === "function" ? toCtxTime(t) : t) - lat;
        if (!Number.isFinite(at) || at <= lastT[h] + 1e-4) continue;
        lastT[h] = at;
        lastAt[h] = at;
        scheduled[h]++;
      }
    },
    sfx(id, at, opts = {}) { if (id) sfxCount++; },
    hum(notes, at, { clear = false } = {}) {},
    breath(kind, at) {},
    open(seconds) { scene.cutoffHz = 16000; },
    suspend() { if (ctx && ctx.state === "running") quietly(() => ctx.suspend()); },
    resume() { if (ctx && started && ctx.state !== "running") quietly(() => ctx.resume()); },
    stats() {
      return {
        state: ctx ? ctx.state : "none",
        cutoffHz: scene.cutoffHz,
        scheduled: { ...scheduled },
        muted,
        voices: 0,
        latencyS: lat,
        hearing: !!scene.hearing,
        sfx: sfxCount,
        last: { ...lastAt },
      };
    },
  };
}
