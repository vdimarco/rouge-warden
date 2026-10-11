// Enemy difficulty control on the selection screen and the badge in the match.
import { DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_HINTS, normalDifficulty, setDifficulty } from './bot-difficulty.js';
import { browserStorage, hasMatchExperience } from './first-match.js';

const KEY = 'tidebreak.difficulty';
// The choice lives here. Storage only remembers it between visits, so a blocked or full
// storage never locks the picker on Veteran.
let chosen = null;
export function savedDifficulty() {
  if (chosen === null) {
    const storage = browserStorage(); let saved = null;
    try { saved = storage?.getItem(KEY); } catch {}
    chosen = DIFFICULTIES.includes(saved) ? saved : hasMatchExperience(storage) ? normalDifficulty() : 'apprentice';
  }
  return chosen;
}
function choose(id) { chosen = normalDifficulty(id); try { localStorage.setItem(KEY, chosen); } catch {} }

export function mountDifficulty(root) {
  if (!root) return;
  const draw = () => {
    const current = savedDifficulty();
    root.innerHTML = `<span class="difficulty-title" id="difficulty-title">Enemy</span>` + DIFFICULTIES.map(id => `<button type="button" role="radio" data-difficulty="${id}" aria-checked="${id === current}" tabindex="${id === current ? 0 : -1}" title="${DIFFICULTY_HINTS[id]}">${DIFFICULTY_LABELS[id]}</button>`).join('');
    root.setAttribute('aria-labelledby', 'difficulty-title');
  };
  const pick = (id, focus) => { choose(id); draw(); if (focus) root.querySelector(`[data-difficulty="${id}"]`)?.focus(); };
  root.addEventListener('click', e => { const id = e.target.closest('[data-difficulty]')?.dataset.difficulty; if (id) pick(id, true); });
  // Arrow keys move inside the group. The menu's own keys must not see them.
  root.addEventListener('keydown', e => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); return; }
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    const i = DIFFICULTIES.indexOf(savedDifficulty());
    pick(DIFFICULTIES[(i + step + DIFFICULTIES.length) % DIFFICULTIES.length], true);
  });
  draw();
}

// The match label goes under the minimap, or beside it on short landscape phones,
// where the HUD draws nothing else. The minimap button clips its children, so the
// label stays outside it and follows the button's position.
let placed = null;
function placeBadge(badge) {
  const doc = badge.ownerDocument, win = doc?.defaultView, map = doc?.querySelector('#map-button');
  if (!map || !win) return;
  const place = () => {
    if (badge.hidden) return;
    const r = map.getBoundingClientRect(), side = win.innerHeight <= 480 && win.innerWidth < 600, w = badge.offsetWidth;
    badge.style.left = `${Math.round(side ? r.left - w - 6 : r.left + r.width / 2 - w / 2)}px`;
    badge.style.top = `${Math.round(side ? Math.max(4, r.top - 4) : r.bottom + 3)}px`;
  };
  if (placed !== place) { if (placed) win.removeEventListener('resize', placed); placed = place; win.addEventListener('resize', place); }
  win.requestAnimationFrame(place);
}
// Applies the chosen difficulty to a new match and shows it next to the minimap.
export function applyDifficulty(s, badge) {
  const id = savedDifficulty();
  choose(id);
  setDifficulty(s, id);
  if (badge) {
    placeBadge(badge);
    badge.textContent = DIFFICULTY_LABELS[id]; badge.dataset.difficulty = id;
    badge.title = `Enemy difficulty: ${DIFFICULTY_LABELS[id]}. ${DIFFICULTY_HINTS[id]}`; badge.setAttribute('aria-label', `Enemy difficulty: ${DIFFICULTY_LABELS[id]}`);
    badge.hidden = false;
  }
  return s;
}
