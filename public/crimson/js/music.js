// Background songs through SoundCloud's own embed player (the Widget API).
// The title screen plays "Little Green Bag" (Reservoir Dogs), by A Band Apart UK.
// The fight plays Nero's "Promises" (Skrillex remix), from Skrillex's SoundCloud page.
// One player plays both: it changes song when the game leaves the title and when it comes back.
// Try others with ?titlesong=<link> and ?song=<link>. ?nomusic turns both off.
export const TITLE_SONG = 'https://soundcloud.com/a-band-apart-uk/little-green-bag-reservoir-dogs';
export const SONG = 'https://soundcloud.com/skrillex/nero-promises-skrillex';

const Q = new URLSearchParams(location.search);
const SONGS = Q.has('nomusic') ? { title: '', fight: '' } : { title: Q.get('titlesong') || TITLE_SONG, fight: Q.get('song') || SONG };
let widget = null, wantOn = true, playing = false;
try { wantOn = localStorage.getItem('crimson.music') !== 'off'; } catch (e) { /* storage blocked */ }

// the player loads with the page, so on a phone its own play button is there to tap on the title screen
// (phones only allow sound that a tap inside the player starts)
let frame = null, ready = false, hushed = false;
// 'title' or 'fight' (the arena and the story's boss fights); `loaded` is the song in the player
let scene = 'title', loaded = '';
// the title song at a middle level, the fight song quiet on the pause and end screens and loud in the fight
const LOW = 22, MID = 40, HIGH = 80;
let level = MID, vol = MID, rampT = 0;
function ramp() {
  clearInterval(rampT);
  rampT = setInterval(() => {
    vol += Math.sign(level - vol) * Math.min(Math.abs(level - vol), 4);
    if (ready) widget.setVolume(vol);
    if (vol === level) clearInterval(rampT);
  }, 40);
}
const OPTS = { visual: false, show_artwork: false, hide_related: true, show_comments: false, show_user: true, buying: false, sharing: false, download: false, color: '#c6ff1a' };
function load() {
  if (!SONGS[scene] || frame) return;
  const f = frame = document.createElement('iframe');
  f.id = 'song'; f.allow = 'autoplay; encrypted-media'; f.title = 'Background song';
  loaded = SONGS[scene];
  const opts = Object.entries(OPTS).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(loaded)}&auto_play=true${opts}`;
  document.body.appendChild(f);
  const s = document.createElement('script');
  s.src = 'https://w.soundcloud.com/player/api.js';
  s.onload = () => {
    widget = window.SC.Widget(f);
    const E = window.SC.Widget.Events;
    // try to play right away; browsers that need a tap or key first wait for start()
    widget.bind(E.READY, settle);
    widget.bind(E.PLAY, () => { playing = true; f.classList.remove('show'); document.body.classList.add('songOn'); update(); });
    widget.bind(E.PAUSE, () => { playing = false; update(); });
    widget.bind(E.FINISH, () => { if (ready && wantOn && !hushed) { widget.seekTo(0); widget.play(); } });
  };
  document.head.appendChild(s);
}
// the player has a song in: set its level, catch up with the scene, then play or hold
function settle() {
  ready = true;
  widget.setVolume(vol);
  if (loaded !== SONGS[scene]) { swap(); return; }
  if (wantOn && !hushed) { widget.play(); if (!playing) frame.classList.add('show'); } else widget.pause();
  document.body.classList.add('songBar');
  widget.getCurrentSound((snd) => { if (snd) credit(snd.title, snd.user && snd.user.username, snd.permalink_url); });
}
// put the scene's song in the player (once it is ready; settle() catches up otherwise)
function swap() {
  const song = SONGS[scene];
  if (!ready || !song || loaded === song) return;
  loaded = song; ready = false;
  if (playing) { playing = false; update(); }
  widget.load(song, { ...OPTS, auto_play: wantOn && !hushed, callback: settle });
}
function setScene(name) {
  if (!(name in SONGS) || name === scene) return;
  scene = name;
  if (name === 'title') { level = MID; ramp(); }
  swap();
}

export const Music = {
  get enabled() { return !!(SONGS.title || SONGS.fight); },
  get playing() { return playing; },
  get sceneName() { return scene; },
  load,
  // 'title' on the title screen; loud(true) moves to 'fight' by itself
  scene: setScene,
  // the credits bring their own music: hold the song, then let it go on after
  hush() { hushed = true; if (ready && playing) widget.pause(); },
  unhush() { if (!hushed) return; hushed = false; if (ready && wantOn) widget.play(); },
  // true in the fight, false on the title, pause and end screens
  loud(on) {
    if (on) setScene('fight');
    level = on ? HIGH : scene === 'title' ? MID : LOW; ramp();
  },
  // call from a tap or key press; desktop browsers then allow the player to start
  start() {
    if (!this.enabled || !wantOn) return;
    load();
    if (ready && !hushed) widget.play();
  },
  toggle() {
    wantOn = !wantOn;
    try { localStorage.setItem('crimson.music', wantOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    if (!ready) { if (wantOn) this.start(); } else if (wantOn) { if (!hushed) { widget.play(); if (!playing) frame.classList.add('show'); } } else { widget.pause(); frame.classList.remove('show'); }
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
    a.href = link || loaded; a.target = '_blank'; a.rel = 'noopener';
    a.addEventListener('click', (e) => e.stopPropagation());
    a.textContent = `♪ ${[user, title].filter(Boolean).join(' · ')} on SoundCloud`;
    el.appendChild(a);
  }
}
