// Title-screen trailer: a light 15 s clip loops with sound behind the start card; the full trailer loads only in the modal player.
const heroVideo = document.getElementById('hero-video');
const soundButton = document.getElementById('hero-sound');
const dialog = document.getElementById('trailer-dialog');
const trailer = document.getElementById('trailer-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Visitors on data saver or with reduced motion keep the still poster.
const stillOnly = () => reducedMotion.matches || navigator.connection?.saveData === true;
let heroActive = true;
// Phones in portrait get the vertical cut; the page swaps it when the screen rotates.
const portrait = matchMedia('(orientation: portrait)');

function pickSources() {
  for (const video of [heroVideo, trailer]) {
    const src = portrait.matches ? video.dataset.portraitSrc : video.dataset.landscapeSrc;
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      video.load();
    }
  }
}

function setSound(on) {
  heroVideo.muted = !on;
  soundButton.hidden = on || heroVideo.hidden;
}

async function playHero() {
  try {
    heroVideo.muted = false;
    await heroVideo.play();
    setSound(true);
  } catch {
    // Browsers block sound before the first click, tap or key press: play muted until then.
    setSound(false);
    heroVideo.play().catch(() => {});
  }
}

function setHeroActive(active) {
  heroActive = active;
  heroVideo.hidden = !active;
  if (active && !dialog.open && !stillOnly()) playHero();
  else {
    heroVideo.pause();
    soundButton.hidden = true;
  }
}

function unlockSound() {
  if (heroActive && !dialog.open && !heroVideo.paused) setSound(true);
}
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, unlockSound, { once: true, capture: true });
soundButton.addEventListener('click', () => setSound(true));

document.getElementById('watch-trailer').addEventListener('click', () => {
  heroVideo.pause();
  soundButton.hidden = true;
  dialog.showModal();
  trailer.play().catch(() => {});
});
document.getElementById('close-trailer').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  trailer.pause();
  setHeroActive(heroActive);
});
reducedMotion.addEventListener('change', () => setHeroActive(heroActive));
portrait.addEventListener('change', () => {
  pickSources();
  if (dialog.open) trailer.play().catch(() => {});
  else setHeroActive(heroActive);
});
// Follow the player's state without touching player.js: stop the trailer while the game plays or the start screen is open.
const wantHero = () => document.body.dataset.state !== 'playing' && !document.body.dataset.intro;
const syncHero = () => {
  const active = wantHero();
  if (active !== heroActive) setHeroActive(active);
};
pickSources();
new MutationObserver(syncHero).observe(document.body, { attributes: true, attributeFilter: ['data-state', 'data-intro'] });
setHeroActive(wantHero());
