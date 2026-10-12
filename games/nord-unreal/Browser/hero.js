// Title-screen trailer: a muted background loop behind the start card and a full trailer with sound on request.
const heroVideo = document.getElementById('hero-video');
const dialog = document.getElementById('trailer-dialog');
const trailer = document.getElementById('trailer-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Visitors on data saver or with reduced motion keep the still poster.
const stillOnly = () => reducedMotion.matches || navigator.connection?.saveData === true;
let heroActive = true;

export function setHeroActive(active) {
  heroActive = active;
  heroVideo.hidden = !active;
  if (active && !dialog.open && !stillOnly()) heroVideo.play().catch(() => {});
  else heroVideo.pause();
}

document.getElementById('watch-trailer').addEventListener('click', () => {
  heroVideo.pause();
  dialog.showModal();
  trailer.play().catch(() => {});
});
document.getElementById('close-trailer').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  trailer.pause();
  setHeroActive(heroActive);
});
reducedMotion.addEventListener('change', () => setHeroActive(heroActive));
