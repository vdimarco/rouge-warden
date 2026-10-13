// The trailer plays muted on its own; with reduced motion it waits for the player's controls.
const trailer = document.querySelector('#game-trailer');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  trailer.removeAttribute('autoplay');
  trailer.pause();
}
