// js/core/film.js : play a short film through the page's #introVid (startGame unlocks it with a tap).
// play(base) takes base.mp4 when the browser answers 'probably' for H.264, else base.webm (headless
// Chromium then gets the WebM). It waits up to `wait` story seconds for a first frame. If none comes, the
// handle ends with played=false and the caller shows its engine fallback. The handle moves on when its
// `done` is read, so a coroutine that yields it drives it; nothing here uses timers or promises for flow.
// The film ends on 'ended' or skip(); the story input calls skip() on a key, tap or pad button.
export function createFilm({ video = null, screen = null, now = () => performance.now() / 1000 } = {}) {
  let cur = null;
  const pick = (base) => {
    if (!video || !video.canPlayType) return null;
    if (video.canPlayType('video/mp4; codecs="avc1.42E01E"') === 'probably') return `${base}.mp4`;
    if (video.canPlayType('video/webm; codecs="vp9"')) return `${base}.webm`;
    return `${base}.mp4`;
  };
  function finish(h, played) {
    if (h.state === 'done') return;
    h.state = 'done'; h.played = played;
    if (cur !== h) return;
    cur = null;
    try { video.pause(); } catch (e) { /* not playing */ }
    video.onended = null; video.onerror = null;
    if (screen) screen.classList.add('hidden');
  }
  function step(h) {
    if (h.state !== 'wait') return;
    if (h.failed || now() - h.t0 > h.wait) { finish(h, false); return; }
    if (video.readyState < 2) return;
    h.state = 'playing';
    if (screen) screen.classList.remove('hidden');
    video.currentTime = 0; video.muted = false; video.volume = 1;
    video.onended = () => finish(h, true);
    const p = video.play();
    if (p && p.catch) p.catch(() => { video.muted = true; const q = video.play(); if (q && q.catch) q.catch(() => finish(h, false)); });
  }
  return {
    get active() { return !!cur && cur.state === 'playing'; },
    get current() { return cur; },
    play(base, { wait = 1.5 } = {}) {
      if (cur) finish(cur, false);
      const h = { state: 'wait', played: false, failed: false, src: pick(base), wait, t0: now(),
        get done() { step(h); return h.state === 'done'; } };
      cur = h;
      if (!h.src) { finish(h, false); return h; }
      video.onerror = () => { h.failed = true; };
      video.src = h.src; video.load();
      return h;
    },
    skip() { if (cur) finish(cur, cur.state === 'playing'); },
  };
}
