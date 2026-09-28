// js/fullscreen.js : Crimson Rouge plays full screen by default. A browser only lets a page go full screen
// from a tap, a click or a key, so the first one does it (and on a phone it also turns the screen to
// landscape). Leave full screen (Esc, the back gesture) and the next tap goes back in, unless the player
// turned it off in the pause menu ('crimson.fullscreen' = 'off'). A phone held upright gets a prompt to
// turn it. window.CrimsonFullscreen holds the setting for the menu. It never touches the fight or the
// story: it only listens.
(function () {
  const doc = document, el = doc.documentElement;
  const can = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  let on = true;
  try { on = localStorage.getItem('crimson.fullscreen') !== 'off'; } catch (e) { /* storage blocked */ }
  const isFull = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

  function enter() {
    if (!can || !on || isFull()) return;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => {
        if (coarse && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    } catch (e) { /* not allowed here */ }
  }
  function leave() {
    if (!isFull()) return;
    try { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); } catch (e) { /* already out */ }
  }
  // Esc is the pause key, so a keyboard player who leaves full screen with it is not pulled back in by a key:
  // only a tap or a click goes back in. A key still does the first entry.
  let first = true;
  addEventListener('pointerup', enter, true);
  addEventListener('keydown', (e) => { if (first && e.key !== 'Escape') { first = false; enter(); } }, true);
  addEventListener('pointerup', () => { first = false; }, true);

  // Held upright, a phone shows the wide picture as a thin strip between tall black bars. Ask for landscape.
  if (coarse) {
    const st = doc.createElement('style');
    st.textContent = '#turnPhone{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#050505;color:#e9e6df;font:800 15px "Shippori Mincho B1",serif;letter-spacing:.18em;text-align:center}'
      + '#turnPhone b{font:48px "Zhi Mang Xing",serif;color:#d0485f;animation:tpTurn 2.4s ease-in-out infinite}'
      + '@keyframes tpTurn{0%,30%{transform:rotate(0)}60%,100%{transform:rotate(90deg)}}'
      + '@media (orientation:portrait){#turnPhone{display:flex}}';
    doc.head.appendChild(st);
    const d = doc.createElement('div');
    d.id = 'turnPhone';
    d.innerHTML = '<b>▯</b><span>TURN YOUR PHONE SIDEWAYS</span>';
    (doc.body ? Promise.resolve() : new Promise((r) => addEventListener('DOMContentLoaded', r))).then(() => doc.body.appendChild(d));
  }

  window.CrimsonFullscreen = {
    can, get on() { return on; },
    set(v) {
      on = !!v;
      try { localStorage.setItem('crimson.fullscreen', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
      if (on) enter(); else leave();
    },
  };
})();
