// Start screen: three story panels, then the crew choice. Start also connects, so the game loads while the player reads.
const CDN = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JnxFRyLd68bfjwUMHz1De16TMw/';
const PANELS = [
  { image: 'af3cfc6a-59ae-4ca1-a083-aff932052dd6.webp', title: 'LE PLATEAU, MONTRÉAL.',
    text: 'Eight friends. One borrowed stage. The best festival Parc La Fontaine has ever seen.' },
  { image: 'e9281f9c-e100-40cc-baaf-1927e66a1e3f.webp', title: 'THEN THE CURATOR SHOWED UP.',
    text: 'He collects perfect days. At midnight he prints the whole park into one comic page, and everyone in it stays there.' },
  { image: '56d339bc-0fd1-4ed6-9ae8-4e7d6a1f895f.webp', title: 'NO PLAN. FAST CARS.',
    text: 'Grab a worklight. Find his seams. Break his frames. Save the park tonight. Next stop: Toronto.' }
];
const CREW_SPRITE_FILE = 'e7188ec0-a77a-428c-ad52-dfcec5511aaf.webp';
const CREW_SPRITE = `url("${CDN}${CREW_SPRITE_FILE}")`;
const CREW_KEY = 'gta-north-crew';
const SEEN_KEY = 'gta-north-intro';

const element = id => document.getElementById(id);
const intro = element('intro');
const story = element('intro-story');
const crewScreen = element('intro-crew');
const image = element('intro-image');
const next = element('intro-next');
const playAs = element('crew-play');
const statusLine = element('intro-status');
const role = element('crew-role');
const cards = [...element('crew-grid').querySelectorAll('button')];
let panel = 0;

// Storage can be blocked or empty (private windows, previews): the screen still works without it.
function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

let choice = /^[0-7]$/.test(read(CREW_KEY) ?? '') ? Number(read(CREW_KEY)) : -1;
// crew.js sends this crew member to the game (keys 1-8) when the stream starts playing.
if (choice >= 0) document.body.dataset.crew = String(choice);

function showPanel(index) {
  panel = index;
  const { image: file, title, text } = PANELS[index];
  story.hidden = false;
  crewScreen.hidden = true;
  image.src = CDN + file;
  element('intro-step').textContent = `${index + 1} / ${PANELS.length}`;
  element('intro-title').textContent = title;
  element('intro-text').textContent = text;
  next.textContent = index < PANELS.length - 1 ? 'Next ▶' : 'Choose your crew ▶';
  next.focus();
}

function select(slot) {
  choice = slot;
  for (const card of cards) card.setAttribute('aria-pressed', String(Number(card.dataset.slot) === slot));
  const card = cards[slot];
  role.textContent = card ? card.dataset.role : 'Tap a crew member.';
  playAs.disabled = !card;
  playAs.textContent = card ? `Play as ${card.querySelector('b').textContent} ▶` : 'Choose a crew member';
}

function showCrew() {
  write(SEEN_KEY, 'seen');
  story.hidden = true;
  crewScreen.hidden = false;
  intro.style.setProperty('--crew-sprite', CREW_SPRITE);
  select(choice);
  (cards[choice] || cards[0]).focus();
}

function syncStatus() {
  const state = document.body.dataset.state;
  statusLine.textContent = state === 'ready' ? 'The game is ready.'
    : state === 'idle' ? '' : element('status-title').textContent;
}

// Fetch every picture as Start is pressed, about 300 KB, so each panel shows at once.
let preloaded = false;
function preload() {
  if (preloaded) return;
  preloaded = true;
  for (const file of [...PANELS.map(({ image: name }) => name), CREW_SPRITE_FILE]) new Image().src = CDN + file;
}

function open() {
  preload();
  // The Crew button and keys 1-8 may have changed the crew member since the page loaded.
  const current = document.body.dataset.crew ?? '';
  if (/^[0-7]$/.test(current)) choice = Number(current);
  intro.hidden = false;
  // The title screen underneath stays out of reach and out of screen readers while the start screen is open.
  element('overlay').inert = true;
  document.body.dataset.intro = 'open';
  syncStatus();
  if (read(SEEN_KEY)) showCrew();
  else showPanel(0);
}

function close(starting = false) {
  intro.hidden = true;
  element('overlay').inert = false;
  // While the stream starts, the title trailer stays off; the next connection state ends that.
  if (starting) {
    document.body.dataset.intro = 'starting';
    return;
  }
  delete document.body.dataset.intro;
  const play = element('play');
  (!play.hidden ? play : document.body.dataset.state === 'selecting' ? element('streamer') : element('start')).focus();
}

element('start').addEventListener('click', () => {
  open();
  // Connect in the background; the status card under the start screen keeps the connection state.
  const connect = element('connect');
  if (!connect.disabled && !connect.hidden) connect.click();
});
next.addEventListener('click', () => {
  if (panel < PANELS.length - 1) showPanel(panel + 1);
  else showCrew();
});
element('intro-skip').addEventListener('click', showCrew);
element('intro-story-again').addEventListener('click', () => showPanel(0));
for (const card of cards) card.addEventListener('click', () => select(Number(card.dataset.slot)));
playAs.addEventListener('click', () => {
  if (choice < 0) return;
  write(CREW_KEY, String(choice));
  document.body.dataset.crew = String(choice);
  const play = element('play');
  const ready = document.body.dataset.state === 'ready' && !play.hidden;
  close(ready);
  // Still inside the tap, so the stream may start with sound; otherwise the card shows Play with sound when ready.
  if (ready) play.click();
});
intro.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
});
new MutationObserver(() => {
  syncStatus();
  if (document.body.dataset.intro === 'starting') delete document.body.dataset.intro;
}).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
new MutationObserver(syncStatus).observe(element('status-title'), { childList: true, characterData: true, subtree: true });
