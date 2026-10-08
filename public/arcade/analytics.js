// Capture-only PostHog integration. No replay, autocapture, text or identify calls.
(() => {
  const token = 'phc_uueVktK2gaALRxPpXzdMWE6PYZiNgGhEeE7qLoMUJviP';
  const enabled = location.hostname === 'arcade.uptick.systems';
  const game = document.currentScript?.dataset.game;
  const uuid = () => crypto.randomUUID();
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let visitor = read('arcade-anonymous-id');
  if (!/^[\da-f-]{36}$/i.test(visitor || '')) { visitor = uuid(); save('arcade-anonymous-id', visitor); }
  const session = uuid();
  let likes;
  try { likes = JSON.parse(read('arcade-likes') || '[]'); } catch { likes = []; }
  likes = new Set(Array.isArray(likes) ? likes.filter(id => typeof id === 'string') : []);
  function capture(event, id, extra = {}) {
    if (!enabled) return;
    const body = JSON.stringify({ api_key: token, event, distinct_id: visitor,
      timestamp: new Date().toISOString(), properties: {
        app: 'cottage_arcade', environment: 'production', game_id: id,
        session_id: session, $insert_id: uuid(), $process_person_profile: false, ...extra,
      } });
    // text/plain avoids a preflight and keepalive finishes small events on navigation.
    try { fetch('https://us.i.posthog.com/i/v0/e/', { method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, body, keepalive: true,
    }).catch(() => {}); } catch {}
  }
  window.ArcadeAnalytics = {
    liked: id => likes.has(id),
    like(id) {
      if (!enabled || likes.has(id) || !window.GameSwitch?.GAMES.some(g => g.id === id)) return false;
      likes.add(id); save('arcade-likes', JSON.stringify([...likes]));
      capture('arcade_game_like', id); return true;
    }, enabled,
  };
  if (!game) return;
  capture('arcade_game_view', game);
  let played = false, lastInput = -Infinity, lastTick = performance.now(), pending = 0;
  const eligible = () => document.visibilityState === 'visible' && document.hasFocus() && !window.GameSwitch?.isOpen;
  function tick() {
    const now = performance.now();
    if (played && eligible()) pending += Math.max(0, Math.min(now, lastInput + 30000) - lastTick) / 1000;
    lastTick = now;
  }
  function flush() {
    if (pending < 0.1) return;
    capture('arcade_active_time', game, { active_seconds: Math.round(pending * 1000) / 1000 });
    pending = 0;
  }
  function interact(e) {
    if (!e.isTrusted || !eligible() || e.target?.closest?.('[data-switch],.gsw,button[data-arcade-like],input,textarea,select,a')) return;
    if (e.type === 'keydown' && (e.repeat || e.ctrlKey || e.metaKey || e.altKey || ['Tab','Escape','Shift','Control','Alt','Meta'].includes(e.key))) return;
    tick(); lastInput = performance.now();
    if (!played) { played = true; capture('arcade_game_play', game); }
  }
  for (const name of ['pointerdown', 'pointermove', 'keydown']) document.addEventListener(name, e => {
    // Hovering alone cannot start or extend a play.
    if (name !== 'pointermove' || e.buttons) interact(e);
  }, { capture: true, passive: true });
  setInterval(() => {
    // Gamepad controls are trusted browser state, including VR controllers.
    if (eligible()) {
      const active = [...(navigator.getGamepads?.() || [])].some(p => p && (p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.2)));
      if (active) interact({ isTrusted: true, type: 'gamepad' });
    }
    tick(); if (pending >= 15) flush();
  }, 1000);
  // Discard the boundary interval to avoid counting background/blurred time.
  function suspend() { lastTick = performance.now(); flush(); }
  document.addEventListener('visibilitychange', suspend);
  window.addEventListener('blur', suspend);
  window.addEventListener('focus', () => { lastTick = performance.now(); });
  window.addEventListener('pagehide', suspend);
})();
