// Title-screen trailer: the full trailer loops with sound behind the start card, and opens in a modal player on request.
const heroVideo = document.getElementById('hero-video');
const soundButton = document.getElementById('hero-sound');
const dialog = document.getElementById('trailer-dialog');
const trailer = document.getElementById('trailer-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Visitors on data saver or with reduced motion keep the still poster.
const stillOnly = () => reducedMotion.matches || navigator.connection?.saveData === true;
let heroActive = true;

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

export function setHeroActive(active) {
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
// Start on load: the offline page never changes state, so it does not call setHeroActive itself.
setHeroActive(document.body.dataset.state !== 'playing');
