// Enemy difficulty control on the selection screen and the badge in the match.
import { DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_HINTS, normalDifficulty, setDifficulty } from './bot-difficulty.js';

const KEY = 'tidebreak.difficulty';
export function savedDifficulty() { try { return normalDifficulty(localStorage.getItem(KEY)); } catch { return normalDifficulty(); } }
function save(id) { try { localStorage.setItem(KEY, id); } catch {} }

export function mountDifficulty(root) {
  if (!root) return;
  const draw = () => {
    const current = savedDifficulty();
    root.innerHTML = `<span class="difficulty-title" id="difficulty-title">Enemy</span>` + DIFFICULTIES.map(id => `<button type="button" role="radio" data-difficulty="${id}" aria-checked="${id === current}" tabindex="${id === current ? 0 : -1}" title="${DIFFICULTY_HINTS[id]}">${DIFFICULTY_LABELS[id]}</button>`).join('');
    root.setAttribute('aria-labelledby', 'difficulty-title');
  };
  const pick = (id, focus) => { save(id); draw(); if (focus) root.querySelector(`[data-difficulty="${id}"]`)?.focus(); };
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

// Applies the saved difficulty to a new match and shows it in the HUD.
export function applyDifficulty(s, badge) {
  const id = savedDifficulty();
  setDifficulty(s, id);
  if (badge) { badge.textContent = `Enemy · ${DIFFICULTY_LABELS[id]}`; badge.dataset.difficulty = id; badge.title = DIFFICULTY_HINTS[id]; badge.hidden = false; }
  return s;
}
