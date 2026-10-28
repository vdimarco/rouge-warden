// Where the session begins. Sherbrooke is the opening. Rachel is the other sidewalk.
// The choice is kept for the next connection and sent once the stream is playing:
// 9 returns to Sherbrooke, 0 begins on Rue Rachel. The default sends nothing.
const KEY = 'gta-north-place';
const buttons = {
  sherbrooke: document.getElementById('place-sherbrooke'),
  rachel: document.getElementById('place-rachel'),
};
let pending = false;
let lastState = document.body.dataset.state;

function read() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(value) {
  try { localStorage.setItem(KEY, value); } catch {}
}

function apply(place) {
  const next = place === 'rachel' ? 'rachel' : 'sherbrooke';
  document.body.dataset.place = next;
  write(next);
  for (const [name, button] of Object.entries(buttons)) {
    if (button) button.setAttribute('aria-pressed', String(name === next));
  }
}

function keyEvent(type, code, key, keyCode) {
  const event = new KeyboardEvent(type, { code, key, bubbles: true });
  Object.defineProperty(event, 'keyCode', { value: keyCode });
  document.dispatchEvent(event);
}

function send(place) {
  const key = place === 'rachel' ? 48 : 57;
  const code = place === 'rachel' ? 'Digit0' : 'Digit9';
  const label = place === 'rachel' ? '0' : '9';
  if (document.body.classList.contains('touch-input')) {
    document.querySelector(`#touch-controls [data-key="${key}"]`)?.click();
    return true;
  }
  if (!document.pointerLockElement) return false;
  keyEvent('keydown', code, label, key);
  setTimeout(() => keyEvent('keyup', code, label, key), 150);
  return true;
}

apply(read());

for (const [place, button] of Object.entries(buttons)) {
  button?.addEventListener('click', () => {
    apply(place);
    document.getElementById('menu-close').click();
    if (document.body.dataset.state === 'playing') send(place);
  });
}

document.addEventListener('pointerlockchange', () => {
  if (!pending || document.body.dataset.place !== 'rachel') return;
  pending = false;
  setTimeout(() => send('rachel'), 200);
});

new MutationObserver(() => {
  const state = document.body.dataset.state;
  if (state !== 'playing') pending = false;
  else if (lastState !== 'playing' && document.body.dataset.place === 'rachel') {
    pending = true;
    setTimeout(() => {
      if (pending && send('rachel')) pending = false;
    }, 500);
  }
  lastState = state;
}).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
