// Quiet: a page with sound goes silent when it is hidden, and comes back when it is visible again.
// On a phone, a hidden tab can keep playing: Android Chrome never stops it, and iOS Safari stops it only when the phone locks.
// Load this FIRST in <head>, before any other script: <script src="/arcade/quiet.js"></script>. Nothing else is needed.
//  - It wraps AudioContext, so it knows every context the page makes. When the page is hidden it suspends the ones that
//    run, and resume() does nothing until the page is visible. When the page is visible it resumes only those it suspended.
//  - A game that suspends its own sound (Reel It In, the Lab) keeps control of it: quiet lets go of a context the game suspends.
//  - It does the same for <audio> and <video> that make sound, and for the SoundCloud players (Get Plunger'd, Crimson Rogue).
// For tests: window.__quiet = { hidden, contexts(), media() }. See qa/arcade/quiet.mjs.
(() => {
  "use strict";
  if (window.__quiet) return;
  const noop = () => {};
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };
  // run a call that returns a promise, and ignore a refusal (a closed context, no tap yet)
  const quietly = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(noop); return p; } catch (e) { return null; } };
  // a weak reference, so a context or element that the page lets go of can be freed
  const weak = (o) => (typeof WeakRef === "function" ? new WeakRef(o) : { deref: () => o });

  // hidden: minimised, another tab or app on top, a locked screen, or on its way out (pagehide, freeze)
  let gone = false;
  const hidden = () => gone || document.visibilityState === "hidden" || document.hidden === true;

  /* ---------------- Web Audio ---------------- */
  // one entry per context. mine: quiet suspended it. want: the page asked to resume it while hidden. wait: quiet's suspend call.
  const ctxs = [];
  const entries = new WeakMap();
  // forget the closed and the freed contexts; fn(entry, context) runs for the rest
  function eachCtx(fn) {
    for (let i = ctxs.length - 1; i >= 0; i--) {
      const c = ctxs[i].ref.deref();
      if (!c || c.state === "closed") ctxs.splice(i, 1);
      else if (fn) { const e = ctxs[i]; safe(() => fn(e, c)); }
    }
  }
  const Base = window.AudioContext || window.webkitAudioContext;
  const rawResume = Base && Base.prototype.resume, rawSuspend = Base && Base.prototype.suspend;
  function sleep(e, c) {
    if (c.state !== "running") return;
    e.mine = true;
    e.wait = quietly(() => rawSuspend.call(c));
  }
  function wake(e, c) {
    if (!(e.mine || e.want || c.state === "interrupted")) return; // iOS: a call or Siri leaves a context "interrupted"
    const wait = e.wait;
    e.wait = null;
    // a suspend still on its way would undo the resume, so resume after it. If the page is hidden again by then, keep the flags
    const go = () => {
      if (hidden() || !(e.mine || e.want || c.state === "interrupted")) return; // or the page took the context over meanwhile
      e.mine = e.want = false;
      quietly(() => rawResume.call(c));
    };
    if (wait && wait.then) wait.then(go, go); else go();
  }
  function track(c) {
    const e = { ref: weak(c), mine: false, want: false, wait: null };
    entries.set(c, e);
    if (ctxs.length > 32) eachCtx(); // some games make a new context for each sound
    ctxs.push(e);
    // a context that starts while the page is hidden (or ends a resume that began just before) goes back to sleep
    c.addEventListener("statechange", () => { if (hidden()) sleep(e, c); });
    if (hidden()) sleep(e, c);
  }
  if (Base && typeof rawResume === "function" && typeof rawSuspend === "function") safe(() => {
    class QuietAudioContext extends Base {
      constructor(...args) { super(...args); safe(() => track(this)); }
      resume(...args) {
        const e = entries.get(this);
        if (e && hidden()) { e.want = true; return Promise.resolve(); }
        return rawResume.apply(this, args);
      }
      suspend(...args) {
        const e = entries.get(this);
        if (e) e.mine = e.want = false; // the page suspended it, so the page decides when it comes back
        return rawSuspend.apply(this, args);
      }
    }
    safe(() => Object.defineProperty(QuietAudioContext, "name", { value: Base.name }));
    if (window.AudioContext) window.AudioContext = QuietAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = QuietAudioContext;
  });

  /* ---------------- <audio> and <video> ---------------- */
  // a muted element makes no sound, so it is left alone
  const audible = (m) => !m.muted && m.volume > 0;
  const Media = window.HTMLMediaElement;
  const rawPlay = Media && Media.prototype.play, rawPause = Media && Media.prototype.pause;
  const medias = [];
  const mediaEntries = new WeakMap();
  // mine: quiet paused it, or held its play() until the page is visible
  function mediaEntry(m) {
    let e = mediaEntries.get(m);
    if (!e) {
      e = { ref: weak(m), mine: false };
      mediaEntries.set(m, e);
      if (medias.length > 64) for (let i = medias.length - 1; i >= 0; i--) if (!medias[i].ref.deref()) medias.splice(i, 1);
      medias.push(e);
    }
    return e;
  }
  if (typeof rawPlay === "function" && typeof rawPause === "function") safe(() => {
    Media.prototype.play = function play(...args) {
      const held = safe(() => { const e = mediaEntry(this); if (hidden() && audible(this)) return (e.mine = true); });
      return held ? Promise.resolve() : rawPlay.apply(this, args);
    };
    Media.prototype.pause = function pause(...args) {
      safe(() => { mediaEntry(this).mine = false; }); // the page paused it, so the page decides when it plays again
      return rawPause.apply(this, args);
    };
  });
  function hushMedia() {
    if (!rawPause) return;
    // elements made with new Audio() are not in the page, so look at the ones play() has seen too
    for (const m of document.querySelectorAll("audio, video")) safe(() => mediaEntry(m));
    for (const e of medias) safe(() => {
      const m = e.ref.deref();
      if (m && !m.paused && !m.ended && audible(m)) { e.mine = true; rawPause.call(m); }
    });
  }
  function wakeMedia() {
    if (!rawPlay) return;
    for (const e of medias) safe(() => {
      const m = e.ref.deref();
      if (!e.mine) return;
      e.mine = false;
      if (m && m.paused && !m.ended) quietly(() => rawPlay.call(m));
    });
  }

  /* ---------------- SoundCloud players ---------------- */
  // Get Plunger'd and Crimson Rogue play their songs in a SoundCloud iframe, which no script of ours can reach.
  // SoundCloud's own script (SC.Widget) hands back the page's own widget for an iframe, so ask it to pause and play.
  const songs = [];
  let songTimer = 0;
  function hushSongs() {
    // Ask again every second while hidden. A game can start a song while hidden (when it changes song, or when SoundCloud's
    // script loads late on a slow phone), and a widget cannot be stopped from doing it. The timer starts before any check
    // for the player, so a player that appears later is still found.
    if (!songTimer) songTimer = setInterval(() => { if (hidden()) hushSongs(); else stopSongs(); }, 1000);
    const SC = window.SC, frames = document.querySelectorAll('iframe[src^="https://w.soundcloud.com/"]');
    if (!SC || typeof SC.Widget !== "function" || !frames.length) return;
    for (const f of frames) safe(() => {
      const w = SC.Widget(f);
      // the answer comes later: by then the page may be visible again
      w.isPaused((paused) => safe(() => { if (!paused && hidden()) { if (songs.indexOf(w) < 0) songs.push(w); w.pause(); } }));
    });
  }
  function stopSongs() { clearInterval(songTimer); songTimer = 0; }
  function wakeSongs() {
    stopSongs();
    while (songs.length) safe(() => songs.pop().play());
  }

  /* ---------------- hide and show ---------------- */
  function hush() {
    eachCtx(sleep);
    hushMedia();
    hushSongs();
    safe(() => { if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel(); });
  }
  function unhush() {
    eachCtx(wake);
    wakeMedia();
    wakeSongs();
  }
  const sync = () => (hidden() ? hush() : unhush());
  // capture, so quiet runs before the page's own handlers
  const on = (target, type, fn) => safe(() => target.addEventListener(type, fn, true));
  on(document, "visibilitychange", () => { if (document.visibilityState !== "hidden" && !document.hidden) gone = false; sync(); });
  // pagehide and pageshow (also from the back/forward cache), and the freeze and resume of the page lifecycle
  on(window, "pagehide", () => { gone = true; sync(); });
  on(window, "pageshow", () => { gone = false; sync(); });
  on(document, "freeze", () => { gone = true; sync(); });
  on(document, "resume", () => { gone = false; sync(); });

  safe(() => Object.defineProperty(window, "__quiet", {
    value: Object.freeze({
      get hidden() { return hidden(); },
      contexts() { const out = []; eachCtx((e, c) => out.push({ state: c.state, suspendedByQuiet: e.mine })); return out; },
      media() { const out = []; for (const e of medias) { const m = e.ref.deref(); if (m) out.push({ paused: m.paused, heldByQuiet: e.mine }); } return out; },
    }),
  }));
  // a page that opens in a background tab gets no hide event, so start guarding at once
  if (hidden()) hush();
})();
