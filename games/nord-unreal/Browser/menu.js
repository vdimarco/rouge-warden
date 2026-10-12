// One menu for the stream and game buttons. The header button opens it; while playing on a touch screen, so does the ☰ button.
const menu = document.getElementById('menu');
const toggles = [...document.querySelectorAll('[data-menu-toggle]')];

function setMenu(open) {
  menu.hidden = !open;
  for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(open));
  // Focus the first control a player can use; disabled or hidden ones are skipped.
  if (open) [...menu.querySelectorAll('select:enabled, button:enabled')].find(control => control.offsetParent)?.focus();
}

for (const toggle of toggles) toggle.addEventListener('click', () => setMenu(menu.hidden));
document.getElementById('menu-close').addEventListener('click', () => setMenu(false));
// A tap outside the panel closes the menu.
menu.addEventListener('click', event => { if (event.target === menu) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) {
    event.preventDefault();
    setMenu(false);
  }
});
// Each game button presses the matching hidden key button, which holds the key long enough for the game to see it.
for (const button of menu.querySelectorAll('[data-send]')) {
  button.addEventListener('click', () => {
    document.querySelector(`#touch-controls [data-key="${button.dataset.send}"]`)?.click();
    setMenu(false);
  });
}
// Close after every other choice too; crew.js opens the crew list for Crew.
for (const id of ['crew-toggle', 'mute', 'fullscreen', 'disconnect']) document.getElementById(id).addEventListener('click', () => setMenu(false));
document.getElementById('streamer').addEventListener('change', () => setMenu(false));
// The player list lives in the menu, so open it when the page asks the player to choose; close it when the game starts.
new MutationObserver(() => {
  const state = document.body.dataset.state;
  if (state === 'selecting') setMenu(true);
  else if (state === 'playing') setMenu(false);
}).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
