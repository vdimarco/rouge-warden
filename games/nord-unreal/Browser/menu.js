// One menu for the stream and game buttons. The header button opens it; while playing on a touch screen, so does the ☰ button.
const menu = document.getElementById('menu');
const frame = document.getElementById('frame');
const toggles = [...document.querySelectorAll('[data-menu-toggle]')];
const crewPicker = document.getElementById('crew-picker');
const gyroButton = document.getElementById('gyro-look');
let returnFocus = null;
let blocked = new Map();

function setMenu(open) {
  if (open === !menu.hidden) return;
  menu.hidden = !open;
  for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    returnFocus = document.activeElement;
    crewPicker.hidden = true;
    // Everything else in the game frame stays out of reach while the menu covers it.
    blocked = new Map([...frame.children].filter(child => child !== menu).map(child => [child, child.inert]));
    for (const child of blocked.keys()) child.inert = true;
    // Focus the first control a player can use; disabled or hidden ones are skipped.
    [...menu.querySelectorAll('select:enabled, button:enabled')].find(control => control.offsetParent)?.focus();
    return;
  }
  for (const [child, inert] of blocked) child.inert = inert;
  blocked = new Map();
  if ((menu.contains(document.activeElement) || document.activeElement === document.body) && returnFocus?.isConnected) returnFocus.focus();
}

for (const toggle of toggles) toggle.addEventListener('click', () => setMenu(menu.hidden));
document.getElementById('menu-close').addEventListener('click', () => setMenu(false));
// A tap outside the panel closes the menu.
menu.addEventListener('click', event => { if (event.target === menu) setMenu(false); });
document.addEventListener('keydown', event => {
  // The trailer dialog sits above the menu and handles its own Escape.
  if (event.key !== 'Escape' || menu.hidden || event.defaultPrevented || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  setMenu(false);
});
// Each game button presses the matching hidden key button, which holds the key long enough for the game to see it.
for (const button of menu.querySelectorAll('[data-send]')) {
  button.addEventListener('click', () => {
    setMenu(false);
    document.querySelector(`#touch-controls [data-key="${button.dataset.send}"]`)?.click();
  });
}
// Close after every other choice too; crew.js opens the crew list for Crew once the menu has closed.
for (const id of ['mute', 'fullscreen', 'disconnect']) document.getElementById(id).addEventListener('click', () => setMenu(false));
document.getElementById('crew-toggle').addEventListener('click', () => setMenu(false), { capture: true });
document.getElementById('streamer').addEventListener('change', () => setMenu(false));
// Keep permission and missing-sensor feedback visible; close once real motion data arrives.
new MutationObserver(() => {
  if (gyroButton.getAttribute('aria-pressed') === 'true') setMenu(false);
}).observe(gyroButton, { attributes: true, attributeFilter: ['aria-pressed'] });
// The player list lives in the menu, so open it when the page asks the player to choose; close it when the game starts.
new MutationObserver(() => {
  const state = document.body.dataset.state;
  if (state === 'selecting' && !document.querySelector('dialog[open]')) setMenu(true);
  else if (state === 'playing') setMenu(false);
}).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
