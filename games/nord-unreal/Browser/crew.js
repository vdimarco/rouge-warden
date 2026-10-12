// Crew choice in game. The Crew button opens eight choices; each sends keys 1-8 through the touch controls.
// The crew member picked on the start screen (body data-crew, slot 0-7) is sent the same way when each connection starts playing.
const toggle = document.getElementById('crew-toggle');
const picker = document.getElementById('crew-picker');
let lastState = document.body.dataset.state;
let pending = false;

function setOpen(open) {
  picker.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

function remember(slot) {
  document.body.dataset.crew = String(slot);
  try { localStorage.setItem('gta-north-crew', String(slot)); } catch {}
}

function keyEvent(type, slot) {
  const event = new KeyboardEvent(type, { code: `Digit${slot + 1}`, key: String(slot + 1), bubbles: true });
  Object.defineProperty(event, 'keyCode', { value: 49 + slot });
  document.dispatchEvent(event);
}

function sendChoice() {
  const crew = document.body.dataset.crew ?? '';
  if (!pending || !/^[0-7]$/.test(crew) || document.body.dataset.state !== 'playing') return;
  const slot = Number(crew);
  if (document.body.classList.contains('touch-input')) {
    pending = false;
    // touch-controls.js holds the key for a keyboard-style click (detail 0) on a [data-key] button.
    picker.querySelector(`[data-key="${49 + slot}"]`)?.click();
  } else if (document.pointerLockElement) {
    pending = false;
    // With the mouse captured, the stream library forwards document key events to the game.
    keyEvent('keydown', slot);
    setTimeout(() => keyEvent('keyup', slot), 150);
  }
  // Otherwise wait for the player to click the game: key events reach it only with the mouse captured.
}

toggle.addEventListener('click', () => setOpen(picker.hidden));
// Close after a choice and keep it for the next connection; touch-controls.js has already sent the key.
picker.addEventListener('click', event => {
  const button = event.target.closest('button[data-key]');
  if (!button) return;
  remember(Number(button.dataset.key) - 49);
  setOpen(false);
});
// Keys 1-8 reach the game directly while playing; keep the page's choice in step with them.
document.addEventListener('keydown', event => {
  if (document.body.dataset.state === 'playing' && /^Digit[1-8]$/.test(event.code)) remember(Number(event.code.slice(5)) - 1);
});
document.addEventListener('pointerlockchange', () => setTimeout(sendChoice, 200));
new MutationObserver(() => {
  const state = document.body.dataset.state;
  if (state !== 'playing') {
    setOpen(false);
    pending = false;
  } else if (lastState !== 'playing') {
    // A connection has started playing: the game is ready for input shortly after.
    pending = true;
    setTimeout(sendChoice, 500);
  }
  lastState = state;
}).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
