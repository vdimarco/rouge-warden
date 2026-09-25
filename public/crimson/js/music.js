// Background song through SoundCloud's own embed player (the Widget API).
// The song is Nero's "Promises" (Skrillex remix), from Skrillex's SoundCloud page. Try another with ?song=<link>.
export const SONG = 'https://soundcloud.com/skrillex/nero-promises-skrillex';
const TITLE = '';

const url = new URLSearchParams(location.search).get('song') || SONG;
let widget = null, wantOn = true, playing = false;
try { wantOn = localStorage.getItem('crimson.music') !== 'off'; } catch (e) { /* storage blocked */ }

export const Music = {
  get enabled() { return !!url; },
  get playing() { return playing; },
  // call from a tap or key press, so the browser allows sound
  start() {
    if (!url || widget || !wantOn) { if (widget && wantOn) widget.play(); return; }
    const f = document.createElement('iframe');
    f.id = 'song'; f.allow = 'autoplay'; f.title = 'Background song';
    f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=false&show_artwork=false&hide_related=true&show_comments=false&show_user=true&buying=false&sharing=false&download=false`;
    document.body.appendChild(f);
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.onload = () => {
      widget = window.SC.Widget(f);
      const E = window.SC.Widget.Events;
      widget.bind(E.READY, () => {
        widget.setVolume(45);
        if (wantOn) widget.play();
        // phones often block sound started from outside the player: then show SoundCloud's own small play bar
        setTimeout(() => { if (wantOn && !playing) f.classList.add('show'); }, 2500);
        widget.getCurrentSound((snd) => { if (snd) credit(snd.title, snd.user && snd.user.username, snd.permalink_url); });
      });
      widget.bind(E.PLAY, () => { playing = true; f.classList.remove('show'); update(); });
      widget.bind(E.PAUSE, () => { playing = false; update(); });
      widget.bind(E.FINISH, () => { widget.seekTo(0); widget.play(); });
    };
    document.head.appendChild(s);
  },
  toggle() {
    wantOn = !wantOn;
    try { localStorage.setItem('crimson.music', wantOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    if (!widget) { if (wantOn) this.start(); } else if (wantOn) widget.play(); else widget.pause();
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
