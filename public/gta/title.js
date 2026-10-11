const trailerPath = './trailer.mp4';
const trailerButton = document.querySelector('#trailer-open');
const trailerPending = document.querySelector('#trailer-pending');
const trailerDialog = document.querySelector('#trailer-dialog');
const trailerVideo = document.querySelector('#game-trailer');
const trailerClose = document.querySelector('#trailer-close');

fetch('./poster.webp', { method: 'HEAD' }).then(response => {
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return;
  document.querySelector('.scene').style.backgroundImage = "url('./poster.webp')";
  trailerVideo.poster = './poster.webp';
}).catch(() => {});

// The title page is useful before the new capture is ready. A missing video
// never becomes an empty player or an older game's trailer.
fetch(trailerPath, { method: 'HEAD' }).then(response => {
  if (!response.ok || !response.headers.get('content-type')?.startsWith('video/')) return;
  trailerPending.hidden = true;
  trailerButton.hidden = false;
  document.querySelector('#frame-caption').textContent = 'Captured from the merged NORD / Montréal game.';
}).catch(() => {});

trailerButton.addEventListener('click', () => {
  trailerVideo.src = trailerPath;
  trailerDialog.showModal();
  trailerVideo.play().catch(() => {});
});
trailerClose.addEventListener('click', () => trailerDialog.close());
trailerDialog.addEventListener('close', () => {
  trailerVideo.pause();
  trailerVideo.removeAttribute('src');
  trailerVideo.load();
});
