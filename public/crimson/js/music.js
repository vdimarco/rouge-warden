// Background song through SoundCloud's own embed player (the Widget API).
// The song is Nero's "Promises" (Skrillex remix), from Skrillex's SoundCloud page. Try another with ?song=<link>.
export const SONG = 'https://soundcloud.com/skrillex/nero-promises-skrillex';
const TITLE = '';

const url = new URLSearchParams(location.search).get('song') || SONG;
let widget = null, wantOn = true, playing = false;
try { wantOn = localStorage.getItem('crimson.music') !== 'off'; } catch (e) { /* storage blocked */ }

// the player loads with the page, so on a phone its own play button is there to tap on the title screen
// (phones only allow sound that a tap inside the player starts)
let frame = null, ready = false, pending = false, hushed = false;
// quiet on the title screen, loud in the fight
const LOW = 22, HIGH = 80;
let level = LOW, vol = LOW, rampT = 0;
function ramp() {
  clearInterval(rampT);
  rampT = setInterval(() => {
    vol += Math.sign(level - vol) * Math.min(Math.abs(level - vol), 4);
    if (ready) widget.setVolume(vol);
    if (vol === level) clearInterval(rampT);
  }, 40);
}
function load() {
  if (!url || frame) return;
  const f = frame = document.createElement('iframe');
  f.id = 'song'; f.allow = 'autoplay; encrypted-media'; f.title = 'Background song';
  f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=false&show_artwork=false&hide_related=true&show_comments=false&show_user=true&buying=false&sharing=false&download=false&color=%23c6ff1a`;
  document.body.appendChild(f);
  const s = document.createElement('script');
  s.src = 'https://w.soundcloud.com/player/api.js';
  s.onload = () => {
    widget = window.SC.Widget(f);
    const E = window.SC.Widget.Events;
    widget.bind(E.READY, () => {
      ready = true;
      widget.setVolume(vol);
      // try to play right away; browsers that need a tap or key first wait for start()
      if (wantOn) { widget.play(); f.classList.add('show'); }
      document.body.classList.add('songBar');
      if (pending && wantOn) widget.play();
      widget.getCurrentSound((snd) => { if (snd) credit(snd.title, snd.user && snd.user.username, snd.permalink_url); });
    });
    widget.bind(E.PLAY, () => { playing = true; f.classList.remove('show'); document.body.classList.add('songOn'); update(); });
    widget.bind(E.PAUSE, () => { playing = false; update(); });
    widget.bind(E.FINISH, () => { widget.seekTo(0); widget.play(); });
  };
  document.head.appendChild(s);
}

export const Music = {
  get enabled() { return !!url; },
  get playing() { return playing; },
  load,
  // the credits bring their own music: hold the song, then let it go on after
  hush() { hushed = true; if (ready && playing) widget.pause(); },
  unhush() { if (!hushed) return; hushed = false; if (ready && wantOn) widget.play(); },
  // true in the fight, false on the title, pause and end screens
  loud(on) { level = on ? HIGH : LOW; ramp(); },
  // call from a tap or key press; desktop browsers then allow the player to start
  start() {
    if (!url || !wantOn) return;
    load();
    if (ready) widget.play(); else pending = true;
  },
  toggle() {
    wantOn = !wantOn;
    try { localStorage.setItem('crimson.music', wantOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    if (!ready) { if (wantOn) this.start(); } else if (wantOn) { widget.play(); if (!playing) frame.classList.add('show'); } else { widget.pause(); frame.classList.remove('show'); }
    update();
  },
};

function update() {
  for (const b of document.querySelectorAll('.music')) b.classList.toggle('off', !wantOn || !playing);
}
function credit(title, user, link) {
  for (const el of document.querySelectorAll('.songCredit')) {
    el.innerHTML = '';
    const a = document.createElement('a');
    a.href = link || url; a.target = '_blank'; a.rel = 'noopener';
    a.addEventListener('click', (e) => e.stopPropagation());
    a.textContent = `♪ ${TITLE || [user, title].filter(Boolean).join(' · ')} on SoundCloud`;
    el.appendChild(a);
  }
}
